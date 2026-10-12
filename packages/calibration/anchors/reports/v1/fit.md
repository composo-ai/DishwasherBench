# Anchoring fit anchored-v1

Record std-eu-13.round-robin-ta.detergent-d; 17 washes in this run; search from the registry defaults: 112 evaluations, 1 restarts, stopped at the evaluation limit; -log posterior 0.734 at the estimate of the search, 0.737 at its rounded values (soil.egg_yolk.rateRef = 0.0000358, liq.xProtease = 0.0257, soil.bleachRate = 0.00121, soil.supplyRenewal = 0.0232), 0.733 at the anchored set.

Returned to the default where the record does not tell (a return that costs less than 0.5):

- soil.egg_yolk.rateRef at its default 0.00003 with the others at the estimate: +4.31 (crockery 3.63, cutlery 4.32, glass 3.51, melamine 5.00)
- liq.xProtease at its default 0.01 with the others at the estimate: +1.76 (crockery 2.94, cutlery 3.91, glass 1.75, melamine 5.00)
- soil.bleachRate at its default 0.0008 with the others at the estimate: +0.10 (crockery 2.56, cutlery 4.41, glass 3.70, melamine 5.00); kept at its estimate all the same (--keep)
- soil.supplyRenewal at its default 0.05 with the others at the estimate: -0.00 (crockery 3.63, cutlery 4.41, glass 3.70, melamine 5.00)
- soil.supplyRenewal returned to its default (set as a whole -0.00)

| Parameter | Default | Anchored | Factor | Registered range | Share of the range moved | Prior deviations moved | Tag |
|---|---|---|---|---|---|---|---|
| soil.egg_yolk.rateRef | 0.00003 | 0.0000358 | 1.19 | 0.00001 to 0.0001 kg/(m2 s) | 6.4 % | 0.15 | VERIFIED |
| liq.xProtease | 0.01 | 0.0257 | 2.57 | 0 to 0.05 kg/kg | 31.4 % | 0.27 | ESTIMATED |
| soil.bleachRate | 0.0008 | 0.00121 | 1.51 | 0.0003 to 0.003 m3/(mol s) | 15.2 % | 0.21 | ESTIMATED |
| soil.supplyRenewal | 0.05 | 0.05 | 1.00 | 0 to 5 1/s | 0.0 % | 0.00 | ESTIMATED |

| Parameter | Value | x 1/1.5: crockery, cutlery, glass, melamine; -log posterior | x 1.5: the same |
|---|---|---|---|
| soil.egg_yolk.rateRef | 0.0000358 | 3.63, 4.27, 2.96, 5.00; +423.50 | 3.56, 4.43, 4.16, 5.00; +2216.59 |
| liq.xProtease | 0.0257 | 3.63, 4.32, 3.05, 5.00; +0.17 | 3.63, 4.41, 3.98, 5.00; +0.06 |
| soil.bleachRate | 0.00121 | 2.56, 4.41, 3.70, 5.00; +0.10 | 4.42, 4.41, 3.70, 5.00; +0.12 |
| soil.supplyRenewal | 0.05 | 3.63, 4.41, 3.70, 5.00; -0.00 | 3.63, 4.41, 3.70, 5.00; +0.01 |

### Registry defaults (the first build)

eco_50, tier official: 97 items (68 soiled); mean score 3.31; clean 59 of 97 (61 %); soiled items clean 30 of 68; dry soil left 1.21 of 20.13 g (6.0 %); detergent 20.0 of 20.0 g; water held 2 mL

| Class | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |
|---|---|---|---|---|
| crockery | 22 | 2.68 | 10 | 9, 1, 0, 1, 0, 11 |
| cutlery | 65 | 3.82 | 46 | 11, 1, 3, 4, 1, 45 |
| glass | 8 | 0.63 | 1 | 7, 0, 0, 0, 0, 1 |
| melamine | 2 | 4.50 | 2 | 0, 0, 0, 0, 1, 1 |
| pots | 0 | n/a | 0 | 0, 0, 0, 0, 0, 0 |
| all | 97 | 3.31 | 59 | 27, 2, 3, 5, 2, 58 |

