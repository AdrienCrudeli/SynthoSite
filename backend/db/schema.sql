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
  is_public      TINYINT(1) NOT NULL DEFAULT 0,
  view_count     INT NOT NULL DEFAULT 0,
  like_count     INT NOT NULL DEFAULT 0,
  style_options  JSON,
  generated_code LONGTEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_projects_user (user_id),
  INDEX idx_projects_type (site_type)
);

CREATE TABLE project_likes (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  visitor_id VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_likes_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_project_likes_visitor (project_id, visitor_id),
  INDEX idx_project_likes_project (project_id)
);

CREATE TABLE project_versions (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id     INT NOT NULL,
  version_number INT NOT NULL,
  label          VARCHAR(120),
  change_summary VARCHAR(500),
  model_used     VARCHAR(50),
  generated_code LONGTEXT NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_versions_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_project_versions_number (project_id, version_number),
  INDEX idx_project_versions_project (project_id),
  INDEX idx_project_versions_created_at (created_at)
);

CREATE TABLE ai_model_settings (
  model_id            VARCHAR(50) PRIMARY KEY,
  enabled             TINYINT(1) NOT NULL DEFAULT 1,
  auto_disabled_until TIMESTAMP NULL,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE image_cache (
  query      VARCHAR(255) PRIMARY KEY,
  urls       JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
