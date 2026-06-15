const OpenAI = require('openai');
const cheerio = require('cheerio');
const { AI_PROVIDERS, FALLBACK_ORDER } = require('../config/aiProviders');
const { AppError } = require('../middleware/errorHandler');
const modelSettings = require('./modelSettings.service');
require('../config/env');

const SINGLE_PAGE_SYSTEM_PROMPT = `You are a website generator. From the provided description, return ONE complete,
standalone HTML file. STRICT rules:
- Reply ONLY with HTML code, with no text before or after it and no markdown fences.
- The document must be complete: from <!doctype html> to </html>.
- Style with the Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script> in the <head>.
- The site must be responsive, mobile-first, modern and polished.
- Required structure: header with navigation, hero section, 2 to 3 content sections, footer.
- Use at most 5 to 6 images across the whole site, reusing the same visual themes when relevant.
- For EVERY image, NEVER write a URL and NEVER add a src attribute. Instead, insert an <img> tag
  with a data-query attribute containing 2 to 5 ENGLISH keywords that precisely describe the real
  subject of the image and directly match the surrounding section, plus width, height and alt.
  Example: <img data-query="red ford mustang sports car" alt="Ford Mustang" width="1200" height="600" />
  The src attribute will be injected automatically by the server.
  Keywords must include the exact central subject of the section when possible: brand, object, dish,
  place, profession or mood. Never use vague queries like "business website", "hero image", "office",
  "abstract" or "technology" unless they precisely describe the neighboring text.
- In the site footer, add the text "Photos provided by Pexels" with a link to https://www.pexels.com
  as required by the Pexels terms of use.
- Videos may also be used when relevant, but limit them to 1 or 2 videos maximum.
- Follow the provided style preferences closely: colors, theme and title.
- Do not use external dependencies other than the Tailwind CDN.`;

const MULTIPAGE_ONE_SHOT_SYSTEM_PROMPT = `Tu es un générateur de sites web multi-pages. À partir de la description fournie, tu produis UN SEUL
fichier HTML complet et autonome contenant PLUSIEURS pages. Règles STRICTES :
- Réponds UNIQUEMENT avec le code HTML, de <!DOCTYPE html> à </html>, sans texte ni balises markdown.
- Style via Tailwind CSS en CDN : <script src="https://cdn.tailwindcss.com"></script> dans le <head>.
- Le site comporte 3 à 5 pages adaptées au type de site (ex. Accueil, À propos, Services/Menu,
  Galerie, Contact). Chaque page est une <section> avec un id préfixé "page-" (ex. id="page-home").
- Une barre de navigation fixe en haut, présente sur tout le site, avec un lien par page portant
  l'attribut data-page (ex. <a href="#" data-page="about">À propos</a>).
- Toutes les pages partagent le MÊME header, le MÊME footer et la MÊME charte (couleurs, typographie).
- La page d'accueil a id="page-home" et est la seule visible au chargement.
- Insère, juste avant </body>, ce script EXACTEMENT tel quel :
  <script>
    const pages = document.querySelectorAll('[id^="page-"]');
    const links = document.querySelectorAll('[data-page]');
    function show(name){ pages.forEach(p => { p.style.display = (p.id === 'page-' + name) ? 'block' : 'none'; }); }
    links.forEach(l => l.addEventListener('click', e => { e.preventDefault(); show(l.dataset.page); window.scrollTo(0,0); }));
    show('home');
  </script>
- Utilise au maximum 5 à 6 images sur l'ensemble du site.
- Pour CHAQUE image, n'écris JAMAIS d'URL ni de src. Insère <img> avec data-query contenant 2 à 5
  mots-clés EN ANGLAIS décrivant le sujet réel, plus width, height et alt. Le src sera injecté.
- Dans le footer (commun à toutes les pages), ajoute « Photos provided by Pexels » avec un lien vers
  https://www.pexels.com.
- Respecte les préférences de style fournies (couleurs, thème, titre).`;

