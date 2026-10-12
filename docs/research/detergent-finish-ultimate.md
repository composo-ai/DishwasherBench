# Spotless research dossier: the owner's detergent, Finish Powerball Ultimate (UK), and his rinse aid

> **Reference, kept as written (10 October 2026).** Written by a specialist role of the build;
> requests to the owner in it are of that date. The index of the documents is `docs/README.md`.

Specialist: detergent chemistry. Date: 2026-10-10. Status: desk research from the maker's disclosures and safety data sheets; nothing measured; uncalibrated. Fact-checked the same day (section 9).

## 0. How to read this dossier

### 0.1 Scope

The owner washes with Finish Powerball Ultimate tablets and Finish Rinse & Shine Aid (`docs/reference/owner-measurements.md`, last section). This dossier establishes what one unit of the tablet is, maps it onto the parameters of the liquor model (`packages/sim-liquor`, whose defaults are IEC reference detergent type D, `chemistry.md` sections 1 and 10), and records the rinse aid without proposing to model it. The parameter set is `packages/calibration/detergents/finish-powerball-ultimate.json`; the dose, the ranges and what the parameter-file format cannot carry are in `finish-powerball-ultimate.notes.json` beside it.

Cross-links: `[-> chemistry]` is `docs/research/chemistry.md`, `[-> machine]` the Bosch dossiers.

### 0.2 Confidence tags

As in `[-> chemistry]` section 0.2: [VERIFIED] means read in the opened source this session, [RECALLED] from memory or seen only in a search-result snippet, [ESTIMATED] my own derivation. A [VERIFIED] tag on a sister product's safety data sheet says the sheet says so; whether the UK product is the same formulation is a separate question, treated in section 1.2. Sources are `S#` (opened) and `N#` (not opened), listed in section 8.

### 0.3 The findings that matter

1. One unit weighs 12.9 g [VERIFIED, S3], not the 20 g the machine definition assumes. It is a polyvinyl alcohol capsule with powder, gel and liquid compartments, not a pressed tablet [VERIFIED, S1, S4].
2. No source gives a full quantitative formulation. What is verified: the complete UK ingredient list in descending order [S1], and the bands of three safety data sheets, none of them for the United Kingdom, which do not agree with one another (section 1.2): the Swiss sheet of "Finish Powerball Ultimate All in 1" of 2022 [S14] and the Australian sheet of 2024 [S5] give sodium carbonate at most 25 to 30 %, sodium percarbonate 10 to under 25 % and pH 9.4 to 10.4 at 10 %; the Australian sheet of 2025 [S4] gives sodium carbonate 30 to 60 %, percarbonate up to 10 % and pH 10.4 to 11. All three give the low-foam nonionic as 10 to 25 %. The percentages in section 2 are a reconstruction from the order, the bands and the mass balance; carbonate 30 % and percarbonate 10 % sit where the bands meet.
3. Against type D the product has no silicate, about twice the bleach activator per kg, about 7 times the surfactant, a manganese bleach catalyst on top of TAED, and (by my estimate, the least certain number here) more protease per wash.
4. In the main wash of Auto 45-65 the liquor model predicts pH 10.4 at 47 °C against 10.8 for 20 g of type D, peak protease 80 mg/L against 49 (range 40 to 160), and peak peracid 0.45 mmol/L against 0.32 (range 0.21 to 0.84). The pH may be lower than that, about 10.0 to 10.1, if the UK product follows the two older sheets. If the model simply dosed 12.9 g of type D instead, it would predict 32 mg/L of protease and 0.17 mmol/L of peracid: changing the dose without the composition would be wrong in the other direction.
5. The two numbers that decide protein and tea removal, enzyme level and effective bleach, cannot be established from public sources. They need the calibration washes.

---

## 1. The product

### 1.1 What the sources describe

| Fact | Value | Conf. |
|---|---|---|
| Name in the maker's UK/Ireland disclosure | "Finish Ultimate All in 1 Fresh" (newest entry, sku 000011654); earlier entries "Finish Ultimate All In 1 Fresh" (000011138) and "Finish Ultimate All in 1" (000008742, 000007778, 000003490) | [VERIFIED, S1] |
| Name at UK retail | "Finish Ultimate All in One" (Regular or Fresh, Lemon); the pack text calls the units "Dishwasher Caps" | [VERIFIED, S2, S3] |
| Form | "multi-compartment capsule (Powder. Liquid. Gel)", colours white, yellow, red (Lemon) or blue, white, red (Fresh) | [VERIFIED, S4, S5: Australian sheets] |
| Film | polyvinyl alcohol, eighth in the ingredient list | [VERIFIED, S1] |
| Mass of one unit, film included | 12.9 g: 55 units at £13.75 and £19.38/kg, 75 at £16.00 and £16.54/kg, 32 at £9.00 and £21.80/kg | [VERIFIED, S3; the division is mine] |
| Same, from pack weights | 412.8 g for 32, 709.5 g for 55, 967.5 g for 75, each 12.90 g per unit | [VERIFIED, S15: a price aggregator, not the pack] |
| Same, further packs | 1186.8 g for 92, 1483.5 g for 115 (Tesco titles) | [RECALLED, snippet, N1] |
| Pack claim | "15% less chemical weight than Finish's traditional pressed powder tablets" (against Finish Power) | [VERIFIED, S2] |
| Use | one unit in the dry dispenser; "Dissolves completely in the wash"; not to be unwrapped; eco or auto cycles recommended; built-in salt function to 26 °e (21 °dH) | [VERIFIED, S2] |
| Hazard classification | skin irritation category 2, eye irritation category 2 (UK pack text and the Australian sheet agree) | [VERIFIED, S2, S4] |
| pH of a 10 % solution | 9.4 to 10.4 (Switzerland, formulation FF3233992, 2022); 9.4 to 10.4 (Australia, FF3289622, 2024); 10.4 to 11 (Australia, FF3314399, 2025) | [VERIFIED, S14, S5, S4] |

