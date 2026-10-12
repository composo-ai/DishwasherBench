# Demonstration wash: iec-13-careful-badly

The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully. The same items loaded badly by rule, without settling them again: plates turned round, soup plates nested, mugs, cups and glasses mouth up, the dispenser kept shut.

Machine bosch_smv4hax40g, programme eco_50 (409 min, 10229 ticks), tier official, 118 items (22 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-6, exposure on the gpu.

Mistakes in this load: plate_facing_away x 13, bowls_nested x 3, cup_upright x 17, tablet_tray_blocked x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 15.2 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 447.3 s |
| Time, soil | 1.4 s |
| Time, replay | 20.1 s |
| Time, result | 8.5 s |
| Time, total | 492.6 s (8.2 min) |
| Exposure sets | 8 computed, 0 from the cache |
| Scene | 1165254 blocks, 3748368 soil cells, 635300 deposits |
| GPU memory | scene 165.2 MB, peak of all buffers 165.2 MB |
| Process memory (RSS) | 2.19 GB |
| Mains water, energy | 10.5 L, 0.59 kWh |
| Water held in vessels | 5139 mL |
| Detergent | 5.4 of 12.9 g dissolved (dispenser blocked) |
| Soil | 31.75 g dry at the start, 24.76 g left (78 %) |
| Items clean | 28 of 118 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 810 s | lower 40 rpm | 0.7050 | 0.5364 | 0.0364 | 0.1315 | 0.1674 | 0.0011 | 99.94 % | 0.357 kg | 0.156 kg | yes |
| l@2800~0 | 480 s | lower stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| l@3000~0 | 5820 s | lower stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| ur@2800 | 770 s | upper 27 rpm | 0.9484 | 0.4806 | 0.0508 | 0.1309 | 0.4673 | 0.0005 | 99.97 % | 0.438 kg | 0.157 kg | yes |
| ur@2800~0 | 420 s | upper stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| ur@3000~0 | 5880 s | upper stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |

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
- machine: pump_starved: e2_pre_rinse: with 4.50 L in the machine, 5.14 L of it held by the load, the sump holds 0.00 L in diverter state "l", less than the 0.50 L the pump needs: it draws 60 % air and delivers 0.0 L/min instead of 28.4
- machine: pump_starved: e4_heat: with 5.00 L in the machine, 5.14 L of it held by the load, the sump holds 0.00 L in diverter state "ur", less than the 0.50 L the pump needs: it draws 60 % air and delivers 0.0 L/min instead of 28.4
- machine: heat_timeout: e4_heat: the liquor reached 23.2 C, not the target of 50 C, within 120 min
- machine: pump_starved: e5_hold: with 5.00 L in the machine, 5.14 L of it held by the load, the sump holds 0.00 L in diverter state "ur", less than the 0.50 L the pump needs: it draws 60 % air and delivers 0.0 L/min instead of 28.4

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -83, 113, 489 | iec_spinach 154.41 of 162.62 | 154.41 | 10011 of 10011 | 0 | 0.0, 0.97 | no |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 139.67 of 147.76 | 139.67 | 10011 of 10011 | 0 | 0.0, 0.98 | no |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 980.02 of 981.77 | 980.02 | 9149 of 9149 | 0 | 0.0, 1.05 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 204, 112, 164 | iec_spinach 149.80 of 156.30 | 149.80 | 9148 of 9148 | 0 | 0.0, 1.23 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 945.28 of 946.62 | 945.28 | 9149 of 9149 | 0 | 0.0, 1.50 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 156, 112, 167 | iec_spinach 153.05 of 157.45 | 153.05 | 9149 of 9149 | 0 | 0.0, 1.77 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 936.22 of 937.66 | 936.22 | 9149 of 9149 | 0 | 0.0, 1.81 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 120, 112, 167 | iec_spinach 152.10 of 156.82 | 152.10 | 9149 of 9149 | 0 | 0.0, 1.77 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 960.83 of 961.98 | 960.83 | 9148 of 9148 | 0 | 0.0, 1.54 | no |
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
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -165, 112, 201 | iec_egg_yolk 1394.91 of 1397.95 | 1394.91 | 15968 of 15968 | 0 | 0.0, 2.59 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 616.72 of 620.48 | 616.72 | 15968 of 15968 | 0 | 0.0, 3.03 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -129, 112, 201 | iec_egg_yolk 1495.76 of 1498.61 | 1495.76 | 15968 of 15968 | 0 | 0.0, 2.89 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 592.18 of 595.63 | 592.18 | 15968 of 15968 | 0 | 0.0, 2.86 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -92, 112, 201 | iec_egg_yolk 1596.87 of 1599.23 | 1596.87 | 15968 of 15968 | 0 | 0.0, 2.89 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 652.93 of 657.36 | 652.93 | 15968 of 15968 | 0 | 0.0, 3.02 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -56, 112, 201 | iec_egg_yolk 1505.81 of 1508.95 | 1505.81 | 15968 of 15968 | 0 | 0.0, 2.56 | no |
| fork_01 | dinner_fork_185 | lower | -23, -220, 79 | iec_egg_yolk 161.24 of 161.31 | 161.24 | 1095 of 1095 | 0 | 0.0, 0.29 | no |
| fork_02 | dinner_fork_185 | lower | 58, -55, 81 | iec_egg_yolk 142.46 of 142.54 | 142.46 | 1093 of 1093 | 0 | 0.0, 0.21 | no |
| fork_03 | dinner_fork_185 | lower | 16, -183, 80 | iec_egg_yolk 138.75 of 138.79 | 138.75 | 1095 of 1095 | 0 | 0.0, 0.27 | no |
| fork_04 | dinner_fork_185 | lower | 6, -52, 81 | iec_egg_yolk 140.52 of 140.56 | 140.52 | 1093 of 1093 | 0 | 0.0, 0.19 | no |
| fork_05 | dinner_fork_185 | lower | 4, -176, 80 | iec_egg_yolk 147.89 of 147.97 | 147.89 | 1094 of 1094 | 0 | 0.0, 0.18 | no |
| fork_06 | dinner_fork_185 | lower | 1, -26, 81 | iec_egg_yolk 150.16 of 150.22 | 150.16 | 1093 of 1093 | 0 | 0.0, 0.27 | no |
| fork_07 | dinner_fork_185 | lower | -17, -218, 79 | iec_egg_yolk 151.21 of 151.39 | 151.21 | 1094 of 1094 | 0 | 0.0, 0.50 | no |
| fork_08 | dinner_fork_185 | lower | -23, -159, 79 | iec_egg_yolk 153.67 of 153.77 | 153.67 | 1094 of 1094 | 0 | 0.0, 0.41 | no |
| fork_09 | dinner_fork_185 | lower | 2, -241, 80 | iec_egg_yolk 151.02 of 151.19 | 151.02 | 1095 of 1095 | 0 | 0.0, 0.34 | no |
| fork_11 | dinner_fork_185 | lower | 7, -231, 80 | iec_egg_yolk 156.56 of 156.66 | 156.56 | 1095 of 1095 | 0 | 0.0, 0.34 | no |
| fork_12 | dinner_fork_185 | lower | 7, -209, 80 | iec_egg_yolk 143.63 of 143.69 | 143.63 | 1095 of 1095 | 0 | 0.0, 0.17 | no |
| fork_13 | dinner_fork_185 | lower | 3, -245, 80 | iec_egg_yolk 149.48 of 149.55 | 149.48 | 1094 of 1094 | 0 | 0.0, 0.20 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 116, 132, 425 | iec_milk 518.27 of 518.45 | 518.27 | 10611 of 10611 | 0 | 293.5, 3.07 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 118, 202, 426 | iec_milk 492.63 of 492.68 | 492.63 | 10611 of 10611 | 0 | 293.5, 2.91 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 113, 73, 424 | iec_milk 504.40 of 504.83 | 504.40 | 10611 of 10611 | 0 | 293.5, 3.11 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 110, 7, 425 | iec_milk 497.19 of 497.75 | 497.19 | 10611 of 10611 | 0 | 293.5, 2.79 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 110, -65, 424 | iec_milk 481.76 of 482.09 | 481.76 | 10611 of 10611 | 0 | 293.5, 2.84 | no |
| glass_06 | test_glass_borosilicate_250 | upper | 110, -138, 424 | iec_milk 521.83 of 521.99 | 521.83 | 10611 of 10611 | 0 | 293.5, 2.83 | no |
| glass_07 | test_glass_borosilicate_250 | upper | 41, 45, 436 | iec_milk 502.49 of 503.45 | 502.49 | 10611 of 10611 | 0 | 293.5, 3.49 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -142, 56, 438 | iec_milk 511.68 of 511.88 | 511.68 | 10611 of 10611 | 0 | 293.5, 2.68 | no |
| glass_09 | test_glass_borosilicate_250 | upper | -181, 206, 450 | iec_milk 493.30 of 493.39 | 493.30 | 10611 of 10611 | 0 | 293.5, 4.04 | no |
| glass_10 | test_glass_borosilicate_250 | upper | -181, 140, 450 | iec_milk 529.79 of 529.87 | 529.79 | 10611 of 10611 | 0 | 293.5, 3.59 | no |
| glass_11 | test_glass_borosilicate_250 | upper | -181, -212, 450 | iec_milk 519.04 of 519.13 | 519.04 | 10611 of 10611 | 0 | 293.5, 3.56 | no |
| glass_12 | test_glass_borosilicate_250 | upper | -199, -138, 450 | iec_milk 513.69 of 513.77 | 513.69 | 10611 of 10611 | 0 | 293.5, 3.61 | no |
| glass_13 | test_glass_borosilicate_250 | upper | 42, 193, 434 | iec_milk 521.44 of 521.65 | 521.44 | 10611 of 10611 | 0 | 293.5, 2.83 | no |
| knife_01 | dinner_knife_210 | lower | -16, -163, 79 | iec_margarine 14.77 of 235.35 | 14.77 | 1175 of 2335 | 0 | 0.0, 0.36 | no |
| knife_02 | dinner_knife_210 | lower | -10, -214, 80 | iec_margarine 28.42 of 252.15 | 28.42 | 1998 of 2335 | 0 | 0.0, 0.42 | no |
| knife_03 | dinner_knife_210 | lower | 47, -116, 79 | iec_margarine 14.72 of 245.78 | 14.72 | 1285 of 2335 | 0 | 0.0, 0.19 | no |
| knife_04 | dinner_knife_210 | lower | 47, -236, 80 | iec_margarine 32.39 of 235.88 | 32.39 | 2298 of 2334 | 0 | 0.0, 0.38 | no |
| knife_05 | dinner_knife_210 | lower | 7, -128, 82 | iec_margarine 13.27 of 253.57 | 13.27 | 1181 of 2335 | 0 | 0.0, 0.34 | no |
| knife_06 | dinner_knife_210 | lower | 14, -66, 78 | iec_margarine 12.35 of 249.93 | 12.35 | 1156 of 2335 | 0 | 0.0, 0.24 | no |
| knife_07 | dinner_knife_210 | lower | 66, -166, 79 | iec_margarine 25.99 of 240.88 | 25.99 | 2335 of 2335 | 0 | 0.0, 0.38 | no |
| knife_08 | dinner_knife_210 | lower | 55, -170, 79 | iec_margarine 32.77 of 235.55 | 32.77 | 2333 of 2335 | 0 | 0.0, 0.36 | no |
| knife_09 | dinner_knife_210 | lower | 45, -164, 78 | iec_margarine 12.12 of 247.76 | 12.12 | 1182 of 2335 | 0 | 0.0, 0.32 | no |
| knife_10 | dinner_knife_210 | lower | -21, -48, 80 | iec_margarine 27.05 of 267.65 | 27.05 | 2313 of 2335 | 0 | 0.0, 0.34 | no |
| knife_11 | dinner_knife_210 | lower | -36, -153, 79 | iec_margarine 33.01 of 262.46 | 33.01 | 2329 of 2335 | 0 | 0.0, 0.63 | no |
| knife_12 | dinner_knife_210 | lower | -32, -146, 79 | iec_margarine 24.66 of 223.39 | 24.66 | 2326 of 2334 | 0 | 0.0, 0.51 | no |
| knife_13 | dinner_knife_210 | lower | -47, -149, 79 | iec_margarine 29.40 of 256.88 | 29.40 | 2329 of 2335 | 0 | 0.0, 0.23 | no |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -82, -27, 512 | iec_spinach 134.17 of 143.79 | 134.17 | 10920 of 10935 | 0 | 0.0, 2.12 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -32, 505 | iec_minced_meat 421.24 of 421.65 | 421.24 | 10935 of 10935 | 0 | 0.0, 2.94 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_spinach 145.68 of 153.58 | 145.68 | 10932 of 10935 | 0 | 0.0, 2.74 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -81, -69, 505 | iec_minced_meat 403.41 of 403.84 | 403.41 | 10935 of 10935 | 0 | 0.0, 3.51 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -101, 512 | iec_spinach 141.18 of 148.67 | 141.18 | 10934 of 10935 | 0 | 0.0, 1.92 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -82, -106, 506 | iec_minced_meat 419.75 of 420.20 | 419.75 | 10935 of 10935 | 0 | 0.0, 2.60 | no |
| mug_01 | mug_ceramic_300 | upper | 183, -73, 495 | iec_tea 9.09 of 9.17 | 9.09 | 12104 of 12104 | 0 | 330.8, 3.18 | no |
| mug_02 | mug_ceramic_300 | upper | 183, -168, 495 | iec_tea 9.60 of 9.69 | 9.60 | 12104 of 12104 | 0 | 283.7, 3.18 | no |
| mug_03 | mug_ceramic_300 | upper | 183, 178, 495 | iec_tea 9.96 of 10.07 | 9.96 | 12105 of 12105 | 0 | 227.1, 3.27 | no |
| mug_04 | mug_ceramic_300 | upper | 183, 86, 495 | iec_tea 10.43 of 10.52 | 10.43 | 12104 of 12104 | 0 | 311.5, 3.22 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 212.64 of 4098.75 | 212.64 | 19268 of 20245 | 0 | 0.0, 2.54 | no |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 9.58 of 10.02 | 9.58 | 3002 of 3002 | 0 | 0.0, 0.69 | no |
| saucer_02 | saucer_porcelain_140 | lower | 127, -139, 130 | iec_tea 8.67 of 9.26 | 8.67 | 3002 of 3002 | 0 | 0.0, 1.15 | no |
| saucer_03 | saucer_porcelain_140 | lower | 101, 112, 129 | iec_tea 9.02 of 9.55 | 9.02 | 3002 of 3002 | 0 | 0.0, 0.77 | no |
| saucer_04 | saucer_porcelain_140 | lower | 29, 112, 134 | iec_tea 9.28 of 9.63 | 9.28 | 3002 of 3002 | 0 | 0.0, 0.72 | no |
| saucer_05 | saucer_porcelain_140 | upper | -82, -157, 487 | iec_tea 9.41 of 9.78 | 9.41 | 3002 of 3002 | 0 | 0.0, 0.65 | no |
| saucer_06 | saucer_porcelain_140 | upper | -81, -161, 481 | iec_tea 9.16 of 9.58 | 9.16 | 3001 of 3001 | 0 | 0.0, 1.00 | no |
| serving_fork_01 | serving_fork_210 | lower | 26, -122, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.35 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 13, -170, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 45, -219, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 231.26 of 241.14 | 231.26 | 14751 of 14751 | 0 | 0.0, 4.66 | no |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -205, -140, 187 | iec_oat_flakes 232.64 of 253.28 | 232.64 | 14750 of 14750 | 0 | 0.0, 4.56 | no |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 248.11 of 256.97 | 248.11 | 14751 of 14751 | 0 | 0.0, 4.85 | no |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 228, -140, 189 | iec_oat_flakes 236.04 of 256.30 | 236.04 | 14751 of 14751 | 0 | 0.0, 4.59 | no |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 209.67 of 222.11 | 209.67 | 14751 of 14751 | 0 | 0.0, 4.90 | no |
| soup_plate_06 | soup_plate_porcelain_230 | lower | 177, -140, 188 | iec_oat_flakes 212.70 of 236.57 | 212.70 | 14750 of 14750 | 0 | 0.0, 4.68 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -9, -122, 79 | iec_oat_flakes 21.61 of 22.40 | 21.61 | 1450 of 1450 | 0 | 0.0, 0.35 | no |
| soup_spoon_02 | soup_spoon_190 | lower | -40, -156, 80 | iec_oat_flakes 21.80 of 22.59 | 21.80 | 1450 of 1450 | 0 | 0.0, 0.41 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 9, -33, 80 | iec_oat_flakes 24.01 of 25.65 | 24.01 | 1450 of 1450 | 0 | 0.0, 0.23 | no |
| soup_spoon_04 | soup_spoon_190 | lower | 61, -145, 80 | iec_oat_flakes 22.04 of 22.86 | 22.04 | 1450 of 1450 | 0 | 0.0, 0.22 | no |
| soup_spoon_05 | soup_spoon_190 | lower | -46, -70, 79 | iec_oat_flakes 20.91 of 21.99 | 20.91 | 1449 of 1450 | 0 | 0.0, 0.30 | no |
| soup_spoon_06 | soup_spoon_190 | lower | -14, -27, 81 | iec_oat_flakes 21.81 of 22.63 | 21.81 | 1450 of 1450 | 0 | 0.0, 0.40 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 14, -130, 79 | iec_oat_flakes 21.66 of 22.45 | 21.66 | 1451 of 1451 | 0 | 0.0, 0.39 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 21, -109, 79 | iec_oat_flakes 23.86 of 25.54 | 23.86 | 1450 of 1450 | 0 | 0.0, 0.33 | no |
| soup_spoon_09 | soup_spoon_190 | lower | -27, -120, 79 | iec_oat_flakes 22.24 of 23.02 | 22.24 | 1450 of 1450 | 0 | 0.0, 0.26 | no |
| soup_spoon_10 | soup_spoon_190 | lower | 39, -173, 79 | iec_oat_flakes 25.00 of 25.96 | 25.00 | 1450 of 1450 | 0 | 0.0, 0.29 | no |
| soup_spoon_11 | soup_spoon_190 | lower | -15, -36, 81 | iec_oat_flakes 23.73 of 24.52 | 23.73 | 1451 of 1451 | 0 | 0.0, 0.29 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 25, -175, 80 | iec_oat_flakes 21.01 of 21.81 | 21.01 | 1450 of 1450 | 0 | 0.0, 0.31 | no |
| soup_spoon_13 | soup_spoon_190 | lower | 44, -179, 79 | iec_oat_flakes 22.07 of 22.84 | 22.07 | 1450 of 1450 | 0 | 0.0, 0.31 | no |
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
