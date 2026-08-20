import { projectPolygon } from "@/lib/analytics/polygon-metrics";

/** Square meters per acre (international). */
export const SQ_METERS_PER_ACRE = 4046.8564224;

/**
 * GIS acreage from polygon geometry via projected shoelace area.
 * Returns null when geometry is missing or area is not positive.
 */
export function gisAcresFromGeometry(geometry: GeoJSON.Geometry | null): number | null {
  if (!geometry) return null;

  if (geometry.type === "Polygon") {
    const projected = projectPolygon(geometry);
    if (!projected || !(projected.areaM2 > 0)) return null;
    return projected.areaM2 / SQ_METERS_PER_ACRE;
  }

  if (geometry.type === "MultiPolygon") {
    let areaM2 = 0;
    for (const coordinates of geometry.coordinates) {
      const projected = projectPolygon({ type: "Polygon", coordinates });
      if (projected) areaM2 += projected.areaM2;
    }
    if (!(areaM2 > 0)) return null;
    return areaM2 / SQ_METERS_PER_ACRE;
  }

  return null;
}

/** Format acres for persistence on parcel records (string | null). */
export function formatGisAcreage(acres: number | null): string | null {
  if (acres == null || !(acres > 0) || Number.isNaN(acres)) return null;
  return String(Number(acres.toFixed(6)));
}
