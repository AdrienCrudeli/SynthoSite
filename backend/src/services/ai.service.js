const OpenAI = require('openai');
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

const MULTIPAGE_SYSTEM_PROMPT = `Tu es un générateur de sites web multi-pages. À partir de la description fournie, tu produis UN SEUL
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

function getSystemPrompt(mode = 'single') {
  return mode === 'multipage' ? MULTIPAGE_SYSTEM_PROMPT : SINGLE_PAGE_SYSTEM_PROMPT;
}

function getDefaultMaxTokens(mode = 'single') {
  return mode === 'multipage' ? 16000 : 8000;
}

function cleanGeneratedHtml(content) {
  if (!content || typeof content !== 'string') {
    throw new AppError('The AI provider returned an empty response.', 502);
  }

  return content
    .trim()
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
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

async function createCompletion(client, provider, userPrompt, styleOptions, mode, maxTokens) {
  return client.chat.completions.create({
    model: provider.model,
    messages: [
      { role: 'system', content: getSystemPrompt(mode) },
      { role: 'user', content: buildUserPrompt(userPrompt, styleOptions) }
    ],
    temperature: 0.7,
    max_tokens: maxTokens
  });
}

async function tryProvider(providerId, userPrompt, styleOptions, options = {}) {
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

  const mode = options.mode || 'single';
  const initialMaxTokens = options.maxTokens || getDefaultMaxTokens(mode);
  let completion = await createCompletion(client, provider, userPrompt, styleOptions, mode, initialMaxTokens);
  let choice = completion.choices?.[0];

  if (mode === 'multipage' && choice?.finish_reason === 'length' && initialMaxTokens < 24000) {
    completion = await createCompletion(client, provider, userPrompt, styleOptions, mode, 24000);
    choice = completion.choices?.[0];
  }

  return {
    code: cleanGeneratedHtml(choice?.message?.content),
    modelUsed: providerId
  };
}

async function generateSite(
  userPrompt,
  styleOptions = {},
  requestedModelId = FALLBACK_ORDER[0],
  options = {}
) {
  const mode = options.mode || 'single';
  let allowedModelIds = options.allowedModelIds;

  if (!Array.isArray(allowedModelIds)) {
    try {
      allowedModelIds = await modelSettings.getEnabledModelIds();
    } catch (settingsError) {
      allowedModelIds = null;
    }
  }

  if (Array.isArray(allowedModelIds) && mode === 'multipage') {
    allowedModelIds = allowedModelIds.filter((id) => AI_PROVIDERS[id]?.supportsMultiPage);
  }

  const order = getGenerationOrder(requestedModelId, allowedModelIds);
  let sawQuotaError = false;
  let sawMissingKey = false;
  let sawUnavailableProvider = false;

  for (const providerId of order) {
    try {
      const result = await tryProvider(providerId, userPrompt, styleOptions, {
        mode,
        maxTokens: options.maxTokens
      });

      if (result) {
        return result;
      }
    } catch (error) {
      const isSelectedProvider = providerId === order[0];

      if (isSelectedProvider && isProviderConfigurationError(error)) {
        throw buildSelectedProviderError(providerId, error);
      }

      if (error.status === 429 || error.statusCode === 429) {
        sawQuotaError = true;
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
    throw new AppError('All AI models have reached their quota. Please try again later.', 429);
  }

  if (sawMissingKey) {
    throw new AppError('No configured AI provider key is available on the server.', 500);
  }

  if (sawUnavailableProvider) {
    throw new AppError('No AI provider is currently available. Please try again later.', 502);
  }

  throw new AppError('No AI provider is available.', 500);
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
