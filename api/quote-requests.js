import { randomBytes } from 'node:crypto';
import { createAirtableQuoteWithDiagnostics, fetchAirtableQuoteByReference, fetchAirtableQuoteIdsByDate, sendJson, updateAirtableQuoteShopifyCustomer } from './_airtable.js';
import { attachQuoteReferenceToPlanUrl, normalizeQuoteSubmission, validateNormalizedQuote } from './_quote-normalize.js';
import { upsertShopifyCustomerPlan } from './_shopify.js';

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replaceAll('-', '');
}

async function createQuoteId(date = new Date()) {
  const key = dateKey(date);
  const used = new Set(await fetchAirtableQuoteIdsByDate(key));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = String(randomBytes(2).readUInt16BE(0) % 1000).padStart(3, '0');
    const candidate = `${key}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('Unable to allocate a unique plan reference for today. Please try again.');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
      const quote = await fetchAirtableQuoteByReference({
        quoteId: requestUrl.searchParams.get('quoteId'),
        email: requestUrl.searchParams.get('email'),
      });

      if (!quote) {
        sendJson(res, 404, { error: 'Quote not found' });
        return;
      }

      sendJson(res, 200, { ok: true, quote });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const quote = JSON.parse(body || '{}');
    const submittedDate = new Date();
    const submittedAt = submittedDate.toISOString();
    const quoteId = await createQuoteId(submittedDate);
    const capturedQuote = normalizeQuoteSubmission(quote, { quoteId, submittedAt });
    capturedQuote.planUrl = attachQuoteReferenceToPlanUrl(capturedQuote.planUrl, quoteId);
    const validationError = validateNormalizedQuote(capturedQuote);

    if (validationError) {
      sendJson(res, 400, { error: validationError });
      return;
    }

    const airtableResult = await createAirtableQuoteWithDiagnostics(capturedQuote);
    const airtableRecord = airtableResult.record;

    if (!airtableRecord?.id) {
      const reason = airtableResult.error ? ` Airtable reason: ${airtableResult.error}.` : '';
      sendJson(res, 502, { error: `We could not save this plan to Airtable. Please try again before printing the reference.${reason}` });
      return;
    }

    let shopifyCustomer = null;

    try {
      shopifyCustomer = await upsertShopifyCustomerPlan(capturedQuote);
    } catch {
      shopifyCustomer = null;
    }

    if (airtableRecord?.id && shopifyCustomer?.customerId) {
      await updateAirtableQuoteShopifyCustomer(airtableRecord.id, capturedQuote, shopifyCustomer);
    }

    sendJson(res, 200, {
      ok: true,
      quoteId,
      captureMode: 'airtable',
      airtableMode: airtableResult.mode || 'unknown',
      shopifyCustomer: shopifyCustomer ? { configured: shopifyCustomer.configured, created: shopifyCustomer.created } : null,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
