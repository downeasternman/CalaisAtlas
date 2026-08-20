import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import {
  analyticalNormalizeOwner,
  entityTypeOf,
} from "@/lib/analytics/owner-normalize";
import { isValidMoney } from "@/lib/tax/owner-validate";

export const NO_VALUE_PCT = -1;

/** Tile/API cohort codes. */
export const COHORT_NONE = -1;
export const COHORT_UNIMPROVED = 0;
export const COHORT_IMPROVED = 1;

export type ParcelCohort = typeof COHORT_NONE | typeof COHORT_UNIMPROVED | typeof COHORT_IMPROVED;

/** Maine homestead exemption amounts observed in the Calais commitment book. */
export const HOMESTEAD_EXEMPTION_AMOUNTS = new Set([25000, 31000]);

export const PARCEL_VALUATION_COLORS = {
  low: { fill: "#053061", line: "#021a33" },
  lowMid: { fill: "#2166ac", line: "#053061" },
  mid: { fill: "#f4a582", line: "#d6604d" },
  highMid: { fill: "#d6604d", line: "#b2182b" },
  high: { fill: "#67001f", line: "#3b0012" },
  none: { fill: "#8aa4b0", line: "#4a6a72" },
  /** Tax-exempt — outside the blue→red ramp. */
  exempt: { fill: "#6b4c9a", line: "#3d2a5c" },
} as const;

export type ParcelValueInput = {
  id: string;
  assessedTotalValue?: string | null;
};

export type ParcelValuePerAcreInput = {
  id: string;
  ownerName?: string | null;
  assessedTotalValue?: string | null;
  assessedLandValue?: string | null;
  assessedBuildingValue?: string | null;
  assessedExemptionValue?: string | null;
  gisAcreage?: string | null;
  attrsRaw?: Record<string, unknown> | null;
};

export type ParcelValuationAttrs = {
  valuePct: number;
  valuePerAcre: number | null;
  cohort: ParcelCohort;
  fullyExempt: boolean;
  homestead: boolean;
};

