const cds = require('@sap/cds');
const sax = require('sax');

module.exports = cds.service.impl(async function () {
    this.on('receiveXML', async (req) => {
        const xmlData = req.data.xmlData;
        const outputData = [];

        if (!xmlData) {
            return req.reject(400, "No XML data provided");
        }

        try {
            // Initialize SAX parser
            const parser = sax.parser(true);

            let currentTag = null;
            let currentCatalog = {};
            let currentArticle = {};
            let currentSupplierID = null;

            parser.onopentag = (node) => {
                currentTag = node.name;

                if (node.name === 'SUPPLIER_ID' && node.attributes.type === 'supplier_specific') {
                    currentSupplierID = '';
                }

                if (node.name === 'ARTICLE') {
                    currentArticle = {};
                }
            };

            parser.ontext = (text) => {
                if (!currentTag) return;

                switch (currentTag) {
                    case 'SUPPLIER_ID':
                        if (currentSupplierID !== null) {
                            currentSupplierID += text.trim();
                        }
                        break;
                    case 'SUPPLIER_AID':
                        currentArticle.supplierAID = text.trim();
                        break;
                    case 'MANUFACTURER_AID':
                        currentArticle.manufacturerAID = text.trim();
                        break;
                    case 'MANUFACTURER_NAME':
                        currentArticle.manufacturerName = text.trim();
                        break;
                    case 'ORDER_UNIT':
                        currentArticle.orderUnit = text.trim();
                        break;
                    case 'DELIVERY_TIME':
                        currentArticle.deliveryTime = text.trim();
                        break;
                    case 'PRICE_AMOUNT':
                        currentArticle.priceAmount = text.trim();
                        break;
                    case 'DESCRIPTION_LONG':
                        currentArticle.descriptionLong = text.trim().substring(0, 5000);
                        break;
                }
            };

            parser.onclosetag = (tagName) => {
                if (tagName === 'ARTICLE') {
                    if (currentSupplierID && currentArticle.supplierAID && currentArticle.manufacturerAID &&
                        currentArticle.manufacturerName && currentArticle.orderUnit &&
                        currentArticle.deliveryTime && currentArticle.priceAmount) {
                        currentCatalog.supplierID = currentSupplierID;
                        outputData.push({
                            supplierID: currentSupplierID,
                            supplierAID: currentArticle.supplierAID,
                            manufacturerAID: currentArticle.manufacturerAID,
                            manufacturerName: currentArticle.manufacturerName,
                            orderUnit: currentArticle.orderUnit,
                            deliveryTime: currentArticle.deliveryTime,
                            priceAmount: currentArticle.priceAmount,
                            descriptionLong: currentArticle.descriptionLong
                        });
                    }
                    currentArticle = {};
                }
                if (tagName === 'SUPPLIER_ID') {
                    currentSupplierID = null;
                }
            };

            parser.onerror = (err) => {
                console.error("Error parsing XML:", err);
                req.reject(400, "Invalid XML format");
            };

            parser.write(xmlData).close();

            // Insert the processed data into the database
            const CatalogItems = await cds.entities.CatalogItems;
            const result = await INSERT.into(CatalogItems).entries(outputData);

            return { message: "Data processed and stored successfully", result };

        } catch (err) {
            console.error("Unexpected error:", err);
            return req.reject(500, "An unexpected error occurred");
        }
    });
});
