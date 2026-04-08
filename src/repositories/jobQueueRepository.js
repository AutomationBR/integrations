const crypto = require('crypto');
const path = require('path');
const { JsonFileRepository } = require('./jsonFileRepository');

class JobQueueRepository extends JsonFileRepository {
  constructor(filePath = path.join(__dirname, '../../storage/jobs.json')) {
    super(filePath, []);
  }

  async enqueue(type, data, options = {}) {
    const jobs = this._readData();
    const now = new Date().toISOString();

    const job = {
      id: crypto.randomUUID(),
      type,
      correlationId: data.correlationId || null,
      status: 'queued',
      data,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      attempts: 0,
      error: null,
      nextRunAt: options.nextRunAt || now,
      maxAttempts: options.maxAttempts || 3
    };

    jobs.push(job);
    this._writeData(jobs);
    return job;
  }

  async claimNext() {
    const jobs = this._readData();
    const now = new Date().toISOString();
    const index = jobs.findIndex(job =>
      (job.status === 'queued' || job.status === 'retry_scheduled') &&
      (!job.nextRunAt || job.nextRunAt <= now)
    );

    if (index === -1) {
      return null;
    }

    const job = {
      ...jobs[index],
      status: 'processing',
      attempts: jobs[index].attempts + 1,
      startedAt: now,
      updatedAt: now,
      error: null
    };

    jobs[index] = job;
    this._writeData(jobs);
    return job;
  }

  async complete(id) {
    return this.update(id, {
      status: 'completed',
      finishedAt: new Date().toISOString(),
      error: null
    });
  }

  async fail(id, error) {
    return this.update(id, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error
    });
  }

  async cancel(id, reason = 'cancelled manually') {
    return this.update(id, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
      error: reason
    });
  }

  async reschedule(id, error, nextRunAt) {
    return this.update(id, {
      status: 'retry_scheduled',
      finishedAt: null,
      error,
      nextRunAt
    });
  }

  async update(id, patch) {
    const jobs = this._readData();
    const index = jobs.findIndex(job => job.id === id);

    if (index === -1) {
      return null;
    }

    const next = {
      ...jobs[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    jobs[index] = next;
    this._writeData(jobs);
    return next;
  }

  async get(id) {
    return this._readData().find(job => job.id === id) || null;
  }

  async list() {
    return this._sortByCreatedAtDesc(this._readData());
  }

  async clear() {
    this._writeData([]);
  }
}

module.exports = new JobQueueRepository();
module.exports.JobQueueRepository = JobQueueRepository;
