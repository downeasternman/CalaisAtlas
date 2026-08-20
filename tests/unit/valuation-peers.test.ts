import { describe, expect, it } from "vitest";
import { acreageBand } from "@/lib/analytics/acreage-band";
import { buildValuationCatalogue } from "@/lib/analytics/catalogue";
import type { ParcelFeature } from "@/lib/analytics/features";
import { buildValuationScores, type PeerParcelInput } from "@/lib/analytics/peers";
import { empiricalPercentile, madScore, median } from "@/lib/analytics/robust";

function feature(partial: Partial<ParcelFeature> & Pick<ParcelFeature, "parcelId">): ParcelFeature {
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

describe("robust stats", () => {
  it("computes empirical percentile as share strictly below x", () => {
    expect(empiricalPercentile(10, [1, 5, 10, 20])).toBe(0.5);
    expect(median([1, 3, 2])).toBe(2);
  });

  it("marks MAD=0 as a repeated-value class", () => {
    const result = madScore(Math.log1p(100), Array(12).fill(Math.log1p(100)));
    expect(result.repeatedValueClass).toBe(true);
    expect(result.score).toBeNull();
  });

  it("scores identical township taxables as a repeated-value class, not ±∞", () => {
    const inputs: PeerParcelInput[] = Array.from({ length: 12 }, (_, i) => ({
      feature: feature({ parcelId: `r${i}`, taxable: 30000 }),
      municipalityId: "same-twp",
      centroid: { lon: -67.2 + i * 0.001, lat: 44.9 },
    }));
    const scores = buildValuationScores(inputs);
    expect(scores[0]?.taxableTownship?.repeatedValueClass).toBe(true);
    expect(scores[0]?.taxableTownship?.madLog).toBeNull();
    expect(scores[0]?.taxableTownship?.residual).toBe(0);
  });
});

describe("buildValuationScores", () => {
  it("skips unjoined and copied multi-lot rows", () => {
    const inputs: PeerParcelInput[] = [
      {
        feature: feature({ parcelId: "a", unjoinedFlag: true, taxable: null }),
        municipalityId: "trescott-twp",
        centroid: { lon: -67.1, lat: 44.8 },
      },
      {
        feature: feature({
          parcelId: "b",
          valuationAllocation: "copied_full_assessment",
          valuePerGisAcre: null,
        }),
        municipalityId: "trescott-twp",
        centroid: { lon: -67.11, lat: 44.8 },
      },
    ];
    const scores = buildValuationScores(inputs);
    expect(scores[0]?.skipReason).toBe("unjoined");
    expect(scores[1]?.skipReason).toBe("copied_full_assessment");
    expect(scores.every((s) => s.scored === false)).toBe(true);
  });

  it("does not mix vacant and improved township peers", () => {
    const improved: PeerParcelInput[] = Array.from({ length: 12 }, (_, i) => ({
      feature: feature({
        parcelId: `i${i}`,
        taxable: 30000 + i * 100,
        vacantFlag: false,
        building: 20000,
      }),
      municipalityId: "edmunds-twp",
      centroid: { lon: -67.2 + i * 0.001, lat: 44.9 },
    }));
    const vacant: PeerParcelInput[] = Array.from({ length: 12 }, (_, i) => ({
      feature: feature({
        parcelId: `v${i}`,
        taxable: 5000,
        vacantFlag: true,
        building: 0,
        valuePerGisAcre: 1000,
      }),
      municipalityId: "edmunds-twp",
      centroid: { lon: -67.3 + i * 0.001, lat: 44.9 },
    }));
    const scores = buildValuationScores([...improved, ...vacant]);
    const firstImproved = scores.find((s) => s.parcelId === "i0");
    expect(firstImproved?.taxableTownship?.peer.vacant).toBe(false);
    expect(firstImproved?.taxableTownship?.peer.n).toBe(12);
    expect(firstImproved?.taxableTownship?.expected).toBe(median(improved.map((p) => p.feature.taxable!)));
  });

  it("marks peer groups with n < 12 as underpowered", () => {
    const inputs: PeerParcelInput[] = Array.from({ length: 5 }, (_, i) => ({
      feature: feature({ parcelId: `s${i}`, taxable: 10000 + i }),
      municipalityId: "tiny-twp",
      centroid: { lon: -67.4, lat: 45 },
    }));
    const scores = buildValuationScores(inputs);
    expect(scores[0]?.taxableTownship?.peer.underpowered).toBe(true);
    expect(scores[0]?.taxableTownship?.percentile).toBeNull();
    expect(buildValuationCatalogue(scores).highTaxableResidual).toHaveLength(0);
  });

  it("explains residuals against the acreage-band median when powered", () => {
    const inputs: PeerParcelInput[] = Array.from({ length: 12 }, (_, i) => ({
      feature: feature({
        parcelId: `p${i}`,
        gisAcreage: 5,
        taxable: i === 0 ? 200000 : 30000,
        valuePerGisAcre: i === 0 ? 40000 : 6000,
      }),
      municipalityId: "big-lake-twp",
      centroid: { lon: -67.5 + i * 0.002, lat: 45.1 },
    }));
    const scores = buildValuationScores(inputs);
    const hot = scores.find((s) => s.parcelId === "p0");
    expect(hot?.taxableBand?.peer.underpowered).toBe(false);
    expect(hot?.taxableBand?.residual).toBeGreaterThan(100000);
    expect(acreageBand(5)).toBe("2to10");
    const catalogue = buildValuationCatalogue(scores);
    expect(catalogue.highTaxableResidual[0]?.parcelId).toBe("p0");
    expect(catalogue.highTaxableResidual[0]?.explanation).toMatch(/Expected \(median of 12 improved parcels/);
    expect(catalogue.highTaxableResidual[0]?.explanation).toMatch(/not a finding of error or wrongdoing/);
  });
});
