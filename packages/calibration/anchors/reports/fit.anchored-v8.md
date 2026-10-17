# Anchoring fit: anchored-v8

Water side: spotless-sim 0.5.0 water-7, sources sha256:03658efea6fc6c36791ade515888db1860eda2018a7f70301026f8d6334db49c (136 files).
Record std-eu-13.round-robin-ta.detergent-d (weight 0.25); level seeds 1, 2; simulation seeds 1, 2: 4 washes per point. Fitted keys: soil.egg_yolk.rateRef, liq.xProtease, soil.bleachRate.

## 1. soil.egg_yolk.rateRef from the six in-machine rates

Fitted 0.000034 kg/(m2 s) (default 0.00003, range 0.00001 to 0.0001); with {"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"prog.soakDuty":0.8,"soil.egg_yolk.bakeRate":0.000075}.

| Case | Published (%/min) | Tolerance | At the default | At the fit |
|---|---|---|---|---|
| 30 C, pH 10.5, 60 g/m3 | 0.85 | 0.17 | 0.74 | 0.84 |
| 55 C, pH 10.5, 60 g/m3 | 1.75 | 0.35 | 1.57 | 1.79 |
| 55 C, pH 10.5, 20 g/m3 | 0.17 | 0.05 | 0.15 | 0.17 |
| 55 C, pH 10.5, 100 g/m3 | 2.59 | 0.52 | 2.18 | 2.47 |
| 55 C, pH 9.5, 60 g/m3 | 0.69 | 0.16 | 0.60 | 0.68 |
| 55 C, pH 11.5, 60 g/m3 | 4.66 | 0.93 | 4.25 | 4.77 |

IKW programme under the set: egg yolk 82 % left, starch mix 92 % left, minced meat 95 % left, tea 66 % left.

## 2. liq.xProtease from the crockery, cutlery and glass class means

| `liq.xProtease` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.01 | 1.83 | 2.88 | 0.17 | 3.97 | 1.75 | 0.00 | 3.08 | 60 % | 48 % | 0.965 | 0.000 | 0.965 |
| 0.012 | 2.33 | 3.71 | 0.13 | 3.99 | 1.91 | 0.25 | 3.27 | 62 % | 51 % | 0.692 | 0.001 | 0.693 |
| 0.013 | 2.69 | 4.31 | 0.10 | 4.12 | 2.24 | 0.75 | 3.49 | 65 % | 55 % | 0.442 | 0.003 | 0.445 |
| 0.014 | 2.97 | 4.76 | 0.10 | 4.22 | 2.48 | 1.13 | 3.65 | 68 % | 59 % | 0.259 | 0.005 | 0.264 |
| 0.016 | 3.12 | 5.00 | 0.10 | 4.45 | 3.13 | 2.13 | 3.92 | 75 % | 67 % | 0.065 | 0.009 | 0.074 |
| 0.02 (best) | 3.12 | 5.00 | 0.10 | 4.62 | 3.80 | 3.16 | 4.11 | 79 % | 72 % | 0.048 | 0.020 | 0.068 |

Best 0.02; the default costs 0.897 log units: kept at 0.02.

**Floor rule.** At the default every item with `iec_egg_yolk` reads dirty (mean score 0.00). With those items there and every other item of the class at 5, the cutlery mean could reach 4.04 at most; the record publishes 4.67. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 4.05). The record bounds the parameter from below only: the soil is off the floor from 0.012 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.013 to 0.02 of the values scanned.

## 3. soil.bleachRate from the same class means

| `soil.bleachRate` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0008 | 3.12 | 5.00 | 0.10 | 4.62 | 3.80 | 3.16 | 4.11 | 79 % | 72 % | 0.048 | 0.000 | 0.048 |
| 0.0009 (best) | 3.50 | 5.00 | 1.25 | 4.62 | 3.80 | 3.16 | 4.21 | 79 % | 72 % | 0.021 | 0.002 | 0.022 |
| 0.001 | 4.08 | 5.00 | 2.85 | 4.62 | 3.80 | 3.16 | 4.37 | 84 % | 79 % | 0.034 | 0.006 | 0.040 |
| 0.0011 | 4.44 | 5.00 | 3.83 | 4.62 | 3.80 | 3.16 | 4.46 | 84 % | 80 % | 0.077 | 0.013 | 0.089 |
| 0.0012 | 4.69 | 5.00 | 4.40 | 4.62 | 3.80 | 3.16 | 4.53 | 85 % | 81 % | 0.127 | 0.021 | 0.148 |
| 0.0014 | 4.95 | 5.00 | 4.90 | 4.62 | 3.80 | 3.16 | 4.60 | 89 % | 85 % | 0.186 | 0.040 | 0.226 |
| 0.0016 | 5.00 | 5.00 | 5.00 | 4.62 | 3.80 | 3.16 | 4.61 | 89 % | 85 % | 0.199 | 0.061 | 0.260 |
| 0.002 | 5.00 | 5.00 | 5.00 | 4.62 | 3.80 | 3.16 | 4.61 | 89 % | 85 % | 0.199 | 0.107 | 0.306 |

Best 0.0009; the default costs 0.026 log units: kept at 0.0009.

**Floor rule.** At the default every item with `iec_tea` reads dirty (mean score 0.10). With those items there and every other item of the class at 5, the crockery mean could reach 3.12 at most; the record publishes 3.68. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 1.25). The record bounds the parameter from below only: the soil is off the floor from 0.0009 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.0009 to 0.002 of the values scanned.

Published (test appliance, detergent D): crockery 3.68 (sd used 1.1), cutlery 4.67 (sd used 0.51), glass 3.43 (sd used 0.96), melamine 4.21 (sd used 1), all 4.17 (sd used 0.62).

Set: `{"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"prog.soakDuty":0.8,"soil.egg_yolk.bakeRate":0.000075,"soil.egg_yolk.rateRef":0.000034,"soil.milk.rateRef":0.000034,"liq.xProtease":0.02,"soil.bleachRate":0.0009}`
