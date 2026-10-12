# Phenomena suite: official tier, packages/calibration/anchors/anchored-v5.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.5.0 water-6`; parameters packages/calibration/anchors/anchored-v5.owner-capsule.json (hydro `sha256:7c3bd46790e7`, soil `sha256:4e8965089aed`, 17 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `a1a3f956ff32e455`. Exposure traced on: gpu. 4 phenomena, 6 washes (3 with cached exposure), 711.9 s.

Verdicts: 1 pass, 3 too small.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P03 | Plate pitch too small | too small | halving: 0 -> 0: 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |
| P07 | Radial position: centre against corner | too small | score: 0 -> 0: 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 |
| P08 | Left/right asymmetry with rotation direction | pass | score: 0 -> 0: 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 |
| P09 | Lean direction of plates | too small | score: 0 -> 0: 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 |

## Phenomena

### P03 Plate pitch too small: too small

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot (about 7 mm between the pair, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become two plates to a slot, every slot and every second slot. Seven plates per row (eight when crowded). All rows are settled by the loading physics; the crowded row has pairs in slots 2, 4, 6 and 8, so the covered plate of a pair has its face about 7 mm behind its partner while the partner faces an open slot.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 0 | 0 | 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | too small |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 0 | 0 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.00295 | 0 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.116), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:89709106c6b9`, 11.1 s (exposure cached).
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `eco_50`, 8 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.119), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:01b9eb35f467`, 92.6 s.
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.116), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:2812e8fbb671`, 12.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00295 | 0.473 | 71.2 | 17.7 | 1 | 1 | 1.27 | 13.1 | 0.838 | 0 |  | 0 | 628 | 0 | 1.74 | iec_egg_yolk (reaction) 7.16/1527 mg |
| B | plate_6 (well) | 0 | 0 | 0 | 0 | 0.984 | 1 | 0.0827 | 0.391 | 0.366 | 0 |  | 0 | 15020 | 0 | 9.64 | iec_egg_yolk (reaction) 745/1605 mg |
| C | plate_4 (well) | 0.0065 | 0.477 | 301 | 20 | 1 | 1 | 2.35 | 19.4 | 0.991 | 0 |  | 0 | 463 | 0 | 1.74 | iec_egg_yolk (reaction) 5.26/1527 mg |

### P07 Radial position: centre against corner: too small

Test: Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle).

Adapted: The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.

Stages: water: hydraulics (nozzle positions), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate at the corner against the one at mid-radius | 0 | 0 | 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 | too small |
| dwell (supporting) | fraction of time the face is under a direct jet, corner over mid-radius, minus one | 0.0133 | 0.00982 | -0.262 1 | low radial locations are impacted for longer | -0.05 or more | pass |

- **A**: four soup plates. Load `soup-radial`, programme `eco_50`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.115), peracid mean 0.0946 mmol/L (peak 0.446). Result `sha256:56bc2994bbe4`, 274.5 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_1 (well) | 0.00248 | 0.426 | 258 | 22.4 | 1 | 1 | 5.16 | 30.4 | 0.959 | 0 |  | 0 | 1276 | 0 | 1.81 | iec_egg_yolk (reaction) 16.9/1478 mg |
| A | soup_2 (well) | 0.0133 | 0.645 | 236 | 21.8 | 1 | 1 | 5.62 | 32.1 | 1.07 | 0 |  | 0 | 1649 | 0 | 1.79 | iec_egg_yolk (reaction) 22.1/1574 mg |
| A | soup_3 (well) | 0.00982 | 0.677 | 368 | 29.8 | 1 | 1 | 4.85 | 27.9 | 0.953 | 0 |  | 0 | 1560 | 0 | 1.84 | iec_egg_yolk (reaction) 21.3/1552 mg |

### P08 Left/right asymmetry with rotation direction: pass

Test: Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis.

Adapted: The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.

Stages: water: hydraulics (nozzle directions, sense of rotation), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the right-hand plate minus the left-hand one | 0 | 0 | 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 | pass |
| jets (supporting) | fraction of time the face is under a direct jet, right over left, minus one | 0.00982 | 0.016 | 0.633 1 | in one real arm a right-hand plate received five jets and its mirror image two | |x| <= 3 | pass |

- **A**: mirrored plates. Load `soup-radial`, programme `eco_50`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.115), peracid mean 0.0946 mmol/L (peak 0.446). Result `sha256:56bc2994bbe4`, 274.5 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_3 (well) | 0.00982 | 0.677 | 368 | 29.8 | 1 | 1 | 4.85 | 27.9 | 0.953 | 0 |  | 0 | 1560 | 0 | 1.84 | iec_egg_yolk (reaction) 21.3/1552 mg |
| A | soup_4 (well) | 0.016 | 0.679 | 308 | 25.5 | 1 | 1 | 5.34 | 32.1 | 1.15 | 0 |  | 0 | 752 | 0 | 1.85 | iec_egg_yolk (reaction) 9.28/1509 mg |

### P09 Lean direction of plates: too small

Test: A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up).

Adapted: The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.

Stages: water: jets (incidence), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 | too small |
| f_jet (supporting) | fraction of time the soiled face is under a direct jet, B over A, minus one | 0.0102 | 1.1e-4 | -0.989 1 | leaning away presents the back | -0.05 or more | pass |

- **A**: leaning toward the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:3915febbc288`, 3.8 s (exposure cached).
- **B**: leaning away from the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:797b8574a999`, 308.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0102 | 0.923 | 397 | 29.8 | 1 | 1 | 12.2 | 62 | 1.26 | 0 |  | 0 | 2006 | 0 | 0.885 | iec_egg_yolk (reaction) 31.9/1063 mg |
| B | plate (well) | 1.1e-4 | 0.144 | 46.2 | 20.4 | 1 | 1 | 2.03 | 16.7 | 0.956 | 0 |  | 0 | 2219 | 0 | 0.849 | iec_egg_yolk (reaction) 35.7/1063 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

