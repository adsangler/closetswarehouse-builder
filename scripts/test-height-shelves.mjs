import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { adjustableShelfCount } from '../src/shelfCounts.js';
import { buildPickList } from '../src/pickList.js';

// Execute the actual layout functions without mounting React or exporting files.
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end + 2);
}
const expected = { LH: 1, DH: 1, HS: 3, S3D: 4, H3D: 2, S2D: 4, S7: 6 };
for (const file of ['src/App.jsx', 'src/walkin.jsx', 'scripts/export-shopify-glb.mjs']) {
  const walk = file.includes('walkin');
  const source = fs.readFileSync(file, 'utf8');
  const name = walk ? 'buildWalkInTowerLayout' : 'buildTowerLayout';
  const context = vm.createContext({ adjustableShelfCount, panelThickness: 0.75, toeKickHeight: 5 });
  vm.runInContext(['buildAdjustableShelves', 'buildDrawers', 'getDrawerBounds', name].map(n => extract(source, n)).join('\n'), context);
  test(`${file}: connected mixed-width pick list adds one shelf per taller tower`, () => {
    const modules = [{ code: 'DH', width: 24 }, { code: 'S3D', width: 30 }, { code: 'S7', width: 18 }];
    for (const height of [84, 96]) {
      const materials = modules.flatMap(tower => {
        const code = tower.code === 'S7' && height === 96 ? 'S8' : tower.code;
        const layout = walk ? context[name](height, code) : context[name]({ height }, { ...tower, code, bayX: 0 });
        return ['SH', 'FS'].map(prefix => ({ category: 'Shelves', sku: `${prefix}-${tower.width}-14-W`, quantity: layout.shelves.filter(s => prefix === 'FS' ? s.fixed : !s.fixed).length }));
      });
      const pick = buildPickList(materials, modules.length);
      const qty = sku => pick.find(p => p.sku === sku)?.quantity;
      const extra = height === 96 ? 1 : 0;
      assert.equal(qty('SH-24-14-W'), 1 + extra);
      assert.equal(qty('SH-30-14-W'), 4 + extra);
      assert.equal(qty('SH-18-14-W'), 6 + extra);
      assert.equal(qty('PIN-20-S'), Math.ceil((11 + extra * 3) * 4 / 20));
      assert.equal(pick.filter(p => p.sku.startsWith('FS-')).reduce((n, p) => n + p.quantity, 0), 6);
    }
  });
  for (const [baseCode, count] of Object.entries(expected)) {
    for (const width of [18, 24, 30]) test(`${file}: ${baseCode} ${width} inch, 84 to 96`, () => {
      for (const height of [84, 96]) {
        const code = baseCode === 'S7' && height === 96 ? 'S8' : baseCode;
        const layout = walk ? context[name](height, code) : context[name]({ height }, { code, width, bayX: 0 });
        assert.equal(layout.shelves.filter(s => !s.fixed).length, count + (height === 96 ? 1 : 0));
        assert.equal(layout.shelves.filter(s => s.fixed).length, 2);
        assert.equal(new Set(layout.shelves.map(s => s.y)).size, layout.shelves.length);
        assert.ok(layout.shelves.every(s => Number.isFinite(s.y) && s.y >= 5 && s.y <= height - 0.75));
      }
    });
  }
}
