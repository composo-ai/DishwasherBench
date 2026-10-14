# Anchoring the wash simulation to published results: `anchored-v2`

> **Record of the build.** The set the game washes with today is `anchored-v7.owner-capsule`,
> described in `anchoring-v7.md`. This note is the method and the second anchoring; the banner
> below says what still stands. The index of the documents is `docs/README.md`.

> **Superseded in part on 10 October 2026, afternoon.** The third anchoring, `anchored-v3` with an
> owner-capsule layer, is described in `anchoring-v3.md`: the spread of a deposit, the enzyme
> law, the supply of liquor, visibility by appearance, fats, soil data, tea and the fit were
> redone, and the registry and the files this note names have changed (the v2 sets are in
> `packages/calibration/anchors/reports/v2/`). Sections 2 (the scenario), 6.3 (facing) and 9.4
> (staleness) of this note still stand; its numbers are those of the second anchoring.

**This is a provisional anchoring to another machine's published results, to be replaced by washes
on the owner's machine.** No wash on the owner's Bosch SMV4HAX40G exists yet. Until one does, the
only numbers that say how well a real dishwasher cleans a known load are those of the European round
robin of 2022/2023 (`docs/research/standards.md` section 7.1), run on a different Bosch (SMV6ECX51E)
on its eco programme with reference detergent D. Paths written as `anchors/...`, `scripts/...`
and `src/...` are relative to `packages/calibration`.

This is the second version. The first (`anchored-v1`, 10 October 2026, early morning) was reviewed
the same day and is withdrawn: it was fitted on a water side that has since changed, it placed two
parameters by judgement or beyond the measured range, and its tea result was an artefact of the
inspector. Section 10 lists what the review found and what was done about each finding. The files of
the first version are kept in `packages/calibration/anchors/reports/v1/` for the record only.

**Which simulator these numbers belong to.** Everything below was computed on one frozen copy of the
repository taken at 10:52 on 10 October 2026: simulator `spotless-sim 0.3.2 water-3`, water sources
`sha256:97aa4d392843040da01252e2c616e5b0bced8cb5f608159e7aff197d8bab94d5` (the hash of the 176
source files of the packages that compute exposure, `anchors/src/water.ts`), with the soil-side
changes of section 3. The water side was being changed by its own engineers while this was written
(at least five times between 09:00 and 10:50, three of them under an unchanged version string), so a
copy was frozen to have one
consistent water side to fit on. **The set is valid for that water side only.** It records the
version and the hash (`anchoredOn` in the file) and `anchors/scripts/check.ts` fails when the
sources on disk differ. Section 9.4 says what a change of the water side has cost so far.

The set is `packages/calibration/anchors/anchored-v2.json` (the registry's parameter-set format).
**The registry defaults are unchanged**: every correction is a registered parameter whose default
reproduces the first build.

## 1. In brief

Eco 50 on the owner's machine as written, the settled careful load (97 of the 140 items), 20 g of
reference detergent D, official tier; mean of four washes (level seeds 1 and 2, simulation seeds 1
and 2). Class means are of whole-number IEC scores with the item types weighted as in the standard
load (section 2.1).

| | Published (Bosch eco, detergent D) | Defaults | **Anchored** | Anchored, all milk solids to digest |
|---|---|---|---|---|
| Crockery | 3.68 | 1.40 | **2.56** | 2.56 |
| of it: plates and bowls / tea items | not published | 2.73 / 0.00 | **5.00 / 0.00** | 5.00 / 0.00 |
| Cutlery | 4.67 | 3.85 | **4.59** | 4.59 |
| Glass | 3.43 | 1.75 | **3.49** | 1.75 |
| Melamine (2 plates here) | 4.21 | 4.75 | **5.00** | 5.00 |
| All items but the pots | 4.17 | 2.86 | **3.86** | 3.60 |
| the same without the tea items | | 3.32 | **4.47** | 4.17 |
| Share of items clean (game's rule) | about 70 % (dossier's estimate) | 55 % | **73 %** | 69 % |
| Soiled items clean, of 68 | | 31.3 | **48.0** | 45.5 |

How to read it:

- **Cutlery and glass agree with the published means; that is what one parameter was moved for**
  (the protease level, to the top of the range the in-machine data cover), and glass agrees only
  under one of two readings of how much of the milk has to be digested (last column). The agreement
  is a consistency check on a regime, not a validation.
- **Crockery does not agree and is not claimed to.** Every plate and bowl comes out at 5 and every
  tea item at 0. The published 3.68 lies between; the record cannot say how its deficit divides
  between tea and plates, the four numbers that decide tea are all estimates, and the fit no longer
  reads tea at all (section 4.1). The published mean does imply that real tea items average at
  least 2.2 on this machine, so the model's 0 is wrong in a known direction.
- **Nothing in the model lies between "gone" and "patch"**: of 97 items about 70 are at 5.

## 2. Scenario STD-EU-13 on the owner's machine

### 2.1 The load: 97 of 140 items

The poses are those of the settled careful IEC load of `packages/loader/loads/iec-13-careful.json`,
frozen as `packages/calibration/anchors/loads/iec-13-careful.wash.json`. The loading physics placed
97 of the 140 items of the standard load. Missing:

| Class (standards 5.1) | Standard, 13 place settings | In the load | Missing |
|---|---|---|---|
| Crockery | 40 | 22 | 2 of 7 dinner plates, 2 of 7 dessert plates, 1 of 6 soup plates, 4 of 7 mugs, 4 of 6 cups, 4 of 6 saucers, the oval platter |
| Cutlery | 69 | 65 | 2 forks, 1 knife, 1 dessert spoon |
| Glass | 21 | 8 | 6 of 13 glasses, 6 of 7 glass dessert bowls, the glass bowl |
| Melamine | 8 | 2 | 4 of 6 plates, both bowls |
| Pots | 2 items, 8 assessments | 0 | both |

- The pots class cannot be compared at all, and melamine rests on two plates.
- The upper basket holds 16 items, about a third of a full standard load: glasses, cups and mugs
  are better exposed than in a real test.
- The composition differs (7 of 22 crockery items carry tea against 19 of 40 in the standard; 7 of
  8 glass items are milk glasses against 13 of 21), so class means are compared after weighting
  each item type by its count in the standard load (`classMeans` in `anchors/src/objective.ts`).
  The published overall mean is compared without the pots: (4.14 x 146 - 3.62 x 8) / 138 = 4.17.
- **The weighting hides things, so the tables also give them unweighted.** The weighted glass mean
  gives 7 of 20 weights to the one glass dessert bowl, which scores 5: (13 x 2.68 + 7 x 5.00) / 20 =
  3.49. The milk glasses alone are at 2.68. The cutlery mean is carried by 28 unsoiled pieces at
  exactly 5.00: the soiled pieces alone are at 4.28. The published 4.67, if the unsoiled pieces
  averaged 4.8 to 5.0, implies soiled cutlery at 4.4 to 4.6.

### 2.2 Soil quantities, covered areas and ageing

Every amount, area and ageing is set from the dossier's working quantities (standards 13.3, 4.1,
4.4; soils 8.1), not taken from the load file (`STD_EU_13_SOILS` in `anchors/src/scenario.ts`, with
the source of each number). Region areas are those of the catalogue shapes as the scene grids them.

