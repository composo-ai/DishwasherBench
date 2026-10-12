# Demonstration wash: half-careful

Half of the IEC load (six place settings), loaded carefully and well spaced.

Machine bosch_smv4hax40g, programme auto_145 (145 min, 3971 ticks), tier official, 62 items (3 of the offer left on the counter by the loading physics), simulator spotless-sim 0.4.1 water-5, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 9.2 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 389.7 s |
| Time, soil | 1.2 s |
| Time, replay | 7.3 s |
| Time, result | 3.9 s |
| Time, total | 411.5 s (6.9 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 769488 blocks, 2165304 soil cells, 372148 deposits |
| GPU memory | scene 141.3 MB, peak of all buffers 165.2 MB |
| Process memory (RSS) | 1.64 GB |
| Mains water, energy | 11.5 L, 1.04 kWh |
| Water held in vessels | 18 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 18.41 g dry at the start, 2.83 g left (15 %) |
| Items clean | 33 of 62 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 990 s | lower 40 rpm | 0.7050 | 0.5310 | 0.0386 | 0.1346 | 0.1727 | 0.0013 | 99.88 % | 0.243 kg | 0.076 kg | yes |
| l@3000 | 1921 s | lower 42 rpm | 0.7173 | 0.5373 | 0.0428 | 0.1365 | 0.1787 | 0.0013 | 99.88 % | 0.250 kg | 0.077 kg | yes |
| ur@2800 | 924 s | upper 27 rpm | 0.9484 | 0.4674 | 0.0597 | 0.1352 | 0.4795 | 0.0015 | 99.79 % | 0.264 kg | 0.071 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4420 | 0.0567 | 0.1278 | 0.4561 | 0.0014 | 99.80 % | 0.271 kg | 0.071 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cup_01 | tea_cup_porcelain_210 | upper | 186, 84, 560 | iec_tea 0.77 of 10.01 | 0.77 | 7206 of 7206 | 0 | 1.2, 4.00 | no |
| cup_02 | tea_cup_porcelain_210 | upper | -190, 170, 515 | iec_tea 1.66 of 10.37 | 1.66 | 7206 of 7206 | 0 | 1.2, 4.40 | no |
| cup_03 | tea_cup_porcelain_210 | upper | -196, -187, 515 | iec_tea 1.72 of 9.99 | 1.72 | 7206 of 7206 | 0 | 1.2, 4.48 | no |
| dessert_bowl_01 | dessert_bowl_vitrelle_130 | upper | -83, 149, 490 | iec_oat_flakes 0.00 of 149.00 | 0.00 | 0 of 10011 | 5 | 0.0, 0.97 | yes |
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -82, 113, 489 | iec_spinach 0.04 of 172.12 | 0.04 | 11 of 10010 | 3 | 0.0, 0.93 | no |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 0.00 of 155.98 | 0.00 | 1 of 10010 | 4 | 0.0, 0.96 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 376.80 of 958.02 | 376.80 | 9107 of 9149 | 0 | 0.0, 1.06 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | upper | -81, 40, 510 | iec_spinach 0.00 of 157.16 | 0.00 | 0 of 9149 | 5 | 0.0, 0.92 | yes |
| dessert_plate_03 | dessert_plate_porcelain_190 | upper | -82, -140, 510 | iec_egg_yolk 348.44 of 966.29 | 348.44 | 9058 of 9149 | 0 | 0.0, 1.35 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -4, -45, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -17, -115, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | 49, -42, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 55, -39, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 6, -171, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -20, -219, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 485.73 of 1499.51 | 485.73 | 15600 of 15968 | 0 | 0.0, 1.79 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_minced_meat 2.74 of 573.17 | 2.74 | 294 of 15968 | 0 | 0.0, 1.84 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 653.19 of 1686.97 | 653.19 | 15897 of 15968 | 0 | 0.0, 1.72 | no |
| fork_01 | dinner_fork_185 | lower | -23, -219, 80 | iec_egg_yolk 85.19 of 152.97 | 85.19 | 1093 of 1094 | 0 | 0.0, 0.28 | no |
| fork_02 | dinner_fork_185 | lower | 48, -53, 80 | iec_egg_yolk 91.68 of 157.55 | 91.68 | 1095 of 1095 | 0 | 0.0, 0.21 | no |
| fork_03 | dinner_fork_185 | lower | 70, -218, 80 | iec_egg_yolk 84.59 of 151.80 | 84.59 | 1095 of 1095 | 0 | 0.0, 0.30 | no |
| fork_04 | dinner_fork_185 | lower | -5, -115, 80 | iec_egg_yolk 73.80 of 142.30 | 73.80 | 1094 of 1094 | 0 | 0.0, 0.40 | no |
| fork_05 | dinner_fork_185 | lower | -1, -118, 80 | iec_egg_yolk 98.63 of 155.90 | 98.63 | 1094 of 1094 | 0 | 0.0, 0.71 | no |
| fork_06 | dinner_fork_185 | lower | 3, -118, 80 | iec_egg_yolk 91.72 of 154.08 | 91.72 | 1094 of 1094 | 0 | 0.0, 0.41 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 76, 206, 545 | iec_milk 20.03 of 497.23 | 20.03 | 1975 of 10611 | 0 | 0.0, 0.97 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 109, 131, 551 | iec_milk 14.81 of 474.34 | 14.81 | 1489 of 10611 | 0 | 0.0, 1.45 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 99, 43, 549 | iec_milk 6.41 of 506.85 | 6.41 | 697 of 10611 | 0 | 0.0, 1.31 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 111, -45, 547 | iec_milk 4.81 of 492.24 | 4.81 | 516 of 10611 | 0 | 0.0, 1.11 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 112, -120, 546 | iec_milk 4.54 of 485.35 | 4.54 | 495 of 10611 | 0 | 0.0, 0.96 | no |
| glass_06 | test_glass_borosilicate_250 | upper | 53, 131, 559 | iec_milk 33.96 of 500.22 | 33.96 | 3004 of 10611 | 0 | 0.0, 1.33 | no |
| knife_01 | dinner_knife_210 | lower | -27, -160, 78 | iec_margarine 0.00 of 244.70 | 0.00 | 0 of 2335 | 5 | 0.0, 0.18 | yes |
| knife_02 | dinner_knife_210 | lower | -13, -220, 79 | iec_margarine 0.64 of 257.15 | 0.64 | 10 of 2334 | 3 | 0.0, 0.21 | no |
| knife_03 | dinner_knife_210 | lower | 58, -164, 79 | iec_margarine 0.00 of 247.03 | 0.00 | 0 of 2335 | 5 | 0.0, 0.17 | yes |
| knife_04 | dinner_knife_210 | lower | -27, -65, 78 | iec_margarine 0.00 of 227.14 | 0.00 | 0 of 2335 | 5 | 0.0, 0.20 | yes |
| knife_05 | dinner_knife_210 | lower | 8, -35, 81 | iec_margarine 0.00 of 261.13 | 0.00 | 0 of 2335 | 5 | 0.0, 0.38 | yes |
| knife_06 | dinner_knife_210 | lower | 41, -69, 78 | iec_margarine 0.00 of 229.08 | 0.00 | 0 of 2334 | 5 | 0.0, 0.13 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -28, 512 | iec_spinach 0.00 of 154.29 | 0.00 | 0 of 10935 | 5 | 0.0, 1.31 | yes |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_minced_meat 1.92 of 415.77 | 1.92 | 206 of 10935 | 0 | 0.0, 1.30 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -82, -101, 512 | iec_spinach 0.00 of 162.26 | 0.00 | 0 of 10935 | 5 | 0.0, 1.27 | yes |
| mug_01 | mug_ceramic_300 | upper | 181, -72, 595 | iec_tea 0.85 of 11.07 | 0.85 | 11994 of 12105 | 0 | 5.0, 3.58 | no |
| mug_02 | mug_ceramic_300 | upper | 181, -168, 595 | iec_tea 1.14 of 9.91 | 1.14 | 12057 of 12105 | 0 | 5.0, 3.62 | no |
| mug_03 | mug_ceramic_300 | upper | 181, 182, 595 | iec_tea 0.96 of 9.20 | 0.96 | 11870 of 12104 | 0 | 5.0, 3.57 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 0.00 of 4060.46 | 0.00 | 0 of 20245 | 5 | 0.0, 2.49 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 0.73 of 9.96 | 0.73 | 3002 of 3002 | 0 | 0.0, 0.70 | no |
| serving_fork_01 | serving_fork_210 | lower | 47, -116, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 53, -143, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| small_pot_01 | saucepan_steel_170 | lower | 10, 156, 234 | iec_minced_meat 345.02 of 1049.68 | 345.02 | 11002 of 14474 | 0 | 0.0, 13.43 | no |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -171, -140, 188 | iec_oat_flakes 0.00 of 222.96 | 0.00 | 0 of 14750 | 5 | 0.0, 1.89 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 0.00 of 242.16 | 0.00 | 0 of 14750 | 5 | 0.0, 2.02 | yes |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 0.00 of 230.77 | 0.00 | 0 of 14751 | 5 | 0.0, 2.05 | yes |
| soup_spoon_01 | soup_spoon_190 | lower | -22, -116, 80 | iec_oat_flakes 0.00 of 23.76 | 0.00 | 0 of 1450 | 5 | 0.0, 0.24 | yes |
| soup_spoon_02 | soup_spoon_190 | lower | -35, -162, 80 | iec_oat_flakes 0.00 of 24.10 | 0.00 | 0 of 1450 | 5 | 0.0, 0.29 | yes |
| soup_spoon_03 | soup_spoon_190 | lower | 57, -115, 80 | iec_oat_flakes 0.00 of 24.70 | 0.00 | 0 of 1450 | 5 | 0.0, 0.41 | yes |
| soup_spoon_04 | soup_spoon_190 | lower | 64, -115, 80 | iec_oat_flakes 1.61 of 21.58 | 1.61 | 168 of 1450 | 1 | 0.0, 0.40 | no |
| soup_spoon_05 | soup_spoon_190 | lower | 64, -43, 80 | iec_oat_flakes 0.00 of 23.52 | 0.00 | 0 of 1450 | 5 | 0.0, 0.36 | yes |
| soup_spoon_06 | soup_spoon_190 | lower | 64, -28, 80 | iec_oat_flakes 0.00 of 24.37 | 0.00 | 0 of 1450 | 5 | 0.0, 0.40 | yes |
| teaspoon_01 | teaspoon_130 | lower | 48, -219, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.12 | yes |
| teaspoon_02 | teaspoon_130 | lower | -2, -35, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| teaspoon_03 | teaspoon_130 | lower | -3, -178, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.35 | yes |
| teaspoon_04 | teaspoon_130 | lower | 1, -178, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.39 | yes |
| teaspoon_05 | teaspoon_130 | lower | 68, -103, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.10 | yes |
| teaspoon_06 | teaspoon_130 | lower | 7, -115, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
