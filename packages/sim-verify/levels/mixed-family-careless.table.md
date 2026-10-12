# Demonstration wash: mixed-family-careless

Level 'Everyday family load', loaded by the careless policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v7.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 11 of 100 cases: 0 in 100 for crockery, 23 in 100 for cutlery, 5 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 39 items (6 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 1, spoons_nested x 1, cutlery_bunched x 2, cup_upright x 3, cup_on_side x 5, item_over_others x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.2 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 44.7 s |
| Time, soil | 0.2 s |
| Time, replay | 1.5 s |
| Time, result | 0.2 s |
| Time, total | 48.9 s (0.8 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 173243 blocks, 443812 soil cells, 67936 deposits |
| GPU memory | scene 126.5 MB, peak of all buffers 129.7 MB |
| Process memory (RSS) | 1.09 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 888 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 9.44 g dry at the start, 0.66 g left (7 %) |
| Items clean | 31 of 39 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5234 | 0.0402 | 0.1407 | 0.1804 | 0.0012 | 99.90 % | 0.194 kg | 0.048 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5310 | 0.0431 | 0.1425 | 0.1852 | 0.0011 | 99.90 % | 0.200 kg | 0.048 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4653 | 0.0562 | 0.1408 | 0.4824 | 0.0007 | 99.94 % | 0.202 kg | 0.048 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4399 | 0.0535 | 0.1331 | 0.4589 | 0.0006 | 99.91 % | 0.209 kg | 0.048 kg | yes |

## What the wash reports

- placement: bottle_teat_01 is likely to be moved by the jets (peak upward jet force 0.90 of its weight); it is simulated where it was placed
- placement: sippy_cup_02 is likely to be moved by the jets (peak upward jet force 1.21 of its weight); it is simulated where it was placed

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| baby_bottle_01 | baby_bottle_pp_260 | upper | 143, 45, 559 | milk_film 0.00 of 92.03 | 0.00 | 0 of 23475 | 5 | 0.0, 1.73 | yes |
| bottle_teat_01 | bottle_teat_silicone | upper | 83, 207, 430 | milk_film 0.00 of 12.24 | 0.00 | 0 of 3087 | 5 | 0.0, 1.35 | yes |
| cereal_bowl_01 | cereal_bowl_vitrelle_159 | upper | -111, 87, 529 | yoghurt 0.00 of 184.46 | 0.00 | 0 of 9909 | 5 | 0.0, 1.39 | yes |
| cereal_bowl_02 | cereal_bowl_vitrelle_159 | upper | -93, 139, 514 | yoghurt 0.00 of 175.89 | 0.00 | 0 of 9909 | 5 | 0.0, 1.52 | yes |
| cereal_bowl_04 | cereal_bowl_vitrelle_159 | upper | -57, 76, 526 | yoghurt 0.00 of 209.39 | 0.00 | 0 of 9909 | 5 | 0.0, 1.41 | yes |
| chopping_board_01 | chopping_board_pp_375 | lower | -208, -14, 211 | spinach_particles 0.00 of 265.90 | 0.00 | 0 of 29789 | 5 | 0.0, 4.68 | yes |
| fork_01 | dinner_fork_185 | lower | 7, -222, 80 | spinach_particles 0.00 of 7.48 | 0.00 | 0 of 917 | 5 | 0.0, 0.14 | yes |
| fork_02 | dinner_fork_185 | lower | -15, -74, 80 | spinach_particles 0.00 of 7.28 | 0.00 | 0 of 924 | 5 | 0.0, 0.17 | yes |
| fork_03 | dinner_fork_185 | lower | 57, -122, 80 | spinach_particles 0.00 of 7.93 | 0.00 | 0 of 915 | 5 | 0.0, 0.10 | yes |
| fork_04 | dinner_fork_185 | lower | -26, -211, 80 | spinach_particles 0.00 of 7.70 | 0.00 | 0 of 917 | 5 | 0.0, 0.15 | yes |
| glass_01 | tumbler_250 | upper | 195, -96, 457 | avocado 30.91 of 195.83 | 32.73 | 2691 of 5337 | 0 | 28.4, 1.26 | no |
| glass_02 | tumbler_250 | upper | 181, -160, 444 | avocado 187.97 of 198.77 | 415.71 | 23818 of 5336 | 0 | 312.4, 2.86 | no |
| glass_03 | tumbler_250 | upper | 30, -119, 449 | avocado 218.15 of 218.15 | 241.29 | 17219 of 5336 | 0 | 302.3, 1.81 | no |
| glass_04 | tumbler_250 | upper | 9, -28, 448 | avocado 198.93 of 204.41 | 214.53 | 13109 of 5336 | 0 | 244.1, 1.20 | no |
| knife_01 | dinner_knife_210 | lower | -31, -161, 78 | butter_margarine 0.00 of 13.25 | 0.00 | 0 of 1562 | 5 | 0.0, 0.15 | yes |
| knife_02 | dinner_knife_210 | lower | 48, -217, 79 | butter_margarine 0.00 of 13.73 | 0.00 | 0 of 1559 | 5 | 0.0, 0.13 | yes |
| knife_03 | dinner_knife_210 | lower | 15, -68, 79 | butter_margarine 0.00 of 13.05 | 0.00 | 0 of 1560 | 5 | 0.0, 0.10 | yes |
| knife_04 | dinner_knife_210 | lower | -47, -159, 78 | butter_margarine 0.00 of 12.52 | 0.00 | 0 of 1562 | 5 | 0.0, 0.14 | yes |
| mug_01 | mug_ceramic_300 | upper | -82, 2, 543 | tomato_sauce 0.00 of 251.90 | 0.00 | 0 of 6051 | 5 | 0.0, 1.89 | yes |
| mug_02 | mug_ceramic_300 | upper | -213, -124, 531 | tomato_sauce 0.00 of 267.86 | 0.00 | 0 of 6051 | 5 | 0.0, 1.53 | yes |
| mug_03 | mug_ceramic_300 | upper | 186, 232, 475 | tomato_sauce 2.88 of 266.89 | 2.88 | 69 of 6052 | 1 | 0.0, 3.06 | no |
| mug_04 | mug_ceramic_300 | upper | 28, 188, 480 | tomato_sauce 5.30 of 265.00 | 5.30 | 125 of 6053 | 1 | 0.0, 2.96 | no |
| plate_01 | dinner_plate_vitrelle_260 | lower | -175, 112, 202 | tomato_sauce 0.00 of 739.85 | 0.00 | 0 of 15632 | 5 | 0.0, 1.63 | yes |
| plate_02 | dinner_plate_vitrelle_260 | lower | -157, 111, 202 | tomato_sauce 0.00 of 726.79 | 0.00 | 0 of 15634 | 5 | 0.0, 1.61 | yes |
| plate_03 | dinner_plate_vitrelle_260 | lower | -139, 112, 202 | tomato_sauce 0.00 of 713.45 | 0.00 | 0 of 15633 | 5 | 0.0, 1.60 | yes |
| plate_04 | dinner_plate_vitrelle_260 | lower | -121, 112, 202 | tomato_sauce 0.00 of 729.83 | 0.00 | 0 of 15634 | 5 | 0.0, 1.63 | yes |
| serving_bowl_01 | serving_bowl_vitrelle_216 | lower | 219, 111, 195 | vegetable_oil 0.00 of 339.09 | 0.00 | 0 of 21923 | 5 | 0.0, 1.99 | yes |
| side_plate_01 | bread_plate_vitrelle_170 | lower | -223, 111, 151 | egg_yolk_dried 0.01 of 284.45 | 0.01 | 0 of 3883 | 4 | 0.0, 0.65 | yes |
| side_plate_02 | bread_plate_vitrelle_170 | lower | -219, -141, 145 | egg_yolk_dried 0.14 of 315.68 | 0.14 | 4 of 3882 | 4 | 0.0, 0.60 | yes |
| side_plate_03 | bread_plate_vitrelle_170 | lower | -95, 111, 151 | egg_yolk_dried 0.01 of 299.21 | 0.01 | 1 of 3885 | 4 | 0.0, 0.70 | yes |
| side_plate_04 | bread_plate_vitrelle_170 | lower | -132, -139, 149 | egg_yolk_dried 0.16 of 311.60 | 0.16 | 12 of 3885 | 2 | 0.0, 0.93 | no |
| sippy_cup_01 | sippy_cup_240 | upper | -219, -198, 514 | avocado 0.00 of 230.21 | 0.00 | 0 of 5567 | 5 | 0.0, 1.58 | yes |
| sippy_cup_02 | sippy_cup_240 | upper | 110, -56, 455 | avocado 13.41 of 231.05 | 13.44 | 323 of 5568 | 0 | 0.5, 3.25 | no |
| spatula_01 | spatula_silicone_280 | upper | -42, -5, 607 | butter_margarine 0.00 of 69.28 | 0.00 | 0 of 7010 | 5 | 0.0, 0.20 | yes |
| spoon_01 | dessert_spoon_160 | lower | -25, -115, 80 | yoghurt 0.00 of 22.03 | 0.00 | 0 of 1078 | 5 | 0.0, 0.45 | yes |
| spoon_02 | dessert_spoon_160 | lower | -21, -115, 80 | yoghurt 0.00 of 22.32 | 0.00 | 0 of 1076 | 5 | 0.0, 0.46 | yes |
| spoon_03 | dessert_spoon_160 | lower | 2, -76, 80 | yoghurt 0.00 of 22.47 | 0.00 | 0 of 1078 | 5 | 0.0, 0.31 | yes |
| spoon_04 | dessert_spoon_160 | lower | -8, -75, 80 | yoghurt 0.00 of 23.61 | 0.00 | 0 of 1076 | 5 | 0.0, 0.37 | yes |
| turner_01 | turner_nylon_279 | lower | 64, -104, 79 | lard_tallow 0.00 of 1466.36 | 0.00 | 0 of 9438 | 5 | 0.0, 0.40 | yes |
