const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config/fedex');
const logger = require('../utils/logger');
const fedexAuth = require('./fedexAuth');

class FedexShipmentService {
  constructor() {
    this.baseURL = config.baseURL || 'https://apis-sandbox.fedex.com';
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async createShipment(payload, retryCount = 0) {
    try {
      logger.log(`Criando shipment (tentativa ${retryCount + 1}/${this.maxRetries})`);

      const token = await fedexAuth.getToken();
      const response = await axios.post(
        `${this.baseURL}/ship/v1/shipments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Locale': 'pt_BR'
          },
          timeout: 30000
        }
      );

      const trackingNumber = response.data.output?.transactionShipments?.[0]?.masterTrackingNumber;
      const labelUrl = response.data.output?.transactionShipments?.[0]?.pieceResponses?.[0]?.packageDocuments?.[0]?.url;
      const commercialInvoiceUrl = response.data.output?.transactionShipments?.[0]?.shipmentDocuments?.find(
        doc => doc.contentType === 'COMMERCIAL_INVOICE'
      )?.url;

      logger.log(`Shipment criado com sucesso: ${trackingNumber}`);
      logger.log(`Label URL: ${labelUrl}`);
      if (commercialInvoiceUrl) {
        logger.log(`Commercial Invoice URL: ${commercialInvoiceUrl}`);
      }

      const debugDir = this._ensureDebugDir();
      fs.writeFileSync(path.join(debugDir, 'fedex_shipment_response.json'), JSON.stringify(response.data, null, 2));

      return {
        success: true,
        shipmentId: trackingNumber,
        trackingNumber,
        labelUrl,
        commercialInvoiceUrl,
        data: response.data
      };
    } catch (error) {
      const status = error.response?.status;
      const fullErrorData = error.response?.data;
      const errorDetail = this._extractErrorDetail(error);

      logger.error(`Erro ao criar shipment (${status})`, {
        error: errorDetail,
        attempt: retryCount + 1,
        endpoint: `${this.baseURL}/ship/v1/shipments`
      });

      const debugDir = this._ensureDebugDir();
      fs.writeFileSync(path.join(debugDir, 'fedex_error_response.json'), JSON.stringify({
        status,
        error: fullErrorData || error.message,
        payload
      }, null, 2));

      if (status === 401 || status === 422) {
        logger.error(`Full Error Response (status ${status})`);
        console.error('Full Error Data:', JSON.stringify(fullErrorData, null, 2));
        console.error('\nPayload enviado:', JSON.stringify(payload, null, 2));
      }

      if (this._isRetryableError(status) && retryCount < this.maxRetries - 1) {
        logger.warn(`Retrying em ${this.retryDelay}ms...`);
        await this._delay(this.retryDelay);
        return this.createShipment(payload, retryCount + 1);
      }

      throw new Error(`Failed to create shipment: ${errorDetail}`);
    }
  }

  async getLabel(shipmentId, trackingNumber) {
    try {
      logger.log(`Obtendo label para shipment: ${shipmentId}`);

      const token = await fedexAuth.getToken();
      const response = await axios.post(
        `${this.baseURL}/ship/v1/shipments/${shipmentId}/labels`,
        {
          trackingNumber,
          shipmentDocumentSpecification: {
            types: ['LABEL']
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const labelData = response.data.output?.shipmentDocuments?.[0];
      logger.log('Label obtido com sucesso');

      return {
        success: true,
        labelFormat: labelData.documentType,
        labelContent: labelData.document,
        documentAckNumber: labelData.documentAckNumber
      };
    } catch (error) {
      logger.error('Erro ao obter label', error);
      throw new Error(`Failed to get label: ${error.message}`);
    }
  }

  async cancelShipment(shipmentId) {
    try {
      logger.log(`Cancelando shipment: ${shipmentId}`);

      const token = await fedexAuth.getToken();
      await axios.delete(`${this.baseURL}/ship/v1/shipments/${shipmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      logger.log('Shipment cancelado com sucesso');
      return { success: true };
    } catch (error) {
      logger.error('Erro ao cancelar shipment', error);
      throw new Error(`Failed to cancel shipment: ${error.message}`);
    }
  }

  _isRetryableError(status) {
    return status === 408 || status === 429 || status >= 500;
  }

  _extractErrorDetail(error) {
    const apiErrors = error.response?.data?.errors;

    if (Array.isArray(apiErrors) && apiErrors.length > 0) {
      return apiErrors
        .map(item => [item.code, item.message].filter(Boolean).join(': '))
        .join(' | ');
    }

    if (typeof error.response?.data?.message === 'string') {
      return error.response.data.message;
    }

    if (typeof error.response?.data?.error === 'string') {
      return error.response.data.error;
    }

    return error.message;
  }

  _ensureDebugDir() {
    const debugDir = path.join(__dirname, '../debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    return debugDir;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new FedexShipmentService();
