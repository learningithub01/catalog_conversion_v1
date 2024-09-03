using my.project as db from '../db/schema';

service MyService {
    entity CatalogItems as projection on db.CatalogItems;
    action receiveXML(xmlData: String);  // Ensure xmlData is defined as String if you send JSON string
}
