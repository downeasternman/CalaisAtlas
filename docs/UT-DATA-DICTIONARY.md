# UT data dictionary (Washington County)

**As of:** 2026-08-14  
**Scope:** Unorganized Territory only. Current-state 2025 valuation + MRS GIS parcels.  
**Policy:** Parsed tax values are left null on parse or join failure. Source strings are preserved. GIS acreage and tax-book acreage are both first-class; disagreements are flagged, not resolved.

This dictionary describes fields as they exist after F0–F7. It does not invent fields the source does not contain.

Snapshots (`parcel_snapshots`, `tax_record_snapshots`) keep original money/acre **strings** and a parallel numeric parse. Null numeric means the source string was absent or not a number — values are never invented. Unjoined tax rows remain in `ut-tax-record-snapshots.json` with `joinedToGeometry: false`.

---

## Sources

| id | Document | As-of | Role |
|----|----------|-------|------|
| `mrs-ut-parcels` | Maine Revenue Services Unorganized Territory Parcels (ArcGIS) | GIS extract date (manifest) | Polygon geometry, TPL, GIS acres, township name |
| `mrs-ut-valuation-2025` | [2025 Washington County Valuation Book (PDF)](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/2025%20Washington%20County_Valuation%20Book.pdf) | 2025-01-01 | Owner, mail, land/building/taxable, exemptions, tax $, acres, account, % ownership, personal property |
| `mrs-ut-map-lot-index-2024` | 2024 Washington County Map/Lot Index (PDF) | 2024-01-01 | Audit crosswalk only; not the assessment source |

**Join:** exact `mapJoinKey` = `WA###|{plan}-{lot}` from TPL `WA…` or PDF `MAP WA### PLAN ## LOT …`. Plat TPL families (`WAP`, `PE`, `HA`, `AR`/`ARP`) do not join.

---

## Record grains

| Grain | File | One row is |
|-------|------|------------|
| Geometry | `data/processed/tax/ut-parcels.geojson` | One GIS polygon |
| Tax lot line | `data/processed/tax/ut-tax-records.json` | One valuation-book lot after multi-lot expansion |
| Joined parcel | `data/processed/tax/ut-parcels-joined.json` → `parcels.json` | One geometry row; tax copied if the key hits |
| Parcel snapshot | `data/processed/analytics/ut-parcel-snapshots.json` | One geometry parcel × tax year × geometry as-of |
| Tax-record snapshot | `data/processed/analytics/ut-tax-record-snapshots.json` | One valuation-book lot, **including unjoined tax** |
| Parcel features | `data/processed/analytics/ut-parcel-features.json` | Deterministic lot-level flags and ratios from a snapshot |
| Valuation scores | `data/processed/analytics/ut-valuation-scores.json` | One scored parcel vs township, acreage-band, and kNN peers |
| Residual catalogue | `data/manifest/ut-valuation-catalogue.json` | Top high/low taxable residuals with peer explanations |
| Spatial features | `data/processed/analytics/ut-parcel-spatial.json` | One geometry parcel: area, compactness, isolation, spatial lag |
| Spatial neighbors | `data/processed/analytics/ut-spatial-neighbors.json` | Directed kNN and touch edges |
| Owner entities | `data/processed/analytics/ut-owner-entities.json` | One row per exact analytical-normalized owner string |
| Ownership graph | `data/processed/analytics/ut-ownership-graph.json` | Typed relationship audit log; similar ≠ same |
| Observations | `data/processed/analytics/ut-observations.json` | Multi-dimension records (parcel/owner/cluster/pattern/absence) |
| Investigator packets | `data/processed/analytics/ut-investigator-packets.json` | Cite-only packet: observation + parcel slice + owner slice |
| Investigator hypotheses | `data/processed/analytics/ut-investigator-hypotheses.json` | JSON hypotheses; no new statistics |

---

## Analytical fields

For each field: type, source, meaning, units, transform, missing semantics, limitations, analysis safety.

### Identity

