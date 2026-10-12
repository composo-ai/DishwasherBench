# Demonstration wash: iec-13-careful-badly

The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully. The same items loaded badly by rule, without settling them again: plates turned round, soup plates nested, mugs, cups and glasses mouth up, the dispenser kept shut.

Machine bosch_smv4hax40g, programme auto_145 (146 min, 3961 ticks), tier official, 104 items (36 of the offer left on the counter by the loading physics), simulator spotless-sim 0.3.2 water-3, exposure on the gpu.

Mistakes in this load: plate_facing_away x 12, cup_upright x 13, tablet_tray_blocked x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 7.7 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 206.3 s |
| Time, soil | 1.1 s |
| Time, replay | 16.4 s |
| Time, result | 1.0 s |
| Time, total | 232.5 s (3.9 min) |
| Exposure sets | 6 computed, 0 from the cache |
| Scene | 963281 blocks, 2942236 soil cells, 496969 deposits |
| GPU memory | scene 144.8 MB, peak of all buffers 144.8 MB |
| Process memory (RSS) | 0.87 GB |
| Mains water, energy | 12.0 L, 1.06 kWh |
| Water held in vessels | 3965 mL |
| Detergent | 5.6 of 20.0 g dissolved (dispenser blocked) |
| Soil | 72.55 g dry at the start, 62.84 g left (87 %) |
| Items clean | 33 of 104 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 630 s | lower 40 rpm | 0.7050 | 0.5357 | 0.0362 | 0.1324 | 0.1680 | 0.0012 | 99.49 % | 0.271 kg | 0.081 kg | yes |
| l@2800~0 | 360 s | lower stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| l@3000 | 1980 s | lower 42 rpm | 0.7173 | 0.5416 | 0.0407 | 0.1342 | 0.1744 | 0.0012 | 99.48 % | 0.279 kg | 0.081 kg | yes |
| ur@2800 | 588 s | upper 27 rpm | 0.9484 | 0.4752 | 0.0602 | 0.1269 | 0.4719 | 0.0013 | 99.77 % | 0.325 kg | 0.083 kg | yes |
| ur@2800~0 | 330 s | upper stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4495 | 0.0573 | 0.1197 | 0.4488 | 0.0012 | 99.74 % | 0.334 kg | 0.083 kg | yes |

## What the wash reports