| Soil | Class | Records | Left (mg of mg) | Left % | Mean score | Clean | Visible area median, max (mm2) |
|---|---|---|---|---|---|---|---|
| iec_egg_yolk | egg_yolk | 17 | 344.6 of 9150.0 | 3.8 | 0.00 | 0 of 17 | 1489, 8035 |
| iec_margarine | fat | 12 | 13.0 of 3600.0 | 0.4 | 3.92 | 7 of 12 | 1, 31 |
| iec_milk | egg_yolk | 7 | 851.3 of 3524.2 | 24.2 | 0.00 | 0 of 7 | 4863, 5250 |
| iec_minced_meat | egg_yolk | 3 | 0.2 of 1680.0 | 0.0 | 2.67 | 1 of 3 | 5, 89 |
| iec_oat_flakes | starch | 19 | 1.3 of 1672.0 | 0.1 | 4.53 | 16 of 19 | 0, 67 |
| iec_spinach | starch | 3 | 0.0 of 480.0 | 0.0 | 5.00 | 3 of 3 | 0, 0 |
| iec_tea | tea | 7 | 2.8 of 28.4 | 10.0 | 2.86 | 3 of 7 | 0, 3588 |

| Type | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |
|---|---|---|---|---|
| dessert_bowl_vitrelle_130 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| dessert_plate_porcelain_190 | 5 | 2.00 | 2 | 3, 0, 0, 0, 0, 2 |
| dessert_spoon_160 | 12 | 5.00 | 12 | 0, 0, 0, 0, 0, 12 |
| dinner_fork_185 | 11 | 0.00 | 0 | 11, 0, 0, 0, 0, 0 |
| dinner_knife_210 | 12 | 3.92 | 7 | 0, 0, 2, 3, 1, 6 |
| dinner_plate_porcelain_iec | 5 | 0.80 | 0 | 3, 1, 0, 1, 0, 0 |
| ladle_steel_311 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| melamine_dessert_plate_iec_195 | 2 | 4.50 | 2 | 0, 0, 0, 0, 1, 1 |
| mug_ceramic_300 | 3 | 3.33 | 1 | 1, 0, 0, 0, 0, 2 |
| saucer_porcelain_140 | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| serving_fork_210 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| serving_spoon_216 | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| soup_plate_porcelain_230 | 5 | 5.00 | 5 | 0, 0, 0, 0, 0, 5 |
| soup_spoon_190 | 13 | 4.31 | 10 | 0, 1, 1, 1, 0, 10 |
| tea_cup_porcelain_210 | 2 | 0.00 | 0 | 2, 0, 0, 0, 0, 0 |
| teaspoon_130 | 13 | 5.00 | 13 | 0, 0, 0, 0, 0, 13 |
| test_glass_borosilicate_250 | 7 | 0.00 | 0 | 7, 0, 0, 0, 0, 0 |

| Class | Published (TA, detergent D) | sd used | Simulated, standard weights | Simulated, items of the load | Continuous score | (sim - obs) / sd |
|---|---|---|---|---|---|---|
| crockery | 3.68 | 1.11 | 2.64 | 2.68 | 2.67 | -0.91 |
| cutlery | 4.67 | 0.51 | 3.72 | 3.82 | 3.73 | -1.84 |
| glass | 3.43 | 1.00 | 1.75 | 0.63 | 1.75 | -1.68 |
| melamine | 4.21 | 1.32 | 4.50 | 4.50 | 4.25 | 0.03 |
| all | 4.17 | 0.62 | 3.15 | 3.31 | 3.15 | -1.65 |

Share of items clean: 58 % with the standard weights, 61 % of the items of the load. Ranking terms: cutlery>melamine violated by 0.52; cutlery>crockery holds; cutlery>glass holds; melamine>crockery holds; melamine>glass holds. Log likelihood (weighted) -1.256, bench penalty 206.67.

| Egg-yolk tile (soils 6.1) | Published (%/min) | Simulated | Tolerance | Within |
|---|---|---|---|---|
| 30 C, pH 10.5, 0.06 g/L | 0.85 | 0.63 | 0.17 | NO |
| 55 C, pH 10.5, 0.06 g/L | 1.75 | 1.25 | 0.35 | NO |
| 55 C, pH 10.5, 0.02 g/L | 0.17 | 0.12 | 0.05 | yes |
| 55 C, pH 10.5, 0.1 g/L | 2.59 | 1.73 | 0.52 | NO |
| 55 C, pH 9.5, 0.06 g/L | 0.69 | 0.48 | 0.16 | NO |
| 55 C, pH 11.5, 0.06 g/L | 4.66 | 3.39 | 0.93 | NO |

