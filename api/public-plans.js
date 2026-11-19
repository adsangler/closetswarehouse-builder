import { fetchPublishedPlanRecords, parseStoredQuote } from './_airtable.js';
import { decodePlanPayload, encodePlanPayload } from '../src/planUrls.js';

const plannerOrigin = 'https://closetswarehouse-builder.vercel.app';

const planIdPattern = /^(?:CWQ-[A-Z0-9-]{6,40}|\d{8}-\d{3}|\d{6,20})$/;
const walls = ['back', 'left', 'right', 'leftReturn', 'rightReturn'];
const wallNames = { back: 'back wall', left: 'left wall', right: 'right wall', leftReturn: 'left return', rightReturn: 'right return' };
const legacyCodes = { S9: 'S8', '3DS': 'S3D', '3DH': 'H3D', '2DS': 'S2D' };
const names = {
  FR: 'frame-only', LH: 'long-hang', DH: 'double-hang', HS: 'hanging and shelving',
  S3D: 'shelving with three drawers', H3D: 'hanging with three drawers',
  S2D: 'shelving with two drawers', S7: 'seven-level shelving', S8: 'eight-level shelving',
  PN: 'pantry shelving', PN2D: 'pantry shelving with two drawers',
};
const list = new Intl.ListFormat('en-US');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const inches = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'America/New_York' });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"'{}]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;',
}[char]));

function readSavedLayout(record, quote) {
  try {
    return decodePlanPayload(new URL(record.planUrl || quote?.planUrl).searchParams.get('plan'));
  } catch {
    return null;
  }
}

function dimensions(source, defaults) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const value = source?.[key] == null || source[key] === '' ? NaN : Number(source[key]);
    return [key, Number.isFinite(value) && value >= 0 && value <= 10000 ? value : fallback];
  }));
}

function publicLayout(layout, quote, groups, walkIn, length) {
  const publicTowers = (group) => group.towers.map(({ code, width }, index) => ({
    code: walkIn && (code === 'S7' || code === 'S8') ? 'SHELF' : code,
    width, id: `bay-${group.wall || 'reach-in'}-${index + 1}`, label: names[code],
  }));
  if (walkIn) {
    const source = layout?.room || quote?.room;
    const room = dimensions(source, {
      backWidth: 96, leftDepth: 72, rightDepth: 72, openingWidth: 70, openingLeft: 13, openingRight: 13,
      ceilingHeight: 108, backHeight: 96, leftHeight: 96, rightHeight: 96,
    });
    const savedCorners = layout?.corners || quote?.corners;
    const corners = {
      backLeft: savedCorners?.backLeft === 'left' ? 'left' : 'back',
      backRight: savedCorners?.backRight === 'right' ? 'right' : 'back',
      entranceLeft: savedCorners?.entranceLeft === 'leftReturn' ? 'leftReturn' : 'left',
      entranceRight: savedCorners?.entranceRight === 'rightReturn' ? 'rightReturn' : 'right',
    };
    const runs = Object.fromEntries(walls.map((wall) => {
      const group = groups.find((item) => item.wall === wall);
      return [wall, group ? publicTowers(group) : []];
    }));
    return { room, corners, runs };
  }
  const source = layout?.planDetails || quote;
  const wallWidth = dimensions(source, { wallWidth: Math.max(96, length + 2) }).wallWidth;
  const openingWidth = dimensions(source, { openingWidth: Math.min(70, wallWidth) }).openingWidth;
  const defaultReturn = Math.max(0, (wallWidth - openingWidth) / 2);
  const planDetails = {
    wallWidth, openingWidth, height: groups[0].height,
    ...dimensions(source, {
      openingLeft: defaultReturn, openingRight: defaultReturn, ceilingHeight: 108,
      roomDepth: 24, roomDepthInput: Number(source?.roomDepth) || 24,
    }),
    doorType: ['sliding', 'bifold'].includes(source?.doorType) ? source.doorType : 'regular',
  };
  return { planDetails, modules: publicTowers(groups[0]) };
}

