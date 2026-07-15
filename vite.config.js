import fs from 'node:fs/promises';
import path from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { buildResolvedParts } from './api/_part-pricing.js';
import { normalizeQuoteSubmission, validateNormalizedQuote } from './api/_quote-normalize.js';
import { isInternalAirtableApiEnabled, sanitizePublicKitRecords } from './api/_public-records.js';
import { fetchShopifyCustomerContact, upsertShopifyCustomerPlan } from './api/_shopify.js';

const airtableTables = {
  '/api/kits': 'AIRTABLE_KITS_TABLE',
  '/api/parts': 'AIRTABLE_PARTS_TABLE',
  '/api/kit-parts': 'AIRTABLE_KIT_PARTS_TABLE',
  '/api/components': 'AIRTABLE_COMPONENTS_TABLE',
  '/api/part-components': 'AIRTABLE_PART_COMPONENTS_TABLE',
};

function airtableProxy(env) {
  return {
    name: 'airtable-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        const tableEnvKey = airtableTables[pathname];

        if (!tableEnvKey) {
          next();
          return;
        }

        const token = env.AIRTABLE_TOKEN;
        const baseId = env.AIRTABLE_BASE_ID;
        const tableName = env[tableEnvKey];
        const isPublicKitRequest = pathname === '/api/kits';

        if (!token || !baseId || !tableName) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Missing Airtable env config for ${pathname}` }));
          return;
        }

        if (!isPublicKitRequest && !isInternalAirtableApiEnabled(env)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        const records = [];
        let offset;

        try {
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

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ records: isPublicKitRequest ? sanitizePublicKitRecords(records) : records }));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

async function fetchAirtableRecords(env, tableEnvKey) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env[tableEnvKey];

  if (!token || !baseId || !tableName) {
    throw new Error(`Missing Airtable env config for ${tableEnvKey}`);
  }

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

function resolvedPartsProxy(env) {
  return {
    name: 'resolved-parts-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (pathname !== '/api/parts-resolved') {
          next();
          return;
        }

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const [parts, components, partComponents] = await Promise.all([
            fetchAirtableRecords(env, 'AIRTABLE_PARTS_TABLE'),
            fetchAirtableRecords(env, 'AIRTABLE_COMPONENTS_TABLE'),
            fetchAirtableRecords(env, 'AIRTABLE_PART_COMPONENTS_TABLE'),
          ]);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ records: buildResolvedParts({ parts, components, partComponents }) }));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function createQuoteId(date = new Date()) {
  const timestamp = date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = randomBytes(3).toString('hex').toUpperCase();

  return `CWQ-${timestamp}-${suffix}`;
}

function compactFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function getQuoteFieldNames(env) {
  return {
    quoteId: env.AIRTABLE_QUOTES_ID_FIELD || 'Quote ID',
    planUrl: env.AIRTABLE_QUOTES_PLAN_URL_FIELD || 'Plan URL',
    planType: env.AIRTABLE_QUOTES_PLAN_TYPE_FIELD || 'Plan Type',
    submittedAt: env.AIRTABLE_QUOTES_SUBMITTED_AT_FIELD || 'Submitted At',
    shopifyCustomerId: env.AIRTABLE_QUOTES_SHOPIFY_CUSTOMER_ID_FIELD || 'Shopify Customer ID',
    shopifyCustomerEmail: env.AIRTABLE_QUOTES_SHOPIFY_CUSTOMER_EMAIL_FIELD || 'Shopify Customer Email',
  };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function phoneMatches(left, right) {
  const normalizedLeft = normalizePhone(left);
  const normalizedRight = normalizePhone(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight
    || (normalizedLeft.length >= 10
      && normalizedRight.length >= 10
      && normalizedLeft.slice(-10) === normalizedRight.slice(-10));
}

function emailMatches(left, right) {
  return normalizeEmail(left) === normalizeEmail(right);
}

function buildLegacyQuoteFields(quote) {
  const customerName = [quote.customer?.firstName, quote.customer?.lastName].filter(Boolean).join(' ').trim() || quote.customer?.name || '';

  return compactFields({
    Name: customerName,
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

function buildEnrichedQuoteFields(env, quote) {
  const fieldNames = getQuoteFieldNames(env);

  return {
    ...buildLegacyQuoteFields(quote),
    ...compactFields({
      [fieldNames.quoteId]: quote.quoteId,
      [fieldNames.planUrl]: quote.planUrl,
      [fieldNames.planType]: quote.planType || quote.internalType || 'closet plan',
      [fieldNames.submittedAt]: quote.submittedAt,
      [fieldNames.shopifyCustomerId]: quote.shopifyCustomer?.customerId,
      [fieldNames.shopifyCustomerEmail]: quote.shopifyCustomer?.customerEmail,
    }),
  };
}

function buildCoreQuoteFields(env, quote) {
  const fieldNames = getQuoteFieldNames(env);

  return {
    ...buildLegacyQuoteFields(quote),
    ...compactFields({
      [fieldNames.quoteId]: quote.quoteId,
      [fieldNames.planUrl]: quote.planUrl,
      [fieldNames.planType]: quote.planType || quote.internalType || 'closet plan',
      [fieldNames.submittedAt]: quote.submittedAt,
    }),
  };
}

function buildRequiredQuoteFields(env, quote) {
  const fieldNames = getQuoteFieldNames(env);

  return compactFields({
    [fieldNames.quoteId]: quote.quoteId,
    Email: quote.customer?.email || '',
    Phone: quote.customer?.phone || '',
    'Quote JSON': JSON.stringify(quote),
  });
}

async function fetchAirtableQuoteRecords(env, configureUrl = () => {}) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env.AIRTABLE_QUOTES_TABLE || 'Quotes';
  const records = [];
  let offset;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
    url.searchParams.set('pageSize', '100');
    configureUrl(url);

    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable quote lookup returned ${response.status}`);
    }

    const payload = await response.json();
    records.push(...(payload.records || []));
    offset = payload.offset;
  } while (offset);

  return records;
}

