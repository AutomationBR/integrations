const fs = require('fs');
const xml2js = require('xml2js');

async function parseXML(filePath) {
    const xml = fs.readFileSync(filePath, 'utf-8');
    return await xml2js.parseStringPromise(xml);
}

module.exports = { parseXML };