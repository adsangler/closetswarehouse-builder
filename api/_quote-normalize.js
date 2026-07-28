const allowedCodes = new Set(['LH', 'DH', 'HS', 'S3D', 'H3D', 'S2D', 'S7', 'S8']);
const allowedWidthsByCode = {
  LH: new Set([18, 24, 30]),
  DH: new Set([18, 24, 30]),
  HS: new Set([24, 30]),
  S3D: new Set([24, 30]),
  H3D: new Set([24, 30]),
  S2D: new Set([24, 30]),
  S7: new Set([18, 24, 30]),
  S8: new Set([18, 24, 30]),
};

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function cleanUrl(value) {
  const text = cleanText(value, 500);

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

function cleanModule(module = {}, index = 0) {
  const code = cleanText(module.code, 12).toUpperCase();
  const width = cleanNumber(module.width);
  const allowedWidths = allowedWidthsByCode[code];

  if (!allowedCodes.has(code) || !allowedWidths?.has(width)) {
    return null;
  }

  return {
    ...(module.wall ? { wall: cleanText(module.wall, 20) } : {}),
    index: Number.isInteger(module.index) ? module.index : index,
    code,
    width,
    label: cleanText(module.label, 80),
  };
}

export function normalizeQuoteSubmission(rawQuote = {}, { quoteId, submittedAt } = {}) {
  const modules = (Array.isArray(rawQuote.modules) ? rawQuote.modules : [])
    .map(cleanModule)
    .filter(Boolean);
  const clientEstimatedPrice = cleanNumber(rawQuote.estimatedPrice);
  const missingLiveCatalogPrice = clientEstimatedPrice <= 0;

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
    planType: cleanText(rawQuote.planType || rawQuote.internalType || 'closet plan', 40),
    internalType: cleanText(rawQuote.internalType || rawQuote.planType || 'closet plan', 80),
    planUrl: cleanUrl(rawQuote.planUrl),
    modules,
    estimatedPrice: missingLiveCatalogPrice ? 0 : clientEstimatedPrice,
    clientEstimatedPrice,
    pricingSource: missingLiveCatalogPrice ? 'missing-live-catalog-price' : 'client-live-catalog',
    pricingError: missingLiveCatalogPrice ? 'missing_live_catalog_price' : '',
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

  if (quote.pricingError || !(Number(quote.estimatedPrice) > 0)) {
    return 'We could not calculate this plan price from the live catalog. Please adjust the layout or try again.';
  }

  return '';
}
