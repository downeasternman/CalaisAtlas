# Washington County UT — top findings for review

**As of:** 2026-08-15  
**Scope:** Unorganized Territory only. 2025 MRS valuation book + MRS GIS parcels (geometry as-of 2026-07-26).  
**How to read this:** These are observations from the deterministic F0–F6 pipeline and cite-only F7 packets. They are **not** findings of error, fraud, or wrongdoing. Unusual means “unlike the stated peer group” or “a data-quality class.” Institutional timber, utilities, conservation, and plat join gaps are expected classes unless a follow-up shows otherwise.

Every number below is copied from `data/manifest/ut-inventory.json`, `ut-valuation-catalogue.json`, `ut-ownership-summary.json`, `ut-spatial-summary.json`, or `ut-observation-catalogue.json`. If a field is not in those files, it is not invented here.

Sources: [2025 Washington County Valuation Book](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/2025%20Washington%20County_Valuation%20Book.pdf); MRS Unorganized Territory Parcels.

---

## 1. What the extract actually contains

| Count | What |
|------:|------|
| 5,396 | GIS polygons (5,347 unique ids; 49 duplicate-id extras) |
| 3,891 | Parsed 2025 tax lots |
| 3,172 | Polygons with owner + taxable (all of them `wa_map` TPL) |
| 2,224 | Polygons with **no** tax join |
| 749 | Tax lots with **no** GIS polygon (“records without land”) |
| 820 | Multi-lot rows carrying a **copied full assessment** |
| 1,546 | GIS acres vs tax-book acres disagree beyond the F0 flag rule |
| 593 | Rows with exemption > 0 |
| 2,052 | Distinct analytical-normalized owner strings |
| 2,559 | Contiguous same-owner clusters |
| 172 | F6 observations (combination scans) |
| 2,352 | Lots scored against peers (joined, not copied) |

Join by TPL family is the structural fact that should change how every later number is read:

| TPL family | Polygons | Joined |
|------------|--------:|-------:|
| `wa_map` | 3,302 | 3,172 |
| `pe_plat` | 948 | 0 |
| `ha_plat` | 463 | 0 |
| `wap_plat` | 437 | 0 |
| `arp_plat` | 184 | 0 |
| `unknown` | 62 | 0 |

Scoring plat polygons as ownerless, as valuation cold spots, or as “missing from the tax roll” would be a pipeline artifact, not a discovery. The 2025 valuation book joins the WA-map numbering system. The other families do not join in this extract.

F3 skipped 3,044 of 5,396 polygons (unjoined or copied-full-assessment). Residual catalogues below are **only** the 2,352 scored lots.

---

## 2. Data-quality cluster: whole townships with 0% tax join

Eleven townships have join rate 0 while a parcel-adjacent township is at least 90% joined. This matches the plat-key hypothesis: geometry uses a numbering system the 2025 WA-map valuation book does not join.

| Township | Polygons | Joined | Adjacent high-join townships (examples) |
|----------|--------:|-------:|-----------------------------------------|
| Prentiss Twp (T7 R3 NBPP) | 439 | 0 | T8 R3 NBPP, Kossuth, T8 R4 NBPP |
| Carroll Plt | 385 | 0 | Kossuth, T6 R1 NBPP, T8 R3 NBPP |
| Grand Lake Stream Plt | 251 | 0 | Greenlaw Chopping, T43 MD BPP, T6 ND BPP, Big Lake |
| Drew Twp | 84 | 0 | T8 R4 NBPP |
| T41 MD BPP | 77 | 0 | T36 MD BPP, T42 MD BPP, Sakom |
| Bancroft Twp | 61 | 0 | T8 R4 NBPP |
| Pukakon Twp | 38 | 0 | Sakom, T6 R1 NBPP |
| T35 MD BPP | 38 | 0 | Devereaux, T30 / T36 / T42 MD BPP |
| T28 MD BPP | 12 | 0 | Devereaux |
| Oqiton Twp | 8 | 0 | Sakom |
| T34 MD BPP | 3 | 0 | Devereaux |

Those eleven observations are 1,396 polygons — about 63% of all unjoined GIS rows sit in townships that failed this adjacent-join rule as a block. Carroll, Prentiss, and Grand Lake Stream alone are 1,075 polygons with no 2025 book join, sitting next to townships that do join.

**Falsify:** A WA-map `mapJoinKey` exists for these polygons in the 2025 book.  
**Do not:** Paint them as ownerless on the atlas or as low-value outliers.

