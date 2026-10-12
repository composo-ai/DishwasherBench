# Phenomena suite: fast tier, packages/calibration/anchors/anchored-v7.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.5.0 water-7`; parameters packages/calibration/anchors/anchored-v7.owner-capsule.json (hydro `sha256:7c3bd46790e7`, soil `sha256:befdea03d920`, 18 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `f58d4ed8ab930946`. Exposure traced on: gpu. 48 phenomena, 82 washes (82 with cached exposure), 142.4 s.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v7.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 11 of 100 cases: 0 in 100 for crockery, 23 in 100 for cutlery, 5 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Verdicts: 17 pass, 2 wrong sign, 15 too small, 4 too large, 9 not covered, 1 error.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | pass | retained: 0.0446 -> 279: 279 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 |
| P02 | Soiled face turned away from the spray source | too large | f_jet: 4.1e-4 -> 1.6e-4: 0.376 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 |
| P03 | Plate pitch too small | pass | halving: 5 -> 3: -2 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 |
| P04 | Nesting or "spooning" of like items | too small | residue: 0.176 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 |
| P05 | Large flat item shadows what is behind or above it | error | score: 3.5 -> 3: -0.5 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P06 | Spray arm stalled by an item | pass | coverage: 0.408 -> 0: 0 1 | direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %) | |x| <= 0.2 |
| P07 | Radial position: centre against corner | too small | score: 3 -> 3: 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 |
| P08 | Left/right asymmetry with rotation direction | pass | score: 3 -> 5: 2 score | expect a change of up to 1 between mirrored positions | |x| <= 2 |
| P09 | Lean direction of plates | too small | score: 2 -> 2: 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 |
| P10 | Tall narrow vessel interior | too small | residue: 1.9e-11 -> 0: -1.9e-11 1 | the interior of the tall vessel is the last place to clean | +0.01 or more |
| P11 | Upper against lower rack for tenacious soil | pass | score: 3 -> 2: -1 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 |
| P12 | Alternating large and small plates | too small | score: 5 -> 5: 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 |
| P13 | Glass or cup placed over tines | too small | f_jet: 0.0123 -> 0.0119: -0.0399 1 | interior f_jet reduced | -0.05 or more |
| P14 | Soiled face against the tub wall or door liner | too small | score: 5 -> 5: 0 score | as P02: -1 to -2 | -0 to -4 |
| P15 | Nested spoons | pass | shielded: 0 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range |
| P16 | Heads up against heads down (not nested) | pass | score: 2 -> 2: 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 |
| P17 | Crowded basket cells | too small | crowding: 0 -> 0.0417: 0.0417 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 |
| P18 | Cutlery tray against basket | pass | water: 0 -> 2.02: 2.02 mL | spoon bowls facing up hold water | + (any size) |
| P19 | Loading beyond rated capacity | pass | mean: 4.27 -> 3.91: -0.36 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 |
| P20 | Total soil load | too small | mean: 4.05 -> 4.05: 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 |
| P21 | Redeposition of particulates | not covered | specks: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 |
| P22 | Clean neighbours of soiled items | pass | clean: 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 |
| P23 | End-of-cycle drips from the upper rack | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 |
| P24 | Arrangement does not matter for easy soils (negative control) | pass | range: 0.0682 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 |
| P25 | Detergent dispenser blocked | too large | protein: 0.265 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 |
| P26 | Tablet trapped or dissolving in a dead spot | not covered | score: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) | similar to under-dosing; size unknown: calibration parameter | - (any size) |
| P27 | Time and temperature trade | too large | score: 0 -> 3: 3 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 |
| P28 | Bleachable stains are position-insensitive (negative control) | pass | position: 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 |
| P29 | Ageing of the soil before the wash | pass | fresh: 0 score | crockery mean at least 4.5 fresh | within 1 of the range |
| P30 | Protein soil responds to hit frequency and chemistry, not to jet strength | pass | pump: 1 -> 1: 1.1e-5 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 |
| P31 | Starch is bimodal | too small | both: 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more |
| P32 | Microwaved milk on glass is persistent | too large | eco: 0.25 -> 5: 4.75 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 |
| P33 | Fat needs temperature and enough water | too small | temperature: 5.7e-22 -> 2.2e-13: 2.2e-13 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more |
| P34 | Thick layers detach as flakes | not covered | flakes: needs detachment of thick layers as flakes | thick egg yolk partly tended to flake off | + (any size) |
| P35 | Pot interiors | too small | side: 0 -> 0: 0 1 | on its side, half the wall is shadowed | +0.01 or more |
| P36 | Water pools in the base recess of inverted cups and mugs | pass | pool: 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 |
| P37 | Tilt drains the recess | too small | tilt15: 5 -> 0.111: 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 |
| P38 | Plastic stays wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 |
| P39 | Pots and large hollow ware stay wet | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 |
| P40 | Liquid held at contact points and in narrow gaps | wrong sign | held: 2.58 -> 2.3: -0.277 g | a wet mark at every touching pair | + (any size) |
| P41 | Light plastic items are moved or flipped by jets | not covered | moved: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) |
| P42 | Cutlery dries almost completely (negative control) | not covered | drying: needs drying (evaporation of the retained film, the drying score, drips after the last drain) | drying 0.99 | |x| <= 0.04 |
| P43 | Spots, film and tine marks on glass | not covered | spots: needs spots and film from evaporated water, and marks at contacts | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) |
| P44 | Cutlery comes out clean although it is the most shadowed class | too small | class: -1.05 score | class mean 4.6 to 4.8 | within 1 of the range |
| P45 | Class ranking in the standard test | wrong sign | ranking: -0.594 score | cutlery > melamine > (pots, glass, crockery) | + (any size) |
| P46 | Run-to-run repeatability | too small | spread: 0.0342 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 |
| P47 | Everything is wetted within seconds; jets are rare events | pass | f_jet: 0.0207 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 |
| P48 | Detergent does not change where water goes | pass | jets: 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 |

## Phenomena

### P01 Hollow item loaded open side up: pass

Test: A mug with tea film and a cereal bowl with porridge on the floor of the upper basket: mouth down (A) against mouth up (B).

Adapted: Upper basket of the Bosch (served from below by the upper arm and from above by the roof sprayer). Both orientations are dropped at the same spots and settle on the wires; the upright bowl slides about 13 cm before it rests.

Stages: water: scene (basins), jets, pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| retained | water the mug holds at the end, B - A | 0.0446 | 279 | 279 mL | retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug | +125 to +600 | pass |
| f_jet | fraction of time the inside of the upright mug is under a direct jet from below (B) |  |  | 0 1 | f_jet inside = 0 | |x| <= 0.002 | pass |
| bowl (supporting) | water the bowl holds at the end, B - A | 0 | 180 | 180 mL | the bowl fills too | + (any size) | pass |
| drying (supporting) | drying score of the upright mug (B) |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: mouth down. Load `hollow-inverted`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:23c9dab7979a`, 2 s (exposure cached).
- **B**: mouth up. Load `hollow-upright`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:a24e6e55314f`, 2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (interior) | 0.00852 | 0.62 | 417 | 28.8 | 1 | 1 | 2.9 | 22 | 0.848 | 0 | 0.0446 mL, full for 10009 s | 3 | 13.2 | 0.0446 | 1.48 | iec_tea (bleach) 0.23/5.77 mg |
| A | bowl (interior) | 0.134 | 0.982 | 366 | 26.7 | 1 | 1 | 16.8 | 65.5 | 1.42 | 0 |  | 5 | 0 | 0 | 2.06 | iec_oat_flakes (reaction) 0/161 mg |
| B | mug (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 11.3 | 0.704 | 0.945 | 279 mL, full for 9871 s | 0 | 675 | 279 | 1.65 | iec_tea (bleach) 0.325/5.77 mg |
| B | bowl (interior) | 0 | 0 | 0 | 0 | 1 | 1 | 8.17 | 26 | 0.897 | 0.579 | 180 mL, full for 9991 s | 5 | 0 | 180 | 1.91 | iec_oat_flakes (reaction) 0/161 mg |

### P02 Soiled face turned away from the spray source: too large

Test: A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D).

Adapted: A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate faces the axis tipped up with the tines. The pair of the first build that compared the seated plate with one put in reversed is gone: on the present basket the loader does not seat a reversed plate in that slot, and the seated plate turned round in place cuts 2 mm into the tines.

Stages: water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 4.1e-4 | 1.6e-4 | 0.376 1 | f_jet on the soiled face drops to about 0 | |x| <= 0.1 | too large |
| score | change of the IEC score of the plate, B - A | 2 | 2 | 0 score | for oven-dried protein and starch, -1 to -2 | -0 to -4 | too small |
| residue (supporting) | share of the egg yolk left on the face, B - A | 8.5e-5 | 1.6e-4 | 8.0e-5 1 | removal depends on how often the spot is hit | +0.01 or more | too small |

- **A**: upright, face to the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:639cd9eb7899`, 1.6 s (exposure cached).
- **B**: upright, face away from the arm axis (set pose). Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:1372721e8c02`, 2.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 4.1e-4 | 0.337 | 264 | 32.6 | 1 | 1 | 4.48 | 31.2 | 1.07 | 0 |  | 2 | 6.7 | 0 | 0.88 | iec_egg_yolk (reaction) 0.0901/1063 mg |
| B | plate (well) | 1.6e-4 | 0.135 | 37.3 | 19.1 | 1 | 1 | 0.674 | 8.26 | 0.692 | 0 |  | 2 | 14.4 | 0 | 0.877 | iec_egg_yolk (reaction) 0.175/1063 mg |

### P03 Plate pitch too small: pass

Test: Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot half a pitch apart (about 9 mm from plate to plate, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other).

