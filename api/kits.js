import { fetchAirtableRecords, sendJson } from './_airtable.js';
import { sanitizePublicKitRecords } from './_public-records.js';
import { fetchActiveShopifyProductHandles } from './_shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const records = await fetchAirtableRecords('kits');
    let activeHandles = null;

    try {
      activeHandles = await fetchActiveShopifyProductHandles();
    } catch {
      // Fail closed for purchase links while still returning Airtable catalog
      // data needed for planning and price estimates.
      activeHandles = null;
    }
    const publicRecords = sanitizePublicKitRecords(records).map((record) => {
      const handle = String(record.fields.shopify_handle || record.fields.shopify_sku || '').trim().toLowerCase();

      return {
        ...record,
        fields: {
          ...record.fields,
          shopify_active: Boolean(activeHandles?.has(handle)),
        },
      };
    });

    sendJson(res, 200, { records: publicRecords });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}
