# Phenomena suite: official tier, packages/calibration/anchors/anchored-v2.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.3.2 water-3`; parameters packages/calibration/anchors/anchored-v2.json (hydro `sha256:e4abd440fb63`, soil `sha256:4bfbce58484f`, 9 overrides). Exposure traced on: gpu. 17 phenomena, 33 washes (0 with cached exposure), 4646.1 s.

Verdicts: 6 pass, 2 wrong sign, 7 too small, 2 too large.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | retained: 1.09 -> 259: 258 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.8e-4 -> 1.4e-4: 0.284 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P03 | Plate pitch too small | too small | halving: 0 -> 0: 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |
| P04 | Nesting or "spooning" of like items | too large | score: 2 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 |
| P05 | Large flat item shadows what is behind or above it | too small | score: 0 -> 0: 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P07 | Radial position: centre against corner | too small | score: 0 -> 0: 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 |
| P08 | Left/right asymmetry with rotation direction | pass | score: 0 -> 0: 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 |
| P09 | Lean direction of plates | too small | score: 0 -> 0: 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 |
| P10 | Tall narrow vessel interior | wrong sign | residue: 0.99 -> 0.989: -6.5e-4 1 | the interior of the tall vessel is the last place to clean | +0.01 or more |
| P12 | Alternating large and small plates | too small | score: 0 -> 0: 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 |
| P13 | Glass or cup placed over tines | pass | f_jet: 0.0116 -> 0.011: -0.0516 1 | interior f_jet reduced | -0.05 or more |
| P14 | Soiled face against the tub wall or door liner | too small | score: 0 -> 0: 0 score | as P02: -1 to -2 | -0 to -4 |
| P15 | Nested spoons | pass | shielded: 1 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P35 | Pot interiors | wrong sign | side: 0.869 -> 0.793: -0.0761 1 | on its side, half the wall is shadowed | +0.01 or more |
| P36 | Water pools in the base recess of inverted cups and mugs | pass | pool: 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 |
| P37 | Tilt drains the recess | too small | tilt15: 5 -> 0.111: 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 |
| P40 | Liquid held at contact points and in narrow gaps | pass | held: 1.23 -> 1.41: 0.181 g | a wet mark at every touching pair | + (any size) |

## Phenomena

### P01 Hollow item loaded open side up: pass

Test: A mug with tea film and a cereal bowl with porridge on the floor of the upper basket: mouth down (A) against mouth up (B).

Adapted: Upper basket of the Bosch (served from below by the upper arm and from above by the roof sprayer). Both orientations are dropped at the same spots and settle on the wires; the upright bowl slides about 13 cm before it rests.

