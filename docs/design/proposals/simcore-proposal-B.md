# Spotless wash-simulation core: Proposal B, "one general substrate"

> **Record of the build, superseded.** One of three competing designs written on 8 October 2026.
> A panel compared them (`panel-results.txt`) and the design that was built is
> `docs/design/sim-core.md`, as limited by `docs/design/scope.md`. Kept as written; working
> files it cites are not in the repository. The index of the documents is `docs/README.md`.

Author: architect B. Date: 2026-10-08. Status: design proposal for panel comparison.

Stance given to this proposal: every surface in the machine is remeshed into a quality triangle finite-volume mesh whose elements are at once the ray-tracing primitives, the water-film cells and the soil cells, so that any geometry (parametric items, cutlery, wires, imported manufacturer CAD) goes through one code path with exact conservation and no seams.

Conventions. SI units unless stated. Confidence tags are carried over from the dossiers: [VERIFIED], [RECALLED], [ESTIMATED]. Numbers that are my own are tagged [B-EST] and the arithmetic is shown or lives in throwaway scripts (`jet_profile.py`, `film1d.py`, `budget.py`, `checks2.py`; working files, not in the repository). Measured throughputs are those in the brief and in `spikes/gpu-compute/out/tables.md`, tagged [MEASURED]. Dossier references are written as `jets §4.4`, `films §12.4` and so on. The full spike report (`spikes/gpu-compute/RESULTS.md`) and the lead's note of 16:43 appeared while this was being written; their constraints are adopted: 2 to 3 GB of GPU buffers with 4 GB as the hard ceiling, every binding under 4 GiB, at most 10 storage buffers per shader stage and 4 bind groups, planning rates of 1.4 G cell-updates/s (unstructured, Morton order) and 150 M rays/s (BVH, mixed), 20 minutes of GPU kernel time out of the 30, and the runtime pinned at Node 20 with `webgpu@0.3.0`.

---

## 1. Executive summary

**The design in one page.** At asset-build time (offline, once per catalogue item or imported CAD part) each solid is turned into a watertight, curvature-adapted *macro* triangle mesh with edges snapped to a ladder of 6, 3, 1.5 or 0.75 mm. At wash time every macro triangle is subdivided 1:4, in its own plane, to a *water level* (film cells of 3, 1.5 or 0.75 mm edge, chosen per region from material and soilability) and a *soil level* (1.5 mm edge on every soilable face, 0.97 mm² per cell, with a sub-cell coverage fraction). I call this structure the **SRT forest** (semi-regular triangle forest). The macro triangles are the BVH primitives; a ray hit returns a macro id plus barycentric coordinates, and the film cell and soil cell follow by integer arithmetic. There is no atlas, no seam, no polar singularity and no reprojection anywhere.

The wash is then computed as follows.

1. A lumped hydraulic model (machine §12.2) gives per-nozzle flow, jet speed and arm speed for each hydraulic state.
2. For each state, jets are traced as bundles of 19 sub-rays at 2048 arm phases. Where a coherent jet lands, the closed-form impingement solution (jets §4, §11.2) is evaluated directly on the soil cells as *swept stamps*: exceedance duty of wall shear and momentum flux, peaks and dwell, with no time stepping.
3. The analytic solution owns the surface out to the radius where the radial film has slowed to a fixed hand-over speed U_h = 1.5 m/s. There the water is given to the finite-volume film as a moving ring source. The film (depth-averaged, inertial, with hysteretic contact line, edge rules, drip reservoirs and lumped pools; films §12) is advanced in the time domain with block-wise local time stepping for a few arm revolutions per state, fully coupled to Lagrangian droplet parcels (splatter, wire fans, edge sheets, drips, splash secondaries) that are traced against the same BVH.
4. Each film solve produces a 64-byte exposure record per soil cell. The soil model (soils §7, R1 to R7) is advanced over the whole programme at 1 to 2 s steps on the GPU, reading the record of the current diverter state, interpolated between bracketing solves in log viscosity, with a predictor-corrector pass between solves so that soil removal can feed back on wetting. Chemistry (chemistry §10) and the machine thermal model run on the CPU at 1 s.
5. Jet-mobile items are screened at load time; the rigid-body engine is invoked with per-revolution wrench series at the first occurrence of each hydraulic state and after any geometry change; moved items change one instance transform and trigger a re-trace.

Budget: about 900 s for the nominal 6 m² load and about 1180 s for the largest 8.5 m² load on the official tier, against the 1800 s cap, of which 13.6 and 18.1 minutes are GPU kernel time against the spike report's 20-minute allowance (section 11); a fast tier of 140 to 180 s shares geometry, footprints and random streams with the official tier.

**The three ideas that most distinguish this proposal.**

1. **The SRT forest: one watertight mesh in three nested roles, with structure hidden inside the macro triangles.** Geometry accuracy is set by the macro mesh (chord error at most 0.05 mm), water resolution and soil resolution by per-region subdivision levels. Children of one macro triangle are congruent and coplanar, so metric data are stored per macro (96 bytes), not per cell, and neighbours inside a macro are implicit. The spike report says why this matters: stencil kernels are bound by memory traffic (110 to 130 GB/s), and the indexed benchmark's 2.6 times lower rate is almost exactly its byte ratio, 80 B per update against 32 B [MEASURED, RESULTS.md §5]. The "unstructured penalty" is the 48 bytes of topology and geometry per cell, not incoherent access. In the forest those 48 bytes shrink to about 22 (12 B neighbour table, 4 B per-cell auxiliary, about 6 B of amortised macro record) and to about 10 on the implicit path. The budget below does **not** bank this; it takes the measured indexed rate and derates it by 3 for the heavier state and arithmetic of a real film kernel.
2. **A fixed-speed hand-over between analytic jets and the film solver, plus swept stamps at soil resolution.** Everything faster than U_h is closed-form and validated without fitted constants (Bhagat and Wilson; jets §4.4 [VERIFIED]); everything slower is simulated on the mesh, where pre-wetting, rims, curvature and neighbouring items actually decide where water goes. Fixing U_h caps the local-time-stepping ladder at 0.25 ms on 1.5 mm cells, which is what keeps the film affordable, and it puts the 2 to 4 mm wide cleaned stripes on the soil mesh analytically, independent of film resolution.
3. **An integer water ledger and a causal predictor-corrector cycle integration.** Water mass is carried everywhere (sump, pipes, jets, parcels, film cells, reservoirs) as an integer count of 10⁻¹³ kg quanta, so mass conservation across module boundaries is a bit-exact assertion and all scatter operations are order-independent (the property the determinism spike measured for fixed-point atomics). The whole-cycle integration is a predictor-corrector over the intervals between film solves, so each solve sees the soil state that exists at its programme time, and the predictor-corrector difference is a free error indicator.

**Where this proposal is weak (stated plainly).** (i) It pays for generality. The spike's indexed stencil is 2.6 times slower per cell-update than its structured one [MEASURED], and at equal cell area a triangle needs about 15 to 20 % more steps than a square [B-EST, section 6.4]. Because that 2.6 is a byte ratio, and the forest keeps only about 22 static bytes per cell beside roughly 70 bytes of hot state that an atlas kernel would carry too, I expect the real price against an atlas with the same physics to be about 1.5 times per unit area and time, not 3 [B-EST]; but that is unmeasured, and an atlas design that can live with less hot state per cell would widen the gap. (ii) The asset pipeline (robust booleans, quality remeshing with an acute-angle gate, 2:1 level balance) is real engineering and can reject bad CAD. (iii) A first-order scheme on a triangular lattice has three preferred directions; rivulet paths may show mesh bias (prototype 3 measures it). (iv) Rack wires as octagonal prisms get only a crude film. (v) Deep pools are lumped, not resolved. (vi) The film duty cycle that sets the budget is my estimate, uncertain by a factor of about 2; the plan holds a 34 % margin against the 30-minute cap on the largest load, but only 10 % against the 20-minute GPU allowance there (32 % on the nominal load).

---

## 2. Error budget

What decides clean / not-clean for an item is, in order: is the soiled cell wetted with renewed liquor, for how long, at what temperature and chemistry; is it inside a jet stripe; and what are the soil's kinetic constants. The table ranks error sources by my estimate of the fraction of scored items in a hard-soil level whose clean flag they could flip. All magnitudes are [B-EST] and are meant to order the list, not to be quoted.

| Rank | Error source | Evidence for its size | Items whose flag it can flip | Common-mode or differential | Can compute reduce it? | Consequence for this design |
|---|---|---|---|---|---|---|
| 1 | Soil kinetic and adhesion constants, ageing, visibility thresholds | J_r,ref within x3 for egg yolk, x10 for others; lag 0.4 to 33 min; C_coh, C_ad 0.1 to 20; thresholds x3 (soils calibration table; standards §10.3) | 20 to 30 % | Mostly common-mode: shifts all loads together | No. Calibration only | Implement the soil model at full fidelity (12 layers, implicit) because it is cheap; expose every constant; do not spend more than about 15 % of the budget on it |
| 2 | Indirect wetting map: splatter fraction, splash products, drip routes, cascade from the upper rack | xi between 0 and 0.4, two conflicting data families (jets §5.3); wire and rim rules are estimates (jets §7.3) | 10 to 15 % (interiors of tall vessels, shadowed faces, lower-rack tops) | Differential: changes the ranking of loads | Partly: geometry of where water goes is computed; the source strengths are calibration | Time-domain coupling of parcels and film on the true geometry is the largest budget item (about 70 %) |
| 3 | Wet/dry behaviour on partially wetting materials | receding angle uncertain by ±20° on plastics and steel (films §13 item 1); beta_cl 0.085 to 1 published (numerics §2.2e) | 5 to 15 % (plastics, steel, PTFE) | Differential by material | Partly: resolution to carry rivulets (0.75 mm cells on soiled plastics) | Three water levels by material; frozen random contact-angle field; prototype 3 |
| 4 | Direct-jet coverage: which cells sit in stripes above tau* | Geometric and deterministic; dwell 0.07 to 1.6 % of a revolution (numerics §4.1 [VERIFIED]); soil insensitive to 12 to 65 Pa magnitude (soils §6.6 [VERIFIED]) | 5 to 10 % | Differential | Yes, cheaply: exact triangles, 19 sub-rays, swept stamps | Exact shadowing is a hard requirement on geometry (0.05 mm chord error; thin walls and wires as real solids) |
| 5 | Liquor temperature and chemistry history | protease half-life at 60 °C 10 to 240 min; pH plateau ±0.5 (chemistry §11) | 10 to 20 % in absolute terms, small in ranking | Common-mode | No | CPU ODE model as specified; per-cell film composition only where renewal is slow |
| 6 | Pooling, retained water, capillary bridges | Basin volumes are pure geometry; edge-held puddles depend on theta_a (films §7.2) | 5 to 10 % (clean requires V_pool at most 1 mL, standards §10.2) | Differential | Yes: basin analysis is exact on the mesh | Priority-flood basins per pose; generic links for bridges and gaps |
| 7 | Redeposited specks | Capture efficiencies and stranding thickness unmeasured (chemistry §11 items 12, 13) | 5 to 10 % at the 4-speck boundary | Mixed | No | Speck intensity per cell plus seeded Poisson draw (standards §10.5) |
| 8 | Items moved or flipped by jets | Pi_J estimates (items §4.4); binary and large when it happens | 0 to 5 % | Differential | Yes: event-driven rigid-body episodes | Coupling interface in section 9 |
| 9 | Numerical error: film discretisation, phase and parcel sampling, time homogenisation | Averaging error O(epsilon), epsilon = 7e-4 to 7e-3 (numerics §4.1); first-order film reproduces Nusselt to 0.5 % and Jeffreys to 2 % at production cell size (my check, `film1d.py`) | target: at most 2 % against a twice-refined reference | Differential but small | Yes | Hold it at about one third of the smallest model-form error and no lower |

How the allocation follows. Compute cannot touch ranks 1, 5 and 7. It can make ranks 4, 6 and 8 nearly exact for little cost, and it is the only tool against the geometric half of ranks 2 and 3. So: geometry is exact everywhere; jets are analytic and cheap (under 2 % of the budget); the money goes to the coupled film and droplet simulation on the true surfaces (about 70 %); the soil model gets what it needs to be numerically clean (about 14 %); the rest is set-up, I/O and margin. Second-order film numerics and uniformly fine film meshes are deliberately not bought, because rank 9 is already below ranks 2 and 3.

---

## 3. Geometry and surface representation

### 3.1 One representation, built in two stages

**Stage 1, asset build (offline, cached with the catalogue; not in the 30-minute budget).** Input: the parametric definition (profile polyline (r, z, t), add-ons; items §2.1, §2.2), or an imported triangle or CAD mesh. Steps:

1. Build the solid's boundary as a closed, oriented 2-manifold. A thin shell of revolution becomes the outer and inner offset surfaces of its mid-surface joined by the rim; handles, stems and feet are united with the body by an exact mesh boolean; cutlery and boards are solids already.
2. Remesh isotropically to a size field
   `a_G(x) = snap( min( sqrt(8 eps_c R_min), theta_max R_min ) )`, with `eps_c = 0.05 mm` (chord error), `theta_max = 0.15 rad` (turn per edge), `R_min` the smaller principal radius of curvature, and `snap` rounding down onto the ladder {6, 3, 1.5, 0.75} mm (tolerance ±25 % on individual edges) [B-EST]. Flat and gently curved regions get 6 mm macros; a cup wall of 40 mm radius gets 3 mm; a handle of 5 mm radius gets 0.75 mm.
3. Regions with R_min below 2 mm (films §12.5 edge criterion, `|kappa_s| > 500 1/m`) are not resolved as smooth surface. They become *feature creases*: a rim is two chamfer facets, a knife edge is one crease. Each crease edge stores an edge radius r_e and wedge angle, which the film edge rule uses (section 6.6).
4. Quality gate: minimum angle at least 35°, maximum angle at most 85° for at least 99 % of macros (acute triangles make the two-point flux between circumcentres orthogonal to the shared edge); the remaining macros are flagged and use a skew-corrected gradient. Manifoldness and consistent orientation are mandatory. An asset that fails is rejected with a report; this is the price of accepting arbitrary CAD.
5. Per macro vertex store the normal and mean curvature kappa_s (analytic for parametric items, quadric fit for imports). Per macro store its *opposite-face partner* across the wall thickness (found by one inward normal ray) and the local wall thickness, for wall conduction.
6. Build one bottom-level BVH per asset in the item's local frame and store region labels (soilable regions, material, feature tags: smooth face, wire of width D_w, rim).

Racks are wire networks: each wire is swept as an octagonal prism of area-equivalent radius with 3.5 mm long segments; intersecting wires are allowed to overlap (see links, 3.5). The tub, door liner, sump cover and filter plate are plain panels with 6 mm macros. Spray arms are assets instanced with a phase-dependent transform.

**Stage 2, wash set-up (per run, about 40 s).** For each instance, choose per macro a water level l_w and a soil level l_s from fixed per-region rules, subdivide, and allocate state. The rules depend only on the item's own material and region tags, never on the rest of the load or on timing:

| Class | Where | Water cell edge | Soil cell edge | Basis |
|---|---|---|---|---|
| W0 | faces that carry no soil on materials whose receding angle in the current liquor is at most 10° (glass, glazed ceramic); tub, door, racks | 3 mm (3.90 mm²) | none | films §12.6: 2 mm squares (4 mm²) "where the film stays continuous" [ESTIMATED] |
| W1 | every soilable face; all faces of steel, melamine and other partially wetting materials | 1.5 mm (0.974 mm²) | 1.5 mm, same cells | films §12.6 default 1 mm squares; standards §10.5 (cell area 1 to 4 mm² or sub-cell coverage) |
| W2 | soiled regions on rivulet-prone materials (receding angle above 20°: PP, PE, PTFE, silicone), and soiled undersides within 10° of horizontal | 0.75 mm (0.244 mm²) | 0.75 mm, same cells | films §12.6: 0.5 mm squares on rivulet-prone materials |

