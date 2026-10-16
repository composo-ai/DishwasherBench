# Scope and build order for the wash simulation

This note records what is built first and what is out of scope. It follows the aim of
the project, set on 2026-10-09 and referred to below as "the direction":

1. The simulation must be **accurate where it matters: how items are stacked must determine how well
   they are cleaned.**
2. It must be **calibratable** against test washes run on the real machine.
3. Effectiveness counts, elegance does not. **Take sensible shortcuts** to fit the compute budget.

`sim-core.md` remains the reference for how each module works (equations, records, parameters).
**Where this note and `sim-core.md` differ, this note wins.**

## What links stacking to cleaning (must be right)

In order of effect on the result. Every item here is in the first build.

1. **Jet access.** Which nozzle, at which arm angle, reaches which surface, and what is in the way
   (other items, rack wires, the cutlery basket). Exact geometry, measured nozzle positions and
   directions, arm kinematics.
2. **What a jet does where it lands.** Pressure, shear and momentum along each footprint track, from
   the closed forms, each with a calibration scale.
3. **Indirect water.** Splash and secondary droplets, drips and run-off from items above, and films
   running down and along surfaces under gravity. This decides which shadowed surfaces are wetted,
   with how much water, for how long.
4. **Drainage and pooling.** Which way a surface faces: what drains, what holds dirty water.
5. **Contacts and nesting.** Surfaces that touch or nearly touch get little or no water.
6. **Machine-level effects of the load.** A blocked arm, a blocked dispenser, water trapped in upright
   vessels, which spray level reaches which basket.
7. **Soil response.** Per soil type, with thresholds, temperature and chemistry, on parameters that
   can be fitted.

## Decisions

| Topic | First build | Deferred until calibration data asks for it |
|---|---|---|
| Surface water | The kinematic cascade (solver K of `sim-core.md`) on every surface, with line elements for wires, basins, pools and the drain-down. This is the "K-only" variant that `sim-core.md` section 7.4 already defines | The inertial film solver (S), its contact-line model, its fixtures (F6) and its gates |
| Ray and droplet queries | A triangle hierarchy over the geometry kernel's meshes, with the hit point and normal corrected to the exact analytic surface. This is the fallback `sim-core.md` decision D4 already allows, and the GPU spike measured it | The analytic two-level tracer |
| Surface elements | Structured patches as in `sim-core.md` section 3 (shells of revolution, planar faces, lines) | Finer film cells on rivulet-prone plastics |
| Jets | Phase-domain trace and closed-form gather as in `sim-core.md` M5 | Offline closure campaigns; the retarded ring emitter may be simplified to a direct deposit at the fan limit |
| Secondary water | Monte Carlo droplets into deposition tables as in M6 | Pilot-guided importance sampling (uniform allocation first) |
| Whole cycle | Replay every arm revolution against cached exposure, as in section 5.5 | The transient (post-switch) exposure records, if the steady records plus drain-down merge prove sufficient |
| Soil | The soil model of M8 with the classes that have data first (dried egg yolk, starch, dried ketchup-type adhesive soil, fats, a soluble soil, a bleachable stain) | Further classes |
| Item motion during the wash | The load is static; items the jets would probably lift are flagged in the report | Out of scope |
| Tiers | One official tier and one fast tier | Reference tier, browser build |
| Process | Each kernel is benchmarked when it is written and the budget table is updated from those numbers | A separate measurement milestone; the 30-minute soak happens on the first end-to-end run |

Simplifications inside a module are welcome when they keep the seven dependencies above and the
calibration hooks. Every simplification is listed by the engineer who makes it, with what it
ignores, so that calibration can tell whether it matters.

## Out of scope

