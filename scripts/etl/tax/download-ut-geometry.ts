/**
 * Download Washington County UT parcel polygons from Maine Revenue Services ArcGIS.
 */
import path from "node:path";
import { isUtMunicipalityName } from "@/lib/tax/ut-municipalities";
import { planLotFromParts } from "@/lib/tax/plan-lot";
import { parcelIdFromTpl, geometryMapJoinKey } from "@/lib/tax/join";
import {
  DEFAULT_COUNTY_BBOX,
  PROCESSED_DIR,
  RAW_DIR,
  bboxFromFeatureCollection,
  ensureDirs,
  fetchJson,
  readJson,
  slugify,
  todayIsoDate,
  writeJson,
} from "../paths";
import { MRS_UT_PARCELS_URL, UT_PARCELS_GEOJSON } from "./paths";

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

async function fetchUtParcelsInBbox(
  bbox: [number, number, number, number],
): Promise<ArcgisFeature[]> {
  const features: ArcgisFeature[] = [];
  let offset = 0;
  const pageSize = 2000;
  const [west, south, east, north] = bbox;

  while (true) {
    const params = new URLSearchParams({
      where: "1=1",
      geometry: `${west},${south},${east},${north}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields:
        "TOWNNAME,PLAN_,LOT,TPL,PLAN_LOT,GEOCODE,CACREAGE,TOTACRES,GRANTEE,OBJECTID",
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });
    const page = await fetchJson<ArcgisResponse>(`${MRS_UT_PARCELS_URL}?${params}`);
    features.push(...page.features);
    if (!page.exceededTransferLimit && page.features.length < pageSize) break;
    if (page.features.length === 0) break;
    offset += page.features.length;
    console.log(`  fetched ${features.length} UT parcel features...`);
  }

  return features;
}

async function main() {
  await ensureDirs(RAW_DIR, PROCESSED_DIR, path.dirname(UT_PARCELS_GEOJSON));

  let bbox = DEFAULT_COUNTY_BBOX;
  try {
    const countyBbox = await readJson<{ bbox: [number, number, number, number] }>(
      path.join(PROCESSED_DIR, "county-bbox.json"),
    );
    bbox = countyBbox.bbox;
  } catch {
    console.warn("  county-bbox.json missing; using default bbox");
  }

  console.log("Downloading UT parcel geometry from MRS...");
  const rawFeatures = await fetchUtParcelsInBbox(bbox);
  console.log(`  ${rawFeatures.length} features in county bbox`);

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  for (const feature of rawFeatures) {
    const attrs = feature.attributes;
    const townName = String(attrs.TOWNNAME ?? "").trim();
    if (!townName || !isUtMunicipalityName(townName)) continue;
    if (!feature.geometry?.rings?.length) continue;

    const plan = attrs.PLAN_ != null ? String(attrs.PLAN_) : "";
    const lot = attrs.LOT != null ? String(attrs.LOT) : "";
    const planLot =
      attrs.PLAN_LOT != null
        ? String(attrs.PLAN_LOT)
        : planLotFromParts(plan, lot) ?? "";
    const tpl = attrs.TPL != null ? String(attrs.TPL) : null;
    const { mapJoinKey, tplFamily } = geometryMapJoinKey(tpl, planLot);
    const id = tpl ? parcelIdFromTpl(tpl) : `ut-${slugify(`${townName}-${planLot}`)}`;

    geojson.features.push({
      type: "Feature",
      properties: {
        id,
        municipalityId: slugify(townName),
        municipalityName: townName,
        planLot,
        tpl,
        mapJoinKey,
        tplFamily,
        geocode: attrs.GEOCODE != null ? String(attrs.GEOCODE) : null,
        acreage:
          attrs.CACREAGE != null
            ? String(attrs.CACREAGE)
            : attrs.TOTACRES != null
              ? String(attrs.TOTACRES)
              : null,
        grantee: attrs.GRANTEE != null ? String(attrs.GRANTEE) : null,
        sourceId: "mrs-ut-parcels",
      },
      geometry: ringsToPolygon(feature.geometry.rings),
    });
  }

  console.log(`  ${geojson.features.length} UT parcels kept after municipality filter`);

  const rawPath = path.join(RAW_DIR, "tax", "ut", "mrs-ut-parcels-washington.json");
  await writeJson(rawPath, { asOfDate: todayIsoDate(), featureCount: rawFeatures.length });
  await writeJson(UT_PARCELS_GEOJSON, geojson);

  const parcelBbox = bboxFromFeatureCollection(geojson);
  console.log(`  bbox: [${parcelBbox.map((n) => n.toFixed(4)).join(", ")}]`);
  console.log(`  wrote ${UT_PARCELS_GEOJSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
