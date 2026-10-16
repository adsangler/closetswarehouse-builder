import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPrintablePlan } from '../api/quote-print.js';
import { buildDetailedWalkInParts } from '../src/partList.js';

const runs = {
  back: [{ code: 'DH', width: 24 }, { code: 'S3D', width: 30 }],
  left: [{ code: 'LH', width: 24 }],
  right: [{ code: 'HS', width: 30 }],
  leftReturn: [{ code: 'SHELF', width: 18 }],
  rightReturn: [{ code: 'SHELF', width: 18 }],
};

const room84 = { backHeight: 84, leftHeight: 84, rightHeight: 84 };

function quantityFor(html, sku) {
  const escapedSku = sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<td>([^<]*)</td>\\s*<td>${escapedSku}</td>`));
  assert.ok(match, `Missing ${sku} from printable pick list`);
  return Number(match[1]);
}

function renderWithRoom(room) {
  return renderPrintablePlan({
    record: {
      quoteId: 'WALKIN-HEIGHT-TEST',
      planType: 'Walk-in closet',
      quote: {
        internalType: 'walk-in',
        room,
        runs,
        // Simulate a saved plan whose material snapshot was calculated at 84 inches.
        materials: buildDetailedWalkInParts(room84, runs),
      },
    },
  });
}

test('saved 96-inch walk-in print adds one adjustable shelf per tower', () => {
  const html = renderWithRoom({ backHeight: 96, leftHeight: 96, rightHeight: 96 });

  assert.equal(quantityFor(html, 'SH-18-14-W'), 14);
  assert.equal(quantityFor(html, 'SH-24-14-W'), 4);
  assert.equal(quantityFor(html, 'SH-30-14-W'), 9);
  assert.equal(quantityFor(html, 'PIN-20-S'), 6);
});

test('saved walk-in print uses the height of each wall and return', () => {
  const html = renderWithRoom({ backHeight: 96, leftHeight: 84, rightHeight: 84 });

  assert.equal(quantityFor(html, 'SH-18-14-W'), 12);
  assert.equal(quantityFor(html, 'SH-24-14-W'), 3);
  assert.equal(quantityFor(html, 'SH-30-14-W'), 8);
  assert.equal(quantityFor(html, 'PIN-20-S'), 5);
});
