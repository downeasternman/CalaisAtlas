export type AnalyticsTerritoryType = "ut" | "organized";

export interface AnalyticsRun {
  id: string;
  territoryType: AnalyticsTerritoryType;
  taxYear: number;
  geometryAsOf: string;
  valuationAsOf: string;
  geometrySourceId: string;
  taxSourceId: string;
  ingestBatchId: string | null;
  createdAt: string;
  stats: {
    parcelSnapshots: number;
    taxRecordSnapshots: number;
    taxRecordsJoined: number;
    taxRecordsUnjoined: number;
    parcelsWithAssessment: number;
  };
}

export interface ParcelSnapshot {
  id: string;
  runId: string;
  parcelId: string;
  taxYear: number;
  geometryAsOf: string;
  territoryType: AnalyticsTerritoryType;
  municipalityId: string | null;
  taxMunicipalityId: string | null;
  tpl: string | null;
  mapLot: string | null;
  propertyId: string | null;
  accountNumber: string | null;
  ownerNameRaw: string | null;
  mailAddressRaw: string | null;
  assessedLandValueSource: string | null;
  assessedLandValueNumeric: number | null;
  assessedBuildingValueSource: string | null;
  assessedBuildingValueNumeric: number | null;
  assessedTotalValueSource: string | null;
  assessedTotalValueNumeric: number | null;
  assessedExemptionValueSource: string | null;
  assessedExemptionValueNumeric: number | null;
  assessedPersonalPropertyValueSource: string | null;
  assessedPersonalPropertyValueNumeric: number | null;
  taxAmountSource: string | null;
  taxAmountNumeric: number | null;
  percentOwnershipSource: string | null;
  gisAcreageSource: string | null;
  gisAcreageNumeric: number | null;
  taxAcreageSource: string | null;
  taxAcreageNumeric: number | null;
  acreageDiscrepancy: boolean | null;
  joinMethod: string | null;
  joinConfidence: number | null;
  hasAssessment: boolean;
  taxRecordId: string | null;
  taxSourceId: string | null;
  geometrySourceId: string | null;
  attrsRaw: Record<string, unknown> | null;
}

export interface TaxRecordSnapshot {
  id: string;
  runId: string;
  taxRecordId: string;
  taxYear: number;
  valuationAsOf: string;
  territoryType: AnalyticsTerritoryType;
  mapJoinKey: string | null;
  mapLot: string | null;
  propertyId: string | null;
  accountNumber: string | null;
  ownerNameRaw: string | null;
  mailAddressRaw: string | null;
  assessedLandValueSource: string | null;
  assessedLandValueNumeric: number | null;
  assessedBuildingValueSource: string | null;
  assessedBuildingValueNumeric: number | null;
  assessedTotalValueSource: string | null;
  assessedTotalValueNumeric: number | null;
  assessedExemptionValueSource: string | null;
  assessedExemptionValueNumeric: number | null;
  assessedPersonalPropertyValueSource: string | null;
  assessedPersonalPropertyValueNumeric: number | null;
  taxAmountSource: string | null;
  taxAmountNumeric: number | null;
  percentOwnershipSource: string | null;
  taxAcreageSource: string | null;
  taxAcreageNumeric: number | null;
  parcelId: string | null;
  joinedToGeometry: boolean;
  taxSourceId: string;
  attrsRaw: Record<string, unknown> | null;
}

export function parcelSnapshotId(
  parcelId: string,
  taxYear: number,
  geometryAsOf: string,
): string {
  return `${parcelId}|${taxYear}|${geometryAsOf}`;
}

export function taxRecordSnapshotId(taxRecordId: string, taxYear: number): string {
  return `${taxRecordId}|${taxYear}`;
}
