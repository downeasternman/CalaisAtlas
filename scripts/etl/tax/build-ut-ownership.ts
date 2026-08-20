/**
 * Normalize UT owners, tag entities, build similar-name graph (no auto-merge), write concentration.
 */
import path from "node:path";
import type { ParcelFeature } from "@/lib/analytics/features";
import { buildOwnershipLayer } from "@/lib/analytics/ownership";
import type { SpatialNeighborRow } from "@/lib/analytics/spatial";
import type { ParcelSnapshot } from "@/lib/analytics/types";
import { MANIFEST_DIR, ensureDirs, readJson, writeJson } from "../paths";
import {
  ANALYTICS_DIR,
  UT_OWNER_ENTITIES_JSON,
  UT_OWNERSHIP_CLUSTERS_JSON,
  UT_OWNERSHIP_GRAPH_JSON,
  UT_PARCEL_FEATURES_JSON,
  UT_PARCEL_SNAPSHOTS_JSON,
  UT_SPATIAL_NEIGHBORS_JSON,
} from "./paths";

async function main() {
  await ensureDirs(ANALYTICS_DIR, MANIFEST_DIR);

  const snapshots = await readJson<ParcelSnapshot[]>(UT_PARCEL_SNAPSHOTS_JSON);
  const features = await readJson<ParcelFeature[]>(UT_PARCEL_FEATURES_JSON);
  const neighbors = await readJson<SpatialNeighborRow[]>(UT_SPATIAL_NEIGHBORS_JSON);

  const layer = buildOwnershipLayer({
    snapshots,
    features,
    neighbors: neighbors.map((n) => ({
      parcelId: n.parcelId,
      neighborId: n.neighborId,
      kind: n.kind,
    })),
  });

  const similar = layer.graph.edges.filter((e) => e.type === "similar_name");
  const related = layer.graph.edges.filter((e) => e.type === "possible_related");
  const utAcres = layer.concentration.filter(
    (r) => r.scope === "ut" && r.metric === "gis_acres",
  );

  await writeJson(UT_OWNER_ENTITIES_JSON, layer.entities);
  await writeJson(UT_OWNERSHIP_CLUSTERS_JSON, layer.clusters);
  await writeJson(UT_OWNERSHIP_GRAPH_JSON, layer.graph);
  await writeJson(path.join(MANIFEST_DIR, "ut-ownership-summary.json"), {
    generatedAt: new Date().toISOString(),
    taxYear: 2025,
    entities: layer.entities.length,
    clusters: layer.clusters.length,
    graphNodes: layer.graph.nodes.length,
    graphEdges: layer.graph.edges.length,
    similarNameEdges: similar.length,
    possibleRelatedEdges: related.length,
    sameEntityRule: "exact_normalized_string_only",
    utTop10GisAcres: utAcres,
    similarNameSample: similar.slice(0, 15).map((e) => ({
      source: e.source,
      target: e.target,
      score: e.score,
      evidence: e.evidence,
    })),
  });

  console.log(`  owner entities:     ${layer.entities.length}`);
  console.log(`  clusters:           ${layer.clusters.length}`);
  console.log(`  graph nodes/edges:  ${layer.graph.nodes.length} / ${layer.graph.edges.length}`);
  console.log(`  similar_name:       ${similar.length}`);
  console.log(`  possible_related:   ${related.length}`);
  console.log(`  wrote ${UT_OWNER_ENTITIES_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
