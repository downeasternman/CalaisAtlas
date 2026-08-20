/**
 * Build boundaries.pmtiles: municipal outlines + county outline.
 */
import path from "node:path";
import { PROCESSED_DIR } from "../etl/paths";
import { buildPmtilesFromLayers, readBbox, readGeoJson } from "./build-pmtiles";

async function main() {
  const bbox = await readBbox(path.join(PROCESSED_DIR, "calais-bbox.json"));
  const municipalities = await readGeoJson(
    path.join(PROCESSED_DIR, "municipalities.geojson"),
  );
  const county = await readGeoJson(path.join(PROCESSED_DIR, "county.geojson"));

  console.log("Building boundaries.pmtiles...");
  await buildPmtilesFromLayers({
    outputName: "boundaries",
    minZoom: 5,
    maxZoom: 14,
    bbox,
    attribution: "Maine GeoLibrary (METWP / CNTY24P)",
    description: "City of Calais municipal boundary",
    layers: [
      { name: "municipalities", geojson: municipalities, minZoom: 5, maxZoom: 14 },
      { name: "county", geojson: county, minZoom: 5, maxZoom: 14 },
    ],
  });
  console.log("Boundaries build complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