| Field | Type | Source | Meaning | Units | Transform | Missing | Limitations | Stats? | Derived? | Geo? | Owner? |
|-------|------|--------|---------|-------|-----------|---------|-------------|--------|----------|------|--------|
| `id` | string | GIS TPL slug | Atlas parcel id (`ut-…`) | — | TPL lowercased/slugified | Should not be missing | Duplicate TPL slugs exist | No as a measure | Yes | Key | No |
| `sourceParcelId` | string | GIS TPL | Raw TPL | — | None | Rare | Same collisions as `id` | No | Direct | Key | No |
| `tpl` | string | GIS `TPL` | MRS tax map / plat id | — | Uppercase in decoders | Present on current extract | Family (`wa_map` vs plat) controls join | No | Direct | Yes | No |
| `mapLot` | string | GIS plan/lot | Plan-lot display key | — | Zero-padded plan | Present | Not unique county-wide | No | Direct | Key | No |
| `propertyId` | string \| null | PDF `Property ID` | MRS account property id | — | Digits from `Property ID:` | Null if unjoined | Index year is 2024 | No | Direct | No | Link |
| `accountNumber` | string \| null | PDF `Account ID` | MRS account id (`NNNN-NNNN`) | — | Regex extract | Null if unjoined or parse miss | Not the organized 1–4 digit account | No | Direct | No | Link |
| `municipalityId` | string | GIS `TOWNNAME` | Geometry township slug | — | Slugify METWP name | Should be present | Not always the tax division | Filter | Direct | Yes | No |
| `taxMunicipalityId` | string \| null | Mail line or map-sheet registry | Inferred tax jurisdiction | — | Mail `PLT`/`TWP` heuristic, else sheet | Null if unjoined | Often ≠ GIS township (mail city) | No without caveat | Derived | Weak | No |
| `geocode` | string \| null | GIS `GEOCODE` | MRS town geocode | — | Stringify | Occasional | Not used as join key | No | Direct | Key | No |

### Ownership

| Field | Type | Source | Meaning | Units | Transform | Missing | Limitations | Stats? | Derived? | Geo? | Owner? |
|-------|------|--------|---------|-------|-----------|---------|-------------|--------|----------|------|--------|
| `ownerName` | string \| null | PDF first line after tax block | Owner as printed | — | Trim; no UT sanitize beyond extract | Null if unjoined (not if parse failed on joined rows) | ALL CAPS; `ET AL`; entity suffixes; not a unique person | Only as a grouping key | Direct | No | Yes |
| `ownerNameNormalized` | string \| null | `ownerName` | Lowercase copy | — | `toLowerCase()` | Same as owner | **Not** entity resolution | No | Derived | No | Weak |
| `mailAddress` | string \| null | PDF lines after owner | Mailing address | — | Join remaining lines | Null if unjoined | Not situs | No | Direct | Weak | Link |
| `situsAddress` | null | — | Site address | — | Not in UT valuation extract | Always null in UT | Do not treat as missing building | No | — | No | No |
| `percentOwnership` | string \| null | PDF `Percent Ownership` | Stated ownership share | percent | Strip `%` | Null if unjoined/parse miss | Usually 100; not independently verified | Descriptive only | Direct | No | Yes |

### Assessment (valuation book)

`assessedTotalValue` is **Taxable Value**, not market value and not necessarily land+building.

| Field | Type | Source | Meaning | Units | Transform | Missing | Limitations | Stats? | Derived? | Geo? | Owner? |
|-------|------|--------|---------|-------|-----------|---------|-------------|--------|----------|------|--------|
| `assessedLandValue` | string \| null | PDF `Land Value` | Assessed land | USD | Strip commas | Null if unjoined | `0.00` is a real MRS value | Yes, with vacant split | Direct | No | No |
| `assessedBuildingValue` | string \| null | PDF `Building Value` | Assessed buildings | USD | Strip commas | Null if unjoined | `0.00` usually vacant/land-only, not parse failure | Yes, as class + value | Direct | No | No |
| `assessedTotalValue` | string \| null | PDF `Taxable Value` | Taxable after exemptions | USD | Strip commas | Null if unjoined | Not land+building; exemptions may explain gaps | Yes | Direct | No | No |
| `assessedExemptionValue` | string \| null | PDF `Total Exemptions` | Total exemptions | USD | Null if ≤ 0 | Null if unjoined or $0 | $0 stored as null by policy | Yes when present | Direct | No | No |
| `assessedPersonalPropertyValue` | string \| null | PDF `Personal Property` | Personal property | USD | Strip commas | Null if unjoined | `0.00` retained | Weak | Direct | No | No |
| `taxAmount` | string \| null | PDF `Tax` after taxable | Tax billed | USD | Strip commas | Null if unjoined | Not an assessment | No for value/acre | Direct | No | No |
| `taxYear` | number \| null | Pipeline constant | Assessment year | year | Set to 2025 | Null if unjoined | Single year only | Filter | Direct | No | No |

