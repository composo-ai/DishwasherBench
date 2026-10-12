# Phenomena suite: fast tier, packages/calibration/anchors/anchored-v5.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.5.0 water-6`; parameters packages/calibration/anchors/anchored-v5.owner-capsule.json (hydro `sha256:7c3bd46790e7`, soil `sha256:4e8965089aed`, 17 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `62685321c63be04e`. Exposure traced on: gpu. 48 phenomena, 82 washes (82 with cached exposure), 125.7 s.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). How often its verdicts differ from the official wash has not been measured for these parameters.

Verdicts: 15 pass, 2 wrong sign, 17 too small, 4 too large, 9 not covered, 1 error.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | retained: 0.444 -> 253: 253 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.1e-4 -> 1.5e-4: 0.366 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P03 | Plate pitch too small | too small | halving: 0 -> 0: 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |
| P04 | Nesting or "spooning" of like items | too small | residue: 0.0923 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 |
| P05 | Large flat item shadows what is behind or above it | error | score: 0 -> 0: 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P06 | Spray arm stalled by an item | too small | score: 0.143 -> 0.143: 0 score | mean score of that rack -1.5 or more | -0.5 to -5 |
| P07 | Radial position: centre against corner | too small | score: 0 -> 0: 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 |
| P08 | Left/right asymmetry with rotation direction | pass | score: 0 -> 0: 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 |
| P09 | Lean direction of plates | too small | score: 0 -> 0: 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 |
| P10 | Tall narrow vessel interior | wrong sign | residue: 1.2e-4 -> 1.7e-9: -1.2e-4 1 | the interior of the tall vessel is the last place to clean | +0.01 or more |
| P11 | Upper against lower rack for tenacious soil | pass | score: 0 -> 0: 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 |
| P12 | Alternating large and small plates | too small | score: 0 -> 0: 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 |
| P13 | Glass or cup placed over tines | too small | f_jet: 0.012 -> 0.0116: -0.0338 1 | interior f_jet reduced | -0.05 or more |
| P14 | Soiled face against the tub wall or door liner | pass | f_jet: 0.0076 -> 0: 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P15 | Nested spoons | too large | shielded: 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P16 | Heads up against heads down (not nested) | pass | score: 0 -> 0: 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 |
| P17 | Crowded basket cells | too small | crowding: 0 -> 0: 0 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 |
| P18 | Cutlery tray against basket | pass | water: 0 -> 2.02: 2.02 mL | spoon bowls facing up hold water | + (any size) |
| P19 | Loading beyond rated capacity | wrong sign | mean: 2.9 -> 2.9: 0.00417 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 |
| P20 | Total soil load | too small | mean: 3 -> 3: 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 |
| P21 | Redeposition of particulates | not covered | specks: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 |
| P22 | Clean neighbours of soiled items | pass | clean: 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 |
| P23 | End-of-cycle drips from the upper rack | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 |
| P24 | Arrangement does not matter for easy soils (negative control) | pass | range: 0.174 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 |
| P25 | Detergent dispenser blocked | too large | tea: 0.257 1 | tea stays | |x| <= 0.2 |
| P26 | Tablet trapped or dissolving in a dead spot | not covered | score: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) | similar to under-dosing; size unknown: calibration parameter | - (any size) |
| P27 | Time and temperature trade | too small | score: 0 -> 0: 0 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 |
| P28 | Bleachable stains are position-insensitive (negative control) | pass | position: -1 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 |
| P29 | Ageing of the soil before the wash | too small | fresh: -3.5 score | crockery mean at least 4.5 fresh | within 1 of the range |
| P30 | Protein soil responds to hit frequency and chemistry, not to jet strength | pass | pump: 0.955 -> 0.957: 0.00254 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 |
| P31 | Starch is bimodal | too small | both: 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more |
| P32 | Microwaved milk on glass is persistent | too large | eco: 0.25 -> 5: 4.75 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 |
| P33 | Fat needs temperature and enough water | too small | temperature: 4.4e-16 -> 5.7e-10: 5.7e-10 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more |
| P34 | Thick layers detach as flakes | not covered | flakes: needs detachment of thick layers as flakes | thick egg yolk partly tended to flake off | + (any size) |
| P35 | Pot interiors | too small | side: 0 -> 0: 0 1 | on its side, half the wall is shadowed | +0.01 or more |
| P36 | Water pools in the base recess of inverted cups and mugs | pass | pool: 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 |
| P37 | Tilt drains the recess | too small | tilt15: 5 -> 0.111: 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 |
| P38 | Plastic stays wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 |
| P39 | Pots and large hollow ware stay wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 |
| P40 | Liquid held at contact points and in narrow gaps | pass | held: 2.27 -> 2.75: 0.482 g | a wet mark at every touching pair | + (any size) |
| P41 | Light plastic items are moved or flipped by jets | not covered | moved: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) |
| P42 | Cutlery dries almost completely (negative control) | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | drying 0.99 | |x| <= 0.04 |
| P43 | Spots, film and tine marks on glass | not covered | spots: needs spots and film from evaporated water, and marks at contacts | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) |
| P44 | Cutlery comes out clean although it is the most shadowed class | too small | class: -1.39 score | class mean 4.6 to 4.8 | within 1 of the range |
| P45 | Class ranking in the standard test | pass | overall: -0.6 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range |
| P46 | Run-to-run repeatability | too small | spread: 0.0314 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 |
| P47 | Everything is wetted within seconds; jets are rare events | pass | f_jet: 0.0209 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 |
| P48 | Detergent does not change where water goes | pass | jets: 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 |

## Phenomena

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

- **A**: mouth down. Load `hollow-inverted`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:09059e31c8b1`, 3 s (exposure cached).
- **B**: mouth up. Load `hollow-upright`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:10f41bd6bb75`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00927 | 0.711 | 329 | 27 | 1 | 1 | 2.89 | 23.3 | 0.811 | 0 | 0.444 mL, full for 7308 s | 0 | 280 | 0.444 | 2.46 | iec_tea (bleach) 0.228/5.77 mg |
| A | bowl (interior) | 0.122 | 0.933 | 272 | 25.8 | 1 | 1 | 15.6 | 64.1 | 1.45 | 0 |  | 5 | 0 | 0 | 1.94 | iec_oat_flakes (reaction) 0/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 0.607 | 5.66 | 0.491 | 0.882 | 253 mL, full for 6936 s | 0 | 9585 | 253 | 1.59 | iec_tea (bleach) 0.57/5.77 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 6.61 | 24.2 | 0.859 | 0.518 | 148 mL, full for 7292 s | 5 | 0 | 148 | 2.57 | iec_oat_flakes (reaction) 0/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate faces the axis tipped up with the tines. The pair of the first build that compared the seated plate with one put in reversed is gone: on the present basket the loader does not seat a reversed plate in that slot, and the seated plate turned round in place cuts 2 mm into the tines.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.1e-4 | 1.5e-4 | 0.366 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 0.0496 | 0.0601 | 0.0105 1 | removal depends on how often the spot is hit | +0.01 or more | pass |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:271b46eec7d5`, 1.5 s (exposure cached).
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:0e580e9d36d6`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.1e-4 | 0.337 | 264 | 32.5 | 1 | 1 | 4.49 | 31.3 | 1.07 | 0 |  | 0 | 2968 | 0 | 0.88 | iec_egg_yolk (reaction) 52.7/1063 mg |
| B | plate (well) | 1.5e-4 | 0.135 | 37.3 | 19 | 1 | 1 | 0.687 | 8.39 | 0.698 | 0 |  | 0 | 3449 | 0 | 0.877 | iec_egg_yolk (reaction) 63.8/1063 mg |