Stages: water: scene (basins), jets, pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| retained | water the mug holds at the end, B - A | 1.09 | 259 | 258 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 | pass |
| f_jet | fraction of time the inside of the upright mug is under a direct jet from below (B) |  |  | 0 1 | f_jet inside = 0 | |x| <= 0.002 | pass |
| bowl (supporting) | water the bowl holds at the end, B - A | 0 | 108 | 108 mL | the bowl fills too | + (any size) | pass |
| drying (supporting) | drying score of the upright mug (B) |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: mouth down. Load `hollow-inverted`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 4.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:d7b6f14a6ef7`, 130.9 s.
- **B**: mouth up. Load `hollow-upright`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 4.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:36b29d3c95bd`, 131.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00882 | 0.739 | 509 | 27.7 | 1 | 1 | 5.72 | 23.2 | 0.811 | 0 | 1.09 mL, full for 5754 s | 5 | 0 | 1.09 | 0.953 | iec_tea (bleach) 0.00571/0.0577 mg |
| A | bowl (interior) | 0.105 | 0.978 | 430 | 26.1 | 1 | 1 | 32.6 | 62.7 | 1.37 | 0 |  | 4 | 0.0795 | 0 | 0.815 | iec_oat_flakes (reaction) 0.00973/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 0.997 | 1 | 1.07 | 4.9 | 0.43 | 0.896 | 259 mL, full for 5384 s | 5 | 0 | 259 | 0.647 | iec_tea (bleach) 0.0124/0.0577 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 12.1 | 20.1 | 0.774 | 0.431 | 108 mL, full for 5740 s | 4 | 0.393 | 108 | 1.63 | iec_oat_flakes (reaction) 0.0202/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate (C) faces the axis tipped 10 degrees up, and a reversed plate (D) falls back against the tines and lies 34 degrees from the vertical with its face to the wall and down. C and D are reported as supporting evidence.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.8e-4 | 1.4e-4 | 0.284 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 0.763 | 0.764 | 0.00137 1 | removal depends on how often the spot is hit | +0.01 or more | too small |
| settled (supporting) | fraction of time the soiled face is under a direct jet, settled reversed plate (D) over the seated one (C) | 0.00585 | 0.0349 | 5.96 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| settled_residue (supporting) | share of the egg yolk left on the face, D - C | 0.759 | 0.74 | -0.0185 1 | removal depends on how often the spot is hit | +0.01 or more | wrong sign |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:913925eed691`, 122.6 s.
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:32eca0cb4090`, 150.8 s.
- **C**: seated in its slot, face to the arm axis (settled). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b27a99c12270`, 131.7 s.
- **D**: put in reversed and settled. Load `plate-away`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:58728da7616e`, 130.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.8e-4 | 0.488 | 275 | 33.5 | 1 | 1 | 11.6 | 32.6 | 1.05 | 0 |  | 0 | 9144 | 0 | 0.649 | iec_egg_yolk (reaction) 810/1063 mg |
| B | plate (well) | 1.4e-4 | 0.101 | 44.4 | 18.4 | 1 | 1 | 1.5 | 7.53 | 0.661 | 0 |  | 0 | 9145 | 0 | 0.634 | iec_egg_yolk (reaction) 812/1063 mg |
| C | plate (well) | 0.00585 | 0.552 | 231 | 24.4 | 1 | 1 | 11.3 | 30.5 | 1.2 | 0 |  | 0 | 9144 | 0 | 0.773 | iec_egg_yolk (reaction) 806/1063 mg |
| D | plate (well) | 0.0349 | 0.974 | 369 | 27.2 | 1 | 1 | 18.8 | 39.6 | 0.988 | 0 |  | 0 | 9138 | 0 | 0.888 | iec_egg_yolk (reaction) 787/1063 mg |