| Item | Soil | Load file (first build) | Working quantity used here |
|---|---|---|---|
| Dinner plate | Egg yolk | 3 g wet on 60 % of the well: 1.5 g dry on 160 cm2, 9.4 mg/cm2 | 3 g wet on the well, rim free: 1.5 g dry on 266 cm2, 5.6 mg/cm2 |
| Dinner plate | Minced meat | 630 mg dry on 160 cm2 | 630 mg on 266 cm2, 2.4 mg/cm2 |
| Dessert plate | Egg yolk | 1.0 g dry on 91 cm2 | 1.0 g on 152 cm2, 6.6 mg/cm2 |
| Dessert plate, melamine plate | Spinach | 2 g at an assumed 25 % solids: 500 mg | 2 g at 8 % solids: 160 mg |
| Melamine plate | Minced meat | 420 mg on 109 cm2 | 420 mg on 182 cm2 |
| Soup plate | Porridge | 240 mg on 148 cm2 | 240 mg on 246 cm2, 0.98 mg/cm2 |
| Glass dessert bowl | Porridge | 160 mg on 100 cm2 | 160 mg on 167 cm2 |
| Glass | Milk, microwaved | 10 g at an assumed 50 % solids: **5.0 g dry**, heat category "baked", on 106 cm2 | 10 mL at 10.4 % solids is **1.07 g**. Two readings, both run (below): the **film**, 0.50 g, and the **full** 1.07 g; category "cooked", on a quarter of the interior (53 cm2) |
| Cup, mug, saucer | Tea | 0.01 g at 1 %: **0.1 mg** per item | a nominal film of 0.5 g/m2 (soils 8.1: "under 1") on the 60 % the tea wetted: **3.6, 6.1 and 1.5 mg** |
| Fork | Egg yolk | 150 mg dry on 11 cm2 | 150 mg on the tines, 18.2 cm2, 8.2 mg/cm2 |
| Soup spoon | Porridge | 24 mg on 14.5 cm2 | 24 mg on 19.4 cm2 |
| Knife | Margarine | 300 mg on 23 cm2 | 300 mg on 19.5 cm2 (that knives carry margarine is recalled, not verified) |
| All | | 2 h old, dried at room flux only | 3 h old (2 h in the cabinet at 80 C, about 40 min cooling), dried by the cabinet |

**The two readings of the milk.** Standards 13.3 states the solids: 1.07 g per glass. That the
lactose and the minerals (53 %) dissolve at once and only the protein with its fat (47 %, 0.50 g)
has to be digested is this anchoring's assumption (soils R4), not a dossier value. It decides the
film loading by a factor of 2.1 and, with it, whether the one parameter the standard load moves is
moved at all (section 4.2). The set is fitted under the film reading for a stated reason: with all
the solids as a protein film, no protease level inside the measured range lifts a single glass off
score 0, against a published glass class of 3.43; the published result itself speaks against that
reading (or for a milk law faster than the egg-yolk one, which is the same thing in this model).

Three defects of data elsewhere are worked around here, not fixed (section 9.3): the catalogue gives
`iec_milk`, `iec_spinach` and `iec_tea` no solids fraction, so the wash takes the default of the
model class that stands for them (0.5, 0.25, 0.01); the scenario gives the wash the dry mass divided
by that fraction.

**A soil is judged by the threshold of the model class that stands for it, not by its own
appearance** (standards 10.3): milk by the egg-yolk threshold (0.035 mg/cm2) where the dossier lists
milk protein as translucent (0.1 to 0.3), spinach by the starch threshold (0.1) where it lists it as
strongly coloured (0.02 to 0.05). Changing that needs a threshold per catalogue soil, which is the
catalogue's and the orchestrator's (section 9.3). For the milk it works against the glasses: a
translucent threshold would make them cleaner.

### 2.3 Programme, detergent and dose

- Reported numbers: the owner's **Eco 50** (`eco_50`), as written in `@spotless/machine`.
- The fit used the literature record's course: Eco 50 with the main wash limited to 54 C and the
  final rinse to 48 C, the temperatures measured on the round robin's machine (standards 3.2). The
  step lengths are the owner's; the round robin's eco took 270 min.
- Detergent: reference detergent D, which is what the liquor model's defaults are. **The dose is
  uncertain and matters.** 20 g is the IKW dose for type D; the Edition 4 dose is not in the open
  text (standards 3.3) and the Edition 5 rule gives 14.5 g. With 14.5 g the anchored set gives 3.53
  in place of 3.86 (cutlery 4.24, glass 2.72, 37 of 68 soiled items clean in place of 48): the
  dose is worth nearly half of what the fitted parameter is worth.

## 3. What was corrected on the soil side

Each correction is a registered parameter next to the code that reads it, with a default that
reproduces the first build, and each has tests (section 9.2). None is fitted.

| Parameter | Default | Anchored | What it does | Evidence |
|---|---|---|---|---|
| `soil.subCellCv` | 0 | 0.3 | The loading inside one deposit is log-normal about its mean. A zero-order law (protein, starch, solubles) takes a depth everywhere, so the thin places are bare first and the rate falls with the share still covered (`sim-soil/src/spread.ts`). It replaces the lumped decay factor, which the first build applied on top of a loading it had already distributed. The inspector counts the share of each element above the visibility threshold | soils 7.5 E6, 7.7, R3; 6.1; standards 10.2 |
| `soil.loadScale` (new in v2) | 0 | 2 mm | The scatter of the loading between deposits (`soil.loadCv`) is drawn on a 2 mm lattice in the frame of the item, not per soil cell. Per cell, the thick places of a soil were single cells of 1 mm2 at the official tier and of 4 mm2 at the fast tier: two different fields, and on a thinned film hundreds of isolated one-cell "specks" | soils 7.7; standards 10.1 requirement 3; review |
| `soil.heldFilmCapacity` (new in v2) | 0 (no limit) | 0.02 kg/kg | A film left standing on a deposit once the spray that fed it has stopped can take up only so much soil (20 g per litre of film, 1 to 2 g/m2 per stop). The first build let a film that nothing renews remove soil at the rate of the spray that left it for its whole hold time (15 to 30 min on plates) | chemistry 10.2; soils 6.1; mass balance (a 0.1 mm film cannot dissolve a 56 g/m2 layer); an estimate, range 0.005 to 0.1 |
| `soil.heatDryingFactor` | 0 | 80 | The heat step of a heat history evaporates at this multiple of the room flux: every oven-dried soil starts dry and pays its lag | standards 4.1; soils 5.0 |
| `soil.tea.visibleFraction`, `soil.tea.visibleMass` | 0.1, 3.5e-4 kg/m2 | 0, 5e-5 kg/m2 | A stain is judged against one level for every element: 10 % of the nominal tea film of the working quantities. See below | soils R7 (a share: "more than about 10 % of the original chromophore"), chemistry 8.6 ("5 to 10 % of an IKW-level stain") |
| `soil.amountCv` | 0 | 0.05 | The dry mass of each soil record scatters about the stated amount, per item, from the level seed | standards 13.5 (3 to 7 %) |