### P03 Plate pitch too small: too small

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot (about 7 mm between the pair, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become two plates to a slot, every slot and every second slot. Seven plates per row (eight when crowded). All rows are settled by the loading physics; the crowded row has pairs in slots 2, 4, 6 and 8, so the covered plate of a pair has its face about 7 mm behind its partner while the partner faces an open slot.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 0 | 0 | 0 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | too small |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 0 | 0 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.0031 | 0 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:f8371b21cd6f`, 1.7 s (exposure cached).
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `eco_50`, 8 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.115), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:353a81c7664d`, 3.3 s (exposure cached).
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:f762ae46359f`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.0031 | 0.451 | 67 | 17.8 | 1 | 1 | 1.16 | 12.2 | 0.8 | 0 |  | 0 | 679 | 0 | 1.65 | iec_egg_yolk (reaction) 7.76/1527 mg |
| B | plate_6 (well) | 0 | 0 | 0 | 0 | 0.957 | 0.975 | 0.0471 | 0.22 | 0.269 | 0 |  | 0 | 15245 | 0 | 9.45 | iec_egg_yolk (reaction) 1042/1605 mg |
| C | plate_4 (well) | 0.00666 | 0.46 | 182 | 19.9 | 1 | 1 | 2.23 | 18.4 | 0.957 | 0 |  | 0 | 496 | 0 | 1.65 | iec_egg_yolk (reaction) 5.61/1527 mg |

### P04 Nesting or "spooning" of like items: too small

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 0.0923 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 0 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | pass |
| against (supporting) | share of the porridge left inside that bowl, B - A | 0 | 0.0923 | 0.0923 1 | nesting leaves more | +0.01 or more | pass |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0698 | 1.6e-7 | 2.3e-6 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:a935ebb3d06c`, 1.6 s (exposure cached).
- **B**: nested. Load `bowls-nested`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:f5025bdda971`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0698 | 0.908 | 301 | 26.9 | 1 | 1 | 10.5 | 49 | 1.25 | 0 |  | 5 | 0 | 0 | 1.93 | iec_oat_flakes (reaction) 0/177 mg |
| B | bowl_over (interior) | 1.6e-7 | 3.3e-4 | 15.2 | 14.3 | 1 | 1 | 0.00458 | 0.191 | 0.0916 | 0 |  | 0 | 2986 | 0 | 2.08 | iec_oat_flakes (reaction) 16.4/177 mg |

### P05 Large flat item shadows what is behind or above it: error

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws. Note: wash B: the set pose cuts 2.0 mm (board into plate_2).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 0 | 0 | 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | too small |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 7.9e-5 | 4.6e-5 | -0.416 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `eco_50`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:765d5be1bb33`, 1.8 s (exposure cached).
- **B**: platter upright between the plates and the arm axis (set pose). Load `board-side`, programme `eco_50`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:a0cc40b6bb7f`, 1.7 s (exposure cached).
  - set pose: deepest overlap 2.04 mm (board into plate_2)
  - wash: placement: board stands in the path of the upper spray arm, which is simulated turning through it; give stalledArms for this level to hold the arm
  - wash: placement: board cuts 2.0 mm into plate_2; both are simulated where they were placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 8.6e-5 | 0.0787 | 245 | 31 | 1 | 1 | 1.81 | 15.5 | 0.902 | 0 |  | 0 | 1971 | 0 | 1.03 | iec_egg_yolk (reaction) 30.5/985 mg |
| A | plate_2 (well) | 7.3e-5 | 0.0986 | 42 | 23.1 | 1 | 1 | 3.54 | 23.8 | 1.1 | 0 |  | 0 | 1428 | 0 | 1.03 | iec_egg_yolk (reaction) 20.8/969 mg |
| B | plate_1 (well) | 8.6e-5 | 0.0787 | 245 | 31 | 1 | 1 | 1.83 | 15.4 | 0.89 | 0 |  | 0 | 2065 | 0 | 1.04 | iec_egg_yolk (reaction) 32.3/985 mg |
| B | plate_2 (well) | 6.9e-6 | 0.0295 | 33 | 22.9 | 1 | 1 | 1.48 | 9.84 | 1.02 | 0 |  | 0 | 1540 | 0 | 1.84 | iec_egg_yolk (reaction) 23.4/969 mg |

### P06 Spray arm stalled by an item: too small

Test: Seven IEC dinner plates with egg yolk in every second slot of the rear lane (A); the same with a ladle let down through the floor of the lower basket until it hangs in the path of the lower arm (B).

Adapted: A ladle stands in for the fork: a fork slips through the floor grid of this basket and falls, a ladle hangs by its bowl. On the present basket the ladle no longer hangs through the floor, so the arm is held by the scenario at the angle the first build's check found (148 degrees round); the wash takes a held arm as it takes one a load stops.

Stages: load: session (mechanical check); water: hydraulics (stalled arm), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| coverage | share of the plates' faces ever under a direct jet, B over A | 0.408 | 0 | 0 1 | direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %) | |x| <= 0.2 | pass |
| score | mean IEC score of the plates of that rack, B - A | 0.143 | 0.143 | 0 score | mean score of that rack -1.5 or more | -0.5 to -5 | too small |

- **A**: arm free. Load `plates-36`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:f762ae46359f`, 3 s (exposure cached).
- **B**: lower arm held 148 degrees round (set: where the hanging ladle of the first build stopped it). Load `plates-36`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1, lower arm stopped. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0937 mmol/L (peak 0.446). Result `sha256:89c9965893a2`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00666 | 0.46 | 182 | 19.9 | 1 | 1 | 2.23 | 18.4 | 0.957 | 0 |  | 0 | 496 | 0 | 1.65 | iec_egg_yolk (reaction) 5.61/1527 mg |
| B | plate_4 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 1.14 | 12 | 0.849 | 0 |  | 0 | 662 | 0 | 1.65 | iec_egg_yolk (reaction) 7.59/1527 mg |

### P07 Radial position: centre against corner: too small

Test: Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle).

Adapted: The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.

Stages: water: hydraulics (nozzle positions), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate at the corner against the one at mid-radius | 0 | 0 | 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 | too small |
| dwell (supporting) | fraction of time the face is under a direct jet, corner over mid-radius, minus one | 0.0138 | 0.00976 | -0.293 1 | low radial locations are impacted for longer | -0.05 or more | pass |

- **A**: four soup plates. Load `soup-radial`, programme `eco_50`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0947 mmol/L (peak 0.446). Result `sha256:de1dcc04f701`, 2.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_1 (well) | 0.00237 | 0.364 | 207 | 21.7 | 1 | 1 | 4.91 | 28.7 | 0.972 | 0 |  | 0 | 1902 | 0 | 1.6 | iec_egg_yolk (reaction) 27.3/1478 mg |
| A | soup_2 (well) | 0.0138 | 0.709 | 204 | 21.5 | 1 | 1 | 5.63 | 31.9 | 1.09 | 0 |  | 0 | 2287 | 0 | 1.54 | iec_egg_yolk (reaction) 33.7/1574 mg |
| A | soup_3 (well) | 0.00976 | 0.669 | 333 | 29.5 | 1 | 1 | 4.7 | 27.1 | 0.967 | 0 |  | 0 | 2213 | 0 | 1.89 | iec_egg_yolk (reaction) 32.8/1552 mg |

### P08 Left/right asymmetry with rotation direction: pass

Test: Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis.

Adapted: The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.

Stages: water: hydraulics (nozzle directions, sense of rotation), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the right-hand plate minus the left-hand one | 0 | 0 | 0 score | expect a change of up to 1 between mirrored positions | |x| <= 2 | pass |
| jets (supporting) | fraction of time the face is under a direct jet, right over left, minus one | 0.00976 | 0.0161 | 0.647 1 | in one real arm a right-hand plate received five jets and its mirror image two | |x| <= 3 | pass |

- **A**: mirrored plates. Load `soup-radial`, programme `eco_50`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0947 mmol/L (peak 0.446). Result `sha256:de1dcc04f701`, 2.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_3 (well) | 0.00976 | 0.669 | 333 | 29.5 | 1 | 1 | 4.7 | 27.1 | 0.967 | 0 |  | 0 | 2213 | 0 | 1.89 | iec_egg_yolk (reaction) 32.8/1552 mg |
| A | soup_4 (well) | 0.0161 | 0.648 | 288 | 25.6 | 1 | 1 | 5.19 | 31.1 | 1.16 | 0 |  | 0 | 1154 | 0 | 1.38 | iec_egg_yolk (reaction) 15.3/1509 mg |

### P09 Lean direction of plates: too small

Test: A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up).

Adapted: The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.

Stages: water: jets (incidence), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 | too small |
| f_jet (supporting) | fraction of time the soiled face is under a direct jet, B over A, minus one | 0.00966 | 1.8e-4 | -0.981 1 | leaning away presents the back | -0.05 or more | pass |

- **A**: leaning toward the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:4b37534d1605`, 1.5 s (exposure cached).
- **B**: leaning away from the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:de0b1f8e0fb1`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00966 | 0.866 | 363 | 30.1 | 1 | 1 | 12 | 59.4 | 1.31 | 0 |  | 0 | 2527 | 0 | 0.982 | iec_egg_yolk (reaction) 43.5/1063 mg |
| B | plate (well) | 1.8e-4 | 0.141 | 42.7 | 20.8 | 1 | 1 | 1.99 | 16.5 | 0.943 | 0 |  | 0 | 2789 | 0 | 0.948 | iec_egg_yolk (reaction) 49.1/1063 mg |

### P10 Tall narrow vessel interior: wrong sign

Test: A 250 mL test glass (B) against a shallow dessert bowl (A), each with microwaved milk inside, mouth down at the same spot of the upper basket.

Adapted: Upper basket; both settle on the wires leaning on the same tine row.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws, chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| glass | IEC score of the glass, as a distance from the range 2.3 to 4.0 (B) |  |  | 1 score | standard glass class (baked milk) scores 2.3 to 4.0 | within 1 of the range | pass |
| residue | share of the milk left, glass minus bowl | 1.2e-4 | 1.7e-9 | -1.2e-4 1 | the interior of the tall vessel is the last place to clean | +0.01 or more | wrong sign |
| f_jet (supporting) | fraction of time the inside is under a direct jet, glass over bowl, minus one | 0.139 | 0.0125 | -0.91 1 | a 60 mm opening is under a nozzle for about 6 % of a revolution | -0.05 or more | pass |

