import { createHmac, timingSafeEqual } from 'node:crypto';
import { fetchAirtableQuotesByShopifyCustomerId, sendJson } from './_airtable.js';

const storefrontBaseUrl = 'https://closetswarehouse.com';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function buildLoginUrl() {
  return `${storefrontBaseUrl}/account/login?return_url=${encodeURIComponent('/pages/design-your-own-closets')}`;
}

function renderQuotesHtml({ quotes = [], customerId = '', state = 'ready', message = '' }) {
  const cards = quotes.length
    ? quotes.map((quote) => {
      const quoteId = escapeHtml(quote.quoteId || 'Saved plan');
      const planType = escapeHtml(quote.planType || 'Closet plan');
      const date = quote.submittedAt ? new Date(quote.submittedAt).toLocaleDateString('en-US') : '';
      const planUrl = escapeHtml(quote.planUrl || '');

      return `
        <article class="plan-card">
          <div>
            <p class="eyebrow">${planType}</p>
            <h3>${quoteId}</h3>
            ${date ? `<p class="muted">Saved ${escapeHtml(date)}</p>` : ''}
          </div>
          ${planUrl ? `<a class="button" href="${planUrl}" target="_top">Open plan</a>` : ''}
        </article>
      `;
    }).join('')
    : '<p class="empty">No saved plans yet. Create a reach-in or walk-in design and save it to your account.</p>';

  const body = state === 'login'
    ? `<p class="empty">Log in to view closet plans you saved from the design tool.</p><a class="button" href="${buildLoginUrl()}" target="_top">Log in</a>`
    : state === 'error'
      ? `<p class="empty">${escapeHtml(message || 'We could not load your saved plans right now.')}</p>`
      : `<div class="plans">${cards}</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; color: #1c1917; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: transparent; }
      .wrap { padding: 0; }
      .plans { display: grid; gap: 12px; }
      .plan-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid #e7e5e4; border-radius: 8px; background: #fff; }
      .eyebrow { margin: 0 0 4px; color: #d95d23; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      h3 { margin: 0; font-size: 18px; line-height: 1.2; }
      .muted, .empty { margin: 6px 0 0; color: #57534e; font-size: 14px; font-weight: 600; }
      .button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 10px 14px; border-radius: 6px; background: #1c1917; color: white; font-size: 14px; font-weight: 800; text-decoration: none; white-space: nowrap; }
      @media (max-width: 520px) { .plan-card { display: grid; } .button { width: 100%; } }
    </style>
  </head>
  <body>
    <main class="wrap" data-customer-id="${escapeHtml(customerId)}">
      ${body}
    </main>
  </body>
</html>`;
}

function verifyShopifyAppProxySignature(requestUrl) {
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const signature = requestUrl.searchParams.get('signature');

  if (!signature) {
    return false;
  }

  const params = new URLSearchParams(requestUrl.search);
  params.delete('signature');

  const message = [...params.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('');
  const digest = createHmac('sha256', secret).update(message).digest('hex');
  const expected = Buffer.from(digest, 'utf8');
  const actual = Buffer.from(signature, 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const wantsJson = requestUrl.searchParams.get('format') === 'json';

    if (!verifyShopifyAppProxySignature(requestUrl)) {
      if (wantsJson) {
        sendJson(res, 401, { error: 'Unauthorized customer quote request' });
      } else {
        sendHtml(res, 401, renderQuotesHtml({ state: 'login' }));
      }
      return;
    }

    const customerId = requestUrl.searchParams.get('logged_in_customer_id') || requestUrl.searchParams.get('customerId');

    if (!customerId) {
      if (wantsJson) {
        sendJson(res, 401, { error: 'Customer login is required' });
      } else {
        sendHtml(res, 200, renderQuotesHtml({ state: 'login' }));
      }
      return;
    }

    const quotes = await fetchAirtableQuotesByShopifyCustomerId(customerId);
    const summaries = quotes.map(({ quote, ...summary }) => summary);

    if (!wantsJson) {
      sendHtml(res, 200, renderQuotesHtml({ customerId, quotes: summaries }));
      return;
    }

    sendJson(res, 200, {
      ok: true,
      customerId,
      quotes: summaries,
    });
  } catch (error) {
    sendHtml(res, 500, renderQuotesHtml({ state: 'error' }));
  }
}
