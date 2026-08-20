/**
 * Parse Robbinston RETTD transfer PDFs (2024/08 archive + 24-25).
 */
import { sanitizeOwnerName } from "./owner-normalize";
import { isValidOwnerName } from "./owner-validate";
import {
  buildRobbinstonMapLot,
  robbinstonMapJoinKeys,
} from "./robbinston-map-lot";

export interface RobbinstonTransferRow {
  ownerName: string;
  grantorName: string | null;
  map: string;
  lot: string;
  mapLot: string;
  mapJoinKey: string;
  transferDate: string; // ISO date YYYY-MM-DD
  source: "transfer";
  sourceLabel: string;
}

function cleanOwner(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/\bPR\b/g, "")
    .replace(/\bTRUSTEE\b/gi, "")
    .trim();
  // Keep display name; validate with middle initials removed (OCR often has "J")
  const forValidation = cleaned
    .split(/\s+/)
    .filter((t) => t.length > 1 || /,/.test(cleaned))
    .join(" ");
  const sanitized = sanitizeOwnerName(forValidation || cleaned);
  if (!sanitized.name || !isValidOwnerName(sanitized.name)) {
    // Fallback: comma names are usually people even with short tokens
    if (/,/.test(cleaned) && cleaned.length >= 6 && /[A-Za-z]/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }
  return cleaned;
}

function parseTransferDate(raw: string): string | null {
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slash) {
    const mm = slash[1]!.padStart(2, "0");
    const dd = slash[2]!.padStart(2, "0");
    return `${slash[3]}-${mm}-${dd}`;
  }
  return null;
}

function extractMapLot(block: string): { map: string; lot: string } | null {
  // Real pdf-parse layout:
  // 5. PROPERTY Tax Map\n10\n...\nLot\n77\nSub-lot\n0
  const stacked = block.match(
    /Tax Map\s*\n\s*(\d{1,3}[A-Za-z]?)\s*[\s\S]{0,400}?\nLot\s*\n\s*(\d{1,4}(?:-\d{1,3})?[A-Za-z]?)\s*(?:\nSub-lot\s*\n\s*([A-Za-z0-9]+))?/i,
  );
  if (stacked) {
    const map = stacked[1]!.toUpperCase();
    const lot =
      stacked[3] && stacked[3] !== "0"
        ? `${stacked[2]}${stacked[3]}`.toUpperCase()
        : stacked[2]!.toUpperCase();
    return { map, lot };
  }

  // Inline: Tax Map\n9\n...\nBlock\tLot\n99-2  or  Block  Lot | 14
  const blockLot = block.match(
    /Tax Map\s*\n?\s*(\d{1,3}[A-Za-z]?)\s*[\s\S]{0,200}?Block\s+Lot\s*\n?\s*([0-9]{1,4}(?:-[0-9]{1,3})?[A-Za-z]?)/i,
  );
  if (blockLot) {
    return { map: blockLot[1]!.toUpperCase(), lot: blockLot[2]!.toUpperCase() };
  }

  // Inline OCR / markdown conversions
  const exist = block.match(
    /Tax maps exist\s+(\d{1,3}[A-Za-z]?)\s+\d+\s+(\d{1,4}[A-Za-z]?)\s+\d+/i,
  );
  if (exist) return { map: exist[1]!.toUpperCase(), lot: exist[2]!.toUpperCase() };

  const labeled = block.match(
    /Tax Map\s+(\d{1,3}[A-Za-z]?)\s+Block\s+\d*\s*Lot\s+(\d{1,4}(?:-\d{1,3})?[A-Za-z]?)/i,
  );
  if (labeled) return { map: labeled[1]!.toUpperCase(), lot: labeled[2]!.toUpperCase() };

  const compact = block.match(
    /Tax Map\s+(\d{1,3}[A-Za-z]?)\s+Block\s+Lot\s+(\d{1,4}(?:-\d{1,3})?[A-Za-z]?)/i,
  );
  if (compact) return { map: compact[1]!.toUpperCase(), lot: compact[2]!.toUpperCase() };

  const sublot = block.match(
    /Tax Map\s+(\d{1,3}[A-Za-z]?)\s+Block\s+Lot\s+(\d{1,4})\s+Sub-lot\s+([A-Za-z0-9]+)/i,
  );
  if (sublot) {
    return {
      map: sublot[1]!.toUpperCase(),
      lot: `${sublot[2]}${sublot[3]}`.toUpperCase(),
    };
  }

  // Broken OCR: "T M\nax ap\n9" — rare; skip if map missing
  const older = block.match(
    /5a\.\s*Map[\s\S]{0,200}?\*\*(\d{1,3}[A-Za-z]?)\*\*[\s\S]{0,200}?Lot[\s\S]{0,80}?\*\*(\d{1,4}[A-Za-z]?)\*\*/i,
  );
  if (older) return { map: older[1]!.toUpperCase(), lot: older[2]!.toUpperCase() };

  return null;
}

