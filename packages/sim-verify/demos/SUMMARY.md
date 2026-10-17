# Demonstration washes

Settled standard loads of the owner's Bosch SMV4HAX40G, programme eco_50, tier official. Written by `scripts/demo-washes.ts`; per-item tables in `<name>.table.md`, inputs in `<name>.wash.json`, results in `<name>.result.json`.

Parameters: anchored-v8.owner-capsule; detergent unnamed detergent, 12.9 g. Simulator spotless-sim 0.5.0 water-7, source bf06e0043dfb4f63 (exposure sources 03658efea6fc6c36); hydro sha256:7c3bd46790e7, soil sha256:4efd74efe4a0.

| | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| Items | 114 | 114 | 59 | 113 |
| Items clean | 86 | 35 | 47 | 82 |
| Mean IEC score | 4.14 | 1.69 | 4.22 | 3.86 |
| Dry soil at the start (g) | 29.26 | 29.26 | 17.86 | 29.10 |
| Dry soil left (g) | 0.06 | 9.71 | 0.04 | 0.06 |
| Soil left (%) | 0.2 | 33.2 | 0.2 | 0.2 |
| Water held in vessels (mL) | 0 | 3671 | 0 | 1273 |
| Blocks | 1115120 | 1115120 | 739577 | 1104207 |
| Deposits | 592485 | 592485 | 347185 | 582506 |
| Time, scene (s) | 13.5 | 10.3 | 6.4 | 8.6 |
| Time, hydraulics (s) | 0.1 | 0.1 | 0.0 | 0.0 |
| Time, exposure (s) | 1.2 | 74.8 | 308.2 | 340.0 |
| Time, soil (s) | 1.5 | 1.5 | 0.8 | 1.2 |
| Time, replay (s) | 7.6 | 86.2 | 8.3 | 32.8 |
| Time, result (s) | 2.7 | 8.4 | 1.4 | 2.6 |
| Time, total (s) | 26.6 | 181.4 | 325.1 | 385.4 |
| Exposure sets computed / cached | 0 / 4 | 1 / 11 | 4 / 0 | 4 / 0 |
| GPU memory, scene / peak (MB) | 0.0 / 0.0 | 167.3 / 167.3 | 142.2 / 167.3 | 166.9 / 167.3 |
| Process RSS (GB) | 1.57 | 1.10 | 1.61 | 1.55 |
| Sump return per revolution (%) | 99.93, 99.93, 99.98, 99.98 | 99.92, 99.99, 0.00, 99.95, 99.97, 99.98, 99.98, 0.00, 99.96, 99.98 | 99.94, 99.95, 99.96, 99.98 | 99.93, 99.92, 99.94, 99.95 |
| Water balance closes | yes | yes | yes | yes |
| Problems reported (placement and other, machine timeline) | 0, 0 | 12, 4 | 0, 0 | 1, 0 |
| Mains water (L), energy (kWh) | 9.5, 0.90 | 10.5, 0.62 | 9.5, 0.90 | 9.5, 0.90 |
| Detergent dissolved (g of dosed) | 12.9 of 12.9 | 6.4 of 12.9 | 12.9 of 12.9 | 12.9 of 12.9 |

## Residue by soil (mg left of mg applied, dry)

| Soil | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| iec_egg_yolk | 53.8 of 11620.4 (0 %) | 8024.4 of 11620.4 (69 %) | 11.3 of 6025.4 (0 %) | 34.4 of 11620.4 (0 %) |
| iec_margarine | 0.4 of 7306.0 (0 %) | 12.0 of 7306.0 (0 %) | 0.7 of 5526.7 (0 %) | 0.4 of 7306.0 (0 %) |
| iec_milk | 8.0 of 4033.1 (0 %) | 882.6 of 4033.1 (22 %) | 21.1 of 2470.9 (1 %) | 26.0 of 4033.1 (1 %) |
| iec_minced_meat | 0.0 of 3119.2 (0 %) | 559.9 of 3119.2 (18 %) | 7.5 of 2038.6 (0 %) | 0.0 of 3119.2 (0 %) |
| iec_oat_flakes | 0.5 of 1918.4 (0 %) | 134.3 of 1918.4 (7 %) | 1.3 of 1142.9 (0 %) | 0.0 of 1918.4 (0 %) |
| iec_spinach | 0.0 of 1247.1 (0 %) | 82.3 of 1247.1 (7 %) | 0.0 of 645.8 (0 %) | 1.3 of 1084.5 (0 %) |
| iec_tea | 1.2 of 16.2 (7 %) | 14.1 of 16.2 (87 %) | 0.6 of 11.7 (5 %) | 2.9 of 16.2 (18 %) |

## Clean items by type (clean of loaded)

| Type | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| dessert_bowl_vitrelle_130 | 3 of 3 | 0 of 3 | 3 of 3 | 2 of 2 |
| dessert_plate_porcelain_190 | 3 of 7 | 0 of 7 | 2 of 3 | 2 of 7 |
| dessert_spoon_160 | 12 of 12 | 12 of 12 | 6 of 6 | 12 of 12 |
| dinner_fork_185 | 0 of 12 | 0 of 12 | 0 of 6 | 0 of 12 |
| dinner_knife_210 | 10 of 13 | 7 of 13 | 5 of 6 | 11 of 13 |
| dinner_plate_porcelain_iec | 6 of 7 | 0 of 7 | 2 of 3 | 6 of 7 |
| melamine_dessert_plate_iec_195 | 6 of 6 | 0 of 6 | 3 of 3 | 5 of 6 |
| mug_ceramic_300 | 1 of 4 | 0 of 4 | 3 of 3 | 0 of 4 |
| oval_platter_porcelain_320 | 1 of 1 | 0 of 1 | 1 of 1 | 1 of 1 |
| saucepan_steel_170 |  |  | 0 of 1 |  |
| saucer_porcelain_140 | 4 of 6 | 0 of 6 | 1 of 1 | 5 of 6 |
| serving_fork_210 | 1 of 1 | 1 of 1 | 1 of 1 | 1 of 1 |
| serving_spoon_216 | 2 of 2 | 2 of 2 | 1 of 1 | 2 of 2 |
| soup_plate_porcelain_230 | 6 of 6 | 0 of 6 | 3 of 3 | 6 of 6 |
| soup_spoon_190 | 11 of 13 | 0 of 13 | 5 of 6 | 12 of 13 |
| tea_cup_porcelain_210 |  |  | 1 of 1 |  |
| teaspoon_130 | 13 of 13 | 13 of 13 | 6 of 6 | 13 of 13 |
| test_glass_borosilicate_250 | 7 of 8 | 0 of 8 | 4 of 5 | 4 of 8 |
