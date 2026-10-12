# Spotless research dossier: wash-liquor chemistry, thermal environment, redeposition and drying

Specialist: chemistry. Date: 2026-10-08. Status: first-principles plus literature; uncalibrated.

## 0. How to read this dossier

### 0.1 Scope

This dossier covers what the wash liquor is (detergent, enzymes, bleach, surfactant, soil load, hardness), how hot everything is, what the liquor leaves behind (redeposition, carry-over, spots), how soils age before the wash, and how the load dries. It ends with an implementable lumped wash-liquor model, its coupling to a per-surface-element soil model, and default cycle programs.

Cross-links to sibling dossiers are marked `[-> machine]`, `[-> standards]`, `[-> jets]`, `[-> films]`, `[-> soils]`, `[-> numerics]`, `[-> items]`, `[-> benchmark]`. I do not duplicate their content; where I need one of their quantities I name it as an input.

### 0.2 Confidence tags

Every quantitative value carries exactly one tag.

| Tag | Meaning |
|---|---|
| [VERIFIED] | I read the value in the fetched text of the cited source during this session. Where the text reached me through the fetch tool's extraction rather than a raw PDF dump, I say so in the source list. |
| [RECALLED] | From memory, or seen only in a search-result snippet without opening the source. Snippet-only values are marked "snippet". Treat as unverified. |
| [ESTIMATED] | My own derivation. The derivation is shown or referenced. |

Sources are cited as `S#` (opened and read) or `N#` (not opened); the full list with URLs is in section 12.

### 0.3 The five findings that matter most

1. The wash liquor is well mixed on the time scale of its chemistry. Recirculation turns the sump over several times per minute while the fastest relevant reaction (TAED perhydrolysis) has a half-life of about 3 min at 23 °C [VERIFIED, S5 §4.1.1.4] and soil removal takes 25 to 65+ min [VERIFIED, S3 §7.2]. A lumped ODE model of the liquor is therefore justified whatever fluid architecture is chosen.
2. For enzyme-sensitive soil the measured cleaning is spatially homogeneous and controlled by diffusion-reaction, not by direct jet impact: the fraction of time a tile spends under a jet was 1.58 % and the "soil dissolution" term dominated [VERIFIED, S3 §7.2.1, §7.3.2]. What the fluid model must deliver to chemistry is wetting coverage, film renewal and film temperature per surface element; peak shear matters much less for this soil class.
3. Chemistry is steep in three variables: about 2.5x per pH unit, about 2x from 30 to 55 °C, and a threshold-like dependence on protease concentration (0.17, 1.75, 2.59 %/min at 0.02, 0.06, 0.10 g/L) [VERIFIED, S3 Tables 7.1 to 7.3]. A tablet that dissolves late or a dose diluted by a large fill moves the load along the steep part of that curve.
4. Carry-over is 0.3 to 0.5 L per drain [VERIFIED, S3 §1.3] against fills of 3 to 5 L, so each rinse dilutes by only about 10x [ESTIMATED]. Final-rinse purity, spotting and redeposition are set by this arithmetic and by pooled water on badly placed items.
5. Residual-heat drying is energy-limited per unit area: a 5 mm porcelain plate cooling 20 K can evaporate about 45 g/m² per side, 1.5 mm polypropylene about 11 g/m² [ESTIMATED, §6.2], and plastic holds its water as discrete drops. That is why plastics stay wet, and the model captures it with nothing more than areal heat capacity, wettability and an enclosure vapour balance.

---

## 1. Detergent composition, dose, concentrations, pH, dissolution

### 1.1 IEC reference detergent type D (composition verified)

Composition of reference detergent type D. Values from Table E.1 of IEC 60436 Ed. 4 as corrected by COR1:2020 (identical in EN 60436:2020/AC:2020-06):

| Ingredient | Specification | Mass % | Conf. |
|---|---|---|---|
| Sodium citrate dihydrate | builder | 30.0 | [VERIFIED, S1 Table E.1] |
| Maleic/acrylic acid copolymer sodium salt | Sokalan CP 5 Gran (BASF), 50 % active on sodium carbonate | 12.0 | [VERIFIED, S1] |
| Sodium percarbonate | bleach | 7.0 | [VERIFIED, S1] |
| Tetraacetylethylenediamine (TAED) | bleach activator | 2.0 | [VERIFIED, S1] |
| Sodium disilicate | alkalinity, corrosion inhibitor | 10.0 | [VERIFIED, S1] |
| Linear fatty alcohol ethoxylate | Plurafac LF 403 (BASF), low-foam nonionic | 2.0 | [VERIFIED, S1] |
| Protease | Savinase 6 T (Novozymes) | 1.0 | [VERIFIED, S1] |
| Amylase | Termamyl 120 T (Novozymes) | 0.5 | [VERIFIED, S1] |
| Sodium carbonate | alkalinity | balance to 100 (= 35.5 by difference) | [VERIFIED, S1]; the 35.5 is [ESTIMATED] |

The standard's note requires that substitutes keep equivalent activity units, concentrations and active-to-carrier ratios [VERIFIED, S1].

IEC 60436 Ed. 5 (2025) introduces a new reference detergent "type E" with upgraded enzymes and lower silicate (to avoid dangerous-goods classification), a new reference machine and an alignment factor [RECALLED, snippet, N10]. I could not obtain the type E ingredient table. Use type D as the default formulation until the type E table is bought or supplied `[-> standards]`.

### 1.2 Dose

| Rule | Dose | Conf. |
|---|---|---|
| IEC 60436:2025 (Ed. 5), machines >= 8 place settings | 8 g + 0.5 g per place setting loaded | [VERIFIED, S2 §5.7 Formula (1)] |
| IEC 60436:2025, machines < 8 place settings | 8 g + 0.7 g per place setting loaded | [VERIFIED, S2] |
| Resulting dose at 13 place settings | 14.5 g | [ESTIMATED] from the rule above |
| IKW detergent test method: compact detergent type IEC B or D | 20 g, or 1 tab, or 1 pouch | [VERIFIED, S4 §1.6] |
| IKW: classic high-alkaline type IEC A | 30 g | [VERIFIED, S4 §1.6] |
| Commercial unit doses (tablet/pouch) | 17 to 25 g per dose | [VERIFIED, S9, description of dose weight] |
| Typical concentration used in lab work with powder detergent | 3.4 g/L | [VERIFIED, S3 §3.4.2] |
| Dishwash compositions dosed in wash liquor | 2.5 to 10 g/L | [RECALLED, snippet from patent literature] |

### 1.3 Main-wash fill volume and resulting concentration

| Quantity | Value | Conf. |
|---|---|---|
| Water in machine during main wash (Miele G1222 class, 2010s) | 5 L | [VERIFIED, S3 §3.4.2 and §3.6.2] |
| Fill used in ORNL lumped model | 1 US gallon (3.8 L) per wash event | [VERIFIED, S7 §4] |
| 1990s US machine wash charge | 2 to 2.4 US gallons (7.6 to 9.1 L) | [VERIFIED, S12] |
| Modern EU machine main-wash fill | 3.0 to 4.0 L | [RECALLED] `[-> machine]` |
| Sump charge in a heat-pump dishwasher study | 4.4 kg | [RECALLED, snippet] |

Detergent concentration in the main wash: 20 g in 5 L gives 4.0 g/L; 14.5 g in 3.5 L gives 4.1 g/L [ESTIMATED]. **Default: c_D = 4.0 g/L.**

Component concentrations for type D at 4.0 g/L (all [ESTIMATED] by arithmetic from the [VERIFIED] composition; molar masses [RECALLED]):

| Species | g/L | mmol/L | Note |
|---|---|---|---|
| Sodium citrate dihydrate (294.1 g/mol) | 1.20 | 4.08 | weak Ca binder |
| Polycarboxylate polymer (active) | 0.24 | n/a | dispersant, threshold scale inhibitor |
| Na2CO3 total (balance 35.5 % + 6 % polymer carrier + 4.7 % released by percarbonate) | 1.85 | 17.4 | main alkalinity |
| Sodium percarbonate 2Na2CO3·3H2O2 | 0.28 | H2O2: 2.68 | using 32.5 wt % H2O2 in percarbonate [RECALLED] |
| TAED (228.25 g/mol) | 0.080 | 0.35 | theoretical peracetic acid 0.70 mmol/L (53 mg/L) at 2 mol/mol |
| Sodium disilicate (182.15 g/mol) | 0.40 | 2.2 | |
| Nonionic surfactant | 0.080 | n/a | 80 mg/L |
| Protease granulate (Savinase 6 T) | 0.040 | n/a | 40 mg/L of granulate, not of enzyme protein |
| Amylase granulate (Termamyl 120 T) | 0.020 | n/a | 20 mg/L of granulate |

Note the protease level: 0.04 g/L of granulate sits between the 0.02 g/L level at which Pérez-Mohedano saw almost no egg-yolk cleaning and the 0.06 g/L level at which cleaning completed in about 65 min [VERIFIED, S3 §7.2.3]. The prills he used were a P&G detergent protease, not Savinase 6 T, so the mass scales are not interchangeable; the point is that reference-detergent dosing sits on the steep part of the response. This is a first-order calibration issue (§11).

HERA independently gives TAED at 0.1 to 0.5 g/L of washing liquor and 0.5 to 3.2 % (typical 2.5 %) in machine-dishwashing tablets [VERIFIED, S5 §5.1 and Table 1].

### 1.4 Modern commercial phosphate-free products

I found no opened primary source that tabulates a current commercial formulation; the ranges below are from memory of the patent and trade literature and are all [RECALLED]. They are for building alternative "detergent types" in levels, not for calibration.

| Function | Ingredient | Typical wt % in an 15 to 20 g unit dose |
|---|---|---|
| Strong builder | MGDA-Na3 or GLDA-Na4 | 10 to 35 |
| Co-builder | sodium citrate | 5 to 30 |
| Alkalinity | sodium carbonate | 10 to 40 |
| Alkalinity/corrosion | sodium disilicate | 0 to 5 |
| Bleach | sodium percarbonate | 10 to 20 |
| Activator or catalyst | TAED 2 to 5, or Mn catalyst (MnTACN or Mn oxalate) 0.01 to 0.1 | |
| Surfactant | low-foam nonionics (fatty alcohol alkoxylates, end-capped) | 2 to 8 |
| Dispersant | sulfonated polyacrylate, acrylic/maleic copolymer | 2 to 10 |
| Scale inhibitor | phosphonate (HEDP) | 0 to 3 |
| Enzymes | subtilisin protease granulate 1 to 3; alpha-amylase granulate 0.5 to 2 | |
| Glass/silver care | zinc or bismuth salts, benzotriazole | 0.1 to 0.5 |
| Rinse-aid function in "all-in-one" | high-cloud-point nonionic, polymer | 1 to 5 |

Calcium binding strength, log K(Ca): citrate about 3.5, GLDA about 6, MGDA about 7, tripolyphosphate about 5 to 6 [RECALLED]. Citrate therefore cannot hold calcium against carbonate at pH 10.5; type D relies on the polymer's threshold inhibition, MGDA products sequester stoichiometrically.

Product forms:

| Form | Behaviour relevant to the model | Conf. |
|---|---|---|
| Powder | Dissolves in 1 to 2 min once flushed out of the dispenser | [ESTIMATED] |
| Pressed tablet | Disintegrates then dissolves; the criterion in one tablet patent is 95 % dissolved in under 10 min at about 38 °C, 150 ppm hardness | [RECALLED, snippet] |
| PVOH pouch (liquid/gel/powder compartments) | Film must dissolve first. One patent's designed cold-resistant film (30 µm, MW 100,000) was not dissolved after 15 min at 20 °C and dissolved within 2 min at 30 °C. A film test in a Bosch Eco 45 programme found the film fully dispersed after 15 min | [RECALLED, snippet] |
| Gel/liquid | Immediately available; usually no bleach (enzymes and bleach are incompatible in liquid) | [RECALLED] |
| Multi-chamber or layered | Deliberately sequenced release, for example enzymes first and bleach later, because bleach deactivates enzymes (§2.4) | [RECALLED] |

### 1.5 pH

Qualitative behaviour from the literature: detergents were highly alkaline powders, alkalinity was then reduced and enzymes introduced; buffers are carbonate, bicarbonate and silicate; high pH swells protein and starch soils, hydrolyses them above about pH 11, and charges glass/ceramic negatively, which lowers soil adhesion [VERIFIED, S3 §2.2.3].

| Quantity | Value | Conf. |
|---|---|---|
| Typical automatic dishwashing product, 1 % solution, 25 °C | pH 9 to 11.5 | [RECALLED, snippet] |
| Measured main-wash pH, mildly alkaline enzyme product vs high-alkaline product | 9.8 to 9.9 vs 11.4 to 11.5 | [RECALLED, snippet] |
| pH levels used as low/centre/high in the Birmingham work | 9.5 / 10.5 / 11.5 | [VERIFIED, S3 §3.6.2] |
| Buffer recipes for those levels in 4.4 mmol/L hardness water | pH 9.5: 1.10 mM Na2CO3 + 1.80 mM NaHCO3; pH 10.5: 1.00 mM Na2CO3; pH 11.5: 3.25 mM NaOH | [VERIFIED, S3 §3.6.2] |

Computed pH for type D (ideal carbonate equilibrium, activity coefficients ignored, no CaCO3 precipitation; pK2(carbonic) = 10.33/10.17/10.14 and pKw = 14.00/13.26/13.02 at 25/50/60 °C [RECALLED]; all results [ESTIMATED]):

| c_D (g/L) | pH at 25 °C | pH at 50 °C | pH at 60 °C | pH at 50 °C with 2 meq/L acid soil |
|---|---|---|---|---|
| 1 | 10.9 | 10.4 to 10.5 | 10.3 | 10.2 |
| 2 | 11.1 | 10.6 to 10.7 | 10.5 | 10.5 |
| 4 | 11.3 | 10.8 to 10.9 | 10.6 | 10.8 |
| 6 | 11.35 | 10.9 to 11.1 | 10.7 | 11.0 |

Real solutions read lower by roughly 0.2 to 0.4 units because of ionic strength, CO2 uptake in the spray and carbonate lost to CaCO3 [ESTIMATED]. **Default plateau: pH 10.5 at 50 °C for type D at 4 g/L; pH 10.0 for a "mild MGDA/citrate tablet" variant.** Calibrate with a pH logger in the sump (§11).

pH versus time through a cycle [ESTIMATED]:

| Phase | pH | Reason |
|---|---|---|
| Pre-wash, no detergent | 7.5 to 8.5 | supply water; IKW adjusts synthetic water to pH 7.5 [VERIFIED, S4 Box 1] |
| Main wash, during dissolution | rises with the dissolved fraction; already within about 0.4 pH units of the plateau when 25 % of the dose has dissolved, because pH goes with the logarithm of concentration | carbonate buffer |
| Main wash, plateau | 10.5 (type D); drifts down 0.1 to 0.3 over 30 to 60 min | soil acids, CO2 |
| Intermediate rinse | 9.8 to 10.2 | one-tenth of the alkalinity carried over |
| Final rinse | 8 to 9 without rinse aid; 7 to 8 with acidic rinse aid | one-hundredth of alkalinity plus supply bicarbonate |

### 1.6 Water hardness and the softener

| Quantity | Value | Conf. |
|---|---|---|
| Hardness in the wash cycle for testing standard products | 8 to 10 °dH (1.4 to 1.8 mmol/L Ca+Mg) | [VERIFIED, S4 §1.6] |
| Upper hardness for multi-purpose tabs (as on pack) | usually 21 °dH | [VERIFIED, S4 §1.6] |
| IKW synthetic water for preparing soils | 3.00 mmol/L Ca+Mg = 16.8 °dH; stock solutions NaHCO3 800 mmol/L, MgSO4·7H2O 154.2 mmol/L, CaCl2·2H2O 446.1 mmol/L, 50 mL each to 10 L | [VERIFIED, S4 Box 1] |
| Hardness used at Birmingham | 8.5 US gpg, made with 0.236 g/L CaCl2·6H2O + 0.076 g/L MgCl2·6H2O, Ca:Mg 3:1 molar | [VERIFIED, S3 §3.6.2]. The two salt masses correspond to about 1.45 mmol/L total [ESTIMATED], which matches 8.5 gpg. The thesis also prints "4.4e-3 M" for the same water; that figure is inconsistent with its own recipe and I do not use it |
| Incoming water temperature for tests | 15 °C or 20 °C | [VERIFIED, S4 §1.6] |
| Built-in ion exchanger output hardness | below about 0.5 to 1 mmol/L when salt is present and the setting is correct | [RECALLED] `[-> machine]` |

Consequences to model: (i) free Ca above the builder's capacity inhibits starch removal (water hardness had a significant negative effect on amylase cleaning, p = 0.0007 [VERIFIED, S6 Table 1]); (ii) calcium bridges tea tannins and protein soils to surfaces [VERIFIED, S3 §2.2.3]; (iii) CaCO3 and Ca-soap films form on glass when the scale inhibitor is exhausted (§8.5).

