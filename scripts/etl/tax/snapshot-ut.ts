/**
 * Freeze UT joined parcels and tax records (including unjoined tax) as dated snapshots.
 */
import path from "node:path";
import { buildUtSnapshots } from "@/lib/analytics/snapshots";
import { MANIFEST_DIR, ensureDirs, readJson, writeJson } from "../paths";
import {
  ANALYTICS_DIR,
  TAX_SOURCES_MANIFEST,
  UT_ANALYTICS_RUNS_JSON,
  UT_BATCHES_JSON,
  UT_PARCEL_SNAPSHOTS_JSON,
  UT_PARCELS_JOINED_JSON,
  UT_TAX_RECORD_SNAPSHOTS_JSON,
  UT_TAX_RECORDS_JSON,
} from "./paths";

type SourcesManifest = {
  sources: Array<{ id: string; asOfDate?: string | null }>;
};

type TaxSourcesManifest = {
  ut: Array<{ id: string; asOfDate?: string | null }>;
};

async function sourceAsOf(id: string, fallback: string): Promise<string> {
  try {
    const sources = await readJson<SourcesManifest>(
      path.join(MANIFEST_DIR, "sources.json"),
    );
    const hit = sources.sources.find((s) => s.id === id);
    if (hit?.asOfDate) return hit.asOfDate;
  } catch {
    // fall through
  }
  try {
    const taxSources = await readJson<TaxSourcesManifest>(TAX_SOURCES_MANIFEST);
    const hit = taxSources.ut.find((s) => s.id === id);
    if (hit?.asOfDate) return hit.asOfDate;
  } catch {
    // fall through
  }
  return fallback;
}

async function main() {
  await ensureDirs(ANALYTICS_DIR);

  const parcels = await readJson<Parameters<typeof buildUtSnapshots>[0]["parcels"]>(
    UT_PARCELS_JOINED_JSON,
  );
  const taxRecords = await readJson<
    Parameters<typeof buildUtSnapshots>[0]["taxRecords"]
  >(UT_TAX_RECORDS_JSON);
  const batches = await readJson<Array<{ id: string; asOfDate?: string }>>(UT_BATCHES_JSON);

  const geometryAsOf = await sourceAsOf("mrs-ut-parcels", "2026-07-26");
  const valuationAsOf = await sourceAsOf("mrs-ut-valuation-2025", "2025-01-01");
  const taxYear = 2025;
  const createdAt = new Date().toISOString();
  const runId = `ut-snap-${taxYear}-${geometryAsOf}`;

  const { run, parcelSnapshots, taxRecordSnapshots } = buildUtSnapshots({
    runId,
    taxYear,
    geometryAsOf,
    valuationAsOf,
    geometrySourceId: "mrs-ut-parcels",
    taxSourceId: "mrs-ut-valuation-2025",
    ingestBatchId: batches[0]?.id ?? null,
    createdAt,
    parcels,
    taxRecords,
  });

  await writeJson(UT_PARCEL_SNAPSHOTS_JSON, parcelSnapshots);
  await writeJson(UT_TAX_RECORD_SNAPSHOTS_JSON, taxRecordSnapshots);

  let runs: typeof run[] = [];
  try {
    runs = await readJson<typeof run[]>(UT_ANALYTICS_RUNS_JSON);
  } catch {
    runs = [];
  }
  runs = [run, ...runs.filter((existing) => existing.id !== run.id)];
  await writeJson(UT_ANALYTICS_RUNS_JSON, runs);

  console.log(`  run ${run.id}`);
  console.log(`  parcel snapshots: ${run.stats.parcelSnapshots}`);
  console.log(
    `  tax snapshots:    ${run.stats.taxRecordSnapshots} (${run.stats.taxRecordsUnjoined} unjoined)`,
  );
  console.log(`  wrote ${UT_PARCEL_SNAPSHOTS_JSON}`);
  console.log(`  wrote ${UT_TAX_RECORD_SNAPSHOTS_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
