/**
 * Build tests/fixtures/runtime from local full ETL output (run once on maintainer machine).
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Parcel } from "@/lib/types/parcel";
import { buildParcelSearchIndex } from "@/lib/search/parcel-rank";
import { ROOT, PROCESSED_DIR } from "../etl/paths";

const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "runtime");
const TILES_DIR = path.join(ROOT, "public", "tiles");
const TILES_FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "tiles");

function pickRepresentative(parcels: Parcel[]): Parcel[] {
  const picked = new Map<string, Parcel>();

  const tryPick = (label: string, predicate: (p: Parcel) => boolean) => {
    if (picked.has(label)) return;
    const match = parcels.find(predicate);
    if (match) picked.set(label, match);
  };

  tryPick("ranked-improved", (p) => p.valuePct != null && p.valuePct >= 0 && p.cohort === 1);
  tryPick("ranked-unimproved", (p) => p.valuePct != null && p.valuePct >= 0 && p.cohort === 0);
  tryPick("book-exempt", (p) => p.fullyExempt === true && p.assessedTotalValue != null);
  tryPick("public-owner", (p) =>
    Boolean(p.ownerName?.match(/STATE OF MAINE|CITY OF CALAIS|UNITED STATES/i)) &&
      p.fullyExempt !== true &&
      p.valuePct != null &&
      p.valuePct >= 0,
  );
  tryPick("gray-unranked", (p) => (p.valuePct == null || p.valuePct < 0) && !p.fullyExempt);
  tryPick("property-card", (p) => p.joinMethod === "property_card");
  tryPick("parent-join", (p) => p.joinMethod === "map_lot_parent");
  tryPick("homestead", (p) => p.homestead === true);
  tryPick("acreage-discrepancy", (p) => p.acreageDiscrepancy === true);
  tryPick("searchable-owner", (p) => Boolean(p.ownerName && p.ownerName.length > 5));
  tryPick("searchable-maplot", (p) => Boolean(p.mapLot && p.ownerName));

  const unitedStates = parcels.find((p) => p.id === "org-calais-29070-037-256");
  if (unitedStates) picked.set("e2e-united-states", unitedStates);

  for (const p of parcels) {
    if (picked.size >= 25) break;
    if (![...picked.values()].some((x) => x.id === p.id)) {
      picked.set(p.id, p);
    }
  }

  return [...picked.values()];
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function main() {
  const parcelsPath = path.join(PROCESSED_DIR, "parcels.json");
  const placesPath = path.join(PROCESSED_DIR, "places.json");
  const municipalitiesPath = path.join(PROCESSED_DIR, "municipalities.json");

  const allParcels = await readJson<Parcel[]>(parcelsPath);
  const subset = pickRepresentative(allParcels);
  const places = await readJson<unknown[]>(placesPath).catch(() => []);
  const municipalities = await readJson<unknown[]>(municipalitiesPath).catch(() => []);

  await mkdir(FIXTURE_DIR, { recursive: true });
  await mkdir(TILES_FIXTURE_DIR, { recursive: true });

  await writeFile(
    path.join(FIXTURE_DIR, "parcels.json"),
    JSON.stringify(subset, null, 2),
  );
  await writeFile(path.join(FIXTURE_DIR, "places.json"), JSON.stringify(places, null, 2));
  await writeFile(
    path.join(FIXTURE_DIR, "municipalities.json"),
    JSON.stringify(municipalities, null, 2),
  );

  const searchIndex = buildParcelSearchIndex(subset);
  await writeFile(
    path.join(FIXTURE_DIR, "parcel-search.json"),
    JSON.stringify(searchIndex, null, 2),
  );

  const release = {
    releaseId: "fixture-dev",
    generatedAt: new Date().toISOString(),
    parcelCount: subset.length,
    withOwner: subset.filter((p) => p.ownerName).length,
    withAssessment: subset.filter((p) => p.assessedTotalValue).length,
    ranked: subset.filter((p) => p.valuePct != null && p.valuePct >= 0).length,
    cardBackups: subset.filter((p) => p.joinMethod === "property_card").length,
    sourceDates: {
      commitment: "2025-26",
      propertyCards: "2023",
      geometry: null,
    },
  };
  await writeFile(
    path.join(FIXTURE_DIR, "release.json"),
    JSON.stringify(release, null, 2),
  );

  for (const tile of ["basemap.pmtiles", "boundaries.pmtiles", "parcels.pmtiles"] as const) {
    const src = path.join(TILES_DIR, tile);
    try {
      await copyFile(src, path.join(TILES_FIXTURE_DIR, tile));
      console.log(`  copied tile ${tile}`);
    } catch {
      console.warn(`  skipped missing tile ${tile}`);
    }
  }

  console.log(`Wrote ${subset.length} fixture parcels to ${FIXTURE_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
