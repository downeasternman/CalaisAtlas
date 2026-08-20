export type LonLat = { lon: number; lat: number };

const REF_LAT_RAD = (45.0 * Math.PI) / 180;
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON = 111_320 * Math.cos(REF_LAT_RAD);

export function polygonCentroid(geometry: GeoJSON.Geometry | null): LonLat | null {
  if (!geometry || geometry.type !== "Polygon") return null;
  const ring = geometry.coordinates[0];
  if (!ring || ring.length < 4) return null;
  const pts = ring.slice(0, -1);
  if (pts.length === 0) return null;
  let lon = 0;
  let lat = 0;
  for (const pt of pts) {
    lon += pt[0]!;
    lat += pt[1]!;
  }
  return { lon: lon / pts.length, lat: lat / pts.length };
}

export function distanceMeters(a: LonLat, b: LonLat): number {
  const dx = (a.lon - b.lon) * M_PER_DEG_LON;
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}
