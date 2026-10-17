# Demonstration wash: half-careful

Half of the IEC load (six place settings), loaded carefully and well spaced.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier official, 59 items (6 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 6.4 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 308.2 s |
| Time, soil | 0.8 s |
| Time, replay | 8.3 s |
| Time, result | 1.4 s |
| Time, total | 325.1 s (5.4 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 739577 blocks, 2048668 soil cells, 347185 deposits |
| GPU memory | scene 142.2 MB, peak of all buffers 167.3 MB |
| Process memory (RSS) | 1.61 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 17.86 g dry at the start, 0.04 g left (0 %) |
| Items clean | 47 of 59 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5291 | 0.0398 | 0.1354 | 0.1747 | 0.0011 | 99.94 % | 0.227 kg | 0.057 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5354 | 0.0441 | 0.1371 | 0.1808 | 0.0011 | 99.95 % | 0.235 kg | 0.057 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4555 | 0.0619 | 0.1448 | 0.4916 | 0.0013 | 99.96 % | 0.241 kg | 0.052 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4309 | 0.0588 | 0.1368 | 0.4674 | 0.0011 | 99.98 % | 0.248 kg | 0.052 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cup_01 | tea_cup_porcelain_210 | upper | 199, -187, 499 | iec_tea 0.11 of 1.82 | 0.11 | 0 of 7206 | 4 | 0.0, 1.48 | yes |
| dessert_bowl_01 | dessert_bowl_vitrelle_130 | upper | -83, 149, 490 | iec_oat_flakes 0.00 of 149.00 | 0.00 | 0 of 10011 | 5 | 0.0, 0.97 | yes |
| dessert_bowl_02 | dessert_bowl_vitrelle_130 | upper | -82, 113, 489 | iec_spinach 0.00 of 172.12 | 0.00 | 0 of 10010 | 5 | 0.0, 0.93 | yes |
| dessert_bowl_03 | dessert_bowl_vitrelle_130 | upper | -83, 77, 489 | iec_oat_flakes 0.00 of 155.98 | 0.00 | 0 of 10010 | 5 | 0.0, 0.98 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 0.04 of 958.02 | 0.04 | 3 of 9149 | 3 | 0.0, 1.07 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | upper | -81, 40, 510 | iec_spinach 0.00 of 157.16 | 0.00 | 0 of 9149 | 5 | 0.0, 0.93 | yes |
| dessert_plate_03 | dessert_plate_porcelain_190 | upper | -82, -149, 512 | iec_egg_yolk 0.06 of 966.29 | 0.06 | 3 of 9149 | 4 | 0.0, 1.11 | yes |
| dessert_spoon_01 | dessert_spoon_160 | lower | -7, -45, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | -18, -116, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.33 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | 42, -40, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.37 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 45, -36, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.38 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 6, -170, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.21 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -20, -220, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.25 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -189, 112, 199 | iec_egg_yolk 0.01 of 1499.51 | 0.01 | 1 of 15968 | 4 | 0.0, 1.76 | yes |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -152, 112, 199 | iec_minced_meat 0.00 of 573.17 | 0.00 | 0 of 15968 | 5 | 0.0, 1.82 | yes |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -116, 112, 199 | iec_egg_yolk 0.04 of 1686.97 | 0.04 | 2 of 15968 | 3 | 0.0, 1.73 | no |
| fork_01 | dinner_fork_185 | lower | -23, -220, 80 | iec_egg_yolk 1.99 of 152.97 | 1.99 | 97 of 1094 | 1 | 0.0, 0.27 | no |
| fork_02 | dinner_fork_185 | lower | 38, -49, 80 | iec_egg_yolk 1.90 of 157.55 | 1.90 | 111 of 1095 | 1 | 0.0, 0.11 | no |
| fork_03 | dinner_fork_185 | lower | 70, -218, 80 | iec_egg_yolk 2.49 of 151.80 | 2.49 | 117 of 1095 | 1 | 0.0, 0.18 | no |
| fork_04 | dinner_fork_185 | lower | -12, -115, 80 | iec_egg_yolk 0.17 of 142.30 | 0.17 | 13 of 1094 | 2 | 0.0, 0.27 | no |
| fork_05 | dinner_fork_185 | lower | -6, -115, 80 | iec_egg_yolk 3.57 of 155.90 | 3.57 | 121 of 1094 | 1 | 0.0, 0.54 | no |
| fork_06 | dinner_fork_185 | lower | -2, -115, 80 | iec_egg_yolk 1.07 of 154.08 | 1.07 | 54 of 1094 | 1 | 0.0, 0.39 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 108, 118, 550 | iec_milk 0.00 of 497.23 | 0.00 | 0 of 10611 | 5 | 0.0, 0.94 | yes |
| glass_02 | test_glass_borosilicate_250 | upper | 108, 44, 550 | iec_milk 0.00 of 474.34 | 0.00 | 0 of 10611 | 5 | 0.0, 0.99 | yes |
| glass_03 | test_glass_borosilicate_250 | upper | 105, -29, 552 | iec_milk 0.00 of 506.85 | 0.00 | 0 of 10611 | 5 | 0.0, 1.17 | yes |
| glass_04 | test_glass_borosilicate_250 | upper | 107, -102, 551 | iec_milk 0.00 of 492.24 | 0.00 | 0 of 10611 | 5 | 0.0, 0.95 | yes |
| glass_06 | test_glass_borosilicate_250 | upper | -206, 204, 557 | iec_milk 21.06 of 500.22 | 21.06 | 600 of 10611 | 0 | 0.0, 1.18 | no |
| knife_01 | dinner_knife_210 | lower | -26, -160, 78 | iec_margarine 0.00 of 244.70 | 0.00 | 0 of 2335 | 5 | 0.0, 0.18 | yes |
| knife_02 | dinner_knife_210 | lower | -13, -221, 79 | iec_margarine 0.72 of 257.15 | 0.72 | 10 of 2334 | 3 | 0.0, 0.23 | no |
| knife_03 | dinner_knife_210 | lower | 58, -164, 79 | iec_margarine 0.00 of 247.03 | 0.00 | 0 of 2335 | 5 | 0.0, 0.18 | yes |
| knife_04 | dinner_knife_210 | lower | -27, -65, 78 | iec_margarine 0.00 of 227.14 | 0.00 | 0 of 2335 | 5 | 0.0, 0.22 | yes |
| knife_05 | dinner_knife_210 | lower | 8, -38, 81 | iec_margarine 0.00 of 261.13 | 0.00 | 0 of 2335 | 5 | 0.0, 0.34 | yes |
| knife_06 | dinner_knife_210 | lower | 33, -70, 79 | iec_margarine 0.00 of 229.08 | 0.00 | 0 of 2334 | 5 | 0.0, 0.14 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -84, -40, 516 | iec_spinach 0.00 of 154.29 | 0.00 | 0 of 10935 | 5 | 0.0, 0.82 | yes |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -85, -76, 516 | iec_minced_meat 0.00 of 415.77 | 0.00 | 0 of 10935 | 5 | 0.0, 0.82 | yes |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -82, -112, 518 | iec_spinach 0.00 of 162.26 | 0.00 | 0 of 10935 | 5 | 0.0, 0.80 | yes |
| mug_01 | mug_ceramic_300 | upper | 190, 157, 540 | iec_tea 0.18 of 3.33 | 0.19 | 0 of 12105 | 5 | 0.1, 1.83 | yes |
| mug_02 | mug_ceramic_300 | upper | 191, 41, 541 | iec_tea 0.15 of 2.98 | 0.16 | 0 of 12105 | 5 | 0.1, 1.71 | yes |
| mug_03 | mug_ceramic_300 | upper | 190, -75, 540 | iec_tea 0.15 of 2.77 | 0.16 | 0 of 12104 | 5 | 0.1, 1.84 | yes |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -228, -92, 196 | iec_margarine 0.00 of 4060.46 | 0.00 | 0 of 20245 | 5 | 0.0, 2.45 | yes |
| saucer_01 | saucer_porcelain_140 | lower | -225, 112, 129 | iec_tea 0.04 of 0.75 | 0.04 | 0 of 3002 | 5 | 0.0, 0.69 | yes |
| serving_fork_01 | serving_fork_210 | lower | 47, -116, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.09 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 53, -143, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.23 | yes |
| small_pot_01 | saucepan_steel_170 | lower | 10, 150, 234 | iec_minced_meat 7.53 of 1049.68 | 7.53 | 414 of 14474 | 0 | 0.0, 14.91 | no |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -171, -140, 188 | iec_oat_flakes 0.00 of 222.96 | 0.00 | 0 of 14750 | 5 | 0.0, 1.86 | yes |
| soup_plate_02 | soup_plate_porcelain_230 | lower | 222, -140, 189 | iec_oat_flakes 0.00 of 242.16 | 0.00 | 0 of 14750 | 5 | 0.0, 1.96 | yes |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 171, -140, 188 | iec_oat_flakes 0.00 of 230.77 | 0.00 | 0 of 14751 | 5 | 0.0, 2.00 | yes |
| soup_spoon_01 | soup_spoon_190 | lower | -22, -116, 79 | iec_oat_flakes 0.00 of 23.76 | 0.00 | 0 of 1450 | 5 | 0.0, 0.24 | yes |
| soup_spoon_02 | soup_spoon_190 | lower | -35, -162, 80 | iec_oat_flakes 0.00 of 24.10 | 0.00 | 0 of 1450 | 5 | 0.0, 0.22 | yes |
| soup_spoon_03 | soup_spoon_190 | lower | 57, -115, 80 | iec_oat_flakes 0.00 of 24.70 | 0.00 | 0 of 1450 | 5 | 0.0, 0.40 | yes |
| soup_spoon_04 | soup_spoon_190 | lower | 63, -114, 80 | iec_oat_flakes 1.29 of 21.58 | 1.29 | 139 of 1450 | 1 | 0.0, 0.39 | no |
| soup_spoon_05 | soup_spoon_190 | lower | 54, -41, 81 | iec_oat_flakes 0.00 of 23.52 | 0.00 | 0 of 1450 | 5 | 0.0, 0.27 | yes |
| soup_spoon_06 | soup_spoon_190 | lower | 62, -31, 81 | iec_oat_flakes 0.00 of 24.37 | 0.00 | 0 of 1450 | 5 | 0.0, 0.24 | yes |
| teaspoon_01 | teaspoon_130 | lower | 48, -219, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.11 | yes |
| teaspoon_02 | teaspoon_130 | lower | -1, -43, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.20 | yes |
| teaspoon_03 | teaspoon_130 | lower | -3, -178, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.36 | yes |
| teaspoon_04 | teaspoon_130 | lower | 1, -178, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.39 | yes |
| teaspoon_05 | teaspoon_130 | lower | 68, -103, 79 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.08 | yes |
| teaspoon_06 | teaspoon_130 | lower | 5, -116, 80 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.14 | yes |
