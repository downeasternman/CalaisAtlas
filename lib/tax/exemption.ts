const HOMESTEAD_LABEL_RE = /homestead\s+exempt/i;

export function hasTaxExemption(
  assessedExemptionValue: string | null | undefined,
  attrsRaw?: Record<string, unknown> | null,
): boolean {
  if (normalizeExemptionValue(assessedExemptionValue)) return true;

  if (attrsRaw?.homesteadLabel === true) return true;

  return false;
}

export function normalizeExemptionValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (Number.isNaN(amount) || amount <= 0) return null;
  return cleaned;
}

export function detectHomesteadLabel(lines: string[]): boolean {
  return lines.some((line) => HOMESTEAD_LABEL_RE.test(line));
}
