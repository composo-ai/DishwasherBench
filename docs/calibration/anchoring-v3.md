# The third anchoring: `anchored-v3` and the owner-capsule layer

> **Record of the build.** The set the game washes with today is `anchored-v7.owner-capsule`,
> described in `anchoring-v7.md`; the banner below was written when `anchored-v4` was current.
> The index of the documents is `docs/README.md`.

> **Superseded on the evening of 10 October 2026 by `anchoring-v4.md`** (water side
> `spotless-sim 0.4.1 water-5`, the regenerated standard loads). The sets and reports this note
> names are kept under `packages/calibration/anchors/reports/v3/`; the current set is
> `anchored-v4`. What follows stands as the history of the third anchoring.

10 October 2026, afternoon. This note replaces sections 3 to 7 of `anchoring.md` (the second
anchoring, `anchored-v2`, whose files are kept in `packages/calibration/anchors/reports/v2/`).
It is still **a provisional anchoring to another machine's published results**: no wash on the
owner's machine exists. Paths written as `anchors/...`, `scripts/...` and `src/...`
are relative to `packages/calibration`.

**Which simulator.** Every wash below ran on the water side `spotless-sim 0.3.2 water-3`, sources
`sha256:97aa4d392843...` (a frozen copy of 13:01; the water side was being changed while this
was written). The sets record that hash (`anchoredOn`) and `anchors/scripts/check.ts` fails when
the sources on disk differ. **The sets are valid for that water side only, and the standard loads
are being regenerated: every table here must be run again on the new water side and loads**
(about 40 minutes of machine time: `fit.ts`, then the cases of `reports/tables.v3.cases.json`).

## 1. In brief

| | Published (Bosch eco, detergent D) | anchored-v2 | **anchored-v3** |
|---|---|---|---|
| Eco 50, careful load: crockery | 3.68 | 2.56 | **2.56** |
| of it: plates and bowls / tea items | not published | 5.00 / 0.00 | **5.00 / 0.00** |
| cutlery | 4.67 | 4.59 | **4.81** |
| glass (milk glasses alone) | 3.43 | 3.49 (2.68) | **4.07 (3.57)** |
| all but the pots | 4.17 | 3.86 | **4.05** |
| soiled items clean, of 68 | | 48.0 | **54.8** |
| The in-machine egg-yolk tile is 98 % gone at (55 C, 0.06 g/L; from the spread and the fitted rate) | about 65 min | about 110 min | **about 67 min** |
| Auto, owner's capsule, careful: egg yolk left / egg items clean | | 3.0 % / 0 of 17 (heat-stable assumed) | **10.4 % / 0 of 17; 0.8 % / 0 of 17 with the heat-stable bracket** |

1. **The tail was wrong and is corrected from evidence.** The spread of a deposit's loading is
   now the measured one (0.1 inside a deposit; between patches 0.1 for a sprayed layer, 0.15 for
   a brushed one, 0.3 for a paste). The monitor tile then ends where the published one does. The
   last specks of an IEC egg plate need 1.9 times the depth of its mean layer, not 4 times.
2. **Eco 50 agrees with the published class means with one fitted product parameter**
   (`liq.xProtease` 0.010 to 0.013; cutlery and glass ask for the same value). Crockery does
   not: every plate and bowl is clean and every tea item dirty. The bleach rate that reproduces
   the crockery mean (0.0009, tea at 2.9) is 12 % above the default and the tool's rule does not
   accept so small a gain; tea flips from 0 to 5 within plus or minus 15 % of that rate.
3. **Auto does not come out as clean as Eco, and the evidence does not carry it there.** With
   the owner's capsule a well-loaded Auto run removes 90 to 99 % of the egg yolk (57 % under
   anchored-v2 with detergent D) and all of the meat, porridge, spinach and fat, and bleaches 5
   of 7 tea items; every egg item and milk glass still reads dirty, because a 63 min wash takes
   1.3 to 1.45 times the mean depth of an egg plate and clean needs 1.9. Section 5 says exactly
   what is missing. **Run the reference level on Eco 50; do not use Auto verdicts for egg and
   milk.**
4. **Stacking decides outcomes on both programmes**: careful against careless is 84 against 54
   clean items on Eco 50 (detergent D) and 67 against 44 on Auto with the capsule.

