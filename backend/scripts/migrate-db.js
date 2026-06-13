const mysql = require('mysql2/promise');
require('../src/config/env');

async function main() {
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized }
  });

  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'model_used'`,
    [process.env.DB_NAME]
  );

  if (columns.length === 0) {
    await connection.execute('ALTER TABLE projects ADD COLUMN model_used VARCHAR(50) AFTER prompt');
    console.log('Migration applied: projects.model_used added.');
  } else {
    console.log('Migration skipped: projects.model_used already exists.');
  }

  const [visibilityColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'is_public'`,
    [process.env.DB_NAME]
  );

  if (visibilityColumns.length === 0) {
    await connection.execute('ALTER TABLE projects ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER model_used');
    console.log('Migration applied: projects.is_public added.');
  } else {
    console.log('Migration skipped: projects.is_public already exists.');
  }

  const [viewCountColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'view_count'`,
    [process.env.DB_NAME]
  );

  if (viewCountColumns.length === 0) {
    await connection.execute('ALTER TABLE projects ADD COLUMN view_count INT NOT NULL DEFAULT 0 AFTER is_public');
    console.log('Migration applied: projects.view_count added.');
  } else {
    console.log('Migration skipped: projects.view_count already exists.');
  }

  const [likeCountColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'like_count'`,
    [process.env.DB_NAME]
  );

  if (likeCountColumns.length === 0) {
    await connection.execute('ALTER TABLE projects ADD COLUMN like_count INT NOT NULL DEFAULT 0 AFTER view_count');
    console.log('Migration applied: projects.like_count added.');
  } else {
    console.log('Migration skipped: projects.like_count already exists.');
  }

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS project_likes (
      id         BIGINT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      visitor_id VARCHAR(80) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_project_likes_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE KEY uq_project_likes_visitor (project_id, visitor_id),
      INDEX idx_project_likes_project (project_id)
    )`
  );
  console.log('Migration applied: project_likes table ensured.');

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS project_versions (
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
    )`
  );
  console.log('Migration applied: project_versions table ensured.');

  await connection.execute(
    `INSERT INTO project_versions
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
       )`
  );
  console.log('Migration applied: existing project versions backfilled.');

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS ai_model_settings (
      model_id            VARCHAR(50) PRIMARY KEY,
      enabled             TINYINT(1) NOT NULL DEFAULT 1,
      auto_disabled_until TIMESTAMP NULL,
      updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  console.log('Migration applied: ai_model_settings table ensured.');

  const [autoDisabledColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ai_model_settings' AND COLUMN_NAME = 'auto_disabled_until'`,
    [process.env.DB_NAME]
  );

  if (autoDisabledColumns.length === 0) {
    await connection.execute('ALTER TABLE ai_model_settings ADD COLUMN auto_disabled_until TIMESTAMP NULL AFTER enabled');
    console.log('Migration applied: ai_model_settings.auto_disabled_until added.');
  } else {
    console.log('Migration skipped: ai_model_settings.auto_disabled_until already exists.');
  }

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS image_cache (
      query      VARCHAR(255) PRIMARY KEY,
      urls       JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  console.log('Migration applied: image_cache table ensured.');

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS ai_usage (
      id           BIGINT AUTO_INCREMENT PRIMARY KEY,
      model_id     VARCHAR(50) NOT NULL,
      request_type ENUM('generation','revision') NOT NULL DEFAULT 'generation',
      created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ai_usage_created_at (created_at),
      INDEX idx_ai_usage_model (model_id)
    )`
  );
  console.log('Migration applied: ai_usage table ensured.');

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS pexels_usage (
      id          BIGINT AUTO_INCREMENT PRIMARY KEY,
      query       VARCHAR(255) NOT NULL,
      status_code INT NOT NULL DEFAULT 0,
      matched     TINYINT(1) NOT NULL DEFAULT 0,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pexels_usage_created_at (created_at),
      INDEX idx_pexels_usage_query (query)
    )`
  );
  console.log('Migration applied: pexels_usage table ensured.');

  await connection.end();
}

main().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exit(1);
});
