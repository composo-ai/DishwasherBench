# Robustness of a score on three levels of the course

Written by `pnpm --filter @spotless/bench robustness` on 12 October 2026, on the final code (`spotless-sim 0.5.0 water-7`, `anchored-v7.owner-capsule`). Levels 2, 4 and 7, the careful and the careless reference load. What it shows is in `docs/benchmark/levels.md` section 7.

## Both ends of the two least certain parameters, official tier

Each case is a replay on the exposure of the reference wash.

Level lunch-for-four (232 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | reference | reference |
| soak-0.59 | soak duty 0.59 (lower end of the interval the calibration on the owner's wash 01 gives; the set has 0.8) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| soak-1.0 | soak duty 1 (circulation throughout; the upper end) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| exchange-0.005 | supply exchange 0.005 (turning a plate costs less; lower end of what the wash allows; the set has 0.02) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |
| exchange-0.08 | supply exchange 0.08 (upper end of what the wash allows) | 187 (36 of 36 clean) | 134 (28 of 36 clean) | 53 | 22.8 % | 0 (0) | 0 (0) |

Level breakfast (220 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 174 (34 of 34 clean) | 112 (24 of 34 clean) | 62 | 28.2 % | reference | reference |
| soak-0.59 | soak duty 0.59 (lower end of the interval the calibration on the owner's wash 01 gives; the set has 0.8) | 115 (22 of 34 clean) | 55 (13 of 34 clean) | 60 | 27.3 % | 12 (59) | 11 (57) |
| soak-1.0 | soak duty 1 (circulation throughout; the upper end) | 174 (34 of 34 clean) | 112 (24 of 34 clean) | 62 | 28.2 % | 0 (0) | 0 (0) |
| exchange-0.005 | supply exchange 0.005 (turning a plate costs less; lower end of what the wash allows; the set has 0.02) | 174 (34 of 34 clean) | 116 (26 of 34 clean) | 58 | 26.4 % | 0 (0) | 2 (4) |
| exchange-0.08 | supply exchange 0.08 (upper end of what the wash allows) | 144 (29 of 34 clean) | 84 (20 of 34 clean) | 60 | 27.3 % | 5 (30) | 4 (28) |

Level dinner-party (367 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 250 (46 of 49 clean) | 100 (27 of 51 clean) | 150 | 40.9 % | reference | reference |
| soak-0.59 | soak duty 0.59 (lower end of the interval the calibration on the owner's wash 01 gives; the set has 0.8) | 228 (43 of 49 clean) | 76 (19 of 51 clean) | 152 | 41.4 % | 5 (26) | 8 (24) |
| soak-1.0 | soak duty 1 (circulation throughout; the upper end) | 248 (45 of 49 clean) | 100 (27 of 51 clean) | 148 | 40.3 % | 1 (2) | 0 (0) |
| exchange-0.005 | supply exchange 0.005 (turning a plate costs less; lower end of what the wash allows; the set has 0.02) | 255 (48 of 49 clean) | 102 (28 of 51 clean) | 153 | 41.7 % | 2 (5) | 1 (2) |
| exchange-0.08 | supply exchange 0.08 (upper end of what the wash allows) | 246 (44 of 49 clean) | 91 (23 of 51 clean) | 155 | 42.2 % | 2 (4) | 4 (9) |

| Level | Margin, smallest to largest | Most verdicts of a load moved by the seed | by a parameter | Ranking of careful over careless |
|---|---|---|---|---|
| lunch-for-four | 53 to 53 | 0 | 0 | holds in every case |
| breakfast | 58 to 62 | 0 | 12 | holds in every case |
| dinner-party | 148 to 155 | 0 | 8 | holds in every case |


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
| base | as the game washes it | 174 (34 of 34 clean) | 114 (25 of 34 clean) | 60 | 27.3 % | reference | reference |
| seed-2 | another seed of the wash (2) | 174 (34 of 34 clean) | 116 (26 of 34 clean) | 58 | 26.4 % | 0 (0) | 1 (2) |
| seed-3 | another seed of the wash (3) | 174 (34 of 34 clean) | 114 (25 of 34 clean) | 60 | 27.3 % | 0 (0) | 0 (0) |

Level dinner-party (367 points offered):

| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |
|---|---|---|---|---|---|---|---|
| base | as the game washes it | 251 (46 of 49 clean) | 100 (27 of 51 clean) | 151 | 41.1 % | reference | reference |
| seed-2 | another seed of the wash (2) | 249 (45 of 49 clean) | 100 (27 of 51 clean) | 149 | 40.6 % | 1 (2) | 0 (0) |
| seed-3 | another seed of the wash (3) | 249 (45 of 49 clean) | 100 (27 of 51 clean) | 149 | 40.6 % | 1 (2) | 0 (0) |

| Level | Margin, smallest to largest | Most verdicts of a load moved by the seed | by a parameter | Ranking of careful over careless |
|---|---|---|---|---|
| lunch-for-four | 53 to 53 | 0 | 0 | holds in every case |
| breakfast | 58 to 60 | 1 | 0 | holds in every case |
| dinner-party | 149 to 151 | 1 | 0 | holds in every case |