- **A**: shallow bowl. Load `bowl-same-spot`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:ae7e8acc2f44`, 1.4 s (exposure cached).
- **B**: tall glass. Load `glass-between`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:f7a7d704dfa9`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl (interior) | 0.139 | 0.972 | 257 | 27 | 1 | 1 | 15 | 57.2 | 1.26 | 0 |  | 3 | 4.81 | 0 | 1.44 | iec_milk (reaction) 0.058/503 mg |
| B | glass (interior) | 0.0125 | 0.54 | 399 | 26.3 | 1 | 1 | 5.7 | 37.5 | 1.12 | 0 |  | 5 | 0 | 0 | 1.3 | iec_milk (reaction) 8.8e-7/528 mg |

### P11 Upper against lower rack for tenacious soil: pass

Test: The same dessert plate with egg yolk standing in the rear lane of the lower basket (A) and in the rows of the upper basket (B).

Adapted: The dessert plate is the largest plate the upper basket takes. In the upper rows it does not stand as in the lower ones: the loading physics leaves it leaning about 50 degrees against the tines, which is the pose washed.

Stages: water: hydraulics (flow per level), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 0 | 0 | 0 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 | pass |
| residue (supporting) | share of the egg yolk left, B - A | 0.033 | 0.049 | 0.0161 1 | little difference between the baskets | |x| <= 0.4 | pass |

- **A**: lower basket. Load `dplate-lower`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:3a50874e6e35`, 0.3 s (exposure cached).
- **B**: upper basket. Load `dplate-upper`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:b823862b86e4`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.0111 | 0.757 | 273 | 24.2 | 1 | 1 | 5.82 | 36 | 1.31 | 0 |  | 0 | 2094 | 0 | 1.01 | iec_egg_yolk (reaction) 35/1063 mg |
| B | plate (well) | 5.8e-5 | 0.0832 | 35.8 | 19.3 | 1 | 1 | 1.28 | 12.9 | 0.837 | 0 |  | 0 | 2939 | 0 | 1.08 | iec_egg_yolk (reaction) 52.1/1063 mg |

### P12 Alternating large and small plates: too small

Test: Dinner plates with egg yolk in neighbouring slots of the rear lane (A) against dinner and dessert plates alternating at the same 18.25 mm pitch (B); the dinner plate at slot 5 is scored on its upper half.

Adapted: Pitch 18.25 mm (the tines of the Bosch) instead of 15 mm.

Stages: water: jets (gap geometry); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the upper half of the large plate at slot 5, B - A | 0 | 0 | 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 | too small |
| residue (supporting) | share of the egg yolk left on the upper half of that plate, B - A | 0.00124 | 0.00257 | 0.00133 1 | the wider gap above the small plates lets more through | -0.01 or more | wrong sign |

- **A**: large plates only. Load `plates-18`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0936 mmol/L (peak 0.446). Result `sha256:f8371b21cd6f`, 1.7 s (exposure cached).
- **B**: large and small alternating. Load `plates-alt-18`, programme `eco_50`, 7 items (0 clean, mean score of the soiled 0.143), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.094 mmol/L (peak 0.446). Result `sha256:165127d16375`, 2.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_3 (well) | 0.00246 | 0.485 | 207 | 19.4 | 1 | 1 | 1.73 | 15.7 | 0.919 | 0 |  | 1 | 142 | 0 | 1.66 | iec_egg_yolk (reaction) 1.38/1383 mg |
| B | plate_2 (well) | 0.00305 | 0.465 | 207 | 19.1 | 1 | 1 | 1.38 | 13.8 | 0.853 | 0 |  | 0 | 327 | 0 | 1.66 | iec_egg_yolk (reaction) 3.75/1453 mg |

### P13 Glass or cup placed over tines: too small

Test: A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A).

Adapted: Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.

Stages: water: jets (tine in the path), droplets (fans off the tine), scene (contacts).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the inside is under a direct jet, B over A, minus one | 0.012 | 0.0116 | -0.0338 1 | interior f_jet reduced | -0.05 or more | too small |
| marks (supporting) | contact marks on the glass over the tine (B) |  |  |  | AHAM adds 1 to 3 grade points per marked glass | +0.5 to +6 | not covered: needs spots and film from evaporated water, and marks at contacts |
| drying (supporting) | change of the drying score, B - A |  |  |  | drying score -1 | -0.5 to -2 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: row folded down: no tine in the glass. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:b8058c42ba42`, 2 s (exposure cached).
- **B**: over a tine. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:c0dc7a0b5372`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass (interior) | 0.012 | 0.646 | 442 | 29.5 | 1 | 1 | 4.4 | 32.8 | 1.03 | 0 |  | 5 | 0 | 0 | 2.78 | iec_milk (reaction) 1.6e-7/528 mg |
| B | glass (interior) | 0.0116 | 0.646 | 442 | 29.3 | 1 | 1 | 4.25 | 31.8 | 1.02 | 0 |  | 5 | 0 | 0 | 2.78 | iec_milk (reaction) 1.7e-7/528 mg |

### P14 Soiled face against the tub wall or door liner: pass

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the loading physics seats the platter face inward and does not seat it reversed on the present basket, so both ways round are set poses: the platter exactly upright 30 mm outboard of its outermost seat, between the last tine and the side wall of the basket, the one place where it clears the tines either way round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.0076 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 2 | 0 | -2 score | as P02: -1 to -2 | -0 to -4 | pass |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 32.9 | 2.52 | -0.923 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 1.2e-4 | 0.00439 | 0.00428 1 | the face to the wall keeps more | +0.01 or more | too small |

- **A**: face inward: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:0077b0b3b7a4`, 1.5 s (exposure cached).
- **B**: face to the wall: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:3b4240d8be9c`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.0076 | 0.53 | 325 | 29.5 | 1 | 1 | 5.23 | 32.9 | 1.26 | 0 |  | 2 | 13.4 | 0 | 0.886 | iec_egg_yolk (reaction) 0.121/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.106 | 2.52 | 0.395 | 0 |  | 0 | 484 | 0 | 0.95 | iec_egg_yolk (reaction) 4.51/1026 mg |

### P15 Nested spoons: too large

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch; both arrangements are settled by the loading physics.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 4 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | too large |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0 | 5.0e-13 | 5.0e-13 1 | when spoons spoon, they trap food | +0.01 or more | too small |

- **A**: opposed. Load `spoons-opposed`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:a340a97d4e24`, 1.4 s (exposure cached).
- **B**: nested. Load `spoons-nested`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:7e09696ee49d`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 4.8e-5 | 0.112 | 94.9 | 35.5 | 1 | 1 | 0.151 | 14.2 | 0.888 | 0 |  | 5 | 0 | 0 | 0.139 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.00645 | 0.755 | 227 | 37.6 | 1 | 1 | 1.76 | 26.1 | 0.858 | 0 |  | 5 | 0 | 0 | 0.224 | iec_oat_flakes (reaction) 0/24.3 mg |
| B | spoon_1 (bowl) | 7.7e-5 | 0.158 | 186 | 50.3 | 1 | 1 | 0.209 | 18 | 0.892 | 0 |  | 5 | 0 | 0 | 0.175 | iec_oat_flakes (reaction) 1.2e-11/23.6 mg |
| B | spoon_2 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.165 | 14.1 | 0.88 | 0 |  | 5 | 0 | 0 | 0.194 | iec_oat_flakes (reaction) 0/24.3 mg |

### P16 Heads up against heads down (not nested): pass

Test: Six dinner forks with egg yolk on the tines, one per cell of the cutlery basket: handles down (A) against handles up (B).

Adapted: Six forks, one per cell: the cutlery basket of the Bosch has six cells, not twelve.

Stages: water: jets (basket walls), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the forks, B - A | 0 | 0 | 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 | pass |
| residue (supporting) | mean share of the egg yolk left on the forks, B - A | 0.121 | 0.103 | -0.0181 1 | an informal test found no difference | |x| <= 0.2 | pass |

- **A**: heads up. Load `forks-heads-up`, programme `eco_50`, 6 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:6be35692c1bd`, 1.6 s (exposure cached).
- **B**: heads down. Load `forks-heads-down`, programme `eco_50`, 6 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:735157f27cb8`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | fork_1 (tines) | 9.4e-4 | 0.231 | 238 | 43.6 | 1 | 1 | 3.17 | 52.1 | 1.56 | 0 |  | 0 | 780 | 0 | 0.0713 | iec_egg_yolk (reaction) 21.7/156 mg |
| B | fork_1 (tines) | 0.00228 | 0.497 | 279 | 42.3 | 1 | 1 | 6.01 | 65.4 | 1.85 | 0 |  | 0 | 732 | 0 | 0.175 | iec_egg_yolk (reaction) 20.3/156 mg |

### P17 Crowded basket cells: too small

Test: Dessert spoons with porridge in their bowls, handles down in the six cells of the cutlery basket: one (A), two (B) and four (C) per cell.

Adapted: Six, twelve and twenty-four spoons in the six cells of the Bosch; each load is settled by the loading physics.

Stages: load: physics (contacts); water: scene (contacts), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| crowding | share of spoons not scoring 5, four per cell minus one per cell | 0 | 0 | 0 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 | too small |
| single (supporting) | share of spoons not scoring 5 at one per cell, as a distance from 10 to 40 % |  |  | -0.1 1 | about 20 % of cutlery not scoring 5 in the standard load | within 0.1 of the range | pass |
| residue (supporting) | mean share of porridge left, four per cell minus one per cell | 6.3e-8 | 1.5e-7 | 8.3e-8 1 | crowding leaves more | +0.05 or more | too small |