/** Parse a money string allowing zero (for building / exemption compares). */
export function parseMoneyAmount(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

export function parseGisAcres(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const num = Number(String(value).replace(/,/g, "").trim());
  if (Number.isNaN(num) || !(num > 0)) return null;
  return num;
}

/**
 * Unimproved = building parses to 0; improved = building > 0;
 * missing/unparseable building → no cohort.
 */
export function classifyBuildingCohort(
  assessedBuildingValue: string | null | undefined,
): ParcelCohort {
  const building = parseMoneyAmount(assessedBuildingValue);
  if (building == null) return COHORT_NONE;
  if (building === 0) return COHORT_UNIMPROVED;
  return COHORT_IMPROVED;
}

export function isFullyExempt(
  assessedExemptionValue: string | null | undefined,
  assessedTotalValue: string | null | undefined,
): boolean {
  const exemption = parseMoneyAmount(assessedExemptionValue);
  const total = parseMoneyAmount(assessedTotalValue);
  if (exemption == null || total == null) return false;
  if (!(total > 0)) return false;
  return exemption >= total;
}

/** When assessment is missing, exemption covering land+building is treated as fully exempt. */
export function isExemptByLandBuilding(
  assessedExemptionValue: string | null | undefined,
  assessedLandValue: string | null | undefined,
  assessedBuildingValue: string | null | undefined,
  assessedTotalValue: string | null | undefined,
): boolean {
  if (parseMoneyAmount(assessedTotalValue) != null) return false;
  const exemption = parseMoneyAmount(assessedExemptionValue);
  if (exemption == null || !(exemption > 0)) return false;
  const land = parseMoneyAmount(assessedLandValue) ?? 0;
  const building = parseMoneyAmount(assessedBuildingValue) ?? 0;
  const sum = land + building;
  if (!(sum > 0)) return false;
  return exemption >= sum;
}

/**
 * Public / institutional owners that are tax-exempt for map coloring
 * (city, federal, state, church, school/college, county).
 */
export function isPublicTaxExemptOwner(ownerName: string | null | undefined): boolean {
  const normalized = analyticalNormalizeOwner(ownerName);
  if (!normalized) return false;
  const type = entityTypeOf(normalized);
  if (
    type === "federal" ||
    type === "state" ||
    type === "municipal" ||
    type === "church"
  ) {
    return true;
  }
  if (
    /\b(COUNTY|SCHOOL|COLLEGE|UNIVERSITY|ACADEMY|HOSPITAL|HOUSING AUTHORITY|FIRE DISTRICT)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  return false;
}

export function isMapTaxExempt(input: {
  ownerName?: string | null;
  assessedExemptionValue?: string | null;
  assessedTotalValue?: string | null;
  assessedLandValue?: string | null;
  assessedBuildingValue?: string | null;
}): boolean {
  if (isPublicTaxExemptOwner(input.ownerName)) return true;
  if (isFullyExempt(input.assessedExemptionValue, input.assessedTotalValue)) return true;
  if (
    isExemptByLandBuilding(
      input.assessedExemptionValue,
      input.assessedLandValue,
      input.assessedBuildingValue,
      input.assessedTotalValue,
    )
  ) {
    return true;
  }
  return false;
}

export function hasHomesteadLabel(attrsRaw?: Record<string, unknown> | null): boolean {
  return attrsRaw?.homesteadLabel === true;
}

/** Homestead: book label, or Calais homestead exemption amounts ($25k / $31k). */
export function isHomesteadExemption(
  assessedExemptionValue: string | null | undefined,
  attrsRaw?: Record<string, unknown> | null,
): boolean {
  if (hasHomesteadLabel(attrsRaw)) return true;
  const amount = parseMoneyAmount(assessedExemptionValue);
  if (amount == null) return false;
  return HOMESTEAD_EXEMPTION_AMOUNTS.has(amount);
}

export function valuePerAcre(
  assessedTotalValue: string | null | undefined,
  gisAcreage: string | null | undefined,
): number | null {
  if (!isValidMoney(assessedTotalValue)) return null;
  const acres = parseGisAcres(gisAcreage);
  if (acres == null) return null;
  const total = parseMoneyAmount(assessedTotalValue);
  if (total == null) return null;
  return total / acres;
}

function assignEmpiricalPercentiles(
  ranked: Array<{ id: string; value: number }>,
  result: Map<string, ParcelValuationAttrs>,
): void {
  const n = ranked.length;
  if (n === 0) return;
  if (n === 1) {
    const only = ranked[0]!;
    const prev = result.get(only.id)!;
    result.set(only.id, { ...prev, valuePct: 50 });
    return;
  }

  ranked.sort((a, b) => a.value - b.value);

  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && ranked[j]!.value === ranked[i]!.value) j++;
    const avgRank = (i + 1 + j) / 2;
    const pct = Math.round((100 * (avgRank - 1)) / (n - 1));
    for (let k = i; k < j; k++) {
      const id = ranked[k]!.id;
      const prev = result.get(id)!;
      result.set(id, { ...prev, valuePct: pct });
    }
    i = j;
  }
}

/**
 * Empirical percentile of assessed total among parcels with valid money.
 * Ties share the average rank. Returns 0–100, or NO_VALUE_PCT when unranked.
 * @deprecated Prefer computeCalaisValuePerAcrePercentiles for map fill.
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

/**
 * Within-cohort percentiles of assessed total per GIS acre.
 * Tax-exempt parcels are excluded from ranking and flagged.
 */
