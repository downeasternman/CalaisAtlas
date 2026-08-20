export const MIN_PEER_N = 12;
export const MAD_SCALE = 0.6745;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function mad(values: number[]): number | null {
  const med = median(values);
  if (med == null) return null;
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

/** Empirical percentile of x in values: share of values strictly less than x. */
export function empiricalPercentile(x: number, values: number[]): number | null {
  if (values.length === 0) return null;
  let less = 0;
  for (const v of values) {
    if (v < x) less++;
  }
  return less / values.length;
}

export type MadScoreResult = {
  score: number | null;
  repeatedValueClass: boolean;
};

/** Robust z on already-transformed values. MAD=0 → repeated-value class, not ±∞. */
export function madScore(x: number, values: number[]): MadScoreResult {
  const med = median(values);
  const scatter = mad(values);
  if (med == null || scatter == null) return { score: null, repeatedValueClass: false };
  if (scatter === 0) return { score: null, repeatedValueClass: true };
  return { score: (MAD_SCALE * (x - med)) / scatter, repeatedValueClass: false };
}

export function log1pSafe(x: number): number {
  return Math.log1p(Math.max(0, x));
}
