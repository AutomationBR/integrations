const http = require('http');
const path = require('path');

const { createServer } = require('../src/api/server');
const { ShipmentRepository } = require('../src/repositories/shipmentRepository');
const { JobQueueRepository } = require('../src/repositories/jobQueueRepository');
const { WorkerStateRepository } = require('../src/repositories/workerStateRepository');

function request(server, options) {
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
            body: data && data.trim() ? JSON.parse(data) : null
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

describe('ops status endpoint', () => {
  let server;
  let shipmentRepository;
  let jobQueueRepository;
  let workerStateRepository;

  beforeEach(done => {
    shipmentRepository = new ShipmentRepository(path.join(__dirname, '../storage/test-shipments.json'));
    jobQueueRepository = new JobQueueRepository(path.join(__dirname, '../storage/test-jobs.json'));
    workerStateRepository = new WorkerStateRepository(path.join(__dirname, '../storage/test-worker-state.json'));

    Promise.all([shipmentRepository.clear(), jobQueueRepository.clear(), workerStateRepository.reset()]).then(() => {
      server = createServer(shipmentRepository, jobQueueRepository, workerStateRepository);
      server.listen(0, done);
    });
  });

  afterEach(done => {
    server.close(() => {
      Promise.all([shipmentRepository.clear(), jobQueueRepository.clear(), workerStateRepository.reset()]).then(() => {
        done();
      });
    });
  });

  test('retorna contadores operacionais', async () => {
    const created = await shipmentRepository.create({ type: 'payload', invoiceNumber: 'OPS-1' });
    await shipmentRepository.update(created.id, { status: 'queued' });
    await jobQueueRepository.enqueue('payload', { shipmentRecordId: created.id, invoiceData: {} });
    await workerStateRepository.markStarted({ pollMs: 1000 });

    // Add a small delay to ensure data is persisted before querying
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await request(server, {
      method: 'GET',
      path: '/ops/status',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.shipments.total).toBe(1);
    expect(response.body.queue.total).toBe(1);
    expect(response.body.worker.status).toBeDefined();
  });
});
