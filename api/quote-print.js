import { fetchAirtableQuoteByReference, sendJson } from './_airtable.js';

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

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return '';
  }

  return number.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '';
  }

  return number.toFixed(digits).replace(/\.?0+$/, '');
}

function formatInches(value) {
  const number = formatNumber(value);
  return number ? `${number}"` : '';
}

function getCustomerName(record = {}, quote = {}) {
  const customer = quote.customer || record.customer || {};
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    || customer.name
    || record.customer?.name
    || '';
}

function getPlanModules(quote = {}) {
  return Array.isArray(quote.modules) ? quote.modules : [];
}

function getReachInDetails(quote = {}) {
  const details = quote.planDetails || {};
  return [
    ['Wall width', formatInches(details.wallWidth || quote.wallWidth)],
    ['Height', formatInches(details.height || quote.height)],
    ['Assembled width', formatInches(details.assembledWidth || quote.assembledWidth)],
    ['Required width', formatInches(details.requiredWidth || quote.requiredWidth)],
  ].filter(([, value]) => value);
}

function renderDefinitionList(items = []) {
  if (!items.length) {
    return '';
  }

  return `
    <dl class="details">
      ${items.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderModulesTable(modules = []) {
  if (!modules.length) {
    return '<p class="muted">No module details were saved with this plan.</p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Position</th>
          <th>Wall</th>
          <th>Configuration</th>
          <th>Width</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${modules.map((module, index) => `
          <tr>
            <td>${escapeHtml(module.index || index + 1)}</td>
            <td>${escapeHtml(module.wall || '')}</td>
            <td>${escapeHtml(module.code || module.sku || '')}</td>
            <td>${escapeHtml(formatInches(module.width) || module.width || '')}</td>
            <td>${escapeHtml(module.label || module.name || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderWalkInDetails(quote = {}) {
  const room = quote.room || {};
  const roomItems = [
    ['Room width', formatInches(room.width)],
    ['Room depth', formatInches(room.depth)],
    ['Height', formatInches(room.height || quote.height)],
  ].filter(([, value]) => value);

  const runEntries = Object.entries(quote.runs || {})
    .filter(([, run]) => Array.isArray(run?.modules) && run.modules.length);

  return `
    ${renderDefinitionList(roomItems)}
    ${runEntries.length ? `
      <section class="subsection">
        <h2>Wall Runs</h2>
        ${runEntries.map(([wall, run]) => `
          <div class="run">
            <h3>${escapeHtml(wall)}</h3>
            ${renderModulesTable(run.modules.map((module, index) => ({ ...module, wall, index: module.index || index + 1 })))}
          </div>
        `).join('')}
      </section>
    ` : ''}
  `;
}

function renderPrintablePlan({ record, autoPrint = false }) {
  const quote = record.quote || {};
  const quoteId = record.quoteId || quote.quoteId || '';
  const planType = record.planType || quote.planType || quote.internalType || 'Closet plan';
  const submittedAt = record.submittedAt || quote.submittedAt || '';
  const customer = quote.customer || record.customer || {};
  const email = customer.email || record.customer?.email || '';
  const phone = customer.phone || record.customer?.phone || '';
  const price = formatMoney(record.estimatedPrice || quote.estimatedPrice);
  const modules = getPlanModules(quote);
  const isWalkIn = String(quote.internalType || record.planType || '').toLowerCase().includes('walk');
  const editablePlanUrl = record.planUrl || quote.planUrl || '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(quoteId || 'Saved Plan')} - Closets Warehouse</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; color: #1c1917; font-family: Arial, Helvetica, sans-serif; background: #f5f5f4; }
      .page { width: min(8.5in, calc(100vw - 24px)); margin: 24px auto; padding: 0.5in; background: #fff; box-shadow: 0 12px 30px rgb(28 25 23 / 12%); }
      .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; border-bottom: 2px solid #1c1917; padding-bottom: 18px; }
      .brand { margin: 0 0 6px; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #d95d23; }
      h1 { margin: 0; font-size: 28px; line-height: 1.1; }
      h2 { margin: 28px 0 12px; font-size: 18px; line-height: 1.2; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; }
      h3 { margin: 14px 0 8px; font-size: 15px; }
      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
      .button { display: inline-flex; min-height: 38px; align-items: center; justify-content: center; padding: 9px 12px; border: 0; border-radius: 6px; background: #d95d23; color: #fff; font: inherit; font-size: 13px; font-weight: 800; text-decoration: none; cursor: pointer; white-space: nowrap; }
      .button.secondary { background: #1c1917; }
      .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 18px 0 0; }
      .summary-item, .details div { border: 1px solid #e7e5e4; border-radius: 6px; padding: 10px; }
      .label, dt { display: block; margin: 0 0 4px; color: #78716c; font-size: 11px; font-weight: 800; text-transform: uppercase; }
      .value, dd { margin: 0; color: #1c1917; font-size: 14px; font-weight: 700; }
      .details { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
      th, td { border: 1px solid #e7e5e4; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f5f5f4; color: #44403c; font-size: 11px; text-transform: uppercase; }
      .muted { color: #57534e; font-size: 13px; font-weight: 600; }
      .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e7e5e4; color: #78716c; font-size: 12px; }
      .subsection, .run { break-inside: avoid; }
      @media (max-width: 680px) {
        .page { width: 100%; margin: 0; padding: 20px; box-shadow: none; }
        .topbar, .summary, .details { display: grid; grid-template-columns: 1fr; }
        .actions { justify-content: stretch; }
        .button { width: 100%; }
      }
      @media print {
        @page { margin: 0.45in; }
        body { background: #fff; }
        .page { width: auto; margin: 0; padding: 0; box-shadow: none; }
        .screen-only { display: none !important; }
        h2, .summary-item, .details div, tr { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="topbar">
        <div>
          <p class="brand">Closets Warehouse</p>
          <h1>Saved Plan Reference</h1>
          <p class="muted">Plan ID: ${escapeHtml(quoteId || 'Not available')}</p>
        </div>
        <div class="actions screen-only">
          <button class="button" type="button" onclick="window.print()">Print / Save PDF</button>
          ${editablePlanUrl ? `<a class="button secondary" href="${escapeHtml(editablePlanUrl)}">Open editable planner</a>` : ''}
        </div>
      </header>

      <section class="summary">
        <div class="summary-item"><span class="label">Plan type</span><span class="value">${escapeHtml(planType)}</span></div>
        <div class="summary-item"><span class="label">Saved</span><span class="value">${escapeHtml(formatDate(submittedAt) || 'Not available')}</span></div>
        <div class="summary-item"><span class="label">Customer</span><span class="value">${escapeHtml(getCustomerName(record, quote) || 'Not available')}</span></div>
        <div class="summary-item"><span class="label">Estimated price</span><span class="value">${escapeHtml(price || 'Not available')}</span></div>
        <div class="summary-item"><span class="label">Email</span><span class="value">${escapeHtml(email || 'Not available')}</span></div>
        <div class="summary-item"><span class="label">Phone</span><span class="value">${escapeHtml(phone || 'Not available')}</span></div>
      </section>

      <section>
        <h2>Plan Details</h2>
        ${isWalkIn ? renderWalkInDetails(quote) : renderDefinitionList(getReachInDetails(quote))}
      </section>

      ${!isWalkIn ? `
        <section>
          <h2>Modules</h2>
          ${renderModulesTable(modules)}
        </section>
      ` : ''}

      <p class="footer">Use this saved plan reference for warehouse pickup quoting and support. Prices and availability are subject to confirmation by Closets Warehouse.</p>
    </main>
    ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>' : ''}
  </body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const quoteId = requestUrl.searchParams.get('quoteId') || '';
    const email = requestUrl.searchParams.get('email') || '';

    if (!quoteId || !email) {
      sendHtml(res, 400, renderPrintablePlan({
        record: {
          quoteId: quoteId || 'Missing plan ID',
          customer: { email },
          quote: { planType: 'Saved plan lookup' },
        },
      }));
      return;
    }

    const record = await fetchAirtableQuoteByReference({ quoteId, email });

    if (!record) {
      sendHtml(res, 404, renderPrintablePlan({
        record: {
          quoteId,
          customer: { email },
          quote: { planType: 'Saved plan not found' },
        },
      }));
      return;
    }

    sendHtml(res, 200, renderPrintablePlan({
      record,
      autoPrint: requestUrl.searchParams.get('print') === '1',
    }));
  } catch (error) {
    sendHtml(res, 500, renderPrintablePlan({
      record: {
        quoteId: 'Unable to load plan',
        quote: { planType: 'Saved plan reference' },
      },
    }));
  }
}
