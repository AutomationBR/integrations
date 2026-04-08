const path = require('path');

const { JobQueueRepository } = require('../src/repositories/jobQueueRepository');

describe('JobQueueRepository', () => {
  let repository;
  const filePath = path.join(__dirname, '../storage/test-job-queue-repository.json');

  beforeEach(async () => {
    repository = new JobQueueRepository(filePath);
    await repository.clear();
  });

  afterEach(async () => {
    await repository.clear();
  });

  test('enfileira e claim o proximo job', async () => {
    await repository.enqueue('xml', { xmlPath: 'data/invoice.xml' });

    const claimed = await repository.claimNext();

    expect(claimed).not.toBeNull();
    expect(claimed.status).toBe('processing');
    expect(claimed.attempts).toBe(1);
  });

  test('marca job como concluido', async () => {
    const job = await repository.enqueue('payload', { shipmentRecordId: '1', invoiceData: {} });
    await repository.claimNext();
    await repository.complete(job.id);

    const loaded = await repository.get(job.id);

    expect(loaded.status).toBe('completed');
    expect(loaded.finishedAt).not.toBeNull();
  });

  test('reagenda job com retry', async () => {
    const job = await repository.enqueue('payload', { shipmentRecordId: '1', invoiceData: {} });
    await repository.claimNext();
    await repository.reschedule(job.id, 'temporary failure', '2099-01-01T00:00:00.000Z');

    const loaded = await repository.get(job.id);

    expect(loaded.status).toBe('retry_scheduled');
    expect(loaded.nextRunAt).toBe('2099-01-01T00:00:00.000Z');
  });

  test('cancela job pendente', async () => {
    const job = await repository.enqueue('payload', { shipmentRecordId: '1', invoiceData: {} });
    await repository.cancel(job.id, 'manual cancel');

    const loaded = await repository.get(job.id);

    expect(loaded.status).toBe('cancelled');
    expect(loaded.error).toBe('manual cancel');
  });
});