Equal-area equivalence: an equilateral triangle of edge a has area 0.433 a², so edges of 3, 1.5 and 0.75 mm correspond to squares of 1.97, 0.99 and 0.49 mm. W2 costs eight times more per square metre than W1 (four times the cells, twice the steps), so the total W2 area is capped at 0.40 m². The cap is enforced on the level's *item pool* at level-design time, not on the player's load, so a player's choice can never change the resolution of another item.

### 3.2 Why children stay in the macro plane

A macro triangle is subdivided by repeated midpoint 1:4 splits without moving the new vertices. Consequences:

- All 4^l children of a macro are congruent (upright and inverted copies). Area, the three edge lengths, edge normals and circumcentre offsets are per-macro constants. A cell needs no geometry record.
- Momentum is stored as two components in the macro's planar frame. Inside a macro no rotation is needed. Across a macro edge the two frames are related by unfolding about the shared edge (the "hinge" map), one 2 x 2 rotation per macro half-edge.
- The faceting error is that of the macro mesh (0.05 mm), but the *forcing* is smooth: each child evaluates its normal by barycentric (Phong) interpolation of the three macro vertex normals, and from it `g_t` and `G_n`; kappa_s is interpolated the same way. The potential uses a per-child f16 displacement along the macro normal (the gap between the flat child centroid and the true surface), so a lake at rest is level to float precision, not to chord precision.
- A ray hit maps to a child without any search (3.4).

### 3.3 Counts and memory for a full load

