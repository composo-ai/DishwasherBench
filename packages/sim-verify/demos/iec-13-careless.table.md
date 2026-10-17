# Demonstration wash: iec-13-careless

The same IEC load, loaded with the common mistakes.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier official, 113 items (27 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 2, spoons_nested x 7, cup_upright x 4, cup_on_side x 3, item_over_others x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 8.6 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 340.0 s |
| Time, soil | 1.2 s |
| Time, replay | 32.8 s |
| Time, result | 2.6 s |
| Time, total | 385.4 s (6.4 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 1104207 blocks, 3507188 soil cells, 582506 deposits |
| GPU memory | scene 166.9 MB, peak of all buffers 167.3 MB |
| Process memory (RSS) | 1.55 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 1273 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 29.10 g dry at the start, 0.06 g left (0 %) |
| Items clean | 82 of 113 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5335 | 0.0314 | 0.1393 | 0.1703 | 0.0011 | 99.93 % | 0.329 kg | 0.100 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5392 | 0.0358 | 0.1417 | 0.1770 | 0.0011 | 99.92 % | 0.338 kg | 0.100 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4590 | 0.0543 | 0.1490 | 0.4886 | 0.0008 | 99.94 % | 0.376 kg | 0.101 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4339 | 0.0518 | 0.1408 | 0.4648 | 0.0007 | 99.95 % | 0.386 kg | 0.101 kg | yes |

## What the wash reports

- placement: melamine_plate_02 cuts 0.9 mm into glass_03; both are simulated where they were placed

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -81, 172, 491 | iec_oat_flakes 0.00 of 147.76 | 0.00 | 0 of 10011 | 5 | 0.0, 1.02 | yes |
| dessert_bowl_04 | dessert_bowl_vitrelle_130 | upper | -82, 15, 494 | iec_spinach 0.00 of 167.88 | 0.00 | 0 of 10011 | 5 | 0.0, 1.11 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -104, -138, 201 | iec_egg_yolk 1.89 of 981.77 | 1.89 | 139 of 9149 | 1 | 0.0, 1.00 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 221, 112, 159 | iec_spinach 1.26 of 156.30 | 1.26 | 272 of 9148 | 0 | 0.0, 1.13 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 0.25 of 946.62 | 0.25 | 17 of 9149 | 2 | 0.0, 0.97 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 174, 112, 163 | iec_spinach 0.00 of 157.45 | 0.00 | 0 of 9149 | 5 | 0.0, 0.92 | yes |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 0.18 of 937.66 | 0.18 | 13 of 9149 | 2 | 0.0, 0.92 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 138, 112, 163 | iec_spinach 0.00 of 156.82 | 0.00 | 0 of 9149 | 5 | 0.0, 0.95 | yes |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 0.43 of 961.98 | 0.43 | 22 of 9148 | 2 | 0.0, 0.96 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -33, -38, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -6, -120, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.23 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -6, -176, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 64, -41, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.49 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 67, -39, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.56 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -15, -219, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.41 | yes |
| dessert_spoon_07 | dessert_spoon_160 | lower | -9, -234, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_08 | dessert_spoon_160 | lower | -16, -248, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| dessert_spoon_09 | dessert_spoon_160 | lower | 25, -129, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.29 | yes |
| dessert_spoon_11 | dessert_spoon_160 | lower | 20, -149, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_12 | dessert_spoon_160 | lower | 70, -42, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| dessert_spoon_13 | dessert_spoon_160 | lower | 14, -112, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.47 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 0.00 of 1397.95 | 0.00 | 0 of 15968 | 4 | 0.0, 1.79 | yes |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 0.00 of 620.48 | 0.00 | 0 of 15968 | 5 | 0.0, 1.73 | yes |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_egg_yolk 0.01 of 1498.61 | 0.01 | 1 of 15968 | 4 | 0.0, 1.74 | yes |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 0.00 of 595.63 | 0.00 | 0 of 15968 | 5 | 0.0, 1.75 | yes |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 0.11 of 1599.23 | 0.11 | 10 of 15968 | 2 | 0.0, 1.73 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 0.00 of 657.36 | 0.00 | 0 of 15968 | 5 | 0.0, 1.91 | yes |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -79, 112, 199 | iec_egg_yolk 0.00 of 1508.95 | 0.00 | 0 of 15968 | 4 | 0.0, 1.84 | yes |
| fork_01 | dinner_fork_185 | lower | -18, -220, 80 | iec_egg_yolk 1.33 of 161.31 | 1.33 | 79 of 1095 | 1 | 0.0, 0.30 | no |
| fork_02 | dinner_fork_185 | lower | 65, -31, 81 | iec_egg_yolk 0.59 of 142.54 | 0.59 | 47 of 1093 | 2 | 0.0, 0.20 | no |
| fork_03 | dinner_fork_185 | lower | 16, -176, 80 | iec_egg_yolk 0.18 of 138.79 | 0.18 | 16 of 1095 | 2 | 0.0, 0.22 | no |
| fork_04 | dinner_fork_185 | lower | -1, -37, 80 | iec_egg_yolk 0.25 of 140.56 | 0.25 | 16 of 1093 | 2 | 0.0, 0.41 | no |
| fork_05 | dinner_fork_185 | lower | 3, -176, 80 | iec_egg_yolk 0.48 of 147.97 | 0.48 | 35 of 1094 | 2 | 0.0, 0.12 | no |
| fork_06 | dinner_fork_185 | lower | -1, -31, 80 | iec_egg_yolk 2.75 of 150.22 | 2.75 | 78 of 1093 | 1 | 0.0, 0.54 | no |
| fork_07 | dinner_fork_185 | lower | -12, -217, 80 | iec_egg_yolk 0.74 of 151.39 | 0.74 | 53 of 1094 | 1 | 0.0, 0.28 | no |
| fork_08 | dinner_fork_185 | lower | -22, -158, 79 | iec_egg_yolk 16.26 of 153.77 | 16.26 | 444 of 1094 | 0 | 0.0, 0.25 | no |
| fork_09 | dinner_fork_185 | lower | -6, -241, 80 | iec_egg_yolk 1.92 of 151.19 | 1.92 | 86 of 1095 | 1 | 0.0, 0.36 | no |
| fork_11 | dinner_fork_185 | lower | 1, -230, 79 | iec_egg_yolk 4.45 of 156.66 | 4.45 | 198 of 1095 | 1 | 0.0, 0.46 | no |
| fork_12 | dinner_fork_185 | lower | 7, -211, 80 | iec_egg_yolk 1.67 of 143.69 | 1.67 | 94 of 1095 | 1 | 0.0, 0.22 | no |
| fork_13 | dinner_fork_185 | lower | -4, -243, 79 | iec_egg_yolk 0.89 of 149.55 | 0.89 | 57 of 1094 | 1 | 0.0, 0.28 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 114, 142, 548 | iec_milk 0.00 of 518.45 | 0.00 | 0 of 10611 | 5 | 0.0, 0.99 | yes |
| glass_02 | test_glass_borosilicate_250 | upper | 99, 25, 537 | iec_milk 0.00 of 492.68 | 0.00 | 0 of 10611 | 5 | 0.0, 1.11 | yes |
| glass_03 | test_glass_borosilicate_250 | upper | 41, 11, 508 | iec_milk 11.13 of 504.83 | 40.70 | 6658 of 10611 | 0 | 41.3, 2.04 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 106, -138, 551 | iec_milk 0.00 of 497.75 | 0.00 | 0 of 10611 | 5 | 0.0, 1.05 | yes |
| glass_05 | test_glass_borosilicate_250 | upper | -206, 90, 557 | iec_milk 0.00 of 482.09 | 0.00 | 0 of 10611 | 5 | 0.0, 1.12 | yes |
| glass_06 | test_glass_borosilicate_250 | upper | -211, 203, 423 | iec_milk 0.00 of 521.99 | 1335.13 | 12024 of 10611 | 0 | 289.6, 2.73 | no |
| glass_07 | test_glass_borosilicate_250 | upper | -205, -71, 566 | iec_milk 14.82 of 503.45 | 14.82 | 535 of 10611 | 0 | 0.0, 1.36 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -210, -224, 427 | iec_milk 0.00 of 511.88 | 1279.74 | 12374 of 10611 | 0 | 285.3, 1.81 | no |
| knife_01 | dinner_knife_210 | lower | 5, -247, 80 | iec_margarine 0.05 of 235.35 | 0.05 | 4 of 2335 | 3 | 0.0, 0.31 | no |
| knife_02 | dinner_knife_210 | lower | 8, -231, 83 | iec_margarine 0.00 of 252.15 | 0.00 | 0 of 2335 | 5 | 0.0, 0.36 | yes |
| knife_03 | dinner_knife_210 | lower | 44, -118, 79 | iec_margarine 0.00 of 245.78 | 0.00 | 0 of 2335 | 5 | 0.0, 0.26 | yes |
| knife_04 | dinner_knife_210 | lower | 49, -240, 80 | iec_margarine 0.17 of 235.88 | 0.17 | 4 of 2334 | 4 | 0.0, 0.25 | yes |
| knife_05 | dinner_knife_210 | lower | 7, -130, 82 | iec_margarine 0.00 of 253.57 | 0.00 | 0 of 2335 | 5 | 0.0, 0.30 | yes |
| knife_06 | dinner_knife_210 | lower | 14, -39, 79 | iec_margarine 0.00 of 249.93 | 0.00 | 0 of 2335 | 5 | 0.0, 0.23 | yes |
| knife_07 | dinner_knife_210 | lower | 60, -167, 79 | iec_margarine 0.00 of 240.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.22 | yes |
| knife_08 | dinner_knife_210 | lower | 48, -158, 79 | iec_margarine 0.00 of 235.55 | 0.00 | 0 of 2335 | 5 | 0.0, 0.25 | yes |
| knife_09 | dinner_knife_210 | lower | 30, -164, 78 | iec_margarine 0.00 of 247.76 | 0.00 | 0 of 2335 | 5 | 0.0, 0.35 | yes |
| knife_10 | dinner_knife_210 | lower | -9, -40, 81 | iec_margarine 0.00 of 267.65 | 0.00 | 0 of 2335 | 5 | 0.0, 0.33 | yes |
| knife_11 | dinner_knife_210 | lower | -37, -153, 79 | iec_margarine 0.00 of 262.46 | 0.00 | 0 of 2335 | 5 | 0.0, 0.54 | yes |
| knife_12 | dinner_knife_210 | lower | -32, -146, 79 | iec_margarine 0.00 of 223.39 | 0.00 | 0 of 2334 | 5 | 0.0, 0.45 | yes |
| knife_13 | dinner_knife_210 | lower | -47, -150, 79 | iec_margarine 0.17 of 256.88 | 0.17 | 8 of 2335 | 3 | 0.0, 0.28 | no |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -85, -40, 516 | iec_spinach 0.00 of 143.79 | 0.00 | 0 of 10935 | 5 | 0.0, 0.89 | yes |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -84, -58, 519 | iec_minced_meat 0.00 of 421.65 | 0.00 | 0 of 10935 | 5 | 0.0, 0.82 | yes |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | 91, 28, 548 | iec_spinach 0.00 of 153.58 | 14.37 | 10421 of 10935 | 0 | 57.1, 13.64 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -82, -94, 518 | iec_minced_meat 0.00 of 403.84 | 0.00 | 0 of 10935 | 5 | 0.0, 0.93 | yes |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -82, -112, 517 | iec_spinach 0.00 of 148.67 | 0.00 | 0 of 10935 | 5 | 0.0, 0.84 | yes |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -84, -128, 521 | iec_minced_meat 0.00 of 420.20 | 0.00 | 0 of 10935 | 5 | 0.0, 0.86 | yes |
| mug_01 | mug_ceramic_300 | upper | 27, 128, 480 | iec_tea 0.26 of 2.76 | 0.26 | 556 of 12104 | 0 | 0.1, 3.08 | no |
| mug_02 | mug_ceramic_300 | upper | 150, 65, 448 | iec_tea 0.73 of 2.92 | 1322.24 | 25936 of 12104 | 0 | 319.8, 3.27 | no |
| mug_03 | mug_ceramic_300 | upper | 186, -22, 479 | iec_tea 0.77 of 3.03 | 0.77 | 10042 of 12105 | 0 | 0.0, 2.95 | no |
| mug_04 | mug_ceramic_300 | upper | 148, -175, 449 | iec_tea 0.76 of 3.17 | 1158.85 | 24212 of 12104 | 0 | 280.4, 1.90 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -91, 196 | iec_margarine 0.00 of 4098.75 | 0.00 | 0 of 20245 | 5 | 0.0, 2.46 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 0.05 of 0.75 | 0.05 | 0 of 3002 | 5 | 0.0, 0.70 | yes |
| saucer_02 | saucer_porcelain_140 | lower | 121, -139, 135 | iec_tea 0.08 of 0.69 | 0.08 | 303 of 3002 | 0 | 0.0, 0.64 | no |
| saucer_03 | saucer_porcelain_140 | lower | 101, 111, 129 | iec_tea 0.05 of 0.72 | 0.05 | 0 of 3002 | 4 | 0.0, 0.72 | yes |
| saucer_04 | saucer_porcelain_140 | lower | 13, 112, 129 | iec_tea 0.06 of 0.72 | 0.06 | 0 of 3002 | 5 | 0.0, 0.65 | yes |
| saucer_05 | saucer_porcelain_140 | upper | -82, -160, 487 | iec_tea 0.05 of 0.73 | 0.05 | 1 of 3002 | 4 | 0.0, 0.66 | yes |
| saucer_06 | saucer_porcelain_140 | upper | -81, -180, 487 | iec_tea 0.05 of 0.72 | 0.05 | 2 of 3001 | 4 | 0.0, 0.67 | yes |
| serving_fork_01 | serving_fork_210 | lower | 20, -116, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.36 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 70, -245, 82 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 45, -224, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.28 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 0.00 of 241.14 | 0.00 | 0 of 14751 | 5 | 0.0, 1.83 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -172, -140, 188 | iec_oat_flakes 0.00 of 253.28 | 0.00 | 0 of 14750 | 5 | 0.0, 1.92 | yes |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 0.00 of 256.97 | 0.00 | 0 of 14751 | 5 | 0.0, 2.08 | yes |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 199, -140, 187 | iec_oat_flakes 0.00 of 256.30 | 0.00 | 0 of 14751 | 5 | 0.0, 1.94 | yes |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 0.00 of 222.11 | 0.00 | 0 of 14751 | 5 | 0.0, 2.17 | yes |
| soup_plate_06 | soup_plate_porcelain_230 | lower | -22, 112, 194 | iec_oat_flakes 0.00 of 236.57 | 0.00 | 0 of 14750 | 5 | 0.0, 2.07 | yes |
| soup_spoon_01 | soup_spoon_190 | lower | -10, -125, 79 | iec_oat_flakes 0.00 of 22.40 | 0.00 | 0 of 1450 | 5 | 0.0, 0.23 | yes |
| soup_spoon_02 | soup_spoon_190 | lower | -37, -158, 80 | iec_oat_flakes 0.00 of 22.59 | 0.00 | 0 of 1450 | 5 | 0.0, 0.34 | yes |
| soup_spoon_03 | soup_spoon_190 | lower | 51, -46, 79 | iec_oat_flakes 0.00 of 25.65 | 0.00 | 0 of 1450 | 5 | 0.0, 0.22 | yes |
| soup_spoon_04 | soup_spoon_190 | lower | 63, -146, 81 | iec_oat_flakes 0.04 of 22.86 | 0.04 | 4 of 1450 | 3 | 0.0, 0.33 | no |
| soup_spoon_05 | soup_spoon_190 | lower | -44, -66, 79 | iec_oat_flakes 0.00 of 21.99 | 0.00 | 0 of 1450 | 5 | 0.0, 0.37 | yes |
| soup_spoon_06 | soup_spoon_190 | lower | 5, -32, 80 | iec_oat_flakes 0.00 of 22.63 | 0.00 | 0 of 1450 | 5 | 0.0, 0.28 | yes |
| soup_spoon_07 | soup_spoon_190 | lower | 14, -131, 78 | iec_oat_flakes 0.00 of 22.45 | 0.00 | 0 of 1451 | 5 | 0.0, 0.37 | yes |
| soup_spoon_08 | soup_spoon_190 | lower | 33, -133, 79 | iec_oat_flakes 0.00 of 25.54 | 0.00 | 0 of 1450 | 5 | 0.0, 0.34 | yes |
| soup_spoon_09 | soup_spoon_190 | lower | -40, -122, 79 | iec_oat_flakes 0.00 of 23.02 | 0.00 | 0 of 1450 | 5 | 0.0, 0.26 | yes |
| soup_spoon_10 | soup_spoon_190 | lower | 25, -172, 79 | iec_oat_flakes 0.00 of 25.96 | 0.00 | 0 of 1450 | 5 | 0.0, 0.45 | yes |
| soup_spoon_11 | soup_spoon_190 | lower | 7, -46, 80 | iec_oat_flakes 0.00 of 24.52 | 0.00 | 0 of 1451 | 5 | 0.0, 0.26 | yes |
| soup_spoon_12 | soup_spoon_190 | lower | 15, -180, 80 | iec_oat_flakes 0.00 of 21.81 | 0.00 | 0 of 1450 | 5 | 0.0, 0.57 | yes |
| soup_spoon_13 | soup_spoon_190 | lower | 15, -177, 80 | iec_oat_flakes 0.00 of 22.84 | 0.00 | 0 of 1450 | 5 | 0.0, 0.63 | yes |
| teaspoon_01 | teaspoon_130 | lower | 36, -219, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
| teaspoon_02 | teaspoon_130 | lower | -29, -31, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_03 | teaspoon_130 | lower | -5, -132, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| teaspoon_04 | teaspoon_130 | lower | 11, -117, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| teaspoon_05 | teaspoon_130 | lower | 65, -202, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| teaspoon_06 | teaspoon_130 | lower | 13, -71, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| teaspoon_07 | teaspoon_130 | lower | 0, -112, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.34 | yes |
| teaspoon_08 | teaspoon_130 | lower | -29, -168, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| teaspoon_09 | teaspoon_130 | lower | 10, -72, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.32 | yes |
| teaspoon_10 | teaspoon_130 | lower | 1, -108, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.31 | yes |
| teaspoon_11 | teaspoon_130 | lower | 66, -245, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_12 | teaspoon_130 | lower | 69, -224, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_13 | teaspoon_130 | lower | 59, -201, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
