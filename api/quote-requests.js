import { randomBytes } from 'node:crypto';
import { createAirtableQuote, fetchAirtableQuoteByReference, sendConfirmationEmail, sendJson, updateAirtableQuoteShopifyCustomer } from './_airtable.js';
import { normalizeQuoteSubmission, validateNormalizedQuote } from './_quote-normalize.js';
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

function createQuoteId(date = new Date()) {
  const timestamp = date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = randomBytes(3).toString('hex').toUpperCase();

  return `CWQ-${timestamp}-${suffix}`;
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
    const quoteId = createQuoteId(submittedDate);
    const capturedQuote = normalizeQuoteSubmission(quote, { quoteId, submittedAt });
    const validationError = validateNormalizedQuote(capturedQuote);

    if (validationError) {
      sendJson(res, 400, { error: validationError });
      return;
    }

    const airtableRecord = await createAirtableQuote(capturedQuote);
    let shopifyCustomer = null;

    try {
      shopifyCustomer = await upsertShopifyCustomerPlan(capturedQuote);
    } catch {
      shopifyCustomer = null;
    }

    if (airtableRecord?.id && shopifyCustomer?.customerId) {
      await updateAirtableQuoteShopifyCustomer(airtableRecord.id, capturedQuote, shopifyCustomer);
    }
    const email = await sendConfirmationEmail(capturedQuote);

    sendJson(res, 200, {
      ok: true,
      quoteId,
      captureMode: airtableRecord ? 'airtable' : 'unconfigured',
      shopifyCustomer: shopifyCustomer ? { configured: shopifyCustomer.configured, created: shopifyCustomer.created } : null,
      email,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
