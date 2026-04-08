jest.mock('../src/utils/logger', () => ({
  warn: jest.fn()
}));

const logger = require('../src/utils/logger');
const { computeBackoffMs, moveToDeadLetter, scheduleRetry, shouldRetry } = require('../src/jobs/workerRetry');

describe('workerRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('computeBackoffMs aplica base configurada e minimo 1', () => {
    expect(computeBackoffMs(0)).toBeGreaterThan(0);
    expect(computeBackoffMs(2)).toBe(computeBackoffMs(1) * 2);
  });

  test('shouldRetry respeita maxAttempts do job', () => {
    expect(shouldRetry({ attempts: 1, maxAttempts: 3 })).toBe(true);
    expect(shouldRetry({ attempts: 3, maxAttempts: 3 })).toBe(false);
  });

  test('scheduleRetry reagenda job e atualiza shipment', async () => {
    const shipments = { update: jest.fn().mockResolvedValue({}) };
    const queue = { reschedule: jest.fn().mockResolvedValue({}) };

    await scheduleRetry({
      job: { id: 'j1', attempts: 1, correlationId: 'corr-1', data: { shipmentRecordId: 's1' } },
      shipments,
      queue,
      errorMessage: 'temporary',
      result: { success: false, error: 'temporary' },
      warningMessage: 'retrying'
    });

    expect(queue.reschedule).toHaveBeenCalledWith('j1', 'temporary', expect.any(String));
    expect(shipments.update).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'retry_scheduled' }));
    expect(logger.warn).toHaveBeenCalledWith('retrying', expect.objectContaining({ jobId: 'j1' }));
  });

  test('moveToDeadLetter falha job e grava entrada na DLQ', async () => {
    const shipments = { update: jest.fn().mockResolvedValue({}) };
    const queue = { fail: jest.fn().mockResolvedValue({}) };
    const dlq = { add: jest.fn().mockResolvedValue({}) };

    await moveToDeadLetter({
      job: { id: 'j1', correlationId: 'corr-1', data: { shipmentRecordId: 's1', invoiceData: {} } },
      shipments,
      queue,
      dlq,
      errorMessage: 'permanent',
      result: { success: false, error: 'permanent' }
    });

    expect(queue.fail).toHaveBeenCalledWith('j1', 'permanent');
    expect(dlq.add).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'corr-1', reason: 'permanent' }));
  });
});
