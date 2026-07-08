import { fetchAirtableRecords, sendJson } from './_airtable.js';
import { buildResolvedParts } from './_part-pricing.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const [parts, components, partComponents] = await Promise.all([
      fetchAirtableRecords('parts'),
      fetchAirtableRecords('components'),
      fetchAirtableRecords('partComponents'),
    ]);

    sendJson(res, 200, {
      records: buildResolvedParts({ parts, components, partComponents }),
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}
