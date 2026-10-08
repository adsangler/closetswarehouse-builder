const measurementId = 'G-5Z476V32S6';
const productionHosts = new Set(['closetswarehouse-builder.vercel.app']);
let initialized = false;

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
  if (!initialized || !['plan_saved', 'verification_requested', 'product_link_clicked'].includes(name)) return;
  window.gtag('event', name, {
    send_to: measurementId,
    planner_type: plannerType(),
    page_location: analyticsUrl(window.location.href),
    page_referrer: analyticsUrl(document.referrer),
  });
}

export function initAnalytics() {
  if (initialized || !import.meta.env.PROD || !productionHosts.has(window.location.hostname)) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'renderer' || params.get('capture') === '1') return;
  initialized = true;
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
  window.gtag('config', measurementId, {
    send_page_view: false,
    page_location: analyticsUrl(window.location.href),
    page_referrer: analyticsUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  window.gtag('event', 'page_view', {
    send_to: measurementId,
    planner_type: plannerType(),
    page_title: plannerType() === 'walk-in' ? 'CW Walk-In Planner' : 'CW Reach-In Planner',
    page_location: analyticsUrl(window.location.href),
    page_referrer: analyticsUrl(document.referrer),
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    if (['closetswarehouse.com', 'www.closetswarehouse.com'].includes(url.hostname) && url.pathname.startsWith('/products/')) {
      trackPlannerEvent('product_link_clicked');
    }
  });
}
