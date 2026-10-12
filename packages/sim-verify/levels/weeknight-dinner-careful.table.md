# Demonstration wash: weeknight-dinner-careful

Level 'Weeknight dinner', loaded by the careful policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v7.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 11 of 100 cases: 0 in 100 for crockery, 23 in 100 for cutlery, 5 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 40 items (6 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.3 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 45.9 s |
| Time, soil | 0.2 s |
| Time, replay | 0.9 s |
| Time, result | 0.2 s |
| Time, total | 49.5 s (0.8 min) |
| Exposure sets | 4 computed, 0 from the cache |
| Scene | 171296 blocks, 436024 soil cells, 67686 deposits |
| GPU memory | scene 129.7 MB, peak of all buffers 129.7 MB |
| Process memory (RSS) | 1.18 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 10.75 g dry at the start, 0.00 g left (0 %) |
| Items clean | 39 of 40 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5135 | 0.0425 | 0.1483 | 0.1903 | 0.0012 | 99.90 % | 0.203 kg | 0.042 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5209 | 0.0452 | 0.1505 | 0.1952 | 0.0012 | 99.91 % | 0.209 kg | 0.042 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4548 | 0.0665 | 0.1409 | 0.4922 | 0.0014 | 99.96 % | 0.218 kg | 0.042 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4302 | 0.0633 | 0.1330 | 0.4681 | 0.0012 | 99.95 % | 0.224 kg | 0.042 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| fork_01 | dinner_fork_185 | lower | -24, -222, 80 | spinach_particles 0.00 of 8.19 | 0.00 | 0 of 921 | 5 | 0.0, 0.15 | yes |
| fork_02 | dinner_fork_185 | lower | 67, -216, 80 | spinach_particles 0.00 of 7.80 | 0.00 | 0 of 922 | 5 | 0.0, 0.32 | yes |
| fork_03 | dinner_fork_185 | lower | 70, -65, 80 | spinach_particles 0.00 of 7.65 | 0.00 | 0 of 919 | 5 | 0.0, 0.07 | yes |
| fork_04 | dinner_fork_185 | lower | -24, -104, 79 | spinach_particles 0.00 of 8.18 | 0.00 | 0 of 919 | 5 | 0.0, 0.12 | yes |
| guacamole_pot_01 | ramekin_porcelain_89 | upper | 197, -189, 475 | avocado 0.00 of 182.90 | 0.00 | 0 of 4441 | 5 | 0.0, 1.31 | yes |
| guacamole_pot_02 | ramekin_porcelain_89 | upper | 27, -28, 490 | avocado 0.00 of 185.59 | 0.00 | 0 of 4440 | 5 | 0.0, 2.11 | yes |
| guacamole_pot_03 | ramekin_porcelain_89 | upper | 25, -130, 490 | avocado 0.00 of 176.91 | 0.00 | 0 of 4440 | 5 | 0.0, 2.05 | yes |
| ketchup_pot_01 | ramekin_porcelain_89 | upper | 73, 173, 519 | tomato_sauce 0.00 of 185.73 | 0.00 | 0 of 4441 | 5 | 0.0, 3.40 | yes |
| ketchup_pot_02 | ramekin_porcelain_89 | upper | -204, -203, 473 | tomato_sauce 0.00 of 218.70 | 0.00 | 0 of 4440 | 5 | 0.0, 1.51 | yes |
| knife_01 | dinner_knife_210 | lower | -27, -160, 78 | butter_margarine 0.00 of 14.07 | 0.00 | 0 of 1562 | 5 | 0.0, 0.10 | yes |
| knife_02 | dinner_knife_210 | lower | 48, -160, 79 | butter_margarine 0.00 of 13.60 | 0.00 | 0 of 1562 | 5 | 0.0, 0.11 | yes |
| knife_03 | dinner_knife_210 | lower | -17, -223, 79 | butter_margarine 0.00 of 12.99 | 0.00 | 0 of 1563 | 5 | 0.0, 0.16 | yes |
| knife_04 | dinner_knife_210 | lower | -45, -34, 81 | butter_margarine 0.00 of 13.12 | 0.00 | 0 of 1561 | 5 | 0.0, 0.12 | yes |
| lid_01 | lid_steel_165 | lower | 220, -140, 140 | tomato_sauce 0.00 of 410.95 | 0.00 | 0 of 8641 | 5 | 0.0, 1.47 | yes |
| mug_01 | mug_ceramic_300 | upper | -209, -5, 533 | tomato_sauce 0.00 of 288.67 | 0.00 | 0 of 6052 | 5 | 0.1, 1.46 | yes |
| mug_02 | mug_ceramic_300 | upper | -212, -121, 531 | tomato_sauce 0.00 of 274.15 | 0.00 | 0 of 6053 | 5 | 0.0, 1.48 | yes |
| pasta_bowl_01 | cereal_bowl_vitrelle_159 | upper | -83, 157, 510 | pasta_starch 0.00 of 380.23 | 0.00 | 0 of 9909 | 5 | 0.0, 1.44 | yes |
| pasta_bowl_02 | cereal_bowl_vitrelle_159 | upper | -82, 125, 509 | pasta_starch 0.00 of 361.59 | 0.00 | 0 of 9909 | 5 | 0.0, 1.40 | yes |
| pasta_bowl_03 | cereal_bowl_vitrelle_159 | upper | -83, 89, 510 | pasta_starch 0.00 of 330.95 | 0.00 | 0 of 9909 | 5 | 0.0, 1.41 | yes |
| pasta_bowl_04 | cereal_bowl_vitrelle_159 | upper | -82, 31, 511 | pasta_starch 0.00 of 376.12 | 0.00 | 0 of 9909 | 5 | 0.0, 1.40 | yes |
| plate_01 | dinner_plate_porcelain_270 | lower | -228, -121, 213 | tomato_sauce 0.00 of 680.59 | 0.00 | 0 of 15742 | 5 | 0.0, 2.23 | yes |
| plate_02 | dinner_plate_porcelain_270 | lower | -204, -121, 211 | tomato_sauce 0.00 of 750.19 | 0.00 | 0 of 15742 | 5 | 0.0, 1.99 | yes |
| plate_03 | dinner_plate_porcelain_270 | lower | -174, -121, 213 | tomato_sauce 0.00 of 717.98 | 0.00 | 0 of 15740 | 5 | 0.0, 2.09 | yes |
| plate_04 | dinner_plate_porcelain_270 | lower | -151, -121, 212 | tomato_sauce 0.00 of 688.78 | 0.00 | 0 of 15740 | 5 | 0.0, 2.01 | yes |
| salad_bowl_01 | serving_bowl_vitrelle_216 | lower | 132, 201, 185 | vegetable_oil 0.00 of 396.05; spinach_particles 0.00 of 34.46 | 0.00 | 0 of 27713 | 5 | 0.0, 2.73 | yes |
| serving_spoon_01 | serving_spoon_216 | lower | 1, -29, 83 | tomato_sauce 1.89 of 127.22 | 1.89 | 45 of 2993 | 2 | 0.0, 0.14 | no |
| side_plate_01 | dessert_plate_porcelain_190 | lower | -225, 112, 163 | vegetable_oil 0.00 of 101.91; spinach_particles 0.00 of 17.99 | 0.00 | 0 of 8742 | 5 | 0.0, 1.02 | yes |
| side_plate_02 | dessert_plate_porcelain_190 | lower | -207, 112, 163 | vegetable_oil 0.00 of 113.01; spinach_particles 0.00 of 18.53 | 0.00 | 0 of 8270 | 5 | 0.0, 1.03 | yes |
| side_plate_03 | dessert_plate_porcelain_190 | lower | -189, 112, 163 | vegetable_oil 0.00 of 112.44; spinach_particles 0.00 of 18.14 | 0.00 | 0 of 8777 | 5 | 0.0, 1.02 | yes |
| side_plate_04 | dessert_plate_porcelain_190 | lower | -170, 112, 163 | vegetable_oil 0.00 of 108.27; spinach_particles 0.00 of 19.44 | 0.00 | 0 of 8742 | 5 | 0.0, 1.02 | yes |
| smoothie_glass_01 | tumbler_250 | upper | 197, 180, 528 | avocado 0.00 of 221.03 | 0.00 | 0 of 5339 | 5 | 0.0, 0.86 | yes |
| smoothie_glass_02 | tumbler_250 | upper | 196, 91, 528 | avocado 0.00 of 224.18 | 0.00 | 0 of 5336 | 5 | 0.0, 0.91 | yes |
| smoothie_glass_03 | tumbler_250 | upper | 196, -3, 528 | avocado 0.00 of 217.91 | 0.00 | 0 of 5336 | 5 | 0.0, 0.84 | yes |
| smoothie_glass_04 | tumbler_250 | upper | 196, -93, 528 | avocado 0.00 of 204.11 | 0.00 | 0 of 5338 | 5 | 0.0, 0.84 | yes |
| spoon_01 | dessert_spoon_160 | lower | -28, -116, 80 | yoghurt 0.00 of 18.70 | 0.00 | 0 of 899 | 5 | 0.0, 0.14 | yes |
| spoon_02 | dessert_spoon_160 | lower | 50, -116, 80 | yoghurt 0.00 of 17.58 | 0.00 | 0 of 896 | 5 | 0.0, 0.10 | yes |
| spoon_03 | dessert_spoon_160 | lower | -36, -161, 79 | yoghurt 0.00 of 18.14 | 0.00 | 0 of 896 | 5 | 0.0, 0.14 | yes |
| spoon_04 | dessert_spoon_160 | lower | 70, -220, 80 | yoghurt 0.00 of 17.97 | 0.00 | 0 of 896 | 5 | 0.0, 0.27 | yes |
| tumbler_01 | tumbler_360 | upper | 115, 82, 552 | sugar_syrup 0.00 of 587.40 | 0.00 | 0 of 7304 | 5 | 0.0, 1.33 | yes |
| turner_01 | turner_nylon_279 | lower | 20, -51, 77 | lard_tallow 0.00 of 1856.50 | 0.00 | 0 of 11325 | 5 | 0.0, 0.38 | yes |
