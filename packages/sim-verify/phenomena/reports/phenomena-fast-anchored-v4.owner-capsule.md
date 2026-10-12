# Phenomena suite: fast tier, packages/calibration/anchors/anchored-v4.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.4.1 water-5`; parameters packages/calibration/anchors/anchored-v4.owner-capsule.json (hydro `sha256:ecdf6e077c2e`, soil `sha256:45173d348ccd`, 16 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `e340d315ec29aee4`. Exposure traced on: gpu. 48 phenomena, 83 washes (26 with cached exposure), 2668.4 s.

Verdicts: 13 pass, 3 wrong sign, 17 too small, 6 too large, 9 not covered.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | retained: 1.09 -> 259: 258 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.1e-4 -> 1.5e-4: 0.361 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P03 | Plate pitch too small | too small | halving: 0 -> 0: 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |
| P04 | Nesting or "spooning" of like items | too large | score: 4 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 |
| P05 | Large flat item shadows what is behind or above it | too small | score: 0 -> 0: 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P06 | Spray arm stalled by an item | too small | score: 0 -> 0: 0 score | mean score of that rack -1.5 or more | -0.5 to -5 |
| P07 | Radial position: centre against corner | too small | score: 0 -> 0: 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 |
| P08 | Left/right asymmetry with rotation direction | pass | score: 0 -> 0: 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 |
| P09 | Lean direction of plates | too small | score: 0 -> 0: 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 |
| P10 | Tall narrow vessel interior | wrong sign | residue: 0.0522 -> 0.0168: -0.0353 1 | the interior of the tall vessel is the last place to clean | +0.01 or more |
| P11 | Upper against lower rack for tenacious soil | pass | score: 0 -> 0: 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 |
| P12 | Alternating large and small plates | too small | score: 0 -> 0: 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 |
| P13 | Glass or cup placed over tines | too small | f_jet: 0.0119 -> 0.0114: -0.0418 1 | interior f_jet reduced | -0.05 or more |
| P14 | Soiled face against the tub wall or door liner | too small | score: 0 -> 0: 0 score | as P02: -1 to -2 | -0 to -4 |
| P15 | Nested spoons | too large | shielded: 3 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P16 | Heads up against heads down (not nested) | pass | score: 0 -> 0: 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 |
| P17 | Crowded basket cells | too small | crowding: 0.333 -> 0.458: 0.125 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 |
| P18 | Cutlery tray against basket | pass | water: 0 -> 1.46: 1.46 mL | spoon bowls facing up hold water | + (any size) |
| P19 | Loading beyond rated capacity | wrong sign | mean: 2.12 -> 2.19: 0.0732 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 |
| P20 | Total soil load | too small | mean: 2.7 -> 2.7: 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 |
| P21 | Redeposition of particulates | not covered | specks: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 |
| P22 | Clean neighbours of soiled items | pass | clean: 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 |
| P23 | End-of-cycle drips from the upper rack | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 |
| P24 | Arrangement does not matter for easy soils (negative control) | pass | range: 0.156 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 |
| P25 | Detergent dispenser blocked | too large | tea: 0.268 1 | tea stays | |x| <= 0.2 |
| P26 | Tablet trapped or dissolving in a dead spot | not covered | score: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) | similar to under-dosing; size unknown: calibration parameter | - (any size) |
| P27 | Time and temperature trade | too large | score: 0 -> 5: 5 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 |
| P28 | Bleachable stains are position-insensitive (negative control) | pass | position: 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 |
| P29 | Ageing of the soil before the wash | too small | fresh: -4.5 score | crockery mean at least 4.5 fresh | within 1 of the range |
| P30 | Protein soil responds to hit frequency and chemistry, not to jet strength | pass | pump: 0.571 -> 0.496: -0.0748 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 |
| P31 | Starch is bimodal | too small | both: 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more |
| P32 | Microwaved milk on glass is persistent | too large | eco: 0 -> 5: 5 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 |
| P33 | Fat needs temperature and enough water | too small | temperature: 7.9e-12 -> 8.4e-8: 8.4e-8 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more |
| P34 | Thick layers detach as flakes | not covered | flakes: needs detachment of thick layers as flakes | thick egg yolk partly tended to flake off | + (any size) |
| P35 | Pot interiors | wrong sign | side: 1.2e-4 -> 1.1e-10: -1.2e-4 1 | on its side, half the wall is shadowed | +0.01 or more |
| P36 | Water pools in the base recess of inverted cups and mugs | pass | pool: 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 |
| P37 | Tilt drains the recess | too small | tilt15: 5 -> 0.111: 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 |
| P38 | Plastic stays wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 |
| P39 | Pots and large hollow ware stay wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 |
| P40 | Liquid held at contact points and in narrow gaps | pass | held: 2.29 -> 2.51: 0.215 g | a wet mark at every touching pair | + (any size) |
| P41 | Light plastic items are moved or flipped by jets | not covered | moved: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) |
| P42 | Cutlery dries almost completely (negative control) | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | drying 0.99 | |x| <= 0.04 |
| P43 | Spots, film and tine marks on glass | not covered | spots: needs spots and film from evaporated water, and marks at contacts | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) |
| P44 | Cutlery comes out clean although it is the most shadowed class | too small | class: -1.49 score | class mean 4.6 to 4.8 | within 1 of the range |
| P45 | Class ranking in the standard test | too small | overall: -1.31 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range |
| P46 | Run-to-run repeatability | too small | spread: 0.0283 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 |
| P47 | Everything is wetted within seconds; jets are rare events | pass | f_jet: 0.0207 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 |
| P48 | Detergent does not change where water goes | pass | jets: 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 |

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

- **A**: mouth down. Load `hollow-inverted`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:aa7994517ad6`, 40.6 s.
- **B**: mouth up. Load `hollow-upright`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:2e97833a1b64`, 61 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00926 | 0.719 | 386 | 26.9 | 1 | 1 | 2.96 | 21.9 | 0.827 | 0 | 1.09 mL, full for 5753 s | 0 | 1207 | 1.09 | 2.89 | iec_tea (bleach) 0.348/5.77 mg |
| A | bowl (interior) | 0.104 | 0.963 | 250 | 26 | 1 | 1 | 13.7 | 59.1 | 1.4 | 0 |  | 5 | 0 | 0 | 1.84 | iec_oat_flakes (reaction) 0/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 0.637 | 5.85 | 0.506 | 0.897 | 259 mL, full for 5404 s | 0 | 11212 | 259 | 1.42 | iec_tea (bleach) 0.924/5.77 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 5.58 | 21 | 0.802 | 0.427 | 108 mL, full for 5740 s | 5 | 0 | 108 | 2.54 | iec_oat_flakes (reaction) 0/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate (C) faces the axis tipped 10 degrees up, and a reversed plate (D) falls back against the tines and lies 34 degrees from the vertical with its face to the wall and down. C and D are reported as supporting evidence.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.1e-4 | 1.5e-4 | 0.361 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 0.471 | 0.483 | 0.0124 1 | removal depends on how often the spot is hit | +0.01 or more | pass |
| settled (supporting) | fraction of time the soiled face is under a direct jet, settled reversed plate (D) over the seated one (C) | 0.00605 | 0.035 | 5.79 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| settled_residue (supporting) | share of the egg yolk left on the face, D - C | 0.451 | 0.438 | -0.0136 1 | removal depends on how often the spot is hit | +0.01 or more | wrong sign |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:57547f4ad2cd`, 41.5 s.
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:9e1e03b065e3`, 42.8 s.
- **C**: seated in its slot, face to the arm axis (settled). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:baea3e6366e8`, 43.7 s.
- **D**: put in reversed and settled. Load `plate-away`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:1ab42fe5e9cb`, 49.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.1e-4 | 0.337 | 264 | 32.4 | 1 | 1 | 4.47 | 31.2 | 1.07 | 0 |  | 0 | 8810 | 0 | 0.88 | iec_egg_yolk (reaction) 500/1063 mg |
| B | plate (well) | 1.5e-4 | 0.135 | 37.3 | 19 | 1 | 1 | 0.688 | 8.41 | 0.7 | 0 |  | 0 | 8811 | 0 | 0.877 | iec_egg_yolk (reaction) 514/1063 mg |
| C | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8807 | 0 | 1.02 | iec_egg_yolk (reaction) 480/1063 mg |
| D | plate (well) | 0.035 | 0.968 | 283 | 27.2 | 1 | 1 | 7.68 | 38.2 | 1.04 | 0 |  | 0 | 8799 | 0 | 1.52 | iec_egg_yolk (reaction) 465/1063 mg |

