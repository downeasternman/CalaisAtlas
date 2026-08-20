import type { ParcelFeature } from "./features";
import type { Observation } from "./observations";
import type { GraphEdge, OwnerEntity } from "./ownership";
import type { ParcelSnapshot } from "./types";

export const INVESTIGATOR_SYSTEM_PROMPT =
  "You are a forensic property-records analyst. Cite the packet only. Do not compute new statistics. If a number is missing, say it is not in the packet. Use: unusual, inconsistent, potentially related, warrants review, possible data artifact. Never claim fraud, evasion, or wrongdoing.";

export const FORBIDDEN_VOCABULARY =
  /\b(fraud|evasion|illegal|crime|criminal|steal|stolen|launder|tax.?cheat)\b/i;

export type HypothesisClass =
  | "artifact"
  | "ordinary"
  | "unexplained"
  | "institutional_baseline";

export interface PacketParcel {
  parcelId: string;
  municipalityId: string | null;
  ownerNameRaw: string | null;
  gisAcreage: number | null;
  taxAcreage: number | null;
  taxable: number | null;
  land: number | null;
  building: number | null;
  exemption: number | null;
  valuePerGisAcre: number | null;
  vacantFlag: boolean;
  unjoinedFlag: boolean;
  valuationAllocation: string | null;
  tplFamily: string | null;
}

export interface InvestigatorPacket {
  observation: Observation;
  observationParcelCount: number;
  packetParcelCount: number;
  parcels: PacketParcel[];
  ownerSlice: Array<{
    nameNormalized: string;
    institutionalBaseline: boolean;
    parcelCount: number;
    gisAcres: number;
    maxTownshipAcreShare: number | null;
  }>;
  relationships: Observation["relationships"];
  sources: Array<{ id: string; role: string }>;
}

export interface HypothesisJson {
  observationId: string;
  what: string;
  howUnusual: string;
  comparisonPopulation: string;
  classification: HypothesisClass;
  alternativeExplanations: string[];
  falsifiers: string[];
  nextData: string[];
  citedValues: Array<{ field: string; value: unknown; source: string }>;
  missingFields: string[];
  notes: string;
}

export interface InvestigatorContext {
  snapshots: ParcelSnapshot[];
  features: ParcelFeature[];
  entities: OwnerEntity[];
  graphEdges: GraphEdge[];
}

const PACKET_PARCEL_CAP = 25;

function snapshotById(snapshots: ParcelSnapshot[]) {
  return new Map(snapshots.map((s) => [s.parcelId, s] as const));
}

function featureById(features: ParcelFeature[]) {
  return new Map(features.map((f) => [f.parcelId, f] as const));
}

export function buildInvestigatorPacket(
  observation: Observation,
  ctx: InvestigatorContext,
): InvestigatorPacket {
  const snaps = snapshotById(ctx.snapshots);
  const feats = featureById(ctx.features);
  const parcelIds = observation.parcelIds.slice(0, PACKET_PARCEL_CAP);
  const parcels: PacketParcel[] = parcelIds.map((id) => {
    const s = snaps.get(id);
    const f = feats.get(id);
    return {
      parcelId: id,
      municipalityId: s?.municipalityId ?? null,
      ownerNameRaw: s?.ownerNameRaw ?? null,
      gisAcreage: f?.gisAcreage ?? s?.gisAcreageNumeric ?? null,
      taxAcreage: f?.taxAcreage ?? s?.taxAcreageNumeric ?? null,
      taxable: f?.taxable ?? s?.assessedTotalValueNumeric ?? null,
      land: f?.land ?? s?.assessedLandValueNumeric ?? null,
      building: f?.building ?? s?.assessedBuildingValueNumeric ?? null,
      exemption: f?.exemption ?? s?.assessedExemptionValueNumeric ?? null,
      valuePerGisAcre: f?.valuePerGisAcre ?? null,
      vacantFlag: f?.vacantFlag ?? false,
      unjoinedFlag: f?.unjoinedFlag ?? false,
      valuationAllocation: f?.valuationAllocation ?? null,
      tplFamily: f?.tplFamily ?? null,
    };
  });

  const ownerSlice = observation.ownerIds.map((name) => {
    const ent = ctx.entities.find((e) => e.nameNormalized === name);
    return {
      nameNormalized: name,
      institutionalBaseline: ent?.institutionalBaseline ?? false,
      parcelCount: ent?.parcelCount ?? 0,
      gisAcres: ent?.gisAcres ?? 0,
      maxTownshipAcreShare: ent?.maxTownshipAcreShare ?? null,
    };
  });

  return {
    observation,
    observationParcelCount: observation.parcelIds.length,
    packetParcelCount: parcels.length,
    parcels,
    ownerSlice,
    relationships: observation.relationships,
    sources: [
      { id: "mrs-ut-valuation-2025", role: "tax" },
      { id: "mrs-ut-parcels", role: "geometry" },
    ],
  };
}

const NUMBER_TOKEN = /-?\d+(?:\.\d+(?:[eE][+-]?\d+)?)?/g;

function numericTokens(text: string): string[] {
  return text.match(NUMBER_TOKEN) ?? [];
}