### Acreage (two sources — do not collapse)

| Field | Type | Source | Meaning | Units | Transform | Missing | Limitations | Stats? | Derived? | Geo? | Owner? |
|-------|------|--------|---------|-------|-----------|---------|-------------|--------|----------|------|--------|
| `gisAcreage` | string \| null | GIS `CACREAGE` else `TOTACRES` | Polygon acreage | acres | Stringify GIS number | Rarely missing | High decimal precision; GIS method unknown | Yes for area | Direct | Yes | No |
| `taxAcreage` | string \| null | PDF `Acres` | Book acreage for the **property block** | acres | Strip commas | Null if unjoined | On multi-lot blocks this is the **group** acreage copied to each lot | Yes only with allocation flag | Direct | Weak | No |
| `acreage` | string \| null | GIS | Alias of `gisAcreage` for display compatibility | acres | Same as GIS | Same as GIS | **Not** tax-book acres | Same as GIS | Alias | Yes | No |
| `acreageDiscrepancy` | boolean | GIS vs tax book | True if both present and \|GIS−tax\| > max(0.5 ac, 10% of tax acres) | — | `hasAcreageDiscrepancy` | False if either missing | Threshold is a convention, not a legal finding | Filter / DQ | Derived | No | No |

Discrepancies are **noted, not corrected**. Do not average the two figures. After the F0 re-parse, **1,546** joined parcels flag a discrepancy; many are real GIS-vs-book differences, and copied multi-lot rows (820) compare **group** tax acres to **lot** GIS acres.

### Multi-lot valuation (F0 rule)

PDF `LOT 10.1 10.3` expands to one tax row per lot. **Full land/building/taxable/tax-acres are copied to each lot** (`valuationAllocation: "copied_full_assessment"`). This preserves map display and source totals. It is **not** an acreage allocation.

| `attrsRaw` key | Meaning |
|----------------|---------|
| `valuationAllocation` | `single_lot` or `copied_full_assessment` |
| `multiLotGroupId` | `propertyId` |
| `lotCountInGroup` | Number of lots in the PDF line |
| `siblingMapLots` | All lots in the block |
| `mapLine` | Raw `MAP WA… PLAN … LOT …` |
| `divisionName` | Valuation-book division header |

Do not treat copied lots as independent samples for value/acre until a later allocation method exists.

### Join / quality

| Field | Type | Meaning | Limitations |
|-------|------|---------|-------------|
| `joinMethod` | enum | `unjoined`, or `property_id` if a tax row with a property id matched the map key, else `map_lot` | Label `property_id` does **not** mean a property-id spatial join; match is `mapJoinKey` |
| `joinConfidence` | number \| null | Parser confidence on the tax block | Typically 0.9 when land+building+taxable exist |
| `taxSourceId` / `geometrySourceId` | string \| null | Provenance ids | — |
| `hasTreeGrowth` | boolean | Always `false` for UT in F0 | Tree Growth is **not** parsed from the UT book |
| `landUse` | null | Not in UT extract | Always null |

### Geometry (GIS properties, not all copied to `parcels.json`)

| Field | Source | Notes |
|-------|--------|-------|
| polygon rings | ArcGIS | Stored as GeoJSON `Polygon`; no validity check in F0 |
| `grantee` | GIS `GRANTEE` | Downloaded; **not joined** to tax owner (often blank) |

---

## Missing-value semantics

