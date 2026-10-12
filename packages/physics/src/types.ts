/**
 * Contract of the loading-physics layer (docs/design/platform.md section 5): a thin
 * deterministic wrapper over Jolt, and the mechanics the session builds on it.
 *
 * Units: SI (metres, kilograms, seconds, radians, newtons). Poses are in the tub frame `T`
 * unless stated otherwise. All values are plain data and read-only.
 *
 * Determinism rules that bind every implementation (platform.md section 2): a fixed step and a
 * fixed number of steps per call, nothing depends on wall-clock time; bodies are created in
 * canonical order (sorted by id) and removal and re-insertion preserve it; every list returned
 * is sorted by id; no iteration over unordered collections where order affects results.
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { CollisionPiece, MassProperties } from '@spotless/geometry';

// ---------------------------------------------------------------------------------------------
// Defaults fixed by the design
// ---------------------------------------------------------------------------------------------

/**
 * Rest criterion (platform.md section 5): a body is at rest when its linear speed is below
 * `linearSpeed` (m/s) and its angular speed below `angularSpeed` (rad/s) continuously for
 * `holdTime` (s). [ESTIMATED] calibration parameters v_tol, omega_tol, t_hold of
 * docs/research/benchmark.md sections 3.4 and 11.
 */
export const REST_CRITERION = {
  linearSpeed: 0.005,
  angularSpeed: 0.05,
  holdTime: 0.5,
} as const;

/**
 * Stability probe (platform.md section 5): wake the island, perturb by `kickSpeed` (m/s) in
 * `directions` horizontal directions in turn, re-simulate `settleTime` (s) each; stable if every
 * item returns within `positionTolerance` (m) and `angleTolerance` (rad, 1 degree).
 * [ESTIMATED] design of docs/research/items.md section 5.6.
 */
export const STABILITY_PROBE = {
  kickSpeed: 0.01,
  directions: 4,
  settleTime: 0.5,
  positionTolerance: 0.001,
  angleTolerance: Math.PI / 180,
} as const;

/**
 * The standard disturbance of a settle (platform.md section 5): once everything awake has met
 * the rest speeds for `calmTime` (s), gravity is tilted by `tilt` (rad) towards `directions`
 * horizontal directions in turn (the first towards +x of the tub, the others at equal angles
 * about the vertical), `directionTime` (s) each, and then stands upright again; rest is only
 * accepted after that. It is what a kitchen does to anything left balancing: an equilibrium
 * that does not survive it (a knife standing on the edge of its handle end, a board on one
 * corner) falls during the settle that made it and not at the next push of the basket. One
 * degree for a twentieth of a second moves a free body a fifth of a millimetre; the four
 * directions cancel, so that what stands firmly is where it was afterwards. The same every
 * time, so that an action log replays.
 *
 * With `coldStart`, the first of those steps is also solved without the contact forces of the
 * step before, which is what happens to a body that slept and is woken (the engine keeps no
 * contact forces for a sleeping body). A pose that only holds while the solver remembers how it
 * held (a knife wedged between the floor and the top of a wall by friction that a fresh
 * solution does not find: it slid 4 mm when its neighbour woke it) is given up during the
 * settle that made it.
 * [ESTIMATED] a design choice of this project; no published figure.
 */
export const SETTLE_DISTURBANCE = {
  tilt: Math.PI / 180,
  directions: 4,
  directionTime: 0.05,
  calmTime: 0.05,
  coldStart: true,
} as const;

/**
 * Rack push-in motion profile: peak speed (m/s), acceleration (m/s^2) and end-stop deceleration
 * (m/s^2). [ESTIMATED] docs/research/benchmark.md section 4.7; calibrate against a real rack.
 */
export const RACK_TRAVEL_PROFILE = {
  peakSpeed: 0.5,
  acceleration: 2,
  endStopDeceleration: 5,
} as const;

// ---------------------------------------------------------------------------------------------
// Materials and contacts
// ---------------------------------------------------------------------------------------------

/**
 * Surface of a body as far as contact is concerned. Friction and restitution are never stored
 * per body: they are looked up per pair of materials (`frictionPair(a, b, wet)` in the
 * catalogue). A collision piece that names its own material (`CollisionPiece.material`)
 * overrides this for that piece, for example an unglazed foot ring on a glazed plate.
 */
