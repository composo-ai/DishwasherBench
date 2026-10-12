# Run-to-run scatter (eco_50, careful load)

water side: spotless-sim 0.3.2 water-3, sources 97aa4d392843 (176 files).

| Simulation seed | Level seed | Mean score | Mean, standard weights | Items clean | Soiled items clean | Crockery | Cutlery | Glass | Melamine |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 4.186 | 3.831 | 75 | 46 | 2.56 | 4.56 | 3.42 | 5.00 |
| 1 | 2 | 4.144 | 3.805 | 73 | 44 | 2.56 | 4.49 | 3.51 | 5.00 |
| 1 | 3 | 4.206 | 3.855 | 74 | 45 | 2.56 | 4.58 | 3.51 | 5.00 |
| 1 | 4 | 4.216 | 3.864 | 76 | 47 | 2.56 | 4.58 | 3.61 | 5.00 |
| 2 | 1 | 4.247 | 3.883 | 81 | 52 | 2.56 | 4.66 | 3.42 | 5.00 |
| 2 | 2 | 4.258 | 3.903 | 79 | 50 | 2.56 | 4.65 | 3.61 | 5.00 |
| 2 | 3 | 4.289 | 3.932 | 78 | 49 | 2.56 | 4.68 | 3.70 | 5.00 |
| 2 | 4 | 4.320 | 3.951 | 81 | 52 | 2.56 | 4.74 | 3.61 | 5.00 |
| 3 | 1 | 4.227 | 3.867 | 76 | 47 | 2.56 | 4.63 | 3.42 | 5.00 |
| 3 | 2 | 4.237 | 3.887 | 78 | 49 | 2.56 | 4.62 | 3.61 | 5.00 |
| 3 | 3 | 4.278 | 3.926 | 79 | 50 | 2.56 | 4.67 | 3.70 | 5.00 |
| 3 | 4 | 4.227 | 3.870 | 78 | 49 | 2.56 | 4.61 | 3.51 | 5.00 |
| 4 | 1 | 4.165 | 3.804 | 74 | 45 | 2.56 | 4.57 | 3.24 | 5.00 |
| 4 | 2 | 4.134 | 3.799 | 72 | 43 | 2.56 | 4.47 | 3.51 | 5.00 |
| 4 | 3 | 4.216 | 3.881 | 76 | 47 | 2.56 | 4.55 | 3.79 | 5.00 |
| 4 | 4 | 4.247 | 3.898 | 77 | 48 | 2.56 | 4.61 | 3.70 | 5.00 |

Over the 16 washes, mean (standard deviation), standard weights: crockery 2.56 (0.00), cutlery 4.61 (0.07), glass 3.55 (0.14), melamine 5.00 (0.00), all 3.87 (0.05); mean over the items of the load 4.225 (0.051); items clean 72 to 81; soiled items clean 43 to 52 of 68 (mean 47.7).
Standard deviation of the load mean: 0.047 over the simulation seed at one level seed, 0.035 over the level seed at one simulation seed. Published repeatability of the mean score: 0.09 (standards 7.1).

## Verdicts of single items

| What changes between two washes | Pairs | Scores that differ, of the soiled items (mean, range) | Verdicts that flip (mean, range) | Soiled items whose verdict is not the same at every seed |
|---|---|---|---|---|
| Simulation seed only | 24 | 11.0, 5 to 16 of 68 | 6.2, 2 to 9 | 11.3 of 68 at one level seed on average; 19 distinct items over all (fork 8, knife 5, soup_spoon 3, glass 3) |
| Level seed only | 24 | 13.7, 9 to 19 of 68 | 6.5, 2 to 10 | 11.3 of 68 at one simulation seed on average; 20 distinct items over all (fork 7, knife 6, glass 4, soup_spoon 3) |
| Tier (fast against official, same seeds) | 4 | 26.3, 23 to 28 of 68 | 16.5, 13 to 20 | fork 29, soup_spoon 19, knife 10, glass 4, dinner_plate 4 |

| Level seed | Simulation seed | Official: mean, standard weights; soiled clean | Fast: mean, standard weights; soiled clean | Verdicts that agree |
|---|---|---|---|---|
| 1 | 1 | 4.186, 3.831; 46 | 3.897, 3.555; 41 | 55 of 68 (81 %) |
| 2 | 1 | 4.144, 3.805; 44 | 3.825, 3.503; 40 | 52 of 68 (76 %) |
| 1 | 2 | 4.247, 3.883; 52 | 3.753, 3.430; 36 | 48 of 68 (71 %) |
| 2 | 2 | 4.258, 3.903; 50 | 3.784, 3.466; 37 | 51 of 68 (75 %) |

Items that flip with the simulation seed, by how many of the 4 level seeds they flip at: fork_04 4, fork_06 4, fork_11 4, soup_spoon_08 4, fork_02 3, fork_03 3, knife_07 3, soup_spoon_12 3, fork_08 2, glass_01 2, glass_02 2, knife_01 2, knife_03 2, knife_10 2, fork_01 1, fork_05 1, glass_07 1, knife_11 1, soup_spoon_03 1.