### P03 Plate pitch too small: too small

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot (about 7 mm between the pair, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become two plates to a slot, every slot and every second slot. Seven plates per row (eight when crowded). All rows are settled by the loading physics; the crowded row has pairs in slots 2, 4, 6 and 8, so the covered plate of a pair has its face about 7 mm behind its partner while the partner faces an open slot.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 0 | 0 | 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | too small |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 0 | 0 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.00313 | 0 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.077 mmol/L (peak 0.449). Result `sha256:50c8e7731f30`, 1.5 s (exposure cached).
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `auto_145`, 8 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0769 mmol/L (peak 0.449). Result `sha256:3a350c7ed06e`, 54.6 s.
  - load: plate_6 rests but the stability probe flags it
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.077 mmol/L (peak 0.449). Result `sha256:b8c8c3a17dcb`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00313 | 0.467 | 67.4 | 17.6 | 1 | 1 | 1.19 | 12.4 | 0.81 | 0 |  | 0 | 15709 | 0 | 1.65 | iec_egg_yolk (reaction) 510/1527 mg |
| B | plate_6 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.49 | 6.62 | 0.636 | 0 |  | 0 | 15925 | 0 | 2.1 | iec_egg_yolk (reaction) 652/1605 mg |
| C | plate_4 (well) | 0.00674 | 0.472 | 194 | 19.8 | 1 | 1 | 2.26 | 18.6 | 0.961 | 0 |  | 0 | 15595 | 0 | 1.65 | iec_egg_yolk (reaction) 486/1527 mg |

### P04 Nesting or "spooning" of like items: too large

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 1.8e-6 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 4 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | too large |
| against (supporting) | share of the porridge left inside that bowl, B - A | 0 | 1.8e-6 | 1.8e-6 1 | nesting leaves more | +0.01 or more | too small |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0701 | 3.2e-5 | 4.6e-4 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:a30cea0b42db`, 61.6 s.
- **B**: nested. Load `bowls-nested`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 4.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:55e59c8f6c12`, 42.1 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0701 | 0.921 | 315 | 26.7 | 1 | 1 | 10.3 | 48.5 | 1.24 | 0 |  | 5 | 0 | 0 | 1.97 | iec_oat_flakes (reaction) 0/177 mg |
| B | bowl_over (interior) | 3.2e-5 | 0.0423 | 19 | 11.5 | 1 | 1 | 0.369 | 4.4 | 0.466 | 0 |  | 4 | 0.124 | 0 | 2.29 | iec_oat_flakes (reaction) 3.3e-4/177 mg |

### P05 Large flat item shadows what is behind or above it: too small

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 0 | 0 | 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | too small |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 0.00183 | 1.3e-4 | -0.926 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:7c283bd595a0`, 44.7 s.
- **B**: platter between the plates and the arm axis. Load `board-middle`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:d8ec4e3db87b`, 61.9 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 5.0e-4 | 0.154 | 107 | 20.5 | 1 | 1 | 1.04 | 11 | 0.779 | 0 |  | 0 | 8803 | 0 | 1.09 | iec_egg_yolk (reaction) 433/985 mg |
| A | plate_2 (well) | 0.00316 | 0.372 | 214 | 23.4 | 1 | 1 | 2.61 | 22.8 | 0.953 | 0 |  | 0 | 8780 | 0 | 1.06 | iec_egg_yolk (reaction) 394/969 mg |
| B | plate_1 (well) | 1.9e-4 | 0.106 | 234 | 30.7 | 1 | 1 | 1.94 | 16.5 | 0.939 | 0 |  | 0 | 8802 | 0 | 1.03 | iec_egg_yolk (reaction) 426/985 mg |
| B | plate_2 (well) | 8.3e-5 | 0.0672 | 324 | 31.8 | 1 | 1 | 2.59 | 19.5 | 1.01 | 0 |  | 0 | 8791 | 0 | 1.03 | iec_egg_yolk (reaction) 407/969 mg |

### P06 Spray arm stalled by an item: too small

Test: Seven IEC dinner plates with egg yolk in every second slot of the rear lane (A); the same with a ladle let down through the floor of the lower basket until it hangs in the path of the lower arm (B).

Adapted: A ladle stands in for the fork: a fork slips through the floor grid of this basket and falls, a ladle hangs by its bowl. The session's mechanical check finds the arm stopped and the angle; the wash takes both from it.

Stages: load: session (mechanical check); water: hydraulics (stalled arm), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| coverage | share of the plates' faces ever under a direct jet, B over A | 0.42 | 0 | 0 1 | direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %) | |x| <= 0.2 | pass |
| score | mean IEC score of the plates of that rack, B - A | 0 | 0 | 0 score | mean score of that rack -1.5 or more | -0.5 to -5 | too small |

- **A**: arm free. Load `plates-36`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.077 mmol/L (peak 0.449). Result `sha256:b8c8c3a17dcb`, 46 s.
- **B**: lower arm stopped by the hanging ladle. Load `plates-36-stalled`, programme `auto_145`, 8 items (1 clean, mean score of the soiled 0), seeds 1/1, lower arm stopped. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.077 mmol/L (peak 0.449). Result `sha256:fd850e627037`, 54.6 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00674 | 0.472 | 194 | 19.8 | 1 | 1 | 2.26 | 18.6 | 0.961 | 0 |  | 0 | 15595 | 0 | 1.65 | iec_egg_yolk (reaction) 486/1527 mg |
| B | plate_4 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 1.14 | 12 | 0.849 | 0 |  | 0 | 15729 | 0 | 1.65 | iec_egg_yolk (reaction) 513/1527 mg |

### P07 Radial position: centre against corner: too small

Test: Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle).

Adapted: The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.

Stages: water: hydraulics (nozzle positions), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate at the corner against the one at mid-radius | 0 | 0 | 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 | too small |
| dwell (supporting) | fraction of time the face is under a direct jet, corner over mid-radius, minus one | 0.0135 | 0.00969 | -0.284 1 | low radial locations are impacted for longer | -0.05 or more | pass |

- **A**: four soup plates. Load `soup-radial`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0771 mmol/L (peak 0.449). Result `sha256:140345b714f9`, 43.6 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_1 (well) | 0.00239 | 0.454 | 204 | 21.2 | 1 | 1 | 4.65 | 27.2 | 0.927 | 0 |  | 0 | 14115 | 0 | 1.49 | iec_egg_yolk (reaction) 621/1478 mg |
| A | soup_2 (well) | 0.0135 | 0.671 | 251 | 21.5 | 1 | 1 | 5.57 | 31.6 | 1.09 | 0 |  | 0 | 14113 | 0 | 1.47 | iec_egg_yolk (reaction) 656/1574 mg |
| A | soup_3 (well) | 0.00969 | 0.652 | 307 | 29.5 | 1 | 1 | 4.69 | 27 | 0.964 | 0 |  | 0 | 14115 | 0 | 1.89 | iec_egg_yolk (reaction) 647/1552 mg |

### P08 Left/right asymmetry with rotation direction: pass

Test: Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis.

Adapted: The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.

Stages: water: hydraulics (nozzle directions, sense of rotation), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the right-hand plate minus the left-hand one | 0 | 0 | 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 | pass |
| jets (supporting) | fraction of time the face is under a direct jet, right over left, minus one | 0.00969 | 0.0322 | 2.33 1 | in one real arm a right-hand plate received five jets and its mirror image two | |x| <= 3 | pass |

- **A**: mirrored plates. Load `soup-radial`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0771 mmol/L (peak 0.449). Result `sha256:140345b714f9`, 43.6 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_3 (well) | 0.00969 | 0.652 | 307 | 29.5 | 1 | 1 | 4.69 | 27 | 0.964 | 0 |  | 0 | 14115 | 0 | 1.89 | iec_egg_yolk (reaction) 647/1552 mg |
| A | soup_4 (well) | 0.0322 | 0.927 | 363 | 25.7 | 1 | 1 | 7.24 | 36.1 | 1.08 | 0 |  | 0 | 13973 | 0 | 1.9 | iec_egg_yolk (reaction) 542/1509 mg |

### P09 Lean direction of plates: too small

Test: A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up).

Adapted: The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.

Stages: water: jets (incidence), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 | too small |
| f_jet (supporting) | fraction of time the soiled face is under a direct jet, B over A, minus one | 0.00963 | 1.8e-4 | -0.982 1 | leaning away presents the back | -0.05 or more | pass |

- **A**: leaning toward the arm axis. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:70931b5da804`, 43.6 s.
- **B**: leaning away from the arm axis. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:c1864b3cfceb`, 44.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00963 | 0.866 | 363 | 30 | 1 | 1 | 11.9 | 59.1 | 1.31 | 0 |  | 0 | 8808 | 0 | 0.982 | iec_egg_yolk (reaction) 485/1063 mg |
| B | plate (well) | 1.8e-4 | 0.141 | 42.7 | 20.7 | 1 | 1 | 1.98 | 16.4 | 0.941 | 0 |  | 0 | 8810 | 0 | 0.948 | iec_egg_yolk (reaction) 494/1063 mg |

### P10 Tall narrow vessel interior: wrong sign

Test: A 250 mL test glass (B) against a shallow dessert bowl (A), each with microwaved milk inside, mouth down at the same spot of the upper basket.

Adapted: Upper basket; both settle on the wires leaning on the same tine row.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws, chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| glass | IEC score of the glass, as a distance from the range 2.3 to 4.0 (B) |  |  | -2.3 score | standard glass class (baked milk) scores 2.3 to 4.0 | within 1 of the range | too small |
| residue | share of the milk left, glass minus bowl | 0.0522 | 0.0168 | -0.0353 1 | the interior of the tall vessel is the last place to clean | +0.01 or more | wrong sign |
| f_jet (supporting) | fraction of time the inside is under a direct jet, glass over bowl, minus one | 0.0767 | 0.0121 | -0.842 1 | a 60 mm opening is under a nozzle for about 6 % of a revolution | -0.05 or more | pass |