Adapted: The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become half a pitch, every slot and every second slot. Seven plates per row (eight when crowded). A and C are settled by the loading physics between the tines. B cannot be: a slot is 14 mm wide, two plates in it nest (the covered well under 1 mm from its partner's back over its whole area: a contact, not a narrow gap; found by the review of 11 October 2026), and a plate half a pitch in front of a seated one stands in the next tine. For B the tines of the rear lane are folded down and the row is set from the seat the physics gave the plate behind in slot 6: the covered plate of every pair stands at that seat, two slots along per pair, its partner parallel to it half a pitch (9.1 mm) in front, and the whole row is raised by the 11 mm at which it clears the folded tines; the covered well then looks into a gap of 3.7 to 5 mm. So B differs from A by the pitch, by 11 mm of height and by the tines, which in A stand in front of the foot of every plate.

Stages: water: jets (gap geometry), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| halving | IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm | 5 | 3 | -2 score | halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half | -0 to -3 | pass |
| plateau | IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm | 5 | 5 | 0 score | above about 20 mm, more gap gains little | |x| <= 1 | pass |
| dwell (supporting) | fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one | 0.00309 | 1.4e-6 | -1 1 | halving the gap halves the dwell | -0.25 to -1 | pass |

- **A**: one per slot, 18.25 mm. Load `plates-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.71), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.111), peracid mean 0.0928 mmol/L (peak 0.446). Result `sha256:f647553a968b`, 3.2 s (exposure cached).
- **B**: two to a slot, about 9 mm. Load `plates-9`, programme `eco_50`, 8 items (8 clean, mean score of the soiled 4.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.112), peracid mean 0.0924 mmol/L (peak 0.446). Result `sha256:e72a5994a701`, 3.6 s (exposure cached).
- **C**: every second slot, 36.5 mm. Load `plates-36`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.71), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.111), peracid mean 0.0927 mmol/L (peak 0.446). Result `sha256:c9d2cc1850ec`, 1.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00309 | 0.451 | 67 | 17.9 | 1 | 1 | 1.18 | 12.3 | 0.804 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 6.9e-5/1527 mg |
| B | plate_6 (well) | 1.4e-6 | 0.0012 | 11.2 | 10.3 | 1 | 1 | 0.621 | 8.06 | 0.686 | 0 |  | 4 | 1.61 | 0 | 1.69 | iec_egg_yolk (reaction) 0.0216/1605 mg |
| C | plate_4 (well) | 0.00664 | 0.46 | 182 | 20 | 1 | 1 | 2.26 | 18.6 | 0.963 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 2.4e-5/1527 mg |

### P04 Nesting or "spooning" of like items: too small

Test: Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B).

Adapted: The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| residue | share of the porridge left inside the covering bowl when nested (B) |  |  | 0.176 1 | residual soil in the overlapped zone at least 50 % | +0.25 to +1 | too small |
| score | IEC score of the covering bowl when nested (B) |  |  | 0 score | if the overlapped soiled area exceeds 200 mm2 the item scores 0 | |x| <= 1 | pass |
| against (supporting) | share of the porridge left inside that bowl, B - A | 0 | 0.176 | 0.176 1 | nesting leaves more | +0.01 or more | pass |
| f_jet (supporting) | fraction of time its inside is under a direct jet, B over A | 0.0795 | 0 | 0 1 | overlapped surfaces have no line of sight | |x| <= 0.5 | pass |

- **A**: side by side. Load `bowls-apart`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:d9bbb0b9fb06`, 1.9 s (exposure cached).
- **B**: nested. Load `bowls-nested`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 2.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:07ffca913566`, 2.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl_over (interior) | 0.0795 | 0.966 | 263 | 27.7 | 1 | 1 | 11.3 | 50.4 | 1.21 | 0 |  | 5 | 0 | 0 | 2.14 | iec_oat_flakes (reaction) 0/177 mg |
| B | bowl_over (interior) | 0 | 0 | 0 | 0 | 0.947 | 1 | 0.00252 | 0.0935 | 0.0628 | 0 |  | 0 | 3838 | 0 | 3.13 | iec_oat_flakes (reaction) 31.1/177 mg |

### P05 Large flat item shadows what is behind or above it: error

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws. Note: wash B: the set pose cuts 2.0 mm (board into plate_2).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 3.5 | 3 | -0.5 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | pass |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 7.4e-5 | 4.6e-5 | -0.378 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `eco_50`, 3 items (2 clean, mean score of the soiled 3.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.109), peracid mean 0.0953 mmol/L (peak 0.446). Result `sha256:51373b9200ab`, 1.9 s (exposure cached).
- **B**: platter upright between the plates and the arm axis (set pose). Load `board-side`, programme `eco_50`, 3 items (1 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.109), peracid mean 0.0953 mmol/L (peak 0.446). Result `sha256:7540f2b51536`, 2 s (exposure cached).
  - set pose: deepest overlap 2.04 mm (board into plate_2)
  - wash: placement: board stands in the path of the upper spray arm, which is simulated turning through it; give stalledArms for this level to hold the arm
  - wash: placement: board cuts 2.0 mm into plate_2; both are simulated where they were placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 8.7e-5 | 0.0787 | 245 | 31 | 1 | 1 | 1.54 | 14 | 0.864 | 0 |  | 3 | 1.1 | 0 | 1.02 | iec_egg_yolk (reaction) 0.0154/985 mg |
| A | plate_2 (well) | 6.2e-5 | 0.0657 | 39.7 | 23.2 | 1 | 1 | 3.3 | 22.9 | 1.09 | 0 |  | 4 | 2.38 | 0 | 1.03 | iec_egg_yolk (reaction) 0.0343/969 mg |
| B | plate_1 (well) | 8.7e-5 | 0.0787 | 245 | 31 | 1 | 1 | 1.41 | 13.2 | 0.834 | 0 |  | 3 | 1.59 | 0 | 1.03 | iec_egg_yolk (reaction) 0.0202/985 mg |
| B | plate_2 (well) | 5.9e-6 | 0.0295 | 33 | 23.3 | 1 | 1 | 1.49 | 10 | 1.02 | 0 |  | 3 | 4.27 | 0 | 1.84 | iec_egg_yolk (reaction) 0.0631/969 mg |

### P06 Spray arm stalled by an item: pass

Test: Seven IEC dinner plates with egg yolk in every second slot of the rear lane (A); the same with a ladle let down through the floor of the lower basket until it hangs in the path of the lower arm (B).

Adapted: A ladle stands in for the fork: a fork slips through the floor grid of this basket and falls, a ladle hangs by its bowl. On the present basket the ladle no longer hangs through the floor, so the arm is held by the scenario at the angle the first build's check found (148 degrees round); the wash takes a held arm as it takes one a load stops.

Stages: load: session (mechanical check); water: hydraulics (stalled arm), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| coverage | share of the plates' faces ever under a direct jet, B over A | 0.408 | 0 | 0 1 | direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %) | |x| <= 0.2 | pass |
| score | mean IEC score of the plates of that rack, B - A | 4.71 | 4 | -0.714 score | mean score of that rack -1.5 or more | -0.5 to -5 | pass |

- **A**: arm free. Load `plates-36`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.71), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.111), peracid mean 0.0927 mmol/L (peak 0.446). Result `sha256:c9d2cc1850ec`, 1.4 s (exposure cached).
- **B**: lower arm held 148 degrees round (set: where the hanging ladle of the first build stopped it). Load `plates-36`, programme `eco_50`, 7 items (5 clean, mean score of the soiled 4), seeds 1/1, lower arm stopped. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0929 mmol/L (peak 0.446). Result `sha256:6d3d32b1d519`, 3.1 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 (well) | 0.00664 | 0.46 | 182 | 20 | 1 | 1 | 2.26 | 18.6 | 0.963 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 2.4e-5/1527 mg |
| B | plate_4 (well) | 0 | 0 | 0 | 0 | 1 | 1 | 1.16 | 12.2 | 0.856 | 0 |  | 5 | 0 | 0 | 1.65 | iec_egg_yolk (reaction) 8.0e-5/1527 mg |

### P07 Radial position: centre against corner: too small

Test: Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle).

Adapted: The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.

Stages: water: hydraulics (nozzle positions), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate at the corner against the one at mid-radius | 3 | 3 | 0 score | -0.5 to -1 for tenacious soil in a corner against mid-radius | -0 to -2 | too small |
| dwell (supporting) | fraction of time the face is under a direct jet, corner over mid-radius, minus one | 0.0138 | 0.00977 | -0.292 1 | low radial locations are impacted for longer | -0.05 or more | pass |

- **A**: four soup plates. Load `soup-radial`, programme `eco_50`, 4 items (1 clean, mean score of the soiled 3.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.109), peracid mean 0.0942 mmol/L (peak 0.446). Result `sha256:56b4844698b6`, 2.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_1 (well) | 0.00238 | 0.364 | 207 | 21.9 | 1 | 1 | 4.91 | 28.7 | 0.972 | 0 |  | 3 | 4.75 | 0 | 1.6 | iec_egg_yolk (reaction) 0.0849/1478 mg |
| A | soup_2 (well) | 0.0138 | 0.709 | 204 | 21.7 | 1 | 1 | 5.67 | 32.1 | 1.1 | 0 |  | 3 | 1.19 | 0 | 1.54 | iec_egg_yolk (reaction) 0.0173/1574 mg |
| A | soup_3 (well) | 0.00977 | 0.669 | 333 | 29.7 | 1 | 1 | 4.67 | 26.9 | 0.956 | 0 |  | 3 | 3.01 | 0 | 1.88 | iec_egg_yolk (reaction) 0.0422/1552 mg |

### P08 Left/right asymmetry with rotation direction: pass

Test: Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis.

Adapted: The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.

Stages: water: hydraulics (nozzle directions, sense of rotation), jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the right-hand plate minus the left-hand one | 3 | 5 | 2 score | expect a change of up to 1 between mirrored positions | |x| <= 2 | pass |
| jets (supporting) | fraction of time the face is under a direct jet, right over left, minus one | 0.00977 | 0.016 | 0.642 1 | in one real arm a right-hand plate received five jets and its mirror image two | |x| <= 3 | pass |

- **A**: mirrored plates. Load `soup-radial`, programme `eco_50`, 4 items (1 clean, mean score of the soiled 3.5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.109), peracid mean 0.0942 mmol/L (peak 0.446). Result `sha256:56b4844698b6`, 2.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_3 (well) | 0.00977 | 0.669 | 333 | 29.7 | 1 | 1 | 4.67 | 26.9 | 0.956 | 0 |  | 3 | 3.01 | 0 | 1.88 | iec_egg_yolk (reaction) 0.0422/1552 mg |
| A | soup_4 (well) | 0.016 | 0.648 | 288 | 25.8 | 1 | 1 | 5.28 | 31.7 | 1.18 | 0 |  | 5 | 0 | 0 | 1.38 | iec_egg_yolk (reaction) 0.00113/1509 mg |

### P09 Lean direction of plates: too small

Test: A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up).

Adapted: The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.

Stages: water: jets (incidence), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 2 | 2 | 0 score | same sign as P02 at smaller size: about 0.5 for a 10 degree lean | -0 to -1.5 | too small |
| f_jet (supporting) | fraction of time the soiled face is under a direct jet, B over A, minus one | 0.00959 | 1.8e-4 | -0.981 1 | leaning away presents the back | -0.05 or more | pass |

- **A**: leaning toward the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:cfa3845a08a6`, 1.8 s (exposure cached).
- **B**: leaning away from the arm axis. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:9d5252e8058a`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00959 | 0.866 | 363 | 30.4 | 1 | 1 | 12 | 59.1 | 1.31 | 0 |  | 2 | 4.59 | 0 | 0.982 | iec_egg_yolk (reaction) 0.066/1063 mg |
| B | plate (well) | 1.8e-4 | 0.141 | 42.7 | 20.8 | 1 | 1 | 1.98 | 16.5 | 0.945 | 0 |  | 2 | 4.61 | 0 | 0.948 | iec_egg_yolk (reaction) 0.0672/1063 mg |

### P10 Tall narrow vessel interior: too small

Test: A 250 mL test glass (B) against a shallow dessert bowl (A), each with microwaved milk inside, mouth down at the same spot of the upper basket.

Adapted: Upper basket; both settle on the wires leaning on the same tine row.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws, chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| glass | IEC score of the glass, as a distance from the range 2.3 to 4.0 (B) |  |  | 1 score | standard glass class (baked milk) scores 2.3 to 4.0 | within 1 of the range | pass |
| residue | share of the milk left, glass minus bowl | 1.9e-11 | 0 | -1.9e-11 1 | the interior of the tall vessel is the last place to clean | +0.01 or more | too small |
| f_jet (supporting) | fraction of time the inside is under a direct jet, glass over bowl, minus one | 0.144 | 0.0128 | -0.911 1 | a 60 mm opening is under a nozzle for about 6 % of a revolution | -0.05 or more | pass |

- **A**: shallow bowl. Load `bowl-same-spot`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:4f78985d94ac`, 1.6 s (exposure cached).
- **B**: tall glass. Load `glass-between`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:7d2995d45351`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | bowl (interior) | 0.144 | 0.954 | 260 | 27.5 | 1 | 1 | 15.2 | 59.1 | 1.31 | 0 |  | 5 | 0 | 0 | 1.35 | iec_milk (reaction) 9.6e-9/503 mg |
| B | glass (interior) | 0.0128 | 0.448 | 401 | 26.4 | 1 | 1 | 5.57 | 37.2 | 1.1 | 0 |  | 5 | 0 | 0 | 0.949 | iec_milk (reaction) 0/528 mg |

### P11 Upper against lower rack for tenacious soil: pass

Test: The same dessert plate with egg yolk standing in the rear lane of the lower basket (A) and in the rows of the upper basket (B).

Adapted: The dessert plate is the largest plate the upper basket takes. In the upper rows it does not stand as in the lower ones: the loading physics leaves it leaning about 50 degrees against the tines, which is the pose washed.

Stages: water: hydraulics (flow per level), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A | 3 | 2 | -1 score | in a three-level machine expect an absolute change of at most 0.5 | |x| <= 1 | pass |
| residue (supporting) | share of the egg yolk left, B - A | 3.6e-5 | 6.8e-5 | 3.2e-5 1 | little difference between the baskets | |x| <= 0.4 | pass |

- **A**: lower basket. Load `dplate-lower`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:1f6b0df85afe`, 0.4 s (exposure cached).
- **B**: upper basket. Load `dplate-upper`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:377e34f83021`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.011 | 0.757 | 273 | 24.3 | 1 | 1 | 5.85 | 36.2 | 1.32 | 0 |  | 3 | 2.4 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0381/1063 mg |
| B | plate (well) | 5.7e-4 | 0.158 | 163 | 23 | 1 | 1 | 1.14 | 12 | 0.816 | 0 |  | 2 | 4.92 | 0 | 1.03 | iec_egg_yolk (reaction) 0.0726/1063 mg |

### P12 Alternating large and small plates: too small

Test: Dinner plates with egg yolk in neighbouring slots of the rear lane (A) against dinner and dessert plates alternating at the same 18.25 mm pitch (B); the dinner plate at slot 5 is scored on its upper half.

Adapted: Pitch 18.25 mm (the tines of the Bosch) instead of 15 mm.

Stages: water: jets (gap geometry); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the upper half of the large plate at slot 5, B - A | 5 | 5 | 0 score | +0.3 to +0.5 on the upper zone of the large plates | +0 to +1.5 | too small |
| residue (supporting) | share of the egg yolk left on the upper half of that plate, B - A | 2.8e-9 | 2.6e-8 | 2.3e-8 1 | the wider gap above the small plates lets more through | -0.01 or more | wrong sign |

- **A**: large plates only. Load `plates-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.71), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0727 g/L (peak 0.111), peracid mean 0.0928 mmol/L (peak 0.446). Result `sha256:f647553a968b`, 3.2 s (exposure cached).
- **B**: large and small alternating. Load `plates-alt-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.57), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0933 mmol/L (peak 0.446). Result `sha256:221e14123820`, 2.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_3 (well) | 0.00246 | 0.485 | 207 | 19.5 | 1 | 1 | 2.01 | 17.2 | 0.962 | 0 |  | 5 | 0 | 0 | 1.67 | iec_egg_yolk (reaction) 3.1e-6/1383 mg |
| B | plate_2 (well) | 0.00304 | 0.465 | 207 | 19.3 | 1 | 1 | 1.35 | 13.6 | 0.847 | 0 |  | 5 | 0 | 0 | 1.66 | iec_egg_yolk (reaction) 1.5e-4/1453 mg |

### P13 Glass or cup placed over tines: too small

Test: A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A).

Adapted: Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.

Stages: water: jets (tine in the path), droplets (fans off the tine), scene (contacts).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the inside is under a direct jet, B over A, minus one | 0.0123 | 0.0119 | -0.0399 1 | interior f_jet reduced | -0.05 or more | too small |
| marks (supporting) | contact marks on the glass over the tine (B) |  |  |  | AHAM adds 1 to 3 grade points per marked glass | +0.5 to +6 | not covered: needs spots and film from evaporated water, and marks at contacts |
| drying (supporting) | change of the drying score, B - A |  |  |  | drying score -1 | -0.5 to -2 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: row folded down: no tine in the glass. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:e4061a3a49bf`, 2.6 s (exposure cached).
- **B**: over a tine. Load `glass-free`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:52cc17782e33`, 1.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass (interior) | 0.0123 | 0.645 | 188 | 30.3 | 1 | 1 | 4.77 | 33.8 | 1.06 | 0 |  | 5 | 0 | 0 | 2.73 | iec_milk (reaction) 0/528 mg |
| B | glass (interior) | 0.0119 | 0.645 | 188 | 30.1 | 1 | 1 | 4.61 | 32.9 | 1.06 | 0 |  | 5 | 0 | 0 | 2.74 | iec_milk (reaction) 0/528 mg |

### P14 Soiled face against the tub wall or door liner: too small

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the loading physics seats the platter face inward and does not seat it reversed on the present basket, so both ways round are set poses: the platter exactly upright 30 mm outboard of its outermost seat, between the last tine and the side wall of the basket, the one place where it clears the tines either way round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00758 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 5 | 5 | 0 score | as P02: -1 to -2 | -0 to -4 | too small |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 33 | 1.98 | -0.94 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 2.8e-12 | 8.9e-8 | 8.9e-8 1 | the face to the wall keeps more | +0.01 or more | too small |

- **A**: face inward: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:25e4837f56ce`, 1.7 s (exposure cached).
- **B**: face to the wall: upright between the last tine and the side wall (set pose). Load `platter-inward`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:2b549b071c89`, 2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00758 | 0.53 | 325 | 29.7 | 1 | 1 | 5.26 | 33 | 1.27 | 0 |  | 5 | 0 | 0 | 0.879 | iec_egg_yolk (reaction) 2.8e-9/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.0748 | 1.98 | 0.348 | 0 |  | 5 | 0 | 0 | 0.924 | iec_egg_yolk (reaction) 9.1e-5/1026 mg |

### P15 Nested spoons: pass

Test: Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B).

Adapted: Cell c01 of the cutlery basket of the Bosch. The opposed pair and the first spoon of the nested pair are settled by the loading physics; the second spoon of the nested pair is set (the physics lets it slide off and rest across the first, touching at a point): it lies behind the first, the back of the first in its hollow, 10 cm2 of the hollow within 1 mm and nowhere nearer than 0.5 mm.

Stages: water: scene (contacts, gap field), jets, run-off; soil: supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| shielded | IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1 |  |  | 0 score | shielded spoon scores 0 to 1 with porridge or egg | within 1 of the range | pass |
| partner | IEC score of the other spoon, nested minus opposed | 5 | 5 | 0 score | partner unaffected | |x| <= 1 | pass |
| residue (supporting) | largest share of porridge left on a spoon, nested minus opposed | 0 | 0.0835 | 0.0835 1 | when spoons spoon, they trap food | +0.01 or more | pass |

- **A**: opposed. Load `spoons-opposed`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:69692fc664a5`, 1.9 s (exposure cached).
- **B**: nested. Load `spoons-nested`, programme `eco_50`, 2 items (1 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:8ca8c1c64542`, 1.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 4.6e-5 | 0.112 | 94.9 | 36 | 1 | 1 | 0.142 | 13.7 | 0.873 | 0 |  | 5 | 0 | 0 | 0.139 | iec_oat_flakes (reaction) 0/23.6 mg |
| A | spoon_2 (bowl) | 0.00643 | 0.755 | 227 | 37.8 | 1 | 1 | 1.76 | 25.9 | 0.851 | 0 |  | 5 | 0 | 0 | 0.224 | iec_oat_flakes (reaction) 0/24.3 mg |
| B | spoon_1 (bowl) | 7.3e-5 | 0.158 | 186 | 52 | 1 | 1 | 0.212 | 18 | 0.901 | 0 |  | 5 | 0 | 0 | 0.603 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_2 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 0.0175 | 0.109 | 0.337 | 0 |  | 1 | 193 | 0 | 0.595 | iec_oat_flakes (reaction) 2.02/24.3 mg |

### P16 Heads up against heads down (not nested): pass

Test: Six dinner forks with egg yolk on the tines, one per cell of the cutlery basket: handles down (A) against handles up (B).

Adapted: Six forks, one per cell: the cutlery basket of the Bosch has six cells, not twelve.

Stages: water: jets (basket walls), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the forks, B - A | 2 | 2 | 0 score | negative control: absolute change at most 0.3 | |x| <= 0.6 | pass |
| residue (supporting) | mean share of the egg yolk left on the forks, B - A | 0.00265 | 0.00105 | -0.0016 1 | an informal test found no difference | |x| <= 0.2 | pass |

- **A**: heads up. Load `forks-heads-up`, programme `eco_50`, 6 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:9d62715a1077`, 2.1 s (exposure cached).
- **B**: heads down. Load `forks-heads-down`, programme `eco_50`, 6 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:a0b65f65e32f`, 1.8 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | fork_1 (tines) | 9.4e-4 | 0.231 | 238 | 44.2 | 1 | 1 | 2.98 | 49 | 1.52 | 0 |  | 2 | 23.2 | 0 | 0.0713 | iec_egg_yolk (reaction) 0.513/156 mg |
| B | fork_1 (tines) | 0.00228 | 0.497 | 279 | 42.7 | 1 | 1 | 6.51 | 64.3 | 1.83 | 0 |  | 2 | 15.5 | 0 | 0.175 | iec_egg_yolk (reaction) 0.189/156 mg |

### P17 Crowded basket cells: too small

Test: Dessert spoons with porridge in their bowls, handles down in the six cells of the cutlery basket: one (A), two (B) and four (C) per cell.

Adapted: Six, twelve and twenty-four spoons in the six cells of the Bosch; each load is settled by the loading physics.

Stages: load: physics (contacts); water: scene (contacts), jets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| crowding | share of spoons not scoring 5, four per cell minus one per cell | 0 | 0.0417 | 0.0417 1 | from about 20 % to above 50 % with three or more like pieces per cell | +0.15 to +1 | too small |
| single (supporting) | share of spoons not scoring 5 at one per cell, as a distance from 10 to 40 % |  |  | -0.1 1 | about 20 % of cutlery not scoring 5 in the standard load | within 0.1 of the range | pass |
| residue (supporting) | mean share of porridge left, four per cell minus one per cell | 0 | 6.9e-6 | 6.9e-6 1 | crowding leaves more | +0.05 or more | too small |

- **A**: one per cell. Load `spoons-1`, programme `eco_50`, 6 items (6 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:ec574493240e`, 1.5 s (exposure cached).
- **B**: two per cell. Load `spoons-2`, programme `eco_50`, 12 items (12 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:91578ad051f4`, 2 s (exposure cached).
- **C**: four per cell. Load `spoons-4`, programme `eco_50`, 24 items (24 clean, mean score of the soiled 4.96), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:e4215dbf4821`, 2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.00769 | 0.838 | 201 | 34.3 | 1 | 1 | 2.25 | 31.3 | 0.923 | 0 |  | 5 | 0 | 0 | 0.0914 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_1 (bowl) | 0.0088 | 0.831 | 188 | 34.7 | 1 | 1 | 2.16 | 29.6 | 0.923 | 0 |  | 5 | 0 | 0 | 0.147 | iec_oat_flakes (reaction) 0/23.6 mg |
| C | spoon_1 (bowl) | 0.0102 | 0.874 | 219 | 35.1 | 1 | 1 | 2.56 | 30.2 | 0.921 | 0 |  | 5 | 0 | 0 | 0.179 | iec_oat_flakes (reaction) 0/23.6 mg |

### P18 Cutlery tray against basket: pass

Test: Six dessert spoons with porridge in their bowls: standing in the cutlery basket (A) against lying flat, bowls up, on the knife shelf of the upper basket (B).

Adapted: The owner's machine has no cutlery drawer; the knife shelf of the upper basket is where pieces lie flat, so it stands in for the tray.

Stages: water: scene (basins of small hollows), pools; soil: replay under a pool.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| water | water standing in a spoon at the end, mean, B - A | 0 | 2.02 | 2.02 mL | spoon bowls facing up hold water | + (any size) | pass |
| drying (supporting) | drying score of the spoons lying bowl up (B) |  |  |  | drying score on face-up spoon bowls 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: standing in the basket. Load `spoons-1`, programme `eco_50`, 6 items (6 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:ec574493240e`, 1.5 s (exposure cached).
- **B**: lying on the knife shelf. Load `spoons-shelf`, programme `eco_50`, 6 items (0 clean, mean score of the soiled 4.17), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0958 mmol/L (peak 0.446). Result `sha256:4d8ecb8c1395`, 2.1 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | spoon_1 (bowl) | 0.00769 | 0.838 | 201 | 34.3 | 1 | 1 | 2.25 | 31.3 | 0.923 | 0 |  | 5 | 0 | 0 | 0.0914 | iec_oat_flakes (reaction) 0/23.6 mg |
| B | spoon_1 (bowl) | 0 | 0 | 0 | 0 | 1 | 1 | 1.46 | 31.2 | 0.815 | 0.444 | 1.32 mL, full for 10006 s | 3 | 4.42 | 1.32 | 2.55 | iec_oat_flakes (reaction) 0.0182/23.6 mg |

### P19 Loading beyond rated capacity: pass

Test: Six place settings well spaced (A) against the full IEC load one piece to a slot (B, nearly twice the pieces), both settled by the careful loading policy; mean IEC score of the soiled pieces.

Adapted: The machine as modelled does not take the rated 140 pieces: the careful loader fits about 100. A load "beyond what fits" cannot be built by a loader that refuses what does not hold, so the contrast run here is half load against full load (about 80 % more pieces), not rated against rated + 30 %.

Stages: load: loader; water: jets (shadowing), run-off; soil: liquor (soil load).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the soiled pieces, B - A | 4.27 | 3.91 | -0.36 score | load mean -0.5 to -1 when 30 % more items are forced in | -0 to -2 | pass |

- **A**: half load, well spaced. Load `loader:half-careful`, programme `eco_50`, 59 items (50 clean, mean score of the soiled 4.27), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0729 g/L (peak 0.113), peracid mean 0.0874 mmol/L (peak 0.444). Result `sha256:41f33f69c4fe`, 5.7 s (exposure cached).
- **B**: full load, one piece to a slot. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.91), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0839 mmol/L (peak 0.444). Result `sha256:a3a155d938cc`, 8.5 s (exposure cached).

### P20 Total soil load: too small

Test: The IEC load in one geometry with a quarter (A), half (B) and all (C) of its pieces soiled; mean IEC score of the pieces that are soiled in all three.

Adapted: Every fourth piece of the load (by position in its list) is the quarter; every second the half.

Stages: soil: liquor (consumption of oxidant and enzyme by soil), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| mean | mean IEC score of the always-soiled quarter, all soiled minus a quarter soiled | 4.05 | 4.05 | 0 score | US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100 | -0.25 to -5 | too small |

- **A**: a quarter of the pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (108 clean, mean score of the soiled 4.05), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0728 g/L (peak 0.117), peracid mean 0.0902 mmol/L (peak 0.445). Result `sha256:f4c3f7fb5b80`, 1.6 s (exposure cached).
- **B**: half of the pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (103 clean, mean score of the soiled 4.09), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0729 g/L (peak 0.117), peracid mean 0.088 mmol/L (peak 0.445). Result `sha256:2b4b1b2fa74b`, 2.5 s (exposure cached).
- **C**: all pieces soiled. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.91), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0839 mmol/L (peak 0.444). Result `sha256:a3a155d938cc`, 8.5 s (exposure cached).

### P21 Redeposition of particulates: not covered

Test: Seven clean dinner plates (A) against the same with 20 g of minced spinach on one of them (B); specks on the plates that started clean.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: redeposition (not built). Note: needs redeposition of particles (soil carried by the liquor and settled on other surfaces).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| specks | share of the plates that started clean and carry 1 to 4 specks, B - A |  |  |  | more than half of otherwise clean items carry 1 to 4 specks | +0.25 to +1 | not covered: needs redeposition of particles (soil carried by the liquor and settled on other surfaces) |

- **A**: no spinach. Load `plates-18`, programme `eco_50`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:aa888fe7a5fa`, 0.4 s (exposure cached).
- **B**: 20 g of spinach on one plate. Load `plates-18`, programme `eco_50`, 7 items (6 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:9883b08a6e64`, 0.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | plate_3 | 0.00509 | 0.495 | 312 | 25.2 | 1 | 1 | 3.37 | 20.6 | 0.954 | 0 |  | 5 | 0 | 0 | 1.67 |  |

### P22 Clean neighbours of soiled items: pass

Test: Seven dinner plates in neighbouring slots, every second one with egg yolk; the clean ones are scored.

Adapted: A row of plates in the lower basket instead of a whole load.

Stages: soil: liquor, redeposition (not built: the clean plates cannot pick anything up).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clean | points the clean plates lose (5 minus their mean IEC score) |  |  | 0 score | small: the index stays 95 to 98 at lighter soil | |x| <= 0.5 | pass |

- **A**: clean and soiled alternating. Load `plates-18`, programme `eco_50`, 7 items (7 clean, mean score of the soiled 4.75), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0941 mmol/L (peak 0.446). Result `sha256:e9a07630f73d`, 1 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00483 | 0.476 | 420 | 26 | 1 | 1 | 2.55 | 16.5 | 0.89 | 0 |  | 5 | 0 | 0 | 1.65 |  |

### P23 End-of-cycle drips from the upper rack: not covered

Test: Seven dinner plates in the lower basket with an empty upper basket (A) against three mugs mouth down in the upper basket (B).

Adapted: Three mugs stand for the loaded upper basket.

Stages: water: drain-down after the last rinse and drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale) of the lower plates, B - A |  |  |  | lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 | -0.05 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film on the lower plates at the end of the last rinse, mean, B - A | 1.66 | 1.68 | 0.0242 g | drips from above add water | + (any size) | pass |

- **A**: upper basket empty. Load `plates-18`, programme `eco_50`, 7 items (7 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:aa888fe7a5fa`, 0.4 s (exposure cached).
- **B**: upper basket loaded. Load `plates-18-upper`, programme `eco_50`, 10 items (10 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:42dd62e6fdb1`, 2.2 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_4 | 0.00483 | 0.476 | 420 | 26 | 1 | 1 | 2.55 | 16.5 | 0.89 | 0 |  | 5 | 0 | 0 | 1.65 |  |
| B | plate_4 | 0.00483 | 0.476 | 420 | 26 | 1 | 1 | 2.31 | 15 | 0.827 | 0 |  | 5 | 0 | 0 | 1.64 |  |

### P24 Arrangement does not matter for easy soils (negative control): pass

Test: The IEC load with half of its pieces carrying an air-dried, lightly adhering soil (jam, 15 h) and half clean, in three different soiled/clean orders.

Adapted: The three orders are three different halves of the pieces of one settled load; the soil lies where the IEC soil of each piece lies.

Stages: soil: removal laws (dissolve), hydration.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| range | largest minus smallest load mean IEC score of the three orders |  |  | 0.0682 score | changes the load index by less than run-to-run noise (0.08 to 0.10) | |x| <= 0.2 | pass |

- **A**: first order. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (113 clean, mean score of the soiled 4.93), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0733 g/L (peak 0.118), peracid mean 0.0801 mmol/L (peak 0.437). Result `sha256:d7be6bb5654c`, 1.2 s (exposure cached).
- **B**: second order. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (114 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0732 g/L (peak 0.118), peracid mean 0.0816 mmol/L (peak 0.438). Result `sha256:87e8bcbbf740`, 1.1 s (exposure cached).
- **C**: third order. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (114 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0732 g/L (peak 0.118), peracid mean 0.0814 mmol/L (peak 0.438). Result `sha256:3cf7373ba901`, 1.2 s (exposure cached).

### P25 Detergent dispenser blocked: too large

Test: A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D).

Adapted: The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.

Stages: load: session (mechanical check); soil: liquor (dosing), chemistry.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| protein | share of the egg yolk removed without detergent (B) |  |  | 0.265 1 | protein soils: removal near zero unless the enzyme is present | |x| <= 0.2 | too large |
| tea | share of the tea film removed without detergent (D) |  |  | 0.402 1 | tea stays | |x| <= 0.2 | too large |
| score | mean IEC score of the three pieces, blocked minus free | 3.67 | 0 | -3.67 score | load mean -1.5 or more | -0.5 to -5 | pass |

- **A**: plate, dispenser free. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:ceb0affcfde1`, 0.4 s (exposure cached).
- **B**: plate, dispenser blocked. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 258 min with detergent, mean 45.7 C (max 61 C), pH 9.88 (max 10.5), protease mean 0.0191 g/L (peak 0.0685), peracid mean 0.0106 mmol/L (peak 0.045). Result `sha256:c0da6cf8df0f`, 0.5 s (exposure cached).
- **C**: tea cups, dispenser free. Load `cups-centre-corner`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:da1024e5b7a4`, 0.4 s (exposure cached).
- **D**: tea cups, dispenser blocked. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 258 min with detergent, mean 45.7 C (max 61 C), pH 9.88 (max 10.5), protease mean 0.0191 g/L (peak 0.0687), peracid mean 0.0106 mmol/L (peak 0.0452). Result `sha256:c685b279f448`, 2.1 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 3 | 2.91 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0452/1063 mg |
| B | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.01 | iec_egg_yolk (reaction) 781/1063 mg |
| C | cup_1 (interior) | 0.0299 | 0.416 | 285 | 31.8 | 1 | 1 | 7.66 | 46.5 | 1.2 | 0 | 0.0133 mL, full for 10009 s | 4 | 0.525 | 0.0133 | 1.73 | iec_tea (bleach) 0.134/3.46 mg |
| D | cup_1 (interior) | 0.0299 | 0.416 | 285 | 31.8 | 1 | 1 | 7.66 | 46.5 | 1.2 | 0 | 0.0133 mL, full for 10009 s | 0 | 7491 | 0.0133 | 1.73 | iec_tea (bleach) 2.06/3.46 mg |

### P26 Tablet trapped or dissolving in a dead spot: not covered

Test: A dessert plate with egg yolk washed with the tablet released into its tray (A) against a tablet that lands in an upright bowl (B).

Adapted: The wash has no input for where the tablet lands; B is washed as A until it has one, and the scenario is reported as not covered.

Stages: soil: liquor (tablet transport and local dissolution, not built). Note: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | change of the IEC score of the plate, B - A |  |  |  | similar to under-dosing; size unknown: calibration parameter | - (any size) | not covered: needs where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked) |

- **A**: tablet in its tray. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:ceb0affcfde1`, 0.4 s (exposure cached).
- **B**: tablet in an upright bowl. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:ceb0affcfde1`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 3 | 2.91 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0452/1063 mg |
| B | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 3 | 2.91 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0452/1063 mg |

### P27 Time and temperature trade: too large

Test: A dessert plate with egg yolk (well) and porridge (rim) in the lower basket on the short programme (A, Express 65, 1 h), the eco programme (B, Eco 50, 4 h 55 min) and the intensive programme (C, Intensive 70).

Adapted: The three programmes are those of the owner's machine as the machine package models them.

Stages: soil: liquor (temperature course, enzyme life), hydration, chemistry; machine: programme timeline.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | IEC score of the plate, eco minus short | 0 | 3 | 3 score | 270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7 | +0 to +1.65 | too large |
| residue (supporting) | share of the soil left on the plate, eco minus short | 0.655 | 3.7e-5 | -0.655 1 | short programmes fail on starch and protein | -0.01 or more | pass |
| intensive (supporting) | share of the soil left on the plate, intensive minus short | 0.655 | 0.634 | -0.0205 1 | more time and temperature remove more | -0.01 or more | pass |

- **A**: Express 65. Load `plate-facing`, programme `express_65`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 43.5 min with detergent, mean 52.9 C (max 66.9 C), pH 10 (max 10.5), protease mean 0.0454 g/L (peak 0.076), peracid mean 0.118 mmol/L (peak 0.276). Result `sha256:5bc891760ff9`, 0.2 s (exposure cached).
- **B**: Eco 50. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0955 mmol/L (peak 0.446). Result `sha256:ed2714ba244e`, 0.5 s (exposure cached).
- **C**: Intensive 70. Load `plate-facing`, programme `intensive_70`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 58.6 min with detergent, mean 58.5 C (max 70 C), pH 10.1 (max 10.6), protease mean 0.0423 g/L (peak 0.0959), peracid mean 0.13 mmol/L (peak 0.446). Result `sha256:af3a3ffe6a26`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well, rim) | 0.0126 | 0.492 | 249 | 19.3 | 1 | 1 | 7.91 | 46.9 | 1.34 | 0 |  | 0 | 9342 | 0 | 1.01 | iec_egg_yolk (reaction) 802/1063 mg; iec_oat_flakes (reaction) 2.91/167 mg |
| B | plate (well, rim) | 0.00729 | 0.626 | 229 | 24.4 | 1 | 1 | 5.55 | 33.3 | 1.2 | 0 |  | 3 | 2.91 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0451/1063 mg; iec_oat_flakes (reaction) 0/167 mg |
| C | plate (well, rim) | 0.00756 | 0.632 | 342 | 26.9 | 1 | 1 | 5.89 | 34.6 | 1.23 | 0 |  | 0 | 9235 | 0 | 1.01 | iec_egg_yolk (reaction) 778/1063 mg; iec_oat_flakes (reaction) 2.34/167 mg |

### P28 Bleachable stains are position-insensitive (negative control): pass

Test: Two tea cups with tea film mouth down in the upper basket, one near the axis of the upper arm and one in a corner outside the swept circle, with the standard detergent (A) and with a bleach-free one (B).

Adapted: The corner cup stands on the knife shelf at the rear left. Bleach-free: the detergent without percarbonate and TAED (`liq.xPeroxide`, `liq.xTaed` = 0).

Stages: water: droplets, run-off (wetting); soil: chemistry (bleach), supply factor.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| position | IEC score of the corner cup minus the centre cup (A) |  |  | 0 score | tea cups in the best and worst spray positions differ by at most 0.5 | |x| <= 1 | pass |
| bleach | share of the tea film removed without bleach (B) |  |  | 6.7e-16 1 | without bleach all fail | |x| <= 0.2 | pass |
| with (supporting) | share of the tea film removed with bleach, mean of the two cups (A) |  |  | 0.961 1 | with oxidant, temperature and time the film goes | +0.5 to +1 | pass |
| f_jet (supporting) | fraction of time the inside is under a direct jet, corner over centre, minus one (A) |  |  | -0.679 1 | the corner is the worst spray position | -0.05 or more | pass |

- **A**: with bleach. Load `cups-centre-corner`, programme `eco_50`, 2 items (2 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:da1024e5b7a4`, 0.4 s (exposure cached).
- **B**: bleach-free detergent. Load `cups-centre-corner`, programme `eco_50`, 2 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xPeroxide":0,"liq.xTaed":0}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0828 g/L (peak 0.135), peracid mean 0 mmol/L (peak 0). Result `sha256:a4f2a0fc1f89`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | cup_1 (interior) | 0.0299 | 0.416 | 285 | 31.8 | 1 | 1 | 7.66 | 46.5 | 1.2 | 0 | 0.0133 mL, full for 10009 s | 4 | 0.525 | 0.0133 | 1.73 | iec_tea (bleach) 0.134/3.46 mg |
| A | cup_2 (interior) | 0.00962 | 0.764 | 276 | 28.4 | 1 | 1 | 2.09 | 17.5 | 0.791 | 0 | 0.0033 mL, full for 0 s | 4 | 0.798 | 0 | 1.12 | iec_tea (bleach) 0.133/3.36 mg |
| B | cup_1 (interior) | 0.0299 | 0.416 | 285 | 31.8 | 1 | 1 | 7.66 | 46.5 | 1.2 | 0 | 0.0133 mL, full for 10009 s | 0 | 7491 | 0.0133 | 1.73 | iec_tea (bleach) 3.46/3.46 mg |
| B | cup_2 (interior) | 0.00962 | 0.764 | 276 | 28.4 | 1 | 1 | 2.09 | 17.5 | 0.791 | 0 | 0.0033 mL, full for 0 s | 0 | 7493 | 0 | 1.12 | iec_tea (bleach) 3.36/3.36 mg |

### P29 Ageing of the soil before the wash: pass

Test: A dessert plate with egg yolk in the lower basket at three ageing levels: fresh (A, 15 min), oven-dried 2 h at 80 C (B), baked on at 125 C (C).

Adapted: One plate instead of a load; the baked level is the heat history `cooked` of the soil model (125 C), the nearest to 130 to 140 C.

Stages: soil: hydration (lag), bake index, removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| fresh | IEC score of the fresh plate, as a distance from 4.5 to 5 (A) |  |  | 0 score | crockery mean at least 4.5 fresh | within 1 of the range | pass |
| dried | IEC score of the oven-dried plate, as a distance from 2.3 to 3.7 (B) |  |  | 0 score | crockery 2.3 to 3.7 oven-dried | within 1 of the range | pass |
| baked | IEC score, baked minus oven-dried | 3 | 2 | -1 score | at least 1 point lower again for 130 to 140 C baking | -0 to -5 | pass |
| order (supporting) | share of the egg yolk left, baked minus fresh | 1.8e-8 | 1.4e-4 | 1.4e-4 1 | ageing leaves more | +0.01 or more | too small |

- **A**: fresh. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0954 mmol/L (peak 0.446). Result `sha256:849d5ef0ea14`, 0.4 s (exposure cached).
- **B**: oven-dried 2 h at 80 C. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:ceb0affcfde1`, 0.4 s (exposure cached).
- **C**: baked on at 125 C. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:22e35f7c8db8`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.01 | iec_egg_yolk (reaction) 2.0e-5/1063 mg |
| B | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 3 | 2.91 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0452/1063 mg |
| C | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 2 | 11.3 | 0 | 1.01 | iec_egg_yolk (reaction) 0.147/1063 mg |

### P30 Protein soil responds to hit frequency and chemistry, not to jet strength: pass

Test: A dessert plate with egg yolk at a fixed position in the lower basket: pump speed of the main wash -30 % (A) and +30 % (B); protease dose -50 % (C) and +50 % (D).

Adapted: A plate stands in for the tiles. The pump speed is changed in the steps of the main wash of the programme (3000 rpm to 2100 and 3900 rpm); the enzyme dose by `liq.xProtease`.

Stages: soil: removal laws (reaction, jet assist), chemistry; water: hydraulics, jets.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pump | share of the egg yolk removed, pump +30 % minus pump -30 % | 1 | 1 | 1.1e-5 1 | doubling pump pressure changes egg-yolk removal little | |x| <= 0.2 | pass |
| enzyme | share of the egg yolk removed, protease +50 % minus protease -50 % | 0.0481 | 0.718 | 0.669 1 | doubling enzyme level changes it clearly | +0.05 to +1 | pass |

- **A**: pump -30 %. Load `plate-facing`, programme `eco_50+pump70pct`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 43.8 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0739 g/L (peak 0.114), peracid mean 0.101 mmol/L (peak 0.446). Result `sha256:94a1a02239f0`, 0.4 s (exposure cached).
- **B**: pump +30 %. Load `plate-facing`, programme `eco_50+pump130pct`, 1 items (0 clean, mean score of the soiled 2), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 50.1 C (max 53.6 C), pH 10.3 (max 10.7), protease mean 0.0677 g/L (peak 0.0959), peracid mean 0.087 mmol/L (peak 0.446). Result `sha256:5e08876df46f`, 0.5 s (exposure cached).
- **C**: protease -50 %. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.005}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0121 g/L (peak 0.0181), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:0b571fc9584d`, 1.9 s (exposure cached).
- **D**: protease +50 %. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.015}. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0363 g/L (peak 0.0542), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:95309bb6f4e4`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00446 | 0.506 | 184 | 17.5 | 1 | 1 | 3.38 | 24.2 | 1.07 | 0 |  | 2 | 5.16 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0772/1063 mg |
| B | plate (well) | 0.00676 | 0.631 | 315 | 33.5 | 1 | 1 | 5.68 | 34.4 | 1.31 | 0 |  | 2 | 4.4 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0652/1063 mg |
| C | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.01 | iec_egg_yolk (reaction) 1012/1063 mg |
| D | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 0 | 8450 | 0 | 1.01 | iec_egg_yolk (reaction) 300/1063 mg |

### P31 Starch is bimodal: too small

Test: Twelve soup plates with oat porridge in the lower basket; the histogram of their IEC scores.

Adapted: Eleven in every second slot of the rear lane and one in the left front lane, settled by the loading physics.

Stages: soil: hydration, removal laws (starch), inspection.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| clusters | share of the plates scoring 5 or 0 to 1 |  |  | 1 1 | porridge-plate scores cluster at 5 and at 0 to 1 | +0.6 to +1 | pass |
| both | share of the plates in the smaller of the two clusters |  |  | 0 1 | both clusters occur: some plates come clean, some keep a sheet | +0.01 or more | too small |

- **A**: twelve porridge plates. Load `soup-12`, programme `eco_50`, 12 items (12 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.111), peracid mean 0.0943 mmol/L (peak 0.446). Result `sha256:da425266992d`, 3.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | soup_6 (well) | 0.00163 | 0.332 | 204 | 21.9 | 1 | 1 | 1.45 | 12.9 | 0.779 | 0 |  | 5 | 0 | 0 | 1.59 | iec_oat_flakes (reaction) 0/232 mg |

### P32 Microwaved milk on glass is persistent: too large

Test: Four test glasses with microwaved milk in the upper basket with detergent D on the Auto programme (A), on the long eco programme (B), and with a detergent of twice the enzyme and half the silicate (C).

Adapted: The registry defaults are IEC detergent D. The ingredient table of detergent E is not in the dossiers ("upgraded enzymes, less silicate"), so C is an assumed composition and decides nothing; the eco programme, which the entry names beside E, is the deciding comparison.

Stages: soil: chemistry (alkalinity, enzyme), removal laws; water: jets into the glass.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the glasses with detergent D, as a distance from 2.3 to 2.4 (A) |  |  | -2.05 score | glass class 2.3 to 2.4 with detergent D on the reference machines | within 1 of the range | too small |
| eco | mean IEC score of the glasses, eco minus Auto | 0.25 | 5 | 4.75 score | 2.8 to 4.0 with detergent E or a long eco programme | +0 to +3.4 | too large |
| e_like (supporting) | mean share of the milk left, E-like minus D | 0.0199 | 0.282 | 0.263 1 | upgraded enzymes remove more | -0.01 or more | wrong sign |

- **A**: detergent D, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0.25), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.95 (max 10.6), protease mean 0.0337 g/L (peak 0.0958), peracid mean 0.0772 mmol/L (peak 0.449). Result `sha256:98a6a90cd92b`, 0.6 s (exposure cached).
- **B**: detergent D, Eco 50. Load `glasses-milk`, programme `eco_50`, 4 items (4 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.109), peracid mean 0.095 mmol/L (peak 0.446). Result `sha256:a8bea6f78dc0`, 0.5 s (exposure cached).
- **C**: assumed E-like detergent, Auto. Load `glasses-milk`, programme `auto_145`, 4 items (0 clean, mean score of the soiled 0), seeds 1/1, parameters {"liq.xProtease":0.02,"liq.xAmylase":0.01,"liq.xSilicate":0.275}. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 10 (max 10.7), protease mean 0.0217 g/L (peak 0.0639), peracid mean 0.0766 mmol/L (peak 0.444). Result `sha256:ae8e87761fe2`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (interior) | 0.0127 | 0.458 | 435 | 26.1 | 1 | 1 | 5.54 | 37.1 | 1.09 | 0 |  | 0 | 824 | 0 | 0.951 | ikw_milk_microwaved (reaction) 8.05/527 mg |
| B | glass_1 (interior) | 0.0128 | 0.458 | 435 | 26.4 | 1 | 1 | 5.58 | 37.2 | 1.09 | 0 |  | 5 | 0 | 0 | 0.951 | ikw_milk_microwaved (reaction) 0/527 mg |
| C | glass_1 (interior) | 0.0127 | 0.458 | 435 | 26.1 | 1 | 1 | 5.54 | 37.1 | 1.09 | 0 |  | 0 | 9151 | 0 | 0.951 | ikw_milk_microwaved (reaction) 147/527 mg |

### P33 Fat needs temperature and enough water: too small

Test: A porcelain and a melamine dessert plate with fresh margarine in the lower basket, with the main wash of the programme heated to 35 (A), 45 (B) and 55 C (C).

Adapted: The target of the main wash is changed in the steps of the programme; everything else of the programme stays.

Stages: soil: removal laws (melt, roll-up by substrate), liquor (temperature course).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| warm | IEC score of the porcelain plate at 55 C, as a distance from 4 to 5 (C) |  |  | 0 score | margarine platter cleans easily at 50 C | within 1 of the range | pass |
| temperature | share of the margarine left on the two plates, 35 C minus 55 C | 5.7e-22 | 2.2e-13 | 2.2e-13 1 | fat needs temperature: below its melting range solid fat is only smeared | +0.05 or more | too small |
| plastic (supporting) | share of the margarine left at 45 C, melamine minus porcelain (B) |  |  | 7.4e-17 1 | greasy residue most visibly on plastic | +0.01 or more | too small |

- **A**: main wash at 35 C. Load `dplate-lower`, programme `eco_50+wash35C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 164 min with detergent, mean 35 C (max 36.8 C), pH 10.6 (max 10.8), protease mean 0.0755 g/L (peak 0.117), peracid mean 0.197 mmol/L (peak 0.447). Result `sha256:619f4bac3212`, 1.7 s (exposure cached).
- **B**: main wash at 45 C. Load `dplate-lower`, programme `eco_50+wash45C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 168 min with detergent, mean 42.4 C (max 45 C), pH 10.4 (max 10.8), protease mean 0.0756 g/L (peak 0.117), peracid mean 0.122 mmol/L (peak 0.445). Result `sha256:b81b3b3e39f2`, 0.4 s (exposure cached).
- **C**: main wash at 55 C. Load `dplate-lower`, programme `eco_50+wash55C`, 2 items (2 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 172 min with detergent, mean 49.6 C (max 55 C), pH 10.3 (max 10.8), protease mean 0.0646 g/L (peak 0.0959), peracid mean 0.0718 mmol/L (peak 0.445). Result `sha256:08a19a66bf24`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.011 | 0.757 | 273 | 24.3 | 1 | 1 | 5.84 | 36.1 | 1.32 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 2.1e-25/1743 mg |
| A | melamine (well) | 0.0018 | 0.245 | 52.2 | 21.4 | 1 | 1 | 2.82 | 58.2 | 1.75 | 0 |  | 5 | 0 | 0 | 0.699 | iec_margarine (melt) 7.1e-10/1647 mg |
| B | plate (well) | 0.011 | 0.757 | 273 | 24.3 | 1 | 1 | 5.84 | 36.1 | 1.32 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 1.1e-33/1743 mg |
| B | melamine (well) | 0.0018 | 0.245 | 52.2 | 21.4 | 1 | 1 | 2.82 | 58.3 | 1.75 | 0 |  | 5 | 0 | 0 | 0.699 | iec_margarine (melt) 1.2e-13/1647 mg |
| C | plate (well) | 0.011 | 0.757 | 273 | 24.4 | 1 | 1 | 5.84 | 36.1 | 1.32 | 0 |  | 5 | 0 | 0 | 1.01 | iec_margarine (melt) 3.2e-44/1743 mg |
| C | melamine (well) | 0.00179 | 0.245 | 52.2 | 21.5 | 1 | 1 | 2.83 | 58.3 | 1.75 | 0 |  | 5 | 0 | 0 | 0.699 | iec_margarine (melt) 1.9e-18/1647 mg |

### P34 Thick layers detach as flakes: not covered

Test: A dessert plate with egg yolk at 5 (A) and 10 mg/cm2 dry (B).

Adapted: One plate; 5 and 10 mg/cm2 dry on 60 % of the well are 0.93 g and 1.85 g of yolk as applied.

Stages: soil: removal laws (cohesive failure and flakes, not built). Note: needs detachment of thick layers as flakes.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| flakes | soil that left as flakes, thick minus thin |  |  |  | thick egg yolk partly tended to flake off | + (any size) | not covered: needs detachment of thick layers as flakes |
| residue (supporting) | share of the egg yolk left, thick minus thin | 0 | 5.8e-6 | 5.8e-6 1 | the thicker layer takes longer | +0.01 or more | too small |

- **A**: 5 mg/cm2 dry. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0957 mmol/L (peak 0.446). Result `sha256:5cea35a64dbc`, 0.3 s (exposure cached).
- **B**: 10 mg/cm2 dry. Load `plate-facing`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 4), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:309798c0e5b0`, 0.4 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 5 | 0 | 0 | 1.01 | iec_egg_yolk (reaction) 0/492 mg |
| B | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 4 | 0.413 | 0 | 1.01 | iec_egg_yolk (reaction) 0.00568/983 mg |

### P35 Pot interiors: too small

Test: A 17 cm steel saucepan with burnt-on milk on its inner bottom and wall in the lower basket: mouth down on the rear rows (A) against lying on its side (B).

Adapted: Both poses are dropped and settled by the loading physics; the pan on its side rolls about 10 cm before it rests.

Stages: water: jets (entry into a cavity), run-off; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | IEC score of the pot mouth down, as a distance from 2.5 to 4.0 (A) |  |  | 1 score | pots class 2.5 with detergent D to 4.0 with E | within 1 of the range | pass |
| side | share of the soil left in the pot, on its side minus mouth down | 0 | 0 | 0 1 | on its side, half the wall is shadowed | +0.01 or more | too small |
| ranking (supporting) | share left on the inner wall minus on the inner bottom, mouth down (A) |  |  | 0 1 | inverted, the bottom is hit directly (the ranking is a calibration target) | +0.01 or more | too small |

- **A**: mouth down. Load `pot-inverted`, programme `eco_50`, 1 items (1 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:9191e8fa96c4`, 1.9 s (exposure cached).
- **B**: on its side. Load `pot-on-side`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 5), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:1300a309ea77`, 1.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot (interior_base) | 0.0392 | 0.976 | 215 | 32.2 | 0.785 | 1 | 4.75 | 11.8 | 0.345 | 0 | 1.36 mL, full for 0 s | 5 | 0 | 0 | 12.5 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| A | pot (interior_wall) | 0.0047 | 0.396 | 601 | 29.7 | 0.972 | 1 | 34.6 | 59.6 | 1.5 | 0 | 1.36 mL, full for 0 s | 5 | 0 | 0 | 12.5 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| B | pot (interior_base) | 0 | 0 | 0 | 0 | 1 | 1 | 8.69 | 45.1 | 1.2 | 0.814 | 820 mL, full for 9948 s | 5 | 0 | 820 | 9.03 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |
| B | pot (interior_wall) | 1.9e-7 | 3.3e-4 | 102 | 52.8 | 1 | 1 | 2.01 | 34.5 | 1.19 | 0.389 | 820 mL, full for 9948 s | 5 | 0 | 820 | 9.03 | milk_burnt (reaction) 0/277 mg; milk_burnt (reaction) 0/279 mg |

### P36 Water pools in the base recess of inverted cups and mugs: pass

Test: A ceramic mug mouth down on a level support: the rear cup shelf of the upper basket folded down.

Adapted: The cup shelf of the Bosch is the level support; the mug is dropped onto it and settles. The expected volume is the checklist's formula for the recess of the catalogue's mug (28 mm radius, 2.5 mm deep).

Stages: water: scene (basins), run-off, pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| pool | water standing in the base recess at the end |  |  | 5 mL | pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm) | +3.08 to +12.3 | pass |
| drying (supporting) | drying score of the mug |  |  |  | drying score 0 | |x| <= 0.5 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:7c33efa7899b`, 2.9 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.3e-4 | 0.128 | 33.5 | 16.9 | 1 | 1 | 0.441 | 4.49 | 0.303 | 0.479 | 5 mL, full for 10003 s | 5 | 0 | 5 | 3.24 |  |

### P37 Tilt drains the recess: too small

Test: The mug of P36 at 0 (A), 7 (B), 15 (C) and 30 degrees (D) of tilt.

Adapted: The tilts are set, not settled: the mug is turned about a horizontal axis and kept standing on the height of its lowest point; the runner checks that it cuts into nothing. The checklist's volumes are for a recess of 25 mm radius and 3 mm depth; the expected values here are its formulas evaluated for the recess of the catalogue's mug (28 mm, 2.5 mm), as shares of the level volume.

Stages: water: scene (basins, minimum basin volume), pools.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| tilt7 | water in the recess at 7 degrees over level | 5 | 0.418 | 0.0836 1 | the wedge formula: 1.4 of 5.9 mL at 7 degrees for the checklist's recess; 0.92 of 6.2 mL for this mug's | +0.0744 to +0.298 | pass |
| tilt15 | water in the recess at 15 degrees over level | 5 | 0.111 | 0.0223 1 | the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's | +0.0231 to +0.0924 | too small |
| tilt30 (supporting) | water in the recess at 30 degrees over level | 5 | 0 | 0 1 | the wedge formula: 0.13 of 5.9 mL at 30 degrees for the checklist's recess; 0.09 of 6.2 mL for this mug's | +0.0073 to +0.0292 | too small |

- **A**: level, as it settled on the shelf. Load `mug-on-shelf`, programme `eco_50`, 1 items (0 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:7c33efa7899b`, 2.9 s (exposure cached).
- **B**: tilted 7 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:8feffc755bf6`, 1.8 s (exposure cached).
  - set pose: deepest overlap 0.01 mm (mug into upper_rack_fittings)
- **C**: tilted 15 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:75293e259dff`, 1.9 s (exposure cached).
- **D**: tilted 30 degrees. Load `mug-on-shelf`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.112), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:e72ff25f7e5d`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | mug (foot) | 7.3e-4 | 0.128 | 33.5 | 16.9 | 1 | 1 | 0.441 | 4.49 | 0.303 | 0.479 | 5 mL, full for 10003 s | 5 | 0 | 5 | 3.24 |  |
| B | mug (foot) | 3.3e-4 | 0.16 | 20.9 | 14.8 | 1 | 1 | 0.243 | 3.3 | 0.307 | 0.106 | 0.418 mL, full for 10008 s | 5 | 0 | 0.418 | 2.23 |  |
| C | mug (foot) | 2.3e-4 | 0.0851 | 22.9 | 17.1 | 1 | 1 | 0.235 | 3.27 | 0.315 | 0.0638 | 0.111 mL, full for 10009 s | 5 | 0 | 0.111 | 1.67 |  |
| D | mug (foot) | 5.1e-4 | 0.149 | 28.1 | 17.8 | 1 | 1 | 0.966 | 7.56 | 0.46 | 0 | 0.0257 mL, full for 0 s | 5 | 0 | 0 | 1.77 |  |

### P38 Plastic stays wet: not covered

Test: A melamine and a porcelain dessert plate of the same shape side by side in the lower basket.

Adapted: None.

Stages: drying (not built); water: run-off (beads on plastic) gives the film it would start from. Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), melamine minus porcelain |  |  |  | melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83 | -0.035 to -0.4 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| film (supporting) | water left as film per area at the end of the last rinse, melamine over porcelain, minus one |  |  | -0.334 1 | water beads on plastic and stays | +0.05 or more | wrong sign |

- **A**: side by side. Load `dplate-lower`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:6a9e564bb050`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate | 0.0113 | 0.726 | 365 | 26 | 1 | 1 | 6.87 | 31.4 | 1.11 | 0 |  | 5 | 0 | 0 | 1.01 |  |
| A | melamine | 0.016 | 0.637 | 365 | 26.4 | 1 | 1 | 9.78 | 63 | 1.66 | 0 |  | 5 | 0 | 0 | 0.699 |  |

### P39 Pots and large hollow ware stay wet: not covered

Test: A saucepan mouth down in the lower basket (A) against a dessert plate on edge (B).

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | drying score (0 to 1 scale), pot minus plate |  |  |  | pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83 | -0.025 to -0.6 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water the pot keeps at the end (pools and film) against the plate | 12.5 | 1.01 | 11.5 g | rims that hold water, large wetted area | + (any size) | pass |

- **A**: saucepan. Load `pot-inverted`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0726 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:f4a181ccf963`, 0.3 s (exposure cached).
- **B**: plate. Load `dplate-lower`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:6a9e564bb050`, 0.3 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | pot | 0.00972 | 0.433 | 601 | 32.2 | 0.957 | 1 | 18 | 56 | 1.36 | 0 | 1.36 mL, full for 0 s | 5 | 0 | 0 | 12.5 |  |
| B | plate | 0.0113 | 0.726 | 365 | 26 | 1 | 1 | 6.87 | 31.4 | 1.11 | 0 |  | 5 | 0 | 0 | 1.01 |  |

### P40 Liquid held at contact points and in narrow gaps: wrong sign

Test: Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B).

Adapted: Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.

Stages: water: scene (contacts), run-off (bridges, retained water).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| held | water left on the two glasses at the end of the last rinse (film and pools), B - A | 2.58 | 2.3 | -0.277 g | a wet mark at every touching pair | + (any size) | wrong sign |
| marks (supporting) | residue marks at the contact (B) |  |  |  | a residue line at every touching pair | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: apart. Load `glasses-apart`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:18a6780c3af6`, 1.8 s (exposure cached).
- **B**: touching. Load `glasses-touching`, programme `eco_50`, 2 items (2 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:81e8a7a9d1fe`, 1.6 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass_1 (exterior) | 0.00363 | 0.507 | 272 | 22.9 | 1 | 1 | 2.14 | 17.6 | 0.911 | 0 |  | 5 | 0 | 0 | 1.14 |  |
| A | glass_2 (exterior) | 0.00347 | 0.528 | 338 | 22.7 | 1 | 1 | 3.29 | 23.3 | 1.06 | 0 |  | 5 | 0 | 0 | 1.44 |  |
| B | glass_1 (exterior) | 0.00323 | 0.491 | 219 | 23 | 1 | 1 | 1.91 | 16.3 | 0.882 | 0 |  | 5 | 0 | 0 | 1.14 |  |
| B | glass_2 (exterior) | 0.00334 | 0.552 | 277 | 23.4 | 1 | 1 | 2.87 | 21.3 | 1.02 | 0 |  | 5 | 0 | 0 | 1.16 |  |

### P41 Light plastic items are moved or flipped by jets: not covered

Test: A 20 g polypropylene container lid lying hollow side down in the lower basket (A) against the upper basket (B).

Adapted: The lightest lid of the catalogue weighs 20 g, not 15 g. In the lower basket it comes to rest on the cutlery basket and the left front tines.

Stages: rigid-body coupling during the wash (not built); water: jets (the lift ratio is reported). Note: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| moved | distance the jets move the lid in the lower basket |  |  |  | unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill | + (any size) | not covered: needs items moved by the jets (the load is washed where it was placed; only a lift ratio is reported) |
| lift (supporting) | peak upward jet force on the lid over its weight, lower basket (A) |  |  | 3.53 1 | 0.08 to 0.30 N per jet against the weight of a 20 g lid | +0.2 to +3 | too large |
| upper (supporting) | that ratio, upper basket minus lower basket | 3.53 | 2.81 | -0.717 1 | the advice is to put light plastics in the top rack | -0.01 or more | pass |

- **A**: lower basket. Load `lid-lower`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.11), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:8ee5257e070a`, 2.3 s (exposure cached).
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 3.53 of its weight); it is simulated where it was placed
- **B**: upper basket. Load `lid-upper`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:5fc0c62ce335`, 1.8 s (exposure cached).
  - wash: placement: lid is likely to be moved by the jets (peak upward jet force 2.81 of its weight); it is simulated where it was placed

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | lid | 0.0177 | 0.392 | 210 | 32.2 | 1 | 1 | 10.9 | 36.7 | 0.854 | 0 |  | 5 | 0 | 0 | 8.72 |  |
| B | lid | 0.0325 | 0.411 | 251 | 31.6 | 1 | 1 | 19.9 | 67.6 | 1.74 | 0 |  | 5 | 0 | 0 | 6.82 |  |

### P42 Cutlery dries almost completely (negative control): not covered

Test: The cutlery of the IEC load.

Adapted: None.

Stages: drying (not built). Note: needs drying (evaporation of the retained film, the drying score, drips after the last drain).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| drying | points of the 0 to 1 drying scale the cutlery loses |  |  |  | drying 0.99 | |x| <= 0.04 | not covered: needs drying (evaporation of the retained film, the drying score, drips after the last drain) |
| water (supporting) | water standing in a piece of cutlery at the end, mean |  |  | 0 mL | it drains along its length | |x| <= 0.1 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.91), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0839 mmol/L (peak 0.444). Result `sha256:a3a155d938cc`, 8.5 s (exposure cached).

### P43 Spots, film and tine marks on glass: not covered

Test: A test glass in the upper basket with rinse aid (A) and without (B).

Adapted: The wash has no input for water hardness or for running without rinse aid; B is washed as A until it has, and the scenario is reported as not covered.

Stages: drying and spotting (not built). Note: needs spots and film from evaporated water, and marks at contacts.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spots | spots on the glass, without rinse aid minus with |  |  |  | AHAM adds 1 point per small spot or streak, 3 per large one | + (any size) | not covered: needs spots and film from evaporated water, and marks at contacts |

- **A**: with rinse aid. Load `glass-free`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:d5fc2d7e119f`, 1.7 s (exposure cached).
- **B**: without rinse aid. Load `glass-free`, programme `eco_50`, 1 items (1 clean), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.109), peracid mean 0.0959 mmol/L (peak 0.446). Result `sha256:d5fc2d7e119f`, 1.7 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | glass | 0.00427 | 0.508 | 312 | 25.4 | 1 | 1 | 3.63 | 17.2 | 0.866 | 0 |  | 5 | 0 | 0 | 1.53 |  |
| B | glass | 0.00427 | 0.508 | 312 | 25.4 | 1 | 1 | 3.63 | 17.2 | 0.866 | 0 |  | 5 | 0 | 0 | 1.53 |  |

### P44 Cutlery comes out clean although it is the most shadowed class: too small

Test: The IEC load of 13 place settings, loaded carefully, on the scored programme; class mean of the soiled cutlery.

Adapted: The pieces of the load that the careful loading policy fits into the machine as modelled (about 100 of 140).

Stages: water: droplets, run-off in the cutlery basket; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| class | mean IEC score of the soiled cutlery, as a distance from 4.6 to 4.8 |  |  | -1.05 score | class mean 4.6 to 4.8 | within 1 of the range | too small |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.91), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0839 mmol/L (peak 0.444). Result `sha256:a3a155d938cc`, 8.5 s (exposure cached).

