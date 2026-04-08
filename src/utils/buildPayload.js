function buildFedexPayload(invoiceData, accountNumber) {
    const {
        invoiceNumber,
        shipper,
        recipient,
        items,
        totals,
        isInternational = true
    } = invoiceData;

    // Validações básicas
    if (!shipper || !recipient || !items || items.length === 0) {
        throw new Error('Dados incompletos: shipper, recipient e items são obrigatórios');
    }

    // Calcular dimensões totais e peso
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    items.forEach(item => {
        totalWeight += parseFloat(item.weight) * parseInt(item.quantity);
        if (item.dimensions) {
            maxLength = Math.max(maxLength, parseFloat(item.dimensions.length) || 0);
            maxWidth = Math.max(maxWidth, parseFloat(item.dimensions.width) || 0);
            maxHeight = Math.max(maxHeight, parseFloat(item.dimensions.height) || 0);
        }
    });

    // Construir commodities para envios internacionais
    const commodities = isInternational
        ? items.map((item, index) => {
            // Calcular valor: usar totalValue, ou unitPrice * quantity se não houver
            const itemValue = parseFloat(item.totalValue) || 
                             (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 1);
            
            return {
                description: item.description,
                countryOfManufacture: item.countryOfOrigin || shipper.countryCode,
                harmonizedCode: item.hsCode || '0000000000',
                quantity: parseInt(item.quantity) || 1,
                quantityUnits: item.unit || 'PCS',
                unitPrice: {
                    amount: parseFloat(item.unitPrice) || 0,
                    currency: totals?.currency || 'USD'
                },
                customsValue: {
                    amount: itemValue || 1,
                    currency: totals?.currency || 'USD'
                },
                weight: {
                    units: 'KG',
                    value: parseFloat(item.weight) || 0.1
                }
            };
        })
        : [];

    // Dividir em múltiplos pacotes se necessário
    const maxWeightPerBox = 30; // kg (limite FedEx)
    const packages = [];
    let remaining = totalWeight;
    let packageCount = 0;

    while (remaining > 0 && packageCount < 999) {
        const weight = Math.min(remaining, maxWeightPerBox);
        packages.push({
            customerReferences: [
                {
                    customerReferenceType: 'INVOICE_NUMBER',
                    value: invoiceNumber || 'INV-' + Date.now()
                }
            ],
            groupPackageCount: packageCount + 1,
            weight: {
                units: 'KG',
                value: weight
            },
            declaredValue: {
                amount: parseFloat(totals?.total || 0) / Math.max(packageCount + 1, 1),
                currency: totals?.currency || 'USD'
            }
        });
        remaining -= weight;
        packageCount++;
    }

    // Formatar data sem timezone (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    // Payload final - seguindo modelo funcional
    return {
        labelResponseOptions: 'URL_ONLY',
        
        requestedShipment: {
            // Shipper (Remetente)
            shipper: {
                contact: {
                    personName: shipper.name || 'Not Provided',
                    phoneNumber: shipper.phone || '0000000000'
                },
                address: {
                    streetLines: [
                        (shipper.street || '') + ' ' + (shipper.number || ''),
                        shipper.complement || ''
                    ].filter(s => s.trim()),
                    city: shipper.city || '',
                    stateOrProvinceCode: shipper.state || '',
                    postalCode: shipper.postalCode || '',
                    countryCode: shipper.countryCode || 'BR'
                }
            },

            // Recipients (Destinatários)
            recipients: [
                {
                    contact: {
                        personName: recipient.name || 'Not Provided',
                        phoneNumber: recipient.phone || '0000000000'
                    },
                    address: {
                        streetLines: [
                            recipient.street || ''
                        ],
                        city: recipient.city || '',
                        stateOrProvinceCode: recipient.state || '',
                        postalCode: recipient.postalCode || '',
                        countryCode: recipient.countryCode || 'US'
                    }
                }
            ],

            // Informações de remessa
            shipDatestamp: today,
            serviceType: isInternational ? 'INTERNATIONAL_ECONOMY' : 'FEDEX_GROUND',
            packagingType: 'YOUR_PACKAGING',
            pickupType: 'USE_SCHEDULED_PICKUP',

            // Informações de pagamento
            shippingChargesPayment: {
                paymentType: 'SENDER'
            },

            // Label specification
            labelSpecification: {
                imageType: 'PDF',
                labelStockType: 'STOCK_4X6'
            },

            // Shipping document specification (Commercial Invoice)
            shippingDocumentSpecification: {
                shippingDocumentTypes: [
                    'COMMERCIAL_INVOICE'
                ],
                commercialInvoiceDetail: {
                    documentFormat: {
                        stockType: 'PAPER_LETTER',
                        docType: 'PDF'
                    }
                }
            },

            // Informações de despacho aduaneiro (apenas para internacional)
            ...(isInternational && {
                customsClearanceDetail: {
                    dutiesPayment: {
                        paymentType: 'SENDER'
                    },
                    commodities: commodities
                }
            }),

            // Pacotes
            requestedPackageLineItems: packages
        },

        // Account number
        accountNumber: {
            value: accountNumber
        }
    };
}

function validatePayload(payload) {
    const errors = [];

    if (!payload.accountNumber?.value) {
        errors.push('accountNumber é obrigatório');
    }

    if (!payload.requestedShipment?.shipper?.address?.countryCode) {
        errors.push('shipper.address.countryCode é obrigatório');
    }

    if (!payload.requestedShipment?.recipients?.[0]?.address?.countryCode) {
        errors.push('recipient.address.countryCode é obrigatório');
    }

    if (!payload.requestedShipment?.requestedPackageLineItems?.length) {
        errors.push('requestedPackageLineItems é obrigatório');
    }

    if (errors.length > 0) {
        throw new Error('Payload inválido: ' + errors.join('; '));
    }

    return true;
}

module.exports = { 
    buildFedexPayload,
    validatePayload
};