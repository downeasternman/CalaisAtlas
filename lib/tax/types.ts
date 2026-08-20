export type TerritoryType = "ut" | "organized";

export type JoinMethod =
  | "map_lot"
  | "parcel_id"
  | "owner_address_fuzzy"
  | "manual_review_queue";

export interface TaxSourceEntry {
  id: string;
  territoryType: TerritoryType;
  municipalityId: string | null;
  name: string;
  urls: string[];
  parserId: string;
  joinMethod: JoinMethod;
  notes: string | null;
}

export interface TaxIngestBatch {
  id: string;
  territoryType: TerritoryType;
  municipalityId: string | null;
  sourceId: string;
  parserId: string;
  asOfDate: string | null;
  filePaths: string[];
  stats: TaxIngestStats;
  createdAt: string;
}

export interface TaxIngestStats {
  recordsParsed: number;
  recordsJoined: number;
  recordsFailed: number;
  parseConfidenceAvg: number | null;
}

export interface TaxRecord {
  id: string;
  batchId: string;
  externalKey: string | null;
  ownerName: string | null;
  mapLot: string | null;
  situsAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  taxYear: number | null;
  attrsRaw: Record<string, unknown> | null;
  parseConfidence: number | null;
  geomParcelId: string | null;
}