export function computeCalaisValuePerAcrePercentiles(
  parcels: ParcelValuePerAcreInput[],
): Map<string, ParcelValuationAttrs> {
  const result = new Map<string, ParcelValuationAttrs>();

  const improved: Array<{ id: string; value: number }> = [];
  const unimproved: Array<{ id: string; value: number }> = [];

  for (const parcel of parcels) {
    const fullyExempt = isMapTaxExempt(parcel);
    const homestead = isHomesteadExemption(
      parcel.assessedExemptionValue,
      parcel.attrsRaw,
    );
    const cohort = classifyBuildingCohort(parcel.assessedBuildingValue);
    const vpa = fullyExempt
      ? null
      : valuePerAcre(parcel.assessedTotalValue, parcel.gisAcreage);

    result.set(parcel.id, {
      valuePct: NO_VALUE_PCT,
      valuePerAcre: vpa,
      cohort,
      fullyExempt,
      homestead,
    });

    if (fullyExempt) continue;
    if (vpa == null) continue;
    if (cohort === COHORT_IMPROVED) {
      improved.push({ id: parcel.id, value: vpa });
    } else if (cohort === COHORT_UNIMPROVED) {
      unimproved.push({ id: parcel.id, value: vpa });
    }
  }

  assignEmpiricalPercentiles(improved, result);
  assignEmpiricalPercentiles(unimproved, result);

  return result;
}

export function valuePctOrMissing(valuePct: number | null | undefined): number {
  if (valuePct == null || Number.isNaN(valuePct)) return NO_VALUE_PCT;
  if (valuePct < 0) return NO_VALUE_PCT;
  return Math.max(0, Math.min(100, Math.round(valuePct)));
}

export function cohortOrMissing(cohort: number | null | undefined): ParcelCohort {
  if (cohort === COHORT_UNIMPROVED || cohort === COHORT_IMPROVED) return cohort;
  return COHORT_NONE;
}

export function flagOrMissing(value: boolean | number | null | undefined): 0 | 1 {
  if (value === true || value === 1) return 1;
  return 0;
}

/** Coerce tile props that may arrive as strings from vector tiles. */
function propNumber(key: string, fallback: number): ExpressionSpecification {
  return [
    "to-number",
    ["coalesce", ["get", key], fallback],
  ] as unknown as ExpressionSpecification;
}

export function parcelValuationFillExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", propNumber("fullyExempt", 0), 1],
    PARCEL_VALUATION_COLORS.exempt.fill,
    ["==", propNumber("valuePct", NO_VALUE_PCT), NO_VALUE_PCT],
    PARCEL_VALUATION_COLORS.none.fill,
    [
      "interpolate",
      ["linear"],
      propNumber("valuePct", NO_VALUE_PCT),
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
    ["==", propNumber("fullyExempt", 0), 1],
    PARCEL_VALUATION_COLORS.exempt.line,
    ["==", propNumber("valuePct", NO_VALUE_PCT), NO_VALUE_PCT],
    PARCEL_VALUATION_COLORS.none.line,
    [
      "interpolate",
      ["linear"],
      propNumber("valuePct", NO_VALUE_PCT),
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

/** MapLibre filter for cohort visibility toggle. Exempt + unranked always stay. */
export function cohortVisibilityFilter(
  mode: "both" | "improved" | "unimproved",
): FilterSpecification | null {
  if (mode === "both") return null;
  const cohort =
    mode === "improved" ? COHORT_IMPROVED : COHORT_UNIMPROVED;
  return [
    "any",
    ["==", propNumber("fullyExempt", 0), 1],
    ["==", propNumber("cohort", COHORT_NONE), COHORT_NONE],
    ["==", propNumber("cohort", COHORT_NONE), cohort],
  ] as unknown as FilterSpecification;
}

export function homesteadVisibilityFilter(
  mode: "both" | "improved" | "unimproved",
): FilterSpecification {
  const cohortPart = cohortVisibilityFilter(mode);
  const homesteadOnly = [
    "==",
    propNumber("homestead", 0),
    1,
  ] as unknown as FilterSpecification;
  if (!cohortPart) return homesteadOnly;
  return ["all", homesteadOnly, cohortPart] as unknown as FilterSpecification;
}
