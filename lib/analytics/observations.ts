import { isInstitutionalBaseline, analyticalNormalizeOwner } from "./owner-normalize";
import type { ParcelFeature } from "./features";
import type { GraphEdge, OwnerEntity } from "./ownership";
import type { ParcelValuationScore } from "./peers";
import type { ParcelSpatialFeature, SpatialNeighborRow } from "./spatial";
import type { ParcelSnapshot, TaxRecordSnapshot } from "./types";

export const OBSERVATION_PARAMS = {
  similarNameAdjacent: { rule: "similar_name_adjacent_different_owner" },
  highShareLowVpa: {
    minTownshipAcreShare: 0.2,
    maxVpaPercentile: 0.1,
    requireVacant: true,
  },
  platHole: {
    minTouchNeighbors: 3,
    minJoinedWaMapNeighborShare: 0.75,
  },
  townshipJoinGap: {
    maxJoinRate: 0.05,
    neighborMinJoinRate: 0.9,
  },
  copiedAcreSpread: {
    minLotCount: 2,
    minAcreRatio: 3,
    minAcreRange: 10,
  },
  mailOrganizedPeerDeviant: {
    lowPercentile: 0.05,
    highPercentile: 0.95,
  },
  landBuildingVsTaxable: {
    minRatio: 1.25,
    minGap: 1000,
  },
  vacantAmongImproved: {
    minGisAcres: 100,
    minTouchNeighbors: 3,
    minImprovedNeighborShare: 0.75,
  },
} as const;

export type ObservationUnit = "parcel" | "owner" | "cluster" | "pattern" | "absence";
export type ObservationSeverity = "low" | "medium";
export type ObservationPriority = "suppressed" | "low" | "medium";

export interface Observation {
  id: string;
  observationType: string;
  unit: ObservationUnit;
  severity: ObservationSeverity;
  confidence: number;
  priority: ObservationPriority;
  dimensions: {
    valuation?: boolean;
    spatial?: boolean;
    ownership?: boolean;
    relationship?: boolean;
    distribution?: boolean;
    data_quality?: boolean;
    structural?: boolean;
  };
  scope: string;
  parcelIds: string[];
  ownerIds: string[];
  clusterIds: string[];
  peerGroup: { type: string; id: string; n: number; filters: string[] } | null;
  observed: number | null;
  expected: number | null;
  residual: number | null;
  percentile: number | null;
  madScore: number | null;
  evidence: Array<{
    field: string;
    sourceRecordId: string | null;
    sourceDocumentId: string | null;
    transform: string;
    value: unknown;
  }>;
  relationships: Array<{ type: string; from: string; to: string; score: number | null }>;
  alternativeExplanations: string[];
  dataQualityFlags: string[];
  hypotheses: Array<{
    text: string;
    confidence: number;
    strengthen: string;
    falsify: string;
  }>;
  recommendedFollowups: string[];
  calculationProvenance: {
    runId: string;
    gitSha: string | null;
    params: Record<string, unknown>;
  };
  createdAt: string;
  taxYear: number;
}

export interface ObservationBuildInput {
  runId: string;
  taxYear: number;
  createdAt: string;
  gitSha: string | null;
  snapshots: ParcelSnapshot[];
  features: ParcelFeature[];
  scores: ParcelValuationScore[];
  spatial: ParcelSpatialFeature[];
  neighbors: SpatialNeighborRow[];
  entities: OwnerEntity[];
  graphEdges: GraphEdge[];
  taxRecordSnapshots: TaxRecordSnapshot[];
  organizedMunicipalityIds: string[];
}

