let cachedPool = null;

function createPgPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (cachedPool) {
    return cachedPool;
  }

  const { Pool } = require('pg');
  cachedPool = new Pool({
    connectionString
  });

  return cachedPool;
}

module.exports = { createPgPool };
