// ASCII-escaped JSON supports Unicode names while retaining compatibility with
// old Latin-1 links and the server's UTF-8 base64 decoder.
export function encodePlanPayload(payload) {
  const json = JSON.stringify(payload).replace(/[\u007f-\uffff]/g, char =>
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
  window.history.replaceState(window.history.state, '', url.toString());
}
