# Spotless platform design

This document fixes the platform that surrounds the wash simulation: repository layout, conventions,
the geometry kernel, the rigid-body loading layer, the session/action layer, the server, the human
client and the agent interface. The wash simulation itself is specified in `sim-core.md`.

Evidence behind the choices is in `docs/research/` (dossiers) and the two hardware spikes
(GPU compute through Node + Dawn; rigid-body engine bake-off).

## 1. Decisions

| Area | Decision | Why |
|---|---|---|
| Language | TypeScript (ESM, strict) everywhere; WGSL for GPU kernels | One language for server, client and tools; WGSL runs in Node (Dawn) and browsers |
| Runtime | Node 20+. GPU compute via the `webgpu` npm package (Dawn) | Measured on the target M3 Pro: 4 G cell-updates/s, bit-reproducible run to run |
| Authority | One server-side session owns the scene. Human client and agent API call the same reducers | Information and physics parity between humans and LLMs; replayable action logs |
| Rigid bodies | Jolt Physics (WASM build, `jolt-physics`), tuned preset with CCD | Bake-off winner on plates-in-rack, nested bowls, cutlery, tunnelling, determinism and speed |
| Geometry | Every item is a rigid compound of analytic primitives generated from parametric definitions; render mesh, collision pieces, signed distance, mass properties and simulation surfaces all derive from that one description | Single source of truth; exact thin walls; no mesh decomposition artefacts |
| Human UI | Browser client, Three.js, Vite | Fast iteration; verifiable in Chrome |
| Agent UI | HTTP JSON API + MCP server (stdio and streamable HTTP) with images and structured state | What evaluation frameworks consume |
| Agent images | Rendered by the same Three.js scene code in headless Chrome | Pixel parity with what humans see |
| Tests | Vitest; every package has unit tests; physics and simulation have analytic-reference tests | |
| Package manager | pnpm workspaces; internal packages are consumed as TypeScript source (no build step) | |

## 2. Conventions (binding on every package)

**Units.** SI internally: metres, kilograms, seconds, radians, newtons, pascals, degrees Celsius for
temperatures. Catalogue data files are authored in mm, g and degrees for readability and converted on
load. The wire API uses millimetres and degrees. Never mix: a value's unit is part of its name when it
is not SI (`diameterMm`, `yawDeg`).

**Gravity.** Standard gravity, 9.80665 m/s2 along -z of the tub frame (`STANDARD_GRAVITY` in
`@spotless/core`), in the loading physics (`LOADING_GRAVITY`) and in the wash simulation alike, so
that an item weighs the same while it is loaded and while it is washed.

**Frames.** All right-handed, z up.
- Tub frame `T`: origin on the lower spray-arm axis at tub-floor level; +x to the right as seen facing
  the open machine, +y towards the back, +z up. The door is at negative y.
- Rack frames (`lower_rack`, `upper_rack`, `third_rack`, `cutlery_basket`): origin at the rack's
  front-left corner at the top surface of the base grid; axes parallel to `T` when the rack is pushed in.
- Item frame: z = 0 is the plane the item rests on when upright; for shells of revolution the axis is +z
  through the origin.

**Math types.** `Vec3 = [x, y, z]`, `Quat = [x, y, z, w]` (unit), `Pose = { p: Vec3, q: Quat }` maps
item-frame points to the parent frame: `x_parent = p + rotate(q, x_item)`. On the wire quaternions are
named `quat_wxyz` and ordered (w, x, y, z); conversion happens only at the API boundary.

**Quantisation.** Player inputs are quantised before they reach the engine: positions to 1 mm, angles
to 1 degree, raw quaternions to 1e-4 per component then renormalised. Humans and agents get the same
quanta.

**Determinism.**
1. Fixed physics step and a fixed number of steps per action; nothing depends on wall-clock time.
2. Bodies are created in canonical order (sorted by id); removal and re-insertion preserve it.
3. Randomness comes only from the counter-based generator in `@spotless/core` keyed by
   `(seed, stream, index...)`; the same function exists in WGSL with identical results.
4. No iteration over unordered collections where order affects results (sort keys first).
5. After every state-changing action the session records a state hash; replaying an action log must
   reproduce every hash.

**Identifiers.** Item instance ids are stable strings unique within a level (`plate_03`). Item types,
materials, soils, machines and programmes are referenced by catalogue id.

**Errors.** Player-facing failures are values (`{ accepted: false, reason }`), never exceptions.
Exceptions are for programmer errors and infrastructure failures.

## 3. Repository layout

```
packages/
  core/        math, units, counter-based RNG (TS + WGSL source), sha256, canonical JSON, quantisation
  geometry/    primitives, parametric item expansion, render mesh, collision pieces, SDF, mass properties
  machine/     machine specification types, the SPOT-60 baseline and its programmes, rack/arm/tub/door
               geometry generation, slot affordances, spray-arm and nozzle kinematics
  catalogue/   data: materials, friction pairs, item types, soil ids and descriptions, detergents
  physics/     Jolt world wrapper: deterministic stepping, settle, queries, snapshots, rack/arm/door mechanics
  levels/      level format and validation, the level card (its wire types are declared here and
               re-exported by session), rack options, the five hand-written starter levels
  session/     scene state, reducers (place/remove/reset/set_rack/start_cycle), queries
               (preview/list_slots/check_load/get_report), budgets, action log, state hash, replay,
               the wash manifest and the wash-runner hand-over
  render/      Three.js scene builder shared by the web client and the headless render service
  sim-*/       wash simulation packages (see sim-core.md)
  inspector/   end-of-cycle evaluation: per-item speck count, soiled area, score, retained water
  wash-runner/ the real wash inside the game: load manifest -> simulation input -> wash() at a
               tier -> wash report and residue maps (section 7.3)
  server/      spotless-simd: HTTP + WebSocket API, wash job queue, result cache, the render
               service's hook, player identity and episode records, CLI
  mcp/         MCP server exposing the API as tools, bound to one episode (stdio, streamable HTTP)
  bench/       the benchmark harness: episodes of scripted policies and models through the MCP
               tools, verification by replay, episode records, the results table (section 7.4)
  loader/      scripted loading policies (careful, careless, random) that play through the session,
               the owner's load placed by hand, the saved standard loads with their pictures, and
               the scripts that generate, replay and check them (section 6.1)
  integration/ end-to-end tests of the loading chain (catalogue -> geometry -> physics) on a stand-in
               rack, with scripts that dump a scene to OBJ and measure step times; nothing depends on it
apps/
  web/         human 3D client (Vite + Three.js)
docs/
  research/    sourced dossiers (evidence base for every parameter)
  design/      this document and sim-core.md
  benchmark/   how to run an agent, collect a human baseline, what is recorded, the parity table
```

Package dependency direction (no cycles): `core` <- `geometry` <- (`machine`, `catalogue`) <- `physics`
<- `session` <- `server` <- `mcp` <- `bench` (which also takes the loading policies of `loader`);
`levels` depends on `catalogue` and `machine` and is used by
`session`; `render` depends on `geometry`, `machine` and `catalogue` (its Node-only entry
`@spotless/render/headless` adds puppeteer-core and Vite, and is what `server` draws with);
`apps/web` depends on `render` and talks to `server` over HTTP/WebSocket; `sim-*` and `inspector`
depend on `core`, `geometry`, `machine` and `catalogue`; `wash-runner` depends on `session` and
`sim-core` and is loaded by `server` in its wash worker process only (the server's own process
takes nothing but types from `@spotless/wash-runner/contract`, which imports no simulation).

## 4. Geometry kernel (`@spotless/geometry`)

### 4.1 Primitives

A shape is a rigid compound of parts; each part is one analytic primitive with a pose in the item frame.

```ts
type Primitive =
  // Thick shell of revolution about +z: all points within t/2 of the revolved mid-surface polyline.
  // Ends are rounded (radius t/2). scaleXY stretches the revolved solid in x and y (oval platters,
  // spoon bowls); 1,1 by default. arc restricts the revolution to [phi0, phi1] radians (corner
  // fillets of box shells, spouts); full turn by default.
  | { kind: 'sor'; profile: { r: number; z: number; t: number }[]; scaleXY?: [number, number]; arc?: [number, number] }
  // Swept sphere between a and b (a === b gives a sphere). Wires, tines, handles, stems, chopsticks.
  | { kind: 'capsule'; a: Vec3; b: Vec3; radius: number }
  // Box with rounded edges: Minkowski sum of a box of the given half extents and a sphere.
  | { kind: 'rbox'; halfExtents: Vec3; radius: number }
  // Rounded convex hull of a few points. Odd convex bits (knife blades, fork necks).
  | { kind: 'hull'; points: Vec3[]; radius: number };

interface Part {
  id: string;            // unique within the shape, e.g. 'body', 'handle.2'
  prim: Primitive;
  pose: Pose;            // part frame -> item frame
  material: string;      // catalogue material id
  porosity?: number;     // open-area fraction in [0, 1): 0 solid (default); >0 lets water through
                         // (colanders, sieves) and leaves (1 - porosity) of the solid's mass
}

interface SurfaceRegion {
  id: string;            // 'well', 'rim', 'interior', 'exterior', 'foot', 'handle', ...
  part: string;          // Part id, or a prefix ending in '*'
  // For 'sor' parts: which side of the mid-surface and which stretch of the profile, by normalised
  // arc length from the axis end (0) to the rim end (1). 'in' is the side the profile's left normal
  // points to when walking from the axis outward (the food side of a plate or bowl).
  side?: 'in' | 'out' | 'both';
  sRange?: [number, number];
}

interface Shape { parts: Part[]; regions: SurfaceRegion[] }
```

Region rules, applied by every derived product:
- A patch of surface belongs to the first region in `regions` that selects it, so the order of the
  regions is a priority.
- Several regions may share an id (one per part or per stretch of a profile); their patches together
  are the region of that id.
- For `rbox` and `hull` parts, `'in'` is the surface whose outward normal has a positive component
  along the part frame's +z axis and `'out'` the surface where it is negative (top and underside of a
  slab, inside and outside of a box-shell floor); surface whose normal is perpendicular to z is on
  neither side and belongs only to regions whose side is `'both'`. Capsules have no sides.

### 4.2 Derived products (all pure functions of `Shape`)

```ts
buildRenderMesh(shape, { chordError }): RenderMesh       // positions, normals, indices, per-triangle part and region index
buildCollisionPieces(shape, { chordError, roundSurfaces? }): CollisionPiece[]
   // sor -> rounded convex quads (4 points, radius t/2) per profile segment x angular sector, a flat
   //        floor disc as one rounded hull, plus the round rolling surfaces described below;
   // capsule -> capsule; rbox -> box with convex radius; hull -> rounded hull
computeMassProperties(shape, densityOf): { mass, com: Vec3, inertia: Mat3 }   // about the centre of mass, item axes;
                                                          // a part counts with density x (1 - porosity)
signedDistance(shape, p): number                          // union = min over parts; see below for exactness
signedDistanceGradient(shape, p): Vec3
boundingBox(shape, pose?): { min: Vec3, max: Vec3 }
surfaceArea(shape, regionId?): number
```

`signedDistance` is exact outside the shape for capsule, rbox, hull and unscaled full-turn sor parts.
For stretched (`scaleXY`) or partial (`arc`) shells, and inside the solid next to a concave crease or
where parts overlap, its sign is exact and its magnitude a lower bound of the true distance, so the
value is always safe to step by.

Angular sector count for a shell of revolution of maximum radius R at chord error e:
`N = max(minSectors, ceil(pi / acos(1 - e / R)))`. Collision uses e = 0.5 mm, rendering 0.1 mm. For
collision pieces the rule is used as written: the pieces of a wall of constant thickness are within e
of the surface (1.5 e where the thickness tapers, which is cut into rows of constant radius). The
render mesh evaluates the rule at e / 2, because a rim curves both around the axis and along the
profile and the two sagittas add; every point of every render facet is then within e of the surface.

**Round rolling surfaces.** A faceted wall cannot roll: it rocks from facet to facet and stops on one.
For every stretch of the outside of an unscaled full-turn shell that faces mostly outwards (radial
part of the normal at least 0.5), `buildCollisionPieces` therefore also emits a piece of kind
`'round'`: an exact frustum `{ a, b, radiusA, radiusB, wallThickness }` on the axis of the shell
(curved stretches are cut into chords within 0.05 mm that turn by at most 45 degrees). A round piece
is a surface, not a solid. Whoever consumes the pieces must treat it so: the physics world lets it
act only for a dynamic body against a static or kinematic one (a glass on a rack or on the tub
floor), only for hits on its side within its wall, and leaves it out of `penetration`, `sweep` and
contact reports; `collisionSolids(pieces)` returns the pieces without the round ones for consumers
that want solids only. Item against item still meets on the facets. `roundSurfaces: false` leaves
them out at the source.

`materialVolume(shape)` is the volume of material (perforations taken out); `shapeVolume(shape)` the
volume of the solid primitives. Parts of one item may overlap, and where they do the overlap is
counted twice in volume and mass; the catalogue measures this per item (`countedTwice`) and keeps it
under 3 % of the mass except for a pinned list of items.

### 4.3 Parametric item definitions

Catalogue item types carry a `geometry` definition in one of these classes, written in authoring
units (millimetres and degrees, unit-suffixed field names: the `GeometryDefMm` types);
`expandGeometryMm(def)` returns the `Shape`, which is always SI. The same classes exist in SI
(`GeometryDef`, expanded by `expandGeometry`) for geometry that is built in code, such as the machine's.

| class | parameters | examples |
|---|---|---|
| `sor` | profile, optional foot ring, add-ons (`handle_loop`, `handle_bar`, `stem_foot`, `knob`, `base_disc`, `spout`) | plates, bowls, mugs, glasses, pans, jugs |
| `box_shell` | length, width, height, wall thickness, corner radius, flange, optional wall draft, optional lid lip | oven dishes, trays, food containers |
| `slab` | length, width, thickness, edge radius, optional corner cuts (the plan outline with corners cut off at 45 degrees) | chopping boards, flat lids, sheet-metal pieces |
| `rod` | centreline polyline with per-node section (width, thickness) and a head (`spoon_bowl`, `fork_tines`, `blade`, `none`) | cutlery, utensils, chopsticks |
| `wire` | list of polylines with radius | whisks, cooling racks |
| `compound` | list of sub-definitions with poses; optional region renames | muffin tin, lunch box with lid |

A `stem_foot` closes the bowl down to the axis and joins it to the stem; the stem must reach the
underside of the bowl and a foot ring must end inside the wall it stands under, or expansion throws.
The catalogue checks every item for parts that touch nothing else of the item (`looseParts`).

Part and region ids of a compound's children are prefixed with the child's id (`cup_03.interior`).
`regionRenames` (`{ from, to }` rules, `*` for any run of characters, first match wins) then names the
regions of the whole item, which is how a region spans children (`cup_*.interior` -> `cavities`).

