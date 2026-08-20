import type { ParcelFeature } from "./features";
import {
  bboxesNear,
  minRingDistance,
  projectPolygon,
  type BBox,
  type ProjectedPolygon,
} from "./polygon-metrics";
import { median } from "./robust";
import { hypotXY, type XY } from "./utm";

export const SPATIAL_KNN_K = 25;
export const TOUCH_SNAP_M = 2;
const GRID_CELL_M = 500;

export interface SpatialParcelInput {
  parcelId: string;
  geometry: GeoJSON.Geometry | null;
  feature: ParcelFeature | null;
}

export interface ParcelSpatialFeature {
  id: string;
  parcelId: string;
  featureId: string | null;
  taxYear: number | null;
  centroidX: number | null;
  centroidY: number | null;
  areaM2: number | null;
  perimeterM: number | null;
  compactness: number | null;
  bbox: [number, number, number, number] | null;
  nnDistanceM: number | null;
  neighborCountK: number;
  touchCount: number;
  lagTaxableKnn: number | null;
  lagValuePerAcreKnn: number | null;
  lagTaxableKnnN: number;
  lagResidualTaxableKnn: number | null;
  lagTaxableTouch: number | null;
  lagValuePerAcreTouch: number | null;
  lagTaxableTouchN: number;
  lagResidualTaxableTouch: number | null;
  lagSkipReason: string | null;
}

export interface SpatialNeighborRow {
  id: string;
  parcelId: string;
  neighborId: string;
  kind: "knn" | "touch";
  distanceM: number;
  rank: number | null;
}

export interface SpatialLayer {
  features: ParcelSpatialFeature[];
  neighbors: SpatialNeighborRow[];
}

function lagEligible(feature: ParcelFeature | null): boolean {
  if (!feature) return false;
  if (feature.unjoinedFlag) return false;
  if (feature.valuationAllocation === "copied_full_assessment") return false;
  if (feature.taxable == null) return false;
  return true;
}

function lagSkipReason(feature: ParcelFeature | null): string | null {
  if (!feature) return "no_feature";
  if (feature.unjoinedFlag) return "unjoined";
  if (feature.valuationAllocation === "copied_full_assessment") {
    return "copied_full_assessment";
  }
  if (feature.taxable == null) return "no_taxable_value";
  return null;
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function cellRange(bbox: BBox, snapM: number): Array<[number, number]> {
  const minCx = Math.floor((bbox.minX - snapM) / GRID_CELL_M);
  const maxCx = Math.floor((bbox.maxX + snapM) / GRID_CELL_M);
  const minCy = Math.floor((bbox.minY - snapM) / GRID_CELL_M);
  const maxCy = Math.floor((bbox.maxY + snapM) / GRID_CELL_M);
  const cells: Array<[number, number]> = [];
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      cells.push([cx, cy]);
    }
  }
  return cells;
}

function lagFromNeighbors(
  neighborIds: string[],
  byId: Map<string, SpatialParcelInput>,
): { taxable: number | null; vpa: number | null; n: number } {
  const taxables: number[] = [];
  const vpas: number[] = [];
  for (const id of neighborIds) {
    const n = byId.get(id);
    if (!lagEligible(n?.feature ?? null)) continue;
    taxables.push(n!.feature!.taxable!);
    if (n!.feature!.valuePerGisAcre != null) {
      vpas.push(n!.feature!.valuePerGisAcre);
    }
  }
  return {
    taxable: median(taxables),
    vpa: median(vpas),
    n: taxables.length,
  };
}

