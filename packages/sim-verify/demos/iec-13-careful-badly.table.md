# Demonstration wash: iec-13-careful-badly

The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully. The same items loaded badly by rule, without settling them again: plates turned round, soup plates nested, mugs, cups and glasses mouth up, the dispenser kept shut.

Machine bosch_smv4hax40g, programme eco_50 (409 min, 9836 ticks), tier official, 114 items (26 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 13, bowls_nested x 3, cup_upright x 12, tablet_tray_blocked x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 10.3 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 74.8 s |
| Time, soil | 1.5 s |
| Time, replay | 86.2 s |
| Time, result | 8.4 s |
| Time, total | 181.4 s (3.0 min) |
| Exposure sets | 1 computed, 11 from the cache |
| Scene | 1115120 blocks, 3550840 soil cells, 592485 deposits |
| GPU memory | scene 167.3 MB, peak of all buffers 167.3 MB |
| Process memory (RSS) | 1.10 GB |
| Mains water, energy | 10.5 L, 0.62 kWh |
| Water held in vessels | 3671 mL |
| Detergent | 6.4 of 12.9 g dissolved (dispenser blocked) |
| Soil | 29.26 g dry at the start, 9.71 g left (33 %) |
| Items clean | 35 of 114 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 810 s | lower 40 rpm | 0.7050 | 0.5367 | 0.0370 | 0.1306 | 0.1672 | 0.0011 | 99.92 % | 0.332 kg | 0.135 kg | yes |
| l@2800~25 | 276 s | lower 23 rpm | 0.5827 | 0.4446 | 0.0190 | 0.1174 | 0.1355 | 0.0027 | 99.99 % | 0.249 kg | 0.128 kg | yes |
| l@2800~0 | 204 s | lower stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| l@3000~50 | 6439 s | lower 33 rpm | 0.6375 | 0.4933 | 0.0247 | 0.1188 | 0.1431 | 0.0011 | 99.95 % | 0.301 kg | 0.135 kg | yes |
| l@3000~25 | 761 s | lower 28 rpm | 0.5231 | 0.3985 | 0.0162 | 0.1065 | 0.1221 | 0.0026 | 99.97 % | 0.261 kg | 0.131 kg | yes |
| ur@2800 | 735 s | upper 27 rpm | 0.9484 | 0.4752 | 0.0509 | 0.1362 | 0.4721 | 0.0010 | 99.98 % | 0.413 kg | 0.136 kg | yes |
| ur@2800~25 | 4 s | upper stalled | 0.2870 | 0.1854 | 0.0156 | 0.0302 | 0.1014 | 0.0002 | 99.98 % | 0.225 kg | 0.121 kg | yes |
| ur@2800~0 | 416 s | upper stalled | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.00 % | 0.000 kg | 0.000 kg | yes |
| ur@3000~50 | 3083 s | upper 13 rpm | 1.3753 | 0.6982 | 0.0754 | 0.2037 | 0.6753 | 0.0018 | 99.96 % | 0.370 kg | 0.135 kg | yes |
| ur@3000~25 | 4117 s | upper stalled | 0.3408 | 0.2068 | 0.0228 | 0.0322 | 0.1338 | 0.0003 | 99.98 % | 0.247 kg | 0.122 kg | yes |

## What the wash reports

- placement: dinner_plate_01 cuts 2.0 mm into dinner_plate_02; both are simulated where they were placed
- placement: dinner_plate_02 cuts 2.0 mm into dinner_plate_03; both are simulated where they were placed
- placement: dinner_plate_03 cuts 2.0 mm into dinner_plate_04; both are simulated where they were placed
- placement: dinner_plate_04 cuts 2.1 mm into dinner_plate_05; both are simulated where they were placed
- placement: dinner_plate_05 cuts 2.0 mm into dinner_plate_06; both are simulated where they were placed
- placement: dinner_plate_06 cuts 2.1 mm into dinner_plate_07; both are simulated where they were placed
- placement: melamine_plate_05 cuts 1.5 mm into melamine_plate_06; both are simulated where they were placed
- placement: saucer_02 cuts 2.1 mm into soup_plate_05; both are simulated where they were placed
- placement: saucer_02 cuts 1.4 mm into soup_plate_06; both are simulated where they were placed
- placement: soup_plate_01 cuts 1.0 mm into soup_plate_02; both are simulated where they were placed
- placement: soup_plate_03 cuts 1.0 mm into soup_plate_04; both are simulated where they were placed
- placement: soup_plate_05 cuts 1.0 mm into soup_plate_06; both are simulated where they were placed
- machine: pump_starved: e2_pre_rinse: with 4.50 L in the machine, 3.67 L of it held by the load, the sump holds 0.32 L in diverter state "l", less than the 0.50 L the pump needs: it draws 36 % air and delivers 7.7 L/min instead of 28.4
- machine: pump_starved: e4_heat: with 5.00 L in the machine, 3.67 L of it held by the load, the sump holds 0.37 L in diverter state "ur", less than the 0.50 L the pump needs: it draws 26 % air and delivers 13.8 L/min instead of 28.4
- machine: heat_timeout: e4_heat: the liquor reached 24.5 C, not the target of 50 C, within 120 min
- machine: pump_starved: e5_hold: with 5.00 L in the machine, 3.67 L of it held by the load, the sump holds 0.37 L in diverter state "ur", less than the 0.50 L the pump needs: it draws 26 % air and delivers 13.8 L/min instead of 28.4

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -80, 117, 492 | iec_spinach 15.82 of 162.62 | 15.82 | 3115 of 10011 | 0 | 0.0, 1.04 | no |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 16.10 of 147.76 | 16.10 | 3045 of 10011 | 0 | 0.0, 0.97 | no |
| dessert_bowl_04 | dessert_bowl_vitrelle_130 | upper | -79, 7, 490 | iec_spinach 6.65 of 167.88 | 6.65 | 1364 of 10011 | 0 | 0.0, 1.05 | no |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 597.66 of 981.77 | 597.66 | 9149 of 9149 | 0 | 0.0, 1.07 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | 203, 111, 164 | iec_spinach 5.40 of 156.30 | 5.40 | 1114 of 9148 | 0 | 0.0, 1.17 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | 192, 112, 163 | iec_egg_yolk 575.04 of 946.62 | 575.04 | 9149 of 9149 | 0 | 0.0, 1.51 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | 156, 112, 167 | iec_spinach 8.67 of 157.45 | 8.67 | 1747 of 9149 | 0 | 0.0, 1.79 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | 156, 112, 163 | iec_egg_yolk 663.38 of 937.66 | 663.38 | 9149 of 9149 | 0 | 0.0, 1.81 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 120, 112, 167 | iec_spinach 38.32 of 156.82 | 38.32 | 4436 of 9149 | 0 | 0.0, 1.79 | no |
| dessert_plate_07 | dessert_plate_porcelain_190 | lower | 119, 112, 163 | iec_egg_yolk 553.06 of 961.98 | 553.06 | 9148 of 9148 | 0 | 0.0, 1.41 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -25, -43, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -5, -119, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -7, -177, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 66, -40, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.54 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 70, -39, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.53 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -21, -220, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.49 | yes |
| dessert_spoon_07 | dessert_spoon_160 | lower | -3, -233, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.32 | yes |
| dessert_spoon_08 | dessert_spoon_160 | lower | -15, -247, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
| dessert_spoon_09 | dessert_spoon_160 | lower | 32, -126, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.28 | yes |
| dessert_spoon_11 | dessert_spoon_160 | lower | 31, -159, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.23 | yes |
| dessert_spoon_12 | dessert_spoon_160 | lower | -9, -30, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| dessert_spoon_13 | dessert_spoon_160 | lower | 15, -100, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.23 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -165, 112, 201 | iec_egg_yolk 1058.18 of 1397.95 | 1058.18 | 15968 of 15968 | 0 | 0.0, 2.63 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -171, 112, 199 | iec_minced_meat 108.54 of 620.48 | 108.54 | 8521 of 15968 | 0 | 0.0, 2.92 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -129, 112, 201 | iec_egg_yolk 1000.85 of 1498.61 | 1000.85 | 15968 of 15968 | 0 | 0.0, 2.77 | no |
| dinner_plate_04 | dinner_plate_porcelain_iec | lower | -134, 112, 199 | iec_minced_meat 149.79 of 595.63 | 149.79 | 11236 of 15968 | 0 | 0.0, 2.81 | no |
| dinner_plate_05 | dinner_plate_porcelain_iec | lower | -92, 112, 201 | iec_egg_yolk 1186.13 of 1599.23 | 1186.13 | 15968 of 15968 | 0 | 0.0, 2.85 | no |
| dinner_plate_06 | dinner_plate_porcelain_iec | lower | -98, 112, 199 | iec_minced_meat 88.42 of 657.36 | 88.42 | 6704 of 15968 | 0 | 0.0, 3.08 | no |
| dinner_plate_07 | dinner_plate_porcelain_iec | lower | -56, 112, 201 | iec_egg_yolk 1084.43 of 1508.95 | 1084.43 | 15968 of 15968 | 0 | 0.0, 2.61 | no |
| fork_01 | dinner_fork_185 | lower | -23, -220, 79 | iec_egg_yolk 124.16 of 161.31 | 124.16 | 1095 of 1095 | 0 | 0.0, 0.37 | no |
| fork_02 | dinner_fork_185 | lower | 64, -31, 81 | iec_egg_yolk 97.43 of 142.54 | 97.43 | 1093 of 1093 | 0 | 0.0, 0.18 | no |
| fork_03 | dinner_fork_185 | lower | 16, -183, 80 | iec_egg_yolk 95.57 of 138.79 | 95.57 | 1095 of 1095 | 0 | 0.0, 0.28 | no |
| fork_04 | dinner_fork_185 | lower | 5, -47, 80 | iec_egg_yolk 95.30 of 140.56 | 95.30 | 1093 of 1093 | 0 | 0.0, 0.17 | no |
| fork_05 | dinner_fork_185 | lower | 3, -176, 80 | iec_egg_yolk 109.04 of 147.97 | 109.04 | 1094 of 1094 | 0 | 0.0, 0.27 | no |
| fork_06 | dinner_fork_185 | lower | 3, -34, 80 | iec_egg_yolk 103.41 of 150.22 | 103.41 | 1093 of 1093 | 0 | 0.0, 0.25 | no |
| fork_07 | dinner_fork_185 | lower | -17, -218, 79 | iec_egg_yolk 117.09 of 151.39 | 117.09 | 1094 of 1094 | 0 | 0.0, 0.50 | no |
| fork_08 | dinner_fork_185 | lower | -23, -160, 79 | iec_egg_yolk 120.29 of 153.77 | 120.29 | 1094 of 1094 | 0 | 0.0, 0.39 | no |
| fork_09 | dinner_fork_185 | lower | 2, -242, 80 | iec_egg_yolk 111.10 of 151.19 | 111.10 | 1095 of 1095 | 0 | 0.0, 0.35 | no |
| fork_11 | dinner_fork_185 | lower | 7, -231, 80 | iec_egg_yolk 120.20 of 156.66 | 120.20 | 1095 of 1095 | 0 | 0.0, 0.35 | no |
| fork_12 | dinner_fork_185 | lower | 7, -209, 80 | iec_egg_yolk 101.97 of 143.69 | 101.97 | 1095 of 1095 | 0 | 0.0, 0.17 | no |
| fork_13 | dinner_fork_185 | lower | 3, -245, 80 | iec_egg_yolk 110.15 of 149.55 | 110.15 | 1094 of 1094 | 0 | 0.0, 0.20 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 96, 140, 425 | iec_milk 14.70 of 518.45 | 147.32 | 3975 of 10611 | 0 | 293.5, 2.79 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 88, 9, 424 | iec_milk 2.67 of 492.68 | 84.93 | 2754 of 10611 | 0 | 293.5, 2.91 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 89, -65, 426 | iec_milk 5.06 of 504.83 | 89.26 | 3034 of 10611 | 0 | 293.5, 2.82 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 88, -139, 425 | iec_milk 22.71 of 497.75 | 247.07 | 4722 of 10611 | 0 | 293.5, 2.78 | no |
| glass_05 | test_glass_borosilicate_250 | upper | -191, 83, 430 | iec_milk 12.39 of 482.09 | 263.42 | 3797 of 10611 | 0 | 293.5, 2.58 | no |
| glass_06 | test_glass_borosilicate_250 | upper | -192, 196, 433 | iec_milk 237.96 of 521.99 | 811.16 | 12956 of 10611 | 0 | 293.5, 2.55 | no |
| glass_07 | test_glass_borosilicate_250 | upper | -209, -158, 421 | iec_milk 231.42 of 503.45 | 683.27 | 12972 of 10611 | 0 | 293.5, 4.03 | no |
| glass_08 | test_glass_borosilicate_250 | upper | -194, -215, 431 | iec_milk 355.70 of 511.88 | 709.17 | 13075 of 10611 | 0 | 293.5, 2.80 | no |
| knife_01 | dinner_knife_210 | lower | -16, -163, 79 | iec_margarine 1.15 of 235.35 | 1.15 | 26 of 2335 | 2 | 0.0, 0.37 | no |
| knife_02 | dinner_knife_210 | lower | -10, -214, 80 | iec_margarine 0.39 of 252.15 | 0.39 | 47 of 2335 | 2 | 0.0, 0.42 | no |
| knife_03 | dinner_knife_210 | lower | 51, -116, 79 | iec_margarine 0.02 of 245.78 | 0.02 | 0 of 2335 | 5 | 0.0, 0.24 | yes |
| knife_04 | dinner_knife_210 | lower | 47, -237, 80 | iec_margarine 1.42 of 235.88 | 1.42 | 89 of 2334 | 1 | 0.0, 0.36 | no |
| knife_05 | dinner_knife_210 | lower | 7, -128, 82 | iec_margarine 0.03 of 253.57 | 0.03 | 0 of 2335 | 5 | 0.0, 0.37 | yes |
| knife_06 | dinner_knife_210 | lower | 14, -39, 79 | iec_margarine 0.05 of 249.93 | 0.05 | 3 of 2335 | 4 | 0.0, 0.24 | yes |
| knife_07 | dinner_knife_210 | lower | 67, -168, 79 | iec_margarine 0.09 of 240.88 | 0.09 | 0 of 2335 | 5 | 0.0, 0.40 | yes |
| knife_08 | dinner_knife_210 | lower | 56, -169, 79 | iec_margarine 0.13 of 235.55 | 0.13 | 3 of 2335 | 4 | 0.0, 0.36 | yes |
| knife_09 | dinner_knife_210 | lower | 45, -164, 78 | iec_margarine 0.01 of 247.76 | 0.01 | 0 of 2335 | 5 | 0.0, 0.35 | yes |
| knife_10 | dinner_knife_210 | lower | -13, -46, 80 | iec_margarine 0.04 of 267.65 | 0.04 | 3 of 2335 | 4 | 0.0, 0.29 | yes |
| knife_11 | dinner_knife_210 | lower | -36, -153, 79 | iec_margarine 2.15 of 262.46 | 2.15 | 107 of 2335 | 1 | 0.0, 0.61 | no |
| knife_12 | dinner_knife_210 | lower | -33, -146, 79 | iec_margarine 1.04 of 223.39 | 1.04 | 18 of 2334 | 3 | 0.0, 0.50 | no |
| knife_13 | dinner_knife_210 | lower | -47, -149, 79 | iec_margarine 1.83 of 256.88 | 1.83 | 191 of 2335 | 1 | 0.0, 0.22 | no |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -85, -40, 516 | iec_spinach 0.60 of 143.79 | 0.60 | 174 of 10935 | 1 | 0.0, 0.87 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -43, 513 | iec_minced_meat 50.16 of 421.65 | 50.16 | 4565 of 10935 | 0 | 0.0, 1.27 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -84, -76, 516 | iec_spinach 2.06 of 153.58 | 2.06 | 534 of 10935 | 0 | 0.0, 0.84 | no |
| melamine_plate_04 | melamine_dessert_plate_iec_195 | upper | -82, -79, 513 | iec_minced_meat 65.30 of 403.84 | 65.30 | 5574 of 10935 | 0 | 0.0, 1.40 | no |
| melamine_plate_05 | melamine_dessert_plate_iec_195 | upper | -81, -112, 518 | iec_spinach 4.75 of 148.67 | 4.75 | 1156 of 10935 | 0 | 0.0, 2.67 | no |
| melamine_plate_06 | melamine_dessert_plate_iec_195 | upper | -86, -113, 516 | iec_minced_meat 97.68 of 420.20 | 97.68 | 7374 of 10935 | 0 | 0.0, 3.08 | no |
| mug_01 | mug_ceramic_300 | upper | 161, 172, 433 | iec_tea 2.45 of 2.76 | 332.33 | 28835 of 12104 | 0 | 330.8, 3.48 | no |
| mug_02 | mug_ceramic_300 | upper | 160, 61, 432 | iec_tea 2.52 of 2.92 | 142.71 | 19486 of 12104 | 0 | 330.8, 3.50 | no |
| mug_03 | mug_ceramic_300 | upper | 161, -60, 432 | iec_tea 2.62 of 3.03 | 206.36 | 24122 of 12105 | 0 | 330.8, 3.48 | no |
| mug_04 | mug_ceramic_300 | upper | 161, -176, 433 | iec_tea 2.82 of 3.17 | 352.41 | 29264 of 12104 | 0 | 330.8, 3.45 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 3.63 of 4098.75 | 3.63 | 183 of 20245 | 1 | 0.0, 2.60 | no |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 0.62 of 0.75 | 0.62 | 3002 of 3002 | 0 | 0.0, 0.71 | no |
| saucer_02 | saucer_porcelain_140 | lower | 127, -139, 130 | iec_tea 0.58 of 0.69 | 0.58 | 3002 of 3002 | 0 | 0.0, 1.12 | no |
| saucer_03 | saucer_porcelain_140 | lower | 101, 111, 129 | iec_tea 0.60 of 0.72 | 0.60 | 3002 of 3002 | 0 | 0.0, 0.74 | no |
| saucer_04 | saucer_porcelain_140 | lower | 29, 112, 135 | iec_tea 0.61 of 0.72 | 0.61 | 3002 of 3002 | 0 | 0.0, 0.72 | no |
| saucer_05 | saucer_porcelain_140 | upper | -82, -160, 487 | iec_tea 0.64 of 0.73 | 0.64 | 3002 of 3002 | 0 | 0.0, 0.67 | no |
| saucer_06 | saucer_porcelain_140 | upper | -81, -164, 481 | iec_tea 0.62 of 0.72 | 0.62 | 3001 of 3001 | 0 | 0.0, 0.97 | no |
| serving_fork_01 | serving_fork_210 | lower | 22, -121, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.27 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 15, -170, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 46, -220, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.24 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -199, -140, 187 | iec_oat_flakes 6.19 of 241.14 | 6.19 | 1158 of 14751 | 0 | 0.0, 4.64 | no |
| soup_plate_02 | soup_plate_porcelain_230 | lower | -205, -140, 187 | iec_oat_flakes 34.20 of 253.28 | 34.20 | 5284 of 14750 | 0 | 0.0, 4.49 | no |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 6.83 of 256.97 | 6.83 | 1222 of 14751 | 0 | 0.0, 4.75 | no |
| soup_plate_04 | soup_plate_porcelain_230 | lower | 228, -140, 189 | iec_oat_flakes 33.77 of 256.30 | 33.77 | 5291 of 14751 | 0 | 0.0, 4.55 | no |
| soup_plate_05 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 2.85 of 222.11 | 2.85 | 605 of 14751 | 0 | 0.0, 4.98 | no |
| soup_plate_06 | soup_plate_porcelain_230 | lower | 177, -140, 188 | iec_oat_flakes 15.23 of 236.57 | 15.23 | 2633 of 14750 | 0 | 0.0, 4.72 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -9, -122, 79 | iec_oat_flakes 0.50 of 22.40 | 0.50 | 102 of 1450 | 1 | 0.0, 0.35 | no |
| soup_spoon_02 | soup_spoon_190 | lower | -40, -156, 80 | iec_oat_flakes 0.89 of 22.59 | 0.89 | 183 of 1450 | 1 | 0.0, 0.42 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 46, -42, 79 | iec_oat_flakes 1.01 of 25.65 | 1.01 | 187 of 1450 | 1 | 0.0, 0.19 | no |
| soup_spoon_04 | soup_spoon_190 | lower | 62, -147, 80 | iec_oat_flakes 0.89 of 22.86 | 0.89 | 179 of 1450 | 1 | 0.0, 0.24 | no |
| soup_spoon_05 | soup_spoon_190 | lower | -42, -66, 79 | iec_oat_flakes 0.45 of 21.99 | 0.45 | 94 of 1450 | 1 | 0.0, 0.27 | no |
| soup_spoon_06 | soup_spoon_190 | lower | 1, -27, 81 | iec_oat_flakes 2.32 of 22.63 | 2.32 | 293 of 1450 | 0 | 0.0, 0.37 | no |
| soup_spoon_07 | soup_spoon_190 | lower | 15, -132, 79 | iec_oat_flakes 6.53 of 22.45 | 6.53 | 686 of 1451 | 0 | 0.0, 0.43 | no |
| soup_spoon_08 | soup_spoon_190 | lower | 40, -130, 79 | iec_oat_flakes 3.08 of 25.54 | 3.08 | 418 of 1450 | 0 | 0.0, 0.38 | no |
| soup_spoon_09 | soup_spoon_190 | lower | -36, -121, 80 | iec_oat_flakes 0.58 of 23.02 | 0.58 | 109 of 1450 | 1 | 0.0, 0.28 | no |
| soup_spoon_10 | soup_spoon_190 | lower | 39, -173, 79 | iec_oat_flakes 1.02 of 25.96 | 1.02 | 208 of 1450 | 0 | 0.0, 0.35 | no |
| soup_spoon_11 | soup_spoon_190 | lower | -10, -35, 80 | iec_oat_flakes 0.85 of 24.52 | 0.85 | 171 of 1451 | 1 | 0.0, 0.29 | no |
| soup_spoon_12 | soup_spoon_190 | lower | 25, -175, 80 | iec_oat_flakes 0.32 of 21.81 | 0.32 | 59 of 1450 | 1 | 0.0, 0.29 | no |
| soup_spoon_13 | soup_spoon_190 | lower | 44, -179, 79 | iec_oat_flakes 0.73 of 22.84 | 0.73 | 173 of 1450 | 1 | 0.0, 0.32 | no |
| teaspoon_01 | teaspoon_130 | lower | 36, -218, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| teaspoon_02 | teaspoon_130 | lower | -22, -47, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_03 | teaspoon_130 | lower | -3, -130, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_04 | teaspoon_130 | lower | 13, -122, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_05 | teaspoon_130 | lower | 65, -201, 81 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.08 | yes |
| teaspoon_06 | teaspoon_130 | lower | 10, -72, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.09 | yes |
| teaspoon_07 | teaspoon_130 | lower | -0, -111, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.08 | yes |
| teaspoon_08 | teaspoon_130 | lower | -26, -168, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.43 | yes |
| teaspoon_09 | teaspoon_130 | lower | -29, -171, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.34 | yes |
| teaspoon_10 | teaspoon_130 | lower | 29, -133, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.26 | yes |
| teaspoon_11 | teaspoon_130 | lower | 13, -111, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.40 | yes |
| teaspoon_12 | teaspoon_130 | lower | 15, -100, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| teaspoon_13 | teaspoon_130 | lower | -7, -250, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
