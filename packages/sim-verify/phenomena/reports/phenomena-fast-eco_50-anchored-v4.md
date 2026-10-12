# Phenomena suite: fast tier, packages/calibration/anchors/anchored-v4.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.4.1 water-5`; parameters packages/calibration/anchors/anchored-v4.json (hydro `sha256:ecdf6e077c2e`, soil `sha256:a7190b8e74ee`, 7 overrides). Programme of every wash whose case names none: `eco_50` (not the owner's). Detergent: the machine's own dose of the reference detergent. Source `beaf25c1244cad08`. Exposure traced on: gpu. 48 phenomena, 82 washes (82 with cached exposure), 119 s.

Verdicts: 14 pass, 1 wrong sign, 16 too small, 8 too large, 9 not covered.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | retained: 1.09 -> 259: 258 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.2e-4 -> 1.6e-4: 0.382 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P03 | Plate pitch too small | too small | halving: 5 -> 5: 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |
| P04 | Nesting or "spooning" of like items | too large | score: 5 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 |
| P05 | Large flat item shadows what is behind or above it | too small | score: 5 -> 5: 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P06 | Spray arm stalled by an item | too small | score: 5 -> 5: 0 score | mean score of that rack -1.5 or more | -0.5 to -5 |
| P07 | Radial position: centre against corner | too small | score: 5 -> 5: 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 |
| P08 | Left/right asymmetry with rotation direction | pass | score: 5 -> 5: 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 |
| P09 | Lean direction of plates | too small | score: 5 -> 5: 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 |
| P10 | Tall narrow vessel interior | too small | residue: 0 -> 0: 0 1 | the interior of the tall vessel is the last place to clean | +0.01 or more |
| P11 | Upper against lower rack for tenacious soil | pass | score: 5 -> 5: 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 |
| P12 | Alternating large and small plates | too small | score: 5 -> 5: 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 |
| P13 | Glass or cup placed over tines | too small | f_jet: 0.0121 -> 0.0116: -0.0425 1 | interior f_jet reduced | -0.05 or more |
| P14 | Soiled face against the tub wall or door liner | too small | score: 5 -> 5: 0 score | as P02: -1 to -2 | -0 to -4 |
| P15 | Nested spoons | too large | shielded: 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P16 | Heads up against heads down (not nested) | too large | score: 3.33 -> 5: 1.67 score | negative control: absolute change at most 0.3 | |x| <= 0.6 |
| P17 | Crowded basket cells | too small | crowding: 0 -> 0.0833: 0.0833 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 |
| P18 | Cutlery tray against basket | pass | water: 0 -> 1.46: 1.46 mL | spoon bowls facing up hold water | + (any size) |
| P19 | Loading beyond rated capacity | wrong sign | mean: 3.78 -> 3.81: 0.0268 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 |
| P20 | Total soil load | too small | mean: 3.83 -> 3.83: 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 |
| P21 | Redeposition of particulates | not covered | specks: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 |
| P22 | Clean neighbours of soiled items | pass | clean: 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 |
| P23 | End-of-cycle drips from the upper rack | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 |
| P24 | Arrangement does not matter for easy soils (negative control) | pass | range: 0.156 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 |
| P25 | Detergent dispenser blocked | too large | tea: 0.233 1 | tea stays | |x| <= 0.2 |
| P26 | Tablet trapped or dissolving in a dead spot | not covered | score: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) | similar to under-dosing; size unknown: calibration parameter | - (any size) |
| P27 | Time and temperature trade | too large | score: 0 -> 5: 5 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 |
| P28 | Bleachable stains are position-insensitive (negative control) | pass | position: 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 |
| P29 | Ageing of the soil before the wash | too large | dried: 1.3 score | crockery 2.3 to 3.7 oven-dried | within 1 of the range |
| P30 | Protein soil responds to hit frequency and chemistry, not to jet strength | pass | pump: 1 -> 1: -3.9e-8 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 |
| P31 | Starch is bimodal | too small | both: 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more |
| P32 | Microwaved milk on glass is persistent | too large | class: 2.6 score | glass class 2.3 to 2.4 with detergent D on the reference machines | within 1 of the range |
| P33 | Fat needs temperature and enough water | too small | temperature: 6.6e-21 -> 1.3e-12: 1.3e-12 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more |
| P34 | Thick layers detach as flakes | not covered | flakes: needs detachment of thick layers as flakes | thick egg yolk partly tended to flake off | + (any size) |
| P35 | Pot interiors | too small | side: 0 -> 0: 0 1 | on its side, half the wall is shadowed | +0.01 or more |
| P36 | Water pools in the base recess of inverted cups and mugs | pass | pool: 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 |
| P37 | Tilt drains the recess | too small | tilt15: 5 -> 0.111: 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 |
| P38 | Plastic stays wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 |
| P39 | Pots and large hollow ware stay wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 |
| P40 | Liquid held at contact points and in narrow gaps | pass | held: 2.29 -> 2.51: 0.215 g | a wet mark at every touching pair | + (any size) |
| P41 | Light plastic items are moved or flipped by jets | not covered | moved: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) |
| P42 | Cutlery dries almost completely (negative control) | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | drying 0.99 | |x| <= 0.04 |
| P43 | Spots, film and tine marks on glass | not covered | spots: needs spots and film from evaporated water, and marks at contacts | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) |
| P44 | Cutlery comes out clean although it is the most shadowed class | pass | class: -0.758 score | class mean 4.6 to 4.8 | within 1 of the range |
| P45 | Class ranking in the standard test | pass | overall: 0 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range |
| P46 | Run-to-run repeatability | too small | spread: 0.0142 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 |
| P47 | Everything is wetted within seconds; jets are rare events | pass | f_jet: 0.0208 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 |
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

