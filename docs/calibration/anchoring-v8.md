# The eighth anchoring: `anchored-v8`, fitted on both of the owner's test washes

17 October 2026. This note replaces `anchoring-v7.md` as the description of the set the game
washes with ([issue 65](https://github.com/composo-ai/DishwasherBench/issues/65)). That note, the
calibration on wash 01 (`owner-wash-01-calibration.md`), the fifth anchoring (`anchoring-v5.md`)
and the method (`anchoring.md`, `fitting.md`) stand as written; this one says what changed since
`anchored-v7` and why, and gives the tables on the new set. Paths written as `anchors/...`,
`scripts/...` and `records/...` are relative to `packages/calibration`.

**The default is `packages/calibration/anchors/anchored-v8.owner-capsule.json`, washed with
12.9 g.** Against `anchored-v7`:

| Key | `anchored-v7` | `anchored-v8` | Moved by |
|---|---|---|---|
| `liq.xProtease` of the owner's capsule (the capsule layer) | 0.03 | **0.05** | the owner's washes 01 and 02 |
| `soil.egg_yolk.bakeRate` (new in the set: the class read the global 3e-5) | 3e-5 | **7.5e-5** | the owner's washes 01 and 02 |
| `liq.xProtease` of reference detergent D (the base set) | 0.016 | 0.02 | the anchoring's refit of the published class means with the value above in place |

Everything else is as it was: the duty of the soak (0.8), the bleach rate (0.0009), the
reaction rate of egg yolk and every value read off bench data.

One change of code goes with it. The bake index of a soil (`bakeIndex`,
`packages/sim-soil/src/soil.ts`) is computed with the bake rate of the soil's own class,
`soil.<class>.bakeRate`, which a set may give a class; a class that has none reads the global
`soil.bakeRate`, as every class did before. No registry entry and no source of the water side
changed: on `anchored-v7` every wash is the same to the digit, and the exposure cached for it is
reused.

## 1. What changed, in plain words

- **Two washes, one message.** Every air-dried plate of the two washes came out clean: the two
  of wash 01, the small one turned to the wall among them, and the three standing plates of
  wash 02, the one lying 3 mm behind another among them. Both plates dried 2 h at 80 C in
  wash 01 kept 25 and 100 mm2 of yolk. `anchored-v7` got that right except for the small
  air-dried plate of wash 01, which it left at 13 mm2 and 13 specks (not clean) with the 2.1 g
  taken for it.
- **What held that plate.** Not the water: its face was wet all through the wash and its liquor
  was renewed about as fast as on the plate facing the middle. The specks lay on the thickest
  patches of a layer that was already the thickest of the four (2.1 g on half the area of a
  large plate). To clean those and still leave the oven-dried plates soiled, the model needs
  more cleaning of yolk with the owner's capsule and a larger cost of 2 h at 80 C (section 2).
- **More cleaning: the capsule's protease, 0.03 to 0.05.** Its level is the least certain
  number of the capsule (nothing published gives it; `docs/research/detergent-finish-ultimate.md`
  names a fit to the owner's egg-yolk washes as the way to set it). 0.05 is the top of the
  range that dossier gives. It moves only protein soils washed with the capsule.
- **A larger cost of heating: the egg-yolk class's bake rate, 3e-5 to 7.5e-5.** 2 h at 80 C now
  give egg yolk a bake index of 0.42 where they gave 0.19: the yolk a third slower to come off,
  its lag half as long again. The class is the model's protein class (egg, cheese, minced meat,
  crème brûlée, polymerised fat, burnt residue); egg yolk is the only one of them a wash has
  measured. Proteins set when heated (yolk gels above about 70 C); nothing else moves.
- **Not moved: the duty of the soak, and the global bake rate.** Either would also have fitted
  the plates. The duty moves every soil of the game and the global rate every heat-aged one,
  starch and fat included, on the evidence of egg yolk alone; on the course the global rate
  turns three porridge bowls of the careful breakfast load dirty (section 3).
- **What the game feels.** No careful reference load of the course changes its score, at
  either tier. The careless and random loads clean a little more of what they leave exposed
  (baking day's careless load 124 to 135 points; the tutorial's random load 20 to 40). The
  five model episodes that still verify score as they did. Section 7.

## 2. Why the small plate failed

`anchored-v7`, official tier, wash 01 as written, the small air-dried plate turned to the right
wall (9124) beside the air-dried plate facing the middle (9123), with the scratch diagnostic of
this anchoring (the wash run with its per-cell arrays):

| | 9123 (large, facing the middle) | 9124 (small, turned to the wall) |
|---|---|---|
| Yolk taken, covered area | 3 g on 211 cm2 | 2.1 g on 102 cm2 |
| Mean dry loading of the cells it covers | 6.4 mg/cm2 | 11.0 mg/cm2 |
| The well over the programme: wet share, exchange of its liquor | 1.00, 1.2 1/s | 1.00, 1.0 1/s |
| Where the residue lies (capsule protease 0.05, a layout seed where 9124 fails) | nowhere | cells of 2.1 to 3.1 times the plate's mean loading, all over the well |

The layer is laid on log-normal on a 2 mm lattice (`soil.applicationCv` 0.3 for a spread
layer): over the 2,500 lattice cells of the small plate the thickest carry about three times
the mean. What is left is the tail of that field, on the plate that carries the most yolk per
area, and not a part of the face the water does not reach. Lowering the unevenness of the layer
(0.2) cleans the small plate under the four layouts where it fails, and the oven-dried plates
with it; lowering the
cost of old water (`soil.supplyExchange` 0.005) moves the turned oven-dried plate most and the
small plate little. What separates the two kinds of plate is the cost of oven drying.

## 3. The fit

Both measured records (weight 1 each) and the published class means (weight 0.25), through the
calibration tool's likelihood (`anchors/scripts/fit-owner.ts`, which takes `--record` more than
once since this anchoring). Wash 01 is fitted on its four visible areas with the amounts
integrated out over nine scenarios; wash 02 on the three standing plates' verdicts over its
three scenarios (2.5 g, 1.2 g, 5.2 g); the flat plate's reading is not fitted. The class means
are read from a table of the standard load washed at the official tier over the egg-yolk class's
bake rate and the protease of detergent D (`anchors/reports/owner-wash-02/surface.v7-eggbake.jsonl`,
16 washes); the capsule's protease does not enter them (detergent D has its own, chosen at every
point). The duty is held at 0.8. Official tier, `anchors/reports/owner-wash-02/`:

