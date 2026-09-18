import { sendJson } from './_airtable.js';

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

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function isSpaceLimitationError(message) {
  return spaceLimitationPatterns.some((pattern) => pattern.test(message));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10000) throw new Error('Payload too large');
  }
  return JSON.parse(body || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readJson(req);
    const message = cleanText(payload.message, 500);
    if (!message || isSpaceLimitationError(message)) {
      sendJson(res, 204, null);
      return;
    }

    const record = {
      event: 'planner_user_visible_error',
      timestamp: /^\d{4}-\d{2}-\d{2}T/.test(payload.timestamp) ? payload.timestamp : new Date().toISOString(),
      message,
      planner: cleanText(payload.planner, 40),
      action: cleanText(payload.action, 80),
      path: cleanText(payload.path, 180),
      details: payload.details && typeof payload.details === 'object' ? payload.details : undefined,
    };

    console.error(JSON.stringify(record));
    sendJson(res, 202, { ok: true });
  } catch {
    sendJson(res, 400, { error: 'Invalid error log payload' });
  }
}
