# Shopify Photo Workflow

## 0. Select Real-Photo References

Place owned or approved real installation photos in `assets/photo-library/private/inbox`, then run `npm run photos:audit`. Curate photos using the metadata fields documented in `assets/photo-library/README.md`.

Use real photos only for camera, lighting, materials, installation details, and room realism. They do not override the SKU geometry. A photo is an edit target only when its metadata role is explicitly `edit-target`.

## 1. Load Product

Open `/internal-renderer.html`, then choose the live Airtable product/SKU from the selector.

## 2. Check Render

Use Drawing mode to verify:

- Tower count and order
- Nominal widths
- Shared dividers
- Shelf and rod counts
- Drawer stack placement
- Toe-kick consistency

## 3. Create Photo Draft

Use Photo mode for the realistic catalog-style render. Keep the same camera family and lighting as approved reference images.

For the featured hero, use a consistent square composition targeting 2048 x 2048 px. Center the complete product and let it occupy roughly 80-88% of the frame height. Include only the minimum room or door context needed to explain the installation.

Select the installation type in the internal renderer. Reach-in products create a two-photo plan: clean product hero plus installed reach-in hero. Single towers use one bi-fold door set; systems with two or more towers use two bi-fold door sets. Walk-in products create one walk-in hero.

Use **Economy draft** (1024 square, low quality) for iteration and geometry checks. Use **Final quality** (2048 square, high quality) only after the layout and prompt rules are approved.

Generation uses the exact Three.js render as its geometry source. Always compare the generated draft with that source before approval.

All 96-inch products are automatically treated as walk-in only and create one walk-in hero. Never generate a reach-in or bi-fold-door scene for a 96-inch product.

Use the SEO filenames supplied by the photo-set control. They are lowercase Shopify-handle slugs followed by the scene name.

## 4. Review Against Rules

Reject drafts with:

- Extra or missing shelves
- Inset drawer fronts
- Off-center or wrong drawer handles
- Rods or hangers set too far back
- Cropped top/back cabinet read
- Flush or oversized toe kicks
- Missing, covered, cropped, floating, or undersized toe kicks; the full 5-inch recessed base must remain visible with soft natural shading and no black line or stripe
- Oversized reach-in toe kicks; floor-to-bottom-shelf height must remain exactly 5 inches (5.95% of an 84-inch cabinet) and match the product-only photo
- Duplicate divider panels
- Excess empty wall or floor, unrelated furniture or decor, or a product that appears too small in the frame
- Any visible side or top gap between a reach-in kit and its finished jamb or header; the finished opening must equal the kit's assembled outside dimensions
- Inconsistent featured-image aspect ratio or off-center product placement
- Different cabinet proportions between the product-only and installed images for the same SKU
- S7 images with anything other than 8 horizontal boards/7 storage compartments, or S8 images with anything other than 9 horizontal boards/8 storage compartments

## 5. Save Final

Only after approval, copy the selected draft to `assets/exports` with the Shopify handle filename.
