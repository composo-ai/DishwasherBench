# Spotless research dossier: performance-test standards, scoring, loading guidance and validation phenomena ("standards")

Author: standards specialist. Date: 2026-10-08. Status: complete first edition, built from open sources only.

---

## 0. How to read this dossier

### 0.1 Confidence tags

Every number carries exactly one tag.

| Tag | Meaning |
|---|---|
| [VERIFIED] | I read it this session in fetched source text (a PDF I extracted, or a page returned by the fetch tool). Where the text reached me only as a quoted excerpt in a search result, or through the fetch tool's own extraction of a page, I add "(excerpt)" or "(page extract)" after the tag. |
| [RECALLED] | From my own memory. The source was not opened. Treat as a lead, not a fact. |
| [ESTIMATED] | My own derivation. The derivation is shown next to the number or in the referenced equation. |

Sources are cited as `S#`; the list with URLs is in section 15.

### 0.2 Research limits (read before relying on the gaps)

1. **The standards themselves are paywalled.** I could read the tables of contents, forewords and a few early clauses of IEC 60436 Ed. 4.1 (2015+A1:2020) and Ed. 5 (2025), and the first 13 pages of EN 50242:2016 / EN 60436:2016. I could not read Annex A (tableware table), Annex C (soil quantities per item), Table 1 (drying) or Table 3 (cleaning) of the current editions. Everything about them below is assembled from open documents that quote or reproduce them: a US DOE/ENERGY STAR slide deck that transcribes the IEC scoring table, two NIST reports, the 2022/2023 European round robin report, the IKW detergent-test method, the EU Ecolabel test framework, a test-material supplier catalogue, and the EU regulation.
2. **ANSI/AHAM DW-1 and DW-2 are paywalled.** The AHAM grading rule, the soil list, the item-to-soil assignment and the cleaning-index formula are verified from DOE/ENERGY STAR documents. The gram quantities per item are not.
3. **The web-search allowance for this research ran out about one third of the way through.** After that I could only fetch URLs I already knew. Consequences: Consumer Reports and Which? test methods, and the Bosch, Miele, GE, Finish and Cascade loading pages, could not be opened and are [RECALLED]. The Australian IEC 60436 round robin report (2017), which contains a load-item table with masses, timed out on every attempt.
4. **I found no published controlled experiment that varies the loading pattern and reports standard cleaning scores.** The University of Bonn publication list (S30) contains consumer-behaviour, test-method and drying papers but no loading-pattern cleaning experiment. The best quantitative evidence on how geometry changes water delivery is the Birmingham EngD thesis (S16). Effect sizes in the phenomena checklist are therefore mostly [ESTIMATED] and are the main thing later real-world tests should measure.

### 0.3 Cross-links

| Topic | Owner |
|---|---|
| Tub, racks, arms, pump, filter, programme sequences | machine |
| Jet flight, impingement, splash | jets |
| Film flow, wetting, drainage, pooling, dripping | films |
| Soil adhesion, swelling, removal kinetics | soils |
| Detergent D/E composition, enzymes, bleach, redeposition chemistry, drying physics | chemistry |
| Item geometry, masses, friction, flipping | items |
| LLM benchmark protocol, human baseline | benchmark |
| Solver choice and cost | numerics |

Where I give a number that another specialist owns, I say so with `[-> name]`.

---

## 1. Executive summary

1. **The scoring scale the industry uses is simple and simulator-computable.** IEC 60436 scores every item 0 to 5 from two observables: the number of small dot-shaped soil particles and the total soiled area in mm² (thresholds 4, 20, 50 and 200 mm² in the transcription I could verify). The item gets the lower of the two sub-scores. Drying is scored 0, 1 or 2 from drop and streak counts. A simulator that outputs a residual-soil map per item at about 1 to 2 mm resolution, plus a count of redeposited specks and a wetness map, can apply the real table directly.
2. **A real, compliant machine does not clean everything in the standard test.** In the 2022/2023 European round robin (17 labs), mean item scores were 3.5 to 3.7 for the old reference machine, 3.8 to 3.9 for the new one and 4.15 for a current Bosch eco programme. By item class: cutlery 4.6 to 4.8, melamine 4.2 to 4.4, crockery 2.3 to 3.7, glass 2.3 to 4.0, pots 2.5 to 4.0. This is the calibration target for a "standard load, correct loading" run and it means a Spotless level can be honest: some hard soils fail even when loaded well.
3. **Lab reproducibility sets the accuracy worth chasing.** Within-lab repeatability of the mean cleaning score is about 0.08 to 0.10 score points (2.2 to 2.9 %); between-lab reproducibility is 0.18 to 0.28 points (5 to 7 %). A simulator that lands within about 0.3 points of a measured class mean is as good as a second laboratory.
4. **The Edition 4 test load can be reconstructed.** The class-mean statistics in the round robin are exact fractions with denominators 37, 64, 19, 8 and 8 (12 place settings) and 40, 69, 21, 8 and 8 (13 place settings). That pins the load at 10 items per place setting plus 10 serving pieces: 130 items for 12 place settings, 140 for 13, 150 for 14.
5. **Standard soils are seven foods, oven-dried.** Milk (microwaved in glasses), tea (in cups, mugs, saucers), minced meat with egg, egg yolk, oat-flake porridge, spinach and margarine; everything except the margarine platter is dried 2 h at 80 °C in a thermal cabinet. Typical loading is 3 g of wet soil per plate (about 10 to 12 mg/cm²). The detergent-industry IKW method bakes harder (120 to 140 °C) and is a ready-made "hard mode".
6. **Water reaches most of the load as falling film, not as jets.** Positron-tracking in a real machine showed coherent straight jets, direct impingement on a given spot for well under 10 % of the time (1.6 % in the worked example), film shear of 0 to 2 Pa against 5 to 50 Pa under jets, and egg-yolk removal governed by pH, temperature, enzyme level and how often a spot is hit, with shear magnitude statistically insignificant above a threshold. This supports a time-homogenised jet-statistics architecture with a chemistry-led soil model.
7. **Loading effects the simulator must reproduce are mostly geometric line-of-sight, drainage and chemistry-delivery effects.** Section 9 lists 48 phenomena with mechanisms, expected direction and size, evidence and an A/B test design.
8. **Proposed definition of "clean".** An item is clean when every assessed surface scores 4 or 5 on the IEC scale (at most 4 specks and at most 4 mm² of visible soil in total) and it holds no pooled dirty water. Section 10 gives the algorithm, visibility thresholds and a stricter "spotless" tier.

---

## 2. The standards landscape

### 2.1 Which document does what

| Document | Region / owner | What it defines | Status | Conf. / source |
|---|---|---|---|---|
| IEC 60436 Ed. 3 (2004) + A1:2009 + A2:2012 | International | Separate cleaning and drying tests, reference machine, 0 to 5 cleaning scale | Superseded | [VERIFIED] S3, S4 |
| EN 50242:2008 / EN 60436:2008, then EN 50242:2016 / EN 60436:2016 | EU (CENELEC) | European adoption of IEC Ed. 3 with common modifications. The 2016 edition introduced the combined cleaning and drying assessment and named the labelling programme "eco" | Superseded by EN 60436:2020 | [VERIFIED] S3 |
| IEC 60436 Ed. 4 (2015) + A1:2020; EN 60436:2020 | International / EU | Combined cleaning and drying in one run; new load items (stainless pots, coffee mugs, melamine items, glass bowl); detergent type D (phosphate-free, percarbonate, more active enzymes); reference machine Miele G 1222 | In force for EU regulation until replaced | [VERIFIED] S1 |
| IEC 60436 Ed. 5 (2025-06, corrigendum 2026-04) | International | New reference machine; detergent type E (upgraded enzymes, less silicate); "alignment factor" so that results match Ed. 4; replacement pan and knives; updated item masses and tolerances; loading and handling instructions for test institutes; multi-compartment machines | Current IEC edition | [VERIFIED] S2 |
| Regulation (EU) 2019/2022 (ecodesign), 2019/2017 (label) | EU | Minimum cleaning performance index above 1.12 and drying index above 1.06 on the eco programme at rated capacity | In force since 1 March 2021 | [VERIFIED] S15 |
| ANSI/AHAM DW-1 (1992, 2009/2010, 2020), DW-2-2020 | US industry | Test load, soils, 0 to 9 grading, cleaning index | Current | [VERIFIED] S4, S5, S9 (by reference) |
| 10 CFR 430 Subpart B Appendix C1 / C2 | US DOE | Energy and water test with soiled loads (heavy, medium, light). Appendix C2 adds a validity rule: per-cycle cleaning index of 70 or higher | Current | [VERIFIED] S9, S10 |
| ENERGY STAR cleaning-performance test method (Rev. Feb 2014) | US EPA/DOE | Grades all items 0 to 9 per AHAM, computes cleaning index, defines soiled/clean alternation in loading | Published | [VERIFIED] S5 |
| ENERGY STAR dishwasher criteria (effective 19 July 2023) | US EPA | Standard machines (8 or more place settings plus 6 serving pieces): at most 240 kWh/year and 3.2 gallons per cycle, tested per Appendix C1. The criteria page states no cleaning-index threshold | Current | [VERIFIED] (page extract) S32 |
| IKW "Recommendations for the quality assessment of the cleaning performance of dishwasher detergents" Part B (2015 update, cover sheet Dec 2025) | German detergent industry | Seven single soils with exact recipes, baking and gravimetric or photo-catalogue evaluation (marks 0 to 10) | Current | [VERIFIED] S12 |
| EU Ecolabel "Framework for performance testing for dishwasher detergents" v1.1 (2018) | EU | Uses EN 50242/EN 60436 or IKW to prove detergent fitness for use | Current | [VERIFIED] S14 |
| AS/NZS 2007 | Australia / NZ | IEC-derived with 15 to 18 h air drying | Current | [RECALLED]; air-dry practice [VERIFIED] (page extract) S21 |

History that matters for interpretation: the original IEC 436 (1981) was abandoned as a labelling test because reproducibility was poor and it "did not discriminate well; the test was too easy resulting in a narrow band of high scores for most machines"; EN 50242 (1998) fixed this with tighter tolerances, a reference machine, a new reference detergent, oven-dried soils and revised scoring [VERIFIED] S7. The US test is described by NIST as "a re-deposition test involving a large amount of soils whereas the international test is one of adhesion" [VERIFIED] S7. Both aspects are needed in Spotless: adhesion-limited residues on the soiled item and redeposited specks on other items.

### 2.2 Consumer test organisations

| Organisation | Method summary | Conf. / source |
|---|---|---|
| Stiftung Warentest (Germany) | Overall grade weights: eco programme 20 %, automatic programme 20 %, short programme 20 %, handling 20 %, safety and build 10 %, noise 10 %. Machines are loaded with the maker's stated maximum number of standard place settings (pots, porcelain, glasses, bowls, cutlery; some porcelain replaced with plastic). Standardised soil; commercial single-function tabs; rinse aid and salt per the norm. Drying is judged 30 minutes after programme end, then cleaning. The automatic programme is also run with heavy soil and with a half load | [VERIFIED] (page extract) S23 |
| CHOICE (Australia) | Equal measured amounts of steam-baked oats, egg yolk, spinach, baby cereal, butter, tomato juice and tea on standardised crockery; egg yolk on cutlery; soiled items dry 15 to 18 hours and are not rinsed; modified IEC draft load with salad bowls, saucepans and more plastics. Rating weights: washing 65 %, drying 25 %, energy 10 %. Drying judged 30 minutes after the cycle, door closed unless the machine opens it | [VERIFIED] (page extract) S21 |
| Reviewed (US) | In-house stains: cooked egg, meat, pureed spinach, milk, baked-on cheese and others, baked on in an oven; 15 to 20 soiled dishes per cycle on quick, normal and heavy cycles, loaded per the maker's directions. Cleaning is the percentage of each stain removed, hand-measured. Average machines remove over 90 %, excellent ones over 99 %, poor ones 80 to 90 %. "Most users consider a plate dirty if more than 1 % of a stain remains." Redeposit is recorded and attributed to filtration. Location-dependent results are recorded and attributed to spray-coverage gaps | [VERIFIED] (page extract) S22 |
| Consumer Reports (US) | About ten place settings with baked-on food left overnight; cleanliness measured by imaging; drying judged on plastic items; noise; cycle time | [RECALLED]; "plastic items are harder to dry than glass or ceramic" [VERIFIED] (page extract) S36 |
| Which? (UK) | Full load with dried-on standard soils, main and eco programmes, cleaning and drying scores | [RECALLED] |

---

## 3. Test conditions

### 3.1 European / IEC conditions

| Parameter | Value | Conf. / source |
|---|---|---|
| Ambient temperature | (23 ± 2) °C | [VERIFIED] S3 clause 5.5; S11 sec. 9.1.5 (range 21 to 25 °C) |
| Relative humidity (oven-dry method) | (55 ± 5) % | [VERIFIED] S3; S11 sec. 9.1.4 |
| Cold water inlet | (15 ± 2) °C; no hot fill for EU labelling | [VERIFIED] S3 clause 5.6.2; S11 sec. 9.1.2 (13 to 17 °C) |
| Water hardness (machines with softener) | (2.5 ± 0.5) mmol/L Ca+Mg | [VERIFIED] S3 clause 5.6.3; S11 sec. 9.1.1 |
| Water pressure | 2.2 to 2.6 bar (240 ± 20 kPa) | [VERIFIED] S11 sec. 9.1.3 |
| Supply voltage | 230 V ± 1 % | [VERIFIED] S3 clause 5.3 |
| Programme under test | "eco", at rated capacity | [VERIFIED] S3 clause 5.4; S15 |
| Conditioning | At least three complete cycles with reference detergent and rinse aid before testing | [VERIFIED] S3 clause 5.2 |
| Number of test runs | At least five on test machine and reference machine, run in parallel; up to eight if the spread is too large; no cleaning of the machine between runs | [VERIFIED] S4 slide 12, S7, S34 |
| Tableware life | At most 200 soiled cycles; citric-acid normalisation cycle (30 g) after each series of five to eight cycles; ten conditioning cycles for new ware | [VERIFIED] S3 clause 6.2 |
| Evaluation lighting | Diffused light, colour temperature 3 500 to 4 500 K, 1 000 to 1 500 lux at the evaluation plane | [VERIFIED] S6 sec. 4.B (stated there to be "as specified in IEC Standard 60436") |
| Viewing time | At most 10 s per item for cleaning, 3 s per item for drying | [VERIFIED] S7 (EN 50242:1998) |
| Cool-down before loading | Oven-dried items cool about 30 to 40 minutes before the programme starts | [VERIFIED] S7 (30 min), S34 (about 40 min) |
| Drying assessment timing | 30 minutes after the end of the programme | [VERIFIED] S7 (door closed 30 min, EN 50242:1998), S23 |

### 3.2 Reference machines and programmes