function extractGrantees(block: string): string[] {
  const names: string[] = [];

  // OCR often mangles GRANTEE → GRANTE8 / GRANTEB
  const stacked = block.match(
    /3\.?\s*GRANTE[E8B]?\/?PURCHASER[\s\S]{0,160}?business name\s*\n\s*([A-Z][A-Z0-9 ,./&\-']{2,80})\s*\n/i,
  );
  if (stacked?.[1] && !/MAINE REAL ESTATE|TRANSFER TAX/i.test(stacked[1])) {
    names.push(stacked[1].trim());
  }

  const inline = block.match(
    /GRANTE[E8B]?\/?PURCHASER[^\n]*business name\s+([A-Z][A-Z0-9 ,./&\-']{3,80})/i,
  );
  if (inline?.[1] && !/MAINE REAL ESTATE|TRANSFER TAX/i.test(inline[1])) {
    names.push(inline[1].trim());
  }

  const olderSection = block.match(
    /3\.?\s*GRANTE[E8B]?\/?PURCHASER([\s\S]*?)4\.\s*GRANTOR\/SELLER/i,
  );
  if (olderSection) {
    const boldNames = [...olderSection[1]!.matchAll(/\*\*([^*]{3,80})\*\*/g)]
      .map((m) => m[1]!.trim())
      .filter(
        (n) =>
          !/^(FEDERAL ID|MAILING|MUNICIPALITY|STATE|ZIP|CHELSEA|ROBBINSTON|ME \d|MAINE REAL)/i.test(
            n,
          ) && /[A-Za-z]/.test(n),
      );
    for (const n of boldNames) {
      if (/^[A-Z]/.test(n) && n.length >= 4) names.push(n);
    }
  }

  return [...new Set(names)];
}

function extractGrantor(block: string): string | null {
  const stacked = block.match(
    /4\.\s*GRANTOR\/SELLER[\s\S]{0,120}?business name\s*\n\s*([A-Z][A-Z0-9 ,./&\-']{2,80})\s*\n/i,
  );
  if (stacked?.[1] && !/MAINE REAL ESTATE|TRANSFER TAX/i.test(stacked[1])) {
    return cleanOwner(stacked[1]);
  }

  const inline = block.match(
    /GRANTOR\/SELLER[^\n]*business name\s+([A-Z][A-Z0-9 ,./&\-']{3,80})/i,
  );
  if (inline?.[1] && !/MAINE REAL ESTATE|TRANSFER TAX/i.test(inline[1])) {
    return cleanOwner(inline[1]);
  }
  return null;
}

function extractDate(block: string): string | null {
  const afterLabel = block.match(
    /DATE OF TRANSFER[^\n]*\n\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  );
  if (afterLabel?.[1]) return parseTransferDate(afterLabel[1]);

  const transfer = block.match(
    /DATE OF TRANSFER[^\d]{0,80}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/i,
  );
  if (transfer?.[1]) return parseTransferDate(transfer[1]);

  // OCR often uses Date/Time Recorded when transfer date is mangled
  const recorded = block.match(
    /Date(?:\/Time)? Recorded[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  );
  if (recorded?.[1]) return parseTransferDate(recorded[1]);

  // OCR digit errors: 202s → 2025
  const ocrDate = block.match(
    /Date(?:\/Time)? Recorded[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}[0-9sS])/i,
  );
  if (ocrDate?.[1]) {
    const fixed = ocrDate[1].replace(/[sS]$/, "5");
    return parseTransferDate(fixed);
  }

  return null;
}

function splitDeclarations(text: string): string[] {
  const parts = text.split(/(?=1\.\s*County\s+)/i);
  const blocks = parts.map((p) => p.trim()).filter((p) => p.length > 200);
  if (blocks.length > 1) return blocks;

  return text
    .split(
      /(?=(?:INFORMATION AS FILED WITH MAINE REVENUE SERVICES)|(?:Form RETTD)|(?:MAINE REAL ESTATE\s+TRANSFER TAX DECLARATION))/i,
    )
    .map((p) => p.trim())
    .filter((p) => p.length > 200);
}

export function parseRobbinstonTransfersText(
  text: string,
  geocode: string,
  sourceLabel: string,
): { rows: RobbinstonTransferRow[]; dropped: number } {
  const rows: RobbinstonTransferRow[] = [];
  let dropped = 0;

  for (const block of splitDeclarations(text)) {
    if (!/ROBBINSTON/i.test(block)) {
      dropped += 1;
      continue;
    }
    const mapLot = extractMapLot(block);
    const date = extractDate(block);
    const grantees = extractGrantees(block)
      .map(cleanOwner)
      .filter((n): n is string => Boolean(n));
    if (!mapLot || !date || grantees.length === 0) {
      dropped += 1;
      continue;
    }

    const ownerName = grantees.join(" / ");
    const mapLotNorm = buildRobbinstonMapLot(mapLot.map, mapLot.lot);
    const keys = robbinstonMapJoinKeys(geocode, mapLot.map, mapLot.lot);
    const mapJoinKey = keys[0] ?? null;
    if (!mapLotNorm || !mapJoinKey) {
      dropped += 1;
      continue;
    }

    rows.push({
      ownerName,
      grantorName: extractGrantor(block),
      map: mapLot.map,
      lot: mapLot.lot,
      mapLot: mapLotNorm,
      mapJoinKey,
      transferDate: date,
      source: "transfer",
      sourceLabel,
    });
  }

  return { rows, dropped };
}

/** Keep latest transfer per mapJoinKey. */
export function rankTransfersByDate(
  transfers: RobbinstonTransferRow[],
): Map<string, RobbinstonTransferRow> {
  const byKey = new Map<string, RobbinstonTransferRow>();
  for (const row of transfers) {
    const existing = byKey.get(row.mapJoinKey);
    if (!existing || row.transferDate > existing.transferDate) {
      byKey.set(row.mapJoinKey, row);
    }
  }
  return byKey;
}
