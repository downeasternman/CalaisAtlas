import { describe, expect, it } from "vitest";
import {
  COHORT_IMPROVED,
  COHORT_NONE,
  COHORT_UNIMPROVED,
  NO_VALUE_PCT,
  classifyBuildingCohort,
  computeCalaisValuePerAcrePercentiles,
  computeCalaisValuePercentiles,
  isFullyExempt,
  isHomesteadExemption,
  isMapTaxExempt,
  isPublicTaxExemptOwner,
  valuePerAcre,
} from "@/lib/map/parcel-valuation";

describe("computeCalaisValuePercentiles", () => {
  it("excludes null and invalid totals from the comparison set", () => {
    const ranks = computeCalaisValuePercentiles([
      { id: "a", assessedTotalValue: "1000" },
      { id: "b", assessedTotalValue: null },
      { id: "c", assessedTotalValue: "50" },
      { id: "d", assessedTotalValue: "9000" },
    ]);
    expect(ranks.get("b")).toBe(NO_VALUE_PCT);
    expect(ranks.get("c")).toBe(NO_VALUE_PCT);
    expect(ranks.get("a")).toBe(0);
    expect(ranks.get("d")).toBe(100);
  });

  it("assigns 50 when only one parcel has a valid assessment", () => {
    const ranks = computeCalaisValuePercentiles([
      { id: "solo", assessedTotalValue: "250000" },
      { id: "none", assessedTotalValue: null },
    ]);
    expect(ranks.get("solo")).toBe(50);
    expect(ranks.get("none")).toBe(NO_VALUE_PCT);
  });

  it("shares average rank on ties", () => {
    const ranks = computeCalaisValuePercentiles([
      { id: "low", assessedTotalValue: "1000" },
      { id: "mid-a", assessedTotalValue: "5000" },
      { id: "mid-b", assessedTotalValue: "5000" },
      { id: "high", assessedTotalValue: "9000" },
    ]);
    expect(ranks.get("low")).toBe(0);
    expect(ranks.get("high")).toBe(100);
    expect(ranks.get("mid-a")).toBe(ranks.get("mid-b"));
    expect(ranks.get("mid-a")).toBe(50);
  });
});

describe("classifyBuildingCohort", () => {
  it("treats $0 building as unimproved and positive as improved", () => {
    expect(classifyBuildingCohort("0")).toBe(COHORT_UNIMPROVED);
    expect(classifyBuildingCohort("150000")).toBe(COHORT_IMPROVED);
    expect(classifyBuildingCohort(null)).toBe(COHORT_NONE);
  });
});

describe("isFullyExempt", () => {
  it("requires exemption >= total with positive total", () => {
    expect(isFullyExempt("100000", "100000")).toBe(true);
    expect(isFullyExempt("120000", "100000")).toBe(true);
    expect(isFullyExempt("50000", "100000")).toBe(false);
    expect(isFullyExempt(null, "100000")).toBe(false);
  });
});

describe("isMapTaxExempt / public owners", () => {
  it("flags city, federal, and church owners", () => {
    expect(isPublicTaxExemptOwner("CITY OF CALAIS")).toBe(true);
    expect(isPublicTaxExemptOwner("UNITED STATES OF AMERICA")).toBe(true);
    expect(isPublicTaxExemptOwner("STATE OF MAINE-ARMORY")).toBe(true);
    expect(isPublicTaxExemptOwner("ROMAN CATHOLIC BISHOP")).toBe(true);
    expect(isPublicTaxExemptOwner("CARUSO, LOGAN M")).toBe(false);
  });

  it("flags exemption covering land+building when total is null", () => {
    expect(
      isMapTaxExempt({
        ownerName: "PRIVATE OWNER",
        assessedTotalValue: null,
        assessedLandValue: "64200",
        assessedBuildingValue: "12000",
        assessedExemptionValue: "76200",
      }),
    ).toBe(true);
  });
});

