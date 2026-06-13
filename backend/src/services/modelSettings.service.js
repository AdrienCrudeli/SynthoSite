const db = require('../config/db');
const { AI_PROVIDERS, FALLBACK_ORDER } = require('../config/aiProviders');

function isMissingSettingsTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

function isMissingAutoDisabledColumnError(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' || error?.errno === 1054;
}

async function getSettingsMap() {
  try {
    const rows = await db.query('SELECT model_id, enabled, auto_disabled_until FROM ai_model_settings');
    return new Map(rows.map((row) => [row.model_id, {
      enabled: Boolean(row.enabled),
      autoDisabledUntil: row.auto_disabled_until || null
    }]));
  } catch (error) {
    if (isMissingSettingsTableError(error)) {
      return new Map();
    }

    if (isMissingAutoDisabledColumnError(error)) {
      const rows = await db.query('SELECT model_id, enabled FROM ai_model_settings');
      return new Map(rows.map((row) => [row.model_id, {
        enabled: Boolean(row.enabled),
        autoDisabledUntil: null
      }]));
    }

    throw error;
  }
}

function isAutoDisabled(autoDisabledUntil) {
  return Boolean(autoDisabledUntil && new Date(autoDisabledUntil).getTime() > Date.now());
}

function serializeModel(id, provider, settings) {
  const setting = settings.get(id);
  const enabled = setting ? setting.enabled : true;
  const autoDisabledUntil = setting?.autoDisabledUntil || null;
  const saturated = isAutoDisabled(autoDisabledUntil);
  const available = enabled && !saturated;

  return {
    id,
    label: provider.label,
    enabled,
    available,
    status: !enabled ? 'disabled' : saturated ? 'saturated' : 'available',
    autoDisabledUntil: saturated ? autoDisabledUntil : null,
    supportsMultiPage: Boolean(provider.supportsMultiPage),
    limit: provider.dailyLimit
  };
}

async function listModels({ includeDisabled = false } = {}) {
  const settings = await getSettingsMap();

  return Object.entries(AI_PROVIDERS)
    .map(([id, provider]) => serializeModel(id, provider, settings))
    .filter((model) => includeDisabled || model.available);
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
  const model = serializeModel(modelId, AI_PROVIDERS[modelId], settings);
  return model.enabled;
}

async function isModelAvailable(modelId) {
  if (!AI_PROVIDERS[modelId]) {
    return false;
  }

  const settings = await getSettingsMap();
  const model = serializeModel(modelId, AI_PROVIDERS[modelId], settings);
  return model.available;
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

async function autoDisableModel(modelId) {
  if (!AI_PROVIDERS[modelId]) {
    return null;
  }

  await db.query(
    `INSERT INTO ai_model_settings (model_id, enabled, auto_disabled_until)
     VALUES (?, 1, DATE_ADD(NOW(), INTERVAL 24 HOUR))
     ON DUPLICATE KEY UPDATE
       auto_disabled_until = CASE
         WHEN enabled = 1 THEN DATE_ADD(NOW(), INTERVAL 24 HOUR)
         ELSE auto_disabled_until
       END,
       updated_at = CURRENT_TIMESTAMP`,
    [modelId]
  );

  const settings = await getSettingsMap();
  return serializeModel(modelId, AI_PROVIDERS[modelId], settings);
}

module.exports = {
  listModels,
  getEnabledModelIds,
  isModelEnabled,
  isModelAvailable,
  setModelEnabled,
  autoDisableModel
};