Baring Plt did not fire this rule here: it needs a *touch-adjacent* township with ≥90% join. Absence from this list is not evidence that Baring joins.

---

## 3. Tax lots with no land, and land with no tax

**749** tax-record snapshots have `joinedToGeometry: false`. F6 labels this once (`obs:unjoined_tax_records:ut-2025`), as an **absence**: records without land, not cheap land. They stay in `ut-tax-record-snapshots.json` on purpose. They are not in the parcel residual catalogues because there is no polygon to score.

Separately, **18** township clusters are **unjoined polygons whose touch neighbors are mostly joined**. These are holes *inside* the joined map, not whole plat blocks. Families on those hole polygons in this run were recorded as `wa_map` — so some holes are failed WA-map keys, not only WAP/PE/HA/ARP.

| Township | Hole polygons |
|----------|-------------:|
| Marion Twp | 12 |
| Centerville Twp | 9 |
| Big Lake Twp | 6 |
| Codyville Twp | 5 |
| Forest City Twp | 5 |
| T26 ED BPP | 4 |
| Trescott Twp | 4 |
| Cathance, Devereaux, Kossuth, T18 MD BPP | 2 each |
| Berry, Brookton, Edmunds, Forest, Greenlaw Chopping, T24 MD BPP, T6 ND BPP | 1 each |

**Follow-up:** Pull the PDF map line and GIS TPL for Marion (12) and Centerville (9) before treating them as vacant wilderness. A failed key inside an otherwise joined map is a different class from a whole township on a plat numbering system.

---

## 4. Copied multi-lot assessments on very different GIS acres

**101** property-id groups copy the **full** book assessment onto each lot and have GIS acre max/min ≥ 3 with a range of at least 10 acres. Per-lot value/acre is undefined until allocated. The pipeline does not invent splits. F2 already nulls per-GIS-acre metrics on `copied_full_assessment`. F6 is the reminder that the **same dollar figure** is sitting on both a sliver and a township-sized tract.

Extreme example from the observation evidence (property id `293300127`): **6** lots, GIS acres from **0.0268** to **6,268.19** (ratio ~233,481). Other wide groups include `298100195` (10 lots, 0.68–975.92 ac) and `298170002` (7 lots, 0.42–278.46 ac). Catalogue entries also include groups of 7 lots (`293300050`) and 5 lots (`293300215`).

**Why this is noteworthy:** Ranking those lots by value/acre would manufacture outliers. Spatial lag also skips copied rows (`lagSkipReason: copied_full_assessment` on several of the most isolated centroids, including repeated `ut-wa003011` rows with 61 touches). Isolation plus a copied assessment is still not a scored valuation residual.

---

## 5. Taxable value versus peers (catalogue, not a 99th-percentile witch hunt)

F3 scores **2,352** joined, non-copied lots against township / acreage-band / kNN peers (vacant vs improved never mixed; n < 12 underpowered). Residual = observed − peer median. Catalogue size is 25 high and 25 low. MAD(log) = 0 would mean a repeated-value class; that is not what these rows are.

**High residuals.** Large assessments next to vacant or improved peer medians. Several are known institutional or utility classes:

| Parcel | Township | Owner (raw) | Taxable | Peer median | Residual | Notes |
|--------|----------|-------------|--------:|------------:|---------:|-------|
| `ut-wa033029-1` | Big Lake Twp | VERSANT POWER | $6,827,997 | $11,540 (63 vacant) | $6,816,457 | 2.07 GIS acres, building 0 |
| `ut-wa035011` | Centerville Twp | WORCESTER HOLDINGS LLC | $6,828,340 | $20,370 (33 vacant) | $6,807,970 | 13,609 GIS acres, building 0 |
| `ut-wa036011` | Codyville Twp | TYPHOON LLC | $2,602,420 | $29,255 (20 vacant) | $2,573,165 | 14,747 GIS acres, building 0 |
| `ut-wa036012` | Codyville Twp | BASKAHEGAN CO | $2,191,190 | $29,255 (20 vacant) | $2,161,935 | 11,222 GIS acres, building 0 |
| `ut-wa008012-1` | T25 MD BPP | RTWB LLC | $1,655,710 | $32,000 (kNN 25) | $1,623,710 | 2,724 GIS acres, building 0 |

