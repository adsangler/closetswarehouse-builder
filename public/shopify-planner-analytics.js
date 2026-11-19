(() => {
  const plannerOrigin = 'https://closetswarehouse-builder.vercel.app';
  const measurementId = 'G-5Z476V32S6';
  const plannerPages = {
    '/pages/reach-in-closet-design-tool': { type: 'reach-in', path: '/', title: 'CW Reach-In Planner' },
    '/pages/walk-in-closet-design-tool': { type: 'walk-in', path: '/walkin.html', title: 'CW Walk-In Planner' },
  };
  const events = new Set(['page_view', 'reach_configration', 'plan_saved', 'verification_requested', 'product_link_clicked']);
  const page = plannerPages[window.location.pathname];
  if (!page) return;

  window.addEventListener('message', ({ origin, source, data }) => {
    if (origin !== plannerOrigin || data?.type !== 'cw-planner-analytics' || !events.has(data.event)) return;
    const iframe = document.querySelector('.cw-designer-fullwidth iframe');
    if (!iframe || source !== iframe.contentWindow) return;

    const gtag = window.gtag || function () {
      (window.dataLayer ||= []).push(arguments);
    };
    gtag('event', data.event, {
      send_to: measurementId,
      planner_type: page.type,
      page_title: page.title,
      page_location: plannerOrigin + page.path,
      page_referrer: window.location.origin + window.location.pathname,
    });
  });
})();
