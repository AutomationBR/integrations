const TokenCache = require('../src/utils/tokenCache');

describe('TokenCache', () => {
  beforeEach(() => {
    TokenCache.clearToken();
  });

  test('deve armazenar token', () => {
    TokenCache.setToken('my-token', 3600);
    expect(TokenCache.getToken()).toBe('my-token');
  });

  test('deve retornar null para token expirado', () => {
    TokenCache.setToken('my-token', 1);
    expect(TokenCache.getToken()).toBeNull();
  });

  test('deve verificar se token está expirado', () => {
    TokenCache.setToken('my-token', 3600);
    expect(TokenCache.isExpired()).toBe(false);
  });
});