Joint log posterior (owner's washes, class means, priors) on the grid:

| Capsule protease \\ egg-yolk bake rate | 5.5e-5 | 7.5e-5 | 1e-4 |
|---|---|---|---|
| 0.04 | -6.73 | -6.89 | -7.11 |
| 0.045 | -6.85 | -6.59 | -7.11 |
| **0.05** | -6.88 | **-6.48** | -7.12 |

The tool's fit from the best grid point (`fitRecords`, Nelder-Mead, profiles of both keys;
`anchors/reports/owner-wash-02/fit.prot-eggbake.txt`), 157 evaluations:

| Key | Estimate | 95 % interval (profile) | Verdict |
|---|---|---|---|
| `liq.xProtease` of the capsule | 0.05 | 0.023 to the bound | at the upper bound of its range |
| `soil.egg_yolk.bakeRate` | 7.29e-5 (delivered rounded, 7.5e-5: 0.009 log units) | the whole range | weak |

The two are confounded (posterior correlation 0.92): the records fix one combination of them
(+0.91 protease -0.42 bake rate, information 91 prior precisions) and constrain the other weakly
(1.4). Along the protease's profile the log posterior is -6.47 at 0.05, -7.98 at 0.025 and
-8.57 at 0.022. **The tool warns that the protease sits on its bound and that the records pull
beyond it**: with the duty held at 0.8, either the capsule carries more protease than the top of
its dossier's range, or the soak sprays more than 0.8, or the model removes thick air-dried yolk
too slowly. These two washes cannot say which (section 10).

The tool's interval reaches down to 0.023, below the capsule's value before (0.03), because the
likelihood compares areas on a logarithmic scale with a model term of 0.5 and the amounts
integrated out. The issue's test is harder: every verdict at the amounts taken. That asks for
0.045 or more, and the tool's estimate is the same point.

