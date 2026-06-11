const AI_PROVIDERS = {
  'gemini-flash': {
    label: 'Gemini 2.5 Flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnv: 'GEMINI_API_KEY',
    legacyApiKeyEnv: 'AI_API_KEY',
    model: 'gemini-2.5-flash',
    dailyLimit: 250
  },
  'gemini-flash-lite': {
    label: 'Gemini 2.5 Flash-Lite',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnv: 'GEMINI_API_KEY',
    legacyApiKeyEnv: 'AI_API_KEY',
    model: 'gemini-2.5-flash-lite',
    dailyLimit: 1000
  },
  'groq-llama': {
    label: 'Groq Llama 3.3 70B',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
    dailyLimit: 1000
  }
};

const FALLBACK_ORDER = ['gemini-flash', 'groq-llama', 'gemini-flash-lite'];

function getPublicModels() {
  return Object.entries(AI_PROVIDERS).map(([id, provider]) => ({
    id,
    label: provider.label
  }));
}

module.exports = {
  AI_PROVIDERS,
  FALLBACK_ORDER,
  getPublicModels
};
