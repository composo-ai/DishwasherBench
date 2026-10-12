# Anchoring fit: anchored-v5

Water side: spotless-sim 0.5.0 water-6, sources sha256:3ae47724f84751e1ac420c22c4d9a18ef53aa485153eeb3f4253210260c527bf (136 files).
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

IKW programme under the set: egg yolk 66 % left, starch mix 92 % left, minced meat 86 % left, tea 66 % left.

## 2. liq.xProtease from the crockery, cutlery and glass class means

| `liq.xProtease` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.01 | 1.84 | 2.76 | 0.45 | 4.02 | 1.75 | 0.00 | 3.08 | 59 % | 47 % | 0.934 | 0.000 | 0.934 |
| 0.012 | 2.12 | 3.21 | 0.45 | 4.02 | 1.75 | 0.00 | 3.21 | 63 % | 52 % | 0.846 | 0.001 | 0.847 |
| 0.014 | 2.65 | 4.10 | 0.40 | 4.11 | 1.75 | 0.00 | 3.39 | 65 % | 55 % | 0.643 | 0.005 | 0.647 |
| 0.016 | 3.05 | 4.75 | 0.40 | 4.28 | 1.88 | 0.19 | 3.61 | 68 % | 59 % | 0.438 | 0.009 | 0.447 |
| 0.018 | 3.21 | 5.00 | 0.40 | 4.44 | 2.09 | 0.52 | 3.77 | 71 % | 62 % | 0.279 | 0.014 | 0.293 |
| 0.02 (best) | 3.21 | 5.00 | 0.40 | 4.50 | 2.38 | 0.96 | 3.85 | 71 % | 63 % | 0.182 | 0.020 | 0.202 |

Best 0.02; the default costs 0.732 log units: kept at 0.02.

**Floor rule.** At the default every item with `iec_egg_yolk` reads dirty (mean score 0.00). With those items there and every other item of the class at 5, the cutlery mean could reach 4.04 at most; the record publishes 4.67. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 3.50). The record bounds the parameter from below only: the soil is off the floor from 0.014 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.014 to 0.02 of the values scanned.

## 3. soil.bleachRate from the same class means

| `soil.bleachRate` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0008 | 3.21 | 5.00 | 0.40 | 4.50 | 2.38 | 0.96 | 3.85 | 71 % | 63 % | 0.182 | 0.000 | 0.182 |
| 0.0009 (best) | 3.66 | 5.00 | 1.90 | 4.50 | 2.38 | 0.96 | 3.97 | 75 % | 67 % | 0.161 | 0.002 | 0.163 |
| 0.001 | 3.98 | 5.00 | 2.93 | 4.50 | 2.38 | 0.96 | 4.05 | 76 % | 69 % | 0.171 | 0.006 | 0.177 |
| 0.0011 | 4.14 | 5.00 | 3.33 | 4.50 | 2.38 | 0.96 | 4.10 | 76 % | 69 % | 0.182 | 0.013 | 0.195 |
| 0.0012 | 4.22 | 5.00 | 3.48 | 4.50 | 2.38 | 0.96 | 4.12 | 76 % | 69 % | 0.190 | 0.021 | 0.211 |
| 0.0014 | 4.38 | 5.00 | 3.80 | 4.50 | 2.38 | 0.96 | 4.16 | 76 % | 69 % | 0.216 | 0.040 | 0.256 |
| 0.0016 | 4.60 | 5.00 | 4.23 | 4.50 | 2.38 | 0.96 | 4.22 | 76 % | 69 % | 0.244 | 0.061 | 0.305 |
| 0.002 | 4.77 | 5.00 | 4.55 | 4.50 | 2.38 | 0.96 | 4.26 | 76 % | 69 % | 0.287 | 0.107 | 0.394 |

Best 0.0009; the default costs 0.019 log units: kept at 0.0009.

**Floor rule.** At the default every item with `iec_tea` reads dirty (mean score 0.40). With those items there and every other item of the class at 5, the crockery mean could reach 3.21 at most; the record publishes 3.68. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores 1.90). The record bounds the parameter from below only: the soil is off the floor from 0.0009 upwards, and the likelihood is indifferent (within 0.5 log units of the best) over 0.0009 to 0.002 of the values scanned.

Published (test appliance, detergent D): crockery 3.68 (sd used 1.1), cutlery 4.67 (sd used 0.51), glass 3.43 (sd used 0.93), melamine 4.21 (sd used 1), all 4.17 (sd used 0.62).

Set: `{"soil.subCellCv":0.1,"soil.amountCv":0.05,"soil.egg_yolk.tLag":300,"soil.milk.tLag":300,"soil.egg_yolk.rateRef":0.000034,"soil.milk.rateRef":0.000034,"liq.xProtease":0.02,"soil.bleachRate":0.0009}`
