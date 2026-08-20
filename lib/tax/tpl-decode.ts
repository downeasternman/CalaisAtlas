import { mapJoinKeyFromTpl } from "./plan-lot";

export type TplFamily = "wa_map" | "wap_plat" | "pe_plat" | "ha_plat" | "arp_plat" | "unknown";

export interface DecodedTpl {
  family: TplFamily;
  tpl: string;
  mapJoinKey: string | null;
  platCode: string | null;
  planLot: string | null;
}

export function decodeTpl(tpl: string | null, planLot: string | null): DecodedTpl | null {
  if (!tpl) return null;
  const normalized = tpl.trim().toUpperCase();

  const waKey = mapJoinKeyFromTpl(normalized);
  if (waKey) {
    return {
      family: "wa_map",
      tpl: normalized,
      mapJoinKey: waKey,
      platCode: null,
      planLot,
    };
  }

  const wap = normalized.match(/^(WAP\d{2})(\d{2})(.+)$/);
  if (wap) {
    return {
      family: "wap_plat",
      tpl: normalized,
      mapJoinKey: null,
      platCode: wap[1],
      planLot: planLot ?? `${wap[2]}-${wap[3]}`,
    };
  }

  if (normalized.startsWith("PEP") || normalized.startsWith("PE0")) {
    return {
      family: "pe_plat",
      tpl: normalized,
      mapJoinKey: null,
      platCode: normalized.slice(0, 4),
      planLot,
    };
  }

  if (normalized.startsWith("HA")) {
    return {
      family: "ha_plat",
      tpl: normalized,
      mapJoinKey: null,
      platCode: normalized.slice(0, 4),
      planLot,
    };
  }

  if (normalized.startsWith("ARP")) {
    return {
      family: "arp_plat",
      tpl: normalized,
      mapJoinKey: null,
      platCode: normalized.slice(0, 4),
      planLot,
    };
  }

  return {
    family: "unknown",
    tpl: normalized,
    mapJoinKey: null,
    platCode: null,
    planLot,
  };
}