### P03 Plate pitch too small: too small

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot (about 7 mm between the pair, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become two plates to a slot, every slot and every second slot. Seven plates per row (eight when crowded). All rows are settled by the loading physics; the crowded row has pairs in slots 2, 4, 6 and 8, so the covered plate of a pair has its face about 7 mm behind its partner while the partner faces an open slot.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 0 | 0 | 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | too small |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 0 | 0 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.00294 | 0 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0555 mmol/L (peak 0.325). Result `sha256:91870a119738`, 151.5 s.
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `auto_145`, 8 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:265dc2d46285`, 160.9 s.
  - load: plate_6 rests but the stability probe flags it
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0555 mmol/L (peak 0.325). Result `sha256:6738ffabb5fd`, 147.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00294 | 0.471 | 69.3 | 17.6 | 1 | 1 | 2.97 | 12.6 | 0.816 | 0 |  | 0 | 15921 | 0 | 1.3 | iec_egg_yolk (reaction) 1084/1527 mg |
| B | plate_6 (well) | 0 | 0 | 0 | 0 | 0.985 | 1 | 0.581 | 3.79 | 0.445 | 0 |  | 0 | 15946 | 0 | 1.77 | iec_egg_yolk (reaction) 1190/1605 mg |
| C | plate_4 (well) | 0.00649 | 0.475 | 332 | 19.9 | 1 | 1 | 5.62 | 19 | 0.975 | 0 |  | 0 | 15917 | 0 | 1.3 | iec_egg_yolk (reaction) 1079/1527 mg |

### P04 Nesting or "spooning" of like items: too large

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 4.3e-4 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 2 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | too large |
| against (supporting) | share of the porridge left inside that bowl, B - A | 2.1e-4 | 4.3e-4 | 2.1e-4 1 | nesting leaves more | +0.01 or more | too small |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0698 | 1.9e-5 | 2.7e-4 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 3.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:d23164a85620`, 141.1 s.
- **B**: nested. Load `bowls-nested`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:4a11df3b52fd`, 132.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0698 | 0.932 | 382 | 26.8 | 1 | 1 | 24.4 | 51.8 | 1.21 | 0 |  | 3 | 1.79 | 0 | 0.901 | iec_oat_flakes (reaction) 0.0378/177 mg |
| B | bowl_over (interior) | 1.9e-5 | 0.032 | 26.4 | 12.4 | 1 | 1 | 0.907 | 4.93 | 0.467 | 0 |  | 2 | 3.84 | 0 | 1.55 | iec_oat_flakes (reaction) 0.0755/177 mg |

### P05 Large flat item shadows what is behind or above it: too small

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 0 | 0 | 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | too small |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 0.00179 | 1.4e-4 | -0.92 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:8ceb33443e21`, 136.1 s.
- **B**: platter between the plates and the arm axis. Load `board-middle`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:66b686f3a6cc`, 171.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 4.9e-4 | 0.16 | 278 | 20.3 | 1 | 1 | 2.77 | 11.1 | 0.776 | 0 |  | 0 | 9135 | 0 | 0.838 | iec_egg_yolk (reaction) 734/985 mg |
| A | plate_2 (well) | 0.00308 | 0.407 | 276 | 23.4 | 1 | 1 | 6.72 | 23.8 | 0.95 | 0 |  | 0 | 9132 | 0 | 0.813 | iec_egg_yolk (reaction) 714/969 mg |
| B | plate_1 (well) | 1.9e-4 | 0.111 | 452 | 30.3 | 1 | 1 | 4.47 | 15.8 | 0.902 | 0 |  | 0 | 9135 | 0 | 0.733 | iec_egg_yolk (reaction) 733/985 mg |
| B | plate_2 (well) | 9.4e-5 | 0.0933 | 382 | 30.6 | 1 | 1 | 6.49 | 19.8 | 1.01 | 0 |  | 0 | 9133 | 0 | 0.757 | iec_egg_yolk (reaction) 717/969 mg |

### P07 Radial position: centre against corner: too small

Test: Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle).

Adapted: The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.

Stages: water: hydraulics (nozzle positions), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate at the corner against the one at mid-radius | 0 | 0 | 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 | too small |
| dwell (supporting) | fraction of time the face is under a direct jet, corner over mid-radius, minus one | 0.0132 | 0.00977 | -0.258 1 | low radial locations are impacted for longer | -0.05 or more | pass |

- **A**: four soup plates. Load `soup-radial`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:fd4fa83a3082`, 131.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_1 (well) | 0.00238 | 0.411 | 247 | 21.9 | 1 | 1 | 12.5 | 30.6 | 0.961 | 0 |  | 0 | 14717 | 0 | 1.27 | iec_egg_yolk (reaction) 1069/1478 mg |
| A | soup_2 (well) | 0.0132 | 0.645 | 274 | 21.7 | 1 | 1 | 13.6 | 32.4 | 1.06 | 0 |  | 0 | 14726 | 0 | 1.26 | iec_egg_yolk (reaction) 1155/1574 mg |
| A | soup_3 (well) | 0.00977 | 0.675 | 451 | 29.8 | 1 | 1 | 12.3 | 29.1 | 0.954 | 0 |  | 0 | 14727 | 0 | 1.32 | iec_egg_yolk (reaction) 1135/1552 mg |

### P08 Left/right asymmetry with rotation direction: pass

Test: Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis.

Adapted: The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.

Stages: water: hydraulics (nozzle directions, sense of rotation), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the right-hand plate minus the left-hand one | 0 | 0 | 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 | pass |
| jets (supporting) | fraction of time the face is under a direct jet, right over left, minus one | 0.00977 | 0.0313 | 2.2 1 | in one real arm a right-hand plate received five jets and its mirror image two | |x| <= 3 | pass |

- **A**: mirrored plates. Load `soup-radial`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:fd4fa83a3082`, 131.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_3 (well) | 0.00977 | 0.675 | 451 | 29.8 | 1 | 1 | 12.3 | 29.1 | 0.954 | 0 |  | 0 | 14727 | 0 | 1.32 | iec_egg_yolk (reaction) 1135/1552 mg |
| A | soup_4 (well) | 0.0313 | 0.919 | 369 | 25.8 | 1 | 1 | 18.7 | 38.6 | 1.08 | 0 |  | 0 | 14698 | 0 | 1.29 | iec_egg_yolk (reaction) 1067/1509 mg |

### P09 Lean direction of plates: too small

Test: A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up).

Adapted: The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.

Stages: water: jets (incidence), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 | too small |
| f_jet (supporting) | fraction of time the soiled face is under a direct jet, B over A, minus one | 0.0102 | 1.1e-4 | -0.99 1 | leaning away presents the back | -0.05 or more | pass |

- **A**: leaning toward the arm axis. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:28a31a4bdb0e`, 196.6 s.
- **B**: leaning away from the arm axis. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:5f41927fd5bb`, 116 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0102 | 0.923 | 397 | 29.7 | 1 | 1 | 31.2 | 62.1 | 1.27 | 0 |  | 0 | 9143 | 0 | 0.713 | iec_egg_yolk (reaction) 804/1063 mg |
| B | plate (well) | 1.1e-4 | 0.146 | 46.2 | 20.4 | 1 | 1 | 5.09 | 16.8 | 0.955 | 0 |  | 0 | 9144 | 0 | 0.675 | iec_egg_yolk (reaction) 811/1063 mg |

### P10 Tall narrow vessel interior: wrong sign

Test: A 250 mL test glass (B) against a shallow dessert bowl (A), each with microwaved milk inside, mouth down at the same spot of the upper basket.

Adapted: Upper basket; both settle on the wires leaning on the same tine row.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws, chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| glass | IEC score of the glass, as a distance from the range 2.3 to 4.0 (B) |  |  | -2.3 score | standard glass class (baked milk) scores 2.3 to 4.0 | within 1 of the range | too small |
| residue | share of the milk left, glass minus bowl | 0.99 | 0.989 | -6.5e-4 1 | the interior of the tall vessel is the last place to clean | +0.01 or more | wrong sign |
| f_jet (supporting) | fraction of time the inside is under a direct jet, glass over bowl, minus one | 0.075 | 0.0124 | -0.835 1 | a 60 mm opening is under a nozzle for about 6 % of a revolution | -0.05 or more | pass |

- **A**: shallow bowl. Load `bowl-same-spot`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:80175598056f`, 116.9 s.
- **B**: tall glass. Load `glass-between`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:9794b348a386`, 223.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl (interior) | 0.075 | 0.75 | 318 | 27.7 | 1 | 1 | 21.7 | 49.7 | 1.23 | 0 |  | 0 | 8342 | 0 | 0.651 | iec_milk (reaction) 4976/5029 mg |
| B | glass (interior) | 0.0124 | 0.497 | 463 | 26.3 | 1 | 1 | 11.7 | 37.6 | 1.08 | 0 |  | 0 | 10611 | 0 | 0.662 | iec_milk (reaction) 5226/5285 mg |

### P12 Alternating large and small plates: too small

Test: Dinner plates with egg yolk in neighbouring slots of the rear lane (A) against dinner and dessert plates alternating at the same 18.25 mm pitch (B); the dinner plate at slot 5 is scored on its upper half.

Adapted: Pitch 18.25 mm (the tines of the Bosch) instead of 15 mm.

Stages: water: jets (gap geometry); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the upper half of the large plate at slot 5, B - A | 0 | 0 | 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 | too small |
| residue (supporting) | share of the egg yolk left on the upper half of that plate, B - A | 0.68 | 0.695 | 0.0149 1 | the wider gap above the small plates lets more through | -0.01 or more | wrong sign |

- **A**: large plates only. Load `plates-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0555 mmol/L (peak 0.325). Result `sha256:91870a119738`, 151.5 s.
- **B**: large and small alternating. Load `plates-alt-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:b964855dc89b`, 144.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_3 (well) | 0.00223 | 0.43 | 299 | 19.4 | 1 | 1 | 4.95 | 17.3 | 0.961 | 0 |  | 0 | 15868 | 0 | 1.31 | iec_egg_yolk (reaction) 941/1383 mg |
| B | plate_2 (well) | 0.0028 | 0.43 | 293 | 19.2 | 1 | 1 | 3.56 | 14.5 | 0.877 | 0 |  | 0 | 15892 | 0 | 1.31 | iec_egg_yolk (reaction) 1011/1453 mg |

### P13 Glass or cup placed over tines: pass

Test: A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A).

