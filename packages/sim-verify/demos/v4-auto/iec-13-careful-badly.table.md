# Demonstration wash: iec-13-careful-badly

The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully. The same items loaded badly by rule, without settling them again: plates turned round, soup plates nested, mugs, cups and glasses mouth up, the dispenser kept shut.

Machine bosch_smv4hax40g, programme auto_145 (146 min, 3961 ticks), tier official, 118 items (22 of the offer left on the counter by the loading physics), simulator spotless-sim 0.4.1 water-5, exposure on the gpu.

Mistakes in this load: plate_facing_away x 13, bowls_nested x 3, cup_upright x 17, tablet_tray_blocked x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 15.4 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 473.2 s |
| Time, soil | 2.2 s |
| Time, replay | 42.4 s |
| Time, result | 13.5 s |
| Time, total | 546.8 s (9.1 min) |
| Exposure sets | 6 computed, 0 from the cache |
| Scene | 1165254 blocks, 3748368 soil cells, 635300 deposits |
| GPU memory | scene 165.2 MB, peak of all buffers 165.2 MB |
| Process memory (RSS) | 1.87 GB |
| Mains water, energy | 12.0 L, 1.06 kWh |
| Water held in vessels | 5139 mL |
| Detergent | 5.5 of 12.9 g dissolved (dispenser blocked) |
| Soil | 31.75 g dry at the start, 22.30 g left (70 %) |
| Items clean | 38 of 118 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 630 s | lower 40 rpm | 0.7050 | 0.5364 | 0.0364 | 0.1315 | 0.1674 | 0.0012 | 99.94 % | 0.358 kg | 0.156 kg | yes |
| l@2800~0 | 360 s | lower stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| l@3000 | 1980 s | lower 42 rpm | 0.7173 | 0.5424 | 0.0404 | 0.1338 | 0.1738 | 0.0012 | 99.95 % | 0.367 kg | 0.156 kg | yes |
| ur@2800 | 588 s | upper 27 rpm | 0.9484 | 0.4806 | 0.0508 | 0.1309 | 0.4669 | 0.0008 | 99.98 % | 0.438 kg | 0.157 kg | yes |
| ur@2800~0 | 330 s | upper stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4545 | 0.0483 | 0.1237 | 0.4442 | 0.0007 | 99.98 % | 0.449 kg | 0.157 kg | yes |

## What the wash reports

