# Planner GA4

Measurement ID: `G-5Z476V32S6`, shared with the Shopify Google & YouTube app.

The planner loads GA only in production builds on `closetswarehouse-builder.vercel.app`.
Local development, deployment preview hosts, renderer and capture modes are excluded.
Add any future custom production hostname to `src/analytics.js` deliberately.

Events: `page_view`, `plan_saved` (successful estimate/plan save),
`verification_requested` (successful request), and `product_link_clicked`.
Each includes `planner_type`. Purchase and checkout events remain Shopify's responsibility.
Manual events strip all query strings and fragments from page and referrer URLs;
they never include contact details, quote identifiers, or encoded plans.

Analytics storage is granted under the owner's current no-banner setup. Advertising
storage, advertising user data, personalization, and Google signals are disabled.
This does not integrate a consent manager. If one is introduced, connect its initial
state and subsequent changes before enabling the tag, including inside embedded frames.

## GA4 account configuration and live validation

1. In Admin > Data streams > the existing web stream > Configure tag settings >
   Configure your domains, include `closetswarehouse.com` and
   `closetswarehouse-builder.vercel.app` for full-page navigation.
2. Review Enhanced Measurement on this shared stream. Disable automatic form
   interactions, outbound clicks, site search, and history-based page views if they
   could transmit customer-containing URLs or duplicate these manual events.
   The module's sanitization applies to its own events; it cannot sanitize
   independently collected automatic events. Coordinate changes with Shopify tracking.
3. Register `planner_type` as an event-scoped custom dimension if needed for reports.
4. After deployment, verify with Tag Assistant and GA4 Realtime: one planner page
   view per load, a successful save/request event, and a product click. Confirm
   contact values and plan payloads are absent from network collection requests.
5. Verify a store > standalone planner > store journey retains client/session
   identity and `_gl` survives navigation/redirects. Do not assume it works solely
   because the measurement IDs match.

Shopify embeds are cross-origin iframes. Domain configuration alone does not stitch
their identity to the parent page. A Shopify-side consent/identity or event bridge
is a separate integration; it is not included here. Until verified, embedded planner
traffic may be reported as separate users/sessions, with a parent and frame page view.

Run `node --test scripts/test-analytics.mjs` and `npm.cmd run build` locally.
