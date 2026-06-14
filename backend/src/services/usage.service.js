const db = require('../config/db');

function isMissingUsageTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

function isMissingProjectsApiCallsColumnError(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' || error?.errno === 1054;
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
      `SELECT model_used AS model_id, SUM(COALESCE(api_calls, 1)) AS used_today
       FROM projects
       WHERE DATE(created_at) = CURDATE()
         AND model_used IS NOT NULL
       GROUP BY model_used`
    );

    return new Map(
      rows.map((row) => [row.model_id, Number(row.used_today || 0)])
    );
  } catch (error) {
    if (isMissingUsageTableError(error) || isMissingProjectsApiCallsColumnError(error)) {
      return new Map();
    }

    throw error;
  }
}

module.exports = {
  recordAiUsage,
  getAiUsageByModel
};
