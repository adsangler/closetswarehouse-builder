import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { Vector3, PerspectiveCamera } from 'three';
import { encodePlanPayload, decodePlanPayload, persistSavedPlanReference } from '../src/planUrls.js';
import { fitReachInCamera } from '../src/reachInCamera.js';

test('Unicode extras and customer names round-trip in browser and server decoders', () => {
  const plan = { modules: [{ code: 'FR', width: 30 }], extraParts: [
    { name: 'Adjustable shelf — 24"', quantity: 2 }, { name: 'Shelf pins — pack of 20', quantity: 1 },
  ], savedEstimate: { estimatedPrice: 178.44 } };
  const encoded = encodePlanPayload(plan);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePlanPayload(encoded), plan);
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), plan);
});

test('old Latin-1 and ASCII saved links remain readable', () => {
  for (const plan of [{ name: 'André', modules: [{ code: 'DH', width: 24 }] }, { name: 'Original saved plan' }]) {
    const original = btoa(JSON.stringify(plan));
    assert.deepEqual(decodePlanPayload(original), plan);
    assert.deepEqual(decodePlanPayload(original.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')), plan);
  }
});

test('large Unicode plans encode without argument-size errors', () => {
  const plan = { notes: 'Shelf — 中文 🏠 '.repeat(15000) };
  assert.deepEqual(decodePlanPayload(encodePlanPayload(plan)), plan);
});

test('successful save retains reference, estimate snapshot, and history state on refresh', () => {
  const previous = globalThis.window;
  let replacement;
  const state = { existing: true };
  globalThis.window = { location: { href: 'http://localhost:5182/walkin.html' }, history: {
    state, replaceState: (...args) => { replacement = args; },
  } };
  try {
    const plan = { runs: { back: [{ code: 'FR', width: 18 }] }, savedEstimate: { estimatedPrice: 162.3 } };
    persistSavedPlanReference(`/walkin.html?estimate=1&plan=${encodePlanPayload(plan)}`, 'QA-123');
    assert.equal(replacement[0], state);
    const url = new URL(replacement[2]);
    assert.equal(url.searchParams.get('quote'), 'QA-123');
    assert.equal(url.searchParams.get('estimate'), '1');
    assert.deepEqual(decodePlanPayload(url.searchParams.get('plan')), plan);
    replacement = null;
    persistSavedPlanReference('/walkin.html', '');
    assert.equal(replacement, null);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test('off-center sliding door remains a reach-in warning without blocking estimate eligibility', () => {
  const source = fs.readFileSync('src/App.jsx', 'utf8');
  const validationStart = source.indexOf('function getReachInValidationMessages');
  assert.ok(validationStart >= 0);
  const validationEnd = source.indexOf('function getExtraPartSku', validationStart);
  assert.ok(validationEnd > validationStart);
  const validationSource = source.slice(validationStart, validationEnd);
  assert.match(validationSource, /slidingDividerAligned/);
  assert.match(validationSource, /shared divider must be centered/);

  const fitsMatch = source.match(/fits:\s*plannerModules\.length[^\n]+/);
  assert.ok(fitsMatch);
  assert.doesNotMatch(fitsMatch[0], /slidingDividerAligned/);
  assert.match(fitsMatch[0], /drawerWarnings\.length === 0/);
});

for (const height of [84, 96]) for (const width of [33.5, 96, 180]) for (const aspect of [1440 / 620, 390 / 460]) {
  test(`camera contains all room corners: ${width}W ${height}H aspect ${aspect}`, () => {
    const roomDepth = 24;
    const fit = fitReachInCamera({ width, height, roomDepth, aspect });
    const camera = new PerspectiveCamera(fit.fov, aspect, 0.1, fit.distance * 4);
    camera.position.set(...fit.position);
    camera.lookAt(...fit.target);
    camera.updateMatrixWorld();
    for (const x of [-width / 2, width / 2]) for (const y of [0, height + 8]) for (const z of [-7.35, roomDepth - 7]) {
      const projected = new Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95);
      assert.ok(projected.z > -1 && projected.z < 1);
    }
  });
}
