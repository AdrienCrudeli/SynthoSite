ALTER TABLE projects ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER model_used;

CREATE TABLE IF NOT EXISTS project_versions (
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

INSERT INTO project_versions
  (project_id, version_number, label, change_summary, model_used, generated_code)
SELECT
  p.id,
  1,
  'Current version',
  'Backfilled from existing generated HTML.',
  p.model_used,
  p.generated_code
FROM projects p
WHERE p.generated_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM project_versions v
    WHERE v.project_id = p.id
  );
