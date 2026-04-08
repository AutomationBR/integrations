const logger = require('../utils/logger');
const shipmentRepository = require('./shipmentRepository');
const jobQueueRepository = require('./jobQueueRepository');
const { PgShipmentRepository } = require('./pgShipmentRepository');
const { PgJobQueueRepository } = require('./pgJobQueueRepository');

function createRepositories() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      mode: 'file',
      shipmentRepository,
      jobQueueRepository
    };
  }

  try {
    const { createPgPool } = require('../db/createPgPool');
    const pool = createPgPool(databaseUrl);

    return {
      mode: 'postgres',
      shipmentRepository: new PgShipmentRepository(pool),
      jobQueueRepository: new PgJobQueueRepository(pool)
    };
  } catch (error) {
    logger.warn('Falha ao iniciar PostgreSQL, usando armazenamento em arquivo', error.message);
    return {
      mode: 'file',
      shipmentRepository,
      jobQueueRepository
    };
  }
}

module.exports = { createRepositories };
