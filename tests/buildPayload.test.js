const { buildFedexPayload, validatePayload } = require('../src/utils/buildPayload');

describe('buildPayload', () => {
  test('deve construir um payload válido para envio internacional', () => {
    const invoiceData = {
      invoiceNumber: '123456',
      shipper: {
        name: 'Empresa XYZ',
        street: 'Rua Teste',
        number: '123',
        city: 'Sao Paulo',
        state: 'SP',
        postalCode: '01234567',
        countryCode: 'BR',
        phone: '1133334444',
        tins: [
          {
          number: '10970887000102',
            tinType: 'BUSINESS_NATIONAL'
          }
        ]
      },
      recipient: {
        name: 'John Smith',
        street: 'Main Street',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        phone: '12125551234',
        tins: [
          {
            number: '12-3456789',
            tinType: 'BUSINESS_NATIONAL'
          }
        ]
      },
      items: [
        {
          description: 'Produto A',
          quantity: 2,
          unitPrice: 100,
          totalValue: 200,
          weight: 0.5,
          unit: 'EA',
          hsCode: '84713000'
        }
      ],
      totals: {
        total: 200,
        currency: 'USD'
      },
      isInternational: true
    };

    const payload = buildFedexPayload(invoiceData, '123456789');

    expect(payload.accountNumber.value).toBe('123456789');
    expect(payload.requestedShipment.shipper.contact.personName).toBe('Empresa XYZ');
    expect(payload.requestedShipment.recipients[0].contact.personName).toBe('John Smith');
    expect(payload.requestedShipment.customsClearanceDetail.commodities).toHaveLength(1);
    expect(validatePayload(payload)).toBe(true);
  });
});
