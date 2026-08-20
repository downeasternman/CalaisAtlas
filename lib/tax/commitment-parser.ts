import { isSubtotalLine, preprocessCommitmentText } from "./commitment-preprocess";
import { sanitizeOwnerName } from "./owner-normalize";
import {
  hasPersonOrEntitySignal,
  isValidMoney,
  isValidOwnerName,
} from "./owner-validate";
import { detectHomesteadLabel, normalizeExemptionValue } from "./exemption";
import { normalizeMapBkLot, organizedMapJoinKey } from "./map-lot-normalize";
import {
  isAssessmentConsistent,
  resolveCommitmentBlockOwner,
  type CommitmentLayout,
} from "./owner-resolve";
import {
  hasTreeGrowthEnrollment,
  parseForestEnrollmentFromLines,
  type ForestEnrollment,
} from "./tree-growth";

export interface ParsedCommitmentRow {
  accountNumber: string;
  mapJoinKey: string;
  mapLot: string;
  ownerName: string | null;
  mailAddress: string | null;
  assessedLandValue: string | null;
  assessedBuildingValue: string | null;
  assessedTotalValue: string | null;
  assessedExemptionValue: string | null;
  taxAmount: string | null;
  taxAcreage: string | null;
  hasTreeGrowth: boolean;
  taxYear: number | null;
  parseConfidence: number;
  attrsRaw: Record<string, unknown>;
}

/** Calais 2025 commitment mill rate (for optional consistency check only). */
export const CALAIS_2025_MILL_RATE = 0.0145;

const MAP_LOT_LINE_RE =
  /^\s*((?:\d{2,3}-\d{2,3}(?:-\d{2,3})?(?:-[A-Z][A-Z0-9-]*)?)|(?:\d{2}-\d{2,3}(?:-\d{1,3})?(?:-[A-Z])?)|(?:[RU]\d{1,2}-\d{1,3}(?:-\d{1,3})?(?:-[A-Z])?)|(?:[A-G]-\d{3,4}(?:-[A-Z0-9]+)?)|(?:[A-Z]\d-0[A-Z]\d-[A-Z0-9]+(?:\/[A-Z0-9]+)?)|(?:[A-G]-\d{3,4}(?:-[A-Z0-9]+)?(?:\+\d{2,4}(?:-[A-Z0-9]+)?)*)|(?:\d{2}-\d{2,3}(?:-\d{1,3})?(?:\+\d{1,3})+))\s*$/i;

const CUTLER_HEADER_RE =
  /^(\d{2}-\d{2}-\d{1,3}(?:-[A-Z])?)\s+(\d{2,4})\s+(.+)$/i;

const DEED_REF_RE = /^B\d+/i;
const MONEY_TOKEN_RE = /^[\d,]+(?:\.\d+)?$/;
/** Tax billed always has cents in the Calais commitment book. */
const TAX_AMOUNT_RE = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;

interface AccountBlock {
  accountNumber: string;
  headerLine: string;
  headerRest: string;
  leadingMapLot: string | null;
  ownerRaw: string | null;
  headerLand: string | null;
  headerBuilding: string | null;
  headerExempt: string | null;
  headerAssessment: string | null;
  headerTax: string | null;
  mailLines: string[];
  bodyLines: string[];
}

interface LotValues {
  land: string | null;
  building: string | null;
  exempt: string | null;
  assessment: string | null;
  tax: string | null;
  source: string;
}

function cleanMoney(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").replace(/\s/g, "").trim();
  return cleaned || null;
}

function parseMoneyToken(value: string): string | null {
  const cleaned = cleanMoney(value);
  if (!cleaned || !MONEY_TOKEN_RE.test(value.trim())) return null;
  return cleaned;
}

