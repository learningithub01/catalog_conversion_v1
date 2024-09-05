const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

module.exports = cds.service.impl(async function () {
    this.on('uploadFile', async (req) => {
        console.log("uploading file ...")
        const { file } = req; // Access the uploaded file via req.file
        
        if (!file) {
            return req.error(400, 'No file uploaded');
        }

        // Example: Read the uploaded file
        const filePath = path.join(__dirname, '..', 'uploads', file.filename);
        const fileStream = fs.createReadStream(filePath);

        // Process the file stream here (e.g., parse XML, store data to the database, etc.)

        return { message: 'File uploaded and processed successfully' };
    });
});