Adapted: Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.

Stages: water: jets (tine in the path), droplets (fans off the tine), scene (contacts).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the inside is under a direct jet, B over A, minus one | 0.0116 | 0.011 | -0.0516 1 | interior f_jet reduced | -0.05 or more | pass |
| marks (supporting) | contact marks on the glass over the tine (B) |  |  |  | AHAM adds 1 to 3 grade points per marked glass | +0.5 to +6 | not covered: needs spots and film from evaporated water, and marks at contacts |
| drying (supporting) | change of the drying score, B - A |  |  |  | drying score -1 | -0.5 to -2 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: row folded down: no tine in the glass. Load `glass-free`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:296dc1fa7ec7`, 122.9 s.
- **B**: over a tine. Load `glass-free`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b6aae0d50edc`, 126.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass (interior) | 0.0116 | 0.659 | 564 | 29.7 | 1 | 1 | 8.69 | 35.3 | 0.968 | 0 |  | 0 | 10611 | 0 | 2.65 | iec_milk (reaction) 5226/5285 mg |
| B | glass (interior) | 0.011 | 0.659 | 564 | 29.5 | 1 | 1 | 8.41 | 34.2 | 0.97 | 0 |  | 0 | 10611 | 0 | 2.64 | iec_milk (reaction) 5226/5285 mg |

