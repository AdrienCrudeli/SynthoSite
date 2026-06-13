ALTER TABLE projects ADD COLUMN view_count INT NOT NULL DEFAULT 0 AFTER is_public;
ALTER TABLE projects ADD COLUMN like_count INT NOT NULL DEFAULT 0 AFTER view_count;

CREATE TABLE IF NOT EXISTS project_likes (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  visitor_id VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_likes_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_project_likes_visitor (project_id, visitor_id),
  INDEX idx_project_likes_project (project_id)
);
