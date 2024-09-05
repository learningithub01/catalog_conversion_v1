const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sax = require('sax');
const cds = require('@sap/cds');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' }); 

module.exports = [
  upload.single('file'), // Assuming 'file' is the field name in the form-data
  (req, res, next) => {
    const filePath = req.file.path;
    console.log(`File uploaded successfully: ${JSON.stringify(req.file)}`);
    
    // Start processing the uploaded file
    let insertedRecords = 0;
    let failedInserts = 0;
    const parser = sax.createStream(true, { trim: true });
    let currentTag = null;
    let currentArticle = {};
    let currentSupplierID = null;
    const outputData = [];
    const batchSize = 150000;
    let isInserting = false;

    parser.on('opentag', (node) => {
      currentTag = node.name;
      if (node.name === 'SUPPLIER_ID' && node.attributes.type === 'supplier_specific') {
        currentSupplierID = '';
      }
      if (node.name === 'ARTICLE') {
        currentArticle = {};
      }
    });

    parser.on('text', (text) => {
      const trimmedText = text.trim();
      if (!currentTag || !trimmedText) return;

      switch (currentTag) {
        case 'SUPPLIER_ID':
          if (currentSupplierID !== null) {
            currentSupplierID += trimmedText;
          }
          break;
        case 'SUPPLIER_AID':
          currentArticle.supplierAID = trimmedText;
          break;
        case 'MANUFACTURER_AID':
          currentArticle.manufacturerAID = trimmedText;
          break;
        case 'MANUFACTURER_NAME':
          currentArticle.manufacturerName = trimmedText;
          break;
        case 'ORDER_UNIT':
          currentArticle.orderUnit = trimmedText;
          break;
        case 'DELIVERY_TIME':
          currentArticle.deliveryTime = trimmedText;
          break;
        case 'PRICE_AMOUNT':
          currentArticle.priceAmount = trimmedText;
          break;
        case 'DESCRIPTION_LONG':
          currentArticle.descriptionLong = trimmedText.substring(0, 5000);
          break;
      }
    });

    parser.on('closetag', async (tagName) => {
      if (tagName === 'ARTICLE') {
        if (currentSupplierID && currentArticle.supplierAID && currentArticle.manufacturerAID &&
            currentArticle.manufacturerName && currentArticle.orderUnit &&
            currentArticle.deliveryTime && currentArticle.priceAmount) {

          currentArticle.supplierID = currentSupplierID;
          outputData.push(currentArticle);

          if (outputData.length >= batchSize && !isInserting) {
            isInserting = true; // Set flag to true to indicate a batch insert is in progress
            await insertBatch(outputData.splice(0, batchSize)); // Insert batch and clear those items
            isInserting = false; // Reset flag after batch insert
          }
        } else {
          failedInserts++;
          console.log("Incomplete ARTICLE data, not inserting into the database");
        }

        currentArticle = {}; // Reset for the next article
      }

      if (tagName === 'SUPPLIER_ID') {
        console.log("Finished capturing SUPPLIER_ID:", currentSupplierID);
      }

      currentTag = null;
    });

    parser.on('error', (err) => {
      console.error("Error parsing XML:", err);
      cleanupFile(filePath);
      res.status(500).send({ error: "Error while parsing XML" });
    });

    parser.on('end', async () => {
      console.log("Parsing ended.");
      // Insert any remaining data
      if (outputData.length > 0 && !isInserting) {
        await insertBatch(outputData);
      }
      console.log("insertedRecords", insertedRecords);
      console.log("failedInserts", failedInserts);

      cleanupFile(filePath);
      // Respond with success message to avoid further processing
      res.status(200).send({ message: "Data processed and stored successfully", insertedRecords, failedInserts });
    });

    // Read the uploaded file and pipe it to the SAX parser
    fs.createReadStream(filePath).pipe(parser);

    async function insertBatch(dataBatch) {
      try {
        const { CatalogItems } = cds.entities;
        await INSERT.into(CatalogItems).entries(dataBatch);
        console.log(`Inserted batch of ${dataBatch.length} records`);
        insertedRecords += dataBatch.length;
      } catch (err) {
        console.error("Error inserting batch into the database:", err);
      }
    }

    function cleanupFile(filePath) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Failed to delete file ${filePath}:`, err);
        } else {
          console.log(`Successfully deleted file ${filePath}`);
        }
      });
    }
  }
];