The posterior is flat: everything on the grid is within 0.7 log units of the best point, and the
owner's wash 02 gives -0.61 everywhere (its two smaller scenarios are clean at every point, its
heaped spoon is not). What decides between the points is wash 01, and the verdicts at the
amounts taken: the small plate is clean from a protease of 0.045 and not at 0.04 (4.3 to 4.9 mm2,
six specks). The best point of the grid is also the one nearest the measured areas.

What was tried and not taken, each on the same records (`anchors/reports/owner-wash-02/`:
`grid.duty-bake.md` and `grid.prot-bake.md` with their class-mean surfaces `surface.v7-bake*`;
the course and the layouts from scratch runs of the same tools):

| Instead | Gives | Why not |
|---|---|---|
| The duty of the soak to 0.95 or 1 with the global bake rate at 7.5e-5 | the same verdicts and areas | moves every soil of the game; continuous circulation is the bound of its range, and the printed energy of Eco 50 is met with the pump on for about half the soak (`anchoring-v5.md` section 3) |
| The global bake rate (`soil.bakeRate`) in place of the class's | the same verdicts and areas on the owner's plates | on the course (fast tier, 21 reference loads) the careful loads lose 37 points of 1,289: three porridge bowls and two spoons of breakfast, a lid, a pudding bowl and a fork turn dirty, soils no wash has measured. With the class's rate the careful loads lose none |
| A protease that lasts four times as long (`liq.proteaseHalfLife` 7200 s, the stable layer) | about 10 % less residue on the small plate | not enough |
| Less unevenness of a spread layer (0.2) | the small plate clean under the four layouts where it fails | the oven-dried plates clean too |

## 4. The owner's plates on the new set

`spotless-fit predict`, official tier, `anchored-v8.owner-capsule` with 12.9 g
(`anchors/reports/v8/owner-wash-01.predict.txt`, `owner-wash-02.predict.txt`):

| Plate | Seen | `anchored-v7` | **`anchored-v8`** | Clean, amounts integrated (v7 / v8) |
|---|---|---|---|---|
| 9121, oven-dried, turned to the left wall | about 100 mm2 (50 to 200), not clean | 59 mm2, 64 specks, not clean | **116 mm2**, 103 specks, score 1, not clean | 0.18 / 0.18 |
| 9122, oven-dried, facing the middle | about 25 mm2 (10 to 60), not clean | 10.7 mm2, 9 specks, not clean | **21.9 mm2**, 24 specks, score 2, not clean | 0.38 / 0.38 |
| 9123, air-dried, facing the middle | nothing, clean | 0.2 mm2, clean | **0**, score 5, clean | 0.62 / 0.82 |
| 9124, small, air-dried, turned to the right wall | nothing, clean | 13.1 mm2, 13 specks, **not clean** | **2.75 mm2**, 3 specks, score 4, clean | 0.38 / 0.62 |
| Wash 02: the plate alone, the covered and the open plate of the pair | clean | clean (at 5.2 g: 146, 174, 94 mm2) | **clean** (at 5.2 g: 28, 34, 13 mm2) | 0.82 / 0.83 |
| Wash 02: the plate lying face up | dirty water; no egg after a light rinse | no yolk, water standing: not clean | no yolk, water standing: not clean | not fitted |
| Log likelihood of wash 01 / wash 02 | | -5.94 / -0.61 | **-5.07 / -0.61** | |

Every verdict of both washes at the amounts taken, and the measured areas of the oven-dried
plates within their ranges.

**Across layouts.** The record fixes one layout of the yolk (its level seed). The same plates
at the amounts taken, under eight layout seeds (the record's and seven others;
`anchors/reports/owner-wash-02/layouts.md`):

| Plate | Seen | `anchored-v7`: right in | `anchored-v8`: right in | `anchored-v8`, mm2 per layout |
|---|---|---|---|---|
| 9121 | not clean | 8 of 8 | 8 of 8 | 37 to 165 |
| 9122 | not clean | 7 of 8 | 8 of 8 | 4.9 to 28 |
| 9123 | clean | 7 of 8 | 8 of 8 | 0 to 0.6 |
| 9124 | clean | 1 of 8 | **4 of 8** | 0 to 8.2 |
| Wash 02, the three standing plates | clean | 24 of 24 | 24 of 24 | 0 |

