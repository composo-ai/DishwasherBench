# The demonstration washes with the parameter set anchored-v2

Settled standard loads of the owner's Bosch SMV4HAX40G, Auto 45-65, official tier, 20 g of reference detergent D, from the saved `<name>.wash.json`. Written by `packages/calibration/anchors/scripts/demo-anchored.ts` on the water side spotless-sim 0.3.2 water-3 (sources sha256:97aa4d392843...). "Defaults" is the registry defaults on that same water side; the default files beside this one (`<name>.result.json`, `SUMMARY.md`) were written on an earlier water side and are not touched. "Working soils" replaces the soil quantities of the load file by those of `docs/calibration/anchoring.md` section 2.2 (the load file carries 5 g of dry milk per glass and 0.1 mg of tea per cup).

| Load | Parameters | Items | Mean score | Mean, standard weights | Clean | Soiled items clean | Crockery | Cutlery | Glass | Melamine | Dry soil left | Water held (mL) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| iec-13-careful | defaults | 97 | 2.40 | 1.91 | 37 | 8 of 68 | 0.27 | 3.46 | 0.25 | 0.00 | 82.9 % | 2 |
| iec-13-careful | anchored | 97 | 2.68 | 2.51 | 43 | 14 of 68 | 1.77 | 3.38 | 0.13 | 0.00 | 80.7 % | 2 |
| iec-13-careful | anchored, working soils | 97 | 2.75 | 2.35 | 47 | 18 of 68 | 1.00 | 3.65 | 0.50 | 2.00 | 40.3 % | 2 |
| iec-13-careful-badly | defaults | 97 | 2.01 | 1.52 | 37 | 8 of 68 | 0.00 | 3.00 | 0.00 | 0.00 | 91.0 % | 3479 |
| iec-13-careful-badly | anchored | 97 | 2.24 | 1.98 | 37 | 8 of 68 | 1.14 | 2.95 | 0.00 | 0.00 | 91.5 % | 3479 |
| iec-13-careful-badly | anchored, working soils | 97 | 1.99 | 1.51 | 37 | 8 of 68 | 0.00 | 2.97 | 0.00 | 0.00 | 75.2 % | 3479 |
| half-careful | defaults | 54 | 2.20 | 1.95 | 20 | 6 of 40 | 0.31 | 3.50 | 0.40 | 0.00 | 83.3 % | 0 |
| half-careful | anchored | 54 | 2.81 | 2.64 | 27 | 13 of 40 | 2.50 | 3.44 | 0.40 | 0.00 | 81.1 % | 0 |
| half-careful | anchored, working soils | 54 | 2.69 | 2.63 | 28 | 14 of 40 | 1.06 | 3.69 | 1.00 | 5.00 | 42.7 % | 0 |
| iec-13-careless | defaults | 92 | 1.59 | 1.29 | 28 | 0 of 64 | 0.03 | 2.74 | 0.00 | 0.00 | 89.4 % | 4 |
| iec-13-careless | anchored | 92 | 2.01 | 1.99 | 35 | 7 of 64 | 1.41 | 2.72 | 0.00 | 0.00 | 88.8 % | 4 |
| iec-13-careless | anchored, working soils | 92 | 1.79 | 1.60 | 30 | 2 of 64 | 0.31 | 2.81 | 0.13 | 3.00 | 62.8 % | 4 |

By soil (share of the dry mass left; mean score of the items that carry it):

| Load | Parameters | iec_egg_yolk | iec_margarine | iec_milk | iec_minced_meat | iec_oat_flakes | iec_spinach | iec_tea |
|---|---|---|---|---|---|---|---|---|
| iec-13-careful | defaults | 87.0 %; 0.0 | 0.1 %; 4.2 | 98.3 %; 0.0 | 55.8 %; 0.0 | 0.6 %; 2.0 | 19.0 %; 0.0 | 10.9 %; 0.0 |
| iec-13-careful | anchored | 73.5 %; 0.0 | 0.1 %; 4.2 | 99.0 %; 0.0 | 33.8 %; 0.0 | 1.5 %; 1.6 | 27.6 %; 0.0 | 10.7 %; 5.0 |
| iec-13-careful | anchored, working soils | 56.6 %; 0.0 | 0.1 %; 4.3 | 77.9 %; 0.0 | 11.0 %; 0.0 | 0.2 %; 3.1 | 0.0 %; 4.0 | 10.8 %; 0.0 |
| iec-13-careful-badly | defaults | 100.0 %; 0.0 | 0.1 %; 4.2 | 100.0 %; 0.0 | 99.9 %; 0.0 | 47.4 %; 0.0 | 82.0 %; 0.0 | 91.3 %; 0.0 |
| iec-13-careful-badly | anchored | 99.8 %; 0.0 | 0.1 %; 3.9 | 100.0 %; 0.0 | 99.5 %; 0.0 | 61.3 %; 0.0 | 86.7 %; 0.0 | 91.3 %; 3.6 |
| iec-13-careful-badly | anchored, working soils | 99.7 %; 0.0 | 0.1 %; 4.0 | 99.9 %; 0.0 | 99.2 %; 0.0 | 40.7 %; 0.0 | 34.5 %; 0.0 | 92.3 %; 0.0 |
| half-careful | defaults | 86.8 %; 0.0 | 0.0 %; 4.7 | 98.2 %; 0.0 | 54.7 %; 0.0 | 0.2 %; 2.1 | 18.0 %; 0.0 | 10.2 %; 0.0 |
| half-careful | anchored | 73.9 %; 0.0 | 0.0 %; 4.7 | 98.9 %; 0.0 | 28.9 %; 0.0 | 0.3 %; 1.9 | 27.1 %; 0.0 | 10.2 %; 5.0 |
| half-careful | anchored, working soils | 57.2 %; 0.0 | 0.0 %; 4.7 | 75.4 %; 0.0 | 8.1 %; 0.0 | 0.0 %; 3.8 | 0.0 %; 4.5 | 10.2 %; 0.0 |
| iec-13-careless | defaults | 91.0 %; 0.0 | - | 98.5 %; 0.0 | 58.6 %; 0.0 | 30.0 %; 0.3 | 31.5 %; 0.0 | 25.7 %; 0.0 |
| iec-13-careless | anchored | 83.6 %; 0.0 | - | 99.2 %; 0.0 | 43.3 %; 0.0 | 33.3 %; 0.2 | 42.8 %; 0.0 | 25.6 %; 4.1 |
| iec-13-careless | anchored, working soils | 73.1 %; 0.0 | - | 85.3 %; 0.0 | 21.4 %; 0.0 | 29.2 %; 0.7 | 8.5 %; 2.2 | 27.0 %; 0.0 |