### 4.4 Machine geometry (`@spotless/machine`)

Racks, cutlery baskets, spray arms, the tub and the door are built from the same primitives by
`buildMachineGeometry(machineSpec, config)`, where `config` holds the player-adjustable options
(upper-rack height, folded tine rows). It returns named static or kinematic shapes with their frames,
plus affordances (tine rows, slot centres, cup shelves) for `list_slots`, spray-arm swept volumes and
the dispenser lid's swept volume. Wires are capsule chains: one capsule per straight run, 3 to 5 short
capsules per bend. The machine specification (`MachineSpec`) is data: every dimension, the per-nozzle
table (position, direction angles, shape, size, discharge coefficient), pump curve, branch losses,
diverter states, filters, heater, dosing and the programme tables, following
`docs/research/machine.md` section 12. Nozzle kinematics (`nozzleState(spec, arm, nozzle, armAngle,
armSpeed, jetSpeed)`) follow section 12.2 item 3 of that dossier.

What the loading physics consumes from it: racks, and whatever is fixed to a rack, as collision
pieces to be added as kinematic bodies; each spray arm as collision pieces in the arm frame with its
pose at the reference angle and its hinge (a point and an axis in the arm frame); the dispenser lid
either as the volume it sweeps or as the closed lid with its hinge and opening angle.

**The cutlery basket is a loose part.** `MachineConfig.cutleryBasket` is where it stands (a basket
id, the centre of its body in that basket's rack frame, its long axis) or null when it is taken
out; the geometry, the cells and the wash manifest's `machine_config` follow it. The specification
names the positions a player is offered (`CutleryBasketSpec.positions`, the default first): for the
Bosch `front_centre` (the photographs of the empty machine), `front_right` (where the owner stands
it when he loads: 110 mm right of the centre line, +-12, measured in his photograph of 2026-10-10)
and `front_left` (its mirror image, not photographed). `cutleryBasketPositions(spec, config)` lists
those that fit with the rows as they are, `withCutleryBasketAt(spec, config, id | null)` sets one,
`cutleryBasketPositionId` reads it back. Any other placement is as good if
`validateMachineConfig` accepts it: the basket must stand inside the rim of its host basket
(`config_cutlery_basket_outside`) and every rail and tine under it must pass through one of its
tunnels (`config_cutlery_basket_on_tines`), a folded row counting with its tines lying down. On the
Bosch that lets it slide from wall to wall along the two side-row rail lines, which are as far
apart as its tunnels, and stand astride the two rear rows; it cannot be turned at the front.

**Its shape** (`geometry/cutlery.ts`, read from IMG_9080 and IMG_9081): thin slabs for the walls,
closed for collision, each carrying the open fraction of its lattice as `Part.porosity`, which the
wash scene reads (`BLOCK_FLAG.porous`). The floor of each foot is a slab 6 mm deep, porous the same
way: a handle cannot pass it. Two columns either side of a wall under the handle; along the length
the two thick cross walls stand over the tunnels and a thin divider halves each middle compartment,
so the six compartments are eight cells. The roofs of the tunnels are ridged so that nothing stands
on them, and the rim strip each lid grid hangs on closes the gap between a long wall and its lid.
The carrying handle is two posts 16 mm in from the ends and a bar. `cutleryCells` lists
each cell with `box`, its **free opening**: what is clear from the floor to above everything over
it, which leaves out the strip under the carrying handle and, for the front cells, the 12 mm under
the handle of the lower basket. `interior` is the whole inside. The vertical through the centre of
every opening meets nothing of the machine (`geometry/free-centres.test.ts` checks this for every
affordance in every named configuration with the exact signed distance of the shapes). A piece of
cutlery must be let down by its **lower end**: standing handle down, a ladle's handle is 39 mm from
the middle of its bounding box, and the review's "ladle through the cell floor" was a ladle whose
handle came down outside the basket, between its wall and the lid grid hanging on it.

**Tine slots** carry `blockedBy`: `cutlery_basket` where the cutlery basket stands over the slot,
else null. Blocked slots stay in the list so that slot indices do not depend on the configuration.

**How plates rest in the Bosch's rows** (`geometry/plate-rows.test.ts`, `scripts/plate-rows.ts`;
`src/test-physics.ts` seats a plate by a hand's motion: its edge put down on the rails between two
tines, laid back as far as it goes, let go). The rear tines are 66 mm high at 18.25 mm, leaning 15
degrees, on rails 99 mm apart; their tips reach the underside of a 25 to 27 cm plate 70 to 78 mm
from its centre, at the foot. A plate therefore does not lie back at the angle of the tines: it
lies back until its underside meets the tine behind it. Plates up to 24 mm deep rest leaning with
the row, 4 degrees (the standard dinner plate) to 19 (saucers), one in every gap: thirteen dinner
plates stand in thirteen neighbouring gaps without touching. The 27 cm plates 30 mm deep stand
within 4 degrees of upright. The 40 mm soup plate cannot lie back in the rear rows and tips 13
degrees forward onto the tine in front of it; in the side rows (26 mm pitch) it stands upright and
the others lean 6 to 19 degrees with the row. The owner's photograph of 2026-10-10 is the evidence:
his 27 cm plate stands in the third gap of the rear rows leaning 3 degrees outwards (+-3), not 15,
and the tips of six rear tines fall within 1.6 mm of where this geometry puts them. No photograph
shows a deep plate in a rear gap.

**The floor of the Bosch's upper basket** (`geometry/upper-floor.test.ts`). The floor has eleven
front-back wires, not the dossier's eight: IMG_9083 at full resolution shows one on the centre
line (x = 0 in the arm-axis frame, +-5 mm), running from the tablet tray back over the top of
the centre ridge with the arm's feed tube hung under it in four clips, and two in the raised
strip by the left wall (x = -188 and -205, +-8 mm). Without the centre wire there was an 88 mm
opening over the feed tube, through which the lower edge of a saucer or dessert plate standing
in rows A, B or C came to rest on the tube (23 of 28 slots); now none does. The relief is as
read before (a trough under rows A and B, a ridge on the centre line, a ramp falling to the
right, a second, steep ridge, a trough by the right wall), with the two ridges at 30 and 32 mm
(34 and 36 before): between the first reading by parallax (35 and 41, +-10) and a second from
the front wall wire in the owner's loaded photograph (23 to 31). The ramp falls 13 degrees. So
this floor is not a table: a mug or glass let down mouth down over the centre line stands on
the ridge and the centre wire leaning 18 degrees down the ramp, and over the open floor (a
40 mm grid clear of the shelves and the tablet tray) 50 of 63 mugs end within 25 degrees of
mouth down, the rest falling between the tines of rows A and B or off the steep second ridge.
The mug in the owner's photograph of his loaded upper basket leans too. NOT SETTLED: the height
of the ridges and where the right-hand one is (the two readings differ by 40 mm), which decide
how many vessels stand; a side-on photograph of the empty basket with a ruler would settle it.

**The wall wires of the Bosch's lower basket** are at 92 and 46 mm above the floor (+-10), by
proportion along the front wall between the rim and the feet of the uprights in two photographs
(the loaded photograph and IMG_9080). They were at 105 and 73 mm (+-5) from a camera fit of the
same pixel rows, which made the gap under the lowest wire the largest where both pictures show
it the smallest. A tape reading on the front wall would settle it.

**Measured and not yet applied.** The lower basket's travel is carried as 500 mm (an estimate of
the dossier). Two photographs put it at 425 mm, +-25
(`BOSCH_LOWER_BASKET_TRAVEL_PHOTO_MM`): pulled out, its rear row stands under the front edge of
the upper basket, as the owner's loaded photograph shows. It is not applied because `place` lets
an item down from straight above: with the true travel no plate could be let into the rear rows.
The session needs an insertion at a slant under the upper basket first (section 6).

## 5. Loading physics (`@spotless/physics`)

A thin deterministic wrapper over Jolt.

```ts
interface PhysicsWorld {
  readonly timeStep: number;                        // the fixed step, seconds
  addBody(id: string, pieces: CollisionPiece[], mass: MassProperties, surface: ContactMaterial, pose: Pose, kind: 'dynamic' | 'static' | 'kinematic'): void;
  removeBody(id: string): void;
  setPose(id: string, pose: Pose): void;            // kinematic body: driven there over the next step, carrying its load;
                                                    // dynamic or static body: teleported (wakes neighbours)
  teleport(id: string, pose: Pose): void;           // any body, at once and at rest; a kinematic body leaves its load behind
  getPose(id: string): Pose;
  getVelocity(id: string): { linear: Vec3; angular: Vec3 };
  getKind(id: string): 'dynamic' | 'static' | 'kinematic';
  bodyIds(): string[];                              // sorted
  step(n: number): void;                            // n fixed steps; throws ContactCapacityError (see below)
  settle(opts: SettleOptions): SettleResult;        // step until every body meets the rest criterion or the cap is hit, disturbing
                                                    // what is awake on the way (below); no step at all when nothing is awake;
                                                    // { steps, atRest, time, disturbed, moving, penetrating }: `penetrating` lists
                                                    // the bodies still more than 0.5 mm inside another at the end
  contacts(query?: { bodies?: string[] }): Contact[];   // { a, b, partA, partB, points, normalForceN, maxPenetration, position, normal };
                                                    // optionally only those of the listed bodies
  penetration(pieces: CollisionPiece[], pose: Pose, ignore?: string[]): { depth: number; with: string[] };
  sweep(pieces: CollisionPiece[], from: Pose, to: Pose, ignore?: string[]): { hit: boolean; fraction: number; with?: string };
  applyImpulse(id: string, impulse: Vec3, at?: Vec3): void;   // wakes the body (a zero impulse only wakes it)
  snapshot(): Uint8Array;  restore(s: Uint8Array): void;
  stateHash(): string;                               // sha256 over body ids, poses and velocities (exact bits)
  dispose(): void;
}
```

A world is created with its time step, gravity and pair lookup (`createPhysicsWorld`); the loading
simulation uses `LOADING_TIME_STEP` (1/240 s) and `LOADING_GRAVITY`. Static and kinematic bodies
need no mass: pass `NO_MASS`.

Contact friction and restitution come from a per-pair material table in the catalogue
(`frictionPair(a, b, wet)`, or `contactPairLookup(wet)` for the world), not from per-body
coefficients. The table must be total: when a body brings a material into a world, the world asks for
its pair with every material already there, itself included, with the two ids in sorted order, and
`addBody` throws unless each answer is a finite friction of at least 0 and a restitution from 0 to 1.
A pair may also carry a `rollingResistance` and a `spinResistance`, both lengths in metres (the
rolling resistance coefficient times the radius, and the radius of the contact patch that resists
twisting): a body resting on point or line contacts is slowed in rolling by a torque of that length
times the normal force, and held still on a slope whose tangent is below length / radius. The
catalogue supplies both (`rollingResistanceLength`). Restitution applies above
`RESTITUTION_VELOCITY_THRESHOLD` (0.2 m/s) of approach speed.

**Rest and sleep.** The world owns one criterion of rest, the platform's (below), and applies it
itself: a body is at rest when its velocity, averaged over the last 0.05 s, has stayed under both
speeds for the hold time, and bodies in contact with each other go to sleep together when all of
them are at rest; the engine's own sleeping is off. `settle` reports by the same averaged velocity,
so a world that `settle` calls at rest is one in which everything meets the criterion, and a body
that stalls mid-motion is not put to sleep before it has. A `settle` asked for a stricter criterion
than the world's wakes everything and keeps it awake until that is met.

**The settle of an action.** `settleOptionsFor(timeStep)` gives the options every action uses:
the rest criterion, `SETTLE_BUDGET` (no minimum time, rest looked for after every step, a cap of
10 s) and `SETTLE_DISTURBANCE`. A settle therefore ends at the step in which the last body has met
the criterion, about 0.8 s of simulated time for an item let down into a slot; the 2 s minimum that
every action used to pay was a guard for a rest test that could be fooled and is gone.

The disturbance is what a kitchen does to anything left balancing. Once every awake body that has
not had it has been under the rest speeds for 0.05 s (and at the latest when one of them has met
the whole criterion, so that what lies still does not wait for what rolls), gravity is tilted by
one degree towards +x, +y, -x and -y of the tub in turn, 0.05 s each, and the first of those steps
is solved without the contact forces of the step before, which is what happens to a body that
slept and is woken (the engine keeps no contact forces for a sleeping body). Nothing goes to
sleep on the way, a body only goes to sleep once it has been through it while calm, and rest is
earned again afterwards. The constants are registered (`SETTLE_DISTURBANCE`, [ESTIMATED]) and the
same every time, so a log replays. What stands firmly is where it was afterwards: the four
directions cancel, and one degree for a twentieth of a second moves a free body a fifth of a
millimetre. What would fall at a touch falls during the settle that made it: a chopstick balanced
on its end lies flat, a knife wedged on a corner of its handle against the top of a basket wall
slides the 4 mm it would otherwise slide when its neighbour is next touched. Bodies that sleep
through a settle are not disturbed. `settleOptionsFor(timeStep, false)` leaves the disturbance
out, for measurements; `SettleResult.disturbed` says whether it was applied.

**Shapes in the engine.** A body is a compound of groups, one per collision piece: the flat-faced
solid of a rounded hull or box together with the capsules along its exposed edges, in the
principal frame of the solid. The engine bounds every piece by a box in the piece's own frame and
carries that box into the frame of the other body, so a wall sector of a plate at 45 degrees of
azimuth, given in the item frame, had a box of eight times its volume, and the 0.5 m rail of a
rack seen from a leaning plate had a box larger than the plate. Hence the frames, and hence a
capsule longer than 40 mm goes in as equal lengths end to end (`MAX_CAPSULE_LEAF_LENGTH`, at
most 16 lengths). The rounded end of a length where the next one begins is no part of the
surface: a contact found on it between a wire of a rack or basket and a piece that is still
apart from it is refused. Sub-shape ids are decoded by `leafOfSubShape`; contacts name pieces and
parts as before.

**Contacts ahead of an approach.** The engine makes contacts between pieces that are still apart
(up to 5 mm) so that nothing passes through anything between two steps. The world admits such a
contact only where the two pieces can close the gap within the step and a half to come
(`restingContactDistance`, `speculativeSpeedFactor`), and gives the engine, step by step, only
the distance the fastest two bodies could close (a settling load moves tenths of a millimetre per
step, and the engine no longer tests every piece within 5 mm of another).

