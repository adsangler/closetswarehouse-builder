import { fetchAirtableRecords, sendJson } from './_airtable.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const records = await fetchAirtableRecords('kitParts');
    sendJson(res, 200, { records });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}
