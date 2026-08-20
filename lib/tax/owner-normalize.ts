import { hasPersonOrEntitySignal, isValidMoney, isValidOwnerName } from "./owner-validate";

export interface SanitizedOwner {
  name: string | null;
  extractedLand: string | null;
}

const COLUMNAR_DEBRIS_RE = /\t(?:Soft|Mixed|Hard|Acres)\s*:/i;
/** Trailing Trio zero columns: "NAME 0 0" or "NAME 0 0 16,300". */
const ZERO_COLS_WITH_ASSESSMENT_RE = /^(.+?)\s+0(?:\s+0)+\s+([\d,]{3,})\s*$/;
const TRAILING_ZERO_COLS_RE = /\s+0(?:\s+0)+\s*$/;

function cleanMoneyToken(value: string): string | null {
  const cleaned = value.replace(/,/g, "").trim();
  return cleaned || null;
}

/**
 * Strip PDF column bleed from owner strings and recover trailing land values.
 */
export function sanitizeOwnerName(raw: string | null | undefined): SanitizedOwner {
  if (!raw) return { name: null, extractedLand: null };

  let text = raw.trim().replace(/\s+/g, " ");
  let extractedLand: string | null = null;

  const inlineFour = text.match(/^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/);
  if (inlineFour) {
    text = inlineFour[1]!.trim();
    const land = cleanMoneyToken(inlineFour[2]!);
    if (land && isValidMoney(land)) extractedLand = land;
  }

  const debrisIdx = text.search(COLUMNAR_DEBRIS_RE);
  if (debrisIdx > 0) {
    text = text.slice(0, debrisIdx).trim();
  }

  const tabMoney = text.match(/^(.+?)\t+([\d,]{2,})(?:\s|$)/);
  if (tabMoney) {
    text = tabMoney[1]!.trim();
    const land = cleanMoneyToken(tabMoney[2]!);
    if (land && isValidMoney(land)) extractedLand = land;
  }

  const zeroColsAssessment = text.match(ZERO_COLS_WITH_ASSESSMENT_RE);
  if (zeroColsAssessment) {
    text = zeroColsAssessment[1]!.trim();
    const land = cleanMoneyToken(zeroColsAssessment[2]!);
    if (land && isValidMoney(land)) extractedLand = land;
  }

  const trailingMoney = text.match(/^(.+?)[\t ]+([\d,]{3,})\s*$/);
  if (trailingMoney) {
    text = trailingMoney[1]!.trim();
    const land = cleanMoneyToken(trailingMoney[2]!);
    if (land && isValidMoney(land)) extractedLand = land;
  }

  text = text.replace(/[\t ]+[\d,]{3,}.*$/, "").trim();
  text = text.replace(TRAILING_ZERO_COLS_RE, "").trim();
  text = text.replace(/\s+-\s*$/, "").trim();

  if (!isValidOwnerName(text)) {
    return { name: null, extractedLand };
  }

  return { name: text, extractedLand };
}

export function cleanOwnerForDisplay(name: string | null | undefined): string | null {
  return sanitizeOwnerName(name).name;
}
