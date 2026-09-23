import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { adjustableShelfCount } from '../src/shelfCounts.js';
import { buildDetailedReachInParts, buildDetailedWalkInParts } from '../src/partList.js';
import { normalizeQuoteSubmission, validateNormalizedQuote } from '../api/_quote-normalize.js';
import { renderPrintablePlan } from '../api/quote-print.js';

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}

for (const file of ['src/App.jsx', 'src/walkin.jsx']) {
  const source = fs.readFileSync(file, 'utf8');
  const walk = file.includes('walkin');
  const layout = walk ? 'buildWalkInTowerLayout' : 'buildTowerLayout';
  const product = walk ? 'kitRecordToProduct' : 'kitRecordToDrawing';
  const estimate = walk ? 'calculateWallEstimate' : 'calculateCustomEstimate';
  const widthOptions = walk ? 'getWalkInWidthOptions' : 'getWidthOptions';
  const context = vm.createContext({ adjustableShelfCount, panelThickness: 0.75, toeKickHeight: 5,
    closetDepth: 14, depth: 14, allowedModuleWidths: [18, 24, 30], storefrontBaseUrl: 'https://closetswarehouse.com' });
  for (const name of ['towerCodePattern', 'widthTokenPattern', 'singleTowerWidthTokenMap', 'towerNames']) {
    const match = source.match(new RegExp(`const ${name} = [\\s\\S]*?;`));
    assert.ok(match, name);
    vm.runInContext(match[0], context);
  }
  const functions = ['buildAdjustableShelves', 'buildDrawers', 'getDrawerBounds', layout,
    'normalizeHandle', 'normalizeTowerCode', 'getNominalWidthFromSkuToken', 'parseTowerSku',
    'normalizePrice', 'getShopifyHandle', 'getProductUrl', 'formatTowerTitle', 'buildMatchSignature', product, widthOptions,
    estimate, ...(walk ? ['numberValue', 'getWalkInProductCode', 'getShelfCodeForHeight', 'getLiveWallProductCoverage', 'getRunLength']
      : ['getAssembledWidth', 'getRequiredWidth', 'getLiveModuleProductCoverage', 'getModuleSegments', 'getSharedDividerCenters'])];
  vm.runInContext(functions.map(name => extract(source, name)).join('\n'), context);

  for (const height of [84, 96]) for (const width of [18, 24, 30]) {
    test(`${file}: Frame Only ${width}/${height} renders and prices without Shopify`, () => {
      const result = walk ? context[layout](height, 'FR') : context[layout]({ height }, { code: 'FR', width, bayX: 0 });
      assert.equal(result.shelves.length, 2);
      assert.ok(result.shelves.every(s => s.fixed));
      assert.equal(result.shelves[0].y, 5);
      assert.equal(result.shelves[1].y, height - 0.75);
      assert.equal(result.rods.length, 0);
      assert.equal(result.drawers.length, 0);
      assert.deepEqual(Array.from(context[widthOptions]('FR')), [18, 24, 30]);
      const record = { id: 'test', fields: { 'Kit Name': `FR-${Math.ceil(width + 1.5)}-${height}-14-W`,
        Height: height, Width: width + 1.5, 'Width Requirement': width + 3.5, retail_price: 150, Status: 'Active' } };
      const catalogItem = context[product](record);
      assert.equal(catalogItem.towerSpecs[0].code, 'FR');
      assert.equal(catalogItem.towerSpecs[0].width, width);
      assert.equal(catalogItem.productUrl, '');
      assert.equal(context[product]({ ...record, fields: { ...record.fields, shopify_active: true } }).productUrl, '');
      assert.match(catalogItem.title, /Frame Only/);
      const modules = [{ code: 'FR', width }, { code: 'FR', width }];
      const price = walk ? context[estimate](modules, height, [catalogItem]) : context[estimate](modules, [catalogItem], height);
      assert.equal(price, 268); // Existing connected-run panel credit.
      assert.equal(walk ? context.getRunLength(modules) : context.getAssembledWidth(modules), width * 2 + 2.25);
      if (!walk) assert.equal(context.getSharedDividerCenters(modules).length, 1);
    });
  }
}

test('frame-only pick lists contain no pins or storage parts; mixed runs share panels', () => {
  for (const height of [84, 96]) {
    const modules = [18, 24, 30].map(width => ({ code: 'FR', width }));
    for (const parts of [buildDetailedReachInParts(modules, height), buildDetailedWalkInParts({ backHeight: height }, { back: modules })]) {
      const quantity = sku => parts.find(p => p.sku === sku)?.quantity || 0;
      assert.equal(quantity(`VL-14-${height}-W`), 1);
      assert.equal(quantity(`VR-14-${height}-W`), 1);
      assert.equal(quantity(`VD-14-${height}-W`), 2);
      assert.ok(!parts.some(p => /^(SH-|PIN-|RK-|DRK-)/.test(p.sku)));
      for (const width of [18, 24, 30]) {
        assert.equal(quantity(`FS-${width}-14-W`), 2);
        assert.equal(quantity(`TKK-${width}-5-W`), 1);
      }
      assert.equal(parts.find(p => p.category === 'Tower hardware kits').quantity, 3);
    }
    const mixed = buildDetailedReachInParts([{ code: 'FR', width: 18 }, { code: 'DH', width: 24 }], height);
    assert.equal(mixed.find(p => p.sku === `VD-14-${height}-W`).quantity, 1);
    assert.equal(mixed.find(p => p.sku === 'SH-24-14-W').quantity, height === 96 ? 2 : 1);
    assert.ok(!mixed.some(p => p.sku === 'SH-18-14-W'));
  }
});

test('saved quote preserves Frame Only modules and print fallback builds the correct BOM', () => {
  const input = { customer: { email: 'frame-test@example.com' }, height: 96,
    modules: [18, 24, 30].map(width => ({ code: 'FR', width })), estimatedPrice: 447.22 };
  const quote = normalizeQuoteSubmission(JSON.parse(JSON.stringify(input)), { quoteId: 'FR-TEST', submittedAt: '2026-09-23' });
  assert.equal(quote.modules.length, 3);
  assert.ok(quote.modules.every(m => m.label === 'Frame Only'));
  assert.equal(validateNormalizedQuote(quote), '');
  assert.equal(quote.estimatedPrice, input.estimatedPrice);
  const missingPrice = normalizeQuoteSubmission({ ...input, estimatedPrice: 0 }, {});
  assert.ok(validateNormalizedQuote(missingPrice));
  const html = renderPrintablePlan({ record: { quote, quoteId: 'FR-TEST' } });
  assert.match(html, /Frame Only/);
  assert.match(html, /FS-18-14-W/);
  assert.doesNotMatch(html, /PIN-20-S|SH-18-14-W|RK-18-S|DRK-18/);
});
