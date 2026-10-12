/**
 * The loading world: a thin, deterministic wrapper over one Jolt physics system
 * (docs/design/platform.md section 5).
 *
 * Units: SI. Frames: every pose maps a body's item frame to the tub frame `T` (z up).
 *
 * How determinism is kept (platform.md section 2):
 * - the build is Jolt's single-threaded WebAssembly build, stepped with a fixed time step;
 * - a body's engine id is its rank among all body ids in canonical order
 *   (`compareIds`), so the engine always sees bodies exactly as if they had been created in
 *   sorted order, whatever order the caller added them in and however often a body was removed
 *   and added again. Additions and removals are queued and applied together before the next
 *   operation that needs them; bodies whose rank changed are given their new engine id and the
 *   engine's contact cache (which is keyed by engine ids) is emptied;
 * - friction and restitution come from a contact listener that is a pure function of the two
 *   materials in contact: it keeps no state and its result does not depend on the order in which
 *   the engine reports contacts;
 * - every list handed out is sorted by id.
 *
 * What the wrapper does around the engine for the sake of the physics:
 * - rest is the wrapper's business, not the engine's. Every awake dynamic body carries a count
 *   of the consecutive steps in which it met the rest speeds (part of the state, so it is in
 *   snapshots), and a group of dynamic bodies connected by contacts is put to sleep when every
 *   one of them has met them for the hold time. The engine's own sleeping is off;
 * - contacts are only created where two pieces can meet within the next step (see
 *   `JoltWorldSettings.restingContactDistance`), decided per pair of pieces from the speeds of
 *   the two bodies before the step. A step that still produces more contacts than the engine
 *   can hold is undone and reported with a `ContactCapacityError`;
 * - rolling and spin resistance (docs/research/items.md section 3.6), which the engine does
 *   not have, are applied after every step to each awake body with a supporting contact: a
 *   moment `c * N` against its rotation about the contact, with the body's weight for `N`;
 * - the round rolling surfaces of shells of revolution (`CollisionRound` pieces) only take
 *   contacts from outside, and only against bodies that are not dynamic (racks, baskets, the
 *   tub): they are what an item on its side rolls on;
 * - contacts of bodies that have fallen asleep are kept (the engine forgets them), so that
 *   `contacts()` describes the whole resting load;
 * - while a kinematic body is driven (`setPose` before a step) everything within its bounds is
 *   kept awake, and those bodies, and only those, are not swept (continuous collision
 *   detection) in that step: the engine sweeps against a moving kinematic body as if that body
 *   stood where it ends the step. Everything is decided afresh in every step from the state
 *   alone, so replay is not disturbed.
 */

import type { Mat3, Pose, Quat, Vec3 } from '@spotless/core';
import {
  compareIds,
  createSha256,
  mat3Column,
  mat3FromDiagonal,
  mat3RotateTensor,
  mat3Symmetrise,
  quatAngleBetween,
  quatNormalise,
  quatRotate,
  quatSlerp,
  symmetricEigen3,
  v3Add,
  v3IsFinite,
  v3Lerp,
  v3Length,
  v3Sub,
} from '@spotless/core';
import type { CollisionPiece, MassProperties } from '@spotless/geometry';
import type { JoltModule } from './jolt-module.ts';
import {
  acquireJoltModule,
  clearJoltCallbacks,
  fastJoltCallback,
  forgetJoltWrapper,
  releaseJoltModule,
  trimJoltWrappers,
} from './jolt-module.ts';
import type { JoltWorldSettings } from './settings.ts';
import { JOLT_SETTINGS } from './settings.ts';
import type { BuiltShape } from './shapes.ts';
import { ShapeCache, leafOfSubShape } from './shapes.ts';
import type { SavedManifold } from './state-bytes.ts';
import {
  ByteReader,
  ByteWriter,
  STATE_CONTACTS,
  StateRecorder,
  emptyContactState,
  parseContactState,
} from './state-bytes.ts';
import type {
  BodyKind,
  Contact,
  ContactMaterial,
  ContactPairLookup,
  ContactPairProperties,
  ContactQuery,
  PenetrationResult,
  PhysicsWorld,
  PhysicsWorldOptions,
  SettleOptions,
  SettleResult,
  SweepResult,
} from './types.ts';
import { ContactCapacityError, UNRESOLVED_PENETRATION } from './types.ts';

type JoltBody = InstanceType<JoltModule['Body']>;
type JoltShape = InstanceType<JoltModule['Shape']>;
type JoltVec3 = InstanceType<JoltModule['Vec3']>;
type JoltQuat = InstanceType<JoltModule['Quat']>;

/** Object layer of static bodies (they do not collide with each other). */
const LAYER_STATIC = 0;
/** Object layer of dynamic and kinematic bodies. */
const LAYER_MOVING = 1;
/** Bits of a Jolt body id that hold the body index. */
const BODY_INDEX_MASK = 0x7fffff;
/** Sequence number 1 in a Jolt body id: what Jolt itself gives the first body in a slot. */
const BODY_SEQUENCE = 1 << 23;
/** Largest handle that still gives an exact pair key. */
const MAX_HANDLE = 2 ** 26;
/** Fraction of the contact-constraint capacity above which a step is refused as unsafe. */
const CONTACT_CAPACITY_GUARD = 0.9;
/**
 * Fraction of the capacity guard above which the state is saved before every step, so that a
 * step that overflows can be undone. Saving costs about half a step of a busy world, so it is
 * not done all the time: contacts grow by motion, a little per step, except right after the
 * world was changed from outside, when the state is saved whatever the count. A step that
 * overflows from below this mark all the same (hundreds of bodies landing in the same step)
 * is reported with `restored` false.
 */
const CONTACT_CAPACITY_WATCH = 0.25;
/**
 * Quantum in which the supporting contacts of a body are summed: normals and positions (engine
 * units) are rounded to whole multiples of 1 / SUPPORT_QUANTA.
 */
const SUPPORT_QUANTA = 2 ** 20;
/**
 * Coarser quantum for the spread of the supporting points, whose sums of products must stay
 * exact too: engine units are rounded to whole multiples of 1 / SPREAD_QUANTA (10 micrometres).
 */
const SPREAD_QUANTA = 2 ** 10;
/**
 * Spread of the supporting points (root mean square distance from their mean, metres) below
 * which a body counts as supported at a single point.
 */
const POINT_SUPPORT_SPREAD = 0.0003;
/**
 * Time over which the velocity of a body is averaged before it is compared with the rest
 * speeds, seconds (an exponential average with this time constant). The contact solver leaves
 * small bodies lying on a flat with a velocity that reverses every few steps and moves them by
 * hundredths of a millimetre (a peeler on its grip: 0.06 rad/s to and fro at 30 Hz, just above
 * the rest speed, for ever). Averaged over 50 ms that is 0.006 rad/s, while anything that
 * actually travels, however slowly, keeps its speed.
 */
const REST_AVERAGING_TIME = 0.05;
/**
 * Angular speed above which a body with a round rolling surface has its contacts found afresh
 * in every step, rad/s: a tenth of the rest speed.
 */
const ROLLING_FRESH_CONTACTS_SPEED = 0.005;
/**
 * Number of consecutive slow steps after which the pairs of a body are tested afresh, once (see
 * `stepOnce`): the averaging time of the rest speeds, 0.05 s at 1/240 s. At the first slow step
 * a body that hovers about the rest speeds would have all its pairs tested afresh every other
 * step.
 */
const REST_REFRESH_STEPS = 12;
/**
 * Overlap, in penetration slops, that a round piece and another piece must be about to reach
 * before they get a contact ahead of their meeting (see `rodsWillOverlap`): one and a quarter,
 * a little more than a resting contact sinks in, so that a rim sliding onto the next wire at
 * the height of the wires it lies on is not taken for one that runs into it.
 */
const ROUND_OVERLAP_SLOPS = 1.25;
/**
 * Share of the speed at which two pieces pass each other that they must be closing with, at the
 * moment they are found to touch, to count as meeting squarely (see `rodsWillOverlap`): a half.
 * A rim that slides onto a wire 0.1 mm proud of its path meets it at a third.
 */
const ROUND_SQUARE_SHARE = 0.5;
/** Most places along its way at which `rodsWillOverlap` looks at two round pieces. */
const ROUND_LOOKS_MOST = 24;
/**
 * Speed, m/s, of the fastest free body of the world (against what stands, or against the rack
 * that is being moved, whichever is less) up to which contacts are refused on the strength of
 * where two pieces are heading (see `acceptsHit`): a tenth more than the fastest a rack moves,
 * which is the most a thing on it can have against it. Where things fall faster than that
 * (cutlery let go 240 mm above a basket), one of them may strike a body in the very step in
 * which that body was taken to miss a wire, and it then stands inside the wire.
 */
const ROUND_CALM_SPEED = 0.55;
/**
 * Change of velocity in the step before, as a share of what gravity adds in a step, up to
 * which a body is taken to go on as it did (see `acceptsHit`): nine tenths. What slides on its
 * supports loses the friction coefficient times that (under it for any coefficient below 0.9);
 * what falls freely gains all of it, and what is being knocked about changes by more: those
 * keep every contact the engine offers.
 */
const ROUND_KNOCK_SHARE = 0.9;
/**
 * Slack added to the reach of two bounding spheres before a pair of pieces is culled, engine
 * units (10 micrometres): far above the rounding of single-precision positions of a metre.
 */
const BALL_SLACK = 1e-3;
/** Number of bodies destroyed or shapes freed after which the bindings' wrappers are swept. */
const WRAPPER_SWEEP_EVERY = 16;
/** Quanta per metre in which resistance lengths are summed (nanometres). */
const LENGTH_QUANTA = 1e9;
/** Arc length a probe point may deviate from the true path of a rotating sweep, metres. */
const SWEEP_ARC_STEP = 0.001;
/** Rotation below which the two ends of a sweep count as the same orientation, radians. */
const SWEEP_ROTATION_EPS = 1e-9;
/** First bytes of a snapshot ("SPW" and a format version). */
const SNAPSHOT_MAGIC = 0x33575053;

/** Counters describing the latest step, for capacity planning and diagnostics. */
export interface WorldStats {
  /** Number of bodies in the world. */
  readonly bodies: number;
  /** Number of bodies the engine is simulating (not asleep, not static). */
  readonly activeBodies: number;
  /** Contact manifolds (one per pair of touching or nearly touching pieces) in the latest step. */
  readonly manifolds: number;
  /** Largest number of contact manifolds in any one step since the world was created. */
  readonly peakManifolds: number;
  /** Capacity for contact manifolds per step. */
  readonly maxManifolds: number;
  /** Total number of steps taken since the world was created. */
  readonly steps: number;
  /** Free bytes on the engine's fixed WebAssembly heap. */
  readonly freeMemory: number;
}

/**
 * One contact point as the engine holds it, for diagnostics and tests: where the two surfaces
 * are, how far apart, and what force the point carried in the latest step.
 */
export interface ContactPoint {
  /** Body id; `a` sorts before `b`. */
  readonly a: string;
  readonly b: string;
  /** Parts of `a` and `b` in contact. */
  readonly partA: string;
  readonly partB: string;
  /** Index, in the pieces each body was added with, of the pieces in contact. */
  readonly pieceA: number;
  readonly pieceB: number;
  /** The point on the surface of `a`, tub frame, metres. */
  readonly positionA: Vec3;
  /** The point on the surface of `b`, tub frame, metres. */
  readonly positionB: Vec3;
  /** Unit contact normal in the tub frame, pointing from `a` towards `b`. */
  readonly normal: Vec3;
  /** Distance from the point on `a` to the point on `b` along the normal, metres; negative when
   * the surfaces overlap. */
  readonly gap: number;
  /** Normal force carried by the point, averaged over the latest step, newtons. */
  readonly normalForceN: number;
  /** False for a point the engine tracks ahead of contact: apart and carrying no load. */
  readonly touching: boolean;
}

/**
 * The world created by {@link createPhysicsWorld}: the platform contract plus what the tests,
 * the mechanics helpers and diagnostics need on top of it.
 */
export interface JoltPhysicsWorld extends PhysicsWorld {
  /** The engine settings the world was created with. */
  readonly settings: JoltWorldSettings;
  /** True while the engine is simulating the body (false when it is asleep or static). */
  isActive(id: string): boolean;
  /**
   * Sets the linear (m/s) and angular (rad/s) velocity of a dynamic body in the tub frame and
   * wakes it.
   */
  setVelocity(id: string, linear: Vec3, angular: Vec3): void;
  /**
   * Every contact point behind {@link PhysicsWorld.contacts}, unaggregated, including the points
   * the engine tracks ahead of contact (`touching` false). Sorted.
   */
  contactPoints(query?: ContactQuery): ContactPoint[];
  /** Counters describing the latest step. */
  stats(): WorldStats;
}

interface BodyRecord {
  readonly id: string;
  readonly kind: BodyKind;
  /** Stable small integer, stored as the Jolt user data of the body. */
  readonly handle: number;
  readonly pieces: readonly CollisionPiece[];
  readonly built: BuiltShape;
  /** The shape the body uses: the compound, or the compound with its centre of mass moved. */
  readonly shape: JoltShape;
  /** Centre of mass of `shape` in the item frame, metres. */
  readonly shapeCom: Vec3;
  /** Per leaf (see `BuiltShape`): the part name contacts are attributed to. */
  readonly leafPart: readonly string[];
  /** Per leaf: index of its material in the world's material table. */
  readonly leafMaterial: Uint16Array;
  readonly mass: number;
  /** Inertia handed to the engine, about the centre of mass in item axes; null if not dynamic. */
  readonly inertia: Mat3 | null;
  /** Pose the body is created with. */
  readonly initialPose: Pose;
  body: JoltBody | null;
  pointer: number;
  /** Index among all body ids in canonical order; -1 until the body exists in the engine. */
  rank: number;
  active: boolean;
  /** Number of the latest step during which the body was awake. */
  touchedStep: number;
  /**
   * Consecutive steps the body has met the world's rest criterion (part of the state: it
   * decides when the body is put to sleep).
   */
  restSteps: number;
  /** Consecutive steps the body has met the criterion of the settle call in progress. */
  settleSteps: number;
  /**
   * Whether the body has been through the disturbance of the settle call in progress since it
   * was last woken, and `shaking` whether it is going through it now. Only a body that has may
   * go to sleep during such a call.
   */
  shaken: boolean;
  shaking: boolean;
  /** True from a teleport until the next step: its cached contacts describe the old pose. */
  contactsStale: boolean;
  /** Per leaf: the round rolling surface it is, or null for an ordinary piece. */
  readonly leafRound: readonly (RoundLeaf | null)[];
  /**
   * Per child of the body's compound (a leaf or a group of leaves, see `buildShape`): the round
   * rolling surface it is, or null. A round surface is always a child of the compound itself.
   */
  readonly topRound: readonly (RoundLeaf | null)[];
  /** True when the body has at least one round rolling surface. */
  readonly hasRound: boolean;
  /**
   * Per child of the body's compound, and per leaf: a sphere that contains it, four numbers
   * each: its centre relative to the body's centre of mass in body axes, and its radius, engine
   * units. What `piecesMayCollide` culls pairs of pieces with.
   */
  readonly topBall: Float64Array;
  readonly leafBall: Float64Array;
  /**
   * Per leaf: the capsule it is, seven numbers each: the two ends of its axis relative to the
   * body's centre of mass in body axes and its radius, engine units; a radius of 0 for a leaf
   * that is no capsule or sphere. See `rodsWillOverlap`.
   */
  readonly leafRod: Float64Array;
  /** `BuiltShape.leafJoined` of the body's shape, or null when no leaf of it is joined. */
  readonly joined: Uint8Array | null;
  /**
   * Per leaf: the faces of the hull or box it is, four numbers each: the unit normal pointing
   * out of it in body axes, and the offset of the plane along it from the body's centre of
   * mass, engine units; null for a leaf without. See `rodWillEnter`.
   */
  readonly leafFaces: readonly (Float64Array | null)[];
  /**
   * The body's rotation matrix (nine numbers, row-major) and the orientation it was worked out
   * for (four more); see `rotationOf`.
   */
  readonly matrix: Float64Array;
  /** Largest distance of any point of the body from its centre of mass, engine units. */
  readonly reach: number;
  /** Address of the engine's linear velocity of the body (three floats); 0 for a static body. */
  velocityAt: number;
  /** Whether the engine currently sweeps the body (LinearCast motion quality). */
  casting: boolean;
  /**
   * State before the current step, as the contact callbacks need it: linear velocity (engine
   * units per second), angular velocity (rad/s) and centre of mass (engine units).
   */
  preVx: number;
  preVy: number;
  preVz: number;
  preWx: number;
  preWy: number;
  preWz: number;
  preCx: number;
  preCy: number;
  preCz: number;
  /** Representative of the body's group of bodies in contact in the current step. */
  group: BodyRecord;
  /**
   * The supporting contact points of the current step (tub frame), all as sums of whole
   * numbers of a quantum so that they do not depend on the order in which the engine reports
   * the contacts. See the `SUPPORT_*` indices.
   */
  readonly support: Float64Array;
  /**
   * Change of velocity to apply at the start of the next step: three numbers of angular
   * velocity (rad/s) and three of linear velocity (engine units per second). It is how static
   * rolling resistance holds a body: by cancelling, just before the step, what gravity adds in
   * it (see `resist`). Part of the state, and so of snapshots.
   */
  readonly hold: Float64Array;
  /** True while `hold` is not all zero. */
  holding: boolean;
  /**
   * True when, in the last step it was awake for, the body touched something with one of its
   * round rolling surfaces and no other dynamic body: it is lying on its side on a rack or the
   * floor, free to roll. Such a body gets fresh contacts in every step in which it turns (see
   * `stepOnce`). Part of the state, and so of snapshots.
   */
  onRound: boolean;
  /**
   * By how much the velocity of the body changed in the latest step it was awake in: that of
   * its centre of mass (engine units per second) and its angular velocity (rad/s), with their
   * magnitudes in `knock` and `knockTurn`. Part of the state, and so of snapshots: it decides
   * which contacts the next step asks for.
   */
  readonly gain: Float64Array;
  knock: number;
  knockTurn: number;
  /** `onRound` in the making: set by the contact callbacks of the step under way. */
  roundSeen: boolean;
  /** True when a contact callback of the step under way saw the body touch a dynamic body. */
  neighbourSeen: boolean;
  /**
   * Velocity of the body averaged over `REST_AVERAGING_TIME`: three numbers of linear velocity
   * (engine units per second) and three of angular velocity (rad/s). It is what the rest
   * speeds are compared with. Part of the state, and so of snapshots.
   */
  readonly mean: Float64Array;
}

/** Number of supporting contact points. */
const SUPPORT_COUNT = 0;
/** Sum of the unit normals pointing into the body, in 1 / SUPPORT_QUANTA (three numbers). */
const SUPPORT_NORMAL = 1;
/** Sum of the positions, in engine units / SUPPORT_QUANTA (three numbers). */
const SUPPORT_POSITION = 4;
/** Sum of the positions in the coarser SPREAD_QUANTA (three numbers). */
const SUPPORT_COARSE = 7;
/** Sum of the products of the coarse positions: xx, xy, xz, yy, yz, zz. */
const SUPPORT_PRODUCT = 10;
/** Sums of the rolling and spin resistance lengths of the pairs, in 1 / LENGTH_QUANTA metres. */
const SUPPORT_ROLLING = 16;
const SUPPORT_SPIN = 17;
const SUPPORT_SIZE = 18;

/** A round rolling surface as the contact filter needs it. */
interface RoundLeaf {
  /** Unit axis of the surface in the item frame, from its `a` end to its `b` end. */
  readonly axis: Vec3;
  /** Component of the outward normal of its side along `axis` (the sine of its slope). */
  readonly normalAlongAxis: number;
  /** Deepest overlap that still counts as a contact from outside, engine units. */
  readonly maxDepth: number;
}

interface StoredManifold {
  readonly leaf1: number;
  readonly leaf2: number;
  /** Unit normal in the axes of the second body, pointing from the first to the second. */
  readonly normal: readonly [number, number, number];
  /** Seven numbers per point: position on body 1, position on body 2, normal impulse. */
  readonly points: readonly number[];
}

/** Contacts of one pair of bodies; `first` precedes `second` in id order. */
interface PairContacts {
  readonly first: BodyRecord;
  readonly second: BodyRecord;
  readonly manifolds: StoredManifold[];
}

/** Byte offsets of the engine fields the callbacks read and write straight from the heap. */
interface ListenerLayout {
  // ContactManifold
  readonly subShape1: number;
  readonly subShape2: number;
  /** World-space normal (three floats), pointing from body 1 to body 2. */
  readonly manifoldNormal: number;
  readonly manifoldDepth: number;
  /** Base offset of the contact points (three floats in the single-precision build). */
  readonly manifoldBase: number;
  /** Number of contact points on body 1, and the first of them (three floats, 16 bytes each). */
  readonly manifoldCount: number;
  readonly manifoldPoints: number;
  // ContactSettings
  readonly friction: number;
  readonly restitution: number;
  // CollideShapeResult
  readonly hitAxis: number;
  readonly hitDepth: number;
  readonly hitSubShape1: number;
  readonly hitSubShape2: number;
  readonly hitPoint2: number;
}

/** Byte offsets inside a body and its motion properties, verified on the first body created. */
interface BodyLayout {
  /** Centre-of-mass position in the body (three floats). */
  readonly position: number;
  /** Orientation in the body (x, y, z, w). */
  readonly rotation: number;
  /** World-space bounds in the body (minimum at this offset, maximum 16 bytes on). */
  readonly bounds: number;
  /** Linear velocity in the motion properties; the angular velocity follows 16 bytes on. */
  readonly linearVelocity: number;
  readonly angularVelocity: number;
}

/** Where Jolt 5.6 keeps these fields; checked against the getters before it is relied on. */
const BODY_LAYOUT: BodyLayout = {
  position: 0,
  rotation: 16,
  bounds: 32,
  linearVelocity: 0,
  angularVelocity: 16,
};

function isUsableId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 0xffff;
}

function checkPose(pose: Pose, what: string): Pose {
  if (!v3IsFinite(pose.p)) throw new Error(`physics: ${what} has a position that is not finite`);
  // quatNormalise throws on a quaternion without direction.
  return { p: pose.p, q: quatNormalise(pose.q) };
}