### 1.7 Dispenser opening and what goes wrong

Detergent companies formulate so that everything is released together when the dispenser opens, and appliance makers design cycles with little regard to chemistry [VERIFIED, S3 §1.3]. In the IKW method the detergent is added by hand at the moment the dosage chamber opens, with the frozen ballast soil [VERIFIED, S4 §1.6].

Failure modes the game should model (mechanism qualitative; magnitudes [ESTIMATED], all calibration parameters):

| Failure | Cause in the load plan | Effect on the liquor |
|---|---|---|
| Lid blocked | A tall plate, tray or pan handle in the lower rack, or a large item in the upper-rack tablet tray, stands within the lid's swing | Tablet stays in the cup; only splash reaches it. Released fraction over the main wash 5 to 30 %; the rest dissolves in later rinses or remains as paste. Main-wash pH, enzyme and bleach all scale down; alkaline residue carried into the final rinse causes film |
| Tablet lands in a sheltered spot | Falls into the cutlery basket, onto a bowl, or between plates | Wetting factor w_tab of 0.05 to 0.3; dissolution time 3 to 20 times longer; local high concentration near the tablet, low elsewhere until dissolved |
| Pouch film not dissolved | Short cool programme, pouch stuck to a wet dispenser wall | Delay of release; PVOH residue on items |
| Dose diluted | Extra-large fill or pre-wash carry-over | Linear in concentration but steep in effect (§2.3) |
| No detergent in pre-wash | Normal; pre-wash is water only unless detergent was put in the door well | Pre-wash acts by hydration and mechanical removal only |

Model: the tablet is a rigid body `[-> items]` whose resting place gets a wetting flux from the jet/film solver `[-> jets, films]`; dissolution follows §10.3.

---

## 2. Enzyme kinetics

### 2.1 What the enzymes are and what they need

Detergent enzymes must work from 20 to 70 °C with an optimum near 60 °C, show high activity in alkaline conditions and tolerate the other ingredients. Proteases are serine proteases of the subtilisin family; they adsorb on the soil surface, hydrolyse peptide bonds and can keep catalysing without leaving the surface. Amylases hydrolyse alpha-1,4 glycosidic bonds. Both need some free Ca2+. Removal is layer by layer [VERIFIED, S3 §2.2.3, citing Aehle 2007 and Olsen & Falholt 1998]. I could not open Olsen & Falholt (N4) itself; its abstract confirms scope only.

| Enzyme | Property | Value | Conf. |
|---|---|---|---|
| Savinase (subtilisin, Bacillus) | working pH range | 8 to 12 | [VERIFIED, S8] |
| Savinase | pH optimum | about 10 | [VERIFIED, S8] |
| Savinase | working temperature range | 20 to 60 °C, activity falls rapidly above | [VERIFIED, S8] |
| Savinase | temperature optimum | 55 °C | [VERIFIED, S8] |
| Detergent proteases generally | temperature optimum | 50 to 60 °C | [VERIFIED, S3 §7.2.2, citing Aehle 2007] |
| Termamyl (B. licheniformis alpha-amylase) | working ranges | 30 to 100 °C, pH 7 to 11 | [VERIFIED, S8] |
| Protease in detergent matrix | "abrupt thermal decomposition from 50 °C regardless of pH" | qualitative | [RECALLED, snippet of N1 conference abstract] |
| Food inhibitors | egg and potato contain protease inhibitors | qualitative | [VERIFIED, S8] |

### 2.2 Measured effect of temperature, pH and enzyme level on a real soil in a real machine

Egg-yolk technical tiles (Center for Testmaterials, about 1.75 g egg yolk on 120 mm x 100 mm) in a Miele G1222, 5 L, 35 rpm lower arm, followed by in-machine image analysis [VERIFIED, S3 §3.3, §3.11, §7.2]:

| Condition (others at 55 °C, pH 10.5, 0.06 g/L protease) | Cleaning rate (% SRI per min) | Std | Time to complete | Conf. |
|---|---|---|---|---|
| 30 °C | 0.85 | 0.12 | n/a | [VERIFIED, S3 Table 7.1] |
| 55 °C | 1.75 | 0.29 | about 65 min | [VERIFIED, S3 Table 7.1, §7.2.3] |
| 0.02 g/L protease | 0.17 | 0.05 | not reached | [VERIFIED, S3 Table 7.2] |
| 0.10 g/L protease | 2.59 | 0.22 | about 45 min | [VERIFIED, S3 Table 7.2] |
| pH 9.5 | 0.69 | 0.16 | not reached; rate falls after 20 min | [VERIFIED, S3 Table 7.3] |
| pH 11.5 | 4.66 | 0.38 | about 25 min | [VERIFIED, S3 Table 7.3] |

Derived sensitivities [ESTIMATED from the table]:

- Temperature: 2.06x from 30 to 55 °C, apparent activation energy 23.9 kJ/mol.
- pH: 2.5x per unit from 9.5 to 10.5 and 2.7x per unit from 10.5 to 11.5 (0.40 and 0.43 decades per pH unit).
- Enzyme: a Hill curve through the three points gives exponent n = 2.85, half-saturation K = 0.054 g/L, R_max = 3.04 %/min. Three points determine three parameters exactly, so this is a shape, not a fit. Pérez-Mohedano's explanation is that at low concentration the enzyme struggles to deposit on a vertical, rapidly renewed surface [VERIFIED, S3 §7.3.2].

Other observations that constrain the model [VERIFIED, S3 §7.2]:

- An initial lag with no colour change (swelling stage), shorter at higher temperature.
- Removal was homogeneous over the tile; direct jet patterns were seen once in all runs.
- A "cleaning front" spreading from one corner was seen once at the lowest enzyme level, attributed to enzyme accumulation in a dead spot. Pooling can therefore help enzymatic soils locally while hurting redeposition.

### 2.3 Bench-scale rate data and a fitted rate law

Scanning fluid dynamic gauge (sFDG) on the same soil, immersed, with controlled shear stress and shear "frequency" (fraction of time the gauge applies shear to the spot). Table 7.6 of the thesis lists lag time t_lag, a dissolution rate k_ds (thickness loss with no applied shear) and a shear-assisted rate k_ss, in µm/min of swollen layer, for 29 conditions [VERIFIED, S3 Table 7.6]. Examples:

| T (°C) | pH | Protease (g/L) | Shear freq. (%) | t_lag (min) | k_ds (µm/min) | k_ss (µm/min) |
|---|---|---|---|---|---|---|
| 30 | 9.5 | 0.06 | 54.5 | n/a | 3.30 | 9.43 |
| 30 | 10.5 | 0.02 | 9 | 10.94 | 5.31 | 16.46 |
| 42.5 | 10.5 | 0.06 | 54.5 | n/a | 8.29 | 16.91 |
| 55 | 9.5 | 0.10 | 9 | 0.38 | 11.72 | 26.29 |
| 42.5 | 11.5 | 0.06 | 9 | 20.29 | 37.30 | 133.74 |
| 55 | 11.5 | 0.10 | 9 | 10.54 | 60.87 | 93.54 |

(All six rows [VERIFIED, S3 Table 7.6].)

Parameters the thesis used when simulating the full-scale machine [VERIFIED, S3 Figs. 7.13, 7.14]:

| Case | D (m²/s) | Equilibrium swollen thickness (mm) | t_lag (min) | k_ss (µm/min) | k_ds (µm/min) |
|---|---|---|---|---|---|
| 30 °C, pH 10.5, 0.06 g/L | 3.0e-10 | 0.410 | 13.05 | 24.28 | 2.84 |
| 55 °C, pH 10.5, 0.06 g/L | 4.0e-10 | 0.703 | 3.14 | 69.42 | 9.63 |

My regression of the 21 k_ds values and 29 k_ss values in Table 7.6 on a log-linear form [ESTIMATED; data VERIFIED]:

```
k_ds = 11.8 um/min * exp[-(31.6e3 / R) * (1/T - 1/315.65)] * 1.87^(pH - 10.5) * (E_P / 0.06)^0.32
       R^2(log) = 0.81, rms error factor 1.34, n = 21

k_ss = 21.1 um/min * exp[-(24.9e3 / R) * (1/T - 1/315.65)] * 1.85^(pH - 10.5) * (E_P / 0.06)^0.28 * (f / 50)^(-0.22)
       R^2(log) = 0.76, rms error factor 1.43, n = 29
```

T in K, R = 8.314 J/(mol K), E_P in g/L of protease prill, f the shear frequency in %. Validity: 30 to 55 °C, pH 9.5 to 11.5, 0.02 to 0.10 g/L, immersed soil. Adding a (pH - 10.5)² term raises R² for k_ds to 0.88 (coefficient +0.39), which says the pH response steepens above 10.5, consistent with the alkaline hydrolysis threshold between pH 11 and 12 reported for beta-lactoglobulin gels [VERIFIED, S3 §2.3].

Three cautions:

1. The enzyme exponent is about 0.3 for immersed soil but the full-scale data look sigmoidal (§2.2). The thesis itself reports that its statistical k_ds model overpredicted at low enzyme in the machine: fitting required k_ds of 0.90 to 2.00 µm/min where the bench minimum was 3.90 µm/min [VERIFIED, S3 §7.3.2].
2. The thesis reports a separate Arrhenius analysis of dissolution at three temperatures giving only 4.8 kJ/mol (R² 0.999) [VERIFIED, S3 §6.3.2, Fig. 6.31]. My all-conditions regression gives 31.6 kJ/mol. The discrepancy is unresolved; the full-scale value (23.9 kJ/mol) sits between. Use 25 kJ/mol with range 5 to 35.
3. k_ss per unit time of applied shear is higher when shear is applied less often (exponent -0.22), and the highest removal was seen with discontinuous shear [VERIFIED, S3 §6.3.2]. Soak time between shear events is productive: this is the time-homogenisation argument in physical form.

