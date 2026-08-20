import type { Source } from "./source";

export interface Parcel {
  id: string;
  sourceParcelId: string | null;
  municipalityId: string | null;
  ownerName: string | null;
  ownerNameNormalized: string | null;
  situsAddress: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  valuePct: number | null;
  hasTreeGrowth: boolean | null;
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
  accountNumber: string | null;
  joinConfidence: number | null;
  joinMethod:
    | "map_lot"
    | "map_lot_parent"
    | "property_id"
    | "plat_crosswalk"
    | "unjoined"
    | null;
  taxMunicipalityId: string | null;
  propertyId: string | null;
  taxSourceId: string | null;
  geometrySourceId: string | null;
  territoryType: "ut" | "organized" | null;
  sourceId: string | null;
  attrsRaw: Record<string, unknown> | null;
  updatedAt: string | null;
}

export interface ParcelWithSources extends Parcel {
  taxSource: Source | null;
  geometrySource: Source | null;
  municipalityName: string | null;
  taxMunicipalityName: string | null;
}
