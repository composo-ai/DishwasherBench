# Phenomena suite: official tier, packages/calibration/anchors/anchored-v5.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.5.0 water-6`; parameters packages/calibration/anchors/anchored-v5.owner-capsule.json (hydro `sha256:7c3bd46790e7`, soil `sha256:4e8965089aed`, 17 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `a1a3f956ff32e455`. Exposure traced on: gpu. 9 phenomena, 18 washes (0 with cached exposure), 6139.6 s.

Verdicts: 4 pass, 2 too small, 2 too large, 1 error.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P04 | Nesting or "spooning" of like items | too small | residue: 0.118 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 |
| P15 | Nested spoons | too large | shielded: 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P40 | Liquid held at contact points and in narrow gaps | pass | held: 2.31 -> 2.73: 0.423 g | a wet mark at every touching pair | + (any size) |
| P13 | Glass or cup placed over tines | pass | f_jet: 0.0116 -> 0.011: -0.0501 1 | interior f_jet reduced | -0.05 or more |
| P14 | Soiled face against the tub wall or door liner | pass | f_jet: 0.00743 -> 0: 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P01 | Hollow item loaded open side up | pass | retained: 0.444 -> 253: 253 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.7e-4 -> 1.4e-4: 0.292 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P05 | Large flat item shadows what is behind or above it | error | score: 0 -> 0: 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P06 | Spray arm stalled by an item | too small | score: 0.143 -> 0.143: 0 score | mean score of that rack -1.5 or more | -0.5 to -5 |

## Phenomena

### P04 Nesting or "spooning" of like items: too small

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 0.118 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 0 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | pass |
| against (supporting) | share of the porridge left inside that bowl, B - A | 0 | 0.118 | 0.118 1 | nesting leaves more | +0.01 or more | pass |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0697 | 4.7e-8 | 6.7e-7 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:bb565fce95fa`, 377.7 s.
- **B**: nested. Load `bowls-nested`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:e55cb8c7fb76`, 368.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0697 | 0.942 | 404 | 26.9 | 1 | 1 | 10 | 48.4 | 1.21 | 0 |  | 5 | 0 | 0 | 1.91 | iec_oat_flakes (reaction) 0/177 mg |
| B | bowl_over (interior) | 4.7e-8 | 4.5e-4 | 19.3 | 12.5 | 1 | 1 | 0.00482 | 0.202 | 0.0929 | 0 |  | 0 | 3496 | 0 | 2.19 | iec_oat_flakes (reaction) 20.9/177 mg |

### P15 Nested spoons: too large

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | too large |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0 | 0 | 0 1 | when spoons spoon, they trap food | +0.01 or more | too small |

- **A**: opposed. Load `spoons-opposed`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:fce997759c2e`, 286.7 s.
- **B**: nested. Load `spoons-nested`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:93819a3fd936`, 364.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 2.6e-5 | 0.243 | 115 | 34.3 | 1 | 1 | 0.132 | 13 | 0.851 | 0 |  | 5 | 0 | 0 | 0.121 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.0067 | 0.978 | 330 | 38.7 | 1 | 1 | 2.02 | 30.3 | 0.94 | 0 |  | 5 | 0 | 0 | 0.305 | iec_oat_flakes (reaction) 0/24.3 mg |
| B | spoon_1 (bowl) | 9.0e-5 | 0.377 | 286 | 46.4 | 1 | 1 | 0.201 | 16.5 | 0.875 | 0 |  | 5 | 0 | 0 | 0.16 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_2 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.201 | 15.2 | 0.911 | 0 |  | 5 | 0 | 0 | 0.17 | iec_oat_flakes (reaction) 0/24.3 mg |

### P40 Liquid held at contact points and in narrow gaps: pass

Test: Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B).

Adapted: Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.

Stages: water: scene (contacts), run-off (bridges, retained water).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| held | water left on the two glasses at the end of the last rinse (film and pools), B - A | 2.31 | 2.73 | 0.423 g | a wet mark at every touching pair | + (any size) | pass |
| marks (supporting) | residue marks at the contact (B) |  |  |  | a residue line at every touching pair | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: apart. Load `glasses-apart`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:159eb56f1927`, 547.4 s.
- **B**: touching. Load `glasses-touching`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:a4eedd7e268d`, 411.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (exterior) | 0.00479 | 0.528 | 474 | 24.8 | 1 | 1 | 2.24 | 17.9 | 0.895 | 0 |  | 5 | 0 | 0 | 1.18 |  |
| A | glass_2 (exterior) | 0.00316 | 0.542 | 431 | 25 | 1 | 1 | 3.3 | 23.4 | 1.05 | 0 |  | 5 | 0 | 0 | 1.13 |  |
| B | glass_1 (exterior) | 0.00363 | 0.387 | 382 | 24.4 | 1 | 1 | 1.83 | 15 | 0.876 | 0 |  | 5 | 0 | 0 | 1.43 |  |
| B | glass_2 (exterior) | 0.00384 | 0.504 | 450 | 25.6 | 1 | 1 | 3.06 | 21.8 | 1.01 | 0 |  | 5 | 0 | 0 | 1.3 |  |

