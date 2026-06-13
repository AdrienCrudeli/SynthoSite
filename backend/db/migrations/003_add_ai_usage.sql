CREATE TABLE IF NOT EXISTS ai_usage (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  model_id     VARCHAR(50) NOT NULL,
  request_type ENUM('generation','revision') NOT NULL DEFAULT 'generation',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_created_at (created_at),
  INDEX idx_ai_usage_model (model_id)
);
