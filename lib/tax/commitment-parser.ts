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
  hasTreeGrowth: boolean;
  taxYear: number | null;
  parseConfidence: number;
  attrsRaw: Record<string, unknown>;
}

const MAP_LOT_LINE_RE =
  /^\s*((?:\d{2,3}-\d{2,3}(?:-\d{2,3})?(?:-[A-Z][A-Z0-9-]*)?)|(?:\d{2}-\d{2,3}(?:-\d{1,3})?(?:-[A-Z])?)|(?:[RU]\d{1,2}-\d{1,3}(?:-\d{1,3})?(?:-[A-Z])?)|(?:[A-G]-\d{3,4}(?:-[A-Z0-9]+)?)|(?:[A-Z]\d-0[A-Z]\d-[A-Z0-9]+(?:\/[A-Z0-9]+)?)|(?:[A-G]-\d{3,4}(?:-[A-Z0-9]+)?(?:\+\d{2,4}(?:-[A-Z0-9]+)?)*)|(?:\d{2}-\d{2,3}(?:-\d{1,3})?(?:\+\d{1,3})+))\s*$/i;

const CUTLER_HEADER_RE =
  /^(\d{2}-\d{2}-\d{1,3}(?:-[A-Z])?)\s+(\d{2,4})\s+(.+)$/i;

const DEED_REF_RE = /^B\d+/i;
const MONEY_TOKEN_RE = /^[\d,]+(?:\.\d+)?$/;

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
  mailLines: string[];
  bodyLines: string[];
}

interface LotValues {
  land: string | null;
  building: string | null;
  exempt: string | null;
  assessment: string | null;
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

function extractOwnerFromHeaderRest(rest: string): string | null {
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
  const inline = rest.match(/^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\b/);
  const ownerRaw = extractOwnerFromHeaderRest(rest);
  return {
    accountNumber,
    headerLine: `${accountNumber}  ${rest}`,
    headerRest: rest,
    leadingMapLot: null,
    ownerRaw,
    headerLand: inline ? cleanMoney(inline[2]) : null,
    headerBuilding: inline ? cleanMoney(inline[3]) : null,
    headerExempt: inline ? cleanMoney(inline[4]) : null,
    headerAssessment: inline ? cleanMoney(inline[5]) : null,
    mailLines: [],
  };
}

function isTabValueRow(line: string): boolean {
  const trimmed = line.trim();
  return (
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
      /^(\d{1,3}(?:,\d{3})+)[\t ]+(\d{1,4})[\t ]+(.+)$/,
    );
    if (
      landFirstMatch &&
      isValidAccountHeader(landFirstMatch[2]!, landFirstMatch[3]!, layout)
    ) {
      if (current) blocks.push(current);
      const parsed = parseHeaderLine(landFirstMatch[2]!, landFirstMatch[3]!);
      const leadingLand = cleanMoney(landFirstMatch[1]!);
      // Land-first MRS layouts often trail building/exempt/assessment (3 money tokens).
      const threeMoney = landFirstMatch[3]!.match(
        /^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/,
      );
      if (threeMoney && !parsed.headerAssessment) {
        current = {
          ...parsed,
          ownerRaw: threeMoney[1]!.trim(),
          headerLand: leadingLand,
          headerBuilding: cleanMoney(threeMoney[2]!),
          headerExempt: cleanMoney(threeMoney[3]!),
          headerAssessment: cleanMoney(threeMoney[4]!),
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

function extractTabValueRow(lines: string[], headerLand?: string | null): LotValues | null {
  for (const line of lines) {
    const trimmed = line.trim();
    const four = trimmed.match(/^([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/);
    if (four) {
      const land = cleanMoney(four[1]);
      const building = cleanMoney(four[2]);
      const exempt = cleanMoney(four[3]);
      const assessment = cleanMoney(four[4]);
      if (isValidMoney(land) || isValidMoney(building) || isValidMoney(assessment)) {
        return { land, building, exempt, assessment, source: "tab_row" };
      }
    }
    // Land already on header; body has building / exempt / assessment.
    if (headerLand) {
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

    const tokens = trimmed.split(/[\t ]+/).filter(Boolean);
    for (const token of tokens) {
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
    return { land, building, exempt: "0", assessment, source: "columnar" };
  }

  if (uniqueLarge.length === 1) {
    return {
      land: uniqueLarge[0],
      building: "0",
      exempt: "0",
      assessment: uniqueLarge[0],
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
      source: "header_inline",
    };
  }

  const tab = extractTabValueRow(span, block.headerLand);
  if (tab) return tab;

  const preLotSpan =
    lotIndex >= 0 ? block.bodyLines.slice(0, lotIndex) : block.bodyLines.slice(0, -1);
  const preTab = extractTabValueRow(preLotSpan, block.headerLand);
  if (preTab) return preTab;

  const columnar = extractColumnarValues(span);
  if (columnar) return columnar;

  if (headerExtractedLand && isValidMoney(headerExtractedLand)) {
    return {
      land: headerExtractedLand,
      building: "0",
      exempt: "0",
      assessment: headerExtractedLand,
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
    const mailAddress = block.mailLines.length > 0 ? block.mailLines.join(", ") : null;
    const lots = findMapLotsInBlock(block);
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
      const assessedLandValue = values?.land ?? null;
      const assessedBuildingValue = values?.building ?? null;
      const assessedTotalValue = values?.assessment ?? null;
      const assessedExemptionValue = normalizeExemptionValue(values?.exempt ?? null);
      const lotSpanLines = getLotContextLines(block, lot.index);
      const forestEnrollment: ForestEnrollment =
        parseForestEnrollmentFromLines(lotSpanLines);
      const lotSpanText = lotSpanLines.join("\n");
      const hasTreeGrowth = hasTreeGrowthEnrollment(forestEnrollment, lotSpanText);
      const homesteadLabel = detectHomesteadLabel(lotSpanLines);
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
        hasTreeGrowth,
        taxYear,
        parseConfidence,
        attrsRaw: {
          mapLotRaw: lot.raw,
          accountLine: block.headerLine,
          valueSource: values?.source ?? null,
          mailLines: block.mailLines,
          forestEnrollment,
          homesteadLabel,
          ownerSource: resolvedOwner.ownerSource,
          situsLabel: resolvedOwner.situsLabel,
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
