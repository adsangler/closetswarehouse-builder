# Closets Warehouse - Rendering App

## Business context
Closets Warehouse is a bootstrapped, warehouse-direct modular closet company in Deerfield Beach, FL.
The business sells professional-grade white melamine closet towers and connected systems at warehouse-direct prices.
Fulfillment is pickup-only: no shipping. Shopify is customer-facing for product pages, pricing, checkout, and pickup scheduling.
Airtable is the internal source of truth for inventory, kits, parts, BOMs, costs, and product metadata.

The product strategy is to sell many kit combinations while stocking a small set of repeatable parts. Connected systems are assembled from shared tower components at order time.

## Reference renders
Reference renders are in `/references` and are visual ground truth for tower appearance:
  LH.png, DH.png, HS.png, S3D.png, H3D.png, S2D.png, S93.png

Match their camera angle, lighting, material appearance, and level of detail as closely as possible.
Extract the camera angle from the renders; do not guess.
Do not use the off-angle/cropped generated family introduced around `DH-S7-51-84-14-W-shopify-photo-v2-fewer-shelves.png` and reused for `DH-S7-30-57-84-14-W-shopify-photo-v1.png` as a source for new Shopify photos. That family switches camera angle, tightens the top crop, and cuts/loses the top-back read of the cabinet compared with the approved single/double tower photos.

`S93.png` is a legacy shelf-tower render reference. Airtable naming has moved to `S7` and `S8`; use the live Airtable SKU/config names for new work.

## Repository references
- `/dbstructure` contains the original database export for parts, kits, and tower relationships.
- `Closets_Warehouse_Rendering_App_Spec.docx` contains the rendering app product and technical spec.
- `Closets_Warehouse___Full_Business___Development_Specification (1).md` contains the full business, product, BOM, Airtable, and Shopify specification.
- Live Airtable access is configured through local `.env` and proxied by Vite; do not expose tokens in browser code or chat.

## Project
Build a local 3D closet rendering app using React + Three.js (React Three Fiber).
The app should generate realistic Shopify product photos and technical/checking views for closet towers and connected systems.

## Image approval workflow
- `assets/exports` is for user-approved finalized Shopify/export images only.
- Drafts, render checks, version attempts, mockups, failed generations, and intermediate composites must be saved under `assets/drafts`.
- Do not overwrite or add a file in `assets/exports` until the user explicitly approves that version as final.
- Use versioned filenames in `assets/drafts`, e.g. `SKU-draft-v1.png`, `SKU-render-check-v2.png`, or `SKU-shopify-photo-draft-v3.png`.
- After approval, copy the approved draft into `assets/exports` using the exact Shopify handle filename, e.g. `DH-S8-51-96-14-W.png` or the agreed final export naming convention.

## Stack
- Vite + React
- Three.js via React Three Fiber (`@react-three/fiber`)
- `@react-three/drei` for OrbitControls and helpers
- JSZip + file-saver for batch PNG export
- Tailwind CSS for UI

## Run locally
```powershell
npm install
npm run dev
```

