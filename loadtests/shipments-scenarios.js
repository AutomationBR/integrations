import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    warmup: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'enqueuePayload'
    },
    peak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '30s', target: 0 }
      ],
      exec: 'enqueuePayload',
      startTime: '30s'
    },
    endurance: {
      executor: 'constant-vus',
      vus: 8,
      duration: '2m',
      exec: 'enqueuePayload',
      startTime: '2m'
    }
  }
};

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export function enqueuePayload() {
  const payload = JSON.stringify({
    invoiceData: {
      invoiceNumber: `K6-SCENARIO-${__VU}-${__ITER}`,
      shipper: {
        name: 'Empresa XYZ',
        street: 'Rua Teste',
        number: '123',
        city: 'Sao Paulo',
        state: 'SP',
        postalCode: '01234567',
        countryCode: 'BR',
        phone: '1133334444'
      },
      recipient: {
        name: 'John Smith',
        street: 'Main Street',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        phone: '12125551234'
      },
      items: [
        {
          description: 'Produto A',
          quantity: 1,
          unitPrice: 100,
          totalValue: 100,
          weight: 0.5,
          unit: 'EA',
          hsCode: '84713000'
        }
      ],
      totals: {
        total: 100,
        currency: 'USD'
      },
      isInternational: true
    }
  });

  const response = http.post(`${baseUrl}/shipments/payload`, payload, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  check(response, {
    'status 202': res => res.status === 202,
    'body has id': res => !!res.json('id'),
    'queue job created': res => !!res.json('queueJob.id')
  });

  sleep(1);
}
