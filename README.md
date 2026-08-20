# Calais Atlas

An interactive geographic atlas for **Calais, Maine** — combining public parcel geometry and the city assessing commitment book into a single map for exploration and research.

> **Working title.** Branding is provisional and will change.

**Repository:** [downeasternman/CalaisAtlas](https://github.com/downeasternman/CalaisAtlas)

**Current version:** `0.1.0` — see [CHANGELOG.md](./CHANGELOG.md)

## What this is

A hybrid atlas and parcel research tool for the City of Calais. Explore the city on a full-bleed map, then inspect ownership and tax attributes where public data is available. Place-name search is the primary jump path.

Parcel fills are colored by how **assessed total value** ranks among other Calais parcels with a parsed assessment: **lowest blue, highest red**. Parcels without a valid assessed total stay gray.

## Data policy

- Only **publicly obtainable, no-cost** sources are used.
- Every dataset displays **source name** and **as-of date**.
- Parcel geometry: Maine GeoLibrary organized parcels (Calais / GEOCODE `29070`).
- Tax/ownership: City of Calais 2025-26 Real Estate Tax Commitment PDF.
- Parsed tax values are never invented — null on parse or join failure.
- Percentile ranks are computed only among parcels with a valid assessed total.

## Development gates

Work proceeds in gated phases. Each phase stops for review before the next.

| Phase | Scope | Status |
|-------|--------|--------|
| **A** | Scaffold — identity, Calais-only scripts, new repo | Complete |
| **B** | Calais boundary & basemap tiles | Complete |
| **C** | Place-name search (Calais-only; no municipality filter) | Planned |
| **D** | Calais geometry + commitment join | Planned |
| **E** | Assessed-total percentile choropleth, legend, tests | Planned |

## Stack (v1)

- Next.js (App Router) + TypeScript + React
- Tailwind CSS v4
- MapLibre GL v5 + react-map-gl
- PMTiles for vector tiles
- PostgreSQL + PostGIS + Drizzle ORM (schema stubs; file-backed data in early phases)
- pnpm

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 16 + PostGIS 3 (optional in early phases)

### Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:e2e` | Run end-to-end tests (Playwright) |
| `pnpm phase:b` | Calais boundaries + OSM + basemap tiles |
| `pnpm phase:c` | Normalize place-name search index |
| `pnpm phase:calais` | Calais commitment PDF → join → merge → parcel tiles |

## Out of scope for v1

- Ownership/deed history timelines
- Multi-parcel comparison
- Other Washington County towns or Unorganized Territory
- Value-per-acre map coloring
- User accounts or paywalls
- Print/PDF export
- Final product branding

## License

TBD.
