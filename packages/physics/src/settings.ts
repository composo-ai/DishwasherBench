/**
 * Every tolerance and limit handed to Jolt, set explicitly. Jolt's own defaults are tuned for
 * metre-scale games and are wrong by an order of magnitude at tableware scale (2 mm walls, 4 mm
 * wires): out of the box it leaves a plate 0.76 mm inside a wire and nested bowls 7 mm inside
 * each other (docs/research/spike-rigid-body.md).
 *
 * Provenance of each value:
 * - [VERIFIED bake-off]: measured in the rigid-body bake-off on the reference machine
 *   (docs/research/spike-rigid-body.md, "tuned" preset with continuous collision detection);
 * - [MEASURED here]: measured with this package's own scenes (the tests named in the comment
 *   keep the measurement alive);
 * - [ESTIMATED items 5.x / 11.x]: a recommendation of docs/research/items.md not yet measured;
 * - [JOLT DEFAULT]: Jolt 5.6.0's value, kept and written out so that an engine upgrade cannot
 *   change it silently. The bake-off ran with these, so they are covered by its results.
 * Units are SI (metres, seconds, radians, m/s).
 */

import type { Vec3 } from '@spotless/core';
import { RESTITUTION_VELOCITY_THRESHOLD } from '@spotless/catalogue';
import { STANDARD_GRAVITY } from '@spotless/core';
import type { SettleOptions } from './types.ts';
import { REST_CRITERION, SETTLE_DISTURBANCE } from './types.ts';

/** Complete set of engine settings of a loading world. */
export interface JoltWorldSettings {
  // ---- units ----
  /**
   * Engine length units per metre. Every length, velocity, impulse and inertia is converted at
   * the boundary of the wrapper; everything else in these settings is SI. Jolt is written for
   * objects of 0.1 to 10 units and carries tolerances that cannot be set (0.02 for the supporting
   * face of a capsule, 1e-4 for its closest-point search, 1e-3 for choosing manifold points), so
   * tableware has to be given to it in units in which it is that large.
   */
  readonly engineLengthScale: number;

  // ---- capacity (fixed when the world is created) ----
  /** Size of the body table. */
  readonly maxBodies: number;
  /** Broad-phase body pairs that can be queued in one step. */
  readonly maxBodyPairs: number;
  /** Contact constraints (one per pair of touching pieces) that can exist in one step. */
  readonly maxContactConstraints: number;

  // ---- stepping ----
  /** Collision-detection passes per call to step (each uses the whole time step when 1). */
  readonly collisionSteps: number;
  /** Solver velocity iterations per step. */
  readonly numVelocitySteps: number;
  /** Solver position (penetration recovery) iterations per step. */
  readonly numPositionSteps: number;
  /** Fraction of the remaining penetration removed per position iteration, 0 to 1. */
  readonly baumgarte: number;
  /** Warm-start the solver from the impulses of the previous step. */
  readonly constraintWarmStart: boolean;
  /** Sort contacts and islands so that the result does not depend on discovery order. */
  readonly deterministicSimulation: boolean;
  /** Split large islands for parallel solving (no effect in the single-threaded build). */
  readonly useLargeIslandSplitter: boolean;

