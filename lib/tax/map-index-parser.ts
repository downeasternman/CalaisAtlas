import { mapJoinKey } from "./plan-lot";

export interface MapIndexRow {
  propertyId: string;
  mapCode: string;
  plan: string | null;
  lot: string | null;
  mapJoinKey: string | null;
  divisionName: string | null;
  indexOwner: string | null;
  acreage: string | null;
}

const SECTION_RE = /Map\/Lot # Owner\s*([^\n]+), Washington/gi;
const PROPERTY_ID_RE = "298\\d{6}P?";
const LINE_WITH_PLAN_RE = new RegExp(
  `Map\\s+(WA\\d{3})\\s+Plan\\s+(\\d+)\\s+Lot\\s+([\\d.\\s]+?)\\s+(${PROPERTY_ID_RE})\\s+([\\d,.]+)\\s+(.+)`,
  "gi",
);
const LINE_MAP_ONLY_RE = new RegExp(
  `Map\\s+(WA\\d{3})\\s+(${PROPERTY_ID_RE})\\s+([\\d,.]+)\\s+(.+)`,
  "gi",
);

function normalizePropertyId(id: string): string {
  return id.replace(/P$/i, "").toUpperCase();
}

function parseLots(plan: string, lotPart: string): Array<{ plan: string; lot: string }> {
  const lots = lotPart.trim().split(/\s+/).filter(Boolean);
  return lots.map((lot) => ({ plan, lot }));
}

/**
 * Parse 2024 Washington County Map/Lot Index PDF text.
 */
export function parseMapLotIndexText(text: string): MapIndexRow[] {
  const rows: MapIndexRow[] = [];
  const sections = [...text.matchAll(SECTION_RE)];
  const sectionBounds: Array<{ name: string; start: number }> = sections.map((m) => ({
    name: m[1].trim(),
    start: m.index ?? 0,
  }));

  function divisionForOffset(offset: number): string | null {
    let division: string | null = null;
    for (const section of sectionBounds) {
      if (section.start <= offset) division = section.name;
      else break;
    }
    return division;
  }

  for (const match of text.matchAll(LINE_WITH_PLAN_RE)) {
    const mapCode = match[1].toUpperCase();
    const plan = match[2];
    const propertyId = normalizePropertyId(match[4]);
    const acreage = match[5].replace(/,/g, "");
    const owner = match[6].trim();
    const divisionName = divisionForOffset(match.index ?? 0);

    for (const { lot } of parseLots(plan, match[3])) {
      rows.push({
        propertyId,
        mapCode,
        plan,
        lot,
        mapJoinKey: mapJoinKey(mapCode, plan, lot),
        divisionName,
        indexOwner: owner,
        acreage,
      });
    }
  }

  for (const match of text.matchAll(LINE_MAP_ONLY_RE)) {
    const mapCode = match[1].toUpperCase();
    const propertyId = normalizePropertyId(match[2]);
    const acreage = match[3].replace(/,/g, "");
    const owner = match[4].trim();
    const divisionName = divisionForOffset(match.index ?? 0);

    rows.push({
      propertyId,
      mapCode,
      plan: null,
      lot: null,
      mapJoinKey: null,
      divisionName,
      indexOwner: owner,
      acreage,
    });
  }

  return dedupeRows(rows);
}

function dedupeRows(rows: MapIndexRow[]): MapIndexRow[] {
  const seen = new Map<string, MapIndexRow>();
  for (const row of rows) {
    const key = row.mapJoinKey
      ? `${row.propertyId}|${row.mapJoinKey}`
      : `${row.propertyId}|map-only`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

export function buildIndexLookups(rows: MapIndexRow[]) {
  const byPropertyId = new Map<string, MapIndexRow[]>();
  const byMapJoinKey = new Map<string, MapIndexRow[]>();

  for (const row of rows) {
    const pidList = byPropertyId.get(row.propertyId) ?? [];
    pidList.push(row);
    byPropertyId.set(row.propertyId, pidList);

    if (row.mapJoinKey) {
      const key = row.mapJoinKey.toUpperCase();
      const mapList = byMapJoinKey.get(key) ?? [];
      mapList.push(row);
      byMapJoinKey.set(key, mapList);
    }
  }

  return { byPropertyId, byMapJoinKey };
}
