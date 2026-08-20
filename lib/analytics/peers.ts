import { acreageBand, acreageBandLabel, type AcreageBand } from "./acreage-band";
import type { ParcelFeature } from "./features";
import {
  empiricalPercentile,
  log1pSafe,
  madScore,
  median,
  MIN_PEER_N,
} from "./robust";
import { distanceMeters, type LonLat } from "./centroid";

export const KNN_K = 25;

export type PeerKind = "township" | "acreage_band" | "knn";

export interface PeerGroupSummary {
  kind: PeerKind;
  id: string;
  n: number;
  underpowered: boolean;
  vacant: boolean;
  band: AcreageBand | null;
}

export interface MetricScore {
  observed: number | null;
  expected: number | null;
  residual: number | null;
  percentile: number | null;
  madLog: number | null;
  repeatedValueClass: boolean;
  peer: PeerGroupSummary;
}

export interface ParcelValuationScore {
  id: string;
  featureId: string;
  parcelId: string;
  taxYear: number;
  municipalityId: string | null;
  vacantFlag: boolean;
  scored: boolean;
  skipReason: string | null;
  taxableTownship: MetricScore | null;
  taxableBand: MetricScore | null;
  taxableKnn: MetricScore | null;
  valuePerAcreTownship: MetricScore | null;
  valuePerAcreBand: MetricScore | null;
  valuePerAcreKnn: MetricScore | null;
}

export interface PeerParcelInput {
  feature: ParcelFeature;
  municipalityId: string | null;
  centroid: LonLat | null;
}

function eligible(input: PeerParcelInput): boolean {
  const f = input.feature;
  if (f.unjoinedFlag) return false;
  if (f.valuationAllocation === "copied_full_assessment") return false;
  if (f.taxable == null) return false;
  return true;
}

function scoreMetric(
  observed: number | null,
  peerValues: number[],
  peer: PeerGroupSummary,
): MetricScore {
  const expected = median(peerValues);
  const residual =
    observed != null && expected != null ? observed - expected : null;
  const percentile =
    observed != null && !peer.underpowered
      ? empiricalPercentile(observed, peerValues)
      : null;
  let madLog: number | null = null;
  let repeatedValueClass = false;
  if (observed != null && !peer.underpowered) {
    const transformed = peerValues.map(log1pSafe);
    const result = madScore(log1pSafe(observed), transformed);
    madLog = result.score;
    repeatedValueClass = result.repeatedValueClass;
  }
  return {
    observed,
    expected,
    residual,
    percentile,
    madLog,
    repeatedValueClass,
    peer,
  };
}

