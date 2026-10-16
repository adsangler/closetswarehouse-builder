import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isPositiveWholeQuantity, validateExtraPartQuantities } from '../src/extraPartQuantities.js';
import { normalizeQuoteSubmission, validateNormalizedQuote } from '../api/_quote-normalize.js';
import { encodePlanPayload } from '../src/planUrls.js';

const invalid = [1.5, '2.25', 0, '0', -1, '-2', '', ' ', 'abc', null, undefined, true, [], Infinity, NaN];
const valid = [1, 2, 99, 100, '3'];

for (const [file, components] of [
  ['src/App.jsx', ['MatchPanel', 'ReachInEstimatePage']],
  ['src/walkin.jsx', ['SummaryPanel', 'WalkInEstimatePage']],
]) {
  const source = readFileSync(file, 'utf8');
  test(`${file}: Add rejects invalid input and preserves whole-number addition`, () => {
    const body = source.match(/const addItem = \(\) => \{([\s\S]*?)\n  \};/)[1];
    for (const quantity of [...invalid, ...valid]) {
      let items = [];
      const add = vm.runInNewContext(`(() => {${body}})`, {
        quantity, isPositiveWholeQuantity, type: 'shelf', width: 24,
        getExtraPartSku: () => 'SH-24', catalog: [{ sku: 'SH-24', name: 'Shelf', price: 10 }],
        selected: { label: 'Shelf' }, getProductUrl: () => '',
        onChange: fn => { items = fn(items); },
      });
      add();
      if (invalid.includes(quantity)) assert.equal(items.length, 0, String(quantity));
      else {
        assert.equal(items[0].quantity, Number(quantity));
        add();
        assert.equal(items[0].quantity, Number(quantity) * 2);
      }
    }
    assert.match(source, /step="1" required aria-invalid=\{!isPositiveWholeQuantity\(quantity\)\}/);
    assert.match(source, /setQuantity\(event.target.value\)/);
  });
  for (const name of components) test(`${file}: ${name} blocks invalid restored extras before submission`, () => {
    const component = source.slice(source.indexOf(`function ${name}(`));
    const guard = component.slice(component.indexOf('event.preventDefault();'), component.indexOf('\n    if (', component.indexOf('return;') + 7));
    for (const quantity of invalid) {
      let status;
      vm.runInNewContext(`(() => {${guard}})()`, {
        event: { preventDefault() {} }, extraParts: [{ quantity }], validateExtraPartQuantities,
        setLeadStatus: value => { status = value; }, setSubmitStatus: value => { status = value; },
      });
      assert.equal(status?.state, 'error', String(quantity));
    }
  });
}

for (const planType of ['reach-in', 'walk-in']) test(`${planType}: save validation rejects invalid extras in every submitted representation`, () => {
  const base = { planType, customer: { email: 'test@example.com' }, modules: [{ code: 'DH', width: 24 }], estimatedPrice: 245 };
  for (const quantity of [...invalid, ...valid]) {
    for (const payload of [
      { extraParts: [{ quantity }] },
      { materials: [{ category: 'Added parts', quantity }] },
      { planUrl: `https://closetswarehouse.com/?plan=${encodeURIComponent(encodePlanPayload({ extraParts: [{ quantity }] }))}` },
    ]) {
      const error = validateNormalizedQuote(normalizeQuoteSubmission({ ...base, ...payload }));
      assert.equal(Boolean(error), invalid.includes(quantity), String(quantity));
    }
  }
  assert.equal(validateNormalizedQuote(normalizeQuoteSubmission(base)), '');
});
