const sax = require('sax');

module.exports = (req, res, next) => {
    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    console.log("In Middleware");
    if (contentType && contentType.includes('application/xml')) {
        // Initialize the SAX parser in streaming mode
        const parser = sax.createStream(true, { trim: true });

        // Initialize variables to hold parsed data
        let currentTag = null;
        let currentArticle = {};
        let currentSupplierID = null;
        const outputData = [];

        parser.on('opentag', (node) => {
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
        });

        parser.on('text', (text) => {
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
        });

        parser.on('closetag', (tagName) => {
            console.log("Closing tag:", tagName);

            if (tagName === 'ARTICLE') {
                console.log("Completed ARTICLE with data:", currentArticle);

                if (currentSupplierID && currentArticle.supplierAID && currentArticle.manufacturerAID &&
                    currentArticle.manufacturerName && currentArticle.orderUnit &&
                    currentArticle.deliveryTime && currentArticle.priceAmount) {

                    currentArticle.supplierID = currentSupplierID;
                    outputData.push(currentArticle);
                    console.log("Added to outputData:", currentArticle);
                } else {
                    console.log("Incomplete ARTICLE data, not adding to outputData");
                }

                currentArticle = {};
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

        parser.on('end', () => {
            // Set parsed outputData to req.body for further processing
            req.body = { xmlData: JSON.stringify(outputData) };
            req.headers['content-type'] = 'application/json';
            next();
        });

        // Pipe the incoming request stream to the SAX parser
        req.pipe(parser);

    } else {
        next();
    }
};
