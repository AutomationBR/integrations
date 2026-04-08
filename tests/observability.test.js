const { buildOpsStatus, buildPrometheusMetrics, countByStatus } = require('../src/api/observability');

describe('observability', () => {
  test('countByStatus agrega itens por status', () => {
    expect(countByStatus([{ status: 'queued' }, { status: 'queued' }, { status: 'failed' }])).toEqual({
      queued: 2,
      failed: 1
    });
  });

  test('buildOpsStatus monta resumo operacional', () => {
    const status = buildOpsStatus({
      repositoryMode: 'file',
      serverStartedAt: '2026-04-07T00:00:00.000Z',
      shipments: [{ status: 'completed' }, { status: 'failed' }],
      queueJobs: [{ status: 'queued' }],
      workerState: { status: 'running' }
    });

    expect(status.service).toBe('xml_converter_api');
    expect(status.shipments.byStatus.completed).toBe(1);
    expect(status.queue.byStatus.queued).toBe(1);
  });

  test('buildPrometheusMetrics inclui gauges principais', () => {
    const metrics = buildPrometheusMetrics({
      repositoryMode: 'postgres',
      shipments: [{ status: 'completed' }],
      queueJobs: [{ status: 'queued' }],
      workerState: { status: 'running', heartbeatAt: '2026-04-07T00:00:00.000Z' }
    });

    expect(metrics).toContain('xml_converter_shipments_total{status="completed"} 1');
    expect(metrics).toContain('xml_converter_queue_jobs_total{status="queued"} 1');
    expect(metrics).toContain('xml_converter_repository_mode{mode="postgres"} 1');
    expect(metrics).toContain('xml_converter_worker_up 1');
  });
});
