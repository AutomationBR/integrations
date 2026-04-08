function countByStatus(items) {
  return items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

function buildOpsStatus({ repositoryMode, serverStartedAt, shipments, queueJobs, workerState }) {
  return {
    service: 'xml_converter_api',
    repositoryMode,
    serverStartedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    shipments: {
      total: shipments.length,
      byStatus: countByStatus(shipments)
    },
    queue: {
      total: queueJobs.length,
      byStatus: countByStatus(queueJobs)
    },
    worker: workerState
  };
}

function buildPrometheusMetrics({ repositoryMode, shipments, queueJobs, workerState }) {
  const lines = [
    '# HELP xml_converter_shipments_total Total de shipments por status',
    '# TYPE xml_converter_shipments_total gauge'
  ];

  const shipmentCounts = countByStatus(shipments);

  Object.entries(shipmentCounts).forEach(([status, value]) => {
    lines.push(`xml_converter_shipments_total{status="${status}"} ${value}`);
  });

  lines.push('# HELP xml_converter_queue_jobs_total Total de jobs na fila por status');
  lines.push('# TYPE xml_converter_queue_jobs_total gauge');

  const queueCounts = countByStatus(queueJobs);

  Object.entries(queueCounts).forEach(([status, value]) => {
    lines.push(`xml_converter_queue_jobs_total{status="${status}"} ${value}`);
  });

  lines.push('# HELP xml_converter_repository_mode Repository mode flag');
  lines.push('# TYPE xml_converter_repository_mode gauge');
  lines.push(`xml_converter_repository_mode{mode="${repositoryMode}"} 1`);

  lines.push('# HELP xml_converter_worker_up Worker running flag');
  lines.push('# TYPE xml_converter_worker_up gauge');
  lines.push(`xml_converter_worker_up ${workerState.status === 'idle' || workerState.status === 'stopped' ? 0 : 1}`);

  if (workerState.heartbeatAt) {
    lines.push('# HELP xml_converter_worker_heartbeat_timestamp_seconds Worker heartbeat timestamp');
    lines.push('# TYPE xml_converter_worker_heartbeat_timestamp_seconds gauge');
    lines.push(`xml_converter_worker_heartbeat_timestamp_seconds ${Math.floor(new Date(workerState.heartbeatAt).getTime() / 1000)}`);
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildOpsStatus,
  buildPrometheusMetrics,
  countByStatus
};