### P45 Class ranking in the standard test: wrong sign

Test: The IEC load on the scored programme: mean scores of cutlery, melamine, glass and crockery, and overall.

Adapted: The pieces that fit (about 100 of 140); the load has no pots (the loader left them out), so that class is not scored.

Stages: the whole wash.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| overall | load mean IEC score, as a distance from 3.5 to 4.2 |  |  | 0 score | overall 3.5 to 4.2 on a 12 to 13 place-setting load | within 1 of the range | pass |
| crockery | crockery mean, as a distance from 2.3 to 3.7 |  |  | 0.447 score | crockery 2.3 to 3.7 | within 1 of the range | pass |
| glass | glass mean, as a distance from 2.3 to 4.0 |  |  | 0 score | glass 2.3 to 4.0 | within 1 of the range | pass |
| ranking | cutlery mean minus crockery mean |  |  | -0.594 score | cutlery > melamine > (pots, glass, crockery) | + (any size) | wrong sign |
| melamine (supporting) | melamine mean minus crockery mean |  |  | 0.853 score | melamine above crockery | + (any size) | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.91), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0839 mmol/L (peak 0.444). Result `sha256:a3a155d938cc`, 8.5 s (exposure cached).

### P46 Run-to-run repeatability: too small

Test: The IEC load washed with three seeds (level seed and simulation seed 1, 2 and 3); standard deviation of the load mean score.

