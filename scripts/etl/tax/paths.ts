import path from "node:path";
import { RAW_DIR, PROCESSED_DIR, MANIFEST_DIR } from "../paths";

export const TAX_RAW_UT_DIR = path.join(RAW_DIR, "tax", "ut");
export const TAX_PROCESSED_DIR = path.join(PROCESSED_DIR, "tax");
export const TAX_RAW_ORGANIZED_DIR = path.join(RAW_DIR, "tax", "organized");

export const UT_VALUATION_PDF = path.join(TAX_RAW_UT_DIR, "2025-washington-valuation-book.pdf");
export const UT_MAP_LOT_INDEX_JSON = path.join(TAX_PROCESSED_DIR, "ut-map-lot-index.json");
export const UT_MAP_LOT_INDEX_PDF = path.join(TAX_RAW_UT_DIR, "2024-washington-map-lot-index.pdf");
export const UT_PARCELS_GEOJSON = path.join(TAX_PROCESSED_DIR, "ut-parcels.geojson");
export const UT_TAX_RECORDS_JSON = path.join(TAX_PROCESSED_DIR, "ut-tax-records.json");
export const UT_BATCHES_JSON = path.join(TAX_PROCESSED_DIR, "ut-batches.json");
export const UT_PARCELS_JOINED_JSON = path.join(TAX_PROCESSED_DIR, "ut-parcels-joined.json");
export const ORGANIZED_PARCELS_GEOJSON = path.join(TAX_PROCESSED_DIR, "organized-parcels.geojson");
export const ORGANIZED_PARCELS_JOINED_JSON = path.join(
  TAX_PROCESSED_DIR,
  "organized-parcels-joined.json",
);
export const PARCELS_JSON = path.join(PROCESSED_DIR, "parcels.json");
export const ANALYTICS_DIR = path.join(PROCESSED_DIR, "analytics");
export const UT_ANALYTICS_RUNS_JSON = path.join(ANALYTICS_DIR, "ut-analytics-runs.json");
export const UT_PARCEL_SNAPSHOTS_JSON = path.join(ANALYTICS_DIR, "ut-parcel-snapshots.json");
export const UT_TAX_RECORD_SNAPSHOTS_JSON = path.join(
  ANALYTICS_DIR,
  "ut-tax-record-snapshots.json",
);
export const UT_PARCEL_FEATURES_JSON = path.join(ANALYTICS_DIR, "ut-parcel-features.json");
export const UT_VALUATION_SCORES_JSON = path.join(ANALYTICS_DIR, "ut-valuation-scores.json");
export const UT_VALUATION_CATALOGUE_JSON = path.join(
  ANALYTICS_DIR,
  "ut-valuation-catalogue.json",
);
export const UT_PARCEL_SPATIAL_JSON = path.join(ANALYTICS_DIR, "ut-parcel-spatial.json");
export const UT_SPATIAL_NEIGHBORS_JSON = path.join(ANALYTICS_DIR, "ut-spatial-neighbors.json");
export const UT_OWNER_ENTITIES_JSON = path.join(ANALYTICS_DIR, "ut-owner-entities.json");
export const UT_OWNERSHIP_GRAPH_JSON = path.join(ANALYTICS_DIR, "ut-ownership-graph.json");
export const UT_OWNERSHIP_CLUSTERS_JSON = path.join(ANALYTICS_DIR, "ut-ownership-clusters.json");
export const UT_OBSERVATIONS_JSON = path.join(ANALYTICS_DIR, "ut-observations.json");
export const UT_INVESTIGATOR_PACKETS_JSON = path.join(
  ANALYTICS_DIR,
  "ut-investigator-packets.json",
);
export const UT_INVESTIGATOR_HYPOTHESES_JSON = path.join(
  ANALYTICS_DIR,
  "ut-investigator-hypotheses.json",
);
export const TAX_SOURCES_MANIFEST = path.join(MANIFEST_DIR, "tax-sources.json");
export const ORGANIZED_TOWNS_MANIFEST = path.join(MANIFEST_DIR, "organized-towns.json");

export const MRS_UT_PARCELS_URL =
  "https://gis.maine.gov/mapservices/rest/services/mrs/Maine_Parcels_Unorganized_Territory/MapServer/0/query";

export const MEGIS_ORGANIZED_PARCELS_URL =
  "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Organized_Towns/FeatureServer/10/query";

export const UT_VALUATION_BOOK_URL =
  "https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/2025%20Washington%20County_Valuation%20Book.pdf";

export const UT_MAP_LOT_INDEX_URL =
  "https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/2024%20Washington%20County%20Map%20Lot%20index.pdf";

export function organizedRawDir(municipalityId: string): string {
  return path.join(TAX_RAW_ORGANIZED_DIR, municipalityId);
}

export function organizedCommitmentPdf(municipalityId: string): string {
  return path.join(organizedRawDir(municipalityId), "commitment.pdf");
}

export function organizedTaxRecordsJson(municipalityId: string): string {
  return path.join(TAX_PROCESSED_DIR, "organized", `${municipalityId}-tax-records.json`);
}

export function organizedBatchesJson(municipalityId: string): string {
  return path.join(TAX_PROCESSED_DIR, "organized", `${municipalityId}-batches.json`);
}
