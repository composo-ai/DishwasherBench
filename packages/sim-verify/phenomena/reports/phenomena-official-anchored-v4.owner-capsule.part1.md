# Phenomena suite: official tier, packages/calibration/anchors/anchored-v4.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.4.1 water-5`; parameters packages/calibration/anchors/anchored-v4.owner-capsule.json (hydro `sha256:ecdf6e077c2e`, soil `sha256:45173d348ccd`, 16 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `beaf25c1244cad08`. Exposure traced on: gpu. 4 phenomena, 10 washes (3 with cached exposure), 1876 s.

Verdicts: 1 pass, 3 too large.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | retained: 1.09 -> 259: 258 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.8e-4 -> 1.4e-4: 0.284 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P04 | Nesting or "spooning" of like items | too large | score: 5 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 |
| P15 | Nested spoons | too large | shielded: 3 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |

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

- **A**: mouth down. Load `hollow-inverted`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.97 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:0ee055fe12fc`, 264.8 s.
- **B**: mouth up. Load `hollow-upright`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:7cfd47e1be82`, 269.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00882 | 0.739 | 509 | 27.7 | 1 | 1 | 2.76 | 22.7 | 0.811 | 0 | 1.09 mL, full for 5754 s | 0 | 1257 | 1.09 | 3.2 | iec_tea (bleach) 0.35/5.77 mg |
| A | bowl (interior) | 0.105 | 0.978 | 430 | 26.1 | 1 | 1 | 13.3 | 58.8 | 1.37 | 0 |  | 5 | 0 | 0 | 1.83 | iec_oat_flakes (reaction) 0/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 0.578 | 5.2 | 0.464 | 0.896 | 259 mL, full for 5396 s | 0 | 11235 | 259 | 1.46 | iec_tea (bleach) 0.935/5.77 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 5.39 | 20.1 | 0.776 | 0.431 | 108 mL, full for 5740 s | 5 | 0 | 108 | 2.37 | iec_oat_flakes (reaction) 0/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate (C) faces the axis tipped 10 degrees up, and a reversed plate (D) falls back against the tines and lies 34 degrees from the vertical with its face to the wall and down. C and D are reported as supporting evidence.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.8e-4 | 1.4e-4 | 0.284 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 0.449 | 0.467 | 0.0178 1 | removal depends on how often the spot is hit | +0.01 or more | pass |
| settled (supporting) | fraction of time the soiled face is under a direct jet, settled reversed plate (D) over the seated one (C) | 0.00585 | 0.0349 | 5.96 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| settled_residue (supporting) | share of the egg yolk left on the face, D - C | 0.431 | 0.423 | -0.008 1 | removal depends on how often the spot is hit | +0.01 or more | wrong sign |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:a0f915f3620d`, 278.5 s.
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:70b6335028a5`, 12 s (exposure cached).
- **C**: seated in its slot, face to the arm axis (settled). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:fe1d259aa1af`, 282.7 s.
- **D**: put in reversed and settled. Load `plate-away`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:54079ff56634`, 146.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.8e-4 | 0.488 | 275 | 33.5 | 1 | 1 | 4.51 | 32.6 | 1.05 | 0 |  | 0 | 9145 | 0 | 0.823 | iec_egg_yolk (reaction) 477/1063 mg |
| B | plate (well) | 1.4e-4 | 0.101 | 44.4 | 18.4 | 1 | 1 | 0.579 | 7.34 | 0.65 | 0 |  | 0 | 9147 | 0 | 0.808 | iec_egg_yolk (reaction) 496/1063 mg |
| C | plate (well) | 0.00585 | 0.552 | 231 | 24.4 | 1 | 1 | 4.58 | 30.3 | 1.2 | 0 |  | 0 | 9139 | 0 | 0.953 | iec_egg_yolk (reaction) 458/1063 mg |
| D | plate (well) | 0.0349 | 0.974 | 369 | 27.2 | 1 | 1 | 7.66 | 38.9 | 0.991 | 0 |  | 0 | 9122 | 0 | 1.61 | iec_egg_yolk (reaction) 449/1063 mg |

### P04 Nesting or "spooning" of like items: too large

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 2.5e-14 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 5 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | too large |
| against (supporting) | share of the porridge left inside that bowl, B - A | 0 | 2.5e-14 | 2.5e-14 1 | nesting leaves more | +0.01 or more | too small |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0698 | 1.9e-5 | 2.7e-4 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:aa292d6a8404`, 6.6 s (exposure cached).
- **B**: nested. Load `bowls-nested`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.97 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:4d26a73c21a6`, 334.6 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0698 | 0.932 | 382 | 26.8 | 1 | 1 | 9.95 | 48.1 | 1.2 | 0 |  | 5 | 0 | 0 | 1.93 | iec_oat_flakes (reaction) 0/177 mg |
| B | bowl_over (interior) | 1.9e-5 | 0.032 | 26.4 | 12.4 | 1 | 1 | 0.361 | 4.27 | 0.458 | 0 |  | 5 | 0 | 0 | 2.32 | iec_oat_flakes (reaction) 4.3e-12/177 mg |

### P15 Nested spoons: too large

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 3 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | too large |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0 | 5.1e-4 | 5.1e-4 1 | when spoons spoon, they trap food | +0.01 or more | too small |

- **A**: opposed. Load `spoons-opposed`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:a8c5c0525689`, 5.8 s (exposure cached).
- **B**: nested. Load `spoons-nested`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 4.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:c9f2b52daff4`, 266.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.824 | 26.9 | 1.05 | 0 |  | 5 | 0 | 0 | 0.133 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.00598 | 0.883 | 311 | 37.4 | 1 | 1 | 1.78 | 29.4 | 0.956 | 0 |  | 5 | 0 | 0 | 0.2 | iec_oat_flakes (reaction) 0/24.3 mg |
| B | spoon_1 (bowl) | 0.00364 | 0.999 | 255 | 27.3 | 1 | 1 | 1.39 | 33.8 | 1.16 | 0 |  | 5 | 0 | 0 | 0.425 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_2 (bowl) | 6.3e-5 | 0.104 | 142 | 33.1 | 1 | 1 | 0.199 | 9.09 | 0.907 | 0 |  | 4 | 0.876 | 0 | 0.412 | iec_oat_flakes (reaction) 0.0124/24.3 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

