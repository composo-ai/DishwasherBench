# The seventh anchoring: `anchored-v7`, on the machine with its corrected upper basket

11 October 2026, evening. This note replaces `owner-wash-01-calibration.md` as the description
of the set the game washes with. That note, the fifth anchoring (`anchoring-v5.md`) and the
method (`anchoring.md`, `fitting.md`) stand as written; this one says what changed since
`anchored-v6` (this morning) and why, and gives the tables on the new set. Paths written as
`anchors/...`, `scripts/...` and `records/...` are relative to `packages/calibration`.

**The default is `packages/calibration/anchors/anchored-v7.owner-capsule.json`, washed with
12.9 g.** One value differs from this morning's: `soil.bleachRate`, 0.0009 where it was 0.001.

> **Added on 12 October.** Late on 11 October, after this note was written, the wash began to
> leave what its water held as residue where water stands on an item at the end
> (`packages/sim-timeline/src/replay.ts`, no new parameter). The set is still current: no source
> of the water side changed, its reference wash differs only by 0.02 mg of invisible residue on
> four mug bases, and the stored digest was re-recorded with a note in the three
> `anchored-v7*` files. The cases of sections 4 and 5 were washed again on the final code
> (`anchors/reports/tables.v7.after-residue.json`; `tables.v7.json` is as it was). **Every
> careful row is the same to the digit, and so is every count of clean items in every row.**
> What moved is the score of vessels that stand full in the careless loads, which used to score
> 5 for their soil while failing for their water: the careless load with the tablet free now has
> glass 2.73 to 2.97 (was 3.54 to 3.78), milk glasses 1.50 to 1.88 (2.75 to 3.13) and a load
> mean of 4.06 to 4.09 (4.22 to 4.25); with the tablet blocked the load mean is 2.74 to 2.77
> (2.78 to 2.81); at the fast tier the careless load has glass 2.81 and a mean of 4.00 (3.62 and
> 4.16). On Auto 45-65 the careful load reads crockery 2.68, tea items 2.9, 73 of 114 clean and
> 45 of 86 soiled items clean (2.83, 3.2, 74 and 46). In section 6 read "score 5, full of
> water, not clean" for a glass standing mouth up as "not clean, with a low score". The tables of the phenomena
> suite were run again on the final code with the same verdicts (17, 15, 4, 2, 9, 1;
> `packages/sim-verify/phenomena/reports/phenomena-fast-anchored-v7.owner-capsule.md`). The old
> demonstration results this note compares with in section 2 are now under
> `packages/sim-verify/demos/v5-old-basket/`.

## 1. What changed, in plain words

- **The machine.** The upper basket was corrected from the owner's floor-level photograph
  (on 11 October 2026): two ridges where it had raised strips, a front wall with two rails, the
  knife shelf 52 mm higher. No source of the water side was edited for it. Every standard load
  was settled again on it, and the copies the anchoring keeps (`anchors/loads`) were made
  again from them.
- **The loads are not the loads of this morning.** The careful 13-place load holds 114 items
  (118), of which 86 are soiled (90): 8 of the 13 milk glasses (all 13 before) and 3 dessert
  bowls (2). Nearly every vessel in the upper basket now leans 8 to 33 degrees on a side rest.
  The careless load holds 113 and **no longer blocks the tablet tray** (a glass stood in front
  of it on the old basket). The blocked tablet is kept as a case of its own: the same poses
  with the dispenser held shut (`anchors/loads/iec-13-careless-tablet-blocked.wash.json`).
- **The soak's registered default.** `prog.soakDuty` is 0.8 in the registry, with the owner's
  wash 01 as its source and the wash's 95 % profile interval, 0.59 to 1, as its range (it was
  0.5, range 0.1 to 1, and the set overrode it). A wash on registry defaults no longer runs
  the soak his wash contradicts, and a duty below 0.59 is refused. The simulator is
  `spotless-sim 0.5.0 water-7`. Every exposure cached before 16:49 is orphaned, which the
  corrected machine had done to every scene anyway.
- **Superseded sets cannot be read as current.** `anchored-v4`, `-v5` and `-v6` say in their
  own files which set replaced them (`supersededBy`), and the guard every wash reads a set
  through refuses a file that says so, whatever code is on disk. With stale sets accepted
  knowingly they still load, marked stale in the result.
- **One value moved: the bleach rate, 0.001 to 0.0009.** Section 2.
- **The owner's four plates are where they were**, and so is everything fitted to egg, milk
  and porridge. Section 3.

## 2. What moved, and what moved it

With this morning's values on the corrected machine and the new loads (reference detergent D,
Eco 50 on the course of the record, official tier, level seeds 1 and 2, simulation seeds 1 and
2: `anchors/reports/tables.v7.revalidation-v6.json`, and the points of
`anchors/reports/fit.anchored-v7.md` at 0.016 and 0.001):

| | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All |
|---|---|---|---|---|---|---|---|
| Published | 3.68 | | | 4.67 | 3.43 | | 4.17 |
| This morning (`anchored-v6`, old basket, old loads) | 3.73 (3.68 to 3.79) | 4.98 | 2.20 | 4.61 (4.56 to 4.65) | 3.15 | 2.15 | 4.17 (4.12 to 4.20) |
| The same values on the corrected machine | **4.04** (4.04 in all four) | 5.00 | **2.75** (2.7 to 2.8) | 4.64 (4.58 to 4.70) | 3.13 (2.97 to 3.29) | 2.13 (1.88 to 2.38) | 4.26 (4.25 to 4.27) |
| `anchored-v7` (bleach rate 0.0009) | 3.46 (3.43 to 3.49) | 5.00 | 1.15 (1.1 to 1.2) | 4.64 (4.58 to 4.70) | 3.13 (2.97 to 3.29) | 2.13 (1.88 to 2.38) | 4.11 (4.10 to 4.12) |

Cutlery, glass, the plates and the bowls are where they were, well inside the scatter between
seeds (0.1 on a class mean). **Crockery is not: 0.31 up, three times that scatter, and all of
it is tea.** With the capsule the same: the tea items read 3.7 to 4.1 where they read 3.0 to
3.1, crockery 4.40 to 4.56 where it read 3.96 to 4.01, and everything else is unchanged.

**What moved it: where the mugs stand.** The tea items of the load are four mugs and six
saucers. On the old basket the careful policy stood the mugs mouth down and upright on the
lowered cup shelves, 55 mm above the floor of the basket. On the corrected basket nothing fits
under a lowered shelf, the shelves stay folded up, and the mugs lean 16 to 17 degrees on the
right side rest at floor level. Official tier, the same spray states, old basket against new
(`packages/sim-verify/demos/v5-old-basket/iec-13-careful.result.json` against a wash of the new load):

| Inside of the mug | Old basket (upright on the shelf) | Corrected basket (leaning on the rest) |
|---|---|---|
| Share of the surface a jet reaches | 0.21 to 0.49 | 0.57 to 0.88 |
| Water arriving, kg/(m2 s) | 0.10 to 0.48 | 1.2 to 2.8 |
| Renewal of the film, 1/s | 1.8 to 6.4 | 9.4 to 24 |
| Exchange with the liquor, 1/s | 0.18 to 0.74 | 0.60 to 3.0 |
| Water left standing on the upturned base | 5.0 mL each | 0.1 mL |
| Score of the four mugs with the capsule, bleach rate 0.001 | 1, 0, 0, 0 | 2, 1, 5, 2 |
| The same with detergent D | 0, 0, 0, 0 | 1, 0, 5, 1 |

The saucers hardly moved (five of the six score what they scored and one a point or two less;
the exchange of their water with the liquor changed by between -27 and +31 %), and the bleach
in the liquor is the same to four digits. So the change is the load, and the load follows from the
basket: a leaning mug is what the owner's machine holds. Nothing in the model was changed to
produce it.

**The refit.** `anchors/scripts/fit.ts`, as this morning: the six bench rates, then
`liq.xProtease` and `soil.bleachRate` on the three published class means through the tool's
likelihood, with what the owner's wash fixed held in place.

| Key | `anchored-v6` | `anchored-v7` | What the scan says |
|---|---|---|---|
| `soil.egg_yolk.rateRef` (and the milk rate with it) | 3.4e-5 | 3.4e-5 | the bench tile has no basket: the six rates are met as before |
| `liq.xProtease` of detergent D | 0.016 | 0.016 | best of the scan again (objective 0.050; 0.069 at 0.02, 0.169 at 0.014) |
| `soil.bleachRate` | 0.001 | **0.0009** | best of the scan (objective 0.015; 0.030 at 0.001, 0.040 at the default 0.0008); kept by the floor rule as before |
| `prog.soakDuty` | 0.8, an override | 0.8, also the registered default | held; section 3 |
| The capsule's `liq.xProtease` | 0.03 | 0.03 | not fitted: held by its source only |

The bleach rate is as weakly held as it was: the record bounds it from below only. What is new
is how steep tea has become around the value. Tea items with detergent D score 0.10 at 0.0008,
1.15 at 0.0009, 2.75 at 0.001, 3.73 at 0.0011 and 4.40 at 0.0012; the published crockery mean
asks for about 2.2, which lies between the two grid values, and the likelihood differs by
0.015 log units between them. **Every tea, coffee and wine verdict of the game turns on the
fourth decimal of this one rate**, and the first of the owner's next washes (tea in mugs,
section 11 of `owner-wash-01-calibration.md`) is the measurement that would hold it.

## 3. The owner's wash 01 on the corrected machine

His load stands in the lower basket under two wine glasses and a colander. The record keeps
the poses it was predicted with; the three upper-basket pieces were settled on the old floor.

Official tier, the inputs of the prediction (3 g on every large plate, 2.1 g on the small one,
layout seed 20261010), the capsule (`anchors/reports/v7/owner-wash-01.predict.txt`):

