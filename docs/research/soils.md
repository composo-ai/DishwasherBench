# Spotless research dossier: food-soil adhesion, hydration and removal kinetics ("soils")

Author: soils research specialist. Date: 2026-10-08.
Readers: lead architect (summary), engineers implementing the per-surface-element soil model.

---

## 0. How to read this dossier

### 0.1 Confidence tags

Every quantitative value carries exactly one tag and a source key (keys are resolved in the "Sources" section at the end).

- **[VERIFIED]** = I saw the value in source text fetched during this session (full text of a thesis, accepted manuscript, proceedings paper or standard recommendation). Two weaker variants are marked explicitly: "snippet" means I saw it only in the search-result excerpt of the source; "second-hand" means I saw it in the fetched text of a secondary source (a thesis literature review) quoting the primary paper, which I could not open. "Reconstructed" means the equation was garbled by PDF text extraction and I rebuilt it from the glyphs, dimensions and a numerical check.
- **[RECALLED]** = from my own memory of the literature or of standard food-science reference data; the source was not opened in this session.
- **[ESTIMATED]** = my own derivation, fit or physical estimate; the derivation is shown or summarised. These are calibration parameters.

### 0.2 What was and was not obtained (read this before trusting anything)

Full text successfully read this session:

| Key | What | Used for |
|---|---|---|
| PM-T | Pérez-Mohedano EngD thesis (Birmingham, 2016), 309 pp. | Egg-yolk swelling/removal model, all parameter tables, in-dishwasher kinetics |
| W14 | Wilson et al. 2014 (Chem. Eng. Sci.) accepted MS | Jet adhesive-removal model, k' table |
| G16 | Glover et al. 2016 (J. Food Eng.) accepted MS | Yield-limited peeling, moving jets, PVA soak delay |
| B17 | Bhagat, Perera, Wilson 2017 (FBP) accepted MS (text only, equations lost) | Strong/weak soil regimes, moving-jet front shapes, more k' |
| FW20 | Fernandes and Wilson 2020 (JNNFM) accepted MS (text and tables; equations lost) | Viscoplastic rheology link, regimes vs film/layer thickness |
| Go23 | Golla et al. 2023 (Heat and Mass Transfer), open access | Cohesive-separation model for starch, cohesive strength vs water content |
| Go24 | Golla et al. 2024 (HEFC proceedings) | Combined cohesive/adhesive/viscous model, ketchup and starch parameters, OH- transport |
| J17 | Joppa et al. 2017 (HEFC proceedings) | Diffusive-dissolution boundary model for starch, yield stress vs solids fraction |
| C22 | Cuckston et al. 2022 (FBP) accepted MS | Baked complex soil: swelling, adhesion-force decay, oil release, leaching |
| A15 | Ali et al. 2015 (FBP), open access | Millimanipulation of lard, effect of baking/polymerisation |
| Z19 | Zainoldin PhD thesis (Birmingham, 2019) | Egg-yolk micromanipulation data; second-hand summary of Liu et al. numbers |
| IKW | IKW dishwasher-detergent test recommendations (2015 update, SOFW 2016) | Soil recipes and areal loadings, test programme |
| R24 | Roldán-San Antonio et al. 2024 (ESCAPE-34) | Two-pool kinetic model of CFT starch and meat tiles in a dishwasher |

Not obtained (paywalled or blocked; values below are second-hand, snippet-level or recalled, and are tagged accordingly): the original Liu/Zhang/Fryer micromanipulation papers (2002 to 2007); Fryer and Asteriadou (2009); Gordon et al. (2012); the journal versions of Pérez-Mohedano et al. (2015, 2016, 2017; the thesis contains the same material); Wilson et al. (2015) and Wang et al. (2015); Chee et al. (2019); Yang et al. (2019) (only its data README was read); Köhler et al. (2021) (its ketchup parameters were read as reproduced in Go24); Xin, Chen and Özkan (2004); Cuckston et al. (2019) (its key table is reproduced in C22); Herrera-Márquez et al. (2020). I did not search tea-stain bleaching kinetics, carotenoid staining of plastics, particulate detachment forces, and solid-fat-content tables in depth; those sections are therefore mostly [RECALLED]/[ESTIMATED] and are flagged as gaps.

Equations in several PDFs were garbled by text extraction. Where I reconstructed an equation from the garbled glyphs plus dimensional reasoning, I say "reconstructed" and I have checked it numerically against at least one number printed in the same source.

### 0.3 Symbols and units (SI unless stated)

| Symbol | Meaning | Unit |
|---|---|---|
| m_d | dry soil mass per unit area (areal loading) | kg m^-2 (often quoted g m^-2) |
| w | water mass per unit area held in the soil | kg m^-2 |
| h, h_dry, h_inf | soil layer thickness (current, dry, equilibrium swollen) | m |
| lambda = h/h_dry | uniaxial stretch (thickness swelling ratio); lambda_0 initial, lambda_inf equilibrium | - |
| omega_f | water mass fraction in the soil, w/(w+m_d) | kg/kg |
| beta_f | water concentration in the soil, w/h | kg m^-3 |
| phi | soil (solids) volume fraction in the layer | - |
| D, D_F, D_L, D_NL, D_f | effective diffusion coefficients (generic; Fick; linear and non-linear poroelastic; water in soil) | m^2 s^-1 |
| chi, N, Omega | Flory-Huggins parameter; polymer chains per unit dry volume; volume per solvent molecule | -, m^-3, m^3 |
| tau_w, tau_hyd | wall shear stress exerted by the liquid on the soil surface | Pa |
| tau_coh, tau_ad, tau_y | cohesive strength, adhesive strength, yield stress of the soil | Pa |
| F_w | removal force per unit blade width in milli/micromanipulation (numerically equal to work per unit area, J m^-2) | N m^-1 |
| M | momentum flow rate per unit width of the liquid film at the cleaning front | N m^-1 (= kg s^-2) |
| M_Y | threshold value of M below which no peeling occurs | N m^-1 |
| k' | adhesive-removal (peeling) rate constant, da/dt = k'(M - M_Y) | m s kg^-1 |
| a | position (radius) of the cleaning front measured from the jet impingement point | m |
| k_ss, k_ds | Pérez-Mohedano removal rates of swollen layer thickness under applied shear / by "soil dissolution" | m s^-1 (quoted um/min) |
| f | frequency factor: fraction of time an external shear (jet) acts on the element | - |
| t_lag | cleaning lag time | s |
| SRI | stain removal index, percent of soil removed judged by colour | % |
| k_L | liquid-side mass-transfer coefficient | m s^-1 |
| E_a | activation energy; R = 8.314 J mol^-1 K^-1 | J mol^-1 |

---

## 1. Frameworks

### 1.1 The Fryer and Asteriadou (2009) cleaning map and soil typology

The map classifies a cleaning problem on two axes: soil complexity (from low-viscosity fluid to cohesive solid) and cleaning-fluid severity (from ambient water, through hot water, to hot chemical solutions) **[VERIFIED]** (PM-T section 2.3; W14 introduction). The three soil types, as summarised in the sources I could read:

| Type | Description | Cleaning fluid needed | Examples | Tag / source |
|---|---|---|---|---|
| 1 | Viscous / viscoelastic / viscoplastic product residues | Water alone (hot water reduces time) | tomato paste, shampoo, toothpaste, yoghurt | [VERIFIED] Go24 introduction; yoghurt [RECALLED] |
| 2 | Microbial films, biofilms, gels | Water or chemical; temperature helps | biofilms | [VERIFIED] Go24 introduction |
| 3 | Cohesive solid deposits formed by heat (protein, starch, mineral, burnt-on) | Chemical agent required (alkali first for proteins) | whey-protein fouling, egg, burnt milk | [VERIFIED] Go24 introduction |

Fluid-mechanical removal occurs "when fluid flow is enough and no chemicals are needed"; diffusion-reaction removal needs chemistry: mass transfer of active species to the soil, diffusion into it, reaction and swelling that weaken it, then reverse mass transfer of the released material; the slowest of these steps controls the cleaning time **[VERIFIED]** (PM-T section 2.3).

Relevance to dishwashers: a domestic load mixes all three kinds on one rack. Sugars, fresh sauces and liquid fats behave as Type 1; dried or cooked egg, milk, starch and anything baked behaves as Type 3. A dishwasher cycle is, in map terms, a Type-3 "hot dilute alkali plus enzymes" process operated with very weak and intermittent hydraulics.

### 1.2 Removal mechanisms (the vocabulary the model uses)

Three overlapping vocabularies appear in the literature; they map onto each other as follows.

| TU Dresden "boundary condition cleaning model" (BCCM) mechanism [VERIFIED Go24, J17] | Cambridge (Wilson et al.) term [VERIFIED W14, B17] | Physical meaning | Controlling variable |
|---|---|---|---|
| Diffusive dissolution | I. Dissolution | Soil molecules (or very small fragments) leave by diffusion into the liquid; flow only thins the concentration boundary layer | Mass-transfer coefficient, solubility, disengagement (reptation) rate |
| Cohesive separation | II. Erosion (cohesive breakdown) | Hydrodynamic load exceeds the cohesive strength somewhere inside the layer; chunks or layers above the failure plane leave | tau_coh (strongly decreasing with water content) vs tau_hyd |
| Adhesive detachment | II. Erosion (adhesive removal, "peeling") | Bond to the substrate is weaker than the cohesion; large patches or a rolled-back film leave the substrate clean | tau_ad or M_Y vs load at the soil/substrate/liquid contact line |
| Viscous shifting | (roll-up, film thinning; Yeckel and Middleman) | The soil itself flows under the applied shear or gravity and is pushed out of the region | Soil rheology (yield stress, viscosity) vs tau_hyd |
| (precursor of all of the above) | III. Soaking | Liquid penetrates, the microstructure changes (swelling, leaching, reaction), enabling one of the above | Diffusion and reaction times vs erosion time |