- **A**: mouth down. Load `hollow-inverted`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0827), peracid mean 0.0696 mmol/L (peak 0.323). Result `sha256:ecc2457dc5c5`, 1.6 s (exposure cached).
- **B**: mouth up. Load `hollow-upright`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0827), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:e2c097245642`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00937 | 0.719 | 386 | 27.3 | 1 | 1 | 3 | 22.1 | 0.831 | 0 | 1.09 mL, full for 11747 s | 0 | 9817 | 1.09 | 2.89 | iec_tea (bleach) 0.569/5.77 mg |
| A | bowl (interior) | 0.106 | 0.963 | 250 | 26.4 | 1 | 1 | 13.8 | 59.4 | 1.41 | 0 |  | 5 | 0 | 0 | 1.84 | iec_oat_flakes (reaction) 0/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 0.642 | 5.87 | 0.507 | 0.897 | 259 mL, full for 11403 s | 0 | 11971 | 259 | 1.42 | iec_tea (bleach) 0.874/5.77 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 5.66 | 21.2 | 0.805 | 0.427 | 108 mL, full for 11735 s | 5 | 0 | 108 | 2.54 | iec_oat_flakes (reaction) 0/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate (C) faces the axis tipped 10 degrees up, and a reversed plate (D) falls back against the tines and lies 34 degrees from the vertical with its face to the wall and down. C and D are reported as supporting evidence.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.2e-4 | 1.6e-4 | 0.382 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 5 | 5 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 6.1e-10 | 1.3e-9 | 7.0e-10 1 | removal depends on how often the spot is hit | +0.01 or more | too small |
| settled (supporting) | fraction of time the soiled face is under a direct jet, settled reversed plate (D) over the seated one (C) | 0.00607 | 0.0352 | 5.8 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| settled_residue (supporting) | share of the egg yolk left on the face, D - C | 2.8e-10 | 9.1e-6 | 9.1e-6 1 | removal depends on how often the spot is hit | +0.01 or more | too small |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0823), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:4d25d91b8c97`, 1.5 s (exposure cached).
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0823), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:649b543b20c3`, 1.5 s (exposure cached).
- **C**: seated in its slot, face to the arm axis (settled). Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:695f57159829`, 0.3 s (exposure cached).
- **D**: put in reversed and settled. Load `plate-away`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:fc4a8f7142fb`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.2e-4 | 0.337 | 264 | 32.7 | 1 | 1 | 4.49 | 31.3 | 1.07 | 0 |  | 5 | 0 | 0 | 0.88 | iec_egg_yolk (reaction) 6.4e-7/1063 mg |
| B | plate (well) | 1.6e-4 | 0.135 | 37.3 | 19.1 | 1 | 1 | 0.698 | 8.49 | 0.703 | 0 |  | 5 | 0 | 0 | 0.877 | iec_egg_yolk (reaction) 1.4e-6/1063 mg |
| C | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.0e-7/1063 mg |
| D | plate (well) | 0.0352 | 0.968 | 283 | 27.6 | 1 | 1 | 7.72 | 38.3 | 1.04 | 0 |  | 4 | 0.982 | 0 | 1.52 | iec_egg_yolk (reaction) 0.00964/1063 mg |

### P03 Plate pitch too small: too small

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot (about 7 mm between the pair, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become two plates to a slot, every slot and every second slot. Seven plates per row (eight when crowded). All rows are settled by the loading physics; the crowded row has pairs in slots 2, 4, 6 and 8, so the covered plate of a pair has its face about 7 mm behind its partner while the partner faces an open slot.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 5 | 5 | 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | too small |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 5 | 5 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.00315 | 0 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.084), peracid mean 0.0667 mmol/L (peak 0.323). Result `sha256:5b8f35ec06b3`, 1 s (exposure cached).
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `eco_50`, 8 items (8 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.0845), peracid mean 0.0663 mmol/L (peak 0.323). Result `sha256:c924a69c24bb`, 2.6 s (exposure cached).
  - load: plate_6 rests but the stability probe flags it
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.084), peracid mean 0.0667 mmol/L (peak 0.323). Result `sha256:b9322f0a3a96`, 2.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00315 | 0.467 | 67.4 | 17.9 | 1 | 1 | 1.21 | 12.5 | 0.814 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 0/1527 mg |
| B | plate_6 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.5 | 6.7 | 0.64 | 0 |  | 5 | 0 | 0 | 2.1 | iec_egg_yolk (reaction) 8.5e-7/1605 mg |
| C | plate_4 (well) | 0.00679 | 0.472 | 194 | 20.1 | 1 | 1 | 2.29 | 18.8 | 0.966 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 0/1527 mg |

### P04 Nesting or "spooning" of like items: too large

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 3.1e-13 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 5 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | too large |
| against (supporting) | share of the porridge left inside that bowl, B - A | 0 | 3.1e-13 | 3.1e-13 1 | nesting leaves more | +0.01 or more | too small |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0713 | 3.8e-5 | 5.4e-4 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0827), peracid mean 0.0696 mmol/L (peak 0.323). Result `sha256:9ec1db777e20`, 1.6 s (exposure cached).
- **B**: nested. Load `bowls-nested`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0828), peracid mean 0.0696 mmol/L (peak 0.323). Result `sha256:1753ddee2d2e`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0713 | 0.921 | 315 | 27.1 | 1 | 1 | 10.5 | 48.9 | 1.24 | 0 |  | 5 | 0 | 0 | 1.97 | iec_oat_flakes (reaction) 0/177 mg |
| B | bowl_over (interior) | 3.8e-5 | 0.0423 | 19 | 11.5 | 1 | 1 | 0.375 | 4.45 | 0.469 | 0 |  | 5 | 0 | 0 | 2.29 | iec_oat_flakes (reaction) 5.4e-11/177 mg |

### P05 Large flat item shadows what is behind or above it: too small

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 5 | 5 | 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | too small |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 0.00183 | 1.3e-4 | -0.927 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `eco_50`, 3 items (3 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0828), peracid mean 0.0692 mmol/L (peak 0.323). Result `sha256:596df63e98b4`, 1.5 s (exposure cached).
- **B**: platter between the plates and the arm axis. Load `board-middle`, programme `eco_50`, 3 items (3 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0827), peracid mean 0.0692 mmol/L (peak 0.323). Result `sha256:db339f8cf028`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 5.0e-4 | 0.154 | 107 | 20.9 | 1 | 1 | 1.05 | 11.1 | 0.782 | 0 |  | 5 | 0 | 0 | 1.09 | iec_egg_yolk (reaction) 8.9e-8/985 mg |
| A | plate_2 (well) | 0.00317 | 0.372 | 214 | 23.8 | 1 | 1 | 2.64 | 22.9 | 0.956 | 0 |  | 5 | 0 | 0 | 1.06 | iec_egg_yolk (reaction) 3.6e-7/969 mg |
| B | plate_1 (well) | 1.8e-4 | 0.106 | 234 | 31.1 | 1 | 1 | 1.97 | 16.7 | 0.944 | 0 |  | 5 | 0 | 0 | 1.03 | iec_egg_yolk (reaction) 1.7e-8/985 mg |
| B | plate_2 (well) | 8.5e-5 | 0.0672 | 324 | 32 | 1 | 1 | 2.63 | 19.7 | 1.01 | 0 |  | 5 | 0 | 0 | 1.03 | iec_egg_yolk (reaction) 7.7e-7/969 mg |

### P06 Spray arm stalled by an item: too small

Test: Seven IEC dinner plates with egg yolk in every second slot of the rear lane (A); the same with a ladle let down through the floor of the lower basket until it hangs in the path of the lower arm (B).

Adapted: A ladle stands in for the fork: a fork slips through the floor grid of this basket and falls, a ladle hangs by its bowl. The session's mechanical check finds the arm stopped and the angle; the wash takes both from it.

Stages: load: session (mechanical check); water: hydraulics (stalled arm), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| coverage | share of the plates' faces ever under a direct jet, B over A | 0.42 | 0 | 0 1 | direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %) | |x| <= 0.2 | pass |
| score | mean IEC score of the plates of that rack, B - A | 5 | 5 | 0 score | mean score of that rack -1.5 or more | -0.5 to -5 | too small |

- **A**: arm free. Load `plates-36`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.084), peracid mean 0.0667 mmol/L (peak 0.323). Result `sha256:b9322f0a3a96`, 1 s (exposure cached).
- **B**: lower arm stopped by the hanging ladle. Load `plates-36-stalled`, programme `eco_50`, 8 items (8 clean, mean score of the soiled 5), seeds 1/1, lower arm stopped. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.0839), peracid mean 0.0667 mmol/L (peak 0.323). Result `sha256:8870e2da8387`, 2.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00679 | 0.472 | 194 | 20.1 | 1 | 1 | 2.29 | 18.8 | 0.966 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 0/1527 mg |
| B | plate_4 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 1.15 | 12.1 | 0.853 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 0/1527 mg |

### P07 Radial position: centre against corner: too small

Test: Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle).

Adapted: The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.

Stages: water: hydraulics (nozzle positions), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate at the corner against the one at mid-radius | 5 | 5 | 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 | too small |
| dwell (supporting) | fraction of time the face is under a direct jet, corner over mid-radius, minus one | 0.0137 | 0.0098 | -0.282 1 | low radial locations are impacted for longer | -0.05 or more | pass |

- **A**: four soup plates. Load `soup-radial`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.0832), peracid mean 0.068 mmol/L (peak 0.323). Result `sha256:82404b7e6930`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_1 (well) | 0.00241 | 0.454 | 204 | 21.5 | 1 | 1 | 4.7 | 27.4 | 0.93 | 0 |  | 5 | 0 | 0 | 1.49 | iec_egg_yolk (reaction) 7.1e-5/1478 mg |
| A | soup_2 (well) | 0.0137 | 0.671 | 251 | 21.7 | 1 | 1 | 5.62 | 31.7 | 1.09 | 0 |  | 5 | 0 | 0 | 1.47 | iec_egg_yolk (reaction) 9.3e-8/1574 mg |
| A | soup_3 (well) | 0.0098 | 0.652 | 307 | 29.8 | 1 | 1 | 4.72 | 27.2 | 0.967 | 0 |  | 5 | 0 | 0 | 1.89 | iec_egg_yolk (reaction) 1.4e-7/1552 mg |

### P08 Left/right asymmetry with rotation direction: pass

Test: Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis.

Adapted: The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.

Stages: water: hydraulics (nozzle directions, sense of rotation), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the right-hand plate minus the left-hand one | 5 | 5 | 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 | pass |
| jets (supporting) | fraction of time the face is under a direct jet, right over left, minus one | 0.0098 | 0.0326 | 2.32 1 | in one real arm a right-hand plate received five jets and its mirror image two | |x| <= 3 | pass |

- **A**: mirrored plates. Load `soup-radial`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.0832), peracid mean 0.068 mmol/L (peak 0.323). Result `sha256:82404b7e6930`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_3 (well) | 0.0098 | 0.652 | 307 | 29.8 | 1 | 1 | 4.72 | 27.2 | 0.967 | 0 |  | 5 | 0 | 0 | 1.89 | iec_egg_yolk (reaction) 1.4e-7/1552 mg |
| A | soup_4 (well) | 0.0326 | 0.927 | 363 | 26 | 1 | 1 | 7.3 | 36.2 | 1.09 | 0 |  | 5 | 0 | 0 | 1.9 | iec_egg_yolk (reaction) 2.4e-10/1509 mg |

### P09 Lean direction of plates: too small

Test: A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up).

Adapted: The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.

Stages: water: jets (incidence), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 5 | 5 | 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 | too small |
| f_jet (supporting) | fraction of time the soiled face is under a direct jet, B over A, minus one | 0.00961 | 1.8e-4 | -0.981 1 | leaning away presents the back | -0.05 or more | pass |

- **A**: leaning toward the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0823), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:178185854011`, 1.4 s (exposure cached).
- **B**: leaning away from the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0823), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:4742ccd6f414`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00961 | 0.866 | 363 | 30.5 | 1 | 1 | 12 | 59.3 | 1.31 | 0 |  | 5 | 0 | 0 | 0.982 | iec_egg_yolk (reaction) 7.3e-7/1063 mg |
| B | plate (well) | 1.8e-4 | 0.141 | 42.7 | 20.9 | 1 | 1 | 2 | 16.5 | 0.945 | 0 |  | 5 | 0 | 0 | 0.948 | iec_egg_yolk (reaction) 2.9e-7/1063 mg |

### P10 Tall narrow vessel interior: too small

Test: A 250 mL test glass (B) against a shallow dessert bowl (A), each with microwaved milk inside, mouth down at the same spot of the upper basket.

Adapted: Upper basket; both settle on the wires leaning on the same tine row.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws, chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| glass | IEC score of the glass, as a distance from the range 2.3 to 4.0 (B) |  |  | 1 score | standard glass class (baked milk) scores 2.3 to 4.0 | within 1 of the range | pass |
| residue | share of the milk left, glass minus bowl | 0 | 0 | 0 1 | the interior of the tall vessel is the last place to clean | +0.01 or more | too small |
| f_jet (supporting) | fraction of time the inside is under a direct jet, glass over bowl, minus one | 0.0776 | 0.0123 | -0.842 1 | a 60 mm opening is under a nozzle for about 6 % of a revolution | -0.05 or more | pass |

- **A**: shallow bowl. Load `bowl-same-spot`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:598b6e006603`, 1.4 s (exposure cached).
- **B**: tall glass. Load `glass-between`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:48bdd0e25160`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl (interior) | 0.0776 | 0.72 | 267 | 28 | 1 | 1 | 9.27 | 49.1 | 1.28 | 0 |  | 5 | 0 | 0 | 1.1 | iec_milk (reaction) 0/503 mg |
| B | glass (interior) | 0.0123 | 0.459 | 485 | 26.8 | 1 | 1 | 5.49 | 36.9 | 1.1 | 0 |  | 5 | 0 | 0 | 1.23 | iec_milk (reaction) 0/528 mg |

### P11 Upper against lower rack for tenacious soil: pass

Test: The same dessert plate with egg yolk standing in the rear lane of the lower basket (A) and in the rows of the upper basket (B).

Adapted: The dessert plate is the largest plate the upper basket takes. In the upper rows it does not stand as in the lower ones: the loading physics leaves it leaning about 50 degrees against the tines, which is the pose washed.

Stages: water: hydraulics (flow per level), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 5 | 5 | 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 | pass |
| residue (supporting) | share of the egg yolk left, B - A | 2.0e-10 | 3.8e-10 | 1.8e-10 1 | little difference between the baskets | |x| <= 0.4 | pass |

- **A**: lower basket. Load `dplate-lower`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0825), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:54724635a0a5`, 0.3 s (exposure cached).
- **B**: upper basket. Load `dplate-upper`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:efca02f6f4a9`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0111 | 0.765 | 236 | 24.4 | 1 | 1 | 5.88 | 36.3 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_egg_yolk (reaction) 2.2e-7/1063 mg |
| B | plate (well) | 5.6e-5 | 0.0832 | 35.8 | 19.4 | 1 | 1 | 1.27 | 12.9 | 0.837 | 0 |  | 5 | 0 | 0 | 1.06 | iec_egg_yolk (reaction) 4.0e-7/1063 mg |

### P12 Alternating large and small plates: too small

Test: Dinner plates with egg yolk in neighbouring slots of the rear lane (A) against dinner and dessert plates alternating at the same 18.25 mm pitch (B); the dinner plate at slot 5 is scored on its upper half.

Adapted: Pitch 18.25 mm (the tines of the Bosch) instead of 15 mm.

Stages: water: jets (gap geometry); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the upper half of the large plate at slot 5, B - A | 5 | 5 | 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 | too small |
| residue (supporting) | share of the egg yolk left on the upper half of that plate, B - A | 0 | 0 | 0 1 | the wider gap above the small plates lets more through | -0.01 or more | too small |

- **A**: large plates only. Load `plates-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.084), peracid mean 0.0667 mmol/L (peak 0.323). Result `sha256:5b8f35ec06b3`, 1 s (exposure cached).
- **B**: large and small alternating. Load `plates-alt-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.0837), peracid mean 0.0672 mmol/L (peak 0.323). Result `sha256:00d086ccab07`, 2.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_3 (well) | 0.00245 | 0.48 | 204 | 19.5 | 1 | 1 | 1.73 | 15.7 | 0.921 | 0 |  | 5 | 0 | 0 | 1.66 | iec_egg_yolk (reaction) 0/1383 mg |
| B | plate_2 (well) | 0.00302 | 0.457 | 173 | 19.3 | 1 | 1 | 1.39 | 13.8 | 0.855 | 0 |  | 5 | 0 | 0 | 1.66 | iec_egg_yolk (reaction) 0/1453 mg |

### P13 Glass or cup placed over tines: too small

Test: A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A).

Adapted: Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.

Stages: water: jets (tine in the path), droplets (fans off the tine), scene (contacts).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the inside is under a direct jet, B over A, minus one | 0.0121 | 0.0116 | -0.0425 1 | interior f_jet reduced | -0.05 or more | too small |
| marks (supporting) | contact marks on the glass over the tine (B) |  |  |  | AHAM adds 1 to 3 grade points per marked glass | +0.5 to +6 | not covered: needs spots and film from evaporated water, and marks at contacts |
| drying (supporting) | change of the drying score, B - A |  |  |  | drying score -1 | -0.5 to -2 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: row folded down: no tine in the glass. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0826), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:a1713d402756`, 2 s (exposure cached).
- **B**: over a tine. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0826), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:15590b1f9e1b`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass (interior) | 0.0121 | 0.656 | 243 | 29.9 | 1 | 1 | 4.31 | 32.6 | 1.01 | 0 |  | 5 | 0 | 0 | 2.76 | iec_milk (reaction) 0/528 mg |
| B | glass (interior) | 0.0116 | 0.656 | 243 | 29.8 | 1 | 1 | 4.15 | 31.5 | 1.01 | 0 |  | 5 | 0 | 0 | 2.77 | iec_milk (reaction) 0/528 mg |

### P14 Soiled face against the tub wall or door liner: too small

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the platter is seated by the loading physics both ways round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00668 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 5 | 5 | 0 score | as P02: -1 to -2 | -0 to -4 | too small |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 37.6 | 4.75 | -0.874 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 0 | 0 | 0 1 | the face to the wall keeps more | +0.01 or more | too small |

- **A**: face inward. Load `platter-inward`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:6c528f167672`, 1.4 s (exposure cached).
- **B**: face to the wall. Load `platter-to-wall`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:7ad2b0f71ab8`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00668 | 0.476 | 359 | 30.7 | 1 | 1 | 6.4 | 37.6 | 1.31 | 0 |  | 5 | 0 | 0 | 1.07 | iec_egg_yolk (reaction) 0/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.306 | 4.75 | 0.52 | 0 |  | 5 | 0 | 0 | 1.09 | iec_egg_yolk (reaction) 0/1026 mg |

### P15 Nested spoons: too large

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | too large |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0 | 0 | 0 1 | when spoons spoon, they trap food | +0.01 or more | too small |

- **A**: opposed. Load `spoons-opposed`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0822), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:781a5c4beadc`, 1.4 s (exposure cached).
- **B**: nested. Load `spoons-nested`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0823), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:8ceed6f87625`, 1.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.921 | 31.8 | 1.17 | 0 |  | 5 | 0 | 0 | 0.16 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.00555 | 0.758 | 275 | 37.5 | 1 | 1 | 1.54 | 26.1 | 0.894 | 0 |  | 5 | 0 | 0 | 0.186 | iec_oat_flakes (reaction) 0/24.3 mg |
| B | spoon_1 (bowl) | 0.00435 | 0.93 | 240 | 25.2 | 1 | 1 | 1.38 | 34.6 | 1.17 | 0 |  | 5 | 0 | 0 | 0.424 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_2 (bowl) | 6.4e-5 | 0.0545 | 117 | 43.6 | 0.997 | 1 | 0.162 | 8.54 | 0.841 | 0 |  | 5 | 0 | 0 | 0.404 | iec_oat_flakes (reaction) 0/24.3 mg |

### P16 Heads up against heads down (not nested): too large

Test: Six dinner forks with egg yolk on the tines, one per cell of the cutlery basket: handles down (A) against handles up (B).

Adapted: Six forks, one per cell: the cutlery basket of the Bosch has six cells, not twelve.

Stages: water: jets (basket walls), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the forks, B - A | 3.33 | 5 | 1.67 score | negative control: absolute change at most 0.3 | |x| <= 0.6 | too large |
| residue (supporting) | mean share of the egg yolk left on the forks, B - A | 0.00844 | 3.9e-7 | -0.00844 1 | an informal test found no difference | |x| <= 0.2 | pass |

- **A**: heads up. Load `forks-heads-up`, programme `eco_50`, 6 items (3 clean, mean score of the soiled 3.33), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:c8705e80e6b2`, 1.4 s (exposure cached).
- **B**: heads down. Load `forks-heads-down`, programme `eco_50`, 6 items (6 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:b254b7b6e06e`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | fork_1 (tines) | 3.7e-5 | 0.0217 | 38.9 | 18.9 | 1 | 1 | 0.447 | 25.4 | 1.14 | 0 |  | 2 | 37.1 | 0 | 0.147 | iec_egg_yolk (reaction) 2.76/156 mg |
| B | fork_1 (tines) | 0.00202 | 0.56 | 420 | 60.7 | 1 | 1 | 14 | 64.7 | 1.96 | 0 |  | 5 | 0 | 0 | 0.182 | iec_egg_yolk (reaction) 1.4e-6/156 mg |

### P17 Crowded basket cells: too small

Test: Dessert spoons with porridge in their bowls, handles down in the six cells of the cutlery basket: one (A), two (B) and four (C) per cell.

Adapted: Six, twelve and twenty-four spoons in the six cells of the Bosch; each load is settled by the loading physics.

Stages: load: physics (contacts); water: scene (contacts), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| crowding | share of spoons not scoring 5, four per cell minus one per cell | 0 | 0.0833 | 0.0833 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 | too small |
| single (supporting) | share of spoons not scoring 5 at one per cell, as a distance from 10 to 40 % |  |  | -0.1 1 | about 20 % of cutlery not scoring 5 in the standard load | within 0.1 of the range | pass |
| residue (supporting) | mean share of porridge left, four per cell minus one per cell | 2.1e-12 | 2.5e-4 | 2.5e-4 1 | crowding leaves more | +0.05 or more | too small |

- **A**: one per cell. Load `spoons-1`, programme `eco_50`, 6 items (6 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0823), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:ceacbecb1d0f`, 1.4 s (exposure cached).
- **B**: two per cell. Load `spoons-2`, programme `eco_50`, 12 items (11 clean, mean score of the soiled 4.83), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0825), peracid mean 0.0696 mmol/L (peak 0.323). Result `sha256:8bad96fbeeaf`, 3 s (exposure cached).
- **C**: four per cell. Load `spoons-4`, programme `eco_50`, 24 items (23 clean, mean score of the soiled 4.88), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0829), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:fc2886e224f9`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.00131 | 0.758 | 72.4 | 23.7 | 1 | 1 | 0.847 | 19.8 | 0.94 | 0 |  | 5 | 0 | 0 | 0.151 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_1 (bowl) | 0.00136 | 0.984 | 61.5 | 24.2 | 1 | 1 | 0.832 | 18.6 | 0.899 | 0 |  | 5 | 0 | 0 | 0.209 | iec_oat_flakes (reaction) 0/23.6 mg |
| C | spoon_1 (bowl) | 0.00151 | 0.944 | 54.7 | 24.3 | 1 | 1 | 0.47 | 15.2 | 0.816 | 0 |  | 5 | 0 | 0 | 0.247 | iec_oat_flakes (reaction) 0/23.6 mg |

### P18 Cutlery tray against basket: pass

Test: Six dessert spoons with porridge in their bowls: standing in the cutlery basket (A) against lying flat, bowls up, on the knife shelf of the upper basket (B).

Adapted: The owner's machine has no cutlery drawer; the knife shelf of the upper basket is where pieces lie flat, so it stands in for the tray.

Stages: water: scene (basins of small hollows), pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| water | water standing in a spoon at the end, mean, B - A | 0 | 1.46 | 1.46 mL | spoon bowls facing up hold water | + (any size) | pass |
| drying (supporting) | drying score of the spoons lying bowl up (B) |  |  |  | drying score on face-up spoon bowls 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: standing in the basket. Load `spoons-1`, programme `eco_50`, 6 items (6 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0823), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:ceacbecb1d0f`, 1.4 s (exposure cached).
- **B**: lying on the knife shelf. Load `spoons-shelf`, programme `eco_50`, 6 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0841), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:66b75849baf6`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.00131 | 0.758 | 72.4 | 23.7 | 1 | 1 | 0.847 | 19.8 | 0.94 | 0 |  | 5 | 0 | 0 | 0.151 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 1.73 | 35 | 0.863 | 0.467 | 1.53 mL, full for 11746 s | 3 | 13.3 | 1.53 | 2.5 | iec_oat_flakes (reaction) 0.251/23.6 mg |

### P19 Loading beyond rated capacity: wrong sign

Test: Six place settings well spaced (A) against the full IEC load one piece to a slot (B, nearly twice the pieces), both settled by the careful loading policy; mean IEC score of the soiled pieces.

Adapted: The machine as modelled does not take the rated 140 pieces: the careful loader fits about 100. A load "beyond what fits" cannot be built by a loader that refuses what does not hold, so the contrast run here is half load against full load (about 80 % more pieces), not rated against rated + 30 %.

Stages: load: loader; water: jets (shadowing), run-off; soil: liquor (soil load).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the soiled pieces, B - A | 3.78 | 3.81 | 0.0268 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 | wrong sign |

- **A**: half load, well spaced. Load `loader:half-careful`, programme `eco_50`, 64 items (50 clean, mean score of the soiled 3.78), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0576 g/L (peak 0.0908), peracid mean 0.0628 mmol/L (peak 0.321). Result `sha256:071f7f499037`, 4.8 s (exposure cached).
- **B**: full load, one piece to a slot. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (86 clean, mean score of the soiled 3.81), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:5b49d323eeb6`, 3.8 s (exposure cached).

