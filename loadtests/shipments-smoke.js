import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s'
};

export default function () {
  const payload = JSON.stringify({
    invoiceData: {
      invoiceNumber: `K6-${__VU}-${__ITER}`,
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

  const response = http.post('http://127.0.0.1:3000/shipments/payload', payload, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  check(response, {
    'status 202': res => res.status === 202,
    'retorna id': res => !!res.json('id'),
    'queueJob queued': res => res.json('queueJob.status') === 'queued'
  });

  sleep(1);
}