function savedExtraParts(layout, quote) {
  const source = layout?.extraParts ?? quote?.extraParts;
  if (!Array.isArray(source)) return [];
  return source.slice(0, 40).flatMap((part) => {
    const { type, sku } = part || {};
    const width = Number(part?.width);
    const quantity = Number(part?.quantity);
    const price = Number(part?.price);
    if (!['shelf', 'rod', 'shelfPins', 'rafix', 'smallDrawer', 'largeDrawer'].includes(type)
      || !/^[A-Z0-9-]{3,32}$/.test(sku || '') || ![0, 18, 24, 30].includes(width)
      || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) return [];
    return [{ type, sku, width, quantity, price, name: sku, productUrl: `https://closetswarehouse.com/products/${sku.toLowerCase()}` }];
  });
}

export function summarizePublishedPlan(record) {
  if (!planIdPattern.test(record.id || '')) return null;
  let quote;
  try { quote = parseStoredQuote(record.storedQuote); } catch { /* The plan URL can still hold the layout. */ }
  const layout = readSavedLayout(record, quote);
  const modules = Array.isArray(quote?.modules) ? quote.modules : [];
  const runs = layout?.runs || quote?.runs;
  const walkIn = /walk[ -]?in/i.test(record.type || quote?.planType || '') || Boolean(runs);
  const groups = (walkIn
    ? walls.map((wall) => ({
      wall,
      modules: runs?.[wall] ?? modules.filter((module) => module?.wall === wall),
      height: Number((layout?.room || quote?.room)?.[`${wall.replace(/Return$/, '')}Height`] ?? quote?.room?.height),
    }))
    : [{ modules: layout?.modules ?? modules, height: Number(layout?.planDetails?.height ?? quote?.height) }])
    .filter((group) => Array.isArray(group.modules) && group.modules.length)
    .map(({ wall, modules: group, height }) => ({
      wall, height,
      towers: group.map((module) => ({
        code: module?.code === 'SHELF' ? (height === 96 || (!height && walkIn) ? 'S8' : 'S7') : legacyCodes[module?.code] || module?.code,
        width: Number(module?.width),
      })),
    }));
  const towers = groups.flatMap((group) => group.towers);
  if (!towers.length || towers.some(({ code, width }) => !Object.hasOwn(names, code) || ![18, 24, 30].includes(width))) return null;

  for (const group of groups) {
    if (group.towers.every(({ code }) => code === 'PN' || code === 'PN2D')) group.height = 72;
    else if (![84, 96].includes(group.height)) group.height = group.towers.some(({ code }) => code === 'S7') ? 84 : 96;
  }
  const length = towers.reduce((sum, tower) => sum + tower.width, 0) + (towers.length + groups.length) * 0.75;
  const type = walkIn ? 'Walk-in' : 'Reach-in';
  const features = groups.map(({ wall, height, towers: group }) => {
    const layout = list.format(group.map(({ width, code }) => `${width === 18 ? 'an' : 'a'} ${width}-inch ${names[code]} tower`));
    const heightText = [72, 84, 96].includes(height) ? ` at ${height} inches high` : '';
    return `${layout}${heightText}${wall ? ` on the ${wallNames[wall]}` : ''}`;
  });
  const description = `${type} closet plan with ${list.format(features)}. The layout spans ${inches.format(length)} inches across ${groups.length} ${groups.length === 1 ? 'run' : 'runs'}.`;
  const price = Number(record.price ?? quote?.estimatedPrice);
  const createdAt = Date.parse(record.createdAt || quote?.submittedAt);
  if (!Number.isFinite(createdAt) || createdAt < Date.parse('2026-08-01T00:00:00Z')) return null;
  const publicPlan = publicLayout(layout, quote, groups, walkIn, length);
  const payload = encodePlanPayload(publicPlan);
  const plannerPayload = encodePlanPayload({ ...publicPlan, extraParts: savedExtraParts(layout, quote) });
  const planner = `${plannerOrigin}${walkIn ? '/walkin.html' : '/'}`;
  return {
    id: record.id, type, description, length, towerCount: towers.length,
    price: Number.isFinite(price) && price > 0 ? price : null,
    createdAt: new Date(createdAt).toISOString(),
    drawingUrl: `${planner}?publicDrawing=1#${payload}`,
    plannerUrl: `${planner}?estimate=1&plan=${plannerPayload}`,
  };
}

