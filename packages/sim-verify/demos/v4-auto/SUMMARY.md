# Demonstration washes

Settled standard loads of the owner's Bosch SMV4HAX40G, Auto 45-65, tier official. Written by `scripts/demo-washes.ts`; per-item tables in `<name>.table.md`, inputs in `<name>.wash.json`, results in `<name>.result.json`.

Parameters: anchored-v4.owner-capsule; detergent unnamed detergent, 12.9 g. Simulator spotless-sim 0.4.1 water-5, source 50cf242c67c527f7 (exposure sources 34816aba7271f075); hydro sha256:ecdf6e077c2e, soil sha256:45173d348ccd.

| | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| Items | 118 | 118 | 62 | 118 |
| Items clean | 66 | 38 | 33 | 39 |
| Mean IEC score | 2.82 | 1.69 | 2.76 | 1.71 |
| Dry soil at the start (g) | 31.75 | 31.75 | 18.41 | 31.75 |
| Dry soil left (g) | 5.36 | 22.30 | 2.83 | 21.68 |
| Soil left (%) | 16.9 | 70.2 | 15.4 | 68.3 |
| Water held in vessels (mL) | 20 | 5139 | 18 | 1613 |
| Blocks | 1165254 | 1165254 | 769488 | 1165254 |
| Deposits | 635300 | 635300 | 372148 | 635300 |
| Time, scene (s) | 22.7 | 15.4 | 9.2 | 11.3 |
| Time, hydraulics (s) | 0.1 | 0.1 | 0.0 | 0.0 |
| Time, exposure (s) | 475.0 | 473.2 | 389.7 | 385.7 |
| Time, soil (s) | 2.3 | 2.2 | 1.2 | 1.5 |
| Time, replay (s) | 9.4 | 42.4 | 7.3 | 70.4 |
| Time, result (s) | 8.8 | 13.5 | 3.9 | 10.4 |
| Time, total (s) | 518.3 | 546.8 | 411.5 | 479.4 |
| Exposure sets computed / cached | 4 / 0 | 6 / 0 | 4 / 0 | 4 / 0 |
| GPU memory, scene / peak (MB) | 165.2 / 165.2 | 165.2 / 165.2 | 141.3 / 165.2 | 165.3 / 165.3 |
| Process RSS (GB) | 1.19 | 1.87 | 1.64 | 1.57 |
| Sump return per revolution (%) | 99.94, 99.94, 99.98, 99.98 | 99.94, 0.00, 99.95, 99.98, 0.00, 99.98 | 99.88, 99.88, 99.79, 99.80 | 99.94, 99.93, 99.96, 99.95 |
| Water balance closes | yes | yes | yes | yes |
| Problems reported (placement and other, machine timeline) | 0, 0 | 12, 1 | 0, 0 | 1, 0 |
| Mains water (L), energy (kWh) | 11.5, 1.04 | 12.0, 1.06 | 11.5, 1.04 | 11.5, 1.04 |
| Detergent dissolved (g of dosed) | 12.9 of 12.9 | 5.5 of 12.9 | 12.9 of 12.9 | 5.4 of 12.9 |

## Residue by soil (mg left of mg applied, dry)

| Soil | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| iec_egg_yolk | 4663.5 of 11620.4 (40 %) | 11342.2 of 11620.4 (98 %) | 2389.8 of 6025.4 (40 %) | 11215.6 of 11620.4 (97 %) |
| iec_margarine | 0.4 of 7306.0 (0 %) | 1.1 of 7306.0 (0 %) | 0.6 of 5526.7 (0 %) | 1.9 of 7306.0 (0 %) |
| iec_milk | 648.8 of 6610.9 (10 %) | 6475.5 of 6610.9 (98 %) | 84.5 of 2956.2 (3 %) | 6314.8 of 6610.9 (96 %) |
| iec_minced_meat | 32.6 of 3119.2 (1 %) | 2906.6 of 3119.2 (93 %) | 349.7 of 2038.6 (17 %) | 2827.1 of 3119.2 (91 %) |
| iec_oat_flakes | 0.1 of 1918.4 (0 %) | 983.4 of 1918.4 (51 %) | 1.6 of 1142.9 (0 %) | 849.2 of 1918.4 (44 %) |
| iec_spinach | 0.0 of 1079.2 (0 %) | 505.0 of 1079.2 (47 %) | 0.0 of 645.8 (0 %) | 398.2 of 1079.2 (37 %) |
| iec_tea | 10.0 of 97.3 (10 %) | 81.8 of 97.3 (84 %) | 7.8 of 70.5 (11 %) | 76.9 of 97.3 (79 %) |

## Clean items by type (clean of loaded)

| Type | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| dessert_bowl_vitrelle_130 | 2 of 2 | 0 of 2 | 2 of 3 | 0 of 2 |
| dessert_plate_porcelain_190 | 3 of 7 | 0 of 7 | 1 of 3 | 0 of 7 |
| dessert_spoon_160 | 12 of 12 | 12 of 12 | 6 of 6 | 12 of 12 |
| dinner_fork_185 | 0 of 12 | 0 of 12 | 0 of 6 | 0 of 12 |
| dinner_knife_210 | 11 of 13 | 9 of 13 | 5 of 6 | 10 of 13 |
| dinner_plate_porcelain_iec | 0 of 7 | 0 of 7 | 0 of 3 | 0 of 7 |
| melamine_dessert_plate_iec_195 | 3 of 6 | 0 of 6 | 2 of 3 | 0 of 6 |
| mug_ceramic_300 | 0 of 4 | 0 of 4 | 0 of 3 | 0 of 4 |
| oval_platter_porcelain_320 | 1 of 1 | 1 of 1 | 1 of 1 | 1 of 1 |
| saucepan_steel_170 |  |  | 0 of 1 |  |
| saucer_porcelain_140 | 0 of 6 | 0 of 6 | 0 of 1 | 0 of 6 |
| serving_fork_210 | 1 of 1 | 1 of 1 | 1 of 1 | 1 of 1 |
| serving_spoon_216 | 2 of 2 | 2 of 2 | 1 of 1 | 2 of 2 |
| soup_plate_porcelain_230 | 6 of 6 | 0 of 6 | 3 of 3 | 0 of 6 |
| soup_spoon_190 | 12 of 13 | 0 of 13 | 5 of 6 | 0 of 13 |
| tea_cup_porcelain_210 |  |  | 0 of 3 |  |
| teaspoon_130 | 13 of 13 | 13 of 13 | 6 of 6 | 13 of 13 |
| test_glass_borosilicate_250 | 0 of 13 | 0 of 13 | 0 of 6 | 0 of 13 |
