function sanitize(value) {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitize(item));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, sanitize(item)])
        );
    }

    return value;
}

function validateEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePhone(phone) {
    if (typeof phone !== 'string' && typeof phone !== 'number') {
        return false;
    }

    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}

function sanitizeInvoice(data) {
    const sanitized = sanitize(data);
    const items = sanitized?.Invoice?.Items?.[0]?.Item;

    if (!Array.isArray(items)) {
        return sanitized;
    }

    items.forEach(item => {
        item.Quantity[0] = parseInt(item.Quantity[0], 10) || 1;
        item.UnitPrice[0] = parseFloat(item.UnitPrice[0]) || 1;
        item.SubTotalValue[0] = item.Quantity[0] * item.UnitPrice[0];

        if ((parseFloat(item.UnitNetWeight[0]) || 0) <= 0) {
            item.UnitNetWeight[0] = 0.1;
        }

        if (!item.Description[0]) {
            item.Description[0] = 'Generic item';
        }
    });

    return sanitized;
}

module.exports = {
    sanitize,
    sanitizeInvoice,
    validateEmail,
    validatePhone
};
