const {
  jsonValue,
  mapBaseRow,
  mergeWithUpdatedAt,
  nowIso,
  toIsoOrNull
} = require('../src/repositories/pgRepositoryUtils');

describe('pgRepositoryUtils', () => {
  test('nowIso retorna timestamp ISO', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('toIsoOrNull converte valor ou retorna null', () => {
    expect(toIsoOrNull('2026-04-07T00:00:00.000Z')).toBe('2026-04-07T00:00:00.000Z');
    expect(toIsoOrNull(null)).toBeNull();
  });

  test('jsonValue serializa valor para JSON', () => {
    expect(jsonValue({ a: 1 })).toBe('{"a":1}');
  });

  test('mergeWithUpdatedAt preserva patch e atualiza timestamp', () => {
    const merged = mergeWithUpdatedAt({ id: '1', status: 'queued' }, { status: 'completed' });

    expect(merged.status).toBe('completed');
    expect(merged.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('mapBaseRow extrai campos basicos de uma linha postgres', () => {
    expect(mapBaseRow({
      id: '1',
      created_at: '2026-04-07T00:00:00.000Z',
      updated_at: '2026-04-07T00:00:01.000Z'
    })).toEqual({
      id: '1',
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:01.000Z'
    });
  });
});
