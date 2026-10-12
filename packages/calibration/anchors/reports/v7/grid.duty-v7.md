# Joint log posterior on a grid: duty-v7

Records: owner-wash-01-egg-yolk-eco50 (weight 1), std-eu-13.round-robin-ta.detergent-d (weight 0.25). Base set packages/calibration/anchors/anchored-v7.owner-capsule.json. Prior of the duty: the label's energy (centre 0.53, deviation 0.49 in the logarithm).

| prog.soakDuty | log posterior | owner | literature | prior | 9121: nominal, median (range) mm2, clean | 9122: nominal, median (range) mm2, clean | 9123: nominal, median (range) mm2, clean | 9124: nominal, median (range) mm2, clean | D protease | crockery | cutlery | glass (milk) | tea |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.6 | -1.90 | -7.58 | -0.546 | -0.00 | 660, 660 (0.529 to 14800), 1 % | 177, 177 (0 to 11400), 18 % | 16.7, 16.7 (0 to 5420), 38 % | 179, 179 (0 to 8690), 18 % | 0.02 | 3.65 | 4.68 | 3.13 (2.13) | 1.75 |
| 0.7 | -0.79 | -6.46 | -0.536 | -0.03 | 182, 182 (0 to 10700), 6 % | 40.2, 40.2 (0 to 7360), 18 % | 2.05, 2.05 (0 to 2760), 62 % | 42.8, 42.8 (0 to 7250), 18 % | 0.02 | 3.54 | 4.69 | 3.33 (2.44) | 1.40 |
| 0.8 | -0.35 | -5.94 | -0.548 | -0.09 | 60.5, 60.5 (0 to 7680), 18 % | 11.2, 11.2 (0 to 4490), 38 % | 0.212, 0.212 (0 to 1360), 62 % | 13.3, 13.3 (0 to 5740), 38 % | 0.016 | 3.44 | 4.66 | 3.13 (2.13) | 1.10 |
| 0.9 | 0.00 | -5.48 | -0.545 | -0.20 | 16.8, 16.8 (0 to 4880), 38 % | 3.23, 3.23 (0 to 2540), 62 % | 0, 0 (0 to 603), 82 % | 4.56, 4.56 (0 to 4290), 38 % | 0.016 | 3.43 | 4.60 | 3.29 (2.38) | 1.05 |
| 1 | -0.52 | -5.83 | -0.562 | -0.35 | 7.82, 7.82 (0 to 3420), 38 % | 0.892, 0.892 (0 to 1580), 62 % | 0, 0 (0 to 300), 94 % | 2.02, 2.02 (0 to 3270), 62 % | 0.016 | 3.40 | 4.48 | 3.62 (2.88) | 0.95 |

Log posterior relative to the best grid point (-6.228 at prog.soakDuty = 0.9).

Profile of `prog.soakDuty` on the grid (best over the others): 0.6: -1.90, 0.7: -0.79, 0.8: -0.35, 0.9: 0.00, 1: -0.52. Grid values inside the 95 % profile interval (a fall of 1.92): 0.6 to 1.
