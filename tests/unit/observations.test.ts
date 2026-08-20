import { describe, expect, it } from "vitest";
import type { ParcelFeature } from "@/lib/analytics/features";
import { buildObservations } from "@/lib/analytics/observations";
import type { GraphEdge, OwnerEntity } from "@/lib/analytics/ownership";
import type { ParcelValuationScore } from "@/lib/analytics/peers";
import type { SpatialNeighborRow } from "@/lib/analytics/spatial";
import type { ParcelSnapshot, TaxRecordSnapshot } from "@/lib/analytics/types";

function snap(
  partial: Pick<ParcelSnapshot, "parcelId"> & Partial<ParcelSnapshot>,
): ParcelSnapshot {
  return {
    id: `${partial.parcelId}|2025|2026-07-26`,
    runId: "run",
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
    gisAcreageSource: "10",
    gisAcreageNumeric: 10,
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
    ...partial,
  };
}

function feat(
  partial: Partial<ParcelFeature> & Pick<ParcelFeature, "parcelId">,
): ParcelFeature {
  return {
    id: `${partial.parcelId}|features`,
    snapshotId: `${partial.parcelId}|2025|2026-07-26`,
    runId: "run",
    taxYear: 2025,
    geometryAsOf: "2026-07-26",
    gisAcreage: 10,
    taxAcreage: null,
    land: null,
    building: null,
    taxable: null,
    exemption: null,
    landPlusBuilding: null,
    taxableMinusLandBuilding: null,
    valuePerGisAcre: null,
    landPerGisAcre: null,
    buildingPerGisAcre: null,
    buildingLandRatio: null,
    vacantFlag: false,
    unjoinedFlag: true,
    tplFamily: "wap_plat",
    multiLotGroupId: null,
    lotCountInGroup: null,
    valuationAllocation: null,
    ...partial,
  };
}

function touch(a: string, b: string): SpatialNeighborRow[] {
  return [
    { id: `${a}|touch|${b}`, parcelId: a, neighborId: b, kind: "touch", distanceM: 0, rank: null },
    { id: `${b}|touch|${a}`, parcelId: b, neighborId: a, kind: "touch", distanceM: 0, rank: null },
  ];
}

function emptyScore(parcelId: string): ParcelValuationScore {
  return {
    id: `${parcelId}|valuation`,
    featureId: `${parcelId}|features`,
    parcelId,
    taxYear: 2025,
    municipalityId: "edmunds-twp",
    vacantFlag: false,
    scored: false,
    skipReason: "unjoined",
    taxableTownship: null,
    taxableBand: null,
    taxableKnn: null,
    valuePerAcreTownship: null,
    valuePerAcreBand: null,
    valuePerAcreKnn: null,
  };
}

const emptyEntity = (name: string, acreShare: number): OwnerEntity => ({
  id: `owner:${name}`,
  nameNormalized: name,
  entityType: "llc",
  institutionalBaseline: name.startsWith("TYPHOON"),
  rawExamples: [name],
  parcelCount: 1,
  gisAcres: 100,
  taxable: 1000,
  townshipCount: 1,
  townshipIds: ["edmunds-twp"],
  townshipShares: [
    {
      municipalityId: "edmunds-twp",
      parcelCount: 1,
      gisAcres: 100,
      taxable: 1000,
      acreShare,
      taxableShare: 0.1,
    },
  ],
  maxTownshipAcreShare: acreShare,
  utAcreShare: 0.1,
  utTaxableShare: 0.1,
  contiguousComponentCount: 1,
  maxContiguousGisAcres: 100,
  maxKnnNeighborhoodAcreShare: 0.2,
});

function baseInput(partial: Partial<Parameters<typeof buildObservations>[0]>) {
  return {
    runId: "run",
    taxYear: 2025,
    createdAt: "2026-08-15T00:00:00.000Z",
    gitSha: null,
    snapshots: [],
    features: [],
    scores: [],
    spatial: [],
    neighbors: [],
    entities: [],
    graphEdges: [],
    taxRecordSnapshots: [],
    organizedMunicipalityIds: ["lubec", "calais"],
    ...partial,
  };
}

