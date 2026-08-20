import type { ParcelFeature } from "./features";
import { tokenSortJaroWinkler } from "./jaro-winkler";
import {
  analyticalNormalizeOwner,
  entityTypeOf,
  isAgencyVariant,
  isInstitutionalBaseline,
  normalizeMail,
  type EntityType,
} from "./owner-normalize";
import type { ParcelSnapshot } from "./types";
import { decodeTpl } from "@/lib/tax/tpl-decode";

export const SIMILAR_NAME_THRESHOLD = 0.92;

export type GraphNodeType =
  | "parcel"
  | "owner_string"
  | "normalized_owner"
  | "mail_address"
  | "township"
  | "map_sheet"
  | "source_document";

export type GraphEdgeType =
  | "owns"
  | "normalizes_to"
  | "similar_name"
  | "possible_related"
  | "same_mail"
  | "adjacent"
  | "same_property_id"
  | "copied_assessment"
  | "in_township"
  | "on_map_sheet"
  | "from_source";

export interface OwnershipNeighbor {
  parcelId: string;
  neighborId: string;
  kind: "knn" | "touch";
}

export interface OwnershipBuildInput {
  snapshots: ParcelSnapshot[];
  features: ParcelFeature[];
  neighbors: OwnershipNeighbor[];
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  score: number | null;
  evidence: Record<string, unknown> | null;
}

export interface TownshipShare {
  municipalityId: string;
  parcelCount: number;
  gisAcres: number;
  taxable: number;
  acreShare: number | null;
  taxableShare: number | null;
}

export interface OwnerEntity {
  id: string;
  nameNormalized: string;
  entityType: EntityType;
  institutionalBaseline: boolean;
  rawExamples: string[];
  parcelCount: number;
  gisAcres: number;
  taxable: number;
  townshipCount: number;
  townshipIds: string[];
  townshipShares: TownshipShare[];
  maxTownshipAcreShare: number | null;
  utAcreShare: number | null;
  utTaxableShare: number | null;
  contiguousComponentCount: number;
  maxContiguousGisAcres: number;
  maxKnnNeighborhoodAcreShare: number | null;
}

export interface OwnershipCluster {
  id: string;
  nameNormalized: string;
  parcelIds: string[];
  gisAcres: number;
}

export interface ConcentrationRow {
  scope: "ut" | "township";
  scopeId: string;
  rank: number;
  nameNormalized: string;
  metric: "gis_acres" | "taxable";
  value: number;
  share: number | null;
  parcelCount: number;
  institutionalBaseline: boolean;
}

export interface OwnershipLayer {
  entities: OwnerEntity[];
  clusters: OwnershipCluster[];
  concentration: ConcentrationRow[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}

function mapSheetOf(tpl: string | null, mapLot: string | null): string | null {
  const decoded = decodeTpl(tpl, mapLot);
  if (!decoded) return null;
  if (decoded.mapJoinKey) return decoded.mapJoinKey.split("|")[0] ?? null;
  return decoded.platCode;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function addNode(nodes: Map<string, GraphNode>, node: GraphNode) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges: Map<string, GraphEdge>, edge: GraphEdge) {
  if (!edges.has(edge.id)) edges.set(edge.id, edge);
}

function unionFind() {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p !== id) {
      const root = find(p);
      parent.set(id, root);
      return root;
    }
    parent.set(id, id);
    return id;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  return { find, union };
}

