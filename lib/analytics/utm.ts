/** NAD83 / UTM zone 19N (EPSG:26919). Washington County longitude is inside zone 19. */

export type XY = { x: number; y: number };

const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const LON0 = (-69 * Math.PI) / 180;
const FALSE_EASTING = 500_000;

export function lonLatToUtm19n(lon: number, lat: number): XY {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  const sinφ = Math.sin(φ);
  const cosφ = Math.cos(φ);
  const tanφ = Math.tan(φ);
  const n = A / Math.sqrt(1 - E2 * sinφ * sinφ);
  const t = tanφ * tanφ;
  const c = EP2 * cosφ * cosφ;
  const aa = (λ - LON0) * cosφ;
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const m =
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * φ -
      ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * φ) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * φ) -
      ((35 * e6) / 3072) * Math.sin(6 * φ));
  const aa2 = aa * aa;
  const aa3 = aa2 * aa;
  const aa4 = aa2 * aa2;
  const aa5 = aa4 * aa;
  const aa6 = aa3 * aa3;
  const x =
    K0 *
      n *
      (aa +
        ((1 - t + c) * aa3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * aa5) / 120) +
    FALSE_EASTING;
  const y =
    K0 *
    (m +
      n *
        tanφ *
        (aa2 / 2 +
          ((5 - t + 9 * c + 4 * c * c) * aa4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * aa6) / 720));
  return { x, y };
}

export function projectRing(coords: number[][]): XY[] {
  const out: XY[] = [];
  for (const pt of coords) {
    const lon = pt[0];
    const lat = pt[1];
    if (lon == null || lat == null) continue;
    out.push(lonLatToUtm19n(lon, lat));
  }
  return out;
}

export function hypotXY(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
