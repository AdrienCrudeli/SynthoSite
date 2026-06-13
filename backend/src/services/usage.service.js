const db = require('../config/db');

function isMissingUsageTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

async function recordAiUsage(modelId, requestType = 'generation') {
  if (!modelId) {
    return;
  }

  try {
    await db.query(
      'INSERT INTO ai_usage (model_id, request_type) VALUES (?, ?)',
      [modelId, requestType]
    );
  } catch (error) {
    // Site generation should not fail if the internal usage counter is unavailable.
  }
}

async function getAiUsageByModel() {
  try {
    const rows = await db.query(
      `SELECT model_id, COUNT(*) AS used_today
       FROM ai_usage
       WHERE DATE(created_at) = CURDATE()
       GROUP BY model_id`
    );

    return new Map(
      rows.map((row) => [row.model_id, Number(row.used_today || 0)])
    );
  } catch (error) {
    if (isMissingUsageTableError(error)) {
      return new Map();
    }

    throw error;
  }
}

module.exports = {
  recordAiUsage,
  getAiUsageByModel
};
