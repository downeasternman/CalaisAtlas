/**
 * Build parcel PMTiles from Calais organized parcel GeoJSON.
 */
import path from "node:path";
import { polygonCentroid } from "@/lib/analytics/centroid";
import { CALAIS_BBOX } from "@/lib/geo/calais";
import {
  COHORT_NONE,
  NO_VALUE_PCT,
  cohortOrMissing,
  flagOrMissing,
  valuePctOrMissing,
} from "@/lib/map/parcel-valuation";
import { buildPmtilesFromLayers, readBbox, readGeoJson } from "./build-pmtiles";
import { ORGANIZED_PARCELS_GEOJSON } from "../etl/tax/paths";
import { PROCESSED_DIR, TILES_DIR, ensureDirs, readJson } from "../etl/paths";

type ParcelMeta = {
  id: string;
  municipalityId: string;
  mapLot?: string | null;
  valuePct?: number | null;
  cohort?: number | null;
  bookFullyExempt?: boolean | null;
  fullyExempt?: boolean | null;
  homestead?: boolean | null;
};

async function loadOrganizedGeoJson(): Promise<GeoJSON.FeatureCollection> {
  try {
    return await readGeoJson(ORGANIZED_PARCELS_GEOJSON);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

function centroidForGeometry(geometry: GeoJSON.Geometry | null): GeoJSON.Point | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    const c = polygonCentroid(geometry);
    if (!c) return null;
    return { type: "Point", coordinates: [c.lon, c.lat] };
  }
  if (geometry.type === "MultiPolygon") {
    const first = geometry.coordinates[0];
    if (!first) return null;
    const c = polygonCentroid({ type: "Polygon", coordinates: first });
    if (!c) return null;
    return { type: "Point", coordinates: [c.lon, c.lat] };
  }
  return null;
}

async function main() {
  await ensureDirs(TILES_DIR);

  const geojson = await loadOrganizedGeoJson();
  const parcels = await readJson<ParcelMeta[]>(path.join(PROCESSED_DIR, "parcels.json"));
  const parcelMeta = new Map(parcels.map((p) => [p.id, p]));

  const parcelFeatures: GeoJSON.Feature[] = [];
  const homesteadFeatures: GeoJSON.Feature[] = [];

  for (const f of geojson.features) {
    const id = String(f.properties?.id ?? "");
    const meta = parcelMeta.get(id);
    if (!meta) continue;

    const valuePct = valuePctOrMissing(meta.valuePct ?? NO_VALUE_PCT);
    const cohort = cohortOrMissing(meta.cohort ?? COHORT_NONE);
    const bookFullyExempt = flagOrMissing(meta.bookFullyExempt ?? meta.fullyExempt ?? false);
    const homestead = flagOrMissing(meta.homestead ?? false);
    const props = {
      id,
      municipalityId: String(f.properties?.municipalityId ?? meta?.municipalityId ?? ""),
      mapLot: String(f.properties?.mapBkLot ?? meta?.mapLot ?? ""),
      valuePct,
      cohort,
      bookFullyExempt,
      fullyExempt: bookFullyExempt,
      homestead,
    };

    parcelFeatures.push({
      type: "Feature",
      properties: props,
      geometry: f.geometry!,
    });

    if (homestead === 1) {
      const point = centroidForGeometry(f.geometry);
      if (point) {
        homesteadFeatures.push({
          type: "Feature",
          properties: props,
          geometry: point,
        });
      }
    }
  }

  const tileFeatures: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: parcelFeatures,
  };
  const homesteadPoints: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: homesteadFeatures,
  };

  let bbox: [number, number, number, number];
  try {
    bbox = await readBbox(path.join(PROCESSED_DIR, "calais-bbox.json"));
  } catch {
    bbox = CALAIS_BBOX;
  }

  console.log(
    `Building parcel PMTiles (${homesteadFeatures.length} homestead markers)...`,
  );
  await buildPmtilesFromLayers({
    outputName: "parcels",
    layers: [
      {
        name: "parcels",
        geojson: tileFeatures,
        minZoom: 10,
        maxZoom: 14,
      },
      {
        name: "homestead-points",
        geojson: homesteadPoints,
        minZoom: 11,
        maxZoom: 14,
      },
    ],
    minZoom: 10,
    maxZoom: 14,
    bbox,
    attribution: "Maine GeoLibrary / City of Calais assessing",
    description:
      "City of Calais parcels colored by assessed-total-per-acre percentile within improved/unimproved cohorts",
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