function applyServerEnv(env, keys) {
  keys.forEach((key) => {
    if (env[key] && !process.env[key]) {
      process.env[key] = env[key];
    }
  });
}

async function createAirtableQuote(env, quote) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env.AIRTABLE_QUOTES_TABLE || 'Quotes';

  if (!token || !baseId || !tableName) {
    return { record: null, error: 'missing_airtable_quote_env' };
  }

  const tableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const parseResult = async (response) => {
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    return { response, text, payload };
  };
  const getMessage = (result) => String(result.payload?.error?.message || result.payload?.error?.type || result.text || '').replace(/\s+/g, ' ').slice(0, 220);
  const shouldFallback = (result) => /UNKNOWN_FIELD_NAME|Unknown field name|INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(getMessage(result));
  const getFailureReason = (result, mode) => {
    const message = getMessage(result);

    if (result.response.status === 401 || result.response.status === 403) {
      return `${mode}: airtable_auth_${result.response.status}`;
    }

    if (result.response.status === 404) {
      return `${mode}: airtable_table_not_found`;
    }

    if (/UNKNOWN_FIELD_NAME|Unknown field name/i.test(message)) {
      return `${mode}: airtable_unknown_field (${message})`;
    }

    if (/INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(message)) {
      return `${mode}: airtable_invalid_select_option (${message})`;
    }

    return `${mode}: airtable_${result.response.status}${message ? ` (${message})` : ''}`;
  };

  try {
    const response = await fetch(tableUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: buildEnrichedQuoteFields(env, quote),
      }),
    });
    const enrichedResult = await parseResult(response);

    if (enrichedResult.response.ok) {
      return { record: enrichedResult.payload, mode: 'enriched' };
    }

    if (!shouldFallback(enrichedResult)) {
      return { record: null, error: getFailureReason(enrichedResult, 'enriched') };
    }

    const coreFallback = await parseResult(await fetch(tableUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields: buildCoreQuoteFields(env, quote) }),
    }));

    if (coreFallback.response.ok) {
      return { record: coreFallback.payload, mode: 'core' };
    }

    if (!shouldFallback(coreFallback)) {
      return { record: null, error: getFailureReason(coreFallback, 'core') };
    }

    const requiredFallback = await parseResult(await fetch(tableUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields: buildRequiredQuoteFields(env, quote) }),
    }));

    if (!requiredFallback.response.ok) {
      return { record: null, error: getFailureReason(requiredFallback, 'minimal') };
    }

    return { record: requiredFallback.payload, mode: 'minimal' };
  } catch (error) {
    return { record: null, error: `airtable_request_failed (${String(error?.message || error).slice(0, 160)})` };
  }
}

