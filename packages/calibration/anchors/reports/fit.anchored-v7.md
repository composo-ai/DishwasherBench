# Anchoring fit: anchored-v7

Water side: spotless-sim 0.5.0 water-7, sources sha256:325c9602e38528c76d71eaf5fd2d7f1d187015b9b6ea948d2426c97bf07ed0e0 (136 files).
Record std-eu-13.round-robin-ta.detergent-d (weight 0.25); level seeds 1, 2; simulation seeds 1, 2: 4 washes per point. Fitted keys: soil.egg_yolk.rateRef, liq.xProtease, soil.bleachRate.

## 1. soil.egg_yolk.rateRef from the six in-machine rates

Fitted 0.000034 kg/(m2 s) (default 0.00003, range 0.00001 to 0.0001); with {"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"prog.soakDuty":0.8}.

| Case | Published (%/min) | Tolerance | At the default | At the fit |
|---|---|---|---|---|
| 30 C, pH 10.5, 60 g/m3 | 0.85 | 0.17 | 0.74 | 0.84 |
| 55 C, pH 10.5, 60 g/m3 | 1.75 | 0.35 | 1.57 | 1.79 |
| 55 C, pH 10.5, 20 g/m3 | 0.17 | 0.05 | 0.15 | 0.17 |
| 55 C, pH 10.5, 100 g/m3 | 2.59 | 0.52 | 2.18 | 2.47 |
| 55 C, pH 9.5, 60 g/m3 | 0.69 | 0.16 | 0.60 | 0.68 |
| 55 C, pH 11.5, 60 g/m3 | 4.66 | 0.93 | 4.25 | 4.77 |

IKW programme under the set: egg yolk 72 % left, starch mix 92 % left, minced meat 88 % left, tea 66 % left.

## 2. liq.xProtease from the crockery, cutlery and glass class means

| `liq.xProtease` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.01 | 2.12 | 3.38 | 0.10 | 3.97 | 1.75 | 0.00 | 3.18 | 62 % | 51 % | 0.838 | 0.000 | 0.838 |
| 0.012 | 3.00 | 4.81 | 0.10 | 4.23 | 1.91 | 0.25 | 3.58 | 68 % | 59 % | 0.435 | 0.001 | 0.436 |
| 0.013 | 3.12 | 5.00 | 0.10 | 4.39 | 2.24 | 0.75 | 3.75 | 70 % | 61 % | 0.264 | 0.003 | 0.267 |
| 0.014 | 3.12 | 5.00 | 0.10 | 4.49 | 2.48 | 1.13 | 3.83 | 72 % | 63 % | 0.164 | 0.005 | 0.169 |
| 0.016 (best) | 3.12 | 5.00 | 0.10 | 4.64 | 3.13 | 2.13 | 4.02 | 77 % | 71 % | 0.040 | 0.009 | 0.050 |
| 0.02 | 3.12 | 5.00 | 0.10 | 4.72 | 3.80 | 3.16 | 4.16 | 81 % | 75 % | 0.049 | 0.020 | 0.069 |

Best 0.016; the default costs 0.789 log units: kept at 0.016.

**Floor rule.** At the default every item with `iec_egg_yolk` reads dirty (mean score 0.33). With those items there and every other item of the class at 5, the cutlery mean could reach 4.05 at most; the record publishes 4.67. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 4.11). The record bounds the parameter from below only: the soil is off the floor from 0.012 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.012 to 0.02 of the values scanned.

## 3. soil.bleachRate from the same class means

| `soil.bleachRate` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0008 | 3.12 | 5.00 | 0.10 | 4.64 | 3.13 | 2.13 | 4.02 | 77 % | 71 % | 0.040 | 0.000 | 0.040 |
| 0.0009 (best) | 3.46 | 5.00 | 1.15 | 4.64 | 3.13 | 2.13 | 4.11 | 77 % | 71 % | 0.013 | 0.002 | 0.015 |
| 0.001 | 4.04 | 5.00 | 2.75 | 4.64 | 3.13 | 2.13 | 4.26 | 82 % | 76 % | 0.024 | 0.006 | 0.030 |
| 0.0011 | 4.40 | 5.00 | 3.73 | 4.64 | 3.13 | 2.13 | 4.36 | 83 % | 77 % | 0.066 | 0.013 | 0.079 |
| 0.0012 | 4.69 | 5.00 | 4.40 | 4.64 | 3.13 | 2.13 | 4.43 | 84 % | 79 % | 0.116 | 0.021 | 0.137 |
| 0.0014 | 4.94 | 5.00 | 4.88 | 4.64 | 3.13 | 2.13 | 4.50 | 87 % | 84 % | 0.174 | 0.040 | 0.214 |
| 0.0016 | 5.00 | 5.00 | 5.00 | 4.64 | 3.13 | 2.13 | 4.52 | 87 % | 84 % | 0.190 | 0.061 | 0.251 |
| 0.002 | 5.00 | 5.00 | 5.00 | 4.64 | 3.13 | 2.13 | 4.52 | 87 % | 84 % | 0.190 | 0.107 | 0.297 |

Best 0.0009; the default costs 0.026 log units: kept at 0.0009.

**Floor rule.** At the default every item with `iec_tea` reads dirty (mean score 0.10). With those items there and every other item of the class at 5, the crockery mean could reach 3.12 at most; the record publishes 3.68. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 1.15). The record bounds the parameter from below only: the soil is off the floor from 0.0009 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.0009 to 0.002 of the values scanned.

Published (test appliance, detergent D): crockery 3.68 (sd used 1.1), cutlery 4.67 (sd used 0.51), glass 3.43 (sd used 0.96), melamine 4.21 (sd used 1), all 4.17 (sd used 0.62).

Set: `{"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"prog.soakDuty":0.8,"soil.egg_yolk.rateRef":0.000034,"soil.milk.rateRef":0.000034,"liq.xProtease":0.016,"soil.bleachRate":0.0009}`