describe("buildObservations", () => {
  it("clusters similar_name + adjacent as review, not same entity", () => {
    const edge: GraphEdge = {
      id: "similar_name:A|B",
      source: "owner:JOHN SMITH",
      target: "owner:JOHN SMYTH",
      type: "similar_name",
      score: 0.96,
      evidence: { adjacent: true, status: "similar_name" },
    };
    const obs = buildObservations(
      baseInput({
        snapshots: [
          snap({ parcelId: "p1", ownerNameRaw: "JOHN SMITH", joinMethod: "map_lot", hasAssessment: true }),
          snap({ parcelId: "p2", ownerNameRaw: "JOHN SMYTH", joinMethod: "map_lot", hasAssessment: true }),
        ],
        features: [feat({ parcelId: "p1", unjoinedFlag: false }), feat({ parcelId: "p2", unjoinedFlag: false })],
        scores: [emptyScore("p1"), emptyScore("p2")],
        graphEdges: [edge],
      }),
    );
    const hit = obs.find((o) => o.observationType === "similar_name_adjacent");
    expect(hit?.unit).toBe("cluster");
    expect(hit?.hypotheses[0]?.text).toMatch(/not the same entity/i);
    expect(hit?.hypotheses[0]?.text).not.toMatch(/fraud|wrongdoing|illegal/i);
    expect(hit?.id).toBe(
      buildObservations(
        baseInput({
          snapshots: [
            snap({ parcelId: "p1", ownerNameRaw: "JOHN SMITH", joinMethod: "map_lot", hasAssessment: true }),
            snap({ parcelId: "p2", ownerNameRaw: "JOHN SMYTH", joinMethod: "map_lot", hasAssessment: true }),
          ],
          features: [feat({ parcelId: "p1", unjoinedFlag: false }), feat({ parcelId: "p2", unjoinedFlag: false })],
          scores: [emptyScore("p1"), emptyScore("p2")],
          graphEdges: [edge],
        }),
      ).find((o) => o.observationType === "similar_name_adjacent")?.id,
    );
  });

  it("labels an unjoined polygon among joined WA-map neighbors as a plat hole, not a missing owner", () => {
    const obs = buildObservations(
      baseInput({
        snapshots: [
          snap({ parcelId: "hole", municipalityId: "baring-plt" }),
          snap({ parcelId: "n1", municipalityId: "baring-plt", joinMethod: "map_lot", hasAssessment: true }),
          snap({ parcelId: "n2", municipalityId: "baring-plt", joinMethod: "map_lot", hasAssessment: true }),
          snap({ parcelId: "n3", municipalityId: "baring-plt", joinMethod: "map_lot", hasAssessment: true }),
        ],
        features: [
          feat({ parcelId: "hole", unjoinedFlag: true, tplFamily: "wap_plat" }),
          feat({ parcelId: "n1", unjoinedFlag: false, tplFamily: "wa_map" }),
          feat({ parcelId: "n2", unjoinedFlag: false, tplFamily: "wa_map" }),
          feat({ parcelId: "n3", unjoinedFlag: false, tplFamily: "wa_map" }),
        ],
        scores: [emptyScore("hole"), emptyScore("n1"), emptyScore("n2"), emptyScore("n3")],
        neighbors: [...touch("hole", "n1"), ...touch("hole", "n2"), ...touch("hole", "n3")],
      }),
    );
    const hole = obs.find((o) => o.observationType === "unjoined_plat_hole");
    expect(hole?.parcelIds).toContain("hole");
    expect(hole?.hypotheses[0]?.text).toMatch(/Plat-key hypothesis listed first/);
    expect(hole?.hypotheses[0]?.text).toMatch(/not a missing owner/);
  });

  it("flags copied multi-lot groups whose GIS acres differ widely and does not invent splits", () => {
    const obs = buildObservations(
      baseInput({
        snapshots: [snap({ parcelId: "a" }), snap({ parcelId: "b" })],
        features: [
          feat({
            parcelId: "a",
            unjoinedFlag: false,
            tplFamily: "wa_map",
            gisAcreage: 2,
            multiLotGroupId: "gid-1",
            valuationAllocation: "copied_full_assessment",
            taxable: 50000,
          }),
          feat({
            parcelId: "b",
            unjoinedFlag: false,
            tplFamily: "wa_map",
            gisAcreage: 80,
            multiLotGroupId: "gid-1",
            valuationAllocation: "copied_full_assessment",
            taxable: 50000,
          }),
        ],
        scores: [emptyScore("a"), emptyScore("b")],
      }),
    );
    const hit = obs.find((o) => o.observationType === "copied_multilot_acre_spread");
    expect(hit?.recommendedFollowups[0]).toMatch(/Do not invent split values/);
    expect(hit?.observed).toBe(40);
  });

  it("groups land+building >> taxable with null exemption, and skips when exemption is present", () => {
    const withNull = buildObservations(
      baseInput({
        snapshots: [snap({ parcelId: "x", municipalityId: "day-block-twp" })],
        features: [
          feat({
            parcelId: "x",
            unjoinedFlag: false,
            landPlusBuilding: 20_000,
            taxable: 8_000,
            exemption: null,
          }),
        ],
        scores: [emptyScore("x")],
      }),
    );
    const withExempt = buildObservations(
      baseInput({
        snapshots: [snap({ parcelId: "x", municipalityId: "day-block-twp" })],
        features: [
          feat({
            parcelId: "x",
            unjoinedFlag: false,
            landPlusBuilding: 20_000,
            taxable: 8_000,
            exemption: 12_000,
          }),
        ],
        scores: [emptyScore("x")],
      }),
    );
    expect(withNull.some((o) => o.observationType === "land_building_vs_taxable_exemption_null")).toBe(
      true,
    );
    expect(withExempt.some((o) => o.observationType === "land_building_vs_taxable_exemption_null")).toBe(
      false,
    );
  });

  it("treats unjoined tax rows as records without land, not cheap land", () => {
    const tax = (id: string, joined: boolean): TaxRecordSnapshot => ({
      id: `${id}|2025`,
      runId: "run",
      taxRecordId: id,
      taxYear: 2025,
      valuationAsOf: "2025-01-01",
      territoryType: "ut",
      mapJoinKey: null,
      mapLot: null,
      propertyId: null,
      accountNumber: null,
      ownerNameRaw: "SOMEONE",
      mailAddressRaw: null,
      assessedLandValueSource: null,
      assessedLandValueNumeric: null,
      assessedBuildingValueSource: null,
      assessedBuildingValueNumeric: null,
      assessedTotalValueSource: "1000",
      assessedTotalValueNumeric: 1000,
      assessedExemptionValueSource: null,
      assessedExemptionValueNumeric: null,
      assessedPersonalPropertyValueSource: null,
      assessedPersonalPropertyValueNumeric: null,
      taxAmountSource: null,
      taxAmountNumeric: null,
      percentOwnershipSource: null,
      taxAcreageSource: null,
      taxAcreageNumeric: null,
      parcelId: joined ? "p" : null,
      joinedToGeometry: joined,
      taxSourceId: "mrs-ut-valuation-2025",
      attrsRaw: null,
    });
    const obs = buildObservations(
      baseInput({
        taxRecordSnapshots: [tax("t1", false), tax("t2", true)],
      }),
    );
    const hit = obs.find((o) => o.observationType === "unjoined_tax_records");
    expect(hit?.unit).toBe("absence");
    expect(hit?.observed).toBe(1);
    expect(hit?.hypotheses[0]?.text).toMatch(/without land geometry/);
    expect(hit?.hypotheses[0]?.text).toMatch(/not cheap land/);
  });

  it("does not flag organized mail unless the assessment is peer-deviant", () => {
    const mkScore = (pct: number): ParcelValuationScore => ({
      ...emptyScore("p1"),
      scored: true,
      skipReason: null,
      vacantFlag: true,
      taxableTownship: {
        observed: 1000,
        expected: 2000,
        residual: -1000,
        percentile: pct,
        madLog: -1,
        repeatedValueClass: false,
        peer: { kind: "township", id: "t", n: 20, underpowered: false, vacant: true, band: null },
      },
    });
    const common = {
      snapshots: [
        snap({
          parcelId: "p1",
          municipalityId: "trescott-twp",
          taxMunicipalityId: "lubec",
          ownerNameRaw: "JANE DOE",
          joinMethod: "map_lot",
          hasAssessment: true,
        }),
      ],
      features: [feat({ parcelId: "p1", unjoinedFlag: false, tplFamily: "wa_map" })],
    };
    const quiet = buildObservations(baseInput({ ...common, scores: [mkScore(0.4)] }));
    const loud = buildObservations(baseInput({ ...common, scores: [mkScore(0.99)] }));
    expect(quiet.some((o) => o.observationType === "mail_organized_peer_deviant")).toBe(false);
    expect(loud.some((o) => o.observationType === "mail_organized_peer_deviant")).toBe(true);
  });

  it("down-ranks institutional high local acre share + low vacant value/acre", () => {
    const score: ParcelValuationScore = {
      ...emptyScore("p1"),
      scored: true,
      skipReason: null,
      vacantFlag: true,
      valuePerAcreTownship: {
        observed: 50,
        expected: 500,
        residual: -450,
        percentile: 0.02,
        madLog: -2,
        repeatedValueClass: false,
        peer: {
          kind: "township",
          id: "edmunds-twp|v",
          n: 20,
          underpowered: false,
          vacant: true,
          band: null,
        },
      },
    };
    const obs = buildObservations(
      baseInput({
        snapshots: [
          snap({
            parcelId: "p1",
            ownerNameRaw: "TYPHOON LLC",
            municipalityId: "edmunds-twp",
            joinMethod: "map_lot",
            hasAssessment: true,
          }),
        ],
        features: [
          feat({
            parcelId: "p1",
            unjoinedFlag: false,
            vacantFlag: true,
            tplFamily: "wa_map",
            valuePerGisAcre: 50,
          }),
        ],
        scores: [score],
        entities: [emptyEntity("TYPHOON LLC", 0.4)],
      }),
    );
    const hit = obs.find((o) => o.observationType === "high_local_share_low_vpa");
    expect(hit?.priority).toBe("suppressed");
    expect(hit?.hypotheses[0]?.text).toMatch(/institutional ownership/);
  });

  it("emits a township join-gap cluster when a zero-join town touches a high-join town", () => {
    const obs = buildObservations(
      baseInput({
        snapshots: [
          snap({ parcelId: "a1", municipalityId: "baring-plt" }),
          snap({ parcelId: "a2", municipalityId: "baring-plt" }),
          snap({
            parcelId: "b1",
            municipalityId: "edmunds-twp",
            joinMethod: "map_lot",
            hasAssessment: true,
          }),
          snap({
            parcelId: "b2",
            municipalityId: "edmunds-twp",
            joinMethod: "map_lot",
            hasAssessment: true,
          }),
        ],
        features: [
          feat({ parcelId: "a1", unjoinedFlag: true, tplFamily: "wap_plat" }),
          feat({ parcelId: "a2", unjoinedFlag: true, tplFamily: "wap_plat" }),
          feat({ parcelId: "b1", unjoinedFlag: false, tplFamily: "wa_map" }),
          feat({ parcelId: "b2", unjoinedFlag: false, tplFamily: "wa_map" }),
        ],
        scores: [emptyScore("a1"), emptyScore("a2"), emptyScore("b1"), emptyScore("b2")],
        neighbors: touch("a1", "b1"),
      }),
    );
    const gap = obs.find((o) => o.observationType === "township_join_gap");
    expect(gap?.scope).toBe("baring-plt");
    expect(gap?.hypotheses[0]?.text).toMatch(/not ownerless land/);
  });
});
