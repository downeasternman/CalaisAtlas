import type { StyleSpecification } from "maplibre-gl";
import { LAYER_IDS, SOURCE_IDS } from "./layers";
import {
  parcelCoverageFillExpression,
  parcelCoverageLineExpression,
} from "./parcel-coverage";

function resolveTilesBase(origin?: string): string {
  const path =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAP_TILES_BASE
      ? process.env.NEXT_PUBLIC_MAP_TILES_BASE
      : "/tiles";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (origin) {
    return `${origin.replace(/\/$/, "")}${normalized}`;
  }
  return normalized;
}

function parcelLayers(): StyleSpecification["layers"] {
  return [
    {
      id: LAYER_IDS.PARCEL_FILL,
      type: "fill",
      source: SOURCE_IDS.PARCELS,
      "source-layer": "parcels",
      minzoom: 10,
      paint: {
        "fill-color": parcelCoverageFillExpression(),
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          [
            "case",
            ["==", ["get", "joinLow"], 1],
            0.06,
            0.08,
          ],
          13,
          [
            "case",
            ["==", ["get", "joinLow"], 1],
            0.18,
            0.22,
          ],
        ],
      },
    },
    {
      id: LAYER_IDS.PARCEL_LINE,
      type: "line",
      source: SOURCE_IDS.PARCELS,
      "source-layer": "parcels",
      minzoom: 10,
      paint: {
        "line-color": parcelCoverageLineExpression(),
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0.3,
          14,
          1.4,
        ],
        "line-opacity": 0.85,
      },
    },
    {
      id: LAYER_IDS.PARCEL_SELECTED,
      type: "line",
      source: SOURCE_IDS.PARCELS,
      "source-layer": "parcels",
      minzoom: 10,
      filter: ["==", ["get", "id"], ""],
      paint: {
        "line-color": "#1a3a4a",
        "line-width": 3,
        "line-opacity": 1,
      },
    },
  ];
}

/**
 * Coastal Maine atlas style backed by local PMTiles.
 * Pass `origin` (e.g. window.location.origin) so pmtiles:// URLs are absolute.
 */
export function buildAtlasStyle(origin?: string): StyleSpecification {
  const tilesBase = resolveTilesBase(origin);
  const basemapUrl = `pmtiles://${tilesBase}/basemap.pmtiles`;
  const boundariesUrl = `pmtiles://${tilesBase}/boundaries.pmtiles`;
  const parcelsUrl = `pmtiles://${tilesBase}/parcels.pmtiles`;

  return {
    version: 8,
    name: "washington-county-atlas",
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      [SOURCE_IDS.BASEMAP]: {
        type: "vector",
        url: basemapUrl,
        attribution: "© OpenStreetMap contributors · Maine GeoLibrary",
      },
      [SOURCE_IDS.BOUNDARIES]: {
        type: "vector",
        url: boundariesUrl,
        attribution: "Maine GeoLibrary (METWP / CNTY24P)",
      },
      [SOURCE_IDS.PARCELS]: {
        type: "vector",
        url: parcelsUrl,
        attribution: "Maine Revenue Services UT Parcels",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#1f4a5c",
        },
      },
      {
        id: LAYER_IDS.BASEMAP_LAND,
        type: "fill",
        source: SOURCE_IDS.BASEMAP,
        "source-layer": "land",
        paint: {
          "fill-color": "#e8e4d9",
          "fill-opacity": 1,
        },
      },
      {
        id: LAYER_IDS.BASEMAP_WATER,
        type: "fill",
        source: SOURCE_IDS.BASEMAP,
        "source-layer": "water",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#2d5a6b",
          "fill-opacity": 0.95,
        },
      },
      {
        id: "water-lines",
        type: "line",
        source: SOURCE_IDS.BASEMAP,
        "source-layer": "water",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#3a7a8e",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.4,
            12,
            1.4,
            14,
            2.2,
          ],
          "line-opacity": 0.85,
        },
      },
      {
        id: LAYER_IDS.ROADS_MINOR,
        type: "line",
        source: SOURCE_IDS.BASEMAP,
        "source-layer": "roads",
        filter: [
          "match",
          ["get", "highway"],
          ["residential", "service", "unclassified", "track"],
          true,
          false,
        ],
        minzoom: 10,
        paint: {
          "line-color": "#c4bba8",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.4,
            14,
            1.6,
          ],
        },
      },
      {
        id: LAYER_IDS.ROADS_MAJOR,
        type: "line",
        source: SOURCE_IDS.BASEMAP,
        "source-layer": "roads",
        filter: [
          "match",
          ["get", "highway"],
          ["motorway", "trunk", "primary", "secondary", "tertiary"],
          true,
          false,
        ],
        minzoom: 7,
        paint: {
          "line-color": "#9a8f7a",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.8,
            11,
            1.6,
            14,
            3.2,
          ],
        },
      },
      {
        id: LAYER_IDS.MUNICIPALITY_FILL,
        type: "fill",
        source: SOURCE_IDS.BOUNDARIES,
        "source-layer": "municipalities",
        paint: {
          "fill-color": "#d4cfc0",
          "fill-opacity": 0.05,
        },
      },
      {
        id: LAYER_IDS.MUNICIPALITY_LINE,
        type: "line",
        source: SOURCE_IDS.BOUNDARIES,
        "source-layer": "municipalities",
        paint: {
          "line-color": "#5a6a72",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            0.4,
            10,
            0.8,
            13,
            1.2,
          ],
          "line-opacity": 0.75,
        },
      },
      {
        id: "county-outline",
        type: "line",
        source: SOURCE_IDS.BOUNDARIES,
        "source-layer": "county",
        paint: {
          "line-color": "#1a3a4a",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            1.2,
            10,
            2.4,
            13,
            3.2,
          ],
          "line-opacity": 0.95,
        },
      },
      {
        id: LAYER_IDS.MUNICIPALITY_LABEL,
        type: "symbol",
        source: SOURCE_IDS.BOUNDARIES,
        "source-layer": "municipalities",
        minzoom: 8,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            10,
            12,
            12,
            14,
            14,
          ],
          "text-transform": "none",
          "text-padding": 12,
          "symbol-placement": "point",
        },
        paint: {
          "text-color": "#1a2a32",
          "text-halo-color": "#f5f3ee",
          "text-halo-width": 1.4,
        },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: SOURCE_IDS.BASEMAP,
        "source-layer": "places",
        minzoom: 9,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-optional": true,
          "text-padding": 16,
        },
        paint: {
          "text-color": "#4a5a62",
          "text-halo-color": "#e8e4d9",
          "text-halo-width": 1.2,
        },
      },
      ...parcelLayers(),
    ],
  };
}