describe("isHomesteadExemption", () => {
  it("detects $25k and $31k Calais homestead amounts", () => {
    expect(isHomesteadExemption("25000")).toBe(true);
    expect(isHomesteadExemption("31000")).toBe(true);
    expect(isHomesteadExemption("6000")).toBe(false);
    expect(isHomesteadExemption("25000", { homesteadLabel: true })).toBe(true);
  });
});

describe("computeCalaisValuePerAcrePercentiles", () => {
  it("ranks within improved and unimproved cohorts separately", () => {
    const ranks = computeCalaisValuePerAcrePercentiles([
      {
        id: "imp-low",
        assessedTotalValue: "10000",
        assessedBuildingValue: "5000",
        gisAcreage: "1",
      },
      {
        id: "imp-high",
        assessedTotalValue: "90000",
        assessedBuildingValue: "40000",
        gisAcreage: "1",
      },
      {
        id: "vac-low",
        assessedTotalValue: "1000",
        assessedBuildingValue: "0",
        gisAcreage: "1",
      },
      {
        id: "vac-high",
        assessedTotalValue: "8000",
        assessedBuildingValue: "0",
        gisAcreage: "1",
      },
    ]);

    expect(ranks.get("imp-low")?.cohort).toBe(COHORT_IMPROVED);
    expect(ranks.get("imp-high")?.cohort).toBe(COHORT_IMPROVED);
    expect(ranks.get("imp-low")?.valuePct).toBe(0);
    expect(ranks.get("imp-high")?.valuePct).toBe(100);

    expect(ranks.get("vac-low")?.cohort).toBe(COHORT_UNIMPROVED);
    expect(ranks.get("vac-high")?.cohort).toBe(COHORT_UNIMPROVED);
    expect(ranks.get("vac-low")?.valuePct).toBe(0);
    expect(ranks.get("vac-high")?.valuePct).toBe(100);
  });

  it("ranks public owners in cohort but flags likelyPublicOwner; book exempt stays unranked", () => {
    const ranks = computeCalaisValuePerAcrePercentiles([
      {
        id: "city",
        ownerName: "CITY OF CALAIS",
        assessedTotalValue: "200000",
        assessedBuildingValue: "100000",
        gisAcreage: "1",
      },
      {
        id: "homestead",
        ownerName: "SMITH, JANE",
        assessedTotalValue: "150000",
        assessedBuildingValue: "80000",
        assessedExemptionValue: "25000",
        gisAcreage: "1",
      },
      {
        id: "taxable",
        ownerName: "DOE, JOHN",
        assessedTotalValue: "100000",
        assessedBuildingValue: "50000",
        gisAcreage: "1",
      },
    ]);

    expect(ranks.get("city")?.likelyPublicOwner).toBe(true);
    expect(ranks.get("city")?.bookFullyExempt).toBe(false);
    expect(ranks.get("city")?.fullyExempt).toBe(false);
    expect(ranks.get("city")?.valuePct).toBe(100);

    expect(ranks.get("homestead")?.homestead).toBe(true);
    expect(ranks.get("homestead")?.fullyExempt).toBe(false);
    expect(ranks.get("homestead")?.valuePct).toBe(50);

    expect(ranks.get("taxable")?.fullyExempt).toBe(false);
    expect(ranks.get("taxable")?.valuePct).toBe(0);
  });

  it("leaves parcels without acres unranked", () => {
    const ranks = computeCalaisValuePerAcrePercentiles([
      {
        id: "no-acres",
        assessedTotalValue: "100000",
        assessedBuildingValue: "0",
        gisAcreage: null,
      },
    ]);
    expect(ranks.get("no-acres")?.valuePct).toBe(NO_VALUE_PCT);
    expect(ranks.get("no-acres")?.valuePerAcre).toBeNull();
  });
});

describe("valuePerAcre", () => {
  it("divides assessed total by GIS acres", () => {
    expect(valuePerAcre("10000", "2")).toBe(5000);
    expect(valuePerAcre("50", "1")).toBeNull();
  });
});
