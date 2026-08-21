import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("build-parcels tile pipeline", () => {
  it("does not recompute percentiles in tile build", () => {
    const source = readFileSync(
      path.join(process.cwd(), "scripts/tiles/build-parcels.ts"),
      "utf8",
    );
    expect(source).not.toContain("computeCalaisValuePerAcrePercentiles");
  });
});
