# Anchoring fit: anchored-v4

Water side: spotless-sim 0.4.1 water-5, sources sha256:34816aba7271f07506b07db21742b941def5dcbc719a27c597d2c9355be42205 (136 files).
Record std-eu-13.round-robin-ta.detergent-d (weight 0.25); level seeds 1, 2; simulation seeds 1, 2: 4 washes per point. Fitted keys: soil.egg_yolk.rateRef, liq.xProtease, soil.bleachRate.

## 1. soil.egg_yolk.rateRef from the six in-machine rates

Fitted 0.000034 kg/(m2 s) (default 0.00003, range 0.00001 to 0.0001); with {"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300}.

| Case | Published (%/min) | Tolerance | At the default | At the fit |
|---|---|---|---|---|
| 30 C, pH 10.5, 60 g/m3 | 0.85 | 0.17 | 0.74 | 0.84 |
| 55 C, pH 10.5, 60 g/m3 | 1.75 | 0.35 | 1.57 | 1.79 |
| 55 C, pH 10.5, 20 g/m3 | 0.17 | 0.05 | 0.15 | 0.17 |
| 55 C, pH 10.5, 100 g/m3 | 2.59 | 0.52 | 2.18 | 2.47 |
| 55 C, pH 9.5, 60 g/m3 | 0.69 | 0.16 | 0.60 | 0.68 |
| 55 C, pH 11.5, 60 g/m3 | 4.66 | 0.93 | 4.25 | 4.77 |

IKW programme under the set: egg yolk 72 % left, starch mix 92 % left, minced meat 88 % left, tea 69 % left.

## 2. liq.xProtease from the crockery, cutlery and glass class means

| `liq.xProtease` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.01 | 2.47 | 3.95 | 0.10 | 4.05 | 1.66 | 0.00 | 3.30 | 64 % | 53 % | 0.746 | 0.000 | 0.746 |
| 0.012 | 2.99 | 4.79 | 0.10 | 4.31 | 2.15 | 0.70 | 3.65 | 69 % | 60 % | 0.317 | 0.001 | 0.319 |
| 0.013 | 3.00 | 4.83 | 0.05 | 4.41 | 2.59 | 1.38 | 3.78 | 71 % | 62 % | 0.160 | 0.003 | 0.162 |
| 0.014 | 3.06 | 4.93 | 0.05 | 4.47 | 2.99 | 2.00 | 3.89 | 74 % | 66 % | 0.079 | 0.005 | 0.084 |
| 0.016 (best) | 3.09 | 4.98 | 0.05 | 4.51 | 3.61 | 2.95 | 4.01 | 76 % | 69 % | 0.051 | 0.009 | 0.061 |
| 0.02 | 3.10 | 5.00 | 0.05 | 4.56 | 4.23 | 3.90 | 4.14 | 79 % | 73 % | 0.136 | 0.020 | 0.156 |

Best 0.016; the default costs 0.685 log units: kept at 0.016.

## 3. soil.bleachRate from the same class means

| `soil.bleachRate` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0008 | 3.09 | 4.98 | 0.05 | 4.51 | 3.61 | 2.95 | 4.01 | 76 % | 69 % | 0.051 | 0.000 | 0.051 |
| 0.0009 | 3.34 | 4.98 | 0.90 | 4.51 | 3.61 | 2.95 | 4.08 | 76 % | 69 % | 0.030 | 0.002 | 0.031 |
| 0.001 (best) | 3.69 | 4.98 | 2.08 | 4.51 | 3.61 | 2.95 | 4.17 | 79 % | 73 % | 0.019 | 0.006 | 0.025 |
| 0.0011 | 3.90 | 4.98 | 2.72 | 4.51 | 3.61 | 2.95 | 4.23 | 80 % | 74 % | 0.024 | 0.013 | 0.037 |
| 0.0012 | 4.00 | 4.98 | 3.02 | 4.51 | 3.61 | 2.95 | 4.25 | 80 % | 75 % | 0.030 | 0.021 | 0.051 |
| 0.0014 | 4.15 | 4.98 | 3.35 | 4.51 | 3.61 | 2.95 | 4.29 | 80 % | 75 % | 0.044 | 0.040 | 0.083 |
| 0.0016 | 4.38 | 4.98 | 3.83 | 4.51 | 3.61 | 2.95 | 4.36 | 80 % | 75 % | 0.068 | 0.061 | 0.129 |

Best 0.001; the default costs 0.026 log units: returned to its default.

Published (test appliance, detergent D): crockery 3.68 (sd used 1.1), cutlery 4.67 (sd used 0.51), glass 3.43 (sd used 0.94), melamine 4.21 (sd used 1), all 4.17 (sd used 0.62).

Set: `{"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"soil.egg_yolk.rateRef":0.000034,"soil.milk.rateRef":0.000034,"liq.xProtease":0.016}`