## 2. What changed in the model (each a registered parameter with range, tag and source)

| Mechanism | Before | Now | Evidence |
|---|---|---|---|
| End of a deposit: spread inside a deposit, `soil.subCellCv` | 0.3 (set) | **0.1** (set; registry default stays 0, see section 8) | Go23, verified: sd 5 g/m2 at 50 g/m2 on sprayed soil (soils 3.2, 7.7). The in-machine tile is complete at 1.05 to 1.15 times the time of its constant rate (soils 6.1), which bounds its whole spread at 0.10 to 0.15 |
| Spread between 2 mm patches, by how the soil was laid on: `soil.applicationCv` | 0.3 for every soil | **sprayed 0.1, brushed 0.15, spread 0.3, film 0.2** | sprayed verified; brushed estimated (a brushed liquid levels below about 5 mm; range 0.1 to 0.3); spread and film the dossier's estimate for smears |
| Protease activity mid-point `soil.enzymeTm` | 63 C | **75 C** (63 to 85) | enzymes-at-temperature.md, fact-checked: the half-life law already removes the enzyme above 60 C |
| Protease half-life `liq.proteaseHalfLife` | 1800 s (600 to 14400) | 1800 s, **range 180 to 14400** | calcium-free buffer value as lower bound; the default is not decided by any document |
| Protease stability against pH: `liq.proteasePhSlope` (new) | none | **0.56 per pH unit** about pH 10.5 | US 5,677,163 Table III, verified: a factor of 3.6 to 3.7 per pH unit in both calcium states. The capsule's liquor (pH 10.1 to 10.4) keeps its protease 1.3 to 1.7 times as long as detergent D's |
| Lag of dried egg yolk `soil.egg_yolk.tLag` | 540 s | **300 s** (set) | in-machine: "no removal for about the first 5 min" at 55 C; gauge 3.1 min at 55 C, 13 min at 30 C (soils 6.1, 6.2) |
| Supply of fresh liquor | `soil.supplyRenewal` 0.05 1/s on the renewal column (a local speed) | **`soil.supplyExchange` 0.02 1/s on the exchange column** (the inverse of the age of the water) | three mass balances on a 0.15 mm film (products, alkali, enzyme) give 0.010, 0.020 and 0.013 1/s |
| Residual film after its spray stops | kept the supply of the spray; capacity limit optional | **no supply: it removes what it holds (`soil.heldFilmCapacity` 0.02 kg/kg, now the default), scaled by how fresh it was** | mass balance; chemistry 10.2 |
| Visibility by appearance | milk judged as egg yolk, spinach as starch | **model classes split by appearance**: `milk` (translucent, 0.2 mg/cm2), `coloured_starch` (0.035), `soluble_coloured` | standards 10.3; table by soil id in `sim-soil/src/soil-data.ts`, every catalogue soil assigned and tested |
| Fats | every fat melted like butter | **`fat` (butter), `fat_margarine`, `fat_lard`, `fat_tallow`, `fat_oil`** with their own melting curves | chemistry 4.2. Tallow at 40 C: under a third of butter's rate; equal at 55 C |
| Soil data | solids fraction of the class where the catalogue has none (tea x 0.01, milk x 0.5) | **solids fraction, basis, working loading, coverage and ageing per soil id**; microwaved milk read as cooked dry | `docs/calibration/soil-quantities.md` |
| Tea: visibility and film | 10 % of a nominal 0.5 g/m2 | **7.5 % of the IKW-level film (0.5 g/m2); the IEC tea has half that film** | chemistry 8.6 (5 to 10 % of an IKW-level stain); the IEC cup is half-filled once, the IKW cup filled twice with hard water and iron and stored 3 days (ratio estimated, 0.2 to 2) |
| Detergent D protease level | 0.020 (top of the bench range) | **0.013** | fitted, section 3 |
| Capsule protease level | 2.5 x the level fitted for D (0.05) | **0.03** | 32 to 43 mg active per premium unit dose is 0.33 to 0.44 g of the 9.71 % granulate the rate law is written in (US 11,492,571, verified); another maker's product, range 0.0125 to 0.05 |
| Auto programme | one ramp to 65 C | unchanged; **`heatPlateau` option and the named alternative `BOSCH_AUTO_145_STAGED_55_OPTIONS`**; ranges in `BOSCH_AUTO_145_UNCERTAIN`; no branch rule | auto-recommendation.md: target undetermined between 50 and 65 C; every sensor threshold is invented |

