# Demonstration wash: lunch-for-four-careful

Level 'Lunch for four', loaded by the careful policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 36 items (3 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.5 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 0.2 s |
| Time, soil | 0.3 s |
| Time, replay | 0.7 s |
| Time, result | 0.2 s |
| Time, total | 3.9 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 168074 blocks, 423136 soil cells, 61021 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.66 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 7.15 g dry at the start, 0.00 g left (0 %) |
| Items clean | 36 of 36 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5108 | 0.0411 | 0.1524 | 0.1929 | 0.0012 | 99.90 % | 0.186 kg | 0.037 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5190 | 0.0429 | 0.1547 | 0.1972 | 0.0012 | 99.88 % | 0.191 kg | 0.037 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4548 | 0.0666 | 0.1408 | 0.4919 | 0.0017 | 99.96 % | 0.201 kg | 0.037 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4304 | 0.0631 | 0.1330 | 0.4675 | 0.0015 | 99.97 % | 0.207 kg | 0.037 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| fork_01 | dinner_fork_185 | lower | 4, -223, 80 | spinach_particles 0.00 of 7.31 | 0.00 | 0 of 915 | 5 | 0.0, 0.27 | yes |
| fork_02 | dinner_fork_185 | lower | -25, -50, 79 | spinach_particles 0.00 of 7.08 | 0.00 | 0 of 918 | 5 | 0.0, 0.25 | yes |
| fork_03 | dinner_fork_185 | lower | 53, -117, 80 | spinach_particles 0.00 of 8.53 | 0.00 | 0 of 916 | 5 | 0.0, 0.09 | yes |
| fork_04 | dinner_fork_185 | lower | -34, -161, 80 | spinach_particles 0.00 of 7.15 | 0.00 | 0 of 917 | 5 | 0.0, 0.13 | yes |
| ketchup_pot_01 | ramekin_porcelain_89 | upper | -28, -120, 505 | tomato_sauce 0.00 of 196.22 | 0.00 | 0 of 4440 | 5 | 0.0, 1.71 | yes |
| ketchup_pot_02 | ramekin_porcelain_89 | upper | -204, -203, 473 | tomato_sauce 0.00 of 190.54 | 0.00 | 0 of 4441 | 5 | 0.0, 1.52 | yes |
| knife_01 | dinner_knife_210 | lower | -28, -161, 78 | butter_margarine 0.00 of 13.30 | 0.00 | 0 of 1561 | 5 | 0.0, 0.21 | yes |
| knife_02 | dinner_knife_210 | lower | 49, -219, 79 | butter_margarine 0.00 of 12.98 | 0.00 | 0 of 1560 | 5 | 0.0, 0.13 | yes |
| knife_03 | dinner_knife_210 | lower | 50, -48, 79 | butter_margarine 0.00 of 12.18 | 0.00 | 0 of 1560 | 5 | 0.0, 0.13 | yes |
| knife_04 | dinner_knife_210 | lower | -15, -136, 81 | butter_margarine 0.00 of 13.63 | 0.00 | 0 of 1562 | 5 | 0.0, 0.20 | yes |
| mug_01 | mug_ceramic_300 | upper | -210, -5, 532 | tomato_sauce 0.00 of 284.72 | 0.00 | 0 of 6051 | 5 | 0.0, 1.40 | yes |
| mug_02 | mug_ceramic_300 | upper | -212, -121, 531 | tomato_sauce 0.00 of 259.41 | 0.00 | 0 of 6051 | 5 | 0.0, 1.48 | yes |
| mug_03 | mug_ceramic_300 | upper | 189, 158, 541 | tomato_sauce 0.00 of 252.43 | 0.01 | 0 of 6054 | 5 | 0.1, 2.02 | yes |
| mug_04 | mug_ceramic_300 | upper | 191, 42, 541 | tomato_sauce 0.00 of 272.08 | 0.00 | 0 of 6053 | 5 | 0.1, 1.50 | yes |
| plate_01 | dinner_plate_porcelain_270 | lower | -228, -121, 213 | tomato_sauce 0.00 of 688.01 | 0.00 | 0 of 15740 | 5 | 0.0, 2.12 | yes |
| plate_02 | dinner_plate_porcelain_270 | lower | -204, -121, 211 | tomato_sauce 0.00 of 701.55 | 0.00 | 0 of 15741 | 5 | 0.0, 1.97 | yes |
| plate_03 | dinner_plate_porcelain_270 | lower | -175, -121, 213 | tomato_sauce 0.00 of 668.80 | 0.00 | 0 of 15740 | 5 | 0.0, 2.11 | yes |
| plate_04 | dinner_plate_porcelain_270 | lower | -150, -121, 212 | tomato_sauce 0.00 of 723.35 | 0.00 | 0 of 15742 | 5 | 0.0, 1.98 | yes |
| salad_bowl_01 | serving_bowl_vitrelle_216 | lower | 219, 112, 195 | vegetable_oil 0.00 of 377.70; spinach_particles 0.00 of 34.93 | 0.00 | 0 of 27791 | 5 | 0.0, 2.15 | yes |
| side_plate_01 | dessert_plate_porcelain_190 | lower | -225, 112, 163 | vegetable_oil 0.00 of 127.62; spinach_particles 0.00 of 17.75 | 0.00 | 0 of 8371 | 5 | 0.0, 1.03 | yes |
| side_plate_02 | dessert_plate_porcelain_190 | lower | -207, 112, 163 | vegetable_oil 0.00 of 123.38; spinach_particles 0.00 of 19.34 | 0.00 | 0 of 8772 | 5 | 0.0, 1.03 | yes |
| side_plate_03 | dessert_plate_porcelain_190 | lower | -189, 112, 163 | vegetable_oil 0.00 of 129.30; spinach_particles 0.00 of 18.93 | 0.00 | 0 of 8314 | 5 | 0.0, 1.01 | yes |
| side_plate_04 | dessert_plate_porcelain_190 | lower | -170, 112, 163 | vegetable_oil 0.00 of 102.57; spinach_particles 0.00 of 17.73 | 0.00 | 0 of 8685 | 5 | 0.0, 1.02 | yes |
| smoothie_glass_01 | tumbler_250 | upper | 196, -49, 528 | avocado 0.00 of 194.73 | 0.00 | 0 of 5335 | 5 | 0.0, 0.83 | yes |
| smoothie_glass_02 | tumbler_250 | upper | 196, -142, 528 | avocado 0.00 of 211.74 | 0.00 | 0 of 5336 | 5 | 0.0, 0.93 | yes |
| smoothie_glass_04 | tumbler_250 | upper | 98, 81, 522 | avocado 0.00 of 211.59 | 0.00 | 0 of 5338 | 5 | 0.0, 0.97 | yes |
| spoon_01 | dessert_spoon_160 | lower | -26, -116, 80 | yoghurt 0.00 of 19.27 | 0.00 | 0 of 899 | 5 | 0.0, 0.12 | yes |
| spoon_02 | dessert_spoon_160 | lower | 48, -159, 80 | yoghurt 0.00 of 18.93 | 0.00 | 0 of 899 | 5 | 0.0, 0.11 | yes |
| spoon_03 | dessert_spoon_160 | lower | 7, -224, 80 | yoghurt 0.00 of 17.76 | 0.00 | 0 of 898 | 5 | 0.0, 0.27 | yes |
| spoon_04 | dessert_spoon_160 | lower | -21, -50, 79 | yoghurt 0.00 of 18.53 | 0.00 | 0 of 896 | 5 | 0.0, 0.16 | yes |
| squash_glass_01 | tumbler_360 | upper | 121, 179, 550 | avocado 0.00 of 187.99 | 0.00 | 0 of 4870 | 5 | 0.0, 1.26 | yes |
| squash_glass_02 | tumbler_360 | upper | 115, -139, 552 | avocado 0.00 of 197.14 | 0.00 | 0 of 4868 | 5 | 0.0, 1.30 | yes |
| yoghurt_bowl_01 | cereal_bowl_vitrelle_159 | upper | -84, 158, 510 | yoghurt 0.00 of 187.85 | 0.00 | 0 of 9908 | 5 | 0.0, 1.46 | yes |
| yoghurt_bowl_02 | cereal_bowl_vitrelle_159 | upper | -82, 125, 510 | yoghurt 0.00 of 211.27 | 0.00 | 0 of 9908 | 5 | 0.0, 1.40 | yes |
| yoghurt_bowl_03 | cereal_bowl_vitrelle_159 | upper | -83, 89, 510 | yoghurt 0.00 of 200.76 | 0.00 | 0 of 9909 | 5 | 0.0, 1.40 | yes |
| yoghurt_bowl_04 | cereal_bowl_vitrelle_159 | upper | -82, 31, 511 | yoghurt 0.00 of 183.13 | 0.00 | 0 of 9909 | 5 | 0.0, 1.39 | yes |
