import { createHmac, timingSafeEqual } from 'node:crypto';
import { fetchAirtableQuotesByContact, fetchAirtableQuotesByShopifyCustomerId, sendJson } from './_airtable.js';
import { fetchShopifyCustomerContact } from './_shopify.js';

const storefrontBaseUrl = 'https://closetswarehouse.com';
const defaultAppBaseUrl = 'https://closetswarehouse-builder.vercel.app';
const enterSavedPlanContactMessage = 'Enter the email and phone used when you saved the plan.';
const accountContactNoMatchMessage = 'We could not find a saved plan for the email on your customer account. Enter the email and phone used when you saved the plan.';

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

function hasLookupContact({ email = '', phone = '' } = {}) {
  return String(email || '').trim() && String(phone || '').replace(/\D/g, '').length >= 7;
}

function hasLookupEmail({ email = '' } = {}) {
  return String(email || '').trim();
}

function getPublicAppBaseUrl(requestUrl = null) {
  const configuredUrl = process.env.PUBLIC_APP_BASE_URL
    || process.env.NEXT_PUBLIC_APP_BASE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || '';
  const rawUrl = String(configuredUrl || '').trim();

  if (rawUrl) {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return withProtocol.replace(/\/+$/, '');
  }

  const requestHost = requestUrl?.headers?.host || '';
  if (requestHost && /vercel\.app$/i.test(requestHost)) {
    return `https://${requestHost}`.replace(/\/+$/, '');
  }

  return defaultAppBaseUrl;
}

function buildQuotePrintUrl({ baseUrl = defaultAppBaseUrl, quote = {}, autoPrint = false } = {}) {
  const quoteId = String(quote.quoteId || '').trim();
  const email = String(quote.customer?.email || '').trim();

  if (!quoteId || !email) {
    return '';
  }

  const printUrl = new URL('/api/quote-print', baseUrl);
  printUrl.searchParams.set('quoteId', quoteId);
  printUrl.searchParams.set('email', email);

  if (autoPrint) {
    printUrl.searchParams.set('print', '1');
  }

  return printUrl.toString();
}

function renderLookupForm({ email = '', phone = '', message = '' } = {}) {
  return `
    <form class="lookup-form" method="get" action="/apps/closet-quotes" target="_self">
      <div>
        <label for="cw-plan-email">Email</label>
        <input id="cw-plan-email" name="email" type="email" autocomplete="email" value="${escapeHtml(email)}" required>
      </div>
      <div>
        <label for="cw-plan-phone">Phone</label>
        <input id="cw-plan-phone" name="phone" type="tel" autocomplete="tel" value="${escapeHtml(phone)}" required>
      </div>
      <button type="submit">See plans</button>
    </form>
    ${message ? `<p class="form-message">${escapeHtml(message)}</p>` : ''}
  `;
}

