const { processInvoiceData, processXmlFile } = require('../useCases/processShipment');
const { moveToDeadLetter, scheduleRetry, shouldRetry } = require('./workerRetry');

async function runJobByType(job) {
  if (job.type === 'xml') {
    return processXmlFile(job.data.xmlPath);
  }

  if (job.type === 'payload') {
    return processInvoiceData(job.data.invoiceData);
  }

  throw new Error(`Unsupported job type: ${job.type}`);
}

async function handleSuccessfulResult({ job, shipments, queue, workerState, result }) {
  await shipments.update(job.data.shipmentRecordId, {
    status: 'completed',
    result,
    error: null
  });
  await queue.complete(job.id);
  workerState.heartbeat({
    status: 'running',
    lastJobId: job.id,
    lastJobFinishedAt: new Date().toISOString(),
    lastError: null
  });
  return result;
}

async function handleFailedResult({ job, shipments, queue, workerState, dlq, result }) {
  if (shouldRetry(job)) {
    await scheduleRetry({
      job,
      shipments,
      queue,
      errorMessage: result.error,
      result,
      warningMessage: 'Job reagendado para retry'
    });
  } else {
    await moveToDeadLetter({
      job,
      shipments,
      queue,
      dlq,
      errorMessage: result.error,
      result
    });
  }

  workerState.heartbeat({
    status: 'running',
    lastJobId: job.id,
    lastJobFinishedAt: new Date().toISOString(),
    lastError: result.error
  });

  return result;
}

async function handleException({ job, shipments, queue, workerState, dlq, error }) {
  if (shouldRetry(job)) {
    await scheduleRetry({
      job,
      shipments,
      queue,
      errorMessage: error.message,
      warningMessage: 'Job reagendado apos excecao'
    });
  } else {
    await moveToDeadLetter({
      job,
      shipments,
      queue,
      dlq,
      errorMessage: error.message
    });
  }

  workerState.heartbeat({
    status: 'running',
    lastJobId: job.id,
    lastJobFinishedAt: new Date().toISOString(),
    lastError: error.message
  });
}

module.exports = {
  handleException,
  handleFailedResult,
  handleSuccessfulResult,
  runJobByType
};