Further high residuals **without treating owner as known** (catalogue only): Kossuth `ut-wa022015` $1,560,220 vs vacant median $23,640 (n=24); Day Block `ut-wa011011-4` $1,308,970 vs kNN vacant $28,120; Greenlaw Chopping **improved** `ut-wa004026-1` $1,254,630 vs acreage-band median $180,245 (n=36, band <2 ac); Forest City improved `ut-wa0270239` $1,385,920 vs band $311,625 (n=18, 2–10 ac). T24 MD BPP vacant `ut-wa0070113` $614,630 vs township vacant $29,040 has MAD(log) **6.69** — the largest log-scale vacant gap in the high list after the utility/timber rows.

Versant on **2.07 GIS acres** with a **$6.83M** taxable value is the least “vacant timber-like” of the named list: the peer group is vacant Big Lake lots, and utility infrastructure is a different animal. Worcester / Typhoon / Baskahegan are large vacant acreages. None of this is a finding of error. It is “unlike vacant township median.”

**Low residuals (improved peers):**

| Parcel | Township | Owner (raw) | Taxable | Peer median | Residual |
|--------|----------|-------------|--------:|------------:|---------:|
| `ut-wa004017` | Greenlaw Chopping | BREED RICHARD A III & MICHELLE J | $76,700 | $330,820 (band n=12) | −$254,120 |
| `ut-wa027014` | Forest City | WOODIE WHEATON LAND TRUST | $0 | $252,710 (township n=73) | −$252,710 |
| `ut-wa0040215-2` | Greenlaw Chopping | CALDWELL DAVID W & CLIFFORD | $78,430 | $330,820 (band n=12) | −$252,390 |

Further lows from the catalogue (owner not cited here): Forest City `ut-wa027011-5` $22,710 vs township improved $252,710; Trescott `ut-wa0320268` $20,530 and `ut-wa0320298-9` $20,870 vs 40–200 ac improved band $231,620 (n=19). Those Trescott rows sit at percentile 0.0 and 0.053 of that band.

Woodie Wheaton Land Trust: building **$138,320**, taxable **$0**. That pattern warrants review as conservation / current-use / exemption treatment **or** a parse artifact. Exemption is not inferred here. F6’s “land+building ≫ taxable and exemption still null” scan **did not fire** on this extract (593 rows have exemption > 0), so this row is a peer residual, not that combination rule.

Greenlaw Chopping’s two named lows share the same band median ($330,820, n=12). n=12 is the scoring floor. Small peer groups make large residuals easier; they also make the comparison fragile. Check the PDF block before treating either as a valuation story.

---

## 6. Who holds the land (concentration, not a scandal)

Exact normalized owner strings. Similar names were **not** merged. 2,052 entities; Typhoon LLC is the institutional baseline (~27.5% of UT GIS acres).

| Rank | Normalized owner | GIS acres | UT acre share | Parcels | Baseline class? |
|-----:|------------------|----------:|--------------:|--------:|-----------------|
| 1 | TYPHOON LLC | 356,592 | 27.5% | 57 | yes |
| 2 | BASKAHEGAN CO | 41,744 | 3.2% | 31 | yes |
| 3 | DOWNEAST LAKES LAND TRUST | 36,962 | 2.9% | 13 | no (conservation) |
| 4 | VERSANT POWER | 35,478 | 2.7% | 3 | no (utility) |
| 5 | PENOBSCOT FOREST LLC | 27,958 | 2.2% | 25 | yes |
| 6 | STETSON HOLDINGS LLC ET AL | 22,109 | 1.7% | 1 | no |
| 7 | WOOD CRAIG SR | 21,642 | 1.7% | 2 | no |
| 8 | WORCESTER OWEN | 20,961 | 1.6% | 1 | no |
| 9 | WATTS BEN | 20,832 | 1.6% | 1 | no |
| 10 | WOOD TYLER | 20,180 | 1.6% | 1 | no |

Ranks 6–10 are large single-tract (or two-parcel) holders, not county-wide operators. Local share matters more than county share.

F6 `high_local_share_low_vpa` fired **five** times (township acre share ≥ 20% and vacant value/GIS-acre in the bottom 10% of vacant township peers):

