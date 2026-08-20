/**
 * Join organized-town tax records to GeoLibrary geometry for one municipality.
 */
import path from "node:path";
import { getOrganizedTown } from "@/lib/tax/organized-municipalities";
import {
  buildOrganizedTaxLookups,
  geometryOrganizedMapJoinKey,
  hasValidOwner,
  joinOrganizedTaxToGeometry,
  type OrganizedGeometryStub,
} from "@/lib/tax/organized-join";
import { isValidAccountNumber } from "@/lib/tax/owner-validate";
import type { ParsedCommitmentRow } from "@/lib/tax/commitment-parser";
import { ensureDirs, readJson, writeJson } from "../paths";
import { requireTownArg } from "./cli";
import {
  ORGANIZED_PARCELS_GEOJSON,
  ORGANIZED_PARCELS_JOINED_JSON,
  organizedBatchesJson,
  organizedTaxRecordsJson,
} from "./paths";

type TaxRecordJson = ParsedCommitmentRow & {
  id: string;
  mapJoinKey: string;
  accountNumber: string;
  ownerName: string | null;
  mailAddress: string | null;
  parseConfidence: number;
};

type JoinedParcel = {
  id: string;
  sourceParcelId: string;
  municipalityId: string;
  taxMunicipalityId: string | null;
  accountNumber: string | null;
  propertyId: string | null;
  ownerName: string | null;
  ownerNameNormalized: string | null;
  situsAddress: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  hasTreeGrowth: boolean;
  taxYear: number | null;
  acreage: string | null;
  gisAcreage: string | null;
  taxAcreage: string | null;
  acreageDiscrepancy: boolean | null;
  assessedPersonalPropertyValue: string | null;
  taxAmount: string | null;
  percentOwnership: string | null;
  landUse: string | null;
  mapLot: string | null;
  tpl: string | null;
  joinConfidence: number | null;
  joinMethod: string;
  taxSourceId: string | null;
  geometrySourceId: string;
  sourceId: string | null;
  attrsRaw: Record<string, unknown> | null;
  updatedAt: string;
  territoryType: "organized";
};