function checkSteps(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`physics: ${what} must be a non-negative integer, got ${value}`);
  }
}

/**
 * Distance between the segments from `(ax, ay, az)` to `(bx, by, bz)` and from `(cx, cy, cz)` to
 * `(dx, dy, dz)`; either may have no length.
 */
export function segmentDistance(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  dx: number,
  dy: number,
  dz: number,
): number {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = dx - cx;
  const vy = dy - cy;
  const vz = dz - cz;
  const wx = ax - cx;
  const wy = ay - cy;
  const wz = az - cz;
  const a = ux * ux + uy * uy + uz * uz;
  const e = vx * vx + vy * vy + vz * vz;
  const f = vx * wx + vy * wy + vz * wz;
  let s = 0;
  let t = 0;
  if (a <= 1e-18 && e <= 1e-18) {
    // Two points.
  } else if (a <= 1e-18) {
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = ux * wx + uy * wy + uz * wz;
    if (e <= 1e-18) {
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const b = ux * vx + uy * vy + uz * vz;
      const denominator = a * e - b * b;
      // Parallel segments: any point of the first will do to start from.
      s = denominator > 1e-12 * a * e ? Math.min(1, Math.max(0, (b * f - c * e) / denominator)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (b - c) / a));
      }
    }
  }
  return Math.hypot(wx + s * ux - t * vx, wy + s * uy - t * vy, wz + s * uz - t * vz);
}

/**
 * The inertia tensor handed to the engine: the symmetric part of the supplied tensor, with its
 * smallest principal moments raised to `minRatio` times the largest (see
 * `JoltWorldSettings.minPrincipalInertiaRatio`). Throws when the tensor is not positive definite.
 */
export function conditionInertia(inertia: Mat3, minRatio: number): Mat3 {
  for (const x of inertia) {
    if (!Number.isFinite(x)) throw new Error('physics: inertia tensor is not finite');
  }
  const symmetric = mat3Symmetrise(inertia);
  const eigen = symmetricEigen3(symmetric);
  const [smallest, middle, largest] = eigen.values;
  if (!(smallest > 0)) {
    throw new Error('physics: inertia tensor is not positive definite');
  }
  const floor = minRatio * largest;
  if (!(minRatio > 0) || smallest >= floor) return symmetric;
  return mat3Symmetrise(
    mat3RotateTensor(
      eigen.vectors,
      mat3FromDiagonal([Math.max(smallest, floor), Math.max(middle, floor), largest]),
    ),
  );
}

/**
 * Finds where the fields the contact listener reads and writes live inside Jolt's structures,
 * by asking the bindings themselves, and checks the answer with a round trip. Reading them
 * straight from the WebAssembly heap keeps the per-contact callback free of calls back into
 * the engine.
 */
function probeListenerLayout(jolt: JoltModule): ListenerLayout {
  const manifold = new jolt.ContactManifold();
  const contact = new jolt.ContactSettings();
  const hit = new jolt.CollideShapeResult();
  const scratch = new jolt.Vec3(0, 0, 0);
  /** Offset of the only float equal to `value` in the first `size` bytes at `base`, or -1. */
  const floatAt = (base: number, value: number, size: number): number => {
    let found = -1;
    for (let offset = 0; offset < size; offset += 4) {
      if (jolt.HEAPF32[(base + offset) >>> 2] === value) {
        if (found >= 0) return -1;
        found = offset;
      }
    }
    return found;
  };
  try {
    const base = jolt.getPointer(manifold);
    const subShape1 = jolt.getPointer(manifold.mSubShapeID1) - base;
    const subShape2 = jolt.getPointer(manifold.mSubShapeID2) - base;
    manifold.mSubShapeID1.SetValue(0x12345678);
    manifold.mSubShapeID2.SetValue(0x0abcdef1);
    const okIds =
      subShape1 >= 0 &&
      subShape2 >= 0 &&
      subShape1 < 4096 &&
      subShape2 < 4096 &&
      jolt.HEAPU32[(base + subShape1) >>> 2] === 0x12345678 &&
      jolt.HEAPU32[(base + subShape2) >>> 2] === 0x0abcdef1;

    const at = jolt.getPointer(contact);
    // Both values are exact in single precision.
    contact.mCombinedFriction = 0.8125;
    contact.mCombinedRestitution = 0.3125;
    let friction = -1;
    let restitution = -1;
    for (let offset = 0; offset < 64; offset += 4) {
      const value = jolt.HEAPF32[(at + offset) >>> 2];
      if (value === 0.8125 && friction < 0) friction = offset;
      if (value === 0.3125 && restitution < 0) restitution = offset;
    }
    let okSettings = friction >= 0 && restitution >= 0;
    if (okSettings) {
      jolt.HEAPF32[(at + friction) >>> 2] = 0.4375;
      jolt.HEAPF32[(at + restitution) >>> 2] = 0.0625;
      okSettings = contact.mCombinedFriction === 0.4375 && contact.mCombinedRestitution === 0.0625;
    }
    // The rest of the manifold: normal, depth, base offset and the contact points on body 1.
    const manifoldNormal = jolt.getPointer(manifold.mWorldSpaceNormal) - base;
    const manifoldBase = jolt.getPointer(manifold.mBaseOffset) - base;
    manifold.mPenetrationDepth = 0.8125;
    const manifoldDepth = floatAt(base, 0.8125, 64);
    const points = manifold.mRelativeContactPointsOn1;
    points.clear();
    scratch.Set(0.4375, 0.0625, 0.5625);
    points.push_back(scratch);
    points.push_back(scratch);
    const pointsAt = jolt.getPointer(points);
    const manifoldCount = pointsAt - base;
    const manifoldPoints = jolt.getPointer(points.at(0)) - base;
    const okManifold =
      manifoldNormal >= 0 &&
      manifoldBase >= 0 &&
      manifoldDepth >= 0 &&
      manifoldCount >= 0 &&
      jolt.HEAPU32[pointsAt >>> 2] === 2 &&
      jolt.getPointer(points.at(1)) - base === manifoldPoints + 16 &&
      jolt.HEAPF32[(base + manifoldPoints) >>> 2] === 0.4375 &&
      jolt.HEAPF32[(base + manifoldPoints + 20) >>> 2] === 0.0625;

    // The result of one collision test, as the validation callback receives it.
    const hitBase = jolt.getPointer(hit);
    hit.mPenetrationDepth = 0.8125;
    const hitDepth = floatAt(hitBase, 0.8125, 96);
    const hitAxis = jolt.getPointer(hit.mPenetrationAxis) - hitBase;
    const hitSubShape1 = jolt.getPointer(hit.mSubShapeID1) - hitBase;
    const hitSubShape2 = jolt.getPointer(hit.mSubShapeID2) - hitBase;
    const hitPoint1 = jolt.getPointer(hit.mContactPointOn1) - hitBase;
    const hitPoint2 = jolt.getPointer(hit.mContactPointOn2) - hitBase;
    hit.mSubShapeID1.SetValue(0x12345678);
    hit.mSubShapeID2.SetValue(0x0abcdef1);
    const okHit =
      hitDepth >= 0 &&
      hitAxis >= 0 &&
      hitSubShape1 >= 0 &&
      hitSubShape2 >= 0 &&
      hitPoint1 === 0 &&
      hitPoint2 > 0 &&
      jolt.HEAPU32[(hitBase + hitSubShape1) >>> 2] === 0x12345678 &&
      jolt.HEAPU32[(hitBase + hitSubShape2) >>> 2] === 0x0abcdef1;

    if (!okIds || !okSettings || !okManifold || !okHit) {
      throw new Error(
        'physics: cannot locate the contact fields of this Jolt build; the bindings have changed',
      );
    }
    return {
      subShape1,
      subShape2,
      manifoldNormal,
      manifoldDepth,
      manifoldBase,
      manifoldCount,
      manifoldPoints,
      friction,
      restitution,
      hitAxis,
      hitDepth,
      hitSubShape1,
      hitSubShape2,
      hitPoint2,
    };
  } finally {
    jolt.destroy(manifold);
    jolt.destroy(contact);
    jolt.destroy(hit);
    jolt.destroy(scratch);
  }
}

class World implements JoltPhysicsWorld {
  readonly timeStep: number;
  readonly settings: JoltWorldSettings;

  private readonly jolt: JoltModule;
  /** Engine length units per metre: every length crossing into or out of Jolt is converted. */
  private readonly scale: number;
  private readonly iface: InstanceType<JoltModule['JoltInterface']>;
  private readonly system: InstanceType<JoltModule['PhysicsSystem']>;
  private readonly bodyInterface: InstanceType<JoltModule['BodyInterface']>;
  private readonly pairLookup: ContactPairLookup;
  private readonly shapes: ShapeCache;
  private readonly recorder: StateRecorder;
  private readonly layout: ListenerLayout;

  // Engine objects owned by the world and reused across calls.
  private readonly vec: JoltVec3;
  private readonly vec2: JoltVec3;
  private readonly rvec: InstanceType<JoltModule['RVec3']>;
  private readonly quat: JoltQuat;
  private readonly unitScale: JoltVec3;
  private readonly origin: InstanceType<JoltModule['RVec3']>;
  private readonly allBroadPhaseLayers: InstanceType<JoltModule['BroadPhaseLayerFilter']>;
  private readonly allObjectLayers: InstanceType<JoltModule['ObjectLayerFilter']>;
  private readonly allShapes: InstanceType<JoltModule['ShapeFilter']>;
  private readonly ignoreFilter: InstanceType<JoltModule['IgnoreMultipleBodiesFilter']>;
  private readonly collideSettings: InstanceType<JoltModule['CollideShapeSettings']>;
  private readonly castSettings: InstanceType<JoltModule['ShapeCastSettings']>;
  private readonly collideCollector: InstanceType<JoltModule['CollideShapeCollectorJS']>;
  private readonly castCollector: InstanceType<JoltModule['CastShapeCollectorJS']>;
  private readonly contactListener: InstanceType<JoltModule['ContactListenerJS']>;
  private readonly shapeFilter: InstanceType<JoltModule['SimShapeFilterJS']>;
  private readonly activationListener: InstanceType<JoltModule['BodyActivationListenerJS']>;
  private readonly saveFilter: InstanceType<JoltModule['StateRecorderFilterJS']>;

  private readonly records = new Map<string, BodyRecord>();
  private readonly byHandle = new Map<number, BodyRecord>();
  private readonly byPointer = new Map<number, BodyRecord>();
  /** Bodies that exist in the engine, in id order (index = rank). */
  private ranked: BodyRecord[] = [];
  private readonly pendingAdds = new Set<BodyRecord>();
  private readonly pendingRemoves = new Set<BodyRecord>();
  private readonly activeBodies = new Set<BodyRecord>();
  private nextHandle = 1;

  private readonly materials: string[] = [];
  private readonly materialIndex = new Map<string, number>();
  private readonly pairFriction: number[][] = [];
  private readonly pairRestitution: number[][] = [];
  /** Rolling and spin resistance lengths per pair, in whole nanometres (see `onContact`). */
  private readonly pairRollingQuanta: number[][] = [];
  private readonly pairSpinQuanta: number[][] = [];

  /** Kinematic bodies with a pose to reach during the next step. */
  private readonly kinematicTargets = new Map<BodyRecord, Pose>();
  /** Contacts of pairs the engine no longer tracks (both bodies asleep or the cache emptied). */
  private readonly book = new Map<number, PairContacts>();
  private liveContacts: PairContacts[] | null = null;

  /** Gravity in the tub frame, m/s^2, and its magnitude. */
  private readonly gravity: Vec3;
  private readonly gravityNorm: number;
  /**
   * Gravity as the engine has it at this moment: `gravity`, except while a settle tilts it
   * (see `settle`). Not part of the state: it is upright again before `settle` returns.
   */
  private gravityNow: Vec3;
  /** The world's rest criterion in steps (`JoltWorldSettings.restHoldTime`). */
  private readonly restHoldSteps: number;
  /** Weight of the latest step in the averaged velocity of a body. */
  private readonly restBlend: number;
  /** Set while a settle call asks for a stricter rest than the one bodies are put to sleep by. */
  private sleepSuspended = false;
  /** Whether no free body moves fast in the step under way (see `ROUND_CALM_SPEED`). */
  private calmNow = true;
  /** Set while a settle call with a disturbance runs: only what was disturbed may sleep. */
  private sleepAfterShake = false;
  /** True when the world was changed from outside since the latest step. */
  private disturbed = true;
  private bodyLayoutChecked = false;
  private stepCounter = 0;
  private stepping = false;
  private manifoldsThisStep = 0;
  private peakManifolds = 0;
  private sleptThisStep: BodyRecord[] = [];
  /** Scratch space of `rodsWillOverlap` and `rodWillEnter`: ends of axes, and two velocities. */
  private readonly rodScratch = new Float64Array(12);
  private readonly rodVelocity = new Float64Array(6);
  /** The pair of bodies the piece filter was last asked about. */
  private filterBody1 = 0;
  private filterBody2 = 0;
  private filterFirst: BodyRecord | undefined;
  private filterSecond: BodyRecord | undefined;
  /** The pair of bodies the validation callback last worked out a contact margin for. */
  private marginBody1 = 0;
  private marginBody2 = 0;
  private marginFirst: BodyRecord | undefined;
  private marginSecond: BodyRecord | undefined;
  /** `restingContactDistance` in engine units. */
  private readonly restingMargin: number;
  /** `penetrationSlop` in engine units. */
  private readonly slop: number;
  /** `speculativeContactDistance` in engine units: the most the engine is ever given. */
  private readonly speculativeMargin: number;
  /** The speculative contact distance the engine currently has, engine units. */
  private speculativeNow: number;
  /** Speed gravity adds in one step, engine units per second. */
  private readonly gravityStep: number;
  private filterBodies: Set<BodyRecord> | null = null;
  private queryHits = new Map<BodyRecord, { depth: number; leaf: number }>();
  private castBest: { fraction: number; record: BodyRecord; leaf: number } | null = null;
  private disposed = false;
  /** Bodies destroyed so far, and the count of bodies and shapes at the latest wrapper sweep. */
  private destroyed = 0;
  private sweptAt = 0;

  constructor(jolt: JoltModule, options: PhysicsWorldOptions, settings: JoltWorldSettings) {
    this.jolt = jolt;
    this.settings = settings;
    this.scale = settings.engineLengthScale;
    this.timeStep = options.timeStep;
    this.pairLookup = options.pairLookup;
    this.gravity = [options.gravity[0], options.gravity[1], options.gravity[2]];
    this.gravityNorm = v3Length(this.gravity);
    this.gravityNow = this.gravity;
    this.restHoldSteps = Math.max(1, Math.round(settings.restHoldTime / options.timeStep));
    this.restBlend = 1 - Math.exp(-options.timeStep / REST_AVERAGING_TIME);
    this.restingMargin = settings.restingContactDistance * this.scale;
    this.slop = settings.penetrationSlop * this.scale;
    this.speculativeMargin = settings.speculativeContactDistance * this.scale;
    this.speculativeNow = this.speculativeMargin;
    this.gravityStep = this.gravityNorm * this.scale * options.timeStep;
    this.layout = probeListenerLayout(jolt);

    // Two object layers and two broad-phase layers: statics, and everything that can move.
    const pairFilter = new jolt.ObjectLayerPairFilterTable(2);
    pairFilter.EnableCollision(LAYER_STATIC, LAYER_MOVING);
    pairFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
    const layers = new jolt.BroadPhaseLayerInterfaceTable(2, 2);
    const staticLayer = new jolt.BroadPhaseLayer(0);
    const movingLayer = new jolt.BroadPhaseLayer(1);
    layers.MapObjectToBroadPhaseLayer(LAYER_STATIC, staticLayer);
    layers.MapObjectToBroadPhaseLayer(LAYER_MOVING, movingLayer);
    jolt.destroy(staticLayer);
    jolt.destroy(movingLayer);
    const creation = new jolt.JoltSettings();
    creation.mMaxBodies = settings.maxBodies;
    creation.mMaxBodyPairs = settings.maxBodyPairs;
    creation.mMaxContactConstraints = settings.maxContactConstraints;
    creation.mObjectLayerPairFilter = pairFilter;
    creation.mBroadPhaseLayerInterface = layers;
    creation.mObjectVsBroadPhaseLayerFilter = new jolt.ObjectVsBroadPhaseLayerFilterTable(
      layers,
      2,
      pairFilter,
      2,
    );
    // The interface takes ownership of the three filter objects.
    this.iface = new jolt.JoltInterface(creation);
    jolt.destroy(creation);
    this.system = this.iface.GetPhysicsSystem();
    this.bodyInterface = this.system.GetBodyInterface();

    this.vec = new jolt.Vec3(0, 0, 0);
    this.vec2 = new jolt.Vec3(0, 0, 0);
    this.rvec = new jolt.RVec3(0, 0, 0);
    this.quat = new jolt.Quat(0, 0, 0, 1);
    this.unitScale = new jolt.Vec3(1, 1, 1);
    this.origin = new jolt.RVec3(0, 0, 0);

    this.vec.Set(
      options.gravity[0] * this.scale,
      options.gravity[1] * this.scale,
      options.gravity[2] * this.scale,
    );
    this.system.SetGravity(this.vec);
    this.applyPhysicsSettings();

    this.allBroadPhaseLayers = new jolt.BroadPhaseLayerFilter();
    this.allObjectLayers = new jolt.ObjectLayerFilter();
    this.allShapes = new jolt.ShapeFilter();
    this.ignoreFilter = new jolt.IgnoreMultipleBodiesFilter();

    this.collideSettings = new jolt.CollideShapeSettings();
    this.collideSettings.mMaxSeparationDistance = 0;
    this.collideSettings.mCollectFacesMode = jolt.ECollectFacesMode_NoFaces;
    this.collideSettings.mActiveEdgeMode = jolt.EActiveEdgeMode_CollideWithAll;
    this.collideSettings.mBackFaceMode = jolt.EBackFaceMode_CollideWithBackFaces;
    this.collideSettings.mCollisionTolerance = settings.collisionTolerance * this.scale;
    this.collideSettings.mPenetrationTolerance = settings.penetrationTolerance;

    this.castSettings = new jolt.ShapeCastSettings();
    this.castSettings.mCollectFacesMode = jolt.ECollectFacesMode_NoFaces;
    this.castSettings.mActiveEdgeMode = jolt.EActiveEdgeMode_CollideWithAll;
    this.castSettings.mBackFaceModeTriangles = jolt.EBackFaceMode_CollideWithBackFaces;
    // A sweep that starts in contact reports it at fraction 0 whichever way it is heading.
    this.castSettings.mBackFaceModeConvex = jolt.EBackFaceMode_CollideWithBackFaces;
    this.castSettings.mCollisionTolerance = settings.collisionTolerance * this.scale;
    this.castSettings.mPenetrationTolerance = settings.penetrationTolerance;
    this.castSettings.mExtraConvexRadius = 0;
    // Sweep the rounded shape itself (core plus radius), not its sharp outer polytope.
    this.castSettings.mUseShrunkenShapeAndConvexRadius = true;
    this.castSettings.mReturnDeepestPoint = false;

    this.collideCollector = new jolt.CollideShapeCollectorJS();
    this.collideCollector.Reset = (): void => {};
    this.collideCollector.OnBody = (): void => {};
    this.collideCollector.AddHit = fastJoltCallback(jolt, (result: number): void =>
      this.onCollideHit(result),
    );

    this.castCollector = new jolt.CastShapeCollectorJS();
    this.castCollector.Reset = (): void => {};
    this.castCollector.OnBody = (): void => {};
    this.castCollector.AddHit = fastJoltCallback(jolt, (result: number): void =>
      this.onCastHit(result),
    );

    const accept = jolt.ValidateResult_AcceptContact;
    const reject = jolt.ValidateResult_RejectContact;
    const overrideCoefficients = settings.contactCoefficients === 'pair-table';
    const listener = new jolt.ContactListenerJS();
    // The callbacks the engine calls most are taken off the bindings' slow path (see
    // `fastJoltCallback`): per piece pair, per candidate contact and per contact.
    listener.OnContactValidate = fastJoltCallback(
      jolt,
      (b1: number, b2: number, _base: number, hit: number): number =>
        this.acceptsHit(b1, b2, hit) ? accept : reject,
    );
    listener.OnContactAdded = fastJoltCallback(
      jolt,
      (b1: number, b2: number, manifold: number, out: number): void =>
        this.onContact(b1, b2, manifold, out, overrideCoefficients),
    );
    listener.OnContactPersisted = fastJoltCallback(
      jolt,
      (b1: number, b2: number, manifold: number, out: number): void =>
        this.onContact(b1, b2, manifold, out, overrideCoefficients),
    );
    listener.OnContactRemoved = fastJoltCallback(jolt, (_pair: number): void => {});
    this.system.SetContactListener(listener);
    this.contactListener = listener;

    // The engine asks it about every pair of pieces (and groups of pieces) whose boxes overlap:
    // it keeps the round rolling surfaces to their job and culls pairs that are too far apart
    // to meet (see `piecesMayCollide`).
    const shapeFilter = new jolt.SimShapeFilterJS();
    shapeFilter.ShouldCollide = fastJoltCallback(
      jolt,
      (
        b1: number,
        _shape1: number,
        sub1: number,
        b2: number,
        _shape2: number,
        sub2: number,
      ): boolean => this.piecesMayCollide(b1, sub1, b2, sub2),
    );
    this.shapeFilter = shapeFilter;
    this.system.SetSimShapeFilter(shapeFilter);

    const activation = new jolt.BodyActivationListenerJS();
    activation.OnBodyActivated = fastJoltCallback(jolt, (_id: number, userData: number): void =>
      this.onActivation(userData, true),
    );
    activation.OnBodyDeactivated = fastJoltCallback(jolt, (_id: number, userData: number): void =>
      this.onActivation(userData, false),
    );
    this.system.SetBodyActivationListener(activation);
    this.activationListener = activation;

    const saveFilter = new jolt.StateRecorderFilterJS();
    saveFilter.ShouldSaveBody = (): boolean => true;
    saveFilter.ShouldSaveConstraint = (): boolean => true;
    saveFilter.ShouldRestoreContact = (): boolean => true;
    saveFilter.ShouldSaveContact = fastJoltCallback(jolt, (id1: number, id2: number): boolean =>
      this.shouldSaveContact(id1, id2),
    );
    this.saveFilter = saveFilter;

    this.shapes = new ShapeCache(jolt, settings);
    this.recorder = new StateRecorder(jolt);
  }