async function updateAirtableQuoteShopifyCustomer(env, recordId, quote, shopifyCustomer) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env.AIRTABLE_QUOTES_TABLE || 'Quotes';

  if (!token || !baseId || !tableName || !recordId || !shopifyCustomer?.customerId) {
    return null;
  }

  const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: buildEnrichedQuoteFields(env, { ...quote, shopifyCustomer }),
    }),
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function fetchAirtableQuoteByReference(env, { quoteId, email }) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env.AIRTABLE_QUOTES_TABLE || 'Quotes';

  if (!token || !baseId || !tableName) {
    return null;
  }

  const normalizedQuoteId = String(quoteId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedQuoteId || !normalizedEmail) {
    throw new Error('Quote ID and email are required');
  }

  const fieldNames = getQuoteFieldNames(env);
  const formula = `AND({${fieldNames.quoteId}} = '${normalizedQuoteId.replace(/'/g, "\\'")}', LOWER({Email}) = '${normalizedEmail.replace(/'/g, "\\'")}')`;
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('filterByFormula', formula);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
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

  let quoteJson = null;
  try {
    quoteJson = JSON.parse(record.fields?.['Quote JSON'] || 'null');
  } catch {
    quoteJson = null;
  }

  return {
    id: record.id,
    quoteId: record.fields?.[fieldNames.quoteId] || normalizedQuoteId,
    customer: {
      name: record.fields?.Name || quoteJson?.customer?.name || '',
      email: record.fields?.Email || quoteJson?.customer?.email || '',
      phone: record.fields?.Phone || quoteJson?.customer?.phone || '',
    },
    planUrl: record.fields?.[fieldNames.planUrl] || quoteJson?.planUrl || '',
    planType: record.fields?.[fieldNames.planType] || quoteJson?.planType || quoteJson?.internalType || '',
    submittedAt: record.fields?.[fieldNames.submittedAt] || quoteJson?.submittedAt || '',
    quote: quoteJson,
  };
}

function parseQuoteRecord(env, record, fallbackQuoteId = '') {
  const fieldNames = getQuoteFieldNames(env);
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
      name: record.fields?.Name || quoteJson?.customer?.name || '',
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

async function fetchAirtableQuotesByShopifyCustomerId(env, shopifyCustomerId) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env.AIRTABLE_QUOTES_TABLE || 'Quotes';

  if (!token || !baseId || !tableName) {
    return [];
  }

  const rawCustomerId = String(shopifyCustomerId || '').trim();

  if (!rawCustomerId) {
    throw new Error('Shopify customer ID is required');
  }

  const fieldNames = getQuoteFieldNames(env);
  const numericCustomerId = rawCustomerId.match(/(\d+)$/)?.[1] || rawCustomerId;
  const gidCustomerId = rawCustomerId.startsWith('gid://') ? rawCustomerId : `gid://shopify/Customer/${numericCustomerId}`;
  const formula = `OR({${fieldNames.shopifyCustomerId || 'Shopify Customer ID'}} = '${rawCustomerId.replace(/'/g, "\\'")}', {${fieldNames.shopifyCustomerId || 'Shopify Customer ID'}} = '${gidCustomerId.replace(/'/g, "\\'")}')`;
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('filterByFormula', formula);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Airtable customer quote lookup returned ${response.status}`);
  }

  const payload = await response.json();

  return (payload.records || []).map((record) => parseQuoteRecord(env, record));
}

async function fetchAirtableQuotesByContact(env, { email, phone }, { requirePhone = true } = {}) {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tableName = env.AIRTABLE_QUOTES_TABLE || 'Quotes';

  if (!token || !baseId || !tableName) {
    return [];
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail || (requirePhone && !normalizedPhone)) {
    throw new Error('Email and phone are required');
  }

  const fieldNames = getQuoteFieldNames(env);
  const filterMatches = (quote) => {
    const matchesEmail = emailMatches(quote.customer?.email, normalizedEmail)
      || emailMatches(quote.quote?.customer?.email, normalizedEmail);
    const matchesPhone = !normalizedPhone
      || phoneMatches(quote.customer?.phone, normalizedPhone)
      || phoneMatches(quote.quote?.customer?.phone, normalizedPhone);

    return matchesEmail && matchesPhone;
  };

  const records = await fetchAirtableQuoteRecords(env, (url) => {
    url.searchParams.set('filterByFormula', `LOWER({Email}) = '${normalizedEmail.replace(/'/g, "\\'")}'`);
    url.searchParams.set('sort[0][field]', fieldNames.submittedAt);
    url.searchParams.set('sort[0][direction]', 'desc');
  });
  const quotes = records.map((record) => parseQuoteRecord(env, record)).filter(filterMatches);

  if (quotes.length) {
    return quotes;
  }

  const fallbackRecords = await fetchAirtableQuoteRecords(env, (url) => {
    url.searchParams.set('sort[0][field]', fieldNames.submittedAt);
    url.searchParams.set('sort[0][direction]', 'desc');
  });

  return fallbackRecords.map((record) => parseQuoteRecord(env, record)).filter(filterMatches);
}

function getShopifyProxySecret(env) {
  return env.SHOPIFY_API_SECRET
    || env.SHOPIFY_CLIENT_SECRET
    || env.SHOPIFY_APP_SECRET
    || process.env.SHOPIFY_API_SECRET
    || process.env.SHOPIFY_CLIENT_SECRET
    || process.env.SHOPIFY_APP_SECRET;
}

