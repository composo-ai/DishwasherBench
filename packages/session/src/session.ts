/**
 * The session: one player, one level, one loading world (docs/design/platform.md section 6).
 *
 * The session owns a physics world holding the machine in its current configuration and the
 * items placed so far. Every action of the contract (`types.ts`) is a method here; the human
 * client and the agent interface call the same methods, so they get the same quantisation and
 * the same physics. A player-facing failure is a value; nothing is charged for it and the scene
 * is exactly as it was.
 *
 * How the scene is modelled
 *  - A basket is pushed in or pulled out, as in the real machine. A basket is loaded from above
 *    while it is pulled out over the open door; the upper basket pulled out hangs over the lower
 *    one. Moving a basket is a simulated rack travel: its contents ride on it and may shift.
 *  - The insertability test of `place` is a straight sweep from above the machine down to the
 *    requested pose against the baskets and the items in them, so the upper basket over the
 *    lower one is in the way, and so is whatever already lies above the pose. The shell of the
 *    tub is left out of this one test: a pulled-out basket keeps its rear under the roof of the
 *    tub, where a hand (which is not modelled) reaches in at a slant. The pose itself must
 *    still be clear of the tub like of everything else.
 *  - An item belongs to no basket by rule. Which basket carries it is read from where it lies
 *    whenever that matters (rack travel, the checks).
 *
 * Determinism: the state after a call is a pure function of the level and the calls so far.
 * Nothing depends on wall-clock time. The state hash covers the exact bits of every body's
 * pose and velocity, the rack positions and options, and which items are placed.
 *
 * Units inside this file: SI and the tub frame, except where a name says `Mm` or `Deg` or a
 * value is a wire type.
 */

import type { ItemInstance } from '@spotless/catalogue';
import { contactPairLookup, instantiate } from '@spotless/catalogue';
import type { JsonValue, Pose, Quat, Rejected, Vec3 } from '@spotless/core';
import {
  POSE_IDENTITY,
  STANDARD_GRAVITY,
  canonicalHash,
  compareIds,
  degToRad as degToRadians,
  poseRelative,
  quatAngleBetween,
  quatConjugate,
  quatMul,
  quatRotate,
  poseTransformPoint,
  quatToAxisAngle,
  radToDeg,
  reject,
  roundToGrid,
  v3Add,
  v3AddScaled,
  v3Distance,
  v3Dot,
  v3Length,
  v3Normalise,
  v3Scale,
  v3Sub,
} from '@spotless/core';
import type { CollisionPiece, Shape } from '@spotless/geometry';
import { COLLISION_CHORD_ERROR, boundingBox, buildRenderMesh } from '@spotless/geometry';
import type {
  ItemRecord,
  Level,
  LevelCard,
  LevelItem,
  RackId,
  RackPosition,
} from '@spotless/levels';
import {
  applyRackOption,
  itemRecord,
  levelCard,
  levelMachine,
  levelProgramme,
  rackOptions,
  validateLevel,
} from '@spotless/levels';
import type { MachineConfig, MachineGeometry, MachineSpec, SideRestZone } from '@spotless/machine';
import { buildMachineGeometry, validateMachineConfig } from '@spotless/machine';
import type { JoltPhysicsWorld, JoltWorldSettings } from '@spotless/physics';
import {
  ContactCapacityError,
  JOLT_SETTINGS,
  LOADING_GRAVITY,
  LOADING_TIME_STEP,
  NO_MASS,
  createPhysicsWorld,
  rackTravelDistances,
  settleOptionsFor,
  sweepArm,
} from '@spotless/physics';
import type { MachineBody, MachineScene, RackAssembly } from './machine-bodies.ts';
import {
  DOOR_CLOSING_ID,
  KITCHEN_FLOOR_ID,
  KITCHEN_FLOOR_MATERIAL,
  KITCHEN_FLOOR_Z,
  boxPiece,
  buildMachineScene,
  collisionPiecesOf,
  kitchenFloorPieces,
  machineContactName,
  poseShifted,
} from './machine-bodies.ts';
import type {
  ActionLogEvent,
  ActionName,
  BudgetState,
  CheckLoadResult,
  ContactSummary,
  DropAccepted,
  DropResult,
  EpisodePhase,
  FrameId,
  GetItemRequest,
  GetItemResult,
  GetReportResult,
  ItemLocation,
  ListSlotsRequest,
  ListSlotsResult,
  LoadCheck,
  LoadManifest,
  MovedItem,
  PlaceRequest,
  PlacedItemState,
  PreviewRequest,
  PreviewResult,
  QueryName,
  QueryRejectReason,
  RemoveRequest,
  RemoveResult,
  ResetResult,
  SceneState,
  Session,
  SetRackRequest,
  SetRackResult,
  SlotCard,
  StartCycleRequest,
  StartCycleResult,
  TineRowCard,
  WashReport,
  WireImage,
  WirePose,
} from './types.ts';
import { FRAME_IDS, RACK_IDS } from './types.ts';
import { edgeOrientation, lowerEndOf } from './seat.ts';
import type { BasketTravelProfile } from './travel.ts';
import { BASKET_TRAVEL_PROFILES, basketTravelDistances, driveBasket } from './travel.ts';
import type { WashManifest, WashManifestItem, WashRunner } from './wash.ts';
import { placeholderWashRunner } from './wash.ts';
import type { ResolvedOrientation } from './wire.ts';
import {
  bodyPoseInTub,
  finePosition,
  isVec3,
  quantisePosition,
  referencePointOf,
  requestedWirePose,
  resolveOrientation,
  toWirePose,
} from './wire.ts';

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

/** Parameters of the session's mechanics. Lengths in metres, forces in newtons. */
export const SESSION_PARAMETERS = {
  /** Overlap up to which a requested pose is accepted (platform.md section 6, step 2). */
  penetrationTolerance: 0.0005,
  /**
   * Distance from the requested pose within which a contact met by the insertability sweep is
   * the contact of the pose itself and not an obstacle on the way. [ESTIMATED]
   */
  sweepEndTolerance: 0.002,
  /** Gap left between an item and what it is lowered onto when it is let go (under 1 mm). */
  releaseGap: 0.0003,
  /** Furthest an item is lowered before it is let go. */
  dropRange: 1.5,
  /** Height above the top of the tub from which the insertability sweep starts. */
  skyMargin: 0.06,
  /** Shortest insertability sweep, for a pose that is already above the machine. */
  minSweep: 0.05,
  /**
   * Distance from the requested pose within which the machine may stop an `insert` without the
   * pose counting as out of reach: the item is pushed, so it simply ends against whatever it
   * meets there. [ESTIMATED]
   */
  insertEndTolerance: 0.01,
  /** Length of the straight approach of an `insert`. [ESTIMATED] */
  insertReach: 0.3,
  /** Speed of an `insert`, m/s (docs/research/items.md section 8.1). */
  insertSpeed: 0.1,
  /** Force limit of an `insert`, N (items.md section 8.1: 10 to 20 N). */
  insertForce: 15,
  /** Steps without progress after which an `insert` is let go where it is (0.2 s). */
  insertStallSteps: 48,
  /** Progress per step below which an `insert` counts as making none (0.5 mm/s). */
  insertStallProgress: 2e-6,
  /** Share of the sideways and angular error an `insert` takes out per step. [ESTIMATED] */
  insertHoldGain: 0.2,
  /** Distance outside a basket's plan within which an item still counts as carried by it. */
  riderPlanMargin: 0.03,
  /** Depth below the top of a basket's base grid down to which an item counts as carried. */
  riderFloorMargin: 0.025,
  /**
   * How a basket is moved between height positions: speed (m/s) and accelerations (m/s^2).
   * [ESTIMATED: a hand lifting or lowering a loaded basket gently]
   */
  heightChange: { peakSpeed: 0.1, acceleration: 0.5, endStopDeceleration: 0.5 },
  /** Movement of another item that is reported: 1 mm or 1 degree (benchmark.md section 3.4). */
  movedDistance: 0.001,
  movedAngle: Math.PI / 180,
  /** How far an item may stick out of its basket's envelope before it is reported. */
  protrusionTolerance: 0.001,
  /**
   * Closing the door: how far in front of its closed position the door starts to be pushed
   * shut (the largest of these distances at which it is clear of the load), and how it moves.
   * [ESTIMATED: a door swung shut by hand, not slammed]
   */
  doorApproach: [0.12, 0.09, 0.06, 0.03],
  doorProfile: { peakSpeed: 0.2, acceleration: 1, deceleration: 2, endStopSpeed: 0 },
  /** Radius of the capsule swept along the tablet's path [ESTIMATED: a 20 g tablet]. */
  tabletRadius: 0.012,
  /** Tip travel between the samples of a spray-arm sweep. */
  armSweepArcStep: 0.002,
  /**
   * How far above the top of a basket's loading envelope an item's reference point may be for
   * the item still to count as carried by that basket.
   */
  riderHeightMargin: 0.15,
  /**
   * What `stable` allows: an item is stable when the nudge that ends every action (the standard
   * disturbance of a settle: gravity tilted by one degree towards four sides in turn) leaves it
   * within 4 mm and 3 degrees of where it had come to rest. A plate between tines, cutlery in a
   * cell or a glass against a shelf has a few millimetres of play and shifts within it without
   * being about to fall; at 1 mm two identical plates in neighbouring slots got different
   * verdicts. Something that topples, rolls or slides off moves centimetres. [ESTIMATED]
   */
  stable: { positionTolerance: 0.004, angleTolerance: (3 * Math.PI) / 180 },
  /**
   * An item that stands only on what is under it, on a base so narrow that tilting it by this
   * angle would carry its centre of mass past the edge of the base, is reported not stable
   * although the nudge left it standing (radians). The nudge is gravity tilted by 1 degree for
   * 0.05 s a side: it fells what stands on a point, but a 375 x 267 x 8 mm board on its long
   * edge tips only beyond atan(4 / 133.5) = 1.7 degrees and would need the tilt for far longer
   * (the nudge turns it 0.1 degree). [ESTIMATED: 5 degrees; a plate held by tines, a glass on
   * its rim (20 degrees and more) and cutlery leaning in a cell are not affected.]
   */
  balanceMargin: (5 * Math.PI) / 180,
  /** A contact whose normal is flatter than this (its vertical part) holds an item sideways. */
  balanceSideContact: 0.5,
  /**
   * Play allowed for in the base of an item: a surface within this distance counts as touched,
   * and the base is taken this much wider than its points of contact (a knife lying flat is
   * held by the engine on a line of points along its middle, 1 mm above the wires).
   */
  balanceReach: 0.0005,
  /** Overlap up to which `mode: 'set'` accepts a pose (a recorded resting pose touches things). */
  setPenetrationTolerance: 0.002,
  /**
   * Distance from the tub beyond which a body counts as gone (it is then taken back to the
   * counter like anything that reaches the kitchen floor).
   */
  strayDistance: 3,
  /** Clearance left to the wall of a basket by a suggested drop position. */
  suggestWallClearance: 0.004,
  /** Height of the lowest point of an item above the tine tips at a suggested drop position. */
  suggestDropClearance: 0.015,
  /**
   * An item counts as standing on the floor of its basket when its lowest point is within this
   * of the top of the base grid. Tines are 40 mm and more: what hangs on them is well above.
   */
  onBaseHeight: 0.01,
  /**
   * An item deeper along a tine row than this many clear widths of a slot does not come down
   * between its tines (a dinner plate is under two widths of the narrowest row, a bowl over
   * four). [ESTIMATED from the catalogue's plates and bowls]
   */
  perchDepthRatio: 3,
  /** Spacing of the candidate positions tried in a cutlery cell, and how many at most. */
  cutlerySearchStep: 0.008,
  cutlerySearchMax: 30,
  /** Height above the floor of a cutlery cell at which a suggested drop holds the item. */
  cutleryDropHeight: 0.01,
  /**
   * How much of the lower end of a piece of cutlery counts as the end that goes into a cell:
   * the suggested drop puts the middle of that stretch, not of the whole piece, over the place
   * in the cell (the handle of a ladle is 39 mm from the middle of its bounding box).
   */
  cutleryEndBand: 0.03,
  /**
   * Seating an item on edge between two tines by hand (`list_slots`): the leans tried, from
   * that of the tines down to this many degrees tipped forward; how far the lower edge is kept
   * from a tine when places in the gap are tried, and their spacing; how far above where it
   * touches down the item is let go; and by how much it may be moved across the row (away from
   * the basket above) to find room.
   */
  seatForwardLean: 30,
  seatGapMargin: 0.0005,
  seatGapStep: 0.001,
  seatLift: 0.001,
  /**
   * Overlap with the wires that a seat may have once it is put on the grid `place` takes
   * (`place` itself accepts 0.5 mm; the settle pushes the item clear).
   */
  seatOverlap: 0.0002,
  seatAcrossShifts: [0, -0.01, 0.01, -0.02, 0.02, -0.03, 0.03, -0.04, 0.04],
  /** How far below the top of the rail a lower edge is followed down. */
  seatDeepest: 0.035,
  /** Sweeps one search for a seat may spend on poses that turn out not to be reachable. */
  seatSweepsMax: 6,
  /**
   * Slots of a kind searched in full without a seat before the kind counts as having none. One,
   * as it has always been: a second search of a kind that has no seat costs as much as the
   * first (0.1 to 0.4 s a row). The kinds are told apart by pitch and clear width to the
   * millimetre, so an end slot that differs from the rest of its row is a kind of its own.
   */
  seatKindFails: 1,
  /**
   * A seat on the floor of the basket beside the rails (`findSeat` with `onFloor`): where the
   * floor between the rails of a row is not level (the ramp under row C of the Bosch's upper
   * basket, with a ridge between it and its partner row), a plate does not come to rest on the
   * two rails but where it is lowest across the row, held by the same two tines. The place is
   * looked for up to `seatFloorReach` of the item's half width either side of the rail, in
   * steps of `seatFloorStep`; the item counts as down between the tines there when its lowest
   * point is no higher than `seatFloorAboveRail` above the top of the rail.
   * [ESTIMATED; `rows.test.ts` lets the plates go at the seats offered.]
   */
  seatFloorReach: 0.8,
  seatFloorStep: 0.005,
  seatFloorAboveRail: 0.005,
  /**
   * An item counts as down in its slot when it can be brought to within this of where it would
   * rest on the two rails alone (a large plate hangs below the rail tops between them).
   */
  seatOnRail: 0.003,
  /**
   * Standing a cup, a mug or a glass on a sloped rest along a side wall (`list_slots`, slots of
   * kind `cup_rest`). The vessel is held mouth down, tilted towards the wall by the slope of
   * the rest or by `restTiltStep` degrees less, `restTilts` times at most and not under
   * `restTiltMin`; at each tilt it is let down at places `restStep` apart across the rest, from
   * where its upper rim edge is `restOverhang` beyond the ridge out to the wall; the place and
   * tilt at which its centre of mass comes lowest is the seat (the pose of least potential
   * energy among those tried: where it would slide to). `restStartHeight` is how far above the
   * floor of the basket its lowest point starts, `restDeepest` how far below the foot of the
   * rest it is followed, and `restPerch` how far above the ridge its lowest point may end for
   * it to count as standing on the rest. Along the rest, places `restAlongStep` apart are tried from the rear forwards,
   * `restGap` clear of what stands there (`restShelfStep` on from a place a shelf is over), and
   * at most `restTries` of them are tested. A
   * vessel whose body is wider than `restWidthRatio` times the rest (ridge to wall), which is
   * longer with its handle than `restLengthRatio` times the rest, or taller than
   * `restHeightOverWall` times the side wall of the basket is offered no seat: a jug does not
   * sit on the rest, and stemware 200 mm tall leaning there is carried off when the basket is
   * pushed in. [MEASURED 2026-10-11 on the Bosch: glasses up to 150 mm stay within 4 mm through
   * the travel of the basket; a 200 mm wine glass and a 224 mm flute fall.]
   * [ESTIMATED; `rests.test.ts` lets every vessel of the catalogue go at the seat it is offered.]
   */
  restTiltStep: 8,
  restTilts: 3,
  restTiltMin: 10,
  restOverhang: 0.04,
  restStep: 0.006,
  restStepsMax: 20,
  restStartHeight: 0.25,
  restDeepest: 0.02,
  restPerch: 0.01,
  restAlongStep: 0.004,
  restShelfStep: 0.048,
  restGap: 0.004,
  restTries: 10,
  restWidthRatio: 1.15,
  restLengthRatio: 1.4,
  restHeightOverWall: 1.3,
  /** How far a seat known at one place along a rest is lowered to see that it rests there. */
  restTouch: 0.003,
  /**
   * Clearance kept between a vessel on a rest and the front and rear walls of the basket. More
   * than `suggestWallClearance`: the knock of the stop shifts what stands on a rest by up to
   * 3 mm along it at every move of the basket, and a cup seated 4 mm from the rear wall came
   * to press against its wires and was called unstable there. [MEASURED 2026-10-11]
   */
  restEndClearance: 0.01,
  /**
   * A cup shelf that is folded down (`shelfSuggestion`): the vessel is let go with its rim
   * this far above the shelf, clear of the ends of the shelf by `shelfEndClearance`, and is
   * offered a place only when it is no wider than `shelfWidthRatio` of the shelf (a cup whose
   * rim overhangs the edge by a few millimetres stands; a tumbler twice as tall as the shelf
   * is wide is not what the shelf is for, but stands as well). [ESTIMATED]
   */
  shelfDropHeight: 0.002,
  shelfEndClearance: 0.005,
  shelfWidthRatio: 1.05,
} as const;

// ---------------------------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------------------------

/** Options of {@link createSession}. */
export interface SessionOptions {
  /** The level to play. It must pass `validateLevel`; `createSession` throws otherwise. */
  readonly level: Level;
  /**
   * Runs the wash when the cycle is started. Default: {@link placeholderWashRunner}, which
   * simulates nothing.
   */
  readonly washRunner?: WashRunner;
  /** Supplies the thumbnails of `get_item`; without it item records carry none. */
  readonly thumbnails?: (itemId: string) => readonly WireImage[];
  /**
   * Engine settings to change from the loading defaults (`JOLT_SETTINGS`). For tests and for
   * studying one setting; a session that is to replay elsewhere must use the defaults.
   */
  readonly physics?: Partial<JoltWorldSettings>;
  /**
   * How the baskets are pulled out and pushed in. Default: `BASKET_TRAVEL_PROFILES.normal`.
   * `BASKET_TRAVEL_PROFILES.hard` is the careless shove, for studies; a log replays only in a
   * session with the profile it was made with.
   */
  readonly travel?: BasketTravelProfile;
}

