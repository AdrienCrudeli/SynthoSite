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

  await connection.end();
}

main().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exit(1);
});
