const fs = require('fs');
const path = require('path');

const shouldRunIntegration = process.env.PG_INTEGRATION === '1' && !!process.env.DATABASE_URL;

const describePg = shouldRunIntegration ? describe : describe.skip;

describePg('PostgreSQL integration', () => {
  let Pool;
  let pool;
  let PgShipmentRepository;
  let PgJobQueueRepository;
  let createRepositories;
  let previousDatabaseUrl;

  beforeAll(async () => {
    ({ Pool } = require('pg'));
    ({ PgShipmentRepository } = require('../src/repositories/pgShipmentRepository'));
    ({ PgJobQueueRepository } = require('../src/repositories/pgJobQueueRepository'));
    ({ createRepositories } = require('../src/repositories/repositoryFactory'));

    previousDatabaseUrl = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    const schemaSql = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf-8');
    await pool.query(schemaSql);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  beforeEach(async () => {
    await pool.query('delete from shipment_jobs');
    await pool.query('delete from shipments');
  });

  test('PgShipmentRepository cria, atualiza e lista shipments', async () => {
    const repository = new PgShipmentRepository(pool);

    const created = await repository.create({
      type: 'payload',
      invoiceNumber: 'PG-INV-1',
      correlationId: 'corr-pg-1'
    });
    const updated = await repository.update(created.id, {
      status: 'completed',
      result: { shipmentId: 'SHIP-PG-1' }
    });
    const loaded = await repository.get(created.id);
    const items = await repository.list();

    expect(created.status).toBe('pending');
    expect(updated.status).toBe('completed');
    expect(loaded.result.shipmentId).toBe('SHIP-PG-1');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(created.id);
  });

  test('PgJobQueueRepository percorre fluxo de fila com retry e complete', async () => {
    const repository = new PgJobQueueRepository(pool);

    const created = await repository.enqueue('payload', {
      shipmentRecordId: 'shipment-pg-1',
      invoiceData: { invoiceNumber: 'PG-INV-2' },
      correlationId: 'corr-pg-2'
    });
    const claimed = await repository.claimNext();

    expect(claimed.id).toBe(created.id);
    expect(claimed.status).toBe('processing');
    expect(claimed.attempts).toBe(1);

    const rescheduled = await repository.reschedule(claimed.id, 'temporary issue', new Date(Date.now() - 1000).toISOString());
    expect(rescheduled.status).toBe('retry_scheduled');

    const reclaimed = await repository.claimNext();
    expect(reclaimed.id).toBe(created.id);
    expect(reclaimed.attempts).toBe(2);

    const completed = await repository.complete(reclaimed.id);
    expect(completed.status).toBe('completed');
    expect(completed.finishedAt).toBeTruthy();
  });

  test('repositoryFactory entra em modo postgres quando DATABASE_URL esta configurada', async () => {
    const repositories = createRepositories();
    const created = await repositories.shipmentRepository.create({
      type: 'payload',
      invoiceNumber: 'PG-FACTORY-1'
    });
    const items = await repositories.shipmentRepository.list();

    expect(repositories.mode).toBe('postgres');
    expect(created.id).toBeTruthy();
    expect(items.some(item => item.id === created.id)).toBe(true);
  });
});