  // ------------------------------------------------------------------------------------------
  // Construction helpers
  // ------------------------------------------------------------------------------------------

  private applyPhysicsSettings(): void {
    const s = this.settings;
    const u = this.scale; // engine length units per metre
    const p = this.system.GetPhysicsSettings();
    p.mBaumgarte = s.baumgarte;
    p.mSpeculativeContactDistance = s.speculativeContactDistance * u;
    p.mPenetrationSlop = s.penetrationSlop * u;
    p.mLinearCastThreshold = s.linearCastThreshold;
    p.mLinearCastMaxPenetration = s.linearCastMaxPenetration;
    p.mManifoldTolerance = s.manifoldTolerance * u;
    p.mMaxPenetrationDistance = s.maxPenetrationDistance * u;
    p.mBodyPairCacheMaxDeltaPositionSq = (s.bodyPairCacheMaxDeltaPosition * u) ** 2;
    p.mBodyPairCacheCosMaxDeltaRotationDiv2 = Math.cos(s.bodyPairCacheMaxDeltaRotation / 2);
    p.mContactNormalCosMaxDeltaRotation = Math.cos(s.contactNormalMaxDeltaRotation);
    p.mContactPointPreserveLambdaMaxDistSq = (s.contactPointPreserveLambdaMaxDistance * u) ** 2;
    p.mInternalEdgeRemovalVertexToleranceSq = s.internalEdgeRemovalVertexToleranceSq * u * u;
    p.mNumVelocitySteps = s.numVelocitySteps;
    p.mNumPositionSteps = s.numPositionSteps;
    p.mMinVelocityForRestitution = s.minVelocityForRestitution * u;
    p.mTimeBeforeSleep = s.timeBeforeSleep;
    p.mPointVelocitySleepThreshold = s.pointVelocitySleepThreshold * u;
    p.mDeterministicSimulation = s.deterministicSimulation;
    p.mConstraintWarmStart = s.constraintWarmStart;
    p.mUseBodyPairContactCache = s.useBodyPairContactCache;
    p.mUseManifoldReduction = s.useManifoldReduction;
    p.mUseLargeIslandSplitter = s.useLargeIslandSplitter;
    // Rest is decided by the wrapper (see `sleepGroupsAtRest`), never by the engine.
    p.mAllowSleeping = false;
    p.mCheckActiveEdges = s.checkActiveEdges;
    this.system.SetPhysicsSettings(p);
  }

