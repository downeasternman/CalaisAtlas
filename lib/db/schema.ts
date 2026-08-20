import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  real,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  asOfDate: date("as_of_date"),
  licenseNote: text("license_note"),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }),
});

export const municipalities = pgTable("municipalities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  geoid: text("geoid"),
  isOrganized: boolean("is_organized").notNull().default(true),
  // geom: geometry handled via raw SQL in Phase B
  sourceId: text("source_id").references(() => sources.id),
});

export const places = pgTable("places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull(),
  placeType: text("place_type").notNull(), // municipality | water | populated_place | landmark
  municipalityId: text("municipality_id").references(() => municipalities.id),
  rank: integer("rank").notNull().default(0),
  sourceId: text("source_id").references(() => sources.id),
});

export const parcels = pgTable("parcels", {
  id: text("id").primaryKey(),
  sourceParcelId: text("source_parcel_id"),
  municipalityId: text("municipality_id").references(() => municipalities.id),
  ownerName: text("owner_name"),
  ownerNameNormalized: text("owner_name_normalized"),
  situsAddress: text("situs_address"),
  mailAddress: text("mail_address"),
  assessedLandValue: numeric("assessed_land_value"),
  assessedBuildingValue: numeric("assessed_building_value"),
  assessedTotalValue: numeric("assessed_total_value"),
  taxYear: integer("tax_year"),
  acreage: numeric("acreage"),
  landUse: text("land_use"),
  sourceId: text("source_id").references(() => sources.id),
  attrsRaw: jsonb("attrs_raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const coverage = pgTable("coverage", {
  municipalityId: text("municipality_id")
    .primaryKey()
    .references(() => municipalities.id),
  hasParcelGeometry: boolean("has_parcel_geometry").notNull().default(false),
  hasOwnership: boolean("has_ownership").notNull().default(false),
  hasTaxAssessment: boolean("has_tax_assessment").notNull().default(false),
  parcelCount: integer("parcel_count").notNull().default(0),
  taxParseRate: real("tax_parse_rate"),
  notes: text("notes"),
  sourceId: text("source_id").references(() => sources.id),
});

export const taxIngestBatches = pgTable("tax_ingest_batches", {
  id: text("id").primaryKey(),
  territoryType: text("territory_type").notNull(), // ut | organized
  municipalityId: text("municipality_id").references(() => municipalities.id),
  sourceId: text("source_id").references(() => sources.id),
  parserId: text("parser_id").notNull(),
  asOfDate: date("as_of_date"),
  filePaths: jsonb("file_paths"),
  stats: jsonb("stats"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const taxRecords = pgTable("tax_records", {
  id: text("id").primaryKey(),
  batchId: text("batch_id")
    .notNull()
    .references(() => taxIngestBatches.id),
  externalKey: text("external_key"),
  ownerName: text("owner_name"),
  mapLot: text("map_lot"),
  situsAddress: text("situs_address"),
  assessedLandValue: numeric("assessed_land_value"),
  assessedBuildingValue: numeric("assessed_building_value"),
  assessedTotalValue: numeric("assessed_total_value"),
  taxYear: integer("tax_year"),
  attrsRaw: jsonb("attrs_raw"),
  parseConfidence: real("parse_confidence"),
  geomParcelId: text("geom_parcel_id").references(() => parcels.id),
});

export const analyticsRuns = pgTable("analytics_runs", {
  id: text("id").primaryKey(),
  territoryType: text("territory_type").notNull(),
  taxYear: integer("tax_year").notNull(),
  geometryAsOf: date("geometry_as_of").notNull(),
  valuationAsOf: date("valuation_as_of").notNull(),
  geometrySourceId: text("geometry_source_id").references(() => sources.id),
  taxSourceId: text("tax_source_id").references(() => sources.id),
  ingestBatchId: text("ingest_batch_id").references(() => taxIngestBatches.id),
  stats: jsonb("stats"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const parcelSnapshots = pgTable("parcel_snapshots", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => analyticsRuns.id),
  parcelId: text("parcel_id").notNull(),
  taxYear: integer("tax_year").notNull(),
  geometryAsOf: date("geometry_as_of").notNull(),
  territoryType: text("territory_type").notNull(),
  municipalityId: text("municipality_id"),
  ownerNameRaw: text("owner_name_raw"),
  assessedLandValueSource: text("assessed_land_value_source"),
  assessedLandValueNumeric: numeric("assessed_land_value_numeric"),
  assessedBuildingValueSource: text("assessed_building_value_source"),
  assessedBuildingValueNumeric: numeric("assessed_building_value_numeric"),
  assessedTotalValueSource: text("assessed_total_value_source"),
  assessedTotalValueNumeric: numeric("assessed_total_value_numeric"),
  gisAcreageSource: text("gis_acreage_source"),
  gisAcreageNumeric: numeric("gis_acreage_numeric"),
  taxAcreageSource: text("tax_acreage_source"),
  taxAcreageNumeric: numeric("tax_acreage_numeric"),
  hasAssessment: boolean("has_assessment").notNull().default(false),
  taxRecordId: text("tax_record_id"),
  attrsRaw: jsonb("attrs_raw"),
});

export const taxRecordSnapshots = pgTable("tax_record_snapshots", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => analyticsRuns.id),
  taxRecordId: text("tax_record_id").notNull(),
  taxYear: integer("tax_year").notNull(),
  valuationAsOf: date("valuation_as_of").notNull(),
  territoryType: text("territory_type").notNull(),
  ownerNameRaw: text("owner_name_raw"),
  assessedTotalValueSource: text("assessed_total_value_source"),
  assessedTotalValueNumeric: numeric("assessed_total_value_numeric"),
  parcelId: text("parcel_id"),
  joinedToGeometry: boolean("joined_to_geometry").notNull().default(false),
  attrsRaw: jsonb("attrs_raw"),
});

export const parcelFeatures = pgTable("parcel_features", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id")
    .notNull()
    .references(() => parcelSnapshots.id),
  runId: text("run_id")
    .notNull()
    .references(() => analyticsRuns.id),
  parcelId: text("parcel_id").notNull(),
  taxYear: integer("tax_year").notNull(),
  gisAcreage: numeric("gis_acreage"),
  taxAcreage: numeric("tax_acreage"),
  land: numeric("land"),
  building: numeric("building"),
  taxable: numeric("taxable"),
  exemption: numeric("exemption"),
  landPlusBuilding: numeric("land_plus_building"),
  taxableMinusLandBuilding: numeric("taxable_minus_land_building"),
  valuePerGisAcre: numeric("value_per_gis_acre"),
  landPerGisAcre: numeric("land_per_gis_acre"),
  buildingPerGisAcre: numeric("building_per_gis_acre"),
  buildingLandRatio: numeric("building_land_ratio"),
  vacantFlag: boolean("vacant_flag").notNull().default(false),
  unjoinedFlag: boolean("unjoined_flag").notNull().default(false),
  tplFamily: text("tpl_family"),
  multiLotGroupId: text("multi_lot_group_id"),
  valuationAllocation: text("valuation_allocation"),
});

export const parcelValuationScores = pgTable("parcel_valuation_scores", {
  id: text("id").primaryKey(),
  featureId: text("feature_id")
    .notNull()
    .references(() => parcelFeatures.id),
  parcelId: text("parcel_id").notNull(),
  taxYear: integer("tax_year").notNull(),
  municipalityId: text("municipality_id"),
  vacantFlag: boolean("vacant_flag").notNull().default(false),
  scored: boolean("scored").notNull().default(false),
  skipReason: text("skip_reason"),
  taxableTownship: jsonb("taxable_township"),
  taxableBand: jsonb("taxable_band"),
  taxableKnn: jsonb("taxable_knn"),
  valuePerAcreTownship: jsonb("value_per_acre_township"),
  valuePerAcreBand: jsonb("value_per_acre_band"),
  valuePerAcreKnn: jsonb("value_per_acre_knn"),
});

export const parcelSpatialFeatures = pgTable("parcel_spatial_features", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull(),
  featureId: text("feature_id").references(() => parcelFeatures.id),
  taxYear: integer("tax_year"),
  centroidX: numeric("centroid_x"),
  centroidY: numeric("centroid_y"),
  areaM2: numeric("area_m2"),
  perimeterM: numeric("perimeter_m"),
  compactness: numeric("compactness"),
  bbox: jsonb("bbox"),
  nnDistanceM: numeric("nn_distance_m"),
  neighborCountK: integer("neighbor_count_k").notNull().default(0),
  touchCount: integer("touch_count").notNull().default(0),
  lagTaxableKnn: numeric("lag_taxable_knn"),
  lagValuePerAcreKnn: numeric("lag_value_per_acre_knn"),
  lagTaxableKnnN: integer("lag_taxable_knn_n").notNull().default(0),
  lagResidualTaxableKnn: numeric("lag_residual_taxable_knn"),
  lagTaxableTouch: numeric("lag_taxable_touch"),
  lagValuePerAcreTouch: numeric("lag_value_per_acre_touch"),
  lagTaxableTouchN: integer("lag_taxable_touch_n").notNull().default(0),
  lagResidualTaxableTouch: numeric("lag_residual_taxable_touch"),
  lagSkipReason: text("lag_skip_reason"),
});

export const spatialNeighbors = pgTable("spatial_neighbors", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull(),
  neighborId: text("neighbor_id").notNull(),
  kind: text("kind").notNull(),
  distanceM: numeric("distance_m").notNull(),
  rank: integer("rank"),
});

