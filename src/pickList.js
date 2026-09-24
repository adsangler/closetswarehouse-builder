// Packing labels are internal kit identifiers, not Airtable inventory SKUs.
export const pickListGroups = ['Panels', 'Shelves', 'Toe kicks', 'Kits', 'Tower hardware kits', 'Shelf pins', 'Hardware', 'Added Parts', 'Added parts', 'Parts'];

export function comparePickParts(a, b) {
  const rank = (part) => {
    const sku = String(part.sku || '').toUpperCase();
    return sku.startsWith('FS-') || sku.startsWith('DRK-') ? 0 : 1;
  };
  return rank(a) - rank(b) || String(a.sku || a.name || '').localeCompare(String(b.sku || b.name || ''), undefined, { numeric: true });
}

export function buildPickList(materials = [], towerCount = 0) {
  const included = new Set(['WLB-S-1', 'CAMKIT-10-W', 'RDB-S-1', 'WOOD-SCREW', 'WALL-SCREW']);
  const parts = materials.filter((part) => {
    // Explicit extras still need to be picked, even when also present in a kit.
    if (/^added parts$/i.test(part.category || '')) return true;
    return !included.has(String(part.sku || '').toUpperCase()) && !['Tower hardware bags', 'Tower hardware kits'].includes(part.category);
  }).map((part) => {
    if (/^added parts$/i.test(part.category || '')) return { ...part };
    const sku = String(part.sku || '').toUpperCase();
    if (sku.startsWith('TKK-')) return { ...part, category: 'Toe kicks', name: String(part.name || sku).replace(/toe-kick kit/i, 'Toe-kick board'), details: 'Board only. Brackets and euro screws are included in the tower hardware kits.' };
    if (sku.startsWith('PIN-')) return { ...part, category: 'Shelf pins' };
    return { ...part };
  });
  const total = Math.max(0, Math.floor(Number(towerCount) || 0));
  if (total) parts.push({
    category: 'Tower hardware kits', sku: '', quantity: total,
    name: 'Basic tower hardware kit (per tower)',
    details: 'Per tower kit: 2 wall brackets, 2 shelf-connection screws, 2 toe-kick brackets, 8 toe-kick euro screws, 9 Rafix connectors and 9 Rafix screws (includes 1 spare of each for 2 fixed shelves)',
  });
  const aggregated = new Map();
  for (const part of parts) {
    const key = `${part.category}|${part.sku || part.name}`;
    const existing = aggregated.get(key);
    if (existing) existing.quantity += Number(part.quantity) || 0;
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
