const db = require('../config/db');
const { AI_PROVIDERS, getPublicModels } = require('../config/aiProviders');

function listModels(req, res) {
  return res.json(getPublicModels());
}

async function getUsage(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT model_used, COUNT(*) AS used_today
       FROM projects
       WHERE DATE(created_at) = CURDATE()
       GROUP BY model_used`
    );
    const usageByModel = new Map(
      rows.map((row) => [row.model_used, Number(row.used_today || 0)])
    );

    return res.json(
      Object.entries(AI_PROVIDERS).map(([id, provider]) => ({
        id,
        label: provider.label,
        used: usageByModel.get(id) || 0,
        limit: provider.dailyLimit
      }))
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listModels,
  getUsage
};
