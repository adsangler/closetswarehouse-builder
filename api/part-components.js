import { fetchAirtableRecords, sendJson } from './_airtable.js';
import { isInternalAirtableApiEnabled } from './_public-records.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!isInternalAirtableApiEnabled()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const records = await fetchAirtableRecords('partComponents');
    sendJson(res, 200, { records });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}
