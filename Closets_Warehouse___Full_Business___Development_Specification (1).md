# Closets Warehouse — Full Business & Development Specification
**Last Updated:** June 5, 2026 | **Airtable Base:** Closets Inventory Manager (`app2Taz3qwEZlLSYz`)

---

## 1. Business Overview

**Model:** Bootstrapped warehouse-direct modular closet company. Sell hundreds of products while stocking minimal SKUs. No shipping — warehouse pickup only.

**Location:** Deerfield Beach, FL

**Target Customers:** DIY homeowners and small trade contractors who value price and speed over service.

**Core Value Proposition:** Professional-grade modular closet systems at warehouse-direct prices. Pickup-only fulfillment keeps costs low and speed high.

**Pricing Model:** Retail price = internal cost × 1.8 (95% margin on cost).

---

## 2. Product System

### 2.1 The Modular Tower System

All products are built on the **32mm European shelf-pin-hole system** — 5mm holes spaced exactly 32mm apart on vertical panels. This allows all hardware (shelf pins, cam locks, rod brackets) to index precisely without measuring.

**Standard dimensions:**
- All vertical panels: **14" deep × ¾" thick** (panels are always 14" depth — tower width does not affect panel dimensions)
- Tower widths available: **18", 24", 30"** (nominal)
- Tower heights available: **84"** (standard 8-ft ceiling) and **96"** (9–10-ft ceiling)
- All shelves: 14" deep

**Panel thickness rule:** All boards are ¾" (18mm) particleboard with white melamine. This affects total assembled width calculations:
- Single tower assembled width = nominal width + (2 × 0.75") = nominal + 1.5"
- Connected system assembled width = (sum of nominal widths) + (number of panels × 0.75")
- Number of panels in a connected system = tower count + 1

**Assembled width examples:**
- 1 tower (24" nominal) = 25.5" assembled | 27.5" width requirement
- 1 tower (30" nominal) = 31.5" assembled | 33.5" width requirement
- 1 tower (18" nominal) = 19.5" assembled | 21.5" width requirement
- 2 towers (24" + 24") = 50.25" assembled | 52.25" width requirement
- 2 towers (24" + 30") = 56.25" assembled | 58.25" width requirement
- 2 towers (24" + 18") = 44.25" assembled | 46.25" width requirement

**Width requirement** = assembled width + 2" (1" clearance each side for installation).

### 2.2 Panel Logic

| Panel Type | Code | Purpose | Drilled |
|---|---|---|---|
| Left side panel | VL-[width]-[height]-W | Outer left wall of any tower | One side |
| Right side panel | VR-[width]-[height]-W | Outer right wall of any tower | One side |
| Divider panel | VD-[width]-[height]-W | Shared center panel in connected systems | Both sides |

**Critical rule:** Vertical panel dimensions are always 24" wide × 14" deep regardless of tower width. The tower width (18", 24", 30") refers to the interior/shelf width, not the panel width. Only shelves, rods, and toekicks change with tower width.

**Baseboard notch:** All side and divider panels include a factory-cut notch at the base accommodating baseboards up to **1" thick × 4¾" tall**.

### 2.3 Connected System Panel Rule

When towers are connected, internal side panels are replaced by a single divider panel:

| System | B1 (outer side panels) | VD (divider panels) |
|---|---|---|
| 1 tower | 2 | 0 |
| 2 towers | 2 | 1 |

**No duplicate divider boards** — this is a key differentiator vs. budget systems where two outer panels are simply butted together.

---

## 3. The 7 Tower Configurations

| Config Code | Name | Rods | Fixed Shelves | Adj Shelves (84") | Adj Shelves (96") | Drawers |
|---|---|---|---|---|---|---|
| LH | Long Hang | 1 | 2 | 1 | 2 | None |
| DH | Double Hang | 2 | 2 | 1 | 2 | None |
| HS | Hang & Shelves | 1 | 2 | 3 | 4 | None |
| S3D | Shelves & 3 Drawers | 0 | 2 | 4 | 5 | 2 small + 1 large |
| H3D | Hang & 3 Drawers | 1 | 2 | 2 | 3 | 2 small + 1 large |
| S2D | Shelves & 2 Drawers | 0 | 2 | 4 | 5 | 2 small |
| S7 | 7-Shelf Tower (84") | 0 | 2 | 7 | — | None |
| S8 | 8-Shelf Tower (96") | 0 | 2 | — | 8 | None |

**Shelf tower naming:** S7 = 84" height (7 adjustable shelves, excluding the top fixed frame shelf). S8 = 96" height (8 adjustable shelves, excluding the top fixed frame shelf). The number reflects the usable adjustable shelf count the customer interacts with.

**96" towers get 1 extra adjustable shelf** at the top section vs. the equivalent 84" tower.

**Drawer rule:** All drawers are 24" wide regardless of tower width. No drawer configurations exist for 18" or 30" towers — those are shelf/hang only.

**30" towers available:** LH, DH, HS, S7, S8 only (no drawer towers at 30").
**18" towers available:** S7, S8 only.

---

## 4. Parts Catalog

### 4.1 Naming Convention

**Parts:** `[type]-[width]-[length/height]-[color]`
- Boards: width × height (e.g. `VL-24-84-W`)
- Shelves: width × depth (e.g. `SH-24-14-W`)
- Hardware: descriptive code only (e.g. `RK-24-S`, `CAMKIT-10-W`)

### 4.2 Parts List with Pricing

| Item Code | Description | Internal Cost | Retail Price | Weight (lbs) |
|---|---|---:|---:|---:|
| VL-24-84-W | Left Side Panel 24"W × 84"H White | $31.90 | $57.42 | 13.0 |
| VR-24-84-W | Right Side Panel 24"W × 84"H White | $31.90 | $57.42 | 13.0 |
| VD-24-84-W | Divider Panel 24"W × 84"H White | $31.90 | $57.42 | 13.0 |
| VL-24-96-W | Left Side Panel 24"W × 96"H White | $36.10 | $64.98 | 15.5 |
| VR-24-96-W | Right Side Panel 24"W × 96"H White | $36.10 | $64.98 | 15.5 |
| VD-24-96-W | Divider Panel 24"W × 96"H White | $36.10 | $64.98 | 15.5 |
| FS-24-14-W | Fixed Shelf 24"W × 14"D White | $10.40 | $18.72 | 3.5 |
| FS-18-14-W | Fixed Shelf 18"W × 14"D White | $8.30 | $14.94 | 2.5 |
| FS-30-14-W | Fixed Shelf 30"W × 14"D White | $12.50 | $22.50 | 4.5 |
| SH-24-14-W | Adjustable Shelf 24"W × 14"D White | $8.40 | $15.12 | 3.0 |
| SH-18-14-W | Adjustable Shelf 18"W × 14"D White | $6.30 | $11.34 | 2.0 |
| SH-30-14-W | Adjustable Shelf 30"W × 14"D White | $10.50 | $18.90 | 4.0 |
| TKK-24-5-W | Toe Kick 24"W × 5"H White | $2.50 | $4.50 | 1.0 |
| TKK-30-5-W | Toe Kick 30"W × 5"H White | $3.13 | $5.63 | 1.5 |
| TKK-18-5-W | Toe Kick 18"W × 5"H White | $1.88 | $3.38 | 0.5 |
| RK-24-S | Hanging Rod 24"W Steel | $5.00 | $9.00 | 1.5 |
| RK-30-S | Hanging Rod 30"W Steel | $6.25 | $11.25 | 2.0 |
| RDB-S-1 | Rod Bracket Set (pair) Steel | $1.00 | $1.80 | 0.3 |
| WLB-S-1 | Wall L-Bracket (pack of 1) Steel | $1.00 | $1.80 | 0.3 |
| DRK-24-5-13-W | Drawer Kit 24"W × 5"H × 13"D White | $30.00 | $54.00 | 8.0 |
| DRK-24-10-13-W | Drawer Kit 24"W × 10"H × 13"D White | $35.00 | $63.00 | 10.0 |
| CAMKIT-10-W | Cam Lock & Screw Kit (10 pieces) | $5.00 | $9.00 | 0.2 |
| PIN-20-S | Shelf Pin Pack (20 pins) Steel | $5.00 | $9.00 | 0.1 |
| FI-3-84-W | Filler Panel 3"W × 84"H White | $6.30 | $11.34 | 1.5 |
| FI-3-96-W | Filler Panel 3"W × 96"H White | $7.20 | $12.96 | 1.5 |
| BR-12-14-W | Corner Bridge 12"W × 14"D White | $4.20 | $7.56 | 2.0 |

**Drawer kit notes:**
- All drawers are 24" wide regardless of tower width
- Pre-drilled for handles at **128mm center-to-center** — compatible with standard industry bar pulls
- Includes box, full-extension soft-close tracks, and mounting screws
- 13" depth fits inside 14" tower depth with track clearance

**Hardware pack sizes:**
- Cam lock kits: 10 pieces per kit (8 used per tower for fixed shelf connections)
- Shelf pins: 20 per pack at $5.00 — 4 pins per adjustable shelf
- Shelf pin pack quantity per tower: 1 pack for up to 5 adj shelves, 2 packs for 6–8 adj shelves (S7/S8 towers)

---

## 5. Kit Catalog (44 Products)

### 5.1 Kit Naming Convention

**Format:** `[config]-[assembled width]-[height]-[depth]-[color]`

Examples: `LH-26-84-14-W`, `DH-S7-51-84-14-W`, `DH-S8-30-57-96-14-W`

Connected systems show total assembled width. Mixed-width systems include the non-standard tower width in the name (e.g. `-30` or `-18`).

### 5.2 Single Towers — 84" Height (24" nominal)

| Kit ID | Kit Name | Description | Retail | Weight |
|---|---|---|---:|---:|
| K1 | LH-26-84-14-W | Long Hang Tower | $202.50 | 35 lbs |
| K2 | DH-26-84-14-W | Double Hang Tower | $213.30 | 37 lbs |
| K3 | HS-26-84-14-W | Hang & Shelves Tower | $232.74 | 38 lbs |
| K4 | S3D-26-84-14-W | Shelves & 3 Drawer Tower | $408.06 | 60 lbs |
| K5 | H3D-26-84-14-W | Hang & 3 Drawer Tower | $388.62 | 58 lbs |
| K6 | S2D-26-84-14-W | Shelves & 2 Drawer Tower | $345.06 | 50 lbs |
| K7 | S7-26-84-14-W | 7-Shelf Tower | $291.42 | 47 lbs |

### 5.3 Single Towers — 96" Height (24" nominal)

| Kit ID | Kit Name | Description | Retail | Weight |
|---|---|---|---:|---:|
| K8 | LH-26-96-14-W | Long Hang Tower | $224.46 | 40 lbs |
| K9 | DH-26-96-14-W | Double Hang Tower | $227.34 | 42 lbs |
| K10 | HS-26-96-14-W | Hang & Shelves Tower | $247.86 | 43 lbs |
| K11 | S3D-26-96-14-W | Shelves & 3 Drawer Tower | $427.50 | 65 lbs |
| K12 | H3D-26-96-14-W | Hang & 3 Drawer Tower | $408.42 | 62 lbs |
| K13 | S2D-26-96-14-W | Shelves & 2 Drawer Tower | $363.42 | 54 lbs |
| K14 | S8-26-96-14-W | 8-Shelf Tower | $316.62 | 53 lbs |

### 5.4 Single Towers — 30" Wide (84" and 96")

| Kit ID | Kit Name | Description | Retail | Weight |
|---|---|---|---:|---:|
| K15-30 | LH-32-84-14-W | Long Hang Tower 30" | $218.34 | 38 lbs |
| K16-30 | DH-32-84-14-W | Double Hang Tower 30" | $230.40 | 40 lbs |
| K17-30 | HS-32-84-14-W | Hang & Shelves Tower 30" | $248.40 | 42 lbs |
| K18-30 | S7-32-84-14-W | 7-Shelf Tower 30" | $311.22 | 52 lbs |
| K19-30 | LH-32-96-14-W | Long Hang Tower 30" 96" | $240.48 | 43 lbs |
| K20-30 | DH-32-96-14-W | Double Hang Tower 30" 96" | $252.00 | 45 lbs |
| K21-30 | HS-32-96-14-W | Hang & Shelves Tower 30" 96" | $268.20 | 46 lbs |
| K22-30 | S8-32-96-14-W | 8-Shelf Tower 30" 96" | $334.80 | 57 lbs |

### 5.5 Single Towers — 18" Wide (S7/S8 only)

| Kit ID | Kit Name | Description | Retail | Weight |
|---|---|---|---:|---:|
| K23-18 | S7-20-84-14-W | 7-Shelf Narrow Tower 84" | $222.30 | 35 lbs |
| K24-18 | S8-20-96-14-W | 8-Shelf Narrow Tower 96" | $244.80 | 40 lbs |

### 5.6 Connected Systems — 51" Width (24"+24"), 84" Height

| Kit ID | Kit Name | Retail | Min Opening | Weight |
|---|---|---:|---:|---:|
| K2-K7 | DH-S7-51-84-14-W | $447.30 | 53" | 88 lbs |
| K1-K7 | LH-S7-51-84-14-W | $429.30 | 53" | 85 lbs |
| K2-K4 | DH-S3D-51-84-14-W | $570.06 | 53" | 101 lbs |
| K2-K3 | DH-HS-51-84-14-W | $474.30 | 53" | 80 lbs |
| K1-K4 | LH-S3D-51-84-14-W | $552.06 | 53" | 98 lbs |
| K5-K7 | H3D-S7-51-84-14-W | $637.92 | 53" | 108 lbs |

### 5.7 Connected Systems — 51" Width (24"+24"), 96" Height

| Kit ID | Kit Name | Retail | Min Opening | Weight |
|---|---|---:|---:|---:|
| K9-K14 | DH-S8-51-96-14-W | $483.66 | 53" | 98 lbs |
| K8-K14 | LH-S8-51-96-14-W | $465.66 | 53" | 95 lbs |
| K9-K11 | DH-S3D-51-96-14-W | $607.50 | 53" | 111 lbs |
| K9-K10 | DH-HS-51-96-14-W | $510.66 | 53" | 90 lbs |
| K8-K11 | LH-S3D-51-96-14-W | $589.50 | 53" | 108 lbs |
| K12-K14 | H3D-S8-51-96-14-W | $673.92 | 53" | 118 lbs |

### 5.8 Connected Systems — Mixed Width (57" and 45"), 84" Height

| Kit ID | Kit Name | Width | Retail | Min Opening | Weight |
|---|---|---:|---:|---:|---:|
| K2-K18-30 | DH-S7-30-57-84-14-W | 57" | $465.66 | 59" | 96 lbs |
| K1-K18-30 | LH-S7-30-57-84-14-W | 57" | $447.66 | 59" | 93 lbs |
| K2-K17-30 | DH-HS-30-57-84-14-W | 57" | $490.50 | 59" | 90 lbs |
| K2-K23-18 | DH-S7-18-45-84-14-W | 45" | $400.14 | 47" | 76 lbs |

### 5.9 Connected Systems — Mixed Width (57" and 45"), 96" Height

| Kit ID | Kit Name | Width | Retail | Min Opening | Weight |
|---|---|---:|---:|---:|---:|
| K20-K22-30 | DH-S8-30-57-96-14-W | 57" | $500.22 | 59" | 106 lbs |
| K19-K22-30 | LH-S8-30-57-96-14-W | 57" | $482.22 | 59" | 103 lbs |
| K20-K21-30 | DH-HS-30-57-96-14-W | 57" | $525.96 | 59" | 99 lbs |
| K9-K24-18 | DH-S8-18-45-96-14-W | 45" | $432.00 | 47" | 86 lbs |

---

## 6. Market Coverage

| Closet Opening | Best Fit System | Width Requirement |
|---|---|---|
| 22"+ | S7-20-84-14-W / S8-20-96-14-W (18" narrow tower) | 21.5" |
| 28"+ | Any single 24" tower | 27.5" |
| 34"+ | Any single 30" tower | 33.5" |
| 47"+ | DH + S7/S8-18 connected (45" system) | 46.25" |
| 53"+ | Any 51" connected system | 52.25" |
| 59"+ | Any 57" connected system | 58.25" |

**Most common residential closet widths:** 48", 60", 72", 84", 96". Current product line covers 48", 53"+, and 60" openings well. 72" and 84" openings require 3-tower systems (not yet built).

---

## 7. Airtable Structure

### 7.1 Tables

| Table | ID | Purpose |
|---|---|---|
| Items (Parts) | `tblX6RPmUnVrEiCuH` | Individual components, costs, Shopify data |
| Kits | `tblqLaIDxtxHGpkAG` | Tower configurations and connected systems |
| Kit Parts | `tblxYe0c4XlHEkKCu` | Junction: Kit ↔ Part + quantity |
| Suppliers | — | Supplier contact and lead time info |
| Part Suppliers | — | Part ↔ Supplier pricing/MOQ |

### 7.2 Key Fields — Kits Table (`tblqLaIDxtxHGpkAG`)

| Field Name | Field ID | Type | Purpose |
|---|---|---|---|
| Kit Name | `fld3oyNLlC7hzANom` | Text | SKU / kit identifier |
| KitID | `fld6vc370reltEv9C` | Text | Reference ID (K1, K2-K7, etc.) |
| Description | `fldqzeDiyPMkqwHfH` | Text | Human-readable product title |
| html_desc | `fld2hXL4QIKdFj6qr` | Long text | Shopify body HTML |
| Width | `fldKBCNdhpIB5MbRB` | Number | Assembled width in inches |
| Height | `fldFY6aKsF6j0PjNi` | Number | Tower height in inches |
| Depth | `fldCcmPZvhsiE2jb6` | Number | Tower depth (always 14) |
| Width Requirement | `fldeqTl0aN2liIKgP` | Formula | Width + 2 |
| Status | `fldTgtjO0Kig4Rkfn` | Single select | Active / Draft / Archived |
| retail_price | `fldzzmeHUXYNfBEPL` | Currency | Selling price (cost × 1.8) |
| weight_lbs | `fldmlnYU0pVpisNWv` | Number | Estimated weight |
| shopify_handle | `fldUcuhw5VYROrinS` | Text | URL slug |
| shopify_sku | `fldEGkxvJB3qUEst2` | Text | Variant SKU |
| product_type | `fldkKTAmYJS5YOMSK` | Single select | Single Tower / Double Tower Closet |
| tags | `flduvw2iivDu3Nv6N` | Long text | Shopify tags |
| tower_count | `fld4t4YPcCLtxv3zz` | Number | 1 or 2 |
| has_hanging | `fldXh9A2RbhBZcCHG` | Checkbox | Includes hanging rod |
| has_drawers | `fldWapRYjgDL117EL` | Checkbox | Includes drawers |
| ceiling_height | `flddgPlyPYeGT7Gjn` | Single select | Standard (8ft) / Tall (9-10ft) |
| config_label | `fldyEe3lt0pzGd9rY` | Single select | Long Hang / Double Hang / etc. |
| nominal_width_in | `fldlQqwemwgtPCjLv` | Number | 18 / 24 / 30 / 45 / 51 / 57 |
| seo_title | `fldyI4C0pttfoiOZf` | Text | Shopify SEO title |
| seo_description | `fld95pLncdcwwemPL` | Long text | Shopify meta description |

### 7.3 Key Fields — Parts Table (`tblX6RPmUnVrEiCuH`)

| Field Name | Field ID | Type | Purpose |
|---|---|---|---|
| Item Code | `fldMxPFVbAEBgimm4` | Text | Part number |
| Description | `fldjYbqJIqQH6gDqp` | Text | Short description |
| html_desc | `fldi5A9Y8V3fIv2B9` | Long text | Shopify body HTML |
| Total Cost | `fldUwXwPVcvmymHNW` | Currency | Internal cost |
| retail_price | `fldKPflHztogJG2cc` | Currency | Selling price |
| weight_lbs | `fldTLdxJBzfXJIdLc` | Number | Estimated weight |
| shopify_handle | `fldMnboDg6qx8Mfic` | Text | URL slug |
| shopify_sku | `flddyjgdZT85x4z6O` | Text | Variant SKU |
| tags | `fldntB7UE6l34ABy6` | Long text | Shopify tags |
| seo_title | `fldzDo0uzTG1CmxtX` | Text | Shopify SEO title |
| seo_description | `fldO7u4D6hUIUa4Qj` | Long text | Shopify meta description |

### 7.4 Kit Parts Table (`tblxYe0c4XlHEkKCu`)

| Field | Field ID | Type |
|---|---|---|
| Quantity Needed Per Kit | `fldE21sOFbdFfE0Br` | Number |
| Kits (link) | `fldMq8qOlGAqu6k5L` | Linked record → Kits |
| Part (link) | `fldTpgtmz46yGPAbG` | Linked record → Parts |

---

## 8. Shopify Architecture

### 8.1 Fulfillment Rules (All Products)
- **Requires Shipping:** FALSE
- **Fulfillment Service:** manual
- **Pickup only:** Deerfield Beach, FL
- **Vendor:** Closets Warehouse
- **Product Category:** Furniture > Storage & Organization > Closet Organizers
- **Option1 Name:** Color | **Option1 Value:** White

### 8.2 CSV Export Columns

**Kits CSV columns:**
Handle, Title, Body (HTML), Vendor, Product Category, Type, Tags, Published, Option1 Name, Option1 Value, Variant SKU, Variant Price, Variant Compare At Price, Variant Requires Shipping, Variant Fulfillment Service, Variant Weight, Variant Weight Unit, Width (in), Height (in), Depth (in), Min Closet Width (in), Tower Count, Has Hanging, Has Drawers, Ceiling Height, Config, Nominal Width (in), SEO Title, SEO Description

**Parts CSV columns:**
Handle, Title, Body (HTML), Vendor, Product Category, Type, Tags, Published, Option1 Name, Option1 Value, Variant SKU, Variant Price, Variant Compare At Price, Variant Requires Shipping, Variant Fulfillment Service, Variant Weight, Variant Weight Unit, Width (in), Length (in), Depth (in), SEO Title, SEO Description

### 8.3 Shopify Tags Reference

**Used on all products:** `pickup-only, white, melamine, deerfield-beach`

**Kits — structural:** `single-tower` or `double-tower`, `84-inch` or `96-inch`, `standard-ceiling` or `tall-ceiling`

**Kits — functional:** `has-hanging`, `has-drawers`, `shelf-only`, `soft-close`, `long-hang`, `double-hang`, `hang-and-shelves`, `shelves-and-drawers`, `hang-and-drawers`

**Kits — width:** `18-inch-tower`, `24-inch-tower`, `30-inch-tower`

**Kits — closet fit:** `fits-48-inch-closet`, `fits-53-inch-closet`, `fits-59-inch-closet`, `fits-60-inch-closet`, `narrow`

**Parts:** `panel`, `shelf`, `adjustable-shelf`, `fixed-shelf`, `drawer`, `hardware`, `rod`, `toe-kick`, `filler`, `part`

### 8.4 Shopify CSV Exporter
A live Airtable-powered exporter app has been built in this conversation. It fetches all records from Airtable and generates Shopify-ready CSV files for both kits and parts with one click.

---

## 9. Operational Workflow

### 9.1 Order Flow
1. Customer places order on Shopify (pickup only)
2. Customer selects pickup date and window at checkout
3. Order notification received at warehouse
4. Kit components staged from floor stock
5. Customer arrives and picks up flat-packed components

### 9.2 Inventory Philosophy
- **Airtable:** Internal cost tracking and inventory management only
- **Shopify:** Retail pricing, orders, and customer-facing everything
- No retail pricing in Airtable — separation of concerns

### 9.3 Floor Stock Recommendation
Maintain 4 sets of each of the 7 single tower types in standard 24" width and 84" height. Connected systems are assembled at order time from individual tower components. 30" and 18" width parts stocked based on demand.

---

## 10. Next Steps

| Priority | Task | Status |
|---|---|---|
| 1 | Fix Shopify CSV exporter app (Airtable API connection) | 🔄 In Progress |
| 2 | Import Kits CSV into Shopify | ⬜ Pending |
| 3 | Import Parts CSV into Shopify | ⬜ Pending |
| 4 | Set up Shopify pickup scheduler at checkout | ⬜ Pending |
| 5 | Configure Shopify collections from tags | ⬜ Pending |
| 6 | Product photography / renders for all 7 tower configs | ⬜ Pending |
| 7 | Finalize drawer unit supplier and outsourcing terms | ⬜ Pending |
| 8 | Build 3-tower and 4-tower connected systems (72"+ closets) | ⬜ Pending |
| 9 | Connect Shopify → Airtable inventory deduction via Zapier | ⬜ Pending |
| 10 | Set custom color options and supplier lead times | ⬜ Pending |