### P13 Glass or cup placed over tines: pass

Test: A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A).

Adapted: Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.

Stages: water: jets (tine in the path), droplets (fans off the tine), scene (contacts).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the inside is under a direct jet, B over A, minus one | 0.0116 | 0.011 | -0.0501 1 | interior f_jet reduced | -0.05 or more | pass |
| marks (supporting) | contact marks on the glass over the tine (B) |  |  |  | AHAM adds 1 to 3 grade points per marked glass | +0.5 to +6 | not covered: needs spots and film from evaporated water, and marks at contacts |
| drying (supporting) | change of the drying score, B - A |  |  |  | drying score -1 | -0.5 to -2 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: row folded down: no tine in the glass. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:477724bc8dd0`, 398.4 s.
- **B**: over a tine. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:ec88468085ea`, 286.5 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass (interior) | 0.0116 | 0.66 | 510 | 29.9 | 1 | 1 | 4.53 | 35.2 | 0.993 | 0 |  | 5 | 0 | 0 | 2.75 | iec_milk (reaction) 1.1e-6/528 mg |
| B | glass (interior) | 0.011 | 0.66 | 510 | 29.8 | 1 | 1 | 4.39 | 34.2 | 0.992 | 0 |  | 5 | 0 | 0 | 2.75 | iec_milk (reaction) 1.1e-6/528 mg |

### P14 Soiled face against the tub wall or door liner: pass

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the loading physics seats the platter face inward and does not seat it reversed on the present basket, so both ways round are set poses: the platter exactly upright 30 mm outboard of its outermost seat, between the last tine and the side wall of the basket, the one place where it clears the tines either way round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00743 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 2 | 1 | -1 score | as P02: -1 to -2 | -0 to -4 | pass |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 34 | 4.8 | -0.859 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 8.3e-5 | 0.00162 | 0.00154 1 | the face to the wall keeps more | +0.01 or more | too small |

- **A**: face inward: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:c92fc064e3f5`, 333.4 s.
- **B**: face to the wall: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 1), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:d6e5f85b88e4`, 284.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00743 | 0.538 | 509 | 30 | 1 | 1 | 5.36 | 34 | 1.25 | 0 |  | 2 | 9.44 | 0 | 0.913 | iec_egg_yolk (reaction) 0.085/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.359 | 4.8 | 0.485 | 0 |  | 1 | 185 | 0 | 0.97 | iec_egg_yolk (reaction) 1.66/1026 mg |

### P01 Hollow item loaded open side up: pass

Test: A mug with tea film and a cereal bowl with porridge on the floor of the upper basket: mouth down (A) against mouth up (B).

Adapted: Upper basket of the Bosch (served from below by the upper arm and from above by the roof sprayer). Both orientations are dropped at the same spots and settle on the wires; the upright bowl slides about 13 cm before it rests.

Stages: water: scene (basins), jets, pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| retained | water the mug holds at the end, B - A | 0.444 | 253 | 253 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 | pass |
| f_jet | fraction of time the inside of the upright mug is under a direct jet from below (B) |  |  | 0 1 | f_jet inside = 0 | |x| <= 0.002 | pass |
| bowl (supporting) | water the bowl holds at the end, B - A | 0 | 148 | 148 mL | the bowl fills too | + (any size) | pass |
| drying (supporting) | drying score of the upright mug (B) |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: mouth down. Load `hollow-inverted`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:14590c285d23`, 290.1 s.
- **B**: mouth up. Load `hollow-upright`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:71c5aed5e9a4`, 278.5 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00905 | 0.724 | 520 | 27.4 | 1 | 1 | 2.79 | 23.3 | 0.789 | 0 | 0.444 mL, full for 7308 s | 0 | 240 | 0.444 | 2.81 | iec_tea (bleach) 0.228/5.77 mg |
| A | bowl (interior) | 0.123 | 0.956 | 383 | 25.8 | 1 | 1 | 15.1 | 63.6 | 1.42 | 0 |  | 5 | 0 | 0 | 1.89 | iec_oat_flakes (reaction) 0/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 0.512 | 4.82 | 0.44 | 0.881 | 253 mL, full for 6922 s | 0 | 9847 | 253 | 1.43 | iec_tea (bleach) 0.585/5.77 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 6.22 | 22.7 | 0.824 | 0.525 | 148 mL, full for 7292 s | 5 | 0 | 148 | 2.43 | iec_oat_flakes (reaction) 0/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate faces the axis tipped up with the tines. The pair of the first build that compared the seated plate with one put in reversed is gone: on the present basket the loader does not seat a reversed plate in that slot, and the seated plate turned round in place cuts 2 mm into the tines.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.7e-4 | 1.4e-4 | 0.292 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 0.036 | 0.0478 | 0.0118 1 | removal depends on how often the spot is hit | +0.01 or more | pass |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:9d98696cbd51`, 382.1 s.
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:6c39580862f4`, 286.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.7e-4 | 0.488 | 275 | 33.7 | 1 | 1 | 4.53 | 32.7 | 1.05 | 0 |  | 0 | 2368 | 0 | 0.823 | iec_egg_yolk (reaction) 38.3/1063 mg |
| B | plate (well) | 1.4e-4 | 0.101 | 44.4 | 18.5 | 1 | 1 | 0.583 | 7.37 | 0.651 | 0 |  | 0 | 2998 | 0 | 0.808 | iec_egg_yolk (reaction) 50.8/1063 mg |

