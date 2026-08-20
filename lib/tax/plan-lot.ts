/**
 * Join keys derived from MRS MAP WA### PLAN ## LOT ## lines and TPL attributes.
 */
export function normalizePlanLotKey(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = trimmed.match(/^(\d+)-(.+)$/);
  if (!match) return trimmed;
  const plan = match[1].padStart(2, "0");
  const lot = match[2];
  return `${plan}-${lot}`;
}

export function planLotFromParts(plan: string | null, lot: string | null): string | null {
  if (!plan || lot == null || lot === "") return null;
  return normalizePlanLotKey(`${plan}-${lot}`);
}

export function mapJoinKey(mapCode: string, plan: string, lot: string): string {
  const normalizedMap = mapCode.trim().toUpperCase();
  return `${normalizedMap}|${normalizePlanLotKey(`${plan}-${lot}`)}`;
}

export function mapJoinKeyFromTpl(tpl: string | null): string | null {
  if (!tpl) return null;
  const match = tpl.trim().match(/^WA(\d{3})(\d{2})(.+)$/i);
  if (!match) return null;
  return mapJoinKey(`WA${match[1]}`, match[2], match[3]);
}

export function joinKey(municipalityId: string, planLot: string): string {
  return `${municipalityId}|${normalizePlanLotKey(planLot)}`;
}