function constantTimeEqual(left = '', right = '') {
  const expected = Buffer.from(String(left), 'utf8');
  const actual = Buffer.from(String(right), 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getSignaturePayloads(requestUrl) {
  const decodedParams = new URLSearchParams(requestUrl.search);
  decodedParams.delete('signature');
  decodedParams.delete('hmac');
  const groupedDecodedEntries = [...decodedParams.keys()]
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .map((key) => [key, decodedParams.getAll(key).join(',')])
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const decodedEntries = [...decodedParams.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const rawEntries = String(requestUrl.search || '')
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const separatorIndex = pair.indexOf('=');
      return separatorIndex === -1
        ? [pair, '']
        : [pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1)];
    })
    .filter(([key]) => key !== 'signature' && key !== 'hmac')
    .sort(([leftKey], [rightKey]) => decodeURIComponent(leftKey).localeCompare(decodeURIComponent(rightKey)));

  return [
    groupedDecodedEntries.map(([key, value]) => `${key}=${value}`).join(''),
    decodedEntries.map(([key, value]) => `${key}=${value}`).join(''),
    decodedEntries.map(([key, value]) => `${key}=${value}`).join('&'),
    rawEntries.map(([key, value]) => `${key}=${value}`).join(''),
    rawEntries.map(([key, value]) => `${key}=${value}`).join('&'),
  ].filter((payload, index, payloads) => payload && payloads.indexOf(payload) === index);
}

function verifyShopifyAppProxySignature(env, requestUrl) {
  const secret = getShopifyProxySecret(env);

  if (!secret) {
    return process.env.NODE_ENV !== 'production'
      ? { ok: true }
      : { ok: false, reason: 'missing_secret' };
  }

  const signature = requestUrl.searchParams.get('signature') || requestUrl.searchParams.get('hmac');

  if (!signature) {
    return { ok: false, reason: 'missing_signature' };
  }

  const ok = getSignaturePayloads(requestUrl).some((message) => {
    const digest = createHmac('sha256', secret).update(message).digest('hex');
    return constantTimeEqual(digest, signature);
  });

  return ok ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}

function getProxyErrorMessage(reason) {
  if (reason === 'missing_secret') {
    return 'Plans lookup is connected, but the deployment is missing the Shopify app secret.';
  }

  if (reason === 'signature_mismatch') {
    return 'Plans lookup reached Shopify, but the Shopify app secret does not match this deployment.';
  }

  return 'This plans lookup must be opened through closetswarehouse.com.';
}