- **Suppressed (institutional):** TYPHOON LLC in Big Lake Twp (52.9% of township GIS acres; vacant value/GIS-acre observed 0 vs expected 10,532); UNITED STATES OF AMERICA in Edmunds Twp (37.9%, 33 parcels; observed 0 vs expected 539).
- **Still on the review list:** BOWES BILL in Kossuth (40.4%, 1 parcel; observed 0 vs expected 262); DONNELLY STEPHEN in Brookton (32.5%, 1 parcel; observed 0 vs expected 5,614); VERSANT POWER in T24 MD BPP (61.1%, 1 parcel). Versant’s value/GIS-acre in that packet is **0.28** vs vacant township expected **708.78** (percentile 0.024). Utility corridors can look “cheap per GIS acre” next to camp lots; that is a class, not an accusation. Observed 0 on Bowes/Donnelly means GIS acres are present and taxable/GIS-acre is zero in the feature row — confirm copied-assessment / exemption / parse before treating as a local-share story.

`UNITED STATES OF AMERICA` is the only high-share packet with many member parcels (33). Bowes / Donnelly / Versant T24 are single-parcel local-share flags. Confirm class (timber, conservation, corridor) on the PDF before treating the two personal names as the interesting cases.

---

## 7. Similar names that were not merged

**53** `similar_name` edges and **25** similar-name **and** adjacent clusters. Identity remains the exact analytical-normalized string. Token-sort Jaro-Winkler ≥ 0.92 plus same township or adjacent or shared mail is the edge rule. One `possible_related` edge: `MAINE STATE OF` vs `MAINE STATE OF (IF&W)`.

Examples that warrant review as the same household / name-order / initial, **not** auto-merged entities:

| Pair | JW (token-sort) | Why it is on the list |
|------|----------------:|------------------------|
| `CAMPBELL JANET M & LLEWELLYN C` / `CAMPBELL LLEWELLYN C & JANET M` | 1.0 | Name order |
| `JOYCE CINDY L & JEFFREY W` / `JOYCE JEFFREY W & CINDY L` | 1.0 | Name order; also shared mail |
| `COLE STEPHEN M & BRENDA` / `COLE STEPHEN M & BRENDA S` | 0.984 | Middle initial |
| `WINIARSKI KENNETH J ELAINE M &` / `WINIARSKI KENNETH JR & ELAINE` | 0.980 | JR / token order; adjacent |
| `HAZARD WILLIAM` / `HAZARD WILLIAM J` | 0.975 | Initial; adjacent + shared mail |
| `LORD MAUREEN` / `LORD MAUREEN T` | 0.971 | Initial |
| `BEAL CALVIN S & VONDELL L` / `BEAL VONDELL LEA & CALVIN S` | 0.953 | Name order |
| `DURLING GLEN P` / `DURLING GLENN` | 0.956 | Spelling / nickname |
| `GRIFFEN BRENT` / `GRIFFIN BRENT` | (adjacent cluster) | Possible spelling variant; still two entities |

`DAVIS CONSTANCE` / `MANES CONSTANCE` is a similar-name edge (JW 0.92, same township, shared mail, **not** adjacent). Shared mail without adjacency is in the graph sample; it did not become an F6 `similar_name_adjacent` observation.

The Winiarski cluster is three strings on two adjacent observations. That is the kind of packet an investigator should label ordinary (name-order / JR) unless the PDF shows unrelated people.

---

## 8. Vacant tracts among improved neighbors

Eleven `vacant_tract_among_improved` observations. Three are suppressed as institutional: TYPHOON LLC, BASKAHEGAN CO, `MAINE STATE OF IF&W`. The remaining eight are land-use contrast packets, not valuation residuals:

- DOWNEAST LAKES LAND TRUST; DOWNEAST COASTAL CONSERVANCY; PASSAMAQUODDY INDIAN
- ALL OF IT EXCAVATION LLC; BROOKS AND WALDEN LLC
- BEAL TIMOTHY A & LYDIA J; MOODY JOSHUA; OLIVER KENNETH S & RONALD W

A large vacant tract next to camps is ordinary timber/conservation/tribal/working land in this geography. The scan exists so the map does not treat “building = 0” as an anomaly when the neighbors have buildings. Follow-up is land use, not taxable value.

---

## 9. Spatial context (F4)

All 5,396 polygons projected to EPSG:26919 (NAD83 / UTM 19N). **5,168** have at least one 2 m snap-touch (19,967 touch edges; 134,900 centroid kNN edges). Spatial lag of residual used the **eligible** 2,352-neighbor set, not $0 for unjoined. Unjoined polygons are **not** scored as cold spots (2,224).

Most isolated centroids (distance to nearest centroid, not “islands”):