### P14 Soiled face against the tub wall or door liner: too small

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the platter is seated by the loading physics both ways round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00669 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 0 | 0 | 0 score | as P02: -1 to -2 | -0 to -4 | too small |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 37.9 | 3.63 | -0.904 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 0.639 | 0.654 | 0.0155 1 | the face to the wall keeps more | +0.01 or more | pass |

- **A**: face inward. Load `platter-inward`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:e4fb6a4f5189`, 127.6 s.
- **B**: face to the wall. Load `platter-to-wall`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3a16c3b94666`, 116.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00669 | 0.509 | 415 | 30.2 | 1 | 1 | 16.4 | 37.9 | 1.27 | 0 |  | 0 | 13033 | 0 | 1.05 | iec_egg_yolk (reaction) 656/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.587 | 3.63 | 0.425 | 0 |  | 0 | 13076 | 0 | 1.03 | iec_egg_yolk (reaction) 672/1026 mg |

### P15 Nested spoons: pass

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 1 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | pass |
| partner | IEC score of the other spoon, nested minus opposed | 2 | 2 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0.00437 | 0.0122 | 0.00779 1 | when spoons spoon, they trap food | +0.01 or more | too small |

- **A**: opposed. Load `spoons-opposed`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:762e0c0d0e3f`, 163.3 s.
- **B**: nested. Load `spoons-nested`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:d14eceba031c`, 122.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 2.63 | 26.6 | 1.03 | 0 |  | 2 | 8.12 | 0 | 0.0814 | iec_oat_flakes (reaction) 0.0817/23.6 mg |
| A | spoon_2 (bowl) | 0.00598 | 0.883 | 311 | 37.4 | 1 | 1 | 5.7 | 29.9 | 0.891 | 0 |  | 2 | 11 | 0 | 0.0785 | iec_oat_flakes (reaction) 0.106/24.3 mg |
| B | spoon_1 (bowl) | 0.00364 | 0.999 | 255 | 27.3 | 1 | 1 | 4.53 | 33.6 | 1.15 | 0 |  | 2 | 6.78 | 0 | 0.36 | iec_oat_flakes (reaction) 0.0712/23.6 mg |
| B | spoon_2 (bowl) | 6.3e-5 | 0.104 | 142 | 33.1 | 1 | 1 | 0.742 | 9.86 | 0.939 | 0 |  | 2 | 28.8 | 0 | 0.348 | iec_oat_flakes (reaction) 0.295/24.3 mg |