The small plate stays at the edge of clean: it is clean under four layouts and carries 4.4 to
8.2 mm2 (four to eight specks) under the other four. That is what its amount makes it: 2.1 g is the
middle of what it may have carried (1.45 g, as thin as the large plates, to the 3 g asked for),
and at 1.7 g it is clean under every layout tried. A weighed plate would settle it.

## 5. The published class means

Reference detergent D, 20 g, Eco 50 on the course of the record, careful standard load,
official tier, level seeds 1 and 2, simulation seeds 1 and 2 (`anchors/reports/tables.v8.json`):

| | Crockery | Cutlery | Glass | Milk glasses | Tea items | All | Soiled items clean of 86 |
|---|---|---|---|---|---|---|---|
| Published (Bosch SMV6ECX51E, eco, detergent D) | 3.68 | 4.67 | 3.43 | | | 4.17 | |
| `anchored-v7` | 3.43 to 3.49 | 4.58 to 4.70 | 2.97 to 3.29 | 1.88 to 2.38 | 1.1 to 1.2 | 4.10 to 4.12 | 63 or 64 |
| **`anchored-v8`** | 3.49 to 3.51 | 4.53 to 4.70 | 3.78 to 3.86 | 3.12 to 3.25 | 1.2 to 1.3 | 4.17 to 4.26 | 63 to 66 |

The anchoring's refit (`anchors/scripts/fit.ts`, with the class's bake rate held): the protease of
detergent D 0.02 (the top of its search, 0.016 before: the scan is flat between the two, 0.074
against 0.068, and the harder-set yolk of the egg forks tips it), the bleach rate 0.0009 again
(the floor rule, as before), the reaction rate of egg yolk 3.4e-5 again (the six bench rates,
which the change does not touch: the bench tile is not heated). Glass is now 0.35 to 0.43 over the
published mean where it was 0.1 to 0.5 under; crockery and the whole load are nearer. Every
mean is well inside the record's stated uncertainty (1.1, 0.51 and 0.93 for crockery, cutlery
and glass).

The six in-machine egg-yolk rates: 0.84 / 0.85, 1.79 / 1.75, 0.17 / 0.17, 2.47 / 2.59,
0.68 / 0.69, 4.77 / 4.66 % per minute, all within tolerance and unchanged. The IKW programme
leaves 82 % of the egg yolk (72 % before), 92 % of the starch mix, 95 % of the minced meat
(88 %) and 66 % of the tea: partial, as it must be.

## 6. The owner's capsule on Eco 50: careful against careless

The standard load, Eco 50 as written, the capsule at 12.9 g, official tier
(`anchors/reports/tables.v8.json`; `anchored-v7` from `tables.v7.after-residue.json`):

| Case | All | Crockery | Cutlery | Glass (milk glasses) | Soiled items clean, v7 | **Soiled items clean, v8** |
|---|---|---|---|---|---|---|
| Careful (4 washes) | 4.30 to 4.38 | 4.07 to 4.18 | 4.55 to 4.64 | 3.62 to 3.70 (2.88 to 3.00) | 68 to 70 of 86 | **67 to 71** |
| Careless, the tablet free (2) | 4.06 to 4.13 | 3.53 to 3.59 | 4.58 to 4.70 | 3.13 (2.12) | 62 to 65 of 85 | **61 to 65** |
| Careless, the tablet tray blocked (2) | 2.84 to 2.87 | 1.35 to 1.47 | 3.87 to 3.94 | 1.75 (0.00) | 34 to 37 of 85 | **34 to 37** |
| Careful, fast tier (1) | 4.30 | 4.21 | 4.53 | 3.46 (2.62) | 65 of 86 | **66** |
| Careless, fast tier (1) | 4.00 | 3.53 | 4.52 | 2.97 (1.88) | 64 of 85 | **63** |
| Careless, tablet blocked, fast tier (1) | 2.79 | 1.41 | 3.79 | 1.75 (0.00) | 32 of 85 | **32** |

