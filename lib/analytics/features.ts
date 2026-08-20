import { decodeTpl, type TplFamily } from "@/lib/tax/tpl-decode";
import type { ParcelSnapshot } from "./types";

export type ValuationAllocation = "single_lot" | "copied_full_assessment" | null;

export interface ParcelFeature {
  id: string;
  snapshotId: string;
  runId: string;
  parcelId: string;
  taxYear: number;
  geometryAsOf: string;
  gisAcreage: number | null;
  taxAcreage: number | null;
  land: number | null;
  building: number | null;
  taxable: number | null;
  exemption: number | null;
  landPlusBuilding: number | null;
  taxableMinusLandBuilding: number | null;
  valuePerGisAcre: number | null;
  landPerGisAcre: number | null;
  buildingPerGisAcre: number | null;
  buildingLandRatio: number | null;
  vacantFlag: boolean;
  unjoinedFlag: boolean;
  tplFamily: TplFamily | null;
  multiLotGroupId: string | null;
  lotCountInGroup: number | null;
  valuationAllocation: ValuationAllocation;
}

export function parcelFeatureId(snapshotId: string): string {
  return `${snapshotId}|features`;
}

function perGisAcre(value: number | null, gisAcreage: number | null): number | null {
  if (value == null || gisAcreage == null || gisAcreage <= 0) return null;
  return value / gisAcreage;
}

export function allocationFromAttrs(
  attrsRaw: Record<string, unknown> | null,
): ValuationAllocation {
  const raw = attrsRaw?.valuationAllocation;
  if (raw === "copied_full_assessment" || raw === "single_lot") return raw;
  return null;
}

export function buildParcelFeature(snapshot: ParcelSnapshot): ParcelFeature {
  const land = snapshot.assessedLandValueNumeric;
  const building = snapshot.assessedBuildingValueNumeric;
  const taxable = snapshot.assessedTotalValueNumeric;
  const exemption = snapshot.assessedExemptionValueNumeric;
  const gisAcreage = snapshot.gisAcreageNumeric;
  const taxAcreage = snapshot.taxAcreageNumeric;
  const allocation = allocationFromAttrs(snapshot.attrsRaw);
  const copied = allocation === "copied_full_assessment";

  const landPlusBuilding =
    land != null && building != null ? land + building : null;
  const taxableMinusLandBuilding =
    taxable != null && landPlusBuilding != null ? taxable - landPlusBuilding : null;

  const lotLevelPerAcreAllowed = snapshot.hasAssessment && !copied;
  const valuePerGisAcre = lotLevelPerAcreAllowed
    ? perGisAcre(taxable, gisAcreage)
    : null;
  const landPerGisAcre = lotLevelPerAcreAllowed ? perGisAcre(land, gisAcreage) : null;
  const buildingPerGisAcre = lotLevelPerAcreAllowed
    ? perGisAcre(building, gisAcreage)
    : null;

  const buildingLandRatio =
    land != null && land > 0 && building != null ? building / land : null;

  const vacantFlag = snapshot.hasAssessment && building === 0;
  const unjoinedFlag =
    snapshot.joinMethod === "unjoined" || snapshot.hasAssessment === false;

  const tplFamily: TplFamily | null = snapshot.tpl
    ? (decodeTpl(snapshot.tpl, snapshot.mapLot)?.family ?? "unknown")
    : null;

  const lotCount =
    typeof snapshot.attrsRaw?.lotCountInGroup === "number"
      ? snapshot.attrsRaw.lotCountInGroup
      : null;
  const multiLotGroupId =
    typeof snapshot.attrsRaw?.multiLotGroupId === "string"
      ? snapshot.attrsRaw.multiLotGroupId
      : snapshot.propertyId;

  return {
    id: parcelFeatureId(snapshot.id),
    snapshotId: snapshot.id,
    runId: snapshot.runId,
    parcelId: snapshot.parcelId,
    taxYear: snapshot.taxYear,
    geometryAsOf: snapshot.geometryAsOf,
    gisAcreage,
    taxAcreage,
    land,
    building,
    taxable,
    exemption,
    landPlusBuilding,
    taxableMinusLandBuilding,
    valuePerGisAcre,
    landPerGisAcre,
    buildingPerGisAcre,
    buildingLandRatio,
    vacantFlag,
    unjoinedFlag,
    tplFamily,
    multiLotGroupId,
    lotCountInGroup: lotCount,
    valuationAllocation: allocation,
  };
}

export function buildParcelFeatures(snapshots: ParcelSnapshot[]): ParcelFeature[] {
  return snapshots.map(buildParcelFeature);
}
