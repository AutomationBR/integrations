require('dotenv').config();

const fs = require('fs');
const path = require('path');

const logger = require('./utils/logger');
const { processXmlFile } = require('./useCases/processShipment');

class ShipmentOrchestrator {
  async processNFe(xmlFilePath) {
    return processXmlFile(xmlFilePath);
  }

  async processBatch(xmlFolder) {
    try {
      const files = fs.readdirSync(xmlFolder).filter(file => file.endsWith('.xml'));
      logger.log(`Encontrados ${files.length} arquivos XML`);

      const results = [];
      for (const file of files) {
        const filePath = path.join(xmlFolder, file);
        const result = await this.processNFe(filePath);
        results.push(result);

        if (files.indexOf(file) < files.length - 1) {
          await this._delay(2000);
        }
      }

      return results;
    } catch (error) {
      logger.error('Erro ao processar batch', error);
      throw error;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ShipmentOrchestrator();