| IKW programme (soils 6.4) | Loading (g/m2) | Left | Leaves a residue |
|---|---|---|---|
| egg yolk (egg_yolk, warm, 12 h) | 54.0 | 97.5 % | yes |
| starch mix (starch, warm, 48 h) | 37.5 | 91.5 % | yes |
| minced meat (egg_yolk, baked, 2 h) | 25.0 | 100.0 % | yes (hardly touched) |
| tea (tea, warm, 72 h) | 0.5 | 69.3 % | yes |

### Mechanism corrections, nothing fitted

eco_50, tier official: 97 items (68 soiled); mean score 3.21; clean 57 of 97 (59 %); soiled items clean 28 of 68; dry soil left 0.84 of 19.98 g (4.2 %); detergent 20.0 of 20.0 g; water held 2 mL

| Class | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |
|---|---|---|---|---|
| crockery | 22 | 2.00 | 8 | 11, 2, 1, 0, 0, 8 |
| cutlery | 65 | 3.88 | 46 | 7, 5, 3, 4, 1, 45 |
| glass | 8 | 0.63 | 1 | 7, 0, 0, 0, 0, 1 |
| melamine | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| pots | 0 | n/a | 0 | 0, 0, 0, 0, 0, 0 |
| all | 97 | 3.21 | 57 | 25, 7, 4, 4, 1, 56 |

| Soil | Class | Records | Left (mg of mg) | Left % | Mean score | Clean | Visible area median, max (mm2) |
|---|---|---|---|---|---|---|---|
| iec_egg_yolk | egg_yolk | 17 | 161.4 of 8999.9 | 1.8 | 0.35 | 0 of 17 | 223, 835 |
| iec_margarine | fat | 12 | 13.5 of 3602.0 | 0.4 | 3.92 | 7 of 12 | 1, 31 |
| iec_milk | egg_yolk | 7 | 661.0 of 3545.6 | 18.6 | 0.00 | 0 of 7 | 1040, 4377 |
| iec_minced_meat | egg_yolk | 3 | 0.0 of 1637.8 | 0.0 | 4.00 | 2 of 3 | 0, 2 |
| iec_oat_flakes | starch | 19 | 1.3 of 1704.7 | 0.1 | 4.53 | 16 of 19 | 0, 67 |
| iec_spinach | starch | 3 | 0.0 of 457.5 | 0.0 | 5.00 | 3 of 3 | 0, 0 |
| iec_tea | tea | 7 | 2.8 of 27.7 | 10.1 | 0.00 | 0 of 7 | 3371, 4945 |

| Type | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |
|---|---|---|---|---|
| dessert_bowl_vitrelle_130 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| dessert_plate_porcelain_190 | 5 | 2.00 | 2 | 3, 0, 0, 0, 0, 2 |
| dessert_spoon_160 | 12 | 5.00 | 12 | 0, 0, 0, 0, 0, 12 |
| dinner_fork_185 | 11 | 0.36 | 0 | 7, 4, 0, 0, 0, 0 |
| dinner_knife_210 | 12 | 3.92 | 7 | 0, 0, 2, 3, 1, 6 |
| dinner_plate_porcelain_iec | 5 | 1.80 | 1 | 1, 2, 1, 0, 0, 1 |
| ladle_steel_311 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| melamine_dessert_plate_iec_195 | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| mug_ceramic_300 | 3 | 0.00 | 0 | 3, 0, 0, 0, 0, 0 |
| saucer_porcelain_140 | 2 | 0.00 | 0 | 2, 0, 0, 0, 0, 0 |
| serving_fork_210 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| serving_spoon_216 | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| soup_plate_porcelain_230 | 5 | 5.00 | 5 | 0, 0, 0, 0, 0, 5 |
| soup_spoon_190 | 13 | 4.31 | 10 | 0, 1, 1, 1, 0, 10 |
| tea_cup_porcelain_210 | 2 | 0.00 | 0 | 2, 0, 0, 0, 0, 0 |
| teaspoon_130 | 13 | 5.00 | 13 | 0, 0, 0, 0, 0, 13 |
| test_glass_borosilicate_250 | 7 | 0.00 | 0 | 7, 0, 0, 0, 0, 0 |

