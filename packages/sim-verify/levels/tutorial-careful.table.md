# Demonstration wash: tutorial-careful

Level 'First load', loaded by the careful policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 12 items (0 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 3.9 s |
| Time, hydraulics | 0.1 s |
| Time, exposure | 0.1 s |
| Time, soil | 0.1 s |
| Time, replay | 0.4 s |
| Time, result | 0.2 s |
| Time, total | 4.7 s (0.1 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 100023 blocks, 150932 soil cells, 20540 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.53 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 2.77 g dry at the start, 0.00 g left (0 %) |
| Items clean | 12 of 12 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5062 | 0.0523 | 0.1458 | 0.1974 | 0.0014 | 99.87 % | 0.097 kg | 0.015 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5130 | 0.0555 | 0.1481 | 0.2029 | 0.0014 | 99.89 % | 0.099 kg | 0.015 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4320 | 0.0904 | 0.1399 | 0.5141 | 0.0023 | 99.86 % | 0.083 kg | 0.014 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4087 | 0.0858 | 0.1320 | 0.4888 | 0.0020 | 99.89 % | 0.085 kg | 0.014 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| bowl_01 | cereal_bowl_porcelain_160 | upper | 99, 156, 529 | yoghurt 0.00 of 229.36 | 0.00 | 0 of 11725 | 5 | 0.0, 2.78 | yes |
| fork_01 | dinner_fork_185 | lower | -25, -220, 80 | spinach_particles 0.00 of 7.80 | 0.00 | 0 of 917 | 5 | 0.0, 0.11 | yes |
| fork_02 | dinner_fork_185 | lower | -25, -50, 80 | spinach_particles 0.00 of 7.77 | 0.00 | 0 of 919 | 5 | 0.0, 0.11 | yes |
| glass_01 | tumbler_250 | upper | -217, 62, 515 | avocado 0.00 of 206.42 | 0.00 | 0 of 5336 | 5 | 0.0, 0.95 | yes |
| glass_02 | tumbler_250 | upper | -216, -24, 516 | avocado 0.00 of 203.49 | 0.00 | 0 of 5335 | 5 | 0.0, 0.90 | yes |
| knife_01 | dinner_knife_210 | lower | -29, -116, 78 | butter_margarine 0.00 of 13.77 | 0.00 | 0 of 1561 | 5 | 0.0, 0.10 | yes |
| mug_01 | mug_ceramic_300 | upper | -209, 158, 532 | tomato_sauce 0.00 of 268.52 | 0.00 | 0 of 6051 | 5 | 0.0, 1.42 | yes |
| plate_01 | dinner_plate_porcelain_270 | lower | -228, -121, 213 | tomato_sauce 0.00 of 727.02 | 0.00 | 0 of 15740 | 5 | 0.0, 2.04 | yes |
| plate_02 | dinner_plate_porcelain_270 | lower | -204, -121, 211 | tomato_sauce 0.00 of 724.86 | 0.00 | 0 of 15741 | 5 | 0.0, 2.03 | yes |
| soup_plate_01 | deep_plate_porcelain_220 | lower | 160, 31, 200 | yoghurt 0.00 of 344.50 | 0.00 | 0 of 16781 | 5 | 0.0, 4.07 | yes |
| spoon_01 | dessert_spoon_160 | lower | -28, -161, 79 | yoghurt 0.00 of 18.89 | 0.00 | 0 of 896 | 5 | 0.0, 0.07 | yes |
| spoon_02 | dessert_spoon_160 | lower | 47, -220, 80 | yoghurt 0.00 of 16.96 | 0.00 | 0 of 896 | 5 | 0.0, 0.07 | yes |
