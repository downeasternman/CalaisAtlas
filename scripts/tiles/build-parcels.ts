/**
 * Build parcel PMTiles from joined UT + organized parcel GeoJSON.
 */
import path from "node:path";
import { classifyParcelSymbology } from "@/lib/map/parcel-coverage";
import { buildPmtilesFromLayers, readBbox, readGeoJson } from "./build-pmtiles";
import { ORGANIZED_PARCELS_GEOJSON, UT_PARCELS_GEOJSON } from "../etl/tax/paths";
import { PROCESSED_DIR, TILES_DIR, ensureDirs, readJson } from "../etl/paths";

function mergeGeoJson(
  ut: GeoJSON.FeatureCollection,
  organized: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [...ut.features, ...organized.features],
  };
}

async function loadOrganizedGeoJson(): Promise<GeoJSON.FeatureCollection> {
  try {
    return await readGeoJson(ORGANIZED_PARCELS_GEOJSON);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

async function main() {
  await ensureDirs(TILES_DIR);

  const utGeojson = await readGeoJson(UT_PARCELS_GEOJSON);
  const organizedGeojson = await loadOrganizedGeoJson();
  const geojson = mergeGeoJson(utGeojson, organizedGeojson);
  const parcels = await readJson<
    Array<{
      id: string;
      municipalityId: string;
      ownerName: string | null;
      assessedTotalValue: string | null;
      assessedExemptionValue?: string | null;
      hasTreeGrowth?: boolean | null;
      joinConfidence?: number | null;
      attrsRaw?: Record<string, unknown> | null;
    }>
  >(path.join(PROCESSED_DIR, "parcels.json"));

  const parcelMeta = new Map(parcels.map((p) => [p.id, p]));

  const tileFeatures: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: geojson.features.map((f) => {
      const id = String(f.properties?.id ?? "");
      const meta = parcelMeta.get(id);
      const symbology = classifyParcelSymbology({
        ownerName: meta?.ownerName,
        assessedTotalValue: meta?.assessedTotalValue,
        assessedExemptionValue: meta?.assessedExemptionValue,
        hasTreeGrowth: meta?.hasTreeGrowth,
        attrsRaw: meta?.attrsRaw,
        joinConfidence: meta?.joinConfidence,
      });
      return {
        type: "Feature",
        properties: {
          id,
          municipalityId: String(f.properties?.municipalityId ?? meta?.municipalityId ?? ""),
          mapLot: String(
            f.properties?.mapBkLot ?? f.properties?.planLot ?? meta?.mapLot ?? "",
          ),
          tpl: f.properties?.tpl != null ? String(f.properties.tpl) : "",
          coverageTier: symbology.coverageTier,
          program: symbology.program,
          joinLow: symbology.joinLow,
        },
        geometry: f.geometry!,
      };
    }),
  };

  let bbox: [number, number, number, number];
  try {
    bbox = await readBbox(path.join(PROCESSED_DIR, "county-bbox.json"));
  } catch {
    bbox = [-67.95, 44.45, -67.0, 45.35];
  }

  console.log("Building parcel PMTiles...");
  await buildPmtilesFromLayers({
    outputName: "parcels",
    layers: [
      {
        name: "parcels",
        geojson: tileFeatures,
        minZoom: 10,
        maxZoom: 14,
      },
    ],
    minZoom: 10,
    maxZoom: 14,
    bbox,
    attribution: "Maine GeoLibrary / Maine Revenue Services",
    description: "Washington County UT and organized-town parcel boundaries",
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
