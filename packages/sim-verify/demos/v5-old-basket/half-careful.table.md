# Demonstration wash: half-careful

Half of the IEC load (six place settings), loaded carefully and well spaced.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7448 ticks), tier official, 62 items (3 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-6, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 5.4 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 371.3 s |
| Time, soil | 1.1 s |
| Time, replay | 9.8 s |
| Time, result | 2.0 s |
| Time, total | 389.8 s (6.5 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 769488 blocks, 2165304 soil cells, 372148 deposits |
| GPU memory | scene 141.3 MB, peak of all buffers 165.2 MB |
| Process memory (RSS) | 0.87 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 18 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 18.41 g dry at the start, 0.21 g left (1 %) |
| Items clean | 41 of 62 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5310 | 0.0386 | 0.1346 | 0.1729 | 0.0011 | 99.88 % | 0.243 kg | 0.076 kg | yes |
| l@3000 | 2566 s | lower 42 rpm | 0.7173 | 0.5373 | 0.0428 | 0.1365 | 0.1789 | 0.0011 | 99.89 % | 0.250 kg | 0.076 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4674 | 0.0597 | 0.1352 | 0.4798 | 0.0012 | 99.79 % | 0.265 kg | 0.073 kg | yes |
| ur@3000 | 2580 s | upper 31 rpm | 0.8995 | 0.4420 | 0.0567 | 0.1278 | 0.4564 | 0.0011 | 99.80 % | 0.273 kg | 0.073 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cup_01 | tea_cup_porcelain_210 | upper | 186, 84, 560 | iec_tea 0.59 of 10.01 | 0.59 | 7170 of 7206 | 0 | 1.2, 4.00 | no |
| cup_02 | tea_cup_porcelain_210 | upper | -190, 170, 515 | iec_tea 1.16 of 10.37 | 1.16 | 7206 of 7206 | 0 | 1.2, 4.40 | no |
| cup_03 | tea_cup_porcelain_210 | upper | -196, -187, 515 | iec_tea 1.31 of 9.99 | 1.31 | 7206 of 7206 | 0 | 1.2, 4.48 | no |
| dessert_bowl_01 | dessert_bowl_vitrelle_130 | upper | -83, 149, 490 | iec_oat_flakes 0.00 of 149.00 | 0.00 | 0 of 10011 | 5 | 0.0, 0.97 | yes |
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -82, 113, 489 | iec_spinach 0.00 of 172.12 | 0.00 | 0 of 10010 | 5 | 0.0, 0.93 | yes |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 0.00 of 155.98 | 0.00 | 0 of 10010 | 5 | 0.0, 0.96 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 13.72 of 958.02 | 13.72 | 1024 of 9149 | 0 | 0.0, 1.06 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | upper | -81, 40, 510 | iec_spinach 0.00 of 157.16 | 0.00 | 0 of 9149 | 5 | 0.0, 0.92 | yes |
| dessert_plate_03 | dessert_plate_porcelain_190 | upper | -82, -140, 510 | iec_egg_yolk 7.61 of 966.29 | 7.61 | 575 of 9149 | 0 | 0.0, 1.35 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -4, -45, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -17, -115, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | 49, -42, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 55, -39, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 6, -171, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -20, -219, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 6.43 of 1499.51 | 6.43 | 566 of 15968 | 0 | 0.0, 1.79 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_minced_meat 0.00 of 573.17 | 0.00 | 0 of 15968 | 5 | 0.0, 1.84 | yes |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 22.03 of 1686.97 | 22.03 | 1653 of 15968 | 0 | 0.0, 1.72 | no |
| fork_01 | dinner_fork_185 | lower | -23, -219, 80 | iec_egg_yolk 22.59 of 152.97 | 22.59 | 771 of 1094 | 0 | 0.0, 0.28 | no |
| fork_02 | dinner_fork_185 | lower | 48, -53, 80 | iec_egg_yolk 25.43 of 157.55 | 25.43 | 790 of 1095 | 0 | 0.0, 0.21 | no |
| fork_03 | dinner_fork_185 | lower | 70, -218, 80 | iec_egg_yolk 23.53 of 151.80 | 23.53 | 790 of 1095 | 0 | 0.0, 0.30 | no |
| fork_04 | dinner_fork_185 | lower | -5, -115, 80 | iec_egg_yolk 10.68 of 142.30 | 10.68 | 532 of 1094 | 0 | 0.0, 0.40 | no |
| fork_05 | dinner_fork_185 | lower | -1, -118, 80 | iec_egg_yolk 33.41 of 155.90 | 33.41 | 826 of 1094 | 0 | 0.0, 0.71 | no |
| fork_06 | dinner_fork_185 | lower | 3, -118, 80 | iec_egg_yolk 28.74 of 154.08 | 28.74 | 748 of 1094 | 0 | 0.0, 0.41 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 76, 206, 545 | iec_milk 0.00 of 497.23 | 0.00 | 0 of 10611 | 5 | 0.0, 0.97 | yes |
| glass_02 | test_glass_borosilicate_250 | upper | 109, 131, 551 | iec_milk 0.00 of 474.34 | 0.00 | 0 of 10611 | 5 | 0.0, 1.45 | yes |
| glass_03 | test_glass_borosilicate_250 | upper | 99, 43, 549 | iec_milk 0.00 of 506.85 | 0.00 | 0 of 10611 | 5 | 0.0, 1.31 | yes |
| glass_04 | test_glass_borosilicate_250 | upper | 111, -45, 547 | iec_milk 0.00 of 492.24 | 0.00 | 0 of 10611 | 5 | 0.0, 1.11 | yes |
| glass_05 | test_glass_borosilicate_250 | upper | 112, -120, 546 | iec_milk 0.00 of 485.35 | 0.00 | 0 of 10611 | 5 | 0.0, 0.96 | yes |
| glass_06 | test_glass_borosilicate_250 | upper | 53, 131, 559 | iec_milk 0.40 of 500.22 | 0.40 | 35 of 10611 | 2 | 0.0, 1.33 | no |
| knife_01 | dinner_knife_210 | lower | -27, -160, 78 | iec_margarine 0.00 of 244.70 | 0.00 | 0 of 2335 | 5 | 0.0, 0.18 | yes |
| knife_02 | dinner_knife_210 | lower | -13, -220, 79 | iec_margarine 0.64 of 257.15 | 0.64 | 10 of 2334 | 3 | 0.0, 0.21 | no |
| knife_03 | dinner_knife_210 | lower | 58, -164, 79 | iec_margarine 0.00 of 247.03 | 0.00 | 0 of 2335 | 5 | 0.0, 0.17 | yes |
| knife_04 | dinner_knife_210 | lower | -27, -65, 78 | iec_margarine 0.00 of 227.14 | 0.00 | 0 of 2335 | 5 | 0.0, 0.20 | yes |
| knife_05 | dinner_knife_210 | lower | 8, -35, 81 | iec_margarine 0.00 of 261.13 | 0.00 | 0 of 2335 | 5 | 0.0, 0.38 | yes |
| knife_06 | dinner_knife_210 | lower | 41, -69, 78 | iec_margarine 0.00 of 229.08 | 0.00 | 0 of 2334 | 5 | 0.0, 0.13 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -28, 512 | iec_spinach 0.00 of 154.29 | 0.00 | 0 of 10935 | 5 | 0.0, 1.31 | yes |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_minced_meat 0.00 of 415.77 | 0.00 | 0 of 10935 | 5 | 0.0, 1.30 | yes |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -82, -101, 512 | iec_spinach 0.00 of 162.26 | 0.00 | 0 of 10935 | 5 | 0.0, 1.27 | yes |
| mug_01 | mug_ceramic_300 | upper | 181, -72, 595 | iec_tea 0.62 of 11.07 | 0.62 | 9777 of 12105 | 0 | 5.0, 3.58 | no |
| mug_02 | mug_ceramic_300 | upper | 181, -168, 595 | iec_tea 0.77 of 9.91 | 0.77 | 10492 of 12105 | 0 | 5.0, 3.62 | no |
| mug_03 | mug_ceramic_300 | upper | 181, 182, 595 | iec_tea 0.60 of 9.20 | 0.60 | 8326 of 12104 | 0 | 5.0, 3.57 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 0.00 of 4060.46 | 0.00 | 0 of 20245 | 5 | 0.0, 2.49 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 0.70 of 9.96 | 0.70 | 3002 of 3002 | 0 | 0.0, 0.70 | no |
| serving_fork_01 | serving_fork_210 | lower | 47, -116, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 53, -143, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| small_pot_01 | saucepan_steel_170 | lower | 10, 156, 234 | iec_minced_meat 12.30 of 1049.68 | 12.30 | 617 of 14474 | 0 | 0.0, 13.43 | no |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -171, -140, 188 | iec_oat_flakes 0.00 of 222.96 | 0.00 | 0 of 14750 | 5 | 0.0, 1.89 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 0.00 of 242.16 | 0.00 | 0 of 14750 | 5 | 0.0, 2.02 | yes |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 0.00 of 230.77 | 0.00 | 0 of 14751 | 5 | 0.0, 2.05 | yes |
| soup_spoon_01 | soup_spoon_190 | lower | -22, -116, 80 | iec_oat_flakes 0.00 of 23.76 | 0.00 | 0 of 1450 | 5 | 0.0, 0.24 | yes |
| soup_spoon_02 | soup_spoon_190 | lower | -35, -162, 80 | iec_oat_flakes 0.00 of 24.10 | 0.00 | 0 of 1450 | 5 | 0.0, 0.29 | yes |
| soup_spoon_03 | soup_spoon_190 | lower | 57, -115, 80 | iec_oat_flakes 0.00 of 24.70 | 0.00 | 0 of 1450 | 5 | 0.0, 0.41 | yes |
| soup_spoon_04 | soup_spoon_190 | lower | 64, -115, 80 | iec_oat_flakes 1.15 of 21.58 | 1.15 | 124 of 1450 | 1 | 0.0, 0.40 | no |
| soup_spoon_05 | soup_spoon_190 | lower | 64, -43, 80 | iec_oat_flakes 0.00 of 23.52 | 0.00 | 0 of 1450 | 5 | 0.0, 0.36 | yes |
| soup_spoon_06 | soup_spoon_190 | lower | 64, -28, 80 | iec_oat_flakes 0.00 of 24.37 | 0.00 | 0 of 1450 | 5 | 0.0, 0.40 | yes |
| teaspoon_01 | teaspoon_130 | lower | 48, -219, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.12 | yes |
| teaspoon_02 | teaspoon_130 | lower | -2, -35, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| teaspoon_03 | teaspoon_130 | lower | -3, -178, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.35 | yes |
| teaspoon_04 | teaspoon_130 | lower | 1, -178, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.39 | yes |
| teaspoon_05 | teaspoon_130 | lower | 68, -103, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.10 | yes |
| teaspoon_06 | teaspoon_130 | lower | 7, -115, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
