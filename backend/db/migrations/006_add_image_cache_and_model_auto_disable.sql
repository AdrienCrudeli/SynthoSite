ALTER TABLE ai_model_settings ADD COLUMN auto_disabled_until TIMESTAMP NULL AFTER enabled;

CREATE TABLE IF NOT EXISTS image_cache (
  query      VARCHAR(255) PRIMARY KEY,
  urls       JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