The app opens at `http://localhost:5173`.
On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd run dev`.

## Key rendering rules
- All geometry is parametric; no hardcoded imported closet models.
- Panel thickness is always 0.75" (18mm).
- All vertical panels are 24" wide x 14" deep regardless of tower nominal width.
- Tower nominal width is the bay/shelf/rod/toe-kick width: 18", 24", or 30".
- Connected systems share a single divider panel at every tower joint; never render two butted panels.
- Number of vertical panels in a connected system = tower count + 1.
- Drawers are always 24" wide. Drawer tower configs (`S3D`, `H3D`, `S2D`) exist only at 24" nominal width.
- Image export uses `canvas.toDataURL()`; preserveDrawingBuffer must be true on the renderer.
- Output filenames must match the Shopify handle exactly, e.g. `DH-S8-51-96-14-W.png`.

## Shelf tower naming
Airtable shelf-only tower naming has been updated:
- `S7` = 7-foot / 84" shelf-only tower with 7 usable shelf levels, excluding the top fixed frame shelf.
- `S8` = 8-foot / 96" shelf-only tower with 8 usable shelf levels, excluding the top fixed frame shelf.
- The bottom shelf counts as one usable shelf level; the top fixed frame shelf does not.
- Therefore `S7` renders as bottom shelf + 6 adjustable shelves + top frame shelf, and `S8` renders as bottom shelf + 7 adjustable shelves + top frame shelf.
- The number in `S7` or `S8` reflects the customer-facing usable shelf count, not the total count of boards in the tower.
- 96" towers get exactly one more adjustable shelf than their 84" equivalent.
- Legacy `S9` / `S93` naming may appear in older exports or render assets; treat it as old naming and prefer live Airtable `S7` / `S8` values for new work.

## Tower configurations
The core tower configs are:
- `LH`: Long Hang, 1 rod, fixed top/bottom frame shelves, top adjustable shelf about 18" below the top with the rod directly below it, no mid shelf in the open long-hang bay.
- `DH`: Double Hang, 2 rods, fixed top/bottom frame shelves, minimal adjustable shelving.
- `HS`: Hang & Shelves, 1 rod at the top with no shelf above the rod, plus 4 lower shelf boards total including the bottom fixed shelf.
- `S3D`: Shelves & 3 Drawers, 2 small drawers + 1 large drawer, no rod.
- `H3D`: Hang & 3 Drawers, 1 rod above 2 small drawers + 1 large drawer.
- `S2D`: Shelves & 2 Drawers, 2 small drawers, no rod.
- `S7`: 84" shelf-only tower with 7 usable shelf levels excluding the top frame shelf.
- `S8`: 96" shelf-only tower with 8 usable shelf levels excluding the top frame shelf.

30" towers are available only for `LH`, `DH`, `HS`, `S7`, and `S8`.
18" towers are available only for `S7` and `S8`.
Drawer towers remain 24" only.

## BOM and part logic
Use the BOM rules from Airtable/business spec when deriving kit geometry or part counts:
- Outer side panels use `VL-[24]-[height]-W` and `VR-[24]-[height]-W`.
- Shared divider panels use `VD-[24]-[height]-W`.
- Shelves use `FS-[width]-14-W` for fixed shelves and `SH-[width]-14-W` for adjustable shelves.
- Toe kicks use `TKK-[width]-5-W`.
- Rods use `RK-[width]-S`; rod brackets use `RDB-S-1`.
- Small drawer kits use `DRK-24-5-13-W`; large drawer kits use `DRK-24-10-13-W`.
- Cam lock kits use `CAMKIT-10-W`.
- Shelf pins use `PIN-20-S`; calculate 4 pins per adjustable shelf.
- Shelf pin pack quantity: 1 pack for up to 5 adjustable shelves, 2 packs for 6-8 adjustable shelves (`S7` / `S8` towers).
- Airtable has `Components` and `Part Components` tables for nested part composition.
- A part can carry its own direct cost/price, or if those direct fields are blank/zero and the part is made from components, calculate effective cost/price from the linked component quantities.
- The `Part Components` table links parent parts to component rows and includes the quantity of each component used in that part.

Width calculations:
- Single tower assembled width = nominal width + 1.5".
- Connected system assembled width = sum of nominal tower widths + `(tower count + 1) * 0.75"`.
- Width requirement = assembled width + 2" clearance.
- 2 towers 24" + 24" = 50.25" assembled.
- 2 towers 24" + 30" = 56.25" assembled.
- 2 towers 24" + 18" = 44.25" assembled.

## Detail rules learned during renders
- Drawer fronts are proud overlay slab fronts, not inset fronts.
- Each drawer face overlays both adjacent vertical panel edges by 0.3125" per side (`0.75 / 2 - 1/16`). The overlay must be symmetrical: left edge and right edge both cover the panel edge.
- If drawer towers share a divider from both sides, the two drawer fronts should leave a 1/8" reveal/gap on the shared divider.
- Drawer fronts should visually cover the side-panel edge in the drawer zone like the approved overlay reference; do not frame drawer faces inside visible side-panel strips.
- Drawer hardware is now a brushed-nickel straight bar pull, not a round knob. Reference dimensions: 5" hole center-to-center / mounting span, approximately 5-1/2" overall length, 1/2" square bar profile, and approximately 1-2/5" projection.
- Every drawer pull must be centered horizontally and vertically on its drawer front, including both small and large drawer fronts.
- Hanging rods and hangers must sit on the front drill-line plane, not deep/set back in the bay.
- Hanging rods and hangers must be vertically tied to the shelf above them. In `LH` and `H3D`, the rod sits directly below the upper shelf. In `DH`, the upper rod sits directly below the top fixed shelf and the lower rod sits directly below the middle adjustable shelf.
- Adjustable shelves should divide the usable open space they belong to. For `DH`, the middle adjustable shelf divides the double-hang bay into upper and lower hanging sections; do not place rods independently from that shelf.
- Drawer towers (`S3D`, `S2D`, `H3D`) must place adjustable shelves by zone around the drawer stack. The shelf directly above the drawers defines the drawer deck, the shelf below the drawers is centered in the lower open space, and upper adjustable shelves evenly divide the open space above the drawer deck.
- `LH` towers must show the upper adjustable shelf about 18" below the top frame shelf, with the long-hang rod directly below that shelf. Do not place an `LH` shelf in the middle of the open long-hang bay.
- `HS` towers must show no top shelf/cubby above the hanger rod. The rod sits at the top/front drill-line plane, and the lower section has exactly 4 shelf boards total including the bottom fixed shelf.
- Shopify photo mode should look like a realistic catalog/product photo: warm wall/floor environment, clean white melamine, soft lighting, realistic shadows, no technical drawing overlay.