/** The session with what the server needs beyond the wire contract. */
export interface GameSession extends Session {
  /** The level being played. */
  readonly level: Level;
  /** The level card, without counting a query. */
  readonly card: LevelCard;
  /** Hash of the canonical scene as it is now. */
  stateHash(): string;
  /** Where the episode stands. */
  phase(): EpisodePhase;
  /** The machine configuration as the player has set it. */
  machineConfig(): MachineConfig;
  /** The machine geometry of the current configuration (baskets pushed in), for drawing. */
  machineGeometry(): MachineGeometry;
  /**
   * Poses in the tub frame, SI, for drawing: of every machine part as it stands now (baskets in
   * or out, door open) and of the item frame of every placed item.
   */
  bodyPoses(): {
    readonly parts: { readonly [partId: string]: Pose };
    readonly items: { readonly [itemId: string]: Pose };
  };
  /** The scene state as `get_state` returns it, without counting or logging a query. */
  peekState(): SceneState;
  /** The wash in hand or last run: its id, status and progress; null before the first cycle. */
  washJob(): {
    readonly id: string;
    readonly status: 'running' | 'done' | 'failed';
    readonly progress: number;
  } | null;
  /** The manifest of the load being washed or last washed; null before the first cycle. */
  washManifest(): WashManifest | null;
  /** Resolves when no wash is running (at once if none is). Never rejects. */
  washSettled(): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------------------------

interface ItemDef {
  readonly id: string;
  readonly level: LevelItem;
  readonly instance: ItemInstance;
  readonly pieces: readonly CollisionPiece[];
  readonly presets: ReadonlyMap<string, Quat>;
  readonly record: ItemRecord;
}

interface PlacedItem {
  /** The frame the item was placed in, in which its pose is reported. */
  readonly frame: FrameId;
  /** Result of the stability probe after it last settled. */
  stable: boolean;
}

interface Checkpoint {
  readonly snapshot: Uint8Array;
  readonly placed: Map<string, PlacedItem>;
  readonly positions: Map<string, RackPosition>;
  readonly config: MachineConfig;
  readonly scene: MachineScene;
}

interface WashJob {
  readonly id: string;
  status: 'running' | 'done' | 'failed';
  progress: number;
  report?: WashReport;
  error?: string;
  settled: Promise<void>;
}

/** What a basket travel did to the load (the session's own form of a rack travel result). */
interface TravelOutcome {
  /**
   * Riders that ended more than 1 mm or 1 degree from where they were on the basket; with
   * `pushedBy`, the parts that do not travel with the basket (the tub, the door, what is in
   * the other basket) which the rider was pressed against on the way, sorted.
   */
  readonly moved: readonly {
    id: string;
    displacement: number;
    rotation: number;
    pushedBy?: readonly string[];
  }[];
  /** Riders whose reference point left the envelope of the basket, sorted. */
  readonly fellOut: readonly string[];
  /** What stopped the basket before the end of its travel, if anything. */
  readonly blockedBy?: string;
}

/** How the world came to rest after an action (see `SessionImpl.rest`). */
interface Rested {
  /** Simulated time, seconds. */
  readonly time: number;
  /** True when everything met the rest criterion. */
  readonly atRest: boolean;
  /** Placed items still more than 0.5 mm inside something, sorted. */
  readonly penetrating: readonly string[];
}

/** Where an item is let go so that it stands in a slot between tines, in the rack frame. */
/**
 * The seats of the empty machine worked out so far in this process, by machine specification
 * and then by configuration, basket positions, type of item and slot (`seatIn`). A seat is a
 * function of those alone, so that a second session on the same machine (the server keeps many)
 * does not search again: the search of one rack for one type of item costs 0.1 to 2 s the first
 * time and a few milliseconds afterwards. [MEASURED 2026-10-10: `scripts/targets.ts`.]
 */
/** The points of the surface mesh of an item's shape (x, y, z in turn, item frame), per shape. */
const SURFACE_POINTS = new WeakMap<Shape, ArrayLike<number>>();

const SEATS_BY_MACHINE = new WeakMap<
  MachineSpec,
  Map<string, { seat: Seat | null; blockedBy?: string }>
>();

/**
 * With {@link SEATS_BY_MACHINE}: the lean at which a type of item is seated in a kind of slot
 * of the empty machine, which is what is tried first in every other slot of the kind; or in
 * how many slots of the kind it has been searched for in full and found no seat (`none`). After
 * `SESSION_PARAMETERS.seatKindFails` such slots the kind is taken to have no seat for it. Kept with the seats, so that a slot is searched from the same start
 * whichever session comes to it first.
 */
const SEAT_HINTS_BY_MACHINE = new WeakMap<
  MachineSpec,
  Map<string, { leanDeg: number; shift: number; floor: boolean } | { none: number }>
>();

/**
 * With {@link SEATS_BY_MACHINE}: the seat of a type of vessel on a side rest of the empty
 * machine, by configuration, basket positions, type of item, rest and place along the rest
 * (`restSeatAt`); null where it has none.
 */
const REST_SEATS_BY_MACHINE = new WeakMap<MachineSpec, Map<string, RestSeat | null>>();

/** Where a vessel is let go so that it stands on a sloped side rest, in the rack frame. */
interface RestSeat {
  /** Its tilt from mouth down towards the wall, whole degrees. */
  readonly tiltDeg: number;
  readonly orientation: {
    readonly preset: string;
    readonly roll_deg: number;
    readonly yaw_deg: number;
  };
  /** The same as a rotation, item frame to rack frame. */
  readonly q: Quat;
  /** Reference-point position on the grid `place` takes, metres. */
  readonly position: Vec3;
  /** Where the origin of the item frame is then, metres. */
  readonly origin: Vec3;
  /** The bounding box of the vessel at that pose, rack frame, metres. */
  readonly box: { readonly min: Vec3; readonly max: Vec3 };
  /** True when the seat was found with the shelves of the basket left out (it is under one). */
  readonly underShelf?: boolean;
}

interface Seat {
  /** Lean of the item from the vertical, whole degrees (negative: tipped forward). */
  readonly leanDeg: number;
  /** Reference-point position, metres. */
  readonly position: Vec3;
  /** False when the item does not come down to the rails and was put above the tine tips. */
  readonly seated: boolean;
  /** The direction it comes down along (tub frame), when that is known to be free. */
  readonly along?: Vec3;
  /** How far across the row from the middle between the rails it stands, metres. */
  readonly shift?: number;
  /**
   * True when it stands on the floor of the basket beside the rails, where it comes lowest
   * across the row, and not on the two rails (`findSeat` with `onFloor`).
   */
  readonly floor?: boolean;
}

/**
 * Thrown inside an action when the engine has left an item at a position that is not a number
 * (seen on 2026-10-10: a roasting tin let go upside down onto a pile of plates and glasses
 * thrown in at random, and nineteen items had no position afterwards). Like the engine's
 * contact capacity it becomes a `physics_limit` rejection: everything is put back as it was and
 * nothing is charged.
 */
class NonFiniteError extends Error {
  constructor(id: string) {
    super(`the physics engine lost the position of ${id}`);
  }
}

/** Whether an error inside an action is the engine giving up on the load. */
function isPhysicsLimit(error: unknown): boolean {
  return error instanceof ContactCapacityError || error instanceof NonFiniteError;
}

/** Thrown inside an action when the load physically blocks it; becomes a `blocked` rejection. */
class BlockedError extends Error {
  readonly by: readonly string[];
  constructor(by: readonly string[]) {
    super(`blocked by ${by.join(', ')}`);
    this.by = by;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mm(metres: number): number {
  return roundToGrid(metres * 1000, 10);
}

function v3mm(v: Vec3): readonly [number, number, number] {
  return [mm(v[0]), mm(v[1]), mm(v[2])];
}

function toJson(value: unknown): JsonValue {
  if (value === undefined) return {};
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return null;
  }
}

/** The result without its images, for the digest of the action log. */
function withoutImages(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutImages);
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (key === 'thumbnails' || key === 'image' || key === 'image_after') continue;
    out[key] = withoutImages(value[key]);
  }
  return out;
}

class SessionImpl implements GameSession {
  readonly level: Level;
  readonly card: LevelCard;
  private readonly world: JoltPhysicsWorld;
  private readonly spec: MachineSpec;
  private readonly washRunner: WashRunner;
  private readonly thumbnails: ((itemId: string) => readonly WireImage[]) | undefined;
  private readonly items = new Map<string, ItemDef>();
  private readonly itemIds: readonly string[];
  private readonly travelProfile: BasketTravelProfile;
  /**
   * The seat of a type of item in each slot of the empty machine (null: none, with what stood
   * in the way if that was a part of the machine), by slot.
   */
  private readonly slotSeats = new Map<string, { seat: Seat | null; blockedBy?: string }>();
  /**
   * Within one `list_slots`: what the seats of the empty machine depend on besides the type of
   * item and the slot, as text: the configuration and where every basket is.
   */
  private sceneKey = '';
  /** Within one `list_slots`: the direction the last free seat was reached along. */
  private lastApproach: Vec3 | undefined;
  /**
   * Within one `list_slots`: the seats already worked out, by the tines and the place across
   * the row they belong to. The two rows of a pair whose tines stand opposite each other (R1
   * and R2) list the same seat twice.
   */
  private seatMemo = new Map<
    string,
    { seat: Seat | null; free: boolean; blockedBy: readonly string[] }
  >();
  /**
   * Within one `list_slots`: where the lower edge of every placed item is, in the frame of the
   * rack asked about (the middle of its lowest few millimetres).
   */
  private lowerEdges: { id: string; at: Vec3; origin: Vec3 }[] = [];
  private config: MachineConfig;
  private scene: MachineScene;
  private placed = new Map<string, PlacedItem>();
  private positions = new Map<string, RackPosition>();
  private readonly log: ActionLogEvent[] = [];
  private actionsUsed = 0;
  private queriesUsed = 0;
  private washesUsed = 0;
  private episodePhase: EpisodePhase = 'loading';
  private job: WashJob | null = null;
  private manifest: WashManifest | null = null;
  private disposed = false;
  /** True while the closing door is a body of the world (during a mechanical check). */
  private doorShut = false;

  constructor(options: SessionOptions, world: JoltPhysicsWorld) {
    const { level } = options;
    this.level = level;
    this.world = world;
    this.washRunner = options.washRunner ?? placeholderWashRunner;
    this.thumbnails = options.thumbnails;
    this.travelProfile = options.travel ?? BASKET_TRAVEL_PROFILES.normal;
    const { spec, config } = levelMachine(level);
    this.spec = spec;
    const geometry = buildMachineGeometry(spec, config);
    this.config = geometry.config;
    this.scene = buildMachineScene(spec, geometry);
    this.card = levelCard(level, geometry);

    const floor = kitchenFloorPieces();
    world.addBody(
      KITCHEN_FLOOR_ID,
      floor.pieces,
      NO_MASS,
      { material: KITCHEN_FLOOR_MATERIAL },
      floor.pose,
      'static',
    );
    for (const assembly of this.scene.assemblies) {
      this.positions.set(assembly.basketId, this.startPosition(assembly));
    }
    for (const body of this.scene.bodies) this.addMachineBody(body);

    const reserved = new Set<string>([
      KITCHEN_FLOOR_ID,
      DOOR_CLOSING_ID,
      ...this.scene.bodies.map((b) => b.id),
    ]);
    for (const item of level.items) {
      if (reserved.has(item.id)) {
        throw new RangeError(`session: item id '${item.id}' is the name of a part of the machine`);
      }
      const instance = instantiate(item.itemType);
      this.items.set(item.id, {
        id: item.id,
        level: item,
        instance,
        pieces: collisionPiecesOf(instance.shape),
        presets: new Map(instance.stablePoses.map((pose) => [pose.name, pose.q])),
        record: itemRecord(item),
      });
    }
    this.itemIds = [...this.items.keys()].sort(compareIds);
  }

  // -------------------------------------------------------------------------------------------
  // The machine in the world
  // -------------------------------------------------------------------------------------------

  /** Where the level starts a basket: as it says, else the lowest basket out and the others in. */
  private startPosition(assembly: RackAssembly): RackPosition {
    const lowest = this.scene.assemblies[0]?.basketId;
    return this.level.racks[assembly.rack] ?? (assembly.basketId === lowest ? 'out' : 'in');
  }

  private assemblyOf(basketId: string | null): RackAssembly | undefined {
    return this.scene.assemblies.find((a) => a.basketId === basketId);
  }

  /** Where a machine body stands for the current rack positions. */
  private machineBodyPose(body: MachineBody): Pose {
    const assembly = this.assemblyOf(body.basketId);
    if (assembly === undefined || this.positions.get(assembly.basketId) !== 'out') {
      return body.poseIn;
    }
    return poseShifted(body.poseIn, assembly.travel);
  }

  private addMachineBody(body: MachineBody, pose: Pose = this.machineBodyPose(body)): void {
    this.world.addBody(
      body.id,
      body.pieces,
      NO_MASS,
      { material: body.part.material },
      pose,
      body.kind,
    );
  }

  private machineIds(): string[] {
    return [
      KITCHEN_FLOOR_ID,
      ...(this.doorShut ? [DOOR_CLOSING_ID] : []),
      ...this.scene.bodies.map((b) => b.id),
    ];
  }

  /** Takes the closing door of a mechanical check out of the world again. */
  private openDoor(): void {
    if (!this.doorShut) return;
    this.world.removeBody(DOOR_CLOSING_ID);
    this.doorShut = false;
  }

  /**
   * Closes the door on the load: the door, as a kinematic body, is pushed shut over the last
   * stretch of its travel like a rack is pushed in. Light things that lean out of a basket are
   * pushed back; something that resists stops the door. The closed door stays in the world
   * until `openDoor`.
   */
  private closeDoor(): { closed: boolean; blockedBy: string[]; pressed: readonly string[] } {
    const door = this.scene.door;
    if (door === null) return { closed: true, blockedBy: [], pressed: [] };
    const P = SESSION_PARAMETERS;
    const machine = this.machineIds();
    let approach: number | undefined;
    let inTheWay: readonly string[] = [];
    for (const back of P.doorApproach) {
      const overlap = this.world.penetration(
        door.pieces,
        poseShifted(door.closed, [0, -back, 0]),
        machine,
      );
      if (overlap.depth <= P.penetrationTolerance) {
        approach = back;
        break;
      }
      inTheWay = overlap.with;
    }
    if (approach === undefined) {
      return {
        closed: false,
        blockedBy: inTheWay.map((id) => this.nameOf(id)).sort(compareIds),
        pressed: [],
      };
    }
    this.world.addBody(
      DOOR_CLOSING_ID,
      door.pieces,
      NO_MASS,
      { material: door.material },
      poseShifted(door.closed, [0, -approach, 0]),
      'kinematic',
    );
    this.doorShut = true;
    const travel = driveBasket(this.world, {
      racks: [DOOR_CLOSING_ID],
      travel: [0, approach, 0],
      riders: [],
      distances: basketTravelDistances(approach, P.doorProfile, this.world.timeStep),
    });
    this.rest();
    // The items the door itself pressed on as it closed.
    const pressed = [
      ...new Set(travel.pressed.map((press) => press.against).filter((id) => this.items.has(id))),
    ].sort(compareIds);
    return travel.blockedBy === undefined
      ? { closed: true, blockedBy: [], pressed }
      : { closed: false, blockedBy: [this.nameOf(travel.blockedBy)], pressed };
  }

  /** Ids of the bodies fixed to the tub (and the floor): everything that is not a basket. */
  private fixedIds(): string[] {
    return [
      KITCHEN_FLOOR_ID,
      ...this.scene.bodies.filter((b) => b.kind === 'static').map((b) => b.id),
    ];
  }

  private frameExists(frame: FrameId): boolean {
    return frame === 'tub' || this.scene.bodies.some((b) => b.id === frame);
  }

  private framePose(frame: FrameId): Pose {
    return frame === 'tub' ? POSE_IDENTITY : this.world.getPose(frame);
  }

  private nameOf(bodyId: string, part?: string): string {
    if (this.items.has(bodyId) || bodyId === KITCHEN_FLOOR_ID) return bodyId;
    return part === undefined ? bodyId : machineContactName(bodyId, part);
  }

  /**
   * What a pose overlaps, as a refusal names it: items by their id, parts of the machine as
   * contacts name them (`upper_rack_fittings.shelf.cup_rear`, not only `upper_rack_fittings`:
   * a player who is told which shelf is in the way can fold that one). Sorted, each once.
   */
  private namesOf(overlap: {
    readonly with: readonly string[];
    readonly parts: readonly string[];
  }): string[] {
    return [...new Set(overlap.with.map((id, i) => this.nameOf(id, overlap.parts[i])))].sort(
      compareIds,
    );
  }

  /** Displacement of a basket from its pushed-in position, as the world has it now. */
  private basketOffset(assembly: RackAssembly): Vec3 {
    const body = this.scene.bodies.find((b) => b.id === assembly.rack);
    if (body === undefined) return [0, 0, 0];
    return v3Sub(this.world.getPose(assembly.rack).p, body.poseIn.p);
  }

  /** The basket that carries an item, read from where the item lies; null if none does. */
  private carrierOf(itemId: string): RackAssembly | null {
    const item = this.items.get(itemId) as ItemDef;
    const reference = referencePointOf(this.world.getPose(itemId), item.instance.referencePoint);
    const margin = SESSION_PARAMETERS.riderPlanMargin;
    // Highest basket first: what lies in the upper basket is above the lower one too.
    for (let i = this.scene.assemblies.length - 1; i >= 0; i--) {
      const assembly = this.scene.assemblies[i] as RackAssembly;
      const local = v3Sub(reference, this.world.getPose(assembly.rack).p);
      if (
        local[0] >= -margin &&
        local[0] <= assembly.outline[0] + margin &&
        local[1] >= -margin &&
        local[1] <= assembly.outline[1] + margin &&
        local[2] >= -SESSION_PARAMETERS.riderFloorMargin &&
        local[2] <= assembly.height + SESSION_PARAMETERS.riderHeightMargin
      ) {
        return assembly;
      }
    }
    return null;
  }

  private ridersOf(assembly: RackAssembly): string[] {
    return [...this.placed.keys()]
      .sort(compareIds)
      .filter((id) => this.carrierOf(id)?.basketId === assembly.basketId);
  }

  /** Whether a tub-frame point is inside the tub. */
  private insideTub(point: Vec3): boolean {
    const tub = this.spec.tub;
    return (
      point[0] >= tub.x[0] &&
      point[0] <= tub.x[1] &&
      point[1] >= tub.y[0] &&
      point[1] <= tub.y[1] &&
      point[2] >= tub.z[0] &&
      point[2] <= tub.z[1]
    );
  }

  /** Where a placed item lies now. */
  private locationOf(itemId: string): ItemLocation {
    const carrier = this.carrierOf(itemId);
    // An item that hangs through the floor of a basket and stands on what is underneath is where
    // it stands, not in the basket.
    if (carrier !== null && !this.standsThrough(itemId, carrier)) {
      return carrier.rack === 'upper_rack' ? 'upper_rack' : 'lower_rack';
    }
    const item = this.items.get(itemId) as ItemDef;
    const reference = referencePointOf(this.world.getPose(itemId), item.instance.referencePoint);
    return this.insideTub(reference) ? 'tub_floor' : 'outside';
  }

  /** Whether a placed item touches a part fixed to the tub, the open door or the kitchen floor. */
  private touchesFixed(itemId: string): boolean {
    const fixed = new Set(this.fixedIds());
    return this.world
      .contacts({ bodies: [itemId] })
      .some((c) => fixed.has(c.a === itemId ? c.b : c.a));
  }

  /**
   * Whether a placed item hangs through the floor of the basket that carries it and stands on
   * what is underneath: its lowest point is below the base grid by more than the rider margin
   * and it touches something fixed (the tub, the door).
   */
  private standsThrough(itemId: string, carrier: RackAssembly): boolean {
    const item = this.items.get(itemId) as ItemDef;
    const box = boundingBox(
      item.instance.shape,
      poseRelative(this.world.getPose(carrier.rack), this.world.getPose(itemId)),
    );
    return box.min[2] < -SESSION_PARAMETERS.riderFloorMargin && this.touchesFixed(itemId);
  }

  /**
   * Takes back to the counter every placed item that has reached the kitchen floor (or has left
   * the surroundings of the machine altogether) and returns their ids, sorted. Called once the
   * world has settled after an action: nothing stays on the floor, so nothing there is listed
   * as loaded, washed, or keeps the world awake.
   */
  private returnStrays(): string[] {
    const tub = this.spec.tub;
    const far = SESSION_PARAMETERS.strayDistance;
    const returned: string[] = [];
    for (const id of [...this.placed.keys()].sort(compareIds)) {
      const p = this.world.getPose(id).p;
      const gone =
        p[0] < tub.x[0] - far ||
        p[0] > tub.x[1] + far ||
        p[1] < tub.y[0] - far ||
        p[1] > tub.y[1] + far ||
        p[2] < KITCHEN_FLOOR_Z - 0.2 ||
        p[2] > tub.z[1] + far;
      const onFloor =
        gone ||
        this.world
          .contacts({ bodies: [id] })
          .some((c) => (c.a === id ? c.b : c.a) === KITCHEN_FLOOR_ID);
      if (!onFloor) continue;
      this.world.removeBody(id);
      this.placed.delete(id);
      returned.push(id);
    }
    return returned;
  }

  // -------------------------------------------------------------------------------------------
  // Checkpoints
  // -------------------------------------------------------------------------------------------

  private checkpoint(): Checkpoint {
    const placed = new Map<string, PlacedItem>();
    for (const [id, item] of this.placed) placed.set(id, { ...item });
    return {
      snapshot: this.world.snapshot(),
      placed,
      positions: new Map(this.positions),
      config: this.config,
      scene: this.scene,
    };
  }

  /**
   * Puts the world and the session back exactly as they were at the checkpoint. With
   * `rebuild`, every body of the machine and every item is first taken out of the world and
   * put in again: after the engine has lost the position of a body (`NonFiniteError`) its
   * own bookkeeping of where bodies are is not to be trusted, and restoring the poses alone
   * left a world in which 66 items of a load then failed to come to rest. [MEASURED
   * 2026-10-10, dinner-party-random.]
   */
  private rollback(saved: Checkpoint, rebuild = false): void {
    this.openDoor();
    for (const id of [...this.placed.keys()]) {
      if (!saved.placed.has(id)) this.world.removeBody(id);
    }
    for (const id of saved.placed.keys()) {
      if (this.placed.has(id)) continue;
      const item = this.items.get(id) as ItemDef;
      // The snapshot gives it its pose back; any pose will do until then.
      this.world.addBody(
        id,
        item.pieces,
        item.instance.mass,
        item.instance.contact,
        POSE_IDENTITY,
        'dynamic',
      );
    }
    if (this.scene !== saved.scene) {
      this.slotSeats.clear();
      const before = new Map(saved.scene.bodies.map((b) => [b.id, b]));
      for (const body of this.scene.bodies) {
        if (before.get(body.id) !== body) this.world.removeBody(body.id);
      }
      const now = new Map(this.scene.bodies.map((b) => [b.id, b]));
      for (const body of saved.scene.bodies) {
        if (now.get(body.id) !== body) this.addMachineBody(body, body.poseIn);
      }
    }
    this.placed = saved.placed;
    this.positions = saved.positions;
    this.config = saved.config;
    this.scene = saved.scene;
    if (rebuild) {
      for (const body of this.scene.bodies) {
        this.world.removeBody(body.id);
        this.addMachineBody(body, body.poseIn);
      }
      for (const id of [...this.placed.keys()].sort(compareIds)) {
        const item = this.items.get(id) as ItemDef;
        this.world.removeBody(id);
        this.world.addBody(
          id,
          item.pieces,
          item.instance.mass,
          item.instance.contact,
          POSE_IDENTITY,
          'dynamic',
        );
      }
    }
    this.world.restore(saved.snapshot);
  }

  // -------------------------------------------------------------------------------------------
  // State, budget and log
  // -------------------------------------------------------------------------------------------

  private rackPositions(): { [rack in RackId]?: RackPosition } {
    const racks: { [rack in RackId]?: RackPosition } = {};
    for (const assembly of this.scene.assemblies) {
      racks[assembly.rack] = this.positions.get(assembly.basketId) ?? 'in';
    }
    return racks;
  }

  private rackOptionValues(): { [key: string]: string } {
    const values: { [key: string]: string } = {};
    for (const option of rackOptions(this.spec, this.config)) {
      values[`${option.rack}.${option.name}`] = option.value;
    }
    return values;
  }

  stateHash(): string {
    return canonicalHash({
      physics: this.world.stateHash(),
      racks: this.rackPositions(),
      rack_options: this.rackOptionValues(),
      placed: [...this.placed.keys()]
        .sort(compareIds)
        .map((id) => [id, this.placed.get(id)?.frame]),
    });
  }

  phase(): EpisodePhase {
    return this.episodePhase;
  }

  private budget(): BudgetState {
    return {
      actions_max: this.level.rules.actionsMax,
      queries_max: this.level.rules.queriesMax,
      washes_max: this.level.rules.washesMax,
      actions_used: this.actionsUsed,
      queries_used: this.queriesUsed,
      washes_used: this.washesUsed,
    };
  }

  private wirePoseOf(itemId: string, frame: FrameId): WirePose {
    const item = this.items.get(itemId) as ItemDef;
    return toWirePose(
      frame,
      this.framePose(frame),
      this.world.getPose(itemId),
      item.instance.referencePoint,
    );
  }

  /** Contacts of one item by what it touches, sorted by `with`. */
  private contactsOf(itemId: string, withForce: boolean): ContactSummary[] {
    const byName = new Map<string, { points: number; force: number }>();
    for (const contact of this.world.contacts({ bodies: [itemId] })) {
      const other = contact.a === itemId ? contact.b : contact.a;
      const part = contact.a === itemId ? contact.partB : contact.partA;
      const name = this.nameOf(other, part);
      const sum = byName.get(name) ?? { points: 0, force: 0 };
      sum.points += contact.points;
      sum.force += contact.normalForceN;
      byName.set(name, sum);
    }
    return [...byName.keys()].sort(compareIds).map((name) => {
      const sum = byName.get(name) as { points: number; force: number };
      return withForce
        ? { with: name, points: sum.points, normal_force_N: roundToGrid(sum.force, 100) }
        : { with: name, points: sum.points };
    });
  }

