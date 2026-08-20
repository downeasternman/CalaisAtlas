import {
  explainTaxableResidual,
  type ParcelValuationScore,
} from "./peers";

export const CATALOGUE_SIZE = 25;

export interface CatalogueEntry {
  parcelId: string;
  municipalityId: string | null;
  vacantFlag: boolean;
  observed: number;
  expected: number;
  residual: number;
  percentile: number | null;
  madLog: number | null;
  peerKind: string;
  peerN: number;
  explanation: string;
}

function usableResidual(score: ParcelValuationScore): {
  residual: number;
  metric: NonNullable<ParcelValuationScore["taxableBand"]>;
} | null {
  const metric = !score.taxableBand?.peer.underpowered
    ? score.taxableBand
    : !score.taxableTownship?.peer.underpowered
      ? score.taxableTownship
      : !score.taxableKnn?.peer.underpowered
        ? score.taxableKnn
        : null;
  if (!metric || metric.residual == null || metric.observed == null || metric.expected == null) {
    return null;
  }
  return { residual: metric.residual, metric };
}

export function buildValuationCatalogue(scores: ParcelValuationScore[]): {
  highTaxableResidual: CatalogueEntry[];
  lowTaxableResidual: CatalogueEntry[];
} {
  const rows: Array<{ score: ParcelValuationScore; residual: number }> = [];
  for (const score of scores) {
    if (!score.scored) continue;
    const usable = usableResidual(score);
    if (!usable) continue;
    rows.push({ score, residual: usable.residual });
  }

  const toEntry = (score: ParcelValuationScore): CatalogueEntry | null => {
    const usable = usableResidual(score);
    const explanation = explainTaxableResidual(score);
    if (!usable || !explanation) return null;
    return {
      parcelId: score.parcelId,
      municipalityId: score.municipalityId,
      vacantFlag: score.vacantFlag,
      observed: usable.metric.observed!,
      expected: usable.metric.expected!,
      residual: usable.residual,
      percentile: usable.metric.percentile,
      madLog: usable.metric.madLog,
      peerKind: usable.metric.peer.kind,
      peerN: usable.metric.peer.n,
      explanation,
    };
  };

  const high = [...rows]
    .sort((a, b) => b.residual - a.residual)
    .slice(0, CATALOGUE_SIZE)
    .map((row) => toEntry(row.score))
    .filter((e): e is CatalogueEntry => e != null);

  const low = [...rows]
    .sort((a, b) => a.residual - b.residual)
    .slice(0, CATALOGUE_SIZE)
    .map((row) => toEntry(row.score))
    .filter((e): e is CatalogueEntry => e != null);

  return { highTaxableResidual: high, lowTaxableResidual: low };
}