Not built, with the reason: a "last layer" that sloughs off whole (the dossier proposes it, soils
7.9; no number exists for when); a rim of 3 to 10 times the loading at the edge of a dried pool
(soils 7.7, an estimate; for a stain it only moves the effective threshold); a manganese
catalyst as a species (section 6); a stronger jet term for chemistry-limited soils (no new
evidence); a shear condition on the starch law (the in-machine starch study found amylase,
time, bleach and hardness significant and tested no mechanical factor; the law reads the same
supply factor as protein, and a porridge film of 1 mg/cm2 needs 8 minutes of supplied liquor).

## 3. The fit (`anchors/scripts/fit.ts`, report `anchors/reports/fit.v3.md`)

Record: round robin 2022/2023, test appliance, detergent D, on the settled careful load (97 of
140 items), Eco 50 with the main wash at 54 C; four washes per point; each class mean through
the calibration tool's likelihood of a group mean score (the new observation kind), the record's
weight 0.25, the tool's prior and its rule (returned to the default when that costs less than
0.5 log units).

| Parameter | Fitted to | Result |
|---|---|---|
| `soil.egg_yolk.rateRef` (and `soil.milk.rateRef`) | the six in-machine rates, bench tile | 3.0e-5 to **3.4e-5** kg/(m2 s); the six rates 0.84 / 1.79 / 0.17 / 2.47 / 0.68 / 4.77 against 0.85 / 1.75 / 0.17 / 2.59 / 0.69 / 4.66 |
| `liq.xProtease` | crockery, cutlery and glass means | scan 0.010 to 0.020: best **0.013**; the default costs 0.564: kept |
| `soil.bleachRate` | the same | scan 0.0008 to 0.0016: best 0.0009 (tea 2.93, crockery 4.00); the default costs 0.071: **returned to 0.0008** (tea 0.29) |

| `liq.xProtease` | Crockery | Plates / tea | Cutlery | Glass | Milk glasses | All |
|---|---|---|---|---|---|---|
| 0.010 | 2.27 | 4.06 / 0.36 | 4.13 | 1.75 | 0.00 | 3.27 |
| 0.012 | 2.76 | 5.00 / 0.36 | 4.51 | 2.59 | 1.29 | 3.73 |
| **0.013** | 2.72 | 5.00 / 0.29 | 4.69 | 3.05 | 2.00 | 3.88 |
| 0.014 | 2.68 | 5.00 / 0.21 | 4.76 | 3.86 | 3.25 | 4.03 |
| 0.016 | 2.68 | 5.00 / 0.21 | 4.84 | 4.40 | 4.07 | 4.15 |
| Published | 3.68 | | 4.67 | 3.43 | | 4.17 |

The response is steep (a Hill exponent of 3): between 0.012 and 0.014 the milk glasses go from
1.3 to 3.3. Cutlery (4.67 between 0.012 and 0.013) and glass (3.43 between 0.013 and 0.014) ask
for the same level with one protein rate for egg and milk, which the second anchoring's long
tail hid. The IKW programme under the set leaves 78 % of the egg yolk, 92 % of the starch mix,
91 % of the minced meat and 69 % of the tea.

## 4. Eco 50 on the owner's machine as written (detergent D, 20 g, official tier)

| Case | Crockery | Plates / tea | Cutlery | Glass | Milk glasses | Melamine | All | Items clean | Soiled items clean | Soiled only: crockery / cutlery / glass / all |
|---|---|---|---|---|---|---|---|---|---|---|
| Published | 3.68 | | 4.67 | 3.43 | | 4.21 | 4.17 | about 70 % | | |
| **anchored-v3, careful** (4 washes) | 2.56 | 5.00 / 0.00 | 4.81 | 4.07 | 3.57 | 5.00 | 4.05 | 83.8 of 97 | 54.8 of 68 | 2.56 / 4.66 / 4.07 / 3.78 |
| registry defaults, careful | 2.21 | 4.30 / 0.00 | 4.20 | 1.75 | 0.00 | 5.00 | 3.29 | 68 of 97 | 39 of 68 | 2.21 / 3.59 / 1.75 / 2.80 |
| anchored-v3, careless | 1.50 | 2.88 / 0.10 | 4.18 | 2.03 | 0.43 | 5.00 | 3.00 | 54 of 92 | 26 of 64 | 1.50 / 3.24 / 2.03 / 2.35 |