  private sceneState(): SceneState {
    const placed: PlacedItemState[] = [...this.placed.keys()].sort(compareIds).map((id) => {
      const item = this.placed.get(id) as PlacedItem;
      return {
        ...this.wirePoseOf(id, item.frame),
        item_id: id,
        stable: item.stable,
        contacts: this.contactsOf(id, false),
        location: this.locationOf(id),
      };
    });
    return {
      state_hash: this.stateHash(),
      phase: this.episodePhase,
      racks: this.rackPositions(),
      rack_options: this.rackOptionValues(),
      placed,
      unplaced: this.itemIds.filter((id) => !this.placed.has(id)),
      budget: this.budget(),
    };
  }

  private record(
    kind: 'action' | 'query',
    name: ActionName | QueryName,
    args: unknown,
    result: { readonly accepted: boolean } | object,
  ): void {
    this.log.push({
      seq: this.log.length,
      kind,
      name,
      args: toJson(args),
      accepted: !('accepted' in result) || result.accepted === true,
      result_digest: canonicalHash(withoutImages(result)),
      state_hash: this.stateHash(),
      budget: this.budget(),
    });
  }

  /**
   * Runs a state-changing action. A contact-capacity failure of the engine or a physical block
   * puts everything back and becomes a free rejection.
   */
  private act<R extends { readonly accepted: boolean }>(
    name: ActionName,
    args: unknown,
    run: () => R,
    blocked: (by: readonly string[]) => R,
    tooDense: () => R,
  ): R {
    this.assertLive();
    const saved = this.checkpoint();
    let result: R;
    try {
      result = run();
    } catch (error) {
      if (error instanceof BlockedError) {
        this.rollback(saved);
        result = blocked(error.by);
      } else if (isPhysicsLimit(error)) {
        this.rollback(saved, error instanceof NonFiniteError);
        result = tooDense();
      } else {
        throw error;
      }
    }
    this.record('action', name, args, result);
    return result;
  }

  /**
   * Runs a query. A charged query is refused once the cap is reached; `preview` is not charged
   * (a rejected `place` gives the same facts for nothing, so a cap on it would only bind the
   * player who asks first), but it is logged like every other query.
   */
  private ask<R extends { readonly accepted: boolean }>(
    name: QueryName,
    args: unknown,
    run: () => R,
    refused: (reason: QueryRejectReason) => R,
    charged = true,
  ): R {
    this.assertLive();
    let result: R;
    if (charged && this.queriesUsed >= this.level.rules.queriesMax) {
      result = refused('query_budget_exhausted');
    } else {
      result = run();
      if (charged && result.accepted) this.queriesUsed += 1;
    }
    this.record('query', name, args, result);
    return result;
  }

  private assertLive(): void {
    if (this.disposed) throw new Error('session: used after dispose()');
  }

  // -------------------------------------------------------------------------------------------
  // Motion bookkeeping
  // -------------------------------------------------------------------------------------------

  /** Pose of every placed item in the frame it is reported in. */
  private reportedPoses(): Map<string, Pose> {
    const poses = new Map<string, Pose>();
    for (const [id, item] of this.placed) {
      poses.set(id, poseRelative(this.framePose(item.frame), this.world.getPose(id)));
    }
    return poses;
  }

  /** Items that ended more than 1 mm or 1 degree from where they were, sorted by id. */
  private movedSince(before: ReadonlyMap<string, Pose>, except?: string): MovedItem[] {
    const moved: MovedItem[] = [];
    const after = this.reportedPoses();
    for (const id of [...before.keys()].sort(compareIds)) {
      if (id === except) continue;
      const now = after.get(id);
      const was = before.get(id) as Pose;
      if (now === undefined) continue;
      const displacement = v3Distance(was.p, now.p);
      const rotation = quatAngleBetween(was.q, now.q);
      if (
        displacement > SESSION_PARAMETERS.movedDistance ||
        rotation > SESSION_PARAMETERS.movedAngle
      ) {
        moved.push({
          item_id: id,
          displacement_mm: mm(displacement),
          rotation_deg: roundToGrid(radToDeg(rotation), 10),
        });
      }
    }
    return moved;
  }

  /**
   * Lets the world come to rest after an action, and judges what the action touched.
   *
   * In three stages. First everything comes to rest undisturbed. Then every item that is awake
   * (the new item and whatever it or the action moved; what sleeps was not touched) is given
   * the standard disturbance of a settle, a light nudge: gravity tilted by one degree towards
   * four sides in turn. What only balanced falls now, in the action that put it there, and
   * its pose afterwards is the one reported. An item the nudge moved by more than the
   * tolerance is nudged once more where it lies: `stable` is whether the last nudge it was
   * given left it where it was. An item that sleeps through the action keeps its verdict.
   */
  private rest(): Rested {
    const dt = this.world.timeStep;
    const nudged = settleOptionsFor(dt);
    const calm = {
      ...settleOptionsFor(dt, false),
      restHoldSteps: nudged.disturbance?.calmSteps ?? 12,
    };
    // What the action touches: whatever is awake before or after it comes to rest, and whatever
    // has moved in between (an item that was knocked and fell asleep again).
    const ids = [...this.placed.keys()].sort(compareIds);
    const start = new Map(ids.map((id) => [id, this.world.getPose(id)]));
    const touched = new Set(ids.filter((id) => this.world.isActive(id)));
    const first = this.world.settle(calm);
    this.assertFinite(ids);
    for (const id of ids) {
      if (this.world.isActive(id)) touched.add(id);
      else if (!touched.has(id)) {
        const was = start.get(id) as Pose;
        const now = this.world.getPose(id);
        if (v3Distance(was.p, now.p) > 1e-6 || quatAngleBetween(was.q, now.q) > 1e-5) {
          touched.add(id);
        }
      }
    }
    const awake = ids.filter((id) => touched.has(id));
    let time = first.time;
    if (!first.atRest) {
      // Something rolls on after ten seconds: it is not stable, nor is what overlaps something.
      // What the action touched and has itself come to rest is not nudged this time (a nudge
      // cannot end while its neighbour moves) and counts as stable. Until 2026-10-10 evening
      // everything awake was called unstable, and one item jittering in a pile of 67 had the
      // random policy take the whole pile out (`dinner-party-random` ended with one item).
      const restless = new Set([...first.moving, ...first.penetrating]);
      for (const id of awake) (this.placed.get(id) as PlacedItem).stable = !restless.has(id);
      return {
        time,
        atRest: false,
        penetrating: first.penetrating.filter((id) => this.placed.has(id)),
      };
    }
    const tolerance = SESSION_PARAMETERS.stable;
    const posesOf = (ids: readonly string[]): Map<string, Pose> =>
      new Map(ids.map((id) => [id, this.world.getPose(id)]));
    const shifted = (ids: readonly string[], from: ReadonlyMap<string, Pose>): string[] =>
      ids.filter((id) => {
        const was = from.get(id) as Pose;
        const now = this.world.getPose(id);
        return (
          v3Distance(was.p, now.p) > tolerance.positionTolerance ||
          quatAngleBetween(was.q, now.q) > tolerance.angleTolerance
        );
      });
    let before = posesOf(awake);
    for (const id of awake) if (!this.world.isActive(id)) this.world.applyImpulse(id, [0, 0, 0]);
    let last = this.world.settle(nudged);
    time += last.time;
    let unsteady = shifted(awake, before);
    if (unsteady.length > 0 && last.atRest) {
      before = posesOf(unsteady);
      for (const id of unsteady) this.world.applyImpulse(id, [0, 0, 0]);
      last = this.world.settle(nudged);
      time += last.time;
      unsteady = shifted(unsteady, before);
    }
    const restless = new Set([...last.moving, ...last.penetrating, ...unsteady]);
    for (const id of awake) {
      (this.placed.get(id) as PlacedItem).stable = !restless.has(id) && !this.balances(id);
    }
    this.assertFinite(ids);
    return {
      time,
      atRest: last.atRest,
      penetrating: last.penetrating.filter((id) => this.placed.has(id)),
    };
  }

