# Seeds 1, 2, 3 (fast tier, anchored-v2, spotless-sim 0.3.2 water-3)

Runs: seed1, seed2, seed3. 49 checks compared; 2 with differing verdicts (0 of them deciding). 0 of 103 washes have the same result hash in every run.

| Phenomenon | Check | seed1 | seed2 | seed3 | Range | Verdicts |
|---|---|---|---|---|---|---|
| P01 | retained | 258 | 258 | 258 | 0 | pass |
| P01 | f_jet | 0 | 0 | 0 | 0 | pass |
| P01 | bowl (supporting) | 108 | 108 | 108 | 0 | pass |
| P01 | drying (supporting) |  |  |  | 0 | not covered |
| P02 | f_jet | 0.361 | 0.317 | 0.288 | 0.0736 | too large |
| P02 | score | 0 | 0 | 0 | 0 | too small |
| P02 | residue (supporting) | 0.00117 | 0.00725 | 0.00139 | 0.00608 | too small |
| P02 | settled (supporting) | 5.79 | 5.98 | 5.83 | 0.184 | too large |
| P02 | settled_residue (supporting) | -0.0181 | -0.0193 | -0.0207 | 0.00265 | wrong sign |
| P03 | halving | 0 | 0 | 0 | 0 | too small |
| P03 | plateau | 0 | 0 | 0 | 0 | pass |
| P03 | dwell (supporting) | -1 | -1 | -1 | 0 | pass |
| P04 | residue | 3.6e-4 | 1.4e-4 | 8.3e-5 | 2.7e-4 | too small |
| P04 | score | 2 | 3 | 4 | 2 | too large |
| P04 | against (supporting) | 1.8e-4 | 9.5e-5 | 5.6e-5 | 1.2e-4 | too small |
| P04 | f_jet (supporting) | 4.6e-4 | 3.1e-4 | 6.5e-4 | 3.4e-4 | pass |
| P05 | score | 0 | 0 | 0 | 0 | too small |
| P05 | f_jet | -0.926 | -0.914 | -0.919 | 0.0126 | pass |
| P07 | score | 0 | 0 | 0 | 0 | too small |
| P07 | dwell (supporting) | -0.284 | -0.274 | -0.282 | 0.0105 | pass |
| P08 | score | 0 | 0 | 0 | 0 | pass |
| P08 | jets (supporting) | 2.33 | 2.38 | 2.39 | 0.0602 | pass |
| P09 | score | 0 | 0 | 0 | 0 | too small |
| P09 | f_jet (supporting) | -0.982 | -0.983 | -0.983 | 0.0019 | pass |
| P10 | glass | -2.3 | -2.3 | -2.3 | 0 | too small |
| P10 | residue | -8.9e-4 | -0.00287 | -0.00253 | 0.00197 | wrong sign |
| P10 | f_jet (supporting) | -0.842 | -0.843 | -0.843 | 0.00143 | pass |
| P12 | score | 0 | 0 | 0 | 0 | too small |
| P12 | residue (supporting) | 0.0139 | -0.0246 | 0.0151 | 0.0397 | **wrong sign / pass / wrong sign** |
| P13 | f_jet | -0.0418 | -0.0415 | -0.0444 | 0.00293 | too small |
| P13 | marks (supporting) |  |  |  | 0 | not covered |
| P13 | drying (supporting) |  |  |  | 0 | not covered |
| P14 | f_jet | 0 | 0 | 0 | 0 | pass |
| P14 | score | 0 | 0 | 0 | 0 | too small |
| P14 | renewal (supporting) | -0.881 | -0.884 | -0.887 | 0.00583 | pass |
| P14 | residue (supporting) | 0.0147 | 0.02 | 0.00981 | 0.0102 | **pass / pass / too small** |
| P15 | shielded | 0 | 0 | 1 | 1 | pass |
| P15 | partner | 0 | 0 | 0 | 0 | pass |
| P15 | residue (supporting) | 0.0244 | 0.0224 | 0.0124 | 0.012 | pass |
| P35 | class | -2.5 | -2.5 | -2.5 | 0 | too small |
| P35 | side | -0.0913 | -0.083 | -0.0752 | 0.0161 | wrong sign |
| P35 | ranking (supporting) | -0.0812 | -0.124 | -0.0487 | 0.0751 | wrong sign |
| P36 | pool | 5 | 5 | 5 | 0 | pass |
| P36 | drying (supporting) |  |  |  | 0 | not covered |
| P37 | tilt7 | 0.0836 | 0.0836 | 0.0836 | 0 | pass |
| P37 | tilt15 | 0.0223 | 0.0223 | 0.0223 | 0 | too small |
| P37 | tilt30 (supporting) | 0 | 0 | 0 | 0 | too small |
| P40 | held | 0.229 | 0.23 | 0.23 | 7.8e-4 | pass |
| P40 | marks (supporting) |  |  |  | 0 | not covered |
