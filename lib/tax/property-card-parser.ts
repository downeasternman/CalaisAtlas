/**
 * Parse Vision/Trio-style Calais property card PDF text (2023 cards).
 * Owner + map-lot only — assessments are ignored by design (backup source).
 */
import { normalizeMapBkLot } from "./map-lot-normalize";
import { sanitizeOwnerName } from "./owner-normalize";
import { isValidOwnerName } from "./owner-validate";

export interface ParsedPropertyCard {
  accountNumber: string | null;
  mapLot: string | null;
  mapLotRaw: string | null;
  ownerName: string | null;
  asOfDate: string | null;
  sourceFile: string | null;
}

const HEADER_RE =
  /Map\s+Lot\s+([^\t\r\n]+?)\s+Account\s+(\d{1,4})\b(?:.*?(\d{1,2}\/\d{1,2}\/\d{2,4}))?/i;

const STOP_OWNER_RE =
  /^(Previous Owner|Inspection Witnessed By|Notes:|Property Data|Sale Data|X\s+Date)/i;

const MAIL_RE = /\b[A-Z][A-Z\s.]+\s+ME\s+\d{5}\b/i;
const DEED_RE = /^B\d+P\d+/i;

function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function accountFromFilename(sourceFile: string | null | undefined): string | null {
  if (!sourceFile) return null;
  const m = sourceFile.match(/#(\d{1,4})\.pdf$/i) ?? sourceFile.match(/(?:^|[\\/])(\d{1,4})\.pdf$/i);
  return m?.[1] ?? null;
}

/**
 * Collect owner lines immediately after the Map Lot / Account header.
 */
export function extractPropertyCardOwner(lines: string[], headerIndex: number): string | null {
  const owners: string[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      if (owners.length > 0) break;
      continue;
    }
    if (STOP_OWNER_RE.test(line)) break;
    if (MAIL_RE.test(line)) break;
    if (DEED_RE.test(line)) break;
    if (/^Sale Date/i.test(line)) break;

    const sanitized = sanitizeOwnerName(line);
    if (!sanitized.name || !isValidOwnerName(sanitized.name)) {
      // Co-owner / JT lines sometimes fail alone; keep scanning briefly.
      if (owners.length > 0) break;
      continue;
    }
    owners.push(sanitized.name);
    // Primary owner is enough for backup display; keep first valid line.
    break;
  }
  return owners[0] ?? null;
}

export function parsePropertyCardText(
  text: string,
  options?: { sourceFile?: string | null },
): ParsedPropertyCard | null {
  const sourceFile = options?.sourceFile ?? null;
  const lines = text.split(/\r?\n/);
  let headerIndex = -1;
  let mapLotRaw: string | null = null;
  let accountNumber: string | null = accountFromFilename(sourceFile);
  let asOfDate: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = line.match(HEADER_RE);
    if (!match) continue;
    headerIndex = i;
    mapLotRaw = match[1]!.trim();
    accountNumber = match[2]!.trim();
    asOfDate = toIsoDate(match[3] ?? null);
    break;
  }

  if (headerIndex < 0 || !mapLotRaw) return null;

  const mapLot = normalizeMapBkLot(mapLotRaw);
  const ownerName = extractPropertyCardOwner(lines, headerIndex);
  if (!mapLot || !ownerName) return null;

  return {
    accountNumber,
    mapLot,
    mapLotRaw,
    ownerName,
    asOfDate,
    sourceFile,
  };
}