The "Powerball" of the name is now the red compartment of the capsule, not a pressed ball [ESTIMATED from S4].

### 1.2 Which variant, and how sure

The name covers a family. In the UK in October 2026 the shelf holds Finish Ultimate All in One (this dossier), Finish Ultimate Plus All in One (a different, richer capsule), Finish Quantum All in One and Finish Power All in One [VERIFIED, S1, S3]. The owner wrote "finish powerball ultimate tablets", which is Ultimate and not Ultimate Plus or Quantum Ultimate, an older name that the maker's list also still carries.

- That the owner's product is the Ultimate family and not Ultimate Plus: probable, on his wording alone. A photograph of the pack would settle it.
- That the ingredient list of section 2 is what a UK buyer of Ultimate gets in 2026: high. The maker's page says of itself "This is the latest formulation present on the market" [S1]. Three entries (8742, 11138, 11654) have the same first eight ingredients in the same order (8742 names the third only as "Fatty Alcohol Alcoxylate"), so the conclusions do not depend on which production run he has. That a higher number is a newer entry is an assumption; 11654 is the only one of the three with sodium chloride, magnesium sulfate, thiosulfate and tartaric acid, so the formulation has been revised at least once. Scent (Fresh or Lemon) is assumed to change only perfume and dye.
- That any one safety data sheet describes the UK formulation of 2026: low to moderate. No UK sheet was found. Three sheets of the Ultimate capsule were read, and they fall into two groups:

| Sheet | Sodium carbonate | Percarbonate | C12-14 alcohol EO/PO | Other | pH at 10 % |
|---|---|---|---|---|---|
| "Finish Powerball Ultimate All in 1", Switzerland, D8395627 v2.0, FF3233992, 16/12/2022 [S14] | 10 to 25 % | 10 to under 25 % | 10 to 25 % | etidronate up to 10 %, subtilisin under 1 % | 9.4 to 10.4 |
| "Finish Ultimate Dishwashing Tablets Fresh", Australia, D8408447, FF3289622, 17/05/2024 [S5] | 10 to 30 % | 10 to under 25 % | 10 to under 25 % | | 9.4 to 10.4 |
| "Finish Ultimate Dishwashing Tablets Lemon", Australia, D8411614, FF3314399, 05/12/2025 [S4] | 30 to 60 % | up to 10 % | 10 to under 25 % | | 10.4 to 11 |

  The Swiss sheet is the same document number as the German one that could not be opened [N3] and carries the exact name the owner used; it is the closest in market and the oldest. The Australian sheet of 2025 is the newest and the furthest in market (the Australian product is said to be made in Poland [RECALLED, snippet, N2]). Whether the UK product was reformulated the way the Australian one was between 2024 and 2025 is not known. The best estimates of section 2 (carbonate 30 %, percarbonate 10 %) are at the meeting point of the bands and the ranges cover both groups.

For contrast, Ultimate Plus (Germany, Austria, Switzerland, 2022): sodium carbonate 10 to 25 %, sodium percarbonate 10 to under 25 %, PPG-5-laureth-5 10 to 25 %, tetrasodium etidronate up to 10 %, subtilisin under 1 %, pH 10.2 at 10 %, "pouch with liquid, gel and powder compartment" [VERIFIED, S6].

### 1.3 Compartments and release

No source says what each compartment holds or when it opens. What can be said:

| Statement | Conf. |
|---|---|
| Three compartments: powder, gel, liquid | [VERIFIED, S4] |
| Reckitt's patent applications put the manganese catalyst (MnTACN) in a small liquid compartment of a multi-chamber unit dose, a liquid of preferably 0.1 to 3 g (0.15 to 1 g in the narrower statement) holding 0.1 to 5 % of catalyst [S7] or 0.1 to 30 mg of it [S8], because it is "inherently incompatible" with percarbonate and with the surfactant in the solid | [VERIFIED, S7, S8: applications, both abandoned; they describe the idea, not this product] |
| Their definition of the water-soluble film: it at least partly dissolves or disperses in water at 20 °C within 10 minutes | [VERIFIED, S7, S8] |
| Powder holds carbonate, citrate, percarbonate, TAED, phosphonate, polymers and enzyme granulates; gel holds the nonionic surfactant with glycols, glycerin and stearates; liquid holds catalyst and dye | [ESTIMATED] from the ingredient list and S7, S8 |
| A pouch film of this kind dissolves in 1 to 2 min at 30 to 40 °C and several times slower at 20 °C | [RECALLED, `[-> chemistry]` 1.4] |
| No compartment is known to be designed to release late. The gel and the loose powder are both quick once the film is gone | [ESTIMATED] |

