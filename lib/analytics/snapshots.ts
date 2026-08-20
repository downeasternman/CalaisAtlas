import { numericFromSource } from "./money";
import {
  parcelSnapshotId,
  taxRecordSnapshotId,
  type AnalyticsRun,
  type ParcelSnapshot,
  type TaxRecordSnapshot,
} from "./types";

export interface JoinedParcelInput {
  id: string;
  municipalityId: string | null;
  taxMunicipalityId: string | null;
  tpl: string | null;
  mapLot: string | null;
  propertyId: string | null;
  accountNumber: string | null;
  ownerName: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  assessedPersonalPropertyValue: string | null;
  taxAmount: string | null;
  percentOwnership: string | null;
  gisAcreage: string | null;
  taxAcreage: string | null;
  acreageDiscrepancy: boolean | null;
  joinMethod: string | null;
  joinConfidence: number | null;
  taxYear: number | null;
  taxSourceId: string | null;
  geometrySourceId: string | null;
  attrsRaw: Record<string, unknown> | null;
}

export interface TaxRecordInput {
  id: string;
  mapJoinKey: string | null;
  mapLot: string | null;
  propertyId: string | null;
  accountNumber: string | null;
  ownerName: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  assessedPersonalPropertyValue: string | null;
  taxAmount: string | null;
  percentOwnership: string | null;
  taxAcreage: string | null;
  taxYear: number | null;
  geomParcelId: string | null;
  attrsRaw: Record<string, unknown> | null;
}

export interface SnapshotBuildInput {
  runId: string;
  taxYear: number;
  geometryAsOf: string;
  valuationAsOf: string;
  geometrySourceId: string;
  taxSourceId: string;
  ingestBatchId: string | null;
  createdAt: string;
  parcels: JoinedParcelInput[];
  taxRecords: TaxRecordInput[];
}

function moneyPair(source: string | null | undefined) {
  const assessed = source ?? null;
  return { source: assessed, numeric: numericFromSource(assessed) };
}