const styles = `
  .recent-plans{max-width:75rem;margin:auto;padding:clamp(1rem,4vw,3rem)}
  .recent-plans h1,.recent-plans h2,.recent-plans p{margin:0 0 .75rem}
  .recent-plans h1{font-size:clamp(2rem,5vw,3rem);line-height:1.25}
  .recent-plans h2{font-size:1.25rem;line-height:1.4}
  .recent-plans h2 a{line-height:inherit}
  .recent-plans a{text-underline-offset:.2em;text-decoration:underline}
  .recent-plans .plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:1rem}
  .recent-plans article{background:white;border:1px solid #dedfd7;border-radius:.65rem;overflow:hidden}
  .recent-plans .plan-body{padding:1rem 1.25rem}
  .recent-plans iframe{display:block;width:100%;border:0;background:#faf9f5}
  .recent-plans .plan-drawing-frame{height:auto;aspect-ratio:16/10}
  .recent-plans .plan-view-frame{height:85vh;min-height:38rem}
  .recent-plans .plan-detail{max-width:52rem;margin-top:1rem}
  .recent-plans dl{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:1rem 0}
  .recent-plans dt,.recent-plans time{font-size:.875rem}
  .recent-plans dd{margin:0;font-weight:650;overflow-wrap:anywhere}
  .recent-plans nav{margin:1.25rem 0}
  .recent-plans .plan-pagination{display:flex;flex-wrap:wrap;gap:1.25rem}
`;

function planTitle({ type, length, towerCount, price }) {
  return `${type} closet · ${inches.format(length)} in wide · ${towerCount} ${towerCount === 1 ? 'tower' : 'towers'} · ${price === null ? 'Price unavailable' : money.format(price)}`;
}

function planCard(plan, href, detail = false) {
  const drawing = `<iframe class="plan-drawing-frame" src="${escapeHtml(plan.drawingUrl)}" title="Plan drawing for ${plan.id}"${detail ? '' : ' loading="lazy"'}></iframe>`;
  return `<article${detail ? ' class="plan-detail"' : ''}>${drawing}<div class="plan-body">
    ${detail ? '' : `<h2><a href="${escapeHtml(href)}">${escapeHtml(planTitle(plan))}</a></h2>`}
    ${plan.createdAt ? `<time datetime="${plan.createdAt}">${date.format(new Date(plan.createdAt))}</time>` : ''}
    <dl><div><dt>Plan ID</dt><dd>${plan.id}</dd></div>
    <div><dt>Saved estimate</dt><dd>${plan.price === null ? 'Unavailable' : money.format(plan.price)}</dd></div>
    <div><dt>Towers</dt><dd>${plan.towerCount}</dd></div>
    <div><dt>Total assembled length</dt><dd>${inches.format(plan.length)} in</dd></div></dl>
    <p>${escapeHtml(plan.description)}</p>
    <a href="${escapeHtml(href)}?view=1" aria-label="View plan ${plan.id}">View plan</a>
  </div></article>`;
}

function renderPage({ title, description, canonical, content }, shopify) {
  const pageTitle = `${title} | Closets Warehouse`;
  const body = `<section class="recent-plans" data-plan-title="${escapeHtml(pageTitle)}" data-plan-description="${escapeHtml(description)}"><h1>${escapeHtml(title)}</h1>${content}</section>`;
  if (shopify) {
    const pageData = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebPage', name: pageTitle,
      ...(description ? { description } : {}), ...(canonical ? { url: canonical } : {}),
    }).replaceAll('<', '\\u003c').replaceAll('{{', '\\u007b{').replaceAll('{%', '\\u007b%');
    return `<style>${styles}</style>${body}
<script type="application/ld+json">${pageData}</script>
<script>
(() => {
  const page = document.querySelector('.recent-plans');
  if (!page) return;
  document.title = page.dataset.planTitle;
  if (!page.dataset.planDescription) return;
  const description = document.head.querySelector('meta[name="description"]') || document.createElement('meta');
  description.setAttribute('name', 'description');
  description.setAttribute('content', page.dataset.planDescription);
  if (!description.isConnected) document.head.append(description);
})();
</script>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : '<meta name="robots" content="noindex">'}
  <style>${styles}</style></head><body><main>${body}</main></body></html>`;
}

