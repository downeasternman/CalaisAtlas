/**
 * Build deterministic UT observations from F2–F5 artifacts. No LLM.
 */
import path from "node:path";
import { buildObservations } from "@/lib/analytics/observations";
import type { ParcelFeature } from "@/lib/analytics/features";
import type { GraphEdge, OwnerEntity } from "@/lib/analytics/ownership";
import type { ParcelValuationScore } from "@/lib/analytics/peers";
import type { ParcelSpatialFeature, SpatialNeighborRow } from "@/lib/analytics/spatial";
import type { ParcelSnapshot, TaxRecordSnapshot } from "@/lib/analytics/types";
import { loadOrganizedTownsManifest } from "@/lib/tax/organized-municipalities";
import { MANIFEST_DIR, ensureDirs, readJson, writeJson } from "../paths";
import {
  ANALYTICS_DIR,
  UT_OBSERVATIONS_JSON,
  UT_OWNER_ENTITIES_JSON,
  UT_OWNERSHIP_GRAPH_JSON,
  UT_PARCEL_FEATURES_JSON,
  UT_PARCEL_SNAPSHOTS_JSON,
  UT_PARCEL_SPATIAL_JSON,
  UT_SPATIAL_NEIGHBORS_JSON,
  UT_TAX_RECORD_SNAPSHOTS_JSON,
  UT_VALUATION_SCORES_JSON,
} from "./paths";

async function main() {
  await ensureDirs(ANALYTICS_DIR, MANIFEST_DIR);

  const [
    snapshots,
    features,
    scores,
    spatial,
    neighbors,
    entities,
    graph,
    taxRecordSnapshots,
    organized,
  ] = await Promise.all([
    readJson<ParcelSnapshot[]>(UT_PARCEL_SNAPSHOTS_JSON),
    readJson<ParcelFeature[]>(UT_PARCEL_FEATURES_JSON),
    readJson<ParcelValuationScore[]>(UT_VALUATION_SCORES_JSON),
    readJson<ParcelSpatialFeature[]>(UT_PARCEL_SPATIAL_JSON),
    readJson<SpatialNeighborRow[]>(UT_SPATIAL_NEIGHBORS_JSON),
    readJson<OwnerEntity[]>(UT_OWNER_ENTITIES_JSON),
    readJson<{ edges: GraphEdge[] }>(UT_OWNERSHIP_GRAPH_JSON),
    readJson<TaxRecordSnapshot[]>(UT_TAX_RECORD_SNAPSHOTS_JSON),
    loadOrganizedTownsManifest(),
  ]);

  const observations = buildObservations({
    runId: "ut-obs-2025",
    taxYear: 2025,
    createdAt: new Date().toISOString(),
    gitSha: process.env.GIT_SHA ?? null,
    snapshots,
    features,
    scores,
    spatial,
    neighbors,
    entities,
    graphEdges: graph.edges,
    taxRecordSnapshots,
    organizedMunicipalityIds: organized.towns.map((t) => t.id),
  });

  const byType: Record<string, number> = {};
  for (const o of observations) {
    byType[o.observationType] = (byType[o.observationType] ?? 0) + 1;
  }

  await writeJson(UT_OBSERVATIONS_JSON, observations);
  await writeJson(path.join(MANIFEST_DIR, "ut-observation-catalogue.json"), {
    generatedAt: new Date().toISOString(),
    taxYear: 2025,
    count: observations.length,
    byType,
    note: "Deterministic combination scans. Not findings of error or wrongdoing. Unjoined plat gaps are data-quality classes.",
    catalogue: observations.map((o) => ({
      id: o.id,
      observationType: o.observationType,
      unit: o.unit,
      scope: o.scope,
      priority: o.priority,
      parcelCount: o.parcelIds.length,
      ownerIds: o.ownerIds,
      hypothesis: o.hypotheses[0]?.text ?? null,
    })),
  });

  console.log(`  observations: ${observations.length}`);
  for (const [type, n] of Object.entries(byType).sort()) {
    console.log(`    ${type}: ${n}`);
  }
  console.log(`  wrote ${UT_OBSERVATIONS_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
