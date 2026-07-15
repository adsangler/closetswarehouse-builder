import { fetchAirtableRecords, sendJson } from './_airtable.js';
import { sanitizePublicKitRecords } from './_public-records.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const records = await fetchAirtableRecords('kits');
    sendJson(res, 200, { records: sanitizePublicKitRecords(records) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}
