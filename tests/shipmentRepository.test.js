const path = require('path');

const { ShipmentRepository } = require('../src/repositories/shipmentRepository');

describe('ShipmentRepository', () => {
  let repository;
  const filePath = path.join(__dirname, '../storage/test-shipment-repository.json');

  beforeEach(async () => {
    repository = new ShipmentRepository(filePath);
    await repository.clear();
  });

  afterEach(async () => {
    await repository.clear();
  });

  test('persiste um job criado e atualizado', async () => {
    const created = await repository.create({ type: 'xml', xmlPath: 'data/invoice.xml' });
    await repository.update(created.id, { status: 'completed', result: { success: true } });

    const loaded = await repository.get(created.id);

    expect(loaded).not.toBeNull();
    expect(loaded.status).toBe('completed');
    expect(loaded.result.success).toBe(true);
  });

  test('lista jobs em ordem mais recente primeiro', async () => {
    const first = await repository.create({ type: 'xml', xmlPath: 'first.xml' });
    const second = await repository.create({ type: 'xml', xmlPath: 'second.xml' });

    const items = await repository.list();

    expect(items).toHaveLength(2);
    expect([first.id, second.id]).toContain(items[0].id);
  });
});