Such a contact holds the two pieces to the line between their nearest points for the whole step.
For a wire, a tine or a rounded edge, whose nearest point moves round it as the other piece
passes, that line is wrong: the leading edge of a block that slides towards a wire at the height
of the wires it lies on is stopped as by a wall. Measured before the rule below: a block slid 23
to 29 % less far across the wires than along them at the end stop of the rack profile, and a
block set sliding across wires 10 mm apart at 0.6 m/s stopped after 23 mm where friction of 0.3
allows 61 mm. With `JOLT_SETTINGS.predictRoundContacts` (on), a contact between a round piece and
a piece that would close the gap by its own motion is only made when following the two pieces on
their velocities shows that they will be in each other by more than a resting contact sinks in
(1.25 penetration slops) or meet squarely. The rule is deliberately narrow. It applies only
between a free body and one that is not (rack, basket, tub); not to a body whose velocity changed
by more than nine tenths of what gravity adds in a step in the step before (falling or knocked
about: it keeps every contact the engine offers); and not at all while any free body moves faster
than 0.55 m/s against what stands or against the rack being moved. The reason is what a wrong
guess costs: a piece that is struck in the very step in which it was taken to miss a wire stands
in that wire afterwards. In the densest load tried (cutlery let go 240 mm above a basket that is
already full) one of twelve slightly varied runs still ended in the contact capacity error with
the rule, none of seven without; set `predictRoundContacts: false` to have the engine's own
behaviour.

**Accuracy of the shapes.** What the engine collides is the kernel's collision pieces. A round
wall is a ring of flat sectors, so the true surface stands proud of the pieces by the sagitta of
a sector, R (1 - cos(pi / N)): 0.48 mm for the rim of the 270 mm plate as the kernel divides it,
and up to 0.5 mm by the kernel's rule for the number of sectors. The rounding of edges adds at most
0.1 mm at a fold between two flat pieces (`roundedFoldSag`), 0.05 mm elsewhere
(`roundedEdgeSag`), and a resting contact sinks in by up to the penetration slop, about 0.1 mm.
So a true shape can be up to about 0.75 mm inside another whose pieces report 0.14 mm, where
both are faceted and the facets fall badly: 0.69 and 0.73 mm were observed between glasses
leaning on each other in saved loads, and **0.75 mm is the bound to quote for two round walls**,
not 0.6. The loader now measures every saved load on the true shapes as well (section 6.1,
`deepest_true_overlap_mm`). Where a rim rests
on a wire or leans on a tine, the wire and the tine are exact capsules and only the rim is
faceted: the bound is the sagitta plus the resting contact, under 0.6 mm in the worst case and
0.48 + 0.1 mm for the largest plate. It is under 0.5 mm only if the kernel places the corners of
a sector outside the true circle by half the sagitta (at radius 2 R / (1 + cos(pi / N)), so that
the facets straddle the circle), which halves the error to 0.25 mm; that is a change to
`@spotless/geometry` and is asked of that package, not made here.

**Contact capacity.** The engine holds a fixed number of contact manifolds
(`JOLT_SETTINGS.maxContactConstraints`, 15,360) and silently drops contacts beyond it. The world
keeps the count low (contacts ahead of an approach are admitted only where the pieces can close the
gap within the step) and watches it: a step that would use more than 90 % throws a
`ContactCapacityError { manifolds, capacity, restored }`. When the world was already above a quarter
of the capacity or had just been changed from outside, it took a snapshot before the step and is
back in that state (`restored: true`); otherwise the step has been taken. `stats().peakManifolds`
gives the highest count so far. Measured: a dense load of 144 items peaks at 5,042 (3,743 before
long capsules were cut into lengths, which gives a long edge several contacts where it had one);
twelve dinner plates dropped into a stack at once at 6,527 (was 8,731). Two bodies that end up
deep inside each other hold about a thousand manifolds between them, so a load in which that
happens to a dozen pairs reaches the capacity: see the last paragraph of "Contacts ahead of an
approach".

Mechanics built on the world, used by the session. They use only the `PhysicsWorld` contract and
take the time step from the world:
- **Rest criterion**: linear speed < 5 mm/s and angular speed < 0.05 rad/s continuously for 0.5 s.
- **Stability probe** (`probeStability`): wake the island, perturb by 10 mm/s in four horizontal
  directions in turn, re-simulate 0.5 s each; stable if every item returns within 1 mm and 1 degree.
  The world is left as it was found.
- **Rack travel** (`travelRack`): racks, and whatever is fixed to them, are kinematic bodies
  (`travelRack` throws for a static or dynamic rack body); pushing in
  drives them with the motion profile, which applies the acceleration pulse to their contents. Reports
  the riders that moved relative to the rack, those that left the rack envelope (an axis-aligned box
  in the frame of the first rack body) and what blocked the rack. The dynamics are checked against
  closed forms in `packages/physics/src/travel.test.ts`, on a block of known friction on a level
  grid of wires: carried without slip below mu g; at the end stop it slides
  v^2 (d - mu g) / (2 d mu g) (17.5 mm for mu 0.3 and the profile; measured 16.8 mm on 2, 3, 5 and
  9 wires along the travel and 3 across it, 16.6 mm on 9 across: nothing of the friction is lost
  or added with the number of wires); a dead stop slides v^2 / (2 mu g); the velocity of a driven
  body is what its contacts see ((1 + e) v off a moving wall); restitution is the catalogue's e
  above 0.2 m/s of approach and none below. With the profile as registered (end stop 5 m/s^2),
  everything held by friction below 0.51 slides at the end stop; that is the profile, not the
  engine. An inverted mug on the stand-in rack (friction 0.25), stopped from 0.05, 0.15 and
  0.5 m/s: 0.2, 2.2 and 24.9 mm at 5 m/s^2 (a block: 0.3, 2.3, 26.0) and 0.4, 4.3 and 49.7 mm
  stopped dead (0.5, 4.6, 51.0); it does not tip (`packages/integration/scripts/end-stop.ts`).
- **Arm sweep** (`sweepArm`): each spray arm is turned through 360 degrees about its hinge as a query
  probe and the angle and body of first contact are recorded. The arm is not a body of the world and
  does not push the load: an arm driven by water stops where it first touches something.
- **Dispenser lid** (`sweepLid`): swept-volume test of the lid against the settled load.

## 6. Session and action layer (`@spotless/session`)

The interface follows `docs/research/benchmark.md` section 3 (frames, actions, queries, `DropResult`,
report). Summary:

State-changing actions (count against the action budget; rejected calls are free):
`place(item_id, frame, position_mm, orientation, mode: 'drop' | 'insert' | 'set', insert_dir?)`, `remove(item_id)`,
`reset()`, `set_rack(rack, option)`, `start_cycle(programme?)`.

Queries (free of action budget, counted against a query cap): `get_level()`, `get_item(item_id)`,
`get_state()`, `render(view, options)`, `preview(item_id, frame, position_mm, orientation)`,
`list_slots(rack, item_id?)`, `check_load()`, `get_report()`. `preview` is logged but not counted
against the cap: a rejected `place` returns the same facts free of charge, so a cap on `preview`
bound only the player who asked before acting (and a person moving a ghost about with the mouse used
the whole cap in 90 seconds). [OPEN QUESTION: benchmark.md lists `preview` among the capped queries.]
Once the cycle has started, `preview`, `list_slots` and `check_load` are refused as `episode_over`.

`place` semantics: (1) quantise; (2) reject if the requested pose penetrates anything by more than
0.5 mm; (3) reject if the item cannot reach the pose along a straight line from above the rack (see
"Insertability"; or along `insert_dir` for `insert`); (4) lower along -z to first contact (gap under
1 mm) and release at rest; for `insert`, push along the direction with a 15 N force limit at 0.1 m/s;
(5) let everything come to rest; (6) give what the action touched a light nudge and see whether it
stays (see "Stable"); (7) return `DropResult` with requested, release and settled poses, contacts,
items moved, flags (`fell_through`, `fell_out`, `stable`) and the new state hash.

Nothing predictive of the wash outcome is ever returned by the session.

How the session models the scene (`packages/session/src/session.ts`; every tolerance and speed is
in `SESSION_PARAMETERS`):

- **One world.** `createSession({ level, washRunner? })` builds one loading world: the tub, filter,
  feed duct and roof sprayer static; the door, with the dispenser in it, static and open; each
  basket with its fittings, tablet tray, the cutlery basket and the arm feed as kinematic bodies
  that travel together; a floor in front of the machine. Items are dynamic bodies with friction from
  the catalogue's dry pair table. The spray arms are not bodies: they are swept as probes when the
  load is checked (section 5), since an arm standing still would hold up what in the real machine
  hangs into its path.
- **Baskets are in or out.** `set_rack(rack, { name: 'position', value })` pushes a basket in or
  pulls it out as a rack travel with its contents. A level starts with the lowest basket out and
  the others in unless it says otherwise (`reset` puts the empty baskets back there). The upper
  basket pulled out hangs over the lower one. Which basket carries an item is read from where the
  item lies, never stored: its reference point within the basket's plan (30 mm margin), from 25 mm
  below the base grid to 150 mm above the top of the loading envelope.
- **Basket travel** (`packages/session/src/travel.ts`). A basket is moved by a hand: it is
  accelerated at 1 m/s^2 to 0.35 m/s, slowed again at 1 m/s^2, and meets its end stop at 0.1 m/s,
  where it is stopped within one step (`BASKET_TRAVEL_PROFILES.normal`; the lower basket's 0.5 m
  takes 1.7 s). The reasoning: 1 m/s^2 is a tenth of gravity, below `mu g` for every pair of the
  catalogue's friction table against coated wire but PTFE (0.10, which just slides), so the hand
  moves nothing that stands on its base, in a slot or on a rail; the knock at the stop moves an
  item by `v^2 / (2 mu g)` whatever its friction, 2.0 to 2.5 mm for 0.25 to 0.20, tips what
  balances on a narrow foot and throws what is perched on tine tips or on another item; what a
  tine, a wall or a rail holds does not move at all. Measured through the session
  (`travel.test.ts`, `rows.test.ts`): a glass standing mouth down on the floor of the upper
  basket moves 2.4 mm at every move (closed form 2.55), a mug leaning on a tine 1.9 to 2.9 mm,
  22 dinner plates in the rear rows nothing; a glass perched on the tips of the short tines
  comes off (31 mm), a bowl put down on a mug goes 92 mm, a knife laid flat slides 2.2 mm. The
  three numbers are [ESTIMATED]: no measurement of the owner's push exists (a 240 fps film of
  the basket meeting its stop would settle them). `BASKET_TRAVEL_PROFILES.hard` is the careless
  shove, for studies: the profile registered in the physics package (0.5 m/s, 2 m/s^2, braked
  at 5 m/s^2), which every move used until 2026-10-10 and which slides the same glass 7 to
  23 mm and a mug 12 mm and 10 degrees. `createSession({ travel })` selects it; a log replays
  only with the profile it was made with. The drive is the physics package's `travelRack`
  taken apart (same blocking rule, a list of distances per step instead of its three-number
  profile, no settle at the end): for the hard profile, drive plus that package's settle gives
  the same state hash as `travelRack`.
- **A basket is loaded only while it is pulled out.** `place` into the frame of a basket that is
  pushed in (or of the cutlery basket standing in one) is refused as `not_insertable`, `blocked_by:
  'tub'`, for `drop` and `insert` alike, and `preview` says `insertable: false`. So every loaded
  basket has travelled in with its load, and an unstable placement cannot reach the wash unshaken.
- **Where an item may be asked for.** A basket frame covers the basket's plan; the tub frame reaches
  from wall to wall, from the floor to the roof and out over the open door. Nothing may be asked
  for above the roof of the tub. Anything else is `out_of_bounds`.
- **Insertability.** The item must be able to come to the pose along a straight line from above
  the machine: straight down, or down a slant the way the tines of the basket lean, by their
  lean, by half and by a quarter of it (a plate goes into its slot along the tines; between two
  plates that already lean, along their lean). The first of these that is clear decides. The
  test is against the other basket, the fittings of the basket (shelves, the cutlery basket,
  the tablet tray) and the items. Two things are left out of it for a basket frame. The shell
  of the tub: a pulled-out basket keeps its rear under the roof of the tub, where a hand reaches
  in at a slant. And the wires of the basket itself: the tip of each tine of a leaning row hangs
  over the foot of the next, and a neighbour that has lain back hangs over the straight line
  along the tines, so no straight line reaches a slot between two standing plates, where a hand
  simply steers round the tine. (The aim: realism matters in how things sit, not in
  the placing movements.) The pose itself must be clear of everything, wires and tub included,
  and nothing is put under the floor of a basket from above (reference point more than 25 mm
  below the base grid: `not_insertable`). For the tub frame everything counts, so only what is
  in front of the tub can be reached from above. A contact within 2 mm of the end of the sweep
  is the contact of the pose, not an obstacle. Measured: a sweep that leaves the basket's wires
  out costs 0.1 to 3 ms, with them 3 to 8 ms; an overlap test 0.07 to 0.15 ms.
- **Items that do not end up in the machine.** The kitchen floor is a slab 100 m across, so nothing
  falls past it. After every action, a placed item that touches the kitchen floor (or is more than
  3 m from the tub) is taken out of the world and is back on the counter: the result lists it under
  `returned`, the action is charged, and nothing stays on the floor to be counted as loaded or to
  keep the world awake. An item on the open door stays where it is; the scene state gives every
  placed item a `location` (`lower_rack`, `upper_rack`, `tub_floor`, `outside`). When the cycle
  starts, whatever is `outside` once the baskets are in (and again once the door has closed) is
  taken out before the door closes, named in `prechecks.fell_out` and `left_out`, left out of the
  manifest and reported `loaded: false`.
- **Fallen through.** `fell_through` is true when the item's reference point is more than 25 mm
  below the base grid of the basket, or when the item hangs through the grid (its lowest point more
  than 25 mm below it) and stands on something fixed underneath: a knife standing on the door
  through the floor of the basket. `check_load` lists such an item under `on_tub_floor`.
- **What a drop and a preview say.** An accepted `place` carries `resting`: the height of the
  item's lowest point above the base grid of its frame, `on_base` (within 10 mm of it: the item
  stands on the floor of the basket, not on tine tips or neighbours) and the sum of its contact
  forces over its weight (about 1 at rest, several when wedged). `stable` is the light nudge
  only (see "Stable"): it does not test basket travel, which `check_load` does, and it is
  described so. A `preview` of a pose that is free but cannot be reached from above names
  what is in the way (`blocked_by`, as a refused `place` does) and how far above the pose
  (`blocked_above_mm`).
