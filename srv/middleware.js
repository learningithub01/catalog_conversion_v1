const sax = require('sax');

module.exports = (req, res, next) => {
    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    console.log("In Middleware");
    if (contentType === 'application/xml') {
        let rawData = '';

        // Collect the XML data as it streams in
        req.on('data', (chunk) => {
            rawData += chunk;
        });

        req.on('end', () => {
            // Pass the XML data to the next middleware or handler
            req.body = { xmlData: rawData };
            req.headers['content-type'] = 'application/json';
            next();
        });

    } else {
        next();
    }
};
