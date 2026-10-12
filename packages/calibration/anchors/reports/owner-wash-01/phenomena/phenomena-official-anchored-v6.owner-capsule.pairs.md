# Phenomena suite: official tier, packages/calibration/anchors/anchored-v6.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.5.0 water-6`; parameters packages/calibration/anchors/anchored-v6.owner-capsule.json (hydro `sha256:7c3bd46790e7`, soil `sha256:50ec21ea0c32`, 18 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `302cf1ea347fffa9`. Exposure traced on: gpu. 5 phenomena, 12 washes (8 with cached exposure), 1296.3 s.

Verdicts: 2 too small, 3 too large.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.6e-4 -> 1.4e-4: 0.297 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P04 | Nesting or "spooning" of like items | too small | residue: 0.0534 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 |
| P14 | Soiled face against the tub wall or door liner | too small | score: 5 -> 5: 0 score | as P02: -1 to -2 | -0 to -4 |
| P15 | Nested spoons | too large | shielded: 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P25 | Detergent dispenser blocked | too large | protein: 0.275 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 |

## Phenomena

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate faces the axis tipped up with the tines. The pair of the first build that compared the seated plate with one put in reversed is gone: on the present basket the loader does not seat a reversed plate in that slot, and the seated plate turned round in place cuts 2 mm into the tines.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.6e-4 | 1.4e-4 | 0.297 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 2 | 2 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 5.4e-5 | 1.0e-4 | 5.0e-5 1 | removal depends on how often the spot is hit | +0.01 or more | too small |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:2478b565a380`, 2.9 s (exposure cached).
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:0eb8c7b01efc`, 328.5 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.6e-4 | 0.488 | 275 | 33.9 | 1 | 1 | 4.52 | 32.5 | 1.05 | 0 |  | 2 | 3.9 | 0 | 0.823 | iec_egg_yolk (reaction) 0.057/1063 mg |
| B | plate (well) | 1.4e-4 | 0.101 | 44.4 | 18.5 | 1 | 1 | 0.585 | 7.39 | 0.652 | 0 |  | 2 | 7.55 | 0 | 0.808 | iec_egg_yolk (reaction) 0.11/1063 mg |

### P04 Nesting or "spooning" of like items: too small

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 0.0534 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 0 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | pass |
| against (supporting) | share of the porridge left inside that bowl, B - A | 0 | 0.0534 | 0.0534 1 | nesting leaves more | +0.01 or more | pass |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0704 | 5.0e-8 | 7.2e-7 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:66c3c8d2e980`, 3.2 s (exposure cached).
- **B**: nested. Load `bowls-nested`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:a5c6bbecc401`, 3.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0704 | 0.942 | 404 | 27.1 | 1 | 1 | 10.1 | 48.7 | 1.21 | 0 |  | 5 | 0 | 0 | 1.91 | iec_oat_flakes (reaction) 0/177 mg |
| B | bowl_over (interior) | 5.0e-8 | 4.5e-4 | 19.3 | 12.4 | 1 | 1 | 0.00488 | 0.204 | 0.0934 | 0 |  | 0 | 1702 | 0 | 2.19 | iec_oat_flakes (reaction) 9.47/177 mg |

### P14 Soiled face against the tub wall or door liner: too small

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the loading physics seats the platter face inward and does not seat it reversed on the present basket, so both ways round are set poses: the platter exactly upright 30 mm outboard of its outermost seat, between the last tine and the side wall of the basket, the one place where it clears the tines either way round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00741 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 5 | 5 | 0 score | as P02: -1 to -2 | -0 to -4 | too small |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 34 | 4.8 | -0.859 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 6.5e-13 | 4.0e-9 | 4.0e-9 1 | the face to the wall keeps more | +0.01 or more | too small |

