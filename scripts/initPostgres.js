require('dotenv').config();

const fs = require('fs');
const path = require('path');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL nao configurada no ambiente');
  }

  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch (error) {
    throw new Error('Pacote "pg" nao instalado. Rode: npm install pg');
  }

  const schemaPath = path.join(__dirname, '../sql/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await pool.query(schemaSql);
    console.log('Schema PostgreSQL aplicado com sucesso.');
    console.log(`Arquivo executado: ${schemaPath}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Falha ao inicializar PostgreSQL:', error.message);
  process.exit(1);
});