export function createPublicPlansHandler(env = process.env, lookup = fetchPublishedPlanRecords) {
  return async function publicPlans(req, res) {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      res.statusCode = 405;
      return res.end();
    }

    const request = new URL(req.url, 'http://localhost');
    const pathId = request.pathname.match(/\/recent-plans\/([^/]+)\/?$/)?.[1];
    const planId = (request.searchParams.get('planid') ?? pathId ?? '').toUpperCase();
    const showPlan = request.searchParams.get('view') === '1';
    const shopify = /^\/apps\/[a-z0-9-]+$/.test(request.searchParams.get('path_prefix') || '')
      && /^[a-f0-9]{64}$/i.test(request.searchParams.get('signature') || '');
    const offset = request.searchParams.get('after') || '';
    const approvalField = env.AIRTABLE_PUBLIC_PLAN_APPROVAL_FIELD;
    const storefront = env.PUBLIC_PLANS_STOREFRONT_URL?.replace(/\/$/, '') || '';
    const base = storefront || '/recent-plans';
    const link = (id) => `${base}/${id.toLowerCase()}`;
    const send = (status, page) => {
      res.statusCode = status;
      res.setHeader('Content-Type', shopify ? 'application/liquid' : 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end(req.method === 'HEAD' ? undefined : renderPage(page, shopify));
    };
    const notFound = () => send(404, { title: 'Plan not found', content: `<a href="${escapeHtml(base)}">Recent Plans</a>` });
    if ((showPlan && !planId) || (planId && !planIdPattern.test(planId)) || (offset && !/^[A-Za-z0-9/_+=-]{1,300}$/.test(offset))) return notFound();

    try {
      const result = approvalField ? await lookup({
        approvalField, planId, offset: planId ? '' : offset,
      }) : { records: [] };
      const plans = result.records.map(summarizePublishedPlan).filter(Boolean);
      if (planId) {
        const plan = plans.find(({ id }) => id === planId);
        if (!plan) return notFound();
        return send(200, {
          title: planTitle(plan), description: plan.description,
          canonical: storefront && link(plan.id),
          content: `<nav><a href="${escapeHtml(base)}">Recent Plans</a></nav>${showPlan
            ? `<iframe class="plan-view-frame" src="${escapeHtml(plan.plannerUrl)}" title="Interactive closet plan ${plan.id}"></iframe>`
            : planCard(plan, link(plan.id), true)}`,
        });
      }
      const description = 'Browse recent reach-in and walk-in closet designs from Closets Warehouse, with layout features, dimensions and saved price estimates.';
      const next = result.offset ? `${base}?after=${encodeURIComponent(result.offset)}` : '';
      const pagination = [
        offset ? `<a href="${escapeHtml(base)}">Newest plans</a>` : '',
        next ? `<a href="${escapeHtml(next)}" rel="next">Older plans</a>` : '',
      ].filter(Boolean).join(' ');
      return send(200, {
        title: 'Recent Plans', description,
        canonical: storefront && `${base}${offset ? `?after=${encodeURIComponent(offset)}` : ''}`,
        content: `<p>${description}</p>
          ${plans.length ? `<div class="plan-grid">${plans.map((plan) => planCard(plan, link(plan.id))).join('')}</div>` : '<p>No published plans on this page.</p>'}
          ${pagination ? `<nav class="plan-pagination" aria-label="Recent Plans pagination">${pagination}</nav>` : ''}`,
      });
    } catch (error) {
      console.error('Recent Plans lookup failed', error.message);
      return send(503, { title: 'Recent Plans unavailable', content: '<p>Please try again shortly.</p>' });
    }
  };
}

export default createPublicPlansHandler();