- **A**: one per cell. Load `spoons-1`, programme `eco_50`, 6 items (6 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:3143f5d4571d`, 1.4 s (exposure cached).
- **B**: two per cell. Load `spoons-2`, programme `eco_50`, 12 items (12 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:d9a39da32966`, 1.5 s (exposure cached).
- **C**: four per cell. Load `spoons-4`, programme `eco_50`, 24 items (24 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:37997c54e227`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.0077 | 0.838 | 201 | 34.1 | 1 | 1 | 2.26 | 33.6 | 1.03 | 0 |  | 5 | 0 | 0 | 0.0912 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_1 (bowl) | 0.00883 | 0.831 | 188 | 34.5 | 1 | 1 | 2.23 | 32.1 | 1.03 | 0 |  | 5 | 0 | 0 | 0.147 | iec_oat_flakes (reaction) 0/23.6 mg |
| C | spoon_1 (bowl) | 0.0102 | 0.874 | 219 | 34.9 | 1 | 1 | 2.59 | 31.5 | 1.01 | 0 |  | 5 | 0 | 0 | 0.179 | iec_oat_flakes (reaction) 0/23.6 mg |

### P18 Cutlery tray against basket: pass

Test: Six dessert spoons with porridge in their bowls: standing in the cutlery basket (A) against lying flat, bowls up, on the knife shelf of the upper basket (B).

Adapted: The owner's machine has no cutlery drawer; the knife shelf of the upper basket is where pieces lie flat, so it stands in for the tray.

Stages: water: scene (basins of small hollows), pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| water | water standing in a spoon at the end, mean, B - A | 0 | 2.02 | 2.02 mL | spoon bowls facing up hold water | + (any size) | pass |
| drying (supporting) | drying score of the spoons lying bowl up (B) |  |  |  | drying score on face-up spoon bowls 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: standing in the basket. Load `spoons-1`, programme `eco_50`, 6 items (6 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:3143f5d4571d`, 1.4 s (exposure cached).
- **B**: lying on the knife shelf. Load `spoons-shelf`, programme `eco_50`, 6 items (0 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:67b8c9280d25`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.0077 | 0.838 | 201 | 34.1 | 1 | 1 | 2.26 | 33.6 | 1.03 | 0 |  | 5 | 0 | 0 | 0.0912 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 1.6 | 33.8 | 0.85 | 0.444 | 1.32 mL, full for 7306 s | 3 | 11.1 | 1.32 | 2.56 | iec_oat_flakes (reaction) 0.129/23.6 mg |

### P19 Loading beyond rated capacity: wrong sign

Test: Six place settings well spaced (A) against the full IEC load one piece to a slot (B, nearly twice the pieces), both settled by the careful loading policy; mean IEC score of the soiled pieces.

Adapted: The machine as modelled does not take the rated 140 pieces: the careful loader fits about 100. A load "beyond what fits" cannot be built by a loader that refuses what does not hold, so the contrast run here is half load against full load (about 80 % more pieces), not rated against rated + 30 %.

Stages: load: loader; water: jets (shadowing), run-off; soil: liquor (soil load).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the soiled pieces, B - A | 2.9 | 2.9 | 0.00417 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 | wrong sign |

- **A**: half load, well spaced. Load `loader:half-careful`, programme `eco_50`, 62 items (40 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.073 g/L (peak 0.122), peracid mean 0.088 mmol/L (peak 0.444). Result `sha256:519ff6d7a950`, 6 s (exposure cached).
- **B**: full load, one piece to a slot. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0847 mmol/L (peak 0.444). Result `sha256:bd6b638df2cb`, 4.7 s (exposure cached).

### P20 Total soil load: too small

Test: The IEC load in one geometry with a quarter (A), half (B) and all (C) of its pieces soiled; mean IEC score of the pieces that are soiled in all three.

Adapted: Every fourth piece of the load (by position in its list) is the quarter; every second the half.

Stages: soil: liquor (consumption of oxidant and enzyme by soil), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the always-soiled quarter, all soiled minus a quarter soiled | 3 | 3 | 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 | too small |

- **A**: a quarter of the pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (105 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0729 g/L (peak 0.126), peracid mean 0.0905 mmol/L (peak 0.445). Result `sha256:334e984bbd9f`, 1.7 s (exposure cached).
- **B**: half of the pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (95 clean, mean score of the soiled 2.87), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.073 g/L (peak 0.127), peracid mean 0.0885 mmol/L (peak 0.445). Result `sha256:0c277b4b5b9c`, 2.7 s (exposure cached).
- **C**: all pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0847 mmol/L (peak 0.444). Result `sha256:bd6b638df2cb`, 4.7 s (exposure cached).

### P21 Redeposition of particulates: not covered

Test: Seven clean dinner plates (A) against the same with 20 g of minced spinach on one of them (B); specks on the plates that started clean.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: redeposition (not built). Note: needs redeposition of particles (soil carried by the liquor and settled on other surfaces).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| specks | share of the plates that started clean and carry 1 to 4 specks, B - A |  |  |  | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 | not covered: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) |

- **A**: no spinach. Load `plates-18`, programme `eco_50`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:0dfab7e59547`, 0.3 s (exposure cached).
- **B**: 20 g of spinach on one plate. Load `plates-18`, programme `eco_50`, 7 items (6 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:ba2f569f1889`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | plate_3 | 0.0051 | 0.495 | 312 | 25 | 1 | 1 | 3.28 | 20.1 | 0.941 | 0 |  | 5 | 0 | 0 | 1.66 |  |

### P22 Clean neighbours of soiled items: pass

Test: Seven dinner plates in neighbouring slots, every second one with egg yolk; the clean ones are scored.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: liquor, redeposition (not built: the clean plates cannot pick anything up).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clean | points the clean plates lose (5 minus their mean IEC score) |  |  | 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 | pass |

- **A**: clean and soiled alternating. Load `plates-18`, programme `eco_50`, 7 items (3 clean, mean score of the soiled 0.25), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0946 mmol/L (peak 0.446). Result `sha256:4abed781246c`, 1.1 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00483 | 0.476 | 420 | 25.8 | 1 | 1 | 2.55 | 16.5 | 0.887 | 0 |  | 5 | 0 | 0 | 1.65 |  |

### P23 End-of-cycle drips from the upper rack: not covered

Test: Seven dinner plates in the lower basket with an empty upper basket (A) against three mugs mouth down in the upper basket (B).

Adapted: Three mugs stand for the loaded upper basket.

Stages: water: drain-down after the last rinse and drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale) of the lower plates, B - A |  |  |  | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film on the lower plates at the end of the last rinse, mean, B - A | 1.67 | 1.69 | 0.0267 g | drips from above add water | + (any size) | pass |

- **A**: upper basket empty. Load `plates-18`, programme `eco_50`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:0dfab7e59547`, 0.3 s (exposure cached).
- **B**: upper basket loaded. Load `plates-18-upper`, programme `eco_50`, 10 items (10 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:378fb70bd54e`, 1.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00483 | 0.476 | 420 | 25.8 | 1 | 1 | 2.55 | 16.5 | 0.887 | 0 |  | 5 | 0 | 0 | 1.65 |  |
| B | plate_4 | 0.00483 | 0.476 | 420 | 25.8 | 1 | 1 | 2.31 | 15 | 0.825 | 0 |  | 5 | 0 | 0 | 1.64 |  |

### P24 Arrangement does not matter for easy soils (negative control): pass

Test: The IEC load with half of its pieces carrying an air-dried, lightly adhering soil (jam, 15 h) and half clean, in three different soiled/clean orders.

Adapted: The three orders are three different halves of the pieces of one settled load; the soil lies where the IEC soil of each piece lies.

Stages: soil: removal laws (dissolve), hydration.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| range | largest minus smallest load mean IEC score of the three orders |  |  | 0.174 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 | pass |

- **A**: first order. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (113 clean, mean score of the soiled 4.83), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0734 g/L (peak 0.128), peracid mean 0.0796 mmol/L (peak 0.437). Result `sha256:d8ab12aac4c6`, 1.1 s (exposure cached).
- **B**: second order. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (114 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0734 g/L (peak 0.128), peracid mean 0.0803 mmol/L (peak 0.437). Result `sha256:a7d50e910b8d`, 1 s (exposure cached).
- **C**: third order. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (113 clean, mean score of the soiled 4.89), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0734 g/L (peak 0.128), peracid mean 0.0804 mmol/L (peak 0.438). Result `sha256:a0e86298a27b`, 1.1 s (exposure cached).

### P25 Detergent dispenser blocked: too large

Test: A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D).

Adapted: The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.

Stages: load: session (mechanical check); soil: liquor (dosing), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| protein | share of the egg yolk removed without detergent (B) |  |  | 0.0773 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 | pass |
| tea | share of the tea film removed without detergent (D) |  |  | 0.257 1 | tea stays | |x| <= 0.2 | too large |
| score | mean IEC score of the three pieces, blocked minus free | 1.67 | 0 | -1.67 score | load mean -1.5 or more | -0.5 to -5 | pass |

- **A**: plate, dispenser free. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:9fa1865ac278`, 0.3 s (exposure cached).
- **B**: plate, dispenser blocked. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 264 min with detergent, mean 45.8 C (max 61 C), pH 9.82 (max 10.4), protease mean 0.0151 g/L (peak 0.049), peracid mean 0.0061 mmol/L (peak 0.0244). Result `sha256:75b37c3b4b96`, 0.3 s (exposure cached).
- **C**: tea cups, dispenser free. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:2ce59de7eeb4`, 1.6 s (exposure cached).
- **D**: tea cups, dispenser blocked. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 264 min with detergent, mean 45.8 C (max 61 C), pH 9.82 (max 10.4), protease mean 0.0151 g/L (peak 0.0493), peracid mean 0.00611 mmol/L (peak 0.0245). Result `sha256:95bf69134c56`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 2347 | 0 | 1.02 | iec_egg_yolk (reaction) 39.9/1063 mg |
| B | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 981/1063 mg |
| C | cup_1 (interior) | 0.0496 | 0.563 | 303 | 29.1 | 1 | 1 | 9.67 | 50.8 | 1.33 | 0 |  | 3 | 18 | 0 | 0.976 | iec_tea (bleach) 0.123/3.46 mg |
| D | cup_1 (interior) | 0.0496 | 0.563 | 303 | 29.1 | 1 | 1 | 9.67 | 50.8 | 1.33 | 0 |  | 0 | 7491 | 0 | 0.976 | iec_tea (bleach) 2.56/3.46 mg |

### P26 Tablet trapped or dissolving in a dead spot: not covered

Test: A dessert plate with egg yolk washed with the tablet released into its tray (A) against a tablet that lands in an upright bowl (B).

Adapted: The wash has no input for where the tablet lands; B is washed as A until it has one, and the scenario is reported as not covered.

Stages: soil: liquor (tablet transport and local dissolution, not built). Note: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A |  |  |  | similar to under-dosing; size unknown: calibration parameter | - (any size) | not covered: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) |

- **A**: tablet in its tray. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:9fa1865ac278`, 0.3 s (exposure cached).
- **B**: tablet in an upright bowl. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:9fa1865ac278`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 2347 | 0 | 1.02 | iec_egg_yolk (reaction) 39.9/1063 mg |
| B | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 2347 | 0 | 1.02 | iec_egg_yolk (reaction) 39.9/1063 mg |

### P27 Time and temperature trade: too small

Test: A dessert plate with egg yolk (well) and porridge (rim) in the lower basket on the short programme (A, Express 65, 1 h), the eco programme (B, Eco 50, 4 h 55 min) and the intensive programme (C, Intensive 70).

Adapted: The three programmes are those of the owner's machine as the machine package models them.

Stages: soil: liquor (temperature course, enzyme life), hydration, chemistry; machine: programme timeline.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate, eco minus short | 0 | 0 | 0 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 | too small |
| residue (supporting) | share of the soil left on the plate, eco minus short | 0.655 | 0.0324 | -0.622 1 | short programmes fail on starch and protein | -0.01 or more | pass |
| intensive (supporting) | share of the soil left on the plate, intensive minus short | 0.655 | 0.634 | -0.0205 1 | more time and temperature remove more | -0.01 or more | pass |

- **A**: Express 65. Load `plate-facing`, programme `express_65`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 43.5 min with detergent, mean 52.9 C (max 66.9 C), pH 10 (max 10.5), protease mean 0.0454 g/L (peak 0.0768), peracid mean 0.118 mmol/L (peak 0.276). Result `sha256:904a393eb8a2`, 0.1 s (exposure cached).
- **B**: Eco 50. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:6c46cf685b4e`, 0.4 s (exposure cached).
- **C**: Intensive 70. Load `plate-facing`, programme `intensive_70`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 58.6 min with detergent, mean 58.5 C (max 70 C), pH 10.1 (max 10.6), protease mean 0.0423 g/L (peak 0.0959), peracid mean 0.13 mmol/L (peak 0.446). Result `sha256:b9fc46aefdfe`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well, rim) | 0.0127 | 0.493 | 249 | 19.4 | 1 | 1 | 7.87 | 46.7 | 1.34 | 0 |  | 0 | 9340 | 0 | 1.02 | iec_egg_yolk (reaction) 802/1063 mg; iec_oat_flakes (reaction) 2.9/167 mg |
| B | plate (well, rim) | 0.00733 | 0.672 | 229 | 24.2 | 1 | 1 | 5.54 | 33.3 | 1.21 | 0 |  | 0 | 2347 | 0 | 1.02 | iec_egg_yolk (reaction) 39.9/1063 mg; iec_oat_flakes (reaction) 0/167 mg |
| C | plate (well, rim) | 0.00757 | 0.632 | 342 | 26.9 | 1 | 1 | 5.89 | 34.7 | 1.24 | 0 |  | 0 | 9234 | 0 | 1.02 | iec_egg_yolk (reaction) 778/1063 mg; iec_oat_flakes (reaction) 2.34/167 mg |

### P28 Bleachable stains are position-insensitive (negative control): pass

Test: Two tea cups with tea film mouth down in the upper basket, one near the axis of the upper arm and one in a corner outside the swept circle, with the standard detergent (A) and with a bleach-free one (B).

Adapted: The corner cup stands on the knife shelf at the rear left. Bleach-free: the detergent without percarbonate and TAED (`liq.xPeroxide`, `liq.xTaed` = 0).

Stages: water: droplets, run-off (wetting); soil: chemistry (bleach), supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| position | IEC score of the corner cup minus the centre cup (A) |  |  | -1 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 | pass |
| bleach | share of the tea film removed without bleach (B) |  |  | -8.9e-16 1 | without bleach all fail | |x| <= 0.2 | pass |
| with (supporting) | share of the tea film removed with bleach, mean of the two cups (A) |  |  | 0.961 1 | with oxidant, temperature and time the film goes | +0.5 to +1 | pass |
| f_jet (supporting) | fraction of time the inside is under a direct jet, corner over centre, minus one (A) |  |  | -0.956 1 | the corner is the worst spray position | -0.05 or more | pass |

- **A**: with bleach. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:2ce59de7eeb4`, 1.6 s (exposure cached).
- **B**: bleach-free detergent. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xPeroxide":0,"liq.xTaed":0}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0828 g/L (peak 0.137), peracid mean 0 mmol/L (peak 0). Result `sha256:d8b46ff24ce7`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | cup_1 (interior) | 0.0496 | 0.563 | 303 | 29.1 | 1 | 1 | 9.67 | 50.8 | 1.33 | 0 |  | 3 | 18 | 0 | 0.976 | iec_tea (bleach) 0.123/3.46 mg |
| A | cup_2 (interior) | 0.00218 | 0.473 | 193 | 28.1 | 1 | 1 | 0.445 | 5.3 | 0.462 | 0 | 1.04 mL, full for 7302 s | 2 | 31.8 | 1.04 | 3.36 | iec_tea (bleach) 0.143/3.36 mg |
| B | cup_1 (interior) | 0.0496 | 0.563 | 303 | 29.1 | 1 | 1 | 9.67 | 50.8 | 1.33 | 0 |  | 0 | 7491 | 0 | 0.976 | iec_tea (bleach) 3.46/3.46 mg |
| B | cup_2 (interior) | 0.00218 | 0.473 | 193 | 28.1 | 1 | 1 | 0.445 | 5.3 | 0.462 | 0 | 1.04 mL, full for 7302 s | 0 | 7493 | 1.04 | 3.36 | iec_tea (bleach) 3.36/3.36 mg |

### P29 Ageing of the soil before the wash: too small

Test: A dessert plate with egg yolk in the lower basket at three ageing levels: fresh (A, 15 min), oven-dried 2 h at 80 C (B), baked on at 125 C (C).

Adapted: One plate instead of a load; the baked level is the heat history `cooked` of the soil model (125 C), the nearest to 130 to 140 C.

Stages: soil: hydration (lag), bake index, removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| fresh | IEC score of the fresh plate, as a distance from 4.5 to 5 (A) |  |  | -3.5 score | crockery mean at least 4.5 fresh | within 1 of the range | too small |
| dried | IEC score of the oven-dried plate, as a distance from 2.3 to 3.7 (B) |  |  | -2.3 score | crockery 2.3 to 3.7 oven-dried | within 1 of the range | too small |
| baked | IEC score, baked minus oven-dried | 0 | 0 | 0 score | at least 1 point lower again for 130 to 140 C baking | -0 to -5 | too small |
| order (supporting) | share of the egg yolk left, baked minus fresh | 0.00123 | 0.0577 | 0.0564 1 | ageing leaves more | +0.01 or more | pass |

- **A**: fresh. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 1), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:81d11672a822`, 0.3 s (exposure cached).
- **B**: oven-dried 2 h at 80 C. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:9fa1865ac278`, 0.3 s (exposure cached).
- **C**: baked on at 125 C. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:5a3fa12f1dca`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 1 | 99.3 | 0 | 1.02 | iec_egg_yolk (reaction) 1.31/1063 mg |
| B | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 2347 | 0 | 1.02 | iec_egg_yolk (reaction) 39.9/1063 mg |
| C | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 3342 | 0 | 1.02 | iec_egg_yolk (reaction) 61.3/1063 mg |

### P30 Protein soil responds to hit frequency and chemistry, not to jet strength: pass

Test: A dessert plate with egg yolk at a fixed position in the lower basket: pump speed of the main wash -30 % (A) and +30 % (B); protease dose -50 % (C) and +50 % (D).

Adapted: A plate stands in for the tiles. The pump speed is changed in the steps of the main wash of the programme (3000 rpm to 2100 and 3900 rpm); the enzyme dose by `liq.xProtease`.

Stages: soil: removal laws (reaction, jet assist), chemistry; water: hydraulics, jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pump | share of the egg yolk removed, pump +30 % minus pump -30 % | 0.955 | 0.957 | 0.00254 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 | pass |
| enzyme | share of the egg yolk removed, protease +50 % minus protease -50 % | 0.045 | 0.46 | 0.415 1 | doubling enzyme level changes it clearly | +0.05 to +1 | pass |

- **A**: pump -30 %. Load `plate-facing`, programme `eco_50+pump70pct`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 43.8 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0739 g/L (peak 0.115), peracid mean 0.101 mmol/L (peak 0.446). Result `sha256:29b2f69d920e`, 0.3 s (exposure cached).
- **B**: pump +30 %. Load `plate-facing`, programme `eco_50+pump130pct`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 50.1 C (max 53.6 C), pH 10.3 (max 10.7), protease mean 0.0677 g/L (peak 0.0959), peracid mean 0.0871 mmol/L (peak 0.446). Result `sha256:a41639bcae2c`, 1.5 s (exposure cached).
- **C**: protease -50 %. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.005}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0121 g/L (peak 0.0183), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:1a79d257ed56`, 0.3 s (exposure cached).
- **D**: protease +50 %. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.015}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0363 g/L (peak 0.0548), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:90191b394978`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00465 | 0.533 | 184 | 18.2 | 1 | 1 | 3.54 | 25 | 1.09 | 0 |  | 0 | 2735 | 0 | 1.02 | iec_egg_yolk (reaction) 47.9/1063 mg |
| B | plate (well) | 0.00669 | 0.631 | 315 | 32.5 | 1 | 1 | 5.62 | 34.2 | 1.3 | 0 |  | 0 | 2601 | 0 | 1.02 | iec_egg_yolk (reaction) 45.2/1063 mg |
| C | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 1015/1063 mg |
| D | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 574/1063 mg |

### P31 Starch is bimodal: too small

Test: Twelve soup plates with oat porridge in the lower basket; the histogram of their IEC scores.

Adapted: Eleven in every second slot of the rear lane and one in the left front lane, settled by the loading physics.

Stages: soil: hydration, removal laws (starch), inspection.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clusters | share of the plates scoring 5 or 0 to 1 |  |  | 1 1 | porridge-plate scores cluster at 5 and at 0 to 1 | +0.6 to +1 | pass |
| both | share of the plates in the smaller of the two clusters |  |  | 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more | too small |

- **A**: twelve porridge plates. Load `soup-12`, programme `eco_50`, 12 items (12 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0945 mmol/L (peak 0.446). Result `sha256:297869f9baea`, 2.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_6 (well) | 0.00213 | 0.357 | 163 | 21.9 | 1 | 1 | 4.71 | 28.8 | 1.01 | 0 |  | 5 | 0 | 0 | 1.63 | iec_oat_flakes (reaction) 0/232 mg |

### P32 Microwaved milk on glass is persistent: too large

Test: Four test glasses with microwaved milk in the upper basket with detergent D on the Auto programme (A), on the long eco programme (B), and with a detergent of twice the enzyme and half the silicate (C).

Adapted: The registry defaults are IEC detergent D. The ingredient table of detergent E is not in the dossiers ("upgraded enzymes, less silicate"), so C is an assumed composition and decides nothing; the eco programme, which the entry names beside E, is the deciding comparison.

Stages: soil: chemistry (alkalinity, enzyme), removal laws; water: jets into the glass.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the glasses with detergent D, as a distance from 2.3 to 2.4 (A) |  |  | -2.05 score | glass class 2.3 to 2.4 with detergent D on the reference machines | within 1 of the range | too small |
| eco | mean IEC score of the glasses, eco minus Auto | 0.25 | 5 | 4.75 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 | too large |
| e_like (supporting) | mean share of the milk left, E-like minus D | 0.0168 | 0.275 | 0.258 1 | upgraded enzymes remove more | -0.01 or more | wrong sign |

- **A**: detergent D, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0.25), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0772 mmol/L (peak 0.449). Result `sha256:ffd3ef3147bd`, 0.6 s (exposure cached).
- **B**: detergent D, Eco 50. Load `glasses-milk`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0951 mmol/L (peak 0.446). Result `sha256:2818a849f344`, 0.5 s (exposure cached).
- **C**: assumed E-like detergent, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.02,"liq.xAmylase":0.01,"liq.xSilicate":0.275}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10 (max 10.7), protease mean 0.0217 g/L (peak 0.0639), peracid mean 0.0766 mmol/L (peak 0.444). Result `sha256:18971e61996f`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (interior) | 0.0124 | 0.535 | 335 | 26.2 | 1 | 1 | 5.68 | 37.4 | 1.12 | 0 |  | 0 | 809 | 0 | 1.33 | ikw_milk_microwaved (reaction) 7.93/527 mg |
| B | glass_1 (interior) | 0.0124 | 0.535 | 335 | 26.3 | 1 | 1 | 5.7 | 37.6 | 1.12 | 0 |  | 5 | 0 | 0 | 1.33 | ikw_milk_microwaved (reaction) 3.3e-6/527 mg |
| C | glass_1 (interior) | 0.0124 | 0.535 | 335 | 26.2 | 1 | 1 | 5.68 | 37.4 | 1.12 | 0 |  | 0 | 9169 | 0 | 1.33 | ikw_milk_microwaved (reaction) 147/527 mg |

### P33 Fat needs temperature and enough water: too small

Test: A porcelain and a melamine dessert plate with fresh margarine in the lower basket, with the main wash of the programme heated to 35 (A), 45 (B) and 55 C (C).

Adapted: The target of the main wash is changed in the steps of the programme; everything else of the programme stays.

Stages: soil: removal laws (melt, roll-up by substrate), liquor (temperature course).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| warm | IEC score of the porcelain plate at 55 C, as a distance from 4 to 5 (C) |  |  | 0 score | margarine platter cleans easily at 50 C | within 1 of the range | pass |
| temperature | share of the margarine left on the two plates, 35 C minus 55 C | 4.4e-16 | 5.7e-10 | 5.7e-10 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more | too small |
| plastic (supporting) | share of the margarine left at 45 C, melamine minus porcelain (B) |  |  | 2.5e-12 1 | greasy residue most visibly on plastic | +0.01 or more | too small |

- **A**: main wash at 35 C. Load `dplate-lower`, programme `eco_50+wash35C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 164 min with detergent, mean 35 C (max 36.8 C), pH 10.6 (max 10.8), protease mean 0.0755 g/L (peak 0.118), peracid mean 0.197 mmol/L (peak 0.447). Result `sha256:6844961825de`, 0.3 s (exposure cached).
- **B**: main wash at 45 C. Load `dplate-lower`, programme `eco_50+wash45C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 168 min with detergent, mean 42.4 C (max 45 C), pH 10.4 (max 10.8), protease mean 0.0756 g/L (peak 0.119), peracid mean 0.122 mmol/L (peak 0.445). Result `sha256:d08fce096e90`, 0.3 s (exposure cached).
- **C**: main wash at 55 C. Load `dplate-lower`, programme `eco_50+wash55C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 172 min with detergent, mean 49.6 C (max 55 C), pH 10.3 (max 10.8), protease mean 0.0646 g/L (peak 0.0959), peracid mean 0.0718 mmol/L (peak 0.445). Result `sha256:27e276729fa8`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.011 | 0.757 | 273 | 24.1 | 1 | 1 | 5.79 | 35.9 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 5.4e-24/1743 mg |
| A | melamine (well) | 0.00179 | 0.245 | 52.2 | 21.2 | 1 | 1 | 2.82 | 58.2 | 1.75 | 0 |  | 5 | 0 | 0 | 0.698 | iec_margarine (melt) 1.9e-6/1647 mg |
| B | plate (well) | 0.011 | 0.757 | 273 | 24.1 | 1 | 1 | 5.8 | 36 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 5.5e-33/1743 mg |
| B | melamine (well) | 0.0018 | 0.245 | 52.2 | 21.2 | 1 | 1 | 2.82 | 58.2 | 1.75 | 0 |  | 5 | 0 | 0 | 0.698 | iec_margarine (melt) 4.1e-9/1647 mg |
| C | plate (well) | 0.0111 | 0.757 | 273 | 24.2 | 1 | 1 | 5.81 | 36 | 1.31 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 1.2e-44/1743 mg |
| C | melamine (well) | 0.0018 | 0.245 | 52.2 | 21.3 | 1 | 1 | 2.83 | 58.2 | 1.75 | 0 |  | 5 | 0 | 0 | 0.698 | iec_margarine (melt) 1.5e-12/1647 mg |

### P34 Thick layers detach as flakes: not covered

Test: A dessert plate with egg yolk at 5 (A) and 10 mg/cm2 dry (B).

Adapted: One plate; 5 and 10 mg/cm2 dry on 60 % of the well are 0.93 g and 1.85 g of yolk as applied.

Stages: soil: removal laws (cohesive failure and flakes, not built). Note: needs detachment of thick layers as flakes.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| flakes | soil that left as flakes, thick minus thin |  |  |  | thick egg yolk partly tended to flake off | + (any size) | not covered: needs detachment of thick layers as flakes |
| residue (supporting) | share of the egg yolk left, thick minus thin | 7.5e-11 | 0.0184 | 0.0184 1 | the thicker layer takes longer | +0.01 or more | pass |

- **A**: 5 mg/cm2 dry. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:fa20b4ea95a5`, 0.2 s (exposure cached).
- **B**: 10 mg/cm2 dry. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:6c32e8c37ecd`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 5 | 0 | 0 | 1.02 | iec_egg_yolk (reaction) 3.7e-8/492 mg |
| B | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 1249 | 0 | 1.02 | iec_egg_yolk (reaction) 18.1/983 mg |

### P35 Pot interiors: too small

Test: A 17 cm steel saucepan with burnt-on milk on its inner bottom and wall in the lower basket: mouth down on the rear rows (A) against lying on its side (B).

Adapted: Both poses are dropped and settled by the loading physics; the pan on its side rolls about 10 cm before it rests.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | IEC score of the pot mouth down, as a distance from 2.5 to 4.0 (A) |  |  | 1 score | pots class 2.5 with detergent D to 4.0 with E | within 1 of the range | pass |
| side | share of the soil left in the pot, on its side minus mouth down | 0 | 0 | 0 1 | on its side, half the wall is shadowed | +0.01 or more | too small |
| ranking (supporting) | share left on the inner wall minus on the inner bottom, mouth down (A) |  |  | 0 1 | inverted, the bottom is hit directly (the ranking is a calibration target) | +0.01 or more | too small |

- **A**: mouth down. Load `pot-inverted`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:c12e0212a973`, 1.6 s (exposure cached).
- **B**: on its side. Load `pot-on-side`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:de95eff9642c`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot (interior_base) | 0.0393 | 0.976 | 215 | 32 | 0.818 | 1 | 4.76 | 11.8 | 0.35 | 0 | 1.36 mL, full for 0 s | 5 | 0 | 0 | 12.5 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| A | pot (interior_wall) | 0.00471 | 0.396 | 601 | 29.5 | 0.972 | 1 | 35 | 60 | 1.51 | 0 | 1.36 mL, full for 0 s | 5 | 0 | 0 | 12.5 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| B | pot (interior_base) | 0 | 0 | 0 | 0 | 1 | 1 | 8.72 | 43.4 | 1.18 | 0.814 | 820 mL, full for 7250 s | 5 | 0 | 820 | 9.03 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| B | pot (interior_wall) | 1.7e-7 | 3.3e-4 | 102 | 52.8 | 1 | 1 | 2.11 | 33.6 | 1.17 | 0.389 | 820 mL, full for 7250 s | 5 | 0 | 820 | 9.03 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |

### P36 Water pools in the base recess of inverted cups and mugs: pass

Test: A ceramic mug mouth down on a level support: the rear cup shelf of the upper basket folded down.

Adapted: The cup shelf of the Bosch is the level support; the mug is dropped onto it and settles. The expected volume is the checklist's formula for the recess of the catalogue's mug (28 mm radius, 2.5 mm deep).

Stages: water: scene (basins), run-off, pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pool | water standing in the base recess at the end |  |  | 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 | pass |
| drying (supporting) | drying score of the mug |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:e54515a12168`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 9.9e-4 | 0.234 | 27 | 16.6 | 1 | 1 | 0.557 | 5.66 | 0.358 | 0.479 | 5 mL, full for 7304 s | 5 | 0 | 5 | 3.27 |  |

### P37 Tilt drains the recess: too small

Test: The mug of P36 at 0 (A), 7 (B), 15 (C) and 30 degrees (D) of tilt.

Adapted: The tilts are set, not settled: the mug is turned about a horizontal axis and kept standing on the height of its lowest point; the runner checks that it cuts into nothing. The checklist's volumes are for a recess of 25 mm radius and 3 mm depth; the expected values here are its formulas evaluated for the recess of the catalogue's mug (28 mm, 2.5 mm), as shares of the level volume.

Stages: water: scene (basins, minimum basin volume), pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| tilt7 | water in the recess at 7 degrees over level | 5 | 0.418 | 0.0836 1 | the wedge formula: 1.4 of 5.9 mL at 7 degrees for the checklist's recess; 0.92 of 6.2 mL for this mug's | +0.0744 to +0.298 | pass |
| tilt15 | water in the recess at 15 degrees over level | 5 | 0.111 | 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 | too small |
| tilt30 (supporting) | water in the recess at 30 degrees over level | 5 | 0 | 0 1 | the wedge formula: 0.13 of 5.9 mL at 30 degrees for the checklist's recess; 0.09 of 6.2 mL for this mug's | +0.0073 to +0.0292 | too small |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:e54515a12168`, 1.4 s (exposure cached).
- **B**: tilted 7 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:916d64a27e33`, 2.2 s (exposure cached).
  - set pose: deepest overlap 0.01 mm (mug into upper_rack_fittings)
- **C**: tilted 15 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:ee9e5309089a`, 1.4 s (exposure cached).
- **D**: tilted 30 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.113), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:e9af05ad51e6`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 9.9e-4 | 0.234 | 27 | 16.6 | 1 | 1 | 0.557 | 5.66 | 0.358 | 0.479 | 5 mL, full for 7304 s | 5 | 0 | 5 | 3.27 |  |
| B | mug (foot) | 4.5e-4 | 0.16 | 23.4 | 15.8 | 1 | 1 | 0.393 | 4.65 | 0.36 | 0.106 | 0.418 mL, full for 7308 s | 5 | 0 | 0.418 | 2.26 |  |
| C | mug (foot) | 4.0e-4 | 0.138 | 27.8 | 17.5 | 1 | 1 | 0.354 | 4.52 | 0.373 | 0.0638 | 0.111 mL, full for 7309 s | 5 | 0 | 0.111 | 1.72 |  |
| D | mug (foot) | 5.7e-4 | 0.138 | 28.5 | 17.8 | 1 | 1 | 1.67 | 11 | 0.573 | 0 | 0.0257 mL, full for 0 s | 5 | 0 | 0 | 1.3 |  |

### P38 Plastic stays wet: not covered

Test: A melamine and a porcelain dessert plate of the same shape side by side in the lower basket.

Adapted: None.

Stages: drying (not built); water: run-off (beads on plastic) gives the film it would start from. Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), melamine minus porcelain |  |  |  | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film per area at the end of the last rinse, melamine over porcelain, minus one |  |  | -0.332 1 | water beads on plastic and stays | +0.05 or more | wrong sign |

- **A**: side by side. Load `dplate-lower`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:6668d5d65a0d`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate | 0.0114 | 0.726 | 365 | 25.8 | 1 | 1 | 7.3 | 32.3 | 1.12 | 0 |  | 5 | 0 | 0 | 1.01 |  |
| A | melamine | 0.016 | 0.637 | 365 | 26.2 | 1 | 1 | 9.78 | 62.7 | 1.65 | 0 |  | 5 | 0 | 0 | 0.698 |  |

### P39 Pots and large hollow ware stay wet: not covered

Test: A saucepan mouth down in the lower basket (A) against a dessert plate on edge (B).

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), pot minus plate |  |  |  | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water the pot keeps at the end (pools and film) against the plate | 12.5 | 1.01 | 11.5 g | rims that hold water, large wetted area | + (any size) | pass |

- **A**: saucepan. Load `pot-inverted`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:cff007611bbd`, 0.2 s (exposure cached).
- **B**: plate. Load `dplate-lower`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:6668d5d65a0d`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot | 0.00973 | 0.433 | 601 | 32 | 0.962 | 1 | 18.2 | 56.7 | 1.37 | 0 | 1.36 mL, full for 0 s | 5 | 0 | 0 | 12.5 |  |
| B | plate | 0.0114 | 0.726 | 365 | 25.8 | 1 | 1 | 7.3 | 32.3 | 1.12 | 0 |  | 5 | 0 | 0 | 1.01 |  |

### P40 Liquid held at contact points and in narrow gaps: pass

Test: Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B).

Adapted: Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.

Stages: water: scene (contacts), run-off (bridges, retained water).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| held | water left on the two glasses at the end of the last rinse (film and pools), B - A | 2.27 | 2.75 | 0.482 g | a wet mark at every touching pair | + (any size) | pass |
| marks (supporting) | residue marks at the contact (B) |  |  |  | a residue line at every touching pair | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: apart. Load `glasses-apart`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:ba0b62eb13d8`, 1.4 s (exposure cached).
- **B**: touching. Load `glasses-touching`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:324a715fc284`, 1.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (exterior) | 0.0054 | 0.556 | 307 | 23.9 | 1 | 1 | 2.26 | 17.9 | 0.896 | 0 |  | 5 | 0 | 0 | 1.16 |  |
| A | glass_2 (exterior) | 0.00375 | 0.565 | 308 | 23.9 | 1 | 1 | 3.29 | 23.3 | 1.05 | 0 |  | 5 | 0 | 0 | 1.11 |  |
| B | glass_1 (exterior) | 0.00391 | 0.42 | 272 | 23.6 | 1 | 1 | 1.68 | 14.1 | 0.817 | 0 |  | 5 | 0 | 0 | 1.42 |  |
| B | glass_2 (exterior) | 0.00434 | 0.534 | 277 | 24.8 | 1 | 1 | 3.29 | 22.5 | 1.07 | 0 |  | 5 | 0 | 0 | 1.33 |  |

### P41 Light plastic items are moved or flipped by jets: not covered

Test: A 20 g polypropylene container lid lying hollow side down in the lower basket (A) against the upper basket (B).

Adapted: The lightest lid of the catalogue weighs 20 g, not 15 g. In the lower basket it comes to rest on the cutlery basket and the left front tines.

Stages: rigid-body coupling during the wash (not built); water: jets (the lift ratio is reported). Note: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| moved | distance the jets move the lid in the lower basket |  |  |  | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) | not covered: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) |
| lift (supporting) | peak upward jet force on the lid over its weight, lower basket (A) |  |  | 3.53 1 | 0.08 to 0.30 N per jet against the weight of a 20 g lid | +0.2 to +3 | too large |
| upper (supporting) | that ratio, upper basket minus lower basket | 3.53 | 2.65 | -0.883 1 | the advice is to put light plastics in the top rack | -0.01 or more | pass |

- **A**: lower basket. Load `lid-lower`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:404bc65633b0`, 1.4 s (exposure cached).
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 3.53 of its weight); it is simulated where it was placed
- **B**: upper basket. Load `lid-upper`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:559c35b0bf7e`, 1.4 s (exposure cached).
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 2.65 of its weight); it is simulated where it was placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | lid | 0.0177 | 0.386 | 210 | 32 | 1 | 1 | 10.9 | 37 | 0.858 | 0 |  | 5 | 0 | 0 | 8.73 |  |
| B | lid | 0.0365 | 0.425 | 347 | 27.9 | 1 | 1 | 21.2 | 91.6 | 1.97 | 0.035 | 6.04 mL, full for 7303 s | 5 | 0 | 6.09 | 2.11 |  |

### P42 Cutlery dries almost completely (negative control): not covered

Test: The cutlery of the IEC load.

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | points of the 0 to 1 drying scale the cutlery loses |  |  |  | drying 0.99 | |x| <= 0.04 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water standing in a piece of cutlery at the end, mean |  |  | 0 mL | it drains along its length | |x| <= 0.1 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0847 mmol/L (peak 0.444). Result `sha256:bd6b638df2cb`, 4.7 s (exposure cached).

### P43 Spots, film and tine marks on glass: not covered

Test: A test glass in the upper basket with rinse aid (A) and without (B).

Adapted: The wash has no input for water hardness or for running without rinse aid; B is washed as A until it has, and the scenario is reported as not covered.

Stages: drying and spotting (not built). Note: needs spots and film from evaporated water, and marks at contacts.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spots | spots on the glass, without rinse aid minus with |  |  |  | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: with rinse aid. Load `glass-free`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:29cde6a23d0b`, 1.2 s (exposure cached).
- **B**: without rinse aid. Load `glass-free`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:29cde6a23d0b`, 1.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass | 0.00444 | 0.533 | 271 | 25.4 | 1 | 1 | 3.68 | 18 | 0.873 | 0 |  | 5 | 0 | 0 | 1.14 |  |
| B | glass | 0.00444 | 0.533 | 271 | 25.4 | 1 | 1 | 3.68 | 18 | 0.873 | 0 |  | 5 | 0 | 0 | 1.14 |  |

### P44 Cutlery comes out clean although it is the most shadowed class: too small

Test: The IEC load of 13 place settings, loaded carefully, on the scored programme; class mean of the soiled cutlery.

Adapted: The pieces of the load that the careful loading policy fits into the machine as modelled (about 100 of 140).

Stages: water: droplets, run-off in the cutlery basket; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the soiled cutlery, as a distance from 4.6 to 4.8 |  |  | -1.39 score | class mean 4.6 to 4.8 | within 1 of the range | too small |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0847 mmol/L (peak 0.444). Result `sha256:bd6b638df2cb`, 4.7 s (exposure cached).

### P45 Class ranking in the standard test: pass

Test: The IEC load on the scored programme: mean scores of cutlery, melamine, glass and crockery, and overall.

Adapted: The pieces that fit (about 100 of 140); the load has no pots (the loader left them out), so that class is not scored.

Stages: the whole wash.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| overall | load mean IEC score, as a distance from 3.5 to 4.2 |  |  | -0.6 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range | pass |
| crockery | crockery mean, as a distance from 2.3 to 3.7 |  |  | -0.0576 score | crockery 2.3 to 3.7 | within 1 of the range | pass |
| glass | glass mean, as a distance from 2.3 to 4.0 |  |  | 0 score | glass 2.3 to 4.0 | within 1 of the range | pass |
| ranking | cutlery mean minus crockery mean |  |  | 0.968 score | cutlery > melamine > (pots, glass, crockery) | + (any size) | pass |
| melamine (supporting) | melamine mean minus crockery mean |  |  | 2.59 score | melamine above crockery | + (any size) | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0847 mmol/L (peak 0.444). Result `sha256:bd6b638df2cb`, 4.7 s (exposure cached).

### P46 Run-to-run repeatability: too small

Test: The IEC load washed with three seeds (level seed and simulation seed 1, 2 and 3); standard deviation of the load mean score.

Adapted: Three seeds. The seeds move the phase origin of the arms, the sampling of the droplets, and where on a region each soil lies and how thick; the tablet release time and the sensor decisions of the machine are fixed.

Stages: the whole wash (seeded sampling).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spread | standard deviation of the load mean IEC score over the three seeds |  |  | 0.0314 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 | too small |

- **A**: seeds 1. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0847 mmol/L (peak 0.444). Result `sha256:bd6b638df2cb`, 4.7 s (exposure cached).
- **B**: seeds 2. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (77 clean, mean score of the soiled 2.9), seeds 2/2. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0845 mmol/L (peak 0.444). Result `sha256:32fb43bc279a`, 8 s (exposure cached).
- **C**: seeds 3. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.97), seeds 3/3. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0846 mmol/L (peak 0.444). Result `sha256:4a661ddc9150`, 4.8 s (exposure cached).

### P47 Everything is wetted within seconds; jets are rare events: pass

Test: The IEC load on the scored programme: the share of the surface of the load that is wetted, and the fraction of time under a direct jet.

Adapted: The time-resolved first wetting is not recorded by the exposure (it stores the periodic state); what is checked is the wetted share in the periodic state and the water returning to the sump within a revolution.

Stages: water: jets, droplets, run-off.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | largest fraction of time under a direct jet of any item of the load (mean over its surface) |  |  | 0.0209 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 | pass |
| wetted | share of the surface of the load that no spray state wets |  |  | 3.6e-4 1 | everything is wetted | |x| <= 0.2 | pass |
| circuit (supporting) | share of the nozzle outflow not back in the sump within one revolution of the arm (largest of the spray states) |  |  | 0.0011 1 | water circuit under 3 s (a revolution takes 1.4 to 2.2 s) | |x| <= 0.5 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 118 items (78 clean, mean score of the soiled 2.9), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.127), peracid mean 0.0847 mmol/L (peak 0.444). Result `sha256:bd6b638df2cb`, 4.7 s (exposure cached).

### P48 Detergent does not change where water goes: pass

Test: A dessert plate in the lower basket washed with detergent (A) and with the dispenser blocked, so without any (B); the exposure of the two washes.

Adapted: The exposure of the simulation is computed for one liquor class and does not read the detergent at all, so this holds by construction: the check guards that it stays so.

Stages: water: jets (the exposure key excludes the liquor).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| jets | spray states whose exposure differs between the two washes |  |  | 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 | pass |

- **A**: with detergent. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:9fa1865ac278`, 0.3 s (exposure cached).
- **B**: without detergent. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 264 min with detergent, mean 45.8 C (max 61 C), pH 9.82 (max 10.4), protease mean 0.0151 g/L (peak 0.049), peracid mean 0.0061 mmol/L (peak 0.0244). Result `sha256:75b37c3b4b96`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 2347 | 0 | 1.02 | iec_egg_yolk (reaction) 39.9/1063 mg |
| B | plate (well) | 0.00613 | 0.602 | 195 | 24.2 | 1 | 1 | 4.61 | 30.1 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.02 | iec_egg_yolk (reaction) 981/1063 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

