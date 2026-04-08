require('dotenv').config();

const { createRepositories } = require('../repositories/repositoryFactory');
const workerStateRepository = require('../repositories/workerStateRepository');
const deadLetterRepository = require('../repositories/deadLetterRepository');

function createServerContext(overrides = {}) {
  const defaultRepositories = createRepositories();

  return {
    defaultRepositories,
    repository: overrides.repository || defaultRepositories.shipmentRepository,
    queueRepository: overrides.queueRepository || defaultRepositories.jobQueueRepository,
    stateRepository: overrides.stateRepository || workerStateRepository,
    dlqRepository: overrides.dlqRepository || deadLetterRepository,
    serverStartedAt: overrides.serverStartedAt || new Date().toISOString(),
    opsToken: overrides.opsToken !== undefined ? overrides.opsToken : (process.env.OPS_API_TOKEN || null)
  };
}

module.exports = { createServerContext };
