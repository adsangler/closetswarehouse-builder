const tableEnvKeys = {
  kits: 'AIRTABLE_KITS_TABLE',
  parts: 'AIRTABLE_PARTS_TABLE',
  kitParts: 'AIRTABLE_KIT_PARTS_TABLE',
};

function getAirtableConfig(tableKey) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env[tableEnvKeys[tableKey]];

  if (!token || !baseId || !tableName) {
    throw new Error(`Missing Airtable env config for ${tableKey}`);
  }

  return { token, baseId, tableName };
}

export async function fetchAirtableRecords(tableKey) {
  const { token, baseId, tableName } = getAirtableConfig(tableKey);
  const records = [];
  let offset;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
    url.searchParams.set('pageSize', '100');

    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable returned ${response.status}`);
    }

    const payload = await response.json();
    records.push(...payload.records);
    offset = payload.offset;
  } while (offset);

  return records;
}

export async function createAirtableQuote(quote) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_QUOTES_TABLE;

  if (!token || !baseId || !tableName) {
    return null;
  }

  let response;

  try {
    response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          Name: quote.customer?.name || '',
          Email: quote.customer?.email || '',
          Phone: quote.customer?.phone || '',
          Status: 'New',
          Source: 'Closet planner',
          'Wall Width': quote.wallWidth,
          Height: quote.height,
          'Assembled Width': quote.assembledWidth,
          'Required Width': quote.requiredWidth,
          'Estimated Price': quote.estimatedPrice,
          Signature: quote.signature,
          Modules: quote.modules?.map((module) => `${module.code}-${module.width}`).join(', '),
          'Quote JSON': JSON.stringify(quote),
        },
      }),
    });
  } catch {
    return null;
  }

  if (response.status === 403 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Airtable quote capture returned ${response.status}`);
  }

  return response.json();
}

export async function sendConfirmationEmail(quote) {
  if (!process.env.EMAIL_WEBHOOK_URL) {
    return { sent: false, reason: 'EMAIL_WEBHOOK_URL is not configured' };
  }

  const planLines = [
    `Reference: ${quote.quoteId || 'pending'}`,
    `Customer: ${quote.customer?.name || ''}`,
    `Email: ${quote.customer?.email || ''}`,
    `Phone: ${quote.customer?.phone || ''}`,
    `Type: ${quote.planType || quote.internalType || 'closet plan'}`,
    `Estimated price: ${quote.estimatedPrice || ''}`,
    `Signature: ${quote.signature || ''}`,
    quote.planUrl ? `Plan URL: ${quote.planUrl}` : '',
    '',
    'Modules:',
    ...(quote.modules || []).map((module) => `${module.wall ? `${module.wall}: ` : ''}${module.index + 1}. ${module.code}-${module.width}`),
  ].filter(Boolean);

  const response = await fetch(process.env.EMAIL_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: 'office@closetswarehouse.com',
      subject: `Closets Warehouse estimate verification: ${quote.customer?.name || quote.quoteId || 'new request'}`,
      text: planLines.join('\n'),
      quote,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email webhook returned ${response.status}`);
  }

  return { sent: true };
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}
