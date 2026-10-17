# Demonstration wash: iec-13-careful

The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier official, 114 items (26 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 13.5 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 1.2 s |
| Time, soil | 1.5 s |
| Time, replay | 7.6 s |
| Time, result | 2.7 s |
| Time, total | 26.6 s (0.4 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 1115120 blocks, 3550840 soil cells, 592485 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 1.57 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 29.26 g dry at the start, 0.06 g left (0 %) |
| Items clean | 86 of 114 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5349 | 0.0324 | 0.1370 | 0.1689 | 0.0011 | 99.93 % | 0.301 kg | 0.082 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5407 | 0.0368 | 0.1391 | 0.1755 | 0.0011 | 99.93 % | 0.311 kg | 0.082 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4568 | 0.0588 | 0.1467 | 0.4907 | 0.0009 | 99.98 % | 0.358 kg | 0.083 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4320 | 0.0559 | 0.1385 | 0.4666 | 0.0008 | 99.98 % | 0.368 kg | 0.083 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -80, 117, 492 | iec_spinach 0.00 of 162.62 | 0.00 | 0 of 10011 | 5 | 0.0, 1.04 | yes |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 0.00 of 147.76 | 0.00 | 0 of 10011 | 5 | 0.0, 0.97 | yes |
| dessert_bowl_04 | dessert_bowl_vitrelle_130 | upper | -79, 7, 490 | iec_spinach 0.00 of 167.88 | 0.00 | 0 of 10011 | 5 | 0.0, 1.05 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 0.11 of 981.77 | 0.11 | 8 of 9149 | 2 | 0.0, 1.07 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 221, 111, 159 | iec_spinach 0.00 of 156.30 | 0.00 | 0 of 9148 | 5 | 0.0, 1.15 | yes |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 0.10 of 946.62 | 0.10 | 6 of 9149 | 2 | 0.0, 0.92 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 174, 112, 163 | iec_spinach 0.00 of 157.45 | 0.00 | 0 of 9149 | 5 | 0.0, 1.00 | yes |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 0.03 of 937.66 | 0.03 | 2 of 9149 | 3 | 0.0, 0.91 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 138, 112, 163 | iec_spinach 0.00 of 156.82 | 0.00 | 0 of 9149 | 5 | 0.0, 0.95 | yes |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 0.04 of 961.98 | 0.04 | 3 of 9148 | 3 | 0.0, 0.97 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -25, -43, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -5, -119, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -7, -177, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 66, -40, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.54 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 70, -39, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.53 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -21, -220, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.49 | yes |
| dessert_spoon_07 | dessert_spoon_160 | lower | -3, -233, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.32 | yes |
| dessert_spoon_08 | dessert_spoon_160 | lower | -15, -247, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| dessert_spoon_09 | dessert_spoon_160 | lower | 32, -126, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.28 | yes |
| dessert_spoon_11 | dessert_spoon_160 | lower | 31, -159, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.23 | yes |
| dessert_spoon_12 | dessert_spoon_160 | lower | -9, -30, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| dessert_spoon_13 | dessert_spoon_160 | lower | 15, -100, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.23 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 0.00 of 1397.95 | 0.00 | 0 of 15968 | 4 | 0.0, 1.79 | yes |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 0.00 of 620.48 | 0.00 | 0 of 15968 | 5 | 0.0, 1.73 | yes |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_egg_yolk 0.02 of 1498.61 | 0.02 | 1 of 15968 | 4 | 0.0, 1.73 | yes |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 0.00 of 595.63 | 0.00 | 0 of 15968 | 5 | 0.0, 1.80 | yes |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 0.18 of 1599.23 | 0.18 | 15 of 15968 | 2 | 0.0, 1.73 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 0.00 of 657.36 | 0.00 | 0 of 15968 | 5 | 0.0, 1.99 | yes |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -79, 112, 199 | iec_egg_yolk 0.00 of 1508.95 | 0.00 | 0 of 15968 | 5 | 0.0, 1.88 | yes |
| fork_01 | dinner_fork_185 | lower | -23, -220, 79 | iec_egg_yolk 5.03 of 161.31 | 5.03 | 181 of 1095 | 1 | 0.0, 0.37 | no |
| fork_02 | dinner_fork_185 | lower | 64, -31, 81 | iec_egg_yolk 0.34 of 142.54 | 0.34 | 28 of 1093 | 2 | 0.0, 0.18 | no |
| fork_03 | dinner_fork_185 | lower | 16, -183, 80 | iec_egg_yolk 1.51 of 138.79 | 1.51 | 55 of 1095 | 1 | 0.0, 0.28 | no |
| fork_04 | dinner_fork_185 | lower | 5, -47, 80 | iec_egg_yolk 0.22 of 140.56 | 0.22 | 13 of 1093 | 2 | 0.0, 0.17 | no |
| fork_05 | dinner_fork_185 | lower | 3, -176, 80 | iec_egg_yolk 3.49 of 147.97 | 3.49 | 108 of 1094 | 1 | 0.0, 0.27 | no |
| fork_06 | dinner_fork_185 | lower | 3, -34, 80 | iec_egg_yolk 0.71 of 150.22 | 0.71 | 49 of 1093 | 2 | 0.0, 0.25 | no |
| fork_07 | dinner_fork_185 | lower | -17, -218, 79 | iec_egg_yolk 16.44 of 151.39 | 16.44 | 270 of 1094 | 0 | 0.0, 0.50 | no |
| fork_08 | dinner_fork_185 | lower | -23, -160, 79 | iec_egg_yolk 12.75 of 153.77 | 12.75 | 417 of 1094 | 0 | 0.0, 0.39 | no |
| fork_09 | dinner_fork_185 | lower | 2, -242, 80 | iec_egg_yolk 4.54 of 151.19 | 4.54 | 174 of 1095 | 1 | 0.0, 0.35 | no |
| fork_11 | dinner_fork_185 | lower | 7, -231, 80 | iec_egg_yolk 5.57 of 156.66 | 5.57 | 269 of 1095 | 0 | 0.0, 0.35 | no |
| fork_12 | dinner_fork_185 | lower | 7, -209, 80 | iec_egg_yolk 0.52 of 143.69 | 0.52 | 39 of 1095 | 2 | 0.0, 0.17 | no |
| fork_13 | dinner_fork_185 | lower | 3, -245, 80 | iec_egg_yolk 2.23 of 149.55 | 2.23 | 118 of 1094 | 1 | 0.0, 0.20 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 111, 140, 550 | iec_milk 0.00 of 518.45 | 0.00 | 0 of 10611 | 5 | 0.0, 1.10 | yes |
| glass_02 | test_glass_borosilicate_250 | upper | 104, 6, 551 | iec_milk 0.00 of 492.68 | 0.00 | 0 of 10611 | 5 | 0.0, 1.17 | yes |
| glass_03 | test_glass_borosilicate_250 | upper | 104, -62, 550 | iec_milk 0.00 of 504.83 | 0.00 | 0 of 10611 | 5 | 0.0, 1.18 | yes |
| glass_04 | test_glass_borosilicate_250 | upper | 109, -139, 550 | iec_milk 0.00 of 497.75 | 0.00 | 0 of 10611 | 5 | 0.0, 0.98 | yes |
| glass_05 | test_glass_borosilicate_250 | upper | -207, 83, 556 | iec_milk 0.00 of 482.09 | 0.00 | 0 of 10611 | 5 | 0.0, 1.01 | yes |
| glass_06 | test_glass_borosilicate_250 | upper | -206, 196, 557 | iec_milk 7.83 of 521.99 | 7.83 | 263 of 10611 | 0 | 0.0, 1.06 | no |
| glass_07 | test_glass_borosilicate_250 | upper | -204, -155, 544 | iec_milk 0.00 of 503.45 | 0.00 | 0 of 10611 | 5 | 0.0, 1.95 | yes |
| glass_08 | test_glass_borosilicate_250 | upper | -212, -215, 554 | iec_milk 0.14 of 511.88 | 0.14 | 3 of 10611 | 4 | 0.0, 1.05 | yes |
| knife_01 | dinner_knife_210 | lower | -16, -163, 79 | iec_margarine 0.19 of 235.35 | 0.19 | 10 of 2335 | 3 | 0.0, 0.37 | no |
| knife_02 | dinner_knife_210 | lower | -10, -214, 80 | iec_margarine 0.00 of 252.15 | 0.00 | 0 of 2335 | 5 | 0.0, 0.42 | yes |
| knife_03 | dinner_knife_210 | lower | 51, -116, 79 | iec_margarine 0.00 of 245.78 | 0.00 | 0 of 2335 | 5 | 0.0, 0.24 | yes |
| knife_04 | dinner_knife_210 | lower | 47, -237, 80 | iec_margarine 0.03 of 235.88 | 0.03 | 4 of 2334 | 4 | 0.0, 0.36 | yes |
| knife_05 | dinner_knife_210 | lower | 7, -128, 82 | iec_margarine 0.00 of 253.57 | 0.00 | 0 of 2335 | 5 | 0.0, 0.37 | yes |
| knife_06 | dinner_knife_210 | lower | 14, -39, 79 | iec_margarine 0.00 of 249.93 | 0.00 | 0 of 2335 | 5 | 0.0, 0.23 | yes |
| knife_07 | dinner_knife_210 | lower | 67, -168, 79 | iec_margarine 0.00 of 240.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.40 | yes |
| knife_08 | dinner_knife_210 | lower | 56, -169, 79 | iec_margarine 0.00 of 235.55 | 0.00 | 0 of 2335 | 5 | 0.0, 0.36 | yes |
| knife_09 | dinner_knife_210 | lower | 45, -164, 78 | iec_margarine 0.00 of 247.76 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_10 | dinner_knife_210 | lower | -13, -46, 80 | iec_margarine 0.00 of 267.65 | 0.00 | 0 of 2335 | 5 | 0.0, 0.29 | yes |
| knife_11 | dinner_knife_210 | lower | -36, -153, 79 | iec_margarine 0.06 of 262.46 | 0.06 | 11 of 2335 | 3 | 0.0, 0.61 | no |
| knife_12 | dinner_knife_210 | lower | -33, -146, 79 | iec_margarine 0.15 of 223.39 | 0.15 | 5 of 2334 | 3 | 0.0, 0.50 | no |
| knife_13 | dinner_knife_210 | lower | -47, -149, 79 | iec_margarine 0.00 of 256.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.22 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -85, -40, 516 | iec_spinach 0.00 of 143.79 | 0.00 | 0 of 10935 | 5 | 0.0, 0.82 | yes |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -82, -58, 517 | iec_minced_meat 0.00 of 421.65 | 0.00 | 0 of 10935 | 5 | 0.0, 0.90 | yes |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -84, -76, 516 | iec_spinach 0.00 of 153.58 | 0.00 | 0 of 10935 | 5 | 0.0, 0.81 | yes |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -82, -94, 518 | iec_minced_meat 0.00 of 403.84 | 0.00 | 0 of 10935 | 5 | 0.0, 0.89 | yes |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -112, 518 | iec_spinach 0.00 of 148.67 | 0.00 | 0 of 10935 | 5 | 0.0, 0.80 | yes |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -86, -128, 520 | iec_minced_meat 0.00 of 420.20 | 0.00 | 0 of 10935 | 5 | 0.0, 0.82 | yes |
| mug_01 | mug_ceramic_300 | upper | 189, 157, 541 | iec_tea 0.21 of 2.76 | 0.23 | 229 of 12104 | 0 | 0.1, 1.99 | no |
| mug_02 | mug_ceramic_300 | upper | 190, 46, 540 | iec_tea 0.24 of 2.92 | 0.26 | 225 of 12104 | 0 | 0.1, 1.94 | no |
| mug_03 | mug_ceramic_300 | upper | 190, -75, 540 | iec_tea 0.18 of 3.03 | 0.20 | 0 of 12105 | 5 | 0.1, 1.91 | yes |
| mug_04 | mug_ceramic_300 | upper | 189, -191, 540 | iec_tea 0.23 of 3.17 | 0.25 | 151 of 12104 | 1 | 0.1, 1.91 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 0.00 of 4098.75 | 0.00 | 0 of 20245 | 5 | 0.0, 2.47 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 0.05 of 0.75 | 0.05 | 0 of 3002 | 5 | 0.0, 0.70 | yes |
| saucer_02 | saucer_porcelain_140 | lower | 143, -140, 123 | iec_tea 0.04 of 0.69 | 0.04 | 0 of 3002 | 5 | 0.0, 0.82 | yes |
| saucer_03 | saucer_porcelain_140 | lower | 101, 111, 129 | iec_tea 0.04 of 0.72 | 0.04 | 0 of 3002 | 5 | 0.0, 0.78 | yes |
| saucer_04 | saucer_porcelain_140 | lower | 13, 112, 129 | iec_tea 0.05 of 0.72 | 0.05 | 0 of 3002 | 5 | 0.0, 0.65 | yes |
| saucer_05 | saucer_porcelain_140 | upper | -82, -160, 487 | iec_tea 0.06 of 0.73 | 0.06 | 11 of 3002 | 3 | 0.0, 0.68 | no |
| saucer_06 | saucer_porcelain_140 | upper | -81, -180, 487 | iec_tea 0.06 of 0.72 | 0.06 | 6 of 3001 | 3 | 0.0, 0.67 | no |
| serving_fork_01 | serving_fork_210 | lower | 22, -121, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 15, -170, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 46, -220, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 0.00 of 241.14 | 0.00 | 0 of 14751 | 5 | 0.0, 1.98 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -171, -140, 188 | iec_oat_flakes 0.00 of 253.28 | 0.00 | 0 of 14750 | 5 | 0.0, 1.86 | yes |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 0.00 of 256.97 | 0.00 | 0 of 14751 | 5 | 0.0, 2.02 | yes |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 199, -140, 187 | iec_oat_flakes 0.00 of 256.30 | 0.00 | 0 of 14751 | 5 | 0.0, 1.96 | yes |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 0.00 of 222.11 | 0.00 | 0 of 14751 | 5 | 0.0, 2.01 | yes |
| soup_plate_06 | soup_plate_porcelain_230 | lower | -22, 112, 194 | iec_oat_flakes 0.00 of 236.57 | 0.00 | 0 of 14750 | 5 | 0.0, 1.80 | yes |
| soup_spoon_01 | soup_spoon_190 | lower | -9, -122, 79 | iec_oat_flakes 0.00 of 22.40 | 0.00 | 0 of 1450 | 5 | 0.0, 0.35 | yes |
| soup_spoon_02 | soup_spoon_190 | lower | -40, -156, 80 | iec_oat_flakes 0.00 of 22.59 | 0.00 | 0 of 1450 | 5 | 0.0, 0.42 | yes |
| soup_spoon_03 | soup_spoon_190 | lower | 46, -42, 79 | iec_oat_flakes 0.00 of 25.65 | 0.00 | 0 of 1450 | 5 | 0.0, 0.19 | yes |
| soup_spoon_04 | soup_spoon_190 | lower | 62, -147, 80 | iec_oat_flakes 0.06 of 22.86 | 0.06 | 6 of 1450 | 3 | 0.0, 0.24 | no |
| soup_spoon_05 | soup_spoon_190 | lower | -42, -66, 79 | iec_oat_flakes 0.00 of 21.99 | 0.00 | 0 of 1450 | 5 | 0.0, 0.27 | yes |
| soup_spoon_06 | soup_spoon_190 | lower | 1, -27, 81 | iec_oat_flakes 0.42 of 22.63 | 0.42 | 31 of 1450 | 2 | 0.0, 0.37 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 15, -132, 79 | iec_oat_flakes 0.00 of 22.45 | 0.00 | 0 of 1451 | 5 | 0.0, 0.42 | yes |
| soup_spoon_08 | soup_spoon_190 | lower | 40, -130, 79 | iec_oat_flakes 0.00 of 25.54 | 0.00 | 0 of 1450 | 5 | 0.0, 0.37 | yes |
| soup_spoon_09 | soup_spoon_190 | lower | -36, -121, 80 | iec_oat_flakes 0.00 of 23.02 | 0.00 | 0 of 1450 | 5 | 0.0, 0.28 | yes |
| soup_spoon_10 | soup_spoon_190 | lower | 39, -173, 79 | iec_oat_flakes 0.00 of 25.96 | 0.00 | 0 of 1450 | 5 | 0.0, 0.35 | yes |
| soup_spoon_11 | soup_spoon_190 | lower | -10, -35, 80 | iec_oat_flakes 0.00 of 24.52 | 0.00 | 0 of 1451 | 5 | 0.0, 0.29 | yes |
| soup_spoon_12 | soup_spoon_190 | lower | 25, -175, 80 | iec_oat_flakes 0.00 of 21.81 | 0.00 | 0 of 1450 | 5 | 0.0, 0.29 | yes |
| soup_spoon_13 | soup_spoon_190 | lower | 44, -179, 79 | iec_oat_flakes 0.00 of 22.84 | 0.00 | 0 of 1450 | 5 | 0.0, 0.32 | yes |
| teaspoon_01 | teaspoon_130 | lower | 36, -218, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| teaspoon_02 | teaspoon_130 | lower | -22, -47, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_03 | teaspoon_130 | lower | -3, -130, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_04 | teaspoon_130 | lower | 13, -122, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_05 | teaspoon_130 | lower | 65, -201, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.08 | yes |
| teaspoon_06 | teaspoon_130 | lower | 10, -72, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.09 | yes |
| teaspoon_07 | teaspoon_130 | lower | -0, -111, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.08 | yes |
| teaspoon_08 | teaspoon_130 | lower | -26, -168, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.43 | yes |
| teaspoon_09 | teaspoon_130 | lower | -29, -171, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.34 | yes |
| teaspoon_10 | teaspoon_130 | lower | 29, -133, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| teaspoon_11 | teaspoon_130 | lower | 13, -111, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.40 | yes |
| teaspoon_12 | teaspoon_130 | lower | 15, -100, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| teaspoon_13 | teaspoon_130 | lower | -7, -250, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