export const ownerEntities = pgTable("owner_entities", {
  id: text("id").primaryKey(),
  nameNormalized: text("name_normalized").notNull(),
  entityType: text("entity_type").notNull(),
  institutionalBaseline: boolean("institutional_baseline").notNull().default(false),
  rawExamples: jsonb("raw_examples"),
  parcelCount: integer("parcel_count").notNull().default(0),
  gisAcres: numeric("gis_acres"),
  taxable: numeric("taxable"),
  townshipCount: integer("township_count").notNull().default(0),
  townshipIds: jsonb("township_ids"),
  maxTownshipAcreShare: numeric("max_township_acre_share"),
  utAcreShare: numeric("ut_acre_share"),
  utTaxableShare: numeric("ut_taxable_share"),
  contiguousComponentCount: integer("contiguous_component_count").notNull().default(0),
  maxContiguousGisAcres: numeric("max_contiguous_gis_acres"),
  maxKnnNeighborhoodAcreShare: numeric("max_knn_neighborhood_acre_share"),
});

export const ownerNameEdges = pgTable("owner_name_edges", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  target: text("target").notNull(),
  type: text("type").notNull(),
  score: numeric("score"),
  evidence: jsonb("evidence"),
});

export const ownershipClusters = pgTable("ownership_clusters", {
  id: text("id").primaryKey(),
  nameNormalized: text("name_normalized").notNull(),
  parcelIds: jsonb("parcel_ids"),
  gisAcres: numeric("gis_acres"),
});

