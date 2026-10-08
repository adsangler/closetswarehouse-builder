import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeQuoteSubmission, attachQuoteReferenceToPlanUrl } from '../api/_quote-normalize.js';
import { encodePlanPayload, roomNameFromPlanUrl } from '../src/planUrls.js';
import { createAirtableQuoteWithDiagnostics, fetchAirtableQuoteByReference } from '../api/_airtable.js';
import { renderPrintablePlan } from '../api/quote-print.js';
import customerQuotes from '../api/customer-quotes.js';
import { upsertShopifyCustomerPlan } from '../api/_shopify.js';

process.env.AIRTABLE_TOKEN = 'test-token';
process.env.AIRTABLE_BASE_ID = 'test-base';
const contact = { firstName: 'Test', lastName: 'Planner', email: 'test@example.com', phone: '9545550100' };
const modules = [{ code: 'DH', width: 24 }];
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });

for (const planType of ['reach-in', 'walk-in']) for (const withoutJson of [false, true]) {
  test(`${planType}: room survives storage, lookup, list and print${withoutJson ? ' without Quote JSON' : ''}`, async () => {
    const roomName = 'Guest <Closet> – 客房';
    const plan = planType === 'reach-in' ? { planDetails: { roomName }, modules } : { room: { roomName }, runs: { back: modules } };
    const planUrl = `https://closetswarehouse-builder.vercel.app/?plan=${encodePlanPayload(plan)}`;
    const quote = normalizeQuoteSubmission({ customer: contact, modules, planType, roomName: `  ${roomName}  `, planUrl, estimatedPrice: 245 }, { quoteId: 'QA-room', submittedAt: '2026-10-06T12:00:00Z' });
    quote.planUrl = attachQuoteReferenceToPlanUrl(quote.planUrl, quote.quoteId);
    assert.equal(quote.roomName, roomName);
    assert.equal(roomNameFromPlanUrl(quote.planUrl), roomName);
    const previousFetch = globalThis.fetch;
    let record;
    globalThis.fetch = async (url, options = {}) => {
      if (options.method === 'POST') {
        const fields = JSON.parse(options.body).fields;
        if (withoutJson && fields['Quote JSON']) return response({ error: { type: 'INVALID_VALUE_FOR_COLUMN', message: 'Field "Quote JSON" cannot accept the provided value' } }, 422);
        record = { id: 'rec-test', fields };
        return response(record);
      }
      return response({ records: [record] });
    };
    try {
      assert.ok((await createAirtableQuoteWithDiagnostics(quote)).record.id);
      const saved = await fetchAirtableQuoteByReference({ quoteId: quote.quoteId, email: contact.email });
      assert.equal(saved.roomName, roomName);
      const html = renderPrintablePlan({ record: saved });
      assert.ok(html.includes('Room: Guest &lt;Closet&gt; – 客房'));
      let listing;
      await customerQuotes({ method: 'GET', url: '/api/customer-quotes?email=test%40example.com&phone=9545550100', headers: { host: 'localhost' } }, { setHeader() {}, end(value) { listing = value; } });
      assert.ok(listing.includes('<h3>Guest &lt;Closet&gt; – 客房</h3>'));
    } finally { globalThis.fetch = previousFetch; }
  });
}

test('Shopify plan metadata includes room name', async () => {
  process.env.SHOPIFY_SHOP_DOMAIN = 'test.myshopify.com';
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'test-token';
  const previousFetch = globalThis.fetch;
  let saved;
  globalThis.fetch = async (url, options) => {
    const { query, variables } = JSON.parse(options.body);
    if (query.includes('query findCustomer')) return response({ data: { customers: { nodes: [{ id: 'customer-test', email: contact.email }] } } });
    if (query.includes('mutation updateCustomer')) return response({ data: { customerUpdate: { customer: { id: 'customer-test' }, userErrors: [] } } });
    if (query.includes('mutation addTags')) return response({ data: { tagsAdd: { userErrors: [] } } });
    assert.ok(query.includes('mutation setMetafields'));
    saved = JSON.parse(variables.metafields.find(field => field.key === 'latest_closet_plan').value);
    return response({ data: { metafieldsSet: { userErrors: [] } } });
  };
  try {
    await upsertShopifyCustomerPlan({ customer: contact, roomName: 'Pantry', planUrl: 'https://closetswarehouse.com/', quoteId: 'QA-pantry' });
    assert.equal(saved.roomName, 'Pantry');
  } finally { globalThis.fetch = previousFetch; }
});

test('old unnamed plans remain readable and normalized names are bounded', () => {
  assert.equal(roomNameFromPlanUrl('invalid'), '');
  assert.equal(normalizeQuoteSubmission({}).roomName, '');
  assert.equal(normalizeQuoteSubmission({ roomName: 'x'.repeat(200) }).roomName.length, 120);
});
