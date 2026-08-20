/**
 * Normalize Robbinston OWNER-index MAP + LOT into GeoLibrary-style map-lot keys.
 */
import { normalizeMapBkLot, organizedMapJoinKey } from "./map-lot-normalize";

export function padMapSegment(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (/^\d+$/.test(trimmed)) return trimmed.padStart(3, "0");
  // Lettered maps like 5A / 9A → 05A / 09A
  const lettered = trimmed.match(/^(\d+)([A-Z]+)$/);
  if (lettered) return `${lettered[1]!.padStart(2, "0")}${lettered[2]}`;
  return trimmed;
}

/**
 * Normalize a single lot token (no compound separators).
 * Examples: 77 → 077; 67A → 067-00A; 5-1 → 005-001; 2a → 002-00A
 */
export function normalizeRobbinstonLotToken(lot: string): string | null {
  const raw = lot.trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;

  // Hierarchical numeric: 5-1 → 005-001
  if (/^\d+-\d+$/.test(raw)) {
    const [a, b] = raw.split("-");
    return `${a!.padStart(3, "0")}-${b!.padStart(3, "0")}`;
  }

  // Letter suffix: 67A / 2a → 067-00A
  const lettered = raw.match(/^(\d+)([A-Z]+)$/);
  if (lettered) {
    return `${lettered[1]!.padStart(3, "0")}-00${lettered[2]}`;
  }

  // Numeric only
  if (/^\d+$/.test(raw)) {
    return raw.padStart(3, "0");
  }

  // Alphanumeric leftovers (e.g. 4DEA) — keep as-is padded leading digits when possible
  const mixed = raw.match(/^(\d+)([A-Z0-9]+)$/);
  if (mixed) {
    return `${mixed[1]!.padStart(3, "0")}-${mixed[2]}`;
  }

  return null;
}

/**
 * Split compound lot tokens into joinable components.
 * Safe splits: +, &, /, and integer-integer ranges (57-58).
 * Does not split hierarchical lots like 5-1 (handled as single token).
 */
export function splitRobbinstonLotComponents(lot: string): string[] {
  const raw = lot.trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return [];

  if (/[+&/]/.test(raw)) {
    return raw
      .split(/[+&/]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  // Range of bare integers only when both sides look like peer lots (57-58),
  // not hierarchical sublots (5-1).
  const range = raw.match(/^(\d+)-(\d+)$/);
  if (range) {
    const left = range[1]!;
    const right = range[2]!;
    const a = Number(left);
    const b = Number(right);
    const peerLots =
      left.length >= 2 &&
      right.length >= 2 &&
      Number.isFinite(a) &&
      Number.isFinite(b) &&
      a !== b &&
      Math.abs(b - a) <= 5;
    if (peerLots) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const parts: string[] = [];
      for (let i = lo; i <= hi; i++) parts.push(String(i));
      return parts;
    }
  }

  return [raw];
}

export function buildRobbinstonMapLot(map: string, lot: string): string | null {
  const mapSeg = padMapSegment(map);
  const lotSeg = normalizeRobbinstonLotToken(lot);
  if (!mapSeg || !lotSeg) return null;
  return normalizeMapBkLot(`${mapSeg}-${lotSeg}`);
}

export function robbinstonMapLotCandidates(map: string, lot: string): string[] {
  const components = splitRobbinstonLotComponents(lot);
  const out: string[] = [];
  for (const component of components) {
    const built = buildRobbinstonMapLot(map, component);
    if (!built) continue;
    out.push(built);
    // GeoLibrary often pads trailing -000 for two-segment lots
    if (/^\d{3}-[A-Z0-9]+$/.test(built) || /^\d{2}[A-Z]-\d{3}$/.test(built)) {
      if (!/-00[A-Z]$/i.test(built) && !/-\d{3}-\d{3}$/.test(built)) {
        out.push(`${built}-000`);
      }
    }
    if (/^\d{3}-\d{3}$/.test(built)) {
      out.push(`${built}-000`);
    }
  }
  return [...new Set(out)];
}

export function robbinstonMapJoinKeys(
  geocode: string,
  map: string,
  lot: string,
): string[] {
  return robbinstonMapLotCandidates(map, lot)
    .map((lotKey) => organizedMapJoinKey(geocode, lotKey))
    .filter((key): key is string => Boolean(key));
}