- **A**: shallow bowl. Load `bowl-same-spot`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:5147b39d3599`, 44.5 s.
- **B**: tall glass. Load `glass-between`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:5413c600e2d9`, 59.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl (interior) | 0.0767 | 0.72 | 267 | 27.6 | 1 | 1 | 9.16 | 48.8 | 1.27 | 0 |  | 0 | 1932 | 0 | 1.1 | iec_milk (reaction) 26.2/503 mg |
| B | glass (interior) | 0.0121 | 0.459 | 485 | 26.4 | 1 | 1 | 5.43 | 36.6 | 1.09 | 0 |  | 0 | 917 | 0 | 1.23 | iec_milk (reaction) 8.9/528 mg |

### P11 Upper against lower rack for tenacious soil: pass

Test: The same dessert plate with egg yolk standing in the rear lane of the lower basket (A) and in the rows of the upper basket (B).

Adapted: The dessert plate is the largest plate the upper basket takes. In the upper rows it does not stand as in the lower ones: the loading physics leaves it leaning about 50 degrees against the tines, which is the pose washed.

Stages: water: hydraulics (flow per level), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 | pass |
| residue (supporting) | share of the egg yolk left, B - A | 0.443 | 0.469 | 0.0268 1 | little difference between the baskets | |x| <= 0.4 | pass |

- **A**: lower basket. Load `dplate-lower`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:9556b47ccfba`, 43.2 s.
- **B**: upper basket. Load `dplate-upper`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:f3f8743eae8a`, 50.6 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0111 | 0.765 | 236 | 24.1 | 1 | 1 | 5.83 | 36 | 1.31 | 0 |  | 0 | 8806 | 0 | 1.01 | iec_egg_yolk (reaction) 470/1063 mg |
| B | plate (well) | 5.9e-5 | 0.0832 | 35.8 | 19.3 | 1 | 1 | 1.26 | 12.8 | 0.834 | 0 |  | 0 | 8810 | 0 | 1.06 | iec_egg_yolk (reaction) 499/1063 mg |

### P12 Alternating large and small plates: too small

Test: Dinner plates with egg yolk in neighbouring slots of the rear lane (A) against dinner and dessert plates alternating at the same 18.25 mm pitch (B); the dinner plate at slot 5 is scored on its upper half.

Adapted: Pitch 18.25 mm (the tines of the Bosch) instead of 15 mm.

Stages: water: jets (gap geometry); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the upper half of the large plate at slot 5, B - A | 0 | 0 | 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 | too small |
| residue (supporting) | share of the egg yolk left on the upper half of that plate, B - A | 0.267 | 0.296 | 0.0289 1 | the wider gap above the small plates lets more through | -0.01 or more | wrong sign |

- **A**: large plates only. Load `plates-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.077 mmol/L (peak 0.449). Result `sha256:50c8e7731f30`, 1.5 s (exposure cached).
- **B**: large and small alternating. Load `plates-alt-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.077 mmol/L (peak 0.449). Result `sha256:c5fecb25638d`, 45.5 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_3 (well) | 0.00244 | 0.48 | 204 | 19.2 | 1 | 1 | 1.71 | 15.6 | 0.916 | 0 |  | 0 | 15034 | 0 | 1.66 | iec_egg_yolk (reaction) 367/1383 mg |
| B | plate_2 (well) | 0.003 | 0.457 | 173 | 19.1 | 1 | 1 | 1.37 | 13.7 | 0.852 | 0 |  | 0 | 15363 | 0 | 1.66 | iec_egg_yolk (reaction) 433/1453 mg |

### P13 Glass or cup placed over tines: too small

Test: A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A).

Adapted: Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.

Stages: water: jets (tine in the path), droplets (fans off the tine), scene (contacts).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the inside is under a direct jet, B over A, minus one | 0.0119 | 0.0114 | -0.0418 1 | interior f_jet reduced | -0.05 or more | too small |
| marks (supporting) | contact marks on the glass over the tine (B) |  |  |  | AHAM adds 1 to 3 grade points per marked glass | +0.5 to +6 | not covered: needs spots and film from evaporated water, and marks at contacts |
| drying (supporting) | change of the drying score, B - A |  |  |  | drying score -1 | -0.5 to -2 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: row folded down: no tine in the glass. Load `glass-free`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:0dfcd56398d6`, 59.1 s.
- **B**: over a tine. Load `glass-free`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:0d762a42f404`, 42.9 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass (interior) | 0.0119 | 0.656 | 243 | 29.5 | 1 | 1 | 4.26 | 32.4 | 1 | 0 |  | 0 | 907 | 0 | 2.76 | iec_milk (reaction) 8.73/528 mg |
| B | glass (interior) | 0.0114 | 0.656 | 243 | 29.3 | 1 | 1 | 4.1 | 31.3 | 1 | 0 |  | 0 | 910 | 0 | 2.77 | iec_milk (reaction) 8.77/528 mg |

### P14 Soiled face against the tub wall or door liner: too small

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the platter is seated by the loading physics both ways round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00666 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 0 | 0 | 0 score | as P02: -1 to -2 | -0 to -4 | too small |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 37.4 | 4.71 | -0.874 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 0.184 | 0.267 | 0.0831 1 | the face to the wall keeps more | +0.01 or more | pass |

- **A**: face inward. Load `platter-inward`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:75324e48eea1`, 41.9 s.
- **B**: face to the wall. Load `platter-to-wall`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:afe0a3f06bce`, 42.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00666 | 0.476 | 359 | 30.3 | 1 | 1 | 6.36 | 37.4 | 1.31 | 0 |  | 0 | 10527 | 0 | 1.07 | iec_egg_yolk (reaction) 189/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.302 | 4.71 | 0.517 | 0 |  | 0 | 12129 | 0 | 1.09 | iec_egg_yolk (reaction) 274/1026 mg |

### P15 Nested spoons: too large

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 3 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | too large |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 6.7e-11 | 1.6e-5 | 1.6e-5 1 | when spoons spoon, they trap food | +0.01 or more | too small |

- **A**: opposed. Load `spoons-opposed`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:3c26b7609462`, 42.6 s.
- **B**: nested. Load `spoons-nested`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 4.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:a57c26e4c960`, 40.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.911 | 31.7 | 1.17 | 0 |  | 5 | 0 | 0 | 0.16 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.0055 | 0.758 | 275 | 37.1 | 1 | 1 | 1.53 | 26 | 0.89 | 0 |  | 5 | 0 | 0 | 0.186 | iec_oat_flakes (reaction) 1.6e-9/24.3 mg |
| B | spoon_1 (bowl) | 0.0043 | 0.93 | 240 | 24.9 | 1 | 1 | 1.37 | 34.5 | 1.16 | 0 |  | 5 | 0 | 0 | 0.424 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_2 (bowl) | 6.2e-5 | 0.0545 | 117 | 43.7 | 0.996 | 1 | 0.159 | 8.44 | 0.838 | 0 |  | 4 | 0.139 | 0 | 0.404 | iec_oat_flakes (reaction) 3.8e-4/24.3 mg |

### P16 Heads up against heads down (not nested): pass

Test: Six dinner forks with egg yolk on the tines, one per cell of the cutlery basket: handles down (A) against handles up (B).

Adapted: Six forks, one per cell: the cutlery basket of the Bosch has six cells, not twelve.

Stages: water: jets (basket walls), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the forks, B - A | 0 | 0 | 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 | pass |
| residue (supporting) | mean share of the egg yolk left on the forks, B - A | 0.544 | 0.522 | -0.022 1 | an informal test found no difference | |x| <= 0.2 | pass |

- **A**: heads up. Load `forks-heads-up`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:a614b5c80b83`, 40.6 s.
- **B**: heads down. Load `forks-heads-down`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:f5bbe1d3cb48`, 44.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | fork_1 (tines) | 3.3e-5 | 0.0217 | 38.9 | 19.4 | 1 | 1 | 0.442 | 25.3 | 1.14 | 0 |  | 0 | 1101 | 0 | 0.147 | iec_egg_yolk (reaction) 88.2/156 mg |
| B | fork_1 (tines) | 0.002 | 0.56 | 420 | 60.1 | 1 | 1 | 13.9 | 64.4 | 1.95 | 0 |  | 0 | 1101 | 0 | 0.182 | iec_egg_yolk (reaction) 85.2/156 mg |

### P17 Crowded basket cells: too small

Test: Dessert spoons with porridge in their bowls, handles down in the six cells of the cutlery basket: one (A), two (B) and four (C) per cell.

Adapted: Six, twelve and twenty-four spoons in the six cells of the Bosch; each load is settled by the loading physics.

