const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildShipmentResponse,
  cancelQueueJob,
  createQueuedShipmentResponse,
  ensureXmlFileExists,
  replayDeadLetter,
  requeueShipment
} = require('../src/api/shipmentOperations');

describe('shipmentOperations', () => {
  test('buildShipmentResponse prioriza correlationId do job', () => {
    const response = buildShipmentResponse({
      id: 's1',
      correlationId: 'corr-1',
      status: 'queued',
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:01.000Z',
      input: { correlationId: 'corr-input' },
      result: null,
      error: null
    });

    expect(response.correlationId).toBe('corr-1');
  });

  test('createQueuedShipmentResponse inclui metadados do job de fila', () => {
    const response = createQueuedShipmentResponse(
      { id: 's1', correlationId: 'corr-1', status: 'queued', createdAt: 'a', updatedAt: 'b', input: {}, result: null, error: null },
      { id: 'j1', status: 'queued', type: 'payload' }
    );

    expect(response.queueJob).toEqual({ id: 'j1', status: 'queued', type: 'payload' });
  });

  test('ensureXmlFileExists retorna caminho resolvido quando arquivo existe', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xml-converter-'));
    const filePath = path.join(tempDir, 'invoice.xml');
    fs.writeFileSync(filePath, '<xml />');

    expect(ensureXmlFileExists(filePath)).toBe(path.resolve(filePath));
  });

  test('ensureXmlFileExists lança erro 400 quando arquivo nao existe', () => {
    expect(() => ensureXmlFileExists('./missing-file.xml')).toThrow('XML file not found');

    try {
      ensureXmlFileExists('./missing-file.xml');
    } catch (error) {
      expect(error.statusCode).toBe(400);
    }
  });

  test('requeueShipment reenfileira shipment payload existente', async () => {
    const repository = {
      get: jest.fn().mockResolvedValue({
        id: 's1',
        correlationId: 'corr-1',
        input: { type: 'payload', invoiceData: { invoiceNumber: 'INV-1' } }
      }),
      update: jest.fn().mockResolvedValue({})
    };
    const queueRepository = {
      enqueue: jest.fn().mockResolvedValue({ id: 'j1', type: 'payload' })
    };

    const result = await requeueShipment(repository, queueRepository, 's1', 'corr-fallback');

    expect(result.requeued).toBe(true);
    expect(queueRepository.enqueue).toHaveBeenCalledWith('payload', expect.objectContaining({
      shipmentRecordId: 's1',
      correlationId: 'corr-1'
    }));
  });

  test('cancelQueueJob cancela job reenfileiravel e atualiza shipment', async () => {
    const repository = {
      update: jest.fn().mockResolvedValue({})
    };
    const queueRepository = {
      get: jest.fn().mockResolvedValue({
        id: 'j1',
        status: 'queued',
        data: { shipmentRecordId: 's1' }
      }),
      cancel: jest.fn().mockResolvedValue({ id: 'j1', status: 'cancelled' })
    };

    const result = await cancelQueueJob(repository, queueRepository, 'j1');

    expect(result.cancelled).toBe(true);
    expect(repository.update).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'cancelled' }));
  });

  test('replayDeadLetter reenfileira payload e remove item da DLQ', async () => {
    const dlqRepository = {
      get: jest.fn().mockResolvedValue({
        id: 'd1',
        correlationId: 'corr-dlq',
        payload: { shipmentRecordId: 's1', invoiceData: { invoiceNumber: 'INV-1' } }
      }),
      remove: jest.fn().mockResolvedValue(true)
    };
    const queueRepository = {
      enqueue: jest.fn().mockResolvedValue({ id: 'j1', type: 'payload' })
    };

    const result = await replayDeadLetter(dlqRepository, queueRepository, 'd1', 'corr-fallback');

    expect(result.replayed).toBe(true);
    expect(queueRepository.enqueue).toHaveBeenCalledWith('payload', expect.objectContaining({ correlationId: 'corr-dlq' }));
    expect(dlqRepository.remove).toHaveBeenCalledWith('d1');
  });
});
