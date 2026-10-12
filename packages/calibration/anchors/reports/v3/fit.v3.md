# Anchoring fit: anchored-v3

Water side: spotless-sim 0.3.2 water-3, sources sha256:97aa4d392843040da01252e2c616e5b0bced8cb5f608159e7aff197d8bab94d5 (176 files).
Record std-eu-13.round-robin-ta.detergent-d (weight 0.25); level seeds 1, 2; simulation seeds 1, 2: 4 washes per point. Fitted keys: soil.egg_yolk.rateRef, liq.xProtease, soil.bleachRate.

## 1. soil.egg_yolk.rateRef from the six in-machine rates

Fitted 0.000034 kg/(m2 s) (default 0.00003, range 0.00001 to 0.0001); with {"soil.egg_yolk.tLag":300,"soil.milk.tLag":300}.

| Case | Published (%/min) | Tolerance | At the default | At the fit |
|---|---|---|---|---|
| 30 C, pH 10.5, 60 g/m3 | 0.85 | 0.17 | 0.74 | 0.84 |
| 55 C, pH 10.5, 60 g/m3 | 1.75 | 0.35 | 1.57 | 1.79 |
| 55 C, pH 10.5, 20 g/m3 | 0.17 | 0.05 | 0.15 | 0.17 |
| 55 C, pH 10.5, 100 g/m3 | 2.59 | 0.52 | 2.18 | 2.47 |
| 55 C, pH 9.5, 60 g/m3 | 0.69 | 0.16 | 0.60 | 0.68 |
| 55 C, pH 11.5, 60 g/m3 | 4.66 | 0.93 | 4.25 | 4.77 |

IKW programme under the set: egg yolk 78 % left, starch mix 92 % left, minced meat 91 % left, tea 69 % left.

## 2. liq.xProtease from the crockery, cutlery and glass class means

| `liq.xProtease` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.01 | 2.27 | 4.06 | 0.36 | 4.13 | 1.75 | 0.00 | 3.27 | 61 % | 50 % | 0.668 | 0.000 | 0.668 |
| 0.012 | 2.76 | 5.00 | 0.36 | 4.51 | 2.59 | 1.29 | 3.73 | 68 % | 59 % | 0.184 | 0.001 | 0.186 |
| 0.013 (best) | 2.72 | 5.00 | 0.29 | 4.69 | 3.05 | 2.00 | 3.88 | 71 % | 63 % | 0.101 | 0.003 | 0.104 |
| 0.014 | 2.68 | 5.00 | 0.21 | 4.76 | 3.86 | 3.25 | 4.03 | 77 % | 71 % | 0.109 | 0.005 | 0.113 |
| 0.016 | 2.68 | 5.00 | 0.21 | 4.84 | 4.40 | 4.07 | 4.15 | 81 % | 76 % | 0.210 | 0.009 | 0.220 |
| 0.02 | 2.64 | 5.00 | 0.14 | 4.92 | 4.54 | 4.29 | 4.20 | 83 % | 78 % | 0.277 | 0.020 | 0.297 |

Best 0.013; the default costs 0.564 log units: kept at 0.013.

## 3. soil.bleachRate from the same class means

| `soil.bleachRate` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0008 | 2.72 | 5.00 | 0.29 | 4.69 | 3.05 | 2.00 | 3.88 | 71 % | 63 % | 0.101 | 0.000 | 0.101 |
| 0.0009 (best) | 4.00 | 5.00 | 2.93 | 4.69 | 3.05 | 2.00 | 4.26 | 74 % | 66 % | 0.028 | 0.002 | 0.030 |
| 0.001 | 4.83 | 5.00 | 4.64 | 4.69 | 3.05 | 2.00 | 4.50 | 84 % | 79 % | 0.154 | 0.006 | 0.161 |
| 0.0011 | 4.96 | 5.00 | 4.89 | 4.69 | 3.05 | 2.00 | 4.53 | 84 % | 79 % | 0.186 | 0.013 | 0.198 |
| 0.0012 | 5.00 | 5.00 | 5.00 | 4.69 | 3.05 | 2.00 | 4.55 | 84 % | 79 % | 0.195 | 0.021 | 0.216 |
| 0.0014 | 5.00 | 5.00 | 5.00 | 4.69 | 3.05 | 2.00 | 4.55 | 84 % | 79 % | 0.195 | 0.040 | 0.235 |
| 0.0016 | 5.00 | 5.00 | 5.00 | 4.69 | 3.05 | 2.00 | 4.55 | 84 % | 79 % | 0.195 | 0.061 | 0.257 |

Best 0.0009; the default costs 0.071 log units: returned to its default.

Published (test appliance, detergent D): crockery 3.68 (sd used 1.11), cutlery 4.67 (sd used 0.51), glass 3.43 (sd used 1), melamine 4.21 (sd used 1.32), all 4.17 (sd used 0.62).

Set: `{"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"soil.egg_yolk.rateRef":0.000034,"soil.milk.rateRef":0.000034,"liq.xProtease":0.013}`
