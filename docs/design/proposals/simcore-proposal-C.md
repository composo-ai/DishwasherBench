# Spotless wash-simulation core: Proposal C ("expose, route, replay")

> **Record of the build, superseded.** One of three competing designs written on 8 October 2026.
> A panel compared them (`panel-results.txt`) and the design that was built is
> `docs/design/sim-core.md`, as limited by `docs/design/scope.md`. Kept as written; working
> files it cites are not in the repository. The index of the documents is `docs/README.md`.

Author: architect C (sceptic stance, no prior commitment on representation). Date: 2026-10-08.
Status: design proposal for the judging panel. Nothing here is implemented. Throwaway scripts that back the numbers marked [C-SCRIPT] were working files (`film1d_v2.py`, `similarity.py`, `drain.py`, `checks.py`, `budget2.py`) and are not in the repository. Hardware limits are taken from the GPU spike report and the lead's note of 16:43: 2 to 3 GB of GPU buffers by design and 4 GB as ceiling, every binding under 4 GiB, at most 10 storage buffers per shader stage, 20 minutes of GPU kernel time out of the 30.

Conventions

- Confidence tags are carried over from the dossiers: [VERIFIED], [RECALLED], [ESTIMATED]. A dossier citation looks like (jets §4.5 [VERIFIED]). Anything I derived myself is tagged [C-EST] (my estimate) or [C-SCRIPT] (my estimate, checked numerically in a throwaway script).
- SI units throughout unless a unit is written. Frame: machine dossier §0.3 (origin on the lower-arm axis at the tub floor, x right, y back, z up, gravity g = (0, 0, -9.81) m/s2).
- "Water cell" = a surface element that carries water state (2 mm on items at the official tier). "Soil cell" = a sub-element that carries soil state (1 mm on soiled regions). "Exposure state" = one combination of diverter state, pump-speed class and liquor class for which the forcing is periodic.
- Main symbols: rho, mu, nu liquid density, dynamic and kinematic viscosity; sigma liquor surface tension (gamma_w = clean-water value used for jets and splatter); h film thickness; m = rho h film mass per area; Gamma film mass flow per unit width (kg/(m s)); q = Gamma/rho; tau wall shear stress (Pa); M = rho U^2 h film momentum flux per unit width (N/m); beta surface tilt from horizontal; g_s = g sin(beta); theta_a, theta_r advancing and receding contact angles; l_c = sqrt(sigma/(rho g)) capillary length; d, V, Q jet diameter, speed, volume flow; phi jet incidence angle from the wall plane; v_s footprint sweep speed; R_j radius of the fast radial film; xi splattered mass fraction; T_rev arm period.

---

## 1. Executive summary

**The design in one page.** Whether an item comes out clean is decided by a short list of quantities per square millimetre of soiled surface: is it wetted at all, for what share of the programme, by liquor of what temperature and composition, renewed how fast; is it crossed by a jet footprint, how often and how hard relative to a few thresholds; does anything redeposit on it; does water pool on it. I start from how accurately each of those can be known (section 2) and build the cheapest model chain that makes each one as trustworthy as its own physical uncertainty allows:

1. **Exact parametric geometry.** Items are traced as what they are (conical frusta of the profile polyline, capsules, planar patches), not as triangle soup. A hit returns surface coordinates (arc length, azimuth) that map to a surface cell with two table look-ups. Normals are exact, which matters because most jets strike plates at 5 to 30 degrees.
2. **Lumped hydraulics and arm kinematics** exactly as in the machine dossier.
3. **Jets are analytic.** 16,384 arm phases per revolution, 19 sub-rays per jet, traced to first hit. Under each footprint the pressure, wall shear, film thickness and momentum flux come from the closed forms of the jets dossier and are integrated along the footprint track onto 1 mm soil cells. This is where sub-millimetre accuracy is cheap and matters.
4. **Secondary water is Monte Carlo.** Splatter, wire and rim fans, edge sheets, broken-jet splash and drips are 4 x 10^8 ballistic droplet parcels per diverter state with drag, wall-regime rules and one splash generation, deposited with order-independent integer adds into phase-binned tables.
5. **Water on surfaces is a kinematic cascade, not a shallow-water solve.** Each 2 mm water cell is a non-linear reservoir whose discharge is the equilibrium (Nusselt or turbulent) flux for its thickness and slope, routed down the exact local direction of tangential gravity. Wetting is an explicit regime machine (dry, beads, rivulets, film) driven by the Hartley-Murgatroyd minimum wetting rate, a dewetting clock and a bead store. Edges, drip sites, pools, puddles and capillary contacts are lumped stores. The cascade is time-stepped through the periodic forcing (3 spin-up + 2 recorded revolutions) and through a simulated 60 s drain-down for each state.
6. **The whole programme is replayed, not extrapolated.** The soil model of the soils dossier (12 layers per soil cell) is stepped once per arm revolution for every revolution of the programme (about 3,700 ticks), reading the exposure records of whichever state is active. There is no cycle jumping and therefore no homogenisation error to control.
7. **Rigid bodies are shaken down first.** Jet loads from the cheap primary-ray pass drive the rigid-body engine through the first seconds of every hydraulic state before any expensive exposure is computed; later motion triggers a budgeted re-exposure (one at official resolution, one more at fast resolution, then the item is frozen and flagged).
8. **Every official run brackets its own closures.** Eight preview-tier re-runs with the dominant uncertain closures pushed to their plausible limits give each item a fragility flag and a sigma. The official verdict comes from the nominal run only.

Official tier: 14.4 to 16.7 minutes typical and 21.7 to 25.5 minutes with every reserve drawn (a mid-wash geometry change recomputed at official resolution, a second one at fast resolution, wetting refreshes, convergence extension, extended shake-down); the two figures are for the nominal 6.1 m2 load and the upper-bound 8.5 m2 load, and both include a 10 % sustained-load allowance on top of derated throughputs. The cap is 30 minutes. GPU kernel time is 9 to 11 minutes typical and under 18 minutes at worst, against the 20 minutes the spike allows. Peak GPU memory is 1.6 to 2.1 GB. Fast tier 1.7 to 1.9 minutes; preview under 1 minute.

**The three ideas that most distinguish it**

1. **No inertial film PDE.** Outside the analytic jet zone, film inertia is forgotten within 1 to 7 cm (films §3.6 [ESTIMATED]) and gravity-film shear is bounded at 0.4 to 5 Pa whatever the flow (films §1.2 [ESTIMATED]). A kinematic cascade reproduces the time-mean thickness and shear of an inertial reference solver to within 1 to 9 % at 2 mm resolution for realistic jet-pass pulses, and to within 25 % in the first 5 cm below extreme ones [C-SCRIPT, section 6.9], while the quantities that feed it (splatter fraction, contact angle) are uncertain by factors of two. Its wetting behaviour is a closed-form closure, so it does not change with grid spacing the way the Meredith contact-line coefficient does (0.085 to 1.0 between two tutorials of one code, numerics §2.2(e) [VERIFIED]).
2. **Compute follows the error budget, not the PDE.** The time saved goes to the things that change outcomes: dense secondary-water statistics, six exposure states plus six simulated drain-downs instead of two or three periodic states, per-revolution soil replay, a shake-down pre-pass, and a geometry-change reserve.
3. **The run reports how much to trust itself.** The fidelity tiers are nested: same closures and parameters, counter-based random numbers whose official stream contains the coarser streams, and the same equations except that the preview tier replaces the time-marched runoff by its steady limit. That makes a preview-tier closure bracket a usable estimate of how the official result would move with the uncertain constants, and it gives every item a fragility flag and a sigma. The same machinery monitors whether the fast tier ranks loads like the official one. Whether preview-tier sensitivities track official-tier ones is an assumption that prototype 3 tests.

**Where it is weak, stated plainly.** Flow inside inverted vessels, on rims and around wires is rule-based on [ESTIMATED] closures. The model has no emergent two-dimensional film dynamics: no film-jump rope, no meandering rivulet, no capillary ridge, no roll waves. My numerical evidence for the cascade is one-dimensional and vertical. Three negative controls of the validation suite (cutlery heads up or down, easy soils anywhere, bleachable stains anywhere) rest entirely on secondary-water closures that are uncertain by factors of two or more, and run-to-run variability does not emerge from the model at all (13.3, 13.4). If calibration shows that film inertia or pressure-driven spreading beyond the jet zone decides scores, the routing module must be replaced by a depth-averaged solver; the module boundary (deposition tables in, film exposure records out) is drawn so that this is a swap and not a rewrite.

---

## 2. Error budget

### 2.1 What the outcome depends on, and how strongly

The verdict (standards §10.2, E6 to E8) is: at most 4 visible specks, at most 4 mm2 of visibly soiled area, at most 1 mL of retained water. For a soil cell the residual is, to first order, initial loading minus the time integral of a removal rate. Reading the soil model (soils §7.5) term by term gives the exponent with which each hydrodynamic input enters:

| Soil mechanism | Classes | Depends on wet/dry | on wetted time share | on film shear tau_f | on jet events | on T and chemistry |
|---|---|---|---|---|---|---|
| Hydration and reaction-erosion (enzyme, alkali) | dried and cooked protein, starch with amylase | on/off | linear | none below tau* = 10 Pa (soils §R3 [VERIFIED]); gravity films give 0.4 to 5 Pa | about 10 % of removal at a well-hit spot (soils §6.2 [ESTIMATED from VERIFIED]) | exponential in 1/T, factor 2.6 per pH unit, Hill in enzyme |
| Dissolution, mass transfer | sugars, solubles, enzyme supply at low dose | on/off | linear | power 1/3 (films §9.4 [RECALLED]) | irrelevant | linear to weak |
| Cohesive erosion of swollen layers | pregelatinised starch | on/off | linear | linear with a threshold of 1 to 2 Pa (soils §6.5 [ESTIMATED]) | strips partly swollen layers | through swelling |
| Adhesive detachment and peeling | dried sauces, baked and burnt soils | on/off (soak) | through soak time | none (M_f about 0.05 N/m against M_Y of 1 to 300 N/m) | decisive: threshold on M_j | adhesion decay with T, alkali, surfactant |
| Fat melting and viscous shifting | fats | on/off | linear | weak | displace soft fat | sigmoid in T over a few kelvin |
| Bleaching | tea, coffee, wine | on/off | linear | none | none | oxidant, T |
| Redeposition | everything, including clean items | needs a film | through stranding and settling | removal of pinned particles | removal | liquor soil load |

Three conclusions follow.

- **Wet or dry is the only hydrodynamic input that enters every mechanism, and it enters as a switch.** "Unwetted soil is uncleaned soil" (soils §9).
- **Film shear magnitude matters to one class (swelling starch) linearly and to nothing else more than as a cube root.** Its accuracy target is therefore set by the 1 to 2 Pa starch threshold: +/- 30 % is as good as it can be used.
- **Jet stresses matter through thresholds.** Peak wall shear under a dishwasher jet is 150 to 320 Pa (jets §0.3 [ESTIMATED]) against tau* = 10 Pa; what matters is where the footprint track lies, how wide the zone above threshold is, how long it dwells and how often it returns. Those are geometry and kinematics.

### 2.2 Ranked error sources

"Magnitude" is the plausible range of the driving quantity today, before calibration. "Effect" is my estimate [C-EST] of what that range does to a per-item IEC score (0 to 5) on the items it touches. "Bought by compute?" says whether run-time resolution can reduce it.

| Rank | Error source | Magnitude today | Effect on outcome | Bought by compute? | What this design does |
|---|---|---|---|---|---|
| 1 | Soil kinetics and adhesion parameters; visibility thresholds | reaction-erosion flux within x3 for egg yolk, x10 for other soils; lag 0.5 to 30 min; peel efficiency eta_M 0.03 to 1; m_vis within x3 (soils calibration table; standards §10.3) | +/- 1 to 2 score points on every tenacious class; flips most borderline items | No. Calibration only | Keep the full soil state model and every calibration hook; spend 7 to 8 % of run time on it. Use this row to set tolerances for everything below: a hydrodynamic input that enters linearly need not be better than about +/- 30 % |
| 2 | Secondary-water transport: splatter fraction (0 to 0.4, two conflicting data families, jets §5.3), wire and rim deflection rules (each within x2 to x3, jets §7.3 [ESTIMATED]), splash mass ratio (0.14 to 0.8), drip modes | factor 2 to several on the water reaching shadowed surfaces | decides wet/dry and renewal on the 85 to 95 % of surface not under jets (jets §9.2 [ESTIMATED]); I expect 5 to 20 % of soiled area to change wetting class between the closure extremes; this is what makes or breaks the negative controls P16, P24, P28, P44 | Partly: Monte Carlo noise and cascade convergence yes, closure constants no | Largest single ray budget (4 x 10^8 parcels per state), cascade simulated to convergence, closure bracket on every official run, first calibration priority |
| 3 | Wetting persistence on partially wetting materials: receding angle uncertain by +/- 20 degrees on plastics and steel (films §13 item 1) | wetted-area fraction 0.1 to 1; dewetting time 10 ms to 10 s (films §5.5) | mainly drying and retained water on plastics and steel; cleaning less, because hydrated soil is itself hydrophilic (films §12.7) | No | Explicit, grid-independent regime closure with the measured angle as its only material input; bracketed |
| 4 | Which jets hit which face, where and at what angle | deterministic given pose and nozzle table; nozzle exit-angle correction 0 to 10 degrees (jets §2.3) | Delta s of 1 to 3 on tenacious soils (P02, P03, P05, P06, P07) | Yes, cheaply | Exact primitives, exact normals, 16,384 phases, 19 sub-rays, analytic along-track integration. Costs seconds |
| 5 | Jet-zone stresses and footprint extent: k_stag 1 to 2.8, k_film 0.7 to 2, oblique pressure exponent 1 to 2, sweeping-footprint film within x2, droplet-train efficiency 0.3 to 1.5 (jets §12) | x/÷ 2 on tau_j, M_j; +/- 8 % on R_j between three models | small for threshold soils whose threshold is far below the peak (protein); large for peel soils only through eta_M (rank 1) | No (closure), except numerical integration | Analytic closures evaluated at 1 mm with 5 % numerical tolerance; constants exposed |
| 6 | Bulk liquor history: release time, pH, enzyme stability, peracid, temperature ramp | pH +/- 0.5 (x1.6 in rate); protease half-life at 60 C within x4 | shifts every item together; large on programme comparisons (P27) | No | Lumped 25-state liquor model on the CPU (chemistry §10) |
| 7 | Local delivery of chemistry and heat: film renewal, stagnant liquor, cold-item lag | exact given the water routing; cold-item lag 2 to 25 s wetted, minutes shadowed (films §9.2) | matters on perhaps 5 to 10 % of area (stagnant gaps, pools, shadowed faces) | Yes: follows from mass routing | Time-mean flux is conserved exactly by construction; per-element renewal rate and supply-limited conductance in the record |
| 8 | Gravity-film thickness and shear | Gamma within x2 (from rank 2) gives h and tau within 26 % (cube root); roll waves 2 to 3 x mean (films §3.4 [RECALLED]) | starch erosion and mass transfer only | Barely: a perfect film solve of an uncertain Gamma is still +/- 26 % | Kinematic cascade; measured cost of dropping inertia 1 to 9 % on means (section 6.9) |
| 9 | Redeposition: suspended load, filter capture (eta_2 0.02 to 0.2), stranding thickness (50 to 300 um) (chemistry §11) | order of magnitude | specks move items from 5 to 4 (still clean) and, with spinach-like soils, to 3 (not clean) | No | Per-cell speck intensity from routing quantities; statistical output; calibration hook |
| 10 | Pooling and retained water | geometric; edge-held height +/- 30 % | binary on mis-oriented items; V_max = 1 mL is tilt-sensitive | Yes, cheaply | Priority-flood basins on exact geometry; lumped stores |
| 11 | Item motion | wet friction 0.08 to 0.45; turning factor 1 to 2 (items §14) | discrete and large for 20 to 60 g items | Partly | Shake-down pre-pass with the rigid-body engine; one re-exposure reserve |
| 12 | Numerics: discretisation, Monte Carlo noise, time integration, f32 | target: under one third of the smallest physical uncertainty above, i.e. under 10 % on driving quantities, and fewer than 1 % of items flipped outside the dead band | - | Yes | Tolerances in section 13; split-half noise estimate per run |

### 2.3 How the allocation follows

- Rows 4, 10 and 12 are fully reducible and cheap, so they are done to excess (seconds of GPU time).
- Row 2 is the largest reducible-in-part item, so it gets the largest share of traced rays and the whole bracket stage.
- Rows 3 and 8 are where the dossiers' default (a time-stepped inertial film solve on a 0.5 to 1 mm mesh) would spend 45 % of the budget (numerics §7.2). The ranking says that accuracy there is capped by rows 2 and 3, so I spend about a third of the run on a much simpler model and use it to cover more states and more simulated time.
- Rows 1, 6 and 9 cannot be bought. The design's obligation is to give calibration clean, separable parameters and to report sensitivity.

Share of official run time (nominal, 6.1 m2 load, section 11): rays and parcels 15 %, runoff routing 33 %, timeline replay (soil, thermal, liquor) 7 %, closure bracket 28 %, set-up, shake-down, end-of-phase passes and I/O 17 %.

The typical run deliberately stops well short of the cap. The ranking says that after this point more resolution does not buy realism, and a reserve is needed for runs in which an item moves. Section 11.5 lists what I would buy with the remaining minutes if the panel wants every run to use them.

Numerical accuracy targets derived from the table (used as test tolerances in section 13):

| Quantity | Target numerical error | Reason |
|---|---|---|
| Footprint track position, incidence angle, dwell | 0.5 mm, 1 degree, 10 % | thresholds; grazing incidence |
| tau_j, M_j, p_j relative to the closure | 5 % | closure itself is x/÷ 2 |
| Wetting class of a soil cell (dry, bead, intermittent, continuous) | under 5 % of soiled area misclassified between tiers | switch-like dependence |
| Time-mean film loading Gamma | 10 % | enters linearly through renewal |
| Film shear, mean and peak | 30 %, 50 % | starch threshold; cube root elsewhere |
| Element temperature | 1 K | 3 % per kelvin in rates; fat melting width |
| Pool volume | larger of 0.2 mL and 5 % | V_max = 1 mL |
| Global water mass | 0.1 % per revolution | inventory, loss of prime |

---

## 3. Geometry and surface representation

### 3.1 Two representations from one source

Every item is generated from its parametric definition (items §2, §9). The same definition yields (i) a list of **analytic primitives** for ray and parcel queries and (ii) a set of **parametric patches**, each a semi-structured grid of surface cells that carry water and soil. The two are tied together because a primitive knows which patch and which parameter range it covers, so a hit converts to a cell index in closed form.

I reject triangles as the primary representation for one physical reason and one practical one. Physical: at 5 to 30 degree incidence the stagnation pressure scales as sin^2(phi) and the forward flow split as ((1 + cos phi)/(1 - cos phi))^2 (jets §4.7 [VERIFIED]); a faceted plate with 112 azimuthal facets has 3.2 degree jumps in normal, which is a 20 to 60 % jump in sin^2(phi) at those angles [C-EST]. Practical: about 19,000 exact primitives replace 2 to 3 million triangles, so the acceleration structure is a few megabytes and moving an item is a transform update. Triangles remain as a primitive type for shapes that have no parametric description and as the measured fallback (section 14, prototype 1).

### 3.2 Primitives for ray and parcel queries

| Type | Used for | Parameters (item-local frame) | Intersection |
|---|---|---|---|
| FRUSTUM | each segment of a shell-of-revolution profile, each side separately; also annuli (z0 = z1) and cylinders; optional azimuth window for box-shell fillets | r0, z0, r1, z1, side sign, theta_min, theta_max | quadratic in t; root kept if z and theta in range |
| CAPSULE | rack wires, tines, handles, stems, chopsticks, whisk wires | p0, p1, radius | quadratic (cylinder) plus two sphere caps |
| QUAD | box-shell floors and walls, slabs, blade faces, basket walls (with a perforation mask index) | origin, two edge vectors, corner radius | plane hit plus rounded-rectangle test |
| SPHERE | box-shell corner fillets, knobs | centre, radius, angular window | quadratic |
| TRIANGLE | fallback meshes | three vertices, per-vertex (patch, u, v), per-vertex normal | watertight test (numerics §5.1 [RECALLED]) |

Thin shells: the wall of a plate, bowl, cup or glass is the closed offset curve of the mid-surface profile (offset +/- t/2, rounded rim; items §2.2). I discretise that closed curve into frusta: the inner face, at least four short frusta around the rim half-circle, and the outer face. The two faces are therefore different primitives with opposite normals and there is no "which side did I hit" ambiguity. A wine glass is a single solid-of-revolution profile (bowl, stem, foot).

Structure: a two-level bounding-volume hierarchy. Bottom level: one binary BVH per catalogue item over its primitives in the local frame, built once and cached with the asset. Top level: instances (about 140 items, about 40 rack wire groups, cutlery basket, tub, three arms), rebuilt in under a millisecond when anything moves. Arms are instances whose transform is a function of the parcel's time (arm phase), so they shadow falling water at their true position; a parcel segment (at most 9 ms long) uses the arm pose at its mid-time, an error of at most 4 mm at the arm tip [C-EST: 210 degrees/s x 4.5 ms x 0.247 m].

Counts for a full 13-place-setting load [C-EST]: about 110 shell items x 120 frusta = 13,000; 69 cutlery pieces x 12 = 800; add-ons 2,000; racks about 1,800 capsules (100 m of wire, machine §2.4, in 55 mm mean segments); basket 600; tub and arms 150. Total about 19,000 primitives, 38,000 nodes, under 3 MB.

Precision: rays are intersected in item-local f32 coordinates (extent under 0.3 m, spacing 3 x 10^-8 m). The stable root form q = -(b + sign(b) sqrt(disc)) is used. A parcel that slips through a shared circle between two frusta is caught as a back-face hit from inside the wall and deposited there; the leak rate is a logged diagnostic (target under 10^-6 of rays).

### 3.3 Patches and cells for water and soil

| Patch type | Parameterisation | Cells |
|---|---|---|
| Revolution loop | s = arc length along the closed offset profile, theta = azimuth | rings of constant s; ring i has its own cell count N_theta(i) = max(6, round(2 pi r_i / Delta_s)) so cells stay near-square (a reduced grid, as used on the sphere in weather models) |
| Tube | s along the centreline, psi around | rings; N_psi = 1 for rack wires (one lumped cell per 3 mm of wire), 4 to 8 for handles, tines, stems |
| Planar and fillet | two in-plane coordinates | rows and columns |
| Triangle mesh | - | one cell per triangle (fallback) |

All patches are flattened into global arrays; a cell is (patch, ring, j). A per-patch ring table holds the cell offset, N_theta, s range, r, z and slope of each ring.