| Situation | Fields | Meaning |
|-----------|--------|---------|
| Unjoined geometry (plat TPL or no key hit) | owner, values, tax acres null | No valuation row attached; **not** “valueless land” |
| `Building Value` `0.00` | `assessedBuildingValue` = `"0.00"` | Present zero; typically land-only |
| `Total Exemptions` `0.00` | `assessedExemptionValue` null | Zero exemptions discarded by `normalizeExemptionValue` |
| Tax row with no `geomParcelId` | tax file only | Valuation without a matching GIS polygon |

---

## Known pipeline limitations (not anomalies)

1. Plat-numbered GIS (`WAP`/`PE`/`HA`/`ARP`) cannot match `WA###` valuation keys.
2. Multi-lot copied assessments inflate lot-level value/acre if used naively.
3. `mapJoinKey` last-write-wins can drop colliding tax rows.
4. Duplicate GIS/TPL ids exist.
5. 2024 index vs 2025 valuation year skew.
6. `taxMunicipalityId` mail heuristic ≠ GIS township.
7. GIS acres and tax-book acres measure different things and may disagree.

---

## Parcel features (F2)

Derived from snapshots. No LLM math. Null means “not defined,” not zero.

| Feature | Null when |
|---------|-----------|
| `landPlusBuilding` | land or building missing |
| `taxableMinusLandBuilding` | land, building, or taxable missing |
| `valuePerGisAcre` / `landPerGisAcre` / `buildingPerGisAcre` | no assessment, GIS acres ≤ 0, **or** `copied_full_assessment` |
| `buildingLandRatio` | land missing or ≤ 0, or building missing |
| `vacantFlag` | true only if assessment present **and** building = 0 |
| `unjoinedFlag` | `joinMethod` is `unjoined` or `hasAssessment` is false |

Copied multi-lot rows keep the full land/building/taxable amounts and set per-acre metrics to null.

---

## Valuation scores (F3)

Lot-level comparison to peers. No LLM. No countywide 99th-percentile lists.

**Peer groups (split vacant vs improved):**

| Group | Definition |
|-------|------------|
| Township | Same `municipalityId` and occupancy |
| Acreage band | Township occupancy plus GIS-acre band `<2`, `2–10`, `10–40`, `40–200`, `≥200` |
| kNN | `k=25` nearest eligible parcels of the same occupancy (equirectangular meters at 45°N; ring-average centroid of the outer polygon ring) |

**Excluded from scoring:** `unjoinedFlag`, `copied_full_assessment`, missing taxable value.

**Null / class rules:**

| Rule | Meaning |
|------|---------|
| Peer `n < 12` | Underpowered: percentile and MAD are null; residual vs median may still be stored but is not catalogued |
| MAD = 0 | Repeated-value class; MAD score is null, not ±∞ |
| Residual | Observed − peer median (taxable or value/GIS-acre) |
| Percentile | Share of peer values strictly below the parcel |

Catalogue explanations prefer a powered acreage-band group, then township, then kNN. Copy is a peer comparison, not a finding of error or wrongdoing.

---

## Spatial features (F4)

Geometry in **EPSG:26919** (NAD83 / UTM zone 19N). No Turf. No local Moran’s I.

| Field | Meaning |
|-------|---------|
| `areaM2` / `perimeterM` | Shoelace area and ring length on the projected outer ring (holes subtracted from area, added to perimeter) |
| `compactness` | Isoperimetric quotient `4πA / P²`. Null if area or perimeter is not positive. Circle → 1 |
| `centroidX` / `centroidY` | Area-weighted projected centroid of the outer ring |
| `nnDistanceM` | Distance to the nearest other centroid (isolation) |
| `neighborCountK` | kNN count, `k=25` |
| `touchCount` | Adjacent parcels whose outer rings are within **2 m** (GIS sliver snap) |
| `lagTaxableKnn` / `lagTaxableTouch` | Median taxable of **eligible** neighbors. Null if none, **not** zero |
| `lagResidualTaxableKnn` | Observed taxable − kNN lag. Null for unjoined, copied multi-lot, or missing taxable |

**Eligible lag neighbors:** joined, not `copied_full_assessment`, taxable present. Unjoined plat polygons still receive geometry metrics and neighbor lists; they are not treated as valuation cold spots.

