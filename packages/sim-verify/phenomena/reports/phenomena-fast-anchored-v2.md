# Phenomena suite: fast tier, packages/calibration/anchors/anchored-v2.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.3.2 water-3`; parameters packages/calibration/anchors/anchored-v2.json (hydro `sha256:e4abd440fb63`, soil `sha256:4bfbce58484f`, 9 overrides). Exposure traced on: gpu. 48 phenomena, 83 washes (30 with cached exposure), 927.2 s.

Verdicts: 15 pass, 3 wrong sign, 18 too small, 3 too large, 9 not covered.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | retained: 1.09 -> 259: 258 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.1e-4 -> 1.5e-4: 0.361 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P03 | Plate pitch too small | too small | halving: 0 -> 0: 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |
| P04 | Nesting or "spooning" of like items | too large | score: 2 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 |
| P05 | Large flat item shadows what is behind or above it | too small | score: 0 -> 0: 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P06 | Spray arm stalled by an item | too small | score: 0 -> 0: 0 score | mean score of that rack -1.5 or more | -0.5 to -5 |
| P07 | Radial position: centre against corner | too small | score: 0 -> 0: 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 |
| P08 | Left/right asymmetry with rotation direction | pass | score: 0 -> 0: 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 |
| P09 | Lean direction of plates | too small | score: 0 -> 0: 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 |
| P10 | Tall narrow vessel interior | wrong sign | residue: 0.99 -> 0.989: -8.9e-4 1 | the interior of the tall vessel is the last place to clean | +0.01 or more |
| P11 | Upper against lower rack for tenacious soil | pass | score: 0 -> 0: 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 |
| P12 | Alternating large and small plates | too small | score: 0 -> 0: 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 |
| P13 | Glass or cup placed over tines | too small | f_jet: 0.0119 -> 0.0114: -0.0418 1 | interior f_jet reduced | -0.05 or more |
| P14 | Soiled face against the tub wall or door liner | too small | score: 0 -> 0: 0 score | as P02: -1 to -2 | -0 to -4 |
| P15 | Nested spoons | pass | shielded: 0 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P16 | Heads up against heads down (not nested) | pass | score: 0 -> 0: 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 |
| P17 | Crowded basket cells | too small | crowding: 1 -> 1: 0 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 |
| P18 | Cutlery tray against basket | pass | water: 0 -> 1.46: 1.46 mL | spoon bowls facing up hold water | + (any size) |
| P19 | Loading beyond rated capacity | pass | mean: 2.02 -> 1.61: -0.415 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 |
| P20 | Total soil load | too small | mean: 1.62 -> 1.62: 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 |
| P21 | Redeposition of particulates | not covered | specks: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 |
| P22 | Clean neighbours of soiled items | pass | clean: 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 |
| P23 | End-of-cycle drips from the upper rack | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 |
| P24 | Arrangement does not matter for easy soils (negative control) | pass | range: 0.135 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 |
| P25 | Detergent dispenser blocked | too small | score: 3.33 -> 3.33: 0 score | load mean -1.5 or more | -0.5 to -5 |
| P26 | Tablet trapped or dissolving in a dead spot | not covered | score: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) | similar to under-dosing; size unknown: calibration parameter | - (any size) |
| P27 | Time and temperature trade | too large | score: 0 -> 2: 2 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 |
| P28 | Bleachable stains are position-insensitive (negative control) | pass | position: 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 |
| P29 | Ageing of the soil before the wash | too small | fresh: -4.5 score | crockery mean at least 4.5 fresh | within 1 of the range |
| P30 | Protein soil responds to hit frequency and chemistry, not to jet strength | pass | pump: 0.273 -> 0.175: -0.0978 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 |
| P31 | Starch is bimodal | too small | both: 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more |
| P32 | Microwaved milk on glass is persistent | too small | class: -2.3 score | glass class 2.3 to 2.4 with detergent D on the reference machines | within 1 of the range |
| P33 | Fat needs temperature and enough water | too small | temperature: 4.8e-10 -> 2.7e-6: 2.7e-6 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more |
| P34 | Thick layers detach as flakes | not covered | flakes: needs detachment of thick layers as flakes | thick egg yolk partly tended to flake off | + (any size) |
| P35 | Pot interiors | wrong sign | side: 0.883 -> 0.791: -0.0913 1 | on its side, half the wall is shadowed | +0.01 or more |
| P36 | Water pools in the base recess of inverted cups and mugs | pass | pool: 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 |
| P37 | Tilt drains the recess | too small | tilt15: 5 -> 0.111: 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 |
| P38 | Plastic stays wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 |
| P39 | Pots and large hollow ware stay wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 |
| P40 | Liquid held at contact points and in narrow gaps | pass | held: 1.31 -> 1.54: 0.229 g | a wet mark at every touching pair | + (any size) |
| P41 | Light plastic items are moved or flipped by jets | not covered | moved: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) |
| P42 | Cutlery dries almost completely (negative control) | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | drying 0.99 | |x| <= 0.04 |
| P43 | Spots, film and tine marks on glass | not covered | spots: needs spots and film from evaporated water, and marks at contacts | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) |
| P44 | Cutlery comes out clean although it is the most shadowed class | too small | class: -2.63 score | class mean 4.6 to 4.8 | within 1 of the range |
| P45 | Class ranking in the standard test | wrong sign | ranking: -0.0256 score | cutlery > melamine > (pots, glass, crockery) | + (any size) |
| P46 | Run-to-run repeatability | too small | spread: 0.0103 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 |
| P47 | Everything is wetted within seconds; jets are rare events | pass | f_jet: 0.0242 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 |
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

- **A**: mouth down. Load `hollow-inverted`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 4.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:028f5d9a715f`, 1.8 s (exposure cached).
- **B**: mouth up. Load `hollow-upright`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:ff0bd37cba3a`, 27 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00926 | 0.719 | 386 | 26.9 | 1 | 1 | 3.13 | 22.6 | 0.826 | 0 | 1.09 mL, full for 5753 s | 5 | 0 | 1.09 | 0.962 | iec_tea (bleach) 0.00572/0.0577 mg |
| A | bowl (interior) | 0.104 | 0.963 | 250 | 26 | 1 | 1 | 16.7 | 62.9 | 1.41 | 0 |  | 4 | 0.136 | 0 | 0.869 | iec_oat_flakes (reaction) 0.00796/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 0.971 | 1 | 0.54 | 5.2 | 0.448 | 0.897 | 259 mL, full for 5381 s | 5 | 0 | 259 | 0.803 | iec_tea (bleach) 0.0126/0.0577 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 6.28 | 21.3 | 0.808 | 0.427 | 108 mL, full for 5741 s | 3 | 0.71 | 108 | 1.77 | iec_oat_flakes (reaction) 0.0191/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate (C) faces the axis tipped 10 degrees up, and a reversed plate (D) falls back against the tines and lies 34 degrees from the vertical with its face to the wall and down. C and D are reported as supporting evidence.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.1e-4 | 1.5e-4 | 0.361 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 0.772 | 0.773 | 0.00117 1 | removal depends on how often the spot is hit | +0.01 or more | too small |
| settled (supporting) | fraction of time the soiled face is under a direct jet, settled reversed plate (D) over the seated one (C) | 0.00605 | 0.035 | 5.79 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| settled_residue (supporting) | share of the egg yolk left on the face, D - C | 0.767 | 0.749 | -0.0181 1 | removal depends on how often the spot is hit | +0.01 or more | wrong sign |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:278743685792`, 12 s.
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:49f03b73e176`, 12.7 s.
- **C**: seated in its slot, face to the arm axis (settled). Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3956fc441a04`, 0.2 s (exposure cached).
- **D**: put in reversed and settled. Load `plate-away`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:2e79dfef4587`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.1e-4 | 0.337 | 264 | 32.4 | 1 | 1 | 5.66 | 31.1 | 1.05 | 0 |  | 0 | 8809 | 0 | 0.677 | iec_egg_yolk (reaction) 820/1063 mg |
| B | plate (well) | 1.5e-4 | 0.135 | 37.3 | 19 | 1 | 1 | 0.812 | 7.85 | 0.669 | 0 |  | 0 | 8809 | 0 | 0.714 | iec_egg_yolk (reaction) 821/1063 mg |
| C | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8808 | 0 | 0.81 | iec_egg_yolk (reaction) 816/1063 mg |
| D | plate (well) | 0.035 | 0.968 | 283 | 27.2 | 1 | 1 | 9.38 | 38.6 | 1.03 | 0 |  | 0 | 8804 | 0 | 0.978 | iec_egg_yolk (reaction) 796/1063 mg |