**The inspector with sub-element coverage** (`packages/inspector/src/inspect.ts`; standards 10.2).
The first version of this rule depended on the mesh: the residue of one element counted only when
element area times covered share reached a 0.3 mm speck, so a 1 mm2 cell needed 7 % coverage and a
4 mm2 cell 1.8 %, sub-speck area was dropped per element, and a connected patch of low-coverage
cells of any extent counted as one dot. Now every cut is made on a physical size, the dot of 2 mm:

- an element is seen when the visibly soiled area of a dot-sized patch about it (the element and as
  much of its neighbours as fills the dot) is at least a 0.3 mm speck;
- a connected region no larger than a dot is one speck; the sparse residue of a soil that leaves
  bare patches (covering less than half of the area it is seen on) is one fragment per dot, each a
  speck; anything else is a patch counted by area;
- **a film thinned everywhere by the same share (a stain, an emulsified fat film) is never broken
  into specks**; it is judged by the area above the threshold, with the soft band the spread of the
  loading gives.

A test holds the same residue field on 1 mm2 and on 4 mm2 elements to the same area, specks, score
and verdict. Without the soil model's rule (the defaults) the inspector is unchanged.

**The tea threshold, and why it is below the range of standards 10.3.** Standards 10.3 lists a tea
film as visible above 0.02 to 0.05 mg/cm2. The nominal tea film of the working quantities is 0.05
mg/cm2 (0.5 g/m2), so that range is 40 to 100 % of an unwashed stain: by it an unwashed tea cup is
nearly clean. Soils R7 and chemistry 8.6 give a share of the stain, 5 to 10 %. The set takes 10 %
of the nominal film (0.005 mg/cm2) as one level for every element. The mass of a stain is nominal;
only the ratio of threshold to film loading means anything. (The first version cited R7 for an
absolute level; R7 states a share.)

**Withdrawn after the review: the bake reference** (`soil.egg_yolk.bakeReference`,
`soil.starch.bakeReference` = 0.2 in the first version). It rested on the monitor tile of the
in-machine study having been heat-aged like an IEC soil. Neither dossier says so (soils 2.2 and 6.1
describe a sprayed, dried tile; soils 8.3 lists "egg yolk, dried" apart from "baked" and calls the
bake multipliers "estimated placeholders"). The parameters stay in the registry at 0; the set
follows the dossiers as written, in which an IEC protein soil (2 h at 80 C) runs at 0.84 of the
tile's rate. **Both readings:**

| | Tile dried (the dossiers as written; in the set) | Tile heat-aged (the first version) |
|---|---|---|
| Six in-machine rates with the default rate, % per minute | 0.75, 1.49, 0.15, 2.06, 0.57, 4.03: one of six just outside its tolerance (2.06 against 2.07), all 12 to 20 % low | 0.63, 1.26, 0.12, 1.74, 0.48, 3.42: five of six out |
| Fitted protein rate | 3.54e-5 kg/(m2 s) | 3.58e-5 |
| Rate of an oven-dried IEC protein soil against the tile | x 0.84 | x 1.00 |
| Eco 50, anchored: cutlery / glass / all / soiled items clean | 4.59 / 3.49 / 3.86 / 48.0 | 4.68 / 3.96 / 3.97 / 51.0 |

The owner's egg-yolk tiles, air-dried against oven-dried, settle it.

**Not corrected, and why.** Baked and microwaved soils still use the protein law with a bake
factor, and minced meat and spinach still stand in the egg-yolk and starch classes: the dossier's
rows for them are estimates, chemistry 10.6 gives the opposite ranking for milk, and class means
cannot arbitrate.

**The liquor** was checked again against chemistry 10.12 and is not changed. Protease and pH agree.
The peracid lasts longer in a wash than in the dossier's table (0.075 against 0.03 mmol/L at 50 min)
because the table was made with 12 g/L of soil in the liquor and a wash of this load has 2 to 5;
the decay law is the dossier's (5.8e-4 1/s at 50 C plus 2e-5 m3/(kg s) times the soil), and the
package's own test reproduces the table with the table's soil.

## 4. The fit

### 4.1 What is fitted to what

Two parameters, each fitted to the one thing that identifies it (`anchors/scripts/fit.ts`).

| Parameter | Fitted to | How | Result |
|---|---|---|---|
| `soil.egg_yolk.rateRef` | The six in-machine egg-yolk rates (soils 6.1), nothing else | One-dimensional search on the bench tile, no wash | 3.0e-5 to **3.54e-5** kg/(m2 s) (x 1.18; range 1e-5 to 1e-4). The dossiers themselves give 3e-5, 3.7e-5 and "about 4e-5" from the same data |
| `liq.xProtease` | The class means of the literature record | A scan from its default 0.010 to **0.020 kg/kg**, the mean over level seeds 1, 2 and simulation seeds 1, 2 at every point; the calibration tool's prior and its rule (returned to the default when that costs less than 0.5 log units) | **0.020**, the upper end of the scan (x 2.0; registered range 0 to 0.05) |

Not searched, at their defaults (the first version had moved or kept them):