Stages: load: physics (contacts); water: scene (contacts), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| crowding | share of spoons not scoring 5, four per cell minus one per cell | 0.333 | 0.458 | 0.125 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 | too small |
| single (supporting) | share of spoons not scoring 5 at one per cell, as a distance from 10 to 40 % |  |  | 0 1 | about 20 % of cutlery not scoring 5 in the standard load | within 0.1 of the range | pass |
| residue (supporting) | mean share of porridge left, four per cell minus one per cell | 1.8e-5 | 7.4e-4 | 7.3e-4 1 | crowding leaves more | +0.05 or more | too small |

- **A**: one per cell. Load `spoons-1`, programme `auto_145`, 6 items (6 clean, mean score of the soiled 4.67), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:85370ab87b63`, 42.7 s.
- **B**: two per cell. Load `spoons-2`, programme `auto_145`, 12 items (10 clean, mean score of the soiled 4.42), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:eb0d219003c9`, 43.9 s.
- **C**: four per cell. Load `spoons-4`, programme `auto_145`, 24 items (20 clean, mean score of the soiled 4.38), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:e03bcec88af6`, 67.9 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.0013 | 0.758 | 72.4 | 23.4 | 1 | 1 | 0.841 | 19.7 | 0.938 | 0 |  | 5 | 0 | 0 | 0.151 | iec_oat_flakes (reaction) 3.4e-8/23.6 mg |
| B | spoon_1 (bowl) | 0.00134 | 0.984 | 61.5 | 23.9 | 1 | 1 | 0.826 | 18.5 | 0.897 | 0 |  | 5 | 0 | 0 | 0.209 | iec_oat_flakes (reaction) 2.1e-7/23.6 mg |
| C | spoon_1 (bowl) | 0.0015 | 0.944 | 54.7 | 23.8 | 1 | 1 | 0.465 | 15.1 | 0.813 | 0 |  | 5 | 0 | 0 | 0.247 | iec_oat_flakes (reaction) 3.1e-8/23.6 mg |

### P18 Cutlery tray against basket: pass

Test: Six dessert spoons with porridge in their bowls: standing in the cutlery basket (A) against lying flat, bowls up, on the knife shelf of the upper basket (B).

Adapted: The owner's machine has no cutlery drawer; the knife shelf of the upper basket is where pieces lie flat, so it stands in for the tray.

Stages: water: scene (basins of small hollows), pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| water | water standing in a spoon at the end, mean, B - A | 0 | 1.46 | 1.46 mL | spoon bowls facing up hold water | + (any size) | pass |
| drying (supporting) | drying score of the spoons lying bowl up (B) |  |  |  | drying score on face-up spoon bowls 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: standing in the basket. Load `spoons-1`, programme `auto_145`, 6 items (6 clean, mean score of the soiled 4.67), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:85370ab87b63`, 42.7 s.
- **B**: lying on the knife shelf. Load `spoons-shelf`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:3bdbcd934ec8`, 41.1 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.0013 | 0.758 | 72.4 | 23.4 | 1 | 1 | 0.841 | 19.7 | 0.938 | 0 |  | 5 | 0 | 0 | 0.151 | iec_oat_flakes (reaction) 3.4e-8/23.6 mg |
| B | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 1.7 | 34.7 | 0.858 | 0.467 | 1.53 mL, full for 5751 s | 3 | 13.3 | 1.53 | 2.5 | iec_oat_flakes (reaction) 0.259/23.6 mg |

### P19 Loading beyond rated capacity: wrong sign

Test: Six place settings well spaced (A) against the full IEC load one piece to a slot (B, nearly twice the pieces), both settled by the careful loading policy; mean IEC score of the soiled pieces.

Adapted: The machine as modelled does not take the rated 140 pieces: the careful loader fits about 100. A load "beyond what fits" cannot be built by a loader that refuses what does not hold, so the contrast run here is half load against full load (about 80 % more pieces), not rated against rated + 30 %.

Stages: load: loader; water: jets (shadowing), run-off; soil: liquor (soil load).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the soiled pieces, B - A | 2.12 | 2.19 | 0.0732 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 | wrong sign |

- **A**: half load, well spaced. Load `loader:half-careful`, programme `auto_145`, 64 items (35 clean, mean score of the soiled 2.12), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.98 (max 10.6), protease mean 0.034 g/L (peak 0.0958), peracid mean 0.0751 mmol/L (peak 0.447). Result `sha256:42a2d4b33f4c`, 50.1 s.
- **B**: full load, one piece to a slot. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.19), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:91b9e0ba6b88`, 4.8 s (exposure cached).

### P20 Total soil load: too small

Test: The IEC load in one geometry with a quarter (A), half (B) and all (C) of its pieces soiled; mean IEC score of the pieces that are soiled in all three.

Adapted: Every fourth piece of the load (by position in its list) is the quarter; every second the half.

Stages: soil: liquor (consumption of oxidant and enzyme by soil), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the always-soiled quarter, all soiled minus a quarter soiled | 2.7 | 2.7 | 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 | too small |

- **A**: a quarter of the pieces soiled. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (102 clean, mean score of the soiled 2.7), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0767 mmol/L (peak 0.449). Result `sha256:2465a716f80c`, 59.3 s.
- **B**: half of the pieces soiled. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (90 clean, mean score of the soiled 2.56), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0752 mmol/L (peak 0.447). Result `sha256:f9e37b5a4c4c`, 2.8 s (exposure cached).
- **C**: all pieces soiled. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.19), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:91b9e0ba6b88`, 4.8 s (exposure cached).

### P21 Redeposition of particulates: not covered

Test: Seven clean dinner plates (A) against the same with 20 g of minced spinach on one of them (B); specks on the plates that started clean.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: redeposition (not built). Note: needs redeposition of particles (soil carried by the liquor and settled on other surfaces).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| specks | share of the plates that started clean and carry 1 to 4 specks, B - A |  |  |  | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 | not covered: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) |

- **A**: no spinach. Load `plates-18`, programme `auto_145`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0774 mmol/L (peak 0.449). Result `sha256:58f672d6091d`, 45.5 s.
- **B**: 20 g of spinach on one plate. Load `plates-18`, programme `auto_145`, 7 items (6 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:597b555fa358`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | plate_3 | 0.00508 | 0.494 | 346 | 25 | 1 | 1 | 3.27 | 20 | 0.939 | 0 |  | 5 | 0 | 0 | 1.66 |  |

### P22 Clean neighbours of soiled items: pass

Test: Seven dinner plates in neighbouring slots, every second one with egg yolk; the clean ones are scored.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: liquor, redeposition (not built: the clean plates cannot pick anything up).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clean | points the clean plates lose (5 minus their mean IEC score) |  |  | 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 | pass |

- **A**: clean and soiled alternating. Load `plates-18`, programme `auto_145`, 7 items (3 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0771 mmol/L (peak 0.449). Result `sha256:c72742400f33`, 1 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00479 | 0.485 | 299 | 25.7 | 1 | 1 | 2.56 | 16.5 | 0.889 | 0 |  | 5 | 0 | 0 | 1.65 |  |

### P23 End-of-cycle drips from the upper rack: not covered

Test: Seven dinner plates in the lower basket with an empty upper basket (A) against three mugs mouth down in the upper basket (B).

Adapted: Three mugs stand for the loaded upper basket.

Stages: water: drain-down after the last rinse and drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale) of the lower plates, B - A |  |  |  | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film on the lower plates at the end of the last rinse, mean, B - A | 1.67 | 1.68 | 0.0147 g | drips from above add water | + (any size) | pass |