function renderQuotesHtml({ quotes = [], customerId = '', state = 'ready', message = '', email = '', phone = '', showLookupForm = true, emptyMessage = '', appBaseUrl = defaultAppBaseUrl }) {
  const quoteIds = quotes
    .map((quote) => quote.quoteId)
    .filter(Boolean);
  const resultMessage = quoteIds.length
    ? `Found ${quoteIds.length === 1 ? 'your saved plan' : `${quoteIds.length} saved plans`}. Reference ${quoteIds.map(escapeHtml).join(', ')}. Open or print each saved plan below.`
    : '';
  const cards = quotes.length
    ? quotes.map((quote) => {
      const quoteId = escapeHtml(quote.quoteId || 'Saved plan');
      const planType = escapeHtml(quote.planType || 'Closet plan');
      const date = quote.submittedAt ? new Date(quote.submittedAt).toLocaleDateString('en-US') : '';
      const printUrl = escapeHtml(quote.printUrl || buildQuotePrintUrl({ baseUrl: appBaseUrl, quote }));
      const autoPrintUrl = escapeHtml(quote.printUrlAuto || buildQuotePrintUrl({ baseUrl: appBaseUrl, quote, autoPrint: true }));

      return `
        <article class="plan-card">
          <div>
            <p class="eyebrow">${planType}</p>
            <h3>${quoteId}</h3>
            <p class="muted">Reference ${quoteId}</p>
            ${date ? `<p class="muted">Saved ${escapeHtml(date)}</p>` : ''}
          </div>
          <div class="actions">
            ${printUrl ? `<a class="button" href="${printUrl}" target="_blank" rel="noopener">Open printable plan</a>` : ''}
            ${autoPrintUrl ? `<a class="button print-button" href="${autoPrintUrl}" target="_blank" rel="noopener">Print plan</a>` : ''}
          </div>
        </article>
      `;
    }).join('')
    : `<p class="empty">${escapeHtml(emptyMessage || 'No saved plans matched that email and phone. Check the details you used when saving the plan.')}</p>`;

  const body = state === 'form'
    ? renderLookupForm({ email, phone, message })
    : state === 'error'
      ? `<p class="empty">${escapeHtml(message || 'We could not load your saved plans right now.')}</p>`
      : `${showLookupForm ? renderLookupForm({ email, phone }) : ''}${resultMessage ? `<p class="result-message">${resultMessage}</p>` : ''}<div class="plans">${cards}</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; color: #1c1917; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: transparent; }
      .wrap { padding: 0; }
      .lookup-form { display: grid; gap: 10px; margin: 0 0 16px; padding: 16px; border: 1px solid #e7e5e4; border-radius: 8px; background: #fff; }
      label { display: block; margin: 0 0 6px; color: #292524; font-size: 13px; font-weight: 800; }
      input { width: 100%; min-height: 42px; border: 1px solid #d6d3d1; border-radius: 6px; padding: 9px 10px; color: #1c1917; font: inherit; font-size: 15px; background: #fff; }
      button { min-height: 42px; border: 0; border-radius: 6px; background: #d95d23; color: #fff; font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
      .plans { display: grid; gap: 12px; }
      .plan-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid #e7e5e4; border-radius: 8px; background: #fff; }
      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
      .eyebrow { margin: 0 0 4px; color: #d95d23; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      h3 { margin: 0; font-size: 18px; line-height: 1.2; }
      .muted, .empty, .form-message, .result-message { margin: 6px 0 0; color: #57534e; font-size: 14px; font-weight: 600; }
      .result-message { margin: 0 0 12px; padding: 12px 14px; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; background: #f0fdf4; }
      .button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 10px 14px; border-radius: 6px; background: #1c1917; color: white; font-size: 14px; font-weight: 800; text-decoration: none; white-space: nowrap; }
      .print-button { background: #d95d23; }
      @media (max-width: 520px) { .plan-card, .actions { display: grid; } .button { width: 100%; } }
      @media print {
        .lookup-form { display: none; }
        body { background: #fff; }
        .plan-card, .result-message { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="wrap" data-customer-id="${escapeHtml(customerId)}">
      ${body}
    </main>
  </body>
</html>`;
}

function getShopifyProxySecret() {
  return process.env.SHOPIFY_API_SECRET
    || process.env.SHOPIFY_CLIENT_SECRET
    || process.env.SHOPIFY_APP_SECRET;
}

function constantTimeEqual(left = '', right = '') {
  const expected = Buffer.from(String(left), 'utf8');
  const actual = Buffer.from(String(right), 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getSignaturePayloads(requestUrl) {
  const decodedParams = new URLSearchParams(requestUrl.search);
  decodedParams.delete('signature');
  decodedParams.delete('hmac');
  const groupedDecodedEntries = [...decodedParams.keys()]
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .map((key) => [key, decodedParams.getAll(key).join(',')])
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const decodedEntries = [...decodedParams.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const rawEntries = String(requestUrl.search || '')
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const separatorIndex = pair.indexOf('=');
      return separatorIndex === -1
        ? [pair, '']
        : [pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1)];
    })
    .filter(([key]) => key !== 'signature' && key !== 'hmac')
    .sort(([leftKey], [rightKey]) => decodeURIComponent(leftKey).localeCompare(decodeURIComponent(rightKey)));

  return [
    groupedDecodedEntries.map(([key, value]) => `${key}=${value}`).join(''),
    decodedEntries.map(([key, value]) => `${key}=${value}`).join(''),
    decodedEntries.map(([key, value]) => `${key}=${value}`).join('&'),
    rawEntries.map(([key, value]) => `${key}=${value}`).join(''),
    rawEntries.map(([key, value]) => `${key}=${value}`).join('&'),
  ].filter((payload, index, payloads) => payload && payloads.indexOf(payload) === index);
}

function verifyShopifyAppProxySignature(requestUrl) {
  const secret = getShopifyProxySecret();

  if (!secret) {
    return process.env.NODE_ENV !== 'production'
      ? { ok: true }
      : { ok: false, reason: 'missing_secret' };
  }

  const signature = requestUrl.searchParams.get('signature') || requestUrl.searchParams.get('hmac');

  if (!signature) {
    return { ok: false, reason: 'missing_signature' };
  }

  const ok = getSignaturePayloads(requestUrl).some((message) => {
    const digest = createHmac('sha256', secret).update(message).digest('hex');
    return constantTimeEqual(digest, signature);
  });

  return ok ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}

