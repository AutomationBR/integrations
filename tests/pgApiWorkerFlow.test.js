jest.mock('../src/useCases/processShipment', () => ({
  processInvoiceData: jest.fn(),
  processXmlFile: jest.fn()
}));

const http = require('http');
const path = require('path');

const { processInvoiceData } = require('../src/useCases/processShipment');

const shouldRunIntegration = process.env.PG_INTEGRATION === '1' && !!process.env.DATABASE_URL;
const describePg = shouldRunIntegration ? describe : describe.skip;

function request(server, options, body) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        ...options
      },
      res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function waitFor(predicate, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await predicate();
    if (result) {
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

describePg('PostgreSQL API + worker flow', () => {
  let Pool;
  let pool;
  let PgShipmentRepository;
  let PgJobQueueRepository;
  let WorkerStateRepository;
  let DeadLetterRepository;
  let createServer;
  let startWorker;
  let server;
  let worker;
  let shipmentRepository;
  let jobQueueRepository;
  let workerStateRepository;
  let deadLetterRepository;

  beforeAll(async () => {
    ({ Pool } = require('pg'));
    ({ PgShipmentRepository } = require('../src/repositories/pgShipmentRepository'));
    ({ PgJobQueueRepository } = require('../src/repositories/pgJobQueueRepository'));
    ({ WorkerStateRepository } = require('../src/repositories/workerStateRepository'));
    ({ DeadLetterRepository } = require('../src/repositories/deadLetterRepository'));
    ({ createServer } = require('../src/api/server'));
    ({ startWorker } = require('../src/jobs/shipmentWorker'));

    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  });

  beforeEach(async () => {
    processInvoiceData.mockReset();
    processInvoiceData.mockResolvedValue({
      success: true,
      invoiceNumber: 'PG-FLOW-1',
      shipmentId: 'SHIP-FLOW-1',
      trackingNumber: 'TRACK-FLOW-1'
    });

    await pool.query('delete from shipment_jobs');
    await pool.query('delete from shipments');

    shipmentRepository = new PgShipmentRepository(pool);
    jobQueueRepository = new PgJobQueueRepository(pool);
    workerStateRepository = new WorkerStateRepository(path.join(__dirname, '../storage/test-worker-state-pg-flow.json'));
    deadLetterRepository = new DeadLetterRepository(path.join(__dirname, '../storage/test-dead-letters-pg-flow.json'));
    workerStateRepository.reset();
    await deadLetterRepository.clear();

    server = createServer(shipmentRepository, jobQueueRepository, workerStateRepository, deadLetterRepository);
    await new Promise(resolve => server.listen(0, resolve));

    worker = startWorker({
      pollMs: 50,
      repositories: {
        shipmentRepository,
        jobQueueRepository,
        workerStateRepository,
        deadLetterRepository
      }
    });
  });

  afterEach(async () => {
    if (worker) {
      worker.stop();
      worker = null;
    }

    if (server) {
      await new Promise(resolve => server.close(resolve));
      server = null;
    }

    if (deadLetterRepository) {
      await deadLetterRepository.clear();
    }

    if (workerStateRepository) {
      workerStateRepository.reset();
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  test('processa um shipment enfileirado ate completed', async () => {
    const response = await request(
      server,
      {
        method: 'POST',
        path: '/shipments/payload',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': 'corr-pg-flow-1'
        }
      },
      JSON.stringify({
        invoiceData: {
          invoiceNumber: 'PG-FLOW-1'
        }
      })
    );

    expect(response.statusCode).toBe(202);
    expect(response.body.status).toBe('queued');

    const completedShipment = await waitFor(async () => {
      const shipment = await shipmentRepository.get(response.body.id);
      return shipment?.status === 'completed' ? shipment : null;
    });

    const jobs = await jobQueueRepository.list();

    expect(completedShipment.result.shipmentId).toBe('SHIP-FLOW-1');
    expect(completedShipment.result.trackingNumber).toBe('TRACK-FLOW-1');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('completed');
    expect(processInvoiceData).toHaveBeenCalledWith(expect.objectContaining({
      invoiceNumber: 'PG-FLOW-1'
    }));
  });
});