const MULTIPAGE_PLAN_SYSTEM_PROMPT = `Tu conçois la structure d'un site web multi-pages pour la description fournie. Renvoie UNIQUEMENT un
objet JSON valide, sans texte ni balise markdown, de cette forme exacte :
{
  "pages": [ { "id": "home", "label": "Accueil", "brief": "contenu détaillé attendu pour cette page" }, ... ],
  "headerHtml": "<header>...</header>",
  "footerHtml": "<footer>...</footer>"
}
Règles :
- 3 à 5 pages adaptées au type de site. La première a obligatoirement "id": "home".
- headerHtml : une barre de navigation cohérente avec un lien par page : <a href="#" data-page="ID">Label</a>
  (ID = l'id exact de la page). Inclure le logo/nom du site.
- footerHtml : un pied de page commun incluant « Photos provided by Pexels » avec un lien vers
  https://www.pexels.com.
- Style via classes Tailwind (le site chargera Tailwind via CDN). Respecte les couleurs et le thème fournis.
- "brief" décrit précisément et richement ce que chaque page doit contenir (sous-sections, ton, éléments).`;

function getSystemPrompt(mode = 'single') {
  return mode === 'multipage' ? MULTIPAGE_ONE_SHOT_SYSTEM_PROMPT : SINGLE_PAGE_SYSTEM_PROMPT;
}

function getDefaultMaxTokens(mode = 'single') {
  return mode === 'multipage' ? 16000 : 8000;
}

function cleanModelText(content) {
  if (!content || typeof content !== 'string') {
    throw new AppError('The AI provider returned an empty response.', 502);
  }

  return content
    .trim()
    .replace(/^```(?:html|json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function cleanGeneratedHtml(content) {
  return cleanModelText(content);
}

function buildUserPrompt(userPrompt, styleOptions = {}) {
  return `${userPrompt}\n\nStyle preferences JSON:\n${JSON.stringify(styleOptions, null, 2)}`;
}

function buildRevisionPrompt(currentHtml, revisionRequest) {
  return [
    'Modify the existing standalone HTML website according to the user request.',
    'Preserve the current content and visual identity unless the request explicitly changes them.',
    'Return the full updated standalone HTML document, not a diff and not an explanation.',
    '',
    'Current HTML:',
    currentHtml,
    '',
    'Requested modification:',
    revisionRequest
  ].join('\n');
}

function parsePlanJson(content) {
  try {
    const parsed = JSON.parse(cleanModelText(content));

    if (!Array.isArray(parsed.pages) || parsed.pages.length < 1) {
      return null;
    }

    const pages = parsed.pages
      .slice(0, 5)
      .map((page, index) => ({
        id: index === 0 ? 'home' : String(page.id || `page-${index + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '') || `page-${index + 1}`,
        label: String(page.label || (index === 0 ? 'Home' : `Page ${index + 1}`)).trim(),
        brief: String(page.brief || 'Create a rich, complete page with realistic sections and useful details.').trim()
      }));

    if (pages.length < 3) {
      return null;
    }

    pages[0].id = 'home';

    if (typeof parsed.headerHtml !== 'string' || typeof parsed.footerHtml !== 'string') {
      return null;
    }

    if (!parsed.headerHtml.includes('data-page') || !parsed.footerHtml.includes('pexels.com')) {
      return null;
    }

    return {
      pages,
      headerHtml: normalizeShellHtml(parsed.headerHtml, 'header'),
      footerHtml: normalizeShellHtml(parsed.footerHtml, 'footer')
    };
  } catch (error) {
    return null;
  }
}

function normalizeShellHtml(html, selector) {
  const content = String(html || '').trim();
  const $ = cheerio.load(content, null, false);
  const element = $(selector).first();

  return element.length > 0 ? $.html(element) : content;
}

function removeGeneratedShellNoise($) {
  $('script, header, footer').remove();
  $('nav').filter((index, el) => {
    const nav = $(el);
    return nav.find('[data-page]').length > 0 || nav.find('a[href="#"]').length > 1;
  }).remove();
}

