const cds = require('@sap/cds');
const customMiddleware = require('./middleware');

cds.on('bootstrap', (app) => {
    // Override app.listen to set a custom server timeout
    app.listen = function () {
        // Create an HTTP server and set the timeout
        const server = require('http').createServer(this);
        server.timeout = 1200000; // Set timeout to 1200000 milliseconds (20 minutes)
        
        // You can also set keepAliveTimeout if needed
        // server.keepAliveTimeout = 620000; // Set keep-alive timeout (optional)

        // Print the server timeout when the server starts
        console.log(`Server timeout set to ${server.timeout / 60000} minutes`);

        return server.listen.apply(server, arguments);
    };

    // Apply your custom middleware
    app.use('/odata/v4/my/receiveXML', customMiddleware);
});

module.exports = cds.server;