- **A**: upper basket empty. Load `plates-18`, programme `auto_145`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0774 mmol/L (peak 0.449). Result `sha256:58f672d6091d`, 45.5 s.
- **B**: upper basket loaded. Load `plates-18-upper`, programme `auto_145`, 10 items (9 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:ca20319f4047`, 47.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00479 | 0.485 | 299 | 25.7 | 1 | 1 | 2.56 | 16.5 | 0.889 | 0 |  | 5 | 0 | 0 | 1.65 |  |
| B | plate_4 | 0.00479 | 0.485 | 299 | 25.7 | 1 | 1 | 2.32 | 15.1 | 0.83 | 0 |  | 5 | 0 | 0 | 1.65 |  |

### P24 Arrangement does not matter for easy soils (negative control): pass

Test: The IEC load with half of its pieces carrying an air-dried, lightly adhering soil (jam, 15 h) and half clean, in three different soiled/clean orders.

Adapted: The three orders are three different halves of the pieces of one settled load; the soil lies where the IEC soil of each piece lies.

Stages: soil: removal laws (dissolve), hydration.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| range | largest minus smallest load mean IEC score of the three orders |  |  | 0.156 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 | pass |

- **A**: first order. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (111 clean, mean score of the soiled 4.84), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.444). Result `sha256:69ec838fe8c9`, 1.2 s (exposure cached).
- **B**: second order. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (112 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0746 mmol/L (peak 0.445). Result `sha256:947c7f70fe9b`, 1 s (exposure cached).
- **C**: third order. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (111 clean, mean score of the soiled 4.84), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0743 mmol/L (peak 0.444). Result `sha256:680aea3ecc40`, 1.1 s (exposure cached).

### P25 Detergent dispenser blocked: too large

Test: A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D).

Adapted: The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.

Stages: load: session (mechanical check); soil: liquor (dosing), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| protein | share of the egg yolk removed without detergent (B) |  |  | 0.033 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 | pass |
| tea | share of the tea film removed without detergent (D) |  |  | 0.268 1 | tea stays | |x| <= 0.2 | too large |
| score | mean IEC score of the three pieces, blocked minus free | 0 | 0 | 0 score | load mean -1.5 or more | -0.5 to -5 | too small |

- **A**: plate, dispenser free. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:baea3e6366e8`, 43.7 s.
- **B**: plate, dispenser blocked. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 120 min with detergent, mean 56.2 C (max 69 C), pH 9.63 (max 10.1), protease mean 0.0125 g/L (peak 0.0382), peracid mean 0.00609 mmol/L (peak 0.027). Result `sha256:9e0909f45ac1`, 0.3 s (exposure cached).
- **C**: tea cups, dispenser free. Load `cups-centre-corner`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:735d2521e23b`, 41.7 s.
- **D**: tea cups, dispenser blocked. Load `cups-centre-corner`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 120 min with detergent, mean 56.2 C (max 69 C), pH 9.63 (max 10.1), protease mean 0.0125 g/L (peak 0.0383), peracid mean 0.0061 mmol/L (peak 0.0271). Result `sha256:fd6559b3fe3a`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8807 | 0 | 1.02 | iec_egg_yolk (reaction) 480/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 1028/1063 mg |
| C | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 9.4 | 50.3 | 1.31 | 0 | 9.4e-4 mL, full for 0 s | 0 | 390 | 0 | 1.01 | iec_tea (bleach) 0.2/3.46 mg |
| D | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 9.4 | 50.3 | 1.31 | 0 | 9.4e-4 mL, full for 0 s | 0 | 7491 | 0 | 1.01 | iec_tea (bleach) 2.52/3.46 mg |

### P26 Tablet trapped or dissolving in a dead spot: not covered

Test: A dessert plate with egg yolk washed with the tablet released into its tray (A) against a tablet that lands in an upright bowl (B).

Adapted: The wash has no input for where the tablet lands; B is washed as A until it has one, and the scenario is reported as not covered.

Stages: soil: liquor (tablet transport and local dissolution, not built). Note: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A |  |  |  | similar to under-dosing; size unknown: calibration parameter | - (any size) | not covered: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) |

- **A**: tablet in its tray. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:baea3e6366e8`, 43.7 s.
- **B**: tablet in an upright bowl. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:baea3e6366e8`, 43.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8807 | 0 | 1.02 | iec_egg_yolk (reaction) 480/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8807 | 0 | 1.02 | iec_egg_yolk (reaction) 480/1063 mg |

### P27 Time and temperature trade: too large

Test: A dessert plate with egg yolk (well) and porridge (rim) in the lower basket on the short programme (A, Express 65, 1 h), the eco programme (B, Eco 50, 4 h 55 min) and the intensive programme (C, Intensive 70).

Adapted: The three programmes are those of the owner's machine as the machine package models them.

Stages: soil: liquor (temperature course, enzyme life), hydration, chemistry; machine: programme timeline.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate, eco minus short | 0 | 5 | 5 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 | too large |
| residue (supporting) | share of the soil left on the plate, eco minus short | 0.654 | 1.5e-7 | -0.654 1 | short programmes fail on starch and protein | -0.01 or more | pass |
| intensive (supporting) | share of the soil left on the plate, intensive minus short | 0.654 | 0.634 | -0.0204 1 | more time and temperature remove more | -0.01 or more | pass |

- **A**: Express 65. Load `plate-facing`, programme `express_65`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 43.5 min with detergent, mean 52.9 C (max 66.9 C), pH 10 (max 10.5), protease mean 0.0454 g/L (peak 0.0766), peracid mean 0.118 mmol/L (peak 0.276). Result `sha256:bb9b8da78aa4`, 21.7 s.
- **B**: Eco 50. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.109), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:b933a904b835`, 0.4 s (exposure cached).
- **C**: Intensive 70. Load `plate-facing`, programme `intensive_70`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 58.7 min with detergent, mean 58.5 C (max 70 C), pH 10.1 (max 10.6), protease mean 0.0423 g/L (peak 0.0959), peracid mean 0.13 mmol/L (peak 0.446). Result `sha256:10c7a9eb4307`, 23.1 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well, rim) | 0.0127 | 0.498 | 252 | 19.4 | 1 | 1 | 7.83 | 46.6 | 1.34 | 0 |  | 0 | 9337 | 0 | 1.02 | iec_egg_yolk (reaction) 802/1063 mg; iec_oat_flakes (reaction) 2.88/167 mg |
| B | plate (well, rim) | 0.00726 | 0.656 | 237 | 24.5 | 1 | 1 | 5.51 | 33.2 | 1.2 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 1.9e-4/1063 mg; iec_oat_flakes (reaction) 0/167 mg |
| C | plate (well, rim) | 0.00757 | 0.642 | 353 | 26.9 | 1 | 1 | 5.85 | 34.5 | 1.23 | 0 |  | 0 | 9233 | 0 | 1.02 | iec_egg_yolk (reaction) 778/1063 mg; iec_oat_flakes (reaction) 2.33/167 mg |

### P28 Bleachable stains are position-insensitive (negative control): pass

Test: Two tea cups with tea film mouth down in the upper basket, one near the axis of the upper arm and one in a corner outside the swept circle, with the standard detergent (A) and with a bleach-free one (B).

Adapted: The corner cup stands on the knife shelf at the rear left. Bleach-free: the detergent without percarbonate and TAED (`liq.xPeroxide`, `liq.xTaed` = 0).

Stages: water: droplets, run-off (wetting); soil: chemistry (bleach), supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| position | IEC score of the corner cup minus the centre cup (A) |  |  | 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 | pass |
| bleach | share of the tea film removed without bleach (B) |  |  | 2.2e-16 1 | without bleach all fail | |x| <= 0.2 | pass |
| with (supporting) | share of the tea film removed with bleach, mean of the two cups (A) |  |  | 0.933 1 | with oxidant, temperature and time the film goes | +0.5 to +1 | pass |
| f_jet (supporting) | fraction of time the inside is under a direct jet, corner over centre, minus one (A) |  |  | -0.95 1 | the corner is the worst spray position | -0.05 or more | pass |

- **A**: with bleach. Load `cups-centre-corner`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:735d2521e23b`, 41.7 s.
- **B**: bleach-free detergent. Load `cups-centre-corner`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xPeroxide":0,"liq.xTaed":0}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0356 g/L (peak 0.0967), peracid mean 0 mmol/L (peak 0). Result `sha256:032deacf9e31`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 9.4 | 50.3 | 1.31 | 0 | 9.4e-4 mL, full for 0 s | 0 | 390 | 0 | 1.01 | iec_tea (bleach) 0.2/3.46 mg |
| A | cup_2 (interior) | 0.00245 | 0.482 | 291 | 27.8 | 1 | 1 | 0.453 | 5.4 | 0.461 | 0 | 0.994 mL, full for 5749 s | 0 | 2409 | 0.994 | 3.38 | iec_tea (bleach) 0.258/3.36 mg |
| B | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 9.4 | 50.3 | 1.31 | 0 | 9.4e-4 mL, full for 0 s | 0 | 7491 | 0 | 1.01 | iec_tea (bleach) 3.46/3.46 mg |
| B | cup_2 (interior) | 0.00245 | 0.482 | 291 | 27.8 | 1 | 1 | 0.453 | 5.4 | 0.461 | 0 | 0.994 mL, full for 5749 s | 0 | 7493 | 0.994 | 3.38 | iec_tea (bleach) 3.36/3.36 mg |

### P29 Ageing of the soil before the wash: too small

Test: A dessert plate with egg yolk in the lower basket at three ageing levels: fresh (A, 15 min), oven-dried 2 h at 80 C (B), baked on at 125 C (C).

Adapted: One plate instead of a load; the baked level is the heat history `cooked` of the soil model (125 C), the nearest to 130 to 140 C.

Stages: soil: hydration (lag), bake index, removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| fresh | IEC score of the fresh plate, as a distance from 4.5 to 5 (A) |  |  | -4.5 score | crockery mean at least 4.5 fresh | within 1 of the range | too small |
| dried | IEC score of the oven-dried plate, as a distance from 2.3 to 3.7 (B) |  |  | -2.3 score | crockery 2.3 to 3.7 oven-dried | within 1 of the range | too small |
| baked | IEC score, baked minus oven-dried | 0 | 0 | 0 score | at least 1 point lower again for 130 to 140 C baking | -0 to -5 | too small |
| order (supporting) | share of the egg yolk left, baked minus fresh | 0.195 | 0.485 | 0.289 1 | ageing leaves more | +0.01 or more | pass |

- **A**: fresh. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:f360d9631fcf`, 0.3 s (exposure cached).
- **B**: oven-dried 2 h at 80 C. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:baea3e6366e8`, 43.7 s.
- **C**: baked on at 125 C. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:bd322e6f8f75`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 7485 | 0 | 1.02 | iec_egg_yolk (reaction) 208/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8807 | 0 | 1.02 | iec_egg_yolk (reaction) 480/1063 mg |
| C | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8811 | 0 | 1.02 | iec_egg_yolk (reaction) 515/1063 mg |

