const cds = require('@sap/cds');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Require axios

module.exports = cds.service.impl(async function () {
    this.on('receiveXML', async (req) => {
        // Simply acknowledge the request as the middleware handles all logic
        return { message: "Data processing initiated" };
    });

    this.on('receiveXMLOld', async (req) => {
        const xmlData = req.data.xmlData;
        // Initialize an array to hold the combined data
        const outputData = [];
        if (!xmlData) {
            return req.reject(400, "No XML data provided");
        }

        try {
            const parser = new xml2js.Parser();
            parser.parseString(xmlData, (err, result) => {
                if (err) {
                    console.error("Error parsing XML:", err);
                    return req.reject(400, "Invalid XML format");
                }



                // Access the SUPPLIER_ID array
                const supplierIds = result?.BMECAT?.HEADER?.[0]?.SUPPLIER?.[0]?.SUPPLIER_ID;

                // Extract supplierID with type 'supplier_specific'
                const specificSupplier = supplierIds.find(supplier => supplier.$?.type === 'supplier_specific');
                const supplierID = specificSupplier ? specificSupplier._ : null;

                if (!supplierID) {
                    console.error("Supplier with type 'supplier_specific' not found");
                    return req.reject(404, "Supplier with type 'supplier_specific' not found");
                }

                // Access the T_NEW_CATALOG array
                const catalogs = result?.BMECAT?.T_NEW_CATALOG;

                if (catalogs && catalogs.length > 0) {
                    // Loop through each catalog object
                    catalogs.forEach(catalog => {
                        const articles = catalog.ARTICLE;

                        // Check if there are articles
                        if (articles && articles.length > 0) {
                            // Loop through each ARTICLE
                            articles.forEach(article => {
                                // Access SUPPLIER_AID
                                const supplierAid = article.SUPPLIER_AID?.[0];

                                // Access DESCRIPTION_LONG and trim if necessary
                                let descriptionLong = article.ARTICLE_DETAILS?.[0]?.DESCRIPTION_LONG?.[0];
                                if (descriptionLong && descriptionLong.length > 5000) {
                                    descriptionLong = descriptionLong.substring(0, 5000);
                                }

                                // Access MANUFACTURER_AID
                                const manufacturerAid = article.ARTICLE_DETAILS?.[0]?.MANUFACTURER_AID?.[0];

                                // Access MANUFACTURER_NAME
                                const manufacturerName = article.ARTICLE_DETAILS?.[0]?.MANUFACTURER_NAME?.[0];

                                // Access ORDER_UNIT
                                const orderUnit = article.ARTICLE_ORDER_DETAILS?.[0]?.ORDER_UNIT?.[0];

                                // Access DELIVERY_TIME
                                const deliveryTime = article.ARTICLE_DETAILS?.[0]?.DELIVERY_TIME?.[0];

                                // Access PRICE_AMOUNT
                                const priceAmount = article.ARTICLE_PRICE_DETAILS?.[0]?.ARTICLE_PRICE?.[0]?.PRICE_AMOUNT?.[0];

                                if (supplierAid && manufacturerAid && manufacturerName && orderUnit && deliveryTime && priceAmount) {
                                    // Push the combined data into the output array
                                    outputData.push({
                                        supplierID: supplierID,
                                        supplierAID: supplierAid,
                                        manufacturerAID: manufacturerAid,
                                        manufacturerName: manufacturerName,
                                        orderUnit: orderUnit,
                                        deliveryTime: deliveryTime,
                                        priceAmount: priceAmount,
                                        descriptionLong: descriptionLong,
                                        MarketPrice: priceAmount,
                                        Currency: 'EUR',
                                        PunchOutEnabled: 'False',
                                        Language: 'en_US',
                                        EffectiveDate: '9999-12-31T00:00:00-08:00',
                                        ClassificationCodes: '{UNSPSC=27112810;}',
                                        ShortName: 'TestCatalogItem',
                                        IsPartial: 'TRUE',
                                        IsInternalPartId: 'FALSE',
                                        Delete: 'FALSE',
                                        Image: 'https://cdn.hoffmann-group.com/derivatives/9272/eCommerce_0300x0300/ec300_b082840.jpg',
                                        Thumbnail: 'https://cdn.hoffmann-group.com/derivatives/9272/eCommerce_0100x0100/ec100_b082840.jpg',
                                        InKitOnly: 'FALSE',
                                        PriceUnitQuantity: '1',
                                        PriceUnit: 'EACH',
                                        IsPreferredItem: 'FALSE',
                                        green: 'FALSE',
                                        hazardousmaterials: 'FALSE',
                                        bestprice: 'FALSE'
                                    });
                                } else {
                                    console.error("Some required fields are missing in this article");
                                }
                            });
                        } else {
                            console.error("No ARTICLES found in this catalog");
                        }
                    });

                    // Write the outputData to a JSON file
                    // const outputFilePath = path.join(__dirname, 'output.json');
                    // fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2), 'utf8');
                    console.log("Data written successfully to output.json");

                    return req.reply({ message: "Data processed and stored successfully" });

                } else {
                    console.error("No T_NEW_CATALOG found in the XML");
                    return req.reject(404, "No T_NEW_CATALOG found");
                }
            });
        } catch (err) {
            console.error("Unexpected error:", err);
            return req.reject(500, "An unexpected error occurred");
        }

        const CatalogItems = await cds.entities.CatalogItems;
        const result = await INSERT.into(CatalogItems).entries(outputData);

        return result;
    });

    this.on('sendCIF', async (req) => {
        // CIF metadata header definition (before the actual data begins)
        const cifMetadataHeader = `CIF_I_V3.0
LOADMODE: I
SUPPLIERID_DOMAIN: buyersystemid
COMMENTS: Generated on Thu Sep 05 23:42:44 PDT 2024
UNUOM: TRUE
CURRENCY: EUR
CHARSET: UTF-8
FIELDNAMES: Supplier ID, Supplier Part ID, Manufacturer Part ID, Item Description, SPSC Code, Unit Price, Unit of Measure, Lead Time, Manufacturer Name, Supplier URL, Manufacturer URL, Market Price, Currency, PunchOut Enabled, Supplier Part Auxiliary ID, Language, Parametric Name, Parametric Data, Expiration Date, Effective Date, Classification Codes, Territory Available, Short Name, IsPartial, IsInternalPartId, Delete, Image, Thumbnail, InKitOnly, PunchoutLevel, DefaultRelevance, Price Unit Quantity, Price Unit, Unit Conversion, Price Unit Quantity Description, Promotion Rank, Is Preferred Item, cus_cfopcategory, keyword, cus_ncmcode, cus_materialorigin, green, hazardousmaterials, bestprice
DATA
`;

        const cifFooter = "ENDOFDATA"; // CIF footer

        // Function to escape HTML in the description
        const escapeHtml = (text) => {
            const map = {
                '<br>': '\n',
                '&nbsp;': ' ',
                '&lt;': '<',
                '&gt;': '>',
                '&amp;': '&',
                '&quot;': '"',
                '&#039;': "'"
            };
            return text ? text.replace(/<br>|&nbsp;|&lt;|&gt;|&amp;|&quot;|&#039;/g, (matched) => map[matched]) : '';
        };

        // Function to clean and escape values and truncate descriptionLong
        const cleanValue = (value, maxLength = null) => {
            if (value === undefined || value === null) return '';

            // Convert value to string
            value = value.toString();

            // Optionally truncate if maxLength is provided
            if (maxLength && value.length > maxLength) {
                value = value.substring(0, maxLength);
            }

            // Escape double quotes by doubling them
            value = value.replace(/"/g, '""');

            // Replace HTML line breaks with actual newline characters
            // value = value.replace(/<br\s*\/?>/gi, '\n');

            // Remove any remaining HTML tags (optional)
            value = value.replace(/<\/?[^>]+(>|$)/g, "");

            // Trim whitespace (optional)
            value = value.trim();

            return value;
        };

        // Convert JSON data to CIF format
        const convertJsonToCIF = (items) => {
            let cifData = cifMetadataHeader; // Start with CIF metadata header

            items.forEach(item => {
                // Truncate descriptionLong to 1900 characters
                const description = cleanValue(item.descriptionLong, 1900); // Limit to 1900 characters
                const itemData = `"${cleanValue(item.supplierID)}","${cleanValue(item.supplierAID)}","${cleanValue(item.manufacturerAID)}","${description}","${cleanValue(item.SPSCCode)}","${cleanValue(item.priceAmount)}","EA","${cleanValue(item.deliveryTime)}","${cleanValue(item.manufacturerName)}","${cleanValue(item.SupplierURL)}","${cleanValue(item.ManufacturerURL)}","${cleanValue(item.MarketPrice)}","${cleanValue(item.Currency)}","${cleanValue(item.PunchOutEnabled)}","${cleanValue(item.SupplierPartAuxiliaryID)}","${cleanValue(item.Language)}","${cleanValue(item.ParametricName)}","${cleanValue(item.ParametricData)}","${cleanValue(item.ExpirationDate)}","${cleanValue(item.EffectiveDate)}","${cleanValue(item.ClassificationCodes)}","${cleanValue(item.TerritoryAvailable)}","${cleanValue(item.ShortName)}","${cleanValue(item.IsPartial)}","${cleanValue(item.IsInternalPartId)}","${cleanValue(item.Delete)}","${cleanValue(item.Image)}","${cleanValue(item.Thumbnail)}","${cleanValue(item.InKitOnly)}","${cleanValue(item.PunchoutLevel)}","${cleanValue(item.DefaultRelevance)}","${cleanValue(item.PriceUnitQuantity)}","${cleanValue(item.PriceUnit)}","${cleanValue(item.UnitConversion)}","${cleanValue(item.PriceUnitQuantityDescription)}","${cleanValue(item.PromotionRank)}","${cleanValue(item.IsPreferredItem)}","${cleanValue(item.cus_cfopcategory)}","${cleanValue(item.keyword)}","${cleanValue(item.cus_ncmcode)}","${cleanValue(item.cus_materialorigin)}","${cleanValue(item.green)}","${cleanValue(item.hazardousmaterials)}","${cleanValue(item.bestprice)}"`;
                cifData += itemData + '\n'; // Add item to CIF data
            });

            cifData += cifFooter; // Append the footer
            return cifData;
        };

        const CatalogItems = await cds.entities.CatalogItems;
        const catalogItems = await SELECT.from(CatalogItems); // Get all records at once

        // Convert all CatalogItems data to CIF format
        const cifData = convertJsonToCIF(catalogItems);

        // Base64 encode the CIF data
        const base64EncodedCifData = Buffer.from(cifData).toString('base64');

        // Function to generate the SOAP XML
        const generateSoapXml = (base64CifData) => `
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <n0:MasterDataReplReqMsg xmlns:n0="http://sap.com/xi/ARBCIG1">
                        <Header>
                            <Parameters>
                                <Parameter name="ANSupplierID">
                                    <value>an01051939458</value>
                                </Parameter>
                                <Parameter name="CreatedTimestamp">
                                    <value>2022-08-08T12:08:05+02:00</value>
                                </Parameter>
                            </Parameters>
                            <AttachmentFolder contentID="cid:FOL184EXT97900000000984" contentLength="${base64CifData.length}" contentType="text/plain" fileName="BuyerCatalog20220622103266.CIF">
                                <Content>${base64CifData}</Content>
                            </AttachmentFolder>
                        </Header>
                    </n0:MasterDataReplReqMsg>
                </soap:Body>
            </soap:Envelope>
        `;

        console.log('Before Soap Call');
        // Generate the SOAP XML for the entire CIF data
        const soapRequest = generateSoapXml(base64EncodedCifData);

        // Send the SOAP request using Axios
        const endpoint = 'https://testacig.ariba.com:443/cxf/receiveERPMD/'; // Replace with your actual endpoint URL
        const username = '123';  // Replace with your username
        const password = '123123';  // Replace with your password
        const headers = {
            'Content-Type': 'application/xml', // Ensure correct Content-Type for SOAP
        };

        try {
            // Uncomment the below to actually send the request
            // const response = await axios.post(endpoint, soapRequest, {
            //     headers,
            //     auth: {
            //         username: username,
            //         password: password
            //     }
            // });
            // console.log('SOAP Response:', response.data); // Log the SOAP response
            return soapRequest;
        } catch (error) {
            console.error('Error sending SOAP request:', error.message);
        }
    });


    this.on('sendCIF2Ariba', async (req) => {
        // CIF metadata header definition (before the actual data begins)
        const cifMetadataHeader = `CIF_I_V3.0
LOADMODE: I
SUPPLIERID_DOMAIN: buyersystemid
COMMENTS: Generated on Thu Sep 05 23:42:44 PDT 2024
UNUOM: TRUE
CURRENCY: EUR
CHARSET: UTF-8
FIELDNAMES: Supplier ID, Supplier Part ID, Manufacturer Part ID, Item Description, SPSC Code, Unit Price, Unit of Measure, Lead Time, Manufacturer Name, Supplier URL, Manufacturer URL, Market Price, Currency, PunchOut Enabled, Supplier Part Auxiliary ID, Language, Parametric Name, Parametric Data, Expiration Date, Effective Date, Classification Codes, Territory Available, Short Name, IsPartial, IsInternalPartId, Delete, Image, Thumbnail, InKitOnly, PunchoutLevel, DefaultRelevance, Price Unit Quantity, Price Unit, Unit Conversion, Price Unit Quantity Description, Promotion Rank, Is Preferred Item, cus_cfopcategory, keyword, cus_ncmcode, cus_materialorigin, green, hazardousmaterials, bestprice
DATA
`;

        const cifFooter = "ENDOFDATA"; // CIF footer

        // Function to escape HTML in the description
        const escapeHtml = (text) => {
            const map = {
                '<br>': '\n',
                '&nbsp;': ' ',
                '&lt;': '<',
                '&gt;': '>',
                '&amp;': '&',
                '&quot;': '"',
                '&#039;': "'"
            };
            return text ? text.replace(/<br>|&nbsp;|&lt;|&gt;|&amp;|&quot;|&#039;/g, (matched) => map[matched]) : '';
        };

        // Function to clean and escape values and truncate descriptionLong
        const cleanValue = (value, maxLength = null) => {
            if (value === undefined || value === null) return '';

            // Convert value to string
            value = value.toString();

            // Optionally truncate if maxLength is provided
            if (maxLength && value.length > maxLength) {
                value = value.substring(0, maxLength);
            }

            // Escape double quotes by doubling them
            value = value.replace(/"/g, '""');

            // Replace HTML line breaks with actual newline characters
            // value = value.replace(/<br\s*\/?>/gi, '\n');

            // Remove any remaining HTML tags (optional)
            value = value.replace(/<\/?[^>]+(>|$)/g, "");

            // Trim whitespace (optional)
            value = value.trim();

            return value;
        };

        // Convert JSON data to CIF format
        const convertJsonToCIF = (items) => {
            let cifData = cifMetadataHeader; // Start with CIF metadata header

            items.forEach(item => {
                // Truncate descriptionLong to 1900 characters
                const description = cleanValue(item.descriptionLong, 1900); // Limit to 1900 characters
                const itemData = `"${cleanValue(item.supplierID)}","${cleanValue(item.supplierAID)}","${cleanValue(item.manufacturerAID)}","${description}","${cleanValue(item.SPSCCode)}","${cleanValue(item.priceAmount)}","EA","${cleanValue(item.deliveryTime)}","${cleanValue(item.manufacturerName)}","${cleanValue(item.SupplierURL)}","${cleanValue(item.ManufacturerURL)}","${cleanValue(item.MarketPrice)}","${cleanValue(item.Currency)}","${cleanValue(item.PunchOutEnabled)}","${cleanValue(item.SupplierPartAuxiliaryID)}","${cleanValue(item.Language)}","${cleanValue(item.ParametricName)}","${cleanValue(item.ParametricData)}","${cleanValue(item.ExpirationDate)}","${cleanValue(item.EffectiveDate)}","${cleanValue(item.ClassificationCodes)}","${cleanValue(item.TerritoryAvailable)}","${cleanValue(item.ShortName)}","${cleanValue(item.IsPartial)}","${cleanValue(item.IsInternalPartId)}","${cleanValue(item.Delete)}","${cleanValue(item.Image)}","${cleanValue(item.Thumbnail)}","${cleanValue(item.InKitOnly)}","${cleanValue(item.PunchoutLevel)}","${cleanValue(item.DefaultRelevance)}","${cleanValue(item.PriceUnitQuantity)}","${cleanValue(item.PriceUnit)}","${cleanValue(item.UnitConversion)}","${cleanValue(item.PriceUnitQuantityDescription)}","${cleanValue(item.PromotionRank)}","${cleanValue(item.IsPreferredItem)}","${cleanValue(item.cus_cfopcategory)}","${cleanValue(item.keyword)}","${cleanValue(item.cus_ncmcode)}","${cleanValue(item.cus_materialorigin)}","${cleanValue(item.green)}","${cleanValue(item.hazardousmaterials)}","${cleanValue(item.bestprice)}"`;
                cifData += itemData + '\n'; // Add item to CIF data
            });

            cifData += cifFooter; // Append the footer
            return cifData;
        };

        // Function to generate the SOAP XML
        const generateSoapXml = (base64CifData, fileId, fileName) => `
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <n0:MasterDataReplReqMsg xmlns:n0="http://sap.com/xi/ARBCIG1">
                        <Header>
                            <Parameters>
                                <Parameter name="realm">
                                    <value>FAURECIASERVICESGROUPE-S-T</value>
                                </Parameter>
                                <Parameter name="Solution">
                                    <value>BuyerCatalog</value>
                                </Parameter>
                                <Parameter name="Variant">
                                    <value>VREALM_52946</value>
                                </Parameter>
                                <Parameter name="Partition">
                                    <value>PREALM_52946</value>
                                </Parameter>
                                <Parameter name="SubscriptionName">
                                    <value>TestCatalogArun-V1</value>
                                </Parameter>
                                <Parameter name="FileID">
                                    <value>${fileId}</value>
                                </Parameter>
                                <Parameter name="FileName">
                                    <value>${fileName}</value>
                                </Parameter>
                                <Parameter name="TotalFileCount">
                                    <value>1</value>
                                </Parameter>
                                <Parameter name="CurrentFileCount">
                                    <value>1</value>
                                </Parameter>
                                <Parameter name="MultiSupplierCIF">
                                    <value>false</value>
                                </Parameter>
                                <Parameter name="ByPassApproval">
                                    <value>true</value>
                                </Parameter>
                                <Parameter name="AutoPublish">
                                    <value>true</value>
                                </Parameter>
                                <Parameter name="SystemId">
                                    <value>DC1CLNT200</value>
                                </Parameter>
                                <Parameter name="ANSupplierID">
                                    <value>an11199062622-T</value>
                                </Parameter>
                                <Parameter name="CreatedTimestamp">
                                    <value>2024-06-11T05:08:05+02:00</value>
                                </Parameter>
                            </Parameters>
                            <AttachmentFolder contentID="cid:FOL184EXT97900000000984" contentLength="${base64CifData.length}" contentType="text/plain" fileName="${fileName}">
                                <Content>${base64CifData}</Content>
                            </AttachmentFolder>
                        </Header>
                    </n0:MasterDataReplReqMsg>
                </soap:Body>
            </soap:Envelope>
        `;

        const sendCIFBatch = async (batch, index) => {
            const cifData = convertJsonToCIF(batch);
            const base64EncodedCifData = Buffer.from(cifData).toString('base64');

            const fileId = `32010aee-2528-1edc-83f5-4b1batch${index}`;
            const fileName = `TestCatalog2024-batch${index}.CIF`;

            // Generate the SOAP XML for the batch
            const soapRequest = generateSoapXml(base64EncodedCifData, fileId, fileName);

            // Send the SOAP request using Axios
            const endpoint = 'https://testacig.ariba.com:443/cxf/receiveERPMD/'; // Replace with your actual endpoint URL
            const username = 'P006008';  // Replace with your username
            const password = 'y[eT5Mk%-dev';  // Replace with your password
            const headers = {
                'Content-Type': 'application/xml', // Ensure correct Content-Type for SOAP
            };

            try {
                const response = await axios.post(endpoint, soapRequest, {
                    headers,
                    auth: {
                        username: username,
                        password: password
                    }
                });
                console.log(`Batch ${index} sent successfully:`, response.data);
            } catch (error) {
                console.error(`Error sending batch ${index}:`, error.message);
            }
        };

        // Fetch data from CatalogItems
        const CatalogItems = await cds.entities.CatalogItems;
        const catalogItems = await SELECT.from(CatalogItems);

        // Split data into batches of 5,000
        const batchSize = 5000;
        const totalBatches = Math.ceil(catalogItems.length / batchSize);
        console.log(`Total records: ${catalogItems.length}, Sending in ${totalBatches} batches`);

        // Sequentially send each batch
        for (let i = 0; i < totalBatches; i++) {
            const batch = catalogItems.slice(i * batchSize, (i + 1) * batchSize);
            await sendCIFBatch(batch, i + 1); // Wait for each batch to finish before sending the next
        }

        console.log('All batches sent successfully');
    });

});