| Plate | Observed | `anchored-v6`, this morning | `anchored-v7`, corrected machine | Clean, amounts integrated |
|---|---|---|---|---|
| 9121, oven-dried, turned to the left wall | about 100 mm2 (50 to 200), 7 patches, score 1, not clean | 101 mm2, 107 specks, score 1, not clean | **59 mm2**, 64 specks, score 1, not clean | in 0.18 (0.18) |
| 9122, oven-dried, facing the middle | about 25 mm2 (10 to 60), 5 patches, score 2 (1 to 3), not clean | 10.7 mm2, 10 specks, score 3, not clean | 10.7 mm2, 9 specks, score 3, not clean | in 0.38 (0.38) |
| 9123, air-dried, facing the middle | nothing (under 5 mm2), score 5, clean | 0.2 mm2, 1 speck, score 4, clean | 0.2 mm2, 1 speck, score 4, clean | in 0.62 (0.62) |
| 9124, small, air-dried, turned to the right wall | nothing (under 5 mm2), score 5, clean | 12.6 mm2 with 2.1 g, score 2, not clean | 13.1 mm2 with 2.1 g, 13 specks, score 2, not clean | in 0.38 (0.38) |
| Log likelihood of the measured record (four fitted areas, amounts integrated) | | -5.79 | -5.94 | |

The set as it was this morning gives the same four plates on the corrected machine as
`anchored-v7` does: the two sets differ in the bleach rate only, which yolk does not read.

Three plates are the same to the digit. The fourth, the oven-dried plate turned to the left
wall, leaves 59 mm2 where it left 101. Why was not traced: the upper basket above it is lower
along the walls than it was drawn, and the two glasses and the colander of his load keep the
poses they had on the old floor. It is inside its observed range (50 to 200) either way, and
the likelihood of the record moves by 0.15 log units, which is nothing.

**The duty.** The joint picture of this morning was made again on the corrected machine:
the owner's record replayed at five duties, the published class means from a surface washed
about `anchored-v7` (20 washes of the new load, `anchors/reports/surface.v7.jsonl`), the
label's energy as prior (`anchors/reports/v7/grid.duty-v7.md`).

| Duty | Owner's wash, log likelihood | Published means | Label prior, as this morning | Sum | This morning's profile |
|---|---|---|---|---|---|
| 0.6 | -7.58 | -0.55 | -0.03 | -8.16 | -8.02 (at 0.62) |
| 0.7 | -6.46 | -0.54 | -0.16 | -7.15 | -7.25 |
| **0.8** | -5.94 | -0.55 | -0.35 | **-6.84** | **-6.68** |
| 0.9 | -5.48 | -0.55 | -0.58 | -6.61 | -6.82 |
| 1 | -5.83 | -0.56 | -0.84 | -7.23 | -6.95 |

