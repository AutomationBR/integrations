const crypto = require('crypto');
const {
  jsonValue,
  mapBaseRow,
  mergeWithUpdatedAt,
  nowIso,
  toIsoOrNull
} = require('./pgRepositoryUtils');

class PgJobQueueRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async enqueue(type, data, options = {}) {
    const job = {
      id: crypto.randomUUID(),
      type,
      correlationId: data.correlationId || null,
      status: 'queued',
      data,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: null,
      finishedAt: null,
      attempts: 0,
      error: null,
      nextRunAt: options.nextRunAt || nowIso(),
      maxAttempts: options.maxAttempts || 3
    };

    await this.pool.query(
      `insert into shipment_jobs
       (id, type, correlation_id, status, data_json, created_at, updated_at, started_at, finished_at, attempts, error, next_run_at, max_attempts)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        job.id,
        job.type,
        job.correlationId,
        job.status,
        jsonValue(job.data),
        job.createdAt,
        job.updatedAt,
        job.startedAt,
        job.finishedAt,
        job.attempts,
        job.error,
        job.nextRunAt,
        job.maxAttempts
      ]
    );

    return job;
  }

  async claimNext() {
    const result = await this.pool.query(`
      update shipment_jobs
      set status = 'processing',
          attempts = attempts + 1,
          started_at = now(),
          updated_at = now(),
          error = null
      where id = (
        select id
        from shipment_jobs
        where status in ('queued', 'retry_scheduled')
          and (next_run_at is null or next_run_at <= now())
        order by created_at asc
        limit 1
        for update skip locked
      )
      returning id, type, correlation_id, status, data_json, created_at, updated_at, started_at, finished_at, attempts, error, next_run_at, max_attempts
    `);

    return this._mapRow(result.rows[0]);
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
    const current = await this.get(id);
    if (!current) {
      return null;
    }

    const next = mergeWithUpdatedAt(current, patch);

    await this.pool.query(
      `update shipment_jobs
       set type = $2,
           correlation_id = $3,
           status = $4,
           data_json = $5::jsonb,
           updated_at = $6,
           started_at = $7,
           finished_at = $8,
           attempts = $9,
           error = $10,
           next_run_at = $11,
           max_attempts = $12
       where id = $1`,
      [
        id,
        next.type,
        next.correlationId,
        next.status,
        jsonValue(next.data),
        next.updatedAt,
        next.startedAt,
        next.finishedAt,
        next.attempts,
        next.error,
        next.nextRunAt,
        next.maxAttempts
      ]
    );

    return next;
  }

  async get(id) {
    const result = await this.pool.query(
      `select id, type, correlation_id, status, data_json, created_at, updated_at, started_at, finished_at, attempts, error, next_run_at, max_attempts
       from shipment_jobs
       where id = $1`,
      [id]
    );

    return this._mapRow(result.rows[0]);
  }

  async list() {
    const result = await this.pool.query(
      `select id, type, correlation_id, status, data_json, created_at, updated_at, started_at, finished_at, attempts, error, next_run_at, max_attempts
       from shipment_jobs
       order by created_at desc`
    );

    return result.rows.map(row => this._mapRow(row));
  }

  async clear() {
    await this.pool.query('delete from shipment_jobs');
  }

  _mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      ...mapBaseRow(row),
      type: row.type,
      correlationId: row.correlation_id,
      status: row.status,
      data: row.data_json,
      startedAt: toIsoOrNull(row.started_at),
      finishedAt: toIsoOrNull(row.finished_at),
      attempts: row.attempts,
      error: row.error,
      nextRunAt: toIsoOrNull(row.next_run_at),
      maxAttempts: row.max_attempts
    };
  }
}

module.exports = { PgJobQueueRepository };
