export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

export function scoreToLevel(score: number | null): ConfidenceLevel {
  if (score === null) return "unknown";
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

export function isJoinConfident(score: number | null): boolean {
  return score !== null && score >= 0.6;
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Moderate confidence",
  low: "Low confidence — verify with source",
  unknown: "Confidence unknown",
};
