# Demonstration wash: breakfast-careless

Level 'Breakfast, found at noon', loaded by the careless policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 34 items (3 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 2, spoons_nested x 1, cutlery_bunched x 3, cup_on_side x 4, cup_upright x 4.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.2 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 0.1 s |
| Time, soil | 0.2 s |
| Time, replay | 1.6 s |
| Time, result | 0.2 s |
| Time, total | 4.4 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 141918 blocks, 318512 soil cells, 43637 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.59 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 1408 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 8.32 g dry at the start, 0.87 g left (10 %) |
| Items clean | 24 of 34 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5096 | 0.0424 | 0.1523 | 0.1941 | 0.0012 | 99.88 % | 0.150 kg | 0.036 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5177 | 0.0438 | 0.1551 | 0.1984 | 0.0012 | 99.86 % | 0.154 kg | 0.036 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4594 | 0.0622 | 0.1407 | 0.4874 | 0.0016 | 99.96 % | 0.167 kg | 0.036 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4345 | 0.0592 | 0.1328 | 0.4635 | 0.0014 | 99.94 % | 0.171 kg | 0.036 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| egg_plate_01 | dessert_plate_porcelain_190 | lower | -225, 112, 163 | egg_yolk_dried 0.00 of 447.09 | 0.00 | 0 of 5877 | 5 | 0.0, 1.02 | yes |
| egg_plate_02 | dessert_plate_porcelain_190 | lower | -223, -141, 157 | egg_yolk_dried 0.00 of 449.60 | 0.00 | 0 of 5877 | 5 | 0.0, 1.02 | yes |
| egg_plate_03 | dessert_plate_porcelain_190 | lower | -207, 112, 163 | egg_yolk_dried 0.00 of 449.74 | 0.00 | 0 of 5874 | 5 | 0.0, 1.03 | yes |
| egg_plate_04 | dessert_plate_porcelain_190 | lower | -179, -141, 201 | egg_yolk_dried 0.00 of 455.57 | 0.00 | 0 of 5874 | 5 | 0.0, 1.65 | yes |
| fork_01 | dinner_fork_185 | lower | -29, -159, 80 | egg_yolk_dried 0.86 of 66.02 | 0.86 | 15 of 913 | 3 | 0.0, 0.21 | no |
| fork_02 | dinner_fork_185 | lower | -23, -147, 80 | egg_yolk_dried 0.00 of 70.78 | 0.00 | 0 of 918 | 5 | 0.0, 0.16 | yes |
| fork_03 | dinner_fork_185 | lower | 68, -63, 79 | egg_yolk_dried 0.00 of 72.25 | 0.00 | 0 of 917 | 5 | 0.0, 0.13 | yes |
| fork_04 | dinner_fork_185 | lower | -11, -95, 80 | egg_yolk_dried 0.03 of 69.34 | 0.03 | 3 of 917 | 3 | 0.0, 0.10 | no |
| juice_glass_01 | tumbler_250 | upper | -221, -13, 513 | tomato_sauce 0.00 of 244.72 | 0.00 | 0 of 5338 | 5 | 0.0, 1.11 | yes |
| juice_glass_02 | tumbler_250 | upper | -41, -112, 507 | tomato_sauce 4.47 of 222.69 | 4.47 | 100 of 5336 | 1 | 0.0, 1.64 | no |
| juice_glass_03 | tumbler_250 | upper | -210, -156, 448 | tomato_sauce 63.77 of 251.58 | 64.58 | 1485 of 5337 | 0 | 14.4, 1.87 | no |
| juice_glass_04 | tumbler_250 | upper | 180, -198, 444 | tomato_sauce 231.30 of 231.31 | 372.17 | 23125 of 5336 | 0 | 313.4, 2.79 | no |
| knife_01 | dinner_knife_210 | lower | -18, -211, 80 | butter_margarine 0.00 of 11.79; jam 0.00 of 52.97 | 0.00 | 0 of 2107 | 5 | 0.0, 0.19 | yes |
| knife_02 | dinner_knife_210 | lower | 6, -208, 81 | butter_margarine 0.00 of 13.66; jam 0.00 of 56.44 | 0.00 | 0 of 2175 | 5 | 0.0, 0.20 | yes |
| knife_03 | dinner_knife_210 | lower | 15, -131, 79 | butter_margarine 0.00 of 13.75; jam 0.00 of 56.03 | 0.00 | 0 of 1812 | 5 | 0.0, 0.16 | yes |
| knife_04 | dinner_knife_210 | lower | -16, -159, 79 | butter_margarine 0.00 of 12.96; jam 0.00 of 50.08 | 0.00 | 0 of 2107 | 5 | 0.0, 0.15 | yes |
| mug_01 | mug_ceramic_300 | upper | 90, 198, 430 | chocolate 0.00 of 612.66; milk_skin 0.00 of 31.54 | 131.72 | 11535 of 9058 | 0 | 275.4, 2.03 | no |
| mug_02 | mug_ceramic_300 | upper | 33, -126, 478 | chocolate 0.00 of 532.42; milk_skin 0.00 of 29.12 | 0.32 | 0 of 9126 | 5 | 6.0, 2.62 | no |
| porridge_bowl_01 | cereal_bowl_vitrelle_159 | upper | -82, 136, 510 | porridge 0.01 of 499.49 | 0.01 | 1 of 9909 | 4 | 0.0, 1.65 | yes |
| porridge_bowl_02 | cereal_bowl_vitrelle_159 | upper | -73, -26, 507 | porridge 0.00 of 469.37 | 0.00 | 0 of 9908 | 4 | 0.0, 1.46 | yes |
| porridge_bowl_03 | cereal_bowl_vitrelle_159 | upper | -43, 29, 535 | porridge 0.00 of 422.97 | 0.00 | 0 of 9908 | 5 | 0.0, 1.64 | yes |
| porridge_bowl_04 | cereal_bowl_vitrelle_159 | upper | -83, 30, 510 | porridge 0.00 of 396.48 | 0.00 | 0 of 9909 | 5 | 0.0, 1.59 | yes |
| smoothie_glass_01 | tumbler_360 | upper | 194, 184, 510 | avocado 0.82 of 289.26 | 0.82 | 24 of 7304 | 2 | 0.0, 2.17 | no |
| smoothie_glass_02 | tumbler_360 | upper | 132, 96, 545 | avocado 0.00 of 305.65 | 0.00 | 0 of 7305 | 5 | 0.0, 1.22 | yes |
| smoothie_glass_03 | tumbler_360 | upper | 162, 4, 448 | avocado 278.19 of 300.73 | 522.31 | 24054 of 7305 | 0 | 391.3, 1.46 | no |
| smoothie_glass_04 | tumbler_360 | upper | 176, -92, 446 | avocado 294.02 of 312.09 | 521.42 | 27799 of 7306 | 0 | 407.7, 1.72 | no |
| spoon_01 | dessert_spoon_160 | lower | -34, -118, 80 | porridge 0.00 of 43.67 | 0.00 | 0 of 898 | 4 | 0.0, 0.55 | yes |
| spoon_02 | dessert_spoon_160 | lower | -31, -115, 79 | porridge 0.00 of 41.45 | 0.00 | 0 of 898 | 5 | 0.0, 0.54 | yes |
| spoon_03 | dessert_spoon_160 | lower | -2, -236, 80 | porridge 0.00 of 46.36 | 0.00 | 0 of 897 | 5 | 0.0, 0.47 | yes |
| spoon_04 | dessert_spoon_160 | lower | -6, -230, 79 | porridge 0.00 of 41.57 | 0.00 | 0 of 899 | 5 | 0.0, 0.47 | yes |
| toast_plate_01 | bread_plate_vitrelle_170 | lower | -186, 112, 151 | butter_margarine 0.00 of 32.26; jam 0.00 of 131.46 | 0.00 | 0 of 5389 | 5 | 0.0, 0.64 | yes |
| toast_plate_02 | bread_plate_vitrelle_170 | lower | -168, 112, 151 | butter_margarine 0.00 of 32.36; jam 0.00 of 129.83 | 0.00 | 0 of 5302 | 5 | 0.0, 0.68 | yes |
| toast_plate_03 | bread_plate_vitrelle_170 | lower | -157, -139, 149 | butter_margarine 0.00 of 32.66; jam 0.00 of 133.86 | 0.00 | 0 of 5004 | 5 | 0.0, 0.87 | yes |
| toast_plate_04 | bread_plate_vitrelle_170 | lower | -144, 111, 179 | butter_margarine 0.00 of 34.15; jam 0.00 of 119.34 | 0.00 | 0 of 5440 | 5 | 0.0, 0.69 | yes |