F4 spatial kNN is geometric (all parcels). It is not the F3 valuation kNN (vacant/improved split, equirectangular).

---

## Ownership (F5)

Preserve `ownerNameRaw`. Identity is **exact analytical-normalized string only**. Similar names are never auto-merged.

**Normalize ladder**

1. Display sanitize (`sanitizeOwnerName`)
2. Analytical normalize: uppercase, squeeze space, strip punctuation except `&`, `L.L.C.`→`LLC`, `ETAL`→`ET AL`
3. Entity type tag: federal / state / municipal / conservation / utility / church / llc / trust / estate / individual / unknown
4. `similar_name` if token-sort Jaro-Winkler ≥ 0.92 **and** (same township or adjacent or shared mail). Status is not `same_entity`
5. `possible_related` for agency/parenthetical variants (`MAINE STATE OF` vs `MAINE STATE OF (IF&W)`). Distinct entities.

**Concentration:** UT and township top-10 shares of GIS acres and taxable; contiguous same-owner acres via 2 m touches; kNN neighborhood acre share. Known large holders are `institutionalBaseline` (Typhoon, State of Maine, United States, Baskahegan, IF&W, Woodland Pulp, Penobscot Forest, Maine Coast Heritage Trust) — classes for later false-positive filters, not anomalies.

Graph edges are an audit log of relationships, not a company tree.

---

## Observations (F6)

Deterministic combination scans with recorded parameters. One observation is not always one parcel. No LLM. No PCA. Not findings of error or wrongdoing.

| Type | Trigger (parameters in `OBSERVATION_PARAMS`) |
|------|-----------------------------------------------|
| `similar_name_adjacent` | similar_name **and** adjacent **and** different exact owner |
| `high_local_share_low_vpa` | township acre share ≥ 0.20 **and** vacant value/GIS-acre percentile ≤ 0.10. Institutional holders are `priority: suppressed` |
| `unjoined_plat_hole` | unjoined polygon whose touch neighbors are ≥75% joined `wa_map` (n≥3). Plat-key hypothesis first |
| `township_join_gap` | township join rate ≤ 5% while a touch-adjacent township is ≥90% |
| `copied_multilot_acre_spread` | copied full assessment **and** GIS acre max/min ≥ 3 with range ≥ 10 ac |
| `mail_organized_peer_deviant` | mail city is organized **and** GIS is UT **and** taxable percentile is extreme. Common mail mismatch is not flagged |
| `land_building_vs_taxable_exemption_null` | land+building ≥ 1.25× taxable with gap ≥ $1,000 **and** exemption still null |
| `unjoined_tax_records` | tax rows with no geometry — records without land, not cheap land |
| `vacant_tract_among_improved` | vacant tract ≥ 100 GIS ac with ≥75% improved touch neighbors |

IDs are `obs:{type}:{stable-key}` from inputs + params, not from clock time.

---

## Investigator (F7)

The investigator receives **only** an observation packet. It may not compute new statistics. Missing numbers stay missing.

Output is JSON (`what`, `howUnusual`, `comparisonPopulation`, `classification`, alternatives, falsifiers, `nextData`). Vocabulary: unusual, inconsistent, potentially related, warrants review, possible data artifact. Never fraud or evasion.

`citeOnlyInvestigate` fills that JSON from packet fields. A later LLM call must pass `validateHypothesis` (cited numbers only; forbidden vocabulary).

Classification: `artifact` | `ordinary` | `unexplained` | `institutional_baseline`.

Review narrative: `docs/UT-TOP-FINDINGS.md`.

---

## Safe starting rules for later analysis

- Use `gisAcreage` for geographic density; use `taxAcreage` only with `valuationAllocation`.
- Split vacant (`assessedBuildingValue` = 0) from improved before ranking value.
- Exclude `copied_full_assessment` rows from lot-level value/acre until allocated.
- Treat unjoined plat polygons as a **data-quality class**, not missing owners.
- Do not treat unjoined plat blocks as valuation cold spots.
- Never auto-merge similar owner names; exact normalized string only.
- Treat observations as review packets, not accusations.
- Investigator hypotheses may only cite packet numbers; missing stays missing.
- Never infer wrongdoing from an unusual value.
