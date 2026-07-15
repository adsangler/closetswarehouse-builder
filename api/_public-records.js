const publicKitFieldNames = [
  'shopify_sku',
  'Kit Name',
  'Height',
  'Width',
  'Width Requirement',
  'retail_price',
  'shopify_handle',
  'KitID',
  'Status',
];

export function sanitizePublicKitRecords(records = []) {
  return records.map((record) => ({
    id: record.id,
    fields: Object.fromEntries(
      publicKitFieldNames
        .filter((fieldName) => Object.prototype.hasOwnProperty.call(record.fields || {}, fieldName))
        .map((fieldName) => [fieldName, record.fields[fieldName]]),
    ),
  }));
}

export function isInternalAirtableApiEnabled(env = process.env) {
  return env.ENABLE_INTERNAL_AIRTABLE_API === 'true';
}
