import { sanitizeOwnerName } from "./owner-normalize";
import {
  hasPersonOrEntitySignal,
  isLikelySitusOrMailHeader,
  isValidOwnerName,
} from "./owner-validate";

export type CommitmentLayout = "by-name" | "map-lot";

export type OwnerSource = "header" | "mail-line" | "entity-line" | null;

export interface CommitmentAccountBlock {
  headerRest: string;
  ownerRaw: string | null;
  mailLines: string[];
}

export interface ResolvedCommitmentOwner {
  ownerName: string | null;
  extractedLand: string | null;
  ownerSource: OwnerSource;
  situsLabel: string | null;
}

const JOINT_TENANCY_RE = /\b(JT|ET\s+AL|ET\s+UX|ET\s+VIR)\b/i;
const CITY_STATE_ZIP_RE = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;
const ENTITY_RE = /\b(LLC|INC|TRUST|ESTATE|HEIRS|LTD|BANK|PLT)\b/i;
const LAST_FIRST_RE = /^[A-Z][A-Za-z.'-]+,\s*[A-Z]/;
const ACCOUNT_PREFIX_RE = /^(\d{3,5})\s+(.+)$/;

function isStreetOnly(text: string): boolean {
  const upper = text.toUpperCase();
  const hasStreet =
    /\b(ROAD|RD|ST|STREET|LN|LANE|DRIVE|DR|AVE|COVE|WAY|AVENUE|CIRCLE|COURT|CT|PLACE|TRAIL|BOULEVARD|ROUTE|POINT|APT|APARTMENT|CAMINO|ESPLENDORA)\b/.test(
      upper,
    ) || /^(?:NO\.|N\.|S\.|E\.|W\.|#)\s+/i.test(text);
  const hasPersonOrEntity = hasPersonOrEntitySignal(text);
  return hasStreet && !hasPersonOrEntity;
}

function isRejectedMailLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (CITY_STATE_ZIP_RE.test(trimmed)) return true;
  if (/^(WEST|EAST|NORTH|SOUTH)\s+(HALF|PORTION)\s+OF\b/i.test(trimmed)) return true;
  if (/^\d{5}\s+[A-Z]{2}\b/.test(trimmed)) return true;
  if (isStreetOnly(trimmed)) return true;
  return false;
}

function stripAccountPrefix(line: string): string {
  const match = line.trim().match(ACCOUNT_PREFIX_RE);
  return match?.[2]?.trim() ?? line.trim();
}

function isOwnerCandidateLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (LAST_FIRST_RE.test(trimmed)) return true;
  if (JOINT_TENANCY_RE.test(trimmed)) return true;
  if (ENTITY_RE.test(trimmed)) return true;
  if (/,/.test(trimmed)) return true;
  return false;
}

function normalizeInstitutionalOwner(line: string): string | null {
  const text = stripAccountPrefix(line).trim();
  if (!/&/.test(text) || ENTITY_RE.test(text)) return null;
  if (isRejectedMailLine(text)) return null;
  if (isLikelySitusOrMailHeader(text)) return null;
  return text;
}

