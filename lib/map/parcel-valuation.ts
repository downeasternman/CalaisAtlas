import type { ExpressionSpecification } from "maplibre-gl";
import { isValidMoney } from "@/lib/tax/owner-validate";

export const NO_VALUE_PCT = -1;

export const PARCEL_VALUATION_COLORS = {
  low: { fill: "#2166ac", line: "#053061" },
  lowMid: { fill: "#67a9cf", line: "#2166ac" },
  mid: { fill: "#f7f7f7", line: "#969696" },
  highMid: { fill: "#ef8a62", line: "#b2182b" },
  high: { fill: "#b2182b", line: "#67001f" },
  none: { fill: "#8aa4b0", line: "#4a6a72" },
} as const;

export type ParcelValueInput = {
  id: string;
  assessedTotalValue?: string | null;
};

/**
 * Empirical percentile of assessed total among parcels with valid money.
 * Ties share the average rank. Returns 0–100, or NO_VALUE_PCT when unranked.
 */
export function computeCalaisValuePercentiles(
  parcels: ParcelValueInput[],
): Map<string, number> {
  const ranked: Array<{ id: string; value: number }> = [];
  for (const parcel of parcels) {
    if (!isValidMoney(parcel.assessedTotalValue)) continue;
    const value = Number(String(parcel.assessedTotalValue).replace(/,/g, ""));
    ranked.push({ id: parcel.id, value });
  }

  const result = new Map<string, number>();
  for (const parcel of parcels) {
    result.set(parcel.id, NO_VALUE_PCT);
  }

  const n = ranked.length;
  if (n === 0) return result;
  if (n === 1) {
    result.set(ranked[0]!.id, 50);
    return result;
  }

  ranked.sort((a, b) => a.value - b.value);

  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && ranked[j]!.value === ranked[i]!.value) j++;
    const avgRank = (i + 1 + j) / 2;
    const pct = Math.round((100 * (avgRank - 1)) / (n - 1));
    for (let k = i; k < j; k++) {
      result.set(ranked[k]!.id, pct);
    }
    i = j;
  }

  return result;
}

export function valuePctOrMissing(valuePct: number | null | undefined): number {
  if (valuePct == null || Number.isNaN(valuePct)) return NO_VALUE_PCT;
  if (valuePct < 0) return NO_VALUE_PCT;
  return Math.max(0, Math.min(100, Math.round(valuePct)));
}

export function parcelValuationFillExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "valuePct"], NO_VALUE_PCT],
    PARCEL_VALUATION_COLORS.none.fill,
    [
      "interpolate",
      ["linear"],
      ["get", "valuePct"],
      0,
      PARCEL_VALUATION_COLORS.low.fill,
      25,
      PARCEL_VALUATION_COLORS.lowMid.fill,
      50,
      PARCEL_VALUATION_COLORS.mid.fill,
      75,
      PARCEL_VALUATION_COLORS.highMid.fill,
      100,
      PARCEL_VALUATION_COLORS.high.fill,
    ],
  ] as unknown as ExpressionSpecification;
}

export function parcelValuationLineExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "valuePct"], NO_VALUE_PCT],
    PARCEL_VALUATION_COLORS.none.line,
    [
      "interpolate",
      ["linear"],
      ["get", "valuePct"],
      0,
      PARCEL_VALUATION_COLORS.low.line,
      25,
      PARCEL_VALUATION_COLORS.lowMid.line,
      50,
      PARCEL_VALUATION_COLORS.mid.line,
      75,
      PARCEL_VALUATION_COLORS.highMid.line,
      100,
      PARCEL_VALUATION_COLORS.high.line,
    ],
  ] as unknown as ExpressionSpecification;
}
