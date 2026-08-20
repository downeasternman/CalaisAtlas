/**
 * Score UT parcels against township, acreage-band, and kNN peers; write residual catalogue.
 */
import { polygonCentroid } from "@/lib/analytics/centroid";
import { buildValuationCatalogue } from "@/lib/analytics/catalogue";
import type { ParcelFeature } from "@/lib/analytics/features";
import { buildValuationScores, type PeerParcelInput } from "@/lib/analytics/peers";
import type { ParcelSnapshot } from "@/lib/analytics/types";
import { MANIFEST_DIR, ensureDirs, readJson, writeJson } from "../paths";
import {
  ANALYTICS_DIR,
  UT_PARCEL_FEATURES_JSON,
  UT_PARCEL_SNAPSHOTS_JSON,
  UT_PARCELS_GEOJSON,
  UT_VALUATION_CATALOGUE_JSON,
  UT_VALUATION_SCORES_JSON,
} from "./paths";
import path from "node:path";

async function main() {
  await ensureDirs(ANALYTICS_DIR, MANIFEST_DIR);

  const features = await readJson<ParcelFeature[]>(UT_PARCEL_FEATURES_JSON);
  const snapshots = await readJson<ParcelSnapshot[]>(UT_PARCEL_SNAPSHOTS_JSON);
  const geo = await readJson<GeoJSON.FeatureCollection>(UT_PARCELS_GEOJSON);

  const muniByParcel = new Map(
    snapshots.map((s) => [s.parcelId, s.municipalityId] as const),
  );
  const centroidByParcel = new Map(
    geo.features.map((f) => {
      const id = String(f.properties?.id ?? "");
      return [id, polygonCentroid(f.geometry)] as const;
    }),
  );

  const inputs: PeerParcelInput[] = features.map((feature) => ({
    feature,
    municipalityId: muniByParcel.get(feature.parcelId) ?? null,
    centroid: centroidByParcel.get(feature.parcelId) ?? null,
  }));

  const missingCentroid = inputs.filter((i) => i.centroid == null).length;
  const scores = buildValuationScores(inputs);
  const catalogue = buildValuationCatalogue(scores);
  const scored = scores.filter((s) => s.scored).length;
  const skippedCopied = scores.filter((s) => s.skipReason === "copied_full_assessment").length;
  const skippedUnjoined = scores.filter((s) => s.skipReason === "unjoined").length;

  await writeJson(UT_VALUATION_SCORES_JSON, scores);
  await writeJson(UT_VALUATION_CATALOGUE_JSON, {
    generatedAt: new Date().toISOString(),
    taxYear: 2025,
    scoredParcels: scored,
    skipped: scores.length - scored,
    ...catalogue,
  });
  await writeJson(path.join(MANIFEST_DIR, "ut-valuation-catalogue.json"), {
    generatedAt: new Date().toISOString(),
    taxYear: 2025,
    scoredParcels: scored,
    skipped: scores.length - scored,
    highCount: catalogue.highTaxableResidual.length,
    lowCount: catalogue.lowTaxableResidual.length,
    highTaxableResidual: catalogue.highTaxableResidual,
    lowTaxableResidual: catalogue.lowTaxableResidual,
  });

  console.log(`  valuation scores: ${scores.length} (${scored} scored)`);
  console.log(`  skipped unjoined: ${skippedUnjoined}`);
  console.log(`  skipped copied:   ${skippedCopied}`);
  console.log(`  missing centroid: ${missingCentroid}`);
  console.log(`  catalogue high:   ${catalogue.highTaxableResidual.length}`);
  console.log(`  catalogue low:    ${catalogue.lowTaxableResidual.length}`);
  console.log(`  wrote ${UT_VALUATION_SCORES_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
