# Spotless research dossier: numerical methods, industrial precedent and performance engineering

Specialist: numerics. Date: 2026-10-08. Target machine: Apple M3 Pro MacBook Pro (11-core CPU = 5 performance + 6 efficiency, 14-core GPU, 18 GB unified memory, 150 GB/s memory bandwidth, hardware-accelerated ray tracing) [VERIFIED: Apple tech specs, https://support.apple.com/en-bh/117736].

## 0. How to read this dossier

**Confidence tags** (one per quantitative claim):

- **[VERIFIED]** I saw the value in source text fetched this session (web page, PDF text extracted locally, or source code downloaded from the repository). The source and the place in it are given.
- **[RECALLED]** From memory, or seen only in a search-engine result snippet without opening the page. Snippet-only items say so.
- **[ESTIMATED]** My own derivation. The arithmetic is shown.

**Research limits to know about.** The literature search stopped part-way through. Sources at known addresses could still be opened, so everything tagged [VERIFIED] was opened. Several things I wanted to check could not be searched for and are flagged as gaps: published GPU throughput for PBF and sparse-grid FLIP, free-surface LBM resolution rules, sustained-load throttling data for the M3 Pro, and the Metal status of wgpu ray queries. ANSYS and Siemens theory pages render equations as images, so their equations are reproduced from the open-source equivalents (OpenFOAM, Meredith et al.) which I read directly, and the Fluent-specific forms are marked [RECALLED].

**Reference fluid for all my estimates:** wash liquor at about 55 °C: density 985 kg/m3, dynamic viscosity 5.0e-4 Pa s, kinematic viscosity 5.1e-7 m2/s, surface tension 0.067 N/m (clean water; detergent lowers it, see the chemistry and films dossiers) [RECALLED]. Tub interior 0.55 x 0.50 x 0.60 m = 0.165 m3 (from the brief).

**The five numbers that drive the recommendation**

| # | Number | Tag |
|---|---|---|
| 1 | The only published, validated dishwasher free-surface CFD with full disclosure (appliance manufacturer + Univ. Birmingham): 5 million cells, time step 1e-4 s, **two** spray-arm revolutions, lower arm only, **empty** tub, 96 processors for 48 h = 4608 core-hours | [VERIFIED] Pérez-Mohedano thesis, section 3.5 |
| 2 | In the same body of work a jet hits a given soil tile for 0.07 % to 1.59 % of each revolution; the tile is otherwise only wetted | [VERIFIED] thesis, section 7.3.1.1, table 7.5 |
| 3 | Lattice-Boltzmann throughput on the closest Apple chips: M1 Pro 16-core GPU 1204 MLUPs/s, M2 Pro 19-core GPU 1195 MLUPs/s (FP32); a 1 mm grid of the tub is 165 million cells | [VERIFIED] FluidX3D README table; cell count [ESTIMATED] |
| 4 | Any fully resolved 3D free-surface method at 1 to 2 mm resolution yields about 0.04 to 3 simulated seconds in 30 minutes on this machine: at best about one and a half arm revolutions (at 2 mm), out of a 1 to 2.5 hour cycle | [ESTIMATED] section 3.5 |
| 5 | Replacing a resolved multiphase soil simulation by a soil boundary-condition model on a frozen flow field cut computing time "by about three orders of magnitude" with good agreement to experiment | [VERIFIED] Joppa et al. 2017, abstract |

---

## 1. Industrial and academic precedent

### 1.1 Dishwasher-specific work

| Who / tool | Method | Resolution and size | Physical time | Hardware and runtime | Validation and claimed accuracy | Tag and source |
|---|---|---|---|---|---|---|
| Appliance manufacturer (co-author C.T. Vanderroest) with P&G and Univ. Birmingham; Simcenter STAR-CCM+ | Unsteady Eulerian multiphase VOF; spray arm rotates freely under fluid forces (DFBI, one rotational degree of freedom, inertia from CAD); mass-flow inlet at arm; then one-way Lagrangian tracking of 10^6 water particles through the developed field | 5 million polyhedral + prism-layer cells (mean cell edge about 3.2 mm if spread over the whole tub [ESTIMATED: (0.165 m3 / 5e6)^(1/3)]); time step 1e-4 s | Two revolutions of the lower arm; empty tub, no racks, no load | 96 processors, 48 h | Against PEPT (radioactive tracer) at medium pump speed. Mean speed, PEPT vs CFD: inside arm 1.60 vs 1.43 m/s; jet ejection 7.69 vs 7.24 m/s; downfall 5.05 vs 3.31 m/s. "Good agreement" for arm and ejection, statistically significant disagreement for downfall. CFD could not distinguish the flow down the side walls | [VERIFIED] thesis sections 3.5, 4.5, table 4.1; http://etheses.bham.ac.uk//id/eprint/6590/9/PerezMohedano16EngD_sizereduced.pdf |
| Pérez-Mohedano et al., "integrated model" (thesis ch. 5 and 7; J. Food Eng. 2017) | No CFD. Geometric/trigonometric projection of straight coherent jets from the rotating arm onto a plate; outputs impact time per lap and coverage; coupled to a swelling/removal model with two removal rates (under shear, and by dissolution between hits) | One soil tile; jet treated as a line | Whole wash phase (tens of minutes) | "quicker than CFD" (MATLAB) | Egg-yolk tiles in a real machine. Good agreement in 4 of 6 cases; over-predicts cleaning when removal is slow (< 0.75 %SRI/min). Arm speed measured at 35 rpm (1.71 s per revolution) | [VERIFIED] thesis sections 5.1, 7.3, 8.1 |
| FIFTY2 PreonLab (now AVL) | Implicit incompressible SPH, time steps at CFL 1; rotating arms prescribed or coupled rigid body; "wetting sensors" (wetting time per surface point), "force sensors" (shear on dishware), Herschel-Bulkley ketchup soil, conjugate heat transfer (60 °C jets on 20 °C dishware) | Not disclosed | "a single full rotation of the spray arm might suffice" for nozzle-direction studies | Not disclosed (CPU and multi-GPU supported) | None published | [VERIFIED] https://www.fifty2.eu/innovation/dishwasher-simulation-in-preonlab/ and https://avl.com/en/blog/particle-based-simulation-optimize-dishwasher-design |
| Ansys Rocky with Sub-Zero Inc. (PARTICLES 2023) | GPU SPH, compressible vs incompressible formulations compared | Not accessible (abstract only) | Not accessible | Not accessible | Abstract claims flow patterns and moving-part dynamics agree with experiment; incompressible SPH faster for large problems | [VERIFIED abstract only] https://particles2023.cimne.com/event/contribution/ec515893-e335-11ed-9a1c-000c29ddfc0c |
| Siemens Simcenter STAR-CCM+ (2024 blog) | **Hybrid multiphase**: VOF for larger liquid bodies, fluid-film model for wetted surfaces, Lagrangian phase for ballistic droplets, adaptive mesh refinement | Not disclosed | Not disclosed | Not disclosed | None published | [VERIFIED] https://blogs.sw.siemens.com/simcenter/?p=58343 |
| CFD Support (OpenFOAM) | interFoam (VOF) with two simultaneous dynamic-mesh classes (rotation and refinement) | Not disclosed | Not disclosed | Not disclosed | None; "quite difficult even for experienced OpenFOAM developers" | [VERIFIED] https://www.cfdsupport.com/dishwasher-openfoam-study/ |
| Dive Solutions | SPH for washing systems; monitors nozzle shear stress and dry zones; cites a BSH laundry-machine paper (SPHERIC 2024) | Not disclosed | Not disclosed | Cloud GPU | None on page | [VERIFIED] https://www.divecae.com/solution-application/washing-system |
| Sink-type dishwasher patent US 12,579,335 | Three stages: RANS pump curve, then VOF with passive rotation, then VOF of non-submerged rotating jets; each nozzle a mass source 1.5 nozzle diameters above the exit; output is average pressure on the sink top | Not seen | Not seen | Not seen | Not seen | [RECALLED: search snippet only] https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12579335 |
| Coupled 3D-1D dishwasher heat-transfer model (Case Stud. Therm. Eng. 2023) | Spray bars represented by a fixed periodic schedule rather than resolved jets | Not seen | 300 s wash | Not seen | Temperatures within 0.5 °C of measurement | [RECALLED: search snippet only; page returned 403] https://www.sciencedirect.com/science/article/pii/S2214157X23006615 |
| Electrolux (M. Minde, MSc thesis) | CFD of the **drying airflow**, validated by PIV. Not a water simulation | n/a | n/a | n/a | n/a | [VERIFIED scope only] https://www.diva-portal.org/smash/get/diva2:1027486/FULLTEXT02.pdf |

What this shows:

1. **No one has published a full-cycle, loaded-machine, resolved free-surface simulation.** The best-documented one covers two revolutions of one arm in an empty tub and cost 4608 core-hours. Spotless has roughly 4 P-core-hours plus one laptop GPU per wash: about three orders of magnitude less compute, for a loaded machine and a full cycle [ESTIMATED: 0.5 h x about 8 P-core equivalents].
2. **Even that simulation was wrong where it matters to us.** Downfall speed was under-predicted by 34 % and wall films were not resolved (3 mm cells cannot hold a 0.1 to 0.5 mm film).
3. **Vendors measure exactly the proxies that architecture (a) computes directly:** wetting time per surface point and shear on dishware. None publishes a soil-removal validation.
4. **Siemens' recommended set-up is already a hybrid of the kind in candidates (a)/(c).**
5. **The only published end-to-end cleaning prediction for a dishwasher (Pérez-Mohedano) is a pure reduced-order model:** straight-line jets, an impact-frequency factor, and kinetics from bench tests. It is the direct ancestor of architecture (a). In its bench tests shear stress magnitude (12 to 65 Pa) was *not* statistically significant for swelling-controlled protein soil, while frequency of exposure was [VERIFIED: thesis section 7.3.1.2, table 7.6]. Exposure statistics, not peak hydrodynamics, were the controlling input.

### 1.2 Analogous spray, wetting and cleaning simulations

| Application / tool | Method | Size | Physical time | Hardware and runtime | Validation | Tag and source |
|---|---|---|---|---|---|---|
| Gear lubrication, PreonLab | Implicit SPH | 4.34 million particles | 1.52 s | NVIDIA RTX 4090, 28 h | n/a | [VERIFIED] https://fifty2.eu/innovation/preonlab-the-ultimate-simulation-tool |
| Volvo water wading, PreonLab | Implicit SPH | > 200 million particles | Not stated | 2184 cores, 36 to 54 h | Qualitative endorsement only | [VERIFIED] https://www.fifty2.eu/volvo-showcase/ |
| Car-door rain water paths, PreonLab (TU Dresden diploma thesis, Daimler) | Implicit SPH with calibrated adhesion and friction per material | Not stated | about 10 s | Not stated | Flow rates within 10 % (A-pillar) and 7 % (B-pillar) of test bench; other tools made adhesion "either too exaggerated or too weak" | [VERIFIED] https://fifty2.eu/wp-content/uploads/2021/06/tudresden-whitepaper.pdf |
| Gearbox / e-motor oiling, Altair nanoFluidX | Weakly compressible SPH on GPU | 1 mm particles (gearbox) to 0.5 mm (e-motor); a real dual-clutch case has 13.5 million particles; 1 to 2 million particles per GPU recommended | 3 to 5 s; 1.5 s | 1 Tesla V100 for 2 h; 8 Tesla V100 for 120 h | n/a | [VERIFIED] https://help.altair.com/hwcfdsolvers/nfx/topics/faq/faq_simulation_environment_r.htm |
| Dam break benchmark, DualSPHysics | Weakly compressible SPH | 116,658 to 80 million particles; about 268 neighbours per particle; 5.8 to 6.05 million particles per GB | 2 s | RTX 2080 Ti: 56 million particles in about 36 h, 23e9 particle interactions/s; Tesla V100: 80 million in < 48 h, 29e9 interactions/s; 12-thread CPU 0.14e9 | SPHERIC test 2 | [VERIFIED] arXiv 2104.00537, section 5.3 |
| Sprinkler water on surfaces, FM Global FireFOAM (OpenFOAM) | Lagrangian spray parcels + 2D thin-film equations on walls (the code path in section 2) | Film grid spacing 3.8 mm on a 0.61 x 1.22 m panel | Steady flows | Not stated | Nusselt solution reproduced; rivulet-to-film transition measured between 108 and 174 g/(m s) at 5° and 125 to 212 g/(m s) at 90°, simulated 150 to 300 g/(m s) at 90°; wetted-area fraction 0.1 to 0.2 in rivulet regime in both; rivulet meandering not captured | [VERIFIED] Meredith et al. 2011, sections 5 and 6 |
| Cleaning of swellable soil in channel flow, TU Dresden | Soil as a transient boundary condition on a frozen single-phase flow field ("BCCM") | n/a | Minutes | "about three orders of magnitude" less than conventional multiphase | "match the experiments astonishingly well" (starch, Reynolds number up to 20,000) | [VERIFIED] Joppa et al. 2017, abstract |
| Tank cleaning with spray balls, Univ. Limerick 2025 | VOF for spray formation coupled to Lagrangian droplets (DPM), film dissolution | Not seen (paywalled) | Not seen | Not seen | Against measured liquid distribution in a vessel and an analytical film mass-transfer solution | [VERIFIED abstract only] doi:10.1016/j.cherd.2025.03.027 |
| Vehicle soiling and A-pillar overflow, PowerFLOW | Lattice-Boltzmann air flow, Lagrangian droplets, thin-film model on the body | Not seen | Not seen | Not seen | UV-dye wind-tunnel tests at two speeds; rigorous comparison limited by unknown contact angles | [RECALLED: search snippets] SAE 2012-01-0588, 2015-01-1549, 2018-01-0717 |

Two lessons from the analogues. First, the car-door and fire-sprinkler cases show that **wetting parameters (adhesion, contact angle, the empirical contact-line coefficient) are calibrated per surface, not predicted**, in every validated example. Second, commercial GPU SPH needs hours to days on data-centre GPUs for 1.5 to 5 s of physical time at 0.5 to 1 mm.

---

## 2. The Lagrangian spray + Eulerian wall-film hybrid in production CFD

All production codes use the same structure: droplets are point parcels integrated along ballistic paths; where they hit a wall they are removed and their mass, momentum and energy become sources of a depth-integrated film equation solved on the wall surface; the film can return liquid to the droplet phase by dripping, edge separation, or stripping.

### 2.1 Governing equations (OpenFOAM `kinematicSingleLayer`; Meredith et al. 2011)

Symbols: δ film thickness [m]; **U** depth-mean film velocity tangential to the wall [m/s]; ρ, μ, σ liquid density [kg/m3], viscosity [Pa s], surface tension [N/m]; **n** wall unit normal; **g** gravity [m/s2]; **g**_t its wall-tangential part; ∇_s surface gradient; S terms are sources per unit wall area.

Mass:

    ∂(ρδ)/∂t + ∇_s·(ρδU) = S_ρδ                                     (2.1)

Momentum:

    ∂(ρδU)/∂t + ∇_s·(ρδUU) = −δ ∇_s p + τ_g + τ_w + ρ g_t δ + τ_θ + S_U   (2.2)

Pressure (wall-normal forces whose tangential gradient drives flow):

    p = p_σ + p_δ + p_g (+ p_imp)                                   (2.3)
    p_σ = −σ ∇_s² δ            capillary (valid for small surface slope)
    p_δ = −ρ (n·g) δ           hydrostatic head
    p_g                        local gas pressure
    p_imp                      normal momentum flux of impinging parcels

Wall shear for laminar flow with a parabolic profile u(z) = (3U/δ)(z − z²/(2δ)):

    τ_w = −3 μ U / δ ,   surface velocity U_s = 1.5 U                (2.4)

Contact-line ("partial wetting") force, applied only in cells on the wet/dry boundary:

    τ_θ = β σ (1 − cos θ_E) / Δ_cl · n_cl                            (2.5)

with θ_E the contact angle, Δ_cl the cell width normal to the contact line, n_cl the unit vector normal to the contact line in the surface, and β an empirical coefficient.

[VERIFIED] Equations (2.1) to (2.5) are Meredith et al. 2011 eqs. (1), (3) to (9), (13) (https://www.witpress.com/Secure/elibrary/papers/MPF11/MPF11020FU1.pdf). The OpenFOAM-8 source implements them: `pc() = -fvc::laplacian(sigma_, delta_)`; the momentum matrix `fvm::ddt(alpha_, rho_, U_) + fvm::div(phi_, U_) == -USp_ + forces_.correct(U_) + turbulence_->Su(U_)`; laminar wall coefficient `Cw = mu/((1/3)*VbyA*delta + ...)`, treated implicitly with `fvm::Sp`; surface velocity `1.5*filmModel_.U()`; contact force `Ccf_*n*sigma*(1 - cosTheta)/invDx` then divided by cell volume (files `kinematicSingleLayer.C`, `laminar.C`, `contactAngleForce.C` under https://github.com/OpenFOAM/OpenFOAM-8/tree/master/src/regionModels/surfaceFilmModels).

Points that matter for an implementer:

- OpenFOAM advects with the plain mean velocity (momentum-flux factor 1). A parabolic profile actually gives a factor 6/5; the code's own curvature-separation model uses 72/60 for the inertial force [VERIFIED: `curvatureSeparation.C`]. Fluent states that its advection term is "computed on the basis of the quadratic film velocity profile" [VERIFIED: Fluent Theory Guide 24.2, section 17.2]. Use 6/5.
- The film thickness equation is solved in a pressure-corrector form: momentum is predicted, then thickness is solved with the hydrostatic term implicit (`fvm::laplacian(alpha rho rAU rho g, alpha)`) [VERIFIED: `solveAlpha`]. The newer finite-area solver (OpenFOAM.com `kinematicThinFilm`) has the same structure with outer, velocity-corrector and thickness loops and bounds thickness from below by a floor `h0` [VERIFIED: https://api.openfoam.com/2412/kinematicThinFilm_8C_source.html].
- Gas shear is `Cs = Cf ρ_g |U_g − U|`, with `Cf 0.005` in the shipped tutorials [VERIFIED: `laminar.C`; tutorials `hotBoxes`, `splashPanel`, `cylinder`]. Negligible in a dishwasher (still air).
- Wet/dry flag: a cell is wet when δ exceeds a threshold; tutorials set `deltaWet 1e-4` m [VERIFIED]. Meredith adds hysteresis: a surface once wetted stays "wet" until δ < 0.001 δ_c, and a surface wetted by spray counts as wet at δ > 0.5 δ_c [VERIFIED: section 3.6].

**Fluent Eulerian Wall Film (EWF).** The momentum equation has the same terms: transient and advection (quadratic profile); gas pressure + wall-normal gravity ("spreading") + surface tension; tangential gravity; viscous shear at the gas-film and film-wall interfaces from the quadratic profile; droplet collection/separation sources; a surface force from surface tension and contact angle [VERIFIED: term-by-term description, Theory Guide 24.2 section 17.2, https://ansyshelp.ansys.com/public/Views/Secured/corp/v242/en/flu_th/flu_th_ewf_sec_eqns.html]. Its usual written form is [RECALLED: equations are images on the page]:

    ∂(ρh)/∂t + ∇_s·(ρ h V) = ṁ_s
    ∂(ρhV)/∂t + ∇_s·(ρ h V V + D_V) = −h ∇_s P_L + ρ h g_τ + (3/2) τ_fs − (3μ/h) V + q̇_s + τ_θw
    P_L = P_gas − ρ h (n·g) − σ ∇_s·(∇_s h)

Partial wetting in Fluent is "Meredith's partial wetting model"; the contact angle is sampled per wall location from a Gaussian with a user mean and standard deviation; the wet/dry critical thickness is fixed at 1e-10 m [VERIFIED: section 17.2.2]. Time integration options: first-order explicit, first-order implicit (predictor-corrector iteration), second-order implicit [VERIFIED: section 17.4.1].

**KIVA (O'Rourke and Amsden 1996) and CONVERGE** represent the film by particles that stay on the wall rather than by a continuum field. The KIVA film momentum equation neglects film inertia, pressure gradient and gravity and assumes a linear velocity profile; the authors show inertia is negligible only for films thinner than about 100 μm in their engine conditions [VERIFIED: O'Rourke and Amsden 1996, wall-film momentum section, https://digital.library.unt.edu/ark:/67531/metadc687967/m2/1/high_res_d/373884.pdf]. Fluent's particle-film variant is restricted to films under 500 μm for the same linear-profile reason [VERIFIED: Theory Guide section 12.9.1]. **These engine-heritage simplifications are wrong for a dishwasher**, where gravity drives the film and jet-fed films are inertial; use the continuum form (2.1) to (2.5).

**STAR-CCM+ fluid film.** Solved on a shell region; supports impingement, edge stripping, wave stripping, and a "resolved transition" between film and VOF [VERIFIED: model list at https://topcfd.cn/Ebook/STARCCMP/GUID-B1D8FE17-0924-4292-961C-E9E12DBFF1D3.html, a mirror of the vendor help]. I could not access its theory pages; no equations are given here.

### 2.2 Sub-models and their constants

**(a) Impingement and splash: OpenFOAM `ThermoSurfaceFilm`, option `splashBai` (after Bai and Gosman 1996; Bai et al. 2002).** For a parcel of diameter d with wall-normal relative velocity U_n:

    La = ρ σ d / μ²            We = ρ U_n² d / σ

| Wall state | Condition | Outcome |
|---|---|---|
| Dry (δ < `deltaWet`) | We < We_c,dry = A_dry La^−0.183 | Absorb into film |
| Dry | otherwise | Splash; splashed mass ratio m* = 0.2 + 0.6 r |
| Wet | We < 2 | Absorb ("adhesion") |
| Wet | 2 ≤ We < 20 | Bounce: normal restitution ε = 0.993 − 1.76 θ + 1.56 θ² − 0.49 θ³ (θ = impingement angle from the surface, radians); tangential velocity x 5/7 |
| Wet | 20 ≤ We < We_c,wet = A_wet La^−0.183 | Absorb ("spread") |
| Wet | We ≥ We_c,wet | Splash; m* = 0.2 + 0.9 r (can exceed 1 by film entrainment) |

r is a uniform random number in [0,1]. Splash products: number of secondary drops per incident drop N_s = 5 (We/We_c − 1); mean secondary diameter d̄ = 6^(−1/3) (m*/N_s)^(1/3) d; sizes sampled from an exponential distribution truncated to [0.1 d_max, d_max] with d_max = 0.9 m*^(1/3) d; energy dissipated E_d = max(0.8 E_k,n , We_c π σ d² / 12); if kinetic + surface energy minus E_d and new surface energy is not positive the parcel is absorbed instead; tangential velocity of products scaled by C_f. Tutorial constants: `Adry 2630`, `Awet 1320`, `Cf 0.6`, `deltaWet 0.0005`, default 2 parcels per splash. [VERIFIED: `ThermoSurfaceFilm.C` and tutorial `splashPanel/constant/reactingCloud1Properties`, OpenFOAM-8.]

Worked example for a 1 mm drop of 55 °C wash liquor: La = 2.6e5, so We_c,dry = 268 and We_c,wet = 134; at U_n = 2 m/s We = 59 (absorbed), at 5 m/s We = 368 (splashes on both), at 8 m/s We = 941 [ESTIMATED from the formulas above]. So nearly every primary jet fragment splashes; nearly all falling secondary droplets are absorbed.

The coefficient A depends on wall roughness. Fluent's table for its Kuhnke-type model: roughness 0.05, 0.14, 0.84, 3.1, 12 μm gives A = 5264, 4534, 2634, 2056, 1322 [VERIFIED: Theory Guide section 12.9.3, table 12.2]. OpenFOAM's 2630 and 1320 are the 0.84 μm and 12 μm rows.

**Fluent's Stanton-Rutland / O'Rourke-Amsden variant.** Regimes stick, rebound, spread, splash from a dimensionless impact energy; stick below 16 [VERIFIED: section 12.9.3]; default 4 splashed parcels per impact (range 0 to 10) [VERIFIED]; secondary sizes from a Weibull fit to Mundo's data [VERIFIED]. The energy definition and splash threshold, from memory of O'Rourke and Amsden (SAE 2000-01-0271): E² = (ρ V_n² d/σ) / (min(h_0/d, 1) + δ_bl/d) with δ_bl = d/√Re; splash when E > 57.7; splashed fraction 1.8e-4 (E² − 57.7²) capped at 0.70 [RECALLED: not on the fetched page]. See the jets dossier for the choice between these.

**(b) Film to droplets: dripping (OpenFOAM).**

- `drippingInjection`: on faces where gravity has a component out of the wall, any thickness above a user `deltaStable` leaves as parcels with user-sampled diameters [VERIFIED: `drippingInjection.C`].
- `BrunDrippingInjection` (Rayleigh-Taylor under an incline, Brun et al. 2015): with capillary length l_c = sqrt(σ/(ρ g)) and s = ĝ·n (1 for a horizontal ceiling),

      δ_crit = max( 3 l_c sqrt(1 − s²) / (ū* s^1.5) , deltaStable ),   ū* = 1.62208
      drop diameter d = dCoeff · l_c ,   dCoeff = 3.3

  [VERIFIED: `BrunDrippingInjection.C/.H`]. For our liquid l_c = 2.6 mm, so drops are 8.7 mm; δ_crit is 0 for a horizontal ceiling, 2.5 mm at s = 0.9, 5.9 mm at s = 0.7 [ESTIMATED from the formula]. Consequence: tilted undersides essentially never drip from the face; water runs to the lowest edge or point. **An edge/rim pendant-drop model is therefore mandatory and does not exist in OpenFOAM** (see films dossier).

**(c) Film to droplets: separation at edges and curved surfaces.**

- `curvatureSeparation` (Owen and Ryley 1985). With local wall radius of curvature R_1 in the flow direction and R_2 = R_1 + δ:

      F_inertial = −(72/60) ρ δ |U|² / R_1
      F_body     = −0.5 ρ g (R_1² − R_2²) cos(φ) / R_1
      F_surface  = σ / R_2
      separate (all film mass in the cell is ejected) if F_inertial + F_body + F_surface < 0

  [VERIFIED: `curvatureSeparation.C`; φ is the angle term the code computes from flux direction and gravity.]
- Friedrich et al. 2008 force ratio (OpenFOAM.com `FriedrichModel`; one of Fluent's three options with Foucart and O'Rourke):

      F_ratio = ρ |u|² h sinθ / ( σ (1 + sinθ) + ρ g h L_b cosθ )
      L_b = 0.0388 h^0.5 Re^0.6 We^−0.5 ,  Re = h |u| ρ / μ ,  We = h ρ_gas (u_gas − u)² / (2σ)

  Separation if F_ratio > 1. Partial separation (Zhang et al. 2018): separated mass fraction = 0.882 − 1.908 exp(−F_ratio/1.264). [VERIFIED: https://api.openfoam.com/2412/classFoam_1_1filmSeparationModels_1_1FriedrichModel.html.] **Validity warning:** this was fitted to films driven by fast gas flow. In still air We is about 2e-3 and L_b evaluates to 0.6 m for a 0.3 mm, 1 m/s film [ESTIMATED], which is meaningless. Only the 90° corner case (where the L_b term drops out and the criterion reduces to ρ u² h / (2σ) > 1) is usable for us.
- O'Rourke and Amsden 1996: separation at a sharp corner of turning angle θ when

      c_sep ρ [(u_film − v_wall)·t]² sinθ / (1 + cosθ) > p_gas ,   c_sep = 3

  [VERIFIED: their eq. (15)]. At atmospheric pressure this needs 5.8 m/s at a 90° corner and 3.7 m/s at 135° [ESTIMATED]. Relevant only where a jet-driven radial film reaches a plate rim.
- Fluent EWF: separation needs both an edge angle above a critical value and a film Weber number above a minimum; the Friedrich option sheds an experimentally fitted fraction of the edge mass flux [VERIFIED: section 17.2.1].

**(d) Film to droplets: stripping by gas shear.** Fluent: Kelvin-Helmholtz wave growth (Mayer; Lopez de Bertodano), sheltering parameter 0.3, diameter coefficient 0.14, mass coefficient 0.5, gated by a critical shear stress [VERIFIED: section 17.2.1]. Irrelevant in a dishwasher (no fast gas).

**(e) Contact angle and the coefficient β.** Meredith et al. used a normal distribution of contact angle with mean 75° and standard deviation 10°, fixed per cell for the whole run; this random field is what breaks a uniform film into rivulets. β = 1.0 matched 45° and 90° inclines; β = 0.4 was shown for 5° [VERIFIED: sections 3.7, 5, 6]. The OpenFOAM `hotBoxes` tutorial uses `Ccf 0.085` with a normal distribution clipped to 50° to 100°, expectation 75, variance 100 [VERIFIED]. A factor of 12 between published β values tells you this is a grid-dependent calibration knob, not a material constant.

### 2.3 Known limitations (relevant to Spotless)

1. Thin-film assumptions fail in the first few jet diameters around a jet stagnation point (thickness comparable to jet radius, strong wall-normal flow) and in pools. Meredith lists surface-normal velocities and the breakdown of the parabolic profile in narrow rivulets as error sources [VERIFIED: section 5].
2. Capillary pressure as −σ∇²δ is valid only for small slopes [VERIFIED: section 3.1]; contact-line regions are far below grid resolution, hence β.
3. Published film validations are on grids of several millimetres (3.8 mm) and reproduce wetted-area fraction and transition flow rate, not rivulet paths.
4. The engine-derived separation and splash correlations were fitted to fuel sprays (drops of tens of micrometres at tens of m/s, fast gas). Dishwasher drops are 0.3 to 4 mm at 1 to 10 m/s in still air. Expect to recalibrate every one.
5. No production code has a low-speed edge-drip model, a pool (depression storage) model, or capillary bridging between adjacent objects. All three are everyday dishwasher phenomena.

---

## 3. Fully resolved 3D free-surface methods on a laptop GPU

### 3.1 How fast is the M3 Pro GPU for this class of code?

There is no published fluid-solver benchmark on an M3 Pro. The best anchor is FluidX3D (lattice Boltzmann, OpenCL, D3Q19, no extensions, 256^3 box), which is limited by memory bandwidth and lists other Apple chips:

| Device | FP32/FP32 | FP32/FP16S | Tag |
|---|---|---|---|
| Apple M1 Pro, 16-core GPU | 1204 MLUPs/s | 2329 | [VERIFIED] FluidX3D README |
| Apple M2 Pro, 19-core GPU | 1195 | 2374 | [VERIFIED] |
| Apple M1 Max, 24-core GPU | 2369 | 4496 | [VERIFIED] |
| Apple M5, 10-core GPU | 800 | 1596 | [VERIFIED] |
| NVIDIA GTX 1080 Ti | 2631 | 4837 | [VERIFIED] |
| NVIDIA RTX 2080 Ti | 3194 | 6700 | [VERIFIED] |
| NVIDIA Tesla V100 (PCIe 16 GB) | 5128 | 10325 | [VERIFIED] |
| NVIDIA RTX 3090 | 5418 | 10732 | [VERIFIED] |
| NVIDIA RTX 4090 | 5624 | 11091 | [VERIFIED] |
| **Apple M3 Pro, 14-core GPU (no row exists)** | **about 900** | **about 1750** | [ESTIMATED] M1 Pro value x 150/200, because M1 Pro and M2 Pro have 200 GB/s memory bandwidth and the M3 Pro 150 GB/s |

(MLUPs/s = million lattice-cell updates per second. Memory: 93 bytes/cell FP32, 55 bytes/cell with FP16 compression [VERIFIED].)

Scaling factors used below for bandwidth-bound kernels [ESTIMATED from the table]: M3 Pro is about 0.34 x GTX 1080 Ti, 0.28 x RTX 2080 Ti, 0.18 x V100, 0.16 x RTX 4090. Compute-bound kernels do a little better: the M3 Pro 14-core scores about level with the M1 Pro 16-core in Geekbench 6 Metal (about 65k to 68k) [RECALLED: search snippet]. A WebGPU/WGSL implementation without hand tuning will lose a further factor that I put at 1.5 to 3 [ESTIMATED; must be measured].

### 3.2 Published throughput by method

| Method | Published figure | Converted to particle- or cell-steps per second | Scaled to M3 Pro | Tag |
|---|---|---|---|---|
| Weakly compressible SPH (DualSPHysics, CUDA) | 23e9 particle interactions/s on RTX 2080 Ti with about 268 neighbours | 86 million particle-steps/s | 15 to 25 million/s native; 8 to 15 million/s in WGSL | figure [VERIFIED]; conversions [ESTIMATED: 23e9/268; x 0.28; / 1.5 to 3] |
| Implicit SPH (PreonLab) | 4.34 million particles, 1.52 s, 28 h on RTX 4090 | not derivable (time step not published) | The same case would need on the order of 170 h | [VERIFIED] figure; [ESTIMATED] 28 h / 0.16 |
| MLS-MPM in WGSL (WebGPU-Ocean demo) | about 100,000 particles in real time on integrated graphics, about 300,000 on "decent GPUs", 2 simulation steps per frame; P2G done with `atomicAdd` on fixed-point integers; SPH version managed 30,000 | 12 to 36 million particle-steps/s including rendering | 50 to 150 million/s for simulation only | figures [VERIFIED] https://github.com/matsuoka-601/WebGPU-Ocean; conversion [ESTIMATED: 1e5 x 2 x 60; M3 Pro several times faster than a laptop integrated GPU] |
| MLS-MPM in Taichi / CUDA on GTX 1080 Ti | One benchmark frame: Taichi 14.06 s, AsyncTaichi 10.63 s, Wang et al. 2020 5.00 s | If the frame is 16.8 million particles x 400 substeps (search snippet, not confirmed): 0.5e9, 0.6e9, 1.3e9 particle-steps/s | 0.15e9 to 0.45e9 native; less in WGSL | timings and GPU [VERIFIED] arXiv 2012.08141 table 1; particle count [RECALLED]; conversion [ESTIMATED] |
| MPM, hand-optimised CUDA (Fei et al. 2021) | 1.33 million particles at 68.5 frames/s on four Tesla V100, time step about 5.5e-4 s; using non-native shared atomics costs 3 to 5 x; disabling fast-math costs 3 to 13 % | about 0.7e9 particle-steps/s per V100 if a frame is 1/60 s | about 0.13e9 native | figures [VERIFIED] arXiv 2111.00699 (ar5iv); conversion [ESTIMATED] |
| Free-surface LBM | FluidX3D has a volume-of-fluid free-surface extension; no throughput with it enabled is published | Plain LBM figure above; assume 1 to 2.5 x slower with free surface | 350 to 1750 MLUPs/s | plain [VERIFIED]; penalty [ESTIMATED] |
| PBF, FLIP/APIC on sparse grids, DFSPH on GPU | Not found; the search was not completed | n/a | Treated as "same order as implicit SPH" below | **gap** |

### 3.3 Resolution actually required

| Feature | Size | Resolution needed for the physics | Why |
|---|---|---|---|
| Coherent jet | 2 to 4 mm diameter | 8 to 10 points across: **0.2 to 0.5 mm** | Fewer points and a jet numerically diffuses, breaks up or loses momentum; stagnation pressure and radial outflow are wrong [RECALLED rule of thumb; I could not fetch a convergence study] |
| Wall film | 0.1 to 1 mm thick | 3 to 5 points through the film: **0.02 to 0.3 mm** | Wall shear is 3μU/δ; it depends on the velocity profile inside the film |
| Secondary droplets | 0.3 to 3 mm | A droplet is 1 particle or cell at 1 mm | Then it is just a ballistic point mass with numerical noise, i.e. a worse Lagrangian parcel |
| Pools in concave items, sump | centimetres | 1 to 2 mm is adequate | Bulk free-surface flow: the one thing these methods do well |

Shear magnitudes for orientation [ESTIMATED from eq. (2.4) and the Nusselt film solution u = g δ²/(3ν), τ_w = ρ g δ on a vertical wall]: a draining film of 100 μm moves at 0.06 m/s with 1.0 Pa wall shear; 300 μm at 0.58 m/s with 2.9 Pa; under a jet, a radial film of 100 μm at 8 m/s gives 120 Pa. Bench cleaning tests in the thesis used 12 to 65 Pa [VERIFIED: table 7.6]. Draining films thicker than about 0.4 mm on a vertical wall exceed film Reynolds number Γ/μ = 900 (1590 at 0.5 mm) [ESTIMATED from the Nusselt solution] and are turbulent: Meredith quotes "not fully turbulent until Re_f = Γ/μ > 900" [VERIFIED: section 3.4]. The laminar law (2.4) under-predicts their shear.

### 3.4 Time-step limits

With maximum speed v = 10 m/s (jets are 5 to 12 m/s):

| Limit | Formula | 2 mm | 1 mm | 0.5 mm | 0.25 mm |
|---|---|---|---|---|---|
| Weakly compressible SPH (sound speed c = 10 v, smoothing length 1.3 dx) | 0.25 x 1.3 dx / (c + v) | 5.9e-6 s | 3.0e-6 s | 1.5e-6 s | 7.4e-7 s |
| Explicit weakly compressible MPM (grid spacing dx) | 0.4 dx / (c + v) | 7.3e-6 s | 3.6e-6 s | 1.8e-6 s | 9.1e-7 s |
| Incompressible SPH / FLIP (advective CFL 0.4) | 0.4 dx / v | 8.0e-5 s | 4.0e-5 s | 2.0e-5 s | 1.0e-5 s |
| Same at CFL 1 (PreonLab's claim) | dx / v | 2.0e-4 s | 1.0e-4 s | 5.0e-5 s | 2.5e-5 s |
| Free-surface LBM (lattice speed 0.1) | 0.1 dx / v | 2.0e-5 s | 1.0e-5 s | 5.0e-6 s | 2.5e-6 s |
| Explicit surface tension | sqrt(ρ dx³ / (2π σ)) | 4.3e-3 s | 1.5e-3 s | 5.4e-4 s | 1.9e-4 s |
| Explicit viscosity | 0.125 dx² / ν | 0.99 s | 0.25 s | 0.062 s | 0.015 s |

All [ESTIMATED] from the stated formulas, which are the standard stability bounds [RECALLED]. Advection (and, for explicit compressible methods, the artificial sound speed) is the binding limit everywhere; surface tension and viscosity are not. For LBM the relaxation time at 1 mm is 0.500015, so close to the stability limit of 0.5 that the scheme runs entirely on its sub-grid/limiter model: physical viscosity is not represented [ESTIMATED: τ = 0.5 + 3 ν dt/dx²].

### 3.5 What 30 minutes buys

Water inventory: I assume about 4 L in circulation, of which about 1 L is outside the sump at any instant (in jets, in flight, and on surfaces) [ESTIMATED: pump flow of order 0.5 to 1 L/s times about 1 s loop residence outside the sump; the machine dossier has the fill and flow data]. The sump would be a lumped model in any design.

| Method | Spacing | Elements | Time step | Assumed M3 Pro throughput | Simulated seconds in 1800 s |
|---|---|---|---|---|---|
| Free-surface LBM, whole tub | 2 mm | 20.6 million cells (1.1 GB) | 2.0e-5 s | 350 to 1750 MLUPs/s | 0.6 to 3.1 |
| Free-surface LBM, whole tub | 1 mm | 165 million cells (9.1 GB with FP16; 15.3 GB FP32) | 1.0e-5 s | same | 0.04 to 0.19 |
| Free-surface LBM | 0.5 mm | 1.3 billion cells (73 GB) | n/a | n/a | does not fit |
| Weakly compressible SPH, 1 L | 1 mm | 1 million particles | 3.0e-6 s | 20 million particle-steps/s | 0.11 |
| Implicit SPH, 1 L | 1 mm | 1 million | 4e-5 to 1e-4 s | 5 million particle-steps/s (pressure iterations cost about 4 x) | 0.36 to 0.9 |
| Implicit SPH, 1 L | 0.5 mm | 8 million | 2e-5 to 5e-5 s | same | 0.02 to 0.06 |
| MLS-MPM, 1 L, 8 particles per cell | 2 mm grid | 1 million particles | 7.3e-6 s | 50 to 150 million particle-steps/s | 0.65 to 2.0 |
| MLS-MPM, 1 L | 1 mm grid | 8 million particles | 3.6e-6 s | same | 0.04 to 0.12 |
| For scale: one arm revolution at 30 to 35 rpm | | | | | 1.7 to 2.0 |
| For scale: one wash cycle | | | | | 3600 to 9000 |

All rows [ESTIMATED]: simulated seconds = 1800 s x throughput / elements x time step. Four litres of particles instead of one divides the particle rows by four.

**Reading:** at 2 mm (jets 1 to 2 cells wide, films a tenth of a cell) the best case is one to one and a half revolutions. At 1 mm it is at most half a revolution (implicit SPH at CFL 1) and typically a tenth. The SPH rows use throughputs at the optimistic end of section 3.2, so they flatter the resolved methods. At the 0.25 mm needed for jets it is impossible by four to five orders of magnitude. This agrees with the industrial record in section 1: hours on a data-centre GPU per second of physical time at 0.5 to 1 mm.

### 3.6 What cannot be resolved, and the wall models that would be needed

If a 3D method were used anyway, at 1 to 2 mm it would need all of the following closures:

1. **Thin-film wall model.** Any liquid layer thinner than about 2 dx must be handed to a surface film solver that carries thickness and mean velocity and returns wall shear from (2.4) or a turbulent friction law. That is the film model of section 2: a 3D solver does not remove the need for it, it only replaces the Lagrangian parcels that feed it.
2. **Jet sub-grid model.** Jets narrower than about 8 dx must be carried as Lagrangian columns or parcels with a prescribed velocity profile and breakup length, then converted to resolved fluid only where they pool. Again the parcel model.
3. **Impingement-zone model.** Stagnation pressure distribution and the fast radial film (and its hydraulic jump) are below resolution and need an analytic or tabulated closure.
4. **Contact-angle and adhesion model** with per-material calibration (section 1.2).
5. **Droplet model** for anything smaller than about 3 dx.

So a fully resolved method on this hardware reduces to: a coarse bulk solver that adds value only for pools and thick sheets, wrapped around exactly the sub-models that make up architecture (a).

---

## 4. Multi-scale strategy

### 4.1 Time scales

| Process | Time scale | Tag |
|---|---|---|
| Jet transit nozzle to dish | 0.03 to 0.1 s | [ESTIMATED: 0.3 to 0.5 m at 5 to 10 m/s] |
| Jet footprint crossing a point | 3 to 8 ms per pass | [ESTIMATED: 3 mm jet, sweep speed ω r = 0.37 to 0.92 m/s at r = 0.1 to 0.25 m, 35 rpm] |
| Direct impact time on a tile per revolution | 1.3 ms and 27 ms for two jets (0.07 % and 1.59 % of the revolution) | [VERIFIED: thesis table 7.5] |
| Arm revolution | 1.7 to 2.0 s (35 rpm measured; 30 rpm "typical") | [VERIFIED: thesis sections 5 and 7.3] |
| Film drainage off a plate | 0.1 to 1 s | [ESTIMATED: 0.25 m at 0.3 to 0.6 m/s]; the IChemE summary of the PEPT work quotes about 0.1 s run-off [RECALLED: search snippet] |
| Pool filling (cup base, bowl) | 10 to 100 s | [ESTIMATED: 50 to 300 mL at a few mL/s] |
| Soil swelling lag | 0.4 to 33 min | [VERIFIED: thesis table 7.6, t_lag column] |
| Soil removal | 3 to 134 μm/min, i.e. minutes to an hour for a layer | [VERIFIED: thesis table 7.6, k_ds and k_ss columns] |
| Bulk temperature, chemistry | minutes | machine and chemistry dossiers |

The scale-separation parameter is ε = (revolution period)/(soil time) = 2 s / (300 to 3000 s) = 7e-4 to 7e-3 [ESTIMATED]. This is the regime in which averaging methods are accurate.

### 4.2 Periodic steady state and exposure statistics

With the geometry fixed, hydraulics steady, and each arm rotating at constant speed, the forcing on every surface element is periodic in each arm's phase φ_a. Two consequences.

**(i) Jets and first-impact fluxes need no time integration at all.** They are a function of phase. For nozzle k, phase φ and a sample point ξ in the jet cross-section, trace one path to its first hit. Sampling φ uniformly over [0, 2π) gives a Monte Carlo estimate of every time-average. The sample count needed for the footprint to be contiguous on the surface is set by sweep distance per sample: 2π r / (0.75 mm) = 840 to 2100 phases per revolution for r = 0.1 to 0.25 m [ESTIMATED]. With about 30 nozzles, 4096 phases and 64 rays per jet cross-section that is 7.9 million primary paths: seconds of GPU time (section 5.1).

**(ii) Films, drips and secondary rain do have memory, but only seconds of it.** Run the coupled parcel + film system in the time domain for N_spin revolutions until statistics repeat, then average over N_avg revolutions. Convergence test per hydraulic state: relative L2 change of the per-element time-averaged wall shear and wet fraction between successive revolutions below 5 %. I expect N_spin = 3 to 5 and N_avg = 2 [ESTIMATED from a drainage time under 1 s; to be confirmed by experiment]. Arms with incommensurate periods make the forcing quasi-periodic; averaging over more revolutions handles it. Many machines alternate arms, which is exactly periodic per state (see machine dossier).

**What to store per surface element** (the "exposure record"). A mean is not enough because soil removal is threshold-like in stress. Store, per hydraulic state:

| Quantity | Form | Purpose |
|---|---|---|
| Exceedance curve of wall shear stress: fraction of time with τ_w above each of K thresholds | K = 12 log-spaced levels, 0.1 to 300 Pa, 16-bit each | Adhesive/cohesive removal with a soil-dependent, time-varying threshold |
| Exceedance curve of impact (stagnation) pressure | K = 8 log-spaced levels, 10 Pa to 100 kPa | Impact-driven removal, splash erosion |
| Wet fraction (film present) and mean film thickness | 2 values | Soaking, heat and mass transfer, chemistry supply |
| Mean and mean-square film speed; mean liquid renewal rate (kg/(m2 s) of fresh liquor arriving) | 3 values | Mass-transfer coefficient, redeposition, rinse |
| Direct-hit list: (arm, phase interval, peak stress) for each pass | run-length list, usually 0 to 4 entries | Micro-solver for history effects (4.3) |
| Liquid source split: direct jet / splash / drip / film inflow | 4 values | Diagnostics, player report, redeposition routing |

The thesis' "frequency factor" is the K = 1 special case of the first row.

### 4.3 Homogenising the slow soil equations

Let s_i be the soil state of element i (layer thickness, moisture profile, bond strength, temperature) and y_i(t) the fast forcing. The full problem is ds/dt = F(s, y(t), c(t)) with c the slowly varying bulk state (temperature, chemistry).

**Level 1: first-order averaging.** Replace by

    dS/dt = F̄(S, c) = (1/T_p) ∫_0^{T_p} F(S, y(t), c) dt

For F of the form Σ_m r_m(S, c) · 1[τ_w(t) > τ_c,m(S)] + r_0(S, c) · wet(t), the average is Σ_m r_m(S, c) · E_τ(τ_c,m(S)) + r_0 · (wet fraction), where E_τ is the stored exceedance curve interpolated at the current threshold. The error of first-order averaging is O(ε) over times of order T_p/ε, i.e. below 1 % of the state here, provided F is Lipschitz in s on the fast scale [RECALLED: classical averaging theorem, Sanders, Verhulst and Murdock]. This is the default.

**Level 2: heterogeneous multiscale / projective step for history-dependent response.** Some removal is not a function of the instantaneous state: the surface layer re-hydrates between hits and comes off in a burst at the next hit; enzyme delivered at impact is consumed or washed out before the next one (the thesis argues exactly this for the 1.7 s re-impact interval [VERIFIED: thesis chapter 7, p. 172]). For elements with a non-empty direct-hit list:

1. Micro-solve: integrate the full soil equations through one (or two) real revolutions with the hit sequence resolved (sub-steps of about 1 ms during a hit, 50 ms between hits).
2. Estimate the slow rate F̃ = (s(t + T_p) − s(t)) / T_p.
3. Macro-step: S(t + Δt) = S(t) + Δt F̃ (or a second-order variant using a second micro-solve at t + Δt).

This is the heterogeneous multiscale method (E and Engquist 2003) and equivalently projective integration (Gear and Kevrekidis 2003) [RECALLED]; in fatigue and wear simulation the same thing is called a cycle jump (Cojocaru and Karlsson 2006: detailed analysis of a few cycles, trend extrapolation over many, with a control function limiting the jump) [RECALLED: search snippet; doi:10.1016/j.ijfatigue.2006.01.010]. Oskay and Fish 2004 note the weakness of naive cycle jumping: the governing equations are not guaranteed to be satisfied during the jump, which is what the control below is for [RECALLED: search snippet].

**Error control for the macro step** (my proposal, in the spirit of the cited control functions):

- Jump length: Δt = min over state components of q · (|S_j| + S_floor,j) / |F̃_j|, with q = 0.03, clipped to [1 s, 30 s].
- Consistency: after the jump, redo the micro-solve; if |F̃_new − F̃_old| > η (|F̃_old| + rate floor) with η = 0.3, halve Δt for that element class and redo.
- Events force a step boundary: layer thickness reaching zero, threshold crossings of bond strength against the largest stored stress level, phase changes of the programme (drain, fill, heater on), pool overflow.
- Global check (cheap and worth doing once per level in development): run a full no-jump integration on a 1 % random subset of elements and compare final cleanliness.

All numerical values in this list are [ESTIMATED] defaults to be tuned.

### 4.4 When one-way coupling is valid

| Coupling | Valid to neglect? | Treatment |
|---|---|---|
| Air on jets and drops | Drag only. Density ratio is about 900, so air entrainment does not steer the liquid | Drag law in the parcel integrator (jets dossier) |
| Film back onto jets | No direct effect | None |
| Film to droplets (drips, edge shedding) and back to films below | **Not negligible**: this is how the lower rack is rained on and how shadowed surfaces get wet | Co-simulate parcels and film in time (4.2 ii) |
| Falling water on rising jets | Second order but real. Mean liquid volume fraction outside the sump is about 0.3 L / 165 L = 0.2 %; if a tenth of that is millimetre rain, a drop sees a few collisions per second | Mean-field interception: accumulate rain number-density on a coarse 3D grid (1 cm), attenuate each jet's coherent fraction by exp(−∫ n σ_c ds), convert the rest to droplets. [ESTIMATED; collision rate n π d² v with n = 3.8e5 /m3, d = 1 mm, v = 3 m/s gives 3.6 /s] |
| Soil on flow | Soil thickness (10 to 500 μm) is comparable to film thickness, and soil changes contact angle | Roughness/contact-angle fields on the film solver updated at hydrodynamic refresh points |
| Removed soil on liquor | Slow | Bulk concentration state in the macro loop (chemistry dossier) |
| Jets on item positions | A 3 mm, 8 m/s jet delivers about 0.45 N [ESTIMATED: ρ (π d²/4) v²]; a 30 g plastic cup weighs 0.3 N | Per item, compare time-resolved jet force and torque with weight and support; if exceeded, hand to the rigid-body engine and recompute exposure (items dossier) |

### 4.5 Slow drifts and when to refresh the hydrodynamics

| Drift | Effect | Refresh rule |
|---|---|---|
| Temperature 20 to 65 °C | Viscosity falls by about half; draining-film thickness and shear scale as ν^(1/3), about 20 %; jet breakup changes weakly | Compute film statistics at 3 temperatures per hydraulic state, warm-starting each from the previous periodic state (2 revolutions each), and interpolate exposure records in log ν |
| Detergent dosing, soil load | Surface tension and contact angle drop, foam | One refresh after detergent release |
| Pools filling | Concave items go from "film" to "pool"; overflow starts new drip sources | Lumped fill equation dV/dt = Q_in − Q_out(V) per closed basin of each surface (basins found once by a watershed pass on the mesh relative to gravity). Recompute drip sources when a basin first overflows; the film solve then runs with basins full, which is the periodic state |
| Soil removal changing wetting | Dry patches appear or vanish on previously greasy areas | Refresh when the cleaned-area fraction of any item changes by more than 20 % since the last refresh, capped at 2 extra refreshes |
| Pump pressure or arm speed change, alternating arms | Different jets | Each is a separate hydraulic state with its own exposure record |
| Item moved by jets | Geometry changed | Full recompute for affected arms; expected to be rare |

---

## 5. Geometry, acceleration structures and surface discretisation on the GPU

### 5.1 Tracing parcels against 1 to 10 million triangles

**Published software (non-hardware) GPU traversal rates.** Ylitie, Karras and Laine 2017, NVIDIA Titan X (Pascal), scenes of 1.3 to 12.8 million triangles (Veyron, Bubs, SodaHall, Hairball, PipersAlley, Enchanted, SanMiguel, Powerplant):

| Structure | Primary (coherent) rays | First diffuse bounce (incoherent) | Node memory |
|---|---|---|---|
| Binary BVH, Aila et al. 2012 baseline | 282 to 1203 Mrays/s | 83 to 414 Mrays/s | 18.6 to 24.1 bytes/triangle |
| 8-wide compressed BVH ("CWBVH") | 322 to 2251 Mrays/s | 204 to 1158 Mrays/s | 7.7 to 8.6 bytes/triangle |

Triangle data adds 48 bytes per triangle in their layout. For the 10.5 million triangle scene specifically: 423 to 629 Mrays/s primary, 118 to 311 incoherent. [VERIFIED: Ylitie et al. 2017, tables 4 and 6, https://research.nvidia.com/sites/default/files/publications/ylitie2017hpg-paper.pdf]

Scaled to the M3 Pro (x 0.34 for a 1080 Ti-class card, then / 1.5 to 3 for portable WGSL): **roughly 30 to 150 million segment queries per second** on a 5 to 10 million triangle load; I plan with **50 million/s** [ESTIMATED]. Parcel path segments are short (centimetres), which terminates traversal early and should put real performance at the upper end. This number is the single most important thing to benchmark first (section 8).

**Build.** Geometry is static during a wash, so build quality matters more than build speed. Build a SAH BVH on the CPU P-cores once per load, collapse to 8-wide compressed nodes, upload. LBVH (Morton sort plus Karras' fully parallel radix-tree construction [VERIFIED abstract: Karras 2012]) is the fallback if items must be re-fitted often; it builds on the GPU but traverses slower.

**Structure.** Two levels: one bottom-level BVH per item mesh (cached with the asset, in the item's local frame) and a small top-level BVH over item instances, rebuilt in microseconds whenever the player moves something. The spray arms are instances whose transform is a function of phase, so they act as moving obstacles for falling water at no extra cost.

**Traversal in WGSL.** WGSL has no recursion; use an explicit fixed-size stack in a function-local array (24 to 32 entries for a wide BVH) or a stackless "threaded" layout with hit/miss links for the binary fallback. Use a watertight ray-triangle test so parcels cannot leak through shared edges [RECALLED: Woop, Benthin and Wald 2013].

**Curved paths.** Integrate ballistic motion with drag in segments whose chord sag a Δt²/8 stays below 0.1 mm: Δt ≤ 9 ms for 10 m/s² acceleration, i.e. 7 cm segments at 8 m/s and 0.9 cm at 1 m/s [ESTIMATED]. Typical paths need 5 to 30 segment queries.

**Hardware ray tracing.** The M3 Pro GPU has hardware-accelerated ray tracing [VERIFIED: Apple specs] but WebGPU exposes no ray-tracing API [RECALLED]. wgpu has an experimental ray-query extension; I could not confirm it works on the Metal backend [RECALLED: search snippet of wgpu docs; open question]. Design the intersector behind one interface (`segment batch in, hit records out`) so a native Metal acceleration-structure path can be swapped in later.

### 5.2 Signed-distance fields

Memory for a 16-bit quantised distance field over the tub [ESTIMATED: dense = 0.165 m3/dx³; narrow band of ±3 voxels = 6 A/dx² with wetted area A = 8.5 m², see 5.3]:

| Voxel | Dense | Narrow band (plus index overhead) | Thinnest wall representable (≥ 2 to 3 voxels) |
|---|---|---|---|
| 1 mm | 165 million voxels, 0.33 GB | 51 million, 0.10 GB | 2 to 3 mm: fails on glass walls, fork tines, knife blades |
| 0.5 mm | 1.32 billion, 2.6 GB | 204 million, 0.41 GB | 1 to 1.5 mm: marginal |
| 0.25 mm | 10.6 billion, 21 GB | 816 million, 1.6 GB | 0.5 to 0.75 mm: adequate, but heavy |

Verdict: an SDF cannot be the primary collision representation for parcels. Walls of 1 to 4 mm and 3 to 5 mm wires need 0.25 mm voxels to avoid sign errors and tunnelling, and an exact triangle test costs less. Keep a 0.5 mm sparse narrow-band SDF only as an auxiliary field: droplet-radius clearance, gap width between neighbouring surfaces (capillary bridging and "nested items" detection), and visibility heuristics for the UI. Rigid-body contact has its own representation (items dossier).

### 5.3 Where film and soil state lives

Wetted area estimate: tub walls 1.81 m² [ESTIMATED: 2(0.55x0.60 + 0.50x0.60 + 0.55x0.50)]; racks about 1.1 m² (about 100 m of 3.5 mm wire); a full load about 5.5 m² (both faces); total about 8.5 m² [ESTIMATED; the items dossier should replace this]. Cell counts: 34 million squares or 78 million triangles at 0.5 mm; 8.5 million squares or 19.6 million triangles at 1 mm; 2.1 million squares or 4.9 million triangles at 2 mm.

| Option | Accuracy | Conservation | GPU friendliness | Visualisation | Verdict |
|---|---|---|---|---|---|
| UV texture atlas | Second order inside a chart if a metric tensor is stored per texel; degraded at seams and in distorted charts | Needs explicit flux matching between paired seam texels; easy to get wrong | Best: regular 2D stencils, coherent memory | Trivial: it is a texture | Poor fit for wires, rims, cutlery (hundreds of sliver charts); seam bookkeeping dominates the code |
| **Finite volume on an isotropic triangle mesh (finite-area method)** | First to second order; quality tied to remeshing quality | Exact by construction (edge fluxes cancel) | Good: each triangle gathers from 3 neighbours, no scatter; needs space-filling-curve ordering for memory locality | Per-triangle or per-vertex colour | **Recommended.** The same triangles are the BVH primitives, so a parcel hit identifies its film cell with no reprojection. This is what OpenFOAM's finite-area film solver does |
| Surfels / point cloud | Depends on neighbour stencils; meshless operators are noisy | Not exact | Neighbour search needed | Splatting | Fine for soil state alone (purely local), poor for film transport |
| Narrow-band voxel shell | First order; thin walls merge front and back faces unless very fine | Exact with finite volumes in the band | Sparse 3D structure; 5 to 10 x more cells than a surface mesh | Needs extraction | The only option that naturally bridges gaps between touching items; too costly as the primary store. Use the auxiliary SDF of 5.2 to detect bridges and add explicit links between triangles instead |

Recommended meshing (done offline per catalogue item, not at wash time): isotropic remesh at 0.75 to 1.0 mm edge on food-contact faces and 2 to 3 mm elsewhere, giving about 9 million triangles for a full machine [ESTIMATED: 3 m² at 1 mm = 6.9 million; 5.5 m² at 2.5 mm = 2.0 million]. Momentum is stored in each triangle's tangent frame and rotated across each edge by the hinge unfolding. Soil state needs no neighbour coupling and may be subdivided 1:4 inside each film triangle where finer soil patterns matter.

Parcel deposition is a scatter (many parcels to one triangle). Do it with `atomicAdd` on fixed-point integers (for example mass in units of 1e-9 kg, impulse in 1e-9 N s). Integer addition is associative, so the result is independent of thread order, which also makes it bit-reproducible (section 6.2).

---

## 6. Practicalities

### 6.1 WebGPU and WGSL constraints

| Constraint | Value | Consequence | Tag |
|---|---|---|---|
| Default `maxBufferSize` | 268,435,456 bytes (256 MiB) | Request the adapter's real limit at device creation; split fields over several buffers regardless | [VERIFIED] MDN GPUSupportedLimits |
| Default `maxStorageBufferBindingSize` | 134,217,728 bytes (128 MiB) | Same; a 9 million triangle field of 16 bytes/cell is 144 MB and already exceeds the default | [VERIFIED] MDN |
| `maxStorageBuffersPerShaderStage` | 8 | Pack state into few wide buffers; plan kernels around at most 8 bindings | [VERIFIED] MDN |
| `maxComputeWorkgroupsPerDimension`, `maxComputeInvocationsPerWorkgroup` | 65,535; 256 | 16.7 million elements per 1D dispatch; use 2D dispatch indexing or chunking beyond that | [VERIFIED] MDN |
| `maxTextureDimension3D` | 2048 | A dense 0.25 mm SDF (2200 x 2000 x 2400) does not fit a 3D texture | [VERIFIED] MDN |
| Floating-point types | f32; f16 only with the optional `shader-f16` feature and `enable f16;`; no f64 | All state in f32; see 6.3 | [VERIFIED] WGSL spec source |
| Atomics | An atomic type "encapsulates a concrete integer type"; only in mutable storage buffers or workgroup variables | No float atomics: use fixed-point accumulation or sort-and-reduce | [VERIFIED] WGSL spec, Atomic Types |
| Ray tracing | Not in core WebGPU | Software BVH in compute shaders | [RECALLED] |
| Adapter limits on Apple silicon | Typically multi-gigabyte buffer and binding limits | Must be queried at start-up; do not assume | [RECALLED] |

Run natively (wgpu or Dawn embedded in a desktop app), not in a browser tab: no background-tab throttling, direct file I/O for checkpoints, and control over device limits. Keep every dispatch short (under about 20 ms) so the compositor and the progress UI stay responsive, and so a checkpoint can be taken between any two dispatches.

### 6.2 Determinism and reproducibility

A benchmark needs the same loading to give the same score. What breaks bitwise reproducibility, and what to do:

| Threat | Detail | Mitigation |
|---|---|---|
| Compiler freedom in WGSL | "An implementation may reassociate operations" and "may fuse operations if the transformed expression is at least as accurate"; `fma` itself may or may not be fused; division is only 2.5 ULP; exp is (3 + 2|x|) ULP; subnormals may be flushed to zero [VERIFIED: WGSL spec source, sections Floating Point Accuracy and Reassociation and Fusion] | Results are reproducible only for a fixed (shader source, shader compiler, OS, GPU family) tuple. Pin the wgpu/Dawn version; record the tuple in every result file. Do not promise cross-machine bit equality |
| Unordered floating-point accumulation | Any float scatter through compare-exchange loops, or reductions whose tree depends on scheduling | Integer fixed-point `atomicAdd` (order-independent), or sort by (target, source id) then reduce in fixed order |
| Random numbers | Sequential generators shared between threads | Counter-based generator: hash(seed, nozzle, phase index, sample index, bounce index). No state |
| Wall-clock-dependent control flow | Adaptive quality driven by measured speed or thermal state would change results between runs | Choose the quality tier **before** the run from a fixed calibration benchmark; inside a run every loop count is fixed or driven by simulated quantities only |
| Transcendentals | sin, cos, exp, pow differ between GPU families within the allowed ULP bounds | Keep them out of feedback loops where possible; tabulate soil kinetics rate functions on the CPU and sample tables on the GPU |
| CPU side | Thread-count-dependent reductions; fused multiply-add contraction; different math libraries | Fixed partitioning; contraction off for the scoring path; no fast-math |
| Metal shader fast-math | Metal compiles shaders with fast-math enabled by default unless the host disables it [RECALLED]; whether the chosen WebGPU implementation disables it is unverified | **Open question**; check and force precise mode |

Realistic target: **bit-identical repeat runs on one machine and software stack; statistically equivalent across machines.** To make the second acceptable for scoring, the clean/not-clean decision should have a dead band, and the report should flag items whose residual soil is within the cross-machine tolerance of the threshold (benchmark dossier). If strict cross-machine determinism is later required, the scoring run has to execute on one reference configuration.

### 6.3 Numerical precision in f32

| Quantity | Issue | Tag | Remedy |
|---|---|---|---|
| Simulated time | f32 spacing at t = 1800 s is 1.2e-4 s and at 7200 s is 4.9e-4 s: comparable to or larger than film time steps | [ESTIMATED: ULP computed] | Never accumulate time in f32. Keep an integer step counter; compute arm phase as (integer step mod steps-per-revolution) |
| Position | f32 spacing at 0.6 m is 8e-8 m | [ESTIMATED] | Fine for tracing; use item-local coordinates inside bottom-level BVHs |
| Film thickness | Spacing at 0.3 mm is 4e-11 m; increments smaller than half of that are lost, so nearly dry, slowly draining films freeze numerically at micrometre thickness | [ESTIMATED] | Acceptable (such films are handed to the drying model). Use flux-form updates so the loss is symmetric and mass is still conserved pairwise; do not rely on compensated (Kahan) summation, since the compiler is allowed to reassociate it away |
| Stiff wall friction | Rate 3ν/δ² is 150 /s at 100 μm and 15,000 /s at 10 μm | [ESTIMATED] | Treat friction pointwise-implicitly (as OpenFOAM does with `fvm::Sp`) |
| Explicit capillary term in lubrication form | Stable step 3 μ dx⁴/(16 σ δ³): 5e-5 s at 1 mm cells and 0.3 mm film, 1.4e-6 s for a 1 mm film | [ESTIMATED] | Only apply the capillary term to thin films (δ < 0.3 mm) and treat thick liquid as pools (4.5); or make the term semi-implicit |
| Exposure statistics | Averages over 1e3 to 1e4 time samples | | Accumulate counts as integers; convert once at the end |

### 6.4 Thermal throttling and sustained performance

I could not obtain a sustained-load measurement for the 14-inch M3 Pro (the Notebookcheck review returned 403 and no further search was made). Nearest data point: the base 14-inch M3 lost about 5 to 6 % of its Cinebench R23 multi-core score over a 30-minute loop (10,471 first run, 9,890 average) [RECALLED: search snippet of the LaptopMedia review; different chip]. The 11-core M3 Pro model ships with a 70 W adapter [VERIFIED: Apple specs], so the adapter is not the limit.

Engineering rules until measured:

- Size the nominal job to 24 to 25 minutes on a cold machine, leaving 15 to 20 % for throttling, background load and variance, so that the 95th percentile stays under 30 minutes [ESTIMATED margin].
- Calibrate quality tiers with a 60 to 90 s benchmark run **after** a warm-up, not cold.
- Refuse (or warn loudly) when macOS Low Power Mode is on or the machine is on a low battery; hold a power assertion so the system does not sleep; subscribe to the OS thermal-state notification and log it in the result file (it must not change the computation, see 6.2).
- Put CPU work on performance cores only; leave efficiency cores for I/O, compression and UI.

### 6.5 Progress reporting and checkpointing

- Structure the job as a fixed list of stages, each a fixed number of work units known in advance (phase samples, film steps, macro steps). Progress is then exact, and the time estimate is (remaining units) x (measured seconds per unit of that stage).
- Checkpoint at stage boundaries and every 60 to 120 s inside long stages. State is 2 to 4 GB; with compression on efficiency cores and an NVMe disk this costs about a second [ESTIMATED]. Write to a temporary file and rename atomically; keep the last two.
- Every checkpoint and result carries: a hash of geometry and poses, all model parameters, quality tier, random seed, software versions and GPU identity. Resume only if all match.
- Cache exposure records under the hash of (geometry, poses, hydraulic state, quality tier). If the player reruns the same load with a different programme, the whole hydrodynamic half of the job is skipped.
- Stream partial results to the 3D view while running (the exposure map filling in, then soil thinning). It is free and makes a 30-minute wait tolerable.

---

## 7. Ranked recommendation and compute budget

### 7.1 Ranking

**1. Architecture (a), the hybrid multi-scale model, with closure tables generated offline by resolved simulation. Recommended.**

- It is the only candidate that covers the whole cycle. Section 3.5 shows a resolved method reaches about one arm revolution at a resolution that still cannot see jets or films.
- It puts resolution where cleaning is decided: sub-millimetre shadowing geometry (exact triangle tests), per-element exposure statistics, and the film on the surface. Section 3.6 shows a resolved method needs these same sub-models as wall closures anyway.
- Its components all have validated production precedents (section 2), and the only published dishwasher cleaning prediction is a crude form of it (section 1.1).
- Dilute droplets and coherent jets are represented *more* accurately as ballistic parcels than as 1 to 2 mm particles or cells.
- Its weak points are known and local: the jet stagnation zone, edge dripping, pools in concave items, capillary bridges, and water-on-jet interference. Each gets a dedicated sub-model with calibration parameters.

**2. Architecture (c): (a) plus small resolved 3D patches at run time.** Worth adding only if calibration shows the lumped pool model is inadequate for score-relevant cases (for example an upright bowl that fills and is stirred by a jet). A patch of 50 to 300 mL on a 2 mm grid with MLS-MPM costs about 50 to 800 s of wall time per simulated second [ESTIMATED: section 3.5 gives 900 to 2800 s per simulated second per litre], so the budget allows one or two patches of a few tenths of a second each. Keep 250 s in reserve for this; spend it on more film revolutions otherwise.

**3. Architecture (b), fully resolved.** Not viable as the run-time engine on this hardware. Its proper role is offline: long runs on larger machines (or overnight on the laptop) of single sub-problems, such as one nozzle at 0.1 to 0.2 mm, one jet on one plate, one cup filling, to generate and check the closure tables for (a), and a handful of whole-tub runs at 2 mm as a sanity check of rain distribution.

### 7.2 Compute budget for one wash (nominal 1500 s on a warm machine; hard cap 1800 s)

Planning throughputs, all [ESTIMATED] and all to be replaced by measurements (section 8, risk 1): 50 million BVH segment queries/s; 150 million film cell-steps/s (finite-volume triangle update with two-stage time stepping; bandwidth bound is roughly 150 GB/s / 136 bytes per update / 2 stages = 550 million/s, derated for irregular access); 300 million soil node-updates/s.

| Stage | Content | Resolution | Work | Seconds |
|---|---|---|---|---|
| A. Set-up | Load cached per-item BVHs and film meshes; top-level BVH; basin (pool) analysis; bridge links; allocate about 6 GB | 9 million triangles | | 40 |
| B. Hydraulics | Lumped pump, manifold, arm and nozzle network; arm speed from reaction torque; per hydraulic state | ODE | | 5 |
| C. Primary jets | Monte Carlo over arm phase | 30 nozzles x 4096 phases x 64 rays x about 8 segments x 2 to 3 states | 0.2 billion queries | 10 |
| D. Impingement footprints | Stagnation-zone and radial-film closure evaluated per (nozzle, phase) and splatted to exceedance histograms | about 6500 triangles per footprint | 1 to 2 billion integer splats | 30 |
| E. Coupled film + secondary droplets, time domain | Per state: 3 spin-up + 2 averaging revolutions at the first temperature, then 1 + 1 at each of two more; 2 states; about 32 simulated seconds | 9 million film cells, base step 5e-4 s, 5 local time-step levels, about 15 % of cell-steps active; 10 million secondary parcels per simulated second | 86 billion cell-steps; 5 billion queries | 560 + 100 |
| F. Soil kinetics over the full cycle | Level 1 averaged integration for all soiled cells; Level 2 micro-solves for cells with direct hits | 6.9 million soil cells x 8 through-thickness nodes; about 1500 adaptive macro steps; Level 2 on about 10 % of cells with about 300 longer jumps x 40 sub-steps | 83 + 66 billion node-updates | 420 |
| G. Rinse, redeposition, drying, scoring, report | Reuses exposure records | | | 40 |
| H. Checkpoints, I/O, live visualisation | | | | 45 |
| Reserve | Resolved patches (option c) or extra film revolutions / finer film | | | 250 |
| **Total nominal** | | | | **1500** |
| Margin to cap | Throttling, variance, background load | | | 300 |

Derivations [ESTIMATED]: E film = 9e6 cells x 2000 steps/s x 0.15 x 32 s = 8.6e10 cell-steps / 1.5e8 per s = 576 s; E parcels = 1e7 parcels/s x 15 segments x 32 s = 4.8e9 queries / 5e7 per s = 96 s; F level 1 = 6.9e6 x 8 x 1500 = 8.3e10, level 2 = 6.9e5 x 8 x 40 x 300 = 6.6e10, together 1.5e11 / 3e8 per s = 497 s (rounded down assuming event-driven skipping of finished cells).

**The split in one line:** about 45 % of the time on film and droplet hydrodynamics, 30 % on soil, 3 % on jets, the rest on reserve and overhead. Jets are cheap because periodicity removes their time dimension; the film is expensive because it is the one fast process with memory that must be time-stepped on a fine surface mesh.

**Quality tiers** (chosen before the run, never during it):

| Tier | Film mesh on food-contact faces | Revolutions per state (spin-up + average) | Soil nodes | Target time |
|---|---|---|---|---|
| Preview | 2 mm | 1 + 1, one temperature | 4, level 1 only | about 2 min |
| Standard | 1.5 mm | 2 + 1, two temperatures | 6 | about 10 min |
| Reference (scoring) | 0.75 to 1 mm | 3 + 2, three temperatures | 8, levels 1 and 2 | about 25 min |

---

## 8. Top risks and how to de-risk each

| # | Risk | Why it matters | De-risking action |
|---|---|---|---|
| 1 | My throughput figures are extrapolations (no M3 Pro, WGSL, unstructured-mesh data exists) and could be off by 2 to 4 x | The whole budget table scales with them | First week: four micro-benchmarks on the target laptop in WGSL: (i) wide-BVH segment queries on a 9 million triangle load; (ii) one finite-volume film step on 9 million triangles in space-filling-curve order; (iii) soil node-update kernel; (iv) integer `atomicAdd` splat rate. Re-derive the budget from the results; the tier table absorbs up to about 3 x |
| 2 | Sub-model error, not numerical error, dominates: stagnation zone, splash, edge drips, contact line | A beautifully converged solve of the wrong closure is still wrong | Unit validation against canonical experiments before integration: Nusselt film; radial film and hydraulic-jump radius under a vertical jet; inclined-plate rivulet transition and wetted-area fraction (Meredith data in section 1.2); single jet on a tilted plate against an offline 0.1 to 0.2 mm resolved run. Then the owner's real-machine tests |
| 3 | Periodic steady state is not reached or does not exist (pools, wandering rivulets, incommensurate arms, items moved by jets) | Exposure records would be biased | Convergence monitor per state with a hard report; lumped pools; more averaging revolutions from the reserve; item force check with rigid-body hand-off |
| 4 | Time-homogenisation error for threshold-like or burst-like soils | Scores hinge on borderline items | Level 2 micro-solves; development-time audit against brute-force integration on a 1 % sample; single-element tests of the jump controller against an exact pulsed-forcing solution |
| 5 | Results differ across machines or OS updates | Benchmark comparability | Pin the GPU software stack; integer accumulation; counter-based random numbers; dead-band scoring; record the full provenance tuple; decide early whether official scores run on one reference configuration |
| 6 | Too many calibration parameters for the data that real tests will provide | Unidentifiable model | Global sensitivity analysis of item scores to every parameter in section 10 before the test campaign is designed; measure the top five first |
| 7 | 30-minute 95th percentile missed through throttling or memory pressure | Hard requirement | Nominal 25 minutes; pre-run tier calibration when warm; 20 consecutive reference-tier runs on the target laptop as an acceptance test; GPU memory budget 6 GB |
| 8 | Asset pipeline: bad triangles in film meshes at rims, tines and wires | Film solver instability and time-step collapse | Automated mesh-quality gates at import (minimum angle, edge-length ratio, manifoldness); per-item film smoke test |
| 9 | Unverified platform facts: ray queries through wgpu on Metal; Metal fast-math behaviour under the chosen WebGPU implementation; actual adapter limits | Could change implementation choices | One-day spike each; none blocks the architecture because software BVH and f32 are the baseline |

---

## Recommended model and defaults

What I would implement, with defaults. Items owned by sibling dossiers are marked.

**Pipeline**

1. Lumped hydraulics per hydraulic state gives nozzle flow, velocity and arm speed (machine dossier).
2. Phase-sampled jet tracing against a two-level, 8-wide compressed BVH of the exact triangle meshes. Defaults: 4096 uniformly stratified phases per nozzle per state; 64 rays per jet cross-section; path segments with chord sag under 0.1 mm; counter-based random numbers keyed on (seed, nozzle, phase, ray, bounce).
3. Impact handling per hit: regime by Laplace and Weber number as in section 2.2(a), defaults A_dry = 2630, A_wet = 1320, exponent −0.183, wet-wall thresholds We = 2 and 20, splashed-mass ratios 0.2 + 0.6 r (dry) and 0.2 + 0.9 r (wet), 4 secondary parcels per splash. (The jets dossier may replace this table; the interface is: hit in, deposited mass/momentum/pressure plus secondary parcels out.)
4. Stagnation-zone closure per (nozzle, phase): quasi-steady radial film in the frame moving with the footprint (valid because sweep speed 0.4 to 0.9 m/s is much less than jet speed), giving wall shear and pressure versus radius and azimuth; splat into per-triangle exceedance histograms. (Jets and films dossiers supply the profile.)
5. Surface film solver on the triangle mesh, equations (2.1) to (2.5) with: momentum-flux factor 6/5; laminar wall shear 3μU/δ treated implicitly, switching to a turbulent friction law above film Reynolds number about 400 (films dossier); hydrostatic and capillary pressure including substrate curvature; capillary term only where δ < 0.3 mm; contact-line force with β = 1.0 and contact angle drawn once per cell from a normal distribution (mean per material and soil state, standard deviation 10°); wet-state hysteresis (wet above 0.5 δ_c under spray, dry again only below 0.001 δ_c on surfaces that hold water); thickness floor 1e-7 m. Numerics: finite volume, positivity-preserving well-balanced flux (HLL or central-upwind with hydrostatic reconstruction [RECALLED: Audusse et al. 2004; Kurganov and Petrova 2007]), two-stage strong-stability-preserving time stepping, base step 5e-4 s with 5 power-of-two local levels (down to 3.1e-5 s).
6. Film-to-droplet transfer: face dripping by the Brun criterion (ū* = 1.62208, drop diameter 3.3 capillary lengths); curvature separation by the Owen-Ryley balance with the 72/60 inertia factor; sharp-rim separation of jet-driven films by O'Rourke-Amsden with c_sep = 3; plus a new edge/low-point pendant-drop model (films dossier).
7. Pools: basins from a watershed pass on each mesh relative to gravity; lumped fill, overflow as a line source at the spill point.
8. Water-on-jet interference: mean-field interception on a 1 cm grid.
9. Exposure record per triangle and hydraulic state as in section 4.2: 12 shear levels from 0.1 to 300 Pa, 8 pressure levels from 10 Pa to 100 kPa, wet fraction, mean thickness, speed moments, renewal rate, direct-hit list, source split. Periodic state: 3 spin-up + 2 averaging revolutions; 5 % convergence tolerance.
10. Soil integration over the whole programme by time homogenisation: level 1 for all cells, level 2 for cells with direct hits; jump fraction q = 0.03, consistency tolerance η = 0.3, step between 1 s and 30 s; events force step boundaries. (Soil and chemistry dossiers own F.)
11. Hydrodynamic refresh at three temperatures per state (interpolate in log viscosity), after detergent release, on first basin overflow, and when an item's cleaned-area fraction changes by more than 20 %.

**Numerical hygiene defaults:** f32 state; integer step counter for time and phase; fixed-point integer `atomicAdd` for all scatters (mass unit 1e-9 kg, impulse unit 1e-9 N s); item-local coordinates in bottom-level BVHs; every dispatch under 20 ms; quality tier fixed before the run; checkpoint every 60 to 120 s.

**Platform defaults:** native wgpu or Dawn application; software BVH in WGSL; device limits requested from the adapter at start; GPU memory budget 6 GB; CPU performance cores for BVH build, rigid bodies and hydraulics.

---

## Calibration parameters

What future real-world and numerical tests should measure. Ranges are my expectations unless tagged.

| Parameter | Default | Expected range | How to measure |
|---|---|---|---|
| BVH segment queries per second on the target laptop | 50 million | 20 to 150 million | Micro-benchmark (risk 1) |
| Film cell-steps per second | 150 million | 50 to 400 million | Micro-benchmark |
| Soil node-updates per second | 300 million | 100 to 1000 million | Micro-benchmark |
| Sustained-load derating factor | 0.85 | 0.8 to 0.95 | 20 consecutive reference runs, log speed and OS thermal state |
| Contact-line coefficient β | 1.0 | 0.085 to 1.0 published [VERIFIED: OpenFOAM tutorial and Meredith]; expect grid dependence | Inclined-plate critical wetting flow rate and wetted-area fraction per material with real wash liquor at temperature, then fit β at the production mesh size |
| Contact angle mean and spread per material and soil state | 75° ± 10° (acrylic with water [VERIFIED: Meredith]) | Glass and glazed ceramic with detergent much lower; polypropylene higher | Sessile and advancing-angle measurements with wash liquor (films and chemistry dossiers) |
| Wet/dry hysteresis factors | 0.5 δ_c and 0.001 δ_c | 0.1 to 1 and 1e-4 to 1e-1 | Same inclined-plate rig, drying-out transient |
| Splash coefficients A_dry, A_wet; exponent | 2630, 1320, −0.183 | A from 1322 to 5264 with roughness 12 to 0.05 μm [VERIFIED: Fluent table 12.2] | High-speed imaging of a single jet and of millimetre drops on each tableware material, wet and dry |
| Splashed mass fraction and secondary drop size law | 0.2 to 0.8 (dry), 0.2 to 1.1 (wet); N_s = 5 (We/We_c − 1) | Unknown for millimetre drops at 1 to 10 m/s | Same imaging; collect splashed mass on a ring collector |
| Number of secondary parcels per splash | 4 | 2 to 8 | Numerical convergence of rain-flux maps |
| Momentum-flux profile factor | 1.2 | 1.02 (turbulent) to 1.2 (laminar) | Not directly; check via hydraulic-jump radius |
| Film laminar-turbulent switch (film Reynolds number) | 400 | 250 to 1600 | Film thickness versus flow rate on a vertical plate |
| Face-drip constants ū*, diameter coefficient | 1.62208, 3.3 | 1.3 to 2; 2.5 to 4 | Drop size and spacing under tilted wet plates |
| Rim separation constant c_sep | 3 | 1 to 5 ("remains to be validated experimentally" [VERIFIED: O'Rourke and Amsden]) | Jet on a plate near its rim, fraction thrown off versus staying attached |
| Jet interception coefficient (water-on-jet) | 1.0 | 0 to 2 | Jet reach with and without an upper-rack load shedding water |
| Water outside the sump during wash | 1 L | 0.5 to 2 L | Sump level drop between pump off and steady wash |
| Arm speed | 30 to 35 rpm [VERIFIED: thesis] | 15 to 60 rpm by machine | Tachometer or door-window video (machine dossier) |
| Direct-hit duty fraction at instrumented points | model output | 0.07 % to 1.6 % in one published set-up [VERIFIED: thesis table 7.5] | Fast pressure or conductivity sensors on a test plate; compare with exposure record |
| Mean water speeds for whole-system check | model output | Ejection 7.7 m/s, downfall 5.1 m/s at medium pump speed in one machine [VERIFIED: thesis table 4.1] | Tracer or high-speed video |
| Spin-up and averaging revolutions | 3 and 2 | 2 to 8 and 1 to 4 | Numerical convergence study per load type |
| Exposure-record levels | 12 shear, 8 pressure | 8 to 16 each | Sensitivity of scores to level count |
| Homogenisation controls q, η, step bounds | 0.03, 0.3, 1 to 30 s | 0.01 to 0.1, 0.1 to 0.5 | Audit against brute-force integration |
| Temperature refresh points per state | 3 | 2 to 5 | Sensitivity study |

---

## Sources

Opened and read this session (basis of [VERIFIED] tags):

1. Pérez-Mohedano, R. (2016). *Cleaning principles in automatic dishwashers*. EngD thesis, University of Birmingham. https://etheses.bham.ac.uk/id/eprint/6590/ (PDF: http://etheses.bham.ac.uk//id/eprint/6590/9/PerezMohedano16EngD_sizereduced.pdf). Sections 3.5, 4.5, 5, 7.3, 8.1; tables 4.1, 7.5, 7.6.
2. FIFTY2, "Dishwasher Simulation in PreonLab" (2022). https://www.fifty2.eu/innovation/dishwasher-simulation-in-preonlab/
3. FIFTY2, "Advancing Dishwasher Design: SPH-Driven Optimization". https://www.fifty2.eu/usecases/advancing-dishwasher-design-sph-driven-optimization/
4. AVL, "Particle-Based Simulation to Optimize Dishwasher Design" (2024). https://avl.com/en/blog/particle-based-simulation-optimize-dishwasher-design
5. FIFTY2, "PreonLab - The Ultimate Simulation Tool" (gear benchmark caption). https://fifty2.eu/innovation/preonlab-the-ultimate-simulation-tool
6. FIFTY2, Volvo showcase. https://www.fifty2.eu/volvo-showcase/
7. Wickert, D., "Validation of a sprinkling simulation with PreonLab", TU Dresden white paper. https://fifty2.eu/wp-content/uploads/2021/06/tudresden-whitepaper.pdf
8. FIFTY2, Preon technology page (CFL 1 claim). https://fifty2.eu/preonlab/fluid-simulation
9. Daroz et al., "Efficient and Scalable GPU-oriented SPH Solver: A Real Application Study", PARTICLES 2023 (abstract). https://particles2023.cimne.com/event/contribution/ec515893-e335-11ed-9a1c-000c29ddfc0c
10. Siemens Simcenter blog, "Honey, I've done the laundry" (2024). https://blogs.sw.siemens.com/simcenter/?p=58343
11. CFD Support, "Dishwasher OpenFOAM Study". https://www.cfdsupport.com/dishwasher-openfoam-study/
12. Dive Solutions, washing systems. https://www.divecae.com/solution-application/washing-system
13. Minde, M., *Validation of Dishwasher CFD Model Using PIV*, MSc thesis (Electrolux). https://www.diva-portal.org/smash/get/diva2:1027486/FULLTEXT02.pdf
14. Altair nanoFluidX FAQ, simulation environment. https://help.altair.com/hwcfdsolvers/nfx/topics/faq/faq_simulation_environment_r.htm
15. Domínguez et al., "State-of-the-art SPH solver DualSPHysics", arXiv:2104.00537, section 5.3. https://arxiv.org/abs/2104.00537
16. Lehmann, M., FluidX3D README (benchmark tables, memory per cell). https://github.com/ProjectPhysX/FluidX3D
17. matsuoka-601, WebGPU-Ocean README. https://github.com/matsuoka-601/WebGPU-Ocean
18. Fei, Huang and Gao, "Principles towards Real-Time Simulation of Material Point Method on Modern GPUs", arXiv:2111.00699. https://ar5iv.labs.arxiv.org/html/2111.00699
19. Hu et al., "AsyncTaichi", arXiv:2012.08141 (table 1, footnote 4). https://ar5iv.labs.arxiv.org/html/2012.08141
20. OpenFOAM-8 source, `src/regionModels/surfaceFilmModels`: `kinematicSingleLayer/kinematicSingleLayer.C`; `submodels/kinematic/filmMomentumTransportModel/laminar/laminar.C`; `.../force/contactAngleForces/contactAngleForce/contactAngleForce.C`; `.../injectionModel/curvatureSeparation/curvatureSeparation.{C,H}`; `.../injectionModel/drippingInjection/drippingInjection.C`; `.../injectionModel/BrunDrippingInjection/BrunDrippingInjection.{C,H}`. https://github.com/OpenFOAM/OpenFOAM-8/tree/master/src/regionModels/surfaceFilmModels
21. OpenFOAM-8 source, `src/lagrangian/intermediate/submodels/Thermodynamic/SurfaceFilmModel/ThermoSurfaceFilm/ThermoSurfaceFilm.{C,H}`; tutorials `tutorials/lagrangian/reactingParcelFoam/{splashPanel,hotBoxes,cylinder}/constant`. https://github.com/OpenFOAM/OpenFOAM-8
22. OpenFOAM.com API guide v2412: `FriedrichModel` class description (https://api.openfoam.com/2412/classFoam_1_1filmSeparationModels_1_1FriedrichModel.html); `kinematicThinFilm.C` (https://api.openfoam.com/2412/kinematicThinFilm_8C_source.html). Cites Friedrich et al. 2008, doi:10.1115/1.2907405; Zhang et al. 2018, doi:10.1016/j.ijmultiphaseflow.2018.05.016.
23. Meredith, Heather, de Vries and Xin (2011), "A numerical model for partially-wetted flow of thin liquid films", WIT Trans. Eng. Sci. 70, doi:10.2495/MPF110102. https://www.witpress.com/Secure/elibrary/papers/MPF11/MPF11020FU1.pdf
24. O'Rourke and Amsden (1996), "A particle numerical model for wall film dynamics in port-injected engines" (SAE 961961; Los Alamos report copy). https://digital.library.unt.edu/ark:/67531/metadc687967/m2/1/high_res_d/373884.pdf
25. ANSYS Fluent Theory Guide 2024 R2 (text only; equations are images): Eulerian wall film chapter 17 (https://ansyshelp.ansys.com/public/Views/Secured/corp/v242/en/flu_th/flu_th_models_wallfilm.html and sub-pages `flu_th_ewf_intro`, `flu_th_ewf_sec_eqns`, `flu_th_ewf_sec_film_submodels`, `flu_th_ewf_sec_wet`, `flu_th_ewf_sec_time_diff`); Lagrangian wall film section 12.9 (`flu_th_sec_disp_spray_wall`, `flu_th_sect_wall_film_intro`, `flu_th_sect_wall_film_impact`, `flu_th_sec_sep_criteria`).
26. Simcenter STAR-CCM+ help mirror, "Modeling Fluid Film Flow" (capability list only). https://topcfd.cn/Ebook/STARCCMP/GUID-B1D8FE17-0924-4292-961C-E9E12DBFF1D3.html
27. Joppa, Köhler, Rüdiger, Majschak and Fröhlich (2017), "Prediction of cleaning by means of computational fluid dynamics: implication of the pre-wetting of a swellable soil", Heat Exchanger Fouling and Cleaning 2017. https://heatexchanger-fouling.com/wp-content/uploads/2021/09/34_Joppa_Prediction-of-Cleaning-by-Means-of-Computational.pdf
28. Moghimi, Karimi-Jafari and Shardt (2025), "Simulations of sprays in vessels and the effects of key variables for understanding cleaning processes", Chem. Eng. Res. Des. 217, 128-151, doi:10.1016/j.cherd.2025.03.027 (abstract via https://pure.ul.ie/en/publications/simulations-of-sprays-in-vessels-and-the-effects-of-key-variables/).
29. Ylitie, Karras and Laine (2017), "Efficient Incoherent Ray Traversal on GPUs Through Compressed Wide BVHs", HPG 2017, tables 4 to 6. https://research.nvidia.com/sites/default/files/publications/ylitie2017hpg-paper.pdf
30. Karras (2012), "Maximizing Parallelism in the Construction of BVHs, Octrees, and k-d Trees", HPG 2012 (abstract). https://research.nvidia.com/publication/2012-06_maximizing-parallelism-construction-bvhs-octrees-and-k-d-trees
31. Bikker, tinybvh README (qualitative only). https://github.com/jbikker/tinybvh
32. MDN, GPUSupportedLimits (default WebGPU limits). https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits
33. W3C GPU for the Web, WGSL specification source (`wgsl/index.bs`: Floating Point Evaluation, Floating Point Accuracy, Reassociation and Fusion, Atomic Types). https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs
34. Apple, MacBook Pro (14-inch, Nov 2023) technical specifications. https://support.apple.com/en-bh/117736

Seen only as search-result snippets (basis of [RECALLED: search snippet] tags; pages not opened or blocked):

35. Pérez-Mohedano et al. (2015), PEPT paper, Chem. Eng. J. https://www.sciencedirect.com/science/article/pii/S1385894714010870 ; IChemE blog summary https://icheme.org/knowledge-networks/blog/how-to-best-load-a-dishwasher-by-a-chemical-engineer-day-245
36. Pérez-Mohedano et al. (2017), "Integrated model for the prediction of cleaning profiles inside an automatic dishwasher", J. Food Eng. https://www.sciencedirect.com/science/article/abs/pii/S0260877416303600
37. US patent 12,579,335, sink-type dishwasher hydraulic performance prediction. https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12579335
38. Coupled 3D-1D dishwasher heat-transfer study, Case Studies in Thermal Engineering (2023). https://www.sciencedirect.com/science/article/pii/S2214157X23006615
39. Gaylard et al., SAE 2012-01-0588; SAE 2015-01-1549; Jilesen et al., SAE 2018-01-0717 (A-pillar overflow, PowerFLOW). https://saemobilus.sae.org/content/2012-01-0588
40. Idoffsson (2019), "Wading - Evaluation of SPH-based simulations versus traditional Finite Volume CFD", Chalmers MSc thesis (abstract page opened; PDF too large to fetch). https://odr.chalmers.se/handle/20.500.12380/300473
41. Cojocaru and Karlsson (2006), "A simple numerical method of cycle jumps for cyclically loaded structures", Int. J. Fatigue 28(12), doi:10.1016/j.ijfatigue.2006.01.010.
42. Oskay and Fish (2004), "Fatigue life prediction using 2-scale temporal asymptotic homogenization", Int. J. Numer. Meth. Eng. 61(3). https://cdn.vanderbilt.edu/vu-my/wp-content/uploads/sites/246/2019/04/14092846/Oskay-Fish-IJNME-2004.pdf
43. wgpu ray-tracing extension documentation. https://wgpu.rs/doc/wgpu/documentation/extensions/ray_tracing/index.html
44. Geekbench and Notebookcheck figures for the M3 Pro 14-core GPU; LaptopMedia 30-minute loop for the base M3 (via search summaries; Notebookcheck review page returned 403). https://www.notebookcheck.net/Apple-MacBook-Pro-14-2023-M3-Pro-review-Improved-runtimes-and-better-performance.779538.0.html
45. Lehmann et al. (2021), "Ejection of marine microplastics by raindrops", Microplastics and Nanoplastics 1:18 (free-surface LBM application). https://microplastics.springeropen.com/articles/10.1186/s43591-021-00018-8

Cited from memory only (basis of plain [RECALLED] tags; not opened, no URL asserted): Bai and Gosman, SAE 960626 (1996); Bai, Rusche and Gosman, Atomization and Sprays 12 (2002); Stanton and Rutland (1998); O'Rourke and Amsden, SAE 2000-01-0271; Owen and Ryley, Int. J. Multiphase Flow 11 (1985); Brun et al., Phys. Fluids 27, 084107 (2015); E and Engquist, "The heterogeneous multiscale methods", Commun. Math. Sci. 1 (2003); Gear and Kevrekidis, "Projective methods for stiff differential equations", SIAM J. Sci. Comput. 24 (2003); Sanders, Verhulst and Murdock, *Averaging Methods in Nonlinear Dynamical Systems*; Audusse et al., SIAM J. Sci. Comput. 25 (2004); Kurganov and Petrova, Commun. Math. Sci. 5 (2007); Woop, Benthin and Wald, "Watertight ray/triangle intersection", JCGT 2 (2013); Wang et al., "A massively parallel and scalable multi-GPU material point method", ACM TOG 39 (2020).
