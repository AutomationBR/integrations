jest.mock('../src/useCases/processShipment', () => ({
  processInvoiceData: jest.fn(),
  processXmlFile: jest.fn()
}));

jest.mock('../src/jobs/workerRetry', () => ({
  moveToDeadLetter: jest.fn(),
  scheduleRetry: jest.fn(),
  shouldRetry: jest.fn()
}));

const { processInvoiceData, processXmlFile } = require('../src/useCases/processShipment');
const { moveToDeadLetter, scheduleRetry, shouldRetry } = require('../src/jobs/workerRetry');
const {
  handleException,
  handleFailedResult,
  handleSuccessfulResult,
  runJobByType
} = require('../src/jobs/workerProcessor');

describe('workerProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('runJobByType envia payload para processInvoiceData', async () => {
    processInvoiceData.mockResolvedValue({ success: true });

    await runJobByType({ type: 'payload', data: { invoiceData: { invoiceNumber: 'INV-1' } } });

    expect(processInvoiceData).toHaveBeenCalledWith({ invoiceNumber: 'INV-1' });
  });

  test('runJobByType envia xml para processXmlFile', async () => {
    processXmlFile.mockResolvedValue({ success: true });

    await runJobByType({ type: 'xml', data: { xmlPath: '/tmp/invoice.xml' } });

    expect(processXmlFile).toHaveBeenCalledWith('/tmp/invoice.xml');
  });

  test('handleSuccessfulResult completa job e atualiza worker', async () => {
    const shipments = { update: jest.fn().mockResolvedValue({}) };
    const queue = { complete: jest.fn().mockResolvedValue({}) };
    const workerState = { heartbeat: jest.fn() };
    const result = { success: true, shipmentId: 'SHIP-1' };

    const returned = await handleSuccessfulResult({
      job: { id: 'j1', data: { shipmentRecordId: 's1' } },
      shipments,
      queue,
      workerState,
      result
    });

    expect(returned).toBe(result);
    expect(shipments.update).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'completed' }));
    expect(queue.complete).toHaveBeenCalledWith('j1');
  });

  test('handleFailedResult usa retry quando permitido', async () => {
    shouldRetry.mockReturnValue(true);
    const workerState = { heartbeat: jest.fn() };

    const result = await handleFailedResult({
      job: { id: 'j1', data: { shipmentRecordId: 's1' } },
      shipments: {},
      queue: {},
      workerState,
      dlq: {},
      result: { success: false, error: 'temporary' }
    });

    expect(result.error).toBe('temporary');
    expect(scheduleRetry).toHaveBeenCalled();
    expect(moveToDeadLetter).not.toHaveBeenCalled();
  });

  test('handleException envia para DLQ quando nao pode retry', async () => {
    shouldRetry.mockReturnValue(false);
    const workerState = { heartbeat: jest.fn() };

    await handleException({
      job: { id: 'j1', data: { shipmentRecordId: 's1' } },
      shipments: {},
      queue: {},
      workerState,
      dlq: {},
      error: new Error('fatal')
    });

    expect(moveToDeadLetter).toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
  });
});
