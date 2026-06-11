const OpenAI = require('openai');
const { AI_PROVIDERS, FALLBACK_ORDER } = require('../config/aiProviders');
const { AppError } = require('../middleware/errorHandler');
require('../config/env');

const SYSTEM_PROMPT = `Tu es un générateur de sites web. À partir de la description fournie, tu renvoies UN SEUL
fichier HTML complet et autonome. Règles STRICTES :
- Réponds UNIQUEMENT avec le code HTML, sans aucun texte avant ou après, sans balises markdown.
- Le document est complet : de <!doctype html> à </html>.
- Style via Tailwind CSS en CDN : <script src="https://cdn.tailwindcss.com"></script> dans le <head>.
- Le site doit être responsive (mobile-first), moderne et soigné.
- Structure obligatoire : header avec navigation, section hero, 2 à 3 sections de contenu, footer.
- Pour TOUTES les images, utilise UNIQUEMENT des URLs de la forme
  https://picsum.photos/seed/MOT-CLE/LARGEUR/HAUTEUR (jamais d'autres sources, jamais d'images locales).
- Respecte scrupuleusement les préférences de style fournies (couleurs, thème, titre).
- Pas de dépendances externes autres que le CDN Tailwind.`;

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

function getProviderApiKey(provider) {
  return process.env[provider.apiKeyEnv] || process.env[provider.legacyApiKeyEnv];
}

function getGenerationOrder(requestedModelId) {
  const requested = AI_PROVIDERS[requestedModelId] ? requestedModelId : FALLBACK_ORDER[0];
  return [
    requested,
    ...FALLBACK_ORDER.filter((id) => id !== requested)
  ];
}

function isFallbackEligibleError(error) {
  const status = error.status || error.statusCode;

  return (
    status === 429 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    error.code === 'MISSING_AI_PROVIDER_KEY'
  );
}

async function tryProvider(providerId, userPrompt, styleOptions) {
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

  const completion = await client.chat.completions.create({
    model: provider.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(userPrompt, styleOptions) }
    ],
    temperature: 0.7,
    max_tokens: 8000
  });

  return {
    code: cleanGeneratedHtml(completion.choices?.[0]?.message?.content),
    modelUsed: providerId
  };
}

async function generateSite(userPrompt, styleOptions = {}, requestedModelId = FALLBACK_ORDER[0]) {
  const order = getGenerationOrder(requestedModelId);
  let sawQuotaError = false;
  let sawMissingKey = false;
  let sawUnavailableProvider = false;

  for (const providerId of order) {
    try {
      const result = await tryProvider(providerId, userPrompt, styleOptions);

      if (result) {
        return result;
      }
    } catch (error) {
      if (error.status === 429 || error.statusCode === 429) {
        sawQuotaError = true;
        continue;
      }

      if (error.code === 'MISSING_AI_PROVIDER_KEY') {
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

module.exports = {
  generateSite,
  cleanGeneratedHtml,
  buildUserPrompt,
  isFallbackEligibleError
};
