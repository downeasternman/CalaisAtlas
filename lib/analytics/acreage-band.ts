export const ACREAGE_BANDS = ["lt2", "2to10", "10to40", "40to200", "ge200"] as const;
export type AcreageBand = (typeof ACREAGE_BANDS)[number];

export function acreageBand(gisAcreage: number | null): AcreageBand | null {
  if (gisAcreage == null || gisAcreage < 0) return null;
  if (gisAcreage < 2) return "lt2";
  if (gisAcreage < 10) return "2to10";
  if (gisAcreage < 40) return "10to40";
  if (gisAcreage < 200) return "40to200";
  return "ge200";
}

export function acreageBandLabel(band: AcreageBand): string {
  switch (band) {
    case "lt2":
      return "<2 ac";
    case "2to10":
      return "2–10 ac";
    case "10to40":
      return "10–40 ac";
    case "40to200":
      return "40–200 ac";
    case "ge200":
      return "≥200 ac";
  }
}