  // ---- contact generation ----
  /**
   * Largest distance at which a contact is created before the surfaces touch, metres. It is
   * what a fast approach gets; slow pairs get less, see `restingContactDistance`.
   */
  readonly speculativeContactDistance: number;
  /**
   * Distance inside which two pieces always get a contact, however slowly they approach, metres.
   * Beyond it a contact is only created when the two pieces could close the gap within the
   * step: when the gap is below `speculativeSpeedFactor` times the time step times the speed
   * at which their closest points approach each other along the line between them (from the
   * velocities of the two bodies before the step, plus what gravity adds in one step), and
   * never beyond `speculativeContactDistance`. Without this rule every pair of pieces of two
   * stacked or nested items that lies within `speculativeContactDistance` costs a contact
   * constraint, thousands per pair of plates, and a full load exceeds
   * `maxContactConstraints`. It must be at least `speculativeSpeedFactor * g * dt^2` (0.26 mm
   * at 1/240 s), what a body released at rest falls in its first step.
   */
  readonly restingContactDistance: number;
  /** Safety factor on the closing speed in the rule of `restingContactDistance`. */
  readonly speculativeSpeedFactor: number;
  /** Penetration left uncorrected so that resting contacts do not flicker, metres. */
  readonly penetrationSlop: number;
  /** Largest penetration corrected by one position iteration, metres. */
  readonly maxPenetrationDistance: number;
  /** Distance within which points count as coplanar when a contact manifold is built, metres. */
  readonly manifoldTolerance: number;
  /** Merge the manifolds of different pieces of one body pair when their normals agree. */
  readonly useManifoldReduction: boolean;
  /** Angle between normals below which manifolds would be merged, radians (reduction only). */
  readonly contactNormalMaxDeltaRotation: number;
  /** Reuse last step's contact points while two bodies have barely moved relative to each other. */
  readonly useBodyPairContactCache: boolean;
  /** Relative translation up to which the contact points of a body pair are reused, metres. */
  readonly bodyPairCacheMaxDeltaPosition: number;
  /** Relative rotation up to which the contact points of a body pair are reused, radians. */
  readonly bodyPairCacheMaxDeltaRotation: number;
  /** Distance a contact point may move and still inherit last step's impulse, metres. */
  readonly contactPointPreserveLambdaMaxDistance: number;
  /** Squared vertex-matching tolerance of internal edge removal, m^2 (feature not enabled). */
  readonly internalEdgeRemovalVertexToleranceSq: number;
  /** Ignore contacts with inactive edges of meshes (no meshes are used; kept at the default). */
  readonly checkActiveEdges: boolean;
  /** Approach speed along the normal below which restitution is treated as zero, m/s. */
  readonly minVelocityForRestitution: number;

  // ---- continuous collision detection ----
  /** Sweep every dynamic body along its motion each step (Jolt's LinearCast motion quality). */
  readonly linearCast: boolean;
  /** Fraction of its inner radius a body must travel in a step before it is swept. */
  readonly linearCastThreshold: number;
  /** Fraction of its inner radius a swept body may end up inside what it hit. */
  readonly linearCastMaxPenetration: number;

  // ---- sleeping ----
  /**
   * Let groups of bodies that have come to rest stop being simulated until something touches
   * them. The decision is the wrapper's, never the engine's: a group of dynamic bodies
   * connected by contacts is put to sleep when every one of them has met the rest criterion
   * below. (The engine's own test is a distance test, three points of a body within 2.5 mm for
   * 0.5 s, which freezes slowly accelerating, toppling and rocking bodies in mid-motion; it is
   * switched off.)
   */
  readonly allowSleeping: boolean;
  /** Linear speed below which a body can count as at rest, m/s. */
  readonly restLinearSpeed: number;
  /** Angular speed below which a body can count as at rest, rad/s. */
  readonly restAngularSpeed: number;
  /** Time both speeds must stay below their thresholds, seconds. */
  readonly restHoldTime: number;
  /** Engine parameter, unused while the engine's own sleeping is off: its hold time, seconds. */
  readonly timeBeforeSleep: number;
  /** Engine parameter, unused while the engine's own sleeping is off, m/s. */
  readonly pointVelocitySleepThreshold: number;

  // ---- bodies ----
  /** Linear velocity damping, 1/s. */
  readonly linearDamping: number;
  /** Angular velocity damping, 1/s. */
  readonly angularDamping: number;
  /** Clamp on linear speed, m/s. */
  readonly maxLinearVelocity: number;
  /** Clamp on angular speed, rad/s. */
  readonly maxAngularVelocity: number;
  /** Multiplier on gravity per body. */
  readonly gravityFactor: number;
  /** Integrate the gyroscopic torque. */
  readonly applyGyroscopicForce: boolean;
  /** Extra run-time filtering of contacts with shared internal edges. */
  readonly enhancedInternalEdgeRemoval: boolean;
  /**
   * Lower bound on the smallest principal moment of inertia as a fraction of the largest; 0
   * disables it. A bound makes rod-like bodies roll too slowly (it is their rolling inertia
   * that is raised), so it should only be as large as the solver needs.
   */
  readonly minPrincipalInertiaRatio: number;

