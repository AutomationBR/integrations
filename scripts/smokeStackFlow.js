require('dotenv').config();

const http = require('http');
const https = require('https');

const API_BASE_URL = process.env.SMOKE_API_BASE_URL || 'http://127.0.0.1:3000';
const POLL_INTERVAL_MS = Number(process.env.SMOKE_POLL_INTERVAL_MS || 1000);
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
const EXPECT_STATUS = process.env.SMOKE_EXPECT_STATUS || 'any_terminal';
const OPS_API_TOKEN = process.env.OPS_API_TOKEN || null;

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'retry_scheduled', 'cancelled']);

function buildRequestOptions(url, method, body = null, extraHeaders = {}) {
  const parsed = new URL(url);
  const headers = {
    ...extraHeaders
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  if (OPS_API_TOKEN) {
    headers.Authorization = `Bearer ${OPS_API_TOKEN}`;
  }

  return {
    client: parsed.protocol === 'https:' ? https : http,
    options: {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method,
      headers
    }
  };
}

function requestJson(url, method, payload = null, extraHeaders = {}) {
  const body = payload ? JSON.stringify(payload) : null;
  const { client, options } = buildRequestOptions(url, method, body, extraHeaders);

  return new Promise((resolve, reject) => {
    const req = client.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        let parsed = null;

        if (data) {
          try {
            parsed = JSON.parse(data);
          } catch (error) {
            reject(new Error(`Resposta invalida de ${url}: ${data}`));
            return;
          }
        }

        resolve({
          statusCode: res.statusCode,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

function buildSmokePayload() {
  const suffix = Date.now();

  return {
    invoiceData: {
      invoiceNumber: `SMOKE-${suffix}`,
      shipper: {
        name: 'Empresa Smoke Test',
        street: 'Rua Teste',
        number: '100',
        city: 'Sao Paulo',
        state: 'SP',
        postalCode: '01000000',
        countryCode: 'BR',
        phone: '1133334444'
      },
      recipient: {
        name: 'Smoke Receiver',
        street: 'Main Street',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        phone: '12125551234'
      },
      items: [
        {
          description: 'Smoke Test Item',
          quantity: 1,
          unitPrice: 10,
          totalValue: 10,
          weight: 0.5,
          unit: 'EA',
          hsCode: '84713000'
        }
      ],
      totals: {
        total: 10,
        currency: 'USD'
      },
      isInternational: true
    }
  };
}

function isExpectedTerminalStatus(status) {
  if (EXPECT_STATUS === 'any_terminal') {
    return TERMINAL_STATUSES.has(status);
  }

  return status === EXPECT_STATUS;
}

async function waitForShipment(shipmentId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const response = await requestJson(`${API_BASE_URL}/shipments/${shipmentId}`, 'GET');

    if (response.statusCode !== 200) {
      throw new Error(`Falha ao consultar shipment ${shipmentId}: HTTP ${response.statusCode}`);
    }

    const shipment = response.body;
    console.log(`Status atual: ${shipment.status}`);

    if (TERMINAL_STATUSES.has(shipment.status)) {
      if (!isExpectedTerminalStatus(shipment.status)) {
        throw new Error(`Status terminal inesperado: ${shipment.status} (esperado: ${EXPECT_STATUS})`);
      }

      return shipment;
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timeout aguardando shipment ${shipmentId} apos ${TIMEOUT_MS}ms`);
}

async function main() {
  console.log(`Validando API em ${API_BASE_URL}...`);
  const health = await requestJson(`${API_BASE_URL}/health`, 'GET');

  if (health.statusCode !== 200) {
    throw new Error(`Healthcheck falhou com HTTP ${health.statusCode}`);
  }

  console.log('API respondeu ao healthcheck.');
  console.log('Enviando shipment de smoke test...');

  const correlationId = `smoke-${Date.now()}`;
  const created = await requestJson(
    `${API_BASE_URL}/shipments/payload`,
    'POST',
    buildSmokePayload(),
    { 'X-Correlation-Id': correlationId }
  );

  if (created.statusCode !== 202) {
    throw new Error(`Falha ao criar shipment de smoke test: HTTP ${created.statusCode}`);
  }

  console.log(`Shipment criado: ${created.body.id}`);
  console.log(`CorrelationId: ${created.body.correlationId}`);

  const shipment = await waitForShipment(created.body.id);

  console.log('Smoke test concluido.');
  console.log(JSON.stringify({
    shipmentId: shipment.id,
    correlationId: shipment.correlationId,
    status: shipment.status,
    error: shipment.error || null,
    trackingNumber: shipment.result?.trackingNumber || null
  }, null, 2));
}

main().catch(error => {
  console.error('Smoke test falhou:', error.message);
  process.exit(1);
});