### P30 Protein soil responds to hit frequency and chemistry, not to jet strength: pass

Test: A dessert plate with egg yolk at a fixed position in the lower basket: pump speed of the main wash -30 % (A) and +30 % (B); protease dose -50 % (C) and +50 % (D).

Adapted: A plate stands in for the tiles. The pump speed is changed in the steps of the main wash of the Auto programme (3000 rpm to 2100 and 3900 rpm); the enzyme dose by `liq.xProtease`.

Stages: soil: removal laws (reaction, jet assist), chemistry; water: hydraulics, jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pump | share of the egg yolk removed, pump +30 % minus pump -30 % | 0.571 | 0.496 | -0.0748 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 | pass |
| enzyme | share of the egg yolk removed, protease +50 % minus protease -50 % | 0.00908 | 0.174 | 0.165 1 | doubling enzyme level changes it clearly | +0.05 to +1 | pass |

- **A**: pump -30 %. Load `plate-facing`, programme `auto_145+pump70pct`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 53.8 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0347 g/L (peak 0.0958), peracid mean 0.0784 mmol/L (peak 0.449). Result `sha256:206423726da4`, 25.6 s.
- **B**: pump +30 %. Load `plate-facing`, programme `auto_145+pump130pct`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 55.1 C (max 66.8 C), pH 9.94 (max 10.6), protease mean 0.0318 g/L (peak 0.0958), peracid mean 0.0755 mmol/L (peak 0.448). Result `sha256:15b04a805cb2`, 21.1 s.
- **C**: protease -50 %. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.005}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.00562 g/L (peak 0.016), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:de19fba99efc`, 0.2 s (exposure cached).
- **D**: protease +50 %. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.015}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0168 g/L (peak 0.0479), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:25e17ce242e0`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00472 | 0.529 | 184 | 18.4 | 1 | 1 | 3.55 | 25.1 | 1.09 | 0 |  | 0 | 8803 | 0 | 1.02 | iec_egg_yolk (reaction) 456/1063 mg |
| B | plate (well) | 0.00672 | 0.623 | 317 | 31.9 | 1 | 1 | 5.53 | 33.8 | 1.29 | 0 |  | 0 | 8811 | 0 | 1.02 | iec_egg_yolk (reaction) 535/1063 mg |
| C | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 1053/1063 mg |
| D | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 878/1063 mg |

### P31 Starch is bimodal: too small

Test: Twelve soup plates with oat porridge in the lower basket; the histogram of their IEC scores.

Adapted: Eleven in every second slot of the rear lane and one in the left front lane, settled by the loading physics.

Stages: soil: hydration, removal laws (starch), inspection.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clusters | share of the plates scoring 5 or 0 to 1 |  |  | 0.75 1 | porridge-plate scores cluster at 5 and at 0 to 1 | +0.6 to +1 | pass |
| both | share of the plates in the smaller of the two clusters |  |  | 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more | too small |

- **A**: twelve porridge plates. Load `soup-12`, programme `auto_145`, 12 items (11 clean, mean score of the soiled 4.67), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.077 mmol/L (peak 0.449). Result `sha256:2395c1d0678a`, 46.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_6 (well) | 0.00188 | 0.242 | 184 | 23.7 | 1 | 1 | 1.77 | 14.8 | 0.836 | 0 |  | 5 | 0 | 0 | 1.67 | iec_oat_flakes (reaction) 2.5e-7/232 mg |

### P32 Microwaved milk on glass is persistent: too large

Test: Four test glasses with microwaved milk in the upper basket with detergent D on the Auto programme (A), on the long eco programme (B), and with a detergent of twice the enzyme and half the silicate (C).

Adapted: The registry defaults are IEC detergent D. The ingredient table of detergent E is not in the dossiers ("upgraded enzymes, less silicate"), so C is an assumed composition and decides nothing; the eco programme, which the entry names beside E, is the deciding comparison.

Stages: soil: chemistry (alkalinity, enzyme), removal laws; water: jets into the glass.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the glasses with detergent D, as a distance from 2.3 to 2.4 (A) |  |  | -2.3 score | glass class 2.3 to 2.4 with detergent D on the reference machines | within 1 of the range | too small |
| eco | mean IEC score of the glasses, eco minus Auto | 0 | 5 | 5 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 | too large |
| e_like (supporting) | mean share of the milk left, E-like minus D | 0.0213 | 0.287 | 0.266 1 | upgraded enzymes remove more | -0.01 or more | wrong sign |

- **A**: detergent D, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0772 mmol/L (peak 0.449). Result `sha256:822ed72ad7ce`, 0.6 s (exposure cached).
- **B**: detergent D, Eco 50. Load `glasses-milk`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0949 mmol/L (peak 0.446). Result `sha256:37cae982d8ef`, 39.7 s.
- **C**: assumed E-like detergent, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.02,"liq.xAmylase":0.01,"liq.xSilicate":0.275}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10 (max 10.7), protease mean 0.0217 g/L (peak 0.0639), peracid mean 0.0766 mmol/L (peak 0.444). Result `sha256:3f6fa3dda1dd`, 0.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (interior) | 0.0122 | 0.456 | 421 | 26.4 | 1 | 1 | 5.47 | 36.9 | 1.09 | 0 |  | 0 | 813 | 0 | 1.23 | ikw_milk_microwaved (reaction) 7.97/527 mg |
| B | glass_1 (interior) | 0.0123 | 0.456 | 421 | 26.8 | 1 | 1 | 5.53 | 37.1 | 1.1 | 0 |  | 5 | 0 | 0 | 1.23 | ikw_milk_microwaved (reaction) 0/527 mg |
| C | glass_1 (interior) | 0.0122 | 0.456 | 421 | 26.4 | 1 | 1 | 5.47 | 36.9 | 1.09 | 0 |  | 0 | 9168 | 0 | 1.23 | ikw_milk_microwaved (reaction) 147/527 mg |

### P33 Fat needs temperature and enough water: too small

Test: A porcelain and a melamine dessert plate with fresh margarine in the lower basket, with the main wash of the Auto programme heated to 35 (A), 45 (B) and 55 C (C).

Adapted: The target of the main wash is changed in the steps of the Auto programme; everything else of the programme stays.

Stages: soil: removal laws (melt, roll-up by substrate), liquor (temperature course).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| warm | IEC score of the porcelain plate at 55 C, as a distance from 4 to 5 (C) |  |  | 0 score | margarine platter cleans easily at 50 C | within 1 of the range | pass |
| temperature | share of the margarine left on the two plates, 35 C minus 55 C | 7.9e-12 | 8.4e-8 | 8.4e-8 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more | too small |
| plastic (supporting) | share of the margarine left at 45 C, melamine minus porcelain (B) |  |  | 2.9e-9 1 | greasy residue most visibly on plastic | +0.01 or more | too small |

