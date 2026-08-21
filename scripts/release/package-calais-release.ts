import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, PROCESSED_DIR, TILES_DIR } from "../etl/paths";

type ReleaseManifest = {
  releaseId: string;
  generatedAt: string;
  parcelCount: number;
  withOwner: number;
  withAssessment: number;
  ranked: number;
  cardBackups: number;
  searchIndexCount: number;
  checksums: Record<string, string>;
  sourceDates: {
    commitment: string | null;
    propertyCards: string | null;
    geometry: string | null;
  };
};

async function sha256(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function main() {
  const parcelsPath = path.join(PROCESSED_DIR, "parcels.json");
  const searchPath = path.join(PROCESSED_DIR, "parcel-search.json");
  const placesPath = path.join(PROCESSED_DIR, "places.json");
  const taxSourcesPath = path.join(ROOT, "data", "manifest", "tax-sources.json");

  const parcels = JSON.parse(await readFile(parcelsPath, "utf8")) as Array<Record<string, unknown>>;
  const searchIndex = JSON.parse(await readFile(searchPath, "utf8")) as unknown[];

  const commitment = JSON.parse(await readFile(taxSourcesPath, "utf8")) as {
    organized?: Array<{ id: string; asOfDate?: string }>;
  };
  const commitmentSource = commitment.organized?.find((s) => s.id.includes("commitment"));
  const cardSource = commitment.organized?.find((s) => s.id.includes("property-cards"));

  const releaseId = `calais-${new Date().toISOString().slice(0, 10)}`;
  const manifest: ReleaseManifest = {
    releaseId,
    generatedAt: new Date().toISOString(),
    parcelCount: parcels.length,
    withOwner: parcels.filter((p) => p.ownerName).length,
    withAssessment: parcels.filter((p) => p.assessedTotalValue).length,
    ranked: parcels.filter((p) => typeof p.valuePct === "number" && (p.valuePct as number) >= 0)
      .length,
    cardBackups: parcels.filter((p) => p.joinMethod === "property_card").length,
    searchIndexCount: searchIndex.length,
    checksums: {
      parcels: await sha256(parcelsPath),
      parcelSearch: await sha256(searchPath),
      places: await sha256(placesPath),
      parcelsTiles: await sha256(path.join(TILES_DIR, "parcels.pmtiles")),
    },
    sourceDates: {
      commitment: commitmentSource?.asOfDate ?? null,
      propertyCards: cardSource?.asOfDate ?? null,
      geometry: null,
    },
  };

  const outPath = path.join(ROOT, "data", "manifest", "release.json");
  await writeFile(outPath, JSON.stringify(manifest, null, 2));
  console.log(`  wrote ${outPath} (${manifest.releaseId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
