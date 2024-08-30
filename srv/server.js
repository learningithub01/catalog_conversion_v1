const cds = require('@sap/cds');
const bodyParser = require('body-parser');
const customMiddleware = require('./middleware');

cds.on('bootstrap', (app) => {
    
    //cds.setTimeout(900000, () => { // 15 minutes
        // Use body-parser to handle raw XML as text
        app.use(bodyParser.text({ type: 'application/xml' , limit: '5000mb'}));
        app.use(bodyParser.json({ limit: '500mb' }));
        app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

        // Apply your custom middleware
        app.use('/odata/v4/my/receiveXML', customMiddleware);
    });
//});

module.exports = cds.server;

