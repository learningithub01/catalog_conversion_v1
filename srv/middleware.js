const sax = require('sax');
const cds = require('@sap/cds');

module.exports = (req, res, next) => {
    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    console.log("In Middleware");
    let insertedRecords = 0;
    let failedInserts = 0;

    if (contentType && contentType.includes('application/xml')) {
        console.log("Parsing XML data");
        const parser = sax.createStream(true, { trim: true });

        let currentTag = null;
        let currentArticle = {};
        let currentSupplierID = null;
        const outputData = [];
        const batchSize = 150000;
        let isInserting = false; // Flag to track if a batch insert is in progress

        parser.on('opentag', (node) => {
            currentTag = node.name;
            if (node.name === 'SUPPLIER_ID' && node.attributes.type === 'supplier_specific') {
                currentSupplierID = '';
            }
            if (node.name === 'ARTICLE') {
                currentArticle = {};
            }
        });

        parser.on('text', (text) => {
            const trimmedText = text.trim();
            if (!currentTag || !trimmedText) return;

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
        });

        parser.on('closetag', async (tagName) => {
            if (tagName === 'ARTICLE') {
                if (currentSupplierID && currentArticle.supplierAID && currentArticle.manufacturerAID &&
                    currentArticle.manufacturerName && currentArticle.orderUnit &&
                    currentArticle.deliveryTime && currentArticle.priceAmount) {

                    currentArticle.supplierID = currentSupplierID;
                    outputData.push(currentArticle);

                    if (outputData.length >= batchSize && !isInserting) {
                        isInserting = true; // Set flag to true to indicate a batch insert is in progress
                        await insertBatch(outputData.splice(0, batchSize)); // Insert batch and clear those items
                        isInserting = false; // Reset flag after batch insert
                    }
                } else {
                    failedInserts++;
                    console.log("Incomplete ARTICLE data, not inserting into the database");
                }

                currentArticle = {}; // Reset for the next article
            }

            if (tagName === 'SUPPLIER_ID') {
                console.log("Finished capturing SUPPLIER_ID:", currentSupplierID);
            }

            currentTag = null;
        });

        parser.on('error', (err) => {
            console.error("Error parsing XML:", err);
            res.status(500).send({ error: "Error while parsing XML" });
        });

        parser.on('end', async () => {
            console.log("Parsing ended.");
            // Insert any remaining data
            if (outputData.length > 0 && !isInserting) {
                await insertBatch(outputData);
            }
            console.log("insertedRecords", insertedRecords);
            console.log("failedInserts", failedInserts);

            // Respond with success message to avoid further processing
            res.status(200).send({ message: "Data processed and stored successfully", insertedRecords, failedInserts });
        });

        // Pipe the incoming request stream to the SAX parser
        req.pipe(parser);

    } else {
        next();
    }

    async function insertBatch(dataBatch) {
        try {
            const { CatalogItems } = cds.entities;
            await INSERT.into(CatalogItems).entries(dataBatch);
            console.log(`Current Inserted Rows ${insertedRecords} records`);
            insertedRecords += dataBatch.length;
        } catch (err) {
            console.error("Error inserting batch into the database:", err);
        }
    }
};
