const cds = require('@sap/cds');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Require axios

module.exports = cds.service.impl(async function () {
    this.on('receiveXML', async (req) => {
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
                                        descriptionLong: descriptionLong
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
    SUPPLIERID_DOMAIN: NetworkID
    UNUOM: TRUE
    COMMENTS: INCREMENTAL
    CHARSET: UTF-8
    CURRENCY: USD
    FIELDNAMES: Supplier ID, Supplier Part ID, Manufacturer Part ID, Item Description, SPSC Code, Unit Price, Unit of Measure, Lead Time, Manufacturer Name, Supplier URL, Manufacturer URL, Market Price, Currency, Language, Parametric Name, Parametric Data, IsPartial, Effective Date, Expiration Date, Classification Codes, Short Name, Delete, AuxiliaryImages, PriceConfiguration, RelatedItems, QuantityInterval, MinimumQuantity, ItemSpec, Keywords, DefaultRelevance, cus_outlineagreement, cus_countryoforigin, cus_sap_materialid, cus_outlineagreementlineitem, cus_temporaryunavailable, green, hazardousmaterials
    DATA
    `;

        // CIF footer after the data
        const cifFooter = "ENDOFDATA";

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
            return text ? text.replace(/<br>|&nbsp;|&lt;|&gt;|&amp;|&quot;|&#039;/g, function (matched) {
                return map[matched];
            }) : text;
        };

        // Select data from CatalogItems entity
        const CatalogItems = await cds.entities.CatalogItems;
        const catalogItems = await SELECT.from(CatalogItems);

        // Function to convert JSON to CIF format
        const convertJsonToCIF = (items) => {
            let cifData = cifMetadataHeader; // Start with CIF metadata header

            items.forEach(item => {
                const description = escapeHtml(item.descriptionLong); // Escape HTML entities in the description
                // Construct each line of item data according to the CIF format
                cifData += `${item.supplierID},${item.supplierAID},"${item.manufacturerAID}","${item.descriptionLong}",,${item.priceAmount},${item.orderUnit},${item.deliveryTime},"${item.manufacturerName}",,,0.00,USD,en_US,system:item,"{parametric_data_here}",TRUE,2023-09-12T00:00:00-07:00,2027-03-08T00:00:00-07:00,{custom="classification_code_here"},"${item.shortName}",,,,,,,,,,\n`;
            });

            cifData += cifFooter; // Append the footer
            return cifData;
        };

        // Convert the CatalogItems data to CIF format
        const cifData = convertJsonToCIF(catalogItems);

        // Base64 encode the CIF data
        const base64EncodedCifData = Buffer.from(cifData).toString('base64');

        // Function to generate the SOAP XML
        const generateSoapXml = (base64CifData) => {
            return `
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <n0:MasterDataReplReqMsg xmlns:n0="http://sap.com/xi/ARBCIG1" 
                xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
                xmlns:prx="urn:sap.com:proxy:Q8J:/1SAI/TASD374B56E2305E7E70622:750" 
                xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
                <Header>
                    <Parameters>
                        <Parameter name="realm">
                            <value>FAURECIASERVICESGROUPE-T</value>
                        </Parameter>
                        <Parameter name="Solution">
                            <value>BuyerCatalog</value>
                        </Parameter>
                        <Parameter name="Variant">
                            <value>vrealm_50611</value>
                        </Parameter>
                        <Parameter name="Partition">
                            <value>prealm_50611</value>
                        </Parameter>
                        <Parameter name="SubscriptionName">
                            <value>Catalog_EXT_Faurecia_Test_FR_v20.CIF</value>
                        </Parameter>
                        <Parameter name="FileID">
                            <value>32010aee-2528-1edc-83f5-4b1460cg</value>
                        </Parameter>
                        <Parameter name="FileName">
                            <value>BuyerCatalog20220622103266.CIF</value>
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
                            <value>2022-08-08T12:08:05+02:00</value>
                        </Parameter>
                        <!-- Other parameters here -->
                    </Parameters>
                    <AttachmentFolder contentID="cid:FOL184EXT97900000000984" contentLength="${base64CifData.length}" contentType="text/plain" fileName="BuyerCatalog20220622103266.CIF">
                        <Content>${base64CifData}</Content>
                    </AttachmentFolder>
                </Header>
            </n0:MasterDataReplReqMsg>
        </soap:Body>
    </soap:Envelope>
            `;
        };

        // Generate the SOAP XML
        const soapRequest = generateSoapXml(base64EncodedCifData);

        // Send the SOAP request using Axios
        const endpoint = 'https://testacig.ariba.com:443/cxf/receiveERPMD/'; // Replace with your actual endpoint URL
        const username = 'your-username';  // Replace with your username
        const password = 'your-password';  // Replace with your password
        const headers = {
            'Content-Type': 'application/xml', // Ensure correct Content-Type for SOAP
        };

        try {
            const response = await axios.post(endpoint, soapRequest, {
                headers, auth: {
                    username: "P000502",
                    password: "y[eT5Mk%"
                }
            });
            console.log('SOAP Response:', response.data); // Log the SOAP response
            return response.data; // Return the response to the caller
        } catch (error) {
            console.error('Error sending SOAP request:', error);
            return { error: error.message };
        }
    });

});