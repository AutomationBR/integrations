require('dotenv').config();

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

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const result = await pool.query('select current_database() as database_name, now() as checked_at');
    const row = result.rows[0];

    console.log('Conexao PostgreSQL OK.');
    console.log(`Database: ${row.database_name}`);
    console.log(`Checked at: ${new Date(row.checked_at).toISOString()}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Falha ao verificar PostgreSQL:', error.message);
  process.exit(1);
});
