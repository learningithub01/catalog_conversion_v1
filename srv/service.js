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
            let currentArticle = {};
            let currentSupplierID = null;

            parser.onopentag = (node) => {
                currentTag = node.name;
                console.log("Opening tag:", currentTag);

                if (node.name === 'SUPPLIER_ID' && node.attributes.type === 'supplier_specific') {
                    currentSupplierID = '';
                    console.log("Started capturing SUPPLIER_ID");
                }

                if (node.name === 'ARTICLE') {
                    currentArticle = {};
                    console.log("Started new ARTICLE");
                }
            };

            parser.ontext = (text) => {
                const trimmedText = text.trim();
                if (!currentTag || !trimmedText) return;

                console.log(`Text for ${currentTag}:`, trimmedText);

                switch (currentTag) {
                    case 'SUPPLIER_ID':
                        if (currentSupplierID !== null) {
                            currentSupplierID += trimmedText;
                        }
                        break;
                    case 'SUPPLIER_AID':
                        currentArticle.supplierAID = trimmedText;
                        break;
                    case 'MANUFACTURER_AID':
                        currentArticle.manufacturerAID = trimmedText;
                        break;
                    case 'MANUFACTURER_NAME':
                        currentArticle.manufacturerName = trimmedText;
                        break;
                    case 'ORDER_UNIT':
                        currentArticle.orderUnit = trimmedText;
                        break;
                    case 'DELIVERY_TIME':
                        currentArticle.deliveryTime = trimmedText;
                        break;
                    case 'PRICE_AMOUNT':
                        currentArticle.priceAmount = trimmedText;
                        break;
                    case 'DESCRIPTION_LONG':
                        currentArticle.descriptionLong = trimmedText.substring(0, 5000);
                        break;
                }
            };

            parser.onclosetag = (tagName) => {
                console.log("Closing tag:", tagName);

                if (tagName === 'ARTICLE') {
                    // Ensure all required fields are checked correctly
                    if (currentSupplierID && currentArticle.supplierAID && currentArticle.manufacturerAID &&
                        currentArticle.manufacturerName && currentArticle.orderUnit &&
                        currentArticle.deliveryTime && currentArticle.priceAmount) {

                        // Set supplierID for the current article
                        currentArticle.supplierID = currentSupplierID;

                        // Push to outputData
                        outputData.push(currentArticle);
                        console.log("Added to outputData:", currentArticle);
                    } else {
                        console.log("Incomplete ARTICLE data, not adding to outputData");
                    }

                    currentArticle = {}; // Reset for the next article
                }

                if (tagName === 'SUPPLIER_ID') {
                    console.log("Finished capturing SUPPLIER_ID:", currentSupplierID);
                }

                // Reset currentTag to prevent incorrect data assignment
                currentTag = null;
            };

            parser.onerror = (err) => {
                console.error("Error parsing XML:", err);
                req.reject(400, "Invalid XML format");
            };

            parser.write(xmlData).close();

            // Insert the processed data into the database
            const CatalogItems = await cds.entities.CatalogItems;
            console.log("outputData", outputData);
            const result = await INSERT.into(CatalogItems).entries(outputData);
            console.log("Insert result:", result);

            // Return a success message
            return { message: "Data processed and stored successfully", result };

        } catch (err) {
            console.error("Unexpected error:", err);
            return req.reject(500, "An unexpected error occurred");
        }
    });
});
