/**
 * Build deterministic UT parcel features from F1 snapshots.
 */
import { buildParcelFeatures } from "@/lib/analytics/features";
import type { ParcelSnapshot } from "@/lib/analytics/types";
import { ensureDirs, readJson, writeJson } from "../paths";
import { ANALYTICS_DIR, UT_PARCEL_FEATURES_JSON, UT_PARCEL_SNAPSHOTS_JSON } from "./paths";

async function main() {
  await ensureDirs(ANALYTICS_DIR);
  const snapshots = await readJson<ParcelSnapshot[]>(UT_PARCEL_SNAPSHOTS_JSON);
  const features = buildParcelFeatures(snapshots);
  await writeJson(UT_PARCEL_FEATURES_JSON, features);

  const vacant = features.filter((f) => f.vacantFlag).length;
  const unjoined = features.filter((f) => f.unjoinedFlag).length;
  const copied = features.filter((f) => f.valuationAllocation === "copied_full_assessment").length;
  const withPerAcre = features.filter((f) => f.valuePerGisAcre != null).length;

  console.log(`  parcel features:     ${features.length}`);
  console.log(`  vacant (building 0): ${vacant}`);
  console.log(`  unjoined:            ${unjoined}`);
  console.log(`  copied multi-lot:    ${copied}`);
  console.log(`  value/gis-acre set:  ${withPerAcre}`);
  console.log(`  wrote ${UT_PARCEL_FEATURES_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