### P20 Total soil load: too small

Test: The IEC load in one geometry with a quarter (A), half (B) and all (C) of its pieces soiled; mean IEC score of the pieces that are soiled in all three.

Adapted: Every fourth piece of the load (by position in its list) is the quarter; every second the half.

Stages: soil: liquor (consumption of oxidant and enzyme by soil), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the always-soiled quarter, all soiled minus a quarter soiled | 3.83 | 3.83 | 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 | too small |

- **A**: a quarter of the pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (106 clean, mean score of the soiled 3.83), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0575 g/L (peak 0.0935), peracid mean 0.0674 mmol/L (peak 0.322). Result `sha256:1e02526044c9`, 1.5 s (exposure cached).
- **B**: half of the pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (100 clean, mean score of the soiled 3.84), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0576 g/L (peak 0.0939), peracid mean 0.0633 mmol/L (peak 0.321). Result `sha256:19dfa9203980`, 2.4 s (exposure cached).
- **C**: all pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (86 clean, mean score of the soiled 3.81), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:5b49d323eeb6`, 3.8 s (exposure cached).

### P21 Redeposition of particulates: not covered

Test: Seven clean dinner plates (A) against the same with 20 g of minced spinach on one of them (B); specks on the plates that started clean.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: redeposition (not built). Note: needs redeposition of particles (soil carried by the liquor and settled on other surfaces).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| specks | share of the plates that started clean and carry 1 to 4 specks, B - A |  |  |  | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 | not covered: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) |

- **A**: no spinach. Load `plates-18`, programme `eco_50`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0837), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:380fda16738e`, 0.3 s (exposure cached).
- **B**: 20 g of spinach on one plate. Load `plates-18`, programme `eco_50`, 7 items (6 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0837), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:2996f4ae4579`, 2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | plate_3 | 0.00512 | 0.494 | 346 | 25.3 | 1 | 1 | 3.3 | 20.1 | 0.943 | 0 |  | 5 | 0 | 0 | 1.66 |  |

### P22 Clean neighbours of soiled items: pass

Test: Seven dinner plates in neighbouring slots, every second one with egg yolk; the clean ones are scored.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: liquor, redeposition (not built: the clean plates cannot pick anything up).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clean | points the clean plates lose (5 minus their mean IEC score) |  |  | 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 | pass |

- **A**: clean and soiled alternating. Load `plates-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.0839), peracid mean 0.0679 mmol/L (peak 0.323). Result `sha256:aa30e768f960`, 0.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00484 | 0.485 | 299 | 26 | 1 | 1 | 2.59 | 16.7 | 0.894 | 0 |  | 5 | 0 | 0 | 1.65 |  |