| Class | Published (TA, detergent D) | sd used | Simulated, standard weights | Simulated, items of the load | Continuous score | (sim - obs) / sd |
|---|---|---|---|---|---|---|
| crockery | 3.68 | 1.11 | 1.45 | 2.00 | 1.51 | -1.95 |
| cutlery | 4.67 | 0.51 | 3.79 | 3.88 | 3.82 | -1.67 |
| glass | 3.43 | 1.00 | 1.75 | 0.63 | 1.75 | -1.68 |
| melamine | 4.21 | 1.32 | 5.00 | 5.00 | 5.00 | 0.60 |
| all | 4.17 | 0.62 | 2.86 | 3.21 | 2.89 | -2.06 |

Share of items clean: 53 % with the standard weights, 59 % of the items of the load. Ranking terms: cutlery>melamine violated by 1.18; cutlery>crockery holds; cutlery>glass holds; melamine>crockery holds; melamine>glass holds. Log likelihood (weighted) -3.166, bench penalty 4.26.

| Egg-yolk tile (soils 6.1) | Published (%/min) | Simulated | Tolerance | Within |
|---|---|---|---|---|
| 30 C, pH 10.5, 0.06 g/L | 0.85 | 0.74 | 0.17 | yes |
| 55 C, pH 10.5, 0.06 g/L | 1.75 | 1.47 | 0.35 | yes |
| 55 C, pH 10.5, 0.02 g/L | 0.17 | 0.14 | 0.05 | yes |
| 55 C, pH 10.5, 0.1 g/L | 2.59 | 2.05 | 0.52 | NO |
| 55 C, pH 9.5, 0.06 g/L | 0.69 | 0.57 | 0.16 | yes |
| 55 C, pH 11.5, 0.06 g/L | 4.66 | 3.99 | 0.93 | yes |

| IKW programme (soils 6.4) | Loading (g/m2) | Left | Leaves a residue |
|---|---|---|---|
| egg yolk (egg_yolk, warm, 12 h) | 54.0 | 91.9 % | yes |
| starch mix (starch, warm, 48 h) | 37.5 | 85.2 % | yes |
| minced meat (egg_yolk, baked, 2 h) | 25.0 | 99.6 % | yes (hardly touched) |
| tea (tea, warm, 72 h) | 0.5 | 69.3 % | yes |

### Anchored set anchored-v1

eco_50, tier official: 97 items (68 soiled); mean score 4.27; clean 76 of 97 (78 %); soiled items clean 47 of 68; dry soil left 0.42 of 19.98 g (2.1 %); detergent 20.0 of 20.0 g; water held 2 mL

| Class | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |
|---|---|---|---|---|
| crockery | 22 | 4.09 | 17 | 1, 1, 3, 0, 2, 15 |
| cutlery | 65 | 4.43 | 52 | 0, 3, 3, 7, 2, 50 |
| glass | 8 | 3.25 | 5 | 1, 1, 1, 0, 2, 3 |
| melamine | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| pots | 0 | n/a | 0 | 0, 0, 0, 0, 0, 0 |
| all | 97 | 4.27 | 76 | 2, 5, 7, 7, 6, 70 |

| Soil | Class | Records | Left (mg of mg) | Left % | Mean score | Clean | Visible area median, max (mm2) |
|---|---|---|---|---|---|---|---|
| iec_egg_yolk | egg_yolk | 17 | 21.0 of 8999.9 | 0.2 | 4.12 | 12 of 17 | 0, 160 |
| iec_margarine | fat | 12 | 13.5 of 3602.0 | 0.4 | 3.92 | 7 of 12 | 1, 31 |
| iec_milk | egg_yolk | 7 | 381.6 of 3545.6 | 10.8 | 3.00 | 4 of 7 | 0, 4096 |
| iec_minced_meat | egg_yolk | 3 | 0.0 of 1637.8 | 0.0 | 5.00 | 3 of 3 | 0, 0 |
| iec_oat_flakes | starch | 19 | 1.3 of 1704.7 | 0.1 | 4.53 | 16 of 19 | 0, 67 |
| iec_spinach | starch | 3 | 0.0 of 457.5 | 0.0 | 5.00 | 3 of 3 | 0, 0 |
| iec_tea | tea | 7 | 0.9 of 27.7 | 3.3 | 2.14 | 2 of 7 | 2, 647 |

