# Demonstration wash: weeknight-dinner-careless

Level 'Weeknight dinner', loaded by the careless policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v7.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 11 of 100 cases: 0 in 100 for crockery, 23 in 100 for cutlery, 5 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 39 items (7 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: plate_facing_away x 2, cutlery_bunched x 2, cup_upright x 4, cup_on_side x 5.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.3 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 50.2 s |
| Time, soil | 0.2 s |
| Time, replay | 1.4 s |
| Time, result | 0.2 s |
| Time, total | 54.4 s (0.9 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 167425 blocks, 420540 soil cells, 64603 deposits |
| GPU memory | scene 129.3 MB, peak of all buffers 129.7 MB |
| Process memory (RSS) | 1.18 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 1124 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 10.66 g dry at the start, 0.74 g left (7 %) |
| Items clean | 27 of 39 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5154 | 0.0434 | 0.1455 | 0.1884 | 0.0012 | 99.94 % | 0.198 kg | 0.046 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5225 | 0.0463 | 0.1478 | 0.1936 | 0.0012 | 99.95 % | 0.203 kg | 0.046 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4625 | 0.0586 | 0.1412 | 0.4849 | 0.0010 | 99.98 % | 0.210 kg | 0.046 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4374 | 0.0558 | 0.1332 | 0.4612 | 0.0009 | 99.96 % | 0.217 kg | 0.046 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| fork_01 | dinner_fork_185 | lower | -28, -222, 80 | spinach_particles 0.00 of 8.19 | 0.00 | 0 of 921 | 5 | 0.0, 0.34 | yes |
| fork_02 | dinner_fork_185 | lower | 67, -216, 80 | spinach_particles 0.01 of 7.80 | 0.01 | 9 of 922 | 3 | 0.0, 0.34 | no |
| fork_03 | dinner_fork_185 | lower | 70, -65, 80 | spinach_particles 0.00 of 7.65 | 0.00 | 0 of 919 | 5 | 0.0, 0.07 | yes |
| fork_04 | dinner_fork_185 | lower | -23, -220, 79 | spinach_particles 0.00 of 8.18 | 0.00 | 0 of 919 | 5 | 0.0, 0.38 | yes |
| guacamole_pot_01 | ramekin_porcelain_89 | upper | 180, -172, 484 | avocado 1.68 of 182.90 | 1.68 | 42 of 4441 | 2 | 0.0, 1.57 | no |
| guacamole_pot_02 | ramekin_porcelain_89 | upper | 15, -33, 447 | avocado 176.42 of 185.59 | 186.43 | 9389 of 4440 | 0 | 140.0, 1.98 | no |
| guacamole_pot_03 | ramekin_porcelain_89 | upper | 16, -139, 447 | avocado 167.41 of 176.91 | 177.42 | 9396 of 4440 | 0 | 140.0, 2.09 | no |
| ketchup_pot_01 | ramekin_porcelain_89 | upper | 73, 170, 519 | tomato_sauce 0.00 of 185.73 | 0.00 | 0 of 4441 | 5 | 0.0, 3.14 | yes |
| ketchup_pot_02 | ramekin_porcelain_89 | upper | -197, -176, 471 | tomato_sauce 0.56 of 218.70 | 0.56 | 16 of 4440 | 3 | 0.0, 1.23 | no |
| knife_01 | dinner_knife_210 | lower | -28, -159, 78 | butter_margarine 0.00 of 14.07 | 0.00 | 0 of 1562 | 5 | 0.0, 0.17 | yes |
| knife_02 | dinner_knife_210 | lower | 48, -160, 79 | butter_margarine 0.00 of 13.60 | 0.00 | 0 of 1562 | 5 | 0.0, 0.11 | yes |
| knife_03 | dinner_knife_210 | lower | -16, -224, 79 | butter_margarine 0.00 of 12.99 | 0.00 | 0 of 1563 | 5 | 0.0, 0.22 | yes |
| knife_04 | dinner_knife_210 | lower | -41, -159, 78 | butter_margarine 0.00 of 13.12 | 0.00 | 0 of 1561 | 5 | 0.0, 0.17 | yes |
| lid_01 | lid_steel_165 | lower | 180, -139, 145 | tomato_sauce 0.00 of 410.95 | 0.00 | 0 of 8641 | 5 | 0.0, 1.23 | yes |
| mug_01 | mug_ceramic_300 | upper | -80, -78, 500 | tomato_sauce 19.60 of 288.67 | 20.52 | 911 of 6052 | 0 | 11.5, 2.89 | no |
| mug_02 | mug_ceramic_300 | upper | -213, -124, 530 | tomato_sauce 0.00 of 274.15 | 0.00 | 0 of 6053 | 5 | 0.0, 1.40 | yes |
| pasta_bowl_02 | cereal_bowl_vitrelle_159 | upper | -82, 136, 510 | pasta_starch 0.00 of 361.59 | 0.00 | 0 of 9909 | 5 | 0.0, 1.60 | yes |
| pasta_bowl_04 | cereal_bowl_vitrelle_159 | upper | -45, 93, 557 | pasta_starch 0.00 of 376.12 | 0.00 | 0 of 9909 | 5 | 0.0, 1.84 | yes |
| plate_01 | dinner_plate_porcelain_270 | lower | -228, -121, 213 | tomato_sauce 0.00 of 680.59 | 0.00 | 0 of 15742 | 5 | 0.0, 2.14 | yes |
| plate_02 | dinner_plate_porcelain_270 | lower | -204, -121, 211 | tomato_sauce 0.00 of 750.19 | 0.00 | 0 of 15742 | 5 | 0.0, 2.11 | yes |
| plate_03 | dinner_plate_porcelain_270 | lower | -174, -121, 213 | tomato_sauce 0.00 of 717.98 | 0.00 | 0 of 15740 | 5 | 0.0, 2.11 | yes |
| plate_04 | dinner_plate_porcelain_270 | lower | -151, -121, 212 | tomato_sauce 0.00 of 688.78 | 0.00 | 0 of 15740 | 5 | 0.0, 2.00 | yes |
| salad_bowl_01 | serving_bowl_vitrelle_216 | lower | 132, 201, 185 | vegetable_oil 0.00 of 396.05; spinach_particles 0.00 of 34.46 | 0.00 | 0 of 27713 | 5 | 0.0, 2.57 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 1, -29, 83 | tomato_sauce 1.39 of 127.22 | 1.39 | 30 of 2993 | 2 | 0.0, 0.15 | no |
| side_plate_01 | dessert_plate_porcelain_190 | lower | -225, 112, 163 | vegetable_oil 0.00 of 101.91; spinach_particles 0.00 of 17.99 | 0.00 | 0 of 8742 | 5 | 0.0, 1.02 | yes |
| side_plate_02 | dessert_plate_porcelain_190 | lower | -207, 112, 163 | vegetable_oil 0.00 of 113.01; spinach_particles 0.00 of 18.53 | 0.00 | 0 of 8270 | 5 | 0.0, 1.02 | yes |
| side_plate_03 | dessert_plate_porcelain_190 | lower | -189, 111, 163 | vegetable_oil 0.00 of 112.44; spinach_particles 0.00 of 18.14 | 0.00 | 0 of 8777 | 5 | 0.0, 1.02 | yes |
| side_plate_04 | dessert_plate_porcelain_190 | lower | -160, 112, 203 | vegetable_oil 0.00 of 108.27; spinach_particles 0.00 of 19.44 | 0.00 | 0 of 8742 | 5 | 0.0, 1.11 | yes |
| smoothie_glass_01 | tumbler_250 | upper | 195, 223, 457 | avocado 46.72 of 221.03 | 48.85 | 2970 of 5339 | 0 | 28.8, 1.43 | no |
| smoothie_glass_02 | tumbler_250 | upper | 207, 90, 456 | avocado 95.82 of 224.18 | 101.88 | 6851 of 5336 | 0 | 84.8, 1.03 | no |
| smoothie_glass_03 | tumbler_250 | upper | 185, -6, 445 | avocado 189.58 of 217.91 | 240.98 | 18246 of 5336 | 0 | 303.1, 2.07 | no |
| smoothie_glass_04 | tumbler_250 | upper | 195, -53, 457 | avocado 37.10 of 204.11 | 39.32 | 2835 of 5338 | 0 | 30.8, 1.28 | no |
| spoon_01 | dessert_spoon_160 | lower | -25, -114, 80 | yoghurt 0.00 of 18.70 | 0.00 | 0 of 899 | 5 | 0.0, 0.45 | yes |
| spoon_02 | dessert_spoon_160 | lower | 53, -108, 79 | yoghurt 0.00 of 17.58 | 0.00 | 0 of 896 | 5 | 0.0, 0.09 | yes |
| spoon_03 | dessert_spoon_160 | lower | -21, -115, 80 | yoghurt 0.00 of 18.14 | 0.00 | 0 of 896 | 5 | 0.0, 0.45 | yes |
| spoon_04 | dessert_spoon_160 | lower | 70, -219, 80 | yoghurt 0.00 of 17.97 | 0.00 | 0 of 896 | 5 | 0.0, 0.28 | yes |
| tumbler_01 | tumbler_360 | upper | -34, 20, 522 | sugar_syrup 0.00 of 587.40 | 0.00 | 0 of 7304 | 5 | 0.0, 1.74 | yes |
| tumbler_02 | tumbler_360 | upper | -81, -9, 438 | sugar_syrup 0.00 of 621.89 | 28.47 | 10801 of 7303 | 0 | 385.2, 1.50 | no |
| turner_01 | turner_nylon_279 | lower | 20, -52, 77 | lard_tallow 0.00 of 1856.50 | 0.00 | 0 of 11325 | 5 | 0.0, 0.34 | yes |