export interface ContactMaterial {
  /** Catalogue material id used for every piece of the body that does not carry its own. */
  readonly material: string;
}

/** Contact coefficients of one pair of materials. */
export interface ContactPairProperties {
  /** Coulomb friction coefficient (kinetic value; dimensionless). */
  readonly friction: number;
  /** Coefficient of restitution, 0 to 1. */
  readonly restitution: number;
  /**
   * Rolling-resistance length `c_rr`, metres (docs/research/items.md section 3.6): a body
   * rolling on this pair is resisted by a moment `c_rr * N` about the tangent axis it turns
   * about. Absent means 0 (no resistance: a round body rolls on for ever on a level surface).
   */
  readonly rollingResistance?: number;
  /**
   * Torsional (spin) friction length `c_sp`, metres (items.md section 3.6): a body spinning
   * about the contact normal is resisted by a moment `c_sp * N`. Absent means 0.
   */
  readonly spinResistance?: number;
}

/**
 * Looks up the coefficients for two catalogue material ids. Must be symmetric in its arguments
 * and pure. The session supplies it from the catalogue's pair table with the wet or dry state
 * already chosen (`contactPairLookup(wet)` of `@spotless/catalogue`).
 *
 * The lookup must be total over the materials of a world: whenever a body brings in a material
 * (its own, or that of one of its pieces) the world asks for its pair with every material
 * already present, itself included, always with the two ids in sorted order, and keeps the
 * answers. Each must be a finite friction of at least 0 and a restitution from 0 to 1 (and,
 * where given, finite resistance lengths of at least 0); `addBody` throws otherwise, so an
 * incomplete table fails when the body is added and not in the middle of a step.
 */
export type ContactPairLookup = (materialA: string, materialB: string) => ContactPairProperties;

/** How a body takes part in the simulation. */
export type BodyKind = 'dynamic' | 'static' | 'kinematic';

/**
 * Mass properties to hand to `addBody` for a body that needs none: a static or kinematic body,
 * whose mass is ignored. (Not valid for a dynamic body, which needs a mass above zero.)
 */
export const NO_MASS: MassProperties = {
  mass: 0,
  com: [0, 0, 0],
  inertia: [1, 0, 0, 0, 1, 0, 0, 0, 1],
};

/**
 * Contact between two bodies after the latest step, aggregated over the contact points between
 * one pair of parts. Lists of contacts are sorted by (`a`, `b`, `partA`, `partB`).
 */
export interface Contact {
  /** Body id; `a` sorts before `b`. */
  readonly a: string;
  readonly b: string;
  /** Part of body `a` in contact (`CollisionPiece.part`), for example `'tine_row_2'`. */
  readonly partA: string;
  /** Part of body `b` in contact. */
  readonly partB: string;
  /** Number of contact points. */
  readonly points: number;
  /** Total normal force over the points, newtons, averaged over the latest step. */
  readonly normalForceN: number;
  /** Deepest penetration among the points, metres (0 when merely touching). */
  readonly maxPenetration: number;
  /** Mean contact position in the tub frame, metres. */
  readonly position: Vec3;
  /** Unit contact normal in the tub frame, pointing from `a` towards `b`. */
  readonly normal: Vec3;
}

