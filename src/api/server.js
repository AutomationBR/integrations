require('dotenv').config();

const http = require('http');

const logger = require('../utils/logger');
const { sendJson } = require('./http');
const { handleRequest, buildPrometheusMetrics } = require('./handlers');
const { createServerContext } = require('./serverContext');

const DEFAULT_PORT = Number(process.env.PORT || 3000);

function createServer(repository, queueRepository, stateRepository, dlqRepository) {
  const context = createServerContext({
    repository,
    queueRepository,
    stateRepository,
    dlqRepository
  });

  return http.createServer((req, res) => {
    handleRequest(req, res, context).catch(error => {
      logger.error('Erro na API HTTP', error);
      sendJson(res, error.statusCode || 500, { error: error.message });
    });
  });
}

function startServer(port = DEFAULT_PORT, repository, queueRepository, stateRepository, dlqRepository) {
  const server = createServer(repository, queueRepository, stateRepository, dlqRepository);
  server.listen(port, () => {
    logger.log(`API HTTP escutando na porta ${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildPrometheusMetrics,
  createServer,
  startServer
};