  // ---- shapes ----
  /** Rounding given to pieces that ask for none (sharp boxes and hulls), metres. */
  readonly minConvexRadius: number;
  /** Largest deviation that rounding may introduce on a sharp piece, metres. */
  readonly sharpPieceMaxError: number;
  /** Distance from the hull within which a point is treated as on it when hulls are built, metres. */
  readonly hullTolerance: number;
  /**
   * Largest error accepted, metres, where a rounded edge is left to the flat faces beside it
   * instead of being given its own capsule: the height of the circular arc over its chord. The
   * engine builds the contacts of the simulation from flat faces, so every rounded piece is
   * split into a sharp hull of its flats and capsules along its exposed edges; this decides
   * which edges count as exposed.
   */
  readonly roundedEdgeSag: number;
  /**
   * The same allowance for the fold between two flat pieces of one thickness, the sectors of a
   * wall, metres. There the two prisms are mitred (each ends on the plane that bisects the
   * fold), so that without a capsule the fold stands proud of the rounded one by
   * `r (1 / cos(fold / 2) - 1)`, which is within a few per cent of the sag this bounds.
   */
  readonly roundedFoldSag: number;
  /**
   * Whether a contact between a round piece (a wire, a tine, the rounded edge of a hull) of a
   * rack, basket or other body that is not free and a piece of a free body that is still apart
   * from it is only made where the two will really meet, on the velocities they have (see
   * `acceptsHit` in world.ts). Without it the engine holds every such pair to the line
   * between their nearest points, and a block sliding across wires at the height of their tops
   * is stopped by each as by a wall: it slid 23 to 29 % less far across the wires than along
   * them at the end stop of the rack profile. With it, a piece that is struck in the very
   * step in which it was taken to miss a wire stands in that wire afterwards; the rule
   * therefore rests while anything in the world moves faster than a rack does. In the densest
   * load tried (cutlery let go 240 mm above a basket that is already full) one of twelve
   * slightly varied runs still ended in the contact capacity error, none of seven without the
   * rule. [MEASURED here, integration/src/dense-load.test.ts]
   */
  readonly predictRoundContacts: boolean;

  // ---- queries (penetration, sweep) ----
  /** Core separation below which the query treats two convex shapes as touching, metres. */
  readonly collisionTolerance: number;
  /** Relative convergence tolerance of the penetration-depth search. */
  readonly penetrationTolerance: number;

  // ---- rolling ----
  /**
   * Distance by which the round rolling surface of a shell of revolution (`CollisionRound`
   * pieces) stands proud of the true surface, metres. A resting contact sinks in by about the
   * penetration slop; with the surface raised by a little more than that, the flat facets of
   * the wall underneath, whose corners lie on the true surface, stay clear of whatever the item
   * rolls on, and the item ends up within a few hundredths of a millimetre of its true height.
   */
  readonly roundSurfaceProud: number;
  /**
   * Deepest overlap with a round rolling surface that still counts as a contact from outside,
   * metres. The surface belongs to a solid of revolution that spans the cavity of its item, so
   * something inside the item overlaps it by at least the wall thickness and is ignored; the
   * limit actually used for a surface is the smaller of this and 0.6 times its wall thickness.
   */
  readonly roundSurfaceMaxDepth: number;
  /**
   * Largest angle between a contact normal and the normal of a round rolling surface's side at
   * which the contact is taken, radians. Contacts with the flat ends of the solid are not
   * contacts with the item.
   */
  readonly roundSurfaceNormalTolerance: number;

  // ---- contact reporting ----
  /**
   * Gap below which a contact point that carried no load in the latest step is still reported
   * as a contact, metres. Points further apart are the engine's speculative contacts.
   */
  readonly contactTouchDistance: number;