  /** Index of a material in the pair tables, resolving its pairs on first sight. */
  private internMaterial(name: string): number {
    const known = this.materialIndex.get(name);
    if (known !== undefined) return known;
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('physics: a contact material needs a non-empty id');
    }
    const index = this.materials.length;
    if (index > 0xffff) throw new Error('physics: too many contact materials');
    // Resolve against every material seen so far before anything is stored, so that a lookup
    // failure leaves the tables untouched. The lookup is always asked in canonical order.
    const friction: number[] = [];
    const restitution: number[] = [];
    const rolling: number[] = [];
    const spin: number[] = [];
    for (let other = 0; other <= index; other++) {
      const otherName = other === index ? name : (this.materials[other] as string);
      const [a, b] = compareIds(name, otherName) <= 0 ? [name, otherName] : [otherName, name];
      const props: ContactPairProperties = this.pairLookup(a, b);
      if (
        !Number.isFinite(props.friction) ||
        props.friction < 0 ||
        !Number.isFinite(props.restitution) ||
        props.restitution < 0 ||
        props.restitution > 1
      ) {
        throw new Error(`physics: invalid contact coefficients for the pair '${a}' / '${b}'`);
      }
      const rollingLength = props.rollingResistance ?? 0;
      const spinLength = props.spinResistance ?? 0;
      if (
        !Number.isFinite(rollingLength) ||
        rollingLength < 0 ||
        !Number.isFinite(spinLength) ||
        spinLength < 0
      ) {
        throw new Error(`physics: invalid resistance lengths for the pair '${a}' / '${b}'`);
      }
      friction.push(props.friction);
      restitution.push(props.restitution);
      rolling.push(Math.round(rollingLength * LENGTH_QUANTA));
      spin.push(Math.round(spinLength * LENGTH_QUANTA));
    }
    this.materials.push(name);
    this.materialIndex.set(name, index);
    for (let other = 0; other < index; other++) {
      (this.pairFriction[other] as number[]).push(friction[other] as number);
      (this.pairRestitution[other] as number[]).push(restitution[other] as number);
      (this.pairRollingQuanta[other] as number[]).push(rolling[other] as number);
      (this.pairSpinQuanta[other] as number[]).push(spin[other] as number);
    }
    this.pairFriction.push(friction);
    this.pairRestitution.push(restitution);
    this.pairRollingQuanta.push(rolling);
    this.pairSpinQuanta.push(spin);
    return index;
  }

  private setInertia(target: InstanceType<JoltModule['MassProperties']>, inertia: Mat3): void {
    const jolt = this.jolt;
    const matrix = new jolt.Mat44();
    // kg m^2 to kg unit^2.
    const k = this.scale * this.scale;
    const x = mat3Column(inertia, 0);
    const y = mat3Column(inertia, 1);
    const z = mat3Column(inertia, 2);
    this.vec.Set(x[0] * k, x[1] * k, x[2] * k);
    matrix.SetAxisX(this.vec);
    this.vec.Set(y[0] * k, y[1] * k, y[2] * k);
    matrix.SetAxisY(this.vec);
    this.vec.Set(z[0] * k, z[1] * k, z[2] * k);
    matrix.SetAxisZ(this.vec);
    this.vec.Set(0, 0, 0);
    matrix.SetTranslation(this.vec);
    target.mInertia = matrix;
    jolt.destroy(matrix);
  }

  private createEngineBody(record: BodyRecord, rank: number): void {
    const jolt = this.jolt;
    const s = this.settings;
    const pose = record.initialPose;
    this.setPoseArguments(pose.p, pose.q);
    const motion =
      record.kind === 'dynamic'
        ? jolt.EMotionType_Dynamic
        : record.kind === 'kinematic'
          ? jolt.EMotionType_Kinematic
          : jolt.EMotionType_Static;
    const layer = record.kind === 'static' ? LAYER_STATIC : LAYER_MOVING;
    const creation = new jolt.BodyCreationSettings(
      record.shape,
      this.rvec,
      this.quat,
      motion,
      layer,
    );
    const engineId = new jolt.BodyID((rank | BODY_SEQUENCE) >>> 0);
    try {
      creation.mUserData = record.handle;
      creation.mAllowDynamicOrKinematic = false;
      creation.mIsSensor = false;
      creation.mUseManifoldReduction = s.useManifoldReduction;
      creation.mCollideKinematicVsNonDynamic = false;
      creation.mApplyGyroscopicForce = s.applyGyroscopicForce;
      creation.mEnhancedInternalEdgeRemoval = s.enhancedInternalEdgeRemoval;
      creation.mAllowSleeping = s.allowSleeping;
      creation.mLinearDamping = s.linearDamping;
      creation.mAngularDamping = s.angularDamping;
      creation.mMaxLinearVelocity = s.maxLinearVelocity * this.scale;
      creation.mMaxAngularVelocity = s.maxAngularVelocity;
      creation.mGravityFactor = s.gravityFactor;
      creation.mNumVelocityStepsOverride = 0;
      creation.mNumPositionStepsOverride = 0;
      creation.mInertiaMultiplier = 1;
      record.casting = record.kind === 'dynamic' && s.linearCast;
      creation.mMotionQuality = record.casting
        ? jolt.EMotionQuality_LinearCast
        : jolt.EMotionQuality_Discrete;
      // Only read by the engine in the 'body-material' diagnostic mode; the contact listener
      // overrides both for every contact otherwise.
      const own = record.leafMaterial[0] ?? 0;
      creation.mFriction = this.pairFriction[own]?.[own] ?? 0;
      creation.mRestitution = this.pairRestitution[own]?.[own] ?? 0;
      if (record.kind === 'dynamic' && record.inertia !== null) {
        creation.mOverrideMassProperties = jolt.EOverrideMassProperties_MassAndInertiaProvided;
        const override = creation.mMassPropertiesOverride;
        override.mMass = record.mass;
        this.setInertia(override, record.inertia);
      }
      const body = this.bodyInterface.CreateBodyWithID(engineId, creation);
      const pointer = jolt.getPointer(body);
      if (pointer === 0) {
        throw new Error(`physics: the engine could not create body '${record.id}'`);
      }
      record.body = body;
      record.pointer = pointer;
      record.rank = rank;
      this.byPointer.set(pointer, record);
      if (record.kind === 'static') {
        record.velocityAt = 0;
      } else {
        if (!this.bodyLayoutChecked) this.checkBodyLayout(body);
        record.velocityAt =
          jolt.getPointer(body.GetMotionProperties()) + BODY_LAYOUT.linearVelocity;
      }
      record.group = record;
      // A new dynamic body starts awake; whatever it touches is woken by the contact.
      const awake = record.kind === 'dynamic';
      this.bodyInterface.AddBody(
        engineId,
        awake ? jolt.EActivation_Activate : jolt.EActivation_DontActivate,
      );
      this.setActive(record, body.IsActive());
    } finally {
      jolt.destroy(engineId);
      jolt.destroy(creation);
    }
  }

  /**
   * Checks, on the first body that can move, that the engine keeps position, orientation,
   * bounds and velocities where {@link BODY_LAYOUT} says, by comparing what is read straight
   * from the heap with what the bindings' getters return for sentinel values.
   */
  private checkBodyLayout(body: JoltBody): void {
    const jolt = this.jolt;
    const f32 = jolt.HEAPF32;
    const at = jolt.getPointer(body);
    const motion = jolt.getPointer(body.GetMotionProperties());
    const read = (base: number, offset: number, count: number): number[] => {
      const out: number[] = [];
      for (let i = 0; i < count; i++) out.push(f32[(base + offset + 4 * i) >>> 2] as number);
      return out;
    };
    const same = (a: readonly number[], b: readonly number[]): boolean =>
      a.length === b.length && a.every((x, i) => x === b[i]);
    const before = {
      linear: this.readVec(body.GetLinearVelocity()),
      angular: this.readVec(body.GetAngularVelocity()),
    };
    this.vec.Set(0.8125, -0.4375, 0.3125);
    this.vec2.Set(-0.5625, 0.6875, -0.1875);
    body.SetLinearVelocity(this.vec);
    body.SetAngularVelocity(this.vec2);
    const okVelocity =
      same(read(motion, BODY_LAYOUT.linearVelocity, 3), [0.8125, -0.4375, 0.3125]) &&
      same(read(motion, BODY_LAYOUT.angularVelocity, 3), [-0.5625, 0.6875, -0.1875]);
    this.vec.Set(before.linear[0], before.linear[1], before.linear[2]);
    this.vec2.Set(before.angular[0], before.angular[1], before.angular[2]);
    body.SetLinearVelocity(this.vec);
    body.SetAngularVelocity(this.vec2);
    const bounds = body.GetWorldSpaceBounds();
    const okPose =
      same(read(at, BODY_LAYOUT.position, 3), this.comPosition(body)) &&
      same(read(at, BODY_LAYOUT.rotation, 4), this.rotation(body)) &&
      same(read(at, BODY_LAYOUT.bounds, 3), this.readVec(bounds.mMin)) &&
      same(read(at, BODY_LAYOUT.bounds + 16, 3), this.readVec(bounds.mMax));
    if (!okVelocity || !okPose) {
      throw new Error(
        'physics: cannot locate the body fields of this Jolt build; the bindings have changed',
      );
    }
    this.bodyLayoutChecked = true;
  }

  // ------------------------------------------------------------------------------------------
  // Engine callbacks. None of them may throw: an exception would unwind through the engine.
  // ------------------------------------------------------------------------------------------

  /**
   * Whether two pieces are tested against each other at all (the engine asks before every
   * narrow-phase test once a round rolling surface exists): a round surface only collides for
   * a dynamic body and only with bodies that are not dynamic. The solid it bounds spans the
   * cavity of its item, so testing it against the pieces of a nested item would be expensive
   * and pointless.
   */
  private piecesMayCollide(body1: number, sub1: number, body2: number, sub2: number): boolean {
    if (body1 !== this.filterBody1 || body2 !== this.filterBody2) {
      this.filterBody1 = body1;
      this.filterBody2 = body2;
      this.filterFirst = this.byPointer.get(body1);
      this.filterSecond = this.byPointer.get(body2);
    }
    const first = this.filterFirst;
    const second = this.filterSecond;
    if (first === undefined || second === undefined) return true;
    const u32 = this.jolt.HEAPU32;
    const id1 = u32[sub1 >>> 2] as number;
    const id2 = u32[sub2 >>> 2] as number;
    const mask1 = first.built.subShapeMask;
    const mask2 = second.built.subShapeMask;
    // An empty sub-shape id (all bits set) is the whole compound: its leaves are asked next.
    if (
      first.hasRound &&
      id1 !== 0xffffffff &&
      first.topRound[id1 & mask1] != null &&
      (first.kind !== 'dynamic' || second.kind === 'dynamic')
    ) {
      return false;
    }
    if (
      second.hasRound &&
      id2 !== 0xffffffff &&
      second.topRound[id2 & mask2] != null &&
      (second.kind !== 'dynamic' || first.kind === 'dynamic')
    ) {
      return false;
    }
    if (id1 === 0xffffffff || id2 === 0xffffffff) return true;

    // The engine got here because two boxes overlap, each the box of a piece or group in the
    // frame of something else and grown by the contact distance; for thin pieces at an angle
    // that is most of the time. The spheres about the two say more: apart by more than the
    // contact distance and what the two bodies travel in the step (the sweep of a fast body
    // asks too), the pieces cannot meet in it and the engine is spared the test. Nothing it
    // would have found is lost, so the simulation is the same with or without this.
    const f32 = this.jolt.HEAPF32;
    // A sub-shape id whose bits above the index of the child are all set names the child
    // itself (a leaf or a whole group); otherwise a leaf inside a group.
    let balls1 = first.topBall;
    let at1 = 4 * (id1 & mask1);
    if ((id1 | mask1) >>> 0 !== 0xffffffff) {
      const top = id1 & mask1;
      balls1 = first.leafBall;
      at1 =
        4 *
        ((first.built.topFirstLeaf[top] as number) +
          ((id1 >>> first.built.subShapeBits) & (first.built.topInnerMask[top] as number)));
    }
    let balls2 = second.topBall;
    let at2 = 4 * (id2 & mask2);
    if ((id2 | mask2) >>> 0 !== 0xffffffff) {
      const top = id2 & mask2;
      balls2 = second.leafBall;
      at2 =
        4 *
        ((second.built.topFirstLeaf[top] as number) +
          ((id2 >>> second.built.subShapeBits) & (second.built.topInnerMask[top] as number)));
    }
    const m1 = this.rotationOf(first);
    const m2 = this.rotationOf(second);
    const p1 = first.pointer >>> 2;
    const p2 = second.pointer >>> 2;
    const x1 = balls1[at1] as number;
    const y1 = balls1[at1 + 1] as number;
    const z1 = balls1[at1 + 2] as number;
    const x2 = balls2[at2] as number;
    const y2 = balls2[at2 + 1] as number;
    const z2 = balls2[at2 + 2] as number;
    const dx =
      (f32[p2] as number) +
      (m2[0] as number) * x2 +
      (m2[1] as number) * y2 +
      (m2[2] as number) * z2 -
      ((f32[p1] as number) +
        (m1[0] as number) * x1 +
        (m1[1] as number) * y1 +
        (m1[2] as number) * z1);
    const dy =
      (f32[p2 + 1] as number) +
      (m2[3] as number) * x2 +
      (m2[4] as number) * y2 +
      (m2[5] as number) * z2 -
      ((f32[p1 + 1] as number) +
        (m1[3] as number) * x1 +
        (m1[4] as number) * y1 +
        (m1[5] as number) * z1);
    const dz =
      (f32[p2 + 2] as number) +
      (m2[6] as number) * x2 +
      (m2[7] as number) * y2 +
      (m2[8] as number) * z2 -
      ((f32[p1 + 2] as number) +
        (m1[6] as number) * x1 +
        (m1[7] as number) * y1 +
        (m1[8] as number) * z1);
    // What the two travel in the step, from the velocities they have at this moment (the
    // sweep runs after the velocities of the step have been solved).
    let travel = 0;
    if (first.velocityAt !== 0) {
      const v = first.velocityAt >>> 2;
      travel += Math.hypot(f32[v] as number, f32[v + 1] as number, f32[v + 2] as number);
    }
    if (second.velocityAt !== 0) {
      const v = second.velocityAt >>> 2;
      travel += Math.hypot(f32[v] as number, f32[v + 1] as number, f32[v + 2] as number);
    }
    const reach =
      (balls1[at1 + 3] as number) +
      (balls2[at2 + 3] as number) +
      this.speculativeNow +
      travel * this.timeStep +
      BALL_SLACK;
    return dx * dx + dy * dy + dz * dz <= reach * reach;
  }

  /**
   * The rotation matrix of a body (row-major, body axes to tub axes) as the engine holds its
   * orientation at this moment; worked out afresh only when the orientation has changed.
   */
  private rotationOf(record: BodyRecord): Float64Array {
    const f32 = this.jolt.HEAPF32;
    const at = (record.pointer + BODY_LAYOUT.rotation) >>> 2;
    const x = f32[at] as number;
    const y = f32[at + 1] as number;
    const z = f32[at + 2] as number;
    const w = f32[at + 3] as number;
    const m = record.matrix;
    if (m[9] !== x || m[10] !== y || m[11] !== z || m[12] !== w) {
      m[0] = 1 - 2 * (y * y + z * z);
      m[1] = 2 * (x * y - z * w);
      m[2] = 2 * (x * z + y * w);
      m[3] = 2 * (x * y + z * w);
      m[4] = 1 - 2 * (x * x + z * z);
      m[5] = 2 * (y * z - x * w);
      m[6] = 2 * (x * z - y * w);
      m[7] = 2 * (y * z + x * w);
      m[8] = 1 - 2 * (x * x + y * y);
      m[9] = x;
      m[10] = y;
      m[11] = z;
      m[12] = w;
    }
    return m;
  }

  /** The engine found two pieces within the speculative distance: is it a contact? */
  private acceptsHit(body1: number, body2: number, hit: number): boolean {
    const layout = this.layout;
    const f32 = this.jolt.HEAPF32;
    const depth = f32[(hit + layout.hitDepth) >>> 2] as number;
    if (body1 !== this.marginBody1 || body2 !== this.marginBody2) {
      this.marginBody1 = body1;
      this.marginBody2 = body2;
      this.marginFirst = this.byPointer.get(body1);
      this.marginSecond = this.byPointer.get(body2);
    }
    const first = this.marginFirst;
    const second = this.marginSecond;
    if (first === undefined || second === undefined) return true;
    // A long capsule is in the engine as lengths end to end, each with rounded ends of its own.
    // Where one length runs on into the next, its rounded end lies inside the next and is no
    // part of the surface: what is found on it (the edge of a block that slides along a wire
    // meets the buried end of every length head-on) is no contact. The next length reports the
    // true one. Asked of pieces that are apart only: these are the contacts that stop what has
    // not arrived, and where the pieces are the engine says exactly then (a piece the sweep of
    // a fast body has brought up against a wire is reported where it will be).
    // And of the capsules of bodies that are not free only (the wires of a rack or a basket,
    // which is where things slide along them).
    const joined1 = first.kind === 'dynamic' ? null : first.joined;
    const joined2 = second.kind === 'dynamic' ? null : second.joined;
    if (depth < 0 && (joined1 !== null || joined2 !== null)) {
      const u32 = this.jolt.HEAPU32;
      const h = hit >>> 2;
      if (joined1 !== null) {
        const leaf = leafOfSubShape(first.built, u32[(hit + layout.hitSubShape1) >>> 2] as number);
        const ends = joined1[leaf] as number;
        if (
          ends !== 0 &&
          this.onBuriedEnd(
            first,
            leaf,
            ends,
            f32[h] as number,
            f32[h + 1] as number,
            f32[h + 2] as number,
          )
        ) {
          return false;
        }
      }
      if (joined2 !== null) {
        const leaf = leafOfSubShape(second.built, u32[(hit + layout.hitSubShape2) >>> 2] as number);
        const ends = joined2[leaf] as number;
        const q = (hit + layout.hitPoint2) >>> 2;
        if (
          ends !== 0 &&
          this.onBuriedEnd(
            second,
            leaf,
            ends,
            (f32[q] as number) + first.preCx - second.preCx,
            (f32[q + 1] as number) + first.preCy - second.preCy,
            (f32[q + 2] as number) + first.preCz - second.preCz,
          )
        ) {
          return false;
        }
      }
    }
    if (depth < 0) {
      // Apart. The speed that counts is the one along the line between the closest points, at
      // those points, from the velocities the two bodies had before the step.
      const h = hit >>> 2;
      const a = (hit + layout.hitAxis) >>> 2;
      let nx = f32[a] as number;
      let ny = f32[a + 1] as number;
      let nz = f32[a + 2] as number;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!(length > 0)) return false;
      nx /= length;
      ny /= length;
      nz /= length;
      // The contact point on the first shape, relative to the first body's centre of mass.
      const p1x = f32[h] as number;
      const p1y = f32[h + 1] as number;
      const p1z = f32[h + 2] as number;
      const p2x = p1x + first.preCx - second.preCx;
      const p2y = p1y + first.preCy - second.preCy;
      const p2z = p1z + first.preCz - second.preCz;
      // Velocity of the second body at the point, less that of the first.
      const vx =
        second.preVx +
        second.preWy * p2z -
        second.preWz * p2y -
        (first.preVx + first.preWy * p1z - first.preWz * p1y);
      const vy =
        second.preVy +
        second.preWz * p2x -
        second.preWx * p2z -
        (first.preVy + first.preWz * p1x - first.preWx * p1z);
      const vz =
        second.preVz +
        second.preWx * p2y -
        second.preWy * p2x -
        (first.preVz + first.preWx * p1y - first.preWy * p1x);
      // The axis points from the first shape to the second: closing is motion against it.
      const moving = Math.max(0, -(vx * nx + vy * ny + vz * nz));
      const reach = this.settings.speculativeSpeedFactor * this.timeStep;
      // Beyond the resting margin: a contact only if the two pieces can close the gap within
      // the step (`JoltWorldSettings.restingContactDistance`), with what gravity adds in it.
      if (-depth > this.restingMargin && -depth > reach * (moving + this.gravityStep)) {
        return false;
      }
      // A contact between two pieces that are apart holds them to the line between their
      // closest points for the whole step. Where the pieces would close the gap along that
      // line by their own motion and one of them is round, the line may be wrong (see
      // `rodsWillOverlap`): ask where they will really be.
      //
      // Only of bodies that are where their velocities say they will be, though. One that was
      // knocked about in the step before (a plate that has just landed and is turning into
      // its tines) may be again in this one, and a contact refused on the strength of where
      // it was heading is then missing: measured, a rim 0.26 mm inside a tine within one step.
      // Such a body keeps every contact the engine offers.
      //
      // And only between a body that moves freely and one that does not (a rack, a basket, the
      // tub): that is where things slide onto wires. Two free bodies that fall into each other
      // can both be struck in the same step by a third, and a pile of cutlery dropped into a
      // basket cell ended with knives inside each other in two of eight trials.
      //
      // And not at all while anything in the world moves fast (`ROUND_CALM_SPEED`).
      if (
        this.calmNow &&
        this.settings.predictRoundContacts &&
        -depth < reach * moving &&
        (first.kind !== 'dynamic' || second.kind !== 'dynamic') &&
        first.knock +
          first.knockTurn * Math.sqrt(p1x * p1x + p1y * p1y + p1z * p1z) +
          second.knock +
          second.knockTurn * Math.sqrt(p2x * p2x + p2y * p2y + p2z * p2z) <=
          ROUND_KNOCK_SHARE * this.gravityStep
      ) {
        const u32 = this.jolt.HEAPU32;
        const leaf1 = leafOfSubShape(first.built, u32[(hit + layout.hitSubShape1) >>> 2] as number);
        const leaf2 = leafOfSubShape(
          second.built,
          u32[(hit + layout.hitSubShape2) >>> 2] as number,
        );
        const round1 = (first.leafRod[7 * leaf1 + 6] as number) > 0;
        const round2 = (second.leafRod[7 * leaf2 + 6] as number) > 0;
        if (round1 && round2) {
          if (!this.rodsWillOverlap(first, leaf1, second, leaf2)) return false;
        } else if (round1) {
          const faces = second.leafFaces[leaf2];
          if (faces != null && !this.rodWillEnter(first, leaf1, second, faces)) return false;
        } else if (round2) {
          const faces = first.leafFaces[leaf1];
          if (faces != null && !this.rodWillEnter(second, leaf2, first, faces)) return false;
        }
      }
    }
    if (!first.hasRound && !second.hasRound) return true;
    const u32 = this.jolt.HEAPU32;
    const round1 =
      first.topRound[(u32[(hit + layout.hitSubShape1) >>> 2] as number) & first.built.subShapeMask];
    const round2 =
      second.topRound[
        (u32[(hit + layout.hitSubShape2) >>> 2] as number) & second.built.subShapeMask
      ];
    if (round1 == null && round2 == null) return true;
    // A round surface acts for a dynamic body against one that is not (see piecesMayCollide,
    // which cannot tell the only piece of a body from the body).
    if (round1 != null && (first.kind !== 'dynamic' || second.kind === 'dynamic')) return false;
    if (round2 != null && (second.kind !== 'dynamic' || first.kind === 'dynamic')) return false;
    // The penetration axis points from the first shape to the second.
    const ax = f32[(hit + layout.hitAxis) >>> 2] as number;
    const ay = f32[(hit + layout.hitAxis + 4) >>> 2] as number;
    const az = f32[(hit + layout.hitAxis + 8) >>> 2] as number;
    const length = Math.sqrt(ax * ax + ay * ay + az * az);
    if (!(length > 0)) return false;
    if (
      round1 != null &&
      !this.roundTakes(first, round1, depth, ax / length, ay / length, az / length)
    ) {
      return false;
    }
    if (
      round2 != null &&
      !this.roundTakes(second, round2, depth, -ax / length, -ay / length, -az / length)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Whether the point `(px, py, pz)` on a capsule leaf (relative to the centre of mass of its
   * body, tub axes, engine units) lies beyond an end of its axis at which the capsule runs on
   * into its next length (`ends`, see `BuiltShape.leafJoined`): on a rounded end that is buried
   * in that next length. Beyond by more than a thousandth of the length of the leaf (0.04 mm
   * for one of 40 mm, forty times what single precision leaves uncertain), so that a point at
   * the joint itself belongs to both lengths.
   */
  private onBuriedEnd(
    record: BodyRecord,
    leaf: number,
    ends: number,
    px: number,
    py: number,
    pz: number,
  ): boolean {
    this.rodEnds(record, leaf, 0);
    const e = this.rodScratch;
    const ax = e[0] as number;
    const ay = e[1] as number;
    const az = e[2] as number;
    const dx = (e[3] as number) - ax;
    const dy = (e[4] as number) - ay;
    const dz = (e[5] as number) - az;
    const length2 = dx * dx + dy * dy + dz * dz;
    const along = (px - ax) * dx + (py - ay) * dy + (pz - az) * dz;
    if ((ends & 1) !== 0 && along < -1e-3 * length2) return true;
    return (ends & 2) !== 0 && along > 1.001 * length2;
  }

  /**
   * Puts the two ends of the axis of a round leaf (see `BodyRecord.leafRod`) into `rodScratch`
   * from `slot`, relative to the centre of mass of its body, in tub axes, engine units.
   */
  private rodEnds(record: BodyRecord, leaf: number, slot: number): void {
    const m = this.rotationOf(record);
    const rod = record.leafRod;
    const e = this.rodScratch;
    for (let k = 0; k < 2; k++) {
      const at = 7 * leaf + 3 * k;
      const x = rod[at] as number;
      const y = rod[at + 1] as number;
      const z = rod[at + 2] as number;
      e[slot + 3 * k] = (m[0] as number) * x + (m[1] as number) * y + (m[2] as number) * z;
      e[slot + 3 * k + 1] = (m[3] as number) * x + (m[4] as number) * y + (m[5] as number) * z;
      e[slot + 3 * k + 2] = (m[6] as number) * x + (m[7] as number) * y + (m[8] as number) * z;
    }
  }

  /**
   * Velocity of body `a` less that of body `b` at the two points in `rodScratch` from 0 (given
   * relative to the centre of `a`), into `rodVelocity`; returns the larger of the two speeds.
   * From the velocities before the step, with what each body gained in the step before
   * (`BodyRecord.gain`) added once more: what falls goes on falling (left out, a plate sliding
   * down its tines was 0.26 mm further on than expected, and inside one), what lies on
   * something goes on lying on it, and what slides goes on slowing down. A body that has just
   * been let go is 0.17 mm further down after its first step than this says.
   */
  private rodDrift(a: BodyRecord, b: BodyRecord): number {
    const e = this.rodScratch;
    const rel = this.rodVelocity;
    // The centre of b as seen from that of a.
    const ox = b.preCx - a.preCx;
    const oy = b.preCy - a.preCy;
    const oz = b.preCz - a.preCz;
    const ga = a.gain;
    const gb = b.gain;
    const avx = a.preVx + (ga[0] as number);
    const avy = a.preVy + (ga[1] as number);
    const avz = a.preVz + (ga[2] as number);
    const awx = a.preWx + (ga[3] as number);
    const awy = a.preWy + (ga[4] as number);
    const awz = a.preWz + (ga[5] as number);
    const bvx = b.preVx + (gb[0] as number);
    const bvy = b.preVy + (gb[1] as number);
    const bvz = b.preVz + (gb[2] as number);
    const bwx = b.preWx + (gb[3] as number);
    const bwy = b.preWy + (gb[4] as number);
    const bwz = b.preWz + (gb[5] as number);
    let fastest = 0;
    for (let k = 0; k < 2; k++) {
      const px = e[3 * k] as number;
      const py = e[3 * k + 1] as number;
      const pz = e[3 * k + 2] as number;
      const qx = px - ox;
      const qy = py - oy;
      const qz = pz - oz;
      const vx = avx + awy * pz - awz * py - (bvx + bwy * qz - bwz * qy);
      const vy = avy + awz * px - awx * pz - (bvy + bwz * qx - bwx * qz);
      const vz = avz + awx * py - awy * px - (bvz + bwx * qy - bwy * qx);
      rel[3 * k] = vx;
      rel[3 * k + 1] = vy;
      rel[3 * k + 2] = vz;
      fastest = Math.max(fastest, Math.hypot(vx, vy, vz));
    }
    return fastest;
  }

  /**
   * Whether two round leaves (capsules or spheres) that are apart will overlap by more than
   * `ROUND_OVERLAP_SLOPS` times the penetration slop within the coming step and the half step
   * after it (`speculativeSpeedFactor`), on the velocities their bodies have before it. Asked
   * of two that would close the gap between them along the line between their nearest points
   * by their own motion while passing each other faster than they approach: only if they will
   * really overlap do they get the contact.
   *
   * A contact between two pieces that are apart lets them close the gap along the line between
   * their nearest points and no further. For two flat faces that is exact. For a wire, a rim or
   * the rounded edge of a box, whose nearest point moves round it as the other piece passes, it
   * is not: the edge of a block that slides towards a wire at the height of its top is stopped
   * at the wire as at a wall, thrown up and held back, although it would pass over it. Measured
   * before this test existed, on wires 10 mm apart: a block set sliding across them at 0.6 m/s
   * stopped after 23 mm (32 mm with 2 mm edges) where friction of 0.3 allows 61 mm, and the
   * end stop of the rack profile slid a block across the wires 23 to 29 % less far than along
   * them. Round pieces are simple enough to follow exactly instead: the first is moved as its
   * body moves relative to the second, and the distance between the two axes is looked at
   * along the way. They get the contact when they will be in each other by more than a resting
   * contact is (`ROUND_OVERLAP_SLOPS`), or will touch having come at each other squarely
   * (`ROUND_SQUARE_SHARE`): what falls on a wire is stopped at its surface as before. Pieces
   * that will only graze, or slide into each other by no more than a resting contact sinks in,
   * get no contact until they touch, when the line between them is the one they touch along.
   * Pieces that are not moving towards each other are not asked at all: what lies on a wire
   * keeps its contact with it.
   */
  private rodsWillOverlap(
    first: BodyRecord,
    leaf1: number,
    second: BodyRecord,
    leaf2: number,
  ): boolean {
    this.rodEnds(first, leaf1, 0);
    this.rodEnds(second, leaf2, 6);
    const fastest = this.rodDrift(first, second);
    const e = this.rodScratch;
    const rel = this.rodVelocity;
    const ox = second.preCx - first.preCx;
    const oy = second.preCy - first.preCy;
    const oz = second.preCz - first.preCz;
    const radius1 = first.leafRod[7 * leaf1 + 6] as number;
    const radius2 = second.leafRod[7 * leaf2 + 6] as number;
    const radii = radius1 + radius2;
    const deep = radii - ROUND_OVERLAP_SLOPS * this.slop;
    const horizon = this.settings.speculativeSpeedFactor * this.timeStep;
    // Looked at often enough that the two cannot pass through each other between two looks:
    // every half of their radii of travel, three times at least.
    const looks = Math.min(
      ROUND_LOOKS_MOST,
      Math.max(3, Math.ceil((fastest * horizon) / (0.5 * radii))),
    );
    const square = (ROUND_SQUARE_SHARE * fastest * horizon) / looks;
    let before = 0;
    for (let n = 0; n <= looks; n++) {
      const t = (n / looks) * horizon;
      const distance = segmentDistance(
        (e[0] as number) + t * (rel[0] as number),
        (e[1] as number) + t * (rel[1] as number),
        (e[2] as number) + t * (rel[2] as number),
        (e[3] as number) + t * (rel[3] as number),
        (e[4] as number) + t * (rel[4] as number),
        (e[5] as number) + t * (rel[5] as number),
        (e[6] as number) + ox,
        (e[7] as number) + oy,
        (e[8] as number) + oz,
        (e[9] as number) + ox,
        (e[10] as number) + oy,
        (e[11] as number) + oz,
      );
      if (n > 0) {
        // In each other by more than a resting contact; or touching, having come squarely.
        if (distance < deep) return true;
        if (distance < radii && before - distance > square) return true;
      }
      before = distance;
    }
    return false;
  }

  /**
   * The same question as `rodsWillOverlap` for a round leaf of `round` and a hull or box of
   * `solid` given by its `faces` (see `BodyRecord.leafFaces`): will the round leaf be in the
   * hull by more than `ROUND_OVERLAP_SLOPS` slops, or touch it squarely, within the step and a
   * half to come?
   *
   * The axis of the round leaf is moved as its body moves relative to the other and looked at
   * along the way. It is clear of the hull by at least the largest distance at which both its
   * ends stand off one face (the hull lies behind every one of its faces) and, where they
   * stand off two, by the distance to the edge in which the two faces meet: the exact distance
   * wherever the axis faces a face or an edge of the hull, and less than it off a corner. So a
   * wire that the flat bottom of a block comes down on gets its contact, and a wire that the
   * same bottom slides onto from the side, level with the wires it lies on, does not.
   */
  private rodWillEnter(
    round: BodyRecord,
    leaf: number,
    solid: BodyRecord,
    faces: Float64Array,
  ): boolean {
    this.rodEnds(round, leaf, 0);
    const fastest = this.rodDrift(round, solid);
    const e = this.rodScratch;
    const rel = this.rodVelocity;
    const m = this.rotationOf(solid);
    // The centre of the round body as seen from that of the solid one.
    const ox = round.preCx - solid.preCx;
    const oy = round.preCy - solid.preCy;
    const oz = round.preCz - solid.preCz;
    const radius = round.leafRod[7 * leaf + 6] as number;
    const deep = radius - ROUND_OVERLAP_SLOPS * this.slop;
    const horizon = this.settings.speculativeSpeedFactor * this.timeStep;
    const looks = Math.min(
      ROUND_LOOKS_MOST,
      Math.max(3, Math.ceil((fastest * horizon) / (0.5 * radius))),
    );
    const square = (ROUND_SQUARE_SHARE * fastest * horizon) / looks;
    let before = 0;
    for (let n = 0; n <= looks; n++) {
      const t = (n / looks) * horizon;
      // The two ends relative to the solid body's centre, tub axes, then in its own axes.
      const ax = (e[0] as number) + t * (rel[0] as number) + ox;
      const ay = (e[1] as number) + t * (rel[1] as number) + oy;
      const az = (e[2] as number) + t * (rel[2] as number) + oz;
      const bx = (e[3] as number) + t * (rel[3] as number) + ox;
      const by = (e[4] as number) + t * (rel[4] as number) + oy;
      const bz = (e[5] as number) + t * (rel[5] as number) + oz;
      const pax = (m[0] as number) * ax + (m[3] as number) * ay + (m[6] as number) * az;
      const pay = (m[1] as number) * ax + (m[4] as number) * ay + (m[7] as number) * az;
      const paz = (m[2] as number) * ax + (m[5] as number) * ay + (m[8] as number) * az;
      const pbx = (m[0] as number) * bx + (m[3] as number) * by + (m[6] as number) * bz;
      const pby = (m[1] as number) * bx + (m[4] as number) * by + (m[7] as number) * bz;
      const pbz = (m[2] as number) * bx + (m[5] as number) * by + (m[8] as number) * bz;
      // The two faces the axis stands furthest off.
      let clear = -Infinity;
      let second = -Infinity;
      let clearFace = 0;
      let secondFace = 0;
      for (let k = 0; k < faces.length; k += 4) {
        const nx = faces[k] as number;
        const ny = faces[k + 1] as number;
        const nz = faces[k + 2] as number;
        const offset = faces[k + 3] as number;
        const off = Math.min(
          nx * pax + ny * pay + nz * paz - offset,
          nx * pbx + ny * pby + nz * pbz - offset,
        );
        if (off > clear) {
          second = clear;
          secondFace = clearFace;
          clear = off;
          clearFace = k;
        } else if (off > second) {
          second = off;
          secondFace = k;
        }
      }
      if (second > 0) {
        // Off two faces at once: off the edge between them, by the distance to the wedge the
        // two faces bound (the hull lies inside it).
        const c =
          (faces[clearFace] as number) * (faces[secondFace] as number) +
          (faces[clearFace + 1] as number) * (faces[secondFace + 1] as number) +
          (faces[clearFace + 2] as number) * (faces[secondFace + 2] as number);
        if (second > clear * c && c < 1 - 1e-9) {
          clear = Math.sqrt(
            (clear * clear + second * second - 2 * c * clear * second) / (1 - c * c),
          );
        }
      }
      if (n > 0) {
        if (clear < deep) return true;
        if (clear < radius && before - clear > square) return true;
      }
      before = clear;
    }
    return false;
  }

  /**
   * Whether a round rolling surface takes a contact of the given depth (engine units) whose
   * normal `(nx, ny, nz)` (tub frame, unit) points out of it: only from outside, that is, not
   * deeper than its limit, and only on its side, not on the flat ends of the solid it bounds.
   */
  private roundTakes(
    record: BodyRecord,
    round: RoundLeaf,
    depth: number,
    nx: number,
    ny: number,
    nz: number,
  ): boolean {
    if (depth > round.maxDepth) return false;
    const f32 = this.jolt.HEAPF32;
    const at = (record.pointer + BODY_LAYOUT.rotation) >>> 2;
    const axis = quatRotate(
      [f32[at] as number, f32[at + 1] as number, f32[at + 2] as number, f32[at + 3] as number],
      round.axis,
    );
    const along = Math.max(-1, Math.min(1, nx * axis[0] + ny * axis[1] + nz * axis[2]));
    return (
      Math.abs(Math.asin(along) - Math.asin(round.normalAlongAxis)) <=
      this.settings.roundSurfaceNormalTolerance
    );
  }

  private onContact(
    body1: number,
    body2: number,
    manifold: number,
    out: number,
    overrideCoefficients: boolean,
  ): void {
    this.manifoldsThisStep++;
    const first = this.byPointer.get(body1);
    const second = this.byPointer.get(body2);
    if (first === undefined || second === undefined) return;
    const layout = this.layout;
    const u32 = this.jolt.HEAPU32;
    const sub1 = u32[(manifold + layout.subShape1) >>> 2] as number;
    const sub2 = u32[(manifold + layout.subShape2) >>> 2] as number;
    const m1 = first.leafMaterial[leafOfSubShape(first.built, sub1)] as number;
    const m2 = second.leafMaterial[leafOfSubShape(second.built, sub2)] as number;
    const f32 = this.jolt.HEAPF32;
    if (overrideCoefficients) {
      f32[(out + layout.friction) >>> 2] = (this.pairFriction[m1] as number[])[m2] as number;
      f32[(out + layout.restitution) >>> 2] = (this.pairRestitution[m1] as number[])[m2] as number;
    }

    // Two dynamic bodies with a contact between them come to rest, and sleep, together.
    const dynamic1 = first.kind === 'dynamic';
    const dynamic2 = second.kind === 'dynamic';
    if (dynamic1 && dynamic2) {
      let a = first;
      while (a.group !== a) a = a.group;
      let b = second;
      while (b.group !== b) b = b.group;
      if (a !== b) {
        // The representative is the body that comes first in id order (rank), so the outcome
        // does not depend on the order in which the engine reports the contacts.
        if (a.rank < b.rank) b.group = a;
        else a.group = b;
      }
    }

    // A contact whose surfaces touch supports the bodies (a resting contact sinks in by up to
    // the penetration slop; one that is merely near, like the facets under a round rolling
    // surface, does not carry load): remember where and how, for the rolling and spin
    // resistance applied after the step.
    const depth = f32[(manifold + layout.manifoldDepth) >>> 2] as number;
    if (depth < -0.5 * this.settings.contactTouchDistance * this.scale) return;
    if (first.hasRound && first.topRound[sub1 & first.built.subShapeMask] != null) {
      first.roundSeen = true;
    }
    if (second.hasRound && second.topRound[sub2 & second.built.subShapeMask] != null) {
      second.roundSeen = true;
    }
    if (dynamic1 && dynamic2) {
      first.neighbourSeen = true;
      second.neighbourSeen = true;
    }
    const count = u32[(manifold + layout.manifoldCount) >>> 2] as number;
    if (count === 0) return;
    const rolling = (this.pairRollingQuanta[m1] as number[])[m2] as number;
    const spin = (this.pairSpinQuanta[m1] as number[])[m2] as number;
    if (rolling === 0 && spin === 0) return;
    // Everything is summed as whole numbers of a fixed quantum, so that the sums are exact and
    // do not depend on the order in which the engine reports the contacts.
    const n = (manifold + layout.manifoldNormal) >>> 2;
    const nx = Math.round((f32[n] as number) * SUPPORT_QUANTA);
    const ny = Math.round((f32[n + 1] as number) * SUPPORT_QUANTA);
    const nz = Math.round((f32[n + 2] as number) * SUPPORT_QUANTA);
    const base = (manifold + layout.manifoldBase) >>> 2;
    const bx = f32[base] as number;
    const by = f32[base + 1] as number;
    const bz = f32[base + 2] as number;
    const s1 = dynamic1 ? first.support : null;
    const s2 = dynamic2 ? second.support : null;
    let point = (manifold + layout.manifoldPoints) >>> 2;
    for (let k = 0; k < count; k++, point += 4) {
      const x = (f32[point] as number) + bx;
      const y = (f32[point + 1] as number) + by;
      const z = (f32[point + 2] as number) + bz;
      const px = Math.round(x * SUPPORT_QUANTA);
      const py = Math.round(y * SUPPORT_QUANTA);
      const pz = Math.round(z * SUPPORT_QUANTA);
      const cx = Math.round(x * SPREAD_QUANTA);
      const cy = Math.round(y * SPREAD_QUANTA);
      const cz = Math.round(z * SPREAD_QUANTA);
      for (let side = 0; side < 2; side++) {
        const sums = side === 0 ? s1 : s2;
        if (sums === null) continue;
        // The normal points from the first body to the second: it pushes the second along +n
        // and the first along -n.
        const sign = side === 0 ? -1 : 1;
        sums[SUPPORT_COUNT] = (sums[SUPPORT_COUNT] as number) + 1;
        sums[SUPPORT_NORMAL] = (sums[SUPPORT_NORMAL] as number) + sign * nx;
        sums[SUPPORT_NORMAL + 1] = (sums[SUPPORT_NORMAL + 1] as number) + sign * ny;
        sums[SUPPORT_NORMAL + 2] = (sums[SUPPORT_NORMAL + 2] as number) + sign * nz;
        sums[SUPPORT_POSITION] = (sums[SUPPORT_POSITION] as number) + px;
        sums[SUPPORT_POSITION + 1] = (sums[SUPPORT_POSITION + 1] as number) + py;
        sums[SUPPORT_POSITION + 2] = (sums[SUPPORT_POSITION + 2] as number) + pz;
        sums[SUPPORT_COARSE] = (sums[SUPPORT_COARSE] as number) + cx;
        sums[SUPPORT_COARSE + 1] = (sums[SUPPORT_COARSE + 1] as number) + cy;
        sums[SUPPORT_COARSE + 2] = (sums[SUPPORT_COARSE + 2] as number) + cz;
        sums[SUPPORT_PRODUCT] = (sums[SUPPORT_PRODUCT] as number) + cx * cx;
        sums[SUPPORT_PRODUCT + 1] = (sums[SUPPORT_PRODUCT + 1] as number) + cx * cy;
        sums[SUPPORT_PRODUCT + 2] = (sums[SUPPORT_PRODUCT + 2] as number) + cx * cz;
        sums[SUPPORT_PRODUCT + 3] = (sums[SUPPORT_PRODUCT + 3] as number) + cy * cy;
        sums[SUPPORT_PRODUCT + 4] = (sums[SUPPORT_PRODUCT + 4] as number) + cy * cz;
        sums[SUPPORT_PRODUCT + 5] = (sums[SUPPORT_PRODUCT + 5] as number) + cz * cz;
        sums[SUPPORT_ROLLING] = (sums[SUPPORT_ROLLING] as number) + rolling;
        sums[SUPPORT_SPIN] = (sums[SUPPORT_SPIN] as number) + spin;
      }
    }
  }

  private setActive(record: BodyRecord, active: boolean): void {
    record.active = active;
    if (active) this.activeBodies.add(record);
    else this.activeBodies.delete(record);
  }

  private dropHold(record: BodyRecord): void {
    if (!record.holding) return;
    record.hold.fill(0);
    record.holding = false;
  }

  private onActivation(handle: number, active: boolean): void {
    const record = this.byHandle.get(handle);
    if (record === undefined) return;
    this.setActive(record, active);
    // A body that wakes has to earn its rest again (and to be disturbed again, in a settle).
    if (active) {
      record.restSteps = 0;
      record.mean.fill(0);
      record.shaken = false;
      record.shaking = false;
      record.gain.fill(0);
      record.knock = 0;
      record.knockTurn = 0;
    }
    if (!this.stepping) return;
    if (active) record.touchedStep = this.stepCounter;
    else this.sleptThisStep.push(record);
  }

  private recordOfEngineId(engineId: number): BodyRecord | undefined {
    const record = this.ranked[engineId & BODY_INDEX_MASK];
    return record !== undefined && (record.rank | BODY_SEQUENCE) >>> 0 === engineId >>> 0
      ? record
      : undefined;
  }

  private shouldSaveContact(id1: number, id2: number): boolean {
    const filter = this.filterBodies;
    if (filter === null) return true;
    const u32 = this.jolt.HEAPU32;
    const first = this.recordOfEngineId(u32[id1 >>> 2] as number);
    const second = this.recordOfEngineId(u32[id2 >>> 2] as number);
    return (
      (first !== undefined && filter.has(first)) || (second !== undefined && filter.has(second))
    );
  }

  /** True when a query hit a round rolling surface of `record`, which is not part of its solid. */
  private hitIsRound(record: BodyRecord, result: number): boolean {
    if (!record.hasRound) return false;
    const id = this.jolt.HEAPU32[(result + this.layout.hitSubShape2) >>> 2] as number;
    return record.topRound[id & record.built.subShapeMask] != null;
  }

  private onCollideHit(result: number): void {
    const hit = this.jolt.wrapPointer(result, this.jolt.CollideShapeResult);
    const depth = hit.mPenetrationDepth / this.scale;
    if (!(depth > 0)) return;
    const record = this.recordOfEngineId(hit.mBodyID2.GetIndexAndSequenceNumber());
    if (record === undefined) return;
    if (this.hitIsRound(record, result)) return;
    const previous = this.queryHits.get(record);
    if (previous === undefined || depth > previous.depth) {
      this.queryHits.set(record, { depth, leaf: this.hitLeaf(record, result) });
    }
  }

  /** The leaf of `record` that a query hit (a result begins with the fields of a collision). */
  private hitLeaf(record: BodyRecord, result: number): number {
    const id = this.jolt.HEAPU32[(result + this.layout.hitSubShape2) >>> 2] as number;
    return leafOfSubShape(record.built, id);
  }

  private onCastHit(result: number): void {
    const hit = this.jolt.wrapPointer(result, this.jolt.ShapeCastResult);
    const fraction = hit.mFraction;
    const record = this.recordOfEngineId(hit.mBodyID2.GetIndexAndSequenceNumber());
    if (record === undefined) return;
    // A cast result starts with the fields of a collision result, sub-shape ids included.
    if (this.hitIsRound(record, result)) return;
    const best = this.castBest;
    // Equal fractions are resolved by id, so the answer does not depend on the order in which
    // the broad phase happens to visit the bodies.
    if (
      best === null ||
      fraction < best.fraction ||
      (fraction === best.fraction && compareIds(record.id, best.record.id) < 0)
    ) {
      this.castBest = { fraction, record, leaf: this.hitLeaf(record, result) };
      // Keep looking for hits that are not later than this one (the engine skips hits at or
      // beyond the early-out fraction, so leave room for an exact tie).
      const limit = fraction + 1e-6;
      if (limit < this.castCollector.GetEarlyOutFraction()) {
        this.castCollector.UpdateEarlyOutFraction(limit);
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // Bookkeeping
  // ------------------------------------------------------------------------------------------

  private assertUsable(): void {
    if (this.disposed) throw new Error('physics: the world has been disposed');
    if (this.stepping) throw new Error('physics: the world cannot be used from inside a step');
  }

  private record(id: string): BodyRecord {
    const found = this.records.get(id);
    if (found === undefined || this.pendingRemoves.has(found)) {
      throw new Error(`physics: unknown body '${id}'`);
    }
    return found;
  }

  private engineBody(record: BodyRecord): JoltBody {
    if (record.body === null) throw new Error(`physics: body '${record.id}' is not in the engine`);
    return record.body;
  }

  private pairKey(first: BodyRecord, second: BodyRecord): number {
    return first.handle * MAX_HANDLE + second.handle;
  }

  /** A vector exactly as the engine holds it (lengths in engine units). */
  private readVec(value: JoltVec3): Vec3 {
    return [value.GetX(), value.GetY(), value.GetZ()];
  }

  /** A length-like engine vector (position, velocity) in SI. */
  private readLength(value: JoltVec3): Vec3 {
    const u = this.scale;
    return [value.GetX() / u, value.GetY() / u, value.GetZ() / u];
  }

  /** Position of a body's centre of mass exactly as the engine holds it (engine units). */
  private comPosition(body: JoltBody): Vec3 {
    const p = body.GetCenterOfMassPosition();
    return [p.GetX(), p.GetY(), p.GetZ()];
  }

  /** Position of a body's centre of mass in the tub frame, metres. */
  private comPositionSI(body: JoltBody): Vec3 {
    const u = this.scale;
    const p = body.GetCenterOfMassPosition();
    return [p.GetX() / u, p.GetY() / u, p.GetZ() / u];
  }

  /** Loads a position (metres) and an orientation into the scratch arguments for the engine. */
  private setPoseArguments(p: Vec3, q: Quat): void {
    const u = this.scale;
    this.rvec.Set(p[0] * u, p[1] * u, p[2] * u);
    this.quat.Set(q[0], q[1], q[2], q[3]);
  }

  private rotation(body: JoltBody): Quat {
    const q = body.GetRotation();
    return [q.GetX(), q.GetY(), q.GetZ(), q.GetW()];
  }

  /**
   * Wakes every sleeping dynamic body whose bounds come within the contact margin of `body`'s.
   * The bodies are woken in id order, not in the order a broad-phase query would find them in:
   * the engine processes awake bodies in the order they woke, and the broad phase's order
   * depends on the history of the world, which a snapshot does not carry.
   */
  private wakeAround(body: JoltBody): void {
    const bounds = body.GetWorldSpaceBounds();
    const margin = 2 * this.settings.speculativeContactDistance * this.scale;
    const lo = this.readVec(bounds.mMin);
    const hi = this.readVec(bounds.mMax);
    for (const record of this.ranked) {
      if (record.kind !== 'dynamic' || record.active || record.body === null) continue;
      const own = this.boundsOf(record);
      if (
        (own[0] as number) <= hi[0] + margin &&
        (own[3] as number) >= lo[0] - margin &&
        (own[1] as number) <= hi[1] + margin &&
        (own[4] as number) >= lo[1] - margin &&
        (own[2] as number) <= hi[2] + margin &&
        (own[5] as number) >= lo[2] - margin
      ) {
        this.bodyInterface.ActivateBody(record.body.GetID());
      }
    }
  }

  /** Gives a dynamic body the sweeping (LinearCast) or the plain motion quality. */
  private setCasting(record: BodyRecord, casting: boolean): void {
    if (record.kind !== 'dynamic' || record.body === null) return;
    const jolt = this.jolt;
    this.bodyInterface.SetMotionQuality(
      record.body.GetID(),
      casting ? jolt.EMotionQuality_LinearCast : jolt.EMotionQuality_Discrete,
    );
    record.casting = casting;
  }

  /** World-space bounds of a body as the engine holds them: minimum and maximum, engine units. */
  private boundsOf(record: BodyRecord): [number, number, number, number, number, number] {
    const f32 = this.jolt.HEAPF32;
    const at = (record.pointer + BODY_LAYOUT.bounds) >>> 2;
    return [
      f32[at] as number,
      f32[at + 1] as number,
      f32[at + 2] as number,
      f32[at + 4] as number,
      f32[at + 5] as number,
      f32[at + 6] as number,
    ];
  }

  /** Drops the body's reference on its shape (and the wrapper of a shape of its own). */
  private releaseBodyShape(record: BodyRecord): void {
    record.shape.Release();
    if (record.shape !== record.built.shape) {
      forgetJoltWrapper(this.jolt, this.jolt.OffsetCenterOfMassShape, record.shape);
    }
  }

  private dropBookEntriesOf(record: BodyRecord): void {
    for (const [key, pair] of this.book) {
      if (pair.first === record || pair.second === record) this.book.delete(key);
    }
  }

  /** Reads the engine's contact cache, optionally only the pairs involving `only`. */
  private readEngineContacts(only: Set<BodyRecord> | null): PairContacts[] {
    this.filterBodies = only;
    let bytes: Uint8Array;
    try {
      bytes = this.recorder.capture((recorder) =>
        this.system.SaveState(recorder, STATE_CONTACTS, this.saveFilter),
      );
    } finally {
      this.filterBodies = null;
    }
    const pairs = new Map<number, PairContacts>();
    for (const manifold of parseContactState(bytes) as SavedManifold[]) {
      const first = this.recordOfEngineId(manifold.body1);
      const second = this.recordOfEngineId(manifold.body2);
      if (first === undefined || second === undefined) continue;
      const key = this.pairKey(first, second);
      let pair = pairs.get(key);
      if (pair === undefined) {
        pair = { first, second, manifolds: [] };
        pairs.set(key, pair);
      }
      pair.manifolds.push({
        leaf1: leafOfSubShape(first.built, manifold.subShape1),
        leaf2: leafOfSubShape(second.built, manifold.subShape2),
        normal: manifold.normal,
        points: manifold.points,
      });
    }
    return [...pairs.values()];
  }

  /** Moves everything the engine's contact cache holds into the book, then empties the cache. */
  private retireEngineContacts(): void {
    for (const pair of this.readEngineContacts(null)) {
      this.book.set(this.pairKey(pair.first, pair.second), pair);
    }
    const empty = emptyContactState();
    const exact = this.recorder.replay(empty, (recorder) => this.system.RestoreState(recorder));
    if (!exact) throw new Error('physics: the engine did not accept an empty contact cache');
    this.liveContacts = null;
  }

  /**
   * Applies queued additions and removals so that the engine holds exactly the bodies of the
   * world, with engine ids equal to their ranks in id order.
   */
  private flush(): void {
    // Dead wrapper objects of the bindings pile up with every body destroyed and every shape
    // freed; they are swept out once enough of either has happened.
    if (this.destroyed + this.shapes.freed - this.sweptAt >= WRAPPER_SWEEP_EVERY) {
      trimJoltWrappers(this.jolt);
      this.sweptAt = this.destroyed + this.shapes.freed;
    }
    if (this.pendingAdds.size === 0 && this.pendingRemoves.size === 0) return;
    const jolt = this.jolt;
    const bi = this.bodyInterface;

    const next: BodyRecord[] = [];
    for (const record of this.ranked) if (!this.pendingRemoves.has(record)) next.push(record);
    for (const record of this.pendingAdds) next.push(record);
    next.sort((a, b) => compareIds(a.id, b.id));

    let renumbered = false;
    for (let rank = 0; rank < next.length && !renumbered; rank++) {
      const record = next[rank] as BodyRecord;
      renumbered = record.body !== null && record.rank !== rank;
    }

    // The contact cache is keyed by engine ids. Anything that frees or changes an id makes its
    // entries wrong, so what the cache knows is moved to the book and the cache emptied. The
    // cost is one step without warm starting for bodies that are awake at this moment.
    if (this.pendingRemoves.size > 0 || renumbered) this.retireEngineContacts();

    for (const record of [...this.pendingRemoves].sort((a, b) => compareIds(a.id, b.id))) {
      const body = this.engineBody(record);
      this.wakeAround(body);
      bi.RemoveBody(body.GetID());
      bi.DestroyBody(body.GetID());
      forgetJoltWrapper(jolt, jolt.Body, body);
      this.destroyed++;
      this.byPointer.delete(record.pointer);
      this.byHandle.delete(record.handle);
      this.records.delete(record.id);
      this.activeBodies.delete(record);
      this.kinematicTargets.delete(record);
      this.dropBookEntriesOf(record);
      record.body = null;
      record.rank = -1;
      this.releaseBodyShape(record);
      this.shapes.release(record.pieces);
    }

    // Take every body whose rank changed out of the engine before any is put back, so that no
    // two bodies ever claim the same id. Their state is read only now, after the removals above
    // have woken what they had to wake.
    const moved: { record: BodyRecord; awake: boolean; linear: Vec3; angular: Vec3 }[] = [];
    for (let rank = 0; rank < next.length; rank++) {
      const record = next[rank] as BodyRecord;
      if (record.body !== null && record.rank !== rank) {
        moved.push({
          record,
          awake: record.active,
          linear: this.readVec(record.body.GetLinearVelocity()),
          angular: this.readVec(record.body.GetAngularVelocity()),
        });
      }
    }
    for (const { record } of moved) {
      const body = this.engineBody(record);
      bi.RemoveBody(body.GetID());
      bi.UnassignBodyID(body.GetID());
    }
    this.ranked = next;
    const movedState = new Map(moved.map((m) => [m.record, m]));
    for (let rank = 0; rank < next.length; rank++) {
      const record = next[rank] as BodyRecord;
      const state = movedState.get(record);
      if (state !== undefined) {
        const body = this.engineBody(record);
        const engineId = new jolt.BodyID((rank | BODY_SEQUENCE) >>> 0);
        const assigned = bi.AssignBodyID(body, engineId);
        if (!assigned) {
          jolt.destroy(engineId);
          throw new Error(`physics: the engine refused a new id for body '${record.id}'`);
        }
        record.rank = rank;
        bi.AddBody(
          engineId,
          state.awake ? jolt.EActivation_Activate : jolt.EActivation_DontActivate,
        );
        if (state.awake) {
          // Taking a body out of the engine zeroes its velocities.
          this.vec.Set(state.linear[0], state.linear[1], state.linear[2]);
          this.vec2.Set(state.angular[0], state.angular[1], state.angular[2]);
          bi.SetLinearAndAngularVelocity(engineId, this.vec, this.vec2);
        }
        jolt.destroy(engineId);
        this.setActive(record, body.IsActive());
      } else if (record.body === null) {
        this.createEngineBody(record, rank);
      }
    }
    this.pendingAdds.clear();
    this.pendingRemoves.clear();
    this.liveContacts = null;
    this.disturbed = true;
  }

  // ------------------------------------------------------------------------------------------
  // Bodies
  // ------------------------------------------------------------------------------------------

  addBody(
    id: string,
    pieces: readonly CollisionPiece[],
    mass: MassProperties,
    surface: ContactMaterial,
    pose: Pose,
    kind: BodyKind,
  ): void {
    this.assertUsable();
    if (!isUsableId(id)) throw new Error('physics: a body id must be a non-empty string');
    if (kind !== 'dynamic' && kind !== 'static' && kind !== 'kinematic') {
      throw new Error(`physics: unknown body kind '${String(kind)}'`);
    }
    const existing = this.records.get(id);
    if (existing !== undefined && !this.pendingRemoves.has(existing)) {
      throw new Error(`physics: duplicate body id '${id}'`);
    }
    if (existing !== undefined) {
      // Removed and added again before anything else happened: finish the removal first.
      this.flush();
    }
    if (this.records.size >= this.settings.maxBodies) {
      throw new Error(`physics: the world is limited to ${this.settings.maxBodies} bodies`);
    }
    const checkedPose = checkPose(pose, `the pose of body '${id}'`);
    let inertia: Mat3 | null = null;
    if (kind === 'dynamic') {
      if (!(mass.mass > 0) || !Number.isFinite(mass.mass)) {
        throw new Error(`physics: body '${id}' needs a mass above zero`);
      }
      if (!v3IsFinite(mass.com)) {
        throw new Error(`physics: body '${id}' has a centre of mass that is not finite`);
      }
      inertia = conditionInertia(mass.inertia, this.settings.minPrincipalInertiaRatio);
    }
    if (this.nextHandle >= MAX_HANDLE) throw new Error('physics: too many bodies were ever added');

    const defaultMaterial = this.internMaterial(surface.material);
    const built = this.shapes.acquire(pieces);
    let shape: JoltShape;
    let shapeCom: Vec3;
    try {
      const leafPart: string[] = [];
      const leafMaterial = new Uint16Array(built.leafPiece.length);
      const leafRound: (RoundLeaf | null)[] = [];
      for (let leaf = 0; leaf < built.leafPiece.length; leaf++) {
        const piece = pieces[built.leafPiece[leaf] as number] as CollisionPiece;
        leafPart.push(piece.part);
        leafMaterial[leaf] =
          piece.material === undefined ? defaultMaterial : this.internMaterial(piece.material);
        const round = built.leafRound[leaf];
        leafRound.push(
          round == null
            ? null
            : {
                axis: round.axis,
                normalAlongAxis: round.normalAlongAxis,
                maxDepth:
                  Math.min(this.settings.roundSurfaceMaxDepth, 0.6 * round.wallThickness) *
                  this.scale,
              },
        );
      }
      if (kind === 'dynamic') {
        // The engine places the centre of mass where the uniform-density proxy has it; move it
        // to where the caller says it is. The mass and inertia themselves are overridden when
        // the body is created.
        const offset = v3Sub(mass.com, built.joltCom);
        const u = this.scale;
        this.vec.Set(offset[0] * u, offset[1] * u, offset[2] * u);
        const wrapped = new this.jolt.OffsetCenterOfMassShape(built.shape, this.vec);
        wrapped.AddRef();
        shape = wrapped;
        const com = wrapped.GetCenterOfMass();
        shapeCom = [com.GetX() / u, com.GetY() / u, com.GetZ() / u];
      } else {
        built.shape.AddRef();
        shape = built.shape;
        shapeCom = built.joltCom;
      }
      const record: BodyRecord = {
        id,
        kind,
        handle: this.nextHandle++,
        pieces,
        built,
        shape,
        shapeCom,
        leafPart,
        leafMaterial,
        mass: kind === 'dynamic' ? mass.mass : 0,
        inertia,
        initialPose: checkedPose,
        body: null,
        pointer: 0,
        rank: -1,
        active: false,
        touchedStep: -1,
        restSteps: 0,
        settleSteps: 0,
        shaken: false,
        shaking: false,
        contactsStale: false,
        leafRound,
        topRound: built.topRound.map((round, top) =>
          round === null ? null : (leafRound[built.topFirstLeaf[top] as number] ?? null),
        ),
        hasRound: leafRound.some((round) => round !== null),
        topBall: this.ballsAbout(built.topSphere, shapeCom),
        leafBall: this.ballsAbout(built.leafSphere, shapeCom),
        leafRod: this.rodsAbout(built.leafCapsule, shapeCom),
        joined: built.leafJoined.some((ends) => ends !== 0) ? built.leafJoined : null,
        leafFaces: built.leafFaces.map((faces) => {
          if (faces === null) return null;
          const out = new Float64Array(faces.length);
          for (let k = 0; k < faces.length; k += 4) {
            const nx = faces[k] as number;
            const ny = faces[k + 1] as number;
            const nz = faces[k + 2] as number;
            out[k] = nx;
            out[k + 1] = ny;
            out[k + 2] = nz;
            out[k + 3] =
              ((faces[k + 3] as number) -
                (nx * shapeCom[0] + ny * shapeCom[1] + nz * shapeCom[2])) *
              this.scale;
          }
          return out;
        }),
        matrix: new Float64Array(13).fill(Number.NaN),
        reach: (built.boundingRadius + v3Length(v3Sub(shapeCom, built.joltCom))) * this.scale,
        velocityAt: 0,
        casting: false,
        preVx: 0,
        preVy: 0,
        preVz: 0,
        preWx: 0,
        preWy: 0,
        preWz: 0,
        preCx: 0,
        preCy: 0,
        preCz: 0,
        // Replaced by the record itself as soon as it exists (see below).
        group: undefined as unknown as BodyRecord,
        support: new Float64Array(SUPPORT_SIZE),
        hold: new Float64Array(6),
        holding: false,
        onRound: false,
        roundSeen: false,
        neighbourSeen: false,
        gain: new Float64Array(6),
        knock: 0,
        knockTurn: 0,
        mean: new Float64Array(6),
      };
      record.group = record;
      this.records.set(id, record);
      this.byHandle.set(record.handle, record);
      this.pendingAdds.add(record);
    } catch (error) {
      this.shapes.release(pieces);
      throw error;
    }
  }

  /** Spheres given in the item frame (metres) as the engine sees them: about `com`, in its units. */
  private ballsAbout(spheres: Float64Array, com: Vec3): Float64Array {
    const u = this.scale;
    const out = new Float64Array(spheres.length);
    for (let i = 0; i < spheres.length; i += 4) {
      out[i] = ((spheres[i] as number) - com[0]) * u;
      out[i + 1] = ((spheres[i + 1] as number) - com[1]) * u;
      out[i + 2] = ((spheres[i + 2] as number) - com[2]) * u;
      out[i + 3] = (spheres[i + 3] as number) * u;
    }
    return out;
  }

  /** Capsules given in the item frame (metres) as the engine sees them: about `com`, in its units. */
  private rodsAbout(capsules: Float64Array, com: Vec3): Float64Array {
    const u = this.scale;
    const out = new Float64Array(capsules.length);
    for (let i = 0; i < capsules.length; i += 7) {
      for (let k = 0; k < 6; k++) {
        out[i + k] = ((capsules[i + k] as number) - (com[k % 3] as number)) * u;
      }
      out[i + 6] = (capsules[i + 6] as number) * u;
    }
    return out;
  }

  removeBody(id: string): void {
    this.assertUsable();
    const record = this.record(id);
    if (this.pendingAdds.has(record)) {
      // Never reached the engine: forget it.
      this.pendingAdds.delete(record);
      this.records.delete(id);
      this.byHandle.delete(record.handle);
      this.releaseBodyShape(record);
      this.shapes.release(record.pieces);
      return;
    }
    this.pendingRemoves.add(record);
  }

  bodyIds(): string[] {
    this.assertUsable();
    const ids: string[] = [];
    for (const [id, record] of this.records) if (!this.pendingRemoves.has(record)) ids.push(id);
    return ids.sort(compareIds);
  }

  getKind(id: string): BodyKind {
    this.assertUsable();
    return this.record(id).kind;
  }

  isActive(id: string): boolean {
    this.assertUsable();
    const record = this.record(id);
    this.flush();
    return record.active;
  }

  private poseOf(record: BodyRecord): Pose {
    const body = this.engineBody(record);
    const q = this.rotation(body);
    const com = this.comPositionSI(body);
    return { p: v3Sub(com, quatRotate(q, record.shapeCom)), q };
  }

  getPose(id: string): Pose {
    this.assertUsable();
    const record = this.record(id);
    this.flush();
    return this.poseOf(record);
  }

  getVelocity(id: string): { readonly linear: Vec3; readonly angular: Vec3 } {
    this.assertUsable();
    const record = this.record(id);
    this.flush();
    const body = this.engineBody(record);
    return {
      linear: this.readLength(body.GetLinearVelocity()),
      angular: this.readVec(body.GetAngularVelocity()),
    };
  }

  private teleportRecord(record: BodyRecord, pose: Pose): void {
    const jolt = this.jolt;
    const body = this.engineBody(record);
    // Whatever was resting on the body at its old pose must find out that it has gone.
    this.wakeAround(body);
    this.setPoseArguments(pose.p, pose.q);
    this.bodyInterface.SetPositionAndRotation(
      body.GetID(),
      this.rvec,
      this.quat,
      record.kind === 'dynamic' ? jolt.EActivation_Activate : jolt.EActivation_DontActivate,
    );
    if (record.kind !== 'static') {
      this.vec.Set(0, 0, 0);
      this.vec2.Set(0, 0, 0);
      this.bodyInterface.SetLinearAndAngularVelocity(body.GetID(), this.vec, this.vec2);
      this.bodyInterface.InvalidateContactCache(body.GetID());
    }
    // A body that cannot wake its neighbours by itself wakes them here.
    if (record.kind !== 'dynamic') this.wakeAround(body);
    this.kinematicTargets.delete(record);
    this.dropBookEntriesOf(record);
    record.contactsStale = true;
    record.restSteps = 0;
    this.dropHold(record);
    this.setActive(record, body.IsActive());
    this.liveContacts = null;
    this.disturbed = true;
  }

  setPose(id: string, pose: Pose): void {
    this.assertUsable();
    const record = this.record(id);
    const checked = checkPose(pose, `the pose given to body '${id}'`);
    this.flush();
    if (record.kind === 'kinematic') {
      this.kinematicTargets.set(record, checked);
      return;
    }
    this.teleportRecord(record, checked);
  }

  teleport(id: string, pose: Pose): void {
    this.assertUsable();
    const record = this.record(id);
    const checked = checkPose(pose, `the pose given to body '${id}'`);
    this.flush();
    this.teleportRecord(record, checked);
  }

  setVelocity(id: string, linear: Vec3, angular: Vec3): void {
    this.assertUsable();
    const record = this.record(id);
    if (record.kind !== 'dynamic') {
      throw new Error(`physics: only a dynamic body can be given a velocity, '${id}' is not`);
    }
    if (!v3IsFinite(linear) || !v3IsFinite(angular)) {
      throw new Error('physics: a velocity must be finite');
    }
    this.flush();
    const body = this.engineBody(record);
    this.bodyInterface.ActivateBody(body.GetID());
    const u = this.scale;
    this.vec.Set(linear[0] * u, linear[1] * u, linear[2] * u);
    this.vec2.Set(angular[0], angular[1], angular[2]);
    this.bodyInterface.SetLinearAndAngularVelocity(body.GetID(), this.vec, this.vec2);
    record.restSteps = 0;
    this.dropHold(record);
    this.disturbed = true;
  }

  applyImpulse(id: string, impulse: Vec3, at?: Vec3): void {
    this.assertUsable();
    const record = this.record(id);
    if (record.kind !== 'dynamic') {
      throw new Error(`physics: only a dynamic body can take an impulse, '${id}' is not`);
    }
    if (!v3IsFinite(impulse) || (at !== undefined && !v3IsFinite(at))) {
      throw new Error('physics: an impulse and its point of application must be finite');
    }
    this.flush();
    const body = this.engineBody(record);
    this.bodyInterface.ActivateBody(body.GetID());
    // N s = kg m/s to kg unit/s.
    const u = this.scale;
    this.vec.Set(impulse[0] * u, impulse[1] * u, impulse[2] * u);
    if (at === undefined) {
      this.bodyInterface.AddImpulse(body.GetID(), this.vec);
    } else {
      this.rvec.Set(at[0] * u, at[1] * u, at[2] * u);
      this.bodyInterface.AddImpulse(body.GetID(), this.vec, this.rvec);
    }
    record.restSteps = 0;
    this.disturbed = true;
  }

  // ------------------------------------------------------------------------------------------
  // Stepping
  // ------------------------------------------------------------------------------------------

  /**
   * Decides which dynamic bodies are swept in the coming step and returns those that are not
   * because a driven kinematic body is, or will be, on top of them. The engine sweeps a fast
   * body from where it was before the step against the other bodies where they are after it,
   * and takes a kinematic body to be standing still there (Jolt 5.6, PhysicsSystem.cpp,
   * sCalculateBodyMotion). For what a driven kinematic body carries, that is wrong by the
   * carrier's whole displacement in the step: measured with twelve plates on a rack at a
   * steady 0.5 m/s, plates up to 42 mm and 21 degrees from their places before the rack even
   * stops, against 0.09 mm with the sweep off. So a body whose bounds overlap what a driven
   * body sweeps through in this step (plus the contact margin), or the bounds of a body that
   * does, is not swept in it; the speculative contact distance still covers 1.2 m/s there.
   * Every other body keeps its sweep.
   */
  private scopeCasting(driven: readonly { record: BodyRecord; target: Pose }[]): Set<BodyRecord> {
    const near = new Set<BodyRecord>();
    if (driven.length > 0) {
      const margin = 2 * this.settings.speculativeContactDistance * this.scale;
      const boxes: [number, number, number, number, number, number][] = [];
      for (const { record, target } of driven) {
        // The bounds now, and the same bounds carried to the target; a turn is covered by the
        // distance the farthest point of the body can travel.
        const box = this.boundsOf(record);
        const from = this.poseOf(record);
        const turn = quatAngleBetween(from.q, target.q) * record.reach;
        for (let i = 0; i < 3; i++) {
          const shift = ((target.p[i] as number) - (from.p[i] as number)) * this.scale;
          box[i] = (box[i] as number) + Math.min(0, shift) - turn - margin;
          box[i + 3] = (box[i + 3] as number) + Math.max(0, shift) + turn + margin;
        }
        boxes.push(box);
      }
      // What rides on a rider is carried just the same: a bowl nested in a bowl on the rack.
      // So the set grows by whatever overlaps a body already in it, until nothing is added.
      const far: { record: BodyRecord; box: number[] }[] = [];
      for (const record of this.ranked) {
        if (record.kind === 'dynamic') far.push({ record, box: this.boundsOf(record) });
      }
      const overlaps = (a: readonly number[], b: readonly number[], slack: number): boolean =>
        (a[0] as number) <= (b[3] as number) + slack &&
        (a[3] as number) >= (b[0] as number) - slack &&
        (a[1] as number) <= (b[4] as number) + slack &&
        (a[4] as number) >= (b[1] as number) - slack &&
        (a[2] as number) <= (b[5] as number) + slack &&
        (a[5] as number) >= (b[2] as number) - slack;
      let frontier: number[][] = boxes;
      let slack = 0; // the boxes of the driven bodies already include the margin
      while (frontier.length > 0 && far.length > 0) {
        const reached: number[][] = [];
        for (let i = far.length - 1; i >= 0; i--) {
          const candidate = far[i] as { record: BodyRecord; box: number[] };
          if (!frontier.some((box) => overlaps(candidate.box, box, slack))) continue;
          near.add(candidate.record);
          reached.push(candidate.box);
          far.splice(i, 1);
        }
        frontier = reached;
        slack = margin;
      }
    }
    if (this.settings.linearCast) {
      for (const record of this.ranked) {
        if (record.kind !== 'dynamic') continue;
        const casting = !near.has(record);
        if (casting !== record.casting) this.setCasting(record, casting);
      }
    }
    return near;
  }

  /**
   * Gives the engine the speculative contact distance of the coming step: the largest gap any
   * two pieces of the world could close in it, never more than
   * `JoltWorldSettings.speculativeContactDistance` nor less than the resting margin.
   *
   * The engine looks for contacts between every two pieces whose boxes, grown by this distance,
   * overlap, and `acceptsHit` then turns down every candidate whose gap the two pieces cannot
   * close within the step. With the distance fixed at its 5 mm the engine tested (and called
   * back for) every piece within 5 mm of another in every step, although a load that is
   * settling moves a few tenths of a millimetre per step. No point of a body moves faster than
   * its linear speed plus its angular speed times its reach, so the sum of the two largest of
   * those, plus what gravity adds in the step, bounds the closing speed of every pair, and the
   * rule of `acceptsHit` would turn down anything beyond the distance set here. What the
   * simulation does is therefore unchanged; it is only spared the tests.
   */
  private scopeSpeculativeDistance(): void {
    let first = 0;
    let second = 0;
    // The velocity of the fastest body that is being driven (none: zero).
    let drivenSpeed = 0;
    let drivenX = 0;
    let drivenY = 0;
    let drivenZ = 0;
    for (const record of this.ranked) {
      if (record.kind !== 'kinematic') continue;
      const linear = Math.hypot(record.preVx, record.preVy, record.preVz);
      if (linear > drivenSpeed) {
        drivenSpeed = linear;
        drivenX = record.preVx;
        drivenY = record.preVy;
        drivenZ = record.preVz;
      }
    }
    // The fastest point of a free body, against what stands or against what is driven.
    let free = 0;
    for (const record of this.ranked) {
      const linear = Math.hypot(record.preVx, record.preVy, record.preVz);
      const angular = Math.hypot(record.preWx, record.preWy, record.preWz);
      if (linear === 0 && angular === 0) continue;
      // A point at the contact margin of the body is that much further from its centre.
      const turning = angular * (record.reach + this.speculativeMargin);
      const speed = linear + turning;
      if (speed > first) {
        second = first;
        first = speed;
      } else if (speed > second) {
        second = speed;
      }
      if (record.kind === 'dynamic') {
        const riding = Math.hypot(
          record.preVx - drivenX,
          record.preVy - drivenY,
          record.preVz - drivenZ,
        );
        free = Math.max(free, Math.min(linear, riding) + turning);
      }
    }
    this.calmNow = free <= ROUND_CALM_SPEED * this.scale;
    const closing = first + second + this.gravityStep;
    // A hundredth more than the rule of `acceptsHit` allows, so that rounding cannot make the
    // engine stricter than the rule.
    const wanted = Math.min(
      this.speculativeMargin,
      1.01 *
        Math.max(
          this.restingMargin,
          this.settings.speculativeSpeedFactor * closing * this.timeStep,
        ),
    );
    if (wanted === this.speculativeNow) return;
    const p = this.system.GetPhysicsSettings();
    p.mSpeculativeContactDistance = wanted;
    this.system.SetPhysicsSettings(p);
    this.speculativeNow = wanted;
  }

  /**
   * Puts to sleep every group of dynamic bodies connected by this step's contacts in which
   * every body has met the world's rest criterion for the hold time, and every kinematic body
   * that is not being driven. Returns the dynamic bodies put to sleep.
   */
  private sleepGroupsAtRest(
    near: ReadonlySet<BodyRecord>,
    driven: ReadonlySet<BodyRecord>,
  ): BodyRecord[] {
    const bi = this.bodyInterface;
    const slept: BodyRecord[] = [];
    // In rank order, so that the engine sees the same sequence whatever the history.
    const active = [...this.activeBodies].sort((a, b) => a.rank - b.rank);
    for (const record of active) {
      if (record.kind === 'kinematic' && !driven.has(record)) {
        bi.DeactivateBody(this.engineBody(record).GetID());
        this.setActive(record, false);
      }
    }
    if (!this.settings.allowSleeping || this.sleepSuspended) return slept;
    const awake = new Set<BodyRecord>();
    for (const record of active) {
      if (record.kind !== 'dynamic') continue;
      let root = record;
      while (root.group !== root) root = root.group;
      // Carried by a driven body, still moving, or not yet disturbed by the settle that is
      // under way: the whole group stays awake.
      if (
        record.restSteps < this.restHoldSteps ||
        near.has(record) ||
        (this.sleepAfterShake && !record.shaken)
      ) {
        awake.add(root);
      }
    }
    for (const record of active) {
      if (record.kind !== 'dynamic') continue;
      let root = record;
      while (root.group !== root) root = root.group;
      if (awake.has(root)) continue;
      bi.DeactivateBody(this.engineBody(record).GetID());
      this.setActive(record, false);
      slept.push(record);
    }
    return slept;
  }

  /**
   * Rolling and spin resistance (docs/research/items.md section 3.6) for one awake body with
   * supporting contacts in the step just taken: a moment `c_rr * N` against the part of its
   * angular velocity that is tangent to the support, and `c_sp * N` against the part about the
   * support normal, with the body's weight for `N` and the mean of the lengths of the pairs in
   * contact. Each acts as a rotation about the mean supporting point, so that a body that
   * rolls without slipping still does afterwards, and is capped so that it can stop the
   * rotation but never reverse it.
   *
   * The rolling part is static friction too: where the moment of the weight about the
   * supporting point is no larger than `c_rr * N`, it opposes the rotation the body has plus
   * the rotation that moment will give it in the next step. Such a body is left with exactly
   * the velocity that gravity cancels in the next step, and does not move at all (taking the
   * rotation away only after it has happened would let it creep by one step's worth of
   * gravity in every step).
   */
  private resist(record: BodyRecord): void {
    const inertia = record.inertia;
    if (inertia === null || record.velocityAt === 0) return;
    const f32 = this.jolt.HEAPF32;
    const u = this.scale;
    const dt = this.timeStep;
    const sums = record.support;
    const count = sums[SUPPORT_COUNT] as number;
    const v = record.velocityAt >>> 2;
    const w = v + ((BODY_LAYOUT.angularVelocity - BODY_LAYOUT.linearVelocity) >>> 2);
    const wx = f32[w] as number;
    const wy = f32[w + 1] as number;
    const wz = f32[w + 2] as number;
    let nx = sums[SUPPORT_NORMAL] as number;
    let ny = sums[SUPPORT_NORMAL + 1] as number;
    let nz = sums[SUPPORT_NORMAL + 2] as number;
    const nLength = Math.sqrt(nx * nx + ny * ny + nz * nz);
    // Supports that cancel (a body clamped between two others) define no direction.
    if (!(nLength > 1e-3 * SUPPORT_QUANTA * count)) return;
    nx /= nLength;
    ny /= nLength;
    nz /= nLength;
    const at = record.pointer >>> 2;
    const o = at + (BODY_LAYOUT.rotation >>> 2);
    const inverse: Quat = [
      -(f32[o] as number),
      -(f32[o + 1] as number),
      -(f32[o + 2] as number),
      f32[o + 3] as number,
    ];
    // From the mean supporting point to the centre of mass, metres.
    const quanta = SUPPORT_QUANTA * count;
    const rx = ((f32[at] as number) - (sums[SUPPORT_POSITION] as number) / quanta) / u;
    const ry = ((f32[at + 1] as number) - (sums[SUPPORT_POSITION + 1] as number) / quanta) / u;
    const rz = ((f32[at + 2] as number) - (sums[SUPPORT_POSITION + 2] as number) / quanta) / u;
    const r2 = rx * rx + ry * ry + rz * rz;
    /** Moment of inertia about the unit axis `(ax, ay, az)` through the supporting point. */
    const about = (ax: number, ay: number, az: number): number => {
      const local = quatRotate(inverse, [ax, ay, az]);
      const own =
        local[0] * (inertia[0] * local[0] + inertia[1] * local[1] + inertia[2] * local[2]) +
        local[1] * (inertia[3] * local[0] + inertia[4] * local[1] + inertia[5] * local[2]) +
        local[2] * (inertia[6] * local[0] + inertia[7] * local[1] + inertia[8] * local[2]);
      const along = rx * ax + ry * ay + rz * az;
      return own + record.mass * (r2 - along * along);
    };
    const weight = record.mass * this.gravityNorm; // N, newtons
    let dwx = 0;
    let dwy = 0;
    let dwz = 0;

    // Rolling: the tangential part of the angular velocity, with what the moment of the weight
    // about the supporting point, r x m g, will add to it in the next step where the
    // resistance can hold that moment.
    const rolling = (sums[SUPPORT_ROLLING] as number) / (LENGTH_QUANTA * count);
    const spinNow = wx * nx + wy * ny + wz * nz;
    if (rolling > 0) {
      const ox = wx - spinNow * nx;
      const oy = wy - spinNow * ny;
      const oz = wz - spinNow * nz;
      const g = this.gravityNow;
      let tx = (ry * g[2] - rz * g[1]) * record.mass;
      let ty = (rz * g[0] - rx * g[2]) * record.mass;
      let tz = (rx * g[1] - ry * g[0]) * record.mass;
      const torqueSpin = tx * nx + ty * ny + tz * nz;
      tx -= torqueSpin * nx;
      ty -= torqueSpin * ny;
      tz -= torqueSpin * nz;
      const held = rolling * weight;
      let holdX = 0;
      let holdY = 0;
      let holdZ = 0;
      /**
       * Resists the rotation about the unit axis `a`: `own` is the angular velocity the body
       * has about it, `moment` that of the weight, and `free` whether the body is free to roll
       * about it (only then is the moment anticipated, and only where the rolling resistance
       * can hold it). What is taken
       * from the rotation the body has is taken now; the rest, which answers the rotation
       * gravity is about to give it, at the start of the next step, so that the velocity of a
       * body held at rest is zero between steps.
       */
      const about1 = (
        ax: number,
        ay: number,
        az: number,
        own: number,
        moment: number,
        free: boolean,
      ): void => {
        const inertiaAbout = about(ax, ay, az);
        const cap = (held * dt) / inertiaAbout;
        const coming =
          free && moment !== 0 && Math.abs(moment) <= held ? (moment * dt) / inertiaAbout : 0;
        const total = own + coming;
        const drop = Math.sign(total) * Math.min(Math.abs(total), cap);
        const now = Math.sign(own) * Math.min(Math.abs(own), cap);
        dwx -= now * ax;
        dwy -= now * ay;
        dwz -= now * az;
        const later = drop - now;
        holdX -= later * ax;
        holdY -= later * ay;
        holdZ -= later * az;
      };
      // What the supports allow decides what is held. A single supporting point leaves the
      // body free to roll about every tangent axis. Supports in a line (a cylinder on its side
      // on a floor or across wires) leave it free to roll about that line, and hold any moment
      // across the line by sharing the load, which is the contact solver's business. Supports
      // spread over an area (a plate on two wires and a tine) leave it no rolling at all, and
      // nothing is anticipated: pushing against a moment the contacts already hold would make
      // the body creep.
      const frame = this.supportFrame(sums, count, nx, ny, nz);
      if (frame.along < POINT_SUPPORT_SPREAD) {
        const moment = Math.sqrt(tx * tx + ty * ty + tz * tz);
        const speedNow = Math.sqrt(ox * ox + oy * oy + oz * oz);
        // One axis for everything: that of the rotation the body will have.
        const coming = moment > 0 && moment <= held;
        let ax = ox;
        let ay = oy;
        let az = oz;
        if (coming) {
          const gain = dt / about(tx / moment, ty / moment, tz / moment);
          ax += gain * tx;
          ay += gain * ty;
          az += gain * tz;
        }
        const speed = Math.sqrt(ax * ax + ay * ay + az * az);
        if (speed > 0) {
          ax /= speed;
          ay /= speed;
          az /= speed;
          const cap = (held * dt) / about(ax, ay, az);
          const drop = Math.min(speed, cap);
          let nowX = 0;
          let nowY = 0;
          let nowZ = 0;
          if (speedNow > 0) {
            const taken =
              Math.min(speedNow, (held * dt) / about(ox / speedNow, oy / speedNow, oz / speedNow)) /
              speedNow;
            nowX = -taken * ox;
            nowY = -taken * oy;
            nowZ = -taken * oz;
          }
          dwx += nowX;
          dwy += nowY;
          dwz += nowZ;
          holdX = -drop * ax - nowX;
          holdY = -drop * ay - nowY;
          holdZ = -drop * az - nowZ;
        }
      } else {
        const e = frame.axis;
        const fx = ny * e[2] - nz * e[1];
        const fy = nz * e[0] - nx * e[2];
        const fz = nx * e[1] - ny * e[0];
        const line = frame.across < POINT_SUPPORT_SPREAD;
        about1(
          e[0],
          e[1],
          e[2],
          ox * e[0] + oy * e[1] + oz * e[2],
          tx * e[0] + ty * e[1] + tz * e[2],
          line,
        );
        about1(fx, fy, fz, ox * fx + oy * fy + oz * fz, tx * fx + ty * fy + tz * fz, false);
      }
      if (holdX !== 0 || holdY !== 0 || holdZ !== 0) {
        const hold = record.hold;
        hold[0] = holdX;
        hold[1] = holdY;
        hold[2] = holdZ;
        hold[3] = (holdY * rz - holdZ * ry) * u;
        hold[4] = (holdZ * rx - holdX * rz) * u;
        hold[5] = (holdX * ry - holdY * rx) * u;
        record.holding = true;
      }
    }

    // Spin about the support normal.
    const spinLength = (sums[SUPPORT_SPIN] as number) / (LENGTH_QUANTA * count);
    const spin = spinNow;
    if (spinLength > 0 && spin !== 0) {
      const drop = Math.min(Math.abs(spin), (spinLength * weight * dt) / about(nx, ny, nz));
      const sign = spin > 0 ? 1 : -1;
      dwx -= sign * drop * nx;
      dwy -= sign * drop * ny;
      dwz -= sign * drop * nz;
    }

    if (dwx === 0 && dwy === 0 && dwz === 0) return;
    f32[w] = wx + dwx;
    f32[w + 1] = wy + dwy;
    f32[w + 2] = wz + dwz;
    // The same rotation about the supporting point moves the centre of mass by dw x r.
    f32[v] = (f32[v] as number) + (dwy * rz - dwz * ry) * u;
    f32[v + 1] = (f32[v + 1] as number) + (dwz * rx - dwx * rz) * u;
    f32[v + 2] = (f32[v + 2] as number) + (dwx * ry - dwy * rx) * u;
  }

  /**
   * How the supporting points of a body are spread in the plane perpendicular to the unit
   * normal `(nx, ny, nz)`: the unit direction along which they are spread most, their root mean
   * square distance from their mean along it, and across it (metres).
   */
  private supportFrame(
    sums: Float64Array,
    count: number,
    nx: number,
    ny: number,
    nz: number,
  ): { readonly axis: Vec3; readonly along: number; readonly across: number } {
    // Covariance of the points, metres squared, from the exact sums.
    const k = 1 / (SPREAD_QUANTA * this.scale);
    const mx = (sums[SUPPORT_COARSE] as number) / count;
    const my = (sums[SUPPORT_COARSE + 1] as number) / count;
    const mz = (sums[SUPPORT_COARSE + 2] as number) / count;
    const xx = ((sums[SUPPORT_PRODUCT] as number) / count - mx * mx) * k * k;
    const xy = ((sums[SUPPORT_PRODUCT + 1] as number) / count - mx * my) * k * k;
    const xz = ((sums[SUPPORT_PRODUCT + 2] as number) / count - mx * mz) * k * k;
    const yy = ((sums[SUPPORT_PRODUCT + 3] as number) / count - my * my) * k * k;
    const yz = ((sums[SUPPORT_PRODUCT + 4] as number) / count - my * mz) * k * k;
    const zz = ((sums[SUPPORT_PRODUCT + 5] as number) / count - mz * mz) * k * k;
    // Any two unit vectors that span the plane of the support.
    const seed: Vec3 = Math.abs(nx) < 0.6 ? [1, 0, 0] : [0, 1, 0];
    let ax = seed[1] * nz - seed[2] * ny;
    let ay = seed[2] * nx - seed[0] * nz;
    let az = seed[0] * ny - seed[1] * nx;
    const length = Math.sqrt(ax * ax + ay * ay + az * az);
    ax /= length;
    ay /= length;
    az /= length;
    const bx = ny * az - nz * ay;
    const by = nz * ax - nx * az;
    const bz = nx * ay - ny * ax;
    const form = (px: number, py: number, pz: number, qx: number, qy: number, qz: number): number =>
      px * (xx * qx + xy * qy + xz * qz) +
      py * (xy * qx + yy * qy + yz * qz) +
      pz * (xz * qx + yz * qy + zz * qz);
    const aa = form(ax, ay, az, ax, ay, az);
    const ab = form(ax, ay, az, bx, by, bz);
    const bb = form(bx, by, bz, bx, by, bz);
    const half = Math.sqrt(((aa - bb) / 2) ** 2 + ab * ab);
    const angle = 0.5 * Math.atan2(2 * ab, aa - bb);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      axis: [c * ax + s * bx, c * ay + s * by, c * az + s * bz],
      along: Math.sqrt(Math.max(0, (aa + bb) / 2 + half)),
      across: Math.sqrt(Math.max(0, (aa + bb) / 2 - half)),
    };
  }

  private stepOnce(): void {
    const bi = this.bodyInterface;
    const f32 = this.jolt.HEAPF32;
    const driven: { record: BodyRecord; target: Pose }[] = [];
    if (this.kinematicTargets.size > 0) {
      const targets = [...this.kinematicTargets].sort((a, b) => compareIds(a[0].id, b[0].id));
      for (const [record, target] of targets) driven.push({ record, target });
      this.kinematicTargets.clear();
    }
    // Before the driven bodies move: which bodies they will carry or meet in this step.
    const near = this.scopeCasting(driven);

    // A step that could overflow the contact capacity must be undoable: save the state while
    // the count is high or the world has just been changed from outside.
    const guard = CONTACT_CAPACITY_GUARD * this.settings.maxContactConstraints;
    let before: Uint8Array | null = null;
    if (this.disturbed || this.manifoldsThisStep > CONTACT_CAPACITY_WATCH * guard) {
      for (const { record, target } of driven) this.kinematicTargets.set(record, target);
      before = this.saveState();
      this.kinematicTargets.clear();
    }

    for (const { record, target } of driven) {
      const body = this.engineBody(record);
      // Whatever rides on a driven body must be awake before the step and stay awake while it
      // is carried. A body the engine wakes through the contact inside the step has missed that
      // step's gravity, so it has no normal force and therefore no friction for one step.
      // Measured on a box (friction 0.4) on a tray following the rack profile: up to 2.6 mm of
      // slip where there should be none.
      this.wakeAround(body);
      this.setPoseArguments(target.p, target.q);
      bi.MoveKinematic(body.GetID(), this.rvec, this.quat, this.timeStep);
    }

    // The engine keeps the contacts of a pair of bodies for as long as the two barely move
    // relative to each other, so a body that has just come to rest still holds every contact
    // created ahead of its approach: hundreds per plate in a stack, none of them touching. Its
    // pairs are tested afresh, once, in the step after the first in which it was slow. The same
    // goes for a body that was teleported. (Asked for here, from state that a snapshot carries,
    // and not when the cause arises: the engine's own request flag is not part of its saved
    // state.)
    //
    // A body that lies on one of its round rolling surfaces, touches nothing else that can
    // move, and is turning gets fresh contacts in every step (only such a body: testing every
    // pair of a stack of nested bowls afresh in every step in which one of them stirs kept a
    // stack of eight from ever coming to rest, and every plate of a pile that stands with its
    // rim on a wire was tested afresh against all its neighbours in every step in which the
    // pile stirred):
    // kept contact points turn with the body, so the point it rolls on would trail behind the
    // line under its axis by up to the cache thresholds, and the weight on a trailing point
    // drives the roll like a rolling resistance of minus 0.02 mm (measured on a 73 mm cylinder).
    for (const record of this.ranked) {
      if (record.kind === 'static' || record.body === null) continue;
      let fresh =
        record.contactsStale || (record.active && record.restSteps === REST_REFRESH_STEPS);
      if (!fresh && record.onRound && record.active && record.velocityAt !== 0) {
        const v = record.velocityAt >>> 2;
        fresh =
          Math.hypot(f32[v + 4] as number, f32[v + 5] as number, f32[v + 6] as number) >
          ROLLING_FRESH_CONTACTS_SPEED;
      }
      if (fresh) bi.InvalidateContactCache(record.body.GetID());
    }

    // Static rolling resistance: what was held back for this step (see `resist`). A body that
    // sleeps keeps what holds it: it is held again in the first step after it is woken, so
    // that waking a body that rests on its rolling resistance does not set it rolling.
    for (const record of this.ranked) {
      if (!record.holding || !record.active || record.velocityAt === 0) continue;
      const v = record.velocityAt >>> 2;
      const hold = record.hold;
      f32[v + 4] = (f32[v + 4] as number) + (hold[0] as number);
      f32[v + 5] = (f32[v + 5] as number) + (hold[1] as number);
      f32[v + 6] = (f32[v + 6] as number) + (hold[2] as number);
      f32[v] = (f32[v] as number) + (hold[3] as number);
      f32[v + 1] = (f32[v + 1] as number) + (hold[4] as number);
      f32[v + 2] = (f32[v + 2] as number) + (hold[5] as number);
      record.hold.fill(0);
      record.holding = false;
    }

    // What the contact callbacks of this step need: the velocities before it, and clean slates
    // for the groups in contact and the supporting contacts.
    for (const record of this.ranked) {
      record.group = record;
      if (record.support[SUPPORT_COUNT] !== 0) record.support.fill(0);
      record.roundSeen = false;
      record.neighbourSeen = false;
      const c = record.pointer >>> 2;
      record.preCx = f32[c] as number;
      record.preCy = f32[c + 1] as number;
      record.preCz = f32[c + 2] as number;
      if (record.active && record.velocityAt !== 0) {
        const v = record.velocityAt >>> 2;
        record.preVx = f32[v] as number;
        record.preVy = f32[v + 1] as number;
        record.preVz = f32[v + 2] as number;
        record.preWx = f32[v + 4] as number;
        record.preWy = f32[v + 5] as number;
        record.preWz = f32[v + 6] as number;
      } else {
        record.preVx = 0;
        record.preVy = 0;
        record.preVz = 0;
        record.preWx = 0;
        record.preWy = 0;
        record.preWz = 0;
      }
    }
    this.marginBody1 = 0;
    this.marginBody2 = 0;
    this.filterBody1 = 0;
    this.filterBody2 = 0;
    this.scopeSpeculativeDistance();

    this.stepCounter++;
    for (const record of this.activeBodies) record.touchedStep = this.stepCounter;
    this.manifoldsThisStep = 0;
    this.sleptThisStep = [];
    this.stepping = true;
    try {
      this.iface.Step(this.timeStep, this.settings.collisionSteps);
    } finally {
      this.stepping = false;
    }
    this.disturbed = false;
    this.peakManifolds = Math.max(this.peakManifolds, this.manifoldsThisStep);

    // A kinematic body that is not driven again stops.
    const drivenSet = new Set<BodyRecord>();
    for (const { record } of driven) {
      drivenSet.add(record);
      const body = this.engineBody(record);
      this.vec.Set(0, 0, 0);
      this.vec2.Set(0, 0, 0);
      bi.SetLinearAndAngularVelocity(body.GetID(), this.vec, this.vec2);
    }

    if (this.manifoldsThisStep > guard) {
      const manifolds = this.manifoldsThisStep;
      if (before !== null) {
        this.restoreState(before);
        // The step that failed was not taken; the next one is watched again.
        this.disturbed = true;
      } else {
        this.afterStep(near, drivenSet);
      }
      throw new ContactCapacityError(
        manifolds,
        this.settings.maxContactConstraints,
        before !== null,
      );
    }
    this.afterStep(near, drivenSet);
  }

  /** What follows the engine's step: resistance, rest timers, sleep and the contact book. */
  private afterStep(near: ReadonlySet<BodyRecord>, driven: ReadonlySet<BodyRecord>): void {
    const f32 = this.jolt.HEAPF32;
    const s = this.settings;
    const u = this.scale;
    const linearLimit = s.restLinearSpeed * u;
    const angularLimit = s.restAngularSpeed;
    const blend = this.restBlend;
    for (const record of this.activeBodies) {
      if (record.kind !== 'dynamic') continue;
      // The velocity the body moved with in this step (before any resistance is taken from
      // it for the next), averaged, is what counts as its motion.
      const v = record.velocityAt >>> 2;
      const mean = record.mean;
      for (let i = 0; i < 3; i++) {
        mean[i] = (mean[i] as number) + blend * ((f32[v + i] as number) - (mean[i] as number));
        mean[i + 3] =
          (mean[i + 3] as number) + blend * ((f32[v + 4 + i] as number) - (mean[i + 3] as number));
      }
      const gain = record.gain;
      gain[0] = (f32[v] as number) - record.preVx;
      gain[1] = (f32[v + 1] as number) - record.preVy;
      gain[2] = (f32[v + 2] as number) - record.preVz;
      gain[3] = (f32[v + 4] as number) - record.preWx;
      gain[4] = (f32[v + 5] as number) - record.preWy;
      gain[5] = (f32[v + 6] as number) - record.preWz;
      record.knock = Math.hypot(gain[0], gain[1], gain[2]);
      record.knockTurn = Math.hypot(gain[3], gain[4], gain[5]);
      if ((record.support[SUPPORT_COUNT] as number) > 0) this.resist(record);
      // Rolling free: on a round surface and against nothing else that can move.
      record.onRound = record.roundSeen && !record.neighbourSeen;
      const linear = Math.hypot(mean[0] as number, mean[1] as number, mean[2] as number);
      const angular = Math.hypot(mean[3] as number, mean[4] as number, mean[5] as number);
      if (linear < linearLimit && angular < angularLimit) record.restSteps++;
      else record.restSteps = 0;
    }

    // Contacts of bodies that were awake during this step are in the engine's cache again (if
    // they still exist), so their book entries are out of date.
    if (this.book.size > 0) {
      for (const [key, pair] of this.book) {
        if (
          pair.first.touchedStep === this.stepCounter ||
          pair.second.touchedStep === this.stepCounter
        ) {
          this.book.delete(key);
        }
      }
    }
    // The engine forgets the contacts of a body one step after it falls asleep: keep them.
    const slept = this.sleepGroupsAtRest(near, driven);
    if (slept.length > 0) {
      for (const pair of this.readEngineContacts(new Set(slept))) {
        this.book.set(this.pairKey(pair.first, pair.second), pair);
      }
    }
    for (const record of this.ranked) record.contactsStale = false;
    this.liveContacts = null;
  }

  step(n: number): void {
    this.assertUsable();
    checkSteps(n, 'the number of steps');
    this.flush();
    for (let i = 0; i < n; i++) this.stepOnce();
  }

  /** Gives the engine (and the rolling resistance) the gravity `g`, m/s^2. */
  private setGravityNow(g: Vec3): void {
    if (g === this.gravityNow) return;
    const u = this.scale;
    this.vec.Set(g[0] * u, g[1] * u, g[2] * u);
    this.system.SetGravity(this.vec);
    this.gravityNow = g;
  }

  /**
   * Whether the engine starts the next steps from the contact forces of the step before (it
   * does, unless the world's settings say otherwise) or from none, as for a body just woken.
   */
  private setWarmStart(on: boolean): void {
    const p = this.system.GetPhysicsSettings();
    p.mConstraintWarmStart = on && this.settings.constraintWarmStart;
    this.system.SetPhysicsSettings(p);
  }

  /**
   * The world's gravity tilted by `tilt` radians towards the `k`-th of `directions` horizontal
   * directions: the first is the tub's +x (or +y, should gravity lie along x), the others
   * follow at equal angles about the vertical. Same magnitude.
   */
  private tiltedGravity(tilt: number, k: number, directions: number): Vec3 {
    const g = this.gravity;
    const norm = this.gravityNorm;
    const down: Vec3 = [g[0] / norm, g[1] / norm, g[2] / norm];
    // Two horizontal unit vectors: the tub's +x made perpendicular to gravity, and the third
    // of the right-handed set (up, e1, e2), which is +y for gravity along -z.
    const seed: Vec3 = Math.abs(down[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const along = seed[0] * down[0] + seed[1] * down[1] + seed[2] * down[2];
    let e1: Vec3 = [
      seed[0] - along * down[0],
      seed[1] - along * down[1],
      seed[2] - along * down[2],
    ];
    const length = v3Length(e1);
    e1 = [e1[0] / length, e1[1] / length, e1[2] / length];
    const e2: Vec3 = [
      e1[1] * down[2] - e1[2] * down[1],
      e1[2] * down[0] - e1[0] * down[2],
      e1[0] * down[1] - e1[1] * down[0],
    ];
    const azimuth = (2 * Math.PI * k) / directions;
    const c = Math.cos(azimuth) * Math.sin(tilt);
    const s = Math.sin(azimuth) * Math.sin(tilt);
    const d = Math.cos(tilt);
    return [
      norm * (d * down[0] + c * e1[0] + s * e2[0]),
      norm * (d * down[1] + c * e1[1] + s * e2[1]),
      norm * (d * down[2] + c * e1[2] + s * e2[2]),
    ];
  }

  settle(opts: SettleOptions): SettleResult {
    this.assertUsable();
    checkSteps(opts.minSteps, 'minSteps');
    checkSteps(opts.maxSteps, 'maxSteps');
    checkSteps(opts.restHoldSteps, 'restHoldSteps');
    if (!Number.isInteger(opts.blockSteps) || opts.blockSteps < 1) {
      throw new Error(`physics: blockSteps must be a positive integer, got ${opts.blockSteps}`);
    }
    if (!(opts.restLinearSpeed >= 0) || !(opts.restAngularSpeed >= 0)) {
      throw new Error('physics: the rest speeds must not be negative');
    }
    const shake = opts.disturbance;
    if (shake !== undefined) {
      checkSteps(shake.directionSteps, 'the steps per direction of the disturbance');
      checkSteps(shake.calmSteps, 'the calm steps before the disturbance');
      if (!Number.isInteger(shake.directions) || shake.directions < 1) {
        throw new Error('physics: the disturbance needs a positive whole number of directions');
      }
      if (!(shake.tilt >= 0) || !(shake.tilt < Math.PI / 2)) {
        throw new Error('physics: the tilt of the disturbance must be from 0 to under 90 degrees');
      }
    }
    this.flush();
    const s = this.settings;
    const dynamic = this.ranked.filter((record) => record.kind === 'dynamic');
    for (const record of dynamic) {
      record.settleSteps = 0;
      record.shaken = false;
      record.shaking = false;
    }

    // A body asleep met the world's own criterion. When this call asks for more, nothing may
    // sleep on the world's terms while it runs: wake everything and keep it awake.
    const stricter =
      opts.restLinearSpeed < s.restLinearSpeed ||
      opts.restAngularSpeed < s.restAngularSpeed ||
      opts.restHoldSteps > this.restHoldSteps;
    if (stricter) {
      for (const record of dynamic) {
        if (!record.active) this.bodyInterface.ActivateBody(this.engineBody(record).GetID());
      }
    }
    const linearLimit = opts.restLinearSpeed * this.scale;
    const moving = (): BodyRecord[] =>
      dynamic.filter((record) => record.active && record.settleSteps < opts.restHoldSteps);

    // The disturbance. It is given whenever every awake body that has not had it has calmed
    // down, and at the latest when one of them has met the rest criterion and would go to
    // sleep (others may take much longer: what lies still is not kept waiting for what
    // rolls). Whatever is awake goes through it, but it counts only for the bodies that were
    // calm when it began; nothing goes to sleep on the way, a body only sleeps once it counts
    // for it, and rest is earned again afterwards.
    const tilting = shake !== undefined && shake.tilt > 0 && this.gravityNorm > 0;
    const shakeSteps =
      shake === undefined || (!tilting && shake.coldStart !== true)
        ? 0
        : shake.directions * shake.directionSteps;
    let shaking = false;
    let shaken = 0;
    let disturbed = false;
    // The next step is to be solved without the contact forces of the one before.
    let cold = false;

    let steps = 0;
    let target = Math.min(opts.minSteps, opts.maxSteps);
    let unsettled: BodyRecord[];
    this.sleepSuspended = stricter;
    this.sleepAfterShake = shakeSteps > 0;
    try {
      for (;;) {
        while (steps < target) {
          if (tilting && shaking && shake !== undefined && shaken % shake.directionSteps === 0) {
            this.setGravityNow(
              this.tiltedGravity(shake.tilt, shaken / shake.directionSteps, shake.directions),
            );
          }
          if (cold) {
            cold = false;
            this.setWarmStart(false);
            try {
              this.stepOnce();
            } finally {
              this.setWarmStart(true);
            }
          } else {
            this.stepOnce();
          }
          steps++;
          let waiting = 0;
          let calm = 0;
          let ready = false;
          for (const record of this.activeBodies) {
            if (record.kind !== 'dynamic') continue;
            const mean = record.mean;
            const linear = Math.hypot(mean[0] as number, mean[1] as number, mean[2] as number);
            const angular = Math.hypot(mean[3] as number, mean[4] as number, mean[5] as number);
            if (linear < linearLimit && angular < opts.restAngularSpeed) record.settleSteps++;
            else record.settleSteps = 0;
            if (shake === undefined || record.shaken) continue;
            waiting++;
            if (record.settleSteps >= shake.calmSteps) calm++;
            if (record.settleSteps >= opts.restHoldSteps) ready = true;
          }
          if (shakeSteps === 0 || shake === undefined) continue;
          if (!shaking) {
            if (waiting > 0 && (calm === waiting || ready)) {
              shaking = true;
              shaken = 0;
              this.sleepSuspended = true;
              cold = shake.coldStart === true;
              for (const record of this.activeBodies) {
                record.shaking =
                  record.kind === 'dynamic' &&
                  !record.shaken &&
                  record.settleSteps >= shake.calmSteps;
              }
            }
          } else {
            shaken++;
            if (shaken >= shakeSteps) {
              shaking = false;
              disturbed = true;
              this.setGravityNow(this.gravity);
              this.sleepSuspended = stricter;
              for (const record of dynamic) {
                record.settleSteps = 0;
                if (record.active) record.restSteps = 0;
                if (record.shaking) record.shaken = true;
                record.shaking = false;
              }
            }
          }
        }
        unsettled = moving();
        if ((unsettled.length === 0 && !shaking) || steps >= opts.maxSteps) break;
        target = Math.min(steps + opts.blockSteps, opts.maxSteps);
      }
    } finally {
      this.sleepSuspended = false;
      this.sleepAfterShake = false;
      this.setGravityNow(this.gravity);
    }

    // Bodies that are still inside something: released overlapping and never pushed apart.
    const deep = new Set<string>();
    const kinds = new Map<string, BodyKind>();
    for (const record of this.ranked) kinds.set(record.id, record.kind);
    for (const point of this.gatherPoints(undefined)) {
      if (-point.gap <= UNRESOLVED_PENETRATION) continue;
      if (kinds.get(point.a) === 'dynamic') deep.add(point.a);
      if (kinds.get(point.b) === 'dynamic') deep.add(point.b);
    }
    return {
      steps,
      time: steps * this.timeStep,
      atRest: unsettled.length === 0,
      disturbed,
      moving: unsettled.map((record) => record.id).sort(compareIds),
      penetrating: [...deep].sort(compareIds),
    };
  }

  // ------------------------------------------------------------------------------------------
  // Contacts
  // ------------------------------------------------------------------------------------------

  /** Every contact point the world knows of, between the pairs selected by `query`. */
  private gatherPoints(query: ContactQuery | undefined): ContactPoint[] {
    let only: Set<BodyRecord> | null = null;
    if (query?.bodies !== undefined) {
      only = new Set<BodyRecord>();
      for (const id of query.bodies) only.add(this.record(id));
    }
    let live: PairContacts[];
    if (only === null) {
      this.liveContacts ??= this.readEngineContacts(null);
      live = this.liveContacts;
    } else {
      live = this.liveContacts ?? this.readEngineContacts(only);
    }
    const pairs = new Map<number, PairContacts>();
    for (const pair of this.book.values()) pairs.set(this.pairKey(pair.first, pair.second), pair);
    // Where both know a pair, the engine's cache is at least as recent as the book.
    for (const pair of live) pairs.set(this.pairKey(pair.first, pair.second), pair);

    const transforms = new Map<BodyRecord, { com: Vec3; q: Quat }>();
    const transformOf = (record: BodyRecord): { com: Vec3; q: Quat } => {
      let found = transforms.get(record);
      if (found === undefined) {
        const body = this.engineBody(record);
        found = { com: this.comPositionSI(body), q: this.rotation(body) };
        transforms.set(record, found);
      }
      return found;
    };

    const touch = this.settings.contactTouchDistance;
    const u = this.scale;
    const out: ContactPoint[] = [];
    for (const pair of pairs.values()) {
      const { first, second } = pair;
      if (first.contactsStale || second.contactsStale) continue;
      if (only !== null && !only.has(first) && !only.has(second)) continue;
      const t1 = transformOf(first);
      const t2 = transformOf(second);
      for (const manifold of pair.manifolds) {
        const normal = quatRotate(t2.q, manifold.normal);
        const p = manifold.points;
        for (let k = 0; k + 6 < p.length; k += 7) {
          // The cache holds the points relative to each centre of mass, in engine units.
          const positionA = v3Add(
            t1.com,
            quatRotate(t1.q, [
              (p[k] as number) / u,
              (p[k + 1] as number) / u,
              (p[k + 2] as number) / u,
            ]),
          );
          const positionB = v3Add(
            t2.com,
            quatRotate(t2.q, [
              (p[k + 3] as number) / u,
              (p[k + 4] as number) / u,
              (p[k + 5] as number) / u,
            ]),
          );
          // kg unit/s to N s.
          const impulse = Math.max(0, p[k + 6] as number) / u;
          const gap =
            (positionB[0] - positionA[0]) * normal[0] +
            (positionB[1] - positionA[1]) * normal[1] +
            (positionB[2] - positionA[2]) * normal[2];
          out.push({
            a: first.id,
            b: second.id,
            partA: first.leafPart[manifold.leaf1] ?? '',
            partB: second.leafPart[manifold.leaf2] ?? '',
            pieceA: first.built.leafPiece[manifold.leaf1] ?? -1,
            pieceB: second.built.leafPiece[manifold.leaf2] ?? -1,
            positionA,
            positionB,
            normal,
            gap,
            normalForceN: impulse / this.timeStep,
            // A speculative contact that neither touches nor pushed during the step is none.
            touching: impulse > 0 || gap <= touch,
          });
        }
      }
    }
    return out;
  }

  contactPoints(query?: ContactQuery): ContactPoint[] {
    this.assertUsable();
    this.flush();
    return this.gatherPoints(query).sort(
      (x, y) =>
        compareIds(x.a, y.a) ||
        compareIds(x.b, y.b) ||
        compareIds(x.partA, y.partA) ||
        compareIds(x.partB, y.partB) ||
        x.pieceA - y.pieceA ||
        x.pieceB - y.pieceB ||
        x.positionA[0] - y.positionA[0] ||
        x.positionA[1] - y.positionA[1] ||
        x.positionA[2] - y.positionA[2],
    );
  }

  contacts(query?: ContactQuery): Contact[] {
    this.assertUsable();
    this.flush();
    interface Accumulator {
      a: string;
      b: string;
      partA: string;
      partB: string;
      points: number;
      force: number;
      maxPenetration: number;
      position: [number, number, number];
      weighted: [number, number, number];
      plain: [number, number, number];
    }
    const groups = new Map<string, Accumulator>();
    for (const point of this.gatherPoints(query)) {
      if (!point.touching) continue;
      const key = `${point.a}\u0000${point.b}\u0000${point.partA}\u0000${point.partB}`;
      let acc = groups.get(key);
      if (acc === undefined) {
        acc = {
          a: point.a,
          b: point.b,
          partA: point.partA,
          partB: point.partB,
          points: 0,
          force: 0,
          maxPenetration: 0,
          position: [0, 0, 0],
          weighted: [0, 0, 0],
          plain: [0, 0, 0],
        };
        groups.set(key, acc);
      }
      acc.points++;
      acc.force += point.normalForceN;
      acc.maxPenetration = Math.max(acc.maxPenetration, -point.gap);
      for (let i = 0; i < 3; i++) {
        const mid = ((point.positionA[i] as number) + (point.positionB[i] as number)) / 2;
        acc.position[i] = (acc.position[i] as number) + mid;
        acc.weighted[i] =
          (acc.weighted[i] as number) + point.normalForceN * (point.normal[i] as number);
        acc.plain[i] = (acc.plain[i] as number) + (point.normal[i] as number);
      }
    }

    const result: Contact[] = [];
    for (const acc of groups.values()) {
      const direction = v3Length(acc.weighted) > 0 ? acc.weighted : acc.plain;
      const length = v3Length(direction);
      result.push({
        a: acc.a,
        b: acc.b,
        partA: acc.partA,
        partB: acc.partB,
        points: acc.points,
        normalForceN: acc.force,
        maxPenetration: acc.maxPenetration,
        position: [
          acc.position[0] / acc.points,
          acc.position[1] / acc.points,
          acc.position[2] / acc.points,
        ],
        normal:
          length > 0
            ? [direction[0] / length, direction[1] / length, direction[2] / length]
            : [0, 0, 1],
      });
    }
    return result.sort(
      (x, y) =>
        compareIds(x.a, y.a) ||
        compareIds(x.b, y.b) ||
        compareIds(x.partA, y.partA) ||
        compareIds(x.partB, y.partB),
    );
  }

  // ------------------------------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------------------------------

  private setIgnore(ignore: readonly string[] | undefined): void {
    this.ignoreFilter.Clear();
    if (ignore === undefined) return;
    for (const id of ignore) {
      // An id that is not in the world has nothing to be skipped.
      const record = this.records.get(id);
      if (record === undefined || record.body === null) continue;
      this.ignoreFilter.IgnoreBody(record.body.GetID());
    }
  }

  penetration(
    pieces: readonly CollisionPiece[],
    pose: Pose,
    ignore?: readonly string[],
  ): PenetrationResult {
    this.assertUsable();
    const at = checkPose(pose, 'the pose of a penetration query');
    this.flush();
    const built = this.shapes.probe(pieces);
    const com = v3Add(at.p, quatRotate(at.q, built.joltCom));
    this.setPoseArguments(com, at.q);
    const transform = this.jolt.RMat44.prototype.sRotationTranslation(this.quat, this.rvec);
    this.setIgnore(ignore);
    this.queryHits = new Map();
    this.system
      .GetNarrowPhaseQuery()
      .CollideShape(
        built.shape,
        this.unitScale,
        transform,
        this.collideSettings,
        this.origin,
        this.collideCollector,
        this.allBroadPhaseLayers,
        this.allObjectLayers,
        this.ignoreFilter,
        this.allShapes,
      );
    let depth = 0;
    const touched: { id: string; part: string }[] = [];
    for (const [record, hit] of this.queryHits) {
      depth = Math.max(depth, hit.depth);
      touched.push({ id: record.id, part: record.leafPart[hit.leaf] ?? '' });
    }
    touched.sort((a, b) => compareIds(a.id, b.id));
    return { depth, with: touched.map((t) => t.id), parts: touched.map((t) => t.part) };
  }

  sweep(
    pieces: readonly CollisionPiece[],
    from: Pose,
    to: Pose,
    ignore?: readonly string[],
  ): SweepResult {
    this.assertUsable();
    const start = checkPose(from, 'the start pose of a sweep');
    const end = checkPose(to, 'the end pose of a sweep');
    this.flush();
    const jolt = this.jolt;
    const built = this.shapes.probe(pieces);
    this.setIgnore(ignore);

    // The engine sweeps without turning. A sweep that turns is cut into legs short enough that
    // no point of the probe strays more than SWEEP_ARC_STEP from its true path; each leg is
    // swept at its mid orientation and starts with an overlap test at that orientation.
    const angle = quatAngleBetween(start.q, end.q);
    const reach = v3Length(built.joltCom) + built.boundingRadius;
    const legs =
      angle <= SWEEP_ROTATION_EPS
        ? 1
        : Math.max(1, Math.ceil((angle * reach) / (2 * SWEEP_ARC_STEP)));
    const narrowPhase = this.system.GetNarrowPhaseQuery();
    for (let leg = 0; leg < legs; leg++) {
      const t0 = leg / legs;
      const t1 = (leg + 1) / legs;
      const q =
        legs === 1 && angle <= SWEEP_ROTATION_EPS
          ? start.q
          : quatSlerp(start.q, end.q, (t0 + t1) / 2);
      const p0 = v3Lerp(start.p, end.p, t0);
      const p1 = v3Lerp(start.p, end.p, t1);
      const com = v3Add(p0, quatRotate(q, built.joltCom));
      this.setPoseArguments(com, q);
      const transform = jolt.RMat44.prototype.sRotationTranslation(this.quat, this.rvec);
      const u = this.scale;
      this.vec.Set((p1[0] - p0[0]) * u, (p1[1] - p0[1]) * u, (p1[2] - p0[2]) * u);
      const cast = new jolt.RShapeCast(built.shape, this.unitScale, transform, this.vec);
      this.castBest = null;
      this.castCollector.ResetEarlyOutFraction();
      try {
        narrowPhase.CastShape(
          cast,
          this.castSettings,
          this.origin,
          this.castCollector,
          this.allBroadPhaseLayers,
          this.allObjectLayers,
          this.ignoreFilter,
          this.allShapes,
        );
      } finally {
        jolt.destroy(cast);
      }
      const best = this.castBest as { fraction: number; record: BodyRecord; leaf: number } | null;
      if (best !== null) {
        const local = Math.min(1, Math.max(0, best.fraction));
        return {
          hit: true,
          fraction: t0 + local * (t1 - t0),
          with: best.record.id,
          part: best.record.leafPart[best.leaf] ?? '',
        };
      }
    }
    return { hit: false, fraction: 1 };
  }

  // ------------------------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------------------------

  snapshot(): Uint8Array {
    this.assertUsable();
    this.flush();
    return this.saveState();
  }

  private saveState(): Uint8Array {
    const writer = new ByteWriter();
    writer.u32(SNAPSHOT_MAGIC);
    writer.f64(this.timeStep);
    writer.u32(this.ranked.length);
    for (const record of this.ranked) {
      writer.text(record.id);
      writer.u8(record.kind === 'dynamic' ? 2 : record.kind === 'kinematic' ? 1 : 0);
      writer.u32(record.restSteps);
      writer.u8((record.holding ? 1 : 0) | (record.onRound ? 2 : 0));
      if (record.holding) for (const x of record.hold) writer.f64(x);
      if (record.kind === 'dynamic') {
        for (const x of record.mean) writer.f64(x);
        for (const x of record.gain) writer.f64(x);
      }
    }
    const engine = this.recorder.capture((recorder) => this.system.SaveState(recorder));
    writer.u32(engine.length);
    writer.bytes(engine);

    const targets = [...this.kinematicTargets].sort((a, b) => a[0].rank - b[0].rank);
    writer.u32(targets.length);
    for (const [record, pose] of targets) {
      writer.u32(record.rank);
      for (const x of pose.p) writer.f64(x);
      for (const x of pose.q) writer.f64(x);
    }

    const stale = this.ranked.filter((record) => record.contactsStale);
    writer.u32(stale.length);
    for (const record of stale) writer.u32(record.rank);

    const pairs = [...this.book.values()].sort(
      (a, b) => a.first.rank - b.first.rank || a.second.rank - b.second.rank,
    );
    writer.u32(pairs.length);
    for (const pair of pairs) {
      writer.u32(pair.first.rank);
      writer.u32(pair.second.rank);
      writer.u32(pair.manifolds.length);
      for (const manifold of pair.manifolds) {
        writer.u32(manifold.leaf1);
        writer.u32(manifold.leaf2);
        for (const x of manifold.normal) writer.f32(x);
        writer.u32(manifold.points.length);
        for (const x of manifold.points) writer.f32(x);
      }
    }
    return writer.toBytes();
  }

  restore(s: Uint8Array): void {
    this.assertUsable();
    this.flush();
    this.restoreState(s);
  }

  private restoreState(s: Uint8Array): void {
    const reader = new ByteReader(s);
    if (reader.u32() !== SNAPSHOT_MAGIC) throw new Error('physics: not a snapshot of a world');
    if (reader.f64() !== this.timeStep) {
      throw new Error('physics: the snapshot was taken with a different time step');
    }
    const count = reader.u32();
    if (count !== this.ranked.length) {
      throw new Error('physics: the snapshot was taken from a world holding different bodies');
    }
    const restSteps: number[] = [];
    const holds: (number[] | null)[] = [];
    const onRound: boolean[] = [];
    const means: (number[] | null)[] = [];
    const gains: (number[] | null)[] = [];
    for (const record of this.ranked) {
      const id = reader.text();
      const kind = reader.u8();
      const expected = record.kind === 'dynamic' ? 2 : record.kind === 'kinematic' ? 1 : 0;
      if (id !== record.id || kind !== expected) {
        throw new Error('physics: the snapshot was taken from a world holding different bodies');
      }
      restSteps.push(reader.u32());
      const flags = reader.u8();
      onRound.push((flags & 2) !== 0);
      if ((flags & 1) === 0) {
        holds.push(null);
      } else {
        const hold: number[] = [];
        for (let i = 0; i < 6; i++) hold.push(reader.f64());
        holds.push(hold);
      }
      if (record.kind === 'dynamic') {
        const mean: number[] = [];
        for (let i = 0; i < 6; i++) mean.push(reader.f64());
        means.push(mean);
        const gain: number[] = [];
        for (let i = 0; i < 6; i++) gain.push(reader.f64());
        gains.push(gain);
      } else {
        means.push(null);
        gains.push(null);
      }
    }
    const engine = reader.bytes(reader.u32());

    // Read the rest before touching the engine, so that a damaged snapshot changes nothing.
    const record = (rank: number): BodyRecord => {
      const found = this.ranked[rank];
      if (found === undefined) throw new Error('physics: the snapshot refers to a missing body');
      return found;
    };
    const targets = new Map<BodyRecord, Pose>();
    for (let i = reader.u32(); i > 0; i--) {
      const target = record(reader.u32());
      const p: Vec3 = [reader.f64(), reader.f64(), reader.f64()];
      const q: Quat = [reader.f64(), reader.f64(), reader.f64(), reader.f64()];
      targets.set(target, { p, q });
    }
    const stale = new Set<BodyRecord>();
    for (let i = reader.u32(); i > 0; i--) stale.add(record(reader.u32()));
    const book = new Map<number, PairContacts>();
    for (let i = reader.u32(); i > 0; i--) {
      const first = record(reader.u32());
      const second = record(reader.u32());
      const manifolds: StoredManifold[] = [];
      for (let j = reader.u32(); j > 0; j--) {
        const leaf1 = reader.u32();
        const leaf2 = reader.u32();
        const normal: [number, number, number] = [reader.f32(), reader.f32(), reader.f32()];
        const points: number[] = [];
        for (let k = reader.u32(); k > 0; k--) points.push(reader.f32());
        manifolds.push({ leaf1, leaf2, normal, points });
      }
      book.set(this.pairKey(first, second), { first, second, manifolds });
    }
    if (reader.remaining !== 0) throw new Error('physics: the snapshot has trailing bytes');

    let accepted = false;
    const exact = this.recorder.replay(engine, (recorder) => {
      accepted = this.system.RestoreState(recorder);
    });
    if (!accepted || !exact) {
      throw new Error('physics: the engine rejected the snapshot; the world is now undefined');
    }
    // Whether a body is swept is decided afresh in every step and is not part of the state;
    // make sure the engine still agrees with what this world believes it last asked for.
    for (const body of this.ranked) this.setCasting(body, body.casting);
    this.kinematicTargets.clear();
    for (const [target, pose] of targets) this.kinematicTargets.set(target, pose);
    this.book.clear();
    for (const [key, pair] of book) this.book.set(key, pair);
    this.activeBodies.clear();
    for (let rank = 0; rank < this.ranked.length; rank++) {
      const body = this.ranked[rank] as BodyRecord;
      body.contactsStale = stale.has(body);
      body.restSteps = restSteps[rank] as number;
      this.setActive(body, this.engineBody(body).IsActive());
      const hold = holds[rank];
      body.hold.fill(0);
      body.holding = hold != null;
      body.onRound = onRound[rank] === true;
      if (hold != null) body.hold.set(hold);
      const mean = means[rank];
      body.mean.fill(0);
      if (mean != null) body.mean.set(mean);
      const gain = gains[rank];
      body.gain.fill(0);
      if (gain != null) body.gain.set(gain);
      body.knock = Math.hypot(
        body.gain[0] as number,
        body.gain[1] as number,
        body.gain[2] as number,
      );
      body.knockTurn = Math.hypot(
        body.gain[3] as number,
        body.gain[4] as number,
        body.gain[5] as number,
      );
    }
    this.liveContacts = null;
    this.disturbed = true;
  }

  stateHash(): string {
    this.assertUsable();
    this.flush();
    const writer = new ByteWriter();
    writer.u32(this.ranked.length);
    for (const record of this.ranked) {
      const body = this.engineBody(record);
      writer.text(record.id);
      writer.u8(record.kind === 'dynamic' ? 2 : record.kind === 'kinematic' ? 1 : 0);
      // The engine's own state, bit for bit: position of the centre of mass, orientation,
      // linear and angular velocity, all single precision.
      for (const x of this.comPosition(body)) writer.f32(x);
      for (const x of this.rotation(body)) writer.f32(x);
      for (const x of this.readVec(body.GetLinearVelocity())) writer.f32(x);
      for (const x of this.readVec(body.GetAngularVelocity())) writer.f32(x);
    }
    return `sha256:${createSha256().update(writer.toBytes()).digestHex()}`;
  }

  stats(): WorldStats {
    this.assertUsable();
    this.flush();
    return {
      bodies: this.ranked.length,
      activeBodies: this.activeBodies.size,
      manifolds: this.manifoldsThisStep,
      peakManifolds: this.peakManifolds,
      maxManifolds: this.settings.maxContactConstraints,
      steps: this.stepCounter,
      freeMemory: this.jolt.JoltInterface.prototype.sGetFreeMemory(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    if (this.stepping) throw new Error('physics: the world cannot be disposed from inside a step');
    this.disposed = true;
    const jolt = this.jolt;
    // Destroying the interface destroys the physics system and with it every body.
    jolt.destroy(this.iface);
    for (const record of this.records.values()) this.releaseBodyShape(record);
    this.shapes.dispose();
    this.recorder.dispose();
    for (const owned of [
      this.contactListener,
      this.shapeFilter,
      this.activationListener,
      this.saveFilter,
      this.collideCollector,
      this.castCollector,
      this.collideSettings,
      this.castSettings,
      this.ignoreFilter,
      this.allShapes,
      this.allObjectLayers,
      this.allBroadPhaseLayers,
      this.vec,
      this.vec2,
      this.rvec,
      this.quat,
      this.unitScale,
      this.origin,
    ]) {
      jolt.destroy(owned);
    }
    this.records.clear();
    this.byHandle.clear();
    this.byPointer.clear();
    this.ranked = [];
    this.book.clear();
    // The callbacks registered for fast dispatch belong to this world.
    clearJoltCallbacks(jolt);
    releaseJoltModule(jolt);
  }
}

/**
 * Creates a loading world. Asynchronous because the Jolt WebAssembly module is instantiated on
 * first use (a disposed world's module is reused). `settings` defaults to {@link JOLT_SETTINGS},
 * the configuration measured in the rigid-body bake-off; pass something else only to study the
 * effect of a setting.
 */
export async function createPhysicsWorld(
  options: PhysicsWorldOptions,
  settings: JoltWorldSettings = JOLT_SETTINGS,
): Promise<JoltPhysicsWorld> {
  if (!(options.timeStep > 0) || !Number.isFinite(options.timeStep)) {
    throw new Error(`physics: the time step must be positive and finite, got ${options.timeStep}`);
  }
  if (!v3IsFinite(options.gravity)) throw new Error('physics: gravity must be finite');
  if (typeof options.pairLookup !== 'function') {
    throw new Error('physics: a contact pair lookup is required');
  }
  // If the constructor throws, the module instance may hold a half-built world: it is simply
  // dropped (and garbage collected) instead of being handed to anyone else.
  return new World(await acquireJoltModule(), options, settings);
}
