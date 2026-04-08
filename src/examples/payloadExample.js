// Exemplo de uso da construção de payload
const { buildFedexPayload, validatePayload } = require('../utils/buildPayload');

// Dados de entrada estruturados
const invoiceData = {
    invoiceNumber: 'INV-001-2026',
    isInternational: true,
    
    // Remetente (Brasil)
    shipper: {
        name: 'Empresa Exportadora LTDA',
        street: 'Rua Exportação, 100',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01234567',
        countryCode: 'BR',
        email: 'exportacao@empresa.com.br',
        phone: '+5511987654321'
    },
    
    // Destinatário (Exterior)
    recipient: {
        name: 'International Buyer Inc',
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        countryCode: 'US',
        email: 'buyer@example.com',
        phone: '+12125551234'
    },
    
    // Itens a enviar
    items: [
        {
            description: 'Electronic Components',
            quantity: 2,
            weight: 0.5,  // kg por unidade
            unit: 'EA',
            unitPrice: 100.00,
            totalValue: 200.00,
            countryOfOrigin: 'BR',
            hsCode: '8471.30.00'
        },
        {
            description: 'Accessories',
            quantity: 5,
            weight: 0.2,  // kg por unidade
            unit: 'EA',
            unitPrice: 20.00,
            totalValue: 100.00,
            countryOfOrigin: 'BR',
            hsCode: '8517.62.00'
        }
    ],
    
    // Informações de totais
    totals: {
        subtotal: 300.00,
        tax: 0.00,
        total: 300.00,
        currency: 'USD'
    }
};

// Usar a função
try {
    const payload = buildFedexPayload(invoiceData, 'SEU_ACCOUNT_NUMBER');
    validatePayload(payload);
    console.log('✅ Payload válido!');
    console.log(JSON.stringify(payload, null, 2));
} catch (error) {
    console.error('❌ Erro ao construir payload:', error.message);
}

module.exports = { invoiceData };