async function main() {
  const townId = requireTownArg();
  const town = await getOrganizedTown(townId);
  if (!town) {
    throw new Error(`Unknown organized town: ${townId}`);
  }

  const geojson = await readJson<GeoJSON.FeatureCollection>(ORGANIZED_PARCELS_GEOJSON);
  const taxRecords = await readJson<TaxRecordJson[]>(organizedTaxRecordsJson(townId));

  const geometry: OrganizedGeometryStub[] = geojson.features
    .filter((f) => String(f.properties?.municipalityId ?? "") === townId)
    .map((f) => ({
      id: String(f.properties?.id ?? ""),
      municipalityId: String(f.properties?.municipalityId ?? ""),
      municipalityName: String(f.properties?.municipalityName ?? town.name),
      geocode: String(f.properties?.geocode ?? town.geocode),
      mapBkLot: f.properties?.mapBkLot != null ? String(f.properties.mapBkLot) : null,
      mapJoinKey:
        geometryOrganizedMapJoinKey(
          String(f.properties?.geocode ?? town.geocode),
          f.properties?.mapBkLot != null ? String(f.properties.mapBkLot) : null,
        ),
      stateId: f.properties?.stateId != null ? String(f.properties.stateId) : null,
      propLoc: f.properties?.propLoc != null ? String(f.properties.propLoc) : null,
    }));

  const taxForJoin = taxRecords.map((r) => ({ ...r, id: r.id }));
  const lookups = buildOrganizedTaxLookups(taxForJoin);
  const joined = joinOrganizedTaxToGeometry(geometry, lookups);

  let sourceId = `org-${townId}-commitment-${town.taxYear ?? "unknown"}`;
  try {
    const batches = await readJson<Array<{ sourceId?: string }>>(
      organizedBatchesJson(townId),
    );
    if (batches[0]?.sourceId) sourceId = batches[0].sourceId;
  } catch {
    // use default commitment source id
  }
  const geomById = new Map(geometry.map((g) => [g.id, g]));
  let joinedCount = 0;
  let ownerJoinCount = 0;
  let qualityJoinCount = 0;
  const townParcels: JoinedParcel[] = joined.map((p) => {
    const geom = geomById.get(p.id);
    const hasOwner = p.taxRecordId != null && hasValidOwner({ ownerName: p.ownerName });
    const hasTax =
      hasOwner && p.assessedTotalValue != null;
    if (hasOwner) ownerJoinCount++;
    if (hasTax) joinedCount++;
    if (hasOwner && p.assessedTotalValue != null) qualityJoinCount++;
    return {
      id: p.id,
      sourceParcelId: p.sourceParcelId,
      municipalityId: p.municipalityId,
      taxMunicipalityId: p.municipalityId,
      accountNumber: isValidAccountNumber(p.accountNumber) ? p.accountNumber : null,
      propertyId: null,
      ownerName: p.ownerName,
      ownerNameNormalized: p.ownerName?.toLowerCase() ?? null,
      situsAddress: geom?.propLoc ?? null,
      mailAddress: p.mailAddress,
      assessedLandValue: p.assessedLandValue,
      assessedBuildingValue: p.assessedBuildingValue,
      assessedTotalValue: p.assessedTotalValue,
      assessedExemptionValue: p.assessedExemptionValue,
      hasTreeGrowth: p.hasTreeGrowth,
      taxYear: p.taxYear,
      acreage: null,
      gisAcreage: null,
      taxAcreage: null,
      acreageDiscrepancy: null,
      assessedPersonalPropertyValue: null,
      taxAmount: null,
      percentOwnership: null,
      landUse: null,
      mapLot: p.mapLot,
      tpl: null,
      joinConfidence: p.joinConfidence,
      joinMethod: p.joinMethod,
      taxSourceId: hasOwner ? sourceId : null,
      geometrySourceId: "megis-organized-parcels",
      sourceId: hasOwner ? sourceId : "megis-organized-parcels",
      attrsRaw: p.attrsRaw,
      updatedAt: new Date().toISOString(),
      territoryType: "organized",
    };
  });

  let existing: JoinedParcel[] = [];
  try {
    existing = await readJson<JoinedParcel[]>(ORGANIZED_PARCELS_JOINED_JSON);
  } catch {
    existing = [];
  }

  const withoutTown = existing.filter((p) => p.municipalityId !== townId);
  const mergedOrganized = [...withoutTown, ...townParcels];

  await ensureDirs(path.dirname(ORGANIZED_PARCELS_JOINED_JSON));
  await writeJson(ORGANIZED_PARCELS_JOINED_JSON, mergedOrganized);
  console.log(
    `  ${town.name}: ${joinedCount}/${geometry.length} geometry parcels with tax (${((joinedCount / Math.max(geometry.length, 1)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Owner joins: ${ownerJoinCount}/${geometry.length} (${((ownerJoinCount / Math.max(geometry.length, 1)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Quality joins (owner + assessment): ${qualityJoinCount}/${geometry.length} (${((qualityJoinCount / Math.max(geometry.length, 1)) * 100).toFixed(1)}%)`,
  );
  console.log(`  wrote ${ORGANIZED_PARCELS_JOINED_JSON} (${mergedOrganized.length} organized total)`);

  try {
    const batches = await readJson<Array<{ id: string; stats: Record<string, unknown> }>>(
      organizedBatchesJson(townId),
    );
    if (batches[0]) {
      batches[0].stats = {
        ...batches[0].stats,
        recordsJoined: joinedCount,
        recordsFailed: taxRecords.length - joinedCount,
      };
      await writeJson(organizedBatchesJson(townId), batches);
    }
  } catch {
    // optional
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
