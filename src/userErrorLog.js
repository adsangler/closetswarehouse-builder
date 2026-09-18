const reportedErrors = new Set();

const spaceLimitationPatterns = [
  /dimension/i,
  /does not fit|doesn't fit|too wide|not enough (?:wall|space)|space limitation/i,
  /wall (?:space|width|capacity)|usable (?:wall|length)|run is .* usable length/i,
  /opening (?:wall math|should be|must be|is only|clear)/i,
  /return wall is only|return-wall closet/i,
  /ceiling (?:height|must be|clearance)|closet height must/i,
  /drawer.*(?:blocked|clear|opening|open all the way)/i,
  /corner.*(?:clear|reach|space)/i,
];

export function isSpaceLimitationError(message) {
  const text = String(message || '').trim();
  return Boolean(text && spaceLimitationPatterns.some((pattern) => pattern.test(text)));
}

export async function reportUserVisibleError({ message, planner, action, details } = {}) {
  const normalizedMessage = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!normalizedMessage || isSpaceLimitationError(normalizedMessage) || typeof window === 'undefined') return;

  const record = {
    timestamp: new Date().toISOString(),
    message: normalizedMessage,
    planner: String(planner || 'unknown').slice(0, 40),
    action: String(action || 'unknown').slice(0, 80),
    path: `${window.location.pathname}${window.location.search ? '?[query omitted]' : ''}`.slice(0, 180),
    details: details && typeof details === 'object' ? details : undefined,
  };
  const dedupeKey = `${record.planner}|${record.action}|${record.message}|${record.path}`;
  if (reportedErrors.has(dedupeKey)) return;
  reportedErrors.add(dedupeKey);

  try {
    await fetch('/api/user-error-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      keepalive: true,
    });
  } catch {
    // Error reporting must never interfere with the planner.
  }
}
