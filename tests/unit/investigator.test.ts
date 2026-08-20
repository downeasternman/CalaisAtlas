import { describe, expect, it } from "vitest";
import {
  buildInvestigatorPacket,
  citeOnlyInvestigate,
  validateHypothesis,
  type InvestigatorPacket,
} from "@/lib/analytics/investigator";
import type { Observation } from "@/lib/analytics/observations";
import type { ParcelFeature } from "@/lib/analytics/features";
import type { ParcelSnapshot } from "@/lib/analytics/types";

function observation(partial: Partial<Observation> & Pick<Observation, "id">): Observation {
  return {
    observationType: "test",
    unit: "parcel",
    severity: "low",
    confidence: 0.5,
    priority: "low",
    dimensions: { data_quality: true },
    scope: "edmunds-twp",
    parcelIds: ["p1"],
    ownerIds: [],
    clusterIds: [],
    peerGroup: null,
    observed: null,
    expected: null,
    residual: null,
    percentile: null,
    madScore: null,
    evidence: [],
    relationships: [],
    alternativeExplanations: ["Possible data artifact"],
    dataQualityFlags: ["unjoined"],
    hypotheses: [
      {
        text: "Unexpected absence of a tax join.",
        confidence: 0.8,
        strengthen: "Neighbors are joined.",
        falsify: "A join key exists.",
      },
    ],
    recommendedFollowups: ["Do not treat as ownerless."],
    calculationProvenance: { runId: "run", gitSha: null, params: {} },
    createdAt: "2026-08-15T00:00:00.000Z",
    taxYear: 2025,
    ...partial,
  };
}

function snapshot(parcelId: string): ParcelSnapshot {
  return {
    id: `${parcelId}|2025|2026-07-26`,
    runId: "run",
    parcelId,
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    territoryType: "ut",
    municipalityId: "edmunds-twp",
    taxMunicipalityId: null,
    tpl: "WA001011",
    mapLot: "01-1",
    propertyId: null,
    accountNumber: null,
    ownerNameRaw: null,
    mailAddressRaw: null,
    assessedLandValueSource: null,
    assessedLandValueNumeric: null,
    assessedBuildingValueSource: null,
    assessedBuildingValueNumeric: null,
    assessedTotalValueSource: null,
    assessedTotalValueNumeric: null,
    assessedExemptionValueSource: null,
    assessedExemptionValueNumeric: null,
    assessedPersonalPropertyValueSource: null,
    assessedPersonalPropertyValueNumeric: null,
    taxAmountSource: null,
    taxAmountNumeric: null,
    percentOwnershipSource: null,
    gisAcreageSource: null,
    gisAcreageNumeric: null,
    taxAcreageSource: null,
    taxAcreageNumeric: null,
    acreageDiscrepancy: null,
    joinMethod: "unjoined",
    joinConfidence: 0,
    hasAssessment: false,
    taxRecordId: null,
    taxSourceId: "mrs-ut-valuation-2025",
    geometrySourceId: "mrs-ut-parcels",
    attrsRaw: null,
  };
}

function feature(parcelId: string, acres: number | null): ParcelFeature {
  return {
    id: `${parcelId}|features`,
    snapshotId: `${parcelId}|2025|2026-07-26`,
    runId: "run",
    parcelId,
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    gisAcreage: acres,
    taxAcreage: null,
    land: null,
    building: null,
    taxable: null,
    exemption: null,
    landPlusBuilding: null,
    taxableMinusLandBuilding: null,
    valuePerGisAcre: acres == null ? null : null,
    landPerGisAcre: null,
    buildingPerGisAcre: null,
    buildingLandRatio: null,
    vacantFlag: false,
    unjoinedFlag: true,
    tplFamily: "wap_plat",
    multiLotGroupId: null,
    lotCountInGroup: null,
    valuationAllocation: null,
  };
}

describe("cite-only investigator", () => {
  it("does not invent value per GIS acre when acreage is missing from the packet", () => {
    const packet = buildInvestigatorPacket(observation({ id: "obs:test:p1" }), {
      snapshots: [snapshot("p1")],
      features: [feature("p1", null)],
      entities: [],
      graphEdges: [],
    });
    expect(packet.parcels[0]?.gisAcreage).toBeNull();
    expect(packet.parcels[0]?.valuePerGisAcre).toBeNull();
    const hypothesis = citeOnlyInvestigate(packet);
    expect(hypothesis.missingFields).toContain("gisAcreage");
    expect(hypothesis.missingFields).toContain("valuePerGisAcre");
    expect(hypothesis.howUnusual).toMatch(/Do not invent those values/);
    expect(hypothesis.what).not.toMatch(/value per GIS acre is \d/);
    expect(validateHypothesis(packet, hypothesis).ok).toBe(true);
  });

  it("rejects uncited numbers and forbidden vocabulary", () => {
    const packet = buildInvestigatorPacket(observation({ id: "obs:test:p1" }), {
      snapshots: [snapshot("p1")],
      features: [feature("p1", null)],
      entities: [],
      graphEdges: [],
    });
    const invented = citeOnlyInvestigate(packet);
    invented.what = "Value per GIS acre is 123456.78";
    expect(validateHypothesis(packet, invented).ok).toBe(false);
    expect(validateHypothesis(packet, invented).errors.some((e) => e.includes("123456.78"))).toBe(
      true,
    );
    invented.what = "This is fraud";
    invented.howUnusual = "packet only";
    expect(validateHypothesis(packet, invented).errors).toContain("forbidden vocabulary");
  });

  it("cites observed and expected from the packet when present", () => {
    const packet: InvestigatorPacket = buildInvestigatorPacket(
      observation({
        id: "obs:test:scored",
        observed: 1000,
        expected: 2000,
        residual: -1000,
        percentile: 0.05,
        peerGroup: { type: "township", id: "edmunds-twp|v", n: 20, filters: ["vacant"] },
        dataQualityFlags: [],
      }),
      {
        snapshots: [snapshot("p1")],
        features: [feature("p1", 10)],
        entities: [],
        graphEdges: [],
      },
    );
    const hypothesis = citeOnlyInvestigate(packet);
    expect(hypothesis.howUnusual).toMatch(/observed=1000/);
    expect(hypothesis.howUnusual).toMatch(/expected=2000/);
    expect(hypothesis.comparisonPopulation).toMatch(/n=20/);
    expect(validateHypothesis(packet, hypothesis).ok).toBe(true);
  });

  it("does not treat digits inside township ids as uncited numbers", () => {
    const packet = buildInvestigatorPacket(
      observation({
        id: "obs:test:t24",
        scope: "t24-md-bpp",
        observed: 0.28,
        expected: 708.78,
        residual: -708.5,
        percentile: 0.024,
        peerGroup: { type: "township", id: "t24-md-bpp|v", n: 41, filters: ["vacant"] },
        dataQualityFlags: [],
      }),
      {
        snapshots: [snapshot("p1")],
        features: [feature("p1", 10)],
        entities: [],
        graphEdges: [],
      },
    );
    const hypothesis = citeOnlyInvestigate(packet);
    const check = validateHypothesis(packet, hypothesis);
    expect(check.errors).toEqual([]);
    expect(check.ok).toBe(true);
  });
});
