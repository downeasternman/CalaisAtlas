import { sanitizeOwnerName } from "@/lib/tax/owner-normalize";

export const ENTITY_TYPES = [
  "federal",
  "state",
  "municipal",
  "conservation",
  "utility",
  "church",
  "llc",
  "trust",
  "estate",
  "individual",
  "unknown",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

const INSTITUTIONAL_PREFIXES = [
  "TYPHOON LLC",
  "MAINE STATE OF",
  "UNITED STATES OF AMERICA",
  "UNITED STATES",
  "BASKAHEGAN CO",
  "BASKAHEGAN COMPANY",
  "WOODLAND PULP",
  "PENOBSCOT FOREST",
  "MAINE COAST HERITAGE TRUST",
  "IF&W",
];

const AGENCY_SUFFIX_RE = /^(IF&W|IF AND W|DIFW|DOT|DOC|DACF|BPL|BGS)$/;

function expandAbbreviations(value: string): string {
  return value
    .replace(/L\s*\.\s*L\s*\.\s*C\s*\.?/gi, "LLC")
    .replace(/\bL\s+L\s+C\b/gi, "LLC")
    .replace(/\bETAL\b/gi, "ET AL")
    .replace(/\bET\s+ALS?\b/gi, "ET AL");
}

/**
 * Analytical normalize. Identity key is this string exactly — never token-sorted.
 */
export function analyticalNormalizeOwner(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const sanitized = sanitizeOwnerName(raw).name;
  const base = (sanitized ?? raw).trim();
  if (!base) return null;
  let text = expandAbbreviations(base).toUpperCase();
  text = text.replace(/[^\w\s&]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text || null;
}

export function normalizeMail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.toUpperCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

export function entityTypeOf(normalized: string): EntityType {
  if (/\bUNITED STATES\b|\bU S A\b|\bUSFS\b|\bNATIONAL PARK\b|\bNATIONAL WILDLIFE\b/.test(normalized)) {
    return "federal";
  }
  if (/\bMAINE STATE OF\b|\bSTATE OF MAINE\b|\bIF&W\b|\bINLAND FISHERIES\b/.test(normalized)) {
    return "state";
  }
  if (/\bTOWN OF\b|\bCITY OF\b|\bPLANTATION\b|\bCOUNTY OF\b/.test(normalized)) {
    return "municipal";
  }
  if (/\bHERITAGE TRUST\b|\bLAND TRUST\b|\bCONSERVANCY\b|\bNATURE CONSERV/.test(normalized)) {
    return "conservation";
  }
  if (/\bPOWER\b|\bELECTRIC\b|\bWATER DISTRICT\b|\bTELEPHONE\b|\bHYDRO\b/.test(normalized)) {
    return "utility";
  }
  if (/\bCHURCH\b|\bPARISH\b|\bDIOCESE\b|\bBAPTIST\b|\bCATHOLIC\b/.test(normalized)) {
    return "church";
  }
  if (/\bLLC\b|\bINC\b|\bCORP\b|\bLTD\b|\bCOMPANY\b|\bCO\b/.test(normalized)) {
    return "llc";
  }
  if (/\bTRUST\b|\bTRUSTEE\b/.test(normalized)) return "trust";
  if (/\bESTATE\b|\bEST OF\b/.test(normalized)) return "estate";
  if (/[A-Z]/.test(normalized)) return "individual";
  return "unknown";
}

export function isInstitutionalBaseline(normalized: string): boolean {
  return INSTITUTIONAL_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix} `),
  );
}

/** Parenthetical / agency suffix variants stay distinct entities. */
export function isAgencyVariant(a: string, b: string): boolean {
  if (a === b) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.startsWith(shorter)) return false;
  const rest = longer.slice(shorter.length).trim();
  return AGENCY_SUFFIX_RE.test(rest);
}