### P23 End-of-cycle drips from the upper rack: not covered

Test: Seven dinner plates in the lower basket with an empty upper basket (A) against three mugs mouth down in the upper basket (B).

Adapted: Three mugs stand for the loaded upper basket.

Stages: water: drain-down after the last rinse and drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale) of the lower plates, B - A |  |  |  | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film on the lower plates at the end of the last rinse, mean, B - A | 1.67 | 1.68 | 0.0147 g | drips from above add water | + (any size) | pass |

- **A**: upper basket empty. Load `plates-18`, programme `eco_50`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0837), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:380fda16738e`, 0.3 s (exposure cached).
- **B**: upper basket loaded. Load `plates-18-upper`, programme `eco_50`, 10 items (9 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0846), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:66620bf794ae`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00484 | 0.485 | 299 | 26 | 1 | 1 | 2.59 | 16.7 | 0.894 | 0 |  | 5 | 0 | 0 | 1.65 |  |
| B | plate_4 | 0.00484 | 0.485 | 299 | 26 | 1 | 1 | 2.35 | 15.2 | 0.834 | 0 |  | 5 | 0 | 0 | 1.65 |  |

### P24 Arrangement does not matter for easy soils (negative control): pass

Test: The IEC load with half of its pieces carrying an air-dried, lightly adhering soil (jam, 15 h) and half clean, in three different soiled/clean orders.

Adapted: The three orders are three different halves of the pieces of one settled load; the soil lies where the IEC soil of each piece lies.

Stages: soil: removal laws (dissolve), hydration.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| range | largest minus smallest load mean IEC score of the three orders |  |  | 0.156 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 | pass |

