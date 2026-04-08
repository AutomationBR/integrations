# XML Converter

Conversor de notas fiscais XML para integracao com a FedEx.

## Instalacao

```bash
npm install
```

Para ativar PostgreSQL depois, instale tambem:

```bash
npm install pg
```

Para rodar carga local, instale o `k6` no seu ambiente.

## Variaveis de ambiente

Configure o arquivo `.env` com:

```env
FEDEX_BASE_URL=https://apis-sandbox.fedex.com
FEDEX_ACCOUNT_NUMBER=...
FEDEX_API_KEY=...
FEDEX_API_SECRET=...
# Opcional para PostgreSQL
# DATABASE_URL=postgres://usuario:senha@localhost:5432/xml_converter
# Opcional para proteger endpoints operacionais
# OPS_API_TOKEN=change_me
```

Voce pode usar o arquivo [`.env.example`](c:/Projetos/xml_converter/.env.example) como base.

## PostgreSQL opcional

O projeto agora suporta dois modos de persistencia:

- arquivo JSON por padrao
- PostgreSQL quando `DATABASE_URL` estiver configurada e o pacote `pg` estiver disponivel

Schema SQL inicial:

- [schema.sql](c:/Projetos/xml_converter/sql/schema.sql)

Comando para aplicar o schema:

```bash
npm run db:init
```

Comando para rodar a integracao real com PostgreSQL:

```bash
PG_INTEGRATION=1 npm run test:integration:pg
PG_INTEGRATION=1 npm run test:integration:flow
```

No PowerShell:

```powershell
$env:PG_INTEGRATION="1"; npm run test:integration:pg
$env:PG_INTEGRATION="1"; npm run test:integration:flow
```

Se `DATABASE_URL` estiver ausente, ou se o driver `pg` nao estiver instalado, o sistema faz fallback automatico para os arquivos em `storage/`.

Checklist para ativar PostgreSQL:

1. Instale o driver: `npm install pg`
2. Suba o banco com [docker-compose.yml](c:/Projetos/xml_converter/docker-compose.yml) ou use um PostgreSQL existente
3. Ajuste `DATABASE_URL` no `.env`
4. Verifique conexao com `npm run db:check`
5. Rode `npm run db:init`
6. Suba a API: `npm run start:api`
7. Suba o worker: `npm run start:worker`
8. Rode a integracao real com `PG_INTEGRATION=1 npm run test:integration:pg`
9. Rode o smoke flow com `PG_INTEGRATION=1 npm run test:integration:flow`

Com Docker Compose:

```bash
docker compose up -d
```

## Uso CLI

Processar o XML padrao:

```bash
npm start
```

Processar um XML especifico:

```bash
node src/index.js ./data/invoice.xml
```

## Uso API

Subir a API HTTP local:

```bash
npm run start:api
```

Subir o worker que consome a fila:

```bash
npm run start:worker
```

Rotas disponiveis:

- `GET /health`
- `GET /ops/status`
- `GET /metrics`
- `GET /shipments`
- `GET /shipments/:id`
- `GET /queue/jobs`
- `GET /dead-letter`
- `POST /shipments/xml`
- `POST /shipments/payload`
- `POST /shipments/:id/requeue`
- `POST /queue/jobs/:id/cancel`
- `POST /dead-letter/:id/replay`

Se `OPS_API_TOKEN` estiver configurado, estas rotas exigem:

- `GET /ops/status`
- `GET /metrics`
- `GET /queue/jobs`
- `GET /dead-letter`
- `POST /shipments/:id/requeue`
- `POST /queue/jobs/:id/cancel`
- `POST /dead-letter/:id/replay`

Exemplo com token:

```bash
curl -H "Authorization: Bearer change_me" http://localhost:3000/ops/status
```

Exemplo para enfileirar um XML:

```bash
curl -X POST http://localhost:3000/shipments/xml ^
  -H "Content-Type: application/json" ^
  -d "{\"xmlPath\":\"./data/invoice.xml\"}"
```

Exemplo para enfileirar um payload:

```bash
curl -X POST http://localhost:3000/shipments/payload ^
  -H "Content-Type: application/json" ^
  -d "{\"invoiceData\":{\"invoiceNumber\":\"TEST-1\",\"shipper\":{\"name\":\"Empresa\",\"street\":\"Rua A\",\"number\":\"1\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"postalCode\":\"01000000\",\"countryCode\":\"BR\",\"phone\":\"1133334444\"},\"recipient\":{\"name\":\"John Smith\",\"street\":\"Main Street\",\"city\":\"New York\",\"state\":\"NY\",\"postalCode\":\"10001\",\"countryCode\":\"US\",\"phone\":\"12125551234\"},\"items\":[{\"description\":\"Produto\",\"quantity\":1,\"unitPrice\":100,\"totalValue\":100,\"weight\":0.5,\"unit\":\"EA\",\"hsCode\":\"84713000\"}],\"totals\":{\"total\":100,\"currency\":\"USD\"},\"isInternational\":true}}"
```

Consultar status:

```bash
curl http://localhost:3000/shipments/<id>
```

Listar shipments com paginacao e filtro:

```bash
curl "http://localhost:3000/shipments?page=1&limit=10&status=queued"
curl "http://localhost:3000/shipments?correlationId=meu-id-123"
curl "http://localhost:3000/shipments?createdFrom=2026-04-07T00:00:00.000Z&sortBy=createdAt&order=asc"
```

Consultar status operacional:

```bash
curl http://localhost:3000/ops/status
```

Smoke test operacional da stack ja em execucao:

```bash
npm run smoke:stack
```

No PowerShell:

```powershell
npm run smoke:stack
```

Consultar metricas Prometheus:

