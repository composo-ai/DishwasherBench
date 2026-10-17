# Demonstration wash: lunch-for-four-careless

Level 'Lunch for four', loaded by the careless policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 36 items (3 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 1, spoons_nested x 1, cutlery_bunched x 2, cup_upright x 4, cup_on_side x 4.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.5 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 0.1 s |
| Time, soil | 0.2 s |
| Time, replay | 1.3 s |
| Time, result | 0.2 s |
| Time, total | 4.4 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 167068 blocks, 419112 soil cells, 59893 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.63 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 968 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 7.19 g dry at the start, 0.46 g left (6 %) |
| Items clean | 28 of 36 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5103 | 0.0422 | 0.1518 | 0.1934 | 0.0012 | 99.93 % | 0.197 kg | 0.045 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5185 | 0.0441 | 0.1541 | 0.1976 | 0.0012 | 99.92 % | 0.203 kg | 0.045 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4647 | 0.0564 | 0.1411 | 0.4827 | 0.0010 | 99.94 % | 0.219 kg | 0.045 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4397 | 0.0535 | 0.1332 | 0.4588 | 0.0009 | 99.95 % | 0.226 kg | 0.045 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| fork_01 | dinner_fork_185 | lower | -0, -224, 80 | spinach_particles 0.00 of 7.31 | 0.00 | 0 of 915 | 5 | 0.0, 0.28 | yes |
| fork_02 | dinner_fork_185 | lower | -9, -47, 80 | spinach_particles 0.00 of 7.08 | 0.00 | 0 of 918 | 5 | 0.0, 0.15 | yes |
| fork_03 | dinner_fork_185 | lower | 7, -223, 80 | spinach_particles 0.00 of 8.53 | 0.00 | 0 of 916 | 5 | 0.0, 0.22 | yes |
| fork_04 | dinner_fork_185 | lower | -35, -160, 79 | spinach_particles 0.00 of 7.15 | 0.00 | 0 of 917 | 5 | 0.0, 0.11 | yes |
| ketchup_pot_01 | ramekin_porcelain_89 | upper | 13, -132, 448 | tomato_sauce 86.38 of 196.22 | 93.11 | 6789 of 4440 | 0 | 140.0, 1.74 | no |
| ketchup_pot_02 | ramekin_porcelain_89 | upper | -182, -205, 434 | tomato_sauce 80.49 of 190.54 | 87.09 | 7287 of 4441 | 0 | 88.7, 1.96 | no |
| knife_01 | dinner_knife_210 | lower | -29, -161, 78 | butter_margarine 0.00 of 13.30 | 0.00 | 0 of 1561 | 5 | 0.0, 0.18 | yes |
| knife_02 | dinner_knife_210 | lower | 48, -218, 79 | butter_margarine 0.00 of 12.98 | 0.00 | 0 of 1560 | 5 | 0.0, 0.13 | yes |
| knife_03 | dinner_knife_210 | lower | 50, -46, 79 | butter_margarine 0.00 of 12.18 | 0.00 | 0 of 1560 | 5 | 0.0, 0.12 | yes |
| knife_04 | dinner_knife_210 | lower | -14, -139, 81 | butter_margarine 0.00 of 13.63 | 0.00 | 0 of 1562 | 5 | 0.0, 0.21 | yes |
| mug_01 | mug_ceramic_300 | upper | -211, -13, 532 | tomato_sauce 0.00 of 284.72 | 0.00 | 0 of 6051 | 5 | 0.1, 1.79 | yes |
| mug_02 | mug_ceramic_300 | upper | -210, -122, 533 | tomato_sauce 0.00 of 259.41 | 0.00 | 0 of 6051 | 5 | 0.1, 1.78 | yes |
| mug_03 | mug_ceramic_300 | upper | 186, 223, 469 | tomato_sauce 44.45 of 252.43 | 56.39 | 7892 of 6054 | 0 | 92.5, 2.05 | no |
| mug_04 | mug_ceramic_300 | upper | 200, 86, 471 | tomato_sauce 40.20 of 272.08 | 42.18 | 2848 of 6053 | 0 | 41.2, 2.24 | no |
| plate_01 | dinner_plate_porcelain_270 | lower | -228, -121, 213 | tomato_sauce 0.00 of 688.01 | 0.00 | 0 of 15740 | 5 | 0.0, 2.29 | yes |
| plate_02 | dinner_plate_porcelain_270 | lower | -204, -121, 211 | tomato_sauce 0.00 of 701.55 | 0.00 | 0 of 15741 | 5 | 0.0, 2.12 | yes |
| plate_03 | dinner_plate_porcelain_270 | lower | -175, -121, 213 | tomato_sauce 0.00 of 668.80 | 0.00 | 0 of 15740 | 5 | 0.0, 2.09 | yes |
| plate_04 | dinner_plate_porcelain_270 | lower | -150, -121, 212 | tomato_sauce 0.00 of 723.35 | 0.00 | 0 of 15742 | 5 | 0.0, 2.07 | yes |
| salad_bowl_01 | serving_bowl_vitrelle_216 | lower | 219, 112, 195 | vegetable_oil 0.00 of 377.70; spinach_particles 0.00 of 34.93 | 0.00 | 0 of 27791 | 5 | 0.0, 2.20 | yes |
| side_plate_01 | dessert_plate_porcelain_190 | lower | -225, 112, 163 | vegetable_oil 0.00 of 127.62; spinach_particles 0.00 of 17.75 | 0.00 | 0 of 8371 | 5 | 0.0, 1.02 | yes |
| side_plate_02 | dessert_plate_porcelain_190 | lower | -207, 112, 163 | vegetable_oil 0.00 of 123.38; spinach_particles 0.00 of 19.34 | 0.00 | 0 of 8772 | 5 | 0.0, 1.02 | yes |
| side_plate_03 | dessert_plate_porcelain_190 | lower | -189, 112, 163 | vegetable_oil 0.00 of 129.30; spinach_particles 0.00 of 18.93 | 0.00 | 0 of 8314 | 5 | 0.0, 1.02 | yes |
| side_plate_04 | dessert_plate_porcelain_190 | lower | -160, 112, 203 | vegetable_oil 0.00 of 102.57; spinach_particles 0.00 of 17.73 | 0.00 | 0 of 8685 | 5 | 0.0, 1.10 | yes |
| smoothie_glass_01 | tumbler_250 | upper | 183, -55, 446 | avocado 49.77 of 194.73 | 178.04 | 17564 of 5335 | 0 | 293.8, 1.73 | no |
| smoothie_glass_02 | tumbler_250 | upper | -33, -17, 535 | avocado 0.00 of 211.74 | 0.00 | 0 of 5336 | 5 | 0.0, 0.90 | yes |
| smoothie_glass_03 | tumbler_250 | upper | 118, -47, 555 | avocado 0.00 of 221.01 | 0.00 | 0 of 5337 | 5 | 0.0, 0.88 | yes |
| smoothie_glass_04 | tumbler_250 | upper | 33, 81, 447 | avocado 54.22 of 211.59 | 65.42 | 8564 of 5338 | 0 | 232.2, 1.16 | no |
| spoon_01 | dessert_spoon_160 | lower | -24, -118, 79 | yoghurt 0.00 of 19.27 | 0.00 | 0 of 899 | 5 | 0.0, 0.17 | yes |
| spoon_02 | dessert_spoon_160 | lower | -35, -105, 79 | yoghurt 0.00 of 18.93 | 0.00 | 0 of 899 | 5 | 0.0, 0.13 | yes |
| spoon_03 | dessert_spoon_160 | lower | 3, -226, 80 | yoghurt 0.00 of 17.76 | 0.00 | 0 of 898 | 5 | 0.0, 0.41 | yes |
| spoon_04 | dessert_spoon_160 | lower | 7, -236, 81 | yoghurt 0.00 of 18.53 | 0.00 | 0 of 896 | 5 | 0.0, 0.25 | yes |
| squash_glass_01 | tumbler_360 | upper | 107, 228, 453 | avocado 42.00 of 187.99 | 42.87 | 1290 of 4870 | 0 | 18.1, 2.28 | no |
| squash_glass_02 | tumbler_360 | upper | 91, -88, 456 | avocado 64.69 of 197.14 | 80.86 | 8231 of 4868 | 0 | 61.2, 1.86 | no |
| yoghurt_bowl_01 | cereal_bowl_vitrelle_159 | upper | -122, 7, 537 | yoghurt 0.00 of 187.85 | 0.00 | 0 of 9908 | 5 | 0.0, 2.13 | yes |
| yoghurt_bowl_02 | cereal_bowl_vitrelle_159 | upper | -54, 30, 573 | yoghurt 0.00 of 211.27 | 0.00 | 0 of 9908 | 5 | 0.0, 3.70 | yes |
| yoghurt_bowl_03 | cereal_bowl_vitrelle_159 | upper | -82, 101, 511 | yoghurt 0.00 of 200.76 | 0.00 | 0 of 9909 | 5 | 0.0, 1.59 | yes |