### P03 Plate pitch too small: too small

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot (about 7 mm between the pair, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become two plates to a slot, every slot and every second slot. Seven plates per row (eight when crowded). All rows are settled by the loading physics; the crowded row has pairs in slots 2, 4, 6 and 8, so the covered plate of a pair has its face about 7 mm behind its partner while the partner faces an open slot.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 0 | 0 | 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | too small |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 0 | 0 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.00313 | 0 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:e7e6a48d5e7f`, 1.1 s (exposure cached).
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `auto_145`, 8 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:d55b730a3442`, 23.9 s.
  - load: plate_6 rests but the stability probe flags it
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:88f56be881a4`, 1.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00313 | 0.467 | 67.4 | 17.6 | 1 | 1 | 1.56 | 13 | 0.833 | 0 |  | 0 | 15921 | 0 | 1.38 | iec_egg_yolk (reaction) 1084/1527 mg |
| B | plate_6 (well) | 0 | 0 | 0 | 0 | 0.958 | 1 | 0.503 | 5.37 | 0.519 | 0 |  | 0 | 15946 | 0 | 1.85 | iec_egg_yolk (reaction) 1200/1605 mg |
| C | plate_4 (well) | 0.00674 | 0.472 | 194 | 19.8 | 1 | 1 | 2.77 | 18.6 | 0.96 | 0 |  | 0 | 15917 | 0 | 1.38 | iec_egg_yolk (reaction) 1079/1527 mg |

### P04 Nesting or "spooning" of like items: too large

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 3.6e-4 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 2 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | too large |
| against (supporting) | share of the porridge left inside that bowl, B - A | 1.8e-4 | 3.6e-4 | 1.8e-4 1 | nesting leaves more | +0.01 or more | too small |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0701 | 3.2e-5 | 4.6e-4 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:82d2622e84ce`, 22.4 s.
- **B**: nested. Load `bowls-nested`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:5fc9daec166e`, 17.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0701 | 0.921 | 315 | 26.7 | 1 | 1 | 12.6 | 52.2 | 1.24 | 0 |  | 3 | 2 | 0 | 0.964 | iec_oat_flakes (reaction) 0.032/177 mg |
| B | bowl_over (interior) | 3.2e-5 | 0.0423 | 19 | 11.5 | 1 | 1 | 0.48 | 5.14 | 0.477 | 0 |  | 2 | 4.12 | 0 | 1.58 | iec_oat_flakes (reaction) 0.0633/177 mg |

### P05 Large flat item shadows what is behind or above it: too small

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 0 | 0 | 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | too small |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 0.00183 | 1.3e-4 | -0.926 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:51eb4576222f`, 20.4 s.
- **B**: platter between the plates and the arm axis. Load `board-middle`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:89b3ea5a676c`, 13.9 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 5.0e-4 | 0.154 | 107 | 20.5 | 1 | 1 | 1.4 | 11.2 | 0.781 | 0 |  | 0 | 8805 | 0 | 0.874 | iec_egg_yolk (reaction) 744/985 mg |
| A | plate_2 (well) | 0.00316 | 0.372 | 214 | 23.4 | 1 | 1 | 3.23 | 22.6 | 0.945 | 0 |  | 0 | 8801 | 0 | 0.851 | iec_egg_yolk (reaction) 724/969 mg |
| B | plate_1 (well) | 1.9e-4 | 0.106 | 234 | 30.7 | 1 | 1 | 2.17 | 15.4 | 0.9 | 0 |  | 0 | 8805 | 0 | 0.814 | iec_egg_yolk (reaction) 743/985 mg |
| B | plate_2 (well) | 8.3e-5 | 0.0672 | 324 | 31.8 | 1 | 1 | 3.33 | 20.1 | 1.02 | 0 |  | 0 | 8802 | 0 | 0.852 | iec_egg_yolk (reaction) 726/969 mg |

### P06 Spray arm stalled by an item: too small

Test: Seven IEC dinner plates with egg yolk in every second slot of the rear lane (A); the same with a ladle let down through the floor of the lower basket until it hangs in the path of the lower arm (B).

Adapted: A ladle stands in for the fork: a fork slips through the floor grid of this basket and falls, a ladle hangs by its bowl. The session's mechanical check finds the arm stopped and the angle; the wash takes both from it.

Stages: load: session (mechanical check); water: hydraulics (stalled arm), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| coverage | share of the plates' faces ever under a direct jet, B over A | 0.42 | 0 | 0 1 | direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %) | |x| <= 0.2 | pass |
| score | mean IEC score of the plates of that rack, B - A | 0 | 0 | 0 score | mean score of that rack -1.5 or more | -0.5 to -5 | too small |

- **A**: arm free. Load `plates-36`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:88f56be881a4`, 16.3 s.
- **B**: lower arm stopped by the hanging ladle. Load `plates-36-stalled`, programme `auto_145`, 8 items (1 clean, mean score of the soiled 0), seeds 1/1, lower arm stopped. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:e17ba03ac651`, 27.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00674 | 0.472 | 194 | 19.8 | 1 | 1 | 2.77 | 18.6 | 0.96 | 0 |  | 0 | 15917 | 0 | 1.38 | iec_egg_yolk (reaction) 1079/1527 mg |
| B | plate_4 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 1.62 | 13.3 | 0.891 | 0 |  | 0 | 15924 | 0 | 1.38 | iec_egg_yolk (reaction) 1087/1527 mg |

### P07 Radial position: centre against corner: too small

Test: Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle).

Adapted: The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.

Stages: water: hydraulics (nozzle positions), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate at the corner against the one at mid-radius | 0 | 0 | 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 | too small |
| dwell (supporting) | fraction of time the face is under a direct jet, corner over mid-radius, minus one | 0.0135 | 0.00969 | -0.284 1 | low radial locations are impacted for longer | -0.05 or more | pass |

- **A**: four soup plates. Load `soup-radial`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:7e5370a6e9bb`, 15 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_1 (well) | 0.00239 | 0.454 | 204 | 21.2 | 1 | 1 | 5.92 | 28.8 | 0.974 | 0 |  | 0 | 14125 | 0 | 1.36 | iec_egg_yolk (reaction) 1086/1478 mg |
| A | soup_2 (well) | 0.0135 | 0.671 | 251 | 21.5 | 1 | 1 | 6.76 | 31.7 | 1.07 | 0 |  | 0 | 14132 | 0 | 1.33 | iec_egg_yolk (reaction) 1172/1574 mg |
| A | soup_3 (well) | 0.00969 | 0.652 | 307 | 29.5 | 1 | 1 | 5.92 | 28.1 | 0.965 | 0 |  | 0 | 14130 | 0 | 1.37 | iec_egg_yolk (reaction) 1152/1552 mg |

### P08 Left/right asymmetry with rotation direction: pass

Test: Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis.

Adapted: The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.

Stages: water: hydraulics (nozzle directions, sense of rotation), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the right-hand plate minus the left-hand one | 0 | 0 | 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 | pass |
| jets (supporting) | fraction of time the face is under a direct jet, right over left, minus one | 0.00969 | 0.0322 | 2.33 1 | in one real arm a right-hand plate received five jets and its mirror image two | |x| <= 3 | pass |

- **A**: mirrored plates. Load `soup-radial`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:7e5370a6e9bb`, 15 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_3 (well) | 0.00969 | 0.652 | 307 | 29.5 | 1 | 1 | 5.92 | 28.1 | 0.965 | 0 |  | 0 | 14130 | 0 | 1.37 | iec_egg_yolk (reaction) 1152/1552 mg |
| A | soup_4 (well) | 0.0322 | 0.927 | 363 | 25.7 | 1 | 1 | 9 | 37.1 | 1.08 | 0 |  | 0 | 14110 | 0 | 1.38 | iec_egg_yolk (reaction) 1084/1509 mg |

### P09 Lean direction of plates: too small

Test: A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up).

Adapted: The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.

Stages: water: jets (incidence), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 | too small |
| f_jet (supporting) | fraction of time the soiled face is under a direct jet, B over A, minus one | 0.00963 | 1.8e-4 | -0.982 1 | leaning away presents the back | -0.05 or more | pass |

- **A**: leaning toward the arm axis. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:8cf522520212`, 12.7 s.
- **B**: leaning away from the arm axis. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:28a26345f35e`, 12.9 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00963 | 0.866 | 363 | 30 | 1 | 1 | 15.3 | 59.4 | 1.32 | 0 |  | 0 | 8808 | 0 | 0.791 | iec_egg_yolk (reaction) 813/1063 mg |
| B | plate (well) | 1.8e-4 | 0.141 | 42.7 | 20.7 | 1 | 1 | 2.54 | 16.6 | 0.938 | 0 |  | 0 | 8809 | 0 | 0.735 | iec_egg_yolk (reaction) 820/1063 mg |

### P10 Tall narrow vessel interior: wrong sign

Test: A 250 mL test glass (B) against a shallow dessert bowl (A), each with microwaved milk inside, mouth down at the same spot of the upper basket.

Adapted: Upper basket; both settle on the wires leaning on the same tine row.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws, chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| glass | IEC score of the glass, as a distance from the range 2.3 to 4.0 (B) |  |  | -2.3 score | standard glass class (baked milk) scores 2.3 to 4.0 | within 1 of the range | too small |
| residue | share of the milk left, glass minus bowl | 0.99 | 0.989 | -8.9e-4 1 | the interior of the tall vessel is the last place to clean | +0.01 or more | wrong sign |
| f_jet (supporting) | fraction of time the inside is under a direct jet, glass over bowl, minus one | 0.0767 | 0.0121 | -0.842 1 | a 60 mm opening is under a nozzle for about 6 % of a revolution | -0.05 or more | pass |

- **A**: shallow bowl. Load `bowl-same-spot`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:cd0119b31dd9`, 14.4 s.
- **B**: tall glass. Load `glass-between`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:9dc4d3b02468`, 13.1 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl (interior) | 0.0767 | 0.72 | 267 | 27.6 | 1 | 1 | 11.4 | 50.7 | 1.28 | 0 |  | 0 | 8182 | 0 | 0.699 | iec_milk (reaction) 4977/5029 mg |
| B | glass (interior) | 0.0121 | 0.459 | 485 | 26.4 | 1 | 1 | 6.09 | 37.5 | 1.09 | 0 |  | 0 | 10708 | 0 | 0.826 | iec_milk (reaction) 5225/5285 mg |

### P11 Upper against lower rack for tenacious soil: pass

Test: The same dessert plate with egg yolk standing in the rear lane of the lower basket (A) and in the rows of the upper basket (B).

Adapted: The dessert plate is the largest plate the upper basket takes. In the upper rows it does not stand as in the lower ones: the loading physics leaves it leaning about 50 degrees against the tines, which is the pose washed.

Stages: water: hydraulics (flow per level), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 | pass |
| residue (supporting) | share of the egg yolk left, B - A | 0.764 | 0.772 | 0.00784 1 | little difference between the baskets | |x| <= 0.4 | pass |

- **A**: lower basket. Load `dplate-lower`, programme `auto_145`, 2 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:7e89922abd64`, 19.7 s.
- **B**: upper basket. Load `dplate-upper`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:ff83c924ef45`, 21 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0111 | 0.765 | 236 | 24.1 | 1 | 1 | 7.11 | 36 | 1.3 | 0 |  | 0 | 8808 | 0 | 0.794 | iec_egg_yolk (reaction) 812/1063 mg |
| B | plate (well) | 5.9e-5 | 0.0832 | 35.8 | 19.3 | 1 | 1 | 1.36 | 11.6 | 0.785 | 0 |  | 0 | 8809 | 0 | 0.837 | iec_egg_yolk (reaction) 820/1063 mg |

### P12 Alternating large and small plates: too small

Test: Dinner plates with egg yolk in neighbouring slots of the rear lane (A) against dinner and dessert plates alternating at the same 18.25 mm pitch (B); the dinner plate at slot 5 is scored on its upper half.

Adapted: Pitch 18.25 mm (the tines of the Bosch) instead of 15 mm.

Stages: water: jets (gap geometry); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the upper half of the large plate at slot 5, B - A | 0 | 0 | 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 | too small |
| residue (supporting) | share of the egg yolk left on the upper half of that plate, B - A | 0.68 | 0.694 | 0.0139 1 | the wider gap above the small plates lets more through | -0.01 or more | wrong sign |

- **A**: large plates only. Load `plates-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:e7e6a48d5e7f`, 1.1 s (exposure cached).
- **B**: large and small alternating. Load `plates-alt-18`, programme `auto_145`, 7 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:c7958dd90378`, 23.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_3 (well) | 0.00244 | 0.48 | 204 | 19.2 | 1 | 1 | 2.33 | 16.8 | 0.954 | 0 |  | 0 | 15873 | 0 | 1.39 | iec_egg_yolk (reaction) 941/1383 mg |
| B | plate_2 (well) | 0.003 | 0.457 | 173 | 19.1 | 1 | 1 | 1.78 | 14.3 | 0.872 | 0 |  | 0 | 15889 | 0 | 1.39 | iec_egg_yolk (reaction) 1010/1453 mg |

### P13 Glass or cup placed over tines: too small

Test: A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A).

