# Website Deployment

This app can live on the public website by hosting the React app plus the server-side `/api/*` endpoints.

## Recommended setup

1. Deploy this repository to Vercel.
2. Add the environment variables below in the Vercel project settings.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Use the deployed URL as the planner page or embed it in Shopify with an iframe.

## Required environment variables

Copy the values from the local `.env` into the website host. Do not put these values in browser code.

```text
AIRTABLE_TOKEN
AIRTABLE_BASE_ID
AIRTABLE_KITS_TABLE
AIRTABLE_PARTS_TABLE
AIRTABLE_KIT_PARTS_TABLE
AIRTABLE_COMPONENTS_TABLE
AIRTABLE_PART_COMPONENTS_TABLE
```

## Optional quote capture variables

Add these if public quote/verification submissions should write to Airtable or trigger an email workflow.

```text
AIRTABLE_QUOTES_TABLE
EMAIL_WEBHOOK_URL
```

Recommended Airtable quote fields:

```text
Quote ID
Plan URL
Plan Type
Submitted At
Shopify Customer ID
Shopify Customer Email
```

If your Airtable field names differ, set these optional environment variables:

```text
AIRTABLE_QUOTES_ID_FIELD
AIRTABLE_QUOTES_PLAN_URL_FIELD
AIRTABLE_QUOTES_PLAN_TYPE_FIELD
AIRTABLE_QUOTES_SUBMITTED_AT_FIELD
AIRTABLE_QUOTES_SHOPIFY_CUSTOMER_ID_FIELD
AIRTABLE_QUOTES_SHOPIFY_CUSTOMER_EMAIL_FIELD
```

## Optional Shopify customer save variables

Add these if estimate submissions should create/update Shopify customers, subscribe them for email marketing, and attach the latest closet plan link to the customer record.

The Shopify custom app token needs the `read_customers` and `write_customers` Admin API scopes.

```text
SHOPIFY_SHOP_DOMAIN
SHOPIFY_ADMIN_ACCESS_TOKEN
SHOPIFY_API_SECRET
SHOPIFY_API_VERSION
```

## Hosted API endpoints

The website host must serve:

```text
/api/kits
/api/parts
/api/kit-parts
/api/components
/api/part-components
/api/parts-resolved
/api/quote-requests
/api/customer-quotes
```

These are implemented in the `api/` folder for Vercel serverless functions.

`POST /api/quote-requests` saves a plan and returns a `CWQ-...` reference. `GET /api/quote-requests?quoteId=CWQ-...&email=customer@example.com` retrieves a saved plan when the quote table includes the configured quote ID field.

`GET /api/customer-quotes` returns the saved quote list for a logged-in Shopify customer. It is intended to be called through a Shopify App Proxy, which passes `logged_in_customer_id` and a signed `signature` parameter. Production requests require `SHOPIFY_API_SECRET` so the API can verify the Shopify signature before returning any customer quote data.

## Shopify website embed

After deployment, create a Shopify page and embed the hosted planner URL:

```html
<div
  style="
    position: relative;
    left: 50%;
    right: 50%;
    width: 100vw;
    max-width: 100vw;
    margin-left: -50vw;
    margin-right: -50vw;
  "
>
  <iframe
    id="closetswarehouse-planner-frame"
    src="https://YOUR-DEPLOYED-PLANNER-URL/"
    title="Closets Warehouse Planner"
    scrolling="no"
    style="
      display: block;
      width: 100vw;
      max-width: 100vw;
      min-height: 900px;
      height: 900px;
      border: 0;
      overflow: hidden;
    "
    loading="eager"
  ></iframe>
</div>
<script>
  (() => {
    const frame = document.getElementById('closetswarehouse-planner-frame');
    const allowedOrigins = new Set([
      'https://closetswarehouse-builder.vercel.app',
      'https://YOUR-DEPLOYED-PLANNER-URL',
    ]);

    window.addEventListener('message', (event) => {
      if (!frame || !allowedOrigins.has(event.origin)) return;

      if (event.data?.type === 'closetswarehouse:frame-height') {
        const height = Number(event.data.height);
        if (!Number.isFinite(height) || height < 300) return;

        frame.style.height = `${height}px`;
      }

      if (event.data?.type === 'closetswarehouse:frame-wheel') {
        const deltaY = Number(event.data.deltaY);
        if (!Number.isFinite(deltaY)) return;

        window.scrollBy({ top: deltaY, left: 0, behavior: 'auto' });
      }
    });
  })();
</script>
```

For a full-page experience, link a menu item directly to the hosted planner URL instead of embedding.
