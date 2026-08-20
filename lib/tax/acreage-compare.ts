export const ACREAGE_ABS_TOLERANCE = 0.5;
export const ACREAGE_REL_TOLERANCE = 0.1;

function parseAcres(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Flag GIS vs tax-book acreage disagreement.
 * Absolute floor 0.5 ac or 10% of tax-book acres, whichever is larger.
 */
export function hasAcreageDiscrepancy(
  gisAcreage: string | null | undefined,
  taxAcreage: string | null | undefined,
): boolean {
  const gis = parseAcres(gisAcreage);
  const tax = parseAcres(taxAcreage);
  if (gis == null || tax == null) return false;
  const abs = Math.abs(gis - tax);
  const threshold = Math.max(ACREAGE_ABS_TOLERANCE, Math.abs(tax) * ACREAGE_REL_TOLERANCE);
  return abs > threshold;
}
