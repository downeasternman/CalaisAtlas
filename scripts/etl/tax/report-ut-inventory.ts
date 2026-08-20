/**
 * Write a checked-in UT inventory report from processed join artifacts.
 */
import path from "node:path";
import { decodeTpl } from "@/lib/tax/tpl-decode";
import { MANIFEST_DIR, readJson, writeJson } from "../paths";
import {
  UT_MAP_LOT_INDEX_JSON,
  UT_PARCELS_GEOJSON,
  UT_PARCELS_JOINED_JSON,
  UT_TAX_RECORDS_JSON,
} from "./paths";

type Joined = {
  id: string;
  municipalityId: string;
  ownerName: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  taxAcreage: string | null;
  gisAcreage: string | null;
  acreageDiscrepancy: boolean | null;
  accountNumber: string | null;
  taxAmount: string | null;
  percentOwnership: string | null;
  tpl: string | null;
  joinMethod: string | null;
  propertyId: string | null;
  attrsRaw: Record<string, unknown> | null;
};

function present(v: unknown) {
  return v != null && v !== "";
}

function tplFamily(tpl: string | null) {
  return decodeTpl(tpl, null)?.family ?? "unknown";
}

async function main() {
  const joined = await readJson<Joined[]>(UT_PARCELS_JOINED_JSON);
  const tax = await readJson<Array<{ id: string; geomParcelId: string | null }>>(
    UT_TAX_RECORDS_JSON,
  );
  const geo = await readJson<GeoJSON.FeatureCollection>(UT_PARCELS_GEOJSON);
  const index = await readJson<{ rowCount?: number; asOfDate?: string }>(
    UT_MAP_LOT_INDEX_JSON,
  );

  const families: Record<string, { total: number; joined: number }> = {};
  let withOwner = 0;
  let withTax = 0;
  let discrepancy = 0;
  let exemption = 0;
  let multiLot = 0;
  const geomIds = new Set<string>();
  let dupGeom = 0;

  for (const f of geo.features) {
    const id = String(f.properties?.id ?? "");
    if (geomIds.has(id)) dupGeom++;
    geomIds.add(id);
  }

  for (const p of joined) {
    const fam = tplFamily(p.tpl);
    families[fam] = families[fam] ?? { total: 0, joined: 0 };
    families[fam].total++;
    if (p.joinMethod && p.joinMethod !== "unjoined") families[fam].joined++;
    if (present(p.ownerName)) withOwner++;
    if (present(p.assessedTotalValue)) withTax++;
    if (p.acreageDiscrepancy) discrepancy++;
    if (present(p.assessedExemptionValue)) exemption++;
    if (Number(p.attrsRaw?.lotCountInGroup) > 1) multiLot++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    taxYear: 2025,
    sources: {
      geometry: "mrs-ut-parcels",
      valuation: "mrs-ut-valuation-2025",
      mapLotIndex: "mrs-ut-map-lot-index-2024",
      indexAsOf: index.asOfDate ?? null,
    },
    counts: {
      geometryFeatures: geo.features.length,
      uniqueGeometryIds: geomIds.size,
      duplicateGeometryIdExtras: dupGeom,
      joinedParcelRows: joined.length,
      taxRecords: tax.length,
      taxRecordsWithGeomParcelId: tax.filter((r) => r.geomParcelId).length,
      indexRows: index.rowCount ?? null,
      withOwner,
      withAssessedTotal: withTax,
      unjoined: joined.length - withTax,
      acreageDiscrepancies: discrepancy,
      withExemption: exemption,
      multiLotCopiedAssessmentRows: multiLot,
    },
    joinByTplFamily: families,
  };

  const outPath = path.join(MANIFEST_DIR, "ut-inventory.json");
  await writeJson(outPath, report);

  console.log("\n=== UT inventory (F0) ===");
  console.log(`  geometry features:     ${report.counts.geometryFeatures}`);
  console.log(`  unique geometry ids:   ${report.counts.uniqueGeometryIds}`);
  console.log(`  tax records:           ${report.counts.taxRecords}`);
  console.log(`  parcels with tax:      ${report.counts.withAssessedTotal}`);
  console.log(`  acreage discrepancies: ${report.counts.acreageDiscrepancies}`);
  console.log(`  multi-lot copied rows: ${report.counts.multiLotCopiedAssessmentRows}`);
  console.log(`  wrote ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
