export const LAYER_IDS = {
  BASEMAP_LAND: "basemap-land",
  BASEMAP_WATER: "basemap-water",
  ROADS_MAJOR: "roads-major",
  ROADS_MINOR: "roads-minor",
  MUNICIPALITY_FILL: "municipality-fill",
  MUNICIPALITY_LINE: "municipality-line",
  MUNICIPALITY_LABEL: "municipality-label",
  PARCEL_FILL: "parcel-fill",
  PARCEL_LINE: "parcel-line",
  PARCEL_SELECTED: "parcel-selected",
} as const;

export type LayerId = (typeof LAYER_IDS)[keyof typeof LAYER_IDS];

/**
 * Source ID constants for PMTiles and other map sources.
 */
export const SOURCE_IDS = {
  BASEMAP: "basemap",
  BOUNDARIES: "boundaries",
  PARCELS: "parcels",
} as const;

export type SourceId = (typeof SOURCE_IDS)[keyof typeof SOURCE_IDS];
