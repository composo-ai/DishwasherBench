# Joint log posterior on a grid: amounts-less

Records: owner-wash-01-amounts-less (weight 1), std-eu-13.round-robin-ta.detergent-d (weight 0.25). Base set packages/calibration/anchors/anchored-v5.owner-capsule.json. Prior of the duty: the label's energy (centre 0.53, deviation 0.49 in the logarithm).

| prog.soakDuty | log posterior | owner | literature | prior | 9121: nominal, median (range) mm2, clean | 9122: nominal, median (range) mm2, clean | 9123: nominal, median (range) mm2, clean | 9124: nominal, median (range) mm2, clean | D protease | crockery | cutlery | glass (milk) | tea |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.5 | -1.51 | -7.32 | -0.687 | -0.01 | 616, 616 (0.15 to 14600), 6 % | 111, 111 (0 to 10100), 18 % | 7.58, 7.58 (0 to 4450), 38 % | 123, 123 (0 to 8100), 18 % | 0.02 | 3.66 | 4.51 | 2.38 (0.96) | 1.90 |
| 0.6 | -0.23 | -6.14 | -0.557 | -0.03 | 178, 178 (0 to 10600), 6 % | 19.7, 19.7 (0 to 5700), 38 % | 0.663, 0.663 (0 to 1910), 62 % | 22.9, 22.9 (0 to 6210), 38 % | 0.02 | 3.53 | 4.58 | 2.95 (1.85) | 1.50 |
| 0.7 | 0.00 | -5.81 | -0.533 | -0.16 | 32.3, 32.3 (0 to 6410), 18 % | 4.08, 4.08 (0 to 2830), 38 % | 0, 0 (0 to 707), 82 % | 5.86, 5.86 (0 to 4350), 38 % | 0.02 | 3.46 | 4.62 | 3.43 (2.58) | 1.25 |
| 0.8 | -0.01 | -5.62 | -0.545 | -0.35 | 9.9, 9.9 (0 to 4020), 38 % | 0.608, 0.608 (0 to 1380), 62 % | 0, 0 (0 to 252), 94 % | 1.7, 1.7 (0 to 2900), 62 % | 0.016 | 3.41 | 4.63 | 3.15 (2.15) | 1.15 |
| 0.9 | -0.71 | -6.08 | -0.545 | -0.58 | 3.5, 3.5 (0 to 2160), 62 % | 0, 0 (0 to 624), 82 % | 0, 0 (0 to 82.8), 94 % | 0.35, 0.35 (0 to 1830), 62 % | 0.016 | 3.34 | 4.55 | 3.41 (2.55) | 0.97 |
| 1 | -1.30 | -6.40 | -0.566 | -0.84 | 1.55, 1.55 (0 to 1380), 62 % | 0, 0 (0 to 329), 82 % | 0, 0 (0 to 33.2), 99 % | 0, 0 (0 to 1190), 82 % | 0.016 | 3.28 | 4.49 | 3.65 (2.92) | 0.85 |

Log posterior relative to the best grid point (-6.503 at prog.soakDuty = 0.7).

Profile of `prog.soakDuty` on the grid (best over the others): 0.5: -1.51, 0.6: -0.23, 0.7: 0.00, 0.8: -0.01, 0.9: -0.71, 1: -1.30. Grid values inside the 95 % profile interval (a fall of 1.92): 0.5 to 1.
