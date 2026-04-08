const http = require('http');
const path = require('path');

const { createServer } = require('../src/api/server');
const { ShipmentRepository } = require('../src/repositories/shipmentRepository');
const { JobQueueRepository } = require('../src/repositories/jobQueueRepository');
const { WorkerStateRepository } = require('../src/repositories/workerStateRepository');
const { DeadLetterRepository } = require('../src/repositories/deadLetterRepository');

function request(server, options, body) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const headers = options.headers || {};

    if (body && !headers['Content-Length']) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        ...options,
        headers
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

describe('API server', () => {
  let server;
  let repository;
  let queueRepository;
  let workerStateRepository;
  let deadLetterRepository;

  beforeEach(done => {
    repository = new ShipmentRepository(path.join(__dirname, '../storage/test-shipments.json'));
    queueRepository = new JobQueueRepository(path.join(__dirname, '../storage/test-jobs.json'));
    workerStateRepository = new WorkerStateRepository(path.join(__dirname, '../storage/test-worker-state.json'));
    deadLetterRepository = new DeadLetterRepository(path.join(__dirname, '../storage/test-dead-letters.json'));
    Promise.all([repository.clear(), queueRepository.clear(), deadLetterRepository.clear()]).then(() => {
      workerStateRepository.reset();
      server = createServer(repository, queueRepository, workerStateRepository, deadLetterRepository);
      server.listen(0, done);
    });
  });

  afterEach(done => {
    Promise.all([repository.clear(), queueRepository.clear(), deadLetterRepository.clear()]).then(() => {
      workerStateRepository.reset();
      server.close(done);
    });
  });

  test('retorna healthcheck', async () => {
    const response = await request(server, {
      method: 'GET',
      path: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('valida falta de invoiceData no endpoint payload', async () => {
    const response = await request(
      server,
      {
        method: 'POST',
        path: '/shipments/payload',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      JSON.stringify({})
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('invoiceData is required');
  });

  test('enfileira payload e persiste job na fila', async () => {
    const response = await request(
      server,
      {
        method: 'POST',
        path: '/shipments/payload',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      JSON.stringify({
        invoiceData: {
          invoiceNumber: 'TEST-QUEUE',
          shipper: {
            name: 'Empresa XYZ',
            street: 'Rua Teste',
            number: '123',
            city: 'Sao Paulo',
            state: 'SP',
            postalCode: '01234567',
            countryCode: 'BR',
            phone: '1133334444'
          },
          recipient: {
            name: 'John Smith',
            street: 'Main Street',
            number: '456',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            countryCode: 'US',
            phone: '12125551234'
          },
          items: [
            {
              description: 'Produto A',
              quantity: 1,
              unitPrice: 100,
              totalValue: 100,
              weight: 0.5,
              unit: 'EA',
              hsCode: '84713000'
            }
          ],
          totals: {
            total: 100,
            currency: 'USD'
          },
          isInternational: true
        }
      })
    );

    expect(response.statusCode).toBe(202);
    expect(response.body.status).toBe('queued');
    expect(response.body.queueJob.status).toBe('queued');

    const jobs = await queueRepository.list();
    expect(jobs).toHaveLength(1);
  });

  test('propaga correlation id da requisicao', async () => {
    const response = await request(
      server,
      {
        method: 'POST',
        path: '/shipments/payload',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': 'corr-test-123'
        }
      },
      JSON.stringify({
        invoiceData: {
          invoiceNumber: 'TEST-CORR',
          shipper: {
            name: 'Empresa XYZ',
            street: 'Rua Teste',
            number: '123',
            city: 'Sao Paulo',
            state: 'SP',
            postalCode: '01234567',
            countryCode: 'BR',
            phone: '1133334444'
          },
          recipient: {
            name: 'John Smith',
            street: 'Main Street',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            countryCode: 'US',
            phone: '12125551234'
          },
          items: [
            {
              description: 'Produto A',
              quantity: 1,
              unitPrice: 100,
              totalValue: 100,
              weight: 0.5,
              unit: 'EA',
              hsCode: '84713000'
            }
          ],
          totals: {
            total: 100,
            currency: 'USD'
          },
          isInternational: true
        }
      })
    );

    expect(response.statusCode).toBe(202);
    expect(response.body.correlationId).toBe('corr-test-123');
  });

  test('permite cancelar job enfileirado', async () => {
    const createResponse = await request(
      server,
      {
        method: 'POST',
        path: '/shipments/payload',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      JSON.stringify({
        invoiceData: {
          invoiceNumber: 'TEST-CANCEL',
          shipper: {
            name: 'Empresa XYZ',
            street: 'Rua Teste',
            number: '123',
            city: 'Sao Paulo',
            state: 'SP',
            postalCode: '01234567',
            countryCode: 'BR',
            phone: '1133334444'
          },
          recipient: {
            name: 'John Smith',
            street: 'Main Street',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            countryCode: 'US',
            phone: '12125551234'
          },
          items: [
            {
              description: 'Produto A',
              quantity: 1,
              unitPrice: 100,
              totalValue: 100,
              weight: 0.5,
              unit: 'EA',
              hsCode: '84713000'
            }
          ],
          totals: {
            total: 100,
            currency: 'USD'
          },
          isInternational: true
        }
      })
    );

    expect(createResponse.statusCode).toBe(202);
    expect(createResponse.body.queueJob).toBeDefined();
    
    const jobId = createResponse.body.queueJob.id;
    const cancelResponse = await request(server, {
      method: 'POST',
      path: `/queue/jobs/${jobId}/cancel`
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.body.cancelled).toBe(true);
  });

  test('permite requeue de shipment existente', async () => {
    const created = await repository.create({
      type: 'payload',
      invoiceData: {
        invoiceNumber: 'TEST-REQUEUE'
      },
      correlationId: 'corr-requeue'
    });

    const response = await request(server, {
      method: 'POST',
      path: `/shipments/${created.id}/requeue`
    });

    expect(response.statusCode).toBe(202);
    expect(response.body.requeued).toBe(true);
  });

  test('permite replay de item da dead-letter', async () => {
    const entry = await deadLetterRepository.add({
      correlationId: 'corr-replay',
      payload: {
        shipmentRecordId: 'shipment-1',
        invoiceData: {
          invoiceNumber: 'TEST-REPLAY'
        }
      },
      reason: 'failed before'
    });

    const response = await request(server, {
      method: 'POST',
      path: `/dead-letter/${entry.id}/replay`
    });

    expect(response.statusCode).toBe(202);
    expect(response.body.replayed).toBe(true);
    expect((await deadLetterRepository.list())).toHaveLength(0);
  });

  test('pagina shipments com metadados', async () => {
    await repository.create({ type: 'payload', invoiceNumber: 'PAG-1', correlationId: 'corr-pag-1' });
    await repository.create({ type: 'payload', invoiceNumber: 'PAG-2', correlationId: 'corr-pag-2' });

    const response = await request(server, {
      method: 'GET',
      path: '/shipments?page=1&limit=1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.pagination.total).toBe(2);
    expect(response.body.pagination.limit).toBe(1);
  });

  test('filtra queue jobs por status', async () => {
    await queueRepository.enqueue('payload', {
      shipmentRecordId: 's1',
      invoiceData: {},
      correlationId: 'corr-q-1'
    });
    const queued = await queueRepository.enqueue('payload', {
      shipmentRecordId: 's2',
      invoiceData: {},
      correlationId: 'corr-q-2'
    });
    await queueRepository.cancel(queued.id, 'cancelled for test');

    const response = await request(server, {
      method: 'GET',
      path: '/queue/jobs?status=cancelled'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].status).toBe('cancelled');
  });

  test('filtra dead-letter por correlationId', async () => {
    await deadLetterRepository.add({
      correlationId: 'corr-dlq-1',
      payload: {
        shipmentRecordId: 'ship-1'
      },
      reason: 'a'
    });
    await deadLetterRepository.add({
      correlationId: 'corr-dlq-2',
      payload: {
        shipmentRecordId: 'ship-2'
      },
      reason: 'b'
    });

    const response = await request(server, {
      method: 'GET',
      path: '/dead-letter?correlationId=corr-dlq-2'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].correlationId).toBe('corr-dlq-2');
  });

  test('ordena queue jobs por correlationId asc', async () => {
    await queueRepository.enqueue('payload', {
      shipmentRecordId: 's1',
      invoiceData: {},
      correlationId: 'corr-b'
    });
    await queueRepository.enqueue('payload', {
      shipmentRecordId: 's2',
      invoiceData: {},
      correlationId: 'corr-a'
    });

    const response = await request(server, {
      method: 'GET',
      path: '/queue/jobs?sortBy=correlationId&order=asc'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.items[0].correlationId).toBe('corr-a');
    expect(response.body.items[1].correlationId).toBe('corr-b');
  });

  test('filtra shipments por faixa de data', async () => {
    const first = await repository.create({
      type: 'payload',
      invoiceNumber: 'DATE-1',
      correlationId: 'corr-date-1'
    });
    const second = await repository.create({
      type: 'payload',
      invoiceNumber: 'DATE-2',
      correlationId: 'corr-date-2'
    });

    const response = await request(server, {
      method: 'GET',
      path: `/shipments?createdFrom=${encodeURIComponent(second.createdAt)}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.items.some(item => item.id === second.id)).toBe(true);
    expect(response.body.items.some(item => item.id === first.id)).toBe(false);
  });
});