Adapted: Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.

Stages: water: jets (tine in the path), droplets (fans off the tine), scene (contacts).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the inside is under a direct jet, B over A, minus one | 0.0119 | 0.0114 | -0.0418 1 | interior f_jet reduced | -0.05 or more | too small |
| marks (supporting) | contact marks on the glass over the tine (B) |  |  |  | AHAM adds 1 to 3 grade points per marked glass | +0.5 to +6 | not covered: needs spots and film from evaporated water, and marks at contacts |
| drying (supporting) | change of the drying score, B - A |  |  |  | drying score -1 | -0.5 to -2 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: row folded down: no tine in the glass. Load `glass-free`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:247f9544d573`, 13.9 s.
- **B**: over a tine. Load `glass-free`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:2ad7480fee56`, 17.9 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass (interior) | 0.0119 | 0.656 | 243 | 29.5 | 1 | 1 | 4.26 | 32.4 | 1 | 0 |  | 0 | 10708 | 0 | 2.73 | iec_milk (reaction) 5226/5285 mg |
| B | glass (interior) | 0.0114 | 0.656 | 243 | 29.3 | 1 | 1 | 4.09 | 31.3 | 0.995 | 0 |  | 0 | 10708 | 0 | 2.74 | iec_milk (reaction) 5226/5285 mg |

### P14 Soiled face against the tub wall or door liner: too small

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the platter is seated by the loading physics both ways round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00666 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 0 | 0 | 0 score | as P02: -1 to -2 | -0 to -4 | too small |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 37.5 | 4.45 | -0.881 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 0.648 | 0.663 | 0.0147 1 | the face to the wall keeps more | +0.01 or more | pass |

- **A**: face inward. Load `platter-inward`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:36cc6265d827`, 13.7 s.
- **B**: face to the wall. Load `platter-to-wall`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:178dd7cdd5ca`, 12.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00666 | 0.476 | 359 | 30.3 | 1 | 1 | 8.23 | 37.5 | 1.31 | 0 |  | 0 | 12713 | 0 | 1.07 | iec_egg_yolk (reaction) 665/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 0.998 | 1 | 0.372 | 4.45 | 0.482 | 0 |  | 0 | 12744 | 0 | 1.08 | iec_egg_yolk (reaction) 680/1026 mg |

### P15 Nested spoons: pass

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 0 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | pass |
| partner | IEC score of the other spoon, nested minus opposed | 2 | 2 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0.00664 | 0.0311 | 0.0244 1 | when spoons spoon, they trap food | +0.01 or more | pass |

- **A**: opposed. Load `spoons-opposed`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:8e958037b31c`, 18.3 s.
- **B**: nested. Load `spoons-nested`, programme `auto_145`, 2 items (0 clean, mean score of the soiled 1.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:63e7cfa5175d`, 12.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 1.51 | 32.9 | 1.16 | 0 |  | 2 | 13.6 | 0 | 0.103 | iec_oat_flakes (reaction) 0.123/23.6 mg |
| A | spoon_2 (bowl) | 0.0055 | 0.758 | 275 | 37.1 | 1 | 1 | 2.53 | 26.3 | 0.853 | 0 |  | 2 | 19.5 | 0 | 0.0822 | iec_oat_flakes (reaction) 0.161/24.3 mg |
| B | spoon_1 (bowl) | 0.0043 | 0.93 | 240 | 24.9 | 1 | 1 | 2.24 | 33.2 | 1.12 | 0 |  | 2 | 17.1 | 0 | 0.364 | iec_oat_flakes (reaction) 0.157/23.6 mg |
| B | spoon_2 (bowl) | 6.2e-5 | 0.0545 | 117 | 43.7 | 0.994 | 0.994 | 0.267 | 8.04 | 0.835 | 0 |  | 1 | 64.6 | 0 | 0.354 | iec_oat_flakes (reaction) 0.754/24.3 mg |

### P16 Heads up against heads down (not nested): pass

Test: Six dinner forks with egg yolk on the tines, one per cell of the cutlery basket: handles down (A) against handles up (B).

Adapted: Six forks, one per cell: the cutlery basket of the Bosch has six cells, not twelve.

Stages: water: jets (basket walls), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the forks, B - A | 0 | 0 | 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 | pass |
| residue (supporting) | mean share of the egg yolk left on the forks, B - A | 0.822 | 0.798 | -0.0245 1 | an informal test found no difference | |x| <= 0.2 | pass |

- **A**: heads up. Load `forks-heads-up`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:0ee3c0397175`, 15.7 s.
- **B**: heads down. Load `forks-heads-down`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:0f051a014e1b`, 13 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | fork_1 (tines) | 3.3e-5 | 0.0217 | 38.9 | 19.4 | 0.991 | 1 | 0.321 | 28.3 | 1.29 | 0 |  | 0 | 1101 | 0 | 0.147 | iec_egg_yolk (reaction) 126/156 mg |
| B | fork_1 (tines) | 0.002 | 0.56 | 420 | 60.1 | 1 | 1 | 6.68 | 78.8 | 2.16 | 0 |  | 0 | 1101 | 0 | 0.182 | iec_egg_yolk (reaction) 126/156 mg |

### P17 Crowded basket cells: too small

Test: Dessert spoons with porridge in their bowls, handles down in the six cells of the cutlery basket: one (A), two (B) and four (C) per cell.

Adapted: Six, twelve and twenty-four spoons in the six cells of the Bosch; each load is settled by the loading physics.

Stages: load: physics (contacts); water: scene (contacts), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| crowding | share of spoons not scoring 5, four per cell minus one per cell | 1 | 1 | 0 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 | too small |
| single (supporting) | share of spoons not scoring 5 at one per cell, as a distance from 10 to 40 % |  |  | 0.6 1 | about 20 % of cutlery not scoring 5 in the standard load | within 0.1 of the range | too large |
| residue (supporting) | mean share of porridge left, four per cell minus one per cell | 0.0253 | 0.0353 | 0.00998 1 | crowding leaves more | +0.05 or more | too small |

