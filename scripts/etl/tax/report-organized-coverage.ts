/**
 * Report organized-town parse and join coverage.
 */
import path from "node:path";
import { getOrganizedTown, loadOrganizedTownsManifest } from "@/lib/tax/organized-municipalities";
import { isValidOwnerName, isValidMoney } from "@/lib/tax/owner-validate";
import { readJson } from "../paths";
import { parseTownArg } from "./cli";
import {
  ORGANIZED_PARCELS_GEOJSON,
  ORGANIZED_PARCELS_JOINED_JSON,
  organizedTaxRecordsJson,
} from "./paths";

type TaxRecord = {
  ownerName: string | null;
  assessedTotalValue: string | null;
  parseConfidence: number | null;
};

async function reportTown(townId: string) {
  const town = await getOrganizedTown(townId);
  if (!town) {
    throw new Error(`Unknown organized town: ${townId}`);
  }

  const geojson = await readJson<GeoJSON.FeatureCollection>(ORGANIZED_PARCELS_GEOJSON);
  const geomCount = geojson.features.filter(
    (f) => String(f.properties?.municipalityId ?? "") === townId,
  ).length;

  let taxRecords: TaxRecord[] = [];
  try {
    taxRecords = await readJson<TaxRecord[]>(organizedTaxRecordsJson(townId));
  } catch {
    taxRecords = [];
  }

  const parsedRows = taxRecords.length;
  const validOwnerRows = taxRecords.filter((r) => isValidOwnerName(r.ownerName)).length;
  const validAssessmentRows = taxRecords.filter((r) =>
    isValidMoney(r.assessedTotalValue),
  ).length;
  const badOwnerRows = taxRecords.filter(
    (r) => r.ownerName != null && !isValidOwnerName(r.ownerName),
  ).length;

  let joined = 0;
  let qualityJoin = 0;
  let ownerJoin = 0;
  let dirtyOwner = 0;
  let total = 0;
  try {
    const parcels = await readJson<
      Array<{
        municipalityId: string;
        assessedTotalValue: string | null;
        ownerName: string | null;
      }>
    >(ORGANIZED_PARCELS_JOINED_JSON);
    const townParcels = parcels.filter((p) => p.municipalityId === townId);
    total = townParcels.length;
    joined = townParcels.filter((p) => p.assessedTotalValue != null).length;
    ownerJoin = townParcels.filter((p) => isValidOwnerName(p.ownerName)).length;
    dirtyOwner = townParcels.filter(
      (p) => p.ownerName != null && !isValidOwnerName(p.ownerName),
    ).length;
    qualityJoin = townParcels.filter(
      (p) => isValidOwnerName(p.ownerName) && isValidMoney(p.assessedTotalValue),
    ).length;
  } catch {
    joined = 0;
    ownerJoin = 0;
    dirtyOwner = 0;
    qualityJoin = 0;
    total = 0;
  }

  const rate = geomCount > 0 ? (joined / geomCount) * 100 : 0;
  const ownerRate = geomCount > 0 ? (ownerJoin / geomCount) * 100 : 0;
  const qualityRate = geomCount > 0 ? (qualityJoin / geomCount) * 100 : 0;
  console.log(`\n=== ${town.name} (${townId}) ===`);
  console.log(`  Geometry parcels:       ${geomCount}`);
  console.log(`  Parsed tax rows:        ${parsedRows}`);
  console.log(`  Valid owner rows:       ${validOwnerRows}`);
  console.log(`  Valid assessment rows:  ${validAssessmentRows}`);
  console.log(`  Bad owner rows (parse): ${badOwnerRows}`);
  console.log(`  Owner joins (geometry): ${ownerJoin}`);
  console.log(`  Dirty owner rows (geom):${dirtyOwner}`);
  console.log(`  Parcels with tax:       ${joined}`);
  console.log(`  Quality joins:          ${qualityJoin}`);
  console.log(`  Owner rate:             ${ownerRate.toFixed(1)}%`);
  console.log(`  Join rate (tax/geom):   ${rate.toFixed(1)}%`);
  console.log(`  Quality rate:           ${qualityRate.toFixed(1)}%`);
}

async function main() {
  const townId = parseTownArg();
  if (townId) {
    await reportTown(townId);
    return;
  }

  const manifest = await loadOrganizedTownsManifest();
  console.log("\n=== Washington County Organized — Coverage Report ===");
  for (const town of manifest.towns) {
    await reportTown(town.id);
  }

  const geojson = await readJson<GeoJSON.FeatureCollection>(ORGANIZED_PARCELS_GEOJSON);
  const totalGeom = geojson.features.length;
  let joinedLayerCount = 0;
  let totalWithTax = 0;
  let totalWithOwner = 0;
  try {
    const parcels = await readJson<
      Array<{ assessedTotalValue: string | null; ownerName: string | null }>
    >(ORGANIZED_PARCELS_JOINED_JSON);
    joinedLayerCount = parcels.length;
    totalWithTax = parcels.filter((p) => isValidMoney(p.assessedTotalValue)).length;
    totalWithOwner = parcels.filter((p) => isValidOwnerName(p.ownerName)).length;
  } catch {
    joinedLayerCount = 0;
    totalWithTax = 0;
    totalWithOwner = 0;
  }
  const joinedTowns = manifest.towns.filter((t) => t.status === "joined").length;
  const failedTowns = manifest.towns.filter((t) => t.status === "failed").length;
  const pendingTowns = manifest.towns.filter((t) => t.status === "pending").length;
  console.log("\n=== County organized summary ===");
  console.log(`  Organized towns (manifest): ${manifest.towns.length}`);
  console.log(`  Joined / failed / pending:  ${joinedTowns} / ${failedTowns} / ${pendingTowns}`);
  console.log(`  Geometry parcels (GeoJSON): ${totalGeom}`);
  console.log(`  Joined layer parcels:       ${joinedLayerCount}`);
  console.log(`  Owner joins (joined layer): ${totalWithOwner}`);
  console.log(`  Tax joins (joined layer):   ${totalWithTax}`);
  console.log(
    `  County tax join % (tax/geom): ${totalGeom > 0 ? ((totalWithTax / totalGeom) * 100).toFixed(1) : "0.0"}%`,
  );
  console.log(`\nExcluded: ${manifest.excluded.map((e) => e.id).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
