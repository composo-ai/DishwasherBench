# Run-to-run scatter (eco_50, careful load)

water side: spotless-sim 0.3.2 water-3, sources 97aa4d392843 (176 files).

| Simulation seed | Level seed | Mean score | Mean, standard weights | Items clean | Soiled items clean | Crockery | Cutlery | Glass | Melamine |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 4.433 | 4.072 | 85 | 56 | 2.56 | 4.82 | 4.16 | 5.00 |
| 1 | 2 | 4.392 | 4.028 | 82 | 53 | 2.56 | 4.79 | 3.98 | 5.00 |
| 1 | 3 | 4.433 | 4.072 | 84 | 55 | 2.56 | 4.82 | 4.16 | 5.00 |
| 1 | 4 | 4.464 | 4.102 | 86 | 57 | 2.56 | 4.85 | 4.26 | 5.00 |
| 2 | 1 | 4.443 | 4.082 | 85 | 56 | 2.56 | 4.84 | 4.16 | 5.00 |
| 2 | 2 | 4.402 | 4.037 | 83 | 54 | 2.56 | 4.80 | 3.98 | 5.00 |
| 2 | 3 | 4.402 | 4.048 | 83 | 54 | 2.56 | 4.77 | 4.16 | 5.00 |
| 2 | 4 | 4.464 | 4.103 | 86 | 57 | 2.56 | 4.85 | 4.26 | 5.00 |
| 3 | 1 | 4.464 | 4.098 | 84 | 55 | 2.56 | 4.87 | 4.16 | 5.00 |
| 3 | 2 | 4.433 | 4.063 | 85 | 56 | 2.56 | 4.85 | 3.98 | 5.00 |
| 3 | 3 | 4.464 | 4.099 | 86 | 57 | 2.56 | 4.87 | 4.16 | 5.00 |
| 3 | 4 | 4.505 | 4.136 | 87 | 58 | 2.56 | 4.91 | 4.26 | 5.00 |
| 4 | 1 | 4.412 | 4.054 | 84 | 55 | 2.56 | 4.78 | 4.16 | 5.00 |
| 4 | 2 | 4.381 | 4.019 | 82 | 53 | 2.56 | 4.77 | 3.98 | 5.00 |
| 4 | 3 | 4.433 | 4.077 | 87 | 58 | 2.56 | 4.80 | 4.26 | 5.00 |
| 4 | 4 | 4.443 | 4.085 | 86 | 57 | 2.56 | 4.82 | 4.26 | 5.00 |

Over the 16 washes, mean (standard deviation), standard weights: crockery 2.56 (0.00), cutlery 4.82 (0.04), glass 4.15 (0.11), melamine 5.00 (0.00), all 4.07 (0.03); mean over the items of the load 4.436 (0.032); items clean 82 to 87; soiled items clean 53 to 58 of 68 (mean 55.7).
Standard deviation of the load mean: 0.024 over the simulation seed at one level seed, 0.029 over the level seed at one simulation seed. Published repeatability of the mean score: 0.09 (standards 7.1).

## Verdicts of single items

| What changes between two washes | Pairs | Scores that differ, of the soiled items (mean, range) | Verdicts that flip (mean, range) | Soiled items whose verdict is not the same at every seed |
|---|---|---|---|---|
| Simulation seed only | 24 | 6.7, 4 to 10 of 68 | 2.8, 0 to 6 | 4.8 of 68 at one level seed on average; 9 distinct items over all (knife 4, fork 3, soup_spoon 1, glass 1) |
| Level seed only | 24 | 8.0, 4 to 11 of 68 | 3.5, 1 to 5 | 6.3 of 68 at one simulation seed on average; 11 distinct items over all (knife 4, fork 3, glass 3, soup_spoon 1) |
| Tier (fast against official, same seeds) | 4 | 19.3, 17 to 23 of 68 | 13.5, 9 to 18 | fork 32, soup_spoon 11, glass 7, knife 4 |

| Level seed | Simulation seed | Official: mean, standard weights; soiled clean | Fast: mean, standard weights; soiled clean | Verdicts that agree |
|---|---|---|---|---|
| 1 | 1 | 4.433, 4.072; 56 | 3.948, 3.604; 43 | 55 of 68 (81 %) |
| 2 | 1 | 4.392, 4.028; 53 | 3.969, 3.650; 44 | 59 of 68 (87 %) |
| 1 | 2 | 4.443, 4.082; 56 | 3.897, 3.571; 40 | 50 of 68 (74 %) |
| 2 | 2 | 4.402, 4.037; 54 | 3.948, 3.629; 42 | 54 of 68 (79 %) |

Items that flip with the simulation seed, by how many of the 4 level seeds they flip at: knife_07 3, soup_spoon_10 3, fork_03 2, fork_04 2, fork_09 2, knife_01 2, knife_03 2, knife_13 2, glass_03 1.