- `soil.bleachRate` (the first version kept x 1.51 "by judgement" against the tool's rule). The
  tea result depends on (rate x peracid dose) against ln(film loading / threshold) and on the
  scatter of the loading: four estimates with no published number behind any of them. The rule is
  now followed, and **the fit does not read tea**: every tea item is set to the middle of the scale
  in the class terms and the crockery term carries 0.69 more uncertainty for it (sd 1.31).
- `soil.supplyRenewal`: halving or doubling it moved no class mean by 0.01.

**Why the scan stops at 0.020.** The rate law is written in g/L of the protease prill of the
in-machine study, measured from 0.02 to 0.10 g/L. 0.020 kg/kg is 0.10 g/L at the wash concentration
of 5 g/L: the top of the data. There the response is 1.39 times that at the reference 0.06 g/L,
against a maximum of 1.54; the first version's 0.0257 (0.126 g/L, 95 % of the maximum) was beyond
the data and on the saturated branch, where the model no longer answers to the enzyme level.

**The record** (`anchors/records/std-eu-13.round-robin-ta.detergent-d.literature.json`) is a valid
wash record of the calibration tool with the class means in a field of its own (`aggregates`). The
uncertainty of each class mean is, in quadrature: the published spread over runs and laboratories;
0.3 for the other Bosch; 0.3 for the reconstructed load; 1.5 / sqrt(n) for the few items; for
crockery the tea term. The record carries the tool's weight for a literature record, 0.25.
Melamine is reported and not fitted (two plates); the ranking term
is cutlery above crockery and glass.

### 4.2 The scan, under both readings of the milk

The record's programme (Eco 50 with the main wash at 54 C), four washes per point, whole-number
scores, standard weights.

| `liq.xProtease` | Crockery | of it plates, tea | Cutlery | Glass, milk as film | Milk glasses alone | Glass, all milk solids | All, film | Soiled items clean | Objective, film | Objective, full |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.010 (default) | 1.45 | 2.83, 0.00 | 3.88 | 1.75 | 0.00 | 1.75 | 2.90 | 43 % | 0.695 | 0.695 |
| 0.012 | 1.88 | 3.67, 0.00 | 4.10 | 1.75 | 0.00 | 1.75 | 3.15 | 44 % | 0.467 | 0.532 |
| 0.014 | 2.15 | 4.20, 0.00 | 4.21 | 2.42 | 1.04 | 1.75 | 3.38 | 47 % | 0.255 | 0.469 |
| 0.016 | 2.47 | 4.82, 0.00 | 4.36 | 2.73 | 1.50 | 1.75 | 3.60 | 55 % | 0.124 | 0.412 |
| 0.018 | 2.55 | 4.96, 0.00 | 4.47 | 2.91 | 1.79 | 1.75 | 3.70 | 58 % | 0.067 | 0.379 |
| **0.020** | 2.56 | 5.00, 0.00 | 4.55 | 3.26 | 2.32 | 1.75 | 3.80 | 62 % | **0.034** | 0.349 |
| Published | 3.68 | | 4.67 | 3.43 | | 3.43 | 4.17 | | | |

- **Milk as film (0.50 g): the default costs 0.66 log units, over the rule's 0.5. Kept at 0.020.**
- **All milk solids (1.07 g): the default costs 0.35. By the rule the parameter returns to its
  default**, and no glass leaves score 0 at any point of the scan.

The two ends of the scan washed again at all sixteen combinations of level seeds 1 to 4 and
simulation seeds 1 to 4 (`anchors/reports/fit.endpoints-16-washes.md`) give the same decision under
the film reading: the default costs 0.65.

So **`liq.xProtease` is identified only jointly with the milk film mass** (and with the spread of
the loading, `soil.subCellCv` and `soil.loadCv`, which set how long the last specks take, and with
the dose of section 2.3). The objective falls all the way to the upper end of the scan under both
readings: the standard load would take more enzyme than the bench data cover. The margin by which it
is kept is small. Read the value as "the reference detergent is worth about as much as the top level
of the in-machine study, if the film reading of the milk is right", not as a measurement.

### 4.3 Bench anchors under the set

The six in-machine egg-yolk rates (% of the tile per minute; tile dried):

| Case | Published | Tolerance | Defaults | Anchored |
|---|---|---|---|---|
| 30 C, pH 10.5, 0.06 g/L | 0.85 | 0.17 | 0.75 | 0.89 |
| 55 C, pH 10.5, 0.06 g/L | 1.75 | 0.35 | 1.49 | 1.75 |
| 55 C, pH 10.5, 0.02 g/L | 0.17 | 0.05 | 0.15 | 0.17 |
| 55 C, pH 10.5, 0.10 g/L | 2.59 | 0.52 | 2.06 (out) | 2.44 |
| 55 C, pH 9.5, 0.06 g/L | 0.69 | 0.16 | 0.57 | 0.67 |
| 55 C, pH 11.5, 0.06 g/L | 4.66 | 0.93 | 4.03 | 4.74 |

The IKW programme under the set leaves 93 % of the egg yolk, 92 % of the starch mix, all of the
baked minced meat and 69 % of the tea (each must leave a residue; the dossier's own model run
removes far more of the starch, 79 %, which is not pursued here).

## 5. Results under the anchored set

### 5.1 Eco 50, as written

Mean of four washes (two for the rows with another dose, which compute their own exposure). Class
means with the standard weights; `anchors/scripts/tables.ts`, output in
`anchors/reports/tables.md`.

| Case | Crockery | Cutlery | Glass | Melamine | All but the pots (sd over the washes) | Share of items clean | Items clean, of 97 | Soiled items clean, of 68 | Dry soil left |
|---|---|---|---|---|---|---|---|---|---|
| Published, Bosch SMV6ECX51E eco, detergent D | 3.68 | 4.67 | 3.43 | 4.21 | 4.17 | about 70 % (estimate) | | | |
| **Eco 50, defaults** | 1.40 | 3.85 | 1.75 | 4.75 | 2.86 (0.03) | 55 % | 60.3 | 31.3 | 3.5 % |
| **Eco 50, anchored** | 2.56 | 4.59 | 3.49 | 5.00 | 3.86 (0.05) | 73 % | 77.0 | 48.0 | 1.5 % |
| Eco 50, anchored, all milk solids | 2.56 | 4.59 | 1.75 | 5.00 | 3.60 (0.04) | 69 % | 74.5 | 45.5 | 4.0 % |
| Eco 50, anchored, tile heat-aged | 2.56 | 4.68 | 3.96 | 5.00 | 3.97 (0.06) | 76 % | 80.0 | 51.0 | 1.4 % |
| Eco 50, anchored, 14.5 g of detergent | 2.44 | 4.24 | 2.72 | 5.00 | 3.53 (0.05) | 62 % | 66.0 | 37.0 | 1.7 % |

### 5.2 The same by what the class means hide

| Case | Soiled items only: crockery | cutlery | glass | all | Milk glasses alone | Tea items | Crockery without tea | All without the tea items | Mean over the 97 items |
|---|---|---|---|---|---|---|---|---|---|
| Eco 50, defaults | 1.40 | 2.96 | 1.75 | 2.25 | 0.00 | 0.00 | 2.73 | 3.32 | 3.23 |
| Eco 50, anchored | 2.56 | 4.28 | 3.49 | 3.53 | 2.68 | 0.00 | 5.00 | 4.47 | 4.21 |
| Eco 50, anchored, all milk solids | 2.56 | 4.28 | 1.75 | 3.19 | 0.00 | 0.00 | 5.00 | 4.17 | 4.02 |
| Eco 50, anchored, 14.5 g | 2.44 | 3.66 | 2.72 | 3.10 | 1.50 | 0.00 | 4.76 | 4.09 | 3.88 |

By soil (share of the dry mass left; mean score of the items that carry it; items clean):

| Case | Egg yolk (17) | Margarine (12) | Milk (7) | Minced meat (3) | Porridge (19) | Spinach (3) | Tea (7) |
|---|---|---|---|---|---|---|---|
| Eco 50, defaults | 1.3 %; 0.0; 0 | 0.1 %; 4.4; 9.5 | 16.5 %; 0.0; 0 | 0.0 %; 4.0; 2.0 | 0.0 %; 4.7; 16.8 | 0.0 %; 5.0; 3 | 11.4 %; 0.0; 0 |
| Eco 50, anchored | 0.0 %; 4.3; 13.3 | 0.1 %; 4.4; 9.5 | 8.2 %; 2.7; 2.5 | 0.0 %; 5.0; 3 | 0.0 %; 4.7; 16.8 | 0.0 %; 5.0; 3 | 11.7 %; 0.0; 0 |
| Eco 50, anchored, 14.5 g | 0.1 %; 3.1; 6.5 | 0.1 %; 4.3; 8.5 | 9.3 %; 1.5; 0 | 0.0 %; 5.0; 3 | 0.0 %; 4.6; 16.0 | 0.0 %; 5.0; 3 | 26.3 %; 0.0; 0 |

**The agreement of the class means is partly by composition, and the pattern of residues is not
that of the standards dossier.** Standards 7.1 and 7.3 name plates with oven-dried egg, meat,
spinach and porridge as where points are lost; here every one of the 17 plates and bowls is bare
and tea alone loses crockery its points. The cutlery mean agrees with the published one, but 28
unsoiled pieces at exactly 5.00 carry it. Do not tune further toward the class means. The quantity to anchor is the share of soiled items clean (48 of 68, 71 %,
on Eco 50), for which nothing is published; the owner's washes will give it.

### 5.3 Where the residues sit (Eco 50, anchored, level seed 1, simulation seed 1)

Of the 68 soiled items 39 are at 5 and 46 are clean (`anchors/reports/std-eu-13.eco_50.md`). What
is left:

- **Tea, on all 7 tea items**: 11 to 13 % of the film, above the threshold over the whole stained
  area (1,400 to 7,100 mm2), score 0. Uniform, so every tea item fails together and stacking does
  nothing to it.
- **Forks, 5 of 11 not clean**: 1 to 16 mm2 of egg yolk and 2 to 55 specks.
- **Glasses, 5 of 7 not clean**: four with 2 to 5 mm2 and 10 to 19 specks, and one glass in the back
  right corner of the upper basket that keeps 298 of 460 mg of its milk because its inside is hardly
  wetted (water side; whether a real corner glass is that dry is not known).
- Two knives (4 and 10 mm2 of margarine) and three soup spoons (8 to 19 mm2 of porridge).

Which forks, knives, spoons and glasses these are changes with the simulation seed (section 7).

## 6. Stacking under the anchored set

`anchors/scripts/stacking.ts` (the settled load changed in one respect; official tier; level seed 1,
simulation seed 1) and `anchors/scripts/stacking-sparse.ts` (single plates in an empty machine, fast
tier). Outputs in `anchors/reports/stacking.*.md`. Scores here are over the items of each load, not
weighted.

### 6.1 The loads

| Load | Programme | Items | Mean | Clean | Soiled items clean | Crockery | Cutlery | Glass | Melamine | Dry soil left |
|---|---|---|---|---|---|---|---|---|---|---|
| Careful | Eco 50 | 97 | 4.19 | 75 (77 %) | 46 of 68 | 3.41 | 4.58 | 2.88 | 5.00 | 1.5 % |
| Careless (the loader's) | Eco 50 | 92 | 2.92 | 45 (49 %) | 17 of 64 | 1.45 | 3.92 | 1.13 | 5.00 | 14.2 % |
| Plates turned, soup plates nested | Eco 50 | 97 | 3.90 | 71 | 42 | 2.18 | 4.58 | 2.75 | 5.00 | 6.4 % |
| Three vessels mouth up (841 mL held) | Eco 50 | 97 | 4.24 | 78 | 49 | 3.41 | 4.62 | 3.25 | 5.00 | 1.6 % |
| Dispenser shut (8.4 of 20 g dissolves) | Eco 50 | 97 | 2.22 | 39 | 10 | 0.14 | 3.23 | 0.13 | 0.50 | 39.7 % |
| Lower arm stalled at 62 degrees | Eco 50 | 97 | 3.61 | 62 | 33 | 3.00 | 4.00 | 1.75 | 5.00 | 2.1 % |
| Forks turned end for end | Eco 50 | 97 | 4.26 | 78 | 49 | 3.41 | 4.68 | 3.00 | 5.00 | 1.8 % |
| Half load | Eco 50 | 54 | 4.11 | 44 (81 %) | 30 of 40 | 2.81 | 4.75 | 4.00 | 5.00 | 0.0 % |

Stacking decides outcomes: 1.3 score points and 30 clean items between a careful and a careless
load on Eco 50.

### 6.2 A/B pairs from the checklist (Eco 50; B minus A on the affected items)

| Checklist | Pair | n | A | B | Δs | Expected | Verdict |
|---|---|---|---|---|---|---|---|
| P02 | Egg-yolk dinner plates turned round in their slot of the full load | 3 | 5.00 | 1.33 | -3.67 | -1 to -2 | Sign right, larger. It is contact, not facing: one turned plate keeps 781 of 1,450 mg, one 35 mg, one comes out at 4; the rule-made poses cut 1 to 3.7 mm into the neighbour (8 placement warnings) |
| P02, control | Minced meat and spinach plates turned in the same way | 3 | 5.00 | 5.00 | 0.00 | about 0 | Holds |
| P28, control | Tea saucer turned | 1 | 0 | 0 | 0.00 | at most 0.5 | Holds trivially: every tea item is at 0 |
| P04 | Porridge soup plates pushed 6 mm behind their neighbour | 2 | 5.00 | 0.00 | -5.00 | score 0 above 200 mm2 | Right |
| P04, control | The plate in front of a nested one | 2 | 5.00 | 5.00 | 0.00 | little | Holds |
| (not a checklist pair) | Unmoved lower-rack crockery beside the turned plates | 7 | 4.29 | 3.43 | -0.86 | | One meat plate that a turned plate now faces goes from 5 to 0 (75 of 581 mg left), one egg plate from 5 to 4 |
| P01 | Mug and cup (tea) and glass (milk) mouth up | 3 | 0, 0, 2 | 0, 0, 5 | +1.00 | holds water; the stain may still go | Right: 331, 216 and 294 mL held, none clean. The milk digests under the standing liquor |
| P25 | Dispenser shut, soiled items | 68 | 3.84 | 1.03 | -2.81 | -1.5 or more | Right: 10 soiled items clean in place of 46 |
| P06 | Lower arm stalled: soiled crockery of the lower rack | 17 | 4.41 | 3.88 | -0.53 | -1.5 or more | **Sign right, a third of the size: too weak** |
| P06, control | The same wash, soiled items of the upper rack | 15 | 2.20 | 1.60 | -0.60 | little | **Fails**: the upper rack loses as much as the lower. With the review's angle (15 degrees) the lower-rack crockery loses 1.16, the soiled cutlery 0.83 and the upper rack 0.46; with the upper arm held at 100 degrees the upper rack loses 1.23 and the lower-rack crockery 0.16 |
| P16, control | Forks turned end for end in the basket | 11 | 3.73 | 4.64 | +0.91 | at most 0.3 | **Fails** (10 of 11 clean in place of 6); the turned poses are rule-made and overlap (20 placement warnings); at simulation seed 2 the same pair gives +0.45 (10 of 11 clean in place of 9), so half of it is sampling |
| P28, control | Tea by position: cups and mugs | 5 | 0, 0, 0, 0, 0 | | range 0 | at most 0.5 | Holds trivially |
| P19 | Half load against full, by item type | | 4.03 | 3.83 | -0.20 | -0.5 to -1 at 30 % over rated | Sign right, small: glasses -1.2, forks -0.4, knives -0.4; plates unchanged |

**Of six negative controls, two hold, two hold only because every tea item is at 0, and two fail**
(the upper rack under a stalled lower arm; forks turned end for end). One positive is too weak (the
stalled arm on the lower rack).

### 6.3 What the model does with facing, and what it does not

For the chemistry-limited soils (egg yolk, milk, minced meat, porridge) the link between stacking
and cleaning is close to binary, and the review's own poses show it more sharply than the pairs
above:

- **A wetted face cleans completely, whichever way it faces.** A single egg-yolk plate turned away
  from the spray in an empty machine comes out as clean as one facing it; so does the outermost
  dessert plate turned to face the tub wall in the full load (reproduced here with the review's
  edit: nothing left of 1,046 mg, score 5 both ways).
  Ten dessert plates at half pitch all came out clean in the review's run.
- **A contact or a near-contact fails locally and completely.** In the same edit the other turned
  plate cuts 2 mm into its neighbour: the neighbour's spinach plate goes from 5 to 0 (5.7 of 159 mg
  left on 549 mm2) while the turned egg plate itself stays clean (score 4). In the review's run, on
  the earlier water side, both went to 0.
- **Baked-on tomato sauce (the jet-driven soil) does answer to facing**: on the same single plates
  31 and 4 of about 150 mg are left facing the spray and 118 turned away; under an inverted frying
  pan 136 of 152 mg against 54 in the open. The egg yolk on those plates is gone in every case.

The checklist expects -1 to -2 for a turned oven-dried protein face (P02, P14) and -0.5 to -1.5 for
halved pitch (P03); both are estimates reasoned from hit frequency. The in-machine tile work found
removal spatially even and about 90 % chemistry under the draining film, with a jet share of 8 to
11 % (soils 6.1, 6.2, verified). The model follows the tile work. The review asked for the rate to
depend on how the liquor arrives. What was done and what was not:

- **Done: a film that nothing renews is spent** (`soil.heldFilmCapacity`, section 3). This removes
  the one place where the model credited a surface with chemistry it could not have had. On the
  careful load it changes almost nothing (4.19 against 4.20 without it). Under a stalled lower arm
  it costs a little more where one arm's run-off is all a surface gets: the load goes to 3.61 with
  it and 3.66 without, the lower rack loses 0.53 with it and 0.47 without, the upper rack 0.60 and
  0.47. It does not make the stalled arm as costly as the checklist expects.
- **Not done: raising `soil.supplyRenewal` until it bites, or lifting the jet term above the
  dossier's 5 %.** The water on a wetted block is renewed 10 to 100 times a second (measured on the
  first build's water side; not measured again on this one). For a renewed
  film to be short of capacity at the removal rate of egg yolk (3.5e-5 kg/(m2 s)), the liquor would
  have to saturate at 0.02 g/L of soil; the default 0.05 1/s corresponds to about 10 g/L, and
  chemistry 10.2 itself puts full supply "above about 0.1 1/s". Moving the constant a
  hundredfold to produce an effect the checklist estimates, against the verified in-machine
  measurement, would be fitting the model to an expectation. The jet term is the dossier's
  decomposition of those same measurements.
- **Not mine to change: how completely a contact or a gap keeps water off a face, how wet the far
  face of a plate or a rack under a stalled arm really is.** These are the water side's wet share
  and are reported to it (section 9.3). If real turned plates are dirtier than the model says, the
  first place to look is whether they are really wetted all the time, not the chemistry.

**For level designers, until the owner's washes say otherwise: facing is not modelled for egg yolk,
milk, minced meat and porridge.** What is modelled for them is contact, nesting, shadowing that
leaves a surface dry, standing water, immersion, a shut dispenser and a stalled arm. A clean plate
is not evidence of good facing. Tea is not usable at all (always dirty). Turned-plate and
corner-glass pairs belong in the first owner washes, because the dossiers disagree here and this
decides whether facing is in the game.

## 7. Run-to-run scatter, and how far a single verdict can be trusted

Eco 50, anchored set, the careful load at every combination of level seeds 1 to 4 and simulation
seeds 1 to 4 (`anchors/scripts/seeds.ts`, output in `anchors/reports/seeds.eco_50.md`).

**The load mean is stable.** Over the 16 washes: 3.87 with the standard weights (standard deviation
0.05), 4.225 over the items of the load (0.051); 72 to 81 items clean; 43 to 52 of 68 soiled items
clean (mean 47.7). By class: crockery 2.56 (0.00), cutlery 4.61 (0.07), glass 3.55 (0.14). The
standard deviation of the load mean is 0.047 over the simulation seed at one level seed and 0.035
over the level seed at one simulation seed. The published repeatability of the mean score is 0.09,
so the model varies less than a laboratory, as it should: it does not vary the tablet's release,
the phase of the arms, how items seat, or the grader.

**The verdict of a single item is not stable**, and the scatter of the load mean hides it:

| What changes between two washes | Pairs | Scores that differ, of 68 soiled items (mean, range) | Verdicts that flip (mean, range) | Soiled items whose verdict is not the same at every seed |
|---|---|---|---|---|
| Simulation seed only (the sampling of the exposure) | 24 | 11.0, 5 to 16 | **6.2, 2 to 9** | 11.3 of 68 at one level seed on average; 19 distinct items over the four level seeds: forks 8, knives 5, soup spoons 3, glasses 3 |
| Level seed only (the draw of the soil) | 24 | 13.7, 9 to 19 | 6.5, 2 to 10 | 11.3 of 68 at one simulation seed on average; 20 distinct: forks 7, knives 6, glasses 4, soup spoons 3 |
| Tier: fast against official, same seeds | 4 | 26.3, 23 to 28 | **16.5, 13 to 20** | forks and soup spoons most, then knives, glasses and dinner plates |

- **A verdict that flips with the simulation seed is sampling noise of the water side, not a
  property of the pose.** It is all on cutlery and glasses; no plate, bowl, cup or mug changes
  verdict with either seed. Four items (three forks and a soup spoon) flip at every level seed. On
  the first anchoring's water side the review found 7 to 11 flips between two simulation seeds; on
  this one it is 2 to 9. An edit elsewhere re-rolls them too: turning two dessert plates changed
  the score of five untouched pieces of cutlery and glasses and the verdict of two (section 6.3).
- **The level seed** flips about as many again. That is the draw of the soil and is physical (a
  real laboratory's soiling varies too), but a level fixes its seed, so one level is one draw.
- **The fast tier is not the official tier.** On the same wash 71 to 81 % of the soiled-item
  verdicts agree; the fast tier scores 3.43 to 3.56 (standard weights) where the official scores
  3.81 to 3.90, with 36 to 41 soiled items clean in place of 44 to 52. The inspector and the soil
  are no longer the cause (the same residue field now scores the same on both meshes, section 3):
  the fast tier's exposure leaves 107 mg of egg yolk on the eleven forks where the official leaves
  2 mg, and plates, tea and knives are the same. This is the water side's (section 9.3). The server gives local play the fast tier
  and the benchmark the official one; until the tiers agree, humans and models should not be
  compared across them.

What follows for the game: the load-level outcome of a wash is reproducible to about 0.05 of a
score point, and about 57 of the 68 soiled verdicts do not depend on the sampling; the verdict of a
particular fork, knife, spoon or glass in a careful load does. The fit and the tables of section 5
are means over two level seeds and two simulation seeds for that reason; the stacking pairs of
section 6 are single washes, and a pair that rests on cutlery or glasses (forks turned, the upper
rack under a stalled arm, the half load) carries that noise.

## 8. How far to trust this

**The corrections of section 3 are sound and independent of the fit**: the quantities, the drying,
the end of a deposit, a film that nothing renews, a stain judged against a level, and an inspector
that does not depend on the mesh. **The fitted protein rate is pinned by bench data.** **The
protease level is loose**: kept by a margin of 0.16 log units under one reading of the milk and
returned under the other. Read the set as the right regime on Eco 50 (most soil gone, plates clean,
residues on cutlery and glasses where exposure is poor, about three quarters of the items clean),
not as the right numbers.

| Use | Trust | Why |
|---|---|---|
| Eco 50, load level: gross faults (nesting, contact, a shut dispenser, held water, a stalled arm, an overfull rack) cost points | In sign | Section 6; the load mean is within 0.3 of the published one, 0.3 above it without tea |
| Eco 50, a plate or bowl: clean or not | Yes for contact and nesting; **no for facing** | Section 6.3 |
| Eco 50, a single fork, spoon, knife or glass | **No**: 2 to 9 verdicts flip with the sampling | Section 7 |
| Tea | **No** | Always 0; four unidentified estimates; wrong in a known direction (the published mean needs tea at 2.2 or more) |
| Fast tier against official tier | **Not comparable** | Section 7 |
| Any number, on a water side other than the one named at the top | **No** | Section 9.4 |

What would settle each open point, in the order of what it unblocks:

| What | A wash on the owner's machine that settles it |
|---|---|
| Whether facing matters for protein; how dry a turned or close-pitched face is | The same wash with two of the plates turned and two at half pitch |
| The corner glass; the milk reading | Milk glasses in the corner and the middle of the upper basket |
| The tile reading (dried or heat-aged) and the spread of the loading | Egg-yolk tiles air-dried and oven-dried, photographed through an interrupted cycle |
| Tea | Tea cups through an interrupted cycle, with and without the owner's tablet |
| Stalled arm, forks up or down | A/B pairs |

## 9. Using and reproducing it

### 9.1 Use

```
cd packages/calibration
# a wash of the settled standard load with the anchored set (official tier)
pnpm exec tsx anchors/scripts/run.ts --params anchors/anchored-v2.json --items
```

In code: `readParamSet(washRegistry(), JSON.parse(readFileSync(file, 'utf8')))` checks the hashes;
`{ ...input, params: set.value.overrides }` is the wash. Every override is in the `soil` group, so
cached exposure is reused.

**The level data must be right for the anchored set to mean anything.** With the stain judged
against a level, a level that puts 0.01 g of `iec_tea` on a cup has a cup that was never visibly
soiled: in the demonstration washes with the load file's soils every tea item scores 5 for that
reason (`packages/sim-verify/demos/v2/SUMMARY.anchored-v2.md`, in the repository's history).

**The anchoring keeps its own exposure cache**, `anchors/out/exposure-cache/<first 12 digits of the
water hash>` (git-ignored). The cache of the demonstration washes is keyed by the version string
only and has held exposure of water code that changed under one string.

### 9.2 Reproduce

```
cd packages/calibration
pnpm exec tsx anchors/scripts/make-records.ts          # the literature record
pnpm exec tsx anchors/scripts/fit.ts --milk film --name anchored-v2   # the fit: writes anchored-v2.json
pnpm exec tsx anchors/scripts/fit.ts --milk full --name scratch --no-write   # the other reading of the milk
pnpm exec tsx anchors/scripts/make-owner-set.ts        # the two sets for the owner's tablet
pnpm exec tsx anchors/scripts/check.ts                 # version, water hash, ranges, bench anchors, record
pnpm exec tsx anchors/scripts/tables.ts                # section 5
pnpm exec tsx anchors/scripts/seeds.ts --params anchors/anchored-v2.json --fast   # section 7
pnpm exec tsx anchors/scripts/stacking.ts --params anchors/anchored-v2.json --level-seed 1 --sim-seed 1
pnpm exec tsx anchors/scripts/stacking-sparse.ts --params anchors/anchored-v2.json
pnpm exec tsx anchors/scripts/demo-anchored.ts         # the demonstration washes with the set
pnpm exec tsc --noEmit -p anchors/tsconfig.json
```

The first wash of a load on a new water side computes its four exposure sets (4 to 5 minutes on a
busy machine); everything after replays in 15 to 60 s. The fit is about 10 minutes of exposure and
25 washes. The outputs this note quotes are in `anchors/reports/`.

Tests of the mechanisms: `packages/sim-soil/src/spread.test.ts`; `packages/sim-soil/src/soil.test.ts`
(the spread, oven drying, the amount scatter, the loading on a lattice and that it is the same
field on two meshes, a film that nothing renews); `packages/sim-timeline/src/replay.test.ts` (the
replay with that limit); `packages/inspector/src/inspect.test.ts` (sub-element coverage, a film
never broken into specks, the same residue on 1 mm2 and 4 mm2 elements).

### 9.3 Requests and defects for other parts of the project

| Part | Request or defect |
|---|---|
| Water side | Verdicts of cutlery and glasses change with the simulation seed (2 to 9 of 68 between two seeds; section 7). Wanted: droplet and run-off randomness keyed by item and cell, so that an edit elsewhere does not re-roll an untouched fork, and more samples where it matters, or exposure averaged over several seeds |
| Water side | The fast tier leaves 107 mg of egg yolk on the 11 forks where the official tier leaves 2 mg, and disagrees on 13 to 20 of 68 verdicts |
| Water side | The sources changed several times under one version string, and the exposure cache is keyed by that string: a stale cache is replayed silently. Wanted: `SIM_VERSION` raised on every change of water code, or a hash of the water sources in the exposure key |
| Water side | One corner glass keeps 65 % of its milk (inside hardly wetted; 298 of 460 mg). A stalled lower arm costs the lower rack 0.5 points (expected 1.5 or more) and the upper rack as much. Contacts are all or nothing: a 2 mm overlap takes a plate from 5 to 0 while a turned face 2 mm clear is spotless |
| `sim-core` | The scene key hashes the whole machine specification, so a wash with another detergent dose computes the exposure of an unchanged geometry again. An option to score the expected residue over K simulation seeds |
| Server, game runner | Local play (fast tier) and the benchmark (official tier) do not give the same verdicts; gate the fast tier on agreement or score both on one tier. An option to wash with a named parameter-set file and a dose. No tea items |
| Catalogue | `iec_milk`, `iec_spinach`, `iec_tea` have no solids fraction. A catalogue soil should carry its own appearance class or visibility threshold (standards 10.3) instead of inheriting its kinetic class's |
| Levels and loader | The IEC level soil records: tea 0.01 g per item, milk 10 g "baked", plate soils on 60 % of the well. The settled careful load holds 97 of 140 items |
| Calibration tool | An observation kind for the mean score of a group of items. The evaluator's own visibility index ignores `rules.visibleShare` and `rules.filmClass`. `anchors/` in the package's type check and test run. `detergents/finish-powerball-ultimate.json` was written before `soil.loadScale` and `soil.heldFilmCapacity` were registered, so its stored soil hash no longer matches (the anchoring reads it leniently); it needs writing again |
| Chemistry defaults | Protease half-life and activity mid-point are placeholders |

### 9.4 How stale this already is

An anchoring is fitted to what the water side gives every deposit, so every change of the water
side makes it stale. What that has cost on this day:

| Parameter set | Fitted on | Evaluated on | Eco 50, anchored: cutlery / glass / all (standard weights) | Soiled items clean |
|---|---|---|---|---|
| `anchored-v1` | 0.2.0 first-build | 0.2.0 first-build | 4.41 / 3.79 / 4.01 (one seed) | 45 of 68 |
| `anchored-v1` | 0.2.0 first-build | 0.3.0 water-2, sources of 09:36 | 4.64 to 4.70 / 4.26 to 4.35 / 4.23 (two seeds) | 51 to 53 |
| `anchored-v2` | 0.3.1 water-2, copy of 09:49 | the same | 4.63 / 3.56 / 3.89 (four washes) | 49.5 |
| `anchored-v2` | 0.3.2 water-3, copy of 10:52 | the same | 4.59 / 3.49 / 3.86 (four washes) | 48.0 |

- The first version's glass class went from 0.36 to 0.9 above the published mean when the water side
  changed under it: part of its protease level had been compensating for dry patches of the old
  water side. After that change its file no longer read against the registry at all.
- This version was fitted twice, an hour apart, on two frozen copies of the water side. Both fits
  gave the same values (3.54e-5 and 0.020) and the same decisions (kept under the film reading of
  the milk by 0.61 and 0.66 log units, returned under the other by 0.30 and 0.35), and the headline
  numbers moved by 0.03 to 0.07. The set in the repository is that of the second copy, and every
  number of this note is of that copy.
- At 11:49 on 10 October the live sources were still those of the second copy
  (`anchors/scripts/check.ts`: all checks pass). The next change of the water side will make
  `check.ts` fail. Refitting is `fit.ts` (two exposure sets of about five minutes each and 24
  washes of about 20 s), then the scripts of section 9.2; the whole of this note's numbers is about
  an hour of machine time in two streams.

## 10. What the review of the first version found, and what was done

| Finding | Reproduced? | Action |
|---|---|---|
| 1. Withdrawn: it was about a programme that is out of scope | | |
| 2. Per-item verdicts of cutlery and glasses are sampling noise; fast and official tiers disagree | Yes: 2 to 9 verdicts flip with the simulation seed, 13 to 20 between the tiers | Flip rates reported (section 7); fit and tables are means over seeds; the soil-side mesh dependence removed (loading on a lattice, inspector). The remaining cause is the water side's sampling and its fast tier: reported, not tuned around |
| 3. The anchoring was stale | Yes: on the sources of 09:36 `anchored-v1` gave 4.44 to 4.46 with glass 4.26 to 4.35 against a published 3.43, and its file no longer read against the registry | Refitted on a frozen water side; version and source hash recorded and checked; own exposure cache per water hash |
| 4. The tea result was an artefact; crockery is not a fit | Yes | A thinned film is no longer broken into specks; loading on a lattice; `soil.bleachRate` returned to its default; the fit does not read tea; the threshold's citation corrected and its position against standards 10.3 recorded; crockery not presented as agreement |
| 5. `liq.xProtease` pushed beyond the measured range against a halved milk quantity | Yes | Scan bounded at the top of the bench range; both readings of the milk run and labelled; glasses reported without the dessert bowl |
| 6. For chemistry-limited soils the link between stacking and cleaning is binary | Yes (section 6.3) | A film that nothing renews is spent (new mechanism). Raising the supply constant a hundredfold or lifting the jet term: **rejected**, against verified in-machine data (section 6.3). Contacts and wet share: the water side's. Level designers told that facing is not modelled |
| 7. The inspector's rule depended on the mesh | Yes | Rewritten on a physical patch, with a test on 1 mm2 and 4 mm2 elements |
| 8. Class means agree partly for the wrong reasons | Yes | Soiled-only means, milk glasses alone, crockery without tea and the share of soiled items clean are in every table; section 5.2 says the agreement is by composition |
| 9. The bake index of the monitor tile is an assumption; peracid | Yes for the tile | Bake reference withdrawn from the set, both readings given (section 3). The peracid decay is the dossier's; the difference the review saw is the soil in the liquor (section 3) |
| 10. Dose; thresholds by model class; one seed | Yes | Dose sensitivity (section 2.3); thresholds reported as a request (the catalogue's and the orchestrator's); four seeds for the fit and tables, sixteen for the scatter |
