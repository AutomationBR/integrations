const DataSanitizer = require('../src/validators/dataSanitizer');

describe('DataSanitizer', () => {
  test('deve sanitizar string com espaços', () => {
    expect(DataSanitizer.sanitize('  hello  ')).toBe('hello');
  });

  test('deve validar email correto', () => {
    expect(DataSanitizer.validateEmail('test@example.com')).toBe(true);
  });

  test('deve rejeitar email inválido', () => {
    expect(DataSanitizer.validateEmail('invalid-email')).toBe(false);
  });

  test('deve validar telefone', () => {
    expect(DataSanitizer.validatePhone('11987654321')).toBe(true);
  });

  test('deve sanitizar objeto recursivamente', () => {
    const input = {
      name: '  João  ',
      email: '  test@example.com  '
    };

    const result = DataSanitizer.sanitize(input);

    expect(result.name).toBe('João');
    expect(result.email).toBe('test@example.com');
  });
});
