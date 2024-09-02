const sax = require('sax');

module.exports = (req, res, next) => {
    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    console.log("In Middleware");
    let i = 0;

    if (contentType && contentType.includes('application/xml')) {
        // Initialize the SAX parser
        const parser = sax.createStream(true, { trim: true });

        // Initialize variables to hold parsed data
        let currentElement = null;
        let outputData = [];
        let currentArticle = {};
        let currentSupplierID = null;

        // Handle opening tags
        parser.on('opentag', (node) => {
            currentElement = node.name;

            if (node.name === 'SUPPLIER_ID' && node.attributes.type === 'supplier_specific') {
                currentSupplierID = '';
            }

            if (node.name === 'ARTICLE') {
                currentArticle = {};
            }
        });

        // Handle text within tags
        parser.on('text', (text) => {
            if (!currentElement) return;

            switch (currentElement) {
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
        });

        // Handle closing tags
        parser.on('closetag', (tagName) => {
            i++;
            console.log(i)
            if (tagName === 'ARTICLE') {
                if (currentSupplierID && currentArticle.supplierAID && currentArticle.manufacturerAID &&
                    currentArticle.manufacturerName && currentArticle.orderUnit &&
                    currentArticle.deliveryTime && currentArticle.priceAmount) {
                    currentArticle.supplierID = currentSupplierID;
                    outputData.push(currentArticle);
                }
                currentArticle = {};
            }

            if (tagName === 'SUPPLIER_ID') {
                currentSupplierID = null;
            }
        });

        parser.on('error', (err) => {
            console.error("Error while parsing XML:", err);
            res.status(500).send({ error: "Error while parsing XML" });
        });

        parser.on('end', () => {
            req.body = { outputData };
            req.headers['content-type'] = 'application/json';
            next();
        });

        // Pipe the incoming request to the SAX parser stream
        req.pipe(parser);
    } else {
        console.log("Content-Type not application/xml");
        next();
    }
};