The wash ends at the last drain, with the load where it was placed. Drying and the drips that
fall after the last drain, spots and film on glass, items moved by the jets, soil from the wash
water settling on clean items, thick layers flaking off, and where a tablet lands when it falls
outside its tray are out of scope and will not be modelled. The report still flags an item the
jets would probably lift, and what the wash water held is left as residue only where water
stands on an item at the end. The nine phenomena of the suite that turn on these (P21, P23,
P26, P34, P38, P39, P41, P42 and P43 of `docs/research/standards.md` section 9) stay in the
suite and are reported as out of scope.

The simulation washes on one programme of the machine, Eco 50. Other programmes are out of
scope: the machine data, the game, the benchmark, the calibration and the test washes of
`docs/calibration/protocol.md` know only Eco 50. P27 and P32, the two phenomena the suite tested
by comparing programmes, were removed from it.

## Calibration is a first-class feature

- Every physical constant lives in the parameter registry with a default, a range and a source.
  Nothing is hard-coded.
- Exposure (everything up to and including the water model) is cached by a key that excludes the soil
  and chemistry parameters, so that changing those and replaying a wash takes minutes.
- A **wash record** format describes a real test wash: the machine and programme, each item with its
  soil (type, amount, how it was applied and aged), where it was placed, and what was observed
  afterwards per item and region (clean or not, residue area, photographs). The simulator can be run
  on a wash record and scored against the observations.
- A fitting tool adjusts chosen parameters to minimise the disagreement over a set of wash records,
  and reports which parameters the data can and cannot identify.
- Machine quantities that can be measured directly (nozzle sizes and directions, heights, arm speeds,
  a power log of a cycle) are entered as data, not fitted.

## Build order

1. Foundation: GPU wrapper, parameter registry, typed records.
2. Machine: the owner's Bosch as data and geometry, with his measurements.
3. Scene: patches and the ray hierarchy for a loaded machine.
4. Jets and secondary water: exposure of every surface to direct and indirect water.
5. Surface water: cascade, wires, basins, drain-down.
6. Soil, liquor and the whole-cycle replay; result per item.
7. Inspector (clean or not per item) and the report.
8. Wash records and the fitting tool.

The game platform (session, levels, 3D client, agent interface) is built alongside, because placing
a real test load in the simulator needs it. (The list is the plan as it was made; the status
below says how far each step got.)

## Status, 12 October 2026

Written at the close of the build, on 12 October.
`docs/validation/README.md` has the evidence; this is the state against the plan above.

### Built

Every step of the build order exists and runs end to end.

- The seven dependencies of "what links stacking to cleaning" are all in the wash as mechanisms:
  jet access on exact geometry, what a jet does where it lands, splash and run-off, drainage and
  pooling, contacts, the machine-level effects of a load (a held arm, a blocked tray, water held
  in vessels), and a soil response per soil type on fitted or fittable parameters. **That they
  are in the wash does not mean a verdict answers to them yet**: see "Where the wash falls short
  of the direction" below.
- Two tiers, official and fast. A cold official wash of the largest level takes 4.9 minutes
  of the 30-minute budget, and 5 to 8.5 minutes with another job beside it
  (`docs/validation/README.md` section 7).
- Calibration as a feature: every constant in the registry; exposure cached apart from soil and
  chemistry; the wash-record format; the fitting tool with sensitivity and experiment ranking.
  A parameter set records the state of the water side and of the machine data it was made for;
  the default wash refuses to run on a stale one, and a superseded set says in its own file
  what replaced it. The one current set is `anchored-v7.owner-capsule`.
- The game platform alongside: session, a course of seven levels in order of difficulty,
  server, page, agent interface, benchmark harness, scripted reference players. Two models
  have played three levels of the course at the official tier (six episodes).
- Since 11 October (late), what the wash water held is left as residue where water stands on
  an item at the end. A glass or mug left mouth up therefore comes out not clean.

### Deferred

- The right-hand column of the decisions table. No report of the build records any of it as
  built: the inertial film solver, the analytic two-level tracer, finer film cells on plastics,
  offline closure campaigns for the jets, importance sampling of droplets, the transient exposure
  records, the reference tier and a browser build of the wash.

