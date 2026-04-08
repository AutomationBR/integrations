const path = require('path');

const { DeadLetterRepository } = require('../src/repositories/deadLetterRepository');

describe('DeadLetterRepository', () => {
  let repository;

  beforeEach(async () => {
    repository = new DeadLetterRepository(path.join(__dirname, '../storage/test-dead-letters.json'));
    await repository.clear();
  });

  afterEach(async () => {
    await repository.clear();
  });

  test('adiciona item na dead-letter queue', async () => {
    await repository.add({
      jobId: 'job-1',
      correlationId: 'corr-1',
      reason: 'permanent failure'
    });

    const items = await repository.list();

    expect(items).toHaveLength(1);
    expect(items[0].jobId).toBe('job-1');
    expect(items[0].correlationId).toBe('corr-1');
  });

  test('busca e remove item da dead-letter queue', async () => {
    const created = await repository.add({
      jobId: 'job-2',
      correlationId: 'corr-2',
      reason: 'remove me'
    });

    const loaded = await repository.get(created.id);
    const removed = await repository.remove(created.id);

    expect(loaded.jobId).toBe('job-2');
    expect(removed).toBe(true);
    expect(await repository.get(created.id)).toBeNull();
  });
});
