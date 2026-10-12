# Demonstration washes

> **Superseded.** These tables and the result files beside them are of 10 to 11 October 2026, 05:10: parameter set `anchored-v5.owner-capsule` (the set the owner's test wash rejected), simulator `water-6`, the upper basket as it was drawn before it was corrected from his photograph (118 items in the standard load; it holds 114 now). The current default is `anchored-v7.owner-capsule` on `water-7` (`docs/calibration/anchoring-v7.md` has its tables for the same loads). Since 11 October a wash also counts what the water left standing in an item held as residue on the surface under it. To make them again: `pnpm --filter @spotless/sim-verify exec tsx scripts/demo-washes.ts` with the parameter files `MACHINE_WASH_DEFAULTS` names in `packages/wash-runner/src/defaults.ts` (four cold official washes).

Settled standard loads of the owner's Bosch SMV4HAX40G, programme eco_50, tier official. Written by `scripts/demo-washes.ts`; per-item tables in `<name>.table.md`, inputs in `<name>.wash.json`, results in `<name>.result.json`.

Parameters: anchored-v5.owner-capsule; detergent unnamed detergent, 12.9 g. Simulator spotless-sim 0.5.0 water-6, source a1a3f956ff32e455 (exposure sources 3ae47724f84751e1); hydro sha256:7c3bd46790e7, soil sha256:4e8965089aed.

| | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| Items | 118 | 118 | 62 | 118 |
| Items clean | 78 | 28 | 41 | 40 |
| Mean IEC score | 3.42 | 1.19 | 3.40 | 1.72 |
| Dry soil at the start (g) | 31.75 | 31.75 | 18.41 | 31.75 |
| Dry soil left (g) | 0.52 | 24.76 | 0.21 | 19.36 |
| Soil left (%) | 1.6 | 78.0 | 1.2 | 61.0 |
| Water held in vessels (mL) | 20 | 5139 | 18 | 1613 |
| Blocks | 1165254 | 1165254 | 769488 | 1165254 |
| Deposits | 635300 | 635300 | 372148 | 635300 |
| Time, scene (s) | 13.2 | 15.2 | 5.4 | 9.4 |
| Time, hydraulics (s) | 0.1 | 0.1 | 0.0 | 0.0 |
| Time, exposure (s) | 358.0 | 447.3 | 371.3 | 318.2 |
| Time, soil (s) | 2.5 | 1.4 | 1.1 | 1.2 |
| Time, replay (s) | 13.8 | 20.1 | 9.8 | 84.9 |
| Time, result (s) | 5.2 | 8.5 | 2.0 | 8.8 |
| Time, total (s) | 392.7 | 492.6 | 389.8 | 422.5 |
| Exposure sets computed / cached | 4 / 0 | 8 / 0 | 4 / 0 | 4 / 0 |
| GPU memory, scene / peak (MB) | 165.2 / 165.2 | 165.2 / 165.2 | 141.3 / 165.2 | 165.3 / 165.3 |
| Process RSS (GB) | 1.17 | 2.19 | 0.87 | 1.94 |
| Sump return per revolution (%) | 99.95, 99.93, 99.98, 99.98 | 99.94, 0.00, 0.00, 99.97, 0.00, 0.00 | 99.88, 99.89, 99.79, 99.80 | 99.94, 99.93, 99.96, 99.95 |
| Water balance closes | yes | yes | yes | yes |
| Problems reported (placement and other, machine timeline) | 0, 0 | 12, 4 | 0, 0 | 1, 0 |
| Mains water (L), energy (kWh) | 9.5, 0.90 | 10.5, 0.59 | 9.5, 0.90 | 9.5, 0.90 |
| Detergent dissolved (g of dosed) | 12.9 of 12.9 | 5.4 of 12.9 | 12.9 of 12.9 | 5.1 of 12.9 |

## Residue by soil (mg left of mg applied, dry)

| Soil | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| iec_egg_yolk | 421.7 of 11620.4 (4 %) | 11602.3 of 11620.4 (100 %) | 194.2 of 6025.4 (3 %) | 10666.6 of 11620.4 (92 %) |
| iec_margarine | 0.4 of 7306.0 (0 %) | 513.6 of 7306.0 (7 %) | 0.6 of 5526.7 (0 %) | 1.9 of 7306.0 (0 %) |
| iec_milk | 87.8 of 6610.9 (1 %) | 6607.5 of 6610.9 (100 %) | 0.4 of 2956.2 (0 %) | 5798.7 of 6610.9 (88 %) |
| iec_minced_meat | 0.0 of 3119.2 (0 %) | 3106.2 of 3119.2 (100 %) | 12.3 of 2038.6 (1 %) | 2408.9 of 3119.2 (77 %) |
| iec_oat_flakes | 0.0 of 1918.4 (0 %) | 1801.8 of 1918.4 (94 %) | 1.2 of 1142.9 (0 %) | 288.0 of 1918.4 (15 %) |
| iec_spinach | 0.0 of 1079.2 (0 %) | 1030.4 of 1079.2 (95 %) | 0.0 of 645.8 (0 %) | 120.6 of 1079.2 (11 %) |
| iec_tea | 8.7 of 97.3 (9 %) | 94.2 of 97.3 (97 %) | 5.8 of 70.5 (8 %) | 77.4 of 97.3 (80 %) |

## Clean items by type (clean of loaded)

| Type | iec-13-careful | iec-13-careful-badly | half-careful | iec-13-careless |
|---|---|---|---|---|
| dessert_bowl_vitrelle_130 | 2 of 2 | 0 of 2 | 3 of 3 | 0 of 2 |
| dessert_plate_porcelain_190 | 3 of 7 | 0 of 7 | 1 of 3 | 0 of 7 |
| dessert_spoon_160 | 12 of 12 | 12 of 12 | 6 of 6 | 12 of 12 |
| dinner_fork_185 | 0 of 12 | 0 of 12 | 0 of 6 | 0 of 12 |
| dinner_knife_210 | 11 of 13 | 0 of 13 | 5 of 6 | 11 of 13 |
| dinner_plate_porcelain_iec | 3 of 7 | 0 of 7 | 1 of 3 | 0 of 7 |
| melamine_dessert_plate_iec_195 | 6 of 6 | 0 of 6 | 3 of 3 | 0 of 6 |
| mug_ceramic_300 | 0 of 4 | 0 of 4 | 0 of 3 | 0 of 4 |
| oval_platter_porcelain_320 | 1 of 1 | 0 of 1 | 1 of 1 | 1 of 1 |
| saucepan_steel_170 |  |  | 0 of 1 |  |
| saucer_porcelain_140 | 0 of 6 | 0 of 6 | 0 of 1 | 0 of 6 |
| serving_fork_210 | 1 of 1 | 1 of 1 | 1 of 1 | 1 of 1 |
| serving_spoon_216 | 2 of 2 | 2 of 2 | 1 of 1 | 2 of 2 |
| soup_plate_porcelain_230 | 6 of 6 | 0 of 6 | 3 of 3 | 0 of 6 |
| soup_spoon_190 | 13 of 13 | 0 of 13 | 5 of 6 | 0 of 13 |
| tea_cup_porcelain_210 |  |  | 0 of 3 |  |
| teaspoon_130 | 13 of 13 | 13 of 13 | 6 of 6 | 13 of 13 |
| test_glass_borosilicate_250 | 5 of 13 | 0 of 13 | 5 of 6 | 0 of 13 |
