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
            body: data
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

describe('metrics endpoint', () => {
  let server;
  let shipmentRepository;
  let jobQueueRepository;
  let workerStateRepository;

  beforeEach(done => {
    shipmentRepository = new ShipmentRepository(path.join(__dirname, '../storage/test-shipments.json'));
    jobQueueRepository = new JobQueueRepository(path.join(__dirname, '../storage/test-jobs.json'));
    workerStateRepository = new WorkerStateRepository(path.join(__dirname, '../storage/test-worker-state.json'));

    Promise.all([shipmentRepository.clear(), jobQueueRepository.clear()]).then(async () => {
      workerStateRepository.reset();
      const created = await shipmentRepository.create({ type: 'payload', invoiceNumber: 'METRICS-1' });
      await shipmentRepository.update(created.id, { status: 'queued' });
      await jobQueueRepository.enqueue('payload', { shipmentRecordId: created.id, invoiceData: {} });
      workerStateRepository.markStarted({ pollMs: 1000 });
      server = createServer(shipmentRepository, jobQueueRepository, workerStateRepository);
      server.listen(0, done);
    });
  });

  afterEach(done => {
    Promise.all([shipmentRepository.clear(), jobQueueRepository.clear()]).then(() => {
      workerStateRepository.reset();
      server.close(done);
    });
  });

  test('expoe metricas em formato Prometheus', async () => {
    const response = await request(server, {
      method: 'GET',
      path: '/metrics'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('xml_converter_shipments_total');
    expect(response.body).toContain('xml_converter_queue_jobs_total');
    expect(response.body).toContain('xml_converter_worker_up');
  });
});
