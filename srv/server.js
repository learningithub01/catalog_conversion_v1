const cds = require('@sap/cds');
const bodyParser = require('body-parser');
const customMiddleware = require('./middleware');

cds.on('bootstrap', (app) => {
    // Apply your custom middleware first
    app.use('/odata/v4/my/receiveXML', customMiddleware);

    // Then apply other body parsers
    //app.use(bodyParser.text({ type: 'application/xml', limit: '50mb' }));
    //app.use(bodyParser.json({ limit: '50mb' }));
    //app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
});

module.exports = cds.server;
