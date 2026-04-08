# 🚀 Implementação Completa - Todas as 4 Fases

## ✅ Fase 1: Integração XML → Payload

### Arquivo: `src/utils/nfeMapper.js`

**O que faz:**
- Converte XML NFe parseado para estrutura de `invoiceData`
- Extrai dados de remetente, destinatário, itens
- Extrai dimensões de produtos
- Valida dados mapeados

**Como usar:**
```javascript
const NFeMapper = require('./utils/nfeMapper');
const invoiceData = NFeMapper.mapNFeToInvoiceData(nfeData);
NFeMapper.validate(invoiceData); // Lança erro se inválido
```

---

## ✅ Fase 2: Autenticação FedEx

### Arquivo: `src/services/fedexAuth.js`

**O que faz:**
- Autenticação OAuth2 com FedEx
- Cache automático de token
- Reutilização de token válido
- Tratamento de erros com log

**Features:**
- ✅ Obtém token via credenciais
- ✅ Cacheia por expiração
- ✅ Retry automático em falhas
- ✅ Teste de autenticação

**Como usar:**
```javascript
const fedexAuth = require('./services/fedexAuth');

// Obter token (com cache automático)
const token = await fedexAuth.getToken();

// Testar autenticação
const result = await fedexAuth.testAuth();
```

---

## ✅ Fase 3: Envio Real para FedEx

### Arquivo: `src/services/fedexShipment.js`

**O que faz:**
- Cria shipment na FedEx
- Retry automático em erros temporários
- Obtém label em base64
- Cancela shipment se necessário

**Features:**
- ✅ Retry com backoff (máx 3 tentativas)
- ✅ Timeout de 30s
- ✅ Retry apenas para erros temporários (408, 429, 5xx)
- ✅ Log detalhado de cada etapa

**Como usar:**
```javascript
const fedexShipment = require('./services/fedexShipment');

// Criar shipment
const result = await fedexShipment.createShipment(payload);
// → { success: true, shipmentId, data }

// Obter label
const label = await fedexShipment.getLabel(shipmentId, trackingNumber);
// → { success: true, labelContent (base64) }

// Cancelar se necessário
await fedexShipment.cancelShipment(shipmentId);
```

---

## ✅ Fase 4: Saída - Labels e Relatórios

### Arquivo: `src/services/labelService.js`

**O que faz:**
- Salva label em PDF
- Cria relatórios JSON de shipment
- Exporta histórico em CSV
- Lista labels salvos
- Cleanup de arquivos

**Features:**
- ✅ Converte base64 → PDF
- ✅ Cria relatório estruturado
- ✅ Exporta CSV com histórico
- ✅ Gerencia pasta `output/`

**Como usar:**
```javascript
const labelService = require('./services/labelService');

// Salvar label
const saved = await labelService.saveLabelPDF(
  base64Content, 
  shipmentId, 
  invoiceNumber
);
// → { success: true, fileName, filePath, size }

// Criar relatório
const report = await labelService.createShipmentReport(
  invoiceData,
  shipmentResult,
  labelResult
);

// Listar labels
const labels = labelService.listLabels();

// Exportar CSV
await labelService.exportShipmentsCSV();

// Deletar label
labelService.deleteLabel('label_INV-001_12345.pdf');
```

---

## 🎯 Orquestrador - Integra Tudo

### Arquivo: `src/orchestrator.js`

**O que faz:**
Coordena todo fluxo end-to-end:
1. Parse XML → 2. Mapear → 3. Validar → 4. Autenticar → 5. Shipment → 6. Label → 7. Relatório

**Como usar:**
```javascript
const orchestrator = require('./orchestrator');

// Processar single NFe
const result = await orchestrator.processNFe('./data/invoice.xml');

// Processar batch
const results = await orchestrator.processBatch('./data/');
```

---

## 🚀 Main Entry Point

### Arquivo: `src/index.js`

