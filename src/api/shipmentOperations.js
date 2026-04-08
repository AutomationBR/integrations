const fs = require('fs');
const path = require('path');

function buildShipmentResponse(job) {
  return {
    id: job.id,
    correlationId: job.correlationId || job.input?.correlationId || null,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    input: job.input,
    result: job.result,
    error: job.error
  };
}

function createQueuedShipmentResponse(record, job) {
  return {
    id: record.id,
    correlationId: record.correlationId || job.correlationId || null,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    input: record.input,
    result: record.result,
    error: record.error,
    queueJob: {
      id: job.id,
      status: job.status,
      type: job.type
    }
  };
}

function buildJobDataFromShipmentRecord(record) {
  if (!record?.input?.type) return null;

  if (record.input.type === 'xml') {
    return {
      type: 'xml',
      data: {
        shipmentRecordId: record.id,
        xmlPath: record.input.xmlPath,
        correlationId: record.correlationId || record.input.correlationId || null
      }
    };
  }

  if (record.input.type === 'payload') {
    return {
      type: 'payload',
      data: {
        shipmentRecordId: record.id,
        invoiceData: record.input.invoiceData,
        correlationId: record.correlationId || record.input.correlationId || null
      }
    };
  }

  return null;
}

async function enqueueXmlJob(repository, queueRepository, xmlPath, correlationId) {
  const resolvedPath = path.resolve(xmlPath);
  const created = await repository.create({
    type: 'xml',
    xmlPath: resolvedPath,
    correlationId
  });
  const record = await repository.update(created.id, { status: 'queued', correlationId });
  const job = await queueRepository.enqueue('xml', {
    shipmentRecordId: created.id,
    xmlPath: resolvedPath,
    correlationId
  });

  return { record, job };
}

async function enqueuePayloadJob(repository, queueRepository, invoiceData, correlationId) {
  const created = await repository.create({
    type: 'payload',
    invoiceNumber: invoiceData?.invoiceNumber || null,
    correlationId
  });
  const record = await repository.update(created.id, { status: 'queued', correlationId });
  const job = await queueRepository.enqueue('payload', {
    shipmentRecordId: created.id,
    invoiceData,
    correlationId
  });

  return { record, job };
}

function ensureXmlFileExists(xmlPath) {
  const resolvedPath = path.resolve(xmlPath);

  if (!fs.existsSync(resolvedPath)) {
    const error = new Error(`XML file not found: ${resolvedPath}`);
    error.statusCode = 400;
    throw error;
  }

  return resolvedPath;
}

async function requeueShipment(repository, queueRepository, shipmentId, correlationId) {
  const shipment = await repository.get(shipmentId);

  if (!shipment) {
    const error = new Error('Shipment not found');
    error.statusCode = 404;
    throw error;
  }

  const nextJob = buildJobDataFromShipmentRecord(shipment);
  if (!nextJob) {
    const error = new Error('Shipment cannot be requeued');
    error.statusCode = 400;
    throw error;
  }

  await repository.update(shipment.id, {
    status: 'queued',
    error: null,
    correlationId: shipment.correlationId || correlationId
  });

  const queueJob = await queueRepository.enqueue(nextJob.type, nextJob.data);
  return { requeued: true, shipmentId: shipment.id, queueJob };
}

async function cancelQueueJob(repository, queueRepository, jobId) {
  const job = await queueRepository.get(jobId);

  if (!job) {
    const error = new Error('Queue job not found');
    error.statusCode = 404;
    throw error;
  }

  if (!['queued', 'retry_scheduled'].includes(job.status)) {
    const error = new Error(`Job cannot be cancelled from status ${job.status}`);
    error.statusCode = 409;
    throw error;
  }

  const cancelled = await queueRepository.cancel(jobId, 'cancelled via API');
  await repository.update(job.data.shipmentRecordId, {
    status: 'cancelled',
    error: 'cancelled via API'
  });

  return { cancelled: true, queueJob: cancelled };
}

async function replayDeadLetter(dlqRepository, queueRepository, deadLetterId, correlationId) {
  const deadLetter = await dlqRepository.get(deadLetterId);

  if (!deadLetter) {
    const error = new Error('Dead-letter item not found');
    error.statusCode = 404;
    throw error;
  }

  const jobType = deadLetter.payload?.invoiceData ? 'payload' : 'xml';
  const queueJob = await queueRepository.enqueue(jobType, {
    ...deadLetter.payload,
    correlationId: deadLetter.correlationId || correlationId
  });
  await dlqRepository.remove(deadLetterId);

  return { replayed: true, deadLetterId, queueJob };
}

module.exports = {
  buildShipmentResponse,
  cancelQueueJob,
  createQueuedShipmentResponse,
  enqueuePayloadJob,
  enqueueXmlJob,
  ensureXmlFileExists,
  replayDeadLetter,
  requeueShipment
};