### P35 Pot interiors: wrong sign

Test: A 17 cm steel saucepan with burnt-on milk on its inner bottom and wall in the lower basket: mouth down on the rear rows (A) against lying on its side (B).

Adapted: Both poses are dropped and settled by the loading physics; the pan on its side rolls about 10 cm before it rests.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | IEC score of the pot mouth down, as a distance from 2.5 to 4.0 (A) |  |  | -2.5 score | pots class 2.5 with detergent D to 4.0 with E | within 1 of the range | too small |
| side | share of the soil left in the pot, on its side minus mouth down | 0.869 | 0.793 | -0.0761 1 | on its side, half the wall is shadowed | +0.01 or more | wrong sign |
| ranking (supporting) | share left on the inner wall minus on the inner bottom, mouth down (A) |  |  | -0.125 1 | inverted, the bottom is hit directly (the ranking is a calibration target) | +0.01 or more | wrong sign |

- **A**: mouth down. Load `pot-inverted`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:4cebde2f531c`, 174.6 s.
- **B**: on its side. Load `pot-on-side`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:4c45ca2b4eaf`, 137 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot (interior_base) | 0.0388 | 0.979 | 246 | 32.1 | 0.647 | 1 | 10.6 | 18.6 | 0.312 | 0 |  | 0 | 33911 | 0 | 0.966 | milk_burnt (reaction) 1840/1976 mg; milk_burnt (reaction) 1607/1992 mg |
| A | pot (interior_wall) | 0.00463 | 0.437 | 652 | 29.5 | 0.959 | 1 | 14.1 | 40.2 | 1.08 | 0 |  | 0 | 33911 | 0 | 0.966 | milk_burnt (reaction) 1840/1976 mg; milk_burnt (reaction) 1607/1992 mg |
| B | pot (interior_base) | 0 | 0 | 0 | 0 | 1 | 1 | 22.9 | 46.6 | 1.19 | 0.944 | 1003 mL, full for 5721 s | 0 | 33908 | 1003 | 1.06 | milk_burnt (reaction) 1626/1976 mg; milk_burnt (reaction) 1519/1992 mg |
| B | pot (interior_wall) | 0 | 0 | 0 | 0 | 1 | 1 | 18 | 38.1 | 1.23 | 0.442 | 1003 mL, full for 5721 s | 0 | 33908 | 1003 | 1.06 | milk_burnt (reaction) 1626/1976 mg; milk_burnt (reaction) 1519/1992 mg |

### P36 Water pools in the base recess of inverted cups and mugs: pass

Test: A ceramic mug mouth down on a level support: the rear cup shelf of the upper basket folded down.

Adapted: The cup shelf of the Bosch is the level support; the mug is dropped onto it and settles. The expected volume is the checklist's formula for the recess of the catalogue's mug (28 mm radius, 2.5 mm deep).

