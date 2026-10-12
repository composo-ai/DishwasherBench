# Run to run: suite run against a fresh process with a cold cache (fast tier, anchored-v2, spotless-sim 0.3.2 water-3)

Runs: suite, cold. 19 checks compared; 0 with differing verdicts (0 of them deciding). 11 of 103 washes have the same result hash in every run.

| Phenomenon | Check | suite | cold | Range | Verdicts |
|---|---|---|---|---|---|
| P01 | retained | 258 | 258 | 0 | pass |
| P01 | f_jet | 0 | 0 | 0 | pass |
| P01 | bowl (supporting) | 108 | 108 | 0 | pass |
| P01 | drying (supporting) |  |  | 0 | not covered |
| P02 | f_jet | 0.361 | 0.361 | 0 | too large |
| P02 | score | 0 | 0 | 0 | too small |
| P02 | residue (supporting) | 0.00117 | 0.00117 | 0 | too small |
| P02 | settled (supporting) | 5.79 | 5.79 | 0 | too large |
| P02 | settled_residue (supporting) | -0.0181 | -0.0181 | 0 | wrong sign |
| P04 | residue | 3.6e-4 | 3.6e-4 | 0 | too small |
| P04 | score | 2 | 2 | 0 | too large |
| P04 | against (supporting) | 1.8e-4 | 1.8e-4 | 0 | too small |
| P04 | f_jet (supporting) | 4.6e-4 | 4.6e-4 | 0 | pass |
| P14 | f_jet | 0 | 0 | 0 | pass |
| P14 | score | 0 | 0 | 0 | too small |
| P14 | renewal (supporting) | -0.881 | -0.881 | 0 | pass |
| P14 | residue (supporting) | 0.0147 | 0.0147 | 0 | pass |
| P36 | pool | 5 | 5 | 0 | pass |
| P36 | drying (supporting) |  |  | 0 | not covered |
