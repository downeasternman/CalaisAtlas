# Changelog

All notable changes to Calais Atlas are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Phase B: Calais METWP boundary, OSM clip, `basemap.pmtiles` and `boundaries.pmtiles`
- Map initial view uses Calais bbox `[-67.3056, 45.0720, -67.1227, 45.1918]`
- Phase C: Calais-only place search; municipality filter removed; chrome title Calais Atlas
- Phase D: Calais GeoLibrary parcels + 2025-26 commitment join (2,678 owner joins; 2,530 quality joins of 2,771)
- Phase E: assessed-total percentile choropleth (lowest blue, highest red); unassessed parcels gray
- Phase F: assessed-total-per-GIS-acre percentiles within improved/unimproved cohorts; stronger blue→red ramp; fully exempt purple fill; homestead ★ markers; cohort visibility toggle
- Commitment Tax column → `taxAmount`; tax-book acres → `taxAcreage`; cleaned mailing addresses (no tax/acres/homestead leakage)
- 2023 property cards as owner-only backup for parcels missing a commitment owner (`property_card` join)
- OSM road name labels along streets (major from z11, minor from z13)

### Changed

- Map coloring metric from citywide assessed-total percentile to within-cohort assessed total ÷ GIS acres
- Parcel tiles bake `cohort`, `fullyExempt`, and `homestead` alongside `valuePct`
- Parcel detail panel: tax billed primary; stacked land/building/exemption; homestead only on exemption row
- Homestead label detection matches Calais book wording (`Homestead…`)
- Commitment land-first headers accept land without thousands commas; Acres→map-lot binding; ZIP-like columnar assessments rejected
- `map_lot_parent` joins only for suffix/condo lots (not siblings sharing a map-block prefix)

### Added (launch readiness G0–G2)

- CI workflow (lint, test:ci, script typecheck, fixture bootstrap, build)
- Fixture bootstrap (`pnpm dev:bootstrap`) and committed runtime/tile fixtures for clean-clone dev
- Unified property search (`/api/search`) for address, owner, map/lot, account, and places
- Shareable parcel URLs (`?parcel=`), copy link, mobile bottom-sheet panel, map onboarding hint
- Data status modal, public disclaimer, field-level parcel warnings, `/api/meta/health`
- Release manifest packaging (`pnpm release:package`) and [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- MIT license

### Changed (launch readiness G0–G2)

- `phase:calais` now includes property-card backup, search index, parent-join audit, and release packaging
- Purple map fill uses book-fully-exempt only; public-owner heuristics stay in cohort colors with panel warnings
- Homestead map markers render as ★ symbols
- Tile build reads baked valuation fields only (no percentile recompute)
- PMTiles conversion resolves binary cross-platform via `PMTILES_BIN` / PATH / `tools/pmtiles-bin/`

### Fixed (launch readiness G0–G2)

- Production TypeScript build (`RobbinstonMergedRecord` missing `taxAmount` / `taxAcreage`)
- Parcel API returns 503 when runtime data is missing instead of silent empty results

- Over-join that painted BAILEY (and similar) onto sibling `003-001-*` parcels via parent map-lot keys
- Basemap drew road lines without street-name labels despite OSM `name` in tiles

## [0.1.0] - 2026-08-20

### Added

- Project scaffold copied from Washington County Atlas and retargeted to Calais, Maine
- Calais-only npm scripts (`phase:b`, `phase:c`, `phase:calais`)
- Product identity: Calais Atlas

### Notes

- Phase A identity only. Basemap clip, place search, tax join, and valuation choropleth are later gates.
- GitHub: https://github.com/downeasternman/CalaisAtlas
- Local path: `C:\Users\mclancy\CalaisAtlas`
