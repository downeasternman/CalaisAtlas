# Calais Atlas — State of Project

**As of:** 2026-08-20  
**Working tree:** Phase E valuation choropleth  
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

**Product identity:** Hybrid atlas + parcel detail; City of Calais, Maine only; free public data.

Map story (Phase E): assessed total percentile among Calais parcels — lowest blue, highest red; no assessment stays gray.

---

## 2. Phase gate checklist

| Phase | Scope | Gate status |
|-------|--------|-------------|
| **A** | New repo, identity, Calais-only scripts | Complete |
| **B** | Calais boundary + OSM clip + tiles | Complete |
| **C** | Place search; remove municipality filter | Complete |
| **D** | Calais geometry + commitment parse/join | Complete |
| **E** | `valuePct` choropleth, legend, tests | Complete |

---

## 3. Data

- Geometry: Maine GeoLibrary organized parcels, GEOCODE `29070` — **2,771** parcels
- Tax: City of Calais 2025-26 Real Estate Tax Commitment — **2,027** parsed rows
- Owner joins: **2,678 / 2,771** (96.6%)
- Quality joins (owner + assessment): **2,530 / 2,771** (91.3%)
- Map fill is assessed-total percentile among Calais parcels with a parsed total (lowest blue, highest red). Unassessed parcels are gray.

---

## 4. Stack & product constraints

- Next.js App Router, TypeScript, React, Tailwind v4
- MapLibre GL v5 + react-map-gl/maplibre, PMTiles
- pnpm
- Free public data only; no invented assessments; source + as-of on attribute groups

---

## 5. Next gate

v1 complete. Next work is out of scope unless requested (per-acre coloring, other towns, branding).

Review checklist:
- [x] Phase A complete (identity + repo remote)
- [x] Phase B (Calais METWP boundary, OSM clip, basemap/boundary tiles, map opens on Calais)
- [x] Phase C (Calais place search; no municipality filter)
- [x] Phase D (Calais geometry + 2025-26 commitment join)
- [x] Phase E (`valuePct` choropleth, legend, detail percentile)