Stacking costs what it cost; a blocked tablet costs what it cost. Milk on glass comes off a
little more readily with the stronger capsule (milk glasses 2.9 to 3.0 where they were 1.9 to
2.4).

## 7. The course

The saved reference loads of the seven levels, official tier (`docs/benchmark/course-table.md`,
`packages/bench/reference/reference-official.json` and `reference-fast.json`; `anchored-v7`
from the tables they replace):

| Level | Random, v7 / v8 | Careless, v7 / v8 | Careful, v7 / v8 | Careful less careless, v8 |
|---|---|---|---|---|
| tutorial (64 points) | 20 / **40** | 58 / 58 | 64 / 64 | 6 (9.4 %) |
| lunch-for-four (232) | 56 / 56 | 134 / 134 | 187 / 187 | 53 (22.8 %) |
| weeknight-dinner (269) | 75 / 75 | 117 / 117 | 200 / 200 | 83 (30.9 %) |
| breakfast (220) | 36 / 36 | 112 / 112 | 174 / 174 | 62 (28.2 %) |
| mixed-family (266) | 60 / **71** | 148 / 148 | 218 / 218 | 70 (26.3 %) |
| baking-day (272) | 59 / **64** | 124 / **135** | 191 / 191 | 56 (20.6 %) |
| dinner-party (367) | 88 / **85** | 100 / 100 | 250 / 250 | 150 (40.9 %) |

Every careful score is the same. What moved is protein soil on pieces the careless and random
hands leave exposed, which the capsule's stronger protease now cleans: on baking day a cake plate
turned to the wall and a cup on its side, worth 11 points. The gates: six levels pass every gate
as before, baking day nearest its margin (20.6 % against 20 %); the tutorial fails careful over
careless as before, and its random load now also has one verdict worth 8 points at the edge of
clean, over the edge gate's tenth. The fast tier gives the same verdict as the official on 486 of
499 pieces of the careful and careless loads (97.4 %, as before).

Careful against careless at the fast tier on all seven levels
(`packages/sim-verify/levels/level-contrast.json`, the demonstration washes of the level tables):
the careful scores are those of `anchored-v7` to the point, and so are the careless ones but
baking day's (114 to 119 there). Careful beats careless on every level.

Robustness (`docs/benchmark/course-robustness.md`), levels 2, 4 and 7, both ends of every value
the owner's washes leave least certain (the soak's duty, the supply exchange, the capsule's
protease at the lower end of its interval, the protein class's bake rate): the ranking of careful
over careless holds in all 21 cases. The dinner party's margin narrows most, to 96 points (26 %
of the level), with the capsule's protease at 0.023; the breakfast's careful load, which fell to
115 at the low end of the soak on `anchored-v7`, falls to 145.

## 8. The first runs, washed again