- **A**: face inward: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:43f0658f6fe3`, 3 s (exposure cached).
- **B**: face to the wall: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:fd49d3572e33`, 2.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00741 | 0.538 | 509 | 30.2 | 1 | 1 | 5.36 | 34 | 1.25 | 0 |  | 5 | 0 | 0 | 0.913 | iec_egg_yolk (reaction) 6.6e-10/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.359 | 4.8 | 0.486 | 0 |  | 5 | 0 | 0 | 0.97 | iec_egg_yolk (reaction) 4.1e-6/1026 mg |

### P15 Nested spoons: too large

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | too large |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0 | 0 | 0 1 | when spoons spoon, they trap food | +0.01 or more | too small |

- **A**: opposed. Load `spoons-opposed`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:fc311d89db5d`, 328.7 s.
- **B**: nested. Load `spoons-nested`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:7e8362d7a6ce`, 2.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 2.6e-5 | 0.243 | 115 | 34.5 | 1 | 1 | 0.132 | 13.1 | 0.852 | 0 |  | 5 | 0 | 0 | 0.121 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.0067 | 0.978 | 330 | 38.8 | 1 | 1 | 2.02 | 30.2 | 0.942 | 0 |  | 5 | 0 | 0 | 0.305 | iec_oat_flakes (reaction) 0/24.3 mg |
| B | spoon_1 (bowl) | 8.9e-5 | 0.377 | 286 | 47.1 | 1 | 1 | 0.202 | 16.5 | 0.876 | 0 |  | 5 | 0 | 0 | 0.16 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_2 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.202 | 15.3 | 0.913 | 0 |  | 5 | 0 | 0 | 0.17 | iec_oat_flakes (reaction) 0/24.3 mg |

### P25 Detergent dispenser blocked: too large

Test: A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D).

Adapted: The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.

Stages: load: session (mechanical check); soil: liquor (dosing), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| protein | share of the egg yolk removed without detergent (B) |  |  | 0.275 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 | too large |
| tea | share of the tea film removed without detergent (D) |  |  | 0.42 1 | tea stays | |x| <= 0.2 | too large |
| score | mean IEC score of the three pieces, blocked minus free | 2 | 0 | -2 score | load mean -1.5 or more | -0.5 to -5 | pass |

- **A**: plate, dispenser free. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:ad7503871f11`, 0.9 s (exposure cached).
- **B**: plate, dispenser blocked. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 257 min with detergent, mean 45.7 C (max 61 C), pH 9.89 (max 10.6), protease mean 0.0194 g/L (peak 0.0717), peracid mean 0.0107 mmol/L (peak 0.0471). Result `sha256:7079a174f29e`, 310.1 s.
- **C**: tea cups, dispenser free. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 1.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.114), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:e82de715c62f`, 1 s (exposure cached).
- **D**: tea cups, dispenser blocked. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 257 min with detergent, mean 45.7 C (max 61 C), pH 9.89 (max 10.6), protease mean 0.0194 g/L (peak 0.0722), peracid mean 0.0107 mmol/L (peak 0.0475). Result `sha256:3b093bc17e35`, 286.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00586 | 0.556 | 230 | 24.6 | 1 | 1 | 4.62 | 30.5 | 1.2 | 0 |  | 3 | 2.61 | 0 | 0.953 | iec_egg_yolk (reaction) 0.035/1063 mg |
| B | plate (well) | 0.00586 | 0.556 | 230 | 24.6 | 1 | 1 | 4.62 | 30.5 | 1.2 | 0 |  | 0 | 9149 | 0 | 0.953 | iec_egg_yolk (reaction) 771/1063 mg |
| C | cup_1 (interior) | 0.0514 | 0.571 | 357 | 29.1 | 1 | 1 | 9.24 | 49.8 | 1.28 | 0 |  | 3 | 5.3 | 0 | 1.23 | iec_tea (bleach) 0.0936/3.46 mg |
| D | cup_1 (interior) | 0.0514 | 0.571 | 357 | 29.1 | 1 | 1 | 9.24 | 49.8 | 1.28 | 0 |  | 0 | 7206 | 0 | 1.23 | iec_tea (bleach) 1.94/3.46 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