function buildPageSystemPrompt(page, plan, styleOptions = {}) {
  const pageList = plan.pages.map((item) => `${item.id}: ${item.label}`).join(', ');
  const theme = [
    `Primary color: ${styleOptions.primaryColor || 'not specified'}`,
    `Mood/theme: ${styleOptions.mood || 'not specified'}`,
    `Title: ${styleOptions.title || 'not specified'}`
  ].join('; ');

  return `Tu génères UNE page d'un site web multi-pages déjà conçu. Renvoie UNIQUEMENT le HTML de cette page,
sous la forme d'une seule <section id="page-${page.id}">...</section>, sans header ni footer, sans markdown.
À respecter absolument pour la cohérence du site :
- Thème et couleurs : ${theme}.
- Header du site (pour le style et les liens, ne pas le régénérer) : ${plan.headerHtml}
- Pages du site (pour d'éventuels liens internes avec data-page) : ${pageList}.
Contenu :
- Cette page est « ${page.label} ». Brief : ${page.brief}.
- Produis un contenu RICHE et COMPLET : plusieurs sous-sections, du texte réaliste et fourni, des
  éléments pertinents selon la page (listes, cartes, grilles, formulaire factice pour Contact, etc.).
  Profite de tout l'espace — c'est l'intérêt de générer chaque page séparément.
- Ne génère JAMAIS de <header>, <nav> global, <footer>, <html>, <head>, <body> ni <script>.
  Le header, le footer et le script de navigation seront ajoutés automatiquement par le serveur.
- Utilise au maximum 5 à 6 images sur l'ensemble du site, donc 0 à 2 images sur cette page selon sa pertinence.
- Pour CHAQUE image, n'écris ni URL ni src : <img data-query="mots-clés anglais" alt="..." width="..." height="..." />.
- Style via classes Tailwind cohérentes avec le header et le reste du site.`;
}

function ensurePageSection(html, pageId) {
  const content = cleanGeneratedHtml(html);
  const $ = cheerio.load(content, null, false);
  const section = $(`section#page-${pageId}`).first();

  if (section.length > 0) {
    section.find('script, header, footer').remove();
    section.find('nav').filter((index, el) => {
      const nav = $(el);
      return nav.find('[data-page]').length > 0 || nav.find('a[href="#"]').length > 1;
    }).remove();
    return $.html(section);
  }

  removeGeneratedShellNoise($);
  const body = $('body');
  const cleanedContent = (body.length > 0 ? body.html() : $.root().html())?.trim() || '';

  return `<section id="page-${pageId}" class="min-h-screen py-16">${cleanedContent}</section>`;
}

function assembleMultiPageHtml(plan, pageSections) {
  const head = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<script src="https://cdn.tailwindcss.com"></script></head>';
  const navScript = '<script>'
    + "const pages=document.querySelectorAll('[id^=\"page-\"]');"
    + "const links=document.querySelectorAll('[data-page]');"
    + "function show(n){pages.forEach(p=>{p.style.display=(p.id==='page-'+n)?'block':'none';});}"
    + "links.forEach(l=>l.addEventListener('click',e=>{e.preventDefault();show(l.dataset.page);window.scrollTo(0,0);}));"
    + "show('home');</script>";

  return `${head}<body>${plan.headerHtml}${pageSections.join('\n')}${plan.footerHtml}${navScript}</body></html>`;
}

function getProviderApiKey(provider) {
  return process.env[provider.apiKeyEnv] || process.env[provider.legacyApiKeyEnv];
}

function getGenerationOrder(requestedModelId, allowedModelIds = null) {
  const allowedSet = Array.isArray(allowedModelIds) ? new Set(allowedModelIds) : null;
  const fallbackOrder = FALLBACK_ORDER.filter((id) => !allowedSet || allowedSet.has(id));

  if (fallbackOrder.length === 0) {
    return [];
  }

  const requested = fallbackOrder.includes(requestedModelId) ? requestedModelId : fallbackOrder[0];
  return [
    requested,
    ...fallbackOrder.filter((id) => id !== requested)
  ];
}

function isFallbackEligibleError(error) {
  const status = error.status || error.statusCode;

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    error.code === 'MISSING_AI_PROVIDER_KEY'
  );
}

function isProviderConfigurationError(error) {
  const status = error.status || error.statusCode;

  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    error.code === 'MISSING_AI_PROVIDER_KEY'
  );
}

function buildSelectedProviderError(providerId, error) {
  const provider = AI_PROVIDERS[providerId];
  const status = error.status || error.statusCode;

  if (error.code === 'MISSING_AI_PROVIDER_KEY') {
    return new AppError(
      `${provider.label} is selected but ${provider.apiKeyEnv} is not configured in backend/backend.env.`,
      500
    );
  }

  if (status === 401 || status === 403) {
    return new AppError(
      `${provider.label} rejected the API key. Update ${provider.apiKeyEnv} in backend/backend.env.`,
      502
    );
  }

  if (status === 404) {
    return new AppError(
      `${provider.label} returned 404. The configured model "${provider.model}" or endpoint is unavailable.`,
      502
    );
  }

  return error;
}

