import assert from 'node:assert/strict';
import { test } from 'node:test';
import { priceValidity, quoteCreatedAt } from '../src/estimateValidity.js';
import { encodePlanPayload, decodePlanPayload } from '../src/planUrls.js';
import { attachQuoteReferenceToPlanUrl } from '../api/_quote-normalize.js';
import { renderPrintablePlan } from '../api/quote-print.js';

const quoteId = 'CWQ-20260925235526-4D20E3';
test('price expires exactly seven days after original creation, including legacy links', () => {
  assert.equal(quoteCreatedAt(quoteId), '2026-09-25T23:55:26Z');
  const expires = Date.parse('2026-10-02T23:55:26Z');
  assert.match(priceValidity({}, quoteId, expires - 1), /^Price valid until/);
  assert.match(priceValidity({}, quoteId, expires), /^Price expired/);
  assert.match(priceValidity({}, quoteId, expires + 86400000), /^Price expired/);
  assert.match(priceValidity({}, '', expires), /Creation date unavailable/);
});
test('new public URLs preserve price and exclude personal fields', () => {
  const savedEstimate = { estimatedPrice: 521.8, customerName: 'Private Person', phoneLast4: '1234', email: 'private@example.com' };
  assert.deepEqual(decodePlanPayload(encodePlanPayload({ savedEstimate })).savedEstimate, { estimatedPrice: 521.8 });
  const legacy = Buffer.from(JSON.stringify({ savedEstimate })).toString('base64url');
  const url = new URL(attachQuoteReferenceToPlanUrl(`https://closetswarehouse-builder.vercel.app/?plan=${legacy}`, quoteId));
  assert.deepEqual(JSON.parse(Buffer.from(url.searchParams.get('plan'), 'base64url')).savedEstimate,
    { estimatedPrice: 521.8, createdAt: '2026-09-25T23:55:26Z' });
});
test('printable plan omits contact details and retains price and expiration', () => {
  const html = renderPrintablePlan({ record: { quoteId, estimatedPrice: 521.8,
    customer: { name: 'Private Person', email: 'private@example.com', phone: '5551234567' }, quote: {} } });
  assert.doesNotMatch(html, /Private Person|private@example.com|5551234567/);
  assert.match(html, /Price expiration/);
  assert.match(html, /\$521\.80/);
});