- **A**: one per cell. Load `spoons-1`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 1.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b87aa37d275b`, 15.2 s.
- **B**: two per cell. Load `spoons-2`, programme `auto_145`, 12 items (0 clean, mean score of the soiled 1.25), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:850313630147`, 15 s.
- **C**: four per cell. Load `spoons-4`, programme `auto_145`, 24 items (0 clean, mean score of the soiled 1.25), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:96bda6274696`, 23.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.0013 | 0.758 | 72.4 | 23.4 | 1 | 1 | 0.609 | 19.3 | 0.925 | 0 |  | 2 | 49.7 | 0 | 0.109 | iec_oat_flakes (reaction) 0.464/23.6 mg |
| B | spoon_1 (bowl) | 0.00134 | 0.984 | 61.5 | 23.9 | 1 | 1 | 0.54 | 17.2 | 0.847 | 0 |  | 1 | 50.2 | 0 | 0.17 | iec_oat_flakes (reaction) 0.468/23.6 mg |
| C | spoon_1 (bowl) | 0.0015 | 0.944 | 54.7 | 23.8 | 1 | 1 | 0.406 | 15.8 | 0.859 | 0 |  | 1 | 50.2 | 0 | 0.222 | iec_oat_flakes (reaction) 0.467/23.6 mg |

### P18 Cutlery tray against basket: pass

Test: Six dessert spoons with porridge in their bowls: standing in the cutlery basket (A) against lying flat, bowls up, on the knife shelf of the upper basket (B).

Adapted: The owner's machine has no cutlery drawer; the knife shelf of the upper basket is where pieces lie flat, so it stands in for the tray.

Stages: water: scene (basins of small hollows), pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| water | water standing in a spoon at the end, mean, B - A | 0 | 1.46 | 1.46 mL | spoon bowls facing up hold water | + (any size) | pass |
| drying (supporting) | drying score of the spoons lying bowl up (B) |  |  |  | drying score on face-up spoon bowls 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: standing in the basket. Load `spoons-1`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 1.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b87aa37d275b`, 15.2 s.
- **B**: lying on the knife shelf. Load `spoons-shelf`, programme `auto_145`, 6 items (0 clean, mean score of the soiled 1.5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:2864a520ebd4`, 15.2 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.0013 | 0.758 | 72.4 | 23.4 | 1 | 1 | 0.609 | 19.3 | 0.925 | 0 |  | 2 | 49.7 | 0 | 0.109 | iec_oat_flakes (reaction) 0.464/23.6 mg |
| B | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 2.09 | 34.3 | 0.898 | 0.467 | 1.53 mL, full for 5752 s | 2 | 46.7 | 1.53 | 0.323 | iec_oat_flakes (reaction) 0.57/23.6 mg |

### P19 Loading beyond rated capacity: pass

Test: Six place settings well spaced (A) against the full IEC load one piece to a slot (B, nearly twice the pieces), both settled by the careful loading policy; mean IEC score of the soiled pieces.

Adapted: The machine as modelled does not take the rated 140 pieces: the careful loader fits about 100. A load "beyond what fits" cannot be built by a loader that refuses what does not hold, so the contrast run here is half load against full load (about 80 % more pieces), not rated against rated + 30 %.

Stages: load: loader; water: jets (shadowing), run-off; soil: liquor (soil load).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the soiled pieces, B - A | 2.02 | 1.61 | -0.415 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 | pass |

- **A**: half load, well spaced. Load `loader:half-careful`, programme `auto_145`, 57 items (24 clean, mean score of the soiled 2.02), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0542 mmol/L (peak 0.323). Result `sha256:ab992cc286c7`, 23.8 s.
- **B**: full load, one piece to a slot. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.61), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:e10bfd637aab`, 4.9 s (exposure cached).

### P20 Total soil load: too small

Test: The IEC load in one geometry with a quarter (A), half (B) and all (C) of its pieces soiled; mean IEC score of the pieces that are soiled in all three.

Adapted: Every fourth piece of the load (by position in its list) is the quarter; every second the half.

Stages: soil: liquor (consumption of oxidant and enzyme by soil), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the always-soiled quarter, all soiled minus a quarter soiled | 1.62 | 1.62 | 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 | too small |

- **A**: a quarter of the pieces soiled. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (84 clean, mean score of the soiled 1.62), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0554 mmol/L (peak 0.324). Result `sha256:d45dafd414af`, 1.6 s (exposure cached).
- **B**: half of the pieces soiled. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (69 clean, mean score of the soiled 1.52), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0551 mmol/L (peak 0.324). Result `sha256:0fbed6f52a79`, 2.4 s (exposure cached).
- **C**: all pieces soiled. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.61), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:e10bfd637aab`, 4.9 s (exposure cached).

### P21 Redeposition of particulates: not covered

Test: Seven clean dinner plates (A) against the same with 20 g of minced spinach on one of them (B); specks on the plates that started clean.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: redeposition (not built). Note: needs redeposition of particles (soil carried by the liquor and settled on other surfaces).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| specks | share of the plates that started clean and carry 1 to 4 specks, B - A |  |  |  | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 | not covered: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) |

- **A**: no spinach. Load `plates-18`, programme `auto_145`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:e7ff38505b68`, 15.6 s.
- **B**: 20 g of spinach on one plate. Load `plates-18`, programme `auto_145`, 7 items (6 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:7f49c62b2838`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | plate_3 | 0.00508 | 0.494 | 346 | 25 | 0.999 | 1 | 3.84 | 21 | 0.963 | 0 |  | 5 | 0 | 0 | 1.39 |  |

### P22 Clean neighbours of soiled items: pass

Test: Seven dinner plates in neighbouring slots, every second one with egg yolk; the clean ones are scored.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: liquor, redeposition (not built: the clean plates cannot pick anything up).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clean | points the clean plates lose (5 minus their mean IEC score) |  |  | 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 | pass |

- **A**: clean and soiled alternating. Load `plates-18`, programme `auto_145`, 7 items (3 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:b9a764b0359e`, 0.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00479 | 0.485 | 299 | 25.7 | 1 | 1 | 2.88 | 17 | 0.902 | 0 |  | 5 | 0 | 0 | 1.38 |  |

### P23 End-of-cycle drips from the upper rack: not covered

Test: Seven dinner plates in the lower basket with an empty upper basket (A) against three mugs mouth down in the upper basket (B).

Adapted: Three mugs stand for the loaded upper basket.

Stages: water: drain-down after the last rinse and drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale) of the lower plates, B - A |  |  |  | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film on the lower plates at the end of the last rinse, mean, B - A | 1.4 | 1.39 | -0.00546 g | drips from above add water | + (any size) | wrong sign |

- **A**: upper basket empty. Load `plates-18`, programme `auto_145`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:e7ff38505b68`, 15.6 s.
- **B**: upper basket loaded. Load `plates-18-upper`, programme `auto_145`, 10 items (9 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:45b0b6da4899`, 16.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00479 | 0.485 | 299 | 25.7 | 1 | 1 | 2.88 | 17 | 0.902 | 0 |  | 5 | 0 | 0 | 1.38 |  |
| B | plate_4 | 0.00479 | 0.485 | 299 | 25.7 | 0.997 | 1 | 2.59 | 15.2 | 0.821 | 0 |  | 5 | 0 | 0 | 1.37 |  |

### P24 Arrangement does not matter for easy soils (negative control): pass

Test: The IEC load with half of its pieces carrying an air-dried, lightly adhering soil (jam, 15 h) and half clean, in three different soiled/clean orders.

Adapted: The three orders are three different halves of the pieces of one settled load; the soil lies where the IEC soil of each piece lies.

Stages: soil: removal laws (dissolve), hydration.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| range | largest minus smallest load mean IEC score of the three orders |  |  | 0.135 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 | pass |

- **A**: first order. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (94 clean, mean score of the soiled 4.45), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0541 mmol/L (peak 0.322). Result `sha256:c9338dfac7f3`, 1 s (exposure cached).
- **B**: second order. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (95 clean, mean score of the soiled 4.54), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.054 mmol/L (peak 0.322). Result `sha256:b96f5104bd42`, 1 s (exposure cached).
- **C**: third order. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (97 clean, mean score of the soiled 4.59), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.054 mmol/L (peak 0.322). Result `sha256:fa37f6d6c9a5`, 23.4 s.

### P25 Detergent dispenser blocked: too small

Test: A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D).

Adapted: The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.

Stages: load: session (mechanical check); soil: liquor (dosing), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| protein | share of the egg yolk removed without detergent (B) |  |  | 0.00267 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 | pass |
| tea | share of the tea film removed without detergent (D) |  |  | 0.121 1 | tea stays | |x| <= 0.2 | pass |
| score | mean IEC score of the three pieces, blocked minus free | 3.33 | 3.33 | 0 score | load mean -1.5 or more | -0.5 to -5 | too small |