Stages: water: scene (basins), run-off, pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pool | water standing in the base recess at the end |  |  | 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 | pass |
| drying (supporting) | drying score of the mug |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:e32f0ccd5fdd`, 133.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 0 | 0 | 0 | 0 | 1 | 1 | 1.15 | 3.9 | 0.289 | 0.314 | 5 mL, full for 5750 s | 5 | 0 | 5 | 3.1 |  |

### P37 Tilt drains the recess: too small

Test: The mug of P36 at 0 (A), 7 (B), 15 (C) and 30 degrees (D) of tilt.

Adapted: The tilts are set, not settled: the mug is turned about a horizontal axis and kept standing on the height of its lowest point; the runner checks that it cuts into nothing. The checklist's volumes are for a recess of 25 mm radius and 3 mm depth; the expected values here are its formulas evaluated for the recess of the catalogue's mug (28 mm, 2.5 mm), as shares of the level volume.

Stages: water: scene (basins, minimum basin volume), pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| tilt7 | water in the recess at 7 degrees over level | 5 | 0.418 | 0.0836 1 | the wedge formula: 1.4 of 5.9 mL at 7 degrees for the checklist's recess; 0.92 of 6.2 mL for this mug's | +0.0744 to +0.298 | pass |
| tilt15 | water in the recess at 15 degrees over level | 5 | 0.111 | 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 | too small |
| tilt30 (supporting) | water in the recess at 30 degrees over level | 5 | 0.0257 | 0.00514 1 | the wedge formula: 0.13 of 5.9 mL at 30 degrees for the checklist's recess; 0.09 of 6.2 mL for this mug's | +0.0073 to +0.0292 | too small |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:e32f0ccd5fdd`, 133.8 s.
- **B**: tilted 7 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:9db54de763ce`, 133.5 s.
- **C**: tilted 15 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:1e7085b413a5`, 123.9 s.
- **D**: tilted 30 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:cde0e490df7e`, 132.3 s.
  - set pose: deepest overlap 0.03 mm (mug into upper_rack_fittings)

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 0 | 0 | 0 | 0 | 1 | 1 | 1.15 | 3.9 | 0.289 | 0.314 | 5 mL, full for 5750 s | 5 | 0 | 5 | 3.1 |  |
| B | mug (foot) | 0 | 0 | 0 | 0 | 1 | 1 | 1.2 | 4.23 | 0.329 | 0.0423 | 0.418 mL, full for 5755 s | 5 | 0 | 0.418 | 0.717 |  |
| C | mug (foot) | 0 | 0 | 0 | 0 | 1 | 1 | 0.788 | 3.55 | 0.327 | 0.0282 | 0.111 mL, full for 5755 s; 0.585 mL, full for 0 s; 0.514 mL, full for 0 s | 5 | 0 | 0.111 | 0.645 |  |
| D | mug (foot) | 0 | 0 | 0 | 0 | 1 | 1 | 0.624 | 2.93 | 0.309 | 0.00705 | 0.0257 mL, full for 5755 s | 5 | 0 | 0.0257 | 0.554 |  |

### P40 Liquid held at contact points and in narrow gaps: pass

Test: Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B).

Adapted: Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.

Stages: water: scene (contacts), run-off (bridges, retained water).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| held | water left on the two glasses at the end of the last rinse (film and pools), B - A | 1.23 | 1.41 | 0.181 g | a wet mark at every touching pair | + (any size) | pass |
| marks (supporting) | residue marks at the contact (B) |  |  |  | a residue line at every touching pair | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: apart. Load `glasses-apart`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:e58a9ca81ab9`, 138.6 s.
- **B**: touching. Load `glasses-touching`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:30a547d98256`, 125.5 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (exterior) | 0.00387 | 0.448 | 441 | 25.3 | 1 | 1 | 4.85 | 17.8 | 0.899 | 0 |  | 5 | 0 | 0 | 0.605 |  |
| A | glass_2 (exterior) | 0.00309 | 0.54 | 481 | 24.3 | 1 | 1 | 7.12 | 23.5 | 1.05 | 0 |  | 5 | 0 | 0 | 0.627 |  |
| B | glass_1 (exterior) | 0.00328 | 0.377 | 418 | 23.9 | 1 | 1 | 3.71 | 14.9 | 0.831 | 0 |  | 5 | 0 | 0 | 0.717 |  |
| B | glass_2 (exterior) | 0.00349 | 0.524 | 409 | 25 | 1 | 1 | 6.59 | 22.2 | 1.01 | 0 |  | 5 | 0 | 0 | 0.696 |  |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received; `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

