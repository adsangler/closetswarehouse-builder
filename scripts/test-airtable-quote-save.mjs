import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAirtableQuoteWithDiagnostics, updateAirtableQuoteShopifyCustomer, parseStoredQuote, fetchAirtableQuoteByReference } from '../api/_airtable.js';
process.env.AIRTABLE_TOKEN = 'test-token';
process.env.AIRTABLE_BASE_ID = 'test-base';
const plan = { quoteId: 'test', customer: { email: 'test@example.com' }, planUrl: 'https://closetswarehouse.com/pages/walk-in-closet-planner?plan=test', modules: [{ code: 'DH', width: 24 }], drawings: [] };
const originalFetch = globalThis.fetch;
function mock(handler) { globalThis.fetch = async (url, options) => handler(url, options); }
function response(status, payload) { return new Response(JSON.stringify(payload), { status }); }
test('large drawings do not exceed Airtable text limit and plan remains recoverable', async () => {
  const quote = { ...plan, drawings: [{ dataUrl: 'data:image/svg+xml;charset=utf-8,' + 'x'.repeat(140000) }] };
  mock((url, options) => {
    const fields = JSON.parse(options.body).fields;
    assert.ok(fields['Quote JSON'].length < 95000);
    const stored = parseStoredQuote(fields['Quote JSON']);
    assert.deepEqual(stored.modules, plan.modules);
    assert.equal(stored.planUrl, plan.planUrl);
    assert.equal(stored.drawingsStoredInPlanUrl, true);
    assert.deepEqual(stored.drawings, []);
    return response(200, { id: 'rec-test', fields });
  });
  assert.equal((await createAirtableQuoteWithDiagnostics(quote)).mode, 'enriched');
});
test('large metadata is compressed and survives a saved-plan lookup', async () => {
  const quote = { ...plan, metadata: 'long metadata '.repeat(15000) };
  let record;
  mock((url, options) => {
    if (options.method === 'POST') {
      const fields = JSON.parse(options.body).fields;
      assert.ok(fields['Quote JSON'].length < 95000);
      assert.equal(JSON.parse(fields['Quote JSON']).encoding, 'gzip-base64');
      record = { id: 'rec-test', fields };
      return response(200, record);
    }
    return response(200, { records: [record] });
  });
  await createAirtableQuoteWithDiagnostics(quote);
  const result = await fetchAirtableQuoteByReference({ quoteId: 'test', email: 'test@example.com' });
  assert.equal(result.quote.metadata, quote.metadata);
  assert.deepEqual(result.quote.modules, plan.modules);
});
test('the exact reported 422 retries without JSON while retaining editable plan', async () => {
  let calls = 0;
  mock((url, options) => {
    const fields = JSON.parse(options.body).fields;
    if (++calls === 1) return response(422, { error: { type: 'INVALID_VALUE_FOR_COLUMN', message: 'Field "Quote JSON" cannot accept the provided value' } });
    assert.equal(fields['Quote JSON'], undefined);
    assert.equal(fields['Plan URL'], plan.planUrl);
    return response(200, { id: 'rec-test', fields });
  });
  assert.equal((await createAirtableQuoteWithDiagnostics(plan)).mode, 'enriched-without-json');
  assert.equal(calls, 2);
});
test('Shopify customer linking only updates customer fields', async () => {
  mock((url, options) => {
    assert.equal(options.method, 'PATCH');
    assert.deepEqual(JSON.parse(options.body).fields, { 'Shopify Customer ID': 'customer-test', 'Shopify Customer Email': 'test@example.com' });
    return response(200, { id: 'rec-test' });
  });
  assert.ok(await updateAirtableQuoteShopifyCustomer('rec-test', plan, { customerId: 'customer-test', customerEmail: 'test@example.com' }));
});
test('auth errors do not retry or report success', async () => {
  let calls = 0;
  mock(() => { calls++; return response(403, { error: { message: 'Forbidden' } }); });
  const result = await createAirtableQuoteWithDiagnostics(plan);
  assert.equal(result.record, null);
  assert.equal(calls, 1);
  globalThis.fetch = originalFetch;
});
