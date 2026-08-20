import type { JoinMethod } from "./crosswalk";
import { cleanOwnerForDisplay } from "./owner-normalize";
import {
  hasValidAssessment,
  hasValidOwner,
  isQualityTaxRecord,
  isValidMoney,
} from "./owner-validate";
import {
  mapLotJoinCandidates,
  normalizeMapBkLot,
  organizedMapJoinKey,
} from "./map-lot-normalize";
import type { ParsedCommitmentRow } from "./commitment-parser";

export interface OrganizedGeometryStub {
  id: string;
  municipalityId: string;
  municipalityName: string;
  geocode: string;
  mapBkLot: string | null;
  mapJoinKey: string | null;
  stateId: string | null;
  propLoc: string | null;
}

export interface JoinedOrganizedParcel {
  id: string;
  sourceParcelId: string;
  municipalityId: string;
  municipalityName: string;
  accountNumber: string | null;
  mapLot: string | null;
  mapJoinKey: string | null;
  ownerName: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  hasTreeGrowth: boolean;
  taxYear: number | null;
  joinConfidence: number | null;
  joinMethod: JoinMethod;
  taxRecordId: string | null;
  attrsRaw: Record<string, unknown> | null;
}

export { hasValidOwner, hasValidAssessment, isQualityTaxRecord };

export function buildOrganizedTaxLookups(
  records: Array<ParsedCommitmentRow & { id: string }>,
) {
  const byMapJoinKey = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const geocode = record.mapJoinKey.split("|")[0] ?? "";
    const keys = mapLotJoinCandidates(record.mapLot)
      .map((lot) => organizedMapJoinKey(geocode, lot)?.toUpperCase() ?? "")
      .filter(Boolean);
    if (keys.length === 0) {
      keys.push(record.mapJoinKey.toUpperCase());
    }
    for (const key of keys) {
      const existing = byMapJoinKey.get(key);
      if (!existing || record.parseConfidence > existing.parseConfidence) {
        byMapJoinKey.set(key, record);
      }
    }
  }
  return { byMapJoinKey };
}

export function parentMapJoinKeys(geocode: string, mapLot: string | null): string[] {
  const candidates = mapLotJoinCandidates(mapLot);
  const exact = candidates[0];
  return candidates
    .slice(1)
    .map((lot) => organizedMapJoinKey(geocode, lot)?.toUpperCase() ?? "")
    .filter((key) => key && key !== organizedMapJoinKey(geocode, exact)?.toUpperCase());
}

function joinKeysForGeometry(geocode: string, mapBkLot: string | null): string[] {
  return mapLotJoinCandidates(mapBkLot)
    .map((lot) => organizedMapJoinKey(geocode, lot)?.toUpperCase() ?? "")
    .filter(Boolean);
}

function lookupTaxRecord(
  geocode: string,
  mapBkLot: string | null,
  lookups: ReturnType<typeof buildOrganizedTaxLookups>,
): {
  tax: (ParsedCommitmentRow & { id: string }) | undefined;
  joinMethod: JoinMethod;
  joinConfidence: number | null;
} {
  const keys = joinKeysForGeometry(geocode, mapBkLot);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const record = lookups.byMapJoinKey.get(key);
    if (!record || !hasValidOwner(record)) continue;

    const joinMethod: JoinMethod = i === 0 ? "map_lot" : "map_lot_parent";
    const joinConfidence =
      joinMethod === "map_lot_parent" && !hasValidAssessment(record)
        ? 0.55
        : record.parseConfidence;

    return { tax: record, joinMethod, joinConfidence };
  }

  return { tax: undefined, joinMethod: "unjoined", joinConfidence: null };
}

export function joinOrganizedTaxToGeometry(
  geometry: OrganizedGeometryStub[],
  lookups: ReturnType<typeof buildOrganizedTaxLookups>,
): JoinedOrganizedParcel[] {
  return geometry.map((geom) => {
    const { tax, joinMethod, joinConfidence } = lookupTaxRecord(
      geom.geocode,
      geom.mapBkLot,
      lookups,
    );
    const ownerName = cleanOwnerForDisplay(tax?.ownerName ?? null);
    const assessedTotalValue =
      tax?.assessedTotalValue && isValidMoney(tax.assessedTotalValue)
        ? tax.assessedTotalValue
        : null;

    return {
      id: geom.id,
      sourceParcelId: geom.stateId ?? geom.mapBkLot ?? geom.id,
      municipalityId: geom.municipalityId,
      municipalityName: geom.municipalityName,
      accountNumber: tax?.accountNumber ?? null,
      mapLot: geom.mapBkLot ? normalizeMapBkLot(geom.mapBkLot) : null,
      mapJoinKey: geom.mapJoinKey,
      ownerName,
      mailAddress: tax?.mailAddress ?? null,
      assessedLandValue: tax?.assessedLandValue ?? null,
      assessedBuildingValue: tax?.assessedBuildingValue ?? null,
      assessedTotalValue,
      assessedExemptionValue: tax?.assessedExemptionValue ?? null,
      hasTreeGrowth: tax?.hasTreeGrowth ?? false,
      taxYear: tax?.taxYear ?? null,
      joinConfidence,
      joinMethod,
      taxRecordId: tax?.id ?? null,
      attrsRaw: tax?.attrsRaw ?? null,
    };
  });
}

export function organizedParcelId(
  municipalityId: string,
  stateId: string | null,
  mapBkLot: string | null,
): string {
  if (stateId) {
    const slug = stateId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `org-${municipalityId}-${slug}`;
  }
  const lot = normalizeMapBkLot(mapBkLot) ?? "unknown";
  const lotSlug = lot.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `org-${municipalityId}-${lotSlug}`;
}

export function geometryOrganizedMapJoinKey(
  geocode: string,
  mapBkLot: string | null,
): string | null {
  const normalized = normalizeMapBkLot(mapBkLot);
  if (!normalized) return null;
  return organizedMapJoinKey(geocode, normalized);
}