In Auto 45-65 the dispenser opens into liquor at about 20 °C that then heats at 2.3 K/min `[-> machine]`, so the film meets cold water first. This is the one place where the pouch could be slower than a tablet, and nothing I opened measures it.

---

## 2. Composition

The UK list, in the maker's descending order [VERIFIED, S1, sku 000011654], with shares. A share tagged [VERIFIED] is a band read in a safety data sheet of another market (section 1.2); every single number is [ESTIMATED] from the order (each ingredient at most the one above it), the bands and the sum to 100 %.

| # | Ingredient (as disclosed) | Function | Share of the 12.9 g unit: best (range), wt % | Source of the share | Tag |
|---|---|---|---|---|---|
| 1 | Sodium carbonate | alkalinity | 30 (15 to 40) | bands 10 to 25 [S14]; 10 to 30 [S5]; 30 to 60 [S4] | bands [VERIFIED] and in conflict, value [ESTIMATED] |
| 2 | Sodium citrate | builder | 18 (12 to 25) | between rows 1 and 3 | [ESTIMATED] |
| 3 | PPG-5-laureth-5 (C12-14 alcohol, ethoxylated propoxylated, CAS 68439-51-0) | low-foam nonionic surfactant, rinse function | 14 (10 to 20) | band 10 to under 25 [S4, S5]; 10 to 25 [S14] | band [VERIFIED], value [ESTIMATED] |
| 4 | Sodium carbonate peroxide (percarbonate) | bleach | 10 (6 to 16) | 10 to under 25 [S14, S5]; up to 10 [S4]. 10 is the only value inside all three | bands [VERIFIED], value [ESTIMATED] |
| 5 | TAED | bleach activator | 4 (2.5 to 6) | below row 4, above the film; Reckitt example 4.0 [S9] | [ESTIMATED] |
| 6 | Tetrasodium etidronate (HEDP) | scale inhibitor, bleach stabiliser | 3.5 (2.5 to 5) | up to 10 [S14]; the same in Ultimate Plus [S6] | band [VERIFIED, 2022], value [ESTIMATED] |
| 7 | Sulfonated polyacrylate, sodium salt | dispersant, anti-spotting | 3.5 (2.5 to 5) | Reckitt example 5.0 [S9] | [ESTIMATED] |
| 8 | Polyvinyl alcohol | film | 3 (2.5 to 5), 0.4 g | film area and gauge | [ESTIMATED] |
| 9 | Sodium bicarbonate | buffer | 2.5 (1 to 3) | order | [ESTIMATED] |
| 10 | Sodium sulfate | filler, granulate carrier | 2 (1 to 3) | order | [ESTIMATED] |
| 11 to 21 | Polyoxyalkylene glycol, acrylic/maleic copolymer, polyepoxysuccinate, glycerin, water, polyethylene glycol, calcium stearate, glyceryl stearate, sorbitol, zeolite, pentaerythritol | gel structure, co-builders, process aids | 8 together | remainder | [ESTIMATED] |
| 22 | Subtilisin | protease | under 1 as enzyme substance | under 1 [S14] and in Ultimate Plus [S6]; listed above perfume | band [VERIFIED, 2022], level unknown |
| 23 to 29 | Perfume, titanium dioxide, benzotriazole, cellulose, kaolin, ethoxylated isotridecanol, dimethicone | scent, granulate coating, silver protection, antifoam | under 1 together | order | [ESTIMATED] |
| 30 | α-Amylase | amylase | below subtilisin | order | level unknown |
| 31 to 34 | Propylene glycol, sucrose, talc, tartaric acid | solvent, granulate carriers | traces | order | [ESTIMATED] |
| 35 | MN-TACN | manganese bleach catalyst | 0.001 to 0.23 (0.1 to 30 mg) | 0.1 to 30 mg in S8, an abandoned application that does not describe this product | [ESTIMATED] from a patent range |
| 36 to 44 | Sodium chloride, colourant, magnesium sulfate, sodium thiosulfate, polyquaternium-2, orange peel oil, linalool, citronellol, limonene | glass care, dye, scent | traces | order | [ESTIMATED] |

