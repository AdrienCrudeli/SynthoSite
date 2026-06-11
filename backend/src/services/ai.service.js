const OpenAI = require('openai');
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

let client;

function getClient() {
  if (!process.env.AI_API_KEY) {
    throw new AppError('AI API key is not configured on the server.', 500);
  }

  if (!process.env.AI_BASE_URL) {
    throw new AppError('AI base URL is not configured on the server.', 500);
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL
    });
  }

  return client;
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

async function generateSite(userPrompt, styleOptions = {}) {
  try {
    const completion = await getClient().chat.completions.create({
      model: process.env.AI_MODEL || 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${userPrompt}\n\nStyle preferences JSON:\n${JSON.stringify(styleOptions, null, 2)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 8000
    });

    return cleanGeneratedHtml(completion.choices?.[0]?.message?.content);
  } catch (error) {
    if (error.status === 429 || error.statusCode === 429) {
      throw new AppError('AI quota exceeded. Please try again later.', 429);
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('AI generation failed. Please try again later.', 502);
  }
}

module.exports = {
  generateSite,
  cleanGeneratedHtml
};
