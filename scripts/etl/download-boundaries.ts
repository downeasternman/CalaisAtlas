/**
 * Download the City of Calais municipal boundary from Maine GeoLibrary METWP.
 * Writes processed GeoJSON, calais-bbox.json, and updates source/coverage manifests.
 */
import path from "node:path";
import {
  METWP_URL,
  PROCESSED_DIR,
  RAW_DIR,
  MANIFEST_DIR,
  bboxFromFeatureCollection,
  ensureDirs,
  fetchGeoJson,
  padBbox,
  slugify,
  todayIsoDate,
  writeJson,
  readJson,
} from "./paths";

async function fetchCalaisMetwp(): Promise<GeoJSON.FeatureCollection> {
  const params = new URLSearchParams({
    where: "COUNTY='Washington' AND TOWN='Calais'",
    outFields: "TOWN,COUNTY,GEOCODE",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  return fetchGeoJson(`${METWP_URL}?${params.toString()}`);
}

async function main() {
  await ensureDirs(RAW_DIR, PROCESSED_DIR, MANIFEST_DIR);

  console.log("Downloading Calais municipal boundary (METWP)...");
  const municipalities = await fetchCalaisMetwp();
  console.log(`  ${municipalities.features.length} municipal polygon(s)`);

  const normalized: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: municipalities.features.map((f) => {
      const town = String(f.properties?.TOWN ?? "Calais");
      const geocode = f.properties?.GEOCODE;
      return {
        type: "Feature",
        properties: {
          id: slugify(town),
          name: town,
          county: String(f.properties?.COUNTY ?? "Washington"),
          geocode: geocode != null ? String(geocode) : "29070",
          is_organized: true,
        },
        geometry: f.geometry,
      };
    }),
  };

  const cityOutline: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: normalized.features.map((f) => ({
      type: "Feature" as const,
      properties: {
        id: "calais",
        name: "Calais",
        county: String(f.properties?.county ?? "Washington"),
        cntycode: null,
      },
      geometry: f.geometry,
    })),
  };

  const bbox = bboxFromFeatureCollection(normalized);
  const paddedBbox = padBbox(bbox, 0.015);
  const asOfDate = todayIsoDate();

  await writeJson(path.join(RAW_DIR, "metwp-calais.geojson"), municipalities);
  await writeJson(path.join(PROCESSED_DIR, "municipalities.geojson"), normalized);
  await writeJson(path.join(PROCESSED_DIR, "county.geojson"), cityOutline);

  const bboxPayload = {
    bbox,
    paddedBbox,
    asOfDate,
    sourceId: "me-geolibrary-boundaries",
  };
  await writeJson(path.join(PROCESSED_DIR, "calais-bbox.json"), bboxPayload);
  await writeJson(path.join(PROCESSED_DIR, "county-bbox.json"), bboxPayload);

  const municipalityList = normalized.features.map((f) => {
    const featureBbox = bboxFromFeatureCollection({
      type: "FeatureCollection",
      features: [f],
    });
    return {
      id: f.properties?.id,
      name: f.properties?.name,
      geocode: f.properties?.geocode,
      isOrganized: true,
      bbox: featureBbox,
      centroid: [
        (featureBbox[0] + featureBbox[2]) / 2,
        (featureBbox[1] + featureBbox[3]) / 2,
      ] as [number, number],
    };
  });
  await writeJson(path.join(PROCESSED_DIR, "municipalities.json"), municipalityList);

  const sourcesPath = path.join(MANIFEST_DIR, "sources.json");
  const sources = await readJson<{
    version: number;
    description: string;
    sources: Array<Record<string, unknown>>;
  }>(sourcesPath);

  for (const s of sources.sources) {
    if (s.id === "me-geolibrary-boundaries") {
      s.asOfDate = asOfDate;
      s.url =
        "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/ArcGIS/rest/services/METWP_dissolved/FeatureServer";
      s.featureCount = normalized.features.length;
      s.notes = "City of Calais municipal boundary polygon";
    }
  }
  await writeJson(sourcesPath, sources);

  const coveragePath = path.join(MANIFEST_DIR, "coverage.json");
  const coverage: {
    version: number;
    description: string;
    updatedAt: string;
    municipalities: Record<string, Record<string, unknown>>;
  } = {
    version: 1,
    description:
      "Per-municipality coverage status for parcel geometry, ownership, and tax data",
    updatedAt: new Date().toISOString(),
    municipalities: {},
  };
  for (const m of municipalityList) {
    const id = String(m.id);
    coverage.municipalities[id] = {
      name: m.name,
      hasParcelGeometry: false,
      hasOwnership: false,
      hasTaxAssessment: false,
      parcelCount: 0,
      notes: "Boundary geometry available; ownership/tax pending Phase D",
    };
  }
  await writeJson(coveragePath, coverage);

  console.log("Done.");
  console.log(`  bbox: [${bbox.map((n) => n.toFixed(4)).join(", ")}]`);
  console.log(`  wrote ${path.join(PROCESSED_DIR, "municipalities.geojson")}`);
  console.log(`  wrote ${path.join(PROCESSED_DIR, "calais-bbox.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