Check on the reconstruction: the liquor model's own acid-base solver, given 30 % soda ash, 10 % percarbonate and 2.5 % bicarbonate, puts a 10 % solution at pH 11.1, and at 10.7 once the acetyl groups of 4 % TAED have reacted [ESTIMATED, script]. The Australian sheet of 2025 says 10.4 to 11 [S4], which agrees. The Swiss sheet of the exact product and the Australian sheet of 2024 say 9.4 to 10.4 [S14, S5], which this reconstruction does not reach: by the same solver that band needs an alkalinity of at most about 1.7 equivalents per mole of carbonate, that is, noticeably more bicarbonate or acid than assumed here. Type D would give 12.4 by the same calculation. The solver is not built for a 10 % solution, so this is an indication only, but it points one way: if the UK product follows the older sheets, the main-wash pH is lower than section 3 predicts.

What is not there: no silicate, no MGDA or GLDA, no phosphate. The builder system is citrate with phosphonate and polymers, like type D and unlike the MGDA products of `[-> chemistry]` 1.4.

### 2.1 Enzymes

The disclosure names the enzymes only as "subtilisin" and "α-amylase" [S1]; the US page for the same family says "Protease Enzyme" and "Amylase Enzyme" [S10]. No grade, supplier, activity or level is published. A Reckitt patent of 2008 exemplifies Puramax 2250D (protease) at 0.8 % and Stainzyme 12GT (amylase) at 0.4 % of the composition [VERIFIED, S9; the patent page gives no tablet weight]; that shows the kind of grade the maker has used, not what is in this product. Stainzyme is an oxidation-stable amylase and current dishwashing proteases are more heat-stable than the Savinase of type D [RECALLED]. I could not find supplier literature that ties a grade to this product.

### 2.2 Bleach

Percarbonate with TAED, as type D, plus the manganese catalyst MnTACN [VERIFIED, S1]. The catalyst bleaches tea with hydrogen peroxide directly and is the reason a modern product can carry less percarbonate than its predecessors; the fall from "10 to under 25 %" in 2024 to "up to 10 %" in 2025 in Australia [S4, S5] would fit that [ESTIMATED]. The liquor model has no catalyst (section 4).

---

## 3. Mapping onto the liquor model

Units as in `packages/sim-liquor/src/params.ts`. "Material" means the change moves a predicted main-wash quantity by more than its own uncertainty in type D.

| Parameter | Type D default | This product: best (range) | How derived | Material? | Tag |
|---|---|---|---|---|---|
| dose (`dosing.detergentMass`, a machine value) | 0.020 kg | 0.0129 kg (0.0127 to 0.0131) | section 1.1 | yes: -35 % | [VERIFIED] |
| `liq.xCarbonate` | 4.36 mol/kg | 3.3 (2.0 to 4.5) | Stoichiometric carbonate 3.77 mol/kg (soda ash 2.83, percarbonate 0.64, bicarbonate 0.30), alkalinity 7.23 eq/kg plus about 0.1 from etidronate. The model has no bicarbonate term; 3.3 gives a main-wash pH 0.03 above the full balance with the etidronate and 0.06 above it without (exact equivalents 3.0 and 2.6; the pH is flat in this parameter). The lower bound is the registry minimum; the older sheets [S14, S5] correspond to 1.4 to 2.6 | yes | [ESTIMATED] |
| `liq.xSilicate` | 0.55 eq/kg | 0 (0 to 0.2) | no silicate in the list [S1] | yes, with the row above | [VERIFIED] absence |
| `liq.xPeroxide` | 0.67 mol/kg | 0.955 (0.57 to 1.53) | 10 % (6 to 16 %) percarbonate, 3 H2O2 per 314.0 g | yes per kg; per wash it is 12.3 mmol against 13.4 | [ESTIMATED] |
| `liq.xTaed` | 0.088 mol/kg | 0.175 (0.11 to 0.26) | 4 % (2.5 to 6 %), 228.25 g/mol | yes | [ESTIMATED] |
| `liq.xProtease` | 0.010 kg/kg | 0.025 (0.0125 to 0.05) | Unknown; not supported by any source. Best: a guess, 1.6 times the protease that 20 g of type D gives per wash. Lower bound: half of that, 0.8 times type D per wash (parity per wash would be 0.0155). Upper: registry maximum, 3.2 times | yes, and the least certain | [ESTIMATED] |
| `liq.xAmylase` | 0.005 kg/kg | 0.012 (0.005 to 0.025) | half the protease, as in type D and S9 | yes | [ESTIMATED] |
| `liq.xSurfactant` | 0.02 kg/kg | 0.14 (0.10 to 0.20); file holds 0.10, the registry maximum | band 10 to 25 % [S4, S5, S14] | no: the model uses it only for the liquor class, which is D either way | band [VERIFIED] |
| `liq.tabletTau` | 480 s at 40 °C | 300 (150 to 600) | film 60 s then contents 180 s (`[-> chemistry]` 10.3, pouch) as one shrinking-core time with the same time to 90 % | no: 90 % released 222 s after the lid opens against 326 s | [ESTIMATED] |
| `liq.tabletEa` | 25 kJ/mol | not changed (25 to 60) | a film is steeper in temperature than a tablet; no number found | no | [ESTIMATED] |
| `liq.amylaseKox`, `liq.amylaseKoxHP` | 6e-4, 1e-5 m³/(mol s) | 6e-5, 2e-6 (up to the defaults) | the oxidation-stable column of `[-> chemistry]` 10.5; grade not disclosed | modest: mean amylase +23 % | [ESTIMATED] |
| `liq.proteaseHalfLife` | 1800 s at 60 °C | not changed (1800 to 7200) | grade not disclosed | would be: 3600 s gives +29 % mean protease | [ESTIMATED] |
| `liq.kPer`, `liq.Kr`, `liq.kDec` | as type D | not changed | same TAED chemistry | no | n/a |
| `liq.rinseAidDensity` | 1000 kg/m³ | 1010 to 1020, not changed | [S11] | no | [VERIFIED, sister sheet] |

