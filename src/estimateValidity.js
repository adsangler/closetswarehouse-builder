export function quoteCreatedAt(quoteId = '') {
  const match = /^CWQ-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-/.exec(quoteId);
  if (!match) return '';
  const [, y, m, d, h, min, s] = match;
  const value = `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  return Number.isFinite(Date.parse(value)) ? value : '';
}

export function priceValidity(estimate, quoteId, now = Date.now()) {
  const createdAt = quoteCreatedAt(quoteId) || estimate?.createdAt;
  const expires = Date.parse(createdAt) + 7 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(expires)) return 'Creation date unavailable. Contact us to confirm pricing.';
  const date = new Date(expires).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
  return now >= expires
    ? `Price expired ${date}. Contact us for updated pricing.`
    : `Price valid until ${date}`;
}

export function publicEstimate(estimate) {
  if (!estimate) return estimate;
  return { estimatedPrice: estimate.estimatedPrice, ...(estimate.createdAt ? { createdAt: estimate.createdAt } : {}) };
}
