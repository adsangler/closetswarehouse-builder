const measurementId = 'G-5Z476V32S6';
// Load the connected Google tag; send planner events to the GA4 destination.
const googleTagId = 'GT-TNH4QL3Q';
const productionHosts = new Set(['closetswarehouse-builder.vercel.app']);
const storefrontOrigins = ['https://closetswarehouse.com', 'https://www.closetswarehouse.com'];
const allowedPlannerEvents = new Set(['page_view', 'reach_configration', 'plan_saved', 'verification_requested', 'product_link_clicked']);
const oncePerPageEvents = new Set(['reach_configration']);
const firedEvents = new Set();
let initialized = false;
let embedded = false;
let storefrontOrigin;
const pendingEvents = [];

// Never include contact details, encoded plans, or quote references in URLs.
export function analyticsUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

function plannerType() {
  return window.location.pathname.includes('walkin') ? 'walk-in' : 'reach-in';
}

export function trackPlannerEvent(name) {
  if (!initialized || !allowedPlannerEvents.has(name) || firedEvents.has(name)) return;
  if (oncePerPageEvents.has(name)) firedEvents.add(name);
  if (embedded) {
    if (storefrontOrigin) sendToStorefront(name);
    else pendingEvents.push(name);
    return;
  }
  window.gtag('event', name, {
    send_to: measurementId,
    planner_type: plannerType(),
    ...(name === 'page_view' && {
      page_title: plannerType() === 'walk-in' ? 'CW Walk-In Planner' : 'CW Reach-In Planner',
    }),
    page_location: analyticsUrl(window.location.href),
    page_referrer: analyticsUrl(document.referrer),
  });
}

export function initAnalytics() {
  if (initialized || !import.meta.env.PROD || !productionHosts.has(window.location.hostname)) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'renderer' || params.get('capture') === '1') return;
  initialized = true;
  embedded = window.parent !== window;
  if (embedded) initStorefrontBridge();
  else initGoogleTag();
  trackPlannerEvent('page_view');
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    if (storefrontOrigins.includes(url.origin) && url.pathname.startsWith('/products/')) {
      trackPlannerEvent('product_link_clicked');
    }
  });
}

function initStorefrontBridge() {
  window.addEventListener('message', ({ origin, source, data }) => {
    if (storefrontOrigin || source !== window.parent || !storefrontOrigins.includes(origin) || data?.type !== 'cw-planner-analytics-ready') return;
    storefrontOrigin = origin;
    for (const name of pendingEvents.splice(0)) sendToStorefront(name);
  });
  for (const origin of storefrontOrigins) {
    window.parent.postMessage({ type: 'cw-planner-analytics-ready' }, origin);
  }
}

function sendToStorefront(name) {
  window.parent.postMessage({ type: 'cw-planner-analytics', event: name }, storefrontOrigin);
}

function initGoogleTag() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  // Current store setup has analytics enabled without a banner. A future CMP
  // must set/update consent here, including in the cross-origin planner frame.
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', googleTagId, {
    send_page_view: false,
    page_location: analyticsUrl(window.location.href),
    page_referrer: analyticsUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${googleTagId}`;
  document.head.appendChild(script);
}