- **Slot suggestions seat the item.** `list_slots` gives for every slot between tines a
  `suggested_orientation` (the `on_edge` preset turned so that the face looks away from the side
  the tines lean to) and, with `item_id`, a `suggested_drop`: the pose a hand seats that item in.
  The item is held across the rail, midway to the partner row and clear of the walls; its lower
  edge is taken down along the tines into the gap and onto the rails; and it is laid back
  towards the tine behind it as far as it goes without touching anything, at most to the lean
  of the tines. A plate too deep to stand upright in the gap is held tipped forward just enough
  to be clear (down to 30 degrees). The pose is found with overlap tests and put on the grid
  `place` takes, a millimetre or two above where the item touches (on the grid it may overlap
  a wire by up to 0.2 mm; `place` takes 0.5 mm and the settle pushes the item clear); it is
  "seated" when the item gets to within 3 mm of where it would rest on the two rails alone
  (`restOnRails`). `place` with that position and orientation (mode `drop`) accepts it.
  Let go there, the plates of the catalogue come to rest as the machine engineer measured them
  by the same motion in a world with the basket alone
  (`packages/machine/src/geometry/plate-rows.test.ts`): the standard dinner plate 4.2 degrees
  with the tines in the rear rows and 12.7 in the side rows, dessert plates 10.3 and 17.6,
  saucers 18.7, the 27 cm plates within 5 degrees of upright, the 40 mm soup plate upright
  (0 to 3 degrees) in the wide gaps of the side rows and tipped 9 to 14 degrees forward in the
  narrow rear rows. Twenty-two dinner plates stand in the 22 gaps of the rear rows without
  touching, in any order of filling (`rows.test.ts`).
  The answer follows the scene: `drop_free` is the test `place` applies, now. A slot in which
  the lower edge of another item stands is not free and `drop_blocked_by` names the item (the
  two rows of a pair, R1 and R2, list the same seat twice); a slot over which a neighbour leans
  gets a seat laid back less far; a slot the cutlery basket stands over (`TineSlot.blockedBy`)
  is not free and carries no pose. The seat itself is that of the empty machine WITHOUT the
  cutlery basket, which is a loose part and is tested afterwards like an item: where the seated
  item would reach into it (a 27 cm plate in the rear rows behind the basket at the front
  centre: its front edge is at y = 234 to 239 mm, the basket's rear at 238) the slot carries
  the seat and is marked not free, `drop_blocked_by: ['cutlery_basket']`. The item is never
  offered upright or moved along the rails instead. (Until 2026-10-10 the basket took part in
  the search and the lean found beside it was tried in every slot of the kind: with the basket
  at the front centre the 27 cm plate was offered upright in 14 of the 22 rear slots and ended
  15 degrees against the tines, 30 mm high on the basket's foot, or fallen over. Now 11 of the
  22 are free with the basket at the front centre, 13 at the front right, 22 with it out, and
  every free seat ends 4 to 5 degrees off upright; `seats.test.ts`, `scripts/row-seats.ts`.)
  An item that stands taller on edge than the height clear over the whole basket has no seat
  there and its slots are not free, blocked by `tub` (a 27 cm plate in the upper basket, which
  could be let down into the pulled-out basket and never pushed in). In a basket that is
  pushed in every seat is listed not free, blocked by `tub`, without a search. `drop_seats` is false, and `drop_perches` true, for an item
  that does not come down between the tines at all (a bowl over a narrow row, more than three
  clear widths deep): its pose is upright above the tine tips, where it perches. An item
  without an `on_edge` preset gets no advice about slots between tines (a cup, a mug or a
  glass has its own seats on the side rests, below). Each slot says which way its tines lean
  (`lean_toward`); a row whose halves lean opposite ways (R1, R2) is `mixed`. `plate_normal` is
  the plane of the tines and is described as that, not as how a plate ends up.
  Cost: the seats of a type of item in the empty machine are found once per PROCESS for each
  machine, configuration and position of the baskets (`SEATS_BY_MACHINE`: a seat is a function
  of those alone, so every later session, and the server keeps many, reads it from there).
  The first search of the lower basket takes 0.5 to 0.6 s for a plate (about 100 overlap tests
  per slot) and up to 2 s for the rows of the upper basket, where a dessert plate or a bowl
  finds no seat and every lean is tried (about 1000 tests per slot); after that a `list_slots`
  with an item takes a few milliseconds on an empty machine and 50 to 110 ms with a dozen
  plates in the basket. Before 2026-10-10 evening a pushed-in upper basket cost 23 to 48 s per
  call (a fitting search per slot that could not succeed) and a 27 cm plate 11 s.
  Where the floor of a basket is not level (the upper basket of the Bosch: a ramp under row C
  with a ridge between it and its partner row; IMG_9131) a plate does not come to rest on the
  two rails of row C: midway between them it stands on the ridge, 31 mm above both. When the
  search on the rails finds nothing, the item is tried on the floor beside the rails instead
  (`findSeat` with `onFloor`): held upright it is let straight down at places across the row,
  either side of the rail as far as 0.8 of its half width, and where it comes lowest
  (`lowestAcross`) it is seated like any other plate, by lean and place in the gap; it counts
  as down between the tines when its lowest point is no more than 5 mm above the top of the
  rail. So a saucer has its seat in row C 35 to 55 mm right of the rail, against the inner
  face of the right ridge, and a 190 mm plate tipped forward between the 57 mm tines of rows
  A' and B', where it wedges 3 to 4 mm above the rails, has a seat there. Every such seat holds
  through the travel of the basket (`upper-rows.test.ts`: saucer, dessert plate and melamine
  dessert plate in rows A, A', C rear and C front). A flat floor is not searched this way: the
  seats of the lower basket are as they were.
- **Side rests seat cups.** A basket whose floor falls towards a side wall in a straight slope
  of 20 to 50 degrees has a rest there (`affordances.sideRests`; the Bosch's upper basket has
  two, 33 and 35 degrees, each from a ridge 150 mm from the middle to the low floor by the
  wall). `list_slots` lists each as a slot of kind `cup_rest` (`rest_left`, `rest_right`) with
  its slope (`lean_deg`), the wall it falls to (`lean_toward`) and its size, and with `item_id`,
  for a cup, a mug or a glass, a `suggested_drop`: mouth down, tilted towards the wall
  (`roll_deg`), the handle along the rest to the rear (`yaw_deg: 90`), a millimetre above where
  it touches. Across the rest the seat is found without the physics (`restSeat`): at the slope
  of the rest and at 8 and 16 degrees less, the vessel is let straight down (a sweep) at places
  6 mm apart from where its upper rim edge is 40 mm beyond the ridge out to the wall, and the
  pose at which its centre of mass comes lowest with its lowest point down on the rest is the
  seat: the pose of least potential energy among those tried. Along the rest it is the rearmost
  place free of what stands in the basket, with 4 mm to spare and 10 mm clear of the rear and
  front walls (the knock of the stop shifts what stands on a rest 2 to 3 mm along it at every
  move of the basket). What already stands on the rest is taken by its bounding box along the
  rest; what stands beside it (a plate in the rows) is tested by overlap, exactly. `drop_free` is the test `place`
  applies: under a shelf that is folded down the seat is given, not free, and
  `drop_blocked_by` names the shelf (fold it up, set the vessel down, fold it down again: the
  knife shelf, 149.5 mm up, comes down over mugs; the cup shelves, 75.5 mm up as inferred, come
  down over nothing in the catalogue). Stemware, bottles and jugs are offered no seat (taller
  than 1.3 times the side wall, or longer than 1.4 times the rest: a 200 mm wine glass leaning
  there is carried off when the basket is pushed in). Measured on the Bosch
  (`rests.test.ts`, 18 kinds of vessel on both rests): let go at the seat a vessel settles by
  0.2 to 10.5 mm, leans 16 to 34 degrees, and shifts 0.2 to 6 mm when the basket is pushed in
  and pulled out; four mugs or tea cups, five 250 ml tumblers or seven 60 mm glasses stand
  on each rest. The seat of a type of vessel is worked out once per process, machine and
  configuration (0.1 to 0.4 s a rest for a mug; 1 to 25 ms a call afterwards on an otherwise
  empty basket, 0.1 to 0.2 s with the rows beside the rest full of plates).
  OPEN on the Bosch: a saucer in rows A' and B' reaches to 92 mm from the left wall, exactly
  to the ridge of the left rest, and a cup or mug on that rest reaches 5 to 20 mm beyond the
  ridge: the two overlap by about a centimetre where they stand side by side, so the left
  rest takes only glasses, and only in the gaps, once the rows beside it are full (the
  manufacturer's leaflet shows saucers in those rows and mugs under the knife shelf together;
  the rows or the ridge are 10 mm from where they would have to be for that).
- **Cup shelves seat cups when they are folded down.** A slot of kind `cup_shelf` carries, with
  `item_id` for a cup, a mug or a small glass, a `suggested_drop`: mouth down and level in the
  middle of the shelf, the handle along it to the rear, the rim 2 mm above the shelf, at the
  rearmost place free of what stands in the basket (`shelfSuggestion`; `shelves.test.ts`: three
  tea cups or mugs, or four espresso cups, on the two shelves of the Bosch, level and unmoved by
  the travel of the basket). Nothing for what stands on edge or on a handle, for what is wider
  than 1.05 of the shelf, or for what would stand through the roof on it (a 200 mm wine glass).
  On the Bosch a lowered shelf closes the right rest under it (four mugs) and nothing in the
  catalogue stands under a shelf 75.5 mm up, so lowering the shelves does not add places in this
  model; that height is inferred (+12 -6 mm) and has not been measured by tape.
- **A slot on the floor beside the rails is taken by what stands between its tines.** Elsewhere a
  slot is taken when the lower edge of another item is between the feet of its two tines; a
  plate seated on the floor beside the rail of row C leans with its lower edge a tine's foot
  further along, so there the item is in the slot whose two tines it passes between half way up
  them (`seatIn`). Before, one slot of row C was offered three times over to 170 mm plates.
- **Nothing is put through the roof.** The roof of the machine geometry is a sheet 2 mm thick
  with nothing over it, and the overlap test of `place` lets a thin part (the stem of a glass)
  through a thin sheet. `place` and the test of a suggested drop therefore refuse a pose in
  which any part of the item, behind the plane of the door liner, reaches above the underside of
  the roof: `collision_at_pose`, `colliding_with: ['tub.roof']` (`aboveRoof`). Before, a 200 mm
  wine glass asked at the rear of the pulled-out upper basket was let down from above the sheet
  and hung on it by its foot. The side walls of the tub are sheets of the same kind and are not
  guarded this way.
- **A refusal names the part.** `colliding_with` and `blocked_by` of `place` and `preview`, and
  `drop_blocked_by` of a suggested drop that was tested as a pose, name a part of the machine
  as contacts do (`upper_rack_fittings.shelf.cup_rear`, `upper_rack.floor.x`), not only its body
  (`PenetrationResult.parts` and `SweepResult.part` of the physics package). A slot that is
  taken or covered is still blocked by the item, by `cutlery_basket` or by `tub`.
  For the cutlery basket an item with a `handle_down` (or `handle_up`) preset gets a
  `suggested_drop` per cell, found by trying places across the opening of the cell, nearest its
  centre first, with the test `place` applies. It is the lower end of the piece (the middle of
  its lowest 30 mm) that is put over the place, not the middle of its bounding box: for a ladle
  the two are 39 mm apart, which used to send it down beside the basket. A piece of cutlery
  counts as fallen out of the cutlery basket when its lower end is outside it, not when it
  leans over the rim.
- **Exact placement.** A level whose rules say `exactPlacement` (card: `exact_placement`) accepts
  `mode: 'set'`: the position is taken to 0.1 mm, the item is put at exactly the stated pose
  without the sweep from above and without lowering, may overlap what is there by up to 2 mm (a
  recorded resting pose touches its neighbours), and settles. This is for reproducing a recorded
  load such as a calibration wash; in a level without the rule it is refused as `not_available`.
- **Stable.** Every action ends in three stages (`SessionImpl.rest`). Everything comes to rest
  undisturbed. Then every item the action touched (whatever was awake, or moved) is given the
  standard disturbance of a settle (section 5): gravity tilted by one degree towards four sides
  in turn, 0.05 s each, as much as a touch of a centimetre a second. An item that ends more
  than 4 mm or 3 degrees from where it had come to rest is nudged once more where it lies now.
  `stable` is the verdict of the last nudge an item was given: it stayed where it lies. So what
  stood on a point (a knife on the end of its handle, a saucer on its rim) falls in the action
  that put it there, is reported where it lies afterwards, with how far it went
  (`displacement_mm`, `rotation_deg`), and is stable there or not; before 2026-10-10 such an
  item stood until the basket was next moved and some were called stable. The nudge does not
  fell everything that only balances: a 375 x 267 x 8 mm chopping board on its long edge tips
  beyond atan(4 / 133.5) = 1.7 degrees, and one degree of tilt for 0.05 s turns it by 0.1
  degree (3 degrees would do no better; it is the duration that is short). So balance is also
  judged directly (`SessionImpl.balances`): an item that touches nothing sideways (no contact
  whose normal is flatter than 60 degrees from the vertical) and whose centre of mass is less
  than 5 degrees of tilt inside the outline of its points of contact is reported `stable:
  false` where it stands. [ESTIMATED: 5 degrees.] A glass on its rim (30 degrees), a plate
  between tines and cutlery leaning in a cell are not affected (`balance.test.ts`). False also
  for what has not come to rest after ten seconds; what the action touched and has itself
  come to rest by then is not nudged in that action and counts as stable (until 2026-10-10
  evening everything awake was called unstable when one item kept moving, and the random
  policy then took a whole pile of 67 items out of `dinner-party-random`, which ended with
  one item; it now holds 52). 4 mm and 3 degrees, not 1 and 1: items between tines
  and in cutlery cells have a few millimetres of play. An item that sleeps through an action
  keeps its verdict. The stability probe of the physics package (four kicks from a snapshot,
  2 s of simulation per action) is no longer run: an action costs the fall, 0.1 s of calm,
  0.2 s of disturbance and the 0.5 s hold of the rest criterion. `stable` is not a test of the
  basket being moved; `check_load` is.
- **Insert.** The item approaches along `insert_dir` over 0.3 m. The approach must begin in free
  space and the machine must not stop it more than 10 mm short of the pose. From its first
  contact on the item is a body pushed at 0.1 m/s with at most 15 N beyond its own weight, its
  orientation held; it is let go at the pose, or where it has made no progress for 0.2 s.
- **Other options of `set_rack`** come from the machine: `height` (the basket is driven to the
  new height with its load), `tine_row_<id>` and `shelf_<id>` (the part is exchanged; refused as
  `blocked` when an item is where the new part would be or ends up squeezed).
- **The cutlery basket is a loose part.** `set_rack('cutlery_basket', { name: 'position', value })`
  stands it at one of the machine's named places (the Bosch: `front_centre`, `front_right` where
  the owner stands it, `front_left`) or takes it out of the machine (`out`). It is carried by
  hand: refused as `blocked` while anything stands in it or leans on it (the items are named),
  or when something stands where it is to go. The value is in `rack_options` of the scene state
  and of the load manifest (`cutlery_basket.position`) and in the state hash; the wash manifest
  carries the placement in `machine_config.cutleryBasket`. The level card lists the option
  under the rack `cutlery_basket`; the origins it gives for that rack are those of the start
  of the level. Taken out, the frame `cutlery_basket` does not exist.
- **The level card's envelope** of a basket is the height clear over the whole basket (the
  upper basket: 220 mm to the roof; the lower: 340 mm to the floor of the upper basket at its
  top position), with `low_spots` for the discs under which it is less: the circle the upper
  arm sweeps (313 mm under its blades, radius 230 mm, and 292 mm under its hub) and the roof
  sprayer (190 mm, radius 26 mm). `check_load` reports as protruding what exceeds the envelope
  (a baking tray on its long edge at the side wall, 341 mm high beside the arm's circle, does
  not stop the arm and is not reported for its height); the arm is tested by its sweep and the
  sprayer as a fixed part.
