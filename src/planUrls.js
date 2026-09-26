import { publicEstimate, quoteCreatedAt } from './estimateValidity.js';

// ASCII-escaped JSON supports Unicode names while retaining compatibility with
// old Latin-1 links and the server's UTF-8 base64 decoder.
export function encodePlanPayload(payload) {
  const safePayload = payload.savedEstimate ? { ...payload, savedEstimate: publicEstimate(payload.savedEstimate) } : payload;
  const json = JSON.stringify(safePayload).replace(/[\u007f-\uffff]/g, char =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodePlanPayload(encodedPlan) {
  const normalized = String(encodedPlan || '').trim().replace(/\s/g, '+').replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
}

export function persistSavedPlanReference(planUrl, quoteId) {
  if (typeof window === 'undefined' || !quoteId) return;
  const url = new URL(planUrl, window.location.href);
  url.searchParams.set('quote', quoteId);
  cleanSavedEstimateUrl(url);
  window.history.replaceState(window.history.state, '', url.toString());
}

function cleanSavedEstimateUrl(url) {
  try {
    const plan = decodePlanPayload(url.searchParams.get('plan'));
    if (!plan.savedEstimate) return;
    plan.savedEstimate = publicEstimate(plan.savedEstimate);
    const createdAt = quoteCreatedAt(url.searchParams.get('quote'));
    if (createdAt) plan.savedEstimate.createdAt = createdAt;
    url.searchParams.set('plan', encodePlanPayload(plan));
  } catch { /* Leave invalid or absent plans to the planner's validation. */ }
}

// Clean legacy personal fields from the address before the planner reads it.
if (typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  cleanSavedEstimateUrl(url);
  if (url.toString() !== window.location.href) window.history.replaceState(window.history.state, '', url.toString());
}