By soil, careful (share of dry mass left; mean score; items clean): egg yolk 0.0 %, 4.6, 14.8 of
17; margarine 0.0 %, 4.8, 11 of 12; milk 1.4 %, 3.6, 4.5 of 7; minced meat 5.0, 3 of 3; porridge
4.9, 18.5 of 19; spinach 5.0, 3 of 3; tea 12.3 %, 0.0, 0 of 7. Careless: egg yolk 14 %, 9 of 20
clean; porridge 8.9 %, 10 of 18; milk 0 of 7; spinach 4 of 6; tea 0 of 10.

**For the right reasons?** Partly. On the owner's Eco 50 as written (159 min at 50 C; the round
robin's machine washed at 54 C) the load mean is 0.12 below the published one, cutlery 0.14
above, glass 0.64 above (the protease lasts longer at 50 C than at the record's 54 C). Plates
lose points only where exposure is poor (careless: plates 2.88, 3 of 6 dinner plates clean), as
the brief asks; **in the careful load no plate loses a point, and the published crockery
deficit is carried by tea alone**. Redeposited specks, which is what real melamine and unsoiled
cutlery lose their points to, are not modelled.

## 5. The owner's Auto 45-65 with his capsule (12.9 g)

Two layers over anchored-v3: `anchored-v3.owner-capsule.json` (composition of
`detergents/finish-powerball-ultimate.json`, protease 0.03, stability as registered) and
`anchored-v3.owner-capsule.stable.json` (half-life 2 h at 60 C, an ASSUMPTION: the upper end of
the bracket). Main wash as written: 63 min, peak 65 C, 35 min above 60 C, pH 10.1 to 10.25,
peracid peak 0.45 mmol/L; protease 96 to 32 mg/L (96 to 68 with the stable bracket).

| Case | Crockery | Plates / tea | Cutlery | Glass | All | Items clean | Soiled items clean | Dry soil left |
|---|---|---|---|---|---|---|---|---|
| Auto as written, capsule, **careful** (2 washes) | 3.29 | 2.48 / 4.14 | 4.00 | 1.75 | 3.47 | 67 of 97 | 38 of 68 | 11.5 % |
| the same, **careless** | 1.86 | 1.48 / 1.80 | 3.32 | 1.75 | 2.67 | 44 of 92 | 16 of 64 | 30.9 % |
| Auto as written, stable bracket, careful | 3.80 | 3.46 / 4.14 | 4.05 | 1.75 | 3.67 | 70 of 97 | 41 of 68 | 2.7 % |
| the same, careless | 2.07 | 1.88 / 1.80 | 3.33 | 1.75 | 2.75 | 45 of 92 | 17 of 64 | 18.3 % |
| Auto staged to 55 C, capsule, careful | 2.32 | 3.39 / 1.14 | 4.03 | 1.75 | 3.23 | 65 of 97 | 36 of 68 | 3.0 % |
| the same, careless | 1.40 | 1.88 / 0.70 | 3.35 | 1.75 | 2.54 | 43 of 92 | 15 of 64 | 19.0 % |
| Eco 50, capsule, careful (2 washes) | 4.03 | 5.00 / 3.00 | 4.84 | 4.35 | 4.54 | 86.5 of 97 | 57.5 of 68 | 0.2 % |
| the same, careless | 2.37 | 2.88 / 1.50 | 4.37 | 2.21 | 3.40 | 58 of 92 | 30 of 64 | 9.4 % |
| Auto as written, detergent D (v3), careful | 1.14 | 2.08 / 0.14 | 3.91 | 1.75 | 2.72 | 59 of 97 | 30 of 68 | 30.0 % |
| the same, careless | 0.56 | 1.05 / 0.10 | 2.99 | 1.75 | 2.08 | 35 of 92 | 7 of 64 | 48.7 % |

By soil, Auto as written with the capsule (share left; mean score; items clean):

| Soil | Careful | Careless | Careful, stable bracket |
|---|---|---|---|
| Egg yolk | 10.4 %; 0.0; 0 of 17 | 34.5 %; 0.0; 0 of 20 | 0.8 %; 0.6; 0 of 17 |
| Milk, microwaved | 38.6 %; 0.0; 0 of 7 | 54.3 %; 0.0; 0 of 7 | 13.4 %; 0.0; 0 of 7 |
| Minced meat | 0.0 %; 2.5; 0.5 of 3 | 0.4 %; 1.3; 0 of 3 | 0.0 %; 5.0; 3 of 3 |
| Porridge | 0.0 %; 4.9; 18.5 of 19 | 9.1 %; 2.7; 9 of 18 | 0.0 %; 4.9; 19 of 19 |
| Spinach | 0.0 %; 5.0; 3 of 3 | 0.5 %; 4.2; 4 of 6 | 5.0; 3 of 3 |
| Margarine | 0.0 %; 4.8; 11 of 12 | (none in that load) | 4.8; 11 of 12 |
| Tea | 6.8 %; 4.1; 5 of 7 | 11.1 %; 1.8; 3 of 10 | 6.8 %; 4.1; 5 of 7 |

**Every soil of the standard load and of the five starter levels, well and badly placed**, on
the liquor of the careful Auto wash with the capsule (`anchors/scripts/auto-soils.ts`: each soil
at its working loading and usual ageing on a bench tile; "well" is the median open plate face of
the careful load, "badly" a face wet a quarter of the time by water half a minute old; the full
tables with the stable bracket and Eco 50 are `anchors/reports/auto-soils.*.md`). Share of dry
mass left / share of the soiled area still visibly soiled, in per cent:

| Group | Soils | Well placed | Badly placed |
|---|---|---|---|
| Gone wherever water reaches | butter, margarine, cream, oil, chocolate, curry, tallow drippings, lipstick, jam, syrup, milk film | 0 / 0 | 0 / 0 |
| Clean if well placed | IEC minced meat, porridge (IEC), spinach (IEC), gravy, seeds, burnt milk film (1.4 mg/cm2), milk skin, yoghurt, egg white, pasta film, tomato sauce | 0 / 0 (pasta 0.2 / 1.2) | 41 to 100 / 82 to 100 (spinach particles 5 / 16) |
| Stains: tea (IEC, home), coffee, red wine | | 7.5 / 0 | 72 to 74 / 100 |
| Nearly: IEC egg yolk | 5.7 mg/cm2 | 4.1 / 28 (stable bracket 0 / 0.1) | 93 / 100 |
| Not clean in this wash | dried egg yolk and minced meat at the levels' loadings (7.5, 4.8 mg/cm2) 10 / 35 and 6 / 21; cooked egg 26 / 74; IEC milk 36 / 97; porridge at 9.7 mg/cm2 17 / 55; dough 44; wheat-biscuit cereal 52; mashed potato 74; cheese 87 to 92; burnt sugar, polymerised fat, char 77 to 83 | | 86 to 100 / 100 |

**What the evidence carries, exactly.** The test institutes grade Auto as high as Eco on the
sister machines. In the model a well-wetted IEC egg plate on Auto is 90 % gone (99 % with the
stable bracket or with a 55 C wash); this morning it was 43 % gone with detergent D and 50 %
with the capsule at the registry's stability. It reads dirty because the remaining 1 to 10 %
lies as a thin film on a few per cent of its area. Clean needs the wash to
take 1.9 times the mean depth of the layer (1.55 to 1.67 if a brushed layer were as even as a
sprayed tile); 63 minutes with the capsule take 1.3 (1.45 with the stable bracket). The gap is a
factor of 1.3 to 1.45 in rate times time at the favourable end. Each of these would close it and
none is decided by a document: a rate 30 % above the tile's (its tolerance is 20 %); no penalty
for oven drying (rate x 0.84 and lag x 1.25 are placeholders); less than 3 g of yolk per plate
(the standard's Annex C was not readable); a main wash 20 minutes longer; a layer as even as a
sprayed tile together with the stable enzyme. Forks (8.2 mg/cm2) and the milk glasses (9.5
mg/cm2 on a quarter of the interior) are further off: 1.5 and 1.7 times the plate.

What decides it, in this order: (1) egg-yolk plates and forks on Auto and on Eco 50 with the
owner's capsule, photographed (if the Auto plates are clean, the first suspects are the amount
per plate and the oven-drying penalties, not the enzyme); (2) one logged Auto run; (3) an
interrupted egg-yolk wash, which measures the brushed spread (the time from 70 % removed to
bare).

## 6. Tea, and the manganese catalyst

- A stain is judged against one level, 7.5 % of the film of an IKW-level stain (chemistry 8.6);
  the IEC tea is laid down with half that film, so it is seen above 15 % of its own.
- The fit reads tea. Detergent D on the record's eco leaves 10.5 % of the film: score 0.3 with
  the default bleach rate, 2.9 at 0.0009 and 4.6 at 0.0010. The published crockery mean with
  every plate clean needs tea at 2.2. The model's tea is therefore at the threshold on that
  programme, which is what a mean of 2 to 3 over many cups looks like; in the model every cup of
  a wash flips together, because nothing but the film's own scatter differs from cup to cup.
  A tea verdict is not reliable within 15 % of the bleach rate.
- The owner's capsule makes 0.45 mmol/L of peracid against 0.32 for detergent D and bleaches 5
  of 7 tea items on Auto as written (0 of 7 on the 55 C course, 1 of 7 on Eco 50).
- **The catalyst need not be a species.** MnTACN acts on the peroxide path, which the model has
  (`soil.bleachPeroxideRatio`, the rate constant of the perhydroxyl anion over that of peracid;
  its range is widened to 20 for a catalysed product). No source gives the size of the
  catalyst's contribution, so the capsule layer keeps the default 0.02 and credits the capsule
  only with its peracid. Tea cups washed with the capsule and with a catalyst-free product
  measure the ratio.

## 7. Stacking, seeds and tiers under anchored-v3 (Eco 50, detergent D)

Loads (`anchors/reports/stacking.eco_50.v3.md`; level seed 1, simulation seed 1; unweighted):

| Load | Items | Mean | Clean | Soiled items clean | Dry soil left |
|---|---|---|---|---|---|
| Careful | 97 | 4.43 | 85 | 56 of 68 | 0.2 % |
| Careless | 92 | 3.21 | 54 | 26 of 64 | 9.7 % |
| Plates turned, soup plates nested | 97 | 4.19 | 80 | 51 | 2.3 % |
| Three vessels mouth up (841 mL held) | 97 | 4.42 | 83 | 54 | 0.2 % |
| Dispenser shut (8.4 g dissolves) | 97 | 2.34 | 40 | 11 | 60.4 % |
| Lower arm stalled | 97 | 3.96 | 71 | 42 | 0.8 % |
| Forks turned end for end | 97 | 4.49 | 87 | 58 | 0.2 % |
| Half load | 54 | 4.31 | 46 | 32 of 40 | 0.0 % |

The twelve pairs of the anchoring note (B minus A on the affected items):

| Checklist | Pair | n | A | B | Δs | v2 | Verdict |
|---|---|---|---|---|---|---|---|
| P02 | Egg-yolk dinner plates turned in their slot | 3 | 5.00 | 2.67 | -2.33 | -3.67 | Sign right, larger than the -1 to -2 expected; contact, not facing |
| P02, control | Minced meat and spinach plates turned | 3 | 5.00 | 5.00 | 0.00 | 0.00 | Holds |
| P28, control | Tea saucer turned | 1 | 0 | 0 | 0.00 | 0.00 | Holds trivially (tea at 0) |
| P04 | Porridge soup plates pushed 6 mm behind their neighbour | 2 | 5.00 | 0.00 | -5.00 | -5.00 | Right |
| P04, control | The plate in front of a nested one | 2 | 5.00 | 5.00 | 0.00 | 0.00 | Holds |
| (not a checklist pair) | Unmoved lower-rack crockery beside the turned plates | 7 | 4.29 | 3.57 | -0.71 | -0.86 | One meat plate faced by a turned plate goes to 0 |
| P01 | Mug, cup (tea) and glass (milk) mouth up | 3 | 1.67 | 1.67 | 0.00 | +1.00 | Right: all three hold water and none is clean (one was clean mouth down) |
| P25 | Dispenser shut, soiled items | 68 | 4.19 | 1.21 | -2.99 | -2.81 | Right |
| P06 | Lower arm stalled: soiled crockery of the lower rack | 17 | 4.41 | 4.41 | 0.00 | -0.53 | **No effect** (expected -1.5 or more): with the short tail the run-off of the upper arm is enough for every plate |
| P06, control | The same wash, soiled items of the upper rack | 15 | 2.73 | 1.73 | -1.00 | -0.60 | **Fails**: the upper rack loses where little is expected |
| P16, control | Forks turned end for end | 11 | 4.27 | 4.82 | +0.55 | +0.91 | **Fails** (at most 0.3 expected); rule-made overlapping poses, and half of it was sampling in v2 |
| P19 | Half load against full (standard weights) | | 4.25 | 4.07 | -0.18 | -0.20 | Sign right, small |
| P27 | Eco 50 against Auto, detergent D, careful (mean over items) | 97 | 4.43 | 3.13 | -1.30 | -1.45 | Sign as the model has it; against the test institutes for a commercial tablet (section 5) |

Seeds and tiers (`anchors/reports/seeds.eco_50.v3.md`; careful load, 16 washes): load mean with
standard weights 4.07 (sd 0.03; published repeatability 0.09), cutlery 4.82 (0.04), glass 4.15
(0.11), 82 to 87 items clean, 53 to 58 of 68 soiled items clean.

| What changes between two washes | Verdicts that flip, of 68 soiled items (mean, range) | v2 |
|---|---|---|
| Simulation seed only | 2.8, 0 to 6 (9 distinct items: knives 4, forks 3, a spoon, a glass) | 6.2, 2 to 9 |
| Level seed only | 3.5, 1 to 5 | 6.5, 2 to 10 |
| Tier: fast against official, same seeds | 13.5, 9 to 18; 74 to 87 % of verdicts agree; fast scores 3.57 to 3.65 where official scores 4.03 to 4.08 | 16.5, 13 to 20 |

The flips halved because fewer items sit at the edge of clean; the fast tier still is not the
official tier (forks and soup spoons: the water side's).

## 8. Using it

```
cd packages/calibration
pnpm exec tsx anchors/scripts/check.ts                       # version, water hash, ranges, bench anchors
pnpm exec tsx anchors/scripts/fit.ts --name anchored-v3      # the fit (about 15 min with cached exposure)
pnpm exec tsx anchors/scripts/make-owner-set.ts              # the two owner-capsule layers
pnpm exec tsx anchors/scripts/study.ts anchors/reports/tables.v3.cases.json out.json   # sections 4 and 5
pnpm exec tsx anchors/scripts/auto-soils.ts <liquor.json> --params anchors/anchored-v3.owner-capsule.json
pnpm exec tsx anchors/scripts/stacking.ts --params anchors/anchored-v3.json --programme eco_50 --level-seed 1 --sim-seed 1
pnpm exec tsx anchors/scripts/seeds.ts --params anchors/anchored-v3.json --fast
pnpm exec tsx scripts/soil-quantities.ts                     # docs/calibration/soil-quantities.md
```

- **A wash that is to mean anything runs with a set.** `anchored-v3.json` (detergent D, 20 g) or
  `anchored-v3.owner-capsule.json` with `dosing.detergentMass` 0.0129 kg. The registry default
  of `soil.subCellCv` stays 0 (the lumped element, which thins a deposit evenly for ever) and
  that of `soil.amountCv` stays 0, because two tests of the first build in `sim-verify` hold
  them there (the ratio of two egg residues must be under 1.25 and is 1.258 with the spread on);
  the sets state 0.1 and 0.05.
- The game's levels carry stains at the level builder's floor of 0.01 g per item, which the wash
  now reads as dry film: 2 to 11 times the working film (`soil-quantities.md`).
- Trust: Eco 50 at load level and for contact, nesting, a shut dispenser, held water: in sign.
  Facing for protein: not modelled (a wetted face cleans). A stalled lower arm: no effect on
  plates. Tea: at the threshold. Auto for egg and milk: do not use. Fast tier against official:
  not comparable.
