# Owner wash 01: the calibration

> **Superseded as the description of the game's default on the evening of 11 October 2026.**
> The upper basket of the machine was corrected from the owner's floor-level photograph that
> afternoon, and the standard loads were settled again on it. The default is now
> `anchored-v7.owner-capsule` on `spotless-sim 0.5.0 water-7`: `anchoring-v7.md`. What this
> note found about the wash stands and was checked again there: the duty of the soak (0.8,
> interval 0.59 to 1) is now also the registered default of `prog.soakDuty`, so section 10's
> "unchanged, 0.5" and section 13's remark on registry defaults no longer hold. One value of
> the set moved (`soil.bleachRate`, 0.001 to 0.0009). The tables of sections 6 to 8 are of the
> machine as it was drawn before the correction and of loads that no longer exist; their
> successors are in `anchoring-v7.md`. The `anchored-v6*` files are kept, say in their own
> files that they are superseded, and are not to be washed with.

11 October 2026. This is the calibration that follows from the owner's first test wash: four
plates of fork-spread egg yolk on Eco 50 with one Finish Powerball Ultimate capsule, in his
Bosch SMV4HAX40G, on 10 October. The prediction registered before the wash is
`owner-wash-01-prediction.md`; what he found and how it compares is `owner-wash-01-result.md`.
Neither is changed here. Paths written as `anchors/...`, `scripts/...`, `src/...` and
`records/...` are relative to `packages/calibration`.

**This is one wash.** Four plates, judged by eye and read off photographs, with yolk that was
not weighed. It moves one number and leaves wide intervals on everything it touches.

## 1. What the wash settled, in plain words

- **The long soak of Eco 50 sprays more than half the time.** Last night's default had the pump
  on for half of the soak (`prog.soakDuty` 0.5, the value the label's energy points to). Under
  it the model leaves every one of the four plates visibly soiled, whatever amount of yolk a
  plate is taken to have carried within what "about 3 g" allows. Two plates came out spotless.
  The calibrated value is **0.80**. The tool's 95 % profile interval is **0.59 to 1** (1 is the
  upper end of the range: continuous circulation is not excluded).
- **Nothing else moved.** What two hours at 80 C cost yolk, what turning a plate to the wall
  costs and how uneven a fork-spread layer is were each examined with the duty. Each stays at
  its registered value: moving it gains at most 0.16 log units, and its profile interval is
  everything that was scanned (for the oven penalty its whole registered range). The wash
  does not measure them.
- **Why the oven-dried plates carried ten to thirty times the predicted residue.** The
  prediction was made with the soak circulated throughout. At a duty of 0.8 the same model,
  with the same 16 % penalty for two hours at 80 C and the same cost of facing the wall, leaves
  101 mm2 on the turned oven-dried plate (seen: about 100) and 11 mm2 on the one facing the
  middle (seen: about 25), and still cleans the air-dried plate facing the middle (0.2 mm2).
  The other reading, a continuous soak with a larger oven penalty (26 % in place of 16 %), fits
  as well: the two are confounded (posterior correlation 0.83), and the registered penalty is
  kept because nothing asks for the other.
- **The small plate** came out spotless. With 3 g on it the calibrated model leaves 305 mm2;
  with a film as thin as on the large plates (1.45 g) it comes clean. Its amount was not
  weighed, so it says little either way.

## 2. The measured record

`packages/calibration/records/owner/owner-wash-01-egg-yolk-eco50.measured.json`, written from
the planned record by `packages/calibration/scripts/make-owner-wash-01-measured.ts`; it
validates (`spotless-fit validate`). The load, the poses, the programme and the capsule are
those of the planned record.

| Plate | Area, mm2 (range) | Fitted as | Verdict by eye (owner) | Patches on the photograph | Photographs |
|---|---|---|---|---|---|
| 9121, oven-dried, turned to the left wall | 100 (50 to 200) | `visible_area` | not clean | 7 | IMG_9121, IMG_9127 |
| 9122, oven-dried, facing the middle | 25 (10 to 60) | `visible_area` | not clean | 5 | IMG_9122, IMG_9128 |
| 9123, air-dried, facing the middle | 0 (0 to 5) | `visible_area` | clean | 0 | IMG_9123, IMG_9129 |
| 9124, small, air-dried, turned to the right wall | 0 (0 to 5) | `visible_area` | clean | 0 | IMG_9124, IMG_9130 |

- **Who measured what.** The owner ran the wash, judged the plates by eye and photographed
  them. The areas and the counts are the lead's reading of his photographs (yellow pixels at
  three thresholds, scaled by the diameter of the well), not his and not a laboratory
  measurement. The record says so in `provenance`, per method.
- **One residue, one fitted observation.** The area is fitted. The owner's verdict and the
  count of patches are recorded and predicted beside it and are not fitted (`"fitted": false`):
  they are second readings of the same residue.
- **The range is the uncertainty.** An area is compared with the prediction in
  ln(area + 5 mm2); the range of the comparison is read as the central 90 % of the error of
  the reading (a deviation of 0.40 for 100 mm2, 0.45 for 25 mm2, 0.21 for a reading of
  nothing). The model adds 0.5 for what it does not explain, where the thick places of the
  layer lay: measured on the model itself, the same four plates laid out with eight layout
  seeds differ by 0.15 to 0.60 in that logarithm.
- **The amount is an input that was not measured.** About 3 g was asked for; nothing was
  weighed. The record takes 3 g with a standard uncertainty of 1 g for the three large plates
  and 2.1 g with 0.9 g for the small one (between a film as thin as on the others, 1.45 g, and
  the 3 g asked for). It carries this as nine input scenarios (`sim.scenarios`): the amounts at
  -2.4 to +2.4 standard deviations of their logarithm, weighted with the normal density. Every
  evaluation replays all nine, and the likelihood of a plate is the weighted mean over them.
  The amount is integrated out, not fitted and not taken as fact.
- **The ridges and bare stripes** of a fork-spread layer are in the model twice: the bare
  stripes as the covered share of the well (0.67, from the photographs before the wash), the
  ridges as the spread of a spread layer (`soil.applicationCv[spread]`, 0.3). The spread is a
  parameter of the model, examined in section 4, not an input of this record.
