require('dotenv').config();

module.exports = {
    apiKey: process.env.FEDEX_API_KEY,
    secretKey: process.env.FEDEX_API_SECRET,
    accountNumber: process.env.FEDEX_ACCOUNT_NUMBER,
    baseURL: process.env.FEDEX_BASE_URL || 'https://apis-sandbox.fedex.com'
};
