const fallbackByCode = {
  LH: 225,
  DH: 245,
  HS: 260,
  S3D: 545,
  H3D: 560,
  S2D: 450,
  S7: 275,
  S8: 315,
};

const allowedCodes = new Set([...Object.keys(fallbackByCode), 'FR']);
const allowedWidthsByCode = {
  FR: new Set([18, 24, 30]),
  LH: new Set([18, 24, 30]),
  DH: new Set([18, 24, 30]),
  HS: new Set([18, 24, 30]),
  S3D: new Set([24, 30]),
  H3D: new Set([24, 30]),
  S2D: new Set([24, 30]),
  S7: new Set([18, 24, 30]),
  S8: new Set([18, 24, 30]),
};
const towerNames = {
  FR: 'Frame Only',
  LH: 'Long Hang',
  DH: 'Double Hang',
  HS: 'Hang & Shelves',
  S3D: 'Shelves & 3 Drawers',
  H3D: 'Hang & 3 Drawers',
  S2D: 'Shelves & 2 Drawers',
  S7: '7-Shelf',
  S8: '8-Shelf',
};

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function cleanUrl(value) {
  const text = cleanText(value, 90000);

  if (!/^https?:\/\//i.test(text)) {
    return '';
  }

  try {
    const url = new URL(text);
    const allowedHosts = new Set([
      'localhost',
      '127.0.0.1',
      'closetswarehouse.com',
      'www.closetswarehouse.com',
      'closetswarehouse-builder.vercel.app',
    ]);

    return allowedHosts.has(url.hostname) ? text : '';
  } catch {
    return '';
  }
}

function cleanNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getModuleLabel(code, rawLabel) {
  const label = cleanText(rawLabel, 80).replace(/\s+\d+(?:\.\d+)?\"?$/g, '');
  return towerNames[code] || (label && !/^[A-Z0-9]+$/.test(label) ? label : 'Closet tower');
}

function cleanModule(module = {}, index = 0) {
  const code = cleanText(module.code, 12).toUpperCase();
  const width = cleanNumber(module.width);
  const allowedWidths = allowedWidthsByCode[code];

  if (!allowedCodes.has(code) || !allowedWidths?.has(width)) {
    return null;
  }

  const label = getModuleLabel(code, module.label || module.name);

  return {
    ...(module.wall ? { wall: cleanText(module.wall, 20) } : {}),
    index: Number.isInteger(module.index) ? module.index : index,
    code,
    width,
    label,
    displayName: `${label} / ${width}" bay`,
  };
}

function cleanDrawings(drawings) {
  if (!Array.isArray(drawings)) return [];

  return drawings.slice(0, 8).map((drawing) => {
    const dataUrl = String(drawing?.dataUrl || '');
    if (!dataUrl.startsWith('data:image/svg+xml;charset=utf-8,') || dataUrl.length > 150000) return null;
    return {
      title: cleanText(drawing?.title || 'Plan drawing', 80),
      dataUrl,
    };
  }).filter(Boolean);
}

function cleanMaterials(materials) {
  if (!Array.isArray(materials)) return [];

  return materials.slice(0, 200).map((part) => {
    const quantity = cleanNumber(part?.quantity);
    if (!(quantity > 0)) return null;

    return {
      category: cleanText(part?.category || 'Parts', 40),
      sku: cleanText(part?.sku, 80),
      name: cleanText(part?.name || part?.label || 'Part', 140),
      quantity,
      details: cleanText(part?.details, 300),
    };
  }).filter(Boolean);
}

function estimateModules(modules) {
  // Frame Only must use its live Airtable price, never a storage-tower fallback.
  if (modules.some((module) => module.code === 'FR')) return 0;
  const groups = new Map();

  modules.forEach((module) => {
    const key = module.wall || 'reach-in';
    const group = groups.get(key) || [];
    group.push(module);
    groups.set(key, group);
  });

  let total = 0;

  groups.forEach((group) => {
    const baseTotal = group.reduce((sum, module) => sum + (fallbackByCode[module.code] || 275), 0);
    const sharedPanelCredit = Math.max(0, group.length - 1) * 32;
    total += Math.max(0, baseTotal - sharedPanelCredit);
  });

  return Number(total.toFixed(2));
}

export function normalizeQuoteSubmission(rawQuote = {}, { quoteId, submittedAt } = {}) {
  const modules = (Array.isArray(rawQuote.modules) ? rawQuote.modules : [])
    .map(cleanModule)
    .filter(Boolean);
  const clientEstimatedPrice = cleanNumber(rawQuote.estimatedPrice);
  const serverEstimatedPrice = estimateModules(modules);
  const estimatedPrice = clientEstimatedPrice > 0 ? clientEstimatedPrice : serverEstimatedPrice;

  return {
    ...rawQuote,
    quoteId,
    submittedAt,
    customer: {
      firstName: cleanText(rawQuote.customer?.firstName, 80),
      lastName: cleanText(rawQuote.customer?.lastName, 80),
      email: cleanEmail(rawQuote.customer?.email),
      phone: cleanText(rawQuote.customer?.phone, 40),
    },
    marketingConsent: rawQuote.marketingConsent === true,
    planType: cleanText(rawQuote.planType || rawQuote.internalType || 'closet plan', 40),
    internalType: cleanText(rawQuote.internalType || rawQuote.planType || 'closet plan', 80),
    planUrl: cleanUrl(rawQuote.planUrl),
    drawings: cleanDrawings(rawQuote.drawings),
    modules,
    materials: cleanMaterials(rawQuote.materials),
    estimatedPrice,
    clientEstimatedPrice,
    serverEstimatedPrice,
    pricingSource: clientEstimatedPrice > 0 ? 'planner-estimate' : 'server-fallback',
    signature: cleanText(rawQuote.signature, 500),
  };
}

export function validateNormalizedQuote(quote) {
  if (!quote.customer?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.customer.email)) {
    return 'A valid email is required.';
  }

  if (!quote.modules?.length) {
    return 'At least one closet tower is required.';
  }

  if (!(Number(quote.estimatedPrice) > 0)) {
    return 'We could not calculate this plan price from the live catalog. Please adjust the layout or try again.';
  }

  return '';
}

export function attachQuoteReferenceToPlanUrl(planUrl, quoteId) {
  if (!planUrl || !quoteId) return planUrl || '';

  try {
    const url = new URL(planUrl);
    url.searchParams.set('estimate', '1');
    url.searchParams.set('quote', quoteId);
    return cleanUrl(url.toString());
  } catch {
    return planUrl;
  }
}