Protease and amylase are in the registry's unit, kilograms of the type D granulate per kilogram of product. A parameter set that has fitted `liq.xProtease` for type D (anchored-v1 holds 0.0257) should be scaled by 2.5 (1.25 to 5) for this product, not replaced by 0.025; 2.5 times 0.0257 is above the registry maximum of 0.05, which the maximum will then need raising for.

### 3.1 What moves in the main wash

Computed with `packages/sim-liquor` (the script is not kept in the repository; the numbers are also in the sidecar). Conditions: first bath of Auto 45-65 on the owner's machine, 4.0 L, lid opening 60 s after circulation starts, the temperature trace of `packages/calibration/anchors/reports/first-build-demonstration.auto_145.md` (19 °C rising to 64 °C in 19 min, then held), 62.5 min, no soil in the liquor. All [ESTIMATED].

| Quantity | Type D, 20 g | Type D, 12.9 g | This product, 12.9 g | Range for this product |
|---|---|---|---|---|
| Detergent in the liquor | 5.0 g/L | 3.2 g/L | 3.2 g/L | |
| pH at 47 °C, 8.5 min after release | 10.77 | 10.63 | 10.40 | 10.27 to 10.54 |
| pH, mean of the main wash | 10.54 | 10.40 | 10.22 | 10.08 to 10.34 |
| Protease, peak | 49 mg/L | 32 | 80 | 40 to 160 |
| Protease, mean | 25 mg/L | 16 | 41 | 20 to 81 |
| Amylase, mean | 14 mg/L | 10 | 26 | 11 to 53 |
| Peracid, peak | 0.32 mmol/L | 0.17 | 0.45 | 0.21 to 0.84 |
| Peracid, mean | 0.100 mmol/L | 0.051 | 0.139 | 0.064 to 0.26 |
| Hydrogen peroxide after release | 3.0 mmol/L | 2.0 | 2.6 | 1.6 to 4.1 |
| Time to 90 % released | 326 s | 326 s | 222 s | 122 to 390 s |

Reading it:

- pH falls by about 0.35. The soil model's alkaline route for protein starts above pH 10.5 (`packages/sim-soil/src/params.ts`), so with this product protein is removed by enzyme almost alone. The real liquor is a further 0.12 lower once TAED has given up its acetyl groups, which the model omits for every detergent. The lower end of the pH range is the registry minimum of `liq.xCarbonate`, not the lowest plausible pH: a product with the pH band of the older sheets (9.4 to 10.4 at 10 %) would be at about 10.0 to 10.1 at 47 °C, which the parameter cannot express. The conclusion that the alkaline route is off holds either way.
- Peracid rises although less percarbonate is dosed per wash, because the model's peracid is limited by TAED and there is twice as much TAED per kg. This rests on the 4 % estimate.
- Protease is whatever `liq.xProtease` says; the range of a factor of 4 is the honest statement.
- Release timing does not matter in a 63 min main wash: the whole range moves mean protease by 6 % and mean peracid by 25 %.

---

## 4. What the model cannot express

| Feature of the product | Effect | In the model? |
|---|---|---|
| Manganese catalyst | bleaches tea with peroxide, without TAED and at lower temperature | no. Tea bleaching reads peracid and perhydroxyl (`soil.bleachRate`, `soil.bleachPeroxideRatio`). If calibration finds tea cleaner than predicted, this is the first suspect |
| Bicarbonate and TAED acid | pH 0.05 to 0.2 lower | no bicarbonate in the dose, no acid term; folded into `liq.xCarbonate` here |
| Three compartments | species released at different moments | no: one dissolved mass releases everything in proportion |
| Film meeting 20 °C water | possible delay of minutes | only through `liq.tabletTau` and `liq.tabletEa` |
| 14 % surfactant with rinse function | more surfactant carried into the rinses, better sheeting | carried over by the drain arithmetic; no effect on drying in the model |
| Citrate, phosphonate, polymers | scale and spotting control in hard water | no (softened water assumed) |

None of this is a proposal to extend the model now. The first three are where a mismatch against the owner's test washes should be looked for.

---

## 5. The rinse aid (recorded, not modelled)