async function createCompletion(client, provider, messages, maxTokens) {
  return client.chat.completions.create({
    model: provider.model,
    messages,
    temperature: 0.7,
    max_tokens: maxTokens
  });
}

async function tryProviderPrompt(providerId, messages, options = {}) {
  const provider = AI_PROVIDERS[providerId];

  if (!provider) {
    return null;
  }

  const apiKey = getProviderApiKey(provider);

  if (!apiKey) {
    const error = new AppError(`${provider.label} API key is not configured on the server.`, 500);
    error.code = 'MISSING_AI_PROVIDER_KEY';
    throw error;
  }

  const client = new OpenAI({
    apiKey,
    baseURL: provider.baseURL
  });

  const initialMaxTokens = options.maxTokens || 8000;
  let apiCalls = 0;
  let completion;

  try {
    apiCalls += 1;
    completion = await createCompletion(client, provider, messages, initialMaxTokens);
  } catch (error) {
    error.apiCalls = apiCalls;
    throw error;
  }

  let choice = completion.choices?.[0];

  if (options.retryOnLength && choice?.finish_reason === 'length' && initialMaxTokens < 24000) {
    try {
      apiCalls += 1;
      completion = await createCompletion(client, provider, messages, 24000);
    } catch (error) {
      error.apiCalls = apiCalls;
      throw error;
    }
    choice = completion.choices?.[0];
  }

  return {
    content: cleanModelText(choice?.message?.content),
    modelUsed: providerId,
    apiCalls
  };
}

async function tryProvider(providerId, userPrompt, styleOptions, options = {}) {
  const mode = options.mode || 'single';
  const result = await tryProviderPrompt(
    providerId,
    [
      { role: 'system', content: getSystemPrompt(mode) },
      { role: 'user', content: buildUserPrompt(userPrompt, styleOptions) }
    ],
    {
      maxTokens: options.maxTokens || getDefaultMaxTokens(mode),
      retryOnLength: mode === 'multipage'
    }
  );

  return {
    code: cleanGeneratedHtml(result.content),
    modelUsed: result.modelUsed,
    apiCalls: result.apiCalls
  };
}