- **A**: first order. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (111 clean, mean score of the soiled 4.84), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0578 g/L (peak 0.0944), peracid mean 0.0579 mmol/L (peak 0.315). Result `sha256:47ccd612a725`, 1.1 s (exposure cached).
- **B**: second order. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (112 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0578 g/L (peak 0.0943), peracid mean 0.059 mmol/L (peak 0.316). Result `sha256:188184e639c1`, 1.1 s (exposure cached).
- **C**: third order. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (111 clean, mean score of the soiled 4.84), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0578 g/L (peak 0.0944), peracid mean 0.058 mmol/L (peak 0.315). Result `sha256:88924fb329f1`, 1.1 s (exposure cached).

### P25 Detergent dispenser blocked: too large

Test: A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D).

Adapted: The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.

Stages: load: session (mechanical check); soil: liquor (dosing), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| protein | share of the egg yolk removed without detergent (B) |  |  | 0.132 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 | pass |
| tea | share of the tea film removed without detergent (D) |  |  | 0.233 1 | tea stays | |x| <= 0.2 | too large |
| score | mean IEC score of the three pieces, blocked minus free | 1.67 | 0 | -1.67 score | load mean -1.5 or more | -0.5 to -5 | pass |

- **A**: plate, dispenser free. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:695f57159829`, 0.3 s (exposure cached).
- **B**: plate, dispenser blocked. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 254 min with detergent, mean 45.7 C (max 61 C), pH 10.1 (max 10.9), protease mean 0.0121 g/L (peak 0.0454), peracid mean 0.0058 mmol/L (peak 0.0269). Result `sha256:3936d80889c8`, 0.4 s (exposure cached).
- **C**: tea cups, dispenser free. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0828), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:680b2014e4c8`, 0.4 s (exposure cached).
- **D**: tea cups, dispenser blocked. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 254 min with detergent, mean 45.7 C (max 61 C), pH 10.1 (max 10.9), protease mean 0.0122 g/L (peak 0.0457), peracid mean 0.0058 mmol/L (peak 0.0271). Result `sha256:1d70076f5d84`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.0e-7/1063 mg |
| B | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 922/1063 mg |
| C | cup_1 (interior) | 0.0495 | 0.551 | 278 | 29.4 | 1 | 1 | 9.5 | 50.6 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 0 | 5351 | 0 | 1.01 | iec_tea (bleach) 0.329/3.46 mg |
| D | cup_1 (interior) | 0.0495 | 0.551 | 278 | 29.4 | 1 | 1 | 9.5 | 50.6 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 0 | 7491 | 0 | 1.01 | iec_tea (bleach) 2.62/3.46 mg |

### P26 Tablet trapped or dissolving in a dead spot: not covered

Test: A dessert plate with egg yolk washed with the tablet released into its tray (A) against a tablet that lands in an upright bowl (B).

Adapted: The wash has no input for where the tablet lands; B is washed as A until it has one, and the scenario is reported as not covered.

Stages: soil: liquor (tablet transport and local dissolution, not built). Note: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A |  |  |  | similar to under-dosing; size unknown: calibration parameter | - (any size) | not covered: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) |

- **A**: tablet in its tray. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:695f57159829`, 0.3 s (exposure cached).
- **B**: tablet in an upright bowl. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:695f57159829`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.0e-7/1063 mg |
| B | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.0e-7/1063 mg |

### P27 Time and temperature trade: too large

Test: A dessert plate with egg yolk (well) and porridge (rim) in the lower basket on the short programme (A, Express 65, 1 h), the eco programme (B, Eco 50, 4 h 55 min) and the intensive programme (C, Intensive 70).

Adapted: The three programmes are those of the owner's machine as the machine package models them.

Stages: soil: liquor (temperature course, enzyme life), hydration, chemistry; machine: programme timeline.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate, eco minus short | 0 | 5 | 5 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 | too large |
| residue (supporting) | share of the soil left on the plate, eco minus short | 0.661 | 2.4e-10 | -0.661 1 | short programmes fail on starch and protein | -0.01 or more | pass |
| intensive (supporting) | share of the soil left on the plate, intensive minus short | 0.661 | 0.657 | -0.00472 1 | more time and temperature remove more | -0.01 or more | too small |

- **A**: Express 65. Load `plate-facing`, programme `express_65`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 43.4 min with detergent, mean 52.9 C (max 66.9 C), pH 10.3 (max 10.8), protease mean 0.0348 g/L (peak 0.0576), peracid mean 0.0856 mmol/L (peak 0.202). Result `sha256:c0f500c84536`, 0.2 s (exposure cached).
- **B**: Eco 50. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:d7b390692911`, 0.3 s (exposure cached).
- **C**: Intensive 70. Load `plate-facing`, programme `intensive_70`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 58.5 min with detergent, mean 58.6 C (max 70 C), pH 10.4 (max 10.9), protease mean 0.0287 g/L (peak 0.0788), peracid mean 0.0934 mmol/L (peak 0.323). Result `sha256:24b36f610e64`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well, rim) | 0.0127 | 0.498 | 252 | 19.4 | 1 | 1 | 7.83 | 46.6 | 1.34 | 0 |  | 0 | 12361 | 0 | 1.02 | iec_egg_yolk (reaction) 790/1063 mg; iec_oat_flakes (reaction) 23.2/167 mg |
| B | plate (well, rim) | 0.00726 | 0.656 | 237 | 24.5 | 1 | 1 | 5.51 | 33.2 | 1.2 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.0e-7/1063 mg; iec_oat_flakes (reaction) 0/167 mg |
| C | plate (well, rim) | 0.00757 | 0.642 | 353 | 26.9 | 1 | 1 | 5.85 | 34.5 | 1.23 | 0 |  | 0 | 11206 | 0 | 1.02 | iec_egg_yolk (reaction) 793/1063 mg; iec_oat_flakes (reaction) 14.9/167 mg |

### P28 Bleachable stains are position-insensitive (negative control): pass

Test: Two tea cups with tea film mouth down in the upper basket, one near the axis of the upper arm and one in a corner outside the swept circle, with the standard detergent (A) and with a bleach-free one (B).

Adapted: The corner cup stands on the knife shelf at the rear left. Bleach-free: the detergent without percarbonate and TAED (`liq.xPeroxide`, `liq.xTaed` = 0).

Stages: water: droplets, run-off (wetting); soil: chemistry (bleach), supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| position | IEC score of the corner cup minus the centre cup (A) |  |  | 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 | pass |
| bleach | share of the tea film removed without bleach (B) |  |  | 2.2e-16 1 | without bleach all fail | |x| <= 0.2 | pass |
| with (supporting) | share of the tea film removed with bleach, mean of the two cups (A) |  |  | 0.892 1 | with oxidant, temperature and time the film goes | +0.5 to +1 | pass |
| f_jet (supporting) | fraction of time the inside is under a direct jet, corner over centre, minus one (A) |  |  | -0.95 1 | the corner is the worst spray position | -0.05 or more | pass |

- **A**: with bleach. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0828), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:680b2014e4c8`, 0.4 s (exposure cached).
- **B**: bleach-free detergent. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xPeroxide":0,"liq.xTaed":0}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0644 g/L (peak 0.102), peracid mean 0 mmol/L (peak 0). Result `sha256:f3c09e979d1d`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | cup_1 (interior) | 0.0495 | 0.551 | 278 | 29.4 | 1 | 1 | 9.5 | 50.6 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 0 | 5351 | 0 | 1.01 | iec_tea (bleach) 0.329/3.46 mg |
| A | cup_2 (interior) | 0.00249 | 0.482 | 291 | 28.1 | 1 | 1 | 0.46 | 5.46 | 0.464 | 0 | 0.994 mL, full for 11743 s | 0 | 6690 | 0.994 | 3.38 | iec_tea (bleach) 0.404/3.36 mg |
| B | cup_1 (interior) | 0.0495 | 0.551 | 278 | 29.4 | 1 | 1 | 9.5 | 50.6 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 0 | 7491 | 0 | 1.01 | iec_tea (bleach) 3.46/3.46 mg |
| B | cup_2 (interior) | 0.00249 | 0.482 | 291 | 28.1 | 1 | 1 | 0.46 | 5.46 | 0.464 | 0 | 0.994 mL, full for 11743 s | 0 | 7493 | 0.994 | 3.38 | iec_tea (bleach) 3.36/3.36 mg |

### P29 Ageing of the soil before the wash: too large

Test: A dessert plate with egg yolk in the lower basket at three ageing levels: fresh (A, 15 min), oven-dried 2 h at 80 C (B), baked on at 125 C (C).

Adapted: One plate instead of a load; the baked level is the heat history `cooked` of the soil model (125 C), the nearest to 130 to 140 C.

Stages: soil: hydration (lag), bake index, removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| fresh | IEC score of the fresh plate, as a distance from 4.5 to 5 (A) |  |  | 0 score | crockery mean at least 4.5 fresh | within 1 of the range | pass |
| dried | IEC score of the oven-dried plate, as a distance from 2.3 to 3.7 (B) |  |  | 1.3 score | crockery 2.3 to 3.7 oven-dried | within 1 of the range | too large |
| baked | IEC score, baked minus oven-dried | 5 | 5 | 0 score | at least 1 point lower again for 130 to 140 C baking | -0 to -5 | too small |
| order (supporting) | share of the egg yolk left, baked minus fresh | 0 | 3.0e-9 | 3.0e-9 1 | ageing leaves more | +0.01 or more | too small |

