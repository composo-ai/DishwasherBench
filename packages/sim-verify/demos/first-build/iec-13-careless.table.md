# Demonstration wash: iec-13-careless

The same IEC load, loaded with the common mistakes.

Machine bosch_smv4hax40g, programme auto_145 (145 min, 3971 ticks), tier official, 115 items (25 of the offer left on the counter by the loading physics), simulator spotless-sim 0.3.2 water-3, exposure on the gpu.

Mistakes in this load: plate_facing_away x 4, packed_tight x 10, cup_upright x 4, cup_on_side x 4, item_over_others x 1, tablet_tray_blocked x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 8.0 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 221.1 s |
| Time, soil | 1.5 s |
| Time, replay | 38.9 s |
| Time, result | 1.4 s |
| Time, total | 270.9 s (4.5 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 1146097 blocks, 3673500 soil cells, 636521 deposits |
| GPU memory | scene 158.1 MB, peak of all buffers 158.1 MB |
| Process memory (RSS) | 0.60 GB |
| Mains water, energy | 11.5 L, 1.04 kWh |
| Water held in vessels | 1905 mL |
| Detergent | 5.6 of 20.0 g dissolved (dispenser blocked) |
| Soil | 79.73 g dry at the start, 69.12 g left (87 %) |
| Items clean | 31 of 115 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 990 s | lower 40 rpm | 0.7050 | 0.5444 | 0.0324 | 0.1274 | 0.1594 | 0.0011 | 99.40 % | 0.290 kg | 0.070 kg | yes |
| l@3000 | 1921 s | lower 42 rpm | 0.7173 | 0.5496 | 0.0374 | 0.1296 | 0.1665 | 0.0012 | 99.40 % | 0.300 kg | 0.070 kg | yes |
| ur@2800 | 924 s | upper 27 rpm | 0.9484 | 0.4811 | 0.0460 | 0.1351 | 0.4668 | 0.0005 | 99.48 % | 0.334 kg | 0.075 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4551 | 0.0438 | 0.1276 | 0.4440 | 0.0004 | 99.45 % | 0.344 kg | 0.075 kg | yes |

## What the wash reports

- placement: glass_10 cuts 0.8 mm into glass_01; both are simulated where they were placed

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cup_01 | tea_cup_porcelain_210 | upper | -2, 94, 477 | iec_tea 0.09 of 0.10 | 0.09 | 7206 of 7206 | 0 | 0.0, 1.29 | no |
| cup_02 | tea_cup_porcelain_210 | upper | -15, -2, 470 | iec_tea 0.09 of 0.10 | 0.09 | 7206 of 7206 | 0 | 142.3, 0.83 | no |
| cup_06 | tea_cup_porcelain_210 | upper | -177, 159, 486 | iec_tea 0.09 of 0.10 | 0.09 | 7206 of 7206 | 0 | 0.0, 0.98 | no |
| dessert_bowl_01 | dessert_bowl_vitrelle_130 | upper | 25, -53, 506 | iec_oat_flakes 65.90 of 160.00 | 65.90 | 9451 of 10010 | 0 | 0.0, 1.21 | no |
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -77, -183, 545 | iec_spinach 432.16 of 500.00 | 432.16 | 10011 of 10011 | 0 | 0.0, 0.87 | no |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -226, -123, 491 | iec_oat_flakes 79.22 of 160.00 | 79.22 | 9694 of 10011 | 0 | 0.3, 1.02 | no |
| dessert_bowl_04 | dessert_bowl_vitrelle_130 | upper | -7, 160, 490 | iec_spinach 417.80 of 500.00 | 417.80 | 10011 of 10011 | 0 | 0.0, 0.97 | no |
| dessert_bowl_05 | dessert_bowl_vitrelle_130 | upper | -204, 98, 487 | iec_oat_flakes 64.18 of 160.00 | 64.18 | 9336 of 10010 | 0 | 3.8, 1.12 | no |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -223, -141, 157 | iec_egg_yolk 999.68 of 1000.00 | 999.68 | 9149 of 9149 | 0 | 0.0, 1.05 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | -201, -137, 227 | iec_spinach 440.31 of 500.00 | 440.31 | 9148 of 9148 | 0 | 0.0, 0.88 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | -170, -140, 157 | iec_egg_yolk 999.67 of 1000.00 | 999.67 | 9149 of 9149 | 0 | 0.0, 0.82 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | -145, -139, 157 | iec_spinach 413.96 of 500.00 | 413.96 | 9149 of 9149 | 0 | 0.0, 1.02 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | -123, -140, 226 | iec_egg_yolk 999.78 of 1000.00 | 999.78 | 9149 of 9149 | 0 | 0.0, 1.20 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 223, -141, 157 | iec_spinach 413.76 of 500.00 | 413.76 | 9149 of 9149 | 0 | 0.0, 1.23 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 200, -137, 227 | iec_egg_yolk 999.71 of 1000.00 | 999.71 | 9148 of 9148 | 0 | 0.0, 0.95 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | 15, -244, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | 51, -104, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | 68, -165, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 37, -217, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.31 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | -50, -32, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -13, -142, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.31 | yes |
| dessert_spoon_07 | dessert_spoon_160 | lower | 1, -244, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| dessert_spoon_08 | dessert_spoon_160 | lower | 59, -26, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| dessert_spoon_09 | dessert_spoon_160 | lower | 70, -101, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| dessert_spoon_10 | dessert_spoon_160 | lower | 23, -213, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_11 | dessert_spoon_160 | lower | 1, -26, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_13 | dessert_spoon_160 | lower | 15, -47, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.30 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -226, 111, 199 | iec_egg_yolk 1499.45 of 1500.00 | 1499.45 | 15968 of 15968 | 0 | 0.0, 1.30 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -189, 111, 199 | iec_minced_meat 629.42 of 630.00 | 629.42 | 15968 of 15968 | 0 | 0.0, 1.32 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_egg_yolk 1499.43 of 1500.00 | 1499.43 | 15968 of 15968 | 0 | 0.0, 1.33 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | 211, 111, 194 | iec_minced_meat 629.43 of 630.00 | 629.43 | 15968 of 15968 | 0 | 0.0, 1.64 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | 192, 111, 200 | iec_egg_yolk 1499.47 of 1500.00 | 1499.47 | 15968 of 15968 | 0 | 0.0, 1.45 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | 156, 111, 199 | iec_minced_meat 629.43 of 630.00 | 629.43 | 15968 of 15968 | 0 | 0.0, 1.28 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | 120, 112, 199 | iec_egg_yolk 1499.50 of 1500.00 | 1499.50 | 15968 of 15968 | 0 | 0.0, 1.30 | no |
| fork_01 | dinner_fork_185 | lower | -14, -245, 76 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1095 of 1095 | 0 | 0.0, 0.22 | no |
| fork_02 | dinner_fork_185 | lower | -17, -145, 76 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1093 of 1093 | 0 | 0.0, 0.30 | no |
| fork_03 | dinner_fork_185 | lower | -3, -146, 76 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1095 of 1095 | 0 | 0.0, 0.20 | no |
| fork_04 | dinner_fork_185 | lower | -7, -233, 76 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1093 of 1093 | 0 | 0.0, 0.36 | no |
| fork_05 | dinner_fork_185 | lower | 49, -32, 76 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1094 of 1094 | 0 | 0.0, 0.33 | no |
| fork_06 | dinner_fork_185 | lower | 64, -102, 76 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1093 of 1093 | 0 | 0.0, 0.26 | no |
| fork_07 | dinner_fork_185 | lower | 60, -213, 75 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1094 of 1094 | 0 | 0.0, 0.25 | no |
| fork_08 | dinner_fork_185 | lower | -48, -43, 75 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1094 of 1094 | 0 | 0.0, 0.24 | no |
| fork_09 | dinner_fork_185 | lower | -26, -144, 75 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1095 of 1095 | 0 | 0.0, 0.20 | no |
| fork_10 | dinner_fork_185 | lower | -9, -245, 76 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1096 of 1096 | 0 | 0.0, 0.31 | no |
| fork_11 | dinner_fork_185 | lower | 20, -32, 76 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1095 of 1095 | 0 | 0.0, 0.37 | no |
| fork_12 | dinner_fork_185 | lower | 18, -45, 75 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1095 of 1095 | 0 | 0.0, 0.39 | no |
| fork_13 | dinner_fork_185 | lower | 14, -34, 75 | iec_egg_yolk 149.96 of 150.00 | 149.96 | 1094 of 1094 | 0 | 0.0, 0.34 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 45, -224, 530 | iec_milk 4999.82 of 5000.00 | 4999.82 | 10611 of 10611 | 0 | 0.0, 0.81 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 35, 194, 441 | iec_milk 4999.98 of 5000.00 | 4999.98 | 10611 of 10611 | 0 | 281.0, 1.06 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 103, 17, 553 | iec_milk 4999.82 of 5000.00 | 4999.82 | 10611 of 10611 | 0 | 0.0, 0.65 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 128, -65, 447 | iec_milk 4999.97 of 5000.00 | 4999.97 | 10611 of 10611 | 0 | 270.7, 0.97 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 116, -137, 553 | iec_milk 4999.83 of 5000.00 | 4999.83 | 10611 of 10611 | 0 | 0.0, 0.94 | no |
| glass_07 | test_glass_borosilicate_250 | upper | -78, 147, 542 | iec_milk 4999.84 of 5000.00 | 4999.84 | 10611 of 10611 | 0 | 0.0, 1.89 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -109, 13, 566 | iec_milk 4999.82 of 5000.00 | 4999.82 | 10611 of 10611 | 0 | 0.0, 0.79 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -76, 207, 418 | iec_milk 4999.99 of 5000.00 | 4999.99 | 10611 of 10611 | 0 | 287.7, 1.80 | no |
| glass_10 | test_glass_borosilicate_250 | upper | 81, -183, 563 | iec_milk 4999.88 of 5000.00 | 4999.88 | 10611 of 10611 | 0 | 0.0, 0.97 | no |
| glass_13 | test_glass_borosilicate_250 | upper | 101, 114, 456 | iec_milk 4999.97 of 5000.00 | 4999.97 | 10611 of 10611 | 0 | 0.0, 1.64 | no |
| knife_01 | dinner_knife_210 | lower | 29, -204, 263 | iec_margarine 0.12 of 300.00 | 0.12 | 1 of 2335 | 4 | 0.0, 0.28 | yes |
| knife_02 | dinner_knife_210 | lower | -67, -90, 267 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.14 | yes |
| knife_03 | dinner_knife_210 | lower | -77, -92, 264 | iec_margarine 0.12 of 300.00 | 0.12 | 1 of 2335 | 4 | 0.0, 0.17 | yes |
| knife_04 | dinner_knife_210 | lower | -47, -126, 278 | iec_margarine 0.03 of 300.00 | 0.03 | 8 of 2334 | 3 | 0.0, 0.11 | no |
| knife_05 | dinner_knife_210 | lower | -69, -229, 271 | iec_margarine 0.23 of 300.00 | 0.23 | 12 of 2335 | 3 | 0.0, 0.25 | no |
| knife_06 | dinner_knife_210 | lower | -3, -101, 258 | iec_margarine 2.01 of 300.00 | 2.01 | 45 of 2335 | 2 | 0.0, 0.29 | no |
| knife_07 | dinner_knife_210 | lower | 87, -130, 264 | iec_margarine 0.02 of 300.00 | 0.02 | 2 of 2335 | 4 | 0.0, 0.10 | yes |
| knife_08 | dinner_knife_210 | lower | 21, -170, 269 | iec_margarine 0.79 of 300.00 | 0.79 | 12 of 2335 | 3 | 0.0, 0.19 | no |
| knife_09 | dinner_knife_210 | lower | -48, -28, 278 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.35 | yes |
| knife_10 | dinner_knife_210 | lower | -49, -179, 278 | iec_margarine 0.01 of 300.00 | 0.01 | 0 of 2335 | 5 | 0.0, 0.14 | yes |
| knife_11 | dinner_knife_210 | lower | -74, -219, 270 | iec_margarine 0.73 of 300.00 | 0.73 | 6 of 2335 | 3 | 0.0, 0.26 | no |
| knife_12 | dinner_knife_210 | lower | 25, -150, 270 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2334 | 5 | 0.0, 0.09 | yes |
| knife_13 | dinner_knife_210 | lower | -66, -211, 273 | iec_margarine 5.63 of 300.00 | 5.63 | 104 of 2335 | 1 | 0.0, 0.29 | no |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -38, 515 | iec_spinach 386.47 of 500.00 | 386.47 | 10935 of 10935 | 0 | 0.0, 0.72 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -52, 514 | iec_minced_meat 419.68 of 420.00 | 419.68 | 10935 of 10935 | 0 | 0.0, 0.98 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_spinach 400.35 of 500.00 | 400.35 | 10935 of 10935 | 0 | 0.0, 0.52 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -82, -83, 512 | iec_minced_meat 419.61 of 420.00 | 419.61 | 10935 of 10935 | 0 | 0.0, 0.51 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -101, 512 | iec_spinach 389.71 of 500.00 | 389.71 | 10935 of 10935 | 0 | 0.0, 0.36 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -85, -117, 514 | iec_minced_meat 419.60 of 420.00 | 419.60 | 10935 of 10935 | 0 | 0.0, 0.55 | no |
| mug_01 | mug_ceramic_300 | upper | 169, -13, 533 | iec_tea 0.09 of 0.10 | 0.09 | 12104 of 12104 | 0 | 0.0, 1.04 | no |
| mug_02 | mug_ceramic_300 | upper | 183, -164, 495 | iec_tea 0.10 of 0.10 | 0.10 | 12104 of 12104 | 0 | 330.8, 2.98 | no |
| mug_03 | mug_ceramic_300 | upper | 186, 236, 533 | iec_tea 0.09 of 0.10 | 0.09 | 12105 of 12105 | 0 | 0.0, 0.93 | no |
| mug_04 | mug_ceramic_300 | upper | 216, 98, 533 | iec_tea 0.09 of 0.10 | 0.09 | 12104 of 12104 | 0 | 0.0, 1.29 | no |
| mug_05 | mug_ceramic_300 | upper | 150, 98, 534 | iec_tea 0.09 of 0.10 | 0.09 | 12104 of 12104 | 0 | 0.0, 1.29 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -98, 86, 202 | iec_margarine 0.00 of 5000.00 | 0.00 | 0 of 20245 | 5 | 0.0, 2.16 | yes |
| saucer_01 | saucer_porcelain_140 | lower | 165, -140, 121 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.47 | no |
| saucer_02 | saucer_porcelain_140 | lower | 143, -140, 123 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.59 | no |
| saucer_03 | saucer_porcelain_140 | lower | -42, 111, 129 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.64 | no |
| saucer_04 | saucer_porcelain_140 | upper | -81, -159, 487 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.51 | no |
| saucer_05 | saucer_porcelain_140 | upper | -81, -177, 486 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.50 | no |
| saucer_06 | saucer_porcelain_140 | lower | -133, 112, 129 | iec_tea 0.09 of 0.10 | 0.09 | 3001 of 3001 | 0 | 0.0, 0.52 | no |
| serving_spoon_01 | serving_spoon_216 | lower | 11, -34, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | -8, -246, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.30 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | upper | 78, 37, 558 | iec_oat_flakes 75.82 of 240.00 | 75.82 | 12979 of 14751 | 0 | 585.7, 3.94 | no |
| soup_plate_02 | soup_plate_porcelain_230 | lower | 7, 112, 197 | iec_oat_flakes 92.47 of 240.00 | 92.47 | 13686 of 14750 | 0 | 0.0, 1.31 | no |
| soup_plate_03 | soup_plate_porcelain_230 | lower | -11, 111, 197 | iec_oat_flakes 112.55 of 240.00 | 112.55 | 14180 of 14751 | 0 | 0.0, 1.56 | no |
| soup_plate_05 | soup_plate_porcelain_230 | lower | -117, -142, 243 | iec_oat_flakes 91.72 of 240.00 | 91.72 | 13638 of 14751 | 0 | 0.0, 1.74 | no |
| soup_spoon_02 | soup_spoon_190 | lower | 26, -207, 76 | iec_oat_flakes 12.18 of 24.00 | 12.18 | 1425 of 1450 | 0 | 0.0, 0.24 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 70, -245, 76 | iec_oat_flakes 11.17 of 24.00 | 11.17 | 1402 of 1450 | 0 | 0.0, 0.26 | no |
| soup_spoon_04 | soup_spoon_190 | lower | -47, -33, 75 | iec_oat_flakes 10.74 of 24.00 | 10.74 | 1383 of 1450 | 0 | 0.0, 0.37 | no |
| soup_spoon_05 | soup_spoon_190 | lower | 4, -102, 75 | iec_oat_flakes 12.47 of 24.00 | 12.47 | 1417 of 1450 | 0 | 0.0, 0.13 | no |
| soup_spoon_06 | soup_spoon_190 | lower | 0, -235, 75 | iec_oat_flakes 11.41 of 24.00 | 11.41 | 1409 of 1450 | 0 | 0.0, 0.26 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 25, -36, 75 | iec_oat_flakes 13.03 of 24.00 | 13.03 | 1433 of 1451 | 0 | 0.0, 0.24 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 67, -104, 76 | iec_oat_flakes 12.96 of 24.00 | 12.96 | 1427 of 1450 | 0 | 0.0, 0.27 | no |
| soup_spoon_09 | soup_spoon_190 | lower | 36, -208, 75 | iec_oat_flakes 11.37 of 24.00 | 11.37 | 1402 of 1450 | 0 | 0.0, 0.35 | no |
| soup_spoon_10 | soup_spoon_190 | lower | -5, -32, 75 | iec_oat_flakes 12.25 of 24.00 | 12.25 | 1426 of 1450 | 0 | 0.0, 0.25 | no |
| soup_spoon_11 | soup_spoon_190 | lower | 1, -139, 77 | iec_oat_flakes 12.67 of 24.00 | 12.67 | 1425 of 1451 | 0 | 0.0, 0.28 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 29, -231, 75 | iec_oat_flakes 11.86 of 24.00 | 11.86 | 1415 of 1450 | 0 | 0.0, 0.17 | no |
| soup_spoon_13 | soup_spoon_190 | lower | 1, -249, 76 | iec_oat_flakes 11.68 of 24.00 | 11.68 | 1412 of 1450 | 0 | 0.0, 0.43 | no |
| teaspoon_01 | teaspoon_130 | lower | 14, -177, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_02 | teaspoon_130 | lower | 54, -35, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| teaspoon_03 | teaspoon_130 | lower | 35, -29, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| teaspoon_04 | teaspoon_130 | lower | 56, -171, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| teaspoon_05 | teaspoon_130 | lower | 44, -207, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| teaspoon_06 | teaspoon_130 | lower | -49, -70, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_07 | teaspoon_130 | lower | 2, -146, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_08 | teaspoon_130 | lower | 2, -252, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| teaspoon_11 | teaspoon_130 | lower | 21, -252, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.12 | yes |
