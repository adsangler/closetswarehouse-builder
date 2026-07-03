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
<iframe
  src="https://YOUR-DEPLOYED-PLANNER-URL/"
  style="width:100%;min-height:900px;border:0;"
  loading="lazy"
></iframe>
```

For a full-page experience, link a menu item directly to the hosted planner URL instead of embedding.