```bash
curl http://localhost:3000/metrics
```

Consultar falhas definitivas:

```bash
curl http://localhost:3000/dead-letter
```

Listar fila com filtros:

```bash
curl "http://localhost:3000/queue/jobs?page=1&limit=20&status=retry_scheduled"
curl "http://localhost:3000/queue/jobs?sortBy=correlationId&order=asc"
```

Listar dead-letter com filtros:

```bash
curl "http://localhost:3000/dead-letter?correlationId=meu-id-123"
curl "http://localhost:3000/dead-letter?createdFrom=2026-04-07T00:00:00.000Z"
```

Reenfileirar um shipment:

```bash
curl -X POST http://localhost:3000/shipments/<id>/requeue
```

Cancelar um job pendente:

```bash
curl -X POST http://localhost:3000/queue/jobs/<id>/cancel
```

Reprocessar item da dead-letter:

```bash
curl -X POST http://localhost:3000/dead-letter/<id>/replay
```

Os registros de shipment ficam em `storage/shipments.json` e a fila fica em `storage/jobs.json`, entao o estado sobrevive ao restart da API e do worker.

## Teste de carga

Script inicial de smoke test com `k6`:

- [shipments-smoke.js](c:/Projetos/xml_converter/loadtests/shipments-smoke.js)
- [shipments-scenarios.js](c:/Projetos/xml_converter/loadtests/shipments-scenarios.js)

Uso:

```bash
k6 run loadtests/shipments-smoke.js
```

Para um teste mais realista com warmup, pico e endurance:

```bash
k6 run loadtests/shipments-scenarios.js
```

Antes disso, suba:

```bash
npm run start:api
npm run start:worker
```

## Testes de integracao PostgreSQL

A suite [pgIntegration.test.js](c:/Projetos/xml_converter/tests/pgIntegration.test.js) valida os adapters reais do PostgreSQL e a fabrica de repositorios.
A suite [pgApiWorkerFlow.test.js](c:/Projetos/xml_converter/tests/pgApiWorkerFlow.test.js) valida o fluxo completo `API + fila + worker + PostgreSQL`.

Ela e opt-in para nao quebrar o ambiente local quando o banco nao estiver ativo. Para rodar:

```bash
docker compose up -d postgres
npm run db:check
npm run db:init
PG_INTEGRATION=1 npm run test:integration:pg
PG_INTEGRATION=1 npm run test:integration:flow
```

No PowerShell:

```powershell
docker compose up -d postgres
npm run db:check
npm run db:init
$env:PG_INTEGRATION="1"; npm run test:integration:pg
$env:PG_INTEGRATION="1"; npm run test:integration:flow
```

## Observabilidade

Logs estruturados opcionais:

```env
LOG_FORMAT=json
```

Controle de retry do worker:

```env
WORKER_MAX_ATTEMPTS=3
WORKER_RETRY_BASE_MS=5000
```

O worker agora reprograma jobs falhos com backoff linear simples antes de marcar falha final.
Quando as tentativas se esgotam, o job vai para a dead-letter queue persistida em `storage/dead-letters.json`.

Observabilidade externa opcional:

- [docker-compose.observability.yml](c:/Projetos/xml_converter/docker-compose.observability.yml)
- [prometheus.yml](c:/Projetos/xml_converter/ops/prometheus/prometheus.yml)
- [xml-converter-overview.json](c:/Projetos/xml_converter/ops/grafana/provisioning/dashboards/json/xml-converter-overview.json)

Subir Prometheus + Grafana:

```bash
docker compose -f docker-compose.observability.yml up -d
```

Com a API local rodando em `http://127.0.0.1:3000`, o Prometheus faz scrape de `host.docker.internal:3000/metrics`.

Painis:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

Credenciais padrao do Grafana:

```env
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

## Smoke test operacional

O script [smokeStackFlow.js](c:/Projetos/xml_converter/scripts/smokeStackFlow.js) valida uma stack ja em execucao falando com a API real, criando um shipment de teste e acompanhando o status ate um estado terminal.

Por padrao ele aceita qualquer estado terminal:

- `completed`
- `failed`
- `retry_scheduled`
- `cancelled`

Isso e util para o sandbox da FedEx, onde a infraestrutura pode estar correta mesmo quando a conta de teste ou o payload ainda geram erro de negocio.

Uso basico:

```bash
npm run start:api
npm run start:worker
npm run smoke:stack
```

Se a stack estiver em Docker:

```bash
docker compose up -d --build
docker compose exec api npm run db:init
npm run smoke:stack
```

Variaveis uteis:

```env
SMOKE_API_BASE_URL=http://127.0.0.1:3000
SMOKE_TIMEOUT_MS=30000
SMOKE_POLL_INTERVAL_MS=1000
SMOKE_EXPECT_STATUS=any_terminal
```

Se voce quiser exigir sucesso completo do fluxo:

```powershell
$env:SMOKE_EXPECT_STATUS="completed"; npm run smoke:stack
```

## Stack completa com Docker

Arquivos:

- [Dockerfile](c:/Projetos/xml_converter/Dockerfile)
- [docker-compose.yml](c:/Projetos/xml_converter/docker-compose.yml)

Subir PostgreSQL + API + worker:

```bash
docker compose up -d --build
```

Depois aplique o schema:

```bash
docker compose exec api npm run db:init
```

## Fluxo

1. Ler XML ou payload.
2. Registrar shipment com status `queued`.
3. Enfileirar job persistido em disco.
4. Worker consome a fila e processa XML ou payload.
5. Construir e validar o payload da FedEx.
6. Autenticar no sandbox.
7. Criar o shipment.
8. Baixar label e invoice quando disponiveis.
9. Salvar relatorio em `output/`.
# api
# api
