const fs = require('fs');
const path = require('path');

class JsonFileRepository {
  constructor(filePath, defaultData) {
    this.filePath = filePath;
    this.defaultData = defaultData;
    this._ensureStorage();
  }

  _ensureStorage() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(this.defaultData, null, 2));
    }
  }

  _readData() {
    this._ensureStorage();
    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
  }

  _writeData(data) {
    this._ensureStorage();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    return data;
  }

  _sortByCreatedAtDesc(items) {
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

module.exports = {
  JsonFileRepository
};