Adapted: Three seeds. The seeds move the phase origin of the arms, the sampling of the droplets, and where on a region each soil lies and how thick; the tablet release time and the sensor decisions of the machine are fixed.

Stages: the whole wash (seeded sampling).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| spread | standard deviation of the load mean IEC score over the three seeds |  |  | 0.0342 score | about 0.08 to 0.10; not zero, not 0.5 | +0.04 to +0.2 | too small |

- **A**: seeds 1. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.91), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0839 mmol/L (peak 0.444). Result `sha256:a3a155d938cc`, 8.5 s (exposure cached).
- **B**: seeds 2. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.99), seeds 2/2. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0837 mmol/L (peak 0.444). Result `sha256:65e9830603e8`, 4.4 s (exposure cached).
- **C**: seeds 3. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (91 clean, mean score of the soiled 3.93), seeds 3/3. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0838 mmol/L (peak 0.444). Result `sha256:42dd4402a219`, 4.1 s (exposure cached).

### P47 Everything is wetted within seconds; jets are rare events: pass

Test: The IEC load on the scored programme: the share of the surface of the load that is wetted, and the fraction of time under a direct jet.

Adapted: The time-resolved first wetting is not recorded by the exposure (it stores the periodic state); what is checked is the wetted share in the periodic state and the water returning to the sump within a revolution.

