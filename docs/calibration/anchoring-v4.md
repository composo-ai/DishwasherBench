# The fourth anchoring: `anchored-v4` on water-5 and the regenerated loads

> **Superseded.** `anchored-v4` was followed by `anchored-v5` (11 October, night), `anchored-v6`
> (the calibration on the owner's first test wash) and `anchored-v7` (the corrected upper
> basket), which is the set the game washes with: `anchoring-v7.md`. The `anchored-v4*` files
> say in themselves that they are superseded and no wash reads them as current. It is also the
> set the prediction for the owner's wash 01 was made with. What follows stands as the history
> of the fourth anchoring.

10 October 2026, evening. This note replaces `anchoring-v3.md` (whose sets and reports are kept in
`packages/calibration/anchors/reports/v3/`). It is still **a provisional anchoring to another
machine's published results**: no wash on the owner's machine exists. Paths written as
`anchors/...`, `scripts/...` and `src/...` are relative to `packages/calibration`.

**Which simulator.** Every wash below ran on `spotless-sim 0.4.1 water-5`, exposure sources
`34816aba7271` (the fingerprint the wash itself records; a frozen copy of 18:21), with the
standard loads as the loading engineers had regenerated them by 18:19 (careful: 116 of 140 items
placed, 88 soiled; careless: 90 placed, the tablet's path blocked by a glass). The loads were
still being regenerated afterwards: **every table here is of those poses and nothing was tuned
to them.** The sets record the water side (`anchoredOn`) and every command now refuses them
when it differs (section 9).

## 1. In brief

| | Published (Bosch eco, detergent D) | anchored-v3 (old loads, water-3) | **anchored-v4** |
|---|---|---|---|
| Eco 50 as written, careful load: crockery | 3.68 | 2.56 | **3.09** |
| of it: plates and bowls / tea items | not published | 5.00 / 0.00 | **5.00 / 0.00** |
| cutlery | 4.67 | 4.81 | **4.50 to 4.57** |
| glass (milk glasses alone) | 3.43 | 4.07 (3.57) | **3.91 to 4.04 (3.5 to 3.7)** |
| all but the pots | 4.17 | 4.05 | **4.06 to 4.12** |
| soiled items clean | | 54.8 of 68 | **63 to 66 of 88** |
| Auto, owner's capsule, careful: soiled items clean | | 38 of 68 | **42 to 44 of 88** |
| egg yolk left / egg items clean | | 10.4 % / 0 of 17 | **11.0 % / 0 of 20** |
| Careful against careless, Auto with the capsule (soiled items clean) | | 38 of 68 against 16 of 64 | **44 of 88 against 13 of 72** (the careless load now blocks the tablet) |

1. **Eco 50 with detergent D agrees with the published class means within their uncertainty,
   with one fitted product parameter** (`liq.xProtease` 0.016; it was 0.013 on the old loads).
   On this load the egg forks (4 of 12 clean) and the milk glasses (5 or 6 of 10) sit at the
   edge of clean, which is where loading can decide; every tea item is still dirty at the
   default bleach rate.
2. **Auto with the owner's capsule is unchanged in kind**: every egg-yolk item and every milk
   glass reads dirty however it is loaded; 3 of 10 tea items come clean. Nothing new was
   learned about the enzyme at 65 C or about what an Auto run does, so nothing was moved. The
   game says so in every report that judges such a soil (section 8).
3. **Loading decides the whole load, on both programmes, and on every starter level** (section
   7). It does not yet decide single mistakes on Auto with the capsule: of the checklist's pairs
   whose check is a score of an egg-yolk plate, every one reads 0 against 0 there (section 6).
4. **Verdicts repeat.** Between two simulation seeds 0.8 of 88 verdicts differ on Auto and 1.3
   on Eco 50 at the official tier; the fast tier agrees with the official on 93 % and 88 %
   (section 7): it is a preview.

## 2. What changed in the model since the third anchoring

Each is a registered parameter with range, confidence tag and source.

| Mechanism | Before | Now | Evidence |
|---|---|---|---|
| Liquid held in a narrow gap: `film.etaGap` (new) | one stirred store with the film that passes | **the liquid in a gap reservoir takes up 2 % of the film that passes**: it is older than the film by the water it holds over 0.02 of the throughput, and it stands (no film shear) | sim-core M7.6 and M10 (`V_g dc/dt = eta_gap Q_pass (c_film - c)`); standards P04: narrow gaps "hold liquid that does not exchange". No measurement: the design's three proposals used 0.1, 0.02 and 0; range 0 to 1 |
| Water-table column `flux` | everything a block received over its own area: twice as high at the official tier | **what lands from the air per area, plus what runs on per width over the reference run** (`film.renewalLength`, 4 mm): the same at both tiers | arithmetic (run-on is a flow per width); the soil side does not read the column |
| Bond of a ketchup-type soil in warm liquor: `soil.adhesionHotFactor` (new, with the two temperatures) | the strength measured in 20 C water at every temperature | **a tenth at 50 C of what it is at 25 C**, log-linear between, constant outside | soils 2.4, 4.1 (Liu et al. 2002, second hand: baked tomato paste "90 % lower after raising hydration temperature from 25 to 50 C"). That the factor holds for every soil of the detach law is this model's estimate (tag ESTIMATED, range 0.02 to 1) |
| What the inspector calls visible | one threshold per class | the same verdict, **and beside it the verdict at both ends of the band** in which a residue of that appearance becomes visible (`ItemWashResult.band`) | standards 10.3 and chemistry 8.6 give ranges, not numbers: coloured 0.02 to 0.05 mg/cm2, translucent 0.1 to 0.3, fat 0.05 to 0.2, a stain 5 to 10 % of an IKW-level stain |
| Protease stability against pH: `liq.proteasePhSlope` | range 0 to 0.8 | default 0.56 unchanged, **range 0 to 0.57**, and the source says that it was not in the fact-checked recommendation and is the steep half of its table | review of the third anchoring |
| Standard load | 97 items; 0.3 g of fat on a knife | **116 items; the platter (5 g of margarine) and, in the half load, the small pot (5 g of minced meat) carry working soils; margarine is 82 % fat and solids** (0.25 g on a knife) | standards 13.3; the pot's amount is the level's (the standard's was not readable) |

**Why the bond matters.** A dried tomato sauce on a well-placed plate came out 98 % removed and
scored 0: with the bond of cold water (0.35 Pa soaked) and the registered scatter from deposit
to deposit (0.5), the strongest fiftieth of the cells withstands a film of 0.8 Pa for ever, and
no jet strikes a reclining plate under vertical nozzles. In liquor at 50 C the soaked bond is
0.035 Pa and a film takes all of it. The dossier ranks dried ketchup as an easy soil ("cleaning
time of order 1 to 10 min under a film"). The first-build tests of `sim-verify` that use baked
sauce as a probe of where jets strike keep the cold-water bond, and say so.

**What was looked for and not built.** The reviewer asked for a dependence of chemistry-limited
soils (egg yolk, starch) on what loading changes, beyond wetting. The dossier does not support
one: removal of the in-machine egg tile "was spatially homogeneous: no region cleaned faster
under the jets" (soils 6.1), film flow carries about 90 % and jets about 10 % at a well-hit spot
(soils 6.6), and the jet share is already in the law (`soil.jetRatio`, the frequency factor).
What loading changes for such a soil is whether a face is wetted and how fresh its liquor is
(`soil.supplyExchange`), and in the model nearly every face is wet all the time: in the nested
bowl of P04 the gap is 2 to 12 mm wide, spray thrown off the rim of the lower bowl lands inside
at 0.03 kg/(m2 s) (droplets followed there, rebounds on or off), and by mass balance that is
ten times what the reaction needs. Whether a real nest of that width is wetted so is a
measurement (section 10). The landing kernel was tested as the cause and is not it.

## 3. The fit (`anchors/scripts/fit.ts`, report `anchors/reports/fit.anchored-v4.md`)

Record: round robin 2022/2023, test appliance, detergent D, on the settled careful load (116 of
140 items), Eco 50 with the main wash at 54 C; four washes per point; the tool's group-mean
likelihood, prior and rule (returned to the default when that costs less than 0.5 log units).

| Parameter | Fitted to | Result |
|---|---|---|
| `soil.egg_yolk.rateRef` (and `soil.milk.rateRef`) | the six in-machine rates, bench tile | **3.4e-5** kg/(m2 s); 0.84 / 1.79 / 0.17 / 2.47 / 0.68 / 4.77 against 0.85 / 1.75 / 0.17 / 2.59 / 0.69 / 4.66 |
| `liq.xProtease` | crockery, cutlery and glass means | scan 0.010 to 0.020: best **0.016**; the default costs 0.685: kept |
| `soil.bleachRate` | the same | scan 0.0008 to 0.0016: best 0.0010 (tea 2.08, crockery 3.69, all 4.17); the default costs 0.026: **returned to 0.0008** (tea 0.05) |

| `liq.xProtease` | Crockery | Plates / tea | Cutlery | Glass | Milk glasses | All | Objective |
|---|---|---|---|---|---|---|---|
| 0.010 | 2.47 | 3.95 / 0.10 | 4.05 | 1.66 | 0.00 | 3.30 | 0.746 |
| 0.012 | 2.99 | 4.79 / 0.10 | 4.31 | 2.15 | 0.70 | 3.65 | 0.319 |
| 0.013 | 3.00 | 4.83 / 0.05 | 4.41 | 2.59 | 1.38 | 3.78 | 0.162 |
| 0.014 | 3.06 | 4.93 / 0.05 | 4.47 | 2.99 | 2.00 | 3.89 | 0.084 |
| **0.016** | 3.09 | 4.98 / 0.05 | 4.51 | 3.61 | 2.95 | 4.01 | 0.061 |
| 0.020 | 3.10 | 5.00 / 0.05 | 4.56 | 4.23 | 3.90 | 4.14 | 0.156 |
| Published | 3.68 | | 4.67 | 3.43 | | 4.17 | |

| `soil.bleachRate` | Tea items | Crockery | All | Objective |
|---|---|---|---|---|
| 0.0008 (default, kept by the rule) | 0.05 | 3.09 | 4.01 | 0.051 |
| 0.0009 | 0.90 | 3.34 | 4.08 | 0.031 |
| 0.0010 (best) | 2.08 | 3.69 | 4.17 | 0.025 |
| 0.0011 | 2.72 | 3.90 | 4.23 | 0.037 |
| 0.0012 | 3.02 | 4.00 | 4.25 | 0.051 |
| 0.0014 | 3.35 | 4.15 | 4.29 | 0.083 |
| 0.0016 | 3.83 | 4.38 | 4.36 | 0.129 |

Tea is no longer all or nothing: on this load the mugs and saucers differ in exposure and come
clean one after another as the rate rises. A rate of 0.0010 reproduces the published crockery
and load means exactly; the tool's rule does not accept a gain of 0.026 log units, so the set
keeps the default and every tea item of the careful load reads dirty on Eco 50. **The tea
verdict is not settled**: the film of the IEC tea is an estimate within a factor of ten.

## 4. Eco 50 on the owner's machine as written (official tier)

| Case | Crockery | Plates / tea | Cutlery | Glass | Milk glasses | Melamine | All | Items clean | Soiled items clean | At the edge | Dry soil left |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Published (Bosch SMV6ECX51E eco, D) | 3.68 | not published | 4.67 | 3.43 | | 4.21 | 4.17 | about 70 % | | | |
| **anchored-v4, detergent D, careful** (4 washes) | 3.09 | 5.00 / 0.00 | 4.50 to 4.57 | 3.91 to 4.04 | 3.5 to 3.7 | 5.00 | 4.06 to 4.12 | 91 to 94 of 116 | 63 to 66 of 88 | 0 or 1 | 0.4 to 0.5 % |
| registry defaults, careful | 1.85 | 3.00 / 0.00 | 3.91 | 1.75 | 0.00 | 5.00 | 3.08 | 73 of 116 | 45 of 88 | 2 | 3.2 % |
| anchored-v4, D, careless (tablet blocked) | 0.36 | 0.58 / 0.00 | 3.16 | 0.35 | 0.00 | 1.00 | 1.88 | 31 of 90 | 13 of 72 | 0 | 47.5 % |
| owner's capsule (12.9 g), careful (2 washes) | 3.29 | 4.95 to 5.00 / 0.7 to 0.8 | 4.47 to 4.54 | 3.57 to 3.63 | 2.8 to 2.9 | 5.00 | 4.04 to 4.09 | 89 to 92 of 116 | 61 to 64 of 88 | 4 or 5 | 0.5 to 0.6 % |
| owner's capsule, careless | 1.65 | 2.67 / 0.00 | 3.99 | 1.75 | 0.00 | 3.17 | 2.98 | 50 of 90 | 32 of 72 | 0 | 19.2 % |

"At the edge": soiled items whose verdict differs between the two ends of the band of
visibility. By soil, detergent D, careful (share of dry mass left; mean score; items clean):
egg yolk 0.1 %, 3.9, 12 of 20 (plates all clean, forks 4 of 12); margarine 0.0 %, 4.7, 13 of 14;
milk 2.6 %, 3.5, 5 of 10; minced meat 5.0, 6 of 6; porridge 4.7, 20 of 21; spinach 5.0, 7 of 7;
tea 17.6 %, 0.0, 0 of 10.

## 5. The owner's Auto 45-65 with his capsule (12.9 g, official tier)

Main wash as written: 63 min, peak 65 C, 35 min above 60 C, pH 10.1 to 10.25, protease 96 to 32
mg/L (96 to 68 with the stable bracket), peracid peak 0.45 mmol/L.

| Case | Crockery | Plates / tea | Cutlery | Glass | Melamine | All | Items clean | Soiled items clean | Strict to lenient | Dry soil left |
|---|---|---|---|---|---|---|---|---|---|---|
| Auto as written, capsule, **careful** (2 washes) | 2.23 to 2.26 | 2.67 to 2.81 / 1.8 to 1.9 | 3.91 to 3.97 | 1.52 | 3.83 to 4.00 | 3.10 to 3.12 | 70 to 72 of 116 | 42 to 44 of 88 | 40 to 46 | 11.3 % |
| the same, **careless** (tablet blocked) | 0.15 | 0.24 / 0.00 | 3.01 | 0.00 | 0.00 | 1.64 | 31 of 90 | 13 of 72 | 13 | 60.6 % |
| Stable bracket (half-life 2 h, assumed), careful | 2.76 | 3.62 / 1.80 | 3.94 | 1.52 | 5.00 | 3.30 | 76 of 116 | 48 of 88 | 45 to 50 | 3.4 % |
| Staged to 55 C, capsule, careful | 2.29 | 3.52 / 0.40 | 3.93 | 1.63 | 5.00 | 3.19 | 74 of 116 | 46 of 88 | 46 to 48 | 3.8 % |
| Auto as written, detergent D (20 g), careful | 1.59 | 2.52 / 0.10 | 3.85 | 1.17 | 3.17 | 2.80 | 65 of 116 | 37 of 88 | 37 | 17.5 % |
| Eco 50, capsule, careful | 3.29 | 4.95 / 0.80 | 4.47 | 3.57 | 5.00 | 4.04 | 89 of 116 | 61 of 88 | 61 to 66 | 0.6 % |

"Strict to lenient": soiled items clean at the low and at the high end of the band of
visibility. By soil, Auto as written with the capsule, careful (left; mean score; clean): egg
yolk 11.0 %, 0.0, 0 of 20; milk 42.6 %, 0.0, 0 of 10; minced meat 0.0 %, 3.0, 2 of 6; porridge
0.0 %, 4.7, 19 of 21; spinach 5.0, 7 of 7; margarine 4.7, 13 of 14; tea 10.4 %, 1.8, 3 of 10.
With the stable bracket: egg yolk 1.2 %, 0 of 20; milk 18.0 %, 0 of 10; minced meat 6 of 6.

**What the evidence carries** is what the third anchoring said: a well-wetted IEC egg plate on
Auto is 90 to 99 % gone and reads dirty, because clean needs the wash to take 1.9 times the mean
depth of the layer and 63 minutes take 1.3 to 1.45. A rate, the oven-drying penalty, the amount
per plate, the length of the wash or the heat stability of the enzyme would each close it, and
no document decides which. **Do not use Auto verdicts for egg, milk and tea**; the game's report
now says which items that concerns.

## 6. Stacking mistakes: the phenomena suite

Reports in `packages/sim-verify/phenomena/reports/`. The suite now washes with the set as the
game reads it (a stale set stops it), at the capsule's 12.9 g, and the head of every report
names the set, the dose and the source.

| Run | Pass | Too small | Too large | Wrong sign | Not covered |
|---|---|---|---|---|---|
| This morning, fast, anchored-v2 on water-3, Auto, detergent D | 15 | 18 | 3 | 3 | 9 |
| **Fast, anchored-v4.owner-capsule, Auto, 12.9 g** (83 washes) | 13 | 17 | 6 | 3 | 9 |
| Fast, anchored-v4, Auto, detergent D, 20 g (83 washes) | 15 | 18 | 4 | 2 | 9 |
| Fast, anchored-v4, **Eco 50**, detergent D (82 washes) | 14 | 16 | 8 | 1 | 9 |
| Official, anchored-v4.owner-capsule, Auto, 12.9 g: P01, P02, P04, P05, P14, P15 only (14 washes) | 1 | 2 | 3 | 0 | |

Not covered (9): drying, redeposition, item motion, flaking, spotting, tablet transport.

On Auto with the capsule the pairs whose deciding check is the score of an egg-yolk plate read
**0 against 0** (P03, P05, P06, P07, P09, P12, P14; a failure, "too small"): the water side
sees the difference in every one (direct-jet time, water received and exchange move in the
expected direction) and the residue moves the right way by a few per cent of the soil, but the
verdict is dirty on both sides. The nested bowl (P04) scores 4 and the shielded spoon (P15) 3
where the checklist expects 0 to 1: their porridge is removed wherever the gap is wetted.
**The same pairs on Eco 50 with detergent D read 5 against 5**: there every egg-yolk plate is
clean on both sides. So on neither programme does a single plate mistake change a score: where
the chemistry is too weak for the plate both sides are dirty, where it is enough both are
clean, and between the two the model has only the wetting of the face to tell them apart, and
it wets nearly every face all the time. What does move scores on Eco 50: forks heads up against
heads down (3.3 against 5.0, P16; a negative control in the checklist, so it reads as a
failure), an upright vessel (P01), a blocked tablet (P25), touching glasses (P40), crowded
cutlery cells (P17, too small).

| Pair (official tier, Auto, capsule) | A | B | What the water side sees | Egg or porridge left, A against B | Score A against B |
|---|---|---|---|---|---|
| P02 plate turned in place | facing | away | direct-jet time 4.8e-4 to 1.4e-4 | 44.9 % against 46.7 % | 0 against 0 |
| P02 plate as it settles reversed | seated | reversed | direct-jet time 0.006 to 0.035 (it lies open to the jets) | 43.1 % against 42.3 % (wrong sign, by 0.8 %) | 0 against 0 |
| P04 nested bowls | apart | nested | direct-jet time 0.070 to 1.9e-5 | 0 against 2e-14 | 5 against 5 |
| P05 platter in front of two plates | at the wall | in front | direct-jet time 1.8e-3 to 1.4e-4 | | 0 against 0 |
| P14 platter face to the wall | inward | to the wall | direct-jet time 0.0067 to 0; renewal 37.8 to 4.3 1/s | 16.5 % against 25.2 % | 0 against 0 |
| P15 nested spoons | opposed | nested | | 0 against 0.05 % | shielded spoon 3 (expected 0 to 1) |

The official tier gives the verdicts of the fast tier on these six (the nested bowl scores 5
where the fast tier has 4). The other eleven resolution-sensitive phenomena were not run at the
official tier: with the machine shared (load average 27 to 38) one official wash of a small
scene took 6 to 8 minutes, and the run was cut to the pairs the review named.

## 7. Seeds, tiers, untouched items, levels (careful standard load; 8 washes per tier and programme)

| | Auto, capsule, official | Auto, capsule, fast | Eco 50, D, official | Eco 50, D, fast |
|---|---|---|---|---|
| Load mean with standard weights (sd of the plain mean over 8) | 3.11 (0.012) | 3.10 (0.007) | 4.09 (0.020) | 4.10 (0.009) |
| Soiled items clean, of 88 | 42 to 44 | 40 to 42 | 63 to 66 | 63 to 66 |
| Verdicts that differ between two simulation seeds (12 pairs) | **0.8, 0 to 2** | 0.5, 0 to 2 | **1.3, 0 to 4** | 2.1, 1 to 4 |
| Distinct items that ever flip | 3 (a knife, a dessert bowl, a saucer) | 2 | 4 (2 glasses, a fork, a knife) | 6 |
| Verdicts that differ between two level seeds | 4.0 | 10.5 | 4.0, 3 to 5 | 8.2 |
| Soiled items within one score of the verdict (score 3 or 4) | 10 to 14 | 11 to 14 | 12 to 14 | 9 to 13 |
| Soiled items at the edge (verdict differs across the band of visibility) | 5 or 6 | 6 to 8 | 0 or 1 | 0 to 2 |
| Largest spread of residue over seeds, share of initial soil | 1.8 % (glass_10) | 2.8 % (fork_08) | 2.8 % (glass_09) | 4.9 % (glass_09) |

| Fast against official, same seeds | Auto, capsule | Eco 50, D |
|---|---|---|
| Verdicts that agree, of 88 | 80 to 85: **91 to 97 %, mean 93 %** | 76 to 80: **86 to 91 %, mean 88 %** |
| Largest class-mean difference | 0.17 | 0.06 to 0.18 |
| What flips | knives 1 to 4, saucers 1 or 2, a soup spoon, a dessert bowl | forks 3 to 5, knives 1 to 4, glasses 1 to 4, a soup spoon |

The fast tier is a preview: on Eco 50, where a quarter of the soiled items are near the
verdict, it disagrees with the official tier on one verdict in eight.

**Untouched items** (two dessert plates turned half a turn; 86 untouched soiled items; level
seeds 1 and 2): no untouched verdict changes at either tier on either programme, and no residue
moves by 2 % of the initial soil (largest: a fork, 1.3 % on Auto at the official tier; 0.13 % on
Eco 50). One or two scores of 86 change by a point.

**Starter levels** (then in `packages/sim-verify/levels/level-contrast.json`, which was made again on 12 October for the course of seven levels on `anchored-v7`; the game's set and dose,
fast tier, the settled loads of both scripted policies):

| Level | Careful: points of offered | Careless | Careful: dirty of placed |
|---|---|---|---|
| Tutorial | 38 of 44 | 32 | 1 of 7 (the mug: a coffee stain at the level builder's floor of 0.01 g) |
| Breakfast | 100 of 610 | 69 | 42 of 68 |
| Weeknight dinner | 66 of 448 | 40 | 21 of 37 |
| Dinner party | 207 of 858 | 174 | 42 of 84 |
| Baking day | 90 of 527 | 69 | 17 |
| Mixed family | 350 of 620 | 280 | 16 |

Careful beats careless on every level, and a test of `sim-verify` reads the report and holds
that while the report is current (the loads were regenerated again after 18:19, so on the
repository as it stands the test reports the report as not current and judges nothing).
**Through the benchmark command itself** (`spotless-bench run --levels tutorial --policies
careful,careless --seeds 1 --tier fast`, default configuration, the repository at 21:35) the
wash runs without a flag and both policies score 38 of 44: the careless policy as it then
loaded made no mistake that costs a point (its glass stood mouth down), and the mug is dirty in
both. On the tutorial the difference between the policies is one upright glass when the
careless policy happens to make it. The levels are far from clean for the careful policy because
most of their soils are judged dirty on Auto wherever they stand: melted cheese, dried egg yolk
and porridge at the levels' loadings, and every stain at the builder's floor (section 10).

**Cost of one cold wash of the careful load** (116 items; Auto, capsule; one wash at a time,
three runs per tier, the machine shared with other work at a load average of 6 to 15):

| Stage (s) | Official, best of three | Official, the three | Fast, best of three | Fast, the three |
|---|---|---|---|---|
| scene | 11.0 | 11.0, 11.4, 19.8 | 5.2 | 5.2, 5.0, 5.0 |
| hydraulics | 0.0 | | 0.0 | |
| exposure (four spray states) | 310.8 | 310.8, 345.6, 400.6 | 45.5 | 45.5, 45.8, 45.9 |
| soil | 1.3 | 1.3, 2.7, 1.4 | 0.3 | 0.3, 0.3, 0.4 |
| replay | 6.9 | 6.9, 13.1, 6.9 | 1.8 | 1.8, 1.8, 1.8 |
| result (with the verdicts at both ends of the band) | 6.1 | 6.1, 8.6, 6.0 | 1.6 | 1.6, 1.6, 1.6 |
| **Total** | **336** | 336, 382, 435 | **54** | 54.4, 54.6, 54.8 |
| Blocks | 1,139,550 | | 292,359 | |
| Peak RSS | 2.0 to 2.3 GB | | 1.1 GB | |

The three runs of a tier gave the same result hash. The load is a third larger than the one the
water-4 figures were taken on (850,717 blocks, 297 s): per block the official wash costs what
it did (0.29 ms against 0.35). A wash whose exposure is cached takes 16 to 28 s at the official
tier and 5 to 9 s at the fast tier; with two washes at once an official wash took 350 to 480 s.
The stages inside the exposure (jets, droplets, film) were not timed again.

## 8. What the game does with it

- `packages/wash-runner/src/defaults.ts` points the owner's machine at
  `anchored-v4.owner-capsule.json` with 12.9 g. The set is current, so **the default wash runs**.
- A report that judges a protein soil (egg, meat, cheese, heated milk, yoghurt) or a stain on Auto carries a note naming the
  items and saying that those verdicts are provisional (`MACHINE_WASH_DEFAULTS.caveats`).
- A report names the items at the edge of clean.
- The default tier is `official`.

## 9. Keeping the set honest

- A set of origin `calibration` records the water side it was fitted on (`anchoredOn`: the
  version string and `exposureFingerprint()`), and `readParamLayerFile` throws
  `StaleParamSetError` when either differs from the code on disk, or when the set does not say.
  The game, `spotless-wash`, the demonstration washes, the phenomena suite, the variance study
  and the anchoring's tables all read sets that way.
- `anchors/scripts/restamp.ts` refuses when the water side differs.
- `anchors/scripts/revalidate.ts` is for a change of the sources that does not change what a
  wash computes: it washes the set's reference again (one fast wash of the careful load) and
  stamps the set with the new fingerprint only when the digest of the result is the recorded
  one.

```
cd packages/calibration
pnpm exec tsx anchors/scripts/check.ts                       # version, water side, ranges, bench anchors
pnpm exec tsx anchors/scripts/fit.ts                         # the fit (40 min); writes anchors/anchored-v4.json
pnpm exec tsx anchors/scripts/make-owner-set.ts              # the two owner-capsule layers
pnpm exec tsx anchors/scripts/revalidate.ts                  # after a change of sources only
pnpm exec tsx anchors/scripts/study.ts anchors/reports/tables.v4.cases.json out.json   # sections 4 and 5
```

## 10. What decides the open points

In this order, with the owner's machine:

1. **Egg-yolk plates and forks on Auto and on Eco 50 with the capsule, photographed.** Decides
   whether Auto verdicts on protein can be used at all.
2. **One egg-yolk plate facing the middle and one turned away, and two nested bowls with
   porridge.** Decides whether a wetted, shadowed face cleans (the model says it does), which is
   what the single-mistake pairs turn on.
3. **One logged Auto run** (power at 10 s, a temperature logger in the upper basket).
4. **Tea cups** with the capsule: the film and the bleach rate.
5. **A stalled lower arm.**

For the levels: the stains carry the builder's floor of 0.01 g, 2 to 11 times a working film
(`soil-quantities.md`), so tea, coffee and wine read dirty anywhere.