/** Restricts {@link PhysicsWorld.contacts} to part of the world. */
export interface ContactQuery {
  /** Only contacts in which at least one of these bodies takes part. */
  readonly bodies?: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Settling
// ---------------------------------------------------------------------------------------------

/**
 * Options of {@link PhysicsWorld.settle}. Durations are counted in fixed steps so that the
 * outcome is a pure function of the state and these numbers.
 */
export interface SettleOptions {
  /** Steps always simulated before the rest criterion is first consulted. */
  readonly minSteps: number;
  /** Size of each further block of steps; rest is evaluated only at block boundaries. */
  readonly blockSteps: number;
  /** Hard cap on the total number of steps. */
  readonly maxSteps: number;
  /** Linear speed below which a body can count as at rest, m/s. */
  readonly restLinearSpeed: number;
  /** Angular speed below which a body can count as at rest, rad/s. */
  readonly restAngularSpeed: number;
  /** Number of consecutive steps both speeds must stay below their thresholds. */
  readonly restHoldSteps: number;
  /**
   * The disturbance applied during the call (see {@link SETTLE_DISTURBANCE}); absent for
   * none. It starts at the first step after which every awake dynamic body that has not been
   * through it has met the rest speeds for `calmSteps` consecutive steps, and at the latest
   * when one of them has met them for `restHoldSteps` (so that what lies still does not wait
   * for what rolls), lasts `directions * directionSteps` steps, and rest is counted afresh
   * after it. It counts for the bodies that were calm when it began; a body goes to sleep
   * during the call only once it counts for it, so it is given again, as often as needed, for
   * bodies that calm down later or are woken. Usually once.
   */
  readonly disturbance?: SettleDisturbance;
}

/** A disturbance of {@link PhysicsWorld.settle}, with its durations counted in steps. */
export interface SettleDisturbance {
  /** Angle by which gravity is tilted, radians. */
  readonly tilt: number;
  /** Number of horizontal directions the tilt takes in turn. */
  readonly directions: number;
  /** Steps the tilt stays in each direction. */
  readonly directionSteps: number;
  /** Consecutive steps every awake body must have met the rest speeds before it starts. */
  readonly calmSteps: number;
  /**
   * Whether its first step is solved without the contact forces of the step before (see
   * {@link SETTLE_DISTURBANCE}). Absent for no.
   */
  readonly coldStart?: boolean;
}

/** Outcome of {@link PhysicsWorld.settle}. */
export interface SettleResult {
  /** Steps actually simulated. */
  readonly steps: number;
  /** Simulated time, seconds (`steps` times the world's time step). */
  readonly time: number;
  /** True when every dynamic body met the rest criterion before the cap. */
  readonly atRest: boolean;
  /**
   * True when the disturbance asked for was applied (and completed) at least once during the
   * call. `settle`
   * always says; the field is optional for the sake of results put together by hand.
   */
  readonly disturbed?: boolean;
  /** Ids of the dynamic bodies that did not meet the rest criterion, sorted. */
  readonly moving: readonly string[];
  /**
   * Ids of the dynamic bodies that still overlap another body by more than
   * {@link UNRESOLVED_PENETRATION} when the call returns, sorted: bodies that were released
   * inside something and could not be pushed apart. They may well be at rest; a load with an
   * entry here is not a valid resting load.
   */
  readonly penetrating: readonly string[];
}

/**
 * Overlap of two bodies, metres, above which {@link SettleResult.penetrating} reports them:
 * 0.5 mm, the overlap up to which the session accepts a requested pose (platform.md section 6,
 * `place` step 2). Resting contacts overlap by about a tenth of a millimetre.
 */
export const UNRESOLVED_PENETRATION = 0.0005;

/**
 * Thrown by `step` and `settle` when a step produced more contacts than the engine can hold
 * reliably (see `JoltWorldSettings.maxContactConstraints`). It is not a programmer error: the
 * load is simply too crowded for the engine, and the caller should refuse the action that led
 * to it. When `restored` is true the world is exactly as it was before the failing step (the
 * steps of the same call that came before it stand); otherwise it is as that step left it,
 * which is still a consistent state because the limit is checked with a safety margin.
 */
export class ContactCapacityError extends Error {
  /** Contact manifolds the failing step produced. */
  readonly manifolds: number;
  /** The engine's capacity for contact manifolds in one step. */
  readonly capacity: number;
  /** True when the world was put back to the state before the failing step. */
  readonly restored: boolean;

