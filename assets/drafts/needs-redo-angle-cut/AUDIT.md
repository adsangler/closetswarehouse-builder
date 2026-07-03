# Angle/Crop Redo Audit

## Root Cause
The rejected camera family was introduced before `DH-S7-30-57-84-14-W-shopify-photo-v1.png`.

- First bad family source in exports: `DH-S7-51-84-14-W-shopify-photo-v2-fewer-shelves.png`
- Created: 2026-06-06 2:00 PM
- Generated-image source: `C:\Users\CIQ\.codex\generated_images\019e9830-63e9-7981-ae4c-12e9da515ce0\ig_039512604fea024a016a245face75c8195b7562393692f8002.png`
- Later reused/derived source: `DH-S7-30-57-84-14-W-shopify-photo-v1.png`
- Created: 2026-06-06 8:46 PM

## Problem
This family switched to a tighter, different camera angle and lost the approved top/back cabinet read. It should not be used as a source for future Shopify photos.

## Quarantined Double-Tower Files
These were moved out of `assets/exports` and into this draft folder for redo:

- `DH-S7-30-57-84-14-W-shopify-photo.png`
- `DH-S7-30-57-84-14-W-shopify-photo-v1.png`
- `DH-S7-30-57-84-14-W-shopify-photo-v2-wider-right-tower.png`
- `DH-S3D-51-96-14-W-shopify-photo.png`
- `DH-S3D-51-96-14-W-shopify-photo-v1-render-first-safe.png`
- `DH-HS-51-96-14-W-shopify-photo.png`
- `DH-HS-51-96-14-W-shopify-photo-v1-equal-width.png`
- `LH-S3D-51-96-14-W-shopify-photo.png`
- `LH-S3D-51-96-14-W-shopify-photo-v1-render-first-safe.png`
- `LH-S3D-51-96-14-W-shopify-photo-v2-lh-transplant.png`

## Redo Rule
Redo these as drafts first under `assets/drafts`. Only copy an approved version back into `assets/exports` after user approval.
