# Demonstration washes

Settled standard loads of the owner's Bosch SMV4HAX40G, Auto 45-65, tier official. Written by `scripts/demo-washes.ts`; per-item tables in `<name>.table.md`, inputs in `<name>.wash.json`, results in `<name>.result.json`.

| | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| Items | 104 | 104 | 57 | 115 |
| Items clean | 34 | 33 | 20 | 31 |
| Mean IEC score | 2.03 | 1.68 | 2.00 | 1.45 |
| Dry soil at the start (g) | 72.55 | 72.55 | 40.87 | 79.73 |
| Dry soil left (g) | 56.78 | 62.84 | 30.44 | 69.12 |
| Soil left (%) | 78.3 | 86.6 | 74.5 | 86.7 |
| Water held in vessels (mL) | 20 | 3965 | 16 | 1905 |
| Blocks | 963281 | 963281 | 677539 | 1146097 |
| Deposits | 496969 | 496969 | 308421 | 636521 |
| Time, scene (s) | 10.8 | 7.7 | 4.9 | 8.0 |
| Time, hydraulics (s) | 0.0 | 0.0 | 0.0 | 0.0 |
| Time, exposure (s) | 203.4 | 206.3 | 170.2 | 221.1 |
| Time, soil (s) | 1.3 | 1.1 | 0.8 | 1.5 |
| Time, replay (s) | 5.6 | 16.4 | 5.0 | 38.9 |
| Time, result (s) | 1.1 | 1.0 | 0.7 | 1.4 |
| Time, total (s) | 222.1 | 232.5 | 181.6 | 270.9 |
| Exposure sets computed / cached | 4 / 0 | 6 / 0 | 4 / 0 | 4 / 0 |
| GPU memory, scene / peak (MB) | 144.8 / 144.8 | 144.8 / 144.8 | 126.6 / 144.8 | 158.1 / 158.1 |
| Process RSS (GB) | 0.92 | 0.87 | 0.72 | 0.60 |
| Sump return per revolution (%) | 99.50, 99.49, 99.78, 99.79 | 99.49, 0.00, 99.48, 99.77, 0.00, 99.74 | 99.54, 99.54, 99.74, 99.74 | 99.40, 99.40, 99.48, 99.45 |
| Water balance closes | yes | yes | yes | yes |
| Problems reported (placement and other, machine timeline) | 0, 0 | 2, 1 | 0, 0 | 1, 0 |
| Mains water (L), energy (kWh) | 11.5, 1.04 | 12.0, 1.06 | 11.5, 1.04 | 11.5, 1.04 |
| Detergent dissolved (g of dosed) | 20.0 of 20.0 | 5.6 of 20.0 | 20.0 of 20.0 | 5.6 of 20.0 |

## Residue by soil (mg left of mg applied, dry)

| Soil | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| iec_egg_yolk | 10387.6 of 11950.0 (87 %) | 11947.4 of 11950.0 (100 %) | 5122.7 of 5900.0 (87 %) | 11946.2 of 11950.0 (100 %) |
| iec_margarine | 9.5 of 8900.0 (0 %) | 7.3 of 8900.0 (0 %) | 0.1 of 6800.0 (0 %) | 9.7 of 8900.0 (0 %) |
| iec_milk | 44165.0 of 45000.0 (98 %) | 44999.6 of 45000.0 (100 %) | 24528.1 of 25000.0 (98 %) | 49998.9 of 50000.0 (100 %) |
| iec_minced_meat | 1692.0 of 3150.0 (54 %) | 3148.0 of 3150.0 (100 %) | 550.2 of 1050.0 (52 %) | 3147.2 of 3150.0 (100 %) |
| iec_oat_flakes | 5.2 of 552.0 (1 %) | 260.7 of 552.0 (47 %) | 2.9 of 624.0 (0 %) | 725.6 of 1728.0 (42 %) |
| iec_spinach | 524.1 of 3000.0 (17 %) | 2471.6 of 3000.0 (82 %) | 239.0 of 1500.0 (16 %) | 3294.5 of 4000.0 (82 %) |
| iec_tea | 0.1 of 0.9 (16 %) | 0.8 of 0.9 (93 %) | 0.1 of 0.9 (12 %) | 1.3 of 1.4 (90 %) |

## Clean items by type (clean of loaded)

| Type | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| dessert_bowl_vitrelle_130 |  |  |  | 0 of 5 |
| dessert_plate_porcelain_190 | 0 of 7 | 0 of 7 | 0 of 3 | 0 of 7 |
| dessert_spoon_160 | 12 of 12 | 12 of 12 | 6 of 6 | 12 of 12 |
| dinner_fork_185 | 0 of 13 | 0 of 13 | 0 of 6 | 0 of 13 |
| dinner_knife_210 | 8 of 13 | 7 of 13 | 6 of 6 | 7 of 13 |
| dinner_plate_porcelain_iec | 0 of 7 | 0 of 7 | 0 of 3 | 0 of 7 |
| melamine_dessert_plate_iec_195 | 0 of 6 | 0 of 6 | 0 of 3 | 0 of 6 |
| mug_ceramic_300 | 0 of 4 | 0 of 4 | 0 of 3 | 0 of 5 |
| oval_platter_porcelain_320 | 1 of 1 | 1 of 1 | 1 of 1 | 1 of 1 |
| saucer_porcelain_140 | 0 of 5 | 0 of 5 | 0 of 3 | 0 of 6 |
| serving_fork_210 | 1 of 1 | 1 of 1 | 1 of 1 |  |
| serving_spoon_216 | 2 of 2 | 2 of 2 | 1 of 1 | 2 of 2 |
| soup_plate_porcelain_230 | 0 of 1 | 0 of 1 | 0 of 2 | 0 of 4 |
| soup_spoon_190 | 0 of 13 | 0 of 13 | 0 of 6 | 0 of 12 |
| tea_cup_porcelain_210 |  |  | 0 of 3 | 0 of 3 |
| teaspoon_130 | 10 of 10 | 10 of 10 | 5 of 5 | 9 of 9 |
| test_glass_borosilicate_250 | 0 of 9 | 0 of 9 | 0 of 5 | 0 of 10 |
