const axios = require('axios');
const config = require('../config/fedex');
const logger = require('../utils/logger');
const { getCachedToken, setCachedToken } = require('../utils/tokenCache');

class FedExAuthService {
  constructor() {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.apiSecret = config.secretKey;
  }

  async getToken() {
    try {
      if (!this.apiKey || !this.apiSecret || !this.baseURL) {
        throw new Error('FedEx credentials are not fully configured');
      }

      const cachedToken = getCachedToken();
      if (cachedToken) {
        logger.debug('Token recuperado do cache');
        return cachedToken;
      }

      logger.log('Obtendo novo token FedEx...');

      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.apiSecret
      });

      const response = await axios.post(
        `${this.baseURL}/oauth/token`,
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;

      setCachedToken(token, expiresIn);

      logger.log(`Token obtido com sucesso (valido por ${expiresIn}s)`);
      return token;
    } catch (error) {
      const errorMsg =
        error.response?.data?.error_description ||
        error.response?.data?.errors?.[0]?.message ||
        error.message;

      logger.error('Erro ao obter token FedEx', {
        status: error.response?.status,
        error: errorMsg
      });

      throw new Error(`FedEx authentication failed: ${errorMsg}`);
    }
  }

  async testAuth() {
    try {
      const token = await this.getToken();
      logger.log('Autenticacao FedEx OK');
      return { authenticated: true, token };
    } catch (error) {
      logger.error('Falha na autenticacao', error);
      return { authenticated: false, error: error.message };
    }
  }
}

module.exports = new FedExAuthService();