- **`check_load`** pushes every basket in, closes the door on the load (the door is pushed shut
  over its last 0.12 m like a rack, so that cutlery leaning out is pushed back and something that
  resists stops it), sweeps each arm through a turn, and tests the dispenser lid's swept volume,
  the tablet's path and its tray. Then the world is restored. `start_cycle` does the same for
  good, refuses with `door_blocked` when a basket does not go in or the door does not close, and
  otherwise freezes the load. After that the door is drawn shut (`bodyPoses`).
- **Rejections beyond the dossier's:** `physics_limit` (the engine's contact capacity, section 5,
  or an action after which the engine has no finite position for an item, seen once with a
  roasting tin let go onto a random pile: everything is put back and nothing is charged; after
  a lost position every body of the machine and every item is taken out of the world and put
  in again before the poses are restored, because restoring the poses alone left a world in
  which 66 items then failed to come to rest; `lost-body.test.ts` shows the rebuilt world goes
  on hash for hash like one in which the action was never tried),
  `door_blocked` (`start_cycle`), `not_available`
  (`check_load` in a level without mechanical checks, `mode: 'set'` in a level without exact
  placement), `episode_over` for the queries named above.
- **For the server.** `peekState()` is the scene state without a query, `washJob()` the wash in
  hand; the server uses them for its pushes and summaries.
- **The wash.** `start_cycle` builds a `WashManifest` (level, machine configuration, programme,
  every loaded item with its exact settled pose in the tub frame and its soils, the seed, and
  `prechecks`: what the mechanical check of `start_cycle` found, so that a spray arm the load
  holds still and a blocked dispenser are conditions of the wash) and hands it to the injected
  `WashRunner` `(manifest, onProgress) => Promise<WashReport>`. The player gets the
  `LoadManifest` (rounded poses, no seed). The runner of the game is the wash simulation
  (`simWashRunner` of `@spotless/wash-runner`, section 7.3). `placeholderWashRunner` simulates
  nothing and says so (`job.fidelity: 'placeholder_not_simulated'`, items `simulated: false`);
  it remains the default of `createSession` and of tests that are not about the wash. A runner
  that rejects is a failed job, and the wash is given back.
- **The report** (`WashReport`, `types.ts`). Per item of the level: not loaded, or loaded with
  `clean`, `points_awarded`, `score_iec` (0 to 5), `graded_score` (the IEC score over 5),
  `residue_regions` (per region that still shows soil: share of the region's surface, visibly
  soiled area, specks, and per soil the share that is left), `retained_water_ml` and
  `holds_water`, `surface_film_g`, and when it is not clean a `reason` in a sentence of fact.
  `job` says which tier and which version of the simulation produced it (`fidelity`,
  `sim_version`, `runner_version`, `result_hash`) and carries `notes` (a held arm, no detergent
  released). The residue cell by cell (`ResidueMap`: position, normal, area and share of each
  soil left, in the item frame, packed) is not in the report: it is fetched per item.
  `get_report` of a running wash carries `stage` when the runner reports stages
  (`WashStageProgress`: which stage, how far, and an estimate of the time remaining with its
  age).
- **State hash and log.** The hash covers the world's own state hash (exact bits of every pose and
  velocity), the rack positions and options and which items are placed in which frame. Every call
  is logged with the hash after it. `replayActionLog(level, log)` applies the actions (rejected
  ones too) to a fresh session and compares every hash; with `queries: true` it re-issues the
  queries and compares result digests as well.

Measured on the reference machine, a MacBook Pro (Apple M3 Pro, 18 GB), on 2026-10-10 at 23:50
(`packages/session/scripts/timing.ts --targets` replaying the saved load `half-careful` call by call: 62 items placed by the careful
policy; best of three runs, wall time, one replay of another load running alongside, load
average 5 to 6): `place` median 0.045 s, worst 2.8 s (78 calls); `preview` 1 ms (worst 73 ms);
`remove` 4 ms (worst 92 ms); a basket move with the load 1.82 s (worst 1.84 s; while loading
median 2.0 s, worst 3.8 s: 1.7 s of travel is simulated at 1 m/s^2, then the rest and the
nudge); `check_load` 0.15 s; `start_cycle` 0.15 s; `createSession` 0.09 s; `list_slots`
without an item 0.5 ms, with an item median 0.17 s and worst 9.1 s, 61 s in all over 54 calls.
Against the targets (place 0.3 s median and 3 s worst, a basket move and `check_load` 1.5 s,
`list_slots` 0.5 s) the script fails on the basket moves; `list_slots` meets its median and
misses badly at its worst: where items already stand in or lean over a row, each slot they
are in the way of is searched for a seat laid back less far (`findSeat` with the way down
tested), lean by lean down to 30 degrees forward. On an empty machine the first `list_slots`
of a type of item in a process takes 0.5 to 0.6 s for a plate in the lower basket and 1.2 to
2.2 s for a saucer, dessert plate or bowl in the rows of the upper basket (no seat is found
there and every lean is tried); a pushed-in upper basket and an item too tall for a basket
take 1 to 8 ms (they took 23 to 48 s and 11 s). NOT DONE: session calls still run on the
server's event loop, one player's settle stalls the others; a worker per session is the fix
and is a change to `packages/server`.

