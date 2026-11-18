export const pickListGroups = ['Panels', 'Shelves', 'Toe kicks', 'Kits', 'Shelf pins', 'Hardware', 'Added Parts', 'Added parts', 'Parts'];

// These are loose pieces from the former per-tower packing kit.
const towerHardware = [
  { name: 'Wall bracket', category: 'Hardware', perTower: 2 },
  { name: 'Wall bracket to shelf screws', legacyName: 'Shelf-connection screw', category: 'Hardware', perTower: 2 },
  { name: 'Rafix connector', category: 'Hardware', perTower: 9, details: 'Includes one spare per tower.' },
  { name: 'Rafix screw', category: 'Hardware', perTower: 9, details: 'Includes one spare per tower.' },
  { name: 'Toe-kick bracket', category: 'Toe kicks', perTower: 2, toeKick: true },
  { name: 'Toe-kick euro screw', category: 'Toe kicks', perTower: 8, toeKick: true },
];

const drawerHardware = [
  { name: 'Left drawer track', perDrawer: 1 },
  { name: 'Right drawer track', perDrawer: 1 },
  { name: 'Drawer track Euro screw', perDrawer: 6, details: '3 screws per track.' },
];

function isDrawerKit(part) {
  return /^DRK-/i.test(part.sku || '');
}

export function comparePickParts(a, b) {
  const rank = (part) => {
    const sku = String(part.sku || '').toUpperCase();
    return sku.startsWith('FS-') || sku.startsWith('DRK-') ? 0 : 1;
  };
  return rank(a) - rank(b) || String(a.sku || a.name || '').localeCompare(String(b.sku || b.name || ''), undefined, { numeric: true });
}

const legacyHardwareCategories = new Set(['Tower hardware bags', 'Tower hardware kits']);

export function buildPickList(materials = [], towerCount = 0, { pantry = false } = {}) {
  const savedKitCount = materials
    .filter((part) => legacyHardwareCategories.has(part.category))
    .reduce((sum, part) => sum + (Number(part.quantity) || 0), 0);
  const total = Math.max(0, Math.floor(Number(towerCount) || savedKitCount));
  const included = new Set(['WLB-S-1', 'CAMKIT-10-W', 'RDB-S-1', 'WOOD-SCREW', 'WALL-SCREW']);
  const parts = materials.filter((part) => {
    // Explicit extras still need to be picked, even when also present in a kit.
    if (/^added parts$/i.test(part.category || '')) return true;
    if (!part.sku && part.category === 'Hardware' && drawerHardware.some(({ name }) => part.name === name)) return false;
    // Saved quotes can already contain the expanded rows. Rebuild them once.
    if (total && !part.sku && towerHardware.some(({ name, legacyName, category }) =>
      part.category === category && (part.name === name || (legacyName && part.name === legacyName))
    )) return false;
    return !included.has(String(part.sku || '').toUpperCase()) && !legacyHardwareCategories.has(part.category);
  }).map((part) => {
    if (/^added parts$/i.test(part.category || '')) return { ...part };
    const sku = String(part.sku || '').toUpperCase();
    if (isDrawerKit(part)) return { ...part, details: 'Assembled drawer. Pick both tracks and their Euro screws separately.' };
    if (sku.startsWith('TKK-')) return { ...part, category: 'Toe kicks', name: String(part.name || sku).replace(/toe-kick kit/i, 'Toe-kick board'), details: 'Board only. Brackets and euro screws are listed separately.' };
    if (sku.startsWith('PIN-')) return { ...part, category: 'Shelf pins' };
    return { ...part };
  });
  const drawerCount = parts.filter(isDrawerKit).reduce((sum, part) => sum + (Number(part.quantity) || 0), 0);
  if (drawerCount > 0) {
    for (const { name, perDrawer, details = '' } of drawerHardware) {
      parts.push({ name, category: 'Hardware', sku: '', quantity: drawerCount * perDrawer, details });
    }
  }
  if (total) {
    for (const { name, category, perTower, toeKick, details = '' } of towerHardware) {
      if (!pantry || !toeKick) parts.push({ name, category, sku: '', quantity: total * perTower, details });
    }
  }
  const aggregated = new Map();
  for (const part of parts) {
    const key = `${part.category}|${part.sku || part.name}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += Number(part.quantity) || 0;
      if (part.details && !existing.details?.includes(part.details)) {
        existing.details = [existing.details, part.details].filter(Boolean).join(' ');
      }
    }
    else aggregated.set(key, { ...part, quantity: Number(part.quantity) || 0 });
  }
  // Round once for the whole pick list, not once per tower or plan.
  const adjustableShelves = [...aggregated.values()].filter((part) => /^SH-/.test(String(part.sku || '').toUpperCase()) && !/^added parts$/i.test(part.category || ''));
  if (adjustableShelves.length) {
    const pinsNeeded = adjustableShelves.reduce((sum, part) => sum + part.quantity * 4, 0);
    for (const [key, part] of aggregated) {
      if (part.sku === 'PIN-20-S' && !/^added parts$/i.test(part.category || '')) aggregated.delete(key);
    }
    aggregated.set('Shelf pins|PIN-20-S', {
      category: 'Shelf pins', sku: 'PIN-20-S', name: 'Shelf pin bag, 20 pins',
      quantity: Math.ceil(pinsNeeded / 20), details: `${pinsNeeded} shelf pins required.`,
    });
  }
  return [...aggregated.values()].filter((part) => part.quantity > 0).sort((a, b) => {
    const index = (part) => { const i = pickListGroups.indexOf(part.category); return i < 0 ? pickListGroups.length : i; };
    return index(a) - index(b) || comparePickParts(a, b);
  });
}
