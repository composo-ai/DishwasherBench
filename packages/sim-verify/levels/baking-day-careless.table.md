# Demonstration wash: baking-day-careless

Level 'Baking day', loaded by the careless policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7789 ticks), tier fast, 40 items (6 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 2, spoons_nested x 1, cutlery_bunched x 3, cup_upright x 7, cup_on_side x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.9 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 0.2 s |
| Time, soil | 0.3 s |
| Time, replay | 2.4 s |
| Time, result | 0.3 s |
| Time, total | 6.1 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 169807 blocks, 430068 soil cells, 58444 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.49 GB |
| Mains water, energy | 10.0 L, 0.92 kWh |
| Water held in vessels | 2314 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 10.14 g dry at the start, 1.61 g left (16 %) |
| Items clean | 28 of 40 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1139 s | lower 40 rpm | 0.7050 | 0.5194 | 0.0389 | 0.1460 | 0.1844 | 0.0011 | 99.81 % | 0.215 kg | 0.055 kg | yes |
| l@3000 | 3921 s | lower 42 rpm | 0.7173 | 0.5248 | 0.0430 | 0.1488 | 0.1913 | 0.0011 | 99.85 % | 0.222 kg | 0.056 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4645 | 0.0564 | 0.1413 | 0.4830 | 0.0008 | 99.96 % | 0.226 kg | 0.050 kg | yes |
| ur@3000 | 3960 s | upper 31 rpm | 0.8995 | 0.4396 | 0.0534 | 0.1334 | 0.4591 | 0.0007 | 99.95 % | 0.232 kg | 0.050 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cake_fork_01 | salad_fork_156 | lower | -20, -231, 80 | jam 0.00 of 46.20 | 0.00 | 0 of 682 | 5 | 0.0, 0.13 | yes |
| cake_fork_02 | salad_fork_156 | lower | -21, -43, 81 | jam 0.00 of 45.64 | 0.00 | 0 of 683 | 5 | 0.0, 0.09 | yes |
| cake_fork_03 | salad_fork_156 | lower | -24, -211, 79 | jam 0.00 of 44.82 | 0.00 | 0 of 684 | 5 | 0.0, 0.25 | yes |
| cake_fork_04 | salad_fork_156 | lower | -18, -220, 80 | jam 0.00 of 45.92 | 0.00 | 0 of 684 | 5 | 0.0, 0.25 | yes |
| cake_fork_05 | salad_fork_156 | lower | -43, -116, 79 | jam 0.00 of 42.52 | 0.00 | 0 of 686 | 5 | 0.0, 0.15 | yes |
| cake_fork_06 | salad_fork_156 | lower | -6, -26, 80 | jam 0.00 of 45.92 | 0.00 | 0 of 688 | 5 | 0.0, 0.07 | yes |
| cake_plate_01 | dessert_plate_porcelain_190 | lower | -170, 112, 163 | egg_yolk_dried 0.03 of 357.00; jam 0.00 of 192.94 | 0.03 | 1 of 6268 | 4 | 0.0, 1.09 | yes |
| cake_plate_02 | dessert_plate_porcelain_190 | lower | -145, -140, 156 | egg_yolk_dried 0.00 of 342.71; jam 0.00 of 201.36 | 0.00 | 0 of 6619 | 5 | 0.0, 1.01 | yes |
| cake_plate_03 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | egg_yolk_dried 0.00 of 333.54; jam 0.00 of 189.06 | 0.00 | 0 of 6267 | 5 | 0.0, 1.04 | yes |
| cake_plate_04 | dessert_plate_porcelain_190 | lower | 211, 112, 168 | egg_yolk_dried 0.00 of 353.63; jam 0.00 of 191.66 | 0.00 | 0 of 6544 | 5 | 0.0, 1.17 | yes |
| cake_plate_05 | dessert_plate_porcelain_190 | lower | 170, -140, 157 | egg_yolk_dried 0.26 of 341.07; jam 0.00 of 194.89 | 0.26 | 14 of 6519 | 3 | 0.0, 1.17 | no |
| cake_plate_06 | dessert_plate_porcelain_190 | lower | 133, -139, 166 | egg_yolk_dried 0.56 of 320.11; jam 0.00 of 209.86 | 0.56 | 21 of 6271 | 2 | 0.0, 1.22 | no |
| curd_pot_01 | ramekin_porcelain_89 | upper | -58, -125, 473 | egg_yolk_dried 0.00 of 245.53 | 4.32 | 4415 of 3331 | 0 | 77.3, 1.46 | no |
| curd_pot_02 | ramekin_porcelain_89 | upper | -197, -176, 471 | egg_yolk_dried 0.12 of 243.92 | 0.15 | 6 of 3332 | 3 | 0.6, 1.28 | no |
| custard_pan_01 | saucepan_clad_2qt | lower | -64, 136, 250 | egg_cooked 98.76 of 1961.10 | 98.76 | 4622 of 25238 | 0 | 0.0, 13.58 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -23, -160, 80 | cream 0.00 of 18.37 | 0.00 | 0 of 898 | 5 | 0.0, 0.47 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -9, -158, 80 | cream 0.00 of 17.18 | 0.00 | 0 of 896 | 5 | 0.0, 0.33 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -8, -173, 80 | cream 0.00 of 16.54 | 0.00 | 0 of 897 | 5 | 0.0, 0.37 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | -18, -161, 79 | cream 0.00 of 17.36 | 0.00 | 0 of 899 | 5 | 0.0, 0.56 | yes |
| jug_01 | measuring_jug_glass_500 | lower | 100, 217, 187 | milk_film 0.00 of 68.52 | 0.00 | 0 of 17670 | 5 | 0.0, 1.61 | yes |
| knife_01 | dinner_knife_210 | lower | -33, -123, 79 | butter_margarine 0.00 of 16.02 | 0.00 | 0 of 1953 | 5 | 0.0, 0.17 | yes |
| knife_02 | dinner_knife_210 | lower | 47, -160, 79 | butter_margarine 0.00 of 16.30 | 0.00 | 0 of 1952 | 5 | 0.0, 0.11 | yes |
| mug_01 | mug_ceramic_300 | upper | -211, -9, 531 | tomato_sauce 0.00 of 250.59 | 0.00 | 0 of 6053 | 5 | 0.0, 1.44 | yes |
| mug_02 | mug_ceramic_300 | upper | -213, -124, 530 | tomato_sauce 0.00 of 257.58 | 0.00 | 0 of 6052 | 5 | 0.0, 1.40 | yes |
| mug_03 | mug_ceramic_300 | upper | 188, 162, 541 | tomato_sauce 0.30 of 281.97 | 0.31 | 4 of 6051 | 3 | 0.2, 1.96 | no |
| mug_04 | mug_ceramic_300 | upper | 185, 57, 444 | tomato_sauce 263.54 of 290.30 | 552.52 | 21446 of 6053 | 0 | 328.3, 3.47 | no |
| platter_01 | oval_platter_porcelain_320 | lower | 206, -98, 204 | butter_margarine 0.00 of 99.39 | 0.00 | 0 of 13050 | 5 | 0.0, 2.62 | yes |
| pudding_bowl_01 | cereal_bowl_vitrelle_159 | upper | 67, 134, 503 | rice_starch 0.00 of 227.45 | 0.02 | 0 of 7429 | 5 | 0.4, 1.80 | yes |
| pudding_bowl_02 | cereal_bowl_vitrelle_159 | upper | -84, 136, 511 | rice_starch 0.00 of 217.09 | 0.00 | 0 of 7433 | 5 | 0.0, 1.61 | yes |
| pudding_bowl_03 | cereal_bowl_vitrelle_159 | upper | 30, -64, 531 | rice_starch 0.00 of 218.31 | 0.00 | 0 of 7429 | 5 | 0.0, 1.44 | yes |
| pudding_bowl_04 | cereal_bowl_vitrelle_159 | upper | -84, 30, 510 | rice_starch 0.00 of 217.33 | 0.00 | 0 of 7431 | 5 | 0.0, 1.70 | yes |
| smoothie_glass_01 | tumbler_360 | upper | 163, -63, 447 | avocado 235.36 of 286.01 | 625.06 | 24606 of 7305 | 0 | 394.9, 1.59 | no |
| smoothie_glass_02 | tumbler_360 | upper | 186, -171, 445 | avocado 232.82 of 300.66 | 711.14 | 31330 of 7305 | 0 | 423.7, 2.43 | no |
| smoothie_glass_03 | tumbler_360 | upper | 114, 81, 553 | avocado 0.00 of 273.79 | 0.00 | 0 of 7304 | 5 | 0.0, 1.41 | yes |
| smoothie_glass_04 | tumbler_360 | upper | 135, 6, 446 | avocado 277.89 of 283.33 | 303.27 | 18722 of 7304 | 0 | 366.6, 1.36 | no |
| smoothie_glass_05 | tumbler_360 | upper | 130, -143, 446 | avocado 241.65 of 293.06 | 538.80 | 22662 of 7306 | 0 | 378.2, 1.61 | no |
| smoothie_glass_06 | tumbler_360 | upper | -63, -37, 471 | avocado 262.63 of 289.67 | 364.23 | 20951 of 7306 | 0 | 344.3, 1.06 | no |
| spatula_01 | spatula_silicone_280 | lower | 44, -29, 82 | butter_margarine 0.00 of 65.36 | 0.00 | 0 of 7009 | 5 | 0.0, 0.25 | yes |
| spatula_02 | spatula_silicone_280 | lower | -39, -124, 78 | butter_margarine 0.00 of 66.32 | 0.00 | 0 of 7012 | 5 | 0.0, 0.32 | yes |
| whisk_01 | balloon_whisk_292 | upper | -204, -128, 573 | cream 0.00 of 104.83 | 0.00 | 0 of 4943 | 5 | 0.0, 0.76 | yes |