function getProxyErrorMessage(reason) {
  if (reason === 'missing_secret') {
    return 'Plans lookup is connected, but the deployment is missing the Shopify app secret.';
  }

  if (reason === 'signature_mismatch') {
    return 'Plans lookup reached Shopify, but the Shopify app secret does not match this deployment.';
  }

  return 'This plans lookup must be opened through closetswarehouse.com.';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const wantsJson = requestUrl.searchParams.get('format') === 'json';
    const appBaseUrl = getPublicAppBaseUrl(req);

    const proxyAuth = verifyShopifyAppProxySignature(requestUrl);
    if (!proxyAuth.ok) {
      if (wantsJson) {
        sendJson(res, 401, { error: 'Unauthorized customer quote request', reason: proxyAuth.reason });
      } else {
        sendHtml(res, 401, renderQuotesHtml({ state: 'error', message: getProxyErrorMessage(proxyAuth.reason), appBaseUrl }));
      }
      return;
    }

    const customerId = requestUrl.searchParams.get('logged_in_customer_id') || requestUrl.searchParams.get('customerId');
    const email = requestUrl.searchParams.get('email') || '';
    const phone = requestUrl.searchParams.get('phone') || '';
    const manualContactProvided = hasLookupContact({ email, phone });

    if (!customerId && !manualContactProvided) {
      if (wantsJson) {
        sendJson(res, 400, { error: 'Email and phone are required' });
      } else {
        sendHtml(res, 200, renderQuotesHtml({ state: 'form', email, phone, message: enterSavedPlanContactMessage, appBaseUrl }));
      }
      return;
    }

    let quotes = [];
    let matchedBy = '';
    let lookupMessage = '';

    if (customerId) {
      quotes = await fetchAirtableQuotesByShopifyCustomerId(customerId);
      matchedBy = quotes.length ? 'customer' : '';

      if (!quotes.length && !manualContactProvided) {
        try {
          const accountContact = await fetchShopifyCustomerContact(customerId);

          if (hasLookupEmail(accountContact?.customer)) {
            quotes = await fetchAirtableQuotesByContact(accountContact.customer, { requirePhone: false });
            matchedBy = quotes.length ? 'account_email' : '';
            lookupMessage = quotes.length ? '' : accountContactNoMatchMessage;
          } else {
            lookupMessage = enterSavedPlanContactMessage;
          }
        } catch (error) {
          lookupMessage = enterSavedPlanContactMessage;
        }
      }

      if (!quotes.length && manualContactProvided) {
        quotes = await fetchAirtableQuotesByContact({ email, phone });
        matchedBy = quotes.length ? 'manual_contact' : '';
      }
    } else {
      quotes = await fetchAirtableQuotesByContact({ email, phone });
      matchedBy = quotes.length ? 'manual_contact' : '';
    }

    const summaries = quotes.map(({ quote, ...summary }) => ({
      ...summary,
      printUrl: buildQuotePrintUrl({ baseUrl: appBaseUrl, quote: summary }),
      printUrlAuto: buildQuotePrintUrl({ baseUrl: appBaseUrl, quote: summary, autoPrint: true }),
    }));

    if (!wantsJson) {
      if (customerId && !summaries.length && !manualContactProvided) {
        sendHtml(res, 200, renderQuotesHtml({
          state: 'form',
          customerId,
          message: lookupMessage || enterSavedPlanContactMessage,
          appBaseUrl,
        }));
        return;
      }

      sendHtml(res, 200, renderQuotesHtml({
        customerId,
        quotes: summaries,
        email,
        phone,
        showLookupForm: !summaries.length,
        appBaseUrl,
      }));
      return;
    }

    sendJson(res, 200, {
      ok: true,
      customerId,
      email: matchedBy === 'manual_contact' ? email : undefined,
      matchedBy,
      needsContact: !summaries.length,
      message: !summaries.length ? (lookupMessage || 'No saved plans matched that email and phone. Check the details you used when saving the plan.') : undefined,
      quotes: summaries,
    });
  } catch (error) {
    sendHtml(res, 500, renderQuotesHtml({ state: 'error', appBaseUrl: defaultAppBaseUrl }));
  }
}
