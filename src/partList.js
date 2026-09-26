import { adjustableShelfCount } from './shelfCounts.js';
import { buildPickList } from './pickList.js';

export const towerNames = {
  FR: 'Frame Only',
  LH: 'Long Hang',
  DH: 'Double Hang',
  HS: 'Hang & Shelves',
  S3D: 'Shelves & 3 Drawer',
  H3D: 'Hang & 3 Drawer',
  S2D: 'Shelves & 2 Drawer',
  S7: '7-Shelf',
  S8: '8-Shelf',
};

export const wallLabels = {
  back: 'Back wall',
  left: 'Left wall',
  right: 'Right wall',
  leftReturn: 'Left return wall',
  rightReturn: 'Right return wall',
};

export const planWalls = ['back', 'left', 'right', 'leftReturn', 'rightReturn'];

const wallHeightKeys = {
  back: 'backHeight',
  left: 'leftHeight',
  right: 'rightHeight',
  leftReturn: 'leftHeight',
  rightReturn: 'rightHeight',
};

export function getShelfCodeForHeight(height) {
  return Number(height) >= 96 ? 'S8' : 'S7';
}

export function getLayoutCode(module = {}, height = 84) {
  return module.code === 'SHELF' ? getShelfCodeForHeight(height) : String(module.code || '').toUpperCase();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function addPart(parts, sku, name, quantity = 1, details = '', category = 'Parts') {
  if (!quantity) return;
  const key = `${category}|${sku}|${name}|${details}`;
  const current = parts.get(key);
  parts.set(key, {
    category,
    sku,
    name,
    details,
    quantity: (current?.quantity || 0) + quantity,
  });
}

export function getTowerPartCounts(code, height = 84) {
  const normalized = getLayoutCode({ code }, height);
  const adjustableShelves = adjustableShelfCount(normalized, height);

  if (normalized === 'LH') return { fixedShelves: 2, adjustableShelves, rods: 1, smallDrawers: 0, largeDrawers: 0 };
  if (normalized === 'DH') return { fixedShelves: 2, adjustableShelves, rods: 2, smallDrawers: 0, largeDrawers: 0 };
  if (normalized === 'HS') return { fixedShelves: 2, adjustableShelves, rods: 1, smallDrawers: 0, largeDrawers: 0 };
  if (normalized === 'S2D') return { fixedShelves: 2, adjustableShelves, rods: 0, smallDrawers: 2, largeDrawers: 0 };
  if (normalized === 'S3D') return { fixedShelves: 2, adjustableShelves, rods: 0, smallDrawers: 2, largeDrawers: 1 };
  if (normalized === 'H3D') return { fixedShelves: 2, adjustableShelves, rods: 1, smallDrawers: 2, largeDrawers: 1 };

  return { fixedShelves: 2, adjustableShelves, rods: 0, smallDrawers: 0, largeDrawers: 0 };
}

export function buildDetailedReachInParts(modules = [], height = 84) {
  const parts = new Map();
  const towerHeight = Number(height) || 84;

  if (!modules.length) return [];

  addPart(parts, `VL-14-${towerHeight}-W`, `Left vertical panel 14" x ${towerHeight}"`, 1, 'Outer left side panel.', 'Panels');
  addPart(parts, `VR-14-${towerHeight}-W`, `Right vertical panel 14" x ${towerHeight}"`, 1, 'Outer right side panel.', 'Panels');
  addPart(parts, `VD-14-${towerHeight}-W`, `Shared divider panel 14" x ${towerHeight}"`, Math.max(0, modules.length - 1), 'One shared divider at each tower joint; no doubled side panels.', 'Panels');

  let towerCount = 0;
  modules.forEach((module) => {
    const code = getLayoutCode(module, towerHeight);
    const width = numberValue(module.width);
    const counts = getTowerPartCounts(code, towerHeight);
    towerCount += 1;

    addPart(parts, `FS-${width}-14-W`, `Fixed shelf ${width}" x 14"`, counts.fixedShelves, code === 'HS' ? `Fixed shelves for ${width}" HS bays: top frame and shelf directly below the hanging section.` : `Fixed shelves for ${width}" bays.`, 'Shelves');
    addPart(parts, `SH-${width}-14-W`, `Adjustable shelf ${width}" x 14"`, counts.adjustableShelves, code === 'HS' ? `Adjustable shelves for ${width}" HS bays: lower shelves including the bottom shelf above the toe kick.` : `Adjustable shelves for ${width}" bays.`, 'Shelves');
    addPart(parts, `TKK-${width}-5-W`, `Toe-kick kit ${width}" x 5"`, 1, 'Toe-kick kit for this tower bay.', 'Kits');
    addPart(parts, `RK-${width}-S`, `Rod kit ${width}"`, counts.rods, 'Complete hanging rod kit with one rod and one pair of rod brackets.', 'Kits');
    addPart(parts, `DRK-${width}-5-13-W`, `Small drawer kit ${width}" x 5" x 13"`, counts.smallDrawers, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
    addPart(parts, `DRK-${width}-10-13-W`, `Large drawer kit ${width}" x 10" x 13"`, counts.largeDrawers, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
  });

  addPart(parts, 'WLB-S-1', 'Wall bracket kit', towerCount * 2, 'Includes one L-bracket and one closet-connection screw. Wall fastener or anchor is not included; use the appropriate fastener for the wall type. Two kits per tower section.', 'Kits');
  addPart(parts, 'CAMKIT-10-W', 'Camfix and cam-screw kit, 10 pairs', Math.ceil((towerCount * 9) / 10), `${towerCount * 2 * 4} connector pairs required for ${towerCount * 2} fixed shelves, plus ${towerCount} spare pairs (one per tower).`, 'Hardware');

  return buildPickList([...parts.values()], towerCount);
}

export function buildDetailedWalkInParts(room = {}, runs = {}) {
  const parts = new Map();
  let towerCount = 0;

  planWalls.forEach((wall) => {
    const modules = Array.isArray(runs[wall]) ? runs[wall] : [];
    const heightKey = wallHeightKeys[wall];
    const height = Number(room[heightKey] || room.height || 96);
    const towerHeight = [84, 96].includes(height) ? height : 96;

    if (!modules.length) return;

    towerCount += modules.length;
    addPart(parts, `VL-14-${towerHeight}-W`, `Left vertical panel 14" x ${towerHeight}"`, 1, `${wallLabels[wall]} outer left side panel.`, 'Panels');
    addPart(parts, `VR-14-${towerHeight}-W`, `Right vertical panel 14" x ${towerHeight}"`, 1, `${wallLabels[wall]} outer right side panel.`, 'Panels');
    addPart(parts, `VD-14-${towerHeight}-W`, `Shared divider panel 14" x ${towerHeight}"`, Math.max(0, modules.length - 1), `${wallLabels[wall]} shared dividers between connected towers.`, 'Panels');

    modules.forEach((module) => {
      const code = getLayoutCode(module, towerHeight);
      const width = numberValue(module.width);
      const counts = getTowerPartCounts(code, towerHeight);

      addPart(parts, `FS-${width}-14-W`, `Fixed shelf ${width}" x 14"`, counts.fixedShelves, code === 'HS' ? `Fixed shelves for ${width}" HS bays: top frame and shelf directly below the hanging section.` : `Fixed shelves for ${width}" bays.`, 'Shelves');
      addPart(parts, `SH-${width}-14-W`, `Adjustable shelf ${width}" x 14"`, counts.adjustableShelves, code === 'HS' ? `Adjustable shelves for ${width}" HS bays: lower shelves including the bottom shelf above the toe kick.` : `Adjustable shelves for ${width}" bays.`, 'Shelves');
      addPart(parts, `TKK-${width}-5-W`, `Toe-kick kit ${width}" x 5"`, 1, `Toe-kick kit for the ${wallLabels[wall].toLowerCase()} run.`, 'Kits');
      addPart(parts, `RK-${width}-S`, `Rod kit ${width}"`, counts.rods, `${wallLabels[wall]} complete hanging rod kit with one rod and one pair of rod brackets.`, 'Kits');
      addPart(parts, `DRK-${width}-5-13-W`, `Small drawer kit ${width}" x 5" x 13"`, counts.smallDrawers, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
      addPart(parts, `DRK-${width}-10-13-W`, `Large drawer kit ${width}" x 10" x 13"`, counts.largeDrawers, 'Complete drawer kit with panels, rails, screws, and centered bar pull.', 'Kits');
    });
  });

  addPart(parts, 'WLB-S-1', 'Wall bracket kit', towerCount * 2, 'Includes one L-bracket and one closet-connection screw. Wall fastener or anchor is not included; use the appropriate fastener for the wall type. Two kits per tower section.', 'Kits');
  addPart(parts, 'CAMKIT-10-W', 'Camfix and cam-screw kit, 10 pairs', Math.ceil((towerCount * 9) / 10), `${towerCount * 2 * 4} connector pairs required for ${towerCount * 2} fixed shelves, plus ${towerCount} spare pairs (one per tower).`, 'Hardware');

  return buildPickList([...parts.values()], towerCount);
}