## Non-negotiable rules for generated Shopify photos
When generating or editing photorealistic Shopify images, preserve the physical rules above even if the image model tries to simplify them:
- Use a render-first workflow for each kit: first produce or inspect the exact app/Three.js render for the SKU, then use image generation only as a style pass. The render is the geometry source of truth for tower widths, shelf count, rod position, drawer placement, toe-kicks, and shared dividers.
- If the image model returns unrelated content such as posters, infographics, educational charts, checklists, text-heavy layouts, or non-closet imagery, discard it immediately. Do not save it to `assets/exports`; switch back to the app render or a deterministic edit from an approved closet photo.
- Hangers must hang from the visible front rod plane. Do not place hangers deep in the bay or against the rear wall.
- Drawer fronts must be proud overlay slab fronts. They should visually cover both the left and right side-panel edges around the drawer zone, not sit inset inside a framed opening. Reject images where overlay appears only on one side.
- Drawer fronts must use the centered brushed-nickel straight bar pull. Reject images with round knobs, missing pulls, vertical pulls, or off-center drawer pulls.
- The shared center divider must be one panel only.
- For `S8`, show exactly 8 usable shelf levels excluding the top frame shelf. This means 9 horizontal shelf boards total in the shelf-only tower: bottom usable shelf + 7 adjustable shelves + top fixed frame shelf.
- For `S7`, show exactly 7 usable shelf levels excluding the top frame shelf. This means 8 horizontal shelf boards total in the shelf-only tower: bottom usable shelf + 6 adjustable shelves + top fixed frame shelf.
- Shelf-only towers must have even vertical spacing between usable shelf levels. Do not bunch shelves near the bottom or create an extra thin toe-kick compartment.
- For generated photos, describe `S8` as exactly 8 equal open compartments bounded by exactly 9 horizontal boards including top and bottom boards. This is clearer than saying "8 shelves" by itself.
- For `LH`, describe the shelf/rod area as: top adjustable shelf about 18" below the top, one long-hang rod directly below that shelf, and no mid shelf in the long-hang bay.
- For `HS`, describe the layout as: no shelf above the rod, top rod on the front drill-line plane, and exactly 4 lower shelf boards including the bottom fixed shelf.
- Toe kicks are a fixed construction detail and must look the same on every tower/kit. Follow the latest Three.js render exactly: a 5" high toe-kick area below the bottom shelf, with a recessed kick board set back from the front plane and a consistent shadow line. Do not reinterpret the toe kick as exposed furniture legs, a flush plinth, an extra shelf opening, or a decorative base.
- Match reference lighting/camera/materials from `/references`: soft warm daylight, white melamine, subtle satin sheen, realistic wall/floor shadows, and no extra props.
- Reject or regenerate images that add extra shelves, inset the drawers, move hangers backward, use duplicate divider panels, render a flush blocky base instead of a recessed toe kick, crop off the top/back cabinet read, switch to the rejected tight/cut camera angle, or include watermarks/text.

## Working style
- Build incrementally: scaffold first, then add tower configs one at a time.
- Ask before adding any new npm dependencies not listed above.
- Run `npm run dev` after each major change when working interactively.
- Run `npm.cmd run build` on Windows if PowerShell blocks npm scripts.
- Preserve Airtable live-data compatibility; do not hardcode kit lists that should come from Airtable.