| Machine | Role | Programme facts | Conf. / source |
|---|---|---|---|
| Miele G 590 class machine ("Type 1") | Reference in EN 50242:1998 to 2008 | not found | [RECALLED] |
| Miele G 1222 SC Reference ("Type 2", "old reference", loaded with 12 place settings) | Reference in EN 50242:2016 Annex N and IEC Ed. 4 | Target values: duration 97 min; main-wash maximum 52 °C (measured mean 50.5 °C); final-rinse maximum 67 °C (67.4 °C); water 14.3 L (14.3 to 14.4 L); energy 1.25 kWh (1.27 to 1.28 kWh) | [VERIFIED] S1 foreword; S11 secs. 9.2 and 9.3 |
| Miele G 7332 SC ("new reference") | Reference in IEC Ed. 5 | Duration 144 min (143.8 ± 0.9); main wash 45 °C (45.6 to 45.8 °C); final rinse 62 °C (62.3 to 62.5 °C); water 8.9 L (8.7 to 8.8 L); energy 0.87 kWh | [VERIFIED] S11 |
| Bosch SMV6ECX51E, eco programme (round robin test appliance, 13 place settings) | Example of a current EU machine | Duration 270 min; main wash 55 °C target (53.8 to 54.3 °C measured); final rinse 48 °C (47.4 to 47.9 °C); water 9.5 L (9.4 L); energy 0.71 kWh | [VERIFIED] S11 |
| Miele GSL, G 1223 SC "GSL 2", G 7333 "GSL 3" | Laboratory machines for IKW detergent tests | Standard test programme: no pre-wash, 45 °C main wash, 8 minute hold after reaching temperature, 55 °C rinse | [VERIFIED] S12 |

Expected cleaning performance of the old reference machine with oven-dried soils is specified as an average item score of 3.55 ± 0.20 [VERIFIED] S14 (quoting Annex N of EN 50242/EN 60436). The round robin measured 3.50 (detergent D) and 3.67 (detergent E) [VERIFIED] S11 Table 36. The two agree.

The three programmes above are a compact illustration of the time, temperature and chemistry trade ("Sinner circle"): 97 min at about 50 °C with 14.3 L scores 3.5; 270 min at about 54 °C with 9.5 L scores 4.15 [VERIFIED] S11 (different machines, so the comparison is indicative only).

### 3.3 Reference detergent, rinse aid, salt

| Item | Value | Conf. / source |
|---|---|---|
| Detergent types | A: classic high-alkaline. B: compact, the EU labelling detergent under EN 50242. D: phosphate-free, percarbonate bleach, "more active enzymes" (IEC Ed. 4). E: "upgraded enzymes and a lower content of silicates" (IEC Ed. 5) | [VERIFIED] S12 (A, B, D), S1 (D), S2 (E), S34 (B to D change) |
| Type D composition (mass %) | Sodium citrate dihydrate 30.0; maleic/acrylic copolymer 12.0; sodium percarbonate 7.0; TAED 2.0; sodium disilicate 10.0; fatty alcohol ethoxylate 2.0; protease 1.0; amylase 0.5; sodium carbonate to 100 | [VERIFIED] S37 (IEC 60436:2015/COR1:2020, text extracted by the chemistry specialist) `[-> chemistry sec. 1.1]` |
| Dose, EN 50242:2016 with detergent B | As recommended by the machine maker, not more than 2.5 g per place setting for machines of 10 or more place settings (3.0 g below 10). Without a recommendation: 2.0 g per place setting (2.5 g below 10). So 24 to 30 g at 12 place settings | [VERIFIED] S3 clause 5.7 |
| Dose, IEC Ed. 5 with detergent E | 8 g + 0.5 g per place setting loaded for machines of 8 or more place settings (14.5 g at 13); 8 g + 0.7 g per place setting below 8 | [VERIFIED] S37 (IEC 60436:2025/COR1:2026 clause 5.7 Formula (1)) `[-> chemistry sec. 1.2]`; consistent with labs splitting detergent E into portions of about 15 g, S11 Table 12 |
| Dose, IEC Ed. 4 with detergent D | not found in open text. 20 g is the dose the Ecolabel framework and IKW prescribe when type D is used in the IKW method | gap; 20 g [VERIFIED] S12, S14 |
| Detergent placement | In the dispenser, main compartment unless the maker says otherwise; dispenser clean and dry | [VERIFIED] S3 clause 5.7 |
| Rinse aid | Formula III (acidic) for EU labelling; setting 3 in the Ecolabel framework | [VERIFIED] S3 clause 5.8, S14 |
| Hardness in the wash, IKW | 8 to 10 °dH (1.4 to 1.8 mmol/L) | [VERIFIED] S12 |
| Synthetic hard water for preparing soils | 3.00 mmol/L Ca+Mg (16.8 °dH), pH 7.5, per IEC 60734 method B | [VERIFIED] S12 Box 1 |

### 3.4 US conditions

| Parameter | Value | Conf. / source |
|---|---|---|
| Ambient (AHAM DW-1-1992) | 21 to 27 °C, 25 to 60 % relative humidity | [VERIFIED] S7 |
| Water supply temperature options | 140 °F (60 °C) ± 5 °F, 120 °F (49 °C) ± 2 °F, 50 °F (10 °C) ± 2 °F | [VERIFIED] S7, S9 |
| Water pressure | 35 ± 2.5 psi (241.3 ± 17.2 kPa) | [VERIFIED] S7 |
| Water hardness | 0 to 85 ppm as CaCO3 | [VERIFIED] S6, S7 |
| Detergent (current DOE procedure) | Cascade with the Grease Fighting Power of Dawn or Cascade Complete Powder. By fill volume: 0.25 % of the mass of water in the pre-wash fill and in the main-wash fill. Alternatively by number of place settings per AHAM DW-1-2020 sec. 2.10 | [VERIFIED] S9; per-place-setting gram values not found |
| Detergent (AHAM DW-1-1992 performance test) | 0.5 % of the mass of water in an average fill; the DOE energy test used half of that | [VERIFIED] S7, S8 |
| Rinse aid | None in DOE and ENERGY STAR tests; used in AHAM performance tests | [VERIFIED] S5, S4 slide 33 |
| Soil drying | Soiling completed within 1 h; 2 h air drying starts after the oatmeal is applied; then the load is stacked and loaded | [VERIFIED] S7, S4 slide 14 |
| Runs | At least 3 | [VERIFIED] S4, S7 |

---

## 4. Standard soils

### 4.1 IEC 60436 / EN 60436 soils

The seven soiling agents are milk, tea, minced meat, egg, oat flakes, spinach and margarine [VERIFIED] S1 (clauses 6.4.2 to 6.4.8), S4 slide 13, S7, S34.

What I could verify about each:

