# Demonstration wash: iec-13-careful

The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully.

Machine bosch_smv4hax40g, programme auto_145 (145 min, 3971 ticks), tier official, 118 items (22 of the offer left on the counter by the loading physics), simulator spotless-sim 0.4.1 water-5, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 22.7 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 475.0 s |
| Time, soil | 2.3 s |
| Time, replay | 9.4 s |
| Time, result | 8.8 s |
| Time, total | 518.3 s (8.6 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 1165254 blocks, 3748368 soil cells, 635300 deposits |
| GPU memory | scene 165.2 MB, peak of all buffers 165.2 MB |
| Process memory (RSS) | 1.19 GB |
| Mains water, energy | 11.5 L, 1.04 kWh |
| Water held in vessels | 20 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 31.75 g dry at the start, 5.36 g left (17 %) |
| Items clean | 66 of 118 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 990 s | lower 40 rpm | 0.7050 | 0.5360 | 0.0320 | 0.1364 | 0.1678 | 0.0011 | 99.94 % | 0.328 kg | 0.103 kg | yes |
| l@3000 | 1921 s | lower 42 rpm | 0.7173 | 0.5414 | 0.0365 | 0.1387 | 0.1747 | 0.0012 | 99.94 % | 0.337 kg | 0.103 kg | yes |
| ur@2800 | 924 s | upper 27 rpm | 0.9484 | 0.4660 | 0.0565 | 0.1397 | 0.4814 | 0.0009 | 99.98 % | 0.394 kg | 0.106 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4408 | 0.0537 | 0.1320 | 0.4579 | 0.0008 | 99.98 % | 0.405 kg | 0.106 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -83, 113, 489 | iec_spinach 0.00 of 162.62 | 0.00 | 0 of 10011 | 5 | 0.0, 0.97 | yes |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 0.00 of 147.76 | 0.00 | 0 of 10011 | 5 | 0.0, 0.98 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 417.48 of 981.77 | 417.48 | 9128 of 9149 | 0 | 0.0, 1.07 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 221, 112, 158 | iec_spinach 0.00 of 156.30 | 0.00 | 1 of 9148 | 4 | 0.0, 1.12 | yes |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 405.83 of 946.62 | 405.83 | 9138 of 9149 | 0 | 0.0, 1.00 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 174, 112, 163 | iec_spinach 0.01 of 157.45 | 0.01 | 2 of 9149 | 4 | 0.0, 1.00 | yes |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 404.49 of 937.66 | 404.49 | 9133 of 9149 | 0 | 0.0, 1.01 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 138, 112, 163 | iec_spinach 0.00 of 156.82 | 0.00 | 0 of 9149 | 5 | 0.0, 0.96 | yes |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 410.20 of 961.98 | 410.20 | 9131 of 9148 | 0 | 0.0, 1.04 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -32, -39, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -6, -119, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -6, -177, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 61, -32, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 68, -38, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -21, -220, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.51 | yes |
| dessert_spoon_07 | dessert_spoon_160 | lower | -3, -233, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.31 | yes |
| dessert_spoon_08 | dessert_spoon_160 | lower | -15, -248, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| dessert_spoon_09 | dessert_spoon_160 | lower | 28, -131, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_11 | dessert_spoon_160 | lower | 31, -159, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_12 | dessert_spoon_160 | lower | -12, -36, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dessert_spoon_13 | dessert_spoon_160 | lower | 15, -100, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 420.43 of 1397.95 | 420.43 | 15340 of 15968 | 0 | 0.0, 1.85 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 7.44 of 620.48 | 7.44 | 803 of 15968 | 0 | 0.0, 1.92 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_egg_yolk 493.06 of 1498.61 | 493.06 | 15677 of 15968 | 0 | 0.0, 1.85 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 4.65 of 595.63 | 4.65 | 515 of 15968 | 0 | 0.0, 1.85 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 602.11 of 1599.23 | 602.11 | 15866 of 15968 | 0 | 0.0, 1.71 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 10.88 of 657.36 | 10.88 | 948 of 15968 | 0 | 0.0, 1.89 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -79, 112, 199 | iec_egg_yolk 492.13 of 1508.95 | 492.13 | 15668 of 15968 | 0 | 0.0, 1.88 | no |
| fork_01 | dinner_fork_185 | lower | -23, -220, 79 | iec_egg_yolk 95.45 of 161.31 | 95.45 | 1095 of 1095 | 0 | 0.0, 0.29 | no |
| fork_02 | dinner_fork_185 | lower | 58, -55, 81 | iec_egg_yolk 73.38 of 142.54 | 73.38 | 1093 of 1093 | 0 | 0.0, 0.21 | no |
| fork_03 | dinner_fork_185 | lower | 16, -183, 80 | iec_egg_yolk 70.64 of 138.79 | 70.64 | 1095 of 1095 | 0 | 0.0, 0.27 | no |
| fork_04 | dinner_fork_185 | lower | 6, -52, 81 | iec_egg_yolk 74.02 of 140.56 | 74.02 | 1093 of 1093 | 0 | 0.0, 0.19 | no |
| fork_05 | dinner_fork_185 | lower | 4, -176, 80 | iec_egg_yolk 83.50 of 147.97 | 83.50 | 1094 of 1094 | 0 | 0.0, 0.18 | no |
| fork_06 | dinner_fork_185 | lower | 1, -26, 81 | iec_egg_yolk 81.64 of 150.22 | 81.64 | 1093 of 1093 | 0 | 0.0, 0.27 | no |
| fork_07 | dinner_fork_185 | lower | -17, -218, 79 | iec_egg_yolk 94.88 of 151.39 | 94.88 | 1094 of 1094 | 0 | 0.0, 0.50 | no |
| fork_08 | dinner_fork_185 | lower | -23, -159, 79 | iec_egg_yolk 94.15 of 153.77 | 94.15 | 1094 of 1094 | 0 | 0.0, 0.41 | no |
| fork_09 | dinner_fork_185 | lower | 2, -241, 80 | iec_egg_yolk 90.45 of 151.19 | 90.45 | 1095 of 1095 | 0 | 0.0, 0.34 | no |
| fork_11 | dinner_fork_185 | lower | 7, -231, 80 | iec_egg_yolk 98.04 of 156.66 | 98.04 | 1095 of 1095 | 0 | 0.0, 0.34 | no |
| fork_12 | dinner_fork_185 | lower | 7, -209, 80 | iec_egg_yolk 77.54 of 143.69 | 77.54 | 1095 of 1095 | 0 | 0.0, 0.17 | no |
| fork_13 | dinner_fork_185 | lower | 3, -245, 80 | iec_egg_yolk 84.01 of 149.55 | 84.01 | 1094 of 1094 | 0 | 0.0, 0.20 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 103, 133, 550 | iec_milk 54.37 of 518.45 | 54.37 | 4095 of 10611 | 0 | 0.0, 1.42 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 107, 201, 551 | iec_milk 23.75 of 492.68 | 23.75 | 2224 of 10611 | 0 | 0.0, 1.42 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 103, 73, 550 | iec_milk 26.59 of 504.83 | 26.59 | 2370 of 10611 | 0 | 0.0, 1.66 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 98, 7, 549 | iec_milk 6.86 of 497.75 | 6.86 | 712 of 10611 | 0 | 0.0, 1.28 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 99, -64, 549 | iec_milk 4.27 of 482.09 | 4.27 | 484 of 10611 | 0 | 0.0, 1.32 | no |
| glass_06 | test_glass_borosilicate_250 | upper | 99, -138, 549 | iec_milk 50.88 of 521.99 | 50.88 | 4240 of 10611 | 0 | 0.0, 1.32 | no |
| glass_07 | test_glass_borosilicate_250 | upper | 47, 45, 559 | iec_milk 6.24 of 503.45 | 6.24 | 660 of 10611 | 0 | 0.0, 1.79 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -123, 56, 565 | iec_milk 24.83 of 511.88 | 24.83 | 2316 of 10611 | 0 | 0.0, 0.88 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -181, 206, 570 | iec_milk 184.86 of 493.39 | 184.86 | 8061 of 10611 | 0 | 0.0, 3.00 | no |
| glass_10 | test_glass_borosilicate_250 | upper | -181, 140, 570 | iec_milk 85.99 of 529.87 | 85.99 | 5859 of 10611 | 0 | 0.0, 2.96 | no |
| glass_11 | test_glass_borosilicate_250 | upper | -181, -212, 570 | iec_milk 93.45 of 519.13 | 93.45 | 5836 of 10611 | 0 | 0.0, 2.91 | no |
| glass_12 | test_glass_borosilicate_250 | upper | -199, -138, 570 | iec_milk 50.20 of 513.77 | 50.20 | 3876 of 10611 | 0 | 0.0, 2.73 | no |
| glass_13 | test_glass_borosilicate_250 | upper | 51, 193, 558 | iec_milk 36.47 of 521.65 | 36.47 | 3180 of 10611 | 0 | 0.0, 1.59 | no |
| knife_01 | dinner_knife_210 | lower | -16, -163, 79 | iec_margarine 0.00 of 235.35 | 0.00 | 0 of 2335 | 5 | 0.0, 0.36 | yes |
| knife_02 | dinner_knife_210 | lower | -10, -214, 80 | iec_margarine 0.00 of 252.15 | 0.00 | 0 of 2335 | 5 | 0.0, 0.43 | yes |
| knife_03 | dinner_knife_210 | lower | 47, -116, 79 | iec_margarine 0.00 of 245.78 | 0.00 | 0 of 2335 | 5 | 0.0, 0.19 | yes |
| knife_04 | dinner_knife_210 | lower | 47, -236, 80 | iec_margarine 0.09 of 235.88 | 0.09 | 4 of 2334 | 4 | 0.0, 0.38 | yes |
| knife_05 | dinner_knife_210 | lower | 7, -128, 82 | iec_margarine 0.00 of 253.57 | 0.00 | 0 of 2335 | 5 | 0.0, 0.35 | yes |
| knife_06 | dinner_knife_210 | lower | 14, -66, 78 | iec_margarine 0.00 of 249.93 | 0.00 | 0 of 2335 | 5 | 0.0, 0.24 | yes |
| knife_07 | dinner_knife_210 | lower | 66, -166, 79 | iec_margarine 0.00 of 240.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.38 | yes |
| knife_08 | dinner_knife_210 | lower | 55, -170, 79 | iec_margarine 0.00 of 235.55 | 0.00 | 0 of 2335 | 5 | 0.0, 0.36 | yes |
| knife_09 | dinner_knife_210 | lower | 45, -164, 78 | iec_margarine 0.00 of 247.76 | 0.00 | 0 of 2335 | 5 | 0.0, 0.32 | yes |
| knife_10 | dinner_knife_210 | lower | -21, -48, 80 | iec_margarine 0.00 of 267.65 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_11 | dinner_knife_210 | lower | -36, -153, 79 | iec_margarine 0.05 of 262.46 | 0.05 | 7 of 2335 | 3 | 0.0, 0.63 | no |
| knife_12 | dinner_knife_210 | lower | -32, -146, 79 | iec_margarine 0.28 of 223.39 | 0.28 | 6 of 2334 | 3 | 0.0, 0.51 | no |
| knife_13 | dinner_knife_210 | lower | -47, -149, 79 | iec_margarine 0.00 of 256.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.23 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -82, -27, 512 | iec_spinach 0.00 of 143.79 | 0.00 | 0 of 10935 | 5 | 0.0, 1.35 | yes |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -47, 512 | iec_minced_meat 2.94 of 421.65 | 2.94 | 316 of 10935 | 0 | 0.0, 1.40 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_spinach 0.00 of 153.58 | 0.00 | 0 of 10935 | 5 | 0.0, 1.30 | yes |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -81, -83, 512 | iec_minced_meat 3.52 of 403.84 | 3.52 | 387 of 10935 | 0 | 0.0, 1.39 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -101, 512 | iec_spinach 0.00 of 148.67 | 0.00 | 0 of 10935 | 5 | 0.0, 1.28 | yes |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -82, -120, 513 | iec_minced_meat 3.16 of 420.20 | 3.16 | 305 of 10935 | 0 | 0.0, 1.34 | no |
| mug_01 | mug_ceramic_300 | upper | 183, -73, 595 | iec_tea 0.87 of 9.17 | 0.87 | 11715 of 12104 | 0 | 5.0, 3.64 | no |
| mug_02 | mug_ceramic_300 | upper | 183, -168, 595 | iec_tea 1.38 of 9.69 | 1.38 | 12072 of 12104 | 0 | 5.0, 3.63 | no |
| mug_03 | mug_ceramic_300 | upper | 183, 178, 595 | iec_tea 1.71 of 10.07 | 1.71 | 12090 of 12105 | 0 | 5.0, 3.68 | no |
| mug_04 | mug_ceramic_300 | upper | 183, 86, 595 | iec_tea 1.28 of 10.52 | 1.28 | 12102 of 12104 | 0 | 5.0, 3.72 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 0.00 of 4098.75 | 0.00 | 0 of 20245 | 5 | 0.0, 2.59 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 0.78 of 10.02 | 0.78 | 3002 of 3002 | 0 | 0.0, 0.72 | no |
| saucer_02 | saucer_porcelain_140 | lower | 143, -140, 123 | iec_tea 0.64 of 9.26 | 0.64 | 3002 of 3002 | 0 | 0.0, 0.86 | no |
| saucer_03 | saucer_porcelain_140 | lower | 101, 112, 129 | iec_tea 0.71 of 9.55 | 0.71 | 3002 of 3002 | 0 | 0.0, 0.75 | no |
| saucer_04 | saucer_porcelain_140 | lower | 13, 112, 129 | iec_tea 0.80 of 9.63 | 0.80 | 3002 of 3002 | 0 | 0.0, 0.66 | no |
| saucer_05 | saucer_porcelain_140 | upper | -82, -157, 487 | iec_tea 0.93 of 9.78 | 0.93 | 3002 of 3002 | 0 | 0.0, 0.66 | no |
| saucer_06 | saucer_porcelain_140 | upper | -81, -177, 486 | iec_tea 0.92 of 9.58 | 0.92 | 3001 of 3001 | 0 | 0.0, 0.68 | no |
| serving_fork_01 | serving_fork_210 | lower | 26, -122, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.35 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 13, -170, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 45, -219, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 0.00 of 241.14 | 0.00 | 0 of 14751 | 5 | 0.0, 2.01 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -171, -140, 188 | iec_oat_flakes 0.00 of 253.28 | 0.00 | 0 of 14750 | 5 | 0.0, 1.88 | yes |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 0.01 of 256.97 | 0.01 | 1 of 14751 | 4 | 0.0, 2.05 | yes |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 199, -140, 187 | iec_oat_flakes 0.00 of 256.30 | 0.00 | 0 of 14751 | 5 | 0.0, 1.95 | yes |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 0.00 of 222.11 | 0.00 | 0 of 14751 | 5 | 0.0, 2.01 | yes |
| soup_plate_06 | soup_plate_porcelain_230 | lower | -22, 112, 194 | iec_oat_flakes 0.00 of 236.57 | 0.00 | 0 of 14750 | 5 | 0.0, 1.77 | yes |
| soup_spoon_01 | soup_spoon_190 | lower | -9, -122, 79 | iec_oat_flakes 0.00 of 22.40 | 0.00 | 0 of 1450 | 5 | 0.0, 0.35 | yes |
| soup_spoon_02 | soup_spoon_190 | lower | -40, -156, 80 | iec_oat_flakes 0.00 of 22.59 | 0.00 | 0 of 1450 | 4 | 0.0, 0.41 | yes |
| soup_spoon_03 | soup_spoon_190 | lower | 9, -33, 80 | iec_oat_flakes 0.00 of 25.65 | 0.00 | 0 of 1450 | 5 | 0.0, 0.23 | yes |
| soup_spoon_04 | soup_spoon_190 | lower | 61, -145, 80 | iec_oat_flakes 0.00 of 22.86 | 0.00 | 1 of 1450 | 4 | 0.0, 0.22 | yes |
| soup_spoon_05 | soup_spoon_190 | lower | -46, -70, 79 | iec_oat_flakes 0.00 of 21.99 | 0.00 | 0 of 1450 | 5 | 0.0, 0.30 | yes |
| soup_spoon_06 | soup_spoon_190 | lower | -14, -27, 81 | iec_oat_flakes 0.06 of 22.63 | 0.06 | 7 of 1450 | 3 | 0.0, 0.40 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 14, -130, 79 | iec_oat_flakes 0.00 of 22.45 | 0.00 | 0 of 1451 | 5 | 0.0, 0.39 | yes |
| soup_spoon_08 | soup_spoon_190 | lower | 21, -109, 79 | iec_oat_flakes 0.00 of 25.54 | 0.00 | 0 of 1450 | 5 | 0.0, 0.33 | yes |
| soup_spoon_09 | soup_spoon_190 | lower | -27, -120, 79 | iec_oat_flakes 0.00 of 23.02 | 0.00 | 0 of 1450 | 5 | 0.0, 0.26 | yes |
| soup_spoon_10 | soup_spoon_190 | lower | 39, -173, 79 | iec_oat_flakes 0.00 of 25.96 | 0.00 | 0 of 1450 | 5 | 0.0, 0.29 | yes |
| soup_spoon_11 | soup_spoon_190 | lower | -15, -36, 81 | iec_oat_flakes 0.00 of 24.52 | 0.00 | 0 of 1451 | 5 | 0.0, 0.29 | yes |
| soup_spoon_12 | soup_spoon_190 | lower | 25, -175, 80 | iec_oat_flakes 0.00 of 21.81 | 0.00 | 0 of 1450 | 5 | 0.0, 0.31 | yes |
| soup_spoon_13 | soup_spoon_190 | lower | 44, -179, 79 | iec_oat_flakes 0.00 of 22.84 | 0.00 | 0 of 1450 | 5 | 0.0, 0.31 | yes |
| teaspoon_01 | teaspoon_130 | lower | 36, -218, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_02 | teaspoon_130 | lower | -29, -43, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| teaspoon_03 | teaspoon_130 | lower | -3, -130, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_04 | teaspoon_130 | lower | 12, -118, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| teaspoon_05 | teaspoon_130 | lower | 65, -201, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.07 | yes |
| teaspoon_06 | teaspoon_130 | lower | 14, -76, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_07 | teaspoon_130 | lower | 1, -111, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_08 | teaspoon_130 | lower | -27, -167, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.40 | yes |
| teaspoon_09 | teaspoon_130 | lower | -29, -171, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.32 | yes |
| teaspoon_10 | teaspoon_130 | lower | 23, -133, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.22 | yes |
| teaspoon_11 | teaspoon_130 | lower | 15, -108, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| teaspoon_12 | teaspoon_130 | lower | 19, -97, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| teaspoon_13 | teaspoon_130 | lower | -8, -250, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
