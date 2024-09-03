const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    this.on('receiveXML', async (req) => {
        // Simply acknowledge the request as the middleware handles all logic
        return { message: "Data processing initiated" };
    });
});
