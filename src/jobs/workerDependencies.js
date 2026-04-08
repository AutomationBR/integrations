const { createRepositories } = require('../repositories/repositoryFactory');
const workerStateRepository = require('../repositories/workerStateRepository');
const deadLetterRepository = require('../repositories/deadLetterRepository');

const defaultRepositories = createRepositories();

function resolveRepositories(repositories = {}) {
  return {
    shipmentRepository: repositories.shipmentRepository || defaultRepositories.shipmentRepository,
    jobQueueRepository: repositories.jobQueueRepository || defaultRepositories.jobQueueRepository,
    workerStateRepository: repositories.workerStateRepository || workerStateRepository,
    deadLetterRepository: repositories.deadLetterRepository || deadLetterRepository
  };
}

module.exports = {
  defaultRepositories,
  resolveRepositories
};
