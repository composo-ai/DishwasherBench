# Demonstration wash: iec-13-careless

The same IEC load, loaded with the common mistakes.

Machine bosch_smv4hax40g, programme auto_145 (145 min, 3971 ticks), tier official, 118 items (22 of the offer left on the counter by the loading physics), simulator spotless-sim 0.4.1 water-5, exposure on the gpu.

Mistakes in this load: plate_facing_away x 2, spoons_nested x 6, cup_upright x 5, cup_on_side x 6, bowl_face_down_flat x 1, item_over_others x 1, tablet_tray_blocked x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 11.3 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 385.7 s |
| Time, soil | 1.5 s |
| Time, replay | 70.4 s |
| Time, result | 10.4 s |
| Time, total | 479.4 s (8.0 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 1165254 blocks, 3748368 soil cells, 635300 deposits |
| GPU memory | scene 165.3 MB, peak of all buffers 165.3 MB |
| Process memory (RSS) | 1.57 GB |
| Mains water, energy | 11.5 L, 1.04 kWh |
| Water held in vessels | 1613 mL |
| Detergent | 5.4 of 12.9 g dissolved (dispenser blocked) |
| Soil | 31.75 g dry at the start, 21.68 g left (68 %) |
| Items clean | 39 of 118 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 990 s | lower 40 rpm | 0.7050 | 0.5349 | 0.0316 | 0.1379 | 0.1689 | 0.0012 | 99.94 % | 0.352 kg | 0.121 kg | yes |
| l@3000 | 1921 s | lower 42 rpm | 0.7173 | 0.5406 | 0.0360 | 0.1400 | 0.1755 | 0.0012 | 99.93 % | 0.362 kg | 0.121 kg | yes |
| ur@2800 | 924 s | upper 27 rpm | 0.9484 | 0.4713 | 0.0529 | 0.1380 | 0.4766 | 0.0005 | 99.96 % | 0.400 kg | 0.123 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4460 | 0.0501 | 0.1304 | 0.4531 | 0.0004 | 99.95 % | 0.411 kg | 0.123 kg | yes |

## What the wash reports

- placement: glass_05 cuts 0.9 mm into glass_06; both are simulated where they were placed

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -101, 135, 534 | iec_spinach 66.60 of 162.62 | 66.60 | 8829 of 10011 | 0 | 0.0, 2.34 | no |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -82, 86, 493 | iec_oat_flakes 48.50 of 147.76 | 48.50 | 7683 of 10011 | 0 | 0.0, 1.56 | no |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -104, -138, 201 | iec_egg_yolk 952.25 of 981.77 | 952.25 | 9149 of 9149 | 0 | 0.0, 1.00 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 221, 112, 158 | iec_spinach 66.83 of 156.30 | 66.83 | 8481 of 9148 | 0 | 0.0, 1.10 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 913.26 of 946.62 | 913.26 | 9149 of 9149 | 0 | 0.0, 0.99 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 174, 112, 163 | iec_spinach 80.06 of 157.45 | 80.06 | 8860 of 9149 | 0 | 0.0, 1.02 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 906.33 of 937.66 | 906.33 | 9149 of 9149 | 0 | 0.0, 1.03 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 138, 112, 163 | iec_spinach 69.76 of 156.82 | 69.76 | 8627 of 9149 | 0 | 0.0, 0.93 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 929.24 of 961.98 | 929.24 | 9148 of 9148 | 0 | 0.0, 1.03 | no |
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
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 1337.56 of 1397.95 | 1337.56 | 15968 of 15968 | 0 | 0.0, 1.85 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 560.53 of 620.48 | 560.53 | 15968 of 15968 | 0 | 0.0, 1.87 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_egg_yolk 1442.44 of 1498.61 | 1442.44 | 15968 of 15968 | 0 | 0.0, 1.92 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 543.69 of 595.63 | 543.69 | 15968 of 15968 | 0 | 0.0, 1.93 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 1542.03 of 1599.23 | 1542.03 | 15968 of 15968 | 0 | 0.0, 1.71 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 597.66 of 657.36 | 597.66 | 15968 of 15968 | 0 | 0.0, 1.78 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -79, 112, 199 | iec_egg_yolk 1449.29 of 1508.95 | 1449.29 | 15968 of 15968 | 0 | 0.0, 1.79 | no |
| fork_01 | dinner_fork_185 | lower | -17, -220, 79 | iec_egg_yolk 157.41 of 161.31 | 157.41 | 1095 of 1095 | 0 | 0.0, 0.29 | no |
| fork_02 | dinner_fork_185 | lower | 59, -50, 81 | iec_egg_yolk 138.82 of 142.54 | 138.82 | 1093 of 1093 | 0 | 0.0, 0.20 | no |
| fork_03 | dinner_fork_185 | lower | 16, -176, 80 | iec_egg_yolk 135.11 of 138.79 | 135.11 | 1095 of 1095 | 0 | 0.0, 0.23 | no |
| fork_04 | dinner_fork_185 | lower | 7, -52, 81 | iec_egg_yolk 136.71 of 140.56 | 136.71 | 1093 of 1093 | 0 | 0.0, 0.23 | no |
| fork_05 | dinner_fork_185 | lower | 3, -176, 80 | iec_egg_yolk 144.33 of 147.97 | 144.33 | 1094 of 1094 | 0 | 0.0, 0.17 | no |
| fork_06 | dinner_fork_185 | lower | 1, -26, 81 | iec_egg_yolk 146.36 of 150.22 | 146.36 | 1093 of 1093 | 0 | 0.0, 0.24 | no |
| fork_07 | dinner_fork_185 | lower | -11, -208, 80 | iec_egg_yolk 147.51 of 151.39 | 147.51 | 1094 of 1094 | 0 | 0.0, 0.22 | no |
| fork_08 | dinner_fork_185 | lower | -20, -155, 80 | iec_egg_yolk 150.67 of 153.77 | 150.67 | 1094 of 1094 | 0 | 0.0, 0.25 | no |
| fork_09 | dinner_fork_185 | lower | 1, -231, 80 | iec_egg_yolk 147.50 of 151.19 | 147.50 | 1095 of 1095 | 0 | 0.0, 0.40 | no |
| fork_11 | dinner_fork_185 | lower | 5, -225, 80 | iec_egg_yolk 152.99 of 156.66 | 152.99 | 1095 of 1095 | 0 | 0.0, 0.38 | no |
| fork_12 | dinner_fork_185 | lower | 4, -210, 79 | iec_egg_yolk 139.99 of 143.69 | 139.99 | 1095 of 1095 | 0 | 0.0, 0.22 | no |
| fork_13 | dinner_fork_185 | lower | 1, -237, 79 | iec_egg_yolk 145.84 of 149.55 | 145.84 | 1094 of 1094 | 0 | 0.0, 0.33 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 103, 131, 550 | iec_milk 481.43 of 518.45 | 481.43 | 10611 of 10611 | 0 | 0.0, 1.24 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 120, 206, 440 | iec_milk 491.01 of 492.68 | 491.01 | 10611 of 10611 | 0 | 261.3, 1.05 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 116, 73, 547 | iec_milk 464.27 of 504.83 | 464.27 | 10611 of 10611 | 0 | 0.0, 1.20 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 84, -5, 503 | iec_milk 490.91 of 497.75 | 490.91 | 10611 of 10611 | 0 | 90.3, 1.52 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 120, -56, 511 | iec_milk 458.53 of 482.09 | 458.53 | 10611 of 10611 | 0 | 1.2, 2.84 | no |
| glass_06 | test_glass_borosilicate_250 | upper | 99, -145, 455 | iec_milk 485.64 of 521.99 | 485.64 | 10611 of 10611 | 0 | 0.0, 4.10 | no |
| glass_07 | test_glass_borosilicate_250 | upper | 43, 56, 559 | iec_milk 462.94 of 503.45 | 462.94 | 10611 of 10611 | 0 | 0.0, 2.07 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -149, 56, 449 | iec_milk 495.56 of 511.88 | 495.56 | 10611 of 10611 | 0 | 283.2, 1.76 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -38, -153, 583 | iec_milk 464.36 of 493.39 | 464.36 | 10611 of 10611 | 0 | 0.0, 0.96 | no |
| glass_10 | test_glass_borosilicate_250 | upper | -181, 142, 570 | iec_milk 500.18 of 529.87 | 500.18 | 10611 of 10611 | 0 | 0.0, 3.05 | no |
| glass_11 | test_glass_borosilicate_250 | upper | -181, -212, 450 | iec_milk 517.49 of 519.13 | 517.49 | 10611 of 10611 | 0 | 293.5, 3.56 | no |
| glass_12 | test_glass_borosilicate_250 | upper | -199, -138, 450 | iec_milk 512.39 of 513.77 | 512.39 | 10611 of 10611 | 0 | 293.5, 3.56 | no |
| glass_13 | test_glass_borosilicate_250 | upper | -35, 206, 487 | iec_milk 490.10 of 521.65 | 490.10 | 10611 of 10611 | 0 | 0.0, 1.67 | no |
| knife_01 | dinner_knife_210 | lower | 0, -244, 79 | iec_margarine 0.00 of 235.35 | 0.00 | 0 of 2335 | 5 | 0.0, 0.54 | yes |
| knife_02 | dinner_knife_210 | lower | -7, -246, 94 | iec_margarine 0.95 of 252.15 | 0.95 | 10 of 2335 | 3 | 0.0, 0.40 | no |
| knife_03 | dinner_knife_210 | lower | 37, -116, 78 | iec_margarine 0.00 of 245.78 | 0.00 | 0 of 2335 | 5 | 0.0, 0.22 | yes |
| knife_04 | dinner_knife_210 | lower | 49, -237, 80 | iec_margarine 0.06 of 235.88 | 0.06 | 4 of 2334 | 4 | 0.0, 0.31 | yes |
| knife_05 | dinner_knife_210 | lower | 8, -131, 82 | iec_margarine 0.00 of 253.57 | 0.00 | 0 of 2335 | 5 | 0.0, 0.33 | yes |
| knife_06 | dinner_knife_210 | lower | 14, -66, 78 | iec_margarine 0.00 of 249.93 | 0.00 | 0 of 2335 | 5 | 0.0, 0.24 | yes |
| knife_07 | dinner_knife_210 | lower | 45, -171, 78 | iec_margarine 0.00 of 240.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.45 | yes |
| knife_08 | dinner_knife_210 | lower | 37, -173, 78 | iec_margarine 0.00 of 235.55 | 0.00 | 0 of 2335 | 5 | 0.0, 0.43 | yes |
| knife_09 | dinner_knife_210 | lower | 25, -162, 78 | iec_margarine 0.00 of 247.76 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_10 | dinner_knife_210 | lower | -22, -38, 80 | iec_margarine 0.00 of 267.65 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_11 | dinner_knife_210 | lower | -39, -154, 79 | iec_margarine 0.00 of 262.46 | 0.00 | 0 of 2335 | 5 | 0.0, 0.51 | yes |
| knife_12 | dinner_knife_210 | lower | -31, -146, 79 | iec_margarine 0.86 of 223.39 | 0.86 | 25 of 2334 | 2 | 0.0, 0.47 | no |
| knife_13 | dinner_knife_210 | lower | -47, -149, 79 | iec_margarine 0.04 of 256.88 | 0.04 | 4 of 2335 | 3 | 0.0, 0.28 | no |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -28, 512 | iec_spinach 31.58 of 143.79 | 31.58 | 6821 of 10935 | 0 | 0.0, 1.32 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | 67, 14, 559 | iec_minced_meat 379.48 of 421.65 | 379.48 | 10935 of 10935 | 0 | 54.4, 13.41 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -82, -65, 512 | iec_spinach 41.57 of 153.58 | 41.57 | 8004 of 10935 | 0 | 0.0, 1.33 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -81, -83, 512 | iec_minced_meat 365.44 of 403.84 | 365.44 | 10935 of 10935 | 0 | 0.0, 1.41 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -101, 512 | iec_spinach 41.85 of 148.67 | 41.85 | 8075 of 10935 | 0 | 0.0, 1.28 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -82, -120, 513 | iec_minced_meat 380.28 of 420.20 | 380.28 | 10935 of 10935 | 0 | 0.0, 1.32 | no |
| mug_01 | mug_ceramic_300 | upper | 184, -29, 533 | iec_tea 7.44 of 9.17 | 7.44 | 12104 of 12104 | 0 | 0.0, 2.82 | no |
| mug_02 | mug_ceramic_300 | upper | 183, -171, 495 | iec_tea 9.21 of 9.69 | 9.21 | 12104 of 12104 | 0 | 330.8, 3.40 | no |
| mug_03 | mug_ceramic_300 | upper | 183, 178, 595 | iec_tea 7.82 of 10.07 | 7.82 | 12105 of 12105 | 0 | 5.0, 3.64 | no |
| mug_04 | mug_ceramic_300 | upper | 184, 137, 533 | iec_tea 8.59 of 10.52 | 8.59 | 12104 of 12104 | 0 | 0.1, 2.64 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -91, 196 | iec_margarine 0.00 of 4098.75 | 0.00 | 0 of 20245 | 5 | 0.0, 2.53 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 7.33 of 10.02 | 7.33 | 3002 of 3002 | 0 | 0.0, 0.72 | no |
| saucer_02 | saucer_porcelain_140 | lower | 122, -139, 135 | iec_tea 7.64 of 9.26 | 7.64 | 3002 of 3002 | 0 | 0.0, 0.62 | no |
| saucer_03 | saucer_porcelain_140 | lower | 101, 112, 129 | iec_tea 6.94 of 9.55 | 6.94 | 3002 of 3002 | 0 | 0.0, 0.75 | no |
| saucer_04 | saucer_porcelain_140 | lower | 13, 111, 129 | iec_tea 7.33 of 9.63 | 7.33 | 3002 of 3002 | 0 | 0.0, 0.66 | no |
| saucer_05 | saucer_porcelain_140 | upper | -82, -157, 487 | iec_tea 7.35 of 9.78 | 7.35 | 3002 of 3002 | 0 | 0.0, 0.65 | no |
| saucer_06 | saucer_porcelain_140 | upper | -81, -177, 486 | iec_tea 7.27 of 9.58 | 7.27 | 3001 of 3001 | 0 | 0.0, 0.86 | no |
| serving_fork_01 | serving_fork_210 | lower | 25, -122, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 66, -245, 82 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 43, -223, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 105.08 of 241.14 | 105.08 | 13422 of 14751 | 0 | 0.0, 1.96 | no |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -172, -140, 188 | iec_oat_flakes 120.44 of 253.28 | 120.44 | 13839 of 14750 | 0 | 0.0, 1.93 | no |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 127.01 of 256.97 | 127.01 | 13854 of 14751 | 0 | 0.0, 2.09 | no |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 199, -140, 187 | iec_oat_flakes 117.30 of 256.30 | 117.30 | 13644 of 14751 | 0 | 0.0, 1.93 | no |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 86.19 of 222.11 | 86.19 | 12639 of 14751 | 0 | 0.0, 2.02 | no |
| soup_plate_06 | soup_plate_porcelain_230 | lower | -22, 112, 194 | iec_oat_flakes 119.95 of 236.57 | 119.95 | 14012 of 14750 | 0 | 0.0, 1.77 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -10, -125, 79 | iec_oat_flakes 8.46 of 22.40 | 8.46 | 1214 of 1450 | 0 | 0.0, 0.23 | no |
| soup_spoon_02 | soup_spoon_190 | lower | -40, -159, 81 | iec_oat_flakes 9.62 of 22.59 | 9.62 | 1302 of 1450 | 0 | 0.0, 0.38 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 9, -33, 80 | iec_oat_flakes 10.45 of 25.65 | 10.45 | 1248 of 1450 | 0 | 0.0, 0.25 | no |
| soup_spoon_04 | soup_spoon_190 | lower | 44, -146, 80 | iec_oat_flakes 9.37 of 22.86 | 9.37 | 1291 of 1450 | 0 | 0.0, 0.27 | no |
| soup_spoon_05 | soup_spoon_190 | lower | -47, -70, 79 | iec_oat_flakes 8.17 of 21.99 | 8.17 | 1190 of 1450 | 0 | 0.0, 0.30 | no |
| soup_spoon_06 | soup_spoon_190 | lower | -13, -26, 81 | iec_oat_flakes 8.42 of 22.63 | 8.42 | 1197 of 1450 | 0 | 0.0, 0.37 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 14, -129, 79 | iec_oat_flakes 8.79 of 22.45 | 8.79 | 1275 of 1451 | 0 | 0.0, 0.38 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 20, -110, 79 | iec_oat_flakes 10.64 of 25.54 | 10.64 | 1271 of 1450 | 0 | 0.0, 0.39 | no |
| soup_spoon_09 | soup_spoon_190 | lower | 7, -212, 79 | iec_oat_flakes 9.62 of 23.02 | 9.62 | 1320 of 1450 | 0 | 0.0, 0.39 | no |
| soup_spoon_10 | soup_spoon_190 | lower | 16, -164, 79 | iec_oat_flakes 11.42 of 25.96 | 11.42 | 1325 of 1450 | 0 | 0.0, 0.40 | no |
| soup_spoon_11 | soup_spoon_190 | lower | -17, -36, 79 | iec_oat_flakes 13.00 of 24.52 | 13.00 | 1319 of 1451 | 0 | 0.0, 0.70 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 25, -178, 79 | iec_oat_flakes 7.92 of 21.81 | 7.92 | 1193 of 1450 | 0 | 0.0, 0.29 | no |
| soup_spoon_13 | soup_spoon_190 | lower | -18, -32, 79 | iec_oat_flakes 8.82 of 22.84 | 8.82 | 1221 of 1450 | 0 | 0.0, 0.60 | no |
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
