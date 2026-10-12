# Demonstration wash: iec-13-careful

The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully.

Machine bosch_smv4hax40g, programme auto_145 (145 min, 3971 ticks), tier official, 104 items (36 of the offer left on the counter by the loading physics), simulator spotless-sim 0.3.2 water-3, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 10.8 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 203.4 s |
| Time, soil | 1.3 s |
| Time, replay | 5.6 s |
| Time, result | 1.1 s |
| Time, total | 222.1 s (3.7 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 963281 blocks, 2942236 soil cells, 496969 deposits |
| GPU memory | scene 144.8 MB, peak of all buffers 144.8 MB |
| Process memory (RSS) | 0.92 GB |
| Mains water, energy | 11.5 L, 1.04 kWh |
| Water held in vessels | 20 mL |
| Detergent | 20.0 of 20.0 g dissolved (dispenser free) |
| Soil | 72.55 g dry at the start, 56.78 g left (78 %) |
| Items clean | 34 of 104 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 990 s | lower 40 rpm | 0.7050 | 0.5402 | 0.0344 | 0.1297 | 0.1635 | 0.0013 | 99.50 % | 0.258 kg | 0.057 kg | yes |
| l@3000 | 1921 s | lower 42 rpm | 0.7173 | 0.5461 | 0.0392 | 0.1313 | 0.1699 | 0.0013 | 99.49 % | 0.267 kg | 0.057 kg | yes |
| ur@2800 | 924 s | upper 27 rpm | 0.9484 | 0.4624 | 0.0657 | 0.1341 | 0.4847 | 0.0013 | 99.78 % | 0.309 kg | 0.059 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4375 | 0.0625 | 0.1265 | 0.4608 | 0.0012 | 99.79 % | 0.319 kg | 0.059 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -223, -141, 157 | iec_egg_yolk 867.22 of 1000.00 | 867.22 | 9149 of 9149 | 0 | 0.0, 0.77 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | -197, -140, 156 | iec_spinach 106.03 of 500.00 | 106.03 | 8402 of 9148 | 0 | 0.0, 0.75 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | -170, -140, 157 | iec_egg_yolk 867.73 of 1000.00 | 867.73 | 9149 of 9149 | 0 | 0.0, 0.76 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | -145, -140, 156 | iec_spinach 107.30 of 500.00 | 107.30 | 8477 of 9149 | 0 | 0.0, 0.74 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 867.85 of 1000.00 | 867.85 | 9149 of 9149 | 0 | 0.0, 0.80 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 223, -141, 157 | iec_spinach 106.94 of 500.00 | 106.94 | 8452 of 9149 | 0 | 0.0, 1.06 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 197, -140, 156 | iec_egg_yolk 866.88 of 1000.00 | 866.88 | 9148 of 9148 | 0 | 0.0, 0.82 | no |
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
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -226, 111, 199 | iec_egg_yolk 1300.31 of 1500.00 | 1300.31 | 15968 of 15968 | 0 | 0.0, 1.34 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -189, 111, 199 | iec_minced_meat 337.60 of 630.00 | 337.60 | 15968 of 15968 | 0 | 0.0, 1.34 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -153, 111, 199 | iec_egg_yolk 1297.86 of 1500.00 | 1297.86 | 15968 of 15968 | 0 | 0.0, 1.37 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | 227, 111, 193 | iec_minced_meat 345.01 of 630.00 | 345.01 | 15965 of 15968 | 0 | 0.0, 1.46 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | 193, 112, 199 | iec_egg_yolk 1301.45 of 1500.00 | 1301.45 | 15968 of 15968 | 0 | 0.0, 1.47 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | 156, 112, 199 | iec_minced_meat 344.79 of 630.00 | 344.79 | 15966 of 15968 | 0 | 0.0, 1.38 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | 120, 112, 199 | iec_egg_yolk 1301.48 of 1500.00 | 1301.48 | 15968 of 15968 | 0 | 0.0, 1.37 | no |
| fork_01 | dinner_fork_185 | lower | -11, -245, 76 | iec_egg_yolk 132.98 of 150.00 | 132.98 | 1095 of 1095 | 0 | 0.0, 0.24 | no |
| fork_02 | dinner_fork_185 | lower | -17, -146, 76 | iec_egg_yolk 132.30 of 150.00 | 132.30 | 1093 of 1093 | 0 | 0.0, 0.29 | no |
| fork_03 | dinner_fork_185 | lower | -3, -146, 76 | iec_egg_yolk 131.81 of 150.00 | 131.81 | 1095 of 1095 | 0 | 0.0, 0.20 | no |
| fork_04 | dinner_fork_185 | lower | -7, -234, 76 | iec_egg_yolk 132.70 of 150.00 | 132.70 | 1093 of 1093 | 0 | 0.0, 0.35 | no |
| fork_05 | dinner_fork_185 | lower | 46, -33, 76 | iec_egg_yolk 131.11 of 150.00 | 131.11 | 1094 of 1094 | 0 | 0.0, 0.23 | no |
| fork_06 | dinner_fork_185 | lower | 64, -102, 76 | iec_egg_yolk 131.67 of 150.00 | 131.67 | 1093 of 1093 | 0 | 0.0, 0.25 | no |
| fork_07 | dinner_fork_185 | lower | 57, -208, 75 | iec_egg_yolk 132.33 of 150.00 | 132.33 | 1094 of 1094 | 0 | 0.0, 0.21 | no |
| fork_08 | dinner_fork_185 | lower | -49, -44, 75 | iec_egg_yolk 131.61 of 150.00 | 131.61 | 1094 of 1094 | 0 | 0.0, 0.40 | no |
| fork_09 | dinner_fork_185 | lower | -26, -145, 75 | iec_egg_yolk 133.21 of 150.00 | 133.21 | 1095 of 1095 | 0 | 0.0, 0.20 | no |
| fork_10 | dinner_fork_185 | lower | -7, -245, 76 | iec_egg_yolk 132.79 of 150.00 | 132.79 | 1096 of 1096 | 0 | 0.0, 0.20 | no |
| fork_11 | dinner_fork_185 | lower | 16, -33, 75 | iec_egg_yolk 131.39 of 150.00 | 131.39 | 1095 of 1095 | 0 | 0.0, 0.30 | no |
| fork_12 | dinner_fork_185 | lower | 15, -53, 75 | iec_egg_yolk 131.24 of 150.00 | 131.24 | 1095 of 1095 | 0 | 0.0, 0.26 | no |
| fork_13 | dinner_fork_185 | lower | 12, -35, 75 | iec_egg_yolk 131.67 of 150.00 | 131.67 | 1094 of 1094 | 0 | 0.0, 0.26 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 73, 206, 555 | iec_milk 4906.00 of 5000.00 | 4906.00 | 10611 of 10611 | 0 | 0.0, 0.61 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 98, 7, 550 | iec_milk 4904.70 of 5000.00 | 4904.70 | 10611 of 10611 | 0 | 0.0, 0.72 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 99, -65, 550 | iec_milk 4900.83 of 5000.00 | 4900.83 | 10611 of 10611 | 0 | 0.0, 0.77 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 98, -139, 550 | iec_milk 4913.35 of 5000.00 | 4913.35 | 10611 of 10611 | 0 | 0.0, 0.78 | no |
| glass_07 | test_glass_borosilicate_250 | upper | -38, 145, 541 | iec_milk 4902.49 of 5000.00 | 4902.49 | 10611 of 10611 | 0 | 0.0, 0.74 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -81, 78, 539 | iec_milk 4903.12 of 5000.00 | 4903.12 | 10611 of 10611 | 0 | 0.0, 0.83 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -76, 205, 536 | iec_milk 4908.39 of 5000.00 | 4908.39 | 10611 of 10611 | 0 | 0.0, 2.85 | no |
| glass_11 | test_glass_borosilicate_250 | upper | -128, 131, 566 | iec_milk 4923.36 of 5000.00 | 4923.36 | 10611 of 10611 | 0 | 0.0, 0.71 | no |
| glass_13 | test_glass_borosilicate_250 | upper | 103, 130, 551 | iec_milk 4902.77 of 5000.00 | 4902.77 | 10611 of 10611 | 0 | 0.0, 0.74 | no |
| knife_01 | dinner_knife_210 | lower | 29, -199, 264 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.25 | yes |
| knife_02 | dinner_knife_210 | lower | -66, -91, 268 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.16 | yes |
| knife_03 | dinner_knife_210 | lower | -76, -92, 265 | iec_margarine 0.12 of 300.00 | 0.12 | 1 of 2335 | 4 | 0.0, 0.22 | yes |
| knife_04 | dinner_knife_210 | lower | -47, -125, 277 | iec_margarine 0.80 of 300.00 | 0.80 | 5 of 2334 | 3 | 0.0, 0.13 | no |
| knife_05 | dinner_knife_210 | lower | -70, -229, 271 | iec_margarine 1.40 of 300.00 | 1.40 | 27 of 2335 | 2 | 0.0, 0.25 | no |
| knife_06 | dinner_knife_210 | lower | -3, -101, 258 | iec_margarine 0.18 of 300.00 | 0.18 | 23 of 2335 | 2 | 0.0, 0.29 | no |
| knife_07 | dinner_knife_210 | lower | 88, -131, 263 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.10 | yes |
| knife_08 | dinner_knife_210 | lower | 31, -171, 268 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.19 | yes |
| knife_09 | dinner_knife_210 | lower | -61, -27, 274 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.45 | yes |
| knife_10 | dinner_knife_210 | lower | -45, -179, 279 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.14 | yes |
| knife_11 | dinner_knife_210 | lower | -76, -221, 269 | iec_margarine 0.78 of 300.00 | 0.78 | 12 of 2335 | 3 | 0.0, 0.32 | no |
| knife_12 | dinner_knife_210 | lower | 25, -151, 270 | iec_margarine 0.07 of 300.00 | 0.07 | 1 of 2334 | 4 | 0.0, 0.16 | yes |
| knife_13 | dinner_knife_210 | lower | -67, -214, 272 | iec_margarine 6.15 of 300.00 | 6.15 | 83 of 2335 | 1 | 0.0, 0.16 | no |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -28, 512 | iec_spinach 60.47 of 500.00 | 60.47 | 8161 of 10935 | 0 | 0.0, 0.36 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -47, 512 | iec_minced_meat 220.08 of 420.00 | 220.08 | 10935 of 10935 | 0 | 0.0, 0.45 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_spinach 72.13 of 500.00 | 72.13 | 8777 of 10935 | 0 | 0.0, 0.35 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -81, -83, 512 | iec_minced_meat 222.55 of 420.00 | 222.55 | 10933 of 10935 | 0 | 0.0, 0.47 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -82, -101, 512 | iec_spinach 71.28 of 500.00 | 71.28 | 8740 of 10935 | 0 | 0.0, 0.36 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -82, -120, 513 | iec_minced_meat 221.92 of 420.00 | 221.92 | 10934 of 10935 | 0 | 0.0, 0.57 | no |
| mug_01 | mug_ceramic_300 | upper | 182, -63, 595 | iec_tea 0.01 of 0.10 | 0.01 | 12104 of 12104 | 0 | 5.0, 3.31 | no |
| mug_02 | mug_ceramic_300 | upper | 181, -145, 595 | iec_tea 0.02 of 0.10 | 0.02 | 12104 of 12104 | 0 | 5.0, 3.24 | no |
| mug_03 | mug_ceramic_300 | upper | 182, 193, 595 | iec_tea 0.02 of 0.10 | 0.02 | 12105 of 12105 | 0 | 5.0, 2.93 | no |
| mug_04 | mug_ceramic_300 | upper | 183, 109, 595 | iec_tea 0.02 of 0.10 | 0.02 | 12104 of 12104 | 0 | 5.0, 3.30 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -102, 86, 201 | iec_margarine 0.00 of 5000.00 | 0.00 | 0 of 20245 | 5 | 0.0, 1.90 | yes |
| saucer_01 | saucer_porcelain_140 | lower | 165, -140, 121 | iec_tea 0.01 of 0.10 | 0.01 | 3002 of 3002 | 0 | 0.0, 0.49 | no |
| saucer_02 | saucer_porcelain_140 | lower | 143, -140, 123 | iec_tea 0.01 of 0.10 | 0.01 | 3002 of 3002 | 0 | 0.0, 0.60 | no |
| saucer_03 | saucer_porcelain_140 | lower | -42, 112, 129 | iec_tea 0.01 of 0.10 | 0.01 | 3002 of 3002 | 0 | 0.0, 0.50 | no |
| saucer_04 | saucer_porcelain_140 | upper | -82, -157, 487 | iec_tea 0.02 of 0.10 | 0.02 | 3002 of 3002 | 0 | 0.0, 0.46 | no |
| saucer_05 | saucer_porcelain_140 | upper | -81, -177, 486 | iec_tea 0.01 of 0.10 | 0.01 | 3002 of 3002 | 0 | 0.0, 0.48 | no |
| serving_fork_01 | serving_fork_210 | lower | -32, -202, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 17, -72, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | -1, -210, 74 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | 7, 112, 197 | iec_oat_flakes 4.10 of 240.00 | 4.10 | 1041 of 14750 | 0 | 0.0, 1.32 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -27, -66, 76 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 7 of 1450 | 3 | 0.0, 0.24 | no |
| soup_spoon_02 | soup_spoon_190 | lower | 55, -212, 76 | iec_oat_flakes 0.08 of 24.00 | 0.08 | 14 of 1450 | 2 | 0.0, 0.51 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 70, -245, 77 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 8 of 1450 | 3 | 0.0, 0.20 | no |
| soup_spoon_04 | soup_spoon_190 | lower | -45, -33, 75 | iec_oat_flakes 0.05 of 24.00 | 0.05 | 5 of 1450 | 3 | 0.0, 0.26 | no |
| soup_spoon_05 | soup_spoon_190 | lower | 4, -102, 74 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 9 of 1450 | 2 | 0.0, 0.12 | no |
| soup_spoon_06 | soup_spoon_190 | lower | 0, -238, 75 | iec_oat_flakes 0.10 of 24.00 | 0.10 | 17 of 1450 | 3 | 0.0, 0.29 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 20, -36, 75 | iec_oat_flakes 0.09 of 24.00 | 0.09 | 12 of 1451 | 2 | 0.0, 0.22 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 67, -104, 76 | iec_oat_flakes 0.07 of 24.00 | 0.07 | 10 of 1450 | 2 | 0.0, 0.27 | no |
| soup_spoon_09 | soup_spoon_190 | lower | 39, -208, 75 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 6 of 1450 | 3 | 0.0, 0.33 | no |
| soup_spoon_10 | soup_spoon_190 | lower | -5, -32, 75 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 10 of 1450 | 2 | 0.0, 0.26 | no |
| soup_spoon_11 | soup_spoon_190 | lower | 1, -139, 77 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 8 of 1451 | 3 | 0.0, 0.29 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 31, -239, 76 | iec_oat_flakes 0.32 of 24.00 | 0.32 | 27 of 1450 | 2 | 0.0, 0.23 | no |
| soup_spoon_13 | soup_spoon_190 | lower | 0, -248, 76 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 9 of 1450 | 2 | 0.0, 0.30 | no |
| teaspoon_01 | teaspoon_130 | lower | 16, -166, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_02 | teaspoon_130 | lower | 54, -36, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| teaspoon_03 | teaspoon_130 | lower | 31, -30, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| teaspoon_04 | teaspoon_130 | lower | 61, -172, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_05 | teaspoon_130 | lower | 44, -206, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| teaspoon_06 | teaspoon_130 | lower | -49, -65, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_07 | teaspoon_130 | lower | 2, -145, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| teaspoon_08 | teaspoon_130 | lower | 2, -252, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
| teaspoon_09 | teaspoon_130 | lower | 65, -33, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_11 | teaspoon_130 | lower | 20, -252, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
