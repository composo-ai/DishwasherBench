# Spotless wash-simulation core: Proposal A ("exploit structure")

> **Record of the build, superseded.** One of three competing designs written on 8 October 2026.
> A panel compared them (`panel-results.txt`) and the design that was built is
> `docs/design/sim-core.md`, as limited by `docs/design/scope.md`. Kept as written; working
> files it cites are not in the repository. The index of the documents is `docs/README.md`.

Author: architect A. Date: 2026-10-08. Status: design proposal for the judging panel.

Conventions used throughout.

- SI units unless a unit is written. Angles in radians in equations, degrees in prose.
- Every adopted constant carries its dossier section and the dossier's own confidence tag: [VERIFIED], [RECALLED], [ESTIMATED]. Numbers that are my own are tagged [A-EST] (architect's estimate) and say how they were obtained. Three small throwaway scripts were run to check arithmetic and one numerical idea; they were working files (`bw_fan.py`, `polar_test.py`, `budget.py`; not in the repository) and are referred to as [A-CHECK].
- "Measured" means the GPU spike on the target M3 Pro (tables in `spikes/gpu-compute/out/tables.md`).
- Dossiers are cited as `jets §4.4`, `films §12.4`, and so on.

---

## 1. Executive summary

**What is proposed.** A hybrid multi-scale wash simulator in which every surface that carries water or soil is a *structured, parametrically generated patch*, and every geometric query is answered from the same closed-form parametrisation. No unstructured mesh exists anywhere in the run-time path.

The pipeline for one wash:

1. **Geometry.** Each item is generated from its parametric definition into (i) analytic ray primitives (conical frusta for shells of revolution, capsules for wires, stems and handles, planes and boxes for flat parts, small triangle sets only for cutlery heads and spouts) and (ii) structured surface patches. About 80 % of the scored area is shells of revolution. Each such item is **one** periodic patch in (s, θ), where s is arc length along the *closed* meridian outline: outer pole, outer face, rim, inner face, inner pole. Both faces and the rim are interior to one grid; the only special cells are two pole cells.
2. **Machine.** Lumped pump, branch network, nozzle and arm-torque model from the machine dossier, plus the programme sequencer and water inventory.
3. **Jets, in the phase domain.** For each hydraulic state, 8192 arm phases x up to 70 sub-jets x 37 rays are traced to first hit against the analytic primitives (tens of millions of rays, about a second). Under each coherent hit the Bhagat-Wilson radial film is evaluated in closed form on the surface *developed* around the hit point. Every 0.5 mm exposure texel **gathers** its exact wall-shear, momentum-flux and pressure history from the footprint tracks that cross its tile. No time stepping, no scatter, no atomics.
4. **Water on surfaces, in the time domain.** A depth-averaged inertial film solver (finite volume on structured quadrilateral cells with local tangent frames, MUSCL + HLL, well balanced, positivity preserving, Meredith contact-line force with hysteresis and a bead store) runs on the patches at 2 mm (large glazed ware) and 1 mm (everything else). It never resolves the 5 to 8 m/s radial film: the jet zone hands liquid over through a *retarded ring emitter*, so the fastest film it sees moves at about 1.5 m/s. Rims, lower edges and rack wires are one-dimensional "gutter" lines with pendant-drop emission. Droplets (splatter, wire fans, edge sheets, drips, splash secondaries) are Lagrangian parcels traced against the same primitives. Deep pools, narrow gaps and contact bridges are lumped reservoirs whose geometry is computed analytically from the patches.
5. **Programme march.** The cycle is cut into 6 segments. In each, the coupled film and droplet system is run through the *actual* diverter alternation (lower arm, then upper arms), so the spin-up revolutions are the real switch transients and enter the statistics with their true duty weight. The resulting four exposure records per cell drive the soil model over that segment at a fixed 1 s step (no cycle jumping), together with the lumped liquor chemistry and the thermal model. Soil-dependent wetting, liquor, temperature, pool levels and item poses are then updated and the next segment is warm-started.
6. **Soil.** The soils dossier's unified per-element model (12-layer hydration stack, reaction-erosion with lag, cohesive, adhesive and peel rules, fat, stain, particles) on 0.5 mm texels, 10 to 17 million of them, each stepped about 4500 times.

**Budget.** With stated deratings (film kernel planned at 1.0 G cell-steps/s, one quarter of the measured structured-stencil rate) the official tier costs about 800 s for a typical 13-place-setting load and about 1130 s for the 8.5 m² design load, plus a 200 s reserve; after a 0.9 sustained-load factor that is 19 and 25 minutes. The budget still closes if the film kernel reaches only 0.8 G/s, and at 0.6 G/s with one window pair fewer. A fast tier (4 mm / 2 mm film, 1 mm soil, 6 windows) runs in about 1.5 minutes and shares the jet stage bit for bit with the official tier.

**The three ideas that most distinguish this design.**

1. **One closed meridian, one seamless patch, zero stored geometry.** For shells of revolution the metric, gravity components, curvatures, edge flags, basin volumes and ray hits all come from a few hundred bytes of per-row tables plus the item's pose. The film kernel reads 16 bytes of state per cell and nothing else, which is exactly the measured memory-bound regime. A ragged-row reduced grid with a single pole cell removes the polar singularity: a throwaway test of flow straight across the pole gave 0.25 to 0.5 % mean thickness error, under 2 % maximum, and mass balance to 1e-12 [A-CHECK `polar_test.py`].
2. **Gather, do not scatter: the jet zone is painted analytically at 0.5 mm.** Grazing jets clean stripes a few jet diameters wide (jets §4.7). A 1 to 2 mm film grid cannot hold such a stripe; a closed form evaluated at the texel can. Because the atlas is structured, each texel can loop over the few track segments near its tile in a fixed order, which is deterministic and needs no accumulation primitives. The film solver is spared the stiffest part of the flow, which is worth a factor of about 5 in time step.
3. **March the programme; spin-up is physics.** Instead of a table of exposure records per abstract hydraulic state with interpolation in temperature and refresh rules, the simulator alternates short hydrodynamic windows and long soil integrations in programme order. Every simulated film second is used, memory holds one segment's records at a time, and slow drifts (soil changing the wetting, pools filling, liquor and temperature changing, items moving) are handled by the outer loop itself.

**Where it is weak, plainly.**

- After honest derating, structure buys a factor of 2 to 3 in film throughput per element and about 5 per unit area in both time and memory over an unstructured surface mesh (a triangle mesh needs 2.3 triangles per square of the same edge length, numerics §5.3, and about 100 B of geometry per triangle) [A-EST]. That is spent on 85 simulated film seconds (14 windows) instead of about 30, and on 0.5 mm soil texels. It does **not** buy sub-millimetre film resolution everywhere: rivulets on plastics are resolved marginally at 1 mm.
- Everything that is not a shell of revolution, a box shell or a wire needs a hand-written patch generator per shape class. Cutlery heads, spouts and oval platters use stored-metric "mapped" patches and are the least accurate geometry in the design.
- The analytic jet zone is only as good as its closures on real, curved, pre-wetted, partly shadowed surfaces; the design degrades to "hand over early and let the film solver do it" where the closed form is not valid.
- Analytic ray primitives have not been benchmarked on the target machine; a triangle BVH with analytic polish is the measured fallback.

---

## 2. Error budget

The question is which modelling errors change the per-item clean / not-clean verdict (IEC score >= 4 and at most 1 mL held water, standards §10.2). Magnitudes are expressed as the plausible change Δs in the 0 to 5 item score on affected items and the share of items affected. All Δs values are [A-EST] reasoned from the cited dossier data.

| Rank | Error source | Evidence on size | Effect on verdict | Reducible by compute? | Consequence for this design |
|---|---|---|---|---|---|
| 1 | Soil kinetics parameters: reference erosion fluxes, lag times, activation energy, pH and enzyme response | J_ref within a factor of 3 for egg yolk and 10 for the others; lag 0.5 to 30 min; E_a 5 to 60 kJ/mol (soils calibration table, rows 1 to 5) | Removal time changes by 3 to 10 x. Δs of 1 to 3 on most tenacious-soil items in mid-length programmes | No. Calibration only | Soil model must be cheap, table-driven, and identical across tiers. No run-time compute is spent trying to be clever here |
| 2 | Wetting topology: is an element wetted at all, by which route, for what fraction of time | 85 to 95 % of the surface is reached only by films, splatter and drips (jets §9.2 [ESTIMATED]); splatter fraction 0 to 0.4, "least certain first-order quantity" (jets §1 item 6); wire and rim constants each within a factor 2 to 3 (jets §7.3); receding angles on plastics and steel uncertain by ±20° (films §13 row 1) | Binary. Δs of -1 to -3 on shadowed faces with oven-dried soil (standards P02, P05); about 0 on jet-facing faces | Partly: numerical convergence of films and parcels is compute; the closures are calibration | The largest share of run time (film + droplets, about 70 %). Closures are isolated behind tables that offline resolved runs or real tests can replace |
| 3 | Geometric jet access: which stripes see direct impingement, with what duty | Jets are straight to 1 to 2 mm (jets §9.1 [VERIFIED]); duty 0.07 to 1.6 % (numerics §0 [VERIFIED]); a 2° nozzle-angle error moves a stripe 10 mm at 300 mm range [A-EST] | Decisive for adhesive and peel soils (stripe-wise binary); about 10 % of removal for enzyme-driven protein soils ("about 90 % of removal happens under the draining film", soils §9) | Yes, and cheaply | Exact analytic geometry; 8192 phases; 0.5 mm exposure texels; 3 % of run time |
| 4 | Liquor chemistry and temperature at the element | pH plateau uncertain by about ±0.3; protease half-life at 60 °C 10 to 240 min (chemistry §11 rows 3, 5) | Rate factor 1.3 to 2, roughly uniform over the load: shifts all scores by about ±0.5, changes the ranking of loads weakly | No | Lumped ODEs on the CPU; negligible compute |
| 5 | Shear and momentum magnitudes | k_stag 1 to 2.8, k_film 0.7 to 2 (jets §11.3); gravity-film shear known to 20 to 30 % | Small for protein (no gain between 12 and 65 Pa, numerics §1.1 [VERIFIED]); moderate for cohesive starch and peel soils. Δs under 0.3 on most items | No | Closed forms; no attempt to resolve boundary layers |
| 6 | Retained and pooled water | Pure geometry of the settled pose; recess wedge volume falls from 1.4 mL at 7° to 0.42 mL at 15° (standards P37 [ESTIMATED]) | Flips the "holds water" clause for items near the 1 mL limit | Yes | Basin volumes computed analytically on the patch; not left to the film grid |
| 7 | Redeposition specks | Capture efficiencies and stranding thicknesses are order-of-magnitude (chemistry §11 rows 12, 13) | Commonly 5 -> 4, rarely 4 -> 3; verdict flips on perhaps 5 to 10 % of items in particulate-heavy loads | No | Lumped liquor classes plus a per-texel speck intensity; Poisson draw left to the inspector |
| 8 | Item motion under jets | Mobility thresholds within a factor 2 (items §4.4) | Catastrophic but for a handful of light items | Partly | Event-driven rigid-body co-simulation at 50 ms coupling |
| 9 | Film discretisation (2 mm / 1 mm versus converged) | Meredith's validated grid was 3.8 mm (films §10.1 [VERIFIED]); rivulets 2 to 10 mm wide (films §5.6) | Moves wet/dry boundaries by 1 to 2 mm; verdict flips on under 3 % of items | Yes | Enough resolution, not more; a reference tier exists to measure this error |
| 10 | Time homogenisation | ε = 7e-4 to 7e-3 (numerics §4.1) | Under 1 % of state | Yes | Fixed 1 s soil step, no jumps; audited |
| 11 | Arithmetic | f32, bitwise repeatable on one stack (measured) | None on the reference machine | n/a | Integer accumulation, counter-based random numbers |

**How the allocation follows.** Ranks 1 and 4 cannot be bought with compute, so those models are made as cheap and as replaceable as possible. Rank 3 can be bought almost for free if geometry is analytic, so it is done exactly. Rank 2 is where numerical error and closure error are both large, so it gets most of the time, but with a discipline: resolution is raised only until numerical error is clearly below closure error (rank 9), and the remainder is spent on *more of the real programme* (14 hydrodynamic windows at 6 programme points) because rank-2 errors come as much from sampling the wrong state (dry versus pre-wetted, soiled versus cleaned surface, wash liquor versus rinse water) as from grid spacing. Rank 6 is handled analytically because the structure allows it.

Resulting split of the official tier (typical load): film 60 %, soil 15 %, droplets 11 %, jets 3 %, everything else 11 %.

---

## 3. Geometry and surface representation

### 3.1 Patch types

Every surface is one of five patch types. All but LINE carry two-dimensional state on structured quadrilateral cells.

| Type | Used for | Coordinates | Geometry storage per cell | Share of scored area (IEC-type load) [A-EST] |
|---|---|---|---|---|
| REV | Shells of revolution: plates, bowls, cups, mugs, glasses, stems, pots, round lids, bottle bodies | (s, θ): arc length along the closed meridian outline, azimuth | none (per-row tables) | about 80 % |
| CART | Planar faces: tub walls, door liner, ceiling, floors of box shells, faces of boards | (x, y) with a cell mask | none | under 5 % of scored area (boards, trays), all of the tub |
| EXTR | Skirts of box shells and slabs: wall, rim and fillets swept round a rounded-rectangle perimeter | (s, v): arc length along the wall profile, arc length round the perimeter | none (per-row and per-column tables) | about 5 % |
| MAP | Anything else: cutlery, handles of non-circular section, spouts, oval platters | (ξ1, ξ2) on a generated quad grid with a cell mask | 16 B (areas, face lengths, frame rotations, gravity projections as f16) | about 10 % |
| LINE | Rack wires, whisk and cooling-rack wires, and the "gutters" of every rim, lower edge and tip | arc length along a polyline graph | 8 B per element | not scored (except wire items) |

### 3.2 The meridian-wrapped REV patch

