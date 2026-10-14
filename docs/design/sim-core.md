# Spotless wash-simulation core: implementation contract

> **Record of the build, kept as written.** This is the design contract of the wash simulation,
> written in October 2026 before the simulation was built; its status line below ("nothing is
> implemented yet") is of that time. The simulation now exists and departs from this document
> where `scope.md` says so: read `scope.md` first, and `docs/validation/README.md` for what the
> built simulation does. Tests in `packages/sim-verify` still check the code against the tables
> and interfaces written here. The index of the documents is `docs/README.md`.
> Drying, redeposition onto open surfaces, items moved by the jets, flakes, where a tablet lands
> outside its tray and every programme other than Eco 50 are out of scope (`scope.md`, "Out of
> scope"); the parts of this design that treat them were not built and will not be. The sizing
> programme below is a fixed course used to size the budgets, not a programme of the game.

Status: the single design the team builds. It was merged by the chief architect from three proposals (A "structured patches", B "unstructured general", C "fidelity-first sceptic") after a three-judge panel (physics, numerics, delivery). It supersedes the proposals. Nothing of the wash simulation is implemented yet. Every kernel rate is a planning rate until milestone MS0 replaces it with a measurement.

Companion documents: `docs/design/platform.md` (binding on every package: units, frames, math types, determinism, repository layout, geometry kernel, physics wrapper) and the dossiers in `docs/research/` (evidence for every parameter).

## 0. Conventions

- **Confidence tags** are carried over from the dossiers: [VERIFIED], [RECALLED], [ESTIMATED]. [MEASURED] is a figure from the GPU or rigid-body spike. [SYN] is an estimate or choice made in this document; where arithmetic backs it, the throwaway script is named (the scripts are kept as evidence under `docs/design/scripts/synth/` and `docs/design/scripts/revise/` and are not maintained code; module M13 re-implements each as a test).
- **Provenance marks**: (A §3.2), (B §7.4), (C §7.6) are sections of the three proposals. (J-phys), (J-num), (J-del) are the judges with the physics, numerics and delivery lenses. Dossiers are cited as `films §12.4`.
- **Units, frames, math types**: `platform.md` section 2. SI throughout; tub frame T (origin on the lower-arm axis at tub-floor level, x right, y back, z up); gravity g = (0, 0, -9.80665) m/s2.
- **Parameters**: every constant has a registry key (`film.betaCl0`), a default, a range, a tag and a source. No module may hard-code a physical constant; kernels receive them through uniform blocks built from the registry (module M2). A lint test fails on numeric literals in kernels and reference implementations other than 0, 1, 2 and exact geometric factors listed in M2.

Vocabulary used throughout:

| Term | Meaning |
|---|---|
| block | surface element of nominal 2 mm (official tier) on every surface. Carries cascade state, thermal nodes, deposition tables and all slow state. The unit of the cell graph |
| film cell | element that carries film unknowns in a periodic solve: one per block, or four per block (1 mm) on rivulet-prone items in main-wash-class solves |
| soil cell | 1 mm element (four per block) that carries soil state on soiled regions |
| solver R0 / K / S / LINE | steady routing; kinematic cascade (implicit-outflow reservoirs); inertial shallow-film finite volume; one-dimensional line model for wires and gutters |
| diverter state | which arms are fed: L (lower), U (upper), A (all); machine data may define others |
| pump class | group of pump speeds within +/- 4 % of a class centre |
| liquor class | W (water-like), D (main-wash liquor), R (rinse-aid rinse): fixes surface tension, the contact-angle column and the solve temperature |
| arm state | per active arm: free, knocking (with a phase-time table) or stalled at an angle |
| combo | one (diverter state, pump class, liquor class, arm state) |
| exposure set | all exposure records of one combo |
| tick | one master-arm revolution of the active state (or 2 s with the pump off, 10 s in drying): the step of the whole-cycle replay |
| base step | the synchronisation step inside a hydrodynamic solve, about 2 ms |
| wetness state | one of dry, sparse (beads or absorbed rain), residual film, flowing film, immersed: the five states through which every soil mechanism sees water (M8) |
| reference flux | j_ref = pump flow divided by item area, 0.10 kg/(m2 s) for the typical load; every "share of the mean flux" in this document refers to it |

Main symbols: rho, mu, nu liquid density, dynamic and kinematic viscosity; sigma liquor surface tension; gamma_w surface tension of clean water at temperature (used for jets, splatter and the fast radial film); h film thickness; q = h u volume flux per unit width; Gamma = rho |q| mass flow per unit width; tau wall shear stress; M film momentum flux per unit width (N/m); G_n = -g.n normal gravity (positive on upward faces); B = -g.x_s bed potential of a surface point (m2/s2); eta = B + G_n h + p_imp/rho surface potential; beta surface tilt from horizontal; theta_a, theta_r advancing and receding contact angles; l_c = sqrt(sigma/(rho g)) capillary length; d, V, Q jet diameter, speed, volume flow; phi jet incidence angle measured from the wall plane; v_s footprint sweep velocity; R_j radius of the fast radial film; xi splattered mass fraction.

---

## 1. Summary and decisions

### 1.1 The design in one page

One wash is computed in three layers.

1. **Exposure** (seconds of simulated time, most of the compute). For each combo that the programme uses, the simulator works out what every surface element is exposed to during one periodic regime of the spray arms:
   - Lumped hydraulics give per-nozzle flow, jet speed and arm speed (machine dossier model, C_v = 0.97 with re-tuned arm friction).
   - Jets are traced as rays against exact analytic geometry at 16,384 arm phases with 19 sub-rays per jet. Under each footprint the stagnation pressure, wall shear, film thickness and momentum flux come from the closed forms of the jets dossier and are integrated along the footprint track onto 1 mm soil cells by a deterministic gather.
   - Diffuse secondary water (splatter, wire and rim fans, broken-jet splash, jet-driven sheets) is a Monte Carlo of 3 x 10^8 droplet parcels per diverter state in the main-wash pump class, allotted with the help of a pilot pass and deposited with integer adds into phase-binned tables.
   - Water on surfaces is time-marched through the periodic forcing by two solvers behind one contract: an inertial depth-averaged film solver (S: second-order finite volume on structured patches with a contact-line model that is decided from start-of-stage states) on hollow ware and on every partially wetting item, and a kinematic cascade (K, with integer mass) on continuously wetting flat ware, on cutlery, on the tub and on rack wires. Drips, columns and sheets leaving the film are parcels co-simulated in time.
   - After each periodic solve the cascade runs a 60 s drain-down with the sources off.
2. **Replay** (the whole programme, cheap). The soil model of the soils dossier (12 hydration layers per soil cell) is stepped once per arm revolution for every revolution of the programme (about 3,400 ticks for the 145 minute sizing programme), reading the exposure records of the active combo and a layer of slow state that the periodic solves cannot hold: wetting onset under sparse rain, drain-down between diverter dwells, pool levels and compositions, wall temperatures, liquor chemistry, film composition, local stores of dissolved soil, condensation, redeposition. There is no cycle jumping.
3. **Events**. Rigid bodies are shaken down with cheap jet loads before any exposure is computed; later motion starts a new geometry epoch with a bounded re-exposure. Exposure sets are computed lazily in programme order, so each one sees the poses and the soil-dependent contact angles that exist when it is first needed. Nothing in an exposure set depends on the momentary pool levels or liquor temperature: a set is solved with its lumped basins full and at the solve temperature of its liquor class, and the timeline applies the actual level and temperature every tick.

Official tier: 15 minutes for a 13-place-setting load (5.1 m2, counted from the catalogue), 22 minutes for the 8.5 m2 design load, at most 28 minutes with every reserve drawn; GPU kernel time 12 to 19 minutes against the 20 minute allowance; peak GPU memory 2.1 GB (section 7). All of these rest on planning rates that milestone MS0 must replace with measurements; section 7.4 fixes in advance what is cut if they come out lower.

### 1.2 Decisions

| # | Decision | Chosen | From | Why, and what was rejected |
|---|---|---|---|---|
| D1 | Starting point | C's pipeline (expose, then replay every revolution against cached records) | C; ranked first by J-num and J-del, second by J-phys | Only structure whose hydrodynamic cost does not grow with programme length (the sizing case is 145 min), only one with slow-state physics, a bounded worst case and a cache that makes calibration affordable. A's programme march is rejected as the structure but its ordering is kept (D11) |
| D2 | Surface representation | Generator-following structured patches only: closed-meridian (s, theta) patch per shell of revolution with power-of-two ragged rows and pole cells, also for stretched shells (the stretch enters the metric); masked Cartesian patches for every planar face of boxes and rounded hulls; line elements for wires and gutters. No element is derived from a render mesh. Rows and columns are defined on the 4 mm grid and halved, so tiers are nested | A §3.2, §3.5; cell-graph view from J-del | Exact normals at grazing incidence, rim and both faces interior to one grid, O(1) hit-to-cell map, nothing stored that changes when an item moves. Matches platform.md (items are compounds of analytic primitives). B's remeshing pipeline is rejected (no implementation, runs per level, can reject assets). Subdividing render-mesh triangles is rejected: the edge strips of a rounded hull are 0.1 to 0.5 mm wide and would give 80,000 to 280,000 slivers per cutlery piece |
| D3 | Resolutions | block 2 mm; film cell 2 mm, and 1 mm on rivulet-prone materials in main-wash-class solves; soil cell 1 mm with a cover fraction; jet exposure gathered at soil-cell resolution with 2 x 2 sub-samples near tracks | films §12.6; C §3.4; J-num, J-del against J-phys | standards §10.5 needs 1 to 4 mm2 with sub-element coverage. films §12.6 asks for 2 mm where the receding angle in the current liquor is at most 10 degrees, which in main-wash liquor covers glass, glaze, steel, melamine, SAN and copolyester. 1 mm everywhere on partially wetting items costs 9 minutes at the planning rate and moves to the reference tier |
| D4 | Geometry queries | Exact analytic primitives in a two-level structure ((r, z) half-plane trees for shells of revolution, capsules, planar polygons); wavefront parcels; triangle BVH with analytic polish as the measured fallback | A §3.4, C §3.2; J-num | Unmeasured, so MS0 benchmarks it against the measured triangle path with a pre-declared go or no-go |
| D5 | Jet treatment | 16,384 phases, 19 sub-rays; gather per soil cell with closed-form integration along track segments of at most one jet diameter, in developed coordinates with one fold or concave seam crossing; hand-over at the fan limit by a retarded ring emitter that is rasterised onto film cells with integer masses and a capped speed; one edge-separation rule shared with the film solvers; item wrenches from the momentum theorem on the fan | C §5.1; A §5.5 to §5.7, §9.3; B §5.5 (chord integration); films §12.5 | B's 2,048 phases move a grazing footprint 3 to 8 mm per sample; B's fixed-speed hand-over leaves the 10 Pa contour to the film solver (J-num); C's relaxation-length offset beyond R_j is wrong (J-del) |
| D6 | Secondary water | Split by source: Monte Carlo into phase-binned integer tables (one per arm) for diffuse primary sources; time-coupled parcels for everything the film emits | C §5.8 and A §5.9; split asked for by J-phys | A and B give well under one parcel per cell where flux is 1 % of the reference flux; wetting of shadowed faces is decided there |
| D7 | Surface-water model | Two solvers, one contract. S (inertial, MUSCL with two-stage SSP, CFL 0.3 including capillary celerity) on hollow ware and all partially wetting structured items; K (cascade) on glazed and glass flat ware, cutlery, tub, wires, and for every drain-down. The class is a property of the catalogue item, never of the pose or the load | A §6 with the fixes of all three judges; C §6; allocation from J-num | J-phys wanted S everywhere, J-del wanted S only where a gate fails. Chosen: put the PDE where the cascade's dropped terms are first order and its evidence does not reach (contact lines, ceilings, vessel interiors), keep K where a kinematic wave is the correct leading-order model. A pre-agreed table (section 7.4) upgrades plates to S or shrinks S only from the MS0 and MS3 measurements |
| D8 | Momentum-flux factor | beta_m = 1.2 on both friction branches until a pulsed-film reference exists | this document, from J-del's finding | With the dossier's 1.2 / 1.016 switch, and also with a smooth blend, a first-order scheme is not grid-converged in pulsed flow (time-mean thickness 115 to 95 um between 2 and 0.5 mm cells; `betam_blend.py`); with 1.2 it is converged at 4 mm and agrees with K within 9 % |
| D9 | Wetting closures | films §12.4 contact-line model in a form that both cells of a face can evaluate: advance when the thrust on the line exceeds the advancing resistance, retraction as a kinematic sweep at the dewetting speed, a tilt law for beta_cl fitted to both acrylic windows with one table entry per cell size, bead-covered fraction in place of "any bead is wet", and one wetting-onset mass shared by K, S and the timeline | films §5.5, §12.4; C §6.4, §8.2; J-phys | A and B inherit a model that retracts at 0.04 to 0.14 m/s where the dossier gives 0.2 to 30 mm/s, and whose pin decision needs information outside the stencil |
| D10 | Exposure record | Three records: FilmExposure (32 B per film cell), DrainDown (8 B per block), JetExposure (56 B per soil cell near tracks) with exceedance curves in shear and in momentum flux, peaks, pass count, longest rest and four ordered events | C §7.3 layout; B §7.4 content; A §7.4 transient label | The peel term is the integral of the momentum-flux exceedance curve (B §7.5), the only form equal to soils §1.4.4. A's levels stop at 8 N/m; C's event dwell is a shear dwell |
| D11 | Whole-cycle integration | Replay every revolution (C §7.4) against exposure sets computed lazily in programme order; a steady record per combo solved from that combo's own pilot state, a transient record for the main-wash class solved from the other state's periodic state, a drain-down merge after every diverter switch, the wetting-onset gate, pool ODEs and condensation | C §7.4 to §7.6; ordering and labels from A §7.1 | No homogenisation error beyond one revolution. A steady record solved from the predecessor's state would freeze the draining remnant of the other rack into the whole dwell |
| D12 | Soil coupling | soils §7 model, f32 state, mass-based erosion gated on hydration, five explicit wetness states, hydration from first deposition, enzyme and oxidant supply factor on by default, soils kinetic set (including its alkaline path) with the chemistry dossier's enzyme temperature optimum, removed soil credited to the reservoir it dissolved into | C §8; new items required by J-phys | Thickness-based erosion removes dry mass 3.7 times faster from unswollen soil (`checks.py`); f16 layer water stalls hydration (J-num); an enzyme-free alkaline flux at pH 10.5 contradicts soils §2.2 |
| D13 | Rigid-body coupling | Shake-down before exposure, live jet loads re-cast at every engine step, geometry epochs with a bounded re-exposure; Jolt at 1/240 s through `@spotless/physics`; arms as one-degree-of-freedom bodies; tablet spawned at dispenser time | C §9; A §9.3, §9.4 | B's open-loop wrench series pushes a lid after it has left the jet |
| D14 | Determinism | Union of the three rule sets plus: stack string in every key and hash, operating-system update as a version bump, dead band or reference stack for verdicts, probe suite, double-buffered accumulators, integer block reductions, integer mass in the cascade and in every ledger, narrow fields only for statistics and proven-range counters, resume and warm cache must reproduce the hash | all three; lead's note of 19:50; J-num | |
| D15 | Budget use | No bracket inside scored runs; the minutes go to the S solver, parcels and drain-downs. Closure bracket, supply bracket and sigma replay are developer and level-acceptance options on cached exposure | J-num, J-del against C §11.3 | The brief says the time must buy realism |

The sizing case for every count in this document is the owner's machine and programme as far as they are known: a 60 cm, 13-place-setting machine with alternating lower and upper spray levels, a cutlery basket, a tablet collecting tray on the upper basket and a side-wall heat exchanger, running a fixed sizing programme of 145 minutes (module M4). The machine itself is data; SPOT-60 (machine dossier) supplies every value not yet known for the Bosch.

### 1.3 Error budget that drives the allocation

The verdict per item is: at most 4 visible specks, at most 4 mm2 of visibly soiled area, at most 1 mL of retained water (standards §10.2). Reading the soil model term by term (C §2.1, with J-phys's correction to the adhesive row):

| Mechanism | Wet or dry | Film shear | Jet events | Temperature and chemistry |
|---|---|---|---|---|
| Hydration, reaction-erosion (protein, starch with amylase) | switch | none below tau* = 10 Pa | linear in time above threshold; about 10 % of removal at a well-hit spot | exponential in 1/T, 2.6 per pH unit, Hill in delivered enzyme |
| Dissolution | switch | power 1/3 | none | weak |
| Cohesive erosion of swollen starch | switch | thresholded linear, 1 to 2 Pa | strips partly swollen layers | through swelling |
| Adhesive detachment | switch (soak) | thresholded: a 1 Pa film detaches ketchup once the wall is hydrated (C_ad = 14.2) | peel well before the film can | adhesion decay |
| Peeling | switch (soak) | negligible (M_f about 0.05 N/m) | decisive through M above M_Y = F_ad / eta_M | adhesion decay |
| Fat | switch | weak | displace soft fat | sigmoid in T |
| Bleaching | switch | none | none | oxidant, T |

Consequences used as test tolerances (section 8): wetting class of a soil cell below 5 % of soiled area misclassified between tiers; time-mean loading 10 %; film shear 30 % (mean) and 50 % (peak), which applies to starch and to adhesive soils; footprint track 0.5 mm, 1 degree, dwell 10 %; jet closures 5 % numerically; element temperature 1 K in quasi-steady conditions; pool volume the larger of 0.2 mL and 5 %; water mass 0.1 % per revolution. The jet closures themselves are within a factor of 2 only inside their validated range (incidence 30 to 120 degrees, Re up to 3.2 x 10^4 for film speed and 5.3 x 10^4 for thickness, jets §4.4, §4.7). Plates are struck at 5 to 30 degrees, where the equivalent-jet Reynolds number on the forward ray is 1.4 to 3.0 x 10^5 and the closures are extrapolations tagged [ESTIMATED]; there the fan shear and the film friction law differ by more than a factor of 3 at the same point (24 Pa against 80 Pa at 100 mm on the forward ray at 15 degrees), which is inside the cohesive strength range of cooked starch (9 to 70 Pa, soils §8.2). Section M5 caps the laminar zone, the registry widens `jets.kFilm`, and campaign C3 (section 11.2) runs before starch results are read.

Ranked sources of error today (C §2.2, A §2, B §2 agree on the order): (1) soil kinetics and adhesion constants, calibration only; (2) secondary-water transport and therefore the wetting map, half closure and half numerics; (3) receding angles on plastics and steel; (4) jet access, fully reducible and cheap; (5) jet stress magnitudes, closure only, largest at grazing incidence; (6) liquor history; (7) local delivery of chemistry and heat; (8) gravity-film thickness and shear; (9) redeposition; (10) pooling; (11) item motion; (12) numerics. Compute is therefore spent, in this order, on the wetting map (parcels and film), on the film physics of partially wetting and concave surfaces, and on making rows 4, 10 and 12 negligible.

---

## 2. Pipeline of one wash

### 2.1 Stages

Stage letters are those of the budget table (section 7).

```
A  set-up            CPU+GPU  expand shapes -> atlas, primitives, cell graph; top-level tree; placement analysis
                              (gravity frames, cascade links, basins, gap field, contact links, catchment areas, regime groups,
                              coverage ranks); soil initial state; thermal pre-pass of the programme -> solve temperature per liquor class
B  hydraulics,       CPU+GPU  operating points and arm speeds per combo; arm sweep and dispenser tests;
   shake-down                 shake-down of the load with primary-ray jet loads (geometry epoch 0)
   --- for each (diverter state, pump class, liquor class) pair of states, in the order the programme first needs it ("exposure(combo)") ---
C  primary jets      GPU      phase-domain trace of the active arms, hit classification, footprint records (trace part), wrenches;
                              read back to the CPU
E  pilot             GPU      on the run's own grid with preview sampling: 2,048 phases, 7 sub-rays, 10^7 parcels, emitter means,
                              R0 -> steady wet estimate, residual-film estimate, rain density, parcel importance, initial film state
D  jet gather        CPU+GPU  sector walks and footprint records (film part, with h_res, viscosity and rain interference);
                              gather segments and tile lists; closures gathered onto soil cells at 3 viscosity points -> JetExposure;
                              emitter tables, level schedules and jet-wet tables per arm; source records
F  Monte Carlo       GPU      diffuse secondary water -> phase-binned deposition tables, one per active arm (shared by the liquor
                              classes of one diverter state and pump class)
G  film              GPU      per state: periodic solve from its own pilot state (S and K with time-coupled parcels, lines, reservoirs)
                              -> steady FilmExposure; main-wash class: transient solve from the other state's periodic state
                              -> transient FilmExposure; then K drain-down for 60 s -> DrainDown; onset field
   --- end exposure(combo) ---
H  replay            CPU+GPU  tick loop over the programme: controller with feedback, liquor ODEs, effective exposure, thermal,
                              soil kernel, pools and local stores, deposits; triggers exposure(combo) when a combo is first needed;
                              rigid-body events may open a geometry epoch
I  end passes        GPU+CPU  final drain-down merge, drying, end-of-phase deposition, result assembly
J  I/O               CPU      checkpoints at stage boundaries and every 512 ticks, progress stream, cache writes
```

The pilot precedes the film part of the gather because the fan limits need the residual film and the coherent fraction needs the rain density; the trace needs neither. `FootprintRecord` is therefore written in two parts: geometry by stage C, film quantities by stage D.

### 2.2 Data flow

```
MachineSpec, programme ----> M4 hydraulics ----> HydraulicPoint(combo) ----+
Shapes, poses, soils ------> M3 scene -----> Scene (atlas, prims, graph) --+--> M5 jets --> FootprintTable, JetExposure,
                                   |                                       |               EmitterTable, SourceTable, ItemLoads
                                   |                                       +--> M6 spray -> DepositionTable per arm (Monte Carlo)
                                   v                                       |
                              M11 rigid <---- live wrenches (M5), added    +--> M7 film --> FilmExposure, DrainDown, FilmState,
                                   |          mass (M10)                                    basin inflows, drip rates,
                                   v  poses, contacts, arm torque                           onset field, StateSummary
                               new epoch
ExposureSet(combo) = { JetExposure x 3, FilmExposure (steady, transient), DrainDown, onset, jet-wet, StateSummary }   (cached by key)
M8 soil ---- wetting summary (cover, angle class) ----> M7 wetting parameters of the next exposure
M9 liquor <--- release by reservoir, heat ---- M10 timeline (replay) ----> M8 soil ----> soil state
M4 controller <--- feedback (liquor temperature and class, inventory, arm results) ---- M10
M10 + M8 + M7 end states ----> M12 orchestrator ----> WashResult ----> inspector (outside this document)
```

### 2.3 What runs where

| Work | Where | Why |
|---|---|---|
| Hydraulics, programme controller, liquor chemistry, machine thermal nodes, pools, gap and bridge reservoirs, filter | CPU, f64, single thread | tiny, stiff, order-sensitive |
| Shape expansion, atlas tables, bottom-level trees, gather segments, tile lists, emitter rasterisation, priority flood, parcel plans | CPU (TypeScript; WASM where noted), single thread or fixed partition | deterministic set-up |
| Rigid bodies; live jet wrenches on awake bodies | CPU, Jolt WASM, single thread, 1/240 s; f64 analytic tracer | `@spotless/physics` |
| Ray and parcel tracing, sector walks, jet gather, Monte Carlo, R0, K, S, lines, statistics, replay passes, soil kernel, reductions | GPU, WGSL compute | bulk work |
| Reference implementations of every kernel | CPU f64 (module M13) | define behaviour; compared within tolerance |

Every method that returns data computed on the GPU to the CPU is asynchronous (WebGPU has only `mapAsync`). GPU work is encoded in command buffers of 50 to 250 ms of planned GPU time (spike report §12). In the film stage that is one command buffer per half phase bin (7 to 10 base steps); `onSubmittedWorkDone` is awaited and the tile monitors are read back once per phase bin, and the per-item time-step levels of a phase bin are fixed before its first command buffer is encoded. Chunk sizes are computed from the frozen planning rates, never from the clock.

---

## 3. Geometry and surface representation

### 3.1 One source, three derived structures

The single source of truth is the platform `Shape` (a rigid compound of `sor`, `capsule`, `rbox` and `hull` parts with named `SurfaceRegion`s, `packages/geometry/src/types.ts`). Module M3 derives from it, as pure functions that are re-run whenever a level jitters dimensions (benchmark §4.3):

1. **ray primitives** for jets and parcels, exact for every platform primitive;
2. **patches**: structured grids of surface elements that carry water and soil;
3. the **cell graph**: one uniform view of every block (centre, normal, area, neighbours) used by placement analysis, by the routing solver R0 and by the output.

No simulation element is derived from the render mesh. `buildRenderMesh` tessellates each rounded edge of a hull as a strip two triangles long and 0.1 to 0.5 mm wide; subdividing those triangles gives 80,000 to 280,000 slivers per cutlery piece. M3 has its own tessellation, which follows the generator of each primitive:

| Platform primitive | Ray primitives | Patch | Notes |
|---|---|---|---|
| `sor`, full turn, unscaled | FRUSTUM bands of the closed offset meridian (outer face, at least 4 bands round each rounded end, inner face) | REV, periodic in theta | 87 % of the area of a standard load |
| `sor` with `arc` | FRUSTUM with azimuth window, 2 end QUADs | REV with a theta window | corner fillets of box shells |
| `sor` with `scaleXY` | same primitives; the ray is transformed by diag(1/sx, 1/sy, 1), the normal by the inverse transpose | REV in the unscaled (s, theta) with per-cell area, normal and face lengths from the stretched map; cascade only | oval platters, spoon bowls (6 % of the area) |
| `capsule` (item part) | CAPSULE | REV about the capsule axis | round handles, tines, stems |
| `capsule` chains of racks, baskets, whisks | CAPSULE | LINE, one element per 3 mm | water runs along wires; no soil state |
| `rbox` and `hull` (rounded convex polytopes, including the degenerate slabs and bars that `linkPart` and box shells produce) | one convex POLYGON per offset face; one CAPSULE per edge and one sphere per vertex, each restricted to its outward sector | one masked CART patch per planar face; edges and vertices become seams or REV strips (section 3.3) | boards, box-shell walls and floors, flat handles, blades, tub panels |

Nothing is remeshed and no boolean operation is performed. Parts of one shape may overlap; an element whose centre lies more than 0.2 mm inside another part of the same shape (`signedDistance` of the other parts) is **dead**: it is excluded from every solver and from area sums. Live boundary elements of different patches of one item that lie within 0.75 block widths of each other are joined by **stitch links** (section 3.6).

**Asset lint** (run for every catalogue item at MS0 and in CI): blocks per part at most 1.5 x area / D_B^2; no live block narrower than 0.25 D_B or smaller than 0.25 D_B^2; block area sum within 10^-4 of the analytic area; every region of the `Shape` receives at least one block. An item that fails cannot enter the catalogue.

### 3.2 The REV patch (closed meridian)

The platform defines a shell of revolution as all points within t/2 of the revolved mid-surface polyline, with rounded ends. The boundary of its meridional section is a closed curve C. It is parametrised by arc length s (A §3.2):

```
C: s in [0, S] -> (r(s), z(s))
tangent            (r', z') = (cos a(s), sin a(s))
3-D point          x(s, th) = (r cos th, r sin th, z)
tangent frame      e_s = (r' cos th, r' sin th, z'),   e_th = (-sin th, cos th, 0)
outward normal     n   = (z' cos th, z' sin th, -r')
metric             dl^2 = ds^2 + r(s)^2 dth^2
curvatures         kappa_s = da/ds,   kappa_th = z'/r,   kappa_g = r'/r  (geodesic curvature of parallels),   K = kappa_s kappa_th (Gaussian)
substrate mean curvature (films convention, positive where concave towards the liquid):  kappa_sub = -(kappa_s + kappa_th)
```

s starts on the platform's 'out' side at the axis end of the profile, runs along the out face to the rim end, round the rim semicircle (radius t/2), and back along the 'in' face to the axis end. If the profile starts on the axis (r = 0) the patch has two **poles** (s = 0 and s = S). If it starts at r > 0 (foot rings, tubes) the axis end is rounded as well, C is a closed loop and s is periodic. Consequences: both faces and the rim are interior cells of one grid; a film that clings round a rim flows through ordinary cells; the interior of an inverted cup is simply the rows near s = S.

The mapping to platform regions is per row: every row stores `side` (out, rim, in) and `sMid`, the normalised mid-surface arc length of the profile point it was offset from. A `SurfaceRegion {part, side, sRange}` covers the rows whose side matches (the rim semicircle is split at its apex between 'in' and 'out'; 'both' takes all) and whose sMid lies in sRange.

**Rows, columns, bands, and nesting of tiers.** Rows and columns are defined once on the coarse grid (D_C = 4 mm, the block size of the fast and preview tiers) and halved for the official tier (D_B = 2 mm) and again for the reference tier (1 mm):

```
coarse rows      N_C = max(1, round(S / D_C)),      D_s,C = S / N_C
coarse columns   N_th,C(I) = 4 * 2^round( log2( 2 pi r_I / (4 D_C) ) ),  minimum 4        (r_I = radius at the coarse row centre)
official         N_rows = 2 N_C,   D_s = D_s,C / 2,   N_th(i) = 2 N_th,C(floor(i / 2))      (minimum 8)
```

Every official block is one of the four children of a coarse block, in every tier and for every patch. Block width r dth stays within [0.6, 1.7] D_B (the lower end only next to a pole). Consecutive rows with equal N_th form a band; N_th changes by a factor of two at band boundaries only, and band boundaries fall on coarse row boundaries. Storage is row-major with a per-row offset; a neighbour in a row with a different N_th is addressed by an index shift (j << 1 or j >> 1). There are no halo copies. For a theta window (arcs) N_th columns span the window and the two end columns are seam boundaries.

**Pole.** The disc s < D_s at a pole is one block with 8 faces towards row 1 (N_th = 8 there). In the S solver the pole cell stores its momentum in the item's Cartesian frame; its reconstruction slopes are the minmod of the differences to opposite ring neighbours along its four axes.

**Sub-cells.** Every block is split 2 x 2 in (s, theta) into four **sub-cells**. Soil cells are the sub-cells of soiled blocks. Film cells are the blocks themselves, or the sub-cells where a main-wash-class solve runs at 1 mm (film class S1). A pole block is special: it holds 1 pole sub-cell and the 8 sub-cells of its outer half-ring. Because sub-cells and coarse parents are index shifts of blocks, restriction and prolongation between grids and between tiers need no tables.

**Row table** (40 bytes per film row, a few hundred rows per item): r, r', z', kappa_s, kappa_th at the row centre; r and z at the lower and upper s-face (9 x f32), and a packed u32 {log2 N_th: 5 bits; developable zone id: 8; side: 2; flags: convex edge, concave fold, band boundary above, band boundary below, gutter row, rim apex, pole: 7; spare}. Row offsets are in a side table. kappa_s is the finite difference of the tangent angle between row centres, so it is bounded by 1/D_s at polyline corners. Bed potential and normal gravity at any cell centre or face point follow from these numbers and the item's gravity vector; they are evaluated analytically, never differenced.

**Gravity in the cell frame** comes from one vector per item, g_item = R_item^T g (A §3.2):

```
g_s  = r'(s) (g_x cos th + g_y sin th) + z'(s) g_z
g_th = -g_x sin th + g_y cos th
G_n  = -( z'(s) (g_x cos th + g_y sin th) - r'(s) g_z )
B    = -( g_x r(s) cos th + g_y r(s) sin th + g_z z(s) )
```

A moved or flipped item changes g_item and nothing stored on it.

**Frames and closure.** Cell momentum lives in (e_s, e_th). Along a meridian the frame is parallel transported; between theta neighbours it turns by delta, and neighbour momenta are rotated by -/+ delta before use. This replaces all Christoffel terms (A §3.2). delta is defined from the face radii, sin(delta / 2) = (r_+ - r_-) dth / (2 D_s), so that the face normals of every cell, weighted by face length and expressed in the cell frame, sum to zero exactly. A uniform pressure then exerts no force on a cell, which the lake-at-rest property of the S solver relies on.

**Developable zones.** Consecutive rows whose tangent angle varies by less than 2 degrees form a zone tagged disc, cone(half-angle) or cylinder; a stretch shorter than 6 mm that turns by more than 15 degrees is a **fold** (concave or convex). Zones are used by the jet gather (M5).

### 3.3 Other patch kinds

- **CART**: a rectangle in a plane with cell size D_B (nested like REV rows: laid out at D_C and halved), one frame per patch, and a cell mask with cut-cell area fractions for faces that are not rectangles (rounded corners, polygonal hull faces). A cut cell with an area fraction below 0.25 is merged into its largest face neighbour: its area and its links join that neighbour and it is dead.
- **Edges and vertices of rounded polytopes.** An edge is a cylinder sector of radius r_e, arc width w_e = r_e x (turning angle) and length L_e. If w_e < 2 D_B it is a **seam**: it has no cells; each pair of facing boundary cells of the two adjoining faces is joined by a stitch link tagged with r_e and the turning angle, and half of the strip area is added to each side. If w_e >= 2 D_B the strip is a REV patch with a theta window about the edge axis. A slab or bar with a zero half-extent (flat handles, box-shell walls, blades) has two faces whose boundary cells meet in half-cylinder seams; every ray that strikes such a seam is mapped to the nearer face. Vertex patches are added to the nearest face cells. A seam whose two faces both drain towards it is a gutter and gets LINE elements.
- **REV with a stretch** (`scaleXY`): the grid of section 3.2 in the unscaled coordinates; cell area, normal, the two face-length pairs and the cell centre come from the stretched map x = (s_x r cos th, s_y r sin th, z) and are stored per block. The (s, theta) grid is not orthogonal there, so these patches run the cascade only.
- **LINE**: one-dimensional elements of 3 mm along capsule chains with a junction graph (rack and basket wires, whisk wires), and along the gutters that M3 generates on items: rim apex rows, lower edges of CART patches, gutter seams, tine and handle tips.
- **Tub, door liner, ceiling, basket walls**: CART patches with blocks of 2 D_B, cascade only, no soil. Basket walls carry a porosity.
- **Spray arms**: ray instances whose transform is a function of the arm's integer phase; each arm has one lumped water store that re-emits what lands on it as drips from the trailing edge after 0.2 s [SYN].

There is no triangle-mesh patch kind.

### 3.4 Film class of an item

The film solver and film cell size are properties of the catalogue item type, fixed at asset build, the same for every level, load and pose (A §3.5; J-del on pose smoothness). The rule uses the catalogue's shape tag and the wetting class of the part materials (`continuous_film`, `partially_wetting`, `rivulet_prone`, from the receding angles of films §12.7):

| Class | Rule | Solver in periodic solves | Film cell |
|---|---|---|---|
| S1 | any item, other than cutlery and utensils, with a part of a rivulet-prone material (receding angle above 20 degrees in main-wash liquor: polypropylene, PTFE, silicone) | S | sub-cell (1 mm) in main-wash-class solves; block (2 mm) in classes W and R |
| S2 | every other item with a part of a partially wetting material (receding angle above 10 degrees in main-wash liquor or above 20 degrees in clean water: stainless steel, melamine, SAN, copolyester, polyethylene); and hollow ware (shape tags cup, mug, glass, stemware, bowl, jug, pot, pan, container, lid) of continuous-film materials (glass, glazed ceramic, porcelain, enamel) | S | block, 2 mm |
| K2 | flat ware (plate, saucer, platter, flat dish) and every other item of continuous-film materials; cutlery and utensils of any material; any item with a stretched shell of revolution (the whole item, because S does not run on that grid); tub; basket | K | block, 2 mm (4 mm on the tub) |
| LINE | wires and gutters | LINE | 3 mm |

Cutlery and utensils run the cascade although steel is partially wetting: their faces are 3 to 20 mm wide, jets strike them as tine and edge hits, and their soils are thin. This is the least accurate geometry class; the tier gate and gate P2 carry a spoon and a fork case, and section 7.4 says when cutlery heads move to S. films §12.6 asks for 0.5 mm on rivulet-prone materials and 1 mm on partially wetting materials in clean water; neither fits the budget at the planning rate (section 7.2), both are in the reference tier, and the difference is measured by the tier gate.

The pre-agreed variants of section 7.4 move the flat-ware row to S2, or shrink S. A level whose largest plausible load would exceed the work budget carries an explicit per-item override that is identical for every player ("level lint", A §3.5).

### 3.5 Ray and parcel queries

Two-level structure (A §3.4, C §3.2).

- **Top level**: a bounding-volume hierarchy over instances (items, wire groups, basket, tub parts, arms), rebuilt in under a millisecond when anything moves. Each instance stores a world-to-local 3 x 4 transform. A REV instance is first tested against its bounding cylinder in the item frame, because plates at 25 mm pitch have heavily overlapping world boxes.
- **Bottom level, REV**: a binary tree over frustum bands in the (r, z) half-plane. A ray becomes r^2(t) = a t^2 + 2 b t + c, z(t) = z_0 + d_z t, and its overlap with an (r, z) box is a pair of interval tests. Band intersection is a quadratic, evaluated in the algebraic form chosen by slope with the stable root q = -(b + sign(b) sqrt(disc)), followed by one Newton step on g(t) = r(t) - rho(z(t)).
- **Bottom level, others**: a small hierarchy over capsules and convex polygons (a polygon test is a plane intersection followed by at most 8 half-plane tests; capsules and spheres of a polytope accept a hit only in their outward sector).
- **Precision**: intersections are done in item-local f32 (extent under 0.3 m, spacing 3 x 10^-8 m). The hit normal is always the analytic normal, never a difference. The error of a hit point along the ray is the surface error divided by the cosine of incidence, so the tracer's contract is stated in those terms (M3 tests).
- **Droplets** of diameter 1 mm or more are traced as swept spheres against primitives inflated by D/2 (exact for capsules, planes and polygons, a parallel offset for frusta).
- **Arms** are posed at the mid-time of each segment (segments last at most 9 ms, 4 mm of tip travel).
- **Porous parts** (porosity p): a ray passes with probability p decided by the counter-based generator keyed by (parcel lineage, part).
- **Leaks**: a back-face hit from inside a solid is a leak. The parcel ends, its mass goes to the ledger account `leak` and back to the sump. A run fails if leaked mass exceeds 10^-6 of traced mass (J-num: a logged diagnostic is not enough).

```ts
interface SegmentBatch { origin: GPUBuffer; dir: GPUBuffer; tMax: GPUBuffer; time: GPUBuffer; radius: GPUBuffer; count: number }
interface RayQuery {
  refit(poses: ReadonlyMap<string, Pose>): void;                       // top level only
  trace(pass: GPUComputePassEncoder, segments: SegmentBatch, hits: GPUBuffer /* HitRecord[] */): void;   // encodes; results stay on the GPU
  traceCpu(origin: Vec3, dir: Vec3, tMax: number, time: number, radius: number): HitRecordJs | null;     // f64 reference, used by M5 live wrenches and tests
}
```

`HitRecord`, 32 bytes: t f32; instance u32; prim u32; patch u32; a f32; b f32 (patch coordinates: (s, theta) or (u, v)); cosInc f32; flags u32 (feature tag: smooth, rim with radius code, wire with width code, edge seam with radius code; back face; porous pass).

`Primitive`, 48 bytes: type u8, feature u8, patch u16; 8 x f32 parameters (frustum: r0, z0, r1, z1, side, theta_min, theta_max, s0; capsule: p0, p1, radius, width; polygon: plane and index into the vertex buffer); firstRow u32; aux u32. `BvhNode`, 32 bytes: min vec3 f32, leftOrFirst u32, max vec3 f32, count u32 (for (r, z) trees the y components are unused). `Instance`, 80 bytes: world-to-local 3 x 4 f32; root u32; primBase u32; blockBase u32; item u16, kind u8, arm u8; bounding cylinder radius and half height 2 x f32; spare u32.

Analytic queries are not measured. Planning rate 60 M segment queries/s (section 7.1). MS0 decides: if the analytic path is slower than half the triangle path on the 140-item scene, tracing uses a triangle hierarchy at 0.2 mm chord error (measured 150 M rays/s mixed) and polishes each hit on the analytic primitive; the interface above does not change. A 512^3 sampled distance field (measured 400 M rays/s) may be added only to skip empty space for mist parcels; it never decides a hit, because 1 mm voxels cannot hold 1 mm walls, rims or wires (numerics §5.2).

### 3.6 From a hit to elements, and neighbour topology

Hit to element is closed form and needs no search:

```
REV:   s from the band (s0 + lambda L_band), theta = atan2(y, x) in the item frame (unscaled coordinates for a stretched shell)
       I = floor(s / D_s);  J = floor(theta N_th(I) / 2 pi);  block = rowOffset[I] + J
       sub-cell = 2 * floor(2 frac(s / D_s)) + floor(2 frac(theta N_th(I) / 2 pi))
CART:  (u, v) -> row, column, sub-cell likewise; a merged cut cell maps to the neighbour it was merged into
seam:  a hit on an edge capsule or vertex sphere -> the boundary cell of the adjoining face on the hit point's side of the bisector plane
LINE:  capsule index and axial parameter -> element
soil cell  = blockSoil[block] + sub-cell        (0xFFFFFFFF if the block is unsoiled)
film cell  = blockFilm[block] (+ sub-cell where the solve of the active liquor class stores sub-cells)
```

`blockFilm` is a u32 table per block and grid (block grid; sub-cell grid of class D): bit 31 says whether the block is S-solved, bits 0 to 30 are the word offset of its first deposit accumulator.

| Boundary | Mechanism | Used by |
|---|---|---|
| theta periodicity | modular index | S, K |
| band boundary (2:1 in theta) | index shift. The coarse cell evaluates both sub-face fluxes with the same expression and operand order as the fine cells. For reconstruction slopes the coarse cell uses the mean of its two fine neighbours and a fine cell uses the coarse row interpolated to its own theta (weights 3/4 and 1/4 of the two nearest coarse cells) | S |
| pole | one pole cell with 8 faces | S |
| neighbour inside one structured patch | index arithmetic; the cascade stores an 8-bit donor mask and 8 weights per block | K |
| any neighbour, any patch kind | explicit donor list of the cell graph (up to 8 per block) | R0, placement analysis, output |
| stitch links (handle root on a body, floor to wall of a box shell, seams of polytopes, part to part) | flux leaving one side during a base step is written as an integer deposit (mass and momentum) to the other side and applied at the next base step. The donor computes that flux against a ghost equal to its own face state, lets liquid out only (u . n > 0) and subtracts exactly the integer amount it deposited | S to S, S to K, K to K |
| contact links (item to wire, item to item) from the rigid-body contact manifold and from gap minima below 0.5 mm | bridge reservoir; a fraction xi_c of the discharge reaching a contact block transfers to the touching body's block if that block is lower | K, S through deposits |
| everything else between items | parcels | M6 |

Stitch and contact transfers are exact in mass because the receiver gains the integer the donor lost; they lag by one base step (2 ms), which is first order locally (J-num asked for one mechanism instead of A's mortar faces and B's pending buffers; this is the deposition interface of A §6.6). A stitch is a one-way valve in each direction: two pools on either side of a stitch do not level through it. Basins that span patches are lumped reservoirs (M7.6), so this matters only for puddles shallower than `film.poolDepth` at a floor-to-wall seam, and is listed in section 11.3.

### 3.7 Per-placement analysis (stage A, and for moved items after an epoch)

1. World centre, analytic normal, area and principal curvatures of every block.
2. Tangential gravity g_t = g - (g.n) n, sin(beta) = |g_t|/g, G_n.
3. Cascade links: for each block the two neighbours whose tangent-plane directions bracket g_t receive weights w+ = |a-| / (|a-| + a+), w- = a+ / (|a-| + a+) (D-infinity rule on the up to 8 surrounding blocks, C §6.2). Stored twice: as donor lists of the cell graph, and for the cascade as a donor mask with weights quantised so that the two weights of a donor sum to exactly 255. Each donor also stores which of its two receivers takes the whole flow in the RIVULET regime: receiver A with probability equal to its weight, decided by `hashU32(levelSeed, item, lane)` where the lane is the coarse block containing the donor.
4. Terminal blocks classified as basin pits (facing up), drip sites (facing sideways or down, and free ends) or flat regions.
5. Basins: on REV patches analytically (the height H(s, th) = u_h r(s) cos(th - th_u) + u_z z(s) gives the submerged theta interval per row and V(level) by one-dimensional quadrature, A §6.8); on other patches by priority flood on the block graph (CPU, WASM). Each basin has a spill block and a 64-point volume-level table.
6. Gap field: one ray along the outward normal per block, reach 10 mm; the distance is stored log-coded.
7. Contact links, gutters and drip sites for the pose (section 3.6, module M7).
8. Catchment area A_up per block (one steady accumulation pass), used by the thermal, supply and renewal models.
9. Regime group of every block: its coarse parent (the 4 mm block that contains it; at the fast tier the block itself). Smoothing group: blocks of the same part and side tag whose normals lie within 30 degrees.
10. Coverage rank of every soil cell: u = frac( hash01(levelSeed, item, lane) + c / w ), with c the cell's coordinate across the flow direction g_t inside its regime group and w the group width. It is constant along flow lines, depends on the pose, and is recomputed with the links at every epoch. It lives in `SoilStatic`, not in the soil state.

Wetting parameters are not part of this analysis: they depend on the liquor class and on the soil cover, and M7 builds them at every exposure from the material table, the frozen contact-angle offset field and the soil model's wetting summary.

`BlockStatic`, 96 bytes per block:

| Offset | Field | Type |
|---|---|---|
| 0 | world centre; area (m2) | vec3 f32; f32 |
| 16 | normal (octahedral); direction of g_t in the tangent frame; sin(beta) | 2 x i16; i16; f16 |
| 24 | G_n; width across the flow; two principal curvatures | 4 x f16 |
| 32 | donor[8] (blocks that drain into this one; 0xFFFFFFFF = none) | 8 x u32 |
| 64 | donorWeight[8] | 8 x u16 / 65535 |
| 80 | twin block on the opposite face of the wall | u32 |
| 84 | first film cell | u32 |
| 88 | first soil cell (0xFFFFFFFF = unsoiled) | u32 |
| 92 | gap (log code); material; feature (smooth, edge row, pit, drip site, wire, contact, pole, dead); smoothing group | 4 x u8 |

`BlockAux`, 16 bytes: patch id and row (u32); catchment area A_up (f32); basin id (u16) and gutter element (u16); film class and sub-cell count (u8), region index (u8), gap reservoir id (u16). `SoilStatic`, 8 bytes per soil cell: parent block (u32); coverage rank (u8 / 255); region index (u8); spare (u16).

### 3.8 Counts and memory

Typical load: 13 IEC place settings as reconstructed in standards §5.1, instantiated from the catalogue (`areas.ts`): 138 catalogue items with 4.84 m2 of surface counting both faces, plus the two steel pots that the catalogue does not yet hold (0.22 m2 [ESTIMATED]); 5.1 m2 in all, which agrees with standards §10.5 (5 to 6 m2). Design load: 8.5 m2 (the brief's upper figure), with 0.5 m2 of rivulet-prone plastics. Area split of the typical load by film class: flat ware of continuous-film materials 43 % (K2), hollow ware of those materials 30 % and partially wetting items (melamine, steel pots) 17 % (S2), cutlery 9 % (K2); by primitive: unscaled shells of revolution 87 %, stretched shells 6 %, hulls and degenerate boxes 7 %. 35 to 50 % of each class is soiled [SYN].

| Quantity | Typical | Design |
|---|---|---|
| Ray primitives (frusta, capsules, polygons) | 19 k | 28 k |
| Blocks (items at 2 mm; tub, basket, arms, wires: 0.20 M) | 1.47 M | 2.33 M |
| S film cells at 2 mm / at 1 mm (class D only) | 0.60 M / 0 | 0.95 M / 0.50 M |
| K blocks in periodic solves | 0.86 M | 1.25 M |
| Film cells, class D | 1.47 M | 2.70 M |
| Soil cells (1 mm) | 2.00 M | 3.36 M |

GPU memory, design load (`budget3b.py`). Stage-scoped buffers are released at stage boundaries (C §3.4).

| Buffer | Bytes per element | Size (MB) |
|---|---|---|
| Primitives, trees, patch and row tables | | 30 |
| BlockStatic + BlockAux | 112 per block | 260 |
| KParams (one liquor class) | 32 per block | 74 |
| KHot, two copies (all blocks, for the drain-down) | 32 per block | 74 |
| SFilm x 2, SStatic, SSlow | 48 per S cell | 70 |
| Deposit accumulators, current and next | 40 per S cell, 16 per K block | 78 |
| Film statistics (recorded revolutions) | 80 per film cell | 216 |
| Monte Carlo accumulator (stage F only) | 288 per block | 670 |
| Deposition table, packed, one per active arm | 144 per block | 335 each |
| Jet-wet table, one per active arm | 8 per block | 19 each |
| Parcels (time-coupled), 2 M slots | 48 | 96 |
| Footprint records, one diverter state | 96 per (sub-jet, phase) | 69 |
| Emitter entries, one diverter state | 16 per entry | 100 |
| FilmExposure, one record | 32 per film cell | 86 |
| DrainDown, one record | 8 per block | 19 |
| JetExposure, one record set (tiles near tracks, 20 % of soil cells) | 56 per soil cell | 38 |
| SoilCell + SoilStatic (stage H) | 144 per soil cell | 483 |
| TimelineBlock (stage H) | 64 per block | 149 |
| EffectiveExposure (stage H) | 40 per film cell | 108 |
| Tile lists, monitors, link tables, staging | | 150 |

Peaks: Monte Carlo stage 1.3 GB; film stage 2.1 GB (two deposition tables, two FilmExposure records being written, statistics); replay stage 1.7 GB (soil, timeline, effective exposure, four FilmExposure records, two DrainDown records and four JetExposure sets resident). The design range of the spike report is 2 to 3 GB with 4 GB as the ceiling; the largest single binding is 670 MB against the 4 GiB limit.

**Eviction.** The replay state (1.3 GB with its resident records) is run-scoped. When the timeline triggers an exposure in mid-programme, that state is read back to the checkpoint staging file before stage C starts and uploaded again after stage G (1.3 GB at the measured 7 to 10 GB/s: 0.3 s). Left resident, the film stage would peak at 3.4 GB.

**CPU memory.** Exposure records, deposition tables and footprint and emitter sets that are not resident on the GPU live in the cache files and are memory-mapped, not copied to the heap (4.8 GB of files for the design load; the page cache may drop them). Heap budget: 1.5 GB (scene mirrors for the output 0.3 GB, one footprint and emitter set 0.2 GB, one staging buffer of 0.7 GB reused for read-backs and checkpoints, everything else 0.3 GB). The spike found 5.5 GB available on the target machine with other work running.

---

## 4. Modules

Thirteen modules. Each has typed inputs and outputs, a CPU f64 reference implementation in M13 that defines its behaviour, and unit tests with tolerances. Modules exchange only the records defined here, so they can be built in parallel against fixtures (section 9).

| Id | Package | Responsibility | Runs on | Depends on |
|---|---|---|---|---|
| M1 | `@spotless/sim-gpu` | device wrapper, buffers, kernel registry, fixed point, integer reductions, probes, checkpoints, provenance | CPU + GPU | core |
| M2 | `@spotless/sim-params` | parameter registry, tiers, closure tables, shared closure functions | CPU | core |
| M3 | `@spotless/sim-scene` | atlas, primitives, ray queries, cell graph, placement analysis | CPU + GPU | geometry, machine, M1, M2 |
| M4 | `@spotless/sim-hydraulics` | operating points, arms, diverter, inventory, programme controller | CPU | machine, M2 |
| M5 | `@spotless/sim-jets` | primary trace, footprints, impingement closures, gather, emitters, item loads and live wrenches | GPU + CPU | M2, M3, M4 |
| M6 | `@spotless/sim-spray` | droplet parcels: Monte Carlo tables and time-coupled parcels | GPU | M3, M5 |
| M7 | `@spotless/sim-film` | R0, K, S, LINE, reservoirs, wetting parameters, exposure writer | GPU | M3, M5, M6 |
| M8 | `@spotless/sim-soil` | soil state, ageing transform, soil kernel | GPU | M3, M2 |
| M9 | `@spotless/sim-liquor` | liquor chemistry, rate tables, machine thermal nodes, drying air | CPU | M2 |
| M10 | `@spotless/sim-timeline` | replay loop, slow-state layer, element temperatures, pools and local stores, deposits, drying | CPU + GPU | M4, M7, M8, M9 |
| M11 | `@spotless/sim-rigid` | wash-time coupling to `@spotless/physics` | CPU | physics, M3, M5 |
| M12 | `@spotless/sim-core` | orchestration, tiers, reserves, cache, checkpoints, result | CPU | all |
| M13 | `@spotless/sim-verify` | reference implementations, conservation audits, phenomena harness | CPU | all |

The f64 closure functions that both a kernel and a CPU caller need (impingement closures and the momentum-theorem wrench of M5, wetting thresholds of M7, rate functions of M8) live in M2 and M5, not in M13: M13 tests them but nothing depends on M13.

**Shared fixed-point units** (M1). Water mass 10^-12 kg in u32 and i32 words: one unit is 0.25 nm of film on a 4 mm2 block; a u32 holds 4.3 g, an i32 accumulator +/- 2.1 g per base step. Water momentum 10^-12 kg m/s in i32 accumulators that are cleared every base step (range 2.1 x 10^-3 kg m/s; a 0.34 g drip at 3 m/s spread over its deposit radius uses under 5 % of it per cell). Removed soil mass 10^-15 kg in u32 per soil cell and tick, summed in 64 bits. Heat 10^-7 J in i32 per block and tick. Every integer field is registered with its unit and the largest value the plan can produce; M1 asserts the bound at plan time and counts saturations at run time (section 8.2).

**Ledger boundaries.** Integer and exact: everything that moves between modules or between patches (emitters, parcels, Monte Carlo tables, stitch and contact transfers, lines, pools, sump), the whole cascade, and removed soil. Float, asserted to tolerance only (rule 19): the film mass inside an S patch between its integer inflows and outflows, soil layer state, temperatures.

### M1. GPU foundation (`@spotless/sim-gpu`)

**Responsibility.** Everything between the simulation modules and WebGPU, so that the rules of section 6 are enforced in one place.

```ts
interface StackString { sim: string; gpu: string; os: string; webgpu: string; runtime: string; physics: string }
interface FieldDef { name: string; type: 'f32' | 'u32' | 'i32' | 'f16' | 'u16' | 'u8' | 'log8'; role: 'state' | 'accumulator' | 'counter' | 'statistic' | 'static';
                     unit: string; bound?: number /* required for integer accumulators and counters */ }
interface KernelDef { name: string; wgsl: string; entry: string; bindings: BindingDef[]; uses: OpClass[];
                      reads: string[]; writes: string[]; atomics: string[] /* buffer names; checked against the batch order */ }
type OpClass = 'addmul' | 'div' | 'sqrt' | 'explog' | 'pow' | 'cbrt' | 'trig' | 'atan2' | 'ftoi' | 'fma' | 'atomics' | 'f16' | 'bitcast';
interface GpuContext {
  readonly stack: StackString;
  buffer(d: { name: string; owner: string; stage: StageId | 'run'; bytes: number; usage: GPUBufferUsageFlags; fields: FieldDef[] }): ManagedBuffer;
  kernel(def: KernelDef): Kernel;                                    // pipeline cached by source hash; binding count checked
  submit(batch: DispatchBatch): void;                                // splits into command buffers of 50 to 250 ms planned time
  drain(): Promise<void>;                                            // awaits onSubmittedWorkDone
  read(b: ManagedBuffer, byteOffset: number, byteLength: number): Promise<ArrayBuffer>;
  reduceI64(src: ManagedBuffer, strideBytes: number, fields: number): Promise<BigInt64Array>;                      // whole-buffer sums
  reduceI64By(src: ManagedBuffer, strideBytes: number, fields: number, key: ManagedBuffer /* u32 segment id per element */, segments: number): Promise<BigInt64Array>;   // [segment][field]
  swapAccumulators(pair: AccumulatorPair): void;                     // exchanges current and next; the new next is cleared by clearBuffer
  evict(stage: 'run', to: string): Promise<void>;  readmit(from: string): Promise<void>;   // run-scoped buffers to and from the staging file
  releaseStage(stage: StageId): void;
  checkpoint(tag: string): Promise<void>;  restore(tag: string): Promise<void>;
  nonFiniteCount(): Promise<number>;  saturationCount(): Promise<number>;
}
```

`ManagedBuffer` is a `GPUBuffer` with its registered fields, owner and stage; `Kernel` a compiled pipeline with its `KernelDef`; `DispatchBatch` an ordered list of (kernel, bind groups, dispatch size or element list); `AccumulatorPair` the current and next buffer of one deposit accumulator; `StageId` a stage letter of section 2.1.

**Rules implemented here.**

- Limits are requested from the adapter. Every binding is asserted to be smaller than 2^32 - 4 bytes. `kernel()` rejects a kernel with more than 8 storage buffers (the device limit is 10; 8 is the default in browsers, where the fast and preview tiers must run) or more than 3 bind groups. Static tables of one patch are merged into one buffer to stay under it. The object returned by `create()` is kept alive. Bindings: `webgpu` 0.6.2 in Node 20; headless Chrome is the fallback with its own stack string.
- **Integer block reduction.** `reduceI64` and `reduceI64By` sum i32 or u32 fields in passes of fan-in 64, carrying 64-bit sums as two u32 with explicit carry. The segmented form sorts nothing: elements are stored grouped by segment (soil cells by item and reservoir, parcels by fate), a CPU-built offset table gives each segment's range, and each range is reduced by the same tree. Keyed sums (removed soil by item, class and reservoir; per-item wet-duty changes; split-half masses) use it.
- **Atomics.** `atomicAdd` and `atomicMax` on i32 or u32 are allowed where few invocations write one target (deposits: at most 49 targets per parcel and a handful of writers per target). Targets with many writers do not exist: per-item maxima are per-tile maxima written by one invocation per tile and reduced on the CPU; parcel fates are written to the parcel's own slot and reduced by `reduceI64By`. MS0 benchmark 7 measures contended atomics so that this rule can be relaxed, not so that it can be assumed.
- **Accumulator discipline.** Deposit accumulators are double-buffered. Within a base step every writer that must be seen in this step adds to `current` before its reader runs, and every writer whose output belongs to the next step (stitch and contact transfers, pool overflow, line outflow) adds to `next`. No dispatch both reads and atomically writes one buffer. The registry derives this from `reads`, `writes` and `atomics` and rejects a batch that violates it.
- **Narrow fields.** `buffer()` rejects a read-modify-write of an f16, u8, u16 or log8 field unless its role is `statistic` (maxima, snapshots and packed outputs) or `counter` with a registered bound that the plan cannot exceed. Every `state` and `accumulator` field is f32, u32 or i32.
- **Non-finite guard.** WGSL allows an implementation to assume that NaN and infinity do not occur, so a guard written with float comparisons or `clamp` may be compiled away. The guard is therefore an integer test: the monitor pass of each solver reads the float state it covers as `u32` (`bitcast`) and counts words whose exponent bits are all ones; kernels also clamp their outputs to declared physical ranges and count clamps. A non-zero non-finite count at a stage boundary fails the run as an infrastructure failure (benchmark §4.6). An MS0 probe plants a NaN and checks that the count sees it on the reference stack.
- **Closure tables** are stored as f32 textures and read with `textureLoad` and explicit multilinear interpolation written in the kernel; hardware filtering is not used.
- **Device loss.** On `device.lost` or an uncaptured error the context rebuilds the device, restores the last checkpoint and continues. A resumed run must produce the same report hash as an uninterrupted one (test `resume-hash`).
- **Determinism probes.** One small kernel per `OpClass`, with its result hash recorded per stack string in `probes/<stack>.json`. `KernelDef.uses` lists every class a kernel relies on, so a changed probe names the kernels whose bits may have moved (lead's note of 19:50).

**Tests.** The B1 stencil of the spike reproduces hash `ba69c15a8d62ffc6` [MEASURED]; binding assertion fires at 4 GiB and at the ninth storage buffer; shuffle, workgroup-size and batching invariance helpers used by every other module's tests; `resume-hash`; the segmented reduction against a CPU sum on 10^7 random u32 in 10^4 segments, exact; one accumulation test per registered accumulator or counter field: 3,430 equal increments (the tick count of the sizing programme) and 10^5 increments of one unit sum exactly, or within 0.1 % for f32 state; the batch checker rejects a kernel that reads and atomically writes one buffer.

### M2. Parameters and closure tables (`@spotless/sim-params`)

```ts
interface ParamDef { key: string; unit: string; default: number; min: number; max: number;
                     tag: 'VERIFIED' | 'RECALLED' | 'ESTIMATED' | 'SYN' | 'MEASURED'; source: string; validity?: string;
                     group: 'hydro' | 'soil'; bracket?: 'G1' | 'G2' | 'G3' | 'G4' | 'S' }
interface ParamSet { get(key: string): number; readonly hydroHash: string; readonly soilHash: string }   // hashes of the canonical JSON of each group
interface ClosureTable { id: string; axes: { name: string; unit: string; values: Float64Array }[]; data: Float64Array; unit: string; provenance: string }
interface TierParams { id: 'official' | 'fast' | 'preview' | 'reference'; variant: 'S-split' | 'S-all' | 'S-mainwash' | 'K-only'; /* every count of section 7.5 */ }
```

The registry is the only place a physical constant may be defined. The tables in the module sections below are its content. Group `hydro` holds the keys read by stages A to G (`scene.*`, `hyd.*`, `jets.*`, `spray.*`, `film.*`, contact angles); group `soil` holds `soil.*`, `liq.*`, `tl.*`, `dry.*`. An exposure set is keyed by the hydro hash only, so changing a soil parameter reuses cached exposure (M12). A parameter's `validity` states the range in which its source verified it (for example "incidence 30 to 120 degrees, Re up to 32,000"). Per-class soil tables (`soil.<class>.*`) override the global defaults of the same name.

`ClosureTable`s are regular grids evaluated by clamped multilinear interpolation, on the CPU in f64 and in kernels as described in M1; they are the plug-in point for the offline closure campaign (section 11.2). Table ids with analytic defaults: `wire.split`, `rim.split`, `sweep.correction`, `vessel.interior`, `splatter.fraction`, `splash.massRatio`, `slot.footprint`.

**Shared closure functions** (f64 TypeScript with a WGSL twin generated from the same expression tree, so that M5, M7, M10 and M11 cannot drift apart): liquid properties of water against temperature; the wetting thresholds below; the edge-separation rule of M7.5; the impingement closures and the fan wrench of M5.

**One wetting threshold.** Used by K, by S and by the onset gate of M10:

```
delta*_a  = [ 15 mu^2 sigma (1 - cos(theta_a)) / (rho^3 g_e^2) ]^(1/5),   g_e = g max(sin(beta), 0.1)^n_beta         Hartley-Murgatroyd [VERIFIED]
delta_wet = kappa_w delta*_a                                              thickness at which spray-collected liquid forms a film
b_max     = C_b l_c ( cos(theta_r) - cos(theta_a) ) / max(sin(beta), 0.1)  largest immobile bead load (equivalent thickness)
m_on      = rho min( delta_wet, b_max )                                    onset mass per area: the smaller of the two routes to a film
```

`film.nBeta` = 0 by default: the only data (acrylic, water at 43 C, films §12.10) put the rivulet-to-film transition at the same loading at 5 and at 90 degrees, so the tilt-scaled form of films §12.4 (n_beta = 1) is the alternative, not the default. With n_beta = 1 the threshold is 1.3 times larger at 30 degrees and 2.5 times larger below 6 degrees.

### M3. Scene (`@spotless/sim-scene`)

**Responsibility.** Section 3 in full: atlas, ray primitives and trees, hit-to-element map, cell graph, placement analysis, soil-region masks, seeded surface fields.

```ts
type FilmClass = 'S1' | 'S2' | 'K2' | 'LINE';                           // section 3.4
interface WashItem { itemId: string; typeId: string; shape: Shape; pose: Pose /* canonical rounded pose, tub frame */;
                     soils: readonly ItemSoilRecord[]; mass: MassProperties; filmClassOverride?: FilmClass }
interface Scene {
  readonly epoch: number;
  readonly patches: readonly PatchDesc[];
  readonly counts: { blocks: number; filmCells: { blockGrid: number; classD: number }; soilCells: number; lines: number };
  readonly gpu: { instances: GPUBuffer; nodes: GPUBuffer; prims: GPUBuffer; patchRows: GPUBuffer; blockStatic: GPUBuffer; blockAux: GPUBuffer;
                  blockFilm: GPUBuffer; soilStatic: GPUBuffer; links: GPUBuffer /* stitch and contact links */ };
  readonly basins: readonly Basin[];  readonly gaps: readonly GapReservoir[];  readonly contacts: readonly ContactLink[];  readonly lines: LineGraph;
  readonly itemBlocks: ReadonlyMap<string, readonly [first: number, count: number]>;
  readonly rays: RayQuery;
}
interface PatchDesc { id: number; item: number; part: string; kind: 'rev' | 'revStretched' | 'cart' | 'line'; material: string; filmClass: FilmClass;
                      rowOffset: number; rowCount: number; blockOffset: number; filmOffset: number; soilOffset: number; regionOfRow: Uint8Array }
interface Basin { id: number; item: number; spillBlock: number; levelTable: Float32Array /* 64 x (level m, volume m3) */; blocks: Uint32Array;
                  heightOfBlock: Float32Array /* m above the lowest point, for the depth of water over a block */; lumped: boolean }
interface GapReservoir { id: number; blocks: Uint32Array; volume_m3: number; items: readonly [number, number] }
interface ContactLink { blockA: number; blockB: number; gap_m: number; kind: 'itemItem' | 'itemWire' | 'gapMinimum'; bridge: number /* reservoir id */ }
interface LineGraph { elements: number; gpu: GPUBuffer /* LineElement[] */; junctions: Uint32Array; dripSites: Uint32Array; ofBlock: Uint32Array }
interface SceneBuilder { build(items: readonly WashItem[], machine: MachineGeometry, tier: TierParams, levelSeed: number): Promise<Scene>;
                         move(scene: Scene, poses: ReadonlyMap<string, Pose>, contacts: readonly Contact[]): Promise<Scene> }
```

`build` and `move` are asynchronous because the gap rays, basin tables and catchment pass run on the GPU and are read back.

**Seeded surface fields** (A §6.3, §8.2; seeds per benchmark §4.3). Two procedural fields are functions of surface coordinates, not of grid indices, so every tier samples the same realisation: the contact-angle offset (normal, standard deviation `film.thetaSigma` = 8 degrees, correlation length 2 mm; films §12.4) and the soil loading multiplier (log-normal, coefficient of variation `soil.loadCv` = 0.3; soils R3). Both are value noise hashed with `hashU32(levelSeed, itemHash, field, ix, iy)` from `@spotless/core`. They belong to the level, not to the wash seed. Lanes and coverage ranks are keyed by the coarse block, which is the same element in every tier.

**Parameters** (geometric constants of the tier, all [SYN] unless noted): `scene.block` 2 mm and `scene.coarseBlock` 4 mm; `scene.deadDepth` 0.2 mm; `scene.stitchReach` 0.75 blocks; `scene.seamWidth` 2 blocks; `scene.cutMerge` 0.25; `scene.zoneAngle` 2 degrees, `scene.foldLength` 6 mm, `scene.foldTurn` 15 degrees (A §3.2); `scene.lineElement` 3 mm; `scene.gapReach` 10 mm and `scene.contactGap` 0.5 mm (C §3.6); `scene.basinLevels` 64; `scene.armDripDelay` 0.2 s.

**Tests.**

| Test | Target | Tolerance |
|---|---|---|
| Area of every catalogue item from its blocks | Pappus integral of the profile; closed forms for disc, cone, cylinder; `surfaceArea` of the geometry kernel for polytopes | 10^-4 |
| Asset lint on every catalogue item (section 3.1) | block counts, smallest block, regions covered | as stated |
| Block counts of fork, knife and spoon | within 1.5 x area / D_B^2 (about 1,900 to 2,800 blocks each) | exact bound |
| Hit-to-element map, 10^6 random surface points per patch kind, including seams and merged cut cells | mapped block contains the point, or is the block the point was merged into | every point |
| GPU tracer against the f64 reference, 10^8 rays, all primitive types | same primitive; distance of the hit point from the analytic surface at most 0.2 um; along-ray error at most 2 um / cos(incidence). Rays with cos(incidence) below 0.02 are counted and exempt from the hit-or-miss comparison (in f32 a ray 1.5 um inside tangency on a 1.5 mm wire disagrees with f64 in 10 % of cases) | exempt share below 10^-4 of rays |
| Rays started inside every closed shell of the catalogue | no escape | exact |
| Round trip hit -> (s, theta) -> x(s, theta) | position | 0.05 soil cell |
| Nesting | every official block is a child of exactly one coarse block; restriction of an official field to the coarse grid conserves area-weighted sums | exact; 10^-6 |
| Closure of face normals on every REV cell of the catalogue | sum of face normals times face lengths in the cell frame | 10^-6 of the perimeter |
| D-infinity links on a plane at arbitrary orientation | centroid of a routed point source follows g_t | 0.5 degree |
| Basin of a mug base recess (R = 25 mm, 3 mm deep) | 5.9 mL level; 1.21, 0.40, 0.13 mL at 7, 15, 30 degrees by exact integration of the circular segment (the closed form of standards P37, 1.4 and 0.42 mL, is a small-wedge approximation that is 11 % and 5 % high at 7 and 15 degrees) | 3 % |
| Pose jitter of +/- 2 mm, +/- 2 degrees | basin volumes, gutter fractions and link weights change continuously (no jump larger than the jitter explains) | see section 8.4 |

**Cost.** Stage A: 25 s fixed plus 8 s per million blocks and 2 s per million soil cells [SYN]; a `move` touches only the moved items and their neighbours.

### M4. Hydraulics and programme (`@spotless/sim-hydraulics`)

**Responsibility.** The lumped machine model of machine §12.2: operating point per combo, arm speeds and stall, diverter, water inventory and loss of prime, heater and programme controller. CPU, f64, negligible cost.

```ts
type ArmState = { kind: 'free' } | { kind: 'stalled'; angleQ: number /* 1/256 revolution */ } | { kind: 'knocking'; profile: string /* hash of the phase-time table */ };
interface ComboId { diverter: string; pumpClass: number; liquor: 'W' | 'D' | 'R'; arms: readonly ArmState[] /* one per arm fed in this diverter state */ }
interface LiquorProps { cls: 'W' | 'D' | 'R'; T_K: number; rho: number; mu: number; sigma: number; gammaW: number }
interface ArmMotion { arm: number; state: ArmState; omega_rad_s: number /* mean; 0 when stalled */; period_s: number;
                      phase0: number /* u32, from simSeed */;
                      phaseAt(baseStep: number): number;          // u32 phase at the start of a base step; pure integer arithmetic for a free arm,
                                                                 // inverse of the 256-knot phase-time table for a knocking arm, constant for a stalled arm
                      dwellAt(phaseIndex: number): number }       // seconds the arm spends in one of the 16,384 phase steps
interface HydraulicPoint {
  combo: ComboId; pumpRpm: number /* class centre */; fH: 1;
  arms: readonly ArmMotion[];
  nozzles: readonly { arm: number; nozzle: number; subJet: number; posArm: Vec3; dirArm: Vec3; Q_m3_s: number; Vrel_m_s: number; d_m: number;
                      slot?: { subJets: number; fanAngle_rad: number; length_m: number; width_m: number } }[];
  masterArm: number | null; masterPeriod_s: number; stepsPerRev: number; dt0_s: number;
}
interface MachineTick { index: number; combo: ComboId | null; label: 'transient' | 'steady' | 'off' | 'drying'; dt_s: number;
                        pumpRpm: number; sV: number; sQ: number; fH: number; heaterOn: boolean; step: string; events: readonly PhaseEvent[] }
interface ControllerFeedback { liquorT_K: number; liquorClass: 'W' | 'D' | 'R'; V_air: number; V_film: number; V_trap: number; V_filter: number; V_absorbed: number;
                               arms: readonly ArmState[]; lastTickPeriod_s: number }
interface ProgrammeController { next(feedback: ControllerFeedback): MachineTick | null }      // null at the end of the programme
interface MachineModel {
  point(combo: ComboId): HydraulicPoint;                                                     // at the class centre speed and full prime
  controller(programme: ProgrammeSpec): ProgrammeController;
  registerArmProfile(arm: number, phaseTime: Float32Array /* 256 knots from M11 */): string;    // returns the profile hash used in ArmState; point() looks the table up
  thermalPrePass(programme: ProgrammeSpec, loadHeatCapacity_J_K: number): { solveT_K: Record<'W' | 'D' | 'R', number>; trace: Float64Array };
  inventory(s: { V_air: number; V_film: number; V_trap: number; V_filter: number; V_absorbed: number }): { V_sump: number; alpha: number; fH: number } }
```

The controller is a state machine driven by feedback, not a precomputed list: the liquor class comes from the liquor model, the heater from the liquor temperature, f_H and the scale factors from the inventory, the tick length and the arm states from the timeline and the rigid coupler. Exposure records are always computed at the class-centre pump speed with full prime (f_H = 1); loss of prime and off-centre speeds enter per tick through s_V and s_Q.

**Equations.**

```
pump       H(Q, N) = H_0 (N / N_0)^2 f_H - b Q^2,            p_pump = rho g H
branch j   p_pump = rho g z_j + K_j Q_j^2 + p_arm,j,          Q_j = (C_d A)_j sqrt(2 p_arm,j / rho)
           solve sum_j Q_j(p) = Q_pump(p) for p by bisection (60 iterations)
nozzle i   Q_i = C_d,i A_i sqrt(2 p_arm / rho),  V_rel,i = C_v sqrt(2 p_arm / rho),  d_i = d_n,i sqrt(C_d,i / C_v)
arm        I dw/dt = sum_i mdot_i r_i (V_rel,i t_i - w r_i) - (k_f |F_ax| + c_v w) sgn(w) - T_contact
           t_i = cos(rho_i) sin(theta_i),  F_ax = p_arm A_hub + s (F_jz + W),  F_jz = sum_i mdot_i V_rel,i sin(rho_i)
           steady, free:  w = ( sum_i mdot_i V_rel,i r_i t_i - k_f |F_ax| ) / ( sum_i mdot_i r_i^2 + c_v ),  clipped at 0
inventory  V_sump = V_total - V_pipes(open branches) - V_air - V_film - V_trap - V_filter - V_absorbed
           alpha = clamp(1 - V_sump / V_min, 0, 0.6),   f_H = max(1 - 2.5 alpha, 0)
```

V_air (parcels in flight) and V_film (films, beads, gutters, wires) are the measured means of the active exposure set, not the machine dossier's placeholders; V_trap is the current pool volume (C §4.5).

**Slot nozzles.** A slot is represented by N_sub round sub-jets spread uniformly over its fan angle, each with flow Q / N_sub, the nozzle's jet speed and diameter d_sub = sqrt(4 Q / (pi N_sub V)) (jets §2.5, the dossier's implementation shortcut, [ESTIMATED]). Because every impingement closure uses the sub-jet diameter, N_sub is a physical parameter of the nozzle model, not a sampling count: it is part of the nozzle table (default 7 for the 1.8 x 5.0 mm slots of SPOT-60, range 5 to 9, in the calibration list) and is the same in every tier. Two quantities that would otherwise be artefacts of N_sub are taken from the sheet the slot really issues (M5): the coherent fraction in flight and the drop size after break-up. Slot nozzles carry about 40 % of the flow of the baseline lower and middle arms, so the tier gate and the phase-count test each include a slot case, and campaign C6 (section 11.2) replaces the bundle's impingement closures by a table.

**Time base of a combo.** The master arm is the slowest rotating arm of the diverter state. stepsPerRev = 64 x ceil(T_master / (64 x 2 ms)) and dt0 = T_master / stepsPerRev (896 steps and 1.913 ms at 35 rpm; 1,024 and 1.953 ms at 30 rpm; `checks.py`). If no fed arm rotates (all stalled) the period is the nominal `hyd.nominalPeriod` = 2.0 s, masterArm is null and stepsPerRev = 1,024. There are 64 phase bins per revolution of each arm, counted in that arm's own phase. Every arm keeps its own u32 phase: a free arm advances by round(2^32 dt0 / T_arm) per base step; a knocking arm follows its phase-time table (256 knots over its own period, from the transient torque balance of M11); a stalled arm has a constant phase. `ArmMotion.phaseAt` is evaluated on the CPU for every base step of a command buffer and passed to kernels in a small per-step table, so no kernel assumes a constant increment. No arm speed is altered to make the forcing periodic (C §4.4 is rejected, J-phys and J-num); statistics are averaged over the recorded revolutions instead. Tables that depend on arm position (emitter entries, level schedules, jet-wet masks, Monte Carlo bins) are indexed by the phase of the arm they belong to and combined per base step; nothing is indexed by the master revolution except the film statistics.

**Arm states and combos.** The arm state is part of `ComboId` and of every cache key. A stalled arm (zero speed sustained for 1 s, M11) and a knocking arm are different combos from the free one and get their own exposure sets under the reserve policy of section 7.3: they arise from contact with the load, so they appear at the shake-down or with a geometry epoch.

**Pump classes and similarity.** Pump speeds within +/- 4 % of a class centre share one exposure set, computed at the centre and rescaled per tick with s_V = (N / N_class) sqrt(f_H) (C §4.3, narrowed from +/- 8 % after J-del's splatter objection): V and Q proportional to s_V; stagnation pressure and M to s_V^2; boundary-layer shear to s_V^(3/2); R_j to s_V^(3/4); dwell to 1/w(N); film loading and deposition to s_V; film thickness and gravity-film shear to s_V^(1/3). Known error: the splatter source changes by up to 17 % across a class half-width (splatter law of M5); the reference tier uses a class width of zero. Loss of prime uses the same rescaling down to f_H = 0.85; below that the affected ticks are flagged.

**Solve temperature per liquor class.** Before stage C the thermal pre-pass integrates the programme once with the lumped liquor and tub nodes of M9 and the load as one heat capacity (CPU, milliseconds). It yields T_solve per liquor class: for class D the main-wash hold target (55 C in the sizing programme), because that is where the class spends most of its time and where removal happens; for classes W and R the time-weighted mean liquor temperature over the ticks of that class, rounded to 1 K. `LiquorProps` of an exposure are built from the class and T_solve alone, so they do not depend on when the timeline first needs the set. The film record of class D is therefore that of 55 C liquor, replayed through the heat-up with the viscosity rescale and the drift monitor of M10.

**Diverter.** States and dwell pattern are machine data. The 1.5 s transition is an instantaneous switch (2.5 % of the time at 60 s dwells). A state that occupies less than 120 s of a programme (state A: 20 s after each fill and the last 30 s of the final rinse in SPOT-60) is not time-marched: its jet records and deposition tables are those of its constituent states rescaled to its operating point, and its film record is the steady solve R0 with the pulsatility closure of M7.2 (C §7.1). Otherwise it is an ordinary combo.

**The sizing programme** (a fixed course of 145 minutes; durations, speeds and patterns [ESTIMATED] from machine §7.3; all are programme data):

| Step | Action | Water in (L) | Target (C) | Pump (rpm), diverter | Liquor class | Minutes |
|---|---|---|---|---|---|---|
| P1 | fill, cold pre-rinse, drain | 3.4 | none | 2600, L/U 60/60 | W | 11 |
| P2 | fill, dispenser opens 60 s after circulation starts, heat-up | 3.6 | 55 | 3000, L/U 60/60 | W until the dissolved surfactant reaches `liq.surfClass`, about 2 minutes, then D | 24 |
| P3 | main-wash hold with reheating | | 55 | 3000, L/U 60/60 | D | 30 |
| P4 | drain, fill, intermediate rinse, drain | 3.0 | none | 2600, L/U 45/45 | W (see below) | 10 |
| P5 | fill, final-rinse heat-up, rinse aid at 40 C, hold 3 min, drain | 3.0 | 62 | 2800, L/U 60/60 | W before the rinse-aid dose, then R | 23 |
| P6 | drying, door closed, side-wall heat exchanger | | | | | 47 |

Pump classes: {2600, 2800} with centre 2700 rpm, and {3000}. Combos that are time-marched with free arms: (L, 2700, W), (U, 2700, W), (L, 3000, D), (U, 3000, D), (L, 2700, R), (U, 2700, R). The first two minutes of P2 and the intermediate rinse P4 use the W sets rescaled to their pump speed (for P2 that is 11 %, outside the class half-width, while the soils are still in their lag); the intermediate rinse (sigma about 55 mN/m against 60 for W, films §12.8) is thereby treated as water-like. Both approximations are listed in section 11. Ticks: about 2,880 circulating, 270 with the pump off, 280 in drying; 3,430 in all [SYN].

**Parameters.**

| Key | Default | Range | Tag | Source |
|---|---|---|---|---|
| `hyd.H0`, `hyd.b`, `hyd.N0` | 5.5 m; 4.80 x 10^6 m/(m3/s)^2; 3000 rpm | | [ESTIMATED]; N0 [VERIFIED] | machine §4.2 |
| `hyd.z`, `hyd.K` per branch | 0.15, 0.52, 0.80 m; 2.0 x 10^10, 5.6 x 10^10, 1.07 x 10^12 Pa s2/m6 | | [ESTIMATED] | machine §4.3 |
| nozzle tables (position, angles, size, C_d; N_sub and fan angle for slots) | SPOT-60 tables; N_sub 7; fan angle 40 degrees | C_d 0.6 to 0.9; N_sub 5 to 9 | L1 to L10 geometry [VERIFIED], rest [ESTIMATED] | machine §3.2; jets §2.5 |
| `hyd.Cv` | 0.97 | 0.92 to 1.0 | [RECALLED] | jets §11.3 (machine §3.3 uses 1.0; conflict 1 in the appendix) |
| `hyd.kf` lower, mid, top | 8.6, 3.6, 4.4 mm | 3 to 12 mm | [SYN] | re-tuned for C_v = 0.97 so that the arms turn at 35, 30 and 60 rpm at 3000 rpm (`arms.py`); with the dossier's 9.3 and 3.8 mm they would turn at 32.4 and 27.8 rpm |
| `hyd.cv` | 0.002, 0.002, 0.0005 N m s | | [ESTIMATED] | machine §3.3 |
| `hyd.Vmin` | 0.5 L | 0.3 to 0.8 | [ESTIMATED] | machine §4.5 |
| `hyd.classHalfWidth` | 0.04 | 0 to 0.08 | [SYN] | this section |
| `hyd.nominalPeriod` | 2.0 s | | [SYN] | this section |
| `hyd.stallTorque` (derived) | about 0.07 N m lower arm | | [ESTIMATED] | machine §3.3 |

**Tests.** Lower arm alone at 3000 rpm: 41.6 kPa at the pump, 30.7 L/min, 34.9 kPa in the arm, jet speed 8.11 m/s (0.97 x 8.36), 0.5 %; operating-point table of machine §4.3 for flows and pressures, 1 %; arm speeds 35, 30, 60 rpm at 3000 rpm, 0.5 rpm; the speed-against-pump-speed table is regenerated with the re-tuned k_f and stored as the regression target; the mid arm stalls near 1400 rpm; the lower arm stalls at a contact torque of 0.07 N m, 5 %; `phaseAt` of a free arm over 10^6 base steps equals the closed form exactly, and of a knocking arm returns to its start phase after one table period; a combo with every arm stalled has 1,024 steps of 1.953 ms; the controller driven by a recorded feedback sequence (fixture F4) reproduces the recorded tick sequence exactly.

### M5. Jets (`@spotless/sim-jets`)

**Responsibility.** Everything between a nozzle and the edge of the fast radial film: the phase-domain trace, hit classification, footprint records, impingement closures, the exposure gather onto soil cells, the hand-over of liquid to the film solvers, the source records for secondary droplets, and jet loads on items.

```ts
interface JetStage {
  trace(scene: Scene, hp: HydraulicPoint, phases: number): Promise<FootprintTable>;              // stage C; trace part of the records, read back
  loads(t: FootprintTable, scene: Scene): ItemLoads;                                             // CPU, needs only the trace
  liveWrench(hp: HydraulicPoint, baseTime_s: number, poses: ReadonlyMap<string, Pose>, awake: readonly string[], scene: Scene): readonly Wrench[];
                                                                                                 // CPU f64: re-casts the sub-rays that can reach the awake bodies
  emitterMeans(t: FootprintTable, scene: Scene, liq: LiquorProps): Promise<GPUBuffer>;           // time-mean hand-over flux per block with fan limits at h_res = 0 (pilot input)
  completeFootprints(t: FootprintTable, scene: Scene, liq: LiquorProps, hRes: GPUBuffer, rain: GPUBuffer): Promise<FootprintTable>;
                                                                                                 // stage D: f_c with rain interference, xi, sector walks
  gather(t: FootprintTable, scene: Scene, liq: LiquorProps): Promise<JetRecordSet>;              // stage D, one viscosity point
  emitters(t: FootprintTable, scene: Scene, liq: LiquorProps, grid: 'block' | 'classD'): Promise<EmitterTable>;
  sources(t: FootprintTable): SourceTable;                                                        // on a table that is not complete: no rain interference, sector ends at h_res = 0 (what the pilot uses)
}
interface FootprintTable { hp: HydraulicPoint; phases: number; subJets: number; cpu: { footprints: ArrayBuffer; sectors?: ArrayBuffer };
                           gpu: { footprints: GPUBuffer; sectors?: GPUBuffer }; complete: boolean }
interface ItemLoads { phaseBins: 256; force: Float32Array; torque: Float32Array }               // [arm][item][bin][3], tub frame, about the centre of mass
interface Wrench { item: string; forceN: Vec3; torqueNm: Vec3 }
interface EmitterTable { perArm: readonly { arm: number; bucketOffsets: Uint32Array /* 4,096 arrival-phase buckets of that arm */; entries: GPUBuffer;
                                            levelByPhase: Uint8Array /* [item][256 phase bins of that arm]: time-step level the emitters require */;
                                            jetWet: GPUBuffer /* 64 bits per block: phase bins of that arm in which the block lies inside a fan */ }[];
                         clippedMomentumShare: Float32Array /* per item */ }
interface JetRecordSet { nu_m2_s: number; records: GPUBuffer /* JetExposure */; tiles: GPUBuffer /* u32 offset per 8 x 8 tile of soil cells, 0xFFFFFFFF = none */ }
interface SourceTable { records: GPUBuffer /* SourceRecord[] */; count: number; perArm: readonly { arm: number; first: number; count: number; massRate_kg_s: number }[] }
```

**Sampling.**

| Quantity | Official | Fast | Preview and pilot | Reason |
|---|---|---|---|---|
| Arm phases per revolution | 16,384 | 4,096 | 2,048 | at grazing incidence the footprint moves at v_n / tan(phi): 6.9 m/s at 5 degrees for a nozzle at 0.6 m/s (jets §2.6). With 16,384 phases it steps 0.7 mm per phase, under the 2 mm stagnation stripe (C §5.1). Coarser tiers use every fourth and eighth phase of the same sequence |
| Sub-rays per round jet | 19: centre, 6 at 0.45 r0, 12 at 0.82 r0 | 7: centre, 6 at 0.74 r0 | 7 | each pattern samples equal areas of the jet section with equal flow weights, so the clipped fraction at a rim, wire or tine is unbiased in every tier (jets §7.3, §11.2 step 2). The patterns are not nested |
| Slot nozzle | N_sub sub-jets from the nozzle table (M4), 7 sub-rays each | same N_sub, 7 | same N_sub, 7 | N_sub is physics, not sampling |

**Launch, flight, break-up** (jets eq. 2.3, 2.4, 3.1, 3.2; tags as in the dossier):

```
u0     = V_rel Rz(Theta) n_i + Omega z_hat x P(Theta)
x(t)   = P + u0 (t - t0) + (1/2) g (t - t0)^2            gravity only; segments with chord sag g dt^2 / 8 < 0.1 mm (dt <= 9 ms)
L_b    = C_b d ( sqrt(We) + 3 We / Re )                   We, Re with gamma_w(T), nu(T)
f_c(s) = 1 for s <= w_lo L_b;  1 - (s - w_lo L_b)/((w_hi - w_lo) L_b) between;  0 for s >= w_hi L_b          w_lo = 0.6, w_hi = 1.4
f_sh   = clamp( k_sh (s - x_i) / L_b, 0, f_sh,max ),   x_i = 13 d (Tu^3 We)^(-0.915),   k_sh = 0.05, f_sh,max = 0.1       shed fraction along the flight
slot   L_b = `jets.sheetBreakup` for every sub-jet of a slot (the sheet thins as Q / (V W(s)), W(s) = L_s + 2 s tan(theta_f / 2), and breaks up as a sheet);
       drops after break-up have mass-median diameter k_sd h_sh(s), k_sd = `jets.sheetDropFactor`
```

Both break-up outcomes are evaluated and weighted, not sampled (B §5.1): a hit at flight distance s is a coherent footprint with weight f_c and a drop train (drops of 1.9 d, jets §3.5) with weight 1 - f_c. The drop-train part uses the same footprint geometry with its stress exposure multiplied by k_drop and its liquid emitted as splashing parcels with the plateau splatter fraction k_dt sin(phi), k_dt = 0.3 (jets §6.5). Rain interference multiplies f_c by exp(-k_int integral n pi ((d + D)/2)^2 ds) with the droplet number density n of the pilot pass on a 1 cm grid (numerics §4.4); it is applied in stage D, when the pilot exists.

**Hit classification.** Sub-rays of one sub-jet at one phase are grouped by what they hit.

- Smooth face: sub-rays that hit the same patch and side with normals within 20 degrees, and whose hit points lie within `jets.groupPlaneTol` = 0.5 d of the tangent plane through the centroid hit. (A distance test between hit points would fail on plates, where the footprint is an ellipse with semi-major axis r0 / sin(phi): the outer sub-rays land 3.4 d apart at 15 degrees and 10 d apart at 5 degrees.) One footprint with Q_hit = (n_hit / n_rays) Q, centroid O, incidence phi = asin(|u.n| / |u|), forward tangent e_t, source point S = O - r0 cot(phi) e_t, sweep velocity v_s from the centroids at neighbouring phases.
- Wire, tine or rim whose width facing the jet is below 3 d, struck by a fraction f_hit of the sub-rays (jets §7.3, all [ESTIMATED]; table `wire.split`): the passing part (1 - f_hit) Q continues as a jet of diameter d sqrt(1 - f_hit), deflected by 5 degrees x f_hit, with C_b reset to 3.3 (at most three generations). The intercepted part loads the wire with stagnation stresses on a footprint limited to its width, leaves f_ret on the wire, and the rest becomes two fan sheets (centred 40 degrees from the incoming direction, +/- 20 degrees in plane, +/- 15 degrees along the wire, speed 0.8 V, drops of mass-median 0.25 d), written as source records for M6.
- Edge of a face: the bundle is split geometrically; the part on the face is a partial footprint.

**Impingement closures.** Along each azimuth psi about S (psi = 0 forward), with x = r / d_eq (jets §4.2 to §4.7 and §11.2 step 5). The tags are those of the dossier for normal incidence inside the validated range (incidence 30 to 120 degrees; Re up to 32,000 for film speed and 53,100 for thickness); every use at incidence below 30 degrees or at Re_eq above that range is [ESTIMATED], and the registry carries the range in `validity`.

```
flow per radian      q(psi)  = (V r0^2 / 2) sin^3(phi) / (1 - cos(psi) cos(phi))^2                              [VERIFIED]
footprint edge       r_e     = r0 sin(phi) / (1 - cos(psi) cos(phi))
equivalent jet       d_eq    = sqrt(8 q / V),   Re_eq = V d_eq / nu,   Q_eq = 2 pi q (1 - xi)
pressure             p_w     = (rho V^2 / 2) sin^2(phi) sech^2( 0.916 X + 0.95 X^3 ),  X = sqrt((x_f sin(phi))^2 + x_l^2) / d   [ESTIMATED]
stagnation zone      tau     = k_stag 1.150 rho (V sin(phi))^2 Re_n^(-1/2) X,  Re_n = V sin(phi) d / nu,  for r <= r_e + 0.05 d_eq,
                               capped by the next line                                                         [ESTIMATED]
boundary-layer zone  h       = d_eq (0.125 / x + 1.06 Re_eq^(-1/2) x^(1/2)),   U_av = V d_eq / (8 r (h / d_eq)),
                     tau     = k_film 0.472 rho V^2 Re_eq^(-1/2) x^(-1/2),      up to r_b = 0.24 Re_eq^(1/3) d_eq  [VERIFIED in range]
laminar zone         h       = d_eq (3.792 x^2 / Re_eq + 0.1975 / x),  U_av = V / (8 x (h / d_eq)),
                     tau     = mu V / (4 r (h / d_eq)^2),                up to r_t = 0.2964 Re_eq^(1/3) d_eq       [VERIFIED in range]
turbulent zone       U_av    = V / ( 0.167 Re_eq^(-1/4) x^(9/4) + 2.37 - 0.0108 Re_eq^(1/2) )
                     h       = d_eq ( 0.0209 Re_eq^(-1/4) x^(5/4) + (0.296 - 0.001356 Re_eq^(1/2)) / x )
                     tau     = 0.0478 rho Re_eq^(-1/4) U_av^2 x^(1/4)                                          [VERIFIED in range]
transition cap       if r_b > r_x = Re_x,t nu / V: beyond r_x the boundary layer is taken as turbulent. With q_psi = U_av h r at r_x and the
                     film friction law of M7 ( f = max(24 / Re_loc, 0.288 Re_loc^(-0.40)), Re_loc = 4 q_psi / (nu r) ) the momentum balance
                     of the sector integrates in closed form on the turbulent branch:
                     1 / U_av(r) = 1 / U_av(r_x) + 0.06 (4 q_psi / nu)^(-0.4) (r^2.4 - r_x^2.4) / (c_M q_psi),   h = q_psi / (U_av r),
                     tau = k_film (1/2) f rho U_av^2                                                           [SYN from the M7 friction law]
momentum flux        M       = c_M rho U_av^2 h,  c_M = 6/5 [RECALLED, parabolic profile] for r < r_t and in the capped zone, 64/63 [VERIFIED]
                               beyond r_t;  linear ramp from 0 at r = 0 to the boundary-layer value at r = 0.55 d_eq       [ramp SYN]
fast-film radius     R_j     = c_R Q_eq^(3/4) ( rho / (nu gamma_w) )^(1/4),  c_R = 0.289                        [VERIFIED in range]
beyond r_s = 4.5 d_eq the flow is q (1 - xi)
```

The (1 - xi) in Q_eq is jets §11.2 step 5c; A omitted it (7 % in R_j at xi = 0.09). gamma_w is the clean-water value times `jets.gammaFactor` because the surfaces are milliseconds old (jets §4.5); the same value is used wherever a fan quantity is compared with a capillary force. Reference values for J2-8 at 50 C from these formulas (`checks.py`): R_j = 41.3 mm (38.5 mm with xi = 0.09); tau = 237 Pa and M = 33.8 N/m at 0.55 d; 52 Pa and 0.57 N/m at 10 d. Normal incidence is untouched by the transition cap (r_b = 14.7 mm, r_x = 20.8 mm). On the forward ray of a 2.25 mm jet at 8.1 m/s and 55 C striking at 15 degrees, r_b would be 108 mm and the laminar boundary layer would run to Re_x = 1.7 x 10^6; with the cap at Re_x,t = 3 x 10^5 (r_x = 19 mm) the state at 100 mm is h = 253 um, U_av = 3.0 m/s, tau = 40 Pa, where the uncapped closure gives 179 um, 4.3 m/s and 24 Pa and the film friction law applied to that uncapped state gives 80 Pa (`closures2.py`). The capped form is continuous with the friction law the film solvers use beyond the hand-over.

**Sweeping footprint** (jets §4.9, [ESTIMATED]). The film front emitted at t_0 reaches radius r at t_0 + T(r), T(r) = integral of dr / U_av. Ahead of the footprint the fast film exists only out to r*, where U_av(r*) = v_s . e_r. On a wall carrying a residual film the front speed follows the snow-plough balance rho h U (U - U_f) = e rho h_res U_f^2 of jets §4.9 item 5,

```
U_f / U = ( sqrt(1 + 4 e k) - 1 ) / (2 e k),   k = h_res / h,   e = `jets.prewetEff`
```

which is 0.92, 0.81 and 0.62 at k = 0.1, 0.3 and 1 and has no threshold (residual films of 50 to 80 um under fan films of 70 to 140 um put k between 0.4 and 1). h_res comes from the pilot pass of the same combo (stage E), which removes the circular dependency in C §5.5 (J-phys, J-del). A correction table `sweep.correction(phi, v_s / V, h_res / h)` multiplies tau, M and r_lim; it is 1 until campaign C3 fills it, and C3 runs before milestone MS3 (section 9).

**Validity bound and sector walk** (stage D, GPU, results read back). For every fourth phase and 32 azimuths a walk follows the film ray from S along the surface in 1 mm steps (on REV patches the ray is a geodesic and obeys Clairaut's relation r sin(alpha) = constant exactly; on CART patches it is a straight line; C §5.6). It returns r_lim(psi), the travel time T(r_lim) and the end type of the sector. r_lim is the smallest of: R_j(psi); r*(psi); the first convex edge, rim or seam; the second concave fold or concave seam; the Gaussian-curvature bound sqrt(|K|) r < `jets.gaussBound` = 0.7 (on developable zones, K = 0, the flat-wall film is exact on the unrolled surface and there is no bound; convex curvature along the ray is handled by the edge rule with r_e = 1 / kappa_n); the point where rays wrapped round a convex cylinder meet on its far side; a boundary to another part.

| Where the ray ends | Outcome |
|---|---|
| R_j or r* | hand-over to the film through the ring emitter |
| R_j on an underside (G_n < 0) | the fraction f_dep = 1 - smoothstep(tilt; t_dep - 5 degrees, t_dep + 5 degrees) leaves as a curtain (source record, drops of 3.3 l_c), with tilt the angle of the face from horizontal and t_dep = `jets.undersideDepartTilt` = 40 degrees [SYN, range 10 to 70; bracket G4; campaign C4]. The rest is handed to the film and runs to the lower edge. The only data are for horizontal undersides (jets §8.1); the steady rope of films §3.6 needs 0.1 to 0.5 s to form and a footprint passes in 20 to 80 ms, so no rope argument is used |
| convex edge, rim or seam with radius r_e | the separation rule of M7.5 with the fan's h and U_av at the edge and gamma_w: the separated fraction leaves as a free sheet tangentially at U_av (source record, drops of mass-median k_sd h); the rest is handed over to the first film cell beyond the edge with its momentum along the surface. For the grazing jet above, 150 mm from a plate rim: a rim of r_e = 2 mm keeps all of the sector on the plate (We_e = 11, We_c = 12), a rim of 0.5 mm sheds 80 % |
| first concave fold or concave seam (base-to-wall corner of a vessel or box shell) | the walk continues across it; this is the "ceiling film plus wall film" of jets §8.2 |
| second fold or seam, part boundary, Gaussian bound, wrap collision | hand-over there (flag `cut`); on a wrap collision the remaining flux leaves as a sheet along the bisector |

**Exposure gather** (stage D; A §5.6, C §5.5, B §5.5). The CPU scans each sub-jet's track in phase order and merges consecutive phases into **gather segments**: a segment ends when the source point has moved `jets.gatherStride` = 1 d in developed coordinates since the segment's start, or at a change of patch, zone or hit class. Its footprint quantities are those of its middle phase, its duration is the sum of the dwell times of its phases. (Looping over single phases would cost 430 to 2,500 samples per pass at normal incidence, where the footprint moves 0.03 to 0.09 mm per phase.) The CPU then writes, per 8 x 8 tile of soil cells, a list of (sub-jet, first segment, last segment) ranges within reach. The GPU kernel visits each soil cell of each listed tile and loops over its ranges in list order:

```
for each range (jet, k0..k1) of my tile, for k = k0..k1, for each Gauss point g of segment k:
    (r, psi) = developed position of this soil cell about the source point at g
    if r < r_lim(psi) and the cell is behind the front set by T(r) and v_s:
        tau, M, p = closures above, scaled by ( f_c + (1 - f_c) k_drop ) and by k_rough(soil class)
        for m in 0..7:  if tau > tauLevel[m]:  tExcTau[m] += w_g dt_k
        for m in 0..7:  if M   > MLevel[m]:    tExcM[m]   += w_g dt_k
        track peaks of tau, M, p within the pass; a pass ends when tau falls below tauLevel[0]
at the end of a pass: count it; keep it among the four strongest (by peak tau) with its phase; update the longest rest
at the end: convert the f32 sums to the stored u16 units, saturating at 65,535
```

- Developed position: inside one developable zone the surface is isometric to a plane (disc: the plane; cone of half-angle b: polar development with angle theta sin(b); cylinder: (s, r theta)), so (r, psi) is exact; across one fold or concave seam it is the shortest two-piece path, found by 3 Newton iterations on the crossing point; on continuously curved rows the osculating cone at S is used (A §5.5), inside the Gaussian bound.
- Each segment is integrated with 1 to 4 Gauss points so that the quadrature spacing stays below 0.25 d (closed-form chord integration in the sense of jets eq. 3.25; B §5.5): about 150 samples per pass through a full fan. Soil cells within 3 d of a track evaluate their 2 x 2 sub-samples and average times (peaks take the maximum).
- Levels: tauLevel = 3, 5, 10, 20, 30, 50, 100, 200 Pa (10 Pa is the protein threshold tau*); MLevel = 0.25, 0.5, 1, 2, 4, 8, 16, 32 N/m (the peel threshold M_Y is 20 N/m and above for soaked sauces).
- The loop order is fixed and each invocation writes one cell, so the float sums are reproducible without atomics.
- The gather is repeated at three viscosity points (20, 45 and 65 C; nu = 1.004, 0.602, 0.442 x 10^-6 m2/s); the replay interpolates in ln(nu) (C §5.5 with a third point for the 65 C programme).
- Pooled water is not in the gather: the jet record of a cell is that of the dry geometry, and the soil kernel attenuates it by the depth of water above the cell at that tick (M8).

**Hand-over: the retarded ring emitter** (A §5.7). Liquid that left the source point at t - T(psi) arrives at the fan limit now. The ring r_lim(psi), interpolated linearly in psi between the 32 walked azimuths and in phase between walked phases, is a curve on the surface. An emission event is generated each time the source point has moved half a film cell since the previous event of that sub-jet. For each event the ring is rasterised onto the film cells it crosses:

```
mass of cell c   dm_c = rho (1 - xi)(1 - f_sep - f_dep) dt_ev * integral of q(psi) dpsi over the azimuth interval the ring spends in c
                 (closed form:  integral dpsi / (1 - c cos psi)^2 = c sin psi / ((1 - c^2)(1 - c cos psi)) + 2 atan( sqrt((1+c)/(1-c)) tan(psi/2) ) / (1 - c^2)^(3/2),  c = cos phi)
integer masses   floor(dm_c / unit), then the event total, which carries the remainder of the previous event, is completed by the largest-remainder rule over the cells in ring order
position         S(t - T(r_lim(psi))) + r_lim(psi) e_r(psi)        developed back onto the surface
momentum         dm_c min( U_av(r_lim), U_cap ) e_r(psi)           tangential, in the receiving cell's frame
```

With one entry per sector and one cell per entry a 41 mm ring would feed 17 lines across an 83 mm swath; at 10 degrees incidence the forward lobe of q(psi), which is 19 mm wide at 84 mm, would arrive in one column of cells. Rasterisation removes both.

**Hand-over speed cap.** U_cap = `film.handoverCap` = 2.2 m/s at the official tier. The film ladder of M7.4 resolves 2.3 m/s at level 3 on 2 mm cells and at level 4 on 1 mm cells, so emitters never ask for more than those levels. A fan that reaches R_j hands over at about 0.7 m/s; J2-8 exceeds the cap when it is cut inside 23 mm (5.1, 3.9 and 2.8 m/s at 10, 15 and 20 mm), and forward sectors that end at r* carry v_s . e_r, which at grazing incidence can be several metres per second. Above the cap the mass is handed over in full and the momentum is clipped; the clipped share of each item's hand-over momentum is reported (`handoverClipped`). A film at 4 m/s and 0.2 mm loses its speed to wall friction over about 45 mm, so the cap shortens the reach of such a film by a few centimetres and lowers its shear in that stretch from about 70 to about 20 Pa, both still above tau*. The reference tier has no cap and eight levels, and the tier gate measures the effect. `jets.cutSplash` (default 0, range 0 to 1, [SYN], bracket G4) sends that fraction of an over-cap sector at a `cut` end to the droplet layer instead.

`FootprintRecord`, 56 bytes per (sub-jet, phase). Trace part (stage C): source point S in patch coordinates and offset r0 cot(phi) (3 x f32); forward tangent angle, sin(phi), V, d, Q_hit (5 x f32); sweep velocity in the patch tangent frame (2 x f32); flight time (f32); patch (u32). Film part (stage D): f_c, xi (2 x f16); zone id (u16); flags (u16). `SectorRecord`, 176 bytes per (sub-jet, walked phase): r_lim at 32 azimuths (32 x f16, mm); T(r_lim) (32 x f16, ms); separated or departed fraction (32 x u8); end types (32 x 4 bits).

Emitter entries are written at stage D on the CPU (about 4 million per diverter state), sorted by arrival phase of the emitting arm into 4,096 buckets, and replayed every revolution of that arm by an `emit` kernel that adds the entries of the buckets the arm's phase crosses in a base step to the deposit accumulators of M7 (16 bytes per entry: film cell u32; mass i32 in 10^-12 kg; velocity 2 x i16 in mm/s; spare). The CPU knows the phases, so it knows the entry range of every base step. Because the position uses the retarded source point, liquid emitted forwards lands the lead distance r* - v_s T(r*) ahead of the footprint and the rear arcs lay liquid across the whole swath: the comet-shaped wetted pattern of jets §4.9 without resolving the 5 to 8 m/s film. The cascade ignores the momentum; the S solver uses it. No relaxation-length offset is applied beyond R_j (C §5.6 is rejected: at R_j the film has already been stopped by surface tension; J-del). Residual film inside the instantaneous fan is left in place; entrainment by the fast film is not modelled (mass is conserved either way). `levelByPhase` gives, per item and phase bin of the arm, the time-step level implied by the fastest emitter of that arm that lands on the item, from 4 ms before until 60 ms after (M7.4).

**Splatter** (jets eq. 5.1 to 5.4; every constant is a registry key, tags [ESTIMATED] synthesis of [VERIFIED] data):

```
omega = We exp( 0.971 (l / d) / sqrt(We) ),   xi_BL = max(0, -0.258 + 7.85e-5 w - 2.51e-9 w^2),  w = min(omega, 11000)
S_W   = clamp( 4.6e-5 (V d / nu_20 - 12000), 0, 0.40 ),   nu_20 = 1.0e-6 m2/s
xi    = k_S max(xi_BL, S_W) sin(phi)
```

Splattered mass leaves at r_s = 4.5 d_eq, 20 degrees above the wall (uniform 10 to 30), at 0.7 V (uniform 0.4 to 0.9).

**Droplet sizes are mass distributions.** Parcels carry mass, so every size distribution in M5 and M6 is a log-normal distribution of mass over diameter and the registry value is its mass median. For a geometric standard deviation of 1.8 the mass median is 2.82 times the count median, and the difference decides how far secondary water travels: a 0.16 mm drop launched at 5.6 m/s, 20 degrees off a wall, reaches 68 mm from it in still air, a 0.45 mm drop 331 mm. The dossier's splatter figure (number-mean D / d of 0.055 to 0.10 from phase-Doppler data, jets §5.4) converts to a mass median of 0.19 d; its secondary-droplet figure of 0.08 D, taken as a count median, to 0.23 D. Both conversions are [ESTIMATED], truncated to 0.02 to 0.6 of the parent, and are in bracket G1 and G2.

**Loads on items** (A §9.3). By the momentum theorem on each fan, the force on the item is the incoming momentum flux minus the momentum flux of liquid that leaves the item fast:

```
F = rho Q_hit V u_in  -  sum over separating sectors of rho q(psi) U_sep e_sep dpsi  -  xi rho Q_hit (0.7 V) e_spl
```

Liquid handed to the film stays on the item and contributes its full incoming momentum. A flat hit gives F_n = rho Q_hit V sin(phi) plus a tangential part; a jet captured in an inverted cup whose film leaves the rim downwards gives up to rho Q V (1 + U_out / V), the turning factor of items §4.3, without a tuned constant. `loads` tabulates force and torque about the centre of mass in 256 phase bins per arm; it needs only the trace (with the separation rule evaluated at h_res = 0) and is used to screen for mobile items. `liveWrench` is the same formula evaluated on the CPU in f64 for the current poses of awake bodies: it re-casts, with `RayQuery.traceCpu`, only the sub-rays whose swept cone meets the bounding sphere of an awake body (M11).

**Parameters.**

| Key | Default | Range | Tag | Source |
|---|---|---|---|---|
| `jets.Cb` break-up constant | 6 | 3.3 to 12 | default [ESTIMATED], bounds [VERIFIED] | jets §3.3, §11.3 |
| `jets.breakWindowLo`, `jets.breakWindowHi` | 0.6, 1.4 | +/- 0.2 each | [ESTIMATED] | jets §3.6, §11.3 |
| `jets.shedSlope`, `jets.shedMax` | 0.05, 0.1 | | [ESTIMATED] | jets §3.6 |
| `jets.sheetBreakup`; `jets.sheetDropFactor` | 100 mm; 3 | 50 to 150 mm; 2 to 4 | [ESTIMATED] | jets §2.5, §7.3 |
| `jets.Tu` nozzle turbulence intensity | 0.05 | 0.03 to 0.12 | [ESTIMATED] | jets §11.3 |
| `jets.kStag`, `jets.kFilm` | 1, 1 | 1 to 2.8; 0.5 to 4 | [ESTIMATED] | jets §11.3; the range of k_film covers the factor of 3 between the fan closure and the film friction law at grazing incidence |
| `jets.ReXt` transition Reynolds number of the fan boundary layer | 3 x 10^5 | 10^5 to 3 x 10^6 | [SYN] (flat-plate value) | this section |
| `jets.cR` fast-film radius constant | 0.289 | 0.25 to 0.32 | [VERIFIED] | jets §4.5 |
| `jets.cMlam`, `jets.cMturb` | 6/5, 64/63 | | [RECALLED], [VERIFIED] | films §3.3 |
| `jets.gammaFactor` on gamma_w | 1.0 | 0.6 to 1.0 | [VERIFIED] basis; bracket G1 | jets §4.5 |
| `jets.kS` splatter factor | 0.5 | 0 to 1 | [ESTIMATED]; bracket G1 | jets §5.6 |
| `jets.SW.*` (slope 4.6 x 10^-5, onset 12,000, cap 0.40), `jets.xiBL.*` (-0.258, 7.85 x 10^-5, -2.51 x 10^-9, cap 11,000) | as listed | | [ESTIMATED] synthesis | jets §5.2, §5.6 |
| `jets.kDrop` drop-train stress efficiency; `jets.kDropTrain` its splatter plateau | 0.7; 0.3 | 0.3 to 1.5; 0.1 to 0.5 | [ESTIMATED] | jets §6.5, §6.6 |
| `jets.kInt` rain interference | 1 | 0 to 2 | [ESTIMATED] | numerics §4.4 |
| `jets.prewetEff` | 1 | 0 to 2 | [ESTIMATED] | jets §4.9 |
| `jets.undersideDepartTilt`, blend width | 40 degrees, 10 degrees | 10 to 70 | [SYN]; bracket G4 | this section |
| `jets.gaussBound`; `jets.groupPlaneTol`; `jets.gatherStride` | 0.7; 0.5 d; 1 d | 0.5 to 1; | [SYN] from jets §4.8 | this section |
| `jets.cutSplash` | 0 | 0 to 1 | [SYN]; bracket G4 | this section |
| `jets.wire.*` (deflection 5 degrees x f_hit, fan 40 +/- 20 +/- 15 degrees, speed 0.8 V, drop mass-median 0.25 d, f_ret 0.05) | as listed | each within a factor 2 to 3 | [ESTIMATED]; bracket G2 | jets §7.3 |
| splatter droplets: radius of release, elevation, speed, mass median, geometric s.d. | 4.5 d_eq; 10 to 30 degrees; 0.4 to 0.9 V; 0.19 d; 1.8 | mass median 0.08 to 0.4 d | ranges [VERIFIED], distribution [ESTIMATED] | jets §5.4, §5.6 |
| `jets.kRough` roughness factor per soil class | 1.0 | 1.0 to 1.5 | [ESTIMATED] | jets §4.3 |

Edge separation at the end of a fan sector has no key of its own: it uses `film.Ctp` and the partial-separation curve of M7.5.

**Conservation.** Per footprint: integral of q over psi equals Q_hit (0.1 %); emitted ring mass plus splatter plus sheets and curtains equals rho Q_hit dt exactly in integer units (the remainder is carried into the next event, B §6.6).

**Tests.**

| Test | Target | Tolerance |
|---|---|---|
| DU750 lower arm and two 250 mm plates at +/- 125 mm | 2 of 10 jets reach the left plate, 5 the right; tile impact times 0.0013 s and 0.0272 s per revolution (jets §9.1 [VERIFIED]) | same counts; times within 15 % (the thesis used zero-width jets) |
| The same plate turned so that a jet strikes it at 5 degrees | one footprint per phase (no split of the bundle by the grouping test); Q_hit equals the unclipped flow | exact; 1 % |
| Dwell against radius | 0.1667 s at 40 mm, 0.0266 s at 240 mm (standards P07 [VERIFIED]) | 5 % |
| Closed forms for J2-8 at 50 C | h, U_av, tau at r/d = 1, 2, 5, 10, 12, 15, 20 (jets §4.4 table); R_j = 41 mm | 1 % |
| Transition cap | no change at normal incidence; the 15 degree case above (253 um, 3.0 m/s, 40 Pa at 100 mm); shear continuous with the M7 friction law at hand-over | 1 %; 5 % |
| Flow split | forward fraction 0.50, 0.66, 0.80, 0.91, 0.97, 0.991 at 90, 75, 60, 45, 30, 20 degrees (jets §4.7) | 0.005 |
| Pressure integral | rho Q V sin(phi) | 1 % |
| Sweeping exposure, J2-8 at 1 m/s | impulse 4.35, 4.28, 3.77, 3.11, 1.65, 0.45 Pa s at offsets 0, 2, 5, 10, 20, 30 mm; above 10, 30, 100 Pa for 63, 47, 11 ms on the track; lead 30, 21, 12, 8 mm at 0.5, 1, 2, 3 m/s (jets §4.9) | 5 %; 1 mm |
| Momentum exceedance, same case | integral of (M - M_Y)+ dt per pass: 144, 54, 14.5 mN s/m at M_Y = 2, 10, 20 N/m (`checks.py`, reference implementation) | 5 % |
| Developed coordinates | a fan on a cone and on a cylinder against the same fan on the unrolled plane | 10^-4 |
| Splatter | S_W = 0.18 at V d / nu_20 = 15,900, xi = 0.09; xi_BL = 0.10, 0.28, 0.30 at 100, 150, 200 mm for J2-8 at 20 C (jets §5.2) | 0.01 |
| Phase-count and stride invariance | exposure of a grazing stripe (5 degrees) with 16,384 and 32,768 phases, and with gather strides of 1 d and 0.5 d; the same for a slot nozzle | 2 % |
| Ring rasterisation | a footprint sweeping a flat patch at 1 m/s, at 90 and at 10 degrees incidence: lateral profile of deposited mass per film cell (1 and 2 mm) against the analytic one; total mass | 10 % per cell above 5 % of the peak; exact in integer units |
| Rim rule | a fan sector reaching rims of r_e = 0.1, 0.5 and 2 mm: separated fraction equals the M7.5 rule evaluated by M2's shared function; mass to sheet plus mass handed beyond the edge equals the sector flux | exact branch; integer exact |
| Live wrench against the tabulated loads | an item held fixed for one revolution | 2 % per phase bin |

**Cost.** Trace: 2.0 x 10^8 segment queries per (diverter state, pump class) at 60 M/s, 3.3 s. Sector walks: about 10^9 walk steps per state, 1 s. Gather: about 135 (cell, sample) pairs per soil cell and record set at 0.2 G pairs/s, 1.3 to 2.3 s per set; 12 sets per programme. Emitter rasterisation: 4 million entries per state on the CPU, about 1 s. [SYN, `budget3.py`]

### M6. Spray (`@spotless/sim-spray`)

**Responsibility.** All droplets. Two modes share one kernel family.

- **Monte Carlo mode** (stage F): the diffuse primary sources that do not depend on the film state (splatter, wire and rim fans, drop-train splash, shed droplets, jet-driven sheets and curtains from M5) are sampled as parcels, traced to their fate and deposited into phase-binned integer tables. One table per (active arm, diverter state, pump class), binned by the phase of the arm that owns the sources.
- **Time-coupled mode** (inside stage G): everything the film emits (drips, columns and sheets from gutters and edges, pendant drops cut from undersides, their splash secondaries) is a live parcel advanced with the film and deposited when it lands, so timing and the wet or dry state of the landing point are those of the film at that moment (A §5.9; J-phys).

```ts
interface SprayStage {
  monteCarlo(a: { scene: Scene; src: SourceTable; arm: number; wall: WallStateTable; plan: ParcelPlan; simSeed: number }): Promise<DepositionTable>;
  plan(src: SourceTable, nParcels: number, importance?: Float32Array /* per source stratum, from the pilot */): ParcelPlan;
  live: {
    bind(film: FilmBuffers): void;                                    // deposit accumulators (current), wet flags, impact-duty counters, level requests
    encode(pass: GPUComputePassEncoder, step: { baseStep: number; armPhases: Uint32Array }): void;   // advance due parcels, resolve impacts, spawn children; no CPU count needed
    airborne(): Promise<{ mass_kg: number; slotsInUse: number }>;      // read with the monitors, once per phase bin
  };
}
interface WallStateTable { steadyWet: GPUBuffer /* 1 bit per block */; jetWet: readonly GPUBuffer[] /* per arm, 64 bits per block */ }
interface ParcelPlan { strata: Uint32Array /* prefix sums of parcel counts per (source, phase bin) */; massPerParcel: Uint32Array /* integer units per stratum */; total: number }
interface DepositionTable { arm: number; packed: GPUBuffer /* 144 B per block */; perItemHalfMass: [Float64Array, Float64Array];
                            vAir_m3: number; rainDensity: GPUBuffer /* 1 cm grid */; sparseLanding: Float32Array /* per stratum: share landing on sparse blocks */;
                            leakFraction: number; packRemainder_units: bigint }
interface FilmBuffers { accCurrent: GPUBuffer; blockFilm: GPUBuffer; sFilm: GPUBuffer; kHot: GPUBuffer; impactDuty: GPUBuffer; levelRequest: GPUBuffer }
```

`SourceRecord`, 32 bytes (written by M5): kind u8 (splatter, wire fan, edge sheet, curtain, drop train, shed drops), sub-jet u8, phase u16; origin in the tub frame (vec3 f32); direction frame (normal octahedral 2 x i16, tangent angle i16, spread code u16); mass rate (f32, kg/s); speed (f16, m/s) and mass-median diameter (f16, mm); flight-time offset (f16, ms); spare.

`Parcel`, 48 bytes: position vec3 f32; velocity vec3 f32; mass u32 in 10^-12 kg (in Monte Carlo mode the mass the parcel represents per revolution of its arm); diameter f32; birth step u32; lineage 2 x u32; kind, flags and fate u32. Mass is an integer from birth: a splash splits it as n_dep = n - n_sec, n_sec = floor(r_m n), and the two secondaries get floor(n_sec / 2) and the rest, so no step of a parcel's life rounds mass. A drop heavier than 4.2 g does not occur (a 3.3 l_c drop is 0.34 g).

**Flight.**

```
du/dt = g - (3/4) C_D (rho_g / rho) |u - u_air| (u - u_air) / D
C_D   = (24 / Re_p)(1 + 0.15 Re_p^0.687) for Re_p < 1000, 0.44 otherwise,   Re_p = rho_g |u - u_air| D / mu_g     (jets §3.7 [RECALLED])
```

Exponential (unconditionally stable) drag update per segment; segment length limited by the 0.1 mm sag rule and by 20 mm; a droplet within 5 % of terminal velocity is finished with one straight ray; at most 32 segments (C §5.8). u_air is sampled from a 32 x 32 x 40 grid that is zero by default: still air is the model, the grid is the hook for a recirculation model (section 11). Processing is wavefront: every pass advances all live parcels of a wave by one segment query (D4).

**Wall interaction** (jets §6.2 to §6.4, §11.2 step 6), with We_n = rho V_n^2 D / gamma_w and La = rho gamma_w D / mu^2:

| Wall | Condition | Outcome |
|---|---|---|
| wet (film above 20 um) | We_n < 2 | stick |
| wet | 2 to 20 | rebound: normal restitution 0.993 - 1.76 a + 1.56 a^2 - 0.49 a^3 (a = angle from the wall, rad), tangential x 5/7; at most 3 bounces |
| wet | 20 to 1320 La^(-0.183) | deposit |
| dry | below 2630 La^(-0.183) | deposit |
| either | above | splash: mass ratio r_m = clamp(0.1 (We_n / We_c - 1), 0, 0.3), up to 0.5 on a film thicker than 0.1 D; two secondary parcels at 10 to 40 degrees above the wall, 0.3 to 1.2 V_n plus 0.7 of the tangential velocity, mass-median diameter 0.23 D; no second generation |
| wire or tine | D >= 0.5 D_w and We_n > 20 | split into two fragments at +/- 20 to 40 degrees, f_ret captured; otherwise captured |

Thresholds [VERIFIED] (OpenFOAM constants); r_m and secondary properties [ESTIMATED], chosen below Bai-Gosman because measured splash of millimetre drops is under 14 % (jets §6.4; numerics recommends Bai-Gosman, conflict 2 in the appendix). In time-coupled mode the wall state is the film's at impact. In Monte Carlo mode a block is wet at the landing time if the pilot's steady estimate says so or if the jet-wet table of any active arm has the bit of that arm's phase bin at that time. After the film solve the mass fraction of deposits whose assumed state was wrong is reported per item (`wetAssumptionMismatch`), and the reference tier iterates once (C §5.8 decided this by material only; J-del). The pilot's own Monte Carlo has no pilot and no jet-wet table yet: it takes a block as wet if the emitter means of M5 give it any hand-over, and elsewhere by material (wet if the receding angle in the liquor is below `film.thetaFilm`); its sources are those of the trace alone.

**Deposits.** Mass goes to integer accumulators with `atomicAdd` (each parcel writes to at most 49 targets and few parcels share a target in one dispatch): the phase-binned accumulator in Monte Carlo mode (bin = phase bin of the owning arm at emission plus flight time), the `current` deposit accumulators of the film in time-coupled mode. A deposit is spread uniformly over the elements within r_dep = clamp(0.5 beta_max D, 0.5 D_B, 3 D_B), beta_max = 0.61 (Re_n^2 Oh)^(1/6) (jets §6.6), so a 0.34 g drip does not arrive as a 0.3 m column on one cell; the integer mass is divided by the number of targets and the remainder units go to consecutive targets starting at an offset given by the parcel's hash, so that a parcel worth fewer units than it has targets is not biased towards low indices. Tangential momentum is deposited with the speed clipped at `film.handoverCap`. Two more counters per block accumulate the area-time of impacts whose stagnation shear k_drop 0.63 rho V_n^2 Re_n^(-1/2) exceeds 3 Pa and 10 Pa (duration 2 D / V_n over the same radius). A droplet larger than the gap at its landing block is credited to that gap's reservoir. A parcel that ends in the sump region, leaks or exceeds its segment limit writes its fate and mass into its own slot; the sump, leak and airborne totals are segmented integer reductions over the parcel buffer (M1), not shared counters.

**Monte Carlo accumulator**, 288 bytes per block: 64 x u32 mass by phase bin (10^-12 kg per revolution of the arm; a bin holds 4.3 g, six times a whole 2 mm jet dwelling on one block for a bin); 3 x i32 momentum sum in 10^-9 kg m/s with hashed stochastic rounding (a statistic for the mean arrival velocity, not a ledger); u32 parcel count; 2 x u32 impact duty; 2 x u32 split-half mass in 10^-10 kg. **Packed table** for the film stage, 144 bytes per block: 64 x u16 mantissa by bin and one u8 shift per block, value = mantissa << shift in the same integer unit; 3 x i16 mean velocity (mm/s); f32 smoothed mean flux; u8 smoothing level; u8 flags (sparse, sheet-fed, gap); 2 x log u8 impact duty; one byte spare. Packing walks the bins of a block in order and carries the truncated low bits into the next bin, so the block total is exact up to one last carry, which is added to the block's largest bin if that is representable and otherwise booked to the ledger account `packRemainder`. The table is therefore in the accumulator's unit and the hop from M6 to M7 is integer and exact. The split-half sum bounds every bin of its block; a block whose bound exceeds 2^31 units is counted as saturated and fails the run. A stalled arm has one phase: its table holds the deposit per nominal period in one bin.

**Sampling.** Parcels are generated from a counter, with no stored list: parcel index -> (source row, stratum, sample) through the prefix sums of the `ParcelPlan`. Random numbers are `hashU32(simSeed, domain, source, sample, child)` of `@spotless/core` (the generator the platform fixes; Threefry of C and pcg4d of A are not used). Counts per (diverter state, pump class), shared between its arms in proportion to source mass: 3 x 10^8 for the main-wash pump class and 1.5 x 10^8 for other classes (official); a tenth of that (fast); 10^7 (preview and pilot).

- **Reference flux and what matters.** j_ref = 0.10 kg/(m2 s) (pump flow over item area, typical load). The Monte Carlo sources carry the secondary water, about 15 % of the flow: a mean of 0.015 kg/(m2 s) over the load. A face becomes film-wet when it has collected the onset mass m_on of M2: 2 g/m2 on glass and 3 g/m2 on glaze in wash liquor (the running-drop route), 16 g/m2 on steel and polypropylene in wash liquor, 12 and 43 g/m2 on glass and polypropylene in clean water (`budget3b.py`). The fluxes that decide whether a face wets within the 54 minutes of the main wash are therefore 6 x 10^-7 to 5 x 10^-6 kg/(m2 s), 10^-5 to 10^-4 of the reference flux.
- **Parcel statistics.** At 3 x 10^8 parcels one parcel represents 2.4 x 10^-10 kg per revolution; a block receiving 10^-4, 10^-5 or 10^-6 kg/(m2 s) gets 3.1, 0.31 or 0.031 parcels. Wetting decisions therefore never use a single block.
- **Pilot-guided allocation.** The plan allots parcels to strata (source, phase bin) in proportion to mass flux x (1 + G s), with s the share of the stratum's pilot parcels that landed on blocks the pilot classed as sparse and G = `spray.importanceGain` = 8, with a floor of 4 parcels per stratum; each stratum's parcel mass is its mass flux divided by its count, so the estimate stays unbiased. The pilot traces the same strata with 10^7 parcels.
- **Masked smoothing.** The flux used for wetting decisions and for the onset gate is the mean over the smallest of three windows that contains at least 16 parcels. A window is the set of blocks of the same smoothing group (same part, same side tag, normals within 30 degrees; section 3.7) whose centres lie within 1.5, 5 or 15 block widths of the block's centre in space (7, 79 and 707 blocks on a flat face; 3, 10 and 30 mm). The sums are gathered through a uniform hash grid of block centres in grid order, so the rule is the same on every patch kind and across band boundaries, and it never averages across a rim or a normal flip (C §5.8 smoothed in patch coordinates across rims; J-num). Dense deposits (sheet and curtain landings) stay at block resolution.
- **Error target.** Relative standard error at most 25 % (16 parcels) for the flux of every block whose flux can wet it within the main wash. Without importance the three windows reach that down to 7 x 10^-5, 7 x 10^-6 and 7 x 10^-7 kg/(m2 s); with the gain of 8 on strata that feed sparse faces the 10 mm window reaches about 10^-6 and the 30 mm window 10^-7. So the onset map of sparsely rained steel and plastic faces has 10 mm resolution and that of glass 10 to 30 mm. Blocks for which even the largest window holds fewer than 16 parcels are flagged `sparse`; their flux is used as it is.
- **Per-item noise.** Parcels are split into two halves by the lowest bit of the sample index; the relative difference of the two per-item deposited masses is the split-half sampling error (C §7.2), reported and fed into sigma (section 7.6).

**Time-coupled parcels and time-step levels.** When the first segment query of a live parcel with D at least one film cell shows that it will land on an S-solved item, the kernel writes a level request (item, landing base step, level) into `levelRequest`; the level is the one implied by min(|u_t|, U_cap) and a film of thickness m / (rho pi r_dep^2) on that item's cells. Requests are read back with the monitors at the end of the phase bin. The deposit of such a parcel is held until the first base step of the phase bin after the one in which it was traced, so the raise is always in force when the liquid arrives (a delay of at most one bin, 27 to 37 ms, on a fall that takes 100 ms or more); the level is held for 60 ms after the deposit. In periodic solves a drip site emits one drop-sized parcel per phase bin, so an item below a steady dripper simply stays at its request level.

**Parameters.**

| Key | Default | Range | Tag | Source |
|---|---|---|---|---|
| `spray.Awet`, `spray.Adry`, exponent on La | 1320, 2630, -0.183 | A_dry 1,300 to 5,200 | [VERIFIED] (OpenFOAM constants) | jets §6.2, §11.3 |
| `spray.WeStick`, `spray.WeRebound` (wet wall) | 2, 20 | | [VERIFIED] | jets §6.2 |
| rebound restitution polynomial; tangential factor | 0.993, -1.76, 1.56, -0.49; 5/7 | | [VERIFIED] | jets §6.3 |
| `spray.rmSlope`, `spray.rmMax`, `spray.rmMaxThick` splash mass ratio | 0.1, 0.3, 0.5 | maximum 0.14 to 0.8 | [ESTIMATED]; bracket G2 | jets §6.4 |
| secondary droplets: mass median, geometric s.d., elevation, speed, tangential carry | 0.23 D; 1.8; 10 to 40 degrees; 0.3 to 1.2 V_n; 0.7 | mass median 0.08 to 0.4 D | [ESTIMATED] from [VERIFIED] ranges; bracket G2 | jets §6.4 |
| `spray.wetFilm` wet-wall threshold | 20 um | 5 to 100 | [ESTIMATED] | jets §11.3 |
| drop-train and shed drops: diameter | 1.9 d (g.s.d. 1.3); D_32 = 0.649 d (Tu^2 We)^(-0.657) | 1.5 to 2.2 d | [ESTIMATED] from [VERIFIED] wavelength; [VERIFIED] correlation | jets §3.5 |
| drag law | Schiller-Naumann, still air | | [RECALLED] | jets §3.7 |
| `spray.betaMaxCoef` spread factor | 0.61 (Re_n^2 Oh)^(1/6) | | [VERIFIED] | jets §6.6 |
| `spray.depRadius` clamp | 0.5 to 3 D_B | | [SYN] | this section |
| `spray.sag`, `spray.maxSegment`, `spray.maxSegments`, `spray.maxBounces` | 0.1 mm, 20 mm, 32, 3 | | [ESTIMATED] numerics | numerics §5.1; C §5.8 |
| `spray.smoothFloor`; window radii; group normal tolerance | 16 parcels; 1.5, 5, 15 blocks; 30 degrees | 8 to 64 | [SYN] (C §5.8, masked here) | this section |
| `spray.importanceGain` | 8 | 0 to 32 | [SYN] | this section |
| `spray.airField` | zero | | hook | section 11 |

**Conservation.** Integer and exact: emitted = deposited + returned to the sump + leaked + pack remainder + still airborne (zero at the end of Monte Carlo mode). The time-mean airborne volume V_air is reported to M4.

**Tests.**

| Test | Target | Tolerance |
|---|---|---|
| Terminal velocity of 0.16, 0.5, 2 mm drops | weight against Schiller-Naumann drag | 1 % |
| Trajectory with drag | f64 Runge-Kutta at 10 us | 0.2 mm over 0.5 m |
| Decelerations | 13, 32, 59, 320 m/s2 for the four cases of jets §3.7 | 5 % |
| Wall regimes | thresholds of the table at +/- 1 % of each boundary; the seven droplets of jets §6.1 | exact branch |
| Mass | ledger from source records to the packed table, and from live parcels to the deposit accumulators | exact, in integer units |
| Packing | a block with bins from 1 to 4 x 10^9 units: block total before and after | exact; remainder account below 2^shift |
| Saturation | a stalled jet as a drop train on one block | no wrap; the run fails only above the stated bound |
| Sampling error | variance proportional to 1/N on a patternator scene | slope -1 +/- 0.1 |
| Importance | the same scene with G = 0 and G = 8 | equal means within the split-half error; variance on the shadowed panel at least 4 times lower |
| Shuffle | parcels submitted in permuted order | identical hash |
| Smoothing mask | a plate with one face sprayed and one shadowed; a REV patch across a band boundary | smoothed flux on the shadowed face unchanged by the sprayed face; window block counts within 10 % of the flat-face counts |

**Cost.** 12 segment queries per parcel at the planning rate of 60 M/s (section 7.1): 180 s for 9 x 10^8 parcels per programme. Time-coupled parcels: about 3 x 10^9 segment queries, 50 s.

### M7. Film (`@spotless/sim-film`)

**Responsibility.** Water on surfaces between the fan limit and the moment it leaves as a droplet or reaches the sump: wetting, drainage, rivulets and beads, edges, gutters and drips, pools, gaps and bridges; the wetting parameters of every exposure; and the statistics that become the exposure records. Four solvers behind one contract.

```ts
interface SolvePlan { revolutions: readonly { label: 'settle' | 'transient' | 'steady'; count: number }[]; grid: 'block' | 'classD'; maxLevel: number }
interface WettingSummary { perFilmCell: GPUBuffer /* 2 x u8: soil cover in sixteenths, soil angle class; written by M8 */; hash: string }
interface WetParams { kParams: GPUBuffer /* 32 B per block */; sStatic: GPUBuffer /* 8 B per S cell */; liquor: LiquorProps; hash: string }
interface FilmState {                                   // complete state of the film stage on one grid; what pilot, K, S and drain-down hand to each other
  grid: 'block' | 'classD'; liquor: LiquorProps;
  kHot: GPUBuffer;                                      // KHot per block (all blocks: S-class blocks hold the restriction of their S cells)
  sFilm: GPUBuffer; sSlow: GPUBuffer;                   // per S film cell of the grid
  lines: GPUBuffer; reservoirs: GPUBuffer;              // LINE elements and drip-site stores; basin, gap and bridge stores
  parcels: GPUBuffer; parcelsLive: number;              // live time-coupled parcels (empty in a pilot state)
  accNext: GPUBuffer;                                   // deposits already written for the next base step
  baseStep: number; armPhases: Uint32Array;
}
interface FilmStage {
  wetParams(scene: Scene, liquor: LiquorProps, soil: WettingSummary, grid: 'block' | 'classD'): Promise<WetParams>;   // quantised inputs in, so the hash covers what the solver uses
  pilot(a: { scene: Scene; wet: WetParams; emitterMeans: GPUBuffer; dep: readonly DepositionTable[] /* pilot tables, one per arm */ }): Promise<PilotResult>;
  periodic(a: { scene: Scene; hp: HydraulicPoint; wet: WetParams; emitters: EmitterTable; dep: readonly DepositionTable[];
                spray: SprayStage['live']; init: FilmState; plan: SolvePlan }): Promise<PeriodicResult>;
  drainDown(a: { scene: Scene; wet: WetParams; init: FilmState; spray: SprayStage['live']; seconds: number }): Promise<DrainDownResult>;
  restrict(s: FilmState, to: 'block'): Promise<FilmState>;  prolong(s: FilmState, to: 'classD'): Promise<FilmState>;       // index shifts; mass conserved
}
interface PilotResult { steadyWet: GPUBuffer /* 1 bit per block */; hRes: GPUBuffer /* f16 um per block */; init: FilmState; summary: StateSummary }
interface PeriodicResult { records: Partial<Record<'transient' | 'steady', GPUBuffer>> /* FilmExposure per film cell */; onset: GPUBuffer /* f32 seconds per block */;
                           final: FilmState; summary: StateSummary }
interface DrainDownResult { record: GPUBuffer /* DrainDown per block */; final: FilmState }
interface StateSummary { vAir_m3: number; vFilm_m3: number; returnToSump_kg_s: number; basinInflow_kg_s: Float32Array; basinInflowJetShare: Float32Array;
                         dripRate_kg_s: Float32Array; epsGamma: number; epsWet: number; epsMass: number; perItemEpsWet: Float32Array;
                         converged: boolean; extensionRevolutions: number; cflRaises: number; frontHeldShare: number;
                         wetAssumptionMismatch: Float32Array; handoverClipped: Float32Array }
```

#### M7.1 The deposition interface and the base step

One mechanism serves every source of liquid (A §6.6): integer accumulators per film cell in units of 10^-12 kg and 10^-12 kg m/s, written with `atomicAdd`. An S cell has five i32 words {film mass, airborne mass, tangential momentum x 2, normal momentum}; a K block has two {film mass, airborne mass}. Film mass is liquid that arrives as a film (ring emitters, stitch and contact transfers, pool overflow, LINE outflow) and joins the film at once; airborne mass (parcels, Monte Carlo) goes to the bead store while the cell is not film-wet. The accumulators are double-buffered (M1): `current` is consumed by the apply and advance passes of a base step, `next` collects what the advance pass sends across stitches and contacts.

The base step (dt0, about 2 ms), official tier. Bytes are unique buffer traffic per element and execution, the quantity that bounds memory-bound kernels on the target machine (section 7.1).

| # | Pass | Kernel | Elements | Reads (bytes) | Writes (bytes) | Storage buffers bound |
|---|---|---|---|---|---|---|
| 0 | swap | `swapAccumulators`: `next` becomes `current`; the new `next` is cleared with `clearBuffer` | S cells; K blocks | | 20; 8 | |
| 1 | emit | `emit`: ring-emitter entries of the phase buckets each arm crosses in this step | entries due | 16 per entry | atomic adds to `current` (3 words) | entries, `current`, blockFilm |
| 2 | parcels | `parcel_step`, `parcel_resolve`: advance due live parcels by one segment; resolve impacts into `current`; spawn secondaries into slots reserved per parent; write level requests | live parcels due | 48 + scene | 48; atomic adds (at most 49 targets) | parcels, hits, scene (3), `current`, blockFilm, impactDuty |
| 3 | apply | `s_apply`: integer deposits to h, q, bead store and p_imp; Monte Carlo mass of the current bin of each arm's table; wet and dry transitions | S cells | `current` 20, SFilm 16, SSlow 8, SStatic 8, table bin 1 | SFilm 16, SSlow 8 | 6 |
| 4a | advance K | `k_step`: one implicit step; deposits and the Monte Carlo bin are read directly; outflow across stitch and contact links is added to `next` | K blocks | KHot 16, KParams 32, `current` 8, table bin 4 | KHot 16 | KHot in and out, KParams, `current`, `next`, table, links: 7 |
| 4b | advance S | `s_stage1`, `s_stage2`: for each level l in use, 2^l two-stage steps over the tiles of the items at that level; integer outflow across stitches and contacts is added to `next` and subtracted from the donor | S cells x 2^(l+1) | SFilm 16 (+ 16 of its own cell in the other buffer in stage 2), SStatic 8 | SFilm 16 | SFilm A and B, SStatic, patch rows, tiles and links, `next`: 6 |
| 5 | lines | `line_step`: LINE elements, drip sites, basin, gap and bridge stores; emission requests become live parcels in pass 2 of the next step | lines, sites, reservoirs | 16 | 16 | 5 |
| 6 | statistics | `s_stats`, `k_stats`: every second base step of recorded revolutions; a `bin_close` pass at the end of each phase bin of the master arm | film cells | state 16, stats 80 | stats 80 | 3 |
| 7 | monitors | `tile_monitor`: once per half phase bin, one invocation per 8 x 8 tile: largest wave rate, any-wet flag, non-finite word count, parcel slot high-water mark; read back once per phase bin | tiles | SFilm 16 per cell | 16 per tile | 3 |

Per S cell and base step that is 96 bytes outside the stage updates; a stage update moves 40 bytes (stage 1) or 56 bytes (stage 2). Per K block and base step: 84 bytes including the clear. About 140 dispatches per base step with five levels in use, encoded in command buffers of half a phase bin.

p_imp, the normal-momentum pressure of deposits (films §4.3), is written by `s_apply` into the state word of the cell (f16, Pa) and holds for the base step, so that neighbours read it with the stencil.

The Monte Carlo table of an arm stores, per block and phase bin of that arm, an integer number of mass units per revolution. A visit of the arm to a bin lasts n_b base steps (the CPU knows n_b for every visit); step k of the visit receives floor(V / n_b) units, plus one if k < V mod n_b, so every visit delivers the bin's content exactly.

#### M7.2 R0: steady routing, the pilot, and the pulsatility closure

The time-mean discharge satisfies a linear balance on the cell graph, Q_i = sum_j w_ji Q_j + A_i S_i - sinks, solved by 400 Jacobi sweeps (more than the longest path in blocks; C §6.8). For given deposition and link weights it is exact whatever the film dynamics.

**The pilot** (stage E) runs on the grid of the run, not on a coarser tier: sampling is reduced (2,048 phases, 7 sub-rays, 10^7 parcels), the elements are the official blocks. Inputs: `emitterMeans` of M5 (fan limits at h_res = 0) and the pilot deposition tables. Outputs, per block: the mean discharge; `steadyWet` (film-wet in the time mean: loading at or above Gamma*_r of the block, or airborne flux large enough to reach m_on within one revolution); h_res, the thickness a film of the mean loading drains to over the mean interval between jet passes (Jeffreys from the Nusselt thickness; 0 where not wet); the rain density on a 1 cm grid; the sparse-landing shares for the parcel plan. The initial `FilmState`: film mass at the equilibrium thickness of the mean loading, regimes from the loading against Gamma*_a and Gamma*_r, bead stores at their capacity b_max wherever airborne deposition arrives, lumped basins full, S cells prolonged from their block with q = q_eq along g_t, no parcels. The phase-resolved wall state that Monte Carlo needs is `steadyWet` combined with the jet-wet tables of M5; the pilot itself has no phase information.

**Pulsatility closure** (preview tier, and diverter states too short to march; [SYN] placeholder, refitted to cascade output at milestone MS2). R0 gives the mean loading Gamma_bar of a block. The film is taken to flow for a duty D and to rest otherwise:

```
D          = clamp( (Gamma_bar / Gamma_p)^n_p , D_min , 1 ),   Gamma_p = `film.pulseGamma` = 0.05 kg/(m s),  n_p = `film.pulseExp` = 0.5,
             D_min = the footprint duty of the jets that feed the block's catchment
gammaPeak  = Gamma_bar / D;   flowDuty = D;   hMean, tauMean, tauPeak from the Nusselt film of Gamma_bar / D;   wetDuty = 1 where steadyWet
```

#### M7.3 K: the kinematic cascade

State per block: film mass m_u (integer units of 10^-12 kg; h = m / (rho A)), outflow of the last step q_u (integer units), bead store b_u (integer units), dewetting step counter, regime (DRY, BEAD, RIVULET, FILM), wetted width fraction f.

```
mass       dm_i/dt = sum_j w_ji Q_j - Q_i + A_i (S_dep,i - S_evap,i) - Q_sep,i - Q_store,i                      [kg/s]
discharge  Q_i = rho W_i f_i q_eq( h_i / f_i ; g_s,i ),   g_s = g sin(beta)
           q_eq(h; g_s) = min( g_s h^3 / (3 nu) ,  h [ (2 g_s h / 0.288) (4 h / nu)^0.4 ]^0.625 )          [m2/s]
shear      tau_f,i = rho g_s,i h_i / f_i
step       a_u = m_u + sum_j share_ji(q_u,j) + film-mass deposits of `current`                                  integer
           airborne deposits of `current` and the Monte Carlo units of this step join a_u if the block is FILM or RIVULET, and b_u otherwise
           solve m + dt Q(m) = a for m in [0, a] in f32 (4 safeguarded Newton iterations, fixed count)
           m_u <- clamp( round(m / unit), 0, a_u );   q_u <- a_u - m_u
share      a donor with weights (w, 255 - w) gives floor(q_u w / 255) to receiver A and the rest to receiver B, in integers;
           in RIVULET the whole of q_u goes to the donor's chosen receiver (section 3.7)
```

q_eq is the steady flux of a film whose friction factor is max(24/Re, 0.288 Re^(-0.40)), Re = 4 q / nu (films §3.3); the branches cross at Re = 1,608. Outflow is implicit, inflow is the donors' outflow of the previous step. The step is unconditionally positive and stable, a cell never empties completely in one step, and mass is conserved exactly, in integers, whether or not Newton converges, because the discharge is defined as exactly what left (C §6.3). dt = dt0 (C tested 1.7 ms and 3.4 ms: means within 1 %, peaks within 7 to 20 %). An outflow below half a unit per step rounds to zero: at dt0 a film thinner than about 3 um on a 2 mm block stops draining, which is at the dry threshold delta_dry and immaterial; the drain-down, whose steps grow to 0.25 s, resolves films down to 0.3 um. Inside a patch the donors are found by index arithmetic from the donor mask; links to other patches are stitch deposits.

What the cascade drops (film inertia, the hydrostatic pressure gradient along the surface, capillary pressure) is supplied by: the analytic jet zone up to the fan limit; two-neighbour flow splitting and lumped pools and puddles; the regime machine below. This is the correct leading-order model for gravity drainage on steep, continuously wetting faces and it is exact for Jeffreys drainage, which is why it is the official solver for flat glazed ware and for every drain-down.

**Wetting parameters** per block and liquor class (films §5.4, §5.5, §12.4; C §6.4), built by `wetParams` from the shared functions of M2:

```
delta*_x  = [ 15 mu^2 sigma (1 - cos(theta_x)) / (rho^3 g_e^2) ]^(1/5),   x = a, r;   g_e = g max(sin(beta), 0.1)^n_beta     Hartley-Murgatroyd [VERIFIED]
Gamma*_x  = rho^2 g_e delta*_x^3 / (3 mu)
delta_wet, b_max, m_on                                                          as defined in M2
t_dw      = l_dw / V_dw,   V_dw = min( k_dw (sigma / mu) theta_r^3 ,  sqrt( sigma (1 - cos(theta_r)) / (rho h) ) )
```

theta_a, theta_r come from the material table of films §12.7 for the liquor class, mixed with the soil's angles by covered fraction as a Cassie average of cosines, plus the frozen offset field. The soil cover and angle class are those of the `WettingSummary`, already quantised (cover to sixteenths), so the solver uses exactly what the cache key hashes. With n_beta = 0 the thresholds do not depend on tilt, as the acrylic data require (rivulet-to-film transition at 0.125 to 0.21 kg/(m s) at 90 degrees and 0.108 to 0.174 at 5 degrees; C §6.4, accepted by J-phys). Reference values in wash liquor at 55 C (`checks.py`): Gamma* = 0.005, 0.011, 0.033, 0.066 kg/(m s) at angles of 5, 10, 25, 45 degrees; V_dw = 0.24, 1.9, 30 mm/s at 5, 10, 25 degrees (viscous branch).

**Regime machine.** Regime tests use Gamma_reg, the mean loading Q / W over the regime group of the block: its coarse parent, that is its three siblings and itself, which exists for every block of every patch by the nesting of section 3.2 (at the fast tier the block itself). The regime scale is a model constant, so the same stream is classified the same way at 2 mm and at 4 mm (J-num found C's test grid-dependent).

| From | To | Condition |
|---|---|---|
| DRY | BEAD | any airborne deposition (goes to b) |
| DRY, BEAD | FILM | film-mass deposit (jet hand-over), or b + m > m_on A (the smaller of spray wetting and the running-drop limit, M2); b joins m |
| DRY, BEAD | RIVULET | inflow from a wet donor while Gamma_reg < Gamma*_a |
| RIVULET | FILM | Gamma_reg >= Gamma*_a, or a film-mass deposit, or m / f > rho delta_wet A over the whole block |
| FILM | RIVULET | theta_r >= `film.thetaFilm` and Gamma_reg < Gamma*_r continuously for longer than t_dw (counted in base steps) |
| RIVULET | BEAD | no inflow and m / f below rho delta_dry A; the liquid moves to b up to b_max, the excess runs off |
| BEAD | DRY | b evaporated (drying only) |

This corrects C's machine, in which spray wetting only reached RIVULET, so mist-fed glass stayed at 5 to 20 % wetted width (J-phys). On glass and glaze in wash liquor (receding angle below `film.thetaFilm`) a block that has once become FILM stays FILM; on other materials a block fed only by mist cycles between BEAD, FILM and RIVULET as drops run and their tracks dewet. Wetted width fraction: f = 1 in FILM; in RIVULET f = max(f_min, f_1 (Gamma_reg / Gamma*_a)^(1/4)), anchored on the measured 0.1 to 0.2 below the transition (films §5.2 [VERIFIED band]; closure [ESTIMATED]). A soil cell is under flowing water when its block is in FILM, or in RIVULET with its coverage rank u < f (section 3.7).

#### M7.4 S: the inertial shallow-film solver

Governing equations: films §4.2 equations (1) to (4), per film cell with thickness h (m), flux q = h u (m2/s, two components in the cell frame), a wet flag, and a bead store b (m) kept in `SSlow`:

```
mass       dh/dt + div_s q = S_h
momentum   dq/dt + div_s( beta_m q (x) q / h ) = - h grad_s eta + S_cap - tau_w / rho + F_cl / rho + S_q
potential  eta = B + G_n h + p_imp / rho,   B = -g . x_s                                                        [m2/s2]
capillary  S_cap = (sigma h / rho) grad_s( kappa_sub + lap_s h )
friction   tau_w / rho = (1/2) f |u| u,   f = max( 24 / Re_loc , 0.288 Re_loc^(-0.40) ),   Re_loc = 4 |q| / nu
```

beta_m = 1.2 on both friction branches (D8). The film energy and scalar equations are not carried in the solver; temperature and composition are slow and are handled in M10 (A §6.1, C §6.11). On undersides (G_n < 0) the equations contain the Rayleigh-Taylor instability with the cut-off 2 pi sqrt(sigma / (rho |G_n|)), 12 to 17 mm, so pendant ridges form by themselves at 1 and 2 mm (films §4.2). On walls they also contain the long-wave instability of falling films: waves grow over a development length of the order of 0.1 m (films §3.2), so every film statistic of an S cell is a wave-averaged quantity.

**Why the gravity term needs care.** Gravity along the surface is the gradient of the bed potential B. If B is represented as a step between cell centres, as in hydrostatic reconstruction with a piecewise-constant bed, the step between 1 or 2 mm cells is Delta tan(beta), larger than the film on every slope steeper than 3 to 9 degrees; the downhill reconstructed depth is then zero and the drive collapses from g sin(beta) h to (1/2) G_n h^2 / Delta (for h = 170 um at 45 degrees on 2 mm cells: 4 % of the drive, a film 1.7 times too thick moving at a fifth of the Nusselt speed). The geometry here is analytic, so B and G_n are evaluated exactly at every cell centre and at the one point that two cells share on a face, and there is no bed step. What remains is to choose how a cell extrapolates its surface to its faces, and the two physical limits want opposite answers: a film follows the bed (h is smooth, eta falls with B), a pool is level (eta is smooth, h follows -B). The scheme blends the two by a regime weight that depends only on the cell's own depth and geometry.

**Scheme.** Finite volume on the structured cells of section 3, momentum in each cell's own frame, a 13-point stencil (the cell, its four face neighbours, their outer neighbours along each axis, and the four diagonals), one invocation writes one cell. For a cell c with centre values (h_c, u_c, B_c, G_c) and a face f with shared point values (B_f, G_f), length L_f, outward normal n_f (in the cell frame) and offset d_cf from the cell centre:

```
velocity        u = sqrt(2) h q / sqrt( h^4 + max(h^4, eps^4) ),  eps = 1 um
slopes          per direction, minmod of the two one-sided differences of h, of each component of u, and of eta_c = B_c + G_c h_c + p_imp,c / rho.
                At a band boundary the coarse cell differences against the mean of its two fine neighbours; a fine cell differences against the
                coarse row interpolated to its theta (3/4, 1/4). The pole cell uses the minmod of the differences to opposite ring neighbours along
                its four axes. A neighbour that is not solid (see contact line) enters the differences with h = 0, u = 0 and eta = B. Towards a
                stitch or a patch end the missing one-sided difference is replaced by the other one for eta and by zero for h and u.
face depth      h_cf = max( 0, h_c + s_h . d_cf );    u_cf = u_c + s_u . d_cf
regime weight   w_c = smoothstep( G_c h_c / DB_c ; w_lo, w_hi ) if G_c > 0, else 0;   DB_c = max over faces of 2 |B_f - B_c|
                (depth over the bed-potential range of the cell; w_lo = `film.lakeLo` = 0.25, w_hi = `film.lakeHi` = 0.75)
face potential  etaHat_cf = (1 - w_c) ( B_f + G_f h_cf + p_imp,c / rho )  +  w_c ( eta_c + s_eta . d_cf )
                film form (w = 0): the surface follows the bed.  lake form (w = 1): the surface is the limited reconstruction of eta
face bed        b_cf = etaHat_cf - G_f h_cf - p_imp,c / rho;   a neighbour that is not solid (see contact line) presents b = B_f
hydrostatic     if G_f > 0:  b* = max(b_Lf, b_Rf);  h*_side = max( 0, h_side,f - (b* - b_side,f) / G_f );   else h*_side = h_side,f
reconstruction
flux            F = HLL( (h*_L, u_L), (h*_R, u_R) ) for mass and both momentum components, with pressure P(h) = (1/2) G_f h^2 in the normal momentum flux
wave speeds     s = beta_m u_n -/+ sqrt( beta_m (beta_m - 1) u_n^2 + c^2 ),   c^2 = max(G_f, 0) h* + 4 sigma h* / (rho Delta^2)
positivity      |F^h_f| L_f dt <= m_donor w_f,   w_f = L_f (max(u . n_f, 0) + c) / sum over the donor's faces of the same     (donor-local cap, B §6.2)
update          h_c <- h_c - (dt / A_c) sum_f F^h_f L_f
                q_c <- q_c - (dt / A_c) sum_f R_cf [ F^q_f - (1/2) G_f (h*_cf)^2 n_f ] L_f                       flux minus the cell's own starred pressure
                           - (dt / A_c) sum_f (1/2)( h_cf + h_c )( etaHat_cf - eta_c ) n_f L_f                   potential term, own reconstruction only
                           + dt ( S_cap + F_cl / rho )
                q_c <- q_c / ( 1 + dt f |u| / (2 h) )                                                            pointwise-implicit friction
capillary       S_cap: 5-point Laplacian of h with |grad_s h| clamped to 0.5 near contact lines, two-point face gradients of (kappa_sub + lap_s h);
                applied at every thickness, on solid cells
time stepping   two-stage SSP Runge-Kutta:  U1 = FE(U^n),  U^(n+1) = (1/2) U^n + (1/2) FE(U1);   CFL 0.3
buffers         two state buffers. Stage 1 reads A and writes B; stage 2 reads B (stencil) and A (own cell only) and writes A in place.
```

Properties, each a test of M7.11 and each reproduced in one dimension by the reference script `s1d.py` (which has no capillary term):

- **Gravity drive.** For a uniform film, etaHat_cf - eta_c = B_f - B_c on every face in film form, the flux term has no jump, and the potential term is -h_c times the Green-Gauss gradient of B over the cell: exactly h g_t, with or without slopes and whatever the ratio of bed step to depth. In lake form with second-order slopes the same holds because s_eta equals the bed slope. A steady film on an incline is an exact steady state of the discrete equations: the reference reproduces the Nusselt thickness and flux to 10^-4 at 5, 10, 45 and 80 degrees, on 1 and 2 mm cells, at 0.005 to 0.2 kg/(m s), with bed steps from 0.1 to 119 film thicknesses, from smooth and from rough starts.
- **Lake at rest.** If eta is uniform over a set of cells in lake form and u = 0, then etaHat_cf = eta_c on every face, so the potential term vanishes; b_cf = eta - G_f h_cf on both sides of a face, so h*_L = h*_R = (eta - b*) / G_f, the mass flux is zero and the momentum flux equals each cell's own starred pressure; and uniform p exerts no force by the closure identity of section 3.2. The state is preserved to round-off, on curved beds and across band boundaries and the pole (reference: 10^-16 m/s after 20,000 steps on a submerged circular trough). Cells at a shoreline are shallower than their bed range, are in film or blended form, and are not exactly at rest: where the receding angle is at or below 5 degrees the two cells at each shoreline of a 3 mm puddle keep a residual current of at most 15 mm/s and 0.1 Pa (reference), which is below the lowest film-shear level of 0.5 Pa; at larger receding angles the edge retracts to its equilibrium depth and the puddle is then exactly at rest.
- **No double counting.** The bed enters once, through B. There is no separate gravity source, so gentle slopes are not driven twice.
- **Undersides** (G_f <= 0) use the same expressions: w = 0, no hydrostatic reconstruction, and the pressure (1/2) G_f h^2 in the flux has the destabilising sign; the wave speeds contain only the capillary celerity.
- The capillary term is kept on thick liquid (ridges, pendant drops); numerics and B switch it off above 0.3 to 0.5 mm, which removes the short-wave cut-off exactly where it is needed (J-phys, J-num). On quadrilaterals the 5-point Laplacian and its two-point gradient converge at second order (J-num's check).
- Single-stage MUSCL at CFL 0.4 (A) is outside the proven region and first-order Godunov (B) is too diffusive for contact lines; both are rejected.

**Contact line** (films §12.4 and §5.5, in a form that needs no information outside the stencil). Every decision is made from start-of-stage cell-centre states and static data, so the two cells of a face compute the same number. A face between a wet cell c and a dry cell d is a **front face**. With n pointing from c to d and Delta the cell width normal to the face:

```
thrust        T_cf = rho [ (1/2) max(G_c, 0) h_c^2 + beta_m h_c ( (u_c . n)+ )^2 + h_c (A_c / L_f) ( g_t,c . n )+ ]        [N/m]
              (hydrostatic head, momentum flux and weight of the front cell along n)
resistances   R_a = beta_cl sigma ( 1 - cos(theta_a,d + xi_d) ),   R_r = beta_cl sigma ( 1 - cos(theta_r,c + xi_c) )       [N/m]
              beta_cl = beta_cl0(Delta) clamp(sin(beta), 0.05, 1)^n_cl
retracting    a wet cell is retracting if it has a front face with T_cf < R_r;  a wet cell that is not retracting is solid
```

| Face | Mass and momentum flux |
|---|---|
| solid, solid | the regular flux above |
| solid c, dry or retracting x | advance: phi_cf HLL( (h*_c, u_c), (0, 0) ), phi_cf = clamp( (T_cf - R_a) / T_cf, 0, 1 ), with R_a from the angles of x. Pinned (phi = 0) while T <= R_a |
| retracting r, solid s | the retracting cell's own outflow h_r ( (u_r . n)+ + V_ret ), V_ret = V_dw (1 - T_rf / R_r), V_dw = min( k_dw (sigma / mu) theta_r^3, sqrt( sigma (1 - cos theta_r) / (rho h_r) ) ); nothing flows back except by the advance rule |
| retracting, retracting or dry; dry, dry | none |

Momentum: a solid cell at a front face loses outward momentum to F_cl = min(F_hold+, R_a / Delta) along the inward normal, where F_hold is the force per unit area that would cancel the outward normal momentum it has after all other terms of the stage (own-cell quantities only); it gets the potential term of a front, etaHat_cf = min(B_f, eta_c) with h_cf = 0, which is the hydrostatic thrust on the line. A retracting cell moves in film form under gravity and friction with no contact-line force: its retraction is the kinematic sweep V_ret, which is the viscous dewetting speed of films §5.5 (0.2 to 30 mm/s for receding angles of 5 to 25 degrees) or the inertial speed, whichever is lower, and gravity drainage away from an upper contact line is not hindered.

- Because the flux across a front face is a function of the donor's start-of-stage state and of static data, the dry cell books exactly what the wet cell subtracts, a pinned line passes nothing, and a film at rest does not creep at the numerical wave speed.
- A front on a dry wall builds a ridge whose section is of the order l_c^2 (1 - cos theta_a) before it moves (reference: 0.7 to 2.2 mm2 at theta_a = 45 degrees against 1.2 mm2), and then travels at the film speed. A puddle spreads until its edge thrust falls to R_a and contracts until it rises to R_r, that is to edge heights of the order 2 l_c sin(theta / 2).
- Tilt law: Meredith needed beta = 1.0 at 45 and 90 degrees and 0.4 at 5 degrees (films §5.2 [VERIFIED]); n_cl = 0.376 reproduces 0.40, 0.88 and 1.00 (`checks.py`). A single fitted beta_cl cannot pass both acrylic windows (J-phys, J-del).
- Resolution: beta_cl0 is a table with one entry per film cell size (4, 2, 1, 0.5 mm), calibrated by gate P2; the published spread 0.085 to 1.0 (numerics §2.2e) shows it is grid-dependent (J-num).
- xi is the frozen offset field of M3. At a convex edge bounding an upward face theta_a is raised to min(theta_a + 180 degrees - wedge angle, 175 degrees) (pinned-edge rule, films §12.5), which is what holds puddles on flat tops.

**Wetting and drying** (films §12.4). The wet flag is part of the cell state and every stage updates it from the h it writes: set when h exceeds the onset thickness delta_on = m_on / rho of M2 (stored per cell in `SStatic`), cleared when h falls below delta_dry unless theta_r < `film.thetaFilm`. A front can therefore advance one cell per stage, which at every level is faster than the Courant limit allows the liquid to move. The bead store is handled once per base step, in `s_apply`: airborne deposits into a cell that is not wet go to b, film-mass deposits go to h; when h + b exceeds delta_on, b joins h; the liquid left in a cell that has dried moves to b.

**Why the step is positive and conservative in one pass.** A face's mass flux is computed by the same function from the two cells' start-of-stage states, including the front and retraction rules, so both cells apply the same number (conservation to round-off; not asserted bitwise, because two call sites may be compiled differently, J-del). The positivity cap depends only on the donor's own state and geometry, which lie inside the receiver's stencil, so no second pass is needed. Summing the cap over the donor's faces gives total outflow <= m_donor, so each forward-Euler stage keeps h >= 0, and the SSP combination is a convex combination of such stages. Local time stepping is per item only; items exchange nothing through fluxes, so there are no level interfaces. A property test (random wet, dry and retracting states with random fronts, 10^6 steps: no negative mass, every face flux tallied by both of its cells, ledger within the float tolerance of M7.10) is required before any physics is tuned (J-num).

**Time-step levels** (A §6.5, corrected). Each item runs at dt0 / 2^l, l = 0..l_max; all items synchronise every base step. l_max is a tier parameter: 5 at the official and fast tiers (2 ms to 62.5 us), 8 at the reference tier.

```
l = clamp( ceil( log2( dt0 lambda / 0.3 ) ), 0, l_max ),   lambda = max over the item's cells of ( |u| + c ) / Delta        (films §12.6 item 4)
```

| Situation (`levels.py`, `closures2.py`) | 1 mm cells | 2 mm cells |
|---|---|---|
| quiet draining film (0.05 m/s, 50 um) | l = 0 (2 ms) | 0 |
| ordinary wet film (0.4 m/s, 0.2 mm) | 2 (0.5 ms) | 1 (1 ms) |
| ring emitter at R_j (0.7 m/s) | 3 (0.25 ms) | 2 |
| largest hand-over speed, U_cap = 2.2 m/s | 4 (0.125 ms; resolves 2.3 m/s) | 3 (0.25 ms; resolves 2.3 m/s) |
| 3 mm ridge | 3 | 1 |

The level of an item for a phase bin is fixed before the bin is encoded and is the maximum of: (i) the levels in the `levelByPhase` tables of the active arms for the phase bins of each arm that the coming master bin overlaps (M5: from 4 ms before an emitter lands on the item until 60 ms after); (ii) the level requests of live parcels read at the end of the previous bin, held for 60 ms after their deposit (M6); (iii) the default for its cell size while it holds flowing film (2 at 1 mm, 1 at 2 mm), or 0 when the last monitor read shows |u| < 0.1 m/s and h < 100 um everywhere; (iv) the level implied by the last monitor read. An item is skipped only while it is completely dry with no beads and nothing scheduled. There is no "dormant" class (A's budget assumed 60 % of the unsprayed rack dormant, which its own rule does not allow; J-num, J-del). Because of the hand-over cap, sources (i) and (ii) never ask for more than level 4 on 1 mm cells and level 3 on 2 mm cells, and level 5 is headroom for what the film does by itself. A monitor raise takes effect one phase bin later (27 to 37 ms); such raises are counted (`cflRaises`), and the positivity cap with implicit friction keeps an under-resolved step bounded. With beta_m = 1.2 the fastest characteristic is 1.69 |u| + c, so the Courant number on that wave is 0.3 to 0.51; `film.cfl` (0.3, range 0.2 to 0.3) is a tier parameter and the half-step comparison of M7.11 is the check. Exit criterion of milestone MS3: on the golden loads no monitored lambda dt above 0.45 and no item clamped at l_max.

**Pendant drops.** On undersides a bulge higher than k_pd sqrt(sigma / (rho |G_n|)), k_pd = 2.2, is cut off and emitted as a drop of diameter 3.3 sqrt(sigma / (rho |G_n|)) (films §12.5 [RECALLED]). The cascade uses the Brun rule instead: thickness above h* = 3 l_c cos(alpha) / (1.62208 sin^(3/2)(alpha)) (alpha from vertical; films §3.5 [VERIFIED] for thin films of a viscous oil) leaves as drops of 3.3 l_c from sites spaced 2 pi sqrt(2) l_c. h* grows continuously with tilt, so no angle threshold is needed.

#### M7.5 Edges, gutters, lines, drips

- **Inertial separation at a convex edge** (one rule, a shared function of M2, used by both film solvers and by the fan sectors of M5; films §12.5):

```
We_e = rho (u . t)^2 h / sigma_s;     We_c = max( We_floor, C_tp (r_e / h)(1 + cos(theta_a)) ),   We_floor = 2
separated fraction   phi_sep = clamp( a_0 - a_1 exp( -(We_e / We_c) / a_2 ), 0, 1 ) if We_e > We_c, else 0;   a_0, a_1, a_2 = 0.882, 1.908, 1.264
```

  r_e is the edge radius: 1 / |kappa_s| of the row for a rim or a convex fold, the seam radius for a polytope edge. sigma_s is the surface tension of the surface-age class of the caller: gamma_w times `jets.gammaFactor` at the end of a fan sector, the liquor's sigma in the film solvers. The separated fraction of the flux leaves as a sheet (live parcels, or source records from M5, of mass-median diameter k_sd h with the film's velocity); the rest continues round the edge. The floor We = 2 is the Taylor-Culick criterion that jets §7.3 uses alone; with r_e in the rule, time-mean gravity films (We under 1) always cling, a fast film clings round a rounded plate rim and separates at a sharp one. The curve is Zhang et al.'s fit applied to We_e / We_c, an adaptation tagged [ESTIMATED] in films §12.5; its three constants are registry keys.
- **Gutters.** Rim apex rows, lower edges, gutter seams and tips carry LINE elements. A film cell in a gutter row hands the fraction w_g = smoothstep(min(c_a, c_b); 0, 0.2) of its discharge towards the edge to the gutter, where c_a and c_b are the components of g_t / g towards the edge on the two adjoining faces: the edge is a lower edge when both are positive. The blend replaces a yes-or-no classification.
- **LINE model** (A §6.7): d(lambda)/dt + d(lambda u_l)/dl = sources - drips, with lambda the liquid per unit length (kg/m), u_l = g_l (lambda / rho) / (k_w nu), g_l the gravity component along the line. It is advanced with the cascade's implicit-outflow step in integer mass units. Rack wires are LINE elements; water landing on a wire runs to low points and junctions.
- **Drip sites**: local minima of height along each line, junctions, free tips, and points every lambda_d = 2 pi sqrt(2) l_c (offset seeded by the sim seed) along stretches within 5 degrees of horizontal (23 mm in water at 55 C, 17 mm at 35 mN/m; films §6.4 [VERIFIED]). Each site holds m_e and releases (films §12.5):

```
drop mode    when m_e >= m_d, one drop at rest:  broad wetted edge m_d = rho (pi/6)(3.3 l_c)^3;  tip of wetted perimeter P: m_d = k_T sigma P / g,  k_T = 0.65
column mode  site loading above Gamma_c = 0.048 mu Ga^0.301: a continuous stream at the line velocity
sheet mode   above Gamma_s = 0.72 mu Ga^0.236,   Ga = rho sigma^3 / (mu^4 g)
```

  Thresholds are the Hu-Jacobi transitions with Gamma per side (the factor of 2 is unresolved in films §6.4; flagged). After the supply stops each site keeps one last drop. In periodic solves a site emits the expected mass of each phase bin as one parcel with the drop's diameter, so the time-mean deposition below a slow dripper converges in two revolutions; drain-down solves emit discrete drops, because there the number of last drops is the result (C §7.2).
- **Contacts.** Each contact link holds a bridge of `film.bridgeVolume` that fills from either side and does not drain. The fraction xi_c of the discharge reaching a contact block, and of the line flux at a wire-to-item contact, transfers to the lower body.

#### M7.6 Pools, puddles, gaps

- **Basins** (M3 analysis). A basin whose depth at its spill level exceeds `film.poolDepth` is a lumped reservoir: blocks below the level are frozen and report "immersed"; discharge, parcels and jet hand-over arriving in them go to the basin store; overflow enters the `next` accumulators of the spill block. Shallower basins stay in the S solver on S-class items (the lake form holds them at rest); on cascade patches every basin is lumped. **In every periodic solve and in the trace the lumped basins are full**: the rays strike the dry geometry, the film solver takes the level at the spill level, and the record reports the inflow of each basin and the share of it that arrived as jet hand-over or as a parcel faster than 2 m/s (`basinInflowJetShare`), from which the timeline chooses the mixing efficiency. The fill transient, the real level, the immersed share of every block and the attenuation of jets by the water above a block are the timeline's (M10, M8). The retained volume of a tilted foot recess is geometry, not numerics.
- **Flat upward regions on cascade patches** hold a puddle up to h_e = 2 l_c sin((theta_a + 180 degrees - edge angle) / 2) at their bounding convex edge (films §7.2 [ESTIMATED]); the head the lower edge holds back shrinks continuously with tilt, as in the basin analysis.
- **Gap reservoirs.** Connected blocks with gap below 2 l_c of the current liquor that lie within the capillary rise height 2 sigma cos(theta) / (rho g w) above a contact or low point (34, 13, 7 mm at 0.2, 0.5, 1 mm; standards P40) form a reservoir that fills from either surface and does not drain. Its blocks report "immersed, zero shear" and exchange liquor with the passing film through eta_gap. Blocks with gap below `film.gapNoFlow` = 0.4 mm carry no film flow.

#### M7.7 Driver, convergence, drain-down

Per liquor class and pump class, for each of the two diverter states X:

```
steady      start from the pilot state of X; 2 settle revolutions (discarded); 2 steady revolutions (recorded) -> steady FilmExposure[X], final state F[X]
drain-down  K for 60 s from F[X] with all sources off -> DrainDown[X]
transient   (main-wash class only) start from F[X'], the periodic state of the other diverter state X'; 2 revolutions of the forcing of X (recorded)
            -> transient FilmExposure[X]: the real switch transient, with the other rack still draining
```

28 master revolutions per programme with three liquor classes (8 + 12 + 8), 56 simulated seconds, 28,928 base steps of which 16,384 are recorded. Outside the main-wash class the transient record of a state is its steady record (flagged). The steady record of a state must not start from the other state's periodic state: revolutions 3 and 4 after a switch (t = 4 to 9.6 s) still hold the draining remnant of the rack that was just sprayed, and a record taken then would apply it for the remaining 50 s of every dwell (on a vertical plate 100 mm below its top edge: 28 to 31 um against a true dwell mean of 14 um, a factor of 9 in flux). Started from its own pilot state, the steady record of X contains only what X itself puts on the unsprayed rack; the remnant of X' reaches the timeline through DrainDown[X'] and the merge rule of M10, and the first two revolutions of a main-wash dwell through the transient record.

Convergence monitors per state, between the two recorded steady revolutions (C §7.2):

```
eps_Gamma = || Gamma_mean(rev 2) - Gamma_mean(rev 1) ||_2 / || Gamma_mean(rev 2) ||_2        (area-weighted over item cells)        target 5 %
eps_wet   = area fraction of item cells whose wet duty changed by more than 0.1, per item and overall                             target 2 %
eps_mass  = | nozzle outflow - (change of all stores + airborne + returned to the sump) | / nozzle outflow, per revolution          target 0.1 %
```

Each film cell keeps a snapshot of its sums after the first recorded revolution (M7.8), so the monitors are differences of statistics, reduced per item by the segmented reduction of M1. If a target is missed the state gets up to two more revolutions (the statistics then cover the last two), as long as the run has extension revolutions left: a run may spend 4 in total, counted in programme order (a bounded reserve, decided from simulated values only). If a state still fails, or the allowance is spent, the run completes and the report names the state and the items (`hydroUnconverged`). eps_wet per item is the convergence statement for the wetting map that J-phys found missing from all three proposals.

**Drain-down** (C §6.3, §6.10). The final periodic state is restricted to blocks (S cells: m = rho A times the mean h, in integer units; regime FILM if at least three of the four sub-cells, or the block's one cell, are wet, RIVULET with f = n_wet / 4 otherwise) and advanced with K for 60 s with all sources off, on the schedule dt_k = dt0 x 2^floor(k / 512) capped at 0.25 s (3,129 steps). A draining film has wave speed s / t, so a step growing in proportion to t keeps the Courant number constant; against Jeffreys' law on a 0.25 m vertical plate the thickness at 2, 10 and 60 s is 3 to 9 % high (C's measurement, to be reproduced as a test). Discrete last drops are traced onto whatever is below. The record holds h at 2, 10 and 60 s, the dewetting time and the end state (section 5.3). It supplies the wetness of surfaces during the other diverter state and during pauses, the carry-over volume at each drain, late drips (P23) and the initial condition for drying.

#### M7.8 Buffers

Every field has a registered role (M1). State and accumulators are f32, u32 or i32.

| Buffer | Bytes | Fields |
|---|---|---|
| `SFilm` (per S film cell, two copies) | 16 | h f32; q1 f32; q2 f32; word u32 {p_imp f16 in Pa, constant during a base step; flags u16: wet, immersed, seam, gutter row, edge-pin code} |
| `SSlow` (per S film cell; read and written by `s_apply` only) | 8 | bead store b f32 (m); spare u32 |
| `SStatic` (per S film cell; rebuilt by `wetParams` at every exposure) | 8 | 1 - cos(theta_a + xi) and 1 - cos(theta_r + xi) with the soil mix (2 x u16, unit 2 / 65,535); gap u8; onset thickness delta_on (log u8, 1 um to 1 mm); gutter or link element u16 |
| `KHot` (per block, two copies) | 16 | m_u u32; q_u u32; b_u u32 (all 10^-12 kg); dewetting counter u16 (base steps, counter with bound 65,535 = 128 s, saturating); regime u8; f u8 / 255 (statistic, recomputed every step) |
| `KParams` (per block; rebuilt by `wetParams`) | 32 | area f32; W f16; g_s f16; donor mask u8; flags u8 (chosen receiver, gutter, pit, drip site); donor weights 8 x u8; Gamma*_a, Gamma*_r, m_on, b_max, delta_wet (5 x f16); t_dw in base steps u16; spare u16 |
| deposit accumulators (current and next) | 20 per S cell; 8 per K block | i32 words as in M7.1 |
| `FilmStats` (per film cell, recorded revolutions) | 80 | below |

`FilmStats`. Sampled every `film.statStride` = 2 base steps, at the end of the step, so a sample is 4 ms and counts are numbers of samples. Sums are f32 (roles: state); peaks and snapshots of counters are statistics; counters are u16 with the registered bound of 6 recorded revolutions x 1,216 steps / 2 = 3,648.

| Offset | Field | Type | Meaning |
|---|---|---|---|
| 0 | sumGamma, sumH, sumTau, sumM | 4 x f32 | sums of mass flow per width leaving the cell; of h, tau and M over flowing samples |
| 16 | sumDep, sumBead, sumWidth | 3 x f32 | deposited airborne mass; b / b_max over samples that are not film-wet; wetted width fraction over wet samples (1 for S) |
| 28 | binGamma, binTau, binM | 3 x f32 | sums within the current phase bin of the master arm; `bin_close` turns them into bin means, updates the peaks and zeroes them |
| 40 | snapGamma | f32 | sumGamma after the first recorded revolution |
| 44 | peakGamma, peakTau, peakM, tauMaxSample | 4 x f16 | largest bin means; largest single sample of tau |
| 52 | nFlow, nWet, nImm, nBin | 4 x u16 | samples with h above the flow threshold, film-wet, immersed; samples in the current bin |
| 60 | nTau[5] | 5 x u16 | samples with film shear above 0.5, 1, 2, 4 and 10 Pa |
| 70 | dryRun, dryMax, snapWet | 3 x u16 | current and longest run of samples that are not wet; nWet after the first recorded revolution |
| 76 | spare | u32 | |

The exposure writer turns `FilmStats` into `FilmExposure` (section 5.2): means are sums over counts; `renew` and `srcSplit` use the static emitter and Monte Carlo mean fluxes of the block together with sumDep and sumGamma; `spread` and eps_wet use the snapshots.

#### M7.9 Parameters

| Key | Default | Range | Tag | Source |
|---|---|---|---|---|
| contact angles theta_a / theta_r per material and liquor class | table of films §12.7 | receding angle +/- 20 degrees on plastics and steel | [ESTIMATED, anchored]; bracket G3 | films §12.7 |
| `film.sigma` per class W / D / R | 60 / 40 / 45 mN/m | 30 to 65 | [ESTIMATED] | films §12.8 |
| `film.betaM` | 1.2 on both friction branches | 1.016 to 1.2 on the turbulent branch | [SYN] (dossier: 1.016 turbulent) | D8; films §3.3 |
| `film.lakeLo`, `film.lakeHi` regime weight of the surface reconstruction | 0.25, 0.75 | 0.1 to 1; 0.5 to 3 | [SYN] numerics (`s1d.py`) | M7.4 |
| `film.betaCl0(Delta)` | 1.0 at every cell size until calibrated | 0.4 to 1.0 | [VERIFIED] for 3.8 mm cells | films §5.2, §12.7 |
| `film.nCl` tilt exponent | 0.376 | 0 to 0.5 | [SYN] from [VERIFIED] values | this section |
| `film.thetaSigma`, correlation length | 8 degrees, 2 mm | 5 to 10 degrees | [ESTIMATED] | films §12.4 |
| `film.kappaW`; `film.nBeta` | 0.5; 0 | 0.3 to 1; 0 or 1 | [VERIFIED] practice; [SYN] from [VERIFIED] acrylic data | films §12.4, §12.10; M2 |
| `film.deltaDry`; `film.flowThreshold` | 2 um; 30 um | 1 to 10; 10 to 50 | [ESTIMATED]; [SYN] | films §12.4; section 5.2 |
| `film.thetaFilm` receding angle below which a film never breaks | 5 degrees | 3 to 8 | [ESTIMATED] | films §12.4 |
| `film.Cb` bead capacity factor | 0.03 | 0.01 to 0.06 | [ESTIMATED] | films §12.4 |
| `film.kDw` viscous dewetting constant | 5 x 10^-3 | 4 to 6 x 10^-3 | [RECALLED] | films §5.5 |
| `film.lDw` dewetting length (K) | 10 mm | 3 to 30 | [SYN]; the dossier's table uses 10 mm as an illustration, not a measurement | films §5.5; C §6.4 |
| `film.f1`, `film.fMin` rivulet width closure (K) | 0.2, 0.05 | 0.1 to 0.3; 0.02 to 0.1 | [ESTIMATED] on a [VERIFIED] band | films §5.2; C §6.4 |
| `film.handoverCap` | 2.2 m/s (official, fast); none (reference) | 1 to 5 | [SYN] numerics | M5, M7.4 |
| `film.maxLevel`; `film.cfl`; `film.statStride` | 5 (8 reference); 0.3; 2 | | [SYN] | M7.4, M7.8 |
| `film.pulseGamma`, `film.pulseExp` | 0.05 kg/(m s), 0.5 | | [SYN] placeholder | M7.2 |
| `film.Ctp` teapot factor; `film.WeFloor` | 1; 2 | 0.5 to 3; 1 to 4 | [VERIFIED] scaling, prefactor uncertain; bracket G4 | films §12.5; jets §7.2 |
| `film.sep.a0`, `a1`, `a2` partial-separation curve | 0.882, 1.908, 1.264 | | [ESTIMATED] (an adaptation of Zhang et al.) | films §12.5 |
| `film.dropFactor`, `film.dripSpacing` | 3.3 l_c; 2 pi sqrt(2) l_c | 3.0 to 3.3; 2 pi to 2 pi sqrt(3) | [VERIFIED] | films §6.4 |
| `film.tateFactor`; `film.pendantCut` | 0.65; 2.2 | 0.5 to 0.8; 2 to 2.4 | [RECALLED] | films §6.4, §12.5 |
| `film.kW` line friction factor | 25 | 10 to 50 | [SYN] (A §6.7) | Poiseuille-like rivulet |
| `film.poolDepth`; `film.gapNoFlow` | 3 mm; 0.4 mm | 2 to 5; 0.2 to 1 | [ESTIMATED]; [SYN] | films §7.1; M7.6 |
| `film.bridgeVolume` | 20 uL | 5 to 50 | [ESTIMATED] | films §12.5 |
| `film.xiC` contact transfer fraction | 0.5 | 0 to 1 | [SYN]; bracket G4 | A §6.9, C §6.7 |
| `film.etaGap` gap exchange | 0.02 | 0 to 0.1 | [SYN] (A used 0.1, B 0.02, C 0) | no data; standards P04, P15 |
| `film.etaMix` pool mixing | 0.9 jet-fed, 0.5 through-flow, 0.1 short-circuit | 0.05 to 1 | [ESTIMATED] | films §7.3 |

#### M7.10 Conservation

- The cascade, the LINE model and every reservoir carry mass in integer units; their ledger, including stitch and contact transfers, bead, bridge, gap and pool stores, is exact.
- Every transfer between modules and between patches (emitters, parcels, Monte Carlo units, stitches, contacts, lines, pools, sump) is an integer number of 10^-12 kg units; the integer ledger is asserted exactly (B §6.11, restricted to transfers).
- Inside an S patch mass is f32 in flux form. A flux-form f32 update is not exactly conservative over many steps: when a thin cell feeds a thick one the receiver rounds the increment and the donor does not (3 x 10^-5 relative after 10^5 steps in a film-into-pocket test). Per item and per solve the check is | change of S film mass - (integer inflow - integer outflow) | <= 5 x 10^-4 of the item's largest film mass, warn at 10^-4; the residual is booked to the ledger account `sFloat` so that the global ledger still closes.
- Per revolution and per state: nozzle outflow = change of all stores + airborne + returned to the sump, tolerance 0.1 %; above 1 % the run fails.
- Momentum is conserved in flux form inside S up to the potential term; the cascade conserves none by construction.

#### M7.11 Tests

| Solver | Test | Target | Tolerance |
|---|---|---|---|
| S | **first test, before MS0 benchmark 1 fixes the cost of the kernel**: steady film at 10, 45 and 80 degrees, 0.005 to 0.2 kg/(m s), on a cone patch across a band boundary, across the pole of a tilted disc, and across a stitch between two CART patches | Nusselt thickness and flux, time mean over one base step, at least 4 cells from the stitch | 2 % (10 % in the receiving cell of the stitch) |
| K, S | steady film on a 0.1 m incline with a steady inlet (shorter than the development length of waves) | Nusselt thickness, velocity, shear (films §12.10) | 2 % |
| S | waves: periodic vertical strip, 200 um film, 1 % perturbation, 4 s | perturbation grows (the instability is in the equations); wave-averaged thickness 0.8 to 1.0 of Nusselt and crest shear 2 to 3 times the mean (films §3.2, §3.4 [RECALLED]); wave-averaged values on 2, 1 and 0.5 mm cells | reported; grid spread of the wave average 10 % |
| K, S | drainage of a plate | Jeffreys h = sqrt(mu s / (rho g sin(beta) t)) at 2, 10, 60 s | K 10 %; S 5 % after 1 s |
| K, S | pulsed supply on a vertical plate, mean 0.02 and 0.03 kg/(m s) | each other and a 0.25 mm reference: time-mean (wave-averaged) h and tau | means 10 %, peaks 30 % |
| S | **pulsed grid convergence** (gate for any change of `film.betaM`) | time-mean h at 0.24 m on 2, 1 and 0.5 mm cells, forcing period 80 and 200 ms | within 5 % of each other |
| S | lake at rest, fully submerged, in a tilted bowl (REV patch with pole and band boundaries), 10^5 steps | zero velocity; uniform level | round-off |
| S | puddle with shorelines in the same bowl, receding angles 0, 5, 15, 25 and 60 degrees | interior at rest; shoreline cells: velocity below 15 mm/s and wall shear below 0.1 Pa; after retraction the edge depth within one cell's bed range of 2 l_c sin(theta_r / 2); volume conserved | as stated |
| S | flow across the pole and across band boundaries, with the momentum equation and the capillary term | same problem on a CART patch | thickness within 3 % |
| S | grid-rotation invariance: tilted-disc drainage with the item rotated 7 degrees about its axis | drained-mass history | 1 % |
| S | positivity and conservation property test with random fronts and retracting cells | no negative mass; each face flux tallied identically by its two cells; float drift | exact; 10^-12 relative per face; 10^-4 per 10^5 steps |
| S | local time stepping against a global smallest step | wet fraction, mean shear | 1 % |
| S | underside dripping | drips at h = 0.52 l_c, 81 degrees from vertical; none at 0.55 l_c, 60.5 degrees (films §3.5 [VERIFIED]) | both outcomes |
| S | advancing front on a dry incline, theta_a = 45 and 5 degrees | front speed equals the film speed after the ridge has formed; ridge section l_c^2 (1 - cos theta_a) | 10 %; factor 2 |
| S | puddle height; drop on an incline | 2 l_c sin(theta / 2); slides when rho g V sin(beta) > w sigma (cos(theta_r) - cos(theta_a)) | 15 %; 15 % in critical volume |
| S | dewetting speed of a film edge on a level plate | min(viscous, inertial) at theta_r = 10 and 60 degrees | 25 % |
| K, S | rivulet-to-film transition on acrylic, water at 43 C (a regression for K, whose closure was built on it) | transition at 0.125 to 0.21 kg/(m s) at 90 degrees and 0.108 to 0.174 at 5 degrees; wetted fraction 0.1 to 0.2 below it | inside both windows, at every official cell size |
| K | regime scale | the same 0.2 g/s stream on 2 mm and 4 mm blocks | same regime; wetted width within 30 % |
| K | mist-fed plate, two-sided: uniform deposition of 1.4 and 0.14 g/(m2 s) on vertical glass in wash liquor and on polypropylene in clean water | not film-wet before m_on / flux minus one sample; FILM (glass) or cycling through FILM (polypropylene) from m_on / flux plus one sample, with m_on = 2 and 43 g/m2 | both sides |
| K | integer conservation: a closed tilted plate with random deposits, 10^6 steps | total mass units | exact |
| LINE | pendant-drop spacing and size | 22 mm for water at 25 C; drop mass 0.34 g at 55 C | 15 % |
| LINE | drop, column, sheet transitions | thresholds of films §6.4 | 20 % |
| reservoirs | capillary rise in a gap | 34, 13, 7 mm at 0.2, 0.5, 1 mm | 5 % |
| all | seam conservation: closed mug with handle, no sources, 10^5 steps | total mass | K parts exact; S parts 10^-4 |
| all | global water mass over a revolution | closed | 0.1 % |
| driver | a block in the rack sprayed first, followed through a switch with the real driver and the M10 merge | thickness seen by the timeline over the dwell against a direct 60 s simulation of the switch | 10 % at 10 and 60 s |
| gate P2 | plate, inverted bowl, spoon and fork at rack inclination, sweeping-jet hand-over plus mist; a plate with a rounded (2 mm) and with a sharp (0.5 mm) rim struck at 15 degrees, for the film that wraps the rim onto the far face: K at 2 mm and S at 2 and 1 mm | (a) discretisation: S at 0.5 mm with 8 levels and no hand-over cap; (b) independent: the resolved cases of campaigns C4 and C5 (section 11.2) once they exist, until then the two acrylic windows | wetting-class maps, wave-averaged loading, mean and peak shear; decision rule of section 7.4 |

Gate P2 against (a) alone measures discretisation error: both sides share the equations and the contact-line closure, so a wrong closure passes. That is why (b) is part of the gate and why the wetting-map experiment of section 8.5 precedes soil calibration.

#### M7.12 Cost

Planning rates by the convention of section 7.1 (`budget3.py`):

| Kernel | Bytes per execution | Arithmetic | Planning rate |
|---|---|---|---|
| S stage update | 48 (mean of 40 and 56) | about 1,000 flops, 12 square roots, one fractional power | 0.60 G stage-updates/s (arithmetic floor; the traffic bound is 2.3 G/s) |
| S apply, with the accumulator clear | 96 | light | 0.87 G/s for the apply, memset speed for the clear |
| K block step | 84 | 4 Newton iterations with one fractional power each, about 400 flops | 0.79 G block-steps/s |
| statistics sample | 176 | light | 0.38 G samples/s |
| R0 sweep | 40 | light | 1.65 G/s |

S stage updates per cell and base step from the level mix: 40 % of cell-time at level 0 (unsprayed rack, quiet films), 35 % at the default level, 25 % jet-active at level 3 (2 mm) or 4 (1 mm): 6.2 per 2 mm cell and 11.6 per 1 mm cell [SYN]. The jet-active share is the least certain number in the budget; it follows from `levelByPhase`, which needs only the trace and the sector walk, and the first trace of fixture F1's full load replaces it (milestone MS1). Totals in section 7.

### M8. Soil (`@spotless/sim-soil`)

**Responsibility.** The unified per-element soil model of soils §7 and R1 to R3 on 1 mm soil cells: initial state from the level's soil records, the per-tick update, release to the liquor by sink, and the soil-dependent wetting summary handed back to the film solvers.

```ts
interface SoilStage {
  init(scene: Scene, items: readonly WashItem[], levelSeed: number): Promise<void>;        // ageing transform and spatial pattern, CPU, uploaded
  tick(a: { eff: GPUBuffer /* EffectiveExposure per film cell, section M10 */;
            jetLo: JetRecordSet; jetHi: JetRecordSet; wNu: number; sV: number;              // records and their tile tables at the bracketing viscosity points
            blocks: GPUBuffer /* TimelineBlock */; reservoirs: GPUBuffer /* ReservoirLiquor, 32 B per basin and gap */;
            rates: RateTables; dt_s: number; revPeriod_s: number }): void;                  // encodes one pass; writes SoilCell and BlockRelease
  wettingSummary(grid: 'block' | 'classD'): Promise<WettingSummary>;                        // cover in sixteenths and angle class per film cell, with its hash
  snapshot(): Promise<Uint8Array>;  restore(s: Uint8Array): Promise<void>;
}
interface SoilRelease { byItemAndClass: BigInt64Array /* 10^-15 kg */; toSumpByClass: BigInt64Array; toReservoirByClass: BigInt64Array /* [reservoir][class] */;
                        toLocalStoreByClass: BigInt64Array; waterUptake_kg: number }
```

`BlockRelease`, 32 bytes per soiled block and tick: removed dry mass of its four soil cells in 8 release classes (dissolved protein, dissolved carbohydrate, other dissolved, chromophore, fat, fines, grit, coarse; 8 x u32 in 10^-15 kg). The timeline routes it to a sink (M10) and reduces it into `SoilRelease`.

**State.** `SoilCell`, 136 bytes; the four soil cells of a block are contiguous. Deposits received during the wash are not soil state: they are per block and belong to M10.

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0 | w[12] | f32 | kg/m2 | water mass of each layer per covered area (layer 1 at the wall) |
| 48 | m0 | f32 | kg/m2 | initial dry loading per covered area, including the heterogeneity multiplier |
| 52 | Er | f32 | kg/m2 | reaction-erosion carry-over, as dry mass not yet converted into a removed layer |
| 56 | loose | f32 | kg/m2 | loosened inventory (optional law, default unused) |
| 60 | lagProg | f32 | - | progress of the reaction lag (1 = lag over) |
| 64 | hFat | f32 | m | liquid or soft fat film thickness |
| 68 | removed | f32 | kg/m2 | cumulative removed dry mass |
| 72 | cover | f32 | - | covered area fraction c |
| 76 | Xad | f32 | - | integrity of the bond to the substrate |
| 80 | tWet | u32 | ms | cumulative wetted time (diagnostic; integer, rule 2) |
| 84 | stain, particles | 2 x f32 | - , 1/cm2 | remaining chromophore fraction; attached particles |
| 92 | class, bake, nLayers, edgeDensity | 4 x u8 | | soil class; bake index B x 255; layers remaining; crack edge density code |
| 96 | nbCover[4] | u8 / 255 | - | cover of the four edge neighbours at the previous tick (a copy, not an accumulator) |
| 100 | tauCohTop, tauAd | 2 x f16 | Pa | strengths at the end of the last tick (diagnostics) |
| 104 | flags, pad | 2 x u16 | | |
| 108 | reserved | 28 bytes | | second component of composite soils |

Dry mass per layer is not stored: layers are graded geometrically (ratio 1.3, thinnest at the free surface; soils R1), and a layer is present or removed, so m_j = m0 g_j with a fixed table g. Cells whose dry thickness is under 20 um use one layer. Every evolving field is f32 or an integer: with f16 a backward-Euler hydration update stalls at 57 % of the true uptake after 90 minutes and cumulative wet time stops at 2,048 s (J-num); cover and X_ad are f32 so that small peel decrements are not lost. The coverage rank and the parent block are in `SoilStatic` (section 3.7).

**Initial state.** From `ItemSoilRecord {type, regions, amount_g, age_h, heat_history}` and the catalogue class tables (soils §7.4):

```
m_wet (per covered area) = amount_g / sum over regions( area x coverage );    m_d = x_s m_wet
w(t_d) = max( w_eq, (1 - x_s) m_wet - j_evap t_d ),   w_eq = m_d omega_0 / (1 - omega_0),   j_evap = 9e-6 kg/(m2 s)
B = 1 - exp( - sum_i k_B(T_i) t_i ),   k_B(T) = k_B,ref exp( -(E_B / R)(1/T - 1/T_ref) )        heat history -> bake index
```

Which cells of a region are covered is decided by thresholding a procedural field at the quantile that gives the region's coverage, so soiled patches are coherent smears; covered cells get cover = 1, the log-normal loading multiplier, a crack edge density of 1,000 1/m when B > 0.5, and five times the loading on cells at the edge of a dried pool (soils §7.7, R3 [ESTIMATED]). All of this is keyed by the level seed (benchmark §4.3), not by the wash seed (the three proposals used the wash seed; J-del).

**Wetness contract.** Every soil mechanism is switched by water, so what "wet" means is defined once, for every state a cell can be in. Pass W of the timeline (M10) gives each film cell, per tick, the shares of the tick it spends in five states (they sum to 1) and the quantities of each state; a soil cell takes those of its film cell, with the flowing share of a RIVULET block going only to cells whose coverage rank is below the wetted width fraction.

| State (share) | When | Wetted-area factor a | Water supply J_sup [kg/(m2 s)] | h_f | Film shear, M_f | Species supply (inputs of G_x) | Liquor and temperature |
|---|---|---|---|---|---|---|---|
| dry (s_D) | no liquid | 0 | 0 | - | 0 | chemistry not evaluated | - |
| sparse (s_B) | no continuous film; liquid arrives as droplets or sits as beads. This is the state of every rained face before its wetting onset | bare substrate: a_beadMax x bead load / b_max. Covered soil: max of that and min(1, depFlux / J_diff), because dried soil absorbs the droplets that land on it | depFlux (arrival from the air, condensate included) | bare: bead height b / (rho a); covered: none | 0 | k_m = D_x / h_f on bare substrate, unbounded on covered soil; v_ren = depFlux / rho | block mixture; T_s |
| residual film (s_R) | film-wet but below the flow threshold: a draining remnant, or a film that persists because the receding angle of the cell (Cassie mix of soil and substrate, current liquor) is below `soil.resFilmAngle` = 10 degrees | 1 | depFlux + Gamma_dd W / A_up | drain-down thickness h_dd of M10 | rho g_s h_f; 0 | k_m = D_x / h_f; v_ren = J_sup / rho | block mixture; T_s |
| flowing film (s_F) | film above the flow threshold, after onset or where jet hand-over wets | 1 | depFlux + Gamma W / A_up | hMean of the record, rescaled | tauMean, tauPeak, duty levels, mfMean, mfPeak | k_m = max( 0.538 (D_x^2 tau_f / (mu x_L))^(1/3), D_x / h_f ); v_ren = J_sup / rho | block mixture; T_s |
| immersed (s_I) | below the current level of a lumped basin, or in a filled gap reservoir | 1 | not limiting | - | 0; jets attenuated by the water depth (below) | chi_x = 1 | the reservoir's liquor and temperature |

```
f_wet      = s_I + s_F + s_R + a_B s_B
hydration  top flux = s_I J_diff + s_F min(J_diff, J_sup,F) + s_R min(J_diff, J_sup,R) + s_B min(J_diff, depFlux)
chemistry  evaluated only if f_wet > 0, with  chi_x = ( s_I + s_F chi_x,F + s_R chi_x,R + a_B s_B chi_x,B ) / f_wet
           and T, pH, c_E, c_ox the f_wet-share-weighted mix of the reservoir liquor (share s_I) and the block mixture (other shares)
```

J_diff is the diffusion-limited uptake of the top layer (E2). `reached`, the onset factor of M10, is the fraction of the tick that lies after the wetting onset of the block (0 before, 1 after, between in the tick in which the onset falls); it multiplies s_F and s_R only, and the time it removes from them goes to the sparse state. "Any bead counts as wet" (films §12.4 taken literally, A and B) is replaced by the bead-covered fraction (C §8.2; J-phys), and hydration starts with the first deposition instead of waiting for a film: at 0.1 % of the reference flux a glazed face in wash liquor reaches its onset after 34 s, but a glass or polypropylene face in clean water only after 2 to 7 minutes, by which time 12 to 43 g/m2 has landed on the soil.

**Supply factor for enzyme, alkali and oxidant** (this document's closure, [SYN] in sign and in size; soils §9 condition 3 requires a liquid-side term, "not just wetted"). A species cannot reach the soil faster than the liquid brings it and than it crosses the film:

```
G_x     = ( 1 / k_m,x + 1 / v_ren )^(-1)            with 1 / k_m = 0 where k_m is unbounded;  G_x = 0 where v_ren = 0          [m/s]
chi_x   = clamp( [ G_x / (G_x + k_u,x) ] / [ G_ref,x / (G_ref,x + k_u,x) ],  chi_floor,  1 ),    chi_floor = `soil.chiFloor` = 10^-3
c_E,eff = chi_E c_E;     pH_s = pH + log10(chi_OH)  (never more than 3 units below the liquor);     c_ox,eff = chi_ox c_ox
```

Every input is defined by the wetness table: k_m is the Leveque coefficient of films §9.4 with `soil.xL` = 20 mm, floored by diffusion across the film of that state; v_ren = J_sup / rho is the liquor volume delivered per unit area, with the film contribution Gamma W / A_up taken over the catchment of the block (section 3.7), so it does not depend on the cell size. G_ref is the same expression for the reference film of the in-machine tile (Gamma = 0.02 kg/(m s) below a 0.1 m catchment at 55 C: h = 147 um, tau = 1.42 Pa, G_ref = 5.9 x 10^-6 m/s for enzymes). The normalisation matters: the Hill enzyme law below was fitted to bulk concentration at that tile, so the factor is 1 there and acts only where delivery is worse. With k_u,E = 0.3 G_ref the enzyme-driven rate is multiplied by 0.87 under a film of 0.002 kg/(m s), by 0.25 under a film fed only by 1.4 g/(m2 s) of mist, by 0.41 on soil that absorbs the same mist without a film, and by nearly zero at a tenth of that flux (`budget3b.py`; module M13 regenerates these numbers from the registry as a test).

The evidence does not fix even the sign of this closure. The thesis authors attributed their two failed low-rate cases to the tile being vertical, not immersed and *quickly* renewed, so that fewer enzyme molecules bind at low concentration (soils §6.2 [VERIFIED]); that compares a thin fast film with immersion and is already inside the in-machine Hill fit. The homogeneous removal they measured is on a tile swept by two jets and says nothing about a face without jet access. The closure here is the mass-balance bound on delivery, which must hold at very low supply; whether it bites at the supplies of a shadowed face is what soils calibration test 6 (paired jet-swept and shadowed tiles) measures. Until that test exists: `soil.kuE` is first on the calibration list; every item reports the share of its soiled area whose time-mean chi_E fell below 0.8 (`supplyLimitedArea`); and level acceptance replays the soil with `soil.kuE` at 0 and at 3 (section 7.6).

**Jets under water.** The jet record of a cell is computed on the dry geometry (M5). For the immersed share of a tick the kernel attenuates it by the depth H of water above the cell, from the pool level of that tick:

```
A_sub(H) = min( 1, k_sub (d_ref / H)^2 ),   k_sub = `jets.kSub` = 70.8,   d_ref = 2 mm
```

which is the ratio of the submerged-jet peak shear 44.6 rho u^2 Re^(-1/2) (H / D)^(-2) (jets §4.3 [VERIFIED] for H / D > 8, "would apply to a nozzle submerged in a pooled vessel") to the free-jet peak 0.63 rho V^2 Re^(-1/2): 1 down to 17 mm of water, 0.18 under 40 mm, 0.04 under 80 mm, where a 195 Pa top-arm peak becomes 9 Pa. Exceedance times are read from the stored curves at threshold / A_sub and peaks are multiplied by A_sub; the same factor is applied to the momentum-flux curve. Use on a free jet plunging through a pool is [ESTIMATED]; k_sub = 0 removes all jet action under water.

**Update**, following soils §7.5 and R2 with the changes marked (new):

```
E2  hydration      backward-Euler tridiagonal solve on the layer stack, coefficients from the previous tick:
                   dw_j/dt = J_(j+1/2) - J_(j-1/2),   J = D_w(beta_face) (beta_(j+1) - beta_j) / mean thickness,   beta_j = w_j / h_j
                   D_w = D_w0 exp(alpha_w beta) a_T a_pH(pH_s) a_B;   wall flux 0;   J_diff = D_w (beta_max - beta_N) / (h_N / 2);
                   top flux as in the wetness contract                                                                   (new: per state, from first deposition)
E3  weakening      theta_E = c_E,eff^n / (K_E^n + c_E,eff^n)
                   J_r  = J_r,ref f_T(T_s) exp( s_pH (pH_s - 10.5) ) (theta_E / theta_E,ref) a_B g Psi(x_top)            dry mass flux [kg/(m2 s)]  (new: mass based)
                   J_OH = J_OH,ref a_T,OH(T_s) [ 10^(pH_s - 11.5) - 0.1 ]+ / 0.9  g Psi(x_top)                            soils E3: zero at pH 10.5 and below
                   lag:  d(lagProg)/dt = f_wet p f_T(T_s) exp( (s_pH / 2)(pH_s - 10.5) ) / t_lag,ref,   p = 1 if c_E,eff >= c_E,min or pH_s >= pH_min, else 0
                         g = clamp( (lagProg - 1) / 0.5, 0, 1 )                                                           (new: a progress variable)
                   Psi(x) = clamp( (x - x_0) / (x_1 - x_0), 0, 1 ),  x_top = beta_N / beta_max                             (new: hydration gate)
                   dXad/dt = -k_ad a_T a_surf a_pH H(beta_1 - beta_ad)
E4  strengths      tau_coh,j = tau_c0 exp(-b_c beta_face) a_fat(T_s) a_B;    tau_ad = tau_a0 exp(-b_a beta_1) Xad s_sub
                   F_ad = F_a0 Xad s_sub a_fat;   M_Y = F_ad / eta_M;   k' = min( k'_max, k'_ref (tau_ref / tau_coh,top)^1.8 )
E6a solubles       dm = min( m_N, k_L (c_sat - c_bulk) (s_F + s_I) dt ),  k_L = 0.538 (D^2 tau_f / (mu x_L))^(1/3), floored by D / (1 mm) when immersed
E6b reaction-      Er += [ J_r + J_OH + f_j (J_s - J_r) ] f_wet dt,   J_s = (k_ss / k_ds) J_r
    erosion        f_j = share of the tick with shear above tau* = 10 Pa: jet time from the exceedance curve (log interpolation; 10 Pa is a stored level;
                   attenuated on the immersed share) plus the film's tauDuty10 on the flowing share plus the droplet duty above 10 Pa                 (new: film term)
                   while Er > m_N (dry mass of the top layer): remove the top layer, Er -= m_N
E6c cohesive       tau_load = max( tau_f,pk on the flowing share, tauPk of the jet record (attenuated when immersed) );
                   remove all layers above the interface nearest the wall with tau_coh < C_coh tau_load
E6d adhesive       if tau_ad < C_ad tau_load:  cover <- 0 for the cell (1 mm cells are single patches)
E6e peeling        dcover/dt = -(L_edge / A) k' [ (1 / T_rev) integral from M_Y to M_pk of T_M(m) dm  +  (1 - f_j) s_F (M_f - M_Y)+ ]
                   T_M(m) = time per revolution with M above m, log-linear between the stored levels, zero at M_pk
                   L_edge = sides adjoining sub-cells of lower cover (nbCover) plus crack density times area
E6f fat            SFC(T_s) = SFC_max / (1 + exp((T_s - T50) / w));  viscous shifting flux of soils eq. V1 with tau_f and g_t when SFC < 0.10;
                   emulsification dhFat/dt = -k_em a_surf a_T (s_F + s_I) hFat
E6g stains         dS/dt = -k_ox a_T c_ox,eff f_wet S
E6h particles      released when their binder layer is removed or when 8 tau_load d^2 exceeds the binder force
E7  hand-off       removed dry mass by release class -> u32 per block and tick in 10^-15 kg (`BlockRelease`) -> routed by M10 to the sink it dissolved into:
                   the sump (well-renewed film), the block's local store (slowly renewed film or beads), or the basin or gap reservoir (immersed share)      (new: sinks)
```

Notes on the changes.

- **Mass-based erosion with a hydration gate (E3, E6b).** soils E6b erodes a swollen thickness and deletes the top layer when it exceeds the layer's current thickness. Where water supply limits swelling the layer is thin, so the same thickness rate removes dry mass 3.7 times faster than the measured mass flux (1.1 x 10^-4 against 3 x 10^-5 kg/(m2 s) for egg yolk): the worst-wetted soil would clean fastest (J-phys). The rate is therefore the dossier's mass flux J_r,ref (which soils §10 item 3 calls the safe form), and it is switched on only as the top layer hydrates: zero below x_0 of equilibrium water content, full above x_1 (the thesis runs peaked at 50 to 60 % saturation).
- **Peel term (E6e)** is the integral of the momentum-flux exceedance curve between M_Y and the peak (B §7.5), which equals the per-pass integral of k'(M - M_Y)+ prescribed by soils §1.4.4. The rectangle (M_pk - M_Y) x time above M_Y (A) over-predicts by 2.2 to 5 times, and a shear dwell (C) by an order of magnitude (`checks.py`: 54 against 147 mN s/m at M_Y = 10 N/m).
- **Kinetics.** Where the soils and chemistry dossiers disagree (Hill exponent 3 against 2; egg-yolk flux 3 x 10^-5 against 3.7 x 10^-5; lag 9 min against 300 s scaled with thickness squared; starch flux 2 x 10^-5 against 4 x 10^-5; the enzyme-free alkaline path) the soils set is used as one coherent fit, with one import: the chemistry dossier's f_T, which carries the enzyme denaturation optimum (protease 1.09 at 55 C, 0.53 at 65 C, where plain Arrhenius gives 1.5): first order for a 45 to 65 C programme (C §8.3; A missed the conflict). `soil.kineticSet` selects either set as a whole; the chemistry regression tables are run with the chemistry set.
- **Alkaline path.** The chemistry dossier's enzyme-free flux f_alk is 0.14 of the reference rate at 55 C and pH 10.5. soils §2.2 [VERIFIED] found no thickness decrease without enzyme in any condition except pH 11.5 at 55 C, and the measured in-machine rate at 0.02 g/L of protease (0.17 % per minute) leaves no room for it: 0.14 J_r,ref alone is 0.18 % per minute on that tile. The boost at pH 11.5 with enzyme is already in s_pH = 0.96. The soils set therefore uses the form of soils E3, shifted so that it is zero at pH 10.5 and below, with J_OH,ref = 3 x 10^-6 kg/(m2 s) for egg yolk at pH 11.5 and 55 C ([ESTIMATED]; the detachment after 30 to 40 minutes observed there is carried by the adhesion-decay term). f_alk is used only when `soil.kineticSet` selects the chemistry set.
- **Lag.** The lag is the time the reagent needs in the wetted soil, so it is integrated as a progress variable that advances only while the cell is wet and enzyme or alkali is present, at the rate set by the temperature and pH of that moment. A cumulative wet time compared with the instantaneous t_lag(T) would let the cold pre-rinse, which has no enzyme, pay off the lag, and would reopen a finished lag when f_T falls above 60 C (t_lag is 23 min at 20 C, 8.3 min at 55 C and 17 min at 65 C).
- **Frequency response.** E6b is linear in jet duty. The gauge data show a sub-linear response when hits last seconds (loosened material is used up), but in the machine hits last 3 to 30 ms and removal was spatially homogeneous over the tile, with a jet share of about 10 % (soils §6.1, §6.2 [VERIFIED]). The standards checklist expects -1 to -2 score points for a protein soil turned away from the jets (P02 [ESTIMATED]). This document sides with the measurement: under the adopted law that effect comes mainly from wetting and from the supply factor, not from jet duty. An optional loosened-layer law is specified for calibration test 6 of the soils dossier (default off): d(loose)/dt = J_s Psi (1 - loose / L_cap) - k_0 loose - k_1 [tau > tau*] loose, removal = (k_0 + k_1 [tau > tau*]) loose, with k_0 L_cap = J_r r / (r - 1), r = k_ss / k_ds, so that the unsheared steady rate is J_r and the continuously sheared limit is J_s. The four ordered events of JetExposure and the longest rest are stored so that this law can be run on cached exposure.
- **Where removed soil goes.** Soil that dissolves under a pool, in a gap or under beads has not left the item. It is credited to the store it dissolved into; the stores exchange with the liquor at their own rates and deposit what they hold when they dry (M10). This is the mechanism of chemistry §10.2 for dirty pooled water and for residue in stagnant places.

**Parameters.** The per-class tables of soils §8.1 to §8.3 are the registry content for `soil.<class>.*` with their H / M / L confidence columns; a per-class value overrides the global default of the same name (for example C_ad = 1 for starch against the global 14.2 fitted on ketchup). Global defaults:

| Key | Default | Range | Tag | Source |
|---|---|---|---|---|
| layers; grading ratio | 12 (1 for dry thickness under 20 um); 1.3 | 8 to 16 | [VERIFIED] guidance | soils R1, R3 |
| `soil.tauStar` | 10 Pa | 5 to 20 | [VERIFIED] | soils R3 |
| `soil.kssOverKds` | 4 | 1.5 to 7 | [VERIFIED] range | soils R3 |
| `soil.Ccoh`, `soil.Cad` | 0.67, 14.2 | 0.1 to 20 | [VERIFIED] for starch, ketchup | soils R3 |
| `soil.etaM` | 0.1 | 0.03 to 1 | [ESTIMATED] | soils R3 |
| `soil.kPeelMax` | 3 x 10^-2 m s/kg | | [VERIFIED] largest published | soils R3 |
| `soil.hillN`, `soil.KE` | 3; 0.82 x reference dose | 1 to 4; 0.3 to 1.5 | [ESTIMATED] from [VERIFIED] rates | soils R3 |
| `soil.sPH` protein, starch | 0.96, 0.3 per pH unit | 0 to 1.5 | [ESTIMATED] from [VERIFIED] | soils §8.3 |
| f_T (protease, amylase) | functions of chemistry §10.6 | | [ESTIMATED] | chemistry §10.6 |
| `soil.<class>.JOHref`; its activation energy | 3 x 10^-6 kg/(m2 s) at pH 11.5, 55 C (egg yolk); 60 kJ/mol | 0 to 10^-5 | [ESTIMATED] | soils §2.2, E3; chemistry §10.6 |
| `soil.tLagRef`; `soil.lagEnzymeMin`; `soil.lagPhMin` | per class (9 min egg yolk at 50 C); 0.05 x reference dose; 9.5 | 0.5 to 30 min | [VERIFIED] scatter; thresholds [SYN] | soils §8.3 |
| `soil.loadCv`; crack density; rim factor | 0.3; 1,000 1/m; 5 | 0.1 to 0.6; 500 to 2,000; 2 to 10 | [ESTIMATED] | soils §7.7, R3 |
| `soil.x0`, `soil.x1` hydration gate | 0.2, 0.5 | 0 to 0.8 | [SYN] | this section |
| `soil.aBeadMax` bead-covered area at bead capacity | 0.3 | 0.15 to 0.6 | [SYN] from films §8.2 (0.5 to 2 drops per cm2, 2 to 7 mm wide) | this section |
| `soil.resFilmAngle` | 10 degrees | 5 to 20 | [SYN] from films §5.5 | this section |
| `soil.kuE` / `soil.kuOH` / `soil.kuOx` uptake velocity in units of G_ref | 0.3 / 0.05 / 0.05 | 0 to 3 | [SYN]; bracket S | this section |
| `soil.chiFloor` | 10^-3 | | [SYN] numerics | this section |
| `soil.DE`, `soil.DOH`, `soil.Dox` | 1 x 10^-10, 2 x 10^-9, 1 x 10^-9 m2/s | factor 3 | [RECALLED] orders of magnitude | films §9.4 |
| `soil.xL` Leveque length; reference film | 20 mm; 0.02 kg/(m s) below 0.1 m | 5 to 100 | [SYN] (k_L varies as x^(-1/3)) | films §9.4 |
| `jets.kSub` attenuation of jets under water | 70.8 | 0 to 150 | [ESTIMATED] from a [VERIFIED] form | jets §4.3 |
| `soil.erosionLaw`; `soil.kineticSet` | 'linearDuty'; 'soils' | or 'loosenedLayer'; or 'chemistry' | | this section |

**Numerics.** One tick per master revolution; implicit hydration, explicit removal rules applied in the order above. The kernel calls exp, pow, log10 and a cube root on state variables (exp(alpha_w beta) per layer face, exp(-b_c beta), the power 1.8, the Leveque root, log10(chi_OH), exp(s_pH dpH)); `KernelDef.uses` declares them, so the soil state is bit-reproducible on one stack only, like every other kernel that uses them (rule 9). Functions of temperature alone (f_T, a_T per class, SFC, liquid properties) are tabulated on the CPU once per tick (64 entries over the range of block temperatures present) and read with manual interpolation. The liquor a block sees is a mixture (M10): conserved quantities (alkalinity, total carbonate, species concentrations) are mixed linearly with the fill fractions in the kernel, and the pH of the mixture is read from a two-dimensional table pH(alkalinity / total carbonate, T) of 64 x 32 entries that M9 builds once per run from its acid-base constants; pH values are never averaged. The kernel processes the four soil cells of a block together and skips blocks whose cells are all clean.

**Conservation.** Per soil class: on items + in local stores, pools and gaps + in liquor + on filter + drained + redeposited = initial, to 10^-4 of the initial mass, asserted at every phase end.

**Tests** (soils R6; each reproduces a published result).

| Test | Target | Tolerance |
|---|---|---|
| Egg-yolk swelling | 95 % of equilibrium at about 90 min; h_inf = 0.41, 0.70, 0.45, 0.82 mm for (30 C, pH 10.5), (55, 10.5), (55, 9.5), (55, 11.5) | 10 % |
| Gauge run | 50 C, pH 10.5, 17 % frequency, k_ss 25.1, k_ds 5.55 um/min, lag 9 min: thickness maximum near 20 to 30 min, then stepwise removal | shape; times within 20 % |
| In-machine egg yolk, all six cases | 0.85, 1.75, 2.59, 4.66 % per minute; 0.17 at 0.02 g/L of protease; 0.69 at pH 9.5; completion at about 65, 45, 25 min; decay after 70 % | 20 % on rates, or the measured standard deviation where that is larger |
| No enzyme | pH 10.5, 55 C, 90 min; and pH 9.5 | removed mass below 2 % (soils §2.2) |
| Wetness states (fixture F3 holds one record per state) | the same cell dry, sparse on bare and on covered substrate, under a residual film, under a flowing film, immersed: f_wet, J_sup, chi_x and every rate finite and equal to the table; no rate without water; pH_s finite at zero supply | exact branch; 10^-6 |
| Supply factor | the four reference numbers of this section from the registry | 0.01 |
| Intermittent splashing (soils calibration test 17 as a model test) | swelling of a tile under a continuous film, under 14 and 1.4 g/(m2 s) of rain without a film, and immersed | uptake limited by the delivered water; ordering immersed >= film >= rain; uptake under rain equals delivered mass until the diffusion limit |
| Lag | 11 minutes of cold water without enzyme, then 55 C liquor; and a hold at 65 C after the lag has passed | lag still to run in full; g stays 1 |
| Jets under water | a cell under 5, 17, 40 and 80 mm of water in the path of a top-arm jet | f_j and peaks scaled by A_sub; none with k_sub = 0 |
| Starch in channel flow | removal starts after about 40 s at 1 m/s and 50 g/m2; constant rate; time proportional to loading | 25 % |
| Jet peeling | a proportional to t^0.2 with K = 7.2 mm s^-0.2; strip width proportional to V^(-1/4) | 15 % |
| Baked soil adhesion | F_w falls at 0.06 N/(m s) at 20 C and 0.51 at 50 C; exponential tail with 125 s after 220 s | 15 % |
| Fat temperature response | k' from 6.7 x 10^-6 to 3.3 x 10^-3 m s/kg between 20 and 60 C | 20 % |
| Under-wetted soil | the same cell with J_sup limited to 1 % of full | removed mass never exceeds that of the fully wetted cell |
| Precision guard | hydration over 5,400 s, and every accumulating field over 3,430 ticks, in the shipped precision against f64 | 1 %; 0.1 % |

**Cost.** 340 bytes of traffic per cell-tick and about 1,100 flop-equivalents bound the kernel; planning rate 0.19 G cell-ticks/s (section 7.1). 2.0 to 3.4 million cells x 3,430 ticks x 0.8 active: 28 to 47 s.

### M9. Liquor, machine thermal nodes and drying air (`@spotless/sim-liquor`)

**Responsibility.** The well-mixed liquor of chemistry §10 (25 states), detergent release, acid-base and hardness, bleach and enzyme species, soil in the liquor, filter, foam; the lumped thermal nodes of the machine; the tub air during drying. CPU, f64.

```ts
interface LiquorState { V_m3: number; T_K: number; pH: number; cls: 'W' | 'D' | 'R'; sigma_N_m: number; nu_m2_s: number; rho_kg_m3: number;
                        alkalinity: number; carbonate: number;
                        protease: number; amylase: number; paa: number; hoo: number; surfactant: number; chelantFree: number; caFree: number;
                        fatFree: number; fines: number; grit: number; tds: number; dissolved: number; foam: number; filterLoad: number; tabletLeft_kg: number }
interface TabletSupply { state: 'closed' | 'released' | 'stuck'; wTab: number /* 0..1, from M10 */; into: 'sump' | { reservoir: number } }
interface DepositSinks { fines_kg: number; grit_kg: number; fat_kg: number; dissolved_kg: number; water_kg: number }     // what left the liquor onto surfaces this tick
interface RateTables { T0_K: number; dT_K: number; fTprotease: Float32Array; fTamylase: Float32Array; aT: Float32Array[]; sfc: Float32Array[];
                       pHTable: Float32Array /* 64 x 32: pH against alkalinity / total carbonate and T */ }
interface LiquorModel {
  step(tick: MachineTick, release: SoilRelease, heatToLoad_J: number, tablet: TabletSupply, deposits: DepositSinks,
       exchange: { fromReservoirs: Float64Array /* species arriving with spill and gap exchange */ }): LiquorState;
  rateTables(TminK: number, TmaxK: number): RateTables;
  fillComposition(fill: 0 | 1 | 2 | 3): LiquorState;                    // end-of-phase liquors for the fill-fraction mixture
  mix(parts: readonly { liquor: LiquorState; fraction: number }[]): LiquorState;   // linear in conserved quantities, pH re-solved; used for pools and gaps
  air(): { T_K: number; rhoV: number; T_wall_K: number; T_hx_K: number };
}
```

**Equations** (chemistry §10.2 to §10.8 and §10.10; state vector of 25 variables as listed in chemistry §10.1; concentrations of molecular species in mol/m3, of products and soils in kg/m3):

```
fill        V_w <- V_res + V_fill;  c_j <- (c_j V_res + c_j,supply V_fill) / V_w;  T_w <- (V_res T_w + V_fill T_s) / V_w;     drain: V_w <- V_res
release     d(m_tab)/dt = -(3 m_0 / tau_tab(T)) w_tab (m_tab / m_0)^(2/3),   tau_tab(T) = tau_tab,ref exp[(E_tab / R)(1/T - 1/313.15)]
            released: w_tab = min(1, q_tab / q_ref), with q_tab evaluated by M10 every tick on the tablet's resting place (below);
            stuck (lid blocked): w_tab = w_stuck;   species go to the reservoir the tablet rests in:  d(c_j)/dt += x_j (-d(m_tab)/dt) / V
acid-base   Alk = 2 C_carb,Na2CO3 + C_bicarb,supply + B_s - A_ac
            solve Alk = C_carb (K1 H + 2 K1 K2) / (H^2 + K1 H + K1 K2) + Kw / H - H for H by bisection (30 iterations);  pH = -log10(H) + dpH_ni
            pK1 = 6.35 - 0.002 (T_C - 25);  pK2 = 10.33 - 0.0064 (T_C - 25);  pKw = 14.00 - 0.0300 (T_C - 25) + 0.00006 (T_C - 25)^2
            f_HOO = 1 / (1 + 10^(pKa,HP - pH)),  pKa,HP = 11.6 - 0.017 (T_C - 25)
hardness    Ca_free = max(0, Ca_T - C_ch) / (1 + K_cit C_cit);   X_ch = max(0, 1 - Ca_T / (C_ch + 0.3 C_cit))
bleach      r_per = k_per(T) f_HOO HP TAED;   d(TAED)/dt = release - r_per - k_per(T) f_HOO K_r TAED
            d(PAA)/dt = 2 r_per - [k_dec(T) + k_soil C_org] PAA - consumption by stains;   d(HP)/dt = release - 2 r_per - k_HPdec HP
enzymes     d(E_i)/dt = release - [k_th,i(T) + k_ox,i PAA + k_oxHP,i HP] E_i,   k_th,i(T) = (ln 2 / t_half,i) exp[-(E_d,i / R)(1/T - 1/333.15)]
soil        V_w d(C_k)/dt = release_k (to the sump) + arrivals from reservoirs and local stores + k_leach,k M_filt - Q_c eta_k C_k - deposition_k   (k = fines, grit);
            eta_2 = 0.02 + 0.18 L_f,  eta_3 = 0.6 + 0.3 L_f
            d(M_filt)/dt = Q_c sum_k eta_k C_k + coarse input - sum_k k_leach,k M_filt;   L_f = min(1, M_filt / 0.02 kg);   Q_c = Q_c,0 (1 - 0.3 L_f^2)
fat         M_stab = min( C_1 V_w (1 - SFC(T_w)), 30 C_surf V_w + 2 C_0p V_w + 10 M_soap );   C_fat,free = C_1 - M_stab / V_w
liquor      M_w c_w dT_w/dt = eta_h P_h u_h + P_pump - (heat uptake of the load, from M10) - G_wt (T_w - T_tub) - mdot_ev h_fg
tub         C_tub dT_tub/dt = G_wt (T_w - T_tub) - G_loss (T_tub - T_room) + condensation heat
liquor class  D when the dissolved surfactant exceeds `liq.surfClass`; R after the rinse-aid dose; W otherwise
```

Constants are those of chemistry §10.3 to §10.7 (k_per = 1.0 x 10^-2 m3/(mol s) at 296 K with 45 kJ/mol, K_r = 3 mol/m3, k_dec = 5.8 x 10^-4 1/s at 50 C with 60 kJ/mol, k_soil = 2 x 10^-5 m3/(kg s), protease and amylase half-lives of 1,800 and 3,600 s at 60 C with 200 and 220 kJ/mol, K_cit = 3.0 m3/mol, dpH_ni = -0.3, k_leach = 2 x 10^-4 and 5 x 10^-5 1/s; tags as in the dossier). Numerics: explicit steps of 0.25 s with exact exponentials for the stiff relaxations (chemistry §10.13); coupling to the soil is explicit with one tick of lag (the fastest liquor time constants are 100 to 500 s).

**Blocked dispenser.** A tablet behind a lid that cannot open is reached only by what splashes through the gap. chemistry §1.7 and machine §7.4 put the fraction released over a main wash at 5 to 30 % and the regression row of chemistry §10.12 at 15 %. The dossier's w_stuck = 0.05 does not give that: with the shrinking-core law and tau_tab = 480 s at 40 C it releases 37 % in the heat-up and 82 % by the end of the 54 minute main wash of the sizing programme, and 97 % in the 90 minutes of ECO-50, so the wash would be dosed late, not starved (`tablet.py`). `liq.wStuck` is therefore 0.006 (15 % released in the sizing programme; range 0.002 to 0.013 for 5 to 30 %), [SYN] and calibrated against the released fraction. It is a closure with a constant, so P25 is of kind C (section 8.3). The emergent form, in which the cup behind the lid is geometry and q_tab is the flux recorded in it, is deferred (section 11.1); the hook is that a stuck tablet's resting place is the cup's blocks.

**Drying air** (chemistry §10.11, extended with a heat-exchanger wall for machines that have one):

```
V_air d(rho_v)/dt = sum_e A_e j_e - h_m A_wall (rho_v - rho_v,sat(T_wall))+ - h_m A_hx (rho_v - rho_v,sat(T_hx))+ - Q_vent (rho_v - rho_v,room) - mdot_ads
C_hx dT_hx/dt     = h_fg h_m A_hx (rho_v - rho_v,sat(T_hx))+ + h_c A_hx (T_air - T_hx),     C_hx = m_tank c_w,  T_hx(0) = T_supply
V_air rho_air c_p dT_air/dt = sum_e h_c A_e (T_s,e - T_air) + h_c A_wall (T_wall - T_air) + h_c A_hx (T_hx - T_air) - Q_vent rho_air c_p (T_air - T_room)
```

The side-wall heat exchanger of the sizing machine is thus its own condensation sink with its own temperature (no proposal had this; J-num, J-del). Air is one node; spatially resolved air flow is deferred (section 11).

**Parameters.** chemistry §10 defaults: `liq.Ph` 2000 W, `liq.etaH` 0.97, `liq.Gwt` 200 W/K, `liq.Gloss` 3.5 W/K, `liq.Ctub` 12 kJ/K, `liq.Vres` 0.15 L, release constants by product form, deactivation table, `liq.qRef` 0.5 kg/(m2 s), `liq.wStuck` 0.006 ([SYN], range 0.002 to 0.013), `liq.surfClass` 0.02 kg/m3 of nonionic surfactant (about 18 % of a 20 g dose in 3.6 L; [SYN], range 0.005 to 0.05), `dry.hc` 4 W/(m2 K), `dry.Vair` 0.12 m3, `dry.Awall` 1.5 m2, `dry.Qvent` 0.05 L/s closed (all [ESTIMATED] unless tagged otherwise there); `dry.Ahx` 0.25 m2 and `dry.tankVolume` 2 L [SYN placeholders until the Bosch dossier is merged into the machine data].

**Tests.** ECO-50 main-wash timeline of chemistry §10.12 (T, pH, peracid, enzymes at 10 to 90 min) with the chemistry kinetic set and the dossier's dose, 2 %; the blocked-lid row of the same table (15 % of the dose released, pH 10.1, egg-yolk removal 0.09) with `liq.wStuck` fitted to 15 % in ECO-50 (0.0038), 10 % on pH and removal; released fraction in the sizing programme with the default w_stuck, 15 % +/- 2; pH 10.8, 10.7, 10.3 at 45, 50, 70 C for type D at 4.1 g/L; peracid peak about 0.23 mmol/L; a tablet dissolving in a 0.3 L pool that exchanges with the sump at 1 mL/s: sump concentration against the two-tank solution, 2 %; the pH table against the bisection, 0.02 pH; energy balance (heater input = liquor + tub + items + losses + evaporation) 0.5 %.

### M10. Timeline (`@spotless/sim-timeline`)

**Responsibility.** The replay loop of section 5.5 and every state with memory longer than one revolution. The explicit list (J-num asked for it):

| Slow state | Memory | Where it is integrated |
|---|---|---|
| remnant film of the previous diverter state; film after the pump stops | 2 s to minutes | DrainDown record merged per tick, t^(-1/2) beyond 60 s |
| switch-on transient of a main-wash state | 2 to 5 s | transient FilmExposure for the first two revolutions of each dwell |
| wetting onset and bead accumulation under sparse rain | seconds to hours | onset gate (below); the sparse wetness state until then |
| condensation on cold shadowed faces | minutes | block energy balance; condensate wets without detergent |
| pool level, composition, temperature, settled solids, soil dissolved under the pool | 30 s to the whole programme | per-basin ODEs on the CPU |
| gap and bridge reservoirs | whole programme | filled flag, composition and dissolved soil per reservoir |
| wall temperature | 2 to 25 s wetted, minutes shadowed | per-block nodes |
| film composition; soil dissolved into slowly renewed films and beads | 1 / renew | fill-fraction vector and local store per block |
| soil state and soil-dependent contact angles | minutes | soil kernel; wetting summary at each lazily computed exposure; drift monitor |
| liquor, filter, foam, tablet | 100 to 500 s | M9 |
| sump inventory and prime | seconds | M4 each tick, through the controller feedback |
| speck intensity and deposits | phases | per block at drains and at the end |
| item poses | events | M11 |
| arm speed after a switch | 0.3 s | neglected (under one revolution) |

```ts
interface TimelineStage { run(ctx: TimelineContext): Promise<TimelineResult> }
interface TimelineContext { machine: MachineModel; programme: ProgrammeSpec; liquor: LiquorModel; soil: SoilStage; rigid: RigidCoupler; scene: () => Scene;
                            exposure: (combo: ComboId) => Promise<ExposureSet>;      // runs stages C to G or returns a cached set; evicts and readmits the replay state (M1)
                            onProgress: (fraction: number) => void }
interface TimelineResult { blocks: GPUBuffer /* TimelineBlock */; pools: readonly PoolState[]; gaps: readonly GapState[]; release: SoilRelease;
                           ticks: number; carryOver_L: readonly number[]; flags: TimelineFlags }
interface GapState { gap: number; filled: boolean; liquor: LiquorState; dissolvedSoil_kg: readonly number[] }
interface TimelineFlags { wettingDrift: Float32Array /* [item][2] */; primeLossTicks: number; classApproximationTicks: number }
interface PoolState { basin: number; volume_m3: number; level_m: number; liquor: LiquorState; settled_kg: readonly number[]; dissolvedSoil_kg: readonly number[] }
```

`TimelineBlock`, 64 bytes; every evolving field is f32 except the fill fractions, which are u16 that are renormalised every tick.

| Offset | Field | Type | Unit |
|---|---|---|---|
| 0 | T_s, T_mid | 2 x f32 | K |
| 8 | effective film mass, bead mass | 2 x f32 | kg/m2 |
| 16 | cumulative deposition; onset progress P | 2 x f32 | kg/m2; - |
| 24 | fill fractions (pre-rinse, main wash, intermediate rinses, final rinse) | 4 x u16 | 1 / 65,535; they sum to 65,535 |
| 32 | local store: dissolved soil; fat | 2 x f32 | kg/m2 |
| 40 | speck intensity: fines; grit | 2 x f32 | 1/mm2 |
| 48 | deposits: dried dissolved residue; fat and soap film; pigment | 3 x f32 | kg/m2; kg/m2; - |
| 60 | regime now; cover summary; flags | u8; u8; u16 | |

`EffectiveExposure`, 40 bytes per film cell and tick (written by pass W, read by pass T and by the soil kernel):

| Offset | Field | Type | Meaning |
|---|---|---|---|
| 0 | sFlow, sRes, sSparse, sImm | 4 x u8 / 255 | shares of the tick in four wetness states; the dry share is the remainder |
| 4 | hFlow; tauFlow; tauPeak | 3 x f16 | um; Pa; Pa, after rescaling |
| 10 | mfMean, mfPeak | 2 x log u8 | N/m |
| 12 | jSupFlow; jSupRes; depFlux | 3 x f16 | water supply of the flowing and residual states and arrival from the air, g/(m2 s) |
| 18 | hRes; hBead | 2 x f16 | um |
| 22 | tauDuty[5] | 5 x u8 / 255 | shares of the tick with film shear above 0.5, 1, 2, 4, 10 Pa |
| 27 | beadArea | u8 / 255 | bead-covered area fraction a_beadMax x bead load / b_max |
| 28 | dropDuty3, dropDuty10 | 2 x log u8 | |
| 30 | depthImm | f16 | mm of water above the cell while immersed |
| 32 | reservoir | u16 | basin or gap whose liquor the immersed share sees; 0xFFFF none |
| 34 | renew | f16 | 1/s, catchment-based (below) |
| 36 | flags; widthFrac; spare | u16; u8 / 255; u8 | wetted width fraction of a RIVULET block, compared with the coverage rank of each soil cell |

`ReservoirLiquor`, 32 bytes per basin and gap (uploaded each tick from the CPU): level, temperature, alkalinity, total carbonate, protease, amylase, oxidant, filled flag (8 x f32).

**Effective exposure per tick** (pass W, one invocation per film cell; C §7.4, §7.5):

```
rec   = FilmExposure[active combo][label]                       label = transient for the first 2 revolutions after a diverter switch in the main-wash class
scale : gammaMean, depFlux by sQ;  hMean, tauMean, tauPeak by s_nu = (nu / nu_solve)^(1/3) sQ^(1/3);  renew by 1 / s_nu;
        tauDuty read at threshold / s_nu;   nu_solve is the viscosity at the solve temperature of the liquor class (M4)
merge : with t_s = time since the switch from state X' (or since the pump stopped):
        h_dd = DrainDown[X'] interpolated in log t between h2, h10, h60 and continued as t^(-1/2);   Gamma_dd = rho^2 g_s h_dd^3 / (3 mu)
        wet if wet in the record or t_s < tDewet[X'];   the remnant is a residual film of thickness h_dd with shear rho g_s h_dd
pump off: the record is the drain-down of the last active state alone
cascade cells: regime re-evaluated with the current contact angles (FILM during flowDuty if gammaPeak >= Gamma*_a(now), wet for a further
        t_dw(now); otherwise RIVULET with f from the closure of M7.3)
shares: sImm   = 1 if the block lies below the level of its lumped basin at this tick, or in a filled gap; else the record's immersed duty
        sFlow  = (1 - sImm) reached flowDuty
        sRes   = (1 - sImm) reached max( wetDuty - flowDuty, remnant share ) where the receding angle of the cell is below `soil.resFilmAngle`,
                 or (1 - sImm) x (share of the tick with t_s < tDewet) otherwise
        sSparse = (1 - sImm - sFlow - sRes) if depFlux > 0 or the block holds beads, else 0
quantities per state as in the wetness table of M8;  hRes = max(h_dd, record thickness below the flow threshold);  hBead = bead mass / (rho beadArea)
```

Because every steady record is solved from its own pilot state (M7.7), it contains no remnant of the other diverter state, and the remnant enters only through h_dd. The viscosity rescale was measured by C to within 2.5 % in mean thickness and shear for a 15 K shift and 6 % for 30 K (C §7.5). S-solved cells are not re-evaluated: their wetting map is that of the solve temperature and of the soil state at the solve. Two drift measures are reported per item and liquor class (`wettingDrift`): the area-time share of S cells whose receding angle has moved by more than `tl.wettingDriftAngle` since their solve, and the share of ticks in which the liquor viscosity differs from nu_solve by more than `tl.wettingDriftNu` = 25 % (the viscous dewetting speed scales with 1 / mu and the Hartley-Murgatroyd thickness with mu^(2/5), so between 20 and 55 C the first doubles and the second falls by 24 %). In the sizing programme the main-wash record is solved at 55 C and the viscosity flag is raised for the part of the heat-up below about 42 C, roughly a quarter of the class's time; section 7.4 lists the second solve temperature as the first use of spare budget. The reference tier solves the main-wash class at two temperatures and interpolates in ln(nu) (B §7.5; numerics §4.5).

**Catchment-based renewal.** renew = (Gamma W + depFlux A) / (rho h A_up): the liquor passing through a block per unit of film mass on its catchment. With A_up in place of the block's own area it does not depend on the cell size; it is the q_e / delta_e of chemistry §10.2.

**Block energy balance** (pass T; C §6.11):

```
C''_e dT_s/dt = f_flow U_e (T_liq - T_s) + (1 - f_flow) h_a (T_air - T_s) + (k_w / l_w)(T_mid - T_s) - j_e h_fg
U_e = ( 1 / alpha_fw + 1 / G_e )^(-1),   alpha_fw = 1.88 k / h_mean  (films §9.1),   G_e = c_p Gamma_e W_e / A_up,e
immersed share: the same form with T_liq replaced by the pool temperature and U_e = alpha_pool = `tl.alphaPool`
```

G_e limits the heat an element can receive to what the water above it carries, which reproduces "the lower part of a cold item sees cooler liquid" and a slow shadowed face without an advected temperature field; the chemistry dossier's constant 5,000 W/(m2 K) has no such limit and is not used. The closure is a quasi-steady one: its late-time constant C'' / U_e is that of a one-dimensional film energy balance, but after a step in liquor temperature it heats all of a catchment at once, where the true film gives up its heat from the top down. For Gamma = 0.035 kg/(m s) on a 0.25 m porcelain plate with a 35 K step it extracts 2.5 times the heat the film carries in the first instant and is 8 K high at mid-height and 11 K at the bottom during the first front transit, C'' A_up / (c_p Gamma W) = 11 s (`wallheat.py`). The liquor in this machine changes by 1.5 K per minute while heating and steps only at fills, so the error is a few tens of kelvin-seconds per step against a rate integral over thousands of seconds; it is stated in section 11.3 and tested with a tolerance that says so. Walls have a surface node per face and a shared mid node (ceramic, glass, plastic) or one lumped node (metals), with the properties of films §9.2. h_a = 30 W/(m2 K) on unwetted faces includes condensation (chemistry §10.10); the condensate is added to the block's deposition as water without detergent or enzyme (C §7.5). The balance is integrated with backward Euler (a two- or three-node solve per wall), because the surface time constant under a film is about 1 s, shorter than a tick. The summed heat uptake goes to M9 through an integer block reduction, so heat is conserved between liquor and load.

**Wetting-onset gate** (C §7.6). For each exposure set an onset-time field is computed once (by M7, with the R0 machinery, at the end of the periodic solve) by a min-plus accumulation over the cell graph (400 sweeps):

```
t_on,i = min( 0                                        if the block receives jet hand-over in this state,
              m_on,i / depFluxSmooth_i                  own collection time, with the onset mass of M2,
              min over donors j of ( t_on,j + d_ij / u_front,j ) )       arrival of a film from an already wetted block
```

Each block carries a progress P_i (f32) advanced by dt / t_on,i[active combo] per tick (condensation adds its own flux) and reset when the block has been dry for longer than its evaporation time in drying. `reached`, the factor that multiplies the film states of the block in pass W, is the fraction of the tick that lies after P_i = 1. Before that the block is in the sparse state: its bead mass is P_i m_on, its soil hydrates from what lands on it, and nothing that needs a continuous film (film shear, the Leveque coefficient, flowing-film chemistry, dissolution) acts. m_on is the same threshold the film solvers use, so the gate opens when the cascade's own regime machine would: after 2 to 3 s at 1 % of the reference flux on glass and glaze in wash liquor, 16 s on steel and polypropylene; after 20 to 160 s at 0.1 %; a glass face is not wetted within the main wash below 6 x 10^-7 kg/(m2 s), a polypropylene face below 5 x 10^-6 (`budget3b.py`). This gate is what stops the asymptotic periodic record from wetting sparsely rained surfaces at once, and it is used for S-solved and cascade blocks alike (A and B accumulated beads only over their 57 to 85 simulated seconds).

**Film composition** (C §8.4; chemistry §10.2). Each block carries four fill fractions (pre-rinse, main wash, intermediate rinses, final rinse) relaxed exactly, phi_k <- d_k + (phi_k - d_k) exp(-renew dt), with d_k = 1 for the current fill. They are stored as u16: the four values are computed in f32, rounded down, and the units missing from 65,535 are given to the entries with the largest remainders, so the sum is exact and a fraction keeps moving until it is within 0.5 % of its target at a renewal of 10^-3 1/s (a u8 would freeze at 0, 62 % and 89 % for renewals of 0.001, 0.003 and 0.01 1/s). The liquor a soil cell sees is the phi-weighted mixture of the current liquor and the stored end-of-phase liquors, mixed in conserved quantities with the pH read from the table of M9. Blocks with renew above `tl.renewWellMixed` are indistinguishable from the sump.

**Local stores of dissolved soil** (chemistry §10.2, the source terms s_e and S_p). Pass T routes the `BlockRelease` of each block by where the soil dissolved:

```
immersed share        -> the basin or gap reservoir of the block (integer units, reduced per reservoir)
renew >= renewWellMixed -> the sump
otherwise             -> the block's local store:  d(m_loc)/dt = release - renew m_loc;  what the film carries away, (1 - exp(-renew dt)) m_loc, goes to the sump
particles released under a film that is not well renewed stay where they are: they are added to the block's speck intensity
```

A local store that is still loaded when its block dries is deposited there as residue (dissolved classes) and as fat film. Every release unit is in exactly one place: sump, local store, reservoir or deposit; the per-class ledger of M8 includes all four.

**Pools and gaps** (CPU, per tick). dV/dt = Q_in - Q_spill per basin from the recorded inflows; the periodic records assume full basins, so until a basin is full its spill is suppressed in the pool ODE while the drips it would send to items below remain in the records (over-counted for 33 s to 3 minutes for a 400 mL cup; listed in section 11). The level gives the immersed blocks and the depth of water above each (`Basin.heightOfBlock`), which pass W writes into `depthImm` for the jet attenuation of M8. Composition, temperature and settled solids:

```
V dc/dt   = eta_mix Q_in (c_in - c) + S_p (+ tablet release if the tablet rests in the basin),     integrated exactly per tick, pH re-solved (M9.mix)
eta_mix   = eta_short if more than half of the inflow lands within two blocks of the spill block; otherwise eta_through + (eta_jet - eta_through) x jet share of the inflow
settling  settled solids += v_s,k C_k A dt;   at each drain and at the end the pool's dissolved and settled content is deposited over its footprint
gap       V_g dc/dt = eta_gap Q_pass (c_film - c) + S_g,   Q_pass the recorded film flow past the mouth of the gap
```

S_p and S_g are the `toReservoirByClass` sums of the tick. A stain or a protein film under a pool therefore sees the pool's own liquor (which receives enzyme and oxidant only by exchange), no film shear, attenuated jets, and what it releases stays in the pool: "holds dirty water", as P01 requires. Pool mass is reported to M4 (V_trap) and to M11 (added mass).

**Tablet supply.** Each tick, for a released tablet: q_tab = mean over the blocks under the tablet of (depFlux + gammaMean / L_tab) from the effective exposure of the active set, L_tab the tablet length; w_tab = min(1, q_tab / q_ref). If those blocks are immersed in a basin, w_tab = 1 and the release goes into that basin. The resting place is the collecting tray in the sizing machine (machine geometry, known from the start) or the pose M11 reports. Because q_tab is read from whichever set is active, it exists from the first tick after release, when the active set is still the water-like one, and follows every change of set. The tablet is not a ray obstacle and spawning it opens no geometry epoch. A stuck tablet takes `liq.wStuck` (M9).

**Redeposition and carry-over** (chemistry §5.3, §10.7, §10.9; every rate [ESTIMATED]). Particles are liquor classes; what reaches a block is the liquor that reaches it, so the spatial pattern follows the water routing. All deposit fields are per block, on soiled and unsoiled blocks alike:

| Mechanism | When | Update per block |
|---|---|---|
| stranding of suspended particles | every pump stop followed by a drain | lambda_k += C_k,e min(delta_strand,k, h_5s) / m_p,k; delta_strand = 100 um (fines), 400 um (grit); h_5s from DrainDown |
| settling on upward faces in slow zones, in pools and gaps | every wet tick | lambda_k += n_k v_s,k max(n . z, 0) dt where tauDuty[0] (0.5 Pa) is below 0.1; pools: settled solids as above |
| flushing of earlier specks | every tick with flow | lambda_k <- lambda_k (1 - flowDuty) when the peak film is deeper than the particle |
| fat and soap film | every wet tick | j_fat = k_fat,dep C_fat,free a_sub (1 + 5 SFC(T_s)) f_wet |
| pigment uptake into plastics | with fat deposition | integral of j_fat C_pigment / C_fat with the 40 kJ/mol factor |
| dissolved residue | when a block, drop, bridge or pool dries | film and local store: h_end (C_TDS + C_0 + C_1) + m_loc; drops and bridges: V_d (C_TDS + C_0); pools: over the footprint |

The output is an expected speck intensity per block and size class. sim-core never draws discrete specks (section 5.6). Carry-over at each drain is computed: V_carry = V_res + films and beads (DrainDown at the time the next fill starts) + edge drops + bridges + gap stores + pools + water held in soil; the verified 0.3 to 0.5 L for a normal load (chemistry §5.6) is a validation target for the whole film model.

**Drying.** After the final drain the DrainDown record of the last state gives each block's film, bead load, edge drops and bridges and the late drips onto items below. Drying follows chemistry §10.11 in 10 s ticks on blocks: j_e = h_m (rho_v,sat(T_s) - rho_v,air) a_wet with the air nodes of M9; a_wet = 1 for a film, the bead-covered fraction for beads. Plastics stay wet because they hold beads and store little heat; both are state, not rules.

**Parameters.**

| Key | Default | Range | Tag | Source |
|---|---|---|---|---|
| `tl.alphaFw` film-to-wall coefficient | 1.88 k / h_mean | turbulent branch 0.0106 Re^0.3 Pr^0.63 k (g / nu^2)^(1/3) | [ESTIMATED] from [VERIFIED] Wilke | films §9.1 |
| `tl.alphaPool` pool-to-wall coefficient | 500 W/(m2 K) | 200 to 2,000 | [SYN] (natural convection in a small pool) | this section |
| `tl.hAir` unwetted faces in humid tub air, condensation included | 30 W/(m2 K) | 10 to 100 | [ESTIMATED] | chemistry §10.10 |
| wall material properties and thicknesses | table of films §9.2 | | [RECALLED] | films §9.2 |
| `tl.renewWellMixed` renewal above which a block takes the sump composition | 0.1 1/s | | [ESTIMATED] | chemistry §10.2 |
| `tl.deltaStrand` fines, grit | 100 um, 400 um | 50 to 300; 200 to 800 | [ESTIMATED] | chemistry §10.9 |
| `tl.kFatDep`; substrate factor a_sub | 10^-6 m/s; 1.0 (PP, PE, silicone), 0.4 (melamine, SAN, PTFE), 0.05 (glass, ceramic, steel) | factor 10 | [ESTIMATED] | chemistry §10.7 |
| settling velocities v_s of fines, grit | Stokes values for 80 um and 400 um particles of density 1,100 kg/m3 | factor 3 | [SYN] | chemistry §5.3 |
| `tl.onsetSweeps`; `tl.transientRevs` | 400; 2 | | [SYN] | C §7.6; M7.7 |
| drain-down extrapolation beyond 60 s | h proportional to t^(-1/2) | | [RECALLED] Jeffreys | films §8.1 |
| `tl.wettingDriftAngle`; `tl.wettingDriftNu` | 5 degrees; 25 % | | [ESTIMATED] | films §12.6 item 7 |

**Tests.**

| Test | Target | Tolerance |
|---|---|---|
| Wetted element heating | exponential with time constant C'' / U_e (11 s for 6 mm porcelain at Gamma = 0.035 kg/(m s) over 0.25 m) | 2 % |
| Supply-limited conductance against a one-dimensional film energy equation (films §4.2 eq. 5) down a cold plate after a 35 K step | wall temperature at top, middle, bottom | 1 K at the top; within 3 K after one front transit time and 1 K after three; up to 11 K earlier (stated error) |
| Replay against direct integration of one soil cell under a pulsed forcing resolved at 1 ms | residual mass history | 2 % |
| Onset, two-sided | uniform mist at 1 % and 0.1 % of the reference flux on glass in wash liquor and on polypropylene in clean water | sparse state before m_on / depFlux - 1 tick; film states from m_on / depFlux + 1 tick; soil water uptake before onset equals the delivered mass |
| Wetness shares | each of the five states produced from fixture F3 records and a pool level | shares sum to 1; quantities equal the M8 table |
| Fill fractions | renewals of 0.0005 to 0.1 1/s over 3,430 ticks | stored fraction within 1 % of 1 - exp(-renew t); the four always sum to 65,535 |
| Local store | a block releasing 10^-6 kg/(m2 s) under films with renew = 0.2, 0.01 and 0.0001 1/s | sump receives everything, a lagged share, almost nothing; ledger exact |
| Pool with a source | a stained cup floor under a full basin with exchange 1 mL/s: pool concentration against the analytic solution; soil reported as in the pool, not in the sump | 2 %; exact |
| Tablet flux | tablet on tray blocks under films of 0.02 and 0.002 kg/(m s); in a full basin; behind a stuck lid | w_tab = 1, 0.11, 1 (into the basin), w_stuck |
| Energy | heater input = liquor + tub + items + losses + evaporation | 0.5 % |
| Carry-over | full IEC load | reported; target 0.3 to 0.5 L |

**Cost.** Pass W: 100 bytes per film cell-tick; pass T: 200 bytes per block-tick (TimelineBlock in and out, a 16 byte thermal row, the effective exposure of its cells, BlockRelease); both at 0.6 of the traffic bound (section 7.1). With the soil kernel, reductions and CPU work: 66 to 101 s.

### M11. Rigid-body coupling (`@spotless/sim-rigid`)

**Responsibility.** Everything that can move during the wash: jet-mobile items, spray arms, the tablet. It builds its own `PhysicsWorld` for the wash from the settled poses of the load (Jolt at 1/240 s with the spike's preset, bit-identical reruns, sub-millisecond snapshot and restore [MEASURED]); the 1 ms step of A and B is superseded.

```ts
interface RigidCoupler {
  begin(create: CreatePhysicsWorld, items: readonly WashItem[], machine: MachineGeometry, mobile: readonly string[]): Promise<void>;
        // a new world with the 'wash' friction table (a world's pair lookup is fixed for its lifetime); mobile items dynamic and asleep, all others static
  shakeDown(points: readonly HydraulicPoint[], trace: (hp: HydraulicPoint, poses: ReadonlyMap<string, Pose>) => Promise<ItemLoads>,
            live: JetStage['liveWrench'], scene: () => Scene): Promise<RigidResult>;
  episode(hp: HydraulicPoint, live: JetStage['liveWrench'], scene: Scene, revolutions: number, wake: readonly string[]): Promise<RigidResult>;
  setAddedMass(item: string, massKg: number, comItem: Vec3): void;                          // pooled and held water
  armTorqueBalance(arm: number, drive: (omega: number) => number, friction: (omega: number) => number, inertia: number): void;
  spawnTablet(pose: Pose): string;  tabletRest(): { pose: Pose; blocks: Uint32Array; basin: number | null } | null;
  snapshot(): Uint8Array;  restore(s: Uint8Array): void;
}
interface RigidResult { poses: ReadonlyMap<string, Pose>; moved: readonly { item: string; dPos_m: number; dAng_rad: number }[];
                        arms: readonly { arm: number; state: ArmState; meanOmega: number; phaseTime?: Float32Array /* 256 knots, knocking arm */ }[];
                        contacts: readonly Contact[]; events: readonly RigidEvent[]; settled: boolean; simulated_s: number }
```

It needs four additions to `@spotless/physics`, whose `PhysicsWorld` today has none of them: `setMassProperties(id, mass)` to change a body's mass properties in place (pooled water); `contactWrench(id)` to read the contact force and torque on a kinematic body after a step (arm torque balance); `setBodyKind(id, kind)` to turn a static item into a dynamic one when an event shows it is mobile and to freeze a rattling one, keeping its id and creation order; and `awakeBodies()` to list the dynamic bodies that are not asleep (the live wrench is computed for those only). The wash friction table needs no addition: it is the pair lookup of the wash world. Forces are applied as per-step impulses with the existing `applyImpulse`; a zero impulse wakes a body.

**Shake the load down before computing exposure** (C §9.1). Items move when the jets first hit them, so motion is resolved first with loads that cost a second:

```
screen at load time (items §4.6): Pi_J,max = c_turn J_max / W >= 0.25  -> jet-mobile candidate (dynamic body, asleep); others static
after stage A and the first trace of every hydraulic point of the programme, in programme order at each point's highest pump speed:
  repeat up to 6 times, while the simulated-time allowance lasts:
    loads = ItemLoads (M5, a GPU trace with preview sampling, awaited);  candidates = items with max |F| > 0.25 m g or overturning moment about a support edge > 0.25 x restoring moment
    if none: break
    simulate 3 master revolutions with live wrenches on the awake bodies, at most `rigid.maxAwake` of them (largest load ratio first; the others stay asleep)
    if no item moved by more than 2 mm or 2 degrees between the ends of the last two revolutions: break
    update instance transforms, refit the top level, re-trace
the resulting poses are geometry epoch 0
```

The shake-down is bounded in simulated terms: `rigid.shakeBudget` = 40 simulated seconds in all (about 20 revolutions) and `rigid.maxAwake` = 12 bodies. An item still moving when the allowance ends is frozen where it is (`setBodyKind` static) and flagged `unsettled`. The shake-down contains no water, so a tub that would have tipped only once it had filled is caught later by the basin-fill trigger below.

**Live wrenches.** While a body is awake the jets are re-cast against it on the CPU at every engine step with `JetStage.liveWrench` (the f64 tracer and the momentum theorem of M5; only the sub-rays whose swept cone meets an awake body, a few hundred segment queries per body and step), so the load ends when the item leaves the jet and changes as it turns. With a frozen load table a 20 g lid under a 0.42 N jet would be pushed for the whole 0.19 s dwell and gain 2.1 m/s (items §4.4); B's open-loop wrench series is rejected for this reason. Pooled water adds mass and shifts the centre of mass; buoyancy applies only to items lying in the sump pool; droplet and film loads are neglected (under 10 % of a direct jet). The cost of the CPU tracer is not measured: MS0 measures it (section 9), and the shake-down allowance above is what bounds it until then.

**Arms** are kinematic bodies whose angular velocity is integrated by M11 from the torque balance of M4 with the contact torque read from the engine each step (`contactWrench`). Sustained zero speed for 1 s is a stall at that angle; periodic contact gives the phase-time table of a knocking arm. Either is a new arm state and therefore a new combo (M4) with its own exposure sets. A stalled lower arm therefore cleans a set of spots and stripes and starves the rest, with no rule about stalled arms.

**Events after the shake-down** (all triggers are simulated quantities):

| Trigger | Action |
|---|---|
| a basin's water changes an item's mass by more than 20 %, or a basin first fills | wake the item with its new mass properties; 2 revolutions with the active point's live wrenches |
| arm contact torque becomes non-zero | arm speed from the transient equation; if the item is pushed clear, the shake-down rule applies |
| dispenser opens | the lid's swept volume is tested; if free, the tablet is spawned as a body and falls (into the collecting tray on the upper basket in the sizing machine, which is machine geometry); `tabletRest` reports where it lies. If the lid is blocked the tablet stays in the cup and is `stuck` (M9) |
| end of the wash | final poses for the report |

If an event moves any item beyond the tolerance, or changes an arm state, a new **geometry epoch** begins. Exposure sets that have not been computed yet are computed on the new geometry when they are first needed (lazy ordering makes this free). Sets that exist and are needed again (the class in use, and the water-like class if a rinse is still to come) are recomputed under the reserve policy of section 7.3, which names the settings and what happens when the reserve is spent. Soil state lives on the item's surface and is carried across epochs unchanged. A rattling item is frozen at the pose it had at the end of its window and reported `unsettled`.

**Parameters.** Screening threshold 0.25 and tolerance 2 mm / 2 degrees (items §4.6 [ESTIMATED]); wash friction table (items §11, 0.15 typical hard item on coated wire [ESTIMATED]); stall torque from M4; `rigid.shakeBudget` 40 s and `rigid.maxAwake` 12 [SYN].

**Tests.** Tipping of an inverted cup at F > W R / (R + e) (items §4.4), 5 % in threshold force; the 20 g lid over a 0.42 N jet leaves the jet within a few centimetres and gains under 1 m/s; lower arm stalls at 0.07 N m and reports a stalled arm state; a light polypropylene tub over a strong jet tips in the shake-down, and an identical tub that only tips when its basin holds 100 mL is caught by the fill trigger; snapshot, restore and replay reproduce the state hash; shake-down of the spike's full load converges within 6 rounds and 40 simulated seconds.

**Cost.** Engine: 0.2 to 1.0 s of wall time per simulated second (4.2 ms per step with the full load awake, 0.75 ms with sleeping [MEASURED]). Live wrenches: unmeasured, planned at 0.2 ms per awake body and step. 30 s budgeted for the usual case (few candidates, one or two rounds); the allowance of 40 simulated seconds with 12 awake bodies bounds the reserve at 100 s.

### M12. Orchestrator (`@spotless/sim-core`)

**Responsibility.** The stage graph of section 2, tiers, the exposure cache, reserves, checkpoints and resume, progress, result assembly, failure handling.

```ts
interface WashInput {
  simVersion: string;                                         // MAJOR.MINOR.PATCH
  machine: MachineSpec;  machineConfig: MachineConfig;         // @spotless/machine
  programme: ProgrammeSpec;  detergent: DetergentSpec;  rinseAid: RinseAidSpec;  supply: SupplySpec;
  items: readonly WashItem[];                                  // sorted by itemId; poses are the canonical rounded poses of the LoadManifest
  levelSeed: number;  simSeed: number;                         // u32
  tier: 'official' | 'fast' | 'preview' | 'reference';
  developer?: { params?: Record<string, number>; bracket?: boolean; supplyBracket?: boolean; sigmaReplay?: boolean;
                wettingFeedback?: 'coupled' | 'frozen'; diagnostics?: boolean };
}
function wash(input: WashInput, env: { gpu: GpuContext; cache: ExposureCache; checkpointDir: string; onProgress(p: Progress): void }): Promise<WashResult>;
```

- **Canonical input.** The wash consumes the settled load as stored in the `LoadManifest`: positions rounded to 0.1 mm and quaternion components to 10^-4 (benchmark §4.6). Identical manifests give identical reports on one stack.
- **Lazy, ordered exposure.** `exposure(combo)` runs stages C to G the first time the timeline needs a combo, with the geometry epoch and the soil-dependent wetting summary of that moment. Everything else it uses is fixed before stage C: the hydraulic point at the class centre and full prime, and the liquor properties at the solve temperature of the class (M4). In `wettingFeedback: 'frozen'` (developer only) the wetting summary is that of the initial soil state, so a cached set is reused whatever the soil model does.
- **Cache key** of an exposure set: SHA-256 of the canonical JSON of every value that is passed to stages C to G, and nothing else: {stack string, simVersion, exposure schema, tier and variant, the hydro parameter hash, machine geometry and nozzle-table hash, the `HydraulicPoint` (pump speed, arm states and phase tables, nozzle flows), `LiquorProps`, geometry hash (shapes, canonical poses, epoch), the hash of the quantised `WettingSummary` that `wetParams` consumes, levelSeed, simSeed}. The pilot result and the deposition tables are keyed by the subsets they depend on (no liquor class for the tables). Soil, liquor and timeline parameters are not in the key: a change of `soil.kuE` reuses every set whose wetting summary is unchanged, and with `wettingFeedback: 'frozen'` all of them, which is what makes a soil-side evaluation cost 1 to 2 minutes. Acceptance test `cache-equivalence`: a run with a cold cache and a run with a warm cache give the same report hash.
- **Work prediction.** Before stage C the orchestrator computes the run's work (stage-updates, block-steps, segment queries, cell-ticks, from the scene, the level schedules of a preview trace and the plans) and converts it to predicted seconds with the frozen planning rates of the tier definition (constants, never the clock). The prediction selects the reserve policy (section 7.3) and feeds the progress bar.
- **Failure classes.** Infrastructure failure (non-finite count, saturation count, ledger violation above its fail threshold, buffer exhaustion, leak fraction, device loss that cannot be resumed): the run is retried once and then the level is flagged; it is never scored as zero (benchmark §4.6). Quality flags (`hydroUnconverged`, `unsettled`, `exposureApproximate`, `wetAssumptionMismatch`, `wettingDrift`, `handoverClipped`, `supplyLimitedArea`, `cflRaises`) do not fail a run; they are in the report. Target: fewer than 1 infrastructure failure in 500 washes, measured by a fuzz campaign of 1,000 random loads at the preview tier and 50 at the official tier per release.
- **Checkpoints** at stage boundaries and every 512 ticks.

### M13. Verification (`@spotless/sim-verify`)

f64 TypeScript reference implementations of every kernel (tracer, gather, parcel flight and wall rules, R0, K, S on a single patch, LINE, soil step, block passes); the conservation audits of section 8.2; the phenomena harness of section 8.3 (A/B pairs); the tier gates of section 7.6; the fuzz campaign; the probe suite runner; the parameter lint (no numeric literals in kernels or references beyond those M2 allows); and one test per number that this document quotes from a throwaway script (supply factors, onset masses, level table, transition cap, budget arithmetic), so that the document cannot drift from the registry. GPU kernels are compared with the references within stated tolerances, never bitwise (the GPU fuses multiply-adds, [MEASURED]). M13 depends on every module and nothing depends on M13: functions that production code calls live in M2 and M5.

---

## 5. Exposure records and whole-cycle integration

### 5.1 What an exposure set holds

For one combo: `JetExposure` at three viscosity points (per soil cell near tracks), `FilmExposure` with the label steady and, in the main-wash class, transient (per film cell of that class's grid), `DrainDown` (per block), the onset-time field (f32 seconds per block), the jet-wet table of each active arm (64 bits per block), and a `StateSummary`. Little-endian; f16 is IEEE half precision in the scaled unit given (never an SI value below 6 x 10^-5); "log u8" stores v = v_min (v_max / v_min)^(code / 255) with code 0 meaning zero. These records are outputs written once from f32 or integer statistics; nothing accumulates in them. The layouts are a versioned schema (`exposureSchema: 1`) with packing round-trip tests and synthetic-signal tests; they are the frozen interface between the hydrodynamics and soil teams.

```ts
interface ExposureSet {
  key: string;  combo: ComboId;  epoch: number;  liquor: LiquorProps /* at the solve temperature */;  grid: 'block' | 'classD';
  jet: readonly JetRecordSet[];                             // three viscosity points, each with its tile table
  film: { steady: GPUBuffer; transient?: GPUBuffer };       // FilmExposure per film cell; no transient outside the main-wash class
  drain: GPUBuffer;                                         // DrainDown per block
  onset: GPUBuffer;  jetWet: readonly GPUBuffer[];          // f32 seconds per block; per active arm, 64 bits per block
  summary: StateSummary;  loads: ItemLoads;  approximate: boolean /* computed under a reduced reserve setting */
}
```

### 5.2 FilmExposure: 32 bytes per film cell, per combo and label

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0 | gammaMean | f16 | g/(m s) | time-mean mass flow per unit width leaving the cell |
| 2 | gammaPeak | f16 | g/(m s) | largest phase-bin mean (64 bins of the master arm) |
| 4 | hMean | f16 | um | time-mean film thickness while flowing (inside the wetted width for the cascade) |
| 6 | tauMean | f16 | Pa | time-mean wall shear while flowing |
| 8 | tauPeak | f16 | Pa | largest phase-bin mean |
| 10 | depFlux | f16 | g/(m2 s) | time-mean mass arriving from the air (smoothed where sparse) |
| 12 | renew | f16 | 1/s | time-mean renewal rate, catchment-based: (Gamma W + depFlux A) / (rho h A_up) |
| 14 | mfMean, mfPeak | 2 x log u8 | N/m | film momentum flux per unit width while flowing, mean and largest bin mean (10^-4 to 10) |
| 16 | flowDuty | u8 / 255 | - | fraction of the period with h above the flow threshold (30 um) |
| 17 | wetDuty | u8 / 255 | - | fraction of the period film-wet |
| 18 | beadFrac | u8 / 255 | - | time-mean b / b_max while not film-wet |
| 19 | widthFrac | u8 / 255 | - | time-mean wetted width fraction while wet (255 for S-solved cells) |
| 20 | tauDuty[4] | u8 / 255 | - | fraction of the period with film shear above 0.5, 1, 2, 4 Pa |
| 24 | dropDuty3, dropDuty10 | 2 x log u8 | - | area-time fraction under droplet impacts with stagnation shear above 3 and 10 Pa (10^-6 to 1) |
| 26 | immersed | u8 / 255 | - | fraction of the period submerged in a pool resolved by the S solver, or in a lumped basin taken as full, or in a filled gap |
| 27 | dryMax | u8 / 255 | - | longest dry interval over the period |
| 28 | srcSplit | u8 | - | two bits each: share of arriving liquid from jet hand-over, airborne droplets, drips, film inflow |
| 29 | spread | log u8 | - | relative difference of gammaMean between the two recorded revolutions (10^-3 to 10) |
| 30 | flags | u8 | - | bits 0-1 regime at the end of the period; 2 receives jet hand-over in this state; 3 in a pool; 4 stagnant gap; 5 gutter row or drip site; 6 sparse deposition; 7 S-solved |
| 31 | tauDuty10 | log u8 | - | fraction of the period with film shear above tau* = 10 Pa (10^-4 to 1) |

The four low shear levels sit where gravity films live (0.4 to 5 Pa) and where the starch threshold is (1 to 2 Pa); A's levels of 1, 3, 10, 30 Pa put two of four above anything a gravity film produces (J-phys). The level at tau* carries the film that the fan hands over while it is still above the protein threshold: inside vessels the fan often ends at a second fold or at the Gaussian bound 15 to 25 mm from the stagnation point, where the closure still gives tens of pascals, and without this level the jet-assisted erosion term would stop at the fan limit. Duties are numbers of 4 ms samples over the samples recorded (M7.8).

### 5.3 DrainDown: 8 bytes per block, per combo

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0 | h2, h10, h60 | 3 x f16 | um | film thickness 2, 10 and 60 s after the sources stop |
| 6 | tDewet | log u8 | s | time at which the block leaves the wet regimes (0.01 to 60 s; 255 = stays wet) |
| 7 | endState | u8 | - | bits 0-3 final bead load in sixteenths of b_max; 4 edge drop remains; 5 capillary bridge; 6 in a pool; 7 received drips after the sources stopped |

### 5.4 JetExposure: 56 bytes per soil cell, per (diverter state, pump class, arm state, viscosity point)

Allocated per 8 x 8 tile of soil cells touched by any fan (a u32 tile table gives the offset or 0xFFFFFFFF). Times are per master revolution; an arm with a different period contributes its own revolution scaled by T_master / T_arm. The gather sums in f32 and converts once; every u16 time saturates at 65,535 (a stalled arm holds a cell above threshold for the whole revolution).

| Offset | Field | Type | Unit | Meaning |
|---|---|---|---|---|
| 0 | tExcTau[8] | u16 | 2^-16 revolution, saturating | time with jet wall shear above 3, 5, 10, 20, 30, 50, 100, 200 Pa |
| 16 | tExcM[8] | u16 | 2^-16 revolution, saturating | time with film momentum flux per unit width above 0.25, 0.5, 1, 2, 4, 8, 16, 32 N/m |
| 32 | tauPk | f16 | Pa | peak wall shear |
| 34 | MPk | f16 | N/m | peak momentum flux per unit width |
| 36 | pPk | log u8 | Pa | peak wall pressure (10 Pa to 100 kPa) |
| 37 | nPass | u8 | - | passes per revolution that reach the cell (saturating) |
| 38 | restMax | u8 | 1/256 revolution | longest interval between passes |
| 39 | flags | u8 | - | bit 0 droplet-train majority; 1 pre-wetted correction applied; 2 track clipped by an edge; 3 fold crossed; 4 capped boundary-layer zone; 5 slot sub-jet |
| 40 | event[4] | 4 x {phase u8, tauPk log u8, MPk log u8, t10 log u8} | | the four strongest passes in phase order: phase (1/256 revolution), peaks, time above 10 Pa (10^-5 to 1 s) |

For the soil laws of M8 the exceedance curves and peaks are sufficient statistics (J-phys); the four events and restMax exist for the optional loosened-layer law and for diagnostics. No pressure exceedance curve is stored: no soil law consumes one (A appendix A item 8).

### 5.5 The whole-cycle algorithm

```
wash(input):
  A   scene = await sceneBuilder.build(items, machine geometry, tier, levelSeed);  await soil.init(...);  await rigid.begin(...)
      solveT = machine.thermalPrePass(programme, heat capacity of the load)
  B   points = hydraulic points of the programme (free arms);  arm sweep;  dispenser lid test
      await rigid.shakeDown(points, trace with preview sampling -> jets.loads, jets.liveWrench)      -> geometry epoch 0, arm states
      predictedWork -> reserve policy A, B or C (section 7.3);  first checkpoint
  H   controller = machine.controller(programme);  feedback = initial
      loop:  tick = controller.next(feedback);  if tick is null: break                              # integer tick index n
        CPU   programme events of the tick: fill, drain, heater, dispenser (lid test, tablet body), rinse aid, diverter, pump speed
              liquor.step(tick, release[n-1], heat[n-1], tablet supply[n-1], deposits[n-1], reservoir exchange[n-1])   # 0.25 s sub-steps, one tick of lag
              pools, gaps: levels, compositions and dissolved soil from the recorded inflows and release[n-1];  ReservoirLiquor table
        if tick.combo is set and no exposure set exists for (tick.combo, epoch):
              X = await exposure(tick.combo)                                               # stages C to G, or a cache hit; replay state evicted meanwhile
        GPU   pass W  (film cells)   wetness shares and effective exposure for this tick              (M10)
              soil kernel (soiled blocks) -> SoilCell, BlockRelease                                   (M8)
              pass T  (blocks)       temperatures, fill fractions, onset progress, condensation, local stores, deposits, routing of BlockRelease
              reductions             release by item, class and sink; heat uptake                     -> release[n], heat[n]
        CPU   tablet supply from the effective exposure under the tablet;  feedback = { liquor temperature and class, inventory terms, arm states, tick period }
        every 64 ticks:  drift monitors;  rigid-body triggers (may open a new epoch and draw a reserve);  checkpoint test
        at each drain:   stranding, carry-over
  I   final drain-down merge;  drying ticks of 10 s;  end-of-phase deposition;  assemble WashResult
  J   write caches and the result

exposure(combo):                                    # computes both diverter states of the (pump class, liquor class) pair together
  soilSummary = await soil.wettingSummary(grid of the class)
  for each diverter state X of the pair:
    liq = LiquorProps(class, solveT[class]);   wet[X] = await film.wetParams(scene, liq, soilSummary, grid)
    C   ft[X] = await jets.trace(scene, machine.point(combo of X))    reused if this (X, pump class, arm state) was traced in this epoch
    E   means = await jets.emitterMeans(ft[X], scene, liq);   pilot tables = spray.monteCarlo with 10^7 parcels from jets.sources(ft[X]) of the trace alone,
        walls wet where the means give hand-over and elsewhere by material
        pilot[X] = await film.pilot(scene, wet[X], means, pilot tables)     -> steadyWet, h_res, rain density, parcel importance, initial FilmState
    D   ft[X] = await jets.completeFootprints(ft[X], scene, liq, pilot[X].hRes, rain)
        for nu in {nu(20 C), nu(45 C), nu(65 C)}:  JetExposure[X][nu] = await jets.gather(ft[X], scene, liq at nu)
        emitters[X] = await jets.emitters(ft[X], scene, liq, grid);   sources[X] = jets.sources(ft[X])
    F   dep[X][arm] = await spray.monteCarlo(...)  for each active arm        reused per (X, pump class, arm state): no liquor class in its key
    G   steady:  await film.periodic(init = pilot[X].init, plan = 2 settle + 2 steady)  -> FilmExposure[X].steady, onset[X], StateSummary[X], F[X]
        drain:   await film.drainDown(init = F[X], 60 s)                                -> DrainDown[X]
  G   main-wash class only, for each X:  await film.periodic(init = F[X'], plan = 2 transient)   -> FilmExposure[X].transient
  store the two exposure sets under their cache keys
```

Within one tick a soil cell is hydrated and weakened for the whole tick first (one implicit solve), then the removal rules are applied with the tick's exceedance times and peaks. Hits in different revolutions are resolved individually; re-hydration between two hits inside one revolution is not (its effect is of the order of the period over the swelling time, under 2 %; C §7.4). There is no cycle jumping and no homogenisation beyond one revolution: the soil kernel is cheap enough to take every revolution (soils §7.8; all three proposals rejected the projective steps of numerics §4.3). In developer mode a 1 % hashed subset of soil cells is also integrated with the explicit event sequence at 1 ms resolution during passes and the difference in final residual is reported (A §7.5).

### 5.6 The result contract

The result is representation-independent, so the inspector, the renderer and the report do not depend on patch internals (J-del). Every array has a stated shape; N_e is the number of soil elements of the item, N_d the number of deposit rows, C_s the number of soil appearance classes of the catalogue (the result lists them), C_p = 2 the speck size classes (fines, grit).

```ts
interface WashResult { provenance: Provenance; soilClasses: readonly string[]; items: readonly ItemWashResult[]; machine: MachineWashResult; diagnostics?: Diagnostics }
interface Provenance { stack: StackString; simVersion: string; tier: string; variant: string; hydroHash: string; soilHash: string; inputHash: string;
                       levelSeed: number; simSeed: number; exposureSchema: number; shaderHashes: Record<string, string>; reportHash: string }
interface ItemWashResult {
  itemId: string;
  regionIds: readonly string[];                 // SurfaceRegion ids of the item's Shape, in Shape order
  elements: {                                   // one row per soil cell of every block that was soiled at the start: N_e rows
    count: number;                              // N_e
    region: Uint16Array;                        // [N_e] index into regionIds; 0xFFFF = outside every region
    part: Uint16Array;  side: Uint8Array;       // [N_e] part index; 0 out, 1 in, 2 rim or edge
    centre: Float32Array;  normal: Float32Array;   // [N_e x 3] item frame
    param: Float32Array;                        // [N_e x 2] (sNorm, theta) on sor parts, (u, v) on faces
    areaMm2: Float32Array;                      // [N_e]
    cover: Float32Array;                        // [N_e] covered area fraction
    residual_mg_cm2: Float32Array;              // [N_e x C_s] per soil appearance class, per covered area
    fatFilm_um: Float32Array;  stain: Float32Array;  particles_per_cm2: Float32Array;     // [N_e] each
    neighbours: { offsets: Uint32Array /* [N_e + 1] */; indices: Uint32Array };   // edge-sharing neighbours on the surface, across seams (for connected regions)
  };
  deposits: {                                   // what the wash left on the item, soiled or not: one row per block above a threshold, N_d rows
    count: number;                              // N_d; a block is listed if any of its values exceeds `result.depositFloor` (default: 0.01 specks per cm2, 0.01 mg/cm2)
    region: Uint16Array;  part: Uint16Array;  side: Uint8Array;                            // [N_d]
    centre: Float32Array;  normal: Float32Array;  param: Float32Array;  areaMm2: Float32Array;   // [N_d x 3], [N_d x 3], [N_d x 2], [N_d]
    speckIntensity_per_mm2: Float32Array;       // [N_d x C_p] expected redeposited specks
    residue_mg_cm2: Float32Array;               // [N_d] dried dissolved residue, including local stores that dried in place
    fatDeposit_mg_cm2: Float32Array;  pigment: Float32Array;                               // [N_d] each
    belowFloorTotals: { specks: Float32Array /* [C_p] */; residue_mg: number; fat_mg: number };   // sums over the blocks not listed
  };
  water: { pooled_mL: number; pools: readonly { volume_mL: number; dirty: boolean; dissolvedSoil_mg: number; settled_mg: number }[]; film_g: number; beads_g: number;
           edgeDrops: number; bridges: number; gaps_mL: number; afterDrying_g: number };
  motion: { moved: boolean; unsettled: boolean; maxDisplacement_mm: number; events: readonly RigidEvent[]; finalPose: Pose };
  flags: { hydroUnconverged: boolean; exposureApproximate: boolean; sparseWetting: boolean; wetAssumptionMismatch: number; wettingDrift: { angle: number; viscosity: number };
           handoverClipped: number; supplyLimitedArea: number };
  confidence: { mcSplitHalf: number; revSpread: number; epsWet: number; sigmaResidual?: number; supplyBracket?: [Float32Array, Float32Array]; bracket?: Float32Array };
}
interface MachineWashResult { arms: readonly { arm: number; stalled: boolean; knocking: boolean }[]; starvation_s: number; filterLoad_kg: number;
                              energy_kWh: number; water_L: number; carryOver_L: readonly number[]; temperatures: Float32Array /* [ticks] liquor */;
                              dispenser: 'free' | 'blocked'; detergentReleased: number /* fraction by the end of the main wash */ }
```

Rules of the contract: residual mass is reported, not a verdict; visibility thresholds, connected-region counting, the speck rule and the clean flag belong to the inspector. Deposits have one owner, the timeline's per-block state, and one table; soil elements carry only what was put on the item before the wash. Stranding touches every wet block at every drain, so without the floor the deposit table would have a row for every block of the load (2 million); with it the sub-threshold remainder is reported as totals. sim-core never draws discrete specks. Its recommendation to the inspector is to score from the expected speck count (or a fixed quantile of the Poisson distribution) so that the verdict on an otherwise clean item is not a random draw (J-del). `param` with `part` and `side` is the mapping the renderer needs to texture residue onto the render mesh.

---

## 6. Determinism rules

Requirement: the same inputs, seed, tier and stack give the same report hash, whether the caches are cold or warm, whether the run was interrupted or not, and in whichever process it runs. Across stacks agreement is statistical. Every module follows this checklist; M1 enforces what can be enforced mechanically.

1. **Fixed work.** The tier fixes every count, step and schedule before the run. Run-time branches (convergence extension, level raises, epochs, reserve policy) depend only on simulated quantities and on the pre-run work prediction. Nothing reads the wall clock, the thermal state or a frame time.
2. **Time is an integer.** Base-step counters, u32 arm phases, tick indices, sample counts, dewetting counters and cumulative wet time (milliseconds) are integers. f32 integrates dimensionless progress variables (onset progress, lag progress) and physical state, never a clock.
3. **Scatter is integer.** Every many-to-one accumulation on the GPU uses `atomicAdd` on i32 or u32 fixed point [MEASURED for an integer scatter: bitwise order-independent]. Float compare-exchange accumulation [MEASURED: not reproducible] is banned by lint. No target has more than a few tens of writers per dispatch (M1).
4. **Float accumulation is a gather.** One invocation writes one element and sums a stored list in stored order (jet gather, cascade inflow shares, Jacobi sweeps, stencils, smoothing windows) [MEASURED for an add, multiply and divide stencil: bitwise identical across runs, workgroup sizes, batching, devices, processes; other operation classes are covered by the probe suite, not by that measurement].
5. **Many-to-few reductions are integer.** Anything that feeds a branch or a ledger is reduced by the integer block reduction of M1 (whole-buffer or segmented), or read back and summed on the CPU in index order. Maxima are per-tile values written by one invocation each and reduced on the CPU.
6. **Accumulators are double-buffered.** A deposit accumulator is read only in dispatches that follow all writers of the step it belongs to; writers for the next step add to the other buffer; a buffer is cleared only after its last reader. The order of passes and time-step levels is the table of M7.1 and is tested.
7. **No narrow accumulators.** No f16, u8, u16 or log-coded field may accumulate state across ticks or steps. Such fields hold static geometry, packed outputs, statistics that are written whole (maxima, snapshots, copies), or integer counters whose largest possible value is registered and checked at plan time. M1 rejects anything else at buffer registration, and every accumulating field has a test that 3,430 equal increments sum correctly. Compensated summation is not used (the shader compiler may reassociate it away, numerics §6.3).
8. **Random numbers** come only from `hashU32` / `rng_hash*` of `@spotless/core`, keyed (seed, domain, entity ids, index). Keys are lineage and surface coordinates, never buffer slots or tier-dependent block indices. Level-owned fields (soil pattern, contact-angle offsets, rivulet lanes and coverage ranks, both keyed by the coarse block) use the level seed; wash-owned draws (arm start phases, parcels, drip-site offsets, stochastic rounding of momentum statistics) use the sim seed. Parcel streams are nested across tiers; sub-ray patterns are not (M5).
9. **Transcendentals are declared.** A kernel may call sqrt, exp, log, pow, a cube root, trigonometric functions and atan2; `KernelDef.uses` lists every class it calls: the S stage (sqrt, pow), the cascade's Newton step (pow), the hit map (atan2), the gather (sqrt, pow, sech through exp), the parcel kernels (sqrt, exp, pow), the soil kernel (exp, pow, log10, cube root). Their results are reproducible on one stack only, and a changed probe hash names the kernels affected. Functions of slowly varying scalars (temperature) are tabulated on the CPU to save arithmetic, not to hide a transcendental.
10. **Tables are interpolated in the kernel.** Closure tables and rate tables are read with `textureLoad` and explicit interpolation; hardware filtering is not used.
11. **CPU work** is single-threaded f64 in a fixed order, or fixed-partition worker tasks whose results do not depend on scheduling; sorts are stable; tree builds break ties by primitive id; no iteration over unordered collections (platform.md §2).
12. **Failure, not truncation.** Buffer exhaustion, non-finite values, a saturated integer field, a ledger beyond its fail threshold or a leak fraction above 10^-6 fail the run. The non-finite test is on bit patterns (M1).
13. **Provenance.** The full stack string (simulator version, GPU, operating-system build, `webgpu` version, runtime, physics engine) is part of every result, cache key, checkpoint and golden hash. An operating-system update or a bindings update is a version bump for caches and golden hashes, and the probe hashes are re-recorded [MEASURED: the particle kernel changed bits across the macOS update with the same Dawn build].
14. **Cache equivalence.** A cache key covers every value passed to the computation it keys and nothing else (M12), and every such value is quantised before it is both hashed and used.
15. **Verdicts across stacks.** Official scores come from one declared reference stack. sim-core reports continuous margins; an item whose margin lies inside the dead band (default: residual area within a factor 1.25 of a band edge, or a speck expectation within 0.5 of a count edge) is flagged `marginal`. A new stack is accepted by the tolerance gate `cross-stack`: on the golden set, at least 99 % of clean flags agree and every disagreement is flagged marginal.
16. **Resume.** A run resumed from any checkpoint reproduces the report hash.
17. **References.** CPU reference implementations are compared within tolerance, never bitwise.
18. **Invariance tests.** Every kernel passes a shuffle test (inputs submitted in permuted order), workgroup-size invariance and batching invariance.
19. **No bitwise claims on paired floats.** Two call sites that compute the same flux are not assumed to agree in the last bit; conservation is asserted to tolerance for float fields and exactly for integer ledgers.

**The reference stack and where the hours run.** The reference stack is a stack string, not a serial number. The gates and campaigns of this document add up to about 700 machine-hours of full GPU load per major version (tier gate 130, benchmark §4.6 536, p95 and fuzz runs), which is not work for one laptop. Decision: a second machine of the same model, operating-system build and bindings is the campaign machine. It is admitted by the test `cross-machine` (every golden hash and every probe hash identical to the reference machine); until it passes, the two are different stacks and the second one's scores are provisional. Schedule: per commit, the unit tests and the hash tests at the fast tier (`repro-2`, `resume-hash`, `cache-equivalence`, `second-process`, about 15 minutes); nightly, the same four at the official tier on one golden load (about 2 hours); per major version, the gates. After an operating-system update the probe suite and the 12 golden loads are re-recorded (about 5 machine-hours) and the caches are dropped.

Acceptance tests: `repro-2` and `repro-5` (two or five washes of a golden load give one report hash), `resume-hash`, `cache-equivalence` (cold against warm cache), `second-process` (the same wash in a fresh process), `cross-machine`, `cross-stack`, the probe suite, and the per-kernel invariance tests.

---

## 7. Compute budget

All figures from `budget3.py`, `budget3b.py` and `budget3c.py` [SYN]. Element counts are those of section 3.8; the programme is the sizing programme (section M4): 6 time-marched combos, 28 master revolutions (56 simulated seconds, 28,928 base steps, 16,384 of them recorded), 6 drain-downs of 60 s, about 3,430 ticks. No kernel of this design has been run; MS0 replaces every rate in this section.

### 7.1 One convention for planning rates

"Measured" is the spike's figure for a stand-in kernel on the target machine. Planning rates follow three rules, applied to every line:

1. **Memory-bound passes.** The spike's stencils moved 110 to 130 GB/s of unique buffer traffic (bytes read plus bytes written per element), whatever the arithmetic. A pass is planned at 0.6 x 110 GB/s divided by its bytes per element, counting every buffer it binds (the tables of M7.1, M8 and M10). The factor 0.6 covers branches, gathers that are not perfectly coherent, a shared machine and everything not yet known.
2. **Arithmetic-heavy passes** (more than about 300 flops per element) are also capped at 0.6 TFLOP/s divided by their flops. 0.6 TFLOP/s (160 flops x 3.9 G/s) is the highest arithmetic rate the spike demonstrated, in a kernel that was still memory-bound, so it is a floor on the capacity, not an estimate of it. The S kernel and the jet gather are planned at this floor; they may turn out two or three times faster, and section 7.4 says what is done with that.
3. **Traced work** is planned at one third of the measured rate of the slowest matching ray class on a triangle hierarchy. Parcels are incoherent short segments (182 to 201 M/s measured): 60 M segment queries/s. Jet bundles are coherent (290 to 365 M/s; 150 M/s for a mixed batch) and are planned at the same 60 M/s. The third pays for the unmeasured analytic structure or for the triangle fallback with analytic polish, and for drag, wall rules, random numbers and atomic deposits.

| Kernel | Measured stand-in | Bytes; flops | Planning rate |
|---|---|---|---|
| Segment query, jets and parcels | 100 M rays/s incoherent, 290 to 365 M coherent, 150 M mixed; 182 to 362 M for 1 cm segments | | 60 M/s |
| S stage update | 4.0 G cell-updates/s at 32 B and 80 flops | 48; 1,000 | 0.60 G/s (rule 2; rule 1 alone gives 1.4) |
| S apply | same | 76 | 0.87 G/s |
| K block step | 1.2 to 1.6 G/s indexed stencil | 84; 400 | 0.79 G/s |
| Film statistics sample | stencil | 176 | 0.38 G/s |
| R0 sweep | stencil | 40 | 1.65 G/s |
| Jet gather | none | compute bound, 300 flops and two transcendental calls per pair | 0.2 G (cell, sample) pairs/s |
| Soil cell-tick | none | 340; 1,100 | 0.19 G/s |
| Pass W; pass T of the replay | stencil | 100; 200 | 0.66; 0.33 G/s |
| Rigid bodies | 4.2 ms per step awake, 0.75 ms sleeping, full load | | 0.2 to 1.0 s per simulated second, plus the unmeasured live wrench |
| Sustained load | 91 % of the initial rate at worst over 7 minutes; no 30 minute run yet | | all totals divided by 0.9 |

### 7.2 Official tier (planned variant S-split)

Work per pass, then seconds (typical 5.1 m2 / design 8.5 m2).

| Stage and pass | Elements x executions | Work (typical / design) | Rate | Seconds |
|---|---|---|---|---|
| A. Set-up: shapes to atlas and primitives, trees, cell graph, basins, gap rays, soil initial state, about 40 pipelines, uploads | 1.47 / 2.33 M blocks, 2.00 / 3.36 M soil cells | | mixed | 41 / 50 |
| B. Hydraulics, arm sweep, dispenser test, shake-down | usual case: one or two rounds | | | 30 / 30 |
| C. Primary jets: 2 pump classes x 2 diverter states | 4 x 2.0 x 10^8 segment queries | 8 x 10^8 | 60 M/s | 13 / 13 |
| D. Sector walks; gather, 12 record sets (2 x 2 x 3 viscosity points); emitter tables | 135 pairs per soil cell and set | 3.2 / 5.4 x 10^9 pairs | 0.2 G/s | 22 / 33 |
| E. Pilots: 6, on the official grid with preview sampling | R0 400 sweeps; 10^7 parcels x 12 segments | | | 26 / 27 |
| F. Monte Carlo: 9 x 10^8 parcels x 12 segments | | 1.08 x 10^10 segment queries | 60 M/s | 180 / 180 |
| G1. Film S, stage updates | 0.60 / 0.95 M cells at 2 mm x 28,928 steps x 6.2; 0 / 0.50 M cells at 1 mm x 11,520 class-D steps x 11.6 (as 0.125 M blocks x 6.2 in classes W and R) | 1.08 / 2.51 x 10^11 stage updates | 0.60 G/s | 180 / 419 |
| G1b. Film S, apply and clear every base step; statistics every second recorded step | 96 B per cell-step; 88 B per recorded cell-step | | rule 1 | 36 / 75 |
| G2. Film K, periodic, with statistics | 0.86 / 1.25 M blocks x 28,928 steps | 2.5 / 3.6 x 10^10 block-steps | 0.79 G/s | 52 / 76 |
| G3. Film K, drain-down: all blocks x 6 x 3,129 steps | | 2.8 / 4.4 x 10^10 block-steps | 0.79 G/s | 35 / 56 |
| G4. Time-coupled parcels | | 3.0 / 3.9 x 10^9 segment queries | 60 M/s | 50 / 65 |
| H. Replay: soil cells x 3,430 ticks x 0.8 active; pass W per film cell; pass T per block; reductions; liquor and pools on the CPU | 5.5 / 9.2 x 10^9 cell-ticks | | 0.19; 0.66; 0.33 G/s | 66 / 101 |
| I. End-of-phase passes, drying, outputs | | | | 20 / 20 |
| J. Checkpoints, cache writes, progress | 2 GB of state | 10 GB/s read-back | | 45 / 45 |
| **Sum** | | | | **797 / 1,189** |
| **With the 0.9 sustained-load factor** | | | | **886 s (14.8 min) / 1,321 s (22.0 min)** |
| of which GPU kernel time (C to H) | | | | 705 s (11.8 min) / 1,130 s (18.8 min) |
| GPU kernel allowance (spike report §12) | | | | 1,200 s |
| Cap | | | | 1,800 s |

Shares: film 44 % (typical) to 58 % (design), Monte Carlo 23 to 15 %, jets, gather and pilots 8 %, replay 8 %, set-up, shake-down, end passes and I/O 17 to 11 %.

Sensitivity of the plan (minutes, typical / design; GPU kernel minutes for the design load in brackets):

| Assumption changed | Result |
|---|---|
| S at 1.0 G stage-updates/s | 13.4 / 18.9 (15.7) |
| S at 0.4 G/s | 16.4 / 25.9 (22.7) |
| K at 0.4 G/s | 16.0 / 23.8 (20.6) |
| tracing at 36 M/s (every derating of rule 3 compounded with 0.6) | 17.9 / 25.4 (22.2) |
| tracing at 100 M/s | 12.9 / 20.0 (16.8) |
| jet-active share of S cell-time 0.15 or 0.40 instead of 0.25 | 14.1 / 20.4 (17.2) or 15.8 / 24.6 (21.4) |
| hand-over cap raised to 4.6 m/s (jet-active levels 4 and 5) | 16.9 / 27.1 (23.9) |
| all pessimistic together: S 0.4, K 0.5, tracing 36 M/s, soil 0.12 G/s, jet share 0.40 | 22.2 / 34.7 (31.5) |
| all optimistic together: S 1.0, K 1.0, tracing 100 M/s | 11.3 / 16.5 (13.3) |

The design load fits the cap and the GPU allowance at the planning rates with 1.2 minutes of GPU margin, and does not fit if several rates come out at their pessimistic values together. That case is not handled by hoping: section 7.4 lists the cuts in the order they are taken and what each one saves.

### 7.3 Reserves and the worst case

Every reserve is bounded in simulated terms and counted here.

| Reserve | When drawn | Bound | Seconds (typical / design) |
|---|---|---|---|
| Convergence extension | a monitor of M7.7 misses its target | 4 revolutions per run in all, at most 2 per state, in programme order | 46 / 91 |
| Extended shake-down | more than the usual one or two rounds | 40 simulated seconds, 12 awake bodies (M11) | 100 / 100 |
| Reduced re-exposure of the class in use: both diverter states, trace, pilots, gather, half the parcels, 1 settle + 2 steady revolutions per state, no transient record, drain-down on the fast schedule | first geometry epoch that invalidates sets still needed | once per run | 168 / 245 |
| Fast re-exposure of one class, on the run's own grid: 4,096 phases, a tenth of the parcels, 1 settle + 1 steady revolution per state, drain-down by Jeffreys' law per block; sets flagged `exposureApproximate` | the second class that the same epoch invalidates (the water-like sets if a rinse is still to come), or a second epoch | once per run under policy A, twice under policy B | 77 / 123 |
| Any further need | | none: the items concerned are frozen in their poses, existing sets are kept, and the items are flagged `unsettled` and `exposureApproximate` | 0 |

A geometry epoch during the main wash invalidates the main-wash sets in use and the water-like sets computed for the pre-rinse, which the rinses need again; the rinse-aid sets do not exist yet and are computed on the new geometry at no extra cost. That is why the policy provides for two re-exposures. Reserve runs use the grid of the run (tiers are nested, but a reserve needs no coarser grid), so nothing is prolonged between grids.

The reserve policy is chosen before stage C from the predicted base time (work counts times the frozen planning rates, never the clock):

- **Policy A** (predicted base time up to 17 minutes): one reduced re-exposure, then one fast re-exposure.
- **Policy B** (17 to 20.5 minutes): two fast re-exposures.
- **Policy C** (above 20.5 minutes): no re-exposure; a moved item is frozen and flagged.

Worst case with everything drawn (`budget3.py`): typical load, policy A, 22.0 minutes. A load at the top of policy A (17 minutes) 25 minutes; at the top of policy B 28 minutes; the design load, policy C, 25.6 minutes; a load at the level-lint limit of 24 minutes, 27.8 minutes. The bound holds because every reserve has a cap in simulated work and a third need is never recomputed (C §9.4; A's re-run triggers were uncapped, J-num). The expected p95 over levels is at or below 24 minutes.

### 7.4 Pre-agreed variants, cuts and uses of spare time

The variant is decided once, from the measurements of milestone MS0 and the gates of milestone MS3, and frozen in the version string. It is never chosen at run time. The table is over all measured rates, not the S rate alone: MS0 fills in `budget3.py` with its measurements and the first row whose condition holds is taken.

| Condition after MS0 and MS3 (predicted design-load time T_d and GPU time G_d with measured rates) | Official variant |
|---|---|
| S at least 1.0 G stage-updates/s, T_d of S-all at most 22 min and G_d at most 19 min, and gate P2 fails for flat ware (more than 10 % of plate area in a different wetting class, or mean shear off by more than 30 % on more than 10 % of the area) | **S-all**: flat ware joins class S2 (17.8 / 26.8 min at the planning rate of 0.6, 15.3 / 21.8 at 1.0 G/s) |
| T_d of S-split at most 24 min and G_d at most 19.5 min | **S-split** (planned): 14.8 / 22.0 min |
| otherwise, with T_d of S-mainwash at most 24 min | **S-mainwash**: S in the main-wash class only, the cascade on every block in classes W and R (13.2 / 18.3 min at S = 0.45 G/s; 14.6 / 21.6 at 0.25) |
| otherwise, or S fails its property, lake or pulsed-convergence tests | **K-only**; S stays in the reference tier (11.4 / 14.1 min) |

**Cuts inside a variant**, taken in this order when T_d exceeds 24 minutes or G_d exceeds 19.5 minutes with the measured rates (savings for the design load at planning rates): (1) the transient record of the main-wash class is dropped, its dwells use the steady record: 114 s; (2) rivulet-prone items run at 2 mm in the main-wash class too: 118 s; (3) parcel counts are halved, with the importance gain doubled: 100 s; (4) the next variant down. All four together bring the design load to 17.2 minutes.

**Uses of spare time**, in this order when T_d is under 20 minutes and G_d under 17 with the measured rates: (1) a second solve temperature for the main-wash class (35 C, warm-started from the 55 C state with 2 revolutions per state, interpolated in ln(nu)), which removes the viscosity drift of the heat-up: about 90 s for the design load; (2) the transient record in classes W and R: 170 s; (3) parcels at 4 x 10^8 and 2 x 10^8: 60 s; (4) the hand-over cap raised to 4.6 m/s with emitter levels 4 and 5: about 300 s; (5) 1 mm cells for all partially wetting materials in the main-wash class.

Other pre-agreed responses: analytic tracing below half the triangle rate switches to the triangle hierarchy with analytic polish; a soil kernel below 0.1 G/s halves the tick rate outside the main wash; a 30-minute soak that falls below 0.85 of the initial rate is treated as a lower rate in the table above. If gate P2 shows that the cascade is too coarse on cutlery (wetted fraction of a spoon bowl or fork off by more than a factor of 1.5 against the reference), the heads of cutlery (bowls, tines, blades) move to class S2. If it shows that 1 mm is too coarse on rivulet-prone plastics, class S1 moves to 0.5 mm for items below a per-level area cap enforced on the level's item pool at design time (B §3.1), never on the player's load.

### 7.5 Tiers

| Setting | Official | Fast | Preview | Reference (offline) |
|---|---|---|---|---|
| Block / S1 film cell in class D / soil cell | 2 / 1 / 1 mm | 4 / 2 / 2 mm | 4 / - / 2 mm | 1 / 0.5 / 0.5 mm |
| Film solvers | S on S-class, K elsewhere | same allocation | R0 with the pulsatility closure | S everywhere structured, 1 mm on all partially wetting materials |
| Arm phases; sub-rays | 16,384; 19 | 4,096; 7 | 2,048; 7 | 32,768; 37 |
| Slot sub-jets | nozzle table | same | same | same |
| Parcels per (diverter state, pump class): main-wash class / others | 3 x 10^8 / 1.5 x 10^8 | 3 x 10^7 / 1.5 x 10^7 | 10^7 | 1.2 x 10^9 |
| Revolutions | section M7.7 (28 in all) | 1 settle + 2 steady per state (18), no transient | none | 4 + 4, transient in every class, two main-wash solve temperatures |
| Time-step levels; hand-over cap | 0 to 5; 2.2 m/s | 0 to 5; 2.2 m/s | - | 0 to 8; none |
| Drain-down schedule | doubling every 512 steps | every 192 steps | Jeffreys' law per block | every 1,024 steps |
| Pump class half-width | 4 % | 4 % | 8 % | 0 |
| Soil layers; tick | 12; every revolution | 8; every revolution | 4; every third revolution | 12; every revolution |
| Time, typical / design | 14.8 / 22.0 min | 2.7 / 3.6 min | under 1 min | hours |
| Use | scoring; manufacturer studies | level design, reference-load search, regression, CI | instant feedback for developers | measuring the discretisation error of the official tier on golden loads |

The pilot inside every run is not a tier: it uses preview sampling on the grid of the run (M7.2).

**Rule for fixing a tier.** The tier id, the variant and the parameter hashes are inputs and part of every cache key. Every count in the run derives from the tier table and the load before stage C. Nothing adapts during a run. Film class and cell size are properties of the catalogue item. A level is rejected at design time (level lint) if the predicted official time of its largest plausible load exceeds 24 minutes, unless it carries a per-item film-class override that is identical for every player.

**Fast tier budget** (same planning rates; seconds, typical / design; `budget3b.py`):

| Stage | Seconds |
|---|---|
| A set-up; B shake-down | 16 / 18; 15 / 15 |
| C, D jets, walks and gather; E pilots | 5 / 6; 13 / 13 |
| F Monte Carlo (9 x 10^7 parcels) | 18 / 18 |
| G1 film S (4 mm cells; rivulet-prone items at 2 mm in class D; 18 revolutions) | 23 / 48 |
| G2, G3 film K periodic and drain-down | 13 / 19 |
| G4 time-coupled parcels | 12 / 16 |
| H replay (2 mm soil cells, 8 layers) | 18 / 26 |
| I, J end passes and I/O | 14 / 14 |
| **Sum; with the 0.9 factor** | **147 / 194; 164 s (2.7 min) / 215 s (3.6 min)** |

### 7.6 Keeping tiers consistent, and per-item uncertainty

A coarse simulation cannot be proven to rank every pair of loads like a fine one when the output is thresholded. What is done:

1. **Construction.** All tiers above preview use the same solver allocation, equations, closures and parameters. Grids are nested (every official block is a child of a fast-tier block), surface fields, lanes and ranks are functions of surface coordinates or of the coarse block, parcel streams are nested, and the features smaller than a fast-tier cell (jet stripes, residual area through cover fractions) are analytic in every tier. Nothing physical depends on a sampling count: slot nozzles use the nozzle table's sub-jet count in every tier and the sub-ray patterns sample equal areas.
2. **Gate per MAJOR version.** On at least 200 load pairs (the 48 A/B pairs of the phenomena checklist plus single-change perturbations of reference loads, including loads with slot-nozzle exposure, cutlery, and rivulet-prone plastics): Kendall tau between fast and official level scores at least 0.90; per-item verdict agreement at least 95 % outside the dead band; no pair whose official scores differ by more than three times the tier noise ordered the other way. A failed gate tightens the fast tier. One-off cost about 120 machine-hours of official washes on the campaign machine (section 6), to be added to the 536 hours of benchmark §4.6.
3. **Dead band.** The fast tier reports each item's margin in units of the measured tier-to-tier discrepancy and marks items within two units as undecided (B §11.3). Level acceptance is always confirmed at the official tier.
4. **Monitor.** Every run reports, per item, the difference between its pilot's steady wet estimate and the wet duty of the final records; drift of that statistic after a code change is a free regression signal (C §11.7).

Per-item uncertainty (benchmark §5.5) reported in every run: the Monte Carlo split-half error, the revolution-to-revolution spread, eps_wet, the wetting-drift measures, the clipped hand-over momentum and the supply-limited area. Options on cached exposure: `sigmaReplay` re-integrates the soil twice with records perturbed by plus and minus the spread (B §7.3; about 1.5 minutes each); `supplyBracket` re-integrates it with `soil.kuE` at 0 and at 3; `bracket` runs eight preview-tier members with the closure groups G1 (splatter, surface tension of young surfaces), G2 (secondary break-up and wires), G3 (contact angles +/- 20 degrees), G4 (edges, undersides, contacts, gaps) pushed to their limits, plus the soil-side group S on cached exposure, and returns a fragility flag and a sigma per item (C §11.3). The bracket is a level-design and calibration tool; it is not part of a scored run. Until soils calibration test 6 has been run, level acceptance includes `supplyBracket`: a level whose reference verdicts differ between the two ends is not accepted.

---

## 8. Verification and validation

### 8.1 Module and system tests

Each module section lists its tests against analytic or published results with tolerances (about 130 tests in all). They are the unit-test catalogue; a module is not done until its reference implementation in M13 passes them and its GPU kernel matches the reference within the stated tolerance. Tolerances are written so that a correct f32 implementation can meet them: along-ray errors scale with 1 / cos(incidence), float film mass is checked to 10^-4 per 10^5 steps, and film tests either stay below the development length of waves or compare wave-averaged quantities. System-level tests on the first full-load runs:

| Test | Target | Tolerance |
|---|---|---|
| Water circuit time; mean ejection speed for the DU750 at medium pump speed | under 3 s; 7.7 m/s (jets §9.1 [VERIFIED]) | 10 % on ejection |
| Mean downfall speed | 5.1 m/s measured (published CFD missed it by 34 %) | order of magnitude |
| Film plus airborne hold-up | 0.4 to 1.5 L (machine §4.5) | within range |
| Carry-over per drain | 0.3 to 0.5 L for a normal load (chemistry §5.6 [VERIFIED]) | within range, or reported as a finding |
| Direct-jet duty | 0.07 % and 1.59 % on the thesis tile; under 10 % almost everywhere (standards P47) | factor 1.5 (finite jet width) |
| First physical milestone: egg-yolk tile in a DU750 replica | the six in-machine curves of soils §6.2, including the two low-rate cases | 35 %; the low-rate cases within their measured standard deviation |
| IKW programme (45 C, 8 min hold) with the reference detergent | partial residues on egg yolk, starch mix, minced meat, tea | qualitative |
| Homogenisation audit (developer mode) | explicit-event integration of 1 % of soil cells | final residual within 2 % |
| Tier gates | section 7.6 | as stated |

### 8.2 Conservation checks asserted in every run

| Quantity | Check | Warn / fail |
|---|---|---|
| Integer ledgers (emitters, parcels and their fates, Monte Carlo tables with their pack remainder, deposits, stitches, the whole cascade, lines, pools, sump) | sources = sinks + stored | any mismatch fails |
| Float film mass of each S item per solve | change = integer inflow - integer outflow; the residual is booked to the account `sFloat` | 10^-4 / 5 x 10^-4 of the item's largest film mass |
| Water per revolution and per state | nozzle outflow = change of all stores + airborne + returned to the sump | 0.1 % / 1 % |
| Sump inventory over the programme | fills = drains + carry-over + evaporation + absorbed | 0.1 % / 1 % |
| Soil mass per class | on items + in local stores, pools and gaps + in liquor + on filter + drained + redeposited = initial | 10^-4 / 10^-3 of the initial mass |
| Energy | heater input = liquor + tub + items + losses + evaporation | 0.5 % / 2 % |
| Parcel leaks | leaked mass over traced mass | - / 10^-6 |
| Non-finite words (bit test) and clamped kernel outputs | count | - / 1 non-finite; clamps reported |
| Saturated integer fields (accumulators, counters, u16 exposure times that are not declared saturating) | count | - / 1 |
| Buffer capacity (parcels, lists, emitters) | high-water mark | 80 % / 100 % |

### 8.3 The phenomena checklist of the standards dossier

Kind: **E** arises from geometry, kinematics, lumped hydraulics, rigid-body mechanics or the general film models with no rule that mentions the phenomenon. **C** arises, but its size (or its existence, for negative controls) rests on a closure tagged [ESTIMATED] or [SYN]; it is in the bracket or on the calibration list. **S** is represented statistically. **I** enters through inputs or through the soil and chemistry models that this design carries but did not originate. **N** is not reproduced. The pass criterion is the dossier's: correct sign and magnitude within a factor of two or one score point.

| ID | Mechanism in this design | Kind |
|---|---|---|
| P01 hollow item open side up | the cavity is a basin fed by parcels, drips and the downward jets of the upper arms; the pool ODE fills it and keeps its composition through the drains; submerged soil sees the pool's liquor (reached only by exchange), no film shear, and jets attenuated by the water above it; what dissolves stays in the pool and is deposited when it dries; retained volume reported | E for the retained water; C for the stain outcome under the pool (pool mixing, jet attenuation) |
| P02 soiled face turned away | no JetExposure on that face; wetting by mist, drips and film only, with a later onset; hydration from what lands; lower delivery of enzyme (supply factor) | E for the sign; size C (see note 1) |
| P03 plate pitch | dwell d / (omega r) and reach d tan(rho) are exact ray geometry between plates | E |
| P04 nesting | gap field: no parcel access; gap reservoirs (immersed, no shear, exchange eta_gap, their own dissolved soil); no film flow below 0.4 mm | E for access, C for exchange |
| P05 large flat item shadows | first-hit tracing | E |
| P06 arm stalled | contact torque in the arm balance; a stalled arm state with its own time base and exposure sets; jets on fixed lines | E |
| P07 centre against corner | arm kinematics and nozzle table; dwell proportional to 1 / (omega r) | E |
| P08 left / right asymmetry | nozzle directions fixed in the rotating arm frame | E |
| P09 lean direction | incidence angle on analytic normals; oblique flow split | E; stresses at grazing incidence C |
| P10 tall narrow vessel | entry window from rim clipping of the sub-ray bundle; fan across the base with one fold crossing; departure rule on the ceiling; S solver on the interior | E for entry, C inside |
| P11 upper against lower rack | branch hydraulics, flight distance, coherent fraction f_c(s) | E, size C (C_b; sheet break-up for slots) |
| P12 alternating plate sizes | ray geometry | E |
| P13 glass over tines | tines are capsules in the jet path; contact links and bridge reservoirs; residue at the bridges | E, marks S |
| P14 face against the tub wall | gap field, parcel access, slow renewal (fill-fraction lag, local store, supply factor) | E, size C |
| P15 nested spoons | gap reservoirs between stretched shells on the cascade, the least accurate geometry | C |
| P16 heads up or down (negative control) | basket walls with porosity; secondary water inside cells; LINE drainage along the piece | C (see note 2) |
| P17 crowded basket cells | contact and gap statistics of the settled poses | E |
| P18 tray against basket | spoon bowls facing up are basins | E |
| P19 overloading | more shadowing, smaller gaps, more soil per litre in the liquor model | E, I |
| P20 total soil load | liquor model: consumption, suspended load, filter loading, foam derating | I |
| P21 redeposition of particulates | expected speck intensity from stranding, settling and pools; follows the water routing, particles are not tracked | S |
| P22 clean neighbours | deposits only through the liquor and splash; reported per block on unsoiled items too | S |
| P23 end-of-cycle drips | the final drain-down traces last drops onto items below | E |
| P24 easy soils, arrangement irrelevant (negative control) | soluble class leaves wherever a film flows; onset gate: on glazed ware in wash liquor a face receiving 10^-5 of the reference flux is wet within the main wash | C (note 2) |
| P25 dispenser blocked | lid sweep test; a stuck tablet releases at `liq.wStuck`, calibrated to 5 to 30 % of the dose over the main wash | E for the geometry of the block; C for the consequence (a constant) |
| P26 tablet in a dead spot | the tablet is a body; its release rate follows the flux recorded where it rests, and goes into the pool if it rests in one | E, rate C |
| P27 time and temperature trade | full programme replay with the liquor model; enzyme optimum | I |
| P28 bleachable stains position-insensitive (negative control) | stain term needs only wetness, oxidant, temperature; oxidant supply factor weak by default | C (note 2) |
| P29 ageing | ageing transform (moisture, bake index) | I |
| P30 protein: frequency and chemistry, not jet strength | threshold of 10 Pa far below the jet peak, so time above threshold barely changes with pump speed; Hill law in delivered enzyme; no enzyme-free removal at pH 10.5. The A/B test as defined (pump speed +/- 30 % against enzyme dose +/- 50 %) is reproduced; the response to hit frequency is linear in duty | E given the soil law (note 1) |
| P31 starch bimodal | cohesive rule fires or not depending on swelling against available shear; wet-or-dry switch | I, C |
| P32 microwaved milk on glass | soil class parameters | I |
| P33 fat needs temperature and water | solid-fat curve at the block temperature with supply-limited heating; viscous shifting; fat redeposition on plastics | E for cold spots, I for kinetics |
| P34 thick layers flake | adhesive detachment rule; detached mass joins the grit and coarse classes; flakes are not bodies | I, S |
| P35 pot interiors | as P10; the scored surfaces are regions; pots are S-class | E, C |
| P36 pool in a base recess | analytic basin | E |
| P37 tilt drains the recess | analytic basin against pose, continuous in tilt (exact segment integration; the dossier's wedge formula is 11 % high at 7 degrees) | E |
| P38 plastic stays wet | bead store from contact angles; low areal heat capacity in the drying model | E, size C |
| P39 pots stay wet | pools, rims, large sheltered area; one air node, so sheltering is lumped | C |
| P40 liquid at contacts and in gaps | bridge and gap reservoirs sized by the capillary-rise formula; a closure, not an emergent meniscus | C |
| P41 light items moved or flipped | momentum-theorem wrench, shake-down with live wrenches, then pool fill in the new basin and the fill trigger | E, C through friction |
| P42 cutlery dries (negative control) | lumped metal node, drainage along its length, single edge drop | E |
| P43 spots, film and tine marks on glass | dissolved residue from retained drops, bridges, films and local stores; appearance is not predicted | S |
| P44 cutlery comes out clean | thin soils (one layer), repeated secondary wetting, cascade on narrow faces | C (note 2) |
| P45 class ranking | outcome of the whole chain; a calibration target, not a mechanism | - |
| P46 run-to-run repeatability | not emergent: the model is deterministic and its periodic states have almost no memory of the seed. A spread of 0.08 to 0.10 can only come from seeded input perturbations (fill volume, release time, inlet temperature, arm start phase) whose sizes are calibration inputs | N |
| P47 everything wetted within seconds; jets rare | onset times from the deposition field; duty of footprints from kinematics | E, C |
| P48 detergent does not change where water goes | jets, fans and parcels use clean-water surface tension by construction | E |

Count: 16 arise from mechanisms where the design is exact or nearly so; 13 more arise emergently with a size, or a consequence, set by an estimated closure (P01 and P25 among them); 7 rest on such closures outright; 7 come from the soil and chemistry models; 3 are statistical; one is a target and one is not reproduced.

Note 1 (a dossier conflict, decided). The checklist's size for P02 (-1 to -2 points for oven-dried protein turned away) is the standards author's estimate from "removal depends on how often the spot is hit". The soils dossier's measurements say removal of egg yolk was spatially homogeneous over a jet-swept tile and the jet share was about 10 %; they do not include a face without jet access. This design follows the measurement for the jet term. P02 for protein is therefore gated on sign only until calibration test 6 of the soils dossier (paired tiles in jet-swept and jet-shadowed but film-wetted positions) has been run; its size in the model is governed by the wetting of the shadowed face and by `soil.kuE`, whose effect is [SYN] in sign as well as size. Until then shadowed-face results are reported at both ends of the range of `soil.kuE` (`supplyBracket`, section 7.6).

Note 2. P16, P24, P28 and P44 are negative controls or system checks whose outcome depends on whether enough secondary water, and enough enzyme with it, reaches shadowed surfaces: on k_S, the wire and rim rules, the splash ratio, the droplet sizes and `soil.kuE`. They are closure-dependent (B's claim that they are emergent is rejected, J-phys) and are the first use of the closure bracket.

Pairs added to the harness beyond the dossier's 48: an upright bowl with a starch soil on its floor under the top arm, with `jets.kSub` at 0 and at its default (jets under water); a plate with rounded and with sharp rim struck at 15 degrees (rim rule, far-face wetting); a tablet in an upright bowl against a tablet on the tray (pool as the sink of the dose).

### 8.4 Smoothness under small pose changes

Levels are accepted only if the reference load is not knife-edge under +/- 2 mm and +/- 2 degrees (benchmark §5.7, A6). Pose-dependent rules are therefore continuous wherever the physics is:

| Rule | Form |
|---|---|
| departure of a fast film from an underside | fraction f_dep, a smoothstep 10 degrees wide about `jets.undersideDepartTilt` |
| pendant dripping from an underside film | Brun threshold h*(alpha), continuous |
| separation at a rim or edge | fraction phi_sep, continuous in We_e / We_c above the threshold; continuous in the rim radius |
| front speed on a pre-wetted wall | root of the snow-plough balance, no threshold |
| advance and retraction of a contact line | fractions phi = (T - R_a) / T and 1 - T / R_r, continuous in the thrust |
| gutter hand-off at an edge | weight w_g, smoothstep over 0 to 0.2 of the gravity component towards the edge |
| surface reconstruction of the S solver | regime weight, smoothstep over depth / bed range from 0.25 to 0.75 |
| jets under water | attenuation A_sub(H), continuous in depth |
| cascade links | D-infinity weights, continuous in the gravity direction |
| basin volumes and spill levels | analytic or priority-flood on exact geometry, continuous |
| puddle capacity on flat tops | head held back by the lower edge, continuous in tilt |
| partial jet hits on rims and wires | fraction of 19 sub-rays (steps of 5 %) |
| film solver and cell size | property of the catalogue item, independent of pose |

Discrete by nature and left so: contacts and bridges (present or not), whether a basin is lumped (depth above `film.poolDepth`; its volume stays continuous), the number of drip sites on a near-level edge, the chosen receiver of a rivulet lane, rigid-body events, and the thresholded soil rules (softened by the loading heterogeneity). Test `pose-jitter`: three jittered copies of each reference load at the fast tier change the level score by at most 5 % and flip at most 2 % of all items. Items inside the dead band are not excluded from the count, because they are the ones that flip: their share is reported, and a reference load with more than 10 % of its items in the dead band is not accepted.

### 8.5 Validation before calibration

Every soil mechanism is switched by wetness, and the wetting models rest on one data set (cast acrylic, water at 43 C) and on receding angles uncertain by +/- 20 degrees. Before soil results are believed (J-phys, J-del):

1. **Wetting-map experiment.** A thin water-soluble tracer coat on glazed, glass, steel and polypropylene items at defined rack positions (jet-facing, turned away, nested, upper and lower rack); rinse-only runs of 30 s, 2 min and 10 min with and without detergent; the map of where the tracer is gone is compared with the predicted onset and wet-duty maps at block resolution. Target: 90 % of area classified alike. This tests the largest reducible error source independently of the soil model.
2. **Intermittent wetting** (soils calibration test 17): swelling of soiled tiles under a continuous film, under intermittent splashing at two measured rain rates, and immersed. It tests the sparse wetness state and the supply limit of hydration, which decide how long a shadowed soil has soaked when the film finally arrives.
3. **Jet-swept against shadowed tiles** (soils calibration test 6): paired egg-yolk tiles at a jet-swept position and at a position that is film-wetted but has no jet access, at two enzyme doses. It fixes the sign and size of the supply factor and the jet share; it is run before any P02-type level is accepted.
4. **Machine measurements the owner can make**: nozzle positions, sizes and angles (photographs and calipers), arm speeds (video), a power and temperature log of one run, fill volumes, retained water per item (weighing), carry-over (conductivity of the rinse), detergent left in the dispenser after a blocked-lid run, photographed residue per item. They replace [ESTIMATED] machine data and calibrate `hyd.*`, `liq.*`, `film.Cb`, bead and bridge constants.
5. **Calibration machinery.** The parameter registry carries units, ranges, validity and provenance; the exposure cache, keyed by the hydro parameters only, makes a soil-side evaluation cost 1 to 2 minutes; a global sensitivity screening (Morris) at the fast tier over all registry keys precedes the test campaign so that only identifiable parameters are fitted (numerics §8 risk 6). Objective: weighted squared normalised errors over arm speeds, the temperature trace, retained water by item class, wetting maps and residual area per item.

### 8.6 What this design does not reproduce

1. Rivulet meander paths and the unsteady structure of the film jump. On cascade patches wetted fractions and stripe positions are closures and frozen pseudo-random choices; on S patches rivulets are marginally resolved at 1 mm and not resolved at 2 mm. Roll waves appear in the S solver because its equations contain the instability, but their amplitude and speed are not validated and only wave-averaged statistics are used; the cascade has none.
2. Entrainment of residual film by the fast radial film; the transient of a jet entering a vessel; the returning curtain crossing the incoming jet; air trapped in a narrow-necked inverted vessel; fast films above the hand-over cap (their momentum is clipped).
3. Air motion in the tub: mist carried by the draught of the arms, spatially resolved condensation and drying air flow. One air node; still air for droplets.
4. Droplet-droplet and jet-jet interaction beyond a mean-field attenuation.
5. Three-dimensional pool dynamics: sloshing, stirring by a plunging jet beyond a mixing efficiency and a depth attenuation, splash-out.
6. Two-way coupling of thick or rough soil with the flow: berms deflecting the film, jets burrowing and blistering, shadowing by lumps; only contact angles and a roughness factor feed back.
7. Individual particles and flakes: no particle is tracked through films, pools and the filter; flakes are mass.
8. Foam as a material; aerated jets when the pump ingests air (only the head loss); pump surge dynamics; diverter transitions.
9. Persistent small motion: rattling, rocking, creep along tines.
10. Run-to-run variability as an emergent property (P46).
11. Dynamic surface tension at surface ages of 0.01 to 1 s: the model switches from the clean-water value in the fan to the equilibrium liquor value in the slow film.
12. Film temperature and composition transients on the scale of one jet pass; the downward march of a thermal front along a film after a step in liquor temperature.
13. Capillary rise dynamics in gaps; wrap-around flow on wires beyond the line model; flow through perforations beyond a porosity; levelling of two puddles across a stitch.
14. Sub-millimetre geometry: embossing, scratches, the side walls of fork tines; the sheet of a slot nozzle as a sheet (it is a bundle of sub-jets with sheet-derived break-up).
15. Material damage, deformation, glass corrosion, multi-cycle scale.
16. The appearance of spots and films; cross-stack bitwise equality.

---

## 9. Build order

Milestones are numbered MS0 to MS6 (modules are M1 to M13). From MS1 on they are vertical slices: each ends with an end-to-end wash that produces per-item results from real geometry, and with a named test list. No exit criterion depends on a component that this document does not specify or that a later milestone delivers. Durations are planning figures for a team of six to eight [SYN].

**Fixtures that let modules be built in parallel behind stub interfaces** (owned by M13 unless noted):

| Fixture | Content | Available |
|---|---|---|
| F0 | a hand-built `Scene` of one plate (one REV patch with pole and band boundaries) and one CART panel, written as buffers by a 200-line script, with the f64 analytic tracer for those two primitives | week 1; this is what every track starts against |
| F1 | three canonical `Scene`s from M3: one plate; one rack row of 8 plates, 4 glasses, a cutlery block and rack wires; the full 13-place-setting load | first deliverable of the scene track (weeks 3 to 6) |
| F2 | synthetic `DepositionTable`s (uniform, striped, one splash), in integer units | week 2 |
| F3 | synthetic exposure records: constant, pulsed, and one `EffectiveExposure` record for each of the five wetness states (bare and covered substrate for the sparse state), with a pool level | week 2; frozen before the soil and timeline tracks write kernels |
| F4 | recorded controller feedback, `MachineTick` and `LiquorState` timelines (the regression table of chemistry §10.12, with and without a blocked lid) | week 2 |
| F5 | a `FootprintTable` for one nozzle sweeping a plate at 90 and at 10 degrees, and for one slot nozzle | week 3 |
| F6 | the one-dimensional S reference (`s1d.py` ported to TypeScript) with its test set | week 1 |

| Milestone | Content | Exit |
|---|---|---|
| **MS0 Measure** (3 weeks, everyone) | M1 wrapper (limits, buffer registry with field roles, double-buffered accumulators, whole and segmented reductions, bit-pattern guard, probe suite). The first S test of M7.11 on a single-patch kernel, so that the benchmarked kernel is the specified scheme. Benchmarks on the target machine, each with its full binding set: (1) S stage update on a ragged REV atlas of 3 M cells with tile lists and per-item levels; (2) the per-base-step passes of one base step: emit, apply, clear, statistics, tile monitor; (3) the K step on 2.3 M blocks, periodic and on the drain-down schedule; (4) the analytic two-level tracer against the triangle hierarchy on the 140-item scene, for coherent jet bundles and for a parcel wave with drag, wall rules and integer deposits, wavefront against megakernel; (5) the sector walk and the gather kernel on fixture F5; (6) the 12-layer soil kernel on 3 M cells and one complete replay tick (pass W, soil, pass T, reductions); (7) integer block reductions against contended atomics; (8) on the CPU: stage A on the 140-item scene, emitter rasterisation, and the f64 live-wrench tracer per awake body and step. A 30-minute soak of the mixed workload; the longest tolerated command buffer; the NaN probe; a fast-math probe (whether the shader compiler reassociates or assumes finite values). The asset lint of section 3.1 on the whole catalogue | section 7.1 and 7.2 replaced by measurements; the decision table of 7.4 evaluated with all of them; go or no-go on analytic tracing; section 3.8 recounted from the catalogue with the real tessellation |
| **MS1 Thinnest end-to-end slice** (4 weeks) | One rack row at the preview tier: real geometry (REV patches for plates, glasses and cups; capsule wires), hydraulics for the lower arm, primary jets and gather (JetExposure), preview Monte Carlo, R0 routing with the placeholder pulsatility closure of M7.2 (steady FilmExposure), onset gate, wetness states, replay with the soil kernel for a soluble soil and egg yolk against a prescribed liquor timeline (F4), the result contract. Also: the first full-load trace and sector walk, from which the level schedule and the distribution of fan limits are read | residual mass per item from real geometry, with a reproducible report hash (`repro-2`); A/B pairs P03, P05, P07, P09 have the right sign in residual mass (no inspector needed); DU750 plate-hit counts; the jet-active share and the clipped-momentum share of the full load replace the assumptions of M7.12 |
| **MS2 Official-K** (8 weeks) | Full load in both racks and the sizing programme, with the load static (items that the screening marks as jet-mobile are reported, not moved): CART patches for polytopes and stretched REV patches, so that cutlery is in the load; Monte Carlo with pilot-guided allocation and masked smoothing; time-marched cascade with integer mass, lines, gutters, drips, reservoirs and basins; drain-down; transient and steady labels; block temperatures; full liquor model with the tablet on its tray; pools and local stores; the stain class; exposure cache; checkpoints; ledgers; fast and preview tiers. The pulsatility closure is refitted to cascade output. Campaign C3 (grazing sweeping footprints) starts at the beginning of MS2 | a K-only official wash of the typical load inside 12 minutes; the system tests of 8.1 that do not need motion; the DU750 egg-yolk milestone; `cache-equivalence`; negative controls P24 and P28 and the pairs P01 and P26 examined, the first two with the bracket |
| **MS3 Inertial film and gates** (8 weeks, overlapping MS2) | S on a single REV patch with the tests of M7.11; then S on S-class items in the pipeline (emitter momentum with the cap, contact line, time-step levels, stitches); gate P2 against the 0.5 mm reference and against the first C5 cases; the pulsed-convergence gate; calibration of beta_cl0 per cell size on the acrylic case; `sweep.correction` from C3 in place before starch results are read | no monitored lambda dt above 0.45 and no item clamped at the top level on the golden loads; the official variant is decided and frozen (7.4); an official wash inside the budget |
| **MS4 Motion and deposits** (6 weeks) | Rigid coupling (the four physics additions, shake-down, live wrenches, epochs and reserves, arm states, tablet body); redeposition; drying with the heat-exchanger node; the ten soils of soils R4; fuzz campaign starts | P06, P25, P41 A/B pairs; the worst-case bound of 7.3 demonstrated on a forced-epoch load; failure rate measured |
| **MS5 Trust** (6 weeks) | Phenomena harness for P01 to P48 and the added pairs; tier gates on 200 load pairs; `cross-machine`, `cross-stack`, `resume-hash`, `second-process`, `pose-jitter`; bracket, supply bracket and sigma tools; sensitivity screening over the registry; browser build of the fast tier; 20 consecutive official runs as the p95 acceptance | release candidate |
| **MS6 Closures and calibration** (continuing) | Offline closure tables (section 11.2); the wetting-map, intermittent-wetting and paired-tile experiments (section 8.5); the owner's measurements; the Bosch machine specification | parameters move from [ESTIMATED] to measured |

Parallel tracks. During MS0 everyone measures, but the tracks' first work is the kernel each one benchmarks, written against F0 and F6:

| Track | Modules | Starts against |
|---|---|---|
| Scene | M3 | golden profiles and the catalogue; F1 is its first deliverable |
| Jets | M4, M5 | F0 with its f64 tracer; F5 from week 3 |
| Spray | M6 | F0; the triangle tracer of the spike until the MS0 tracing decision |
| Film, cascade | M7 (R0, K, LINE, reservoirs) | F0, F2, F5 |
| Film, inertial | M7 (S) | F6, then a single REV patch of F0 with scripted deposition; grows out of MS0 benchmark 1 |
| Soil and liquor | M8, M9 | F3, F4 and the dossiers' regression tables |
| Timeline and orchestrator | M10, M12 | stubs for everything: runs end to end on fixtures from week 3 |
| Foundation and rigid | M1, M11 | the spike code; the physics additions are requested in week 1 |
| Verification | M13 | writes each reference implementation one step ahead of its kernel |

---

## 10. Risk register

| # | Risk | Why it matters | Test or prototype that retires it | Fallback |
|---|---|---|---|---|
| 1 | The S kernel is slower than 0.6 G stage-updates/s, or the jet-active share is above 0.25 | film is 44 to 58 % of the run; the design load has 1.2 minutes of GPU margin | MS0 benchmarks 1 and 2; the level schedule of the MS1 full-load trace | cut list and variant table of 7.4 (S-mainwash closes at 0.25 G/s) |
| 2 | Analytic two-level queries are slow or fragile in f32 | every stage depends on them | MS0 benchmark 4: rate, leak count, grazing-incidence accuracy against f64 with the cosine-scaled tolerance | triangle hierarchy with analytic polish behind the same interface (measured) |
| 3 | The cascade is not adequate in two dimensions on flat ware (gentle slopes, rims, faces fed from the side) or on cutlery | it is the official solver for 43 % of area plus cutlery | gate P2 on a plate, a spoon and a fork | S-all variant if S is fast enough; cutlery heads to S2 |
| 4 | The S solver is not robust at production settings: contact lines at first wetting, shorelines, levels, stitches, pole | S-class items would carry wrong wetting | the first S test, the property test, lake and puddle tests, pole and band tests, local-stepping test, `cflRaises` on golden loads; the one-dimensional reference F6 exists before any kernel | K-only variant; S confined to the reference tier |
| 5 | The pulsed-film closure: results with the dossier's momentum-flux factor do not converge; waves in S bias time means | time-mean thickness and the 1 Pa duty move by up to a factor of two | pulsed grid-convergence gate; the wave test; campaign C5 | beta_m = 1.2 (the default here); wave-averaged statistics |
| 6 | Secondary-water closures (splatter fraction 0 to 0.4, droplet sizes, wire and rim rules, splash ratio) decide the negative controls | rank 2 of the error budget; P16, P24, P28, P44 | bracket runs at MS2; splatter-collection and wire-patternator tests; offline tables | none in software: calibration |
| 7 | Wetting closures on real tableware differ from the acrylic data | every soil mechanism is switched by wetness | wetting-map experiment (8.5) before soil calibration | bracket G3; receding angles measured on the owner's ware |
| 8 | The enzyme supply factor is confounded with the Hill fit, and even its sign is not established | both were inferred from the same six curves; it sets P02 and threatens P44 | soils calibration test 6 (paired jet-swept and shadowed tiles); `supplyBracket` in level acceptance until then | `soil.kuE` = 0 restores the dossier model |
| 9 | Parcel tracing rate, or megastage memory traffic, below plan | Monte Carlo is 15 to 23 % of the run | MS0 benchmark 4 (short incoherent segments with deposits) | cut 3 of section 7.4: counts halved with a larger importance gain; the smoothing floor keeps per-block noise bounded |
| 10 | Soil kernel or reductions slower than planned | replay grows | MS0 benchmarks 6 and 7 | halve the tick rate outside the main wash |
| 11 | Sustained 30-minute throughput is worse than the 7 and 15 minute measurements | p95 | MS0 soak; 20 consecutive official runs at MS5 | treated as a lower rate in the table of 7.4 |
| 12 | Bits change with the operating system or bindings; the campaign machine is not bit-identical to the reference machine | caches, golden hashes, published scores | probe suite; `cross-machine` and `cross-stack` gates | reference stack and dead band (rule 15); scores from one machine only |
| 13 | Shake-down does not converge; epochs are common | bounded cost but degraded items | rigid-body spike extended with jet loads at MS4; the forced-epoch load | reserve policy; calibrate wet friction first |
| 14 | Fast tier does not rank like the official tier | level design and reference search use it | tier gate | tighten the fast tier (it has a factor of five of headroom) |
| 15 | Cutlery (47 % of items, 9 % of area) on the cascade with stretched-shell and narrow planar patches is inaccurate | least accurate geometry class | asset lint; uniform rain for 5 s on every catalogue item; P15, P44 pairs; the spoon and fork cases of gate P2 | cutlery heads to S2; per-shape refinements of the stretched-shell metric |
| 16 | Line and gutter model (wires carry and release water) is wrong | 100 m of wire sits above the lower rack; carry-over | first full-load run: carry-over 0.3 to 0.5 L; drip maps against video | `film.kW`, bead and bridge constants are calibration knobs |
| 17 | The Bosch machine differs from SPOT-60 in ways the data model does not cover (arm count, diverter states, heat exchanger) | sizing and realism for the owner's machine | the Bosch dossier and the owner's measurements | the machine is data; states and arms are lists |
| 18 | GPU or CPU memory pressure on an 18 GB machine in use | swap and stalls above 4 GB of GPU buffers; 5.5 GB of CPU memory was free in the spike | peaks measured at MS2 against the table of 3.8 | 2.1 GB planned; eviction of the replay state during exposures; records memory-mapped, 1.5 GB of heap |
| 19 | Long command buffers or device loss | a 15 to 28 minute job | MS0 long-dispatch probe; `resume-hash` | chunks of half a phase bin (50 to 250 ms); resume from checkpoint |
| 20 | Too many calibration parameters | unidentifiable model | sensitivity screening at MS5 | fit only identifiable groups; report the rest as ranges |
| 21 | Grazing-incidence jet closures are extrapolations (Re_eq 1.4 to 3 x 10^5, incidence 5 to 30 degrees) | plates are 43 % of the area and are struck this way; the difference decides starch stripping | campaign C3 before MS3; the transition-cap test | `jets.kFilm` and `jets.ReXt` in the bracket; `sweep.correction` table |
| 22 | The hand-over cap, the slot-nozzle bundle and the single solve temperature bias S-class wetting | each replaces resolved physics by a bound | tier gate against the reference tier, which has none of the three | uses of spare time in 7.4; campaign C6 |

---

## 11. Deferred items and known limitations

### 11.1 Deferred, with the reason and the hook left in place

| Item | Why deferred | Hook |
|---|---|---|
| Air motion in the tub and mist transport | no data on recirculation; droplets of 0.1 to 0.3 mm stop within 5 to 15 cm and then follow the air, so this may matter for the negative controls | the parcel kernel already subtracts u_air from a 32 x 32 x 40 grid that is zero |
| Particle tracking through films, pools and the filter; flakes as bodies | needs a model the dossiers do not supply; verdict impact limited to the speck rule | particles are liquor classes; speck intensity is per block and follows the water routing |
| Two-way coupling of thick or rough soil with the flow | one-way coupling is the dossier's assumption for deposits under 1 mm (soils §7.1) | `jets.kRough`; deposits above 1 mm are flagged at load time |
| Dynamic surface tension at surface ages of 0.01 to 1 s | no measurement (films §13 item 2) | `film.sigma` per class and `jets.gammaFactor`; brackets G1 and G3 span the same uncertainty |
| Loosened-layer (rest-interval) erosion law as the default | the in-machine data favour the linear law at millisecond dwells | `soil.erosionLaw`; events and restMax are in JetExposure |
| A sheet model for slot nozzles (plane-jet stagnation, planar film) | no dishwasher-specific correlations; the dossier offers the bundle as the shortcut | sub-jet count in the nozzle table; sheet break-up and drop size already sheet-derived; table `slot.footprint`; campaign C6 |
| The dispenser cup as geometry, so that a stuck tablet's release follows the flux recorded in the cup | needs the lid as a partly open body | a stuck tablet's resting place is the cup's blocks; `liq.wStuck` until then |
| Film energy and scalar transport along the flow (films §4.2 eq. 5, 6) | temperature and composition are slow; the supply-limited conductance, fill fractions and local stores carry them | the M10 test against a one-dimensional film energy solution measures the error |
| A second main-wash solve temperature | 1.5 minutes for the design load; first use of spare time in 7.4 | viscosity drift is reported; the reference tier does it |
| 1 mm film cells on all partially wetting materials, 0.5 mm on rivulet-prone ones (films §12.6) | 4 to 8 times the cost per area | reference tier; uses of spare time and responses in 7.4 |
| Tile-level activity lists inside an item (skip dry tiles of a wet item) | a front that reaches an unlisted tile must not be blocked; needs a GPU-built list | the tile monitor already reports an any-wet flag per tile; `frontHeldShare` is reserved in StateSummary |
| Resolved three-dimensional patches at run time | 33 to 120 M particle-steps/s buys seconds for one pool; what it would deliver is a mixing efficiency | offline campaign |
| Emergent run-to-run variability (P46) | the model has no chaotic memory of the seed | seeded input perturbations, sized by calibration, off for scoring |
| Official scoring in a browser | tab throttling, worker limits and 4 GiB caps are untested for 20 minute jobs; cross-device bits differ | fast and preview tiers run in browsers (same WGSL, at most 8 storage buffers per kernel, single-threaded CPU side in a worker); official scores come from the reference stack |

### 11.2 The offline closure campaign

All three proposals said that the rules for wires, rims, vessel interiors and sweeping grazing footprints are estimates to be replaced by tables from resolved simulation, and none specified it (all three judges). Specification:

| Campaign | Cases | Outputs (table id, axes) |
|---|---|---|
| C1 jet on a wire or tine | D_w / d in {1, 1.5, 2, 2.5}; offset e / d in {0, 0.25, 0.5, 0.75, 1}; V in {6, 8, 10} m/s | `wire.split`: pass fraction, deflection, fan angles and spreads, drop-size quantiles (by mass), retained fraction, over (D_w / d, e / d, We) |
| C2 jet and fan on a rim | rim radius / d in {0.05, 0.25, 1}; incidence 15, 45, 75 degrees; overlap fraction in 5 steps; and a fan film arriving at the rim from 50 to 150 mm away (the rim-wrap case) | `rim.split`: mass to each face, sheet fraction and direction, drop sizes; the separated fraction against We_e / We_c for the rule of M7.5 |
| C3 sweeping footprint (runs first; needed before MS3) | phi in {5, 10, 15, 30, 90} degrees; v_s / V in {0.06, 0.12, 0.25, 0.6}; dry wall and residual film of 0.5 h and 1 h | `sweep.correction`: multipliers on tau, M and r_lim over (phi, v_s / V, h_res / h); splatter fraction over (phi, wetness); the transition Reynolds number `jets.ReXt` |
| C4 inverted vessel and undersides | cup radius 30, 40 mm; bowl 70 mm; nozzle offset in 4 steps; one traverse; a flat underside at tilts of 0 to 70 degrees | `vessel.interior`: wetted map, curtain against attached film, validating the fold-crossing fan and `jets.undersideDepartTilt` |
| C5 pulsed falling film | 80 and 200 ms pulses, mean 0.005 to 0.05 kg/(m s), vertical and 30 degrees, with and without a contact line on a partially wetting wall | time-mean thickness, shear duty curve, wave amplitude: the reference for `film.betaM`, for the cascade, and the independent reference of gate P2 |
| C6 slot nozzle | the SPOT-60 slot at 100 and 250 mm stand-off, normal and 15 degrees incidence | `slot.footprint`: multipliers on tau, M and R_j of the sub-jet bundle; sheet break-up distance and drop sizes |

Method: volume-of-fluid with adaptive refinement to 25 to 50 um at the wall (the boundary layer is about 25 um, jets §4.4), a 60 mm domain (200 mm for the grazing and rim-wrap cases), 50 ms per event (jets §10), about 10^7 cells, hours per case on a workstation or cloud node; about 180 cases. It is outside the 30-minute budget and outside this repository's run time; its deliverables are `ClosureTable` files with provenance. Each table is validated against one published case before use (C3 against the static film-jump radius and the Glover moving-jet data up to 0.25 m/s; C5 against Nusselt and Jeffreys limits). The acceptance test of the analytic chain is that, with the tables in place, module M5's exposure of the campaign cases matches the resolved runs within 20 % in shear impulse and 2 mm in footprint extent. Owner: the jets track. C3 starts with MS2 so that its table exists before MS3; the others start after MS2.

### 11.3 Known limitations and approximations, stated plainly

- Section 8.6 lists what is not reproduced.
- No kernel rate in this document is measured; the budget is a plan until MS0, and the design load has little margin in it.
- The machine is SPOT-60 plus a sizing programme of 145 minutes; the Bosch nozzle tables, diverter pattern, pump speeds, tablet tray geometry and heat-exchanger size are placeholders.
- The intermediate rinse reuses the water-like exposure sets; liquor between classes is not solved separately.
- States shorter than 120 s per programme (state A) are superposed, not time-marched; jet-on-jet interference between arms is neglected there.
- Every exposure set is solved with its lumped basins full and its rays on the dry geometry. Until a basin is full, the drips its overflow would feed are over-counted for the fill time; jets into a pool are attenuated by a depth closure, not resolved.
- Each liquor class is solved at one temperature. The main-wash film record is that of 55 C liquor; during the cooler part of the heat-up (about a quarter of the class's time) cascade cells are rescaled and re-classified but S-solved wetting maps are not, and the run reports it.
- Monte Carlo wall states come from a pilot with preview sampling; mismatches are reported, not iterated, in the official tier.
- An exposure set is computed once per geometry epoch, with the soil state at its first use. Later soil changes reach cascade cells through the per-tick re-evaluation of the regime; S-solved cells only raise the `wettingDrift` flag.
- Pump speeds within 4 % share one exposure set; the splatter source is then wrong by up to 17 %. For the two minutes between the main-wash fill and the surfactant threshold the water-like sets are rescaled by 11 %.
- The fast radial film is handed to the film solvers at no more than 2.2 m/s. Where a fan ends earlier at a higher speed (cut by geometry, or at the sweep limit of a grazing footprint) the excess momentum is dropped and reported.
- At grazing incidence the fan closures are extrapolations; the laminar zone is capped at a flat-plate transition Reynolds number that is this document's choice.
- Slot nozzles are bundles of round sub-jets; peak stresses under a real sheet may be several times higher on a stripe a fraction of a millimetre wide.
- Cutlery, 47 % of items, runs the cascade on narrow planar and stretched-shell patches: the least accurate geometry. The official film grid is one level coarser than films §12.6 asks on rivulet-prone plastics in wash liquor, and coarser still in clean water.
- Wall temperatures follow a quasi-steady conductance: for one front transit time after a step in liquor temperature (about 10 s on a plate) the lower part of a film-fed face is up to 11 K too warm.
- A stitch between patches passes liquid one way at a time; two shallow puddles do not level across it.
- At the shoreline of a puddle on a surface whose receding angle is below 5 degrees the two edge cells keep a small residual current (under 15 mm/s and 0.1 Pa).
- The onset map of sparsely rained faces has a resolution of 10 mm (steel, plastics) to 30 mm (glass), set by the smoothing windows.
- Rule-based closures remain for wires, rims, undersides, vessel interiors, jets under water and droplet-train stresses, all [ESTIMATED] or [SYN]; the wetting and supply constants `film.lDw`, `film.f1`, `film.etaGap`, `film.lakeLo`, `film.lakeHi`, `soil.kuE`, `soil.aBeadMax`, `soil.x0`, `soil.x1`, `film.nCl`, `jets.undersideDepartTilt`, `jets.ReXt`, `liq.wStuck` are this document's own estimates.
- The checklist's negative controls depend on those closures; P02's size for protein is not gated until calibration, and P25's consequence rests on one constant.

---

## Appendix A. Where the dossiers disagree, and the side taken

| # | Topic | The disagreement | Side taken and why |
|---|---|---|---|
| 1 | Nozzle coefficients | machine §3.3: C_v = 1.0, per-nozzle C_d 0.78 to 0.85; jets §11.3: C_v = 0.97, C_d = 0.70 | The machine dossier's C_d (its pump curve and branch losses were built with them) and the jets dossier's C_v (a real orifice does not convert all head). Arm friction radii re-tuned (M4) |
| 2 | Splash mass ratio of droplets | numerics: Bai-Gosman 0.2 + 0.6 r and 0.2 + 0.9 r; jets §6.4: at most 0.3 (0.5 on a thick film) | jets: measured splash of millimetre water drops is under 14 %; Bai-Gosman was fitted to fuel droplets. All three proposals agree |
| 3 | Phases and rays | machine: 360 to 720 steps; jets: 1,440 x 7; numerics: 4,096 x 64 | 16,384 x 19: phases must resolve the footprint path at grazing incidence (lighthouse factor), rays only measure clipping; the gather then merges phases into segments of one jet diameter |
| 4 | Where film and soil state lives | numerics §5.3: triangle finite volumes, atlas "a poor fit"; films §10.5, §12.6 and items §13: quadrilateral atlas | Atlas generated from the parametrisation, for every primitive. The numerics objection is to charts unwrapped from arbitrary meshes |
| 5 | Jet-to-film hand-over radius | films §4.3: at r_b, the film solver makes the jump; jets §11.2: analytic to min(R_j, r*, edge) | jets, with validity bounds that hand over early on awkward geometry, a speed cap at the hand-over and a film duty level at tau*. Handing over at r_b needs 60 to 125 us steps and leaves the 10 Pa contour to a 1 to 2 mm grid |
| 6 | Momentum-flux factor | films §12.2: 1.2 laminar, 1.016 on the turbulent friction branch; numerics: 6/5 | 1.2 on both branches until a pulsed-film reference exists (D8) |
| 7 | Capillary term on thick liquid | numerics: only below 0.3 mm; films §12.6: everywhere with a slope clamp | films: the inertial form does not need the lubrication cut-off, and ridges need the term |
| 8 | Wetting thresholds | numerics: Meredith's 0.5 and 0.001 of delta_c, 10 degree spread; films §12.4: separate advancing and receding angles, bead store | films, with the contact line stated as thrust against resistance (D9) and one onset mass, the smaller of the spray-wetting thickness and the bead capacity, for both solvers and the timeline |
| 9 | Tilt scaling of the wetting thresholds | films §5.4 and §12.4: replace g by g sin(beta), also in delta_wet; films §12.10: the acrylic transition is the same at 5 and 90 degrees | The data: `film.nBeta` = 0 in one shared definition (M2), and a fitted tilt law for beta_cl in S. The tilt-scaled form is the other value of the same key |
| 10 | Edge separation | numerics: Owen-Ryley plus O'Rourke-Amsden; films §12.5: We_c = max(2, C_tp (r_e / h)(1 + cos(theta_a))) with partial separation; jets §7.3, §11.3: all of the film leaves where M > 2 gamma (application [ESTIMATED]) | films, everywhere, including the end of a fan sector: it contains the jets criterion as its floor and the centrifugal-Bond argument of jets §7.2 as its scaling; O'Rourke-Amsden never triggers below about 5.8 m/s. For a grazing jet 150 mm from a 2 mm plate rim the two rules send 0 % or 100 % of the sector off the plate; campaign C2 has the case |
| 11 | Film transition Reynolds number | numerics: about 400; films: 1,608 | The same number in two definitions (Gamma / mu and 4 Gamma / mu) |
| 12 | Film-to-wall heat transfer | chemistry §10.10: constant 5,000 W/(m2 K); films §9.1: 1.88 k / h | films, in series with the supply limit G_e |
| 13 | Protein and starch kinetics | soils R3: Hill n = 3, 3 x 10^-5 and 2 x 10^-5 kg/(m2 s), lag 9 min, Arrhenius 24 kJ/mol; chemistry §10.6: n = 2, 3.7 x 10^-5 and 4 x 10^-5, lag 300 s x thickness squared, f_T with a denaturation optimum | soils as one coherent fit, with chemistry's f_T; both sets selectable (M8) |
| 14 | Enzyme-free alkaline removal | chemistry §10.6: f_alk = 0.10 at 50 C and pH 10.5, 0.14 at 55 C; soils §2.2 [VERIFIED] and E3: none except at pH 11.5 and 55 C | soils: the measured in-machine rate at 0.02 g/L of protease leaves no room for f_alk, and s_pH = 0.96 already holds the pH 11.5 boost. The soils form, zero at pH 10.5 and below (M8) |
| 15 | Size of the jet effect on protein | standards P02, P30: -1 to -2 points when turned away, clear response to hit frequency [ESTIMATED]; soils §6.1, §6.2: homogeneous removal, jet share about 10 % [VERIFIED] | soils for the jet term (section 8.3 note 1). Not flagged by any proposal; raised by J-phys. The supply factor that sizes P02 is this document's and is [SYN] in sign and size |
| 16 | Release from a blocked dispenser | chemistry §10.3: w_stuck = 0.05; chemistry §1.7 and §10.12, machine §7.4, standards P25: 5 to 30 % (15 %) of the dose released, protein removal near zero | The released fraction: w_stuck = 0.05 releases 82 % in the sizing programme under the dossier's own release law. `liq.wStuck` = 0.006 (M9) |
| 17 | Exposure statistics | numerics §4.2: 12 shear and 8 pressure levels plus a hit list; soils R5: events with peak, momentum flux and dwell; films §12.9: wet fractions and shear percentiles | Section 5: exceedance curves in shear and momentum flux, peaks, four events, a low-shear duty curve for the film with a level at tau* |
| 18 | Advancing the soil | numerics §4.3: averaging plus projective jumps of 1 to 30 s; soils §7.8: 1 s implicit steps | One tick per revolution for the whole programme; no jumps |
| 19 | Revolutions and temperatures simulated | numerics: 3 + 2 per state at three temperatures; films: 2 + 1 to 2, re-sampled when the liquor temperature has moved a contact angle; jets: average stochastic elements over 4 to 8 | 2 settle + 2 steady per state and class from the state's own pilot, 2 transient in the main-wash class, one solve temperature per class with a viscosity rescale and a drift flag, and the diffuse stochastic water in Monte Carlo tables of 1.5 to 3 x 10^8 parcels. A second main-wash temperature is the first use of spare time |
| 20 | Film and soil spacing | numerics: 0.75 to 1 mm on food-contact faces; films: 2, 1, 0.5 mm by receding angle in the current liquor; standards: at most 2 mm or sub-element coverage | 2 mm film cells, 1 mm on rivulet-prone materials in main-wash solves; 1 mm soil cells with a cover fraction. One level coarser than films on rivulet-prone plastics; the reference tier follows films |
| 21 | Carry-over | machine §4.6: 0.4 L in sump and hoses plus 0.25 kg on the load; chemistry §10.2: 0.15 L residue, 0.3 to 0.5 L in total | chemistry's 0.15 L plus the load water this model computes; the total is a validation target |
| 22 | Water in flight and on surfaces | machine §4.5: placeholder Q (t_flight + t_return) | measured from the simulation (V_air, V_film) |
| 23 | Rigid-body step and engine | items §13: 1 ms, Rapier suggested; spike: Jolt at 1/240 s | the spike [MEASURED] |
| 24 | Visibility thresholds | soils R7: 0.05 to 0.1 mg/cm2; standards §10.3: 0.02 to 0.3 mg/cm2 by class | outside this document (inspector); the output is residual mass per class so either applies |
| 25 | Gap that counts as nested | machine §9: below about 3 mm; standards P04: below twice the capillary length | 2 l_c of the current liquor: the hold-up is capillary and changes with rinse aid |
| 26 | Detergent dose | machine: 20 g; chemistry regression tables: 14.5 g in 3.5 L | an input; the regression tests use 14.5 g |
| 27 | Platform, GPU memory, throughput | numerics: native application, 6 GB, extrapolated rates | superseded by the brief, the spike (2 to 3 GB) and section 7.1 |
| 28 | Slot nozzles | jets §2.5: a sheet with plane-jet stagnation, or as a shortcut 5 to 9 round sub-jets | the bundle, with the sub-jet count fixed in the nozzle table for every tier and the break-up and drop size taken from the sheet (M4, M5); the sheet model is campaign C6 |
| 29 | Jets into pooled water | jets §4.3: free-jet stresses, and a submerged form that "would apply to a nozzle submerged in a pooled vessel"; items §4.5: a filled item is washed only by plunging jets | the submerged form as a depth attenuation of the free-jet record (M8), [ESTIMATED] |
| 30 | Water held by a tilted base recess | standards P37: V = (8/15) sqrt(2R) h^2.5 / tan^1.5(theta), giving 1.4, 0.42, 0.13 mL | exact integration of the circular segment (1.21, 0.40, 0.13 mL): the wedge formula is outside its range at 7 degrees |
| 31 | Droplet size figures | jets §5.4, §5.6, §6.4, §7.3: medians without a stated basis | all distributions are by mass; count-based figures converted with exp(3 ln^2 sigma_g) (M5) |

## Appendix B. Errors the judges found, and where each is fixed

| Proposal | Error (judge) | Fix in this document |
|---|---|---|
| A, B | C_v = 0.97 with arm friction tuned at 1.0: arms at 33 and 28 rpm (J-phys) | k_f re-tuned (M4) |
| A | forward Euler with MUSCL at CFL 0.4 (J-phys, J-num) | two-stage SSP at CFL 0.3 (M7.4); budget re-derived |
| A, C | peel term as a rectangle, or with a shear dwell; A's levels end at 8 N/m (all judges) | integral of the momentum-flux exceedance curve to 32 N/m and the peak (M8, 5.4) |
| A | soils against chemistry kinetics not noticed (J-phys, J-del) | appendix A items 13 and 14 |
| A, B | f16 soil water, wet time and erosion depth (all judges) | f32 or integer state everywhere; rule 7 with registration and a test per field |
| A, B | any bead counts as wet; thickness-based erosion on unswollen soil (J-phys) | wetness states with a bead-covered fraction; mass-based erosion with a hydration gate (M8) |
| A, B | one or two recorded revolutions carry the indirect-wetting map (J-phys, J-num) | Monte Carlo tables, importance allocation, smoothing floor, split-half and eps_wet (M6, M7.7) |
| A, B | unsprayed rack sampled 5 to 9 s after the switch and applied for the dwell; 4 to 8 s final drain-down (all judges) | steady records from each state's own pilot state; 60 s drain-down per state, merged per tick; late drips traced (M7.7, M10) |
| A, B, C | no viscous dewetting limit; one beta_cl for both acrylic windows (J-phys, J-del) | retraction as a sweep at the dewetting speed; tilt law; per-size table (M7.4) |
| A | R_j without (1 - xi) (J-phys) | Q_eq = 2 pi q (1 - xi) (M5) |
| A | film shear levels of 1, 3, 10, 30 Pa (J-phys) | 0.5, 1, 2, 4 Pa, a level at 10 Pa and a peak (5.2) |
| A | dormancy assumed in the budget; level formula against budget; exact step count claimed (J-num, J-del) | no dormant class; level table recomputed with a hand-over cap; schedule plus bounded raises (M7.4, 7.2) |
| A | GPU allowance unchecked; uncapped re-runs (J-num) | checked in 7.2; every reserve bounded in simulated terms (7.3) |
| A | positivity limiter needs a second pass (J-num) | donor-local cap and start-of-stage front fluxes, with a proof sketch and a property test (M7.4) |
| A | soil ledger unit of 10^-9 kg (J-num) | 10^-15 kg with 64-bit block reduction (M1, M8) |
| A | "the lower rack is in the state the U window left it": 7 s against 60 s (J-num) | the transient record starts from the periodic state of the other diverter state; the steady record and the drain-down merge carry the rest of the dwell (M7.7, M10) |
| A | pole test without momentum or capillary term; no branch for G_n <= 0 (J-num) | one flux form for every sign of G_n; pole and band tests with the full equations (M7.4, M7.11) |
| A | 0.5 mm texels beyond what scoring needs (J-num) | 1 mm soil cells; 0.5 mm in the reference tier |
| A, B, C | budgets for ECO 50 on SPOT-60 (all judges) | sized for the 145-minute sizing programme (M4, section 7) |
| A, B | discontinuous momentum-flux switch untested in pulses (J-del) | D8 and the pulsed-convergence gate |
| A, B | 1 ms rigid-body step (J-del) | Jolt at 1/240 s (M11) |
| A | fan validated against its own depth-averaged solver inside r_b (J-del) | resolved offline campaign is the reference (11.2) |
| B | level table ignores capillary celerity; ladder short at the ring (J-phys, J-num) | not adopted; our level formula includes it, and the hand-over speed is capped to what the ladder resolves (M5, M7.4) |
| B | capillary term off above 0.5 mm; non-convergent on triangles (J-phys, J-num) | kept at all thicknesses on quadrilaterals; there are no triangle patches |
| B | blanket departure of fast films from undersides (J-phys) | a departure fraction that is continuous in tilt, a registry closure in the bracket (M5) |
| B | 2,048 phases (all judges) | 16,384 |
| B | open-loop wrench series; force bound inconsistent with its formula (J-phys, J-del) | live wrenches from the momentum theorem (M5, M11) |
| B | hand-over inside the 10 Pa contour; unspecified geodesic walk on the GPU (J-num) | hand-over at the fan limit; gather with CPU-built segments and tile lists and closed-form development (M5) |
| B | pending-buffer ordering; coarse donor drained below zero (J-num) | per-item stepping only; double-buffered accumulators; rule 6 |
| B | only two main-wash points, no state A, plain-water minutes not solved (J-phys, J-num) | lazy ordered combos including class W; short-state rule (M4, 5.5) |
| B | asset build per level with rejection; wire prisms violate its own angle gate (J-del) | no remeshing; wires are capsules and LINE elements; an asset lint at catalogue time (section 3) |
| B | bit-exact conservation resting on identical floats at two call sites (J-del) | rule 19; integer mass wherever a ledger is exact |
| B | negative controls claimed emergent (J-phys) | section 8.3 note 2 |
| C | spray wetting only reaches RIVULET (J-phys) | regime machine corrected (M7.3) |
| C | "film shear none" for adhesive soils (J-phys) | section 1.3 |
| C | pre-wet h_res circular with the stage order (all judges) | pilot pass (stage E) before the film part of the footprint records (stage D) |
| C | evidence for dropping inertia is one-dimensional, vertical and closure-dependent (all judges) | S on S-class items; gate P2 with an independent reference; D8 |
| C | top arm snapped to a half-integer speed ratio; tick lengths at 3000 rpm (J-phys, J-num) | integer phases at true speeds, per-arm tables; ticks follow the arm (M4) |
| C | invented wetting constants (J-phys) | named, ranged and tagged [SYN]; S replaces the regime machine where it matters |
| C | step count per revolution fixed at 1,024 (J-num) | stepsPerRev from the actual period (M4) |
| C | smoothing across rims (J-num) | masked smoothing groups (M6) |
| C | regime test depends on cell width (J-num) | regime group is the coarse parent block (M7.3) |
| C | millions of atomic adds onto 64 counters (J-num) | integer block reduction; parcel fates in their own slots (M1, M6) |
| C | megakernel tracer with lane divergence; 3-D boxes for nested rings (J-num) | wavefront; (r, z) trees (3.5) |
| C | leaked parcel deposited on the far face (J-num) | discarded to the ledger; hard threshold (3.5) |
| C | 28 % on a bracket, 13 minutes unused (all judges) | D15 |
| C | deposition rescaled linearly over +/- 8 % in pump speed (J-del) | +/- 4 % with the error stated; zero in the reference tier (M4) |
| C | mass-only deposits and arbitrary ring counts make the solver swap a rewrite (J-del) | deposits carry momentum; power-of-two rows (M7.1, 3.2) |
| C | hand-over one relaxation length beyond R_j (J-del) | removed (M5) |
| C | Threefry instead of the platform generator; SoilRegion against SurfaceRegion (J-del) | `@spotless/core` generator; platform region ids (M3, 5.6) |
| C | wall state for Monte Carlo by material; tablet dropped at set-up (J-del, J-phys) | pilot wet estimate with jet-wet tables; tablet spawned at dispenser time (M6, M11) |
| C | acrylic transition listed as validation of a closure built from it (J-del) | marked a regression; the wetting-map experiment is the validation (8.5) |

## Appendix C. Points missing from all three proposals, and their resolution

| Point (judge) | Resolution |
|---|---|
| Enzyme and alkali supply limit, on by default (J-phys) | supply factor in M8, normalised to the in-machine tile, every input defined by the wetness table, [SYN] in sign and size |
| Erosion bookkeeping on unswollen soil (J-phys) | mass-based erosion with a hydration gate (M8) |
| Non-linear response to hit frequency; standards against soils (J-phys) | decided for the measurement; optional loosened-layer law specified; P02 gate changed (M8, 8.3) |
| Offline closure-generation programme (all) | specified in 11.2; C3 scheduled before MS3 |
| Time scales between a revolution and a phase, on top of a film PDE (J-phys, J-num) | slow-state table and mechanisms of M10 apply to S and K blocks alike |
| Statistical convergence of the wetting map; per-cell noise (J-phys, J-num) | eps_wet per item; importance allocation; smoothing floor with a stated error target; sparse flag; split-half (M6, M7.7) |
| Viscous dewetting and surface age (J-phys) | retraction at the dewetting speed; dynamic surface tension deferred with a hook (11.1) |
| Air in the tub (J-phys) | deferred with the u_air hook (11.1) |
| Particle transport and where specks land (J-phys, J-del) | expected intensities that follow the water routing; tracking deferred; no random draw in sim-core (M10, 5.6) |
| Two-way coupling for thick or rough soil (J-phys) | deferred; roughness factor and load-time flag (11.1) |
| The chosen machine and programme (all) | the sizing programme; tablet tray as machine geometry; heat-exchanger node (M4, M9, M11) |
| Run-to-run variability (J-phys, J-del) | not reproduced; seeded input perturbations as a calibration input (8.3 P46) |
| Validation of wetting before calibration (J-phys) | wetting-map, intermittent-wetting and paired-tile experiments (8.5) |
| Determinism probe suite; stack string; operating-system update (all) | M1, rules 13 and 15 |
| Measured rates for the dominant kernels (J-num, J-del) | MS0, which measures every pass of the budget table |
| Resolution-consistent wetting closure (J-num) | per-size beta_cl0 table and refinement study in gate P2; regime group in K; one onset mass |
| Slow states with memory longer than the window, listed (J-num) | table in M10 |
| Variance control that respects geometry (J-num) | masked smoothing in space; pilot-guided importance allocation (M6) |
| Positivity, conservation and one pass under local stepping (J-num) | proof sketch and property test (M7.4) |
| Many-to-few reductions every tick (J-num) | whole and segmented integer block reductions; MS0 benchmark 7 |
| Long dispatches, device loss, resume, p95 (J-num, J-del) | M1, M12, 7.3; MS0 probe; `resume-hash` |
| A two-dimensional, pulsed, contact-line reference for the film (J-num, J-del) | gate P2 and the pulsed-convergence gate; campaign C5 as the independent reference |
| The software stack has moved (J-num) | `webgpu` 0.6.2; `cross-stack` tolerance gate (rule 15) |
| Auditable evidence (J-num, J-del) | reference implementations and tests live in M13, including one test per number quoted from a script; this document's scripts are named and reproduce in seconds, but they are scratch, not repository files |
| Output contract with inspector, renderer and report (J-del) | section 5.6 |
| Calibration machinery and a measurement plan (J-del) | M2 registry with hydro and soil groups; 8.5 |
| Smoothness under small pose changes; canonical input (J-del) | 8.4; M12 |
| Operational robustness (J-del) | failure classes, failure-rate target and fuzz campaign (M12) |
| Browser (J-del) | 11.1 |
| Seeds (J-del) | level seed for surface fields and soil pattern; sim seed for the wash (M3, rule 8) |
| Plan and people (J-del) | section 9 gives tracks and durations; staffing by name is the lead's |
