const crypto = require('crypto');
const { jsonValue, mapBaseRow, mergeWithUpdatedAt, nowIso } = require('./pgRepositoryUtils');

class PgShipmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(input) {
    const shipment = {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      input,
      result: null,
      error: null
    };

    await this.pool.query(
      `insert into shipments (id, status, created_at, updated_at, input_json, result_json, error)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        shipment.id,
        shipment.status,
        shipment.createdAt,
        shipment.updatedAt,
        jsonValue(shipment.input),
        jsonValue(shipment.result),
        shipment.error
      ]
    );

    return shipment;
  }

  async update(id, patch) {
    const current = await this.get(id);
    if (!current) {
      return null;
    }

    const next = mergeWithUpdatedAt(current, patch);

    await this.pool.query(
      `update shipments
       set status = $2,
           updated_at = $3,
           input_json = $4::jsonb,
           result_json = $5::jsonb,
           error = $6
       where id = $1`,
      [
        id,
        next.status,
        next.updatedAt,
        jsonValue(next.input),
        jsonValue(next.result),
        next.error
      ]
    );

    return next;
  }

  async get(id) {
    const result = await this.pool.query(
      `select id, status, created_at, updated_at, input_json, result_json, error
       from shipments
       where id = $1`,
      [id]
    );

    return this._mapRow(result.rows[0]);
  }

  async list() {
    const result = await this.pool.query(
      `select id, status, created_at, updated_at, input_json, result_json, error
       from shipments
       order by created_at desc`
    );

    return result.rows.map(row => this._mapRow(row));
  }

  async clear() {
    await this.pool.query('delete from shipments');
  }

  _mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      ...mapBaseRow(row),
      status: row.status,
      input: row.input_json,
      result: row.result_json,
      error: row.error
    };
  }
}

module.exports = { PgShipmentRepository };