- **A**: plate, dispenser free. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3956fc441a04`, 0.2 s (exposure cached).
- **B**: plate, dispenser blocked. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 120 min with detergent, mean 56.2 C (max 69 C), pH 9.81 (max 10.3), protease mean 0.00515 g/L (peak 0.0171), peracid mean 0.00233 mmol/L (peak 0.0107). Result `sha256:09f4b17ff82c`, 0.2 s (exposure cached).
- **C**: tea cups, dispenser free. Load `cups-centre-corner`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:4a8c9d04cf33`, 12.2 s.
- **D**: tea cups, dispenser blocked. Load `cups-centre-corner`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1, dispenser blocked. Liquor of the main wash: 120 min with detergent, mean 56.2 C (max 69 C), pH 9.81 (max 10.3), protease mean 0.00515 g/L (peak 0.0171), peracid mean 0.00232 mmol/L (peak 0.0107). Result `sha256:9aef7ba21ee1`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8808 | 0 | 0.81 | iec_egg_yolk (reaction) 816/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8812 | 0 | 0.81 | iec_egg_yolk (reaction) 1060/1063 mg |
| C | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 11.6 | 53.5 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 5 | 0 | 0 | 0.572 | iec_tea (bleach) 0.0034/0.0346 mg |
| D | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 11.6 | 53.5 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 5 | 0 | 0 | 0.572 | iec_tea (bleach) 0.0306/0.0346 mg |

### P26 Tablet trapped or dissolving in a dead spot: not covered

Test: A dessert plate with egg yolk washed with the tablet released into its tray (A) against a tablet that lands in an upright bowl (B).

Adapted: The wash has no input for where the tablet lands; B is washed as A until it has one, and the scenario is reported as not covered.

Stages: soil: liquor (tablet transport and local dissolution, not built). Note: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A |  |  |  | similar to under-dosing; size unknown: calibration parameter | - (any size) | not covered: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) |

- **A**: tablet in its tray. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3956fc441a04`, 0.2 s (exposure cached).
- **B**: tablet in an upright bowl. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3956fc441a04`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8808 | 0 | 0.81 | iec_egg_yolk (reaction) 816/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8808 | 0 | 0.81 | iec_egg_yolk (reaction) 816/1063 mg |

### P27 Time and temperature trade: too large

Test: A dessert plate with egg yolk (well) and porridge (rim) in the lower basket on the short programme (A, Express 65, 1 h), the eco programme (B, Eco 50, 4 h 55 min) and the intensive programme (C, Intensive 70).

Adapted: The three programmes are those of the owner's machine as the machine package models them.

Stages: soil: liquor (temperature course, enzyme life), hydration, chemistry; machine: programme timeline.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate, eco minus short | 0 | 2 | 2 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 | too large |
| residue (supporting) | share of the soil left on the plate, eco minus short | 0.754 | 4.6e-4 | -0.753 1 | short programmes fail on starch and protein | -0.01 or more | pass |
| intensive (supporting) | share of the soil left on the plate, intensive minus short | 0.754 | 0.849 | 0.0952 1 | more time and temperature remove more | -0.01 or more | wrong sign |

- **A**: Express 65. Load `plate-facing`, programme `express_65`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 43.4 min with detergent, mean 52.9 C (max 66.9 C), pH 10.3 (max 10.8), protease mean 0.0424 g/L (peak 0.072), peracid mean 0.0856 mmol/L (peak 0.202). Result `sha256:f8ae0062d7c3`, 3.6 s.
- **B**: Eco 50. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0744 g/L (peak 0.11), peracid mean 0.0694 mmol/L (peak 0.323). Result `sha256:ed4ae360fdf6`, 0.5 s (exposure cached).
- **C**: Intensive 70. Load `plate-facing`, programme `intensive_70`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 58.5 min with detergent, mean 58.6 C (max 70 C), pH 10.4 (max 10.9), protease mean 0.0336 g/L (peak 0.0986), peracid mean 0.0934 mmol/L (peak 0.323). Result `sha256:ec5031963086`, 5.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well, rim) | 0.0127 | 0.498 | 252 | 19.4 | 1 | 1 | 9.52 | 46.9 | 1.34 | 0 |  | 0 | 12106 | 0 | 0.811 | iec_egg_yolk (reaction) 899/1063 mg; iec_oat_flakes (reaction) 28.8/167 mg |
| B | plate (well, rim) | 0.00726 | 0.656 | 237 | 24.5 | 1 | 1 | 6.68 | 33.5 | 1.21 | 0 |  | 2 | 6.27 | 0 | 0.81 | iec_egg_yolk (reaction) 0.56/1063 mg; iec_oat_flakes (reaction) 3.0e-4/167 mg |
| C | plate (well, rim) | 0.00757 | 0.642 | 353 | 26.9 | 1 | 1 | 7.1 | 34.8 | 1.24 | 0 |  | 0 | 11229 | 0 | 0.81 | iec_egg_yolk (reaction) 1024/1063 mg; iec_oat_flakes (reaction) 20.7/167 mg |

### P28 Bleachable stains are position-insensitive (negative control): pass

Test: Two tea cups with tea film mouth down in the upper basket, one near the axis of the upper arm and one in a corner outside the swept circle, with the standard detergent (A) and with a bleach-free one (B).

Adapted: The corner cup stands on the knife shelf at the rear left. Bleach-free: the detergent without percarbonate and TAED (`liq.xPeroxide`, `liq.xTaed` = 0).

Stages: water: droplets, run-off (wetting); soil: chemistry (bleach), supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| position | IEC score of the corner cup minus the centre cup (A) |  |  | 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 | pass |
| bleach | share of the tea film removed without bleach (B) |  |  | 2.2e-16 1 | without bleach all fail | |x| <= 0.2 | pass |
| with (supporting) | share of the tea film removed with bleach, mean of the two cups (A) |  |  | 0.9 1 | with oxidant, temperature and time the film goes | +0.5 to +1 | pass |
| f_jet (supporting) | fraction of time the inside is under a direct jet, corner over centre, minus one (A) |  |  | -0.95 1 | the corner is the worst spray position | -0.05 or more | pass |