async function runPromptWithFallback({
  requestedModelId,
  allowedModelIds,
  messages,
  maxTokens,
  retryOnLength = false,
  blockedModelIds = new Set()
}) {
  const eligibleModelIds = Array.isArray(allowedModelIds)
    ? allowedModelIds.filter((id) => !blockedModelIds.has(id))
    : null;
  const order = getGenerationOrder(requestedModelId, eligibleModelIds);
  let sawQuotaError = false;
  let sawMissingKey = false;
  let sawUnavailableProvider = false;
  let apiCalls = 0;

  for (const providerId of order) {
    try {
      const result = await tryProviderPrompt(providerId, messages, { maxTokens, retryOnLength });
      apiCalls += result.apiCalls;

      return {
        ...result,
        apiCalls
      };
    } catch (error) {
      apiCalls += Number(error.apiCalls || 0);
      const isSelectedProvider = providerId === order[0];

      if (isSelectedProvider && isProviderConfigurationError(error)) {
        throw buildSelectedProviderError(providerId, error);
      }

      if (error.status === 429 || error.statusCode === 429) {
        sawQuotaError = true;
        blockedModelIds.add(providerId);
        try {
          await modelSettings.autoDisableModel(providerId);
        } catch (settingsError) {
          // Fallback should still continue if the model status table is temporarily unavailable.
        }
        continue;
      }

      if (isProviderConfigurationError(error)) {
        sawMissingKey = true;
        continue;
      }

      if (isFallbackEligibleError(error)) {
        sawUnavailableProvider = true;
        continue;
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('AI generation failed. Please try again later.', 502);
    }
  }

  if (sawQuotaError) {
    const error = new AppError('All AI models have reached their quota. Please try again later.', 429);
    error.apiCalls = apiCalls;
    throw error;
  }

  if (sawMissingKey) {
    throw new AppError('No configured AI provider key is available on the server.', 500);
  }

  if (sawUnavailableProvider) {
    throw new AppError('No AI provider is currently available. Please try again later.', 502);
  }

  throw new AppError('No AI provider is available.', 500);
}

async function getAllowedModelIds(options = {}, mode = 'single') {
  let allowedModelIds = options.allowedModelIds;

  if (!Array.isArray(allowedModelIds)) {
    try {
      allowedModelIds = await modelSettings.getEnabledModelIds();
    } catch (settingsError) {
      allowedModelIds = null;
    }
  }

  if (Array.isArray(allowedModelIds) && mode === 'multipage') {
    return allowedModelIds.filter((id) => AI_PROVIDERS[id]?.supportsMultiPage);
  }

  return allowedModelIds;
}

async function generateOneShotMultiPage(userPrompt, styleOptions, requestedModelId, options, blockedModelIds, apiCallsSoFar = 0) {
  const result = await runPromptWithFallback({
    requestedModelId,
    allowedModelIds: options.allowedModelIds,
    messages: [
      { role: 'system', content: MULTIPAGE_ONE_SHOT_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(userPrompt, styleOptions) }
    ],
    maxTokens: 16000,
    retryOnLength: true,
    blockedModelIds
  });

  return {
    code: cleanGeneratedHtml(result.content),
    modelUsed: result.modelUsed,
    apiCalls: apiCallsSoFar + result.apiCalls
  };
}

async function generateMultiPageSite(userPrompt, styleOptions, requestedModelId, options = {}) {
  const blockedModelIds = new Set();
  const allowedModelIds = await getAllowedModelIds(options, 'multipage');
  const planResult = await runPromptWithFallback({
    requestedModelId,
    allowedModelIds,
    messages: [
      { role: 'system', content: MULTIPAGE_PLAN_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(userPrompt, styleOptions) }
    ],
    maxTokens: 4000,
    blockedModelIds
  });
  const plan = parsePlanJson(planResult.content);

  if (!plan) {
    return generateOneShotMultiPage(
      userPrompt,
      styleOptions,
      planResult.modelUsed,
      { allowedModelIds },
      blockedModelIds,
      planResult.apiCalls
    );
  }

  let currentModelId = planResult.modelUsed;
  let apiCalls = planResult.apiCalls;
  const pageSections = [];

  for (const page of plan.pages) {
    const pageResult = await runPromptWithFallback({
      requestedModelId: currentModelId,
      allowedModelIds,
      messages: [
        { role: 'system', content: buildPageSystemPrompt(page, plan, styleOptions) },
        { role: 'user', content: buildUserPrompt(userPrompt, styleOptions) }
      ],
      maxTokens: 8000,
      blockedModelIds
    });

    currentModelId = pageResult.modelUsed;
    apiCalls += pageResult.apiCalls;
    pageSections.push(ensurePageSection(pageResult.content, page.id));
  }

  return {
    code: assembleMultiPageHtml(plan, pageSections),
    modelUsed: currentModelId,
    apiCalls
  };
}

async function generateSite(
  userPrompt,
  styleOptions = {},
  requestedModelId = FALLBACK_ORDER[0],
  options = {}
) {
  const mode = options.mode || 'single';

  if (mode === 'multipage') {
    return generateMultiPageSite(userPrompt, styleOptions, requestedModelId, options);
  }

  const allowedModelIds = await getAllowedModelIds(options, mode);
  const result = await runPromptWithFallback({
    requestedModelId,
    allowedModelIds,
    messages: [
      { role: 'system', content: SINGLE_PAGE_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(userPrompt, styleOptions) }
    ],
    maxTokens: options.maxTokens || getDefaultMaxTokens(mode)
  });

  return {
    code: cleanGeneratedHtml(result.content),
    modelUsed: result.modelUsed,
    apiCalls: result.apiCalls
  };
}

async function reviseSite(
  currentHtml,
  revisionRequest,
  styleOptions = {},
  requestedModelId = FALLBACK_ORDER[0],
  options = {}
) {
  return generateSite(
    buildRevisionPrompt(currentHtml, revisionRequest),
    styleOptions,
    requestedModelId,
    options
  );
}

module.exports = {
  generateSite,
  reviseSite,
  cleanGeneratedHtml,
  buildUserPrompt,
  buildRevisionPrompt,
  getGenerationOrder,
  getSystemPrompt,
  getDefaultMaxTokens,
  isFallbackEligibleError,
  isProviderConfigurationError,
  buildSelectedProviderError
};
