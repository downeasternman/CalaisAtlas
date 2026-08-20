/**
 * Build unified places search index from municipalities + OSM place points.
 */
import path from "node:path";
import {
  PROCESSED_DIR,
  bboxFromFeatureCollection,
  ensureDirs,
  readJson,
  slugify,
  writeJson,
} from "./paths";
import { normalizePlaceName } from "../../lib/geo/normalize";

type MunicipalityFeature = GeoJSON.Feature & {
  properties: {
    id: string;
    name: string;
    geocode?: string;
    is_organized?: boolean;
  };
};

function featureCentroid(feature: GeoJSON.Feature): [number, number] {
  const geom = feature.geometry;
  if (!geom) return [0, 0];

  if (geom.type === "Point") {
    return geom.coordinates as [number, number];
  }

  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [feature],
  };
  const [west, south, east, north] = bboxFromFeatureCollection(fc);
  return [(west + east) / 2, (south + north) / 2];
}

function featureBbox(
  feature: GeoJSON.Feature,
): [number, number, number, number] | null {
  if (!feature.geometry) return null;
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [feature],
  };
  return bboxFromFeatureCollection(fc);
}

async function main() {
  await ensureDirs(PROCESSED_DIR);

  const municipalities = await readJson<GeoJSON.FeatureCollection>(
    path.join(PROCESSED_DIR, "municipalities.geojson"),
  );
  const osmPlaces = await readJson<GeoJSON.FeatureCollection>(
    path.join(PROCESSED_DIR, "osm-places.geojson"),
  );

  const places: Array<{
    id: string;
    name: string;
    nameNormalized: string;
    placeType: string;
    municipalityId: string | null;
    rank: number;
    centroid: [number, number];
    bbox: [number, number, number, number] | null;
  }> = [];

  const municipalityList: Array<{
    id: string;
    name: string;
    geocode: string | null;
    isOrganized: boolean;
    bbox: [number, number, number, number];
    centroid: [number, number];
  }> = [];

  for (const feature of municipalities.features) {
    const props = (feature as MunicipalityFeature).properties;
    const id = props.id ?? slugify(props.name);
    const bbox = featureBbox(feature);
    if (!bbox) continue;
    const centroid = featureCentroid(feature);

    municipalityList.push({
      id,
      name: props.name,
      geocode: props.geocode != null ? String(props.geocode) : null,
      isOrganized: props.is_organized !== false,
      bbox,
      centroid,
    });

    places.push({
      id: `muni-${id}`,
      name: props.name,
      nameNormalized: normalizePlaceName(props.name),
      placeType: "municipality",
      municipalityId: id,
      rank: 100,
      centroid,
      bbox,
    });
  }

  for (const feature of osmPlaces.features) {
    const name = feature.properties?.name;
    if (!name || typeof name !== "string") continue;

    const placeType = (feature.properties?.place as string) ?? "populated_place";
    const osmId = feature.properties?.osm_id;
    const id = `osm-${osmId ?? slugify(name)}`;
    const centroid =
      feature.geometry?.type === "Point"
        ? (feature.geometry.coordinates as [number, number])
        : featureCentroid(feature);

    places.push({
      id,
      name,
      nameNormalized: normalizePlaceName(name),
      placeType: "populated_place",
      municipalityId: null,
      rank: placeType === "city" ? 60 : placeType === "town" ? 50 : 30,
      centroid,
      bbox: null,
    });
  }

  await writeJson(path.join(PROCESSED_DIR, "places.json"), places);
  await writeJson(path.join(PROCESSED_DIR, "municipalities.json"), municipalityList);

  console.log(`Wrote ${places.length} places (${municipalityList.length} municipalities)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
