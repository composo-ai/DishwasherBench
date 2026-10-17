# Demonstration wash: tutorial-careless

Level 'First load', loaded by the careless policy.

**Tier.** This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme with anchored-v8.owner-capsule (the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4), its verdict on a soiled item differs from the official wash in 9 of 100 cases: 0 in 100 for crockery, 21 in 100 for cutlery, 0 in 100 for glass, 0 in 100 for melamine. Scores are counted on the official wash.

Machine bosch_smv4hax40g, programme eco_50 (295 min, 7752 ticks), tier fast, 11 items (1 of the offer left on the counter by the loading physics), simulator spotless-sim 0.5.0 water-7, exposure on the gpu.

Mistakes in this load: spoons_nested x 1, cutlery_bunched x 1, bowl_face_down_flat x 1.

## The wash

| Quantity | Value |
|---|---|
| Time, scene | 2.0 s |
| Time, hydraulics | 0.0 s |
| Time, exposure | 0.1 s |
| Time, soil | 0.1 s |
| Time, replay | 0.3 s |
| Time, result | 0.1 s |
| Time, total | 2.7 s (0.0 min) |
| Exposure sets | 0 computed, 4 from the cache |
| Scene | 96631 blocks, 137364 soil cells, 19031 deposits |
| GPU memory | scene 0.0 MB, peak of all buffers 0.0 MB |
| Process memory (RSS) | 0.54 GB |
| Mains water, energy | 9.5 L, 0.90 kWh |
| Water held in vessels | 0 mL |
| Detergent | 12.9 of 12.9 g dissolved (dispenser free) |
| Soil | 2.50 g dry at the start, 0.00 g left (0 %) |
| Items clean | 11 of 11 |

## Water balance per spray state (kg per revolution of the master arm)

| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l@2800 | 1143 s | lower 40 rpm | 0.7050 | 0.5061 | 0.0522 | 0.1459 | 0.1974 | 0.0014 | 99.87 % | 0.098 kg | 0.016 kg | yes |
| l@3000 | 3900 s | lower 42 rpm | 0.7173 | 0.5127 | 0.0554 | 0.1485 | 0.2032 | 0.0014 | 99.89 % | 0.100 kg | 0.016 kg | yes |
| ur@2800 | 1020 s | upper 27 rpm | 0.9484 | 0.4321 | 0.0906 | 0.1396 | 0.5140 | 0.0023 | 99.87 % | 0.083 kg | 0.015 kg | yes |
| ur@3000 | 3946 s | upper 31 rpm | 0.8995 | 0.4089 | 0.0859 | 0.1317 | 0.4886 | 0.0020 | 99.89 % | 0.085 kg | 0.015 kg | yes |

## Items

| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |
|---|---|---|---|---|---|---|---|---|---|
| bowl_01 | cereal_bowl_porcelain_160 | upper | 97, 148, 523 | yoghurt 0.00 of 229.36 | 0.00 | 0 of 11725 | 5 | 0.0, 4.29 | yes |
| fork_01 | dinner_fork_185 | lower | -23, -221, 80 | spinach_particles 0.00 of 7.80 | 0.00 | 0 of 917 | 5 | 0.0, 0.35 | yes |
| fork_02 | dinner_fork_185 | lower | -17, -219, 80 | spinach_particles 0.00 of 7.77 | 0.00 | 0 of 919 | 5 | 0.0, 0.33 | yes |
| glass_01 | tumbler_250 | upper | -219, 59, 514 | avocado 0.00 of 206.42 | 0.00 | 0 of 5336 | 5 | 0.0, 1.06 | yes |
| glass_02 | tumbler_250 | upper | -216, -27, 517 | avocado 0.00 of 203.49 | 0.00 | 0 of 5335 | 5 | 0.0, 0.92 | yes |
| knife_01 | dinner_knife_210 | lower | -31, -118, 78 | butter_margarine 0.00 of 13.77 | 0.00 | 0 of 1561 | 5 | 0.0, 0.13 | yes |
| plate_01 | dinner_plate_porcelain_270 | lower | -228, -121, 213 | tomato_sauce 0.00 of 727.02 | 0.00 | 0 of 15740 | 5 | 0.0, 2.07 | yes |
| plate_02 | dinner_plate_porcelain_270 | lower | -204, -121, 211 | tomato_sauce 0.00 of 724.86 | 0.00 | 0 of 15741 | 5 | 0.0, 2.05 | yes |
| soup_plate_01 | deep_plate_porcelain_220 | lower | 160, 30, 200 | yoghurt 0.00 of 344.50 | 0.00 | 0 of 16781 | 5 | 0.0, 4.12 | yes |
| spoon_01 | dessert_spoon_160 | lower | -25, -160, 80 | yoghurt 0.00 of 18.89 | 0.00 | 0 of 896 | 5 | 0.0, 0.12 | yes |
| spoon_02 | dessert_spoon_160 | lower | 1, -158, 80 | yoghurt 0.00 of 16.96 | 0.00 | 0 of 896 | 5 | 0.0, 0.14 | yes |
