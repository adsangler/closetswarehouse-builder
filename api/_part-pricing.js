function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function fieldValue(fields, names) {
  const wanted = new Set(names.map(normalizeKey));
  const entry = Object.entries(fields || {}).find(([name]) => wanted.has(normalizeKey(name)));
  return entry?.[1];
}

function firstArrayValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function numberValue(value) {
  if (Array.isArray(value)) {
    return numberValue(value[0]);
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function textValue(value) {
  if (Array.isArray(value)) {
    return textValue(value[0]);
  }

  return String(value || '').trim();
}

function recordSku(record) {
  return textValue(
    fieldValue(record.fields, [
      'sku',
      'SKU',
      'Part SKU',
      'Part Number',
      'Item Code',
      'shopify_sku',
      'Shopify SKU',
      'Component SKU',
      'Name',
      'Part Name',
      'Component Name',
    ]),
  );
}

function lookupRecord(records, value) {
  const lookup = firstArrayValue(value);

  if (!lookup) {
    return null;
  }

  const idMatch = records.find((record) => record.id === lookup);

  if (idMatch) {
    return idMatch;
  }

  const wanted = textValue(lookup).toLowerCase();
  return records.find((record) => recordSku(record).toLowerCase() === wanted) || null;
}

function getPartRef(fields) {
  return fieldValue(fields, ['Part', 'Part Link', 'Part SKU', 'Part Name', 'Parent Part']);
}

function getComponentRef(fields) {
  return fieldValue(fields, ['Component', 'Component Link', 'Component SKU', 'Component Name']);
}

function getQuantity(fields) {
  return numberValue(fieldValue(fields, ['Quantity', 'Qty', 'Component Quantity', 'Units'])) || 1;
}

function getCost(fields) {
  return numberValue(fieldValue(fields, ['Cost', 'Total Cost', 'unit_cost', 'Unit Cost', 'component_cost', 'Component Cost']));
}

function getPrice(fields) {
  return numberValue(fieldValue(fields, ['Price', 'retail_price', 'Retail Price', 'Unit Price', 'component_price', 'Component Price']));
}

function getName(fields, fallback = '') {
  return textValue(fieldValue(fields, ['Name', 'Part Name', 'Component Name', 'Title'])) || fallback;
}

function roundMoney(value) {
  return Number((Number(value) || 0).toFixed(2));
}

export function buildResolvedParts({ parts, components, partComponents }) {
  const linksByPartId = new Map();

  (partComponents || []).forEach((linkRecord) => {
    const partRecord = lookupRecord(parts, getPartRef(linkRecord.fields));
    const componentRecord = lookupRecord(components, getComponentRef(linkRecord.fields));

    if (!partRecord || !componentRecord) {
      return;
    }

    const quantity = getQuantity(linkRecord.fields);
    const componentCost = getCost(componentRecord.fields) || getCost(linkRecord.fields);
    const componentPrice = getPrice(componentRecord.fields) || getPrice(linkRecord.fields);
    const item = {
      linkRecordId: linkRecord.id,
      componentRecordId: componentRecord.id,
      componentSku: recordSku(componentRecord),
      componentName: getName(componentRecord.fields, recordSku(componentRecord)),
      quantity,
      unitCost: roundMoney(componentCost),
      unitPrice: roundMoney(componentPrice),
      extendedCost: roundMoney(quantity * componentCost),
      extendedPrice: roundMoney(quantity * componentPrice),
    };

    linksByPartId.set(partRecord.id, [...(linksByPartId.get(partRecord.id) || []), item]);
  });

  return (parts || []).map((part) => {
    const componentItems = linksByPartId.get(part.id) || [];
    const explicitCost = getCost(part.fields);
    const explicitPrice = getPrice(part.fields);
    const componentCost = roundMoney(componentItems.reduce((total, item) => total + item.extendedCost, 0));
    const componentPrice = roundMoney(componentItems.reduce((total, item) => total + item.extendedPrice, 0));
    const usesComponents = componentItems.length > 0;

    return {
      ...part,
      resolved: {
        sku: recordSku(part),
        name: getName(part.fields, recordSku(part)),
        usesComponents,
        costSource: usesComponents && explicitCost <= 0 ? 'components' : 'part',
        priceSource: usesComponents && explicitPrice <= 0 ? 'components' : 'part',
        cost: explicitCost > 0 ? roundMoney(explicitCost) : componentCost,
        price: explicitPrice > 0 ? roundMoney(explicitPrice) : componentPrice,
        componentCost,
        componentPrice,
        explicitCost: roundMoney(explicitCost),
        explicitPrice: roundMoney(explicitPrice),
        components: componentItems,
      },
    };
  });
}
