/**
 * Download Washington County organized-town parcel polygons from Maine GeoLibrary.
 */
import path from "node:path";
import {
  geometryOrganizedMapJoinKey,
  organizedParcelId,
} from "@/lib/tax/organized-join";
import {
  DEFAULT_COUNTY_BBOX,
  PROCESSED_DIR,
  bboxFromFeatureCollection,
  ensureDirs,
  fetchJson,
  readJson,
  slugify,
  writeJson,
} from "../paths";
import { MEGIS_ORGANIZED_PARCELS_URL, ORGANIZED_PARCELS_GEOJSON } from "./paths";

type ArcgisFeature = {
  attributes: Record<string, unknown>;
  geometry?: { rings: number[][][] };
};

type ArcgisResponse = {
  features: ArcgisFeature[];
  exceededTransferLimit?: boolean;
};

function ringsToPolygon(rings: number[][][]): GeoJSON.Polygon {
  return { type: "Polygon", coordinates: rings };
}

async function fetchOrganizedParcels(
  bbox: [number, number, number, number],
): Promise<ArcgisFeature[]> {
  const features: ArcgisFeature[] = [];
  let offset = 0;
  const pageSize = 2000;
  const [west, south, east, north] = bbox;

  while (true) {
    const params = new URLSearchParams({
      where: "COUNTY='WASHINGTON'",
      geometry: `${west},${south},${east},${north}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "TOWN,COUNTY,GEOCODE,STATE_ID,MAP_BK_LOT,PROP_LOC,FMUPDAT,OBJECTID",
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });
    const page = await fetchJson<ArcgisResponse>(`${MEGIS_ORGANIZED_PARCELS_URL}?${params}`);
    features.push(...page.features);
    if (!page.exceededTransferLimit && page.features.length < pageSize) break;
    if (page.features.length === 0) break;
    offset += page.features.length;
    console.log(`  fetched ${features.length} organized parcel features...`);
  }

  return features;
}

async function main() {
  await ensureDirs(PROCESSED_DIR, path.dirname(ORGANIZED_PARCELS_GEOJSON));

  let bbox = DEFAULT_COUNTY_BBOX;
  try {
    const countyBbox = await readJson<{ bbox: [number, number, number, number] }>(
      path.join(PROCESSED_DIR, "county-bbox.json"),
    );
    bbox = countyBbox.bbox;
  } catch {
    console.warn("  county-bbox.json missing; using default bbox");
  }

  console.log("Downloading Washington County organized-town parcels...");
  const rawFeatures = await fetchOrganizedParcels(bbox);

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  for (const feature of rawFeatures) {
    const attrs = feature.attributes;
    const townName = String(attrs.TOWN ?? "").trim();
    if (!townName) continue;

    const municipalityId = slugify(townName);
    const geocode = String(attrs.GEOCODE ?? "").trim();
    const mapBkLot = attrs.MAP_BK_LOT != null ? String(attrs.MAP_BK_LOT).trim() : null;
    const stateId = attrs.STATE_ID != null ? String(attrs.STATE_ID).trim() : null;
    const id = organizedParcelId(municipalityId, stateId, mapBkLot);
    const mapJoinKey = geometryOrganizedMapJoinKey(geocode, mapBkLot);

    if (!feature.geometry?.rings) continue;

    geojson.features.push({
      type: "Feature",
      properties: {
        id,
        municipalityId,
        municipalityName: townName,
        geocode,
        mapBkLot,
        mapJoinKey,
        stateId,
        propLoc: attrs.PROP_LOC != null ? String(attrs.PROP_LOC) : null,
        fmUpdat: attrs.FMUPDAT != null ? String(attrs.FMUPDAT) : null,
      },
      geometry: ringsToPolygon(feature.geometry.rings),
    });
  }

  await writeJson(ORGANIZED_PARCELS_GEOJSON, geojson);
  const refinedBbox = bboxFromFeatureCollection(geojson);
  console.log(`  ${geojson.features.length} organized parcels kept`);
  console.log(`  wrote ${ORGANIZED_PARCELS_GEOJSON}`);
  console.log(`  bbox: [${refinedBbox.join(", ")}]`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