export function buildOwnershipLayer(input: OwnershipBuildInput): OwnershipLayer {
  const featureById = new Map(input.features.map((f) => [f.parcelId, f] as const));
  const snapshots = input.snapshots;

  type Row = {
    snapshot: ParcelSnapshot;
    feature: ParcelFeature | null;
    ownerRaw: string | null;
    ownerNorm: string | null;
    mailRaw: string | null;
    mailNorm: string | null;
    township: string | null;
    mapSheet: string | null;
  };

  const rows: Row[] = snapshots.map((snapshot) => {
    const ownerRaw = snapshot.ownerNameRaw;
    return {
      snapshot,
      feature: featureById.get(snapshot.parcelId) ?? null,
      ownerRaw,
      ownerNorm: analyticalNormalizeOwner(ownerRaw),
      mailRaw: snapshot.mailAddressRaw,
      mailNorm: normalizeMail(snapshot.mailAddressRaw),
      township: snapshot.municipalityId,
      mapSheet: mapSheetOf(snapshot.tpl, snapshot.mapLot),
    };
  });

  const rowByParcel = new Map(rows.map((r) => [r.snapshot.parcelId, r] as const));

  const touches: Array<[string, string]> = [];
  const knnByParcel = new Map<string, string[]>();
  for (const n of input.neighbors) {
    if (n.kind === "touch") {
      if (n.parcelId < n.neighborId) touches.push([n.parcelId, n.neighborId]);
    } else {
      const list = knnByParcel.get(n.parcelId) ?? [];
      list.push(n.neighborId);
      knnByParcel.set(n.parcelId, list);
    }
  }

  const utGis = rows.reduce((s, r) => s + (r.snapshot.gisAcreageNumeric ?? 0), 0);
  const utTaxable = rows.reduce((s, r) => s + (r.snapshot.assessedTotalValueNumeric ?? 0), 0);

  const townshipTotals = new Map<string, { gis: number; taxable: number }>();
  for (const row of rows) {
    if (!row.township) continue;
    const cur = townshipTotals.get(row.township) ?? { gis: 0, taxable: 0 };
    cur.gis += row.snapshot.gisAcreageNumeric ?? 0;
    cur.taxable += row.snapshot.assessedTotalValueNumeric ?? 0;
    townshipTotals.set(row.township, cur);
  }

  type Agg = {
    raws: Set<string>;
    parcelIds: string[];
    gisAcres: number;
    taxable: number;
    townships: Map<string, { parcelCount: number; gisAcres: number; taxable: number }>;
  };
  const byNorm = new Map<string, Agg>();
  for (const row of rows) {
    if (!row.ownerNorm) continue;
    const agg = byNorm.get(row.ownerNorm) ?? {
      raws: new Set<string>(),
      parcelIds: [],
      gisAcres: 0,
      taxable: 0,
      townships: new Map(),
    };
    if (row.ownerRaw) agg.raws.add(row.ownerRaw);
    agg.parcelIds.push(row.snapshot.parcelId);
    agg.gisAcres += row.snapshot.gisAcreageNumeric ?? 0;
    agg.taxable += row.snapshot.assessedTotalValueNumeric ?? 0;
    if (row.township) {
      const t = agg.townships.get(row.township) ?? {
        parcelCount: 0,
        gisAcres: 0,
        taxable: 0,
      };
      t.parcelCount += 1;
      t.gisAcres += row.snapshot.gisAcreageNumeric ?? 0;
      t.taxable += row.snapshot.assessedTotalValueNumeric ?? 0;
      agg.townships.set(row.township, t);
    }
    byNorm.set(row.ownerNorm, agg);
  }

  const uf = unionFind();
  for (const row of rows) {
    if (row.ownerNorm) uf.find(row.snapshot.parcelId);
  }
  for (const [a, b] of touches) {
    const ra = rowByParcel.get(a);
    const rb = rowByParcel.get(b);
    if (!ra?.ownerNorm || ra.ownerNorm !== rb?.ownerNorm) continue;
    uf.union(a, b);
  }

  const componentParcels = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.ownerNorm) continue;
    const root = uf.find(row.snapshot.parcelId);
    const list = componentParcels.get(root) ?? [];
    list.push(row.snapshot.parcelId);
    componentParcels.set(root, list);
  }

  const clusters: OwnershipCluster[] = [];
  const ownerComponentAcres = new Map<string, number[]>();
  for (const [root, parcelIds] of componentParcels) {
    const norm = rowByParcel.get(parcelIds[0]!)?.ownerNorm;
    if (!norm) continue;
    const gisAcres = parcelIds.reduce(
      (s, id) => s + (rowByParcel.get(id)?.snapshot.gisAcreageNumeric ?? 0),
      0,
    );
    clusters.push({
      id: `cluster:${norm}:${root}`,
      nameNormalized: norm,
      parcelIds,
      gisAcres,
    });
    const list = ownerComponentAcres.get(norm) ?? [];
    list.push(gisAcres);
    ownerComponentAcres.set(norm, list);
  }

  const entities: OwnerEntity[] = [];
  for (const [nameNormalized, agg] of byNorm) {
    const townshipIds = [...agg.townships.keys()].sort();
    const townshipShares: TownshipShare[] = townshipIds.map((municipalityId) => {
      const t = agg.townships.get(municipalityId)!;
      const tot = townshipTotals.get(municipalityId);
      return {
        municipalityId,
        parcelCount: t.parcelCount,
        gisAcres: t.gisAcres,
        taxable: t.taxable,
        acreShare: tot && tot.gis > 0 ? t.gisAcres / tot.gis : null,
        taxableShare: tot && tot.taxable > 0 ? t.taxable / tot.taxable : null,
      };
    });
    const components = ownerComponentAcres.get(nameNormalized) ?? [0];
    let maxKnn: number | null = null;
    for (const parcelId of agg.parcelIds) {
      const neighborhood = [parcelId, ...(knnByParcel.get(parcelId) ?? [])];
      let same = 0;
      let total = 0;
      for (const id of neighborhood) {
        const acres = rowByParcel.get(id)?.snapshot.gisAcreageNumeric ?? 0;
        total += acres;
        if (rowByParcel.get(id)?.ownerNorm === nameNormalized) same += acres;
      }
      if (total > 0) {
        const share = same / total;
        maxKnn = maxKnn == null ? share : Math.max(maxKnn, share);
      }
    }
    entities.push({
      id: `owner:${nameNormalized}`,
      nameNormalized,
      entityType: entityTypeOf(nameNormalized),
      institutionalBaseline: isInstitutionalBaseline(nameNormalized),
      rawExamples: [...agg.raws].slice(0, 3),
      parcelCount: agg.parcelIds.length,
      gisAcres: agg.gisAcres,
      taxable: agg.taxable,
      townshipCount: townshipIds.length,
      townshipIds,
      townshipShares,
      maxTownshipAcreShare: townshipShares.reduce<number | null>((m, s) => {
        if (s.acreShare == null) return m;
        return m == null ? s.acreShare : Math.max(m, s.acreShare);
      }, null),
      utAcreShare: utGis > 0 ? agg.gisAcres / utGis : null,
      utTaxableShare: utTaxable > 0 ? agg.taxable / utTaxable : null,
      contiguousComponentCount: components.length,
      maxContiguousGisAcres: Math.max(...components),
      maxKnnNeighborhoodAcreShare: maxKnn,
    });
  }

  entities.sort((a, b) => b.gisAcres - a.gisAcres || a.nameNormalized.localeCompare(b.nameNormalized));

  const concentration: ConcentrationRow[] = [];
  const pushTop = (
    scope: "ut" | "township",
    scopeId: string,
    metric: "gis_acres" | "taxable",
    rowsInScope: OwnerEntity[],
    total: number,
  ) => {
    const sorted = [...rowsInScope].sort((a, b) => {
      const av = metric === "gis_acres" ? a.gisAcres : a.taxable;
      const bv = metric === "gis_acres" ? b.gisAcres : b.taxable;
      return bv - av;
    });
    sorted.slice(0, 10).forEach((ent, i) => {
      const value = metric === "gis_acres" ? ent.gisAcres : ent.taxable;
      concentration.push({
        scope,
        scopeId,
        rank: i + 1,
        nameNormalized: ent.nameNormalized,
        metric,
        value,
        share: total > 0 ? value / total : null,
        parcelCount: ent.parcelCount,
        institutionalBaseline: ent.institutionalBaseline,
      });
    });
  };
  pushTop("ut", "ut", "gis_acres", entities, utGis);
  pushTop("ut", "ut", "taxable", entities, utTaxable);
  const ownersByTownship = new Map<string, OwnerEntity[]>();
  for (const ent of entities) {
    for (const id of ent.townshipIds) {
      const list = ownersByTownship.get(id) ?? [];
      list.push(ent);
      ownersByTownship.set(id, list);
    }
  }
  for (const [townshipId, list] of ownersByTownship) {
    const tot = townshipTotals.get(townshipId);
    const local = list.map((ent) => {
      const share = ent.townshipShares.find((s) => s.municipalityId === townshipId);
      return {
        ...ent,
        gisAcres: share?.gisAcres ?? 0,
        taxable: share?.taxable ?? 0,
        parcelCount: share?.parcelCount ?? 0,
      };
    });
    pushTop("township", townshipId, "gis_acres", local, tot?.gis ?? 0);
    pushTop("township", townshipId, "taxable", local, tot?.taxable ?? 0);
  }

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  addNode(nodes, {
    id: "source:mrs-ut-valuation-2025",
    type: "source_document",
    label: "mrs-ut-valuation-2025",
  });
  addNode(nodes, {
    id: "source:mrs-ut-parcels",
    type: "source_document",
    label: "mrs-ut-parcels",
  });

  const ownersInTownship = new Map<string, Set<string>>();
  const ownersWithMail = new Map<string, Set<string>>();
  const adjacentOwnerPairs = new Set<string>();

  for (const row of rows) {
    const parcelId = `parcel:${row.snapshot.parcelId}`;
    addNode(nodes, {
      id: parcelId,
      type: "parcel",
      label: row.snapshot.parcelId,
    });
    const taxSource = row.snapshot.taxSourceId ?? "mrs-ut-parcels";
    addEdge(edges, {
      id: `from_source:${row.snapshot.parcelId}:${taxSource}`,
      source: parcelId,
      target: `source:${taxSource}`,
      type: "from_source",
      score: null,
      evidence: null,
    });
    if (row.township) {
      const tid = `township:${row.township}`;
      addNode(nodes, { id: tid, type: "township", label: row.township });
      addEdge(edges, {
        id: `in_township:${row.snapshot.parcelId}`,
        source: parcelId,
        target: tid,
        type: "in_township",
        score: null,
        evidence: null,
      });
    }
    if (row.mapSheet) {
      const mid = `map:${row.mapSheet}`;
      addNode(nodes, { id: mid, type: "map_sheet", label: row.mapSheet });
      addEdge(edges, {
        id: `on_map_sheet:${row.snapshot.parcelId}`,
        source: parcelId,
        target: mid,
        type: "on_map_sheet",
        score: null,
        evidence: null,
      });
    }
    if (row.mailRaw && row.mailNorm) {
      const mailId = `mail:${row.mailNorm}`;
      addNode(nodes, { id: mailId, type: "mail_address", label: row.mailRaw });
    }
    if (row.ownerRaw && row.ownerNorm) {
      const rawId = `owner_raw:${row.ownerRaw}`;
      const normId = `owner:${row.ownerNorm}`;
      addNode(nodes, { id: rawId, type: "owner_string", label: row.ownerRaw });
      addNode(nodes, { id: normId, type: "normalized_owner", label: row.ownerNorm });
      addEdge(edges, {
        id: `owns:${row.snapshot.parcelId}`,
        source: parcelId,
        target: rawId,
        type: "owns",
        score: null,
        evidence: null,
      });
      addEdge(edges, {
        id: `normalizes_to:${rawId}`,
        source: rawId,
        target: normId,
        type: "normalizes_to",
        score: 1,
        evidence: { status: "same_entity", rule: "exact_normalized_string" },
      });
      if (row.mailNorm) {
        const set = ownersWithMail.get(row.mailNorm) ?? new Set();
        set.add(row.ownerNorm);
        ownersWithMail.set(row.mailNorm, set);
      }
      if (row.township) {
        const set = ownersInTownship.get(row.township) ?? new Set();
        set.add(row.ownerNorm);
        ownersInTownship.set(row.township, set);
      }
    }
  }

  for (const [a, b] of touches) {
    const ra = rowByParcel.get(a);
    const rb = rowByParcel.get(b);
    if (ra?.ownerNorm && rb?.ownerNorm && ra.ownerNorm !== rb.ownerNorm) {
      adjacentOwnerPairs.add(pairKey(ra.ownerNorm, rb.ownerNorm));
    }
    if (ra?.ownerNorm && ra.ownerNorm === rb?.ownerNorm) {
      addEdge(edges, {
        id: `adjacent:${pairKey(a, b)}`,
        source: `parcel:${a}`,
        target: `parcel:${b}`,
        type: "adjacent",
        score: null,
        evidence: { sameOwner: true },
      });
    }
  }

  const candidatePairs = new Set<string>();
  for (const owners of ownersInTownship.values()) {
    const list = [...owners];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        candidatePairs.add(pairKey(list[i]!, list[j]!));
      }
    }
  }
  for (const owners of ownersWithMail.values()) {
    const list = [...owners];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        candidatePairs.add(pairKey(list[i]!, list[j]!));
      }
    }
  }
  for (const key of adjacentOwnerPairs) candidatePairs.add(key);

  const mailByOwner = new Map<string, Set<string>>();
  for (const [mail, owners] of ownersWithMail) {
    for (const owner of owners) {
      const set = mailByOwner.get(owner) ?? new Set();
      set.add(mail);
      mailByOwner.set(owner, set);
    }
  }

  const townshipsByOwner = new Map<string, Set<string>>();
  for (const [township, owners] of ownersInTownship) {
    for (const owner of owners) {
      const set = townshipsByOwner.get(owner) ?? new Set();
      set.add(township);
      townshipsByOwner.set(owner, set);
    }
  }

  for (const key of candidatePairs) {
    const sep = key.indexOf("|");
    const a = key.slice(0, sep);
    const b = key.slice(sep + 1);
    const sameTownship = [...(townshipsByOwner.get(a) ?? [])].some((t) =>
      townshipsByOwner.get(b)?.has(t),
    );
    const adjacent = adjacentOwnerPairs.has(key);
    const sharedMails = [...(mailByOwner.get(a) ?? [])].filter((m) =>
      mailByOwner.get(b)?.has(m),
    );
    const sharedMail = sharedMails.length > 0;
    if (!sameTownship && !adjacent && !sharedMail) continue;

    const score = tokenSortJaroWinkler(a, b);
    const agency = isAgencyVariant(a, b);
    if (agency) {
      addEdge(edges, {
        id: `possible_related:${key}`,
        source: `owner:${a}`,
        target: `owner:${b}`,
        type: "possible_related",
        score,
        evidence: {
          status: "possible_related",
          sameTownship,
          adjacent,
          sharedMail,
          note: "Agency/parenthetical variant; not the same entity",
        },
      });
      continue;
    }
    if (score < SIMILAR_NAME_THRESHOLD) continue;
    addEdge(edges, {
      id: `similar_name:${key}`,
      source: `owner:${a}`,
      target: `owner:${b}`,
      type: "similar_name",
      score,
      evidence: {
        status: "similar_name",
        tokenSortJaroWinkler: score,
        sameTownship,
        adjacent,
        sharedMail,
        note: "Potential ownership relationship requiring review; not same_entity",
      },
    });
    if (adjacent) {
      for (const [pa, pb] of touches) {
        const ra = rowByParcel.get(pa);
        const rb = rowByParcel.get(pb);
        if (!ra?.ownerNorm || !rb?.ownerNorm) continue;
        if (pairKey(ra.ownerNorm, rb.ownerNorm) !== key) continue;
        addEdge(edges, {
          id: `adjacent:${pairKey(pa, pb)}`,
          source: `parcel:${pa}`,
          target: `parcel:${pb}`,
          type: "adjacent",
          score: null,
          evidence: { sameOwner: false, similarName: true },
        });
      }
    }
  }

  const names = [...byNorm.keys()];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]!;
      const b = names[j]!;
      if (!isAgencyVariant(a, b)) continue;
      addEdge(edges, {
        id: `possible_related:${pairKey(a, b)}`,
        source: `owner:${a}`,
        target: `owner:${b}`,
        type: "possible_related",
        score: tokenSortJaroWinkler(a, b),
        evidence: {
          status: "possible_related",
          note: "Agency/parenthetical variant; not the same entity",
        },
      });
    }
  }

  for (const [mail, owners] of ownersWithMail) {
    const list = [...owners];
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        addEdge(edges, {
          id: `same_mail:${pairKey(a, b)}:${mail}`,
          source: `owner:${a}`,
          target: `owner:${b}`,
          type: "same_mail",
          score: null,
          evidence: { mail, status: "similar_name", note: "Shared mail; not same_entity" },
        });
      }
    }
  }

  const byProperty = new Map<string, Row[]>();
  for (const row of rows) {
    const gid = row.feature?.multiLotGroupId ?? row.snapshot.propertyId;
    if (!gid) continue;
    const list = byProperty.get(gid) ?? [];
    list.push(row);
    byProperty.set(gid, list);
  }
  for (const [gid, group] of byProperty) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!.snapshot.parcelId;
        const b = group[j]!.snapshot.parcelId;
        addEdge(edges, {
          id: `same_property_id:${pairKey(a, b)}`,
          source: `parcel:${a}`,
          target: `parcel:${b}`,
          type: "same_property_id",
          score: null,
          evidence: { multiLotGroupId: gid },
        });
        const copied =
          group[i]!.feature?.valuationAllocation === "copied_full_assessment" ||
          group[j]!.feature?.valuationAllocation === "copied_full_assessment";
        if (copied) {
          addEdge(edges, {
            id: `copied_assessment:${pairKey(a, b)}`,
            source: `parcel:${a}`,
            target: `parcel:${b}`,
            type: "copied_assessment",
            score: null,
            evidence: { multiLotGroupId: gid },
          });
        }
      }
    }
  }

  return {
    entities,
    clusters,
    concentration,
    graph: { nodes: [...nodes.values()], edges: [...edges.values()] },
  };
}
