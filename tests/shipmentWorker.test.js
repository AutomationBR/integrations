const path = require('path');

jest.mock('../src/useCases/processShipment', () => ({
  processInvoiceData: jest.fn(),
  processXmlFile: jest.fn()
}));

const { ShipmentRepository } = require('../src/repositories/shipmentRepository');
const { JobQueueRepository } = require('../src/repositories/jobQueueRepository');
const { DeadLetterRepository } = require('../src/repositories/deadLetterRepository');
const { drainQueueOnce } = require('../src/jobs/shipmentWorker');
const { processInvoiceData } = require('../src/useCases/processShipment');

describe('shipmentWorker', () => {
  let shipmentRepository;
  let jobQueueRepository;
  let deadLetterRepository;

  beforeEach(async () => {
    shipmentRepository = new ShipmentRepository(path.join(__dirname, '../storage/test-shipments.json'));
    jobQueueRepository = new JobQueueRepository(path.join(__dirname, '../storage/test-jobs.json'));
    deadLetterRepository = new DeadLetterRepository(path.join(__dirname, '../storage/test-dead-letters.json'));
    await shipmentRepository.clear();
    await jobQueueRepository.clear();
    await deadLetterRepository.clear();
    processInvoiceData.mockReset();
  });

  afterEach(async () => {
    await shipmentRepository.clear();
    await jobQueueRepository.clear();
    await deadLetterRepository.clear();
  });

  test('consome um job e atualiza shipment para completed', async () => {
    const shipment = await shipmentRepository.create({ type: 'payload', invoiceNumber: 'TEST-WORKER' });
    await shipmentRepository.update(shipment.id, { status: 'queued' });
    await jobQueueRepository.enqueue('payload', {
      shipmentRecordId: shipment.id,
      invoiceData: { invoiceNumber: 'TEST-WORKER' }
    });

    processInvoiceData.mockResolvedValue({
      success: true,
      invoiceNumber: 'TEST-WORKER',
      shipmentId: 'SHIP-1',
      trackingNumber: 'TRACK-1'
    });

    const claimed = await drainQueueOnce({ shipmentRepository, jobQueueRepository, deadLetterRepository });
    const loadedShipment = await shipmentRepository.get(shipment.id);
    const loadedJob = await jobQueueRepository.get(claimed.id);

    expect(claimed).not.toBeNull();
    expect(loadedShipment.status).toBe('completed');
    expect(loadedShipment.result.shipmentId).toBe('SHIP-1');
    expect(loadedJob.status).toBe('completed');
  });

  test('reagenda job para retry quando processamento falha', async () => {
    const shipment = await shipmentRepository.create({ type: 'payload', invoiceNumber: 'TEST-RETRY' });
    await shipmentRepository.update(shipment.id, { status: 'queued' });
    await jobQueueRepository.enqueue('payload', {
      shipmentRecordId: shipment.id,
      invoiceData: { invoiceNumber: 'TEST-RETRY' }
    });

    processInvoiceData.mockResolvedValue({
      success: false,
      error: 'temporary issue'
    });

    const claimed = await drainQueueOnce({ shipmentRepository, jobQueueRepository, deadLetterRepository });
    const loadedShipment = await shipmentRepository.get(shipment.id);
    const loadedJob = await jobQueueRepository.get(claimed.id);

    expect(loadedShipment.status).toBe('retry_scheduled');
    expect(loadedJob.status).toBe('retry_scheduled');
    expect(loadedJob.nextRunAt).toBeTruthy();
  });

  test('envia para dead-letter quando excede tentativas', async () => {
    const shipment = await shipmentRepository.create({ type: 'payload', invoiceNumber: 'TEST-DLQ' });
    await shipmentRepository.update(shipment.id, { status: 'queued' });
    await jobQueueRepository.enqueue('payload', {
      shipmentRecordId: shipment.id,
      invoiceData: { invoiceNumber: 'TEST-DLQ' },
      correlationId: 'corr-dlq'
    }, { maxAttempts: 1 });

    processInvoiceData.mockResolvedValue({
      success: false,
      error: 'permanent issue'
    });

    const claimed = await drainQueueOnce({ shipmentRepository, jobQueueRepository, deadLetterRepository });
    const loadedJob = await jobQueueRepository.get(claimed.id);
    const deadLetters = await deadLetterRepository.list();

    expect(loadedJob.status).toBe('failed');
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0].correlationId).toBe('corr-dlq');
  });
});
