const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    this.on('receiveXML', async (req) => {
        // The parsed outputData array from the middleware
        const outputData = JSON.parse(req.data.xmlData);
        console.log(outputData)

        if (!outputData || !Array.isArray(outputData) || outputData.length === 0) {
            return req.reject(400, "No valid XML data provided or parsed.");
        }

        try {
            // Insert the processed data into the database
            const CatalogItems = await cds.entities.CatalogItems;
            console.log("outputData:", outputData);
            const result = await INSERT.into(CatalogItems).entries(outputData);
            console.log("Insert result:", result);

            // Return a success message
            return { message: "Data processed and stored successfully", result };

        } catch (err) {
            console.error("Unexpected error:", err);
            return req.reject(500, "An unexpected error occurred");
        }
    });
});
