require('dotenv').config();

const path = require('path');

const logger = require('../utils/logger');
const NFeMapper = require('../utils/nfeMapper');
const { buildFedexPayload, validatePayload } = require('../utils/buildPayload');
const { parseXML } = require('../services/xmlParser');
const fedexAuth = require('../services/fedexAuth');
const fedexShipment = require('../services/fedexShipment');
const labelService = require('../services/labelService');

async function processInvoiceData(invoiceData) {
  try {
    NFeMapper.validate(invoiceData);

    logger.log('Construindo payload...');
    const payload = buildFedexPayload(invoiceData, process.env.FEDEX_ACCOUNT_NUMBER);
    validatePayload(payload);

    logger.log('Testando autenticacao...');
    const authTest = await fedexAuth.testAuth();
    if (!authTest.authenticated) {
      throw new Error(`Authentication failed: ${authTest.error}`);
    }

    logger.log('Criando shipment na FedEx...');
    const shipmentResult = await fedexShipment.createShipment(payload);

    let savedLabel = null;
    if (shipmentResult.labelUrl) {
      logger.log('Salvando label em PDF...');
      savedLabel = await labelService.saveLabelPDFFromUrl(
        shipmentResult.labelUrl,
        shipmentResult.shipmentId,
        invoiceData.invoiceNumber
      );
    }

    let savedInvoice = null;
    if (shipmentResult.commercialInvoiceUrl) {
      logger.log('Salvando Commercial Invoice...');
      savedInvoice = await labelService.saveCommercialInvoice(
        shipmentResult.commercialInvoiceUrl,
        shipmentResult.shipmentId,
        invoiceData.invoiceNumber
      );
    }

    logger.log('Criando relatorio...');
    const report = await labelService.createShipmentReport(
      invoiceData,
      shipmentResult,
      savedLabel,
      savedInvoice
    );

    return {
      success: true,
      invoiceNumber: invoiceData.invoiceNumber,
      shipmentId: shipmentResult.shipmentId,
      trackingNumber: shipmentResult.trackingNumber,
      labelFile: savedLabel?.fileName || null,
      invoiceFile: savedInvoice?.fileName || null,
      payload,
      report
    };
  } catch (error) {
    logger.error('ERRO NO PROCESSAMENTO', error);
    return {
      success: false,
      invoiceNumber: invoiceData?.invoiceNumber || null,
      error: error.message
    };
  }
}

async function processXmlFile(xmlFilePath) {
  try {
    const resolvedPath = path.resolve(xmlFilePath);
    logger.log(`Iniciando processamento de ${path.basename(resolvedPath)}`);

    logger.log('Parsing do XML...');
    const xmlData = await parseXML(resolvedPath);

    logger.log('Mapeando dados...');
    const invoiceData = NFeMapper.mapNFeToInvoiceData(xmlData);

    return await processInvoiceData(invoiceData);
  } catch (error) {
    logger.error('ERRO NO PROCESSAMENTO', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  processInvoiceData,
  processXmlFile
};
