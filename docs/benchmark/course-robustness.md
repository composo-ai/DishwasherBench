# Robustness of a score on three levels of the course

Written by `pnpm --filter @spotless/bench robustness` on 17 October 2026 (`spotless-sim 0.5.0 water-7`, `anchored-v8.owner-capsule`). Levels 2, 4 and 7, the careful and the careless reference load. What it shows is in `docs/benchmark/levels.md` section 7. The same study on `anchored-v7` (12 October) had the four cases of the soak and the supply exchange only; the three of the capsule's protease and the protein class's bake rate were added with the eighth anchoring (`docs/calibration/anchoring-v8.md`).

## Both ends of the least certain parameters, official tier

Each case is a replay on the exposure of the reference wash.

Level lunch-for-four (232 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | reference | reference |
| soak-0.59 | soak duty 0.59 (lower end of the interval the calibration on the owner's wash 01 gives; the set has 0.8) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| soak-1.0 | soak duty 1 (circulation throughout; the upper end) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| exchange-0.005 | supply exchange 0.005 (turning a plate costs less; lower end of what the wash allows; the set has 0.02) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| exchange-0.08 | supply exchange 0.08 (upper end of what the wash allows) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| protease-0.023 | the capsule's protease 0.023 (lower end of the interval the fit on both of the owner's washes gives; the set has 0.05, the top of its range) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| protein-bake-1e-5 | the protein class sets on heating at 1e-5 (lower end of its range; the set has 7.5e-5, the fit on both washes leaves the whole range open) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| protein-bake-1e-4 | the protein class sets on heating at 1e-4 (upper end of its range) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |

Level breakfast (220 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 174 (34 of 34 clean) | 112 (24 of 34 clean) | 62 | 28.2 % | reference | reference |
| soak-0.59 | soak duty 0.59 (lower end of the interval the calibration on the owner's wash 01 gives; the set has 0.8) | 145 (27 of 34 clean) | 87 (19 of 34 clean) | 58 | 26.4 % | 7 (29) | 5 (25) |
| soak-1.0 | soak duty 1 (circulation throughout; the upper end) | 174 (34 of 34 clean) | 112 (24 of 34 clean) | 62 | 28.2 % | 0 (0) | 0 (0) |
| exchange-0.005 | supply exchange 0.005 (turning a plate costs less; lower end of what the wash allows; the set has 0.02) | 174 (34 of 34 clean) | 116 (26 of 34 clean) | 58 | 26.4 % | 0 (0) | 2 (4) |
| exchange-0.08 | supply exchange 0.08 (upper end of what the wash allows) | 158 (31 of 34 clean) | 105 (23 of 34 clean) | 53 | 24.1 % | 3 (16) | 1 (7) |
| protease-0.023 | the capsule's protease 0.023 (lower end of the interval the fit on both of the owner's washes gives; the set has 0.05, the top of its range) | 151 (30 of 34 clean) | 91 (21 of 34 clean) | 60 | 27.3 % | 4 (23) | 3 (21) |
| protein-bake-1e-5 | the protein class sets on heating at 1e-5 (lower end of its range; the set has 7.5e-5, the fit on both washes leaves the whole range open) | 174 (34 of 34 clean) | 112 (24 of 34 clean) | 62 | 28.2 % | 0 (0) | 0 (0) |
| protein-bake-1e-4 | the protein class sets on heating at 1e-4 (upper end of its range) | 174 (34 of 34 clean) | 112 (24 of 34 clean) | 62 | 28.2 % | 0 (0) | 0 (0) |

Level dinner-party (367 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 250 (46 of 49 clean) | 100 (27 of 51 clean) | 150 | 40.9 % | reference | reference |
| soak-0.59 | soak duty 0.59 (lower end of the interval the calibration on the owner's wash 01 gives; the set has 0.8) | 219 (43 of 49 clean) | 76 (19 of 51 clean) | 143 | 39.0 % | 5 (35) | 8 (24) |
| soak-1.0 | soak duty 1 (circulation throughout; the upper end) | 248 (45 of 49 clean) | 100 (27 of 51 clean) | 148 | 40.3 % | 1 (2) | 0 (0) |
| exchange-0.005 | supply exchange 0.005 (turning a plate costs less; lower end of what the wash allows; the set has 0.02) | 255 (48 of 49 clean) | 102 (28 of 51 clean) | 153 | 41.7 % | 2 (5) | 1 (2) |
| exchange-0.08 | supply exchange 0.08 (upper end of what the wash allows) | 237 (43 of 49 clean) | 91 (23 of 51 clean) | 146 | 39.8 % | 3 (13) | 4 (9) |
| protease-0.023 | the capsule's protease 0.023 (lower end of the interval the fit on both of the owner's washes gives; the set has 0.05, the top of its range) | 196 (39 of 49 clean) | 100 (27 of 51 clean) | 96 | 26.2 % | 7 (54) | 0 (0) |
| protein-bake-1e-5 | the protein class sets on heating at 1e-5 (lower end of its range; the set has 7.5e-5, the fit on both washes leaves the whole range open) | 250 (46 of 49 clean) | 100 (27 of 51 clean) | 150 | 40.9 % | 0 (0) | 0 (0) |
| protein-bake-1e-4 | the protein class sets on heating at 1e-4 (upper end of its range) | 241 (45 of 49 clean) | 100 (27 of 51 clean) | 141 | 38.4 % | 1 (9) | 0 (0) |

| Level | Margin, smallest to largest | Most verdicts of a load moved by the seed | by a parameter | Ranking of careful over careless |
|---|---|---|---|---|
| lunch-for-four | 53 to 53 | 0 | 0 | holds in every case |
| breakfast | 53 to 62 | 0 | 7 | holds in every case |
| dinner-party | 96 to 153 | 0 | 8 | holds in every case |

## Three seeds of the wash, fast tier

Each seed is another seed of the wash's own sampling.

Level lunch-for-four (232 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | reference | reference |
| seed-2 | another seed of the wash (2) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| seed-3 | another seed of the wash (3) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |

Level breakfast (220 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 174 (34 of 34 clean) | 116 (26 of 34 clean) | 58 | 26.4 % | reference | reference |
| seed-2 | another seed of the wash (2) | 174 (34 of 34 clean) | 116 (26 of 34 clean) | 58 | 26.4 % | 0 (0) | 0 (0) |
| seed-3 | another seed of the wash (3) | 174 (34 of 34 clean) | 116 (26 of 34 clean) | 58 | 26.4 % | 0 (0) | 0 (0) |

Level dinner-party (367 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 251 (46 of 49 clean) | 100 (27 of 51 clean) | 151 | 41.1 % | reference | reference |
| seed-2 | another seed of the wash (2) | 249 (45 of 49 clean) | 100 (27 of 51 clean) | 149 | 40.6 % | 1 (2) | 0 (0) |
| seed-3 | another seed of the wash (3) | 249 (45 of 49 clean) | 100 (27 of 51 clean) | 149 | 40.6 % | 1 (2) | 0 (0) |

| Level | Margin, smallest to largest | Most verdicts of a load moved by the seed | by a parameter | Ranking of careful over careless |
|---|---|---|---|---|
| lunch-for-four | 53 to 53 | 0 | 0 | holds in every case |
| breakfast | 58 to 58 | 0 | 0 | holds in every case |
| dinner-party | 149 to 151 | 1 | 0 | holds in every case |
