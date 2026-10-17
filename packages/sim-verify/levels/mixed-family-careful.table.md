# Demonstration wash: mixed-family-careful

Level 'Everyday family load', loaded by the careful policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 40 items (5 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.8 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 0.2 s |
| Time, soil | 0.3 s |
| Time, replay | 0.8 s |
| Time, result | 0.2 s |
| Time, total | 4.4 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 177053 blocks, 459052 soil cells, 70398 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.73 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 9.63 g dry at the start, 0.00 g left (0 %) |
| Items clean | 39 of 40 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5208 | 0.0414 | 0.1421 | 0.1830 | 0.0011 | 99.86 % | 0.197 kg | 0.047 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5287 | 0.0438 | 0.1441 | 0.1875 | 0.0011 | 99.87 % | 0.204 kg | 0.047 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4517 | 0.0653 | 0.1452 | 0.4955 | 0.0012 | 99.91 % | 0.199 kg | 0.047 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4275 | 0.0622 | 0.1369 | 0.4709 | 0.0011 | 99.88 % | 0.205 kg | 0.047 kg | yes |

## What the wash reports

- placement: bottle_teat_01 is likely to be moved by the jets (peak upward jet force 0.91 of its weight); it is simulated where it was placed
- placement: sippy_cup_02 is likely to be moved by the jets (peak upward jet force 0.99 of its weight); it is simulated where it was placed

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| baby_bottle_01 | baby_bottle_pp_260 | upper | 121, 44, 572 | milk_film 0.00 of 92.03 | 0.00 | 0 of 23475 | 5 | 0.0, 1.60 | yes |
| bottle_teat_01 | bottle_teat_silicone | upper | 83, 208, 430 | milk_film 0.00 of 12.24 | 0.00 | 0 of 3087 | 5 | 0.0, 1.35 | yes |
| cereal_bowl_01 | cereal_bowl_vitrelle_159 | upper | -84, 158, 510 | yoghurt 0.00 of 184.46 | 0.00 | 0 of 9909 | 5 | 0.0, 1.45 | yes |
| cereal_bowl_02 | cereal_bowl_vitrelle_159 | upper | -82, 125, 510 | yoghurt 0.00 of 175.89 | 0.00 | 0 of 9909 | 5 | 0.0, 1.40 | yes |
| cereal_bowl_03 | cereal_bowl_vitrelle_159 | upper | -83, 89, 510 | yoghurt 0.00 of 186.76 | 0.00 | 0 of 9908 | 5 | 0.0, 1.41 | yes |
| cereal_bowl_04 | cereal_bowl_vitrelle_159 | upper | -82, 31, 511 | yoghurt 0.00 of 209.39 | 0.00 | 0 of 9909 | 5 | 0.0, 1.47 | yes |
| chopping_board_01 | chopping_board_pp_375 | lower | -208, -14, 211 | spinach_particles 0.00 of 265.90 | 0.00 | 0 of 29789 | 5 | 0.0, 4.69 | yes |
| fork_01 | dinner_fork_185 | lower | 4, -221, 80 | spinach_particles 0.00 of 7.48 | 0.00 | 0 of 917 | 5 | 0.0, 0.24 | yes |
| fork_02 | dinner_fork_185 | lower | -17, -72, 81 | spinach_particles 0.00 of 7.28 | 0.00 | 0 of 924 | 5 | 0.0, 0.21 | yes |
| fork_03 | dinner_fork_185 | lower | 53, -118, 80 | spinach_particles 0.00 of 7.93 | 0.00 | 0 of 915 | 5 | 0.0, 0.11 | yes |
| fork_04 | dinner_fork_185 | lower | -34, -161, 80 | spinach_particles 0.00 of 7.70 | 0.00 | 0 of 917 | 5 | 0.0, 0.09 | yes |
| glass_01 | tumbler_250 | upper | 196, -49, 528 | avocado 0.00 of 195.83 | 0.00 | 0 of 5337 | 5 | 0.0, 0.83 | yes |
| glass_02 | tumbler_250 | upper | 196, -142, 528 | avocado 0.00 of 198.77 | 0.00 | 0 of 5336 | 5 | 0.0, 0.87 | yes |
| glass_03 | tumbler_250 | upper | 52, -119, 533 | avocado 0.00 of 218.15 | 0.00 | 0 of 5336 | 5 | 0.0, 1.58 | yes |
| glass_04 | tumbler_250 | upper | 31, -33, 535 | avocado 0.00 of 204.41 | 0.00 | 0 of 5336 | 5 | 0.0, 1.06 | yes |
| knife_01 | dinner_knife_210 | lower | -29, -161, 78 | butter_margarine 0.00 of 13.25 | 0.00 | 0 of 1562 | 5 | 0.0, 0.22 | yes |
| knife_02 | dinner_knife_210 | lower | 48, -218, 79 | butter_margarine 0.00 of 13.73 | 0.00 | 0 of 1559 | 5 | 0.0, 0.13 | yes |
| knife_03 | dinner_knife_210 | lower | 15, -67, 79 | butter_margarine 0.00 of 13.05 | 0.00 | 0 of 1560 | 5 | 0.0, 0.10 | yes |
| knife_04 | dinner_knife_210 | lower | -19, -139, 80 | butter_margarine 0.00 of 12.52 | 0.00 | 0 of 1562 | 5 | 0.0, 0.18 | yes |
| mug_01 | mug_ceramic_300 | upper | -210, -5, 532 | tomato_sauce 0.00 of 251.90 | 0.00 | 0 of 6051 | 5 | 0.0, 1.41 | yes |
| mug_02 | mug_ceramic_300 | upper | -212, -123, 531 | tomato_sauce 0.00 of 267.86 | 0.00 | 0 of 6051 | 5 | 0.0, 1.53 | yes |
| mug_03 | mug_ceramic_300 | upper | 190, 158, 540 | tomato_sauce 0.00 of 266.89 | 0.01 | 0 of 6052 | 5 | 0.1, 1.60 | yes |
| mug_04 | mug_ceramic_300 | upper | 191, 41, 541 | tomato_sauce 0.00 of 265.00 | 0.00 | 0 of 6053 | 5 | 0.1, 1.54 | yes |
| plate_01 | dinner_plate_vitrelle_260 | lower | -175, 112, 202 | tomato_sauce 0.00 of 739.85 | 0.00 | 0 of 15632 | 5 | 0.0, 1.62 | yes |
| plate_02 | dinner_plate_vitrelle_260 | lower | -157, 111, 202 | tomato_sauce 0.00 of 726.79 | 0.00 | 0 of 15634 | 5 | 0.0, 1.62 | yes |
| plate_03 | dinner_plate_vitrelle_260 | lower | -139, 112, 202 | tomato_sauce 0.00 of 713.45 | 0.00 | 0 of 15633 | 5 | 0.0, 1.58 | yes |
| plate_04 | dinner_plate_vitrelle_260 | lower | -121, 111, 202 | tomato_sauce 0.00 of 729.83 | 0.00 | 0 of 15634 | 5 | 0.0, 1.60 | yes |
| serving_bowl_01 | serving_bowl_vitrelle_216 | lower | 219, 111, 195 | vegetable_oil 0.00 of 339.09 | 0.00 | 0 of 21923 | 5 | 0.0, 2.17 | yes |
| side_plate_01 | bread_plate_vitrelle_170 | lower | -223, 111, 151 | egg_yolk_dried 0.00 of 284.45 | 0.00 | 0 of 3883 | 5 | 0.0, 0.61 | yes |
| side_plate_02 | bread_plate_vitrelle_170 | lower | -219, -141, 145 | egg_yolk_dried 0.01 of 315.68 | 0.01 | 0 of 3882 | 4 | 0.0, 0.59 | yes |
| side_plate_03 | bread_plate_vitrelle_170 | lower | -166, -140, 145 | egg_yolk_dried 0.00 of 299.21 | 0.00 | 0 of 3885 | 5 | 0.0, 0.61 | yes |
| side_plate_04 | bread_plate_vitrelle_170 | lower | -140, -140, 144 | egg_yolk_dried 0.00 of 311.60 | 0.00 | 0 of 3885 | 5 | 0.0, 0.66 | yes |
| sippy_cup_01 | sippy_cup_240 | upper | -219, -198, 514 | avocado 0.00 of 230.21 | 0.00 | 0 of 5567 | 5 | 0.0, 1.56 | yes |
| sippy_cup_02 | sippy_cup_240 | upper | 101, -29, 523 | avocado 0.00 of 231.05 | 0.00 | 0 of 5568 | 5 | 0.0, 2.48 | yes |
| spatula_01 | spatula_silicone_280 | upper | -210, -97, 586 | butter_margarine 0.56 of 69.28 | 0.56 | 111 of 7010 | 1 | 0.0, 6.25 | no |
| spoon_01 | dessert_spoon_160 | lower | -27, -114, 80 | yoghurt 0.00 of 22.03 | 0.00 | 0 of 1078 | 5 | 0.0, 0.07 | yes |
| spoon_02 | dessert_spoon_160 | lower | 49, -159, 80 | yoghurt 0.00 of 22.32 | 0.00 | 0 of 1076 | 5 | 0.0, 0.11 | yes |
| spoon_03 | dessert_spoon_160 | lower | 7, -219, 80 | yoghurt 0.00 of 22.47 | 0.00 | 0 of 1078 | 5 | 0.0, 0.28 | yes |
| spoon_04 | dessert_spoon_160 | lower | -9, -74, 80 | yoghurt 0.00 of 23.61 | 0.00 | 0 of 1076 | 5 | 0.0, 0.17 | yes |
| turner_01 | turner_nylon_279 | lower | 64, -104, 79 | lard_tallow 0.00 of 1466.36 | 0.00 | 0 of 9438 | 5 | 0.0, 0.39 | yes |
