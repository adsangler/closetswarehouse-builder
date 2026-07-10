# Private Real-Photo Library

This library supplies real-world style references for the internal Hero Image Studio. Real photos are references for camera, lighting, materials, installation details, and room realism. The deterministic Three.js render remains the geometry source of truth.

## Intake

1. Copy original photos into `assets/photo-library/private/inbox`.
2. Run `npm run photos:audit`.
3. Review `assets/photo-library/private/catalog.json` and add labels where known.
4. Move reviewed originals into `private/curated`; move unsuitable images into `private/rejected`.

The entire `private` directory is ignored by Git. Do not place customer names, addresses, access codes, faces, paperwork, or other identifying information in a curated image. Crop or redact those details first.

## Photo roles

- `scene`: complete installation or room, useful for camera and lighting.
- `product`: clear full-system photograph, useful for proportions and materials.
- `detail`: close-up of melamine, hardware, drawer overlay, rod, or toe kick.
- `edit-target`: a photo the image workflow is explicitly allowed to modify.

Reference photos are not edit targets unless `role` is deliberately set to `edit-target`.

## Minimum labels

Each curated photo should have `role`, `permission`, `quality`, and `notes`. Add SKU/configuration fields only when they are known; do not guess.

Use `metadata-schema.json` as the field reference. Generated drafts still belong in `assets/drafts`, and only explicitly approved final images belong in `assets/exports`.
