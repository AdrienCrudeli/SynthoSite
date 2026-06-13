const { AI_PROVIDERS } = require('../config/aiProviders');
const modelSettings = require('../services/modelSettings.service');
const { getAiUsageByModel } = require('../services/usage.service');

async function listModels(req, res, next) {
  try {
    const models = await modelSettings.listModels({ includeDisabled: false });

    return res.json(
      models.map((model) => ({
        id: model.id,
        label: model.label
      }))
    );
  } catch (error) {
    return next(error);
  }
}

async function getUsage(req, res, next) {
  try {
    const usageByModel = await getAiUsageByModel();

    const visibleModels = req.user.role === 'admin'
      ? Object.entries(AI_PROVIDERS)
      : (await modelSettings.listModels({ includeDisabled: false })).map((model) => [
        model.id,
        AI_PROVIDERS[model.id]
      ]);

    return res.json(
      visibleModels.map(([id, provider]) => ({
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