export function collectPacketNumbers(packet: InvestigatorPacket): Set<string> {
  const out = new Set<string>();
  const json = JSON.stringify(packet);
  for (const token of numericTokens(json)) {
    out.add(token);
    const n = Number(token);
    if (Number.isFinite(n)) {
      out.add(String(Math.round(n)));
      out.add(String(n));
    }
  }
  return out;
}

export function validateHypothesis(
  packet: InvestigatorPacket,
  hypothesis: HypothesisJson,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const blob = [
    hypothesis.what,
    hypothesis.howUnusual,
    hypothesis.comparisonPopulation,
    hypothesis.notes,
    ...hypothesis.alternativeExplanations,
  ].join(" ");
  if (FORBIDDEN_VOCABULARY.test(blob)) {
    errors.push("forbidden vocabulary");
  }
  const allowed = collectPacketNumbers(packet);
  for (const token of numericTokens(blob)) {
    if (token.length > 12) continue;
    if (!allowed.has(token) && !allowed.has(String(Number(token)))) {
      errors.push(`uncited number ${token}`);
    }
  }
  if (hypothesis.observationId !== packet.observation.id) {
    errors.push("observationId mismatch");
  }
  return { ok: errors.length === 0, errors };
}

function classify(packet: InvestigatorPacket): HypothesisClass {
  const flags = packet.observation.dataQualityFlags;
  if (flags.includes("institutional_baseline")) return "institutional_baseline";
  if (
    flags.includes("plat_join_gap") ||
    flags.includes("township_join_gap") ||
    flags.includes("copied_full_assessment") ||
    flags.includes("unjoined_tax") ||
    flags.includes("records_without_land")
  ) {
    return "artifact";
  }
  const scores = packet.relationships.map((r) => r.score).filter((s): s is number => s != null);
  if (packet.observation.observationType === "similar_name_adjacent") {
    if (scores.some((s) => s >= 0.999)) return "ordinary";
    return "unexplained";
  }
  return "unexplained";
}

function cite(
  field: string,
  value: unknown,
  source: string,
): { field: string; value: unknown; source: string } {
  return { field, value, source };
}

/**
 * Fill hypothesis JSON from the packet only. Does not compute new statistics.
 */
export function citeOnlyInvestigate(packet: InvestigatorPacket): HypothesisJson {
  const o = packet.observation;
  const missingFields: string[] = [];
  if (packet.parcels.some((p) => p.gisAcreage == null) && packet.parcels.length > 0) {
    missingFields.push("gisAcreage");
  }
  if (packet.parcels.some((p) => p.valuePerGisAcre == null) && packet.parcels.length > 0) {
    missingFields.push("valuePerGisAcre");
  }
  if (o.observed == null) missingFields.push("observed");
  if (o.expected == null) missingFields.push("expected");

  const citedValues = [
    cite("observed", o.observed, "observation"),
    cite("expected", o.expected, "observation"),
    cite("residual", o.residual, "observation"),
    cite("percentile", o.percentile, "observation"),
    cite("parcelCount", o.parcelIds.length, "observation"),
    cite("observationParcelCount", packet.observationParcelCount, "packet"),
    cite("packetParcelCount", packet.packetParcelCount, "packet"),
  ];
  if (o.peerGroup) {
    citedValues.push(cite("peerN", o.peerGroup.n, "observation.peerGroup"));
  }

  const missingNote =
    missingFields.length > 0
      ? ` Not in this packet: ${missingFields.join(", ")}. Do not invent those values.`
      : "";

  const what = o.hypotheses[0]?.text ?? o.observationType;
  const comparison =
    o.peerGroup != null
      ? `Peer group ${o.peerGroup.type} id ${o.peerGroup.id} n=${o.peerGroup.n} filters ${o.peerGroup.filters.join(", ")}.`
      : `Scope ${o.scope}; observationParcelCount=${packet.observationParcelCount} packetParcelCount=${packet.packetParcelCount}.`;

  const howUnusual =
    o.observed != null && o.expected != null
      ? `Packet observed=${o.observed} expected=${o.expected} residual=${o.residual} percentile=${o.percentile}.`
      : o.observed != null
        ? `Packet observed=${o.observed}. Expected is not in this packet.`
        : `No observed/expected pair is in this packet.${missingNote}`;

  return {
    observationId: o.id,
    what,
    howUnusual: howUnusual + missingNote,
    comparisonPopulation: comparison,
    classification: classify(packet),
    alternativeExplanations: o.alternativeExplanations,
    falsifiers: o.hypotheses.map((h) => h.falsify),
    nextData: [
      "tax map sheet for the TPL / map-lot",
      "valuation-book PDF block (mapLine)",
      "deed / registry name variants",
      "Tree Growth roll if enrolled",
      "shoreline metric (not in this packet)",
      ...o.recommendedFollowups,
    ],
    citedValues,
    missingFields,
    notes: "Cite-only fill from the packet. Missing fields stay missing.",
  };
}

export function buildInvestigatorPrompt(packet: InvestigatorPacket): {
  system: string;
  user: string;
} {
  return {
    system: INVESTIGATOR_SYSTEM_PROMPT,
    user: JSON.stringify(packet),
  };
}
