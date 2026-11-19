import { fetchPublishedPlanRecords, parseStoredQuote } from './_airtable.js';
import { decodePlanPayload } from '../src/planUrls.js';
import { renderPlanPreview } from './_plan-preview.js';

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
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function readSavedLayout(record, quote) {
  try {
    return decodePlanPayload(new URL(record.planUrl || quote?.planUrl).searchParams.get('plan'));
  } catch {
    return null;
  }
}

function reviewedImage(images) {
  const attachment = Array.isArray(images) && images.find(({ type }) =>
    ['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(type));
  if (!attachment) return '';
  try {
    const url = new URL(attachment.url);
    if (url.protocol === 'https:' && !url.username && !url.password
      && (url.hostname.endsWith('.airtableusercontent.com') || url.hostname === 'dl.airtable.com')) return url.href;
  } catch { /* An invalid attachment is omitted. */ }
  return '';
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
    const layout = list.format(group.map(({ width, code }) => `a ${width}-inch ${names[code]} tower`));
    const heightText = [72, 84, 96].includes(height) ? ` at ${height} inches high` : '';
    return `${layout}${heightText}${wall ? ` on the ${wallNames[wall]}` : ''}`;
  });
  const description = `${type} closet plan with ${list.format(features)}. The layout spans ${inches.format(length)} inches across ${groups.length} ${groups.length === 1 ? 'run' : 'runs'}.`;
  const price = Number(record.price ?? quote?.estimatedPrice);
  const createdAt = Date.parse(record.createdAt || quote?.submittedAt);
  return {
    id: record.id, type, description, length, towerCount: towers.length,
    price: Number.isFinite(price) && price > 0 ? price : null,
    createdAt: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : null,
    image: reviewedImage(record.images),
    groups,
  };
}

const styles = `
  :root{color-scheme:light;font:16px/1.55 system-ui,sans-serif;color:#242821;background:#faf9f5}
  body{margin:0}main{max-width:72rem;margin:auto;padding:clamp(1rem,4vw,3rem)}
  h1,h2,p{margin:0 0 .75rem}h1{font-size:clamp(2rem,5vw,3rem);line-height:1.15}
  h2{font-size:1.2rem}a{color:#28503b;text-underline-offset:.2em}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:1rem}
  article{background:white;border:1px solid #dedfd7;border-radius:.65rem;overflow:hidden}
  .body{padding:1rem 1.25rem}article>img,article>svg{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:contain;background:#f1efe9}
  .detail{max-width:52rem;margin-top:1rem}dl{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:1rem 0}
  dt,time{color:#4e594f;font-size:.875rem}dd{margin:0;font-weight:650;overflow-wrap:anywhere}nav{margin:1.25rem 0}
`;

function planCard(plan, href) {
  const image = href && !plan.image
    ? renderPlanPreview(plan.groups)
    : `<img src="${escapeHtml(plan.image || plan.previewUrl)}" width="800" height="600"${href ? ' loading="lazy"' : ''} alt="${plan.type} closet 3D rendering for plan ${plan.id}">`;
  return `<article${href ? '' : ' class="detail"'}>${image}<div class="body">
    ${href ? `<h2>${plan.type} closet plan</h2>` : ''}
    ${plan.createdAt ? `<time datetime="${plan.createdAt}">${date.format(new Date(plan.createdAt))}</time>` : ''}
    <dl><div><dt>Plan ID</dt><dd>${plan.id}</dd></div>
    <div><dt>Saved estimate</dt><dd>${plan.price === null ? 'Unavailable' : money.format(plan.price)}</dd></div>
    <div><dt>Towers</dt><dd>${plan.towerCount}</dd></div>
    <div><dt>Total assembled length</dt><dd>${inches.format(plan.length)} in</dd></div></dl>
    <p>${escapeHtml(plan.description)}</p>
    ${href ? `<a href="${escapeHtml(href)}" aria-label="View plan ${plan.id}">View plan</a>` : ''}
  </div></article>`;
}

function renderPage({ title, description, canonical, content, image }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} | Closets Warehouse</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : '<meta name="robots" content="noindex">'}
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
  <style>${styles}</style></head><body><main><h1>${escapeHtml(title)}</h1>${content}</main></body></html>`;
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
    const planId = request.searchParams.get('planid') ?? pathId ?? '';
    const showImage = request.searchParams.get('image') === '1';
    const offset = request.searchParams.get('after') || '';
    const approvalField = env.AIRTABLE_PUBLIC_PLAN_APPROVAL_FIELD;
    const storefront = env.PUBLIC_PLANS_STOREFRONT_URL?.replace(/\/$/, '') || '';
    const base = storefront || '/recent-plans';
    const link = (id) => `${base}/${id}`;
    const send = (status, page) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end(req.method === 'HEAD' ? undefined : renderPage(page));
    };
    const notFound = () => send(404, { title: 'Plan not found', content: `<a href="${escapeHtml(base)}">Recent Plans</a>` });
    if ((showImage && !planId) || (planId && !planIdPattern.test(planId)) || (offset && !/^[A-Za-z0-9/_+=-]{1,300}$/.test(offset))) return notFound();

    try {
      const result = approvalField ? await lookup({
        approvalField, imageField: env.AIRTABLE_PUBLIC_PLAN_IMAGE_FIELD, planId, offset: planId ? '' : offset,
      }) : { records: [] };
      const plans = result.records.map(summarizePublishedPlan).filter(Boolean);
      if (planId) {
        const plan = plans.find(({ id }) => id === planId);
        if (!plan) return notFound();
        if (showImage) {
          const svg = renderPlanPreview(plan.groups);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
          return res.end(req.method === 'HEAD' ? undefined : svg);
        }
        return send(200, {
          title: `${plan.type} closet plan ${plan.id}`, description: plan.description,
          canonical: storefront && link(plan.id), image: plan.image,
          content: `<nav><a href="${escapeHtml(base)}">Recent Plans</a></nav>${planCard({
            ...plan, previewUrl: `${link(plan.id)}?image=1`,
          })}`,
        });
      }
      const description = 'Browse recent reach-in and walk-in closet designs from Closets Warehouse, with layout features, dimensions and saved price estimates.';
      const next = result.offset ? `${base}?after=${encodeURIComponent(result.offset)}` : '';
      return send(200, {
        title: 'Recent Plans', description,
        canonical: storefront && `${base}${offset ? `?after=${encodeURIComponent(offset)}` : ''}`,
        content: `<p>${description}</p>
          ${plans.length ? `<div class="grid">${plans.map((plan) => planCard(plan, link(plan.id))).join('')}</div>` : '<p>No published plans on this page.</p>'}
          ${next ? `<nav><a href="${escapeHtml(next)}">Older plans</a></nav>` : ''}`,
      });
    } catch (error) {
      console.error('Recent Plans lookup failed', error.message);
      return send(503, { title: 'Recent Plans unavailable', content: '<p>Please try again shortly.</p>' });
    }
  };
}

export default createPublicPlansHandler();
