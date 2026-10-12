# Demonstration wash: half-careful

Half of the IEC load (six place settings), loaded carefully and well spaced.

Machine bosch_smv4hax40g, programme auto_145 (145 min, 3971 ticks), tier official, 57 items (8 of the offer left on the counter by the loading physics), simulator spotless-sim 0.3.2 water-3, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 4.9 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 170.2 s |
| Time, soil | 0.8 s |
| Time, replay | 5.0 s |
| Time, result | 0.7 s |
| Time, total | 181.6 s (3.0 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 677539 blocks, 1799268 soil cells, 308421 deposits |
| GPU memory | scene 126.6 MB, peak of all buffers 144.8 MB |
| Process memory (RSS) | 0.72 GB |
| Mains water, energy | 11.5 L, 1.04 kWh |
| Water held in vessels | 16 mL |
| Detergent | 20.0 of 20.0 g dissolved (dispenser free) |
| Soil | 40.87 g dry at the start, 30.44 g left (74 %) |
| Items clean | 20 of 57 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 990 s | lower 40 rpm | 0.7050 | 0.5348 | 0.0371 | 0.1323 | 0.1687 | 0.0014 | 99.54 % | 0.192 kg | 0.036 kg | yes |
| l@3000 | 1921 s | lower 42 rpm | 0.7173 | 0.5407 | 0.0413 | 0.1346 | 0.1752 | 0.0014 | 99.54 % | 0.199 kg | 0.037 kg | yes |
| ur@2800 | 924 s | upper 27 rpm | 0.9484 | 0.4600 | 0.0717 | 0.1305 | 0.4868 | 0.0016 | 99.74 % | 0.210 kg | 0.037 kg | yes |
| ur@3000 | 1920 s | upper 31 rpm | 0.8995 | 0.4351 | 0.0682 | 0.1232 | 0.4629 | 0.0014 | 99.74 % | 0.217 kg | 0.037 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cup_01 | tea_cup_porcelain_210 | upper | 187, 106, 560 | iec_tea 0.01 of 0.10 | 0.01 | 7206 of 7206 | 0 | 1.2, 3.32 | no |
| cup_02 | tea_cup_porcelain_210 | upper | -13, 100, 490 | iec_tea 0.01 of 0.10 | 0.01 | 7206 of 7206 | 0 | 0.0, 0.75 | no |
| cup_03 | tea_cup_porcelain_210 | upper | -137, 163, 511 | iec_tea 0.01 of 0.10 | 0.01 | 7206 of 7206 | 0 | 0.0, 0.74 | no |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -223, -141, 157 | iec_egg_yolk 866.75 of 1000.00 | 866.75 | 9149 of 9149 | 0 | 0.0, 0.78 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | -170, -140, 157 | iec_spinach 107.07 of 500.00 | 107.07 | 8397 of 9149 | 0 | 0.0, 0.76 | no |
| dessert_plate_03 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | iec_egg_yolk 867.01 of 1000.00 | 867.01 | 9149 of 9149 | 0 | 0.0, 0.76 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | 15, -252, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | 55, -117, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.13 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | 70, -245, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.15 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 2, -53, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.12 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 7, -102, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.07 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -5, -248, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
| dinner_plate_01 | dinner_plate_porcelain_iec | lower | -226, 111, 199 | iec_egg_yolk 1300.09 of 1500.00 | 1300.09 | 15968 of 15968 | 0 | 0.0, 1.33 | no |
| dinner_plate_02 | dinner_plate_porcelain_iec | lower | -189, 111, 199 | iec_minced_meat 336.77 of 630.00 | 336.77 | 15965 of 15968 | 0 | 0.0, 1.34 | no |
| dinner_plate_03 | dinner_plate_porcelain_iec | lower | -153, 111, 199 | iec_egg_yolk 1297.61 of 1500.00 | 1297.61 | 15968 of 15968 | 0 | 0.0, 1.33 | no |
| fork_01 | dinner_fork_185 | lower | -10, -244, 77 | iec_egg_yolk 131.28 of 150.00 | 131.28 | 1094 of 1094 | 0 | 0.0, 0.16 | no |
| fork_02 | dinner_fork_185 | lower | 3, -153, 76 | iec_egg_yolk 131.29 of 150.00 | 131.29 | 1095 of 1095 | 0 | 0.0, 0.51 | no |
| fork_03 | dinner_fork_185 | lower | 7, -150, 76 | iec_egg_yolk 133.89 of 150.00 | 133.89 | 1095 of 1095 | 0 | 0.0, 0.49 | no |
| fork_04 | dinner_fork_185 | lower | 11, -33, 75 | iec_egg_yolk 131.14 of 150.00 | 131.14 | 1094 of 1094 | 0 | 0.0, 0.13 | no |
| fork_05 | dinner_fork_185 | lower | 69, -107, 76 | iec_egg_yolk 132.09 of 150.00 | 132.09 | 1094 of 1094 | 0 | 0.0, 0.22 | no |
| fork_06 | dinner_fork_185 | lower | 48, -201, 76 | iec_egg_yolk 131.56 of 150.00 | 131.56 | 1094 of 1094 | 0 | 0.0, 0.27 | no |
| glass_01 | test_glass_borosilicate_250 | upper | 76, 207, 546 | iec_milk 4908.82 of 5000.00 | 4908.82 | 10611 of 10611 | 0 | 0.0, 0.69 | no |
| glass_02 | test_glass_borosilicate_250 | upper | 103, 131, 551 | iec_milk 4912.73 of 5000.00 | 4912.73 | 10611 of 10611 | 0 | 0.0, 0.71 | no |
| glass_03 | test_glass_borosilicate_250 | upper | 99, 43, 550 | iec_milk 4902.83 of 5000.00 | 4902.83 | 10611 of 10611 | 0 | 0.0, 0.67 | no |
| glass_04 | test_glass_borosilicate_250 | upper | 106, -32, 549 | iec_milk 4901.65 of 5000.00 | 4901.65 | 10611 of 10611 | 0 | 0.0, 0.65 | no |
| glass_05 | test_glass_borosilicate_250 | upper | 109, -110, 550 | iec_milk 4902.10 of 5000.00 | 4902.10 | 10611 of 10611 | 0 | 0.0, 0.70 | no |
| knife_01 | dinner_knife_210 | lower | -51, -212, 271 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.16 | yes |
| knife_02 | dinner_knife_210 | lower | -66, -111, 261 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2334 | 5 | 0.0, 0.07 | yes |
| knife_03 | dinner_knife_210 | lower | -82, -251, 261 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.23 | yes |
| knife_04 | dinner_knife_210 | lower | -80, -232, 265 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.17 | yes |
| knife_05 | dinner_knife_210 | lower | 72, -106, 269 | iec_margarine 0.00 of 300.00 | 0.00 | 0 of 2335 | 5 | 0.0, 0.15 | yes |
| knife_06 | dinner_knife_210 | lower | -17, -104, 267 | iec_margarine 0.13 of 300.00 | 0.13 | 1 of 2334 | 4 | 0.0, 0.28 | yes |
| melamine_plate_01 | melamine_dessert_plate_iec_195 | upper | -81, -28, 512 | iec_spinach 61.33 of 500.00 | 61.33 | 8193 of 10935 | 0 | 0.0, 0.34 | no |
| melamine_plate_02 | melamine_dessert_plate_iec_195 | upper | -81, -65, 512 | iec_minced_meat 213.44 of 420.00 | 213.44 | 10929 of 10935 | 0 | 0.0, 0.35 | no |
| melamine_plate_03 | melamine_dessert_plate_iec_195 | upper | -81, -101, 512 | iec_spinach 70.64 of 500.00 | 70.64 | 8661 of 10935 | 0 | 0.0, 0.36 | no |
| mug_01 | mug_ceramic_300 | upper | 181, -61, 595 | iec_tea 0.01 of 0.10 | 0.01 | 12105 of 12105 | 0 | 5.0, 3.15 | no |
| mug_02 | mug_ceramic_300 | upper | 181, -145, 595 | iec_tea 0.01 of 0.10 | 0.01 | 12105 of 12105 | 0 | 5.0, 3.09 | no |
| mug_03 | mug_ceramic_300 | upper | 182, 194, 595 | iec_tea 0.02 of 0.10 | 0.02 | 12104 of 12104 | 0 | 5.0, 3.19 | no |
| oval_platter_01 | oval_platter_porcelain_320 | lower | -101, 85, 202 | iec_margarine 0.00 of 5000.00 | 0.00 | 0 of 20245 | 5 | 0.0, 1.81 | yes |
| saucer_01 | saucer_porcelain_140 | lower | 217, -140, 122 | iec_tea 0.01 of 0.10 | 0.01 | 3002 of 3002 | 0 | 0.0, 0.64 | no |
| saucer_02 | saucer_porcelain_140 | lower | 165, -140, 121 | iec_tea 0.01 of 0.10 | 0.01 | 3002 of 3002 | 0 | 0.0, 0.52 | no |
| saucer_03 | saucer_porcelain_140 | lower | -42, 112, 129 | iec_tea 0.01 of 0.10 | 0.01 | 3002 of 3002 | 0 | 0.0, 0.47 | no |
| serving_fork_01 | serving_fork_210 | lower | 5, -210, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.33 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 30, -75, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.07 | yes |
| soup_plate_01 | soup_plate_porcelain_230 | lower | -4, 111, 194 | iec_oat_flakes 0.67 of 240.00 | 0.67 | 109 of 14750 | 1 | 0.0, 1.24 | no |
| soup_plate_03 | soup_plate_porcelain_230 | lower | 125, 112, 197 | iec_oat_flakes 1.69 of 240.00 | 1.69 | 404 of 14751 | 0 | 0.0, 1.45 | no |
| soup_spoon_01 | soup_spoon_190 | lower | -32, -56, 76 | iec_oat_flakes 0.08 of 24.00 | 0.08 | 12 of 1450 | 2 | 0.0, 0.10 | no |
| soup_spoon_02 | soup_spoon_190 | lower | 54, -204, 75 | iec_oat_flakes 0.07 of 24.00 | 0.07 | 9 of 1450 | 2 | 0.0, 0.49 | no |
| soup_spoon_03 | soup_spoon_190 | lower | 6, -37, 76 | iec_oat_flakes 0.15 of 24.00 | 0.15 | 24 of 1450 | 2 | 0.0, 0.19 | no |
| soup_spoon_04 | soup_spoon_190 | lower | -1, -174, 75 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 8 of 1450 | 3 | 0.0, 0.21 | no |
| soup_spoon_05 | soup_spoon_190 | lower | 4, -238, 76 | iec_oat_flakes 0.06 of 24.00 | 0.06 | 7 of 1450 | 3 | 0.0, 0.22 | no |
| soup_spoon_06 | soup_spoon_190 | lower | 38, -27, 76 | iec_oat_flakes 0.07 of 24.00 | 0.07 | 9 of 1450 | 2 | 0.0, 0.15 | no |
| teaspoon_01 | teaspoon_130 | lower | 30, -168, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.09 | yes |
| teaspoon_02 | teaspoon_130 | lower | 65, -28, 77 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.18 | yes |
| teaspoon_03 | teaspoon_130 | lower | 49, -153, 76 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.10 | yes |
| teaspoon_04 | teaspoon_130 | lower | 15, -211, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.17 | yes |
| teaspoon_06 | teaspoon_130 | lower | 3, -178, 75 | none | 0.00 | 0 of 0 | 5 | 0.0, 0.19 | yes |
