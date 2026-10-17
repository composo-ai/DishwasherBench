# Demonstration wash: dinner-party-careless

Level 'Dinner party', loaded by the careless policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 51 items (11 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 1, spoons_nested x 2, cutlery_bunched x 2, cup_on_side x 6, cup_upright x 4, item_over_others x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 3.1 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 0.2 s |
| Time, soil | 0.5 s |
| Time, replay | 3.5 s |
| Time, result | 0.5 s |
| Time, total | 7.8 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 216101 blocks, 615244 soil cells, 89232 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.54 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 1360 mL |
| Detergent | 6.8 of 12.9 g dissolved (dispenser blocked) |
| Soil | 12.90 g dry at the start, 1.63 g left (13 %) |
| Items clean | 27 of 51 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5365 | 0.0350 | 0.1328 | 0.1673 | 0.0012 | 99.88 % | 0.266 kg | 0.068 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5409 | 0.0404 | 0.1353 | 0.1752 | 0.0012 | 99.91 % | 0.276 kg | 0.069 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4625 | 0.0599 | 0.1398 | 0.4852 | 0.0006 | 99.94 % | 0.304 kg | 0.069 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4374 | 0.0570 | 0.1321 | 0.4615 | 0.0005 | 99.94 % | 0.313 kg | 0.069 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| cheese_board_01 | chopping_board_pe_340 | lower | 209, -13, 198 | butter_margarine 0.00 of 141.22 | 0.00 | 0 of 16169 | 5 | 0.0, 4.27 | yes |
| cheese_platter_01 | oval_platter_vitrelle_241 | lower | -185, 112, 171 | butter_margarine 0.00 of 53.03 | 0.00 | 0 of 6425 | 5 | 0.0, 1.05 | yes |
| dessert_plate_01 | dessert_plate_porcelain_190 | lower | -170, 112, 163 | egg_yolk_dried 37.02 of 352.40 | 37.02 | 1568 of 4408 | 0 | 0.0, 1.01 | no |
| dessert_plate_02 | dessert_plate_porcelain_190 | lower | -103, -139, 167 | egg_yolk_dried 53.25 of 342.46 | 53.25 | 2287 of 4406 | 0 | 0.0, 1.24 | no |
| dessert_plate_04 | dessert_plate_porcelain_190 | lower | -61, 112, 163 | egg_yolk_dried 43.60 of 304.45 | 43.60 | 1998 of 4407 | 0 | 0.0, 0.96 | no |
| dessert_plate_05 | dessert_plate_porcelain_190 | lower | -43, 112, 163 | egg_yolk_dried 113.40 of 359.77 | 113.40 | 3538 of 4407 | 0 | 0.0, 0.99 | no |
| dessert_plate_06 | dessert_plate_porcelain_190 | lower | 174, 112, 163 | egg_yolk_dried 34.54 of 332.08 | 34.54 | 1669 of 4406 | 0 | 0.0, 1.10 | no |
| dessert_spoon_01 | dessert_spoon_160 | lower | -50, -101, 79 | cream 0.00 of 18.85 | 0.00 | 0 of 898 | 5 | 0.0, 0.20 | yes |
| dessert_spoon_02 | dessert_spoon_160 | lower | 51, -111, 79 | cream 0.00 of 18.23 | 0.00 | 0 of 897 | 5 | 0.0, 0.13 | yes |
| dessert_spoon_03 | dessert_spoon_160 | lower | -28, -125, 80 | cream 0.00 of 17.90 | 0.00 | 0 of 898 | 5 | 0.0, 0.10 | yes |
| dessert_spoon_04 | dessert_spoon_160 | lower | 70, -159, 80 | cream 0.00 of 18.34 | 0.00 | 0 of 897 | 5 | 0.0, 0.26 | yes |
| dessert_spoon_05 | dessert_spoon_160 | lower | 3, -146, 80 | cream 0.00 of 16.29 | 0.00 | 0 of 896 | 5 | 0.0, 0.49 | yes |
| dessert_spoon_06 | dessert_spoon_160 | lower | 6, -146, 80 | cream 0.00 of 17.33 | 0.00 | 0 of 897 | 5 | 0.0, 0.43 | yes |
| dinner_plate_01 | dinner_plate_porcelain_270 | lower | -174, -121, 213 | gravy 0.00 of 307.67; minced_meat 20.53 of 147.12 | 20.53 | 1488 of 20295 | 0 | 0.0, 2.04 | no |
| dinner_plate_02 | dinner_plate_porcelain_270 | lower | -150, -121, 212 | gravy 0.00 of 260.15; minced_meat 28.12 of 161.42 | 28.12 | 1728 of 20304 | 0 | 0.0, 2.10 | no |
| dinner_plate_03 | dinner_plate_porcelain_270 | lower | 175, -121, 213 | gravy 2.59 of 262.07; minced_meat 46.31 of 152.60 | 48.90 | 2946 of 20026 | 0 | 0.0, 2.33 | no |
| dinner_plate_04 | dinner_plate_porcelain_270 | lower | 150, -121, 212 | gravy 0.00 of 267.23; minced_meat 14.38 of 145.20 | 14.38 | 1076 of 19930 | 0 | 0.0, 2.31 | no |
| dinner_plate_05 | dinner_plate_porcelain_270 | lower | -114, 111, 215 | gravy 0.00 of 279.90; minced_meat 14.71 of 144.57 | 14.71 | 1056 of 19758 | 0 | 0.0, 2.30 | no |
| dinner_plate_06 | dinner_plate_porcelain_270 | lower | -88, 112, 215 | gravy 0.00 of 278.29; minced_meat 15.26 of 149.26 | 15.26 | 1077 of 20027 | 0 | 0.0, 2.09 | no |
| fork_01 | dinner_fork_185 | lower | -21, -168, 80 | gravy 0.00 of 13.27 | 0.00 | 0 of 921 | 5 | 0.0, 0.31 | yes |
| fork_02 | dinner_fork_185 | lower | 67, -161, 80 | gravy 0.00 of 14.41 | 0.00 | 0 of 919 | 5 | 0.0, 0.29 | yes |
| fork_03 | dinner_fork_185 | lower | -16, -157, 80 | gravy 0.00 of 13.87 | 0.00 | 0 of 919 | 5 | 0.0, 0.31 | yes |
| fork_05 | dinner_fork_185 | lower | 66, -72, 81 | gravy 0.01 of 14.24 | 0.01 | 5 of 917 | 3 | 0.0, 0.13 | no |
| fork_06 | dinner_fork_185 | lower | -23, -114, 79 | gravy 0.00 of 14.20 | 0.00 | 0 of 917 | 5 | 0.0, 0.15 | yes |
| gazpacho_glass_01 | tumbler_250 | upper | 195, 103, 457 | tomato_sauce 79.73 of 229.54 | 97.31 | 6287 of 5338 | 0 | 29.8, 1.29 | no |
| gazpacho_glass_02 | tumbler_250 | upper | 195, -18, 455 | tomato_sauce 38.16 of 222.25 | 41.55 | 3846 of 5339 | 0 | 38.8, 1.23 | no |
| gazpacho_glass_03 | tumbler_250 | upper | 182, -87, 444 | tomato_sauce 211.39 of 246.51 | 675.04 | 23870 of 5337 | 0 | 308.8, 2.59 | no |
| gazpacho_glass_04 | tumbler_250 | upper | 204, -229, 527 | tomato_sauce 1.18 of 242.34 | 1.18 | 20 of 5336 | 3 | 0.0, 1.11 | no |
| gazpacho_glass_05 | tumbler_250 | upper | -215, 180, 517 | tomato_sauce 0.00 of 222.78 | 0.00 | 0 of 5335 | 5 | 0.0, 0.89 | yes |
| gazpacho_glass_06 | tumbler_250 | upper | 111, 213, 471 | tomato_sauce 180.67 of 233.47 | 448.70 | 15764 of 5339 | 0 | 224.4, 1.11 | no |
| guacamole_pot_01 | ramekin_porcelain_89 | upper | 32, 211, 479 | avocado 53.68 of 196.16 | 54.86 | 2229 of 4440 | 0 | 13.5, 1.44 | no |
| guacamole_pot_02 | ramekin_porcelain_89 | upper | -81, -17, 501 | avocado 0.00 of 193.23 | 0.00 | 0 of 4440 | 5 | 0.0, 0.92 | yes |
| guacamole_pot_03 | ramekin_porcelain_89 | upper | -197, -178, 471 | avocado 1.71 of 177.88 | 1.71 | 43 of 4442 | 2 | 0.0, 1.23 | no |
| guacamole_pot_04 | ramekin_porcelain_89 | upper | -98, -88, 457 | avocado 0.19 of 183.14 | 0.19 | 4 of 4440 | 3 | 0.0, 1.80 | no |
| juice_glass_01 | tumbler_360 | upper | 81, -68, 559 | tomato_sauce 0.00 of 331.97 | 0.00 | 0 of 7305 | 5 | 0.0, 1.34 | yes |
| juice_glass_02 | tumbler_360 | upper | 106, -92, 538 | tomato_sauce 0.33 of 298.61 | 0.33 | 8 of 7305 | 3 | 0.0, 1.34 | no |
| juice_glass_03 | tumbler_360 | upper | 15, 83, 447 | tomato_sauce 309.93 of 317.54 | 342.50 | 18994 of 7304 | 0 | 370.1, 1.46 | no |
| juice_glass_04 | tumbler_360 | upper | 7, -4, 449 | tomato_sauce 314.39 of 334.67 | 347.14 | 18756 of 7303 | 0 | 374.6, 1.37 | no |
| juice_glass_05 | tumbler_360 | upper | 42, -100, 568 | tomato_sauce 0.00 of 338.52 | 0.00 | 0 of 7303 | 5 | 0.0, 1.29 | yes |
| juice_glass_06 | tumbler_360 | upper | -83, 233, 550 | tomato_sauce 11.18 of 295.11 | 11.18 | 284 of 7306 | 0 | 0.0, 1.92 | no |
| knife_01 | dinner_knife_210 | lower | -42, -226, 78 | butter_margarine 0.00 of 10.79 | 0.00 | 0 of 1173 | 5 | 0.0, 0.14 | yes |
| knife_02 | dinner_knife_210 | lower | 49, -218, 79 | butter_margarine 0.00 of 10.23 | 0.00 | 0 of 1172 | 5 | 0.0, 0.12 | yes |
| knife_03 | dinner_knife_210 | lower | -55, -209, 81 | butter_margarine 0.00 of 9.22 | 0.00 | 0 of 1172 | 5 | 0.0, 0.15 | yes |
| knife_04 | dinner_knife_210 | lower | -39, -148, 79 | butter_margarine 0.00 of 9.70 | 0.00 | 0 of 1172 | 5 | 0.0, 0.19 | yes |
| knife_05 | dinner_knife_210 | lower | 62, -32, 78 | butter_margarine 0.00 of 9.38 | 0.00 | 0 of 1169 | 5 | 0.0, 0.29 | yes |
| knife_06 | dinner_knife_210 | lower | -9, -140, 81 | butter_margarine 0.00 of 9.15 | 0.00 | 0 of 1172 | 5 | 0.0, 0.36 | yes |
| platter_01 | oval_platter_porcelain_320 | lower | -228, -91, 196 | lard_tallow 0.00 of 2413.81; gravy 0.00 of 156.71 | 0.00 | 0 of 22847 | 5 | 0.0, 2.25 | yes |
| salad_bowl_01 | serving_bowl_vitrelle_216 | lower | 44, 139, 213 | vegetable_oil 0.00 of 394.52 | 0.00 | 0 of 26311 | 5 | 0.0, 3.16 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 25, -28, 80 | gravy 0.00 of 46.11 | 0.00 | 0 of 3323 | 5 | 0.0, 0.42 | yes |
| serving_spoon_02 | serving_spoon_216 | lower | 60, -37, 80 | gravy 0.00 of 53.68 | 0.00 | 0 of 3324 | 5 | 0.0, 0.51 | yes |
| tongs_01 | tongs_steel_350 | upper | 0, 219, 535 | lard_tallow 0.00 of 1095.15 | 0.00 | 0 of 6605 | 5 | 0.0, 13.30 | yes |
