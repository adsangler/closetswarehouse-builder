import { createAirtableQuote, sendConfirmationEmail, sendJson } from './_airtable.js';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const quote = JSON.parse(body || '{}');
    const submittedAt = new Date().toISOString();
    const quoteId = `quote-${submittedAt.replace(/[:.]/g, '-')}`;
    const capturedQuote = { ...quote, quoteId, submittedAt };
    const airtableRecord = await createAirtableQuote(capturedQuote);
    const shopifyCustomer = await upsertShopifyCustomerPlan(capturedQuote);
    const email = await sendConfirmationEmail(capturedQuote);

    sendJson(res, 200, {
      ok: true,
      quoteId,
      captureMode: airtableRecord ? 'airtable' : 'unconfigured',
      shopifyCustomer,
      email,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