Reference loads: nominal 6.0 m² of item surface counting both faces, largest 8.5 m² (the brief's range is 5 to 8.5 m²); half of the item area is soilable; material split by area 75 % glass and glazed ceramic, 12 % steel, 13 % plastics [B-EST from items §10 and standards §5.1 class weights]; racks 1.1 m² (about 100 m of wire, numerics §5.3 [ESTIMATED]); tub, door, arms and sump 2.1 m². Numbers from `budget.py`:

| Quantity | Nominal load | Largest load |
|---|---|---|
| Macro triangles (BVH primitives) | 1.9 M | 2.5 M |
| W2 water cells (0.39 and 0.40 m², capped) | 1.60 M | 1.64 M |
| W1 water cells | 3.45 M | 5.04 M |
| W0 water cells on items | 0.58 M | 0.82 M |
| Rack cells | 0.46 M | 0.46 M |
| Tub cells | 0.54 M | 0.54 M |
| **Water cells, total** | **6.6 M** | **8.5 M** |
| Soil cells (1.5 m² and 3.0 m² actually soiled) | 1.5 M | 3.1 M |

GPU memory, largest load: film hot state 24 B x 2 (ping-pong) = 0.41 GB; neighbour table 12 B = 0.10 GB; pending and deposit accumulators 16 B = 0.14 GB; macro records 96 B = 0.24 GB; BVH 71 MB per million triangles [MEASURED at 1 M] = 0.18 GB; soil state 64 B = 0.20 GB; exposure accumulators during a solve about 120 B per soil cell = 0.37 GB; two packed exposure record sets resident at a time (64 B per soil cell, 16 B per other water cell) = 0.57 GB; parcels and tables 0.1 GB. Total about **2.3 GB**. The other packed record sets (8 per programme) live in CPU memory, 2.3 GB at most, and are streamed at the measured 7 to 10 GB/s. This sits inside the 2 to 3 GB design target of the spike report (GPU buffers are wired memory; 4 GB is the hard ceiling on an 18 GB machine). The largest single binding is 0.37 GB, far below the 4 GiB limit at which bindings fail silently.

Instancing: thirteen identical plates share one asset (macro records, BVH, forest topology); only state is per instance. Gravity enters as a per-instance vector in the item frame. Asset data in the table above are therefore upper bounds.

### 3.4 Queries

**Ray and parcel queries.** Two-level BVH: bottom level per asset over macro triangles (cached), top level over at most about 200 instances, rebuilt in microseconds when an item moves or an arm turns. Watertight ray-triangle test so that nothing leaks through shared edges (numerics §5.1 [RECALLED: Woop et al.]). A hit returns (instance, macro, u, v, t).

**From hit to cell.** With n = 2^l subdivisions per edge and barycentric (u, v):

```
i = min(floor(u n), n - 1);  j = min(floor(v n), n - 1 - i)
upper = (frac(u n) + frac(v n) > 1) and (i + j < n - 1)
child = 2 n j - j^2 + 2 i + upper              // 0 .. n^2 - 1, row-major inside the macro
cell  = offset[instance][macro] + child
```

Checked for n = 1, 2, 4, 8 by random sampling (`checks2.py`). The same formula with l_s gives the soil cell. Ties on child borders use the half-open rule above, so a hit maps to exactly one cell; the test suite requires bit-equality with a TypeScript reference, as the BVH spike already achieved (0 disagreements in 1501 rays [MEASURED]).

**Neighbours.** Inside a macro: implicit. Across a macro edge: the macro record lists the neighbour macro and which of its edges is shared; on a consistently oriented manifold the shared edge runs in opposite senses, so child position p along the edge meets position n - 1 - p on the other side. Where levels differ the 2:1 rule applies (one coarse child faces two fine children; the coarse cell's flux is the sum of the two fine fluxes). Level differences larger than one are removed at set-up by promoting the coarser macro.

The *baseline* kernels read an explicit per-cell neighbour table (3 x u32, generated from the rules above) and are therefore a plain unstructured finite-volume code that also runs on a mesh with no hierarchy at all. Cells are ordered instance-major, macro-Morton, child-row-major, which is the "spatially coherent ordering" of the spike. The implicit path is an optimisation with a bit-equality test against the explicit one.

### 3.5 Special cases, all through the same path

| Case | Treatment |
|---|---|
| Both faces of a thin shell | Two regions of one closed mesh. Water can pass from one to the other only round the rim, through the rim facets, under the edge rule. Heat couples them through the opposite-face partner |
| Interior of an inverted cup or bowl | The inner face of the same mesh. Jets enter if their sub-rays pass the opening; the ceiling film, its departure or its run down the wall, and the ring at the lower rim all arise from the general film and edge rules (section 6). No vessel-specific code |
| Handles, stems, feet | United with the body at asset build; the root fillet is ordinary mesh with large kappa_s gradient, which is where the capillary term collects water (films §4.2 note) |
| Cutlery | Solid meshes at W1 (steel). Fork tines 2 to 3 mm wide carry two cells across; the gaps between tines narrower than a cell are handled by gap links |
| Rack wires | Octagonal prisms, one cell per facet per 3.5 mm. Shadowing is exact to about 0.1 mm in width. The film on a wire is coarse: it collects, runs to the low side and drips at about the right rate and place, nothing more |
| Polar points | None. The macro mesh is isotropic at the axis of a plate |
| Seams | None. There is no parameterisation |
| Contacts, nesting, overlapping parts | **Links.** At set-up each water cell casts one short ray along its outward normal (8.5 M rays, about 0.1 s). A hit on another surface within `w_c = 2 l_c` (capillary length l_c = 1.8 to 2.7 mm; standards P04 [ESTIMATED]) creates a link between the two cells with the gap width w. Links are extra edges of the finite-volume graph. They carry (a) capillary-bridge reservoirs at contacts (films §12.5: 20 µL each [ESTIMATED]), (b) gap reservoirs between nested faces, which hold liquid up to the capillary rise `2 sigma cos(theta) / (rho g w)` and exchange it only by diffusion, and (c) film transfer between overlapping wire prisms. A cell whose normal ray starts inside another solid is dead and is removed |
| Perforated ware (colander, sieve) | Material flag with open fraction: sub-rays pass with that probability using the counter-based generator. Listed as only partly covered in section 13 |
| Spray-arm surfaces | Ray obstacles and deposition sinks: water landing on an arm returns to the sump after a fixed 0.3 s. No film is solved in the rotating frame |

### 3.6 Where structure is reintroduced without losing generality

The stance accepts 1.2 to 1.6 G cell-updates/s for an indexed stencil. It does not follow that the design must be structureless. Structure enters in six places, none of which adds a second code path for a class of geometry:

1. **Inside a macro triangle.** Children are a regular triangular lattice: implicit neighbours, shared metric, one tangent frame. The spike report measures what this is worth: the indexed benchmark carries 16 B of state, 16 B of neighbour ids and 32 B of edge geometry per cell (80 B of traffic per update with the write) against 32 B for the structured one, and its rate is lower by 2.6, where bytes alone predict 2.5 [MEASURED, RESULTS.md §5]. With Morton ordering the access pattern costs almost nothing; the bytes cost everything. In the forest the geometry is per macro (about 6 B per cell amortised at 16 children), the explicit path keeps a 12 B neighbour table and 4 B of auxiliary data, and the implicit path drops the neighbour table as well. For the film kernel that is about 22 static bytes in roughly 95 on the explicit path and 10 in 83 on the implicit path, so the implicit path is worth about 1.15 times [B-EST, unmeasured, not in the budget], and most of the benefit of structure is already in the baseline.
2. **Blocks.** Macros, or groups of small macros up to 64 cells, are the unit of local time stepping, active-set dispatch and workgroup assignment. This is what makes the active set coherent in memory.
3. **BVH leaves are macros.** The acceleration structure is 4 to 64 times smaller than one over cells, and the hit-to-cell map is arithmetic.
4. **Instancing.** Identical items share macro records, bottom-level BVH and forest topology. A 13-place-setting load has about 20 distinct assets for about 140 instances.
5. **Rotational regularity of parametric items.** The asset builder may generate the macro mesh of a shell of revolution ring by ring, so macro records compress per ring. This is storage compression only; the solver does not know.
6. **Flat panels.** Tub walls are single regular lattices and are fully implicit.

What is not reintroduced: no surface parameterisation, no charts, no per-shape solver, no second representation for wires or cutlery.

---

## 4. Machine hydraulics and spray-arm kinematics

This is the machine dossier's model (machine §12.2) used as written; it runs on the CPU in f64 and costs nothing. I list only what the jets need and the couplings this design adds.

**Operating point**, re-solved at every change of pump speed N, diverter state, nozzle blockage, filter state or air fraction:

```
pump:    H(Q, N) = H_0 (N/N_0)^2 f_H - b Q^2 ,   p_pump = rho g H              [m, Pa]
branch:  p_pump = rho g z_j + K_j Q_j^2 + p_arm,j ,   Q_j = (C_d A)_j sqrt(2 p_arm,j / rho)
solve    sum_j Q_j(p) = Q_pump(p)   by bisection on p
nozzle:  Q_i = C_d,i A_i sqrt(2 p_arm / rho) ,  V_i = C_v sqrt(2 p_arm / rho) ,  d_i = d_n,i sqrt(C_d,i / C_v)
```

Defaults: N_0 = 3000 rpm [VERIFIED nominal], H_0 = 5.5 m, b = 4.80e6 m/(m³/s)² [ESTIMATED] (machine §4.2); branch lifts z = 0.15, 0.52, 0.80 m and losses K = 2.0e10, 5.6e10, 1.07e12 Pa s²/m⁶ [ESTIMATED] (machine §4.3); per-nozzle C_d from the SPOT-60 tables, 0.78 to 0.85 [ESTIMATED] (machine §3.2). For C_v the dossiers differ (machine 1.0, jets 0.97); I take 0.97 [RECALLED] (jets §2.2) because the jet module needs the contraction C_c = C_d / C_v below 1 to get the jet diameter. Resulting reference point: lower arm 34.9 kPa, about 8.1 m/s, 30.7 L/min.

**Arm speed** from the torque balance (machine §3.3):

```
I d(omega)/dt = sum_i mdot_i r_i (V_i t_i - omega r_i) - (k_f |F_ax| + c_v omega) sgn(omega) - T_contact
t_i = cos(rho_i) sin(theta_i) ;  F_ax = p_arm A_hub + s (F_jz + W)
steady: omega = (sum_i mdot_i V_i r_i t_i - k_f |F_ax|) / (sum_i mdot_i r_i^2 + c_v) , clipped at 0 (stall)
```

with k_f = 9.3 mm (lower), 3.8 mm (mid), c_v = 0.002 N m s [ESTIMATED, tuned to 35 and 30 rpm at 3000 rpm]. T_contact comes from the rigid-body engine (section 9). The arm stalls when T_contact exceeds about 0.07 N m (0.3 N at the tip) [ESTIMATED] (machine §3.3). If contact makes the rotation non-uniform, the jet module receives the phase law phi(t) over one period and weights every phase sample by its own dwell `d(phi)/omega(phi)`.

**Hydraulic states.** A state is (diverter position in {L, U, A}, pump speed, blocked or stalled flags). ECO 50 uses L and U at 2600 and 2800 rpm with 60/60 s and 45/45 s patterns, and A for 20 s after the first fill and the last 30 s of the final rinse (machine §7.3 [ESTIMATED]). Film solves are run for L and U (section 7.1). State A (50 s out of 6300 s of spraying) is not solved; its record is the time-weighted sum of the L and U records with shear scaled by (V_A/V)^1.5 and flux by Q_A/Q. The 1.5 s diverter transitions are treated the same way. Both are listed as approximations in section 13.

**Water inventory**, each macro step, from the integer ledger (section 6.11):

```
V_sump = V_total - V_pipes(open branches) - V_jets - V_parcels - V_film - V_reservoirs - V_absorbed
```

V_jets = sum of Q_i times flight time (analytic); V_parcels, V_film, V_reservoirs are the time-means measured in the film solve of the current state (the machine dossier's placeholders t_flight = 0.5 s, t_return = 1.5 s are used only before the first solve). If V_sump falls below V_min = 0.5 L [ESTIMATED] the air fraction alpha = clamp(1 - V_sump/V_min, 0, 0.6) derates the head by f_H = 1 - 2.5 alpha (machine §4.5 [ESTIMATED]). Surging is represented as a duty cycle on the exposure records, not by re-solving the film. Foam enters the same alpha from the chemistry model. Filters follow machine §12.2 item 5.

---

## 5. Jets and droplets

### 5.1 Sampling

| Item | Official tier | Basis |
|---|---|---|
| Arm phases per revolution, per arm, per state | N_phi = 2048, uniform (0.176°; 0.73 mm of travel for the outermost nozzle) | machine §12.3 asks 360 to 720; jets §11.2 uses 1440; numerics §4.2 4096. With swept stamps (5.5) the result does not depend on N_phi beyond the point where consecutive footprints overlap |
| Sub-rays per round jet | 19: centre, 6 at 0.46 r_0, 12 at 0.83 r_0, equal flow weights | jets §7.3 "7 or 19"; 19 so that a 4.2 mm wire or a rim splits a 2 mm jet in steps of 5 % |
| Slot nozzle | 7 round sub-jets across the fan, 7 sub-rays each | jets §2.5 [ESTIMATED] |
| Random numbers | counter-based hash of (seed, stream, nozzle, phase index, sub-ray, bounce) | numerics §6.2 |
| Break-up | not sampled: both outcomes are traced and weighted by f_c and 1 - f_c | removes a noise source; my choice |

Because the forcing is periodic, primary tracing is done once per hydraulic state and stored as a **footprint table** (section 12). It is re-done only when geometry or the state changes. It costs under a second.

### 5.2 Launch and flight (analytic)

```
u_0 = V_i R_z(Theta) n_i + Omega z_hat x P(t_0)                      jets eq. (2.3)
x(t) = P(t_0) + u_0 (t - t_0) + (1/2) g (t - t_0)^2                  jets eq. (2.4)
```

Gravity only for coherent jets (drag is about 5 % of g, jets §3.1 [ESTIMATED]). The parabola is traced as segments with chord sag below 0.1 mm, i.e. at most 9 ms each (numerics §5.1 [ESTIMATED]); 2 to 8 segment queries per sub-ray. Each stamp is tagged with its *arrival* phase (emission phase plus Omega times flight time).

Break-up along the flight path:

```
L_b = C_b d (sqrt(We) + 3 We/Re) ,  C_b = 6                           jets eq. (3.1) [ESTIMATED default, VERIFIED bounds 3.3 to 12]
f_c(s) = 1 for s <= 0.6 L_b ; linear to 0 at 1.4 L_b                  jets eq. (3.2) [ESTIMATED]
f_sh = clamp(0.05 (s - x_i)/L_b, 0, 0.1) ,  x_i = 13 d (Tu^3 We)^(-0.915) , Tu = 0.05    jets §3.4, §3.6
```

The fraction 1 - f_c arrives as a drop train (D = 1.9 d, spacing 4.5 d, jets §3.5) and is handed to the parcel model at a stratified break-up location; the shed fraction f_sh leaves as parcels with D_32 = 0.649 d (Tu² We)^(-0.657) [VERIFIED correlation, Trettel] (jets §3.5). Lower-rack items (s = 30 to 150 mm) always see coherent jets with these defaults.

Mean-field interception by falling water (numerics §4.4 [ESTIMATED]): a 64³ grid over the tub accumulates droplet number density n and mean diameter from the parcels; each jet's coherent fraction is multiplied by `exp(- c_int integral n pi ((d + D)/2)^2 ds)`, c_int = 1.

### 5.3 From sub-rays to footprints

Sub-rays of one nozzle at one phase that land on the same smooth region of the same instance form one footprint: flow `Q_hit = (hits/19) Q f_c`, centroid O, impact velocity u_imp, incidence `phi = asin(|u_imp . n_w| / |u_imp|)`, forward direction e_t, source point `S = O - r_0 cot(phi) e_t`, and footprint velocity v_s from the displacement of O to the next phase (jets §11.2 step 4). Sub-rays that land on a macro tagged as wire, tine or rim (feature width below 3 d) follow 5.8. Sub-rays that miss everything continue to the next surface as a reduced jet.

### 5.4 Impingement closures (analytic)

All from jets §4 and §11.2 step 5. With x_f, x_l the forward and lateral wall coordinates from O, r and psi polar coordinates about S, and X = sqrt((x_f sin(phi))² + x_l²)/d:

```
pressure   p_w = (rho V^2/2) sin^2(phi) sech^2(0.916 X + 0.95 X^3)                       eq. (3.6) [ESTIMATED fit to VERIFIED series]
flow split q(psi) = (V r_0^2/2) sin^3(phi) / (1 - cos(psi) cos(phi))^2   [m^3/(s rad)]   eq. (3.22) [VERIFIED]
           d_eq = sqrt(8 q/V) ,  Re_eq = V d_eq/nu ,  r_e(psi) = r_0 sin(phi)/(1 - cos(psi) cos(phi))
stagnation tau_w = k_stag 1.150 rho (V sin phi)^2 Re_n^(-1/2) X ,  Re_n = V sin(phi) d/nu   eq. (3.7a), capped by the next line
BLFZ       tau_w = k_film 0.472 rho V^2 Re_eq^(-1/2) (r/d_eq)^(-1/2)                      eq. (3.10) [VERIFIED]
           h/d_eq = 0.125 (d_eq/r) + 1.06 Re_eq^(-1/2) (r/d_eq)^(1/2) ,  U_av = V d_eq^2/(8 r h)
           up to r_b = 0.24 Re_eq^(1/3) d_eq
laminar    h/d_eq = 3.792 Re_eq^(-1) (r/d_eq)^2 + 0.1975 (d_eq/r) ,  tau_w = mu V d_eq^2/(4 r h^2) ,  up to r_t = 0.2964 Re_eq^(1/3) d_eq
turbulent  U_av = V / [0.167 Re_eq^(-1/4) (r/d_eq)^(9/4) + (2.37 - 0.0108 Re_eq^(1/2))]
           h/d_eq = 0.0209 Re_eq^(-1/4) (r/d_eq)^(5/4) + (0.296 - 0.001356 Re_eq^(1/2)) (d_eq/r)
           tau_w = 0.0478 rho Re_eq^(-1/4) U_av^2 (r/d_eq)^(1/4)                          eqs. (3.13)-(3.15) [VERIFIED]
momentum   M = (64/63) rho q U_av / r    [N/m]                                            eq. (3.16)
jump       R_j(psi) = 0.289 (2 pi q)^(3/4) (rho/(nu gamma))^(1/4)                          eq. (3.17) [VERIFIED, three sources within 8 %]
```

Defaults k_stag = k_film = 1 (ranges 1 to 2.8 and 0.7 to 2, jets §11.3). Surface tension in this zone is gamma_water(T), because the surfaces are milliseconds old (jets §4.5 [VERIFIED basis]). Beyond the splatter radius 4.5 d_eq the flow is scaled by (1 - xi). I re-computed the J2-8 profile at 50 °C from these equations and reproduced the dossier's table to the printed digits (`jet_profile.py`).

Curvature: the solution is applied in geodesic polar coordinates on the mesh while `|kappa| R_j < 0.5` (jets §4.8). Coordinates come from a bounded breadth-first walk over soil cells from the hit cell, unfolding across macro hinges; the walk stops at feature creases, which is how a rim or a plate edge clips the footprint.

Moving footprint (jets §4.9 [ESTIMATED]): the fast film cannot lead the footprint beyond r* where U_av(r*) = v_s . e_r; on a pre-wetted wall (residual film h_res from the film solver of the previous revolution) the front speed is multiplied by `1/(1 + sqrt(h_res/h))` when h_res > 0.3 h. When v_s exceeds V the event is a paint stripe with exposure time d_fp/|v_s|.

### 5.5 Swept stamps: exposure on the soil cells

Between two consecutive phase samples the source point moves from S_k to S_k+1 in time dt_k. For every soil cell reached by the walk, with lateral offset b from the track:

- duty above each shear threshold tau_m: `[chord(r_m^out, b) - chord(r_m^in, b)] / |v_s|`, where r_m^out and r_m^in are the outer and inner radii at which tau_w = tau_m (tau_w rises linearly to 0.55 d and falls monotonically beyond), `chord(r, b) = 2 sqrt(max(r² - b², 0))`, clipped to the segment and to r < min(r_h, r*) ahead of the footprint. This is jets eq. (3.25) evaluated in closed form. For phi below 60° the radii depend on psi and the integral is done by quadrature along the segment with step at most 0.5 mm;
- the same for the momentum-flux thresholds M_m;
- peak tau_w, peak M, peak p_w (atomic max), event count, dwell;
- fast-film presence time and mean thickness (for wetness and heat transfer inside the analytic zone).

A stamp therefore costs one evaluation per (footprint segment, cell) pair, and stripe width is resolved at 1.5 mm (0.75 mm on W2) whatever the film mesh is. Checked against the dossier: a cell on the track of J2-8 at v_s = 1 m/s must receive 4.3 Pa s per pass, above 100 Pa for about 12 ms and above 30 Pa for about 45 ms (jets §11.4 [ESTIMATED]); these are unit-test targets.

### 5.6 Hand-over to the film solver

The analytic zone of a footprint is the set of water cells with `r < r_h(psi)`,

```
r_h(psi) = min( r_U(psi), r*(psi), distance along the ray to the first feature crease )
r_U(psi): radius where the analytic U_av falls to U_h = 1.5 m/s
```

For the reference jets r_U is 23 to 53 mm, 0.55 to 0.75 of R_j, and tau_w there is 14 to 18 Pa (`jet_profile.py`). So the analytic zone contains every point where a jet produces more than about 18 Pa, and the film solver receives a 1.5 m/s film about 90 to 150 µm thick. The mechanics of the hand-over are in 6.6. The choice of U_h is discussed under dossier conflicts (section 15).

### 5.7 Splatter and splash (closure plus simulated parcels)

Splattered fraction (jets eq. (5.4) [ESTIMATED synthesis of VERIFIED data]):

```
omega = We exp(0.971 (l/d)/sqrt(We)) ;  xi_BL = max(0, -0.258 + 7.85e-5 w - 2.51e-9 w^2) , w = min(omega, 11000)
S_W = clamp(4.6e-5 (V d/nu_20 - 12000), 0, 0.40) ,  nu_20 = 1.0e-6 m^2/s
xi = k_S max(xi_BL, S_W) sin(phi) ,  k_S = 0.5 (range 0 to 1)
```

The splattered mass leaves as parcels from the ring r_s = 4.5 d_eq, 20° above the wall (uniform 10° to 30°), speed 0.7 V (0.4 to 0.9), log-normal diameter with median 0.08 d and geometric standard deviation 1.8 (jets §5.6). Official tier: 64 parcels per footprint per phase sample, each of about 3e-8 kg for J2-8.

Droplet impact on a wall (jets §11.2 step 6): with We_n = rho V_n² D/gamma_water, La = rho gamma_water D/mu², wall wet if the film cell holds more than 20 µm:

```
wet:  We_n < 2 stick ;  2 to 20 rebound (e = 0.993 - 1.76 th + 1.56 th^2 - 0.49 th^3, tangential x 5/7) ;
      20 to 1320 La^(-0.183) deposit ;  above: splash                                    [VERIFIED thresholds, OpenFOAM]
dry:  We_n < 2630 La^(-0.183) deposit (K = We sqrt(Re) < 3000 on smooth clean glass or glaze) ;  above: splash
splash: r_m = clamp(0.1 (We_n/We_c - 1), 0, 0.3)  (0.5 if h_res > 0.1 D) ; secondaries median 0.08 D, 10° to 40° above the wall,
        0.3 to 1.2 V_n plus 0.7 of the tangential velocity ;  one generation only          [ESTIMATED, jets §6.4]
stress pulse on soil cells within 0.5 beta_max D, beta_max = 0.61 (Re_n^2 Oh)^(1/6):
        p = rho V_n^2/2 for D/V_n ;  tau = k_drop 0.63 rho V_n^2 Re_n^(-1/2) for 2 D/V_n ,  k_drop = 0.7   [ESTIMATED]
```

Deposited mass, tangential momentum, enthalpy and liquor composition go to the pending buffers of the water cell (section 6.3). Here the numerics dossier (Bai-Gosman mass ratios 0.2 to 1.1) and the jets dossier (at most 0.3) disagree; I follow the jets dossier, which rests on millimetre-drop measurements.

Parcel flight: Schiller-Naumann drag in still air (jets eqs. (3.3), (3.4) [RECALLED]), stepped every two film super-steps (about 8 ms, sag 0.08 mm), one BVH segment query per step. The arms move in the top-level BVH, so they intercept rain correctly.

### 5.8 Wires, tines and rims (closure, flagged as the weakest part)

No measurements exist for these (jets §7.1). The sub-ray bundle is split by the real geometry. For the intercepted fraction f_hit on a wire or tine (jets §7.3, all [ESTIMATED]): stagnation stress on the wire's own cells; two fan sheets centred 40° from the incoming direction (spreads ±20° in plane, ±15° along the wire) at 0.8 V, emitted as parcels of median 0.25 d; 5 % retained as a film source on the wire cells. The passing part continues as a jet of diameter d sqrt(1 - f_hit), deflected by 5° x f_hit, with C_b reduced to 3.3 from there on. At a rim, sub-rays that land on a face form an oblique partial footprint; the film that reaches the crease with M > 2 gamma leaves as a sheet (handled by the film edge rule, so there is one rule for jet-driven and gravity-driven films).

### 5.9 Rain from above

Not a separate model. Water reaches the lower rack from above as parcels emitted by the film layer of upper items, rack wires and the ceiling: drops from edge drip sites, columns and sheets from edges, departures from undersides (section 6.7), plus splash secondaries. Because parcels and film are advanced together in time, a cascade (item to wire to item) takes its real time and lands where the geometry sends it.

### 5.10 What is analytic and what is simulated

| Process | Treatment |
|---|---|
| Nozzle discharge, jet path, break-up length, interception | Analytic, per phase sample |
| Stagnation pressure and shear, radial film above U_h, flow split, moving-footprint limits | Analytic, swept stamps on soil cells |
| Splatter fraction and droplet sizes; splash thresholds and products; wire and rim split | Closures (correlations and estimates) |
| Droplet flight, where every droplet lands, drips and cascades | Simulated: parcels against the BVH, in time |
| Film below U_h: jump, rope, drainage, wetting and dewetting, edges, pools | Simulated: finite volumes on the SRT forest, in time |

---

## 6. Water on surfaces

### 6.1 Governing equations

The films dossier's recommended set (films §4.2, eqs. (1) to (6)), unchanged. Per water cell: thickness h [m], flux q [m²/s] in the tangent plane, film temperature T_f, scalars c_k (fresh-liquor fraction, dissolved and suspended soil), wet flag, bead store b [m].

```
(1) dh/dt + div_s q = S_h
(2) dq/dt + div_s(beta_m q q/h) = c_F [h g_t - (h/rho) grad_s p] - tau_w/rho + S_q + F_cl/rho
(3) p = rho G_n h - sigma (kappa_s + lap_s h) + p_imp
(4) tau_w/rho = (1/2) f |u| u ,  u = q/h ,  f = max(24/Re_loc, 0.288 Re_loc^(-0.40)) ,  Re_loc = 4|q|/nu
(5) d(h T_f)/dt + div_s(q T_f) = S_h,dep T_dep - alpha_fw (T_f - T_w)/(rho c_p) - q''_evap/(rho c_p)
(6) d(h c_k)/dt + div_s(q c_k) = S_h,dep c_k,dep + j_k,wall
```

G_n = -g . n (positive on upward faces, negative on undersides); g_t the tangential gravity. Defaults: beta_m = 1.2 on the laminar branch of f and 1.016 on the turbulent branch; c_F = 1 (Shkadov form); gas shear zero (films §12.2). The friction law is the films dossier's unification: it reproduces the Nusselt film and matches the Blasius wall-jet law to 1 % at Re = 5000 (films §3.3 [ESTIMATED from VERIFIED correlations]). Heat transfer alpha_fw = 1.88 k/h on the laminar branch and 0.0106 Re^0.3 Pr^0.63 k (g/nu²)^(1/3) on the turbulent branch (films §9.1 [VERIFIED correlations]). Liquor surface tension in this zone is the films dossier's table: 60, 40, 55, 45 mN/m for pre-rinse, main wash, intermediate rinse and final rinse with rinse aid (films §12.8 [ESTIMATED]).

Inertia is kept. It is needed physically (wall-jet run-off, jumps, edge separation) and numerically: the explicit inertial capillary limit scales as dx², the lubrication limit as dx⁴/h³ (films §10.3).

### 6.2 Discretisation on the forest

Cell-centred finite volumes on the water cells; cell "centres" are circumcentres, so the line joining two neighbours is orthogonal to their shared edge on acute macros (section 3.1 gate). For an edge e of length l_e between cells L and R (L is the cell with the lower index; R's flux vector is rotated into L's frame by the hinge map if they belong to different macros), with centre distance d_e and unit normal n_e from L to R:

```
Phi_b = -g . x_c + p_imp/rho - (sigma/rho)(kappa_s + lap h)        substrate potential per cell [J/kg]
G_e   = (G_n,L + G_n,R)/2
if G_e > G_min = 0.5 m/s^2:                                        // face can hold a hydrostatic balance; G_min is [B-EST]
    z_L = Phi_b,L/G_e ; z_R = Phi_b,R/G_e ; z* = max(z_L, z_R)
    h_L* = max(0, h_L + z_L - z*) ; h_R* = max(0, h_R + z_R - z*)
    F = HLL((h_L*, u_L), (h_R*, u_R)) with pressure term (1/2) G_e h*^2
    each side adds the correction (1/2) G_e (h_side^2 - h_side*^2) l_e to its normal momentum
else:                                                              // steep faces and undersides
    F = HLL((h_L, u_L), (h_R, u_R)) without pressure term
    each side adds - h_side (Phi_tot,R - Phi_tot,L)/d_e over half the edge diamond ,  Phi_tot = Phi_b + G_n h
wave speeds  s = u_n -/+ sqrt( max(G_e, 0) h* + 4 sigma h/(rho d_e^2) )
```

This is hydrostatic reconstruction (Audusse et al.; films §10.4 [RECALLED]) with the potential in place of bed elevation, so that a lake at rest (`Phi_b + G_n h` uniform) gives zero flux exactly on any orientation; on undersides the destabilising term enters as a source, which gives the Rayleigh-Taylor cut-off of films §4.2. The capillary Laplacian uses the three-neighbour two-point formula, applied where h is below 0.5 mm [B-EST; thicker liquid belongs to pools and edge reservoirs] and with the free-surface slope clamped to 0.5 near contact lines (films §12.6 step f). Velocity from flux is desingularised: `u = sqrt(2) h q / sqrt(h⁴ + max(h⁴, eps⁴))`, eps = 1 µm (films §12.6 step 5).

Scheme: first-order Godunov in space, forward Euler in time, friction pointwise implicit: `q <- q/(1 + dt f |u|/(2h))`. I checked this combination in one dimension at production cell sizes (`film1d.py`): steady Nusselt thickness and wall shear within 0.5 % at Gamma = 0.02 to 0.2 kg/(m s); Jeffreys drainage `h = sqrt(nu s/(g t))` within 2 % from 5 s onward and within 9 % at 1 s (the tail of the initial pulse). Second order (MUSCL with two-stage SSP) is implemented as a developer option and is an early upgrade on partially wetting materials if measured cost allows (section 11.2).

**Integer mass.** The mass of a cell is an i32 count of quanta q_m = 1e-13 kg (resolution 0.03 to 0.4 nm of thickness; capacity 56 mm of depth on the largest cell). The mass moved through an edge in a step is `round(rho F_h l_e dt / q_m)`, evaluated by one symmetric function of (L state, R state), so both cells obtain the same integer whichever of them evaluates it. Positivity uses a donor-local cap that both sides can compute from the donor's state alone: the transfer through edge e is at most `floor(m_donor w_e)`, with `w_e` the share of edge e in `sum over the donor's edges of l_e (max(u . n, 0) + c)`. Film thickness for the flux formulas is `h = m q_m/(rho A)`. Thin films stop moving when a step's transfer rounds to zero, which with these numbers happens below about 1.4 µm; that is under the 2 µm drying threshold (6.5). The 1-D check showed no visible effect of quantisation down to 25 µm.

### 6.3 State and buffers

Per water cell, hot state 24 bytes (ping-pong): mass (i32), q_1, q_2 (f32), T_f offset from liquor (f16), fresh-liquor fraction (f16), soil-load scalar (f16), bead store b (f16), flags (u16: wet, level, per-edge pinned bits, submerged, gap, dead), random contact-angle offset and spare (u16). Pending buffers 16 bytes (atomic i32): mass quanta, two momentum components and enthalpy in fixed point. Everything that arrives from outside the cell's own flux loop (parcels, ring sources, reservoir overflow, transfers from a finer time level) is added to the pending buffers with atomicAdd and absorbed at the cell's next update. Integer addition is associative, so the result does not depend on scheduling [MEASURED: bitwise identical regardless of order].

### 6.4 Time stepping

Time is an integer. One arm revolution is 512 *super-steps* (3.5 ms for a 1.79 s period, 4.4 ms for 2.26 s); a super-step is divided into at most 32 sub-steps. Level k advances with `dt_k = dt_S / 2^k`, k = 0 to 5. Stability of the first-order scheme on a triangle of area A requires `dt sum over outflow edges of l_e lambda_e <= A`; for an equilateral cell of edge a in a supercritical film this is `dt <= 0.433 a / (|u| + 3c)`, and I use a safety factor C = 0.6 [B-EST]. Speeds each level can carry (`checks2.py`, dt_S = 4 ms):

| dt | W0, a = 3 mm | W1, a = 1.5 mm | W2, a = 0.75 mm | Typical occupant on W1 |
|---|---|---|---|---|
| 4 ms | 0.19 m/s | (not used) | (not used) | |
| 2 ms | 0.39 | 0.19 | (not used) | draining film thinner than 170 µm |
| 1 ms | 0.78 | 0.39 | 0.19 | pulse, 170 to 250 µm |
| 0.5 ms | 1.56 | 0.78 | 0.39 | pulse, 250 to 350 µm |
| 0.25 ms | | 1.56 | 0.78 | ring-source run-off (U_h = 1.5 m/s) |
| 0.125 ms | | | 1.56 | ring-source run-off on W2 |

The inertial capillary limit `0.35 d² sqrt(rho/(sigma h))` (films §10.3 [ESTIMATED]) with d = a/sqrt(3) is 5.8 ms at 50 µm and 2.6 ms at 250 µm on W1, and 1.5 ms and 0.65 ms on W2, so it never binds before the advective limit at these levels.

Levels are assigned per *block* (one macro, or a group of macros up to 64 cells), from the largest required rate among its cells with a factor 2 of headroom, and neighbouring blocks may differ by one level. Assignment happens once per super-step from simulated quantities only. Each level has a compacted block list; a sub-step dispatches the lists of the levels due. At a level interface the finer cell computes the transfer and adds its negative to the coarser cell's pending buffers, and the coarser cell skips that edge: the standard conservative local time stepping, exact here because the transfers are integers. Dry blocks with no pending input are not dispatched.

Triangles against squares, honestly: at equal cell area an equilateral triangle has a = 1.52 dx and an advective step limit of 0.66 to 0.76 dx/|u| depending on flow direction, against 0.71 to 1.0 dx/|u| for a square, so about 15 to 20 % more steps on average [B-EST]; The spike's ratio of 2.6 between structured and indexed stencils is a byte ratio (80 B against 32 B per update), so it does not transfer directly: for two film kernels with the same hot state the forest's extra static traffic is about 22 B in 95, a factor of about 1.3 in rate, and with the step factor about 1.5 per unit area and time against an atlas of the same resolution [B-EST]. Prototype 1 measures it. The budget does not rely on it.

### 6.5 Wetting and dewetting

The films dossier's model (films §12.4), which makes Meredith's contact-line force hysteretic. At an edge between a wet and a dry cell, with n_in pointing into the wet cell and Delta the cell width normal to the edge:

```
F_a = beta_cl sigma (1 - cos(theta_a + xi))/Delta      resistance to advance (dry cell's angle)
F_r = beta_cl sigma (1 - cos(theta_r + xi))/Delta      drive for retraction (wet cell's angle)
F_cl = clamp(F_hold, F_r, F_a) n_in                    F_hold: force that would zero the wet cell's outward normal momentum this step
```

beta_cl = 1 [VERIFIED for steep surfaces, Meredith; range 0.4 to 1]; xi is a frozen random offset with standard deviation 8° and correlation length 2 mm, generated from a hash of (seed, asset, macro, child) filtered over neighbours [ESTIMATED]. Contact angles per material and liquor are the table of films §12.7 [ESTIMATED, anchored]; on a soiled cell they are mixed with the soil's angles by covered fraction (films §2.3.4), which is how the soil state feeds back on wetting.

```
wetting:  a dry cell becomes wet when h + b > delta_wet = 0.5 [15 mu^2 sigma (1 - cos theta_a)/(rho^3 g_e^2)]^(1/5), g_e = g max(sin beta, 0.1),
          or when a neighbouring front advances into it                                   [VERIFIED formula, Hartley-Murgatroyd; factor 0.5 after Meredith]
drying:   when h < delta_dry = 2 µm: stays wet if theta_r < 5°, else the liquid moves to the bead store
beads:    immobile up to b_max = 0.03 l_c (cos theta_r - cos theta_a)/max(sin beta, 0.1) ; excess returns to the film ; beads count as wet with zero shear
          (capacity factor 0.03, range 0.01 to 0.06, and delta_dry are [ESTIMATED], films §12.4, §12.7)
```

The numerics dossier proposes Meredith's original thresholds (wet above 0.5 delta_c, dry below 0.001 delta_c) and a 10° spread; I follow the films dossier because it carries advancing and receding angles separately, which the dewetting-speed argument (films §5.5) shows to be the controlling material effect. Whether beta_cl needs re-fitting on triangles of 1.5 and 0.75 mm is prototype 3.

### 6.6 The hand-over ring

At each sub-step, cells whose centre lies inside the analytic zone of an active footprint are *masked*: they are not updated by the film kernel, and their state is set to the analytic thickness and velocity so that reports, heat transfer and the wet test read sensible values. On every edge between a masked and an unmasked cell the mass and momentum transfer is the analytic flux at the edge midpoint, `q(psi)(1 - xi)/r` per unit length at speed U_av, directed radially from S, written to the unmasked cell's pending buffers. Because the analytic flux field is divergence-free away from S, midpoint quadrature over any closed polygon of edges returns the footprint's flow to second order in (cell size / radius), about 0.1 % for a 28 mm ring on 1.5 mm cells. The ledger closes exactly regardless: the quanta actually injected are counted, and the per-footprint difference from `rho Q_hit (1 - xi) dt` is carried forward into the next step's injection.

When the footprint moves, cells entering the mask hand their existing mass to the ring (it is added to the outgoing flux of their azimuth: the fast film ploughs the residual film), and cells leaving the mask keep the analytic state as their initial condition, debited from the ring. Where r_h is cut short by a crease, the flux crossing the crease goes to the edge rule with the analytic momentum, so a jet landing near a rim throws its sheet onward (films §6.3).

The film solver then produces, without further rules, the deceleration from 1.5 m/s, the jump or rope where the momentum flux meets the contact-line force, its merging with a pre-existing film, and the drainage. A unit test requires the static-jet jump radius within 15 % of eq. (3.17) on glass at 0.6 to 4 L/min (films §12.10).

### 6.7 Edges, dripping and cascades

Creases are classified at set-up for the current pose: dihedral angle above 30° or `|kappa_s| > 500 1/m` (films §12.5). At a crease with film Weber number `We_e = rho |u . t|² h/sigma`:

```
We_c = max(2, C_tp (r_e/h)(1 + cos theta_a)) ,  C_tp = 1                    [VERIFIED scalings, ESTIMATED prefactor]
if We_e > We_c: separated fraction = clamp(0.882 - 1.908 exp(-(We_e/We_c)/1.264), 0, 1), emitted as a sheet (thickness h, velocity u) of parcels;
the rest, and everything when We_e <= We_c, continues round the crease onto the next face.
```

Lower edges and low points (where tangential gravity on all adjoining faces points to the crease) are **drip sites**: reservoirs spaced `lambda_d = 2 pi sqrt(2) l_c` along horizontal edges (23 mm for water at 55 °C [VERIFIED formula]; Mitrovic measured 22 mm), fed by the film flux that arrives. A site releases one drop of mass `rho (pi/6)(3.3 l_c)³` (broad edge; factor 3.3 [VERIFIED as the OpenFOAM default], films §6.4) or `0.65 sigma P/g` (tip of wetted perimeter P; Tate's law with Harkins-Brown factor [RECALLED]) when it holds that much; above the column and sheet loadings `0.048 mu Ga^0.301` and `0.72 mu Ga^0.236` per side (Hu and Jacobi, films §12.5; the factor of 2 in the definition of Gamma is unresolved in the dossier) it emits a continuous stream or a sheet. Each site keeps its last drop at the end. On undersides (G_n < 0) fine cells resolve pendant ridges directly; cells coarser than 2 mm (W0, including the tub ceiling) use the Brun threshold `h* = 3 l_c cos(alpha)/(1.62208 sin^(3/2)(alpha))` [VERIFIED] (films §3.5). A fast film on an underside leaves where `beta_m rho u² h <= sigma` (films §12.5), which is the water bell inside an inverted bowl.

Everything emitted becomes parcels with the film's velocity, temperature and composition, so "cascade onto items below" is the parcel model of section 5.

### 6.8 Pools

At set-up, a priority-flood over the water-cell graph in the gravity potential finds every closed basin, its spill cell, and a 16-entry table of volume against level (films §7.1). Basins shallower than 3 mm stay in the film solver, which is well balanced. Deeper basins are lumped reservoirs: state = mass (integer quanta), temperature, scalars, settled solids. Cells below the waterline are flagged submerged, are skipped by the film kernel, and report "immersed, zero shear, pool composition" to the soil model. Inflow is the film flux crossing the waterline plus parcels landing on the free surface (a parcel that hits a submerged cell is absorbed by the reservoir); overflow enters the film at the spill cell. Mixing follows `V dc/dt = eta_mix Q (c_in - c)` with eta_mix = 0.9, 0.5, 0.1 for jet-fed, through-flow and short-circuit feeding (films §7.3 [ESTIMATED]). Flat tops hold puddles through the pinned-edge rule: at a convex crease bounding an upward face the advancing angle is raised to `min(theta_a + 180° - wedge angle, 175°)` (films §12.5).

### 6.9 Capillary bridges and gaps

Links (section 3.5). A contact link holds a bridge reservoir of 20 µL (range 5 to 50) that fills from either cell and never drains (films §12.5 [ESTIMATED]). A gap link of width w below `2 l_c` holds liquid up to the capillary rise height above the lowest wet point of the gap; cells in a filled gap are wet with zero shear and exchange composition with the outside only through `eta_gap = 0.02` of the passing flux [B-EST placeholder; this is standards P04 and P15 and needs data]. Parcels larger than the gap do not enter it.

### 6.10 Heat

The film energy equation (5) is carried in the solver with the wall temperature frozen during a solve. What is stored per cell is the effectiveness `eps_T = (T_f - T_wall)/(T_liquor - T_wall)`, so the slow thermal model (section 8.3) can reuse it as the wall warms. Walls are one lumped node for metals and three nodes through the thickness for ceramic, glass and plastic (films §9.2), held per macro and coupled to the opposite-face partner.

### 6.11 Conservation properties

- Water: exact. Every transfer is an integer number of quanta moved from one holder to another: sump, pipes, jet columns, parcels, film cells, pending buffers, bead stores, drip sites, bridges, gaps, pools, soil uptake. `sum = constant` is asserted bit-exactly at every super-step in debug builds and at every phase boundary in release builds.
- Momentum: conservative in flux form inside the film; sources and sinks are explicit (gravity, friction, contact line, deposition, edges).
- Energy and scalars: flux form, f32, conservative to rounding; a per-phase audit compares enthalpy and each soil class against the liquor model (chemistry §10.13).
- Well-balanced for lakes at rest on any orientation; positivity by the donor cap.

---

## 7. Periodic forcing and whole-cycle integration

### 7.1 What is simulated in the time domain

A **film solve** is a time-domain run of the coupled film and parcel system for one hydraulic state, one liquor class (water, main-wash liquor, rinse, rinse with rinse aid) and one temperature, for N_spin spin-up plus N_avg sampled arm revolutions. Solves are grouped into **solve points** P_k at fixed programme times; each point has one solve for L and one for U. The schedule is a fixed function of the programme: one point for every liquor class that lasts more than 3 minutes, and a second point for the main wash after heat-up. For ECO 50 (machine §7.3):

| Point | Programme time | Liquor class, T | Solves | Revolutions (spin-up + sampled) | Simulated seconds |
|---|---|---|---|---|---|
| P1 | start of heat-up (E4) | main-wash liquor, about 20 °C | M-L, M-U | 3 + 2, 2 + 2 | 9.0 + 9.1 |
| P2 | one third into the hold (E5) | main-wash liquor, about 46 °C | M-L, M-U | 1 + 2 each, warm-started | 5.4 + 6.8 |
| P3 | intermediate rinse (E7) | rinse, about 36 °C | R-L, R-U | 1 + 1 each, warm-started | 3.8 + 5.2 |
| P4 | final rinse after rinse-aid dosing (E9) | rinse aid, about 50 °C | F-L, F-U | 1 + 2 each | 5.6 + 7.8 |
| D | after the last spray | | drain-down | | 4.0 |
| | | | | **Total** | **56.6** |

Revolution periods: 1.79 s (lower arm at 2800 rpm), 2.26 s (mid arm), 1.88 and 2.61 s at 2600 rpm (machine §3.3 table, interpolated). In state U the period is the mid arm's; the top arm (about 1 s) keeps its own integer phase counter, snapped to a whole number of super-steps, so the forcing is quasi-periodic and is averaged over the sampled revolutions (numerics §4.2). The counts follow the dossiers' estimates (numerics: 3 to 5 plus 2; films: 2 plus 1 to 2), justified by film memory of under a second on items; the longer-memory states (pools, wall temperature) are not left to the solve (7.5). Programmes with a real pre-wash get one more point with the water class. Warm starts carry the film state from the previous solve of the same diverter state.

The first minutes of the first fill (water, then dissolving detergent) use the P1 records. Contact angles are then slightly too low for one to three minutes; soils are still in their lag phase, so the error is small, and it is listed in section 13.

### 7.2 The loop inside a film solve

```
for rev in 0 .. N_spin + N_avg - 1:
  for s in 0 .. 511:                                   // super-step, integer phase
    set arm transforms in the top-level BVH for phase s
    activate the footprints of this super-step (4 phase samples of the footprint table): masks and ring sources
    every second super-step: emit parcels (splatter, fans, sheets, drips, break-up drops), advance all parcels one step,
                             resolve hits (deposit to pending buffers, splash secondaries, stress pulses)
    film: for sub in 0 .. 31: dispatch the block lists of the levels due at this sub-step
    reservoirs: basins, drip sites, bridges, gaps (overflow, release); wet / dry / bead transitions
    if rev >= N_spin: cells add their own dt to the exposure accumulators inside the film kernel
    reassign levels, rebuild block lists
  read back 64 monitor scalars
```

Direct-jet exposure does not come from this loop: stamps are computed once per solve from the footprint table over exactly one period (section 5.5). The loop contributes film shear and momentum flux outside the analytic zones, wetness, thickness, renewal, temperature, droplet stress pulses, and all the mass routing.

### 7.3 Convergence monitoring

Per solve and per revolution r: `R_wet = ||f_wet(r) - f_wet(r-1)||_2 / ||f_wet(r)||_2` over soil cells; `R_mass`, the relative change of total film mass; `R_drip`, the relative change of total reservoir throughput. Target 5 % (numerics §4.2 [ESTIMATED]). A fixed, bounded extension rule that depends only on simulated quantities: if R_wet exceeds 10 % at the end of spin-up, one extra spin-up revolution, at most two per solve and six per run. Anything still above tolerance is reported per item ("exposure not periodic: residual x %") and never hidden. Expected offenders: slowly filling basins, wandering rivulets on plastics, a stalled arm (which is steady, not periodic, and passes trivially).

The spread between the sampled revolutions of f_film and of the 8 Pa shear duty is stored per cell (field `spread` below). In developer mode the soil integration is repeated twice with records perturbed by plus and minus that spread, which gives a per-item sigma_r of the residual, as the benchmark dossier asks (benchmark §5.5), for about 190 s extra on the largest load.

### 7.4 Exposure record (exact layout)

One 64-byte record per soil cell per film solve. All duties are fractions of the period in units of 2^-16 (27 µs at 1.8 s). Log-coded fields store `round(4096 log2(x/x_0))` in a u16.

| Offset | Field | Type | Meaning |
|---|---|---|---|
| 0 | E_tau[10] | 10 x u16 | duty with wall shear above 0.5 x 2^m Pa, m = 0..9 (0.5 to 256 Pa): stamps, film and droplet pulses combined |
| 20 | E_M[6] | 6 x u16 | duty with film momentum flux per width above 0.1 x 10^(m/2) N/m, m = 0..5 (0.1 to 31.6 N/m) |
| 32 | tau_peak | u16 log, x_0 = 0.01 Pa | largest wall shear in the period |
| 34 | M_peak | u16 log, x_0 = 1e-3 N/m | largest momentum flux |
| 36 | p_peak | u16 log, x_0 = 1 Pa | largest wall pressure |
| 38 | n_hit | u8 | direct-impingement events per period (upward crossings of 8 Pa) |
| 39 | rest_max | u8 | longest interval between events, period/256 |
| 40 | hit_dwell | u16 | mean event dwell, 10 µs |
| 42 | f_film | u16 | fraction of the period film-wet (analytic zone included) |
| 44 | f_bead, f_pool | 2 x u8 | fraction bead-wet; fraction submerged or in a filled gap |
| 46 | h_mean | u16 | mean film thickness while wet, 0.1 µm |
| 48 | u_mean | u16 | mean film speed while wet, mm/s |
| 50 | J_sup | u16 log, x_0 = 1e-6 kg m⁻² s⁻¹ | liquid renewal flux (deposition plus film inflow) |
| 52 | eps_T | u8 | thermal effectiveness (T_f - T_wall)/(T_liquor - T_wall), /255 |
| 53 | src_split | u8 | 2 bits each: share of J_sup from direct jet, airborne droplets, drips, film inflow |
| 54 | dry_max | u16 | longest dry interval, ms |
| 56 | c_fresh | u8 | flux-weighted fraction of liquor that came directly from the sump (not run-off from other soiled cells) |
| 57 | spread | u8 | revolution-to-revolution relative spread, log-coded |
| 58 | tau_dir | u16 | direction (8 bits) and coherence (8 bits) of the mean shear in the macro frame, for viscous shifting of fats |
| 60 | tau_f95 | u16 log | 95th percentile of film shear outside events |
| 62 | reserved | u16 | |

Water cells that carry no soil get a 16-byte record: f_film, f_bead, f_pool, h_mean, u_mean, J_sup, tau_f95, eps_T, dry_max. Records are accumulated in 32-bit integer counters (about 120 bytes per soil cell while a solve runs) and packed at its end. The first row is the numerics dossier's exceedance curve (numerics §4.2) at 10 levels; the event fields are what the soils dossier asks for ("peak values and frequencies, not window means", soils §9); the film fields are those of films §12.9.

### 7.5 Advancing the soil over the whole programme

Let s be the soil state of a cell, c(t) the slow environment (liquor temperature and composition, wall temperature, pool levels) and R(t) the exposure record in force. The homogenised problem is

```
ds/dt = F_bar(s, c(t), R(t))
R(t) = (1 - w) R[sigma(t), k] + w R[sigma(t), k+1] ,   w = clamp( (ln nu(T(t)) - ln nu_k)/(ln nu_k+1 - ln nu_k), 0, 1 )
```

where sigma(t) is the diverter state from the programme, and k, k+1 are the solve points of the same liquor class that bracket the current time (outside a bracket the nearer record is used, with thickness and gravity-film shear scaled by nu^(1/3), numerics §4.5). The diverter alternation (60 s) and the spray pauses are resolved in soil time; only the arm revolution is averaged. F_bar is the soils dossier's step (soils §7.5, R2) written on duties:

```
f_wet = f_film + f_bead + f_pool
hydration:         top flux = min( D_w (beta_max - beta_N)/(h_N/2), J_sup ) while wet                              (E2)
reaction-erosion:  dE_r/dt = (u_r + u_OH) f_wet + (u_s - u_r) E_tau(tau*) ,  tau* = 10 Pa [VERIFIED], u_s/u_r = 4       (E6b)
cohesive:          tau_load = tau_peak if n_hit > 0, else tau_f95 ; strip all layers above the lowest interface
                   with tau_coh < C_coh tau_load                                                                 (E6c)
adhesive:          if tau_ad < C_ad tau_load: c <- c (1 - p_det)                                                    (E6d)
peeling:           dc/dt = -(L_edge/A_e) k' integral from M_Y to M_peak of E_M(m) dm                              (E6e)
solubles:          dm/dt = -k_L (c_sat - c_bulk) f_wet ,  k_L = 0.538 (D^2 tau_mean/(mu x))^(1/3)                   (E6a; films §9.4)
stains, fat:       first-order in f_wet with the chemistry rate functions; liquid fat shifted along tau_dir         (E6f, g)
```

`E_tau(tau*)` and the peel integral are interpolated log-linearly between stored thresholds. Averaging error is O(epsilon) with epsilon = period / soil time = 7e-4 to 7e-3 (numerics §4.1, §4.3 [ESTIMATED]). The numerics dossier's "level 2" micro-solve (resolve the hit sequence inside a revolution) is kept only as a developer audit on a 1 % sample of cells, because the soil law as specified is a function of duties and peaks, and the audit is how we will find out if that stops being true (for example if the rest interval between hits, which the record carries, proves to matter).

**Predictor-corrector between solve points.** A solve at P_k+1 needs the soil state at that time (contact angles on soiled cells depend on coverage and on whether the soil is fat, dry or hydrated), and the soil integration over [P_k, P_k+1] needs the record of P_k+1. So:

```
1. predictor: integrate soil, chemistry and wall temperature from t_k to t_k+1 with R[., k] alone
2. run the film solves of P_k+1 with the predicted soil state, pool levels and temperatures
3. corrector: restore the state at t_k and integrate again with the bracketed R(t)
4. report d_k = || residual mass (predictor) - residual mass (corrector) ||_1 / initial mass
```

Soil is cheap enough to do twice (section 8.5). d_k is a direct measure of how much the slow feedback matters and is a developer diagnostic.

**Slow drifts.**

| Drift | Treatment |
|---|---|
| Temperature and viscosity | two main-wash points; log-viscosity interpolation; chemistry rates use the actual T(t) from the thermal model |
| Soil removal changing wetting | contact angles at each solve from the soil state at that time (predictor-corrector above) |
| Pools filling | basins are slow states: `dV_b/dt = Q_in,b - Q_out`, Q_in,b measured per revolution in the solve. A basin whose fill time V_b/Q_in,b from the first spin-up revolution is under 120 s is set full for the solve (the periodic state has it overflowing); slower basins carry their level between points |
| Liquor composition | 25-state ODE on the CPU at 1 s (chemistry §10.1); cells with renewal rate above 0.1 s⁻¹ take the liquor's composition, the rest relax exactly: `c_e <- c_liq + (c_e - c_liq) exp(-q_e dt/delta_e)` (chemistry §10.13) |
| Pump speed within a class (2600 against 2800 rpm) | scaling of the record: shear by V^1.5, flux by Q |
| Items moved by jets | geometry change: affected solves are redone from that programme time (section 9) |

### 7.6 Pauses, drains and retained water

Spray pauses (10 s in every 60 s of the ECO hold): shear zero, no renewal; cells on materials with receding angle at most 10° stay film-wet (a Jeffreys film of 20 µm or more survives 10 s, films §8.1), others keep only their bead and pool fractions.

After the last spray the full film and parcel solver runs 4 s without jets, so that pulses, cascades and the last drips play out. Then a quasi-static stage with large implicit steps takes over for the drain and drying phases: lubrication-limit drainage (which reproduces Jeffreys), dewetting to beads at the receding-angle speeds of films §5.5, drip sites keeping their last drop, bridges and gaps keeping their content, pools keeping theirs, evaporation and condensation from the drying model (chemistry §10.11). Output per item: retained water split into film, beads, edge drops, bridges and gaps, and pools, in grams and as a per-cell map. The same stage after each intermediate drain gives the load's share of carry-over, which goes back to the liquor model (chemistry §10.2). Validation target: total carry-over 0.3 to 0.5 L for a normal load [VERIFIED] (chemistry §10.2).

---

## 8. Soil, chemistry and thermal coupling

### 8.1 Per-cell soil state and update

The soil cell is the water cell on every soilable face. State, 64 bytes: class and flags (u16), covered fraction c (u16), bond integrity X_ad (u16), erosion carry-over E_r (f16), cumulative wet time (f16), liquid-fat film h_o (f16), stain fraction S (u8), attached particles (u8), bake index (u8), layer count (u8), speck intensity lambda (f16), then 12 layers of (dry mass, water mass) as f16 pairs. This is the soils dossier's data model (soils R1): 12 geometrically graded layers (ratio 1.3) for soils thicker than 20 µm dry, one layer otherwise [VERIFIED guidance on layer count]. The update is soils R2 with the homogenised loads of section 7.5: implicit (backward Euler, one tridiagonal solve) hydration, then weakening, strengths and the removal rules in the dossier's order. Parameters per soil class are the tables of soils §8 with their confidence grades. Removed mass by class, released fat, detached particles and water uptake are summed per step with integer fixed-point atomics and handed to the liquor model.

Soil step: 1 s by default, 2 s during long holds; fixed per programme step in advance. All rate functions of temperature, pH and enzyme level are tabulated on the CPU once per macro step and sampled on the GPU, so no transcendental sits in a feedback loop (numerics §6.2).

Sub-cell detail for the inspector: c is the covered fraction of the cell; loading heterogeneity is a seeded log-normal multiplier per cell with coefficient of variation 0.3 [ESTIMATED] (soils §7.7); the output adds phi_e, the fraction of the cell above the visibility threshold, as the standards dossier defines it (standards §10.2).

### 8.2 Chemistry

The liquor model is the chemistry dossier's (chemistry §10.1 to §10.8): dose release driven by the wetting flux at the tablet's rest position (which this design supplies as J_sup of the cells under the tablet), carbonate and hardness equilibrium for pH, bleach and enzyme species with thermal and oxidative decay, soil classes in the liquor, filter capture, foam. Each macro step it hands every cell the vector Xi (T_f, pH, enzyme activities, oxidant, surfactant, hardness, suspended load), which is the liquor's for well-renewed cells and the cell's own relaxed composition for slowly renewed cells, pools and gaps. That single mechanism gives detergent residue in spray shadows, dirty pooled water and poor rinsing (chemistry §10.2).

The soils and chemistry dossiers give two parameter sets for the same protein kinetics (Hill exponent 3 with K = 0.049 g/L and 3e-5 kg m⁻² s⁻¹, against exponent 2 with K = 0.05 and 3.7e-5; lag 9 min against 300 s scaled by thickness squared). They are within each other's stated ranges. The interface carries one set: per-soil constants from the soils tables, liquor-side multipliers f_T (with the denaturation roll-off), f_pH and f_E from chemistry §10.6, with the Hill exponent a calibration parameter defaulting to the soils value fitted to in-machine data.

### 8.3 Thermal

Machine level: the three-node model of the machine dossier with heater control. Load level: wall nodes per macro (one for metals, three for ceramic, glass and plastic), stepped implicitly every 4 s:

```
C'' dT_wall/dt = f_wet alpha_fw eps_T (T_liquor - T_wall) + (1 - f_wet) h_a (T_air - T_wall) - j_evap h_fg
```

with alpha_fw from the record's h_mean (section 6.1), h_a = 30 W m⁻² K⁻¹ during circulation including condensation (chemistry §10.10 [ESTIMATED]), and material data from films §9.2 [RECALLED]. The sum of the first term over all macros is the load's heat draw on the liquor. Soil temperature is the wall surface temperature (soils E1). This is what makes a cold, shadowed corner keep its fat solid (chemistry §4.4).

### 8.4 Redeposition and carry-over

Dissolved and dispersed soil follows the film composition. Particles are carried as two liquor classes (fines 20 to 150 µm, grit 150 to 1000 µm; chemistry §10.1) and as a per-cell speck intensity lambda (specks per mm²). While spraying, each cell captures arriving particles at

```
d(lambda)/dt = n_k (J_sup/rho) eta_cap,k ,   eta_cap,k = clamp(1 - h_mean/delta_strand,k, 0, 1) max(n . z_hat, 0.1) (1 - E_tau(1 Pa)/f_wet)
```

with n_k the number concentration in the liquid reaching the cell, delta_strand = 100 µm and 400 µm (chemistry §10.9 [ESTIMATED]); pools and filled gaps capture by settling; at each drain the chemistry dossier's end-of-phase bookkeeping (chemistry §10.9) deposits what the remaining film, drops and pools contain. The capture law is my construction from the dossier's two thicknesses [B-EST] and is the least supported closure in this section. Specks are not individual objects: the inspector draws their number from a Poisson distribution with mean `sum of lambda_e a_e` using the run's seed (standards §10.5). Carry-over between phases is the ledger's count of water left on the load, in pools and in the sump residue, with its composition.

### 8.5 Cost

Largest case: 3.1 M soil cells, 4560 steps for ECO 50 (47 min at 1 s plus 58 min at 2 s), run 1.6 times (predictor on the main-wash intervals plus corrector) = 2.2e10 cell-steps. Each cell-step reads and writes about 150 bytes, so memory bandwidth alone would allow about 600 M/s; with a 12-layer tridiagonal solve and table look-ups I plan 150 M/s (derating 4) [B-EST]: **150 s** for the largest load, 75 s nominal. Wall nodes: 2.5 M macros x 3 x 1575 steps, about 15 s. Chemistry: negligible.

---

## 9. Rigid-body coupling during the wash

**Screening at load time** (items §4.6): `Pi_J,max = c_turn J_max / W`, with J_max the largest single-nozzle momentum flux of the machine at its highest pump speed and c_turn = 2 for any item with a concave face a jet can enter. Items below 0.25 [ESTIMATED] are frozen. The rest are jet-mobile candidates: plastics, lids, light glasses and cups, loose cutlery lying flat. They stay in the rigid-body engine as sleeping bodies.

**Forces.** From the footprint table, before any film solve, each candidate gets a wrench series over one period (256 samples, world frame, about its centre of mass):

```
per footprint:   F_n = rho Q_hit V sin(phi) along -n_w at O ;   F_t = c_t rho Q_hit V cos(phi) along e_t ,  c_t = 0.2   [ESTIMATED] (jets §11.2 step 5f)
exit correction: minus the momentum flux of sheets and splatter leaving the item from that footprint (this is what turns J into up to 2 J
                 for a jet captured by a concave interior; items §4.3), bounded so that |F| stays within [1, 2] rho Q_hit V
droplets:        mean impulse rate of parcels landing on the item (from the previous solve, if any)
gravity:         weight of film, beads, pools and bridges on the item, at their centroid; buoyancy for items sitting in a pool
```

**When the engine is invoked.** (i) At the first occurrence of each hydraulic state; (ii) after any geometry change; (iii) at each solve point if the water mass on a candidate changed by more than 10 % of its own mass. Each invocation is one call:

```ts
interface RigidBodyCoupling {
  candidates(): ItemId[];
  // Apply periodic wrenches for up to maxPeriods; stop early when all bodies are at rest between periods.
  runEpisode(req: {
    state: HydraulicStateId; period_s: number; maxPeriods: number;           // default 8
    wrenches: { item: ItemId; samples: Float32Array /* 256 x 6 */; addedMass_kg: number; addedCom: Vec3 }[];
    arms: { arm: ArmId; stallTorque_Nm: number; brake_Nm_s: number; friction_Nm: number; viscous_Nm_s: number; inertia_kg_m2: number }[];  // torque law of section 4
    friction: 'wash';                                                         // items §11 wash-state table
  }): Promise<{
    moved: { item: ItemId; pose: Pose; maxDisp_mm: number; maxRot_deg: number; events: RbEvent[] }[];
    arms: { arm: ArmId; phaseLaw: Float32Array /* phi(t), 256 samples */; meanOmega: number; stalledAt_rad: number | null }[];
    settled: boolean;
  }>;
}
```

The engine integrates at its own 1 ms step (items §13). If any pose changes by more than 2 mm or 2° (items §4.6), the instance transform is updated, the top-level BVH and the links of the affected instances are rebuilt, basins and drip sites of those instances are re-derived for the new gravity direction, the footprint table is re-traced, and the episode is repeated with the new wrenches, at most three times per state. An item that still moves after three episodes is reported as "unsettled" and frozen in its last pose; this is an honest approximation of a rattling item. Events carry a programme time (the first second of the state in which they occurred) for the report: "lid L3 left the upper rack and came to rest on the lower arm".

**Consequences that need no extra code.** A flipped container has a new basin, fills at the rate the rain delivers, gains weight, stops moving, shadows what is below and keeps its liquor through the drains (items §4.5). An item that fell onto the floor may sit in the lower arm's path.

**Arm blocking and stall.** The arms are one-degree-of-freedom bodies in the episode with the torque-speed law of section 4. The engine returns the phase law. Three cases: free (uniform rotation); knocking (non-uniform phi(t): phase samples are weighted by dwell and the item receives impulses each period); stalled (omega = 0 at a fixed angle: the jets become stationary, the stamps are those of static jets, and the film solve converges to a steady state). A stalled lower arm in state L thus cleans a set of spots and stripes and starves everything else, as standards P06 requires, with no special rule.

**Exposure after a move.** Solves already done for programme times before the event stay valid. Solves at later points use the new geometry. If the event happens at a state first seen after P1 (rare: a pump-speed change), the soil integration from that time uses re-solved records for the affected state.

---

## 10. Determinism and reproducibility

Rules (each maps to a threat listed in numerics §6.2 and to a measured property of the spikes):

1. **Fixed work.** Mesh levels, phase counts, parcel counts, revolutions and soil steps are functions of the inputs and the tier only. The two data-dependent controls (level assignment for local time stepping; the bounded extension rule of 7.3) depend on simulated quantities and nothing else. No wall-clock, thermal state or frame rate enters any decision. Thermal state is logged, not acted on.
2. **Integer time.** Programme time is an integer count of soil steps; time inside a solve is (revolution, super-step, sub-step). Arm phase is the super-step index. No f32 time accumulates (numerics §6.3).
3. **Order-independent accumulation.** Every many-to-one write (parcel deposition, ring sources, level-interface transfers, exposure counters, removed-soil totals, monitors) is an atomicAdd or atomicMax on 32-bit integers in fixed point [MEASURED: bitwise identical regardless of order; the float compare-exchange variant is not and is banned]. One-to-one writes are plain float stencil updates [MEASURED: bitwise identical across runs, workgroup sizes, batching, devices and processes].
4. **Pairwise identical fluxes.** An edge transfer is one function of (lower-index cell state, higher-index cell state); both cells call it with the same arguments in the same order.
5. **Random numbers.** Counter-based: `pcg(seed, stream, entity, index, sub-index)`. Streams: jet sub-ray jitter, splatter and splash sampling, break-up location, contact-angle field, soil heterogeneity, speck draw. Entities are stable ids (asset, macro, child; nozzle; footprint). No generator state exists, so results do not depend on dispatch order. Tiers use nested samples of the same streams (section 11.3).
6. **Transcendentals out of feedback.** exp, pow and log appear in tables built on the CPU in f64 with a pinned math implementation; shaders interpolate. The closures of section 5.4 use sqrt and rational powers through tables in Re_eq.
7. **CPU side.** f64, no fast-math, fixed partitioning of work across workers, reductions in index order, stable sorts. BVH construction is deterministic (ties broken by primitive id).
8. **Provenance.** Every result carries the hash of geometry and poses, all parameters, tier, seed, shader source hash, Dawn version, OS build and GPU identity (numerics §6.5). Bit-identical results are promised for that tuple only. GPU and strict-IEEE CPU results differ in the last bits [MEASURED], so CPU reference kernels are compared within tolerance, never bitwise. The runtime is pinned at Node 20 with `webgpu@0.3.0` (the only Dawn build that loads on the target OS); headless Chrome ran the same WGSL bit-identically in the spike and is the fallback, with its own provenance tuple.
9. **Open hazard.** Whether Dawn on Metal compiles with fast-math disabled is unverified (numerics §6.2); the measured run-to-run identity suggests it does not matter on one stack, but it must be pinned.

Precision hazards and remedies: cell mass as i32 quanta (no drift, no cancellation); positions in item-local coordinates inside bottom-level BVHs (numerics §6.3); f16 only for bounded intensive quantities (temperature offset, fractions, soil layer masses relative to a per-class scale); exposure duties as integers; stiff friction implicit; thin-film freeze below 1.4 µm is intended and handed to the bead and drying logic; the potential of a lake uses the per-child displacement so that a level pool does not creep.

Cross-machine reproducibility is statistical, not bitwise. The acceptance tests are the benchmark dossier's (benchmark §4.5): `repro-5` bit-identical on the reference machine; `cross-device` clean-flag agreement of at least 99 % on a second GPU family.

---

## 11. Compute budget

### 11.1 Planning throughputs and derating

| Kernel | Measured stand-in | Derating | Planning rate | Why |
|---|---|---|---|---|
| Film cell-update (one flux-and-update pass) | indexed stencil, Morton order: 1.55 to 1.61 G/s quiet, planning rate 1.4 G/s at 80 B per update | 3.1 | **0.45 G cell-updates/s** | 90 to 110 B per update (24 B hot state and 16 B pending in, 24 B out, 22 B static, exposure counters while sampling) puts the bandwidth bound near 1.1 G/s; about five times the benchmark's 130 flops (three HLL fluxes with reconstruction, friction, contact line), branches and many small dispatches take the rest. The spike found extra arithmetic free at stencil scale; I do not assume that holds at 600 flops per cell |
| Parcel segment query | 190 to 360 M/s short segments, 100 M/s incoherent, on 1 M triangles | 2.5 on the short-segment figure | **75 M/s** | two-level BVH with moving instances, 2.5 M triangles, drag integration and hit processing |
| Primary jet rays | 290 to 365 M/s coherent | 2 | 150 M/s | same; irrelevant to the total |
| Stamp (footprint segment, cell) pair | particle scatter 33 to 120 M particle-steps/s | by analogy | 75 M pairs/s | about 20 integer counters touched per pair [B-EST] |
| Soil cell-step (12 layers, implicit) | none; bandwidth allows about 600 M/s at 150 B | 4 | 150 M/s | tridiagonal solve, table look-ups [B-EST] |
| Sustained load | no decline over two 7-minute stencil runs and a 15-minute particle soak; shared-machine mean 91 to 95 % of quiet | | **divide all times by 0.93** | the spike's planning rates already allow for a shared machine, so this is extra caution: a 30-minute run is unmeasured |

Per-block level bookkeeping is done with an atomicMax inside the film kernel and a compaction over blocks (about 0.3 M), so it does not add a pass over cells.

The film work is `cells x updates per cell per simulated second x simulated seconds`. The middle factor is my estimate of the duty cycle [B-EST]: on W1 a cell on the sprayed rack spends about 60 % of the time as a thin draining film (2 ms steps), 15 % in a pulse at 1 ms, 5 % at 0.5 ms and 1 % in ring run-off at 0.25 ms, giving about 590 updates per second; on the other rack about 400; average 500. W0 is half that (250), W2 about 550 because most of it is dry or beaded most of the time. Block granularity adds a factor 1.4. Result: 4.2 G cell-updates per simulated second for the nominal load, 5.4 G for the largest (`budget.py`). This estimate is the largest uncertainty in the table, about a factor 2 either way.

### 11.2 Official tier, ECO 50

| Stage | Content | Work (largest load) | Rate | Seconds, nominal | Seconds, largest |
|---|---|---|---|---|---|
| A | Set-up: load cached assets, instantiate forest, top-level BVH, links (8.5 M rays), basins and drip sites, contact-angle field, upload 2.3 GB, about 40 pipelines | | | 30 | 40 |
| B | Hydraulics, programme sequencing, liquor chemistry (CPU) | | | 2 | 2 |
| C | Footprint tables (4 states, re-traced up to 3 times) and swept stamps for 8 solves | 0.03e9 queries; 1.0e9 pairs | 150 M/s; 75 M/s | 15 | 15 |
| D | Rigid-body episodes (CPU, WASM) | about 20 candidates, up to 3 episodes per state | | 15 | 20 |
| E1 | Film kernel, 8 solves plus drain-down, 56.6 simulated s | 3.1e11 cell-updates | 0.45 G/s | 528 | 683 |
| E2 | Level assignment, block lists, reservoirs, monitors | | | 30 | 40 |
| E3 | Parcels: about 0.75 M live, stepped every 8 ms | 5.3e9 segment queries | 75 M/s | 71 | 71 |
| E4 | Exposure packing and read-back | 8 x 0.3 GB | 10 GB/s | 5 | 5 |
| F1 | Soil over the programme, predictor and corrector | 2.2e10 cell-steps | 150 M/s | 75 | 150 |
| F2 | Wall temperatures, pools, redeposition | 1.2e10 node-steps | | 20 | 25 |
| G | Quasi-static drains, drying, outputs | | | 15 | 20 |
| H | Checkpoints at stage boundaries, progress stream, report | | | 30 | 30 |
| | **Sum** | | | **836** | **1101** |
| | **Divided by 0.93 (sustained load)** | | | **899 (15 min)** | **1184 (19.7 min)** |
| | of which GPU kernel time (C, E, F, G), same divisor | | | 816 (13.6 min) | 1085 (18.1 min) |
| | GPU kernel allowance from the spike report | | | 1200 | 1200 |
| | Worst case of the extension rule (6 extra revolutions) | | | | 1340 |
| | Cap | | | 1800 | 1800 |

Shares for the largest load: film and parcels 72 %, soil 14 %, set-up and I/O 6 %, jets and stamps 1.4 %, the rest 7 %.

**Margin and what it is for.** Against the 1800 s cap: 616 s (34 %) on the largest load, 901 s (50 %) on the nominal one. Against the spike report's allowance of 20 minutes of GPU kernel time: 10 % on the largest load and 32 % on the nominal one. In terms of the one number that matters, the film stage may cost up to 1.16 times its estimate on the largest load (1.68 times on the nominal load) before GPU time passes 20 minutes, and up to 1.8 times before the run passes 30 minutes. Since the estimate is uncertain by about 2, the honest reading is: the nominal load is safe; the largest load is safe against the cap but has little slack against the GPU allowance, and the first downgrade below should be expected for loads above about 7.5 m² unless prototype 1 comes in under the estimate. Decisions after prototype 1, in order:

- if the film stage measures clearly below the estimate (0.75 times or less on the largest load): (1) a third main-wash solve point, about +150 s; (2) second-order film (MUSCL, two-stage SSP) on W2 and on the W1 cells of partially wetting materials, where numerical diffusion matters most: these carry about 37 % of the updates, so about +250 s. Second order everywhere would add about 90 % of E1 and needs the kernel to measure above about 0.75 G/s; W1 on all item faces is a later option of similar cost;
- if it measures above: (1) W2 cap from 0.40 to 0.20 m²; (2) one sampled revolution instead of two at P2; (3) U_h from 1.5 to 0.75 m/s, close to the jump, which removes the fastest time level on every water class.

Whatever is chosen becomes part of the tier definition and is fixed before any scored run.

Longer programmes do not cost more film time (the number of solve points is set by liquor classes, not duration); they cost soil time: INTENSIVE 70 adds one pre-wash point (about +150 s on the largest load) and about 30 % more soil steps; it still fits under the cap with about 20 % margin.

### 11.3 Tiers

| | Preview (T0) | Fast (T1) | Official (T2) |
|---|---|---|---|
| Purpose | instant feedback in developer tools | level design, reference search, regression | scoring |
| Geometry, BVH, footprint tracing | identical | identical | identical |
| Phases x sub-rays | 512 x 7 | 1024 x 7 | 2048 x 19 |
| Stamps | on soil cells (1.5 mm) | on soil cells | on soil cells |
| Film | none: steady routing of deposited water down the cell graph | W0 (3 mm) on all item faces, soil cells are its 1:4 children; 4 solves (main wash L, U at 2 + 1; final rinse L, U at 1 + 1) | W0, W1, W2; 8 solves |
| Parcels per footprint sample | analytic splatter kernel | 16 | 64 |
| Soil | reduced kinetics (soils §8.4), 10 s steps | 6 layers, 4 s steps, no corrector | 12 layers, 1 to 2 s, predictor-corrector |
| Time, nominal / largest | about 15 s | 138 / 176 s | 899 / 1184 s |

**How the fast tier is kept consistent with the official one.** A strict guarantee of identical ranking is impossible for any two resolutions of a thresholded model; what can be done is to make their errors common, measure the agreement, and refuse to trust the fast tier near the threshold.

1. *Shared by construction.* Same macro mesh and BVH, so shadowing is bit-identical. Same soil cells, soil model, chemistry and thermal model. Direct-jet stamps are evaluated on the same soil cells in every tier; they differ only by phase and sub-ray count.
2. *Nested sampling with common random numbers.* Fast-tier phases are every second official phase; fast sub-rays are a subset of the official 19; fast parcels are the first 16 of the official 64 per sample; the contact-angle field and soil heterogeneity are generated at the finest level and restricted. Tier differences are therefore refinements of one realisation, not new realisations.
3. *Release gate.* On a standing set of at least 200 load pairs (the A/B pairs of the standards checklist plus random perturbations of reference loads), per MAJOR version: Kendall tau of level scores between T1 and T2 at least 0.9; per-item clean-flag agreement at least 95 % among items whose official residual is outside the dead band; no A/B pair with opposite sign.
4. *Dead band.* Every tier reports per item the margin `|r - theta_c|` in units of its tier-to-tier discrepancy sigma_T (estimated on the standing set). Fast-tier tools must show items with margin below 2 sigma_T as "undecided", and level acceptance (reference load not on the threshold, benchmark §5.7) is always confirmed with T2.

Only T2 results are ever scored.

---

## 12. Module decomposition

Fifteen modules. Each has a pure-data interface, a TypeScript f64 reference implementation of its kernels (for tolerance tests), and can be unit-tested with synthetic inputs from its neighbours. GPU modules never share buffers implicitly; every buffer has one owner and a documented layout. No kernel binds more than 9 storage buffers in at most 3 bind groups (the limits are 10 per stage and 4 groups): the film kernel, the heaviest, binds `wHot` source and destination, `wPend`, `wNbr`, `wAux`, `macro`, `blockList`, `blockLevel` and `sAcc` as storage buffers, with instance data and tables in uniform buffers. Device limits are requested from the adapter at start-up and every binding is asserted to be under 4 GiB.

### 12.1 Shared data

```ts
type Quanta = number;           // integer count of 1e-13 kg (cells, reservoirs) ; parcels and totals use 1e-10 kg (exact multiple)
interface MachineSpec { tub; racks; arms: ArmSpec[]; nozzles: NozzleSpec[]; pump; branches; diverter; filters; heater; programme: Step[]; detergent }
interface LoadedItem { instance: number; asset: AssetId; pose: Pose; material: MaterialId; soils: { region: RegionId; soilClass; loading_kg_m2; age; heatHistory }[] }
interface WashInput { machine: MachineSpec; items: LoadedItem[]; seed: bigint; tier: 'T0' | 'T1' | 'T2' }
```

GPU buffers (owner in brackets):

| Buffer | Stride | Content |
|---|---|---|
| `macro` [geom] | 96 B per macro, per asset | origin (3 f32); frame t_1, n (oct-encoded, 2 x 2 x i16); 2-D vertices x_1, x_2, y_2 (3 f32); 3 vertex normals (oct, 12 B); 3 vertex curvatures and thickness (4 x f16); 3 hinge rotations (cos, sin as i16, 12 B); 3 neighbour macros with shared-edge code (3 x u32); cell offsets for water and soil (2 x u32); levels, material, region, feature tag, opposite-face partner (3 x u32) |
| `instance` [geom] | 64 B | 3 x 4 transform, gravity in local frame, asset and offset ids |
| `blasNodes`, `blasTris`, `tlas` [bvh] | 32 B, 48 B, 32 B | as in the BVH spike |
| `wHot[2]` [film] | 24 B per water cell | mass i32; q_1, q_2 f32; T offset, fresh fraction, soil scalar, bead store (4 x f16); flags u16; contact-angle offset i8, spare |
| `wPend` [film] | 16 B | atomic i32: mass, momentum x 2, enthalpy |
| `wNbr` [geom] | 12 B | 3 x u32 neighbour cell, top 3 bits: same macro, hinge, 2:1 fine, 2:1 coarse, crease, link, boundary |
| `wAux` [geom] | 4 B | child displacement f16; block id low bits |
| `blockLevel`, `blockList[k]` [film] | 4 B | atomicMax level request; compacted lists |
| `reservoir`, `resCsr` [reservoirs] | 32 B | kind, mass, T, scalars, capacity or level table index; member and target cells |
| `parcel` [parcels] | 48 B | position, velocity (6 f32); mass i32 (1e-10 kg); diameter, T (f16); composition (2 x f16); source kind, stream, live flag (u32); spare |
| `footprint` [jets] | 64 B per (state, nozzle, phase, surface) | hit cell, S (3 f32), n_w and e_t (oct), phi, Q_hit, V, d, v_s (2 f32), arrival phase, f_c, xi |
| `sAcc` [exposure] | about 120 B per soil cell | u32 counters and maxima during a solve |
| `sRec[2]`, `wRec[2]` [exposure] | 64 B, 16 B | packed records of the two bracketing solve points (layout in 7.4) |
| `sSoil` [soil] | 64 B | layout in 8.1 |
| `tables` [chem, jets] | | rate tables, closure tables in Re_eq, level tables of basins |

### 12.2 Modules and interfaces

```ts
// M1 geom/assets (offline + set-up).  Tests: watertightness, quality gate, chord error, area sums.
interface AssetBuilder { build(def: ParametricItem | ImportedMesh, opts): Asset }           // macro mesh, regions, creases, BLAS
interface Forest {
  instantiate(items: LoadedItem[], rules: LevelRules): ForestLayout;       // offsets, levels, neighbour table, blocks
  cellOf(instance, macro, u, v, role: 'water' | 'soil'): number;           // the formula of 3.4 ; bit-exact with WGSL
  links(bvh: Bvh): LinkSet;  basins(instance): Basin[];  dripSites(instance): DripSite[];   // pose-dependent
}

// M2 bvh.  Tests: zero disagreement with brute force and with the TS reference.
interface Bvh { buildTlas(instances: InstanceXf[]): void;  segments(batch: GPUBuffer, n: number): GPUBuffer /* hit records */ }

// M3 machine (CPU).  Tests: operating-point and arm-speed tables of machine §3.3, §4.3.
interface MachineModel {
  state(t: ProgrammeTime): HydraulicState;                                 // diverter, N, per-nozzle Q, V, d; arm omega or phase law
  inventory(ledger: LedgerTotals): { V_sump: number; alpha: number; f_H: number };
  thermal(dt, heatToLoad_W): { T_liquor: number; T_air: number; T_tub: number };
}

// M4 jets/tracer.  Tests: kinematics against jets §2.6; Pérez-Mohedano impact-time table.
interface JetTracer { footprintTable(state: HydraulicState, bvh: Bvh, rainGrid?: GPUBuffer): FootprintTable }

// M5 jets/stamps.  Tests: J2-8 profile; flow-split table; force integral; exposure-per-pass table of jets §4.9.
interface Stamper {
  stamp(table: FootprintTable, liquor: LiquorProps, residualFilm: GPUBuffer, acc: ExposureAccumulators): void;
  ringSources(table: FootprintTable, superStep: number): RingSourceBatch;  // masks and edge fluxes for the film solver
  wrenches(table: FootprintTable, items: ItemId[]): Map<ItemId, Float32Array>;
}

// M6 parcels.  Tests: drag and terminal velocity; regime thresholds of jets §6.2; integer mass conservation.
interface ParcelSystem { emit(batch: EmissionBatch): void;  step(dt_steps: number, film: FilmView): DepositStats }

// M7 film.  Tests: section 13.1 film rows.
interface FilmSolver {
  configure(liquor: LiquorProps, wallT: GPUBuffer, soilAngles: GPUBuffer): void;
  superStep(s: number, rings: RingSourceBatch): void;                      // runs all due sub-steps
  view(): FilmView;                                                        // read-only thickness, wet flags for jets and parcels
}

// M8 reservoirs.  Tests: basin volumes; drip spacing and drop mass; bridge and gap capacity.
interface Reservoirs { step(film: FilmView): EmissionBatch;  totals(): LedgerTotals }

// M9 exposure.  Tests: packing round-trip; periodic test signal reproduces duties to 1 unit.
interface ExposureStore { begin(solve: SolveId): ExposureAccumulators;  pack(solve: SolveId): RecordSet;  monitors(): MonitorRow }

// M10 soil.  Tests: soils R6 table.
interface SoilSolver { step(dt_s: number, rec: BracketedRecords, w: number, xi: LiquorVector, wallT: GPUBuffer): SoilRelease;  snapshot(): SoilState;  restore(s: SoilState): void }

// M11 chemistry (CPU).  Tests: regression tables of chemistry §10.12.
interface LiquorModel { step(dt_s, release: SoilRelease, events: PhaseEvent[]): LiquorVector;  tables(): RateTables }

// M12 cycle integrator.  Owns the programme timeline, the solve schedule, predictor-corrector and checkpoints.
interface CycleIntegrator { run(input: WashInput, progress: (p: Progress) => void): Promise<WashResult> }

// M13 rigid-body coupling: interface in section 9.
// M14 ledger and report.
interface Ledger { assertClosed(): void;  totals(): LedgerTotals }
interface WashResult {
  items: { instance: number; residual: SoilCellOut[] /* cell, area_mm2, dry mass per class, covered fraction c, visible fraction phi, fat film, stain, specks */;
           retainedWater_g: { film; beads; edgeDrops; bridges; pools }; V_pool_mL: number; moved: boolean; poseDelta?: Pose; events: RbEvent[];
           diag?: { exposure: RecordSet; sigma_r: number; notPeriodic: number } }[];
  machine: { armEvents; starvation_s; filter; energy_kWh; water_L; phaseTemps }; provenance: Provenance;
}
// M15 verify: TS reference kernels, analytic cases, golden files.
```

Parallel build order: M1, M2 and M3 have no dependencies. M4 and M5 need M2 and a flat-plate asset. M7 can be developed on a single flat or bowl-shaped asset with synthetic ring sources and deposits. M6 needs M2 and a stub film view. M10 and M11 need only synthetic records. M12 can run end to end with stubs for everything.

---

## 13. Verification plan

### 13.1 Per-module tests against analytic or published results

| Module | Test | Target and tolerance |
|---|---|---|
| Geometry | Chord error of parametric items against the analytic profile | at most 0.05 mm |
| | Closed manifold, consistent orientation; child areas sum to macro area | exact |
| | Hit-to-cell map and traversal against the TS reference, 10⁶ rays | zero disagreements |
| | Mesh area against analytic area of shells of revolution | 0.2 % |
| Machine | Operating points (machine §4.3) and arm speeds (§3.3): 34.9 kPa, 30.7 L/min, 35 and 30 rpm at 3000 rpm; mid arm stalls at 1400 rpm | 1 % |
| Jets | Geometric impact time and length per revolution on a 250 mm plate, DU750 arm (Pérez-Mohedano Table 5.8, 5e-5 to 0.027 s) with sub-ray count reduced to 1 | 5 % |
| | Direct-impingement duty on the thesis tile: 0.07 % and 1.59 % | factor 1.5 (finite jet width) |
| | J2-8 film profile at 50 °C (jets §4.4 table) | 1 % |
| | Integral of p_w over the footprint equals rho Q V sin(phi); flow-split table (jets §4.7) | 1 % |
| | Exposure per pass at v_s = 1 m/s: 4.3, 4.3, 3.8, 3.1, 1.6, 0.45 Pa s at offsets 0, 2, 5, 10, 20, 30 mm (jets §4.9) | 3 % |
| | Break-up lengths (jets §3.3 table); splatter worked values (§5.2 table) | 1 % |
| Parcels | Terminal velocity and stopping distance with Schiller-Naumann drag; minimum splash speeds (jets §6.2 table) | 2 % |
| Film | Steady film on an incline: Nusselt thickness, velocity, shear | 2 % (films §12.10) |
| | Lake at rest in a tilted bowl on an irregular macro mesh | velocities at rounding level; mass exact |
| | Drainage of a plate: Jeffreys `h = sqrt(mu s/(rho g t))` | 5 % after 2 s |
| | Rivulet-to-film transition on acrylic, water at 43 °C: between 0.125 and 0.21 kg/(m s) at 90°; wetted fraction 0.1 to 0.2 below it (Meredith) | inside the measured window |
| | Same case on three rotated meshes | wetted fraction within 10 % of each other |
| | Jump radius of a 2 mm jet at 0.6 to 4 L/min against eq. (3.17), with the hand-over ring | 15 % |
| | Film under an incline: drips at h = 0.52 l_c, 81° from vertical; none at 0.55 l_c, 60.5° (Brun) | reproduced |
| | Pendant-drop spacing under a horizontal edge: 22 mm for water at 25 °C | 15 % |
| | Puddle height `2 l_c sin(theta/2)`; drop on an incline slides at the Furmidge limit | 10 % |
| | Dewetting speed `sqrt(sigma (1 - cos theta_r)/(rho h))` at theta_r = 60° | 20 % |
| | Local time stepping against a global smallest step | 1 % in wet fraction and mean shear |
| | Flow across a 90° concave crease | momentum magnitude within 2 % |
| Reservoirs | Mug base recess R = 25 mm, 3 mm deep: 5.9 mL; tilted: 1.4, 0.42, 0.13 mL at 7°, 15°, 30° (standards P36, P37) | 5 %; 20 % |
| | Capillary rise in a gap: 34, 13, 7 mm at 0.2, 0.5, 1 mm (standards P40) | 10 % |
| Exposure and cycle | Pulsed-forcing soil ODE with exact solution against the homogenised step | 1 % at epsilon = 5e-3 |
| | Brute-force integration (every revolution resolved) on 1 % of cells | final residual within 2 % |
| Soil | The ten cases of soils R6: egg-yolk swelling (95 % at about 90 min; 0.41, 0.70, 0.45, 0.82 mm), gauge run, in-machine rates 0.85 to 4.66 % per min, starch in channel flow, jet peeling a proportional to t^0.2, baked-soil adhesion decay | as stated per case; 35 % on in-machine curves |
| Chemistry | Timelines of chemistry §10.12 (pH, peracid peak 0.23 mmol/L, enzyme decay) | 5 % |
| System | Film plus airborne hold-up 0.4 to 1.5 L (machine §4.5); carry-over 0.3 to 0.5 L; mean ejection 7.7 m/s; everything wetted within 3 s; direct-jet duty under 10 % almost everywhere (standards P47) | within ranges |

### 13.2 Conservation and determinism checks

Water ledger closed bit-exactly at every phase boundary (every super-step in debug). Soil mass per class: on items plus liquor plus filter plus drain plus deposits within 0.1 %. Energy: heater input equals stored plus lost within 1 %. `repro-5` bit-identical. Shuffle test: parcels and footprints submitted in a permuted order give the same hash. Workgroup-size and batching invariance of every kernel. Implicit-path against explicit-path bit-equality.

### 13.3 The phenomena checklist

E: arises from the general mechanisms with no dedicated rule. C: arises, but its size rests on a weakly supported closure. N: not reproduced.

| ID | How it arises here | |
|---|---|---|
| P01 open side up | no sub-ray can enter; the cavity is a basin that fills from rain; lumped pool keeps its liquor through the drains; V_pool reported | E |
| P02 face turned away, P05 shadow of a large item, P09 lean, P12 alternating plates, P14 face against the wall | exact ray shadowing; the face gets only film and drips; near-wall cells have low J_sup and low c_fresh | E |
| P03 plate pitch | dwell proportional to the gap and reach `z = d tan(rho)` are pure kinematics of the sub-ray bundle | E |
| P04 nesting, P15 nested spoons | no line of sight plus gap links: filled gaps are wet, unsheared and barely exchanged | C (eta_gap) |
| P06 stalled arm | contact torque from the rigid-body engine; omega = 0; static footprints | E |
| P07 radial position, P08 left/right asymmetry | arm kinematics and nozzle angles in the arm frame; corners outside the swept disc | E |
| P10 tall vessel interior | entry window from clipping at the opening; base reached only by near-vertical jets; side walls by ceiling film or its departure | E, sizes C |
| P11 upper against lower rack | flight distance against break-up length; arm flow shares | C (C_b) |
| P13 glass over tines | tines shadow the interior; contact links hold bridges | E |
| P16 heads up or down, P24 easy soils, P28 tea position (negative controls) | nothing in the model privileges these; easy soils leave at first wetting; bleaching needs only wetness, oxidant, temperature | E |
| P17 crowded cells, P18 tray against basket | contacts and gaps from the settled poses; spoon bowls facing up are basins | E |
| P19 overloading | smaller gaps, more shadow, more soil per litre | E |
| P20 soil load, P22 clean neighbours | liquor soil classes, chemistry consumption, filter loading | C |
| P21 redeposition of particulates | speck intensity and Poisson draw | C (capture law) |
| P23 end-of-cycle drips | drip sites keep and release last drops after the final drain; parcels land on lower items | E |
| P25 dispenser blocked | lid sweep test from the rigid-body layer; liquor model runs without the dose | E |
| P26 tablet in a dead spot | dissolution rate driven by J_sup at the tablet's rest cells; local film composition | C |
| P27 time and temperature, P29 ageing | chemistry rate functions; ageing transform of the soil's initial state | C |
| P30 protein: frequency and chemistry, not strength | reaction-erosion with a 10 Pa threshold: depends on the duty above threshold, not on how far above | E |
| P31 starch bimodal, P34 flakes | cohesive and adhesive threshold rules strip whole layers or whole cells; detached flakes join the grit class | C |
| P32 burnt milk on glass, P33 fat and temperature, P35 pot interiors | soil classes with their kinetics; wall temperature per macro keeps fat solid in cold zones; deposition on plastics | C |
| P36 base recess, P37 tilt | basins and spill levels from the pose | E |
| P38 plastic stays wet, P39 pots, P42 cutlery dries | bead store on high-hysteresis materials; stored heat per macro; drainage along thin steel | E, sizes C |
| P40 contact points | links: bridges and gap reservoirs | E |
| P41 light items flipped | wrench series and rigid-body episodes; refill through the new basin | E |
| P43 spots and film on glass | dissolved solids left by retained drops and films are booked per cell; appearance is not predicted | partly N |
| P44, P45 class ranking | outcome of everything above; a calibration target, not a mechanism | C |
| P46 run-to-run spread | seeded: arm start phase, contact-angle field, soil heterogeneity, speck draw, tablet release time; its magnitude is tunable, not predicted | C |
| P47 everything wet within seconds, jets rare | parcels and film in time; stamps give the duty | E |
| P48 detergent does not move jets | jets and fast films use gamma_water; only slow films use the liquor's value | E |

### 13.4 What this design would not reproduce

1. Rivulet meander paths and individual drop positions (statistics only; frozen random field).
2. The structure of the film jump (the 4 to 5 mm rope), roll waves and wave-enhanced shear; the Shkadov form mis-places natural wave onset by 20 % (films §4.1).
3. Flow inside deep pools: sloshing, a jet plunging into a filled bowl, submerged-jet shear on immersed soil. Pools are mixed tanks with zero wall shear.
4. Jet-on-jet and curtain-on-jet interaction beyond a mean-field attenuation; the returning curtain inside a vessel meeting the incoming jet.
5. Air motion in the tub and drift of fine mist; condensation patterns beyond a uniform coefficient.
6. Foam as a fluid; only its effect on the pump.
7. Pump surge dynamics, diverter transients and the joint phase of two arms in state A (duty-cycle and superposition approximations).
8. Films on the rotating arms; arm-internal flow non-uniformity, hydraulic flip, aerated jets.
9. Two-way coupling for thick deposits (berms that deflect the film, jets burrowing or blistering), soil fatigue under repeated loading, interaction of layered soils, transport of loose particles along surfaces (particles exist only as liquor classes and speck intensity).
10. Multi-generation splash, crown details, water hammer.
11. The first one to three minutes of wetting with plain water before the detergent dissolves (main-wash records are used).
12. Rattling: items that move a little every revolution without settling are frozen after three episodes.
13. Visual appearance of spots and filming on glass; glass corrosion; multi-cycle scale.
14. Perforated and porous ware beyond a transmission probability; wicking into wood.
15. Features below the cell size that hold water or soil (gaps between fork tines under 1.5 mm, whisk wires) except through gap links.
16. Item deformation (plastic warping in heat).

---

## 14. Risks, unknowns and first prototypes

| # | Risk | Why it matters | Mitigation |
|---|---|---|---|
| 1 | The film stage costs more than estimated (duty cycle or kernel rate off by more than 1.16 times against the 20-minute GPU allowance, or 1.8 times against the cap, on the largest load) | It is 62 % of the budget and rests on an estimate uncertain by about 2 | Prototype 1; the downgrade ladder of 11.2 |
| 2 | First-order finite volumes on triangles bias wetting: lattice-aligned rivulets, smeared contact lines, beta_cl that will not calibrate | Rank 3 of the error budget | Prototype 3; second-order option; rotate macro meshes per asset |
| 3 | The asset pipeline cannot deliver acute, watertight, 2:1-balanced meshes for nasty parts (1 mm rims, handle roots, fork tines, imported CAD) | Without it there is no substrate | Prototype 2; crease treatment for small radii; skew-corrected fallback for the last 1 % |
| 4 | The hand-over ring misplaces the jump, or masks misbehave when footprints cross creases, each other, or pre-wetted film | Decides where jet water goes next | Prototype 1 includes the static and swept jet cases; switchable to the jets dossier's full-radius analytic zone |
| 5 | Closures for splatter, wires, rims and gaps are estimates with factor 2 to 3 ranges | Rank 2 of the error budget | Not reducible here; each is isolated behind one function with a calibration parameter; offline resolved runs of single events (one jet on one wire or rim, 60 mm domain) can tabulate them later without touching the architecture |
| 6 | Periodic state not reached (large basins, stalled arms, moving items) | Biased records | Slow states taken out of the solve; monitors; bounded extension; explicit report |
| 7 | Rigid-body episodes interact badly with the periodic assumption (rattling, repeated knocks) | Trap levels depend on it | Three-episode cap; arm phase law from the engine; documented approximation |
| 8 | Memory pressure on an 18 GB machine in real use | Swap growth was observed above 4 GB of GPU buffers | 2.3 GB GPU ceiling; records streamed to CPU; one wash at a time |
| 9 | Dawn or Metal fast-math, or a compiler change, breaks bit-reproducibility | Benchmark requirement | Pin the stack; hash every shader; `repro-5` in CI |
| 10 | Too many calibration parameters | Unidentifiable model | Global sensitivity analysis of clean flags to every constant before the test campaign (numerics §8 risk 6); the code exposes them all in one table |

**Prototype 1: "one plate, one cup, one arm" film core (retires risks 1 and 4).** A dinner plate and an inverted mug as SRT assets, the lower arm of SPOT-60, stamps, hand-over ring, film kernel with block local time stepping, drip sites, parcels with deposition only. Measure: cell-updates per second of the real kernel; updates per cell per simulated second by class; Nusselt, Jeffreys, lake-at-rest, jump radius; water ledger. Exit: measured rate and duty cycle replace the estimates in 11.1; jump radius within 15 %.

**Prototype 2: asset pipeline on the hard set (retires risk 3).** Wine glass (1 mm rim, stem), mug with handle, fork, knife, a section of rack with tines and crossings, one imported CAD part. Deliver the forest, BVH and links; report quality-gate statistics, counts against section 3.3, hit-to-cell bit-equality, and a film smoke test (uniform rain for 5 s, no time-step collapse).

**Prototype 3: wetting at production cell size (retires risk 2).** Meredith's inclined acrylic panel on triangles of 1.5 and 0.75 mm, three mesh rotations, first and second order. Fit beta_cl; check the transition window, wetted fraction, orientation bias, and dewetting speed. Exit: one beta_cl per cell size inside the published range, orientation spread under 10 %, or a decision to adopt second order on W1 and W2.

After these, the first end-to-end milestone is the Pérez-Mohedano egg-yolk tile in a DU750 replica (four of six in-machine curves within 35 %).

---

## 15. What was considered and rejected

### 15.1 Alternatives

| Alternative | Why not |
|---|---|
| UV atlas of quadrilateral cells (films §10.5, items §13) | Fastest stencils (planning 3.5 G/s at 16 B per cell, 7 G/s at 8 B). My honest comparison: for the same film physics and hot state it buys about 1.5 times more work per unit area and time (section 6.4), and more if the atlas design can shrink its hot state. Rejected as the substrate because conservation at seams needs explicit flux matching that "is easy to get wrong" (numerics §5.3); charts distort (cells of unequal size waste resolution and time step); poles of shells of revolution are singular; wires, rims, cutlery and imported CAD become hundreds of sliver charts; and a ray hit needs reprojection into the atlas. It is a good optimisation for the two shapes that dominate the area (plate faces, tub walls), and section 3.6 item 6 is how this design gets the same benefit without a second representation |
| Analytic signed-distance fields as the wash-time geometry (items §13) | Walls of 1 to 4 mm and wires need 0.25 mm voxels to avoid sign errors and tunnelling (numerics §5.2), and state still needs a surface discretisation. The analytic profiles remain the source from which meshes are built and what the rigid-body layer uses |
| Fully unstructured triangle mesh at film resolution with no hierarchy | Works with the same kernels and is the fallback for imports that resist coarse remeshing. Costs 16 B more per cell, a 4 to 16 times larger BVH, and loses block coherence |
| Quadrilateral semi-regular meshes | Quad-dominant remeshing of arbitrary solids is harder to make robust than triangle remeshing, and extraordinary vertices break the regular stencil anyway |
| Vertex-centred (dual-cell) finite volumes | Six to seven neighbours per cell and no one-to-one map from a ray hit to a cell |
| Resolving the whole radial flow zone in the film solver (hand-over at r_b, films §4.3) | Needs 30 to 60 µs steps on 1.5 mm cells and a depth-averaged model where the boundary layer has not filled the film; the closed form is validated there |
| Analytic zone out to the jump radius (jets §11.2 step 5e) | Cheapest, and kept as a switch. Rejected as default because the jump on a pre-wetted, curved or edge-bounded surface is exactly what the correlations do not cover (jets "known gaps" 3 and 4) |
| Lubrication-only film with implicit stepping (graphics precedents, films §10.2) | Cannot carry wall-jet run-off, jumps or edge separation; a global sparse solve per step on 8.5 M cells is a poor fit for WebGPU |
| Film as wall-bound particles (KIVA, films §10.1) | Inertia neglected; valid below 100 µm only |
| Steady drainage routing instead of a time-domain film | Kept for the preview tier. Wetness between passes, dewetting, cascades and pulses are transient by nature (films §11.2) |
| Resolved 3-D patches at run time (MLS-MPM for pools) | The spike measured 33 to 120 M particle-steps/s; a 300 mL pool at 2 mm is about 0.3 M particles and costs tens of wall seconds per simulated second. Affordable for one or two pools, but what it would deliver is a mixing efficiency, which is better tabulated offline per vessel shape. Offline closure generation is the right role for resolved simulation here |
| Event-triggered re-solves whenever cleaned area changes by 20 % (numerics §4.5) | Variable run time; replaced by fixed solve points with predictor-corrector feedback |
| Hit-sequence micro-solves for every directly hit cell (numerics §4.3 level 2) | The soil law as specified depends on duties and peaks; kept as an audit |
| Float compare-exchange accumulation | Measured to be non-reproducible |
| f16 storage for film mass and flux | Would nearly double throughput; 11 bits of mantissa are not enough for a 100 µm film to gain or lose a micrometre. Used only for bounded intensive scalars |

### 15.2 Where the dossiers disagree and what this design does

| # | Disagreement | Resolution |
|---|---|---|
| 1 | Surface representation: triangle finite-volume mesh at 0.75 to 1 mm, about 9 M triangles (numerics §5.3); quadrilateral atlas at 2 / 1 / 0.5 mm (films §12.6); analytic SDF plus 2 mm atlas (items §13) | Triangles (numerics), with the films dossier's three resolution classes translated to equal-area triangle edges 3 / 1.5 / 0.75 mm. The numerics figure of 0.75 to 1 mm edges on all food-contact faces is finer than the films dossier says the physics needs on wettable materials and is not adopted |
| 2 | Jet-to-film hand-over: at r_b, about 7 d, film solver makes the jump (films §4.3); analytic to min(R_j, r*, edge) (jets §11.2) | In between: where the analytic film has slowed to U_h = 1.5 m/s (0.6 to 0.7 R_j) |
| 3 | Film time integration: two-stage SSP with five local levels from 0.5 ms (numerics); SSP-RK2 or Euler at half step, per-item steps (films) | Forward Euler, first order, six block-local levels from 4 ms; second order on partially wetting materials as an early upgrade |
| 4 | Wetting thresholds: Meredith's 0.5 delta_c and 0.001 delta_c, 10° spread (numerics); advancing and receding angles, delta_wet = 0.5 Hartley-Murgatroyd, delta_dry = 2 µm, 8° spread, bead store (films) | Films |
| 5 | Splash mass ratio: Bai-Gosman 0.2 to 1.1 (numerics §2.2); at most 0.3, or 0.5 on thick film (jets §6.4) | Jets |
| 6 | Surface tension: pure water for jets, splatter and fast film (jets §4.5); 40 to 60 mN/m liquor values (films §12.8) | Both, by zone: water value inside the analytic zone and for droplet impact, liquor value in the film solver. The discontinuity at the ring is real physics (surface age) crudely represented |
| 7 | Phase and ray counts: 360 to 720 steps (machine), 1440 x 7 (jets), 4096 x 64 (numerics) | 2048 x 19 with swept stamps, which removes the sensitivity |
| 8 | Break-up and other stochastic jet elements: averaged over 4 to 8 seeded revolutions (jets §11.2 step 7) | Coherent and broken branches both traced and weighted; no sampling |
| 9 | Nozzle coefficients: C_d 0.70, C_v 0.97 (jets); C_d 0.78 to 0.85 per nozzle, C_v 1.0 (machine) | Machine's per-nozzle C_d, jets' C_v |
| 10 | Protein kinetics constants (soils against chemistry; section 8.2) | Soils tables for per-soil constants, chemistry functions for liquor-side multipliers; Hill exponent a calibration parameter |
| 11 | Carry-over: 0.4 L in sump and hoses plus 0.25 kg on the load (machine §4.6); 0.3 to 0.5 L in total with 0.15 L sump residue (chemistry §10.2) | Chemistry's 0.15 L residue plus the load water this model computes; the verified 0.3 to 0.5 L total is a validation target |
| 12 | Homogenisation: adaptive cycle jumps of 1 to 30 s with consistency control (numerics §4.3); fixed 1 s soil step with per-revolution statistics (soils R2) | Fixed 1 to 2 s steps; soil is cheap enough that jumps are unnecessary |
| 13 | Throughput assumptions: 150 M film cell-steps/s and 50 M queries/s (numerics §7.2); 1 G cell-updates/s (films §12.6) | Superseded by the measurements; this proposal plans 0.45 G/s and 75 M/s |
| 14 | Hu-Jacobi drip-mode thresholds: Gamma per side or total (films §6.4, unresolved in the dossier) | Per side, as the films dossier's default; flagged for calibration |