function trySanitizeOwnerLine(line: string): string | null {
  const candidates = [line.trim(), stripAccountPrefix(line)];
  for (const candidate of candidates) {
    if (isRejectedMailLine(candidate)) continue;
    if (ENTITY_RE.test(candidate)) {
      const sanitized = sanitizeOwnerName(candidate);
      if (sanitized.name) return sanitized.name;
      continue;
    }
    if (/&/.test(candidate) && /^[A-Z0-9\s.&'-]{8,}$/.test(candidate)) {
      if (!isLikelySitusOrMailHeader(candidate)) return candidate.trim();
    }
    if (!isOwnerCandidateLine(candidate)) continue;
    const sanitized = sanitizeOwnerName(candidate);
    if (sanitized.name && !isLikelySitusOrMailHeader(sanitized.name)) {
      return sanitized.name;
    }
  }
  return null;
}

function resolveByNameBlockOwner(block: CommitmentAccountBlock): ResolvedCommitmentOwner {
  const fromHeader = sanitizeOwnerName(block.headerRest);

  if (block.ownerRaw) {
    const fromOwnerRaw = sanitizeOwnerName(block.ownerRaw);
    if (fromOwnerRaw.name) {
      return {
        ownerName: fromOwnerRaw.name,
        extractedLand: fromOwnerRaw.extractedLand ?? fromHeader.extractedLand,
        ownerSource: "header",
        situsLabel: null,
      };
    }
  }

  if (fromHeader.name) {
    return {
      ownerName: fromHeader.name,
      extractedLand: fromHeader.extractedLand,
      ownerSource: "header",
      situsLabel: null,
    };
  }

  for (const line of block.mailLines) {
    if (!isOwnerCandidateLine(line)) continue;
    if (isStreetOnly(line)) continue;
    const sanitized = sanitizeOwnerName(line);
    if (sanitized.name) {
      return {
        ownerName: sanitized.name,
        extractedLand: sanitized.extractedLand,
        ownerSource: "mail-line",
        situsLabel: null,
      };
    }
  }

  return {
    ownerName: null,
    extractedLand: null,
    ownerSource: null,
    situsLabel: null,
  };
}

function isInstitutionalEntityLine(line: string): boolean {
  const text = stripAccountPrefix(line).trim();
  if (!/&/.test(text)) return false;
  if (ENTITY_RE.test(text)) return false;
  return true;
}

function resolveMapLotBlockOwner(block: CommitmentAccountBlock): ResolvedCommitmentOwner {
  const fromHeader = sanitizeOwnerName(block.headerRest);
  const headerText = fromHeader.name ?? block.headerRest.trim();
  const situsLabel =
    headerText && isLikelySitusOrMailHeader(headerText) ? headerText : null;

  for (const line of block.mailLines) {
    if (!isInstitutionalEntityLine(line)) continue;
    const owner = normalizeInstitutionalOwner(line);
    if (owner) {
      return {
        ownerName: owner,
        extractedLand: fromHeader.extractedLand,
        ownerSource: "entity-line",
        situsLabel,
      };
    }
  }

  for (const line of block.mailLines) {
    if (!ENTITY_RE.test(line)) continue;
    const owner =
      trySanitizeOwnerLine(stripAccountPrefix(line)) ?? trySanitizeOwnerLine(line);
    if (owner) {
      return {
        ownerName: owner,
        extractedLand: fromHeader.extractedLand,
        ownerSource: "entity-line",
        situsLabel,
      };
    }
  }

  for (const line of block.mailLines) {
    const owner = trySanitizeOwnerLine(line);
    if (owner) {
      return {
        ownerName: owner,
        extractedLand: fromHeader.extractedLand,
        ownerSource: "mail-line",
        situsLabel,
      };
    }
  }

  if (fromHeader.name && !isLikelySitusOrMailHeader(fromHeader.name)) {
    return {
      ownerName: fromHeader.name,
      extractedLand: fromHeader.extractedLand,
      ownerSource: "header",
      situsLabel: null,
    };
  }

  return {
    ownerName: null,
    extractedLand: fromHeader.extractedLand,
    ownerSource: null,
    situsLabel,
  };
}

export function resolveCommitmentBlockOwner(
  block: CommitmentAccountBlock,
  layout: CommitmentLayout = "by-name",
): ResolvedCommitmentOwner {
  if (layout === "map-lot") {
    return resolveMapLotBlockOwner(block);
  }
  return resolveByNameBlockOwner(block);
}

export function isAssessmentConsistent(
  land: string | null,
  building: string | null,
  total: string | null,
): boolean {
  if (!total) return true;
  const t = Number(total.replace(/,/g, ""));
  if (Number.isNaN(t) || t > 5_000_000) return false;

  const l = land ? Number(land.replace(/,/g, "")) : 0;
  const b = building ? Number(building.replace(/,/g, "")) : 0;
  if (l <= 0 && b <= 0) return true;

  if (l > 0 && b > 0 && t > 0) {
    if (b > t * 1.25 && l > t) return false;
    if (l > t * 1.25 && b > t) return false;
    if (t > l + b + 10_000) return false;
  }

  return true;
}
