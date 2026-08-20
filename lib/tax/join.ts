import type { JoinMethod } from "./crosswalk";
import { resolveTaxMunicipalityId, type MapSheetEntry } from "./crosswalk";
import { mapJoinKeyFromTpl, normalizePlanLotKey } from "./plan-lot";
import type { ParsedUtTaxRow } from "./ut-parser";
import { decodeTpl } from "./tpl-decode";
import { hasAcreageDiscrepancy } from "./acreage-compare";

export interface GeometryParcelStub {
  id: string;
  municipalityId: string;
  municipalityName: string;
  planLot: string;
  tpl: string | null;
  mapJoinKey: string | null;
  tplFamily: string | null;
  acreage: string | null;
  geocode: string | null;
}

export interface JoinedUtParcel {
  id: string;
  sourceParcelId: string;
  municipalityId: string;
  municipalityName: string;
  taxMunicipalityId: string | null;
  mapLot: string;
  tpl: string | null;
  propertyId: string | null;
  ownerName: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  assessedPersonalPropertyValue: string | null;
  taxAmount: string | null;
  percentOwnership: string | null;
  accountNumber: string | null;
  hasTreeGrowth: boolean;
  taxYear: number | null;
  acreage: string | null;
  gisAcreage: string | null;
  taxAcreage: string | null;
  acreageDiscrepancy: boolean;
  joinConfidence: number | null;
  joinMethod: JoinMethod;
  taxRecordId: string | null;
  attrsRaw: Record<string, unknown> | null;
}

export function buildTaxLookups(records: Array<ParsedUtTaxRow & { id: string }>) {
  const byMapJoinKey = new Map<string, (typeof records)[number]>();
  const byPropertyId = new Map<string, (typeof records)[number]>();

  for (const record of records) {
    byMapJoinKey.set(record.mapJoinKey.toUpperCase(), record);
    if (record.propertyId) {
      byPropertyId.set(record.propertyId.replace(/P$/i, "").toUpperCase(), record);
    }
  }

  return { byMapJoinKey, byPropertyId };
}

export function joinUtTaxToGeometry(
  geometry: GeometryParcelStub[],
  lookups: ReturnType<typeof buildTaxLookups>,
  mapSheets: Record<string, MapSheetEntry>,
): JoinedUtParcel[] {
  return geometry.map((geom) => {
    const key = geom.mapJoinKey?.toUpperCase() ?? "";
    const tax = key ? lookups.byMapJoinKey.get(key) : undefined;
    let joinMethod: JoinMethod = "unjoined";
    let propertyId: string | null = null;

    if (tax) {
      propertyId = tax.propertyId;
      joinMethod = tax.propertyId ? "property_id" : "map_lot";
    }

    const taxMunicipalityId = resolveTaxMunicipalityId(tax ?? null, mapSheets);
    const gisAcreage = geom.acreage;
    const taxAcreage = tax?.acreage ?? null;

    return {
      id: geom.id,
      sourceParcelId: geom.tpl ?? geom.id,
      municipalityId: geom.municipalityId,
      municipalityName: geom.municipalityName,
      taxMunicipalityId,
      mapLot: normalizePlanLotKey(geom.planLot),
      tpl: geom.tpl,
      propertyId,
      ownerName: tax?.ownerName ?? null,
      mailAddress: tax?.mailAddress ?? null,
      assessedLandValue: tax?.assessedLandValue ?? null,
      assessedBuildingValue: tax?.assessedBuildingValue ?? null,
      assessedTotalValue: tax?.assessedTotalValue ?? null,
      assessedExemptionValue: tax?.assessedExemptionValue ?? null,
      assessedPersonalPropertyValue: tax?.assessedPersonalPropertyValue ?? null,
      taxAmount: tax?.taxAmount ?? null,
      percentOwnership: tax?.percentOwnership ?? null,
      accountNumber: tax?.accountNumber ?? null,
      hasTreeGrowth: false,
      taxYear: tax?.taxYear ?? null,
      acreage: gisAcreage,
      gisAcreage,
      taxAcreage,
      acreageDiscrepancy: hasAcreageDiscrepancy(gisAcreage, taxAcreage),
      joinConfidence: tax ? tax.parseConfidence : null,
      joinMethod,
      taxRecordId: tax ? tax.id : null,
      attrsRaw: tax?.attrsRaw ?? null,
    };
  });
}

export function geometryMapJoinKey(
  tpl: string | null,
  planLot: string,
): { mapJoinKey: string | null; tplFamily: string | null } {
  const decoded = decodeTpl(tpl, planLot);
  if (!decoded) {
    return {
      mapJoinKey: mapJoinKeyFromTpl(tpl),
      tplFamily: null,
    };
  }
  return {
    mapJoinKey: decoded.mapJoinKey,
    tplFamily: decoded.family,
  };
}

export function parcelIdFromTpl(tpl: string): string {
  return `ut-${tpl.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
