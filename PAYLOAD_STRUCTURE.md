# FedEx Shipment Payload - Campos Obrigatórios e Estrutura

## 📋 Resumo Executivo

O payload de shipment FedEx foi completamente estruturado com:
- ✅ Todos os campos obrigatórios do API FedEx
- ✅ Validação automática
- ✅ Suporte a envios internacionais
- ✅ Divisão automática de pacotes (limite 30kg)
- ✅ Tratamento de dimensões e peso

---

## 🏗️ Estrutura Completa do Payload

### 1. **Identificação da Remessa**
```javascript
{
  labelResponseOptions: "LABEL",           // Retorna label em base64
  accountNumber: { value: "SEU_ACCOUNT" }, // Sua conta FedEx
  
  requestedShipment: {
    shipDatestamp: "2026-04-07T...",      // Data/hora do envio
    pickupType: "SCHEDULED_PICKUP",        // Tipo de coleta
    serviceType: "INTERNATIONAL_PRIORITY", // Tipo de serviço
    packagingType: "YOUR_PACKAGING"        // Packaging próprio
  }
}
```

### 2. **Remetente (Shipper)** - OBRIGATÓRIO
```javascript
shipper: {
  contact: {
    personName: "Nome Completo",      // Obrigatório
    emailAddress: "email@example.com", // Obrigatório
    phoneNumber: "+5511987654321"      // Obrigatório
  },
  address: {
    streetLines: ["Rua Exemplo, 100"],    // Obrigatório
    city: "São Paulo",                    // Obrigatório
    stateOrProvinceCode: "SP",            // Obrigatório
    postalCode: "01234567",               // Obrigatório
    countryCode: "BR"                     // Obrigatório (ISO 2 dígitos)
  }
}
```

### 3. **Destinatário (Recipients)** - OBRIGATÓRIO
```javascript
recipients: [{
  contact: {
    personName: "Nome Receptor",      // Obrigatório
    emailAddress: "dest@example.com",  // Obrigatório
    phoneNumber: "+12125551234"        // Obrigatório
  },
  address: {
    streetLines: ["123 Main Street"],     // Obrigatório
    city: "New York",                     // Obrigatório
    stateOrProvinceCode: "NY",            // Obrigatório
    postalCode: "10001",                  // Obrigatório
    countryCode: "US"                     // Obrigatório
  }
}]
```

### 4. **Pacotes (Packages)** - OBRIGATÓRIO
```javascript
requestedPackageLineItems: [{
  sequenceNumber: 1,              // Número do pacote
  weight: {
    units: "KG",                  // Sempre em KG
    value: 2.5                    // Peso em kg (mín 0.1)
  },
  dimensions: {
    length: 20,                   // Comprimento em cm
    width: 15,                    // Largura em cm
    height: 10,                   // Altura em cm
    units: "CM"
  }
}]
```

### 5. **Itens (Commodities)** - Para Envios Internacionais
```javascript
customsClearanceDetail: {
  dutiesPayment: {
    paymentType: "SENDER"         // Remetente paga impostos
  },
  declarationStatementDescription: "Commercial Invoice",
  commodities: [{
    description: "Electronic Parts",       // Descrição (obrigatória)
    countryOfManufacture: "BR",            // País origem (obrigatório)
    harmonizedCode: "8471.30.00",          // Código HSCode (obrigatório)
    quantity: 2,                           // Quantidade (obrigatória)
    quantityUnits: "EA",                   // Unidade (EA=each)
    unitPrice: {
      amount: 150.00,                      // Preço unitário
      currency: "USD"
    },
    customsValue: {
      amount: 300.00,                      // Valor em alfândega
      currency: "USD"
    },
    weight: {
      units: "KG",
      value: 0.5                           // Peso unitário em kg
    }
  }]
}
```

### 6. **Pagamento de Taxas**
```javascript
shippingChargesPayment: {
  paymentType: "SENDER"  // Pode ser: SENDER, RECIPIENT, THIRD_PARTY
}
```

### 7. **Referências e Notas**
```javascript
references: [{
  referenceType: "INVOICE_NUMBER",
  value: "INV-001-2026"
}],

specialServicesRequested: {
  specialServiceTypes: ["SIGNATURE_OPTION"],
  signatureOptionDetail: {
    optionType: "ADULT"  // Assinatura de maior de idade
  }
}
```

---

## ✅ Validações Automáticas

A função `validatePayload()` verifica:
- ✓ accountNumber present
- ✓ shipper.address.countryCode
- ✓ recipients[0].address.countryCode
- ✓ requestedPackageLineItems não vazio

---

## 🔧 Como Usar

### Passo 1: Preparar dados do XML
```javascript
const invoiceData = {
  invoiceNumber: 'INV-001',
  isInternational: true,
  shipper: { /* dados do remetente */ },
  recipient: { /* dados do destinatário */ },
  items: [ /* itens */ ],
  totals: { currency: 'USD' }
};
```

### Passo 2: Construir payload
```javascript
const { buildFedexPayload, validatePayload } = require('./utils/buildPayload');

const payload = buildFedexPayload(invoiceData, 'YOUR_ACCOUNT_NUMBER');
validatePayload(payload);
```

### Passo 3: Enviar para FedEx
```javascript
const { createShipment } = require('./services/fedexShipment');
const response = await createShipment(token, payload);
console.log('Label URL:', response.output.transactionShipments[0].shipmentDocuments[0].documentProducerType);
```

---

## 🚀 Próximos Passos

1. **Integração com XML Parser**
   - [ ] Mapear campos XML para estrutura de invoiceData
   - [ ] Converter XML NF-e para formato aceito

2. **Autenticação FedEx**
   - [ ] Implementar OAuth2 para obter token
   - [ ] Cachear token com expiração

3. **Tratamento de Erros**
   - [ ] Retry automático
   - [ ] Log detalhado de erros
   - [ ] Fallback para erros de conexão

4. **Download de Labels**
   - [ ] Converter base64 para PDF
   - [ ] Salvar em ./output/
   - [ ] Enviar por email

---

## 📝 Referência Rápida

| Campo | Tipo | Tamanho | Obrigatório |
|-------|------|--------|------------|
| accountNumber | string | 9-12 dig | ✅ |
| shipper.name | string | 1-50 car | ✅ |
| shipper.postalCode | string | 1-15 car | ✅ |
| weight.value | decimal | 0.1-150 | ✅ |
| harmonizedCode | string | 10-20 dig | ✅ |

---

## 🔗 Links Úteis

- [FedEx API Documentation](https://developer.fedex.com)
- [HSCode Database](https://www.tariffdata.com)
- [ISO Country Codes](https://www.iso.org/obp/ui/#search)
