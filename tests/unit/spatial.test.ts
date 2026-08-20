import { describe, expect, it } from "vitest";
import type { ParcelFeature } from "@/lib/analytics/features";
import { isoperimetricQuotient } from "@/lib/analytics/polygon-metrics";
import { buildSpatialLayer, TOUCH_SNAP_M } from "@/lib/analytics/spatial";
import { lonLatToUtm19n } from "@/lib/analytics/utm";

function feature(
  partial: Partial<ParcelFeature> & Pick<ParcelFeature, "parcelId">,
): ParcelFeature {
  return {
    id: `${partial.parcelId}|features`,
    snapshotId: `${partial.parcelId}|2025|2026-07-26`,
    runId: "run",
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    gisAcreage: 5,
    taxAcreage: 5,
    land: 10000,
    building: 20000,
    taxable: 30000,
    exemption: null,
    landPlusBuilding: 30000,
    taxableMinusLandBuilding: 0,
    valuePerGisAcre: 6000,
    landPerGisAcre: 2000,
    buildingPerGisAcre: 4000,
    buildingLandRatio: 2,
    vacantFlag: false,
    unjoinedFlag: false,
    tplFamily: "wa_map",
    multiLotGroupId: partial.parcelId,
    lotCountInGroup: 1,
    valuationAllocation: "single_lot",
    ...partial,
  };
}

function square(west: number, south: number, sizeDeg: number): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [west + sizeDeg, south],
        [west + sizeDeg, south + sizeDeg],
        [west, south + sizeDeg],
        [west, south],
      ],
    ],
  };
}

describe("EPSG:26919 projection", () => {
  it("places the central meridian at false easting 500000", () => {
    const p = lonLatToUtm19n(-69, 45);
    expect(p.x).toBeCloseTo(500_000, 3);
    expect(p.y).toBeGreaterThan(4_900_000);
    expect(p.y).toBeLessThan(5_100_000);
  });
});

describe("isoperimetric quotient", () => {
  it("is π/4 for a unit square in meters", () => {
    expect(isoperimetricQuotient(1, 4)).toBeCloseTo(Math.PI / 4, 10);
  });

  it("is null when area or perimeter is not positive", () => {
    expect(isoperimetricQuotient(0, 4)).toBeNull();
    expect(isoperimetricQuotient(1, 0)).toBeNull();
  });
});

describe("buildSpatialLayer", () => {
  it("marks shared-edge parcels as touches and isolates a distant parcel", () => {
    const layer = buildSpatialLayer(
      [
        {
          parcelId: "a",
          geometry: square(-67.5, 45, 0.001),
          feature: feature({ parcelId: "a", taxable: 100 }),
        },
        {
          parcelId: "b",
          geometry: square(-67.499, 45, 0.001),
          feature: feature({ parcelId: "b", taxable: 100 }),
        },
        {
          parcelId: "c",
          geometry: square(-67.4, 45.2, 0.001),
          feature: feature({ parcelId: "c", taxable: 100 }),
        },
      ],
      { k: 2, snapM: TOUCH_SNAP_M },
    );
    const a = layer.features.find((f) => f.parcelId === "a");
    const c = layer.features.find((f) => f.parcelId === "c");
    expect(a?.touchCount).toBe(1);
    expect(c?.touchCount).toBe(0);
    expect(a?.nnDistanceM).toBeLessThan(c?.nnDistanceM ?? Infinity);
    expect(
      layer.neighbors.some((n) => n.parcelId === "a" && n.neighborId === "b" && n.kind === "touch"),
    ).toBe(true);
  });

  it("treats a 1 m GIS sliver as a touch and a 4 m gap as not", () => {
    const south = 45;
    const size = 0.001;
    const mPerDegLat = 110_540;
    const closeGap = 1.0 / mPerDegLat;
    const farGap = 4.0 / mPerDegLat;
    const close = buildSpatialLayer(
      [
        { parcelId: "a", geometry: square(-67.5, south, size), feature: feature({ parcelId: "a" }) },
        {
          parcelId: "b",
          geometry: square(-67.5, south + size + closeGap, size),
          feature: feature({ parcelId: "b" }),
        },
      ],
      { k: 1, snapM: 2 },
    );
    const far = buildSpatialLayer(
      [
        { parcelId: "a", geometry: square(-67.5, south, size), feature: feature({ parcelId: "a" }) },
        {
          parcelId: "b",
          geometry: square(-67.5, south + size + farGap, size),
          feature: feature({ parcelId: "b" }),
        },
      ],
      { k: 1, snapM: 2 },
    );
    expect(close.features[0]?.touchCount).toBe(1);
    expect(far.features[0]?.touchCount).toBe(0);
  });

  it("computes kNN lag as the median of eligible neighbors, not including $0 unjoined", () => {
    const layer = buildSpatialLayer(
      [
        {
          parcelId: "target",
          geometry: square(-67.5, 45, 0.001),
          feature: feature({ parcelId: "target", taxable: 90_000, valuePerGisAcre: 18000 }),
        },
        {
          parcelId: "gap",
          geometry: square(-67.498, 45, 0.001),
          feature: feature({
            parcelId: "gap",
            unjoinedFlag: true,
            taxable: 0,
            valuePerGisAcre: null,
          }),
        },
        {
          parcelId: "peer",
          geometry: square(-67.496, 45, 0.001),
          feature: feature({ parcelId: "peer", taxable: 10_000, valuePerGisAcre: 2000 }),
        },
      ],
      { k: 2, snapM: 2 },
    );
    const target = layer.features.find((f) => f.parcelId === "target");
    expect(target?.lagTaxableKnn).toBe(10_000);
    expect(target?.lagTaxableKnnN).toBe(1);
    expect(target?.lagResidualTaxableKnn).toBe(80_000);
    expect(target?.lagSkipReason).toBeNull();
  });

  it("does not score unjoined or copied rows as valuation cold spots", () => {
    const layer = buildSpatialLayer(
      [
        {
          parcelId: "plat",
          geometry: square(-67.5, 45, 0.001),
          feature: feature({
            parcelId: "plat",
            unjoinedFlag: true,
            taxable: null,
            valuePerGisAcre: null,
          }),
        },
        {
          parcelId: "copy",
          geometry: square(-67.498, 45, 0.001),
          feature: feature({
            parcelId: "copy",
            valuationAllocation: "copied_full_assessment",
            taxable: 500_000,
            valuePerGisAcre: null,
          }),
        },
        {
          parcelId: "peer",
          geometry: square(-67.496, 45, 0.001),
          feature: feature({ parcelId: "peer", taxable: 12_000 }),
        },
      ],
      { k: 2, snapM: 2 },
    );
    const plat = layer.features.find((f) => f.parcelId === "plat");
    const copy = layer.features.find((f) => f.parcelId === "copy");
    expect(plat?.lagSkipReason).toBe("unjoined");
    expect(plat?.lagResidualTaxableKnn).toBeNull();
    expect(plat?.lagTaxableKnn).toBe(12_000);
    expect(copy?.lagSkipReason).toBe("copied_full_assessment");
    expect(copy?.lagResidualTaxableKnn).toBeNull();
  });
});