**A pile is far slower, and this is only partly fixed.** Plates dropped at random onto each other
(the reviewers' script `fill2.mjs`, which is not in the repository: dinner-party, items thrown into the lower basket) took 2.5 to 11 s per
`place` by the tenth plate and up to 43 s later. Measured again on 2026-10-10 with
`packages/integration/scripts/place-times.ts` (a seeded random fill of dinner-party to 60 items,
half into each basket, and the careful policy of `@spotless/loader` on weeknight-dinner; machine,
session and loader as of 08:16 that day, processor time of the process, best of three after and
of two before, while other agents' builds ran on the machine, load average 4 to 8):

| | before | after the physics work of 2026-10-10 |
|---|---|---|
| random fill, `place` (79 accepted; 76 before) | median 0.81 s, worst 30.2 s, 176 s in all | median 0.69 s, worst 10.8 s, 128 s in all |
| random fill, four basket moves | 34.7 s in all, worst 20.9 s | 13.5 s in all, worst 9.6 s |
| random fill, `check_load` | 2.0 s | 2.7 s |
| careful, `place` (73 accepted; 74 before) | median 0.29 s, worst 15.4 s, 51.6 s in all | median 0.24 s, worst 13.1 s, 39.6 s in all |
| careful, basket move (median), `check_load` | 0.98 s, 0.17 s | 0.99 s, 0.17 s |

The aims of that work (median `place` under 0.3 s, worst under 3 s, basket move and check under
1.5 s with 60 items thrown in at random) are met by none of the rows of the random fill and, of
the careful load, by all but the worst `place`. What was removed: the call from the engine into
JavaScript for every pair of pieces, which was 27 % of the time of a step, is made directly
instead of through the bindings' lookup by name, the engine no longer tests every piece of a leaning plate against every wire and rail under it
(pieces in frames of their own, long wires in lengths, a cull by bounding spheres), it looks for
contacts only as far ahead as anything can move in the step, and a settle ends at the step in
which the last body is at rest instead of after 2 s. What remains: an awake pile costs about
0.13 ms per plate and step however little it moves, a `place` wakes whatever the new item touches
and everything that touches that, the engine's sweep of a body that moves faster than three
quarters of its thinnest piece per step tests every piece of it against everything near it (two
nested dinner plates: 64,500 piece tests in a step against 3,700 without the sweep), and, when
this table was measured, after every settle the stability probe simulated another 2 s of the
island (four kicks of 0.5 s; replaced on 2026-10-10 by the nudge described under "Stable"). The
session's actions are synchronous, so the server answers nobody else meanwhile; the client shows
"The server is working out the physics of that" after 0.4 s. The next remedies are, in the
physics package, to keep what a new item does not push from waking (a sleeping neighbour treated
as fixed until it is pushed with more than it can hold) and to sweep only the pieces that can
reach something, and, in the session, to run actions off the server's event loop (the
disturbance of the settle now stands for the kicks of the stability probe).

Defaults for the decisions of policy, which are the project's to take and not engineering's (all
configurable per level set):
- Headline score is binary per item (points if clean), with a graded score reported beside it.
- "Clean" means the virtual inspector's residue score meets the threshold (IEC-style score of 4 or
  better: at most 4 specks and 4 mm2 of visible soil), counting original soil, redeposited soil and
  residue left by pooled liquor. Dryness is reported but does not decide "clean". As built: the
  report (`cleanBySoil` in `packages/wash-runner/src/report.ts`) decides clean from specks and
  visible area alone, which is what the level card tells every player and what the benchmark
  dossier recommends (section 9, item 2). Since 11 October the visible area counts the residue
  left by pooled liquor as the sentence above asks: what the wash water held is left where water
  stands on an item at the end, so a glass or mug left mouth up is not clean; soil redeposited on
  open faces is still not modelled. The simulation's inspector also fails an item that holds
  more than `inspect.maxWaterMl` (1 mL) of standing water; the report does not take that part of
  its verdict over, and states the water as `holds_water` and `retained_water_ml`. [OPEN QUESTION:
  if water is to count, change the card's `clean_definition` and `cleanBySoil` together.]
- One wash per level; no preview wash in scored play.
- Mechanical checks (`check_load`) are available on request and report mechanical facts only.

### 6.1 The scripted loaders and the standard loads (`@spotless/loader`)

Three policies play a level through the session, call by call, as a player would
(`runPolicy(session, { policy, seed, items })`), and `playOwnerLoad` places the owner's load of
10 October 2026 by hand. All are deterministic: the same level, policy and seed give the same
action log.

- **Careful** loads by the scheme of the manual, as the project reads it, and the dossiers:
  flat pieces on edge in the
  slots `list_slots` suggests (only where `drop_free` is true and `drop_seats` is not false),
  with the grain of the tines; large shallow plates in the rear rows of the lower basket, deep
  plates in its side rows, small plates and small bowls in the rows of the upper basket (the
  knife shelf folded up where that frees rows for them); cutlery handle down, dealt over the
  cells by kind and pushed straight down into a bunch (`mode: 'insert'`) where no place is free;
  hollow ware mouth down wherever a `preview` shows a free place, the places with most room
  first; long utensils up to 306 mm in the cutlery basket. It asks before it lets go (`preview`
  before every free placement), and judges every accepted placement by what the session reports:
  nothing may rest on another item (a light lean is allowed: at most 0.3 of the item's weight on
  a neighbour, 0.6 for bowls tiled in a row), nothing on a fixed part of the machine, nothing
  above the envelope, nothing moved by more than 4 mm in the placing. What fails is taken out
  again and tried elsewhere. Each basket is pushed in and pulled out again with its load, what
  the move threw is taken out and given one more place, and `check_load` findings (an arm
  stopped, the tablet's path, the door, an item sticking out) are removed. Last, the settled
  load is read by its numbers (`posture.ts`): a plate leaning more than 6 degrees against the
  tines of its row (15 for deep plates) and a glass, cup, mug or bowl leaning more than 25
  degrees from mouth down with no tine to hold it come out again and are listed in `left_out`
  with the angle. Known weakness: an
  item that fits nowhere is tried in up to 18 places before it is given up (2.3 to 4.8 accepted
  places per item kept on the full levels).
- **Careless** makes the whole careful load first, in the same session (so its log begins with
  the careful log), and then the common mistakes with items of that load: cups and glasses
  taken out and put back mouth up or on their side, a bowl flat face down, bowls and spoons
  nested, a plate pushed into its neighbour's seat or turned to the wall, an item laid over
  others, the tablet's path blocked, a knife through the floor of the upper basket into the
  arm's path. Nothing is added from the counter. A mistake is recorded only for what the
  settled pose shows after the baskets have been moved (`mistakes.ts`); an item whose mistake
  did not hold goes back where it stood (its settled pose, then its slot or a cell, then any
  place the careful rules give it). Plates and spoons are taken from the end of the order of
  placing, one plate to a row: plates at the 18 mm pitch of the rear rows stand nested, and
  through `place` only the last of a row comes out and goes back (a slot between two standing
  plates is truthfully reported as not free; a hand would tilt the neighbours apart, which the
  session does not model). An item is taken out for a mistake only while 30 actions remain.
  What the last moves of the baskets leave unsteady stays in and is listed as unstable in the
  saved load; only what stops a basket, the door or an arm by accident is taken out. So the
  careless load holds the items of the careful one less the few that would not go back or
  were taken out by that last check (each named with its reason in `left_out`). After the
  policy, each basket of a careless or random load is pulled out and pushed in once more
  (`generateStandardLoad`): what stops a basket comes out, what the moves only shift stays
  where it ends, and the mistakes kept are those the load still shows afterwards. Before
  2026-10-10 evening only careful loads were moved, and `breakfast-careless` jammed its upper
  basket at the first pull.
- **Random** draws poses and keeps what the session accepts and what stays put.
- **Budgets.** The starter and standard levels allow `max(400, 8 x items on offer)` actions
  (`starterRules`): the benchmark dossier's provisional 400 (its section 4.4) and its arithmetic
  per placed item where a level is larger. Until 2026-10-10 the rule was `max(60, 4 x items)`,
  which the careful loader exhausted on three of the five starter levels. [ESTIMATED; to be
  decided once human medians exist.]
- **The owner's load** (`owner-2026-10-10`, `owner-load.ts`): 33 catalogue stand-ins placed
  after the owner's photograph of his loaded lower basket, cutlery basket at the front right
  (`set_rack`), items resting on items as he loads them; its picture beside the photograph is
  `packages/loader/loads/owner-2026-10-10-beside-photo.png`.
- **Standard loads** (`packages/loader/loads/`, 21 of them): for each, the level, the action
  log with a state hash per call, the settled load and wash manifests, what was left out and
  why, the mistakes, the mechanical check, and a picture. `generate-loads` makes them (one
  process per load), `check-loads` replays every log in a fresh process against its hashes,
  moves both baskets of EVERY load out and back (a load that cannot be unloaded fails), and
  audits the settled load by numbers: for a careful load nothing laid over another item, no
  plates touching, no plate against its row, no vessel leaning over unheld, nothing unstable;
  for every load the most items one basket move shifts by more than 5 mm or 10 degrees, and
  the worst of them (cutlery in its cells is stirred at every move of the lower basket).
  Overlap is measured twice (`verify.ts`): on the convex collision pieces, as the physics sees
  it (`deepest_overlap_mm`), and on the true shapes, the surface points of each item against
  the signed distance of its neighbours (`deepest_true_overlap_mm`, `true_overlaps` over
  0.5 mm): glasses and mugs leaning on each other reach 0.5 to 0.75 mm there while their
  pieces report 0.1. `SUMMARY.json` holds the table (offered, placed, by basket, attempts per
  placed item, both overlaps, mistakes, check). A wash description of a load
  (`washDescriptionOf`, `export-wash`) carries the whole machine configuration at top level as
  `machineConfig` (shelves, folded rows, the cutlery basket's position), which
  `washInputFromDescription` of `@spotless/sim-core` builds the machine from; before, only
  `basketHeights` reached a wash started from a description, and mugs standing on a
  folded-down cup shelf were washed 9 to 11 mm inside the shelf folded up.
- **`packages/levels/scripts/pack-levels.ts`** packs each starter level with the careful policy
  (the same call as the saved `<level>-careful` loads) and fails if a level leaves less than
  15 % of its points on the counter.

## 7. Server, client and agent interface

- `spotless-simd` (`@spotless/server`): Fastify HTTP API mirroring the session actions and queries one to
  one; a WebSocket per session; geometry for clients; a single-worker wash job queue with a result
  cache; session logs on disk. Details below.
- Human client (`apps/web`): orbit camera; item tray; ghost placement with collision tint; orientation
  presets plus yaw/tilt; numeric pose panel; orthographic plan and elevation views; `check_load`; wash
  progress; report view with per-item residue maps. Every gesture reduces to the session actions above.
  Built: section 7.2.
- Scene (`@spotless/render`): the Three.js scene of the machine and the load, the named views and the
  item thumbnails, used by the client (section 7.2) and by the render service for agents (the
  `render` query: stills from headless Chrome with labels, grid, highlight and ghost options, the
  `custom` and `item` views, 768 px default, 1024 px maximum; section 7.4). The `height_*` views
  are not built.
- MCP server (`@spotless/mcp`): one tool per action and query; images returned as image content;
  structured results with output schemas; `start_cycle` + `get_report` polling for the long wash
  (section 7.4).
- Harness (`@spotless/bench`): episodes of scripted policies and of models through the MCP tools,
  verified by replay, with episode records and a results table (section 7.4,
  `docs/benchmark/README.md`).

### 7.1 The server as built (`packages/server`)

The server adds transport, persistence and display to the session layer and no game logic: every
action and query of a human or an agent is one call of the same `GameSession`.

**HTTP** (`src/app.ts` lists every route). `POST /api/sessions { level_id, player? }` creates a
session and returns its id, the level card and the scene; `player` (`{ kind: 'human' | 'agent' |
'scripted', name, interface? }`) says who the episode is for. `GET .../player` says who is playing
and whether a name is wanted (benchmark mode, nobody named yet); `POST .../player { name }` lets a
player without a name give one, once. `GET .../episode` (harness only) is the episode record as it
stands. `GET /api/guidance` is the generic loading guidance, the same text for every player.

**Who may do what.** A session id is a random UUID and is the player's key to that session: it opens
the routes under `/api/sessions/:id` and nothing else. No route open to players lists session or job
ids. `GET /api/sessions` and `GET /api/jobs` need the server's admin token in the `x-spotless-admin`
header (403 `forbidden` otherwise, and always when the server has none). In benchmark mode the
token is also needed for `GET /api/levels` and `GET /api/levels/:id` (a participant does not read
the cards of levels not yet played; `GET /api/sessions/:id/card` is the card of the session's own
level, free and unlogged), for `GET .../log`, `DELETE /api/sessions/:id`, `POST .../restore` and
`GET /api/jobs/:id`. With an admin token
(`serve --admin-token <t>` or `SPOTLESS_ADMIN_TOKEN`, `ServerOptions.adminToken`) the server is in
benchmark mode: creating a session needs the token too, so the harness opens the one session of an
episode and hands its id to the player, who cannot open a second session of the level to wash a
copy of the load and read the report first. Without a token (local play) anybody may start a
session. `GET /api/health` says which mode the server is in. Under `/api/sessions/:id/` each action and query is an
endpoint of its wire name (`place`, `remove`, `reset`, `set_rack`, `start_cycle`; `get_level`,
`get_state`, `get_item`, `preview`, `list_slots`, `check_load`, `get_report`, `render`), `POST` with the
request of the session contract as JSON body; the queries without parameters also answer `GET`. A call
the session rejects is HTTP 200 with the rejection as the session returned it. The server's own
refusals have the same shape (`{ accepted: false, reason, detail }`) and a status that says whose
fault it is: 400 `invalid_argument` for a body that fails its schema (wrong JSON types, missing or
unknown keys; such a request never reaches the session and is not logged), 404 `unknown_session`,
`unknown_level`, `unknown_job`, 403 `forbidden`, 409 `restore_failed`, 409 `load_frozen` (benchmark
mode: after a failed wash the load that was committed is the load that is washed, and only
`start_cycle` is taken), 503 `server_full`, 500 `internal_error`. What
the values mean (whether the item, frame, rack or preset exists) is left to the session, so that its
own reasons come back. `render` is drawn by the render service (`ServerOptions.renderer`: a
function, or a service with `check`, `render`, `thumbnails`, `close`; `serve` attaches
`createRenderService` unless `--no-render`). A request that cannot be drawn is refused by `check`
before anything is charged or logged; the picture is drawn first and the query charged after, so
a render service that cannot start (no Chrome) answers `not_available` at no cost. Without a
render service `render` is `not_available`. `get_item` answers with the item's four pictures
(`thumbnails`) when the service supplies them; they are added after the session has logged the
query, and are no part of its digest. `get_report` of a running wash carries the stage the wash is in
(from the queue). `GET .../residue_map?item_id=` returns the residue map of one item of the
session's last finished wash (`{ accepted: true, map }`, or `no_residue_map`); it is part of the
report, so like `get_report` it is free, and it is not logged. `GET /api/levels` lists the levels; `GET /api/levels/:id` is a level card
without a session.

**Free endpoints for drawing.** `GET .../scene` returns the scene state with a draw pose for every
machine part and placed item, and `GET .../geometry` the parametric `Shape` of every machine part in
the session's current configuration and of every item type of the level, with the machine's
affordances (tine rows and slots, shelves, cutlery cells, envelopes) and each item type's orientation
presets. Shapes are the geometry kernel's own description (SI, `[x, y, z, w]`), so a client rebuilds
meshes with `buildRenderMesh` from the same code; poses are on the wire in millimetres and
`quat_wxyz`. A draw pose is the pose of the body's own frame in the tub frame (not of an item's
reference point). `geometry_key` changes when a `set_rack` changes the machine's geometry. Neither
endpoint is charged to the query budget or logged: they describe what a player sees, and the wire
slot cards with suggested orientations and drop positions stay with the charged `list_slots` query.
After the cycle has started the door is drawn at its closed pose.

**WebSocket** (`GET /api/sessions/:id/ws`, server to client, JSON): `hello` with the scene on
connection; after every action a `state` message (accepted or not, with the cause), preceded for an
accepted action in which something moved by an `animation` message: the bodies that moved, sampled
every 8 physics steps (30 frames per simulated second), each frame listing only the bodies whose pose
changed and carrying its simulated time `t_s`. The frames are read from the very steps the session
takes, by an observer on the session's physics world (no second simulation; a replay without the
observer gives the same hashes, which the tests check). Steps the session takes back (the kicks of
the stability probe, a rack that met resistance) are dropped from the recording. The session's
actions are synchronous, so the frames of an action arrive together when it has finished and the
client plays them back. `wash` messages carry the job's status and progress, and a `state` message
follows when the wash has ended.

**Wash jobs.** The session is given a wash runner that submits the `WashManifest` to a queue with one
worker: one wash at a time, because a wash has the GPU and up to a few gigabytes of memory to
itself. The runner named in `src/wash-runner.ts` (`WASH_RUNNER`: `simWashRunner` of
`@spotless/wash-runner`, the wash simulation) is loaded in a child process per wash, so the server
stays responsive, the wash's memory and its GPU device are returned when it ends, and a wash that
crashes takes only itself down. The queue asks for a tier: `ServerOptions.washTier` (`serve
--wash-tier official|fast`, or `SPOTLESS_WASH_TIER`), by default `official` in benchmark mode and
`fast` otherwise; a level whose rules name a tier (`rules.washTier`) is washed at that one.

Progress reaches the session (`get_report`: `queued`, `running` with a fraction and the stage,
`done`, `failed`) and the WebSocket. A finished report is stored under `<data>/washes/<key>.json`,
the key being the SHA-256 of the canonical JSON of the runner's identity (module, export,
version), the tier asked for, and the whole manifest (level with its rules, machine configuration,
programme, every loaded item with its exact pose and soils, the mechanical findings, seed, scene
hash); a wash whose key is stored is answered from there. The version of the server's own runner
ends in a fingerprint of the source of everything a result depends on (`simulationFingerprint`:
every non-test source file of `core`, `geometry`, `catalogue`, `machine`, `inspector`, `sim-*` and
`wash-runner`), read afresh for every wash: a result computed by other code is never served,
whether or not a version number was raised, and the simulation's own `SIM_VERSION` is covered
because it is in that source. The worker reports the version it ran with, and the queue writes it
into the report (`job.runner_version`) and the job record (`ran_with`), so a report says what
computed it. If the source changed under a wash: in local play its report is delivered and not
kept in the cache; in benchmark mode (`WashQueueOptions.strictSource`) the wash fails as an
infrastructure failure and is started again. Every report is also kept exactly as it was delivered,
by job id (`<data>/reports/<job id>.json`): that copy is what a restored session, its episode
record and the pictures of the washed load use, whatever the result cache holds. A session whose
delivered report is gone is washed again on restore in local play (the session file notes it and
the record says `wash.rewashed_with`) and is not restored in benchmark mode. The episode record
lists every wash of the episode (`washes`), failed ones included, with the hash of the load each
was started on.

Beside the report the runner hands over the residue maps of the washed items, stored as
`<data>/residue/<key>.json` and served one item at a time, and the statistics of the run (time per
stage, peak resident memory of the worker, GPU buffer bytes), kept in the job record (`stats`). The
simulation's exposure sets are cached in `<data>/exposure-cache/<runner version>/` (the two newest
older directories are kept, the rest removed), and the runner keeps the stage timings of the last
40 washes in `<data>/wash-timings.json` for its estimates of the time remaining.

A runner that throws, a worker that dies, a report that is not a report of this load, a result
with a value that is not a finite number, poses that do not match the load the player was shown,
and a wash over the time limit (an hour unless `ServerOptions.washTimeoutMs` says otherwise) are
failed jobs with the reason in words: the session gives the wash back and no score exists. A wash that is stopped (time limit, the server closing) gets
SIGTERM: the worker aborts the runner, which destroys its GPU device at the simulation's next
report, and exits; a stage that does not yield is killed after 4 s. Job records are in
`<data>/jobs/` and at `GET /api/jobs/:id`.

**Persistence.** `<data>/sessions/<id>.jsonl` holds a header (level id and digest, and the player
when the creator named one) and then one line
per event of the session's action log, written before the response is sent, and one line per wash
outcome at the point of the log where it took effect. Lines of type `note` record the player's name
when it was given later and the moment the player first arrived (first socket or first call); they
take no part in a replay. When a wash ends the server writes the episode record
(`<data>/episodes/<id>.json`, section 7.4). Pictures drawn for `render` are kept under
`<data>/renders/`. A session that is not in memory (the server
was restarted, or the session was set aside to make room: at most 32 are held) is restored on its
next use by replaying the file into a fresh session: every event, queries included, so that budgets
and the log come out as they were; a wash that ended is given its stored outcome at the same point,
and a wash that was in hand is queued again. Every state hash and acceptance must come out as
recorded, or the session is refused with `restore_failed`.

**Command line** (`pnpm --filter @spotless/server exec tsx src/cli.ts ...`): `serve [--port 8787]
[--host 127.0.0.1] [--data .spotless] [--static dir] [--admin-token t] [--wash-tier official|fast]
[--no-render]`, `link --level <id> --player <name> [--agent] [--server url] [--admin-token t]`
(asks a server in benchmark mode for an episode for a named player and prints the address that
opens it), `replay <file> [--queries]` (a session file, the
answer of `GET .../log`, or `{ level, log }`; exit status 0 when every hash is reproduced), `levels`.
The built web client (`apps/web/dist`) is served at `/` when it exists.

Measured on the M3 Pro (2026-10-10, `packages/server/scripts/smoke.ts`, real sockets): creating a
session 0.15 s; the geometry payload 335 kB in 5 ms; starting the wash worker process about 0.6 s
(measured with the placeholder runner; the script now washes with the simulation, section 7.3).

### 7.2 The scene and the client as built (`packages/render`, `apps/web`)

**Scene (`@spotless/render`).** `SpotlessScene` is fed with shapes in kernel units and draw poses in
wire units and knows nothing of the server or of a page, so the same code can render stills for agents
later. Scene units are metres in the tub frame, z up. The machine is built from the parts of the
geometry payload, each through `buildRenderMesh` (chord error 0.3 mm) and split by the material of its
sub-parts; every wire and tine is drawn. The walls, roof and rear corners of the tub and the door are
separate panels, and a panel is left out when the camera looks at its outer side (`applyCutaway`), so
the load can be seen from anywhere. Items are built by `ItemFactory` from their catalogue shape (chord
error 0.15 mm), one mesh per material, with an appearance per catalogue material (`appearance.ts`:
glazed ceramic, glass drawn see-through, stainless steel as a bright part-metal so that cutlery
down in the cutlery basket does not mirror the dark and come out black, plastics). The tines of the
baskets are drawn at half the brightness of the other wires, so that the rows and the gaps between
tines can be made out from above.

**Soil.** The level's soil is painted by the surface shader on the regions it names: each triangle
carries up to two layers (colour, pattern, coverage) of its region as vertex attributes, and a layer is
drawn where a noise field evaluated in the item frame lies below a threshold. The threshold is the
quantile of the field for the stated coverage (`coverageThreshold`), so a soil said to cover 40% of a
region covers 40% of it on the screen. Colours and patterns are per soil type (`soilAppearance`, by
rule on the soil id; a test checks that every catalogue soil has one and can be told from white
porcelain). The picture shows where soil is, never how hard it is to remove.