  // ---- contact coefficients ----
  /**
   * `'pair-table'` (the only setting for real use) takes friction and restitution of every
   * contact from the caller's pair lookup through a contact listener. `'body-material'` is a
   * diagnostic: it gives every body the coefficients its own material has against itself and
   * lets Jolt combine them (geometric mean, maximum), with no listener installed.
   */
  readonly contactCoefficients: 'pair-table' | 'body-material';
}

/**
 * The settings every loading world is created with: the bake-off's winning configuration
 * ("tuned" preset with continuous collision detection), with the remaining Jolt parameters
 * written out, and three departures from it that were measured here: the engine works in
 * centimetres (`engineLengthScale`), the body-pair contact cache is reused only within 0.1 mm
 * and 0.1 degree, and rounded pieces reach the engine as flat-faced hulls with capsules on
 * their exposed edges (`roundedEdgeSag`).
 */
export const JOLT_SETTINGS: JoltWorldSettings = {
  // Centimetres [MEASURED here]. In metres (the bake-off's choice) Jolt's hard-coded 2 cm capsule
  // slop made a 2 mm capsule standing end-on on a flat face produce contact points 10^9 km away,
  // which launched a bowl at 500 m/s; its fixed 0.1 mm closest-point tolerance equals the whole
  // penetration slop. In centimetres those become 0.2 mm and 1 micrometre, and a plate is 26
  // units across.
  engineLengthScale: 100,

  // Capacity. The build's scratch allocator is a fixed 10 MB, which bounds
  // maxContactConstraints at about 16000 [VERIFIED bake-off]. 15360 is used, half as much again
  // as Jolt's default of 10240: a dense load of 140 items peaks near 3000 while it is being
  // loaded one item at a time and twelve dinner plates dropped on each other all at once at
  // 9800 [MEASURED here, integration dense-load tests]. The world refuses a step that comes
  // within 10% of the limit (`ContactCapacityError`).
  maxBodies: 10240,
  maxBodyPairs: 65536,
  maxContactConstraints: 15360,

  // One collision pass per step [VERIFIED bake-off]; the fixed step itself comes from the caller.
  collisionSteps: 1,
  // 20 velocity and 4 position iterations. The bake-off ran with 10 and 4 [VERIFIED bake-off];
  // with 4 and 1 the resting penetration of twelve plates rose from 0.080 to 0.135 mm. With 10
  // the solver does not converge for a tall piece standing on a small flat (a knife on its
  // handle end in a basket, 16 contact points): it wobbled for ever at 0.07 rad/s and 7 mm/s,
  // 0.1 degree to and fro, just above the rest speeds, which the engine's own sleeping used to
  // hide by freezing it. With 20 it stands still and the full load is asleep after 2.5 s
  // [MEASURED here, full-load test]; the deepest resting overlap of the sixty-item mixed load
  // fell from 0.087 to 0.025 mm, and a step with everything awake costs about 15 % more, which
  // is paid back by the load sleeping sooner.
  numVelocitySteps: 20,
  numPositionSteps: 4,
  baumgarte: 0.2, // [JOLT DEFAULT]
  constraintWarmStart: true, // [JOLT DEFAULT]
  deterministicSimulation: true, // [JOLT DEFAULT] required: platform.md section 2
  useLargeIslandSplitter: true, // [JOLT DEFAULT] no effect single-threaded

  // 5 mm [VERIFIED bake-off]: a body that travels no more than this per step (1.2 m/s) cannot
  // reach a surface without a contact having been created for it first; faster ones are swept
  // (linearCast). 20 mm (Jolt's default) was 3 to 10 times slower and left 0.54 mm cutlery
  // overlap. The 2 mm that items 5.5 estimates is too little [MEASURED here, scenarios T6]: a
  // knife thrown flat at 2 m/s then sinks 1.4 mm into the wires, at 5 m/s 3 mm.
  speculativeContactDistance: 0.005,
  // 0.3 mm and 1.5 [MEASURED here, integration dense-load tests]. With the 5 mm margin applied
  // to every pair, two stacked dinner plates made 5103 contact constraints of which 155 carried
  // load, three plates exceeded the capacity, and so did the 56th piece of cutlery in a basket.
  // Stacked plates face each other across about half a millimetre over their whole area, so
  // the resting margin has to stay below that; 0.3 mm is three times the penetration slop. The
  // thrown-knife regression (scenarios T6) is unchanged because a fast approach still gets the
  // full 5 mm.
  restingContactDistance: 0.0003,
  speculativeSpeedFactor: 1.5,
  // 0.1 mm [VERIFIED bake-off], under 10% of the thinnest wall [ESTIMATED items 5.5]. Jolt's
  // default is 20 mm.
  penetrationSlop: 0.0001,
  // [JOLT DEFAULT] 0.2 m, i.e. no limit at this scale. Jolt recovers penetration by moving
  // bodies, not by adding velocity, so the 0.5 m/s depenetration limit of items 5.5 has no
  // counterpart here. Lowering it to 2 mm or to 0.5 mm changed nothing in the full load
  // [MEASURED here]: same time to rest, same deepest overlap. The bake-off's value stands.
  maxPenetrationDistance: 0.2,
  // 0.1 mm [VERIFIED bake-off]; Jolt's default is 1 mm.
  manifoldTolerance: 0.0001,
  // Off [VERIFIED bake-off], the single most important setting: with it on, bowls overlapped by
  // 16.7 mm at worst and 2.7 mm at rest, a tumbler by 2.3 mm, cutlery by 6 mm.
  useManifoldReduction: false,
  contactNormalMaxDeltaRotation: (5 * Math.PI) / 180, // [JOLT DEFAULT] unused while reduction is off
  useBodyPairContactCache: true, // [JOLT DEFAULT]
  // 0.1 mm and 0.1 degree [MEASURED here, scenarios T3]; Jolt's defaults are 1 mm and 2 degrees.
  // While a pair of bodies stays within these of where its contacts were last computed, the old
  // contact points and normals are reused. With the defaults a bowl lowered into another stopped
  // on a stale edge contact 1.36 mm above its nest; with these it nests to 0.16 mm (all of it
  // faceting). The price in the full load is 10% (3.9 against 3.6 ms per step over a 4 s settle);
  // switching the cache off altogether costs 35% (50% while everything is awake) and makes
  // awake cutlery and bowls jitter.
  bodyPairCacheMaxDeltaPosition: 0.0001,
  bodyPairCacheMaxDeltaRotation: (0.1 * Math.PI) / 180,
  contactPointPreserveLambdaMaxDistance: 0.01, // [JOLT DEFAULT] 10 mm
  internalEdgeRemovalVertexToleranceSq: 1e-8, // [JOLT DEFAULT] feature not enabled
  checkActiveEdges: true, // [JOLT DEFAULT] meshes only
  // The catalogue's threshold, so that the number exists once: 0.2 m/s [VERIFIED bake-off],
  // inside the range of 0.05 to 0.3 of items 11.3 [ESTIMATED]. Jolt's default is 1 m/s, above
  // every impact speed of careful loading.
  minVelocityForRestitution: RESTITUTION_VELOCITY_THRESHOLD,

  // On for every dynamic body [VERIFIED bake-off]: without it 3 of 16 knife drops at 5 m/s
  // passed straight through a 4 mm wire; with it none did and the worst penetration was 0.1 mm.
  // Two things to know [MEASURED here]. The world suspends the sweep in every step in which a
  // kinematic body is driven, because Jolt sweeps against a moving kinematic body as if it stood
  // still where it ends the step, which throws about whatever that body carries (twelve plates
  // on a rack at a steady 0.5 m/s: up to 42 mm and 21 degrees out of place; mechanics tests).
  // And the sweep is what a full load costs most while everything is in flight at once: 40 to
  // 80 ms per step for the first 30 steps of 122 bodies released together, against 13 without.
  linearCast: true,
  linearCastThreshold: 0.75, // [JOLT DEFAULT]
  linearCastMaxPenetration: 0.25, // [JOLT DEFAULT]

  allowSleeping: true, // [VERIFIED bake-off] zero creep with or without it
  // The platform rest criterion (platform.md section 5), applied by the wrapper to every body
  // of a group in contact before the group is put to sleep. Jolt's own test is switched off
  // [MEASURED here]: it put a dinner knife to sleep at 20 mm/s and 2.3 rad/s in mid-fall in a
  // cutlery basket, 80 degrees from where it then came to rest when woken.
  restLinearSpeed: REST_CRITERION.linearSpeed,
  restAngularSpeed: REST_CRITERION.angularSpeed,
  restHoldTime: REST_CRITERION.holdTime,
  timeBeforeSleep: 0.5, // [JOLT DEFAULT] unused, the engine's own sleeping is off
  pointVelocitySleepThreshold: 0.005, // [VERIFIED bake-off] unused, as above

  linearDamping: 0, // [VERIFIED bake-off] no artificial damping (Jolt's default is 0.05)
  angularDamping: 0, // [VERIFIED bake-off] (Jolt's default is 0.05)
  // 10 m/s [ESTIMATED]: nothing in loading falls more than 0.6 m (3.4 m/s), so this only bounds
  // what a solver failure can do. Jolt's default of 500 m/s let bodies released several
  // millimetres inside each other leave at 350 m/s [MEASURED, review of this package].
  maxLinearVelocity: 10,
  // 300 rad/s [MEASURED here]: Jolt's default of 47.1 rad/s capped a rolling 6 mm chopstick at
  // 0.14 m/s. 300 rad/s is 0.9 m/s for it and is never reached by anything larger.
  maxAngularVelocity: 300,
  gravityFactor: 1, // [JOLT DEFAULT]
  applyGyroscopicForce: false, // [JOLT DEFAULT]
  enhancedInternalEdgeRemoval: false, // [JOLT DEFAULT]
  // Off. items 5.6 and 11.4 estimate 1/50 against spin instabilities of rod-like bodies, but
  // the bound raised the rolling inertia of both chopsticks 13 times and of knives and forks 2
  // to 2.7 times, so that a round rod on a 1 degree slope picked up speed 7.5 times too slowly
  // [MEASURED, review of this package]. With the true inertia, the rolling and spin
  // resistance and 20 velocity iterations the cutlery scenes settle as before [MEASURED here].
  minPrincipalInertiaRatio: 0,

  // 0.2 mm [VERIFIED bake-off] "small but non-zero": with no rounding at all the bowl stack
  // exploded once. Only applied to pieces that ask for no radius; rounded pieces use their own.
  minConvexRadius: 0.0002,
  // Jolt reduces the rounding of a sharp piece until it deviates by no more than this.
  sharpPieceMaxError: 0.00005,
  // 0.01 mm [VERIFIED bake-off]; Jolt's default of 1 mm would merge the two faces of a wall.
  hullTolerance: 0.00001,
  // 0.05 mm, half the penetration slop [MEASURED here]: with every rounded quad given to the
  // engine as one hull with an inner radius, a plate hovered 0.3 to 0.8 mm clear of its wires.
  roundedEdgeSag: 0.00005,
  // 0.1 mm, the penetration slop [MEASURED here]: at 0.05 mm the fold between the floor and the
  // wall of a dinner plate (26.6 degrees at a half thickness of 2.54 mm, sag 0.068 mm) cost a
  // capsule per sector, 37 of the plate's 251 sub-shapes and a fifth of the time five plates
  // take to settle into a stack. The edges of solids keep the 0.05 mm: without the capsules
  // along its 0.2 mm edges a knife blade thrown flat across a wire at 2 m/s sank 2 mm into it
  // (scenarios T6).
  roundedFoldSag: 0.0001,
  predictRoundContacts: true,

  // 1 micrometre: Jolt's default of 1e-4 engine units, which the simulation itself always uses.
  collisionTolerance: 0.000001,
  penetrationTolerance: 0.0001, // [JOLT DEFAULT] relative, dimensionless

  // 0.15 mm, the penetration slop and half as much again [MEASURED here, rolling tests]: flush
  // with the true surface, the corners of the wall facets reached the floor whenever the round
  // surface had sunk in by the slop, and a glass on its side then needed several degrees of
  // slope to roll over them.
  roundSurfaceProud: 0.00015,
  roundSurfaceMaxDepth: 0.0005, // 0.5 mm, the chord error of the facets that take over below it
  roundSurfaceNormalTolerance: (25 * Math.PI) / 180,

  // 0.02 mm, a fifth of the penetration slop (a reporting choice, it does not affect the motion).
  contactTouchDistance: 0.00002,

  contactCoefficients: 'pair-table',
};

