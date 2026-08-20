/**
 * Download OSM roads, water, and place features for the City of Calais.
 * Uses Overpass API with the Calais (padded) bbox.
 */
import path from "node:path";
import {
  PROCESSED_DIR,
  RAW_DIR,
  MANIFEST_DIR,
  DEFAULT_CALAIS_BBOX,
  ensureDirs,
  readJson,
  writeJson,
  todayIsoDate,
} from "./paths";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"; // primary; mirrors tried in runOverpass

type BboxFile = {
  bbox: [number, number, number, number];
  paddedBbox?: [number, number, number, number];
};

function overpassBbox([west, south, east, north]: [number, number, number, number]): string {
  // Overpass uses south,west,north,east
  return `${south},${west},${north},${east}`;
}

async function runOverpass(query: string): Promise<GeoJSON.FeatureCollection> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "CalaisAtlas/0.1.0 (local research atlas)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        const text = await res.text();
        lastError = new Error(`Overpass failed ${res.status} at ${endpoint}: ${text.slice(0, 200)}`);
        continue;
      }
      const data = (await res.json()) as {
        elements?: Array<{
          type: string;
          id: number;
          lat?: number;
          lon?: number;
          tags?: Record<string, string>;
          geometry?: Array<{ lat: number; lon: number }>;
        }>;
      };
      return elementsToFeatureCollection(data.elements ?? []);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Overpass request failed");
}

function elementsToFeatureCollection(
  elements: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
  }>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === "node" && el.lat != null && el.lon != null) {
      features.push({
        type: "Feature",
        properties: {
          osm_id: el.id,
          name: tags.name ?? null,
          place: tags.place ?? null,
          kind: "place",
        },
        geometry: { type: "Point", coordinates: [el.lon, el.lat] },
      });
      continue;
    }

    if (!el.geometry || el.geometry.length < 2) continue;
    const coords = el.geometry.map((g) => [g.lon, g.lat] as [number, number]);
    const isPolygon =
      tags.natural === "water" ||
      tags.waterway === "riverbank" ||
      tags.landuse === "reservoir" ||
      Boolean(tags.water);

    if (isPolygon && coords.length >= 4) {
      const ring = [...coords];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push(first);
      }
      features.push({
        type: "Feature",
        properties: {
          osm_id: el.id,
          name: tags.name ?? null,
          kind: "water",
          waterway: tags.waterway ?? null,
          natural: tags.natural ?? null,
        },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    } else {
      features.push({
        type: "Feature",
        properties: {
          osm_id: el.id,
          name: tags.name ?? null,
          kind: tags.highway ? "road" : tags.waterway ? "stream" : "line",
          highway: tags.highway ?? null,
          waterway: tags.waterway ?? null,
        },
        geometry: { type: "LineString", coordinates: coords },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetries(
  label: string,
  query: string,
  attempts = 3,
): Promise<GeoJSON.FeatureCollection> {
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      if (i > 0) {
        const wait = 15_000 * i;
        console.log(`    retry ${i + 1}/${attempts} after ${wait / 1000}s...`);
        await sleep(wait);
      }
      const fc = await runOverpass(query);
      return fc;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`    ${label} attempt ${i + 1} failed: ${lastError.message.slice(0, 120)}`);
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function main() {
  await ensureDirs(RAW_DIR, PROCESSED_DIR, MANIFEST_DIR);

  let bbox = DEFAULT_CALAIS_BBOX;
  try {
    const bboxFile = await readJson<BboxFile>(path.join(PROCESSED_DIR, "calais-bbox.json"));
    bbox = bboxFile.paddedBbox ?? bboxFile.bbox;
  } catch {
    console.warn("calais-bbox.json missing; using default bbox. Run download-boundaries first.");
  }

  const bb = overpassBbox(bbox);
  console.log(`Fetching OSM via Overpass for bbox ${bb}...`);

  const waterQuery = `
    [out:json][timeout:180];
    (
      way["natural"="water"](${bb});
      way["waterway"="riverbank"](${bb});
      way["water"](${bb});
      way["waterway"="river"](${bb});
      way["waterway"="stream"](${bb});
    );
    out geom;
  `;

  const roadQuery = `
    [out:json][timeout:180];
    (
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track)$"](${bb});
    );
    out geom;
  `;

  const placeQuery = `
    [out:json][timeout:90];
    (
      node["place"~"^(city|town|village|hamlet)$"](${bb});
    );
    out body;
  `;

  console.log("  water...");
  const water = await fetchWithRetries("water", waterQuery);
  console.log(`    ${water.features.length} features`);
  await writeJson(path.join(PROCESSED_DIR, "osm-water.geojson"), water);
  await sleep(10_000);

  console.log("  roads...");
  const roads = await fetchWithRetries("roads", roadQuery);
  console.log(`    ${roads.features.length} features`);
  await writeJson(path.join(PROCESSED_DIR, "osm-roads.geojson"), roads);
  await sleep(10_000);

  console.log("  places...");
  let places: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  try {
    places = await fetchWithRetries("places", placeQuery, 4);
    console.log(`    ${places.features.length} features`);
  } catch (err) {
    console.warn(
      `    places unavailable (${err instanceof Error ? err.message.slice(0, 80) : err}); continuing with empty places layer`,
    );
  }
  await writeJson(path.join(PROCESSED_DIR, "osm-places.geojson"), places);

  await writeJson(path.join(RAW_DIR, "osm-water.json"), water);
  await writeJson(path.join(RAW_DIR, "osm-roads.json"), roads);
  await writeJson(path.join(RAW_DIR, "osm-places.json"), places);

  const sourcesPath = path.join(MANIFEST_DIR, "sources.json");
  const sources = await readJson<{
    sources: Array<Record<string, unknown>>;
  }>(sourcesPath);

  for (const s of sources.sources) {
    if (s.id === "osm-maine-extract") {
      s.asOfDate = todayIsoDate();
      s.method = "overpass-bbox";
      s.url = "https://overpass-api.de/api/interpreter";
      s.notes =
        "Calais-clipped OSM via Overpass (roads, water, places). Same free OSM data as Geofabrik extract.";
      s.counts = {
        water: water.features.length,
        roads: roads.features.length,
        places: places.features.length,
      };
    }
  }
  await writeJson(sourcesPath, sources);

  console.log("Done. Wrote processed OSM GeoJSON layers.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