function isStreetOnly(text: string): boolean {
  const upper = text.toUpperCase();
  const hasStreet =
    /\b(ROAD|RD|ST|STREET|LN|LANE|DRIVE|DR|AVE|COVE|WAY|AVENUE|CIRCLE|COURT|CT|PLACE|TRAIL|BOULEVARD|ROUTE|POINT|APT|APARTMENT|CAMINO|ESPLENDORA)\b/.test(
      upper,
    ) || /^(?:NO\.|N\.|S\.|E\.|W\.|#)\s+/i.test(text);
  const hasPersonOrEntity = hasPersonOrEntitySignal(text);
  return hasStreet && !hasPersonOrEntity;
}

function isValidAccountHeader(
  _accountNumber: string,
  rest: string,
  layout: CommitmentLayout = "by-name",
): boolean {
  const trimmed = rest.trim();
  if (!trimmed || !/^[A-Z0-9]/.test(trimmed)) return false;
  if (isStreetOnly(trimmed) && layout !== "map-lot") return false;
  if (/acres/i.test(trimmed) && !/,/.test(trimmed)) return false;
  if (layout === "map-lot") return true;
  const sanitized = sanitizeOwnerName(trimmed);
  if (sanitized.name) return true;
  if (/\b(LLC|INC|TRUST|ESTATE|HEIRS|BANK)\b/i.test(trimmed) && hasPersonOrEntitySignal(trimmed)) {
    return true;
  }
  return false;
}

function cleanTaxAmount(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").replace(/\s/g, "").trim();
  if (!/^\d+\.\d{2}$/.test(cleaned)) return null;
  return cleaned;
}

function isTaxAmountToken(value: string): boolean {
  return TAX_AMOUNT_RE.test(value.trim());
}

function isAcresOrHomesteadNoteLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^acres\b/i.test(trimmed)) return true;
  if (/\bhomestead\b/i.test(trimmed) && /acres|\d+\.\d+/i.test(trimmed)) return true;
  if (/^\d+\.\d+\s+.*\bhomestead\b/i.test(trimmed)) return true;
  if (/^\d+\.\d+\s+acres\b/i.test(trimmed)) return true;
  return false;
}

function extractTaxAcreageFromLine(line: string): string | null {
  const trimmed = line.trim();
  const labeled = trimmed.match(/\bacres\b[\t :]+([\d.]+)/i);
  if (labeled?.[1]) return labeled[1];
  const leading = trimmed.match(/^([\d.]+)[\t ]+(?:\d+\s+)?homestead/i);
  if (leading?.[1]) return leading[1];
  const leadingAcres = trimmed.match(/^([\d.]+)[\t ]+acres\b/i);
  if (leadingAcres?.[1]) return leadingAcres[1];
  // "0.50 \t19 Homestead.......\tAcres"
  const trailingAcres = trimmed.match(/^([\d.]+)[\t ].*\bacres\b/i);
  if (trailingAcres?.[1]) return trailingAcres[1];
  return null;
}

function extractTaxAmountFromLines(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (isTaxAmountToken(trimmed)) {
      return cleanTaxAmount(trimmed);
    }
    const tokens = trimmed.split(/[\t ]+/).filter(Boolean);
    for (const token of tokens) {
      if (isTaxAmountToken(token)) {
        return cleanTaxAmount(token);
      }
    }
  }
  return null;
}

function extractTaxAcreageFromLines(lines: string[]): string | null {
  for (const line of lines) {
    const acres = extractTaxAcreageFromLine(line);
    if (acres) return acres;
  }
  return null;
}

function filterMailLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (isTaxAmountToken(trimmed)) return false;
    if (isAcresOrHomesteadNoteLine(trimmed)) return false;
    if (isTabValueRow(trimmed)) return false;
    if (DEED_REF_RE.test(trimmed)) return false;
    if (MAP_LOT_LINE_RE.test(trimmed)) return false;
    return true;
  });
}

