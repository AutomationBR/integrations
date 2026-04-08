const path = require('path');
const { JsonFileRepository } = require('./jsonFileRepository');

const DEFAULT_WORKER_STATE = {
  status: 'idle',
  startedAt: null,
  heartbeatAt: null,
  lastJobId: null,
  lastJobFinishedAt: null,
  lastError: null
};

class WorkerStateRepository extends JsonFileRepository {
  constructor(filePath = path.join(__dirname, '../../storage/worker-state.json')) {
    super(filePath, DEFAULT_WORKER_STATE);
  }

  read() {
    return this._readData();
  }

  write(state) {
    return this._writeData(state);
  }

  markStarted(metadata = {}) {
    return this.write({
      status: 'running',
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      lastJobId: null,
      lastJobFinishedAt: null,
      lastError: null,
      ...metadata
    });
  }

  heartbeat(patch = {}) {
    const current = this.read();
    return this.write({
      ...current,
      heartbeatAt: new Date().toISOString(),
      ...patch
    });
  }

  markStopped() {
    const current = this.read();
    return this.write({
      ...current,
      status: 'stopped',
      heartbeatAt: new Date().toISOString()
    });
  }

  reset() {
    return this.write(DEFAULT_WORKER_STATE);
  }
}

module.exports = new WorkerStateRepository();
module.exports.WorkerStateRepository = WorkerStateRepository;
