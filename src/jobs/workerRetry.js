const logger = require('../utils/logger');

const DEFAULT_MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS || 3);
const DEFAULT_BACKOFF_MS = Number(process.env.WORKER_RETRY_BASE_MS || 5000);

function computeBackoffMs(attempt) {
  return DEFAULT_BACKOFF_MS * Math.max(attempt, 1);
}

function shouldRetry(job) {
  return job.attempts < (job.maxAttempts || DEFAULT_MAX_ATTEMPTS);
}

async function scheduleRetry({ job, shipments, queue, errorMessage, result, warningMessage }) {
  const nextRunAt = new Date(Date.now() + computeBackoffMs(job.attempts)).toISOString();

  await queue.reschedule(job.id, errorMessage, nextRunAt);
  await shipments.update(job.data.shipmentRecordId, {
    status: 'retry_scheduled',
    error: errorMessage,
    ...(result ? { result } : {})
  });

  logger.warn(warningMessage, {
    jobId: job.id,
    correlationId: job.correlationId || job.data?.correlationId || null,
    attempts: job.attempts,
    nextRunAt
  });
}

async function moveToDeadLetter({ job, shipments, queue, dlq, errorMessage, result }) {
  await shipments.update(job.data.shipmentRecordId, {
    status: 'failed',
    error: errorMessage,
    ...(result ? { result } : {})
  });
  await queue.fail(job.id, errorMessage);
  await dlq.add({
    jobId: job.id,
    correlationId: job.correlationId || job.data?.correlationId || null,
    shipmentRecordId: job.data.shipmentRecordId,
    reason: errorMessage,
    payload: job.data
  });
}

module.exports = {
  computeBackoffMs,
  moveToDeadLetter,
  scheduleRetry,
  shouldRetry
};
