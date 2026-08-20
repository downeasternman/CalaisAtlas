/**
 * Build cite-only investigator packets and hypothesis JSON from F6 observations. No new statistics.
 */
import path from "node:path";
import type { ParcelFeature } from "@/lib/analytics/features";
import {
  buildInvestigatorPacket,
  citeOnlyInvestigate,
  validateHypothesis,
} from "@/lib/analytics/investigator";
import type { Observation } from "@/lib/analytics/observations";
import type { OwnerEntity } from "@/lib/analytics/ownership";
import type { ParcelSnapshot } from "@/lib/analytics/types";
import { MANIFEST_DIR, ensureDirs, readJson, writeJson } from "../paths";
import {
  ANALYTICS_DIR,
  UT_INVESTIGATOR_HYPOTHESES_JSON,
  UT_INVESTIGATOR_PACKETS_JSON,
  UT_OBSERVATIONS_JSON,
  UT_OWNER_ENTITIES_JSON,
  UT_PARCEL_FEATURES_JSON,
  UT_PARCEL_SNAPSHOTS_JSON,
} from "./paths";

async function main() {
  await ensureDirs(ANALYTICS_DIR, MANIFEST_DIR);

  const observations = await readJson<Observation[]>(UT_OBSERVATIONS_JSON);
  const snapshots = await readJson<ParcelSnapshot[]>(UT_PARCEL_SNAPSHOTS_JSON);
  const features = await readJson<ParcelFeature[]>(UT_PARCEL_FEATURES_JSON);
  const entities = await readJson<OwnerEntity[]>(UT_OWNER_ENTITIES_JSON);

  const ctx = { snapshots, features, entities, graphEdges: [] };
  const packets = observations.map((o) => buildInvestigatorPacket(o, ctx));
  const hypotheses = packets.map((packet) => {
    const hypothesis = citeOnlyInvestigate(packet);
    const check = validateHypothesis(packet, hypothesis);
    if (!check.ok) {
      throw new Error(`Hypothesis failed cite-only validation for ${hypothesis.observationId}: ${check.errors.join("; ")}`);
    }
    return hypothesis;
  });

  const byClass: Record<string, number> = {};
  for (const h of hypotheses) {
    byClass[h.classification] = (byClass[h.classification] ?? 0) + 1;
  }

  await writeJson(UT_INVESTIGATOR_PACKETS_JSON, packets);
  await writeJson(UT_INVESTIGATOR_HYPOTHESES_JSON, hypotheses);
  await writeJson(path.join(MANIFEST_DIR, "ut-investigator-summary.json"), {
    generatedAt: new Date().toISOString(),
    taxYear: 2025,
    packets: packets.length,
    hypotheses: hypotheses.length,
    byClass,
    note: "Cite-only investigator. No new statistics. Not findings of error or wrongdoing.",
  });

  console.log(`  packets:     ${packets.length}`);
  console.log(`  hypotheses:  ${hypotheses.length}`);
  console.log(`  by class:    ${JSON.stringify(byClass)}`);
  console.log(`  wrote ${UT_INVESTIGATOR_HYPOTHESES_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
