# Guia de Testes - XML Converter

## 1️⃣ Executar Testes Unitários

```bash
# Rodar todos os testes
npm test

# Modo watch (reexecuta ao salvar arquivos)
npm run test:watch

# Ver cobertura de testes
npm run test:coverage
```

## 2️⃣ Testes Manuais com Node.js

### Teste 1: Validar XML contra XSD
```javascript
const XmlValidator = require('./src/validators/xmlValidator');
const fs = require('fs');

const xml = fs.readFileSync('./data/invoice.xml', 'utf-8');
const xsd = fs.readFileSync('./data/invoice.xsd', 'utf-8');

const result = XmlValidator.validate(xml, xsd);
console.log(result);
```

### Teste 2: Parser XML
```javascript
const XmlParser = require('./src/services/xmlParser');

const xmlContent = `<?xml version="1.0"?>
  <invoice>
    <number>001</number>
    <total>1000.00</total>
  </invoice>`;

XmlParser.parseXml(xmlContent).then(result => {
  console.log('Parsed:', result);
});
```

### Teste 3: Sanitizar Dados
```javascript
const DataSanitizer = require('./src/validators/dataSanitizer');

const data = {
  name: '  João Silva  ',
  email: '  joao@example.com  ',
  phone: '11987654321'
};

const sanitized = DataSanitizer.sanitize(data);
console.log('Sanitized:', sanitized);

console.log('Email valid:', DataSanitizer.validateEmail(sanitized.email));
console.log('Phone valid:', DataSanitizer.validatePhone(sanitized.phone));
```

### Teste 4: Cache de Token
```javascript
const TokenCache = require('./src/utils/tokenCache');

TokenCache.setToken('meu-token-fedex', 3600);
console.log('Token:', TokenCache.getToken());
console.log('Expirado:', TokenCache.isExpired());
```

## 3️⃣ Testar Linha por Linha no Node.js REPL

```bash
node
> const Logger = require('./src/utils/logger');
> Logger.log('Teste de log');
> Logger.error('Teste de erro');
> process.exit()
```

## 4️⃣ Testar a Aplicação Completa

```bash
npm start
```

## 5️⃣ Estrutura de Testes

```
tests/
├── xmlValidator.test.js      # Testes do validador
├── dataSanitizer.test.js     # Testes do sanitizador
├── tokenCache.test.js        # Testes do cache
└── buildPayload.test.js      # Testes do payload
```

## 6️⃣ Próximos Passos

1. ✅ Implementar testes de integração com FedEx API
2. ✅ Adicionar mocks para chamadas HTTP
3. ✅ Testar fluxo completo: XML → Validação → Parse → FedEx → Label
4. ✅ Coverage > 80%

## 7️⃣ Comandos Úteis

```bash
# Executar um teste específico
npm test -- xmlValidator.test.js

# Modo debug
node --inspect-brk node_modules/.bin/jest --runInBand

# Verificar quais testes passarem
npm test -- --verbose
```