**Residue after a wash** (`residue-map.ts`, `residue-object.ts`). A washed item is drawn bare, and
what is left on it is painted where it is, cell by cell, from its residue map (`decodeResidueMap`,
`residueTiles`, `SpotlessScene.setItemResidue`). Each visibly soiled cell is a small flat tile in
the tangent plane at the cell's centre, facing along the cell's outward normal and drawn on that
side only, so residue inside a mug is seen by looking into the mug and not through its wall. A tile
is as wide and as deep as its cell and turned as the grid of cells lies, both read off the cell's
nearest neighbour (cells on a body of revolution are not square), with 15% overlap; it stands
0.12 mm off the surface. Its colour says how much of the soil that lay on the spot is left, in
four steps of one magenta hue from light (up to a quarter) to dark (nearly all): `RESIDUE_STEPS`,
OKLCH lightness 0.73 to 0.50, a hue no catalogue material has. One hue cannot contrast with white
porcelain, bright steel and a black pan at once, so the tiles at the edge of a patch lie on a
slightly larger rectangle in an outline colour chosen against the item's material (near black on
light materials, white on dark ones): every patch has a rim. A test checks for every catalogue
material that the rim has a contrast of 3 or more against the material and every step 2 or more
against the rim. The tiles are unlit and not tone-mapped: the colour on the item is the colour of
the legend. Cells that carry only a trace too faint to count are drawn on request, as dots a third
the size in the lightest step and without a rim. Everything is in the item frame of the item's
shape, the frame its mesh is built in and its draw pose applies to; nothing is mirrored or
re-based (`SpotlessScene.residueTilePositions` gives the drawn positions for checking).
`residueLayersByRegion` and `residueColour`, the older painting by whole regions, remain for a
report that comes without residue maps.

**Views.** `viewSpec` and `fitView` give the named views as pure arithmetic: `iso_lower` and
`iso_upper` (three-quarter, centred on the basket where it now is), `top_lower`, `top_upper`,
`top_cutlery` (orthographic plan, back of the machine up; cut just above the basket when another
basket hangs over it, and just under its base grid when another basket lies below it, so that the
load underneath does not show through the wires), `front`, `left`, `right` (orthographic
elevations). The client adds a free
orbit camera, and every named view can be orbited from where it starts. `agent-views.ts` adds
the cameras of the `render` query (`custom`, the four fixed directions a single item is shown
from); `overlay.ts` and `view-marks.ts` compute the marks drawn over a picture (a millimetre grid
with axis values in the frame positions are given in, item-id labels, tine-row ids) as plain
lines and texts from a projection, and draw them on a 2D canvas. The page and the render service
use the same functions.

**Client (`apps/web`).** One page without a framework: a tray of the level's items (thumbnail drawn by
`ThumbnailRenderer`, name, points, soil description), the 3D stage, and panels for the item in hand,
the selected item, the last action, the baskets, the mechanical check and the wash. It draws from
`GET .../geometry` and from the WebSocket (`animation` frames played back by their time stamps through
`AnimationQueue`, then the `state` that ends them), and refetches the geometry when `geometry_key`
changes. Every gesture ends in one session call:

| Gesture | Call |
|---|---|
| Click a tray item, move the mouse, R/F preset, Q/E yaw (15 degrees, 1 with Shift), W/S and A/D tilt (5 degrees, 1 with Shift), wheel or Z/X height (10 mm, 1 with Shift), typed values | none: the ghost is local, on the 1 mm and 1 degree grid |
| Ghost at rest for 0.2 s (if "preview when it rests" is ticked), or V | `preview` (not charged); tints the ghost green (free and reachable), red (overlap), amber (unreachable, basket pushed in, or out of bounds) and shows the lowered pose as a bright blue outline, drawn through whatever is in front of it, with a line down to it from the ghost |
| Click on the stage, Enter, or the Drop button | `place` (mode `drop`) |
| Right-drag along one of the six axis directions, or release mode "insert" | `place` (mode `insert`, `insert_dir` a unit axis of the frame) |
| Release mode "set" (only in a level with `exact_placement`) | `place` (mode `set`, position to 0.1 mm) |
| Backspace on a selected item, "Take out" | `remove` |
| "Take out and hold as it stands" | `remove`, then the item is in hand 60 mm higher in the orientation it rested in (a quaternion); in a level with `exact_placement`, at exactly the pose it had, in mode `set` |
| "Take everything out" | `reset` |
| Basket buttons (position, height, tine rows, shelves) | `set_rack` |
| Space, "Run the check" | `check_load`, one query |
| "Start", then confirm | `start_cycle`, then `get_report` polled (and `wash` messages) |

The pose panel shows the ghost's pose in the frame of its basket and accepts typed values, which is how
a recorded test wash is reproduced: frame, x, y, z in millimetres, preset, yaw, pitch and roll in whole
degrees, or the orientation as a quaternion (w, x, y, z; the field always shows the current one, and a
typed one is used until a preset or an angle is changed), release mode and insert direction are exactly
the fields of the `place` request. So a human can state any orientation an agent can, and a settled
pose read from the Selected panel can be typed back: to 1 mm in a played level, to 0.1 mm with mode
`set` in a level that allows exact placement. A typed pose stops following the mouse.

A newly picked-up item starts in the basket the current view shows if that basket is pulled out, else
in one that is. While the player has not set a height, the item is held 15 mm above the wires, and
lower where part of it would otherwise be inside the upper basket or the roof of the tub (the rear of a
pulled-out basket). Choosing a frame (1 to 4, or the list) does not change the view. The tray has two
lists, "On the counter" and "In the machine"; an item lying on the door is labelled as not going to be
washed, is left out of the points in the machine, and is named in the confirmation before the start. The client composes preset and angles as the session does (`pose.ts`, tested
against `packages/session/src/wire.ts`); the ghost is drawn from the item record's presets, which are
rounded to 1e-4, so it can be up to 0.05 mm and 0.02 degrees from where the session takes the pose to
be. A session is resumed after a reload from the session id in the address.

**The wash on the page** (`report.ts`, `inspector.ts`, the cycle part of `app.ts`). While the
wash runs the panel shows the stage the simulation is in as the server reports it (its name, its
number of seven, how far it is where the stage says), a bar, the time so far and the estimate of
the time remaining. The simulation reports its long stages rarely, so the page counts the
estimate down from its value and age at the last report, and when a stage runs past it the page
says "this step is taking ... longer than estimated" instead of inventing a new figure. The bar
is the share of the estimated time that has passed, never below what the server reported and
never full before the report is there. The programme's 2:25 is not shown as a clock: the wait is
the computation.

The report shows the points, how many loaded items are clean, the points that were in the
machine, the graded score, which tier and which version of the simulation produced it, and what
the wash has to say (`job.notes`); then the legend of the residue scale with the switch for
traces; then a row per item: result, cleaning score, points, the reason when it is not clean,
the regions that still show soil (each marked with its step of the scale, with area, share of the
region and how much of each soil is left in the tooltip), the water it holds, and "Look closely".
The page fetches the residue maps one item at a time, the items that are not clean first, and
paints each as it arrives; the machine can then be looked at from any view with every item's
residue on it. "Look closely" opens one item on a stage of its own (`ItemInspector`): the item in
its own frame with its residue, an orbit camera that goes all the way round, buttons for
three-quarter, above, below, front, back, left and right, the legend with the numbers of this
item, the soil to colour by when it carried more than one, and its regions and water in words.

With the placeholder wash runner the report panel says in a highlighted notice that nothing was
simulated, every item reads "Not simulated", and items keep the soil they had.

**What the page shares with the agent's interface.** "Labels" and "Grid" at the top draw, over
any view, the marks of the `render` query (item ids; the grid of the basket's frame in plan and
three-quarter views, the tub grid with a ruler per basket in elevations). The item in hand is
shown from the four fixed sides `get_item` shows an agent. "How to play" carries the manual of
the level and the loading guidance word for word. In benchmark mode the page offers no list of
levels: it opens the episode its address names (`#<episode id>`, optionally `&player=<name>`),
shows "Playing as ...", and asks for a name once when the episode has none
(`pnpm --filter @spotless/web benchmark-shots` plays this in headless Chrome).

Departures from `docs/research/items.md` section 8.2: the wheel sets the height of the item in hand
(Ctrl or Alt with the wheel zooms) and yaw is on Q/E only; 1 to 4 choose the frame without moving a
basket, because moving a basket is an action that costs budget and can shift the load.

`pnpm --filter @spotless/web screenshots` builds the client and runs `scripts/play-tutorial.ts`: a real
server on a free port, headless Chrome, the tutorial played through the page to the report, a
screenshot per step in `apps/web/screenshots/` with `captions.txt` (its wash is the placeholder,
slowed down: the script is about loading). `pnpm --filter @spotless/web wash-shots` runs
`scripts/play-wash.ts`: the tutorial played through the page twice, once loaded badly on purpose
and once well, each washed by the real simulation at the fast tier, with screenshots of the
progress display, the report, the machine with its residue and items close up from several sides
in `apps/web/screenshots/wash/`, and a numerical check of the painting written to
`verification.json` (section 7.3). `pnpm --filter @spotless/web play`
builds the client and serves the game on http://127.0.0.1:8787.

### 7.3 The real wash (`packages/wash-runner`)

`simWashRunner` is the session's `WashRunner` backed by `wash()` of `@spotless/sim-core`;
`runWash(manifest, options)` is the same with everything it produces returned (report, residue
maps, statistics of the run). The server names it in `WASH_RUNNER` and runs it in its wash worker
(section 7.1). Everything that touches the simulation is in one file (`sim.ts`).

**Manifest to input** (`input.ts`, `washInputOf`). Machine, configuration and programme by id;
every loaded item with its catalogue type, its soils (the level's `amountG`, `ageH`,
`heatHistory` under the simulation's names) and its pose. The manifest's pose is the settled pose
of the item frame in the tub frame as a core `Pose` (`p` metres, `q` as `[x, y, z, w]`), exact as
the loading physics left it; the simulation takes the same thing, so it is handed over bit for
bit. The player-visible `LoadManifest` states the same load another way (the item's reference
point in millimetres, `quat_wxyz`), and `poseDisagreement` checks one against the other: the
reference point of every item, carried through the pose of the input, must be within 0.2 mm and
0.05 degrees of what the player was shown. `runWash` makes that check on every wash and fails the
job when it does not hold, so a convention that slipped cannot wash another load and score it; the
tests feed it a quaternion in the wire's order, the inverse rotation, millimetres for metres and
the reference point for the frame origin, and each is caught. The level's seed is the
simulation's `levelSeed` (where on a region the soil lies) and a fixed mix of it the `simSeed`
(the sampling of the wash). From `prechecks`: a spray arm the load holds still becomes
`stalledArms[level] = sense * angle` (the session names the machine part and the angle turned
through; the simulation wants the spray level and the arm's angle in the tub frame), and a
dispenser lid that cannot open or a tablet that cannot fall becomes `dispenserBlocked`. An empty
machine is not simulated: the report says that nothing was loaded.

**Result to report** (`report.ts`, `washReportOf`). `clean` is the simulation's inspector's
finding on soil (specks and visible area within the rule), not its finding on water; points for clean items only; `score_iec` its IEC score and `graded_score` that
over 5 (the alternative of benchmark.md equation 6); `residual_fraction_area` the visibly soiled
area over the item's whole surface; per region that still shows soil its share of the region's
surface (catalogue `regionAreas`), area, specks and, per soil of the item on that region, the
share of its dry mass that is left; pooled water as `retained_water_ml`, with `holds_water` when
it is more than a clean item may hold; the film left on the surface as `surface_film_g` (drying
is not simulated). The reason of an item that is not clean names the regions with visible soil,
largest first, with the catalogue's name of the soil. Clean is decided from the simulation's speck
count and visible area against the rule's two soil numbers, read from the simulation's registry;
water held does not decide (section 6, the defaults). `moved_during_wash` is always false: the load is static in
this build of the simulation. An item on which the jets push up harder than the simulation's
screening allows (`jetLiftRatio` above `inspect.liftWarnRatio`) is flagged `likely_moved` and
named in `job.notes`, without the figure. Nothing of how the simulation got there is in the
report (no exposure, film, liquor, parameter, seed or model class: a test searches the JSON), and
an item that was not washed is `{ item_id, loaded: false }` and nothing else. The simulation's
own remarks (`problems`: a soil on a region the item lacks, a pump that ran short) are written for
developers and may name its quantities: the report counts them, and the wash worker writes them
to the server's log. A result with a value that is not a finite number is refused.

**Residue maps** (`residue-codec.ts`). Per washed item the cells that still carry soil (visibly
soiled, or with at least 1/510 of a soil left): centre and outward normal in the item frame, area,
the share of each soil left, and whether the inspection counts the cell as visibly soiled. Packed
as little-endian integers in base64: positions in steps of 0.02 mm (16 bits), normals in 1/127,
areas in 0.01 mm2, shares in 1/255 with a trace rounded up: 13 bytes a cell and soil.

**Progress** (`progress.ts`). Seven stages: starting, then the simulation's own (scene,
hydraulics, exposure, soil, replay, result), each with a name for the page. The simulation
reports its long stages rarely (the exposure once per spray pattern, which takes from seconds to
minutes), so the overall fraction is a share of estimated wall-clock time: elapsed over elapsed
plus remaining, where remaining is what is left of the current stage plus the stages to come.
Stage durations are estimated from the timings of earlier washes on the same machine at the same
tier (`<data>/wash-timings.json`: the built-in figures below scaled by the median ratio of what
earlier washes took), corrected during the wash by how its finished stages compared with their
estimates, and within a stage more and more by the stage's own rate. The estimate is a value at
the time of a report; `get_report` adds how old it is, and the page counts it down.

**The device.** The runner makes the GPU context of the process (Dawn through
`@spotless/sim-gpu/node`), gives it to the simulation (the `gpu` option of `wash`), and after the
wash releases the simulation's scene buffers, drains and destroys it. One wash per process, so nothing
is kept between washes. An aborted wash loses its device and stops at the simulation's next
report. Without an adapter the simulation traces on the CPU and the report notes it.

**Measured** (M3 Pro, 2026-10-10, `pnpm --filter @spotless/wash-runner measure --warm`; each wash
in a process of its own, as the server's worker runs it; other engineers' runs were using the
machine and the simulation was at version 0.1.0 to 0.2.0 and still changing, so these are the
figures of that hour, not a benchmark). Saved standard loads of `@spotless/loader`: the tutorial
(7 items), weeknight dinner (37) and dinner party (74), loaded by the careful policy. Seconds of
wall time by stage; "cold" computes the exposure, "warm" takes it from the cache on disk and
only builds the scene and replays.

| Load, tier | Blocks | Scene | Exposure | Soil | Replay | Result | Wash, cold | Wash, warm | Peak RSS | GPU buffers |
|---|---|---|---|---|---|---|---|---|---|---|
| Tutorial, fast | 89,481 | 2.6 | 9.0 | 0.1 | 0.3 | 0.1 | 12.3 | 3.3 | 580 MB | 46 MB |
| Tutorial, official | 337,019 | 4.7 | 68.4 | 0.2 | 0.6 | 0.2 | 74.4 | 6.5 | 1,113 MB | 96 MB |
| Weeknight dinner, fast | 187,117 | 3.8 | 13.6 | 0.3 | 0.8 | 0.2 | 19.0 | 5.5 | 806 MB | 66 MB |
| Weeknight dinner, official | 724,297 | 10.7 | 139.5 | 3.8 | 4.6 | 1.5 | 160.5 | 21.2 | 1,479 MB (1,743 warm) | 116 MB |
| Dinner party, fast | 207,505 | 7.1 | 21.1 | 0.5 | 1.1 | 0.5 | 30.9 | 8.9 | 766 MB | 76 MB |
| Dinner party, official | 803,235 | 12.0 | 170.6 | 1.9 | 3.6 | 1.2 | 189.9 | not measured | 1,382 MB | 125 MB |

Starting the process and loading the simulation takes 0.2 to 0.5 s and the hydraulics under
0.1 s. The exposure is nine tenths of a cold wash at the official tier and reports four times
(once per spray pattern, 17 to 45 s apart there), which is why the estimate of the time remaining
is counted down between reports. Peak resident memory is that of the worker process as the
operating system counts it (`getrusage`, confirmed by sampling `ps` four times a second); the GPU
figure is the largest total of live buffers on the device, which on Apple silicon is memory of
the same machine but is not all counted in the resident set. The tutorial's warm figure at the
fast tier is from a separate run; the dinner party's warm wash at the official tier was not
obtained because the simulation's source changed between its two washes (the second recomputed
the exposure, in 272 s on a busier machine, and gave another result hash, as it should). The
report of the largest load is 44 kB of JSON and its residue maps 0.2 MB at the fast tier and
0.8 to 1.4 MB at the official tier, which is why they are fetched per item.

