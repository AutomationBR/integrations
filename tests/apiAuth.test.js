const http = require('http');
const path = require('path');

const { ShipmentRepository } = require('../src/repositories/shipmentRepository');
const { JobQueueRepository } = require('../src/repositories/jobQueueRepository');
const { WorkerStateRepository } = require('../src/repositories/workerStateRepository');
const { DeadLetterRepository } = require('../src/repositories/deadLetterRepository');

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
            body: data ? JSON.parse(data) : null
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

describe('API auth for ops routes', () => {
  const previousOpsToken = process.env.OPS_API_TOKEN;
  const shipmentsFilePath = path.join(__dirname, '../storage/test-api-auth-shipments.json');
  const jobsFilePath = path.join(__dirname, '../storage/test-api-auth-jobs.json');
  const workerStateFilePath = path.join(__dirname, '../storage/test-api-auth-worker-state.json');
  const deadLettersFilePath = path.join(__dirname, '../storage/test-api-auth-dead-letters.json');
  let server;
  let repository;
  let queueRepository;
  let workerStateRepository;
  let deadLetterRepository;

  beforeEach(done => {
    process.env.OPS_API_TOKEN = 'secret-token';
    jest.resetModules();

    const { createServer } = require('../src/api/server');
    repository = new ShipmentRepository(shipmentsFilePath);
    queueRepository = new JobQueueRepository(jobsFilePath);
    workerStateRepository = new WorkerStateRepository(workerStateFilePath);
    deadLetterRepository = new DeadLetterRepository(deadLettersFilePath);

    Promise.all([repository.clear(), queueRepository.clear(), deadLetterRepository.clear()]).then(() => {
      workerStateRepository.reset();
      server = createServer(repository, queueRepository, workerStateRepository, deadLetterRepository);
      server.listen(0, done);
    });
  });

  afterEach(done => {
    if (previousOpsToken === undefined) {
      delete process.env.OPS_API_TOKEN;
    } else {
      process.env.OPS_API_TOKEN = previousOpsToken;
    }

    Promise.all([repository.clear(), queueRepository.clear(), deadLetterRepository.clear()]).then(() => {
      workerStateRepository.reset();
      server.close(done);
    });
  });

  test('bloqueia ops/status sem token', async () => {
    const response = await request(server, {
      method: 'GET',
      path: '/ops/status'
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  test('permite ops/status com bearer token valido', async () => {
    const response = await request(server, {
      method: 'GET',
      path: '/ops/status',
      headers: {
        Authorization: 'Bearer secret-token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.service).toBe('xml_converter_api');
  });
});
