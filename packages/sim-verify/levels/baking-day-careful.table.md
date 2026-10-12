# Demonstration wash: baking-day-careful

Level 'Baking day', loaded by the careful policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v7.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 11 of 100 cases: 0 in 100 for crockery, 23 in 100 for cutlery, 5 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 38 items (8 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.2 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 45.7 s |
| Time, soil | 0.2 s |
| Time, replay | 2.7 s |
| Time, result | 0.7 s |
| Time, total | 51.6 s (0.9 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 155754 blocks, 373856 soil cells, 50127 deposits |
| GPU memory | scene 130.1 MB, peak of all buffers 130.1 MB |
| Process memory (RSS) | 1.06 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 9.97 g dry at the start, 0.04 g left (0 %) |
| Items clean | 37 of 38 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5123 | 0.0403 | 0.1517 | 0.1915 | 0.0012 | 99.74 % | 0.191 kg | 0.046 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5187 | 0.0436 | 0.1543 | 0.1975 | 0.0012 | 99.80 % | 0.196 kg | 0.046 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4616 | 0.0583 | 0.1423 | 0.4860 | 0.0008 | 99.93 % | 0.203 kg | 0.041 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4368 | 0.0554 | 0.1343 | 0.4620 | 0.0007 | 99.94 % | 0.210 kg | 0.041 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cake_fork_01 | salad_fork_156 | lower | -23, -227, 79 | jam 0.00 of 46.20 | 0.00 | 0 of 682 | 5 | 0.0, 0.15 | yes |
| cake_fork_02 | salad_fork_156 | lower | -24, -45, 80 | jam 0.00 of 45.64 | 0.00 | 0 of 683 | 5 | 0.0, 0.09 | yes |
| cake_fork_03 | salad_fork_156 | lower | 52, -115, 80 | jam 0.00 of 44.82 | 0.00 | 0 of 684 | 5 | 0.0, 0.11 | yes |
| cake_fork_04 | salad_fork_156 | lower | -12, -220, 80 | jam 0.00 of 45.92 | 0.00 | 0 of 684 | 5 | 0.0, 0.09 | yes |
| cake_fork_05 | salad_fork_156 | lower | -43, -115, 79 | jam 0.00 of 42.52 | 0.00 | 0 of 686 | 5 | 0.0, 0.16 | yes |
| cake_fork_06 | salad_fork_156 | lower | -6, -26, 80 | jam 0.00 of 45.92 | 0.00 | 0 of 688 | 5 | 0.0, 0.07 | yes |
| cake_plate_01 | dessert_plate_porcelain_190 | lower | -170, 112, 163 | egg_yolk_dried 0.06 of 357.00; jam 0.00 of 192.94 | 0.06 | 3 of 6268 | 4 | 0.0, 1.10 | yes |
| cake_plate_02 | dessert_plate_porcelain_190 | lower | -145, -140, 156 | egg_yolk_dried 0.00 of 342.71; jam 0.00 of 201.36 | 0.00 | 0 of 6619 | 5 | 0.0, 1.02 | yes |
| cake_plate_03 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | egg_yolk_dried 0.00 of 333.54; jam 0.00 of 189.06 | 0.00 | 0 of 6267 | 5 | 0.0, 1.04 | yes |
| cake_plate_04 | dessert_plate_porcelain_190 | lower | 221, 112, 158 | egg_yolk_dried 0.00 of 353.63; jam 0.00 of 191.66 | 0.00 | 0 of 6544 | 5 | 0.0, 1.15 | yes |
| cake_plate_05 | dessert_plate_porcelain_190 | lower | 170, -140, 157 | egg_yolk_dried 0.00 of 341.07; jam 0.00 of 194.89 | 0.00 | 0 of 6519 | 5 | 0.0, 1.05 | yes |
| cake_plate_06 | dessert_plate_porcelain_190 | lower | 145, -140, 156 | egg_yolk_dried 0.01 of 320.11; jam 0.00 of 209.86 | 0.01 | 0 of 6271 | 4 | 0.0, 1.23 | yes |
| curd_pot_01 | ramekin_porcelain_89 | upper | -74, -121, 504 | egg_yolk_dried 0.00 of 245.53 | 0.00 | 0 of 3331 | 5 | 0.0, 1.35 | yes |
| curd_pot_02 | ramekin_porcelain_89 | upper | -204, -203, 473 | egg_yolk_dried 0.00 of 243.92 | 0.00 | 0 of 3332 | 4 | 0.0, 1.49 | yes |
| custard_pan_01 | saucepan_clad_2qt | lower | -64, 138, 251 | egg_cooked 37.30 of 1961.10 | 37.30 | 2005 of 25238 | 0 | 0.0, 13.77 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -25, -160, 79 | cream 0.00 of 18.37 | 0.00 | 0 of 898 | 5 | 0.0, 0.45 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | 51, -220, 80 | cream 0.00 of 17.18 | 0.00 | 0 of 896 | 5 | 0.0, 0.09 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | 52, -26, 81 | cream 0.00 of 16.54 | 0.00 | 0 of 897 | 5 | 0.0, 0.19 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | -22, -161, 79 | cream 0.00 of 17.36 | 0.00 | 0 of 899 | 5 | 0.0, 0.45 | yes |
| knife_01 | dinner_knife_210 | lower | -32, -121, 79 | butter_margarine 0.00 of 16.02 | 0.00 | 0 of 1953 | 5 | 0.0, 0.24 | yes |
| knife_02 | dinner_knife_210 | lower | 48, -160, 79 | butter_margarine 0.00 of 16.30 | 0.00 | 0 of 1952 | 5 | 0.0, 0.11 | yes |
| mug_01 | mug_ceramic_300 | upper | -210, -6, 532 | tomato_sauce 0.00 of 250.59 | 0.00 | 0 of 6053 | 5 | 0.0, 1.39 | yes |
| mug_02 | mug_ceramic_300 | upper | -212, -122, 531 | tomato_sauce 0.00 of 257.58 | 0.00 | 0 of 6052 | 5 | 0.0, 1.47 | yes |
| mug_03 | mug_ceramic_300 | upper | 188, 159, 541 | tomato_sauce 0.00 of 281.97 | 0.01 | 0 of 6051 | 5 | 0.1, 1.91 | yes |
| mug_04 | mug_ceramic_300 | upper | 191, 41, 541 | tomato_sauce 0.00 of 290.30 | 0.00 | 0 of 6053 | 5 | 0.1, 1.50 | yes |
| pudding_bowl_01 | cereal_bowl_vitrelle_159 | upper | -84, 158, 510 | rice_starch 0.00 of 227.45 | 0.00 | 0 of 7429 | 5 | 0.0, 1.44 | yes |
| pudding_bowl_02 | cereal_bowl_vitrelle_159 | upper | -82, 125, 510 | rice_starch 0.00 of 217.09 | 0.00 | 0 of 7433 | 5 | 0.0, 1.37 | yes |
| pudding_bowl_03 | cereal_bowl_vitrelle_159 | upper | -83, 89, 510 | rice_starch 0.00 of 218.31 | 0.00 | 0 of 7429 | 5 | 0.0, 1.39 | yes |
| pudding_bowl_04 | cereal_bowl_vitrelle_159 | upper | -82, 31, 511 | rice_starch 0.00 of 217.33 | 0.00 | 0 of 7431 | 5 | 0.0, 1.45 | yes |
| smoothie_glass_01 | tumbler_360 | upper | 195, -49, 564 | avocado 0.00 of 286.01 | 0.00 | 0 of 7305 | 5 | 0.0, 1.21 | yes |
| smoothie_glass_02 | tumbler_360 | upper | 195, -148, 564 | avocado 0.00 of 300.66 | 0.00 | 0 of 7305 | 5 | 0.0, 1.29 | yes |
| smoothie_glass_03 | tumbler_360 | upper | 115, 81, 552 | avocado 0.00 of 273.79 | 0.00 | 0 of 7304 | 5 | 0.0, 1.21 | yes |
| smoothie_glass_04 | tumbler_360 | upper | 115, -29, 552 | avocado 0.00 of 283.33 | 0.00 | 0 of 7304 | 5 | 0.0, 1.28 | yes |
| smoothie_glass_05 | tumbler_360 | upper | 115, -139, 552 | avocado 0.00 of 293.06 | 0.00 | 0 of 7306 | 5 | 0.0, 1.25 | yes |
| smoothie_glass_06 | tumbler_360 | upper | -87, -17, 562 | avocado 0.00 of 289.67 | 0.00 | 0 of 7306 | 5 | 0.0, 1.03 | yes |
| spatula_01 | spatula_silicone_280 | lower | 46, -34, 82 | butter_margarine 0.00 of 65.36 | 0.00 | 0 of 7009 | 5 | 0.0, 0.28 | yes |
| spatula_02 | spatula_silicone_280 | lower | -39, -124, 78 | butter_margarine 0.00 of 66.32 | 0.00 | 0 of 7012 | 5 | 0.0, 0.35 | yes |
| whisk_01 | balloon_whisk_292 | upper | -204, -128, 573 | cream 0.00 of 104.83 | 0.00 | 0 of 4943 | 5 | 0.0, 0.79 | yes |
