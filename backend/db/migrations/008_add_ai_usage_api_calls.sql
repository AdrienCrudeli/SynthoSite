ALTER TABLE ai_usage ADD COLUMN api_calls INT NOT NULL DEFAULT 1 AFTER request_type;
