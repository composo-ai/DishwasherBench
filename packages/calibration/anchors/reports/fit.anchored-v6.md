# Anchoring fit: anchored-v6

Water side: spotless-sim 0.5.0 water-6, sources sha256:3ae47724f84751e1ac420c22c4d9a18ef53aa485153eeb3f4253210260c527bf (136 files).
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

IKW programme under the set: egg yolk 72 % left, starch mix 92 % left, minced meat 88 % left, tea 63 % left.

## 2. liq.xProtease from the crockery, cutlery and glass class means

| `liq.xProtease` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.01 | 2.15 | 3.37 | 0.25 | 4.02 | 1.75 | 0.00 | 3.22 | 63 % | 52 % | 0.829 | 0.000 | 0.829 |
| 0.012 | 2.97 | 4.71 | 0.20 | 4.26 | 1.88 | 0.19 | 3.58 | 68 % | 58 % | 0.458 | 0.001 | 0.460 |
| 0.013 | 3.08 | 4.93 | 0.13 | 4.42 | 2.13 | 0.58 | 3.74 | 69 % | 60 % | 0.297 | 0.003 | 0.300 |
| 0.014 | 3.08 | 4.95 | 0.08 | 4.49 | 2.45 | 1.08 | 3.82 | 72 % | 63 % | 0.170 | 0.005 | 0.174 |
| 0.016 (best) | 3.09 | 4.98 | 0.05 | 4.61 | 3.15 | 2.15 | 4.00 | 75 % | 68 % | 0.044 | 0.009 | 0.053 |
| 0.02 | 3.10 | 5.00 | 0.05 | 4.66 | 3.99 | 3.44 | 4.16 | 79 % | 73 % | 0.075 | 0.020 | 0.095 |

Best 0.016; the default costs 0.776 log units: kept at 0.016.

**Floor rule.** At the default every item with `iec_egg_yolk` reads dirty (mean score 0.29). With those items there and every other item of the class at 5, the cutlery mean could reach 4.04 at most; the record publishes 4.67. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 3.83). The record bounds the parameter from below only: the soil is off the floor from 0.012 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.012 to 0.02 of the values scanned.

## 3. soil.bleachRate from the same class means

| `soil.bleachRate` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0008 | 3.09 | 4.98 | 0.05 | 4.61 | 3.15 | 2.15 | 4.00 | 75 % | 68 % | 0.044 | 0.000 | 0.044 |
| 0.0009 | 3.41 | 4.98 | 1.15 | 4.61 | 3.15 | 2.15 | 4.08 | 75 % | 68 % | 0.019 | 0.002 | 0.021 |
| 0.001 (best) | 3.73 | 4.98 | 2.20 | 4.61 | 3.15 | 2.15 | 4.17 | 79 % | 72 % | 0.012 | 0.006 | 0.018 |
| 0.0011 | 3.98 | 4.98 | 2.98 | 4.61 | 3.15 | 2.15 | 4.23 | 80 % | 74 % | 0.020 | 0.013 | 0.033 |
| 0.0012 | 4.03 | 4.98 | 3.10 | 4.61 | 3.15 | 2.15 | 4.25 | 80 % | 74 % | 0.025 | 0.021 | 0.046 |
| 0.0014 | 4.21 | 4.98 | 3.50 | 4.61 | 3.15 | 2.15 | 4.30 | 80 % | 74 % | 0.041 | 0.040 | 0.081 |
| 0.0016 | 4.43 | 4.98 | 3.93 | 4.61 | 3.15 | 2.15 | 4.35 | 80 % | 74 % | 0.069 | 0.061 | 0.130 |
| 0.002 | 4.69 | 4.98 | 4.43 | 4.61 | 3.15 | 2.15 | 4.42 | 80 % | 74 % | 0.116 | 0.107 | 0.222 |

Best 0.001; the default costs 0.026 log units: kept at 0.001.

**Floor rule.** At the default every item with `iec_tea` reads dirty (mean score 0.05). With those items there and every other item of the class at 5, the crockery mean could reach 3.10 at most; the record publishes 3.68. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 2.20). The record bounds the parameter from below only: the soil is off the floor from 0.0009 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.0009 to 0.002 of the values scanned.

Published (test appliance, detergent D): crockery 3.68 (sd used 1.1), cutlery 4.67 (sd used 0.51), glass 3.43 (sd used 0.93), melamine 4.21 (sd used 1), all 4.17 (sd used 0.62).

Set: `{"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"prog.soakDuty":0.8,"soil.egg_yolk.rateRef":0.000034,"soil.milk.rateRef":0.000034,"liq.xProtease":0.016,"soil.bleachRate":0.001}`