- **A**: main wash at 35 C. Load `dplate-lower`, programme `auto_145+wash35C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 100 min with detergent, mean 40.4 C (max 66.8 C), pH 10.1 (max 10.7), protease mean 0.0483 g/L (peak 0.133), peracid mean 0.179 mmol/L (peak 0.449). Result `sha256:7be64a7db953`, 0.2 s (exposure cached).
- **B**: main wash at 45 C. Load `dplate-lower`, programme `auto_145+wash45C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 105 min with detergent, mean 45 C (max 66.8 C), pH 10.1 (max 10.6), protease mean 0.0496 g/L (peak 0.131), peracid mean 0.145 mmol/L (peak 0.447). Result `sha256:1af72397ac5e`, 0.2 s (exposure cached).
- **C**: main wash at 55 C. Load `dplate-lower`, programme `auto_145+wash55C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 109 min with detergent, mean 49.6 C (max 66.8 C), pH 10 (max 10.6), protease mean 0.0478 g/L (peak 0.116), peracid mean 0.106 mmol/L (peak 0.447). Result `sha256:1b6aa95e4fa9`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0112 | 0.765 | 236 | 23.9 | 1 | 1 | 5.83 | 36.1 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 3.8e-14/1743 mg |
| A | melamine (well) | 0.0018 | 0.228 | 52.1 | 21 | 1 | 1 | 2.81 | 58.3 | 1.75 | 0 |  | 5 | 0 | 0 | 0.709 | iec_margarine (melt) 2.8e-4/1647 mg |
| B | plate (well) | 0.0112 | 0.765 | 236 | 23.9 | 1 | 1 | 5.83 | 36.1 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 1.2e-17/1743 mg |
| B | melamine (well) | 0.00179 | 0.228 | 52.1 | 21.1 | 1 | 1 | 2.81 | 58.3 | 1.75 | 0 |  | 5 | 0 | 0 | 0.709 | iec_margarine (melt) 4.8e-6/1647 mg |
| C | plate (well) | 0.0112 | 0.765 | 236 | 24 | 1 | 1 | 5.84 | 36.1 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 3.6e-22/1743 mg |
| C | melamine (well) | 0.00179 | 0.228 | 52.1 | 21.1 | 1 | 1 | 2.82 | 58.3 | 1.75 | 0 |  | 5 | 0 | 0 | 0.709 | iec_margarine (melt) 2.6e-8/1647 mg |

### P34 Thick layers detach as flakes: not covered

Test: A dessert plate with egg yolk at 5 (A) and 10 mg/cm2 dry (B).

Adapted: One plate; 5 and 10 mg/cm2 dry on 60 % of the well are 0.93 g and 1.85 g of yolk as applied.

Stages: soil: removal laws (cohesive failure and flakes, not built). Note: needs detachment of thick layers as flakes.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| flakes | soil that left as flakes, thick minus thin |  |  |  | thick egg yolk partly tended to flake off | + (any size) | not covered: needs detachment of thick layers as flakes |
| residue (supporting) | share of the egg yolk left, thick minus thin | 0.0173 | 0.407 | 0.39 1 | the thicker layer takes longer | +0.01 or more | pass |

- **A**: 5 mg/cm2 dry. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:c38df64a20b5`, 0.3 s (exposure cached).
- **B**: 10 mg/cm2 dry. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:ca29030ce2f5`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 1172 | 0 | 1.02 | iec_egg_yolk (reaction) 8.48/492 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8792 | 0 | 1.02 | iec_egg_yolk (reaction) 400/983 mg |

### P35 Pot interiors: wrong sign

Test: A 17 cm steel saucepan with burnt-on milk on its inner bottom and wall in the lower basket: mouth down on the rear rows (A) against lying on its side (B).

Adapted: Both poses are dropped and settled by the loading physics; the pan on its side rolls about 10 cm before it rests.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | IEC score of the pot mouth down, as a distance from 2.5 to 4.0 (A) |  |  | -0.5 score | pots class 2.5 with detergent D to 4.0 with E | within 1 of the range | pass |
| side | share of the soil left in the pot, on its side minus mouth down | 1.2e-4 | 1.1e-10 | -1.2e-4 1 | on its side, half the wall is shadowed | +0.01 or more | wrong sign |
| ranking (supporting) | share left on the inner wall minus on the inner bottom, mouth down (A) |  |  | -2.4e-4 1 | inverted, the bottom is hit directly (the ranking is a calibration target) | +0.01 or more | wrong sign |

- **A**: mouth down. Load `pot-inverted`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:377552aa8c93`, 42.2 s.
- **B**: on its side. Load `pot-on-side`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:87a0a4054729`, 43.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot (interior_base) | 0.039 | 0.976 | 219 | 31.9 | 0.806 | 1 | 4.76 | 11.8 | 0.344 | 0 |  | 2 | 11.3 | 0 | 12.5 | milk_burnt (reaction) 0.0674/277 mg; milk_burnt (reaction) 1.7e-4/279 mg |
| A | pot (interior_wall) | 0.00472 | 0.408 | 380 | 29.4 | 0.973 | 1 | 34.3 | 59.5 | 1.5 | 0 |  | 2 | 11.3 | 0 | 12.5 | milk_burnt (reaction) 0.0674/277 mg; milk_burnt (reaction) 1.7e-4/279 mg |
| B | pot (interior_base) | 0 | 0 | 0 | 0 | 1 | 1 | 11.8 | 49 | 1.23 | 0.943 | 1003 mL, full for 5690 s | 5 | 0 | 1003 | 9.47 | milk_burnt (reaction) 6.3e-8/277 mg; milk_burnt (reaction) 0/279 mg |
| B | pot (interior_wall) | 0 | 0 | 0 | 0 | 1 | 1 | 2.16 | 34.5 | 1.21 | 0.435 | 1003 mL, full for 5690 s | 5 | 0 | 1003 | 9.47 | milk_burnt (reaction) 6.3e-8/277 mg; milk_burnt (reaction) 0/279 mg |

### P36 Water pools in the base recess of inverted cups and mugs: pass

Test: A ceramic mug mouth down on a level support: the rear cup shelf of the upper basket folded down.

Adapted: The cup shelf of the Bosch is the level support; the mug is dropped onto it and settles. The expected volume is the checklist's formula for the recess of the catalogue's mug (28 mm radius, 2.5 mm deep).

Stages: water: scene (basins), run-off, pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pool | water standing in the base recess at the end |  |  | 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 | pass |
| drying (supporting) | drying score of the mug |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:f8fc080f2176`, 41.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.3e-4 | 0.223 | 33.9 | 18 | 1 | 1 | 0.56 | 5.7 | 0.357 | 0.479 | 5 mL, full for 5750 s | 5 | 0 | 5 | 3.29 |  |

### P37 Tilt drains the recess: too small

Test: The mug of P36 at 0 (A), 7 (B), 15 (C) and 30 degrees (D) of tilt.

Adapted: The tilts are set, not settled: the mug is turned about a horizontal axis and kept standing on the height of its lowest point; the runner checks that it cuts into nothing. The checklist's volumes are for a recess of 25 mm radius and 3 mm depth; the expected values here are its formulas evaluated for the recess of the catalogue's mug (28 mm, 2.5 mm), as shares of the level volume.

Stages: water: scene (basins, minimum basin volume), pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| tilt7 | water in the recess at 7 degrees over level | 5 | 0.418 | 0.0836 1 | the wedge formula: 1.4 of 5.9 mL at 7 degrees for the checklist's recess; 0.92 of 6.2 mL for this mug's | +0.0744 to +0.298 | pass |
| tilt15 | water in the recess at 15 degrees over level | 5 | 0.111 | 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 | too small |
| tilt30 (supporting) | water in the recess at 30 degrees over level | 5 | 0 | 0 1 | the wedge formula: 0.13 of 5.9 mL at 30 degrees for the checklist's recess; 0.09 of 6.2 mL for this mug's | +0.0073 to +0.0292 | too small |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:f8fc080f2176`, 41.7 s.
- **B**: tilted 7 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:4ae1637db375`, 41.6 s.
  - set pose: deepest overlap 0.01 mm (mug into upper_rack_fittings)
- **C**: tilted 15 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:087faf746de9`, 41.7 s.
- **D**: tilted 30 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:5d2e6cac122a`, 44.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.3e-4 | 0.223 | 33.9 | 18 | 1 | 1 | 0.56 | 5.7 | 0.357 | 0.479 | 5 mL, full for 5750 s | 5 | 0 | 5 | 3.29 |  |
| B | mug (foot) | 3.7e-4 | 0.149 | 21.2 | 14.5 | 1 | 1 | 0.389 | 4.58 | 0.354 | 0.106 | 0.418 mL, full for 5754 s | 5 | 0 | 0.418 | 2.28 |  |
| C | mug (foot) | 3.8e-4 | 0.106 | 27.5 | 16.3 | 1 | 1 | 0.304 | 4.14 | 0.363 | 0.0638 | 0.111 mL, full for 5755 s | 5 | 0 | 0.111 | 1.72 |  |
| D | mug (foot) | 4.9e-4 | 0.149 | 31.4 | 18.5 | 1 | 1 | 1.68 | 11.1 | 0.581 | 0 | 0.0257 mL, full for 0 s | 5 | 0 | 0 | 1.3 |  |

### P38 Plastic stays wet: not covered

Test: A melamine and a porcelain dessert plate of the same shape side by side in the lower basket.

Adapted: None.

Stages: drying (not built); water: run-off (beads on plastic) gives the film it would start from. Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), melamine minus porcelain |  |  |  | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film per area at the end of the last rinse, melamine over porcelain, minus one |  |  | -0.321 1 | water beads on plastic and stays | +0.05 or more | wrong sign |

- **A**: side by side. Load `dplate-lower`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:01b5dee49c27`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate | 0.0113 | 0.723 | 429 | 25.7 | 1 | 1 | 7.25 | 32.1 | 1.12 | 0 |  | 5 | 0 | 0 | 1.01 |  |
| A | melamine | 0.0159 | 0.627 | 357 | 26.1 | 1 | 1 | 9.63 | 62.2 | 1.65 | 0 |  | 5 | 0 | 0 | 0.709 |  |

### P39 Pots and large hollow ware stay wet: not covered

Test: A saucepan mouth down in the lower basket (A) against a dessert plate on edge (B).

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), pot minus plate |  |  |  | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water the pot keeps at the end (pools and film) against the plate | 12.5 | 1.01 | 11.5 g | rims that hold water, large wetted area | + (any size) | pass |

- **A**: saucepan. Load `pot-inverted`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0774 mmol/L (peak 0.449). Result `sha256:27a8350c6cd5`, 0.2 s (exposure cached).
- **B**: plate. Load `dplate-lower`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:01b5dee49c27`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot | 0.00979 | 0.441 | 383 | 31.9 | 0.961 | 1 | 17.9 | 56.5 | 1.36 | 0 |  | 5 | 0 | 0 | 12.5 |  |
| B | plate | 0.0113 | 0.723 | 429 | 25.7 | 1 | 1 | 7.25 | 32.1 | 1.12 | 0 |  | 5 | 0 | 0 | 1.01 |  |

### P40 Liquid held at contact points and in narrow gaps: pass

Test: Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B).

Adapted: Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.