Effective diffusivity of wash liquor into the dry egg-yolk layer [VERIFIED, S3 Table 6.8, Fick's second law fit]:

| T | pH 9.5 | pH 10.5 | pH 11.5 |
|---|---|---|---|
| 30 °C | 5.5e-12 m²/s | 8.6e-12 | 4.1e-11 |
| 55 °C | 1.0e-11 | 1.9e-11 | 5.4e-11 |

Activation energies for these diffusivities: 19.8, 26.2, 9.1 kJ/mol (mean 18.4 ± 9.0) by Fick; 7.7 ± 4.4 by linear poroelasticity; 16.4 ± 6.7 by non-linear poroelasticity; all below water self-diffusion at 2.3e-9 m²/s [VERIFIED, S3 Table 6.8 and following text]. A compact form [ESTIMATED from those six values]:

```
D_F(T, pH) = 1.3e-11 m^2/s * 10^(0.40 * (pH - 10.5)) * exp[-(18.4e3 / R) * (1/T - 1/315.65)]
```

`[-> soils]` owns the swelling model; this is the chemistry-side dependence it needs.

### 2.4 Enzyme stability in the wash

| Finding | Conf. |
|---|---|
| Bleach compounds decompose amylase, giving a negative effect of TAED on starch cleaning (p = 0.0003) with no bleaching benefit on that stain | [VERIFIED, S6 §"Cleaning factors selection" and Table 1] |
| For protein stain: percarbonate, protease, amylase, main-wash time and their interactions (percarbonate x protease, protease², protease x amylase, protease x time) are all significant at p < 0.0001 | [VERIFIED, S6 Table 1] |
| Enzyme activity in the commercial raw materials studied: amylase 4 %, protease 9.71 % active; TAED 92 %, Mn catalyst 2 %, percarbonate 100 % | [VERIFIED, S6 §"Detergent formulation"] |
| Amylase stability is reduced by deprotonated peracid, a pH x temperature interaction, and protonated peroxide whose effect is amplified by Mn catalyst; protease by protonated peracid, peroxide acid-base species, temperature and pH. Model R² 0.84 and 0.90 | [RECALLED, snippet of N1 abstract] |
| Solid-state stability: H2O2 from bleach and humidity oxidise Met222 of the protease in granulates | [RECALLED, snippet] |

I could not obtain the rate constants of N1 (Chem. Eng. Sci. 287, 119767), which is the one paper that would close this gap; it is open access but the publisher and repository blocked automated fetching. Until then, the deactivation model in §10.5 uses estimated constants with the correct structure.

### 2.5 Practical rate model for enzyme action on a surface-bound layer

The evidence supports this structure (details and defaults in §10.6):

1. A hydration lag set by diffusion of liquor into the layer (D_F above; t_lag roughly h_dry²/D_F for thick layers, 0.4 to 33 min observed [VERIFIED, S3 Table 7.6]).
2. After the lag, a chemical erosion rate proportional to an activity term a(T), a pH term and a saturating function of enzyme concentration, acting whenever the element is wet, regardless of shear.
3. A shear-assisted term acting only while the film or jet applies stress above a threshold that chemistry lowers `[-> soils]`.
4. Enzyme concentration that decays in the liquor by thermal and oxidative deactivation and is diluted by carry-over arithmetic.

---

## 3. Bleaching

### 3.1 Chemistry

Oxygen bleach systems are peroxide sources (percarbonate), peracid precursors (TAED), and catalysts (Mn-TACN). Peroxide alone is slow below 60 °C and needs high pH. TAED reacts with the perhydroxyl anion to give peracetic acid and DAED. The bleach's jobs are tea-type stain removal and germ kill [VERIFIED, S3 §2.2.3].

```
2 Na2CO3·3H2O2  ->  2 Na2CO3 + 3 H2O2                       (dissolution, fast)
H2O2  <->  HOO- + H+                 pKa about 11.6 (25 C)   [RECALLED]
TAED + HOO-  ->  TriAED + CH3CO3-    (perhydrolysis 1)
TriAED + HOO- ->  DAED + CH3CO3-     (perhydrolysis 2)
TAED + OH-   ->  TriAED + CH3CO2-    (hydrolysis, unproductive)
CH3CO3H <-> CH3CO3- + H+             pKa about 8.2           [RECALLED]
```

### 3.2 Kinetics of peracid generation (verified)

HERA reports a Clariant study of TAED perhydrolysis under wash-like conditions (perborate, sodium carbonate, sodium disilicate, no surfactant) at 23 °C and pH 10.1 [VERIFIED, S5 §4.1.1.4, Table 4.1.1.4]:

| Time (min) | TAED (mol %) | TriAED (mol %) | DAED (mol %) |
|---|---|---|---|
| 0 | 100 | n/a | n/a |
| 5 | 32 | 5.5 | 58.4 |
| 10 | 7 | 1.8 | 112 |
| 20 | 1.4 | < 0.2 | 116 |
| 30 | < 0.2 | < 0.2 | 115 |

| Quantity | Value | Conf. |
|---|---|---|
| TAED half-life, pseudo-first-order, pH 10.1, 23 °C, 0.5 g/L TAED, 1.5 g/L sodium perborate | 3 min | [VERIFIED, S5 §4.1.1.4] |
| Perhydrolysis complete under European wash conditions (30 to 60 °C) | within 15 min | [VERIFIED, S5 §3.3] |
| TAED hydrolysis without peroxide, pH 10, 21 °C | first half-life about 0.3 h; not first or second order, half-life shortens with time | [VERIFIED, S5 Table 4.1.1.5] |
| TAED solubility | 2 g/L at 20 °C, 5 g/L at 40 °C, 10 g/L at 60 °C | [VERIFIED, S5 §5.1] |
| TAED is "completely dissolved within minutes" in the wash; supplied as granulate with < 3 % of particles below 0.2 mm | qualitative | [VERIFIED, S5 §5.1] |
| Bleaching kinetics depend on temperature and pH (Reinhardt et al. 1989) | qualitative | [VERIFIED, S5 §3] |

Derived rate constants [ESTIMATED from the verified data; perborate hydrate form not stated, so a range]:

- [H2O2] from 1.5 g/L perborate is 9.75 mmol/L (tetrahydrate) to 15.0 mmol/L (monohydrate). At pH 10.1 the perhydroxyl fraction is 1/(1 + 10^(11.6 - 10.1)) = 0.031, so [HOO-] = 0.30 to 0.46 mmol/L.
- k_obs = ln 2 / 180 s = 3.85e-3 s^-1, hence **k_per = 8 to 13 L/(mol s) at 23 °C for TAED + HOO-**. Default 10.
- TriAED never exceeds 5.5 % while TAED is at 32 %, so the second step is about 5 to 6 times faster than the first. Treat TAED -> 2 peracid as one step with the first-step rate.
- Hydrolysis competes. With k_hyd about ln 2 / 1080 s = 6.4e-4 s^-1 at pH 10, the fraction of acetyl groups lost to hydrolysis is K_r / (K_r + [H2O2]) where both rates scale with [OH-], giving K_r about 3 mmol/L (range 1 to 6). **Peracid yield Y = [H2O2] / ([H2O2] + K_r).**
- For type D at 4 g/L, [H2O2] = 2.7 mmol/L, so Y is about 0.47 and the peak peracetic acid is about 0.33 mmol/L, not the theoretical 0.70. A commercial tablet with 15 % percarbonate gives [H2O2] about 6 mmol/L and Y about 0.67. This yield estimate rests on a hydrolysis measurement that HERA flags as non-first-order; it is one of the weakest numbers in this dossier (§11).
- In the machine at pH 10.5 with 2.7 mmol/L H2O2: [HOO-] = 0.20 mmol/L, k_obs = 2.0e-3 s^-1 at 23 °C, half-life 5.8 min. With an assumed activation energy of 45 kJ/mol the half-life at 45 °C is about 1.6 min. Peracid generation is therefore limited by tablet dissolution, not by kinetics, in any heated main wash.

### 3.3 Peracid decay

| Quantity | Value | Conf. |
|---|---|---|
| Peracetic acid decomposition in clean acidic-to-neutral solution, first order | 1.71e-3 h^-1 at 25 °C to 9.64e-3 h^-1 at 45 °C | [RECALLED, snippet, N13] |
| Same, pH 7.0 vs pH 3.11 | 7.5e-3 to 47.6e-3 h^-1 vs 2.1e-3 to 9.4e-3 h^-1; activation energies 58.4 and 72.9 kJ/mol at pH 3.11 and 5.0 | [RECALLED, snippet] |
| Decay in a soiled alkaline wash at pH 10.5 with excess H2O2 | half-life 20 to 40 min at 50 °C | [ESTIMATED]; clean-solution data above are far too slow to apply because base-catalysed reaction with H2O2, metal traces and soil demand dominate |

### 3.4 Stain bleaching

IKW classifies black tea as the "bleachable" soil class; it is prepared from Assam tea in 16.8 °dH water with added ferric sulphate (because Ca/Mg-only water did not stain darkly enough), filled at 85 °C and drawn down in 20 mL steps every 5 min, repeated twice, and stored at least 3 days before washing [VERIFIED, S4 §2]. That recipe tells us what a tea stain is: an oxidised polyphenol film bridged by Ca, Mg and Fe, deposited at a receding hot meniscus and aged.

| Finding | Conf. |
|---|---|
| Builders help remove tea deposits; calcium bridges soils to surfaces at alkaline pH | [VERIFIED, S3 §2.2.3] |
| Tea film at a tea/air interface is polyphenol complexed with hardness ions, about 20 nm thick in black tea across hardness levels | [RECALLED, snippet, N7] |
| Proposed two-step removal: bleach the top layer, then complexing agent removes calcium bridges under it | [RECALLED, snippet from patent literature] |
| Short programmes below 50 °C fail to remove stubborn tea stains adequately; Mn catalysts address this | [RECALLED, snippet of trade article] |
| Peracetic acid alone bleaching a model flavonoid (morin) at 20 °C | half-life 30 min | [RECALLED, snippet] |
| Among starch and minced-meat stains only the protein stain lost colour to bleach | [VERIFIED, S6] |

I found no published rate constant for tea-stain removal by peracid on ceramic. Proposed rate law with defaults chosen so that a 45 °C programme with an 8 min hold gives partial removal and a 65 °C programme gives full removal [ESTIMATED; calibration parameters]:

```
d(theta_tea)/dt = - [ k_bl(T) * C_PAA + k_HP(T) * C_HOO ] * (1 + beta_ch * X_ch) * phi_wet * theta_tea

k_bl(T) = 0.8 L/(mol s) * exp[-(60e3 / R) * (1/T - 1/318.15)]     (0.38 at 35 C, 1.6 at 55 C, 3.1 at 65 C)
k_HP(T) = 0.02 * k_bl(T) per mol/L of HOO-
beta_ch = 2;  X_ch = free chelant capacity / initial capacity, 0..1
```

theta_tea is the remaining stain fraction on the element, phi_wet its wetted time fraction. Check: 0.33 mmol/L peracid for 25 min at 45 °C gives 33 % removal without the chelant term and 70 % with X_ch = 1; 30 min at 65 °C gives 84 % without it and over 99 % with it [ESTIMATED]. Other chromophores: carotenoid/lycopene on plastic is inside the polymer and is not bleached in a wash (§5.4); red wine and coffee behave like weak tea stains (k_bl x 3) [ESTIMATED].

### 3.5 Hardness, filming and spotting on glass

- Antiscalants exist to stop CaCO3 and calcium phosphate precipitating on glassware at wash pH; the move away from phosphate made filming worse again [VERIFIED, S3 §2.2.3].
- Minerals produce dry films or spots on glassware at the end of the cycle; surfactant lowers surface tension and so reduces spots and films [VERIFIED, S3 §2.2.3, §2.2.2.4].
- Carry-over wash liquid in the sump is described in a filming patent as the main source of film-forming contaminants in the final rinse, and the remedy claimed is a short low-volume purge (about 0.3 US gal for 5 s) before the rinse [VERIFIED, S12].

Scaling driving force for type D at 4 g/L in unsoftened 1.6 mmol/L water at 50 °C: free Ca after citrate complexation about 0.12 mmol/L, carbonate about 12 mmol/L, ion product about 1.5e-6 against Ksp(calcite) about 3.3e-9, a supersaturation of several hundred on a concentration basis [ESTIMATED]. Precipitation is held back only by the polymer. Section 10.8 gives a scale-film index. Glass corrosion (irreversible cloudiness, iridescence) is a multi-cycle effect of soft water, high temperature and low silicate; it is out of scope for a single-cycle score but could be a long-game mechanic `[-> standards]`.

---

## 4. Fat-removal chemistry

### 4.1 What the literature says

- Lipid soils are hydrophobic and need surfactant; burnt-on fat needs high mechanical energy and enzymatic treatment (Ali et al. 2015, cooked lard) [VERIFIED, S3 §2.2.2.3].
- Petroleum jelly on glass was cleaned by an impinging jet only inside the film-jump radius; the draining film outside it could not remove it, unlike PVA glue or xanthan gum which cleaned everywhere once hydrated [VERIFIED, S3 §2.2.1, citing Wilson et al. 2014]. A semi-solid, non-swelling grease therefore needs either jet momentum or melting.
- "Animal and vegetable fats are melting in machines and wash programs above 50 °C", which makes them easy to emulsify; "at lower temperatures, around 40 to 45 °C it becomes increasingly difficult to remove such fats", especially animal fats and hydrogenated plant fats [VERIFIED, S9 background].
- Test in that patent: 7 g of chip fat with melting point above 40 °C on a stainless plate at the bottom of a Miele 1022 SC, 40 °C quick programme, 16 °GH tap water, 20 g detergent; chip fat recovered afterwards 43 ± 12 mg for the control detergent, and 14 ± 7 mg and 19 ± 10 mg for two formulations with 0.005 % and 0.02 % of a low-temperature emulsifier added [VERIFIED, S9 examples]. The patent text I saw does not say where the fat was recovered from. Either way, more than 99 % of a 7 g fat load left the plate even at a wash temperature below the fat's nominal melting point [ESTIMATED from those numbers]; the consumer-visible problem is the last tens of milligrams.
- Low-foam nonionics for dishwashers are chosen with a low cloud point (generally under about 30 °C) so that above it the separated surfactant phase suppresses foam [RECALLED, snippet]. Wash liquor surface tension with dishwasher surfactants is 40 to 45 mN/m, against 26 to 30 mN/m for hand dishwashing liquids [VERIFIED, S3 §2.2.3].

### 4.2 Melting ranges

Food fats melt over a range; what matters is the solid fat content (SFC) at the surface temperature. All values [RECALLED] from general fat-science knowledge; the logistic parameters are my fit to those remembered curves and are [ESTIMATED].

| Fat | Slip / clear point (°C) | SFC_max | T50 (°C) | w (K) | SFC at 40 / 45 / 50 °C from the fit |
|---|---|---|---|---|---|
| Sunflower, rapeseed, olive oil | below 6 | 0 | n/a | n/a | 0 / 0 / 0 |
| Coconut oil | 24 to 26 | 0.9 | 20 | 2.5 | 0 / 0 / 0 |
| Chicken fat | 23 to 30 | 0.25 | 15 | 5 | 0.002 / 0.001 / 0 |
| Butter (milk fat), cream, cheese fat | 32 to 37 | 0.60 | 14 | 6 | 0.008 / 0.003 / 0.001 |
| Margarine | 31 to 36 | 0.35 | 18 | 5.5 | 0.006 / 0.003 / 0.001 |
| Palm oil | 33 to 39 | 0.50 | 18 | 6 | 0.012 / 0.005 / 0.002 |
| Lard, bacon fat | 36 to 45 | 0.35 | 22 | 6.5 | 0.021 / 0.010 / 0.005 |
| Beef tallow, roast drippings | 42 to 48 | 0.50 | 30 | 6 | 0.080 / 0.038 / 0.017 |
| Mutton tallow | 44 to 51 | 0.55 | 33 | 6 | 0.13 / 0.066 / 0.031 |
| Hydrogenated frying fat, shortening | 40 to 50 | 0.60 | 36 | 5 | 0.19 / 0.085 / 0.034 |

```
SFC(T) = SFC_max / (1 + exp((T - T50) / w))          T in deg C
```

Mechanical state [ESTIMATED]: the fat crystal network has a yield stress tau_y of roughly 300 kPa x SFC^3.5 (about 26 kPa at SFC 0.5, 1 kPa at 0.2, 8 Pa at 0.05, 0.3 Pa at 0.02). Compare with the wall shear stresses used on the bench, 12 to 65 Pa [VERIFIED, S3 §6.2.2], and with draining films at a few Pa `[-> films]`. So:

- SFC below about 0.03: liquid oil; removal by roll-up and emulsification in any wetting film within minutes.
- SFC 0.03 to 0.08: soft; removed where jets strike, smeared elsewhere.
- SFC above about 0.1: plastic solid; only erosion at direct jet impact, plus slow softening by surfactant penetration.

This reproduces the patent statement: tallow and hydrogenated fats cross SFC 0.05 between 42 and 48 °C, butter and lard are liquid by 35 to 40 °C.

Molten fat viscosity is about 25 to 35 mPa·s at 50 °C and 50 to 70 mPa·s at 25 °C for liquid oils [RECALLED]; oil/water interfacial tension about 25 to 30 mN/m in clean water and 1 to 5 mN/m in alkaline nonionic solution [RECALLED].

### 4.3 Saponification, emulsification, roll-up

| Process | Rate or capacity | Conf. |
|---|---|---|
| Alkaline hydrolysis of intact triglyceride at pH 10.5, 50 °C, 30 min | under 2 % of the fat converted; negligible as a removal route | [ESTIMATED]: [OH-] is 1.7 mmol/L at this pH and temperature; even a homogeneous ester rate constant of 0.1 to 0.5 L/(mol s) gives a half-life of 13 to 68 min for dissolved ester, and triglyceride reacts only at the interface |
| Neutralisation of free fatty acids (1 to 5 % of used frying fat, more in burnt residues) | instantaneous; produces soap in situ, which aids emulsification, adds foam, and with Ca2+ forms lime soap | [ESTIMATED]; free fatty acid contents [RECALLED] |
| Roll-up on hydrophilic substrates (glass, glazed ceramic, stainless) | favourable: alkaline surfactant solution displaces oil, oil contact angle through water tends to 180° | [RECALLED] general detergency |
| Roll-up on hydrophobic substrates (PP, PE, silicone, melamine less so) | unfavourable: oil wets the plastic; removal needs shear or solubilisation, and dispersed fat re-adsorbs | [RECALLED] |
| Emulsifying capacity of the liquor | kappa_s = 20 to 40 g fat per g nonionic for stable droplets; type D at 20 g carries 0.4 g surfactant, so 8 to 16 g of fat | [ESTIMATED] |
| IKW ballast soil fat content | 54 % of 50 g = 27 g fat (vegetable oil 31.6 %, margarine 6.3 %, lard 6.3 %, frying fat 6.3 %, cream 9.4 %, whole egg 15.8 %, milk 6.3 %) | recipe [VERIFIED, S4 Table 4]; the 54 % is [ESTIMATED] using typical fat contents of the ingredients |

So a standard test load already exceeds the thermodynamically stabilised capacity by a factor of two or more. The rest circulates as mechanically dispersed droplets, which is harmless while hot and agitated and becomes a redeposition source when it meets a cold or oleophilic surface (§5.4).

### 4.4 Grease in cold zones

Places that run colder than the liquor [ESTIMATED]: the lower door lip and door seal region, the sump filter housing between circulation periods, tub corners outside jet coverage, items in spray shadow, and the whole machine in a 40 °C quick programme. Fat with SFC above about 0.1 at those surface temperatures crystallises there. Per-cycle this shows as a greasy film on plastics and filter; over many cycles as machine grease build-up (out of scope).

---

## 5. Soil load in the recirculating liquor, redeposition, foam, turbidity, carry-over

### 5.1 How much soil

| Source | Soil introduced | Conf. |
|---|---|---|
| IKW ballast | 50 g frozen mix added with the detergent, same amount regardless of how many items are washed | [VERIFIED, S4 §1.6] |
| IKW ballast composition by my reckoning | about 27 g fat, 1.5 g protein, 2.5 g carbohydrate, 1 g salts/acids, rest water | [ESTIMATED] from the [VERIFIED] recipe |
| IKW test soils per item | egg yolk 1.5 g wet over 140 cm² (750 ± 100 mg after denaturation and drying); minced meat 3 g (11.8 mg/cm²); crème brûlée 3.5 g (19.8 mg/cm²); pasta 3 g; starch 664 mg dry (3.75 mg/cm²); milk 10 mL baked; six items of each | [VERIFIED, S4 §§4 to 9] |
| Total dry soil in an IKW run | about 60 g (about 30 g on test items plus about 32 g non-water in the ballast) | [ESTIMATED] |
| Egg-yolk technical tile (CFT DS-22/DM-22) | 1.75 ± 0.04 g on 120 cm² (1.66 g in the thesis code), initial thickness 68 ± 14 µm | [VERIFIED, S3 §3.3 and Appendix code] |
| IEC 60436 soil per place setting | see `[-> standards]` | n/a |
| Real household loads | not found; a calibration parameter. Suggested level range 5 g (pre-rinsed) to 150 g (unscraped) dry soil per load | [ESTIMATED] |

Main-wash soil concentration for 60 g in 5 L is 12 g/L, of which about 5.4 g/L is fat [ESTIMATED].

### 5.2 Size classes and the filter

| Filter stage | Mesh | Conf. |
|---|---|---|
| Fine filter (BSH patent) | 0.9 to 1.1 mm | [VERIFIED, S10] |
| Micro filter downstream of the fine filter | about 0.3 mm | [VERIFIED, S10] |
| Other designs: coarse / fine / micro | about 5 mm / about 1 mm / 0.15 to 0.2 mm | [RECALLED, snippets, N9] |
| US fine-screen experience: 0.0049 in (0.12 mm) clogged; opened to 0.0079 in (0.20 mm), after which larger particles escaped and appeared as "grit" on dishes | qualitative with those sizes | [RECALLED, snippet, N9] |
| Bypass fine filtration removing soil down to 0.005 to 0.01 in (0.13 to 0.25 mm) "substantially reduces redeposit" | qualitative | [RECALLED, snippet, N9] |

The filter system exists to stop removed soil being reapplied to the load, and coverage of the filter changes the split between main and secondary flow [VERIFIED, S10].

Recommended size classes for suspended soil, with per-pass capture efficiency eta_k [ESTIMATED; calibration]:

| Class k | Size | Examples | eta_k clean filter | eta_k loaded filter (cake) | Settling speed at 50 °C, density excess 300 kg/m³ |
|---|---|---|---|---|---|
| 0 dissolved/colloidal | under 1 µm | hydrolysed protein, dextrins, sugars, salts, tannins | 0 | 0 | none |
| 1 emulsion | 1 to 20 µm | fat droplets | 0 | 0.01 | creams, about -0.01 mm/s |
| 2 fines | 20 to 150 µm | starch granule clumps, spice, coffee fines, seed fragments | 0.02 | 0.2 | 0.1 to 7 mm/s (Stokes) |
| 3 grit | 150 to 1000 µm | rice fragments, herb leaf, eggshell, sand | 0.6 | 0.9 | 7 to 60 mm/s (above Stokes range for the top end) |
| 4 coarse | over 1 mm | peas, bones, labels | 1.0 | 1.0 | fast |

With a circulation flow Q_c of 30 to 60 L/min `[-> machine]` and 4 L of liquor the turnover is 8 to 15 per minute, so class 3 and 4 material leaves suspension in seconds, and classes 0 to 2 stay until the drain [ESTIMATED]. Captured food keeps leaching and is broken down by enzymes, feeding classes 0 to 2. A heavily loaded filter also throttles the pump.

Stokes settling speed used above: v_s = (rho_p - rho) g d² / (18 mu), valid for particle Reynolds number under 1, that is d under about 100 µm here [ESTIMATED]; the formula is the standard Stokes law.

### 5.3 Redeposition mechanisms and rates

All rate expressions here are my own constructions from mass balances [ESTIMATED]; the mechanisms are standard.

| # | Mechanism | Where | Deposit per event |
|---|---|---|---|
| R1 | Stranding from the final film: when spraying stops the film thins; particles larger than the residual film are pinned and stay | Every wetted element; worst inside inverted glasses, which receive upward spray and drain slowly | m'' = C_k x delta_strand, with delta_strand about the particle diameter for classes 2 to 3 |
| R2 | Pool evaporation: concave or level regions hold liquor, and everything suspended and dissolved in it is left when it dries | Mug and glass bases, bowl rims, lids, spoons nested together, containers that flipped | m'' = (sum of C_k + C_TDS) x h_pool |
| R3 | Sedimentation in sheltered pools during the phase | Same places, plus items lying flat | m'' increases at v_s x C_k while the pool is quiescent |
| R4 | Adsorption of dispersed fat and soap scum | Plastics, silicone, the tub in cold zones | j = k_fat,dep x C_fat,free x affinity (§10.7) |
| R5 | Adsorption of dissolved protein/starch as a thin film | Glass (seen as cloudiness when there is no builder or enzyme) | small; lump into R2 |
| R6 | Pigment uptake into plastics (lycopene, carotene, curcumin) carried by fat | PP, PE, silicone, melamine | diffusion into the polymer; permanent |
| R7 | Carry-over between phases | Whole machine | §5.6 |

Worked magnitudes [ESTIMATED]:

- R1: 5 mg/L of 100 µm fines in the final rinse gives 0.5 mg/m², which on a 0.05 m² glass interior is about 40 visible specks (each about 0.7 µg). Consumers call this grit.
- R2: a mug base holding a 3 mm pool of final rinse containing 130 mg/L of carried-over soil plus 300 mg/L of dissolved solids leaves 1.3 g/m² = 130 µg/cm², a clearly visible ring.
- R2 with main-wash liquor: an item that pools and is not flushed by later rinses (an upturned bowl in spray shadow) keeps liquor at 12 g/L; a 3 mm pool leaves 3.6 mg/cm². That is a failed item.

Pool exchange: a pool is refreshed only by liquid that lands in it. Treat each pool as a stirred tank with inflow q_in from the jets/films solver: dC_pool/dt = (q_in / V_pool)(C_liquor - C_pool) `[-> films]`.

### 5.4 Fat and pigment on plastics

Standard dishwasher surfactants wet porcelain, glass, steel and plastic [RECALLED, snippet], but fat that has been dispersed rather than solubilised re-adsorbs on oleophilic surfaces. Model the free (unstabilised) fat fraction as

```
M_fat,stab = min(M_fat,liq, kappa_s * M_surf + kappa_p * M_prot,diss + kappa_soap * M_soap)
C_fat,free = (M_fat,liq - M_fat,stab) / V_w
```

with kappa_s = 30, kappa_p = 2, kappa_soap = 10 g fat per g [ESTIMATED]. Deposition flux to element e: j_fat = k_fat,dep x C_fat,free x a_sub x g(T_s), with k_fat,dep = 1e-6 m/s, substrate affinity a_sub = 1.0 (PP, PE, silicone), 0.4 (melamine, SAN, polycarbonate, PTFE-coated pans), 0.05 (glass, glazed ceramic, stainless in alkaline surfactant liquor), and g(T_s) = 1 + 5 x SFC(T_s) to represent crystallisation on cold surfaces [ESTIMATED; calibration]. Pigment staining follows fat deposition: stain intensity proportional to the time integral of j_fat x C_pigment/C_fat x exp(-(40 kJ/mol)/R x (1/T_s - 1/323 K)) [ESTIMATED].

### 5.5 Foam

Excess foam makes the spray arms malfunction because bubbles are drawn into the pump, lowering flow rate and wash efficiency; protein-rich soils cause it and the nonionic surfactants in the detergent are there to control it [VERIFIED, S3 §2.2.3]. I found no published quantitative relation between protein load and pump pressure in a household machine.

Proposed foam state F in 0..1 (air volume fraction at the pump inlet relative to the stall value) [ESTIMATED; calibration]:

```
dF/dt = k_F+ * max(0, C_prot,eff - C_crit) / C_scale * (1 - F)  -  k_F- * A_f * F

C_prot,eff = C_prot,diss + 0.3 * C_soap + 3 * C_handdish
C_crit     = 0.05 g/L + 5 * C_surf * H(T_w - T_cloud)         (antifoam only above the cloud point)
A_f        = 1 + 20 * C_fat,liq[g/L] / (1 + C_fat,liq[g/L])   (liquid fat is a defoamer)
k_F+ = 0.02 1/s, k_F- = 0.005 1/s, C_scale = 0.5 g/L, T_cloud = 25 to 35 C

p_pump = p_pump,0 * (1 - 0.6 F);   arm speed and jet momentum follow from the hydraulics model [-> machine]
```

The dangerous cases this reproduces: raw egg or milk in a detergent-free cold pre-wash; hand dishwashing liquid residue (strong anionic foamer); a dose that never dissolves. The IKW ballast contains 15.8 % whole egg [VERIFIED, S4 Table 4], that is 7.9 g of egg, about 1 g of protein, in 5 L (0.2 g/L) [ESTIMATED], which a correctly dosed detergent handles.

### 5.6 Carry-over and dilution arithmetic

| Quantity | Value | Conf. |
|---|---|---|
| Wash solution carried over after a drain | 0.3 to 0.5 L | [VERIFIED, S3 §1.3, personal communication from N. Letzelter, P&G, 2015] |
| "A small amount of carry-over liquid is unavoidably left in the tub"; it is the main source of film-forming contaminants in the final rinse | qualitative | [VERIFIED, S12] |
| A pump-off sequence with three or more phases separated by pauses significantly reduces the residual | qualitative | [RECALLED, snippet] |
| Water left on a single drinking glass 170 s after a lab wash | 0.218 g | [RECALLED, snippet] |

Decomposition of the 0.3 to 0.5 L for the simulator [ESTIMATED]:

```
V_carry = V_sump,res + sum_e(delta_e * A_e) + sum_pools V_pool + V_soil,absorbed

V_sump,res            0.10 to 0.20 L   (sump below pump inlet, hoses, filter, heater)     [-> machine]
films on load         load area about 6 m^2 x 20 to 40 um  = 0.12 to 0.24 L                [-> films]
films on tub/racks    about 3 m^2 x 20 to 40 um            = 0.06 to 0.12 L
pools on items        0 for a well-loaded machine; 0.05 to 0.5 L when items pool
```

Expressed per unit area, the retained film after a drain is 20 to 40 g/m² of load and tub surface (less, 5 to 15 g/m², on hydrophilic surfaces after a rinse-aid final rinse; more on rough, soiled or horizontal surfaces) [ESTIMATED]; `[-> films]` should supply the actual per-element value.

This is where loading skill enters the chemistry: every pooled millilitre is carried through un-diluted unless a jet flushes it.

Dilution per fill, f = V_carry / (V_carry + V_fill) [ESTIMATED]:

| V_carry (L) | V_fill (L) | f | after 2 fills | after 3 fills |
|---|---|---|---|---|
| 0.3 | 3.0 | 0.091 | 0.0083 | 0.00075 |
| 0.4 | 3.5 | 0.103 | 0.0105 | 0.0011 |
| 0.5 | 4.0 | 0.111 | 0.0123 | 0.0014 |

Final-rinse content for a main wash at 4 g/L detergent and 12 g/L soil, V_carry 0.4 L, V_fill 3.5 L [ESTIMATED]:

| Programme structure | Detergent in final rinse | Soil in final rinse |
|---|---|---|
| Main wash, final rinse (short programme) | 410 mg/L | 1.2 g/L |
| Main wash, one intermediate rinse, final rinse | 42 mg/L | 130 mg/L |
| Main wash, two intermediate rinses, final rinse | 4.4 mg/L | 13 mg/L |

Soil still being released from items during the rinses adds to these figures. The rinses are also not perfectly mixed with the retained films: film on a surface that no rinse jet reaches keeps main-wash composition. The per-element film composition must therefore be tracked, not just the sump (§10.2, §10.9).

### 5.7 Turbidity sensing

One control patent describes the logic: turbidity is monitored during an initial wash segment; if it stays stable or below a threshold the cycle proceeds as "normal" to a heated main wash (for example 140 °F); if it is erratic or above threshold the programme switches to "heavy" (one extra pre-wash) or "extreme" (two extra pre-washes); time since last use maps under 3 days to normal, 3 to under 14 days to heavy, 14 days or more to extreme [VERIFIED, S11]. No numeric thresholds are given. Elsewhere: sensor modules are calibrated at 1000 or 4000 NTU; one patent claim uses 2000 NTU as a drain decision threshold; detergent itself raises the reading in agitated water [RECALLED, snippets].

For the simulator [ESTIMATED; calibration]: Turb[NTU] = 1.0 x C_1[mg/L] + 0.5 x C_2[mg/L] + 0.1 x C_0,prot[mg/L] + 30 x F, saturating at 4000. Suggested auto-programme rule at the end of the pre-wash: under 100 NTU light (skip second rinse, lower temperature), 100 to 600 normal, over 600 heavy (repeat pre-wash, raise main wash temperature, add a rinse). `[-> machine]` owns the programme logic.

---

## 6. Thermal model data

### 6.1 Heater and system thermal masses

| Quantity | Value | Conf. |
|---|---|---|
| EU flow-through heater power | 1.8 to 2.2 kW | [RECALLED] `[-> machine]` |
| US exposed-element power (also used for heated dry) | 0.6 to 1.2 kW | [RECALLED] `[-> machine]` |
| Main-wash water mass | 3.0 to 5.0 kg (5 L in the Birmingham machine) | upper value [VERIFIED, S3]; lower [RECALLED] |
| Tub (stainless, about 2.25 m² x 0.5 mm) | about 8 to 9 kg, 4.0 to 4.5 kJ/K | [ESTIMATED] |
| Two racks (coated steel wire) | 4 to 6 kg, 2 to 3 kJ/K | [ESTIMATED] |
| Sump, pump, arms, door liner (plastic, partly coupled) | 3 to 6 kJ/K effective | [ESTIMATED] |
| Machine total effective | 10 to 15 kJ/K | [ESTIMATED] |
| Full load of ceramic and glass plus cutlery (12 to 13 place settings) | 18 to 28 kg, 15 to 24 kJ/K | [ESTIMATED]; compute from the actual items `[-> items]` |
| Heating rate with 2.0 kW, 3.5 kg water, 12 kJ/K machine, 20 kJ/K load, 0.1 kW loss | 2.4 K/min | [ESTIMATED] |
| Heat loss conductance tub to room | 2 to 5 W/K | [ESTIMATED]: 2.25 m² at U about 1 to 2 W/(m² K) |
| Energy check: heat everything 15 to 50 °C, then final rinse to 60 °C | about 0.45 + 0.38 = 0.83 kWh | [ESTIMATED]; consistent with typical 0.8 to 1.0 kWh for a normal programme [RECALLED] |

Structure precedent: the ORNL model treats dish load, tub, wash water and tub air as four lumped thermal capacitances linked by empirical heat- and mass-transfer resistances, with vapour pressure from the ASHRAE correlation, and repeats wash and drain modes followed by a drying mode [VERIFIED, S7 §2]. The authors used "best guess" resistances and give no numbers [VERIFIED, S7 §3]. A Purdue paper measured evaporation and condensation mass-transfer resistances of a standard load in situ; I could not open it (N6).

Saturation vapour pressure over liquid water, T in K, p in Pa [VERIFIED, S7 Eq. 24]:

```
ln(p_ws) = C8/T + C9 + C10*T + C11*T^2 + C12*T^3 + C13*ln(T)
C8 = -5.8002206e3   C9 = 1.3914993      C10 = -4.8640239e-2
C11 = 4.1764768e-5  C12 = -1.4452093e-8 C13 = 6.5459673
```

Moist air specific heat C_air = 1000 + 1820 x W J/(kg K), W the humidity ratio [VERIFIED, S7 Eq. 40]. Values from this correlation: 2.65 kPa at 22 °C, 12.35 kPa at 50 °C, 19.9 kPa at 60 °C, 31.2 kPa at 70 °C; saturated vapour density 0.0194, 0.0828, 0.130, 0.197 kg/m³ at the same temperatures [ESTIMATED by evaluating the formula].

### 6.2 Material properties

Standard handbook values, all [RECALLED] (verify against a materials handbook before publication; ranges reflect composition spread). Areal heat capacity C'' = rho x c x thickness and the last column are [ESTIMATED] from them. The last column is the water film that the sensible heat of one face can evaporate when the item cools by 20 K: m'' = (C''/2) x 20 K / 2.4 MJ/kg.

| Material | rho (kg/m³) | c (J/(kg K)) | k (W/(m K)) | alpha (m²/s) | Typical wall (mm) | C'' (kJ/(m² K)) | Evaporable film per face for 20 K (g/m², equal to µm) |
|---|---|---|---|---|---|---|---|
| Porcelain, vitrified | 2300 to 2500 | 800 to 1000 | 1.2 to 1.8 | 6.9e-7 | 5 | 10.8 | 45 |
| Stoneware | 2100 to 2300 | 800 to 900 | 1.0 to 1.6 | 6.4e-7 | 7 | 13.1 | 55 |
| Earthenware (porous body, glazed) | 1800 to 2100 | 850 | 0.8 to 1.2 | 6e-7 | 6 | 10 | 42 |
| Soda-lime glass | 2500 | 840 | 1.0 | 4.8e-7 | 3 (tumbler); 1 (stemware) | 6.3; 2.1 | 26; 9 |
| Borosilicate glass | 2230 | 830 | 1.14 | 6.2e-7 | 2.5 | 4.6 | 19 |
| Stainless steel 18/10 | 7900 | 500 | 15 | 3.8e-6 | 0.8 (pan wall); 2.5 (cutlery) | 3.2; 9.9 | 13; 41 |
| Aluminium cookware alloy | 2700 | 900 | 120 to 200 | 6e-5 | 3 | 7.3 | 30 |
| Cast iron | 7200 | 460 | 50 | 1.5e-5 | 4 | 13.2 | 55 |
| Polypropylene | 905 | 1700 to 2000 | 0.20 to 0.22 | 1.2e-7 | 1.5 | 2.6 | 11 |
| HDPE | 950 | 1900 to 2300 | 0.45 | 2.3e-7 | 2 | 4.0 | 17 |
| SAN / polystyrene | 1050 to 1080 | 1300 | 0.15 to 0.17 | 1.2e-7 | 2 | 2.8 | 12 |
| Polycarbonate, copolyester | 1180 to 1200 | 1200 to 1500 | 0.20 | 1.3e-7 | 2 | 3.0 | 13 |
| Melamine resin (filled) | 1500 | 1200 to 1700 | 0.4 to 0.5 | 2e-7 | 3 | 6.8 | 28 |
| Silicone rubber | 1100 to 1200 | 1200 to 1300 | 0.2 to 0.3 | 1.7e-7 | 2 | 3.0 | 12 |
| Beech wood, across grain (dry) | 700 | 1700 (rising to about 2400 when wet) | 0.15 to 0.17 | 1.3e-7 | 15 | 17.9 | 74 (but it absorbs water) |
| Polyamide (utensils) | 1140 | 1700 | 0.25 | 1.3e-7 | 3 | 5.8 | 24 |

Water [RECALLED]: density 998 / 988 / 983 / 978 kg/m³, viscosity 1.00 / 0.547 / 0.467 / 0.404 mPa·s, conductivity 0.598 / 0.644 / 0.654 / 0.663 W/(m K), surface tension 72.8 / 67.9 / 66.2 / 64.4 mN/m at 20 / 50 / 60 / 70 °C; specific heat 4.18 kJ/(kg K); latent heat 2454 / 2382 / 2358 kJ/kg at 20 / 50 / 60 °C.

### 6.3 Film-to-surface heat transfer and the lag of item temperature

[ESTIMATED] throughout:

- A laminar falling film of thickness delta has a film-side coefficient of order h_f = 1.9 k_w / delta: 6100 W/(m² K) at delta = 200 µm, 12,000 at 100 µm. In a jet impingement zone it is 1e4 to 1e5 W/(m² K) `[-> jets]`.
- Biot number for a 5 mm porcelain plate wetted on both faces: h_f L / k = 6100 x 0.0025 / 1.5 = 10. Conduction inside the item is limiting, not the film.
- Conduction time constant tau = L² / (2.47 alpha): 3.7 s for porcelain wetted both sides (L = 2.5 mm), 15 s wetted one side (L = 5 mm), 3.5 s for 2 mm PP, about 180 s for a 15 mm wooden board.
- So a continuously wetted surface is at film temperature within seconds. The practical lag comes from intermittent wetting: with wetted time fraction phi_wet the effective coefficient is phi_wet x h_f, and the lumped time constant is C'' / (phi_wet h_f) per wetted face. For porcelain at phi_wet = 0.1 this is about 9 s; at phi_wet = 0.01 about 90 s.
- During heating at 2 K/min a well-wetted item lags the liquor by under 1 K; an item face in spray shadow, heated only by conduction through the item and by condensation from saturated air (h about 10 to 50 W/(m² K) effective), lags by 5 to 15 K and may never reach wash temperature in a short programme.
- The film itself cools as it runs over a cold item early in the heating ramp: a film flow of Gamma kg/(m s) has heat capacity flux Gamma c_w; over a plate height H the film approaches the surface temperature with an e-folding length Gamma c_w / h_f, a few centimetres for thin films. Early in the ramp the lower part of a tall item sees cooler liquid than the top. This matters for fat near its melting point.

Upper versus lower rack: I found no published measurement of the temperature difference between racks in a household machine (searched; hygiene papers from the Bonn/Rhine-Waal group that may contain it could not be opened, N12). Estimate: with alternating arm operation each rack is sprayed about half the time and the upper arm carries less flow, so during ramps the upper-rack load lags the sump by 1 to 3 K more than the lower rack, and a third-level cutlery tray by 2 to 5 K; at the end of a hold of more than 10 min the difference is under 1 K [ESTIMATED]. Calibrate with plate-shaped temperature loggers (§11).

### 6.4 Temperatures actually used by programmes

| Programme data | Value | Conf. |
|---|---|---|
| IKW standard test programme (Miele GSL / GSL 2) | no pre-wash; main wash 45 °C with 8 min hold after reaching temperature; rinse 55 °C | [VERIFIED, S4 Table 3] |
| Miele G 1223 SC GSL 2 programme set | main wash 40, 45, 50 or 65 °C; holds 3/8/55 min (8/20/55 at 40 °C; 10/30/55 at 65 °C); final rinse 55 or 65 °C; one variant with pre-wash | [VERIFIED, S4 Table 2] |
| P&G experimental cycles on a Miele GSL200 | main wash 17 to 69 min at 40 to 50 °C; cold rinse; hot rinse 23 to 26 min at 55 to 65 °C | [VERIFIED, S6] |
| US "normal" main wash example | 140 °F (60 °C) | [VERIFIED, S11] |
| Conventional US final rinse | 54.5 to 57.2 °C | [RECALLED, snippet, N6] |
| Rinse aid addition point in IKW method | by pipette into the clean rinse when it reaches 35 °C | [VERIFIED, S4 §1.6] |
| Spray-arm rotation in the Birmingham machine | 35 rpm, one pass per 1.71 s | [VERIFIED, S3 §7.3.1] |

---

## 7. Pre-wash history of soils

### 7.1 What standard methods do to make soils hard

The test methods encode industry knowledge of which histories make a soil difficult [all VERIFIED, S4]:

| Soil | Ageing protocol before the wash |
|---|---|
| Egg yolk on brushed stainless | air-dry flat 4 h (max 24 h) at room temperature; dip 30 s in boiling water to denature; dry 30 min at 80 °C; store at least 24 h |
| Starch mix on glass | 20.4 g of 3.25 % suspension spread on 177 cm²; dry until visually dry, at least 48 h; then 4 h at 80 °C; warning that the film may peel or flake |
| Minced meat on porcelain | 2 h at 130 °C |
| Crème brûlée on porcelain | 2 h at room temperature, then 2 h at 140 °C |
| Pasta on porcelain | 2 h at 120 °C |
| Milk in glass beakers | microwave-baked 10 min at 450 W, then 2 h at 80 °C |
| Black tea in cups | deposited hot in steps, twice; stored at least 3 days |
| All | stable for at least 14 days at 20 to 25 °C and 40 to 60 % relative humidity |

In an appendix test at Birmingham, 40 g of ketchup sprayed on a Perspex disc was oven-dried 24 h at 60 °C before a quick-wash trial [VERIFIED, S3 Appendix 5]. The commercial egg-yolk tiles used there carry 1.75 ± 0.04 g of sprayed egg yolk on 120 mm x 100 mm with an estimated initial thickness of 68 ± 14 µm, and were kept refrigerated below 5 °C until use [VERIFIED, S3 §3.3]. IEC 60436 dries the soiled load in a thermal cabinet before the test `[-> standards]`.

### 7.2 Physics of drying on a plate

Food soils are soft condensed matter whose properties depend strongly on moisture. At low water content and temperature they are glassy, hard and fragile; with more water or heat they become rubbery, softer and weaker, and this changes the energy needed to clean them [VERIFIED, S3 §2.2.2, citing Liu et al. 2006]. For dried maltodextrin, gum arabic and molasses films on glass, detachment at a given temperature and water content is controlled by the glass transition: the lower the film's glass transition temperature, the drier it must be before it detaches [VERIFIED, S13 abstract]. Adhesive strengths measured by micromanipulation rise with baking time and fall with hydration time and temperature (tomato paste 1 to 20 J/m², egg albumin 0 to 4 J/m²) [RECALLED, snippets] `[-> soils]`.

Drying rate at room conditions [ESTIMATED]: natural-convection mass-transfer coefficient h_m about 4e-3 m/s; surface at wet-bulb about 17 °C, room 22 °C and 50 % RH; vapour density difference 0.0048 kg/m³:

```
j_evap = h_m * (rho_v,sat(T_wb) - RH * rho_v,sat(T_room)) = 1.9e-5 kg/(m^2 s) = 6.9 mg/(cm^2 h)
```

| Deposit | Water to lose | Constant-rate time | Then |
|---|---|---|---|
| Smear, 10 mg/cm² wet (egg yolk at IKW loading, sauce film) | 5 to 8 mg/cm² | about 1 h | falling-rate period, equilibrium with room air (about 8 to 12 % moisture, dry basis) in 3 to 10 h |
| Starch suspension at IKW loading, 115 mg/cm² | 111 mg/cm² | about 16 h | consistent with the method's "at least 48 h" |
| Lump 3 mm thick (porridge, rice, mashed potato) | 250 mg/cm² | 1.5 days if it dried at constant rate | forms a skin within 1 to 2 h; interior stays moist for 1 to 3 days |

State variable: moisture X (kg water per kg dry soil). Suggested lumped drying law, for the game's "hours since the meal" input:

```
dX/dt = - (j_evap / m''_dry) * min(1, (X - X_eq) / (X_c - X_eq))       X_c = 0.5, X_eq = 0.10 at 50 % RH
```

with m''_dry the dry soil mass per area [ESTIMATED; X_c and X_eq are calibration parameters and depend on soil type].

### 7.3 How history changes difficulty

Three separable effects, each a multiplier or state the soil model consumes `[-> soils]` [ESTIMATED; calibration]:

1. **Hydration deficit.** A dry layer must re-absorb liquor before chemistry acts. Lag t_lag is about h_dry² / D_F: for 50 µm at D_F = 2e-11 m²/s about 2 min; for 200 µm about 33 min. Observed lags for the 68 µm egg-yolk layer were 0.4 to 33 min depending on temperature, pH and enzyme [VERIFIED, S3 Table 7.6]; these are longer than h²/D_F with the Fick diffusivities of §2.3 would give for 68 µm (about 4 min at 2e-11 m²/s), so the lag also contains a reaction-onset time and is best fitted, not derived.
2. **Irreversible ageing.** Protein denaturation and cross-linking on heating or drying; starch retrogradation over 12 to 48 h; Maillard and caramel products above about 120 °C; oxidative polymerisation of fat in baking. Model as a strength and enzyme-resistance multiplier A = 1 + a_inf (1 - exp(-t_age / tau_age)) x f_heat, with tau_age = 8 h and a_inf of 2 (starch, cereal), 1 (egg), 0.5 (milk), 0 (fresh fat), and f_heat = 1 for air-dried, 3 for baked at 120 to 140 °C, 6 for burnt-on.
3. **Glassy cracking.** Thin films of low-protein, high-sugar or pure starch soils may crack and lift when very dry, becoming easier (they flake off under the first jet). IKW's peeling warning for starch is this effect [VERIFIED, S4 §5.4].

### 7.4 Scraping, pre-rinsing, soaking, and the machine's pre-wash

I searched for the University of Bonn quantitative studies on pre-rinsing and did not find a retrievable one that isolates pre-rinse effect on machine cleaning score. What I can cite: the Bonn group argues that the standard load and soiling do not represent real conditions and built a consumer-oriented load and soil from food consumed in four European countries (Gorny, Bichler, Stamminger; abstract only) [RECALLED, snippet]; appliance makers recommend scraping, not rinsing [RECALLED, snippet]; the cited hand versus machine comparison found 49.2 ± 27.9 L and 1.7 ± 1.0 kWh for hand washing against 13.2 ± 1.7 L and 1.3 ± 0.1 kWh for the machine on an EN 50242 load, UK consumers [VERIFIED, S3 §1.1, citing Berkholz et al. 2010]. The effect sizes below are therefore my estimates and are calibration parameters.

| User action | Effect on soil state | Effect on liquor |
|---|---|---|
| None | as aged | full soil load |
| Scrape | removes lumps over about 2 mm and most loose material; smear layer unchanged | soil load down 50 to 80 % |
| Pre-rinse under tap | removes loose and soluble soil; adhering film unchanged; rehydrates slightly | soil load down 80 to 95 %; turbidity sensor may select a lighter programme; less protein and fat means enzymes have nothing to protect them from bleach and the liquor less to buffer, which is harmless |
| Soak in water for time t_s | resets hydration: X rises by about sqrt(D t_s) penetration; no effect on irreversible ageing | as scrape |
| Machine pre-wash (cold, 5 to 15 min, no detergent) | removes loose soil and salt/sugar; hydrates adhering soil for the whole pre-wash plus the main-wash ramp; no enzyme, no alkalinity, so swelling of protein is weaker than in the main wash | removes 60 to 85 % of the loose soil to drain before the detergent is dosed, which protects detergent capacity and reduces foam and redeposition later |

One real interaction worth modelling: raw egg and blood coagulate above about 62 to 65 °C [RECALLED]; a hot first fill (US machines on a hot supply) can heat-set them before enzymes act, while cold-fill machines pass through the enzyme-active 30 to 55 °C window first.

---

## 8. End of cycle: final rinse, rinse aid, drying, spots, visual cleanliness

### 8.1 Final rinse

Purpose: dilute carried-over liquor (§5.6), apply rinse aid, and store heat in the load for drying. Typical temperatures 55 to 65 °C in test programmes [VERIFIED, S4, S6]; US conventional 54.5 to 57.2 °C [RECALLED, snippet]; "hygiene" or "extra dry" options about 70 °C [RECALLED].

### 8.2 Rinse aid

| Quantity | Value | Conf. |
|---|---|---|
| IEC reference rinse aid "formula III" is weakly acidic | qualitative | [RECALLED, snippet from EU Ecolabel test framework] |
| Formula III composition | low-foam nonionic (Plurafac LF 221) 12.5 %, sodium cumene sulfonate (40 % solution) 11.5 %, citric acid 5 %, water 71 % | [RECALLED] from memory of the standard; verify `[-> standards]` |
| Dose per cycle | about 3 mL (dispenser settings span roughly 1 to 6 mL) | [RECALLED] |
| Resulting nonionic in a 3.5 L final rinse | about 110 mg/L | [ESTIMATED] |
| Final-rinse surface tension with rinse aid at 60 °C | 30 to 35 mN/m, from 66 mN/m without | [ESTIMATED] |
| Receding contact angle after rinse aid: glass, glazed ceramic, stainless | under 10°: film drains as a sheet | [ESTIMATED] `[-> films]` |
| Receding contact angle after rinse aid: PP, PE, silicone | 30 to 60°, from 80 to 100° without: drops still form, but smaller | [ESTIMATED] `[-> films]` |

"All-in-one" tablets carry a rinse function (polymer and surfactant that survive into the final rinse by carry-over and by slow release), weaker than a dosed rinse aid, particularly with several intermediate rinses [RECALLED].

### 8.3 Drying physics by method

The energy that evaporates water from dishes is the heat stored in the load during the final rinse, and drying performance rises with the energy spent; one experimental study needed more than 1.17 kWh for a drying index above 1.8 [RECALLED, snippet]. Plastic items are cooler at the end of the cycle because they hold less total heat than denser glass and ceramic, so water on them is less likely to evaporate and vapour is more likely to condense on them [VERIFIED, S14]. Plastic and wood "do not have sufficient mass to accumulate energy in the form of heat and have low heat conductivity" [RECALLED, snippet from a service document].

| Method | Mechanism | Parameters for the model | Conf. |
|---|---|---|---|
| Residual heat with condensation on the tub | load at 55 to 70 °C evaporates its film into the tub air; vapour condenses on cooler tub walls or door and runs to the sump | wall condensation conductance; walls cool to room through 2 to 5 W/K | [ESTIMATED] |
| Side-wall heat exchanger | a water-filled panel on the tub wall, filled with cold water for the drying phase, gives a strong cold condensing surface | wall temperature near supply temperature over about 0.2 m² | [RECALLED] `[-> machine]` |
| Fan-assisted condensation | fan moves tub air through a condenser duct | h_c x 3 to 5; air exchange 5 to 15 L/s | [ESTIMATED] |
| Heated dry (US) | exposed element 0.6 to 1.2 kW heats the air; vent opens | adds heat to air and lower rack by radiation | [RECALLED] |
| Zeolite | fan passes tub air through about 1 kg of zeolite; adsorbs up to about a fifth of its mass in water and releases heat, returning hot dry air (up to about 80 °C at the source); regenerated by a heater in the next main wash | adsorbent capacity about 0.2 kg/kg; heat of adsorption about 3.2 to 4 MJ per kg water | capacity and 80 °C [RECALLED, snippet, N15]; heat of adsorption and mass [RECALLED] |
| Automatic door opening | door springs open about 10 cm at the end or when the tub has cooled to a set point; buoyant exchange with the room | exchange flow about 10 L/s initially for a 0.06 m² gap, from Q = C_d (A/3) sqrt(g' H) with g' about 1.15 m/s² and H = 0.6 m | [ESTIMATED] |

Energy bookkeeping for a full load [ESTIMATED]: retained water at the start of drying about 150 to 250 g (films of 15 to 30 µm on about 9 m² plus pooled water); latent heat needed 0.36 to 0.6 MJ; sensible heat released by a 20 kJ/K load cooling 20 K is 0.4 MJ. The budget is marginal on average and strongly non-uniform per item, which the per-face column in §6.2 expresses.

### 8.4 Why plastics stay wet

The model needs four ingredients, each of which is already in the tables [ESTIMATED]:

1. Low areal heat capacity: 1.5 mm PP stores 2.6 kJ/(m² K) against 10.8 for 5 mm porcelain, so one face can evaporate 11 g/m² against 45 g/m² for a 20 K cool-down.
2. Poor wetting: water stands as drops of 10 to 100 µL instead of a 5 to 20 µm sheet. A 20 µL drop needs 48 J; the plastic within reach of it cannot supply that.
3. Low conductivity: lateral heat spreading length sqrt(alpha t) in 10 min is 8 mm in PP, 20 mm in porcelain, 190 mm in aluminium, so a drop on plastic cools its own footprint to the wet-bulb temperature.
4. Then the kinetics are slow: a 20 µL hemispherical drop at 35 °C in 80 % RH air loses about 0.9e-9 kg/s and lasts about 6 h; with the door open (40 % RH, 25 °C) about 3.6 h.

Light plastic items also get flipped by jets and then pool `[-> items]`, which adds R2 redeposition to wetness.

### 8.5 Water spots, films and residue

Spot arithmetic [ESTIMATED]: a drop of volume V that evaporates in place leaves m = V x C_TDS.

| Case | Residue |
|---|---|
| 20 µL drop, final rinse at 300 mg/L dissolved solids, dried footprint 5 mm across | 6 µg on 0.2 cm² = 30 µg/cm², mean thickness about 140 nm and far more at the rim (coffee-ring): visible on glass |
| 5 µm sheeted film, same water | 0.15 µg/cm², under 1 nm: invisible |
| Same drop with softened water but 410 mg/L carried-over detergent (short programme) | 14 µg, alkaline, visible white spot |

Softening by ion exchange does not lower dissolved solids, it swaps calcium for sodium; sodium salts leave soluble spots that wipe off, calcium carbonate leaves hard spots. Rinse aid works by removing the drops, not the solids.

Scale and film index for the main wash [ESTIMATED]: let Ca_free = max(0, Ca_T - capacity of builder) and SI = log10(Ca_free x CO3 / Ksp). Film deposition on glass per cycle is proportional to max(0, SI - SI_crit) x time x exp(-(E_a/R)(1/T - 1/T_ref)) with SI_crit about 1.5 when polymer is present. For a single-cycle game this matters only at high hardness with a failed softener or under-dosed detergent.

### 8.6 What counts as visually clean

Scoring schemes belong to `[-> standards]`. The IKW method scores tea, milk, pasta, minced meat and crème brûlée visually on marks 0 or 1 to 10 against a photo catalogue, with iodine staining to reveal pasta residue and Phloxin B to reveal meat protein residue, and scores starch and egg yolk gravimetrically as percent removed [VERIFIED, S4 §§2 to 9].

Detection thresholds for mapping simulated residue to "visible", for inspection at about 30 cm under bright diffuse light [ESTIMATED; calibration against human panels]:

| Residue | Visible above |
|---|---|
| Discrete particle | 50 to 100 µm diameter on a contrasting background; 3 or more per item is noticed |
| Starch or protein film on glass or dark glaze | 10 to 50 µg/cm² (0.1 to 0.5 µm) as haze; about 1 µg/cm² with iodine |
| Starch or protein film on white ceramic | 100 µg/cm² unless coloured |
| Fat film on glass | 5 to 10 µg/cm² (smear, rainbow); felt as greasy above about 100 µg/cm² |
| Fat film on plastic | 50 µg/cm² by sight, 100 µg/cm² by touch |
| Tea or coffee stain on white ceramic | colour difference Delta E about 2 to 3, corresponding to roughly 5 to 10 % of an IKW-level stain |
| Dried spot on glass | 2 to 5 µg per spot |
| Mineral film on glass | 50 to 100 nm mean thickness |
| Wetness (drying score) | any drop over about 1 µL; IEC counts drops `[-> standards]` |

---

## 9. Evidence on the architecture candidates, and gaps

### 9.1 Evidence for and against (a), (b), (c)

| Observation from this topic | Bearing |
|---|---|
| Liquor turnover is 8 to 15 per minute [ESTIMATED] while the fastest liquor reaction has a half-life of minutes [VERIFIED, S5] | The liquor is a stirred tank. A lumped ODE set is correct for chemistry under (a), (b) or (c). No architecture needs to transport species in 3D, except for the dissolving tablet's neighbourhood and un-flushed pools and films, which are local reservoirs, not 3D fields. |
| Soil removal times are 25 to 65+ min; lags 0.4 to 33 min; arm period 1.7 s [VERIFIED, S3] | Three to four decades of scale separation between hydrodynamic forcing and chemistry. Time-homogenised forcing statistics are the right input. Supports (a). |
| Cleaning of enzyme-sensitive soil was homogeneous over the tile; the jet-impact fraction of time was 1.58 %; dissolution dominated; discontinuous shear cleaned faster than continuous [VERIFIED, S3] | What matters per element is wetted fraction, film renewal, film temperature and occasional shear, not resolved splash dynamics. Supports (a); a resolved method is not needed to get chemistry right for this soil class. |
| Petroleum jelly was not cleaned outside the film jump [VERIFIED, S3 citing Wilson 2014]; fat below its melting range behaves the same way | For non-swelling greasy soils the jet footprint and its shear do matter. The jet/film model in (a) must predict impingement footprints and film-jump radius on arbitrary loaded geometry. This is a requirement on (a), not an argument for (b). |
| A full cycle is 0.5 to 4 h of process time with chemistry state evolving throughout | (b) alone can resolve only tens of seconds within the compute budget `[-> numerics]`, so it cannot integrate chemistry over a cycle. At most it can serve as a generator of wetting and shear statistics for the homogenised model, which is (c). |
| Redeposition and carry-over are controlled by pooled volumes, final film thickness and whether rinse jets flush a pool [ESTIMATED, §5] | These are film/pool quantities on surfaces. (a) handles them natively if the thin-film solver has ponding. A resolved free-surface method handles pooling naturally but only for the seconds it simulates; end-of-phase drainage over minutes is a film problem again. Favours (a), with (c) as validation of pool filling. |
| Drying is an enclosure heat and vapour balance over lumped load, tub, water and air nodes [VERIFIED, S7]; my per-item numbers for areal heat capacity and wettability are [ESTIMATED] | Lumped and per-element; independent of the wash-phase fluid architecture. |
| Tablet dissolution depends on where the tablet lands and how much flow reaches it | Needs the rigid-body result plus local wetting flux; available from (a). |
| Foam reaching the pump lowers flow rate and wash efficiency (qualitative) [VERIFIED, S3 §2.2.3] | A lumped feedback from chemistry to hydraulics; trivial in (a), awkward in (b) (aerated-liquid properties). |

Cost of the chemistry itself: about 25 liquor states plus about 12 states per surface element. At 1e5 to 1e6 elements and 1e3 to 1e4 macro time steps per cycle this is seconds on the GPU `[-> numerics]`. Chemistry does not compete for the 30 min budget; spend that on jets and films.

Conclusion from this topic: (a) is sufficient and natural for chemistry, thermal, redeposition and drying; (c) is worth having only as a way to calibrate or spot-check the wetting, pooling and splash statistics that (a) feeds to the chemistry.

### 9.2 What I looked for and could not get

| Item | Status |
|---|---|
| IEC 60436:2025 reference detergent type E ingredient table; rinse aid formula III table; IEC soil quantities | Paywalled. Type D verified from the 2020 corrigendum; formula III from memory only. |
| Roldán-San Antonio et al. 2024 (Chem. Eng. Sci. 287, 119767): enzyme deactivation rate constants with bleach, pH, temperature; and the 2026 cleaning-kinetics paper (Chem. Eng. Sci. 320) | Open access but fetch blocked (403 / bot wall). Highest-value follow-up: someone should download these by hand. |
| Davies & Deary 1991 rate constants for TAED + HOO- | Paywalled. Derived a rate constant from HERA's Clariant data instead. |
| Olsen & Falholt 1998 enzyme activity curves; Novozymes data sheets | Not retrieved. Activity profile shapes are estimated around verified optima. |
| Tea-stain bleaching rate constants on ceramic | None found in the open literature. Estimated. |
| University of Bonn quantitative data on pre-rinsing, soil drying time before the wash, and consumer soil amounts | Abstracts only; no numbers retrieved. |
| Measured upper-rack versus lower-rack load temperatures | Not found. |
| Measured residual water mass per item after the final rinse; evaporation and condensation resistances (Purdue 2021) | Not retrievable (403). One snippet value for a single glass. |
| Foam versus pump pressure in a household machine | Not found. |
| Turbidity thresholds used by real machines | Not published; patents give logic only. |
| Filter capture efficiency by particle size | Mesh sizes only. |
| Detergent dissolution curves (conductivity versus time) for tablets and pouches in a machine | Not found; patent criteria only. |
| Fat redeposition on plastics, quantitative | Not found. |

---

## 10. Recommended model and defaults

This is what I would implement. Symbols are defined where first used; units are SI unless stated (concentrations of molecular species in mol/m³, which equals mmol/L; masses of formulated products and soils in kg/m³, which equals g/L). Every default in this section is [ESTIMATED] unless a tag says otherwise; the ones resting on verified data are marked.

### 10.1 Structure

Three kinds of reservoir:

1. **Liquor** (sump plus everything in circulation): one well-mixed tank with volume V_w and temperature T_w.
2. **Surface films**, one per surface element e of every item and of the tub: thickness delta_e (from `[-> films]`), composition vector c_e, temperature T_f,e.
3. **Pools**: discrete ponded volumes V_p with composition c_p (from `[-> films]` ponding).

Plus the soil layers on each element (`[-> soils]`), the solid thermal nodes, and the tub air.

Liquor state vector y (25 states):

| Symbol | Meaning | Unit |
|---|---|---|
| V_w, T_w | liquor volume, temperature | m³, K |
| m_tab, s_film | undissolved dose mass; pouch film integrity 0..1 | kg, - |
| C_carb | total carbonate (added as Na2CO3 plus supply bicarbonate) | mol/m³ |
| B_s | strong-base excess from silicate | eq/m³ |
| A_ac | acid equivalents released by soils and rinse aid | eq/m³ |
| C_ch | chelant capacity (strong sequestrant, as Ca equivalents) | mol/m³ |
| C_cit | citrate | mol/m³ |
| Ca_T | total hardness (Ca + Mg) | mol/m³ |
| HP | total hydrogen peroxide | mol/m³ |
| TAED | undissolved-plus-dissolved activator (acetyl donor, counted as TAED) | mol/m³ |
| PAA | total peracetic acid | mol/m³ |
| E_P, E_A | active protease, active amylase (granulate-equivalent mass) | kg/m³ |
| C_surf, C_poly, C_RA | nonionic surfactant, dispersant polymer, rinse-aid surfactant | kg/m³ |
| C_0p, C_0s, C_0x | dissolved protein, dissolved carbohydrate, other dissolved solids | kg/m³ |
| C_tan | dissolved chromophore (tea, coffee, tomato pigment in fat) | kg/m³ |
| C_1 | dispersed fat (liquid plus solid) | kg/m³ |
| C_2, C_3 | suspended fines (20 to 150 µm), grit (150 to 1000 µm) | kg/m³ |
| M_filt | soil mass held on the filter | kg |
| F | foam state 0..1 | - |

Derived algebraically each step: pH, HOO- fraction, free Ca, free chelant fraction X_ch, free fat C_fat,free, turbidity, TDS.

### 10.2 Phase events

Fill with volume V_fill of supply water (hardness Ca_s after the softener, bicarbonate alkalinity, temperature T_s, dissolved solids TDS_s):

```
V_w   <- V_res + V_fill                      V_res = liquor left in sump and hydraulics after the previous drain
c_j   <- (c_j * V_res + c_j,supply * V_fill) / V_w        for every species j
T_w   <- (V_res * T_w + V_fill * T_s) / V_w
```

Drain: V_w <- V_res; films and pools keep their own volumes and compositions. Total carry-over into the next phase is V_res + sum(delta_e A_e) + sum(V_p), with defaults V_res = 0.15 L and the film and pool terms from `[-> films]`; the verified total for a normally loaded machine is 0.3 to 0.5 L [VERIFIED, S3 §1.3].

Film and pool exchange during circulation:

```
d(c_e)/dt = (q_e / delta_e) * (c_liq - c_e) + s_e / delta_e
d(c_p)/dt = (Q_p / V_p) * (c_liq - c_p) + S_p / V_p
```

q_e is the time-averaged liquid flux renewing the film on element e (m/s, volume per area per time), Q_p the inflow to pool p (m³/s), s_e and S_p the soil release from the underlying soil layer. Elements with q_e/delta_e above about 0.1 s^-1 can be set to c_e = c_liq. Elements and pools with no inflow in a phase keep the previous phase's liquor. This single mechanism produces spray-shadow detergent residue, dirty pooled water and poor rinsing.

### 10.3 Detergent release

```
t < t_open:                         no release
lid blocked (geometry test):        w_tab = w_stuck = 0.05
pouch film:   d(s_film)/dt = - w_tab / tau_film(T),   tau_film(T) = tau_film,ref * exp[(E_film/R) * (1/T - 1/313.15)]
contents (once s_film <= 0):
              d(m_tab)/dt = - (3 * m_0 / tau_tab(T)) * w_tab * (m_tab / m_0)^(2/3)
              tau_tab(T)  = tau_tab,ref * exp[(E_tab/R) * (1/T - 1/313.15)]
release of species j:   d(c_j)/dt += x_j * (- d(m_tab)/dt) / V_w
w_tab = min(1, q_tab / q_ref)
```

m_0 is the dose, x_j the mass (or mole per kg) fraction of species j, q_tab the time-averaged liquid flux onto the tablet's resting place from the jet/film solver, T the local liquid temperature. With constant conditions m_tab = m_0 (1 - w t / tau)³.

| Parameter | Tablet | Powder | Pouch | Gel |
|---|---|---|---|---|
| tau_tab,ref at 40 °C (s) | 480 | 90 | 180 | 20 |
| E_tab (kJ/mol) | 25 | 25 | 25 | 10 |
| tau_film,ref at 40 °C (s) | 0 | 0 | 60 | 0 |
| E_film (kJ/mol) | n/a | n/a | 60 | n/a |

q_ref = 0.5 kg/(m² s). t_open = 60 to 180 s after the start of main-wash circulation. Multi-phase tablets: give each species group its own tau (for example enzymes 0.5 x, bleach 2 x).

Composition vector x for IEC type D (mass fractions [VERIFIED, S1]; the unit conversions below are [ESTIMATED]): carbonate 4.36 mol/kg (as Na2CO3, 46.2 % including carrier and percarbonate-derived), silicate base 0.55 eq/kg, citrate 1.02 mol/kg, chelant capacity 0.18 mol/kg (polymer only), H2O2 0.67 mol/kg, TAED 0.088 mol/kg, protease 0.010 kg/kg, amylase 0.005 kg/kg, nonionic 0.020 kg/kg, polymer 0.060 kg/kg, other dissolved solids to make 1 kg/kg.

### 10.4 Acid-base and hardness

Solve for [H+] each step from the alkalinity balance (bisection, 30 iterations):

```
Alk = 2 * C_carb,Na2CO3 + C_bicarb,supply + B_s - A_ac
Alk = C_carb * (K1*H + 2*K1*K2) / (H^2 + K1*H + K1*K2) + Kw/H - H          (mol/L units inside the solver)
pH  = -log10(H) + dpH_ni

pK1(T) = 6.35 - 0.002  * (T_C - 25)
pK2(T) = 10.33 - 0.0064 * (T_C - 25)
pKw(T) = 14.00 - 0.0300 * (T_C - 25) + 0.00006 * (T_C - 25)^2
pKa,HP(T) = 11.6 - 0.017 * (T_C - 25)
f_HOO = 1 / (1 + 10^(pKa,HP - pH))                 C_HOO = f_HOO * HP
```

pK values at 25 °C [RECALLED]; temperature slopes fitted to recalled values at 50 and 60 °C [ESTIMATED]. dpH_ni = -0.3 is a lumped non-ideality offset (calibration). Result for type D at 4.1 g/L: pH 10.8 at 45 °C, 10.7 at 50 °C, 10.3 at 70 °C.

Hardness:

```
Ca_free = max(0, Ca_T - C_ch) / (1 + K_cit * C_cit)        K_cit = 3.0 m^3/mol (log K about 3.5)   [RECALLED]
X_ch    = max(0, 1 - Ca_T / (C_ch + 0.3 * C_cit))          free chelant fraction, 0..1
SI      = log10( Ca_free * CO3 / Ksp ),  Ksp = 3.3e-9 (mol/L)^2 at 25 C, falling about 1.5 %/K     [RECALLED]
```

### 10.5 Bleach and enzyme species in the liquor

```
r_per = k_per(T) * C_HOO * TAED                          k_per = 1.0e-2 m^3/(mol s) at 296 K (10 L/(mol s)), E = 45 kJ/mol
r_hyd = k_per(T) * f_HOO * K_r * TAED                     K_r = 3 mol/m^3
d(TAED)/dt = release - r_per - r_hyd
d(PAA)/dt  = 2 * r_per - [k_dec(T) + k_soil * C_org] * PAA - (1/V_w) * sum_e A_e * J_PAA,e
d(HP)/dt   = release - 2 * r_per - k_HPdec * HP

k_dec(T) = 5.8e-4 1/s * exp[-(60e3/R) * (1/T - 1/323.15)]
k_soil   = 2e-5 m^3/(kg s),   C_org = C_0p + C_0s + C_1 + C_2 + C_3
k_HPdec  = 1e-5 1/s

d(E_i)/dt = release - [k_th,i(T) + k_ox,i * PAA + k_oxHP,i * HP] * E_i          i = P, A
k_th,i(T) = (ln 2 / t_half,i) * exp[-(E_d,i/R) * (1/T - 1/333.15)]
```

k_per and K_r are derived from verified HERA data (§3.2). The rest:

| Parameter | Protease | Amylase (standard) | Amylase (oxidation-stable) |
|---|---|---|---|
| t_half at 60 °C (s) | 1800 | 3600 | 3600 |
| E_d (kJ/mol) | 200 | 220 | 220 |
| k_ox, by peracid (m³/(mol s)) | 1e-4 | 6e-4 | 6e-5 |
| k_oxHP, by peroxide (m³/(mol s)) | 5e-6 | 1e-5 | 2e-6 |

Implied thermal half-lives: protease 280 min at 50 °C, 30 min at 60 °C, 3.7 min at 70 °C; amylase 700 min, 60 min, 5.9 min. The direction (bleach and heat destroy enzymes, amylase more bleach-sensitive) is verified [S6]; the magnitudes are placeholders for N1.

### 10.6 Coupling to the per-surface-element soil model

**Chemistry interface.** Each macro step the liquor model hands every element the vector

```
Xi_e = { T_f,e, pH_e, E_P,e, E_A,e, PAA_e, C_HOO,e, C_surf,e, X_ch,e, Ca_free,e, C_fat,free, C_2, C_3, C_TDS,e }
```

taken from the element's film composition c_e (equal to the liquor for well-renewed films), together with phi_wet,e (fraction of time a liquid film is present) and the shear statistics from `[-> jets, films]`.

**Rate functions the soil model calls.**

```
Temperature (enzyme activity, normalised to 1 at 50 C):
  f_T,i(T) = exp[-(E_a,i/R) * (1/T - 1/323.15)] * (1 + exp[(dH_i/R) * (1/T_m,i - 1/323.15)]) / (1 + exp[(dH_i/R) * (1/T_m,i - 1/T)])
  protease: E_a = 25 kJ/mol, T_m = 336.15 K, dH = 300 kJ/mol   -> 0.55 at 30 C, 0.75 at 40 C, 1.00 at 50 C, 1.09 at 55 C, 0.97 at 60 C, 0.53 at 65 C, 0.18 at 70 C
  amylase:  E_a = 30 kJ/mol, T_m = 343.15 K, dH = 300 kJ/mol   -> 0.48 at 30 C, 0.70 at 40 C, 1.00 at 50 C, 1.34 at 60 C, 1.36 at 65 C, 0.96 at 70 C

pH:
  f_pH,P(pH) = 10^(0.40 * (pH - 10.5))          valid 9.5..11.5; clamp to pH 8..12       [ESTIMATED from S3 Table 7.3]
  f_pH,S(pH) = 10^(0.20 * (pH - 10.5))

Enzyme concentration (normalised to 1 at E_ref):
  f_E(E) = [E^n / (K^n + E^n)] / [E_ref^n / (K^n + E_ref^n)]
  protease: n = 2, K = 0.05 kg/m^3, E_ref = 0.06 kg/m^3     -> 0.23 at 0.02, 0.66 at 0.04, 1.00 at 0.06, 1.36 at 0.10
  amylase:  n = 2, K = 0.02 kg/m^3, E_ref = 0.02 kg/m^3

Non-enzymatic alkaline path:
  f_alk,P(T, pH) = 0.10 * exp[-(60e3/R) * (1/T - 1/323.15)] * 10^(0.6 * (pH - 10.5))
  f_alk,S(T)     = 0.05 * exp[-(40e3/R) * (1/T - 1/323.15)]
```

**Chemical erosion flux** (dry soil mass per area per time, zero order, acts after the hydration lag whenever the element is wet; removal is layer by layer, a qualitative statement [VERIFIED, S3 §2.2.3]):

```
J_P,e = J_P,ref * phi_wet,e * [ f_T,P * f_pH,P * f_E(E_P,e) + f_alk,P ] / A_age          protein soils
J_S,e = J_S,ref * phi_wet,e * [ f_T,A * f_pH,S * f_E(E_A,e) / (1 + Ca_free/K_Ca) + f_alk,S ] / A_age     starch soils

J_P,ref = 3.7e-5 kg/(m^2 s)      K_Ca = 1 mol/m^3
J_S,ref = 4.0e-5 kg/(m^2 s)
```

J_P,ref is derived from verified data: 1.75 % per min at 55 °C, pH 10.5, 0.06 g/L on a tile of 14.6 mg/cm² [S3 Table 7.1, §3.3], corrected to 50 °C with 24 kJ/mol. J_S,ref is a placeholder chosen so that the IKW starch layer (37.5 g/m²) clears in about 15 min at 50 °C with reference amylase. Soil-specific multipliers on J_ref (egg yolk 1; milk 2; minced meat 0.6; cheese 0.5; porridge and oat 0.7; pasta 0.8) are calibration parameters owned jointly with `[-> soils]`.

**Shear-assisted removal** is the soil model's business. Chemistry's contribution is that the bench data show the same temperature, pH and enzyme dependence for the shear-assisted rate as for dissolution (exponents within 10 %, §2.3), so the soil model can multiply its cohesive-strength reduction rate by the same bracket [ f_T f_pH f_E + f_alk ].

**Hydration** uses D_F(T, pH) from §2.3 [ESTIMATED from S3 Table 6.8]. Lag default: t_lag = t_lag,ref / (f_T,P x f_pH,P^0.5) x (h_dry / 68 µm)², t_lag,ref = 300 s; observed range 0.4 to 33 min [VERIFIED, S3 Table 7.6].

**Bleachable stains:** §3.4 rate law per element, with consumption J_PAA,e = nu x m''_tea,0 x (-d theta/dt), nu = 5 mol peracid per kg stain.

**Fat:**

```
SFC_e   = SFC_max / (1 + exp((T_s,e - T50) / w))                          per fat type, section 4.2
mobile  = SFC_e < 0.03;  soft = 0.03..0.10;  solid = > 0.10
gamma_ow = gamma_min + (gamma_0 - gamma_min) / (1 + C_surf / C_gamma)     gamma_0 = 0.027 N/m, gamma_min = 0.002 N/m, C_gamma = 0.02 kg/m^3
roll-up factor a_ru = 1.0 (glass, glazed ceramic, stainless), 0.5 (melamine, PTFE), 0.15 (PP, PE, silicone)
tau_y   = 3e5 Pa * SFC_e^3.5
```

`[-> soils]` turns these into a removal flux: mobile fat leaves with any renewing film at a rate limited by a_ru and gamma_ow; soft fat only where film or jet shear exceeds tau_y; solid fat only under direct jets.

**Soil release into the liquor.** Removed mass enters liquor classes by soil type:

| Soil type | dissolved C_0 | fat C_1 | fines C_2 | grit C_3 | coarse (to filter) |
|---|---|---|---|---|---|
| Protein films (egg, milk, meat juice) | 0.7 | 0 | 0.2 | 0.1 | 0 |
| Starch films (pasta water, potato, sauce) | 0.8 | 0 | 0.2 | 0 | 0 |
| Fats, oils, butter | 0 | 1.0 | 0 | 0 | 0 |
| Particulate foods (rice, oat flakes, spinach, herbs, coffee grounds) | 0.1 | 0 | 0.3 | 0.5 | 0.1 |
| Minced meat, cheese | 0.3 | 0.2 | 0.3 | 0.2 | 0 |
| Tea, coffee, wine stain | 1.0 (to C_tan) | 0 | 0 | 0 | 0 |

### 10.7 Soil in the liquor

```
V_w * d(C_k)/dt = sum_e A_e * J_e,k  +  k_leach,k * M_filt  -  Q_c * eta_k * C_k  -  sum_e A_e * j_dep,e,k        k = 2, 3
d(M_filt)/dt    = Q_c * sum_k eta_k * C_k + coarse input - sum_k k_leach,k * M_filt
V_w * d(C_1)/dt = sum_e A_e * J_e,fat - sum_e A_e * j_fat,e
```

Q_c circulation flow `[-> machine]`; eta_2 = 0.02 + 0.18 x L_f, eta_3 = 0.6 + 0.3 x L_f with filter loading L_f = min(1, M_filt / 0.02 kg); k_leach = 2e-4 s^-1 to class 0 and 5e-5 s^-1 to class 2 (enzymatic and mechanical breakdown of captured food). Filter throttling: Q_c = Q_c,0 x (1 - 0.3 x L_f²).

Fat stabilisation and deposition (§5.4):

```
M_stab     = min(C_1 * V_w * (1 - SFC(T_w)), 30 * C_surf * V_w + 2 * C_0p * V_w + 10 * M_soap)
C_fat,free = C_1 - M_stab / V_w
j_fat,e    = k_fat,dep * C_fat,free * a_sub,e * (1 + 5 * SFC(T_s,e)) * phi_wet,e          k_fat,dep = 1e-6 m/s
a_sub      = 1.0 (PP, PE, silicone), 0.4 (melamine, SAN, PC, PTFE), 0.05 (glass, ceramic, stainless)
M_soap     = 0.03 * (fat mass released)        (free fatty acid fraction; consumes A_ac += M_soap / 0.28 kg/mol)
```

### 10.8 Foam, turbidity, scale

Foam: §5.5 equations as written. Turbidity: §5.7. Scale index: §10.4 SI; glass film increment per phase = k_sc x max(0, SI - 1.5) x t_phase x phi_wet, k_sc = 1e-10 kg/(m² s) (one visible film in about 10 hard-water cycles; essentially invisible in one).

### 10.9 End-of-phase deposition

When the final rinse stops, for each element and pool (delta_e,end and pool depths from `[-> films]` after drainage):

```
film:      m''_dep,e = delta_e,end * (C_TDS,e + C_0,e + C_1,e) + sum_k C_k,e * min(delta_strand,k, delta_e,drain)
pool:      m''_dep,p = h_p * (C_TDS,p + C_0,p + C_1,p + C_2,p + C_3,p)   over the pool footprint, concentrated toward the last-drying point
drops:     each retained drop of volume V_d leaves V_d * (C_TDS + C_0) on its footprint, rim-weighted
delta_strand,2 = 100e-6 m, delta_strand,3 = 400e-6 m; delta_e,drain = film thickness 5 s after spraying stops
```

The same bookkeeping at the end of the main wash and intermediate rinses sets what the next phase must rinse off. Deposits are scored against the visibility thresholds of §8.6.

### 10.10 Thermal model

```
Liquor:   M_w c_w dT_w/dt = eta_h P_h u_h - sum_e phi_wet,e h_f A_e (T_w - T_s,e) - G_wt (T_w - T_tub) - mdot_ev h_fg
Tub:      C_tub dT_tub/dt = G_wt (T_w - T_tub) - G_loss (T_tub - T_room) + condensation heat
Element:  C''_e dT_s,e/dt = phi_wet,e h_f (T_f,e - T_s,e) + (1 - phi_wet,e) h_a (T_air - T_s,e) - j_e h_fg
Thick or low-conductivity items (wood, cast iron, plastic over 3 mm, stoneware over 6 mm): 3 through-thickness nodes instead of one
```

| Parameter | Default | Range |
|---|---|---|
| P_h heater power | 2000 W | 1800 to 2200 (EU); 600 to 1200 (US) `[-> machine]` |
| eta_h | 0.97 | 0.9 to 1.0 |
| h_f film coefficient | 5000 W/(m² K) | 2000 to 20,000; or 1.9 k_w/delta from `[-> films]` |
| h_a humid-air coefficient during circulation | 30 W/(m² K) | 10 to 100 (includes condensation) |
| G_wt liquor to tub | 200 W/K | 100 to 500 |
| G_loss tub to room | 3.5 W/K | 2 to 5 |
| C_tub effective | 12 kJ/K | 10 to 15 |
| C''_e | from §6.2 and item geometry `[-> items]` | |
| T_room, T_supply | 22 °C, 15 °C | supply 15 or 20 °C [VERIFIED, S4]; hot-fill 49 °C (US) [RECALLED] |

The control law (u_h, set-points, holds) belongs to `[-> machine]`.

### 10.11 Drying model

Per element with retained water m''_w,e (film) or drops:

```
j_e = h_m * (rho_v,sat(T_s,e) - rho_v,air) * a_wet,e          (negative j_e is condensation and adds water)
h_m = h_c / (rho_air * c_p,air * Le^(2/3)),  Le = 0.85
d(m''_w,e)/dt = - j_e
C''_e dT_s,e/dt = h_c (T_air - T_s,e) - j_e h_fg + conduction from deeper nodes

Air:   V_air d(rho_v,air)/dt = sum_e A_e j_e - h_m A_wall max(0, rho_v,air - rho_v,sat(T_wall)) - Q_vent (rho_v,air - rho_v,room) - mdot_ads
       V_air rho_air c_p dT_air/dt = sum_e h_c A_e (T_s,e - T_air) + h_c A_wall (T_wall - T_air) - Q_vent rho_air c_p (T_air - T_room) + P_fan,heat
rho_v,sat(T) = p_ws(T) / (461.5 * T),  p_ws from section 6.1  [VERIFIED, S7 Eq. 24]
```

a_wet,e = 1 for a sheeted film; for drops a_wet,e = N_d x 2 pi r_d² / A_e. Elements are "dry" when m''_w,e is below 0.1 g/m² and no drop above 1 µL remains.

| Parameter | Default | Range |
|---|---|---|
| h_c natural convection in the loaded tub | 4 W/(m² K) | 3 to 8 |
| h_c with fan | 15 W/(m² K) | 10 to 25 |
| V_air | 0.12 m³ | 0.10 to 0.15 |
| A_wall condensing | 1.5 m² | 1.0 to 2.25 |
| Q_vent, door closed | 0.05 L/s | 0 to 0.3 (leakage, vent) |
| Q_vent, auto-open door | 10 L/s falling with (T_air - T_room)^0.5 | 5 to 20 |
| Zeolite | mdot_ads = Q_fan rho_v,air until 0.2 kg adsorbed; Q_fan = 10 L/s; returns 3.5 MJ per kg adsorbed as air heat | capacity 0.15 to 0.25 kg; capacity fraction [RECALLED, snippet] |
| Final-rinse retained film, hydrophilic with rinse aid | 5 to 15 µm | from `[-> films]` |
| Final-rinse retained water, hydrophobic | drops 5 to 50 µL, 500 to 3000 per m² | from `[-> films]` |

### 10.12 Default cycle programmes with chemistry timeline

Programme tables are illustrative defaults assembled from the verified test programmes (§6.4) and from memory of consumer machines; `[-> machine]` is authoritative. Durations and volumes are [RECALLED] unless a cell cites a source.

| Programme | Pre-wash | Main wash | Intermediate rinses | Final rinse | Drying | Total |
|---|---|---|---|---|---|---|
| IKW-STD (lab reference) | none | fill, dose at lid opening, heat to 45 °C, hold 8 min [VERIFIED, S4] | 1 cold, 5 min | heat to 55 °C [VERIFIED, S4]; rinse aid at 35 °C [VERIFIED, S4] | residual heat, 20 min | about 75 min |
| ECO-50 | none (or 8 min cold) | 3.5 L; heat 17 to 50 °C in about 20 min; hold with intermittent circulation; 75 to 90 min | 1 cold, 3.0 L, 6 min | 3.2 L; heat to 60 °C; hold 5 min; 25 min | 60 to 90 min closed, then door opens | 3 h 15 to 3 h 55; 9.5 to 10 L |
| AUTO 45 to 65 | by turbidity: 0, 1 or 2 pre-washes of 4 L, 8 min | 4 L; 45, 55 or 65 °C by soil level; 30 to 60 min | 1 or 2 by turbidity | 65 °C | 30 to 60 min | 1 h 30 to 2 h 45; 7 to 18 L |
| QUICK-45 | none | 4 L; heat to 45 °C; 15 to 18 min total | 1 cold, 3 min | 3.5 L; 50 to 55 °C; 8 min | none | 30 to 40 min; 10 to 11 L |
| ONE-HOUR-65 | none | 4 L; heat to 65 °C; 25 min | 1 | 70 °C; 12 min | 10 min | 60 min |
| INTENSIVE-70 | 4 L, warm to 45 °C, 10 min, no detergent | 4 L; heat to 70 °C; hold 20 to 30 min; 50 min | 2 | 70 °C | 45 min | 2 h 15; 12 to 15 L |
| US-NORMAL | 1 or 2 fills on hot supply at about 49 °C | heat to 55 to 60 °C (140 °F example [VERIFIED, S11]); 20 to 40 min | 1 or 2 | 60 to 68 °C | heated dry 30 min | 2 to 2 h 30 |

Reference chemistry timelines from my implementation of §10.3 to §10.6 (type D, 14.5 g in 3.5 L = 4.1 g/L, tablet, heavy soil 12 g/L, softened water so X_ch = 1, 1.9 kW into 46.7 kJ/K, fully wetted reference element, no ageing multiplier, lag 300 s; all [ESTIMATED] model output, to be used as regression targets for the engineers' implementation, not as data):

ECO-50 main wash:

| t (min) | T_w (°C) | pH | dose dissolved | PAA (mmol/L) | protease (mg/L) | amylase (mg/L) | tea removed | egg yolk removed | starch film removed |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 17 | 7.8 | 0.00 | 0.00 | 0 | 0 | 0.00 | 0.00 | 0.00 |
| 10 | 41 | 10.8 | 0.99 | 0.23 | 41 | 20 | 0.07 | 0.03 | 0.12 |
| 20 | 50 | 10.7 | 1.00 | 0.15 | 40 | 18 | 0.36 | 0.17 | 0.73 |
| 30 | 50 | 10.7 | 1.00 | 0.09 | 38 | 17 | 0.51 | 0.30 | 1.00 |
| 50 | 50 | 10.7 | 1.00 | 0.03 | 35 | 16 | 0.63 | 0.55 | 1.00 |
| 70 | 50 | 10.7 | 1.00 | 0.01 | 33 | 15 | 0.68 | 0.78 | 1.00 |
| 90 | 50 | 10.7 | 1.00 | 0.00 | 31 | 14 | 0.70 | 1.00 | 1.00 |

Other programmes, end of main wash:

| Programme | t (min) | T_w (°C) | pH | PAA peak (mmol/L) | protease left (mg/L) | tea removed | egg yolk removed | starch film removed |
|---|---|---|---|---|---|---|---|---|
| IKW-STD (45 °C + 8 min) | 22 | 45 | 10.8 | 0.23 | 40 | 0.34 | 0.20 | 0.79 |
| QUICK-45 | 18 | 45 | 10.8 | 0.23 | 40 | 0.27 | 0.15 | 0.58 |
| INTENSIVE-70 (from 30 °C) | 50 | 70 | 10.3 | 0.20 | 0 (gone by 30 min) | 0.79 | 0.27 | 1.00 |
| ECO-50, lid blocked, 15 % of dose released | 90 | 50 | 10.1 | 0.01 | 5 | 0.05 | 0.09 | 0.48 |

Things these tables show, each of which is a testable prediction:

- Peracid peaks about 10 min after the lid opens at roughly one-third of theoretical and is mostly gone by 40 min. Tea removal saturates; extra time does not help, extra temperature does.
- Egg yolk needs time in the 45 to 60 °C window with active protease. The 70 °C programme kills the protease within about 10 min of reaching temperature and, in this parameterisation, removes less egg yolk than ECO-50. Whether real machines show this depends on enzyme thermostability (modern engineered proteases are more stable than the defaults) and on how slowly the programme ramps. This is a prime calibration target (§11).
- A blocked lid is catastrophic for enzyme- and bleach-dependent soils but still removes about half of a starch film through hydration and the residual amylase; fats and loose soils are barely affected.
- Short programmes leave bleachable and proteinaceous soils largely in place and, with a single rinse, leave about 400 mg/L of detergent in the final rinse (§5.6).

### 10.13 Numerical notes

- Stiffness: tablet dissolution and TAED perhydrolysis have time constants of 100 to 500 s; fill and drain events are discontinuities. A fixed macro step of 1 to 5 s with explicit Euler is stable for everything except the film-composition relaxation (q_e/delta_e up to 10 s^-1), which should be integrated exactly: c_e <- c_liq + (c_e - c_liq) exp(-q_e dt / delta_e).
- Solve pH by bisection once per macro step for the liquor and reuse it for all well-renewed elements; solve separately only for stagnant films and pools (a few hundred at most).
- Order within a step: hydraulics and foam feedback, jets/films statistics (or lookup from the homogenised tables), thermal, liquor ODEs, per-element film exchange, per-element soil chemistry, soil release back to the liquor.
- Conservation checks to assert every step: total mass of each soil class (on items + in liquor + on filter + drained + deposited) and total energy.

---

## 11. Calibration parameters

Ordered by expected influence on scores. "How" names the cheapest real-world test.

| # | Parameter | Default | Expected range | How to measure |
|---|---|---|---|---|
| 1 | Carry-over volume and its split (sump residual, films, pools) | 0.4 L total; V_res 0.15 L | 0.25 to 0.6 L; pools 0 to 0.5 L by loading | Conductivity or dye tracer: dose salt in main wash, sample sump at the end of each later phase; repeat with deliberately pooling items |
| 2 | Protease response shape f_E (n, K) at machine conditions | n = 2, K = 0.05 g/L | n 0.3 to 3; K 0.02 to 0.08 | Egg-yolk tiles with a camera at 3 to 5 enzyme levels, as in S3 §7.2 |
| 3 | Protease thermal half-life in liquor at 60, 65, 70 °C | 30, 10, 3.7 min | 60 °C: 10 to 240 min | Sample liquor and assay activity (AAPF) during 60 to 70 °C holds; or egg-yolk removal in ECO-50 versus INTENSIVE-70 |
| 4 | Reference erosion fluxes J_P,ref, J_S,ref and soil-type multipliers | 3.7e-5, 4.0e-5 kg/(m² s) | x 0.3 to x 3 | Gravimetric IKW egg yolk and starch plates at fixed programme |
| 5 | pH plateau and dpH_ni | 10.5 to 10.7; -0.3 | 9.8 to 11.2; -0.5 to 0 | pH logger in the sump (as in S6) |
| 6 | Tablet dissolution time tau_tab,ref, E_tab, w_tab mapping | 480 s at 40 °C; 25 kJ/mol; q_ref 0.5 kg/(m² s) | 200 to 900 s; 10 to 40; x 0.3 to x 3 | Sump conductivity versus time for tablet placed in dispenser, sump, cutlery basket, on a plate; lid-blocked case |
| 7 | Peracid yield (K_r) and decay (k_dec, k_soil) | 3 mmol/L; 5.8e-4 s^-1 at 50 °C; 2e-5 m³/(kg s) | 1 to 6; 2e-4 to 2e-3; 0 to 1e-4 | Iodometric or test-strip peracid in sump samples, with and without ballast soil |
| 8 | Tea bleaching k_bl, activation energy, chelant factor beta_ch | 0.8 L/(mol s) at 45 °C; 60 kJ/mol; 2 | 0.3 to 3; 40 to 80; 0 to 5 | IKW tea cups at 45, 55, 65 °C; with and without softened water |
| 9 | Amylase bleach sensitivity k_ox,A | 6e-4 m³/(mol s) | 6e-5 to 2e-3 | Starch plates with and without TAED (as in S6) |
| 10 | Fat: SFC curves per fat, tau_y scaling, k_fat,dep, a_sub | §4.2, §5.4 | T50 ± 4 K; k_fat,dep 1e-7 to 1e-5 m/s | Weighed fat on steel, glass, PP at 40, 45, 50, 55 °C; solvent-extract and weigh redeposit on clean PP items |
| 11 | Emulsifying capacity kappa_s | 30 g/g | 10 to 60 | Same test with stepped fat load |
| 12 | Filter capture efficiencies eta_2, eta_3 and leach rates | 0.02 to 0.2; 0.6 to 0.9 | measure | Sieve-classified test particles (ground coffee, spinach), sample sump over time; count specks in inverted glasses |
| 13 | Stranding thicknesses delta_strand,k | 100 µm, 400 µm | 50 to 300; 200 to 800 | Speck counts versus sump particle concentration |
| 14 | Hydration lag t_lag,ref and age multiplier A (a_inf, tau_age, f_heat) per soil | 300 s; §7.3 | lag 60 to 1200 s; a_inf 0 to 5; tau_age 2 to 24 h | Same soils dried 1, 4, 12, 24, 72 h at 22 °C and 50 % RH, and baked; wash on fixed programme |
| 15 | Room drying parameters X_c, X_eq, h_m | 0.5, 0.10, 4e-3 m/s | 0.3 to 1.0; 0.05 to 0.2; 2e-3 to 8e-3 | Balance logging of soiled plates |
| 16 | Thermal: G_loss, C_tub, h_f, load heating lag by rack | 3.5 W/K; 12 kJ/K; 5000 W/(m² K); 1 to 3 K | see §10.10 | Thermocouples on plates in each rack and in the sump; cool-down curve with door closed |
| 17 | Drying: h_c, A_wall, wall temperature history, Q_vent for door-open, zeolite capacity | §10.11 | see §10.11 | Weigh the whole load (and selected items) immediately after the final-rinse drain and at 10 min intervals; humidity logger in the tub |
| 18 | Retained water after final rinse by material and orientation | 5 to 15 µm film; drops on plastics | measure | Per-item weighing; with and without rinse aid |
| 19 | Foam model constants and pump pressure sensitivity | §5.5 | order of magnitude | Pump pressure and arm speed versus dosed egg or milk, with and without detergent |
| 20 | Turbidity mapping and programme thresholds | §5.7 | order of magnitude | Read the machine's sensor (service mode) against dosed soil |
| 21 | Visibility thresholds | §8.6 | factor 3 | Panel scoring of plates and glasses with known applied residues `[-> benchmark, standards]` |
| 22 | Spot formation: final-rinse dissolved solids to spot count on glass | §8.5 | measure | Vary rinse count and hardness; score glasses |
| 23 | Scale film constants (SI_crit, k_sc) | 1.5; 1e-10 kg/(m² s) | multi-cycle | 10 to 30 cycle build-up test in hard water without softener |
| 24 | Real household soil load per cycle and its class split | 5 to 150 g dry | survey | Weigh scraped waste and filter contents; drain-water solids |

---

## 12. Sources

### Opened and read this session

| ID | Source | URL | How read |
|---|---|---|---|
| S1 | IEC 60436:2015 (Ed. 4) Corrigendum 1:2020 and EN 60436:2020/AC:2020-06, Table E.1 "Ingredients of reference detergent type D" (reproduced in ČSN EN 60436/Opr. 1, 2021) | https://ftphost.binargon.cz/technickenormy/opravy/512899.pdf | PDF text extracted locally |
| S2 | IEC 60436:2025 (Ed. 5) Corrigendum 1:2026, clause 5.7 Detergent, Formula (1) | https://webdesk.jsa.or.jp/link/Cor/IEC/iec60436-cor1{ed5.0}b.pdf | PDF text extracted locally |
| S3 | Pérez-Mohedano, R. (2016). Cleaning principles in automatic dishwashers. EngD thesis, University of Birmingham | https://etheses.bham.ac.uk/id/eprint/6590/ (PDF: https://etheses.bham.ac.uk/id/eprint/6590/9/PerezMohedano16EngD_sizereduced.pdf) | PDF text extracted locally; 309 pages; sections cited individually |
| S4 | IKW Working Group Automatic Dishwashing Detergents (2016). Recommendations for the Quality Assessment of the Cleaning Performance of Dishwasher Detergents (Part B, Update 2015). SOFW Journal 142(6), 34 to 48; with IKW cover sheet dated 1 December 2025 | https://www.ikw.org/fileadmin/IKW_Dateien/downloads/Haushaltspflege/2025_EQ-MGSP-Teil-B_2015_inkl_Vorblatt-e.pdf | PDF text extracted locally |
| S5 | HERA (2002). Targeted Risk Assessment of Tetraacetylethylenediamine (TAED), CAS 10543-57-4 | https://www.heraproject.com/wp-content/uploads/2025/08/2-F-04-HERA-TAED-full-web-wd.pdf | PDF text extracted locally |
| S6 | Roldán-San Antonio, J.E., Amador, C., Martín, M., Blyth, K., Croce Mago, V.C. (2024). Cleaning Kinetic Model for Carbohydrates- and Protein-based Stains in Automatic Dishwasher. ESCAPE-34/PSE-24 manuscript | https://www.aidic.it/escape34-pse24/programma/323Roldan.docx | DOCX text extracted locally |
| S7 | Abu-Heiba, A., Malhotra, M., Gluesenkamp, K.R., Patel, V.K. (2018). Domestic Dishwasher Simulated Energy Efficiency Evaluation Using Thermoelectric Heat Pump for Water Heating and Dish Drying. 5th Int. High Performance Buildings Conf. at Purdue, paper 3668 | https://www.osti.gov/servlets/purl/1461054 (record: https://www.osti.gov/biblio/1461054) | PDF text extracted locally |
| S8 | National Centre for Biotechnology Education, University of Reading: enzyme pages for Savinase and Termamyl | https://www.ncbe.reading.ac.uk/?p=286 and https://www.ncbe.reading.ac.uk/termamyl/ | via fetch-tool extraction of the page |
| S9 | US 9,540,591 B2, "Detergent composition" (Reckitt Benckiser) | https://patents.google.com/patent/US9540591 | via fetch-tool extraction |
| S10 | US 8,603,255 B2, "Dishwasher, in particular domestic dishwasher, and method for operating said dishwasher" (BSH) | https://patents.google.com/patent/US8603255B2/en | via fetch-tool extraction (first 100,000 characters) |
| S11 | US 8,157,920, "Control device for a dishwasher appliance and associated method" | https://patents.google.com/patent/US8157920 | via fetch-tool extraction |
| S12 | US 6,138,692, "Cycle for a dishwasher to reduce filming" | https://patents.google.com/patent/US6138692 | via fetch-tool extraction |
| S13 | Collares, F.P., Finzer, J.R.D., Kieckbusch, T.G. (2004). Glass transition control of the detachment of food pastes dried over glass plates. Journal of Food Engineering 61(2), 261 to 267 (abstract in the AGRIS record) | https://agris.fao.org/search/en/records/65de455d6eef00c2cea0325c | page text extracted locally (abstract only) |
| S14 | NC State University News, "Why Doesn't Plastic Dry as Easily as Glass in the Dishwasher?" | https://news.ncsu.edu/?p=2099 | via fetch-tool extraction |

### Identified but not opened (values from these are tagged [RECALLED]; snippet-only where stated)

| ID | Source | URL or DOI | Why not opened |
|---|---|---|---|
| N1 | Roldán-San Antonio, J.E., Amador, C., Martín, M., Blyth, K., Croce Mago, V.C., Bowman, J. (2024). Stability kinetic study for amylase and protease enzymes under food stain removal conditions. Chem. Eng. Sci. 287, 119767. Also AIChE Annual Meeting 2023, paper 258a | doi:10.1016/j.ces.2024.119767; https://proceedings.aiche.org/conferences/aiche-annual-meeting/2023/proceeding/paper/258a-stability-kinetic-study-amylase-and-protease-enzymes; repository https://hdl.handle.net/10366/162113 | 403 / bot wall |
| N2 | Roldán-San Antonio et al. Cleaning kinetic model for carbohydrates and protein-based stains in automatic dishwasher. Chem. Eng. Sci. 320 (listed as 2026) | doi:10.1016/j.ces.2025.122486 | not fetched |
| N3 | Davies, D.M., Deary, M.E. (1991). Kinetics of the hydrolysis and perhydrolysis of tetraacetylethylenediamine. J. Chem. Soc., Perkin Trans. 2, 1549 to 1552 | doi:10.1039/P29910001549 | 403 |
| N4 | Olsen, H.S., Falholt, P. (1998). The role of enzymes in modern detergency. J. Surfactants Deterg. 1, 555 to 567 | doi:10.1007/s11743-998-0058-7 | paywalled |
| N5 | Pérez-Mohedano, R., Letzelter, N., Bakalis, S. (2017). Integrated model for the prediction of cleaning profiles inside an automatic dishwasher. J. Food Eng. 196, 101 to 112 | doi:10.1016/j.jfoodeng.2016.09.031 | thesis S3 used instead |
| N6 | Purdue IRACC 2021 paper 2212, measurements of evaporation and condensation mass transfer resistances in a dishwasher (authors as listed on the record) | https://docs.lib.purdue.edu/iracc/2212 | 403 on the PDF |
| N7 | Soft Matter (2023) article on black and green tea surface films and water hardness | doi:10.1039/D3SM00169E | 403 |
| N8 | Berkholz, P., Stamminger, R., Wnuk, G., Owens, J., Bernarde, S. (2010). Manual dishwashing habits: an empirical analysis of UK consumers. Int. J. Consumer Studies 34, 235 to 242 | doi:10.1111/j.1470-6431.2009.00840.x | cited through S3 |
| N9 | Filter patents surfaced by search: US 7,350,527; US 5,779,812; EP 0943285; US 9,138,123 | https://patents.google.com/patent/US7350527 ; https://patents.google.com/patent/US5779812 | snippets only |
| N10 | IEC 60436:2025 (Ed. 5) webstore abstract and national adoption notes | https://webstore.iec.ch/en/publication/80459 | abstract snippet only |
| N11 | Gorny, S., Bichler, S., Stamminger, R. A consumer-oriented load and soiling for testing the performance of automatic household dishwashers (46th International Detergency Conference, 2013) | https://www.teknoscienze.com/?p=10535 | 404 |
| N12 | Brands, Bockmühl and co-workers on microbial reduction and temperature in domestic dishwashers; "Hygiene Efficacy of Short Cycles in Domestic Dishwashers" | doi:10.1515/tsd-2020-2373 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC12299907/ | bot wall |
| N13 | "The influence of temperature on the decomposition kinetics of peracetic acid in solutions", Brazilian Journal of Chemical Engineering; and a later Latin American Applied Research paper on temperature and pH | https://scielo.br/j/bjce/a/HhSygXCgYbzxQ6kWqv876vq ; https://laar.plapiqui.edu.ar/OJS/index.php/laar/article/view/441 | snippets only |
| N14 | US 9,155,442 "Dishwasher with an improved pump-off sequence" | https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9155442 | snippet only |
| N15 | Bosch ENERGY STAR partner presentation on zeolite drying | https://www.energystar.gov/sites/default/files/asset/document/3%20-%20ENERGY%20STAR%20Products%20-%20Energy%20Efficiency%20and%20High%20Performance%20-%20Bosch%20-%20508%20Compliant.pdf | snippet only |
| N16 | Bengtsson, P. Licentiate thesis on heat-pump household appliances, Karlstad University (2014) | https://kau.diva-portal.org/smash/get/diva2:744927/FULLTEXT01.pdf | opened; contains no dishwasher thermal-mass data usable here, so not cited for values |

Material properties, water and air properties, pK values, fat melting ranges and food compositions tagged [RECALLED] are from general handbook knowledge (for example the CRC Handbook of Chemistry and Physics and standard heat-transfer texts) and were not looked up this session.

