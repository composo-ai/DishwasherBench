# Demonstration wash: dinner-party-careful

Level 'Dinner party', loaded by the careful policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 49 items (13 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.9 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 0.2 s |
| Time, soil | 0.4 s |
| Time, replay | 1.1 s |
| Time, result | 0.3 s |
| Time, total | 4.9 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 200497 blocks, 552828 soil cells, 78346 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.61 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 12.05 g dry at the start, 0.00 g left (0 %) |
| Items clean | 45 of 49 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5277 | 0.0384 | 0.1383 | 0.1761 | 0.0012 | 99.86 % | 0.256 kg | 0.069 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5326 | 0.0431 | 0.1410 | 0.1835 | 0.0012 | 99.86 % | 0.264 kg | 0.069 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4538 | 0.0669 | 0.1416 | 0.4938 | 0.0008 | 99.98 % | 0.291 kg | 0.068 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4292 | 0.0634 | 0.1338 | 0.4696 | 0.0007 | 99.96 % | 0.300 kg | 0.068 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cheese_board_01 | chopping_board_pe_340 | lower | 209, -13, 198 | butter_margarine 0.00 of 141.22 | 0.00 | 0 of 16169 | 5 | 0.0, 4.23 | yes |
| cheese_platter_01 | oval_platter_vitrelle_241 | lower | -185, 112, 171 | butter_margarine 0.00 of 53.03 | 0.00 | 0 of 6425 | 5 | 0.0, 1.00 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -170, 112, 163 | egg_yolk_dried 0.00 of 352.40 | 0.00 | 0 of 4408 | 5 | 0.0, 1.00 | yes |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | -119, -140, 157 | egg_yolk_dried 0.00 of 342.46 | 0.00 | 0 of 4406 | 5 | 0.0, 1.21 | yes |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | -61, 112, 163 | egg_yolk_dried 0.00 of 304.45 | 0.00 | 0 of 4407 | 5 | 0.0, 1.00 | yes |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | -43, 112, 163 | egg_yolk_dried 0.00 of 359.77 | 0.00 | 0 of 4407 | 5 | 0.0, 1.02 | yes |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 174, 111, 163 | egg_yolk_dried 0.00 of 332.08 | 0.00 | 0 of 4406 | 5 | 0.0, 1.15 | yes |
| dessert_spoon_01 | dessert_spoon_160 | lower | -49, -101, 79 | cream 0.00 of 18.85 | 0.00 | 0 of 898 | 5 | 0.0, 0.39 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | 46, -116, 79 | cream 0.00 of 18.23 | 0.00 | 0 of 897 | 5 | 0.0, 0.21 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -45, -102, 79 | cream 0.00 of 17.90 | 0.00 | 0 of 898 | 5 | 0.0, 0.43 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 70, -161, 80 | cream 0.00 of 18.34 | 0.00 | 0 of 897 | 5 | 0.0, 0.21 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | -51, -223, 79 | cream 0.00 of 16.29 | 0.00 | 0 of 896 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | -41, -71, 79 | cream 0.00 of 17.33 | 0.00 | 0 of 897 | 5 | 0.0, 0.15 | yes |
| dinner_plate_01 | dinner_plate_porcelain_270 | lower | -174, -121, 213 | gravy 0.00 of 307.67; minced_meat 0.00 of 147.12 | 0.00 | 0 of 20295 | 5 | 0.0, 2.01 | yes |
| dinner_plate_02 | dinner_plate_porcelain_270 | lower | -150, -121, 212 | gravy 0.00 of 260.15; minced_meat 0.01 of 161.42 | 0.01 | 1 of 20304 | 4 | 0.0, 2.01 | yes |
| dinner_plate_03 | dinner_plate_porcelain_270 | lower | 175, -121, 213 | gravy 0.00 of 262.07; minced_meat 0.00 of 152.60 | 0.00 | 0 of 20026 | 5 | 0.0, 1.99 | yes |
| dinner_plate_04 | dinner_plate_porcelain_270 | lower | 150, -121, 212 | gravy 0.00 of 267.23; minced_meat 0.00 of 145.20 | 0.00 | 0 of 19930 | 5 | 0.0, 2.18 | yes |
| fork_01 | dinner_fork_185 | lower | -13, -159, 80 | gravy 0.16 of 13.27 | 0.16 | 33 of 921 | 2 | 0.0, 0.27 | no |
| fork_02 | dinner_fork_185 | lower | 67, -161, 80 | gravy 0.00 of 14.41 | 0.00 | 0 of 919 | 5 | 0.0, 0.23 | yes |
| fork_03 | dinner_fork_185 | lower | -7, -157, 80 | gravy 0.00 of 13.87 | 0.00 | 0 of 919 | 5 | 0.0, 0.37 | yes |
| fork_05 | dinner_fork_185 | lower | 52, -47, 80 | gravy 0.03 of 14.24 | 0.03 | 8 of 917 | 3 | 0.0, 0.15 | no |
| fork_06 | dinner_fork_185 | lower | -16, -115, 79 | gravy 0.00 of 14.20 | 0.00 | 0 of 917 | 5 | 0.0, 0.20 | yes |
| gazpacho_glass_01 | tumbler_250 | upper | 196, 76, 528 | tomato_sauce 0.00 of 229.54 | 0.00 | 0 of 5338 | 5 | 0.0, 0.85 | yes |
| gazpacho_glass_02 | tumbler_250 | upper | 195, -13, 529 | tomato_sauce 0.00 of 222.25 | 0.00 | 0 of 5339 | 5 | 0.0, 0.97 | yes |
| gazpacho_glass_03 | tumbler_250 | upper | 196, -105, 528 | tomato_sauce 0.00 of 246.51 | 0.00 | 0 of 5337 | 5 | 0.0, 0.84 | yes |
| gazpacho_glass_04 | tumbler_250 | upper | 196, -197, 528 | tomato_sauce 0.00 of 242.34 | 0.00 | 0 of 5336 | 5 | 0.0, 0.83 | yes |
| gazpacho_glass_05 | tumbler_250 | upper | -215, 181, 517 | tomato_sauce 0.00 of 222.78 | 0.00 | 0 of 5335 | 5 | 0.0, 0.90 | yes |
| gazpacho_glass_06 | tumbler_250 | upper | -220, 94, 513 | tomato_sauce 0.00 of 233.47 | 0.00 | 0 of 5339 | 5 | 0.0, 1.12 | yes |
| guacamole_pot_01 | ramekin_porcelain_89 | upper | -204, -7, 473 | avocado 0.00 of 196.16 | 0.00 | 0 of 4440 | 5 | 0.0, 1.54 | yes |
| guacamole_pot_02 | ramekin_porcelain_89 | upper | -203, -96, 473 | avocado 0.00 of 193.23 | 0.00 | 0 of 4440 | 5 | 0.0, 1.55 | yes |
| guacamole_pot_03 | ramekin_porcelain_89 | upper | -206, -198, 472 | avocado 0.00 of 177.88 | 0.00 | 0 of 4442 | 5 | 0.0, 1.50 | yes |
| guacamole_pot_04 | ramekin_porcelain_89 | upper | -101, -107, 510 | avocado 0.00 of 183.14 | 0.00 | 0 of 4440 | 5 | 0.0, 2.08 | yes |
| juice_glass_01 | tumbler_360 | upper | 111, -29, 554 | tomato_sauce 0.00 of 331.97 | 0.00 | 0 of 7305 | 5 | 0.0, 1.32 | yes |
| juice_glass_02 | tumbler_360 | upper | 114, -139, 552 | tomato_sauce 0.00 of 298.61 | 0.00 | 0 of 7305 | 5 | 0.0, 1.35 | yes |
| juice_glass_03 | tumbler_360 | upper | 41, 74, 568 | tomato_sauce 0.00 of 317.54 | 0.00 | 0 of 7304 | 5 | 0.0, 1.39 | yes |
| juice_glass_04 | tumbler_360 | upper | 38, -14, 569 | tomato_sauce 0.00 of 334.67 | 0.00 | 0 of 7303 | 5 | 0.0, 1.20 | yes |
| juice_glass_05 | tumbler_360 | upper | 38, -102, 569 | tomato_sauce 0.00 of 338.52 | 0.00 | 0 of 7303 | 5 | 0.0, 1.28 | yes |
| juice_glass_06 | tumbler_360 | upper | -81, 186, 563 | tomato_sauce 1.28 of 295.11 | 1.28 | 35 of 7306 | 2 | 0.0, 2.62 | no |
| knife_01 | dinner_knife_210 | lower | -25, -219, 78 | butter_margarine 0.00 of 10.79 | 0.00 | 0 of 1173 | 5 | 0.0, 0.25 | yes |
| knife_02 | dinner_knife_210 | lower | 49, -219, 79 | butter_margarine 0.00 of 10.23 | 0.00 | 0 of 1172 | 5 | 0.0, 0.13 | yes |
| knife_03 | dinner_knife_210 | lower | -39, -226, 78 | butter_margarine 0.00 of 9.22 | 0.00 | 0 of 1172 | 5 | 0.0, 0.34 | yes |
| knife_04 | dinner_knife_210 | lower | -9, -31, 78 | butter_margarine 0.00 of 9.70 | 0.00 | 0 of 1172 | 5 | 0.0, 0.21 | yes |
| knife_05 | dinner_knife_210 | lower | 51, -107, 79 | butter_margarine 0.00 of 9.38 | 0.00 | 0 of 1169 | 5 | 0.0, 0.14 | yes |
| knife_06 | dinner_knife_210 | lower | 0, -147, 81 | butter_margarine 0.00 of 9.15 | 0.00 | 0 of 1172 | 5 | 0.0, 0.35 | yes |
| platter_01 | oval_platter_porcelain_320 | lower | -228, -91, 196 | lard_tallow 0.00 of 2413.81; gravy 0.00 of 156.71 | 0.00 | 0 of 22847 | 5 | 0.0, 2.56 | yes |
| salad_bowl_01 | serving_bowl_vitrelle_216 | lower | 44, 140, 213 | vegetable_oil 0.00 of 394.52 | 0.00 | 0 of 26311 | 5 | 0.0, 3.13 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | -50, -34, 79 | gravy 0.00 of 46.11 | 0.00 | 0 of 3323 | 5 | 0.0, 0.38 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 55, -33, 82 | gravy 0.07 of 53.68 | 0.07 | 7 of 3324 | 3 | 0.0, 0.24 | no |
| tongs_01 | tongs_steel_350 | upper | -219, -131, 573 | lard_tallow 0.00 of 1095.15 | 0.00 | 0 of 6605 | 5 | 0.0, 18.19 | yes |