### What changed in direction

- **The game is scored on Eco 50** (decided on the evening of 10 October). Eco 50 is a fixed
  course with no decisions by the machine's sensors, so its temperatures and durations are known.
- **The first calibration on the owner's machine** (wash 01: four egg-yolk plates on Eco 50, run
  on 10 October, read on 11 October). The prediction written beforehand had the order of the
  plates right and the amounts too optimistic. The wash rejected the default of that night and
  moved one number: the share of the long soak during which the pump runs, 0.5 to 0.8 (anywhere
  from 0.59 to 1). 0.8 is now the registered default.
- **The upper basket was corrected from the owner's floor-level photograph** on 11 October: its
  floor has two ridges with sloped rests along the side walls, on which cups, mugs and glasses
  lean. Every saved load was made again, and the parameter set was made current on the
  corrected machine (`anchored-v7`: one value moved, the bleach rate, 0.001 to 0.0009). Two
  heights are still inferred and have not been measured by tape (a lowered cup shelf; the hub of
  the upper arm): `docs/calibration/protocol.md`, "Measurements of the machine still open".
- **A closure for faces lying within a millimetre or two of another body** (dependency 5,
  "contacts and nesting", below the size of a block) was built and reviewed twice on 11 October
  and is **not merged** (it is not in this repository). Switched on it breaks the cutlery control
  and still leaves a nested spoon clean, and its deciding parameter has no measurement behind it.

### Where the wash falls short of the direction

The direction is that how items are stacked decides how well they are cleaned. Two independent
reviews on the evening of 11 October washed loads built to test that, and found:

- **It holds for hollow pieces.** A glass, mug or pot left mouth up or on its side comes out
  not clean; mouth down on a rest it comes out clean. That one thing is about three quarters of
  the gap between a careful and a careless load on every level of the course.
- **It holds when the detergent never arrives** (a blocked tablet tray) for protein soils, and
  for a bowl or a spoon that truly lies in another.
- **It holds little for plates and cutlery.** With the soak spraying 0.8 of the time, every
  open face is wet throughout and its water is renewed, so the chemistry cleans it whether or
  not a jet reaches it. A lower basket loaded with plates fallen over and the upper arm held
  still came out with every piece clean, at both tiers. Turning a plate to the wall, crowding
  cutlery into one cell and stalling an arm cost little or nothing. Whether the real machine
  is as forgiving on Eco 50 has one reading: in the owner's second test wash two air-dried yolk plates in one slot, one a slot behind them and
  one lying flat came out with no egg seen, the flat one after a light rinse
  (`docs/calibration/owner-wash-02-result.md`; one wash, judged by eye, not yet fitted). The
  loading advice and the effect sizes of the phenomena checklist that say otherwise are
  estimates (`docs/research/standards.md` section 0.2). The owner's first wash showed an
  oven-dried plate turned to the wall keeping more egg than its partner (about 100 mm² against
  25, one pair, the turned one nearer the wall) and the air-dried pair coming clean either way.

The calibration that moved the soak from 0.5 to 0.8 is what made open faces insensitive: at
0.5 a careless standard load came out with about 11 fewer clean items than a careful one, at
0.8 with 5 or 6 fewer (on the loads of each day, which differ).
The owner's plates say the soak does spray that much. Washes 2 and 3 of
`docs/calibration/protocol.md` measure whether nested and crowded pieces come out dirty on the
real machine; until one shows that they do, no mechanism for covered faces is planned.

### What the next test washes are for

None has been run as written; anyone with this machine can run one. In the order of
`docs/calibration/protocol.md`: hollow pieces the right and the wrong way up,
with tea in mugs (the soil class every level's margin rests on, and the bleach rate); porridge
bowls nested and free (water in a gap); nested and crowded cutlery (whether stacking matters
for them). The owner's second test wash put two plates in one slot, as the third also asks,
with the yolk not weighed (`docs/calibration/owner-wash-02-result.md`).
