const PAGE_CHROME_RE =
  /^.*(Real Estate Tax Commitment Book|COMMITMENT|Account Name & Address|--\s*\d+\s+of\s+\d+\s+--).*$/gim;

const COLUMN_HEADER_RE =
  /^Account Name & Address\s+Land\s+Building\s+Exemption\s+Assessment\s*$/gim;

const PAGE_NUMBER_RE = /^\d+\s+Page\s*$/gim;
const PAGE_TOTALS_RE = /^[\d,]+\s+Page Totals:/gim;
const SUBTOTALS_RE = /^Subtotals:/gim;
const TAX_RATE_LINE_RE = /^2025 TAX RATE/gim;
const LAND_BUILDING_HEADER_RE = /^Land\s+Building\s+Exempt\s+Total\s+Tax\s*$/gim;

/**
 * Normalize commitment-book PDF text before parsing.
 */
export function preprocessCommitmentText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(PAGE_CHROME_RE, "")
    .replace(COLUMN_HEADER_RE, "")
    .replace(PAGE_NUMBER_RE, "")
    .replace(PAGE_TOTALS_RE, "")
    .replace(SUBTOTALS_RE, "")
    .replace(TAX_RATE_LINE_RE, "")
    .replace(LAND_BUILDING_HEADER_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isCommitmentPageNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\d+\s+Page\s*$/i.test(trimmed)) return true;
  if (/Page Totals:/i.test(trimmed)) return true;
  if (/^Subtotals:/i.test(trimmed)) return true;
  if (/^2025 TAX RATE/i.test(trimmed)) return true;
  if (/^Land\s+Building\s+Exempt\s+Total\s+Tax\s*$/i.test(trimmed)) return true;
  return isSubtotalLine(trimmed);
}

export function isSubtotalLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^(Land|Building|Exempt|Total|Tax|Subtotals?|Page Totals?)$/i.test(trimmed)) {
    return true;
  }
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) return true;
  if (/^Lubec$/i.test(trimmed)) return true;
  if (/^Eastport$/i.test(trimmed)) return true;
  if (/^\d+\s+of\s+\d+$/i.test(trimmed)) return true;
  return false;
}