async function sendConfirmationEmail(env, quote) {
  if (!env.EMAIL_WEBHOOK_URL) {
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

  const response = await fetch(env.EMAIL_WEBHOOK_URL, {
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

function quoteRequestProxy(env) {
  return {
    name: 'quote-request-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (pathname === '/api/customer-quotes') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          try {
            const requestUrl = new URL(req.url || '', 'http://localhost');

            const proxyAuth = verifyShopifyAppProxySignature(env, requestUrl);
            if (!proxyAuth.ok) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'Unauthorized customer quote request',
                reason: proxyAuth.reason,
                message: getProxyErrorMessage(proxyAuth.reason),
              }));
              return;
            }

            const customerId = requestUrl.searchParams.get('logged_in_customer_id') || requestUrl.searchParams.get('customerId');
            const email = requestUrl.searchParams.get('email') || '';
            const phone = requestUrl.searchParams.get('phone') || '';
            const manualContactProvided = normalizeEmail(email) && normalizePhone(phone).length >= 7;

            if (!customerId && !manualContactProvided) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Email and phone are required' }));
              return;
            }

            let quotes = [];
            let matchedBy = '';
            let message = '';

            if (customerId) {
              quotes = await fetchAirtableQuotesByShopifyCustomerId(env, customerId);
              matchedBy = quotes.length ? 'customer' : '';

              if (!quotes.length && !manualContactProvided) {
                try {
                  applyServerEnv(env, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN', 'SHOPIFY_API_VERSION']);
                  const accountContact = await fetchShopifyCustomerContact(customerId);

                  if (normalizeEmail(accountContact?.customer?.email)) {
                    quotes = await fetchAirtableQuotesByContact(env, accountContact.customer, { requirePhone: false });
                    matchedBy = quotes.length ? 'account_email' : '';
                    message = quotes.length
                      ? ''
                      : 'We could not find a saved plan for the email on your customer account. Enter the email and phone used when you saved the plan.';
                  } else {
                    message = 'Enter the email and phone used when you saved the plan.';
                  }
                } catch (error) {
                  message = 'Enter the email and phone used when you saved the plan.';
                }
              }

              if (!quotes.length && manualContactProvided) {
                quotes = await fetchAirtableQuotesByContact(env, { email, phone });
                matchedBy = quotes.length ? 'manual_contact' : '';
              }
            } else {
              quotes = await fetchAirtableQuotesByContact(env, { email, phone });
              matchedBy = quotes.length ? 'manual_contact' : '';
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ok: true,
              customerId,
              email: matchedBy === 'manual_contact' ? email : undefined,
              matchedBy,
              needsContact: !quotes.length,
              message: !quotes.length
                ? message || 'No saved plans matched that email and phone. Check the details you used when saving the plan.'
                : undefined,
              quotes: quotes.map(({ quote, ...summary }) => summary),
            }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (pathname !== '/api/quote-requests') {
          next();
          return;
        }

        if (req.method === 'GET') {
          try {
            const requestUrl = new URL(req.url || '', 'http://localhost');
            const quote = await fetchAirtableQuoteByReference(env, {
              quoteId: requestUrl.searchParams.get('quoteId'),
              email: requestUrl.searchParams.get('email'),
            });

            if (!quote) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Quote not found' }));
              return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, quote }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const body = await readRequestBody(req);
          const quote = JSON.parse(body || '{}');
          const submittedDate = new Date();
          const submittedAt = submittedDate.toISOString();
          const quoteId = createQuoteId(submittedDate);
          const capturedQuote = normalizeQuoteSubmission(quote, { quoteId, submittedAt });
          const validationError = validateNormalizedQuote(capturedQuote);

          if (validationError) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: validationError }));
            return;
          }

          applyServerEnv(env, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN', 'SHOPIFY_API_VERSION']);
          const airtableResult = await createAirtableQuote(env, capturedQuote);
          const airtableRecord = airtableResult.record;

          if (!airtableRecord?.id) {
            const outDir = path.resolve('assets/drafts/quote-requests');
            await fs.mkdir(outDir, { recursive: true });
            await fs.writeFile(path.join(outDir, `${quoteId}.json`), JSON.stringify(capturedQuote, null, 2), 'utf8');

            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            const reason = airtableResult.error ? ` Airtable reason: ${airtableResult.error}.` : '';
            res.end(JSON.stringify({ error: `We could not save this plan to Airtable. Please try again before printing the reference.${reason}` }));
            return;
          }

          let shopifyCustomer = null;

          try {
            shopifyCustomer = await upsertShopifyCustomerPlan(capturedQuote);
          } catch {
            shopifyCustomer = null;
          }

          if (airtableRecord?.id && shopifyCustomer?.customerId) {
            await updateAirtableQuoteShopifyCustomer(env, airtableRecord.id, capturedQuote, shopifyCustomer);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            quoteId,
            captureMode: 'airtable',
            airtableMode: airtableResult.mode || 'unknown',
            shopifyCustomer: shopifyCustomer ? { configured: shopifyCustomer.configured, created: shopifyCustomer.created } : null,
          }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

function photoDraftsProxy() {
  const draftsDir = path.resolve('assets/drafts/generated-photos');

  return {
    name: 'photo-drafts-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');

        if (requestUrl.pathname === '/api/photo-drafts') {
          try {
            await fs.mkdir(draftsDir, { recursive: true });
            const entries = await fs.readdir(draftsDir, { withFileTypes: true });
            const photos = entries
              .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name))
              .map((entry) => ({
                name: entry.name,
                url: `/api/photo-drafts/file?name=${encodeURIComponent(entry.name)}`,
              }))
              .sort((left, right) => right.name.localeCompare(left.name));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ photos }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (requestUrl.pathname === '/api/photo-drafts/file') {
          const requestedName = requestUrl.searchParams.get('name') || '';
          const safeName = path.basename(requestedName);

          if (!safeName || safeName !== requestedName || !/\.(png|jpe?g|webp)$/i.test(safeName)) {
            res.statusCode = 400;
            res.end('Invalid photo name');
            return;
          }

          try {
            const image = await fs.readFile(path.join(draftsDir, safeName));
            const extension = path.extname(safeName).toLowerCase();
            const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-store');
            res.end(image);
          } catch (error) {
            res.statusCode = error.code === 'ENOENT' ? 404 : 500;
            res.end(error.code === 'ENOENT' ? 'Photo not found' : error.message);
          }
          return;
        }

        next();
      });
    },
  };
}