export function buildSpatialLayer(
  inputs: SpatialParcelInput[],
  opts?: { k?: number; snapM?: number },
): SpatialLayer {
  const k = opts?.k ?? SPATIAL_KNN_K;
  const snapM = opts?.snapM ?? TOUCH_SNAP_M;
  const byId = new Map(inputs.map((i) => [i.parcelId, i] as const));

  type Prepared = {
    input: SpatialParcelInput;
    projected: ProjectedPolygon | null;
    centroid: XY | null;
  };

  const prepared: Prepared[] = inputs.map((input) => {
    const projected = projectPolygon(input.geometry);
    return {
      input,
      projected,
      centroid: projected?.centroid ?? null,
    };
  });

  const withCentroid = prepared
    .map((p, index) => ({ p, index }))
    .filter((row) => row.p.centroid != null);

  const knnByParcel = new Map<string, Array<{ id: string; distanceM: number; rank: number }>>();
  for (const { p, index } of withCentroid) {
    const ranked = withCentroid
      .filter((other) => other.index !== index)
      .map((other) => ({
        id: other.p.input.parcelId,
        distanceM: hypotXY(p.centroid!, other.p.centroid!),
      }))
      .sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id))
      .slice(0, k)
      .map((row, rank) => ({ ...row, rank: rank + 1 }));
    knnByParcel.set(p.input.parcelId, ranked);
  }

  const grid = new Map<string, number[]>();
  prepared.forEach((row, i) => {
    if (!row.projected) return;
    for (const [cx, cy] of cellRange(row.projected.bbox, snapM)) {
      const key = cellKey(cx, cy);
      const list = grid.get(key) ?? [];
      list.push(i);
      grid.set(key, list);
    }
  });

  const touchDist = new Map<string, Map<string, number>>();
  const addTouch = (a: string, b: string, d: number) => {
    const inner = touchDist.get(a) ?? new Map<string, number>();
    const prev = inner.get(b);
    if (prev == null || d < prev) inner.set(b, d);
    touchDist.set(a, inner);
  };

  for (let i = 0; i < prepared.length; i++) {
    const a = prepared[i]!;
    if (!a.projected) continue;
    const seen = new Set<number>();
    for (const [cx, cy] of cellRange(a.projected.bbox, snapM)) {
      for (const j of grid.get(cellKey(cx, cy)) ?? []) {
        if (j <= i || seen.has(j)) continue;
        seen.add(j);
        const b = prepared[j]!;
        if (!b.projected) continue;
        if (!bboxesNear(a.projected.bbox, b.projected.bbox, snapM)) continue;
        const d = minRingDistance(a.projected.outer, b.projected.outer);
        if (d <= snapM) {
          addTouch(a.input.parcelId, b.input.parcelId, d);
          addTouch(b.input.parcelId, a.input.parcelId, d);
        }
      }
    }
  }

  const neighbors: SpatialNeighborRow[] = [];
  const features: ParcelSpatialFeature[] = prepared.map((row) => {
    const f = row.input.feature;
    const knn = knnByParcel.get(row.input.parcelId) ?? [];
    const touches = touchDist.get(row.input.parcelId) ?? new Map<string, number>();
    const nnDistanceM = knn[0]?.distanceM ?? null;

    for (const n of knn) {
      neighbors.push({
        id: `${row.input.parcelId}|knn|${n.id}`,
        parcelId: row.input.parcelId,
        neighborId: n.id,
        kind: "knn",
        distanceM: n.distanceM,
        rank: n.rank,
      });
    }
    const touchIds = [...touches.entries()].sort(
      (a, b) => a[1] - b[1] || a[0].localeCompare(b[0]),
    );
    for (const [neighborId, distanceM] of touchIds) {
      neighbors.push({
        id: `${row.input.parcelId}|touch|${neighborId}`,
        parcelId: row.input.parcelId,
        neighborId,
        kind: "touch",
        distanceM,
        rank: null,
      });
    }

    const knnLag = lagFromNeighbors(
      knn.map((n) => n.id),
      byId,
    );
    const touchLag = lagFromNeighbors(
      touchIds.map(([id]) => id),
      byId,
    );
    const skip = lagSkipReason(f);
    const observed = skip ? null : (f?.taxable ?? null);

    return {
      id: `${row.input.parcelId}|spatial`,
      parcelId: row.input.parcelId,
      featureId: f?.id ?? null,
      taxYear: f?.taxYear ?? null,
      centroidX: row.centroid?.x ?? null,
      centroidY: row.centroid?.y ?? null,
      areaM2: row.projected?.areaM2 ?? null,
      perimeterM: row.projected?.perimeterM ?? null,
      compactness: row.projected?.compactness ?? null,
      bbox: row.projected
        ? [
            row.projected.bbox.minX,
            row.projected.bbox.minY,
            row.projected.bbox.maxX,
            row.projected.bbox.maxY,
          ]
        : null,
      nnDistanceM,
      neighborCountK: knn.length,
      touchCount: touches.size,
      lagTaxableKnn: knnLag.taxable,
      lagValuePerAcreKnn: knnLag.vpa,
      lagTaxableKnnN: knnLag.n,
      lagResidualTaxableKnn:
        observed != null && knnLag.taxable != null ? observed - knnLag.taxable : null,
      lagTaxableTouch: touchLag.taxable,
      lagValuePerAcreTouch: touchLag.vpa,
      lagTaxableTouchN: touchLag.n,
      lagResidualTaxableTouch:
        observed != null && touchLag.taxable != null ? observed - touchLag.taxable : null,
      lagSkipReason: skip,
    };
  });

  return { features, neighbors };
}
