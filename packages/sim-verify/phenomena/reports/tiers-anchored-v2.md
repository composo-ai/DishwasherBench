# Tiers: official against fast (anchored-v2, spotless-sim 0.3.2 water-3)

Runs: official, fast. 49 checks compared; 2 with differing verdicts (1 of them deciding). 0 of 103 washes have the same result hash in every run.

| Phenomenon | Check | official | fast | Range | Verdicts |
|---|---|---|---|---|---|
| P01 | retained | 258 | 258 | 0 | pass |
| P01 | f_jet | 0 | 0 | 0 | pass |
| P01 | bowl (supporting) | 108 | 108 | 0 | pass |
| P01 | drying (supporting) |  |  | 0 | not covered |
| P02 | f_jet | 0.284 | 0.361 | 0.0772 | too large |
| P02 | score | 0 | 0 | 0 | too small |
| P02 | residue (supporting) | 0.00137 | 0.00117 | 2.0e-4 | too small |
| P02 | settled (supporting) | 5.96 | 5.79 | 0.171 | too large |
| P02 | settled_residue (supporting) | -0.0185 | -0.0181 | 3.6e-4 | wrong sign |
| P03 | halving | 0 | 0 | 0 | too small |
| P03 | plateau | 0 | 0 | 0 | pass |
| P03 | dwell (supporting) | -1 | -1 | 0 | pass |
| P04 | residue | 4.3e-4 | 3.6e-4 | 6.8e-5 | too small |
| P04 | score | 2 | 2 | 0 | too large |
| P04 | against (supporting) | 2.1e-4 | 1.8e-4 | 3.6e-5 | too small |
| P04 | f_jet (supporting) | 2.7e-4 | 4.6e-4 | 1.9e-4 | pass |
| P05 | score | 0 | 0 | 0 | too small |
| P05 | f_jet | -0.92 | -0.926 | 0.0066 | pass |
| P07 | score | 0 | 0 | 0 | too small |
| P07 | dwell (supporting) | -0.258 | -0.284 | 0.0264 | pass |
| P08 | score | 0 | 0 | 0 | pass |
| P08 | jets (supporting) | 2.2 | 2.33 | 0.123 | pass |
| P09 | score | 0 | 0 | 0 | too small |
| P09 | f_jet (supporting) | -0.99 | -0.982 | 0.00805 | pass |
| P10 | glass | -2.3 | -2.3 | 0 | too small |
| P10 | residue | -6.5e-4 | -8.9e-4 | 2.5e-4 | wrong sign |
| P10 | f_jet (supporting) | -0.835 | -0.842 | 0.00641 | pass |
| P12 | score | 0 | 0 | 0 | too small |
| P12 | residue (supporting) | 0.0149 | 0.0139 | 9.2e-4 | wrong sign |
| P13 | f_jet | -0.0516 | -0.0418 | 0.00976 | **pass / too small** |
| P13 | marks (supporting) |  |  | 0 | not covered |
| P13 | drying (supporting) |  |  | 0 | not covered |
| P14 | f_jet | 0 | 0 | 0 | pass |
| P14 | score | 0 | 0 | 0 | too small |
| P14 | renewal (supporting) | -0.904 | -0.881 | 0.0227 | pass |
| P14 | residue (supporting) | 0.0155 | 0.0147 | 8.7e-4 | pass |
| P15 | shielded | 1 | 0 | 1 | pass |
| P15 | partner | 0 | 0 | 0 | pass |
| P15 | residue (supporting) | 0.00779 | 0.0244 | 0.0166 | **too small / pass** |
| P35 | class | -2.5 | -2.5 | 0 | too small |
| P35 | side | -0.0761 | -0.0913 | 0.0152 | wrong sign |
| P35 | ranking (supporting) | -0.125 | -0.0812 | 0.0435 | wrong sign |
| P36 | pool | 5 | 5 | 0 | pass |
| P36 | drying (supporting) |  |  | 0 | not covered |
| P37 | tilt7 | 0.0836 | 0.0836 | 0 | pass |
| P37 | tilt15 | 0.0223 | 0.0223 | 0 | too small |
| P37 | tilt30 (supporting) | 0.00514 | 0 | 0.00514 | too small |
| P40 | held | 0.181 | 0.229 | 0.0487 | pass |
| P40 | marks (supporting) |  |  | 0 | not covered |
