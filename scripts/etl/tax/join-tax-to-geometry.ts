/**
 * Join UT tax records to MRS parcel geometry and write parcels.json + coverage.
 */
import path from "node:path";
import {
  buildTaxLookups,
  geometryMapJoinKey,
  joinUtTaxToGeometry,
  type GeometryParcelStub,
} from "@/lib/tax/join";
import { buildIndexLookups, type MapIndexRow } from "@/lib/tax/map-index-parser";
import {
  validateTaxAgainstIndex,
  type MapSheetEntry,
} from "@/lib/tax/crosswalk";
import type { ParsedUtTaxRow } from "@/lib/tax/ut-parser";
import { ensureDirs, readJson, writeJson } from "../paths";
import {
  TAX_PROCESSED_DIR,
  UT_BATCHES_JSON,
  UT_MAP_LOT_INDEX_JSON,
  UT_PARCELS_GEOJSON,
  UT_PARCELS_JOINED_JSON,
  UT_TAX_RECORDS_JSON,
} from "./paths";

type TaxRecordJson = {
  id: string;
  batchId: string;
  municipalityId: string | null;
  municipalityName: string | null;
  externalKey: string;
  mapJoinKey: string;
  propertyId: string | null;
  mailMunicipalityHint: string | null;
  ownerName: string | null;
  mapLot: string;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  taxYear: number | null;
  parseConfidence: number | null;
  assessedExemptionValue?: string | null;
  assessedPersonalPropertyValue?: string | null;
  taxAmount?: string | null;
  percentOwnership?: string | null;
  accountNumber?: string | null;
  taxAcreage?: string | null;
  acreage?: string | null;
  attrsRaw: Record<string, unknown> | null;
};

type BatchJson = {
  id: string;
  stats: Record<string, unknown>;
};

