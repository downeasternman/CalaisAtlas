import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAtlasStyle } from "@/lib/map/style";
import { LAYER_IDS } from "@/lib/map/layers";

describe("homestead map style", () => {
  it("uses a star symbol layer", () => {
    const style = buildAtlasStyle("http://localhost:3000");
    const layer = style.layers?.find((l) => "id" in l && l.id === LAYER_IDS.PARCEL_HOMESTEAD);
    expect(layer).toBeDefined();
    expect(layer).toMatchObject({
      type: "symbol",
      layout: { "text-field": "★" },
    });
  });
});

describe("road label layers", () => {
  it("includes major and minor road labels", () => {
    const style = buildAtlasStyle("http://localhost:3000");
    const ids = style.layers?.map((l) => ("id" in l ? l.id : "")) ?? [];
    expect(ids).toContain(LAYER_IDS.ROADS_LABEL_MAJOR);
    expect(ids).toContain(LAYER_IDS.ROADS_LABEL_MINOR);
  });
});

describe("parcel valuation fill", () => {
  it("uses bookFullyExempt for purple fill", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/map/parcel-valuation.ts"), "utf8");
    expect(source).toContain('propNumber("bookFullyExempt", 0)');
  });
});
