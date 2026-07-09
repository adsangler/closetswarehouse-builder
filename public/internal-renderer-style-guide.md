# Closets Warehouse Internal Renderer Style Guide

Use this internal renderer only for product image creation, render checks, and Shopify photo drafts. The customer-facing planner should stay focused on plan view, 3D view, estimate review, and consultation requests.

## Geometry Source Of Truth

- Load actual products from Airtable through the internal product selector.
- Use the parametric render as the geometry source of truth before any realistic image pass.
- Preserve the SKU width, tower order, shelf count, rod placement, drawer placement, toe-kick, and shared divider logic from the render.
- Do not use generated photos to decide geometry.

## Photo Style

- Match the reference render family in `/references`.
- Use warm wall and floor materials, clean white melamine, soft daylight, realistic shadows, and subtle satin sheen.
- Keep the cabinet fully readable, including the top and back edge.
- Avoid text overlays, watermarks, props, posters, infographics, or decorative scenes.

## Non-Negotiable Product Details

- Panel thickness is 0.75".
- Toe kicks are always 5" high and recessed consistently.
- Drawer fronts are proud overlay slabs with centered brushed-nickel bar pulls.
- Hangers and rods sit on the front drill-line plane.
- Shared tower joints use one divider panel only.
- Shelf-only towers must keep exact usable shelf counts and even spacing.

## Export Workflow

- Use the internal renderer to select the product and export a deterministic render.
- Save drafts under `assets/drafts`.
- Move only user-approved final images to `assets/exports`.
- Final filenames should match Shopify product handles.
