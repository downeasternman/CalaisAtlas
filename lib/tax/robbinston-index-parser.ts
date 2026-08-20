/**
 * Parse Robbinston OWNER / MAP / LOT HTML (or markdown table) index.
 */
import { sanitizeOwnerName } from "./owner-normalize";
import { isValidOwnerName } from "./owner-validate";
import {
  buildRobbinstonMapLot,
  robbinstonMapJoinKeys,
  splitRobbinstonLotComponents,
} from "./robbinston-map-lot";

export interface RobbinstonIndexRow {
  ownerName: string;
  map: string;
  lot: string;
  mapLot: string;
  mapJoinKey: string;
  source: "index";
}

const HTML_ROW_RE =
  /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

const MD_ROW_RE =
  /^\|\s*(.+?)\s*\|\s*([0-9A-Za-z]+)\s*\|\s*(.+?)\s*\|\s*$/gm;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanOwner(raw: string): string | null {
  const sanitized = sanitizeOwnerName(stripTags(raw));
  if (!sanitized.name || !isValidOwnerName(sanitized.name)) return null;
  return sanitized.name;
}

export function parseRobbinstonOwnerIndex(
  text: string,
  geocode: string,
): { rows: RobbinstonIndexRow[]; dropped: number } {
  const rows: RobbinstonIndexRow[] = [];
  let dropped = 0;
  const seen = new Set<string>();

  const pushRow = (ownerRaw: string, mapRaw: string, lotRaw: string) => {
    const ownerName = cleanOwner(ownerRaw);
    const map = stripTags(mapRaw).toUpperCase();
    const lot = stripTags(lotRaw).toUpperCase();
    if (!ownerName || !map || !lot) {
      dropped += 1;
      return;
    }
    if (/^OWNER$/i.test(ownerName) || /^MAP$/i.test(map)) return;

    const components = splitRobbinstonLotComponents(lot);
    let emitted = 0;
    for (const component of components) {
      const mapLot = buildRobbinstonMapLot(map, component);
      const keys = robbinstonMapJoinKeys(geocode, map, component);
      const mapJoinKey = keys[0] ?? null;
      if (!mapLot || !mapJoinKey) {
        dropped += 1;
        continue;
      }
      const dedupe = `${mapJoinKey}|${ownerName}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      rows.push({
        ownerName,
        map,
        lot: component,
        mapLot,
        mapJoinKey,
        source: "index",
      });
      emitted += 1;
    }
    if (emitted === 0) dropped += 1;
  };

  for (const match of text.matchAll(HTML_ROW_RE)) {
    pushRow(match[1] ?? "", match[2] ?? "", match[3] ?? "");
  }

  if (rows.length === 0) {
    for (const match of text.matchAll(MD_ROW_RE)) {
      pushRow(match[1] ?? "", match[2] ?? "", match[3] ?? "");
    }
  }

  return { rows, dropped };
}
