# Demonstration wash: breakfast-careful

Level 'Breakfast, found at noon', loaded by the careful policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v7.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 11 of 100 cases: 0 in 100 for crockery, 23 in 100 for cutlery, 5 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 34 items (3 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 1.9 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 41.8 s |
| Time, soil | 0.1 s |
| Time, replay | 0.8 s |
| Time, result | 0.1 s |
| Time, total | 44.8 s (0.7 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 141918 blocks, 318512 soil cells, 43637 deposits |
| GPU memory | scene 124.9 MB, peak of all buffers 129.7 MB |
| Process memory (RSS) | 1.04 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 8.32 g dry at the start, 0.00 g left (0 %) |
| Items clean | 34 of 34 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5124 | 0.0436 | 0.1483 | 0.1914 | 0.0012 | 99.86 % | 0.142 kg | 0.026 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5209 | 0.0449 | 0.1508 | 0.1952 | 0.0012 | 99.83 % | 0.146 kg | 0.026 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4514 | 0.0709 | 0.1401 | 0.4950 | 0.0021 | 99.93 % | 0.148 kg | 0.026 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4272 | 0.0672 | 0.1321 | 0.4705 | 0.0018 | 99.91 % | 0.153 kg | 0.026 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| egg_plate_01 | dessert_plate_porcelain_190 | lower | -225, 112, 163 | egg_yolk_dried 0.00 of 447.09 | 0.00 | 0 of 5877 | 5 | 0.0, 1.02 | yes |
| egg_plate_02 | dessert_plate_porcelain_190 | lower | -223, -141, 157 | egg_yolk_dried 0.00 of 449.60 | 0.00 | 0 of 5877 | 5 | 0.0, 1.04 | yes |
| egg_plate_03 | dessert_plate_porcelain_190 | lower | -207, 112, 163 | egg_yolk_dried 0.01 of 449.74 | 0.01 | 1 of 5874 | 4 | 0.0, 1.03 | yes |
| egg_plate_04 | dessert_plate_porcelain_190 | lower | -197, -140, 156 | egg_yolk_dried 0.00 of 455.57 | 0.00 | 0 of 5874 | 5 | 0.0, 1.19 | yes |
| fork_01 | dinner_fork_185 | lower | -29, -161, 79 | egg_yolk_dried 0.00 of 66.02 | 0.00 | 0 of 913 | 5 | 0.0, 0.15 | yes |
| fork_02 | dinner_fork_185 | lower | 53, -219, 80 | egg_yolk_dried 0.00 of 70.78 | 0.00 | 0 of 918 | 5 | 0.0, 0.09 | yes |
| fork_03 | dinner_fork_185 | lower | 46, -63, 79 | egg_yolk_dried 0.04 of 72.25 | 0.04 | 3 of 917 | 4 | 0.0, 0.14 | yes |
| fork_04 | dinner_fork_185 | lower | -21, -102, 80 | egg_yolk_dried 0.00 of 69.34 | 0.00 | 0 of 917 | 5 | 0.0, 0.12 | yes |
| juice_glass_01 | tumbler_250 | upper | -221, -13, 513 | tomato_sauce 0.00 of 244.72 | 0.00 | 0 of 5338 | 5 | 0.0, 1.05 | yes |
| juice_glass_02 | tumbler_250 | upper | -215, -106, 517 | tomato_sauce 0.00 of 222.69 | 0.00 | 0 of 5336 | 5 | 0.0, 0.90 | yes |
| juice_glass_03 | tumbler_250 | upper | -221, -198, 513 | tomato_sauce 0.00 of 251.58 | 0.00 | 0 of 5337 | 5 | 0.0, 1.02 | yes |
| juice_glass_04 | tumbler_250 | upper | 196, -185, 528 | tomato_sauce 0.00 of 231.31 | 0.00 | 0 of 5336 | 5 | 0.0, 0.87 | yes |
| knife_01 | dinner_knife_210 | lower | -24, -220, 80 | butter_margarine 0.00 of 11.79; jam 0.00 of 52.97 | 0.00 | 0 of 2107 | 5 | 0.0, 0.20 | yes |
| knife_02 | dinner_knife_210 | lower | -47, -41, 79 | butter_margarine 0.00 of 13.66; jam 0.00 of 56.44 | 0.00 | 0 of 2175 | 5 | 0.0, 0.17 | yes |
| knife_03 | dinner_knife_210 | lower | 31, -131, 79 | butter_margarine 0.00 of 13.75; jam 0.00 of 56.03 | 0.00 | 0 of 1812 | 5 | 0.0, 0.11 | yes |
| knife_04 | dinner_knife_210 | lower | -21, -160, 80 | butter_margarine 0.00 of 12.96; jam 0.00 of 50.08 | 0.00 | 0 of 2107 | 5 | 0.0, 0.19 | yes |
| mug_01 | mug_ceramic_300 | upper | 105, 157, 530 | chocolate 0.00 of 612.66; milk_skin 0.00 of 31.54 | 0.00 | 0 of 9058 | 5 | 0.1, 1.86 | yes |
| mug_02 | mug_ceramic_300 | upper | 107, -139, 529 | chocolate 0.00 of 532.42; milk_skin 0.00 of 29.12 | 0.00 | 0 of 9126 | 5 | 0.1, 1.76 | yes |
| porridge_bowl_01 | cereal_bowl_vitrelle_159 | upper | -84, 158, 510 | porridge 0.00 of 499.49 | 0.00 | 0 of 9909 | 4 | 0.0, 1.45 | yes |
| porridge_bowl_02 | cereal_bowl_vitrelle_159 | upper | -82, 125, 510 | porridge 0.00 of 469.37 | 0.00 | 0 of 9908 | 4 | 0.0, 1.40 | yes |
| porridge_bowl_03 | cereal_bowl_vitrelle_159 | upper | -83, 89, 510 | porridge 0.00 of 422.97 | 0.00 | 0 of 9908 | 5 | 0.0, 1.41 | yes |
| porridge_bowl_04 | cereal_bowl_vitrelle_159 | upper | -82, 31, 511 | porridge 0.00 of 396.48 | 0.00 | 0 of 9909 | 5 | 0.0, 1.42 | yes |
| smoothie_glass_01 | tumbler_360 | upper | 195, 185, 564 | avocado 0.00 of 289.26 | 0.00 | 0 of 7304 | 5 | 0.0, 1.27 | yes |
| smoothie_glass_02 | tumbler_360 | upper | 195, 91, 564 | avocado 0.00 of 305.65 | 0.00 | 0 of 7305 | 5 | 0.0, 1.16 | yes |
| smoothie_glass_03 | tumbler_360 | upper | 195, 4, 564 | avocado 0.00 of 300.73 | 0.00 | 0 of 7305 | 5 | 0.0, 1.19 | yes |
| smoothie_glass_04 | tumbler_360 | upper | 195, -93, 564 | avocado 0.00 of 312.09 | 0.00 | 0 of 7306 | 5 | 0.0, 1.14 | yes |
| spoon_01 | dessert_spoon_160 | lower | -28, -115, 80 | porridge 0.00 of 43.67 | 0.00 | 0 of 898 | 5 | 0.0, 0.07 | yes |
| spoon_02 | dessert_spoon_160 | lower | 50, -160, 79 | porridge 0.00 of 41.45 | 0.00 | 0 of 898 | 5 | 0.0, 0.07 | yes |
| spoon_03 | dessert_spoon_160 | lower | -7, -222, 80 | porridge 0.00 of 46.36 | 0.00 | 0 of 897 | 5 | 0.0, 0.14 | yes |
| spoon_04 | dessert_spoon_160 | lower | -52, -51, 79 | porridge 0.00 of 41.57 | 0.00 | 0 of 899 | 5 | 0.0, 0.20 | yes |
| toast_plate_01 | bread_plate_vitrelle_170 | lower | -186, 112, 151 | butter_margarine 0.00 of 32.26; jam 0.00 of 131.46 | 0.00 | 0 of 5389 | 5 | 0.0, 0.64 | yes |
| toast_plate_02 | bread_plate_vitrelle_170 | lower | -168, 111, 151 | butter_margarine 0.00 of 32.36; jam 0.00 of 129.83 | 0.00 | 0 of 5302 | 5 | 0.0, 0.65 | yes |
| toast_plate_03 | bread_plate_vitrelle_170 | lower | -166, -140, 145 | butter_margarine 0.00 of 32.66; jam 0.00 of 133.86 | 0.00 | 0 of 5004 | 5 | 0.0, 0.61 | yes |
| toast_plate_04 | bread_plate_vitrelle_170 | lower | -150, 112, 151 | butter_margarine 0.00 of 34.15; jam 0.00 of 119.34 | 0.00 | 0 of 5440 | 5 | 0.0, 0.62 | yes |
