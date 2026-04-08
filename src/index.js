// Ponto de entrada da aplicação
require('dotenv').config();

const logger = require('./utils/logger');
const orchestrator = require('./orchestrator');

async function main() {
  try {
    logger.log('================================');
    logger.log('🚀 XML Converter - FedEx Integration');
    logger.log('================================\n');

    // Opção 1: Processar arquivo único
    const xmlPath = process.argv[2] || './data/invoice.xml';
    
    if (!require('fs').existsSync(xmlPath)) {
      logger.error(`❌ Arquivo não encontrado: ${xmlPath}`);
      process.exit(1);
    }

    logger.log(`📦 Processando: ${xmlPath}\n`);
    const result = await orchestrator.processNFe(xmlPath);

    if (result.success) {
      logger.log('\n✅ PROCESSAMENTO CONCLUÍDO!');
      logger.log(`   ShipmentID: ${result.shipmentId}`);
      logger.log(`   Tracking: ${result.trackingNumber}`);
      logger.log(`   Label: ${result.labelFile}\n`);
    } else {
      logger.error(`\n❌ Erro: ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Erro fatal', error);
    process.exit(1);
  }
}

// Executar se for o arquivo principal
if (require.main === module) {
  main();
}

module.exports = { orchestrator };