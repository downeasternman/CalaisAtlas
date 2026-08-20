# Calais Atlas — State of Project

**As of:** 2026-08-20  
**Working tree:** Phase B Calais basemap  
**Local path:** `C:\Users\mclancy\CalaisAtlas`  
**Remote:** https://github.com/downeasternman/CalaisAtlas

This document is a review snapshot: what ships today, gaps, and next gates.

---

## 1. Verdict

| Area | Status |
|------|--------|
| Phase A (identity / repo) | **Complete** |
| Phase B (Calais basemap) | **Complete** |
| Phase C (place search) | Not started |
| Phase D (Calais tax join) | Not started |
| Phase E (valuation choropleth) | Not started |

**Product identity:** Hybrid atlas + parcel detail; City of Calais, Maine only; free public data.

Map story (Phase E): assessed total percentile among Calais parcels — lowest blue, highest red; no assessment stays gray.

---

## 2. Phase gate checklist

| Phase | Scope | Gate status |
|-------|--------|-------------|
| **A** | New repo, identity, Calais-only scripts | Complete |
| **B** | Calais boundary + OSM clip + tiles | Complete |
| C | Place search; remove municipality filter | Pending |
| D | Calais geometry + commitment parse/join | Pending |
| E | `valuePct` choropleth, legend, tests | Pending |

---

## 3. Data (authoritative after Phase D)

- Geometry: Maine GeoLibrary organized parcels, GEOCODE `29070`
- Tax: City of Calais 2025-26 Real Estate Tax Commitment
- County atlas seed counts (not yet re-derived in this repo): 2,771 geometry parcels; 2,251 owner joins; 1,875 quality joins

---

## 4. Stack & product constraints

- Next.js App Router, TypeScript, React, Tailwind v4
- MapLibre GL v5 + react-map-gl/maplibre, PMTiles
- pnpm
- Free public data only; no invented assessments; source + as-of on attribute groups

---

## 5. Next gate

**Phase C** — Place-name search Calais-only; remove municipality filter; Header title Calais Atlas.

Review checklist:
- [x] Phase A complete (identity + repo remote)
- [x] Phase B (Calais METWP boundary, OSM clip, basemap/boundary tiles, map opens on Calais)
- [ ] Phase C
- [ ] Phase D
- [ ] Phase E
