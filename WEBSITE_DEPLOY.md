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
```

## Optional quote capture variables

Add these if public quote/verification submissions should write to Airtable or trigger an email workflow.

```text
AIRTABLE_QUOTES_TABLE
EMAIL_WEBHOOK_URL
```

## Optional Shopify customer save variables

Add these if estimate submissions should create/update Shopify customers, subscribe them for email marketing, and attach the latest closet plan link to the customer record.

The Shopify custom app token needs the `write_customers` Admin API scope.

```text
SHOPIFY_SHOP_DOMAIN
SHOPIFY_ADMIN_ACCESS_TOKEN
SHOPIFY_API_VERSION
```

## Hosted API endpoints

The website host must serve:

```text
/api/kits
/api/parts
/api/kit-parts
/api/quote-requests
```

These are implemented in the `api/` folder for Vercel serverless functions.

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
    src="https://YOUR-DEPLOYED-PLANNER-URL/"
    title="Closets Warehouse Planner"
    style="
      display: block;
      width: 100vw;
      max-width: 100vw;
      height: max(900px, calc(100dvh - 80px));
      border: 0;
    "
    loading="eager"
  ></iframe>
</div>
```

For a full-page experience, link a menu item directly to the hosted planner URL instead of embedding.