| Parcel | nn (m) | Touches | Lag skip |
|--------|------:|--------:|----------|
| `ut-wa023013` | 5,023 | 2 | none |
| `ut-wa002011` | 4,773 | 5 | none |
| `ut-wap03016` | 4,503 | 71 | unjoined |
| `ut-wap030122` | 4,503 | 1 | unjoined |
| `ut-arp120dic` | 3,990 | 40 | unjoined |
| `ut-wa005013-1` | 3,292 | 0 | none |

`ut-wap03016` is the teaching example: ~4.5 km from the next centroid, 71 touches, lag skipped as unjoined. Isolation ≠ island. Compactness on that row is 0.208 (circle = 1). `ut-arp120dic` compactness 0.013 with 40 touches is a sliver/corridor shape class, also unjoined. Irregular lots are the baseline, not the exception.

---

## 10. What did *not* fire (also a finding)

- **Mail in an organized town + GIS in UT** is common and was **not** flagged unless taxable percentile was extreme. That scan returned **zero** observations.
- **Land+building ≫ taxable with exemption still null** returned **zero** observations after the F0 re-parse. Gaps that look like missing exemptions should be checked on specific PDF blocks (Woodie Wheaton is the residual example), not assumed county-wide.
- **Baring** did not enter the township join-gap list under the touch-adjacent ≥90% rule.
- **Moran’s I** was not computed (out of F4 scope).
- Owner identity was never fuzzy-merged. Agency variants stay two entities.

Zero hits on those combination scans is a result. It means the extract did not meet those parameter thresholds, not that mail-from-town or exemption structure is uninteresting.

---

## 11. F7 investigator (cite-only)

Each of the 172 F6 observations has:

1. A **packet** — the observation JSON + up to 25 member parcels (acreage, taxable, land, building, exemption, flags) + owner slice + relationship scores + source ids (`mrs-ut-valuation-2025`, `mrs-ut-parcels`).
2. A **hypothesis JSON** — what / how unusual / comparison population / classification / alternatives / falsifiers / next data.

The investigator **must not compute new statistics**. If GIS acres or value/GIS-acre are missing from the packet, the hypothesis says they are not in the packet. Vocabulary is limited to unusual / inconsistent / potentially related / warrants review / possible data artifact.

Classification on this run (172 hypotheses): **131 artifact**, **30 unexplained**, **6 ordinary**, **5 institutional_baseline**. Township join gaps, plat holes, copied assessments, and unjoined tax records classify as **artifact** (131 = 101 copied + 11 township gaps + 18 plat holes + 1 unjoined-tax). Similar-name adjacent with score ≥ 0.999 classifies as **ordinary**. Institutional baseline flags classify as **institutional_baseline**. Everything else stays **unexplained** until a later LLM (same validator) or a human PDF check.

Outputs: `data/processed/analytics/ut-investigator-packets.json`, `ut-investigator-hypotheses.json`, `data/manifest/ut-investigator-summary.json`.

F8 (map overlay) remains gated. Hide institutional classes and unjoined-plat data-quality clusters before any public “research observations” layer.

---

## 12. Suggested review order

1. **Township join-gap cluster** — Prentiss (439), Carroll (385), Grand Lake Stream (251): plat vs WA-map. This is the largest data-quality fact in the extract.
2. **Copied assessment groups** with GIS acre ratios in the hundreds or thousands (`293300127` first) — do not compute value/acre.
3. **Versant `ut-wa033029-1`** — $6.83M taxable on 2.07 GIS acres vs vacant Big Lake median; utility vs vacant peer mismatch.
4. **Woodie Wheaton `ut-wa027014`** — taxable $0 with building $138,320 vs Forest City improved median.
5. **Marion (12) / Centerville (9) unjoined holes** inside joined WA-map.
6. **Greenlaw Chopping band lows** — Breed / Caldwell vs n=12 improved 2–10 ac median $330,820; check PDF before treating as a pair.
7. **Similar-name adjacent pairs** with score ≥ 0.97 (name order / JR / middle initial) if you care about household grouping — still not the same entity in the graph. Start with Campbell, Joyce, Cole, Winiarski.
8. **Bowes (Kossuth) / Donnelly (Brookton)** local acre share only after confirming they are not timber/conservation classes under another string.
9. **Trescott 40–200 ac improved lows** (`ut-wa0320268`, `ut-wa0320298-9`) if the PDF shows buildings that the peer band would expect.

---

## 13. What this document is not

It is not an audit of the State of Maine, not a list of under-assessed owners, and not a map layer. It is a review note so a person can open the valuation book and the GIS TPL on the rows that most warrant a look. Null stays null. Unusual stays unusual.
