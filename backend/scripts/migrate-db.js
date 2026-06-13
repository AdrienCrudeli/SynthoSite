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

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS ai_model_settings (
      model_id   VARCHAR(50) PRIMARY KEY,
      enabled    TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  console.log('Migration applied: ai_model_settings table ensured.');

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