B17 adds the useful distinction between **mobile** soils (deform and flow under the liquid's forces: fats, pastes, gels) and **immobile** soils (do not flow, they break or peel) **[VERIFIED]** (B17 introduction).

For protein soils the classic three-stage picture (Bird and Fryer, 1991) is: (1) swelling, (2) erosion at a roughly constant rate, (3) decay, where the last thin layer is controlled by adhesion and by the shrinking covered area **[VERIFIED]** (PM-T section 2.3). The same three stages were seen for starch in channel flow (delay of about 40 s, constant rate, decay below about 10 g m^-2) **[VERIFIED]** (Go23 section 4.2) and for egg yolk inside a dishwasher (lag about 5 min, constant rate, decay above about 70 % SRI) **[VERIFIED]** (PM-T section 7.2.1 and 7.3.2).

### 1.3 Cohesive versus adhesive failure: which one happens

- The mode is decided by which is weaker at that moment, the soil/soil bond or the soil/substrate bond, and both change with hydration, temperature and chemistry.
- Micromanipulation (Liu, Zhang, Fryer and co-workers) found: baked tomato paste, bread dough and egg albumin have lower adhesive than cohesive strength (they come off the wall in pieces: adhesive failure), whereas whey protein has lower cohesive than adhesive strength at room temperature (it erodes layer by layer and the last layer is the hardest) **[VERIFIED, snippet]** (Liu-snip; Z19 section 2). Zainoldin's baked egg-yolk deposits had adhesive strength greater than cohesive strength in every condition tested, so they fail cohesively **[VERIFIED]** (Z19 section 7.1.4).
- Baked lard switches from cohesive failure (unpolymerised, soft) to adhesive failure (polymerised, strong film) with baking time **[VERIFIED]** (A15 section 4).
- A cleaning agent can change the mode: surfactants or alkali that penetrate to the interface promote adhesive failure and peeling; for baked lard at 50 C, LAS, Triton X-100 and alkali (pH 10.4 to 11) made the deposit lift off as a coherent film, while CTAB broke it down through the layer **[VERIFIED, snippet]** (A15b-snip). For a baked starch/protein/fat soil the removal force stayed almost constant until a critical soaking time and then fell, which often marked a transition from cohesive to adhesive breakdown **[VERIFIED]** (C22-thesis abstract).
- Layer thickness matters. In micromanipulation the force needed for cohesive removal decreases with probe height above the wall (PM-T/Z19 quoting Liu et al. 2006) **[VERIFIED]**; thin regions clean first, so thickness non-uniformity changes the shape of the cleaning curve (Go23) **[VERIFIED]**.

### 1.4 The Cambridge impinging-jet adhesive-removal ("peeling") model

This is the best-validated quantitative description of cleaning by a coherent liquid jet, and its geometry (nozzle diameters 0.39 to 3.3 mm, mostly 2 mm; flow 0.25 to 10 L min^-1; jet velocity 2.5 to 32 m s^-1) overlaps that of dishwasher spray-arm nozzles **[VERIFIED]** (W14 abstract and section 3.2; the overlap with dishwasher nozzles is my judgement, to be confirmed by the "machine" and "jets" siblings).

#### 1.4.1 Stationary jet, normal impingement

A coherent jet (radius r_o, mean velocity U_o, mass flow rate m_dot) strikes a flat wall and spreads as a thin radial film (the radial flow zone, RFZ) out to the hydraulic or film jump. Soil is removed rapidly from the jet footprint, then a near-circular clean region of radius a(t) grows; the rate collapses when the front reaches the jump **[VERIFIED]** (W14 abstract).

Rate law **[VERIFIED]** (W14 eq. 3; G16 eq. 4 and 11):

    da/dt = k' * (M - M_Y)      for M > M_Y,     da/dt = 0 otherwise                 (J1)

Momentum flow per unit width of the film at radius r (parabolic velocity profile) **[VERIFIED, reconstructed]** (W14 eq. 4 and 5):

    M = (6/5) * rho * U^2 * h_film = 3 * m_dot * U / (5 * pi * r)                     (J2)

Mean film velocity U at radius r (Wilson et al. 2012 film model, gravity neglected) **[VERIFIED, reconstructed; constant c confirmed numerically]** (W14 eq. 6 and 7; B17 "c = 10 pi^2 rho mu / 3; for water at 20 C, c = 32.9 kg^2 m^-4 s^-1"):

    1/U = 1/U_o + (c / m_dot^2) * (r^3 - r_o^3),      c = 10 * pi^2 * rho * mu / 3     (J3)

Check: 10 * 9.8696 * 998 * 1.002e-3 / 3 = 32.9. 

Two limiting regimes (B17):

- **Weak soil (front far from the jet, a >> r_o, U << U_o)** **[VERIFIED]** (W14 eq. 8 to 10; G16 eq. 5 and 6):

      da/dt = 3 k' m_dot^3 / (5 pi c a^4) = K^5 / (5 a^4)
      a^5 - a_i^5 = K^5 (t - t_i),      K = (3 k' / (pi c))^(1/5) * m_dot^(3/5)       (J4)

  so a grows as t^(1/5); K has units m s^-0.2.

- **Strong soil (front close to the footprint, U ~ U_o)** **[ESTIMATED: my reconstruction of B17 eq. 4 to 6 from J1 and J2 with U = U_o; B17 states the result is a t^(1/2) law]**:

      da/dt = 3 k' m_dot U_o / (5 pi a)
      a^2 - a_i^2 = (6 k' m_dot U_o / (5 pi)) (t - t_i)                               (J5)

- The transition between the two is expected at about a/r_o ~ 0.5 * Re_jet^(1/3), with Re_jet = 2 r_o U_o rho / mu **[VERIFIED]** (B17). For Re_jet = 22 200 this is a/r_o ~ 14.

The model does not describe the first instants inside the footprint (t_i of 1 to 8 s for PVA) nor cleaning beyond the jump **[VERIFIED]** (W14 section 4.2).

#### 1.4.2 Yield-limited peeling of viscoplastic layers

For petroleum jelly the front stops at a maximum radius a_max inside the RFZ. Glover et al. model the front as a ramp of yielding soil inclined at angle chi to the wall; a horizontal force balance gives the threshold momentum **[VERIFIED, reconstructed from garbled eq. 12 and 13; re-derived]** (G16):

    M_Y * (1 - cos chi) = tau_y * delta * cot chi
    M_Y = tau_y * delta / (tan chi - sin chi)                                         (J6)
    a_max = [ 3 m_dot^3 (tan chi - sin chi) / (5 pi c tau_y delta) ]^(1/4)             (J7)

with delta the soil layer thickness and tau_y its shear yield stress. Fitted chi was 7 to 25 degrees (G16) and 15 to 32 degrees (FW20) **[VERIFIED]**. Numerically 1/(tan chi - sin chi) is 1093, 110, 46 and 23 at chi = 7, 15, 20 and 25 degrees **[ESTIMATED]**, so M_Y is roughly 20 to 100 times tau_y * delta.

Fernandes and Wilson (FW20) rationalise J1 by viscous dissipation in a wedge of soil at the front and show that for an immiscible viscoplastic soil the local rate is **not** shear-driven: the wall shear stress of the film is smaller than the critical stress of the soil, yet the soil is displaced, because it is the film's momentum deflected by the front that does the work **[VERIFIED]** (FW20 section 1). They also identify three regimes by the ratio of liquid-film thickness h to soil-layer thickness delta **[VERIFIED]** (FW20):

| Regime | Condition | Behaviour |
|---|---|---|
| Very thin soil layer | h >> delta | Film flows over the layer; removal by viscous drag (Yeckel and Middleman film-thinning) |
| Thin soil layer | h ~ delta | Film is deflected by displaced soil; moving front; J1 applies |
| Thick soil layer | h << delta | Jet burrows in, a liquid blister forms and bursts |

A residual layer of order micrometres remains on the substrate behind the front for hydrophobic soils **[VERIFIED]** (FW20 section 2.2).

#### 1.4.3 Published rate constants and yield criteria

| Soil | Substrate | Layer thickness | T (C) | k' (m s kg^-1) | Other | Tag / source |
|---|---|---|---|---|---|---|
| PVA glue, dried 24 h | Perspex | 70 +/- 30 um | 20 | 0.21 (as printed; an outlier by 3 orders of magnitude, treat with caution) | horizontal jet | [VERIFIED] W14 Table 1 |
| PVA glue | Perspex | 140 +/- 30 um | 20 | 1.0e-4 | horizontal jet | [VERIFIED] W14 Table 1 |
| PVA glue | Perspex | 120 +/- 30 um | 20 | 4.5e-4 | vertical jet; K ~ 12 mm s^-0.2 | [VERIFIED] W14 Table 1; G16 |
| PVA glue | Perspex | 16 to 171 um | 20 | (K = 9.8 +/- 2.0 mm s^-0.2, independent of thickness) | soak delay t_c before breakthrough, about linear in thickness above 75 um | [VERIFIED] G16 |
| PVA | Perspex | not stated | 18 to 20 | 1.3e-4 | 45 degree jets, strong-soil fit | [VERIFIED] B17 |
| Xanthan gum + ZnS, dried 24 h, 13 +/- 1 g m^-2 | 304 steel | < 80 um | 17 to 20 | 2e-3 | weakens after about 60 s wetting; falling film then cleans it within 170 to 222 s | [VERIFIED] W14 Table 1 and section 4.3 |
| Xanthan gum (same data, other fits) | 304 steel | | | 3e-4 (2.2e-4 for larger nozzles); 1.8e-3 from moving-jet data | intermediate-soil model | [VERIFIED] B17 |
| Petroleum jelly (tau_c = 130 Pa at 20 C) | glass/Perspex | 250 +/- 30 um | 20 | 6.7e-6 | horizontal jet | [VERIFIED] W14 Table 1 |
| same | | | 24 | 1.5e-5 | | [VERIFIED] W14 Table 1 |
| same | | | 30 | 5.7e-5 | | [VERIFIED] W14 Table 1 |
| same | | | 40 | 6.3e-4 | | [VERIFIED] W14 Table 1 |
| same | | | 60 | 3.3e-3 | | [VERIFIED] W14 Table 1 |
| same | | 300 +/- 40 um | 20 | 1.4e-7 | vertical jet (poorly prepared layers) | [VERIFIED] W14 Table 1 |
| Petroleum jelly (tau_y 12 to 50 Pa) | Perspex | 50 to 2000 um | 20 | 1.5e-5 (K = 7.2 +/- 1.7 mm s^-0.2) | a_max reached; chi 7 to 25 degrees | [VERIFIED] G16 |
| Petroleum jelly (different product) | borosilicate glass | 200 um | 20 | (K = 13.3 mm s^-0.2, i.e. k' about 21 times larger than on Perspex since k' scales as K^5) | substrate wettability matters: water contact angle 33 degrees on glass vs 74 on Perspex | [VERIFIED] G16 for K and angles; ratio [ESTIMATED] |
| Soft petroleum jelly | glass | 320 to 400 um | 18 to 20 | 0.027 | inclined jets, strong-soil fit | [VERIFIED] B17 |
| Petroleum jellies and white soft paraffin | | 0.1 to 1.9 mm | 20 | (fitted per run) | tau_c = 140, 200, 570 Pa; Bingham viscosity 1.0, 0.1, 0.3 Pa s; density 812, 838, 826 kg m^-3 | [VERIFIED] FW20 Table 2 |
| Toothpaste | Perspex | 500 um | | (k' and M_Y both change with soaking time 0, 60, 120 s; values in data file, not read) | | [VERIFIED] Y19 README |

Temperature dependence for a fat-like soil **[VERIFIED, reconstructed and numerically checked]** (W14 eq. 15 and Fig. 18):

    ln(tau_c / Pa) = 11896 / T - 35.697          (T in K; petroleum jelly, 20 to 60 C)        (J8)
    k' proportional to tau_c^(-1.8)                                                        (J9)

Check: J8 gives tau_c = 132 Pa at 20 C (text: 130 Pa), 9.9 Pa at 40 C, 1.0 Pa at 60 C; and (132/9.9)^1.8 = 105 against the measured k' ratio 6.3e-4 / 6.7e-6 = 94 **[ESTIMATED check]**.

k' depends on soil nature, layer thickness and substrate; the Cambridge group state that no predictive relation for k' exists yet for swelling soils **[VERIFIED]** (W14, G16).

#### 1.4.4 Moving jets

In the frame of a jet whose impingement point moves at speed V over the soil, the front is stationary where the radial peeling speed f(p) balances convection. For a front point at polar position (p, theta) measured from the direction of travel **[VERIFIED, reconstructed from G16 eq. 7; re-derived kinematically]**:

    dp/dtheta = p * f(p) / (V sin theta) - p / tan theta,      f(p) = da/dt at radius p    (J10)

- Weak soil, f = K^5/(5 p^4). Nearest point ahead of the jet: a_x = (K^5 / (5 V))^(1/4). Front shape (analytical, B17): y(theta) = p sin(theta) = a_x * [4 (2/3 - cos theta + cos^3(theta)/3)]^(1/4). Cleared strip width w_c = 3.04 a_x (2.94 a_x in the earlier numerical solution), hence w_c proportional to V^(-1/4) **[VERIFIED]** (B17; G16 confirm the V^(-1/4) scaling for plate speeds 6 to 31 mm s^-1).
- Strong soil, f = (3 k' m_dot U_o / (5 pi)) / p: a_x = 3 k' m_dot U_o / (5 pi V); front y(theta) = a_x * theta; w_c tends to 2 pi a_x **[VERIFIED in B17 as a dimensionless limit; closed form re-derived]**.
- The rate constant fitted from moving-jet tests equals the static value within experimental uncertainty (xanthan: 1.8e-3 vs 2e-3 m s kg^-1) **[VERIFIED]** (B17).

**What this means in a dishwasher [ESTIMATED; hydraulics to be supplied by the "jets" sibling].** Take a spray-arm nozzle of radius 1.25 mm, U_o = 7.5 m s^-1, m_dot = 0.037 kg s^-1: at the footprint edge M_0 = 3 m_dot U_o/(5 pi r_o) = 34 N m^-1 (range 23 to 52 N m^-1 for r_o 1 to 1.5 mm, U_o 6 to 9 m s^-1). The Cambridge rig (r_o = 1 mm, 11.1 m s^-1, 0.035 kg s^-1) gives 74 N m^-1. The impingement point sweeps at V of order 0.5 m s^-1 (35 rpm at 0.15 m radius), about 20 to 100 times faster than in the Cambridge moving-jet tests, so the dwell time on a given point is about 2 r_o / V ~ 4 ms per pass, once every 1.7 s. The peel-front speed at the footprint edge is k' M_0: with M_0 = 74 N m^-1 this is 0.5 mm s^-1 for stiff petroleum jelly (k' = 6.7e-6), 10 to 22 mm s^-1 for PVA or xanthan fitted with the strong-soil model (1.3e-4 to 3e-4), and 150 mm s^-1 for xanthan with the weak-soil constant (2e-3). The front therefore advances roughly 2 um, 40 to 90 um and 600 um per pass respectively. Consequences: (i) weak, soaked, film-forming soils are stripped along the jet track within a few arm revolutions; (ii) strong soils are essentially untouched by direct peeling until soaking and chemistry have raised k' or lowered M_Y by orders of magnitude; (iii) the time-averaged effect of the periodic jet can be represented by the per-pass integral of k'(M - M_Y)+ times the pass frequency, i.e. by time-homogenised statistics.

#### 1.4.5 Soaking and weakening in the jet framework

- Xanthan gum: after about 60 s of wetting the layer has weakened enough for the rope and the falling film (not only the RFZ) to remove it; the whole wetted region was clean after about 222 s **[VERIFIED]** (W14 section 4.3). Paint behaved similarly **[VERIFIED]** (W14 section 4.5).
- PVA: every layer needed a contact time t_c before the jet broke through; t_c increased about linearly with dry thickness above 75 um and correlated with the rupture time of the same layers under a gauging flow imposing 6 to 20 Pa, during which the swelling ratio rose towards an asymptote. After breakthrough K (hence k') was independent of dry thickness and of t_c, "as expected for peeling at the interface" **[VERIFIED]** (G16).
- Toothpaste (Yang et al. 2019): the adhesive-removal constant k' and the intercept k'M_Y were measured as functions of soaking time (0, 60, 120 s) and used to predict cleaning by the falling film below the jet **[VERIFIED]** (Y19 README; the functional form was not in the README).
- Framework-level statement: soaking matters when the erosion time of the unsoaked layer is long compared with the penetration time of the liquid **[VERIFIED]** (W14 section 1). In a dishwasher this is always the case for dried soils, because the direct-jet duty cycle is about 1 %.

**Model consequence.** Represent soaking by letting k' and M_Y be functions of the local soil state (water content at the soil/substrate interface, temperature, chemical damage) rather than constants: M_Y = F_ad(state) / eta_M and k' = k'_ref * (tau_ref / tau_c(state))^1.8 (see section 7).

### 1.5 The TU Dresden boundary-condition cleaning model (BCCM)

The BCCM is the closest published analogue of architecture (a): a single-phase flow solution provides the load, and each soiled wall patch carries a one-dimensional (wall-normal) soil model as a boundary condition.

Assumptions **[VERIFIED]** (Go23 section 2.1; Go24): (1) the soil height is negligible compared with the flow scale, so the soil is not an obstacle; (2) one-way coupling: fluid forces do not depend on cleaning progress; (3) transport into the soil (water, hydroxide, heat) is one-dimensional in the wall-normal direction.

Reported benefit: a conventional multiphase simulation of the same starch-cleaning case needed two weeks on eight cores on a very coarse grid; the BCCM needed about one hour on one core, i.e. about three orders of magnitude less, and matched the experiments **[VERIFIED]** (J17). The combined model of Go24 ran each case in under 5 min in Python on a 4-core laptop **[VERIFIED]** (Go24).

Equations **[VERIFIED]** (Go23 eq. 1 to 6; Go24 eq. 1 to 20):

    Swelling:      d(omega_f)/dt = d/dy ( D(omega_f) d(omega_f)/dy )                     (D1)
                   wall: d(omega_f)/dy = 0;   top: omega_f = omega_max;   t = 0: omega_f = omega_0
                   (Go24 uses water concentration beta_f in kg m^-3 instead of omega_f, on a
                    Lagrangian grid whose cells keep their dry mass and stretch as they take up water:
                    h_cell = m_f''/rho_f + m_d''/rho_d)
    Cohesion:      tau_coh(j-1/2) = f(omega_f or beta_f at the cell interface)            (D2)
    Cohesive rule: if min_j tau_coh(j-1/2) >= C * tau_hyd: nothing is removed;
                   else all cells above the wall-nearest failing interface are removed     (D3)
    Adhesive rule: if C_ad * tau_hyd > tau_ad(beta_f at the wall): the whole column leaves  (D4)
    Load:          tau_hyd = area-average of |tau . n| over the patch (wall shear stress)    (D5)
    Viscous shift: u_s(y) = gamma_dot_s * y with tau_hyd = tau_s(gamma_dot_s, T, beta_f, ...)  (D6)
    Hydroxide:     convection with the swelling water flux plus diffusion with D_OH            (D7)
    Heat:          1-D conduction in soil and substrate, convective top boundary               (D8)

A removed cell is treated as flooded: the top boundary condition moves down to the uppermost remaining cell **[VERIFIED]** (Go23).

Parameter sets **[all VERIFIED]**:

| Soil and conditions | Swelling | Strength law | Correction factor | Other | Source |
|---|---|---|---|---|---|
| Pre-gelatinised waxy maize starch (C Gel Instant 12410), sprayed, dried 20 h at 23 C / 50 % RH; 30 to 80 g m^-2; water 23 to 25 C | omega_0 = 0.138 +/- 0.013; omega_max = 0.91; height ratio h_max/h_0 = 10.72 +/- 0.46; D = 0.5e-9 exp(2.06 omega_f) m^2 s^-1 ("best fit"); or D = 0.75e-9 omega_f^10 ("waterfront") | tau_coh = 181 kPa exp(-11.31 omega_f) (70 g m^-2) or 50 GPa exp(-28.45 omega_f) (50 g m^-2) with best-fit swelling; tau_coh = -1.21 kPa * omega_f + 1.13 kPa with the waterfront swelling | C = C_0 Re^-0.88, C_0 = 356.64 (best fit) or 31974 (waterfront) | spatial soil-mass standard deviation 5 g m^-2 must be included to reproduce the constant-rate and decay stages | Go23 |
| Same starch, reformulated in beta_f | rho_d = 1056.6 kg m^-3; beta_0 = 144.62, beta_max = 917.94 kg m^-3; D_f = 2.5e-11 exp(3.53e-3 beta_f) m^2 s^-1 | tau_coh = 500 MPa exp(-0.021 beta_f) | C_coh = 0.67 | | Go24 |
| Dried tomato ketchup, 278 g m^-2, water 20 C, channel 0.5 to 2 m s^-1 (Köhler et al. 2021) | D_f = 2.2e-13 * beta_f^1.36 (m^2 s^-1 with beta_f in kg m^-3) | tau_ad = 811 kPa exp(-0.016 beta_f) | C_ad = 14.2 | fails by adhesive detachment; swells about one third as much as the starch | Go24; Go23 |
| Whey protein isolate gel, hydroxide penetration (Wiese et al.) | D_OH = 6.21e-11 (20 C), 7.89e-11 (40 C), 11.4e-11 (55 C) m^2 s^-1; fit D_OH/(m^2 s^-1) = 3.6e-14 T_C^2 - 1.3e-13 T_C + 7.2e-12 (T_C in C) | | | protein must react with OH- before it becomes swellable; D_f set to zero until beta_OH exceeds a critical value | Go24 |
| Same starch, diffusive-dissolution variant with pre-wetting | D_pw = D* exp(beta* phi), D* = 5.5e-12 m^2 s^-1, beta* = 20 (form as printed; phi is the soil volume fraction); phi_max = 0.74 | yield stress of starch/water mixtures tau_0 = 73476 Pa * phi^4.594 (Herschel-Bulkley fits, 1 to 17 g per 100 g water, 23 C) | none (physically based) | reptation (delay) time t_r = 7.0, 12.3, 19.1 s for 30, 40, 50 g m^-2; removal coefficient R = 1.42e-5, 1.28e-5, 1.14e-5 g m^-1 s^-1; decay stage below 5.8 g m^-2; C_sw = 0.67 s^-1; Psi = 4.4 | J17 Table 1 and eq. 12 |

Useful numbers implied by these laws **[ESTIMATED from the VERIFIED formulas]**:

| Starch state | Solids volume fraction phi | Yield stress from J17 (Pa) | Water concentration beta_f (kg m^-3) | tau_coh from Go24 (Pa) |
|---|---|---|---|---|
| Fully swollen surface | 0.09 | 1.2 | 918 | 2.1 |
| | 0.10 | 1.9 | 850 | 8.8 |
| | 0.15 | 12 | 800 | 25 |
| | 0.20 | 45 | 750 | 72 |
| | 0.30 | 290 | 700 | 206 |
| | 0.50 | 3000 | 600 | 1700 |
| Air-dry | 0.74+ | 18000+ | 145 | 2.4e7 |

So a falling film (wall shear 0 to 2 Pa, section 6) can only strip starch that is already swollen to less than about 10 % solids, while a jet footprint (5 to 50 Pa) strips layers of up to about 20 % solids. The ketchup law gives tau_ad = 55 Pa at beta_f = 600, 11 Pa at 700 and 2.2 Pa at 800 kg m^-3 at the wall; with C_ad = 14.2 a 1 Pa film detaches the layer once the wall water concentration exceeds about 690 kg m^-3.

The BCCM papers note explicitly that the swelling of starch is not Fickian with constant boundary conditions (a sharp waterfront fits the force data better, but the Fickian fit matches the thickness data better), that pre-wetted soils develop a wavy surface that raises the removal rate, and that the last layer needs a separate adhesion description **[VERIFIED]** (Go23 sections 4.1 and 4.2; J17 conclusions).

---

## 2. Swelling and hydration

### 2.1 Kinetic descriptions

**Power law (Peppas)** **[VERIFIED]** (PM-T eq. 2.1, 2.2, Table 2.1): m_t/m_inf = k t^n for the first 60 % of uptake in a slab; n = 0.5 Fickian (case I: diffusion slower than network relaxation), 0.5 < n < 1 anomalous, n = 1 case II (relaxation-controlled, a sharp front moving at constant speed). The same form is used for thickness, h_t/h_inf = k' t^n'.

**Fick's second law with a moving boundary** **[VERIFIED]** (PM-T eq. 2.3, 2.4): dC/dt = D_F d2C/dz2 with C the dry-basis moisture content, and thickness tied to water uptake by volume additivity: m_t - m_0 = rho_w A (h_t - h_0).

**Linear poroelasticity (Yoon et al. 2010)** **[VERIFIED, reconstructed]** (PM-T eq. 2.5): for a layer bonded to a rigid wall and swelling in thickness only,

    h(t) - h_0 = (h_inf - h_0) * [ 1 - (8/pi^2) * SUM_{n>=0} (2n+1)^-2 exp( -(2n+1)^2 pi^2 t / (4 tau) ) ],
    tau = h_dry^2 / D_L                                                                 (S1)

**Non-linear poroelasticity (Hong, Zhao, Zhou, Suo 2008; Bouklas and Huang 2012)**, the model used by Pérez-Mohedano **[VERIFIED, reconstructed and checked against the original theory's form]** (PM-T eq. 2.7 to 2.10): in the dry (reference) coordinate Z in [0, h_dry],

    d(lambda)/dt = D_NL * d/dZ [ xi(lambda) * d(lambda)/dZ ]                             (S2)
    xi(lambda) = 1/(lambda_0^2 lambda^4)
                 - 2 chi (lambda_0^2 lambda - 1) / (lambda_0^4 lambda^5)
                 + N Omega (lambda_0^2 lambda - 1)(lambda^2 + 1) / (lambda_0^2 lambda^4)   (S3)
    h(t) = INTEGRAL_0^{h_dry} lambda(Z, t) dZ                                            (S4)
    boundary conditions: d(lambda)/dZ = 0 at the wall (Z = 0); lambda = lambda_inf at the surface; lambda = lambda_0 at t = 0
    equilibrium (pure solvent outside):
    ln[(lambda_0^2 lambda_inf - 1)/(lambda_0^2 lambda_inf)] + 1/(lambda_0^2 lambda_inf)
       + chi/(lambda_0^2 lambda_inf)^2 + (N Omega/lambda_0^2)(lambda_inf - 1/lambda_inf) = 0   (S5)
    link between coefficients: D_L = D_NL * xi(lambda*),  lambda* = (lambda_0 + lambda_inf)/2      (S6)

Temperature dependence: D = D_0 exp(-E_a/(R T)) **[VERIFIED]** (PM-T eq. 2.13).

**Implementation warning [ESTIMATED].** I solved S5 with the thesis's fitted values (lambda_0 = 1.1, N Omega = 5.5e26 * 3e-29 = 0.0165): it gives lambda_inf = 1.2, 1.5, 1.8, 2.2 and 3.2 for chi = 1.0, 0.8, 0.65, 0.5 and 0.0, far below the measured equilibrium stretches (3.5 to 14, below). The thesis itself says that N "should be around one order of magnitude" different and that the fit was insensitive to chi and N (PM-T section 6.3.3). In the thesis lambda_inf was taken from the measured equilibrium thickness and imposed as the surface boundary condition; chi and N only shape xi(lambda). Do the same: treat lambda_inf(T, pH) as an independent measured input and do not use S5 to compute it. With these parameters xi falls from about 0.35 at lambda = 1.1 to about 0.002 at lambda = 5, so the effective diffusivity D_NL * xi falls from about 1e-10 to 1e-12 m^2 s^-1 as the gel swells, which is why D_L is two orders of magnitude below D_NL.

**Dresden forms** (section 1.5): D increasing exponentially or as a power of the local water content; these produce front-like profiles and are the natural choice for starch and ketchup.

**Empirical first-order form** used for a baked multi-component soil **[VERIFIED]** (C22 eq. 4): (delta - delta_0)/(delta_max - delta_0) = 1 - exp(-k_delta (t - t_0)).

### 2.2 Egg yolk: measured swelling parameters (Pérez-Mohedano)

Test soil: Centre for Testmaterials DS-22 (stainless steel) and DM-22 (melamine) tiles, sprayed egg yolk, 120 mm x 100 mm, egg-yolk mass 1.75 +/- 0.04 g, initial thickness 68 +/- 14 um (extrapolated from gauging data), initial moisture 0.067 g water per g dry (equivalent to a 9 um water layer), hence h_dry = 59 um and lambda_0 = 1.1 **[VERIFIED]** (PM-T section 3.3 and 6.3.3). Dry egg yolk is about 33 % protein, 62.5 % fat, under 3.5 % minerals, 1 % carbohydrate; it is treated as a protein soil because the protein network carries the structure; yolk preheated above 70 C gels **[VERIFIED]** (PM-T section 3.3).

**Consistency flag [ESTIMATED].** 1.75 g on 0.012 m^2 is 146 g m^-2 (137 g m^-2 dry). At a plausible dry density of about 1100 kg m^-3 that is about 125 um, not 59 um; 59 um would require 2300 kg m^-3. Either the tiles are not fully covered or the extrapolated thickness is low by a factor of about two. All Pérez-Mohedano thickness rates (um/min) and stretches below inherit this ambiguity; mass-based quantities (% per minute) do not. Prefer the mass-based forms.

Solutions: 5 L deionised water hardened to 8.5 US gpg; pH 9.5 (carbonate/bicarbonate), 10.5 (carbonate), 11.5 (NaOH); protease prills 0.02 to 0.10 g L^-1; gauging shear 12 to 65 Pa; frequency factor 8.5 to 100 % **[VERIFIED]** (PM-T section 3.6.2, 3.12).

Findings **[all VERIFIED]** (PM-T section 6.2.1, 6.3):

- Without enzyme there was no thickness decrease in any condition except pH 11.5 at 55 C, where the layer detached from the steel after 30 to 40 min (hydrolysis; blisters after 2 h of soaking). pH was the main driver of the degree of swelling, temperature second; neither changed the kinetics much: 95 % of equilibrium was reached at about 90 min in all conditions (50 min at pH 11.5/55 C under gauging because top layers were stripped).
- Power-law exponents n were below 0.5 in all cases (Fickian), rising with pH towards anomalous transport.
- Equilibrium stretches were "in a range from 3.5 to 10" in the swelling study (first batches). The equilibrium thicknesses used later for the dishwasher simulations (DM-22 batch) were 0.410 mm (30 C, pH 10.5), 0.703 mm (55 C, pH 10.5), 0.445 mm (55 C, pH 9.5) and 0.822 mm (55 C, pH 11.5), i.e. lambda_inf = 6.9, 11.9, 7.5 and 13.9 on h_dry = 59 um (PM-T section 7.3.2; ratios [ESTIMATED]).
- Water self-diffusion is 2.3e-9 m^2 s^-1; all fitted coefficients are far lower (obstruction by the network).

Diffusion coefficients **[VERIFIED]** (PM-T Tables 6.5, 6.6, 6.7):

| T (C) | pH | D_F (m^2 s^-1), Fick, gravimetric | R^2 | D_L (m^2 s^-1), linear poroelastic, thickness | R^2 | D_NL (m^2 s^-1), non-linear | chi | N (m^-3) | D_L from S6 (m^2 s^-1) | R^2 |
|---|---|---|---|---|---|---|---|---|---|---|
| 30 | 9.5 | 5.5e-12 | 0.9477 | 9.60e-13 | 0.9971 | 1.5e-10 | 1.00 | 9.5e26 | 4.32e-13 | 0.9935 |
| 55 | 9.5 | 1.0e-11 | 0.9498 | 1.12e-12 | 0.9865 | 2.5e-10 | 0.80 | 6.0e26 | 8.98e-13 | 0.9910 |
| 30 | 10.5 | 8.6e-12 | 0.9112 | 7.60e-13 | 0.9795 | 3.0e-10 | 0.90 | 5.0e26 | 1.50e-12 | 0.9429 |
| 55 | 10.5 | 1.9e-11 | 0.9498 | 8.90e-13 | 0.9785 | 4.0e-10 | 0.80 | 4.0e26 | 7.51e-13 | 0.9828 |
| 30 | 11.5 | 4.1e-11 | 0.8813 | 1.33e-12 | 0.9675 | 4.5e-10 | 0.65 | 4.5e26 | 1.21e-12 | 0.9697 |
| 55 | 11.5 | 5.4e-11 | 0.9202 | 1.96e-12 | 0.9812 | 9.0e-10 | 0.00 | 4.0e26 | 1.95e-12 | 0.9355 |

Omega = 3e-29 m^3 per water molecule; mean N = 5.5e26 +/- 2.1e26 m^-3 **[VERIFIED]** (PM-T section 6.3.3).

Activation energies (two temperatures only, order of magnitude) **[VERIFIED]** (PM-T Table 6.8): Fick 19.8, 26.2, 9.1 kJ mol^-1 at pH 9.5, 10.5, 11.5 (mean 18.4 +/- 9.0); linear poroelastic 5.1, 5.2, 12.8 (mean 7.7 +/- 4.4); non-linear 16.9, 9.5, 22.9 (mean 16.4 +/- 6.7).

Compact fit for implementation **[ESTIMATED: least-squares fit of ln D_NL from the table above; reproduces all six values within 12 %]**:

    D_NL(T, pH) = 3.5e-10 m^2 s^-1 * exp( 0.595 * (pH - 10.5) ) * exp( -(16 450 / R) * (1/T - 1/315.65 K) )     (S7)
    D_L ~ 1.1e-12 m^2 s^-1 (geometric mean of the six values; weak T and pH dependence)                        (S8)
    lambda_inf(T, pH) ~ 11.9 * exp( 0.0215 K^-1 * (T - 328.15 K) ) * g(pH),  g(9.5) = 0.63, g(10.5) = 1.00, g(11.5) = 1.17   (S9)

S9 is anchored on only four points from one tile batch; outside pH 9.5 to 11.5 it is extrapolation. For plain water (pH 7 to 8, pre-wash or rinse) I estimate g ~ 0.25 to 0.4, i.e. lambda_inf of 2 to 4 **[ESTIMATED]**; Zainoldin's baked yolk also swelled in water and more in NaOH, LAS and detergent solutions, in that order of decreasing effect (NaOH largest) **[VERIFIED]** (Z19 section 7.1.2).

Numerical settings that worked: 50 theoretical layers (1.22 um each in the dry coordinate) with an explicit time step of 3 ms; fewer than 10 layers under-predicts removal, more than 20 adds cost with little accuracy gain **[VERIFIED]** (PM-T section 6.4.3.6). Example fit at 50 C, pH 10.5: D_NL = 2.5e-10 m^2 s^-1, chi = 0.9, N = 6e26 m^-3, R^2 = 0.98 **[VERIFIED]**.

### 2.3 Other measured swelling data

| Soil | Conditions | Result | Tag / source |
|---|---|---|---|
| Pre-gelatinised waxy maize starch, dried, 30 to 80 g m^-2 | water 23 C | thickness ratio 10.72 +/- 0.46; steep initial rise then asymptote over roughly 10 to 20 min; omega_max 0.91 | [VERIFIED] Go23, J17 |
| Dried ketchup | water 20 C | similar curve shape, about one third of the starch height ratio | [VERIFIED] Go23 |
| PVA glue films 16 to 171 um | water 20 C | fast initial swelling, slow approach to an asymptote; thinner layers swell more and rupture earlier under 6 to 20 Pa | [VERIFIED] G16 |
| Gelatine | alkali 20 C | swelled but was not removed; with dishwasher enzymes, swelling stopped at a water volume fraction of 0.9 and removal followed | [VERIFIED, snippet] Gordon-snip |
| Egg yolk on mica | protease solution, 40 C | swelled on contact with alkali; removal began after about 40 min | [VERIFIED, snippet] Gordon-snip |
| Egg yolk baked at 150 C | same | lower rate and extent of swelling, slower removal, could leave a residual film with a yield stress | [VERIFIED, snippet] Gordon-snip |
| Baked egg-yolk paste, 1.3 +/- 0.1 mm, 0.37 +/- 0.03 g on 625 mm^2, baked 60 min at 90 C | water / NaOH / LAS / detergent, 20 to 80 C, 120 min | swelling and removal increase with temperature (40 to 60 C); in these beaker tests all samples soaked at 80 C were reported totally removed after 120 min (whereas in the same thesis's flow cell, water at 80 C did not remove the deposit completely in 4 h; the thesis does not reconcile the two); stirring alone raised swelling and removal by up to 38 % | [VERIFIED] Z19 sections 3.1, 7.1 |
| Complex model soil (CMS: cooked pasta, milk, margarine, cheese powder; slurry 52 % water, 24 % carbohydrate, 18 % fat, 5.7 % protein, 0.3 % salt), dried 24 h, baked 7 min at 204 C; 280 +/- 3 g m^-2, 270 to 300 um, cracked; 47 % fat after baking | pH 7, 20 C | delta_max - delta_0 = 0.08 to 0.10 mm; k_delta = 0.91e-3 s^-1 | [VERIFIED] C22 Tables 1, 2 |
| CMS | pH 7, 50 C | 0.16 to 0.18 mm; k_delta = 3.3e-3 s^-1 | [VERIFIED] C22 Table 2 |
| CMS | pH 9, 20 C / 50 C | 0.22 mm, 1.02e-3 s^-1 / 0.15 mm, 2.7e-3 s^-1 | [VERIFIED] C22 Table 2 |
| CMS | pH 8, 20 C; pH 10, 20 C | 0.25 mm, 4.0e-3 s^-1; 0.32 mm, 1.38e-3 s^-1 | [VERIFIED] C22 Table 2 |
| CMS + 0.1 wt% surfactant, pH 7 | 20 C | SDBS 0.13 mm, 2.87e-3; CTAB 0.15 mm, 3.10e-3; TX-100 0.16 mm, 2.99e-3 s^-1 (surfactant at 20 C swells it about as much as water at 50 C) | [VERIFIED] C22 Table 2 |
| Whey protein isolate gel | NaOH | OH- penetration front with D_OH 6e-11 to 1.1e-10 m^2 s^-1 (20 to 55 C); optimum NaOH about 0.5 wt% for swelling, higher concentrations give a rubbery, non-swelling layer | [VERIFIED] Go24 |
| beta-lactoglobulin gels | NaOH | marked swelling above pH 10; sharp rise of dissolution rate between pH 11 and 12; salts screen charges and reduce swelling and dissolution; above pH 13.3 dissolution slows again | [VERIFIED] PM-T section 2.3 (reviewing Mercadé-Prieto et al.) |

Swelling rate constants for the baked CMS correspond to time constants of 200 to 1000 s **[VERIFIED]** (C22). The apparent activation energy of CMS swelling at pH 7 is about 34 kJ mol^-1 **[ESTIMATED from k_delta = 0.91e-3 and 3.3e-3 s^-1 at 20 and 50 C]**.

**Water supply limit [ESTIMATED].** A dried egg-yolk layer of 137 g m^-2 that reaches lambda_inf = 7 to 14 holds 0.35 to 0.75 kg m^-2 of water; starch at 50 g m^-2 with a height ratio of 10.7 holds about 0.45 kg m^-2. A draining film is only 0.05 to 0.3 mm thick (0.05 to 0.3 kg m^-2). A surface that is merely splashed or dripped on cannot swell fully: the top boundary must be flux-limited by the water actually delivered (film thickness and renewal from the "films" sibling), not held at lambda_inf.

### 2.4 How strength falls with moisture

| Soil | Law | Tag / source |
|---|---|---|
| Starch (cohesion) | tau_coh = 500 MPa exp(-0.021 beta_f); or 181 kPa exp(-11.31 omega_f); or tau_0 = 73476 Pa phi^4.594 | [VERIFIED] Go24, Go23, J17 |
| Ketchup (adhesion) | tau_ad = 811 kPa exp(-0.016 beta_f) | [VERIFIED] Go24 |
| Starch pull-off force per unit width vs blade penetration depth after 45 s soak | F/B = 0.0096 exp(0.0321 h_pen), R^2 = 0.96 (units as printed in the figure caption, not stated in the text I extracted) | [VERIFIED] Go23 Fig. 4 caption |
| Baked CMS (adhesion-dominated blade force) | zeroth-order fall F_w = F_w(0) - k_Fw t, then after a transition time t_M first-order decay F_w = F_w,M exp(-(t - t_M)/t_Fw); F_w is not a simple function of mean voidage | [VERIFIED] C22 eq. 5, 6 |
| Petroleum jelly (temperature, not moisture) | J8, J9 | [VERIFIED] W14 |
| General statement | glass-to-rubber transition with rising water content and temperature lowers mechanical strength and the energy needed for cleaning | [VERIFIED] PM-T section 2.2.2 |

The exponential laws are steep: each additional 100 kg m^-3 of water lowers starch cohesion by a factor of 8.2 and ketchup adhesion by a factor of 5 **[ESTIMATED from the VERIFIED exponents]**. The same law read in reverse describes air-drying: a soil that loses water moves up the curve by orders of magnitude. This is why the model below carries water content as a state variable and derives strength from it, instead of carrying "drying time" as a parameter.

### 2.5 Measured effect of pre-soaking on subsequent removal

| Soil | Soak | Effect on removal | Tag / source |
|---|---|---|---|
| Baked tomato paste | water, 5 to 30 min | apparent adhesive strength fell from about 7 to about 2 J m^-2 and then stayed constant; 90 % lower after raising hydration temperature from 25 to 50 C | [VERIFIED second-hand] Z19 section 6 quoting Liu et al. 2002 |
| Whey protein concentrate | water/NaOH | adhesive strength fell at about 0.1 J m^-2 min^-1 over 50 min at 20 C, 0.3 over 30 min at 50 C, 1.2 over 5 min at 70 C, then constant | [VERIFIED second-hand] Z19 quoting Liu et al. 2006 |
| Egg albumin | NaOH | minimum adhesive strength 0.95 J m^-2 reached after 60 min at 20 C; 0.02 to 0.24 J m^-2 after 30 to 45 min at 50 to 70 C (the thesis gives the two high-temperature values in inconsistent order) | [VERIFIED second-hand] Z19 quoting Liu et al. 2007 |
| Toothpaste | 60 s at 30 C | adhesive force down 30 % | [VERIFIED second-hand] Z19 quoting Cole 2011 |
| Baked egg-yolk paste (1.3 mm) | no soak | no removal possible by the probe | [VERIFIED] Z19 section 7.1.4 |
| same | 15 min water, 20/40/60 C | adhesive 196 / 195 / 190 J m^-2; cohesive 120 / 113 / 108 J m^-2 | [VERIFIED] Z19 section 6.2.6, 6.2.7 |
| same | 30 min water, 20/40/60 C | adhesive 190 / 164 / 150; cohesive 115 / 102 / 100 J m^-2 | [VERIFIED] Z19 |
| same | 15 min 1 % NaOH, 20/40/60 C | adhesive 161 / 150 / 138; cohesive 108 / 100 / 90 J m^-2 | [VERIFIED] Z19 |
| same | 30 min 5 % NaOH, 20/40/60 C | adhesive 122 / 117 / 104 J m^-2 | [VERIFIED] Z19 |
| same | 15 to 30 min | going from 15 to 30 min lowered adhesive strength by 16 to 21 % and cohesive by 7 to 10 % | [VERIFIED] Z19 section 6.2.10 |
| Baked CMS | water pH 7, 20 C | F_w fell at 0.06 N m^-1 s^-1; mean end value after 500 s about 70 N m^-1 | [VERIFIED] C22 Table 3, Fig. 7 |
| same | water pH 7, 50 C | 0.51 N m^-1 s^-1 until t_M = 220 s, then decay with t_Fw = 125 s; 19 N m^-1 at 500 s | [VERIFIED] C22 |
| same | pH 9 / pH 12, 20 C | 0.15 / 0.11 N m^-1 s^-1 | [VERIFIED] C22 Table 3 |
| same | pH 9 / pH 12, 50 C | 0.26 / 0.26 N m^-1 s^-1, t_M = 220 / 300 s | [VERIFIED] C22 Table 3 |
| same | pH 9 + 0.1 % SDBS, 20 / 50 C | 0.14 / 0.41 N m^-1 s^-1; at 50 C t_M = 200 s, t_Fw = 120 s | [VERIFIED] C22 Table 3 |
| same | pH 9 + 0.1 % CTAB | t_M = 40 s at both temperatures; 0.42 N m^-1 s^-1 at 20 C; t_Fw = 213 / 238 s; little residue (agent reaches the interface fast) | [VERIFIED] C22 Table 3 |
| same | pH 9 + 0.1 % TX-100, 20 / 50 C | 0.15 N m^-1 s^-1 at 20 C; at 50 C t_M = 80 s, t_Fw = 139 s | [VERIFIED] C22 Table 3 |
| Xanthan gum film | about 60 s wetting | falling film alone then removes it | [VERIFIED] W14 |
| PVA film | t_c proportional to thickness (above 75 um) | no removal before t_c, peeling afterwards | [VERIFIED] G16 |
| Starch, pre-wetted 120 or 240 s then flow started | | a large part of the layer is removed within seconds when flow starts (the part with yield stress below the wall shear stress); the rest follows the slow diffusion-limited regime | [VERIFIED] J17 |

Apparent activation energy of the CMS adhesion decay at pH 7: about 56 kJ mol^-1 **[ESTIMATED from 0.06 and 0.51 N m^-1 s^-1 at 20 and 50 C]**. The initial blade force of the CMS is not printed in C22; from the rates and end values it lies between about 100 and 300 N m^-1 **[ESTIMATED]**.

Timescale ordering for the CMS at 50 C **[VERIFIED]** (C22): adhesion-force decay (120 to 240 s) is faster than swelling (200 to 1000 s), which precedes oil-droplet release (onset about 700 to 1000 s; activation energy 44 kJ mol^-1; about 14 % of the fat released as droplets). Oil release is a consequence, not a cause, of weakening.

---

## 3. Removal rate laws under film shear and jets

### 3.1 The Pérez-Mohedano swelling-removal model (egg yolk, scanning fluid dynamic gauge)

#### 3.1.1 Mechanisms and governing equation

Three mechanisms act on the layer thickness h: swelling (S), removal while an external shear is applied (SS: enzyme-weakened material stripped mechanically), and removal while no external shear is applied (SD, "soil dissolution": enzyme-induced disengagement followed by mass transfer to the bulk). Both removal routes exist only when protease is present (at pH <= 10.5 or T < 55 C) **[VERIFIED]** (PM-T section 6.4.2):

    dh/dt = S - f(t) * SS - (1 - f(t)) * SD                                          (PM1)

- S: thickness rate from the non-linear poroelastic swelling equation S2 to S4, solved on N "theoretical layers".
- f(t): frequency function, a periodic step equal to 1 while the jet (gauging nozzle) acts on the location and 0 otherwise; with interval length t_i and normalised start and end N_ts, N_te: f = 1 if N_ts <= (t - (i - 1) t_i)/t_i <= N_te **[VERIFIED]** (PM-T eq. 6.2, 6.3).
- SS = k_ss * g(t), SD = k_ds * g(t), with g = 0 for t < t_lag, rising linearly from 0 to 1 between t_lag and 1.5 t_lag, and 1 afterwards **[VERIFIED]** (PM-T section 6.4.3.3: "a linear increase in the removal rate ... after the initial lag time for an extra half of the lag time").
- Layer bookkeeping: removal is accumulated; when it exceeds the thickness of the top layer(s) those layers are deleted and the remainder is carried over; swelling continues in the layers below with unchanged parameters (the enzyme only affects the top layers) **[VERIFIED]** (PM-T section 6.4.3.5).
- Outputs: thickness, dry soil remaining (each layer carries a fixed dry mass), total mass, percent cleaning, and "saturation" (fraction of equilibrium swelling), which peaked at only 50 to 60 % because the layer was being removed before it could swell fully **[VERIFIED]** (PM-T section 6.4.3.7).

The gauge imposes the wall shear stress **[VERIFIED, reconstructed]** (PM-T eq. 3.4): tau_wall = 3 mu Q / (pi a^2 r), with Q the flow through the nozzle, a the nozzle-to-surface gap and r the radial position; it also applies suction of about 500 Pa (pull force about 1.6 mN), which caused lift-up of weak layers **[VERIFIED]** (PM-T section 6.3.1).

#### 3.1.2 What the statistics say about each factor

Partial-least-squares analysis of 22 runs (T 30 to 55 C, pH 9.5 to 11.5, protease 0.02 to 0.10 g L^-1, shear 12 to 65 Pa, frequency factor 8.5 to 100 %) **[all VERIFIED]** (PM-T section 6.2.2, 6.5, 8.1):

- pH: strong positive effect on thickness in the first 10 min (swelling) and negligible effect on the removal stage.
- Temperature: positive on swelling for the first 20 min, then the largest negative (removal) contributor.
- Enzyme level: no effect for a lag of about 10 min, then the main driver of removal, roughly constant from 20 to 80 min.
- Frequency factor: main mechanical driver of removal after the lag.
- Net shear stress between 12 and 65 Pa: **not significant**. Interpretation offered: a shear threshold exists below which nothing is removed, and above which the rate rises only slowly with shear. Gordon et al. (2012) independently report that the time to clean egg yolk depended only weakly on shear stress above 10 Pa, and that some flow was required for complete cleaning **[VERIFIED, snippet]** (Gordon-snip).
- Net removal typically starts after 15 to 20 min.

#### 3.1.3 Rates at 30 to 50 C (pH 10.5, standard protease, 24 Pa)

At 50 C the swelling-corrected rates settled at about 6 um min^-1 for dissolution and about 30 um min^-1 while sheared at 8.5 % frequency; under continuous shear (100 %) the rate peaked at 32 um min^-1 at 20 min and cleaning was complete soon after 30 min **[VERIFIED]** (PM-T section 6.4.3.3). At 30 and 40 C the instantaneous sheared rate was higher at 8.5 % frequency than at 100 %: the enzyme loosens material at a limited rate, so a longer unsheared interval leaves more material "ready to be removed" for the next pass. Continuous shear still gives the shortest total cleaning time because dissolution alone is slow **[VERIFIED]** (PM-T section 6.4.3.3).

Arrhenius analysis of the dissolution rate at 30, 40, 50 C gave E_a of about 4.8 kJ mol^-1 (R^2 = 0.999) **[VERIFIED]** (PM-T Fig. 6.31). **Flag:** this is inconsistent with the same thesis's later numbers: its response-surface model gives k_ds = 2.84 um min^-1 at 30 C and 9.63 at 55 C (about 40 kJ mol^-1), and the in-dishwasher cleaning rates double from 30 to 55 C (about 24 kJ mol^-1) **[ESTIMATED from VERIFIED values]**. I recommend 20 to 25 kJ mol^-1 with a calibration range of 5 to 40.

Example parameter set that reproduced a run at 50 C, pH 10.5, standard enzyme, 24 Pa, 17 % frequency **[VERIFIED]** (PM-T Table 6.10): 50 layers, time step 3 ms, D = 2.5e-10 m^2 s^-1, chi = 0.9, N = 6e26 m^-3, k_ss = 25.10 um min^-1, k_ds = 5.55 um min^-1, lag 9 min.

#### 3.1.4 Full parameter table (lag times and removal rates for every run)

**[all VERIFIED]** (PM-T Table 7.6; rates are reductions of swollen thickness; blank = not measured in that configuration).

| T (C) | pH | Protease (g L^-1) | Frequency factor (%) | Shear (Pa) | t_lag (min) | k_ds (um min^-1) | k_ss (um min^-1) |
|---|---|---|---|---|---|---|---|
| 55 | 9.5 | 0.10 | 9 | 65 | 0.38 | 11.72 | 26.29 |
| 30 | 9.5 | 0.06 | 54.5 | 65 | | 3.30 | 9.43 |
| 30 | 10.5 | 0.02 | 9 | 38.5 | 10.94 | 5.31 | 16.46 |
| 55 | 11.5 | 0.02 | 100 | 12 | 5.03 | | 53.20 |
| 30 | 9.5 | 0.10 | 9 | 12 | 18.77 | 4.64 | 16.73 |
| 42.5 | 10.5 | 0.06 | 54.5 | 38.5 | | 8.29 | 16.91 |
| 30 | 11.5 | 0.06 | 54.5 | 38.5 | | 9.66 | 15.62 |
| 55 | 9.5 | 0.06 | 9 | 12 | 4.52 | 9.16 | 25.56 |
| 42.5 | 9.5 | 0.02 | 54.5 | 38.5 | | 6.40 | 9.09 |
| 30 | 9.5 | 0.10 | 100 | 38.5 | 0.80 | | 7.25 |
| 55 | 9.5 | 0.02 | 100 | 65 | 6.19 | | 16.99 |
| 42.5 | 11.5 | 0.10 | 100 | 12 | 8.37 | | 42.56 |
| 30 | 10.5 | 0.10 | 54.5 | 65 | | 7.08 | 13.34 |
| 42.5 | 10.5 | 0.06 | 100 | 38.5 | 16.83 | | 18.97 |
| 30 | 10.5 | 0.02 | 100 | 12 | 25.30 | | 10.18 |
| 55 | 11.5 | 0.10 | 9 | 38.5 | 10.54 | 60.87 | 93.54 |
| 55 | 10.5 | 0.02 | 54.5 | 65 | | 7.43 | 13.39 |
| 55 | 11.5 | 0.10 | 100 | 65 | 3.55 | | 77.21 |
| 42.5 | 11.5 | 0.06 | 9 | 65 | 20.29 | 37.30 | 133.74 |
| 55 | 9.5 | 0.10 | 54.5 | 12 | | 10.82 | 20.27 |
| 30 | 11.5 | 0.02 | 100 | 65 | 16.86 | | 12.94 |
| 42.5 | 11.5 | 0.02 | 9 | 12 | 33.23 | 23.57 | 66.83 |
| 30 | 9.5 | 0.06 | 17 | 65 | | 5.35 | 12.87 |
| 42.5 | 10.5 | 0.06 | 17 | 38.5 | | 10.23 | 21.84 |
| 30 | 11.5 | 0.06 | 17 | 38.5 | | 11.45 | 19.96 |
| 42.5 | 9.5 | 0.02 | 17 | 38.5 | | 5.73 | 10.21 |
| 30 | 10.5 | 0.10 | 17 | 65 | | 7.56 | 21.71 |
| 55 | 10.5 | 0.02 | 17 | 65 | | 8.90 | 11.28 |
| 55 | 9.5 | 0.10 | 17 | 12 | | 14.03 | 14.51 |

Response-surface models built on this table: lag time from T, pH, enzyme, frequency (R^2 = 0.862, adjusted 0.695, RMSE 7.2 min); k_ds from T, pH, enzyme with interactions and squares (R^2 = 0.848, adjusted 0.718, RMSE 8.5 um min^-1); k_ss from T, pH, enzyme, frequency with second-order terms (R^2 = 0.878, adjusted 0.633, RMSE 19.9 um min^-1). Shear stress was not used as an input **[VERIFIED]** (PM-T section 7.3.1.2, Fig. 7.12). The coefficients of the response surfaces are not printed in the thesis; the table above must be refitted.

Readings of the table **[ESTIMATED]**: outside pH 11.5, k_ds lies between 3 and 14 um min^-1 and k_ss between 7 and 26 um min^-1, with k_ss/k_ds typically 1.5 to 3.5; at pH 11.5 and T >= 42.5 C both jump by a factor of 3 to 6 (alkaline hydrolysis adds to the enzyme); lag times scatter between 0.4 and 33 min with no simple trend, which is the weakest part of the model.

### 3.2 Cohesive erosion with a threshold

- Dresden rule D3: instantaneous removal of everything above the weakest interface whose cohesive strength is below C * tau_hyd. Because the strength profile follows the water-content profile, erosion tracks the swelling front: the layer erodes at the speed at which the "strength = load" iso-surface moves into the soil. The removal rate is then nearly independent of the initial loading and the cleaning time is proportional to it, as measured (Go23 section 4.3) **[VERIFIED]**.
- Measured dependence on flow: the starch removal rate rose about linearly with bulk velocity from 0.5 to 2 m s^-1 (Re 5000 to 20 000) and the 90 % cleaning time fell about linearly **[VERIFIED]** (Go23 section 4.3.3).
- Protein + enzyme: a threshold of order 10 Pa, with weak dependence above it (section 3.1.2).
- Spatial non-uniformity of the loading (standard deviation about 5 g m^-2 at a mean of 50 g m^-2) is what produces the constant-rate stage followed by a decay stage; without it the simulated rate accelerates to an abrupt end **[VERIFIED]** (Go23 section 4.2).
- Order-of-magnitude rate for the weak starch soil **[ESTIMATED from Go23 text: about 50 g m^-2 removed in a few hundred seconds at 1 m s^-1, wall shear of a few Pa]**: about 0.2 g m^-2 s^-1 at about 4 Pa. Native, cooked-and-retrograded or baked starches are far slower and need amylase (IKW classifies starch mix and pasta as amylase-sensitive) **[VERIFIED classification]** (IKW Table 1).

### 3.3 Dissolution and mass-transfer-limited removal

**Soluble soils (sugars, salts, acids, fresh drink residues).** Flux from a surface whose top layer is the saturated solution:

    m_dot'' = k_L * (c_sat - c_bulk)            [kg m^-2 s^-1], c in kg solute per m^3 solution     (X1)

Mass-transfer coefficients **[RECALLED: standard results; not opened this session]**:

    Shear-driven thin concentration boundary layer over a soluble patch of length L (Lévêque):
        k_L = 0.808 * (gamma_w * D^2 / L)^(1/3),    gamma_w = tau_w / mu                          (X2)
        (valid while the boundary layer is thin compared with the film: L << gamma_w h_film^3 / D)
    Fully turbulent wall flow, high Schmidt number (Shaw and Hanratty form):
        k_L = 0.089 * u_tau * Sc^(-0.704),          u_tau = sqrt(tau_w / rho),  Sc = mu/(rho D)    (X3)
    Stagnation zone of an impinging liquid jet of diameter d (Liu, Lienhard and Lombara form):
        Sh_d = k_L d / D = 0.745 * Re_d^(1/2) * Sc^(1/3)                                          (X4)

Example **[ESTIMATED]**: sucrose (D ~ 5e-10 m^2 s^-1 **[RECALLED]**, c_sat ~ 880 kg m^-3 of solution at 40 C **[RECALLED]**), falling film with tau_w = 1 Pa at 40 C (mu = 6.5e-4 Pa s), L = 0.05 m: X2 gives k_L = 1.6e-5 m s^-1 and a flux of about 0.014 kg m^-2 s^-1, so a dried syrup film of 100 g m^-2 dissolves in under 10 s of continuous film flow. Allowing a factor 3 to 10 for the viscous concentrated boundary layer, sugars are removed in seconds to about a minute wherever a film flows. Soluble soils are limited by wetting coverage, not by kinetics.

**Swollen polymer gels (protein in alkali, gelatinised starch).** The polymer must first disentangle. The Xin, Chen and Özkan (2004) model for whey-protein deposits, as summarised in PM-T section 2.3 **[VERIFIED summary]**: no removal before a "reptation time"; then a first-order disengagement whose rate constant depends on the volume fraction of disengaged chains at the interface, which reaches a critical value and gives a constant removal rate; the final decay stage scales with the remaining covered area. Rate-limiting step by regime for beta-lactoglobulin gels (Mercadé-Prieto et al., via PM-T) **[VERIFIED summary]**: high T, low pH, minimal flow: external mass transfer; high T and high pH with high flow: reaction-controlled formation of small aggregates; mild T and pH with high flow: erosion of swollen layers limited by swelling kinetics.

The Dresden implementation for starch **[VERIFIED]** (J17 eq. 2 to 5): the wall value of the soil volume fraction seen by the liquid is

    phi_w(t) = 0                                                         for t < t_r
    phi_w(t) = alpha_d * phi_max * exp(C_sw (t - t_r)) / (Psi + exp(C_sw (t - t_r)))   for t >= t_r
    alpha_d = min(1, m_s''(t) / m_s,d'')        (decay stage below m_s,d'' = 5.8 g m^-2)
    m_dot'' = -R * (d phi/dy)_w                                                              (X5)

with the constants of section 1.5. Note for implementers: R (1.1e-5 to 1.4e-5 g m^-1 s^-1) is tied to the artificially large liquid-side diffusivity (1e-8 m^2 s^-1, "three orders of magnitude larger than the value measured") used in that simulation; dividing R by the soil density gives an effective macromolecular diffusivity of about 1.2e-11 m^2 s^-1 **[ESTIMATED]**. Use the structure (delay, sigmoidal rise, decay stage), not the number.

### 3.4 Viscous shifting (liquid and soft-solid soils: melted fat, oil, sauces, swollen gels above yield)

Dresden rule D6: the layer shears at the rate at which its own rheology balances the imposed wall shear stress, and material is advected to the downstream segment **[VERIFIED]** (Go24 eq. 19, 20).

Lubrication form for an immiscible soil film of thickness h_s, viscosity mu_s, density rho_s, yield stress tau_y, under a liquid film exerting tau_w, on a surface whose downslope gravity component is g_t **[RECALLED: Yeckel-Middleman type thin-film balance; the similarity solutions are my derivation]**:

    d(h_s)/dt + div_s( q ) = 0
    q = [ (tau_w - tau_y)+ * h_s^2 / (2 mu_s) ] * t_hat + [ rho_s g_t h_s^3 / (3 mu_s) ] * g_hat    (V1)
    Shear thinning far from the leading edge (distance x):   h_s(x, t) = min( h_0, mu_s x / (tau_w t) )   (V2)
    Gravity drainage on a wall (distance x below the top):   h_s(x, t) = min( h_0, sqrt( mu_s x / (rho_s g_t t) ) )   (V3)

Example **[ESTIMATED]**: melted butterfat (mu_s ~ 0.03 Pa s at 50 C **[RECALLED]**), x = 0.05 m, t = 600 s: shear at 1 Pa thins the film to 2.5 um; gravity alone leaves 17 um. Shear and drainage never take an oil film to zero; the last micrometres need roll-up, emulsification or saponification (surfactant and alkali, "chemistry" sibling). That residual is the greasy film or water-break seen when cleaning fails.

Below the melting range the fat has a yield stress far above film shear (lard at 20 C: elastic modulus about 15 kPa, removal force about 115 N m^-1 **[VERIFIED]** A15) and V1 gives zero flux; the fat then behaves as a Cambridge "viscoplastic layer" (J1, J6, J8, J9) and only jets move it.

### 3.5 Chunk detachment, blistering and sloughing

- Water can reach the interface faster than the layer weakens: PVA on glass blistered and detached under the blisters while staying attached elsewhere **[VERIFIED]** (W14 section 3.1); egg yolk at pH 11.5 / 55 C blistered after about 2 h and lifted under gauging suction **[VERIFIED]** (PM-T section 6.3.1); baked lard lifted as one film when alkali or LAS undercut it **[VERIFIED, snippet]** (A15b-snip).
- Cracked baked soils swell laterally, close their cracks, and release oil into them; at pH 9 with CTAB or TX-100 the swollen CMS layer sloughed off **[VERIFIED]** (C22).
- PVA peeled with "fingers" in the radial flow zone **[VERIFIED]** (G16). Pre-wetted starch developed a wavy surface that raised the removal rate above the smooth-layer prediction **[VERIFIED]** (J17).
- Thick layers (2 to 8 mm) hit by a jet form liquid-filled blisters that burst **[VERIFIED]** (FW20 citing Tuck et al.).

Model consequence: detachment of an element should be allowed either because the load exceeds the interface strength (D4) or because the interface integrity has decayed to zero under chemistry and the layer's own weight plus film drag suffices; detached chunks are particulates for the redeposition model ("chemistry" sibling).

### 3.6 Intermittency (shear frequency)

- In a dishwasher a given point is hit directly by a jet for a very small fraction of the time: 0.07 % and 1.59 % for the two jets that reached the test tile, once every 1.71 s at 35 rpm; "less than 10 % in most cases" over a design study **[VERIFIED]** (PM-T section 7.3.1.1, 8.1).
- Mean removal rate in the Pérez-Mohedano form: k_mean = k_ds + f (k_ss - k_ds). With f = 0.016 the jet term is a few percent to about 10 % of the total for egg yolk (section 6.2).
- The instantaneous sheared rate depends on f (section 3.1.3), so k_ss is not a pure material constant. For dishwasher duty cycles use the low-frequency values (9 % and 17 % rows of the table).
- Jet-breakup and non-coherent jets reduce both the radial-flow-zone size and the cleaning rate of petroleum jelly (Feldung Damkjær et al., cited in B17) **[VERIFIED mention]**; quantitative treatment belongs to the "jets" sibling.

---

## 4. Adhesion and cohesion strength data

### 4.1 Micromanipulation and millimanipulation measurements

Method reminder: a blade or T-shaped probe is dragged at a fixed gap above the substrate; the work per unit area swept (J m^-2) equals the force per unit blade width (N m^-1). A small gap (50 to 100 um) probes adhesion (if the substrate is left clean); a large gap (about 1 mm) probes cohesion **[VERIFIED]** (Z19 section 2 and 7.1.4; C22). The force includes plastic deformation and lifting of the displaced material, so values rise with layer thickness and are not pure interfacial energies **[VERIFIED]** (Go23 section 4.1.1; A15).

| Soil, preparation | Substrate | Test conditions | Strength (N m^-1 = J m^-2 unless stated) | Failure mode | Tag / source |
|---|---|---|---|---|---|
| Tomato paste, baked | stainless steel | varied baking time, hydration time, temperature | 1 to 20 overall; rises with baking time and thickness; 7 falling to 2 as hydration goes from 5 to 30 min; 90 % lower at 50 C than 25 C; higher on rougher surfaces | adhesive (cohesive strength higher at room temperature) | [VERIFIED snippet + second-hand] Liu-snip; Z19 |
| Whey protein concentrate | stainless steel | NaOH 0 to 5 %, 20 to 70 C | 0 to 10; raising NaOH from 0 to 0.1, 0.5, 1, 2, 5 % lowered it by 0.25, 0.82, 2.27, 4.01, 4.09 | cohesive (adhesion stronger) | [VERIFIED second-hand] Z19 quoting Liu et al. 2006 |
| Egg albumin | stainless steel | NaOH, 20 to 70 C | minimum 0.95 at 20 C; 0.02 to 0.24 at 50 to 70 C | adhesive | [VERIFIED second-hand] Z19 quoting Liu et al. 2007 |
| Bread dough | stainless steel | | (values not obtained) | adhesive | [VERIFIED snippet] Liu-snip |
| Egg-yolk paste baked 60 min at 90 C, 1.3 mm, about 590 g m^-2 | 316 steel, Ra 0.39 um, water contact angle 66 degrees | after 15 to 30 min soak (table in section 2.5); gap 100 um / 1 mm | adhesive 104 to 196; cohesive 82 to 120 | cohesive (adhesive > cohesive in all cases) | [VERIFIED] Z19 |
| Toothpaste | steel | gap 0.1 mm / 1 mm | 61.5 +/- 2.6 / 44.6 +/- 1.2 | cohesive | [VERIFIED second-hand] Z19 quoting Cole |
| Chocolate | polycarbonate | 25 C to 35 C | 2000 falling to 250; rises again to 2000 between 7 and 10 min hydration | | [VERIFIED second-hand] Z19 quoting Rois Anwar 2016 |
| Lard, unbaked, 6.7 mm layer | 316 steel | 20 C, scrape depth leaving 1 mm, 2 mm s^-1 | steady about 115; relaxes to a residual 20 to 37 when the blade stops; G' about 15 kPa, G'' about 10 kPa | cohesive | [VERIFIED] A15 |
| Lard baked at 250 C, 0.6 mm layer | 316 steel | 20 C, gap 0.4 mm, 2 mm s^-1 | about 25 before polymerisation; over 200 after (4 to 5 h); about 220 with adhesive failure at 4 h; 1 wt% ovalbumin delays polymerisation (about 100 at 4 h, cohesive) | cohesive, then adhesive once polymerised | [VERIFIED] A15 |
| Complex model soil, baked 7 min at 204 C, 280 g m^-2 | 316 steel | immersed, gap 50 um, 0.1 mm s^-1 | about 70 after 500 s at 20 C; 19 after 500 s at 50 C; initial 100 to 300 [ESTIMATED] | cohesive, becoming adhesive after t_M | [VERIFIED] C22 |
| Sponge cake, baked | steel, aluminium, 7 fluoropolymers | dry | force set by cake oil content, hardly by surface chemistry, energy or roughness; residue mass proportional to the work of adhesion of oil on the surface in water | cohesive or mixed | [VERIFIED abstract] M17 |
| Dried starch after 45 s soak | 304 steel | 23 C | cohesive stress from about 1 kPa (dry side of the front) to a few Pa (swollen), section 1.5 | cohesive | [VERIFIED] Go23 |
| Dried ketchup | steel | 20 C water | adhesive stress 811 kPa exp(-0.016 beta_f) | adhesive | [VERIFIED] Go24 |
| Lard / starch / whey mixtures | steel, aluminium, PTFE | | hot water is effective on steel and PTFE and lowers the shear needed | adhesive, mixed or cohesive by case | [VERIFIED snippet] SE24-snip |

Gaps: I found no force-per-area data on glass or glazed ceramic (the dominant dishwasher substrates) and none on plastics other than the polycarbonate chocolate point. Substrate effects must be estimated (section 7.6).

### 4.2 Effects of drying time, baking, hydration, temperature (qualitative synthesis)

- Baking time and temperature raise both strengths (tomato paste; lard by a factor of 8 or more on polymerisation; egg yolk baked at 150 C swells and cleans more slowly) **[VERIFIED]**.
- Hydration lowers adhesion over minutes to an hour, to a plateau **[VERIFIED]**.
- Temperature during hydration lowers strength (tomato 90 % from 25 to 50 C; chocolate 8-fold from 25 to 35 C because the fat melts) **[VERIFIED second-hand]**.
- Protein content of a fat changes when it polymerises, not whether **[VERIFIED]** (A15).
- A study of soil on surgical instruments (not tableware) found that drying for more than about 8 h changes the solubility of the soil, with a marked change after 72 h, and that high humidity prevents this **[VERIFIED, snippet]** (SI23-snip). Standard dishwasher tests dry soils for 2 h at 80 C; a Bonn/Albstadt study argues this oven drying approximates the habits of about 92 % of German households **[VERIFIED, snippet]** (Gorny-snip). I found no published curve of dishwasher cleaning result against air-drying time from 0 to 24 h; this is a calibration gap.

### 4.3 Linking blade forces to jet peeling (proposed bridge)

Both the millimanipulation force F_w and the film momentum flow M are forces per unit width at a moving front, so a peel criterion can be written M_Y = F_ad / eta_M, where eta_M is the fraction of the film momentum converted into force on the front. For a film deflected by a ramp of angle chi, eta_M = 1 - cos(chi) = 0.03 to 0.09 for chi = 15 to 25 degrees (from J6); for a steep step it tends to 1 **[ESTIMATED]**.

With jet M_0 of 23 to 74 N m^-1 at the footprint edge (section 1.4.4), the force available to the front is about 1 to 7 N m^-1 for a ramp and at most 23 to 74 N m^-1 for a step. Comparison with section 4.1 **[ESTIMATED]**:

| Soil state | F_ad (N m^-1) | Peeled by a direct jet? | Peeled by a falling film (M about 0.05 N m^-1)? |
|---|---|---|---|
| Soaked egg albumin, soaked whey protein, soaked tomato paste | 0.02 to 2 | yes | marginal to no |
| Fresh or briefly dried tomato paste | 7 to 20 | only near the footprint | no |
| Baked complex soil after about 10 to 15 min at 50 C | below 5 and falling | begins to | no |
| Baked complex soil, first minutes; thick baked egg yolk; polymerised lard | 70 to 220 | no | no |

This is consistent with the Cambridge petroleum-jelly data: tau_y = 50 Pa, delta = 300 um, chi = 15 degrees gives M_Y = 1.65 N m^-1 and a_max = 20 mm for the 35 mL s^-1 jet, inside the observed radial flow zone of 46 mm **[ESTIMATED check against VERIFIED G16 values]**. The bridge is a hypothesis to be calibrated; it is listed among the weakest claims.

---

## 5. Class-by-class behaviour

Conventions for this section. Composition figures are typical food-composition values **[RECALLED]** (standard composition tables; not opened this session) unless a source key is given. Areal loadings on real tableware after a meal are **[ESTIMATED]** unless they come from a test method (then **[VERIFIED]** with the key). "Difficulty" is my 1 (trivial) to 10 (normally survives a standard cycle) ranking for a 45 to 55 C enzymatic cycle; it is a synthesis and therefore **[ESTIMATED]**.

### 5.0 Common physics of ageing between the meal and the wash

**Air-drying [ESTIMATED].** Evaporation from a wet film: j = h_m (rho_v,surface - rho_v,room). With a natural-convection mass-transfer coefficient h_m of about 2.5e-3 m s^-1 (Sherwood number about 15 on a 0.15 m object, vapour diffusivity 2.5e-5 m^2 s^-1) and room air at 22 C and 50 % relative humidity (surface near the wet-bulb temperature, vapour-density difference about 3.5 g m^-3), j is about 9e-6 kg m^-2 s^-1, i.e. about 30 g m^-2 h^-1 (range 20 to 60). Hence:

| Deposit | Wet loading (g m^-2) | Time to lose its free water at room conditions | State after 2 h / 8 h / 24 h |
|---|---|---|---|
| Thin smear or drained film | 20 to 50 | 0.5 to 2 h | dry glassy film / same / same |
| Typical plate residue | 100 to 300 | 3 to 10 h | skinned, soft underneath / mostly dry / dry |
| Thick blob, ridge or crust | 1000 to 3000 | more than 24 h | skin only / leathery crust over moist core / hard crust, core still plasticised |

Thin films are limited by the air side, not by internal diffusion (100 um at D ~ 5e-11 m^2 s^-1 equilibrates in about 200 s). They end at the moisture content in equilibrium with room humidity: 0.138 kg/kg for dried starch at 23 C / 50 % RH **[VERIFIED]** (Go23) and 0.067 g per g dry for dried egg yolk **[VERIFIED]** (PM-T). Inside a closed, humid dishwasher drying is several times slower, so "loaded and left overnight" is a milder ageing than "left on the counter" **[ESTIMATED]**.

Because strength depends exponentially on water content (section 2.4), the transition from "wipes off" to "stuck" happens over the last 20 to 30 % of water loss, i.e. within the times in the table. The model should therefore compute the initial water content from loading, drying time and humidity, and derive strengths from it.

**Irreversible changes with heat and time.**

| Change | Condition | Effect on cleaning | Tag / source |
|---|---|---|---|
| Egg-yolk gelation | above about 70 C | network forms; still swells in alkali | [VERIFIED] PM-T section 3.3 |
| Egg-white denaturation | ovotransferrin about 61 C, ovalbumin about 84 C | sets to a gel; hot water on raw egg white fixes it | [RECALLED] |
| Whey-protein denaturation and deposition | above about 70 to 75 C; heat-exchanger "type A" deposit at 75 to 110 C is 50 to 70 % protein plus minerals | insoluble film needing alkali | [VERIFIED] Go24 (deposit); [RECALLED] (onset) |
| Meat proteins | myosin 40 to 60 C, collagen 56 to 65 C, actin 70 to 80 C | coagulated particles bound by gelatin | [RECALLED] |
| Starch gelatinisation | onset 55 to 85 C depending on source | paste that dries to an adhesive film | [VERIFIED] Wiki-starch |
| Starch retrogradation | hours (amylose) to days (amylopectin) after cooling | stiffer, more crystalline, less accessible to amylase | [VERIFIED "hours or days", lower digestibility] Wiki-starch; split [RECALLED] |
| Maillard browning, caramelisation | dry surfaces above about 120 to 140 C; sucrose about 160 C | cross-linked, low-swelling, brown, alkali-sensitive | [RECALLED] |
| Fat autoxidative polymerisation | lard: 3 to 5 h at 250 C to harden; thin films of unsaturated oils at 180 to 220 C: 0.5 to 2 h | removal force rises from about 25 to over 200 N m^-1; failure becomes adhesive | [VERIFIED] A15 (lard); thin-film times [ESTIMATED] |
| Baking of egg yolk at 150 C | | lower swelling rate and extent, slower removal, possible residual film | [VERIFIED snippet] Gordon-snip |
| Carbonisation | above about 250 to 300 C | inert to detergent chemistry | [RECALLED] |

Standard test soils encode these ageing routes and give calibration anchors **[all VERIFIED]** (IKW): starch mix dried 48 h in air then 4 h at 80 C; egg yolk dried 4 to 24 h, dipped 30 s in boiling water, dried 30 min at 80 C; minced meat 2 h at 130 C; pasta 2 h at 120 C; crème brûlée 2 h in air then 2 h at 140 C; milk microwaved 10 min at 450 W then 2 h at 80 C; milk skin heated to 88 C, dried overnight, 2 h at 80 C; tea cups stored at least 3 days. Soiled test items are stable for at least 14 days at 20 to 25 C and 40 to 60 % RH.

### 5.1 Egg

| Property | Egg yolk | Egg white |
|---|---|---|
| Composition (wet) | about 50 % water, 16 % protein (lipoproteins), 30 % lipid [RECALLED]; dry: 33 % protein, 62.5 % fat, <3.5 % minerals, 1 % carbohydrate [VERIFIED PM-T] | about 88 % water, 11 % protein (ovalbumin about half) [RECALLED] |
| Loading | test: 1.5 g wet on 140 cm^2 = 107 g m^-2, 750 +/- 100 mg dry = 54 g m^-2 [VERIFIED IKW]; CFT tiles 146 g m^-2 [VERIFIED PM-T]; real plates 100 to 600 g m^-2 wet in the smeared zone [ESTIMATED] | 50 to 300 g m^-2 wet, i.e. 5 to 35 g m^-2 dry [ESTIMATED] |
| Air-drying 0 to 24 h | smear skins in under 1 h and is a glassy lipoprotein film in 1 to 3 h; continues to harden slowly | thin transparent brittle film within 1 h; raw-dried albumen partly redissolves in cool water |
| Heating | gels above 70 C; baked at 150 C swells and cleans more slowly | sets irreversibly; fried edges brown |
| Mechanism | swelling in alkali, then protease hydrolysis of the top layers, removed by dissolution and by shear events; fails cohesively; last layer adhesion-limited | swelling; fails adhesively after soaking (adhesive < cohesive) [VERIFIED snippet Liu-snip] |
| What removes it | nothing below pH 11.5 without protease within 3 h; with protease see section 6; rate doubles 30 to 55 C; needs sustained wetting | alkali soak; minimum adhesive strength 0.95 J m^-2 after 60 min at 20 C and far lower at 50 to 70 C [VERIFIED second-hand Z19]; no optimum NaOH concentration reported for egg albumin [VERIFIED mention C22] |
| Speed in a dishwasher | 0.85 % min^-1 (30 C) to 1.75 % min^-1 (55 C) at pH 10.5 and mid enzyme after a 3 to 13 min lag; 4.66 % min^-1 at pH 11.5 [VERIFIED PM-T] | faster than yolk once soaked [ESTIMATED] |
| Difficulty | 8 (dried), 9 (cooked or baked) | 5 (raw-dried), 7 (fried on) |
| Residue when cleaning fails | matt pale-yellow to translucent film, uniform fading rather than patches; occasionally a clean stripe along a jet track | thin whitish film or flakes at edges, visible when dry |

Thick baked yolk (1.3 mm) was not completely removed by water even at 80 C in 4 h of flow at 0.5 m s^-1; NaOH or LAS at 60 to 80 C removed it within 4 h; nothing removed it completely at 40 C **[VERIFIED]** (Z19 section 7.1.3). Thickness matters as much as chemistry.

### 5.2 Dairy

| Soil | Composition and state | Loading | Ageing | Mechanism, remedy, speed | Difficulty | Residue on failure |
|---|---|---|---|---|---|---|
| Milk film (cold) | 87 % water, 3.5 % fat, 3.3 % protein (80 % casein), 4.8 % lactose | drained film 20 to 50 g m^-2 wet, 3 to 6 g m^-2 dry | dries in under 1 h to a lactose/casein glass | redisperses in warm water; dissolution-limited, tens of seconds | 2 | faint white haze |
| Heated, microwaved or burnt milk | denatured whey protein plus calcium phosphate, browned lactose-protein | test: 10 mL milk baked in a 150 mL beaker, 10 min at 450 W, then 2 h at 80 C [VERIFIED IKW] | each heating step cross-links further | "persistent / alkaline-sensitive" class [VERIFIED IKW]; swells only after reacting with OH-; dissolution rate rises sharply between pH 11 and 12 [VERIFIED PM-T]; at dishwasher pH relies on protease and time | 8 to 9 | cream to brown patches or rings, rough |
| Milk skin | protein/fat skin formed at 88 C | test recipe [VERIFIED IKW] | dried overnight, 2 h at 80 C | protease-sensitive [VERIFIED IKW] | 6 | translucent skin fragments |
| Melted cheese | casein-calcium network, 30 to 35 % fat, 35 to 45 % water | 300 to 2000 g m^-2 on gratin dishes | sets rubbery on cooling; hardens over hours | fat melts above 35 to 40 C and releases oil; casein swells in alkali, chelants loosen calcium bridges, protease erodes | 7 | rubbery pale-yellow strings and patches |
| Baked or browned cheese | Maillard-crosslinked crust with polymerising fat | rim crusts 200 to 1000 g m^-2 | | behaves as burnt-on (section 5.9) | 9 to 10 | brown crust at rims and corners |
| Yoghurt | acid casein gel, 85 to 88 % water; viscoplastic (Type 1) fresh | 50 to 300 g m^-2 | dries to an acid-gel film in 2 to 6 h | fresh: displaced by film flow; dried: casein dissolves above neutral pH | 3 fresh, 5 dried | white film, often in spoon bowls |
| Cream | emulsion, 18 to 48 % fat | 20 to 100 g m^-2 | fat film with protein | warm wash plus surfactant | 2 to 4 | greasy film |

### 5.3 Meat proteins, minced meat with fat, gravy

- Composition: cooked mince about 55 to 60 % water, 25 % protein, 15 to 20 % fat; gravy is a starch- or flour-thickened stock (3 to 6 % starch, 2 to 5 % fat, 1 to 3 % gelatin and protein).
- Loading: test soil is 3 g of a meat/egg/water blend on a 19 cm dessert plate, 11.8 +/- 0.5 mg cm^-2 wet (118 g m^-2), baked 2 h at 130 C **[VERIFIED]** (IKW). Real plates: 50 to 300 g m^-2 of juices and particles; roasting dishes far more.
- Ageing: juices dry to a gelatin-bound film with fat on top within 2 to 6 h; beef and lamb fat solidifies immediately on cooling.
- Mechanism: fat must melt (tallow is the limiting fat at eco temperatures, section 5.5); gelatin and coagulated protein swell and are hydrolysed; particles then leave by cohesive erosion. Class: protease-sensitive, with detergent alkalinity also playing a role **[VERIFIED]** (IKW). In a 217-run dishwasher study on CFT minced-meat tiles the significant factors were main-wash time, protease, amylase, percarbonate (it bleaches the colour) and their interactions **[VERIFIED]** (R24 Table 1).
- Difficulty: 4 fresh, 7 baked. Gravy: 4 to 5 (rehydrates quickly; amylase helps).
- Residue: brown specks and a thin protein film (made visible in tests with Phloxin B dye **[VERIFIED]** IKW); grey greasy film if the fat did not melt.

### 5.4 Starches

General behaviour: gelatinised starch dries to a clear, hard xerogel that bonds strongly to glass and glaze. Pregelatinised waxy maize starch swells about 10.7-fold in thickness in cold water and erodes cohesively (section 1.5) **[VERIFIED]**; amylose-rich, retrograded or baked starches swell much less and need amylase **[RECALLED]**. Hardness of the water and bleach both reduced amylase cleaning of CFT starch tiles in a dishwasher (bleach decomposes the amylase; hardness is thought to deposit on the soil) **[VERIFIED]** (R24).

| Soil | Composition and state | Loading | Ageing | Mechanism, remedy, speed | Difficulty | Residue on failure |
|---|---|---|---|---|---|---|
| Starch mix (test) | potato, maize, rice, wheat starch, 3.25 % suspension cooked 30 min at 95 C | 3.75 +/- 0.25 mg cm^-2 dry (37.5 g m^-2; 664 mg on 177 cm^2) [VERIFIED IKW] | 48 h air + 4 h 80 C | amylase-sensitive; gravimetric evaluation | 7 | clear film, invisible wet, hazy and rough dry; blue with iodine |
| Pasta | 62 to 66 % water, about 30 % starch, 5 to 6 % gluten protein | test: 3.0 g blended cooked spaghetti on a 25 cm plate, dried 2 h at 120 C [VERIFIED IKW]; real: starch film 20 to 100 g m^-2 plus stuck pieces | surface film dries in 1 to 2 h | amylase (and protease for gluten); thick pieces need soaking through | 6 to 7 | translucent film, stuck strands |
| Rice | 68 to 70 % water, 28 % starch; grains glued by leached amylopectin | isolated grains plus a film of 10 to 50 g m^-2 | glue dries in under 1 h; grain turns glassy in 3 to 8 h | the 10 to 50 um glue layer swells in minutes, the grain detaches as a particle (section 5.8); a dried grain rehydrates in 10 to 30 min | 5 | stuck grains; redeposited grains elsewhere |
| Mashed potato | 78 % water, 15 to 17 % starch, added fat and milk | 500 to 3000 g m^-2 | crust in 2 to 4 h, hard overnight | swelling and cohesive erosion; fat slows wetting when cold | 6 | white crusty patches |
| Porridge / oat flakes | 84 % water, 9 to 11 % starch, beta-glucan gum, protein, bran | bowls 300 to 1000 g m^-2 with thick ridges | tough glue-like film within 3 to 6 h | amylase plus long wet time; flake fragments leave as particles | 7 to 8 | beige film and flakes at the waterline of the bowl |
| Wheat-biscuit breakfast cereal | dry biscuit about 68 % starch, 11 to 12 % protein, 10 % fibre; in milk it becomes a paste of gelatinised starch, bran platelets and milk protein | 300 to 2000 g m^-2 in bowl bottoms and on spoons | sets within 1 to 3 h; "concrete" overnight | fibre-reinforced starch/protein composite: bran platelets shield the glue from water and shear; water must reach the interface through 1 to 3 mm ridges. No measurements found in the literature; model as a starch soil with reduced diffusivity and a particulate fraction | 9 | beige crusted patches, usually bowl bottom and rim line |
| Bread dough | gluten network with raw starch | smears 100 to 500 g m^-2 | hard in 2 to 6 h | fails adhesively (adhesive < cohesive) [VERIFIED snippet Liu-snip]; protease and amylase | 6 | grey-white hard smears |
| Flour-thickened sauces | starch paste with fat | 50 to 300 g m^-2 | film in 2 to 6 h | as gravy | 4 to 5 | hazy film |

### 5.5 Fats and oils

Solid-fat content (SFC) controls everything: below the melting range a fat is a viscoplastic solid that film shear cannot move; above it, it is a low-viscosity oil that drains and can be rolled up.

| Fat | SFC (%) at 5 / 10 / 20 / 30 / 35 / 40 / 45 C | Effectively liquid above | Tag / source |
|---|---|---|---|
| Milk fat (butter is about 82 % of this) | 63.3 / 56.4 / 22.5 / 5.9 / 1.0 / 0 / 0 (a second source gives 50.8 at 5 C, 18.6 at 20 C, 6.8 at 30 C) | about 35 C | [VERIFIED snippet] AMF-snip (two sources); 40 to 45 C zeros [RECALLED] |
| Lard | 40.2 / about 28 / about 20 / about 4 / about 2 / about 1 / 0 | about 40 to 45 C | 5 C value [VERIFIED snippet] Lard-snip; others [RECALLED] |
| Beef tallow | about 60 / 57 / 43 / 27 / 18 / 10 / 3; titre (solidification point) 42 to 45 C | about 47 to 50 C | SFC [RECALLED]; titre [VERIFIED snippet] Tallow-snip |
| Palm oil | about 60 / 50 / 25 / 9 / 5 / 3 / 0 (similar to lard between 25 and 40 C) | about 40 C | [RECALLED]; similarity [VERIFIED snippet] Palm-snip |
| Cocoa butter (chocolate) | about 90 / 88 / 77 / 45 / 5 / 0 / 0 | 35 to 37 C | [RECALLED] |
| Margarine blend in the Cambridge complex soil | melts over 20 to 40 C; mobile above 30 to 35 C | 40 C | [VERIFIED] C22 |
| Olive and seed oils | liquid above about 5 to 10 C | always | [RECALLED] |
| Lipstick waxes (carnauba, candelilla, beeswax) in castor oil | solid network to 60 to 85 C | above wash temperatures | [RECALLED] |

- Loading: buttered plate 5 to 20 g m^-2; oily salad bowl 5 to 30 g m^-2; roasting tin 50 to 300 g m^-2 **[ESTIMATED]**.
- Ageing: fats do not dry; they solidify on cooling and oxidise only slowly at room temperature (negligible in 24 h); baked thin films polymerise (section 5.0).
- Mechanism and remedy: (1) heat the item surface above the melting range (the item, not just the water: thick ceramics lag the wash water by minutes); (2) shear and gravity thin the oil film to micrometres (V2, V3); (3) surfactant and alkali roll up and emulsify the remainder; free fatty acids form soaps, which precipitate with hardness. Unbaked lard at 20 C has an elastic modulus of about 15 kPa and needs about 115 N m^-1 to scrape **[VERIFIED]** (A15), far beyond film shear.
- Temperature sensitivity of jet removal of a fat-like solid: k' rises about 500-fold from 20 to 60 C (J8, J9) **[VERIFIED]** (W14).
- Polymerised or baked-on fat: hard brown varnish; fails adhesively only when alkali or surfactant undercuts it; survives a normal cycle.
- Mayonnaise: about 75 % oil emulsified by yolk; fresh it is a Type 1 paste displaced by film flow; dried it behaves as an oil film over an egg-yolk film.
- Difficulty: oils 2; butter and margarine 2 to 3 (4 in a 40 C cycle on thick items); lard 3 to 4; tallow and lamb fat 5 to 6 below 50 C; mayonnaise 3 fresh, 6 dried; polymerised fat 10.
- Residue: greasy smear, water beading (water-break), rainbow film on glass; white waxy patches for tallow; brown tacky varnish for polymerised fat.

### 5.6 Sugars

| Soil | State | Mechanism and speed | Difficulty | Residue on failure |
|---|---|---|---|---|
| Honey, syrups | viscous Newtonian liquids (about 2 to 10 Pa s at 20 C), about 80 % sugars | dissolution and viscous displacement; seconds to a minute under a film (X1, X2) | 1 to 2 | sticky patch only where never wetted |
| Jam | sugar-pectin gel with fruit particles; dries to a sugar-glass skin in 2 to 6 h | dissolves in 1 to 3 min; skins and seeds become particles | 2 to 3 | seeds, fruit skin specks |
| Caramel, toffee | sugar glass, with dairy protein and fat in toffee | dissolution-limited: about 1 to 10 min per mm of thickness under film flow | 3 | amber glassy patch |
| Burnt sugar | partly polymerised (caramelans), dark, still alkali-soluble | slow dissolution plus undercutting; soak | 6 to 7 | black-brown glassy crust |
| Crème brûlée (test) | egg, cream, sugar custard; 3.5 g on a 19 cm plate (19.8 mg cm^-2 wet), 2 h air then 2 h at 140 C [VERIFIED IKW] | protease-sensitive with an amylase contribution [VERIFIED IKW] | 8 | brown film |
| Chocolate | cocoa-butter-continuous suspension of sugar and cocoa solids (30 to 35 % fat, 45 to 55 % sugar) | melts at 30 to 36 C; pulling energy on polycarbonate fell from 2000 to 250 J m^-2 between 25 and 35 C [VERIFIED second-hand Z19]; then drains, sugar dissolves, cocoa particles disperse | 3 | brown smear if the item stayed cold |

Rates in this table are **[ESTIMATED]** from section 3.3.

### 5.7 Tannin and pigment stains

| Stain | Nature | Loading | Removal | Difficulty | Residue on failure | Tag / source |
|---|---|---|---|---|---|---|
| Tea | oxidised polyphenols (theaflavins, thearubigins) bound to the surface through calcium (carbonate or silicate) and iron; forms at the liquid surface and plates out as the level falls | well under 1 g m^-2; test: two fills of 100 mL at 85 C drawn down in 20 mL steps, made with 16.8 dH water plus ferric ion, stored 3 days or more; Assam is the hardest | "bleachable" class; oxidative bleach (percarbonate with TAED, manganese catalysts) plus chelant and alkali; peroxide/TAED removal is limited in hard, bicarbonate-rich water; short cycles below 50 C fail; mechanics almost irrelevant | 6 to 7 | brown film and tide lines in cups | recipe and class [VERIFIED] IKW; chemistry statements [VERIFIED snippet] Tea-snip |
| Coffee | melanoidins plus coffee oils | under 1 g m^-2 | bleachable; less tenacious than tea | 4 | light-brown film | [RECALLED] |
| Red wine | anthocyanins and tannins; dried ring | under 1 g m^-2 | bleachable; colour shifts blue-grey in alkali before fading | 3 to 4 | grey-violet ring | [RECALLED] |
| Tomato (lycopene), carrot and pepper (carotenes) on plastics | lycopene is insoluble in water and soluble in fats (1 g L^-1 in hexane at 14 C) | pigment dissolved in the oil phase of the sauce | the dye partitions from the oil into hydrophobic polymers (polypropylene, polyethylene; less into SAN, copolyester, melamine) and sits below the surface; surface cleaning cannot reach it; oxidants and light fade it slowly; hot, oily contact speeds uptake | 9 to 10 for the stain on polypropylene (the sauce itself is 2 to 4) | orange tint of the plastic | solubility [VERIFIED] Wiki-lyco; uptake behaviour [RECALLED]/[ESTIMATED] |
| Turmeric / curry (curcumin) | lipophilic yellow dye | as above | also stains plastics; turns red-brown in alkali and degrades slowly; fades in light | 8 on plastics | yellow tint | [RECALLED] |

I found no quantitative kinetics for tea-stain bleaching in a dishwasher or for carotenoid diffusion into polypropylene in this session; rate constants in section 8 are estimates. The bleach chemistry itself belongs to the "chemistry" sibling.

### 5.8 Particulate and fibrous soils

Soils: spinach and herb leaf fragments (0.1 to 10 mm platelets), seeds (sesame, poppy, tomato, chilli; 0.5 to 3 mm), rice grains, coffee grounds (0.2 to 1 mm, oily), pepper, fruit skin, cereal bran. Spinach is one of the standard European test soils (with milk, tea, minced meat, egg, oat flakes and margarine) **[VERIFIED, snippet]** (HSRW-snip).

Physics **[all ESTIMATED]**:

- Attachment is by the dried binder (cell sap, starch, sugar, protein: a thin film soil of one of the other classes) and, when a film is thinner than the particle or is draining, by capillary force F_cap ~ 2 pi gamma d cos(theta): about 0.3 mN for d = 1 mm.
- Hydrodynamic drag on a particle of size d sitting in the linear shear layer at the wall: F_d ~ 8 tau_w d^2 (Stokes drag with the wall correction 1.7 at the particle centre) **[RECALLED formula]**. At tau_w = 1 Pa: 8 uN for d = 1 mm, 0.7 uN for 0.3 mm. Submerged weight of a 1 mm particle with density excess 200 kg m^-3: about 1 uN.
- So a fully submerged, un-glued 1 mm particle is moved by a 1 Pa film (drag exceeds weight and rolling resistance), but a particle pinned by a meniscus needs about 40 times more: particles are mobile only where the film is thicker than the particle or during jet passage, and they are pinned wherever films thin and drain.
- Flat leaf fragments behave like a film patch: they detach when the wall shear exceeds the shear strength of the hydrated binder (use the ketchup-type law tau_ad(beta_f) with the binder's water content), typically after 1 to 5 min of wetting.
- Detached particles travel with the recirculating water until filtered, and redeposit preferentially on surfaces with pooling or slow, thinning films (concave upward-facing surfaces, glass bases, cup rims) and during the final drain. Redeposition is modelled by the "chemistry" and "films" siblings; the soil model must hand over particle count, size and density.

Difficulty: detachment 3 to 5; overall result often poor because of redeposition. Residue: green or dark specks and grit, usually on items that were clean before the wash.

### 5.9 Burnt-on and carbonised residues

- Lasagne and gratin dishes: a composite of pasta starch, milk-protein sauce, tomato, cheese and fat, baked 30 to 45 min at 180 to 200 C. Bulk residue is soft; the rim and corners carry 50 to 300 um of dehydrated, Maillard-browned, fat-impregnated crust.
- Closest quantified analogue: the Cambridge complex model soil (pasta, milk, margarine, cheese powder; baked 7 min at 204 C; 280 g m^-2; cracked) **[VERIFIED]** (C22). Its thickness increases only by 0.08 to 0.18 mm on 0.27 mm (30 to 65 %) on soaking at pH 7, against a 10-fold increase for unbaked starch: baking cut the swelling capacity by more than an order of magnitude **[ESTIMATED from VERIFIED values]**. Its removal force is 70 N m^-1 after 500 s in water at 20 C and 19 N m^-1 at 50 C, still falling. Cleaning proceeds as two parallel processes: (I) hydration and swelling followed by migration of melted fat to the surface, and (II) penetration of solution to the soil/substrate interface, which lowers adhesion **[VERIFIED]** (C22-thesis abstract).
- Roasting tins: polymerised fat with protein fond and charred sugars; removal force over 200 N m^-1 **[VERIFIED for polymerised lard]** (A15).
- Pan fond: thin (5 to 50 um) Maillard film on steel; largely water-soluble while fresh and hot, tenacious once dried with polymerised fat **[ESTIMATED]**.
- Carbonised (black) deposits: unaffected by dishwasher chemistry; removed only if the layer beneath loses adhesion.
- What works: long hot alkaline soak (tens of minutes at 50 C or more), surfactant to reach the interface, then mechanical action. Direct jets cannot peel these layers until the removal force has fallen below a few N m^-1 (section 4.3).
- Difficulty 9 to 10. Residue: brown to black patches at rims, corners and the former liquid line; rough to the touch.

### 5.10 Mixed real-meal soils

| Soil | Composition and state | Mechanism and remedy | Difficulty | Residue on failure |
|---|---|---|---|---|
| Tomato sauce, ketchup | ketchup about 70 % water, 22 to 25 % sugars, pulp and pectin, lycopene 10 to 15 mg per 100 g; Type 1 paste when fresh | fresh: displaced by film flow; dried: adhesive detachment once water reaches the wall (test loading 278 g m^-2, law in section 1.5 [VERIFIED Go24]); cleaning time of order 1 to 10 min under a film [ESTIMATED] | 2 fresh, 4 dried | red-orange flakes; orange tint on plastics |
| Curry | oil-rich sauce with onion pulp, spice particles, turmeric | oil film shields the dried layer until it melts and emulsifies; particles; stain on plastics | 5 (8 for the stain) | yellow film and specks |
| Peanut butter | 50 % oil, 25 % protein, 20 % carbohydrate, under 2 % water; hydrophobic paste with a high yield stress | water neither wets nor penetrates; needs 40 C or more plus surfactant to emulsify the oil, then the solids disperse; thick smears on knives are the problem | 6 to 7 | tan greasy smear |
| Hummus | chickpea starch and protein with sesame oil; 65 % water | dries to a crust in 3 to 8 h; rehydrates moderately; amylase and protease | 3 fresh, 5 to 6 dried | beige crust |
| Avocado | 73 % water, 15 % fat, 7 % fibre; browns by enzymatic oxidation | thin tenacious film after drying; fat plus fibre | 5 | brown-green film |
| Mustard | mucilage, seed particles, turmeric in yellow mustard | swells and disperses; stain on plastics | 4 | yellow film |
| Lipstick on glass | waxes 15 to 25 %, oils 40 to 65 %, pigments 5 to 10 % | does not swell or melt at wash temperature; removal by surfactant roll-up near the wax softening point plus direct jet action | 8 | red or pink smear at the rim |
| Standard "ballast" soil | 50 g frozen block: vegetable oil 31.6 %, whole egg 15.8 %, cream 9.4 %, margarine, lard, frying fat, milk, ketchup and mustard 6.3 % each, potato starch 2.2 %, gravy 1.7 %, flour and quark powder 0.6 % each, benzoic acid 0.3 % [VERIFIED IKW Table 4] | represents easily removed meal residue that loads the wash liquor | - | - |

Composite rule: the continuous phase decides the mechanism. Oil-continuous soils (peanut butter, curry, chocolate, lipstick) are gated by temperature and surfactant; water-continuous pastes are Type 1 when fresh and take the class of their binder (starch, protein, pectin) when dried.

### 5.11 Difficulty ranking (summary)

| Rank | Soils |
|---|---|
| 10 | polymerised or carbonised fat, charred residues; carotenoid stain in polypropylene |
| 9 | baked cheese and lasagne crust; baked egg yolk; burnt milk; dried wheat-biscuit cereal |
| 8 | dried egg yolk; crème brûlée; lipstick; turmeric stain on plastic; dried porridge |
| 7 | starch mix; baked minced meat; melted cheese; burnt sugar; tea stain (bleach-dependent) |
| 6 | pasta, mashed potato, bread dough, milk skin, peanut butter, dried mayonnaise |
| 5 | rice, raw-dried egg white, dried yoghurt, hummus, avocado, tallow below 50 C, curry |
| 4 | gravy, dried ketchup, coffee stain, mustard, fresh mince |
| 3 | caramel, chocolate, lard, fresh yoghurt, red wine, spinach and seeds (detachment) |
| 1 to 2 | honey, syrup, jam, oils, butter, cold milk film, fresh sauces |

---

## 6. Measured cleaning kinetics inside dishwashers and representative rigs

### 6.1 Pérez-Mohedano: on-line imaging of egg-yolk tiles in a domestic dishwasher

Set-up **[VERIFIED]** (PM-T chapters 3, 7): Whirlpool DU750; a waterproof camera watches a CFT DM-22 egg-yolk tile (melamine, 120 x 100 mm, 1.75 g) held vertically at a fixed position; colour (CIELAB b* falls from about 70 to about 10) is converted to a stain removal index (SRI). The lower spray arm turned at 35 rpm (1.71 s per revolution). About 5 L of water is in circulation in the main wash. Swelling causes no colour change, so SRI tracks removal only.

Observations **[all VERIFIED]** (PM-T section 7.2):

- Three stages: no removal for about the first 5 min; a constant-rate stage (5 to 45 min in the reference case, 1.94 % SRI min^-1 for that run); a decay stage once SRI exceeds about 70 %.
- Removal was spatially homogeneous over the tile: no region cleaned faster under the jets. The authors conclude a diffusion-reaction mechanism (enzyme breaks the network, material washes out as water reaches the tile) with "a small effect of the external shear stress generated by the direct impact of water".
- Two exceptions, each seen once: a cleaning front spreading from one corner at the lowest enzyme level (attributed to local enzyme accumulation or a thin spot), and a vertical cleaned stripe along a jet track at pH 9.5.

Constant-stage cleaning rates (triplicates, mean and standard deviation) **[VERIFIED]** (PM-T Tables 7.1 to 7.3):

| Varied factor | Level | Other conditions | Rate (% SRI min^-1) | Std | Notes |
|---|---|---|---|---|---|
| Temperature | 30 C | pH 10.5, protease 0.06 g L^-1 | 0.85 | 0.12 | longer lag |
| Temperature | 55 C | same | 1.75 | 0.29 | complete at about 65 min |
| Protease | 0.02 g L^-1 | 55 C, pH 10.5 | 0.17 | 0.05 | hardly any removal |
| Protease | 0.06 g L^-1 | same | 1.75 | 0.29 | |
| Protease | 0.10 g L^-1 | same | 2.59 | 0.22 | complete at about 45 min |
| pH | 9.5 | 55 C, 0.06 g L^-1 | 0.69 | 0.16 | rate falls after 20 min, far from complete |
| pH | 10.5 | same | 1.75 | 0.29 | |
| pH | 11.5 | same | 4.66 | 0.38 | complete at about 25 min |

Derived sensitivities **[ESTIMATED from the table]**: apparent activation energy 24 kJ mol^-1 (factor 2.06 between 30 and 55 C); pH slope d ln(rate)/d pH = 0.96 (factor 2.6 per pH unit); enzyme response strongly non-linear, well described by rate proportional to 1.557 E^3 / (0.049^3 + E^3) with E in g L^-1 of the protease prill (gives 0.097, 1.00, 1.39 against measured 0.097, 1.00, 1.48). Note that "g L^-1" refers to a formulated protease granule supplied by Procter and Gamble, not to active enzyme protein.

### 6.2 The integrated dishwasher model and what it implies

Structure **[VERIFIED]** (PM-T section 7.3): (1) straight-line jet trajectories from the measured nozzle positions and angles give, for the tile, which jets hit it and for what fraction of each revolution; only 2 of the 10 lower-arm jets hit the tile, for 0.0013 s and 0.0272 s per revolution, i.e. frequency factors of 0.07 % and 1.59 %; (2) lag time, k_ss and k_ds from response surfaces fitted to the gauge data; (3) the swelling-removal model PM1 with f = 1.58 to 1.59 % and swelling profiles from the gauge.

Simulation inputs and outcome **[VERIFIED]** (PM-T Figs. 7.13 to 7.18, section 7.3.2; N = 5.5e26 m^-3 and Omega = 3e-29 m^3 in all cases):

| Case | D (m^2 s^-1) | chi | h_inf (mm) | t_lag (min) | k_ss (um min^-1) | k_ds (um min^-1) | Agreement with experiment |
|---|---|---|---|---|---|---|---|
| 30 C, pH 10.5, 0.06 g L^-1 | 3.0e-10 | 0.9 | 0.410 | 13.05 | 24.28 | 2.84 | good |
| 55 C, pH 10.5, 0.06 g L^-1 | 4.0e-10 | 0.8 | 0.703 | 3.14 | 69.42 | 9.63 | good to SRI 70 %, then the model misses the decay stage |
| 55 C, pH 10.5, 0.02 g L^-1 | 4.0e-10 | 0.8 | 0.703 | 8.45 | 31.06 | 7.82 | model far too fast (k_ds would need to be about 0.90) |
| 55 C, pH 10.5, 0.10 g L^-1 | 4.0e-10 | 0.8 | 0.703 | 0.41 | 95.66 | 12.19 | good to SRI 70 % |
| 55 C, pH 9.5, 0.06 g L^-1 | 2.5e-10 | 0.8 | 0.445 | 0.93 | 19.20 | 7.69 | model too fast (k_ds would need to be about 2.00) |
| 55 C, pH 11.5, 0.06 g L^-1 | 9.0e-10 | 0.0 | 0.822 | 5.92 | 154.65 | 22.93 | good |

The model agrees where the measured rate exceeds 1.00 % SRI min^-1 and over-predicts where it is below 0.75 **[VERIFIED]** (PM-T section 8.1). The authors attribute the over-prediction to enzyme delivery: in the gauge the tile is horizontal and immersed in slowly renewed solution; in the machine it is vertical, not immersed, and the liquid film is renewed quickly, so at low concentration fewer enzyme molecules bind **[VERIFIED]** (PM-T Table 7.7).

Split between dissolution and direct jet action **[ESTIMATED: my decomposition using k_mean = k_ds + f (k_ss - k_ds) with f = 0.0158 and rate = k_mean / h_inf]**:

| Case | Dissolution term (% min^-1) | Jet term (% min^-1) | Sum | Measured | Jet share |
|---|---|---|---|---|---|
| 30 C, pH 10.5, 0.06 | 0.69 | 0.08 | 0.78 | 0.85 | 11 % |
| 55 C, pH 10.5, 0.06 | 1.37 | 0.13 | 1.50 | 1.75 | 9 % |
| 55 C, pH 10.5, 0.10 | 1.73 | 0.19 | 1.92 | 2.59 | 10 % |
| 55 C, pH 11.5, 0.06 | 2.79 | 0.25 | 3.04 | 4.66 | 8 % |
| 55 C, pH 10.5, 0.02 | 1.11 | 0.05 | 1.16 | 0.17 | 4 % |
| 55 C, pH 9.5, 0.06 | 1.73 | 0.04 | 1.77 | 0.69 | 2 % |

So for enzyme-driven protein soil at a well-wetted location, roughly 90 % of the removal is chemistry acting under the draining film and about 10 % is direct jet action. In mass terms the reference rate (55 C, pH 10.5, mid enzyme) is 1.75 % of 137 g m^-2 per minute, i.e. about 4e-5 kg m^-2 s^-1 **[ESTIMATED from VERIFIED values]**.

### 6.3 Roldán-San Antonio et al.: two-pool kinetics from 217 dishwasher runs

Miele GSL200; CFT sprayed starch and minced-meat tiles on melamine (12 x 10 cm); eight cycles with main wash 17 to 69 min at 40 to 50 C, hot rinse 23 to 26 min at 55 to 65 C; defrosted ballast soil in every run; factors: pH, temperature, hardness, percarbonate, TAED, manganese catalyst, protease, amylase, chelant, builder, surfactant, polyacrylate **[VERIFIED]** (R24).

- Significant factors, carbohydrate tile: amylase (and its square), main-wash time, TAED (negative: bleach decomposes amylase, it does not bleach the soil), water hardness (negative).
- Significant factors, protein tile: protease, amylase, percarbonate, main-wash time, non-ionic surfactant (p = 0.044) and several interactions; bleach reduces the colour of this soil.
- Kinetic form: physical removal split into an "easy" and a "difficult" fraction, each first order towards its fraction, the easy one accelerated by a fitted factor mu; total SRI adds bleaching of the remaining colour **[VERIFIED]** (R24 eq. 2, 3):

      d(SRI_phys)/dt = mu * k_phys * (f_E - SRI_E) + k_phys * (f_D - SRI_D),     d(SRI_total)/dt = -d(m_colour)/dt

- 8 and 11 fitted parameters; validation R^2 = 0.93 (starch) and 0.89 (meat). Parameter values are not given in the paper.

Implication: a fast-then-slow removal curve (two pools) is what end-of-cycle data look like for both soil classes, and enzyme stability against bleach and temperature has to be carried by the chemistry model.

### 6.4 Test-programme conditions that define "normal" chemistry and time

IKW standard test programme: no pre-wash, main wash 45 C with an 8 min hold after reaching temperature, rinse 55 C; other programmes 40 C (hold 8/20/55 min), 50 C (3/8/55 min), 65 C intensive (10/30/55 min); water hardness 8 to 10 dH in the wash; detergent 20 g (compact, IEC type B or D) or 30 g (type A); 50 g ballast soil; six soiled items of each type; inlet water 15 or 20 C **[VERIFIED]** (IKW section 1.6, Tables 2, 3). With these conditions the soils of section 5 are deliberately not fully removed, so that detergents can be ranked: the test soils sit at the edge of what a cycle achieves. That is a useful calibration target: with a reference detergent the simulated IKW programme should leave partial residues on egg yolk, starch mix, minced meat and tea.

Two 2024 papers in Tenside Surfactants Detergents on programme design (snippet level only; I could not confirm the authors): in the eco programme chemistry is fixed by the reference detergent and mechanics by the hydraulic design, so time must compensate lower temperature; the second reports that short programmes with a commercial detergent clean normally soiled dishes in under 55 min, typically 30 to 40 min **[VERIFIED, snippet]** (TSD24-snip). I did not find a published quantitative "Sinner circle" for dishwashers beyond the Pérez-Mohedano sensitivities in section 6.1.

### 6.5 Hydrodynamic loads actually available

| Quantity | Value | Tag / source |
|---|---|---|
| Wall shear stress under draining (falling) films | 0 to 2 Pa | [VERIFIED] PM-T section 8.1.1 |
| Wall shear stress where manufacturers increase mechanical action (jet impingement) | 5 to 50 Pa | [VERIFIED] PM-T section 8.1.1 |
| Fraction of time a point is under direct jet impact | 0.07 to 1.6 % for the test tile; below 10 % in most configurations | [VERIFIED] PM-T sections 7.3.1.1, 8.1.1 |
| Interval between passes | 1.71 s at 35 rpm | [VERIFIED] PM-T |
| Number of jets | no more than 10 to 12 nozzles per spray arm | [VERIFIED] PM-T section 8.1.1 |
| Momentum flow per unit width at the jet footprint edge | 23 to 52 N m^-1 for dishwasher-like nozzles; 74 N m^-1 in the Cambridge rig | [ESTIMATED] section 1.4.4 |
| Momentum flow per unit width of a draining film | about 0.05 N m^-1 (0.5 m s^-1, 0.2 mm) | [ESTIMATED] |
| Shear needed to affect enzyme-weakened egg yolk | threshold near 10 Pa; no further gain from 12 to 65 Pa | [VERIFIED] PM-T; [VERIFIED snippet] Gordon-snip |
| Shear that strips swollen starch | 1 to 2 Pa for under 10 % solids; 50 Pa for about 20 % solids | [ESTIMATED] from J17, Go24 laws |

### 6.6 Relative importance of chemistry, temperature, time and mechanics (summary)

| Soil class | Chemistry-driven share | Role of film flow | Role of direct jets | Basis |
|---|---|---|---|---|
| Dried protein with protease (egg yolk) | about 90 % | delivers water, alkali, enzyme; carries products away; its shear (under 2 Pa) is below the 10 Pa threshold | about 10 % at a well-hit location; raises rate by stripping loosened material | section 6.2 |
| Swelling starch | swelling is physical; amylase needed for retrograded or baked starch | strips only fully swollen surface layers | strip partially swollen layers, exposing fresh surface: larger share than for protein | sections 1.5, 3.2 [ESTIMATED] |
| Film-forming soils that fail adhesively (dried ketchup, sauces, soaked albumin) | soak time to wet the interface | detaches once interface strength falls to about 1 Pa per unit of correction factor | peel well before the film can | sections 1.4, 1.5 |
| Baked and burnt soils | adhesion decay by alkali and surfactant over 5 to 30 min and longer | negligible mechanically | essential, but only after adhesion has decayed | sections 2.5, 4.3 |
| Fats | melting (temperature) then surfactant | drains melted fat to micrometres | displace solid fat only when soft (k' rises 500-fold from 20 to 60 C) | sections 3.4, 5.5 |
| Sugars and other solubles | none needed | sufficient | irrelevant | section 3.3 |
| Bleachable stains | about 100 % (oxidant, chelant, temperature) | delivers bleach | irrelevant | section 5.7 |
| Particles | binder hydration | moves un-pinned particles | dislodge and transport | section 5.8 |

---

## 7. Proposed unified soil-state model

The model is a per-surface-element boundary model in the BCCM sense, extended with (i) the Pérez-Mohedano reaction-erosion terms and lag, (ii) the Cambridge momentum-driven peel term for jet events, (iii) fat melting and viscous shifting, (iv) soluble and stain kinetics, and (v) an explicit water-supply limit. The section "Recommended model and defaults" states which parts I would implement first.

### 7.1 Assumptions

1. Soil thickness (10 to 1000 um) is small compared with item and flow scales; the soil does not alter the flow (one-way coupling). Exceptions to flag at load time: deposits thicker than about 1 mm (treated with more cells) and loose particles.
2. Transport inside the soil is one-dimensional, normal to the wall.
3. Soil timescales (swelling 10^2 to 10^4 s, reaction lags 10^2 to 10^3 s, adhesion decay 10^2 to 10^3 s) are much longer than the spray-arm period (about 1.7 s), so periodic forcing may be supplied as statistics over a homogenisation window, provided that thresholded terms see the event peak values and frequencies and not window means.
4. Each element carries one soil class; composite meals are represented by choosing the class of the continuous phase, plus optional fat-film and particle sub-states.

### 7.2 State variables per surface element

| Variable | Meaning | Unit | Notes |
|---|---|---|---|
| k | soil class index | - | fixed |
| c | area fraction of the element still covered | - | 1 at start; reduced by detachment and peeling |
| m_j, j = 1..N_z | dry mass of cell j per unit covered area (cell 1 at the wall) | kg m^-2 | constant until the cell is removed |
| w_j | water mass in cell j | kg m^-2 | initial value from the drying model |
| X_j | structural integrity of cell j (1 = intact, 0 = fully hydrolysed) | - | optional for classes without reaction |
| X_ad | integrity of the soil/substrate bond | - | |
| E_r | accumulated reaction-erosion depth not yet converted into removed cells | m | Pérez-Mohedano "carry-over" |
| t_wet | cumulative time the element has been wetted | s | drives lags |
| T_s | soil temperature | K | taken equal to the item surface temperature |
| h_o | thickness of liquid fat on the element | m | fat-bearing classes |
| S | remaining chromophore (stain) fraction | - | stain classes |
| n_p | particles still attached | m^-2 | particulate classes |
| B | bake index (fixed at load): 0 fresh-dried to 1 fully cross-linked | - | modifies parameters |

Derived per cell: thickness h_j = m_j/rho_d + w_j/rho_w; water concentration beta_j = w_j/h_j; solids volume fraction phi_j = (m_j/rho_d)/h_j; stretch lambda_j = h_j rho_d/m_j.

### 7.3 Inputs required from the other sub-models (per element, per window)

| From | Quantity |
|---|---|
| films | wetted fraction of the window f_wet; film thickness h_f; mean film wall shear tau_f; film momentum flow per unit width M_f; water delivery rate available to the soil J_sup (kg m^-2 s^-1); liquid temperature |
| jets | number of direct-impingement events in the window n_ev; for each event class: peak wall shear tau_j, momentum flow per unit width M_j at the element, dwell time t_e |
| chemistry | pH; activity of protease, amylase, lipase in the liquor; available oxidant; surfactant factor; hardness; suspended soil and particle load |
| items | substrate material and roughness; surface temperature T_s(t); orientation (for drainage of fats) |

### 7.4 Initial state (the ageing transform)

Given soil class, wet loading m_wet, solids fraction x_s, air-drying time t_d, room temperature and humidity, and heat history:

    m_d,total = x_s * m_wet
    water remaining: w(t_d) = max( w_eq , (1 - x_s) m_wet - j_evap * t_d ),   j_evap ~ 9e-6 kg m^-2 s^-1 at 22 C / 50 % RH
    w_eq = m_d,total * omega_0/(1 - omega_0),  omega_0 = class equilibrium moisture (0.14 starch, 0.063 egg yolk)
    for deposits thicker than about 0.5 mm, apply the evaporation to the top cell and let E2 below redistribute (skin formation)
    B from heat history: B = 1 - exp( - SUM_i k_B(T_i) t_i ),   k_B(T) = k_B,ref exp( -(E_B/R)(1/T - 1/T_ref) )

B scales parameters: beta_max and D_w down, tau_c0, tau_a0 and F_a0 up, enzyme accessibility down (multipliers in section 8). The drying part needs no extra strength parameter because strength follows water content.

### 7.5 Evolution equations

**E1. Temperature.** T_s = item surface temperature (soil thermal time h^2/alpha is about 1 s for 0.3 mm). All rate constants use Arrhenius factors a_T = exp(-(E_a/R)(1/T_s - 1/T_ref)).

**E2. Hydration (all swelling classes).** On the Lagrangian cell stack:

    d(w_j)/dt = J_(j+1/2) - J_(j-1/2)
    J_(j+1/2) = D_w(beta_face) * (beta_(j+1) - beta_j) / ( (h_j + h_(j+1)) / 2 )
    D_w(beta) = D_w0 * exp(alpha_w * beta) * a_T * a_pH(pH) * a_B(B)        (or D_w0 * beta^alpha_w for the ketchup form)
    wall:  J_(1/2) = 0
    top, element wetted:   J_top = min( D_w * (beta_max(T, pH, B) - beta_N) / (h_N / 2) ,  J_sup )
    top, element not wetted:  J_top = -j_evap(T_s, humidity in the tub)   (about zero in a closed, wet tub)

Integrate with backward Euler (one tridiagonal solve per element per step) so that a 1 s step is stable. Cells keep their dry mass; thickness is recomputed from the water content. For protein gels the same scheme is used with beta_max = rho_w (1 - 1/lambda_inf) from S9 and D_w calibrated to S8 (section 8).

**E3. Chemical weakening.**

    enzyme surface activity (quasi-steady adsorption):  theta_E = c_E^n / (K_E^n + c_E^n)   while wetted
    reaction-erosion velocity of the swollen surface (Pérez-Mohedano "soil dissolution"):
        u_r = k_ds,ref * a_T * exp( s_pH (pH - pH_ref) ) * theta_E/theta_E,ref * a_B * g(t_wet)
        g = 0 for t_wet < t_lag;  (t_wet - t_lag)/(0.5 t_lag) up to 1;  1 afterwards
    alkaline hydrolysis without enzyme (only significant at pH >= 11.5 and T >= 42 C for egg yolk):
        u_OH = k_OH,ref * a_T * 10^(pH - 11.5) * g
    bond to the substrate:   d(X_ad)/dt = -k_ad * a_T * a_surf * a_pH * H( beta_1 - beta_ad )
        (zeroth order while X_ad > X_M, first order below; H is the step function: the bond only decays once water has reached the wall)

**E4. Strengths from state.**

    cohesion at the interface between cells j-1 and j:   tau_coh = tau_c0 * exp( -b_c * beta_face ) * a_fat(T_s) * a_B
    adhesion at the wall:                                tau_ad  = tau_a0 * exp( -b_a * beta_1 ) * X_ad * s_sub
    peel resistance:                                     F_ad = F_a0 * X_ad * s_sub * a_fat(T_s),     M_Y = F_ad / eta_M
    peel mobility:                                       k' = min( k'_max , k'_ref * (tau_ref / tau_coh,top)^1.8 )
    fat phase:  a_fat(T_s) = SFC(T_s)/SFC(20 C) for fat-continuous soils; yield stress tau_y,fat = tau_y,20 * exp( B_f (1/T_s - 1/293.15) )

**E5. Loads seen in a window of length dt.** Continuous: tau_f, M_f while wetted. Events: n_ev impingement events with (tau_j, M_j, t_e). The jet duty factor is f_j = n_ev t_e / dt.

**E6. Removal (apply in this order each step).**

    (a) Solubles:  dm = min( m_N , k_L * (c_sat - c_bulk) * f_wet * dt )   from the top cell (class SOL and the soluble fraction of others)
    (b) Reaction-erosion:  E_r += [ u_r + u_OH + f_j * (u_s - u_r) * H(tau_j - tau_star) ] * f_wet * dt
           u_s = k_ss,ref scaled like u_r; tau_star ~ 10 Pa
           while E_r > h_N: delete the top cell, E_r -= h_N           (Pérez-Mohedano bookkeeping)
    (c) Cohesive separation:  tau_load = max( tau_f , tau_j if n_ev > 0 )
           find the cell interface nearest the wall with tau_coh < C_coh * tau_load; delete all cells above it
    (d) Adhesive detachment:  if tau_ad < C_ad * tau_load, the covered fraction falls: c <- c * (1 - p_det),
           p_det = 1 for a single-patch element, or the fraction of the element under the event footprint
    (e) Peeling from exposed edges:  d(c)/dt = -(L_edge / A_e) * k' * [ f_j (M_j - M_Y)+ + (1 - f_j) f_wet (M_f - M_Y)+ ]
           L_edge = length of soil edge in the element (element sides adjoining clean neighbours, plus crack length)
    (f) Viscous shifting (liquid fat, pastes above yield):  V1 on the surface mesh; mass leaving at item edges or drip points goes to the liquor
           emulsification sink for the last film:  d(h_o)/dt = -k_em * a_surf * a_T * f_wet * h_o
    (g) Stains:  d(S)/dt = -k_ox * a_T * c_ox * f_wet * S ;   uptake into plastics before the wash is an initial condition
    (h) Particles:  detach when the binder film under them is removed by (b) to (d) or when 8 tau_load d^2 exceeds the binder force; hand over to transport

Decay stage: because c and the per-element loading are distributed (section 7.7), the area-integrated rate falls naturally at the end; if a single-cell (lumped) element is used, multiply the removal rate by min(1, m_d/(0.3 m_d0)) to reproduce the observed decay above 70 % removal **[VERIFIED onset]** (PM-T).

**E7. Hand-offs.** Removed dry mass by class goes to the wash liquor (soil load, enzyme and bleach consumption, foaming: "chemistry"); particles to the redeposition model; water taken up by the soil can be debited from the film where films are thin.

**E8. Output at the end of the cycle.** Per element: remaining dry mass c * SUM m_j, fat film h_o, stain S, attached and redeposited particles; these feed the per-item cleanliness score ("standards" and "benchmark" siblings). Suggested visibility thresholds are in "Recommended model and defaults", item R7 (they are calibration parameters).

### 7.6 Substrate factor s_sub

Multiplier on tau_a0 and F_a0 (and 1/s_sub on the roll-up rate of oils) **[all ESTIMATED; anchored only on the facts that petroleum jelly peels about 20 times faster from glass than from Perspex (different jellies; G16), that roughness raises tomato-paste adhesion (Liu-snip), that PVA undercuts and blisters on glass (W14), and that cake residue scales with the oil's work of adhesion in water (M17)]**:

| Substrate | Swelling polymer soils (protein, starch, sauces) | Oils and fats (roll-up resistance) |
|---|---|---|
| Soda-lime glass, glazed porcelain (hydrophilic, smooth) | 1.0 | 1.0 |
| Stainless steel 2B / cutlery finish | 1.0 to 1.3 | 1.0 to 1.5 |
| Aluminium, enamel with wear | 1.2 to 1.5 | 1.5 |
| PTFE and similar non-stick | 0.3 to 0.6 | 1.5 to 3 |
| Polypropylene, polyethylene | 1.0 to 1.5 | 2 to 5; also dye uptake |
| Melamine, SAN, copolyester | 1.0 to 1.3 | 1.5 to 3 |
| Roughened or scratched surfaces (any) | multiply by 1.2 to 2 | multiply by 1.2 to 2 |

### 7.7 Sub-element heterogeneity

- Loading within a nominally uniform soiled area: normal distribution with a standard deviation of about 10 % of the mean (5 g m^-2 at 50 g m^-2) is needed to reproduce measured cleaning curves **[VERIFIED]** (Go23). Real smears are far less uniform; use a log-normal multiplier with coefficient of variation 0.3 to 0.5 per element **[ESTIMATED]**.
- Baked layers are cracked on a millimetre scale; cracks close on swelling and provide both water access and peel edges **[VERIFIED]** (C22). Represent by an edge-length density L_edge/A_e of 500 to 2000 m^-1 (1 to 4 mm polygons) **[ESTIMATED]**.
- Thick ridges at the edges of dried pools (coffee-ring effect) and in corners: add a rim element class with 3 to 10 times the mean loading **[ESTIMATED]**.

### 7.8 Numerical notes and cost

- Cells: 8 to 16 per element are enough (fewer than 10 under-predicts, more than 20 gives no benefit **[VERIFIED]** PM-T); use a geometric grading with thin cells at the top.
- Time step: 1 s with implicit diffusion; all removal rules are explicit. The thesis's explicit scheme needed 3 ms steps for 50 layers **[VERIFIED]**; do not copy that.
- Cost **[ESTIMATED]**: 10^6 elements x 12 cells x 4000 steps is about 5e10 cell updates per cycle, a few tens of seconds on the GPU. The soil model is cheap; the budget should go to producing trustworthy per-element wetting, shear and jet-event statistics.
- Thin films (dry thickness under about 20 um: milk film, tea, drained sauces) can use a single cell: their diffusion time h^2/D is a few seconds.

### 7.9 Which terms are active for which class

| Class | E2 swelling | (a) dissolution | (b) reaction-erosion | (c) cohesive | (d,e) adhesive / peel | (f) viscous | (g) stain |
|---|---|---|---|---|---|---|---|
| SOL: sugars, salts, fresh drinks | no | yes | no | no | no | syrups: yes | no |
| SWP: dried and cooked proteins | yes | minor | yes (protease, alkali) | weak (threshold near 10 Pa after weakening) | last layer | no | colour optional |
| SWS: starches | yes | yes (pregelatinised) | yes (amylase) | yes | last layer | swollen surface: yes | no |
| PEEL: dried sauces, ketchup, pectin and gum films | yes | partly | no | minor | yes | fresh paste: yes | optional |
| FAT: fats, oils, wax | no | no | lipase optional | no | solid fat: peel with J8, J9 | yes above melting | no |
| BURN: baked, Maillard, polymerised | small | no | slow | no | yes, after X_ad decays | no | no |
| STAIN: tea, coffee, wine, dyes in plastics | no | no | no | no | no | no | yes |
| PART: particles and fibres | binder: yes | binder | binder | binder | binder | no | no |

---

## 8. Parameter tables per soil class

Confidence column: **H** = measured on that soil and read in a primary source this session; **M** = measured on a close analogue or derived from measured values; **L** = my estimate, to be calibrated. Every number in an L row is **[ESTIMATED]**; numbers in H rows are **[VERIFIED]** from the source named; M rows mix the two as stated. Reference conditions for rate constants: T_ref = 323.15 K (50 C), pH_ref = 10.5, reference enzyme dose = the mid level of PM-T (0.06 g L^-1 protease prill) or its amylase equivalent, continuous film coverage.

### 8.1 Loading, moisture and swelling

| Soil | Class | Default wet loading (g m^-2) and solids fraction | Air-dry moisture omega_0 | Dry density (kg m^-3) | Swelling capacity at reference | Water transport | E_a swelling (kJ mol^-1) | Conf. | Source |
|---|---|---|---|---|---|---|---|---|---|
| Egg yolk, dried | SWP | 150 (100 to 600); 0.50; test 54 g m^-2 dry | 0.063 | 1100 (see flag in 2.2) | lambda_inf from S9: 10.7 at 50 C, pH 10.5; 6 to 7 at pH 9.5; 2 to 4 in water | S2, S3 with D_NL from S7, chi 0.8 to 0.9, N 5.5e26 m^-3, lambda_0 1.1; or S1 with D_L = 1.1e-12 m^2 s^-1 | 16 (D_NL), 8 (D_L) | H (M for water) | PM-T |
| Egg yolk, cooked or baked | SWP + B | as above | 0.05 | 1100 | lambda_inf x 0.3 to 0.6 | D x 0.3 to 0.6 | 16 | L | Gordon-snip (direction only) |
| Egg white, dried or cooked | SWP | 150; 0.12 | 0.08 | 1300 | lambda_inf 8 to 15 | D_OH = 6e-11 to 1.1e-10 m^2 s^-1 for the alkali front (whey-protein analogue); D_L 1e-12 | 15 to 20 | L to M | Go24 (analogue) |
| Milk film, cold-dried | SOL | 30; 0.125 | 0.05 | 1300 | redisperses | single cell; X1 with D = 1e-10 m^2 s^-1 for protein | 20 | L | - |
| Burnt or microwaved milk | BURN/SWP | 100 to 300 dry-equivalent film 20 to 100 um | 0.05 | 1300 | thickness ratio 1.5 to 3 at pH 10.5 | D_OH as above; no swelling until OH- arrives | 20 | L to M | Go24, PM-T (qualitative) |
| Melted cheese | SWP + FAT | 800 (300 to 2000); 0.60 | 0.30 | 1100 | thickness ratio 1.5 to 2.5 | D_w0 1e-11, alpha_w 3e-3 | 30 | L | - |
| Minced meat, baked | SWP + FAT + PART | 120; 0.40 (test 118 g m^-2 wet) | 0.08 | 1200 | thickness ratio 2 to 4 | D_w0 1e-11, alpha_w 3e-3 | 25 | L (loading H) | IKW |
| Starch, pregelatinised waxy maize, air-dried | SWS | 50 dry (30 to 80) | 0.138 | 1056.6 | beta_max = 918 kg m^-3 (omega_max 0.91; thickness ratio 10.7) | D_w = 2.5e-11 exp(3.53e-3 beta) m^2 s^-1 | 20 (est.) | H | Go23, Go24 |
| Starch mix, pasta, rice film (cooked, dried, retrograded) | SWS | 37.5 dry (test); 20 to 100 | 0.12 | 1450 | beta_max 750 to 850 (thickness ratio 3 to 6) | D_w = 1e-11 exp(3.5e-3 beta) | 25 | L (loading H) | IKW (loading) |
| Mashed potato | SWS + FAT | 1500; 0.22 | 0.12 | 1300 | beta_max 850 | D_w = 1.5e-11 exp(3.5e-3 beta) | 25 | L | - |
| Porridge, wheat-biscuit cereal | SWS + PART | 600 (300 to 2000); 0.16 to 0.30 | 0.12 | 1350 | beta_max 700 to 800 | D_w = 3e-12 exp(3.5e-3 beta); 20 to 40 % of solids are bran particles | 25 | L | - |
| Dried ketchup, tomato sauce | PEEL | 278 dry (test); 50 to 300 | 0.15 | 1300 | beta_max 720 to 780 (about one third of the starch thickness ratio) | D_w = 2.2e-13 * beta^1.36 | 20 | H (beta_max M) | Go24, Go23 |
| Baked complex soil (lasagne or gratin crust) | BURN | 280 dry; 270 to 300 um | 0.05 | 1000 | thickness +30 to +65 %: beta_max 230 to 400 | first order: k_delta = 3.3e-3 s^-1 at 50 C (0.9e-3 at 20 C) | 34 | H | C22 |
| Polymerised fat, char | BURN | 20 to 300 | 0 | 950 | none | none | - | M | A15 |
| Fats and oils | FAT | butter 10, tin 150 | - | 900 | none | none | - | M | section 5.5 |
| Sugars, honey, jam | SOL | 100; 0.65 to 0.82 | 0.05 to 0.18 | 1500 | dissolves | X1, X2; D = 5e-10 m^2 s^-1; c_sat 880 kg m^-3 | 20 | L (physics standard) | section 3.3 |
| Tea, coffee, wine film | STAIN | < 1 dry | - | - | none | none | - | L | IKW (recipe only) |

### 8.2 Strength, adhesion and peeling

| Soil | Cohesion law tau_coh = tau_c0 exp(-b_c beta) | C_coh | Adhesion law tau_ad = tau_a0 exp(-b_a beta_1) X_ad | C_ad | Peel resistance F_a0 (N m^-1) and decay | Peel mobility k' (m s kg^-1) | Conf. | Source |
|---|---|---|---|---|---|---|---|---|
| Starch, pregelatinised | tau_c0 = 5.0e8 Pa, b_c = 0.021 m^3 kg^-1 (equivalently tau_0 = 73476 phi^4.594 Pa) | 0.67 | not measured; use 2 x tau_coh | 1 | - | - | H (adhesion L) | Go24, J17 |
| Starch, cooked native, dried | same law with beta_max 750 to 850 (minimum strength 9 to 70 Pa: not removable by films without amylase) | 0.67 | 2 x tau_coh | 1 | 10 to 30, decaying with X_ad | 1e-4 to 1e-3 after soaking | L | - |
| Dried ketchup | cohesion above adhesion (fails adhesively) | - | tau_a0 = 8.11e5 Pa, b_a = 0.016 m^3 kg^-1 | 14.2 | 7 to 20 dry-ish, about 2 after 30 min soak (tomato paste) | 2e-3 (xanthan analogue) | H / M | Go24; Z19 (tomato) |
| Egg yolk, dried film | after enzyme weakening: threshold tau_star = 10 Pa, no gain from 12 to 65 Pa | - | stronger than cohesion at all times | - | thin film 20 to 60 (est.); thick baked 1.3 mm deposit: 190 falling to 104 with hot alkali | 1e-4 (PVA analogue) | M | PM-T, Gordon-snip, Z19 |
| Egg albumin | - | - | falls to 0.95 J m^-2 (20 C, 60 min) and 0.02 to 0.24 (50 to 70 C) | - | 5 to 10 initially (est.) | 1e-3 | M | Z19 (second-hand) |
| Whey protein / heated milk | cohesive failure; 0 to 10 J m^-2 | - | above cohesion | - | 10 falling at 0.1 / 0.3 / 1.2 J m^-2 min^-1 at 20 / 50 / 70 C | 1e-4 | M | Z19 (second-hand) |
| Baked complex soil | cohesive at first | - | adhesion-limited after t_M | - | F_a0 100 to 300; falls at 0.26 to 0.51 N m^-1 s^-1 at 50 C (0.06 to 0.15 at 20 C) until t_M = 220 s, then exponential with time constant 120 to 140 s; with cationic surfactant t_M = 40 s; E_a 56 kJ mol^-1 | 1e-4 | H (F_a0 M) | C22 |
| Polymerised lard | cohesion above adhesion once polymerised | - | - | - | 220; decay time constant of order 1e4 s at pH 10.5 (est.) | 1e-5 | H (decay L) | A15 |
| Solid fat (lard, butter, tallow below melting) | yield stress 1 to 5 kPa at 20 C (lard G' 15 kPa); scale with SFC | - | - | - | 115 (lard, 20 C, thick layer); M_Y from J6 | k' = 6.7e-6 * (130 Pa / tau_c)^1.8, capped at 3e-2 | M | A15, W14, B17 |
| Petroleum-jelly-like reference | tau_c from J8 | - | - | - | M_Y = tau_y delta/(tan chi - sin chi), chi 7 to 25 degrees | 6.7e-6 at 20 C to 3.3e-3 at 60 C | H | W14, G16 |
| Dried polymer film (PVA, xanthan) reference | - | - | - | - | zero threshold in the fits | 1e-4 to 2e-3; soak delay proportional to thickness | H | W14, G16, B17 |

The correction factors C_coh and C_ad absorb the difference between how a blade and a flow load the soil. In Go23 the factor depended on Reynolds number (C = C_0 Re^-0.88); in Go24 constants were used. Treat them as calibration parameters (expected range 0.1 to 20).

### 8.3 Reaction, dissolution and stain kinetics

| Soil | Active agent | Lag t_lag at reference (min) | Reaction-erosion rate at reference | Jet-assisted rate (while tau_j > tau_star) | E_a (kJ mol^-1) | pH sensitivity s_pH (per pH unit) | Agent dependence | Conf. | Source |
|---|---|---|---|---|---|---|---|---|---|
| Egg yolk, dried | protease (plus OH- above pH 11) | 9 (3 at 55 C, 13 at 30 C; scatter 0.4 to 33) | k_ds = 6 um min^-1 of swollen thickness (5.5 to 10); mass flux 3e-5 (2e-5 to 4e-5) kg m^-2 s^-1 | k_ss = 25 um min^-1 (15 to 30); about 4 x k_ds | 24 (range 5 to 40) | 0.96 | Hill: n = 3, K_E = 0.049 g L^-1 prill | H (lag M) | PM-T |
| Egg yolk, baked | same | x 2 | x 0.3 | x 0.3 | 24 | 0.96 | same | L | Gordon-snip (direction) |
| Egg white, cooked | protease, alkali | 5 | 4e-5 kg m^-2 s^-1 | x 3 | 25 | 1.0 | Hill as yolk | L | - |
| Burnt milk | alkali, protease | 10 | 5e-6 kg m^-2 s^-1 | x 3 | 30 | 1.5 (steep near pH 11 to 12) | Hill | L | PM-T (qualitative) |
| Melted cheese | protease, chelant, heat | 5 | 1e-5 kg m^-2 s^-1 | x 3 | 30 | 0.8 | Hill | L | - |
| Minced meat, baked | protease (amylase and bleach secondary) | 5 | 1.5e-5 kg m^-2 s^-1 | x 3 | 25 | 0.8 | Hill | L | IKW, R24 (factors only) |
| Starch, pregelatinised, water only | none needed | 0.1 to 0.3 (t_r 7 to 19 s) | cohesive erosion: about 2e-4 kg m^-2 s^-1 at 4 Pa, proportional to shear | included | 20 | 0 | - | M | Go23, J17 |
| Starch mix, pasta | amylase | 5 | 2e-5 kg m^-2 s^-1 (x 0.1 without amylase) | x 3 | 25 | 0.3 | Hill, K_E at mid dose; bleach deactivates amylase; hardness slows | L | IKW, R24 (factors only) |
| Porridge, wheat-biscuit cereal | amylase, protease | 10 | 8e-6 kg m^-2 s^-1 | x 3 | 25 | 0.3 | as starch | L | - |
| Baked complex soil | alkali, surfactant (adhesion decay, table 8.2); enzymes minor | t_M about 4 | leaching 35 mg per g in 3000 s at 50 C (23 at 20 C) | peel once M_Y < M_j | 56 (adhesion), 44 (oil release) | weak and non-monotonic | cationic and non-ionic surfactants shorten t_M | H | C22 |
| Fats above melting | surfactant, alkali, lipase | 0 | drainage V2, V3; emulsification of the residual film k_em = 0.01 s^-1 (0.002 to 0.05) | jets displace | 30 | 0.3 | proportional to surfactant factor | L | section 3.4 |
| Sugars | water | 0 | X1 with X2 or X3; of order 1e-2 kg m^-2 s^-1 | - | 20 | 0 | - | M | section 3.3 |
| Tea stain | oxidant (peracid), chelant | 2 | first-order decolourisation k_ox = 2.3e-3 s^-1 at reference bleach (half-life 5 min; range 2 to 20 min); zero without bleach | none | 50 | 0.5 | proportional to available oxidant; slower in hard water | L | Tea-snip (direction only) |
| Coffee, wine stains | oxidant, alkali | 1 | k_ox = 5e-3 s^-1 | none | 50 | 0.5 | as tea | L | - |
| Carotenoid or curcumin in polypropylene | oxidant, light | - | k_ox = 1e-5 s^-1 (effectively permanent within a cycle) | none | 60 | 0 | - | L | - |

Bake-index multipliers **[ESTIMATED placeholders]**: k_B,ref = 3e-5 s^-1 at 80 C with E_B = 43 kJ mol^-1 (gives B of about 0.2 after 2 h at 80 C, 0.8 after 2 h at 135 C, 0.45 after 7 min at 204 C, 0.1 after 20 h at room temperature). At bake index B: swelling capacity (thickness ratio minus one) x (1 - 0.9 B); D_w x (1 - 0.7 B); F_a0 x (1 + 7 B); reaction-erosion x (1 - 0.8 B).

### 8.4 Reduced ("tier-0") kinetics for quick previews and for thin soils

For a lumped element with dry loading m_d0:

    d(m_d)/dt = - f_wet * g(t_wet) * [ J_r + f_j * (J_s - J_r) ] * min( 1, m_d / (0.3 m_d0) )
    J_r = J_r,ref * a_T * exp( s_pH (pH - 10.5) ) * theta_E / theta_E,ref * a_B ,    J_s = (k_ss/k_ds) * J_r

with J_r,ref, t_lag, E_a, s_pH from table 8.3. For egg yolk this reproduces four of the six in-machine cases of section 6.2 within about 35 % and inherits the over-prediction at low enzyme and low pH unless the Hill enzyme term and the measured pH slope are used (they are fitted to the in-machine data and remove that error by construction) **[ESTIMATED]**.

---

## 9. Evidence on the architecture candidates

**(a) Hybrid multi-scale with a per-surface-element soil model.**

For:

1. Direct precedent. The Dresden boundary-condition cleaning models decouple flow and soil exactly as (a) proposes and reproduce measured cleaning times for starch (cohesive), ketchup (adhesive) and chocolate (viscous) soils; they cut computing time by about three orders of magnitude relative to a resolved two-phase simulation (one hour on one core against two weeks on eight cores for a small channel on a coarse grid) **[VERIFIED]** (J17, Go23, Go24).
2. In-machine precedent. Pérez-Mohedano's integrated dishwasher model (geometric jet tracing, a frequency factor per surface, a per-tile swelling and removal model) reproduced four of six measured in-machine cleaning curves; the two failures were attributed to enzyme delivery, not to hydrodynamics **[VERIFIED]** (PM-T chapter 7).
3. Scale separation. Soil processes take 10^2 to 10^4 s; the arm period is about 1.7 s; the direct-jet duty at a point is about 1 % **[VERIFIED]** (PM-T). The removal laws need wall shear, film momentum per unit width at a front, and water content at the wall, on scales of 10 to 1000 um that a tub-scale particle or grid method cannot resolve.
4. What dominates. For enzyme-driven protein soil about 90 % of removal happens under the draining film (section 6.2). The first-order questions are therefore "is this element wetted, for how long, at what temperature and chemistry", which is what the film sub-model of (a) delivers.

Against, or conditions on (a):

1. Thresholds and intermittency. The sheared removal rate depends non-linearly on how long the surface rested between hits (PM-T section 6.4.3.3), and cohesive, adhesive and peel rules are thresholded. Time-homogenised forcing must therefore carry event peak values and frequencies; window means of shear would be wrong.
2. One-way coupling breaks for thick deposits (jets burrow and blister, FW20; displaced soil forms a berm that deflects the film and causes splatter, G16) and for loose particles.
3. Enzyme and bleach delivery to vertical, non-immersed surfaces is supply-limited at low dose (PM-T Table 7.7): the film model must provide a liquid-side mass-transfer or adsorption term, not just "wetted".
4. Water supply: full swelling needs 0.3 to 0.8 kg m^-2 of water (section 2.3), more than a thin film holds; the film model must report delivery rate.

**(b) Fully resolved 3-D free-surface simulation of the tub for a few arm revolutions.**

For: it yields the wetting map (shadowing, splash, drip paths, pooling), which is the single most important input to every soil class; unwetted soil is uncleaned soil.

Against: it cannot reach the soil or film scales; the BCCM authors found even a coarse resolved soil layer prohibitively expensive (J17); a few revolutions cover seconds, whereas soils integrate over the whole 30 to 120 min cycle; and the soil response is insensitive to the precise jet shear magnitude (no effect from 12 to 65 Pa, PM-T) but very sensitive to wetting on/off, temperature and chemistry.

**(c) Mixture (recommended from the soils point of view).** Use (a) as the backbone for the whole cycle. Use (b)-type resolved runs, if affordable, only to generate or validate per-element exposure statistics (wetted fraction, event frequency and peak load distributions, splash and drip delivery) for each distinct hydraulic phase, then reuse those statistics while the soil model integrates the cycle. Nothing in the soil literature requires resolved fluid dynamics at the soil scale; everything requires trustworthy wetting and delivery statistics.

---

## 10. Gaps and open questions

1. Substrates. Almost all force and kinetics data are on stainless steel, Perspex or float glass. I found nothing quantitative for glazed ceramic or for polypropylene and other tableware plastics.
2. Drying time. No published curve of in-machine removal against air-drying time (0 to 24 h) was found; the model derives it from moisture-dependent strength, which is untested for most soils.
3. Egg-yolk tile thickness inconsistency (section 2.2): thickness-based rates may be off by a factor of about two; mass-based rates are safe.
4. Lag time: scatter from 0.4 to 33 min with a poorly fitting response surface; mechanistically it is probably the time for alkali and enzyme to weaken the top layer plus the time to swell, but no source separates them.
5. Activation energy of enzyme-driven removal: 5, 24 or 40 kJ mol^-1 depending on which numbers of the same thesis are used.
6. Starch with amylase: no rate data found (only that amylase and time dominate). Retrograded and baked starch parameters are estimates.
7. Wheat-biscuit cereal, porridge, cheese, meat, peanut butter, lipstick: no cleaning-science data found; all parameters are estimates by analogy.
8. Tea and other stains: no kinetic constants found; carotenoid uptake into plastics unquantified.
9. Particles: detachment and re-attachment forces are estimates from first principles.
10. Peel bridge M_Y = F_ad/eta_M (section 4.3) and the use of k' values measured at traverse speeds 20 to 100 times lower than a spray arm's are untested extrapolations.
11. Fatigue under repeated short loading (creep-like "lift-up" was seen under repeated suction at pH 11.5, PM-T) is not modelled.
12. Interaction between soils on one item (fat over starch, sauce over cheese) is represented only by choosing a continuous phase.
13. I could not read Fryer and Asteriadou (2009), Liu et al. (2002 to 2007), Gordon et al. (2012), Wilson et al. (2015), Wang et al. (2015), Chee et al. (2019), Yang et al. (2019), Köhler et al. (2021), Xin et al. (2004) or Cuckston et al. (2019) directly.

---

## Recommended model and defaults

This is exactly what I would implement, in order.

### R1. Data model

One record per soiled surface element: class index, covered fraction c, a stack of N_z cells (dry mass, water mass), bond integrity X_ad, reaction-erosion carry-over E_r, cumulative wet time t_wet, and the optional sub-states of section 7.2 (liquid-fat film, stain fraction, attached particles, bake index). Elements whose dry soil thickness is under 20 um use one cell; all others use 12 cells graded geometrically (ratio 1.3) with the thinnest at the free surface.

### R2. Per-step algorithm (soil step 1 s; forcing supplied per arm revolution or per 2 s window)

    for each soiled element (in parallel on the GPU):
        read f_wet, tau_f, M_f, J_sup, n_ev, tau_j, M_j, t_e, T_s, pH, enzyme activities, oxidant, surfactant factor
        t_wet += f_wet * dt
        1. hydration: backward-Euler solve of E2 on the cell stack, top flux limited by J_sup; recompute h_j, beta_j
        2. weakening: update u_r, u_OH (with lag function g), X_ad (only if beta_1 > beta_ad), stain rate
        3. strengths: tau_coh at cell interfaces, tau_ad, F_ad, M_Y, k'
        4. removal, in order: (a) solubles, (b) reaction-erosion with jet assistance above tau_star, (c) cohesive rule,
           (d) adhesive detachment, (e) edge peeling, (f) fat melting, viscous shifting and emulsification, (g) stains, (h) particles
        5. hand over removed mass, particles and water uptake; store the new state

At the end of the cycle report per element: residual dry mass, residual fat film, stain fraction, attached and redeposited particles.

### R3. Global defaults

| Constant | Default | Basis |
|---|---|---|
| Reference temperature and pH for rate constants | 323.15 K, pH 10.5 | choice |
| Cells per element | 12 (1 for thin films) | [VERIFIED guidance] PM-T: fewer than 10 too coarse, more than 20 unnecessary |
| Soil time step | 1 s, implicit diffusion | [ESTIMATED] |
| Shear threshold for jet-assisted erosion of enzyme-weakened protein, tau_star | 10 Pa | [VERIFIED] PM-T, Gordon-snip |
| Ratio jet-assisted to dissolution erosion, k_ss/k_ds | 4 | [VERIFIED range 1.5 to 7] PM-T Table 7.6 |
| Onset of decay stage | when 30 % of the element's initial mass remains | [VERIFIED] PM-T (SRI 70 %) |
| Cohesive correction factor C_coh | 0.67 | [VERIFIED] Go24 (starch); recalibrate |
| Adhesive correction factor C_ad | 14.2 | [VERIFIED] Go24 (ketchup); recalibrate |
| Momentum-to-force efficiency eta_M | 0.1 | [ESTIMATED] range 0.03 to 1 |
| Cap on peel mobility k'_max | 3e-2 m s kg^-1 | [VERIFIED as the largest published value] B17 |
| Enzyme response | Hill, n = 3, K_E = 0.82 x reference dose | [ESTIMATED from VERIFIED rates] section 6.1 |
| Activation energy of enzyme-driven removal | 24 kJ mol^-1 | [ESTIMATED from VERIFIED rates] |
| pH sensitivity of enzyme-driven protein removal | factor 2.6 per pH unit between 9.5 and 11.5 | [ESTIMATED from VERIFIED rates] |
| Room evaporation flux for the ageing transform | 9e-6 kg m^-2 s^-1 at 22 C, 50 % RH | [ESTIMATED] |
| Loading heterogeneity within an element | log-normal, coefficient of variation 0.3 | [ESTIMATED]; 0.1 is the measured minimum for sprayed test soils (Go23) |
| Crack edge density for baked soils (bake index above 0.5) | 1000 m^-1 | [ESTIMATED] |

### R4. Soil set for a first release

Implement these ten first, with the parameters of section 8; they span all mechanisms and include every soil for which primary data exist:

1. Dried egg yolk (SWP; Pérez-Mohedano data, highest confidence).
2. Baked egg/custard (SWP with bake index).
3. Cooked dried starch film: pasta or rice or starch mix (SWS with amylase).
4. Porridge or wheat-biscuit cereal (SWS with particles; low confidence, high gameplay relevance).
5. Dried tomato sauce or ketchup (PEEL; Dresden data), with dye uptake on plastics.
6. Baked cheese / lasagne crust (BURN; Cambridge complex-soil data).
7. Butter or lard and beef tallow (FAT; two melting ranges).
8. Polymerised roasting fat (BURN, effectively permanent).
9. Tea stain (STAIN; bleach-gated).
10. Spinach or rice-grain particles (PART; redeposition).

Sugars, fresh sauces, milk films and oils can share one "easy" class (SOL plus viscous shifting): they are removed wherever a film flows and matter mainly as load on the wash liquor.

### R5. Interface contract with the other sub-models

- Needs from "films": per-element wetted fraction, film thickness, wall shear, momentum flow per unit width, water delivery rate, liquid temperature.
- Needs from "jets": per-element impingement events as (peak wall shear, momentum flow per unit width at the element, dwell time) with their frequency; not window means.
- Needs from "chemistry": pH, active enzyme levels, available oxidant, surfactant factor, hardness as functions of time; enzyme deactivation by bleach and temperature.
- Needs from "items": substrate class and roughness, surface temperature history, orientation.
- Gives to "chemistry": removed soil mass by class, released fat, detached particles (count, size, density), water taken up.
- Gives to "standards" and "benchmark": residual maps and the visibility thresholds below.

### R6. Verification tests to build alongside the code (each reproduces a published result)

| Test | Target | Source |
|---|---|---|
| Egg-yolk swelling | 95 % of equilibrium at about 90 min; h_inf = 0.41 / 0.70 / 0.45 / 0.82 mm for (30 C, pH 10.5) / (55, 10.5) / (55, 9.5) / (55, 11.5) | PM-T |
| Gauge run | 50 C, pH 10.5, 17 % frequency, k_ss 25.1, k_ds 5.55 um min^-1, lag 9 min: thickness maximum near 20 to 30 min, then stepwise removal | PM-T Fig. 6.35 |
| In-machine egg yolk | rates 0.85, 1.75, 2.59, 4.66 % min^-1 and completion at about 65, 45, 25 min for the cases of section 6.1; decay after 70 % | PM-T |
| Starch in channel flow | removal starts after about 40 s at 1 m s^-1 and 50 g m^-2; constant rate; decay below 10 g m^-2; time proportional to loading; rate rising about linearly with velocity | Go23 |
| Pre-wetted starch | fraction stripped at flow start after 120 and 240 s of soaking equals the part with yield stress below wall shear | J17 |
| Jet peeling | a proportional to t^0.2 with K = 7.2 mm s^-0.2 for petroleum jelly at 35 mL s^-1 from a 2 mm nozzle; a_max about 20 mm for tau_y = 50 Pa, 300 um, chi = 15 degrees; strip width proportional to V^-1/4 | W14, G16, B17 |
| Soak delay | PVA: no removal before a contact time proportional to dry thickness above 75 um | G16 |
| Baked soil adhesion | F_w falls at 0.06 N m^-1 s^-1 at 20 C and 0.51 at 50 C; exponential tail with 125 s time constant after 220 s | C22 |
| Fat temperature response | k' rising from 6.7e-6 to 3.3e-3 m s kg^-1 between 20 and 60 C | W14 |
| Standard detergent test | IKW programme (45 C, 8 min hold) leaves partial residues on egg yolk, starch mix, minced meat and tea | IKW (qualitative) |

### R7. Suggested visibility thresholds for "clean" (hand to the "standards" sibling)

**[all ESTIMATED]** Protein and starch films: visible or tactile above about 0.5 g m^-2 dry (range 0.2 to 2) on glass and dark glaze, about 1 g m^-2 on white ceramic. Fat: greasy or water-breaking above about 0.1 g m^-2 (0.1 um). Stains: visible when more than about 10 % of the original chromophore remains. Particles: any attached particle larger than about 0.3 mm.

---

## Calibration parameters

What future real-world tests should measure, in priority order. "Default" is the value recommended above; "expected range" is where I expect the calibrated value to fall.

| # | Parameter (per soil unless stated) | Default | Expected range | How to measure |
|---|---|---|---|---|
| 1 | Reaction-erosion mass flux J_r,ref at 50 C, pH 10.5, reference detergent | egg yolk 3e-5; starch 2e-5; meat 1.5e-5; cheese 1e-5; burnt milk 5e-6 kg m^-2 s^-1 | within a factor of 3 for egg yolk; a factor of 10 for the others | soiled tiles at fixed rack positions, cycles interrupted at 5, 10, 20, 40 min, gravimetric and image analysis; or an in-machine camera as in PM-T |
| 2 | Lag time t_lag and its temperature dependence | 9 min at 50 C (egg yolk); 5 min others | 0.5 to 30 min | same tests; first detectable loss |
| 3 | Activation energy of removal | 24 kJ mol^-1 | 5 to 60 | repeat test 1 at 30, 40, 50, 60 C |
| 4 | pH sensitivity s_pH | 0.96 (protein); 0.3 (starch) | 0 to 1.5 | repeat test 1 at pH 9.5, 10.5, 11.5 |
| 5 | Enzyme response (Hill n, K_E) | n = 3, K_E = 0.82 x reference dose | n 1 to 4; K_E 0.3 to 1.5 x dose | repeat test 1 at 0.3, 0.6, 1.0, 1.6 x dose |
| 6 | Jet assistance: tau_star and k_ss/k_ds | 10 Pa; 4 | 5 to 20 Pa; 1.5 to 7 | paired tiles in jet-swept and jet-shadowed but film-wetted positions; single-jet rig with a moving plate |
| 7 | Swelling capacity beta_max (or lambda_inf) versus T and pH, and water diffusivity | table 8.1 | thickness ratio 1.3 to 15; D_w0 1e-12 to 1e-10 m^2 s^-1 | immersed thickness tracking (confocal sensor or side camera) and gravimetric uptake |
| 8 | Cohesion law tau_c0, b_c and adhesion law tau_a0, b_a | starch 5e8 Pa, 0.021 m^3 kg^-1; ketchup 8.1e5 Pa, 0.016 | b 0.01 to 0.03; prefactors within a factor of 10 | micromanipulation after timed soaks; or back-fit from film-cleaning times |
| 9 | Correction factors C_coh, C_ad | 0.67; 14.2 | 0.1 to 20 | fit to channel or falling-film cleaning times at two shear levels |
| 10 | Peel resistance F_a0, its decay (k_ad, t_M, t_F) and substrate factor | table 8.2 | F_a0 1 to 300 N m^-1; t_M 0.5 to 10 min; t_F 1 to 30 min | immersed millimanipulation on glass, glazed porcelain, steel, polypropylene, melamine |
| 11 | Peel mobility k' and efficiency eta_M at dishwasher traverse speeds | 1e-4 (dried films), J9 for fats; eta_M 0.1 | k' 1e-6 to 3e-2 m s kg^-1; eta_M 0.03 to 1 | single nozzle sweeping a soiled plate at 0.2 to 1 m s^-1; measure strip width per pass |
| 12 | Ageing: evaporation flux, equilibrium moisture, bake-index kinetics and multipliers | 9e-6 kg m^-2 s^-1; omega_0 0.06 to 0.14; k_B 3e-5 s^-1 at 80 C, E_B 43 kJ mol^-1 | flux 5e-6 to 2e-5; E_B 30 to 80 | identical soils dried 0, 1, 2, 4, 8, 24 h at controlled humidity and oven-aged at 80, 130, 200 C, then test 1 |
| 13 | Fat: melting range on the item, residual film after drainage, emulsification rate | SFC table; k_em 0.01 s^-1 | k_em 0.002 to 0.05 s^-1 | fluorescently dyed fat films; cycles at 40, 50, 60 C; with and without detergent |
| 14 | Stain bleaching rate and activation energy; dye uptake into plastics | tea half-life 5 min at reference bleach; 50 kJ mol^-1 | half-life 2 to 20 min; 30 to 70 kJ mol^-1 | colour measurement of tea cups through interrupted cycles; tomato-oil contact tests on polypropylene |
| 15 | Particles: binder release time, pinning condition, redeposition capture efficiency | release after 1 to 5 min wet; pinned when film thinner than the particle | - | counted spinach and seed particles, before and after, on soiled and clean witness items |
| 16 | Within-element loading heterogeneity and rim factor | CV 0.3; rim x 5 | CV 0.1 to 0.6; rim x 2 to 10 | profilometry of real meal residues |
| 17 | Water-supply limitation of swelling | top flux limited by film delivery | - | compare swelling of tiles under a continuous film, under intermittent splashing, and immersed |
| 18 | Visibility thresholds | section R7 | protein and starch 0.2 to 2 g m^-2; fat 0.05 to 0.3 g m^-2 | graded residue panels judged under the standard's lighting |
| 19 | Egg-yolk tile dry thickness and density (resolves the flag in section 2.2) | 1100 kg m^-3 assumed | 1000 to 1300 kg m^-3 | profilometry and weighing of CFT DS-22 / DM-22 tiles |

A compact rig set covers almost all of this: (i) an inclined-plate film rig with controlled flow, temperature and chemistry; (ii) a single-nozzle rig with a traversing plate; (iii) immersed milli-manipulation; (iv) a transparent-door or camera-equipped dishwasher with interruptible cycles.

---

## Sources

Primary sources read in full or in substantial part this session:

- **PM-T**: Pérez Mohedano, R. (2016). Cleaning principles in automatic dishwashers. EngD thesis, University of Birmingham. https://etheses.bham.ac.uk/id/eprint/6590/ (PDF: https://etheses.bham.ac.uk/id/eprint/6590/9/PerezMohedano16EngD_sizereduced.pdf). Contains the material of the three journal papers by Pérez-Mohedano, Letzelter and Bakalis (Food and Bioproducts Processing 93, 269 to 282, 2015; Journal of Food Engineering 169, 101 to 113, 2016; Journal of Food Engineering 196, 101 to 112, 2017), whose repository copies returned HTTP 403: https://research.birmingham.ac.uk/en/publications/development-of-a-swelling-removal-model-for-the-scanning-fluid-dy/ , https://research.birmingham.ac.uk/en/publications/swelling-and-hydration-studies-on-egg-yolk-samples-via-scanning-f/ , https://research.birmingham.ac.uk/en/publications/integrated-model-for-the-prediction-of-cleaning-profiles-inside-a/
- **W14**: Wilson, D.I., Atkinson, P., Köhler, H., Mauermann, M., Stoye, H., Suddaby, K., Wang, T., Davidson, J.F., Majschak, J.-P. (2014). Cleaning of soft-solid soil layers on vertical and horizontal surfaces by stationary coherent impinging liquid jets. Chemical Engineering Science 109, 183 to 196. Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/245880
- **G16**: Glover, H.W., Brass, T., Bhagat, R.K., Davidson, J.F., Pratt, L., Wilson, D.I. (2016). Cleaning of complex soil layers on vertical walls by fixed and moving impinging liquid jets. Journal of Food Engineering 178, 95 to 109. Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/253141
- **B17**: Bhagat, R.K., Perera, A.M., Wilson, D.I. (2017). Cleaning vessel walls by moving water jets: simple models and supporting experiments. Food and Bioproducts Processing (submitted August 2016; volume number not checked). Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/262542
- **FW20**: Fernandes, R.R., Wilson, D.I. (2020). Modelling the cleaning of viscoplastic layers by impinging coherent turbulent water jets. Journal of Non-Newtonian Fluid Mechanics (journal and year recalled, not printed in the manuscript I read). Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/305561
- **Go23**: Golla, C., Köhler, H., Fröhlich, J., Rüdiger, F. (2023). Numerical modeling of a cohesively separating soil layer in consideration of locally varying soil distribution. Heat and Mass Transfer. https://link.springer.com/article/10.1007/s00231-023-03394-4 (PDF: https://fis.tu-dresden.de/portal/files/32988110/Golla_et_al_2023_Heat_and_Mass_Transfer.pdf)
- **Go24**: Golla, C., Liebmann, V., Jena, S., Fröhlich, J., Rüdiger, F., Köhler, H. (2024). A cleaning model for film-like soils with transition between cleaning mechanisms. Proc. Heat Exchanger Fouling and Cleaning 2024, Lisbon. https://heatexchanger-fouling.com/wp-content/uploads/2024/11/18.-Golla-et-al-2024-04-22.pdf
- **J17**: Joppa, M., Köhler, H., Rüdiger, F., Majschak, J.-P., Fröhlich, J. (2017). Prediction of cleaning by means of computational fluid dynamics: implication of the pre-wetting of a swellable soil. Proc. Heat Exchanger Fouling and Cleaning 2017. https://heatexchanger-fouling.com/wp-content/uploads/2021/09/34_Joppa_Prediction-of-Cleaning-by-Means-of-Computational.pdf
- **C22**: Cuckston, G.L., Suleiman, N., Goodwin, J., Groombridge, M., Wilson, D.I. (2022). Elucidating the cleaning of complex food soil layers by in-situ measurements. Food and Bioproducts Processing. Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/331568 . **C22-thesis** (abstract only): Cuckston, G. (2020). Methods for detailed study of detergent action in cleaning food soils. PhD thesis, University of Cambridge. https://www.repository.cam.ac.uk/handle/1810/307835
- **A15**: Ali, A., de'Ath, D., Gibson, D., Parkin, J., Alam, Z., Ward, G., Wilson, D.I. (2015). Development of a "millimanipulation" device to study the removal of soft solid fouling layers from solid substrates and its application to cooked lard deposits. Food and Bioproducts Processing 93, 256 to 268 (open access). https://www.repository.cam.ac.uk/items/515e9e14-0e71-49db-8684-423d7a39437a
- **M17** (abstract and figure captions only): Magens, O.M., Liu, Y., Hofmans, J.F.A., Nelissen, J.A., Wilson, D.I. (2017). Adhesion and cleaning of foods with complex structure: effect of oil content and fluoropolymer coating characteristics on the detachment of cake from baking surfaces. Journal of Food Engineering 197. https://www.repository.cam.ac.uk/items/47d9cd29-25a8-4645-a890-c084f7fc2cdb
- **Z19**: Zainoldin, K.H. (2019). Study on swelling and cleaning of egg yolk deposits at laboratory scale. PhD thesis, University of Birmingham. https://etheses.bham.ac.uk/id/eprint/8912 (PDF: https://etheses.bham.ac.uk/id/eprint/8912/7/Zainoldin2019PhD.pdf). Also my second-hand source for the numbers of Liu et al. (2002, 2006, 2007), Cole and Rois Anwar.
- **IKW**: German Cosmetic, Toiletry, Perfumery and Detergent Association, Working Group Automatic Dishwashing Detergents. Recommendations for the quality assessment of the cleaning performance of dishwasher detergents (Part B, update 2015). SOFW Journal 142 (06/2016), with 2025 cover sheet. https://www.ikw.org/fileadmin/IKW_Dateien/downloads/Haushaltspflege/2025_EQ-MGSP-Teil-B_2015_inkl_Vorblatt-e.pdf
- **R24**: Roldán-San Antonio, J.E., Amador, C., Martín, M., Blyth, K., Croce Mago, V.C. (2024). Cleaning kinetic model for carbohydrate- and protein-based stains in automatic dishwasher. ESCAPE-34 / PSE-24. https://www.aidic.it/escape34-pse24/programma/323Roldan.docx
- **Y19** (data README only): Yang, J., Bhagat, R.K., Fernandes, R.R., Nordkvist, M., et al., Wilson, D.I. (2019). Cleaning of toothpaste from vessel walls by impinging liquid jets and their falling films: quantitative modelling of soaking effects. Data and supplementary information. https://www.repository.cam.ac.uk/handle/1810/295357
- **Wiki-starch**: https://en.wikipedia.org/wiki/Starch_gelatinization . **Wiki-lyco**: https://en.wikipedia.org/wiki/Lycopene

Sources seen only as search-result excerpts ("snippet") this session; values tagged "[VERIFIED, snippet]" come from these excerpts, not from the full text:

- **Gordon-snip**: Gordon, P.W., Brooker, A.D.M., Chew, Y.M.J., Letzelter, N., York, D.W., Wilson, D.I. (2012). Elucidating enzyme-based cleaning of protein soils (gelatine and egg yolk) using a scanning fluid dynamic gauge. Chemical Engineering Research and Design 90, 162 to 171. https://researchportal.bath.ac.uk/en/publications/elucidating-enzyme-based-cleaning-of-protein-soils-gelatine-and-e/
- **Liu-snip**: Liu, W., Christian, G.K., Zhang, Z., Fryer, P.J. (2002) and follow-ups (2006, 2007), micromanipulation of tomato paste, whey protein, egg albumin, bread dough. https://research.birmingham.ac.uk/en/publications/development-and-use-of-a-novel-method-for-measuring-the-force-req and https://research.birmingham.ac.uk/en/publications/identification-of-cohesive-and-adhesive-effects-in-the-cleaning-o/
- Fryer, P.J., Asteriadou, K. (2009). A prototype cleaning map: a classification of industrial cleaning processes. Trends in Food Science and Technology 20, 255 to 262. https://research.birmingham.ac.uk/en/publications/a-prototype-cleaning-map-a-classification-of-industrial-cleaning- (not opened; described via PM-T, W14, Go24).
- **A15b-snip**: Ali, A., Alam, Z., Ward, G., Wilson, D.I. (2015). Using the scanning fluid dynamic gauging device to understand the cleaning of baked lard soiling layers. Journal of Surfactants and Detergents 18, 933 to 947. https://link.springer.com/article/10.1007/s11743-015-1737-z (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4639583/)
- **SE24-snip**: Sáenz-Espinar and co-workers (2024), milli-manipulation of lard/starch/whey deposits on stainless steel, aluminium and PTFE; University of Granada repository record surfaced in search (https://digibug.ugr.es/handle/10481/89193); exact record not verified.
- **SI23-snip**: study of soil drying on surgical instruments (2023). https://pmc.ncbi.nlm.nih.gov/articles/PMC10512989/
- **Gorny-snip**: Gorny, Widdig, Bichler, Stamminger. Simulating consumer-like air drying of dishes via thermal drying process. Tenside Surfactants Detergents. https://www.degruyterbrill.com/document/doi/10.3139/113.110330/pdf
- **TSD24-snip**: two 2024 papers in Tenside Surfactants Detergents on eco and short programmes. https://www.degruyterbrill.com/document/doi/10.1515/tsd-2024-2589/html and https://www.degruyterbrill.com/document/doi/10.1515/tsd-2024-2634/html
- **AMF-snip**: anhydrous milk fat product specification sheet with solid-fat-content table, https://expo.thefoodtech.com/wp-content/themes/summit-expo/directorio/assets/fichas/d7209673-8a0b-4140-a51c-ccb19ed83598.pdf ; second set of values from a paywalled study page returned by the same search (probably https://link.springer.com/article/10.1007/s11483-010-9186-8 ; attribution uncertain).
- **Lard-snip**: US patent 11834694, Structural lipids (lard solid fat content at 5 C). https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11834694
- **Tallow-snip**: tallow monograph (titre of beef tallow). https://drugfuture.com/chemdata/Tallow.html
- **Palm-snip**: comparison of palm oil and lard by pulsed NMR, Grasas y Aceites (2012). https://doaj.org/article/4dc23cb8908d416e81292a0cf3f1b9cd
- **Tea-snip**: automatic-dishwashing patents discussing tea-stain removal: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10913919 , https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11999926 , https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5599781 ; TAED perhydrolysis kinetics (abstract only): Davies and Deary (1991), J. Chem. Soc. Perkin Trans. 2, 1549 to 1552, https://pubs.rsc.org/en/content/articlepdf/1991/p2/p29910001549
- **HSRW-snip**: Hochschule Rhein-Waal, experimental guidelines for the hygiene certificate for dishwashers (soil matrix according to DIN EN 50242). https://www.hochschule-rhein-waal.de/sites/default/files/documents/2022/02/17/experimental_guidelines_hygiene_certificate_dishwashers_deutsch_englisch_17022022.pdf
- Köhler, H., Liebmann, V., Golla, C., Fröhlich, J., Rüdiger, F. (2021). Modeling and CFD-simulation of cleaning process for adhesively detaching film-like soils with respect to industrial application. Food and Bioproducts Processing 129, 157 to 167. https://fis.tu-dresden.de/portal/en/publications/modeling-and-cfdsimulation-of-cleaning-process-for-adhesively-detaching-filmlike-soils-with-respect-to-industrial-application(177f2cc7-1d19-4df6-bfe0-621388fe12d8).html (parameters read as reproduced in Go24).

Located but not read (useful for follow-up):

- Gottschalk, N. et al. (2022). Model food soils for investigating cleaning: a review. Food and Bioproducts Processing 136, 249 to 296 (open access). https://dau.url.edu/handle/20.500.14342/4510
- Herrera-Márquez, O. et al. (2020). Cleaning maps: a multi length-scale strategy to approach the cleaning of complex food deposits. Journal of Cleaner Production. https://digibug.ugr.es/handle/10481/98086
- Cuckston, G.L., Alam, Z., Goodwin, J., Ward, G., Wilson, D.I. (2019). Quantifying the effect of solution formulation on the removal of soft solid food deposits from stainless steel substrates. Journal of Food Engineering (doi 10.1016/j.jfoodeng.2018.08.018); dataset record https://www.repository.cam.ac.uk/handle/1810/279007
- Chee, M.W.L. et al. (2019). Impinging jet cleaning of tank walls: effect of jet length, wall curvature and related phenomena. Cambridge repository record surfaced in search (https://www.repository.cam.ac.uk/handle/1810/286347); I did not verify that this handle is that paper.
- Wilson, D.I. et al. (2015). Chemical Engineering Science 123, 450 to 459 (moving jets); Wang, T., Davidson, J.F., Wilson, D.I. (2015), jets on angled walls, https://www.repository.cam.ac.uk/handle/1810/246072
- Xin, H., Chen, X.D., Özkan, N. (2004). Removal of a model protein foulant from metal surfaces. AIChE Journal (described via PM-T).
- Tuck, J.P. et al. (2020). Cleaning of thick films using liquid jets. https://research.birmingham.ac.uk/en/publications/cleaning-of-thick-films-using-liquid-jets/
