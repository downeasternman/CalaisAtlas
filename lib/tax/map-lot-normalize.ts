/**
 * Normalize organized-town MAP_BK_LOT / commitment-book map-lot strings for joins.
 */
export function normalizeRuMapLot(raw: string): string | null {
  const m = raw
    .trim()
    .toUpperCase()
    .match(/^([RU])(\d{1,2})-(.+)$/);
  if (!m) return null;
  const letter = m[1]!;
  const mapNum = m[2]!;
  const rest = m[3]!;
  // GeoLibrary: R01/U05 → 0R1/0U5; R10/U16 stay R10/U16
  const mapSeg =
    mapNum.length === 1
      ? `0${letter}${mapNum}`
      : mapNum.startsWith("0")
        ? `0${letter}${mapNum.slice(1)}`
        : `${letter}${mapNum}`;
  const restParts = rest.split("-").map((part) => {
    if (/^\d+$/.test(part)) return part.padStart(3, "0");
    return part;
  });
  return `${mapSeg}-${restParts.join("-")}`;
}

export function normalizeMapBkLot(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let normalized = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalized) return null;

  const ru = normalizeRuMapLot(normalized);
  if (ru) normalized = ru;

  // GeoLibrary often pads lots as ###-###-000 while commitment books omit trailing -000.
  if (/-000$/.test(normalized)) {
    normalized = normalized.replace(/-000$/, "");
  }

  return normalized || null;
}

function padMapLotSegments(normalized: string): string | null {
  const parts = normalized.split("-");
  if (parts.length < 2 || parts.length > 4) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;
  return parts.map((part) => part.padStart(3, "0")).join("-");
}

function padNumericPrefixWithSuffix(normalized: string): string[] {
  const m = normalized.match(/^(\d{1,3})-(\d{1,3})-([A-Z0-9]+)$/i);
  if (!m) return [];
  const map = m[1]!.padStart(3, "0");
  const lot = m[2]!.padStart(3, "0");
  const suf = m[3]!.toUpperCase();
  const out = [`${map}-${lot}`, `${map}-${lot}-000`, `${map}-${lot}-${suf}`];
  if (/^[A-Z]$/.test(suf)) {
    out.push(`${map}-${lot}-00${suf}`);
    out.push(`${map}-${lot}${suf}`);
    out.push(`${map}-${lot}${suf}-000`);
  }
  return out;
}

/** Wesley letter-grid IDs (G-0210) often join to bare GeoLibrary keys (210). */
function wesleyLetterGridCandidates(normalized: string): string[] {
  const m = normalized.match(/^([A-G])-(\d{3,4})(?:-.*)?$/i);
  if (!m) return [];
  const letter = m[1]!.toUpperCase();
  const digits = m[2]!;
  const last3 = digits.slice(-3).padStart(3, "0");
  const out = [
    digits,
    digits.replace(/^0+/, "") || "0",
    `00${letter}-${last3}`,
    `00${letter}-${last3}-000`,
    `${letter}-${last3}`,
  ];
  if (digits.length === 4) {
    out.push(`00${letter}-${digits.slice(1).padStart(3, "0")}`);
  }
  return out;
}

const GIS_LOT_SUFFIX_RE =
  /-(?:00[A-Z]|UIL|UI2|UI3|UB|MHL|PAR|BOL|MH)(?:-\d+)?$/i;

/**
 * Map-lot strings to try when joining geometry to commitment-book rows.
 */
export function mapLotJoinCandidates(mapLot: string | null | undefined): string[] {
  const normalized = normalizeMapBkLot(mapLot);
  if (!normalized) return [];

  const candidates: string[] = [normalized];
  const padded = padMapLotSegments(normalized);
  if (padded) {
    candidates.push(padded);
    if (padded.split("-").length === 2) {
      candidates.push(`${padded}-000`);
    }
  }
  candidates.push(...padNumericPrefixWithSuffix(normalized));
  candidates.push(...wesleyLetterGridCandidates(normalized));

  let cur = normalized;

  while (GIS_LOT_SUFFIX_RE.test(cur)) {
    const next = cur.replace(GIS_LOT_SUFFIX_RE, "");
    if (!next || next === cur) break;
    candidates.push(next);
    cur = next;
  }

  while (cur.includes("-")) {
    const lastDash = cur.lastIndexOf("-");
    const parent = cur.slice(0, lastDash);
    if (!parent || parent === cur) break;
    candidates.push(parent);
    const parentPadded = padMapLotSegments(parent);
    if (parentPadded) candidates.push(parentPadded);
    cur = parent;
  }

  return [...new Set(candidates)];
}

export function organizedMapJoinKey(geocode: string, mapLot: string | null): string | null {
  const normalized = normalizeMapBkLot(mapLot);
  if (!normalized) return null;
  return `${geocode}|${normalized}`;
}