- placement: dinner_plate_04 cuts 2.0 mm into dinner_plate_05; both are simulated where they were placed
- placement: saucer_04 cuts 0.8 mm into saucer_05; both are simulated where they were placed
- machine: pump_starved: a2_pre_rinse: with 4.50 L in the machine, 3.96 L of it held by the load, the sump holds 0.29 L in diverter state "l", less than the 0.50 L the pump needs: it draws 43 % air and delivers 0.0 L/min instead of 28.4

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -223, -141, 157 | iec_egg_yolk 999.78 of 1000.00 | 999.78 | 9149 of 9149 | 0 | 0.0, 0.77 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | -180, -139, 162 | iec_spinach 412.74 of 500.00 | 412.74 | 9148 of 9148 | 0 | 0.0, 0.74 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | -170, -140, 157 | iec_egg_yolk 999.78 of 1000.00 | 999.78 | 9149 of 9149 | 0 | 0.0, 0.75 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | -128, -139, 162 | iec_spinach 424.58 of 500.00 | 424.58 | 9149 of 9149 | 0 | 0.0, 0.69 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 999.78 of 1000.00 | 999.78 | 9149 of 9149 | 0 | 0.0, 0.77 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 206, -140, 162 | iec_spinach 409.41 of 500.00 | 409.41 | 9149 of 9149 | 0 | 0.0, 0.81 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 197, -140, 156 | iec_egg_yolk 999.77 of 1000.00 | 999.77 | 9148 of 9148 | 0 | 0.0, 0.82 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | 15, -248, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | 51, -104, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | 45, -145, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 39, -217, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | -49, -32, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -13, -142, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_07 | dessert_spoon_160 | lower | 0, -243, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| dessert_spoon_08 | dessert_spoon_160 | lower | 59, -26, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| dessert_spoon_09 | dessert_spoon_160 | lower | 70, -101, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.12 | yes |
| dessert_spoon_10 | dessert_spoon_160 | lower | 33, -211, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| dessert_spoon_11 | dessert_spoon_160 | lower | 1, -26, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_13 | dessert_spoon_160 | lower | 11, -48, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -202, 111, 201 | iec_egg_yolk 1499.64 of 1500.00 | 1499.64 | 15968 of 15968 | 0 | 0.0, 1.49 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -189, 111, 199 | iec_minced_meat 629.59 of 630.00 | 629.59 | 15968 of 15968 | 0 | 0.0, 1.36 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -129, 111, 201 | iec_egg_yolk 1499.62 of 1500.00 | 1499.62 | 15968 of 15968 | 0 | 0.0, 1.63 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | 227, 111, 193 | iec_minced_meat 629.60 of 630.00 | 629.60 | 15968 of 15968 | 0 | 0.0, 1.63 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | 169, 112, 201 | iec_egg_yolk 1499.75 of 1500.00 | 1499.75 | 15968 of 15968 | 0 | 0.0, 1.86 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | 156, 112, 199 | iec_minced_meat 629.60 of 630.00 | 629.60 | 15968 of 15968 | 0 | 0.0, 1.35 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | 96, 112, 201 | iec_egg_yolk 1499.62 of 1500.00 | 1499.62 | 15968 of 15968 | 0 | 0.0, 1.69 | no |
| fork_01 | dinner_fork_185 | lower | -11, -245, 76 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1095 of 1095 | 0 | 0.0, 0.24 | no |
| fork_02 | dinner_fork_185 | lower | -17, -146, 76 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1093 of 1093 | 0 | 0.0, 0.28 | no |
| fork_03 | dinner_fork_185 | lower | -3, -146, 76 | iec_egg_yolk 149.98 of 150.00 | 149.98 | 1095 of 1095 | 0 | 0.0, 0.20 | no |
| fork_04 | dinner_fork_185 | lower | -7, -234, 76 | iec_egg_yolk 149.98 of 150.00 | 149.98 | 1093 of 1093 | 0 | 0.0, 0.33 | no |
| fork_05 | dinner_fork_185 | lower | 46, -33, 76 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1094 of 1094 | 0 | 0.0, 0.23 | no |
| fork_06 | dinner_fork_185 | lower | 64, -102, 76 | iec_egg_yolk 149.98 of 150.00 | 149.98 | 1093 of 1093 | 0 | 0.0, 0.24 | no |
| fork_07 | dinner_fork_185 | lower | 57, -208, 75 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1094 of 1094 | 0 | 0.0, 0.21 | no |
| fork_08 | dinner_fork_185 | lower | -49, -44, 75 | iec_egg_yolk 149.98 of 150.00 | 149.98 | 1094 of 1094 | 0 | 0.0, 0.40 | no |
| fork_09 | dinner_fork_185 | lower | -26, -145, 75 | iec_egg_yolk 149.98 of 150.00 | 149.98 | 1095 of 1095 | 0 | 0.0, 0.19 | no |
| fork_10 | dinner_fork_185 | lower | -7, -245, 76 | iec_egg_yolk 149.98 of 150.00 | 149.98 | 1096 of 1096 | 0 | 0.0, 0.20 | no |
| fork_11 | dinner_fork_185 | lower | 16, -33, 75 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1095 of 1095 | 0 | 0.0, 0.30 | no |
| fork_12 | dinner_fork_185 | lower | 15, -53, 75 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1095 of 1095 | 0 | 0.0, 0.26 | no |
| fork_13 | dinner_fork_185 | lower | 12, -35, 75 | iec_egg_yolk 149.97 of 150.00 | 149.97 | 1094 of 1094 | 0 | 0.0, 0.26 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 93, 206, 431 | iec_milk 4999.98 of 5000.00 | 4999.98 | 10611 of 10611 | 0 | 293.5, 2.85 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 110, 7, 426 | iec_milk 4999.92 of 5000.00 | 4999.92 | 10611 of 10611 | 0 | 293.5, 2.43 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 111, -65, 426 | iec_milk 4999.94 of 5000.00 | 4999.94 | 10611 of 10611 | 0 | 293.5, 2.48 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 111, -139, 427 | iec_milk 4999.96 of 5000.00 | 4999.96 | 10611 of 10611 | 0 | 293.5, 2.66 | no |
| glass_07 | test_glass_borosilicate_250 | upper | -47, 145, 417 | iec_milk 4999.93 of 5000.00 | 4999.93 | 10611 of 10611 | 0 | 293.5, 2.65 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -74, 78, 416 | iec_milk 4999.91 of 5000.00 | 4999.91 | 10611 of 10611 | 0 | 293.5, 2.65 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -76, 205, 416 | iec_milk 4999.98 of 5000.00 | 4999.98 | 10611 of 10611 | 0 | 293.5, 3.16 | no |
| glass_11 | test_glass_borosilicate_250 | upper | -143, 131, 442 | iec_milk 4999.99 of 5000.00 | 4999.99 | 10611 of 10611 | 0 | 293.5, 2.49 | no |
| glass_13 | test_glass_borosilicate_250 | upper | 116, 130, 426 | iec_milk 4999.97 of 5000.00 | 4999.97 | 10611 of 10611 | 0 | 293.5, 2.66 | no |
| knife_01 | dinner_knife_210 | lower | 29, -199, 264 | iec_margarine 0.00 of 300.00 | 0.00 | 1 of 2335 | 4 | 0.0, 0.25 | yes |
| knife_02 | dinner_knife_210 | lower | -66, -91, 268 | iec_margarine 0.00 of 300.00 | 0.00 | 1 of 2335 | 4 | 0.0, 0.15 | yes |
| knife_03 | dinner_knife_210 | lower | -76, -92, 265 | iec_margarine 0.01 of 300.00 | 0.01 | 2 of 2335 | 4 | 0.0, 0.22 | yes |
| knife_04 | dinner_knife_210 | lower | -47, -125, 277 | iec_margarine 1.13 of 300.00 | 1.13 | 8 of 2334 | 3 | 0.0, 0.12 | no |
| knife_05 | dinner_knife_210 | lower | -70, -229, 271 | iec_margarine 0.19 of 300.00 | 0.19 | 1 of 2335 | 4 | 0.0, 0.25 | yes |
| knife_06 | dinner_knife_210 | lower | -3, -101, 258 | iec_margarine 1.09 of 300.00 | 1.09 | 32 of 2335 | 2 | 0.0, 0.29 | no |
| knife_07 | dinner_knife_210 | lower | 88, -131, 263 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.11 | yes |
| knife_08 | dinner_knife_210 | lower | 31, -171, 268 | iec_margarine 0.15 of 300.00 | 0.15 | 7 of 2335 | 3 | 0.0, 0.19 | no |
| knife_09 | dinner_knife_210 | lower | -61, -27, 274 | iec_margarine 0.01 of 300.00 | 0.01 | 4 of 2335 | 4 | 0.0, 0.46 | yes |
| knife_10 | dinner_knife_210 | lower | -45, -179, 279 | iec_margarine 0.01 of 300.00 | 0.01 | 4 of 2335 | 3 | 0.0, 0.14 | no |
| knife_11 | dinner_knife_210 | lower | -76, -221, 269 | iec_margarine 1.42 of 300.00 | 1.42 | 17 of 2335 | 3 | 0.0, 0.31 | no |
| knife_12 | dinner_knife_210 | lower | 25, -151, 270 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2334 | 5 | 0.0, 0.16 | yes |
| knife_13 | dinner_knife_210 | lower | -67, -214, 272 | iec_margarine 3.29 of 300.00 | 3.29 | 76 of 2335 | 1 | 0.0, 0.17 | no |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -28, 512 | iec_spinach 386.66 of 500.00 | 386.66 | 10935 of 10935 | 0 | 0.0, 1.71 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -32, 505 | iec_minced_meat 419.73 of 420.00 | 419.73 | 10935 of 10935 | 0 | 0.0, 2.36 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_spinach 417.60 of 500.00 | 417.60 | 10935 of 10935 | 0 | 0.0, 1.81 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -81, -69, 505 | iec_minced_meat 419.74 of 420.00 | 419.74 | 10935 of 10935 | 0 | 0.0, 2.34 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -82, -101, 512 | iec_spinach 420.56 of 500.00 | 420.56 | 10935 of 10935 | 0 | 0.0, 0.94 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -82, -106, 506 | iec_minced_meat 419.73 of 420.00 | 419.73 | 10935 of 10935 | 0 | 0.0, 1.48 | no |
| mug_01 | mug_ceramic_300 | upper | 182, -64, 495 | iec_tea 0.10 of 0.10 | 0.10 | 12104 of 12104 | 0 | 330.8, 2.81 | no |
| mug_02 | mug_ceramic_300 | upper | 181, -145, 495 | iec_tea 0.10 of 0.10 | 0.10 | 12104 of 12104 | 0 | 330.8, 2.79 | no |
| mug_03 | mug_ceramic_300 | upper | 182, 193, 495 | iec_tea 0.10 of 0.10 | 0.10 | 12105 of 12105 | 0 | 330.8, 2.80 | no |
| mug_04 | mug_ceramic_300 | upper | 183, 109, 495 | iec_tea 0.10 of 0.10 | 0.10 | 12104 of 12104 | 0 | 330.8, 2.86 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -102, 86, 201 | iec_margarine 0.00 of 5000.00 | 0.00 | 0 of 20245 | 5 | 0.0, 2.14 | yes |
| saucer_01 | saucer_porcelain_140 | lower | 165, -140, 121 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.67 | no |
| saucer_02 | saucer_porcelain_140 | lower | 127, -139, 130 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.68 | no |
| saucer_03 | saucer_porcelain_140 | lower | -42, 112, 129 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.54 | no |
| saucer_04 | saucer_porcelain_140 | upper | -82, -141, 481 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.81 | no |
| saucer_05 | saucer_porcelain_140 | upper | -81, -177, 486 | iec_tea 0.09 of 0.10 | 0.09 | 3002 of 3002 | 0 | 0.0, 0.54 | no |
| serving_fork_01 | serving_fork_210 | lower | -32, -202, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 17, -72, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | -1, -210, 74 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | 7, 112, 197 | iec_oat_flakes 102.92 of 240.00 | 102.92 | 13973 of 14750 | 0 | 0.0, 1.31 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -27, -66, 76 | iec_oat_flakes 12.95 of 24.00 | 12.95 | 1438 of 1450 | 0 | 0.0, 0.24 | no |
| soup_spoon_02 | soup_spoon_190 | lower | 55, -212, 76 | iec_oat_flakes 10.32 of 24.00 | 10.32 | 1393 of 1450 | 0 | 0.0, 0.51 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 70, -245, 77 | iec_oat_flakes 12.61 of 24.00 | 12.61 | 1426 of 1450 | 0 | 0.0, 0.20 | no |
| soup_spoon_04 | soup_spoon_190 | lower | -45, -33, 75 | iec_oat_flakes 11.21 of 24.00 | 11.21 | 1388 of 1450 | 0 | 0.0, 0.26 | no |
| soup_spoon_05 | soup_spoon_190 | lower | 4, -102, 74 | iec_oat_flakes 12.15 of 24.00 | 12.15 | 1415 of 1450 | 0 | 0.0, 0.12 | no |
| soup_spoon_06 | soup_spoon_190 | lower | 0, -238, 75 | iec_oat_flakes 11.57 of 24.00 | 11.57 | 1409 of 1450 | 0 | 0.0, 0.29 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 20, -36, 75 | iec_oat_flakes 13.18 of 24.00 | 13.18 | 1431 of 1451 | 0 | 0.0, 0.22 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 67, -104, 76 | iec_oat_flakes 12.92 of 24.00 | 12.92 | 1430 of 1450 | 0 | 0.0, 0.27 | no |
| soup_spoon_09 | soup_spoon_190 | lower | 39, -208, 75 | iec_oat_flakes 11.70 of 24.00 | 11.70 | 1413 of 1450 | 0 | 0.0, 0.33 | no |
| soup_spoon_10 | soup_spoon_190 | lower | -5, -32, 75 | iec_oat_flakes 12.34 of 24.00 | 12.34 | 1433 of 1450 | 0 | 0.0, 0.26 | no |
| soup_spoon_11 | soup_spoon_190 | lower | 1, -139, 77 | iec_oat_flakes 12.91 of 24.00 | 12.91 | 1434 of 1451 | 0 | 0.0, 0.29 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 31, -239, 76 | iec_oat_flakes 12.15 of 24.00 | 12.15 | 1424 of 1450 | 0 | 0.0, 0.23 | no |
| soup_spoon_13 | soup_spoon_190 | lower | 0, -248, 76 | iec_oat_flakes 11.77 of 24.00 | 11.77 | 1413 of 1450 | 0 | 0.0, 0.30 | no |
| teaspoon_01 | teaspoon_130 | lower | 16, -166, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_02 | teaspoon_130 | lower | 54, -36, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| teaspoon_03 | teaspoon_130 | lower | 31, -30, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| teaspoon_04 | teaspoon_130 | lower | 61, -172, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_05 | teaspoon_130 | lower | 44, -206, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| teaspoon_06 | teaspoon_130 | lower | -49, -65, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_07 | teaspoon_130 | lower | 2, -145, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| teaspoon_08 | teaspoon_130 | lower | 2, -252, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_09 | teaspoon_130 | lower | 65, -33, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_11 | teaspoon_130 | lower | 20, -252, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
