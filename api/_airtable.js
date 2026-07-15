const tableEnvKeys = {
  kits: 'AIRTABLE_KITS_TABLE',
  parts: 'AIRTABLE_PARTS_TABLE',
  kitParts: 'AIRTABLE_KIT_PARTS_TABLE',
  components: 'AIRTABLE_COMPONENTS_TABLE',
  partComponents: 'AIRTABLE_PART_COMPONENTS_TABLE',
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

function getQuoteConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_QUOTES_TABLE;

  if (!token || !baseId || !tableName) {
    return null;
  }

  return { token, baseId, tableName };
}

function getQuoteFieldNames() {
  return {
    quoteId: process.env.AIRTABLE_QUOTES_ID_FIELD || 'Quote ID',
    planUrl: process.env.AIRTABLE_QUOTES_PLAN_URL_FIELD || 'Plan URL',
    planType: process.env.AIRTABLE_QUOTES_PLAN_TYPE_FIELD || 'Plan Type',
    submittedAt: process.env.AIRTABLE_QUOTES_SUBMITTED_AT_FIELD || 'Submitted At',
    shopifyCustomerId: process.env.AIRTABLE_QUOTES_SHOPIFY_CUSTOMER_ID_FIELD || 'Shopify Customer ID',
    shopifyCustomerEmail: process.env.AIRTABLE_QUOTES_SHOPIFY_CUSTOMER_EMAIL_FIELD || 'Shopify Customer Email',
  };
}

function escapeAirtableString(value) {
  return String(value || '').replace(/'/g, "\\'");
}

function compactFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function getCustomerDisplayName(customer = {}) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.name || '';
}

function parseQuoteRecord(record, fallbackQuoteId = '') {
  const fieldNames = getQuoteFieldNames();
  let quoteJson = null;

  try {
    quoteJson = JSON.parse(record.fields?.['Quote JSON'] || 'null');
  } catch {
    quoteJson = null;
  }

  return {
    id: record.id,
    quoteId: record.fields?.[fieldNames.quoteId] || quoteJson?.quoteId || fallbackQuoteId,
    customer: {
      name: record.fields?.Name || getCustomerDisplayName(quoteJson?.customer) || '',
      firstName: quoteJson?.customer?.firstName || '',
      lastName: quoteJson?.customer?.lastName || '',
      email: record.fields?.Email || quoteJson?.customer?.email || '',
      phone: record.fields?.Phone || quoteJson?.customer?.phone || '',
    },
    planUrl: record.fields?.[fieldNames.planUrl] || quoteJson?.planUrl || '',
    planType: record.fields?.[fieldNames.planType] || quoteJson?.planType || quoteJson?.internalType || '',
    submittedAt: record.fields?.[fieldNames.submittedAt] || quoteJson?.submittedAt || '',
    status: record.fields?.Status || '',
    estimatedPrice: record.fields?.['Estimated Price'] || quoteJson?.estimatedPrice || 0,
    quote: quoteJson,
  };
}

async function airtableRequest(config, path = '', options = {}) {
  const response = await fetch(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableName)}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  return { response, payload, text };
}

function buildLegacyQuoteFields(quote) {
  return compactFields({
    Name: getCustomerDisplayName(quote.customer),
    'First Name': quote.customer?.firstName || '',
    'Last Name': quote.customer?.lastName || '',
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
    Modules: quote.modules?.map((module) => `${module.wall ? `${module.wall}:` : ''}${module.code}-${module.width}`).join(', '),
    'Quote JSON': JSON.stringify(quote),
  });
}

function buildEnrichedQuoteFields(quote, shopifyCustomer = null) {
  const fieldNames = getQuoteFieldNames();

  return {
    ...buildLegacyQuoteFields(quote),
    ...compactFields({
      [fieldNames.quoteId]: quote.quoteId,
      [fieldNames.planUrl]: quote.planUrl,
      [fieldNames.planType]: quote.planType || quote.internalType || 'closet plan',
      [fieldNames.submittedAt]: quote.submittedAt,
      [fieldNames.shopifyCustomerId]: shopifyCustomer?.customerId,
      [fieldNames.shopifyCustomerEmail]: shopifyCustomer?.customerEmail,
    }),
  };
}

export async function createAirtableQuote(quote) {
  const config = getQuoteConfig();

  if (!config) {
    return null;
  }

  const payload = {
    fields: buildEnrichedQuoteFields(quote),
  };

  try {
    const { response, payload: result, text } = await airtableRequest(config, '', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.status === 403 || response.status === 404) {
      return null;
    }

    if (response.ok) {
      return result;
    }

    if (!/UNKNOWN_FIELD_NAME|Unknown field name|INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(text)) {
      throw new Error(`Airtable quote capture returned ${response.status}`);
    }

    const fallback = await airtableRequest(config, '', {
      method: 'POST',
      body: JSON.stringify({ fields: buildLegacyQuoteFields(quote) }),
    });

    if (!fallback.response.ok) {
      throw new Error(`Airtable quote capture returned ${fallback.response.status}`);
    }

    return fallback.payload;
  } catch {
    return null;
  }
}

export async function updateAirtableQuoteShopifyCustomer(recordId, quote, shopifyCustomer) {
  const config = getQuoteConfig();

  if (!config || !recordId || !shopifyCustomer?.customerId) {
    return null;
  }

  const fields = buildEnrichedQuoteFields(quote, shopifyCustomer);

  try {
    const { response, payload } = await airtableRequest(config, `/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });

    if (response.ok) {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}

export async function fetchAirtableQuoteByReference({ quoteId, email }) {
  const config = getQuoteConfig();

  if (!config) {
    return null;
  }

  const fieldNames = getQuoteFieldNames();
  const normalizedQuoteId = String(quoteId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedQuoteId || !normalizedEmail) {
    throw new Error('Quote ID and email are required');
  }

  const formula = `AND({${fieldNames.quoteId}} = '${escapeAirtableString(normalizedQuoteId)}', LOWER({Email}) = '${escapeAirtableString(normalizedEmail)}')`;
  const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableName)}`);
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('filterByFormula', formula);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Airtable quote lookup returned ${response.status}`);
  }

  const payload = await response.json();
  const record = payload.records?.[0];

  if (!record) {
    return null;
  }

  return parseQuoteRecord(record, normalizedQuoteId);
}

export async function fetchAirtableQuotesByShopifyCustomerId(shopifyCustomerId) {
  const config = getQuoteConfig();

  if (!config) {
    return [];
  }

  const fieldNames = getQuoteFieldNames();
  const rawCustomerId = String(shopifyCustomerId || '').trim();

  if (!rawCustomerId) {
    throw new Error('Shopify customer ID is required');
  }

  const numericCustomerId = rawCustomerId.match(/(\d+)$/)?.[1] || rawCustomerId;
  const gidCustomerId = rawCustomerId.startsWith('gid://') ? rawCustomerId : `gid://shopify/Customer/${numericCustomerId}`;
  const formula = `OR({${fieldNames.shopifyCustomerId}} = '${escapeAirtableString(rawCustomerId)}', {${fieldNames.shopifyCustomerId}} = '${escapeAirtableString(gidCustomerId)}')`;
  const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableName)}`);
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('filterByFormula', formula);
  url.searchParams.set('sort[0][field]', fieldNames.submittedAt);
  url.searchParams.set('sort[0][direction]', 'desc');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Airtable customer quote lookup returned ${response.status}`);
  }

  const payload = await response.json();

  return (payload.records || []).map((record) => parseQuoteRecord(record));
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