Finish Rinse & Shine Aid, UK. Ingredients in descending order [VERIFIED, S12]: water; fatty alcohol alkoxylate (low-foam nonionic); sodium cumenesulfonate (hydrotrope); citric acid; potassium sorbate (preservative); a polymer of N,N'-bis[3-(dimethylamino)propyl]urea with 1,1'-oxybis[2-chloroethane] (polyquaternium-2, glass care); chloromethylisothiazolinone and methylisothiazolinone 3:1 (preservative).

| Quantity | Value | Conf. |
|---|---|---|
| Nonionic surfactant on the UK label | 5 to under 15 % | [RECALLED, snippet, N4] |
| Ethoxylated isotridecanol, Australian sister (D8411055, 2025) | up to 10 % | [VERIFIED, S11] |
| pH undiluted | 4.0 to 4.2 | [VERIFIED, S11] |
| Density at 20 °C | 1.01 to 1.02 g/cm³ | [VERIFIED, S11] |
| Classification | serious eye damage, category 1 | [VERIFIED, S11] |

It is the same architecture as the IEC reference rinse aid of `[-> chemistry]` 8.2 (nonionic, cumene sulfonate, citric acid, water), weakly acidic. The model's rinse aid is a dosed volume with a density of 1000 kg/m³ that marks the liquor as class R; nothing here asks for a change.

---

## 6. Deliverables

| File | Holds |
|---|---|
| `packages/calibration/detergents/finish-powerball-ultimate.json` | parameter set in the `spotless.params` format, written by `createParamSet(washRegistry(), ...).toJSON()` and read back with `readParamSet`: the ten `liq.*` keys that differ from the defaults, origin `manual`, provenance note |
| `packages/calibration/detergents/finish-powerball-ultimate.notes.json` | sidecar: the dose (0.0129 kg), range and tag per key, the surfactant value above the registry maximum, keys deliberately left alone, the table of section 3.1, the rinse aid |

The parameter-file format has no place for the dose (it is `dosing.detergentMassG` of the machine definition, 20 in `packages/machine/src/data/bosch-smv4hax40g.ts`) or for ranges, hence the sidecar. Nothing reads either file yet.

---

## 7. Open questions

| # | Not established | What would establish it |
|---|---|---|
| 1 | Protease and amylase level and grade | Not public. An activity assay of a dissolved capsule; or fit `liq.xProtease` to the owner's egg-yolk test washes, which is what the calibration is for |
| 2 | Percarbonate and TAED percentages | A UK safety data sheet for the current formulation (ask Reckitt UK consumer relations, quoting the batch code); an iodometric titration of a dissolved capsule gives available oxygen directly |
| 3 | Which of the three sheets the UK formulation of 2026 follows (carbonate 10 to 25 % with percarbonate 10 to under 25 % and pH 9.4 to 10.4, or carbonate 30 to 60 % with percarbonate up to 10 % and pH 10.4 to 11) | A current UK sheet from Reckitt; the pack's own ingredient bands; or the pH of one capsule dissolved in 116 mL of water (a 10 % solution), which separates the two groups |
| 4 | Ultimate or Ultimate Plus, and which year's formulation | A photograph of the owner's pack, front and back, with the batch code |
| 5 | What each compartment holds and the mass of each | Cutting one capsule open and weighing the three parts and the film |
| 6 | When the capsule releases in Auto 45-65 | Stopping a wash 2, 4 and 8 min after the dispenser opens and looking; or a conductivity trace of the liquor |
| 7 | Main-wash pH | A pH strip or meter on liquor taken mid-wash; one reading checks `liq.xCarbonate` and `liq.dpHni` together |
| 8 | Size of the catalyst's contribution to tea removal | Tea-stained cups washed with this product against a catalyst-free TAED product in the same programme |

---

## 8. Sources

### Opened and read this session

