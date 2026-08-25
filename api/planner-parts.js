import { fetchAirtableRecords, sendJson } from './_airtable.js';
import { buildResolvedParts } from './_part-pricing.js';

const allowedPatterns = [
  /^SH-(18|24|30)-14-W$/i,
  /^RK-(18|24|30)-S$/i,
  /^DRK-24-5-13-W$/i,
  /^DRK-24-10-13-W$/i,
];

function textField(fields, names) {
  for (const name of names) {
    const value = fields?.[name];
    if (Array.isArray(value) ? value[0] : value) return String(Array.isArray(value) ? value[0] : value).trim();
  }
  return '';
}

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
    const records = buildResolvedParts({ parts, components, partComponents })
      .filter((record) => allowedPatterns.some((pattern) => pattern.test(record.resolved.sku)))
      .map((record) => ({
        id: record.id,
        sku: record.resolved.sku,
        name: record.resolved.name,
        price: record.resolved.price,
        shopifyHandle: textField(record.fields, ['shopify_handle', 'Shopify Handle']) || record.resolved.sku.toLowerCase(),
        status: textField(record.fields, ['Status']) || 'active',
      }));
    sendJson(res, 200, { records });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}