  /**
   * Whether an item at rest only balances: it touches nothing sideways, and the base it stands
   * on (the convex outline, seen from above, of its points of contact) is so narrow under its
   * centre of mass that a tilt of `balanceMargin` would carry the centre of mass past its edge.
   * A board on its edge, a plate on its rim on the open floor, a knife on its handle end. The
   * margin of an item is atan(d / h): d the distance in plan from the centre of mass to the
   * nearest edge of the base, h its height above the points of contact.
   */
  private balances(itemId: string): boolean {
    const P = SESSION_PARAMETERS;
    const item = this.items.get(itemId) as ItemDef;
    const pose = this.world.getPose(itemId);
    const com = v3Add(pose.p, quatRotate(pose.q, item.instance.mass.com));
    const base: (readonly [number, number])[] = [];
    let height = 0;
    for (const point of this.world.contactPoints({ bodies: [itemId] })) {
      // What it touches and what it would touch after rocking by half a millimetre.
      if (!point.touching && point.gap > P.balanceReach) continue;
      if (Math.abs(point.normal[2]) < P.balanceSideContact) return false;
      const at = point.a === itemId ? point.positionA : point.positionB;
      base.push([at[0], at[1]]);
      height += at[2];
    }
    if (base.length === 0) return false;
    const h = com[2] - height / base.length;
    if (!(h > 0)) return false;
    // The convex outline of the base (monotone chain) and how far inside it the centre of mass
    // is; nothing when the points lie on a line or the centre of mass is outside.
    const sorted = [...base].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (
      o: readonly [number, number],
      a: readonly [number, number],
      b: readonly [number, number],
    ): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (
      points: readonly (readonly [number, number])[],
    ): (readonly [number, number])[] => {
      const out: (readonly [number, number])[] = [];
      for (const point of points) {
        while (
          out.length >= 2 &&
          cross(
            out[out.length - 2] as readonly [number, number],
            out[out.length - 1] as readonly [number, number],
            point,
          ) <= 0
        ) {
          out.pop();
        }
        out.push(point);
      }
      out.pop();
      return out;
    };
    const outline = [...half(sorted), ...half([...sorted].reverse())];
    let inside = outline.length >= 3 ? Infinity : 0;
    for (let i = 0; i < outline.length && outline.length >= 3; i++) {
      const a = outline[i] as readonly [number, number];
      const b = outline[(i + 1) % outline.length] as readonly [number, number];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-9) continue;
      inside = Math.min(inside, cross(a, b, [com[0], com[1]]) / length);
    }
    return Math.atan2(Math.max(0, inside) + P.balanceReach, h) < P.balanceMargin;
  }

  /** Throws {@link NonFiniteError} when the engine has lost the pose of one of the items. */
  private assertFinite(ids: readonly string[]): void {
    for (const id of ids) {
      const pose = this.world.getPose(id);
      if (![...pose.p, ...pose.q].every((value) => Number.isFinite(value))) {
        throw new NonFiniteError(id);
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Candidate poses (place and preview)
  // -------------------------------------------------------------------------------------------

  /**
   * Whether a reference-point position is inside the envelope of its frame. The tub frame
   * reaches from wall to wall, from the floor to the roof and out over the open door; a basket
   * frame covers the basket's plan. Nothing may be asked for above the roof of the tub.
   */
  private inBounds(frame: FrameId, position: Vec3): boolean {
    const [x, y, z] = position;
    const tub = this.spec.tub;
    if (frame === 'tub') {
      const reach = Math.max(0, ...this.scene.assemblies.map((a) => v3Length(a.travel))) + 0.1;
      return (
        x >= tub.x[0] &&
        x <= tub.x[1] &&
        y >= tub.y[0] - reach &&
        y <= tub.y[1] &&
        z >= tub.z[0] &&
        z <= tub.z[1]
      );
    }
    let size: readonly [number, number];
    if (frame === 'cutlery_basket') {
      const basket = this.spec.cutleryBasket;
      if (basket === null) return false;
      // The basket's frame has +y along its long side.
      size = [basket.size[1], basket.size[0]];
    } else {
      const assembly = this.scene.assemblies.find((a) => a.rack === frame);
      if (assembly === undefined) return false;
      size = assembly.outline;
    }
    const framePose = this.framePose(frame);
    const height = framePose.p[2] + quatRotate(framePose.q, position)[2];
    return (
      x >= 0 &&
      x <= size[0] &&
      y >= 0 &&
      y <= size[1] &&
      z >= -0.1 &&
      z <= 0.7 &&
      height <= tub.z[1]
    );
  }

  /**
   * The basket whose position decides whether a frame can be loaded: the basket itself, or the
   * one the cutlery basket stands in; null for the tub frame.
   */
  private basketOfFrame(frame: FrameId): RackAssembly | null {
    if (frame === 'tub') return null;
    const body = this.scene.bodies.find((b) => b.id === frame);
    return body === undefined ? null : (this.assemblyOf(body.basketId) ?? null);
  }

  /** True when a frame is a basket (or stands in one) that is pushed into the tub. */
  private frameIsIn(frame: FrameId): boolean {
    const assembly = this.basketOfFrame(frame);
    return assembly !== null && this.positions.get(assembly.basketId) !== 'out';
  }

  /** Lowest point of an item's bounding box at a pose, tub-frame z (conservative). */
  private lowestPoint(item: ItemDef, pose: Pose): number {
    const { min, max } = item.instance.bbox;
    let lowest = Infinity;
    for (const x of [min[0], max[0]]) {
      for (const y of [min[1], max[1]]) {
        for (const z of [min[2], max[2]]) {
          lowest = Math.min(lowest, pose.p[2] + quatRotate(pose.q, [x, y, z])[2]);
        }
      }
    }
    return lowest;
  }

  /**
   * The directions, pointing down, along which an item can be let down into a frame: straight
   * down first, then slanted the way the tines of the basket's rows lean, by the lean of the
   * tines, by half and by a quarter of it (a plate goes into its slot along the tines, and
   * between two neighbours along their lean, which is less). `first`, if it is among them, is
   * tried first: the answer of a test is the same in any order, and a sweep is the costly part
   * of a query.
   */
  private approachDirections(frame: FrameId, first?: Vec3): Vec3[] {
    const out: Vec3[] = [[0, 0, -1]];
    const assembly = this.basketOfFrame(frame);
    if (assembly === null) return out;
    // The largest lean of the tines towards each horizontal direction.
    const leans = new Map<string, { toward: Vec3; angle: number }>();
    for (const row of this.scene.geometry.affordances.tineRows) {
      if (row.basketId !== assembly.basketId || row.state !== 'up') continue;
      for (const tine of row.tines) {
        const up = v3Sub(tine.tip, tine.base);
        const flat = Math.hypot(up[0], up[1]);
        if (!(up[2] > 0) || flat < 1e-6) continue;
        const angle = Math.atan2(flat, up[2]);
        if (angle < degToRadians(2)) continue;
        const toward: Vec3 = [Math.round(up[0] / flat) + 0, Math.round(up[1] / flat) + 0, 0];
        const key = `${toward[0]},${toward[1]}`;
        const known = leans.get(key);
        if (known === undefined || angle > known.angle) leans.set(key, { toward, angle });
      }
    }
    const framePose = this.framePose(assembly.rack);
    for (const { toward, angle } of leans.values()) {
      for (const share of [1, 0.5, 0.25]) {
        // Coming down, the item moves against the lean.
        const a = angle * share;
        out.push(
          quatRotate(framePose.q, [
            -toward[0] * Math.sin(a),
            -toward[1] * Math.sin(a),
            -Math.cos(a),
          ]),
        );
      }
    }
    if (first !== undefined) {
      const near = (v: Vec3): boolean => v3Distance(v, first) < 1e-6;
      const at = out.findIndex(near);
      if (at > 0) out.unshift(...out.splice(at, 1));
    }
    return out;
  }

  /**
   * The straight path from above the machine down to a pose: what, if anything, is in the way.
   * A basket is loaded only while it is pulled out; pushed in, it is under the roof of the tub
   * (and nothing is put into it without it having travelled in with its load). The item comes
   * straight down or, where that is not possible, down a slant of up to the lean of the
   * basket's tines (`approachDirections`). For a pulled-out basket the path is tested against
   * the other basket, the fittings and the items only. The shell of the tub is left out: the
   * rear of the basket stays under its roof, where a hand reaches in at a slant. So are the
   * wires of the basket itself: a hand steers a plate round the tip of a tine that leans over
   * its slot, which a straight line cannot (the pose itself must be clear of them like of
   * everything else, and nothing is put under the floor of a basket from above). For the tub
   * frame everything counts, so only what is in front of the tub can be reached from above.
   * When no path is clear, what blocks the way straight down is named.
   */
  private sweepFromAbove(
    item: ItemDef,
    pose: Pose,
    frame: FrameId,
    alsoIgnore: readonly string[] = [],
    first?: Vec3,
  ): { clear: boolean; blockedBy?: string; blockedId?: string; above?: number; along?: Vec3 } {
    if (this.frameIsIn(frame)) return { clear: false, blockedBy: 'tub' };
    const assembly = this.basketOfFrame(frame);
    if (assembly !== null) {
      const reference = referencePointOf(
        poseRelative(this.world.getPose(assembly.rack), pose),
        item.instance.referencePoint,
      );
      if (reference[2] < -SESSION_PARAMETERS.riderFloorMargin) {
        return { clear: false, blockedBy: assembly.rack, blockedId: assembly.rack };
      }
    }
    const sky = this.spec.tub.z[1] + SESSION_PARAMETERS.skyMargin;
    const rise = Math.max(sky - this.lowestPoint(item, pose), SESSION_PARAMETERS.minSweep);
    const ignore = [
      ...(assembly === null ? [KITCHEN_FLOOR_ID] : [...this.fixedIds(), assembly.rack]),
      ...alsoIgnore,
    ];
    let straight: { blockedBy?: string; blockedId?: string; above: number } | null = null;
    let any: { blockedBy?: string; blockedId?: string; above: number } | null = null;
    for (const down of this.approachDirections(frame, first)) {
      const length = rise / -down[2];
      const hit = this.world.sweep(
        item.pieces,
        poseShifted(pose, v3Scale(down, -length)),
        pose,
        ignore,
      );
      if (!hit.hit || (1 - hit.fraction) * length <= SESSION_PARAMETERS.sweepEndTolerance) {
        return { clear: true, along: down };
      }
      const above = (1 - hit.fraction) * rise;
      const found =
        hit.with === undefined
          ? { above }
          : { blockedBy: this.nameOf(hit.with, hit.part), blockedId: hit.with, above };
      any ??= found;
      if (down[0] === 0 && down[1] === 0) straight = found;
    }
    return { clear: false, ...(straight ?? any ?? {}) };
  }

  /**
   * How a settled item rests: the height of its lowest point above the base of the frame it
   * was placed in, whether that is on the base, and its contact forces over its weight.
   */
  private restingOf(
    item: ItemDef,
    frame: FrameId,
    contacts: readonly ContactSummary[],
  ): NonNullable<DropAccepted['resting']> {
    const box = boundingBox(
      item.instance.shape,
      poseRelative(this.framePose(frame), this.world.getPose(item.id)),
    );
    const lowest = frame === 'tub' ? box.min[2] - this.spec.tub.z[0] : box.min[2];
    const weight = item.instance.mass.mass * STANDARD_GRAVITY;
    const force = contacts.reduce((sum, c) => sum + (c.normal_force_N ?? 0), 0);
    return {
      lowest_point_mm: mm(lowest),
      on_base: lowest <= SESSION_PARAMETERS.onBaseHeight,
      force_over_weight: weight > 0 ? roundToGrid(force / weight, 10) : 0,
    };
  }

  /**
   * How far a part of an item at a pose reaches above the underside of the roof of the tub
   * while it is behind the plane of the door liner, where the roof is: metres, 0 when none
   * does. The body of the appliance is there. The roof of the machine geometry is a sheet 2 mm
   * thick with nothing over it, and the overlap of a thin part that passes through a thin
   * sheet is small: the stem of a glass went through it within the tolerance of `place`, the
   * foot above the sheet, and the glass let down from there came to hang by its foot on the
   * roof. [MEASURED 2026-10-11, review of the loading: a 200 mm wine glass asked at upper_rack
   * (425, 415, 190) was accepted and settled with `tub.roof` as its only contact, carrying its
   * whole weight; the same on the tree before the floor was corrected.] Measured on the
   * points of the item's surface mesh (chord error 0.5 mm, as the collision pieces): a part
   * that leans across the plane of the liner counts only with what of it is behind the plane.
   */
  private aboveRoof(item: ItemDef, pose: Pose): number {
    const { tub, door } = this.spec;
    const front = Math.min(door.linerPlaneY, tub.y[0]);
    // Cheaply first: nothing of the item is that high, or it is all in front of the liner.
    const whole = boundingBox(item.instance.shape, pose);
    if (whole.max[2] <= tub.z[1] || whole.max[1] <= front) return 0;
    let points = SURFACE_POINTS.get(item.instance.shape);
    if (points === undefined) {
      points = buildRenderMesh(item.instance.shape, {
        chordError: COLLISION_CHORD_ERROR,
      }).positions;
      SURFACE_POINTS.set(item.instance.shape, points);
    }
    let above = 0;
    for (let i = 0; i < points.length; i += 3) {
      const at = poseTransformPoint(pose, [
        points[i] as number,
        points[i + 1] as number,
        points[i + 2] as number,
      ]);
      if (at[1] <= front || at[1] >= tub.y[1] || at[0] <= tub.x[0] || at[0] >= tub.x[1]) continue;
      above = Math.max(above, at[2] - tub.z[1]);
    }
    return above;
  }

  /** The refusal of a pose that reaches into the body of the appliance above the roof. */
  private roofRefusal(item: ItemDef, pose: Pose, tolerance: number): DropResult | null {
    const above = this.aboveRoof(item, pose);
    if (above <= tolerance) return null;
    return {
      ...reject('collision_at_pose'),
      penetration_mm: roundToGrid(above * 1000, 100),
      colliding_with: [this.nameOf('tub', 'roof')],
    };
  }

  /** The pose after lowering along -z until first contact, leaving the release gap. */
  private lowered(item: ItemDef, pose: Pose): Pose {
    const range = SESSION_PARAMETERS.dropRange;
    const hit = this.world.sweep(item.pieces, pose, poseShifted(pose, [0, 0, -range]));
    const drop = Math.max(0, hit.fraction * range - SESSION_PARAMETERS.releaseGap);
    return poseShifted(pose, [0, 0, -drop]);
  }

  // -------------------------------------------------------------------------------------------
  // place
  // -------------------------------------------------------------------------------------------

  place(request: PlaceRequest): DropResult {
    return this.act<DropResult>(
      'place',
      request,
      () => this.doPlace(request),
      (by) => ({
        ...reject('not_insertable'),
        ...(by[0] === undefined ? {} : { blocked_by: by[0] }),
      }),
      () =>
        reject(
          'physics_limit',
          'the load would be too crowded for the physics engine to simulate reliably',
        ),
    );
  }

  private doPlace(request: PlaceRequest): DropResult {
    if (this.episodePhase !== 'loading') return reject('episode_over');
    if (!isRecord(request) || typeof request.item_id !== 'string') {
      return reject('invalid_argument', 'item_id must be a string');
    }
    const item = this.items.get(request.item_id);
    if (item === undefined) return reject('unknown_item');
    if (this.placed.has(item.id)) return reject('already_placed');
    const frame = request.frame;
    if (!FRAME_IDS.includes(frame) || !this.frameExists(frame)) {
      return reject('invalid_argument', `the machine has no frame '${String(frame)}'`);
    }
    if (!isVec3(request.position_mm)) {
      return reject('invalid_argument', 'position_mm must be three finite numbers');
    }
    const mode = request.mode ?? 'drop';
    if (mode !== 'drop' && mode !== 'insert' && mode !== 'set') {
      return reject('invalid_argument', "mode must be 'drop', 'insert' or 'set'");
    }
    if (mode === 'set' && this.level.rules.exactPlacement !== true) {
      return reject('not_available', "this level does not allow mode 'set' (exact placement)");
    }
    let direction: Vec3 = [0, 0, -1];
    if (request.insert_dir !== undefined) {
      if (!isVec3(request.insert_dir) || v3Length(request.insert_dir) === 0) {
        return reject('invalid_argument', 'insert_dir must be a non-zero vector');
      }
      direction = v3Normalise(request.insert_dir);
    }
    const orientation = resolveOrientation(request.orientation, item.presets);
    if (orientation === null) {
      return reject(
        'invalid_argument',
        'orientation must be a known preset or a non-zero quaternion',
      );
    }
    if (this.actionsUsed >= this.level.rules.actionsMax) return reject('budget_exhausted');

    const position =
      mode === 'set' ? finePosition(request.position_mm) : quantisePosition(request.position_mm);
    if (!this.inBounds(frame, position.m)) return reject('out_of_bounds');
    const framePose = this.framePose(frame);
    const pose = bodyPoseInTub(
      framePose,
      position.m,
      orientation.unit,
      item.instance.referencePoint,
    );
    const requested = requestedWirePose(frame, position.mm, orientation.grid);

    const before = this.reportedPoses();
    let release: Pose;
    if (mode === 'drop') {
      const overlap = this.world.penetration(item.pieces, pose);
      if (overlap.depth > SESSION_PARAMETERS.penetrationTolerance) {
        return {
          ...reject('collision_at_pose'),
          penetration_mm: roundToGrid(overlap.depth * 1000, 100),
          colliding_with: this.namesOf(overlap),
        };
      }
      const roof = this.roofRefusal(item, pose, SESSION_PARAMETERS.penetrationTolerance);
      if (roof !== null) return roof;
      const path = this.sweepFromAbove(item, pose, frame);
      if (!path.clear) {
        return {
          ...reject(
            'not_insertable',
            this.frameIsIn(frame)
              ? 'the basket is pushed in; pull it out to load it'
              : 'nothing can come straight down to this pose',
          ),
          ...(path.blockedBy === undefined ? {} : { blocked_by: path.blockedBy }),
        };
      }
      release = this.lowered(item, pose);
      this.addItemBody(item, release, frame);
    } else if (mode === 'set') {
      const overlap = this.world.penetration(item.pieces, pose);
      if (overlap.depth > SESSION_PARAMETERS.setPenetrationTolerance) {
        return {
          ...reject('collision_at_pose'),
          penetration_mm: roundToGrid(overlap.depth * 1000, 100),
          colliding_with: this.namesOf(overlap),
        };
      }
      const roof = this.roofRefusal(item, pose, SESSION_PARAMETERS.setPenetrationTolerance);
      if (roof !== null) return roof;
      release = pose;
      this.addItemBody(item, release, frame);
    } else {
      if (this.frameIsIn(frame)) {
        return {
          ...reject('not_insertable', 'the basket is pushed in; pull it out to load it'),
          blocked_by: 'tub',
        };
      }
      const rejected = this.insert(item, pose, quatRotate(framePose.q, direction), frame);
      if (rejected !== null) return rejected;
      release = this.world.getPose(item.id);
    }

    const settled = this.rest();
    const end = this.world.getPose(item.id);
    const moved = this.movedSince(before);
    const flags = this.fallFlags(item, frame);
    const contacts = this.contactsOf(item.id, true);
    const resting = this.restingOf(item, frame, contacts);
    // What reached the kitchen floor goes back to the counter; the action is charged all the same.
    const returned = this.returnStrays();
    const kept = this.placed.get(item.id);

    this.actionsUsed += 1;
    const state = this.sceneState();
    return {
      accepted: true,
      item_id: item.id,
      requested_pose: requested,
      release_pose: toWirePose(frame, framePose, release, item.instance.referencePoint),
      settled_pose: toWirePose(frame, framePose, end, item.instance.referencePoint),
      displacement_mm: mm(
        v3Distance(
          referencePointOf(release, item.instance.referencePoint),
          referencePointOf(end, item.instance.referencePoint),
        ),
      ),
      rotation_deg: roundToGrid(radToDeg(quatAngleBetween(release.q, end.q)), 10),
      settle_time_s: roundToGrid(settled.time, 1000),
      stable: kept?.stable ?? false,
      ...(kept === undefined || flags.out ? {} : { resting }),
      fell_through: flags.through,
      fell_out: flags.out || kept === undefined,
      returned,
      contacts,
      moved_items: moved,
      state_hash: state.state_hash,
      state,
    };
  }

  private addItemBody(item: ItemDef, pose: Pose, frame: FrameId): void {
    this.world.addBody(
      item.id,
      item.pieces,
      item.instance.mass,
      item.instance.contact,
      pose,
      'dynamic',
    );
    this.placed.set(item.id, { frame, stable: false });
  }

  /**
   * `insert`: the item approaches its pose along a straight line and is pushed on with a
   * limited force once it meets something, so that it can nudge its neighbours aside
   * (docs/research/items.md section 8.1). The machine itself must not be in the way, and the
   * approach must begin in free space. Returns a rejection, or null when the item is in the
   * world and has been let go.
   */
  private insert(item: ItemDef, target: Pose, direction: Vec3, frame: FrameId): DropResult | null {
    const P = SESSION_PARAMETERS;
    const others = [...this.placed.keys()];
    const fixed = this.world.penetration(item.pieces, target, others);
    if (fixed.depth > P.penetrationTolerance) {
      return {
        ...reject('collision_at_pose'),
        penetration_mm: roundToGrid(fixed.depth * 1000, 100),
        colliding_with: this.namesOf(fixed),
      };
    }
    const roof = this.roofRefusal(item, target, P.penetrationTolerance);
    if (roof !== null) return roof;
    const start = poseShifted(target, v3Scale(direction, -P.insertReach));
    const atStart = this.world.penetration(item.pieces, start);
    if (atStart.depth > P.penetrationTolerance) {
      return {
        ...reject('not_insertable', 'the approach along insert_dir does not begin in free space'),
        ...(atStart.with[0] === undefined
          ? {}
          : { blocked_by: this.nameOf(atStart.with[0], atStart.parts[0]) }),
      };
    }
    const machine = this.world.sweep(item.pieces, start, target, others);
    if (machine.hit && (1 - machine.fraction) * P.insertReach > P.insertEndTolerance) {
      return {
        ...reject('not_insertable', 'part of the machine is in the way along insert_dir'),
        ...(machine.with === undefined
          ? {}
          : { blocked_by: this.nameOf(machine.with, machine.part) }),
      };
    }
    // Free travel up to the first thing met; from there the item is a body that is pushed.
    const first = this.world.sweep(item.pieces, start, target);
    const free = Math.max(0, first.fraction * P.insertReach - P.releaseGap);
    const from = poseShifted(start, v3Scale(direction, free));
    this.addItemBody(item, from, frame);
    const distance = P.insertReach - free;
    const dt = this.world.timeStep;
    const mass = item.instance.mass.mass;
    // The hand carries the weight; beyond that it can change the velocity by force / mass.
    const maxChange = (P.insertForce / mass + STANDARD_GRAVITY) * dt;
    const maxSteps = Math.ceil(distance / (P.insertSpeed * dt)) + P.insertStallSteps;
    let best = 0;
    let stalled = 0;
    for (let step = 0; step < maxSteps; step++) {
      const pose = this.world.getPose(item.id);
      const along = v3Dot(v3Sub(pose.p, from.p), direction);
      if (along >= distance) break;
      if (along > best + P.insertStallProgress) {
        best = along;
        stalled = 0;
      } else {
        stalled += 1;
        if (stalled >= P.insertStallSteps) break;
      }
      const speed = Math.min(P.insertSpeed, (distance - along) / dt);
      const onLine = v3AddScaled(from.p, direction, along);
      const wanted = v3AddScaled(
        v3Scale(direction, speed),
        v3Sub(onLine, pose.p),
        P.insertHoldGain / dt,
      );
      const velocity = this.world.getVelocity(item.id).linear;
      let change = v3Sub(wanted, velocity);
      const size = v3Length(change);
      if (size > maxChange) change = v3Scale(change, maxChange / size);
      // The hand keeps the orientation: turn back towards it.
      const error = quatToAxisAngle(quatMul(target.q, quatConjugate(pose.q)));
      const angle = error.angle > Math.PI ? error.angle - 2 * Math.PI : error.angle;
      const turn = v3Scale(error.axis, (angle * P.insertHoldGain) / dt);
      this.world.setVelocity(item.id, v3Add(velocity, change), turn);
      this.world.step(1);
    }
    this.world.setVelocity(item.id, [0, 0, 0], [0, 0, 0]);
    return null;
  }

  /**
   * Whether an item ended below the base of the basket it was put in (or hanging through it and
   * standing on the tub or the door underneath), or outside it.
   */
  private fallFlags(item: ItemDef, frame: FrameId): { through: boolean; out: boolean } {
    if (frame === 'tub') return { through: false, out: false };
    const reference = referencePointOf(
      poseRelative(this.framePose(frame), this.world.getPose(item.id)),
      item.instance.referencePoint,
    );
    let size: readonly [number, number];
    let margin: number;
    let floor: number;
    if (frame === 'cutlery_basket') {
      // A piece of cutlery is in the basket while its lower end is: a ladle that leans over the
      // rim has its middle far outside the plan of its cell and has not fallen out.
      const basket = this.spec.cutleryBasket;
      const relative = poseRelative(this.framePose(frame), this.world.getPose(item.id));
      const end = lowerEndOf(item.pieces, relative.q, SESSION_PARAMETERS.cutleryEndBand);
      const foot: Vec3 = [
        relative.p[0] + end.centre[0],
        relative.p[1] + end.centre[1],
        relative.p[2] + end.z,
      ];
      size = basket === null ? [0, 0] : [basket.size[1], basket.size[0]];
      const inside =
        foot[0] >= -0.01 &&
        foot[0] <= size[0] + 0.01 &&
        foot[1] >= -0.01 &&
        foot[1] <= size[1] + 0.01;
      return { through: inside && foot[2] < -0.005, out: !inside };
    } else {
      size = this.scene.assemblies.find((a) => a.rack === frame)?.outline ?? [0, 0];
      margin = SESSION_PARAMETERS.riderPlanMargin;
      floor = -SESSION_PARAMETERS.riderFloorMargin;
    }
    const inPlan =
      reference[0] >= -margin &&
      reference[0] <= size[0] + margin &&
      reference[1] >= -margin &&
      reference[1] <= size[1] + margin;
    // A long item can hang through the grid with its middle still above it: it has fallen
    // through as soon as it stands on what is underneath.
    const carrier = this.carrierOf(item.id);
    const hangs = carrier !== null && this.standsThrough(item.id, carrier);
    return { through: inPlan && (reference[2] < floor || hangs), out: !inPlan };
  }

  // -------------------------------------------------------------------------------------------
  // remove, reset
  // -------------------------------------------------------------------------------------------

  remove(request: RemoveRequest): RemoveResult {
    return this.act<RemoveResult>(
      'remove',
      request,
      () => {
        if (this.episodePhase !== 'loading') return reject('episode_over');
        if (!isRecord(request) || typeof request.item_id !== 'string') {
          return reject('invalid_argument', 'item_id must be a string');
        }
        const id = request.item_id;
        if (!this.items.has(id)) return reject('unknown_item');
        if (!this.placed.has(id)) return reject('not_placed');
        if (this.actionsUsed >= this.level.rules.actionsMax) return reject('budget_exhausted');
        // Only what touched it can be affected; an item that touched no other item is taken
        // out without stepping the world.
        const supported = this.world
          .contacts({ bodies: [id] })
          .some((c) => this.placed.has(c.a === id ? c.b : c.a));
        const before = this.reportedPoses();
        this.world.removeBody(id);
        this.placed.delete(id);
        let moved: MovedItem[] = [];
        let returned: string[] = [];
        if (supported) {
          this.rest();
          moved = this.movedSince(before, id);
          returned = this.returnStrays();
        }
        this.actionsUsed += 1;
        const state = this.sceneState();
        return {
          accepted: true,
          item_id: id,
          moved_items: moved,
          returned,
          state_hash: state.state_hash,
          state,
        };
      },
      () => reject('invalid_argument'),
      () => reject('physics_limit'),
    );
  }

  reset(): ResetResult {
    return this.act<ResetResult>(
      'reset',
      {},
      () => {
        if (this.episodePhase !== 'loading') return reject('episode_over');
        if (this.actionsUsed >= this.level.rules.actionsMax) return reject('budget_exhausted');
        const removed = [...this.placed.keys()].sort(compareIds);
        for (const id of removed) this.world.removeBody(id);
        this.placed.clear();
        // The empty baskets go back to where the level starts them.
        for (const assembly of this.scene.assemblies) {
          const wanted = this.startPosition(assembly);
          if (this.positions.get(assembly.basketId) === wanted) continue;
          this.positions.set(assembly.basketId, wanted);
          for (const id of assembly.bodies) {
            const body = this.scene.bodies.find((b) => b.id === id);
            if (body !== undefined) this.world.teleport(id, this.machineBodyPose(body));
          }
        }
        this.actionsUsed += 1;
        const state = this.sceneState();
        return { accepted: true, removed, state_hash: state.state_hash, state };
      },
      () => reject('invalid_argument'),
      () => reject('physics_limit'),
    );
  }

  // -------------------------------------------------------------------------------------------
  // set_rack
  // -------------------------------------------------------------------------------------------

  setRack(request: SetRackRequest): SetRackResult {
    return this.act<SetRackResult>(
      'set_rack',
      request,
      () => this.doSetRack(request),
      (by) => ({ ...reject('blocked'), blocked_by: [...by].sort(compareIds) }),
      () => reject('physics_limit'),
    );
  }

  private doSetRack(request: SetRackRequest): SetRackResult {
    if (this.episodePhase !== 'loading') return reject('episode_over');
    if (
      !isRecord(request) ||
      !isRecord(request.option) ||
      typeof request.option.name !== 'string' ||
      typeof request.option.value !== 'string' ||
      typeof request.rack !== 'string'
    ) {
      return reject('invalid_argument', 'expected { rack, option: { name, value } }');
    }
    const { name, value } = request.option;
    const option = rackOptions(this.spec, this.config).find(
      (o) => o.rack === request.rack && o.name === name,
    );
    // The basket whose assembly the change concerns: the basket itself, or for the cutlery
    // basket the one it stands in (or is to stand in).
    const assembly =
      request.rack === 'cutlery_basket'
        ? this.assemblyOf(option?.basketId ?? null)
        : this.scene.assemblies.find((a) => a.rack === request.rack);
    if (!RACK_IDS.includes(request.rack) || assembly === undefined) {
      return reject('unknown_option', `'${request.rack}' has nothing to adjust on this machine`);
    }
    const before = this.reportedPoses();
    if (name === 'position' && request.rack !== 'cutlery_basket') {
      if (value !== 'in' && value !== 'out') return reject('unknown_option');
      if (this.positions.get(assembly.basketId) === value) {
        return reject('invalid_argument', `the ${assembly.rack} is already ${value}`);
      }
      if (this.actionsUsed >= this.level.rules.actionsMax) return reject('budget_exhausted');
      const travel = this.slide(assembly, value);
      if (travel.blockedBy !== undefined) throw new BlockedError([this.nameOf(travel.blockedBy)]);
    } else {
      if (option === undefined || !option.values.includes(value)) return reject('unknown_option');
      if (option.value === value) {
        return reject('invalid_argument', `${name} of the ${request.rack} is already '${value}'`);
      }
      if (this.actionsUsed >= this.level.rules.actionsMax) return reject('budget_exhausted');
      if (option.kind === 'cutlery_basket') {
        // The cutlery basket is carried by hand: only while nothing stands in it or leans on it.
        const inIt = [...this.placed.keys()]
          .sort(compareIds)
          .filter(
            (id) =>
              this.placed.get(id)?.frame === 'cutlery_basket' ||
              this.world
                .contacts({ bodies: [id] })
                .some((c) => (c.a === id ? c.b : c.a) === 'cutlery_basket'),
          );
        if (inIt.length > 0) throw new BlockedError(inIt);
      }
      const config = applyRackOption(this.config, option, value);
      if (validateMachineConfig(this.spec, config).length > 0) return reject('unknown_option');
      this.reconfigure(config, assembly);
    }
    const moved = this.movedSince(before);
    const returned = this.returnStrays();
    this.actionsUsed += 1;
    const state = this.sceneState();
    return { accepted: true, moved_items: moved, returned, state_hash: state.state_hash, state };
  }

  /**
   * Pushes a basket in or pulls it out with its contents: the basket is driven through the
   * motion of the session's travel profile, its load is carried by contact and friction and
   * feels the hand's acceleration and the knock of the end stop; then the load comes to rest
   * and is judged (`rest`). Reports the riders that ended more than 1 mm or 1 degree from
   * where they were on the basket, those that left its envelope, and what blocked it.
   */
  private slide(assembly: RackAssembly, to: RackPosition): TravelOutcome {
    const body = this.scene.bodies.find((b) => b.id === assembly.rack) as MachineBody;
    const target = to === 'out' ? poseShifted(body.poseIn, assembly.travel) : body.poseIn;
    const margin = SESSION_PARAMETERS.riderPlanMargin;
    const riders = this.ridersOf(assembly);
    const frameBefore = this.world.getPose(assembly.rack);
    const relativeBefore = new Map(
      riders.map((id) => [id, poseRelative(frameBefore, this.world.getPose(id))]),
    );
    const travel = v3Sub(target.p, frameBefore.p);
    const drive = driveBasket(this.world, {
      racks: assembly.bodies,
      travel,
      riders,
      distances: basketTravelDistances(v3Length(travel), this.travelProfile, this.world.timeStep),
    });
    this.rest();
    const frameAfter = this.world.getPose(assembly.rack);
    // What each rider was pressed against that does not travel with the basket.
    const pressedBy = new Map<string, Set<string>>();
    for (const press of drive.pressed) {
      if (!riders.includes(press.carried)) continue;
      const names = pressedBy.get(press.carried) ?? new Set<string>();
      names.add(this.nameOf(press.against, press.againstPart));
      pressedBy.set(press.carried, names);
    }
    const moved: {
      id: string;
      displacement: number;
      rotation: number;
      pushedBy?: readonly string[];
    }[] = [];
    const fellOut: string[] = [];
    for (const id of riders) {
      const was = relativeBefore.get(id) as Pose;
      const now = poseRelative(frameAfter, this.world.getPose(id));
      const displacement = v3Distance(was.p, now.p);
      const rotation = quatAngleBetween(was.q, now.q);
      if (
        displacement > SESSION_PARAMETERS.movedDistance ||
        rotation > SESSION_PARAMETERS.movedAngle
      ) {
        const by = pressedBy.get(id);
        moved.push({
          id,
          displacement,
          rotation,
          ...(by === undefined ? {} : { pushedBy: [...by].sort(compareIds) }),
        });
      }
      const point = referencePointOf(now, (this.items.get(id) as ItemDef).instance.referencePoint);
      if (
        point[0] < -margin ||
        point[0] > assembly.outline[0] + margin ||
        point[1] < -margin ||
        point[1] > assembly.outline[1] + margin ||
        point[2] < -SESSION_PARAMETERS.riderFloorMargin ||
        point[2] > 2
      ) {
        fellOut.push(id);
      }
    }
    if (drive.blockedBy === undefined) {
      this.positions.set(assembly.basketId, to);
      return { moved, fellOut };
    }
    return { moved, fellOut, blockedBy: drive.blockedBy };
  }

  /**
   * Changes the machine configuration under the load: a basket moved to another height carries
   * its contents there; a part whose shape or place changes (a folded row, a shelf, the cutlery
   * basket stood elsewhere) is exchanged, unless an item is where it would be. Throws a
   * `BlockedError` when the load is in the way.
   */
  private reconfigure(config: MachineConfig, assembly: RackAssembly): Rested {
    const P = SESSION_PARAMETERS;
    const geometry = buildMachineGeometry(this.spec, config);
    const next = buildMachineScene(this.spec, geometry);
    const current = new Map(this.scene.bodies.map((b) => [b.id, b]));
    const members = new Set(assembly.bodies);
    const machine = this.machineIds();

    // A change of height: drive the assembly there, carrying its contents.
    const wiresNow = current.get(assembly.rack) as MachineBody;
    const wiresNext = next.bodies.find((b) => b.id === assembly.rack) as MachineBody;
    const lift = v3Sub(wiresNext.poseIn.p, wiresNow.poseIn.p);
    const distance = v3Length(lift);
    if (distance > 0) {
      const riders = this.ridersOf(assembly);
      const probes: { pieces: readonly CollisionPiece[]; pose: Pose }[] = [];
      for (const id of assembly.bodies) {
        probes.push({
          pieces: (current.get(id) as MachineBody).pieces,
          pose: this.world.getPose(id),
        });
      }
      for (const arm of this.scene.arms) {
        if (arm.basketId !== assembly.basketId) continue;
        probes.push({
          pieces: arm.pieces,
          pose: poseShifted(arm.part.pose, this.basketOffset(assembly)),
        });
      }
      const inTheWay = new Set<string>();
      for (const probe of probes) {
        const hit = this.world.sweep(probe.pieces, probe.pose, poseShifted(probe.pose, lift), [
          ...machine,
          ...riders,
        ]);
        if (hit.hit && hit.with !== undefined) inTheWay.add(this.nameOf(hit.with));
      }
      if (inTheWay.size > 0) throw new BlockedError([...inTheWay]);
      const starts = new Map(assembly.bodies.map((id) => [id, this.world.getPose(id)]));
      const direction = v3Scale(lift, 1 / distance);
      for (const travelled of rackTravelDistances(distance, P.heightChange, this.world.timeStep)) {
        for (const id of assembly.bodies) {
          this.world.setPose(
            id,
            poseShifted(starts.get(id) as Pose, v3Scale(direction, travelled)),
          );
        }
        this.world.step(1);
      }
    }

    // Parts whose shape changes, or that stand elsewhere on their basket, or that are new: the
    // part must not come to be where an item is.
    const offsets = new Map(this.scene.assemblies.map((a) => [a.basketId, this.basketOffset(a)]));
    const wiresOf = (bodies: readonly MachineBody[], basketId: string | null): Vec3 =>
      bodies.find((b) => b.basketId === basketId && b.part.component === 'basket_wires')?.poseIn
        .p ?? [0, 0, 0];
    const blockers = new Set<string>();
    const exchanged: { body: MachineBody; at: Pose }[] = [];
    for (const body of next.bodies) {
      const old = current.get(body.id);
      if (old !== undefined && old.shapeKey === body.shapeKey) {
        // The same part: is it still at the same place on its basket (or in the tub)?
        const was = poseRelative(
          { p: wiresOf(this.scene.bodies, old.basketId), q: [0, 0, 0, 1] },
          old.poseIn,
        );
        const now = poseRelative(
          { p: wiresOf(next.bodies, body.basketId), q: [0, 0, 0, 1] },
          body.poseIn,
        );
        if (
          old.basketId === body.basketId &&
          v3Distance(was.p, now.p) < 1e-9 &&
          quatAngleBetween(was.q, now.q) < 1e-9
        ) {
          continue;
        }
      }
      const offset = body.basketId === null ? undefined : offsets.get(body.basketId);
      // A basket that has just been driven to its new height is where its new pose says.
      const base =
        members.has(body.id) && distance > 0
          ? v3Sub(offset ?? [0, 0, 0], lift)
          : (offset ?? [0, 0, 0]);
      const at = poseShifted(body.poseIn, base);
      const overlap = this.world.penetration(body.pieces, at, machine);
      if (overlap.depth > P.penetrationTolerance) for (const id of overlap.with) blockers.add(id);
      exchanged.push({ body, at });
    }
    if (blockers.size > 0) throw new BlockedError([...blockers]);
    for (const body of this.scene.bodies) {
      if (!next.bodies.some((b) => b.id === body.id)) this.world.removeBody(body.id);
    }
    for (const { body, at } of exchanged) {
      if (current.has(body.id)) this.world.removeBody(body.id);
      this.addMachineBody(body, at);
    }
    this.config = geometry.config;
    this.scene = next;
    this.slotSeats.clear();

    const settled = this.rest();
    const squeezed = settled.penetrating.filter((id) => this.placed.has(id));
    if (squeezed.length > 0) throw new BlockedError(squeezed);
    return settled;
  }

  // -------------------------------------------------------------------------------------------
  // The mechanical check (check_load and the pre-checks of start_cycle)
  // -------------------------------------------------------------------------------------------

  /**
   * Pushes every basket in and closes the door, then tests the arms and the dispenser against
   * the load. The world is left with the baskets where they ended and the door shut (see
   * `openDoor`); `check_load` restores it afterwards.
   */
  private mechanicalCheck(): LoadCheck {
    const P = SESSION_PARAMETERS;
    const shifted = new Map<string, MovedItem>();
    const fellOut = new Set<string>();
    const racks: { rack: RackId; slides_in: boolean; blocked_by?: string }[] = [];
    for (const assembly of this.scene.assemblies) {
      if (this.positions.get(assembly.basketId) !== 'out') {
        racks.push({ rack: assembly.rack, slides_in: true });
        continue;
      }
      const travel = this.slide(assembly, 'in');
      for (const motion of travel.moved) {
        shifted.set(motion.id, {
          item_id: motion.id,
          displacement_mm: mm(motion.displacement),
          rotation_deg: roundToGrid(radToDeg(motion.rotation), 10),
          ...(motion.pushedBy === undefined ? {} : { pushed_by: motion.pushedBy }),
        });
      }
      for (const id of travel.fellOut) fellOut.add(id);
      racks.push(
        travel.blockedBy === undefined
          ? { rack: assembly.rack, slides_in: true }
          : { rack: assembly.rack, slides_in: false, blocked_by: this.nameOf(travel.blockedBy) },
      );
    }

    // What is neither in a basket nor inside the tub now (it lies on the door, or fell out as
    // the baskets went in) is not part of the load: it is taken out before the door closes.
    for (const id of [...this.placed.keys()].sort(compareIds)) {
      if (this.locationOf(id) !== 'outside') continue;
      fellOut.add(id);
      this.world.removeBody(id);
      this.placed.delete(id);
    }

    // With every basket in, the door is closed on the load, which may push things back.
    const allIn = racks.every((r) => r.slides_in);
    let door: { closed: boolean; blockedBy: string[]; pressed: readonly string[] } = {
      closed: false,
      blockedBy: [],
      pressed: [],
    };
    if (allIn) {
      const beforeDoor = this.reportedPoses();
      door = this.closeDoor();
      for (const motion of this.movedSince(beforeDoor)) {
        const earlier = shifted.get(motion.item_id);
        const pushedBy = [
          ...new Set([
            ...(earlier?.pushed_by ?? []),
            ...(door.pressed.includes(motion.item_id) ? ['door'] : []),
          ]),
        ].sort(compareIds);
        shifted.set(motion.item_id, {
          item_id: motion.item_id,
          displacement_mm: Math.max(motion.displacement_mm, earlier?.displacement_mm ?? 0),
          rotation_deg: Math.max(motion.rotation_deg, earlier?.rotation_deg ?? 0),
          ...(pushedBy.length === 0 ? {} : { pushed_by: pushedBy }),
        });
      }
    }

    const machine = this.machineIds();
    const onFloor: string[] = [];
    const protruding: {
      item_id: string;
      rack: RackId;
      beyond_mm: number;
      over: 'left' | 'right' | 'front' | 'rear' | 'top';
      touching: string[];
    }[] = [];
    for (const id of [...this.placed.keys()].sort(compareIds)) {
      const item = this.items.get(id) as ItemDef;
      const pose = this.world.getPose(id);
      const carrier = this.carrierOf(id);
      if (carrier === null) {
        // Pushed out of the tub by the closing door, or lying on its floor.
        if (this.insideTub(referencePointOf(pose, item.instance.referencePoint))) onFloor.push(id);
        else fellOut.add(id);
        continue;
      }
      if (this.standsThrough(id, carrier)) onFloor.push(id);
      const envelope = this.scene.geometry.affordances.baskets.find(
        (b) => b.basketId === carrier.basketId,
      );
      const box = boundingBox(
        item.instance.shape,
        poseRelative(this.world.getPose(carrier.rack), pose),
      );
      // The height that is clear over the whole basket: the floor of the basket above, or the
      // roof. What hangs lower over part of it only (the spray arm above, the sprayer in the
      // roof) is tested as a shape: the arm by its sweep, the sprayer as a fixed part.
      const top = Math.min(
        Infinity,
        ...(envelope?.overhead ?? [])
          .filter((o) => o.region.kind === 'everywhere')
          .map((o) => o.clearHeight),
      );
      // Over which side of the envelope it reaches furthest: -x is the left of the machine
      // seen from its front, -y its front.
      const reaches: readonly (readonly ['left' | 'right' | 'front' | 'rear' | 'top', number])[] = [
        ['left', -box.min[0]],
        ['right', box.max[0] - carrier.outline[0]],
        ['front', -box.min[1]],
        ['rear', box.max[1] - carrier.outline[1]],
        ['top', box.max[2] - top],
      ];
      let furthest = reaches[0] as (typeof reaches)[number];
      for (const reach of reaches) if (reach[1] > furthest[1]) furthest = reach;
      const beyond = furthest[1];
      if (beyond > P.protrusionTolerance) {
        // What it touches now that is neither an item nor a part of its own basket: the tub,
        // the door, the other basket. Nothing: it is clear of them, and the basket slid in
        // with it as it stands.
        const own = new Set(carrier.bodies);
        const touching = new Set<string>();
        for (const contact of this.world.contacts({ bodies: [id] })) {
          const [other, part] =
            contact.a === id ? [contact.b, contact.partB] : [contact.a, contact.partA];
          if (this.items.has(other) || own.has(other)) continue;
          touching.add(this.nameOf(other, part));
        }
        protruding.push({
          item_id: id,
          rack: carrier.rack,
          beyond_mm: mm(beyond),
          over: furthest[0],
          touching: [...touching].sort(compareIds),
        });
      }
    }

    const arms = this.scene.arms.map((arm) => {
      const assembly = this.assemblyOf(arm.basketId);
      const pose =
        assembly === undefined
          ? arm.part.pose
          : poseShifted(arm.part.pose, this.basketOffset(assembly));
      const sweep = sweepArm(this.world, {
        arm: arm.id,
        pieces: arm.pieces,
        pose,
        ...(arm.part.arm === undefined
          ? {}
          : {
              hinge: { point: arm.part.arm.hingePoint, axis: arm.part.arm.hingeAxis },
              direction: arm.part.arm.senseSign,
            }),
        ignore: machine,
        arcStep: P.armSweepArcStep,
      });
      return sweep.free
        ? { arm: arm.id, full_rotation: true }
        : {
            arm: arm.id,
            full_rotation: false,
            first_contact_angle_deg: roundToGrid(radToDeg(sweep.firstContactAngle ?? 0), 10),
            blocked_by: this.nameOf(sweep.blockedBy ?? ''),
          };
    });

    const blockers = (pieces: readonly CollisionPiece[], pose: Pose): string[] => {
      const overlap = this.world.penetration(pieces, pose, machine);
      return overlap.depth > P.penetrationTolerance
        ? overlap.with.map((id) => this.nameOf(id)).sort(compareIds)
        : [];
    };
    const lid = this.scene.geometry.affordances.dispenserLid;
    const lidBlockers = blockers([boxPiece(lid.swept.min, lid.swept.max, 'lid')], POSE_IDENTITY);
    const path = this.scene.geometry.affordances.tabletPath;
    const tabletPieces: CollisionPiece[] = [];
    for (let i = 0; i + 1 < path.points.length; i++) {
      tabletPieces.push({
        kind: 'capsule',
        part: 'tablet',
        a: path.points[i] as Vec3,
        b: path.points[i + 1] as Vec3,
        radius: P.tabletRadius,
      });
    }
    const landing = path.points[path.points.length - 1];
    if (landing !== undefined && path.caughtBy === 'tray') {
      // The tray itself must be empty to catch the tablet.
      const inset = 0.004;
      tabletPieces.push(
        boxPiece(
          [path.target.x[0] + inset, path.target.y[0] + inset, landing[2] - 0.01],
          [path.target.x[1] - inset, path.target.y[1] - inset, landing[2] + 0.01],
          'tray',
        ),
      );
    }
    const tabletBlockers = blockers(tabletPieces, POSE_IDENTITY);

    return {
      shifted: [...shifted.keys()].sort(compareIds).map((id) => shifted.get(id) as MovedItem),
      fell_out: [...fellOut].sort(compareIds),
      on_tub_floor: onFloor,
      protruding,
      racks,
      spray_arms: arms,
      door_closes: door.closed,
      door_blocked_by: door.blockedBy,
      dispenser_opens: lidBlockers.length === 0,
      dispenser_blocked_by: lidBlockers,
      tablet_path_clear: tabletBlockers.length === 0,
      tablet_blocked_by: tabletBlockers,
    };
  }

  checkLoad(): CheckLoadResult {
    return this.ask<CheckLoadResult>(
      'check_load',
      {},
      () => {
        if (!this.level.rules.mechanicalChecks) return reject('not_available');
        if (this.episodePhase !== 'loading') return reject('episode_over');
        const saved = this.checkpoint();
        let lost = false;
        try {
          const check = this.mechanicalCheck();
          return { ...check, accepted: true };
        } catch (error) {
          lost = error instanceof NonFiniteError;
          if (isPhysicsLimit(error)) return reject('physics_limit');
          throw error;
        } finally {
          this.rollback(saved, lost);
        }
      },
      (reason) => reject(reason),
    );
  }

  // -------------------------------------------------------------------------------------------
  // start_cycle and the wash job
  // -------------------------------------------------------------------------------------------

  startCycle(request: StartCycleRequest = {}): StartCycleResult {
    return this.act<StartCycleResult>(
      'start_cycle',
      request,
      () => {
        if (this.episodePhase !== 'loading') return reject('episode_over');
        if (!isRecord(request)) return reject('invalid_argument');
        const asked: unknown = request.programme;
        if (asked !== undefined && typeof asked !== 'string') return reject('invalid_argument');
        const programme: string = asked ?? this.level.programmeId;
        if (programme !== this.level.programmeId) {
          return reject('unknown_programme', `this level is scored on '${this.level.programmeId}'`);
        }
        if (this.washesUsed >= this.level.rules.washesMax) return reject('no_washes_left');
        const prechecks = this.mechanicalCheck();
        if (!prechecks.door_closes) {
          const by = [
            ...prechecks.racks.flatMap((r) => (r.blocked_by === undefined ? [] : [r.blocked_by])),
          ];
          throw new BlockedError(by.length > 0 ? by : ['door']);
        }
        // The load is frozen as the closed door left it; the door of the loading world is
        // not part of the scene that is hashed.
        this.openDoor();
        // Whatever the closing door left outside the tub is not washed either.
        const leftOut = new Set(prechecks.fell_out);
        for (const id of [...this.placed.keys()]) {
          if (this.locationOf(id) !== 'outside') continue;
          leftOut.add(id);
          this.world.removeBody(id);
          this.placed.delete(id);
        }
        // The mechanical findings go with the load: a blocked arm is a condition of the wash.
        const manifest: WashManifest = { ...this.buildManifest(programme), prechecks };
        this.manifest = manifest;
        this.washesUsed += 1;
        this.episodePhase = 'washing';
        this.launch(manifest);
        const state = this.sceneState();
        return {
          accepted: true,
          job_id: (this.job as WashJob).id,
          programme,
          prechecks,
          left_out: [...leftOut].sort(compareIds),
          load: manifest.load,
          state_hash: state.state_hash,
          state,
        };
      },
      (by) =>
        reject(
          'door_blocked',
          `the baskets cannot be pushed in and the door closed (${by.join(', ')}); check_load says what is in the way`,
        ),
      () => reject('physics_limit'),
    );
  }

  private buildManifest(programme: string): WashManifest {
    const hash = this.stateHash();
    const ids = [...this.placed.keys()].sort(compareIds);
    const items: WashManifestItem[] = ids.map((id) => {
      const item = this.items.get(id) as ItemDef;
      return {
        item_id: id,
        item_type: item.level.itemType,
        pose: this.world.getPose(id),
        soils: item.level.soils,
        points: item.level.points,
      };
    });
    const load: LoadManifest = {
      benchmark_version: this.card.benchmark_version,
      level_id: this.level.id,
      machine_id: this.spec.id,
      programme_id: programme,
      rack_options: this.rackOptionValues(),
      items: ids.map((id) => ({ ...this.wirePoseOf(id, 'tub'), item_id: id })),
      state_hash: hash,
    };
    return {
      load,
      level: this.level,
      machine_id: this.spec.id,
      machine_config: this.config,
      programme_id: programme,
      items,
      unloaded: this.itemIds.filter((id) => !this.placed.has(id)),
      seed: this.level.seed,
    };
  }

  private launch(manifest: WashManifest): void {
    const washesLeft = this.washesUsed < this.level.rules.washesMax;
    const job: WashJob = {
      id: `${this.level.id}-wash-${this.washesUsed}`,
      status: 'running',
      progress: 0,
      settled: Promise.resolve(),
    };
    job.settled = (async (): Promise<void> => {
      try {
        // Start on a later tick, so that start_cycle has returned before the runner begins.
        await Promise.resolve();
        const report = await this.washRunner(manifest, (fraction) => {
          if (Number.isFinite(fraction)) job.progress = Math.min(1, Math.max(0, fraction));
        });
        job.report = report;
        job.progress = 1;
        job.status = 'done';
        this.episodePhase = washesLeft ? 'loading' : 'finished';
      } catch (error) {
        // An infrastructure failure is never a score: the wash is given back.
        job.error = error instanceof Error ? error.message : String(error);
        job.status = 'failed';
        this.washesUsed -= 1;
        this.episodePhase = 'loading';
      }
    })();
    this.job = job;
  }

  getReport(): GetReportResult {
    this.assertLive();
    const job = this.job;
    let result: GetReportResult;
    if (job === null) result = reject('no_cycle_started');
    else if (job.status === 'done' && job.report !== undefined) {
      result = { accepted: true, job_id: job.id, status: 'done', report: job.report };
    } else if (job.status === 'failed') {
      result = { accepted: true, job_id: job.id, status: 'failed', error: job.error ?? 'failed' };
    } else {
      result = { accepted: true, job_id: job.id, status: 'running', progress: job.progress };
    }
    this.record('query', 'get_report', {}, result);
    return result;
  }

  washManifest(): WashManifest | null {
    return this.manifest;
  }

  peekState(): SceneState {
    this.assertLive();
    return this.sceneState();
  }

  washJob(): {
    readonly id: string;
    readonly status: 'running' | 'done' | 'failed';
    readonly progress: number;
  } | null {
    const job = this.job;
    return job === null ? null : { id: job.id, status: job.status, progress: job.progress };
  }

  washSettled(): Promise<void> {
    return this.job?.settled ?? Promise.resolve();
  }

  // -------------------------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------------------------

  /** Counts a query that is always answered: charged only while the cap has room. */
  private countAlways(name: QueryName, args: unknown, result: object): void {
    this.assertLive();
    if (this.queriesUsed < this.level.rules.queriesMax) this.queriesUsed += 1;
    this.record('query', name, args, result);
  }

  getLevel(): LevelCard {
    this.countAlways('get_level', {}, this.card);
    return this.card;
  }

  getState(): SceneState {
    this.assertLive();
    if (this.queriesUsed < this.level.rules.queriesMax) this.queriesUsed += 1;
    const state = this.sceneState();
    this.record('query', 'get_state', {}, state);
    return state;
  }

  getItem(request: GetItemRequest): GetItemResult {
    return this.ask<GetItemResult>(
      'get_item',
      request,
      () => {
        if (!isRecord(request) || typeof request.item_id !== 'string') {
          return reject('invalid_argument', 'item_id must be a string');
        }
        const item = this.items.get(request.item_id);
        if (item === undefined) return reject('unknown_item');
        const thumbnails = this.thumbnails?.(item.id);
        return {
          accepted: true,
          item: thumbnails === undefined ? item.record : { ...item.record, thumbnails },
        };
      },
      (reason) => reject(reason),
    );
  }

  preview(request: PreviewRequest): PreviewResult {
    return this.ask<PreviewResult>(
      'preview',
      request,
      () => {
        if (!isRecord(request) || typeof request.item_id !== 'string') {
          return reject('invalid_argument', 'item_id must be a string');
        }
        const item = this.items.get(request.item_id);
        if (item === undefined) return reject('unknown_item');
        if (this.episodePhase !== 'loading') return reject('episode_over');
        if (this.placed.has(item.id)) return reject('already_placed');
        const frame = request.frame;
        if (!FRAME_IDS.includes(frame) || !this.frameExists(frame)) {
          return reject('invalid_argument', `the machine has no frame '${String(frame)}'`);
        }
        if (!isVec3(request.position_mm)) {
          return reject('invalid_argument', 'position_mm must be three finite numbers');
        }
        const orientation: ResolvedOrientation | null = resolveOrientation(
          request.orientation,
          item.presets,
        );
        if (orientation === null) {
          return reject(
            'invalid_argument',
            'orientation must be a known preset or a non-zero quaternion',
          );
        }
        const position = quantisePosition(request.position_mm);
        const framePose = this.framePose(frame);
        const pose = bodyPoseInTub(
          framePose,
          position.m,
          orientation.unit,
          item.instance.referencePoint,
        );
        const inBounds = this.inBounds(frame, position.m);
        const overlap = this.world.penetration(item.pieces, pose);
        const free = overlap.depth <= SESSION_PARAMETERS.penetrationTolerance;
        const path = free ? this.sweepFromAbove(item, pose, frame) : null;
        const insertable = path !== null && path.clear;
        return {
          accepted: true,
          requested_pose: requestedWirePose(frame, position.mm, orientation.grid),
          collision_free: free,
          penetration_mm: roundToGrid(overlap.depth * 1000, 100),
          colliding_with: this.namesOf(overlap),
          insertable,
          ...(path === null || path.clear || path.blockedBy === undefined
            ? {}
            : {
                blocked_by: path.blockedBy,
                ...(path.above === undefined ? {} : { blocked_above_mm: mm(path.above) }),
              }),
          in_bounds: inBounds,
          lowered_pose:
            free && insertable && inBounds
              ? toWirePose(frame, framePose, this.lowered(item, pose), item.instance.referencePoint)
              : null,
        };
      },
      (reason) => reject(reason),
      false,
    );
  }

  listSlots(request: ListSlotsRequest): ListSlotsResult {
    return this.ask<ListSlotsResult>(
      'list_slots',
      request,
      () => {
        if (!isRecord(request) || typeof request.rack !== 'string') {
          return reject('invalid_argument', 'rack must be a string');
        }
        const rack = request.rack;
        if (!RACK_IDS.includes(rack) || !this.frameExists(rack)) return reject('unknown_rack');
        let forItem: ItemDef | undefined;
        if (request.item_id !== undefined) {
          if (typeof request.item_id !== 'string') {
            return reject('invalid_argument', 'item_id must be a string');
          }
          forItem = this.items.get(request.item_id);
          if (forItem === undefined) return reject('unknown_item');
        }
        if (this.episodePhase !== 'loading') return reject('episode_over');
        this.seatMemo = new Map();
        this.sceneKey = JSON.stringify([
          this.config,
          [...this.positions.entries()].sort(([a], [b]) => compareIds(a, b)),
        ]);
        this.lowerEdges = [];
        this.lastApproach = undefined;
        if (forItem !== undefined && rack !== 'cutlery_basket') {
          const framePose = this.framePose(rack);
          for (const id of [...this.placed.keys()].sort(compareIds)) {
            const other = this.items.get(id) as ItemDef;
            const pose = poseRelative(framePose, this.world.getPose(id));
            const end = lowerEndOf(other.pieces, pose.q, 0.003);
            this.lowerEdges.push({
              id,
              at: [pose.p[0] + end.centre[0], pose.p[1] + end.centre[1], pose.p[2] + end.z],
              origin: pose.p,
            });
          }
        }
        const affordances = this.scene.geometry.affordances;
        const rows: TineRowCard[] = [];
        const slots: SlotCard[] = [];
        if (rack === 'cutlery_basket') {
          for (const cell of affordances.cutleryCells) {
            const { min, max } = cell.box;
            slots.push({
              id: `cell_${cell.id}`,
              kind: 'basket_cell',
              centre_mm: v3mm([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2]]),
              width_mm: mm(Math.min(max[0] - min[0], max[1] - min[1])),
              size_mm: [mm(max[0] - min[0]), mm(max[1] - min[1])],
              ...(forItem === undefined ? {} : this.cellSuggestion(cell.box, forItem)),
            });
          }
          return { accepted: true, rack, tine_rows: rows, slots };
        }
        for (const row of affordances.tineRows) {
          if (row.frame !== rack) continue;
          const id = `tine_row_${row.rowId}`;
          const first = row.tines[0];
          const last = row.tines[row.tines.length - 1];
          if (first === undefined || last === undefined) continue;
          let height = 0;
          let lean = 0;
          for (const tine of row.tines) {
            const rise = tine.tip[2] - tine.base[2];
            height = Math.max(height, tine.tip[2]);
            lean = Math.max(
              lean,
              Math.atan2(Math.hypot(tine.tip[0] - tine.base[0], tine.tip[1] - tine.base[1]), rise),
            );
          }
          rows.push({
            id,
            start_mm: v3mm(first.base),
            end_mm: v3mm(last.base),
            count: row.tines.length,
            pitch_mm:
              row.tines.length > 1
                ? mm(v3Distance(first.base, last.base) / (row.tines.length - 1))
                : 0,
            height_mm: mm(height),
            lean_deg: roundToGrid(radToDeg(lean), 10),
            folded: row.state === 'folded',
            runs: row.runs,
            lean_toward: row.slots.every((s) => s.leanToward === row.slots[0]?.leanToward)
              ? (row.slots[0]?.leanToward ?? '')
              : 'mixed',
            ...(row.partner === null
              ? {}
              : {
                  partner: {
                    id: `tine_row_${row.partner.rowId}`,
                    spacing_mm: mm(row.partner.railSpacing),
                  },
                }),
          });
          for (const slot of row.slots) {
            slots.push({
              id: `${id}.slot_${String(slot.index).padStart(2, '0')}`,
              kind: slot.vGap ? 'wide_slot' : 'plate_slot',
              centre_mm: v3mm(slot.centre),
              width_mm: mm(slot.clearWidth),
              tine_row: id,
              lean_deg: roundToGrid(radToDeg(slot.lean), 10),
              lean_toward: slot.leanToward,
              plate_normal: [
                roundToGrid(slot.plateNormal[0], 10000),
                roundToGrid(slot.plateNormal[1], 10000),
                roundToGrid(slot.plateNormal[2], 10000),
              ],
              ...this.slotSuggestion(rack, row, slot, forItem),
            });
          }
        }
        const basketId = this.scene.assemblies.find((a) => a.rack === rack)?.basketId;
        for (const shelf of affordances.cupShelves) {
          if (shelf.basketId !== basketId || shelf.surface === null) continue;
          const { x, y, z } = shelf.surface;
          slots.push({
            id: `shelf_${shelf.shelfId}`,
            kind: 'cup_shelf',
            centre_mm: v3mm([(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, z]),
            width_mm: mm(Math.min(x[1] - x[0], y[1] - y[0])),
            size_mm: [mm(x[1] - x[0]), mm(y[1] - y[0])],
            ...this.shelfSuggestion(rack, shelf.surface, forItem),
          });
          shelf.stemwareNotches.forEach((notch, i) => {
            slots.push({
              id: `shelf_${shelf.shelfId}.notch_${i}`,
              kind: 'stemware_notch',
              centre_mm: v3mm(notch),
              width_mm: 0,
            });
          });
        }
        for (const rest of affordances.sideRests) {
          if (rest.basketId !== basketId) continue;
          const across = Math.abs(rest.wallX - rest.peakX);
          slots.push({
            id: `rest_${rest.restId}`,
            kind: 'cup_rest',
            centre_mm: v3mm([
              (rest.wallX + rest.peakX) / 2,
              (rest.y[0] + rest.y[1]) / 2,
              (rest.peakZ + rest.footZ) / 2,
            ]),
            width_mm: mm(across),
            size_mm: [mm(across), mm(rest.y[1] - rest.y[0])],
            lean_deg: roundToGrid(radToDeg(rest.slope), 10),
            lean_toward: rest.fallsToward,
            ...this.restSuggestion(rack, rest, forItem),
          });
        }
        for (const holder of affordances.holders) {
          if (holder.basketId !== basketId || holder.state !== 'down') continue;
          const { min, max } = holder.box;
          slots.push({
            id: `shelf_${holder.holderId}`,
            kind: holder.kind,
            centre_mm: v3mm([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, holder.floorZ]),
            width_mm: mm(Math.min(max[0] - min[0], max[1] - min[1])),
            size_mm: [mm(max[0] - min[0]), mm(max[1] - min[1])],
          });
        }
        return { accepted: true, rack, tine_rows: rows, slots };
      },
      (reason) => reject(reason),
    );
  }

  /**
   * How to put a plate, a lid or a platter into a slot between tines: the orientation, and for
   * a given item the pose to let it go at.
   *
   * The item is seated the way a hand seats a plate. It is held on edge across the rail,
   * midway to the partner row, its face away from the side the tines lean to (in the baskets of
   * a dishwasher: towards the middle). Its lower edge is slid down along the tines into the gap
   * and onto the rails, and it is laid back towards the tine behind it as far as it goes
   * without touching anything, at most to the lean of the tines; a plate too deep to stand
   * upright in the gap is held tipped forward just enough to be clear. The suggested pose is
   * that pose, a millimetre or two above where the item touches down, on the grid `place`
   * takes; `place` accepts it because an item may come down along the tines of a row
   * (`sweepFromAbove`). An item that does not come down between the tines at any lean (a bowl
   * over a narrow row) is held upright above the tine tips instead and perches on them.
   * [MEASURED: `packages/machine/src/geometry/plate-rows.test.ts` seats every plate of the
   * catalogue with this motion; `plates.test.ts` and `rows.test.ts` do it through `place`.]
   */
  private slotSuggestion(
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    slot: MachineGeometry['affordances']['tineRows'][number]['slots'][number],
    item: ItemDef | undefined,
  ): Pick<
    SlotCard,
    | 'suggested_orientation'
    | 'suggested_drop'
    | 'drop_free'
    | 'drop_blocked_by'
    | 'drop_perches'
    | 'drop_seats'
  > {
    // An item that cannot be stood on edge (a mug, a glass) gets no advice about slots.
    if (item !== undefined && !item.presets.has('on_edge')) return {};
    const lean: Vec3 =
      slot.lean > 0
        ? slot.leanToward === '+x'
          ? [1, 0, 0]
          : slot.leanToward === '-x'
            ? [-1, 0, 0]
            : slot.leanToward === '+y'
              ? [0, 1, 0]
              : [0, -1, 0]
        : [-slot.plateNormal[0], -slot.plateNormal[1], 0];
    const face = v3Normalise([-lean[0], -lean[1], 0]);
    const upright = edgeOrientation([face[0], face[1]], 0);
    const tineA = row.tines[slot.index];
    const tineB = row.tines[slot.index + 1];
    if (item === undefined || tineA === undefined || tineB === undefined) {
      return { suggested_orientation: upright };
    }
    // The cutlery basket stands astride the row over this slot.
    if (slot.blockedBy !== null) {
      return {
        suggested_orientation: upright,
        drop_free: false,
        drop_blocked_by: [slot.blockedBy],
      };
    }
    const P = SESSION_PARAMETERS;
    const along = row.runs === 'x' ? 0 : 1;
    const q0 = resolveOrientation(upright, item.presets)?.unit as Quat;
    const box0 = boundingBox(item.instance.shape, { p: [0, 0, 0], q: q0 });
    const depth = (box0.max[along] as number) - (box0.min[along] as number);
    const perches = depth > P.perchDepthRatio * slot.clearWidth;
    const memoKey = [
      item.id,
      rack,
      this.acrossFor(rack, row, slot, box0).toFixed(5),
      ...[
        tineA.base[along],
        tineB.base[along],
        tineA.tip[along],
        tineB.tip[along],
        tineA.tip[2],
      ].map((x) => (x as number).toFixed(5)),
      row.railTopZ.toFixed(5),
    ].join('|');
    let found = perches ? null : (this.seatMemo.get(memoKey) ?? null);
    if (!perches && found === null) {
      found = this.seatIn(item, rack, row, slot, face);
      this.seatMemo.set(memoKey, found);
    }
    const seat = found?.seat ?? this.aboveTips(item, rack, row, slot, face);
    const orientation = edgeOrientation([face[0], face[1]], seat.leanDeg);
    const q = resolveOrientation(orientation, item.presets)?.unit ?? q0;
    const position = quantisePosition(v3mm(seat.position));
    // A seat is known to be free or not from the search; a pose above the tips is tested here.
    // The search knows nothing of the frame `place` holds a position to: a seat it found free
    // whose position `place` would refuse as out of bounds is not free.
    const outside = this.outsideFrame(rack, position.m);
    const verdict: Pick<SlotCard, 'drop_free' | 'drop_blocked_by'> =
      found !== null && found.seat === null && found.blockedBy.length > 0
        ? { drop_free: false, drop_blocked_by: [...found.blockedBy] }
        : found?.seat === undefined || found.seat === null
          ? this.dropTest(item, rack, position.m, q)
          : this.placed.has(item.id)
            ? {}
            : outside !== null
              ? { drop_free: false, drop_blocked_by: [outside] }
              : found.free
                ? { drop_free: true }
                : { drop_free: false, drop_blocked_by: [...found.blockedBy] };
    return {
      suggested_orientation: orientation,
      suggested_drop: {
        position_mm: [position.mm[0], position.mm[1], position.mm[2]],
        orientation,
      },
      ...verdict,
      ...(perches ? { drop_perches: true } : {}),
      drop_seats: seat.seated,
    };
  }

  /**
   * The pose above the tine tips from which an item held upright is let go over a slot: its
   * rim midway between the two tine tips, midway to the partner row but clear of the walls of
   * the basket, its lowest point a little above the tips. For what does not come down between
   * the tines.
   */
  private aboveTips(
    item: ItemDef,
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    slot: MachineGeometry['affordances']['tineRows'][number]['slots'][number],
    face: Vec3,
  ): Seat {
    const P = SESSION_PARAMETERS;
    const tineA = row.tines[slot.index] as { base: Vec3; tip: Vec3 };
    const tineB = row.tines[slot.index + 1] as { base: Vec3; tip: Vec3 };
    const q = resolveOrientation(edgeOrientation([face[0], face[1]], 0), item.presets)
      ?.unit as Quat;
    const box = boundingBox(item.instance.shape, { p: [0, 0, 0], q });
    const reference = quatRotate(q, item.instance.referencePoint);
    const tips = v3Scale(v3Add(tineA.tip, tineB.tip), 0.5);
    const along = row.runs === 'x' ? 0 : 1;
    const across = 1 - along;
    const front =
      (face[along] as number) > 0 ? (box.max[along] as number) : -(box.min[along] as number);
    const depth = (box.max[along] as number) - (box.min[along] as number);
    const origin: [number, number, number] = [0, 0, 0];
    origin[along] =
      (tips[along] as number) - (face[along] as number) * (front - Math.min(0.0025, depth / 2));
    origin[across] = this.acrossFor(rack, row, slot, box);
    origin[2] = Math.max(tineA.tip[2], tineB.tip[2]) + P.suggestDropClearance - box.min[2];
    return { leanDeg: 0, position: v3Add(origin, reference), seated: false };
  }

  /**
   * Where the origin of an item stands across a row: midway between the rail and its partner
   * rail, kept clear of the walls of the basket.
   */
  private acrossFor(
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    slot: MachineGeometry['affordances']['tineRows'][number]['slots'][number],
    box: { readonly min: Vec3; readonly max: Vec3 },
  ): number {
    const P = SESSION_PARAMETERS;
    const across = row.runs === 'x' ? 1 : 0;
    const partner = this.scene.geometry.affordances.tineRows.find(
      (other) => other.frame === rack && other.rowId === row.partner?.rowId,
    );
    const partnerAt = partner?.tines[0]?.base[across];
    const middle = ((box.min[across] as number) + (box.max[across] as number)) / 2;
    let at =
      (partnerAt === undefined
        ? (slot.centre[across] as number)
        : ((slot.centre[across] as number) + partnerAt) / 2) - middle;
    const envelope = this.scene.geometry.affordances.baskets.find((b) => b.frame === rack);
    if (envelope !== undefined) {
      const low =
        (envelope.interior.min[across] as number) +
        P.suggestWallClearance -
        (box.min[across] as number);
      const high =
        (envelope.interior.max[across] as number) -
        P.suggestWallClearance -
        (box.max[across] as number);
      if (low <= high) at = Math.min(Math.max(at, low), high);
    }
    return at;
  }

  /**
   * The seat of an item in a slot as the scene is now, and whether it is free.
   *
   * Where the kind of item stands in this slot of the empty machine is worked out once per
   * session and configuration (`slotSeats`; the lean found for the first slot of a kind is
   * where the search for the others starts). In the scene as it is: when the lower edge of
   * another item stands in this very gap the slot is taken; when the seat of the empty machine
   * is free it is the seat; when a neighbour leans over it, the item is laid back less far,
   * down to where it clears the neighbour. `seat` is null when the item does not come down
   * between these tines at all; otherwise `free` says whether `place` would accept the seat
   * now, and `blockedBy` what is in the way when it would not.
   */
  private seatIn(
    item: ItemDef,
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    slot: MachineGeometry['affordances']['tineRows'][number]['slots'][number],
    face: Vec3,
  ): { seat: Seat | null; free: boolean; blockedBy: readonly string[] } {
    const P = SESSION_PARAMETERS;
    const others = [...this.placed.keys()];
    const top = Math.floor(radToDeg(Math.max(slot.lean, 0)) + 1e-6);
    const low = -P.seatForwardLean;
    const slotKey = [item.level.itemType, rack, row.rowId, slot.index].join('|');
    let base = this.slotSeats.get(slotKey);
    if (base === undefined) {
      let shared = SEATS_BY_MACHINE.get(this.spec);
      if (shared === undefined) {
        shared = new Map();
        SEATS_BY_MACHINE.set(this.spec, shared);
      }
      const sharedKey = `${this.sceneKey}|${slotKey}`;
      base = shared.get(sharedKey);
      if (base === undefined) {
        base = this.emptySeat(item, rack, row, slot, face, top, low);
        shared.set(sharedKey, base);
      }
      this.slotSeats.set(slotKey, base);
    }
    if (base.seat === null) {
      return {
        seat: null,
        free: false,
        blockedBy: base.blockedBy === undefined ? [] : [base.blockedBy],
      };
    }
    const seat0 = base.seat;
    if (this.placed.has(item.id)) return { seat: seat0, free: false, blockedBy: [] };
    // A basket is loaded only while it is pulled out: `place` answers 'tub' for one pushed in.
    if (this.frameIsIn(rack)) return { seat: seat0, free: false, blockedBy: ['tub'] };

    // The lower edge of another item stands in this very gap, between the two rails that hold
    // a plate here: the slot is taken.
    const along = row.runs === 'x' ? 0 : 1;
    const across = 1 - along;
    const tineA = row.tines[slot.index] as { base: Vec3 };
    const tineB = row.tines[slot.index + 1] as { base: Vec3 };
    const gapLo = Math.min(tineA.base[along] as number, tineB.base[along] as number);
    const gapHi = Math.max(tineA.base[along] as number, tineB.base[along] as number);
    const partner = this.scene.geometry.affordances.tineRows.find(
      (other) => other.frame === rack && other.rowId === row.partner?.rowId,
    );
    const railA = slot.centre[across] as number;
    const railB = (partner?.rail[0][across] as number | undefined) ?? railA;
    // (A seat on the floor beside the rails is taken by what stands where it is.)
    const lowerEdge =
      seat0.floor === true
        ? (bodyPoseInTub(
            POSE_IDENTITY,
            seat0.position,
            resolveOrientation(edgeOrientation([face[0], face[1]], seat0.leanDeg), item.presets)
              ?.unit as Quat,
            item.instance.referencePoint,
          ).p[across] as number)
        : null;
    const acrossLo = lowerEdge ?? Math.min(railA, railB);
    const acrossHi = lowerEdge ?? Math.max(railA, railB);
    // (On the floor beside the rails nothing holds a lower edge between the feet of the two
    // tines: a plate leaning there has its edge a tine's foot further along. It is in this slot
    // when it passes between the two tines half way up them. [MEASURED 2026-10-11, review of
    // the loading: a 170 mm plate seated in the third slot of row C front had its lower edge
    // 0.7 mm beyond the foot of the far tine, and the slot was offered twice more.])
    const tineAt = (tine: { base: Vec3; tip: Vec3 }, z: number): number => {
      const t = Math.min(1, Math.max(0, (z - tine.base[2]) / (tine.tip[2] - tine.base[2])));
      return (
        (tine.base[along] as number) +
        t * ((tine.tip[along] as number) - (tine.base[along] as number))
      );
    };
    const fullA = row.tines[slot.index] as { base: Vec3; tip: Vec3 };
    const fullB = row.tines[slot.index + 1] as { base: Vec3; tip: Vec3 };
    const halfUp = (fullA.base[2] + fullA.tip[2] + fullB.base[2] + fullB.tip[2]) / 4;
    const betweenTines = (edge: { at: Vec3; origin: Vec3 }): boolean => {
      if (seat0.floor !== true) {
        return (edge.at[along] as number) > gapLo && (edge.at[along] as number) < gapHi;
      }
      const rise = edge.origin[2] - edge.at[2];
      const t = rise > 1e-6 ? Math.min(1, Math.max(0, (halfUp - edge.at[2]) / rise)) : 0;
      const crossing =
        (edge.at[along] as number) +
        t * ((edge.origin[along] as number) - (edge.at[along] as number));
      const a = tineAt(fullA, halfUp);
      const b = tineAt(fullB, halfUp);
      return crossing > Math.min(a, b) && crossing < Math.max(a, b);
    };
    const standing = this.lowerEdges
      .filter(
        (edge) =>
          edge.id !== item.id &&
          betweenTines(edge) &&
          (edge.at[across] as number) > acrossLo - 0.03 &&
          (edge.at[across] as number) < acrossHi + 0.03 &&
          edge.at[2] < row.railTopZ + 0.02,
      )
      .map((edge) => edge.id);
    if (standing.length > 0) {
      return {
        seat: seat0,
        free: false,
        blockedBy: standing.map((id) => this.nameOf(id)).sort(compareIds),
      };
    }

    // The seat of the empty machine, in the scene as it is.
    const framePose = this.framePose(rack);
    const q = resolveOrientation(edgeOrientation([face[0], face[1]], seat0.leanDeg), item.presets)
      ?.unit as Quat;
    const pose = bodyPoseInTub(framePose, seat0.position, q, item.instance.referencePoint);
    const overlap = this.world.penetration(item.pieces, pose);
    // A loose part of the machine stands where the item would (the cutlery basket in front of a
    // large plate): the slot is not free. The item is not stood upright or moved along the
    // rails instead: a round plate cradled between two rails rolls back to the middle and ends
    // on the part, and upright it falls against its tines. [MEASURED 2026-10-10: a 27 cm plate
    // seated upright behind the cutlery basket ended 30 mm high on the basket's foot, or 16
    // degrees against the tines.]
    const fixed = this.world.penetration(item.pieces, pose, [...this.placed.keys()]);
    const parts = fixed.with.filter((id) => id !== rack);
    if (fixed.depth > P.seatOverlap && parts.length > 0) {
      return {
        seat: seat0,
        free: false,
        blockedBy: [...new Set(parts.map((id) => this.nameOf(id)))].sort(compareIds),
      };
    }
    if (overlap.depth <= P.seatOverlap) {
      const path = this.sweepFromAbove(item, pose, rack, [], this.lastApproach);
      if (path.clear) {
        this.lastApproach = path.along;
        return { seat: seat0, free: true, blockedBy: [] };
      }
      if (path.blockedId !== undefined && !this.placed.has(path.blockedId)) {
        // Something that is no item hangs over the way down (the basket above): the seat of
        // the empty machine was found with it there, so this is rare. Not free.
        return { seat: seat0, free: false, blockedBy: [path.blockedBy ?? path.blockedId] };
      }
    }
    // A neighbour leans over the slot or over the way into it: lay the item back less far.
    const fitted = this.findSeat(
      item,
      rack,
      row,
      slot,
      face,
      [],
      seat0.leanDeg - 1,
      low,
      true,
      [seat0.shift ?? 0],
      seat0.floor === true,
    );
    if (fitted.seat !== null) return { seat: fitted.seat, free: true, blockedBy: [] };
    const names = overlap.with
      .filter((id) => this.placed.has(id))
      .map((id) => this.nameOf(id))
      .sort(compareIds);
    return {
      seat: seat0,
      free: false,
      blockedBy:
        names.length > 0
          ? names
          : fitted.blockedBy === undefined
            ? []
            : [this.nameOf(fitted.blockedBy)],
    };
  }

  /**
   * The seat of an item in a slot of the empty machine: with no item in it and without the
   * cutlery basket, a loose part that is tested afterwards like an item (`seatIn`). Had it been
   * part of the search, the lean found beside it would have become the lean tried in every
   * other slot of the kind: with the basket at the front centre the 27 cm plate was offered
   * upright in fourteen of the 22 rear slots. [MEASURED 2026-10-10, review of the loading.]
   *
   * An item that stands taller on edge than the height clear over the whole basket has no
   * seat, whatever the tines allow: it could be let down into the pulled-out basket and the
   * basket could never be pushed in. `blockedBy` is then 'tub'.
   */
  private emptySeat(
    item: ItemDef,
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    slot: MachineGeometry['affordances']['tineRows'][number]['slots'][number],
    face: Vec3,
    top: number,
    low: number,
  ): { seat: Seat | null; blockedBy?: string } {
    const upright = resolveOrientation(edgeOrientation([face[0], face[1]], 0), item.presets)
      ?.unit as Quat;
    const box = boundingBox(item.instance.shape, { p: [0, 0, 0], q: upright });
    const envelope = this.scene.geometry.affordances.baskets.find((b) => b.frame === rack);
    const clear = Math.min(
      Infinity,
      ...(envelope?.overhead ?? [])
        .filter((o) => o.region.kind === 'everywhere')
        .map((o) => o.clearHeight),
    );
    if (box.max[2] - box.min[2] > clear + SESSION_PARAMETERS.protrusionTolerance) {
      return { seat: null, blockedBy: 'tub' };
    }
    const ignore = [
      ...this.placed.keys(),
      ...this.scene.bodies.filter((b) => b.part.frame === 'cutlery_basket').map((b) => b.id),
    ];
    const kindKey = [
      this.sceneKey,
      item.level.itemType,
      rack,
      row.rowId,
      slot.leanToward,
      Math.round(radToDeg(slot.lean)),
      Math.round(slot.clearWidth * 1000),
      Math.round(slot.pitch * 1000),
    ].join('|');
    let hints = SEAT_HINTS_BY_MACHINE.get(this.spec);
    if (hints === undefined) {
      hints = new Map();
      SEAT_HINTS_BY_MACHINE.set(this.spec, hints);
    }
    const hint = hints.get(kindKey);
    let found: Seat | null;
    if (hint === undefined || 'none' in hint) {
      const fails = hint === undefined ? 0 : hint.none;
      if (fails >= SESSION_PARAMETERS.seatKindFails) return { seat: null };
      found = this.findSeat(item, rack, row, slot, face, ignore, top, low, false).seat;
      // Not on the two rails: where the floor of the basket is not level, on the floor
      // beside them, where the item comes lowest across the row, if it comes down between
      // the tines there.
      const relief = this.spec.baskets.find((b) => b.frame === rack)?.floor.relief ?? null;
      if (found === null && relief !== null) {
        // (Where it comes lowest standing upright; a plate too thick to stand upright between
        // these tines is tried where a plate usually stands, tipped: it may wedge between
        // the tines a few millimetres above the rails and stand there.)
        const lowest = this.lowestAcross(item, rack, row, slot, face, ignore) ?? 0;
        found = this.findSeat(
          item,
          rack,
          row,
          slot,
          face,
          ignore,
          top,
          low,
          false,
          [lowest],
          true,
        ).seat;
      }
      hints.set(
        kindKey,
        found === null
          ? { none: fails + 1 }
          : { leanDeg: found.leanDeg, shift: found.shift ?? 0, floor: found.floor === true },
      );
    } else {
      // A slot a little narrower than the first of its kind may need a degree or two less.
      found = this.findSeat(
        item,
        rack,
        row,
        slot,
        face,
        ignore,
        Math.min(top, hint.leanDeg + 1),
        hint.leanDeg - 3,
        false,
        [hint.shift],
        hint.floor,
      ).seat;
      found ??= this.findSeat(
        item,
        rack,
        row,
        slot,
        face,
        ignore,
        top,
        low,
        false,
        [hint.shift],
        hint.floor,
      ).seat;
    }
    return { seat: found };
  }

  /**
   * How far across a row from the middle between its rails (`acrossFor`) an item held upright
   * on edge over a slot comes lowest when it is let straight down, the bodies in `ignore` left
   * out: the place the floor of the basket cradles it. Looked for either side of the rail of
   * the row as far as the tines still hold the item (`seatFloorReach` of its half width).
   * Null when it is nowhere let down to the level of the rail between these tines.
   */
  private lowestAcross(
    item: ItemDef,
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    slot: MachineGeometry['affordances']['tineRows'][number]['slots'][number],
    face: Vec3,
    ignore: readonly string[],
  ): number | null {
    const P = SESSION_PARAMETERS;
    const tineA = row.tines[slot.index] as { base: Vec3; tip: Vec3 };
    const tineB = row.tines[slot.index + 1] as { base: Vec3; tip: Vec3 };
    const along = row.runs === 'x' ? 0 : 1;
    const across = 1 - along;
    const q = resolveOrientation(edgeOrientation([face[0], face[1]], 0), item.presets)
      ?.unit as Quat;
    const box = boundingBox(item.instance.shape, { p: [0, 0, 0], q });
    const end = lowerEndOf(item.pieces, q, 0.001);
    const framePose = this.framePose(rack);
    const skip = [...ignore];
    const middle = ((box.min[across] as number) + (box.max[across] as number)) / 2;
    const half = ((box.max[across] as number) - (box.min[across] as number)) / 2;
    const rail = slot.centre[across] as number;
    const usual = this.acrossFor(rack, row, slot, box);
    const gap =
      ((tineA.base[along] as number) + (tineB.base[along] as number)) / 2 -
      (end.centre[along] as number);
    const top = Math.max(tineA.tip[2], tineB.tip[2]) + P.suggestDropClearance - box.min[2];
    const bottom = row.railTopZ - P.seatDeepest - end.z;
    let best: { at: number; height: number } | null = null;
    const steps = Math.floor((P.seatFloorReach * half) / P.seatFloorStep);
    for (let i = -steps; i <= steps; i++) {
      const at = rail - middle + i * P.seatFloorStep;
      const origin = (height: number): Vec3 => {
        const p: [number, number, number] = [0, 0, height];
        p[along] = gap;
        p[across] = at;
        return p;
      };
      const depthAt = (height: number): number =>
        this.world.penetration(
          item.pieces,
          bodyPoseInTub(framePose, origin(height), q, [0, 0, 0]),
          skip,
        ).depth;
      // Down at the level of the rail it must be free (one test settles most places), and
      // free above the tine tips, from where it is let down.
      let free = row.railTopZ + P.seatFloorAboveRail - end.z;
      let stopped = bottom;
      if (depthAt(free) > 1e-5 || depthAt(top) > 1e-5 || depthAt(stopped) <= 1e-5) continue;
      while (free - stopped > 0.0006) {
        const mid = (free + stopped) / 2;
        if (depthAt(mid) <= 1e-5) free = mid;
        else stopped = mid;
      }
      if (
        best === null ||
        free < best.height - 0.0005 ||
        (Math.abs(free - best.height) <= 0.0005 && Math.abs(at - usual) < Math.abs(best.at - usual))
      ) {
        best = { at, height: free };
      }
    }
    return best === null ? null : best.at - usual;
  }

  /**
   * Looks for the seat of an item in a slot (see `slotSuggestion`): for each lean from
   * `maxLeanDeg` down to `minLeanDeg`, and each place of the lower edge in the gap from the
   * tine in front of the face back, the item is taken down along the tines from where it is
   * 3 mm above resting on the rails to where it touches something; it is seated when it gets
   * that far at all. The pose is then put on the grid `place` takes (whole millimetres and
   * degrees), a millimetre or so above where it touches, and must be free there with a little
   * room along the rail. With `checkPath` it must also be reachable from above along the
   * tines, as `place` requires. The bodies in `ignore` are left out throughout. The item is
   * moved across the row only when something other than the wires of the basket was in its
   * way (a shelf, the basket above). Returns the first seat found, or null with the body that
   * stood in the way down of a pose that was otherwise free, if one did.
   *
   * Static overlap tests are used on the way down, not a sweep: a sweep of a plate through a
   * basket costs 3 to 8 ms, an overlap test 0.07 ms. [MEASURED 2026-10-10]
   */
  private findSeat(
    item: ItemDef,
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    slot: MachineGeometry['affordances']['tineRows'][number]['slots'][number],
    face: Vec3,
    ignore: readonly string[],
    maxLeanDeg: number,
    minLeanDeg: number,
    checkPath: boolean,
    shifts: readonly number[] = SESSION_PARAMETERS.seatAcrossShifts,
    onFloor = false,
  ): { seat: Seat | null; blockedBy?: string } {
    const P = SESSION_PARAMETERS;
    const tineA = row.tines[slot.index] as { base: Vec3; tip: Vec3 };
    const tineB = row.tines[slot.index + 1] as { base: Vec3; tip: Vec3 };
    const along = row.runs === 'x' ? 0 : 1;
    const across = 1 - along;
    const framePose = this.framePose(rack);
    const wire = slot.pitch - slot.clearWidth;
    const lo =
      Math.min(tineA.base[along] as number, tineB.base[along] as number) +
      wire / 2 +
      P.seatGapMargin;
    const hi =
      Math.max(tineA.base[along] as number, tineB.base[along] as number) -
      wire / 2 -
      P.seatGapMargin;
    // Down along the two tines of the slot.
    const down = v3Normalise(v3Add(v3Sub(tineA.base, tineA.tip), v3Sub(tineB.base, tineB.tip)));
    if (!(down[2] < 0)) return { seat: null };
    const top = Math.min(Math.floor(radToDeg(Math.max(slot.lean, 0)) + 1e-6), maxLeanDeg);
    const skip = [...ignore];
    const own = new Set(this.basketOfFrame(rack)?.bodies ?? []);
    const places = Math.max(1, Math.floor((hi - lo) / P.seatGapStep + 1e-9));
    const frontAtHi = (face[along] as number) > 0;
    let blockedBy: string | undefined;
    let sweeps = 0;
    for (const shift of shifts) {
      // Whether something other than the basket's own wires was met: only then does moving
      // across the row help.
      let foreign = false;
      for (let leanDeg = top; leanDeg >= minLeanDeg; leanDeg--) {
        const q = resolveOrientation(edgeOrientation([face[0], face[1]], leanDeg), item.presets)
          ?.unit as Quat;
        const end = lowerEndOf(item.pieces, q, 0.001);
        const box = boundingBox(item.instance.shape, { p: [0, 0, 0], q });
        const at = this.acrossFor(rack, row, slot, box) + shift;
        // Height of the item's origin when it rests on the rails alone; an item that passes
        // between them counts as down once its lowest point is at the top of the rail.
        const resting = this.restOnRails(item, q, rack, row, at);
        const seatedAt = Number.isFinite(resting) ? resting + P.seatOnRail : row.railTopZ - end.z;
        const overlapAt = (origin: Vec3): { depth: number; with: readonly string[] } =>
          this.world.penetration(item.pieces, bodyPoseInTub(framePose, origin, q, [0, 0, 0]), skip);
        const poses: Vec3[] = [];
        const seen = new Set<string>();
        for (let k = 0; k <= places; k++) {
          const gap = frontAtHi ? hi - ((hi - lo) * k) / places : lo + ((hi - lo) * k) / places;
          // The item just down in the slot with its lower edge at this place of the gap, and
          // the same moved by `height` along the tines.
          const start: [number, number, number] = [0, 0, 0];
          start[along] = gap - (end.centre[along] as number);
          start[across] = at;
          start[2] = seatedAt;
          // On the floor beside the rails the item comes straight down instead, to wherever
          // it touches, and is seated when its lowest point is then down at the level of the
          // rail: between the tines, not on them.
          const raised = (height: number): Vec3 =>
            onFloor
              ? [start[0], start[1], start[2] + height]
              : v3AddScaled(start, down, height / down[2]);
          // (Where it cannot be at the level that counts as down, the place is given up after
          // that one test: nearly all the cost of a slot that has no seat.)
          let free = onFloor ? row.railTopZ + P.seatFloorAboveRail - end.z - seatedAt : 0;
          const first = overlapAt(raised(free));
          if (first.depth > 1e-5) {
            if (first.with.some((id) => !own.has(id) && !this.placed.has(id))) foreign = true;
            continue;
          }
          let stopped: number = onFloor
            ? row.railTopZ - P.seatDeepest - end.z - seatedAt
            : -P.seatDeepest;
          if (overlapAt(raised(stopped)).depth <= 1e-5) continue; // nothing holds it up
          while (free - stopped > 0.0006) {
            const middle = (free + stopped) / 2;
            if (overlapAt(raised(middle)).depth <= 1e-5) free = middle;
            else stopped = middle;
          }
          // On the grid: the reference point to whole millimetres, the height rounded up from
          // a millimetre above where it touches.
          const reference = v3Add(
            raised(free + P.seatLift),
            quatRotate(q, item.instance.referencePoint),
          );
          const position: Vec3 = [
            Math.round(reference[0] * 1000) / 1000,
            Math.round(reference[1] * 1000) / 1000,
            Math.ceil(reference[2] * 1000 - 1e-6) / 1000,
          ];
          const name = position.map((x) => Math.round(x * 1000)).join(',');
          if (seen.has(name)) continue;
          seen.add(name);
          // On the grid the pose may touch a wire by a hair: `place` takes up to 0.5 mm, and
          // less than half of that is asked here, so that the settle has little to push apart.
          const snapped = this.world.penetration(
            item.pieces,
            bodyPoseInTub(framePose, position, q, item.instance.referencePoint),
            skip,
          );
          if (snapped.depth <= P.seatOverlap) poses.push(position);
        }
        let overhead = false;
        for (const position of poses) {
          const seat: Seat = {
            leanDeg,
            position,
            seated: true,
            shift,
            ...(onFloor ? { floor: true } : {}),
          };
          if (!checkPath) return { seat };
          const pose = bodyPoseInTub(framePose, position, q, item.instance.referencePoint);
          const path = this.sweepFromAbove(item, pose, rack, ignore);
          sweeps += 1;
          if (path.clear)
            return { seat: { ...seat, ...(path.along ? { along: path.along } : {}) } };
          blockedBy = path.blockedId ?? '?';
          if (!this.placed.has(blockedBy)) {
            // The basket above hangs over the way down: it will for every lean here.
            overhead = true;
            foreign = true;
            break;
          }
          if (sweeps >= P.seatSweepsMax) return { seat: null, blockedBy };
        }
        if (overhead) break;
      }
      if (!foreign) break;
    }
    return blockedBy === undefined ? { seat: null } : { seat: null, blockedBy };
  }

  /**
   * The height of an item's origin above the rack-frame origin at which the item, held at
   * orientation `q` (rack frame) with its origin at `at` across the row, rests on the rail of
   * the row and that of its partner row and on nothing else: the rails as round wires, the item
   * as the corner points and edges of its collision pieces. Minus infinity when no part of it
   * is over a rail (it passes between them).
   */
  private restOnRails(
    item: ItemDef,
    q: Quat,
    rack: RackId,
    row: MachineGeometry['affordances']['tineRows'][number],
    at: number,
  ): number {
    const across = row.runs === 'x' ? 1 : 0;
    const partner = this.scene.geometry.affordances.tineRows.find(
      (other) => other.frame === rack && other.rowId === row.partner?.rowId,
    );
    const rails = [row, ...(partner === undefined ? [] : [partner])].map((r) => ({
      // Across the row relative to the item's origin; the centre of the wire and its radius.
      c: (r.rail[0][across] as number) - at,
      z: r.rail[0][2],
      radius: r.railTopZ - r.rail[0][2],
    }));
    let height = -Infinity;
    const visit = (a: Vec3, b: Vec3, rounding: number): void => {
      for (const rail of rails) {
        const reach = rail.radius + rounding;
        const a0 = a[across] as number;
        const b0 = b[across] as number;
        if (Math.min(a0, b0) > rail.c + reach || Math.max(a0, b0) < rail.c - reach) continue;
        // The points of the segment over the rail, where it is nearest the wire.
        for (let i = -4; i <= 4; i++) {
          const offset = (reach * i) / 4;
          const want = rail.c + offset;
          let t: number;
          if (Math.abs(b0 - a0) < 1e-12) {
            if (Math.abs(a0 - want) > reach / 8) continue;
            t = 0;
          } else {
            t = (want - a0) / (b0 - a0);
            if (t < 0 || t > 1) continue;
          }
          for (const tt of Math.abs(b0 - a0) < 1e-12 ? [0, 1] : [t]) {
            const z = a[2] + (b[2] - a[2]) * tt;
            const d = Math.abs(a0 + (b0 - a0) * tt - rail.c);
            if (d > reach) continue;
            height = Math.max(height, rail.z + Math.sqrt(reach * reach - d * d) - z);
          }
        }
        for (const p of [a, b]) {
          const d = Math.abs((p[across] as number) - rail.c);
          if (d <= reach) {
            height = Math.max(height, rail.z + Math.sqrt(reach * reach - d * d) - p[2]);
          }
        }
      }
    };
    for (const piece of item.pieces) {
      if (piece.kind === 'round') continue;
      let points: Vec3[];
      if (piece.kind === 'hull') points = piece.points.map((p) => quatRotate(q, p));
      else if (piece.kind === 'capsule') points = [quatRotate(q, piece.a), quatRotate(q, piece.b)];
      else {
        const h = piece.halfExtents;
        points = [];
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            for (const sz of [-1, 1]) {
              points.push(
                quatRotate(
                  q,
                  v3Add(piece.pose.p, quatRotate(piece.pose.q, [sx * h[0], sy * h[1], sz * h[2]])),
                ),
              );
            }
          }
        }
      }
      for (let i = 0; i < points.length; i++) {
        for (let j = i; j < points.length; j++) {
          visit(points[i] as Vec3, points[j] as Vec3, piece.radius);
        }
      }
    }
    return height;
  }

  /**
   * What stands in the way of a suggested position that `place` would refuse as
   * `out_of_bounds`, or null when the position is inside its frame: the roof of the tub for a
   * position above it, else the wall of the frame, which the item would stand outside of (a
   * frying pan held on edge over an end slot has its middle beyond the side of the basket).
   */
  private outsideFrame(frame: FrameId, position: Vec3): string | null {
    if (this.inBounds(frame, position)) return null;
    const framePose = this.framePose(frame);
    const height = framePose.p[2] + quatRotate(framePose.q, position)[2];
    if (height > this.spec.tub.z[1]) return this.nameOf('tub', 'roof');
    return frame === 'tub' ? 'tub' : this.nameOf(frame, 'wall');
  }

  /**
   * The test `place` applies to a pose, for a suggested drop: whether it is inside its frame,
   * free of everything in the scene as it is now and can be reached from above, and if not
   * what is in the way.
   */
  private dropTest(
    item: ItemDef,
    frame: FrameId,
    position: Vec3,
    q: Quat,
    first?: Vec3,
  ): Pick<SlotCard, 'drop_free' | 'drop_blocked_by'> {
    if (this.placed.has(item.id)) return {};
    const outside = this.outsideFrame(frame, position);
    if (outside !== null) return { drop_free: false, drop_blocked_by: [outside] };
    const pose = bodyPoseInTub(this.framePose(frame), position, q, item.instance.referencePoint);
    const overlap = this.world.penetration(item.pieces, pose);
    if (overlap.depth > SESSION_PARAMETERS.penetrationTolerance) {
      return {
        drop_free: false,
        drop_blocked_by: this.namesOf(overlap),
      };
    }
    if (this.aboveRoof(item, pose) > SESSION_PARAMETERS.penetrationTolerance) {
      return { drop_free: false, drop_blocked_by: [this.nameOf('tub', 'roof')] };
    }
    const path = this.sweepFromAbove(item, pose, frame, [], first);
    if (path.clear) return { drop_free: true };
    return {
      drop_free: false,
      drop_blocked_by: path.blockedBy === undefined ? [] : [path.blockedBy],
    };
  }

  /**
   * Where to let an item go so that it stands in a cell of the cutlery basket: found by
   * trying places across the opening of the cell, nearest its centre first, against the
   * collision shape of the basket and whatever stands in it, with the item upright (its
   * `handle_down` preset, else `handle_up`; an item with neither is not cutlery and gets no
   * suggestion). It is the lower end of the item that is put over the place, not the middle of
   * its bounding box: the end that goes into the cell first, which for a spoon or a ladle is
   * tens of millimetres from the middle. The test is the one `place` applies. No suggestion
   * when the item has no such preset or nothing tried is free.
   */
  private cellSuggestion(
    box: { readonly min: Vec3; readonly max: Vec3 },
    item: ItemDef,
  ): Pick<SlotCard, 'suggested_orientation' | 'suggested_drop' | 'drop_free'> {
    const P = SESSION_PARAMETERS;
    const preset = ['handle_down', 'handle_up'].find((name) => item.presets.has(name));
    if (preset === undefined || this.placed.has(item.id)) return {};
    const orientation = { preset };
    const q = resolveOrientation(orientation, item.presets)?.unit;
    if (q === undefined) return {};
    const end = lowerEndOf(item.pieces, q, P.cutleryEndBand);
    const reference = quatRotate(q, item.instance.referencePoint);
    const framePose = this.framePose('cutlery_basket');
    const centre: Vec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, 0];
    const candidates: Vec3[] = [];
    const nx = Math.floor((box.max[0] - box.min[0]) / 2 / P.cutlerySearchStep);
    const ny = Math.floor((box.max[1] - box.min[1]) / 2 / P.cutlerySearchStep);
    for (let i = -nx; i <= nx; i++) {
      for (let j = -ny; j <= ny; j++) {
        candidates.push([
          centre[0] + i * P.cutlerySearchStep,
          centre[1] + j * P.cutlerySearchStep,
          0,
        ]);
      }
    }
    // Nearest the centre first; ties in a fixed order, so that the answer is a function of
    // the scene alone.
    candidates.sort(
      (a, b) => v3Distance(a, centre) - v3Distance(b, centre) || a[0] - b[0] || a[1] - b[1],
    );
    const z = box.min[2] + P.cutleryDropHeight - end.z + reference[2];
    for (const candidate of candidates.slice(0, P.cutlerySearchMax)) {
      const position = quantisePosition(
        v3mm([
          candidate[0] - (end.centre[0] as number) + reference[0],
          candidate[1] - (end.centre[1] as number) + reference[1],
          z,
        ]),
      );
      if (!this.inBounds('cutlery_basket', position.m)) continue;
      const pose = bodyPoseInTub(framePose, position.m, q, item.instance.referencePoint);
      const overlap = this.world.penetration(item.pieces, pose);
      if (overlap.depth > P.penetrationTolerance) continue;
      if (!this.sweepFromAbove(item, pose, 'cutlery_basket').clear) continue;
      return {
        suggested_orientation: orientation,
        suggested_drop: {
          position_mm: [position.mm[0], position.mm[1], position.mm[2]],
          orientation,
        },
        drop_free: true,
      };
    }
    return {};
  }

  /**
   * Where a cup, a mug or a small glass is let go so that it stands on a cup shelf that is
   * folded down, for a slot of kind `cup_shelf`: mouth down and level, its handle along the
   * shelf towards the rear, in the middle of the shelf across it, at the rearmost place along
   * it that is free of what stands there (`restAlongStep` apart, `restGap` clear of the
   * boxes of what is in the basket), its rim `shelfDropHeight` above the shelf. The test is
   * the one `place` applies. Nothing for an item that is no vessel (it stands on edge or on
   * its handle) or that is wider than the shelf by more than `shelfWidthRatio`.
   * [MEASURED 2026-10-11: espresso cups, tea cups and mugs let go so stand level on both
   * shelves of the Bosch and do not move when the basket travels; `shelves.test.ts`.]
   */
  private shelfSuggestion(
    rack: RackId,
    surface: {
      readonly x: readonly [number, number];
      readonly y: readonly [number, number];
      readonly z: number;
    },
    item: ItemDef | undefined,
  ): Pick<SlotCard, 'suggested_orientation' | 'suggested_drop' | 'drop_free' | 'drop_blocked_by'> {
    if (item === undefined || this.placed.has(item.id) || !item.presets.has('inverted')) return {};
    for (const other of ['on_edge', 'on_long_edge', 'handle_down', 'handle_up']) {
      if (item.presets.has(other)) return {};
    }
    const P = SESSION_PARAMETERS;
    const orientation = { preset: 'inverted', yaw_deg: 90 };
    const q = resolveOrientation(orientation, item.presets)?.unit;
    if (q === undefined) return {};
    const reach = boundingBox(item.instance.shape, { p: [0, 0, 0], q });
    const width = surface.x[1] - surface.x[0];
    if (reach.max[0] - reach.min[0] > P.shelfWidthRatio * width) return {};
    const millimetre = (v: number): number => Math.round(v * 1000) / 1000;
    const rear = millimetre(surface.y[1] - P.shelfEndClearance - reach.max[1]);
    const front = millimetre(surface.y[0] + P.shelfEndClearance - reach.min[1]);
    if (!(rear >= front)) return {};
    // What stands taller on the shelf than the height clear over the whole basket could be set
    // down while the basket is out and would be knocked off when it goes in: no seat.
    const clear = Math.min(
      Infinity,
      ...(this.scene.geometry.affordances.baskets.find((b) => b.frame === rack)?.overhead ?? [])
        .filter((o) => o.region.kind === 'everywhere')
        .map((o) => o.clearHeight),
    );
    if (surface.z + reach.max[2] - reach.min[2] > clear + P.protrusionTolerance) return {};
    const x = (surface.x[0] + surface.x[1]) / 2 - (reach.min[0] + reach.max[0]) / 2;
    const z = surface.z + P.shelfDropHeight - reach.min[2];
    const reference = quatRotate(q, item.instance.referencePoint);
    const framePose = this.framePose(rack);
    const boxes = [...this.placed.keys()].map((id) =>
      boundingBox(
        (this.items.get(id) as ItemDef).instance.shape,
        poseRelative(framePose, this.world.getPose(id)),
      ),
    );
    type Card = Pick<
      SlotCard,
      'suggested_orientation' | 'suggested_drop' | 'drop_free' | 'drop_blocked_by'
    >;
    let first: Card | null = null;
    let tries = 0;
    for (
      let y = rear;
      y >= front - 1e-9 && tries < P.restTries;
      y = millimetre(y - P.restAlongStep)
    ) {
      const taken = boxes.some(
        (box) =>
          box.min[0] < x + reach.max[0] + P.restGap &&
          box.max[0] > x + reach.min[0] - P.restGap &&
          box.min[1] < y + reach.max[1] + P.restGap &&
          box.max[1] > y + reach.min[1] - P.restGap &&
          box.min[2] < z + reach.max[2] &&
          box.max[2] > z + reach.min[2],
      );
      if (taken) continue;
      tries += 1;
      const position = quantisePosition(v3mm(v3Add([x, y, z], reference)));
      const card: Card = {
        suggested_orientation: orientation,
        suggested_drop: {
          position_mm: [position.mm[0], position.mm[1], position.mm[2]],
          orientation,
        },
        ...(this.frameIsIn(rack)
          ? { drop_free: false, drop_blocked_by: ['tub'] }
          : this.dropTest(item, rack, position.m, q)),
      };
      if (card.drop_free === true || this.frameIsIn(rack)) return card;
      first ??= card;
    }
    return first ?? {};
  }

  /**
   * Whether an item is a vessel that stands mouth down on a sloped side rest: it has an
   * `inverted` preset, it is no plate, bowl or piece of cutlery (nothing that stands on edge
   * or on its handle), its body is not much wider than the rest nor its handle side much
   * longer, and it is not so tall that it leans out over the wall of the basket.
   */
  private standsOnRest(item: ItemDef, rest: SideRestZone): boolean {
    const P = SESSION_PARAMETERS;
    if (!item.presets.has('inverted')) return false;
    for (const other of ['on_edge', 'on_long_edge', 'handle_down', 'handle_up']) {
      if (item.presets.has(other)) return false;
    }
    const { min, max } = item.instance.bbox;
    const across = Math.abs(rest.wallX - rest.peakX);
    const envelope = this.scene.geometry.affordances.baskets.find(
      (b) => b.basketId === rest.basketId,
    );
    const wall = envelope?.rimTopZ[rest.restId] ?? Infinity;
    return (
      Math.min(max[0] - min[0], max[1] - min[1]) <= P.restWidthRatio * across &&
      Math.max(max[0] - min[0], max[1] - min[1]) <= P.restLengthRatio * across &&
      max[2] - min[2] <= P.restHeightOverWall * wall
    );
  }

  /**
   * Where a cup, a mug or a glass is let go so that it stands on a sloped rest along a side
   * wall of a basket, for a slot of kind `cup_rest`.
   *
   * The vessel is held as a hand sets it on such a rest: mouth down, tilted towards the wall
   * with the slope, so that its opening looks down and towards the middle of the basket and
   * the hollow of its base drains, its handle along the rest towards the rear. The seat across
   * the rest is found without the physics (`restSeat`); along the rest it is the rearmost place
   * that is free of what stands there. The suggested pose is a millimetre above where the
   * vessel touches down, on the grid `place` takes. `drop_free` is the test `place` applies:
   * under a shelf that is folded down the seat is not free, and `drop_blocked_by` names the
   * shelf (it can be folded up, the vessel set down and the shelf folded down again over it if
   * the vessel is low enough).
   */
  private restSuggestion(
    rack: RackId,
    rest: SideRestZone,
    item: ItemDef | undefined,
  ): Pick<SlotCard, 'suggested_orientation' | 'suggested_drop' | 'drop_free' | 'drop_blocked_by'> {
    if (item === undefined || this.placed.has(item.id) || !this.standsOnRest(item, rest)) return {};
    const P = SESSION_PARAMETERS;
    const framePose = this.framePose(rack);
    type Card = Pick<
      SlotCard,
      'suggested_orientation' | 'suggested_drop' | 'drop_free' | 'drop_blocked_by'
    >;
    const cardOf = (seat: RestSeat): Card => {
      const position = quantisePosition(v3mm(seat.position));
      return {
        suggested_orientation: seat.orientation,
        suggested_drop: {
          position_mm: [position.mm[0], position.mm[1], position.mm[2]],
          orientation: seat.orientation,
        },
        ...(this.frameIsIn(rack)
          ? { drop_free: false, drop_blocked_by: ['tub'] }
          : this.dropTest(item, rack, position.m, seat.q)),
      };
    };
    // Along the rest: from the rear wall forwards, the vessel clear of the walls.
    const upright = resolveOrientation({ preset: 'inverted', yaw_deg: 90 }, item.presets)
      ?.unit as Quat;
    const reach = boundingBox(item.instance.shape, { p: [0, 0, 0], q: upright });
    const millimetre = (v: number): number => Math.round(v * 1000) / 1000;
    const rear = millimetre(rest.y[1] - P.restEndClearance - reach.max[1]);
    const front = millimetre(rest.y[0] + P.restEndClearance - reach.min[1]);
    if (!(rear >= front)) return {};
    // The seat the vessel has on this rest (at the rear, or where it has one at all), moved
    // along the rest, shows cheaply where something is in its way: only where it is clear of
    // everything, with `restGap` to spare either way along the rest, is the seat of that
    // place worked out and tested as `place` tests it.
    let template: RestSeat | null = null;
    for (const y of [rear, millimetre((rear + front) / 2), front]) {
      template = this.restSeatAt(item, rack, rest, y);
      if (template !== null) break;
    }
    if (template === null) return {};
    if (this.frameIsIn(rack)) return cardOf(template);
    // Cheaply first, by bounding boxes. What stands on this rest already stands in a line
    // with the vessel, turned the same way: its box along the rest is what it takes of the
    // rest, and no overlap test is needed (one costs milliseconds between two mugs that
    // overlap deeply, and a full rest has a hundred such places). What stands elsewhere in
    // the basket (a plate in the rows beside the rest) is tested exactly, and only where its
    // box and the vessel's overlap at all.
    const fixed = this.fixedIds();
    const lo = Math.min(rest.wallX, rest.peakX) - P.restGap;
    const hi = Math.max(rest.wallX, rest.peakX) + P.restGap;
    const onRest: { min: Vec3; max: Vec3 }[] = [];
    const beside: { min: Vec3; max: Vec3 }[] = [];
    for (const id of this.placed.keys()) {
      const box = boundingBox(
        (this.items.get(id) as ItemDef).instance.shape,
        poseRelative(framePose, this.world.getPose(id)),
      );
      if (
        box.max[0] + P.restGap <= template.box.min[0] ||
        box.min[0] - P.restGap >= template.box.max[0] ||
        box.max[2] <= template.box.min[2] ||
        box.min[2] >= template.box.max[2]
      ) {
        continue;
      }
      const middle = (box.min[0] + box.max[0]) / 2;
      (middle > lo && middle < hi ? onRest : beside).push(box);
    }
    const blockedAt = (y: number): boolean => {
      const shift = y - template.origin[1];
      const from = template.box.min[1] + shift - P.restGap;
      const to = template.box.max[1] + shift + P.restGap;
      const meets = (box: { min: Vec3; max: Vec3 }): boolean =>
        box.min[1] < to && box.max[1] > from;
      if (onRest.some(meets)) return true;
      if (!beside.some(meets)) return false;
      for (const dy of [-P.restGap, P.restGap]) {
        const position = v3Add(template.position, [0, shift + dy, 0]);
        const overlap = this.world.penetration(
          item.pieces,
          bodyPoseInTub(framePose, position, template.q, item.instance.referencePoint),
          fixed,
        );
        if (overlap.depth > P.seatOverlap && overlap.with.some((id) => this.placed.has(id))) {
          return true;
        }
      }
      return false;
    };
    let first: Card | null = null;
    let tries = 0;
    for (
      let y = rear;
      y >= front - 1e-9 && tries < P.restTries;
      y = millimetre(y - P.restAlongStep)
    ) {
      // (A shelf folded down over the rest is met by the test below, which names it.)
      if (blockedAt(y)) continue;
      tries += 1;
      const seat = this.restSeatAt(item, rack, rest, y);
      if (seat === null) continue;
      const card = cardOf(seat);
      if (card.drop_free === true) return card;
      first ??= card;
      // Something of the machine is over this stretch of the rest (a shelf folded down): on
      // by a longer step.
      if (!(card.drop_blocked_by ?? []).some((name) => this.items.has(name))) {
        y = millimetre(y - P.restShelfStep + P.restAlongStep);
      }
    }
    return first ?? {};
  }

  /**
   * The seat of a type of vessel on a side rest at the place `y` along it in the machine as it
   * is configured, with no item in it: with the shelves of the basket as they are if the
   * vessel can be let down there, else as if they were not there (a seat under a shelf that is
   * folded down is a seat, only not one that can be reached until the shelf is folded up).
   * A function of the machine, its configuration, the type of item and `y` alone, so it is
   * worked out once per process (`REST_SEATS_BY_MACHINE`).
   */
  private restSeatAt(item: ItemDef, rack: RackId, rest: SideRestZone, y: number): RestSeat | null {
    const P = SESSION_PARAMETERS;
    let shared = REST_SEATS_BY_MACHINE.get(this.spec);
    if (shared === undefined) {
      shared = new Map();
      REST_SEATS_BY_MACHINE.set(this.spec, shared);
    }
    const kind = [this.sceneKey, item.level.itemType, rack, rest.restId].join('|');
    const key = `${kind}|${Math.round(y * 1000)}`;
    const known = shared.get(key);
    if (known !== undefined) return known;
    const assembly = this.scene.assemblies.find((a) => a.rack === rack);
    const others = [...this.placed.keys()];
    const fittings = (assembly?.bodies ?? []).filter((id) => id !== rack);
    const framePose = this.framePose(rack);
    let seat: RestSeat | null = null;
    // The seat found at another place along the rest is the seat here too where the same
    // wires carry it and the same shelves are over it or not: moved along, it must be free,
    // rest on something when it is lowered a little, and be reached from above.
    const template = shared.get(`${kind}|template`);
    if (template !== undefined && template !== null) {
      const shift: Vec3 = [0, y - template.origin[1], 0];
      const moved: RestSeat = {
        ...template,
        position: v3Add(template.position, shift),
        origin: v3Add(template.origin, shift),
        box: { min: v3Add(template.box.min, shift), max: v3Add(template.box.max, shift) },
      };
      const pose = bodyPoseInTub(framePose, moved.position, moved.q, item.instance.referencePoint);
      const lower = poseShifted(pose, quatRotate(framePose.q, [0, 0, -P.restTouch]));
      const attempts: (readonly [readonly string[], boolean])[] = [
        [others, false],
        [[...others, ...fittings], true],
      ];
      for (const [ignore, underShelf] of attempts) {
        if (seat !== null) break;
        const skip = [...ignore, ...this.fixedIds()];
        if (
          this.world.penetration(item.pieces, pose, skip).depth <= P.seatOverlap &&
          this.world.penetration(item.pieces, lower, skip).depth > P.seatOverlap &&
          this.sweepFromAbove(item, pose, rack, ignore).clear
        ) {
          seat = { ...moved, underShelf };
        }
      }
    }
    if (seat === null) {
      seat = this.restSeat(item, rack, rest, y, others);
      if (seat === null) {
        const under = this.restSeat(item, rack, rest, y, [...others, ...fittings]);
        seat = under === null ? null : { ...under, underShelf: true };
      }
      if (seat !== null && template === undefined) shared.set(`${kind}|template`, seat);
    }
    shared.set(key, seat);
    return seat;
  }

  /**
   * The seat of a vessel on a side rest at the place `y` along it, with the bodies in `ignore`
   * left out: the pose, among those tried (`SESSION_PARAMETERS.restTiltStep` and what follows
   * it), at which the vessel let straight down first touches with its centre of mass lowest,
   * its lowest point down on the rest. Null when there is none (a shelf is over the rest, or
   * the vessel is too wide or too tall for it).
   */
  private restSeat(
    item: ItemDef,
    rack: RackId,
    rest: SideRestZone,
    y: number,
    ignore: readonly string[],
  ): RestSeat | null {
    const P = SESSION_PARAMETERS;
    const assembly = this.scene.assemblies.find((a) => a.rack === rack);
    if (assembly === undefined) return null;
    const framePose = this.framePose(rack);
    const sign = rest.fallsToward === '-x' ? -1 : 1;
    const slopeDeg = Math.round(radToDeg(rest.slope));
    // The shell of the tub is left out, as in `sweepFromAbove`: the rear of a pulled-out
    // basket stays under its roof.
    const skip = [...ignore, ...this.fixedIds()];
    const found: (RestSeat & { energy: number })[] = [];
    for (let k = 0; k < P.restTilts; k++) {
      const tiltDeg = slopeDeg - k * P.restTiltStep;
      if (tiltDeg < P.restTiltMin) break;
      // Tilted towards the wall, the handle (item +x) along the rest to the rear.
      const orientation = { preset: 'inverted', roll_deg: sign * tiltDeg, yaw_deg: 90 };
      const q = resolveOrientation(orientation, item.presets)?.unit;
      if (q === undefined) return null;
      const box = boundingBox(item.instance.shape, { p: [0, 0, 0], q });
      const com = quatRotate(q, item.instance.mass.com);
      const reference = quatRotate(q, item.instance.referencePoint);
      const uphill = sign < 0 ? box.max[0] : box.min[0];
      const downhill = sign < 0 ? box.min[0] : box.max[0];
      const start = rest.peakX - sign * P.restOverhang - uphill;
      const high = P.restStartHeight - box.min[2];
      const low = rest.footZ - P.restDeepest - box.min[2];
      for (let i = 0; i <= P.restStepsMax; i++) {
        const x = start + sign * i * P.restStep;
        // Not beyond the plan of the basket on the side of the wall (its upper part may lean
        // out over the wall wires as far as that).
        if (sign < 0 ? x + downhill < 0 : x + downhill > assembly.outline[0]) break;
        const from = bodyPoseInTub(framePose, [x, y, high], q, [0, 0, 0]);
        if (this.world.penetration(item.pieces, from, skip).depth > 1e-5) continue;
        const hit = this.world.sweep(
          item.pieces,
          from,
          bodyPoseInTub(framePose, [x, y, low], q, [0, 0, 0]),
          skip,
        );
        if (!hit.hit) continue; // nothing holds it up
        const touch = high - hit.fraction * (high - low);
        // Down on the rest, not on something that stands over it.
        if (touch + box.min[2] > rest.peakZ + P.restPerch) continue;
        // On the grid: the reference point to whole millimetres, the height rounded up from a
        // millimetre above where it touches.
        const position: [number, number, number] = [
          Math.round((x + reference[0]) * 1000) / 1000,
          Math.round((y + reference[1]) * 1000) / 1000,
          Math.ceil((touch + P.seatLift + reference[2]) * 1000 - 1e-6) / 1000,
        ];
        const origin = v3Sub(position, reference);
        found.push({
          energy: touch + com[2],
          tiltDeg,
          orientation,
          q,
          position,
          origin,
          box: { min: v3Add(box.min, origin), max: v3Add(box.max, origin) },
        });
      }
    }
    found.sort((a, b) => a.energy - b.energy || b.tiltDeg - a.tiltDeg);
    let sweeps = 0;
    for (const { energy: _energy, ...seat } of found) {
      const pose = bodyPoseInTub(framePose, seat.position, seat.q, item.instance.referencePoint);
      // (On the grid the pose may touch a wire by a hair, as a seat between tines may.)
      if (this.world.penetration(item.pieces, pose, skip).depth > P.seatOverlap) continue;
      if (this.sweepFromAbove(item, pose, rack, ignore).clear) return seat;
      sweeps += 1;
      if (sweeps >= P.seatSweepsMax) break;
    }
    return null;
  }

  chargeQuery(
    name: QueryName,
    args: JsonValue,
  ): { readonly accepted: true } | Rejected<QueryRejectReason> {
    this.assertLive();
    let result: { readonly accepted: true } | Rejected<QueryRejectReason>;
    if (name === 'get_report') {
      result = { accepted: true };
    } else if (this.queriesUsed >= this.level.rules.queriesMax) {
      result = reject('query_budget_exhausted');
    } else {
      this.queriesUsed += 1;
      result = { accepted: true };
    }
    this.record('query', name, args, result);
    return result;
  }

  actionLog(): readonly ActionLogEvent[] {
    return [...this.log];
  }

  machineConfig(): MachineConfig {
    return this.config;
  }

  machineGeometry(): MachineGeometry {
    return this.scene.geometry;
  }

  bodyPoses(): {
    readonly parts: { readonly [partId: string]: Pose };
    readonly items: { readonly [itemId: string]: Pose };
  } {
    this.assertLive();
    const parts: { [partId: string]: Pose } = {};
    // Once the cycle has started the door is shut: the parts fixed to it are drawn closed.
    const shut = this.episodePhase !== 'loading';
    for (const body of this.scene.bodies) {
      parts[body.id] =
        shut && body.basketId === null ? body.part.pose : this.world.getPose(body.id);
    }
    for (const arm of this.scene.arms) {
      const assembly = this.assemblyOf(arm.basketId);
      parts[arm.id] =
        assembly === undefined
          ? arm.part.pose
          : poseShifted(arm.part.pose, this.basketOffset(assembly));
    }
    const items: { [itemId: string]: Pose } = {};
    for (const id of [...this.placed.keys()].sort(compareIds)) items[id] = this.world.getPose(id);
    return { parts, items };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.dispose();
  }
}

/**
 * Creates a session for a level: builds the loading world with the machine in the level's
 * configuration and friction from the catalogue's dry pair table, with nothing placed.
 * Asynchronous because the physics engine is instantiated on first use. Throws a RangeError for
 * a level that `validateLevel` rejects (level data is not player input).
 */
export async function createSession(options: SessionOptions): Promise<GameSession> {
  const problems = validateLevel(options.level);
  if (problems.length > 0) {
    throw new RangeError(
      `session: level '${options.level.id}' is not valid: ${problems
        .slice(0, 5)
        .map((p) => `${p.path}: ${p.message}`)
        .join('; ')}`,
    );
  }
  // Fail before the world exists if the programme is unknown.
  levelProgramme(options.level);
  const world = await createPhysicsWorld(
    {
      timeStep: LOADING_TIME_STEP,
      gravity: LOADING_GRAVITY,
      pairLookup: contactPairLookup(false),
    },
    { ...JOLT_SETTINGS, ...options.physics },
  );
  try {
    return new SessionImpl(options, world);
  } catch (error) {
    world.dispose();
    throw error;
  }
}
