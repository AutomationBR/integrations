#!/usr/bin/env node

/**
 * QUICK START - Teste rápido da implementação
 * 
 * Este script testa cada fase de forma isolada
 * Execute com: node src/quickstart.js
 */

require('dotenv').config();
const logger = require('./utils/logger');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function print(phase, message, success = true) {
  const symbol = success ? '✅' : '❌';
  const color = success ? colors.green : colors.red;
  console.log(`${color}${symbol} [${phase}] ${message}${colors.reset}`);
}

async function quickStart() {
  console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  XML CONVERTER - QUICK START TEST${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

  try {
    // ====== FASE 1: Imports ======
    print('IMPORT', 'Carregando módulos...');
    
    const NFeMapper = require('./utils/nfeMapper');
    const { buildFedexPayload, validatePayload } = require('./utils/buildPayload');
    const fedexAuth = require('./services/fedexAuth');
    const labelService = require('./services/labelService');
    
    print('IMPORT', 'Todos os módulos carregados', true);

    // ====== FASE 2: Config Check ======
    console.log(`\n${colors.yellow}FASE 1: Verificação de Configuração${colors.reset}`);
    
    const checks = [
      { key: 'FEDEX_API_KEY', value: process.env.FEDEX_API_KEY },
      { key: 'FEDEX_API_SECRET', value: process.env.FEDEX_API_SECRET },
      { key: 'FEDEX_ACCOUNT_NUMBER', value: process.env.FEDEX_ACCOUNT_NUMBER },
      { key: 'FEDEX_BASE_URL', value: process.env.FEDEX_BASE_URL }
    ];

    checks.forEach(check => {
      const exists = !!check.value;
      const status = exists ? `✅ ${check.value.substring(0, 10)}...` : '❌ Não configurado';
      console.log(`  ${check.key}: ${status}`);
    });

    if (!checks.every(c => c.value)) {
      print('CONFIG', 'Configure .env com dados FedEx', false);
      console.log('\nExemplo .env:\n');
      console.log('FEDEX_API_KEY=seu_api_key');
      console.log('FEDEX_API_SECRET=seu_secret');
      console.log('FEDEX_ACCOUNT_NUMBER=seu_account');
      console.log('FEDEX_BASE_URL=https://apis.fedex.com\n');
      process.exit(1);
    }
    print('CONFIG', 'Todas as variáveis configuradas', true);

    // ====== FASE 3: NFeMapper Test ======
    console.log(`\n${colors.yellow}FASE 2: Test NFe Mapper${colors.reset}`);
    
    const testData = {
      nfeProc: {
        NFe: [{
          infNFe: [{
            ide: [{ serie: ['1'], nNF: ['001'] }],
            emit: [{
              xNome: ['Empresa Exportadora LTDA'],
              enderEmit: [{
                xLgr: ['Rua Teste'],
                nro: ['100'],
                xMun: ['São Paulo'],
                UF: ['SP'],
                CEP: ['01234567']
              }],
              IE: ['123456789']
            }],
            dest: [{
              xNome: ['Destinatário Exterior'],
              enderDest: [{
                xLgr: ['Main Street'],
                nro: ['123'],
                xMun: ['New York'],
                UF: ['NY'],
                CEP: ['10001']
              }]
            }],
            det: [{
              prod: [{
                xProd: ['Produto Teste'],
                quantity: ['2'],
                uCom: ['EA'],
                vUnCom: ['100.00'],
                vItem: ['200.00'],
                NCM: ['8471.30.00'],
                masaLiqui: ['0.5']
              }]
            }],
            total: [{
              ICMSTot: [{
                vSubtot: ['200.00'],
                vICMS: ['0.00'],
                vNF: ['200.00']
              }]
            }]
          }]
        }]
      }
    };

    try {
      const invoiceData = NFeMapper.mapNFeToInvoiceData(testData);
      NFeMapper.validate(invoiceData);
      print('MAPPER', `Invoice mapeado: ${invoiceData.invoiceNumber}`, true);
    } catch (error) {
      print('MAPPER', error.message, false);
    }

    // ====== FASE 4: Payload Builder Test ======
    console.log(`\n${colors.yellow}FASE 3: Test Payload Builder${colors.reset}`);
    
    const sampleData = {
      invoiceNumber: 'TEST-001',
      isInternational: true,
      shipper: {
        name: 'Empresa Exportadora',
        street: 'Rua Teste',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01234567',
        countryCode: 'BR',
        email: 'export@company.com',
        phone: '+5511987654321'
      },
      recipient: {
        name: 'International Buyer',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        email: 'buyer@buyer.com',
        phone: '+12125551234'
      },
      items: [{
        description: 'Test Product',
        quantity: 1,
        weight: 0.5,
        unit: 'EA',
        unitPrice: 100,
        totalValue: 100
      }],
      totals: { currency: 'USD' }
    };

    try {
      const payload = buildFedexPayload(sampleData, 'TEST123456');
      validatePayload(payload);
      print('PAYLOAD', 'Payload FedEx válido', true);
      console.log(`  Remetente: ${payload.requestedShipment.shipper.contact.personName}`);
      console.log(`  Destinatário: ${payload.requestedShipment.recipients[0].contact.personName}`);
      console.log(`  Pacotes: ${payload.requestedShipment.requestedPackageLineItems.length}`);
    } catch (error) {
      print('PAYLOAD', error.message, false);
    }

    // ====== FASE 5: Auth Test ======
    console.log(`\n${colors.yellow}FASE 4: Test Autenticação FedEx${colors.reset}`);
    
    try {
      const authResult = await fedexAuth.testAuth();
      if (authResult.authenticated) {
        print('AUTH', 'Autenticação FedEx OK', true);
      } else {
        print('AUTH', `Erro: ${authResult.error}`, false);
      }
    } catch (error) {
      print('AUTH', 'Erro ao testar auth: ' + error.message, false);
    }

    // ====== FASE 6: Output Check ======
    console.log(`\n${colors.yellow}FASE 5: Test Output Service${colors.reset}`);
    
    try {
      const labels = labelService.listLabels();
      print('OUTPUT', `${labels.length} labels encontrados`, true);
      console.log(`  Pasta: ${require('path').join(__dirname, '../output')}`);
    } catch (error) {
      print('OUTPUT', 'Erro: ' + error.message, false);
    }

    // ====== RESULTADO ======
    console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✅ QUICK START COMPLETO!${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);
    
    console.log('Próximos passos:');
    console.log('  1. npm start                          # Processar NFe');
    console.log('  2. node src/orchestrator.js           # Testar orquestrador');
    console.log('  3. npm test                           # Rodar testes\n');

  } catch (error) {
    print('FATAL', error.message, false);
    process.exit(1);
  }
}

if (require.main === module) {
  quickStart();
}

module.exports = { quickStart };