/**
 * Fixed time step of the loading simulation, seconds: 1/240 s [VERIFIED bake-off]. Do not run
 * coarser: at 1/120 s one flat knife passed through a wire even with continuous collision
 * detection. 1/480 s roughly halves resting penetration at twice the cost.
 */
export const LOADING_TIME_STEP = 1 / 240;

/**
 * Gravity of the loading simulation in the tub frame, m/s^2: standard gravity along -z
 * (`STANDARD_GRAVITY` of `@spotless/core`, 9.80665, exact by definition). It is the value the
 * wash simulation uses (docs/design/sim-core.md section 1), so that an item weighs the same
 * while it is loaded and while it is washed. docs/research/items.md section 11.4 writes it
 * rounded, as 9.81.
 */
export const LOADING_GRAVITY: Vec3 = [0, 0, -STANDARD_GRAVITY];

/**
 * Settle budget per action, seconds: no minimum, rest looked for after every step, at most
 * 10 s. The cap is [ESTIMATED] docs/research/items.md section 11.4, which also proposed a
 * minimum of 2 s extended in blocks of 0.5 s: that was a guard for a rest test that could be
 * fooled, and cost every action 480 steps. Rest is now the world's own, honest criterion (a
 * body is at rest when its averaged velocity has been under both speeds for the hold time, and
 * a settle disturbs what it settles, see `SETTLE_DISTURBANCE`), so a settle ends at the step
 * in which the last body meets it: about 0.8 s for an item let down into a slot.
 */