function millRateCheck(
  assessment: string | null,
  tax: string | null,
  millRate = CALAIS_2025_MILL_RATE,
): { expected: number; delta: number; ok: boolean } | null {
  if (!assessment || !tax) return null;
  const a = Number(assessment);
  const t = Number(tax);
  if (!Number.isFinite(a) || !Number.isFinite(t) || a <= 0) return null;
  const expected = Math.round(a * millRate * 100) / 100;
  const delta = Math.abs(t - expected);
  return { expected, delta, ok: delta <= 1 };
}

function extractOwnerFromHeaderRest(rest: string): string | null {
  const withTax = rest.match(
    /^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/,
  );
  if (withTax) return withTax[1]!.trim() || null;
  const inline = rest.match(/^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/);
  if (inline) return inline[1]!.trim() || null;
  // Land/building/exempt often appear as "NAME 0 0 16,300" or "NAME 325,300 0 494,100".
  const threeMoney = rest.match(/^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/);
  if (threeMoney) return threeMoney[1]!.trim() || null;
  const moneyIdx = rest.search(/\s[\d,]{3,}\s+[\d,]/);
  if (moneyIdx > 0) return rest.slice(0, moneyIdx).trim() || null;
  const singleTrailing = rest.match(/^(.+?)[\t ]+([\d,]{3,})\s*$/);
  if (singleTrailing) return singleTrailing[1]!.trim() || null;
  return rest.trim() || null;
}

function parseHeaderLine(accountNumber: string, rest: string): Omit<AccountBlock, "bodyLines"> {
  const withTax = rest.match(
    /^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\b/,
  );
  const inline = rest.match(/^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\b/);
  const ownerRaw = extractOwnerFromHeaderRest(rest);
  return {
    accountNumber,
    headerLine: `${accountNumber}  ${rest}`,
    headerRest: rest,
    leadingMapLot: null,
    ownerRaw,
    headerLand: withTax
      ? cleanMoney(withTax[2])
      : inline
        ? cleanMoney(inline[2])
        : null,
    headerBuilding: withTax
      ? cleanMoney(withTax[3])
      : inline
        ? cleanMoney(inline[3])
        : null,
    headerExempt: withTax
      ? cleanMoney(withTax[4])
      : inline
        ? cleanMoney(inline[4])
        : null,
    headerAssessment: withTax
      ? cleanMoney(withTax[5])
      : inline
        ? cleanMoney(inline[5])
        : null,
    headerTax: withTax ? cleanTaxAmount(withTax[6]) : null,
    mailLines: [],
  };
}

function isTabValueRow(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^[\d,]+\s+[\d,]+\s+[\d,]+\s+[\d,]+\s+\d{1,3}(?:,\d{3})*\.\d{2}\s*$/.test(trimmed) ||
    /^[\d,]+\s+[\d,]+\s+[\d,]+\s+[\d,]+\s*$/.test(trimmed) ||
    /^[\d,]+\s+[\d,]+\s+[\d,]+\s*$/.test(trimmed)
  );
}

function isMailOrAddressLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (MAP_LOT_LINE_RE.test(trimmed)) return false;
  if (DEED_REF_RE.test(trimmed)) return false;
  if (/^acres\b/i.test(trimmed)) return false;
  if (isAcresOrHomesteadNoteLine(trimmed)) return false;
  if (isTaxAmountToken(trimmed)) return false;
  if (/^(soft|mixed|hard):/i.test(trimmed)) return false;
  if (isSubtotalLine(trimmed)) return false;
  if (/^\d{2,4}[\t ]+[A-Z]/.test(trimmed)) return false;
  if (isTabValueRow(trimmed)) return false;
  if (/^0[\t ]+[\d,]+\s*$/.test(trimmed)) return false;
  return true;
}

