import { hypotXY, projectRing, type XY } from "./utm";

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ProjectedPolygon {
  outer: XY[];
  holes: XY[][];
  areaM2: number;
  perimeterM: number;
  compactness: number | null;
  bbox: BBox;
  centroid: XY | null;
}

function ringVertexCount(ring: XY[]): number {
  if (ring.length < 2) return ring.length;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first.x === last.x && first.y === last.y) return ring.length - 1;
  return ring.length;
}

function ringArea(ring: XY[]): number {
  const n = ringVertexCount(ring);
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % n]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function ringLength(ring: XY[]): number {
  if (ring.length < 2) return 0;
  let p = 0;
  for (let i = 1; i < ring.length; i++) {
    p += hypotXY(ring[i - 1]!, ring[i]!);
  }
  return p;
}

function ringBBox(ring: XY[]): BBox | null {
  if (ring.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function ringCentroid(ring: XY[]): XY | null {
  const n = ringVertexCount(ring);
  if (n < 3) return null;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % n]!;
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    let x = 0;
    let y = 0;
    for (let i = 0; i < n; i++) {
      x += ring[i]!.x;
      y += ring[i]!.y;
    }
    return { x: x / n, y: y / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function isoperimetricQuotient(areaM2: number, perimeterM: number): number | null {
  if (!(areaM2 > 0) || !(perimeterM > 0)) return null;
  return (4 * Math.PI * areaM2) / (perimeterM * perimeterM);
}

export function bboxesNear(a: BBox, b: BBox, snapM: number): boolean {
  return (
    a.minX <= b.maxX + snapM &&
    a.maxX >= b.minX - snapM &&
    a.minY <= b.maxY + snapM &&
    a.maxY >= b.minY - snapM
  );
}

function pointSegDist(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return hypotXY(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function orient(a: XY, b: XY, c: XY): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function minRingDistance(a: XY[], b: XY[]): number {
  const na = ringVertexCount(a);
  const nb = ringVertexCount(b);
  if (na < 2 || nb < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < na; i++) {
    const a0 = a[i]!;
    const a1 = a[(i + 1) % na]!;
    for (let j = 0; j < nb; j++) {
      const b0 = b[j]!;
      const b1 = b[(j + 1) % nb]!;
      if (segmentsIntersect(a0, a1, b0, b1)) return 0;
      min = Math.min(
        min,
        pointSegDist(a0, b0, b1),
        pointSegDist(a1, b0, b1),
        pointSegDist(b0, a0, a1),
        pointSegDist(b1, a0, a1),
      );
      if (min === 0) return 0;
    }
  }
  return min;
}

export function projectPolygon(geometry: GeoJSON.Geometry | null): ProjectedPolygon | null {
  if (!geometry || geometry.type !== "Polygon") return null;
  const rings = geometry.coordinates;
  const outerCoords = rings[0];
  if (!outerCoords || outerCoords.length < 4) return null;
  const outer = projectRing(outerCoords);
  const holes = rings.slice(1).map((r) => projectRing(r));
  const outerArea = Math.abs(ringArea(outer));
  let holeArea = 0;
  let holePerim = 0;
  for (const hole of holes) {
    holeArea += Math.abs(ringArea(hole));
    holePerim += ringLength(hole);
  }
  const areaM2 = Math.max(0, outerArea - holeArea);
  const perimeterM = ringLength(outer) + holePerim;
  const bbox = ringBBox(outer);
  if (!bbox) return null;
  return {
    outer,
    holes,
    areaM2,
    perimeterM,
    compactness: isoperimetricQuotient(areaM2, perimeterM),
    bbox,
    centroid: ringCentroid(outer),
  };
}
