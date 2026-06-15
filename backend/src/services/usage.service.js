const db = require('../config/db');

function isMissingUsageTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

function isMissingUsageApiCallsColumnError(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' || error?.errno === 1054;
}

async function recordAiUsage(modelId, requestType = 'generation', apiCalls = 1) {
  if (!modelId) {
    return;
  }

  const safeApiCalls = Math.max(1, Number(apiCalls) || 1);

  try {
    await db.query(
      'INSERT INTO ai_usage (model_id, request_type, api_calls) VALUES (?, ?, ?)',
      [modelId, requestType, safeApiCalls]
    );
  } catch (error) {
    if (isMissingUsageApiCallsColumnError(error)) {
      try {
        await db.query(
          'INSERT INTO ai_usage (model_id, request_type) VALUES (?, ?)',
          [modelId, requestType]
        );
      } catch (legacyError) {
        // Site generation should not fail if the internal usage counter is unavailable.
      }
      return;
    }

    // Site generation should not fail if the internal usage counter is unavailable.
  }
}

async function getAiUsageByModel() {
  try {
    const rows = await db.query(
      `SELECT model_id, SUM(COALESCE(api_calls, 1)) AS used_today
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

    if (isMissingUsageApiCallsColumnError(error)) {
      const rows = await db.query(
        `SELECT model_id, COUNT(*) AS used_today
         FROM ai_usage
         WHERE DATE(created_at) = CURDATE()
         GROUP BY model_id`
      );

      return new Map(
        rows.map((row) => [row.model_id, Number(row.used_today || 0)])
      );
    }

    throw error;
  }
}

module.exports = {
  recordAiUsage,
  getAiUsageByModel
};