The items dossier defines a shell of revolution by a mid-surface polyline (r, z, t) and states that the solid is all points within t/2 of it (items §2.2). The boundary of the meridional cross-section is therefore a closed curve C made of offset segments, convex arcs of radius t/2 and the rim semicircle. The generator smooths the polyline corners with fillets (default radius 3 t for concave corners, t/2 arcs for convex ones [A-EST]; the items dossier's profiles are sparse polylines and real ware is smooth) and parametrises C by arc length:

```
C: s in [0, S]  ->  (r(s), z(s)),      r(0) = r(S) = 0
tangent           (r', z') = (cos a(s), sin a(s))
outward normal    n2 = (z', -r')
3D point          x(s, θ) = (r cos θ, r sin θ, z)
tangent frame     e_s = (r' cos θ, r' sin θ, z'),   e_θ = (-sin θ, cos θ, 0)
outward normal    n   = (z' cos θ, z' sin θ, -r')
metric            dl² = ds² + r(s)² dθ²
curvatures        κ_s = da/ds (meridional),  κ_θ = z'/r (circumferential),  κ_g = r'/r (geodesic curvature of parallels)
substrate mean curvature  κ_sub = -(κ_s + κ_θ)   (films dossier convention: positive where the wall is concave towards the liquid;
                          with this traversal κ_s + κ_θ is positive on convex rims)
```

s runs from the outer pole (centre of the underside), along the outer face, round the rim, along the inner face, to the inner pole (centre of the eating or drinking face).

```
                 rim (interior rows, flagged convex-edge)
                  __
   inner face   /    \   outer face
   s increasing|      |  s increasing
        ^      |      |      ^
        |       \____/       |
   inner pole (s = S)    outer pole (s = 0)        θ periodic: no seam
```

Consequences:

- **Both faces of the thin shell** are simply different s ranges of the same grid. A 1 mm glass wall has its two faces 100 to 200 rows apart in index space and cannot be confused.
- **The rim is not a boundary.** Film that clings round a rim (the teapot regime, films §6.3) flows through ordinary interior cells. The rim rows carry a "convex edge" flag and an edge radius r_e = t/2 taken from the profile.
- **Interiors of inverted cups and bowls** are the rows near s = S. Nothing special is needed.
- **Gravity** in the item frame is one vector per item, g_item = R_item^T g. Its components in the cell frame are
  ```
  g_s = r'(s) (g_x cos θ + g_y sin θ) + z'(s) g_z
  g_θ = -g_x sin θ + g_y cos θ
  G_n = -(z'(s) (g_x cos θ + g_y sin θ) - r'(s) g_z)        (positive where gravity presses the film onto the wall)
  ```
  computed in the kernel from a per-row table and a per-column (cos θ, sin θ) table. When an item is moved or flipped during the wash only g_item changes; film and soil state stay attached to the item.

**Ragged rows and the pole.** With uniform Δθ the cells would shrink to nothing at the axis. Row i (centre s_i) therefore has its own column count

```
N_θ(i) = 8 * 2^round( log2( 2π r(s_i) / (8 Δ) ) ),   minimum 8          (Δ = nominal cell size)
```

so the cell width r Δθ stays within [0.71, 1.41] Δ. Consecutive rows with equal N_θ form a "band"; N_θ changes by a factor of 2 at band boundaries only. Storage is row-major with a per-row descriptor (offset, log2 N_θ); a neighbour in a row with a different N_θ is addressed by a shift (j << 1, j >> 1). There are **no halo copies**. The disc r < Δ at each pole is a single octagonal cell that stores its momentum in the item's Cartesian frame and exchanges fluxes with the 8 cells of row 0.

Throwaway check [A-CHECK `polar_test.py`]: steady kinematic-wave film (q proportional to h³) flowing straight across a tilted flat disc of radius 60 mm under uniform deposition, first-order upwind finite volume on this grid, compared with the exact solution. At Δ = 2 mm (2761 cells, 6 bands): mass out / mass in = 1 to 12 digits; film-thickness error inside 0.8 R: area mean 0.49 %, maximum 1.9 %, pole cell -0.15 %. At Δ = 1 mm: 0.25 %, 1.0 %, -0.2 %. The largest errors sit on band-boundary rows, not at the pole. The result is insensitive to the flow direction relative to the grid.

**Per-row table** (32 B per row, a few hundred rows per item, cache resident): r, r', z', κ_s, κ_θ, radii of the two s-faces, packed {log2 N_θ, developable-zone id, flags: convex edge, concave corner, band boundary above/below, gutter row}.

**Frame rotation between neighbours.** Cell momentum is stored in the cell's own orthonormal frame (e_s, e_θ). Along a meridian that frame is parallel-transported, so s-neighbours need no rotation. Between θ-neighbours the frame turns by δ = κ_g r Δθ = r'(s) Δθ relative to parallel transport; neighbour momenta are rotated by ∓δ before use. On a flat disc (r' = 1) this is the usual polar-coordinate rotation, on a cylinder (r' = 0) it vanishes. This replaces all Christoffel source terms.

**Developable zones.** Consecutive rows whose tangent angle a(s) varies by less than 2° are merged into a zone tagged disc, cone(half-angle) or cylinder. Fillets shorter than 6 mm that turn more than 15° are "folds". Zones are used by the analytic jet fan (section 5.5).

### 3.3 Other shapes

- **Box shells** (oven dishes, trays, food containers): inner and outer floor are CART patches with rounded-corner masks; wall, rim and fillet form one EXTR patch periodic in v round the perimeter with s running up the outside, over the rim and down the inside, exactly like a REV meridian. On the four straight sides the metric is 1; in the four corners the EXTR patch is locally a quarter of a REV patch about the corner axis (metric r_c(s) Δφ). Floor-to-skirt seams are conforming along straight sides (equal cell size) and use the link table (3.6) at the corners.
- **Slabs** (boards): two CART faces and an EXTR skirt.
- **Lids**: shallow REV plus a REV knob joined by a link seam.
- **Handles and stems.** Stems and feet of stemware are REV rows of the same patch (a stem is just a narrow part of the meridian; an 8 mm stem has N_θ = 32 at 1 mm). Loop handles of mugs and pans are MAP "tube" patches (arc length along the centreline, arc length round the section) with a rotation-minimising frame, which makes the parametrisation orthogonal for constant sections. Each end joins the body through a link seam; body cells under the attachment footprint are masked.
- **Cutlery.** Handle: MAP tube. Spoon bowl: two-sided MAP patch on an ellipsoidal cap. Knife blade: two-sided MAP ribbon. Fork head: MAP ribbon with the slots masked; the side walls of tines are not represented (lumped into the gutter line of each tine). Cutlery is 0.4 m² of 6.1 m² but 47 % of items (standards §10.4), so this is the place where the structure hypothesis strains most. Film resolution there is 1 mm; the tine width (about 2 mm) is not resolved by any two-dimensional film model at this spacing and I do not pretend otherwise.
- **Oval platters, spouts, pouring lips**: MAP patches from an elliptic or blended parametrisation. Cells may be skewed up to about 15°; the finite-volume form used (section 6.2) works with true face normals, so skew costs accuracy, not conservation.
- **Perforated ware** (colander, sieve, basket lattice): the ordinary patch plus a porosity p per zone; rays pass with probability p (hashed, deterministic) and film cells have a drain sink proportional to p. This is a crude closure [A-EST].
- **Rack wires**: LINE elements of 2 mm along capsule chains with a junction graph; about 100 m of wire (numerics §5.3 [ESTIMATED]) gives 50,000 elements. Wires are capsules for ray queries.
- **Tub, door liner, ceiling**: CART patches at 4 mm with corner EXTR strips; sump and filter are lumped (section 4).
- **Spray arms**: a few boxes and frusta per arm in the arm frame; the ray is rotated into the arm frame at the ray's own time. Arms carry no film state; water landing on them is re-emitted as drips from the arm edge after a 0.2 s delay [A-EST].

### 3.4 Representation for ray and parcel queries

| Primitive | Where | Intersection | Count, full load [A-EST] |
|---|---|---|---|
| Conical frustum band (includes disc, annulus, cylinder) | REV meridian approximated by a polyline with 20 µm chord error; exact in θ | quadratic; two algebraic forms chosen by slope, one Newton polish on g(t) = r(t) - ρ(z(t)) | 60 to 150 per item, about 12,000 |
| Capsule | wires, tines, stems used as proxies, circular handles | quadratic | about 2,500 |
| Plane rectangle, rounded box | tub, floors, boards, EXTR straight sides | linear / slab | about 300 |
| Triangle with per-vertex (ξ1, ξ2) | MAP patches only (cutlery heads, spouts) | watertight ray-triangle | about 150,000 |

Two-level structure. Top level: a BVH over item instances (about 140), wire groups, tub parts and arms. Each REV instance is bounded by a cylinder in its own frame (a plate is a disc 24 mm thick), which is tested before descending; this matters because plates at 25 mm pitch have heavily overlapping world boxes. Bottom level for REV: a small tree over the frustum bands in the (r, z) half-plane. A straight ray becomes the curve r²(t) = a t² + 2 b t + c, z(t) = z_0 + d_z t in that half-plane, and its overlap with an (r, z) box is a pair of interval tests, so traversal is exact and cheap. Rings are tight in (r, z) even though their world boxes are not.

Thin walls cannot leak: inner and outer faces are separate bands joined at shared polyline vertices, and θ has no seams. The 20 µm meridian chord error displaces a 5° grazing hit by at most 0.23 mm along the surface, half a soil texel [A-EST: 0.02 / tan 5°].

Droplets of diameter D >= 1 mm are traced as swept spheres against primitives inflated by D/2 (exact for capsules and planes, a parallel offset for frusta).

Throughput is **not measured** for this structure. Planning value 60 M segment queries/s against a measured 100 M (incoherent) to 365 M (coherent, short segments) on a 1 M-triangle BVH. If the prototype falls short, the fallback is the measured path: tessellate at 0.2 mm chord error (about 1.5 M triangles), keep per-vertex (s, θ), and polish each hit on the analytic frustum.

**How a hit maps to a surface element.** For REV the hit returns the band index and the parameter λ along its generator, so s = s_band + λ L_band exactly, and θ = atan2(y, x) in the item frame. Film cell: row i = floor(s / Δ_f), column j = floor(θ N_θ(i) / 2π). Soil texel: the same with Δ_s. For CART and EXTR the mapping is equally direct; for MAP the triangle's barycentric coordinates interpolate (ξ1, ξ2); for wires the capsule index and axial parameter give the LINE element. No reprojection, no nearest-element search.

### 3.5 Three grids on the same parametrisation

| Grid | Spacing (official tier) | Carries | Coupling between neighbours |
|---|---|---|---|
| Film grid | 2 mm on "H-large" items (glass, glazed ceramic, porcelain or enamel, largest dimension over 150 mm, shape class plate, bowl, platter or dish); 1 mm on everything else; 4 mm on the tub | h, q, bead store, flags; film exposure records | 13-point stencil |
| Soil / exposure texel grid | 0.5 mm on all item surfaces | soil stack, jet exposure records, residue | coverage flag of 4 neighbours only (for peel-edge length) |
| Thermal / scalar grid | 4 mm | wall temperature nodes, quasi-steady film temperature and liquor-age scalars, mean face fluxes | 5-point stencil |

The grids are nested by powers of two in both directions, so restriction and prolongation are index shifts. The 4 mm² band edge of the IEC scale is 16 soil texels; a 2 mm "dot" is 12 texels; the texel is the unit of sub-element coverage the standards dossier asks for (standards §10.5).

The film grid can be coarser than the output resolution because the two sharp features of the residual map are produced elsewhere: jet stripes are evaluated analytically at texel resolution, and soil is local. What the film grid must resolve is where a continuous film exists, where it breaks, and where it carries water; the validated precedent for that is a 3.8 mm grid (films §10.1 [VERIFIED]).

Rule for film spacing: it is a property of the catalogue item, fixed per level and version, never a function of the rest of the load. Levels are linted at authoring time: if the largest loadable set would exceed the film work budget (section 11), the level carries an explicit override, the same for every player.

### 3.6 Neighbours across patch boundaries

| Boundary | Mechanism | Order | Conservation |
|---|---|---|---|
| θ (or v) periodicity | modular index | full | exact to round-off |
| Band boundary inside a REV or EXTR patch (2:1 in θ) | index shift; the coarse cell evaluates both sub-face fluxes with the same expression and operand order as the two fine cells; reconstruction drops to first order on those faces | first order locally | exact to round-off (verified in [A-CHECK]) |
| Pole | one pole cell with 8 faces | first order locally | exact to round-off |
| Seams between patches of one item (handle to body, floor to skirt, knob to lid, MAP to MAP) | link table generated with the item: "mortar faces" {cell A, cell B, length, normal in A's frame, rotation A to B}; a small kernel computes each mortar flux once and writes it to a per-cell seam slot that both sides read | first order | exact (single evaluation) |
| Item to item, item to wire | none through the film. Coupling is by drips and droplets (parcels), by contact bridges and by gap reservoirs (section 6.9) | n/a | by the parcel and reservoir ledgers |

The numerics dossier rejected atlases because "hundreds of sliver charts" would make "seam bookkeeping dominate the code" (numerics §5.3). That is true of atlases produced by unwrapping arbitrary meshes. Here charts follow the parametric generator: a mug has one REV patch, one MAP tube and two link seams of about 50 mortar faces each. A full load has under 100,000 mortar faces [A-EST].

### 3.7 Element counts and memory

Typical 13-place-setting load, 6.1 m² (standards §10.5 [ESTIMATED]): 4.1 m² H-large, 2.0 m² other. Design load 8.5 m² (upper end of the brief): 5.7 + 2.8 m². Tub, door and ceiling 2.4 m². Counts from [A-CHECK `budget.py`]; a 260 mm dinner plate is 31,544 film cells at 2 mm and 506,272 soil texels at 0.5 mm.

| Store | Bytes per element | Typical | Design |
|---|---|---|---|
| Film cells | state 16 B x 2 (ping-pong); deposition accumulators 20 B; film exposure records 4 x 16 B; static 4 B: 120 B | 3.2 M: 0.38 GB | 4.4 M: 0.53 GB |
| Soil texels with a full stack (initially soiled regions, 40 to 50 % of area) | 40 B | 9.8 M: 0.39 GB | 17 M: 0.68 GB |
| Light texels (all other item area: residue and speck record only) | 8 B | 14.6 M: 0.12 GB | 17 M: 0.14 GB |
| Jet exposure records (allocated per 8 mm tile touched by a footprint, about 15 % of tiles) | 24 B x 2 arm states | 0.18 GB | 0.24 GB |
| Footprint records | 128 B x 64 sub-jets x 8192 phases x 2 arm states | 0.13 GB | 0.13 GB |
| Parcels | 48 B x 2 M slots | 0.10 GB | 0.10 GB |
| LINE elements, thermal grid, tables, ray structure | | under 0.05 GB | under 0.05 GB |
| **Total GPU** | | **about 1.3 GB** | **about 1.8 GB** |

The memory spike showed swap growth once about 4 GB of GPU buffers were allocated on a machine in ordinary use (tables.md, B8 memory). The GPU budget is therefore set at 2.5 GB.

### 3.8 Where the structure breaks, and what is done

| Place | Problem | Treatment | Residual error |
|---|---|---|---|
| Polar caps | coordinate singularity | ragged rows + pole cell | under 2 % thickness error in the test problem; first order locally |
| Band boundaries | 2:1 non-conforming rows | first-order fluxes on those faces | largest local error of the grid (1 to 2 %) |
| Handles, knobs, box corners | patch seams | link table, mortar fluxes | first order; a film crossing a handle root is smeared over 1 to 2 cells |
| Cutlery, spouts, ovals | no natural orthogonal parametrisation | MAP patches with stored metrics; tines and blade edges as gutter lines | the weakest geometry: sub-cell features lumped |
| Wires | one-dimensional objects | LINE model, not a surface film | wrap-around and wire-to-wire junction flow are closures |
| Narrow gaps between items | not a surface property | gap field from short normal rays, lumped gap reservoirs | static capillary hold-up only |
| Deep pools | not a height field on the wall | analytic basin, lumped reservoir | no sloshing |
| New shape classes | need a generator | nine classes cover the 98-row starter catalogue (items §2.1); anything else must be authored as MAP patches | authoring cost, not run-time cost |

---

## 4. Machine hydraulics and spray-arm kinematics

The machine dossier's lumped model is adopted without structural change (machine §12.2). It runs on the CPU at 1 s resolution and on events; its cost is negligible.

**Pump and network** (machine §4.2, §4.3).

```
H(Q, N) = H_0 (N/N_0)² f_H - b Q²,          p_pump = ρ g H
for each open branch j:   p_pump = ρ g z_j + K_j Q_j² + p_arm,j,     Q_j = (C_d A)_j sqrt(2 p_arm,j / ρ)
solve  sum_j Q_j(p) = Q_pump(p)  by bisection
per nozzle i:  Q_i = C_d,i A_i sqrt(2 p_arm / ρ),   V_i = C_v sqrt(2 p_arm / ρ),   d_i = d_n,i sqrt(C_d,i / C_v)
```

Defaults: N_0 = 3000 rpm [VERIFIED nominal]; H_0 = 5.5 m, b = 4.80e6 m per (m³/s)² [ESTIMATED]; z = 0.15, 0.52, 0.80 m; K = 2.0e10, 5.6e10, 1.07e12 Pa s²/m⁶ [ESTIMATED]; nozzle tables L1 to L12, M1 to M10, T1 to T6 with per-nozzle C_d of 0.85 (round), 0.78 (slot), 0.80 (underside) (machine §3.2; positions and angles of L1 to L10 [VERIFIED], everything else [ESTIMATED]). C_v = 0.97 (jets §11.3 [RECALLED]); see appendix A, item 3. Check value: lower arm only at 3000 rpm gives 41.6 kPa at the pump, 30.7 L/min, 34.9 kPa in the arm (machine §4.3 [ESTIMATED]).

**Arm speed** (machine §3.3).

```
(I_arm + I_water) dω/dt = sum_i m_i' r_i (V_i t_i - ω r_i) - (k_f |F_ax| + c_v ω) sgn(ω) - T_contact
t_i = cos(ρ_i) sin(θ_i),   F_ax = p_arm A_hub + s (F_jz + W)
steady, no contact:   ω = ( sum m_i' V_i r_i t_i - k_f |F_ax| ) / ( sum m_i' r_i² + c_v ),  clipped at 0
```

k_f = 9.3 mm (lower), 3.8 mm (mid), 5.0 mm (top); c_v = 0.002, 0.002, 0.0005 N m s; I = 6.3e-3, 4.5e-3, 0.5e-3 kg m² wet [all ESTIMATED]. Design speeds 35 rpm [VERIFIED for the DU750], 30 and 60 rpm. The arm stalls when T_contact exceeds about 0.07 N m (0.3 N at the tip) [ESTIMATED]. T_contact comes from the rigid-body bridge (section 9). The arm period is then **quantised to an integer number of 2 ms base steps** so that phase is an integer everywhere downstream (error under 0.06 %, far inside the rpm uncertainty).

**Nozzle kinematics** (machine §12.2 item 3; jets eq. 2.3): position x_i(φ) = axis + R_i e_r, exit velocity u_i = V_i d_i + ω R_i e_lead in the laboratory frame.

**Diverter** (machine §4.4): states L (lower), U (mid + top), A (all); 1.5 s transition with linearly ramped opening; default pattern L 60 s, U 60 s; A for the first 20 s after a fill and the last 30 s of the final rinse [all ESTIMATED].

**Hydraulic state key.** A jet trace (section 5) is computed once per key = (pump speed N, diverter state, f_H bucket in steps of 0.1, set of blocked nozzles, arm status {free, knocking profile id, stalled at φ}). ECO 50 has 5 keys: (2600, A), (2600, L), (2600, U), (2800, L), (2800, U).

**Water inventory** (machine §4.5), evaluated every macro step:

```
V_sump = V_total - V_pipes(open branches) - V_air - V_film - V_trap - V_filter - V_absorbed
α = clamp(1 - V_sump / V_min, 0, 0.6),   f_H = 1 - 2.5 α         V_min = 0.5 L   [ESTIMATED]
```

The machine dossier's placeholder Q (t_flight + t_return) is replaced by the simulated values: V_air = total live parcel mass / ρ, V_film = sum over film cells, beads, gutters and wires, V_trap = sum of pools and gap reservoirs. If f_H changes bucket, a new hydraulic key is created and one extra hydrodynamic window is run from the reserve (section 7.6).

**Heater, fill, drain, dispenser, filter**: machine §12.2 items 5 to 9 and chemistry §10.2, §10.3, §10.7 as written.

---

## 5. Jets and droplets

### 5.1 Sampling

- **Arm phase.** N_φ = 8192 equally spaced phases per revolution per arm (0.044°). At the tip (R = 238 mm) the nozzle moves 0.18 mm per sample; a footprint sweeping at 5 m/s on a grazing plate moves 1.0 mm per sample at 35 rpm (0.21 ms per sample), half a jet diameter. The numerics dossier's 4096 was sized for sweep at nozzle speed (numerics §4.2); the "lighthouse" factor 1/tan φ (jets eq. 2.5) justifies doubling it. The phase lattice is rotated by a seed-dependent offset in each segment.
- **Jet cross-section.** Each round nozzle is one sub-jet; each slot nozzle is 7 round sub-jets spread over its fan angle with equal flow (jets §2.5 [ESTIMATED shortcut]). SPOT-60 has 21 round nozzles and 7 slots (machine §3.2): 70 sub-jets, 36 on the lower arm and 34 on the mid and top arms. Each sub-jet is a bundle of 37 rays on a fixed hexagonal pattern (centre, 6, 12, 18) with equal flow weights; the bundle exists to measure the *fraction* of the jet clipped by a rim or wire to 3 %, not to cover the footprint, which is analytic. (The jets dossier suggests 7 or 19, jets §7.3; 37 is affordable.)
- Per hydraulic key: 36 or 34 sub-jets are active in states L and U and 70 in state A. Budget arithmetic conservatively takes 64 per key: 64 x 8192 x 37 = 19.4 M rays, about 3 segments each.

### 5.2 Flight and break-up (analytic)

Coherent jets are ballistic with no drag (jets §3.1 [ESTIMATED]: drag is 5 % of g): x(t) = P + u_0 t + g t²/2, traced in segments whose chord sag stays under 0.1 mm (numerics §5.1). Jet diameter thickens by continuity, d(z) = d_0 sqrt(V_0 / V(z)).

```
L_b   = C_b d ( sqrt(We) + 3 We / Re ),      C_b = 6 (range 3.3 to 12)       jets eq. 3.1 [ESTIMATED default, VERIFIED bounds]
f_c(s) = 1 for s <= 0.6 L_b;  1 - (s - 0.6 L_b)/(0.8 L_b) in between;  0 for s >= 1.4 L_b      jets eq. 3.2 [ESTIMATED]
x_i   = 13 d (Tu³ We)^(-0.915),  f_sh = clamp(0.05 (s - x_i)/L_b, 0, 0.1),  Tu = 0.05         jets §3.4 [VERIFIED correlation], §3.6 [ESTIMATED]
```

A hit at flight distance s is treated as a coherent footprint with weight f_c and as a drop train (D = 1.9 d, spacing 4.5 d, jets §3.5 [ESTIMATED from VERIFIED wavelength]) with weight 1 - f_c. The drop-train part reuses the same footprint geometry with its stress exposure multiplied by k_drop = 0.7 (jets §6.6 [ESTIMATED]) and its liquid emitted as splashing parcels with the plateau splatter fraction 0.3 (jets §6.5). The surface-shed fraction f_sh leaves as parcels of D_32 = 0.649 d (Tu² We)^(-0.657) along the jet.

### 5.3 Hit classification

Sub-rays of one sub-jet at one phase are grouped by what they hit.

- **Smooth face** (same patch, hit points within 3 d, normals within 20°): one footprint with Q_hit = (n_hit / 37) Q, centroid O, incidence φ = asin(|u·n| / |u|), forward direction e_t, source point S = O - r_0 cot φ e_t, footprint velocity v_s from the centroids at the neighbouring phases (jets §11.2 step 4).
- **Wire, tine, rim or edge narrower than 3 d**: section 5.10.
- **Miss**: the remaining rays continue as a thinner jet.

### 5.4 The analytic footprint ("fan")

All equations below are from jets §4.2 to §4.7 with the dossier's tags. Along each azimuth ψ about S the oblique jet is replaced by an equivalent normal jet:

```
r_e(ψ)  = r_0 sin φ / (1 - cos ψ cos φ)
q(ψ)    = (V r_0² / 2) sin³ φ / (1 - cos ψ cos φ)²           volume flow per radian           [VERIFIED]
d_eq    = sqrt(8 q / V),   Re_eq = V d_eq / ν,   Q_eq = 2π q                                 [ESTIMATED restatement]
```

Pressure (jets eq. 3.6 stretched; [ESTIMATED], conserves the normal force ρ Q V sin φ):

```
p_w = p_s sin² φ sech²(0.916 X + 0.95 X³),   X = sqrt((x_f sin φ)² + x_l²) / d,   p_s = ρ V² / 2
```

Wall shear, film thickness and mean speed with r measured from S (x = r / d_eq):

```
stagnation, r <= r_e + 0.05 d_eq:   τ_w = k_stag 1.150 ρ (V sin φ)² Re_n^(-1/2) X,   Re_n = V sin φ d / ν         [ESTIMATED from VERIFIED B = 1.831]
boundary-layer zone, r < r_b = 0.24 Re_eq^(1/3) d_eq:
        h = d_eq (0.125 / x + 1.06 Re_eq^(-1/2) x^(1/2)),   U_av = V d_eq / (8 r (h/d_eq)),
        τ_w = k_film 0.472 ρ V² Re_eq^(-1/2) x^(-1/2)                                                              [VERIFIED]
laminar zone, r_b < r < r_t = 0.2964 Re_eq^(1/3) d_eq:
        h = d_eq (3.792 x² / Re_eq + 0.1975 / x),   U_av = V / (8 x (h/d_eq)),   τ_w = μ V / (4 r (h/d_eq)²)       [VERIFIED]
turbulent zone, r > r_t:
        U_av = V / (0.167 Re_eq^(-1/4) x^(9/4) + 2.37 - 0.0108 Re_eq^(1/2)),
        h = d_eq (0.0209 Re_eq^(-1/4) x^(5/4) + (0.296 - 0.001356 Re_eq^(1/2)) / x),
        τ_w = 0.0478 ρ Re_eq^(-1/4) U_av² x^(1/4),      M = (64/63) ρ q U_av / r                                   [VERIFIED]
outer limit:   R_j(ψ) = 0.289 Q_eq^(3/4) (ρ / (ν γ_w))^(1/4)                                                       [VERIFIED, 0.289 ± 0.015]
```

k_stag = k_film = 1 (ranges 1 to 2.8 and 0.7 to 2, jets §11.3). γ_w is the pure-water value at temperature, because the surfaces involved are milliseconds old (jets §4.5 [VERIFIED basis]). Beyond r_s = 4.5 d_eq the flow is reduced by the splatter fraction (5.8). My re-evaluation of these formulas for the reference jet (2 mm, 8 m/s, 50 °C) reproduces the dossier's table and R_j = 41 mm [A-CHECK `bw_fan.py`].

Each fan is stored as a 128 B **footprint record**: S, the frame (e_t, e_l, n), V, d, sin φ, Q_hit, f_c, ξ, v_s, patch id and (s, θ) of S, zone id, and r_lim(ψ) at 16 azimuths (f16).

### 5.5 Fans on curved items: developed coordinates and the validity bound

The closed forms assume a flat wall. The jets dossier allows them on the unrolled surface while |curvature| R_j < 0.5 (jets §4.8). The REV parametrisation makes "unrolled" precise:

- Within one developable zone the surface is isometric to a plane. Disc: use the plane itself. Cone of half-angle β: polar development (ρ_c = slant distance from the apex, angle θ sin β). Cylinder: (s, r θ). The texel's developed position relative to S gives (r, ψ) exactly.
- Across one fold into the adjacent zone (cup base to wall, plate well to rim slope), the shortest path is found by minimising the two-piece length over the crossing azimuth (3 Newton iterations). A concave fold presses the film against the wall and is passed without loss; a convex fold triggers the edge test of section 6.7.
- On continuously curved rows (bowl walls) the osculating cone at S is used and the fan is valid while |κ_s| ℓ < 0.5.
- **Validity bound.** The analytic fan ends at r_lim(ψ) = min( R_j(ψ), r*(ψ) (section 5.6), the first convex edge where the film separates, the second fold, the curvature bound, the patch boundary ). Whatever momentum the film still has at r_lim is handed to the film solver (5.7), which then computes the rest at the cost of a smaller time step for that item. The analytic zone therefore shrinks gracefully towards the stagnation region on awkward geometry instead of being wrong.

For MAP patches (cutlery) the fan is limited to the tangent plane at S and to r < 3 d; cutlery is narrower than a footprint anyway.

### 5.6 Sweeping footprints and the exposure gather

The footprint moves at v_s = 0.3 to 5 m/s, so the steady jump-and-rope picture never forms (jets §1 item 4). Following jets §4.9 [ESTIMATED]: the film front emitted at t_0 reaches radius r at t_0 + T(r), T(r) = ∫ dr / U_av; ahead of the footprint the fast film exists only out to r*, where U_av(r*) = v_s·e_r, and leads the footprint by a_lead = r* - v_s T(r*). My evaluation gives a_lead = 30, 21, 13, 8, 3 and 1 mm at v_s = 0.5, 1, 2, 3, 5 and 8 m/s and T(R_j) = 22 ms for the reference jet, against the dossier's 30, 21, 12, 8, 2 and 0 mm and 22 ms (my integration starts at 0.55 d) [A-CHECK]. On a wall still carrying a residual film h_res > 0.3 h the front speed is multiplied by 1 / (1 + sqrt(h_res / h)) (jets §4.9 item 5 [ESTIMATED]); h_res is taken from the mean thickness of the previous window's record for the same arm state (zero for the first).

**Gather kernel.** For each arm state, the CPU scans each sub-jet's track in phase order and writes, per 8 mm tile of the texel grid, a short list of (sub-jet, first phase, last phase) ranges within reach. The GPU kernel then visits each texel of each listed tile and loops over its ranges in list order:

```
for each range (jet, k0..k1) of my tile, for k = k0..k1:
    (r, ψ) = developed position of this texel about S[jet][k]
    if r < r_lim[jet][k](ψ) and (behind the front set by T(r), v_s):
        τ, M, p = closures of 5.4 (scaled by f_c + (1 - f_c) k_drop)
        for m in 0..3:  if τ > τ_m:  tExcTau[m] += Δt_k          τ_m = 10, 30, 100, 300 Pa   (jets §11.2 step 5d)
        for m in 0..3:  if M > M_m:  tExcM[m]   += Δt_k          M_m = 0.1, 0.5, 2, 8 N/m     [A-EST levels spanning jets §4.4 table]
        τ_pk = max(τ_pk, τ);  M_pk = max(M_pk, M);  p_pk = max(p_pk, p);  tFast += Δt_k
        count a new event when τ crosses τ_0 upward
```

Δt_k is the time the arm spends at phase k (uniform unless the arm is knocking an item). The loop order is fixed, the arithmetic is per texel, and nothing is shared: the result is deterministic without atomics. For the reference jet at v_s = 1 m/s the per-pass shear impulse at offsets 0, 2, 5, 10, 20, 30 mm from the track is 4.35, 4.28, 3.77, 3.11, 1.65, 0.45 Pa s [A-CHECK], the dossier's values (jets §4.9).

Cost per arm state: about 3.6 M texels in touched tiles x about 500 samples in range = 1.8e9 closure evaluations [A-EST].

### 5.7 Hand-over to the film solver: the retarded ring emitter

Liquid that left the source point at time t - T(ψ) in direction ψ arrives at the fan limit now. The emitter therefore deposits, for each phase sample and each of 64 azimuth sectors,

```
mass          dm = ρ q(ψ) (1 - ξ) Δψ Δt_k
position      S(t - T(r_lim(ψ))) + r_lim(ψ) e_r(ψ)           (developed back onto the surface)
momentum      dm U_av(r_lim(ψ)) e_r(ψ)                       tangential
```

into the integer deposition accumulators of the film cell at that position (section 6.6). Because the position uses the *retarded* source point, liquid emitted forwards lands a distance r* - v_s T(r*) ahead of the current footprint, which is exactly the lead distance of jets eq. 3.24, and the rear half of the ring lays liquid across the whole swath behind the footprint: the comet-shaped wetted pattern is reproduced without resolving the fast film. Swath-averaged deposit for the reference jet at 1 m/s: Q / (2 R_j v_s) = 0.31 mm [A-EST], which then drains under gravity.

Inside the instantaneous fan (r < r_lim), film cells are flagged "jet-owned". Their exposure is the analytic one. Any liquid already in them is swept outwards: its velocity is set to min(U_av(r), u_cap) e_r with u_cap = 0.25 Δ / Δt, so residual film is ploughed to the fan edge in a few tens of milliseconds through the ordinary mass fluxes. Mass is conserved by construction (integer deposits, flux-form sweep).

If r_lim was cut short by the validity bound, U_av(r_lim) may be 2 to 4 m/s; the receiving item is then scheduled at a finer time-step level (section 6.5).

Where the fan ends on an **underside** (G_n < 0) at M = γ (jets §8.2, films §12.5 [VERIFIED criterion]) the liquid collects in a rope 4 to 5 mm thick (films §3.6 [VERIFIED]). By the Brun criterion a layer that thick drips from undersides tilted less than about 40° from horizontal (h* = 3.0 mm at 30°, 5.7 mm at 45°, films §3.5 [ESTIMATED from the VERIFIED formula]); there the liquid does not enter the film but leaves as a curtain, emitted as parcels of diameter 3.3 l_c from the departure line. On steeper undersides (the back of a leaning plate) it is deposited to the film like anywhere else and runs to the lower edge. Where it ends at a **convex edge** with We_e above the threshold of section 6.7 it leaves as a sheet, emitted as parcels of median diameter 3 h continuing along the film direction (jets §7.3).

### 5.8 Splatter

```
ω_s  = We exp(0.971 (l/d) / sqrt(We)),   ξ_BL = max(0, -0.258 + 7.85e-5 w - 2.51e-9 w²),  w = min(ω_s, 11000)     [VERIFIED correlation, ESTIMATED cap]
S_W  = clamp(4.6e-5 (V d / ν_20 - 12000), 0, 0.40),   ν_20 = 1.0e-6 m²/s                                           [ESTIMATED line through VERIFIED points]
ξ    = k_S max(ξ_BL, S_W) sin φ,     k_S = 0.5 (0 to 1)                                                            jets eq. 5.4 [ESTIMATED synthesis]
```

Splattered mass leaves as parcels at r_s = 4.5 d_eq, 20° above the wall (uniform 10 to 30), speed 0.7 V (uniform 0.4 to 0.9), log-normal diameter with median 0.08 d and geometric standard deviation 1.8 truncated to [0.01, 0.4] d (jets §5.6 [VERIFIED ranges, ESTIMATED distribution]).

### 5.9 Droplet parcels: flight, impact, secondaries (simulated)

A parcel is a group of identical droplets: position, velocity, total mass, droplet diameter, lineage key. Flight:

```
du/dt = g - (3/4) C_D (ρ_g / ρ) |u| u / D,     C_D = (24 / Re_p)(1 + 0.15 Re_p^0.687) for Re_p < 1000, else 0.44     jets eqs. 3.3, 3.4 [RECALLED]
```

in still air, integrated with a fixed step per parcel class: 2 ms for parcels faster than 2 m/s, 8 ms otherwise (chord sag 0.08 mm), each step one segment query. On impact (jets §11.2 step 6):

```
We_n = ρ V_n² D / γ_w,   La = ρ γ_w D / μ²,   wall is wet if the film cell holds h > 20 µm                         [ESTIMATED threshold]
wet wall:  We_n < 2 stick;  2..20 rebound with e = 0.993 - 1.76 θ_i + 1.56 θ_i² - 0.49 θ_i³, tangential x 5/7;
           20..A_wet La^(-0.183) deposit;  above: splash           A_wet = 1320                                    [VERIFIED, OpenFOAM]
dry wall:  We_n < A_dry La^(-0.183) deposit (K = We sqrt(Re) < 3000 on smooth clean glass or glaze); above: splash    A_dry = 2630   [VERIFIED]
splash:    r_m = clamp(0.1 (We_n / We_c - 1), 0, 0.3)  (0.5 if h > 0.1 D);  4 secondary parcels, median 0.08 D, g.s.d. 1.8,
           10 to 40° above the wall, 0.3 to 1.2 V_n plus 0.7 of the tangential velocity; no second generation      jets §6.4 [ESTIMATED from VERIFIED ranges]
stress pulse on the film cell:  τ = k_drop 0.63 ρ V_n² Re_n^(-1/2) for 2 D / V_n over radius 0.5 β_max D,  β_max = 0.61 (Re_n² Oh)^(1/6)     jets §6.6 [ESTIMATED]
```

Deposited mass and tangential momentum go to the integer accumulators of the film cell, LINE element or pool that was hit. Parcels entering the sump region are removed and credited to the sump.

Parcel budget [A-EST]: splatter about 45 mL/s as 0.16 mm droplets, 20 droplets per parcel, about 1 M parcels/s; wire fans and edge sheets about 1 M/s; drips about 2500/s, one parcel each; splash secondaries about 1 M/s; in all about 4 M parcels per simulated second, about 15 segment queries each, 0.5 to 1 M alive at once.

### 5.10 Wires and rims

The closure of jets §7.3 is used as written; every constant in it is [ESTIMATED] with a factor 2 to 3 range, and it is the first sub-model to be replaced by an offline resolved-simulation table (section 14).

- A wire or tine intercepts the fraction f_hit of the 37 rays. The passing part continues as a jet of diameter d sqrt(1 - f_hit), deflected by 5° x f_hit away from the wire, with C_b reset to 3.3 from there on.
- The intercepted part: stagnation pressure and shear on the wire itself; a retained fraction f_ret = 0.05 goes to the wire's LINE element; the rest leaves as two fan sheets centred 40° from the incoming direction (in-plane ±20°, along-wire ±15°) at 0.8 V, emitted as parcels of median 0.25 d.
- A rim splits the bundle geometrically; the part landing on a face is an oblique partial jet with flow f_hit Q.
- Droplets on wires: D >= 0.5 D_w and We_n > 20 split in two, each deflected 20 to 40°, retaining f_ret; smaller or slower droplets are captured.

Because wires are exact capsules, geometric shadowing by 3 to 5 mm wires at 20 to 35 mm pitch (10 to 25 % of directions per wire family, jets §7.3) is exact; only the scattering is a closure.

### 5.11 Inverted vessels

No special model. A jet that passes the opening (rim clipping by the ray bundle) strikes the base at 60 to 90°; the fan spreads over the base disc zone; if the base-to-wall corner is closer than R_j the fan crosses the concave fold and continues down the wall in the wall's development (the "ceiling film plus wall curtain" of jets §8.2); if not, the fan ends on the near-horizontal underside at M = γ and falls as a curtain of parcels inside the vessel (5.7). A jet striking the interior wall at a grazing angle produces a forward fan that climbs the wall. Splatter parcels generated inside are traced like any others and mostly deposit within the vessel. All of this is [ESTIMATED] physics in the dossier and remains so here.

### 5.12 Rain and water-on-jet interference

Rain is not a separate model: drips from gutters and wires (section 6.7), curtains and edge sheets are parcels and fall onto whatever is below. During each window the parcel number density is accumulated on a 1 cm grid; in the next window each coherent jet's f_c is multiplied by exp(-c_int ∫ n π D² / 4 ds) and the removed fraction becomes drop-train parcels (numerics §4.4 [ESTIMATED], c_int = 1, range 0 to 2).

### 5.13 What is analytic and what is simulated

| Quantity | How |
|---|---|
| Nozzle flow, speed, direction, arm speed | algebraic (section 4) |
| Jet flight, break-up probability, shed fraction | analytic along traced rays |
| First hit, clipping by rims and wires, shadowing | exact ray tracing over 8192 phases |
| Pressure, shear, film thickness and momentum flux in the fan; sweep and lead; exposure per texel | closed form, gathered per texel |
| Splatter fraction and droplet spectrum | correlation, emitted as parcels |
| Wire and rim scattering | closure (table), emitted as parcels |
| Droplet flight, impact outcome, secondaries, deposition | simulated parcels |
| Everything beyond the fan limit: drainage film, rivulets, dry patches, clinging, gutters, drips, cascades | simulated (section 6) |
| Jet forces on items | momentum theorem on the fan (section 9) |

---

## 6. Water on surfaces

### 6.1 Governing equations

The films dossier's recommended model (films §4.2, §12.2) is adopted. Per film cell: thickness h [m], discharge q = h u [m²/s] (two components in the cell frame), bead store b [m], wet flag w.

```
mass        ∂h/∂t + div_s q = S_h
momentum    ∂q/∂t + div_s(β_m q⊗q / h) = -h grad_s Φ - τ_w/ρ + F_cl/ρ + S_q
potential   Φ = g ẑ·x_s + G_n h - (σ/ρ)(κ_sub + lap_s h) + p_imp/ρ            [m²/s²]
friction    τ_w/ρ = (1/2) f |u| u,   f = max(24 / Re_loc, 0.288 Re_loc^(-0.40)),   Re_loc = 4 |q| / ν
```

β_m = 1.2 on the laminar branch and 1.016 on the turbulent branch of f; forcing coefficient 1 (Shkadov form) (films §3.3, §4.1; laminar law [VERIFIED via Meredith eqs. 8, 9], Brauer branch [ESTIMATED conversion of a VERIFIED thickness correlation]). x_s is the substrate point, ẑ is up, G_n = g n·ẑ is positive on upward-facing surfaces and negative on undersides; σ is the liquor's surface tension for slow films (60, 40, 55, 45 mN/m by phase, films §12.8 [ESTIMATED]); p_imp is the normal momentum flux of deposited parcels. Writing the driving force as the gradient of one potential is what makes a pool come to rest (films §4.2 note 1). On undersides the same equations contain the Rayleigh-Taylor instability with the correct cut-off 2π sqrt(σ / (ρ |G_n|)), 12 to 17 mm (films §4.2 note 2).

The film energy and scalar equations of the films dossier are **not** carried in the fast loop. Film temperature and liquor composition relax in centimetres and seconds (films §9.2) and are solved as quasi-steady fields on the time-mean flux at 4 mm in the macro loop (section 6.10, section 8). This keeps the fast state at 16 B per cell, the measured memory-bound optimum.

### 6.2 Discretisation

Finite volume on the structured quadrilateral cells of section 3, momentum in each cell's own tangent frame:

```
h_c ← h_c - (Δt / A_c) sum_f F_f^h L_f + Δt S_h
q_c ← q_c - (Δt / A_c) sum_f R_{c,f} F_f^q L_f - Δt h_f̄ (grad Φ)_c + Δt (S_q + F_cl/ρ)
q_c ← q_c / (1 + Δt f |u| / (2 h_c))                    pointwise-implicit friction (films §12.6 step g)
```

- Faces f: the four sides (two sub-faces on the coarse side of a band boundary, 8 for a pole cell, a seam slot where flagged). L_f face length, A_c cell area, R the frame rotation of section 3.2. For REV, CART and EXTR all of these come from the row and column tables.
- Fluxes: HLL with wave speeds u_n ± sqrt(max(G_n, 0) h + 4 σ h / (ρ Δ²)) (films §12.6 step c), from minmod-limited linear reconstructions of h, q and Φ (MUSCL), first order at band-boundary, pole and seam faces.
- Well balancing: hydrostatic reconstruction on Φ so that uniform Φ gives zero flux and zero force (films §10.4 [RECALLED: Audusse et al. 2004]).
- Positivity: outgoing mass fluxes of a cell are scaled so that it never loses more than it holds (draining-time-step limiter, films §10.4 [RECALLED]).
- Capillary term: lap_s h on the 5-point curvilinear stencil; |grad_s h| clamped to 0.5 inside it near contact lines (films §12.6 step f).
- Velocity from discharge: u = sqrt(2) h q / sqrt(h⁴ + max(h⁴, ε⁴)), ε = 1 µm (films §12.6 item 5 [RECALLED: Kurganov-Petrova]).
- Time integration: forward Euler with the limited reconstruction at CFL 0.4. It is formally first order in time. I accept that: the forcing is intermittent and friction dominated, and a single stage halves the cost. Two-stage SSP Runge-Kutta is a switch used in the reference tier to measure the difference.
- The kernel is a pure gather over a cross-shaped stencil two cells wide; one invocation writes one cell. Buffers ping-pong.

### 6.3 Closures at a glance

| Closure | Formula and default | Source and tag |
|---|---|---|
| Wall friction | section 6.1 | films §3.3 |
| Wall shear reported to the soil model | τ_w from the friction law; analytic value where a fan covers the texel | films §12.3 |
| Contact-line force | section 6.4; β_cl = 1.0 (0.4 to 1.0) | films §12.4; Meredith [VERIFIED] |
| Contact angles θ_a / θ_r per material and liquor | table of films §12.7, mixed with soil coverage; plus frozen random offset, s.d. 8°, correlation length 2 mm | films §12.7 [ESTIMATED, anchored]; §12.4 |
| Wetting threshold | δ_wet = 0.5 [15 μ² σ (1 - cos θ_a) / (ρ³ g_e²)]^(1/5), g_e = g max(sin β, 0.1) | films §12.4 [VERIFIED Hartley-Murgatroyd, factor 0.5 after Meredith] |
| Bead capacity | b_max = 0.03 l_c (cos θ_r - cos θ_a) / max(sin β, 0.1) | films §12.4 [ESTIMATED] |
| Edge separation | section 6.7 | films §12.5 |
| Pendant drops and columns | section 6.7 | films §6.4, §12.5 |
| Film to wall heat transfer | α_fw = 1.88 k / h (laminar branch); 0.0106 Re^0.3 Pr^0.63 k (g/ν²)^(1/3) (turbulent) | films §9.1 [ESTIMATED from VERIFIED Wilke; VERIFIED Shmerler-Mudawar] |
| Film to wall mass transfer | k_m = 0.538 (D² τ_w / (μ x))^(1/3) | films §9.4 [RECALLED] |

The random contact-angle offset and the soil-loading heterogeneity are **procedural fields in surface coordinates** (hashed value noise seeded from the item identity and the run seed), not per-cell random numbers, so every tier samples the same field.

### 6.4 Wetting and dewetting

Exactly films §12.4. At every face between a wet and a dry cell:

```
F_a = β_cl σ (1 - cos(θ_a + ξ)) / Δ       resistance to advance, dry cell's angle
F_r = β_cl σ (1 - cos(θ_r + ξ)) / Δ       drive for retraction, wet cell's angle
F_hold = force per unit area along n_in that would bring the wet cell's outward normal momentum to zero this step
F_cl = clamp(F_hold, F_r, F_a) n_in        pinned if F_r <= F_hold <= F_a (no flux across the face)
```

Liquid deposited in a dry cell goes to the bead store b; the cell becomes film-wet when h + b > δ_wet or when a neighbouring front advances into it. A wet cell whose h falls below δ_dry = 2 µm stays wet if θ_r < 5°, otherwise its liquid moves to the bead store and it becomes dry. Beads above b_max return to the film as a running drop. Beads count as "wet, zero shear" for the soil model.

This single mechanism is what produces continuous films on glass and glazed ceramic in wash liquor (θ_r of 3 to 5°), rivulets and beads on polypropylene (θ_r of 25 to 60°), and the difference between rinsing with and without rinse aid (films §5.4, §5.5, §8.3). The dominant uncertainty is θ_r, not the grid.

### 6.5 Time stepping: per-item local stepping, scheduled in advance

Base step Δt_0 = 2 ms. Each item (its patches are one conservative domain) runs at Δt_0 / 2^ℓ, ℓ in 1..5 (1 ms to 62.5 µs). All items synchronise every base step; items exchange nothing through the film, so local stepping per item is exactly conservative with no interface machinery.

```
ℓ = clamp( ceil( log2( Δt_0 λ / 0.4 ) ), 1, 5 ),     λ = max over the item's cells of (|u| + c) / Δ_min
```

Typical values [A-EST from films §10.3 and my re-evaluation in `bw_fan.py`]: quiet draining film at 1 mm, 1.8 ms allowed; ordinary wet film in the sprayed rack (0.4 m/s, 0.2 mm), 0.69 ms at 1 mm and 1.36 ms at 2 mm; receiving a ring emitter at 1.5 m/s, 0.24 ms at 1 mm and 0.50 ms at 2 mm; a 3 mm ridge, 0.54 ms.

**Fixed in advance.** The level of every item for every base step of a window is computed *before* the window starts from the jet stage: an item is "jet-active" from 4 ms before any ring emitter deposits on it until 60 ms after, with the level implied by that emitter's U_av(r_lim); otherwise it takes the default level of its material and spacing; items for which no deposition is scheduled within 100 ms, which received none in the last 100 ms, and whose largest film speed is below 5 mm/s are dormant: they are skipped and their state is frozen until deposition is next scheduled (the thinning of a slow residual film over a few seconds is ignored; the final drain-down uses the analytic drainage law instead, section 7.6). The total number of cell-steps of the window is therefore known exactly before it starts, which gives an exact progress bar and a pre-run cost. A per-item CFL monitor (integer atomicMax of a quantised λ, read back once per base step) may only **raise** a level for the next base step and logs it; with the positivity limiter and implicit friction an under-resolved step loses accuracy, not stability.

I considered and rejected block-level local stepping inside an item (section 15): the dominant cost is ordinary wet film at 0.5 to 1 ms across the sprayed rack, not the few fast blocks, so the saving was 16 % for a large increase in complexity [A-EST].

Order of work in one base step:

1. Emit: ring emitters for the phases falling in this step; splatter, wire-fan and drop-train parcels for those phases; drips and edge sheets requested by step 6 of the previous base step.
2. Advance parcels (one segment query each per parcel step); resolve impacts into integer accumulators; spawn secondaries.
3. Deposition-apply pass: accumulators into h, q, b, p_imp; wet-state transitions; clear accumulators.
4. Film sub-steps: for ℓ = 1..5, 2^ℓ dispatches over the tiles of the items at that level. All levels take an even number of sub-steps, so every item ends in the same buffer.
5. Statistics pass (averaging windows only): update film exposure records (section 7.4) and the mean face fluxes.
6. LINE elements and lumped reservoirs; collect emission requests.
7. CFL monitor read-back (16 B per item).

About 80 dispatches per base step, 500 base steps per simulated second; at the measured 1.3 to 2.8 µs per dispatch and 0.1 ms per scalar read-back the overhead is about 0.2 s per simulated second.

### 6.6 Deposition interface

One mechanism serves every source of liquid: per film cell five i32 accumulators {mass, tangential momentum x 2, normal momentum, count} written with atomicAdd in units of 1e-12 kg and 1e-12 kg m/s. Ranges: a 0.34 g drip is 3.4e8 units, a 4 mm² cell holding 0.1 mm of film is 4e5 units; i32 holds ±2.1e9. Integer accumulation was measured bitwise identical regardless of order (tables.md B7). Sources: ring emitters, parcels, drips from other items, overflow from pools, transfers from LINE elements.

### 6.7 Edges, gutters, dripping and cascades

**Edge classification is free** on structured patches: rim rows, foot-ring rows and skirt rims are known per row with their radius r_e; MAP patch borders and tips are flagged by the generator.

**Inertial separation at a convex edge** (films §12.5; threshold from the Taylor-Culick floor and the teapot scaling [VERIFIED scaling, prefactor uncertain]; partial-separation curve [VERIFIED fit, ESTIMATED adaptation]):

```
We_e = ρ (u·t)² h / σ,     We_c = max(2, C_tp (r_e / h)(1 + cos θ_a)),   C_tp = 1 (0.5 to 3)
if We_e > We_c:  φ_sep = clamp(0.882 - 1.908 exp(-(We_e / We_c) / 1.264), 0, 1) of the flux leaves as a sheet (parcels of median diameter 3 h, velocity u)
otherwise all of it continues round the edge
```

The floor We_c = 2 is the jets dossier's M > 2γ criterion (jets §7.3), so the two dossiers agree. O'Rourke-Amsden's gas-pressure criterion (numerics §2.2c) is not used: it needs 5.8 m/s at a 90° corner and never triggers for these films (films §6.2).

**Gutters.** Every rim, lower edge, tine and tip, and every rack wire, is a chain of LINE elements carrying liquid per unit length λ [kg/m]. A film cell in an edge row hands its liquid to the gutter where the edge is a *lower* edge (tangential gravity on both adjoining faces points to it). Along the line,

```
∂λ/∂t + ∂(λ u_l)/∂l = sources - drips,     u_l = g_l (λ/ρ) / (k_w ν),   k_w = 25      [A-EST: Poiseuille-like rivulet; calibrate 10 to 50]
```

with g_l the gravity component along the line. Drip sites are the local minima of height along each line, junctions, and points every λ_d = 2π sqrt(2) l_c along near-horizontal stretches (films §6.4 [VERIFIED]; 23 mm for water at 55 °C, 17 mm at σ = 35 mN/m). Each site holds mass m_e and releases (films §12.5):

```
drop mode:     when m_e >= m_d emit one drop at rest;   broad wetted edge m_d = ρ (π/6)(3.3 l_c)³;   tip or wire of wetted perimeter P: m_d = 0.65 σ P / g
column mode:   edge loading above Γ_c = 0.048 μ Ga^0.301: continuous stream of parcels
sheet mode:    above Γ_s = 0.72 μ Ga^0.236,     Ga = ρ σ³ / (μ⁴ g)
```

(drop size [VERIFIED 3.3 l_c in OpenFOAM, consistent with the pendant-drop limit]; Tate's law [RECALLED]; Hu-Jacobi thresholds [VERIFIED], per-side factor unresolved.) After spraying stops each site keeps a last drop of up to m_d: this is the "pendant ridge and last drops" term of residual water (films §8.2).

**Interior dripping from undersides.** At 1 mm and 2 mm the solver resolves pendant ridges itself where G_n < 0 (the cut-off wavelength is 12 to 17 mm, films §4.2); a bulge higher than 2.2 sqrt(σ / (ρ |G_n|)) is cut off as a drop of diameter 3.3 sqrt(σ / (ρ |G_n|)) (films §12.5 [RECALLED]). On cells coarser than 2 mm (the tub, and the fast tier's 4 mm items) the Brun rule removes thickness above h* = 3 l_c cos α / (1.62208 sin^(3/2) α) (films §3.5 [VERIFIED]).

**Cascades.** Drips, columns, sheets and curtains are parcels and are traced onto whatever lies below, including the other rack. This is how the lower rack is rained on while the upper arms run.

### 6.8 Pools

Basins are found once per pose by a priority flood of the substrate height along gravity on each patch (CPU, on the 2 mm grid, under a second for the load on worker threads [A-EST]). On a REV patch the height is closed form, H(s, θ) = u_h r(s) cos(θ - θ_u) + u_z z(s) for up-vector u in the item frame, so the submerged region of a tilted vessel at a given level is an analytic θ-interval per row and V(level) is a one-dimensional quadrature. Spill points and the volume-level table (64 levels) are exact for the pose.

- Shallow water (depth under 3 mm, films §7.1 [ESTIMATED switch]) stays in the film solver, which is well balanced.
- A deeper basin is a lumped reservoir: volume, temperature, composition, settled solids. Inflow: film flux across its waterline plus direct deposition onto its surface; outflow at the spill point when the level exceeds it, delivered to the accumulators of the film cells there. Submerged cells are frozen in the film solver and report "immersed" to the soil model. Mixing V dc/dt = η_mix Q (c_in - c), η_mix = 0.9 jet-fed, 0.5 through-flow, 0.1 short-circuit (films §7.3 [ESTIMATED]).
- Flat tops hold puddles through the pinned-edge rule: θ_a,edge = min(θ_a + 180° - φ_edge, 175°) on faces of convex edges bounding upward-facing regions (films §12.5).

The retained volume of an inverted mug's foot recess, an upright glass, a spoon bowl in a tray, or a recess tilted by 7° versus 15° is therefore geometry, not numerics.

### 6.9 Gaps and capillary bridges

- **Gap field.** One short ray along the outward normal from each 2 mm film cell (6 mm reach) gives the distance to the nearest other surface. Cost: 2 to 4 M short segments, well under a second.
- **Gap reservoirs.** Connected sets of cells with gap below 2 l_c (3.6 to 5.4 mm depending on liquor; standards P04) and within the capillary rise height h_cap = 2 σ cos θ / (ρ g w) of a contact (34 mm at w = 0.2 mm, 7 mm at 1 mm, standards P40) form a lumped reservoir that fills from either surface, exchanges with the passing film at η_mix = 0.1 and never drains. Its cells report "immersed, zero shear". This is what makes nested bowls and spooned spoons fail without a rule about nesting.
- **Contact bridges.** Each contact point reported by the rigid-body engine holds 20 µL (5 to 50) (films §12.5 [ESTIMATED]) and marks the texels within l_c of it as shielded. A wire-to-item contact also passes a fraction 0.5 [A-EST] of the wire's line flux onto the item.

### 6.10 Heat transfer

Thermal state lives on the 4 mm grid and advances in the macro loop (2 s step): per cell a one-dimensional wall with 3 nodes through the half thickness for ceramic, glass and plastic, 1 lumped node for metals (films §9.2), properties from the films §9.2 table [RECALLED]. Boundary conditions per window from the film exposure record: wet fraction, mean h (hence α_fw) and the renewal flux. The film temperature T_f is the quasi-steady solution of

```
div(<q> T_f) = <S_dep> T_liquor - <w α_fw / (ρ c_p)> (T_f - T_w)
```

on the stored mean face fluxes, 8 Jacobi sweeps per thermal step, warm-started. Unwetted cells exchange with humid tub air at h_a = 30 W/(m² K), which includes condensation (chemistry §10.10 [ESTIMATED]); condensate is added to the bead store. The total heat taken by the load closes the liquor energy balance of section 8. Soil temperature is the wall-surface node (films §9.2: within a fraction of a second of the film).

### 6.11 Conservation

| Quantity | Guarantee | Check |
|---|---|---|
| Liquid mass in the film | flux form, single-valued fluxes; round-off only (about 1e-7 relative per step) | per window: change of (film + beads + gutters + pools + gaps + parcels) = emitted - returned to sump, to 1e-4 |
| Deposition | integer, exact | accumulator ledger equals parcel and emitter ledger exactly |
| Parcels | each parcel's mass ends in exactly one sink | ledger by sink class |
| Whole-machine water | section 4 inventory | V_sump + all stores = fill + carry-over, asserted every macro step |
| Energy | lumped liquor balance closed with per-cell wall heating | heater energy = liquor + load + tub + losses to 1 % |
| Soil | section 8 | per class: on items + liquor + filter + drained + redeposited = initial |

---

## 7. Periodic forcing and whole-cycle integration

### 7.1 The programme march

The programme sequencer (machine §7.3) is cut into **segments**: maximal intervals over which pump speed, diverter pattern and liquor class are constant, the liquor temperature drifts by less than 15 K, and no fill or drain occurs. ECO 50 gives six:

| Segment | Programme steps | Liquor class (σ, films §12.8) | Pump | Duration |
|---|---|---|---|---|
| S1 | E3 wetting, dispenser opens at 60 s | water going to wash liquor | 2600 | 4 min |
| S2 | E4 heat-up, first half, 17 to 32 °C | wash, 40 mN/m | 2800 | 9 min |
| S3 | E4 second half and start of E5, 32 to 47 °C | wash | 2800 | 20 min |
| S4 | rest of E5 hold (soil largely changed) | wash | 2800 | 47 min |
| S5 | E7 intermediate rinse | rinse water, 55 mN/m | 2600 | 8 min |
| S6 | E9, E10 final rinse with rinse aid | 45 mN/m | 2600 | 17 min |

Each segment is processed in this order:

1. **Jets** for the segment's hydraulic keys, if not cached (section 5): footprint records, jet exposure records, forces.
2. **Rigid-body episode** if this key has not been seen or pump speed rose (section 9).
3. **Hydrodynamic windows**: the coupled film + parcel + LINE + reservoir system is run through the diverter sequence of the segment, continuing from the film state left by the previous segment:
   - S1: A0 (state A from dry dishes, which is the physical start of the wash), then L, then U.
   - S2 to S6: L, then U.
   - End of S6: A_end (the last 30 s in state A), then the drain-down (7.6).
   Each window is N_tr = 2 revolutions of its slowest active arm labelled *transient* followed by N_st = 1 revolution labelled *steady*. Statistics are accumulated separately for the two labels.
4. **Macro loop** over the segment's duration at Δt_m = 1 s (2 s after the first 15 minutes of a hold): soil, chemistry, thermal, pools, inventory (7.5).
5. **Segment end**: restrict soil coverage to the film grid and update the contact-angle field; update pool levels and submerged masks; update σ, ν, ρ; checkpoint.

The point of step 3 is that the "spin-up" is not thrown away. When the diverter switches to L the lower rack really is in the state the U window left it in, and it really does take a couple of revolutions to reach the L regime. The transient record is applied to the first N_tr revolutions of every 60 s dwell (about 6 % of the time), the steady record to the rest.

Totals for ECO 50: 14 windows, 8 of L type (A0, six L, A_end) and 6 U, 3 revolutions each, 1.82 s and 2.3 s per revolution at 2600 to 2800 rpm (machine §3.3 table): **about 85 simulated seconds**, plus the drain-down.

### 7.2 Why these revolution counts

- Jets are exactly periodic and are not part of the convergence question.
- Film memory is the drainage time, 0.2 to 5 s (films §1.2), comparable to one revolution, so two revolutions after a switch capture most of the transient and one further revolution is a fair sample of the regime. The numerics dossier expected 3 to 5 spin-up revolutions from an arbitrary start (numerics §4.2 [ESTIMATED]); starting from the physically correct preceding state removes most of that.
- Stochastic parts (parcels, rivulet positions) are re-sampled with fresh random sub-streams in each of the six segments, so over the programme each arm state is sampled by 6 steady and 12 transient revolutions.
- If the first prototype shows that one steady revolution is too noisy, N_st = 2 costs 25 more simulated seconds (about 135 s of wall time, typical load) and the reserve covers it.

### 7.3 Convergence monitoring

Reported per item and per window, never used to adapt quality within the official tier except through rule 1 below.

- **Limit-cycle check.** For each arm state, the relative L2 difference over the item's area between the steady records of consecutive segments with the same liquor class (S2 versus S3, S3 versus S4), for wet fraction and renewal flux. Expected under 5 to 10 % where soil has not changed the wetting.
- **Within-window check.** Second transient revolution versus the steady revolution, same norm.
- **Rule 1 (fixed, state-driven).** If the within-window difference of S1's U window exceeds 25 % on more than 10 % of the item area, one extra L, U pass is run in S1 (reserve).
- **Rule 2.** Items exceeding 25 % in the final report are flagged `hydro_unconverged` in developer diagnostics. Their scores stand.

### 7.4 Exposure records (exact layouts)

**Film exposure record FX**, 16 B, little endian, one per film cell per window label; four are held at once (L-transient, L-steady, U-transient, U-steady), six in S1 and S6, which also contain a state-A window:

| Offset | Type | Field | Meaning |
|---|---|---|---|
| 0 | u8 | wetFilm | fraction of the window with a continuous film (h > δ_dry), x 255 |
| 1 | u8 | wetBead | fraction with beads only, x 255 |
| 2 | u8 | dryMax | longest dry interval / window length, x 255 |
| 3 | u8 | immersed | fraction of the window submerged in a pool or gap reservoir, x 255 |
| 4 | u8 x 4 | excTau[4] | fraction of the window with film wall shear above 1, 3, 10, 30 Pa, x 255 |
| 8 | f16 | hMean | mean film thickness while wet, m |
| 10 | f16 | tauMean | mean wall shear magnitude while wet, Pa |
| 12 | f16 | qRenew | mean liquid arrival rate (deposition plus net film inflow), kg m⁻² s⁻¹ |
| 14 | f16 | MfMean | mean momentum flux per unit width ρ u² h while wet, N/m |

**Jet exposure record JX**, 24 B, one per soil texel per arm state, allocated per 8 mm tile touched by any fan; quantities are per revolution:

| Offset | Type | Field | Meaning |
|---|---|---|---|
| 0 | u8 | nEv | number of direct events per revolution (upward crossings of 10 Pa), saturating at 255 |
| 1 | u8 | pPkLog | peak wall pressure, 16 log2(p / 1 Pa), saturating |
| 2 | u16 | tFast | time inside a fast film, units of 2⁻¹⁶ revolution |
| 4 | u16 x 4 | tExcTau[4] | time with τ_w above 10, 30, 100, 300 Pa, units of 2⁻¹⁶ revolution |
| 12 | u16 x 4 | tExcM[4] | time with M above 0.1, 0.5, 2, 8 N/m, same units |
| 20 | f16 | tauPk | peak wall shear, Pa |
| 22 | f16 | MPk | peak momentum flux per unit width, N/m |

2⁻¹⁶ revolution is 26 µs at 35 rpm, an eighth of a phase sample. A third record set for state A (both racks sprayed, weaker jets) exists only while S1 and S6 use it.

**Mean-flow record**, 8 B per 4 mm thermal cell per window label: two f16 mean face mass fluxes, f16 mean deposition, i8 x 2 mean flow direction (for the Lévêque length and for viscous shifting of fat).

The numerics dossier proposed 12 shear levels and 8 pressure levels (numerics §4.2). The soils dossier's laws consume a shear duty above τ* = 10 Pa, a peak load for the cohesive and adhesive tests, and momentum flux above a time-varying yield M_Y; nothing in it consumes a pressure exceedance curve (soils §7.3, §7.5). Four shear levels, four momentum levels and peaks are what the consumer needs; pressure is kept as a peak for diagnostics and for a possible future impact-erosion law.

### 7.5 The macro loop (the time-homogenisation algorithm)

There is no cycle jumping. The soil dossier's natural step is 1 s with implicit diffusion (soils §7.8), which is half a revolution; at the planned soil throughput the whole programme can be integrated at that step. Homogenisation therefore reduces to first-order averaging over a revolution, the default of numerics §4.3, whose error is O(ε) with ε = 7e-4 to 7e-3.

```
for each macro step [t, t + Δt_m] of the segment:
    a  = diverter state at t;   age = time since the last switch
    lab = transient if age < N_tr T_rev(a) else steady
    CPU: machine (pump, heater, inventory), liquor chemistry ODEs, programme events
    GPU thermal step (every 2 s): wall nodes, quasi-steady T_f and liquor-age scalars on the 4 mm grid
    GPU soil kernel, for every active soil texel e:
        F  = FX[film cell containing e][a][lab]                 (nearest cell)
        J  = JX[e][a] if allocated else 0
        f_wet  = max(F.wetFilm + F.wetBead + F.immersed, J.tFast)
        τ_f, M_f, J_sup, h_f = F.tauMean, F.MfMean, F.qRenew, F.hMean, scaled by (ν(T)/ν_seg)^(1/3)
        f_j(τ*) = interpolate J.tExcTau at τ* (log τ);   f_M(M_Y) = interpolate J.tExcM at M_Y(e, t) (log M)
        τ_load = max(τ_f (from excTau), J.tauPk if J.nEv > 0);   jet quantities scaled by (ν(T)/ν_seg)^(1/2)
        Ξ = {T_s, pH, enzymes, oxidant, surfactant, hardness, suspended soil} from the scalar grid and liquor
        soil update of section 8 with these inputs over Δt_m
        atomicAdd removed mass by class into the per-item, per-class i32 ledger
    GPU reservoirs: pool fill and mixing from F.qRenew over the basin catchment; overflow flags
    CPU: read back ledgers (a few kB); feed soil release to the liquor; water inventory
```

The temperature scalings are the leading-order dependences of the closures: gravity-film thickness and shear vary as ν^(1/3) (films §3.1), boundary-layer-zone shear as ν^(1/2) (jets eq. 3.10).

**Audit (developer mode).** For a 1 % hashed subset of texels the kernel also integrates with the explicit event sequence (event k of nEv at its phase, dwell tExcTau / nEv, 1 ms sub-steps during events, 50 ms between) and reports the difference in final residual. This measures the homogenisation error on every developer run at 1 % extra cost.

### 7.6 Slow drifts

| Drift | Treatment |
|---|---|
| Temperature and viscosity | analytic scaling inside a segment; a new hydrodynamic window pair per segment (segments are split at 15 K) |
| Liquor surface tension and contact angles (detergent release, rinse aid) | liquor class is a segment boundary by definition |
| Soil removal changing wetting (fat films at 109° / 85° giving way to glass at 15° / 3°, films §12.7) | contact-angle field recomputed from soil coverage at every segment end. Fixed rule: if the area-weighted mean θ_r of any item has changed by more than 5° since the last windows were run and more than half the segment remains, the segment is split once and a window pair is re-run (reserve; at most one per programme) |
| Pools filling | lumped fill in the macro loop from the records; submerged masks updated at segment ends. Fixed rule: if a basin over 20 mL reaches its spill point in the first half of a segment, split once and re-run (reserve) |
| Liquor composition and soil load | 25-state liquor model at 1 s (section 8) |
| Water inventory and pump starvation | section 4; a change of f_H bucket creates a new hydraulic key and a window pair (reserve) |
| Item moved, arm stalled or knocking | section 9; new key, jets re-traced, window pair re-run |
| Drains and carry-over | at each drain the liquid left on the load is the sum of pools, gap and bridge reservoirs, beads, gutter last drops and the Jeffreys film h(t) = sqrt(μ s / (ρ g sin β t)) (films §8.1) evaluated from the last steady record; this volume and its composition are the carry-over into the next fill (chemistry §10.2) |
| Final drain-down | after A_end the pump is off and the film solver runs 8 s; thereafter thin films follow the Jeffreys law analytically, beads, last drops, bridges and pools are static, and the drying model of chemistry §10.11 runs on the 4 mm thermal grid to the end of the programme |

---

## 8. Soil, chemistry and thermal coupling

### 8.1 Per-texel soil state

The soils dossier's unified model (soils §7, R1 to R3) on the 0.5 mm texel grid. 40 B per texel with a full stack:

| Bytes | Field | Notes |
|---|---|---|
| 24 | w[12], f16 | water mass per layer, kg m⁻²; 12 layers graded by 1.3, thinnest at the free surface (soils R1; "fewer than 10 too coarse, more than 20 unnecessary" [VERIFIED]); soils under 20 µm dry use 1 layer |
| 2 | c, u16 | covered area fraction of the texel (sub-element coverage) |
| 1 | nLeft | layers remaining |
| 1 | class | soil class index; high bits: rim element, cracked |
| 2 | X_ad, u16 | bond integrity |
| 2 | E_r, f16 | reaction-erosion carry-over, m |
| 2 | t_wet, u16 | cumulative wet time, units of 0.25 s |
| 2 | h_o, f16 | liquid fat film, m |
| 1 | S, u8 | remaining chromophore fraction |
| 1 | B, u8 | bake index (static) |
| 2 | m_0, f16 | initial dry loading, kg m⁻² (per-layer dry mass follows from the grading) |

Light texels (8 B): redeposited fat film, speck intensity λ_e, dried dissolved residue, cumulative wet seconds.

### 8.2 Update per macro step

Exactly soils §7.5 in the order of soils R2:

1. **Hydration**: backward-Euler tridiagonal solve of ∂w_j/∂t = J_(j+1/2) - J_(j-1/2), J = D_w(β) Δβ / Δh, top flux min(D_w (β_max - β_N) / (h_N / 2), J_sup) when wetted (J_sup = F.qRenew: the water-supply limit the soils dossier insists on, soils §9 "against" item 4).
2. **Weakening**: u_r = k_ds,ref a_T exp(s_pH (pH - pH_ref)) θ_E / θ_E,ref a_B g(t_wet), lag function g; alkaline path u_OH; dX_ad/dt = -k_ad a_T a_surf a_pH H(β_1 - β_ad).
3. **Strengths**: τ_coh = τ_c0 exp(-b_c β) a_fat a_B; τ_ad = τ_a0 exp(-b_a β_1) X_ad s_sub; M_Y = F_ad / η_M; k' = min(k'_max, k'_ref (τ_ref / τ_coh,top)^1.8).
4. **Removal**, in order: (a) solubles k_L (c_sat - c_bulk) f_wet with k_L from the Lévêque formula of section 6.3; (b) reaction-erosion E_r += [u_r + u_OH + f_j(τ*) (u_s - u_r)] f_wet Δt with τ* = 10 Pa and k_ss / k_ds = 4 (soils R3 [VERIFIED 10 Pa; ratio VERIFIED range 1.5 to 7]); (c) cohesive separation where τ_coh < C_coh τ_load, C_coh = 0.67 [VERIFIED for starch]; (d) adhesive detachment where τ_ad < C_ad τ_load, C_ad = 14.2 [VERIFIED for ketchup]; (e) edge peeling dc/dt = -(L_edge / A_e) k' [f_M(M_Y) (M_j - M_Y)+ + (1 - f_j) f_wet (M_f - M_Y)+], with L_edge from the coverage flags of the 4 neighbouring texels plus the crack density of baked soils (1000 m⁻¹ [ESTIMATED]); (f) fat: SFC(T_s), viscous shifting along the mean flow direction of the 4 mm record when mobile, emulsification dh_o/dt = -k_em a_surf a_T f_wet h_o; (g) stains dS/dt = -k_ox a_T c_ox f_wet S; (h) particles released with their binder.
5. **Hand-offs**: removed mass by class to the per-item ledger.

Class parameter tables are those of soils §8 with their confidence columns. Rate functions involving exp and pow are tabulated on the CPU per macro step for the current liquor and sampled by texel temperature, which keeps transcendentals out of the per-texel loop (numerics §6.2).

Heterogeneity: the log-normal loading multiplier (coefficient of variation 0.3, soils R3 [ESTIMATED]) and the rim factor are procedural fields in surface coordinates, identical across tiers.

### 8.3 Chemistry

The lumped liquor model of chemistry §10 (25 states: volume, temperature, dose and pouch state, carbonate, base, acid, chelant, citrate, hardness, peroxide, TAED, peracid, two enzymes, surfactants, polymer, dissolved and suspended soil classes, filter load, foam) is integrated on the CPU at 1 s with the dossier's equations and constants, pH by bisection once per step (chemistry §10.4, §10.13).

What each texel sees is the liquor as modified by the film it sits under. On the 4 mm scalar grid two quasi-steady fields are solved on the mean fluxes together with T_f: the **fresh fraction** (1 at deposition from jets and from fresh rain, decaying as dissolved soil from upstream texels is added) and a **stagnation age**. Element composition follows chemistry §10.2,

```
dc_e/dt = (q_e / δ_e)(c_liq - c_e) + s_e / δ_e,    integrated exactly:  c_e ← c_liq + (c_e - c_liq) exp(-q_e Δt / δ_e)
```

with q_e = qRenew / ρ and δ_e = hMean from the record. Elements with q_e / δ_e above 0.1 s⁻¹ take the liquor's composition. Elements and pools with no inflow keep the previous phase's liquor, which is the mechanism behind detergent residue in spray shadows and dirty pooled water (chemistry §10.2).

Detergent release: the tablet is a rigid body dropped at dispenser opening (section 9); its wetting factor w_tab = min(1, q_tab / q_ref) uses the deposition flux at its resting place from the current FX records (chemistry §10.3; q_ref = 0.5 kg m⁻² s⁻¹ [ESTIMATED]).

### 8.4 Redeposition and carry-over

- Suspended fines and grit, dispersed fat and dissolved solids are liquor states with filter capture and leaching (chemistry §10.7).
- Fat redeposits per texel at j_fat = k_fat,dep C_fat,free a_sub (1 + 5 SFC(T_s)) f_wet, k_fat,dep = 1e-6 m/s, a_sub = 1.0 (PP, PE, silicone), 0.4 (melamine, SAN, PTFE), 0.05 (glass, ceramic, steel) (chemistry §10.7 [ESTIMATED]).
- Particles strand at each drain: per texel m'' = sum_k C_k min(δ_strand,k, δ_drain), δ_strand = 100 µm (fines) and 400 µm (grit), δ_drain the film 5 s after spraying stops (chemistry §10.9 [ESTIMATED]); pools deposit all their suspended load on their footprint, weighted to the last-drying point. The result is stored as a speck intensity λ_e [specks/mm²]; the Poisson draw is the inspector's (standards §10.5).
- End-of-phase deposition of dissolved solids from retained films, beads, last drops and pools (chemistry §10.9) is written to the light texel record: this is where spots and contact marks come from.
- Carry-over between phases: section 7.6.

### 8.5 Cost

Soil: 9.8 M (typical) to 17 M (design) full texels x about 4500 macro steps x an activity factor of about 0.7 (texels with c = 0 and no residue drop out, by 16 x 16 tile). Planned at 0.25 G texel-steps/s. The kernel moves about 80 B per texel-step, so its memory-bound ceiling is about 1.5 G/s; the factor 6 below that is my allowance for the 12-unknown tridiagonal solve and table lookups [A-EST]. Chemistry and thermal: a few seconds.

---

## 9. Rigid-body coupling during the wash

### 9.1 Interface

```ts
interface RigidBodyBridge {
  poses(): Float64Array;                                   // 7 per body: position, quaternion
  setMode(body: BodyId, mode: 'frozen' | 'asleep' | 'dynamic'): void;
  setWrenchSchedule(body: BodyId, t0: number, dt: number, wrenches: Float32Array): void; // 6 per sample, world frame, at COM
  setAddedMass(body: BodyId, massKg: number, comLocal: Vec3): void;   // pooled and held water
  setBuoyancy(body: BodyId, submergedVolume: number, centre: Vec3): void;
  setArmDrive(arm: ArmId, drive: number, brakeCoeff: number, kfFax: number, cv: number): void; // torque balance of section 4
  step(nSteps: number): RBEvents;                          // fixed 1 ms steps (items §5.5)
  contacts(): ContactRecord[];                             // body pair, point, normal: for bridges and gap seeds
  armState(arm: ArmId): { phi: number; omega: number; stalled: boolean };
  spawnTablet(pose: Pose): BodyId;
}
interface RBEvents { moved: { body: BodyId; dPos: number; dAngle: number }[]; armContacts: ArmContact[]; fellThrough: BodyId[]; asleep: boolean; }
```

### 9.2 Which items can move

At load time each item gets the screening number Π_J,max = c_turn J_max / W of items §4.6 with J_max the largest single-nozzle momentum flux of the machine at its highest programmed pump speed and c_turn = 2 for items with a concave face a jet can enter. Items below 0.25 are frozen; the rest are candidates and stay asleep (items §4.6 [ESTIMATED threshold]).

### 9.3 Forces

From the jet stage, by the momentum theorem on each fan: the force on the item is the incoming momentum flux minus the momentum flux of liquid that *leaves the item fast* (edge sheets, curtains, splatter):

```
F = ρ Q_hit V û_in - sum over separating azimuths of ρ q(ψ) U_sep ê_sep Δψ - ξ ρ Q_hit (0.7 V) ê_spl
```

Liquid handed to the film stays on the item and its momentum is absorbed by wall friction, so it contributes its full incoming momentum. For a flat hit with no separation this is the jets dossier's F_n = ρ Q_hit V sin φ plus a tangential part (jets §11.2 step 5f gives c_t = 0.2 [ESTIMATED]; here the tangential part follows from where the fan ends). For a jet captured in an inverted cup the film that turns the corner and leaves the rim downwards gives F up to ρ Q V (1 + U_out / V), which is the items dossier's turning factor of up to 2 emerging from the fan (items §4.3). Force and torque about the centre of mass are tabulated per candidate item per phase.

### 9.4 When the engine is invoked

| When | What |
|---|---|
| Before the wash | contact list (bridges), arm sweep test, dispenser lid and drop path, fall-through; all in the rigid-body layer (benchmark §4.6) |
| **Mobility episode**, at the first occurrence of each hydraulic key and whenever pump speed rises | candidates whose peak force exceeds 0.25 W or whose tipping moment is exceeded are woken. Co-simulation at a 50 ms coupling interval: jets for the next 50 ms of arm phase are re-traced against the current poses (64 x 240 phases x 37 rays, about 10 ms of GPU time), wrenches applied, 50 engine steps taken. Stop when every candidate has been asleep through one full revolution of every arm of the state, or after 6 revolutions |
| Arm contact | arms are bodies with one rotational freedom driven by the torque balance. Sustained ω = 0 for 1 s: the arm is *stalled* at φ_stall and the hydraulic key records it. Periodic contact: the measured ω(φ) gives non-uniform phase weights Δt_k |
| Dispenser opening | tablet spawned and dropped; its rest pose defines q_tab |
| Pool fills in a candidate | added mass set; no episode unless the item is currently moving |
| Item not settled after 6 revolutions ("rattling") | frozen at its most-visited pose, reported `moved: true, unsettled: true` |

### 9.5 Recomputing exposure

Film and soil state live in item coordinates, so moving an item invalidates nothing stored on it. After an episode: instance transforms are updated (top-level tree rebuilt, microseconds to milliseconds), g_item is updated for moved items, the gap field and basins are recomputed for moved items and their neighbours, jets are re-traced for the key (seconds), and the hydrodynamic windows proceed with the settled geometry. An episode is placed at the start of a key's first window, which is its transient window anyway. If an item moves by more than 2 mm or 2° (items §4.6) in a later segment, one window pair is re-run from the reserve.

A flipped container then fills through the pool model (33 s to 3 min for a 400 mL cup, items §4.5 [ESTIMATED]), holds dirty liquor through the drains, and starves the sump through V_trap, all by mechanisms already described.

---

## 10. Determinism and reproducibility

**Target.** Bitwise identical report on repeated runs for a fixed (inputs, seed, tier, shader source, Dawn version, OS, GPU family) tuple; statistical equivalence across tuples (numerics §6.2, benchmark §4.5). Every report carries the tuple and a hash of every shader.

**Rules.**

1. **No float scatter.** All many-to-one accumulation uses i32 atomicAdd in fixed point (measured bitwise order-independent) or i32 atomicMax. The float compare-exchange pattern (measured non-reproducible) is banned by lint.
2. **Gather kernels write one element per invocation** and loop over inputs in a stored order (footprint ranges sorted by sub-jet then phase; link tables in generator order).
3. **Counter-based random numbers.** rand(seed, domain, a, b, c) = pcg4d over a u32 key tuple, mapped to [0, 1) as (x >> 8) x 2⁻²⁴. Domains: contact-angle field, soil heterogeneity, parcel attributes, porosity transmission, arm start phases, phase-lattice offset. A parcel's key is its lineage (segment, window, emitter id, phase index, sample index, child index), never its buffer slot, so results do not depend on which slot atomics happened to assign. Parcels never interact with each other.
4. **Time is an integer.** Base-step counter, sub-step index and phase index are integers; arm periods are integers in base steps; f32 never accumulates time (numerics §6.3).
5. **Nothing depends on wall-clock.** Tier parameters, time-step schedules, window counts, the three fixed state-driven rules (7.3 rule 1, 7.6 soil-wetting split, 7.6 pool split) and the event-driven re-runs of sections 7.6 and 9 depend only on simulated quantities. Thermal state of the laptop is logged, never used.
6. **Buffer exhaustion is a failure, not a truncation.** Parcel and list buffers are sized for the worst case; overflow aborts the run as an infrastructure error (benchmark §4.6), because silent dropping would depend on thread order.
7. **CPU side.** Single-threaded or fixed-partition reductions; the rigid-body engine in its deterministic build; chemistry in f64.

**Precision hazards.**

| Hazard | Mitigation |
|---|---|
| GPU fused multiply-add differs from strict IEEE (measured: last-bit differences against CPU references) | CPU reference implementations are compared within tolerances, never bitwise |
| A flux evaluated by two cells could in principle be compiled differently at two call sites | conservation is claimed to round-off, not bitwise; seam fluxes are evaluated once; a drift monitor reports the ledger |
| f32 film increments below 4e-11 m are lost at h = 0.3 mm (numerics §6.3) | flux form keeps the loss symmetric; thin films are handed to the analytic drainage law |
| Ray-frustum quadratics for nearly flat cones | two algebraic forms by slope, Newton polish, f64 CPU reference test over 1e8 rays |
| atan2 for θ, transcendentals in closures | same-stack determinism only; soil rate functions are tabulated on the CPU |
| f16 fields | used only for statistics, static geometry of MAP patches and soil water, never for h or q |
| Verdicts near the threshold | not in scope here, but the developer report carries per-item sensitivity from a 5-seed fast-tier probe (benchmark §5.5) |

---

## 11. Compute budget

### 11.1 Throughputs and deratings

| Kernel | Measured stand-in | Planning rate | Derating and reason |
|---|---|---|---|
| Film (structured, 16 B state in, 16 B out, 13-point cross stencil, roughly 600 flops) | 4.0 G cell-updates/s for a 16 B/cell 5-point stencil, memory bound; doubling arithmetic free | **1.0 G cell-steps/s** | x 4: far more arithmetic and branching than the stand-in; sparse tile lists; the budget is shown to close at 0.8 G/s as specified and at 0.6 G/s with 12 windows |
| Soil (40 B in, 40 B out, tridiagonal solve) | memory-bound ceiling about 1.5 G/s by the same bandwidth | **0.25 G texel-steps/s** | x 6 [A-EST] |
| Ray and segment queries (analytic two-level) | 100 M/s incoherent, 290 to 365 M/s coherent, 190 to 360 M/s for 1 cm segments on a 1 M-triangle BVH | **60 M queries/s** | x 1.7 to 6: structure not yet measured |
| Fan closure evaluations in the gather | none | 2 G/s | [A-EST] from about 200 flops each; stage total is small either way |
| Integer atomic deposits | 4 G atomic adds/s implied by the particle-to-grid test | not limiting | |
| Sustained load | 91 % of initial at worst over 7 minutes | x 0.9 on the total | 30-minute run not yet measured |

### 11.2 Official tier

Typical load 6.1 m²; design load 8.5 m² with half the area soiled. Film steps per cell per simulated second, averaged over sprayed and unsprayed racks with the level mix of section 6.5: 1225 at 2 mm, 2030 at 1 mm, 750 on the tub (2 % of the stage) [A-EST; `budget.py`]. The mix assumed: 35 % of the sprayed rack's area is jet-active at any time (0.25 ms steps at 2 mm; 60 % at 0.25 ms and 40 % at 0.125 ms at 1 mm); the rest of the sprayed rack runs at 1 ms (2 mm) or 0.5 ms (1 mm); 40 % of the other rack is active at those same steps and the rest is dormant. These fractions are the least certain inputs of the table and are measured by prototype 3. 89 simulated seconds (85 s of windows plus the drain-down, which is mostly dormant).

| Stage | Content | Elements | Operations (typical / design) | Rate | Seconds (typical / design) |
|---|---|---|---|---|---|
| A. Set-up | generate patches and primitives from cached catalogue entries; instance tree; row tables; gap rays; basins; link tables; about 40 pipelines | 140 items | | | 22 / 25 |
| B. Machine and rigid body | operating points; pre-checks; mobility episodes | | | | 12 / 15 |
| C. Jets | 8 hydraulic keys x 19.4 M rays x 3 segments; track binning; gather into 0.5 mm texels | 3.6 M to 5 M texels in touched tiles | 4.7e8 queries; 1.4e10 to 2e10 closure evaluations | 60 M/s; 2 G/s | 25 / 40 |
| D. Film | 14 windows + drain-down | 3.2 M / 4.4 M cells | 4.8e11 / 6.7e11 cell-steps | 1.0 G/s | 484 / 672 |
| E. Droplets | 4 M parcels per simulated second x 15 segments | 0.5 to 1 M live | 5.3e9 / 6.3e9 queries | 60 M/s | 89 / 105 |
| F. Soil | 4500 macro steps, activity 0.7 | 9.8 M / 17 M texels | 3.1e10 / 5.4e10 texel-steps | 0.25 G/s | 123 / 214 |
| G. Macro loop, CPU side | chemistry, thermal, reservoirs, ledgers | | 4500 steps | | 15 / 20 |
| H. Output | residual maps, diagnostics, checkpoints at 6 segment ends | 1.3 to 1.8 GB state | | 10 GB/s read-back | 32 / 40 |
| **Sum** | | | | | **802 / 1131** |
| Reserve | extra window pairs (rules of 7.3 and 7.6, moved items, starvation key), each about 12 simulated seconds: 65 / 95 s | | | | 200 / 200 |
| **Total** | | | | | **1002 / 1331** |
| With sustained-load factor 0.9 | | | | | **1113 s (18.6 min) / 1479 s (24.6 min)** |
| Margin to 1800 s | | | | | 687 s / 321 s |

Sensitivities [`budget.py`]:

- Film kernel at 0.8 G/s, design load: stage D 840 s, total with reserve 1499 s, 1666 s after the 0.9 factor. Fits as specified.
- Film kernel at 0.6 G/s, design load: stage D 1120 s, total with reserve 1779 s, 1977 s after the 0.9 factor: 10 % over. The response is fixed before release, not at run time: S3 and S4 share one window pair (12 windows), which brings stage D to 964 s and the total to about 1740 to 1790 s after the 0.9 factor. That fits with almost no margin, so below about 0.7 G/s the second fallback also applies: every H-class item, large or small, uses the 2 mm film grid.
- Film kernel at 2 G/s: design total 995 s with reserve. The headroom is then spent on **official-B**: 1 mm film on all items (6.3 M / 8.7 M cells), 1075 / 1433 s with reserve before the 0.9 factor, 1194 / 1592 s after it.
- A deliberately adversarial full load of 1 mm-class items only (8.5 m² of plastics and steel) would cost about 1550 s in stage D at 1.0 G/s and miss the budget. This is prevented by the level lint of section 3.5, not by adapting at run time.

The decision between official-A (this table), the 12-window variant and official-B is taken once, from the first prototype's measurement, and frozen in the version string.

### 11.3 Fast tier (development and level design)

| Parameter | Official | Fast |
|---|---|---|
| Jet stage (phases, primitives, closures) | 8192 phases, 37 rays | **identical** except 19 rays |
| Jet exposure texels | 0.5 mm | 1 mm |
| Film grid | 2 mm / 1 mm / 4 mm tub | 4 mm / 2 mm / 8 mm |
| Segments and windows | 6 segments, 14 windows of 2 + 1 revolutions | 3 segments (wash, rinse, final rinse), 6 windows of 1 + 1 |
| Parcels per simulated second | 4 M | 1 M |
| Soil texels, layers, step | 0.5 mm, 12, 1 to 2 s | 1 mm, 6, 4 s |
| Wall time, typical / design | 17 / 22 min with reserve, before the 0.9 factor | **72 / 85 s** (+ 20 s reserve) |
| GPU memory | 1.3 to 1.8 GB | 0.5 to 0.6 GB |

**How rank consistency with the official tier is secured.** A theorem is not available; the design gives three structural properties and one empirical gate.

1. *Identical geometry and jets.* Shadowing, stripe locations, duty factors, wire clipping and item forces come from the same phase-domain trace in both tiers. The rank-3 error source is therefore common mode.
2. *Common random fields.* Contact-angle offsets, soil heterogeneity and parcel attributes are functions of surface coordinates and lineage keys, not of grid indices, so both tiers see the same realisation; differences between tiers are discretisation differences, not noise.
3. *Same model, coarser quadrature.* No closure is switched off or replaced in the fast tier. The one rule change between tiers (Brun rule instead of resolved pendant drops on cells coarser than 2 mm) already exists inside the official tier, on its 4 mm tub grid.
4. *Release gate.* For every MAJOR version, a fixed suite of at least 200 load pairs (the 48 A/B pairs of the standards checklist plus perturbations of reference loads on every level family) is washed in both tiers. Required: the sign of the level-score difference agrees for at least 95 % of pairs whose official difference exceeds 2 points; Kendall τ of at least 0.9 on level scores within each level; per-item clean-flag agreement of at least 93 %. If the gate fails, fast-tier parameters are tightened (film spacing first) until it passes. The gate is part of the definition of the fast tier.

The fast tier is never exposed to players (benchmark §4.2).

### 11.4 Reference tier (offline)

Film 1 mm / 0.5 mm, soil 0.25 mm, 12 segments with 4 + 4 revolutions, two-stage time stepping, 16 M parcels/s: about 8 x the film work and 4 x the soil work, 2 to 3 hours. It exists to measure the discretisation error of the official tier (rank 9) on the golden loads, by Richardson comparison, and needs no code that the official tier does not have.

---

## 12. Module decomposition

Seventeen modules. Each has a pure data interface so that it can be built and unit-tested against synthetic inputs. Module names are prefixed `sim/`.

| # | Module | Runs on | Responsibility | Depends on |
|---|---|---|---|---|
| 1 | `det` | both | counter-based random numbers, fixed-point helpers, hashing, provenance | none |
| 2 | `geomgen` | CPU | item definition -> patches, row tables, ray primitives, link seams, zones | det |
| 3 | `atlas` | CPU | allocation of all patches into buffers; tile lists; nesting of the three grids | geomgen |
| 4 | `raycast` | CPU build, GPU query | two-level structure; segment queries; hit -> (patch, ξ1, ξ2) | geomgen |
| 5 | `machine` | CPU | hydraulics, arms, diverter, inventory, heater, sequencer, segmentation | none |
| 6 | `jets` | GPU + CPU | phase-domain trace, hit classification, footprint records, track binning | raycast, machine |
| 7 | `fan` | GPU | closures (WGSL library), developed coordinates, gather into JX, ring emitters, item wrenches | jets, atlas |
| 8 | `parcels` | GPU | emitters, flight, impact, wire and rim kernels, deposition | raycast, det |
| 9 | `film` | GPU | finite-volume solver, wetting, edge rules, deposition-apply, FX and mean-flux statistics, time-step schedule | atlas |
| 10 | `linenet` | GPU | wires and gutters, drip sites, emission requests | atlas |
| 11 | `reservoirs` | CPU analysis, GPU state | basins, pools, gap field, gap reservoirs, bridges | atlas, raycast |
| 12 | `soil` | GPU | per-texel soil kernel, class tables, ledgers | atlas |
| 13 | `chem` | CPU | liquor ODEs, rate tables, release, redeposition bookkeeping | none |
| 14 | `thermal` | GPU | wall nodes, quasi-steady scalars on mean flow, drying | atlas |
| 15 | `rbbridge` | CPU | interface of section 9 | external engine |
| 16 | `march` | CPU | orchestration of section 7.1, schedules, monitors, checkpoints, progress | all |
| 17 | `report` | CPU | per-item outputs, developer diagnostics | atlas |

### 12.1 Type sketches

```ts
// ---------- geomgen / atlas ----------
type PatchKind = 0 /*REV*/ | 1 /*CART*/ | 2 /*EXTR*/ | 3 /*MAP*/ | 4 /*LINE*/;
interface PatchDesc {                 // 64 B on the GPU
  kind: PatchKind; item: number; material: number;
  rowTableOffset: number; rowCount: number;      // film rows
  cellOffset: number;                            // first film cell
  texelOffset: number; texelShift: number;       // soil grid = film grid << texelShift
  dFilm: number;                                 // nominal film spacing, m
  poleCells: [number, number];                   // cell ids or -1
  seamOffset: number; seamCount: number;
}
interface RowDesc {                   // 32 B: REV and EXTR
  r: number; dr: number; dz: number;             // r(s), r'(s), z'(s)
  kappaS: number; kappaTheta: number;
  rFaceLo: number; rFaceHi: number;
  packed: number;                                // log2Ntheta:5 | zoneId:8 | flags:11 | cellOffsetInPatchHi:8 (low bits in a side table)
}
interface ItemUniform { gItem: Vec3; poseWorldFromItem: Mat3x4; liquorClass: number; }
interface GeneratedItem { patches: PatchDesc[]; rows: Float32Array; prims: RayPrims; seams: MortarFace[]; gutters: LineDef[]; zones: Zone[]; basinsHint?: BasinHint[]; }

// ---------- raycast ----------
interface SegmentBatch { origin: GPUBuffer; dir: GPUBuffer; tMax: GPUBuffer; time: GPUBuffer; radius: GPUBuffer; count: number; }
interface HitBatch { hits: GPUBuffer /* HitRecord[] */; }
interface RayQuery { build(items: GeneratedItem[], poses: Float64Array): void; refit(poses: Float64Array): void; trace(pass: GPUComputePassEncoder, s: SegmentBatch, out: HitBatch): void; }

// ---------- machine ----------
interface HydraulicKey { pumpRpm: number; diverter: 'L' | 'U' | 'A'; fHBucket: number; blocked: number[]; arm: ArmStatus[]; }
interface NozzleState { pos0: Vec3; dirArm: Vec3; R: number; Q: number; V: number; d: number; arm: number; slotSub: number; }
interface OperatingPoint { key: HydraulicKey; nozzles: NozzleState[]; armOmega: number[]; armPeriodSteps: number[]; }
interface Segment { id: number; t0: number; t1: number; keys: HydraulicKey[]; liquorClass: number; windows: WindowSpec[]; }
interface WindowSpec { state: 'A' | 'L' | 'U'; nTransient: number; nSteady: number; baseSteps: number; }

// ---------- jets / fan ----------
interface JetStageResult { footprints: GPUBuffer /* FootprintRecord[subJet][phase] */; tileRanges: GPUBuffer; jx: GPUBuffer; wrenches: Float32Array /* item, phase, 6 */; emitterSchedule: Uint32Array /* per item, per base step: level */; }

// ---------- film ----------
interface FilmWindowResult { fx: GPUBuffer; meanFlow: GPUBuffer; ledger: WaterLedger; cflRaises: number; cellSteps: number; }
interface FilmSolver { runWindow(w: WindowSpec, jets: JetStageResult, label0: number): Promise<FilmWindowResult>; setContactAngles(fromSoil: GPUBuffer): void; setLiquor(p: LiquorProps): void; }

// ---------- soil / chem / thermal ----------
interface SoilStepInputs { fx: GPUBuffer; jx: GPUBuffer; scalars: GPUBuffer; rateTables: GPUBuffer; state: 'L' | 'U' | 'A'; label: 0 | 1; dt: number; nuScale: number; }
interface SoilLedger { removedByItemClass: Int32Array /* units 1e-9 kg */; }
interface LiquorState { /* the 25 states of chemistry §10.1 */ }
interface Chem { step(dt: number, release: SoilLedger, machine: MachineStep): LiquorState; rateTables(l: LiquorState): Float32Array; }

// ---------- report ----------
interface ItemResult {
  item: number; moved: boolean; unsettled: boolean; maxDisplacementMm: number;
  residual: { patch: number; rowOffsets: Uint32Array; texelArea: Float32Array /* per row */; dryMassByClass: Float32Array; coverage: Uint16Array; fatFilm: Float32Array; stain: Uint8Array; speckIntensity: Float32Array; driedResidue: Float32Array; }[];
  water: { pooledMl: number; gapMl: number; bridgeMl: number; lastDropsMl: number; beadsMl: number; filmMl: number; afterDryingMl: number; pools: { volumeMl: number; composition: Float32Array }[]; };
  diag?: { wetTimeFraction: GPUBuffer; jetDuty: GPUBuffer; hydroUnconverged: boolean; homogenisationAuditMaxRel: number; };
}
```

### 12.2 GPU buffer layouts

| Buffer | Element | Layout |
|---|---|---|
| `filmState[2]` | film cell, 16 B | h f32; q1 f32; q2 f32; u32 packed {bead store 16 bit fixed point in units of 0.1 µm; wet 1; jetOwned 1; immersed 1; edge 1; seam 1; material 6; spare 5} |
| `filmStatic` | film cell, 4 B | contact-angle offset i8; gap u8 (0.05 mm units); gutter link u16 (0 = none). MAP patches add 16 B: areas and face lengths 4 x f16, rotations 2 x i16, gravity projections 3 x f16, κ_sub f16 |
| `deposit` | film cell, 20 B | i32 mass (1e-12 kg); i32 p1; i32 p2; i32 pn (1e-12 kg m/s); i32 count |
| `fx[4]` | film cell, 16 B | section 7.4 |
| `jx[2]` | soil texel in allocated tiles, 24 B | section 7.4 |
| `soilFull` | soil texel, 40 B | section 8.1 |
| `soilLight` | soil texel, 8 B | fat f16; speck intensity f16; dried residue f16; wet seconds u16 |
| `footprints` | per (sub-jet, phase), 128 B | S vec3; e_t vec3; n vec3; V, d, sinφ, Q_hit, f_c, ξ f32; v_s vec2; patch u32; s, θ f32; zone u32; r_lim[16] f16; T_lim[4] f16; flags u32 |
| `parcels` | 48 B | pos vec3 f32; vel vec3 f32; mass f32; D f32; birth step u32; lineage 2 x u32; kind and flags u32 |
| `hits` | 32 B | t f32; instance u32; prim u32; patch u32; ξ1 f32; ξ2 f32; cosInc f32; flags u32 |
| `lines` | LINE element, 16 B | λ f32; reservoir mass f32; i32 deposit; packed {next, flags} u32 |
| `tiles[level]` | u32 x 2 | patch id; packed first row (16 bits) and first column (16 bits); one work-group of 256 invocations per tile |
| `thermal` | 4 mm cell, 16 B | T_wall[3] f16; T_f f16; fresh fraction f16; age f16; mean fluxes 2 x f16 |

Binding counts stay within 8 storage buffers per stage (numerics §6.1): the film kernel binds stateIn, stateOut, filmStatic, rows, patches, tiles, seamSlots, uniforms.

### 12.3 Parallel work packages

Five people can start on day one with no shared code beyond `det` and the type file: (i) `geomgen` + `atlas` against golden profiles; (ii) `raycast` against a CPU f64 reference; (iii) `film` on a single synthetic REV patch with scripted deposition; (iv) `soil` + `chem` against the dossiers' regression tables; (v) `machine` + `jets` + `fan` against the published plate-hit and film tables. `parcels`, `linenet`, `reservoirs`, `thermal`, `rbbridge` and `march` follow once two of those exist.

---

## 13. Verification plan

### 13.1 Per-module tests against analytic or published results

| Module | Test | Target | Tolerance |
|---|---|---|---|
| geomgen | mass and centre of mass from the profile | 20 verified product masses (items §2.4) | median error under 8 % (the dossier's estimator gives 6 to 7 %) |
| geomgen | area of a REV patch = sum of cell areas | closed form for disc, cone, cylinder | 1e-5 relative |
| raycast | ray versus f64 CPU reference, 1e8 rays, all primitive types | hit point | 2e-6 m; zero disagreements in hit / miss beyond that band |
| raycast | watertightness: rays from inside closed shells of every catalogue item | zero escapes | exact |
| raycast | hit -> (s, θ) -> x(s, θ) round trip | position | 0.05 soil texel |
| machine | operating points | 41.6 kPa, 30.7 L/min, 8.36 m/s lower only at 3000 rpm; table of machine §4.3 | 0.5 % |
| machine | arm speed versus pump speed | 38, 35, 32, 30, 28, 27 rpm lower; mid arm stalls at 1400 rpm (machine §3.3) | 1 rpm |
| jets | DU750 lower arm and two 250 mm plates at ±125 mm | 2 of 10 jets reach the left plate, 5 the right; tile impact times 0.0013 s and 0.0272 s per revolution (jets §9.1 [VERIFIED]) | same counts; times within 15 % (the thesis used zero-width jets) |
| fan | closed forms for the 2 mm, 8 m/s, 50 °C jet | h, U_av, τ_w, M at r/d = 1, 2, 5, 10, 12, 15, 20 (jets §4.4 table); R_j = 41 mm | 1 %; already reproduced by `bw_fan.py` |
| fan | flow split versus incidence | forward fraction 0.50, 0.66, 0.80, 0.91, 0.97, 0.991 at 90, 75, 60, 45, 30, 20° (jets §4.7) | 0.005 |
| fan | pressure integral | ρ Q V sin φ | 1 % |
| fan | sweeping exposure | lead 30, 21, 12, 8 mm at 0.5, 1, 2, 3 m/s; impulse 4.3, 4.3, 3.8, 3.1, 1.6, 0.45 Pa s at offsets 0 to 30 mm (jets §4.9) | 1 mm; 5 % |
| fan | developed coordinates | fan on a cone and on a cylinder versus the same fan on the unrolled plane | identical to 1e-4 |
| fan + film | ring emitter mass | emitted = Q (1 - ξ) x time | exact (integer ledger) |
| parcels | drag | decelerations 13, 32, 59, 320 m/s² for the four cases of jets §3.7 | 5 % |
| parcels | regime map | outcomes of the seven droplets of jets §6.1 table | exact classification |
| parcels | splatter | ξ_BL of 0.10, 0.28, 0.30 at 100, 150, 200 mm for 2 mm, 8 m/s at 20 °C (jets §5.2 table) | 0.01 |
| film | steady film on an incline | Nusselt thickness, velocity, shear (films §3.1) | 2 % |
| film | lake at rest in a tilted bowl (REV patch) | zero velocity | round-off, over 1e5 steps |
| film | drainage of a plate | Jeffreys h = sqrt(μ s / (ρ g sin β t)) | 5 % for t > 1 s |
| film | rivulet-to-film transition, acrylic, water 43 °C | transition between 0.125 and 0.212 kg/(m s) at 90°; wetted fraction 0.1 to 0.2 below it (films §5.2 [VERIFIED]) | inside the measured window after fitting β_cl once |
| film | puddle height | 2 l_c sin(θ/2) | 5 % |
| film | drop on an incline | slides when ρ g V sin β > w σ (cos θ_r - cos θ_a) | 15 % in critical volume |
| film | underside dripping | drips at h = 0.52 l_c, 81° from vertical; none at 0.55 l_c, 60.5° (films §3.5 [VERIFIED]) | both outcomes |
| film | flow across the pole and across band boundaries | section 3.2 test problem; same problem on a CART patch | thickness within 3 % of exact; REV versus CART within 3 % |
| film | grid-rotation invariance | tilted-disc drainage with the item rotated about its axis by 7° | 1 % in drained mass history |
| film | seam conservation | closed mug with handle, no sources | total mass constant to 1e-6 over 1e5 steps |
| linenet | pendant-drop spacing and size | 22 mm for water at 25 °C (films §6.4 [VERIFIED]); drop mass 0.34 g at 55 °C | 15 % |
| linenet | drop, column, sheet transitions | Γ thresholds of films §6.4 table | 20 % |
| reservoirs | recess wedge volume versus tilt | 5.9 mL level; 1.4, 0.42, 0.13 mL at 7, 15, 30° for R = 25 mm, 3 mm deep (standards P36, P37) | 3 % |
| reservoirs | capillary rise in a gap | 34, 13, 7 mm at 0.2, 0.5, 1 mm (standards P40) | 5 % |
| soil | the ten tests of soils R6 | egg-yolk swelling; gauge run; in-machine rates 0.85, 1.75, 2.59, 4.66 % per min; starch in channel flow; jet peeling a ∝ t^0.2; baked-soil adhesion decay | as stated per test in soils R6; 15 % on rates |
| chem | reference timelines | ECO 50 main-wash table (chemistry §10.12): pH, peracid, enzyme levels, three removal curves | 3 % (these are model regressions, not data) |
| thermal | plate warm-up under a film | time constants 10 to 25 s ceramic, 2 to 5 s thin glass and steel (films §9.2 [ESTIMATED]) | 20 % |
| march | homogenisation audit | 1 % texels integrated with explicit events | final residual within 2 % |
| march | whole-system sanity | water circuit under 3 s; mean downfall and ejection speeds 5.1 and 7.7 m/s for the DU750 at medium speed (jets §9.1 [VERIFIED]) | order of magnitude for downfall (the published CFD missed it by 34 %); 10 % for ejection |
| det | `repro-5` | five identical report hashes (benchmark §4.5) | exact |

### 13.2 Conservation checks asserted in every run

Water ledger per window and per macro step; integer deposition ledger; parcel sink ledger; soil mass per class; energy; all listed in section 6.11. A violation above tolerance fails the run as an infrastructure error.

### 13.3 The standards checklist

"Emergent" means no code mentions the phenomenon. "Closure" means it emerges but its size rests on an [ESTIMATED] closure. "Partial" is explained.

| ID | Arises from | Status |
|---|---|---|
| P01 hollow item open side up | rays cannot enter from below; basin fills from parcels; no through-flow, so pool composition is not exchanged; retained volume = brim volume | Emergent |
| P02 soiled face turned away | no JX on the face; FX shows film or bead wetting at 0 to 2 Pa | Emergent |
| P03 plate pitch | dwell d / (ω r) and reach d tan ρ are ray geometry | Emergent |
| P04 nesting | gap field, gap reservoirs, no ray access | Closure (gap threshold) |
| P05 large flat item shadows | ray geometry | Emergent |
| P06 arm stalled | contact torque in the arm balance; stalled key; jets on fixed lines | Emergent |
| P07 centre versus corner | dwell ∝ 1 / (ω r); corners outside the swept disc get only inclined jets and parcels | Emergent |
| P08 left / right asymmetry | nozzle angles in the arm frame and rotation sense | Emergent |
| P09 lean direction | incidence angle and flow split of the fan | Emergent |
| P10 tall narrow vessel interior | entry window from rim clipping; fan across the base and fold | Closure (jets §8.2) |
| P11 upper versus lower rack | branch hydraulics, flight distance, f_c(s) | Emergent |
| P12 alternating plate sizes | ray geometry | Emergent |
| P13 glass over tines | tine capsules in the jet path; contact bridges; shielded texels; end-of-phase deposition at the bridge | Closure |
| P14 face against the wall | geometry; low qRenew, so slow liquor exchange | Emergent |
| P15 nested spoons | gap reservoirs on MAP patches | Partial: cutlery geometry is the least accurate |
| P16 heads up versus down (negative control) | basket lattice as porous plates; drainage along the piece | Partial: lattice porosity is crude |
| P17 crowded basket cells | contacts and gaps from settled poses | Emergent |
| P18 tray versus basket | geometry; basin in an upward spoon bowl | Emergent |
| P19 overloading | geometry and soil load | Emergent |
| P20 total soil load | liquor ODEs: enzyme and bleach consumption, filter | Emergent (lumped) |
| P21 redeposition of particulates | liquor particle classes; stranding; speck intensity | Closure; spatial pattern partial (particles are not tracked) |
| P22 clean neighbours | same, plus splash parcels carrying contaminated film | Emergent |
| P23 end-of-cycle drips | gutter and wire last drops and drain-down drips traced onto lower items | Emergent |
| P24 arrangement irrelevant for easy soils (negative control) | soluble class leaves wherever a film flows | Emergent |
| P25 dispenser blocked | lid sweep test; release fraction 0.05 (chemistry §10.3) | Emergent |
| P26 tablet in a dead spot | tablet body's rest pose; q_tab from the records | Closure |
| P27 time and temperature trade | programme march, Arrhenius and enzyme stability | Emergent |
| P28 bleachable stains position-insensitive (negative control) | stain kinetics need only f_wet and oxidant | Emergent |
| P29 ageing | initial-state transform of the soil input | Emergent (input) |
| P30 protein responds to frequency and chemistry, not strength | τ* threshold and duty factor | Emergent, by construction of the soil law |
| P31 starch bimodal | cohesive threshold against hydration-dependent strength | Emergent in mechanism; distribution depends on calibration |
| P32 microwaved milk persistent | class parameters, alkalinity limited | Emergent (parametric) |
| P33 fat needs temperature and water | SFC(T_s) with the per-cell wall temperature; viscous shifting; redeposition on plastics | Closure |
| P34 thick layers flake | adhesive detachment rule; detached mass becomes grit | Partial: flakes are not bodies |
| P35 pot interiors | geometry, fan, pools | Closure |
| P36 pool in the base recess | analytic basin | Emergent |
| P37 tilt drains the recess | analytic basin versus pose | Emergent |
| P38 plastic stays wet | bead store from contact angles; low areal heat capacity in the drying model | Emergent |
| P39 pots stay wet | pools, rims, large area | Partial: sheltering of interiors from air exchange is lumped |
| P40 liquid at contacts | bridge and gap reservoirs | Emergent (static) |
| P41 light plastics flip | fan momentum theorem, rigid-body episode, then pool fill | Emergent; long-term rattling not |
| P42 cutlery dries (negative control) | thin metal node, drainage along length | Emergent |
| P43 spots, film, tine marks | end-of-phase deposition from beads, last drops, bridges | Partial: beads are sub-grid, so spot counts are statistical |
| P44 cutlery clean although shadowed | thin soils, wetting from parcels on all sides | Emergent, subject to P15's caveat |
| P45 class ranking | everything | Emergent; magnitude is calibration |
| P46 run-to-run repeatability | seed-dependent fields, arm start phases, parcels | Partial: the spread across seeds is whatever the model gives; matching 0.08 to 0.10 may need a calibrated variability source |
| P47 everything wetted in seconds, jets rare | parcels and films; JX duty | Emergent |
| P48 detergent does not change where water goes | jets and fans use γ_water; only slow films use the liquor's σ | Emergent, by construction (jets §4.5) |

### 13.4 What this design would not reproduce

1. Rivulet meander paths. Wetted fraction and transition flow rates are targeted; the actual path of a rivulet is not predictive, and at 1 mm it is marginally resolved on plastics (films §5.6).
2. Three-dimensional flow in pools: sloshing, plunging-jet circulation, submerged impingement. Pools are lumped with a mixing efficiency.
3. Water bells and coherent curtains as sheets. They are represented as falling droplets from the departure line.
4. Two-way coupling of thick soil with the flow: berms deflecting films, jets burrowing and blistering (soils §9 "against" item 2).
5. Flakes as bodies, and tracked transport of individual particles; redeposition has the right totals and plausible locations, not trajectories.
6. Foam dynamics beyond a lumped air fraction at the pump; aerated jets.
7. Air motion in the tub, mist transport, spatially resolved condensation and drying airflow. Drying uses lumped coefficients per item.
8. Capillary rise *dynamics* in gaps and the side walls of fork tines; wrap-around flow on wires beyond a one-dimensional closure.
9. Flow through perforations (colander, sieve, basket lattice) beyond a porosity.
10. Long-term stochastic migration of rattling light items; only the first 6 revolutions per hydraulic key are simulated.
11. The unexplained "energy carry-over" of ceiling rebound that made measured downfall speeds exceed CFD (jets §9.1).
12. Item deformation, chipping, glass corrosion, multi-cycle filming.
13. Film temperature and composition transients at the scale of a single jet pass (they are quasi-steady on a 4 mm grid).
14. Cross-machine bitwise equality.

---

## 14. Risks, unknowns and first prototypes

| # | Risk | Why it matters | Mitigation |
|---|---|---|---|
| 1 | The real film kernel is slower than 1.0 G cell-steps/s | stage D is 60 % of the budget | closes as specified down to 0.8 G/s; 12-window variant down to about 0.7 G/s; below that, all H-class items at 2 mm. Prototype 1 |
| 2 | Analytic two-level ray queries are slower or less robust in f32 than assumed | every stage depends on them | triangle BVH with analytic polish is measured and is the fallback behind the same interface. Prototype 2 |
| 3 | The analytic fan on curved, folded, pre-wetted, grazing geometry is wrong in ways that matter (jets "known gaps" 3, 4, 5) | it decides the stripes | validity bound hands over early; reference comparison of the fan against a 0.25 mm film-solver resolution of the same event; offline resolved simulations for sweep, wire, rim and vessel. Prototype 2 |
| 4 | Two transient + one steady revolution per window is not enough (pools, wandering rivulets, incommensurate mid and top arms) | biased records | convergence monitors; N_st = 2 from the reserve; six segments re-sample. Prototype 3 |
| 5 | MAP patches and seams (cutlery, handles) are fragile or inaccurate | cutlery is 47 % of items | cutlery soils are thin and the checklist expects cutlery clean (P44); generator-level quality gates (skew under 15°, aspect under 2); per-item film smoke test on import |
| 6 | Closure constants dominate and are unidentifiable | scores are not predictive until calibrated | every closure is a table behind one function; global sensitivity run in the fast tier before the test campaign is designed (numerics §8 risk 6) |
| 7 | The forward-Euler, first-order-in-time film step is too diffusive for pulses | drainage timing | SSP-RK2 switch; the reference tier quantifies it |
| 8 | Per-item local stepping is defeated by loads where every item is jet-active most of the time (dense small items) | cost | schedule is known before the window, so the cost is known before the run; level lint |
| 9 | 30-minute sustained throughput is worse than the 7-minute measurement | p95 | 0.9 factor included; 20 consecutive official runs as an acceptance test |
| 10 | Memory pressure on an 18 GB machine in ordinary use | swap, stalls | 1.3 to 1.8 GB planned against a 2.5 GB cap |
| 11 | The programme march couples hydrodynamics to soil state, so hydrodynamic results cannot be cached across programmes | re-scoring cost | jet-stage results (geometry only) are cached by (poses, hydraulic key); whole reports are cached by the benchmark key |
| 12 | Level designers want items outside the nine shape classes | authoring cost | a MAP import path from quad-dominant meshes; accepted as a limit of the approach |

**First three prototypes.**

1. **Film kernel on a ragged REV atlas (two weeks).** WGSL kernel of section 6.2 on a synthetic atlas of 4.4 M cells (plates, cups and glasses in rack poses), tile lists, per-item levels. Measures cell-steps/s (official-B at 2 G/s or better; official-A from 0.8 G/s; 12-window variant from about 0.7 G/s; coarser grid rule below that), bitwise repeatability, and the film tests of section 13.1 that need no other module: Nusselt, lake at rest in a tilted bowl, Jeffreys, pole and band crossing, grid rotation. Retires risks 1 and 7 and the polar-cap question.
2. **Analytic geometry and the fan (two weeks).** Frustum, capsule and instance-cylinder queries in WGSL against an f64 reference on a 140-item rack scene: leaks, accuracy, queries per second against the measured triangle BVH on the same scene. Then the phase-domain trace of the DU750 lower arm onto leaning plates and into an inverted mug: reproduce the thesis hit counts and impact times; gather JX at 0.5 mm; compare one grazing stripe and one cup-interior event against the same event resolved by the prototype-1 solver at 0.25 mm. Retires risks 2 and 3.
3. **One plate, one cup, one programme (three weeks).** Vertical slice: one sweeping nozzle, ring emitter, film, gutters and drips onto a cup below, parcels, 12-layer egg-yolk soil, lumped chemistry, the six-segment march. Measures how many revolutions the windows need, the conservation ledgers, the homogenisation audit, fast versus official versus reference agreement, and compares removal curves with the four in-machine egg-yolk cases (0.85 to 4.66 % per minute, soils R6). Retires risks 4 and 11 and gives the first end-to-end cost.

---

## 15. Considered and rejected

| Alternative | Why rejected |
|---|---|
| **Finite volume on an isotropic triangle mesh** (numerics §5.3 recommendation) | Measured 1.2 to 1.6 G updates/s for a trivial 3-neighbour stencil with 16 B cells; a real film kernel must also read areas, edge normals, hinge rotations, gravity projections and curvature per triangle, about 100 to 136 B per update (numerics §7.2), which is bandwidth-bound near 0.7 G/s before arithmetic. It needs offline remeshing with quality gates (numerics §8 risk 8), 9 M triangles in a BVH, and gives faceted grazing hits. Its one clear advantage is generality of shape; the catalogue does not need it. |
| **Atlas from automatic UV unwrapping** | The numerics dossier's objection (sliver charts, seam bookkeeping) is right for this. Charts here come from the generator. |
| **Sampled signed-distance fields for ray queries** | Cannot hold 1 mm walls below 0.25 mm voxels (numerics §5.2). Sphere tracing was measured fast (up to 2.6 G rays/s) but the geometry it would trace is wrong. Exact closed-form primitives are used instead; sphere tracing of *analytic* distance functions was also considered and dropped because closed-form intersection is cheaper and exact at grazing incidence. |
| **Resolving the radial film in the film solver** (hand over at r_b, films §4.3) | Would capture curvature, edges and sweeping natively, but needs 60 to 125 µs steps on jet-active items and cannot hold a grazing stripe a few diameters wide on a 1 to 2 mm grid. Kept as the graceful fallback where the fan is invalid. |
| **Block-level local time stepping with flux registers** | Saves about 16 % because ordinary wet film, not the fast blocks, dominates; needs parity bits and edge registers. Per-item stepping is exactly conservative for free. |
| **Halo rows between bands** | 8 to 32 % extra memory traffic per sub-step on plates; ragged-row index shifts cost nothing. |
| **Cartesian cap or cubed-disc mapping at the poles** | Removes the pole cell at the price of a large non-conforming seam or a non-orthogonal metric everywhere. The pole cell measured under 0.5 % error. |
| **Film energy and scalar transport in the fast loop** (films §4.2 eqs. 5, 6) | Doubles the state read per cell-step for fields that relax in centimetres and seconds. Solved quasi-steadily at 4 mm instead. What is lost is item 13 of section 13.4. |
| **Exposure tables per hydraulic state with temperature interpolation and refresh rules** (numerics §4.5) | More records in memory at once, spin-up revolutions discarded, drifts handled by interpolation. The programme march uses every simulated second and handles drifts in order. What is lost is caching of hydrodynamics across programmes (risk 11). |
| **Projective or cycle-jump integration of the soil** (numerics §4.3 level 2) | Not needed: the soil kernel affords the dossier's own 1 s step for the whole programme. Removes two tuning constants and the consistency controller. |
| **Twelve shear and eight pressure exceedance levels** (numerics §4.2) | The soil laws consume four thresholds at most and no pressure curve. |
| **Float accumulation by compare-exchange; additive blending through the render pipeline** | First measured non-reproducible; second unmeasured for determinism. Integer atomics and gathers only. |
| **f16 storage for h and q** | Would double throughput (measured 7.5 to 8.2 G/s) but 11 bits cannot keep a lake at rest or conserve mass. Used for statistics only. |
| **Run-time resolved 3D patches** (numerics §7.1 option c) | 50 to 800 s per simulated second per patch for effects (pool stirring) that are below the closure uncertainty and would make cost load-dependent. Resolved simulation is kept offline, to build the wire, rim, vessel and sweep tables. |
| **Fully resolved 3D** | Decided against by the brief. |
| **Quality adapted to wall-clock or to the load** | Forbidden by the brief; also unfair between players. Replaced by fixed tiers, level lint and an exact pre-run work count. |
| **Uniform 0.5 mm film on plastics** | 8 x the cost per area; at the planned rate a plastics-heavy load would not fit. Becomes possible only above about 2.5 G cell-steps/s; the reference tier uses it. |

---

## Appendix A. Where the dossiers disagree, and the side taken

| # | Topic | The disagreement | Resolution here and reason |
|---|---|---|---|
| 1 | Where film and soil state lives | numerics §5.3 recommends finite volume on an isotropic triangle mesh and calls an atlas a poor fit ("hundreds of sliver charts"); films §10.5 and §12.6 recommend quadrilateral cells in a per-item atlas; items §9 and §13 assume a surface-element atlas generated from the profile | Atlas, generated from the parametrisation. The numerics objection applies to atlases unwrapped from arbitrary meshes, not to charts that follow the item generator. Measured stand-ins: 4.0 G/s structured against 1.2 to 1.6 G/s unstructured before any geometry is read |
| 2 | Geometry for parcel queries | numerics §5.1, §5.2: exact triangles in a BVH, signed-distance fields only as an auxiliary; items §1 and §12: "exact analytic signed-distance field" | Neither sampled distance fields (numerics is right that they cannot hold 1 mm walls) nor triangles: closed-form frusta and capsules. Triangles are the measured fallback |
| 3 | Nozzle coefficients | jets §2.2, §11.3: C_d = 0.70 (0.60 to 0.90), C_v = 0.97; machine §3.2, §3.3: C_d = 0.85 round, 0.78 slot, 0.80 underside, C_v = 1.0 | The machine dossier's per-nozzle C_d, because its pump curve, branch losses and flows were built together with them; the jets dossier's C_v = 0.97, because a real orifice does not convert all head (jet speed 8.11 instead of 8.36 m/s at 34.9 kPa). Both are first-rank calibration items in both dossiers |
| 4 | Phase and ray sampling | jets §11.2: 0.25° steps and 7 sub-rays; machine §12.3: 360 to 720 angular steps; numerics §4.2: 4096 phases and 64 rays | 8192 phases, 37 rays. The machine dossier's 0.5 to 1° is too coarse: at grazing incidence the footprint moves 1/tan φ times faster than the nozzle (jets eq. 2.5). Rays measure clipping, not coverage, so 64 is more than needed |
| 5 | Splashed mass ratio of droplets | numerics (recommended model, item 3) adopts the Bai-Gosman 0.2 + 0.6 r and 0.2 + 0.9 r; jets §6.4 recommends clamp(0.1 (We/We_c - 1), 0, 0.3) | jets. Its value rests on measurements with millimetre water drops (under 14 % splashed); the Bai-Gosman ratios were fitted to fuel droplets of tens of micrometres |
| 6 | Film separation at edges | numerics (recommended model, item 6): Owen-Ryley curvature separation plus O'Rourke-Amsden at sharp rims; films §6.2 shows the latter never triggers below about 5.8 m/s and the former reduces to We > 5/6 at any radius; jets §7.3: M > 2γ | films §12.5: We_c = max(2, C_tp (r_e/h)(1 + cos θ_a)). It contains the jets criterion as its floor and the measured dependence on edge radius and wettability |
| 7 | Laminar to turbulent switch of the film friction law | numerics: "film Reynolds number about 400"; films §3.3: branches cross at Re = 4Γ/μ = 1608 | The same number in two definitions (Γ/μ = 400). The films form f = max(24/Re, 0.288 Re^-0.40) with Re = 4 abs(q)/ν is used and the definition is stated |
| 8 | Exposure statistics | numerics §4.2: 12 shear and 8 pressure exceedance levels plus a hit list; jets §11.2: four shear thresholds, momentum flux, integrals; soils §7.3: events (peak shear, momentum flux, dwell) and film means; films §12.9: wet fractions and shear percentiles | Two records (section 7.4): a film record and a jet record with four shear and four momentum-flux levels and peaks. No soil law in the soils dossier consumes a pressure exceedance curve, so the numerics pressure levels are dropped to a peak |
| 9 | Advancing the soil over the cycle | numerics §4.3: first-order averaging plus projective jumps of 1 to 30 s with a consistency controller; soils §7.8: 1 s implicit steps; chemistry §10.13: 1 to 5 s | Fixed 1 s (2 s late in holds) for everything, no jumps. The measured throughput makes the jump machinery unnecessary |
| 10 | Revolutions simulated | numerics §4.2: 3 spin-up + 2 averaging per hydraulic state at three temperatures; films §12.6: 2 warm-up + 1 to 2 measured per cycle phase; jets §11.2 step 7: average stochastic elements over 4 to 8 revolutions | 2 transient + 1 steady per window, 14 windows; the transient is used with its true weight, and each arm state is re-sampled in six segments (6 steady and 12 transient revolutions over the programme) |
| 11 | Film temperature and composition | films §4.2 transports T_f and c_k in the film solver; chemistry §10.2 relaxes film composition locally with the renewal flux | chemistry's formulation, plus quasi-steady fields on the mean flow at 4 mm. Costs item 13 of section 13.4 |
| 12 | Film and soil grid spacing | numerics §5.3: 0.75 to 1.0 mm on food-contact faces, 2 to 3 mm elsewhere; films §12.6: 2 mm, 1 mm, 0.5 mm by wetting class; standards §10.5: at most 2 mm, or sub-element coverage; items §9: about 2 mm | Film 2 mm or 1 mm by item class; soil and jet exposure 0.5 mm with a coverage fraction. The films dossier's 0.5 mm on rivulet-prone materials does not fit the budget at the planned kernel rate and is deferred to official-B and the reference tier |
| 13 | Surface tension | jets §4.5: pure-water value for jets, splatter and the radial film; films §12.8: 40 to 60 mN/m liquor values | Not a contradiction: surfaces milliseconds old use the water value, slow films use the liquor value. The two meet at the fan limit, which is where this design hands over |
| 14 | Wet-wall thresholds | jets §11.3: 20 µm for the droplet impact regime; numerics §2.1 quotes OpenFOAM's 1e-4 and 5e-4 m; films §12.4: 2 µm for the wet flag | Different purposes; 20 µm selects the impact regime, 2 µm sets the film wet flag |
| 15 | Jet force on items | jets §11.2: normal force plus a tangential coefficient c_t = 0.2; items §4.3: turning factor 1 - cos θ_turn up to 2 for concave capture | Momentum theorem on the fan (section 9.3): both limits follow from where the fast film leaves the item |
| 16 | Gap that counts as nested | machine §9 (F8): below about 3 mm; standards P04: below twice the capillary length, 3.6 to 5.4 mm | 2 l_c of the current liquor, because the hold-up is capillary and changes with rinse aid |
| 17 | Detergent dose | machine §12.1: 20 g; chemistry §10.12 regression timelines: 14.5 g in 3.5 L | An input, not a model choice; the chemistry regression tests use 14.5 g. Flagged as an open point |
| 18 | Throughput | numerics §7.2 planned 50 M queries/s, 150 M film cell-steps/s, 300 M soil node-updates/s; films §12.6 assumed 1e9 cell-updates/s | Superseded by the measurements; this proposal plans 60 M, 1.0 G and 0.25 G texel-steps/s (3 G layer-updates/s) with the deratings of section 11.1 |
| 19 | Platform | numerics §6.1 recommends a native application rather than a browser | Superseded by decision 2 of the brief (Node with Dawn, browser-capable) |

## Appendix B. Throwaway checks run for this proposal

The scripts of this table were working files and are not in the repository.

| Script | What it checks | Result |
|---|---|---|
| `scratch-A/bw_fan.py` | re-evaluation of the radial-film closed forms, jump radius, front travel time, lead distance and per-pass shear impulse for the 2 mm, 8 m/s, 50 °C jet; film time-step limits | reproduces the tables of jets §4.4 and §4.9 (R_j 41.3 mm; T(R_j) 22.1 ms; impulse 4.35, 4.28, 3.77, 3.11, 1.65, 0.45 Pa s) |
| `scratch-A/polar_test.py` | finite volume on the ragged-row polar grid with one pole cell: kinematic film across a tilted disc | mass balance to 1e-12; thickness error 0.25 to 0.5 % mean, 1 to 2 % maximum; pole cell -0.1 to -0.2 % |
| `scratch-A/budget.py` | element counts, memory and stage seconds for the tiers and load cases of section 11 | the numbers quoted in sections 3.7 and 11 |