- **Not reported**: the display time and the clock times of start and finish. The course of
  the run is the programme as written. The second pair is read as air-dried on the counter
  (his README says "air fried"; to be confirmed with him).

## 3. Before fitting: the four plates on the code as it stands

`spotless-sim 0.5.0 water-6`, official tier, the inputs of the prediction (3 g on every plate,
layout seed 20261010; the planned record).

| Plate | Seen | (a) Pre-registered regime: soak circulated throughout | (b) Last night's default: `anchored-v5.owner-capsule`, duty 0.5 |
|---|---|---|---|
| 9121 (oven, turned) | about 100 mm2 (50 to 200), score 1, not clean | 10.8 mm2, 14 specks, score 2, not clean | 2305 mm2, 477 specks, score 0, not clean |
| 9122 (oven, facing in) | about 25 mm2 (10 to 60), score 2 (1 to 3), not clean | 0.9 mm2, 2 specks, score 4, **clean** | 692 mm2, 392 specks, score 0, not clean |
| 9123 (air, facing in) | nothing (under 5), score 5, clean | 0, score 5, clean | 115 mm2, 84 specks, score 1, **not clean** |
| 9124 (small, air, turned), with 3 g | nothing (under 5), score 5, clean | 49.8 mm2, 60 specks, score 2, not clean | 3291 mm2, score 0, not clean |
| Log likelihood of the measured record (amounts integrated out) | | -5.55 | -10.18 |

(a) is `anchored-v5.owner-capsule` with `prog.soakDuty` 1 and the bleach rate at its default,
the choices of anchored-v4 that still exist as parameters. On water-6 it reproduces the
registered prediction, which was made on water-5, to the square millimetre (11, 0.9, 0 and 49
to 50 mm2 there).

Under (b) no scenario of the amounts makes an air-dried plate likely to come clean: the share
of the amount scenarios in which a plate reads clean is 0.01, 0.06, 0.18 and 0.06 for the four
plates. Under (a) it is 0.38, 0.62, 0.82 and 0.62.

## 4. The fit

### 4.1 How

Two records of different kinds, each through the calibration tool's own likelihood and
weighted by what it states (`packages/calibration/anchors/scripts/fit-owner.ts`):

| Record | Weight | What is fitted | How it is evaluated |
|---|---|---|---|
| `owner-wash-01-egg-yolk-eco50` (measured) | 1 | four visible areas with their ranges and the model term | the tool's evaluator at the official tier, nine replays per evaluation (the amount scenarios), on the capsule's composition |
| `std-eu-13.round-robin-ta.detergent-d` (literature) | 0.25 | the crockery, cutlery and glass class means with their stated uncertainties (1.1, 0.51, 0.93) | read from a table of 144 washes of the standard load at the official tier (`anchors/scripts/literature-surface.ts`: duty 0.5 to 1, bake rate 1e-5 to 1e-4, the protease of detergent D 0.012 to 0.02, level seeds 1 and 2), linear between its values; the protease of detergent D is that record's own nuisance and is chosen at every point |

The prior of every parameter is the tool's (the registered range). The prior of the duty is
the label's energy: 0.53 with a deviation of 0.49 in its logarithm, which gives continuous
circulation the 0.85 log units the label gives it (`anchoring-v5.md` section 3). The six
in-machine egg-yolk rates are a constraint: the rate was not moved, and the bench tile is run
at the fitted set (all six within tolerance, section 8).

### 4.2 Which parameters, by sensitivity

`spotless-fit sensitivity` on the measured record at the calibrated set
(`anchors/reports/owner-wash-01/sensitivity.txt`):

| Combination of parameters (loadings in prior deviations) | Information, in prior precisions | Reading |
|---|---|---|
| +0.70 `liq.xProtease` +0.59 `prog.soakDuty` +0.27 `soil.egg_yolk.rateRef` -0.23 `soil.applicationCv[spread]` | 704 | fixed by the record |
| +0.88 `soil.supplyExchange` +0.34 `soil.bakeRate` -0.23 `soil.applicationCv[spread]` | 3.5 | constrained |
| +0.68 `soil.bakeRate` +0.58 `soil.applicationCv[spread]` +0.41 `soil.egg_yolk.rateRef` | 0.42 | left to the prior |
| three more | under 0.06 | left to the prior |