function segmentAccountBlocks(text: string, layout: CommitmentLayout = "by-name"): AccountBlock[] {
  const lines = text.split("\n");
  const blocks: AccountBlock[] = [];
  let current: AccountBlock | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cutlerHeaderMatch = trimmed.match(CUTLER_HEADER_RE);
    if (
      cutlerHeaderMatch &&
      isValidAccountHeader(cutlerHeaderMatch[2]!, cutlerHeaderMatch[3]!, layout)
    ) {
      if (current) blocks.push(current);
      current = {
        ...parseHeaderLine(cutlerHeaderMatch[2]!, cutlerHeaderMatch[3]!),
        leadingMapLot: cutlerHeaderMatch[1]!.trim(),
        bodyLines: [],
      };
      continue;
    }

    const landFirstMatch = trimmed.match(
      /^(\d{1,3}(?:,\d{3})+|\d{1,7})[\t ]+(\d{1,4})[\t ]+(.+)$/,
    );
    const landFirstThreeMoney = landFirstMatch?.[3]?.match(
      /^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/,
    );
    const landFirstRestForValidation =
      landFirstThreeMoney?.[1]?.trim() ?? landFirstMatch?.[3] ?? "";
    if (
      landFirstMatch &&
      isValidAccountHeader(landFirstMatch[2]!, landFirstRestForValidation, layout)
    ) {
      const landToken = landFirstMatch[1]!;
      const landHasComma = landToken.includes(",");
      const landNum = Number(landToken.replace(/,/g, ""));
      const landFirstAccountNum = Number(landFirstMatch[2]!);
      // Without a thousands comma, prefer account-first when the first token looks
      // like the account id (Lubec: `1507 193 COUNTY ROAD LLC`), not land
      // (`500 1318 STATE OF MAINE`).
      const accountFirstAlt = trimmed.match(/^(\d{1,4})[\t ]+(.+)$/);
      const preferAccountFirst =
        !landHasComma &&
        Number.isFinite(landNum) &&
        Number.isFinite(landFirstAccountNum) &&
        landToken.replace(/,/g, "").length <= 4 &&
        landNum >= landFirstAccountNum &&
        !!accountFirstAlt &&
        isValidAccountHeader(accountFirstAlt[1]!, accountFirstAlt[2]!, layout);

      if (!preferAccountFirst) {
        if (current) blocks.push(current);
        const parsed = parseHeaderLine(landFirstMatch[2]!, landFirstMatch[3]!);
        const leadingLand = cleanMoney(landFirstMatch[1]!);
        if (landFirstThreeMoney && !parsed.headerAssessment) {
          current = {
            ...parsed,
            ownerRaw: landFirstThreeMoney[1]!.trim(),
            headerLand: leadingLand,
            headerBuilding: cleanMoney(landFirstThreeMoney[2]!),
            headerExempt: cleanMoney(landFirstThreeMoney[3]!),
            headerAssessment: cleanMoney(landFirstThreeMoney[4]!),
            headerTax: parsed.headerTax,
            bodyLines: [],
          };
        } else {
          current = {
            ...parsed,
            headerLand: parsed.headerLand ?? leadingLand,
            bodyLines: [],
          };
        }
        continue;
      }
    }

    const headerMatch = trimmed.match(/^(\d{1,4})[\t ]+(.+)$/);
    if (headerMatch && isValidAccountHeader(headerMatch[1]!, headerMatch[2]!, layout)) {
      if (current) blocks.push(current);
      current = {
        ...parseHeaderLine(headerMatch[1]!, headerMatch[2]!),
        bodyLines: [],
      };
      continue;
    }

    if (!current) continue;

    if (MAP_LOT_LINE_RE.test(trimmed)) {
      current.bodyLines.push(trimmed);
      continue;
    }

    const hasMapLotInBlock = current.bodyLines.some((l) => MAP_LOT_LINE_RE.test(l));
    if (!hasMapLotInBlock && isMailOrAddressLine(trimmed)) {
      current.mailLines.push(trimmed);
    } else {
      current.bodyLines.push(trimmed);
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function expandCompoundMapLots(raw: string): string[] {
  const cleaned = raw.trim().replace(/\++$/g, "");
  if (!cleaned.includes("+")) return [cleaned];

  const parts = cleaned.split("+").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [cleaned];

  const first = parts[0]!;
  const mapPrefix = first.includes("-")
    ? first.slice(0, first.indexOf("-") + 1)
    : "";

  const expanded: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (i === 0 || part.includes("-") || /^[A-G]/i.test(part)) {
      expanded.push(part);
      continue;
    }
    // Bare lot continuation: 09-010+13 → 09-013; G-0211-9+10 → G-0211-10
    if (mapPrefix && /^\d+[A-Z]?$/i.test(part)) {
      if (/^[A-G]-\d+/i.test(first)) {
        const base = first.match(/^([A-G]-\d{3,4})(?:-.*)?$/i);
        expanded.push(base ? `${base[1]}-${part}` : `${mapPrefix}${part}`);
      } else {
        const map = first.split("-")[0];
        expanded.push(`${map}-${part}`);
      }
      continue;
    }
    expanded.push(part);
  }
  return expanded.length > 0 ? expanded : [cleaned];
}

function findMapLotsInBlock(block: AccountBlock): Array<{ raw: string; normalized: string; index: number }> {
  const lots: Array<{ raw: string; normalized: string; index: number }> = [];
  const pushLot = (raw: string, index: number) => {
    for (const piece of expandCompoundMapLots(raw)) {
      const normalized = normalizeMapBkLot(piece);
      if (!normalized) continue;
      lots.push({ raw: piece, normalized, index });
    }
  };

  if (block.leadingMapLot) {
    pushLot(block.leadingMapLot, -1);
  }
  for (let i = 0; i < block.bodyLines.length; i++) {
    const line = block.bodyLines[i]!;
    const match = line.match(MAP_LOT_LINE_RE);
    if (!match?.[1]) continue;
    pushLot(match[1], i);
  }
  return lots;
}

/**
 * Calais commitment pages usually bind one Acres line to the next map-lot line.
 * Prefer those pairs so foreign lots swallowed by a bad block do not inherit values.
 */
function selectMapLotsForBlock(
  block: AccountBlock,
  lots: Array<{ raw: string; normalized: string; index: number }>,
): Array<{ raw: string; normalized: string; index: number }> {
  if (lots.length <= 1) return lots;

  const acresBound: Array<{ raw: string; normalized: string; index: number }> = [];
  for (let i = 0; i < block.bodyLines.length; i++) {
    const line = block.bodyLines[i]!;
    if (!/\bacres\b/i.test(line) && !extractTaxAcreageFromLine(line)) continue;
    for (let j = i + 1; j < block.bodyLines.length; j++) {
      const next = block.bodyLines[j]!;
      if (!MAP_LOT_LINE_RE.test(next)) {
        if (/^\d{1,4}[\t ]+[A-Z]/.test(next.trim())) break;
        continue;
      }
      const match = next.match(MAP_LOT_LINE_RE);
      if (!match?.[1]) break;
      for (const piece of expandCompoundMapLots(match[1])) {
        const normalized = normalizeMapBkLot(piece);
        if (!normalized) continue;
        acresBound.push({ raw: piece, normalized, index: j });
      }
      break;
    }
  }

  if (acresBound.length > 0) {
    const seen = new Set<string>();
    return acresBound.filter((lot) => {
      if (seen.has(lot.normalized)) return false;
      seen.add(lot.normalized);
      return true;
    });
  }

  // No Acres binding: if lots span different map sheets, keep only the first lot.
  const sheets = new Set(
    lots.map((lot) => lot.normalized.split("-")[0] ?? lot.normalized),
  );
  if (sheets.size > 1) return lots.slice(0, 1);

  return lots;
}

function isLikelyZipAssessment(value: string | null): boolean {
  if (!value) return false;
  // Maine mail zips scraped by columnar fallback (e.g. AUGUSTA ME 04333).
  return /^0\d{4}$/.test(value);
}

function extractTabValueRow(lines: string[], headerLand?: string | null): LotValues | null {
  for (const line of lines) {
    const trimmed = line.trim();
    const five = trimmed.match(
      /^([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/,
    );
    if (five) {
      const land = cleanMoney(five[1]);
      const building = cleanMoney(five[2]);
      const exempt = cleanMoney(five[3]);
      const assessment = cleanMoney(five[4]);
      const tax = cleanTaxAmount(five[5]);
      if (isValidMoney(land) || isValidMoney(building) || isValidMoney(assessment)) {
        return { land, building, exempt, assessment, tax, source: "tab_row_with_tax" };
      }
    }
    const four = trimmed.match(/^([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/);
    if (four) {
      const land = cleanMoney(four[1]);
      const building = cleanMoney(four[2]);
      const exempt = cleanMoney(four[3]);
      const assessment = cleanMoney(four[4]);
      if (isValidMoney(land) || isValidMoney(building) || isValidMoney(assessment)) {
        return { land, building, exempt, assessment, tax: null, source: "tab_row" };
      }
    }
    // Land already on header; body has building / exempt / assessment [/ tax].
    if (headerLand) {
      const threePlusTax = trimmed.match(
        /^([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/,
      );
      if (threePlusTax) {
        const building = cleanMoney(threePlusTax[1]);
        const exempt = cleanMoney(threePlusTax[2]);
        const assessment = cleanMoney(threePlusTax[3]);
        const tax = cleanTaxAmount(threePlusTax[4]);
        if (isValidMoney(assessment) || isValidMoney(building)) {
          return {
            land: headerLand,
            building,
            exempt,
            assessment,
            tax,
            source: "tab_row_land_first_tax",
          };
        }
      }
      const three = trimmed.match(/^([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/);
      if (three) {
        const building = cleanMoney(three[1]);
        const exempt = cleanMoney(three[2]);
        const assessment = cleanMoney(three[3]);
        if (isValidMoney(assessment) || isValidMoney(building)) {
          return {
            land: headerLand,
            building,
            exempt,
            assessment,
            tax: null,
            source: "tab_row_land_first",
          };
        }
      }
    }
  }
  return null;
}

function extractColumnarValues(lines: string[]): LotValues | null {
  for (const line of lines) {
    const trimmed = line.trim();
    const assessmentOnly = trimmed.match(/^0[\t ]+([\d,]+)\s*$/);
    if (assessmentOnly) {
      const assessment = cleanMoney(assessmentOnly[1]);
      if (isValidMoney(assessment)) {
        return {
          land: null,
          building: null,
          exempt: "0",
          assessment,
          tax: null,
          source: "assessment_only",
        };
      }
    }
  }

  const moneyLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || isSubtotalLine(trimmed)) continue;
    if (/^(soft|mixed|hard|acres):/i.test(trimmed)) continue;
    if (DEED_REF_RE.test(trimmed)) continue;
    if (isTaxAmountToken(trimmed)) continue;

    const tokens = trimmed.split(/[\t ]+/).filter(Boolean);
    for (const token of tokens) {
      if (isTaxAmountToken(token)) continue;
      const money = parseMoneyToken(token);
      if (money && isValidMoney(money)) moneyLines.push(money);
    }

    if (/^[\d,]+$/.test(trimmed)) {
      const money = cleanMoney(trimmed);
      if (money && isValidMoney(money)) moneyLines.push(money);
    }
  }

  if (moneyLines.length === 0) return null;

  const uniqueLarge = [...new Set(moneyLines.filter((m) => Number(m) >= 1000))];
  if (uniqueLarge.length >= 2) {
    const land = uniqueLarge[0] ?? null;
    const building = uniqueLarge[1] ?? null;
    const assessment =
      uniqueLarge[2] ??
      (land && building ? String(Number(land) + Number(building)) : uniqueLarge[0] ?? null);
    if (isLikelyZipAssessment(assessment)) return null;
    return { land, building, exempt: "0", assessment, tax: null, source: "columnar" };
  }

  if (uniqueLarge.length === 1) {
    if (isLikelyZipAssessment(uniqueLarge[0]!)) return null;
    return {
      land: uniqueLarge[0],
      building: "0",
      exempt: "0",
      assessment: uniqueLarge[0],
      tax: null,
      source: "columnar_single",
    };
  }

  return null;
}

function getLotSpanLines(block: AccountBlock, lotIndex: number): string[] {
  const start = lotIndex;
  const nextLotIdx = block.bodyLines.findIndex(
    (line, idx) => idx > start && MAP_LOT_LINE_RE.test(line),
  );
  return block.bodyLines.slice(start + 1, nextLotIdx >= 0 ? nextLotIdx : undefined);
}

function getLotContextLines(block: AccountBlock, lotIndex: number): string[] {
  if (lotIndex < 0) {
    return getLotSpanLines(block, lotIndex);
  }

  let previousLotIndex = -1;
  for (let i = lotIndex - 1; i >= 0; i--) {
    if (MAP_LOT_LINE_RE.test(block.bodyLines[i]!)) {
      previousLotIndex = i;
      break;
    }
  }

  const before = block.bodyLines.slice(previousLotIndex + 1, lotIndex);
  return [...before, ...getLotSpanLines(block, lotIndex)];
}

function extractLotValues(
  block: AccountBlock,
  lotIndex: number,
  lotCount: number,
  headerExtractedLand: string | null,
): LotValues | null {
  const span = getLotSpanLines(block, lotIndex);

  if (lotCount === 1 && block.headerAssessment && isValidMoney(block.headerAssessment)) {
    return {
      land: block.headerLand,
      building: block.headerBuilding,
      exempt: block.headerExempt,
      assessment: block.headerAssessment,
      tax: block.headerTax,
      source: "header_inline",
    };
  }

  const tab = extractTabValueRow(span, block.headerLand);
  if (tab) return tab;

  const preLotSpan =
    lotIndex >= 0 ? block.bodyLines.slice(0, lotIndex) : block.bodyLines.slice(0, -1);
  const preTab = extractTabValueRow(preLotSpan, block.headerLand);
  if (preTab) return preTab;

  // Never columnar-scrape when the account header already has an assessment.
  if (!(block.headerAssessment && isValidMoney(block.headerAssessment))) {
    const columnar = extractColumnarValues(span);
    if (columnar) return columnar;
  }

  if (headerExtractedLand && isValidMoney(headerExtractedLand)) {
    return {
      land: headerExtractedLand,
      building: "0",
      exempt: "0",
      assessment: headerExtractedLand,
      tax: null,
      source: "header_land_tail",
    };
  }

  return null;
}

function resolveBlockOwner(block: AccountBlock, layout: CommitmentLayout) {
  return resolveCommitmentBlockOwner(block, layout);
}

function scoreRow(
  ownerName: string | null,
  assessment: string | null,
  mapLot: string,
  land: string | null,
  building: string | null,
  ownerSource: string | null,
  layout: CommitmentLayout,
): number {
  if (!mapLot) return 0.1;
  if (!ownerName && !assessment) return 0.2;
  if (!ownerName || !isValidMoney(assessment)) return 0.3;

  let confidence = 0.9;
  if (layout === "map-lot" && ownerSource === "header") confidence = 0.5;
  if (layout === "map-lot" && ownerSource === "mail-line") confidence = 0.85;
  if (layout === "map-lot" && ownerSource === "entity-line") confidence = 0.88;
  if (!isAssessmentConsistent(land, building, assessment)) confidence -= 0.15;
  return Math.max(0.2, confidence);
}

export interface ParseCommitmentOptions {
  layout?: CommitmentLayout;
}

/**
 * Parse MRS-style town Real Estate Tax Commitment Book text (forward account-block parser).
 */
export function parseCommitmentText(
  text: string,
  geocode: string,
  taxYear: number | null,
  options: ParseCommitmentOptions = {},
): ParsedCommitmentRow[] {
  const layout = options.layout ?? "by-name";
  const cleaned = preprocessCommitmentText(text);
  const blocks = segmentAccountBlocks(cleaned, layout);
  const rowByKey = new Map<string, ParsedCommitmentRow>();

  for (const block of blocks) {
    const resolvedOwner = resolveBlockOwner(block, layout);
    const ownerName = resolvedOwner.ownerName;
    const allLines = [
      block.headerLine,
      ...block.mailLines,
      ...block.bodyLines,
    ];
    const cleanedMail = filterMailLines(block.mailLines);
    const mailAddress = cleanedMail.length > 0 ? cleanedMail.join(", ") : null;
    const blockTax =
      block.headerTax ?? extractTaxAmountFromLines(allLines);
    const blockAcres = extractTaxAcreageFromLines(allLines);
    const lots = selectMapLotsForBlock(block, findMapLotsInBlock(block));
    if (lots.length === 0) continue;

    for (const lot of lots) {
      const mapJoinKey = organizedMapJoinKey(geocode, lot.normalized);
      if (!mapJoinKey) continue;

      const values = extractLotValues(
        block,
        lot.index,
        lots.length,
        resolvedOwner.extractedLand,
      );
      let assessedLandValue = values?.land ?? null;
      let assessedBuildingValue = values?.building ?? null;
      let assessedTotalValue = values?.assessment ?? null;
      if (isLikelyZipAssessment(assessedTotalValue)) {
        assessedTotalValue = null;
        assessedLandValue = null;
        assessedBuildingValue = null;
      }
      const assessedExemptionValue = normalizeExemptionValue(values?.exempt ?? null);
      const lotSpanLines = getLotContextLines(block, lot.index);
      const taxAmount =
        values?.tax ??
        extractTaxAmountFromLines(lotSpanLines) ??
        blockTax;
      const taxAcreage =
        extractTaxAcreageFromLines(lotSpanLines) ?? blockAcres;
      const forestEnrollment: ForestEnrollment =
        parseForestEnrollmentFromLines(lotSpanLines);
      const lotSpanText = lotSpanLines.join("\n");
      const hasTreeGrowth = hasTreeGrowthEnrollment(forestEnrollment, lotSpanText);
      const homesteadLabel = detectHomesteadLabel([
        ...lotSpanLines,
        ...block.mailLines,
        ...block.bodyLines,
      ]);
      const valueSource = values?.source ?? null;
      const taxMillCheck = millRateCheck(assessedTotalValue, taxAmount);
      const parseConfidence = scoreRow(
        ownerName,
        assessedTotalValue,
        lot.normalized,
        assessedLandValue,
        assessedBuildingValue,
        resolvedOwner.ownerSource,
        layout,
      );

      const row: ParsedCommitmentRow = {
        accountNumber: block.accountNumber,
        mapJoinKey,
        mapLot: lot.normalized,
        ownerName,
        mailAddress,
        assessedLandValue,
        assessedBuildingValue,
        assessedTotalValue,
        assessedExemptionValue,
        taxAmount,
        taxAcreage,
        hasTreeGrowth,
        taxYear,
        parseConfidence,
        attrsRaw: {
          mapLotRaw: lot.raw,
          accountLine: block.headerLine,
          valueSource,
          mailLines: cleanedMail,
          forestEnrollment,
          homesteadLabel,
          ownerSource: resolvedOwner.ownerSource,
          situsLabel: resolvedOwner.situsLabel,
          taxMillCheck,
        },
      };

      const existing = rowByKey.get(mapJoinKey);
      if (!existing || row.parseConfidence > existing.parseConfidence) {
        rowByKey.set(mapJoinKey, row);
      }
    }
  }

  return [...rowByKey.values()];
}