export function buildUtSnapshots(input: SnapshotBuildInput): {
  run: AnalyticsRun;
  parcelSnapshots: ParcelSnapshot[];
  taxRecordSnapshots: TaxRecordSnapshot[];
} {
  const taxByParcelId = new Map<string, TaxRecordInput>();
  for (const record of input.taxRecords) {
    if (record.geomParcelId) taxByParcelId.set(record.geomParcelId, record);
  }

  const parcelSnapshots = input.parcels.map((parcel) => {
    const tax = taxByParcelId.get(parcel.id);
    const land = moneyPair(parcel.assessedLandValue);
    const building = moneyPair(parcel.assessedBuildingValue);
    const total = moneyPair(parcel.assessedTotalValue);
    const exemption = moneyPair(parcel.assessedExemptionValue);
    const personal = moneyPair(parcel.assessedPersonalPropertyValue);
    const taxAmt = moneyPair(parcel.taxAmount);
    const gis = moneyPair(parcel.gisAcreage);
    const taxAcres = moneyPair(parcel.taxAcreage);
    const hasAssessment = total.source != null;

    return {
      id: parcelSnapshotId(parcel.id, input.taxYear, input.geometryAsOf),
      runId: input.runId,
      parcelId: parcel.id,
      taxYear: input.taxYear,
      geometryAsOf: input.geometryAsOf,
      territoryType: "ut" as const,
      municipalityId: parcel.municipalityId,
      taxMunicipalityId: parcel.taxMunicipalityId,
      tpl: parcel.tpl,
      mapLot: parcel.mapLot,
      propertyId: parcel.propertyId,
      accountNumber: parcel.accountNumber,
      ownerNameRaw: parcel.ownerName,
      mailAddressRaw: parcel.mailAddress,
      assessedLandValueSource: land.source,
      assessedLandValueNumeric: land.numeric,
      assessedBuildingValueSource: building.source,
      assessedBuildingValueNumeric: building.numeric,
      assessedTotalValueSource: total.source,
      assessedTotalValueNumeric: total.numeric,
      assessedExemptionValueSource: exemption.source,
      assessedExemptionValueNumeric: exemption.numeric,
      assessedPersonalPropertyValueSource: personal.source,
      assessedPersonalPropertyValueNumeric: personal.numeric,
      taxAmountSource: taxAmt.source,
      taxAmountNumeric: taxAmt.numeric,
      percentOwnershipSource: parcel.percentOwnership,
      gisAcreageSource: gis.source,
      gisAcreageNumeric: gis.numeric,
      taxAcreageSource: taxAcres.source,
      taxAcreageNumeric: taxAcres.numeric,
      acreageDiscrepancy: parcel.acreageDiscrepancy,
      joinMethod: parcel.joinMethod,
      joinConfidence: parcel.joinConfidence,
      hasAssessment,
      taxRecordId: tax?.id ?? null,
      taxSourceId: parcel.taxSourceId,
      geometrySourceId: parcel.geometrySourceId ?? input.geometrySourceId,
      attrsRaw: parcel.attrsRaw,
    };
  });

  const taxRecordSnapshots = input.taxRecords.map((record) => {
    const year = record.taxYear ?? input.taxYear;
    const land = moneyPair(record.assessedLandValue);
    const building = moneyPair(record.assessedBuildingValue);
    const total = moneyPair(record.assessedTotalValue);
    const exemption = moneyPair(record.assessedExemptionValue);
    const personal = moneyPair(record.assessedPersonalPropertyValue);
    const taxAmt = moneyPair(record.taxAmount);
    const taxAcres = moneyPair(record.taxAcreage);
    const parcelId = record.geomParcelId;

    return {
      id: taxRecordSnapshotId(record.id, year),
      runId: input.runId,
      taxRecordId: record.id,
      taxYear: year,
      valuationAsOf: input.valuationAsOf,
      territoryType: "ut" as const,
      mapJoinKey: record.mapJoinKey,
      mapLot: record.mapLot,
      propertyId: record.propertyId,
      accountNumber: record.accountNumber,
      ownerNameRaw: record.ownerName,
      mailAddressRaw: record.mailAddress,
      assessedLandValueSource: land.source,
      assessedLandValueNumeric: land.numeric,
      assessedBuildingValueSource: building.source,
      assessedBuildingValueNumeric: building.numeric,
      assessedTotalValueSource: total.source,
      assessedTotalValueNumeric: total.numeric,
      assessedExemptionValueSource: exemption.source,
      assessedExemptionValueNumeric: exemption.numeric,
      assessedPersonalPropertyValueSource: personal.source,
      assessedPersonalPropertyValueNumeric: personal.numeric,
      taxAmountSource: taxAmt.source,
      taxAmountNumeric: taxAmt.numeric,
      percentOwnershipSource: record.percentOwnership,
      taxAcreageSource: taxAcres.source,
      taxAcreageNumeric: taxAcres.numeric,
      parcelId,
      joinedToGeometry: parcelId != null,
      taxSourceId: input.taxSourceId,
      attrsRaw: record.attrsRaw,
    };
  });

  const taxJoined = taxRecordSnapshots.filter((r) => r.joinedToGeometry).length;

  const run: AnalyticsRun = {
    id: input.runId,
    territoryType: "ut",
    taxYear: input.taxYear,
    geometryAsOf: input.geometryAsOf,
    valuationAsOf: input.valuationAsOf,
    geometrySourceId: input.geometrySourceId,
    taxSourceId: input.taxSourceId,
    ingestBatchId: input.ingestBatchId,
    createdAt: input.createdAt,
    stats: {
      parcelSnapshots: parcelSnapshots.length,
      taxRecordSnapshots: taxRecordSnapshots.length,
      taxRecordsJoined: taxJoined,
      taxRecordsUnjoined: taxRecordSnapshots.length - taxJoined,
      parcelsWithAssessment: parcelSnapshots.filter((p) => p.hasAssessment).length,
    },
  };

  return { run, parcelSnapshots, taxRecordSnapshots };
}
