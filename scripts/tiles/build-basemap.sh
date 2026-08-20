#!/usr/bin/env bash
# Wrapper for Node tile builder (Windows-compatible via pnpm tsx).
set -euo pipefail
cd "$(dirname "$0")/../.."
pnpm exec tsx scripts/tiles/build-basemap.ts
