# Phenomena suite: official tier, packages/calibration/anchors/anchored-v7.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.5.0 water-7`; parameters packages/calibration/anchors/anchored-v7.owner-capsule.json (hydro `sha256:7c3bd46790e7`, soil `sha256:befdea03d920`, 18 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `ee5fd167dc08ad64`. Exposure traced on: gpu. 3 phenomena, 9 washes (6 with cached exposure), 790.8 s.

Verdicts: 2 pass, 1 too large.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P15 | Nested spoons | pass | shielded: 0 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P25 | Detergent dispenser blocked | too large | protein: 0.275 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 |
| P03 | Plate pitch too small | pass | halving: 5 -> 2: -3 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |

## Phenomena

### P15 Nested spoons: pass

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch. The opposed pair and the first spoon of the nested pair are settled by the loading physics; the second spoon of the nested pair is set (the physics lets it slide off and rest across the first, touching at a point): it lies behind the first, the back of the first in its hollow, 10 cm2 of the hollow within 1 mm and nowhere nearer than 0.5 mm.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 0 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | pass |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0 | 0.0927 | 0.0927 1 | when spoons spoon, they trap food | +0.01 or more | pass |

- **A**: opposed. Load `spoons-opposed`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:e0143401cfe8`, 4.6 s (exposure cached).
- **B**: nested. Load `spoons-nested`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:51b9b872dad2`, 292.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 2.6e-5 | 0.243 | 115 | 34.5 | 1 | 1 | 0.134 | 13.2 | 0.855 | 0 |  | 5 | 0 | 0 | 0.121 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.0067 | 0.978 | 330 | 38.8 | 1 | 1 | 2.02 | 30.1 | 0.942 | 0 |  | 5 | 0 | 0 | 0.305 | iec_oat_flakes (reaction) 0/24.3 mg |
| B | spoon_1 (bowl) | 8.9e-5 | 0.377 | 286 | 47.1 | 1 | 1 | 0.21 | 16.8 | 0.893 | 0 |  | 5 | 0 | 0 | 0.636 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_2 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.0198 | 0.119 | 0.34 | 0 |  | 0 | 209 | 0 | 0.626 | iec_oat_flakes (reaction) 2.25/24.3 mg |

### P25 Detergent dispenser blocked: too large

Test: A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D).

Adapted: The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.

Stages: load: session (mechanical check); soil: liquor (dosing), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| protein | share of the egg yolk removed without detergent (B) |  |  | 0.275 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 | too large |
| tea | share of the tea film removed without detergent (D) |  |  | 0.4 1 | tea stays | |x| <= 0.2 | too large |
| score | mean IEC score of the three pieces, blocked minus free | 3.67 | 0 | -3.67 score | load mean -1.5 or more | -0.5 to -5 | pass |

- **A**: plate, dispenser free. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:9bfad95ac7ce`, 0.9 s (exposure cached).
- **B**: plate, dispenser blocked. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 257 min with detergent, mean 45.7 C (max 61 C), pH 9.89 (max 10.6), protease mean 0.0193 g/L (peak 0.071), peracid mean 0.0107 mmol/L (peak 0.0466). Result `sha256:9fba3959bdf7`, 3.2 s (exposure cached).
- **C**: tea cups, dispenser free. Load `cups-centre-corner`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:112651335c1b`, 296.8 s.
- **D**: tea cups, dispenser blocked. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 257 min with detergent, mean 45.7 C (max 61 C), pH 9.89 (max 10.6), protease mean 0.0193 g/L (peak 0.0712), peracid mean 0.0107 mmol/L (peak 0.0468). Result `sha256:6132e6abc56f`, 1.1 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00586 | 0.548 | 230 | 24.6 | 1 | 1 | 4.82 | 31.6 | 1.24 | 0 |  | 3 | 2.58 | 0 | 0.953 | iec_egg_yolk (reaction) 0.0344/1063 mg |
| B | plate (well) | 0.00586 | 0.548 | 230 | 24.6 | 1 | 1 | 4.82 | 31.6 | 1.24 | 0 |  | 0 | 9149 | 0 | 0.953 | iec_egg_yolk (reaction) 771/1063 mg |
| C | cup_1 (interior) | 0.0297 | 0.413 | 352 | 32.2 | 1 | 1 | 7.51 | 48 | 1.17 | 0 | 0.0133 mL, full for 0 s | 4 | 1.89 | 0 | 1.75 | iec_tea (bleach) 0.134/3.46 mg |
| D | cup_1 (interior) | 0.0297 | 0.413 | 352 | 32.2 | 1 | 1 | 7.51 | 48 | 1.17 | 0 | 0.0133 mL, full for 0 s | 0 | 7206 | 0 | 1.75 | iec_tea (bleach) 2.07/3.46 mg |

### P03 Plate pitch too small: pass

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot half a pitch apart (about 9 mm from plate to plate, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become half a pitch, every slot and every second slot. Seven plates per row (eight when crowded). A and C are settled by the loading physics between the tines. B cannot be: a slot is 14 mm wide, two plates in it nest (the covered well under 1 mm from its partner's back over its whole area: a contact, not a narrow gap; found by the review of 11 October 2026), and a plate half a pitch in front of a seated one stands in the next tine. For B the tines of the rear lane are folded down and the row is set from the seat the physics gave the plate behind in slot 6: the covered plate of every pair stands at that seat, two slots along per pair, its partner parallel to it half a pitch (9.1 mm) in front, and the whole row is raised by the 11 mm at which it clears the folded tines; the covered well then looks into a gap of 3.7 to 5 mm. So B differs from A by the pitch, by 11 mm of height and by the tines, which in A stand in front of the foot of every plate.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 5 | 2 | -3 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | pass |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 5 | 5 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.00294 | 0 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.71), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.115), peracid mean 0.0928 mmol/L (peak 0.446). Result `sha256:8537f1867eba`, 169.8 s.
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `eco_50`, 8 items (6 clean, mean score of the soiled 4.25), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.116), peracid mean 0.0924 mmol/L (peak 0.446). Result `sha256:5f9ad4380b71`, 8.9 s (exposure cached).
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.71), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.115), peracid mean 0.0927 mmol/L (peak 0.446). Result `sha256:775a3315e8e0`, 7.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00294 | 0.473 | 71.2 | 17.8 | 1 | 1 | 1.29 | 13.2 | 0.841 | 0 |  | 5 | 0 | 0 | 1.74 | iec_egg_yolk (reaction) 5.1e-4/1527 mg |
| B | plate_6 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.507 | 7.01 | 0.637 | 0 |  | 3 | 4.5 | 0 | 1.83 | iec_egg_yolk (reaction) 0.0521/1605 mg |
| C | plate_4 (well) | 0.00648 | 0.477 | 301 | 20.1 | 1 | 1 | 2.36 | 19.5 | 0.995 | 0 |  | 5 | 0 | 0 | 1.74 | iec_egg_yolk (reaction) 2.3e-4/1527 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

