const EXEMPTION_LABEL_RE = /homestead|veteran|vet-nme|exempt|post ww/i;
const STREET_WORD_RE =
  /\b(ROAD|RD|ST|STREET|LN|LANE|DRIVE|DR|AVE|COVE|HIGHWAY|HWY|WAY|AVENUE|CIRCLE|COURT|CT|PLACE|TRAIL|BOULEVARD|ROUTE|POINT|APT|APARTMENT|CAMINO|ESPLENDORA)\b/i;
const ENTITY_RE = /\b(LLC|INC|TRUST|ESTATE|L\.L\.C\.|HEIRS|LTD|BANK|PLT)\b/i;
const LAST_FIRST_RE = /^[A-Z][A-Za-z.'-]+,\s*[A-Z]/;
const JOINT_TENANCY_RE = /\b(JT|ET\s+AL|ET\s+UX|ET\s+VIR)\b/i;
const ADDRESS_FRAGMENT_RE = /^(?:NO\.|N\.|S\.|E\.|W\.|#)\s+/i;
const TRAILING_ZERO_COLS_RE = /\s+0(?:\s+0)+\s*$/;
const PLACE_FEATURE_RE =
  /\b(HILL|RIDGE|BROOK|POND|LAKE|ISLAND|POINT|COVE|BEACH|HARBOR|HEATH|MEADOW|GROVE|MOUNT|MOUNTAIN|VALLEY|SPRINGS|TERRACE|VILLAGE|CENTER|CENTRE|ROCKS|LEDGE|NECK|PARK|BAY|RIVER|CREEK|FALLS|CAMP|CROSSING|CORNER)\b/i;

export function isValidMoney(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+$/.test(cleaned)) return false;
  const num = Number(cleaned);
  return num >= 100 && num <= 50_000_000;
}

export function isLikelySitusOrMailHeader(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (ENTITY_RE.test(trimmed)) return false;
  if (/^STATE HOUSE STATION$/i.test(trimmed)) return true;
  if (/\b(APT|APARTMENT|SUITE|UNIT)\b/i.test(trimmed)) return true;
  if (STREET_WORD_RE.test(trimmed)) return true;
  if (/^\d+\s+[A-Z]/.test(trimmed)) return true;
  if (!/,/.test(trimmed) && !/\d/.test(trimmed) && !/&/.test(trimmed) && !JOINT_TENANCY_RE.test(trimmed)) {
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2 && tokens.length <= 4) {
      const allAlpha = tokens.every((token) => /^[A-Za-z][A-Za-z.'-]*$/.test(token));
      if (allAlpha && PLACE_FEATURE_RE.test(trimmed)) return true;
    }
  }
  return false;
}

export function hasPersonOrEntitySignal(name: string): boolean {
  if (ENTITY_RE.test(name)) return true;
  if (JOINT_TENANCY_RE.test(name)) return true;
  if (LAST_FIRST_RE.test(name.trim())) return true;
  if (/,/.test(name)) {
    if (STREET_WORD_RE.test(name) && /\b(APT|APARTMENT|SUITE|UNIT)\b/i.test(name)) {
      return false;
    }
    if (STREET_WORD_RE.test(name)) return false;
    return true;
  }
  if (STREET_WORD_RE.test(name)) return false;
  if (ADDRESS_FRAGMENT_RE.test(name)) return false;

  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return tokens.every((token) => /^[A-Z][A-Za-z.'-]+$/.test(token));
  }

  return false;
}

export function isValidOwnerName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 4) return false;
  if (/^[\d,\.\s]+$/.test(trimmed)) return false;
  if (/[\t][\d,]/.test(trimmed)) return false;
  if (/\s[\d,]{3,}$/.test(trimmed)) return false;
  if (TRAILING_ZERO_COLS_RE.test(trimmed)) return false;
  if (ADDRESS_FRAGMENT_RE.test(trimmed)) return false;
  if (/^\d+\s+[A-Z]/.test(trimmed) && !ENTITY_RE.test(trimmed) && !/,/.test(trimmed)) {
    return false;
  }
  if (EXEMPTION_LABEL_RE.test(trimmed)) return false;
  if (/\b(soft|mixed|hard|acres)\b/i.test(trimmed)) return false;
  if (STREET_WORD_RE.test(trimmed) && !hasPersonOrEntitySignal(trimmed)) return false;
  if (isLikelySitusOrMailHeader(trimmed)) return false;
  if (!hasPersonOrEntitySignal(trimmed)) return false;
  return /[A-Za-z]/.test(trimmed);
}

export function isValidAccountNumber(account: string | null | undefined): boolean {
  if (!account) return false;
  const trimmed = account.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return false;
  if (trimmed === "0") return false;
  return true;
}

export function hasValidOwner(record: { ownerName: string | null }): boolean {
  return isValidOwnerName(record.ownerName);
}

export function hasValidAssessment(record: {
  assessedTotalValue: string | null;
}): boolean {
  return isValidMoney(record.assessedTotalValue);
}

export function isQualityTaxRecord(
  record: Pick<{ ownerName: string | null; assessedTotalValue: string | null }, "ownerName" | "assessedTotalValue">,
): boolean {
  return hasValidOwner(record) && hasValidAssessment(record);
}
