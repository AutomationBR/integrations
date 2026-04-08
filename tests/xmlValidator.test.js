const path = require('path');
const XmlValidator = require('../src/validators/xmlValidator');

describe('XmlValidator', () => {
  test('deve validar um XML válido', async () => {
    const xmlPath = path.join(__dirname, '../data/invoice.xml');
    const xsdPath = path.join(__dirname, '../data/invoice.xsd');

    const result = await XmlValidator.validate(xmlPath, xsdPath);
    expect(result.isValid).toBe(true);
  });

  test('deve rejeitar um XML inválido', async () => {
    const invalidXml = '<invoice></invalid>';
    const result = await XmlValidator.validate(invalidXml, {});
    expect(result.isValid).toBe(false);
  });
});