  constructor(manifolds: number, capacity: number, restored: boolean) {
    super(
      `physics: ${manifolds} contact manifolds in one step is too close to the capacity of ` +
        `${capacity}; contacts would be dropped`,
    );
    this.name = 'ContactCapacityError';
    this.manifolds = manifolds;
    this.capacity = capacity;
    this.restored = restored;
  }
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/** Result of {@link PhysicsWorld.penetration}. */
export interface PenetrationResult {
  /** Deepest penetration of the probe into any body, metres; 0 when it touches nothing. */
  readonly depth: number;
  /** Ids of every body the probe penetrates, sorted. */
  readonly with: readonly string[];
  /**
   * For each body of `with`, in the same order: the name of the part of it (as contacts name
   * parts, `Contact.partA`) that the probe penetrates deepest; '' for a body without named
   * parts.
   */
  readonly parts: readonly string[];
}

/** Result of {@link PhysicsWorld.sweep}. */
export interface SweepResult {
  /** True when the probe touches a body somewhere along the sweep. */
  readonly hit: boolean;
  /** Fraction of the path travelled before first contact, 0 to 1 (1 when there is no hit). */
  readonly fraction: number;
  /** Id of the first body hit; absent when there is no hit. */
  readonly with?: string;
  /** The part of that body that was hit, as contacts name parts; '' when it has none. */
  readonly part?: string;
}

// ---------------------------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------------------------

/** Parameters fixed for the lifetime of a world. */
export interface PhysicsWorldOptions {
  /** Fixed time step, seconds. */
  readonly timeStep: number;
  /**
   * Gravity in the tub frame, m/s^2. The loading simulation uses `LOADING_GRAVITY` of this
   * package: standard gravity (`STANDARD_GRAVITY` of `@spotless/core`, 9.80665) along -z, the
   * value the wash simulation uses too.
   */
  readonly gravity: Vec3;
  /** Friction and restitution per pair of materials. */
  readonly pairLookup: ContactPairLookup;
}

/**
 * A deterministic rigid-body world. Body ids are stable strings; an unknown id, a duplicate id
 * or a malformed argument is a programmer error and throws. Poses map the body's item frame to
 * the tub frame.
 */
export interface PhysicsWorld {
  /** The fixed time step every step of this world advances by, seconds. */
  readonly timeStep: number;
  /**
   * Adds a body made of convex pieces (item frame). `mass` is ignored for static and kinematic
   * bodies. `surface` gives the material of every piece that does not name its own. Throws when
   * the pair lookup has no valid coefficients for a material the body brings in (see
   * {@link ContactPairLookup}).
   */
  addBody(
    id: string,
    pieces: readonly CollisionPiece[],
    mass: MassProperties,
    surface: ContactMaterial,
    pose: Pose,
    kind: BodyKind,
  ): void;
  /** Removes a body and wakes whatever it was touching. */
  removeBody(id: string): void;
  /**
   * Kinematic move or teleport of a body to `pose`; wakes its neighbours.
   *
   * A kinematic body (rack, spray arm, door) is driven: it arrives at `pose` at the end of the
   * next step and carries the corresponding linear and angular velocity during that step, so
   * that it drags and pushes whatever rests on it. Call it once per step along a path; a body
   * that is not moved again stops. A dynamic or static body is teleported: the pose changes at
   * once and its velocities are set to zero (this is how an item is released at rest).
   */
  setPose(id: string, pose: Pose): void;
  /**
   * Moves a body of any kind to `pose` at once, with zero velocity, and wakes its neighbours.
   * For a dynamic or static body this is `setPose`. For a kinematic body it is the move that
   * does not carry: whatever rests on it is left where it was (a rack put in another position
   * while the scene is being set up). To move a rack with its load, drive it with `setPose`.
   */
  teleport(id: string, pose: Pose): void;
  /** Current pose of a body (item frame to tub frame). */
  getPose(id: string): Pose;
  /** How a body takes part in the simulation (the kind it was added with). */
  getKind(id: string): BodyKind;
  /**
   * Advances the world by `n` fixed steps. Throws a {@link ContactCapacityError} when a step
   * produces more contacts than the engine can hold.
   */
  step(n: number): void;
  /**
   * Steps in fixed blocks until every dynamic body meets the rest criterion or the cap is hit.
   * A body counts as at rest only when its speeds have been below the given thresholds for
   * `restHoldSteps` consecutive steps (bodies the world has put to sleep qualified by the
   * platform rest criterion, {@link REST_CRITERION}, and are woken first when the thresholds
   * given here are stricter). With a `disturbance`, what is awake is disturbed once on the way
   * and has to come to rest after it; bodies that sleep through the call are not disturbed.
   * A call that finds nothing awake returns at once, having taken no step. Throws a
   * {@link ContactCapacityError} like `step`.
   */
  settle(opts: SettleOptions): SettleResult;
  /**
   * Contacts after the latest step, sorted. Bodies that have come to rest and fallen asleep keep
   * the contacts (and normal forces) of the last step in which they were simulated. `query`
   * restricts the answer to part of the world.
   */
  contacts(query?: ContactQuery): Contact[];
  /**
   * Overlap test of a probe shape (pieces in their own item frame, placed at `pose`) against
   * the world, without adding it. Bodies listed in `ignore` are skipped.
   */
  penetration(
    pieces: readonly CollisionPiece[],
    pose: Pose,
    ignore?: readonly string[],
  ): PenetrationResult;
  /**
   * Sweeps a probe shape along the straight path from pose `from` to pose `to` (orientation
   * interpolated) and reports the first contact. Bodies listed in `ignore` are skipped.
   */
  sweep(
    pieces: readonly CollisionPiece[],
    from: Pose,
    to: Pose,
    ignore?: readonly string[],
  ): SweepResult;
  /**
   * Applies an impulse (N s, tub frame) to a dynamic body at the point `at` (tub frame, metres)
   * or at its centre of mass when `at` is omitted, and wakes it (a zero impulse only wakes it).
   */
  applyImpulse(id: string, impulse: Vec3, at?: Vec3): void;
  /**
   * Serialises the complete dynamic state (poses, velocities, sleep state, rest timers and
   * contact caches).
   */
  snapshot(): Uint8Array;
  /** Restores a snapshot taken from a world holding the same bodies. */
  restore(s: Uint8Array): void;
  /**
   * `'sha256:'` + hexadecimal SHA-256 over body ids, poses and velocities (exact bits), bodies
   * in id order.
   */
  stateHash(): string;
  /** Ids of all bodies, sorted. */
  bodyIds(): string[];
  /** Linear (m/s) and angular (rad/s) velocity of a body in the tub frame. */
  getVelocity(id: string): { readonly linear: Vec3; readonly angular: Vec3 };
  /** Frees the native resources of the world. The world must not be used afterwards. */
  dispose(): void;
}

/**
 * Creates a world. Asynchronous because the Jolt WebAssembly module is instantiated on first
 * use.
 */
export type CreatePhysicsWorld = (options: PhysicsWorldOptions) => Promise<PhysicsWorld>;

// ---------------------------------------------------------------------------------------------
// Mechanics built on the world (results consumed by the session)
// ---------------------------------------------------------------------------------------------

/** How far a body moved between two states. */
export interface BodyMotion {
  readonly id: string;
  /** Distance between the two positions of the body origin, metres. */
  readonly displacement: number;
  /** Angle of the relative rotation, radians, in [0, pi]. */
  readonly rotation: number;
}

/** Outcome of the stability probe (see {@link STABILITY_PROBE}). */
export interface StabilityProbeResult {
  /** True when every probed body returned within the tolerances after every kick. */
  readonly stable: boolean;
  /** Bodies that did not return, with their largest excursion, sorted by id. */
  readonly unstable: readonly BodyMotion[];
}

/** Outcome of simulating a rack being pushed in (or pulled out) with its contents. */
export interface RackTravelResult {
  /** Bodies that ended more than 1 mm or 1 degree from where they started relative to the rack. */
  readonly moved: readonly BodyMotion[];
  /** Bodies that left the rack envelope, sorted by id. */
  readonly fellOut: readonly string[];
  /**
   * Body that stopped the rack before the end of its travel, if any: the body on the rack that
   * was held back by something that does not travel with it or, when the rack itself ran into
   * something, that body.
   */
  readonly blockedBy?: string;
}

/** Outcome of rotating one spray arm kinematically through a full turn. */
export interface ArmSweepResult {
  /** Spray-arm id from the machine specification. */
  readonly arm: string;
  /** True when the arm completes 360 degrees without touching anything. */
  readonly free: boolean;
  /** Arm angle at first contact, radians from the arm's reference position; absent when free. */
  readonly firstContactAngle?: number;
  /** Body first touched; absent when free. */
  readonly blockedBy?: string;
}

/** Outcome of testing the dispenser lid's swept volume against the settled load. */
export interface LidSweepResult {
  /** True when the lid can open fully. */
  readonly free: boolean;
  /** Bodies intersecting the swept volume, sorted by id. */
  readonly blockedBy: readonly string[];
}