| Type | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |
|---|---|---|---|---|
| dessert_bowl_vitrelle_130 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| dessert_plate_porcelain_190 | 5 | 5.00 | 5 | 0, 0, 0, 0, 0, 5 |
| dessert_spoon_160 | 12 | 5.00 | 12 | 0, 0, 0, 0, 0, 12 |
| dinner_fork_185 | 11 | 3.64 | 6 | 0, 2, 0, 3, 1, 5 |
| dinner_knife_210 | 12 | 3.92 | 7 | 0, 0, 2, 3, 1, 6 |
| dinner_plate_porcelain_iec | 5 | 5.00 | 5 | 0, 0, 0, 0, 0, 5 |
| ladle_steel_311 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| melamine_dessert_plate_iec_195 | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| mug_ceramic_300 | 3 | 1.67 | 0 | 0, 1, 2, 0, 0, 0 |
| saucer_porcelain_140 | 2 | 4.00 | 2 | 0, 0, 0, 0, 2, 0 |
| serving_fork_210 | 1 | 5.00 | 1 | 0, 0, 0, 0, 0, 1 |
| serving_spoon_216 | 2 | 5.00 | 2 | 0, 0, 0, 0, 0, 2 |
| soup_plate_porcelain_230 | 5 | 5.00 | 5 | 0, 0, 0, 0, 0, 5 |
| soup_spoon_190 | 13 | 4.31 | 10 | 0, 1, 1, 1, 0, 10 |
| tea_cup_porcelain_210 | 2 | 1.00 | 0 | 1, 0, 1, 0, 0, 0 |
| teaspoon_130 | 13 | 5.00 | 13 | 0, 0, 0, 0, 0, 13 |
| test_glass_borosilicate_250 | 7 | 3.00 | 4 | 1, 1, 1, 0, 2, 2 |

| Class | Published (TA, detergent D) | sd used | Simulated, standard weights | Simulated, items of the load | Continuous score | (sim - obs) / sd |
|---|---|---|---|---|---|---|
| crockery | 3.68 | 1.11 | 3.63 | 4.09 | 3.61 | -0.06 |
| cutlery | 4.67 | 0.51 | 4.41 | 4.43 | 4.40 | -0.52 |
| glass | 3.43 | 1.00 | 3.70 | 3.25 | 3.80 | 0.37 |
| melamine | 4.21 | 1.32 | 5.00 | 5.00 | 5.00 | 0.60 |
| all | 4.17 | 0.62 | 4.10 | 4.27 | 4.11 | -0.10 |

Share of items clean: 75 % with the standard weights, 78 % of the items of the load. Ranking terms: cutlery>melamine violated by 0.60; cutlery>crockery holds; cutlery>glass holds; melamine>crockery holds; melamine>glass holds. Log likelihood (weighted) -0.589, bench penalty 0.07.

| Egg-yolk tile (soils 6.1) | Published (%/min) | Simulated | Tolerance | Within |
|---|---|---|---|---|
| 30 C, pH 10.5, 0.06 g/L | 0.85 | 0.89 | 0.17 | yes |
| 55 C, pH 10.5, 0.06 g/L | 1.75 | 1.76 | 0.35 | yes |
| 55 C, pH 10.5, 0.02 g/L | 0.17 | 0.17 | 0.05 | yes |
| 55 C, pH 10.5, 0.1 g/L | 2.59 | 2.45 | 0.52 | yes |
| 55 C, pH 9.5, 0.06 g/L | 0.69 | 0.67 | 0.16 | yes |
| 55 C, pH 11.5, 0.06 g/L | 4.66 | 4.74 | 0.93 | yes |

| IKW programme (soils 6.4) | Loading (g/m2) | Left | Leaves a residue |
|---|---|---|---|
| egg yolk (egg_yolk, warm, 12 h) | 54.0 | 73.8 % | yes |
| starch mix (starch, warm, 48 h) | 37.5 | 85.2 % | yes |
| minced meat (egg_yolk, baked, 2 h) | 25.0 | 98.8 % | yes (hardly touched) |
| tea (tea, warm, 72 h) | 0.5 | 57.4 % | yes |

Parameter set: registry sha256:9bf55871554c74d8d83f1915a4b739bce6a5f9fa4b875783a3640f2fd4e9ae3f, hydro sha256:92b560b0af5c52a773d10884243c1573203c91ce66a2b7162e98f46e222daf28, soil sha256:c29f2fb32656c757a0689782fbf7aa1ebbff7b50456b708ed23d1c577730d6be.
