const modelSettings = require('../services/modelSettings.service');
const { getAiUsageByModel } = require('../services/usage.service');

async function listModels(req, res, next) {
  try {
    const models = await modelSettings.listModels({ includeDisabled: true });

    return res.json(
      models.map((model) => ({
        id: model.id,
        label: model.label,
        enabled: model.enabled,
        available: model.available,
        status: model.status,
        autoDisabledUntil: model.autoDisabledUntil,
        supportsMultiPage: model.supportsMultiPage
      }))
    );
  } catch (error) {
    return next(error);
  }
}

async function getUsage(req, res, next) {
  try {
    const [usageByModel, models] = await Promise.all([
      getAiUsageByModel(),
      modelSettings.listModels({ includeDisabled: true })
    ]);

    return res.json(
      models.map((model) => ({
        id: model.id,
        label: model.label,
        used: usageByModel.get(model.id) || 0,
        limit: model.limit,
        enabled: model.enabled,
        available: model.available,
        status: model.status,
        autoDisabledUntil: model.autoDisabledUntil
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
