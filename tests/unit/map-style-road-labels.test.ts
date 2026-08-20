import { describe, expect, it } from "vitest";
import { LAYER_IDS } from "@/lib/map/layers";
import { buildAtlasStyle } from "@/lib/map/style";

describe("buildAtlasStyle road labels", () => {
  it("includes major and minor road name symbol layers above parcels", () => {
    const style = buildAtlasStyle("http://localhost:3000");
    const layers = style.layers ?? [];
    const major = layers.find((l) => l.id === LAYER_IDS.ROADS_LABEL_MAJOR);
    const minor = layers.find((l) => l.id === LAYER_IDS.ROADS_LABEL_MINOR);
    const parcelFillIdx = layers.findIndex((l) => l.id === LAYER_IDS.PARCEL_FILL);
    const majorIdx = layers.findIndex((l) => l.id === LAYER_IDS.ROADS_LABEL_MAJOR);
    const minorIdx = layers.findIndex((l) => l.id === LAYER_IDS.ROADS_LABEL_MINOR);

    expect(major?.type).toBe("symbol");
    expect(minor?.type).toBe("symbol");
    expect(major && "layout" in major ? major.layout?.["symbol-placement"] : null).toBe(
      "line",
    );
    expect(minor && "layout" in minor ? minor.layout?.["symbol-placement"] : null).toBe(
      "line",
    );
    expect(major && "layout" in major ? major.layout?.["text-field"] : null).toEqual([
      "get",
      "name",
    ]);
    expect(minor && "layout" in minor ? minor.layout?.["text-field"] : null).toEqual([
      "get",
      "name",
    ]);
    expect(parcelFillIdx).toBeGreaterThanOrEqual(0);
    expect(majorIdx).toBeGreaterThan(parcelFillIdx);
    expect(minorIdx).toBeGreaterThan(parcelFillIdx);
  });
});
