const xml2js = require('xml2js');


module.exports = (req, res, next) => {


    const contentType = req.headers['content-type'] || req.headers['Content-Type'];
    console.log("In Middleware");
    if (contentType === 'application/xml') {
        const rawData = req.body;
       const parser = new xml2js.Parser();
        parser.parseString(rawData, (err, result) => {
            if (err) {
                console.error("Error parsing XML:", err);
                return res.status(400).send({ error: "Invalid XML" });
            }

             // Transform the structure to match the CatalogItems entity
            const transformedJson = {
               
                xmlData: rawData
            };

            req.body = JSON.stringify(transformedJson);
            // Change the Content-Type to application/json
            req.headers['content-type'] = 'application/json';

            // Proceed to the next middleware or handler
            next();
        });
    } else {
        next();
    }
};