function knnIds(
  target: PeerParcelInput,
  pool: PeerParcelInput[],
  k: number,
): PeerParcelInput[] {
  if (!target.centroid) return [];
  const ranked = pool
    .filter((p) => p.feature.parcelId !== target.feature.parcelId && p.centroid)
    .map((p) => ({
      p,
      d: distanceMeters(target.centroid!, p.centroid!),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((row) => row.p);
  return ranked;
}

export function buildValuationScores(
  inputs: PeerParcelInput[],
): ParcelValuationScore[] {
  const scoredPool = inputs.filter(eligible);

  const townshipIndex = new Map<string, PeerParcelInput[]>();
  const bandIndex = new Map<string, PeerParcelInput[]>();
  const knnPoolByVacant = new Map<boolean, PeerParcelInput[]>();

  for (const item of scoredPool) {
    const vacant = item.feature.vacantFlag;
    const muni = item.municipalityId ?? "_none";
    const townshipKey = `${muni}|${vacant ? "v" : "i"}`;
    const list = townshipIndex.get(townshipKey) ?? [];
    list.push(item);
    townshipIndex.set(townshipKey, list);

    const band = acreageBand(item.feature.gisAcreage);
    if (band) {
      const bandKey = `${townshipKey}|${band}`;
      const bandList = bandIndex.get(bandKey) ?? [];
      bandList.push(item);
      bandIndex.set(bandKey, bandList);
    }

    const knnList = knnPoolByVacant.get(vacant) ?? [];
    knnList.push(item);
    knnPoolByVacant.set(vacant, knnList);
  }

  return inputs.map((item) => {
    const f = item.feature;
    const base = {
      id: `${f.id}|valuation`,
      featureId: f.id,
      parcelId: f.parcelId,
      taxYear: f.taxYear,
      municipalityId: item.municipalityId,
      vacantFlag: f.vacantFlag,
      scored: false,
      skipReason: null as string | null,
      taxableTownship: null,
      taxableBand: null,
      taxableKnn: null,
      valuePerAcreTownship: null,
      valuePerAcreBand: null,
      valuePerAcreKnn: null,
    };

    if (f.unjoinedFlag) return { ...base, skipReason: "unjoined" };
    if (f.valuationAllocation === "copied_full_assessment") {
      return { ...base, skipReason: "copied_full_assessment" };
    }
    if (f.taxable == null) return { ...base, skipReason: "no_taxable_value" };

    const vacant = f.vacantFlag;
    const muni = item.municipalityId ?? "_none";
    const townshipKey = `${muni}|${vacant ? "v" : "i"}`;
    const townshipPeers = townshipIndex.get(townshipKey) ?? [];
    const band = acreageBand(f.gisAcreage);
    const bandKey = band ? `${townshipKey}|${band}` : null;
    const bandPeers = bandKey ? (bandIndex.get(bandKey) ?? []) : [];
    const knnPeers = knnIds(item, knnPoolByVacant.get(vacant) ?? [], KNN_K);

    const townshipSummary: PeerGroupSummary = {
      kind: "township",
      id: townshipKey,
      n: townshipPeers.length,
      underpowered: townshipPeers.length < MIN_PEER_N,
      vacant,
      band: null,
    };
    const bandSummary: PeerGroupSummary = {
      kind: "acreage_band",
      id: bandKey ?? `${townshipKey}|noband`,
      n: bandPeers.length,
      underpowered: bandPeers.length < MIN_PEER_N,
      vacant,
      band,
    };
    const knnSummary: PeerGroupSummary = {
      kind: "knn",
      id: `knn|${vacant ? "v" : "i"}|${f.parcelId}`,
      n: knnPeers.length,
      underpowered: knnPeers.length < MIN_PEER_N,
      vacant,
      band: null,
    };

    const townshipTaxable = townshipPeers
      .map((p) => p.feature.taxable)
      .filter((v): v is number => v != null);
    const bandTaxable = bandPeers
      .map((p) => p.feature.taxable)
      .filter((v): v is number => v != null);
    const knnTaxable = knnPeers
      .map((p) => p.feature.taxable)
      .filter((v): v is number => v != null);
    const townshipVpa = townshipPeers
      .map((p) => p.feature.valuePerGisAcre)
      .filter((v): v is number => v != null);
    const bandVpa = bandPeers
      .map((p) => p.feature.valuePerGisAcre)
      .filter((v): v is number => v != null);
    const knnVpa = knnPeers
      .map((p) => p.feature.valuePerGisAcre)
      .filter((v): v is number => v != null);

    return {
      ...base,
      scored: true,
      taxableTownship: scoreMetric(f.taxable, townshipTaxable, townshipSummary),
      taxableBand: scoreMetric(f.taxable, bandTaxable, bandSummary),
      taxableKnn: scoreMetric(f.taxable, knnTaxable, knnSummary),
      valuePerAcreTownship: scoreMetric(f.valuePerGisAcre, townshipVpa, {
        ...townshipSummary,
        n: townshipVpa.length,
        underpowered: townshipVpa.length < MIN_PEER_N,
      }),
      valuePerAcreBand: scoreMetric(f.valuePerGisAcre, bandVpa, {
        ...bandSummary,
        n: bandVpa.length,
        underpowered: bandVpa.length < MIN_PEER_N,
      }),
      valuePerAcreKnn: scoreMetric(f.valuePerGisAcre, knnVpa, {
        ...knnSummary,
        n: knnVpa.length,
        underpowered: knnVpa.length < MIN_PEER_N,
      }),
    };
  });
}

export function explainTaxableResidual(score: ParcelValuationScore): string | null {
  const metric = !score.taxableBand?.peer.underpowered
    ? score.taxableBand
    : !score.taxableTownship?.peer.underpowered
      ? score.taxableTownship
      : !score.taxableKnn?.peer.underpowered
        ? score.taxableKnn
        : null;
  if (!metric || metric.observed == null || metric.expected == null) return null;

  const occupancy = score.vacantFlag ? "vacant" : "improved";
  const bandText =
    metric.peer.kind === "acreage_band" && metric.peer.band
      ? ` acreage band ${acreageBandLabel(metric.peer.band)}`
      : metric.peer.kind === "knn"
        ? " (k-nearest comparable parcels)"
        : "";
  const place = score.municipalityId ?? "unknown township";
  const pct =
    metric.percentile != null ? (metric.percentile * 100).toFixed(1) : "n/a";
  const mad =
    metric.repeatedValueClass
      ? "repeated-value class (MAD=0)"
      : metric.madLog != null
        ? metric.madLog.toFixed(2)
        : "n/a";

  return (
    `Parcel ${score.parcelId} taxable value is $${Math.round(metric.observed).toLocaleString("en-US")}. ` +
    `Expected (median of ${metric.peer.n} ${occupancy} parcels in ${place}${bandText}) is ` +
    `$${Math.round(metric.expected).toLocaleString("en-US")}. ` +
    `Residual $${Math.round(metric.residual ?? 0).toLocaleString("en-US")}. ` +
    `Peer percentile ${pct}. MAD(log taxable) ${mad}. ` +
    `This is a comparison to an appropriate peer group, not a finding of error or wrongdoing.`
  );
}