| ID | Source | URL | What was taken | How read |
|---|---|---|---|---|
| S1 | Reckitt ingredient disclosure, UK/Ireland, Finish: "Finish Ultimate All in 1 Fresh" (sku 000011654), "Finish Ultimate All In 1 Fresh" (000011138), "Finish Ultimate All in 1" (000008742), and the list of Finish products | https://www.rbeuroinfo.com/s/brands/products/product-details?language=en_GB&brand=27&country=UK&sku=000011654 | full ingredient lists in descending order; the names of the variants on the UK market | in a browser (the site is script-rendered) |
| S2 | Ocado, "Finish Ultimate All in One Lemon", 55 per pack | https://www.ocado.com/products/finish-ultimate-all-in-one-lemon/673043011 | pack text: "Caps", usage, "15% less chemical weight", hazard statements, maker's address | in a browser |
| S3 | Sainsbury's, search results for "finish ultimate all in one" | https://www.sainsburys.co.uk/gol-ui/SearchResults/finish%20ultimate%20all%20in%20one | prices and prices per kg of the x32, x55 and x75 packs, from which 12.9 g per unit | in a browser |
| S4 | Reckitt Benckiser (Australia), safety data sheet "Finish Ultimate Dishwashing Tablets Lemon", D8411614, formulation FF3314399, 05/12/2025 | https://www.rb-msds.com.au/uploadedFiles/pdf/Final%20A_FF3314399_D8411614_Finish%20Ultimate%20Dishwashing%20Tablets%20Lemon.pdf | composition bands, physical state, pH, classification | PDF text extracted locally |
| S5 | RB (Hygiene Home) Australia, safety data sheet "Finish Ultimate Dishwashing Tablets Fresh", D8408447, formulation FF3289622, 17/05/2024 | https://www.rb-msds.com.au/uploadedFiles/pdf/Finish%20Ultimate%20Dishwashing%20Tablets%20Fresh%20D8408447.pdf | the earlier bands and pH | PDF text extracted locally |
| S6 | RB Hygiene Home Deutschland, Sicherheitsdatenblatt "Finish Powerball Ultimate Plus All in 1", D8394398_1, formulation FF3158896 v1.0, 3/2/2022 | https://static.plate.de//downloads/3246587/180484851/sicherheitsdatenblatt_3246587.pdf | bands and pH of Ultimate Plus, for contrast | PDF text extracted locally; the table's columns came out interleaved and were reassembled by CAS number |
| S7 | US 2023/0416651 A1, "Composition" (Reckitt Benckiser Finish BV), priority 2020 | https://patents.google.com/patent/US20230416651A1/en | catalyst in a liquid compartment, its mass and level, the film definition | via fetch-tool extraction |
| S8 | US 2024/0141260 A1 (Reckitt Benckiser Finish BV), priority 2021 | https://patents.google.com/patent/US20240141260A1/en | as S7; example liquids with 0.43 to 0.9 % MnTACN | via fetch-tool extraction |
| S9 | US 8,962,543 B2, "Dishwashing composition" (Reckitt Benckiser), priority 2008 | https://patents.google.com/patent/US8962543 | example tablets: percarbonate 12.0, TAED 4.0, protease 0.8 (Puramax 2250D), amylase 0.4 (Stainzyme 12GT), sulfonated polyacrylate 5.0 %, pH 10.2 | via fetch-tool extraction (first 100,000 characters) |
| S10 | Reckitt US ingredient page, "FINISH ULTIMATE Tabs" | https://www.rbnainfo.com/product.php?productLineId=3161 | US ingredient list with functions (a different market's formulation) | via fetch-tool extraction |
| S11 | Reckitt Benckiser (Australia), safety data sheet "Finish Rinse and Shine Aid Regular", D8411055, formulation 3324569, 05/12/2025 | https://www.rb-msds.com.au/uploadedFiles/pdf/Final%20A_3324569_D8411055_Finish%20Risne%20&%20Shine%20Aid%20Regular%20(Fresh).pdf | surfactant band, pH, density, classification | PDF text extracted locally |
| S12 | Reckitt ingredient disclosure, UK/Ireland, "Finish Rinse & Shine Aid" (sku 000005672) | https://www.rbeuroinfo.com/s/brands/products/product-details?language=en_GB&brand=27&country=UK&sku=000005672 | ingredient list | in a browser |
| S14 | RB Hygiene Home Switzerland, fiche de données de sécurité "Finish Powerball Ultimate All in 1", D8395627 v2.0, formulation FF3233992 v1.0, 16/12/2022 (previous edition 16/05/2022) | https://static.vikingdirekt.ch/is/content/odeu13/PDF/MSDS_1197593_FR_16.12.2022.pdf | bands, pH and colours (blue, white, red) of the exact-named product; added by the fact-check | PDF text extracted locally |
| S15 | trolley.co.uk, "Finish Ultimate All In One Dishwasher Tablets Lemon" | https://www.trolley.co.uk/product/finish-ultimate-all-in-one-lemon-dishwasher-tablets/GIE086 | pack sizes 32 x 412.8 g, 55 x 709.5 g, 75 x 967.5 g; added by the fact-check | via fetch-tool extraction |
| S13 | Safety data sheets of Ultimate Plus Fresh (D8411012, 2025), Ultimate Plus Citrus (D8404498, 2024) and Powerball All in One 0% (2020), Germany and Austria | https://static.vikingdirekt.at/is/content/odeu13/PDF/SDS_1272085_DE_01-10-2025.pdf and others | identified as other products; nothing taken | headers read |

### Identified but not opened