- **A**: fresh. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0693 mmol/L (peak 0.323). Result `sha256:6263fa1666ce`, 0.3 s (exposure cached).
- **B**: oven-dried 2 h at 80 C. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:695f57159829`, 0.3 s (exposure cached).
- **C**: baked on at 125 C. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:d123237839d0`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 0/1063 mg |
| B | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.0e-7/1063 mg |
| C | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.2e-6/1063 mg |

### P30 Protein soil responds to hit frequency and chemistry, not to jet strength: pass

Test: A dessert plate with egg yolk at a fixed position in the lower basket: pump speed of the main wash -30 % (A) and +30 % (B); protease dose -50 % (C) and +50 % (D).

Adapted: A plate stands in for the tiles. The pump speed is changed in the steps of the main wash of the Auto programme (3000 rpm to 2100 and 3900 rpm); the enzyme dose by `liq.xProtease`.

Stages: soil: removal laws (reaction, jet assist), chemistry; water: hydraulics, jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pump | share of the egg yolk removed, pump +30 % minus pump -30 % | 1 | 1 | -3.9e-8 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 | pass |
| enzyme | share of the egg yolk removed, protease +50 % minus protease -50 % | 0.231 | 1 | 0.769 1 | doubling enzyme level changes it clearly | +0.05 to +1 | pass |

- **A**: pump -30 %. Load `plate-facing`, programme `eco_50+pump70pct`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 43.8 C (max 50 C), pH 10.8 (max 11.4), protease mean 0.0591 g/L (peak 0.0897), peracid mean 0.0735 mmol/L (peak 0.323). Result `sha256:09a3020d4626`, 0.3 s (exposure cached).
- **B**: pump +30 %. Load `plate-facing`, programme `eco_50+pump130pct`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 50.1 C (max 53.6 C), pH 10.7 (max 11.3), protease mean 0.0516 g/L (peak 0.0788), peracid mean 0.0632 mmol/L (peak 0.322). Result `sha256:a38f2f2385bc`, 0.3 s (exposure cached).
- **C**: protease -50 %. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.005}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0179 g/L (peak 0.0257), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:a9b9a60a1bb0`, 0.4 s (exposure cached).
- **D**: protease +50 %. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1, parameters {"liq.xProtease":0.015}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0537 g/L (peak 0.0772), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:635e4ffc9916`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00442 | 0.529 | 184 | 17.2 | 1 | 1 | 3.36 | 24.1 | 1.07 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 1.9e-7/1063 mg |
| B | plate (well) | 0.00678 | 0.623 | 317 | 33.8 | 1 | 1 | 5.75 | 34.7 | 1.31 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 4.2e-5/1063 mg |
| C | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 817/1063 mg |
| D | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 6.6e-6/1063 mg |

### P31 Starch is bimodal: too small

Test: Twelve soup plates with oat porridge in the lower basket; the histogram of their IEC scores.

Adapted: Eleven in every second slot of the rear lane and one in the left front lane, settled by the loading physics.

Stages: soil: hydration, removal laws (starch), inspection.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clusters | share of the plates scoring 5 or 0 to 1 |  |  | 0.917 1 | porridge-plate scores cluster at 5 and at 0 to 1 | +0.6 to +1 | pass |
| both | share of the plates in the smaller of the two clusters |  |  | 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more | too small |

- **A**: twelve porridge plates. Load `soup-12`, programme `eco_50`, 12 items (12 clean, mean score of the soiled 4.92), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0574 g/L (peak 0.0849), peracid mean 0.0686 mmol/L (peak 0.323). Result `sha256:7d466aee4f89`, 2.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_6 (well) | 0.00191 | 0.242 | 184 | 24 | 1 | 1 | 1.8 | 15 | 0.841 | 0 |  | 5 | 0 | 0 | 1.67 | iec_oat_flakes (reaction) 0/232 mg |

### P32 Microwaved milk on glass is persistent: too large

Test: Four test glasses with microwaved milk in the upper basket with detergent D on the Auto programme (A), on the long eco programme (B), and with a detergent of twice the enzyme and half the silicate (C).

Adapted: The registry defaults are IEC detergent D. The ingredient table of detergent E is not in the dossiers ("upgraded enzymes, less silicate"), so C is an assumed composition and decides nothing; the eco programme, which the entry names beside E, is the deciding comparison.

Stages: soil: chemistry (alkalinity, enzyme), removal laws; water: jets into the glass.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the glasses with detergent D, as a distance from 2.3 to 2.4 (A) |  |  | 2.6 score | glass class 2.3 to 2.4 with detergent D on the reference machines | within 1 of the range | too large |
| eco | mean IEC score of the glasses, eco minus Auto | 5 | 5 | 0 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 | too small |
| e_like (supporting) | mean share of the milk left, E-like minus D | 0 | 0 | 0 1 | upgraded enzymes remove more | -0.01 or more | too small |

- **A**: detergent D, Auto. Load `glasses-milk`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0829), peracid mean 0.0689 mmol/L (peak 0.323). Result `sha256:a98b8671c7d5`, 0.4 s (exposure cached).
- **B**: detergent D, Eco 50. Load `glasses-milk`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0829), peracid mean 0.0689 mmol/L (peak 0.323). Result `sha256:a98b8671c7d5`, 0.4 s (exposure cached).
- **C**: assumed E-like detergent, Auto. Load `glasses-milk`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1, parameters {"liq.xProtease":0.02,"liq.xAmylase":0.01,"liq.xSilicate":0.275}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.2), protease mean 0.0727 g/L (peak 0.107), peracid mean 0.0699 mmol/L (peak 0.327). Result `sha256:5eef0ceb1b34`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (interior) | 0.0123 | 0.456 | 421 | 26.8 | 1 | 1 | 5.53 | 37.1 | 1.1 | 0 |  | 5 | 0 | 0 | 1.23 | ikw_milk_microwaved (reaction) 0/527 mg |
| B | glass_1 (interior) | 0.0123 | 0.456 | 421 | 26.8 | 1 | 1 | 5.53 | 37.1 | 1.1 | 0 |  | 5 | 0 | 0 | 1.23 | ikw_milk_microwaved (reaction) 0/527 mg |
| C | glass_1 (interior) | 0.0123 | 0.456 | 421 | 26.8 | 1 | 1 | 5.53 | 37.1 | 1.1 | 0 |  | 5 | 0 | 0 | 1.23 | ikw_milk_microwaved (reaction) 0/527 mg |

### P33 Fat needs temperature and enough water: too small

Test: A porcelain and a melamine dessert plate with fresh margarine in the lower basket, with the main wash of the Auto programme heated to 35 (A), 45 (B) and 55 C (C).

Adapted: The target of the main wash is changed in the steps of the Auto programme; everything else of the programme stays.

Stages: soil: removal laws (melt, roll-up by substrate), liquor (temperature course).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| warm | IEC score of the porcelain plate at 55 C, as a distance from 4 to 5 (C) |  |  | 0 score | margarine platter cleans easily at 50 C | within 1 of the range | pass |
| temperature | share of the margarine left on the two plates, 35 C minus 55 C | 6.6e-21 | 1.3e-12 | 1.3e-12 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more | too small |
| plastic (supporting) | share of the margarine left at 45 C, melamine minus porcelain (B) |  |  | 5.8e-16 1 | greasy residue most visibly on plastic | +0.01 or more | too small |

