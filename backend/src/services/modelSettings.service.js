const db = require('../config/db');
const { AI_PROVIDERS, FALLBACK_ORDER } = require('../config/aiProviders');

function isMissingSettingsTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

async function getSettingsMap() {
  try {
    const rows = await db.query('SELECT model_id, enabled FROM ai_model_settings');
    return new Map(rows.map((row) => [row.model_id, Boolean(row.enabled)]));
  } catch (error) {
    if (isMissingSettingsTableError(error)) {
      return new Map();
    }

    throw error;
  }
}

function serializeModel(id, provider, settings) {
  return {
    id,
    label: provider.label,
    enabled: settings.has(id) ? settings.get(id) : true,
    limit: provider.dailyLimit
  };
}

async function listModels({ includeDisabled = false } = {}) {
  const settings = await getSettingsMap();

  return Object.entries(AI_PROVIDERS)
    .map(([id, provider]) => serializeModel(id, provider, settings))
    .filter((model) => includeDisabled || model.enabled);
}

async function getEnabledModelIds() {
  const models = await listModels();
  const enabledSet = new Set(models.map((model) => model.id));

  return FALLBACK_ORDER.filter((id) => enabledSet.has(id));
}

async function isModelEnabled(modelId) {
  if (!AI_PROVIDERS[modelId]) {
    return false;
  }

  const settings = await getSettingsMap();
  return settings.has(modelId) ? settings.get(modelId) : true;
}

async function setModelEnabled(modelId, enabled) {
  await db.query(
    `INSERT INTO ai_model_settings (model_id, enabled)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = CURRENT_TIMESTAMP`,
    [modelId, enabled ? 1 : 0]
  );

  const settings = await getSettingsMap();
  return serializeModel(modelId, AI_PROVIDERS[modelId], settings);
}

module.exports = {
  listModels,
  getEnabledModelIds,
  isModelEnabled,
  setModelEnabled
};
