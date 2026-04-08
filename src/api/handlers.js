const crypto = require('crypto');

const { buildOpsStatus, buildPrometheusMetrics } = require('./observability');
const {
  buildShipmentResponse,
  cancelQueueJob,
  createQueuedShipmentResponse,
  enqueuePayloadJob,
  enqueueXmlJob,
  ensureXmlFileExists,
  replayDeadLetter,
  requeueShipment
} = require('./shipmentOperations');
const { filterDeadLetters, filterQueueJobs, filterShipments, paginateItems, parsePagination, sortItems } = require('./querying');
const { collectJson, getBearerToken, sendJson, sendText } = require('./http');

function isProtectedOpsRoute(req, pathname) {
  if (req.method === 'GET' && ['/ops/status', '/metrics', '/queue/jobs', '/dead-letter'].includes(pathname)) {
    return true;
  }

  if (req.method === 'POST' && (
    pathname.match(/^\/shipments\/[^/]+\/requeue$/) ||
    pathname.match(/^\/queue\/jobs\/[^/]+\/cancel$/) ||
    pathname.match(/^\/dead-letter\/[^/]+\/replay$/)
  )) {
    return true;
  }

  return false;
}

async function handleRequest(req, res, context) {
  const {
    defaultRepositories,
    dlqRepository,
    opsToken,
    queueRepository,
    repository,
    serverStartedAt,
    stateRepository
  } = context;

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

  if (opsToken && isProtectedOpsRoute(req, url.pathname)) {
    const token = getBearerToken(req);
    if (token !== opsToken) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'xml_converter_api',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/ops/status') {
    const shipments = await repository.list();
    const queueJobs = await queueRepository.list();
    const workerState = stateRepository.read();
    sendJson(res, 200, buildOpsStatus({
      repositoryMode: defaultRepositories.mode,
      serverStartedAt,
      shipments,
      queueJobs,
      workerState
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/metrics') {
    const shipments = await repository.list();
    const queueJobs = await queueRepository.list();
    const workerState = stateRepository.read();
    const metrics = buildPrometheusMetrics({
      repositoryMode: defaultRepositories.mode,
      shipments,
      queueJobs,
      workerState
    });
    sendText(res, 200, metrics, 'text/plain; version=0.0.4; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/shipments') {
    const { page, limit } = parsePagination(url.searchParams);
    const items = sortItems(
      filterShipments((await repository.list()).map(buildShipmentResponse), url.searchParams),
      url.searchParams,
      ['createdAt', 'updatedAt', 'status', 'correlationId']
    );
    sendJson(res, 200, paginateItems(items, page, limit));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/shipments/')) {
    const shipmentId = url.pathname.split('/')[2];
    const job = await repository.get(shipmentId);

    if (!job) {
      sendJson(res, 404, { error: 'Shipment not found' });
      return;
    }

    sendJson(res, 200, buildShipmentResponse(job));
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/shipments\/[^/]+\/requeue$/)) {
    const shipmentId = url.pathname.split('/')[2];
    const response = await requeueShipment(repository, queueRepository, shipmentId, correlationId);
    sendJson(res, 202, response);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/queue/jobs') {
    const { page, limit } = parsePagination(url.searchParams);
    const items = sortItems(
      filterQueueJobs(await queueRepository.list(), url.searchParams),
      url.searchParams,
      ['createdAt', 'updatedAt', 'status', 'type', 'correlationId']
    );
    sendJson(res, 200, paginateItems(items, page, limit));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/dead-letter') {
    const { page, limit } = parsePagination(url.searchParams);
    const items = sortItems(
      filterDeadLetters(await dlqRepository.list(), url.searchParams),
      url.searchParams,
      ['createdAt', 'correlationId', 'shipmentRecordId']
    );
    sendJson(res, 200, paginateItems(items, page, limit));
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/dead-letter\/[^/]+\/replay$/)) {
    const deadLetterId = url.pathname.split('/')[2];
    const response = await replayDeadLetter(dlqRepository, queueRepository, deadLetterId, correlationId);
    sendJson(res, 202, response);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/shipments/xml') {
    const body = await collectJson(req);
    const xmlPath = body.xmlPath || './data/invoice.xml';
    const resolvedPath = ensureXmlFileExists(xmlPath);
    const queued = await enqueueXmlJob(repository, queueRepository, resolvedPath, correlationId);
    sendJson(res, 202, createQueuedShipmentResponse(queued.record, queued.job));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/shipments/payload') {
    const body = await collectJson(req);

    if (!body || !body.invoiceData) {
      sendJson(res, 400, { error: 'invoiceData is required' });
      return;
    }

    const queued = await enqueuePayloadJob(repository, queueRepository, body.invoiceData, correlationId);
    sendJson(res, 202, createQueuedShipmentResponse(queued.record, queued.job));
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/queue\/jobs\/[^/]+\/cancel$/)) {
    const jobId = url.pathname.split('/')[3];
    const response = await cancelQueueJob(repository, queueRepository, jobId);
    sendJson(res, 200, response);
    return;
  }

  sendJson(res, 404, { error: 'Route not found' });
}

module.exports = {
  buildPrometheusMetrics,
  handleRequest
};
