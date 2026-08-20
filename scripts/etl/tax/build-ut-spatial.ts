/**
 * Project UT parcels to EPSG:26919; write area/perimeter/compactness, touches, kNN, and spatial lag.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ParcelFeature } from "@/lib/analytics/features";
import {
  buildSpatialLayer,
  type ParcelSpatialFeature,
  type SpatialParcelInput,
} from "@/lib/analytics/spatial";
import { MANIFEST_DIR, ensureDirs, readJson, writeJson } from "../paths";
import {
  ANALYTICS_DIR,
  UT_PARCEL_FEATURES_JSON,
  UT_PARCELS_GEOJSON,
  UT_PARCEL_SPATIAL_JSON,
  UT_SPATIAL_NEIGHBORS_JSON,
} from "./paths";

const ISOLATION_TOP_N = 25;

async function main() {
  await ensureDirs(ANALYTICS_DIR, MANIFEST_DIR);

  const features = await readJson<ParcelFeature[]>(UT_PARCEL_FEATURES_JSON);
  const geo = await readJson<GeoJSON.FeatureCollection>(UT_PARCELS_GEOJSON);
  const featureById = new Map(features.map((f) => [f.parcelId, f] as const));

  const inputs: SpatialParcelInput[] = geo.features.map((f) => {
    const parcelId = String(f.properties?.id ?? "");
    return {
      parcelId,
      geometry: f.geometry,
      feature: featureById.get(parcelId) ?? null,
    };
  });

  const layer = buildSpatialLayer(inputs);
  const withGeom = layer.features.filter((f) => f.areaM2 != null);
  const withTouch = layer.features.filter((f) => f.touchCount > 0).length;
  const isolated = [...layer.features]
    .filter((f) => f.nnDistanceM != null)
    .sort((a, b) => (b.nnDistanceM ?? 0) - (a.nnDistanceM ?? 0))
    .slice(0, ISOLATION_TOP_N)
    .map((f) => ({
      parcelId: f.parcelId,
      nnDistanceM: f.nnDistanceM,
      touchCount: f.touchCount,
      compactness: f.compactness,
      lagSkipReason: f.lagSkipReason,
    }));

  await writeJson(UT_PARCEL_SPATIAL_JSON, layer.features);
  await writeFile(UT_SPATIAL_NEIGHBORS_JSON, JSON.stringify(layer.neighbors), "utf8");
  await writeJson(path.join(MANIFEST_DIR, "ut-spatial-summary.json"), {
    generatedAt: new Date().toISOString(),
    crs: "EPSG:26919",
    snapM: 2,
    knnK: 25,
    parcels: layer.features.length,
    withGeometry: withGeom.length,
    withTouches: withTouch,
    neighborRows: layer.neighbors.length,
    knnRows: layer.neighbors.filter((n) => n.kind === "knn").length,
    touchRows: layer.neighbors.filter((n) => n.kind === "touch").length,
    lagTaxableKnnSet: layer.features.filter((f) => f.lagTaxableKnn != null).length,
    lagResidualKnnSet: layer.features.filter((f) => f.lagResidualTaxableKnn != null).length,
    unjoinedNotScoredAsColdSpots: layer.features.filter((f) => f.lagSkipReason === "unjoined")
      .length,
    mostIsolated: isolated,
  });

  const compact = compactnessStats(withGeom);
  console.log(`  spatial parcels:    ${layer.features.length} (${withGeom.length} with geometry)`);
  console.log(`  with touches:       ${withTouch}`);
  console.log(`  neighbor rows:      ${layer.neighbors.length}`);
  console.log(`  lag residual set:   ${layer.features.filter((f) => f.lagResidualTaxableKnn != null).length}`);
  console.log(`  compactness median: ${compact}`);
  console.log(`  wrote ${UT_PARCEL_SPATIAL_JSON}`);
}

function compactnessStats(rows: ParcelSpatialFeature[]): string {
  const values = rows
    .map((r) => r.compactness)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (values.length === 0) return "n/a";
  const mid = values[Math.floor(values.length / 2)]!;
  return mid.toFixed(3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