| Soil | Verified facts | Not verified (working default for the simulator) |
|---|---|---|
| Milk (on glasses) | UHT milk only for EU labelling. 13 of 16 labs use 1.5 % fat. Dosed with a 10 mL pipette. Six glasses at a time on a 160 mm diameter circle on the microwave turntable. Oven is pre-heated with six glasses of 50 mL water for 4 min at 780 W then 10 min at 150 W. After cooking, the colour at the bottom of the glass must be between shade 4 and shade 6 of a shade chart and no small area of skin darker than shade 12. [VERIFIED] S3 clause 6.4.1, S11 sec. 8.4.1 | 10 mL of milk per glass, cooked on the same two-stage schedule [RECALLED]. The IKW variant is 10 mL baked 10 min at 450 W then 2 h at 80 °C [VERIFIED] S12 |
| Tea (on cups, mugs, saucers) | All 16 labs use Sir Winston "Broken Orange Pekoe" brewed with the test water. Cups are half-filled and pre-dried 1 h at 80 °C in the thermal cabinet, then the tea is emptied before the main drying. Ed. 4 pre-dries cups, mugs and saucers. [VERIFIED] S7, S11 sec. 8.4.3, S1 Figure 2 title | Brew strength and millilitres per item. IKW uses 30 g Assam per 2 L, 100 mL per cup [VERIFIED] S12 |
| Minced meat | Raw minced beef (Ed. 4 has a figure of the beef cuts) mixed with egg. Applied to half of the dinner plates and to serving bowls in the Ed. 3 AHAM-style load; to platters, glass bowls and pots in Ed. 4. [VERIFIED] S1 Figure 3 title, S4 slide 16, S34 Figure 3 caption | Ratio and grams per item. IKW: 225 g meat + 75 g whole egg + 80 mL water, 3 g per 19 cm plate, 11.8 mg/cm² wet [VERIFIED] S12 |
| Egg | Egg yolk on dinner plates, dessert plates and forks. Ed. 4 computes the application quantity with a formula (clause 6.4.5.3 has its own symbols). [VERIFIED] S4 slide 16, S1 clause 3.2.1 title, S34 Figure 2 caption | Grams per item. IKW: 1.5 g on 140 cm², 750 ± 100 mg after denaturation and drying [VERIFIED] S12 |
| Oat flakes (porridge) | "Blütenzarte Köllnflocken" in all 16 labs. Recipe "conforming to EN 50242": 50 g oats, 250 mL milk (1.5 % fat), 750 mL water, boiled 10 min with stirring; 3 g of hot porridge brushed onto a 23 cm soup plate with the rim kept free, 10.6 ± 0.5 mg/cm². All labs boil or simmer 10 min after heat-up (15 to 19 min in total). Soup plates must be free of starch residue from previous tests (checked with Lugol's iodine). [VERIFIED] S13 sec. 6, S11 sec. 8.4.4, S3 clause 6.2 | Grams on spoons and on dessert bowls |
| Spinach | Frozen chopped spinach (Iglo in 10 of 16 labs) passed through a mincer with a 2 mm disc at 38 to 264 g/min, or freeze-dried spinach. Applied to half of the dessert plates and to serving bowls (Ed. 3); to plates, platters, glass bowls and pots (Ed. 4). [VERIFIED] S11 sec. 8.4.2, S4 slide 16, S34 captions | Grams per item |
| Margarine | On the oval platter. It is the only soiled item that does not go into the thermal cabinet; it is loaded last. [VERIFIED] S7, S4 slide 16 | Grams; whether knives carry margarine |

Drying and ageing protocol:

| Step | Value | Conf. / source |
|---|---|---|
| Oven drying method | Whole soiled load except the margarine platter: 2 h at 80 °C in a through-circulation thermal cabinet (Memmert in all 16 labs), loaded to a fixed plan so all items dry alike; a plan exists for up to 30 place settings | [VERIFIED] S7, S34, S11 sec. 8.2, S1 Figure 4 title |
| Air drying method | 15 to 18 h at controlled room conditions. Not permitted for EU labelling | [VERIFIED] S4 slide 16 note, S7 ("15 h"), S3 clause 5.5 |
| Effect of the choice | "The 15 h air drying method has the soils come off the plates in the pre-wash portion of the cycle. The 2 h oven dry method changes the adhesion of the soil and causes most soils to be released in the main wash." With a reference machine in parallel the two methods gave no significant difference in the index | [VERIFIED] S7 |
| Freshness | Soils prepared and applied on the day of the test; all soils for test and reference machine from one batch | [VERIFIED] S3 clauses 6.3, 6.4 |
| Preparation effort | About 2 h to soil, 2 h to dry, about 40 min to cool | [VERIFIED] S34 |
| Ballast soil | Ed. 4/5 Annex V defines a frozen ballast soil for testing intermittently recurring functions. Dose: 100 g for 10 or more place settings, 60 g below | Annex existence [VERIFIED] S1; dose [VERIFIED] (excerpt) S35 |

Item-to-soil assignment I could verify (Ed. 3.1, AHAM-style load as run by DOE) [VERIFIED] S4 slide 16:

| Item | Soil |
|---|---|
| Dinner plates | Half with minced meat and egg mixture, half with egg yolk |
| Bread and butter (dessert) plates | Half with egg yolk, half with ground spinach |
| Cups and saucers | Tea |
| Glasses | Milk, cooked dry in a microwave |
| Serving bowls | One with meat mixture, one with spinach; one dessert bowl with spinach |
| Serving platter | Margarine |
| Dinner forks | Egg yolk |
| Salad forks and dessert bowls | Oat flakes |

For the European Annex A load the soup plates (and soup spoons) carry the oat flakes [VERIFIED] S3 clause 6.2 for plates; spoons [RECALLED].

**Gap.** Annex C (Tables C.1 to C.4: grams per item for type A and type B items, serving pieces, and totals by rated capacity) was not readable. Buying IEC 60436:2025 closes this. Until then use the working quantities in section 13.3.

### 4.2 AHAM DW-1 soils (also the DOE and ENERGY STAR soils)

Soil materials: egg yolk, creamed corn, oatmeal (with milk), mashed potatoes, ground beef with tomato paste, raspberry preserves, peanut butter (AHAM only), tomato juice, coffee and coffee grounds [VERIFIED] S4 slide 13. The 1992 edition lists thirteen ingredients: corn, eggs, coffee grounds, ground beef mixture, margarine, milk, oatmeal, peanut butter, potatoes, preserves, salt, tomato juice, tomato paste [VERIFIED] S7.

| Item | Soil | Conf. / source |
|---|---|---|
| Dinner plates | Quarter sections of egg yolk, mashed potatoes, ground beef and tomato paste mix, and red raspberry preserves with coffee grounds | [VERIFIED] S4 slide 14 |
| Bread and butter plates, dessert bowls | Half sections of oatmeal and creamed corn | [VERIFIED] S4 |
| Coffee cups and saucers | Coffee | [VERIFIED] S4 |
| Glasses | Tomato juice | [VERIFIED] S4 |
| Serving bowls and spoons (AHAM only) | One with creamed corn, one with mashed potatoes | [VERIFIED] S4 |
| Knives and serving platter (AHAM only) | Peanut butter (applied to knives) | [VERIFIED] S4 |
| Spoons (AHAM only) | Half with creamed corn, half with oatmeal | [VERIFIED] S4 |
| Forks and serving fork (AHAM only) | Egg yolk | [VERIFIED] S4 |

Drying: 2 h in room air after the oatmeal is applied [VERIFIED] S4, S7. Applying a single soil per plate instead of four quadrants cut preparation time by about 60 % "without significant changes in results" [VERIFIED] S4 slide 47.

DOE soil loads for a standard machine (8 place settings plus 6 serving pieces): heavy = 4 soiled and 4 clean place settings; medium = 2 soiled and 6 clean; light = half the soil of one place setting and 7 clean. Flatware and serving pieces are not soiled in the DOE loads [VERIFIED] S8, S4 slide 11, S10. The US field weighting behind this is 62 % light, 33 % medium, 5 % heavy soil loads [VERIFIED] S8.

**Gap.** Gram quantities per item (AHAM DW-1 section 2.6.3 / 5.5) not found in open text.

### 4.3 IKW single soils (detergent industry; a ready-made "hard mode")

All from S12 [VERIFIED]. Six items of each soil per run; 50 g frozen ballast soil added with the detergent; at least three runs; filter cleaned after every rinse cycle.

| Soil (class) | Substrate | Recipe and amount | Ageing | Evaluation |
|---|---|---|---|---|
| Black tea (bleachable) | Thick-walled white tea cups | 30 g Assam in 2 L boiling synthetic water with 0.1 mL ferric sulphate stock, 5 min brew. 100 mL per cup at 85 °C; 20 mL withdrawn every 5 min until empty; repeated once with fresh tea | At least 3 days in a climate room | Photo catalogue, marks to 10 |
| Milk in microwave (persistent, alkaline-sensitive) | 150 mL glass beakers | 10 mL low-fat UHT milk (1.5 %), baked 10 min at 450 W, six beakers at once | 2 h at 80 °C | Photo catalogue |
| Milk skin (optional alternative) | 250 mL tall beakers | 100 mL UHT milk (3.5 %) heated to 88 ± 2 °C, cooled to 30 to 35 °C, milk poured off under the skin | Overnight, then 2 h at 80 °C | Photo catalogue |
| Starch mix (amylase-sensitive) | Glass plates, 177 cm² inner area | 3.25 % suspension (0.8125 % each of potato, maize, rice and wheat starch) cooked 30 min at 95 °C; 20.4 g per plate | At least 48 h air, then 4 h at 80 °C. Dry film 619 to 708 mg (3.75 ± 0.25 mg/cm²) | Gravimetric, % removed |
| Pasta (amylase-sensitive) | Arzberg dinner plates, 25 cm | 80 g spaghetti boiled 8 min; 150 g cooked pasta blended with 200 mL water; 3.0 ± 0.1 g per plate, 2 cm rim left free | 2 h at 120 °C | Iodine staining, photo catalogue |
| Egg yolk (protease-sensitive) | Brushed stainless sheets 10 × 15 cm | 1.5 ± 0.1 g over 140 cm² | 4 h room air; 30 s in boiling water; 30 min at 80 °C; at least 24 h rest. 750 ± 100 mg per 140 cm² | Gravimetric |
| Minced meat (protease-sensitive, alkalinity helps) | Arzberg dessert plates, 19 cm | 225 g lean pork and beef, 75 g whole egg, 80 mL water, blended 2 min; 3 ± 0.1 g per plate, 11.8 ± 0.5 mg/cm² | 2 h at 130 °C | Phloxin B staining, photo catalogue |
| Crème brûlée (protease-sensitive, amylase helps) | Arzberg dessert plates, 19 cm | Ready mix heated to 60 °C; 3.5 ± 0.2 g per plate, 19.8 ± 1.1 mg/cm², 2 cm rim free | 2 h room air, then 2 h at 140 °C | Photo catalogue |

Ballast soil (25 kg batch, portions of 50 g, frozen): vegetable oil 31.6 %, margarine 6.3 %, lard 6.3 %, deep-frying fat 6.3 %, whole egg 15.8 %, cream 9.4 %, whole milk 6.3 %, potato starch 2.2 %, gravy 1.7 %, wheat flour 0.6 %, quark powder 0.6 %, benzoic acid 0.3 %, ketchup 6.3 %, mustard 6.3 % [VERIFIED] S12 Table 4.

Useful statements for calibration [VERIFIED] S13: meat dried at 120 °C "is harder to remove than the meat soil of EN 50242 dried at 80 °C"; with the old high-alkaline detergent A, egg-yolk removal "was of the same order of magnitude as the water value" (protease is what removes it); a medium detergent removes about 90 % of starch and the remaining 10 % is still clearly visible after iodine staining; photo-catalogue marks of 8 to 9 correspond to gravimetric removal "well above 95 %".

### 4.4 Dry-matter loadings implied by the recipes

| Soil | Wet loading | Dry loading | Conf. |
|---|---|---|---|
| Egg yolk (IKW) | 10.7 mg/cm² | 5.4 mg/cm² | wet [ESTIMATED] 1500 mg / 140 cm²; dry [ESTIMATED] 750 mg / 140 cm², both from [VERIFIED] masses |
| Starch mix (IKW) | 115 mg/cm² of 3.25 % suspension | 3.75 mg/cm² | [VERIFIED] S12 |
| Minced meat mix | 11.8 mg/cm² [VERIFIED] | about 2.5 mg/cm² | [ESTIMATED]: solids fraction (225 g × 0.27 + 75 g × 0.24) / 380 g = 0.21 |
| Porridge | 10.6 mg/cm² [VERIFIED] | about 0.9 mg/cm² | [ESTIMATED]: (50 g × 0.9 + 250 g × 0.1) / about 850 g after boiling = 0.08 |
| Pasta slurry | 3 g on about 250 cm² = 12 mg/cm² | about 1.8 mg/cm² | [ESTIMATED]: 150 g cooked pasta at 35 % solids in 350 g = 0.15 |
| Crème brûlée | 19.8 mg/cm² [VERIFIED] | about 6 to 7 mg/cm² | [ESTIMATED]: custard solids about 0.33 |

With dry density about 1.3 g/cm³ these are dry films of roughly 7 µm (porridge) to 50 µm (crème brûlée) [ESTIMATED]: thickness = loading / density. `[-> soils]` owns the mechanical properties.

---

## 5. The standard place setting and test loads

### 5.1 Edition 4 / 5 load, reconstructed

The round robin report gives class-mean cleaning scores per run. The minima and maxima of those per-run means are exact fractions k/N, which reveals the number of scored items N in each class [ESTIMATED] from [VERIFIED] data in S11 Tables 36 and 37:

| Class (as defined in S11 sec. 9.4.1.2) | N at 12 place settings (reference machines) | N at 13 place settings (test appliance) | Check values |
|---|---|---|---|
| Crockery: soup plates, dinner plates, dessert plates, mugs, cups, saucers, oval platter | 37 | 40 | 2.162 = 80/37; 4.081 = 151/37; 4.775 = 191/40; 0.725 = 29/40 |
| Cutlery: soup spoons, forks, knives, dessert spoons, teaspoons, serving cutlery | 64 | 69 | 4.328 = 277/64; 4.250 = 272/64; 4.044 = 279/69; 4.087 = 282/69 |
| Glass: glass bowl, dessert bowls, glasses | 19 | 21 | 1.368 = 26/19; 4.526 = 86/19; 1.667 = 35/21; 1.762 = 37/21 |
| Melamine: melamine dessert plates, melamine bowls | 8 | 8 | all values multiples of 0.125 |
| Pots: small pot and oven pot, each scored on inner bottom, inner wall, outer surface, overall | 8 assessments (2 items) | 8 assessments (2 items) | all values multiples of 0.125 |
| All | 136 assessments (130 items) | 146 assessments (140 items) | 4.375 = 595/136; 3.404 = 497/146; 2.911 = 425/146 |

The simplest composition I can find that is consistent with all ten denominators, with the item list in S11 and with the item codes seen in a search excerpt of the 2020 amendment (A1 dinner plate, A2 dessert plate, B1 soup plate, B2 melamine dessert plate, B3 saucer, B4 cup, A5/B5 glass, S1a/S1b pots, S3 oval platter) is:

| Group | Items | Count |
|---|---|---|
| Type A place setting (odd place settings) | Dinner plate, dessert plate, mug, glass dessert bowl, glass, and 5 cutlery pieces (knife, fork, soup spoon, dessert spoon, teaspoon) | 10 items |
| Type B place setting (even place settings) | Soup plate, cup, saucer, melamine dessert plate, glass, and the same 5 cutlery pieces | 10 items |
| Serving pieces (fixed) | Oval platter, glass bowl, 2 melamine bowls, small stainless pot, oven pot (pan), 4 serving cutlery pieces | 10 items |

Checks: 12 place settings = 6 A + 6 B gives crockery 18 + 18 + 1 = 37, glass 12 + 6 + 1 = 19, melamine 6 + 2 = 8, cutlery 60 + 4 = 64. Thirteen place settings = 7 A + 6 B gives crockery 21 + 18 + 1 = 40, glass 14 + 6 + 1 = 21, melamine 6 + 2 = 8, cutlery 65 + 4 = 69. All match.

So the nominal Edition 4 load is **10 × (place settings) + 10 items**: 130 at 12, 140 at 13, 150 at 14, 170 at 16 [ESTIMATED]. The assignment of individual items to "A" or "B" beyond the class totals is partly inferred; the class totals are firm.

Other verified facts: the new load includes stainless pots, coffee mugs, melamine plastic items and a glass bowl, chosen because they "provide different shapes which challenge a dishwasher water spray patterns" [VERIFIED] S1 foreword; it is 2.5 to 3 kg lighter than the old load [VERIFIED] S34; loads must match the tabulated mass within ± 5 % [VERIFIED] (excerpt) S35; Ed. 5 updated several item masses and replaced the pan and the knives because production stopped [VERIFIED] S2.

### 5.2 Edition 3 / EN 50242 load

Eleven items per place setting (dinner plate, soup plate, dessert plate, cup, saucer, glass, knife, fork, soup spoon, dessert spoon, teaspoon) plus seven serving pieces (oval platter, two serving bowls, two serving spoons, serving fork, gravy ladle) [RECALLED]. That gives 139 items at 12 place settings, which equals the number of scored items per run in the DOE IEC example data (every reference-machine column of S4 slide 26 sums to 139) [ESTIMATED] from [VERIFIED] counts.

### 5.3 Item specifications

From the test-material supplier catalogue S17 [VERIFIED] (page extract) unless marked. The catalogue does not say which standard each item belongs to; the mapping in the last column is mine.

| Item | Make and article | Size | Standard load it belongs to |
|---|---|---|---|
| Dinner plate | Arzberg (now Rosenthal) style 2000 | 250 mm; 530 g, white [VERIFIED] (excerpt) S35 | IEC A1; also IKW pasta plate (no. 10225) |
| Soup plate | Arzberg 1382 | 230 mm | IEC B1 |
| Dessert plate | Arzberg 8500, style 2000 | 190 mm | IEC A2; IKW plate no. 10219 |
| Cup | Arzberg 1382, white | 0.21 L | IEC B4 |
| Saucer | Arzberg 1382, white | 140 mm | IEC B3 |
| Coffee mug | SOLO model 8000 | 0.30 L | IEC type A |
| Glass | Schott DURAN beaker, tall form, without spout | 250 mL, 60 mm diameter | IEC A5/B5 |
| Dessert bowl ("fruit bowl") | Corning/Comcor (Corelle) no. 6003899 | 10 oz; about 130 mm, glass [VERIFIED] (excerpt) S35 | IEC type A; AHAM |
| Melamine dessert plate | WACA "1924", white | 195 mm | IEC B2 |
| Melamine bowl | WACA "1926", white | 213 mm | IEC serving |
| Glass bowl | Schott DURAN | 1.5 L | IEC serving |
| Oval platter | Arzberg 1382, white | 320 mm | IEC S3 |
| Small pot with lid | WMF Gourmet Plus, stainless | 160 mm diameter | IEC S1a |
| Oven pan mini | WMF | 160 mm diameter | IEC S1b |
| Fork | WMF Signum 12.1905.6040 | 188 mm | IEC; DOE alternate dinner fork |
| Soup spoon | WMF Signum 12.1904.6040 | 190 mm | IEC; DOE alternate serving spoon |
| Table knife | WMF Gastro 12.0803.6047 (discontinued); Lusini Madrid replacement | 209 mm; 215 mm | IEC; DOE alternate knife |
| Dessert spoon | WMF Signum 12.1910.6040 | 156 mm | IEC; DOE alternate teaspoon |
| Teaspoon | WMF Signum 12.1907.6040 | 136 mm | IEC |
| Cake / salad fork | WMF Signum 12.1964.6040 | 157 mm | DOE alternate salad fork |
| Table fork (large) | WMF Signum 12.1902.6040 | 210 mm | DOE alternate serving fork |
| Serving spoon | WMF 12.8386.6041 | 260 mm | IEC serving |
| Serving fork | WMF 12.8393.6040 | 190 mm | IEC serving |
| Gravy ladle | WMF 12.8395.6040 | 180 mm | IEC serving |
| Corelle dinner plate | Corelle no. 6003893 (catalogue item 5256294) | 10 in (254 mm) | AHAM / DOE |
| Corelle bread and butter plate | no. 6003887 | 6.75 in (171 mm) | AHAM / DOE |
| Corelle cup | no. 6014162 | 8 oz | AHAM / DOE |
| Corelle saucer | no. 6010972 | 6 in (152 mm) | AHAM / DOE |
| Corelle serving bowl | no. 6003911 | 1 qt (950 mL) | AHAM / DOE |
| Corelle platter | no. 6011655 (oval 9.5 in); round 8.5 in also listed | 241 mm | AHAM / DOE |
| Iced-tea glass | Libbey 551 HT | 12 fl oz (355 mL), clear, unpatterned [VERIFIED] S7 | AHAM / DOE |

Corelle and Arzberg article numbers for the US load are from the regulation text S9 [VERIFIED]. Masses other than the dinner plate were not verified `[-> items]`. In the round robin 87.5 % of labs buy porcelain from the same supplier and the average ware set had seen 117 soiled cycles (range 13 to 200) [VERIFIED] S11 sec. 8.3.

### 5.4 AHAM / DOE load

Standard machine: eight place settings plus six serving pieces; compact: four plus six [VERIFIED] S10. AHAM performance tests use at least 10, usually 12 place settings [VERIFIED] S4 slide 11, S7. The item types in a place setting are a dinner plate, bread and butter plate, fruit bowl, cup, saucer, glass and flatware [VERIFIED] S7, S9. The flatware count per setting (knife, dinner fork, salad fork, two teaspoons) is [RECALLED]. Twelve place settings with six serving pieces gave 138 scored items in the DOE AHAM example (the columns of S4 slide 24 sum to 138) [ESTIMATED] from [VERIFIED] counts, which is consistent with 11 items per place setting.

### 5.5 Reference loading plans that are public

| Plan | Content | Conf. / source |
|---|---|---|
| IEC reference machine | Annex I.4 "Reference machine loading plan" exists; not readable | [VERIFIED] existence only, S1 |
| Manufacturer plan for test institutes | Every EU manual carries a loading diagram for the rated capacity; Ed. 5 adds "new requirements for the loading and handling instructions for tests institutes" | [VERIFIED] S2 for the Ed. 5 statement; diagram practice [RECALLED] |
| IKW plan (Miele GSL 2) | Upper basket: tea cups and milk beakers alternating along both sides, six egg-yolk sheets in the middle next to the spray-arm feed. Lower basket: rows of six pasta, six starch, six minced-meat and six crème brûlée plates, each row padded with two to four clean plates at the ends | [VERIFIED] S12 Fig. 1 (text layer of the figure) |
| ENERGY STAR alternation | Clean items loaded first, then soiled. Heavy load: alternate clean and soiled items. Medium: one soiled item after every two clean ones. Light: the soiled item near the middle of its group (fourth or fifth dinner plate). Similar items consecutive with no empty rack positions between them. Items next to an empty position must be clean | [VERIFIED] S5 sec. 5.1.D |
| Thermal cabinet | Soiled items are arranged in the drying cabinet to a fixed plan so that all dry alike | [VERIFIED] S34, S1 Figure 4 title |

How much consumers actually fit: in a UK study of 150 participants, owners of full-size machines loaded on average 96 % of the EN 50242 items [VERIFIED] (page extract) S29.

---

## 6. Scoring scales and indices

### 6.1 IEC cleaning score (0 to 5 per item)

As transcribed by the US DOE from IEC 60436 Ed. 3.1 [VERIFIED] S4 slide 20:

| Number of soil particles n | Total soiled area A (mm²) | Score |
|---|---|---|
| n = 0 | A = 0 | 5 |
| 0 < n ≤ 4 | 0 < A ≤ 4 | 4 |
| 4 < n ≤ 10 | 4 < A ≤ 20 | 3 |
| 10 < n | 20 < A ≤ 50 | 2 |
| not applicable | 50 < A ≤ 200 | 1 |
| not applicable | 200 < A | 0 |

Rule: "Lowest score based on number of particles or soiled area is assigned to each item" [VERIFIED] S4. In equation form, for item j:

s_j = min( S_n(n_j), S_A(A_j) )  (E1)

with S_n(n) = 5 if n = 0; 4 if 1 ≤ n ≤ 4; 3 if 5 ≤ n ≤ 10; 2 if n > 10, and S_A(A) = 5 if A = 0; 4 if 0 < A ≤ 4; 3 if 4 < A ≤ 20; 2 if 20 < A ≤ 50; 1 if 50 < A ≤ 200; 0 if A > 200 (A in mm²).

Notes.
- The standard speaks of "small dot-shaped" particles [RECALLED]; scores below 2 depend on area only, which DOE criticised: "IEC scoring tends to be lenient for items with a large number of small particles" [VERIFIED] S4 slide 22. DOE's "hybrid" variant keeps the area bands and uses particle breakpoints 3, 6, 9, 12 so that more than 12 particles scores 0 [VERIFIED] S4.
- Each item is viewed for at most 10 s [VERIFIED] S7 under 1 000 to 1 500 lux diffused light [VERIFIED] S6.
- Pots are scored on four surfaces (inner bottom, inner wall, outer surface, overall) [VERIFIED] S11.
- Ed. 4 carries this as Table 3 "Evaluation of the cleaning performance" and has an informative Annex H with alternate tables [VERIFIED] S1 (titles only). **I could not confirm that the area bands in Ed. 4/5 are identical to the Ed. 3.1 bands above.** My unaided memory offers a different banding (4, 50, 200 mm² and a percentage band) that I cannot source; treat the table as configurable data and confirm against a purchased copy.

### 6.2 IEC drying score (0 to 2 per item)

As described by NIST for EN 50242:1998 [VERIFIED] S7:

| Observation | Score |
|---|---|
| "Dry": completely free of moisture | 2 |
| "Intermediate": one or two drops, or one wet streak | 1 |
| "Wet": more than two drops, or one drop and one streak, or two streaks, or water in a glass or cup cavity | 0 |

Each item is inspected for at most 3 s [VERIFIED] S7. Ed. 4 adds a wet-area criterion (about 50 mm² separating scores 1 and 0) [RECALLED]. The round robin reports drying on a 0 to 1 scale (mean score divided by 2) [ESTIMATED] from the reported values, all of which lie in 0 to 1, S11 Table 41.

### 6.3 Indices

Per-run cleaning result of a machine (mean item score) [VERIFIED] S4 slide 25:

C = ( N_1 + 2 N_2 + 3 N_3 + 4 N_4 + 5 N_5 ) / N_tot = (1 / N_tot) Σ_j s_j  (E2)

Cleaning performance index against the reference machine run in parallel, over n runs [VERIFIED] S4 slide 25, S15 Annex III:

ln I_C = (1/n) Σ_{i=1..n} ln( C_T,i / C_R,i ),  I_C = exp(ln I_C)  (E3)

C_T,i and C_R,i are the test-machine and reference-machine results of run i. The round robin computes the index as the geometric mean of the per-run ratios, which is the same thing [VERIFIED] S11 sec. 7.1.

Drying performance index [VERIFIED] S15 Annex III:

ln I_D = (1/n) Σ_i ln( D_T,i / D_R,t )  (E4)

D_T,i is the mean drying score of the test machine in run i; D_R,t is the target drying score of the reference machine. S11 evaluates a fixed value of 0.82 on the 0 to 1 scale as one option [VERIFIED] S11 Table 45.

EU requirements from 1 March 2021 [VERIFIED] S15 Annex II: I_C > 1.12; I_D > 1.06 for machines above 7 place settings; I_D > 0.86 for 7 or fewer. Verification tolerance: the measured I_C may not be more than 14 % below the declared value, I_D not more than 12 % below [VERIFIED] S15 Annex IV.

Consequence: with the old reference machine at C_R of about 3.5, a machine needs a mean item score of at least about 3.92 to pass (1.12 × 3.5) [ESTIMATED]. Every machine legally sold in the EU therefore averages roughly 3.9 or better out of 5 on oven-dried standard soils at full rated load.

IEC also requires a confidence check on the index ("Assessing ln W_C", clause 7.3.4, with a t-factor table) and more runs if the interval is too wide [VERIFIED] titles only, S1; up to eight runs [VERIFIED] S34.

### 6.4 AHAM grading (0 to 9 per item, 0 is best)

[VERIFIED] S4 slide 19:

| Finding | Grade contribution |
|---|---|
| Particle ≤ 1/8 in (3 mm) | 1 per particle |
| Particle > 3 mm and ≤ 1/4 in (6 mm) | 3 per particle |
| Particle > 6 mm and ≤ 3/8 in (10 mm) | 7 per particle |
| Particle > 10 mm | 9 per particle |
| Glassware: spots or streaks | 1 if under 3/8 in, 3 if over |
| Glassware: rack contact marks | 1 if light, 3 if white |
| Cap | 9 per item |

Per-cycle cleaning index [VERIFIED] S5 Equation 1:

CI = 100 − ( 12.5 N_1 + 25 N_{2,3} + 50 N_{4,5,6} + 75 N_{7,8} + 100 N_9 ) / N  (E5)

N is the number of items in the load and N_g the number with grade g. Grade 0 "represents a completely clean item" [VERIFIED] S5. DOE Appendix C2: "A test cycle is considered valid if its cleaning index is 70 or higher" [VERIFIED] (page extract) S10. The ENERGY STAR draft used the same weights on IEC scores: CM = 100 − (12.5 N_4 + 25 N_3 + 50 N_2 + 75 N_1 + 100 N_0)/N [VERIFIED] S6 Equation 1. This gives a ready conversion from IEC item scores to a 0 to 100 load index.

### 6.5 IKW marks

Visual soils are marked against a photographic catalogue from "unwashed" to mark 10 (clean); gravimetric soils are reported as percent removed = 100 × (mass released) / (mass applied dry) [VERIFIED] S12.

---

## 7. Typical results and variability of real machines

### 7.1 European round robin 2022/2023 (EN 60436:2020, 17 laboratories)

Machines: NR = new reference (Miele G 7332 SC), OR = old reference (Miele G 1222 SC), TA = test appliance (Bosch SMV6ECX51E, eco). Detergents D and E. Four to five runs per lab. All values [VERIFIED] S11 Tables 36 to 45 and 60 to 63. Scores are means over all items of a run; "SD" is the standard deviation across runs and labs.

Overall cleaning score (0 to 5):

| Machine | Detergent | Runs | Mean | SD | Min | Max |
|---|---|---|---|---|---|---|
| NR | D | 40 | 3.824 | 0.252 | 3.353 | 4.381 |
| NR | E | 64 | 3.884 | 0.271 | 3.331 | 4.375 |
| OR | D | 35 | 3.508 | 0.200 | 3.015 | 3.993 |
| OR | E | 68 | 3.674 | 0.180 | 3.284 | 4.052 |
| TA | D | 37 | 4.140 | 0.427 | 2.911 | 4.799 |
| TA | E | 71 | 4.152 | 0.272 | 3.404 | 4.719 |

Cleaning score by item class (mean, SD in brackets):

| Class | NR, D | NR, E | OR, D | OR, E | TA, D | TA, E |
|---|---|---|---|---|---|---|
| Crockery | 3.20 (0.53) | 2.78 (0.66) | 2.30 (0.62) | 2.28 (0.39) | 3.68 (0.98) | 3.22 (0.70) |
| Cutlery | 4.71 (0.19) | 4.75 (0.19) | 4.60 (0.19) | 4.68 (0.17) | 4.67 (0.21) | 4.75 (0.19) |
| Glass | 2.43 (0.54) | 3.05 (0.67) | 2.30 (0.54) | 2.84 (0.62) | 3.43 (0.73) | 3.96 (0.63) |
| Melamine | 4.17 (0.55) | 4.38 (0.50) | 4.19 (0.57) | 4.24 (0.51) | 4.21 (0.66) | 4.32 (0.52) |
| Pots | 2.50 (0.80) | 3.51 (0.71) | 2.55 (0.68) | 3.54 (0.66) | 3.62 (0.88) | 4.03 (0.63) |

The class means reproduce the overall means when weighted with the item counts of section 5.1 (for OR, D: (37 × 2.302 + 64 × 4.595 + 19 × 2.301 + 8 × 4.186 + 8 × 2.553) / 136 = 3.507 against 3.508 reported) [ESTIMATED], which confirms the load reconstruction.

Precision of the overall cleaning score (outliers excluded):

| Machine, detergent | Labs | Repeatability s_r | s_r % | Reproducibility s_R | s_R % | Expanded uncertainty |
|---|---|---|---|---|---|---|
| NR, E | 16 | 0.095 | 2.4 | 0.279 | 7.2 | 15 % |
| OR, E | 17 | 0.080 | 2.2 | 0.182 | 5.0 | 10 % |
| TA, E | 15 | 0.093 | 2.2 | 0.200 | 4.8 | 10 % |
| NR, D | 10 | 0.092 | 2.4 | 0.261 | 6.8 | 14 % |
| OR, D | 9 | 0.100 | 2.9 | 0.199 | 5.7 | 12 % |
| TA, D | 8 | 0.172 | 4.1 | 0.351 | 8.4 | 17 % |

Cleaning index: current system (TA against OR, detergent D) mean 1.181, range 1.060 to 1.280; future system (TA against NR, detergent E) 1.067; hybrid 1.129. Between-lab s_R of the index 3.9 to 6.8 %.

Drying score (0 to 1 scale):

| Class | NR | OR | TA |
|---|---|---|---|
| Overall | 0.900 | 0.826 to 0.834 | 0.912 to 0.920 |
| Crockery | 0.83 | 0.67 to 0.69 | 0.79 to 0.80 |
| Cutlery | 0.99 | 0.99 | 0.99 |
| Glass | 0.90 to 0.91 | 0.88 to 0.89 | 0.93 to 0.95 |
| Melamine | 0.76 | 0.47 to 0.50 | 0.985 |
| Pots | 0.64 to 0.66 | 0.45 | 0.77 to 0.79 |

Drying precision: s_r 0.014 to 0.018, s_R 0.018 to 0.031, expanded uncertainty 4 to 7 %.

Additional machines contributed by the labs (11 models, identities hidden), mean cleaning score by rated capacity, detergent D / E:

| Place settings | Cleaning score D / E | Cleaning index (current system) | Drying score D / E |
|---|---|---|---|
| 7 | 4.36 / 4.44 | 1.245 | 0.72 / 0.70 |
| 10 | 4.46 / 4.47 | 1.277 | 0.90 / 0.89 |
| 13 | 4.40 / 4.56 | 1.253 | 0.91 / 0.91 |
| 14 | 4.12 / 4.24 | 1.196 | 0.94 / 0.93 |
| 17 | 3.51 / 3.47 | 1.032 | 0.84 / 0.85 |

"All appliances with 7 to 13 PS show similar cleaning score results with no significant differences. Significant differences are shown for the appliance with 17 PS and some of the appliances with 14 PS." [VERIFIED] S11 sec. 11.1.

Reading of these data for Spotless:
- **Cutlery is almost always clean** (4.6 to 4.8) even though it sits in the densest, most shadowed part of the load and carries egg yolk and porridge.
- **Glasses with microwaved milk, plates with oven-dried egg, meat, spinach and porridge, and pot interiors are where points are lost.** Scores of 2.3 to 3.7 mean that typical items in these classes leave 4 to 50 mm² of visible residue.
- **Detergent chemistry moves class scores by 0.4 to 1.0 points** (glass + 0.5 to 0.6 and pots + 0.4 to 1.0 with E; crockery − 0.4 with E on NR and TA).
- **Capacity pushed into the same cabinet costs cleaning.** The single 17-place-setting model scored about 0.9 points below the 13-place-setting models. One model only, so machine design is confounded with density.
- **Plastic and pots dry worst**; a machine with an advanced drying system brings plastic to 0.985.

### 7.2 US DOE development testing (2011, eight machines)

All [VERIFIED] S4 unless marked.

| Finding | Value |
|---|---|
| Typical cleaning index, DOE heavy load (4 of 8 place settings soiled) | 70 to 95 with all three grading methods |
| Typical cleaning index, AHAM test (all 12 place settings and serving pieces soiled) | 25 to 85 |
| Typical IEC-method results on US machines | AHAM grading 40 to 80; IEC performance index 0.75 to 1.75 |
| DOE light and medium loads | Index 95 to 98, "no test-to-test differentiation" |
| Example AHAM run, 138 items | Items with grade 0: 46, 49, 38 (33 %, 36 %, 28 %); items with grade 9: 34, 14, 30; index 62.5, 74.8, 63.5; machine average 66.9 |
| Example IEC run, 139 items, air-dried IEC soils, US reference machine | Per-run mean score 2.70, 2.60, 3.12, 2.18, 2.29; pooled score distribution 0: 21 %, 1: 7 %, 2: 16 %, 3: 23 %, 4: 17 %, 5: 16 % [ESTIMATED] by pooling the [VERIFIED] counts on slide 26 |
| Run-to-run index in that example | ln(P_C) per run 0.026, −0.044, −0.370, 0.273, 0.178: single-run ratios vary by ± 30 % |
| Source of variability | "variability from test-to-test corresponds more to variability in the cycle response triggered by the soil sensor than variability between graders" [VERIFIED] S33 |

Qualitative observations [VERIFIED] S4 slide 42, S6:
- "Tea stains are hardest to clean."
- "Spinach floats inside the unit, is re-deposited on most items, and accumulates on the filter." Coffee grounds behave the same way.
- "If oatmeal sticks to ware, it typically gets a score of 0" (IEC scale) or 9 (AHAM scale): starch residues are bimodal, either gone or covering a large area.
- "Serving bowls are not completely cleaned apparently due to the specified loading pattern."
- "Flatware items were typically completely clean, received scores of 5."
- "Loading pattern had minimal effect on the cleaning performance" in the DOE load (half the items clean, soils air-dried 2 h).

Industry evidence that low water volume leaves grease: after three consecutive normal cycles without filter cleaning, place settings from machines targeting 3.1 gallons per cycle carried "significantly more greasy residue" than those from a 4.1 gallon machine, and untrained viewers refused to eat off them; with adhered soils, a 5.0 gallon machine left "some particles" and a 3.1 gallon machine left dishes that "still looked dirty" [VERIFIED] S20 (qualitative, no scores, from an interested party).

### 7.3 What stays dirty, and where

| Observation | Conf. / source |
|---|---|
| By item class: glass (baked milk), crockery (oven-dried protein and starch), pots (inner surfaces) score lowest; cutlery highest | [VERIFIED] S11 |
| By soil: tea (bleach-limited) hardest; starch bimodal; spinach and coffee grounds redeposit | [VERIFIED] S4 |
| By position: uneven results between positions point to spray-coverage gaps; redeposit points to filtration | [VERIFIED] (page extract) S22 |
| Water moves slowest near the edges of the lower basket and at the lower wall; stagnant zones at wall heights below 100 mm and where packing is dense (heights 10 to 100 mm between large and small plates) | [VERIFIED] S16 secs. 4.4.2 and 4.7, S26 |
| One real lower arm covered a plate on the right of the rack with five jets and its mirror-image plate on the left with two | [VERIFIED] S16 sec. 5.6 |
| A radial band near 100 mm from the axis received no direct jet in that arm design; water arrived there only by splash and downfall | [VERIFIED] S16 sec. 4.4.1 |
| No published per-position cleaning map for a standard load was found | gap |

### 7.4 Field behaviour and satisfaction

| Finding | Conf. / source |
|---|---|
| German observation study, 19 households, 163 cycles: load by material is porcelain 45 %, glass 22 %, metal 17 %, plastic 16 % (cutlery excluded) | [VERIFIED] S18 |
| Same study: machines run full in 52 % and almost full in 42 % of cycles; a clear loading system in 63 %; no system at all in 7 % | [VERIFIED] S18 |
| Same study: contact-free loading "is never observed in practice"; bulky items are often placed over and touching other items | [VERIFIED] S18 |
| Same study: 77 to 90 % satisfied with cleaning; eco programme about 85 %. Complaints that always lower the rating: food residue on cutlery; residue or deposits on glasses. Drying: 67 to 70 % satisfied; complaints about plastic, coated pans and cup bases | [VERIFIED] S18 |
| Four-country study (Richter 2011): fewer than 40 % of loads use the full capacity; about 20 % of baskets are only slightly used; overfilling is more common in the upper basket | [VERIFIED] via S18, S19 (secondary) |
| UK: owners loaded 96 % of an EN 50242 load on average | [VERIFIED] (page extract) S29 |
| Sweden (Richter 2010): 11 % do not pre-treat, 31 % scrape, 51 % pre-rinse each dish; average pre-rinse water 11 L per cycle | [VERIFIED] via S19 (secondary) |
| Pre-rinsing makes no significant difference to consumers' cleaning satisfaction (Richter 2010) | [VERIFIED] via S18 (secondary) |
| Fewer than 5 % of consumers report dissatisfaction with cleaning results (Stamminger and Streichardt 2009); 36 % clean the filter (Belke et al. 2019) | [VERIFIED] via S19 (secondary) |
| US households: 62 % light, 33 % medium, 5 % heavy soil loads (the DOE weighting) | [VERIFIED] S8 |

---

## 8. Loading guidance: what is claimed, why, and how well it is supported

### 8.1 Claims and evidence

| Advice | Who says it | Physical mechanism | Evidence quality |
|---|---|---|---|
| Scrape, do not pre-rinse | German stakeholder forum "Forum Waschen" best practice [VERIFIED] via S18; America's Test Kitchen [VERIFIED] (page extract) S24; makers and detergent brands [RECALLED] | Loose soil is removed in the first fill anyway; pre-rinsing costs 0.3 to 62 L by hand [VERIFIED] via S19; sensor programmes shorten for pre-rinsed loads | Consumer study: no significant difference in satisfaction [VERIFIED] via S18. DOE: light and medium soil loads score 95 to 98 [VERIFIED] S4. The stated reason "detergents need some food to cling to" (S24) is not a physical mechanism; the real one is the soil sensor and wasted water |
| Soiled side toward the centre / toward the spray | Reviewed: big plates and bowls on the bottom "facing the spray" [VERIFIED] (page extract) S25; Bosch, Whirlpool manuals [RECALLED] | Direct jet impingement needs line of sight from a nozzle; the side facing away gets only falling film | Birmingham model: coverage depends most on nozzle-to-plate relative position and jet elevation [VERIFIED] S16. No scored A/B test found |
| Do not overlap or nest; leave gaps | S24: "Leave a little space around items, so food can't get stuck at pinch points"; MinuteFood [VERIFIED] (page extract) S27; Forum Waschen "contact-free" [VERIFIED] via S18 | Shadowing; capillary retention in gaps of a few mm | Birmingham: coverage efficiency plateaus once plate spacing exceeds about 20 mm [VERIFIED] S16 sec. 5.4.2. Consumers always let items touch [VERIFIED] S18 |
| Do not overload | S25; IChemE: "plates essentially create a series of small walls that block the cycle of water" [VERIFIED] (page extract) S26 | Lower mean spray access, more shadowing | 17-place-setting model scored 0.9 points lower [VERIFIED] S11 (confounded) |
| Cutlery: mix handles up and down, or do not let pieces nest; knives handle-up for safety | S24, S25, S27 | Nested spoons shield each other | MinuteFood's informal test: orientation does not matter, nesting does [VERIFIED] (page extract) S27. Cutlery scores 4.6 to 4.8 in the standard test [VERIFIED] S11 |
| Plastics on the top rack | S24: the top rack "usually gets less heat" | Distance from an exposed heater; light items are moved by lower-arm jets | [RECALLED] for the heater mechanism in makers' manuals. Plastics dry worst [VERIFIED] S11, S36 |
| Do not block the spray arms; spin them before starting; nothing hanging below the rack | S24, S25 | A stalled arm delivers jets to fixed lines only | IEC includes a spray-arm rotation check for the reference machine (Annex I.3.2 title) [VERIFIED] S1. No scored test found |
| Do not block the detergent dispenser; platters and trays at the side | S25: "place it on the side, so it's not blocking the spray arm or detergent dispenser" | Detergent not released, or released late, removes the chemistry | Egg yolk shows no removal without enzyme except at pH 11.5 and 55 °C [VERIFIED] S16 `[-> chemistry sec. 1.7]` |
| Large items at the sides and back | S24: baking sheets and boards "along the outer edge of the bottom rack" | Keeps the central spray cone and the door-mounted dispenser clear | Geometric; no scored test found |
| Alternate large and small plates | Makers' manuals [RECALLED] | Raises the effective gap seen by inclined jets over the upper part of large plates | Consistent with the spacing result in S16; no direct test found |
| Glasses and cups between tines, not over them | Makers' manuals [RECALLED] | Tine tips inside a glass leave contact marks and block jet entry | AHAM grades "rack contact marks on glassware" [VERIFIED] S4 |
| Cup-shaped items upside down, tilted | S24, S25 | Upward jets can enter; the item drains | IEC drying rule scores "water in glass or cup cavity" as 0 [VERIFIED] S7; cup bases are a field complaint [VERIFIED] S18 |
| Pots and pans face down on the lower rack; heavy soil on the lower rack or in the centre of the upper rack | S25; IChemE: the zones "immediately above the rotating arms" and "in the centre of the top shelf is where the jets of water exert their full force" [VERIFIED] (page extract) S26 | Strongest and most frequent jets | Jets land longer at small radius [VERIFIED] S16 |
| Load in a circle; starchy soils in the centre, protein soils at the edge | Press reports of the Birmingham work [VERIFIED] (page extract) S26, S31 | Arms sweep a circle inside a rectangular rack; starch needs mechanical action, protein needs time in alkaline, enzymatic liquor | The thesis states the circular versus rectangular mismatch and that "low radial locations are impacted for longer" [VERIFIED] S16. The carbohydrate/protein placement rule is a press paraphrase; I did not find it in the thesis |
| Fill the machine | S18, S28, S34 | Resource use per item; energy drops only about 10 % at half load [VERIFIED] S34 | Not a cleaning effect |

### 8.2 What the Birmingham work actually measured

All [VERIFIED] S16 (Pérez-Mohedano, EngD thesis 2016; Whirlpool DU750 with internal loading volume 560 × 500 × 620 mm; AHAM-style load of 12 dinner plates, 24 dessert plates, 12 cups, 12 glasses, 12 bowls).

1. Water follows a repeating sequence: pump and arm, ejection as a coherent jet, impact on a wall or item, downfall (over items, down walls or free fall), return to the sump. One pass takes "typically less than 3 seconds". Downfall over a plate takes tenths of a second.
2. Once ejected, a tracer travels in a straight line; arm rotation does not bend the path. "Specific locations are targeted from specific ejection points" and each location is hit "with a frequency related to the rotation rate of the spray arm". Continuous coverage of all areas by direct impingement is impossible.
3. Pump speed sets ejection velocity but has "no effect" on downfall velocity. With a load, downfall velocities collapse toward zero: "a low shear distribution over most of the crockery".
4. Most wetting happens under falling films with shear of 0 to 2 Pa; direct jets give 5 to 50 Pa.
5. Detergent did not measurably change the water motion.
6. A geometric model (straight jets, plates as vertical discs, arm at 30 to 35 rpm) defines for each nozzle and plate a time efficiency, a coverage efficiency and their product. Plate spacing of 20 to 30 mm is optimal for time efficiency and the combined efficiency plateaus above 20 mm. The two dominant design variables are how centred the nozzle path is under the plate and the jet elevation angle (optimum about 70 to 75° from horizontal). A plate leaning toward the oncoming jet is easier to hit than one leaning away.
7. For the real lower arm (ten nozzles at radii 89 to 238 mm) no nozzle reached a combined efficiency above 0.3 on either of two plates, most were below 0.2, three never touched the plate, and the right-hand plate was covered far better than the left.
8. The share of time a given soiled spot is under direct impingement ("frequency factor") was 1.59 % in the full-scale validation case and "less than 10 % in most cases".
9. For oven-dried egg yolk: swelling is driven by pH and temperature; removal by enzyme level, frequency factor and temperature; the magnitude of shear between 12 and 65 Pa was not statistically significant, suggesting a threshold below that range. No removal occurred without enzyme, except partial detachment at pH 11.5 and 55 °C.
10. A model that combined the geometric jet statistics with the lab removal rates predicted full-scale cleaning curves well in four of six cases.

### 8.3 What the Bonn group has and has not published

The household-technology group at the University of Bonn (Stamminger) is the main academic source on dishwashing behaviour. Its publication list [VERIFIED] (page extract) S30 contains:
- consumer-behaviour and resource studies (Richter 2010 and 2011; Bichler et al. 2015; Hook et al. 2018; Stamminger et al. 2019; Belke et al. 2018 and 2019; Alt et al. 2023, six countries; Schencking and Stamminger 2022 review);
- test-method work (Brückner, Schneider and Stamminger 2012, "A new place setting: consumer-relevant measuring unit for domestic dishwashers"; Brückner and Stamminger 2015, a test for automatic programmes; Gorny et al. 2016 on low-temperature dishwashing and detergent components; near-infrared soil detection, 2019 to 2021);
- drying (Rummler 2009 dissertation on a physical method for drying performance; Gorny et al. 2014 on simulating air-drying of soils in a thermal cabinet).

It contains no experiment that varies the loading arrangement and reports cleaning scores. The loading-related findings from this group that I could verify are behavioural: how full people load (section 7.4) and that people can fit 96 % of a standard load. One popular article names Stamminger as a consultant but attributes no specific loading advice to him [VERIFIED] (page extract) S27.

### 8.4 Reading across the guidance

Three things stand out when the advice is set against the measurements.
1. Almost every rule is a line-of-sight or drainage rule. None needs special-case logic if jets, shadows, films and pools are simulated.
2. The one rule that is not geometric, "do not block the dispenser", has the largest expected penalty per mistake, because chemistry and time dominate removal of dried protein and starch.
3. The evidence that arrangement matters is strongest for tenacious soils at full load. For lightly adhering soils in half-clean loads, DOE measured minimal sensitivity. Levels built on fresh soils will not reward loading skill; levels built on oven-dried or baked soils will.

---

## 9. Phenomena checklist (validation suite)

### 9.1 How to use it

Each entry is a real-world loading phenomenon that Spotless must reproduce **emergently**: no rule in the code may mention "bowl upside down" or "blocked dispenser". The test for each is an A/B pair of loads (or programmes) that differ in one respect.

Conventions.
- Baseline machine: the 60 cm, three-spray-level baseline `[-> machine]`, eco-like programme, enzyme detergent, IEC-type soils oven-dried 2 h at 80 °C unless stated.
- Δs: change in IEC item score (0 to 5, equation E1) on the affected item or surface, B relative to A.
- f_jet: fraction of circulation time a surface point is under direct jet impingement. Published values are 1.6 % for a favourably placed spot and "less than 10 % in most cases" [VERIFIED] S16.
- Every effect size is [ESTIMATED] unless tagged otherwise. The derivation is given in the "size" column. Until real tests exist, the pass criterion is: correct sign, and magnitude within a factor of two (or within ± 1 score point).
- "Negative controls" are phenomena where the correct answer is "little or no effect". They matter as much as the positive ones: a model that predicts dirt wherever there is no line of sight is wrong.

### 9.2 Group A: spray access and shadowing

| ID | Phenomenon | Mechanism | Direction and rough size | Evidence | A/B test |
|---|---|---|---|---|---|
| P01 | Hollow item loaded open side up | Jets travel upward from the arms and cannot enter. The item fills from falling water and is never emptied; liquor inside is not exchanged in the rinses | f_jet inside = 0. Retained liquid equals the brim volume (about 0.25 to 0.3 L for a glass or mug, [VERIFIED] capacities S17). Sediment and fat stay. Drying score 0 ([VERIFIED] rule S7). Chemistry-limited stains inside may still bleach or digest, so the failure is "holds dirty water", not necessarily "stain remains" | S24, S25 advice; S19 users found items that "collected dirty water" | Mug with tea film and bowl with porridge: inverted (A) against upright (B), same rack position |
| P02 | Soiled face turned away from the spray source | No line of sight from any nozzle to the soiled face; it is wetted only by splash and falling film at 0 to 2 Pa | f_jet on the soiled face drops to about 0. For oven-dried protein and starch Δs = −1 to −2. For air-dried or soluble soils Δs about 0. Reasoning: S16 finds removal rate depends on how often the spot is hit, and that films alone give low shear | S16; S25 "facing the spray" | Dinner plate with oven-dried egg yolk on one face: face toward the arm axis (A), same slot reversed (B) |
| P03 | Plate pitch too small | Time a nozzle spends under a gap scales with the gap d (t = d / (ω r)); an inclined jet with elevation ρ meets the neighbouring plate at height z = d tan ρ | Halving d from 20 to 10 mm halves dwell and halves the height reached by a 75° jet (75 mm to 37 mm). Δs = −0.5 to −1.5 on tenacious soil in the upper half of the plate. Above about 20 mm, more gap gains little | S16 sec. 5.4.2: efficiency plateau above 20 mm, optimum 20 to 30 mm [VERIFIED] | Row of eight soiled dinner plates at 12, 20 and 30 mm pitch |
| P04 | Nesting or "spooning" of like items | Overlapped surfaces have no line of sight; gaps below about twice the capillary length (2 × 1.8 to 2.7 mm, from sqrt(γ / (ρ g)) with γ = 0.03 to 0.072 N/m) hold liquid that does not exchange | Residual soil in the overlapped zone at least 50 %. If the overlapped soiled area exceeds 200 mm² the item scores 0. Drying score 0 on both items | S24 "When spoons 'spoon,' they trap food"; S27; Forum Waschen via S18 | Two porridge bowls nested with 2 mm gap (B) against separated by 25 mm (A) |
| P05 | Large flat item shadows what is behind or above it | A tray, board or platter intercepts every jet whose straight path crosses it | Items wholly inside the shadow lose all direct impingement from that arm. Δs = −1 to −3 for tenacious soils on faces served only by that arm; about 0 for easy soils | S24, S25 placement advice; S16 straight-line jets [VERIFIED] | Baking tray in the middle of the lower rack (B) against at the side wall (A); score plates behind it and upper-rack items above it |
| P06 | Spray arm stalled by an item | A utensil hanging below the rack or a tall item in the arm's path stops rotation. Jets then hit fixed lines | Direct coverage of the rack falls from the swept circle (about 70 % of a 560 × 500 mm rack for a 250 mm arm: π 250² / (560 × 500)) to the jet footprints (about 1 %: ten footprints of about 3 cm²). Mean score of that rack −1.5 or more for tenacious soils; items on the jet lines stay clean | S24 "give the spray arm a spin"; IEC reference-machine check "Checking spray arm rotation" [VERIFIED] S1 | Fork handle protruding 30 mm below the lower rack into the arm path (B) against none (A) |
| P07 | Radial position: centre against corner | The arm sweeps a circle in a rectangular rack. Dwell per pass falls with radius; corners lie outside the swept circle | Dwell at 40 mm radius is 6.3 times that at 240 mm (0.1667 s against 0.0266 s, [VERIFIED] S16 Table 5.5). About 30 % of the rack floor is outside the swept circle. Δs = −0.5 to −1 for tenacious soil in a corner against mid-radius; depends on outward-angled end nozzles | S16 "low radial locations are impacted for longer"; S26 | Same soiled bowl at rack centre, mid-radius and front corner |
| P08 | Left/right asymmetry with rotation direction | Nozzle angles are fixed in the arm frame; a plate face is met by approaching jets on one side of the machine and by receding jets on the other | In one real arm a right-hand plate received five jets and its mirror image two [VERIFIED] S16. Expect Δs up to 1 between mirrored positions for the same facing direction | S16 sec. 5.6 | Mirror the whole load about the front-to-back mid-plane |
| P09 | Lean direction of plates | A plate leaning toward the oncoming jet presents its face; one leaning away presents its back | Same sign as P02 at smaller size: Δs about ± 0.5 for a 10° lean | S16 Fig. 5.6 discussion [VERIFIED] | Soiled plate leaning 10° toward against 10° away from the arm axis |
| P10 | Tall narrow vessel interior | A jet enters only while a near-vertical nozzle passes under the opening. For a 60 mm opening at 150 mm radius that is 60 / (2π 150) = 6 % of a revolution per suitable nozzle, and only jets within atan(30/120) = 14° of vertical reach the base of a 120 mm deep glass | Interior base is the last place to clean. Standard glass class (baked milk in 250 mL beakers and bowls) scores 2.3 to 4.0 [VERIFIED] S11 | S11; S22 | 250 mL tall beaker against a shallow bowl, same baked-milk soil, same rack position |
| P11 | Upper against lower rack for tenacious soil | Which arm serves the surface, its share of flow, distance and whether jets are still coherent | Machine-dependent. In a three-level machine expect abs(Δs) ≤ 0.5; in a machine whose upper rack is served mainly from below, −1 or more. Makers sell lower-rack "intensive zones" with higher pressure [VERIFIED] S34 | S25, S26 advice | Same soiled plate in lower and upper rack |
| P12 | Alternating large and small plates | Above the rim of a small plate the gap seen by the large plates doubles | Δs = +0.3 to +0.5 on the upper zone of the large plates (from P03 scaling); no change on the small plates | Makers' manuals [RECALLED] | Large plates only at 15 mm pitch (A) against large/small alternating at the same pitch (B) |
| P13 | Glass or cup placed over tines | Tine tips touch the inside and sit in the jet path | Contact marks and wet spots at the contacts; interior f_jet reduced. AHAM adds 1 to 3 grade points per marked glass [VERIFIED] S4. Drying score −1 | S4 grading rule | Glasses between tines (A) against over tines (B) |
| P14 | Soiled face against the tub wall or door liner | Gap too small for jets; near-wall zone has the slowest water | As P02, plus slow exchange: stagnant zones at walls below 100 mm height [VERIFIED] S16 | S16 sec. 4.4.2 | Platter with soiled face 8 mm from the side wall (B) against facing inward (A) |

### 9.3 Group B: cutlery

| ID | Phenomenon | Mechanism | Direction and rough size | Evidence | A/B test |
|---|---|---|---|---|---|
| P15 | Nested spoons | Bowl-to-bowl gap under 1 mm over about 10 cm² traps soil and liquid | Shielded spoon scores 0 to 1 with porridge or egg; partner unaffected | S24, S25, S27 | Two porridge-soiled spoons in one cell, nested (B) against opposed (A) |
| P16 | Heads up against heads down (not nested) | Basket walls shadow the lower 60 to 100 mm; heads-down ends sit where drainage collects | Negative control: abs(Δs) ≤ 0.3 | Informal test found no difference [VERIFIED] (page extract) S27 | Twelve egg-soiled forks, heads up against heads down, one per cell |
| P17 | Crowded basket cells | Contact probability rises with pieces per cell | Share of cutlery not scoring 5 rises from about 20 % in the standard load ((5 − 4.7) / 1.5, assuming imperfect pieces average 3.5) to above 50 % with three or more like pieces per cell | S11 cutlery means; S25 | One, two and four like pieces per cell |
| P18 | Cutlery tray against basket | Separated slots prevent nesting; pieces lie nearly flat, so spoon bowls facing up hold water | Fewer nesting failures; drying score on face-up spoon bowls 0 | Geometry | Same pieces in tray and basket |

### 9.4 Group C: whole-load effects

| ID | Phenomenon | Mechanism | Direction and rough size | Evidence | A/B test |
|---|---|---|---|---|---|
| P19 | Loading beyond rated capacity | Smaller gaps, more shadowing, more soil per litre | Load mean −0.5 to −1 when 30 % more items are forced in. A 17-place-setting model scored 3.5 against 4.4 to 4.6 for 13-place-setting models [VERIFIED] S11 (one model; design confounded) | S11; S25; S26 | Rated load against rated + 15 % and + 30 % items |
| P20 | Total soil load | Chemistry is consumed, liquor carries more suspended soil, filter loads | US index 95 to 98 at light and medium soil, 70 to 95 with 4 of 8 place settings soiled, 25 to 85 with everything soiled [VERIFIED] S4 | S4 | Same geometry with 25 %, 50 % and 100 % of items soiled |
| P21 | Redeposition of particulates | Fibrous and granular soils circulate and settle on surfaces that face up or sit in slow zones, and in cavities | "Spinach floats inside the unit, is re-deposited on most items" [VERIFIED] S4. Expect more than half of otherwise clean items to carry 1 to 4 specks (score 4) when spinach or coffee grounds are in the load; fewer with finer filtration or more rinses | S4; S22; IEC Annex R filtration test with coffee grounds and spinach [VERIFIED] S1 | Load with and without 20 g minced spinach; count specks on initially clean items |
| P22 | Clean neighbours of soiled items | Transfer by splash and by contaminated liquor only | Small: in DOE loads (half the items clean) the index stays 70 to 95 and at lighter soil 95 to 98 [VERIFIED] S4 | S4, S5 loading rule | Alternate clean and soiled plates; score the clean ones |
| P23 | End-of-cycle drips from the upper rack | Water retained on upper-rack items and the rack drips onto lower items after the last drain | Lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2 of the 0 to 1 scale. Crockery dries to 0.67 to 0.83 against 0.99 for cutlery [VERIFIED] S11; the split between drips and own retention is my attribution | S11 | Lower-rack plates with and without a loaded upper rack |
| P24 | Arrangement does not matter for easy soils (negative control) | Air-dried, lightly adhering soils leave with the first wetting wherever they are | Rearranging which positions hold the soiled items changes the load index by less than run-to-run noise. "Loading pattern had minimal effect on the cleaning performance" [VERIFIED] S6 | S6 | DOE-style heavy load, three different soiled/clean orders |

### 9.5 Group D: chemistry delivery and programme

| ID | Phenomenon | Mechanism | Direction and rough size | Evidence | A/B test |
|---|---|---|---|---|---|
| P25 | Detergent dispenser blocked | The flap cannot open or the tablet cannot fall, so the main wash runs without detergent or gets it late | Protein soils: removal near zero ("No removal action was observed unless the enzyme was present" except at pH 11.5 and 55 °C, [VERIFIED] S16). Tea stays. Load mean −1.5 or more. If release is only delayed, loss scales with lost exposure time | S25; S16; S13 | Tall platter in front of the dispenser (B) against at the side (A) |
| P26 | Tablet trapped or dissolving in a dead spot | A tablet that lands in a cutlery basket, an upright bowl or a rack corner dissolves slowly and locally | Bulk concentration rises late; similar to under-dosing. Size unknown: calibration parameter | `[-> chemistry sec. 1.7]` | Tablet released onto the door (A) against dropped into an upright bowl (B) |
| P27 | Time and temperature trade | Hydration, enzymatic and bleach reactions need time; fat needs temperature | 270 min at 54 °C gave 4.15; 97 min at 50 °C gave 3.5 to 3.7 (different machines) [VERIFIED] S11. Short programmes fail on starch and protein with a weak detergent [VERIFIED] S18 | S11, S18, S34 | Same load on short, eco and intensive programmes |
| P28 | Bleachable stains are position-insensitive (negative control) | Tea film needs oxidant, temperature and time; any wetted position gets them | Tea cups in the best and worst spray positions differ by Δs ≤ 0.5; without bleach all fail. "Tea stains are hardest to clean" [VERIFIED] S4 | S4; S12 soil classes | Tea cups at centre and corner of the upper rack; repeat with bleach-free detergent |
| P29 | Ageing of the soil before the wash | Drying raises cohesion and adhesion; heat denatures and cross-links | Air-dried 15 to 18 h soils release in the pre-wash, oven-dried (2 h, 80 °C) in the main wash [VERIFIED] S7. Meat baked at 120 °C is harder than at 80 °C [VERIFIED] S13. Target: crockery mean at least 4.5 fresh, 2.3 to 3.7 oven-dried ([VERIFIED] band S11), at least 1 point lower again for 130 to 140 °C baking | S7, S12, S13 | Same load at three ageing levels |

### 9.6 Group E: soil-specific behaviour

| ID | Phenomenon | Mechanism | Direction and rough size | Evidence | A/B test |
|---|---|---|---|---|---|
| P30 | Protein soil responds to hit frequency and chemistry, not to jet strength | Swelling then enzymatic weakening; removal once a shear threshold is exceeded | Doubling pump pressure changes egg-yolk removal little; doubling enzyme level or hit frequency changes it clearly [VERIFIED] finding S16 | S16 | Egg-yolk tiles at fixed position: pump speed ± 30 % against enzyme dose ± 50 % |
| P31 | Starch is bimodal | A gelatinised film either hydrates and lifts or stays as a sheet | Porridge-plate scores cluster at 5 and at 0 to 1: "If oatmeal sticks to ware, it typically gets a score of 0" [VERIFIED] S4 | S4 | Twelve porridge soup plates; inspect the score histogram |
| P32 | Microwaved milk on glass is persistent | Heat-denatured protein and mineral film on a smooth substrate; alkalinity-limited | Glass class 2.3 to 2.4 with detergent D on the reference machines, 2.8 to 4.0 with detergent E or a long eco programme [VERIFIED] S11 | S11, S12 | Standard glasses with detergents D and E |
| P33 | Fat needs temperature and enough water | Solid fat below its melting range is only smeared; with little water the emulsion redeposits as a film, most visibly on plastic | Margarine platter cleans easily at 50 °C. Low-water machines left "significantly more greasy residue" after three cycles [VERIFIED] S20 (qualitative) | S20; `[-> chemistry sec. 4]` | Greased plastic and ceramic plates at 35, 45 and 55 °C main wash |
| P34 | Thick layers detach as flakes | Under strong alkalinity a thick egg layer loses adhesion before it dissolves | Thick egg yolk "partly tended to flake off" and gave "widely fluctuating values"; IKW halved the layer to fix this [VERIFIED] S13. Flakes become redeposition particles (P21) | S13 | Egg yolk at 5 and 10 mg/cm² dry |
| P35 | Pot interiors | Deep cavity: inverted, the bottom is hit directly and the wall near the rim sits low in the rack; on its side, half the wall is shadowed | Pots class 2.5 with detergent D to 4.0 with E [VERIFIED] S11. Scored on four surfaces. Inner wall against inner bottom ranking is a calibration target | S11 | Pot inverted against on its side |

### 9.7 Group F: drainage, pooling and drying

| ID | Phenomenon | Mechanism | Direction and rough size | Evidence | A/B test |
|---|---|---|---|---|---|
| P36 | Water pools in the base recess of inverted cups and mugs | The foot ring forms a shallow dish | Level: π R² h = 5.9 mL for R = 25 mm, h = 3 mm. The pool is last-rinse water plus whatever dripped in. Drying score 0 | Cup bases are a field drying complaint [VERIFIED] S18 | Mug inverted on a level support |
| P37 | Tilt drains the recess | Liquid spills over the low side; what remains is a wedge of volume V = (8/15) sqrt(2R) h^2.5 / tan^1.5 θ (valid when h / tan θ < R) | Same recess: 1.4 mL at 7°, 0.42 mL at 15°, 0.13 mL at 30° | Makers' advice to tilt [RECALLED]; geometry | Mug at 0°, 7°, 15°, 30° |
| P38 | Plastic stays wet | Low heat capacity and conductivity: little stored heat to evaporate the film; water beads instead of sheeting | Melamine drying 0.47 to 0.76 against crockery 0.67 to 0.83 in conventional machines; 0.985 in a machine with assisted drying [VERIFIED] S11 | S11; S36; S22; S18 | Melamine and porcelain plates of the same shape side by side |
| P39 | Pots and large hollow ware stay wet | Sheltered interiors, rims that hold water, large wetted area | Pots drying 0.45 to 0.79 [VERIFIED] S11 | S11 | Pot against plate |
| P40 | Liquid held at contact points and in narrow gaps | Capillary rise between surfaces a distance w apart: h = 2 γ cos θ / (ρ g w) | With γ = 0.035 N/m and θ = 20°: 34 mm at w = 0.2 mm, 13 mm at 0.5 mm, 7 mm at 1 mm. Wet mark and a residue line at every touching pair | Consumers always let items touch [VERIFIED] S18 | Two glasses touching against 10 mm apart |
| P41 | Light plastic items are moved or flipped by jets | Jet thrust F = ρ Q v on a concave underside | 0.08 to 0.30 N per jet for Q = 1 to 2 L/min and v = 5 to 9 m/s: the weight of 8 to 30 g. Unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill (P01) `[-> items sec. 4]` | S24 top-rack advice | 15 g plastic lid in the lower rack against the upper rack |
| P42 | Cutlery dries almost completely (negative control) | Thin metal, high conductivity, drains along its length | Drying 0.99 [VERIFIED] S11 | S11 | Standard cutlery |
| P43 | Spots, film and tine marks on glass | Evaporation of hard or poorly rinsed water leaves solids; contacts hold drops | AHAM adds 1 point per small spot or streak, 3 per large one [VERIFIED] S4. IEC Annex Q has a photo catalogue for spots on glasses [VERIFIED] S1 `[-> chemistry sec. 3.5]` | S4, S1 | Glasses with and without rinse aid; soft against hard final rinse |

### 9.8 Group G: system-level consistency checks

| ID | Phenomenon | Mechanism | Target | Evidence |
|---|---|---|---|---|
| P44 | Cutlery comes out clean although it is the most shadowed class | Thin soil films, small soiled area, metal substrate, repeated wetting from all sides | Class mean 4.6 to 4.8 [VERIFIED] S11; "typically completely clean" [VERIFIED] S6 | S11, S6 |
| P45 | Class ranking in the standard test | See section 7.1 | Cutlery > melamine > (pots, glass, crockery); overall 3.5 to 4.2 on a 12 to 13 place-setting load; crockery 2.3 to 3.7; glass 2.3 to 4.0; pots 2.5 to 4.0 [VERIFIED] S11 | S11 |
| P46 | Run-to-run repeatability | Arm phase, soil variability, tablet release time, sensor decisions | Standard deviation of the load mean score across seeds about 0.08 to 0.10; not zero, not 0.5 [VERIFIED] S11 | S11 |
| P47 | Everything is wetted within seconds; jets are rare events | Splash and downfall reach surfaces that jets do not | Water circuit under 3 s; plate run-off in tenths of a second; f_jet under 10 % almost everywhere [VERIFIED] S16 | S16, S26 |
| P48 | Detergent does not change where water goes | Surfactant alters wetting and film behaviour, not jet paths | Jet trajectories and velocity fields the same with and without detergent [VERIFIED] S16 | S16 |

---

## 10. A quantitative definition of an item "coming out clean"

### 10.1 Requirements

1. Traceable to the scale laboratories already use, so future real tests can calibrate it directly.
2. Computable from simulator state without a human.
3. Independent of mesh resolution.
4. Close to what people accept.

### 10.2 Definition

Simulator state needed per item j at the end of the cycle:

| Symbol | Meaning | Unit |
|---|---|---|
| a_e | area of surface element e | mm² |
| m_e,k | residual dry mass per area of adhered soil class k on element e | mg/cm² |
| φ_e | fraction of element e whose residue exceeds the visibility threshold (sub-element coverage) | 0 to 1 |
| P_j | list of redeposited particles on item j, each with an equivalent diameter d_p | mm |
| V_pool,j | liquid volume held in cavities of item j after the final drain and drying phase | mL |

Step 1, visibility. A patch is visibly soiled when Σ_k m_k / m_vis,k ≥ 1. φ_e is the area fraction of element e for which this holds. If the soil model carries only an element mean, use φ_e = 1 when the mean satisfies the inequality and 0 otherwise, and keep elements at or below 2 mm edge length.

Step 2, observables.

A_j = Σ_e a_e φ_e + Σ_{p in P_j} (π/4) d_p²   (mm²)  (E6)

n_j = (number of connected visibly soiled regions with equivalent diameter ≤ d_dot) + (number of particles in P_j with d_p ≥ d_min)  (E7)

Regions larger than d_dot count through area only. Defaults: d_dot = 2 mm, d_min = 0.3 mm.

Step 3, score. s_j = min(S_n(n_j), S_A(A_j)) with the IEC table of section 6.1 (E1). For pots and other deep hollow ware evaluate inner bottom, inner wall and outer surface separately and take the minimum.

Step 4, verdict.

clean_j = [ s_j ≥ 4 ] and [ V_pool,j ≤ V_max ]  (E8)

Default V_max = 1 mL. In words: **an item is clean if it carries at most 4 visible specks and at most 4 mm² of visible soil in total, and holds no more than 1 mL of water.**

Tiers for the report and for optional partial credit:

| Tier | Condition | Suggested points |
|---|---|---|
| Spotless | s = 5, no pooled water, IEC drying score 2 | 100 % (bonus optional) |
| Clean | s = 4, V_pool ≤ 1 mL | 100 % |
| Marginal | s = 3 | 0 % in the base game; 50 % in a "lenient" mode |
| Dirty | s ≤ 2, or pooled dirty water | 0 % |

Load-level indices to print alongside (so results can be compared with published data): mean score C (E2) and the 0 to 100 index 100 − (12.5 N_4 + 25 N_3 + 50 N_2 + 75 N_1 + 100 N_0)/N [VERIFIED] formula S6.

### 10.3 Visibility thresholds

No standard gives a mass threshold; assessors judge by eye at 1 000 to 1 500 lux. The values below are [ESTIMATED] and are calibration parameters.

| Soil appearance class | m_vis (dry mass per area) | Equivalent film thickness at 1.3 g/cm³ | Reasoning |
|---|---|---|---|
| Strongly coloured or opaque (spinach, tomato, egg yolk, meat, tea film, coffee) | 0.02 to 0.05 mg/cm² | 0.15 to 0.4 µm | Pigmented layers are visible well below a wavelength of light in thickness on white ware |
| Translucent films (starch, milk protein, sugar glaze) | 0.1 to 0.3 mg/cm² | 0.8 to 2.3 µm | Seen as matt haze in diffuse light. IKW notes that the last 10 % of a starch soil "can be clearly identified" once it is stained with iodine [VERIFIED] S13, which implies it is easy to miss unstained; for the 3.75 mg/cm² starch film that would be about 0.4 mg/cm² |
| Fat smear | 0.05 to 0.2 mg/cm² | 0.5 to 2 µm | Visible on glass in glancing light, less on matt plastic |
| Discrete particle | d_min = 0.3 mm | n/a | Normal acuity of 1 arcminute at 0.4 m is 0.12 mm (0.4 m × tan 1′); tripled for limited contrast and a 10 s viewing limit |

Scale check: standard dry loadings are 0.9 to 7 mg/cm² (section 4.4), so m_vis is about 0.5 to 5 % of the initial loading.

### 10.4 Why 4 and not 5, and how strict this is

- Score 4 is the laboratory's "practically clean" band. The US index deducts only 12.5 of 100 for it; score 3 deducts 25 [VERIFIED] S6.
- It is far stricter than the consumer rule of thumb reported by Reviewed ("more than 1 % of a stain remains" looks dirty [VERIFIED] (page extract) S22). One percent of a 150 to 250 cm² soiled patch is 150 to 250 mm², which is IEC score 0 or 1. So "clean = score ≥ 4" is a laboratory-grade criterion, and "score ≥ 1 or 2" is roughly what a tolerant user accepts [ESTIMATED].
- EU law requires a mean score of about 3.9 (section 6.3). With that mean, a threshold of 5 would fail most hard-soil items even under perfect loading; a threshold of 4 leaves the outcome sensitive to loading skill.
- Expected base rate in a compliant machine with a correctly loaded standard load: about 70 % of items at s ≥ 4 [ESTIMATED]: class weights 47 % cutlery, 27 % crockery, 14 % glass, 6 % melamine, 6 % pots (section 5.1) times assumed pass shares 0.90, 0.45, 0.60, 0.80, 0.65 read from the class means of section 7.1. The pass shares are guesses; the item-score histograms behind the means are not published.
- Residue on cutlery and on glasses is what consumers penalise most [VERIFIED] S18; a level designer can weight those items' points accordingly.

### 10.5 Resolution and sub-grid counting

The 4 mm² boundary means element area must be at most about 1 to 4 mm² if residue is carried as an element mean. Total wetted item area for a 140-item load is about 5 to 6 m² [ESTIMATED]: 33 plates and bowls at about 0.1 m² (both faces), 40 cups, mugs and glasses at about 0.04 m², 69 cutlery pieces at about 0.006 m², 8 serving pieces at about 0.1 m². At 2 mm elements that is about 1.4 million elements; at 1 mm, about 6 million. Either is small for a GPU.

To avoid resolving individual specks, carry a speck intensity λ_e (specks per mm²) per element from the redeposition model and draw n_j from a Poisson distribution with mean Σ_e λ_e a_e using the run's seed [ESTIMATED] modelling choice. The probability that an otherwise clean item stays at score 5 is exp(−Σ_e λ_e a_e), and that it stays at 4 or better is the Poisson probability of at most 4 events.

---

## 11. Evidence for and against the architecture candidates

**For (a), the hybrid multi-scale scheme with time-homogenised jet statistics.**
- The physical picture measured inside a real machine is exactly what (a) assumes: coherent straight jets from a small number of nozzles, impact, then gravity-driven downfall over items and walls [VERIFIED] S16.
- A geometric jet model plus a per-spot hit-frequency statistic plus a swelling and removal law already predicted full-scale cleaning curves in four of six cases [VERIFIED] S16. That is a published proof of concept of (a) at small scale.
- The soil response is governed by chemistry, temperature, time and hit frequency; shear magnitude above a threshold was not significant for protein [VERIFIED] S16. High-fidelity local shear fields therefore buy little for that soil class.
- A programme has thousands of arm revolutions: 97 to 270 min [VERIFIED] S11 at about 35 rpm [VERIFIED] S16 is 3 400 to 9 500 revolutions if the pump ran all the time, perhaps half that in practice [ESTIMATED]. With a 30 minute budget that is roughly 0.2 to 1 s of wall-clock per revolution. Only a periodic-statistics approach fits.
- The scoring table needs residual soil at 1 to 2 mm resolution on about 5 to 6 m² of surface (section 10.5). A surface-element soil model does this cheaply; a volumetric method does not give it for free.
- Laboratory reproducibility is 0.2 to 0.3 score points [VERIFIED] S11. Model error below that cannot be validated.

**Against relying on (a) alone.**
- Direct impingement covers a small part of the load. Whole bands of the rack received water "not directly from a jet but from water being splashed or during the subsequent downfall" [VERIFIED] S16. Splash, secondary droplets, rain from above and film hand-over between items carry most of the wetting and all of the chemistry delivery to shadowed surfaces. If these sub-models are weak, (a) will over-predict dirt in shadows and fail the negative controls (P16, P24, P28, P44).
- Redeposition (P21), pooling (P01, P36) and flipping of light items (P41) need liquid inventory and momentum to be tracked through the load, not only on the first surface hit.
- The CFD in S16 matched tracers in the arm and at ejection but not in free fall [VERIFIED] S16, a warning that droplet and downfall statistics are the hard part.

**For (b), fully resolved free-surface simulation, in a limited role.**
- It is the natural way to obtain the splash and downfall statistics that (a) needs and cannot easily derive: where water goes after first impact in a specific loaded geometry, for a handful of arm revolutions.
- It cannot carry the soil state at scoring resolution or cover thousands of revolutions within budget [ESTIMATED] from the numbers above.

**Recommendation from this topic: (c).** Use (a) as the backbone and the scoring path. Use a short resolved or particle-based wetting pass per load (a few revolutions per hydraulic state) or a well-calibrated splash and film model to produce the secondary-wetting and inventory fields. Validate against the negative controls first; they discriminate between a line-of-sight toy and a physical model.

---

## 12. Gaps and open questions

| # | Gap | How to close it |
|---|---|---|
| 1 | IEC 60436 Annex A (item table with masses), Annex C (grams of each soil per item), Table 1 and Table 3 as printed in Ed. 4/5, Annex I.4 loading plan | Buy IEC 60436:2025. One purchase turns most [RECALLED] entries in sections 4 to 6 into data |
| 2 | Whether the cleaning-score area bands in Ed. 4/5 equal the Ed. 3.1 bands (4, 20, 50, 200 mm²) | Same purchase |
| 3 | AHAM DW-1-2020 gram quantities, detergent grams per place setting, grading lighting | Buy AHAM DW-1-2020 and DW-2-2020 |
| 4 | Detergent D dose in IEC Ed. 4 | Same as 1 (Ed. 4.1) or ask a test lab |
| 5 | No public per-position cleaning map and no controlled loading-pattern study with scores | First real-world calibration campaign: standard load, then the A/B pairs of section 9 |
| 6 | Item-score histograms behind the round-robin class means (Appendix F of S11 exists but was not in the public PDF text) | Ask the authors (Albstadt-Sigmaringen University) or APPLiA |
| 7 | Visibility thresholds m_vis | Bench test: graded residue films under 1 000 to 1 500 lux, three assessors |
| 8 | Consumer Reports and Which? protocols; Bosch, Miele, GE loading instructions verbatim | Fetch when search is available |
| 9 | Australian IEC 60436 round robin (2017): item masses, air-dry results for glasses | Retry the download |
| 10 | Brückner and Stamminger (2015) consumer-relevant test for automatic programmes; Brückner, Schneider and Stamminger (2012) "A new place setting" | Paywalled; obtain via library |

---

## 13. Recommended model and defaults

### 13.1 Virtual inspection module

Implement the end-of-cycle evaluation as a separate module that reads only surface state and returns, per item: n, A, the IEC score s (E1), the drying score (section 6.2 rules applied to retained drops, streaks and cavity water), V_pool, and the clean verdict (E8). Make the score table data, not code. Default table: section 6.1. Also output C (E2), the 0 to 100 index (section 10.2) and, when a reference-machine run is available, I_C (E3).

Defaults: d_dot = 2 mm; d_min = 0.3 mm; V_max = 1 mL; m_vis per section 10.3 mid-range values (0.03, 0.2, 0.1 mg/cm² for coloured, translucent, fat); element edge at most 2 mm on items; pots scored on three surfaces plus overall.

### 13.2 Scoring rule for the game

Item earns its points if clean_j (E8) is true. Report the tier, s, n, A and wetness for every item, and for unloaded items report "not washed". Keep the threshold (4 by default) and V_max as level parameters.

### 13.3 Built-in standard scenarios

| Scenario | Load | Soil | Purpose |
|---|---|---|---|
| STD-EU-13 | 140 items per section 5.1 in the maker-style plan for the baseline machine | Section 4.1 assignment with the working quantities below; oven-dried 2 h at 80 °C; margarine fresh | Regression against section 7.1 class means |
| STD-EU-12-REF | 130 items in a reference-machine emulation (97 min, about 50 °C main wash, 67 °C rinse, 14.3 L; or 144 min, 45 °C, 62 °C, 8.9 L) | Same | Lets the simulator report an index I_C like a lab |
| STD-US-HEAVY | 8 place settings plus 6 serving pieces, 4 settings soiled, clean and soiled alternating | Section 4.2, air-dried 2 h | Regression against "70 to 95" and the pattern-insensitivity result |
| HARD-IKW | Six items each of the section 4.3 soils plus 50 g ballast | Baked per section 4.3 | Hard mode; gravimetric output for egg yolk and starch |

Working soil quantities for STD-EU-13 until Annex C is available (all [ESTIMATED] unless tagged; chosen to match the verified 3 g per plate and about 10 to 12 mg/cm² wet):

| Item | Soil | Quantity |
|---|---|---|
| Dinner plate | Egg yolk on half of them, minced-meat mix on the other half | 3 g wet, spread on the well, rim free |
| Soup plate | Oat-flake porridge | 3 g wet (10.6 mg/cm²) [VERIFIED] S13 |
| Dessert plate | Egg yolk on half, spinach on half | 2 g wet |
| Melamine dessert plate | Spinach or meat mix | 2 g wet |
| Glass dessert bowl | Oat flakes or spinach | 2 g wet |
| Glass | Milk, microwaved | 10 mL [VERIFIED] for IKW S12, [RECALLED] for IEC |
| Cup, mug, saucer | Tea film | 100 mL per cup brewed at 15 g/L, evaporated half-full 1 h at 80 °C, emptied; saucer 5 mL |
| Fork, knife, spoons | Egg yolk on forks, porridge on soup spoons, margarine on knives, others clean | 0.3 g wet per soiled piece (about 20 cm² at 15 mg/cm²) |
| Oval platter | Margarine | 5 g |
| Pots, glass bowl, melamine bowls | Meat mix and spinach | 5 g wet each |

This is of the order of 150 g of wet soil plus 130 mL of milk, about 40 to 50 g of dry matter [ESTIMATED], comparable to the IKW run total estimated by the chemistry specialist `[-> chemistry sec. 5.1]`.

Ageing levels as a level parameter: fresh (under 1 h); air-dried 2 h (US); air-dried 15 to 18 h; oven 2 h at 80 °C (EU standard); baked 2 h at 120 to 140 °C (IKW).

### 13.4 Default test conditions

Cold fill 15 °C; ambient 23 °C, 55 % relative humidity; supply 240 kPa; inlet hardness 2.5 mmol/L with the softener working; detergent type D or E composition `[-> chemistry]` at 8 g + 0.5 g per place setting loaded (Ed. 5 rule) or one 18 to 20 g tablet for consumer-like levels; acidic rinse aid on; evaluation 30 min after programme end with the door closed.

### 13.5 Run-to-run variability

Target a seed-to-seed standard deviation of the load mean score of about 0.09 (section 7.1). Generate it from physical sources, each seeded: arm start phase, tablet release time within its tolerance, per-item soil mass (± 3 to 7 %, the verified application tolerances in S12), per-patch adhesion strength (log-normal; tune the coefficient of variation to reproduce the bimodal starch outcome P31), and item seating pose from the rigid-body settle. For benchmarking, fix the seed per level or average over a stated number of seeds `[-> benchmark]`.

### 13.6 Validation protocol

1. Tier 0, mechanisms: the 48 A/B tests of section 9. Pass = correct sign and magnitude within a factor of two (or ± 1 score point). Negative controls must stay within their bands.
2. Tier 1, standard load: STD-EU-13 class means within ± 0.5 of the bands in P45 and the ranking correct; drying class means within ± 0.1 of section 7.1.
3. Tier 2, statistics: P46 repeatability; score histogram shapes (P31).
4. Tier 3, after real-world tests: replace bands with measured values and tighten to ± 0.3 points (the between-lab reproducibility).

---

## 14. Calibration parameters

What future real-world tests should measure, with expected ranges. "Std" means the STD-EU-13 scenario on a real 13-place-setting machine.

| Parameter | Expected range | Basis | How to measure |
|---|---|---|---|
| Class mean cleaning scores, Std | Cutlery 4.6 to 4.8; melamine 4.2 to 4.4; crockery 2.3 to 3.7; glass 2.3 to 4.0; pots 2.5 to 4.0; overall 3.5 to 4.6 | [VERIFIED] S11 | Five runs, IEC scoring |
| Item-score histogram per class | unknown; starch expected bimodal | [VERIFIED] qualitative S4 | Same runs, keep per-item scores and positions |
| Per-position score map | unknown | gap | Same runs; record rack coordinates of every item |
| Repeatability s_r of load mean | 0.08 to 0.10 | [VERIFIED] S11 | Same runs |
| Drying class means | Cutlery 0.99; glass 0.88 to 0.95; crockery 0.67 to 0.83; melamine 0.47 to 0.99; pots 0.45 to 0.79 | [VERIFIED] S11 | Same runs, score 30 min after end |
| Visibility thresholds m_vis | 0.02 to 0.3 mg/cm² by soil class | [ESTIMATED] sec. 10.3 | Graded films, three assessors, standard lighting |
| Minimum visible speck d_min | 0.2 to 0.5 mm | [ESTIMATED] | Same |
| Hit-frequency f_jet at instrumented spots | 0.5 to 10 % | [VERIFIED] range S16 | Pressure-sensitive film or high-speed video through a window |
| Effect of soiled face orientation (P02) | Δs −1 to −2 | [ESTIMATED] | A/B pair |
| Effect of plate pitch 10 against 20 mm (P03) | Δs −0.5 to −1.5 | [ESTIMATED] | A/B pair |
| Nesting residue fraction (P04, P15) | 50 to 100 % of overlapped soil | [ESTIMATED] | A/B pair with weighed soil |
| Shadow of a baking tray (P05) | Δs −1 to −3 behind it | [ESTIMATED] | A/B pair |
| Stalled arm (P06) | rack mean −1.5 or more | [ESTIMATED] | A/B pair |
| Corner against centre (P07) | Δs −0.5 to −1 | [ESTIMATED] | Position sweep |
| Overload sensitivity (P19) | −0.5 to −1 at + 30 % items | [ESTIMATED]; −0.9 [VERIFIED] for one 17-setting model S11 | Load series |
| Blocked dispenser (P25) | load mean −1.5 or more; protein near 0 removal | [ESTIMATED] from [VERIFIED] mechanism S16 | A/B pair |
| Redeposited specks per clean item with 20 g spinach in the load (P21) | mean 1 to 5 | [ESTIMATED] | Count on white clean plates |
| Ageing ladder (P29): crockery mean | fresh at least 4.5; 80 °C 2.3 to 3.7; 130 °C lower by 1 or more | band [VERIFIED] S11; ends [ESTIMATED] | Three loads |
| Recess pool volume against tilt (P36, P37) | 6 mL flat to 0.1 mL at 30° for a 50 mm, 3 mm recess | [ESTIMATED] formula | Weigh mugs after the cycle |
| Mass at which plastic items flip (P41) | 30 to 50 g | [ESTIMATED] | Graded lids in the lower rack |
| Tablet-in-dead-spot penalty (P26) | unknown | gap | A/B pair |
| IEC soil grams per item | 2 to 5 g wet per plate-like item | [RECALLED] / [ESTIMATED] | Read Annex C |
| Share of items at s ≥ 4 on Std | about 70 % | [ESTIMATED] sec. 10.4 | Same five runs |

---

## 15. Sources

Opened and read this session (S), then not opened (N).

| ID | Source | URL |
|---|---|---|
| S1 | IEC 60436:2015+AMD1:2020 CSV (Ed. 4.1), publisher's preview: contents, foreword, introduction, scope, list of figures and tables | https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec60436%7Bed4.1%7Db.pdf |
| S2 | IEC 60436:2025 (Ed. 5.0), publisher's preview: contents, foreword, introduction | https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec60436%7Bed5.0%7Db.pdf |
| S3 | SIST EN 50242:2016 / EN 60436:2016, preview (first 13 pages: common modifications to clauses 1 to 6.4.1) | https://cdn.standards.iteh.ai/samples/24986/5622d58e00954a848929db48081dc2cc/SIST-EN-50242-2016.pdf |
| S4 | US DOE, "ENERGY STAR Dishwasher Webinar: Cleanability Test Procedure Discussion", 19 Sep 2011 (56 slides; IEC and AHAM scoring tables, soil assignments, example data, observations) | https://www.energystar.gov/sites/default/files/specs/private/ENERGY_STAR_Residential_Dishwasher_Cleanability_Test_Procedure_Webinar_Presentation.pdf |
| S5 | ENERGY STAR, "Test Method for Determining Residential Dishwasher Cleaning Performance", Rev. Feb-2014 | https://energystar.gov/sites/default/files/specs//ENERGY%20STAR%20Final%20Test%20Method%20for%20Determining%20Residential%20Dishwasher%20Cleaning%20Perfor%20%20%20_0.pdf |
| S6 | ENERGY STAR, Draft 1 Test Method for Determining Residential Dishwasher Cleaning Performance, Rev. Feb-2012 | https://www.energystar.gov/sites/default/files/specs/Draft_1_Test_Method_Dishwasher_Cleaning_Performance.pdf |
| S7 | N. S. Castro (NIST), "Revising the U.S. Dishwasher Test Procedure: International Harmonization Issues and Projections" (about 2001) | https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=860838 |
| S8 | N. Castro, NISTIR 7356, "Evaluation of Reported Results Using the Revised U.S. Department of Energy Dishwasher Test Procedure", July 2006 | https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir7356-CAS.pdf |
| S9 | 10 CFR Part 430, Subpart B, Appendix C1 (as shown by Cornell LII) | https://www.law.cornell.edu/cfr/text/10/appendix-C1_to_subpart_B_of_part_430 |
| S10 | 10 CFR Part 430, Subpart B, Appendix C2 (mirror) | https://www.customsmobile.com/regulations/title10_chapterII_part430_subpartB_appendixAppendixC2 |
| S11 | Eilts, Klingshirn, Boursillon (Albstadt-Sigmaringen University), "Dishwasher Round Robin Test 2022/2023, Final Report", Sep 2023 | https://www.hs-albsig.de/fileadmin/user_upload/hsas/Dishwasher_RoundRobinTest_New_Reference_System.pdf |
| S12 | IKW working group, "Recommendations for the Quality Assessment of the Cleaning Performance of Dishwasher Detergents (Part B, Update 2015)", SOFW Journal 142 (06/2016), with cover sheet of 1 Dec 2025 | https://www.ikw.org/fileadmin/IKW_Dateien/downloads/Haushaltspflege/2025_EQ-MGSP-Teil-B_2015_inkl_Vorblatt-e.pdf |
| S13 | IKW working group, "Methods for ascertaining the cleaning performance of dishwasher detergents" (Parts A and B, 2005 edition) | https://www.ikw.org/fileadmin/IKW_Dateien/downloads/Haushaltspflege/HP_DishwasherA_B_e.pdf |
| S14 | European Commission (A. Boyano), "Framework for performance testing for dishwasher detergents", v1.1, 10 Apr 2018 | https://api.eublomsten.dk/api/docs/CriteriaDocumentFiles/3462 |
| S15 | Commission Regulation (EU) 2019/2022, Annexes I to IV (UK legislation archive copy) | https://www.legislation.gov.uk/eur/2019/2022/annexes |
| S16 | R. Pérez-Mohedano, "Cleaning principles in automatic dishwashers", EngD thesis, University of Birmingham, 2016 | http://etheses.bham.ac.uk//id/eprint/6590/9/PerezMohedano16EngD_sizereduced.pdf |
| S17 | wfk Testgewebe GmbH, "Dish washer test loads" catalogue page | https://testgewebe.de/en/products2/dish-washer-test-loads/ |
| S18 | A. Klingshirn et al., "Nachhaltigkeit Geschirrspüler" working paper, Hauswirtschaft und Wissenschaft, 14 Apr 2020 | https://haushalt-wissenschaft.de/wp-content/uploads/2020/04/HUW_09_2020_Klingshirn_Geschirrspuelen.pdf |
| S19 | A. Ohlsson, D. Rodríguez Altimira, "Towards More Sustainable Dishwashing Behaviour", MSc thesis, Chalmers, 2025 (used as a secondary source for Richter 2010/2011, Stamminger and Streichardt 2009, Belke et al. 2019) | https://odr.chalmers.se/server/api/core/bitstreams/b266429b-ab7f-42fe-bc8e-d75ef1b38a77/content |
| S20 | AHAM, ex parte memo to DOE, 31 Jul 2015, docket EERE-2014-BT-STD-0021 | https://www.energy.gov/sites/prod/files/2015/08/f25/AHAM%20Comments_Ex%20Parte%20Memo_July%208,%202015_Dishwasher%20Standards_FINAL%20(00039961).pdf |
| S21 | CHOICE, "How we test dishwashers" | https://www.choice.com.au/home-and-living/kitchen/dishwashers/articles/how-we-test-dishwashers |
| S22 | Reviewed, "How we test dishwashers in the Reviewed test labs" | https://reviewed.com/dishwashers/features/how-test-dishwashers |
| S23 | Stiftung Warentest, "Geschirrspüler im Test" (method section) | https://www.test.de/Geschirrspueler-im-Test-4685888-0/ |
| S24 | America's Test Kitchen, "The Best Way to Load Your Dishwasher" | https://www.americastestkitchen.com/articles/6559-the-best-way-to-load-your-dishwasher |
| S25 | Reviewed, "You're loading your dishwasher the wrong way" | https://reviewed.com/dishwashers/features/youre-loading-your-dishwasher-the-wrong-way |
| S26 | IChemE blog, "How to best load a dishwasher, by a chemical engineer (Day 243)" | https://www.icheme.org/knowledge-networks/blog/how-to-best-load-a-dishwasher-by-a-chemical-engineer-day-243/ |
| S27 | Laughing Squid, "The Best Way to Load a Dishwasher According to Scientific Research" (MinuteFood, K. Yoshida) | https://laughingsquid.com/best-way-to-load-dishwasher/ |
| S28 | ResearchPod, "The science of dishwashing: Changing habits for a greener world" (Stamminger) | https://researchpod.org/earth-environment/dishwashing-habits-energy-usage |
| S29 | Berkholz, Stamminger, Wnuk, Owens, Bernarde, "Manual dishwashing habits: an empirical analysis of UK consumers", Int. J. Consumer Studies 34 (2010) 235 (abstract) | https://www.cbsm.com/articles/33333-manual-dishwashing-habits-an-empirical-analysis-of-uk-consumers |
| S30 | University of Bonn, Institut für Landtechnik, household technology publication list | https://www.landtechnik.uni-bonn.de/en/household-technology/publications |
| S31 | Reviewed, "Scientists Conclude We Don't Load Dishwashers Correctly" | https://www.reviewed.com/dishwashers/news/scientists-conclude-we-dont-load-dishwashers-correctly |
| S32 | ENERGY STAR, dishwasher key product criteria | https://www.energystar.gov/products/dishwashers/key_product_criteria |
| S33 | ENERGY STAR, comment-response summary on the cleaning-performance test method | https://www.energystar.gov/sites/default/files/specs/Test_Method_for_Determining_Dishwasher_Cleaning_Performance_Comments.pdf |
| S34 | A. Michel, E. Bush, J. Nipkow (Topten), "Dishwashers: Testing the energy variability related to different uses", May 2017 | https://storage.topten.eu/source/files/Topten_Dishwashers_May17.pdf |
| S35 | Search-result excerpts only (documents not opened): IEC 60436:2015/AMD1:2020 catalogue page (item codes, dinner plate 250 mm and 530 g, ± 5 % mass rule, ballast soil dose); Australian Dishwasher Round Robin Testing to IEC 60436, 2017 | https://standards.iteh.ai/catalog/standards/iec/7bfc8184-2f13-419d-b146-51a32e198b87/iec-60436-2015-amd1-2020 ; https://www.energyrating.gov.au/sites/default/files/2022-12/Report%20Australian%20Dishwasher%20Round%20Robin%20Testing%20To%20The%20IEC60436%20Standard.pdf |
| S36 | Consumer Reports, dishwasher buying guide | https://www.consumerreports.org/appliances/dishwashers/buying-guide/ |
| S37 | IEC 60436:2025/COR1:2026 and IEC 60436:2015/COR1:2020 (EN 60436:2020/AC:2020-06): read as text extracted by the chemistry specialist in this session | see the chemistry dossier's source list |

Not opened (cited from memory or as leads):

| ID | Source |
|---|---|
| N1 | IEC 60436:2025 full text (Annexes A, B, C, H, I; Tables 1 to 4) |
| N2 | ANSI/AHAM DW-1-2020 and DW-2-2020 full text |
| N3 | Pérez-Mohedano, Letzelter, Amador, VanderRoest, Bakalis, "Positron Emission Particle Tracking (PEPT) for the analysis of water motion in a domestic dishwasher", Chem. Eng. J. 259 (2015) 724 to 736 (content covered by S16) |
| N4 | Richter, "Usage of dishwashers: observation of consumer habits in the domestic environment", Int. J. Consumer Studies 35 (2011), DOI 10.1111/j.1470-6431.2010.00973.x; Richter (2010), DOI 10.1111/j.1470-6431.2009.00839.x |
| N5 | Brückner, Stamminger, "Consumer-relevant assessment of automatic dishwashing machines by a new testing procedure for 'automatic' programmes", Energy Efficiency 8 (2015), DOI 10.1007/s12053-014-9284-4 |
| N6 | Brückner, Schneider, Stamminger, "A new place setting: consumer-relevant measuring unit for domestic dishwashers", Tenside Surf. Det. (2012), DOI 10.3139/113.110166 |
| N7 | Stamminger, Streichardt, "Selected aspects of consumer behaviour in the manual and mechanical dishwashing in Germany" (2009) |
| N8 | Bosch, Miele, Whirlpool, GE use-and-care manuals; Finish and Cascade loading guides; Consumer Reports and Which? test-method pages |