Stages: water: jets, droplets, run-off.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | largest fraction of time under a direct jet of any item of the load (mean over its surface) |  |  | 0.0207 1 | f_jet under 10 % almost everywhere | |x| <= 0.1 | pass |
| wetted | share of the surface of the load that no spray state wets |  |  | 6.7e-5 1 | everything is wetted | |x| <= 0.2 | pass |
| circuit (supporting) | share of the nozzle outflow not back in the sump within one revolution of the arm (largest of the spray states) |  |  | 0.001 1 | water circuit under 3 s (a revolution takes 1.4 to 2.2 s) | |x| <= 0.5 | pass |

- **A**: IEC load. Load `loader:iec-13-careful`, programme `eco_50`, 114 items (87 clean, mean score of the soiled 3.91), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0731 g/L (peak 0.118), peracid mean 0.0839 mmol/L (peak 0.444). Result `sha256:a3a155d938cc`, 8.5 s (exposure cached).

### P48 Detergent does not change where water goes: pass

Test: A dessert plate in the lower basket washed with detergent (A) and with the dispenser blocked, so without any (B); the exposure of the two washes.

Adapted: The exposure of the simulation is computed for one liquor class and does not read the detergent at all, so this holds by construction: the check guards that it stays so.

Stages: water: jets (the exposure key excludes the liquor).

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| jets | spray states whose exposure differs between the two washes |  |  | 0 states | jet trajectories and velocity fields the same with and without detergent | |x| <= 0 | pass |

- **A**: with detergent. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 3), seeds 1/1. Liquor of the main wash: 170 min with detergent, mean 46 C (max 50 C), pH 10.4 (max 10.8), protease mean 0.0725 g/L (peak 0.108), peracid mean 0.0956 mmol/L (peak 0.446). Result `sha256:ceb0affcfde1`, 0.4 s (exposure cached).
- **B**: without detergent. Load `plate-facing`, programme `eco_50`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1, dispenser blocked. Liquor of the main wash: 258 min with detergent, mean 45.7 C (max 61 C), pH 9.88 (max 10.5), protease mean 0.0191 g/L (peak 0.0685), peracid mean 0.0106 mmol/L (peak 0.045). Result `sha256:c0da6cf8df0f`, 0.5 s (exposure cached).

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 3 | 2.91 | 0 | 1.01 | iec_egg_yolk (reaction) 0.0452/1063 mg |
| B | plate (well) | 0.00608 | 0.595 | 195 | 24.4 | 1 | 1 | 4.58 | 29.9 | 1.21 | 0 |  | 0 | 8812 | 0 | 1.01 | iec_egg_yolk (reaction) 781/1063 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

