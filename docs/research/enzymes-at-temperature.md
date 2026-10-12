# Spotless research dossier: proteases (and amylases) in automatic dishwashing at 45 to 70 °C

Specialist: detergent enzymology. Date: 2026-10-10. Status: desk research from patents with measured tables, two open-access in-machine studies, suppliers' pages and the project's own dossiers; nothing measured; uncalibrated. Fact-checked the same day: section 9 lists what was confirmed, corrected and downgraded, and the corrections are marked "[fact-check]" in the text.

## 0. How to read this dossier

### 0.1 Scope

`docs/calibration/anchoring.md` section 5.4 finds that on Auto 45-65 every egg-yolk and milk item stays dirty, and that the verdict rests on two placeholders: the protease half-life law of `[-> chemistry]` 10.5 (`liq.proteaseHalfLife` 1800 s at 60 °C, `liq.proteaseEd` 200 kJ/mol) and the activity mid-point of `[-> chemistry]` 10.6 (`enzymeTm` 63 °C, `enzymeDH` 300 kJ/mol in `packages/sim-soil`). This dossier collects what is published on both, on whole-machine protein cleaning above 55 °C, and on the enzymes of current premium unit doses, and recommends defaults and ranges. It does not cover what the Auto programme does (step times and targets); that is the machine dossier's question.

Cross-links: `[-> chemistry]` is `docs/research/chemistry.md`, `[-> soils]` is `docs/research/soils.md`, `[-> finish]` is `docs/research/detergent-finish-ultimate.md`, `[-> anchoring]` is `docs/calibration/anchoring.md`.

### 0.2 Confidence tags

[VERIFIED] read in the opened source this session; [RECALLED] from memory or a search-result snippet; [ESTIMATED] my derivation (the inputs may be verified; the arithmetic is mine). A half-life derived from a verified residual activity assumes first-order loss and is tagged [ESTIMATED from VERIFIED]. Sources are `S#` (opened) and `N#` (not opened), section 8.

### 0.3 The findings that matter

1. **The half-life of a classic detergent subtilisin at 60 °C and pH 10 is not one number: it spans a factor of about 40 with the calcium state of the enzyme.** Savinase, 15 ppm, pH 10.0, 10 minutes at 60 °C: 8.6 % of the activity left without calcium, 95 % left with 50 mM CaCl2; at 70 °C with calcium, 69 % [VERIFIED, S1 Table IV]. As half-lives: about 3 min, about 80 to 135 min, and about 19 min [ESTIMATED from VERIFIED]. The model's 30 min lies between and cannot be called wrong or right from this; the evidence does not say it is too short.
2. **A wash liquor is on the calcium-poor side.** Softened water, 30 % citrate in detergent D, MGDA or citrate with phosphonate in capsules. The makers say so themselves: complexing agents "negatively affect proteases by extracting the structural calcium metal ions", in use as well as in the product, worst in soft water, and hot, long cycles "create a lot of stress on enzymes" [VERIFIED, S3]. The current dishwashing proteases are selected in exactly that stress (5 mM EDTA, pH 9, 5 min at 56 to 57 °C), where an unengineered parent keeps 1 % and commercial-generation variants 9 to 45 % [VERIFIED, S3, S4, S5].
3. **The activity mid-point of 63 °C double counts.** With calcium Savinase keeps 95 % of its activity through 10 min at 60 °C and 69 % through 10 min at 70 °C [VERIFIED, S1]: the folded enzyme exists at 70 °C and its loss is a matter of time. The published "optimum 55 °C, falls rapidly above 60 °C" [VERIFIED, S9] is an optimum of a timed assay, which contains the inactivation the liquor model already integrates. With both in the model the enzyme is penalised twice above 60 °C.
4. **Whole machines with premium capsules do not show a collapse at 58 to 64 °C.** Four household machines, four market products, CFT protein tiles and IKW crème brûlée: in the "1 h" programmes (main wash 13 to 32 min reaching 50.6, 58.0, 59.0 and 63.9 °C) the two high-tier capsules gave almost complete crème brûlée removal at 59.0 and 63.9 °C and high scores on the protein tiles; the low-tier tablet was poor on protein in every programme, eco included, and on one machine did better in the hot 1 h programme than in its 51 °C eco programme [VERIFIED, S6].
5. **Nothing published was found for reference detergent D, or any Savinase-only product, in a main wash above 52 °C with absolute protein-soil results.** The one patent family that washed at 45, 55 and 65 °C reports only indices relative to a commercial protease [VERIFIED, S2]. Whether detergent D's protein cleaning collapses at 65 °C is open; for a current premium capsule the evidence is against it.
6. **Dose matters more than stability for the capsule.** P&G's own machine examples dose 32 to 43 mg of active protease per wash in a 16 g unit dose [VERIFIED, S4]; detergent D carries 0.2 g of Savinase 6 T, of the order of 5 mg of active enzyme [ESTIMATED]. With the same machine, soils and temperature, detergent D scores at most 1.7 of 10 on crème brûlée in 40 min at 50 °C where a market capsule scores about 9 to 10 [VERIFIED, S7].
7. **On the model's own rate law the recommended changes roughly double the enzyme work of a 65 °C main wash** (section 5): from 31 to 48 reference-minutes for detergent D at the anchored level, against 124 or more needed for the thickest places of the egg layer in `[-> anchoring]` 5.4. [fact-check] The stand-alone figures are optimistic and the capsule rows used half the protease level of the owner sets; whole washes with the repository's code (section 9.3) leave 25 % of the egg yolk on Auto as written with detergent D after the mid-point change (57 % before), 3 to 18 % with the capsule, and no egg item or milk glass clean in any case. The sentence "the mean layer then clears" does not hold in the whole wash. What stands: whether an item reads clean is decided by the length of the wash and the spread of the layer, not by enzyme survival.

---

## 1. Stability in the wash liquor

### 1.1 Classic subtilisins, measured

Protocol of S1 (Table IV; [fact-check] the pH series of Table III used a blend of 50 mM each of glycine, TAPS, PIPES and acetate, not 100 mM glycine): enzyme desalted on a PD-10 column into 100 mM glycine pH 10.0, adjusted to 15 ppm, CaCl2 added to 50 mM where stated, 10 min in a thermal block, cooled on ice, residual activity on suc-AAPF-pNA at pH 8.6 and 25 °C. No detergent, no bleach, no substrate present.