The built-in stage estimates (`STAGE_MODEL`) are straight lines through these: at the fast tier
scene 2.0 s + 0.065 s an item and exposure 7.5 s + 0.18 s an item; at the official tier scene
5 s + 0.105 s an item and exposure 67 s + 1.5 s an item.

**Checks.** `pnpm --filter @spotless/web wash-shots` (section 7.2) checks the painting in numbers
on every item with residue: each tile the page draws is carried back into the item frame by the
pose the page draws the item at and measured against the surface of the item's shape, and the
load is washed once more in the script's process from the server's manifest (exposure from the
server's cache), the simulation's visibly soiled cells are carried into the tub frame by the exact
settled pose, and every tile must have its cell within 1 mm, one tile a cell. On 2026-10-10 at the fast tier, over the ten items with residue of the two loads (1 to 3,009
tiles each): every tile within 0.134 mm of the item's surface as the page draws it (0.12 mm of
that is the tile's own lift) and within 0.022 mm of the simulation's cell, and the repeated wash
gave the server's result hash. The comparison with the simulation is only made when the
simulation's source is the same for both washes (the version the wash was keyed by, the one the
worker reports and the script's own, before and after); otherwise the script says so and checks
the surface only.
`packages/server/src/wash-sim.test.ts` runs the real simulation through the server's queue and
worker on a two-item load at the fast tier and checks stages, report, residue maps on the item's
surface with outward normals, the caches (result cache hit, exposure cache hit with the same
result hash), restore after a restart, and the failure paths.

### 7.4 Agents, the harness and the human baseline

How to run all of this, and the table of what each kind of player sees, is in
`docs/benchmark/README.md`. This section says how it is built.

**Render service** (`packages/render/src/headless`, `packages/server/src/render-service.ts`).
`HeadlessRenderer` starts Chrome through puppeteer-core and loads one page whose script is
`page-entry.ts` bundled by Vite (kept on disk under a fingerprint of the sources of `render`,
`geometry`, `core`, `catalogue` and `machine`). The page builds a `SpotlessScene` per level and
machine configuration and keeps it; a picture is then poses, a camera and marks in, PNG out. All
decisions are taken in Node by pure functions (the camera of a view, the grid and labels as
marks); the page only paints. `createRenderService` is the server's side: it turns a session
and a `render` request into that, keeps pictures by a hash of the level, the state hash, the
phase, the wash and the request (the key carries the fingerprint of the drawing code), and
supplies the four pictures of `get_item`. After a wash, while the load is as it was washed, the
items are drawn bare with their residue, as the page draws them. The same state and view give
the same bytes on one machine, also from a second Chrome (tested). Measured on the M3 Pro
(2026-10-10): first picture 1.3 s after the server starts (2.2 s when the page script has to be
built), then 17 to 56 ms a picture at 768 px (median 31 ms), 6 ms from the cache.

**MCP server** (`packages/mcp`). `createSpotlessMcpServer({ game })` registers the thirteen tools
with the contract's names; arguments are strict zod schemas with the contract's enumerations and
a description of every field, results loose ones (a result may gain fields). It reaches the game
through `GameClient`, an HTTP client bound to one session that holds no admin token: an MCP
connection plays the one episode the harness created and can neither create nor list sessions.
A call the game refuses comes back as a tool error with the rejection as structured content, and
has changed nothing. Pictures are MCP image content; the structured result carries their size
only. The manual of the level and the loading guidance are resources. `get_report` takes one
argument of its own, `wait_s`: the MCP server waits (looking at the free summary endpoint) for
the wash to end before it asks the game. Every call goes out on a connection of its own
(`http-once.ts`): a pooled connection that the server closed while the client's process was busy
fails the next request, and a call of the game must not be sent twice. For the same reason the
streamable HTTP endpoint (`http.ts`) never closes an idle connection itself
(`keepAliveTimeout = 0`): the SDK's transport answers `Connection: keep-alive`, and a client
that was stalled for longer than Node's five seconds lost its next call.

**Harness** (`packages/bench`). `runEpisode` creates the episode, connects an MCP client to its
MCP server (in memory, stdio or streamable HTTP), lets a `Policy` play, starts the cycle if the
policy did not, waits for the wash (one retry of a failed wash), verifies, and writes the
record. Scripted policies are the loaders of `@spotless/loader` played on a session of their own
and re-issued call by call through the tools (`scripted.ts`); the model policy (`llm.ts`) is one
loop over a small provider interface, with an implementation for Anthropic's Messages API
(`anthropic.ts`) and one that plays a script (`scripted-provider.ts`). The context policy
(`context.ts`) keeps the whole conversation as text and the most recent pictures, removing old
ones in batches. `results.ts` reduces records to the table.

**Player identity and episode records** (`packages/server/src/episode.ts`). The server writes
one `EpisodeRecord` per session when its wash ends: level and versions, the player, every call
with its time, counts and budgets, the load, the report and the score. The harness adds the
policy, the tool calls, the tokens and the verification. A person's record holds what they did
and when, and nothing else.

## Status, 12 October 2026

Written at the close of the weekend's build, in the first hours of 12 October. What follows is
the state of the game side against this document; the wash simulation's state is at the end of
`scope.md` and in `docs/validation/README.md`.

### Built

- Everything in sections 2 to 7: the geometry kernel, deterministic loading physics, the session
  with its actions, queries and budgets, the levels, the game server with its wash queue and
  render service, the page, the MCP server and the benchmark harness.
- **The machine is the owner's Bosch**, not the SPOT-60 baseline this document started from. Its
  upper basket was corrected on 11 October from his floor-level photograph: `list_slots` offers
  two side rests (`rest_left`, `rest_right`, kind `cup_rest`) on which cups, mugs and glasses
  lean, saucers and dessert plates seat in rows A, A' and C, and a lowered cup shelf offers a
  seat. A pose through the roof of the tub is refused and names `tub.roof`. The tool
  descriptions of the MCP server say all of this.
- **A course of seven levels** in order of difficulty (`docs/benchmark/levels.md`): every level
  carries `number`, `difficulty` and `newHere`, the server's list passes them through and the
  page shows them. No level offers a programme other than Eco 50, and nothing a player or an
  agent reads names another. The six generated levels are out of the list; the generator is
  kept.
- **Twenty-five saved loads**: careful, careless and random on each of the seven levels, and four
  standard loads (`iec-13-careful`, `iec-13-careless`, `half-careful`, `owner-2026-10-10`). All
  replay to their hashes on the final code (`check-loads` on 12 October: 25 of 25 give the same hashes, their baskets travel and every recorded mistake holds). The four standard loads still
  name Auto 45-65 as their level's programme, because the machine data's `primaryProgramme` does
  and changing it makes the parameter set stale; the wash command washes them on Eco 50.
- **A model can play a full level** (11 October). An action answers with what it changed and not
  with the whole scene; slot advice is a ranked list a screenful at a time; the harness folds a
  long conversation. Two models played three levels of the course at the official tier, in 105
  to 122 turns and 2.5 to 3.2 million input tokens a full level
  (`docs/benchmark/first-runs/course/`).
- **The page after the first play test** (11 October): a piece is drawn where it would be
  let go, coloured by what it would land on; turning by keys or the wheel; a choice between a
  quick preview and the full wash when the cycle is started; the cutlery basket and the shelves
  drawn as lattices; music; the levels numbered with their difficulty. No programme but Eco 50
  is named on the page.
- **The tub's side walls push a leaning piece in** while a basket travels, once it leans out
  further than the gap to the wall (9.5 mm on the left, 10.5 mm on the right of the lower
  basket). `check_load` says which wall pushed which piece (`shifted[].pushed_by`) and, for a
  piece that still leans out, over which side and what it touches; the page words both as
  facts. A test holds it at 5, 10 and 20 mm (`packages/session/src/tub-clearance.test.ts`).
- **Slot advice is held to what `place` accepts**: a suggested seat that `place` would refuse as
  out of bounds is marked `drop_free: false` with what blocks it.

### Deferred or open

- **Placing by pointing on the page** is unreliable in two cases. A plate pointed at the gap next
  to a placed plate perches on its neighbour (the game's own seat is lower and further along the
  rail, and only `list_slots` finds it). Cups and glasses cannot be leant on the side rests by
  pointing (the seats are leaning poses that only `list_slots` gives). "Suggest spots" does both,
  for one query.
- **The Anthropic path of the harness has never run against the real API.** What a fold of the
  conversation does to such a model's carried reasoning is therefore unrun.
- **The human baseline**: only the mechanism (links, names, records). No participant has played.
- **Capacity.** The 13-place standard load holds 114 of the rated 140 pieces. That is the model's
  loader on a basket with two inferred heights, not the capacity of the machine. Seats on or
  under the lowered cup shelves rest on an inferred height that has not been measured by tape
  (`docs/calibration/protocol.md`, "Measurements of the machine still open").
- **The gap between the lower basket and the tub** comes from a photograph, good to about 6 mm a
  side. The owner's chopping board leaned out 7.7 mm in the model and passed untouched; the owner
  reports that the real tub pushed it upright. A tape reading settles it. On the right wall a board leaning
  out about 16 mm sometimes stops the basket (4 of 8 poses): the wall is a sheet with a square
  front edge and no lead-in.
- **The scripted players.** The careful policy places no pan, dish, tin, tray or board, so it is
  not a ceiling (both models beat it). The careless policy cannot get a bowl to lie in another
  or two plates into one slot on the present baskets, cannot block the tablet or stall an arm on
  purpose, and cannot turn the tutorial's cups, which is why the tutorial fails its gate.
- **`rotation_deg` in the result of `place`** cannot tell a fork that spun in its cell from one
  that fell; a lean from the vertical is wanted. `list_slots` for a cup when every rest is full
  answers with no places, which reads as "never has a place". `set_rack` on the upper basket
  lists lower-basket plates among its changes, moved by fractions of a millimetre.
- **Collision shapes** are faceted up to 0.5 mm inside the true surfaces, so round items overlap
  by up to 0.83 mm on true shapes while the settle is complete on the collision pieces.
- Placing onto an untidy pile can take seconds to a minute and blocks the server while it does;
  `list_slots` for a plate takes 2.5 to 4.8 s once neighbouring slots are full.
- The rims of the baskets and the box of the cutlery basket are not on the rack card, so an
  agent sees in a picture what the page has as free geometry.

### Open design questions

These were left open by the build. Each is given with the answer the code takes today. An
issue or a pull request that argues one of them is welcome (`docs/ROADMAP.md`).

- Whether the page's taking up of tine rows should cost an agent a query, or be given to agents on
  the level card. Today the page keeps it free and an agent pays one query.
- Whether carried reasoning is dropped at a fold of the conversation for every provider, so that
  models of different providers are run alike. Today it is not.
- Whether a published result states a cost. The six model episodes so far were run without
  prices: the harness records tokens always, and a cost only when prices are given in `.env`.
- The music. Five CC0 pieces chosen by description and by measurement; nobody on the build
  had heard them when this was written. Open: whether the feel is right; whether the quiet joins
  between pieces read as the music stopping; whether it should pause in a hidden tab; whether
  the clink and the door thud (off by default) are kept; whether a marker is missed now that the
  jingle at the report is gone. On provenance: the licence is as stated on each track's page
  (CC0; `apps/web/public/audio/LICENSES.md`), and the project has no other knowledge of how
  the tracks were made. Another pack that was considered (Celestial Adventures) has no licence
  that allows redistribution, so it is not used.
- On the page: whether the yellow warning ("let go above the floor, may tip") is too loud (an
  upside-down glass is yellow almost everywhere in the lower basket); whether Esc after picking
  up a placed piece should be a true undo (it costs a second action and re-drops the piece; a
  true undo needs a change to the session); whether the upper basket's three-quarter view
  should move (the folded cup shelves stand in front of its right third; it is a named view
  agents also receive).
- Whether water left standing in an item should by itself fail it (the bracket in section 6).
  Today soil only, with the residue of that water counted as soil.
- Whether a piece dropped out of the machine should cost an action. Today it does, for
  agents and people alike; the page refuses the two drops that caused it in the first play
  test.
- Whether agents are told a level's number and difficulty. Today people see them in the list
  and agents read only the "New: ..." sentence of the summary.
- What a power log of a run would settle, and whether a test wash is run with the test pieces
  alone or in a normal load, are in `docs/calibration/protocol.md`; no run has been logged.
- The questions about how runs are compared and about the levels and the score, each with what
  the code does today, are collected in `docs/benchmark/README.md` section 10 ("Open
  questions").
