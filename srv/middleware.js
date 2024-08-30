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

     
            // Replace the raw XML with the transformed JSON in req.body
            //req.body = {"xmlData": "<CatalogItems><order>Arun</order></CatalogItems>"};

            
            req.body = JSON.stringify(transformedJson);
            //console.log("Transformed JSON String:", req.body);
 
            // Change the Content-Type to application/json
            req.headers['content-type'] = 'application/json';

            // Proceed to the next middleware or handler
            next();
        });
    } else {
        next();
    }
};