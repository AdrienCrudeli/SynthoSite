CREATE TABLE IF NOT EXISTS ai_model_settings (
  model_id   VARCHAR(50) PRIMARY KEY,
  enabled    TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pexels_usage (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  query       VARCHAR(255) NOT NULL,
  status_code INT NOT NULL DEFAULT 0,
  matched     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pexels_usage_created_at (created_at),
  INDEX idx_pexels_usage_query (query)
);
