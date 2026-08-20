import { describe, expect, it } from "vitest";
import { formatGisAcreage, gisAcresFromGeometry } from "@/lib/geo/gis-acreage";

describe("gisAcresFromGeometry", () => {
  it("returns null for missing or empty geometry", () => {
    expect(gisAcresFromGeometry(null)).toBeNull();
    expect(
      gisAcresFromGeometry({
        type: "Polygon",
        coordinates: [],
      }),
    ).toBeNull();
  });

  it("computes positive acres for a small lon/lat square near Calais", () => {
    // ~0.001° square around Calais (~45.19N, 67.28W)
    const ring: GeoJSON.Position[] = [
      [-67.28, 45.19],
      [-67.279, 45.19],
      [-67.279, 45.191],
      [-67.28, 45.191],
      [-67.28, 45.19],
    ];
    const acres = gisAcresFromGeometry({ type: "Polygon", coordinates: [ring] });
    expect(acres).not.toBeNull();
    expect(acres!).toBeGreaterThan(0);
    expect(formatGisAcreage(acres)).toMatch(/^\d/);
  });
});
