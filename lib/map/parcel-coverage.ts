import type { ExpressionSpecification } from "maplibre-gl";
import { hasTaxExemption } from "@/lib/tax/exemption";
import { forestEnrollmentFromAttrs, hasTreeGrowthEnrollment } from "@/lib/tax/tree-growth";
import { isJoinConfident } from "@/lib/tax/confidence";
import { isValidMoney, isValidOwnerName } from "@/lib/tax/owner-validate";

export type ParcelCoverageTier = 0 | 1 | 2;
export type ParcelProgram = 0 | 1 | 2;

export const PARCEL_COVERAGE_COLORS = {
  full: { fill: "#c9a227", line: "#8a7020" },
  fullMuted: { fill: "#a68b2a", line: "#6d5a1a" },
  exempt: { fill: "#f2845c", line: "#d46540" },
  exemptMuted: { fill: "#d97050", line: "#b05838" },
  treeGrowth: { fill: "#4d6b4a", line: "#354a32" },
  treeGrowthMuted: { fill: "#3f563d", line: "#2b3a28" },
  owner: { fill: "#5a9a8c", line: "#3d6b62" },
  ownerMuted: { fill: "#4a8075", line: "#325a52" },
  none: { fill: "#8aa4b0", line: "#4a6a72" },
} as const;

export function classifyParcelCoverageTier(
  ownerName: string | null | undefined,
  assessedTotalValue: string | null | undefined,
): ParcelCoverageTier {
  const hasOwner = isValidOwnerName(ownerName ?? null);
  const hasTax = isValidMoney(assessedTotalValue ?? null);
  if (hasOwner && hasTax) return 2;
  if (hasOwner) return 1;
  return 0;
}

export function classifyParcelProgram(
  hasTreeGrowth: boolean,
  hasExemption: boolean,
): ParcelProgram {
  if (hasTreeGrowth) return 2;
  if (hasExemption) return 1;
  return 0;
}

export function classifyParcelSymbology(input: {
  ownerName?: string | null;
  assessedTotalValue?: string | null;
  assessedExemptionValue?: string | null;
  hasTreeGrowth?: boolean | null;
  attrsRaw?: Record<string, unknown> | null;
  joinConfidence?: number | null;
}): {
  coverageTier: ParcelCoverageTier;
  program: ParcelProgram;
  joinLow: 0 | 1;
} {
  const coverageTier = classifyParcelCoverageTier(
    input.ownerName,
    input.assessedTotalValue,
  );

  const forestEnrollment = forestEnrollmentFromAttrs(input.attrsRaw);
  const hasTreeGrowth =
    input.hasTreeGrowth === true ||
    hasTreeGrowthEnrollment(forestEnrollment, null);

  const hasExemption = hasTaxExemption(
    input.assessedExemptionValue,
    input.attrsRaw,
  );

  const program = classifyParcelProgram(hasTreeGrowth, hasExemption);
  const joinLow =
    coverageTier > 0 && !isJoinConfident(input.joinConfidence ?? null) ? 1 : 0;

  return { coverageTier, program, joinLow };
}

function symbologyFillColor(
  program: ParcelProgram,
  tier: ParcelCoverageTier,
  joinLow: 0 | 1,
): string {
  const muted = joinLow === 1;
  if (program === 2) {
    return muted
      ? PARCEL_COVERAGE_COLORS.treeGrowthMuted.fill
      : PARCEL_COVERAGE_COLORS.treeGrowth.fill;
  }
  if (program === 1) {
    return muted
      ? PARCEL_COVERAGE_COLORS.exemptMuted.fill
      : PARCEL_COVERAGE_COLORS.exempt.fill;
  }
  if (tier === 2) {
    return muted ? PARCEL_COVERAGE_COLORS.fullMuted.fill : PARCEL_COVERAGE_COLORS.full.fill;
  }
  if (tier === 1) {
    return muted ? PARCEL_COVERAGE_COLORS.ownerMuted.fill : PARCEL_COVERAGE_COLORS.owner.fill;
  }
  return PARCEL_COVERAGE_COLORS.none.fill;
}

function symbologyLineColor(
  program: ParcelProgram,
  tier: ParcelCoverageTier,
  joinLow: 0 | 1,
): string {
  const muted = joinLow === 1;
  if (program === 2) {
    return muted
      ? PARCEL_COVERAGE_COLORS.treeGrowthMuted.line
      : PARCEL_COVERAGE_COLORS.treeGrowth.line;
  }
  if (program === 1) {
    return muted
      ? PARCEL_COVERAGE_COLORS.exemptMuted.line
      : PARCEL_COVERAGE_COLORS.exempt.line;
  }
  if (tier === 2) {
    return muted ? PARCEL_COVERAGE_COLORS.fullMuted.line : PARCEL_COVERAGE_COLORS.full.line;
  }
  if (tier === 1) {
    return muted ? PARCEL_COVERAGE_COLORS.ownerMuted.line : PARCEL_COVERAGE_COLORS.owner.line;
  }
  return PARCEL_COVERAGE_COLORS.none.line;
}

export function resolveParcelFillColor(
  program: ParcelProgram,
  tier: ParcelCoverageTier,
  joinLow: 0 | 1,
): string {
  return symbologyFillColor(program, tier, joinLow);
}

export function resolveParcelLineColor(
  program: ParcelProgram,
  tier: ParcelCoverageTier,
  joinLow: 0 | 1,
): string {
  return symbologyLineColor(program, tier, joinLow);
}

function buildInnerBranches(
  colorFor: "fill" | "line",
  joinLow: 0 | 1,
): (string | ExpressionSpecification)[] {
  const pick = colorFor === "fill" ? symbologyFillColor : symbologyLineColor;
  return [
    ["==", ["get", "program"], 2],
    pick(2, 0, joinLow),
    ["==", ["get", "program"], 1],
    pick(1, 0, joinLow),
    ["==", ["get", "coverageTier"], 2],
    pick(0, 2, joinLow),
    ["==", ["get", "coverageTier"], 1],
    pick(0, 1, joinLow),
    pick(0, 0, joinLow),
  ];
}

export function parcelCoverageFillExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "joinLow"], 1],
    ["case", ...buildInnerBranches("fill", 1)],
    ["case", ...buildInnerBranches("fill", 0)],
  ] as unknown as ExpressionSpecification;
}

export function parcelCoverageLineExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "joinLow"], 1],
    ["case", ...buildInnerBranches("line", 1)],
    ["case", ...buildInnerBranches("line", 0)],
  ] as unknown as ExpressionSpecification;
}
