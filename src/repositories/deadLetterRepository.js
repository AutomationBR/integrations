const crypto = require('crypto');
const path = require('path');
const { JsonFileRepository } = require('./jsonFileRepository');

class DeadLetterRepository extends JsonFileRepository {
  constructor(filePath = path.join(__dirname, '../../storage/dead-letters.json')) {
    super(filePath, []);
  }

  async add(entry) {
    const items = this._readData();
    const next = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry
    };

    items.push(next);
    this._writeData(items);
    return next;
  }

  async list() {
    return this._sortByCreatedAtDesc(this._readData());
  }

  async get(id) {
    return this._readData().find(item => item.id === id) || null;
  }

  async remove(id) {
    const items = this._readData();
    const next = items.filter(item => item.id !== id);

    if (next.length === items.length) {
      return false;
    }

    this._writeData(next);
    return true;
  }

  async clear() {
    this._writeData([]);
  }
}

module.exports = new DeadLetterRepository();
module.exports.DeadLetterRepository = DeadLetterRepository;