- **A**: with bleach. Load `cups-centre-corner`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:4a8c9d04cf33`, 12.2 s.
- **B**: bleach-free detergent. Load `cups-centre-corner`, programme `auto_145`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1, parameters {"liq.xPeroxide":0,"liq.xTaed":0}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0285 g/L (peak 0.0998), peracid mean 0 mmol/L (peak 0). Result `sha256:3f77991b8cf6`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 11.6 | 53.5 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 5 | 0 | 0 | 0.572 | iec_tea (bleach) 0.0034/0.0346 mg |
| A | cup_2 (interior) | 0.00245 | 0.482 | 291 | 27.8 | 0.999 | 1 | 0.436 | 5.67 | 0.456 | 0 | 0.994 mL, full for 5749 s | 5 | 0 | 0.994 | 1.14 | iec_tea (bleach) 0.00346/0.0336 mg |
| B | cup_1 (interior) | 0.049 | 0.551 | 278 | 28.9 | 1 | 1 | 11.6 | 53.5 | 1.32 | 0 | 9.4e-4 mL, full for 0 s | 5 | 0 | 0 | 0.572 | iec_tea (bleach) 0.0346/0.0346 mg |
| B | cup_2 (interior) | 0.00245 | 0.482 | 291 | 27.8 | 0.999 | 1 | 0.436 | 5.67 | 0.456 | 0 | 0.994 mL, full for 5749 s | 5 | 0 | 0.994 | 1.14 | iec_tea (bleach) 0.0336/0.0336 mg |

### P29 Ageing of the soil before the wash: too small

Test: A dessert plate with egg yolk in the lower basket at three ageing levels: fresh (A, 15 min), oven-dried 2 h at 80 C (B), baked on at 125 C (C).

Adapted: One plate instead of a load; the baked level is the heat history `cooked` of the soil model (125 C), the nearest to 130 to 140 C.

Stages: soil: hydration (lag), bake index, removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| fresh | IEC score of the fresh plate, as a distance from 4.5 to 5 (A) |  |  | -4.5 score | crockery mean at least 4.5 fresh | within 1 of the range | too small |
| dried | IEC score of the oven-dried plate, as a distance from 2.3 to 3.7 (B) |  |  | -2.3 score | crockery 2.3 to 3.7 oven-dried | within 1 of the range | too small |
| baked | IEC score, baked minus oven-dried | 0 | 0 | 0 score | at least 1 point lower again for 130 to 140 C baking | -0 to -5 | too small |
| order (supporting) | share of the egg yolk left, baked minus fresh | 0.396 | 0.792 | 0.396 1 | ageing leaves more | +0.01 or more | pass |

- **A**: fresh. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0556 mmol/L (peak 0.325). Result `sha256:aa3582e06eb1`, 1.6 s (exposure cached).
- **B**: oven-dried 2 h at 80 C. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3956fc441a04`, 0.2 s (exposure cached).
- **C**: baked on at 125 C. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:76324521b4e0`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 7248 | 0 | 0.81 | iec_egg_yolk (reaction) 421/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8808 | 0 | 0.81 | iec_egg_yolk (reaction) 816/1063 mg |
| C | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8811 | 0 | 0.81 | iec_egg_yolk (reaction) 842/1063 mg |

### P30 Protein soil responds to hit frequency and chemistry, not to jet strength: pass

Test: A dessert plate with egg yolk at a fixed position in the lower basket: pump speed of the main wash -30 % (A) and +30 % (B); protease dose -50 % (C) and +50 % (D).

Adapted: A plate stands in for the tiles. The pump speed is changed in the steps of the main wash of the Auto programme (3000 rpm to 2100 and 3900 rpm); the enzyme dose by `liq.xProtease`.

Stages: soil: removal laws (reaction, jet assist), chemistry; water: hydraulics, jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pump | share of the egg yolk removed, pump +30 % minus pump -30 % | 0.273 | 0.175 | -0.0978 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 | pass |
| enzyme | share of the egg yolk removed, protease +50 % minus protease -50 % | 0.0106 | 0.146 | 0.135 1 | doubling enzyme level changes it clearly | +0.05 to +1 | pass |

- **A**: pump -30 %. Load `plate-facing`, programme `auto_145+pump70pct`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 53.9 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0285 g/L (peak 0.0986), peracid mean 0.0565 mmol/L (peak 0.325). Result `sha256:3460964b8eca`, 6 s.
- **B**: pump +30 %. Load `plate-facing`, programme `auto_145+pump130pct`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 55.1 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0254 g/L (peak 0.0986), peracid mean 0.0543 mmol/L (peak 0.324). Result `sha256:b52571ce3229`, 6.5 s.
- **C**: protease -50 %. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.005}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.00684 g/L (peak 0.0247), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:ee2d86e7a69e`, 0.2 s (exposure cached).
- **D**: protease +50 %. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.015}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0205 g/L (peak 0.074), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:fa6ad9e9b1e6`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00472 | 0.529 | 184 | 18.4 | 1 | 1 | 4.4 | 25.2 | 1.08 | 0 |  | 0 | 8798 | 0 | 0.81 | iec_egg_yolk (reaction) 773/1063 mg |
| B | plate (well) | 0.00672 | 0.623 | 317 | 31.9 | 1 | 1 | 6.86 | 34.1 | 1.29 | 0 |  | 0 | 8812 | 0 | 0.81 | iec_egg_yolk (reaction) 877/1063 mg |
| C | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8812 | 0 | 0.81 | iec_egg_yolk (reaction) 1051/1063 mg |
| D | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8812 | 0 | 0.81 | iec_egg_yolk (reaction) 908/1063 mg |

### P31 Starch is bimodal: too small

Test: Twelve soup plates with oat porridge in the lower basket; the histogram of their IEC scores.

Adapted: Eleven in every second slot of the rear lane and one in the left front lane, settled by the loading physics.

Stages: soil: hydration, removal laws (starch), inspection.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clusters | share of the plates scoring 5 or 0 to 1 |  |  | 0.917 1 | porridge-plate scores cluster at 5 and at 0 to 1 | +0.6 to +1 | pass |
| both | share of the plates in the smaller of the two clusters |  |  | 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more | too small |

- **A**: twelve porridge plates. Load `soup-12`, programme `auto_145`, 12 items (0 clean, mean score of the soiled 0.917), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0555 mmol/L (peak 0.325). Result `sha256:9076710d4c0b`, 18.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_6 (well) | 0.00188 | 0.242 | 184 | 23.7 | 1 | 1 | 2.15 | 15 | 0.831 | 0 |  | 1 | 57.8 | 0 | 1.36 | iec_oat_flakes (reaction) 0.628/232 mg |

### P32 Microwaved milk on glass is persistent: too small

Test: Four test glasses with microwaved milk in the upper basket with detergent D on the Auto programme (A), on the long eco programme (B), and with a detergent of twice the enzyme and half the silicate (C).

Adapted: The registry defaults are IEC detergent D. The ingredient table of detergent E is not in the dossiers ("upgraded enzymes, less silicate"), so C is an assumed composition and decides nothing; the eco programme, which the entry names beside E, is the deciding comparison.

Stages: soil: chemistry (alkalinity, enzyme), removal laws; water: jets into the glass.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the glasses with detergent D, as a distance from 2.3 to 2.4 (A) |  |  | -2.3 score | glass class 2.3 to 2.4 with detergent D on the reference machines | within 1 of the range | too small |
| eco | mean IEC score of the glasses, eco minus Auto | 0 | 0 | 0 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 | too small |
| e_like (supporting) | mean share of the milk left, E-like minus D | 0.989 | 0.99 | 0.00167 1 | upgraded enzymes remove more | -0.01 or more | wrong sign |

- **A**: detergent D, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b5e5778755c4`, 16.6 s.
- **B**: detergent D, Eco 50. Load `glasses-milk`, programme `eco_50`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.7 (max 11.3), protease mean 0.0744 g/L (peak 0.11), peracid mean 0.0692 mmol/L (peak 0.323). Result `sha256:16de9a81e6e8`, 0.9 s (exposure cached).
- **C**: assumed E-like detergent, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.02,"liq.xAmylase":0.01,"liq.xSilicate":0.275}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.2 (max 10.8), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0563 mmol/L (peak 0.33). Result `sha256:66844bcdcb0f`, 0.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (interior) | 0.0122 | 0.456 | 421 | 26.4 | 1 | 1 | 6.16 | 37.8 | 1.1 | 0 |  | 0 | 10707 | 0 | 0.825 | ikw_milk_microwaved (reaction) 5211/5270 mg |
| B | glass_1 (interior) | 0.0123 | 0.456 | 421 | 26.8 | 1 | 1 | 6.23 | 38.1 | 1.1 | 0 |  | 0 | 10645 | 0 | 0.825 | ikw_milk_microwaved (reaction) 3590/5270 mg |
| C | glass_1 (interior) | 0.0122 | 0.456 | 421 | 26.4 | 1 | 1 | 6.16 | 37.8 | 1.1 | 0 |  | 0 | 10707 | 0 | 0.825 | ikw_milk_microwaved (reaction) 5219/5270 mg |

### P33 Fat needs temperature and enough water: too small

Test: A porcelain and a melamine dessert plate with fresh margarine in the lower basket, with the main wash of the Auto programme heated to 35 (A), 45 (B) and 55 C (C).

Adapted: The target of the main wash is changed in the steps of the Auto programme; everything else of the programme stays.

Stages: soil: removal laws (melt, roll-up by substrate), liquor (temperature course).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| warm | IEC score of the porcelain plate at 55 C, as a distance from 4 to 5 (C) |  |  | 0 score | margarine platter cleans easily at 50 C | within 1 of the range | pass |
| temperature | share of the margarine left on the two plates, 35 C minus 55 C | 4.8e-10 | 2.7e-6 | 2.7e-6 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more | too small |
| plastic (supporting) | share of the margarine left at 45 C, melamine minus porcelain (B) |  |  | 1.1e-7 1 | greasy residue most visibly on plastic | +0.01 or more | too small |

