// Serviço para salvar labels e gerenciar arquivos de saída
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class LabelService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../output');
    this.ensureOutputDir();
  }

  /**
   * Garante que a pasta output existe
   */
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.log(`📁 Pasta output criada: ${this.outputDir}`);
    }
  }

  /**
   * Salva label em PDF a partir de base64
   */
  async saveLabelPDF(base64Content, shipmentId, invoiceNumber) {
    try {
      const fileName = `label_${invoiceNumber}_${shipmentId}.pdf`;
      const filePath = path.join(this.outputDir, fileName);

      // Converter base64 para buffer
      const buffer = Buffer.from(base64Content, 'base64');

      // Salvar arquivo
      fs.writeFileSync(filePath, buffer);

      logger.log(`✅ Label salvo: ${fileName}`);

      return {
        success: true,
        fileName,
        filePath,
        size: buffer.length
      };
    } catch (error) {
      logger.error('❌ Erro ao salvar label', error);
      throw new Error(`Failed to save label: ${error.message}`);
    }
  }

  /**
   * Salva label em PDF a partir de URL (baixando o arquivo)
   */
  async saveLabelPDFFromUrl(labelUrl, shipmentId, invoiceNumber) {
    try {
      const axios = require('axios');
      
      logger.log(`📥 Baixando label de: ${labelUrl}`);
      
      // Baixar o PDF da URL
      const response = await axios.get(labelUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const fileName = `label_${invoiceNumber}_${shipmentId}.pdf`;
      const filePath = path.join(this.outputDir, fileName);

      // Salvar arquivo
      fs.writeFileSync(filePath, response.data);

      logger.log(`✅ Label salvo: ${fileName}`);

      return {
        success: true,
        fileName,
        filePath,
        size: response.data.length,
        url: labelUrl
      };
    } catch (error) {
      logger.error('❌ Erro ao salvar label de URL', error);
      throw new Error(`Failed to download and save label: ${error.message}`);
    }
  }

  /**
   * Salva Commercial Invoice em PDF a partir de URL
   */
  async saveCommercialInvoice(invoiceUrl, shipmentId, invoiceNumber) {
    try {
      if (!invoiceUrl) {
        logger.warn('⚠️ Commercial Invoice URL não disponível');
        return null;
      }

      const axios = require('axios');
      
      logger.log(`📥 Baixando Commercial Invoice de: ${invoiceUrl}`);
      
      // Baixar o PDF da URL
      const response = await axios.get(invoiceUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const fileName = `invoice_${invoiceNumber}_${shipmentId}.pdf`;
      const filePath = path.join(this.outputDir, fileName);

      // Salvar arquivo
      fs.writeFileSync(filePath, response.data);

      logger.log(`✅ Commercial Invoice salvo: ${fileName}`);

      return {
        success: true,
        fileName,
        filePath,
        size: response.data.length,
        url: invoiceUrl
      };
    } catch (error) {
      logger.warn('⚠️ Aviso ao salvar Commercial Invoice', error.message);
      // Não lançar erro, apenas avisar pois a invoice é opcional
      return null;
    }
  }

  /**
   * Cria relatório de shipment em JSON
   */
  async createShipmentReport(invoiceData, shipmentResult, labelResult, invoiceResult) {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        invoiceNumber: invoiceData.invoiceNumber,
        shipmentId: shipmentResult.shipmentId,
        status: 'completed',
        shipper: {
          name: invoiceData.shipper.name,
          city: invoiceData.shipper.city
        },
        recipient: {
          name: invoiceData.recipient.name,
          city: invoiceData.recipient.city,
          country: invoiceData.recipient.countryCode
        },
        items: {
          count: invoiceData.items.length,
          totalWeight: invoiceData.items.reduce((sum, item) => 
            sum + (parseFloat(item.weight) * parseInt(item.quantity)), 0
          )
        },
        documents: {
          label: labelResult ? {
            fileName: labelResult.fileName,
            size: labelResult.size,
            url: labelResult.url
          } : null,
          commercialInvoice: invoiceResult ? {
            fileName: invoiceResult.fileName,
            size: invoiceResult.size,
            url: invoiceResult.url
          } : null
        },
        fedexResponse: shipmentResult.data
      };

      const fileName = `report_${invoiceData.invoiceNumber}.json`;
      const filePath = path.join(this.outputDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify(report, null, 2));

      logger.log(`✅ Relatório criado: ${fileName}`);
      return report;
    } catch (error) {
      logger.error('❌ Erro ao criar relatório', error);
      throw new Error(`Failed to create report: ${error.message}`);
    }
  }

  /**
   * Lista todos os labels salvos
   */
  listLabels() {
    try {
      const files = fs.readdirSync(this.outputDir);
      const labels = files
        .filter(f => f.endsWith('.pdf'))
        .map(f => ({
          fileName: f,
          path: path.join(this.outputDir, f),
          size: fs.statSync(path.join(this.outputDir, f)).size
        }));

      logger.log(`📋 Total de labels: ${labels.length}`);
      return labels;
    } catch (error) {
      logger.error('❌ Erro ao listar labels', error);
      return [];
    }
  }

  /**
   * Remove label antigo (cleanup)
   */
  deleteLabel(fileName) {
    try {
      const filePath = path.join(this.outputDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      fs.unlinkSync(filePath);
      logger.log(`🗑️  Label deletado: ${fileName}`);
      return { success: true };
    } catch (error) {
      logger.error('❌ Erro ao deletar label', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Exporta relatório de shipments para CSV
   */
  async exportShipmentsCSV() {
    try {
      const reports = fs.readdirSync(this.outputDir)
        .filter(f => f.startsWith('report_') && f.endsWith('.json'))
        .map(f => JSON.parse(
          fs.readFileSync(path.join(this.outputDir, f), 'utf-8')
        ));

      if (reports.length === 0) {
        logger.warn('⚠️  Nenhum relatório encontrado');
        return null;
      }

      // Construir CSV
      const headers = ['Timestamp', 'Invoice', 'ShipmentID', 'Shipper', 'Recipient', 'Items', 'Total Weight'];
      const rows = reports.map(r => [
        r.timestamp,
        r.invoiceNumber,
        r.shipmentId,
        r.shipper.name,
        r.recipient.name,
        r.items.count,
        r.items.totalWeight.toFixed(2)
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(col => `"${col}"`).join(','))
        .join('\n');

      const fileName = `shipments_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = path.join(this.outputDir, fileName);

      fs.writeFileSync(filePath, csv);

      logger.log(`✅ CSV exportado: ${fileName}`);
      return filePath;
    } catch (error) {
      logger.error('❌ Erro ao exportar CSV', error);
      throw new Error(`Failed to export CSV: ${error.message}`);
    }
  }
}

module.exports = new LabelService();
