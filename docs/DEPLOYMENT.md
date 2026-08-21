# Deployment

## Quick start (fixtures)

For local development without running the full ETL pipeline:

```bash
pnpm install
pnpm dev:bootstrap
pnpm dev
```

`dev:bootstrap` copies committed fixtures from `tests/fixtures/runtime/` into `data/processed/` and tile fixtures into `public/tiles/`.

## Full Calais data rebuild

Requires raw PDFs/geometry in `data/raw/` (gitignored):

```bash
pnpm phase:calais
```

This runs geometry download, commitment parse/join, 2023 property-card owner backup, parcel merge, search index, tiles, parent-join audit, coverage report, and release manifest packaging.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PMTILES_BIN` | Path to `pmtiles` convert binary (cross-platform tile builds) |
| `NEXT_PUBLIC_MAP_TILES_BASE` | Optional public URL base for tile hosting |

## CI

GitHub Actions runs lint, unit tests (`test:ci`), script typecheck, fixture bootstrap, and production build.

## Release artifact

`pnpm release:package` writes `data/manifest/release.json` with checksums and coverage counts. Full processed JSON and tiles remain local/gitignored unless published separately.