| Enzyme | 60 °C, no Ca | 60 °C, 50 mM Ca | 70 °C, 50 mM Ca | Tag |
|---|---|---|---|---|
| Savinase (B. lentus; the protease of detergent D) | 8.6 % | 95 % | 69 % | [VERIFIED, S1 Table IV] |
| Esperase (B. lentus, the high-temperature grade) | 89 % | 98 % | 88 % | [VERIFIED, S1 Table IV] |
| Maxatase (B. licheniformis, subtilisin Carlsberg) | 21 % | 83 % | 2.4 % | [VERIFIED, S1 Table IV] |
| LG-12 (the patent's enzyme) | 60 % | 97 % | 82 % | [VERIFIED, S1 Table IV] |

Savinase against pH, same protocol, 10 min at 60 °C [VERIFIED, S1 Table III]:

| pH | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|
| no Ca, % left | 51 | 64 | 68 | 54 | 10.3 | 0 |
| 50 mM Ca, % left | 100 | 99 | 100 | 92 | 92 | 74 |

Half-lives from these, first order [ESTIMATED from VERIFIED]:

| Savinase condition | Half-life |
|---|---|
| 60 °C, pH 10, no added Ca | 2.8 to 3.1 min |
| 60 °C, pH 9, no added Ca | 11 min |
| 60 °C, pH 10, 50 mM Ca | 83 to 135 min (from 92 % and 95 %) |
| 60 °C, pH 11, 50 mM Ca | 23 min |
| 70 °C, pH 10, 50 mM Ca | 19 min |
| Apparent activation energy of loss, 60 to 70 °C with Ca | 140 to 190 kJ/mol |

Reading: (a) the calcium state moves the half-life by a factor of 30 to 45; (b) between pH 9 and pH 11 it falls by a further factor of 4 or more; (c) with calcium the temperature dependence is steep, as the model assumes (200 kJ/mol against 140 to 190 here); (d) the high-temperature grade Esperase barely notices 60 °C either way. The values are for an enzyme alone in buffer at 15 ppm; a wash has about 1 ppm of enzyme and protein soil in solution, both of which slow autolysis [RECALLED, general], and bleach and surfactant, which do not.

### 1.2 What decides the calcium state in a wash

| Statement | Tag |
|---|---|
| "Complexing agents can negatively affect proteases by extracting the structural calcium metal ions of the protease. The proteases can be affected in product and/or in-use", more so when the composition is overbuilt and the water soft | [VERIFIED, S3 background; the same paragraph in S4, S5] |
| "For the toughest items, consumers would usually select hot, long automatic dishwashing cycles. These cycles create a lot of stress on enzymes" | [VERIFIED, S3] |
| "The bleach can also impair on the performance of enzymes, specifically proteases. This effect can be exacerbated by high level of complexing agents, high temperature and long cycles" | [VERIFIED, S5] |
| "Proteases can be susceptible to temperature. Proteases designed to withstand high temperatures usually have a slow kinetic rate as temperature robustness is often driven by structural rigidity" | [VERIFIED, S4] |
| P&G's definitions: a "hot" cycle has a main wash above 40, preferably above 45 °C [S4]; the stressed case is above 50 °C and longer than 25 min [S3] | [VERIFIED] |
| Protease stability in dishwashing conditions falls with protonated peracid, with the peroxide acid-base species, with temperature and with pH; amylase with deprotonated peracid, a pH and temperature interaction and peroxide with manganese catalyst; fitted models R² 0.90 and 0.84 | [RECALLED, abstract of N1 through search snippets; the paper could not be opened] |
| Detergent D in 4 L: about 5 mmol/L citrate, plus polycarboxylate, in softened water; free calcium of the order of 10 µmol/L if total calcium is 0.2 mmol/L | [ESTIMATED] |
| A soil load brings calcium of its own (milk about 30 mmol/L) | [RECALLED] |

So the liquor of detergent D is nearer the "no added Ca" row than the "50 mM Ca" row, but it is not the bare buffer: the tightly bound structural calcium survives desalting and mild chelants, substrate is present, and the enzyme is ten times more dilute. No source opened measures Savinase in a citrate-built dishwashing liquor at 60 to 65 °C.

### 1.3 Current dishwashing grades

| Grade (supplier) | What is published | Tag |
|---|---|---|
| Savinase 6 T (Novozymes): detergent D | B. lentus subtilisin 309, unengineered. Optimum 55 °C, working range 20 to 60 °C, pH 8 to 12, optimum pH 10 | [VERIFIED, S9; `[-> chemistry]` 1.1] |
| Blaze, Blaze 100 T (Novozymes) | Named as the commercial dishwashing protease P&G compares against; dosed at 43 mg active per wash | [VERIFIED, S4] |
| Blaze Evity 250 T (Novonesis) | "Effectively removes protein soils even in shorter and cooler cycles and high-soil washes"; suited to cycles "below 45°C" and eco settings; "tough enough to withstand exposure to high temperatures, humidity and bleach" (a storage claim); no numbers | [VERIFIED, S10] |
| Blaze Exceed 100 T (Novonesis) | Protease co-granulated with the MnTACN bleach catalyst; cooler cycles below 45 °C; "fast-acting"; no in-wash stability statement | [VERIFIED, S11] |
| Excellase (DuPont, now IFF) | Named as the second commercial reference, 43 mg active per wash | [VERIFIED, S4] |
| Properase and PB92 variants (Genencor) | Tested in a Miele G690SC at 45, 55 and 65 °C in IEC type B and C detergents, 21 °dH, 20.57 mg active per wash; variant 049 gives 116 to 134 against Properase = 100 on egg yolk at every temperature including 65 °C | [VERIFIED, S2] |
| P&G and Danisco B. gibsonii (BG46) variants, 2018 to 2023 | Selected for stability in Tris-EDTA and cleaning in MGDA formulas (below) | [VERIFIED, S3, S4, S5] |
| Ovozyme, Everlase, Purafect, FN3 | Listed with the above as dishwashing proteases | [RECALLED, snippet] |

The stress test of the P&G and Danisco family: 50 mM Tris pH 9, 5 mM EDTA, 0.005 % Tween 80, 5 min at 56 or 57 °C, residual activity on suc-AAPF-pNA.

| Enzyme | Residual after 5 min | Half-life in the stress buffer | Tag |
|---|---|---|---|
| B. gibsonii wild type (SEQ ID 1 of S3) | 1 % at 56 °C | under 1 min | [VERIFIED, S3 Table 2]; half-life [ESTIMATED] |
| First-generation variants (S39E, S99R, S126A, D127E, F128G and relatives) | 9 to 39 % at 56 °C | 1.4 to 3.7 min | [VERIFIED, S3 Table 2] |
| The reference of S5 | "approximately 30-45 %" at 56 °C | 2.9 to 4.3 min | [VERIFIED, S5] |
| The reference of S4 (a variant of the previous generation) | "~15-30 %" at 57 °C | 1.8 to 2.9 min | [VERIFIED, S4] |
| Newest variants (N74D, M211N or Q and relatives) | stability index 3.1 to 3.6 against the reference | not derivable | [VERIFIED, S4 Table 3] for the index. [fact-check] The percentage "roughly 50 to 100 %" is withdrawn: 3.1 to 3.6 times 15 to 30 % is 46 to 108 %, so the index is not a simple ratio of residual activities |

The test is deliberately harsher than a wash (EDTA strips what MGDA and citrate only compete for). It shows three things: these subtilisins are as calcium-dependent as Savinase; each generation is several times more stable than the last under chelant stress; and the suppliers treat stability at 56 to 57 °C without calcium as the property to engineer. It does not give a half-life in a wash liquor. None was found for any current grade.

### 1.4 What stabilises the enzyme in a real wash

| Factor | Evidence | Tag |
|---|---|---|
| Calcium | Section 1.1: a factor of 30 to 45 on the half-life at 60 °C | [VERIFIED, S1] |
| Less chelant, harder water | The maker's own statement: overbuilt compositions in soft water are the worst case | [VERIFIED, S3] |
| Lower pH | Section 1.1: a factor of 4 or more between pH 11 and pH 9 to 10. A capsule at pH 10.0 to 10.4 is gentler than detergent D at 10.8 `[-> finish]` | [VERIFIED, S1]; the comparison [ESTIMATED] |
| Substrate and dilution | Autolysis needs an active molecule to meet an unfolded one; soil protein competes | [RECALLED] |
| The unit dose | Coated granulates and separate compartments protect the enzyme in storage (Evity coating [S10, S11]; catalyst in its own compartment `[-> finish]` 1.3). Nothing was found on protection in the wash | [VERIFIED for storage] |
| Bleach | Peracid and peroxide inactivate; `[-> chemistry]` 2.4. The manganese catalyst is reported to raise the peroxide effect on amylase | [RECALLED, N1 abstract] |

---

## 2. Activity against temperature

| Finding | Value | Conditions | Tag |
|---|---|---|---|
| Egg-yolk tile cleaning rate in a machine | 0.85 % per min at 30 °C, 1.75 at 55 °C: factor 2.06, 24 kJ/mol | Whirlpool, pH 10.5, 0.06 g/L protease granulate | [VERIFIED, `[-> soils]` 6.1] |
| Same soil, bench gauge | 25 to 32 kJ/mol over 30 to 55 °C | 29 conditions | [ESTIMATED from VERIFIED, `[-> chemistry]` 2.3] |
| Savinase "optimal temperature" | 55 °C; "functions between 20-60 °C, above which the activity falls rapidly" | Supplier-derived teaching sheet; assay and duration not stated | [VERIFIED, S9] |
| Savinase "optimal temperature" | 60 °C | Stated in a patent on a cold-active protease | [RECALLED, snippet] |
| Savinase activity surviving 10 min at 70 °C, with calcium | 69 % | Section 1.1 | [VERIFIED, S1] |
| Esperase surviving 10 min at 70 °C, with calcium | 88 % | Section 1.1 | [VERIFIED, S1] |
| Short-cycle soil removal with a market capsule rises from 40 to 45 to 50 °C main wash; the step from 45 to 50 °C is the smaller | Mean over seven soils; best 20-min cycles 62 % at 40 °C, 73 to 77 % at 45 °C, 82 to 88 % at 50 °C | Modified Bosch SMS2ITW33E, 8 to 10 L, 2.3 °dH | [VERIFIED, S7 Table 4, Fig. 7] |
| "The effect of the cleaning temperature factor exceeds the effect of the time factor" | Gorny et al. 2016, as cited | | [VERIFIED as a citation in S6; N4 not opened] |

Separating rate from inactivation. An enzyme's catalytic rate rises with temperature until the protein unfolds; for subtilisins unfolding is followed at once by autolysis and is irreversible [VERIFIED as a statement in a subtilisin calorimetry patent, snippet only: RECALLED]. A temperature optimum read from a timed assay is therefore where the rising rate meets the loss during the assay, and it moves down as the assay gets longer or the calcium scarcer. In the model the loss over time is the liquor's half-life law. The soil-side factor f_T should then describe only what is instantaneous: the Arrhenius rise and the true unfolding transition.

Where the unfolding transition is. Savinase with calcium is 95 % intact after 10 min at 60 °C and 69 % after 10 min at 70 °C [VERIFIED, S1], so its mid-point for a 10-minute exposure is above 70 °C with calcium. Without calcium it is below 60 °C (8.6 % after 10 min). For BPN'-type subtilisins calorimetry gives about 78 °C with 10 mM calcium and about 59 °C in 10 mM EDTA [RECALLED, snippets of two patents; the 59 °C is a subtraction]. No calorimetric value for Savinase at pH 10 to 10.5 was found.

**Is a mid-point of activity near 63 °C defensible?** Only as the mid-point of a calcium-depleted enzyme, and then it is the same phenomenon as the half-life law, counted a second time. With `enzymeTm` 63 °C and `enzymeDH` 300 kJ/mol the factor is 0.97 at 60 °C, 0.53 at 65 °C and 0.18 at 70 °C at the instant the enzyme arrives, before any time has passed. No measurement found supports an instantaneous halving at 65 °C. The recommendation (section 6) is to move the mid-point to 75 °C (range 68 to 85) and let the half-life law carry the loss.

How fast the rate falls above the optimum, independent of time: not measured in anything opened. In-machine data stop at 55 °C [`[-> soils]` 6.1] and at 50 °C for controlled comparisons [S7].

---

## 3. Whole-wash evidence

### 3.1 Household machines, market detergents, main wash up to 64 °C (S6)

Tewes, Harcq, Minot and Bockmühl (2024), Rhine-Waal University with two P&G authors. Four 60 cm household machines, each on its short, "1 h" and eco programme; four branded products (A and B: high-tier capsules; C: low-tier pressed tablet; D: high-tier pressed tablet); CFT tiles for boiled egg yolk (BEY), baked cheese (BC), double minced meat (DM), two starches; five IKW crème brûlée plates; IKW tea cups; 50 g IKW ballast soil; IKW hard water; four repeats; temperature logged in the upper rack.

| Programme | Main wash: min, peak °C | Final rinse: min, peak °C | Tag |
|---|---|---|---|
| 1 h, machine 1 | 13, 50.6 | 33, 69.5 | [VERIFIED, S6 Table 4] |
| 1 h, machine 2 | 28, 63.9 | 16, 71.3 | [VERIFIED] |
| 1 h, machine 3 | 32, 59.0 | 22, 49.1 | [VERIFIED] |
| 1 h, machine 4 | 20, 58.0 | 24, 69.4 | [VERIFIED] |
| Eco, machines 1 to 4 | 62 to 110 min at 50.1 to 58.0 | 16 to 63 min at 51.6 to 58.0 | [VERIFIED] |

| Result | Tag |
|---|---|
| Eco: 65 to 93 % SRI on almost all tiles; crème brûlée completely removed by every product | [VERIFIED, S6 3.1] |
| Low-tier tablet C, eco, machine 4 (73 min at 51.1 °C): BEY 27 %, BC and DM 42 % | [VERIFIED] |
| "The 1 h programs showed higher reductions for cleaner C and machine 4 than the corresponding Eco cycles": 20 min reaching 58.0 °C beat 73 min at 51.1 °C for the weakest product | [VERIFIED] |
| 1 h, capsules A and B: crème brûlée "almost complete soil removal" on machines 2 and 3 (63.9 and 59.0 °C), 7.7 to 8.9 of 10 on machines 1 and 4 | [VERIFIED] |
| 1 h: "especially with protein-based soiling (BEY, BC, DM), cleaner C shows very low performance" | [VERIFIED] |
| Short programmes (11 to 21 min, 40.6 to 51.6 °C): BEY 57 to 73 % with A, 56 to 74 % with B | [VERIFIED] |
| Fitted model over all programmes, mean of the five tiles: at 50 °C main wash A and B about 67 %, C about 42 %, D about 47 %; at a 65 °C main wash the worst short combination still gives at least 62 % with B, 56 % with A, 42 % with C, 44 % with D | [VERIFIED, S6 3.3; a support-vector model extrapolating from 12 programmes] |

Reading: with high-tier capsules, a main wash of 20 to 32 min reaching 58 to 64 °C cleans baked protein soils almost completely; the hottest programme of the set (63.9 °C for 28 min) is one of the two best on crème brûlée. Protein cleaning depends strongly on the product at every temperature. The per-tile numbers of the 1 h programmes are in a figure and were not readable as text.

### 3.2 Detergent D against a market capsule, same machine, 40 to 50 °C (S7)

Tewes, Harcq, Minot, ter Bekke and Bockmühl (2024). A freely programmed Bosch SMS2ITW33E, softened to 2.3 °dH; 36 short cycles of 20, 30 and 40 min with main wash 40, 45 or 50 °C, and a programmed eco cycle of 197 min at 50 °C; 14 g of detergent D with rinse aid, or an 18 g market capsule.

| Soil | Detergent D | Market capsule | Tag |
|---|---|---|---|
| Crème brûlée, short cycles | at most 1.7 of 10, "almost no effect", even at 50 °C for 40 min | 4.9 to 7.3 in the 20-min cycles at 40 to 45 °C; almost complete from 30 min | [VERIFIED, S7 3.3] |
| Crème brûlée, eco 197 min at 50 °C | 5.3 of 10, "clearly visible soil residues" | complete | [VERIFIED] |
| Boiled egg yolk tile | (figure only) | almost complete except the four mildest cycles | [VERIFIED] |
| Double minced meat tile | (figure only) | 62 to 76 % in the mildest cycles, up to 93 % | [VERIFIED] |
| Mixed starch tile | mean 17.9 % | about 12 points below baked cheese | [VERIFIED] |

Reading: at 50 °C, where stability is not in question, detergent D only half-cleans a baked protein soil in an eco cycle of 197 minutes ([fact-check] 197 min is the whole cycle; the length of its main wash is in a supplement that was not read) where a capsule clears it in a 30-minute cycle. The authors: detergent D "does not resemble a currently available market detergent" [VERIFIED, S7 2.3]. Note the dose was 14 g, not the 20 g of the standard.

### 3.3 The industry's method and the patent tests

| Finding | Tag |
|---|---|
| IKW method: standard programme 45 °C, 8 min hold, 55 °C rinse; also 40, 50 and a 65 °C intensive programme with 10, 30 or 55 min holds. The method publishes no results by temperature | [VERIFIED, S8; `[-> soils]` 6.4] |
| P&G machine test, Miele GSL2, 45 °C, 8 min hold, 21 gpg, 16.2 g MGDA and percarbonate unit dose with 32 mg active protease: double egg-yolk tile DM22 15.9 % SRI with the reference protease, 22.3 to 22.8 % with the new variants; DM23 29.9 against 41.1 to 41.6 % | [VERIFIED, S4 Table 4] |
| Genencor machine tests at 45, 55 and 65 °C (Miele G690SC, 21 °dH, IEC type B and C detergents with perborate and TAED): only indices against Properase. Phosphate detergent at 65 °C: PB92 variant 049 at 122 (egg yolk), 126 (minced meat), 112 (egg and milk); variant 046 at 97, 38, 104 | [VERIFIED, S2] |
| Absolute removal in those 65 °C runs: not given; the text's worked example of the index uses "45 % SR" for the reference | [VERIFIED, S2] |
| P&G with Salamanca, 217 runs at 40 to 50 °C: protease, amylase, percarbonate and time significant for the protein tile; temperature is not among the significant factors in that range | [VERIFIED, `[-> soils]` 6.3] |

### 3.4 Test institutes

Stiftung Warentest tests the eco, automatic and short programmes with commercially available single-function tablets and gives each 20 % of the grade; the automatic programme is also tested with heavily soiled dishes and a half load [VERIFIED, S12]. Its programme grades combine cleaning, drying, duration, electricity and water, so a published programme grade is not a cleaning result. Examples of programme grades from makers' press releases: Siemens SN87TX00CE and SN57TS00CE, issue 4/2025, automatic programme 2.3, "clearly ahead of the rest of the field" [VERIFIED, S13]; a Siemens model in 4/2026 with eco 2.0, automatic 2.5, short 2.3 [RECALLED, snippet]. I found no institute publication that gives cleaning scores by programme free of charge. That automatic programmes "clean about as well as eco" is consistent with these grades and with S6; it is not shown by a number I could open.

### 3.5 Does protein cleaning collapse at 60 to 70 °C?

- With a current premium capsule: no. S6 shows near-complete removal of baked protein soils after 20 to 32 min reaching 58 to 64 °C.
- With a low-tier tablet: poor at every temperature, and no worse hot than cool in the one direct comparison.
- With detergent D: not known. It is weak on baked protein already at 50 °C (S7). The enzymology of section 1 allows anything from a half-life of a few minutes to an hour at 60 to 65 °C. The model's collapse is one possible reading; nothing published confirms or refutes it.
- Above 64 °C in a machine with absolute results: nothing found.

---

## 4. Enzymes in current premium unit doses

| Statement | Tag |
|---|---|
| The owner's capsule lists "subtilisin" and "α-amylase"; subtilisin under 1 % of 12.9 g (under 129 mg of enzyme substance); no grade, supplier or activity | [VERIFIED, `[-> finish]` 2, 2.1] |
| A Reckitt patent of 2008 exemplifies Puramax 2250D at 0.8 % and Stainzyme 12GT at 0.4 % | [VERIFIED, `[-> finish]` 2.1] |
| P&G unit dose in its patents: 16.2 g with MGDA 7.0 g, percarbonate 3.5 g, MnTACN catalyst, HEDP; 32 or 43 mg of active protease and 8 mg of active amylase (Stainzyme Plus 12 GT) per wash | [VERIFIED, S4] |
| Protease of P&G's own Salamanca studies: the granulate is 9.71 % active, the amylase granulate 4 % | [VERIFIED, `[-> chemistry]` 2.4] |
| Hence 32 to 43 mg active is 0.33 to 0.44 g of such a granulate, 0.07 to 0.11 g/L in 4 to 5 L: the range of the Birmingham in-machine work (0.02 to 0.10 g/L of a P&G granulate) | [ESTIMATED from VERIFIED] |
| Detergent D: 1 % Savinase 6 T, 0.2 g in 20 g. If a 6 KNPU/g granulate holds 2 to 3 % of active enzyme, 4 to 6 mg per wash | [ESTIMATED; the active content of Savinase 6 T was not found] |
| So a premium unit dose carries of the order of 6 to 9 times the active protease of detergent D, and a variant engineered for chelant and heat | [ESTIMATED] |
| Current grades are sold on speed and cool cycles (under 45 °C, eco, short), not on a hot main wash | [VERIFIED, S10, S11] |
| "Proteases designed to withstand high temperatures usually have a slow kinetic rate": the makers trade stability against speed and say they want both | [VERIFIED, S4] |
| Amylases: Stainzyme Plus, an oxidation-stable low-temperature grade, is the amylase of the P&G examples; detergent D has Termamyl 120 T, a thermostable but bleach-sensitive grade | [VERIFIED, S3, S4 for the first; `[-> chemistry]` 1.1 for the second; the properties RECALLED] |

Consequence for the model's units, which needs checking by whoever owns the soil parameters: the reference dose of the protein rate law (`enzymeRef` 0.06 kg/m³) comes from grams of a P&G granulate per litre, about 6 mg/L of active enzyme if it was the 9.71 % grade. The liquor model counts detergent D's 1 % of Savinase 6 T in the same unit, 49 mg/L of granulate, which is about 1 to 1.5 mg/L of active enzyme. If both estimates hold, detergent D is at roughly a fifth of the reference dose, not four fifths, and `[-> anchoring]` moved the level the wrong way to fit. Both active contents are unverified for the materials actually used (the thesis does not name its grade; Savinase 6 T's content was not found), so this is a flag, not a finding.

---

## 5. What the recommended values do to a 65 °C main wash

Script: `calc.py` (a working file, not in the repository), a stand-alone integration of the rate law of `[-> chemistry]` 10.5 and 10.6 as implemented in `packages/sim-liquor/src/liquor.ts` (`enzymeDecayRate`) and `packages/sim-soil/src/kinetics.ts` (f_T and the Hill response, n = 3, K = 0.82 of the reference dose). It does not call the packages. Profile of `[-> anchoring]` 5.4: release at 23 °C, 64 °C after 18 min, 62 °C at 57 min. Oxidative loss fixed at 4.7e-5 1/s (0.3 mol/m³ peracid, 3.3 mol/m³ peroxide at the default constants). "Reference-minutes" is the integral of f_T times the enzyme response: minutes of work at 50 °C and the reference dose, before the pH factor and the lag. For scale: the egg layer of `[-> anchoring]` (56 g/m² at 3e-5 kg/(m² s)) needs 31 reference-minutes at its mean thickness and about 124 at its thickest places; the pH factor is about 1.3 for detergent D and about 0.9 for the capsule.

All [ESTIMATED]. [fact-check] Recomputed: the arithmetic of this table reproduces. Two reservations: (a) the capsule rows at 80 mg/L are not "as now in the owner sets": those sets carry `liq.xProtease` 0.05, which a wash gives as 160 mg/L at its peak (12.9 g in 4.0 L), so the rows at 160 mg/L are the ones that describe them; (b) reference-minutes leave out the lag of a dried soil, the water side and the reading of residues, and the whole washes of section 9.3 are less favourable. Use section 9.3 for removal, this table only for the direction of each change.

| Case (peak protease, half-life at 60 °C, E_d, mid-point) | Protease left at 57 min | Reference-minutes, Auto 65 °C | Same, a 60 °C wash | Same, Eco 50 (161 min) |
|---|---|---|---|---|
| D, registry defaults (49 mg/L, 30 min, 200, 63 °C) | 14 % | 13 | 21 | 62 |
| D, anchored level (98 mg/L, 30 min, 200, 63 °C) | 14 % | 31 | 55 | 166 |
| D, anchored level, mid-point 75 °C only | 14 % | 46 | 65 | 165 |
| D, anchored level, recommended (30 min, 170, 75 °C) | 16 % | 48 | 64 | 155 |
| D, anchored level, half-life 3 min | 0 % | 19 | 19 | 39 |
| D, anchored level, half-life 10 min | 1 % | 27 | 34 | 97 |
| D, anchored level, half-life 120 min | 56 % | 83 | 83 | 178 |
| Capsule as now in the "savinase" set (80 mg/L, 30 min, 200, 63 °C) | 14 % | 26 | 45 | 136 |
| Capsule, recommended (80 mg/L, 90 min, 170, 75 °C) | 49 % | 65 | 70 | 147 |
| Capsule, recommended stability, 160 mg/L | 49 % | 99 | 96 | 217 |
| Capsule, recommended stability, 300 mg/L | 49 % | 107 | 101 | 231 |
| The "heat-stable ASSUMED" set of `[-> anchoring]` (100 mg/L, 120 min, 200, 75 °C) | 54 % | 83 | 84 | 183 |

Reading:

1. For detergent D the recommended values raise the enzyme work of the 65 °C wash by about half (31 to 48 reference-minutes), nearly all of it from the mid-point. The mean egg layer then clears (48 x 1.3 against 31 plus the lag); the thickest places do not.
2. The uncertainty in the half-life alone moves the result from 19 to 83: a factor of four. No desk value can decide Auto for detergent D.
3. For the capsule, stability and mid-point together take it from 26 to 65, and the dose from 65 to about 100. The ceiling is near 110: with no loss at all, 57 minutes at f_T 1.4 and a saturated response of 1.55 cannot exceed about 120. The model's "four times the mean thickness" requirement (124) is therefore out of reach of any enzyme on this programme. If S6 is right that such programmes clean baked protein almost completely, the remaining error is in the spread of the layer, the reading of residues, the rate constant or the programme's length, not in enzyme survival.
4. A 60 °C main wash is nearly as productive as a 65 °C one under every assumption, and more productive under the pessimistic ones.

---

## 6. Recommendation

### 6.1 Parameters

| Parameter | Current | (a) Reference detergent D: default (range) | (b) Premium capsule: default (range) | Basis | Tag |
|---|---|---|---|---|---|
| `liq.proteaseHalfLife` at 60 °C | 1800 s (600 to 14400) | 1800 s (180 to 7200) | 5400 s (1800 to 14400) | (a) bracketed by 3 min without and 83 to 135 min with calcium [S1]; the liquor is calcium-poor but not bare. (b) no measurement; engineered generations are several times more stable under chelant stress [S3 to S5], and S6 shows no collapse at 58 to 64 °C | bounds of (a) [VERIFIED as buffer values]; default of (a) [ESTIMATED]. [fact-check] The default of (b) is downgraded to an assumption: S6 cannot tell 30 from 90 min (section 9.2), and the stress tests compare variants with their own parent, not with Savinase in a liquor. Keep 1800 and 7200 s as a bracket; no default is supported |
| `liq.proteaseEd` | 200 kJ/mol (100 to 300) | 170 kJ/mol (120 to 250) | 170 kJ/mol (120 to 250) | 140 to 190 kJ/mol from Savinase at 60 and 70 °C with calcium [S1]. Half-life factors against 60 °C: 6.7 at 50, 2.6 at 55, 0.40 at 65, 0.17 at 70 °C | [ESTIMATED from VERIFIED]; two temperatures only. [fact-check] Not a supported change: two points of error on the 95 % reading move the result from 142 to 238 kJ/mol, and the current 200 lies inside. Keep 200 (100 to 300) |
| `liq.proteaseKox`, `liq.proteaseKoxHP` | 1e-4, 5e-6 m³/(mol s) | unchanged | unchanged | Direction verified [`[-> chemistry]` 2.4; S5]; no rate found. With a manganese catalyst the peroxide term may be larger | [ESTIMATED] |
| `enzymeTm` (protease) | 63 °C (50 to 90) | 75 °C (68 to 85) | 75 °C (68 to 85) | Section 2: time-dependent loss belongs to the half-life law; Savinase with calcium is 69 % intact after 10 min at 70 °C [S1] | [ESTIMATED]. [fact-check] The argument is structural and holds (section 9.2), but the 69 % is a with-calcium value and nothing measures the instantaneous factor, so the range should keep the present value inside: 75 °C (63 to 85) |
| `enzymeDH` | 300 kJ/mol | unchanged | unchanged | Nothing found | [ESTIMATED] |
| `enzymeEa` (protease) | 25 kJ/mol (5 to 60) | unchanged | unchanged | 24 kJ/mol in a machine, 30 to 55 °C [`[-> soils]` 6.1]. Extrapolated above 55 °C | [ESTIMATED from VERIFIED] |
| Resulting f_T | 1.09 at 55, 0.97 at 60, 0.53 at 65, 0.18 at 70 °C | 1.15, 1.31, 1.44, 1.41 | same | Formula of `[-> chemistry]` 10.6 | [ESTIMATED] |
| `liq.xProtease` | 0.01 (D); capsule 0.02 to 0.05 in the owner sets | unchanged pending 6.2 | at least the top of the dossier's range; the registry maximum of 0.05 may be too low | Section 4: 32 to 43 mg active per premium dose [S4] against about 5 mg in D | [ESTIMATED] |
| `liq.amylaseHalfLife`, `liq.amylaseEd`, `starch.enzymeTm` | 3600 s, 220 kJ/mol, 70 °C | unchanged | unchanged; `liq.amylaseKox` at the low end (6e-5) for an oxidation-stable grade | Nothing opened contradicts or supports the dossier's amylase values; the capsule's amylase is of the oxidation-stable kind in the makers' examples [S4] | [ESTIMATED] |

The two named owner sets of `[-> anchoring]` 5.4 bracket this recommendation: the "heat-stable ASSUMED" set (2 h, 75 °C) is at the optimistic end of (b) and now has a basis for its mid-point but still none for its half-life; the "savinase" set keeps the double count and should be retired.

### 6.2 Programme settings and structure

| Setting | Current | Recommendation | Basis | Tag |
|---|---|---|---|---|
| Use of Auto verdicts for egg and milk | "Do not use" [`[-> anchoring]`] | Keep. The half-life range alone moves the enzyme work by a factor of four | Section 5 | [ESTIMATED] |
| Half-life as a function of free calcium | none | Consider scaling the half-life between the two measured limits with the liquor's free calcium (the solver already has `Ca_free`), since water hardness, builder and soil load then act on protein cleaning the way the makers describe | [S1, S3] | [ESTIMATED]; a structural suggestion, not a fitted law |
| Unit of the protease level | granulate mass, two different granulates treated as one | Carry active enzyme, or a per-grade activity factor, before fitting the level again | Section 4 | [ESTIMATED] |
| First calibration wash | egg-yolk plates on Auto with the owner's capsule | Unchanged, and add the same plates on Eco 50: the ratio of the two separates stability from dose | Section 5 | [ESTIMATED] |

---

## 7. What I looked for and did not find

1. The rate constants of Roldán-San Antonio et al. (2024), Chem. Eng. Sci. 287, 119767 [N1]: the one paper that measures protease and amylase loss against temperature, pH, peracid, peroxide, catalyst, hardness and chelant in dishwashing liquor. Open access, but the publisher served a robot check and the Salamanca repository a proof-of-work wall; the abstract is known only from snippets.
2. Any half-life or residual activity of Savinase, Blaze, Excellase or a current grade in an actual dishwashing liquor (citrate or MGDA, percarbonate, TAED) at 55 to 70 °C.
3. Absolute protein-soil removal with reference detergent D, B or C in a main wash above 52 °C. The 65 °C runs of S2 are indices only.
4. In-machine protein cleaning rates above 55 °C under controlled conditions (the Birmingham work stops at 55 °C, S7 at 50 °C).
5. A calorimetric unfolding temperature of Savinase at pH 10 to 10.5 with and without calcium (Tindbaek et al. 2004 [N2] and Lund et al. 2012 [N3] are paywalled).
6. The active enzyme content of Savinase 6 T, and the grade of the protease granulate in the Birmingham thesis.
7. Novozymes' patents with stability in a dishwashing tablet solution (US 7,951,574; the Savinase-variant dishwashing family CA 2775048) [N5]: the patent site stopped answering after the first batch.
8. Per-tile numbers for the 1 h programmes of S6 (figure only), and its supplementary tables.
9. A test institute's cleaning scores by programme, free to read; and the test institutes' detergent.
10. The enzyme grades or activities of Finish Ultimate; any supplier statement on a hot main wash for a current grade.
11. Amylase: nothing new on Termamyl or Stainzyme stability at pH 10 to 10.5 without calcium.
12. Gorny et al. (2016) on low-temperature dishwashing [N4] and Brückner and Stamminger (2015) on testing automatic programmes [N6]: paywalled.

---

## 8. Sources

### Opened and read this session

| ID | Source | Address | What was taken |
|---|---|---|---|
| S1 | US 5,677,163, "Cleaning compositions comprising the subtilisin enzyme encoded by the gene sprC" (Genencor) | https://patents.google.com/patent/US5677163A/en | Tables III and IV: residual activity of Savinase, Esperase, Maxatase, BPN' and LG-12 after 10 min at 60 and 70 °C, pH 4 to 11, with and without 50 mM CaCl2; protocol |
| S2 | EP 2 059 591 B1, "Dishwashing composition that contains a protease variant" (Genencor; WO 2008/010925, "Protease variants active over a broad temperature range"); tables read in the EP text, methods also in CA 2658396 | https://patents.google.com/patent/EP2059591B1/en | Machine tests at 45, 55 and 65 °C, detergents, soils, dose, relative indices |
| S3 | US 11,834,634 B2, "Phosphate-free automatic dishwashing detergent compositions having a protease and a complexing agent" (P&G, with Danisco) | https://patents.google.com/patent/US11834634B2/en | Statements on chelants, calcium, hot long cycles; Tris-EDTA stability test and residual activities |
| S4 | US 11,492,571 B2, "Automatic dishwashing detergent composition comprising a protease" (P&G) | https://patents.google.com/patent/US11492571B2/en | Statement on temperature and rigidity; stability test; unit-dose composition; 32 and 43 mg active protease, Blaze and Excellase as references; DM22 and DM23 results at 45 °C |
| S5 | US 10,913,919 B2, US 11,220,656 B2, US 11,421,189 B2, "Automatic dishwashing detergent composition" (P&G) | https://patents.google.com/patent/US10913919B2/en (and the two numbers named) | Stability test variants (30 to 45 %, about 50 %, 15 to 30 % residual for the reference); statement on bleach, chelant, temperature and long cycles |
| S6 | Tewes, T.J., Harcq, L., Minot, P., Bockmühl, D.P. (2024). Brevity is the soul of wit: how time, temperature and detergent choice impact the cleaning performance in domestic dishwashers. Tenside Surfactants Detergents 61(1), 10 to 23 | https://www.degruyterbrill.com/document/doi/10.1515/tsd-2023-2563/html | Programmes with logged temperatures, products, soils, results text, model predictions (read in the browser; the publisher refuses scripted access) |
| S7 | Tewes, T.J., Harcq, L., Minot, P., ter Bekke, M., Bockmühl, D.P. (2024). Short and sweet: balancing energy savings and cleaning performance to identify efficient short-cycles for domestic dishwashers. Tenside Surfactants Detergents 61(5) | https://www.degruyterbrill.com/document/doi/10.1515/tsd-2024-2589/html | Detergent D against a market capsule at 40 to 50 °C; tables 3 to 5; the first 50,000 characters of the page (all of the results) |
| S8 | IKW, Recommendations for the Quality Assessment of the Cleaning Performance of Dishwasher Detergents (Part B, Update 2015), with cover sheet | https://www.ikw.org/fileadmin/IKW_Dateien/downloads/Haushaltspflege/2025_EQ-MGSP-Teil-B_2015_inkl_Vorblatt-e.pdf | Programme table including the 65 °C intensive programme; confirmed that no results by temperature are given |
| S9 | National Centre for Biotechnology Education, University of Reading, "Alkaline protease (Savinase)" | https://www.ncbe.reading.ac.uk/alkaline-protease-savinase/ | Optimum 55 °C, range 20 to 60 °C, pH 8 to 12 |
| S10 | Novonesis, product page Blaze Evity 250 T | https://www.novonesis.com/en/biosolutions/household-care/dish/automatic-dish-wash/blaze-evity-250-t | Claims |
| S11 | Novonesis, product page Blaze Exceed 100 T | https://www.novonesis.com/en/biosolutions/household-care/dish/automatic-dish-wash/blaze-exceed-100-t | Claims; MnTACN co-granulate |
| S12 | Stiftung Warentest, "Geschirrspüler im Test", method text | https://www.test.de/Geschirrspueler-im-Test-4685888-0/ | Programmes tested, weights, commercial single-function tablets |
| S13 | Siemens Hausgeräte, press release of 1 April 2025 on Stiftung Warentest 4/2025 | https://media3.bsh-group.com/Documents/26419810_SiemensHausgerate_2025_Presseinfo_StiftungWarentest_pdf.pdf | Programme grades of two models |
| S14 | US 8,183,024 B2 and US 8,728,790 B2 (Danisco), subtilisin variant patents | https://patents.google.com/patent/US8183024B2/en ; https://patents.google.com/patent/US8728790B2/en | Opened for 65 °C results; they describe the method (50 °C, or 45, 55, 65 °C "in some experiments") and give no table by temperature. No value used |
| S15 | Rahman et al. (2017), Molecules 22, 1577, via PubMed Central | https://pmc.ncbi.nlm.nih.gov/articles/PMC6151835/ | Opened; a three-minute bench test on peanut butter, not relevant. No value used |
| S16 | Unpaywall and Crossref records for N1, N2, N3, N6, S6, S7 | https://api.unpaywall.org ; https://api.crossref.org | Bibliographic data, abstracts of S6 and S7, access status |

Project documents read: `[-> chemistry]` sections 1.1, 2, 10.5, 10.6, 12; `[-> soils]` section 6; `[-> finish]` sections 0 to 2; `[-> anchoring]` summary and 5.4; `packages/sim-liquor/src/params.ts`; `packages/sim-soil/src/params.ts`; `packages/machine/src/data/bosch-programmes.ts`.

### Identified but not opened

| ID | Source | Address | Why not |
|---|---|---|---|
| N1 | Roldán-San Antonio, J.E., Amador, C., Martín, M., Blyth, K., Croce Mago, V.C., Bowman, J. (2024). Stability kinetic study for amylase and protease enzymes under food stain removal conditions. Chem. Eng. Sci. 287, 119767 | doi:10.1016/j.ces.2024.119767; https://gredos.usal.es/handle/10366/162113 | robot check at the publisher; proof-of-work wall at the repository; 403 at the conference site |
| N2 | Tindbaek, N., et al. (2004). Engineering a substrate-specific cold-adapted subtilisin. Protein Eng. Des. Sel. 17, 149 to 156 | doi:10.1093/protein/gzh019 | abstract only (403 on the PDF) |
| N3 | Lund, H., et al. (2012). Correlation between enzyme activity and stability of a protease, an alpha-amylase and a lipase in a simplified liquid laundry detergent system, determined by differential scanning calorimetry. J. Surfactants Deterg. 15, 9 to 21 | doi:10.1007/s11743-011-1272-5 | paywalled |
| N4 | Gorny, S., et al. (2016). Potentials and impacts of low temperature electric household dishwashing. Tenside Surfactants Detergents 53, 470 to 477 | doi:10.3139/113.110454 | not fetched; cited through S6 |
| N5 | US 7,951,574 "Subtilases" (Novozymes); CA 2775048 A1 "Use of subtilisin variants for cleaning proteinaceous stains on hard surfaces" (Novozymes); US 2023/0203406 (P&G) | https://patents.google.com/patent/US7951574B2/en ; https://patents.google.com/patent/CA2775048A1/en | patent site returned 503 |
| N6 | Brückner, A., Stamminger, R. (2015). Consumer-relevant assessment of automatic dishwashing machines by a new testing procedure for "automatic" programmes. Energy Efficiency 8 | doi:10.1007/s12053-014-9284-4 | paywalled |

---

## 9. Fact-check (2026-10-10, second reader)

Scripts and outputs: `rec/derive.py` (every derived figure), `rec/auto.ts` with `rec/cases-main.json`, `rec/out-main.json`, `rec/out-diag.json` (whole washes); these were working files and are not in the repository. Nothing under `packages/` was changed.

### 9.1 Sources re-opened

| Claim | Result |
|---|---|
| S1, Tables III and IV (Savinase 8.6 / 95 / 69 %; pH series 10.3 and 92 % at pH 10, 0 and 74 % at pH 11; Esperase 89 / 98 / 88; Maxatase 21 / 83 / 2.4; LG-12 60 / 97 / 82) | Confirmed in the saved patent text, with the protocol. Table III used a four-buffer blend, not 100 mM glycine (corrected in 1.1). The live page returned 503 |
| S3: chelants and structural calcium, "in product and/or in-use", soft water; hot long cycles; Tris-EDTA test, 5 min at 56 °C; wild type 1 %, variants 9, 21, 28 ... | Confirmed |
| S4: rigidity sentence; 57 °C, reference at 15 to 30 %; 16.21 g dose; 32 and 43 mg active protease; 8 mg Stainzyme Plus; Blaze 100T and Excellase; Table 3 indices 3.5 to 3.6; DM22 15.9 against 22.3 and 22.8; DM23 29.9 against 41.6 and 41.1; Miele GSL2, 45 °C, 8 min hold | Confirmed |
| S5: reference at "approximately 30-45 %"; bleach sentence | Confirmed |
| S2: 65 °C, phosphate detergent: variant 049 at 122 / 126 / 112, variant 046 at 97 / 38 / 104 against Properase = 100 | Confirmed. The dose is "between 0 and 20.57 mg" of active protein per wash; the table does not say which dose it reports |
| S6: Table 4 (1 h programmes 13, 28, 32, 20 min at 50.59, 63.92, 58.98, 58.00 °C; eco 62 to 110 min at 50.06 to 57.99 °C), crème brûlée "almost complete" on machines 2 and 3 and 7.7 to 8.9 on 1 and 4, cleaner C at 27 % and 42 % in eco on machine 4, "higher reductions for cleaner C and machine 4", model values at 50 and 65 °C | Confirmed in the browser (the publisher refuses scripted access). The temperatures are maxima, not holds |
| S7: 14 g of detergent D, 2.3 °dH, at most 1.7 of 10 at 50 °C and 40 min, 5.3 in the eco cycle, capsule 4.9 to 7.3 in codes 1 to 6 and almost complete from code 18, "does not resemble a currently available market detergent" | Confirmed. 197 min is the cycle length (corrected in 3.2) |
| S8: 65 °C intensive programme, holds 10 / 30 / 55 | Confirmed in the saved text |
| S9: optimum 55 °C, 20 to 60 °C "above which the activity falls rapidly", pH 8 to 12 | Confirmed. The page's own assay is an overnight gelatine plate; the temperature statement has no assay |
| S10: cycles "below 45°C", "tough enough to withstand exposure to high temperatures, humidity and bleach" | Confirmed; no numbers |
| S13: automatic programme, grade 2.3 | Confirmed |
| N1 (Roldán-San Antonio et al. 2024) | Still not opened: 403 to a scripted fetch, a CAPTCHA in the browser (not bypassed). R² 0.84 (amylase) and 0.90 (protease) as in the search summary. Stays [RECALLED] |

### 9.2 Derived figures and the independent source

- Half-lives, the 140 to 190 kJ/mol, the f_T values, the half-life factors and the 24 kJ/mol all reproduce (`derive.py`). The calcium ratio is 27 to 48, not "30 to 45".
- The with-calcium half-life at 60 °C rests on readings of 92 and 95 %: 93 % gives 96 min, 97 % gives 228 min. Treat "83 to 135 min" as "one to four hours".
- Independent source on activity: Falkenberg et al. (2022), FEBS Open Bio 12, doi:10.1002/2211-5463.13457 (PMC9527586), measured Savinase beside a new subtilisin. Temperature optimum 60 °C in a 5-minute suc-AAPF-pNA assay (100 mM Tris pH 8.6, 5 K steps; BPN' 55 °C, Carlsberg 65 °C); less than 25 % left after 3 to 4 h at 50 °C in 10 mM HEPES pH 8.0 without calcium (the paper gives both times); 64 % left after 1 h in 1 % hydrogen peroxide at 10 °C [VERIFIED]. The model's half-life law alone (30 min at 60 °C, 200 kJ/mol, mid-point out of the way) puts the optimum of a 5-minute assay at 60 °C; with the 63 °C mid-point as well it falls to 55 °C. Both are within one step of the published 55 to 60 °C, so the source is consistent with the double-count argument and does not prove it.
- A second check of the same argument: the half-life law itself reaches a half-life of one minute at 76.5 °C (30 min, 200 kJ/mol) and at 65 °C only if the half-life at 60 °C is 3 min. A mid-point of 63 °C beside a 30-minute half-life describes two different enzymes.
- S6 cannot support a longer half-life for capsules. On the model's law a 28-minute wash peaking at 63.9 °C leaves 40 to 53 % of a protease with a 30-minute half-life and 74 to 81 % of one with 90 minutes: no collapse either way.
- Searched and not found: any residual activity or half-life of a protease in a dishwashing liquor at 60 to 70 °C (web search, patent full-text search, Europe PMC). Finding 5 stands.

### 9.3 Whole washes with the repository's code

Settled standard load, official tier, level seed 1, simulation seed 1, the exposure of the anchoring's frozen water side (`97aa4d392843`, unchanged on disk). D: `anchored-v2.json`, 20 g. Capsule: `anchored-v2.owner-tablet.savinase.json`, 12.9 g (160 mg/L of protease at the peak).

| Auto as written (65 °C, 46 min) | Protease, peak to end of wash (mg/L) | Egg yolk left | Milk left | Egg items / milk glasses clean |
|---|---|---|---|---|
| D, registry values (30 min, 63 °C) | 99 to 18 | 56.6 % | 77.9 % | 0 of 17 / 0 of 7 |
| D, mid-point 75 °C | 99 to 18 | 24.6 % | 56.2 % | 0 / 0 |
| D, mid-point 75 °C, half-life 10 min (the registry minimum) | 98 to 1 | 76.3 % | 88.6 % | 0 / 0 |
| D, mid-point 75 °C, half-life 2 h | 99 to 61 | 1.6 % | 18.4 % | 0 / 0 |
| D, mid-point 75 °C, 170 kJ/mol | 99 to 20 | 20.3 % | 52.2 % | 0 / 0 |
| Capsule, registry values | 160 to 29 | 49.8 % | 73.9 % | 0 / 0 |
| Capsule, mid-point 75 °C | 160 to 29 | 17.8 % | 49.5 % | 0 / 0 |
| Capsule, mid-point 75 °C, half-life 90 min | 160 to 86 | 3.0 % | 23.9 % | 0 / 0 |
| Capsule, mid-point 75 °C, half-life 2 h | 160 to 98 | 2.7 % | 22.8 % | 0 / 0 |

The mid-point change more than halves the egg yolk left; the half-life range moves it between 2 and 76 %; no value of either makes one egg item or milk glass clean. `docs/research/auto-recommendation.md` has the same washes on the other candidate courses of the programme.

### 9.4 Tags changed

| Item | Was | Now |
|---|---|---|
| Capsule half-life default 5400 s | [ESTIMATED] | assumption; bracket 1800 to 7200 s, no default |
| `liq.proteaseEd` 170 kJ/mol | recommended | not supported; keep 200 |
| `enzymeTm` range 68 to 85 | [ESTIMATED from VERIFIED] | [ESTIMATED], 63 to 85 |
| "Roughly 50 to 100 % residual" for the newest variants | [ESTIMATED] | withdrawn |
| "The mean egg layer then clears" | [ESTIMATED] | contradicted by the whole wash |
| Capsule rows "as now" at 80 mg/L | [ESTIMATED] | wrong level: the owner sets give 160 mg/L |
| Savinase "optimal temperature 60 °C" (snippet) | [RECALLED] | [VERIFIED], Falkenberg et al. 2022, 5-minute assay |