Stages: water: scene (contacts), run-off (bridges, retained water).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| held | water left on the two glasses at the end of the last rinse (film and pools), B - A | 2.29 | 2.51 | 0.215 g | a wet mark at every touching pair | + (any size) | pass |
| marks (supporting) | residue marks at the contact (B) |  |  |  | a residue line at every touching pair | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: apart. Load `glasses-apart`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:8273f435c576`, 68.4 s.
- **B**: touching. Load `glasses-touching`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:79089e5c5f58`, 71.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (exterior) | 0.00481 | 0.484 | 393 | 23.6 | 1 | 1 | 2.27 | 18.1 | 0.907 | 0 |  | 5 | 0 | 0 | 1.05 |  |
| A | glass_2 (exterior) | 0.00361 | 0.556 | 229 | 23.3 | 1 | 1 | 3.47 | 24.1 | 1.07 | 0 |  | 5 | 0 | 0 | 1.24 |  |
| B | glass_1 (exterior) | 0.00363 | 0.424 | 295 | 23 | 1 | 1 | 1.79 | 15.1 | 0.849 | 0 |  | 5 | 0 | 0 | 1.29 |  |
| B | glass_2 (exterior) | 0.00418 | 0.539 | 251 | 23.8 | 1 | 1 | 3.04 | 22.2 | 1.01 | 0 |  | 5 | 0 | 0 | 1.22 |  |

### P41 Light plastic items are moved or flipped by jets: not covered

Test: A 20 g polypropylene container lid lying hollow side down in the lower basket (A) against the upper basket (B).

Adapted: The lightest lid of the catalogue weighs 20 g, not 15 g. In the lower basket it comes to rest on the cutlery basket and the left front tines.

Stages: rigid-body coupling during the wash (not built); water: jets (the lift ratio is reported). Note: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| moved | distance the jets move the lid in the lower basket |  |  |  | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) | not covered: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) |
| lift (supporting) | peak upward jet force on the lid over its weight, lower basket (A) |  |  | 3.95 1 | 0.08 to 0.30 N per jet against the weight of a 20 g lid | +0.2 to +3 | too large |
| upper (supporting) | that ratio, upper basket minus lower basket | 3.95 | 2.58 | -1.37 1 | the advice is to put light plastics in the top rack | -0.01 or more | pass |

- **A**: lower basket. Load `lid-lower`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:e3b34dc8a0e2`, 40.4 s.
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 3.95 of its weight); it is simulated where it was placed
- **B**: upper basket. Load `lid-upper`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:d39c3f607fff`, 43.8 s.
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 2.58 of its weight); it is simulated where it was placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | lid | 0.0191 | 0.392 | 218 | 31.9 | 1 | 1 | 16 | 40.5 | 0.909 | 0 |  | 5 | 0 | 0 | 8.69 |  |
| B | lid | 0.0352 | 0.422 | 289 | 27.8 | 1 | 1 | 20.2 | 90.3 | 1.96 | 0.035 | 6.05 mL, full for 5749 s | 5 | 0 | 6.1 | 2.14 |  |

### P42 Cutlery dries almost completely (negative control): not covered

Test: The cutlery of the IEC load.

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | points of the 0 to 1 drying scale the cutlery loses |  |  |  | drying 0.99 | |x| <= 0.04 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water standing in a piece of cutlery at the end, mean |  |  | 0 mL | it drains along its length | |x| <= 0.1 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.19), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:91b9e0ba6b88`, 4.8 s (exposure cached).

### P43 Spots, film and tine marks on glass: not covered

Test: A test glass in the upper basket with rinse aid (A) and without (B).

Adapted: The wash has no input for water hardness or for running without rinse aid; B is washed as A until it has, and the scenario is reported as not covered.

Stages: drying and spotting (not built). Note: needs spots and film from evaporated water, and marks at contacts.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spots | spots on the glass, without rinse aid minus with |  |  |  | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: with rinse aid. Load `glass-free`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:997b2abf6935`, 64 s.
- **B**: without rinse aid. Load `glass-free`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:997b2abf6935`, 64 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass | 0.00413 | 0.488 | 327 | 25.1 | 1 | 1 | 3.38 | 17.1 | 0.846 | 0 |  | 5 | 0 | 0 | 1.28 |  |
| B | glass | 0.00413 | 0.488 | 327 | 25.1 | 1 | 1 | 3.38 | 17.1 | 0.846 | 0 |  | 5 | 0 | 0 | 1.28 |  |

### P44 Cutlery comes out clean although it is the most shadowed class: too small

Test: The IEC load of 13 place settings, loaded carefully, on the Auto programme; class mean of the soiled cutlery.

Adapted: The pieces of the load that the careful loading policy fits into the machine as modelled (about 100 of 140).

Stages: water: droplets, run-off in the cutlery basket; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the soiled cutlery, as a distance from 4.6 to 4.8 |  |  | -1.49 score | class mean 4.6 to 4.8 | within 1 of the range | too small |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.19), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:91b9e0ba6b88`, 4.8 s (exposure cached).

### P45 Class ranking in the standard test: too small

Test: The IEC load on the Auto programme: mean scores of cutlery, melamine, glass and crockery, and overall.

Adapted: The pieces that fit (about 100 of 140); the load has no pots (the loader left them out), so that class is not scored.

Stages: the whole wash.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| overall | load mean IEC score, as a distance from 3.5 to 4.2 |  |  | -1.31 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range | too small |
| crockery | crockery mean, as a distance from 2.3 to 3.7 |  |  | -0.565 score | crockery 2.3 to 3.7 | within 1 of the range | pass |
| glass | glass mean, as a distance from 2.3 to 4.0 |  |  | -2.3 score | glass 2.3 to 4.0 | within 1 of the range | too small |
| ranking | cutlery mean minus crockery mean |  |  | 1.37 score | cutlery > melamine > (pots, glass, crockery) | + (any size) | pass |
| melamine (supporting) | melamine mean minus crockery mean |  |  | 0.931 score | melamine above crockery | + (any size) | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.19), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:91b9e0ba6b88`, 4.8 s (exposure cached).

### P46 Run-to-run repeatability: too small

Test: The IEC load washed with three seeds (level seed and simulation seed 1, 2 and 3); standard deviation of the load mean score.

Adapted: Three seeds. The seeds move the phase origin of the arms, the sampling of the droplets, and where on a region each soil lies and how thick; the tablet release time and the sensor decisions of the machine are fixed.

Stages: the whole wash (seeded sampling).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spread | standard deviation of the load mean IEC score over the three seeds |  |  | 0.0283 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 | too small |

- **A**: seeds 1. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.19), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:91b9e0ba6b88`, 4.8 s (exposure cached).
- **B**: seeds 2. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.13), seeds 2/2. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:e5a8f5151307`, 57.3 s.
- **C**: seeds 3. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (65 clean, mean score of the soiled 2.15), seeds 3/3. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:0aa4a5d6708d`, 55.9 s.

### P47 Everything is wetted within seconds; jets are rare events: pass

Test: The IEC load on the Auto programme: the share of the surface of the load that is wetted, and the fraction of time under a direct jet.

Adapted: The time-resolved first wetting is not recorded by the exposure (it stores the periodic state); what is checked is the wetted share in the periodic state and the water returning to the sump within a revolution.

Stages: water: jets, droplets, run-off.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | largest fraction of time under a direct jet of any item of the load (mean over its surface) |  |  | 0.0207 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 | pass |
| wetted | share of the surface of the load that no spray state wets |  |  | 3.4e-5 1 | everything is wetted | |x| <= 0.2 | pass |
| circuit (supporting) | share of the nozzle outflow not back in the sump within one revolution of the arm (largest of the spray states) |  |  | 5.9e-4 1 | water circuit under 3 s (a revolution takes 1.4 to 2.2 s) | |x| <= 0.5 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 116 items (63 clean, mean score of the soiled 2.19), seeds 1/1. Liquor of the main wash: 114 min with detergent, mean 54.3 C (max 66.8 C), pH 9.99 (max 10.6), protease mean 0.0341 g/L (peak 0.0958), peracid mean 0.0742 mmol/L (peak 0.447). Result `sha256:91b9e0ba6b88`, 4.8 s (exposure cached).

### P48 Detergent does not change where water goes: pass

Test: A dessert plate in the lower basket washed with detergent (A) and with the dispenser blocked, so without any (B); the exposure of the two washes.

Adapted: The exposure of the simulation is computed for one liquor class and does not read the detergent at all, so this holds by construction: the check guards that it stays so.

Stages: water: jets (the exposure key excludes the liquor).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| jets | spray states whose exposure differs between the two washes |  |  | 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 | pass |

- **A**: with detergent. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:baea3e6366e8`, 43.7 s.
- **B**: without detergent. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 120 min with detergent, mean 56.2 C (max 69 C), pH 9.63 (max 10.1), protease mean 0.0125 g/L (peak 0.0382), peracid mean 0.00609 mmol/L (peak 0.027). Result `sha256:9e0909f45ac1`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8807 | 0 | 1.02 | iec_egg_yolk (reaction) 480/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 4.54 | 29.7 | 1.2 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 1028/1063 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