### P05 Large flat item shadows what is behind or above it: error

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws. Note: wash B: the set pose cuts 2.0 mm (board into plate_2).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 0 | 0 | 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | too small |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 6.4e-5 | 5.3e-5 | -0.176 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `eco_50`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:3080f5d26518`, 305.8 s.
- **B**: platter upright between the plates and the arm axis (set pose). Load `board-side`, programme `eco_50`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:cc5ba9c39b2a`, 432 s.
  - set pose: deepest overlap 2.03 mm (board into plate_2)
  - wash: placement: board stands in the path of the upper spray arm, which is simulated turning through it; give stalledArms for this level to hold the arm
  - wash: placement: board cuts 2.0 mm into plate_2; both are simulated where they were placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 9.5e-5 | 0.0824 | 384 | 30.7 | 1 | 1 | 1.84 | 15.7 | 0.902 | 0 |  | 0 | 1500 | 0 | 1.03 | iec_egg_yolk (reaction) 21.5/985 mg |
| A | plate_2 (well) | 3.3e-5 | 0.0724 | 45.1 | 20.2 | 1 | 1 | 3.57 | 23.8 | 1.09 | 0 |  | 0 | 1089 | 0 | 1.04 | iec_egg_yolk (reaction) 15/969 mg |
| B | plate_1 (well) | 9.5e-5 | 0.0824 | 384 | 30.7 | 1 | 1 | 1.88 | 15.6 | 0.89 | 0 |  | 0 | 1595 | 0 | 1.04 | iec_egg_yolk (reaction) 23.1/985 mg |
| B | plate_2 (well) | 1.1e-5 | 0.0206 | 45.1 | 20.9 | 1 | 1 | 1.27 | 8.8 | 0.942 | 0 |  | 0 | 1191 | 0 | 1.83 | iec_egg_yolk (reaction) 17.1/969 mg |

### P06 Spray arm stalled by an item: too small

Test: Seven IEC dinner plates with egg yolk in every second slot of the rear lane (A); the same with a ladle let down through the floor of the lower basket until it hangs in the path of the lower arm (B).

Adapted: A ladle stands in for the fork: a fork slips through the floor grid of this basket and falls, a ladle hangs by its bowl. On the present basket the ladle no longer hangs through the floor, so the arm is held by the scenario at the angle the first build's check found (148 degrees round); the wash takes a held arm as it takes one a load stops.

Stages: load: session (mechanical check); water: hydraulics (stalled arm), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| coverage | share of the plates' faces ever under a direct jet, B over A | 0.409 | 0 | 0 1 | direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %) | |x| <= 0.2 | pass |
| score | mean IEC score of the plates of that rack, B - A | 0.143 | 0.143 | 0 score | mean score of that rack -1.5 or more | -0.5 to -5 | too small |

- **A**: arm free. Load `plates-36`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.116), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:2812e8fbb671`, 312.9 s.
- **B**: lower arm held 148 degrees round (set: where the hanging ladle of the first build stopped it). Load `plates-36`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1, lower arm stopped. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.115), peracid mean 0.0937 mmol/L (peak 0.446). Result `sha256:3b40ef65f46a`, 191.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.0065 | 0.477 | 301 | 20 | 1 | 1 | 2.35 | 19.4 | 0.991 | 0 |  | 0 | 463 | 0 | 1.74 | iec_egg_yolk (reaction) 5.26/1527 mg |
| B | plate_4 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 1.31 | 13.3 | 0.896 | 0 |  | 0 | 629 | 0 | 1.74 | iec_egg_yolk (reaction) 7.14/1527 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

