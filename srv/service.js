const cds = require('@sap/cds');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

module.exports = cds.service.impl(async function () {
    this.on('receiveXML', async (req) => {
        const xmlData = req.data.xmlData;
// Initialize an array to hold the combined data
const outputData = [];
        if (!xmlData) {
            return req.reject(400, "No XML data provided");
        }

        try {
            const parser = new xml2js.Parser();
            parser.parseString(xmlData, (err, result) => {
                if (err) {
                    console.error("Error parsing XML:", err);
                    return req.reject(400, "Invalid XML format");
                }

                

                // Access the SUPPLIER_ID array
                const supplierIds = result?.BMECAT?.HEADER?.[0]?.SUPPLIER?.[0]?.SUPPLIER_ID;
                
                // Extract supplierID with type 'supplier_specific'
                const specificSupplier = supplierIds.find(supplier => supplier.$?.type === 'supplier_specific');
                const supplierID = specificSupplier ? specificSupplier._ : null;

                if (!supplierID) {
                    console.error("Supplier with type 'supplier_specific' not found");
                    return req.reject(404, "Supplier with type 'supplier_specific' not found");
                }

                // Access the T_NEW_CATALOG array
                const catalogs = result?.BMECAT?.T_NEW_CATALOG;

                if (catalogs && catalogs.length > 0) {
                    // Loop through each catalog object
                    catalogs.forEach(catalog => {
                        const articles = catalog.ARTICLE;

                        // Check if there are articles
                        if (articles && articles.length > 0) {
                            // Loop through each ARTICLE
                            articles.forEach(article => {
                                // Access SUPPLIER_AID
                                const supplierAid = article.SUPPLIER_AID?.[0];

                                // Access DESCRIPTION_LONG and trim if necessary
                                let descriptionLong = article.ARTICLE_DETAILS?.[0]?.DESCRIPTION_LONG?.[0];
                                if (descriptionLong && descriptionLong.length > 5000) {
                                    descriptionLong = descriptionLong.substring(0, 5000);
                                }
                                
                                // Access MANUFACTURER_AID
                                const manufacturerAid = article.ARTICLE_DETAILS?.[0]?.MANUFACTURER_AID?.[0];

                                // Access MANUFACTURER_NAME
                                const manufacturerName = article.ARTICLE_DETAILS?.[0]?.MANUFACTURER_NAME?.[0];

                                // Access ORDER_UNIT
                                const orderUnit = article.ARTICLE_ORDER_DETAILS?.[0]?.ORDER_UNIT?.[0];

                                // Access DELIVERY_TIME
                                const deliveryTime = article.ARTICLE_DETAILS?.[0]?.DELIVERY_TIME?.[0];

                                // Access PRICE_AMOUNT
                                const priceAmount = article.ARTICLE_PRICE_DETAILS?.[0]?.ARTICLE_PRICE?.[0]?.PRICE_AMOUNT?.[0];

                                if (supplierAid && manufacturerAid && manufacturerName && orderUnit && deliveryTime && priceAmount) {
                                    // Push the combined data into the output array
                                    outputData.push({
                                        supplierID: supplierID,
                                        supplierAID: supplierAid,
                                        manufacturerAID: manufacturerAid,
                                        manufacturerName: manufacturerName,
                                        orderUnit: orderUnit,
                                        deliveryTime: deliveryTime,
                                        priceAmount: priceAmount,
                                        descriptionLong: descriptionLong
                                    });
                                } else {
                                    console.error("Some required fields are missing in this article");
                                }
                            });
                        } else {
                            console.error("No ARTICLES found in this catalog");
                        }
                    });

                    // Write the outputData to a JSON file
                    // const outputFilePath = path.join(__dirname, 'output.json');
                    // fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2), 'utf8');
                    console.log("Data written successfully to output.json");

                    return req.reply({ message: "Data processed and stored successfully" });

                } else {
                    console.error("No T_NEW_CATALOG found in the XML");
                    return req.reject(404, "No T_NEW_CATALOG found");
                }
            });
        } catch (err) {
            console.error("Unexpected error:", err);
            return req.reject(500, "An unexpected error occurred");
        }

        const CatalogItems = await cds.entities.CatalogItems;
        const result = await INSERT.into(CatalogItems).entries(outputData);

        return result;
    });
});