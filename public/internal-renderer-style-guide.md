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

## Shopify Hero Framing

- Create featured product heroes at a consistent 1:1 aspect ratio, with a 2048 x 2048 px master when possible.
- Center the closet system horizontally and vertically as the unmistakable focal point.
- Let the product occupy about 80-88% of the image height while retaining a clean safety margin around its top, sides, and toe kicks.
- Keep only architectural context that explains the installation. Minimize unrelated walls, floors, windows, furniture, artwork, rugs, plants, and room decor.
- For reach-in products, retain enough casing, header, and open door panels to identify the door type, but crop the room tightly around the opening.
- Keep the complete cabinet visible. Never crop its top, sides, toe kicks, or important top-back read.
- The toe-kick is mandatory visible product geometry: retain the complete 5-inch-high zone below the bottom shelf, a kick board recessed about 2 inches from the front plane, and the continuous shadow line under the bottom shelf. Never replace it with a flush plinth, legs, or an empty/floating base.
- Use the same framing scale and visual center across the featured-image catalog so collection cards remain consistent.

## Automatic Photo Sets

- Every 96-inch product is walk-in only and creates exactly one walk-in hero. Never generate a reach-in or bi-fold-door scene for a 96-inch product.
- Every reach-in product creates exactly two photos: a clean centered product hero and an installed reach-in hero.
- A one-tower reach-in uses exactly one bi-fold door set: two hinged panels folding together to one jamb.
- A reach-in with two or more towers uses exactly two bi-fold door sets, one folding to each side.
- Every walk-in product creates exactly one walk-in hero photo.
- Photo filenames are lowercase SEO slugs based on the Shopify handle and scene, with no spaces or underscores.
- Reach-in examples: `h3d-26-84-14-w-product-hero.png` and `h3d-26-84-14-w-reach-in-installed-1-bifold.png`.
- Walk-in example: `h3d-26-84-14-w-walk-in-hero.png`.

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