- **A**: main wash at 35 C. Load `dplate-lower`, programme `eco_50+wash35C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 163 min with detergent, mean 35 C (max 36.8 C), pH 11 (max 11.4), protease mean 0.0635 g/L (peak 0.1), peracid mean 0.144 mmol/L (peak 0.327). Result `sha256:0fa43d9f5291`, 1.5 s (exposure cached).
- **B**: main wash at 45 C. Load `dplate-lower`, programme `eco_50+wash45C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 168 min with detergent, mean 42.4 C (max 45 C), pH 10.8 (max 11.4), protease mean 0.0618 g/L (peak 0.0951), peracid mean 0.0887 mmol/L (peak 0.322). Result `sha256:0f4726ce4373`, 0.3 s (exposure cached).
- **C**: main wash at 55 C. Load `dplate-lower`, programme `eco_50+wash55C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 172 min with detergent, mean 49.6 C (max 55 C), pH 10.7 (max 11.3), protease mean 0.0476 g/L (peak 0.0788), peracid mean 0.052 mmol/L (peak 0.322). Result `sha256:70618eee7667`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0111 | 0.765 | 236 | 24.3 | 1 | 1 | 5.87 | 36.2 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 2.6e-21/1743 mg |
| A | melamine (well) | 0.00177 | 0.228 | 52.1 | 21.5 | 1 | 1 | 2.85 | 58.5 | 1.75 | 0 |  | 5 | 0 | 0 | 0.709 | iec_margarine (melt) 4.1e-9/1647 mg |
| B | plate (well) | 0.0111 | 0.765 | 236 | 24.4 | 1 | 1 | 5.87 | 36.2 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 1.5e-28/1743 mg |
| B | melamine (well) | 0.00178 | 0.228 | 52.1 | 21.5 | 1 | 1 | 2.85 | 58.5 | 1.75 | 0 |  | 5 | 0 | 0 | 0.709 | iec_margarine (melt) 9.6e-13/1647 mg |
| C | plate (well) | 0.0111 | 0.765 | 236 | 24.4 | 1 | 1 | 5.88 | 36.3 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 8.5e-38/1743 mg |
| C | melamine (well) | 0.00178 | 0.228 | 52.1 | 21.5 | 1 | 1 | 2.85 | 58.5 | 1.75 | 0 |  | 5 | 0 | 0 | 0.709 | iec_margarine (melt) 2.2e-17/1647 mg |

### P34 Thick layers detach as flakes: not covered

Test: A dessert plate with egg yolk at 5 (A) and 10 mg/cm2 dry (B).

Adapted: One plate; 5 and 10 mg/cm2 dry on 60 % of the well are 0.93 g and 1.85 g of yolk as applied.

Stages: soil: removal laws (cohesive failure and flakes, not built). Note: needs detachment of thick layers as flakes.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| flakes | soil that left as flakes, thick minus thin |  |  |  | thick egg yolk partly tended to flake off | + (any size) | not covered: needs detachment of thick layers as flakes |
| residue (supporting) | share of the egg yolk left, thick minus thin | 0 | 5.4e-12 | 5.4e-12 1 | the thicker layer takes longer | +0.01 or more | too small |

- **A**: 5 mg/cm2 dry. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:9d8ad1e9ef2d`, 0.3 s (exposure cached).
- **B**: 10 mg/cm2 dry. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:dbb26099dc85`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 0/492 mg |
| B | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 5.4e-9/983 mg |

### P35 Pot interiors: too small

Test: A 17 cm steel saucepan with burnt-on milk on its inner bottom and wall in the lower basket: mouth down on the rear rows (A) against lying on its side (B).

Adapted: Both poses are dropped and settled by the loading physics; the pan on its side rolls about 10 cm before it rests.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | IEC score of the pot mouth down, as a distance from 2.5 to 4.0 (A) |  |  | 1 score | pots class 2.5 with detergent D to 4.0 with E | within 1 of the range | pass |
| side | share of the soil left in the pot, on its side minus mouth down | 0 | 0 | 0 1 | on its side, half the wall is shadowed | +0.01 or more | too small |
| ranking (supporting) | share left on the inner wall minus on the inner bottom, mouth down (A) |  |  | 0 1 | inverted, the bottom is hit directly (the ranking is a calibration target) | +0.01 or more | too small |

- **A**: mouth down. Load `pot-inverted`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0837), peracid mean 0.0695 mmol/L (peak 0.323). Result `sha256:68084560310f`, 1.6 s (exposure cached).
- **B**: on its side. Load `pot-on-side`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0833), peracid mean 0.0696 mmol/L (peak 0.323). Result `sha256:7a391854cd2f`, 1.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot (interior_base) | 0.0394 | 0.976 | 219 | 32.3 | 0.804 | 1 | 4.78 | 11.8 | 0.344 | 0 |  | 5 | 0 | 0 | 12.5 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| A | pot (interior_wall) | 0.00475 | 0.408 | 380 | 29.7 | 0.972 | 1 | 34.6 | 59.6 | 1.5 | 0 |  | 5 | 0 | 0 | 12.5 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| B | pot (interior_base) | 0 | 0 | 0 | 0 | 1 | 1 | 11.9 | 49.3 | 1.24 | 0.943 | 1003 mL, full for 11685 s | 5 | 0 | 1003 | 9.47 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| B | pot (interior_wall) | 0 | 0 | 0 | 0 | 1 | 1 | 2.19 | 34.7 | 1.22 | 0.435 | 1003 mL, full for 11685 s | 5 | 0 | 1003 | 9.47 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |

### P36 Water pools in the base recess of inverted cups and mugs: pass

Test: A ceramic mug mouth down on a level support: the rear cup shelf of the upper basket folded down.

Adapted: The cup shelf of the Bosch is the level support; the mug is dropped onto it and settles. The expected volume is the checklist's formula for the recess of the catalogue's mug (28 mm radius, 2.5 mm deep).

Stages: water: scene (basins), run-off, pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pool | water standing in the base recess at the end |  |  | 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 | pass |
| drying (supporting) | drying score of the mug |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0851), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:a88046b020e8`, 1.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.4e-4 | 0.223 | 33.9 | 18.2 | 1 | 1 | 0.566 | 5.73 | 0.359 | 0.479 | 5 mL, full for 11744 s | 5 | 0 | 5 | 3.29 |  |

### P37 Tilt drains the recess: too small

Test: The mug of P36 at 0 (A), 7 (B), 15 (C) and 30 degrees (D) of tilt.

Adapted: The tilts are set, not settled: the mug is turned about a horizontal axis and kept standing on the height of its lowest point; the runner checks that it cuts into nothing. The checklist's volumes are for a recess of 25 mm radius and 3 mm depth; the expected values here are its formulas evaluated for the recess of the catalogue's mug (28 mm, 2.5 mm), as shares of the level volume.

Stages: water: scene (basins, minimum basin volume), pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| tilt7 | water in the recess at 7 degrees over level | 5 | 0.418 | 0.0836 1 | the wedge formula: 1.4 of 5.9 mL at 7 degrees for the checklist's recess; 0.92 of 6.2 mL for this mug's | +0.0744 to +0.298 | pass |
| tilt15 | water in the recess at 15 degrees over level | 5 | 0.111 | 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 | too small |
| tilt30 (supporting) | water in the recess at 30 degrees over level | 5 | 0 | 0 1 | the wedge formula: 0.13 of 5.9 mL at 30 degrees for the checklist's recess; 0.09 of 6.2 mL for this mug's | +0.0073 to +0.0292 | too small |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0851), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:a88046b020e8`, 1.3 s (exposure cached).
- **B**: tilted 7 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0849), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:479643116e00`, 1.4 s (exposure cached).
  - set pose: deepest overlap 0.01 mm (mug into upper_rack_fittings)
- **C**: tilted 15 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0849), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:5fba1a8af46d`, 1.4 s (exposure cached).
- **D**: tilted 30 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0848), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:8d09bf083574`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.4e-4 | 0.223 | 33.9 | 18.2 | 1 | 1 | 0.566 | 5.73 | 0.359 | 0.479 | 5 mL, full for 11744 s | 5 | 0 | 5 | 3.29 |  |
| B | mug (foot) | 3.9e-4 | 0.149 | 21.2 | 14.7 | 1 | 1 | 0.399 | 4.65 | 0.357 | 0.106 | 0.418 mL, full for 11748 s | 5 | 0 | 0.418 | 2.28 |  |
| C | mug (foot) | 3.9e-4 | 0.106 | 27.5 | 16.6 | 1 | 1 | 0.309 | 4.19 | 0.365 | 0.0638 | 0.111 mL, full for 11749 s | 5 | 0 | 0.111 | 1.72 |  |
| D | mug (foot) | 5.2e-4 | 0.149 | 31.4 | 19 | 1 | 1 | 1.71 | 11.2 | 0.585 | 0 | 0.0257 mL, full for 0 s | 5 | 0 | 0 | 1.3 |  |

### P38 Plastic stays wet: not covered

Test: A melamine and a porcelain dessert plate of the same shape side by side in the lower basket.

Adapted: None.

Stages: drying (not built); water: run-off (beads on plastic) gives the film it would start from. Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), melamine minus porcelain |  |  |  | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film per area at the end of the last rinse, melamine over porcelain, minus one |  |  | -0.321 1 | water beads on plastic and stays | +0.05 or more | wrong sign |