- placement: dinner_plate_01 cuts 2.0 mm into dinner_plate_02; both are simulated where they were placed
- placement: dinner_plate_02 cuts 2.0 mm into dinner_plate_03; both are simulated where they were placed
- placement: dinner_plate_03 cuts 2.1 mm into dinner_plate_04; both are simulated where they were placed
- placement: dinner_plate_04 cuts 2.1 mm into dinner_plate_05; both are simulated where they were placed
- placement: dinner_plate_05 cuts 2.0 mm into dinner_plate_06; both are simulated where they were placed
- placement: dinner_plate_06 cuts 2.0 mm into dinner_plate_07; both are simulated where they were placed
- placement: glass_12 cuts 1.3 mm into melamine_plate_06; both are simulated where they were placed
- placement: saucer_02 cuts 2.1 mm into soup_plate_05; both are simulated where they were placed
- placement: saucer_02 cuts 1.4 mm into soup_plate_06; both are simulated where they were placed
- placement: soup_plate_01 cuts 1.0 mm into soup_plate_02; both are simulated where they were placed
- placement: soup_plate_03 cuts 1.0 mm into soup_plate_04; both are simulated where they were placed
- placement: soup_plate_05 cuts 1.0 mm into soup_plate_06; both are simulated where they were placed
- machine: pump_starved: a2_pre_rinse: with 4.50 L in the machine, 5.14 L of it held by the load, the sump holds 0.00 L in diverter state "l", less than the 0.50 L the pump needs: it draws 60 % air and delivers 0.0 L/min instead of 28.4

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -83, 113, 489 | iec_spinach 71.84 of 162.62 | 71.84 | 9311 of 10011 | 0 | 0.0, 0.97 | no |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 58.86 of 147.76 | 58.86 | 8638 of 10011 | 0 | 0.0, 0.98 | no |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 955.62 of 981.77 | 955.62 | 9149 of 9149 | 0 | 0.0, 1.05 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 204, 112, 164 | iec_spinach 73.58 of 156.30 | 73.58 | 8765 of 9148 | 0 | 0.0, 1.23 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 926.58 of 946.62 | 926.58 | 9149 of 9149 | 0 | 0.0, 1.50 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 156, 112, 167 | iec_spinach 99.77 of 157.45 | 99.77 | 9019 of 9149 | 0 | 0.0, 1.77 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 915.18 of 937.66 | 915.18 | 9149 of 9149 | 0 | 0.0, 1.81 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 120, 112, 167 | iec_spinach 92.91 of 156.82 | 92.91 | 9031 of 9149 | 0 | 0.0, 1.77 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 946.42 of 961.98 | 946.42 | 9148 of 9148 | 0 | 0.0, 1.54 | no |
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
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -165, 112, 201 | iec_egg_yolk 1355.09 of 1397.95 | 1355.09 | 15968 of 15968 | 0 | 0.0, 2.59 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 578.02 of 620.48 | 578.02 | 15968 of 15968 | 0 | 0.0, 3.03 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -129, 112, 201 | iec_egg_yolk 1459.77 of 1498.61 | 1459.77 | 15968 of 15968 | 0 | 0.0, 2.89 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 553.98 of 595.63 | 553.98 | 15968 of 15968 | 0 | 0.0, 2.86 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -92, 112, 201 | iec_egg_yolk 1562.28 of 1599.23 | 1562.28 | 15968 of 15968 | 0 | 0.0, 2.89 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 610.46 of 657.36 | 610.46 | 15968 of 15968 | 0 | 0.0, 3.02 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -56, 112, 201 | iec_egg_yolk 1466.37 of 1508.95 | 1466.37 | 15968 of 15968 | 0 | 0.0, 2.56 | no |
| fork_01 | dinner_fork_185 | lower | -23, -220, 79 | iec_egg_yolk 158.54 of 161.31 | 158.54 | 1095 of 1095 | 0 | 0.0, 0.29 | no |
| fork_02 | dinner_fork_185 | lower | 58, -55, 81 | iec_egg_yolk 139.63 of 142.54 | 139.63 | 1093 of 1093 | 0 | 0.0, 0.21 | no |
| fork_03 | dinner_fork_185 | lower | 16, -183, 80 | iec_egg_yolk 135.95 of 138.79 | 135.95 | 1095 of 1095 | 0 | 0.0, 0.27 | no |
| fork_04 | dinner_fork_185 | lower | 6, -52, 81 | iec_egg_yolk 137.85 of 140.56 | 137.85 | 1093 of 1093 | 0 | 0.0, 0.19 | no |
| fork_05 | dinner_fork_185 | lower | 4, -176, 80 | iec_egg_yolk 145.24 of 147.97 | 145.24 | 1094 of 1094 | 0 | 0.0, 0.18 | no |
| fork_06 | dinner_fork_185 | lower | 1, -26, 81 | iec_egg_yolk 147.41 of 150.22 | 147.41 | 1093 of 1093 | 0 | 0.0, 0.27 | no |
| fork_07 | dinner_fork_185 | lower | -17, -218, 79 | iec_egg_yolk 148.82 of 151.39 | 148.82 | 1094 of 1094 | 0 | 0.0, 0.50 | no |
| fork_08 | dinner_fork_185 | lower | -23, -159, 79 | iec_egg_yolk 151.11 of 153.77 | 151.11 | 1094 of 1094 | 0 | 0.0, 0.41 | no |
| fork_09 | dinner_fork_185 | lower | 2, -241, 80 | iec_egg_yolk 148.44 of 151.19 | 148.44 | 1095 of 1095 | 0 | 0.0, 0.34 | no |
| fork_11 | dinner_fork_185 | lower | 7, -231, 80 | iec_egg_yolk 154.11 of 156.66 | 154.11 | 1095 of 1095 | 0 | 0.0, 0.34 | no |
| fork_12 | dinner_fork_185 | lower | 7, -209, 80 | iec_egg_yolk 140.92 of 143.69 | 140.92 | 1095 of 1095 | 0 | 0.0, 0.17 | no |
| fork_13 | dinner_fork_185 | lower | 3, -245, 80 | iec_egg_yolk 146.82 of 149.55 | 146.82 | 1094 of 1094 | 0 | 0.0, 0.20 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 116, 132, 425 | iec_milk 508.73 of 518.45 | 508.73 | 10611 of 10611 | 0 | 293.5, 3.07 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 118, 202, 426 | iec_milk 490.16 of 492.68 | 490.16 | 10611 of 10611 | 0 | 293.5, 2.91 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 113, 73, 424 | iec_milk 486.44 of 504.83 | 486.44 | 10611 of 10611 | 0 | 293.5, 3.11 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 110, 7, 425 | iec_milk 476.39 of 497.75 | 476.39 | 10611 of 10611 | 0 | 293.5, 2.79 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 110, -65, 424 | iec_milk 466.25 of 482.09 | 466.25 | 10611 of 10611 | 0 | 293.5, 2.84 | no |
| glass_06 | test_glass_borosilicate_250 | upper | 110, -138, 424 | iec_milk 513.15 of 521.99 | 513.15 | 10611 of 10611 | 0 | 293.5, 2.83 | no |
| glass_07 | test_glass_borosilicate_250 | upper | 41, 45, 436 | iec_milk 476.73 of 503.45 | 476.73 | 10611 of 10611 | 0 | 293.5, 3.49 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -142, 56, 438 | iec_milk 501.16 of 511.88 | 501.16 | 10611 of 10611 | 0 | 293.5, 2.68 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -181, 206, 450 | iec_milk 491.88 of 493.39 | 491.88 | 10611 of 10611 | 0 | 293.5, 4.04 | no |
| glass_10 | test_glass_borosilicate_250 | upper | -181, 140, 450 | iec_milk 524.91 of 529.87 | 524.91 | 10611 of 10611 | 0 | 293.5, 3.59 | no |
| glass_11 | test_glass_borosilicate_250 | upper | -181, -212, 450 | iec_milk 517.26 of 519.13 | 517.26 | 10611 of 10611 | 0 | 293.5, 3.56 | no |
| glass_12 | test_glass_borosilicate_250 | upper | -199, -138, 450 | iec_milk 511.64 of 513.77 | 511.64 | 10611 of 10611 | 0 | 293.5, 3.61 | no |
| glass_13 | test_glass_borosilicate_250 | upper | 42, 193, 434 | iec_milk 510.80 of 521.65 | 510.80 | 10611 of 10611 | 0 | 293.5, 2.83 | no |
| knife_01 | dinner_knife_210 | lower | -16, -163, 79 | iec_margarine 0.01 of 235.35 | 0.01 | 3 of 2335 | 4 | 0.0, 0.36 | yes |
| knife_02 | dinner_knife_210 | lower | -10, -214, 80 | iec_margarine 0.00 of 252.15 | 0.00 | 0 of 2335 | 5 | 0.0, 0.42 | yes |
| knife_03 | dinner_knife_210 | lower | 47, -116, 79 | iec_margarine 0.00 of 245.78 | 0.00 | 0 of 2335 | 5 | 0.0, 0.19 | yes |
| knife_04 | dinner_knife_210 | lower | 47, -236, 80 | iec_margarine 0.19 of 235.88 | 0.19 | 8 of 2334 | 3 | 0.0, 0.38 | no |
| knife_05 | dinner_knife_210 | lower | 7, -128, 82 | iec_margarine 0.00 of 253.57 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_06 | dinner_knife_210 | lower | 14, -66, 78 | iec_margarine 0.00 of 249.93 | 0.00 | 0 of 2335 | 5 | 0.0, 0.24 | yes |
| knife_07 | dinner_knife_210 | lower | 66, -166, 79 | iec_margarine 0.00 of 240.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.38 | yes |
| knife_08 | dinner_knife_210 | lower | 55, -170, 79 | iec_margarine 0.44 of 235.55 | 0.44 | 49 of 2335 | 2 | 0.0, 0.36 | no |
| knife_09 | dinner_knife_210 | lower | 45, -164, 78 | iec_margarine 0.00 of 247.76 | 0.00 | 0 of 2335 | 5 | 0.0, 0.32 | yes |
| knife_10 | dinner_knife_210 | lower | -21, -48, 80 | iec_margarine 0.00 of 267.65 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_11 | dinner_knife_210 | lower | -36, -153, 79 | iec_margarine 0.05 of 262.46 | 0.05 | 11 of 2335 | 3 | 0.0, 0.63 | no |
| knife_12 | dinner_knife_210 | lower | -32, -146, 79 | iec_margarine 0.43 of 223.39 | 0.43 | 8 of 2334 | 3 | 0.0, 0.51 | no |
| knife_13 | dinner_knife_210 | lower | -47, -149, 79 | iec_margarine 0.00 of 256.88 | 0.00 | 0 of 2335 | 5 | 0.0, 0.23 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -82, -27, 512 | iec_spinach 39.64 of 143.79 | 39.64 | 7970 of 10935 | 0 | 0.0, 2.12 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -32, 505 | iec_minced_meat 393.21 of 421.65 | 393.21 | 10935 of 10935 | 0 | 0.0, 2.94 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_spinach 63.61 of 153.58 | 63.61 | 9971 of 10935 | 0 | 0.0, 2.74 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -81, -69, 505 | iec_minced_meat 376.79 of 403.84 | 376.79 | 10935 of 10935 | 0 | 0.0, 3.51 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -101, 512 | iec_spinach 63.66 of 148.67 | 63.66 | 9942 of 10935 | 0 | 0.0, 1.92 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -82, -106, 506 | iec_minced_meat 394.14 of 420.20 | 394.14 | 10935 of 10935 | 0 | 0.0, 2.60 | no |
| mug_01 | mug_ceramic_300 | upper | 183, -73, 495 | iec_tea 8.44 of 9.17 | 8.44 | 12104 of 12104 | 0 | 330.8, 3.18 | no |
| mug_02 | mug_ceramic_300 | upper | 183, -168, 495 | iec_tea 9.18 of 9.69 | 9.18 | 12104 of 12104 | 0 | 330.8, 3.18 | no |
| mug_03 | mug_ceramic_300 | upper | 183, 178, 495 | iec_tea 9.56 of 10.07 | 9.56 | 12105 of 12105 | 0 | 330.8, 3.27 | no |
| mug_04 | mug_ceramic_300 | upper | 183, 86, 495 | iec_tea 9.92 of 10.52 | 9.92 | 12104 of 12104 | 0 | 330.8, 3.22 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 0.00 of 4098.75 | 0.00 | 0 of 20245 | 5 | 0.0, 2.54 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 7.69 of 10.02 | 7.69 | 3002 of 3002 | 0 | 0.0, 0.69 | no |
| saucer_02 | saucer_porcelain_140 | lower | 127, -139, 130 | iec_tea 6.97 of 9.26 | 6.97 | 3002 of 3002 | 0 | 0.0, 1.15 | no |
| saucer_03 | saucer_porcelain_140 | lower | 101, 112, 129 | iec_tea 7.17 of 9.55 | 7.17 | 3002 of 3002 | 0 | 0.0, 0.77 | no |
| saucer_04 | saucer_porcelain_140 | lower | 29, 112, 134 | iec_tea 7.48 of 9.63 | 7.48 | 3002 of 3002 | 0 | 0.0, 0.72 | no |
| saucer_05 | saucer_porcelain_140 | upper | -82, -157, 487 | iec_tea 7.70 of 9.78 | 7.70 | 3002 of 3002 | 0 | 0.0, 0.65 | no |
| saucer_06 | saucer_porcelain_140 | upper | -81, -161, 481 | iec_tea 7.64 of 9.58 | 7.64 | 3001 of 3001 | 0 | 0.0, 1.00 | no |
| serving_fork_01 | serving_fork_210 | lower | 26, -122, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.35 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 13, -170, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 45, -219, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 112.93 of 241.14 | 112.93 | 13789 of 14751 | 0 | 0.0, 4.66 | no |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -205, -140, 187 | iec_oat_flakes 142.70 of 253.28 | 142.70 | 14260 of 14750 | 0 | 0.0, 4.56 | no |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 152.08 of 256.97 | 152.08 | 14331 of 14751 | 0 | 0.0, 4.85 | no |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 228, -140, 189 | iec_oat_flakes 164.52 of 256.30 | 164.52 | 14451 of 14751 | 0 | 0.0, 4.59 | no |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 85.64 of 222.11 | 85.64 | 12566 of 14751 | 0 | 0.0, 4.90 | no |
| soup_plate_06 | soup_plate_porcelain_230 | lower | 177, -140, 188 | iec_oat_flakes 129.42 of 236.57 | 129.42 | 13769 of 14750 | 0 | 0.0, 4.68 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -9, -122, 79 | iec_oat_flakes 9.81 of 22.40 | 9.81 | 1306 of 1450 | 0 | 0.0, 0.35 | no |
| soup_spoon_02 | soup_spoon_190 | lower | -40, -156, 80 | iec_oat_flakes 10.36 of 22.59 | 10.36 | 1344 of 1450 | 0 | 0.0, 0.41 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 9, -33, 80 | iec_oat_flakes 11.82 of 25.65 | 11.82 | 1319 of 1450 | 0 | 0.0, 0.23 | no |
| soup_spoon_04 | soup_spoon_190 | lower | 61, -145, 80 | iec_oat_flakes 10.33 of 22.86 | 10.33 | 1355 of 1450 | 0 | 0.0, 0.22 | no |
| soup_spoon_05 | soup_spoon_190 | lower | -46, -70, 79 | iec_oat_flakes 9.25 of 21.99 | 9.25 | 1278 of 1450 | 0 | 0.0, 0.30 | no |
| soup_spoon_06 | soup_spoon_190 | lower | -14, -27, 81 | iec_oat_flakes 9.92 of 22.63 | 9.92 | 1301 of 1450 | 0 | 0.0, 0.40 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 14, -130, 79 | iec_oat_flakes 9.63 of 22.45 | 9.63 | 1333 of 1451 | 0 | 0.0, 0.39 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 21, -109, 79 | iec_oat_flakes 11.64 of 25.54 | 11.64 | 1314 of 1450 | 0 | 0.0, 0.33 | no |
| soup_spoon_09 | soup_spoon_190 | lower | -27, -120, 79 | iec_oat_flakes 10.25 of 23.02 | 10.25 | 1353 of 1450 | 0 | 0.0, 0.26 | no |
| soup_spoon_10 | soup_spoon_190 | lower | 39, -173, 79 | iec_oat_flakes 12.94 of 25.96 | 12.94 | 1392 of 1450 | 0 | 0.0, 0.29 | no |
| soup_spoon_11 | soup_spoon_190 | lower | -15, -36, 81 | iec_oat_flakes 11.76 of 24.52 | 11.76 | 1362 of 1451 | 0 | 0.0, 0.29 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 25, -175, 80 | iec_oat_flakes 9.00 of 21.81 | 9.00 | 1267 of 1450 | 0 | 0.0, 0.31 | no |
| soup_spoon_13 | soup_spoon_190 | lower | 44, -179, 79 | iec_oat_flakes 10.51 of 22.84 | 10.51 | 1332 of 1450 | 0 | 0.0, 0.31 | no |
| teaspoon_01 | teaspoon_130 | lower | 36, -218, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| teaspoon_02 | teaspoon_130 | lower | -29, -43, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
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