async function main() {
  await ensureDirs(TAX_PROCESSED_DIR, path.dirname(UT_PARCELS_JOINED_JSON));

  const geojson = await readJson<GeoJSON.FeatureCollection>(UT_PARCELS_GEOJSON);
  const taxRecords = await readJson<TaxRecordJson[]>(UT_TAX_RECORDS_JSON);
  const batches = await readJson<BatchJson[]>(UT_BATCHES_JSON);
  const indexFile = await readJson<{ rows: MapIndexRow[] }>(UT_MAP_LOT_INDEX_JSON);
  const mapSheetManifest = await readJson<{
    sheets: Record<string, MapSheetEntry>;
  }>(path.join(process.cwd(), "data", "manifest", "ut-map-sheets.json"));

  const indexLookups = buildIndexLookups(indexFile.rows);
  const mapSheets = mapSheetManifest.sheets;

  const geometry: GeometryParcelStub[] = geojson.features.map((f) => {
    const tpl = f.properties?.tpl != null ? String(f.properties.tpl) : null;
    const planLot = String(f.properties?.planLot ?? "");
    const { mapJoinKey, tplFamily } = geometryMapJoinKey(tpl, planLot);
    return {
      id: String(f.properties?.id ?? ""),
      municipalityId: String(f.properties?.municipalityId ?? ""),
      municipalityName: String(f.properties?.municipalityName ?? ""),
      planLot,
      tpl,
      mapJoinKey,
      tplFamily,
      acreage: f.properties?.acreage != null ? String(f.properties.acreage) : null,
      geocode: f.properties?.geocode != null ? String(f.properties.geocode) : null,
    };
  });

  const taxForJoin: Array<ParsedUtTaxRow & { id: string }> = taxRecords.map((r) => ({
    id: r.id,
    mapJoinKey: r.mapJoinKey,
    mapCode: r.mapJoinKey.split("|")[0] ?? "",
    mapLot: r.mapLot,
    municipalityName: r.municipalityName,
    divisionName: r.municipalityName,
    ownerName: r.ownerName,
    mailAddress: r.mailAddress,
    mailMunicipalityHint: r.mailMunicipalityHint,
    assessedLandValue: r.assessedLandValue,
    assessedBuildingValue: r.assessedBuildingValue,
    assessedTotalValue: r.assessedTotalValue,
    assessedExemptionValue: r.assessedExemptionValue ?? null,
    assessedPersonalPropertyValue: r.assessedPersonalPropertyValue ?? null,
    taxAmount: r.taxAmount ?? null,
    percentOwnership: r.percentOwnership ?? null,
    accountNumber: r.accountNumber ?? null,
    acreage: r.taxAcreage ?? r.acreage ?? null,
    taxYear: r.taxYear,
    propertyId: r.propertyId ?? (r.attrsRaw?.propertyId as string | undefined) ?? null,
    parseConfidence: r.parseConfidence ?? 0,
    attrsRaw: r.attrsRaw ?? {},
  }));

  const validation = validateTaxAgainstIndex(taxForJoin, indexLookups.byPropertyId);
  console.log(
    `  valuation ↔ index match: ${(validation.matchRate * 100).toFixed(1)}% (${validation.taxMatchedInIndex}/${validation.taxWithPropertyId})`,
  );

  const lookups = buildTaxLookups(taxForJoin);
  const joined = joinUtTaxToGeometry(geometry, lookups, mapSheets);

  let joinedCount = 0;
  const parcels = joined.map((p) => {
    const hasTax = p.taxRecordId != null && p.ownerName != null;
    if (hasTax) joinedCount++;
    return {
      id: p.id,
      sourceParcelId: p.sourceParcelId,
      municipalityId: p.municipalityId,
      taxMunicipalityId: p.taxMunicipalityId,
      propertyId: p.propertyId,
      ownerName: p.ownerName,
      ownerNameNormalized: p.ownerName?.toLowerCase() ?? null,
      situsAddress: null,
      mailAddress: p.mailAddress ?? null,
      assessedLandValue: p.assessedLandValue,
      assessedBuildingValue: p.assessedBuildingValue,
      assessedTotalValue: p.assessedTotalValue,
      assessedExemptionValue: p.assessedExemptionValue ?? null,
      assessedPersonalPropertyValue: p.assessedPersonalPropertyValue ?? null,
      taxAmount: p.taxAmount ?? null,
      percentOwnership: p.percentOwnership ?? null,
      hasTreeGrowth: p.hasTreeGrowth ?? false,
      taxYear: p.taxYear,
      acreage: p.gisAcreage,
      gisAcreage: p.gisAcreage,
      taxAcreage: p.taxAcreage,
      acreageDiscrepancy: p.acreageDiscrepancy,
      landUse: null,
      mapLot: p.mapLot,
      tpl: p.tpl,
      joinConfidence: p.joinConfidence,
      joinMethod: p.joinMethod,
      taxSourceId: hasTax ? "mrs-ut-valuation-2025" : null,
      geometrySourceId: "mrs-ut-parcels",
      sourceId: hasTax ? "mrs-ut-valuation-2025" : "mrs-ut-parcels",
      accountNumber: p.accountNumber,
      attrsRaw: p.attrsRaw,
      updatedAt: new Date().toISOString(),
      territoryType: "ut" as const,
    };
  });

  await writeJson(UT_PARCELS_JOINED_JSON, parcels);
  console.log(
    `  wrote ${UT_PARCELS_JOINED_JSON} (${parcels.length} parcels, ${joinedCount} with tax)`,
  );

  const joinedByRecordId = new Map(
    joined.filter((j) => j.taxRecordId).map((j) => [j.taxRecordId!, j.id]),
  );
  const updatedRecords = taxRecords.map((r) => ({
    ...r,
    geomParcelId: joinedByRecordId.get(r.id) ?? null,
  }));
  await writeJson(UT_TAX_RECORDS_JSON, updatedRecords);

  if (batches[0]) {
    batches[0].stats = {
      ...batches[0].stats,
      recordsJoined: joinedCount,
      recordsFailed: taxRecords.length - joinedCount,
      indexMatchRate: validation.matchRate,
    };
    await writeJson(UT_BATCHES_JSON, batches);
  }

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
