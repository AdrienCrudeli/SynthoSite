CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  title          VARCHAR(150) NOT NULL,
  description    VARCHAR(500),
  site_type      VARCHAR(50),
  prompt         TEXT NOT NULL,
  model_used     VARCHAR(50),
  style_options  JSON,
  generated_code LONGTEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_projects_user (user_id),
  INDEX idx_projects_type (site_type)
);

CREATE TABLE ai_model_settings (
  model_id   VARCHAR(50) PRIMARY KEY,
  enabled    TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE ai_usage (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  model_id     VARCHAR(50) NOT NULL,
  request_type ENUM('generation','revision') NOT NULL DEFAULT 'generation',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_created_at (created_at),
  INDEX idx_ai_usage_model (model_id)
);

CREATE TABLE pexels_usage (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  query       VARCHAR(255) NOT NULL,
  status_code INT NOT NULL DEFAULT 0,
  matched     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pexels_usage_created_at (created_at),
  INDEX idx_pexels_usage_query (query)
);