function buildPhotoPrompt({ handle, height, assembledWidth, towerSpecs, shot }) {
  const towers = (towerSpecs || []).map((tower) => `${tower.code} ${tower.width}-inch`).join(' + ');
  const cabinetWidth = Number(assembledWidth) || 0;
  const cabinetAspectRatio = (cabinetWidth / (Number(height) || 1)).toFixed(4);
  const finishedCavityWidth = Number((cabinetWidth + 2).toFixed(2));
  const finishedCavityHeight = Number(height) + 1;
  const towerRules = (towerSpecs || []).map((tower, index) => {
    const code = String(tower.code || '').toUpperCase();
    const prefix = `Tower ${index + 1}, ${code}, ${tower.width}-inch nominal bay:`;
    const rules = {
      LH: 'fixed top and bottom frame shelves; one adjustable upper shelf about 18 inches below the top; exactly one chrome rod directly below that upper shelf; no middle shelf anywhere in the open long-hang bay; absolutely no drawers.',
      DH: 'fixed top and bottom frame shelves; exactly one middle adjustable shelf dividing the bay; exactly two chrome rods, the upper rod directly below the top shelf and the lower rod directly below the middle shelf; absolutely no drawers.',
      HS: 'exactly one chrome rod at the very top/front with NO shelf or cubby above the rod; exactly four lower horizontal shelf boards total including the bottom fixed shelf; absolutely no drawers and no second rod.',
      S3D: 'no rod; exactly three proud overlay drawers, two small drawers above one large drawer, each with one centered horizontal brushed-nickel straight bar pull; upper shelves evenly divide the space above the drawer deck; one adjustable shelf centered in the lower open space.',
      H3D: 'exactly one upper chrome rod above the drawer deck; exactly three proud overlay drawers, two small above one large, each with one centered horizontal brushed-nickel straight bar pull; one adjustable shelf centered in the lower open space.',
      S2D: 'no rod; exactly two small proud overlay drawers, each with one centered horizontal brushed-nickel straight bar pull; upper shelves evenly divide the space above the drawer deck; one adjustable shelf centered in the lower open space.',
      S7: 'no rods and no drawers; exactly SEVEN storage compartments above the toe kick, bounded by exactly EIGHT horizontal boards total: 1 top fixed frame board + exactly 6 adjustable internal shelf boards + 1 bottom shelf board. Count all visible horizontal boards from top to bottom and stop at 8. The toe-kick board is vertical and never counts as a shelf or compartment. Do not add an eighth storage compartment or a ninth horizontal board.',
      S8: 'no rods and no drawers; exactly EIGHT storage compartments above the toe kick, bounded by exactly NINE horizontal boards total: 1 top fixed frame board + exactly 7 adjustable internal shelf boards + 1 bottom shelf board. Count all visible horizontal boards from top to bottom and stop at 9. The toe-kick board is vertical and never counts as a shelf or compartment. Do not add a ninth storage compartment or a tenth horizontal board.',
    };

    return `${prefix} ${rules[code] || 'preserve the supplied render exactly.'}`;
  });
  const installedScene = shot.scene === 'reach-in';
  const walkInScene = shot.scene === 'walk-in';
  const doorRule = shot.bifoldDoorSets === 1
    ? 'Use exactly ONE bi-fold door unit total: exactly two hinged panels connected together and folded accordion-style to one jamb only. Do not put a door on the opposite jamb.'
    : shot.bifoldDoorSets === 2
      ? 'Use exactly TWO bi-fold door units total: one two-panel hinged unit folded to the left jamb and one two-panel hinged unit folded to the right jamb.'
      : '';

  return [
    `Create a photorealistic square Shopify product hero for ${handle}.`,
    `The supplied image is the exact geometry source of truth: ${towers}, ${height}-inch height. Preserve every panel, shared divider, shelf, rod, drawer, handle, hanger, and recessed toe kick exactly.`,
    `DIMENSION LOCK FOR EVERY PHOTO IN THIS SKU SET: the cabinet outside silhouette is exactly ${cabinetWidth} inches wide by ${height} inches high, a width-to-height ratio of exactly ${cabinetAspectRatio}. Preserve that same physical silhouette ratio in both the clean product image and the installed image. Use a straight-on, level, near-orthographic catalog camera with vertical sides parallel and horizontal shelves level. Do not widen, narrow, stretch, compress, taper, or perspective-distort the cabinet to fit the room or door opening. Architectural trim and doors must fit around the locked cabinet dimensions, never resize the cabinet.`,
    `MANDATORY TOE-KICK CONSTRUCTION: preserve the complete 5-inch-high toe-kick zone below the bottom shelf across every tower bay. It must measure exactly 5 inches vertically, which is ${(5 / Number(height) * 100).toFixed(1)}% of this ${height}-inch cabinet height; do not make it shorter or visually compress it. The bottom shelf must remain visibly elevated exactly 5 inches above the floor. Every bay must contain one SOLID, OPAQUE, WHITE MELAMINE VERTICAL KICK BOARD filling the entire rectangular area from the floor up to the underside of the bottom shelf and from the left panel to the right panel. Set that solid board about 2 inches behind the cabinet front plane. It is a real cabinet part, not background wall: no wall, floor, open cavity, or empty darkness may be visible through the 5-inch toe-kick zone. The side panels are not furniture legs and must never appear as two legs around an open bottom. Lighting may create only soft natural depth shading on the solid kick board. Do not add a black line, dark stripe, trim strip, groove, gap, or separate horizontal product part at the toe kick. The cabinet must not extend flush to the floor, float above the floor, use furniture legs, or lose, cover, crop, or miniaturize this recessed base.`,
    ...towerRules,
    'Important image-reading rule: faint white shapes, repeated hanger shapes, wall projections, and translucent shapes in the source are CAST SHADOWS OR REFLECTIONS, not shelves, towers, rods, cabinets, or drawers. Never turn a shadow or reflection into physical geometry.',
    installedScene
      ? [
          `Install the exact system in a precisely measured fitted reach-in opening. ${doorRule} Keep every door fully folded open.`,
          `The cabinet outside assembled width is exactly ${cabinetWidth} inches. Although the construction cavity can be ${finishedCavityWidth} inches before trim, the VISIBLE FINISHED OPENING in the photograph must equal the cabinet outside width exactly: ${cabinetWidth} inches. Hide all installation allowance completely behind the front casing. The cabinet's left outside panel must visually touch the finished left return, and its right outside panel must visually touch the finished right return. Show no visible filler width at all.`,
          `The cabinet height is exactly ${height} inches. Although the construction cavity can be ${finishedCavityHeight} inches before trim, the VISIBLE FINISHED OPENING height in the photograph must equal the cabinet height exactly: ${height} inches. Hide all top installation allowance behind the front header/casing. The cabinet top board must visually touch the underside of the header across its full width.`,
          'Move the finished jambs, casing, header, track, and door panels tightly inward until the visible opening traces the cabinet perimeter. The interior face of each jamb must be no wider than the 0.75-inch cabinet side-panel edge. Show zero exposed back wall beside or above the cabinet, zero dark side channels, zero broad filler panels, and zero unused reach-in floor area around the product.',
          'At the bottom of the fitted opening, keep the entire 5-inch recessed toe-kick visible from left to right. Do not use reach-in trim, flooring, a threshold, shadows, or the door track to conceal it. The finished side returns stop at the cabinet sides and must not cover the toe-kick opening. Render only natural soft shading in the recess; never draw a black horizontal line or stripe.',
          'Critical visual test: if any strip of interior wall is visible between an outside cabinet panel and a door jamb, or between the cabinet top and header, the opening is still too large and must be tightened further.',
        ].join(' ')
      : walkInScene
        ? 'Show the exact system as a walk-in closet product hero with a minimal warm wall and floor environment.'
        : 'Show the exact system alone as a clean centered product hero with a minimal warm wall and floor environment and no doors.',
    'Use a 1:1 composition. Center the complete product and let it occupy 80-88% of the frame height. Keep the full top, sides, and toe kicks visible. Across the photo set, keep the cabinet at the same visual scale and preserve the exact same cabinet width-to-height proportion; only the surrounding installation context may change.',
    'White satin melamine, soft warm daylight, realistic chrome and brushed-nickel hardware, straight verticals, subtle shadows. Replace the source render lattice-style hanger placeholders with realistically proportional matte-black adult clothes hangers on the visible front rod plane.',
    'No invented modules, extra shelves, missing shelves, duplicate divider, altered widths, inset drawers, round knobs, oversized hangers, deep-set rods, open bottom cavity, furniture-style legs, props, furniture, artwork, text, logo, or watermark. Before finalizing, explicitly count every horizontal board in each tower and reject the image internally if the count differs from the tower rule above.',
  ].join('\n');
}