export const observations = pgTable("observations", {
  id: text("id").primaryKey(),
  observationType: text("observation_type").notNull(),
  unit: text("unit").notNull(),
  severity: text("severity").notNull(),
  confidence: real("confidence"),
  priority: text("priority").notNull(),
  dimensions: jsonb("dimensions"),
  scope: text("scope"),
  parcelIds: jsonb("parcel_ids"),
  ownerIds: jsonb("owner_ids"),
  clusterIds: jsonb("cluster_ids"),
  peerGroup: jsonb("peer_group"),
  observed: numeric("observed"),
  expected: numeric("expected"),
  residual: numeric("residual"),
  percentile: numeric("percentile"),
  madScore: numeric("mad_score"),
  evidence: jsonb("evidence"),
  relationships: jsonb("relationships"),
  alternativeExplanations: jsonb("alternative_explanations"),
  dataQualityFlags: jsonb("data_quality_flags"),
  hypotheses: jsonb("hypotheses"),
  recommendedFollowups: jsonb("recommended_followups"),
  calculationProvenance: jsonb("calculation_provenance"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  taxYear: integer("tax_year").notNull(),
});

export const investigatorHypotheses = pgTable("investigator_hypotheses", {
  id: text("id").primaryKey(),
  observationId: text("observation_id")
    .notNull()
    .references(() => observations.id),
  what: text("what"),
  howUnusual: text("how_unusual"),
  comparisonPopulation: text("comparison_population"),
  classification: text("classification").notNull(),
  alternativeExplanations: jsonb("alternative_explanations"),
  falsifiers: jsonb("falsifiers"),
  nextData: jsonb("next_data"),
  citedValues: jsonb("cited_values"),
  missingFields: jsonb("missing_fields"),
  notes: text("notes"),
});
