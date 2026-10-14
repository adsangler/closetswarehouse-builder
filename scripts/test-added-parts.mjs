import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import handler from '../api/planner-parts.js';
import { buildResolvedParts } from '../api/_part-pricing.js';

const selections = [
  ['shelf', 18, 'SH-18-14-W'], ['shelf', 24, 'SH-24-14-W'], ['shelf', 30, 'SH-30-14-W'],
  ['rod', 18, 'RK-18-S'], ['rod', 24, 'RK-24-S'], ['rod', 30, 'RK-30-S'],
  ['shelfPins', 0, 'PIN-20-S'], ['rafix', 0, 'CAMKIT-10-W'],
  ['smallDrawer', 24, 'DRK-24-5-13-W'], ['smallDrawer', 30, 'DRK-30-5-13-W'],
  ['largeDrawer', 24, 'DRK-24-10-13-W'], ['largeDrawer', 30, 'DRK-30-10-13-W'],
];

test('local planner catalog includes all supported extras and rejects 18-inch drawers', async () => {
  const source = readFileSync('vite.config.js', 'utf8');
  const match = source.match(/function plannerPartsProxy\(env\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'local planner middleware');
  const fixtures = selections.map(([, , sku], index) => ({ id: `part${index}`, fields: { 'Item Code': sku, retail_price: index + 10, shopify_handle: sku.toLowerCase() } }));
  fixtures.push({ id: 'unsupported', fields: { 'Item Code': 'DRK-18-10-13-W', retail_price: 1 } });
  const proxy = vm.runInNewContext(`(${match[0]})`, {
    buildResolvedParts,
    fetchAirtableRecords: async (_env, table) => table === 'AIRTABLE_PARTS_TABLE' ? fixtures : [],
  })({});
  let middleware;
  proxy.configureServer({ middlewares: { use(fn) { middleware = fn; } } });
  let payload;
  const res = { setHeader() {}, end(body) { payload = JSON.parse(body); } };
  await middleware({ method: 'GET', url: '/api/planner-parts' }, res, () => assert.fail('request bypassed catalog'));
  assert.notEqual(res.statusCode, 502);
  assert.equal(payload.records.length, selections.length);
  for (const [index, [, , sku]] of selections.entries()) {
    const part = payload.records.find(record => record.sku === sku);
    assert.ok(part, `local catalog missing ${sku}`);
    assert.equal(part.price, index + 10);
    assert.equal(part.shopifyHandle, sku.toLowerCase());
  }
});

test('every selection in both planners resolves to a catalog entry with its own price and link', async () => {
  const env = { AIRTABLE_TOKEN: 'test', AIRTABLE_BASE_ID: 'test', AIRTABLE_PARTS_TABLE: 'parts', AIRTABLE_COMPONENTS_TABLE: 'components', AIRTABLE_PART_COMPONENTS_TABLE: 'links' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const originalFetch = globalThis.fetch;
  const fixtures = selections.map(([, , sku], index) => ({ id: `part${index}`, fields: { 'Item Code': sku, retail_price: index + 10, shopify_handle: sku.toLowerCase() } }));
  fixtures.push({ id: 'unsupported', fields: { 'Item Code': 'DRK-18-10-13-W', retail_price: 1 } });
  globalThis.fetch = async url => ({ ok: true, json: async () => ({ records: new URL(url).pathname.endsWith('/parts') ? fixtures : [] }) });
  try {
    let payload;
    const res = { setHeader() {}, end(body) { payload = JSON.parse(body); } };
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(payload.records.length, 12);
    for (const file of ['src/App.jsx', 'src/walkin.jsx']) {
      const source = readFileSync(file, 'utf8');
      const match = source.match(/function getExtraPartSku\(type, width\) \{[\s\S]*?\n\}/);
      assert.ok(match, file);
      const resolve = vm.runInNewContext(`(${match[0]})`);
      for (const [index, [type, width, sku]] of selections.entries()) {
        assert.equal(resolve(type, width), sku, `${file}: ${type} ${width}`);
        const product = payload.records.find(record => record.sku === resolve(type, width));
        assert.ok(product, sku);
        assert.equal(product.price, index + 10);
        assert.equal(product.shopifyHandle, sku.toLowerCase());
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
