# Anchoring fit: anchored-v2, milk case "film"

Water side: spotless-sim 0.3.2 water-3, sources sha256:97aa4d392843040da01252e2c616e5b0bced8cb5f608159e7aff197d8bab94d5 (176 files).
Record std-eu-13.round-robin-ta.detergent-d (weight 0.25); level seeds 1, 2; simulation seeds 1, 2: 4 washes per point.

## 1. soil.egg_yolk.rateRef from the six in-machine rates (tile dried, as the dossiers describe it)

Fitted 0.0000354 kg/(m2 s) (default 0.00003, range 0.00001 to 0.0001).

| Case | Published | Tolerance | Default | Fitted |
|---|---|---|---|---|
| 30 C, pH 10.5, 0.06 g/L | 0.85 | 0.17 | 0.75 | 0.89 |
| 55 C, pH 10.5, 0.06 g/L | 1.75 | 0.35 | 1.49 | 1.75 |
| 55 C, pH 10.5, 0.02 g/L | 0.17 | 0.05 | 0.15 | 0.17 |
| 55 C, pH 10.5, 0.1 g/L | 2.59 | 0.52 | 2.06 (out) | 2.44 |
| 55 C, pH 9.5, 0.06 g/L | 0.69 | 0.16 | 0.57 | 0.67 |
| 55 C, pH 11.5, 0.06 g/L | 4.66 | 0.93 | 4.03 | 4.74 |

IKW programme under the set: egg yolk 93 % left, starch mix 92 % left, minced meat 100 % left, tea 69 % left.

## 2. liq.xProtease against the class means of the record

| liq.xProtease | Crockery | Cutlery | Glass | Melamine | All | Milk glasses | Tea items | Crockery without tea | Soiled items clean | -log likelihood | -log prior | Objective |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.01 | 1.45 | 3.88 | 1.75 | 5.00 | 2.90 | 0.00 | 0.00 | 2.83 | 43 % | 0.695 | 0.000 | 0.695 |
| 0.012 | 1.88 | 4.10 | 1.75 | 5.00 | 3.15 | 0.00 | 0.00 | 3.67 | 44 % | 0.466 | 0.001 | 0.467 |
| 0.014 | 2.15 | 4.21 | 2.42 | 5.00 | 3.38 | 1.04 | 0.00 | 4.20 | 47 % | 0.250 | 0.005 | 0.255 |
| 0.016 | 2.47 | 4.36 | 2.73 | 5.00 | 3.60 | 1.50 | 0.00 | 4.82 | 55 % | 0.114 | 0.009 | 0.124 |
| 0.018 | 2.55 | 4.47 | 2.91 | 5.00 | 3.70 | 1.79 | 0.00 | 4.96 | 58 % | 0.053 | 0.014 | 0.067 |
| 0.02 | 2.56 | 4.55 | 3.26 | 5.00 | 3.80 | 2.32 | 0.00 | 5.00 | 62 % | 0.014 | 0.020 | 0.034 |
| published | 3.68 | 4.67 | 3.43 | 4.21 | 4.17 | | | | | | | |

Best 0.02; the default 0.01 costs 0.661 log units: **kept** (rule: returned under 0.5).

## 3. The set

```json
{
 "soil.subCellCv": 0.3,
 "soil.loadScale": 0.002,
 "soil.amountCv": 0.05,
 "soil.heatDryingFactor": 80,
 "soil.heldFilmCapacity": 0.02,
 "soil.tea.visibleFraction": 0,
 "soil.tea.visibleMass": 0.00005,
 "soil.egg_yolk.rateRef": 0.0000354,
 "liq.xProtease": 0.02
}
```

Fitted keys: soil.egg_yolk.rateRef, liq.xProtease.