- **Polar singularity.** Ring cell counts fall towards the axis; the innermost ring is one disc cell and the next has six. There is no small-cell time-step penalty and no special case in the solver: the pole is an ordinary cell with six neighbours.
- **Seams.** A revolution loop has none: theta is periodic and s runs continuously around the rim from the inner face to the outer face. The rim always has at least two rings, tagged as edge rings with the exact rim radius r_e = t/2 for the separation criterion (section 6.5).
- **Neighbours inside a patch.** Same ring: j +/- 1 modulo N_theta. Adjacent rings with different counts: the one or two cells that overlap in theta, with overlap fractions, from the integer relation j' = floor((j + 0.5) N' / N). Stored explicitly (up to 8 neighbours per cell).
- **Neighbours across patch boundaries.** (i) Stitch links, computed at asset build: each boundary cell of an add-on patch (handle root, tine root, box-shell fillet edge) is linked to the nearest cells of the host patch within half a cell. (ii) Contact links, computed at placement from the rigid-body contact manifold plus a proximity query: item-to-wire and item-to-item contacts become links through which water can transfer (section 6.7). (iii) Everything else between items is carried by droplet parcels, not by neighbour links.
- **Both faces of a thin shell.** Each cell stores the index of its twin on the opposite face (same mid-surface point) for through-wall heat conduction. Water does not pass through; it passes around the rim.
- **Interiors of inverted cups and bowls.** They are just the inner-face rings of the loop patch in the item's pose. Jets enter by ray tracing through the opening; the fast film from an impact on the "ceiling" follows geodesics (Clairaut's relation r sin(alpha) = constant is exact on a surface of revolution) to the corner and down the wall (section 5.6); gravity routing then takes it to the rim, which is the lowest edge.
- **Rack wires.** Capsules for rays; one lumped water cell per 3 mm for routing (water runs along the wire to low points and junctions and drips there). No soil state.
- **Cutlery.** Swept sections along a centreline: handle and blade as planar and tube patches, fork tines as four tube patches stitched to the palm, spoon bowl as a shallow revolution cap. 1 mm soil cells on the working end.
- **Spray arms.** Three rotating instances for rays. Their own surfaces carry one lumped water store each (water landing on an arm is re-emitted at its trailing edge as drips with the arm's velocity; arms are not scored).
- **Tub.** Planar and fillet patches at 5 mm with routing to the sump; no soil cells, but film records are kept for heat, for the dispenser and tablet wetting rate, and for condensation during drying.

### 3.4 Resolution, counts and memory

Official tier. Water cells 2 mm on all item surfaces. Soil cells 1 mm (each water cell split 2 x 2) on soiled regions only. Upper-bound load of 8.5 m2 of item surface (the brief's upper figure); the nominal IEC load is about 6.1 m2 (standards §10.5 [ESTIMATED]). Soiled share 35 % [C-EST].

| Surface | Area (m2) | Water cell | Water cells | Soil cells (1 mm) |
|---|---|---|---|---|
| Items, soiled regions | 2.98 | 2 mm | 0.74 M | 2.98 M |
| Items, unsoiled | 5.52 | 2 mm | 1.38 M | - |
| Rack wires (100 m) | 1.07 | 3 mm lumped | 0.033 M | - |
| Cutlery basket | 0.2 | 3 mm | 0.022 M | - |
| Tub | 1.91 | 5 mm | 0.076 M | - |
| Arms | 0.1 | 3 mm | 0.011 M | - |
| **Total, 8.5 m2 load** | | | **2.27 M** | **2.98 M** |
| Total, 6.1 m2 load | | | 1.67 M | 2.13 M |

[C-SCRIPT: `checks.py`.] Why 2 mm for water and 1 mm for soil: every sub-2 mm feature of the exposure field is produced by a jet footprint and is evaluated analytically at soil-cell resolution (section 5.5). What remains on the water grid (gravity-film loading, wetting regime, temperature) varies on centimetre scales except at rivulet edges, which no affordable grid resolves and which are handled by a sub-cell coverage rank (section 6.4). The only published validation of a depth-averaged wetting model used a 3.8 mm grid (numerics §1.2 [VERIFIED]).

GPU memory, 8.5 m2 load:

| Buffer | Bytes per element | Elements | Size |
|---|---|---|---|
| Primitives and BVH | - | 19 k, 38 k | 3 MB |
| Water-cell geometry and routing links (static per placement) | 96 | 2.27 M | 218 MB |
| Deposition accumulator, 64 phase bins, u32 (Monte Carlo stage only, one diverter state at a time) | 256 | 2.27 M | 581 MB |
| Deposition table packed to f16, 64 bins (routing stage only, the diverter state being routed) | 128 | 2.27 M | 290 MB |
| Drip deposition ring, 32 bins, u32 (routing stage only) | 128 | 2.27 M | 290 MB |
| Runoff state and accumulators (routing stage only) | 64 | 2.27 M | 145 MB |
| Film exposure records, 6 states | 24 x 6 | 2.27 M | 327 MB |
| Drain-down records, 6 states | 8 x 6 | 2.27 M | 109 MB |
| Jet exposure records, 2 diverter states x 2 viscosity points | 40 x 4 | 2.98 M | 477 MB |
| Soil cells (replay stage only) | 136 | 2.98 M | 405 MB |
| Timeline water-cell state (replay stage only) | 48 | 2.27 M | 109 MB |
| Footprint tables, parcel scratch, onset-time fields, jet-wet masks, miscellaneous | - | - | 200 MB |

The diverter states are processed one after the other (Monte Carlo for L, routing for L, then U), and stage-only buffers are released at stage boundaries, so the three stages peak at different times [C-SCRIPT: `budget2.py`]:

| Stage | 8.5 m2 load | 6.1 m2 load |
|---|---|---|
| Secondary-water Monte Carlo | 1.48 GB | 1.13 GB |
| Runoff routing (the peak) | **2.06 GB** | **1.56 GB** |
| Timeline replay | 1.85 GB | 1.40 GB |

This is inside the 2 to 3 GB design range of the spike report and half of its 4 GB ceiling. The largest single buffer is 581 MB; every binding stays far below the 4 GiB limit at which bindings fail silently. The adapter's limits must be requested explicitly (the default binding limit is 128 MiB, numerics §6.1 [VERIFIED]; spike report section 3). No kernel binds more than 8 storage buffers (limit 10; section 12.3).

### 3.5 Mapping a hit to a cell

The intersection kernel returns (t, instance, primitive). For a FRUSTUM the local hit point gives z and theta directly; the primitive stores its patch, its first ring and its arc-length range, so

```
s      = s0_prim + (distance along the frustum generator from its start)
ring   = ringOfS[patch]( s )              // per-patch table; uniform Delta_s within a band, so one divide
j      = floor( theta * N_theta[ring] / (2 pi) )
water  = cellOffset[ring] + j
soil   = soilOffset[water] + 2 * (sub_s) + (sub_theta)      // if the water cell is soiled; sub_* from the fractional parts
```

Capsules, quads and spheres are analogous. For triangles the per-vertex (patch, u, v) are interpolated. The mapping is O(1), needs no search and no reprojection, and is exact up to f32 rounding of the fractional position (cells are 10^4 times larger than the rounding).

### 3.6 Per-placement surface analysis

Once per placement (and for moved items after a geometry change), on the GPU except where noted:

1. World-frame centre x_i, unit normal n_i (exact, from the primitive), area A_i, principal curvatures (analytic for revolution and tube patches).
2. Tangential gravity g_t,i = g - (g . n_i) n_i, slope sin(beta_i) = |g_t,i| / g, normal component G_n,i = -(g . n_i) (negative on undersides).
3. Routing links (section 6.2).
4. Terminal cells classified as basin pits, drip sites or flat regions (section 6.6).
5. Basins by priority-flood on the cell graph (CPU, WASM; O(N log N), about 2 s for 2.3 M cells [C-EST]), with a 16-point volume-versus-level table and spill cell per basin.
6. Gap field: one short ray along the outward normal per water cell (2.3 M rays, under 0.1 s) gives the distance to the nearest other surface up to 10 mm, stored log-encoded. Used for capillary retention, nesting, droplet access and stagnant-gap exchange.
7. Contact links from the rigid-body contact manifold and from gap minima below 0.5 mm.
8. Upstream catchment area per cell (one steady accumulation pass, section 6.8), used by the thermal coupling.

---

## 4. Machine hydraulics and spray-arm kinematics

This layer is taken from the machine dossier without change of physics; my additions are the similarity classes (4.3) and the period snapping (4.4). It runs on the CPU in f64 and costs nothing.

### 4.1 Operating point

For each open branch j (lower, mid, top) with static lift z_j, feed loss K_j and nozzle set (C_d A)_j, and pump speed N (machine §12.2):

```
Q_j(p)    = sqrt( max(p - rho g z_j, 0) / ( K_j + rho / (2 (C_d A)_j^2) ) )            [m3/s]
Q_pump(p) = sqrt( max( H_0 (N/N_0)^2 f_H - p/(rho g), 0 ) / b )                        [m3/s]
solve   sum_j Q_j(p) = Q_pump(p)   for p by bisection (60 iterations, f64)
p_arm,j = p - rho g z_j - K_j Q_j^2
Q_i     = C_d,i A_i sqrt(2 p_arm / rho)          per nozzle i
V_rel,i = C_v sqrt(2 p_arm / rho)
d_i     = d_n,i sqrt(C_c,i),   C_c,i = C_d,i / C_v
```

Defaults: H_0 = 5.5 m, b = 4.80 x 10^6 m/(m3/s)^2, N_0 = 3000 rpm, lifts 0.15, 0.52, 0.80 m, K = 2.0 x 10^10, 5.6 x 10^10, 1.07 x 10^12 Pa s2/m6 (machine §4.2, §4.3 [ESTIMATED]); nozzle tables of machine §3.2 (L1 to L10 radii and angles [VERIFIED], everything else [ESTIMATED]); C_v = 0.97 (jets §11.3 [RECALLED]; see conflict note in section 15.3). f_H is the air-ingestion derating of 4.5.

### 4.2 Arm speed, stall and contact

```
I dw/dt = sum_i mdot_i r_i ( V_rel,i t_i - w r_i ) - ( k_f |F_ax| + c_v w ) sgn(w) - T_contact
t_i     = cos(rho_i) sin(theta_i)                      trailing-tangential direction cosine
F_ax    = p_arm A_hub + s ( F_jz + W ),   F_jz = sum_i mdot_i V_rel,i sin(rho_i)
steady: w = ( sum_i mdot_i V_rel,i r_i t_i - k_f |F_ax| ) / ( sum_i mdot_i r_i^2 + c_v ),  clipped at 0
```

(machine §3.3; k_f = 9.3, 3.8, 5.0 mm and c_v = 0.002, 0.002, 0.0005 N m s [ESTIMATED], tuned to 35, 30, 60 rpm at 3000 rpm.) The arm stalls when T_contact exceeds the drive minus friction at w = 0 (about 0.07 N m for the lower arm, i.e. 0.3 N at the tip). T_contact comes from the rigid-body engine (section 9). A knocking arm (contact below stall) has a phase-dependent speed w(phase) from the transient equation; phases are then sampled uniformly in time, not in angle.

A stalled arm is not a special case downstream: it is an exposure state with one phase, continuous jets on fixed lines, and a steady runoff solve.

### 4.3 Hydraulic states and similarity classes

A **hydraulic state** is (diverter state, pump-speed class). Diverter states L (lower), U (mid + top), A (all) and their timing come from the programme (machine §4.4, §7.3 [ESTIMATED]: L/U 60/60 s typical; A for the first 20 s after a fill and the last 30 s of the final rinse). The 1.5 s diverter transition is treated as an instantaneous switch (2.5 % of the time at 60 s periods).

Jets are almost straight (gravity deflects an 8 m/s jet by at most 7 mm over 0.3 m of flight and 16 mm over 0.45 m [C-EST: g t^2/2]), so an 8 % change of jet speed moves a track by about 1 mm in the lower rack and 2.5 mm in the upper rack; only magnitudes change. Pump speeds within +/- 8 % of a class centre therefore share one set of geometry-dependent records (tracks, parcel paths, routing) and are rescaled analytically: V and Q proportional to N; stagnation pressure and M proportional to V^2; boundary-layer-zone shear proportional to V^(3/2); R_j proportional to Q^(3/4); dwell proportional to 1/w(N). The neglected change of footprint extent is +/- 6 % of R_j, about 2.5 mm [C-EST]. With this rule every baseline programme of machine §7.3 needs one class (ECO 2600 to 2800 rpm; AUTO 2600 to 3000; INTENSIVE 3000 to 3400; QUICK 3000 to 3200; GLASS 2200). A programme whose speeds span more than +/- 8 % gets a second class, whose exposure set is computed as a re-exposure under the reserve rule of section 11.4; this is known before the run from the programme table.

### 4.4 Periods

Each exposure state has a master arm (lower in L; mid in U) with period T_master. In state U the top arm's speed is snapped to the nearest half-integer multiple of the mid arm's speed (baseline 60 and 30 rpm: ratio 2, no snap), so that the forcing is exactly periodic over one or two master revolutions. The snap changes the top arm's dwell by at most 12 % when the true ratio is near 2 [C-EST], small against the uncertainty of arm speed itself (20 to 60 rpm, machine §13). State A (two incommensurate large arms, used for under one minute per programme) is never time-marched: its jets are analytic per arm and its runoff uses the steady solve (section 6.8).

### 4.5 Water inventory and loss of prime

```
V_sump = V_total - V_pipes(open branches) - V_air - V_film - V_trap - V_filter - V_absorbed
alpha  = clamp( 1 - V_sump / V_min, 0, 0.6 ),   f_H = max( 1 - 2.5 alpha, 0 )
```

(machine §4.5 [ESTIMATED]; V_min = 0.5 L.) Unlike the dossier's placeholder Q (t_flight + t_return), V_air and V_film are measured from the simulation: V_air is the sum over parcels of mass flow times flight time; V_film is the time-mean film, bead and edge-store mass of the runoff solve; V_trap is the current pool volume. A falling f_H lowers jet speed as sqrt(f_H). Down to f_H = 0.85 (8 % in speed) the state stays inside its similarity class. Below that the same rescaling is still applied, outside its nominal band, and the report flags the affected phases: tracks are then displaced by up to a few millimetres and footprint extents are off by more than 6 %. I accept this instead of recomputing the exposure, because a load that starves the pump has already failed on the items that hold the water, and jets of a pump that ingests air are aerated in ways no dossier could quantify (jets, known gap 8). If the reduced drive torque stalls an arm, the stalled-arm state of 4.2 is computed; it is cheap.

### 4.6 What this layer hands to the jets

Per hydraulic state: arm angular speeds and start phases (seeded), and per nozzle the arm-frame position, aim, Q_i, V_rel,i, d_i, shape (round or slot) and liquor temperature. Arm angle is phase = (integer step counter mod steps per revolution), never accumulated time (numerics §6.3).

---

## 5. Jets and droplets

### 5.1 Sampling

| Quantity | Official | Fast | Preview | Why |
|---|---|---|---|---|
| Arm phases per revolution, N_phi | 16,384 | 4,096 | 2,048 | At grazing incidence the footprint moves at v_n / tan(phi): 1.6 m/s at 20 degrees and 6.9 m/s at 5 degrees for a nozzle moving at 0.6 m/s (jets §2.6 [ESTIMATED]). With 4,096 phases the footprint steps 2.9 mm per phase at 5 degrees, wider than the 2 mm stagnation stripe; with 16,384 it steps 0.7 mm. The numerics dossier's estimate of 840 to 2,100 phases counts nozzle travel, not footprint travel, and is too low by this "lighthouse" factor |
| Sub-rays per round jet | 19 (centre, 6 at 0.5 r0, 12 at 0.87 r0; equal-area weights) | 7 | 7 | partial hits on rims, wires, tines (jets §7.3) |
| Slot nozzle | 9 round sub-jets across the fan angle, each with 7 sub-rays | 5 x 7 | 5 x 7 | jets §2.5 [ESTIMATED]; 7 of the 28 baseline nozzles are slots |

Primary cost at the official tier: 16,384 x 56 nozzle-states x 19 x 1.25 = 2.2 x 10^7 rays per pass, a few segments each. Seconds.

### 5.2 Launch, flight and break-up

```
u0   = V_rel Rz(Theta) n_i + Omega z_hat x P(Theta)                    lab-frame exit velocity   (jets eq. 2.3)
x(t) = P + u0 (t - t0) + (1/2) g (t - t0)^2                            coherent jet: gravity only (jets §3.1)
L_b  = C_b d ( sqrt(We) + 3 We / Re ),   C_b = 6 (3.3 to 12)           (jets eq. 3.1; bounds [VERIFIED], default [ESTIMATED])
f_c(s) = 1 for s <= 0.6 L_b;  1 - (s - 0.6 L_b)/(0.8 L_b) between;  0 for s >= 1.4 L_b      (jets eq. 3.2 [ESTIMATED])
```

We and Re use gamma_w(T) and nu(T): surfactant does not change jet or splatter behaviour at millisecond surface ages (jets §4.5 [VERIFIED]). Paths are traced in segments whose chord sag g dt^2/8 stays under 0.1 mm (dt at most 9 ms). A parcel arriving with coherent probability f_c contributes a coherent footprint with weight f_c and a droplet-train footprint with weight 1 - f_c: drops of 1.9 d (jets §3.5 [ESTIMATED]), stress efficiency k_drop = 0.7 (0.3 to 1.5, jets §6.6 [ESTIMATED]) and the plateau splash fraction 0.3 sin(phi) (jets §6.5).

Rain interference: droplet parcels (5.8) accumulate path-length-weighted number density on a 1 cm grid; each primary ray's coherent weight is multiplied by exp(-k_int integral n sigma_c ds), sigma_c = pi ((d + D)/2)^2, k_int = 1 (0 to 2) (numerics §4.4 [ESTIMATED]). Fixed two-pass order: primary rays, parcels, primary weights updated; parcels are not re-run.

### 5.3 Classifying the hit

Each sub-ray returns a primitive with a feature tag set at asset build: smooth face, rim (with radius), wire or tine (with width D_w), sharp edge.

- **Smooth face.** Sub-rays of one nozzle at one phase that land on the same patch are merged into a footprint (5.4).
- **Wire, tine or rim narrower than 3 d**, struck by a fraction f_hit of the sub-rays (jets §7.3 [ESTIMATED throughout]): the passing part (1 - f_hit) Q continues as a jet of diameter d sqrt(1 - f_hit), deflected 5 degrees x f_hit away from the wire, with C_b reset to 3.3; it is re-traced as a second-generation bundle (at most three generations). The intercepted part loads the wire cell with stagnation stresses on a footprint limited to D_w, leaves f_ret = 0.05 on the wire, and sends the rest into two fan sheets (centred 40 degrees from the incoming direction, +/- 20 degrees in plane, +/- 15 degrees along the wire, speed 0.8 V, drops of median 0.25 d) that become droplet parcels.
- **Edge of a face.** The bundle is split geometrically: the part on the face is a partial footprint with Q_hit = f_hit Q; the rest continues.

### 5.4 Footprint record

Per (nozzle, phase, patch): Q_hit, impact speed V and direction, centroid O in patch coordinates, incidence phi = asin(|u . n| / |u|), forward tangent e_t, source point S = O - r0 cot(phi) e_t (jets §4.7 [VERIFIED geometry]), coherent weight f_c, flight time (which fixes the arrival phase bin), and the footprint velocity v_s by difference with the neighbouring phases. 48 bytes; about 0.9 M records per diverter state.

### 5.5 Impingement closures and the track integral

Along each azimuth psi about S (psi = 0 forward), with x = r/d or r/d_eq as appropriate (all jets §4.2 to §4.7; tags as there):

```
flow per radian     q(psi)   = (V r0^2 / 2) sin^3(phi) / (1 - cos(psi) cos(phi))^2                        [VERIFIED]
equivalent jet      d_eq     = sqrt(8 q / V),   Re_eq = V d_eq / nu,   Q_eq = 2 pi q (1 - xi)
pressure            p_w      = p_s sin^2(phi) sech^2( 0.916 X + 0.95 X^3 ),  p_s = rho V^2/2,
                    X        = sqrt( (x_f sin(phi))^2 + x_l^2 ) / d                                       [ESTIMATED]
stagnation shear    tau      = k_stag 1.150 rho (V sin(phi))^2 Re_n^(-1/2) X,   Re_n = V sin(phi) d / nu  [ESTIMATED]
boundary-layer zone tau      = k_film 0.472 rho V^2 Re_eq^(-1/2) x^(-1/2);  h/d_eq = 0.125/x + 1.06 Re_eq^(-1/2) x^(1/2)   [VERIFIED]
                    up to    r_b = 0.24 Re_eq^(1/3) d_eq
laminar zone        h/d_eq   = 3.792 x^2 / Re_eq + 0.1975 / x;   tau = mu V / (4 r (h/d_eq)^2)            [VERIFIED]
                    up to    r_t = 0.2964 Re_eq^(1/3) d_eq
turbulent zone      U_av     = V / ( 0.167 Re_eq^(-1/4) x^(9/4) + 2.37 - 0.0108 Re_eq^(1/2) )
                    h/d_eq   = 0.0209 Re_eq^(-1/4) x^(5/4) + (0.296 - 0.001356 Re_eq^(1/2)) / x
                    tau      = 0.0478 rho Re_eq^(-1/4) U_av^2 x^(1/4)                                     [VERIFIED]
momentum flux       M        = (64/63) rho q(psi) U_av        (per unit width at radius r: divide by r)   [VERIFIED]
outer limit         r_lim    = min( R_j(psi), r*(psi), geodesic distance to an edge )
                    R_j      = 0.289 Q_eq^(3/4) ( rho / (nu gamma_w) )^(1/4)                              [VERIFIED]
                    r*       : U_av(r*) = v_s . e_r   (film cannot lead a footprint that outruns it)      [ESTIMATED]
pre-wetted wall     front-speed factor 1 / (1 + sqrt(h_res / h)) when h_res > 0.3 h                       [ESTIMATED]
```

k_stag = 1 and k_film = 1 by default. h_res is the film thickness the runoff solve recorded for that cell and phase bin.

**How this becomes exposure on soil cells.** Not by splatting a disc per phase. Each soil cell gathers from the track segments that pass within r_lim of it. A per-patch bin grid (8 mm bins in patch coordinates) lists the footprint records whose influence region overlaps each bin. For each (soil cell, footprint phase) pair the kernel evaluates the closures above at the cell's position relative to S in the patch metric (tangent-plane distance when |curvature| r < 0.5, geodesic polar coordinates otherwise) and accumulates, over the contiguous run of phases that forms one pass: peak tau, peak M, peak p, phase of the peak, and the time spent above 3, 10, 30 and 100 Pa. Cells within 2 d of the track use every phase (spacing 0.1 to 0.7 mm, under 0.36 d); cells further out use every fourth phase with weight four, because the field is smooth there. The sums are float additions in fixed phase order, so they are reproducible without atomics.

Why a gather and not a per-phase splat: it is deterministic in f32, its cost is proportional to the area actually inside fast-film zones (about 20 % of soiled cells [C-EST from jets §9.2]), and it integrates along the track instead of point-sampling it, which is what the jets dossier asks for (its eq. 3.25).

The four strongest passes per revolution are kept as events; weaker and additional passes go into an aggregate (section 7.3). The gather is repeated at two liquor temperatures (20 and 50 C by default) and interpolated in log nu, because r_b, r_t and R_j move with nu (R_j by 18 % between 20 and 50 C [C-EST from the formula]).

### 5.6 Leaving the jet zone: hand-over, edges, vessel interiors

For every fourth phase and 32 azimuth sectors, a **surface walk** follows the film ray from S along the surface in 1 mm steps until r_lim (on revolution patches the ray is a geodesic and obeys Clairaut's relation r sin(alpha) = constant exactly; on planar patches it is a straight line). The walk decides what happens to the flux q(psi)(1 - xi) of that sector:

| Where the ray ends | Outcome |
|---|---|
| At R_j or r* on an upward or vertical face, or on an underside steeper than 15 degrees from horizontal | **Hand-over to runoff**: the mass is added to the deposition table of the cell one relaxation length beyond the end point, L_relax = U_av 4 h^2 / (pi^2 nu) (films §3.6 [ESTIMATED]; 6 to 70 mm), in the phase bin of its arrival time |
| At R_j on an underside within 15 degrees of horizontal [C-EST threshold] | **Departure**: the film leaves where M falls to gamma_w and falls as threads or a bell (jets §8.1 [VERIFIED]); emitted as droplet parcels with radial speed U_av(R_j), median diameter 2 mm (1 to 4) [C-EST] |
| At a rim or sharp edge with M > 2 gamma_w | **Free sheet** leaving tangentially at U_av (Taylor criterion, jets §7.2 [VERIFIED criterion, ESTIMATED application]); droplet parcels of median 3 h |
| At a rim or edge with M <= 2 gamma_w | hand-over to runoff at the edge cell; the gravity model decides whether it clings (6.5) |
| At a concave corner (base-to-wall junction inside a vessel) | the walk continues across the corner; this is the "ceiling film plus falling wall film" pattern of jets §8.2. If R_j is shorter than the distance to the corner the departure rule applies and the curtain falls inside the vessel as parcels |

So the interior of an inverted glass, mug or bowl needs no special model: it is the same radial-film closure walked along geodesics of the inner face, with the departure rule for ceilings. This is still the weakest part of the jet chain, because jets §8.2 is [ESTIMATED] end to end (transient entry, the returning curtain crossing the incoming jet, air trapped in the vessel are not modelled).

### 5.7 Splatter

```
omega = We exp( 0.971 (l/d) / sqrt(We) )
xi_BL = max( 0, -0.258 + 7.85e-5 w - 2.51e-9 w^2 ),  w = min(omega, 11,000)          (jets eq. 5.1, 5.2 [VERIFIED], cap [ESTIMATED])
S_W   = clamp( 4.6e-5 ( V d / nu_20 - 12,000 ), 0, 0.40 )                              (jets eq. 5.4 [ESTIMATED from VERIFIED points])
xi    = k_S max( xi_BL, S_W ) sin(phi),   k_S = 0.5 (0 to 1)
```

Splattered mass leaves at r_s = 4.5 d_eq, 20 degrees above the wall (uniform 10 to 30), at 0.7 V (uniform 0.4 to 0.9), with log-normal diameter of median 0.08 d and geometric standard deviation 1.8, truncated to 0.01 to 0.4 d (jets §5.6; ranges [VERIFIED], distribution [ESTIMATED]). k_S is the single most consequential closure constant in the design (section 2, rank 2) and is the first bracket parameter.

### 5.8 Droplet parcels

Sources: splatter (5.7), wire and rim fans (5.3), free sheets and departures (5.6), droplet-train splash (5.2), and, during the runoff solve, drips, columns and sheets from drip sites and separating edges (6.5).

A parcel is (position, velocity, diameter D, represented mass per revolution, emission time). It is generated inside the kernel from a counter (no parcel list is stored for the primary sources: parcel index maps to state, nozzle, phase, sector, sample), then traced:

```
du/dt = g - (3/4) C_D (rho_g / rho) |u| u / D
C_D   = (24 / Re_p)(1 + 0.15 Re_p^0.687)  for Re_p < 1000,  0.44 otherwise,   Re_p = rho_g |u| D / mu_g     (jets §3.7 [RECALLED])
```

in still air, with an exponential (unconditionally stable) drag update, segments limited by the 0.1 mm sag rule and by 20 mm. Once a droplet is within 5 % of terminal velocity it is finished with a single straight ray. At most 32 segments.

At a wall, with We_n = rho V_n^2 D / gamma_w and La = rho gamma_w D / mu^2 (jets §6.2, §6.3, §11.2):

| Wall | Condition | Outcome |
|---|---|---|
| wet (h_res > 20 um) | We_n < 2 | stick |
| wet | 2 to 20 | rebound: normal restitution 0.993 - 1.76 a + 1.56 a^2 - 0.49 a^3 (a = angle from the wall, rad), tangential x 5/7; traced on (at most 3 bounces) |
| wet | 20 to 1,320 La^(-0.183) | deposit |
| dry | below 2,630 La^(-0.183) | deposit |
| either | above | splash: mass ratio r_m = clamp(0.1 (We_n/We_c - 1), 0, 0.3), or up to 0.5 on a film thicker than 0.1 D; two secondary parcels at 10 to 40 degrees above the wall, 0.3 to 1.2 V_n plus 0.7 of the tangential velocity, median 0.08 D; no second generation |
| wire or tine | D >= 0.5 D_w and We_n > 20 | split into two fragments at +/- 20 to 40 degrees, f_ret captured; otherwise captured |

Thresholds [VERIFIED] (OpenFOAM constants); r_m and secondary properties [ESTIMATED] (jets §6.4, chosen below Bai-Gosman because measured splash of millimetre drops is under 14 %). Wet or dry at the first Monte Carlo pass is decided by material (receding angle at most 10 degrees counts as wet) and by the jet-wet mask; the fraction of deposits for which the later runoff state contradicts that assumption is a logged diagnostic.

Deposits are added with `atomicAdd` on u32 fixed-point counters (unit 10^-11 kg) into the table Dep[water cell][phase bin], 64 bins per master revolution, the bin taken from emission time plus flight time. Two more counters per cell accumulate the area-time of droplet impacts whose stagnation shear k_drop 0.63 rho V_n^2 Re_n^(-1/2) exceeds 3 Pa and 10 Pa (footprint radius 0.5 beta_max D, duration 2 D / V_n, beta_max = 0.61 (Re_n^2 Oh)^(1/6); jets §6.6 [ESTIMATED]). A droplet larger than the gap at its landing cell (gap field, 3.6) is credited to that gap's capillary store instead of the film.

Sample counts: 4 x 10^8 parcels per large diverter state at the official tier. Averaged over 10.6 m2 that is 38 parcels per mm2; a region receiving 1 % of the mean flux gets 38 parcels per cm2 and one receiving 0.1 % gets 3.8 per cm2 [C-SCRIPT]. What matters is the time a sparsely rained surface needs to collect the wetting threshold rho delta_wet (about 100 g/m2): 71 s at 1 % of the mean flux of 140 g/(m2 s), 12 minutes at 0.1 %, 80 minutes at 0.015 % [C-EST]. So flux down to about 10^-4 of the mean is outcome-relevant and below that it is not. To hold the noise near 25 % over that whole range, the deposition used for wetting decisions is taken from the smallest of three fixed smoothing levels (3 x 3, 9 x 9, 27 x 27 water cells in patch coordinates) that contains at least 16 parcels; a per-cell parcel-count table drives the choice. Mist is diffuse, so smoothing sparse regions over centimetres loses little; hand-over, sheet and drip deposits are dense and stay at cell resolution. The physical droplet rain is far denser than the parcels: at 1 % of mean flux, 0.16 mm droplets arrive at 0.66 per mm2 per second [C-SCRIPT].

### 5.9 Rain from above and cascades

Three routes bring water down onto items, all carried by the same parcel tracer: (i) direct downward jets (M9, M10, T1 to T6) are primary jets; (ii) splatter and departures from ceilings and from the undersides of upper-rack items; (iii) drips, columns and sheets from drip sites, which exist only once the runoff solve has routed water to them. Route (iii) is why runoff and parcels are co-simulated in time (section 6.3): each phase bin, the drip sites' emissions are traced and deposited into a future-bin ring that the runoff solve reads when simulated time reaches that bin. The cascade through the third rack, upper rack, lower rack and floor establishes itself in about three revolutions (drain time 0.2 to 1 s per level plus 0.1 to 0.3 s of fall).

### 5.10 Analytic or simulated

| Element | Treatment |
|---|---|
| Nozzle discharge, jet launch, coherent flight | analytic |
| First hit, shadowing, partial hits | simulated exactly (rays against exact primitives) |
| Break-up state on arrival | analytic probability |
| Stagnation pressure, wall shear, fast film, film jump, oblique split | analytic closures, integrated numerically along the track |
| Sweeping footprint | analytic kinematics on quasi-steady closures; to be replaced by tables from offline resolved runs (section 14) |
| Splatter amount and droplet properties | closure; droplets then simulated |
| Wires, rims, tines | rules for the split; fans then simulated as droplets |
| Vessel interiors | analytic film on simulated geodesics; departures simulated as droplets |
| Droplet flight, wall regime, one splash generation | simulated (Monte Carlo) |
| Drips and cascades | emitted by the runoff model, simulated as droplets |
| Air motion in the tub | not modelled (still air) |

### 5.11 Loads on items

Per footprint: F_n = rho Q_hit V sin(phi) along -n at O; F_t = c_t rho Q_hit V cos(phi) along e_t with c_t = 0.2 (jets §11.2 step 5f [ESTIMATED]); multiplied by a turning factor c_turn = 1.8 when the hit is on the inner face of a cavity whose opening faces the nozzle and the surface walk shows the film returning through the opening, else 1 (items §4.3: 1 to 2; calibration). Summed per item into a force and torque series over 256 phase bins. This needs only the primary-ray pass, so it is available in a fraction of a second (section 9).

---

## 6. Water on surfaces

### 6.1 Model and governing equations

State per water cell i: film mass per area m_i (kg/m2; h_i = m_i / rho), bead store b_i (kg/m2), wetting regime F_i (dry, bead, rivulet, film), dewetting clock, and for special cells an edge reservoir or pool membership.

Mass balance:

```
A_i dm_i/dt = sum_j w_ji Q_j  -  Q_i  +  A_i ( S_dep,i - S_evap,i )  -  Q_sep,i  -  Q_store,i            [kg/s]
```

Discharge (the closure that replaces the momentum equation):

```
Q_i        = rho W_i f_i q_eq( h_i / f_i ; g_s,i )
q_eq(h; g_s) = min(  g_s h^3 / (3 nu) ,   h [ (2 g_s h / 0.288) (4 h / nu)^0.4 ]^(0.625)  )               [m2/s]
tau_f,i    = rho g_s,i h_i / f_i                                                                           [Pa]
```

W_i is the cell's width across the flow, f_i its wetted width fraction (6.4), g_s,i = g sin(beta_i). q_eq is the steady flux of a film whose wall friction follows f = max(24/Re, 0.288 Re^(-0.40)), Re = 4 q / nu (films §3.3: laminar Nusselt branch [RECALLED and cross-checked], Brauer turbulent branch [VERIFIED correlation, ESTIMATED conversion]); the two branches cross at Re = 1,608. tau_f is the corresponding equilibrium wall shear; it equals the Nusselt value rho g h sin(beta) = 3 mu u / h in the laminar branch.

What is deliberately absent: the momentum equation (film inertia), the hydrostatic pressure gradient along the surface, and the capillary pressure. Their physical content is supplied as follows.

| Dropped term | Where it matters | Replaced by |
|---|---|---|
| Inertia | within 1 to 7 cm of a jet footprint (films §3.6); acceleration zone below a strong source; edge overshoot | analytic jet zone to R_j plus relaxation offset L_relax (5.6); Weber-number edge rule on the equilibrium velocity (6.5) |
| Hydrostatic pressure gradient | lateral spreading on gently sloped faces; pools; puddles on flats | two-neighbour flow splitting (6.2); lumped pools and puddles (6.6) |
| Capillary pressure and contact-line force | wet/dry fronts, rivulets, beads, pendant drops, bridges | wetting regime machine (6.4), drip-site stores (6.5), capillary stores (6.7) |

### 6.2 Routing links

For each cell the direction of flow is the exact tangential gravity direction g_hat = g_t / |g_t| computed from the analytic normal, not a finite difference of cell heights. Among the up to eight neighbours k, with tangent-plane offsets d_ik, the two whose directions bracket g_hat most closely (angles a- < 0 < a+, both within 90 degrees) receive

```
w_i,k+ = |a-| / (|a-| + a+),    w_i,k- = a+ / (|a-| + a+)
```

which is Tarboton's D-infinity rule generalised to irregular neighbours. The mean transport direction is exact for any orientation of the patch grid relative to gravity. The price is numerical lateral dispersion when the flow is oblique to the grid: a point source spreads to a lateral standard deviation of 8.5 to 10 mm after 0.2 m on 2 mm cells (zero when flow is aligned with a grid line) [C-SCRIPT]. Physical hydrostatic spreading over the same path is 4 to 8 mm at 60 to 80 degrees tilt and 12 to 26 mm at 10 to 30 degrees [C-SCRIPT from the lubrication diffusivity g cos(beta) h^3/(3 nu)]. So on steep faces the model over-spreads narrow streams by up to a factor of about two and on gentle slopes it under-spreads them by about the same; broad sources (a jet's drained film is 80 to 200 mm wide, mist is uniform) are unaffected.

In rivulet regime the split is replaced by a single link, chosen between k+ and k- with probabilities w by a frozen hash of (item, cell): one-cell-wide paths that follow the true direction on average and wander deterministically. That is the role Meredith's frozen random contact-angle field plays in a contact-line-force model.

A cell with no neighbour in the downhill half-plane is terminal and is classified at set-up (6.5, 6.6).

### 6.3 Numerical scheme and time stepping

Unsteady solve ("R1"). Per step, for every cell in parallel (a gather over up to 8 donors):

```
a_i        = m_i^n + (dt / A_i) sum_j w_ji Q_j^n + dt ( S_dep,i^n - S_evap,i )
solve      m + (dt / A_i) Q_i(m) = a_i          for m in [0, a_i]       (4 safeguarded Newton iterations, fixed count)
m_i^(n+1)  = m
Q_i^(n+1)  = ( a_i - m ) A_i / dt                                         (exactly what left the cell)
```

Outflow is implicit, inflow is the donors' outflow from the previous step. Properties: unconditionally positive; unconditionally stable; exactly conservative (the link buffer Q dt is a store that is counted in the inventory); a cell can never empty completely in one step, so drained tails persist as they should. An explicit version with a "do not take more than the cell holds" limiter is cheaper per step but fails on thick slugs (a slug crossing more than one cell per step is translated as a block and leaves no tail, which destroyed the wet fraction in my test [C-SCRIPT, first version of the script]); the implicit form does not.

Time step: dt = T_master / N_s, N_s the smallest multiple of 64 with dt at most 1.7 ms at the official tier (N_s = 1,024 for 35 rpm; 1,216 for 30 rpm) and 3.4 ms at the fast tier. Fixed before the run; no local or adaptive stepping in the periodic solve. Information moves one cell per step, so waves faster than 1.2 m/s (2 mm cells) pile up slightly instead of running ahead; the measured effect is in 6.9.

Coupling with parcels: 64 phase bins per master revolution, 16 or 19 steps each. In each bin the solve reads the primary deposition table and the drip ring for that bin; at the end of each bin the drip-site and separating-edge emissions of the bin are turned into parcels (at most one parcel per site and bin, at most 10^5), traced, and deposited into the ring at their arrival bins. All on the GPU with fixed-size buffers; four bins per submit.

Revolutions: 3 spin-up + 2 recorded for the first liquor class of each diverter state; 2 + 1 for the other liquor classes, warm-started. Statistics are accumulated only in recorded revolutions.

Drain-down solve: from the periodic state, all sources are switched off and the solve continues for 60 simulated seconds on a fixed geometric schedule, dt_k = dt_0 x 2^floor(k/512) capped at 0.25 s (3,129 steps, 3.06 revolution-equivalents; the cap is not reached within 60 s). A draining film at distance s below the top of the wetted region has wave speed s/t, so a step that grows in proportion to t keeps the Courant number constant: about (s/Delta_s)/512, i.e. 0.24 at the bottom of a 0.25 m face on 2 mm cells. Measured against Jeffreys' law on a vertical 0.25 m plate, the thickness after 2, 10 and 60 s is 3 to 9 % high and the mean retained load 5 to 7 % high; the fast tier's schedule (doubling every 192 steps, 1,434 steps) is 5 to 18 % high [C-SCRIPT: `drain.py`]. The excess is the numerical diffusion of the first-order scheme and has the same sign everywhere.

### 6.4 Wetting and dewetting

Per cell, from material, soil cover and liquor class: advancing and receding angles (films §12.7 table [ESTIMATED], mixed with the covered fraction of soil as a Cassie average of cosines), and

```
delta*_x = [ 15 mu^2 sigma (1 - cos(theta_x)) / (rho^3 g^2) ]^(1/5),   x = a, r                   (Hartley-Murgatroyd, films §5.4 [VERIFIED])
Gamma*_x = [ rho^2 g delta*_x^3 / (3 mu) ] max(sin(beta), 0.1)^(-n_beta),   n_beta = 0 (0 to 0.2)   [C-EST for the tilt exponent]
delta_wet = kappa_w delta*_a,  kappa_w = 0.5                                              (films §12.4, after Meredith [VERIFIED])
b_max    = rho C_b l_c ( cos(theta_r) - cos(theta_a) ) / max(sin(beta), 0.1),  C_b = 0.03  (films §12.4 [ESTIMATED])
t_dw     = l_dw / V_dw,   V_dw = min( k_dw (sigma/mu) theta_r^3 ,  sqrt( sigma (1 - cos(theta_r)) / (rho h) ) ),
           k_dw = 5e-3 (films §5.5 [RECALLED]),  l_dw = 10 mm [C-EST]
```

Reference values at 55 C [C-SCRIPT]: Gamma* = 0.005 kg/(m s) at 5 degrees and 0.011 at 10 degrees in wash liquor (sigma = 40 mN/m); 0.065 at 45 degrees; 0.14 at 95 degrees. The time-mean supply is 0.01 to 0.05 kg/(m s) (films §1.2).

On the tilt exponent: the Hartley-Murgatroyd balance written with the downslope component of gravity gives n_beta = 0.2, i.e. a threshold 1.6 times higher at 5 degrees from horizontal than on a vertical wall. The one data set the dossiers contain says otherwise: on acrylic with water at 43 C the rivulet-to-film transition lies at 0.125 to 0.21 kg/(m s) at 90 degrees and at 0.108 to 0.174 at 5 degrees (films §12.10 [VERIFIED]). With mu = 6.2 x 10^-4 Pa s, sigma = 0.069 N/m and theta_a = 75 degrees the vertical formula gives 0.163 kg/(m s) [C-EST], inside both bands; multiplied by 1.6 it would be outside the second. I therefore take the threshold as independent of tilt and keep n_beta as a calibration parameter. This choice came out of writing the verification plan (section 13), not out of a dossier.

Regime machine:

| From | To | Condition |
|---|---|---|
| DRY | BEAD | any deposition (goes to b) |
| BEAD | RIVULET | b > rho delta_wet (spray wetting), or b > b_max (running drop), or inflow from a wet neighbour, or the jet-wet mask bit of this phase bin; b joins m |
| RIVULET | FILM | loading Gamma_i = Q_i / W_i >= Gamma*_a, or jet-wet bit |
| FILM | RIVULET | theta_r >= 5 degrees and Gamma_i < Gamma*_r continuously for longer than t_dw |
| RIVULET | BEAD | no inflow and m / f below rho delta_dry (delta_dry = 2 um); remaining liquid moves to b up to b_max |
| BEAD | DRY | b evaporated (drying phase only) |

Wetted width fraction: f = 1 in FILM; in RIVULET

```
f = max( f_min,  f_1 ( Gamma_i / Gamma*_a )^(1/4) ),    f_1 = 0.2,  f_min = 0.05        [C-EST closure on a VERIFIED band]
```

The anchor is the only measurement available: on acrylic the wetted-area fraction stayed between 0.1 and 0.2 throughout the rivulet regime and the surface then went over to a continuous film at the transition flow (films §5.2 [VERIFIED]). The quarter power is the growth of a rivulet's width with the flow it carries when the number of rivulets is fixed (flow in a shallow rivulet scales as width^4 at a given contact angle [C-EST]). The closure gives 0.11 to 0.2 for loadings from one tenth of the transition value up to it, and the jump from 0.2 to 1 at the transition is the regime change itself, with the hysteresis between Gamma*_a and Gamma*_r. A linear ramp f = Gamma / Gamma*_a, my first choice, would have put half-wetted surfaces where the experiment shows one fifth; it was dropped when I wrote the verification test for it. Inside a rivulet the local loading is Gamma / f, so rivulets are thick and fast: 0.02 kg/(m s) on vertical polypropylene in clean water at 55 C (Gamma*_a = 0.19) runs in tracks covering 11 % of the width, about 300 um thick, at 2.9 Pa [C-EST]. With theta_r below 5 degrees a film never breaks; it thins by drainage. In the step of 6.3, f is taken from the loading of the previous step, so the implicit solve stays a scalar equation in m.

The jet-wet mask (64 bits per cell, one per phase bin, written by the jet gather) is how a footprint re-wets a de-wetted plastic surface at every pass, which films §5.4 identifies as the only way such surfaces are film-wetted.

Sub-cell coverage for soil. Each soil cell has a frozen rank u in [0, 1), constant along flow lines (propagated from the main donor at set-up, hash-jittered) and stratified across them. A soil cell is under flowing water when its water cell is in FILM, or in RIVULET with u < f. Low-rank cells are in the rivulet tracks and are washed whenever anything flows; high-rank cells only in film regime. This gives stripe-shaped residue between rivulet tracks at soil-cell resolution without resolving rivulets on the water grid, and it is statistically equivalent, for the IEC area measure, to resolved rivulets of the same wetted fraction. A wander rate (fraction of ranks redrawn per minute) is a calibration parameter, default zero (frozen tracks are the conservative choice for cleaning).

### 6.5 Edges, dripping and cascades

- **Clinging or separating at a rim** (edge rings, exact radius r_e): We_e = rho u^2 h / sigma with u = q_eq / h; We_c = max(2, C_tp (r_e / h)(1 + cos(theta_a))), C_tp = 1 (films §12.5; form [VERIFIED] from Bouwhuis and Snoeijer, prefactor uncertain 0.5 to 3). If We_e > We_c the fraction clamp(0.882 - 1.908 exp(-(We_e/We_c)/1.264), 0, 1) of the discharge leaves as a sheet (parcels of median diameter 3 h, velocity u along the flow direction); the rest goes round the rim to the other face. Time-mean gravity films (We under 1) always cling; jet-pass pulses (We 2 to 15) partly separate at sharp rims.
- **Drip sites**: terminal cells that face sideways or down, and free ends (fork tips, wire ends, handle bottoms). Each has a reservoir m_e fed by the arriving discharge. With Ga = rho sigma^3 / (mu^4 g) and the site loading Gamma_e (arriving flow over the site length):
  - drop mode (Gamma_e below 0.048 mu Ga^0.301): when m_e reaches m_d a drop of mass m_d is released at rest; m_d = rho (pi/6)(3.3 l_c)^3 on a broad wetted edge (0.34 g in water, 0.16 g at sigma = 40 mN/m [C-SCRIPT]), 0.65 sigma P / g at a tip of wetted perimeter P;
  - column mode (up to 0.72 mu Ga^0.236): a continuous stream at the film velocity;
  - sheet mode above that.
  (films §12.5, §6.4: thresholds [VERIFIED as quoted]; whether Gamma is per side or total is unresolved in the dossier; I use per side and flag it.) After the supply stops each site keeps one last drop.
- **Level lower edges** (the rim of a glass sitting level, the lower edge of a level tray): runs of terminal cells at equal height within 0.5 mm are grouped into line sites of length 2 pi sqrt(2) l_c (23 mm in water, 18 mm in wash liquor; films §6.4 [VERIFIED]) with a seeded offset.
- **Near-horizontal undersides** (within 5 degrees of horizontal): mass above rho h*, h* = 3 l_c cos(alpha) / (1.62208 sin^(3/2)(alpha)), alpha from vertical (Brun criterion, films §3.5 [VERIFIED]), leaves as drops of diameter 3.3 l_c from sites spaced as above. All other undersides carry their film to their lowest edge.
- **Cascade**: every emission above becomes parcels that are traced to whatever is below (5.8, 5.9). A 6 mm drip falling 0.1 to 0.3 m lands at 1.4 to 2.4 m/s with We of 170 to 510, above the wet-wall splash threshold of about 100 [C-EST from the Bai-Gosman formula with gamma_w], so 8 to 30 % of it is thrown sideways as 0.5 mm secondaries: drips wet their surroundings, not just their landing point.

### 6.6 Pools and puddles

- **Basins.** A terminal cell that faces up is a pit; priority-flood (3.6) gives each basin its cells, spill cell, spill level and a volume-level table from the exact geometry. Cells below the current level are inactive for routing; discharge and parcels arriving in them go to the basin store. State: V_b, temperature, composition, settled solids. In the periodic solve basins are taken as full (inflow leaves at the spill cell). The fill transient is integrated in the timeline loop from the recorded inflow; until a basin is full, the recorded time-mean loading downstream of its spill cell is reduced by the basin's inflow using the linear steady solve (6.8). Pool volume also reduces the sump inventory (4.5) and adds weight to the item (section 9).
- **Mixing**: V dc/dt = eta_mix Q (c_in - c), integrated exactly per tick; eta_mix = 0.9 if a primary footprint or dense spray lands in the pool, 0.5 for through-flow, 0.1 when inflow and spill are on the same side (films §7.3 [ESTIMATED]).
- **Flat upward regions** (tilt under 2 degrees) bounded by convex edges are lumped puddles holding up to h_e = 2 l_c sin((theta_a + 180 degrees - edge angle)/2), capped (films §7.2 [ESTIMATED]; 3 to 5 mm), spilling at their lowest boundary cell.
- The wedge that remains in a tilted recess (P37) is not a formula in the code; it is what priority-flood returns for the tilted geometry. The formula is a verification target.

### 6.7 Contacts and capillary stores

- Each contact link holds a bridge store of 20 uL (5 to 50; films §12.5 [ESTIMATED]) that fills from either side and does not drain.
- A fraction xi_c = 0.5 (0 to 1) [C-EST, calibration] of the discharge reaching a contact cell transfers to the touching body's cell if that cell is lower; the rest continues on its own surface. This is how water running down a glass is led onto a rack wire instead of dripping from the rim.
- Cells whose gap to another surface is below 1 mm and that lie within the capillary rise height 2 sigma cos(theta) / (rho g w) above a contact or low point (standards P40: 13 mm at 0.5 mm gap in wash liquor) hold a gap store of half the gap per face. Gap cells narrower than 0.4 mm carry no film flow; their store is renewed only by diffusion (taken as zero renewal within a phase).

### 6.8 Steady solve ("R0")

The time-mean discharge field satisfies a linear balance, Q_i = sum_j w_ji Q_j + A_i S_i - sinks, which is solved by 400 Jacobi sweeps (more than the longest path in cells) at about a millisecond each. The time-mean loading of every cell is then exact for the given deposition and routing weights, independently of any film dynamics. R0 is used (i) for state A and for stalled arms, (ii) as the linear corrector for filling basins and for wetting refreshes, (iii) as the whole runoff model of the preview tier, where the regime is decided from the mean loading against Gamma*_r and Gamma*_a and the pulse statistics (flow duty, mean and peak thickness) come from a two-parameter pulsatility closure fitted to R1 output at build time, not to experiments.

### 6.9 What the kinematic approximation costs

I compared the scheme of 6.3 with a one-dimensional inertial depth-averaged reference (mass and momentum, momentum-flux factor 1.2, the same friction law treated implicitly, 0.5 mm cells, 20 us steps) on a vertical 0.25 m plate at 55 C with a periodic source at the top (period 1.714 s). Ratios of model (2 mm cells, T/2048 steps) to reference at 0.05 / 0.125 / 0.24 m below the source [C-SCRIPT: `film1d_v2.py`]:

| Source | Peak loading (kg/(m s)) | h mean | tau mean | tau peak |
|---|---|---|---|---|
| 80 ms pulse, mean 0.005 | 0.11 | 1.07 / 1.01 / 1.01 | 1.04 / 1.00 / 1.01 | 0.88 / 0.75 / 0.74 |
| 80 ms pulse, mean 0.02 | 0.43 | 1.04 / 1.07 / 1.07 | 1.09 / 1.03 / 1.04 | 1.07 / 1.04 / 0.84 |
| 200 ms pulse, mean 0.03 | 0.26 | 1.04 / 1.06 / 1.05 | 1.08 / 1.03 / 1.04 | 0.94 / 1.00 / 1.00 |
| 80 ms pulse, mean 0.05 (stronger than a realistic hand-over) | 1.07 | 0.89 / 1.04 / 1.07 | 1.25 / 1.04 / 1.02 | 1.44 / 1.20 / 1.03 |
| 30 ms pulse, mean 0.05 (extreme slug) | 2.86 | 0.82 / 1.03 / 1.07 | 1.22 / 1.01 / 1.01 | 1.93 / 1.45 / 1.11 |
| steady 0.05 | 0.05 | 1.00 | 1.00 | 1.00 |

Further results of the same runs: the fraction of time with h above 30 um was 1.00 in model and reference in every pulsed case (a hydrophilic vertical plate fed once per revolution never drains dry); the fraction of time with tau above 1 Pa was higher in the model by 0.00 to 0.10; going to 4 mm cells and T/1024 changed means by 1 to 2 % and peaks by up to 13 %; going to T/512 at 2 mm changed means by under 1 % and lowered peaks by up to 20 %; the official step, T/1024 at 2 mm, differs from T/2048 by under 0.3 % in means and under 7 % in peaks [C-SCRIPT: `similarity.py`]. Realistic peak loadings are 0.1 to 0.4 kg/(m s) (a 25 to 50 mL/s jet draining through a band 110 to 200 mm wide [C-EST from jets §4.5]).

Reading: for realistic pulses the kinematic cascade is within 9 % on mean thickness and shear and within 26 % on peak shear everywhere; the known deficiency (no acceleration zone) shows as a 25 % over-prediction of mean shear in the first 5 cm below sources two to three times stronger than realistic. Against a starch threshold of 1 to 2 Pa and an input loading uncertain by a factor of two (26 % in shear), this is inside the budget of section 2. The limits of this evidence: one dimension, vertical only (my quick reference solver was not stable with the hydrostatic term, so tilted plates are untested), no lateral effects. Prototype 2 (section 14) repeats it in two dimensions against a proper reference.

A side result worth keeping in mind for the soil model: with a pulsed supply the time-mean shear is 0.76 to 1.2 Pa at a mean loading of 0.02 kg/(m s), against 1.42 Pa for the steady Nusselt film at the same mean loading. Steady-state formulas over-predict mean film shear by 20 to 90 %; this is the reason the official tier time-marches the cascade instead of using R0.

### 6.10 Long tails

Between jet passes, between diverter states (60 s without the lower arm) and after the pump stops, a draining film follows Jeffreys' law h = sqrt(mu s / (rho g sin(beta) t)) (films §8.1 [RECALLED and checked]). The cascade reproduces it by construction (it is the kinematic-wave similarity solution), so the drain-down solve of 6.3 delivers, per cell and per state, the thickness after 2, 10 and 60 s, the time at which the cell de-wets (if it does), the final bead load and whether an edge drop or bridge remains. Beyond 60 s the thickness is extrapolated as t^(-1/2). These records serve three purposes: the wetness of surfaces during the other diverter state and during pauses, the carry-over volume at each drain (chemistry §5.6, §10.2), and the initial condition for drying.

### 6.11 Heat transfer

The periodic solve carries no energy equation. Films equilibrate with the wall surface within a few centimetres and wetted items follow the liquor with a time constant of 2 to 25 s (films §9.2 [ESTIMATED]), which is short against the minutes over which the liquor heats, so element temperatures are integrated in the timeline loop:

```
C''_e dT_s,e/dt = f_flow,e U_e ( T_liq - T_s,e ) + ( 1 - f_flow,e ) h_a ( T_air - T_s,e ) + (k_w / l_w)( T_mid,e - T_s,e ) - j_e h_fg
U_e   = ( 1/alpha_fw + 1/G_e )^(-1),   alpha_fw = 1.88 k / h_mean  (films §9.1),   G_e = c_p Gamma_e W_e / A_up,e
```

G_e is the heat-capacity rate of the water passing the cell divided by its upstream catchment area A_up,e: it limits the heat an element can receive to what the water above it can carry, which reproduces "the lower part of a cold item sees cooler liquid" without an advected temperature field. Check: Gamma = 0.035 kg/(m s) over a 0.25 m catchment gives G = 585 W/(m2 K); half of a 6 mm porcelain wall stores 6.5 kJ/(m2 K); time constant 11 s [C-EST], inside the dossier's 10 to 25 s. The wall has a surface node per face and a shared mid node for ceramic, glass and plastic, one lumped node for metals (films §9.2). h_a = 30 W/(m2 K) for unwetted faces in humid air, condensation included (chemistry §10.10 [ESTIMATED]). Soil temperature equals the surface node (soils §7.5 E1).

### 6.12 Conservation properties

- Film mass: exact in flux form, including link buffers, edge reservoirs, bead, bridge, gap and pool stores. Checked every revolution: nozzle outflow = change of all stores + airborne + returned to the sump, tolerance 0.1 %.
- Parcel-to-film transfers go through integer counters; rounding is at most half a unit (5 x 10^-12 kg) per deposit and is tallied.
- The time-mean loading field equals the steady accumulation of the time-mean sources to within the recorded-revolution convergence error; the difference is a per-state diagnostic.
- Energy: element and liquor heat balance closed in the timeline loop (chemistry §10.13 check).
- No momentum is conserved in the runoff model, by construction. Jet momentum is accounted for up to the hand-over and in the loads on items.

---

## 7. Periodic forcing and whole-cycle integration

### 7.1 Exposure states

The forcing on a fixed load is periodic whenever the diverter state, the pump speed and the wetting properties of the liquor are fixed. I compute one set of exposure records per such combination and then replay the programme against them.

| Kind of state | Members for a baseline programme | How it is computed |
|---|---|---|
| Time-marched periodic state | diverter state {L, U} x liquor class {D, W, R}: 6 | primary bundles and jet gather per diverter state (at two viscosity points); Monte Carlo per diverter state; unsteady runoff R1 per state; drain-down R1 per state |
| State A (all arms; 20 s after each fill and the last 30 s of the final rinse, machine §7.3 [ESTIMATED]) | one per liquor class in which it occurs | superposition: the jet records and deposition tables of L and U rescaled to A's operating point by the similarity rule of 4.3; runoff by the steady solve R0 with the pulsatility closure of 7.5. Jet-on-jet interference between the two arms is neglected (under one minute per programme) |
| Stalled arm | replaces the affected diverter state | one phase, continuous jets, R0 |
| Knocking arm | replaces the affected diverter state | phases uniform in time from the transient arm equation (4.2); R1 as usual |
| Pump off (pauses, drains, fills, drying) | - | drain-down record of the last active state; beyond 60 s, t^(-1/2) extrapolation |

Liquor classes exist because surface tension and contact angles decide the wetting regime. They follow the columns of the material table in films §12.7 and the liquor defaults of films §12.8 (all [ESTIMATED]):

| Class | Used when | sigma (mN/m) | Contact-angle column | Reference temperature for nu |
|---|---|---|---|---|
| D | main wash after the dose has dissolved | 40 | main-wash liquor | 50 C |
| W | no effective surfactant: pre-rinse, wetting before the dispenser opens, the final rinse before rinse aid | 65 | clean water | 20 C |
| R | final rinse after the rinse-aid dose; rinses that carry enough surfactant | 45 | final rinse with rinse aid | 55 C |

At every tick the liquor model supplies sigma; the class with the nearest sigma is used (the intermediate rinse at about 55 mN/m falls to W or R depending on carry-over, which is itself computed). Differences inside a class are handled without new solves (7.5).

### 7.2 Spin-up, sampling and convergence

Order of work per diverter state: Monte Carlo, then R1 for class D, then W and R warm-started.

- **Initialisation from the steady solve.** R0 (6.8) gives the time-mean loading of every cell for the state's deposition table. Film mass is set to the equilibrium thickness for that loading, regimes are set from the loading against Gamma*_a and Gamma*_r, bead stores are set to their asymptotic value wherever any deposition arrives, basins are full, the drip ring is empty. The unsteady solve therefore starts with the right mean and only has to develop the pulses.
- **Revolutions.** Class D: 3 spin-up + 2 recorded. Classes W and R: 2 + 1. The slowest memory in the periodic solve is the cascade through three rack levels (0.2 to 1 s of drainage plus 0.1 to 0.3 s of fall per level, at most about 4 s, 2.3 revolutions). Slower processes are deliberately taken out of the periodic solve and integrated in the timeline: wetting onset of sparsely rained surfaces (7.6), pool filling, wall temperature, soil cover.
- **Drip sites in the periodic solve** emit the expected mass of each phase bin (flow times bin length) as one parcel with the drop's diameter and release velocity, even when the physical drop period is longer than a bin. Time-mean deposition below a slow dripper is then converged in two revolutions. The intermittency of slow drips is lost; it matters only for the onset of wetting, which the timeline handles. The drain-down solve emits discrete drops, because there the number of last drops is the result.
- **Convergence monitors**, per state, between the two recorded revolutions (D) or between the last spin-up and the recorded revolution (W, R):

  ```
  eps_Gamma = || Gamma_mean(rev 2) - Gamma_mean(rev 1) ||_2 / || Gamma_mean(rev 2) ||_2      (area-weighted over item cells)
  eps_wet   = area fraction of item cells whose wetDuty changed by more than 0.1
  eps_mass  = | nozzle outflow - (change of all stores + airborne + returned to the sump) | / nozzle outflow, per revolution
  ```

  Targets: eps_Gamma below 5 % (numerics §4.2 [ESTIMATED]), eps_wet below 2 %, eps_mass below 0.1 %. If a target is missed the state gets up to two more revolutions. That decision depends only on simulated values, so it is reproducible; its cost is in the reserve (section 11). If the state still fails, the run completes and the report names the state and the items that carry the residual (typically a basin that spills intermittently).
- **Monte Carlo noise** is estimated in every run by splitting the parcels into two halves by the lowest bit of the parcel index and accumulating two extra per-item scalars (deposited mass from each half). The relative difference is the per-item sampling error of the deposition; it is reported and it feeds sigma (section 11.3).

### 7.3 What is recorded: exact layouts

Three record types. Little-endian; f16 is IEEE half precision; "log u8" stores v = v_min (v_max / v_min)^(code / 255) with code 0 meaning zero.

**FilmExposure**, 24 bytes per water cell and exposure state (6 states). Written by R1 at the end of the recorded revolutions from integer and float accumulators.

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0 | gammaMean | f16 | g/(m s) | time-mean mass flow per unit width leaving the cell |
| 2 | gammaPeak | f16 | g/(m s) | largest phase-bin mean (64 bins) |
| 4 | hMean | f16 | um | time-mean film thickness inside the wetted width, h / f, while flowing |
| 6 | tauMean | f16 | Pa | time-mean wall shear inside the wetted width |
| 8 | tauPeak | f16 | Pa | largest phase-bin mean |
| 10 | depFlux | f16 | g/(m2 s) | time-mean mass arriving from the air (droplets, hand-over, drips) |
| 12 | renew | f16 | 1/s | time-mean film renewal rate, inflow per unit film mass |
| 14 | dropDuty3 | log u8 | - | area-time fraction under droplet impacts with stagnation shear above 3 Pa (1e-6 to 1) |
| 15 | dropDuty10 | log u8 | - | the same above 10 Pa |
| 16 | flowDuty | u8 / 255 | - | fraction of the period with loading above the flow threshold (h above 30 um) |
| 17 | wetDuty | u8 / 255 | - | fraction of the period in RIVULET or FILM regime |
| 18 | widthFrac | u8 / 255 | - | time-mean wetted width fraction f while wet |
| 19 to 22 | tauDuty[4] | u8 / 255 | - | fraction of the period with film shear above 0.5, 1, 2, 4 Pa |
| 23 | flags | u8 | - | bits 0-1 regime at the end of the period; 2 jet-wetted in this state; 3 in a pool; 4 stagnant gap; 5 drip site; 6-7 dominant source (jet hand-over, mist, drip, inflow) |

**DrainDown**, 8 bytes per water cell and exposure state. Written by the drain-down solve.

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0 | h2 | f16 | um | film thickness 2 s after the sources stop |
| 2 | h10 | f16 | um | after 10 s |
| 4 | h60 | f16 | um | after 60 s |
| 6 | tDewet | log u8 | s | time at which the cell leaves FILM or RIVULET (0.01 to 60 s; 255 = stays wet) |
| 7 | endState | u8 | - | bits 0-3 final bead load in sixteenths of b_max; 4 edge drop remains; 5 capillary bridge; 6 in pool; 7 received drips after the sources stopped |

**JetExposure**, 40 bytes per soil cell, per diverter state and viscosity point (2 x 2). Written by the gather of 5.5 for the class-centre pump speed.

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0, 8, 16, 24 | event[k].tauPeak | f16 | Pa | peak wall shear at this cell during pass k (the four strongest passes of the revolution, in phase order) |
| +2 | event[k].momPeak | f16 | N/m | peak film momentum flux per unit width M |
| +4 | event[k].t10 | log u8 | s | time above 10 Pa in the pass (1e-5 to 1 s) |
| +5 | event[k].t30 | log u8 | s | time above 30 Pa |
| +6 | event[k].pPeak | log u8 | Pa | peak wall pressure (10 Pa to 100 kPa) |
| +7 | event[k].phase | u8 | 1/256 rev | phase of the peak |
| 32 to 35 | tAbove[4] | log u8 | s | total time per revolution above 3, 10, 30, 100 Pa, all passes |
| 36 | nPass | u8 | - | number of passes per revolution that reach the cell |
| 37 | tauRest | log u8 | Pa | largest peak among passes beyond the four kept |
| 38 | pDuty | log u8 | s | time per revolution with wall pressure above 1 kPa |
| 39 | flags | u8 | - | bit 0 droplet-train majority; 1 inside R_j of some pass; 2 pre-wetted correction applied; 3 track clipped by an edge |

The soil model asks for events, not window means (soils R5), and its peel term needs the momentum flux and the dwell of the same pass together; an exceedance histogram of shear alone (numerics §4.2) loses that pairing, which is why I do not use it for jets. For the gravity film the opposite holds: there are no discrete events, only a thresholded linear dependence (starch), so a four-level duty curve is the right record.

Also recorded per state: airborne volume V_air, film volume V_film, return flow to the sump, the inflow and source mixture of every basin, the mean rate of every drip site, force and torque on every item in 256 phase bins (5.11), the liquid flux on the tablet's resting place, and the jet-wet mask (64 bits per water cell). Per diverter state: the onset-time field of 7.6.

### 7.4 The replay loop

The programme is integrated tick by tick. A tick is one master-arm revolution of the active state (1.71 s in L at 35 rpm, 2.0 s in U at 30 rpm) or 2 s when the pump is off. A baseline ECO programme has about 3,700 ticks before drying (105 minutes of circulation, machine §7.3) and 600 drying ticks of 10 s.

```
for tick n:
  CPU (f64, single thread)
    programme controller: fill, drain, heater, dispenser, rinse aid, diverter, pump speed  ->  active state X, tick length dt
    liquor model (chemistry §10, 25 states) integrated over dt in 0.25 s sub-steps with last tick's soil release and heat uptake
    hydraulics (section 4): inventory, f_H, filter throttling, foam  ->  similarity factors s_V, s_Q
    derive liquor class, T_liq, nu, sigma, pH, enzyme activities, peracid, surfactant, suspended loads; write 64 uniforms
  GPU pass W, one invocation per water cell
    effective film exposure for this tick (7.5): record of X, corrected for viscosity, pump speed, wetting onset,
      current contact angles and basin level, and merged with the drain-down record of the previous state
    element temperatures (6.11); fill-fraction vector of the film (8.4); cumulative deposition and condensation; onset progress
  GPU pass S, one invocation per soiled water cell (its four soil cells together)
    soil step (8.2) with the film exposure of pass W and the jet events of JetExposure[X], interpolated in log nu and rescaled by s_V
    integer atomicAdd of removed mass per soil class and of heat taken from the liquor into 64 global counters
  read back the 64 counters (0.1 ms); pools, basins and the filter are advanced on the CPU from their recorded inflows
  every 64 ticks: drift monitors (7.5), rigid-body event check (section 9), checkpoint test
```

Merging with the drain-down record after a switch from state X' to X at time t_s since the switch: h_eff = max( h_rec[X], h_dd[X'](t_s) ), with h_dd interpolated in log t between h2, h10 and h60 and continued as t^(-1/2); the cell counts as wet if it is wet in X or t_s is below tDewet[X']. Film shear in a draining film is rho g_s h_dd, which the pass evaluates directly (0.3 Pa at 30 um on a vertical wall).

Within one tick, a soil cell is hydrated and weakened for the whole tick first (one implicit solve), then its jet events are applied in phase order with strengths re-evaluated between events, then the film terms. Hits in different revolutions are therefore resolved individually. Re-hydration between two hits inside the same revolution is not resolved; its relative effect is of the order of the revolution period over the swelling time, 1.7 s against 100 s or more, under 2 % [C-EST].

### 7.5 Slow drifts

Everything that changes over minutes is handled in the timeline, without re-running the hydrodynamics, except where a rule below says otherwise.

| Drift | What changes | Treatment | Error where quantified |
|---|---|---|---|
| Liquor temperature inside a class (17 to 50 C in the main-wash ramp) | nu | Similarity rescale of the film record: time-mean loading is unchanged (it is fixed by mass conservation and routing weights); h and tau are multiplied by s_nu = (nu / nu_ref)^(1/3); a duty above a threshold tau_c is read from the recorded curve at tau_c / s_nu; renew is divided by s_nu | From a 50 C record: mean thickness and shear within 2.5 % at 35 and 65 C and within 6 % at 20 C; peak shear 3 to 9 % high at 35 C, 4 to 26 % high at 20 C, 3 to 18 % low at 65 C [C-SCRIPT: `similarity.py`]. Inside the 30 % and 50 % targets of section 2 |
| | jet-zone extents and stresses | JetExposure at two viscosity points (20 and 50 C), interpolated in log nu | closure-limited |
| | minimum wetting rate, proportional to mu^(1/5) | folded into the local re-evaluation below | 13 % between 20 and 50 C [C-EST] |
| Pump speed inside a class | V, Q, arm speed | s_V = N / N_class: jet records by the exponents of 4.3; deposition and loading proportional to s_Q; h and tau by s_Q^(1/3); tick length from the arm speed | footprint extent +/- 6 % (4.3) |
| Sump inventory, filter loading, foam | pump head | through f_H, Q_c and the foam derating into s_V, s_Q | flagged below f_H = 0.85 (4.5) |
| Contact angles: soil cover removed, fat melted, sigma drifting inside a class | wetting regime | **Local re-evaluation** every tick, per water cell, from the recorded loading: if gammaPeak >= Gamma*_a(now) the cell is FILM during flowDuty and stays wet for a further t_dw(now) (for ever if theta_r is below 5 degrees); otherwise it is RIVULET with f = max(f_min, f_1 (gammaMean / Gamma*_a(now))^(1/4)) as in 6.4. The mean loading itself does not depend on the regime, so no re-routing is needed for means | regime timing between pulses is approximate; see refresh rule |
| | | **Refresh rule**: every 64 ticks, if the item area whose re-evaluated regime class differs from the recorded one exceeds 5 % of the area of the state in use, R1 is re-run for that state for 2 + 1 revolutions with the current angles. At most one refresh per diverter state per run | budgeted (section 11) |
| Wetting onset of sparsely rained surfaces | dry to wet | onset gate (7.6) | - |
| Condensation on cold shadowed faces during heat-up | wetness without liquor | condensation flux from the element energy balance is added to the cumulative deposition; a face wetted only by condensate hydrates in water at the surface temperature, with no detergent or enzyme (films §13 item 16: up to 80 um per face per 30 K [ESTIMATED]) | - |
| Pools | volume, composition, temperature, settled solids | per basin on the CPU: dV/dt = Q_in - Q_spill, mixing ODE of 6.6 integrated exactly per tick; the periodic records assume full basins | a 400 mL cup fills in 33 s to 3 min (items §4.5 [ESTIMATED]), under 3 % of the circulation time; until it is full, the loading below its spill cell on the same item is reduced by the linear corrector of 6.6, but the drips it would send to items below are over-counted |
| Pool mass on items | weight, centre of mass | rigid-body event when the added mass changes by more than 20 % of the item mass (section 9) | - |
| Liquor composition | chemistry | per tick, from the liquor model; per-cell lag through the fill-fraction vector (8.4) | - |
| Element temperature | all rates | per tick (6.11) | - |

### 7.6 Wetting onset

A surface that receives only sparse droplets needs time to collect enough water to be wetted (5.8): 0.7 s at the mean flux of 140 g/(m2 s), 71 s at 1 % of it, 12 minutes at 0.1 %. The periodic solve assumes the asymptotic state. The timeline restores the delay.

For every diverter state an onset-time field is computed once from the records by a min-plus accumulation over the routing graph (the R0 machinery with a different operator, 400 sweeps):

```
t_on,i = min(  0                                       if the cell is jet-wetted in this state,
               rho delta_wet,i / depFlux_i             own collection time (bead store to the wetting threshold),
               min over donors j of ( t_on,j + d_ij / u_front,j )     arrival of a film from an already wetted cell  )
```

with u_front the equilibrium film speed for the donor's mean loading. In the timeline each water cell carries a progress variable P_i, advanced by dt / t_on,i[X] in every tick of state X (condensation adds its own flux to the collection term) and reset when the cell has been dry for longer than its evaporation time in the drying phase. The cell is "reached" when P_i >= 1. Before that, its soil cells see only the bead-covered fraction b / b_max of their area as wet.

This is how "everything is wetted within seconds" (P47) and "position does not matter for easy soils" (P24, P28) can both come out of the same model that leaves a nested or wall-facing surface dry for the whole programme: the outcome is decided by the deposition flux, three decades of which are resolved.

### 7.7 Why replay and not homogenise

The numerics dossier proposes first-order averaging for all cells plus projective "cycle jumps" with micro-solves for cells with direct hits (numerics §4.3), at an estimated 420 s. Replay of every revolution costs 39 to 55 s for the soil kernel (section 11) and has no jump-length control, no consistency test and no development-time audit against brute force, because it is the brute force. The dossier's own soil specialist reached the same cost estimate (soils §7.8: "a few tens of seconds"). The only averaging left is inside one revolution, bounded above at 2 %.

### 7.8 Caching and checkpoints

Exposure records are a function of (geometry and poses, machine, hydraulic class, liquor class, closure parameters, tier, seed) and of nothing else. They are cached under a hash of those inputs (numerics §6.5; benchmark §4.6). A second wash of the same load with another programme, detergent, soil set or soil parameter set skips stages B to F and costs set-up, replay and the end-of-phase passes only: 2 to 2.5 minutes at the official tier. For a manufacturer comparing programmes or detergents on a fixed load this is the normal mode of use. The same property makes soil-parameter sensitivity studies cheap (section 11.3).

Checkpoints are written at stage boundaries and every 512 ticks of the replay (1.4 to 2.1 GB of GPU state at 10 GB/s read-back).

---

## 8. Soil, chemistry and thermal coupling

I take the soil model of the soils dossier (§7, §R1 to R3) and the liquor model of the chemistry dossier (§10) as specified. This section fixes how they are fed, what state they carry in this design, and where the two dossiers disagree.

### 8.1 Soil cell state

One record per 1 mm soil cell, 136 bytes. The four soil cells of a water cell are stored contiguously, so one invocation updates them together and reads one water cell.

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0 | w[12] | f32 | kg/m2 | water mass of each layer, per covered area (layer 1 at the wall) |
| 48 | X[12] | u16 / 65535 | - | structural integrity of each layer |
| 72 | m0 | f32 | kg/m2 | initial dry loading per covered area, including the heterogeneity multiplier |
| 76 | Er | f32 | m | reaction-erosion depth not yet converted into a removed layer |
| 80 | tWet | f32 | s | cumulative wetted time |
| 84 | hFat | f32 | m | liquid or soft fat film thickness |
| 88 | cover | u16 / 65535 | - | covered area fraction c |
| 90 | Xad | u16 / 65535 | - | integrity of the bond to the substrate |
| 92 | stain | u16 / 65535 | - | remaining chromophore fraction S |
| 94 | particles | u16 | 1/cm2 | attached particles |
| 96 | redepFilm, redepFat, pigment | 3 x f16 | g/m2, g/m2, - | deposits received during the wash |
| 102 | class, bake, nLayers, rank, edgeDensity, flags | 6 x u8 | - | soil class; bake index B x 255; layers remaining; coverage rank u x 255; crack edge density code; flags |
| 108 | removed | f32 | kg/m2 | cumulative removed dry mass (mass balance and diagnostics) |
| 112 | tauCohTop, tauAd | 2 x f16 | Pa | strengths at the end of the last tick (diagnostics) |
| 116 | nbCover[4] | u8 / 255 | - | cover of the four edge neighbours at the previous tick (for the peel edge length) |
| 120 | waterCell | u32 | - | parent |
| 124 | reserved | 12 bytes | - | second component of composite soils |

Dry mass per layer is not stored: layers are graded geometrically (ratio 1.3, thinnest at the free surface, soils §R1 [VERIFIED guidance on count, ESTIMATED grading]) and a layer is either present or removed, so m_j = m0 g_j with a fixed table g. Soil cells whose dry thickness is under 20 um use one layer (soils §7.8). Water masses are f32 because hydration increments per tick are 10^-4 to 10^-2 of the content and would stall in f16.

Initial state: the ageing transform of soils §7.4 on the CPU at level load, plus per-cell heterogeneity from the seed: a log-normal loading multiplier with coefficient of variation 0.3 (soils §R3 [ESTIMATED]; 0.1 is the measured minimum), a crack edge density of 1,000 1/m for bake index above 0.5 (soils §R3 [ESTIMATED]), and rim cells with 5 times the loading at the edges of dried pools (soils §7.7 [ESTIMATED]).

### 8.2 Update per tick

Inputs per soil cell for a tick of length dt:

```
reached  = onset gate of its water cell (7.6)
chi      = 1 if the water cell is in FILM for the tick, or in RIVULET with rank u < f; else 0        (6.4)
f_flow   = reached chi wetDuty                               share of the tick under flowing film
f_wet    = reached [ f_flow + (1 - f_flow) a_res ]           share of the tick with liquid on the soil
           a_res = 1 on hydrated, hydrophilic soil (theta_r <= 10 degrees: a drained film persists, 6.10; the tub is closed and humid);
                 = min(1, b / b_max) on fat-covered or hydrophobic cells (beads only)
tau_f, tau_f,pk, duty curve, h_f, renew, depFlux             from the effective film exposure (7.5), zero unless chi = 1
J_sup    = depFlux + rho h_f renew chi                       water delivery available for swelling     [kg/(m2 s)]
events   = up to 4 x (tau_j, M_j, t_10, t_30, p) plus aggregate times above 3, 10, 30, 100 Pa         (7.3)
T_s      = surface temperature of the water cell (6.11)
Xi       = pH, E_P, E_A, PAA, C_HOO, C_surf, X_ch, Ca_free, C_fat,free, C_2, C_3, C_TDS seen by this cell (8.4)
```

Update, following soils §7.5 and §R2 (equation labels are the dossier's):

```
E2  hydration        backward-Euler tridiagonal solve on the layer stack:
                     dw_j/dt = J_(j+1/2) - J_(j-1/2),   J = D_w(beta_face) (beta_(j+1) - beta_j) / mean thickness
                     D_w = D_w0 exp(alpha_w beta) a_T a_pH a_B;   top flux = min( D_w (beta_max - beta_N)/(h_N/2), J_sup ) f_wet
E3  weakening        u_r  = k_ds,ref a_T exp(s_pH (pH - 10.5)) (theta_E / theta_E,ref) a_B g(tWet)        [m/s]
                     u_OH = k_OH,ref a_T 10^(pH - 11.5) g(tWet)
                     dXad/dt = -k_ad a_T a_surf a_pH H(beta_1 - beta_ad)
E4  strengths        tau_coh,j = tau_c0 exp(-b_c beta_face) a_fat(T_s) a_B;   tau_ad = tau_a0 exp(-b_a beta_1) Xad s_sub
                     F_ad = F_a0 Xad s_sub a_fat;   M_Y = F_ad / eta_M;   k' = min(k'_max, k'_ref (tau_ref / tau_coh,top)^1.8)
E6a solubles         dm = min( m_N, k_L (c_sat - c_bulk) f_flow dt ),  k_L from the Leveque form with tau_f (soils eq. X2)
E6b reaction-erosion Er += [ u_r + u_OH + f_j (u_s - u_r) ] f_wet dt,   u_s = 4 u_r (soils §R3 [VERIFIED range 1.5 to 7])
                     f_j = t_above(tau*) / dt, interpolated in log tau between the recorded thresholds; tau* = 10 Pa (soils §R3 [VERIFIED])
                     while Er > h_N: remove the top layer, Er -= h_N
E6c cohesive         for each event in phase order, then for the film peak: load = C_coh tau, C_coh = 0.67 (soils §R3 [VERIFIED]);
                     remove all layers above the interface nearest the wall with tau_coh < load.
                     Swollen-starch erosion by the film: the same rule applied with the duty curve, i.e. the rule fires for the
                     share of the tick in which tau_f exceeds tau_coh,top / C_coh, read from tauDuty at that threshold
E6d adhesive         if tau_ad < C_ad tau_load (C_ad = 14.2, soils §R3 [VERIFIED for ketchup]): cover <- cover (1 - p_det),
                     p_det = footprint share of the cell for an event, 1 for the film
E6e peeling          dcover/dt = -(L_edge / A) k' [ sum over events (M_j - M_Y)+ t_e / dt + (1 - f_j) f_flow (M_f - M_Y)+ ]
                     L_edge from nbCover (sides adjoining cells with lower cover) plus the crack density;  M_f = 1.2 Gamma^2 / (rho h_f)
E6f fat              hFat by the viscous shifting flux of soils eq. V1 with tau_f and g_t when SFC(T_s) < 0.10 (chemistry §10.6);
                     emulsification dhFat/dt = -k_em a_surf a_T f_flow hFat
E6g stains           dS/dt = -k_ox a_T c_ox f_wet S
E6h particles        released when their binder layer is removed or when 8 tau_load d^2 exceeds the binder force
```

Rate functions of temperature, pH and enzyme concentration are tabulated on the CPU once per tick (64 entries each over the range of element temperatures present) and sampled in the kernel, so no exp or pow of a state variable sits in a feedback loop on the GPU (numerics §6.2).

Removed mass per class goes to the liquor through the integer counters, split into dissolved, fat, fines, grit and coarse by the table of chemistry §10.6. Detached chunks from E6c, E6d and E6e enter as grit or coarse mass and become redeposition load (P34).

Decay stage: not imposed. It arises from the distribution of loading, rank and exposure over the 1 mm cells (soils §7.5, final note on E6).

### 8.3 Chemistry

The liquor is one well-mixed reservoir integrated on the CPU in f64 (chemistry §10.1 to §10.8): detergent release with the wetting factor w_tab = min(1, q_tab / q_ref) taken from the recorded flux at the tablet's resting place (9.5); alkalinity balance and pH by bisection; peracid generation and decay; enzyme deactivation by heat, peracid and peroxide; soil classes 0 to 3 with filter capture and leaching; free fat; foam; scale index. Explicit steps of 0.25 s, with exact exponentials for the stiff relaxations (chemistry §10.13).

Coupling is explicit with one tick of lag: the soil release and heat uptake of tick n enter the liquor at tick n + 1. The fastest liquor time constants are 100 to 500 s (chemistry §10.13), so a 2 s lag is harmless.

**Where the soils and chemistry dossiers disagree on the surface kinetics I follow the soils dossier as one coherent set and take from chemistry only the liquor state and the enzyme temperature optimum.** The differences are: Hill exponent 3 with K_E = 0.82 x reference dose (soils §R3) against 2 with K = 0.83 x reference (chemistry §10.6); egg-yolk reference flux 3 x 10^-5 (soils calibration 1) against 3.7 x 10^-5 kg/(m2 s) (chemistry §10.6); starch 2 x 10^-5 against 4 x 10^-5; lag 9 minutes at 50 C for egg yolk against 300 s x (h_dry / 68 um)^2. All are [ESTIMATED] from the same thesis tables. The soils set was fitted together with the swelling and layer-removal bookkeeping that this design implements; mixing constants from two fits would not reproduce either. The chemistry dossier's f_T with a denaturation optimum (protease 1.09 at 55 C, 0.53 at 65 C) is adopted in place of the plain 24 kJ/mol Arrhenius factor, because it carries the high-temperature enzyme loss that the soils factor lacks. Both parameter sets are selectable and the difference is part of the soil-side bracket (11.3).

### 8.4 What liquor a surface sees

A well-renewed film has the composition of the sump. A poorly renewed one does not, and that is how detergent residue in spray shadows, dirty pooled water and poor rinsing arise (chemistry §10.2). Carrying 13 species per cell would cost 60 MB and a kernel pass. Instead each water cell carries a **fill-fraction vector**: four u8 values giving the share of its liquid that dates from each fill of the programme (pre-wash, main wash, intermediate rinses lumped, final rinse). It relaxes exactly:

```
phi_k <- d_k + (phi_k - d_k) exp(-renew dt),      d_k = 1 for the current fill, 0 otherwise
```

and the composition seen by the soil is the phi-weighted mixture of the current liquor and the end-of-phase liquors of earlier fills (stored on the CPU, four vectors). Cells with renew above 0.1 1/s are indistinguishable from the sump within one tick. What this drops: local consumption of enzyme or bleach inside a slow film, and local enrichment by soil released under it. An optional supply cap on the reaction-erosion flux, u_r <= kappa_E renew h_f c_E, is provided as a calibration hook for the enzyme-delivery effect the thesis authors suspected (soils §6.2); default off.

Pools carry the full composition vector, a temperature and settled solids on the CPU (a few hundred at most), with their own pH solve. Soil cells below a pool level see the pool: wet all the time, no shear, the pool's chemistry and temperature.

### 8.5 Temperature

Element temperatures follow 6.11 in pass W, per tick: one surface node per face and a shared mid node (ceramic, glass, plastic), or one lumped node (metal). The liquor energy balance is chemistry §10.10 with the item term replaced by the summed heat uptake that pass W reports through the counters, so heat is conserved between liquor and load to the counter resolution. Heater control, tub node and losses as in machine §6.2 and chemistry §10.10 (P_h = 2,000 W, eta_h = 0.97, G_wt = 200 W/K, G_loss = 3.5 W/K, C_tub = 12 kJ/K, all [ESTIMATED]).

The film-to-wall coefficient is 1.88 k / h_mean from the films dossier (§9.1), about 8,000 W/(m2 K) at 150 um, limited by the supply term G_e of 6.11. The chemistry dossier's default of a constant 5,000 W/(m2 K) (§10.10) is not used: it has no supply limit, so it would heat a shadowed face fed by a trickle as fast as a jet-washed one.

### 8.6 Redeposition and carry-over

All of this is statistical per water cell (it applies to clean items too), following chemistry §5.3, §10.7 and §10.9; every rate constant there is [ESTIMATED] and so is every one here.

| Mechanism | When | Update |
|---|---|---|
| Stranding of suspended particles (R1) | at every pump stop that is followed by a drain | lambda_k += C_k,e min(delta_strand,k, h_5s) / m_p,k for k = fines, grit; delta_strand = 100 and 400 um (chemistry §10.9); h_5s from DrainDown by interpolation; C_k,e through the fill fractions |
| Flushing of earlier specks | every tick with flow | a speck of class k is re-entrained when the film over it is deeper than the particle: lambda_k <- lambda_k (1 - flowDuty) per tick if gammaPeak gives h above d_k [C-EST closure] |
| Pool evaporation and sedimentation (R2, R3) | pools | settled solids += v_s,k C_k,pool A_pool dt; at the end everything in the pool is left on its footprint |
| Fat and soap film (R4) | every wet tick | j_fat = k_fat,dep C_fat,free a_sub (1 + 5 SFC(T_s)) f_wet, k_fat,dep = 10^-6 m/s (chemistry §10.7) |
| Pigment uptake into plastics (R6) | with fat deposition | time integral of j_fat C_pigment / C_fat with the 40 kJ/mol factor (chemistry §5.4) |
| Dissolved residue | at the final drain and after drying | film: h_end (C_TDS + C_0 + C_1); retained drops and bridges: V_d (C_TDS + C_0) on the drop footprint; pools: over the pool footprint |

The output is a speck intensity lambda_e (specks per mm2 per class) and residue masses per cell. Drawing discrete specks from it with the run's seed is the inspector's step (standards §10.5).

Carry-over at each drain is computed, not assumed:

```
V_carry = V_res + sum_e A_e ( m_e + b_e ) / rho  +  edge drops + bridges + gap stores  +  sum of pools  +  water held in soil layers
```

with V_res = 0.15 L (chemistry §10.2) and the film term from the DrainDown records at the time the next fill starts. The verified total of 0.3 to 0.5 L for a normally loaded machine (chemistry §5.6 [VERIFIED]) is a validation target for the whole runoff model: 6 m2 at the 10 g/m2 that my drain-down gives after 60 s is 0.06 L of film, so the model will need beads, drops, bridges and rack water to supply the rest. If it cannot, that is a finding.

### 8.7 Drying and the end state

After the final drain the drain-down record of class R gives every cell's film, bead load, edge drops and bridges, and the drips that fell on items below after the pump stopped (P23). Drying then follows chemistry §10.11 in 10 s ticks on the water cells: evaporation j_e = h_m (rho_v,sat(T_s) - rho_v,air) a_wet with the lumped air node, wall condensation, door opening and stored heat of the two or three wall nodes. Plastics stay wet because they hold beads instead of a film and store little heat (P38); both are state in this model, not rules.

### 8.8 Outputs

| Output | Granularity | Content |
|---|---|---|
| Residual soil map | per soil cell (1 mm), with patch coordinates and area | residual dry mass by class (cover x remaining layers), cover fraction, fat film, stain fraction, attached particles |
| Deposits | per water cell (2 mm) | speck intensity per size class, dissolved residue, fat film, pigment index |
| Retained water | per item and per water cell | pool volume per basin (mL), film, beads, edge drops, bridges; wet or dry at inspection time |
| Motion | per item | pose history, events (moved, flipped, fell through, blocked an arm), final pose |
| Confidence | per item | closure bracket: score under each member, fragility flag, sigma; Monte Carlo split-half error; tier residual (11.3) |
| Developer diagnostics | per cell | all exposure records, onset times, wetting regime shares, temperatures, source split; per state: convergence monitors, mass and energy balances, V_air, V_film; per nozzle: flow, speed, hit list |

A soil cell is 1 mm2 and carries a cover fraction, so the 4 mm2 band edge of the IEC scale is resolved four times over before sub-cell coverage is used (standards §10.5).

### 8.9 Cost

2.1 to 3.0 million soil cells x 3,700 ticks x 12 layers is 0.95 to 1.3 x 10^11 layer updates: 39 to 55 s at 0.2 x 10^9 cell-ticks/s, plus 8 to 11 s for pass W and about 10 s of CPU and read-back. 7 to 8 % of the run.

---

## 9. Rigid-body coupling during the wash

The spike selected Jolt Physics 1.1.0 at 1/240 s (spike-rigid-body, verdict): bit-identical reruns, state save and restore in under a millisecond, 4.2 ms per step with the full load awake and 0.75 ms with sleeping. The items dossier's 1 ms step and its Rapier suggestion (items §13) are superseded by that measurement.

### 9.1 Principle: shake the load down before computing exposure

Items move when the jets first hit them, not at a random time in the wash. So the motion is resolved first, with loads that cost almost nothing, and the expensive exposure is computed for the load as it sits after that.

```
after set-up and the first primary-bundle pass (stage C: about 1 s per hydraulic state):
  for each hydraulic state in programme order, at the highest pump speed the programme uses in it:
    repeat up to 6 times:
      loads: force and torque on every item in 256 phase bins (5.11)
      candidates = items with  max |F| > 0.25 m g,  or  max overturning moment about any support edge > 0.25 x restoring moment
      if no candidates: break
      simulate 3 master revolutions in the rigid-body engine at 1/240 s, wash friction table, all bodies asleep except woken ones
      if no item moved by more than 2 mm or 2 degrees between the ends of the last two revolutions: break
      update instance transforms, rebuild the top-level BVH (under 1 ms), re-trace the primary bundles
the resulting poses are geometry epoch 0
```

The 0.25 threshold is the items dossier's screening value (items §4.6 [ESTIMATED]: half the best-lever tipping threshold), applied to the computed loads instead of a worst-case nozzle. The 2 mm and 2 degree tolerance is also the dossier's.

### 9.2 Forces

| Load | Model | Source |
|---|---|---|
| Jet normal force | F_n = rho Q_hit V sin(phi) along -n at the footprint centroid | 5.11 |
| Tangential drag | F_t = c_t rho Q_hit V cos(phi), c_t = 0.2 | jets §11.3 [ESTIMATED] |
| Returned jet in a cavity | factor c_turn = 1.8 when the surface walk shows the film leaving through the opening it entered | items §4.3: 1 to 2 [ESTIMATED]; calibration item 4 |
| Live loads on awake bodies | while a body is awake, the jets are re-cast against it on the CPU at every rigid-body step (the f64 reference tracer; about 400 sub-rays per step), so the load ends when the item leaves the jet and changes as it turns | this design |
| Droplet and film loads | neglected (momentum flux of secondary water is under 10 % of a direct jet) | [C-EST] |
| Pooled water | added mass and centre-of-mass shift from the basin store | 6.6 |
| Buoyancy | only for items lying in the sump pool on the tub floor | items §4.6 |
| Friction | "wash" table: 0.15 typical hard item on coated wire | items §13 [ESTIMATED] |
| Arm contact | arms are kinematic bodies at their true angular speed; contact impulses act on the item and the reaction torque on the arm | machine §3.3 |

Live loads matter: with a frozen load table a 20 g lid hit by a 0.42 N jet would be pushed for the full 0.19 s dwell whether or not it is still there, and would gain 2.1 m/s (items §4.4). With live loads it leaves the jet when it has moved a few centimetres.

### 9.3 When the engine is invoked after the shake-down

| Trigger (all are simulated quantities) | Action |
|---|---|
| A basin's stored water changes an item's mass by more than 20 %, or a basin first fills | wake the item with its new mass and centre of mass; simulate 2 revolutions with the active state's loads |
| Pump speed rises above the speed used in the shake-down (cannot happen by construction; asserted) | - |
| An arm's contact torque is non-zero | arm speed from the transient equation; if the item is pushed clear the shake-down rule applies |
| End of the wash | final poses for the report; items that would tip when the water drains are not re-simulated |

If a triggered simulation moves any item beyond the tolerance, that is a **geometry epoch**: the exposure records are invalid from that tick on.

### 9.4 Re-exposure

A new epoch needs primary bundles, gather, Monte Carlo and routing for the states still to come. The rule that keeps run time bounded and reproducible:

- The first additional exposure set of a run (a geometry epoch, or the second pump-speed class of a programme that has one) is computed at official resolution with half the parcel count, 2 + 1 revolutions per state warm-started from the old periodic state, and the fast drain-down schedule.
- A second additional set is computed at fast-tier resolution and mapped onto the official cells by area-weighted prolongation.
- Any further trigger is logged; the item is frozen in its current pose and flagged "unstable, exposure approximate".

Soil state is carried across epochs unchanged (it lives on the item's surface, not in the world).

What is lost: an item that would move at minute 40 because a neighbour's pool filled is handled; an item that rattles on every pass without net displacement is frozen at the pose it had at the end of the shake-down window, and the exposure of its neighbours does not see the rattle. An item that hops repeatedly (a lid over a strong nozzle) will usually leave within the shake-down window; if it does not, it is flagged.

### 9.5 Arm blocking, stall, dispenser

- **Arm sweep.** At set-up and after every pose change each arm is swept through one revolution as a kinematic body. No contact: free. Contact with torque above the available drive minus friction at zero speed (about 0.07 N m for the lower arm, i.e. 0.3 N at the tip, machine §3.3 [ESTIMATED]): **stall** at the contact angle. The stalled state then has one phase (4.2) and the rack's direct coverage collapses to the fixed jet lines (P06). Contact below that: **knocking**, with the phase-dependent speed of 4.2; if the item is pushed clear during the shake-down the arm runs free afterwards.
- **Dispenser.** The lid's swept volume and the tablet's drop path are tested against the settled load (machine §7.4, F6). Blocked: w_tab = 0.05 (chemistry §10.3). Free: the tablet is dropped as a rigid body at set-up and comes to rest somewhere; it is added to the geometry as a small box with water cells, and the recorded flux on it is q_tab. A tablet that lands in an upright bowl or a shadowed pocket dissolves slowly because that flux is small (P26); no rule says so.

### 9.6 Interface

```ts
interface RigidCoupler {
  setFrictionTable(table: 'wash'): void;
  setAddedMass(item: ItemId, massKg: number, comLocal: Vec3): void;
  setArm(arm: ArmId, omegaRadPerS: number, phase0Rad: number): void;
  /** Advance by n steps of 1/240 s. `loads` is called once per step for the bodies that are awake or about to be woken. */
  step(n: number, loads: (stepIndex: number, awake: readonly ItemId[]) => readonly Wrench[]): RigidResult;
  snapshot(): Uint8Array;            // bit-exact (spike T7)
  restore(state: Uint8Array): void;
}
interface Wrench { item: ItemId; forceN: Vec3; torqueNm: Vec3 }           // world frame, about the centre of mass
interface RigidResult {
  poses: ReadonlyMap<ItemId, Pose>;                 // position (m), unit quaternion
  moved: readonly { item: ItemId; dPosM: number; dAngRad: number }[];
  armContactTorqueNm: readonly number[];            // per arm, mean over the last revolution
  contacts: readonly ContactPoint[];                // for contact links (3.6) after a pose change
  events: readonly ('fellThrough' | 'leftRack' | 'onHeater' | 'flipped')[];
}
```

Cost: the shake-down is 9 to 54 simulated revolutions, 16 to 100 simulated seconds, at 0.2 to 1.0 s of wall time per simulated second (spike T8). 30 s is budgeted and a further 70 s is held in reserve.

---

## 10. Determinism and reproducibility

### 10.1 Rules

1. **Nothing depends on wall-clock time.** Tier, counts, steps and schedules are fixed before the run. Run-time branches (convergence extension, wetting refresh, geometry epoch, re-exposure tier) depend only on simulated quantities compared with fixed thresholds, so they repeat exactly.
2. **Scatter is integer.** Every many-to-one accumulation on the GPU (droplet deposits, impact duty, rain density, removed soil mass, heat uptake) uses atomicAdd on u32 or i32 fixed-point counters, which the spike showed to be bitwise order-independent; a float compare-exchange scatter is not reproducible and is banned.
3. **Float accumulation is a gather in fixed order.** Jet-zone integration (5.5), routing inflow (6.3) and Jacobi sweeps sum a fixed list in a fixed order inside one invocation. Float stencil kernels of this kind were bitwise identical across runs, workgroup sizes, batching, devices and processes in the spike.
4. **Time is an integer.** Arm phase is (step counter mod steps per revolution); programme time is a tick counter; drain-down times come from the integer schedule (numerics §6.3).
5. **CPU work is single-threaded f64** in a fixed order (hydraulics, liquor, pools, programme controller) or single-threaded WASM (rigid bodies, priority-flood, BVH build). Worker threads are used only for work whose result does not depend on scheduling (asset decompression, checkpoint compression).
6. **Transcendentals stay out of feedback loops on the GPU** where a table will do (soil rate functions, droplet size quantiles, drag factor). Where they remain (the Newton solve of 6.3 uses one fractional power), the result is reproducible on a fixed machine and software stack, which is the requirement; it is not expected to be bit-identical across GPU families.
7. **Provenance.** Every result carries the hash of inputs, parameter set, tier, seed, shader sources, Dawn version (webgpu 0.3.0 is the only build that loads on the target OS, spike section 3), OS build and GPU identity. Resume and cache hits require all to match.

Cross-machine agreement is statistical, not bitwise (numerics §6.2; benchmark §4.5). The closure bracket gives every item a margin, so the report can say which verdicts are inside the cross-machine tolerance; official scores should come from one declared reference configuration.

### 10.2 Random numbers

All randomness is counter-based: value = Threefry-2x32 (20 rounds) with key (seed, domain) and counter (entity, index) [RECALLED: Salmon et al. 2011, "Parallel random numbers: as easy as 1, 2, 3"]. Threefry needs only 32-bit add, rotate and xor, which WGSL has; Philox needs a 32 x 32 to 64-bit multiply, which it has not. A uniform in [0, 1) is the top 24 bits times 2^-24.

| Domain | Entity and index | Used for |
|---|---|---|
| ARM_PHASE | hydraulic state, arm | start phase of each arm |
| SPLATTER | nozzle, phase, sector, sample | splatter droplet diameter, speed, elevation, azimuth |
| FAN, SHEET, DEPART | source record, sample | wire fans, free sheets, ceiling departures |
| SPLASH | parent parcel, child | secondary droplets, rebound |
| DRIP | drip site, emission index | landing jitter inside the drop footprint |
| SITE | item, edge run | offset of drip-site spacing along level edges |
| RIVULET | item, water cell | frozen link choice in rivulet regime |
| RANK | item, water cell, sub-cell | coverage rank jitter |
| SOIL | item, soil cell | loading multiplier, crack density |
| INPUT | run | optional seeded input perturbations (fill volume, release time, inlet temperature) used only for run-to-run variability studies; off for scoring |

No generator state exists anywhere, so results do not depend on dispatch order, batching or parcel order. Sampling within a domain is stratified (index mod strata selects the stratum, the hash jitters inside it).

**Nested tiers.** Official phases are 16,384 per revolution, fast 4,096, preview 2,048, each a subset of the finer one; sub-ray patterns nest (7 of the 19); a parcel of a coarser tier has the same counter as one parcel of the finer tier. Coarser tiers therefore see a subsample of the official randomness, not different randomness. Bracket members of one tier share all counters with that tier's nominal run, so the difference between a member and the nominal is a common-random-number estimate: sampling noise largely cancels in it.

### 10.3 Precision hazards

| Hazard | Where | Remedy |
|---|---|---|
| f32 time | everywhere | integer counters (rule 4) |
| Intersection at grazing incidence | frusta, capsules | item-local coordinates (spacing 3 x 10^-8 m), stable quadratic root, hit normal from the analytic surface, never from differences |
| Footprint velocity by differencing phases | 5.4 | positions differ by 0.1 to 0.7 mm at 3 x 10^-8 m resolution: relative error 10^-4 |
| Counter overflow | deposition u32, unit 10^-11 kg | capacity 0.043 kg per cell and bin; the largest physical value is about 10^-4 kg; asserted at pack time |
| Counter underflow of small deposits | 0.16 mm droplet = 2 x 10^-9 kg = 200 units | parcels carry at least 100 units; lighter ones are merged at emission |
| Thin films freezing | m below 10^-6 kg/m2 | films below delta_dry = 2 um are moved to the bead store by the regime machine; flux form keeps mass exact |
| Accumulating statistics over 1,024 to 2,048 steps | R1 | duty counters are u16; float sums are of same-sign terms over at most 2,048 steps (relative error under 10^-4) |
| Soil increments | hydration, integrity | f32 water masses; u16 integrities with at least 20 units per tick decrement at the slowest calibrated rate, else a carried remainder |
| Shader compiler freedom (reassociation, fusion, fast-math on Metal) | all kernels | accepted: reproducible for a fixed stack (measured); CPU references compare within tolerance, never bitwise (spike B7) |
| Bindings of 4 GiB or more fail silently | large buffers | largest buffer 581 MB; wrapper asserts every binding size |
| Robustness to non-finite values | all kernels | every kernel output is clamped to a physical range and a global "non-finite seen" counter is read back each stage; a non-zero count fails the run instead of scoring it (benchmark §4.6) |

---

## 11. Compute budget

All figures from `budget2.py` [C-SCRIPT]. Element counts are those of section 3.4.

### 11.1 Planning throughputs and derating

"Measured" is the spike's figure for the stand-in kernel. "Lead planning rate" is the shared-machine rate from the lead's note. "Used here" is what the budget assumes; the derating factor is relative to the lead planning rate.

| Kernel in this design | Stand-in measured | Lead planning rate | Used here | Derate | Why the real kernel is slower than the stand-in |
|---|---|---|---|---|---|
| Primary bundle segments (long, coherent) | 290 to 365 M rays/s coherent, 100 M incoherent, on a 1.0 M triangle BVH | 150 M rays/s mixed | 60 M segment queries/s | 0.40 | two-level traversal with instance transforms and a rotating-arm instance; quadratic primitive tests instead of triangle tests; bundle classification. In its favour: 38 k nodes instead of 665 k |
| Droplet parcel segments (short) | 182 to 362 M/s for 1 cm segments | (150 M mixed) | 90 M segment queries/s | 0.33 of 270 M | drag update, wall-regime logic, random numbers, atomic deposits, hit-to-cell mapping |
| Runoff R1 cell-step | 1.2 to 1.6 G cell-updates/s, unstructured, 80 bytes of traffic per cell | 1.4 G | 0.30 G cell-steps/s | 0.21 | about 190 bytes of traffic per cell-step (donor indices and weights 48, donors' discharge 32, state in and out 32, static parameters 16, deposition 6, accumulators 56 in recorded revolutions) puts the bandwidth bound at 0.6 G; a further 0.5 for the fixed four-iteration Newton solve with one fractional power per iteration and the regime logic |
| Steady R0 sweep | same | 1.4 G | 1.0 G cell-sweeps/s | 0.7 | plain gather |
| Soil cell-tick (12 layers) | no direct stand-in; memory-bound like the stencils (110 to 130 GB/s) | - | 0.20 G cell-ticks/s | 0.55 of the bound | 330 bytes of traffic per cell-tick gives a bound of 0.36 G; tridiagonal solve and table look-ups |
| Timeline water-cell pass | same | - | 0.8 G cell-updates/s | 0.67 of the bound | 100 bytes of traffic per cell |
| Jet-zone gather | none | - | 0.2 G (cell, phase) pairs/s | - | compute-bound: about 300 floating-point operations and two transcendental calls per pair. My estimate; a factor of 3 either way moves the total by under 2 % |
| Rigid bodies (Jolt, WASM, one thread) | 4.2 ms per step awake, 0.75 ms sleeping, full load | - | 0.2 to 1.0 s per simulated second | 1.0 | measured on the target load |

A 10 % sustained-load allowance is applied on top of the totals. The spike measured no thermal decline over 7 and 15 minutes but has no 30 minute run.

### 11.2 Official tier

| Stage | Elements | Operations (6.1 m2 / 8.5 m2 load) | Rate | Seconds (6.1 / 8.5) | Share (6.1) |
|---|---|---|---|---|---|
| A. Set-up: asset cache, cell tables in Morton order, routing graph, priority-flood, two-level BVH, gap rays, onset fields, about 40 pipelines, uploads | 1.67 / 2.27 M water cells, 2.13 / 2.98 M soil cells, 19 k primitives | 20 s fixed + 8 s per million water cells + 2 s per million soil cells | mixed CPU and GPU | 38 / 44 | 4.8 % |
| B. Hydraulics, arm sweep, dispenser test, rigid-body shake-down | 122 bodies | 9 to 54 simulated revolutions | 0.2 to 1.0 s per simulated second | 30 / 30 | 3.8 % |
| C. Primary jet bundles, 3 hydraulic states | 16,384 phases x 56 nozzle-states x 19 sub-rays x 1.25 | 2.2 x 10^7 bundle rays x 3 generations x 3 segments = 2.0 x 10^8 | 60 M/s | 3 / 3 | 0.4 % |
| D. Jet-zone gather, 5 state-viscosity records | 20 % of soil cells x 150 phases x 3 tracks | 9.6 x 10^8 / 1.3 x 10^9 pairs | 0.2 G/s | 5 / 7 | 0.6 % |
| E. Secondary-water Monte Carlo, 2 diverter states | 4 x 10^8 parcels each x 12 segments | 9.6 x 10^9 segment queries | 90 M/s | 107 / 107 | 13.6 % |
| F. Runoff R1: 22 periodic revolutions + 6 drain-downs of 3.06 revolution-equivalents = 40.4 | 1.67 / 2.27 M cells x 1,024 steps per revolution | 6.9 x 10^10 / 9.4 x 10^10 cell-steps, plus 2.6 x 10^9 drip-parcel segments | 0.30 G/s; 90 M/s | 258 / 341 | 32.9 % |
| G. Timeline replay, 3,700 ticks + 600 drying ticks | soil cells x ticks; water cells x ticks | 7.9 x 10^9 / 1.1 x 10^10 soil cell-ticks; 6.2 / 8.4 x 10^9 water-cell updates; liquor model on the CPU | 0.20 G/s; 0.8 G/s | 57 / 76 | 7.3 % |
| H. End-of-phase passes: stranding, carry-over, drying initialisation, output maps | - | - | - | 20 / 20 | 2.5 % |
| I. Closure bracket: preview nominal + 8 members; set-up and shake-down shared | 0.47 / 0.62 M water cells, 0.53 / 0.74 M soil cells | 12 s shared + 9 x 23.5 s | preview-tier stages | 223 / 236 | 28.4 % |
| J. Checkpoints, I/O, progress stream | 1.4 to 2.1 GB of state | - | 10 GB/s read-back | 45 / 45 | 5.7 % |
| **Nominal total** | | | | **786 / 909 s** (13.1 / 15.1 min) | |
| With 10 % sustained-load allowance | | | | 865 / 1,000 s (**14.4 / 16.7 min**) | |
| of which GPU kernel time | | | | about 540 / 660 s (9.0 / 10.9 min) | |
| Same without the bracket ("official-lean") | | | | 10.3 / 12.3 min with allowance | |

### 11.3 The closure bracket

Eight extra runs at the preview tier, each with one group of uncertain closures pushed to an end of its plausible range, plus the preview-tier nominal. The members share geometry, set-up, shake-down and all random-number counters.

| Group | Low member | High member | Range from |
|---|---|---|---|
| G1 Splatter | k_S = 0 | k_S = 1 | jets §11.3 (0 to 1) |
| G2 Secondary break-up and wires | splash ratio cap 0.14; wire and rim fan mass x 0.5, retained fraction x 2 | cap 0.8; fan mass x 2, retained x 0.5 | jets §11.3 (0.14 to 0.8); jets §12 item 10 (each within x2 to x3) |
| G3 Wetting | advancing and receding angles of plastics, steel and fat-covered cells - 20 degrees | + 20 degrees | films §13 item 1 |
| G4 Edges and contacts | C_tp = 0.5, contact transfer xi_c = 0 | C_tp = 3, xi_c = 1 | films §12.7 (0.5 to 3); xi_c [C-EST] |

For item i let r_i be the inspector's continuous margin (for example log10 of soiled area over the threshold area, or the IEC score), and d_i,k = r_i(preview member k) - r_i(preview nominal). The report gives:

```
fragile_i = any k for which  verdict( r_i(official nominal) + d_i,k )  differs from  verdict( r_i(official nominal) )
sigma_i   = sqrt(  sum over groups g of ( (d_i,g,high - d_i,g,low) / 4 )^2  +  sigma_MC,i^2  )
```

The range of a group is read as plus or minus two standard deviations; sigma_MC is the split-half sampling error of 7.2. The official verdict is the nominal official run's alone: the bracket never changes a score, so it can be switched off by configuration without changing any result.

Why at the preview tier: the bracket parameters act on where secondary water lands and on which regime a surface is in, i.e. on time-mean deposition and loading, which the preview tier computes with the same closures and a subsample of the same random numbers. It does not need pulse shapes. Whether preview-tier sensitivities track official-tier ones is an assumption; it is measured by prototype 3 and monitored in every run through the **tier residual** r_i(official nominal) - r_i(preview nominal).

Not in the bracket: the soil kinetics (rank 1 of section 2). Their uncertainty is larger, but they are part of what a level or a calibrated product defines, and they do not need new hydrodynamics. In developer mode a soil-side bracket re-runs stage G at the official tier on cached exposure, about 1 to 1.3 minutes per member (reference flux x3 and /3, lag x3 and /3, eta_M 0.03 and 1, the chemistry dossier's kinetic set).

### 11.4 Reserves and worst case

| Reserve | When drawn | Seconds (6.1 / 8.5) |
|---|---|---|
| Wetting refreshes: one per diverter state, 2 + 1 revolutions | 7.5 refresh rule | 34 / 46 |
| Convergence extension: 2 more revolutions for two states | 7.2 | 23 / 31 |
| Extended shake-down | more than 30 s of rigid-body work | 70 / 70 |
| One re-exposure at official resolution: bundles, gather, half the parcels, 18 warm-started revolutions and fast-schedule drain-downs | first geometry epoch, or the second pump-speed class of the programme | 230 / 286 |
| One re-exposure at fast resolution | second such event | 41 / 49 |
| **Worst case, everything drawn** | | **1,185 / 1,392 s** |
| With 10 % allowance | | 1,303 / 1,531 s (**21.7 / 25.5 min**) |
| of which GPU kernel time | | 14.5 / 17.8 min |

The reserve rule (9.4) makes this a true upper bound: a third event is not recomputed. Against the 30 minute cap the worst case of the upper-bound load leaves 4.5 minutes; the nominal load leaves 8.3 minutes in the worst case and 15.6 minutes typically. Against the spike's 20 minutes of GPU kernel time the worst case of the upper-bound load uses 17.8 minutes before the allowance and 19.6 with it.

### 11.5 What the unspent minutes would buy

A typical run ends at 14 to 17 minutes. I do not fill the remainder by default, for three reasons: the error ranking says the next gain in realism is in closure constants, which compute cannot supply; the reserve has to exist for runs with a geometry epoch, and quality may not depend on whether it was used; and a manufacturer or a benchmark operator gets twice as many loads per day. If the panel prefers every run to use the cap, I would add, in this order and as fixed tier settings:

| Addition | Cost | What it improves |
|---|---|---|
| Bracket groups G1 and G3 at the fast tier (time-marched) instead of the preview tier | + 2.8 to 3.5 min | sensitivity of pulse-dependent quantities (dewetting between passes) to the two most influential closures |
| A second official-tier realisation of stages E and F with an independent seed | + 6.1 to 7.5 min | direct estimate of sampling error per cell; halves Monte Carlo variance if the two are averaged |
| 1.4 mm water cells at the same time step | + 4.5 to 5.9 min | numerical lateral dispersion of narrow streams (6.2) down by about 16 % (it scales as the square root of the cell size) |

None of these changes a governing equation, and the third shows how little resolution buys: twice the cells for a sixth less dispersion.

### 11.6 Tiers

| Setting | Official | Fast | Preview |
|---|---|---|---|
| Water cell / soil cell | 2 mm / 1 mm | 4 mm / 2 mm | 4 mm / 2 mm |
| Tub cells | 5 mm | 10 mm | 10 mm |
| Arm phases per revolution | 16,384 | 4,096 | 2,048 |
| Sub-rays per round jet | 19 | 7 | 7 |
| Parcels per diverter state | 4 x 10^8 | 4 x 10^7 | 1 x 10^7 |
| Runoff | R1, T/1024, 3 + 2 and 2 + 1 revolutions, drain-down doubling every 512 steps | R1, T/512, same revolutions, doubling every 192 steps | R0 steady with pulsatility closure; drain-down by Jeffreys' law per cell |
| Soil layers / ticks | 12 / every revolution | 8 / every revolution | 4 / every third revolution |
| Bracket | 8 members at preview tier | off | off |
| Time, 6.1 / 8.5 m2, with allowance | 14.4 / 16.7 min | 1.7 / 1.9 min | 0.9 / 1.0 min |
| Use | scoring; manufacturer studies | level design, reference-load search, development | inside the bracket; instant feedback for level designers |

Fast-tier stage times (6.1 m2): set-up 12 s, shake-down 15 s, bundles and gather 1 s, Monte Carlo 11 s, routing 30 s, replay 19 s, end passes 6 s; 93 s.

### 11.7 How the fast tier is kept rank-consistent with the official tier

No coarse simulation can be proven to rank every pair of loads like a fine one when the output is thresholded. What I can offer is construction, a gate, a dead band and a monitor.

1. **Construction.** The tiers share every equation, closure and parameter. They differ only in sampling density, cell size, step and layer count. Random numbers nest (10.2). The features that are smaller than a fast-tier cell are the ones that are analytic in every tier: footprint tracks are integrated along the track at soil-cell resolution from exact hit geometry, and residual area is reported through cover fractions, not cell counts.
2. **Gate.** For each MAJOR version, on a fixed suite of at least 60 loads (the reference loads of the benchmark plus single-change perturbations of each: one item moved, turned, added, removed): Kendall tau between fast and official level scores at least 0.90; per-item verdict agreement at least 95 %; at least 90 % of disagreeing items carry the official run's fragility flag; no pair of loads whose official scores differ by more than three times the published tier noise is ordered the other way by the fast tier. A failed gate blocks the release or tightens the fast tier's settings, which have a factor of eight of headroom before they reach official cost.
3. **Dead band.** The fast tier reports each item's margin and marks items within one tier-noise standard deviation of the threshold as uncertain. Level-design tools compare loads only outside the band.
4. **Monitor.** Every official run contains a preview-tier nominal run, so the tier residual per item accumulates over all official runs ever made. Drift in its distribution after a code change is a regression signal that costs nothing extra.

Where I expect the tiers to disagree: narrow rivulet paths on plastics (4 mm cells halve the number of distinct paths), items whose only wetting is at 10^-3 to 10^-4 of the mean flux (ten times fewer parcels), and thin features under 4 mm wide (tines, rims), which the fast tier carries as single cells.

---

## 12. Module decomposition

### 12.1 Modules

Each module has a CPU reference implementation in f64 TypeScript (module V) that defines its behaviour; the GPU kernel is tested against it within a stated tolerance. Modules communicate only through the typed records below, so they can be built and tested in parallel against recorded fixtures.

| Module | Responsibility | Consumes | Produces | Runs on | Unit-test oracle |
|---|---|---|---|---|---|
| K `core` | device wrapper (limits, binding-size assertions, buffer pool, staged allocation), kernel registry, fixed batching, Threefry, fixed-point helpers, checkpoint and cache store, provenance | - | - | CPU + GPU | spike benchmarks re-run as tests; random-number vectors |
| A `assets` | parametric item definition to primitives, patches, ring tables, feature tags, stitch links; cached per catalogue item | item definitions (items §9) | `ItemAsset` | CPU, offline or at first use | analytic areas and volumes; ray parity on closed shells |
| S `scene` | instances from poses; top-level BVH; global cell tables in Morton order; per-placement surface analysis (3.6): normals, gravity frames, routing links, terminal classification, basins, gap field, contact links, wetting parameters | `ItemAsset[]`, poses, contacts, materials, soil regions | `Scene` (GPU buffers + CPU tables) | CPU (WASM for priority-flood) + GPU | tilted plane, sphere, cone: analytic gravity directions, basin volumes, link weights |
| H `hydraulics` | operating points, arm speeds, stall, similarity classes, inventory; programme controller | `MachineSpec`, programme, inventory terms | `HydraulicState[]`, per-tick `MachineTick` | CPU f64 | machine §4.3 operating points, §3.3 arm speeds |
| J1 `jets.primary` | bundle tracing, hit classification, footprint records, loads on items, jet-wet masks | `Scene`, `HydraulicState` | `FootprintRecord[]`, `ItemLoads`, wire and edge source records | GPU | CPU reference tracer; thesis tile case |
| J2 `jets.gather` | impingement closures, track integral, surface walks, hand-over and departure sources | footprints, `Scene`, residual film thickness | `JetExposure`, hand-over deposits, sheet and departure source records | GPU | closed forms; jets §11.4 worked example |
| P `spray` | parcel generation from source records, flight, wall regimes, splash, deposition, rain density, impact duty | source records, `Scene` | `DepositionTable`, impact counters, rain grid, per-item split-half sums | GPU | terminal velocity; regime table; exact mass balance |
| R `runoff` | R0, R1 periodic, R1 drain-down, wetting machine, edges and drip sites, capillary stores, drip co-simulation with P | `Scene`, `DepositionTable`, jet-wet masks, liquor class | `FilmExposure`, `DrainDown`, basin inflows, drip-site rates, onset fields, convergence monitors | GPU (+ P) | Nusselt; Jeffreys; 1-D inertial reference; inclined-plate wetting data |
| T `timeline` | replay loop, pass W (effective exposure, thermal, fill fractions, onset), pools and basins, drift monitors, refresh and epoch triggers | all exposure records, `MachineTick`, `LiquorState` | effective exposure per tick, heat uptake, carry-over volumes, triggers | CPU + GPU | single-cell analytic cases; energy balance |
| Z `soil` | soil state initialisation (ageing transform, heterogeneity), soil step, release to liquor | effective exposure, `JetExposure`, rate tables | `SoilCell` state, release counters | GPU | soils §R6 published curves |
| C `liquor` | 25-state liquor model, detergent release, pH, bleach, enzymes, suspended soil, filter, foam; rate tables for Z | releases, heat uptake, `MachineTick`, tablet flux | `LiquorState` per tick, rate tables | CPU f64 | chemistry §10.12 regression tables |
| D `deposit` | stranding, fat and pigment deposition, dissolved residue, drying | drain-down records, `LiquorState`, pools | deposit fields, retained water | GPU + CPU | chemistry §5.3 worked magnitudes |
| B `rigid` | Jolt wrapper, wash friction, live jet loads, arm sweep, dispenser test, tablet drop, shake-down | `ItemLoads`, added masses, CPU reference tracer | poses, contacts, arm torque, events | CPU (WASM) | spike scenarios; analytic tipping thresholds |
| O `orchestrator` | stage graph, tiers, reserves, bracket, cache keys, progress, report assembly | everything | `WashReport` | CPU | end-to-end fixtures; determinism hashes |
| V `verify` | f64 reference implementations of J1, J2, P, R, Z; conservation audits; phenomenon A/B harness | - | test verdicts | CPU | - |

Six engineers can start at once on A+S, J1+J2, P, R, Z+C+T, and K+O+B. The fixtures that decouple them are: a `Scene` for three canonical loads (one plate, one rack row, full load), a synthetic `DepositionTable`, and synthetic exposure records.

### 12.2 Type sketches

```ts
// ---------- inputs ----------
interface WashInput {
  machine: MachineSpec;                     // as defined by the machine dossier §12.1
  programme: ProgrammeSpec; detergent: DetergentSpec;
  items: readonly LoadedItem[];             // settled poses from the loading phase
  seed: bigint; tier: 'official' | 'fast' | 'preview';
  closures?: Partial<ClosureParams>;        // calibration and bracket overrides
}
interface LoadedItem { item: ItemId; asset: AssetId; pose: Pose; material: MaterialId; soils: readonly SoilRegion[] }
interface SoilRegion { patch: number; sRange: [number, number]; thetaRange: [number, number];
                       soilClass: SoilClassId; wetLoading_kg_m2: number; history: AgeingHistory }

// ---------- geometry ----------
interface ItemAsset { primitives: Float32Array; bvh: Uint32Array; patches: readonly PatchDesc[]; stitches: Uint32Array }
interface PatchDesc { kind: 'revolution' | 'tube' | 'planar' | 'mesh'; rings: Float32Array /* s0, s1, r, z, slope, nTheta, cellOffset */; edgeRings: Uint32Array }
interface Scene {
  gpu: { instances: GPUBuffer; bvhNodes: GPUBuffer; primitives: GPUBuffer; ringTable: GPUBuffer;
         waterStatic: GPUBuffer; wetParams: GPUBuffer; siteTable: GPUBuffer };
  counts: { waterCells: number; soilCells: number; primitives: number };
  basins: readonly Basin[]; contacts: readonly ContactLink[]; itemCellRange: ReadonlyMap<ItemId, [number, number]>;
  epoch: number;
}
interface Basin { id: number; item: ItemId; spillCell: number; levelTable: Float32Array /* 16 x (level m, volume m3) */; cells: Uint32Array }

// ---------- hydraulics ----------
interface HydraulicState { id: number; diverter: 'L' | 'U' | 'A'; pumpRpmClass: number;
  arms: readonly { arm: ArmId; omega_rad_s: number; phase0: number; stalled: boolean }[];
  nozzles: readonly { arm: ArmId; posArm: Vec3; dirArm: Vec3; Q_m3_s: number; Vrel_m_s: number; d_m: number; slot: boolean }[];
  masterPeriod_s: number; stepsPerRev: number }
interface MachineTick { state: number; dt_s: number; sV: number; sQ: number; heaterOn: boolean; phase: PhaseId; pumpOn: boolean }

// ---------- exposure ----------
interface ExposureSet { key: CacheKey; epoch: number;
  film: GPUBuffer /* FilmExposure x 6 states */; drain: GPUBuffer /* DrainDown x 6 */;
  jet: GPUBuffer /* JetExposure x 2 diverter states x 2 viscosity points */;
  onset: GPUBuffer; jetWet: GPUBuffer;
  perState: readonly StateSummary[]; loads: ItemLoads }
interface StateSummary { vAir_m3: number; vFilm_m3: number; basinInflow_kg_s: Float32Array; dripRate_kg_s: Float32Array;
  tabletFlux_kg_m2_s: number; epsGamma: number; epsWet: number; epsMass: number; converged: boolean }
interface ItemLoads { phaseBins: 256; forceN: Float32Array; torqueNm: Float32Array }   // [state][item][bin][3]

// ---------- timeline ----------
interface LiquorState { T_K: number; pH: number; sigma_N_m: number; nu_m2_s: number; class: 'D' | 'W' | 'R';
  protease: number; amylase: number; paa: number; hoo: number; surfactant: number; chelantFree: number; caFree: number;
  fatFree: number; fines: number; grit: number; tds: number; volume_m3: number }
interface RateTables { T0_K: number; dT_K: number; fTprotease: Float32Array; fTamylase: Float32Array; aT: Float32Array[]; sfc: Float32Array[] }

// ---------- outputs ----------
interface WashReport { provenance: Provenance; items: readonly ItemResult[]; machine: MachineResult; diagnostics?: Diagnostics }
interface ItemResult { item: ItemId;
  soilMap: { cells: Uint32Array /* soil cell ids */; areaMm2: Float32Array; residual_mg_cm2: Float32Array /* per class */;
             cover: Float32Array; fatFilm_um: Float32Array; stain: Float32Array };
  deposits: { speckPerMm2: Float32Array /* per water cell, per size class */; residue_g_m2: Float32Array; fat_g_m2: Float32Array };
  water: { pooled_mL: number; film_g: number; beads_g: number; edgeDrops: number; bridges: number };
  motion: { moved: boolean; events: readonly MotionEvent[]; finalPose: Pose };
  confidence: { fragile: boolean; sigma: number; mcError: number; tierResidual: number; memberDeltas: Float32Array } }
```

### 12.3 GPU buffer layouts and bindings

Record layouts already given: FilmExposure, DrainDown, JetExposure (7.3), SoilCell (8.1). The others:

**Primitive**, 48 bytes: type u8, feature u8, patch u16; eight f32 parameters (frustum: r0, z0, r1, z1, side, theta_min, theta_max, rim radius; capsule: p0, p1, radius, width); firstRing u32; s0 f32; aux u32 (perforation mask or wire width).

**BvhNode**, 32 bytes: min vec3 f32, leftOrFirst u32, max vec3 f32, count u32.

**Instance**, 80 bytes: world-to-local 3 x 4 f32; bvhRoot u32; primBase u32; cellBase u32; item u16, kind u8 (static, arm), arm u8; omega f32; phase0 f32; axis vec2 f32.

**FootprintRecord**, 48 bytes: Qhit f32 (m3/s); V f32 (m/s); centroid u, v f32 (patch coordinates); sinPhi f32; tangent angle f32; footprint velocity u, v f32 (m/s); fc f16; flight time f16 (ms); patch u32; nozzle u16; phase u16; dEq f16 (mm); flags u16.

**WaterCellStatic**, 96 bytes:

| Offset | Field | Type |
|---|---|---|
| 0 | world centre, area | vec3 f32, f32 |
| 16 | normal (octahedral), gravity direction angle in the tangent frame, sin(beta) | 2 x i16, i16, f16 |
| 24 | G_n, width across the flow, two principal curvatures | 4 x f16 |
| 32 | donor[8] (cells that drain into this one; 0xFFFFFFFF = none) | 8 x u32 |
| 64 | donorWeight[8] (share of the donor's discharge) | 8 x u16 / 65535 |
| 80 | twin cell on the opposite face | u32 |
| 84 | global ring index | u32 |
| 88 | first soil cell (0xFFFFFFFF = unsoiled) | u32 |
| 92 | gap (log), material, feature (smooth, edge ring, pit, drip site, wire, contact, pole), side-table class | 4 x u8 |

**RunoffHot**, 16 bytes, two copies (ping-pong): film mass m f32 (kg/m2); discharge Q f32 (kg/s); bead store b f32 (kg/m2); dewetting clock f16 (s); regime u8; pad u8.

**RunoffAcc**, 32 bytes, used in recorded revolutions only: sums of loading, thickness, shear, deposition (4 x f32); maxima of bin-mean loading and shear (2 x f16); counts of steps flowing, wet, and above the four shear levels (6 x u16).

**WetParams**, 16 bytes per water cell and liquor class: Gamma*_a, Gamma*_r, delta_wet, b_max, t_dw, edge We_c, f_min, spare (8 x f16).

**DepositionTable**: accumulator 64 x u32 per water cell (unit 10^-11 kg per revolution and bin); packed 64 x f16 (g/(m2 s)) for routing.

**TimelineWater**, 48 bytes: T_s, T_mid f32; film and bead mass f32; cumulative deposition f32; onset progress f16; fill fractions 4 x u8; speck intensities 2 x f16; residue, fat deposit f16; current cos(theta_r), Gamma*_a f16; cover summary and regime u8; condensate f16; flags.

Bindings per kernel (limit: 10 storage buffers per stage, 4 bind groups; uniforms are separate):

| Kernel | Storage buffers bound |
|---|---|
| `trace_primary` | instances, bvhNodes, primitives, nozzle table, rain grid (read), hits out: 6 |
| `gather_jet` | footprints, bin offsets, bin lists, waterStatic, ringTable, film thickness (read), JetExposure out, hand-over counters: 8 |
| `trace_parcels` | instances, bvhNodes, primitives, ringTable, source records, deposition counters (atomic), impact counters (atomic), rain grid (atomic): 8 |
| `runoff_step` | waterStatic, wetParams, hot in, hot out, deposition table, drip ring, RunoffAcc, siteTable: 8 |
| `timeline_W` | waterStatic, FilmExposure (window on the active state), DrainDown (window on the previous state), onset, TimelineWater, effective exposure out, counters: 7 |
| `soil_step` | SoilCell, effective exposure, JetExposure (window on the diverter state, both viscosity points), TimelineWater (read), rate tables, counters: 6 |

Windows are buffer bindings with an offset and a size, which the spike confirmed to work beyond 4 GiB offsets; here all offsets are far below that.

---

## 13. Verification plan

### 13.1 Module tests against analytic or published results

| Module | Test | Target | Tolerance |
|---|---|---|---|
| H | Operating points of the three diverter states | machine §4.3 table [ESTIMATED, the model's own reference] | 1 % |
| H | Arm speeds at 3,000 rpm | 35, 30, 60 rpm (machine §3.3) | 0.5 rpm |
| H | Stall | lower arm stalls at 0.07 N m contact torque (machine §3.3) | 5 % |
| A, S | Surface area of every catalogue item from its cells | Pappus integral of the profile | 10^-4 |
| A, S | Hit-to-cell mapping, 10^6 random surface points per patch type | the mapped cell contains the point | every point |
| S | Gravity direction and link weights on a plane at arbitrary orientation | centroid of a routed point source follows g_t | 0.5 degree |
| S | Basin volume of a mug base recess, level | pi R^2 h = 5.9 mL for R = 25 mm, h = 3 mm (standards P36) | 5 % |
| S | Wedge left in the same recess when tilted | V = (8/15) sqrt(2R) h^2.5 / tan^1.5(theta): 1.4, 0.42, 0.13 mL at 7, 15, 30 degrees (standards P37) | larger of 0.2 mL and 10 % |
| J1 | GPU tracer against the f64 reference, 10^7 rays on the full load | same primitive; hit point | 99.999 %; 1 um |
| J1 | Leakage through shells from inside | none | below 10^-6 of rays |
| J1 | Dwell against radius | 0.1667 s at 40 mm and 0.0266 s at 240 mm, ratio 6.3 (standards P07, thesis Table 5.5 [VERIFIED]) | 5 % |
| J1 | Thesis tile with the DU750 nozzle table | only jets 2 and 4 reach the tile; impact times 0.0013 s and 0.0272 s per 1.71 s revolution (jets §9.1 [VERIFIED]) | same two jets; times within 20 % |
| J2 | Radial film thickness, velocity, shear | Bhagat and Wilson forms (jets §4.4 [VERIFIED]), evaluated independently in f64 | 1 % |
| J2 | Fast-film radius of a 2 mm jet at 0.6 to 4 L/min | R_j = 0.289 Q^(3/4) (rho / (nu gamma))^(1/4); three published constants 0.276 to 0.3025 (jets §4.5 [VERIFIED]) | 5 % against the formula |
| J2 | Oblique flow split | integral of q(psi) over psi equals Q | 0.1 % |
| J2 | Track integral: J2-8 jet at 50 C sweeping at 1 m/s | peak 236 Pa; above 100 Pa for 12 ms; above 30 Pa for 45 ms; 4.3 Pa s on the track; 52 Pa and 1.6 Pa s at 20 mm off it; force 0.20 N (jets §11.4 [ESTIMATED]) | 5 % |
| J2 | Splatter | S_W = 0.18 at V d / nu_20 = 15,900, xi = 0.09 (jets §11.4) | 2 % |
| P | Terminal velocity of 0.16, 0.5, 2 mm drops | balance of weight and Schiller-Naumann drag | 1 % |
| P | Trajectory with drag | f64 Runge-Kutta at 10 us | 0.2 mm over 0.5 m |
| P | Wall regimes | thresholds of the table in 5.8 at +/- 1 % of each boundary | exact branch |
| P | Mass | emitted = deposited + still airborne + returned to the sump | exact, in integer units |
| P | Sampling error | variance proportional to 1/N on a canonical patternator scene | slope -1 +/- 0.1 |
| R | Steady film on an incline | Nusselt thickness, velocity, shear (films §12.10) | 2 % |
| R | Drainage of a plate | Jeffreys' law at 2, 10, 60 s (films §8.1) | 10 % (measured 3 to 9 %) |
| R | Pulsed supply on a vertical plate | the inertial reference of 6.9 | means 10 %, peaks 30 %, for peak loadings up to 0.45 kg/(m s) |
| R | Rivulet-to-film transition on acrylic, water 43 C | 0.125 to 0.21 kg/(m s) at 90 degrees; 0.108 to 0.174 at 5 degrees; wetted fraction 0.1 to 0.2 below the transition (films §12.10 [VERIFIED]) | inside the bands (the closure gives a transition at 0.163 kg/(m s) at both tilts and wetted fractions of 0.11 to 0.2 from one tenth of the transition flow up to it) |
| R | Film under an inclined plane | drips at h = 0.52 l_c, 81 degrees from vertical; none at 0.55 l_c, 60.5 degrees (films §12.10) | correct branch |
| R | Pendant-drop spacing under a level edge | 22 mm for water at 25 C (films §12.10); the closure gives 24 mm | 15 % |
| R | Puddle height | 2 l_c sin(theta/2) (films §12.10) | 5 % |
| R | Rim | clinging below We_c = (r/h)(1 + cos theta), never below 2 (films §12.10) | correct branch |
| R | Global water mass | closed over a revolution | 0.1 % |
| T | Wetted element heating | exponential with the time constant of 6.11 | 2 % |
| T | Replay against direct integration of one soil cell under a pulsed forcing resolved at 1 ms | residual mass history | 2 % |
| T, C | Energy | heater input = liquor + tub + items + losses + evaporation | 0.5 % |
| C | ECO-50 main-wash timeline | T, pH, peracid, enzymes at 10 to 90 min (chemistry §10.12 table, a regression target) | 2 % |
| Z | Egg-yolk swelling | 95 % of equilibrium at about 90 min; h_inf 0.41, 0.70, 0.45, 0.82 mm for the four conditions (soils §R6) | 10 % |
| Z | In-machine egg yolk | 0.85, 1.75, 2.59, 4.66 % per minute; completion at about 65, 45, 25 min; decay after 70 % (soils §R6) | 20 % |
| Z | Starch in channel flow | onset after about 40 s at 1 m/s and 50 g/m2; constant rate; time proportional to loading (soils §R6) | 25 % |
| Z | Jet peeling | a proportional to t^0.2 with K = 7.2 mm s^-0.2 (soils §R6) | 15 % |
| Z | Baked soil adhesion decay | 0.06 N/(m s) at 20 C, 0.51 at 50 C (soils §R6) | 15 % |
| B | Tipping of an inverted cup | F > W R / (R + e) (items §4.4) | 5 % in threshold force |
| B | Lid hop | 20 g lid over a 0.42 N jet rises and hits the rack above (items §4.4) | qualitative |
| O | Determinism | five washes of a golden load give one report hash (benchmark §4.5 `repro-5`) | identical |
| O | Tier consistency | gate of 11.7 | as stated |

### 13.2 Conservation checks, asserted in every run

- Water: nozzle outflow against stores, airborne and sump return, per revolution and per state (0.1 %); sump inventory over the programme (fills = drains + carry-over + evaporation).
- Parcels: integer mass balance, exact.
- Soil: per class, on items + in liquor + on filter + drained + redeposited = initial (10^-4 of the initial mass).
- Energy: as in the table (0.5 %).
- Counters: no overflow; no non-finite value (the run fails otherwise).

### 13.3 The standards checklist

"E" means the phenomenon should emerge from geometry and the general models. "C" means it emerges, but its size is set by a closure I have marked [ESTIMATED] and it is in the bracket or the calibration list. "S" means it is represented statistically. "I" means it enters through inputs or the soil or chemistry models, which this design carries but did not originate. The pass criterion is the dossier's: correct sign and magnitude within a factor of two or one score point (standards §9.1).

| ID | How it arises here | Kind |
|---|---|---|
| P01 hollow item open side up | rays cannot enter from below; the cavity is a basin fed by parcels; pool composition is carried through drains; submerged soil sees pool chemistry without shear | E |
| P02 soiled face turned away | no primary footprints on that face; only deposition and runoff | E, size C |
| P03 plate pitch | exact dwell and reach geometry of bundles between plates | E |
| P04 nesting | gap field: no parcel access, gap stores, no film flow below 0.4 mm, no renewal | E for access, C for exchange |
| P05 large item shadows | first-hit tracing | E |
| P06 arm stalled | rigid-body arm sweep; stalled state with one phase | E |
| P07 centre against corner | arm kinematics and nozzle table | E |
| P08 left/right asymmetry | nozzle directions fixed in the rotating arm frame | E |
| P09 lean direction | exact incidence angle on exact normals | E |
| P10 tall narrow vessel | entry only while a suitable nozzle is under the opening; interior by surface walk and departure rule | E for entry, C inside |
| P11 upper against lower rack | per-arm hydraulics, flight distance, break-up weight | E |
| P12 alternating plate sizes | geometry | E |
| P13 glass over tines | tines are capsules in the jet path; contact links and bridge stores at the tips | E, marks C |
| P14 face against the tub wall | gap field, parcel access, slow renewal | E, size C |
| P15 nested spoons | as P04, given the nested pose from the loading phase | E, C |
| P16 heads up or down (negative control) | basket walls with perforation masks; secondary water inside cells | C: depends on mist reaching cutlery; a named risk |
| P17 crowded cells | contact and gap statistics from the settled poses | E |
| P18 tray against basket | spoon bowls facing up are basins | E |
| P19 overloading | more shadowing, smaller gaps, more soil per litre in the liquor model | E |
| P20 total soil load | liquor model: consumption, suspended load, filter loading, foam derating | I |
| P21 redeposition of particulates | speck intensity from stranding, pools and flushing | S |
| P22 clean neighbours | deposits only through liquor and splash | S |
| P23 end-of-cycle drips | drain-down solve traces the last drips onto items below | E |
| P24 easy soils, arrangement irrelevant (negative control) | onset gate: any surface reached by 10^-3 of the mean flux is wet within minutes | C |
| P25 dispenser blocked | lid sweep test; release factor | E |
| P26 tablet in a dead spot | tablet dropped as a body; dissolution from the recorded flux at its resting place | E, rate C |
| P27 time and temperature trade | full programme replay with the liquor model | I |
| P28 bleachable stains position-insensitive (negative control) | stain term needs only wetness, oxidant, temperature | C through the onset gate |
| P29 ageing | ageing transform of the soil model | I |
| P30 protein: frequency and chemistry, not jet strength | threshold of 10 Pa far below the jet peak; time above threshold and enzyme factor enter linearly | E given the soil model |
| P31 starch bimodal | cohesive rule fires or not depending on swelling against available shear; wet-or-dry switch | I, C |
| P32 microwaved milk on glass | soil class parameters | I |
| P33 fat needs temperature and water | solid-fat curve at the element temperature, with the supply-limited heating of 6.11; fat redeposition on plastics | E for cold spots, I for kinetics |
| P34 thick layers flake | adhesive detachment rule; detached mass becomes grit and coarse load | I, S |
| P35 pot interiors | geometry as for P10; four scored surfaces are patches | E, C |
| P36 pool in a base recess | priority-flood basin | E |
| P37 tilt drains the recess | priority-flood on the tilted geometry | E |
| P38 plastic stays wet | bead store, receding angle, low stored heat in the drying model | E, size C |
| P39 pots stay wet | sheltered interior in the lumped drying model; rim and recess stores | E, C |
| P40 liquid at contacts and in gaps | bridge and gap stores sized by the capillary-rise formula | C: a closure, not an emergent meniscus |
| P41 light items moved or flipped | shake-down with live jet loads | E, C through friction and turning factor |
| P42 cutlery dries (negative control) | lumped metal node, drains along its length, single edge drop | E |
| P43 spots and tine marks on glass | dissolved residue from retained drops and bridges | S |
| P44 cutlery comes out clean | thin soil, repeated secondary wetting | C: depends on the same closures as P16 |
| P45 class ranking | calibration target for the whole chain | - |
| P46 run-to-run repeatability | **not emergent**; see 13.4 | - |
| P47 everything wetted within seconds; jets rare | onset times from the deposition field; duty of primary footprints from kinematics | E, C |
| P48 detergent does not change where water goes | jets and parcels use clean-water properties by construction (jets §4.5 [VERIFIED]) | E |

Count: 32 of the 48 arise from geometry, kinematics, lumped hydraulics or rigid-body mechanics, where this design is exact or nearly so; for 12 of those the size of the effect is set by a closure marked [ESTIMATED]. Five more rest on such closures outright, and three of the five are negative controls (P16, P24, P28). Six come from the soil and chemistry models, three are statistical and two are system-level targets. That count is the error budget of section 2 seen from the other side: the negative controls are where this design is most exposed.

### 13.4 What this design does not reproduce

1. **Two-dimensional film dynamics**: the shape and unsteadiness of the film jump, capillary ridges at contact lines, roll waves, rivulet meandering and braiding, fingering of a draining front. Wetted fractions and stripe widths are closures; where a stripe lies is a frozen pseudo-random choice.
2. **Inertial runoff outside the analytic jet zone**: overshoot past a concave corner, a gravity film leaving a sharp edge as a jet, the acceleration zone below a strong source (quantified in 6.9: up to 25 % in mean shear in the first 5 cm below sources two to three times stronger than realistic).
3. **Air**: no air motion, so no mist carried by the draught of the arms or by buoyant convection, no evaporative cooling of droplets in flight; drying uses one air node.
4. **Droplet-droplet and jet-jet interaction**, beyond a mean-field attenuation of jets by rain. No coalescence, no collision break-up.
5. **Transients of a jet entering a vessel**, air trapped in an inverted narrow-necked vessel, the returning curtain crossing the incoming jet.
6. **Three-dimensional pool dynamics**: sloshing, stirring by a plunging jet beyond a mixing efficiency, splash-out. Pool surfaces are flat and level.
7. **Soil acting on the flow**, except through contact angles: no damming by thick deposits, no shadowing by lumps, no chunks travelling down a plate and lodging.
8. **Individual particles**: redeposition is an intensity per cell; no particle is tracked, so the filter's spatial blinding pattern and particle trapping in specific crevices are absent.
9. **Foam as a material**: only its effect on pump head. No foam blanket on items, no foam carried into rinses.
10. **Persistent motion**: rattling, rocking on every pass, glasses chattering against each other, slow creep along tines. Items are either at rest in a pose or flagged.
11. **Run-to-run variability as chaos (P46)**: the model is deterministic and its periodic states have almost no memory of the seed. A standard deviation of 0.08 to 0.10 in the load mean can only be produced by seeded input perturbations (fill volume, release time, inlet temperature, soil loading), whose sizes are then calibration inputs, not predictions.
12. **Material damage and deformation**: warping plastics, glass corrosion, chipping, discolouration other than pigment uptake.
13. **Aerated jets** when the pump ingests air (only the head loss), water hammer, diverter transitions.
14. **Sub-millimetre geometry**: embossed patterns, scratches, crazed glaze, the film between fork tines closer than a millimetre (a gap rule).
15. **Marangoni effects and rinse-aid tears**, drying patterns; where a spot forms inside a retained drop's footprint is not predicted.

---

## 14. Risks, unknowns and first prototypes

### 14.1 Risks

| # | Risk | Why it matters | Early signal | Mitigation |
|---|---|---|---|---|
| 1 | The kinematic cascade is not good enough in two dimensions: gentle slopes, vessel ceilings and corners, plates with rims, faces fed from the side | It is the central bet; my evidence is one-dimensional and vertical | prototype 2 | the runoff module boundary (deposition in, FilmExposure out) allows a depth-averaged inertial solver on selected patches; at the same cell size it needs about 4 times as many steps (0.4 ms against 1.7 ms) at a cheaper step, so roughly 2 to 5 times the routing cost of those patches [C-EST] |
| 2 | Secondary-water closures decide too many outcomes, so results are arbitrary until calibrated; negative controls P16, P24, P28, P44 fail for every plausible setting, or pass for none | Rank 2 of the error budget | prototype 3 | bracket in every run; first calibration tests are the splatter collection and the wire patternator (jets §12 items 3, 10); offline resolved runs of a jet on a wire and on a rim to tabulate fans |
| 3 | The wetting regime machine (thresholds, rivulet width law, dewetting clock, sub-cell rank) gives residue patterns that look wrong or flip with small changes | Plastics and steel; drying | prototype 2 against the inclined-plate images | the regime machine is one module with five constants; a contact-line-force solver can replace it on rivulet-prone materials |
| 4 | Exact primitives do not cover the catalogue: whisks, colanders, graters, embossed ware; stitching add-on patches is laborious | Engineering time; fallback triangles lose exact normals and O(1) mapping | prototype 1, asset coverage count | triangle primitives and mesh patches exist as a first-class fallback from day one |
| 5 | Throughput derates are wrong by more than 2 | Budget | prototypes 1 and 2 measure the two kernels that carry 60 % of the time | the typical run has 13 minutes of headroom; routing can drop to T/512 at a cost quantified in 6.9 |
| 6 | Shake-down does not converge; geometry epochs are common | Bounded cost but degraded items | rigid-body spike extended with jet loads | reserve rule; calibrate wet friction first (items §14 item 1) |
| 7 | Preview-tier sensitivities do not track official-tier ones, so sigma and the fragility flag mislead | Third distinguishing idea | prototype 3 | move the two leading groups to the fast tier (11.5) |
| 8 | Thresholded soil rules make verdicts chaotic in exposure (bimodal starch), so tiers disagree | Fast-tier ranking | tier gate | soften thresholds with the measured loading heterogeneity, which the soil model already carries; widen dead band |
| 9 | Periodicity fails: incommensurate top arm, intermittent basin spill, knocking arm | Biased records | convergence monitors | deterministic extension; report flag |
| 10 | Carry-over or retained water is far from the verified 0.3 to 0.5 L | Rinse chemistry, drying | first full-load run | bead capacity and bridge volume are the calibration knobs; rack wires need attention |
| 11 | Cross-machine results differ in verdicts | Benchmark comparability | second GPU family | reference configuration for official scores; fragility flag |
| 12 | The soil and chemistry dossiers' kinetic sets disagree | Every tenacious soil | - | both selectable; soil-side bracket; calibration priority 1 |

### 14.2 Unknowns I could not close from the dossiers

- Splatter fraction at dishwasher conditions (two conflicting data families; jets, known gap 2).
- Film under a footprint sweeping at 0.5 to 5 m/s at grazing incidence on a pre-wetted plate (jets, known gap 3). My r* rule is an estimate.
- Whether the dripping-mode thresholds are per side or total (films §6.4).
- Contact angles of real, aged tableware in real liquor at temperature (films §13 item 1).
- How much water rack wires carry and where they release it. Racks are 100 m of wire above everything in the lower rack.
- Dynamic surface tension at the surface ages of a dishwasher film (films §13 item 2): it decides whether class D angles apply 50 ms after a jet pass.

### 14.3 The first three prototypes

**Prototype 1: exact-primitive tracer and cell mapping (two weeks).** A two-level BVH over frusta, capsules and quads for a plate, a bowl, a mug with handle, a wine glass, a fork and a rack section, in WGSL, with the f64 reference. Measure segment queries per second for coherent bundles and for short incoherent parcel segments against the same items as triangle meshes at 0.25 mm chord error; measure leak rate, grazing-incidence normal error and mapping correctness. Retires risks 4 and 5 for stages C to E. Decision: if exact primitives are slower than triangles by more than 2 times per query, trace mist parcels against a 512^3 distance field (400 M rays/s in the spike) for the flight and keep exact primitives for the final hit.

**Prototype 2: the cascade in two dimensions against a reference (three weeks).** A dinner plate and an inverted bowl at rack inclination, 2 mm reduced-ring grid, fed by a sweeping-jet hand-over and uniform mist. Compare with (a) a depth-averaged inertial solver with a contact-line force on a 0.5 mm grid, written for this test only, and (b) the inclined acrylic plate data (transition flow and wetted fraction). Measure wetting-class maps, time-mean loading, mean and peak shear, cost per cell-step. Retires risks 1, 3 and half of 5. Decision gate: if more than 10 % of the area is in a different wetting class, or mean shear is off by more than 30 % over more than 10 % of the area, the inertial solver is adopted for the patch types that fail and the budget is re-cut (the typical run can absorb about 13 more minutes).

**Prototype 3: a rack slice end to end at the preview tier with the bracket (three weeks).** Eight plates, four glasses, a cutlery basket cell block, rack wires, one lower arm; primary jets, Monte Carlo, R0, onset gate, a two-soil model (an easy soluble soil and egg yolk). Run the eight bracket members and a fast-tier version. Check the negative controls (P16, P24, P28, P44) and two positive ones (P02, P03). Retires risks 2 and 7: it shows whether outcomes are stable across the closure ranges, which constants matter (and therefore which calibration tests and which offline resolved studies to commission first), and whether preview-tier deltas predict fast-tier deltas.

---

## 15. What I considered and rejected

### 15.1 Alternatives

| Alternative | Why rejected | What would change my mind |
|---|---|---|
| Time-stepped inertial depth-averaged film solve on every surface at 0.5 to 1 mm (the default of the numerics and films dossiers) | Its accuracy is capped by its inputs (splatter within x2, contact angle +/- 20 degrees); its wetting behaviour depends on a contact-line coefficient that varies from 0.085 to 1.0 with grid and tutorial (numerics §2.2(e) [VERIFIED]); it needs 0.1 to 0.5 ms steps (films §12.6) and was budgeted at 45 % of the run for two or three states and 32 simulated seconds. The cascade covers 6 states and 6 minutes of simulated drain-down in a third of the run | prototype 2's gate |
| Steady routing (R0) at the official tier | Steady formulas over-predict mean film shear by 20 to 90 % under pulsed supply (6.9), and dewetting between passes is a time-domain effect | if calibration shows starch outcomes insensitive to film shear, R0 with the pulsatility closure would cut the run to about 9 minutes |
| Triangle meshes and a triangle BVH as the primary geometry | Faceted normals at grazing incidence (20 to 60 % steps in sin^2 phi); 2 to 3 million triangles against 19,000 primitives; hit-to-cell mapping needs per-triangle tables | prototype 1 |
| Dense signed-distance grid for all rays | 1 mm resolution at 512^3 cannot represent 2 mm rims, tines and 4 mm wires or give exact normals; 537 MB | acceptable as a flight accelerator for mist (prototype 1) |
| Texture-atlas (chart) grids for surface state | seams and distortion on surfaces of revolution; a pole needs a special chart; neighbours across charts need tables anyway. Reduced rings have none of these and remain spatially coherent | - |
| Surfels without connectivity | routing needs neighbours and exact slopes | - |
| Exceedance histograms as the exposure record (numerics §4.2) | lose the pairing of momentum flux with shear and dwell that the peel term needs, and the order of events | - |
| Time homogenisation with cycle jumps (numerics §4.3) | replay of every revolution is cheaper than the dossier's estimate for homogenisation and has no control error | soil model 10 times more expensive |
| Per-phase splatting of footprints with atomics (numerics §7.2 stage D) | a gather is deterministic in float, integrates along the track and costs seconds | - |
| Resolved 3-D patches at run time (particles or grid) for pools or vessel interiors | 33 to 120 M particle-steps/s buys seconds of physical time for a litre at 2 mm, which cannot see a 100 um film; pools are well described by a level and a mixing efficiency | use resolved simulation offline to tabulate vessel-interior wetting and wire fans (prototype 3 says which) |
| Coarse whole-tub particle simulation for the rain field | 2 to 3 mm particles cannot represent 0.16 mm splatter mist or 2 mm jets; dilute ballistic droplets are more accurate as parcels | - |
| Meredith contact-line force with a frozen random contact-angle field | grid-dependent coefficient; needs sub-millimetre cells on plastics; random field has no measured basis | risk 3 |
| Local or adaptive time stepping in the runoff | unnecessary with implicit outflow; a fixed step keeps the code and the determinism argument simple | - |
| Closure bracket at the official tier, or seed ensembles | 8 official runs do not fit; seed ensembles measure sampling noise, which is not the dominant uncertainty | - |
| Adjoint or backward sampling of rain onto shadowed cells | ballistic paths with drag and splash are not reversible in a simple way; three smoothing levels reach 10^-4 of the mean flux | if wetting at 10^-4 to 10^-5 of the mean flux proves decisive |
| Rigid bodies stepped through the whole wash | 1 s of wall time per simulated second awake (spike); shake-down plus events captures when things move | - |

### 15.2 Assumptions of the dossiers that I challenged

- **That the film needs a momentum equation everywhere** (numerics §2, films §4.2, §12.6). Kept only inside the analytic jet zone; section 6.9 quantifies the loss.
- **That 840 to 2,100 phases per revolution make footprints contiguous** (numerics §4.2). At grazing incidence the footprint outruns the nozzle by 1/tan(phi); 16,384 phases are needed at 5 degrees (5.1).
- **That the minimum wetting rate on an incline follows g sin(beta)** (films §5.4). The inclined-plate data in the same dossier show no such increase at 5 degrees (6.4).
- **That the liquor-to-item heat transfer coefficient can be a constant** (chemistry §10.10). It must be supply-limited or shadowed faces heat too fast (6.11, 8.5).
- **That homogenisation is needed** (numerics §4.3). Replay is cheaper (7.7).
- **That jet-mobile items can be screened by a worst-case nozzle and then handled when they move** (items §4.6). Computed loads are available within a second of set-up, so the motion is resolved before any exposure is computed (9.1).
- **That a 30 minute run should be filled** (numerics §7.2 sizes the nominal job at 25 minutes). The typical run here is 14 to 17 minutes because the error ranking does not justify more (11.5).

### 15.3 Where dossiers disagree, and the side taken

| Topic | Dossier A | Dossier B | Side taken and why |
|---|---|---|---|
| Nozzle coefficients | machine §3.3, §12.1: C_v = 1.0, C_d 0.78 to 0.85 | jets §2.2, §11.3: C_v = 0.97 [RECALLED], C_d = 0.70 | C_v = 0.97 from jets (a velocity coefficient of exactly one is a placeholder); C_d from the machine nozzle tables, because the pump operating points and arm speeds were tuned with them. Jet speed is 3 % lower than in the machine dossier's tables; arm friction constants k_f must be re-tuned to keep 35 and 30 rpm |
| Splash mass ratio of droplets | numerics recommended model item 3: Bai-Gosman 0.2 + 0.6 r (dry), 0.2 + 0.9 r (wet) | jets §6.4, §11.3: capped at 0.3 because measured splash of millimetre drops is under 14 % | jets: it rests on measurements at the relevant drop sizes; the cap is in bracket group G2 |
| Rays per jet and phases | numerics: 64 rays, 4,096 phases | jets §11.3: 7 or 19 sub-rays, 0.25 degree steps (1,440 phases) | 19 equal-area sub-rays and 16,384 phases: sub-rays only need to resolve partial hits, phases must resolve the footprint path at grazing incidence |
| Film transition Reynolds number | numerics: about 400 | films §3.3: friction laws cross at 1,608 | no conflict: the first is Gamma/mu, the second 4 Gamma/mu |
| Film heat transfer | chemistry §10.10: 5,000 W/(m2 K) constant | films §9.1: 1.88 k / h | films, with the supply limit |
| Protein kinetics | soils §R3 and calibration table: Hill n = 3; 3 x 10^-5 kg/(m2 s); lag 9 min at 50 C | chemistry §10.6: n = 2; 3.7 x 10^-5; lag 300 s scaled with thickness squared | soils as a coherent set; chemistry's enzyme temperature optimum added (8.3) |
| Starch reference flux | soils: 2 x 10^-5 | chemistry: 4 x 10^-5 (a stated placeholder) | soils |
| Visibility thresholds | soils §R7: protein and starch 0.5 g/m2 (0.05 mg/cm2), 1 g/m2 on white ceramic | standards §10.3: 0.02 to 0.05 mg/cm2 for coloured soils, 0.1 to 0.3 for translucent films | outside my scope (inspector); the output is residual mass per class so either can be applied. The factor of 2 to 6 between them is larger than any numerical error in this design |
| Carry-over | machine §7.3: 0.4 L fixed | chemistry §5.6: decomposed into sump, films, pools | computed from the runoff stores plus 0.15 L of sump residual; 0.3 to 0.5 L is the validation target |
| Water in flight and on surfaces | machine §4.5: placeholder Q (t_flight + t_return) | numerics: 1 L (0.5 to 2 L) | measured from the simulation (4.5) |
| Rigid-body step and engine | items §13: 1 ms; Rapier suggested | spike: Jolt at 1/240 s | spike: measured |
| GPU memory | numerics: 6 GB | spike and lead: 2 to 3 GB, 4 GB ceiling | spike: measured; this design peaks at 2.1 GB |
| Run environment | numerics §6.1: native, not a browser | decision 2: Node + Dawn, browser-capable | decided; nothing in this design needs more than core WebGPU with requested limits |
| Exposure record | numerics §4.2: 12-level shear and 8-level pressure exceedance curves | soils §R5: events with peak shear, momentum flux and dwell, "not window means" | soils for jets; a 4-level duty curve for the gravity film |
| Film grid | films §12.6: three levels, 2 / 1 / 0.5 mm; numerics: 0.75 to 1 mm | - | 2 mm with analytic sub-cell treatment of jets and a coverage rank for rivulets; no affordable grid resolves a rivulet edge |
| Jet-mobile screening | items §4.6: static screen at 0.25 with a worst-case nozzle | - | the same threshold applied to computed loads |