- **A**: main wash at 35 C. Load `dplate-lower`, programme `auto_145+wash35C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 100 min with detergent, mean 40.4 C (max 66.8 C), pH 10.5 (max 11.2), protease mean 0.048 g/L (peak 0.139), peracid mean 0.129 mmol/L (peak 0.328). Result `sha256:0b85872a9329`, 0.3 s (exposure cached).
- **B**: main wash at 45 C. Load `dplate-lower`, programme `auto_145+wash45C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 104 min with detergent, mean 45 C (max 66.8 C), pH 10.4 (max 11.1), protease mean 0.0494 g/L (peak 0.137), peracid mean 0.105 mmol/L (peak 0.323). Result `sha256:8ab1fa10f101`, 0.3 s (exposure cached).
- **C**: main wash at 55 C. Load `dplate-lower`, programme `auto_145+wash55C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 109 min with detergent, mean 49.7 C (max 66.8 C), pH 10.4 (max 10.9), protease mean 0.0465 g/L (peak 0.115), peracid mean 0.0762 mmol/L (peak 0.323). Result `sha256:1c168f6f62c5`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0112 | 0.765 | 236 | 23.9 | 1 | 1 | 7.11 | 36 | 1.3 | 0 |  | 5 | 0 | 0 | 0.794 | iec_margarine (melt) 7.2e-10/2125 mg |
| A | melamine (well) | 0.0018 | 0.228 | 52.1 | 21 | 1 | 1 | 3.82 | 58 | 1.75 | 0 |  | 5 | 0 | 0 | 0.276 | iec_margarine (melt) 0.011/2008 mg |
| B | plate (well) | 0.0112 | 0.765 | 236 | 23.9 | 1 | 1 | 7.11 | 36 | 1.3 | 0 |  | 5 | 0 | 0 | 0.794 | iec_margarine (melt) 4.7e-13/2125 mg |
| B | melamine (well) | 0.00179 | 0.228 | 52.1 | 21.1 | 1 | 1 | 3.83 | 58 | 1.75 | 0 |  | 5 | 0 | 0 | 0.276 | iec_margarine (melt) 2.3e-4/2008 mg |
| C | plate (well) | 0.0112 | 0.765 | 236 | 24 | 1 | 1 | 7.13 | 36 | 1.3 | 0 |  | 5 | 0 | 0 | 0.794 | iec_margarine (melt) 3.4e-17/2125 mg |
| C | melamine (well) | 0.00179 | 0.228 | 52.1 | 21.1 | 1 | 1 | 3.84 | 58 | 1.75 | 0 |  | 5 | 0 | 0 | 0.276 | iec_margarine (melt) 1.9e-6/2008 mg |

### P34 Thick layers detach as flakes: not covered

Test: A dessert plate with egg yolk at 5 (A) and 10 mg/cm2 dry (B).

Adapted: One plate; 5 and 10 mg/cm2 dry on 60 % of the well are 0.93 g and 1.85 g of yolk as applied.

Stages: soil: removal laws (cohesive failure and flakes, not built). Note: needs detachment of thick layers as flakes.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| flakes | soil that left as flakes, thick minus thin |  |  |  | thick egg yolk partly tended to flake off | + (any size) | not covered: needs detachment of thick layers as flakes |
| residue (supporting) | share of the egg yolk left, thick minus thin | 0.502 | 0.749 | 0.246 1 | the thicker layer takes longer | +0.01 or more | pass |

- **A**: 5 mg/cm2 dry. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:00c39224c4be`, 0.3 s (exposure cached).
- **B**: 10 mg/cm2 dry. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:95c884a55a39`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8142 | 0 | 0.81 | iec_egg_yolk (reaction) 247/492 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8805 | 0 | 0.81 | iec_egg_yolk (reaction) 736/983 mg |

### P35 Pot interiors: wrong sign

Test: A 17 cm steel saucepan with burnt-on milk on its inner bottom and wall in the lower basket: mouth down on the rear rows (A) against lying on its side (B).

Adapted: Both poses are dropped and settled by the loading physics; the pan on its side rolls about 10 cm before it rests.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | IEC score of the pot mouth down, as a distance from 2.5 to 4.0 (A) |  |  | -2.5 score | pots class 2.5 with detergent D to 4.0 with E | within 1 of the range | too small |
| side | share of the soil left in the pot, on its side minus mouth down | 0.883 | 0.791 | -0.0913 1 | on its side, half the wall is shadowed | +0.01 or more | wrong sign |
| ranking (supporting) | share left on the inner wall minus on the inner bottom, mouth down (A) |  |  | -0.0812 1 | inverted, the bottom is hit directly (the ranking is a calibration target) | +0.01 or more | wrong sign |

- **A**: mouth down. Load `pot-inverted`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:afe272c3e15c`, 18.8 s.
- **B**: on its side. Load `pot-on-side`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:4498051dd02c`, 13.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot (interior_base) | 0.039 | 0.976 | 219 | 31.9 | 0.545 | 1 | 5.42 | 20.1 | 0.336 | 0 |  | 0 | 34177 | 0 | 0.886 | milk_burnt (reaction) 1824/1976 mg; milk_burnt (reaction) 1677/1992 mg |
| A | pot (interior_wall) | 0.00472 | 0.408 | 380 | 29.4 | 0.82 | 1 | 21.3 | 60 | 1.48 | 0 |  | 0 | 34177 | 0 | 0.886 | milk_burnt (reaction) 1824/1976 mg; milk_burnt (reaction) 1677/1992 mg |
| B | pot (interior_base) | 0 | 0 | 0 | 0 | 1 | 1 | 9.87 | 49.3 | 1.23 | 0.943 | 1003 mL, full for 5694 s | 0 | 34170 | 1003 | 1.03 | milk_burnt (reaction) 1622/1976 mg; milk_burnt (reaction) 1517/1992 mg |
| B | pot (interior_wall) | 0 | 0 | 0 | 0 | 1 | 1 | 2.71 | 33.3 | 1.17 | 0.435 | 1003 mL, full for 5694 s | 0 | 34170 | 1003 | 1.03 | milk_burnt (reaction) 1622/1976 mg; milk_burnt (reaction) 1517/1992 mg |

### P36 Water pools in the base recess of inverted cups and mugs: pass

Test: A ceramic mug mouth down on a level support: the rear cup shelf of the upper basket folded down.

Adapted: The cup shelf of the Bosch is the level support; the mug is dropped onto it and settles. The expected volume is the checklist's formula for the recess of the catalogue's mug (28 mm radius, 2.5 mm deep).

Stages: water: scene (basins), run-off, pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pool | water standing in the base recess at the end |  |  | 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 | pass |
| drying (supporting) | drying score of the mug |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b4b020e91086`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.3e-4 | 0.223 | 33.9 | 18 | 0.998 | 1 | 0.386 | 5.62 | 0.336 | 0.479 | 5 mL, full for 5750 s | 5 | 0 | 5 | 3.08 |  |

### P37 Tilt drains the recess: too small

Test: The mug of P36 at 0 (A), 7 (B), 15 (C) and 30 degrees (D) of tilt.

Adapted: The tilts are set, not settled: the mug is turned about a horizontal axis and kept standing on the height of its lowest point; the runner checks that it cuts into nothing. The checklist's volumes are for a recess of 25 mm radius and 3 mm depth; the expected values here are its formulas evaluated for the recess of the catalogue's mug (28 mm, 2.5 mm), as shares of the level volume.

Stages: water: scene (basins, minimum basin volume), pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| tilt7 | water in the recess at 7 degrees over level | 5 | 0.418 | 0.0836 1 | the wedge formula: 1.4 of 5.9 mL at 7 degrees for the checklist's recess; 0.92 of 6.2 mL for this mug's | +0.0744 to +0.298 | pass |
| tilt15 | water in the recess at 15 degrees over level | 5 | 0.111 | 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 | too small |
| tilt30 (supporting) | water in the recess at 30 degrees over level | 5 | 0 | 0 1 | the wedge formula: 0.13 of 5.9 mL at 30 degrees for the checklist's recess; 0.09 of 6.2 mL for this mug's | +0.0073 to +0.0292 | too small |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b4b020e91086`, 1.5 s (exposure cached).
- **B**: tilted 7 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:fef8b21090b5`, 13.5 s.
  - set pose: deepest overlap 0.01 mm (mug into upper_rack_fittings)
- **C**: tilted 15 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:91dc6ed2f81c`, 16.7 s.
- **D**: tilted 30 degrees. Load `mug-on-shelf`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:8c2c63fec2f5`, 13.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.3e-4 | 0.223 | 33.9 | 18 | 0.998 | 1 | 0.386 | 5.62 | 0.336 | 0.479 | 5 mL, full for 5750 s | 5 | 0 | 5 | 3.08 |  |
| B | mug (foot) | 3.7e-4 | 0.149 | 21.2 | 14.5 | 1 | 1 | 0.366 | 4.46 | 0.336 | 0.106 | 0.418 mL, full for 5754 s | 5 | 0 | 0.418 | 0.786 |  |
| C | mug (foot) | 3.8e-4 | 0.106 | 27.5 | 16.3 | 1 | 1 | 0.338 | 4.08 | 0.354 | 0.0638 | 0.111 mL, full for 5755 s | 5 | 0 | 0.111 | 0.741 |  |
| D | mug (foot) | 4.9e-4 | 0.149 | 31.4 | 18.5 | 1 | 1 | 1.26 | 10.9 | 0.57 | 0 | 0.0257 mL, full for 0 s | 5 | 0 | 0 | 0.664 |  |

### P38 Plastic stays wet: not covered

Test: A melamine and a porcelain dessert plate of the same shape side by side in the lower basket.

Adapted: None.

Stages: drying (not built); water: run-off (beads on plastic) gives the film it would start from. Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), melamine minus porcelain |  |  |  | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film per area at the end of the last rinse, melamine over porcelain, minus one |  |  | -0.665 1 | water beads on plastic and stays | +0.05 or more | wrong sign |

