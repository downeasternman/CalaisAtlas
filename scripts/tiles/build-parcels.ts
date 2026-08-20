/**
 * Build parcel PMTiles from Calais organized parcel GeoJSON.
 */
import path from "node:path";
import { classifyParcelSymbology } from "@/lib/map/parcel-coverage";
import { CALAIS_BBOX } from "@/lib/geo/calais";
import { buildPmtilesFromLayers, readBbox, readGeoJson } from "./build-pmtiles";
import { ORGANIZED_PARCELS_GEOJSON } from "../etl/tax/paths";
import { PROCESSED_DIR, TILES_DIR, ensureDirs, readJson } from "../etl/paths";

async function loadOrganizedGeoJson(): Promise<GeoJSON.FeatureCollection> {
  try {
    return await readGeoJson(ORGANIZED_PARCELS_GEOJSON);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

async function main() {
  await ensureDirs(TILES_DIR);

  const geojson = await loadOrganizedGeoJson();
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
    bbox = await readBbox(path.join(PROCESSED_DIR, "calais-bbox.json"));
  } catch {
    bbox = CALAIS_BBOX;
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
    attribution: "Maine GeoLibrary / City of Calais assessing",
    description: "City of Calais parcel boundaries",
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
