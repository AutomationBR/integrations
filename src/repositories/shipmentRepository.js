const crypto = require('crypto');
const path = require('path');
const { JsonFileRepository } = require('./jsonFileRepository');

class ShipmentRepository extends JsonFileRepository {
  constructor(filePath = path.join(__dirname, '../../storage/shipments.json')) {
    super(filePath, []);
  }

  async create(input) {
    const shipments = this._readData();
    const now = new Date().toISOString();

    const shipment = {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      input,
      result: null,
      error: null
    };

    shipments.push(shipment);
    this._writeData(shipments);
    return shipment;
  }

  async update(id, patch) {
    const shipments = this._readData();
    const index = shipments.findIndex(item => item.id === id);

    if (index === -1) {
      return null;
    }

    const next = {
      ...shipments[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    shipments[index] = next;
    this._writeData(shipments);
    return next;
  }

  async get(id) {
    return this._readData().find(item => item.id === id) || null;
  }

  async list() {
    return this._sortByCreatedAtDesc(this._readData());
  }

  async clear() {
    this._writeData([]);
  }
}

module.exports = new ShipmentRepository();
module.exports.ShipmentRepository = ShipmentRepository;