- **A**: side by side. Load `dplate-lower`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:0bf729645962`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate | 0.0114 | 0.723 | 429 | 26 | 1 | 1 | 7.32 | 32.3 | 1.12 | 0 |  | 5 | 0 | 0 | 1.01 |  |
| A | melamine | 0.016 | 0.627 | 357 | 26.5 | 1 | 1 | 9.71 | 62.5 | 1.65 | 0 |  | 5 | 0 | 0 | 0.709 |  |

### P39 Pots and large hollow ware stay wet: not covered

Test: A saucepan mouth down in the lower basket (A) against a dessert plate on edge (B).

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), pot minus plate |  |  |  | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water the pot keeps at the end (pools and film) against the plate | 12.5 | 1.01 | 11.5 g | rims that hold water, large wetted area | + (any size) | pass |

- **A**: saucepan. Load `pot-inverted`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0837), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:de89fb1b32b2`, 0.2 s (exposure cached).
- **B**: plate. Load `dplate-lower`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:0bf729645962`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot | 0.00987 | 0.441 | 383 | 32.3 | 0.96 | 1 | 18.1 | 56.8 | 1.37 | 0 |  | 5 | 0 | 0 | 12.5 |  |
| B | plate | 0.0114 | 0.723 | 429 | 26 | 1 | 1 | 7.32 | 32.3 | 1.12 | 0 |  | 5 | 0 | 0 | 1.01 |  |

### P40 Liquid held at contact points and in narrow gaps: pass

Test: Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B).

Adapted: Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.

Stages: water: scene (contacts), run-off (bridges, retained water).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| held | water left on the two glasses at the end of the last rinse (film and pools), B - A | 2.29 | 2.51 | 0.215 g | a wet mark at every touching pair | + (any size) | pass |
| marks (supporting) | residue marks at the contact (B) |  |  |  | a residue line at every touching pair | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: apart. Load `glasses-apart`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0825), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:1aa4862b4257`, 1.5 s (exposure cached).
- **B**: touching. Load `glasses-touching`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0825), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:4abb4a910d4f`, 1.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (exterior) | 0.00489 | 0.484 | 393 | 23.9 | 1 | 1 | 2.31 | 18.3 | 0.912 | 0 |  | 5 | 0 | 0 | 1.05 |  |
| A | glass_2 (exterior) | 0.00366 | 0.556 | 229 | 23.6 | 1 | 1 | 3.51 | 24.2 | 1.08 | 0 |  | 5 | 0 | 0 | 1.24 |  |
| B | glass_1 (exterior) | 0.00368 | 0.424 | 295 | 23.3 | 1 | 1 | 1.81 | 15.3 | 0.853 | 0 |  | 5 | 0 | 0 | 1.29 |  |
| B | glass_2 (exterior) | 0.00425 | 0.539 | 251 | 24.1 | 1 | 1 | 3.08 | 22.4 | 1.01 | 0 |  | 5 | 0 | 0 | 1.22 |  |

### P41 Light plastic items are moved or flipped by jets: not covered

Test: A 20 g polypropylene container lid lying hollow side down in the lower basket (A) against the upper basket (B).

Adapted: The lightest lid of the catalogue weighs 20 g, not 15 g. In the lower basket it comes to rest on the cutlery basket and the left front tines.

Stages: rigid-body coupling during the wash (not built); water: jets (the lift ratio is reported). Note: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| moved | distance the jets move the lid in the lower basket |  |  |  | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) | not covered: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) |
| lift (supporting) | peak upward jet force on the lid over its weight, lower basket (A) |  |  | 3.95 1 | 0.08 to 0.30 N per jet against the weight of a 20 g lid | +0.2 to +3 | too large |
| upper (supporting) | that ratio, upper basket minus lower basket | 3.95 | 2.58 | -1.37 1 | the advice is to put light plastics in the top rack | -0.01 or more | pass |

- **A**: lower basket. Load `lid-lower`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0833), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:84dd60c4aa24`, 1.4 s (exposure cached).
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 3.95 of its weight); it is simulated where it was placed
- **B**: upper basket. Load `lid-upper`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0825), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:83a5cea8da2a`, 1.5 s (exposure cached).
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 2.58 of its weight); it is simulated where it was placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | lid | 0.0192 | 0.392 | 218 | 32.3 | 1 | 1 | 16.1 | 40.7 | 0.911 | 0 |  | 5 | 0 | 0 | 8.69 |  |
| B | lid | 0.0356 | 0.422 | 289 | 28.1 | 1 | 1 | 20.4 | 90.6 | 1.96 | 0.035 | 6.05 mL, full for 11743 s | 5 | 0 | 6.1 | 2.14 |  |

### P42 Cutlery dries almost completely (negative control): not covered

Test: The cutlery of the IEC load.

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | points of the 0 to 1 drying scale the cutlery loses |  |  |  | drying 0.99 | |x| <= 0.04 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water standing in a piece of cutlery at the end, mean |  |  | 0 mL | it drains along its length | |x| <= 0.1 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (86 clean, mean score of the soiled 3.81), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:5b49d323eeb6`, 3.8 s (exposure cached).

### P43 Spots, film and tine marks on glass: not covered

Test: A test glass in the upper basket with rinse aid (A) and without (B).

Adapted: The wash has no input for water hardness or for running without rinse aid; B is washed as A until it has, and the scenario is reported as not covered.

Stages: drying and spotting (not built). Note: needs spots and film from evaporated water, and marks at contacts.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spots | spots on the glass, without rinse aid minus with |  |  |  | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: with rinse aid. Load `glass-free`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:96dfc3a844a1`, 1.4 s (exposure cached).
- **B**: without rinse aid. Load `glass-free`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0697 mmol/L (peak 0.323). Result `sha256:96dfc3a844a1`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass | 0.00418 | 0.488 | 327 | 25.5 | 1 | 1 | 3.42 | 17.2 | 0.85 | 0 |  | 5 | 0 | 0 | 1.28 |  |
| B | glass | 0.00418 | 0.488 | 327 | 25.5 | 1 | 1 | 3.42 | 17.2 | 0.85 | 0 |  | 5 | 0 | 0 | 1.28 |  |

### P44 Cutlery comes out clean although it is the most shadowed class: pass

Test: The IEC load of 13 place settings, loaded carefully, on the Auto programme; class mean of the soiled cutlery.

Adapted: The pieces of the load that the careful loading policy fits into the machine as modelled (about 100 of 140).

Stages: water: droplets, run-off in the cutlery basket; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the soiled cutlery, as a distance from 4.6 to 4.8 |  |  | -0.758 score | class mean 4.6 to 4.8 | within 1 of the range | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (86 clean, mean score of the soiled 3.81), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:5b49d323eeb6`, 3.8 s (exposure cached).

### P45 Class ranking in the standard test: pass

Test: The IEC load on the Auto programme: mean scores of cutlery, melamine, glass and crockery, and overall.

Adapted: The pieces that fit (about 100 of 140); the load has no pots (the loader left them out), so that class is not scored.

Stages: the whole wash.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| overall | load mean IEC score, as a distance from 3.5 to 4.2 |  |  | 0 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range | pass |
| crockery | crockery mean, as a distance from 2.3 to 3.7 |  |  | 0 score | crockery 2.3 to 3.7 | within 1 of the range | pass |
| glass | glass mean, as a distance from 2.3 to 4.0 |  |  | 0.3 score | glass 2.3 to 4.0 | within 1 of the range | pass |
| ranking | cutlery mean minus crockery mean |  |  | 0.43 score | cutlery > melamine > (pots, glass, crockery) | + (any size) | pass |
| melamine (supporting) | melamine mean minus crockery mean |  |  | 1.59 score | melamine above crockery | + (any size) | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (86 clean, mean score of the soiled 3.81), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:5b49d323eeb6`, 3.8 s (exposure cached).

### P46 Run-to-run repeatability: too small

Test: The IEC load washed with three seeds (level seed and simulation seed 1, 2 and 3); standard deviation of the load mean score.

Adapted: Three seeds. The seeds move the phase origin of the arms, the sampling of the droplets, and where on a region each soil lies and how thick; the tablet release time and the sensor decisions of the machine are fixed.

Stages: the whole wash (seeded sampling).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spread | standard deviation of the load mean IEC score over the three seeds |  |  | 0.0142 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 | too small |

- **A**: seeds 1. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (86 clean, mean score of the soiled 3.81), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:5b49d323eeb6`, 3.8 s (exposure cached).
- **B**: seeds 2. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (88 clean, mean score of the soiled 3.82), seeds 2/2. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0596 mmol/L (peak 0.321). Result `sha256:3db77e022bf8`, 3.9 s (exposure cached).
- **C**: seeds 3. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (87 clean, mean score of the soiled 3.78), seeds 3/3. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:d58a64151a85`, 8.2 s (exposure cached).

### P47 Everything is wetted within seconds; jets are rare events: pass

Test: The IEC load on the Auto programme: the share of the surface of the load that is wetted, and the fraction of time under a direct jet.

Adapted: The time-resolved first wetting is not recorded by the exposure (it stores the periodic state); what is checked is the wetted share in the periodic state and the water returning to the sump within a revolution.

Stages: water: jets, droplets, run-off.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | largest fraction of time under a direct jet of any item of the load (mean over its surface) |  |  | 0.0208 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 | pass |
| wetted | share of the surface of the load that no spray state wets |  |  | 3.4e-5 1 | everything is wetted | |x| <= 0.2 | pass |
| circuit (supporting) | share of the nozzle outflow not back in the sump within one revolution of the arm (largest of the spray states) |  |  | 5.9e-4 1 | water circuit under 3 s (a revolution takes 1.4 to 2.2 s) | |x| <= 0.5 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 116 items (86 clean, mean score of the soiled 3.81), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.4), protease mean 0.0577 g/L (peak 0.0942), peracid mean 0.0597 mmol/L (peak 0.321). Result `sha256:5b49d323eeb6`, 3.8 s (exposure cached).

### P48 Detergent does not change where water goes: pass

Test: A dessert plate in the lower basket washed with detergent (A) and with the dispenser blocked, so without any (B); the exposure of the two washes.

Adapted: The exposure of the simulation is computed for one liquor class and does not read the detergent at all, so this holds by construction: the check guards that it stays so.

Stages: water: jets (the exposure key excludes the liquor).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| jets | spray states whose exposure differs between the two washes |  |  | 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 | pass |

- **A**: with detergent. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0573 g/L (peak 0.0824), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:695f57159829`, 0.3 s (exposure cached).
- **B**: without detergent. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 254 min with detergent, mean 45.7 C (max 61 C), pH 10.1 (max 10.9), protease mean 0.0121 g/L (peak 0.0454), peracid mean 0.0058 mmol/L (peak 0.0269). Result `sha256:3936d80889c8`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.0e-7/1063 mg |
| B | plate (well) | 0.00607 | 0.597 | 196 | 24.5 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 922/1063 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

