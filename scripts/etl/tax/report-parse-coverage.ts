/**
 * Print UT tax parse + join coverage report for Gate D1 review.
 */
import path from "node:path";
import { readJson } from "../paths";
import {
  PARCELS_JSON,
  UT_BATCHES_JSON,
  UT_MAP_LOT_INDEX_JSON,
  UT_TAX_RECORDS_JSON,
} from "./paths";

async function main() {
  const parcels = await readJson<
    Array<{
      municipalityId: string;
      taxMunicipalityId: string | null;
      tpl: string | null;
      ownerName: string | null;
      assessedTotalValue: string | null;
      joinConfidence: number | null;
      joinMethod: string | null;
    }>
  >(PARCELS_JSON);
  const taxRecords = await readJson<unknown[]>(UT_TAX_RECORDS_JSON);
  const batches = await readJson<
    Array<{ id: string; stats: Record<string, unknown>; asOfDate?: string }>
  >(UT_BATCHES_JSON);
  const indexFile = await readJson<{ rowCount: number }>(UT_MAP_LOT_INDEX_JSON);

  const withOwner = parcels.filter((p) => p.ownerName);
  const withTax = parcels.filter((p) => p.assessedTotalValue);
  const avgJoin =
    withTax.length > 0
      ? withTax.reduce((s, p) => s + (p.joinConfidence ?? 0), 0) / withTax.length
      : null;

  const byMuni = new Map<string, { total: number; tax: number }>();
  const byTaxMuni = new Map<string, { total: number; tax: number }>();
  const joinMethods = new Map<string, number>();

  for (const p of parcels) {
    const cur = byMuni.get(p.municipalityId) ?? { total: 0, tax: 0 };
    cur.total++;
    if (p.assessedTotalValue) cur.tax++;
    byMuni.set(p.municipalityId, cur);

    if (p.taxMunicipalityId) {
      const tcur = byTaxMuni.get(p.taxMunicipalityId) ?? { total: 0, tax: 0 };
      tcur.total++;
      if (p.assessedTotalValue) tcur.tax++;
      byTaxMuni.set(p.taxMunicipalityId, tcur);
    }

    const method = p.joinMethod ?? "unjoined";
    joinMethods.set(method, (joinMethods.get(method) ?? 0) + 1);
  }

  const baringGeom = parcels.filter((p) => p.municipalityId === "baring-plt");
  const baringWap = baringGeom.filter((p) => p.tpl?.toUpperCase().startsWith("WAP"));
  const baringTaxMail = parcels.filter(
    (p) => p.taxMunicipalityId === "baring-plt" && p.assessedTotalValue,
  );

  console.log("\n=== Washington County UT — Parse & Join Report ===\n");
  console.log(`Parcels (geometry):     ${parcels.length}`);
  console.log(`Tax records (parsed):   ${taxRecords.length}`);
  console.log(`Map/Lot index rows:     ${indexFile.rowCount}`);
  console.log(`Parcels with owner:     ${withOwner.length}`);
  console.log(`Parcels with tax value: ${withTax.length}`);
  console.log(
    `Join rate (tax/geom):   ${parcels.length ? ((withTax.length / parcels.length) * 100).toFixed(1) : 0}%`,
  );
  if (avgJoin != null) {
    console.log(`Avg join confidence:    ${(avgJoin * 100).toFixed(1)}%`);
  }
  if (batches[0]) {
    console.log(`\nBatch: ${batches[0].id}`);
    console.log(`  stats: ${JSON.stringify(batches[0].stats)}`);
  }

  console.log("\nJoin methods:");
  for (const [method, count] of [...joinMethods.entries()].sort()) {
    console.log(`  ${method}: ${count}`);
  }

  console.log("\nBaring Plt:");
  console.log(`  geometry parcels: ${baringGeom.length} (${baringWap.length} WAP)`);
  console.log(`  geometry with tax: ${baringGeom.filter((p) => p.assessedTotalValue).length}`);
  console.log(`  tax-linked with Baring mail/jurisdiction: ${baringTaxMail.length}`);

  console.log("\nPer-municipality (geometry):");
  const sorted = [...byMuni.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [id, stats] of sorted) {
    const rate = stats.total ? ((stats.tax / stats.total) * 100).toFixed(0) : "0";
    console.log(`  ${id}: ${stats.tax}/${stats.total} with tax (${rate}%)`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