async function getNextDraftFilename(draftsDir, requestedFilename) {
  const base = String(requestedFilename || 'photo.png').replace(/\.png$/i, '').replace(/-draft-v\d+$/i, '');
  const rejectedDir = path.resolve('assets/drafts/rejected/auto-generation');
  const [activeEntries, rejectedEntries] = await Promise.all([
    fs.readdir(draftsDir, { withFileTypes: true }),
    fs.readdir(rejectedDir, { withFileTypes: true }).catch((error) => (error.code === 'ENOENT' ? [] : Promise.reject(error))),
  ]);
  const entries = [...activeEntries, ...rejectedEntries];
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-draft-v(\\d+)\\.png$`, 'i');
  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name.match(pattern))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;
  return `${base}-draft-v${nextVersion}.png`;
}

function photoGenerationProxy(env) {
  const draftsDir = path.resolve('assets/drafts/generated-photos');
  const requestsDir = path.resolve('assets/drafts/photo-generation-requests');

  return {
    name: 'photo-generation-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (pathname !== '/api/generate-photos') {
          next();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const payload = JSON.parse((await readRequestBody(req)) || '{}');
          const sourceMatch = String(payload.geometryDataUrl || '').match(/^data:image\/png;base64,(.+)$/);
          const shots = Array.isArray(payload.shots) ? payload.shots : [];
          const handle = String(payload.handle || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

          if (!handle || !sourceMatch || shots.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing handle, geometry capture, or photo set.' }));
            return;
          }

          await Promise.all([fs.mkdir(draftsDir, { recursive: true }), fs.mkdir(requestsDir, { recursive: true })]);
          const sourceBuffer = Buffer.from(sourceMatch[1], 'base64');
          const requestId = `${handle}-${Date.now()}`;
          const sourcePath = path.join(requestsDir, `${requestId}-geometry.png`);
          await fs.writeFile(sourcePath, sourceBuffer);
          await fs.writeFile(
            path.join(requestsDir, `${requestId}.json`),
            JSON.stringify({ ...payload, geometryDataUrl: undefined, requestId, createdAt: new Date().toISOString() }, null, 2),
            'utf8',
          );

          const directOpenAiKey = env.OPENAI_API_KEY;
          const gatewayCredential = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
          const imageCredential = directOpenAiKey || gatewayCredential;

          if (!imageCredential) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'Photo generation is not configured. Add OPENAI_API_KEY, AI_GATEWAY_API_KEY, or a fresh VERCEL_OIDC_TOKEN, then restart the local app.',
              requestSaved: true,
              requestId,
            }));
            return;
          }

          const generated = [];
          for (const shot of shots) {
            const prompt = buildPhotoPrompt({ ...payload, handle, shot });
            let response;
            let result;
            let imageBase64;

            if (directOpenAiKey) {
              const form = new FormData();
              form.append('model', 'gpt-image-2');
              form.append('image', new Blob([sourceBuffer], { type: 'image/png' }), `${handle}-geometry.png`);
              form.append('prompt', prompt);
              form.append('size', '2048x2048');
              form.append('quality', 'high');
              form.append('output_format', 'png');

              response = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { Authorization: `Bearer ${directOpenAiKey}` },
                body: form,
              });
              result = await response.json();
              imageBase64 = result.data?.[0]?.b64_json;
            } else {
              response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${gatewayCredential}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-3-pro-image',
                  modalities: ['text', 'image'],
                  messages: [
                    {
                      role: 'user',
                      content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: payload.geometryDataUrl } },
                      ],
                    },
                  ],
                }),
              });
              result = await response.json();
              const imageDataUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url || '';
              imageBase64 = imageDataUrl.match(/^data:image\/(?:png|jpe?g|webp);base64,(.+)$/)?.[1];
            }

            if (!response.ok) {
              throw new Error(result.error?.message || `Image generation returned ${response.status}`);
            }

            if (!imageBase64) throw new Error('The image service returned no image data.');

            const filename = await getNextDraftFilename(draftsDir, shot.filename || `${handle}-${shot.id}.png`);
            await fs.writeFile(path.join(draftsDir, filename), Buffer.from(imageBase64, 'base64'));
            generated.push({ filename, shot: shot.id });
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, requestId, generated }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

function removeProductionInternalAssets(enabled) {
  return {
    name: 'remove-production-internal-assets',
    apply: 'build',
    async closeBundle() {
      if (!enabled) return;

      await Promise.all([
        fs.rm(path.resolve(__dirname, 'dist/internal-renderer.html'), { force: true }),
        fs.rm(path.resolve(__dirname, 'dist/internal-renderer-style-guide.md'), { force: true }),
        fs.rm(path.resolve(__dirname, 'dist/shopify-photo-workflow.md'), { force: true }),
      ]);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const includeInternalRenderer = mode !== 'production' || env.BUILD_INTERNAL_RENDERER === 'true';
  const publicProductionBuild = mode === 'production' && !includeInternalRenderer;
  const input = {
    main: path.resolve(__dirname, 'index.html'),
    walkin: path.resolve(__dirname, 'walkin.html'),
  };

  if (includeInternalRenderer) {
    input.internalRenderer = path.resolve(__dirname, 'internal-renderer.html');
  }

  return {
    plugins: [
      quoteRequestProxy(env),
      photoDraftsProxy(),
      photoGenerationProxy(env),
      resolvedPartsProxy(env),
      airtableProxy(env),
      removeProductionInternalAssets(publicProductionBuild),
      react(),
    ],
    server: {
      host: 'localhost',
      port: 5173,
    },
    build: {
      rollupOptions: {
        input,
      },
    },
  };
});
