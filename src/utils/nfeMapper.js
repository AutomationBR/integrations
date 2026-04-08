// Mapper para converter XML NFe parseado para estrutura de invoiceData
const logger = require('./logger');

class NFeMapper {
  /**
   * Converte dados parseados de XML NF-e para formato de payload FedEx
   * @param {Object} nfeData - Dados parseados do XML NFe
   * @returns {Object} invoiceData formatado para buildFedexPayload
   */
  static mapNFeToInvoiceData(nfeData) {
    try {
      // Extrair dados principais
      const ide = nfeData.nfeProc.NFe[0].infNFe[0].ide[0];
      const emit = nfeData.nfeProc.NFe[0].infNFe[0].emit[0];
      const dest = nfeData.nfeProc.NFe[0].infNFe[0].dest[0];
      const det = nfeData.nfeProc.NFe[0].infNFe[0].det || [];
      const total = nfeData.nfeProc.NFe[0].infNFe[0].total[0];
      const transp = nfeData.nfeProc.NFe[0].infNFe[0].transp?.[0];

      // Número da nota
      const invoiceNumber = `${ide.serie[0]}-${ide.nNF[0]}`;

      // Remetente
      const shipper = this._extractAddress(emit, true);

      // Destinatário
      const recipient = this._extractAddress(dest, false);

      // Itens
      const items = det.map((item, index) => {
        const prod = item.prod?.[0] || {};
        const infAdProd = item.infAdProd?.[0] || '';

        return {
          description: prod.xProd?.[0] || 'Product',
          quantity: parseInt(prod.qCom?.[0] || '1') || 1,
          weight: parseFloat(prod.masaLiqui?.[0] || '0.1') || 0.1,
          unit: prod.uCom?.[0] || 'EA',
          unitPrice: parseFloat(prod.vUnCom?.[0] || '0') || 0,
          totalValue: parseFloat(prod.vItem?.[0] || '0') || 0,
          countryOfOrigin: 'BR',
          hsCode: prod.NCM?.[0] || '0000000000',
          // Extrair dimensões se disponíveis
          dimensions: this._extractDimensions(prod)
        };
      });

      // Totais
      const totals = {
        subtotal: parseFloat(total.ICMSTot?.[0]?.vSubtot?.[0] || 0),
        icms: parseFloat(total.ICMSTot?.[0]?.vICMS?.[0] || 0),
        tax: parseFloat(total.ICMSTot?.[0]?.vICMS?.[0] || 0),
        total: parseFloat(total.ICMSTot?.[0]?.vNF?.[0] || 0),
        currency: 'USD' // Use USD for international shipments
      };

      // Determinar se é internacional
      const isInternational = dest.CNPJ || dest.CPF ? false : true;

      const invoiceData = {
        invoiceNumber,
        isInternational,
        shipper,
        recipient,
        items,
        totals
      };

      logger.log(`✅ NFe mapeada com sucesso: ${invoiceNumber}`);
      return invoiceData;
    } catch (error) {
      logger.error('Erro ao mapear NFe', error);
      throw new Error(`Falha ao mapear NFe: ${error.message}`);
    }
  }

  /**
   * Extrai dados de endereço do XML
   */
  static _extractAddress(entity, isShipper = false) {
    const endereco = isShipper ? entity.enderEmit?.[0] : entity.enderDest?.[0];
    const contato = entity.infIntermed?.[0] || {};
    
    let state = endereco?.UF?.[0] || '';
    const city = endereco?.xMun?.[0] || '';
    
    // Mapeamento de cidades para códigos de estado (especialmente para EUA)
    const cityToStateMapping = {
      'NEW YORK': 'NY',
      'LOS ANGELES': 'CA',
      'CHICAGO': 'IL',
      'HOUSTON': 'TX',
      'PHOENIX': 'AZ',
      'PHILADELPHIA': 'PA',
      'SAN ANTONIO': 'TX',
      'SAN DIEGO': 'CA',
      'DALLAS': 'TX',
      'SAN JOSE': 'CA',
      'AUSTIN': 'TX',
      'JACKSONVILLE': 'FL',
      'FORT WORTH': 'TX',
      'COLUMBUS': 'OH',
      'AUSTIN': 'TX',
      'CHARLOTTE': 'NC',
      'SAN FRANCISCO': 'CA',
      'INDIANAPOLIS': 'IN',
      'SEATTLE': 'WA',
      'DENVER': 'CO',
      'WASHINGTON': 'DC',
      'BOSTON': 'MA',
      'MIAMI': 'FL',
      'ATLANTA': 'GA',
      'DETROIT': 'MI',
      'NEW ORLEANS': 'LA',
      'MINNEAPOLIS': 'MN',
      'PORTLAND': 'OR',
      'MEMPHIS': 'TN',
      'TORONTO': 'ON',
      'VANCOUVER': 'BC',
      'MEXICO CITY': 'CDMX'
    };
    
    // If it's international (not shipper) and no state code provided
    if (!isShipper && !state) {
      // Try to map city name to state code
      const cityUpper = city.toUpperCase();
      if (cityToStateMapping[cityUpper]) {
        state = cityToStateMapping[cityUpper];
      } else if (city.length > 2) {
        // Use first 2 letters of city as fallback
        state = city.substring(0, 2).toUpperCase();
      } else {
        // Default state based on country
        state = 'NY'; // Default to NY for US
      }
    } else if (!isShipper && state.length > 2) {
      // If state is a full name, map it
      const stateUpper = state.toUpperCase();
      if (cityToStateMapping[stateUpper]) {
        state = cityToStateMapping[stateUpper];
      } else {
        state = state.substring(0, 2).toUpperCase();
      }
    } else if (isShipper) {
      // For shipper, keep as is (should be BR state code)
      state = state || 'SP';
    }

    return {
      name: entity.xNome[0] || 'Not Provided',
      street: endereco?.xLgr?.[0] || '',
      number: endereco?.nro?.[0] || '',
      complement: endereco?.xCpl?.[0] || '',
      city: city || '',
      state: state,
      postalCode: endereco?.CEP?.[0]?.replace(/\D/g, '') || '',
      countryCode: isShipper ? 'BR' : 'US', // Assume outro país para destinatário
      email: contato.email?.[0] || '',
      phone: contato.fone?.[0]?.replace(/\D/g, '') || ''
    };
  }

  /**
   * Extrai dimensões do produto (se disponível)
   */
  static _extractDimensions(prod) {
    const xDime = prod.xDime?.[0];
    if (!xDime) {
      return {
        length: 10,
        width: 10,
        height: 10
      };
    }

    // Parse de string "L x W x H" se necessário
    const dims = xDime.split('x').map(d => parseFloat(d.trim()));
    return {
      length: dims[0] || 10,
      width: dims[1] || 10,
      height: dims[2] || 10
    };
  }

  /**
   * Valida se os dados mapeados estão completos
   */
  static validate(invoiceData) {
    const errors = [];

    if (!invoiceData.invoiceNumber) errors.push('invoiceNumber is required');
    if (!invoiceData.shipper?.name) errors.push('shipper.name is required');
    if (!invoiceData.shipper?.postalCode) errors.push('shipper.postalCode is required');
    if (!invoiceData.recipient?.name) errors.push('recipient.name is required');
    if (!invoiceData.items || invoiceData.items.length === 0) errors.push('items is required');

    if (errors.length > 0) {
      throw new Error('Invalid mapped data: ' + errors.join('; '));
    }

    return true;
  }
}

module.exports = NFeMapper;
