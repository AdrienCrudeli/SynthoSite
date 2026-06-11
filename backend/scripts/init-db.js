const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('../src/config/env');

async function main() {
  const schemaPath = path.resolve(__dirname, '../db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ssl: { rejectUnauthorized }
  });

  await connection.query(schemaSql);
  await connection.end();

  console.log('Database schema initialized successfully.');
}

main().catch((error) => {
  console.error(`Database initialization failed: ${error.message}`);
  process.exit(1);
});