- **A**: side by side. Load `dplate-lower`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b0bb2d72c385`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate | 0.0113 | 0.723 | 429 | 25.7 | 1 | 1 | 7.61 | 32.6 | 1.12 | 0 |  | 5 | 0 | 0 | 0.794 |  |
| A | melamine | 0.0159 | 0.627 | 357 | 26.1 | 1 | 1 | 10.6 | 63.1 | 1.66 | 0 |  | 5 | 0 | 0 | 0.276 |  |

### P39 Pots and large hollow ware stay wet: not covered

Test: A saucepan mouth down in the lower basket (A) against a dessert plate on edge (B).

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), pot minus plate |  |  |  | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water the pot keeps at the end (pools and film) against the plate | 0.886 | 0.794 | 0.0915 g | rims that hold water, large wetted area | + (any size) | pass |

- **A**: saucepan. Load `pot-inverted`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:8abade0c1f54`, 0.3 s (exposure cached).
- **B**: plate. Load `dplate-lower`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:b0bb2d72c385`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot | 0.00979 | 0.441 | 383 | 31.9 | 0.871 | 1 | 12.9 | 58.4 | 1.36 | 0 |  | 5 | 0 | 0 | 0.886 |  |
| B | plate | 0.0113 | 0.723 | 429 | 25.7 | 1 | 1 | 7.61 | 32.6 | 1.12 | 0 |  | 5 | 0 | 0 | 0.794 |  |

### P40 Liquid held at contact points and in narrow gaps: pass

Test: Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B).

Adapted: Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.

Stages: water: scene (contacts), run-off (bridges, retained water).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| held | water left on the two glasses at the end of the last rinse (film and pools), B - A | 1.31 | 1.54 | 0.229 g | a wet mark at every touching pair | + (any size) | pass |
| marks (supporting) | residue marks at the contact (B) |  |  |  | a residue line at every touching pair | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: apart. Load `glasses-apart`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:9f5669b2b226`, 22.7 s.
- **B**: touching. Load `glasses-touching`, programme `auto_145`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:5e4f91ccceeb`, 28.4 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (exterior) | 0.00481 | 0.484 | 393 | 23.6 | 1 | 1 | 2.45 | 17.7 | 0.894 | 0 |  | 5 | 0 | 0 | 0.623 |  |
| A | glass_2 (exterior) | 0.00361 | 0.556 | 229 | 23.3 | 1 | 1 | 3.75 | 23.8 | 1.06 | 0 |  | 5 | 0 | 0 | 0.684 |  |
| B | glass_1 (exterior) | 0.00363 | 0.424 | 295 | 23 | 1 | 1 | 1.88 | 14.7 | 0.833 | 0 |  | 5 | 0 | 0 | 0.79 |  |
| B | glass_2 (exterior) | 0.00418 | 0.539 | 251 | 23.8 | 1 | 1 | 3.3 | 21.7 | 0.99 | 0 |  | 5 | 0 | 0 | 0.746 |  |

### P41 Light plastic items are moved or flipped by jets: not covered

Test: A 20 g polypropylene container lid lying hollow side down in the lower basket (A) against the upper basket (B).

Adapted: The lightest lid of the catalogue weighs 20 g, not 15 g. In the lower basket it comes to rest on the cutlery basket and the left front tines.

Stages: rigid-body coupling during the wash (not built); water: jets (the lift ratio is reported). Note: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| moved | distance the jets move the lid in the lower basket |  |  |  | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) | not covered: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) |
| lift (supporting) | peak upward jet force on the lid over its weight, lower basket (A) |  |  | 3.95 1 | 0.08 to 0.30 N per jet against the weight of a 20 g lid | +0.2 to +3 | too large |
| upper (supporting) | that ratio, upper basket minus lower basket | 3.95 | 2.58 | -1.37 1 | the advice is to put light plastics in the top rack | -0.01 or more | pass |

- **A**: lower basket. Load `lid-lower`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:8866fb0ff2e8`, 14.9 s.
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 3.95 of its weight); it is simulated where it was placed
- **B**: upper basket. Load `lid-upper`, programme `auto_145`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:1cb5b5f2d453`, 17.4 s.
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 2.58 of its weight); it is simulated where it was placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | lid | 0.0191 | 0.392 | 218 | 31.9 | 1 | 1 | 13.5 | 49.9 | 0.923 | 0 |  | 5 | 0 | 0 | 1.23 |  |
| B | lid | 0.0352 | 0.422 | 289 | 27.8 | 0.998 | 1 | 19.6 | 92.3 | 2 | 0.035 | 6.05 mL, full for 5749 s | 5 | 0 | 6.1 | 1.45 |  |

### P42 Cutlery dries almost completely (negative control): not covered

Test: The cutlery of the IEC load.

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | points of the 0 to 1 drying scale the cutlery loses |  |  |  | drying 0.99 | |x| <= 0.04 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water standing in a piece of cutlery at the end, mean |  |  | 0 mL | it drains along its length | |x| <= 0.1 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.61), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:e10bfd637aab`, 4.9 s (exposure cached).

### P43 Spots, film and tine marks on glass: not covered

Test: A test glass in the upper basket with rinse aid (A) and without (B).

Adapted: The wash has no input for water hardness or for running without rinse aid; B is washed as A until it has, and the scenario is reported as not covered.

Stages: drying and spotting (not built). Note: needs spots and film from evaporated water, and marks at contacts.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spots | spots on the glass, without rinse aid minus with |  |  |  | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: with rinse aid. Load `glass-free`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3737ba111790`, 20.8 s.
- **B**: without rinse aid. Load `glass-free`, programme `auto_145`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3737ba111790`, 20.8 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass | 0.00413 | 0.488 | 327 | 25.1 | 1 | 1 | 2.92 | 18 | 0.857 | 0 |  | 5 | 0 | 0 | 0.693 |  |
| B | glass | 0.00413 | 0.488 | 327 | 25.1 | 1 | 1 | 2.92 | 18 | 0.857 | 0 |  | 5 | 0 | 0 | 0.693 |  |

### P44 Cutlery comes out clean although it is the most shadowed class: too small

Test: The IEC load of 13 place settings, loaded carefully, on the Auto programme; class mean of the soiled cutlery.

Adapted: The pieces of the load that the careful loading policy fits into the machine as modelled (about 100 of 140).

Stages: water: droplets, run-off in the cutlery basket; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the soiled cutlery, as a distance from 4.6 to 4.8 |  |  | -2.63 score | class mean 4.6 to 4.8 | within 1 of the range | too small |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.61), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:e10bfd637aab`, 4.9 s (exposure cached).

### P45 Class ranking in the standard test: wrong sign

Test: The IEC load on the Auto programme: mean scores of cutlery, melamine, glass and crockery, and overall.

Adapted: The pieces that fit (about 100 of 140); the load has no pots (the loader left them out), so that class is not scored.

Stages: the whole wash.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| overall | load mean IEC score, as a distance from 3.5 to 4.2 |  |  | -1.89 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range | too small |
| crockery | crockery mean, as a distance from 2.3 to 3.7 |  |  | -0.3 score | crockery 2.3 to 3.7 | within 1 of the range | pass |
| glass | glass mean, as a distance from 2.3 to 4.0 |  |  | -2.3 score | glass 2.3 to 4.0 | within 1 of the range | too small |
| ranking | cutlery mean minus crockery mean |  |  | -0.0256 score | cutlery > melamine > (pots, glass, crockery) | + (any size) | wrong sign |
| melamine (supporting) | melamine mean minus crockery mean |  |  | -2 score | melamine above crockery | + (any size) | wrong sign |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.61), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:e10bfd637aab`, 4.9 s (exposure cached).

### P46 Run-to-run repeatability: too small

Test: The IEC load washed with three seeds (level seed and simulation seed 1, 2 and 3); standard deviation of the load mean score.

Adapted: Three seeds. The seeds move the phase origin of the arms, the sampling of the droplets, and where on a region each soil lies and how thick; the tablet release time and the sensor decisions of the machine are fixed.

Stages: the whole wash (seeded sampling).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spread | standard deviation of the load mean IEC score over the three seeds |  |  | 0.0103 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 | too small |

- **A**: seeds 1. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.61), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:e10bfd637aab`, 4.9 s (exposure cached).
- **B**: seeds 2. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.59), seeds 2/2. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:806a56281109`, 27.4 s.
- **C**: seeds 3. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (41 clean, mean score of the soiled 1.62), seeds 3/3. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:f476d6b08897`, 31 s.

### P47 Everything is wetted within seconds; jets are rare events: pass

Test: The IEC load on the Auto programme: the share of the surface of the load that is wetted, and the fraction of time under a direct jet.

Adapted: The time-resolved first wetting is not recorded by the exposure (it stores the periodic state); what is checked is the wetted share in the periodic state and the water returning to the sump within a revolution.

Stages: water: jets, droplets, run-off.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | largest fraction of time under a direct jet of any item of the load (mean over its surface) |  |  | 0.0242 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 | pass |
| wetted | share of the surface of the load that no spray state wets |  |  | 0.00235 1 | everything is wetted | |x| <= 0.2 | pass |
| circuit (supporting) | share of the nozzle outflow not back in the sump within one revolution of the arm (largest of the spray states) |  |  | 0.0055 1 | water circuit under 3 s (a revolution takes 1.4 to 2.2 s) | |x| <= 0.5 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `auto_145`, 104 items (40 clean, mean score of the soiled 1.61), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0274 g/L (peak 0.0986), peracid mean 0.0537 mmol/L (peak 0.322). Result `sha256:e10bfd637aab`, 4.9 s (exposure cached).

### P48 Detergent does not change where water goes: pass

Test: A dessert plate in the lower basket washed with detergent (A) and with the dispenser blocked, so without any (B); the exposure of the two washes.

Adapted: The exposure of the simulation is computed for one liquor class and does not read the detergent at all, so this holds by construction: the check guards that it stays so.

Stages: water: jets (the exposure key excludes the liquor).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| jets | spray states whose exposure differs between the two washes |  |  | 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 | pass |

- **A**: with detergent. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10.3 (max 10.9), protease mean 0.0273 g/L (peak 0.0986), peracid mean 0.0557 mmol/L (peak 0.325). Result `sha256:3956fc441a04`, 0.2 s (exposure cached).
- **B**: without detergent. Load `plate-facing`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 120 min with detergent, mean 56.2 C (max 69 C), pH 9.81 (max 10.3), protease mean 0.00515 g/L (peak 0.0171), peracid mean 0.00233 mmol/L (peak 0.0107). Result `sha256:09f4b17ff82c`, 0.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8808 | 0 | 0.81 | iec_egg_yolk (reaction) 816/1063 mg |
| B | plate (well) | 0.00605 | 0.597 | 196 | 24.1 | 1 | 1 | 5.6 | 29.8 | 1.2 | 0 |  | 0 | 8812 | 0 | 0.81 | iec_egg_yolk (reaction) 1060/1063 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received; `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