Four plates fix one thing: how much cleaning reaches fork-spread yolk on Eco 50 with this
capsule. The protease level of the capsule, the duty of the soak and the reaction rate all
load on it and cannot be told apart by this wash (each is known to 5 to 14 % of its prior if
the others were known, and to 70 to 92 % with them free). The rate is held by the six bench
rates and the protease of the reference detergent by the published class means; the protease
of the capsule (0.03, from its maker's patents) is held by nothing but its source. **The duty
is the one moved, and it carries whatever of the three is really off.** The second combination
is the contrast between the two oven-dried plates, which the cost of turning and the oven
penalty share.

### 4.3 The joint picture

Joint log posterior relative to the delivered point (duty 0.8, everything else registered;
-6.68), official tier, 98 evaluations of nine replays each
(`anchors/reports/owner-wash-01/grid.*.md`). Positive is better. A fall of 1.92 is the edge of
a 95 % profile interval; differences under about 0.2 are not resolved.

Duty against what two hours at 80 C do (`soil.bakeRate`; 3e-5 is the registered value: yolk
16 % slower; 1e-5: 6 %; 5.5e-5: 26 %; 1e-4: 41 %):

| Duty | 1e-5 | 1.7e-5 | **3e-5** | 5.5e-5 | 1e-4 |
|---|---|---|---|---|---|
| 0.6 | -1.51 | -1.47 | -1.86 | -2.84 | -5.42 |
| 0.7 | -0.48 | -0.36 | -0.62 | -1.01 | -3.05 |
| 0.75 | -0.56 | -0.24 | -0.17 | -0.52 | -2.11 |
| **0.8** | -0.49 | -0.26 | **0.00** | -0.30 | -1.65 |
| 0.85 | -0.39 | -0.21 | -0.13 | -0.10 | -1.22 |
| 0.9 | -0.68 | -0.24 | -0.14 | +0.12 | -0.69 |
| 1 | -1.23 | -0.91 | -0.27 | -0.18 | -0.47 |

Duty against what turning a plate costs (`soil.supplyExchange`, the exchange of the water on
a face at which its liquor is half spent; 0.02 registered; smaller costs a turned face less):

| Duty | 0.005 | 0.01 | **0.02** | 0.04 | 0.08 |
|---|---|---|---|---|---|
| 0.6 | -1.15 | -1.20 | -1.86 | -2.81 | -4.95 |
| 0.7 | -0.34 | +0.06 | -0.62 | -1.25 | -2.63 |
| 0.75 | -0.14 | -0.23 | -0.17 | -0.73 | -1.86 |
| **0.8** | +0.14 | -0.20 | **0.00** | -0.54 | -1.40 |
| 0.85 | -0.34 | +0.16 | -0.13 | -0.26 | -1.04 |
| 0.9 | -0.68 | -0.16 | -0.14 | -0.13 | -0.82 |
| 1 | -0.78 | -0.86 | -0.27 | -0.42 | -0.47 |

Duty against how uneven a spread layer is (`soil.applicationCv[spread]`, 0.3 registered; the
dossier gives real smears 0.3 to 0.5):

| Duty | 0.2 | **0.3** | 0.4 | 0.5 |
|---|---|---|---|---|
| 0.6 | -0.94 | -1.86 | -4.61 | -8.48 |
| 0.7 | -0.35 | -0.62 | -2.42 | -5.42 |
| 0.75 | -0.44 | -0.17 | -1.66 | -4.47 |
| **0.8** | -0.28 | **0.00** | -1.28 | -3.76 |
| 0.85 | -0.72 | -0.13 | -0.89 | -2.89 |
| 0.9 | -1.37 | -0.14 | -0.51 | -2.26 |
| 1 | -1.46 | -0.27 | -0.36 | -1.73 |

Along the duty at the registered values, the three parts of the posterior:

| Duty | Owner's wash (log likelihood) | Published class means (weighted) | Label's energy (prior) | 9121 / 9122 / 9123 with 3 g, mm2 | Published means reproduced: crockery / cutlery / glass (milk glasses) |
|---|---|---|---|---|---|
| 0.5 (tool, start) | -10.2 | | | 2305 / 692 / 115 | 3.66 / 4.51 / 2.38 (0.96) |
| 0.6 | -7.95 | -0.56 | -0.03 | 940 / 177 / 17 | 3.53 / 4.58 / 2.95 (1.85) |
| 0.7 | -6.61 | -0.53 | -0.16 | 287 / 40 / 2.0 | 3.46 / 4.62 / 3.43 (2.58) |
| 0.75 | -6.06 | -0.55 | -0.25 | 160 / 20 / 0.7 | 3.43 / 4.64 / 3.65 (2.92) |
| **0.8** | -5.79 | -0.55 | -0.35 | 102 / 11 / 0.2 | 3.41 / 4.63 / 3.15 (2.15) |
| 0.85 | -5.80 | -0.54 | -0.46 | 49 / 6.0 / 0 | 3.37 / 4.58 / 3.28 (2.36) |
| 0.9 | -5.69 | -0.55 | -0.58 | 26 / 3.2 / 0 | 3.34 / 4.55 / 3.41 (2.55) |
| 1 | -5.55 | -0.57 | -0.84 | 11 / 0.9 / 0 | 3.28 / 4.49 / 3.65 (2.92) |
| Seen / published | | | | 100 / 25 / 0 | 3.68 / 4.67 / 3.43 |

Reading:

- **The owner's wash alone rises all the way to a continuous soak**, by 0.24 between 0.8 and
  1. It cannot tell them apart: with the amounts unknown, a continuous soak that left a tenth
  of what was seen is explained by plates that carried a quarter more yolk (section 4.5). It excludes 0.5
  (4.4 log units below 0.8) and nearly excludes 0.6 (2.2).
- **The published class means do not decide** between 0.6 and 1: with the protease of the
  reference detergent free between 0.012 and 0.02 they are reproduced equally well (within
  0.04 log units). Only 0.5 is disfavoured (0.14), as the anchoring found.
- **The label's energy decides between 0.8 and 1**: a duty of 1 costs 0.49 log units more
  than 0.8. It is a weak statement (the model's own energy error spans 0.15 to 0.9), and it
  is the whole reason the estimate is 0.8 and not 1.
- **With 3 g on every plate, 0.8 is where each plate lies inside its range.** That is the
  second reason, and the one the prediction can be checked against.

### 4.4 The tool's fit

`fitRecords` on both records, Nelder-Mead from last night's default, profile of every fitted
key (`anchors/reports/owner-wash-01/fit.duty.txt`, `fit.duty-bake.txt`):

| Fit | Parameter | Registered | Estimate | 95 % interval | Verdict | Log posterior |
|---|---|---|---|---|---|---|
| Duty alone | `prog.soakDuty` | 0.5 | **0.801** | **0.59 to 1 (profile; 1 is the bound)** | identified (posterior over prior deviation 0.36) | -6.681 (from -10.869 at 0.5) |
| Duty and oven penalty | `prog.soakDuty` | 0.5 | 0.898 | 0.50 to 1 (normal) | weak, confounded with the bake rate (0.83) | -6.561 |
| | `soil.bakeRate` | 3e-5 | 5.4e-5 | 1e-5 to 1e-4: its whole range | weak, confounded with the duty (0.83) | |

The profile of the duty (log posterior, the others re-fitted): 0.55: -9.39, 0.59: -8.62,
0.62: -8.02, 0.71: -7.25, 0.80: -6.68, 0.91: -6.82, 1: -6.95. The prior centre of the label
(0.53) costs 3.3 log units. Posterior predictive check: p = 0.80 (the record does not scatter
more than the model allows). In the two-key fit the record fixes one combination (+0.74 bake
rate -0.68 duty, information 16.5) and leaves the other to the prior (0.57).

**What is delivered is the one-key fit, rounded: 0.8.** The two-key optimum is 0.12 log units
better, which is nothing; it would move a constant of the ageing law that the wash does not
identify, and with it every heat-aged soil of the game.

### 4.5 If every plate carried more, or less, than was asked for

The scenarios integrate the amount of each plate out on its own. An error that all plates
share is not covered by that. The same joint posterior on copies of
the record with every amount scaled:

| Every plate carried | Joint log posterior at a duty of 0.5 / 0.6 / 0.7 / 0.8 / 0.9 / 1 | Highest at |
|---|---|---|
| 20 % less (2.4 g) | -8.01 / -6.73 / -6.50 / -6.51 / -7.21 / -7.80 | 0.7 to 0.8 |
| what was asked for (3 g) | -10.87 / -8.54 / -7.30 / -6.68 / -6.82 / -6.95 | 0.8 |
| 25 % more (3.75 g) | / -11.66 / -9.35 / -8.16 / -7.55 / -7.22 | 1, the bound |

The duty delivered is "the duty if the plates carried about 3 g". A quarter more yolk on every
plate and the wash says the soak circulates throughout, as the prediction assumed. Weighed
plates remove this; nothing else does.

## 5. What moved, what did not, and why

| Key | Last night's default | Calibrated | Share of its range | Moved by | How well identified |
|---|---|---|---|---|---|
| `prog.soakDuty` | 0.5 | **0.8** | 33 % of 0.1 to 1 | the owner's wash 01 (both air-dried plates spotless; 25 and 100 mm2 on the oven-dried), with the label's energy holding it below 1 | 95 % profile interval 0.59 to 1; confounded with the capsule's protease level and the reaction rate (one combination), and with the oven penalty (0.83) |
| `soil.bleachRate` | 0.0009 | 0.001 | 4 % of 0.0003 to 0.003 | the refit of the published crockery mean at the new duty (the floor rule of the anchoring: at the default every tea item reads dirty) | bounded from below only, as before; the honest range is 0.0009 to 0.002 |
| `liq.xProtease` of reference detergent D (the base set only; the capsule has its own 0.03) | 0.02, its search bound | 0.016 | 8 % of 0 to 0.05 | the refit of the published cutlery and glass means at the new duty | the scan is flat between 0.016 and 0.02 (0.04 log units) |

Not moved, and what the wash says of each:

- **Two hours at 80 C** (`soil.bakeRate` 3e-5: a bake index of 0.19, yolk 16 % slower, its lag
  24 % longer). The model's law is the dossier's (soils 7.4, 8.3: B = 1 - exp(-k_B t), k_B =
  3e-5 1/s at 80 C, 43 kJ/mol, reaction-erosion times 1 - 0.8 B), checked line by line: there
  is no error of transcription to correct. Its constants are the dossier's "estimated
  placeholders", pinned by two statements (2 h at 80 C is a bake index of about 0.2; baked
  yolk at 0.8 runs at 0.3). The dossier has one verified fact near 80 C, that yolk gels above
  about 70 C, and no number for what that costs. If the wash had asked for more, the constant
  to move would have been k_B at 80 C, not a new knob. It does not ask: the profile over the
  whole registered range (6 % to 41 % slower) stays within 0.6 log units of its best, and the
  registered value costs 0.12. The lead's first suspect, the oven penalty, is not needed once the soak sprays
  0.8 of the time, and is not excluded either.
- **Turning a plate to the wall** (`soil.supplyExchange` 0.02). The turned oven-dried plate
  carried about four times the area of its partner (the ranges allow 0.8 to 20 times). The
  calibrated model gives nine times (101 against 11 mm2). The profile leans towards a smaller
  cost (0.005 to 0.01 are 0.16 better than 0.02) and reaches across the grid (0.005 to 0.08
  within 0.63): not identified. The sign is confirmed by a real wash for the first time; the
  size is not measured, and the two plates also differ in lean and in place in the row.
- **How uneven a fork-spread layer is** (`soil.applicationCv[spread]` 0.3). It cannot be
  separated from the duty: a more uneven layer and a longer soak leave the same specks (the
  first combination of section 4.2). It is fixed at its registered value, which is also the
  best of the grid; 0.2 costs 0.28, 0.4 costs 0.36, 0.5 costs 1.73.
- **The reaction rate and the capsule's protease level**: not fitted. The bench rates hold
  the first (section 8). Nothing holds the second but its source; if the capsule carries less
  protease than 0.03, the soak sprays more than 0.8, and the game's verdicts are the same.

## 6. The four plates before and after

Official tier. "With 3 g" is the planned record (the inputs of the prediction). "Amounts
integrated" is the measured record: the share of the amount scenarios, by weight, in which the
plate reads clean, and the 10 to 90 % range of the area over them.

| Plate | Seen | Pre-registered (v4, water-5) | Last night's default (v5) | **Calibrated (v6)**, with 3 g | Calibrated, amounts integrated |
|---|---|---|---|---|---|
| 9121 (oven, turned) | about 100 mm2 (50 to 200), 7 patches, score 1, not clean | 11 mm2, 13 to 14 specks, score 2, not clean | 2305 mm2, score 0, not clean | **101 mm2**, 107 specks, score 1, not clean | 2.5 to 1750 mm2; clean in 0.18 |
| 9122 (oven, facing in) | about 25 mm2 (10 to 60), 5 patches, score 2 (1 to 3), not clean | 0.9 mm2, 2 specks, score 4, clean | 692 mm2, score 0, not clean | **10.7 mm2**, 10 specks, score 3, not clean | 0 to 430 mm2; clean in 0.38 |
| 9123 (air, facing in) | nothing (under 5), score 5, clean | 0, score 5, clean | 115 mm2, score 1, not clean | **0.2 mm2**, 1 speck, score 4, clean | 0 to 50 mm2; clean in 0.62 |
| 9124 (small, air, turned) | nothing (under 5), score 5, clean | 49 to 50 mm2 with 3 g, not clean; clean with 1.45 g | 3291 mm2 with 3 g, not clean | 305 mm2 with 3 g; **12.6 mm2 with 2.1 g**, not clean | 0 to 785 mm2; clean in 0.38 |
| Log likelihood of the measured record | | -5.55 (its regime on water-6) | -10.18 | **-5.79** | |

Each of the three large plates is inside its range with the amounts as asked for, for a stated
reason: the same model with the soak spraying 0.8 of the time. Three things the calibrated
model does not get right:

- **9122 is at the low edge of its range** (10.7 against 10 to 60), and its score is 3 where
  the photograph gives 2.
- **The small plate** reads not clean unless it carried about 1.6 g or less. Nothing says it
  did not; nothing says it did.
- **The form of the residue.** The model leaves about a hundred specks of a square millimetre
  where the photograph shows seven patches of some 15 mm2, at the edge of the well, where the
  photographs before the wash show the yolk pooled. The model's unevenness is drawn on a 2 mm
  lattice; a fork leaves it on centimetres. The area is fitted, the count is not (it is in the
  record as a check: 107 specks predicted against 7 patches, 10 against 5).

## 7. The published class means before and after

Reference detergent D, 20 g, Eco 50 on the course of the record, settled careful load, official
tier, four washes each (`anchors/reports/fit.anchored-v6.md`, `tables.v6.json`):

| | Crockery | Plates and bowls / tea items | Cutlery | Glass | Milk glasses | All | Items clean of 118 | Soiled items clean of 90 |
|---|---|---|---|---|---|---|---|---|
| Published (Bosch SMV6ECX51E, eco, detergent D) | 3.68 | not published | 4.67 | 3.43 | | 4.17 | about 70 % | |
| Last night's default, `anchored-v5` | 3.62 to 3.70 | 5.00 / 1.8 to 2.0 | 4.46 to 4.55 | 2.35 to 2.40 | 0.92 to 1.00 | 3.93 to 4.01 | 89 to 90 | 61 to 62 |
| **Calibrated, `anchored-v6`** | 3.68 to 3.79 | 4.95 to 5.00 / 2.0 to 2.4 | 4.56 to 4.65 | 3.15 | 2.15 | 4.12 to 4.20 | 92 to 96 | 64 to 68 |

By soil (items clean; mean score), last night's default against calibrated:

| Soil | Items | `anchored-v5` | `anchored-v6` |
|---|---|---|---|
| Egg yolk | 20 | 10 or 11; 3.5 | 11 to 13; 3.8 to 3.9 |
| Milk (glasses) | 13 | 0 or 1; 0.9 to 1.0 | **3 or 4; 2.2** |
| Tea | 10 | 4; 1.8 to 2.0 | 4; 2.0 to 2.4 |
| Margarine | 14 | 13 or 14 | 13 or 14 |
| Minced meat, porridge, spinach | 6, 20, 7 | all | all |

The glass class was 1.1 standard deviations low and is now 0.3 low; milk glasses come partly
clean where none did. Tea is where it was, with the bleach rate refitted one step up (0.001;
at 0.0009 and the new duty the tea items read 1.15: a longer soak washes more soil into the
liquor, which spends the bleach). The whole-load mean is the published one. The share of items
clean (78 to 81 %) is above the published "about 70 %", as it was.

## 8. Elsewhere under the calibrated set

### 8.1 The owner's capsule (12.9 g) on Eco 50 as written: careful against careless

Official tier; the standard loads of `packages/loader/loads` as the anchoring holds them;
level seeds 1 and 2 (`anchors/reports/tables.v6.json`).

| Case | Crockery | Plates / tea | Cutlery | Glass | Milk glasses | All | Items clean of 118 | **Soiled items clean of 90** | Last night's default |
|---|---|---|---|---|---|---|---|---|---|
| **Careful** (4 washes) | 3.96 to 4.01 | 4.95 to 5.00 / 3.0 to 3.1 | 4.56 to 4.65 | 3.00 to 3.05 | 1.92 to 2.00 | 4.19 to 4.24 | 94 to 97 | **66 to 69** | 57 to 60 |
| **Careless**, tablet tray blocked (2) | 1.18 | 1.90 / 0.00 | 3.81 to 3.87 | 1.05 | 0.00 | 2.62 to 2.64 | 61 or 62 | **33 or 34** | 10 to 12 |
| Careless with the tablet freed (2) | 3.50 to 3.56 | 4.57 / 2.3 to 2.5 | 4.66 | 2.88 to 2.98 | 2.54 to 2.69 | 4.09 to 4.12 | 89 or 90 | 61 or 62 | 46 to 49 |
| Careful, fast tier (1) | 3.94 | 4.95 / 3.0 | 4.59 | 3.10 | 2.08 | 4.20 | 96 | 68 | 53 to 55 |
| Careless, fast tier (1) | 1.15 | 1.86 / 0.00 | 3.82 | 1.23 | 0.00 | 2.64 | 60 | 32 | |
| Careful, the stable-protease layer (1) | 3.99 | 5.00 / 3.0 | 4.61 | 3.20 | 2.23 | 4.24 | 95 | 67 | |

By soil, careful / careless / careless with the tablet freed (items clean): egg yolk 11 to 13
of 20 / 0 / 14 or 15; milk 3 of 13 / 0 / 1 or 2; tea 6 of 10 / 0 / 5; margarine 13 or 14 of
14 / 12 / 12; minced meat 6 of 6 / 0 / 5; porridge 20 of 20 / 15 or 16 / 17 or 18; spinach 7
of 7 / 6 / 6.

Two things changed for the game, and both follow from more cleaning reaching every item:

- **A blocked tablet costs less than it did** (33 or 34 of 90 clean in place of 10 to 12): in
  a soak that sprays 0.8 of the time, porridge and spinach come off in water alone (15 or 16
  of 20 and 6 of 7), where they stayed on at 0.5. Egg, milk, meat and tea still all fail.
- **Stacking alone costs less than it did**: careful against careless with the tablet freed
  is 66 to 69 against 61 or 62 (it was 57 to 60 against 46 to 49). Seventeen verdicts differ
  between the two loads at level seed 1, in both directions (eleven items clean only in the
  careful load, six only in the careless one: five forks and a glass).

### 8.2 The stacking pairs

The mistakes of the careless load one by one, tablet freed, official tier (score careful
against careless; fast tier in brackets), and the pairs of the phenomena suite:

| Mistake | Item | Careful | Careless, calibrated | Careless, last night's default |
|---|---|---|---|---|
| Plate turned away | `dessert_plate_01` | 5 | **5, clean** (fast 5) | 1 or 2 |
| Plate turned away | `saucer_02` | 5 | 1 or 0 (fast 0) | 2 or 1 |
| Bowl face down flat | `dessert_bowl_02` | 5 | 2 (fast 5) | 1 |
| Spoon lying in another | `soup_spoon_12`, `soup_spoon_13` | 5 | 5 (fast 5) | 5 |
| Plate over another | `melamine_plate_02` | 5 | 5, and holds water (fast the same) | the same |

The pairs of the phenomena suite with the capsule on Eco 50
(the official pairs are in `anchors/reports/owner-wash-01/phenomena/`; the fast report of the
whole suite is in the repository's history, since two of its phenomena compared programmes and
were removed; the suite's own loads and soils):

| Pair | Official, calibrated | Fast, calibrated | Official, last night's default | Reading |
|---|---|---|---|---|
| P02 plate turned away (2 g of oven-dried yolk on a dessert plate) | 0.005 % against 0.010 % of the yolk left; score 2 against 2 | 0.009 % against 0.015 %; 2 against 2 | 3.6 % against 4.8 %; 0 against 0 | the turned face keeps twice the residue (the owner's oven-dried pair: four times, 0.8 to 20); no score step, before or after |
| P04 bowl nested in another | nested: 5.3 % of the porridge left, score 0; apart: score 5 | 3.9 %, score 0; 5 | 12 %, score 0 | holds: the covered bowl stays dirty |
| P14 platter face to the wall | 5 against 5; renewal of the water 34 to 4.8 1/s | 5 against 5 | 2 against 1 | **lost**: both faces come clean now |
| P15 spoon lying in another | shielded spoon 4, partner 5 | 4, 5 | 4, 5 | unchanged: still too clean (expected 0 to 1) |
| P25 blocked tablet | plate 3 to 0, tea cups 1.5 to 0 | 3 to 0, 2.5 to 0 | plate and cups dirty either way | holds on the score; with the tablet blocked 27 % of the yolk and 42 % of the tea still go, above the 20 % the checklist allows |
| P06 lower arm held (fast) | | plates 4.71 to 4.14 | 0.14 against 0.14 | now a score change: pass |
| P03 plates two to a slot (fast) | | 5 to 0 on halving the pitch | 0 against 0 | now too large (expected -0.5 to -1.5) |

The whole suite at the fast tier (48 phenomena, 82 washes): **17 pass, 14 too small, 6 too
large, 1 wrong sign, 9 out of scope, 1 error**; under last night's default 15, 17, 4, 2, 9, 1.
Against it: P06, P29 and P44 now pass; P10 goes from the wrong sign to too small; P03
from too small to too large; P14 from pass to too small. With the default at a duty of 0.75
last night's engineer had 16, 15, 6, 1, 9, 1; the calibrated set differs from that run in P29
alone.

What this says for the game: a turned plate, a platter against the wall and a blocked tablet
each cost less than they did, because a soak that sprays 0.8 of the time cleans what a soak at
0.5 left. That is what the owner's plates show (the turned air-dried plate came out spotless),
and it narrows the room in which stacking decides a verdict. The bowl nested in another, the
bowl laid flat and the held arm still decide theirs.

### 8.3 The bench anchors

`anchors/scripts/check.ts` on `anchored-v6`: all checks pass. The six in-machine egg-yolk
rates (% per minute, simulated against published): 0.84 / 0.85, 1.79 / 1.75, 0.17 / 0.17,
2.47 / 2.59, 0.68 / 0.69, 4.77 / 4.66, all within tolerance and unchanged (the bench tile is
not heat-aged and has no soak). The IKW programme leaves 72 % of the egg yolk, 92 % of the
starch mix, 88 % of the minced meat and 63 % of the tea: partial, as it must be.

### 8.4 Fast against official

The careful standard load with the capsule, level seeds 1 and 2, simulation seeds 1 to 4,
eight washes per tier (`anchors/reports/variance/v6.capsule.eco-*.jsonl`,
`anchors/tiers.anchored-v6.owner-capsule.json`, which the report of every fast wash quotes):

| | Eco 50, calibrated | Eco 50, last night's default |
|---|---|---|
| Verdicts of soiled items that agree between the tiers | 662 of 720: 92 % | 680 of 720: 94 % |
| Crockery / cutlery / glass / melamine | 100 % / 85 % / 91 % / 100 % | 92 % / 93 % / 100 % / 100 % |
| Soiled items clean of 90, official / fast | 66 to 69 / 67 to 70 | 56 to 60 / 53 to 55 |
| Verdicts that differ between two simulation seeds, official | 0.2 (0 or 1; one fork) | 0.6 |
| Verdicts that differ between two level seeds, official | 2.2 | 3.2 |

The fast tier now agrees on every plate and bowl, and disagrees more on cutlery and glasses:
egg forks and milk glasses were all dirty at both tiers under last night's default and now sit
near their thresholds (3 forks, 3 or 4 knives and 1 or 2 glasses flip per wash).

## 9. How the prediction did

Registered on water-5 with `anchored-v4.owner-capsule`, the soak circulated throughout.

| What it said | What happened | |
|---|---|---|
| "The model is sure of the order (9123 cleanest, then 9122, then 9121) and of little else" | that order | held |
| Both plates facing the middle clean; 9123 "the firmest prediction" | 9123 spotless; 9122 not clean (4 or 5 specks, about 25 mm2 against 0.9) | half |
| 9121 "on the edge of clean": 11 mm2, a dozen specks at the outer part of the well | not clean, about 100 mm2, at the edge of the well | right in kind and place, a tenth of the area |
| 9124 dirty with 3 g, spotless with a film as thin as the others | spotless; amount unknown | not tested |
| More than 99.8 % of the yolk removed everywhere; specks, never an even film | more than 99 %; specks and patches | held |
| "Each of the five most influential parameters, moved to the ends of its registered range, turns all four plates clean or all four dirty, and so does halving or doubling the amount" | the calibration found exactly that: a duty of 0.5 turns all four dirty | held, and it is why one wash pins so little |
| Contradiction 1: 9122 with patches while 9123 is clean "is the oven penalty" | that pattern occurred | the diagnosis was too narrow: a soak that sprays 0.8 of the time gives the same pattern with the registered penalty, and the wash cannot tell the two |

In the tool's terms: the measured record has a log likelihood of -5.55 under the regime of
the prediction and -5.79 under the calibrated set. **The wash does not prefer the calibrated
set to the prediction.** What it rejects is last night's default (-10.18). The calibrated set
differs from the prediction by the label's energy and by the three plates lying inside their
ranges at the amount that was asked for.

## 10. What is delivered

| | |
|---|---|
| The default set | `packages/calibration/anchors/anchored-v6.owner-capsule.json` (12.9 g), with `anchored-v6.json` (reference detergent D) under it and `anchored-v6.owner-capsule.stable.json` beside it |
| Fitted on | the published class means (`std-eu-13.round-robin-ta.detergent-d`) and the owner's wash 01 (`owner-wash-01-egg-yolk-eco50`); both are in `provenance.washRecords` of every layer, and what the wash fixed is `OWNER_CALIBRATED` of `anchors/src/anchored.ts` |
| Valid for | `spotless-sim 0.5.0 water-6`, exposure sources `3ae47724f847`, machine data `b647c5746839`; the staleness guard reads it as current |
| The wash runner | `packages/wash-runner/src/defaults.ts` points at it and at `tiers.anchored-v6.owner-capsule.json` |
| Superseded, kept | `anchored-v5*.json` (duty 0.5; named in `SUPERSEDED_ANCHORED` of `anchors/src/scenario.ts`; not stale, so it still loads: the calibration starts from it); `anchored-v4*.json` (the prediction; stale) |
| The registered default of the duty | **unchanged, 0.5**, in `packages/sim-hydraulics/src/params.ts`. The calibrated value is an override of the set. Editing that file changes the fingerprint of the exposure sources: every cached exposure (some 15 GB) would be orphaned and every set stale, for a default that no wash of the game reads |
| The default wash | **runs.** `pnpm exec tsx scripts/wash-load.ts tutorial-careful --tier official` in `packages/wash-runner`, no flags: 64 of 64 points (62 of 64 under last night's default), 7.8 s with its exposure cached; the fast wash of the same load carries the tier note of the new set. The reference loads of the six hand-written levels at the official tier, careful / careless / random: tutorial 64 / 52 / 24 of 64, breakfast 185 / 150 / 55 of 289, weeknight dinner 178 / 147 / 61 of 283, dinner party 243 / 216 / 113 of 342, baking day 172 / 142 / 92 of 265, mixed family 198 / 164 / 93 of 299 |

## 11. The owner's next washes

Five candidate washes that need only supermarket soils and what he has shown he will do
(pieces in chosen places, counter or oven, a photograph of every piece before and after), as
planned records (`packages/calibration/records/owner/candidates/`, written by
`scripts/make-owner-candidates.ts`; the test pieces alone, his capsule, fast tier). Ranked by
the tool (`spotless-fit rank`) on the calibrated model with wash 01 counted as known, for
eight parameters (the duty, the oven penalty, the cost of turning, the spread of a spread
layer, the bleach rate, the milk rate, the capsule's protease level and its heat stability),
the gain averaged over the calibrated set and four sets drawn from the priors (the command is in
section 14):

| Rank | Wash | Gain, bits (least to most over the sets) | Place over the sets; leads in | Run in this order, adds | What it narrows most (deviation after over before) |
|---|---|---|---|---|---|
| 1 | Tea in four mugs, upper basket, Eco 50 | 3.07 (0.0 to 8.0), unstable | 1 to 6; 40 % | first, 3.07 | bleach rate 0.62, duty 0.70, protease 0.74 |
| 2 | Two porridge bowls nested and one free, upper basket, Eco 50 | 2.41 (0.1 to 4.3), unstable | 1 to 5; 20 % | third, 1.87 | protease 0.57, duty 0.60, cost of old water 0.67 |
| 3 | The weighed yolk plates on Eco 50 with the lower arm held | 1.95 (0.0 to 4.9) | 3 to 5; 0 % | fifth, 1.33 | cost of old water 0.73, protease 0.73 |
| 4 | Milk heated dry in four glasses, Eco 50 | 1.67 (0.0 to 6.6), unstable | 1 to 6; 20 % | fourth, 1.51 | protease 0.69, duty 0.84, milk rate 0.86 |
| 5 | The four yolk plates again, weighed, on Eco 50 | 1.59 (0.0 to 3.8) | 3 or 4; 0 % | last, 0.52 | cost of old water 0.79, oven penalty 0.84, duty 0.89 |

The top two, and what each would settle:

1. **Tea in mugs on Eco 50.** The bleaching of a tea stain by his capsule. Every tea verdict
   of the game turns on a tenth of one rate, which the published means bound from below only
   (0.0009 to 0.002) and which no wash of his has touched. It is the cheapest wash of the five
   (four mugs, tea bags, a day's standing). Its place is unstable: where a stain is far from
   its threshold either way it says nothing, so the mugs should carry stains of two strengths
   (one fill and three).
2. **Porridge bowls, nested and free, on Eco 50.** Whether a bowl covered by another stays
   dirty and how dirty (the model: 5 % of the porridge left, score 0), which is the water in a
   narrow gap and the supply of a face that only old water reaches; the calibrated model has
   the sign from a geometric correction of last night, not from a measurement. The tool
   counts it for the duty and the supply; what it settles for the game is a stacking verdict.

What the ranking does not say, and should be done whatever is washed: **weigh the yolk** (a
kitchen scale to 0.1 g; section 4.5: the duty moves from 0.7 to 1 with a quarter more or a
fifth less on every plate), put a coin or a ruler in every photograph, note the display time
at the start and the clock at start and finish. The tool ranks the plain repeat of wash 01
with weighed plates last because, in its linear approximation, it says again what wash 01
said. A fuller protocol is being written
by others.

## 12. What changed in the tool

All in `packages/calibration`; `docs/calibration/wash-record.md` and `fitting.md` describe them.

| Change | Why |
|---|---|
| `prog.soakDuty`, `prog.soakCycle` and `prog.soakFrom` are replayed at the value asked for (`SCHEDULE_KEYS` of `evaluator.ts`) and are written into a fitted parameter file (`isCalibrationKey` goes by the key, not by its first segment) | before, a fit could not move the soak (the schedule of the preparation was replayed whatever the value) and a fitted duty would have been written into `calibration.json`, which `wash()` does not read. `predict --set prog.soakDuty=...` was right only because it prepares at that value |
| Observation kind `visible_area` (mm2, compared in ln(area + floor), with a `range` or an `sd` of the logarithm); `obs.areaFloorMm2` 5, `obs.areaLogModelSd` 0.5 | 100 mm2 on a plate that carried yolk over 211 cm2 is an area fraction of 0.005: the `area_fraction` model reads everything under 0.01 as "nothing left" |
| `"fitted": false` on an observation | the owner's verdict and the area read off his photograph are one residue |
| Input scenarios of a record (`sim.scenarios`: weights, layout seed, amount factors, parameters), integrated out per item in the likelihood, shown per scenario by `predict`, drawn from in the predictive check | an amount that was not weighed is neither a fact nor a parameter of the machine |
| `anchors/scripts/literature-surface.ts`, `anchors/src/literature-surface.ts`, `anchors/scripts/fit-owner.ts` | the published class means beside a measured wash, in the tool's own objective, without washing the standard load at every evaluation |
| `anchors/scripts/fit.ts` holds `OWNER_CALIBRATED`; `check.ts` and the tests know those keys; `make-owner-set.ts` names the wash in the capsule layers | the anchoring is made again with what the owner's wash fixed in place |
| `scripts/make-owner-wash-01-measured.ts`, `scripts/make-owner-candidates.ts` | the measured record and the candidate washes are generated, not typed |

## 13. What remains confounded or open

- **Duty, capsule protease, reaction rate**: one combination. A wash with another detergent
  separates the duty from the chemistry; a power log
  of one Eco run measures the duty directly.
- **Duty and oven penalty** (0.83): weighed plates, oven-dried against air-dried, in the same
  place and facing the same way.
- **Duty and the unevenness of a spread layer**: a brushed layer (a pastry brush) in place of a
  fork.
- **The amount.** Section 4.5.
- **Turning**: one pair of plates, which also differ in lean and place.
- **The energy the wash reports** (0.90 kWh on Eco 50) is that of the pump running through
  the soak, whatever the duty: the timeline's liquor temperature and energy do not follow
  `prog.soakDuty`. At 0.8 the pump's share falls by 0.03 kWh (0.87 against the printed 0.836).
- **Between 0.8 and 1 the standard load does a little worse with more spraying** (egg items
  clean with detergent D: 12.5 of 20 at 0.8, 9.5 at 1; tea 1.15 against 0.85 at one bleach
  rate). A rest leaves a film that goes on working, and more soil in the liquor spends the
  bleach. Whether a real machine does this is not known.

## 14. Commands

```
cd packages/calibration
pnpm exec tsx scripts/make-owner-wash-01-measured.ts          # the measured record
pnpm exec tsx scripts/spotless-fit.ts validate records/owner/owner-wash-01-egg-yolk-eco50.measured.json
pnpm exec tsx scripts/spotless-fit.ts predict  records/owner/owner-wash-01-egg-yolk-eco50.measured.json \
  --params anchors/anchored-v6.owner-capsule.json             # the four plates, and every amount scenario
pnpm exec tsx scripts/spotless-fit.ts predict  records/owner/owner-wash-01-egg-yolk-eco50.measured.json \
  --params anchors/anchored-v5.owner-capsule.json --set prog.soakDuty=1 --set soil.bleachRate=0.0008   # (a)
pnpm exec tsx anchors/scripts/literature-surface.ts anchors/reports/surface.owner-wash-01.grid.json \
  anchors/reports/surface.owner-wash-01.part0.jsonl --slice 0/2 --set anchored-v5   # and part1 with --slice 1/2
pnpm exec tsx anchors/scripts/fit-owner.ts --fit prog.soakDuty --name duty --draws 20          # the tool's fit
pnpm exec tsx anchors/scripts/fit-owner.ts --fit prog.soakDuty,soil.bakeRate --no-fit --name duty-bake \
  --grid "prog.soakDuty=0.6,0.7,0.75,0.8,0.85,0.9,1;soil.bakeRate=0.00001,0.000017,0.00003,0.000055,0.0001"
pnpm exec tsx anchors/scripts/fit.ts                           # anchored-v6.json, with OWNER_CALIBRATED held
pnpm exec tsx anchors/scripts/make-owner-set.ts                # the capsule layers
pnpm exec tsx anchors/scripts/check.ts                         # staleness, ranges, bench anchors
pnpm exec tsx anchors/scripts/study.ts anchors/reports/tables.v6.cases.json anchors/reports/tables.v6.json
pnpm exec tsx anchors/scripts/tier-agreement.ts --set anchored-v6.owner-capsule \
  eco_50=anchors/reports/variance/v6.capsule.eco-off.jsonl,anchors/reports/variance/v6.capsule.eco-fast.jsonl
pnpm exec tsx scripts/make-owner-candidates.ts                 # the candidate washes
pnpm exec tsx scripts/spotless-fit.ts rank records/owner/candidates/*.planned.json \
  --params anchors/anchored-v6.owner-capsule.json --draws 4 --no-adapt --step 0.05 \
  --existing records/owner/owner-wash-01-egg-yolk-eco50.measured.json \
  --fit "prog.soakDuty,soil.bakeRate,soil.supplyExchange,soil.applicationCv[spread],soil.bleachRate,soil.milk.rateRef,liq.xProtease,liq.proteaseHalfLife"
cd ../sim-verify
pnpm exec tsx src/phenomena/cli.ts --tier fast --params ../calibration/anchors/anchored-v6.owner-capsule.json \
  --dose-g 12.9 --detergent-name "Finish Powerball Ultimate" --out ../calibration/anchors/reports/owner-wash-01/phenomena
```

A fit of the measured record costs nine replays of four plates per evaluation, 20 to 27 s at
the official tier; the one-key fit with its profile took 26 minutes, a grid of 35 points 15,
the ranking (six candidates at the fast tier and wash 01 at five parameter sets) 90 minutes on
a machine that others were using. The exposure caches of last night's development copy were
cloned into `anchors/out/exposure-cache` and into the phenomena suite's cache
(`packages/sim-verify/phenomena/.spotless/`). Both are git-ignored and so are not in the
repository: a fresh checkout computes its exposure again.
