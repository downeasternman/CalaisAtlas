/**
 * Build basemap.pmtiles: land (municipal fills), water, roads, places.
 */
import path from "node:path";
import { PROCESSED_DIR } from "../etl/paths";
import { buildPmtilesFromLayers, readBbox, readGeoJson } from "./build-pmtiles";

async function main() {
  const bbox = await readBbox(path.join(PROCESSED_DIR, "calais-bbox.json"));
  const municipalities = await readGeoJson(
    path.join(PROCESSED_DIR, "municipalities.geojson"),
  );
  const water = await readGeoJson(path.join(PROCESSED_DIR, "osm-water.geojson"));
  const roads = await readGeoJson(path.join(PROCESSED_DIR, "osm-roads.geojson"));
  const places = await readGeoJson(path.join(PROCESSED_DIR, "osm-places.geojson"));

  console.log("Building basemap.pmtiles...");
  await buildPmtilesFromLayers({
    outputName: "basemap",
    minZoom: 5,
    maxZoom: 14,
    bbox,
    attribution:
      "© OpenStreetMap contributors; Maine GeoLibrary municipal boundaries",
    description: "Calais Atlas basemap (land, water, roads, places)",
    layers: [
      { name: "land", geojson: municipalities, minZoom: 5, maxZoom: 14 },
      { name: "water", geojson: water, minZoom: 5, maxZoom: 14 },
      { name: "roads", geojson: roads, minZoom: 7, maxZoom: 14 },
      { name: "places", geojson: places, minZoom: 8, maxZoom: 14 },
    ],
  });
  console.log("Basemap build complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
