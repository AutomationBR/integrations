require('dotenv').config();

const logger = require('../utils/logger');
const { defaultRepositories, resolveRepositories } = require('./workerDependencies');
const {
  computeBackoffMs,
  shouldRetry
} = require('./workerRetry');
const {
  handleException,
  handleFailedResult,
  handleSuccessfulResult,
  runJobByType
} = require('./workerProcessor');

const DEFAULT_POLL_MS = Number(process.env.WORKER_POLL_MS || 1000);

async function processJob(job, repositories = {}) {
  const {
    shipmentRepository: shipments,
    jobQueueRepository: queue,
    workerStateRepository: workerState,
    deadLetterRepository: dlq
  } = resolveRepositories(repositories);

  try {
    workerState.heartbeat({
      status: 'processing',
      lastJobId: job.id,
      lastError: null
    });

    await shipments.update(job.data.shipmentRecordId, {
      status: 'processing',
      error: null
    });

    const result = await runJobByType(job);

    if (result.success) {
      return handleSuccessfulResult({ job, shipments, queue, workerState, result });
    }

    return handleFailedResult({ job, shipments, queue, workerState, dlq, result });
  } catch (error) {
    await handleException({ job, shipments, queue, workerState, dlq, error });
    throw error;
  }
}

async function drainQueueOnce(repositories = {}) {
  const { jobQueueRepository: queue } = resolveRepositories(repositories);
  const job = await queue.claimNext();

  if (!job) {
    return null;
  }

  await processJob(job, repositories);
  return job;
}

function startWorker(options = {}) {
  const pollMs = options.pollMs || DEFAULT_POLL_MS;
  const repositories = options.repositories || {};
  const { workerStateRepository: workerState } = resolveRepositories(repositories);

  logger.log(`Worker iniciado com polling de ${pollMs}ms`);
  workerState.markStarted({ pollMs });

  const timer = setInterval(() => {
    workerState.heartbeat({ status: 'running' });
    drainQueueOnce(repositories).catch(error => {
      workerState.heartbeat({
        status: 'running',
        lastError: error.message
      });
      logger.error('Erro no worker de shipments', error);
    });
  }, pollMs);

  return {
    stop() {
      clearInterval(timer);
      workerState.markStopped();
    }
  };
}

if (require.main === module) {
  startWorker();
}

module.exports = {
  drainQueueOnce,
  processJob,
  startWorker,
  computeBackoffMs,
  shouldRetry
};
