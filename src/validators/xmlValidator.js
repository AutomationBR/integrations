const fs = require('fs');
const xml2js = require('xml2js');

async function validate(xmlInput, xsdInput) {
    try {
        const xmlContent = fs.existsSync(xmlInput)
            ? fs.readFileSync(xmlInput, 'utf-8')
            : xmlInput;

        if (typeof xmlContent !== 'string' || !xmlContent.trim()) {
            return { isValid: false, errors: ['XML content is empty'] };
        }

        await xml2js.parseStringPromise(xmlContent);

        // The project does not currently ship an XSD validation library.
        // We still verify that a referenced XSD file exists when a path is provided.
        if (typeof xsdInput === 'string' && xsdInput.endsWith('.xsd') && !fs.existsSync(xsdInput)) {
            return { isValid: false, errors: ['XSD file not found'] };
        }

        return { isValid: true, errors: [] };
    } catch (error) {
        return { isValid: false, errors: [error.message] };
    }
}

async function validateXML(xmlPath, xsdPath) {
    const result = await validate(xmlPath, xsdPath);

    if (!result.isValid) {
        throw new Error(`XML inválido: ${result.errors.join(', ')}`);
    }

    return true;
}

module.exports = { validate, validateXML };
