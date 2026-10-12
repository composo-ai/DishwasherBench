# Demonstration wash: iec-13-careless

The same IEC load, loaded with the common mistakes.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7448 ticks), tier official, 118 items (22 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-6, exposure on the gpu.

Mistakes in this load: plate_facing_away x 2, spoons_nested x 6, cup_upright x 5, cup_on_side x 6, bowl_face_down_flat x 1, item_over_others x 1, tablet_tray_blocked x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 9.4 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 318.2 s |
| Time, soil | 1.2 s |
| Time, replay | 84.9 s |
| Time, result | 8.8 s |
| Time, total | 422.5 s (7.0 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 1165254 blocks, 3748368 soil cells, 635300 deposits |
| GPU memory | scene 165.3 MB, peak of all buffers 165.3 MB |
| Process memory (RSS) | 1.94 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 1613 mL |
| Detergent | 5.1 of 12.9 g dissolved (dispenser blocked) |
| Soil | 31.75 g dry at the start, 19.36 g left (61 %) |
| Items clean | 40 of 118 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5349 | 0.0316 | 0.1379 | 0.1690 | 0.0011 | 99.94 % | 0.351 kg | 0.121 kg | yes |
| l@3000 | 2566 s | lower 42 rpm | 0.7173 | 0.5406 | 0.0360 | 0.1400 | 0.1756 | 0.0011 | 99.93 % | 0.361 kg | 0.121 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4713 | 0.0529 | 0.1380 | 0.4768 | 0.0003 | 99.96 % | 0.400 kg | 0.123 kg | yes |
| ur@3000 | 2580 s | upper 31 rpm | 0.8995 | 0.4460 | 0.0501 | 0.1304 | 0.4533 | 0.0002 | 99.95 % | 0.411 kg | 0.123 kg | yes |

## What the wash reports

- placement: glass_05 cuts 0.9 mm into glass_06; both are simulated where they were placed

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -101, 135, 534 | iec_spinach 16.75 of 162.62 | 16.75 | 2880 of 10011 | 0 | 0.0, 2.34 | no |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -82, 86, 493 | iec_oat_flakes 9.82 of 147.76 | 9.82 | 2007 of 10011 | 0 | 0.0, 1.56 | no |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -104, -138, 201 | iec_egg_yolk 912.41 of 981.77 | 912.41 | 9149 of 9149 | 0 | 0.0, 1.00 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 221, 112, 158 | iec_spinach 19.75 of 156.30 | 19.75 | 3620 of 9148 | 0 | 0.0, 1.10 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 867.44 of 946.62 | 867.44 | 9149 of 9149 | 0 | 0.0, 0.99 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 174, 112, 163 | iec_spinach 30.29 of 157.45 | 30.29 | 5152 of 9149 | 0 | 0.0, 1.02 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 864.80 of 937.66 | 864.80 | 9149 of 9149 | 0 | 0.0, 1.03 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 138, 112, 163 | iec_spinach 22.54 of 156.82 | 22.54 | 4060 of 9149 | 0 | 0.0, 0.93 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 885.00 of 961.98 | 885.00 | 9148 of 9148 | 0 | 0.0, 1.03 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -35, -41, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -7, -122, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -6, -176, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 66, -31, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.36 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 70, -37, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.33 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -14, -219, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.34 | yes |
| dessert_spoon_07 | dessert_spoon_160 | lower | -11, -232, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_08 | dessert_spoon_160 | lower | -16, -250, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| dessert_spoon_09 | dessert_spoon_160 | lower | 28, -131, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| dessert_spoon_11 | dessert_spoon_160 | lower | 31, -147, 153 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.31 | yes |
| dessert_spoon_12 | dessert_spoon_160 | lower | 14, -101, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| dessert_spoon_13 | dessert_spoon_160 | lower | 17, -101, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.29 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 1253.24 of 1397.95 | 1253.24 | 15968 of 15968 | 0 | 0.0, 1.85 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 476.86 of 620.48 | 476.86 | 15968 of 15968 | 0 | 0.0, 1.87 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_egg_yolk 1364.73 of 1498.61 | 1364.73 | 15968 of 15968 | 0 | 0.0, 1.92 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 468.03 of 595.63 | 468.03 | 15968 of 15968 | 0 | 0.0, 1.93 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 1462.98 of 1599.23 | 1462.98 | 15968 of 15968 | 0 | 0.0, 1.71 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 513.84 of 657.36 | 513.84 | 15968 of 15968 | 0 | 0.0, 1.78 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -79, 112, 199 | iec_egg_yolk 1367.51 of 1508.95 | 1367.51 | 15968 of 15968 | 0 | 0.0, 1.79 | no |
| fork_01 | dinner_fork_185 | lower | -17, -220, 79 | iec_egg_yolk 152.79 of 161.31 | 152.79 | 1095 of 1095 | 0 | 0.0, 0.29 | no |
| fork_02 | dinner_fork_185 | lower | 59, -50, 81 | iec_egg_yolk 134.49 of 142.54 | 134.49 | 1093 of 1093 | 0 | 0.0, 0.20 | no |
| fork_03 | dinner_fork_185 | lower | 16, -176, 80 | iec_egg_yolk 131.36 of 138.79 | 131.36 | 1095 of 1095 | 0 | 0.0, 0.23 | no |
| fork_04 | dinner_fork_185 | lower | 7, -52, 81 | iec_egg_yolk 132.44 of 140.56 | 132.44 | 1093 of 1093 | 0 | 0.0, 0.23 | no |
| fork_05 | dinner_fork_185 | lower | 3, -176, 80 | iec_egg_yolk 139.77 of 147.97 | 139.77 | 1094 of 1094 | 0 | 0.0, 0.17 | no |
| fork_06 | dinner_fork_185 | lower | 1, -26, 81 | iec_egg_yolk 140.50 of 150.22 | 140.50 | 1093 of 1093 | 0 | 0.0, 0.24 | no |
| fork_07 | dinner_fork_185 | lower | -11, -208, 80 | iec_egg_yolk 142.44 of 151.39 | 142.44 | 1094 of 1094 | 0 | 0.0, 0.22 | no |
| fork_08 | dinner_fork_185 | lower | -20, -155, 80 | iec_egg_yolk 147.23 of 153.77 | 147.23 | 1094 of 1094 | 0 | 0.0, 0.25 | no |
| fork_09 | dinner_fork_185 | lower | 1, -231, 80 | iec_egg_yolk 143.12 of 151.19 | 143.12 | 1095 of 1095 | 0 | 0.0, 0.40 | no |
| fork_11 | dinner_fork_185 | lower | 5, -225, 80 | iec_egg_yolk 148.56 of 156.66 | 148.56 | 1095 of 1095 | 0 | 0.0, 0.38 | no |
| fork_12 | dinner_fork_185 | lower | 4, -210, 79 | iec_egg_yolk 135.95 of 143.69 | 135.95 | 1095 of 1095 | 0 | 0.0, 0.22 | no |
| fork_13 | dinner_fork_185 | lower | 1, -237, 79 | iec_egg_yolk 139.79 of 149.55 | 139.79 | 1094 of 1094 | 0 | 0.0, 0.33 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 103, 131, 550 | iec_milk 426.87 of 518.45 | 426.87 | 10611 of 10611 | 0 | 0.0, 1.24 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 120, 206, 440 | iec_milk 476.22 of 492.68 | 476.22 | 10611 of 10611 | 0 | 261.3, 1.05 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 116, 73, 547 | iec_milk 407.74 of 504.83 | 407.74 | 10611 of 10611 | 0 | 0.0, 1.20 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 84, -5, 503 | iec_milk 479.17 of 497.75 | 479.17 | 10611 of 10611 | 0 | 90.3, 1.51 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 120, -56, 511 | iec_milk 448.30 of 482.09 | 448.30 | 10611 of 10611 | 0 | 1.2, 2.80 | no |
| glass_06 | test_glass_borosilicate_250 | upper | 99, -145, 455 | iec_milk 427.98 of 521.99 | 427.98 | 10611 of 10611 | 0 | 0.0, 4.09 | no |
| glass_07 | test_glass_borosilicate_250 | upper | 43, 56, 559 | iec_milk 406.76 of 503.45 | 406.76 | 10611 of 10611 | 0 | 0.0, 2.07 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -149, 56, 449 | iec_milk 410.03 of 511.88 | 410.03 | 10611 of 10611 | 0 | 283.2, 1.76 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -38, -153, 583 | iec_milk 425.02 of 493.39 | 425.02 | 10611 of 10611 | 0 | 0.0, 0.96 | no |
| glass_10 | test_glass_borosilicate_250 | upper | -181, 142, 570 | iec_milk 460.31 of 529.87 | 460.31 | 10611 of 10611 | 0 | 0.0, 3.05 | no |
| glass_11 | test_glass_borosilicate_250 | upper | -181, -212, 450 | iec_milk 495.30 of 519.13 | 495.30 | 10611 of 10611 | 0 | 293.5, 3.56 | no |
| glass_12 | test_glass_borosilicate_250 | upper | -199, -138, 450 | iec_milk 492.96 of 513.77 | 492.96 | 10611 of 10611 | 0 | 293.5, 3.56 | no |
| glass_13 | test_glass_borosilicate_250 | upper | -35, 206, 487 | iec_milk 442.01 of 521.65 | 442.01 | 10611 of 10611 | 0 | 0.0, 1.67 | no |
| knife_01 | dinner_knife_210 | lower | 0, -244, 79 | iec_margarine 0.00 of 235.35 | 0.00 | 0 of 2335 | 5 | 0.0, 0.54 | yes |
| knife_02 | dinner_knife_210 | lower | -7, -246, 94 | iec_margarine 0.97 of 252.15 | 0.97 | 10 of 2335 | 3 | 0.0, 0.40 | no |
| knife_03 | dinner_knife_210 | lower | 37, -116, 78 | iec_margarine 0.00 of 245.78 | 0.00 | 0 of 2335 | 5 | 0.0, 0.22 | yes |
| knife_04 | dinner_knife_210 | lower | 49, -237, 80 | iec_margarine 0.03 of 235.88 | 0.03 | 4 of 2334 | 4 | 0.0, 0.31 | yes |
| knife_05 | dinner_knife_210 | lower | 8, -131, 82 | iec_margarine 0.00 of 253.57 | 0.00 | 0 of 2335 | 5 | 0.0, 0.33 | yes |
| knife_06 | dinner_knife_210 | lower | 14, -66, 78 | iec_margarine 0.00 of 249.93 | 0.00 | 0 of 2335 | 5 | 0.0, 0.24 | yes |
| knife_07 | dinner_knife_210 | lower | 45, -171, 78 | iec_margarine 0.00 of 240.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.45 | yes |
| knife_08 | dinner_knife_210 | lower | 37, -173, 78 | iec_margarine 0.00 of 235.55 | 0.00 | 0 of 2335 | 5 | 0.0, 0.43 | yes |
| knife_09 | dinner_knife_210 | lower | 25, -162, 78 | iec_margarine 0.00 of 247.76 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_10 | dinner_knife_210 | lower | -22, -38, 80 | iec_margarine 0.00 of 267.65 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_11 | dinner_knife_210 | lower | -39, -154, 79 | iec_margarine 0.00 of 262.46 | 0.00 | 0 of 2335 | 5 | 0.0, 0.51 | yes |
| knife_12 | dinner_knife_210 | lower | -31, -146, 79 | iec_margarine 0.85 of 223.39 | 0.85 | 32 of 2334 | 2 | 0.0, 0.47 | no |
| knife_13 | dinner_knife_210 | lower | -47, -149, 79 | iec_margarine 0.03 of 256.88 | 0.03 | 2 of 2335 | 4 | 0.0, 0.28 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -28, 512 | iec_spinach 7.35 of 143.79 | 7.35 | 1984 of 10935 | 0 | 0.0, 1.32 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | 67, 14, 559 | iec_minced_meat 288.78 of 421.65 | 288.78 | 10925 of 10935 | 0 | 54.4, 13.41 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -82, -65, 512 | iec_spinach 11.70 of 153.58 | 11.70 | 2831 of 10935 | 0 | 0.0, 1.32 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -81, -83, 512 | iec_minced_meat 322.76 of 403.84 | 322.76 | 10933 of 10935 | 0 | 0.0, 1.41 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -101, 512 | iec_spinach 12.21 of 148.67 | 12.21 | 3013 of 10935 | 0 | 0.0, 1.28 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -82, -120, 513 | iec_minced_meat 338.68 of 420.20 | 338.68 | 10928 of 10935 | 0 | 0.0, 1.32 | no |
| mug_01 | mug_ceramic_300 | upper | 184, -29, 533 | iec_tea 7.67 of 9.17 | 7.67 | 12104 of 12104 | 0 | 0.0, 2.81 | no |
| mug_02 | mug_ceramic_300 | upper | 183, -171, 495 | iec_tea 9.21 of 9.69 | 9.21 | 12104 of 12104 | 0 | 330.8, 3.40 | no |
| mug_03 | mug_ceramic_300 | upper | 183, 178, 595 | iec_tea 7.87 of 10.07 | 7.87 | 12105 of 12105 | 0 | 5.0, 3.64 | no |
| mug_04 | mug_ceramic_300 | upper | 184, 137, 533 | iec_tea 8.45 of 10.52 | 8.45 | 12104 of 12104 | 0 | 0.0, 2.64 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -91, 196 | iec_margarine 0.00 of 4098.75 | 0.00 | 0 of 20245 | 5 | 0.0, 2.53 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 7.52 of 10.02 | 7.52 | 3002 of 3002 | 0 | 0.0, 0.72 | no |
| saucer_02 | saucer_porcelain_140 | lower | 122, -139, 135 | iec_tea 7.29 of 9.26 | 7.29 | 3002 of 3002 | 0 | 0.0, 0.62 | no |
| saucer_03 | saucer_porcelain_140 | lower | 101, 112, 129 | iec_tea 7.15 of 9.55 | 7.15 | 3002 of 3002 | 0 | 0.0, 0.75 | no |
| saucer_04 | saucer_porcelain_140 | lower | 13, 111, 129 | iec_tea 7.39 of 9.63 | 7.39 | 3002 of 3002 | 0 | 0.0, 0.66 | no |
| saucer_05 | saucer_porcelain_140 | upper | -82, -157, 487 | iec_tea 7.50 of 9.78 | 7.50 | 3002 of 3002 | 0 | 0.0, 0.65 | no |
| saucer_06 | saucer_porcelain_140 | upper | -81, -177, 486 | iec_tea 7.39 of 9.58 | 7.39 | 3001 of 3001 | 0 | 0.0, 0.86 | no |
| serving_fork_01 | serving_fork_210 | lower | 25, -122, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 66, -245, 82 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 43, -223, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 31.42 of 241.14 | 31.42 | 5416 of 14751 | 0 | 0.0, 1.96 | no |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -172, -140, 188 | iec_oat_flakes 41.10 of 253.28 | 41.10 | 6732 of 14750 | 0 | 0.0, 1.93 | no |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 49.55 of 256.97 | 49.55 | 7032 of 14751 | 0 | 0.0, 2.09 | no |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 199, -140, 187 | iec_oat_flakes 39.08 of 256.30 | 39.08 | 6203 of 14751 | 0 | 0.0, 1.93 | no |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 20.54 of 222.11 | 20.54 | 3907 of 14751 | 0 | 0.0, 2.02 | no |
| soup_plate_06 | soup_plate_porcelain_230 | lower | -22, 112, 194 | iec_oat_flakes 44.85 of 236.57 | 44.85 | 7341 of 14750 | 0 | 0.0, 1.77 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -10, -125, 79 | iec_oat_flakes 3.44 of 22.40 | 3.44 | 632 of 1450 | 0 | 0.0, 0.23 | no |
| soup_spoon_02 | soup_spoon_190 | lower | -40, -159, 81 | iec_oat_flakes 4.50 of 22.59 | 4.50 | 797 of 1450 | 0 | 0.0, 0.38 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 9, -33, 80 | iec_oat_flakes 4.57 of 25.65 | 4.57 | 699 of 1450 | 0 | 0.0, 0.25 | no |
| soup_spoon_04 | soup_spoon_190 | lower | 44, -146, 80 | iec_oat_flakes 4.09 of 22.86 | 4.09 | 745 of 1450 | 0 | 0.0, 0.27 | no |
| soup_spoon_05 | soup_spoon_190 | lower | -47, -70, 79 | iec_oat_flakes 3.32 of 21.99 | 3.32 | 620 of 1450 | 0 | 0.0, 0.30 | no |
| soup_spoon_06 | soup_spoon_190 | lower | -13, -26, 81 | iec_oat_flakes 3.43 of 22.63 | 3.43 | 609 of 1450 | 0 | 0.0, 0.37 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 14, -129, 79 | iec_oat_flakes 3.84 of 22.45 | 3.84 | 679 of 1451 | 0 | 0.0, 0.38 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 20, -110, 79 | iec_oat_flakes 4.92 of 25.54 | 4.92 | 718 of 1450 | 0 | 0.0, 0.39 | no |
| soup_spoon_09 | soup_spoon_190 | lower | 7, -212, 79 | iec_oat_flakes 4.29 of 23.02 | 4.29 | 771 of 1450 | 0 | 0.0, 0.39 | no |
| soup_spoon_10 | soup_spoon_190 | lower | 16, -164, 79 | iec_oat_flakes 5.27 of 25.96 | 5.27 | 782 of 1450 | 0 | 0.0, 0.40 | no |
| soup_spoon_11 | soup_spoon_190 | lower | -17, -36, 79 | iec_oat_flakes 3.38 of 24.52 | 3.38 | 518 of 1451 | 0 | 0.0, 0.70 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 25, -178, 79 | iec_oat_flakes 2.96 of 21.81 | 2.96 | 608 of 1450 | 0 | 0.0, 0.29 | no |
| soup_spoon_13 | soup_spoon_190 | lower | -18, -32, 79 | iec_oat_flakes 3.63 of 22.84 | 3.63 | 654 of 1450 | 0 | 0.0, 0.60 | no |
| teaspoon_01 | teaspoon_130 | lower | 36, -219, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_02 | teaspoon_130 | lower | -31, -35, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| teaspoon_03 | teaspoon_130 | lower | -4, -133, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_04 | teaspoon_130 | lower | 11, -117, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| teaspoon_05 | teaspoon_130 | lower | 65, -201, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| teaspoon_06 | teaspoon_130 | lower | 14, -77, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_07 | teaspoon_130 | lower | -3, -106, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.32 | yes |
| teaspoon_08 | teaspoon_130 | lower | -27, -168, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.37 | yes |
| teaspoon_09 | teaspoon_130 | lower | -30, -170, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.33 | yes |
| teaspoon_10 | teaspoon_130 | lower | 23, -133, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.16 | yes |
| teaspoon_11 | teaspoon_130 | lower | 0, -100, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| teaspoon_12 | teaspoon_130 | lower | 67, -227, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.08 | yes |
| teaspoon_13 | teaspoon_130 | lower | 50, -201, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