On the corrected machine the best of the five is 0.9, 0.22 log units above 0.8; this morning
0.8 was the best by 0.14. That is a difference the wash cannot see (the tool moves a parameter
off its registered value for 0.5 or more), every grid value from 0.6 to 1 stays inside the
95 % profile interval as before, and 1 is no longer preferred by the wash alone (-5.83 against
-5.48 at 0.9). **The duty stays 0.8.** Two things to know about this check: it is a grid, not
the tool's own optimiser with profiles, which was not run again; and the tool as it stands
cannot state the label's prior any more, because its centre (0.53) lies below the registered
range and is moved to 0.59, so the prior column above is this morning's formula applied by
hand (with the tool's own, weaker prior the grid reads -8.12, -7.02, -6.58, -6.23, -6.74).

## 4. Eco 50 with the reference detergent against the published class means

Record course (main wash 54 C, final rinse 48 C), detergent D at 20 g, careful load, official
tier, four washes (`anchors/reports/tables.v7.json`):

| | Crockery | Plates and bowls / tea items | Cutlery | Glass | Milk glasses | Melamine | All | Items clean | Soiled items clean |
|---|---|---|---|---|---|---|---|---|---|
| Published (Bosch SMV6ECX51E, eco, detergent D) | 3.68 | not published | 4.67 | 3.43 | | 4.21 | 4.17 | about 70 % | |
| `anchored-v6`, this morning (old basket and loads) | 3.68 to 3.79 | 4.95 to 5.00 / 2.0 to 2.4 | 4.56 to 4.65 | 3.15 | 2.15 | 5.00 | 4.12 to 4.20 | 92 to 96 of 118 | 64 to 68 of 90 |
| **`anchored-v7`** | 3.43 to 3.49 | 5.00 / 1.1 to 1.2 | 4.58 to 4.70 | 2.97 to 3.29 | 1.88 to 2.38 | 5.00 | 4.10 to 4.12 | 91 or 92 of 114 | 63 or 64 of 86 |
| `anchored-v7`, Eco 50 as written (1 wash) | 3.21 | 5.00 / 0.4 | 4.64 | 3.46 | 2.63 | 5.00 | 4.09 | 92 of 114 | 64 of 86 |

By soil (items clean; mean score):

| Soil | `anchored-v6`, this morning | `anchored-v7` |
|---|---|---|
| Egg yolk | 11 to 13 of 20; 3.8 to 3.9 | 14 of 20; 4.0 to 4.2 |
| Milk (glasses) | 3 or 4 of 13; 2.2 | 2 to 4 of 8; 1.9 to 2.4 |
| Tea | 4 of 10; 2.0 to 2.4 | **0 of 10; 1.1 to 1.2** |
| Margarine | 13 or 14 of 14 | 13 or 14 of 14 |
| Porridge | 20 of 20 | 18 to 20 of 20 |
| Minced meat, spinach | 6 of 6, 7 of 7 | 6 of 6, 8 of 8 |

Crockery is 0.2 under the published mean and the whole load 0.06 under, where this morning
they were 0.05 over and on it: with detergent D no tea item is clean at a bleach rate of
0.0009 (four mugs at 0, 0, 2, 0 and six saucers at 2, 2, 3, 2, 0, 0 at level seed 1), where at
0.001 half of them are (5 of 10) and the crockery mean is 0.36 over. The published value lies
between the two. The glass class depends on the level seed now (2.97 or 3.29): with eight
glasses one glass is a third of a score point on the milk mean.
The four glasses on the right rest score 2 to 5 (mean 4.1), the four along the left wall 1,
0, 0, 0: there the inside of a glass gets 0.03 to 0.9 kg/(m2 s) of water against 1.7 to 6.4
on the right.

## 5. The owner's capsule (12.9 g) on Eco 50 as written

Official tier unless stated; the standard loads as the anchoring holds them; level seeds 1 and
2 (`anchors/reports/tables.v7.json`). "This morning" is `anchored-v6` on the old basket and
loads, out of 90 soiled items.

| Case | Crockery | Plates and bowls / tea | Cutlery | Glass | Milk glasses | All | Items clean | **Soiled items clean** | This morning |
|---|---|---|---|---|---|---|---|---|---|
| **Careful** (4 washes) | 4.04 to 4.13 | 5.00 / 2.7 to 3.0 | 4.58 to 4.70 | 2.97 to 3.29 | 1.88 to 2.38 | 4.25 to 4.29 | 96 to 98 of 114 | **68 to 70 of 86** | 66 to 69 of 90 |
| **Careless as saved**: the tablet is free (2) | 3.53 to 3.56 | 4.86 to 4.90 / 1.8 | 4.63 to 4.75 | 3.54 to 3.78 | 2.75 to 3.13 | 4.22 to 4.25 | 90 to 93 of 113 | **62 to 65 of 85** | 61 or 62 of 90 (tablet freed) |
| Careless with the tablet tray blocked (2) | 1.24 to 1.26 | 2.00 to 2.05 / 0.0 | 3.87 to 3.94 | 1.75 | 0.00 | 2.78 to 2.81 | 62 to 65 of 113 | **34 to 37 of 85** | 33 or 34 of 90 |
| Careful, fast tier (1) | 4.13 | 5.00 / 3.0 | 4.58 | 3.05 | 2.00 | 4.24 | 93 of 114 | 65 of 86 | 68 of 90 |
| Careless, fast tier (1) | 3.53 | 4.71 / 2.1 | 4.56 | 3.62 | 2.88 | 4.16 | 92 of 113 | 64 of 85 | |
| Careless, tablet blocked, fast tier (1) | 1.21 | 1.95 / 0.0 | 3.79 | 1.75 | 0.00 | 2.73 | 60 of 113 | 32 of 85 | 32 of 90 |
| Careful, the stable-protease layer (1) | 4.04 | 5.00 / 2.7 | 4.63 | 3.29 | 2.38 | 4.28 | 96 of 114 | 68 of 86 | 67 of 90 |
| Auto 45-65, careful (secondary, provisional) | 2.83 | 2.81 / 3.2 | 3.88 | 1.75 | 0.00 | 3.29 | 74 of 114 | 46 of 86 | 47 of 90 |
| Auto 45-65, careless, tablet free | 2.18 | 2.52 / 2.1 | 3.88 | 1.75 | 0.00 | 3.12 | 69 of 113 | 41 of 85 | |

By soil, careful / careless as saved / careless with the tablet blocked (items clean):

| Soil | Careful | Careless, tablet free | Careless, tablet blocked |
|---|---|---|---|
| Egg yolk | 14 of 20 | 15 of 20 | 0 of 20 |
| Milk (glasses) | 2 to 4 of 8 | 2 or 3 of 8 | 0 of 8 |
| Tea | 5 or 6 of 10 | 3 of 10 | 0 of 10 |
| Margarine | 13 or 14 of 14 | 10 to 14 of 14 | 10 to 14 of 14 |
| Minced meat | 6 of 6 | 6 of 6 | 0 of 6 |
| Porridge | 18 to 20 of 20 | 20 of 20 | 18 or 19 of 20 |
| Spinach | 8 of 8 | 5 of 7 | 5 of 7 |

- **Stacking alone costs what it cost this morning**: 68 to 70 against 62 to 65 clean (66 to
  69 against 61 or 62). Twelve verdicts are clean only in the careful load at level seed 1 and
  seven only in the careless one; fourteen of those nineteen are forks, knives and soup spoons,
  which sit in other cells of the cutlery basket in the two loads.
- **A blocked tablet costs what it cost**: 34 to 37 of 85 stay clean, because porridge,
  spinach and margarine come off in water alone. Egg, milk, minced meat and tea all fail.
- **The careless load holds 1.27 L of water** in vessels standing mouth up or on their side
  (the careful one 0.4 mL): a glass standing mouth up scores 5 for its soil and is not clean.
- Tea with the capsule is on its threshold in both loads: seven or eight of the ten tea items of
  the careful load change verdict between the two ends of the band of visibility.

## 6. The stacking pairs

The mistakes of the careless standard load one by one, the capsule on Eco 50, official tier,
level seeds 1 and 2 (the score of the item in the careful load against the careless one; the
fast tier in brackets):

| Mistake | Item | Careful | Careless | Reading |
|---|---|---|---|---|
| Plate turned away | `saucer_02` (tea) | 4 or 5 | **0** (fast 0) | costs its points |
| Plate turned away | `dessert_plate_01` (yolk) | 5 | 5 (fast 5) | costs nothing, as this morning |
| Cup on its side | `mug_01`, `mug_03` (tea) | 1 or 2, 5 or 4 | **0, 0** (fast 0) | costs what the mug had |
| Cup on its side | `glass_03` (milk) | 5 or 3 | **0** (fast 0) | costs its points |
| Cup standing mouth up | `mug_02`, `mug_04` (tea) | 0, 1 | 0, 0 | dirty either way |
| Cup standing mouth up | `glass_06`, `glass_08` (milk) | 0, 0 (at the left wall) | score 5, full of water, not clean | not clean either way, for another reason |
| Spoon lying in another | `soup_spoon_12` (porridge) | 5 | 5 (fast 5) | **costs nothing** (section 10) |
| Plate over another | `melamine_plate_03` | 5, clean | score 5, holds water, not clean | costs its points |

The pairs of the phenomena suite with the capsule on Eco 50 (the suite's own loads and soils):

| Pair | Fast tier, now | Fast tier, this morning | Official tier, now | Reading |
|---|---|---|---|---|
| P02 plate turned away (2 g of oven-dried yolk, dessert plate) | 0.008 % against 0.016 % of the yolk left; 7 against 14 mm2; score 2 against 2 | 0.009 % against 0.015 %; 2 against 2 | not washed | the turned face keeps twice the residue; no score step |
| P03 plates at half the pitch (set row, section 10) | upper half of the covered plate 5 to 3; the whole well 1.6 mm2, clean | 5 to 0 on a nested pair | upper half 5 to 2; the whole well 4.5 mm2, score 3, not clean | **new**: a gap of 4 to 5 mm costs two or three score points on the upper half; the verdict of the plate is on the edge (clean at the fast tier, not at the official) |
| P04 bowl nested in another | 17.6 % of the porridge left, score 0; apart score 5 | 3.9 %, score 0 | not washed | holds: the covered bowl stays dirty |
| P14 platter face to the wall | 5 against 5; renewal of the water 33 to 2.0 1/s | 5 against 5 | not washed | both faces come clean |
| P15 spoon lying in another (set nest, section 10) | shielded spoon 8 % of the porridge left, 193 mm2, score 1; partner 5 | 4 and 5 on a pair that touched at a point | shielded spoon 9 % left, 209 mm2, score 0; partner 5 | **new**: a hollow covered all over stays dirty |
| P25 blocked tablet | the three pieces 3.67 to 0; 26 % of the yolk and 40 % of the tea still go | 2.67 to 0; 27 % and 43 % | plate 3 to 0, tea cups 4 to 0; 27 % of the yolk and 40 % of the tea still go | holds on the score; still above the 20 % the checklist allows |
| P06 lower arm held | plates 4.71 to 4.00 | 4.71 to 4.14 | | holds |
| P17 crowded cells of the cutlery basket | 0 to 4 % of the spoons below 5 | the same | | too small: crowding costs nothing (section 10) |

## 7. The phenomena suite at the fast tier

48 phenomena, 82 washes, the capsule on Eco 50
(`anchors/reports/v7/phenomena/phenomena-fast-anchored-v7.owner-capsule.md`; this morning's
run is `anchors/reports/owner-wash-01/phenomena/`):

| | Pass | Too small | Too large | Wrong sign | Not covered | Error |
|---|---|---|---|---|---|---|
| This morning (`anchored-v6`, old basket) | 17 | 14 | 6 | 1 | 9 | 1 |
| **Now (`anchored-v7`, corrected basket)** | **17** | **15** | **4** | **2** | 9 | 1 |

Six verdicts changed. Two because the load is now what the phenomenon describes, four because
the upper basket and the loads on it changed; none because the bleach rate moved.

| | Phenomenon | This morning | Now | Why |
|---|---|---|---|---|
| P03 | Plate pitch too small | too large (5 to 0) | **pass** (5 to 3) | the crowded row stands half a pitch apart; it was a nest |
| P15 | Nested spoons | too large (shielded spoon 4) | **pass** (shielded spoon 1, partner 5) | the second spoon lies in a nest of 10 cm2; it lay across the first |
| P19 | Loading beyond rated capacity | wrong sign (3.60 to 3.67) | **pass** (4.27 to 3.91) | the standard loads, settled again |
| P40 | Liquid held at contact points | pass (2.27 to 2.75 g) | **wrong sign** (2.58 to 2.30 g) | the two glasses lean on the rest now; touching, they hold a little less water than apart |
| P44 | Cutlery comes out clean | pass (cutlery mean 3.68, 0.92 under 4.6) | **too small** (3.55, 1.05 under) | the loader's own soils on the new load; the band ends at 1 under |
| P45 | Class ranking in the standard test | pass (cutlery 0.59 above crockery) | **wrong sign** (0.59 below) | with the loader's soils crockery rose from 3.09 to 4.15 (the mugs on the rest) while cutlery fell from 3.68 to 3.55 |

Every verdict, with the deciding checks (the value this morning in brackets where it differs):

| | Phenomenon | This morning | Now | Deciding checks now (this morning where it differs) |
|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | pass | retained 0.0446 to 279; f_jet 0 (was: retained 0.444 to 253; f_jet 0) |
| P02 | Soiled face turned away from the spray source | too large | too large | f_jet 0.000415 to 0.000156; score 2 to 2 (was: f_jet 0.000413 to 0.000156; score 2 to 2) |
| P03 | Plate pitch too small | too large | **pass** | halving 5 to 3; plateau 5 to 5 (was: halving 5 to 0; plateau 5 to 5) |
| P04 | Nesting or "spooning" of like items | too small | too small | residue 0.176; score 0 (was: residue 0.0388; score 0) |
| P05 | Large flat item shadows what is behind or above it | error | error | score 3.5 to 3; f_jet 7.45e-05 to 4.63e-05 (was: score 3.5 to 3; f_jet 8.07e-05 to 4.63e-05) |
|  |  |  |  | note: wash B: the set pose cuts 2.0 mm (board into plate_2) |
| P06 | Spray arm stalled by an item | pass | pass | coverage 0.408 to 0; score 4.71 to 4 (was: coverage 0.408 to 0; score 4.71 to 4.14) |
| P07 | Radial position: centre against corner | too small | too small | score 3 to 3 |
| P08 | Left/right asymmetry with rotation direction | pass | pass | score 3 to 5 |
| P09 | Lean direction of plates | too small | too small | score 2 to 2 |
| P10 | Tall narrow vessel interior | too small | too small | glass 1; residue 1.92e-11 to 0 (was: glass 1; residue 1.78e-11 to 0) |
| P11 | Upper against lower rack for tenacious soil | pass | pass | score 3 to 2 |
| P12 | Alternating large and small plates | too small | too small | score 5 to 5 |
| P13 | Glass or cup placed over tines | too small | too small | f_jet 0.0123 to 0.0119 (was: f_jet 0.012 to 0.0116) |
| P14 | Soiled face against the tub wall or door liner | too small | too small | f_jet 0.00758 to 0; score 5 to 5 |
| P15 | Nested spoons | too large | **pass** | shielded 0; partner 5 to 5 (was: shielded 4; partner 5 to 5) |
| P16 | Heads up against heads down (not nested) | pass | pass | score 2 to 2 (was: score 1.83 to 2) |
| P17 | Crowded basket cells | too small | too small | crowding 0 to 0.0417 |
| P18 | Cutlery tray against basket | pass | pass | water 0 to 2.02 |
| P19 | Loading beyond rated capacity | wrong sign | **pass** | mean 4.27 to 3.91 (was: mean 3.6 to 3.67) |
| P20 | Total soil load | too small | too small | mean 4.05 to 4.05 (was: mean 3.43 to 3.43) |
| P21 | Redeposition of particulates | not covered | not covered |  |
| P22 | Clean neighbours of soiled items | pass | pass | clean 0 |
| P23 | End-of-cycle drips from the upper rack | not covered | not covered |  |
| P24 | Arrangement does not matter for easy soils (negative control) | pass | pass | range 0.0682 (was: range 0.174) |
| P25 | Detergent dispenser blocked | too large | too large | protein 0.265; tea 0.402; score 3.67 to 0 (was: protein 0.265; tea 0.43; score 2.67 to 0) |
| P26 | Tablet trapped or dissolving in a dead spot | not covered | not covered |  |
| P27 | Time and temperature trade | too large | too large | score 0 to 3 |
| P28 | Bleachable stains are position-insensitive (negative control) | pass | pass | position 0; bleach 6.66e-16 (was: position -1; bleach -8.88e-16) |
| P29 | Ageing of the soil before the wash | pass | pass | fresh 0; dried 0; baked 3 to 2 |
| P30 | Protein soil responds to hit frequency and chemistry, not to jet strength | pass | pass | pump 1 to 1; enzyme 0.0481 to 0.718 |
| P31 | Starch is bimodal | too small | too small | clusters 1; both 0 |
| P32 | Microwaved milk on glass is persistent | too large | too large | class -2.05; eco 0.25 to 5 |
| P33 | Fat needs temperature and enough water | too small | too small | warm 0; temperature 5.69e-22 to 2.15e-13 (was: warm 0; temperature 6.97e-22 to 2.52e-13) |
| P34 | Thick layers detach as flakes | not covered | not covered |  |
| P35 | Pot interiors | too small | too small | class 1; side 0 to 0 |
| P36 | Water pools in the base recess of inverted cups and mugs | pass | pass | pool 5 |
| P37 | Tilt drains the recess | too small | too small | tilt7 5 to 0.418; tilt15 5 to 0.111 |
| P38 | Plastic stays wet | not covered | not covered |  |
| P39 | Pots and large hollow ware stay wet | not covered | not covered |  |
| P40 | Liquid held at contact points and in narrow gaps | pass | **wrong sign** | held 2.58 to 2.3 (was: held 2.27 to 2.75) |
| P41 | Light plastic items are moved or flipped by jets | not covered | not covered |  |
| P42 | Cutlery dries almost completely (negative control) | not covered | not covered |  |
| P43 | Spots, film and tine marks on glass | not covered | not covered |  |
| P44 | Cutlery comes out clean although it is the most shadowed class | pass | **too small** | class -1.05 (was: class -0.916) |
| P45 | Class ranking in the standard test | pass | **wrong sign** | overall 0; crockery 0.447; glass 0; ranking -0.594 (was: overall 0; crockery 0; glass 0.462; ranking 0.593) |
| P46 | Run-to-run repeatability | too small | too small | spread 0.0342 (was: spread 0.0189) |
| P47 | Everything is wetted within seconds; jets are rare events | pass | pass | f_jet 0.0207; wetted 6.66e-05 (was: f_jet 0.0208; wetted 0.000365) |
| P48 | Detergent does not change where water goes | pass | pass | jets 0 |

## 8. Seeds and tiers

The careful standard load with the capsule on Eco 50, level seeds 1 and 2, simulation seeds 1
to 4, eight washes per tier (`anchors/reports/variance/v7.capsule.eco-*.jsonl`,
`anchors/tiers.anchored-v7.owner-capsule.json`, which the report of every fast wash quotes):

| | `anchored-v7` | This morning (`anchored-v6`) |
|---|---|---|
| Verdicts of soiled items that agree between the tiers | 615 of 688: **89 %** | 662 of 720: 92 % |
| Crockery / cutlery / glass / melamine | 100 % / **77 %** / 95 % / 100 % | 100 % / 85 % / 91 % / 100 % |
| Soiled items clean of 86, official / fast | 68 or 70 / 64 to 67 | 66 to 69 / 67 to 70 of 90 |
| Verdicts that differ between two simulation seeds, official | **0** (none in twelve pairs of washes) | 0.2 |
| Verdicts that differ between two simulation seeds, fast | 1.4 (0 to 2: two knives and a fork) | |
| Verdicts that differ between two level seeds, official | 6 (two glasses, a knife, a saucer, two soup spoons) | 2.2 |
| Verdicts that differ between two level seeds, fast | 8.3 | |

The official tier does not move with its own sampling at all. What moves a verdict is the draw
of the soil (six of 86) and the tier: on cutlery the fast tier disagrees on nearly one verdict
in four, and the disagreement is systematic, not noise: two forks and a knife are clean
officially and dirty at the fast tier in all eight pairs, two forks the other way round. **A
level tuned at the fast tier must not rest on a fork or a knife.** Auto 45-65 was not measured
on this set; the fast-tier note of a wash on Auto quotes the Eco figures and says so.

## 9. What a wash costs

One cold official wash through the game's runner with no parameter flag
(`packages/wash-runner/scripts/wash-load.ts <load> --tier official --cache <an empty
directory>`, under `/usr/bin/time -l`), M3 Pro, about 18:50. **The machine was not free**: one
other official wash of this work ran beside each (load average 7), so the times are upper
bounds; memory is not affected.

| | Standard load, careful, Eco 50 (`iec-13-careful --programme eco_50`, 114 items) | Largest level, careful (`dinner-party-careful`, 49 items, Eco 50) |
|---|---|---|
| Whole wash | **390 s** | **328 s** |
| Scene / exposure / soil / replay / inspection | 13.5 / 363.1 / 1.4 / 8.6 / 2.5 s | 9.4 / 312.0 / 1.4 / 3.0 / 1.2 s |
| What the built-in figures of the runner give for a free machine (10 October) | 269 s | 158 s |
| Peak memory of the process | **1.53 GB** (1.60 GB by the operating system) | **1.17 GB** (1.23 GB) |
| GPU buffers | 160 MB | 131 MB |
| Surface blocks / soil cells | 1,115,120 / 3,550,840 | 775,852 / 2,193,768 |
| The same wash again, exposure from the cache | 21 to 28 s | not timed |
| Fast tier, cold / from the cache | 73 to 92 s on a loaded machine / 7 to 16 s | not timed |

Nearly all of a cold wash is the exposure: four spray states, each a trace of every surface,
and most of that is the machine itself (a load of one plate, or of two spoons, cost 170 to
290 s cold at the official tier this evening). A wash that only changes a soil-side value, the detergent or
the seed of the soil reuses it. Earlier in the evening, with the machine heavily loaded (three
washes of this work and another engineer's load generation), the same two washes took 466 s
(the standard load on Auto 45-65, which its saved level still names; 1.18 GB) and 368 s. A
process that washes eight standard loads in a row grows to 1.62 GB.

## 10. Faces lying against another body

The sub-grid closure that was built today to make such faces keep their soil is not in this
simulation: it is not ready, and it is not in this repository.

**A face that lies a millimetre or two from another body is washed by this model as an open
face wherever a jet, a droplet or the film running over the item can reach it: nothing on the
water side knows that the gap is narrow, so the film there is as thick, as fast and as often
renewed as on a free face. For cutlery that means pieces lying against each other as the
loading physics leaves them (a spoon in the bowl of another with a millimetre and a half
between them, blades side by side, four pieces in one cell) come out as clean as the same
pieces standing apart, so the model under-counts what nesting and crowding cutlery costs, and
no level should rest a verdict on it.**

What does stay dirty is a face that geometry alone keeps from the water: a bowl nested in a
bowl (P04), and a hollow covered all over at under a millimetre, as the set nest of P15 is
(no jet reaches it, 0.02 kg/(m2 s) of water against 1.8 on the open spoon, 8 % of the porridge
left, score 1). The spoons the loader lays into each other do not lie that close: the nested
spoons of the careless standard load score 5, and crowding the cells of the cutlery basket
costs nothing (P17).

Two loads of the phenomena suite that the review of the closure found at fault now are what
their phenomenon describes, each by a set pose that a test holds to its gap
(`packages/sim-verify/src/phenomena/pair-gap.ts`, `suite.test.ts`):

- **P03.** Two IEC plates in one slot of this basket nest: the covered well lay 0.2 to 1 mm
  from its partner over its whole area. A row at half the pitch cannot stand between the
  tines at all (a slot is 14 mm wide and the next tine is in the way), so for this case the
  tines of the rear lane are folded down and the row is set: four parallel pairs 9.1 mm from
  plate to plate, 3.7 to 5 mm between the covered well and the back in front of it, raised
  11 mm to clear the folded tines. The case differs from its controls by the tines as well as
  by the pitch.
- **P15.** The second spoon, laid into the first by the loading physics, slid off and lay
  across it (0.5 cm2 within 1 mm). It is now set behind the first, the back of the first in
  its hollow: 10 cm2 of the hollow within 1 mm, nowhere nearer than 0.5 mm, clear of the
  basket.

## 11. What is delivered

| | |
|---|---|
| The default set | `packages/calibration/anchors/anchored-v7.owner-capsule.json` (12.9 g), with `anchored-v7.json` (reference detergent D) under it and `anchored-v7.owner-capsule.stable.json` beside it |
| Fitted on | the published class means (`std-eu-13.round-robin-ta.detergent-d`, regenerated on the new load: 114 items) and the owner's wash 01 (`owner-wash-01-egg-yolk-eco50`) |
| Valid for | `spotless-sim 0.5.0 water-7`, exposure sources `325c9602e385`, machine data `c887647cbad8`; the staleness guard reads every layer as current |
| The wash runner | `packages/wash-runner/src/defaults.ts` points at it and at `tiers.anchored-v7.owner-capsule.json` |
| The default wash | runs with no flag: `pnpm exec tsx scripts/wash-load.ts tutorial-careful --tier fast` in `packages/wash-runner`, 64 of 64 points |
| Superseded, kept, refused | `anchored-v6*`, `anchored-v5*`, `anchored-v4*`: each file carries `supersededBy`; `SUPERSEDED_ANCHORED` of `anchors/src/scenario.ts` lists them and a test holds the files to the list |
| The registered default of the duty | 0.8, range 0.59 to 1, in `packages/sim-hydraulics/src/params.ts` |

## 12. Commands

```
cd packages/sim-verify
pnpm exec tsx scripts/demo-washes.ts --describe-only --out <dir>      # the frozen loads, copied to calibration/anchors/loads
pnpm exec tsx phenomena/builder/build-loads.ts --force                 # the 36 loads of the suite
cd ../calibration
pnpm exec tsx anchors/scripts/make-records.ts                          # the literature record on the new load
pnpm exec tsx anchors/scripts/fit.ts --name anchored-v7 --doc docs/calibration/anchoring-v7.md
pnpm exec tsx anchors/scripts/make-owner-set.ts --params anchors/anchored-v7.json
pnpm exec tsx anchors/scripts/supersede.ts anchored-v6 --by anchored-v7 --why "..."
pnpm exec tsx anchors/scripts/check.ts
pnpm exec tsx anchors/scripts/study.ts anchors/reports/tables.v7.cases.json anchors/reports/tables.v7.json
pnpm exec tsx scripts/spotless-fit.ts predict records/owner/owner-wash-01-egg-yolk-eco50.measured.json \
  --params anchors/anchored-v7.owner-capsule.json
pnpm exec tsx anchors/scripts/literature-surface.ts anchors/reports/surface.v7.grid.json \
  anchors/reports/surface.v7.jsonl --set anchored-v7
pnpm exec tsx anchors/scripts/fit-owner.ts --started-from anchored-v7 --fit prog.soakDuty --no-fit \
  --name duty-v7 --surface anchors/reports/surface.v7.jsonl --out anchors/reports/v7 \
  --grid "prog.soakDuty=0.6,0.7,0.8,0.9,1"
pnpm --filter @spotless/sim-core exec tsx scripts/variance-study.ts --tiers official --level-seeds 1,2 \
  --sim-seeds 1,2,3,4 --params <anchors>/anchored-v7.owner-capsule.json --dose-g 12.9 \
  --cache <anchors>/out/exposure-cache --out <anchors>/reports/variance/v7.capsule.eco-off.jsonl   # and --tiers fast
pnpm exec tsx anchors/scripts/tier-agreement.ts --set anchored-v7.owner-capsule \
  eco_50=anchors/reports/variance/v7.capsule.eco-off.jsonl,anchors/reports/variance/v7.capsule.eco-fast.jsonl
cd ../sim-verify
pnpm exec tsx src/phenomena/cli.ts --tier fast --params ../calibration/anchors/anchored-v7.owner-capsule.json \
  --dose-g 12.9 --detergent-name "Finish Powerball Ultimate" --out ../calibration/anchors/reports/v7/phenomena
pnpm exec tsx scripts/pair-gap.ts plates-9 plate_6 well plate_5      # how close two items of a suite load lie
```