function obsId(type: string, key: string): string {
  return `obs:${type}:${key}`;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function usablePercentile(score: ParcelValuationScore | undefined): number | null {
  if (!score?.scored) return null;
  const metric =
    score.taxableBand && !score.taxableBand.peer.underpowered
      ? score.taxableBand
      : score.taxableTownship && !score.taxableTownship.peer.underpowered
        ? score.taxableTownship
        : score.taxableKnn && !score.taxableKnn.peer.underpowered
          ? score.taxableKnn
          : null;
  return metric?.percentile ?? null;
}

function vpaTownship(score: ParcelValuationScore | undefined) {
  const metric = score?.valuePerAcreTownship;
  if (!metric || metric.peer.underpowered) return null;
  return metric;
}

export function buildObservations(input: ObservationBuildInput): Observation[] {
  const organized = new Set(input.organizedMunicipalityIds);
  const featureById = new Map(input.features.map((f) => [f.parcelId, f] as const));
  const snapById = new Map(input.snapshots.map((s) => [s.parcelId, s] as const));
  const scoreById = new Map(input.scores.map((s) => [s.parcelId, s] as const));
  const ownerOfParcel = new Map<string, string>();
  for (const snap of input.snapshots) {
    const norm = analyticalNormalizeOwner(snap.ownerNameRaw);
    if (norm) ownerOfParcel.set(snap.parcelId, norm);
  }

  const touches = new Map<string, string[]>();
  for (const n of input.neighbors) {
    if (n.kind !== "touch") continue;
    const list = touches.get(n.parcelId) ?? [];
    list.push(n.neighborId);
    touches.set(n.parcelId, list);
  }

  const provenance = (params: Record<string, unknown>) => ({
    runId: input.runId,
    gitSha: input.gitSha,
    params,
  });

  const base = {
    createdAt: input.createdAt,
    taxYear: input.taxYear,
  };

  const out: Observation[] = [];

  const similarAdj = input.graphEdges.filter(
    (e) => e.type === "similar_name" && e.evidence?.adjacent === true,
  );
  const uf = new Map<string, string>();
  const find = (id: string): string => {
    const p = uf.get(id) ?? id;
    if (p !== id) {
      const r = find(p);
      uf.set(id, r);
      return r;
    }
    uf.set(id, id);
    return id;
  };
  for (const e of similarAdj) {
    const a = e.source.replace(/^owner:/, "");
    const b = e.target.replace(/^owner:/, "");
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) uf.set(ra, rb);
  }
  const similarGroups = new Map<string, Set<string>>();
  for (const e of similarAdj) {
    for (const node of [e.source, e.target]) {
      const name = node.replace(/^owner:/, "");
      const root = find(name);
      const set = similarGroups.get(root) ?? new Set();
      set.add(name);
      similarGroups.set(root, set);
    }
  }
  for (const names of similarGroups.values()) {
    const ownerIds = [...names].sort();
    const parcelIds = input.snapshots
      .filter((s) => {
        const n = analyticalNormalizeOwner(s.ownerNameRaw);
        return n != null && names.has(n);
      })
      .map((s) => s.parcelId)
      .sort();
    const edges = similarAdj.filter((e) => {
      const a = e.source.replace(/^owner:/, "");
      const b = e.target.replace(/^owner:/, "");
      return names.has(a) && names.has(b);
    });
    out.push({
      id: obsId("similar_name_adjacent", ownerIds.join("~")),
      observationType: "similar_name_adjacent",
      unit: "cluster",
      severity: "medium",
      confidence: 0.55,
      priority: "medium",
      dimensions: { ownership: true, relationship: true, spatial: true },
      scope: "ut",
      parcelIds,
      ownerIds,
      clusterIds: [],
      peerGroup: null,
      observed: null,
      expected: null,
      residual: null,
      percentile: null,
      madScore: null,
      evidence: edges.map((e) => ({
        field: "similar_name",
        sourceRecordId: e.id,
        sourceDocumentId: "mrs-ut-valuation-2025",
        transform: "token_sort_jaro_winkler>=0.92 AND adjacent AND different exact owner",
        value: { from: e.source, to: e.target, score: e.score },
      })),
      relationships: edges.map((e) => ({
        type: "similar_name",
        from: e.source,
        to: e.target,
        score: e.score,
      })),
      alternativeExplanations: [
        "Same household recorded with different name order or initials",
        "Related parties, not a single legal entity",
      ],
      dataQualityFlags: ["similar_name_not_same_entity"],
      hypotheses: [
        {
          text: "Potential ownership relationship requiring review. Exact normalized strings differ, so these are not the same entity.",
          confidence: 0.55,
          strengthen: "Shared mail or deed/name variants confirmed in source PDFs.",
          falsify: "Names refer to unrelated owners who happen to be neighbors.",
        },
      ],
      recommendedFollowups: [
        "Compare mail lines and map lots in the valuation book; do not auto-merge.",
      ],
      calculationProvenance: provenance({ ...OBSERVATION_PARAMS.similarNameAdjacent }),
      ...base,
    });
  }

  for (const ent of input.entities) {
    for (const share of ent.townshipShares) {
      if (share.acreShare == null || share.acreShare < OBSERVATION_PARAMS.highShareLowVpa.minTownshipAcreShare) {
        continue;
      }
      const members = input.snapshots.filter((s) => {
        if (s.municipalityId !== share.municipalityId) return false;
        return analyticalNormalizeOwner(s.ownerNameRaw) === ent.nameNormalized;
      });
      const lowVpa = members.filter((s) => {
        const f = featureById.get(s.parcelId);
        if (!f || !f.vacantFlag) return false;
        const metric = vpaTownship(scoreById.get(s.parcelId));
        if (!metric || metric.percentile == null) return false;
        return metric.percentile <= OBSERVATION_PARAMS.highShareLowVpa.maxVpaPercentile;
      });
      if (lowVpa.length === 0) continue;
      const sample = scoreById.get(lowVpa[0]!.parcelId);
      const metric = vpaTownship(sample);
      const institutional = ent.institutionalBaseline;
      const coastal = share.municipalityId === "trescott-twp";
      out.push({
        id: obsId("high_local_share_low_vpa", `${ent.nameNormalized}~${share.municipalityId}`),
        observationType: "high_local_share_low_vpa",
        unit: "owner",
        severity: "medium",
        confidence: institutional ? 0.7 : 0.5,
        priority: institutional ? "suppressed" : "medium",
        dimensions: { valuation: true, distribution: true, ownership: true },
        scope: share.municipalityId,
        parcelIds: lowVpa.map((s) => s.parcelId).sort(),
        ownerIds: [ent.nameNormalized],
        clusterIds: [],
        peerGroup: metric
          ? {
              type: "township_vacant_vpa",
              id: metric.peer.id,
              n: metric.peer.n,
              filters: ["vacant", "township"],
            }
          : null,
        observed: metric?.observed ?? null,
        expected: metric?.expected ?? null,
        residual: metric?.residual ?? null,
        percentile: metric?.percentile ?? null,
        madScore: metric?.madLog ?? null,
        evidence: [
          {
            field: "maxTownshipAcreShare",
            sourceRecordId: ent.id,
            sourceDocumentId: "mrs-ut-parcels",
            transform: "owner gis acres / township gis acres",
            value: share.acreShare,
          },
        ],
        relationships: [],
        alternativeExplanations: institutional
          ? ["Institutional timber, state, federal, or conservation holder; low value/acre is expected for vacant land"]
          : ["Vacant land, Tree Growth, or large wildland tract"],
        dataQualityFlags: [
          ...(institutional ? ["institutional_baseline"] : []),
          "vacant",
          ...(coastal ? ["coastal_township_no_shoreline_metric"] : []),
        ],
        hypotheses: [
          {
            text: institutional
              ? "Looked extreme; explained by institutional ownership and vacant land."
              : "High local GIS-acre share with low value per GIS acre versus vacant township peers. Not a finding of error or wrongdoing.",
            confidence: institutional ? 0.7 : 0.5,
            strengthen: "Peer group remains powered after removing copied lots.",
            falsify: "Value/acre is not low after vacant split, or acre share is below the parameter.",
          },
        ],
        recommendedFollowups: [
          "Keep vacant/improved split; do not treat timber or conservation holdings as outliers by default.",
        ],
        calculationProvenance: provenance({ ...OBSERVATION_PARAMS.highShareLowVpa }),
        ...base,
      });
    }
  }

  const holeByTownship = new Map<string, string[]>();
  for (const f of input.features) {
    if (!f.unjoinedFlag) continue;
    const nbrs = touches.get(f.parcelId) ?? [];
    if (nbrs.length < OBSERVATION_PARAMS.platHole.minTouchNeighbors) continue;
    let joinedWa = 0;
    for (const id of nbrs) {
      const nf = featureById.get(id);
      if (nf && !nf.unjoinedFlag && nf.tplFamily === "wa_map") joinedWa++;
    }
    const share = joinedWa / nbrs.length;
    if (share < OBSERVATION_PARAMS.platHole.minJoinedWaMapNeighborShare) continue;
    const twp = snapById.get(f.parcelId)?.municipalityId ?? "_none";
    const list = holeByTownship.get(twp) ?? [];
    list.push(f.parcelId);
    holeByTownship.set(twp, list);
  }
  for (const [township, parcelIds] of holeByTownship) {
    const sorted = [...parcelIds].sort();
    const families = new Set(
      sorted.map((id) => featureById.get(id)?.tplFamily ?? "unknown"),
    );
    out.push({
      id: obsId("unjoined_plat_hole", township),
      observationType: "unjoined_plat_hole",
      unit: "cluster",
      severity: "low",
      confidence: 0.85,
      priority: "low",
      dimensions: { data_quality: true, spatial: true, structural: true },
      scope: township,
      parcelIds: sorted,
      ownerIds: [],
      clusterIds: [],
      peerGroup: null,
      observed: sorted.length,
      expected: null,
      residual: null,
      percentile: null,
      madScore: null,
      evidence: [
        {
          field: "tplFamily",
          sourceRecordId: null,
          sourceDocumentId: "mrs-ut-parcels",
          transform: "unjoined AND touch neighbors mostly joined wa_map",
          value: { families: [...families], params: OBSERVATION_PARAMS.platHole },
        },
      ],
      relationships: [],
      alternativeExplanations: ["Plat TPL family does not join the WA-map valuation book"],
      dataQualityFlags: ["unjoined", "plat_join_gap"],
      hypotheses: [
        {
          text: "Unexpected absence of a tax join. Plat-key hypothesis listed first: TPL family is not wa_map, so this is a data-quality class, not a missing owner.",
          confidence: 0.85,
          strengthen: "Neighbors are joined WA-map parcels; this polygon uses WAP/PE/HA/ARP or unknown TPL.",
          falsify: "A WA-map mapJoinKey exists for this polygon in the 2025 valuation book.",
        },
      ],
      recommendedFollowups: [
        "Do not treat these polygons as ownerless or as valuation cold spots.",
      ],
      calculationProvenance: provenance({ ...OBSERVATION_PARAMS.platHole }),
      ...base,
    });
  }

  const townshipStats = new Map<string, { n: number; joined: number }>();
  for (const f of input.features) {
    const twp = snapById.get(f.parcelId)?.municipalityId;
    if (!twp) continue;
    const s = townshipStats.get(twp) ?? { n: 0, joined: 0 };
    s.n += 1;
    if (!f.unjoinedFlag) s.joined += 1;
    townshipStats.set(twp, s);
  }
  const townshipAdj = new Map<string, Set<string>>();
  for (const [a, nbrs] of touches) {
    const ta = snapById.get(a)?.municipalityId;
    if (!ta) continue;
    for (const b of nbrs) {
      const tb = snapById.get(b)?.municipalityId;
      if (!tb || tb === ta) continue;
      const set = townshipAdj.get(ta) ?? new Set();
      set.add(tb);
      townshipAdj.set(ta, set);
    }
  }
  for (const [twp, stat] of townshipStats) {
    const joinRate = stat.n > 0 ? stat.joined / stat.n : 0;
    if (joinRate > OBSERVATION_PARAMS.townshipJoinGap.maxJoinRate) continue;
    const highNeighbors = [...(townshipAdj.get(twp) ?? [])].filter((other) => {
      const os = townshipStats.get(other);
      if (!os || os.n === 0) return false;
      return os.joined / os.n >= OBSERVATION_PARAMS.townshipJoinGap.neighborMinJoinRate;
    });
    if (highNeighbors.length === 0) continue;
    const members = input.snapshots
      .filter((s) => s.municipalityId === twp)
      .map((s) => s.parcelId)
      .sort();
    out.push({
      id: obsId("township_join_gap", twp),
      observationType: "township_join_gap",
      unit: "cluster",
      severity: "low",
      confidence: 0.9,
      priority: "low",
      dimensions: { data_quality: true, structural: true },
      scope: twp,
      parcelIds: members,
      ownerIds: [],
      clusterIds: [],
      peerGroup: null,
      observed: joinRate,
      expected: OBSERVATION_PARAMS.townshipJoinGap.neighborMinJoinRate,
      residual: joinRate - OBSERVATION_PARAMS.townshipJoinGap.neighborMinJoinRate,
      percentile: null,
      madScore: null,
      evidence: [
        {
          field: "joinRate",
          sourceRecordId: twp,
          sourceDocumentId: "mrs-ut-parcels",
          transform: "joined parcels / township parcels",
          value: { joinRate, joined: stat.joined, n: stat.n, highJoinNeighbors: highNeighbors },
        },
      ],
      relationships: [],
      alternativeExplanations: ["Township geometry uses plat TPL families that do not join WA-map tax maps"],
      dataQualityFlags: ["unjoined", "township_join_gap"],
      hypotheses: [
        {
          text: "Township has little or no tax join while adjacent townships exceed 90% join. Plat-key / map-system mismatch, not ownerless land.",
          confidence: 0.9,
          strengthen: "TPL family is WAP/PE/HA/ARP for most parcels.",
          falsify: "WA-map keys exist for these parcels in the valuation book.",
        },
      ],
      recommendedFollowups: ["Treat the whole township as a data-quality cluster until a plat crosswalk exists."],
      calculationProvenance: provenance({ ...OBSERVATION_PARAMS.townshipJoinGap }),
      ...base,
    });
  }

  const byGroup = new Map<string, ParcelFeature[]>();
  for (const f of input.features) {
    if (!f.multiLotGroupId) continue;
    const list = byGroup.get(f.multiLotGroupId) ?? [];
    list.push(f);
    byGroup.set(f.multiLotGroupId, list);
  }
  for (const [gid, group] of byGroup) {
    if (group.length < OBSERVATION_PARAMS.copiedAcreSpread.minLotCount) continue;
    if (!group.some((f) => f.valuationAllocation === "copied_full_assessment")) continue;
    const acres = group.map((f) => f.gisAcreage).filter((v): v is number => v != null && v > 0);
    if (acres.length < 2) continue;
    const minA = Math.min(...acres);
    const maxA = Math.max(...acres);
    const ratio = minA > 0 ? maxA / minA : Infinity;
    const range = maxA - minA;
    if (
      ratio < OBSERVATION_PARAMS.copiedAcreSpread.minAcreRatio ||
      range < OBSERVATION_PARAMS.copiedAcreSpread.minAcreRange
    ) {
      continue;
    }
    out.push({
      id: obsId("copied_multilot_acre_spread", gid),
      observationType: "copied_multilot_acre_spread",
      unit: "cluster",
      severity: "low",
      confidence: 0.8,
      priority: "low",
      dimensions: { structural: true, valuation: true, data_quality: true },
      scope: gid,
      parcelIds: group.map((f) => f.parcelId).sort(),
      ownerIds: [],
      clusterIds: [gid],
      peerGroup: null,
      observed: ratio,
      expected: 1,
      residual: ratio - 1,
      percentile: null,
      madScore: null,
      evidence: [
        {
          field: "gisAcreage",
          sourceRecordId: gid,
          sourceDocumentId: "mrs-ut-parcels",
          transform: "copied_full_assessment group max/min GIS acres",
          value: { minA, maxA, ratio, range, lotCount: group.length },
        },
      ],
      relationships: group.slice(1).map((f) => ({
        type: "copied_assessment",
        from: group[0]!.parcelId,
        to: f.parcelId,
        score: null,
      })),
      alternativeExplanations: [
        "PDF multi-lot line copied the full assessment onto each GIS polygon",
      ],
      dataQualityFlags: ["copied_full_assessment"],
      hypotheses: [
        {
          text: "Copied full assessment across lots whose GIS acres differ widely. Per-lot value/acre is undefined until allocated.",
          confidence: 0.8,
          strengthen: "valuationAllocation is copied_full_assessment and GIS acres span the parameter thresholds.",
          falsify: "Lots were independently assessed, or GIS acres are comparable.",
        },
      ],
      recommendedFollowups: ["Exclude from lot-level value/acre until an allocation method exists. Do not invent split values."],
      calculationProvenance: provenance({ ...OBSERVATION_PARAMS.copiedAcreSpread }),
      ...base,
    });
  }

  const mailHits = input.snapshots.filter((s) => {
    if (!s.taxMunicipalityId || !organized.has(s.taxMunicipalityId)) return false;
    if (!s.municipalityId || organized.has(s.municipalityId)) return false;
    const pct = usablePercentile(scoreById.get(s.parcelId));
    if (pct == null) return false;
    return (
      pct <= OBSERVATION_PARAMS.mailOrganizedPeerDeviant.lowPercentile ||
      pct >= OBSERVATION_PARAMS.mailOrganizedPeerDeviant.highPercentile
    );
  });
  if (mailHits.length > 0) {
    out.push({
      id: obsId("mail_organized_peer_deviant", "ut"),
      observationType: "mail_organized_peer_deviant",
      unit: "pattern",
      severity: "low",
      confidence: 0.45,
      priority: "low",
      dimensions: { valuation: true, ownership: true },
      scope: "ut",
      parcelIds: mailHits.map((s) => s.parcelId).sort(),
      ownerIds: [],
      clusterIds: [],
      peerGroup: null,
      observed: mailHits.length,
      expected: null,
      residual: null,
      percentile: null,
      madScore: null,
      evidence: mailHits.slice(0, 25).map((s) => ({
        field: "taxMunicipalityId",
        sourceRecordId: s.parcelId,
        sourceDocumentId: "mrs-ut-valuation-2025",
        transform: "mail city organized AND GIS UT AND peer percentile extreme",
        value: {
          taxMunicipalityId: s.taxMunicipalityId,
          municipalityId: s.municipalityId,
          percentile: usablePercentile(scoreById.get(s.parcelId)),
        },
      })),
      relationships: [],
      alternativeExplanations: [
        "Mail in an organized town is common for UT owners; flagged only because the assessment is peer-deviant",
      ],
      dataQualityFlags: ["mail_city_ne_gis_town"],
      hypotheses: [
        {
          text: "GIS township and mail city disagree, and the taxable value is extreme versus peers. Mail mismatch alone is not unusual.",
          confidence: 0.45,
          strengthen: "Peer group is powered and residual remains after vacant split.",
          falsify: "Percentile is not extreme, or taxMunicipalityId is also UT.",
        },
      ],
      recommendedFollowups: ["Do not flag all organized-mail UT parcels; keep the peer-deviant filter."],
      calculationProvenance: provenance({ ...OBSERVATION_PARAMS.mailOrganizedPeerDeviant }),
      ...base,
    });
  }

  const exemptionGaps = new Map<string, string[]>();
  for (const f of input.features) {
    if (f.exemption != null) continue;
    if (f.landPlusBuilding == null || f.taxable == null) continue;
    const gap = f.landPlusBuilding - f.taxable;
    const ratio = f.taxable > 0 ? f.landPlusBuilding / f.taxable : Infinity;
    if (ratio < OBSERVATION_PARAMS.landBuildingVsTaxable.minRatio) continue;
    if (gap < OBSERVATION_PARAMS.landBuildingVsTaxable.minGap) continue;
    const twp = snapById.get(f.parcelId)?.municipalityId ?? "_none";
    const list = exemptionGaps.get(twp) ?? [];
    list.push(f.parcelId);
    exemptionGaps.set(twp, list);
  }
  for (const [township, parcelIds] of exemptionGaps) {
    const sorted = [...parcelIds].sort();
    out.push({
      id: obsId("land_building_vs_taxable_exemption_null", township),
      observationType: "land_building_vs_taxable_exemption_null",
      unit: "pattern",
      severity: "low",
      confidence: 0.6,
      priority: "low",
      dimensions: { valuation: true, data_quality: true },
      scope: township,
      parcelIds: sorted,
      ownerIds: [],
      clusterIds: [],
      peerGroup: null,
      observed: sorted.length,
      expected: null,
      residual: null,
      percentile: null,
      madScore: null,
      evidence: [
        {
          field: "landPlusBuilding",
          sourceRecordId: sorted[0] ?? null,
          sourceDocumentId: "mrs-ut-valuation-2025",
          transform: "land+building >> taxable AND exemption null",
          value: { ...OBSERVATION_PARAMS.landBuildingVsTaxable, count: sorted.length },
        },
      ],
      relationships: [],
      alternativeExplanations: [
        "Exemption present in the book but not parsed",
        "Current-use / Tree Growth / other reduction without an exemption line",
      ],
      dataQualityFlags: ["exemption_null"],
      hypotheses: [
        {
          text: "Land plus building is much larger than taxable value, and exemption is still null after re-parse. Null means not extracted, not zero.",
          confidence: 0.6,
          strengthen: "PDF shows an exemption line that the parser missed.",
          falsify: "Taxable equals land+building, or an exemption amount is present.",
        },
      ],
      recommendedFollowups: ["Do not invent an exemption amount. Re-check the PDF block if reviewing a specific lot."],
      calculationProvenance: provenance({ ...OBSERVATION_PARAMS.landBuildingVsTaxable }),
      ...base,
    });
  }

  const unjoinedTax = input.taxRecordSnapshots.filter((t) => !t.joinedToGeometry);
  if (unjoinedTax.length > 0) {
    out.push({
      id: obsId("unjoined_tax_records", `ut-${input.taxYear}`),
      observationType: "unjoined_tax_records",
      unit: "absence",
      severity: "low",
      confidence: 0.95,
      priority: "low",
      dimensions: { data_quality: true, structural: true },
      scope: "ut",
      parcelIds: [],
      ownerIds: [],
      clusterIds: [],
      peerGroup: null,
      observed: unjoinedTax.length,
      expected: 0,
      residual: unjoinedTax.length,
      percentile: null,
      madScore: null,
      evidence: [
        {
          field: "joinedToGeometry",
          sourceRecordId: null,
          sourceDocumentId: "mrs-ut-valuation-2025",
          transform: "tax_record_snapshots where joinedToGeometry=false",
          value: {
            count: unjoinedTax.length,
            sampleIds: unjoinedTax.slice(0, 25).map((t) => t.taxRecordId),
          },
        },
      ],
      relationships: [],
      alternativeExplanations: ["Valuation-book lots whose map keys do not hit GIS polygons"],
      dataQualityFlags: ["unjoined_tax", "records_without_land"],
      hypotheses: [
        {
          text: "These are tax records without land geometry — not cheap land and not missing owners on a map.",
          confidence: 0.95,
          strengthen: "geomParcelId / parcelId is null on the tax-record snapshot.",
          falsify: "The tax row joins a GIS polygon.",
        },
      ],
      recommendedFollowups: ["Keep unjoined tax rows in snapshots; do not drop them or score them as low-value parcels."],
      calculationProvenance: provenance({ grain: "tax_record_snapshot" }),
      ...base,
    });
  }

  const vacantHits = new Map<string, string[]>();
  for (const f of input.features) {
    if (!f.vacantFlag) continue;
    if (f.gisAcreage == null || f.gisAcreage < OBSERVATION_PARAMS.vacantAmongImproved.minGisAcres) {
      continue;
    }
    const nbrs = touches.get(f.parcelId) ?? [];
    if (nbrs.length < OBSERVATION_PARAMS.vacantAmongImproved.minTouchNeighbors) continue;
    let improved = 0;
    for (const id of nbrs) {
      const nf = featureById.get(id);
      if (nf && !nf.vacantFlag && !nf.unjoinedFlag) improved++;
    }
    if (improved / nbrs.length < OBSERVATION_PARAMS.vacantAmongImproved.minImprovedNeighborShare) {
      continue;
    }
    const owner = ownerOfParcel.get(f.parcelId) ?? "_unknown";
    const list = vacantHits.get(owner) ?? [];
    list.push(f.parcelId);
    vacantHits.set(owner, list);
  }
  for (const [owner, parcelIds] of vacantHits) {
    const sorted = [...parcelIds].sort();
    const institutional = owner !== "_unknown" && isInstitutionalBaseline(owner);
    out.push({
      id: obsId("vacant_tract_among_improved", owner),
      observationType: "vacant_tract_among_improved",
      unit: "owner",
      severity: "low",
      confidence: 0.5,
      priority: institutional ? "suppressed" : "low",
      dimensions: { spatial: true, valuation: true, distribution: true },
      scope: "ut",
      parcelIds: sorted,
      ownerIds: owner === "_unknown" ? [] : [owner],
      clusterIds: [],
      peerGroup: null,
      observed: sorted.length,
      expected: null,
      residual: null,
      percentile: null,
      madScore: null,
      evidence: [
        {
          field: "vacantFlag",
          sourceRecordId: sorted[0] ?? null,
          sourceDocumentId: "mrs-ut-parcels",
          transform: "large vacant tract with mostly improved touch neighbors",
          value: { ...OBSERVATION_PARAMS.vacantAmongImproved, count: sorted.length },
        },
      ],
      relationships: [],
      alternativeExplanations: [
        "Timber, conservation, or undeveloped land next to camps or house lots",
      ],
      dataQualityFlags: ["vacant", ...(institutional ? ["institutional_baseline"] : [])],
      hypotheses: [
        {
          text: "A large vacant tract sits among improved neighbors. That is a land-use contrast, not a finding of error or wrongdoing.",
          confidence: 0.5,
          strengthen: "Building is zero with an assessment present; neighbors are improved.",
          falsify: "The tract is improved, or neighbors are also vacant.",
        },
      ],
      recommendedFollowups: ["Keep vacant/improved split before ranking value."],
      calculationProvenance: provenance({ ...OBSERVATION_PARAMS.vacantAmongImproved }),
      ...base,
    });
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}