**Uso:**
```bash
# Processar arquivo padrão (./data/invoice.xml)
npm start

# Processar arquivo específico
node src/index.js ./data/minha-nfe.xml

# Com logging detalhado
NODE_ENV=development npm start
```

---

## 📊 Fluxo Completo

```
XML NFe
  ↓
[NFeMapper] Parse & Extract
  ↓
invoiceData structure
  ↓
[buildFedexPayload] Construct Payload
  ↓
FedEx Payload
  ↓
[fedexAuth] Get OAuth Token
  ↓
[fedexShipment] Create Shipment (with retry)
  ↓
shipmentId + tracking
  ↓
[fedexShipment.getLabel()] Fetch Label (base64)
  ↓
[labelService.saveLabelPDF()] Save as PDF
  ↓
[labelService.createReport()] Generate Report
  ↓
output/ folder
  ├── label_INV-001_12345.pdf
  ├── report_INV-001.json
  └── shipments_2026-04-07.csv
```

---

## ⚙️ Variáveis de Ambiente Necessárias

```env
# FedEx API
FEDEX_API_KEY=seu_client_id
FEDEX_API_SECRET=seu_client_secret
FEDEX_ACCOUNT_NUMBER=seu_account_number
FEDEX_BASE_URL=https://apis.fedex.com

# Logger
NODE_ENV=development  # para debug
```

---

## 🧪 Exemplos de Uso

### Exemplo 1: Usar Orquestrador
```javascript
const orchestrator = require('./orchestrator');

(async () => {
  const result = await orchestrator.processNFe('./data/invoice.xml');
  console.log(result);
})();
```

### Exemplo 2: Processar em Lote
```javascript
const orchestrator = require('./orchestrator');

(async () => {
  const results = await orchestrator.processBatch('./data/');
  results.forEach(r => {
    console.log(`${r.invoiceNumber}: ${r.success ? '✅' : '❌'}`);
  });
})();
```

### Exemplo 3: Usar Componentes Individuais
```javascript
const { buildFedexPayload, validatePayload } = require('./utils/buildPayload');
const fedexShipment = require('./services/fedexShipment');
const labelService = require('./services/labelService');

// Seus dados
const invoiceData = { /* ... */ };

// Montar payload
const payload = buildFedexPayload(invoiceData, 'ACCOUNT123');
validatePayload(payload);

// Enviar
const shipment = await fedexShipment.createShipment(payload);

// Obter label
const label = await fedexShipment.getLabel(
  shipment.shipmentId,
  shipment.data.output.transactionShipments[0].masterTrackingNumber
);

// Salvar
await labelService.saveLabelPDF(
  label.labelContent,
  shipment.shipmentId,
  invoiceData.invoiceNumber
);
```

---

## 📝 Estrutura Final

```
xml_converter/
├── src/
│   ├── config/fedex.js
│   ├── services/
│   │   ├── fedexAuth.js          ✅ Novo
│   │   ├── fedexShipment.js       ✅ Melhorado
│   │   ├── labelService.js        ✅ Novo
│   │   └── xmlParser.js
│   ├── utils/
│   │   ├── buildPayload.js        ✅ Melhorado
│   │   ├── nfeMapper.js           ✅ Novo
│   │   ├── tokenCache.js
│   │   └── logger.js
│   ├── validators/
│   │   ├── xmlValidator.js
│   │   └── dataSanitizer.js
│   ├── examples/
│   │   └── payloadExample.js
│   ├── orchestrator.js            ✅ Novo
│   └── index.js                   ✅ Melhorado
├── data/
├── output/                        ← Labels e relatórios aqui
├── tests/
├── package.json
└── .env
```

---

## ✨ Próximos Passos (Melhorias Futuras)

- [ ] Suporte a múltiplos destinatários
- [ ] Scheduling de shipments
- [ ] Webhook para atualizações de status
- [ ] Dashboard de shipments
- [ ] API REST para integração
- [ ] Banco de dados para histórico