export const SETTLE_BUDGET = {
  minTime: 0,
  blockTime: 0,
  maxTime: 10,
} as const;

/**
 * Settle options for a world stepping at `timeStep` seconds: the platform rest criterion
 * ({@link REST_CRITERION}), the settle budget ({@link SETTLE_BUDGET}) and the standard
 * disturbance ({@link SETTLE_DISTURBANCE}) converted to steps. With `disturb` false the
 * disturbance is left out: for a settle that must not move what merely rests (a measurement
 * of where something rolling stops), not for the game.
 */
export function settleOptionsFor(timeStep: number, disturb = true): SettleOptions {
  const steps = (seconds: number): number => Math.max(1, Math.round(seconds / timeStep));
  const plain: SettleOptions = {
    minSteps: Math.round(SETTLE_BUDGET.minTime / timeStep),
    blockSteps: steps(SETTLE_BUDGET.blockTime),
    maxSteps: steps(SETTLE_BUDGET.maxTime),
    restLinearSpeed: REST_CRITERION.linearSpeed,
    restAngularSpeed: REST_CRITERION.angularSpeed,
    restHoldSteps: steps(REST_CRITERION.holdTime),
  };
  if (!disturb) return plain;
  return {
    ...plain,
    disturbance: {
      tilt: SETTLE_DISTURBANCE.tilt,
      directions: SETTLE_DISTURBANCE.directions,
      directionSteps: steps(SETTLE_DISTURBANCE.directionTime),
      calmSteps: steps(SETTLE_DISTURBANCE.calmTime),
      coldStart: SETTLE_DISTURBANCE.coldStart,
    },
  };
}