| ID | Source | URL | Why not opened |
|---|---|---|---|
| N1 | Tesco product pages for Finish Ultimate All In One (pack weights in the titles) | https://www.tesco.com/shop/en-GB/products/316310311 | the site refused automated and browser access; weights seen in search results only |
| N2 | CHOICE (Australia) review pages for Finish Powerball Ultimate tablets (country of origin Poland) | https://www.choice.com.au/products/home-and-living/kitchen/dishwasher-detergent/finish-powerball-ultimate-0-all-in-1-tabs | search-result snippet only |
| N3 | Sicherheitsdatenblatt "Finish Powerball Ultimate All in 1", D8395627, FF3233992, 2022 | https://static.tekno.de/img/7/8/i1385704.pdf | host did not resolve (again at the fact-check); the Swiss edition of the same sheet was read instead [S14] |
| N4 | Tesco, "Finish Lemon Rinse Aid 400ml" (label bands) | https://www.tesco.com/shop/en-GB/products/313846004 | as N1 |
| N5 | Reckitt US safety data sheet "FINISH ULTIMATE Tabs", D8411588, FF3297102 | https://www.rbnainfo.com/getmsds/1e23221b-604a-4e14-885f-29aa9fa5df3c | returned not found |
| N6 | MonoSol film data sheets (dissolution of the film against temperature) | https://plastics.ulprospector.com/plastics/en/datasheet/387221/monosol-m8630-76u | behind a login; one MonoSol patent opened (US 8,697,624) held no dissolution times in the part read |

---

## 9. Fact-check (2026-10-10, second pass by another agent)

What was done: every source of section 8 that could be reached was opened again and compared with what the dossier takes from it; one further primary source of the composition was searched for and found; every derived number of sections 2 and 3 was recomputed with a separate script against `packages/sim-liquor`; the parameter file was loaded with `readParamSet` against the current registry.

Confirmed as written: the UK ingredient list of sku 000011654, all 44 entries in order, and the lists of 000011138 and 000008742 [S1]; the rinse-aid list [S12]; the Ocado pack text [S2]; the Sainsbury's prices, which give 12.90 g for each of the three packs [S3]; the bands, pH, form and classification of the two Australian sheets [S4, S5] and of the Ultimate Plus sheet [S6]; the rinse-aid sheet [S11]; the patent examples [S9] and the film definition [S7, S8]; the US list [S10]; the values taken from `[-> chemistry]` 10.3 and 10.5; the unit conversions (percarbonate 314.02 g/mol, 0.955 mol/kg of peroxide at 10 %, TAED 0.175 mol/kg at 4 %, carbonate 3.77 mol/kg, alkalinity 7.23 eq/kg); the pH of a 10 % solution by the model's solver (11.06, 10.70 after TAED, 12.45 for type D); every figure of the table in section 3.1 for the parameter ranges as they then stood.

Corrected:

1. A sheet for the exact product exists and was not used: the Swiss edition of D8395627 [S14]. It and the Australian sheet of 2024 disagree with the Australian sheet of 2025 on which the reconstruction leaned (carbonate, percarbonate and pH). Sections 0.3, 1.1, 1.2, 2, 3 and 7 now say so; the best estimates are unchanged because they sit where the bands meet, but the ranges of sodium carbonate (15 to 40 %), percarbonate (6 to 16 %), `liq.xCarbonate` (2.0 to 4.5) and `liq.xPeroxide` (0.57 to 1.53) are wider, and the predicted ranges of pH and peracid with them. The statement that the 10 % pH check agrees with "the sheet" now says it agrees with one sheet of three.
2. The lower bound of `liq.xProtease`, 0.0125, was described as parity per wash with 20 g of type D. It is 0.8 times that; parity is 0.0155. The numbers of the range are unchanged, the description is corrected.
3. `liq.xCarbonate` 3.3 was said to give the pH of the full balance within 0.03. That holds only with the etidronate counted as a base (0.03); without it the difference is 0.06. The value is unchanged.
4. The patent example of S9 was said to be of a 20 g tablet; the page gives no tablet weight. "0.1 to 30 mg" of catalyst is in S8 only; S7 gives 0.1 to 30 mg/mL and 0.1 to 5 %. The share of MnTACN corresponding to 0.1 to 30 mg is 0.001 to 0.23 %, not 0.01 to 0.2 %.
5. The fall of pH from TAED acid is 0.12 by the solver, not 0.15. The lower end of mean amylase is 11 mg/L, not 10.
6. The parameter file no longer read back: `readParamSet` reported a hash mismatch (`hydroHash`), because the registry has changed since the file was written. The file was written again from the same ten overrides with `createParamSet(...).toJSON()` and reads back; it will need this again whenever a default of the registry changes. Its provenance note and the sidecar were brought into line with the above.

Tags changed: pack weights of the 32, 55 and 75 packs from [RECALLED] to [VERIFIED] on an aggregator [S15]; subtilisin under 1 % and etidronate up to 10 % from "Ultimate Plus only" to [VERIFIED] for the exact-named product of 2022 [S14]; the carbonate and percarbonate bands remain [VERIFIED] as readings but are now marked as in conflict.

Could not be confirmed and left as tagged: the Tesco weights of the 92 and 115 packs and the UK rinse-aid label band [RECALLED]; the Polish origin of the Australian product [RECALLED]; that a higher sku number is a newer entry; the dose range of 12.7 to 13.1 g, which is an assumed tolerance. Not supported by any source and tagged [ESTIMATED]: every enzyme number, TAED 4 %, all shares below the fourth ingredient, `liq.tabletTau`.

The owner's pack was not seen. If it is Ultimate Plus, nothing here applies.