The records of `docs/benchmark/first-runs/course/` washed again on this set from their own loads
(`bench verify --rewash`): the five model episodes that verify give the same points (64, 190,
188, 260, 274) and every verdict the same. The record of `gpt-6-astra` on breakfast and the
three random reference records no longer pass the load check of their replay, on the code before
this set too, so they could not be washed again
([issue 67](https://github.com/composo-ai/DishwasherBench/issues/67)).

## 9. Seeds, tiers and phenomena

The careful standard load with the capsule on Eco 50, level seeds 1 and 2, simulation seeds 1
to 4, eight washes per tier (`anchors/reports/variance/v8.capsule.eco-*.jsonl`,
`anchors/tiers.anchored-v8.owner-capsule.json`, which the report of every fast wash quotes):

| | `anchored-v7` | **`anchored-v8`** |
|---|---|---|
| Verdicts of soiled items that agree between the tiers | 615 of 688: 89 % | **623 of 688: 91 %** |
| Crockery / cutlery / glass / melamine | 100 % / 77 % / 95 % / 100 % | 100 % / 79 % / 100 % / 100 % |
| Soiled items clean of 86, official / fast | 68 to 70 / 64 to 67 | 67 to 71 / 65 to 68 |
| Verdicts that differ between two simulation seeds, official | 0 | 0.5 (0 or 1: one fork) |
| Verdicts that differ between two simulation seeds, fast | 1.4 | 2.4 (1 to 4: two knives, three forks, a saucer) |
| Verdicts that differ between two level seeds, official / fast | 6 / 8.3 | 5.5 / 5.3 |

The cutlery disagreement between the tiers is systematic as before: a fork and a knife are
clean officially and dirty at the fast tier in all eight pairs, a fork the other way round.

The phenomena suite at the fast tier on this set
(`packages/sim-verify/phenomena/reports/phenomena-fast-anchored-v8.owner-capsule.md`): 17 pass,
15 too small, 2 too large, 2 wrong sign, 9 not covered, 1 error, as on `anchored-v7`, and no
phenomenon changes its verdict. Their measured sizes move where the test soil is protein that
was heated: the tenacious soil of P03, P07 and P08 scores one or two points lower than it did.
P25 (the detergent tray blocked) stays too large and by more: with the tray blocked the wash still
takes up some of the capsule late, and half of the yolk goes where 27 % went (the score of its
three pieces still falls from 3.33 to 0).

## 10. What remains open

- **The amount on the small plate of wash 01** (section 4): a weighed plate settles whether
  2.1 g was right. Every plate of the owner's next washes should be weighed.
- **The capsule's protease and the duty of the soak** are one combination for these washes:
  only protein soils washed with the capsule were measured. A wash with another detergent, or
  of a soil that does not answer to protease, would part them, and a power log of one Eco 50
  run measures the duty directly ([issue 10](https://github.com/composo-ai/DishwasherBench/issues/10)).
  The capsule's protease sits at the top of its range; if the capsule holds less, the soak
  sprays more than 0.8.
- **The bake rate of the protein class rests on one pair of plates** dried 2 h at 80 C. How
  the other protein soils of the game (cooked egg, cheese, minced meat) set on heating is not
  measured; they follow egg yolk because they are of its class. A wash of oven-dried and
  air-dried plates of another protein would test it.
- **The form of the residue**: the model still leaves about a hundred specks of a square
  millimetre where the photographs show seven patches of some 15 mm2 (wash 01, 9121). The
  unevenness of a fork-spread layer is drawn on a 2 mm lattice; a fork leaves it on
  centimetres.
- **Wash 02's heaped spoon**: at 5.2 g a plate the standing plates still read not clean
  (13 to 34 mm2, from 94 to 174 on `anchored-v7`). If the spoon was heaped, the model is still too
  pessimistic for a thick layer of air-dried yolk.

## 11. What is delivered

| | |
|---|---|
| The default set | `packages/calibration/anchors/anchored-v8.owner-capsule.json` (12.9 g), with `anchored-v8.json` (reference detergent D) under it and `anchored-v8.owner-capsule.stable.json` beside it |
| Fitted on | the published class means (`std-eu-13.round-robin-ta.detergent-d`) and the owner's washes 01 and 02 (`owner-wash-01-egg-yolk-eco50`, `owner-wash-02-stacked-plates-eco50`); what they fixed is `OWNER_CALIBRATED` (the duty and the egg-yolk class's bake rate, in every layer) and `OWNER_CAPSULE` (the capsule's protease, in the capsule's layers) of `anchors/src/anchored.ts`, each with the records it comes from |
| Valid for | `spotless-sim 0.5.0 water-7`, exposure sources `03658efea6fc`, machine data `4279468abf2f` |
| The wash runner | `packages/wash-runner/src/defaults.ts` points at it and at `tiers.anchored-v8.owner-capsule.json` |
| Superseded, kept, refused | `anchored-v7*` (each file carries `supersededBy`), with `-v6`, `-v5` and `-v4`; `SUPERSEDED_ANCHORED` of `anchors/src/scenario.ts` lists them |
| The code | `bakeIndex` of `packages/sim-soil/src/soil.ts` reads the bake rate of the soil's class; a test (`soil.test.ts`) holds that a class without one reads the global rate |

## 12. Commands

```
cd packages/calibration
pnpm exec tsx anchors/scripts/literature-surface.ts anchors/reports/owner-wash-02/surface.v7-eggbake.grid.json \
  anchors/reports/owner-wash-02/surface.v7-eggbake.jsonl --set anchored-v7
pnpm exec tsx anchors/scripts/fit-owner.ts --started-from anchored-v7 \
  --record records/owner/owner-wash-01-egg-yolk-eco50.measured.json \
  --record records/owner/owner-wash-02-stacked-plates-eco50.measured.json \
  --surface anchors/reports/owner-wash-02/surface.v7-eggbake.jsonl --out anchors/reports/owner-wash-02 \
  --fit liq.xProtease,soil.egg_yolk.bakeRate --name prot-eggbake \
  --grid "liq.xProtease=0.04,0.045,0.05;soil.egg_yolk.bakeRate=0.000055,0.000075,0.0001" \
  --profiles liq.xProtease,soil.egg_yolk.bakeRate --draws 0
pnpm exec tsx anchors/scripts/fit.ts --name anchored-v8 --doc docs/calibration/anchoring-v8.md
pnpm exec tsx anchors/scripts/make-owner-set.ts --params anchors/anchored-v8.json
pnpm exec tsx anchors/scripts/supersede.ts anchored-v7 --by anchored-v8 --why "..."
pnpm exec tsx anchors/scripts/check.ts
pnpm exec tsx anchors/scripts/study.ts anchors/reports/tables.v8.cases.json anchors/reports/tables.v8.json
pnpm exec tsx scripts/spotless-fit.ts predict records/owner/owner-wash-01-egg-yolk-eco50.measured.json \
  --params anchors/anchored-v8.owner-capsule.json        # and owner-wash-02-stacked-plates-eco50
```

```
cd ../sim-core
pnpm exec tsx scripts/variance-study.ts --tiers official --level-seeds 1,2 --sim-seeds 1,2,3,4 \
  --params <anchors>/anchored-v8.owner-capsule.json --dose-g 12.9 --cache <anchors>/out/exposure-cache \
  --out <anchors>/reports/variance/v8.capsule.eco-off.jsonl      # and --tiers fast
cd ../calibration
pnpm exec tsx anchors/scripts/tier-agreement.ts --set anchored-v8.owner-capsule \
  eco_50=anchors/reports/variance/v8.capsule.eco-off.jsonl,anchors/reports/variance/v8.capsule.eco-fast.jsonl
cd ../..                                                          # from the root of the repository:
INIT_CWD=. pnpm exec tsx packages/sim-verify/src/phenomena/cli.ts --tier fast \
  --params packages/calibration/anchors/anchored-v8.owner-capsule.json --dose-g 12.9 \
  --detergent-name "Finish Powerball Ultimate"
INIT_CWD=. pnpm exec tsx packages/sim-verify/scripts/demo-washes.ts \
  --params packages/calibration/anchors/anchored-v8.owner-capsule.json --dose-g 12.9
pnpm --filter @spotless/sim-verify exec tsx scripts/demo-washes.ts <the 14 careful and careless loads> \
  --tier fast --params ../calibration/anchors/anchored-v8.owner-capsule.json --dose-g 12.9 --out <dir>
pnpm --filter @spotless/sim-verify exec tsx scripts/level-contrast.ts --from <dir> --out levels/level-contrast.json
pnpm --filter @spotless/bench reference-table --tier official --jobs 2 --json packages/bench/reference/reference-official.json
pnpm --filter @spotless/bench reference-table --tier fast --json packages/bench/reference/reference-fast.json
pnpm --filter @spotless/bench course-table --gates --md docs/benchmark/course-table.md
pnpm --filter @spotless/bench robustness --levels lunch-for-four,breakfast,dinner-party --tier official --seeds 0
pnpm --filter @spotless/bench robustness --levels lunch-for-four,breakfast,dinner-party --tier fast --seeds 2 --only base,seed-2,seed-3
pnpm --filter @spotless/bench exec tsx src/cli.ts verify <record.json> --rewash     # every record of the first runs
```

A replay of the owner's washes costs a few seconds at the official tier once its exposure is
cached; the grid of section 3 took 8 minutes, the tool's fit with its profiles 70. The study of
the layouts (`anchors/reports/owner-wash-02/layouts.md`) replayed copies of the two records with
another level seed and no amount scenarios; the copies are not kept.
