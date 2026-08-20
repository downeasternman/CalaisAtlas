# Calais Atlas — State of Project

**As of:** 2026-08-20  
**Working tree:** Map road name labels (OSM)  
**Local path:** `C:\Users\mclancy\CalaisAtlas`  
**Remote:** https://github.com/downeasternman/CalaisAtlas

This document is a review snapshot: what ships today, gaps, and next gates.

---

## 1. Verdict

| Area | Status |
|------|--------|
| Phase A (identity / repo) | **Complete** (pushed `56a7908`) |
| Phase B (Calais basemap) | **Complete** |
| Phase C (place search) | **Complete** (pushed `a65a618`) |
| Phase D (Calais tax join) | **Complete** (pushed `3289dcd`) |
| Phase E (valuation choropleth) | **Complete** |
| Phase F (per-acre cohorts) | **Complete** |
| Tax billed + panel cleanup | **Complete** |
| Join-quality (bleed + parent) | **Complete** |
| 2023 property-card owner backup | **Complete** (local rebuild) |
| Map road name labels | **Complete** |

**Product identity:** Hybrid atlas + parcel detail; City of Calais, Maine only; free public data.

Map story (Phase F): assessed total ÷ GIS acres, percentile within improved vs unimproved cohorts — lowest blue, highest red; fully exempt purple; homestead markers; missing total/acres gray. Cohort visibility toggle (Both / Improved / Unimproved).

Basemap: OSM road **lines** plus **street-name labels** (line placement; major from z11, residential/minor from z13) drawn above the parcel choropleth.

Parcel detail shows **tax billed** from the 2025-26 commitment book (mill rate **14.500**), cleaned mail address, and tax-book acres when parsed.

Owner backup: parcels still missing an owner after commitment join may get `ownerName` from **2023 property cards** (`joinMethod: property_card`). No 2023 assessments are copied.

---

## 2. Phase gate checklist

| Phase | Scope | Gate status |
|-------|--------|-------------|
| **A** | New repo, identity, Calais-only scripts | Complete |
| **B** | Calais boundary + OSM clip + tiles | Complete |
| **C** | Place search; remove municipality filter | Complete |
| **D** | Calais geometry + commitment parse/join | Complete |
| **E** | `valuePct` choropleth, legend, tests | Complete |
| **F** | Per-acre within-cohort ranks, exempt, homestead, toggle | Complete |

---

## 3. Data

- Geometry: Maine GeoLibrary organized parcels, GEOCODE `29070` — **2,771** parcels
- Tax: City of Calais 2025-26 Real Estate Tax Commitment — **2,018** parsed rows
- Property cards: **2,385** parsed 2023 Vision/Trio cards (`data/raw/property-cards/2023-property-cards.zip`)
- Owner joins after commitment: **2,260 / 2,771**; after card backup: **2,323 / 2,771** (**+63** `property_card`)
- Quality joins (owner + assessment): still commitment-only assessments — **2,030 / 2,771** (73.3%)
- Still no owner: **448** (e.g. `003-001-012` has no matching 2023 card)
- Tax billed (`taxAmount`) from commitment only
- Map fill unchanged (cards do not invent assessments)

---

## 4. Stack & product constraints

- Next.js App Router, TypeScript, React, Tailwind v4
- MapLibre GL v5 + react-map-gl/maplibre, PMTiles
- pnpm
- Free public data only; no invented assessments; source + as-of on attribute groups

---

## 5. Rebuild commands

Commitment path:

`pnpm etl:org:parse --town=calais && pnpm etl:org:join --town=calais`

Owner backup from cards (requires zip under `data/raw/property-cards/`):

`pnpm etl:org:cards:parse && pnpm etl:org:cards:backup`

Then:

`pnpm etl:merge:parcels && pnpm tiles:parcels`

Note: re-running `etl:org:join` clears card backups until `etl:org:cards:backup` is run again.

Review checklist:
- [x] Phase A complete (identity + repo remote)
- [x] Phase B (Calais METWP boundary, OSM clip, basemap/boundary tiles, map opens on Calais)
- [x] Phase C (Calais place search; no municipality filter)
- [x] Phase D (Calais geometry + 2025-26 commitment join)
- [x] Phase E (`valuePct` choropleth, legend, detail percentile)
- [x] Phase F (per-acre cohorts, exempt fill, homestead markers, toggle)
- [x] Tax billed + tax-book acres from commitment; parcel panel cleanup
- [x] Join-quality: no STAPLES bleed; Bailey not on sibling map-block lots
- [x] 2023 property cards owner-only backup (`property_card`)
- [x] Map road name labels from OSM `name` (style layers; no tile rebuild)
