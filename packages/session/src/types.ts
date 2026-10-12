/**
 * Contract of the session and action layer (docs/design/platform.md section 6; wire shapes from
 * docs/research/benchmark.md sections 3.2 to 3.4 and 3.7).
 *
 * One server-side session owns the scene. The human client and the agent API call the same
 * reducers and read the same state, so everything here is a wire type: plain JSON, snake_case
 * keys, millimetres and degrees, quaternions as `quat_wxyz` in (w, x, y, z) order. Conversion
 * to SI and to the internal quaternion order happens only inside the session.
 *
 * Player-facing failures are values (`{ accepted: false, reason }`), never exceptions. A
 * rejected call changes nothing and is not charged to a budget.
 *
 * Nothing predictive of the wash outcome is ever returned by the session.
 *
 * Where platform.md and the benchmark dossier differ, platform.md wins: frame names
 * (`lower_rack`, `cutlery_basket`), the tub-frame origin, `quat_wxyz` and `reason`.
 */

import type { JsonValue, Outcome, QuatWxyz, Rejected } from '@spotless/core';
import type { RackId, RackPosition, Vec3Mm, WireImage } from '@spotless/levels';

// The level card and the types it is made of are declared by `@spotless/levels`, which builds
// the card from level data, and are part of this contract unchanged.
export type {
  BudgetLimits,
  DispenserCard,
  ItemRecord,
  ItemSoilRecord,
  LevelCard,
  MachineCard,
  OrientationPresetCard,
  ProgrammeCard,
  ProgrammePhaseCard,
  RackCard,
  RackId,
  RackOptionCard,
  RackPosition,
  RulesCard,
  SoilHeatHistory,
  SprayArmCard,
  Track,
  Vec3Mm,
  WireImage,
} from '@spotless/levels';
import type { BudgetLimits, ItemRecord, LevelCard } from '@spotless/levels';

// ---------------------------------------------------------------------------------------------
// Frames, poses, orientations
// ---------------------------------------------------------------------------------------------

/**
 * Frames a pose can be given in. All are right-handed with z up. `tub`: origin on the lower
 * spray-arm axis at tub-floor level, +x to the right facing the open machine, +y towards the
 * back. Rack frames: origin at the rack's front-left corner on the top surface of the base
 * grid, axes parallel to the tub frame when the rack is pushed in.
 */
export type FrameId = 'tub' | RackId;

/** Every {@link RackId}, for validation and iteration. */
export const RACK_IDS: readonly RackId[] = [
  'lower_rack',
  'upper_rack',
  'third_rack',
  'cutlery_basket',
];

/** Every {@link FrameId}, for validation and iteration. */
export const FRAME_IDS: readonly FrameId[] = ['tub', ...RACK_IDS];

/**
 * A pose on the wire: the item's reference point and orientation in a named frame.
 *
 * Every pose the session sends out is rounded for the wire: `quat_wxyz` is the grid point of
 * `quantiseQuatGrid` in `@spotless/core` (components are multiples of 1e-4, `w >= 0`; the norm
 * is within 1e-4 of 1, not exactly 1), and `position_mm` is rounded to 0.1 mm (a requested pose
 * is on the whole-millimetre input grid). The grid point is a fixed point of the input
 * quantisation, so an orientation read from a result and sent back in a request denotes exactly
 * the same engine orientation, `quantiseQuat` of the wire value. A settled position is finer
 * than the input grid and is rounded to 1 mm like any other input when sent back.
 */
export interface WirePose {
  readonly frame: FrameId;
  /** Position of the item's reference point, millimetres. */
  readonly position_mm: Vec3Mm;
  /** Orientation as a quaternion (w, x, y, z), item frame to `frame`. */
  readonly quat_wxyz: QuatWxyz;
}

/** An orientation given directly as a quaternion (w, x, y, z); need not be exactly unit. */
export interface QuatOrientation {
  readonly quat_wxyz: QuatWxyz;
}

/**
 * An orientation given as one of the item's named presets plus optional offsets in degrees
 * (quantised to 1 degree). The offsets rotate the preset about the fixed axes of the placement
 * frame: first roll about +x, then pitch about +y, then yaw about +z, so that
 * `q = q_z(yaw) * q_y(pitch) * q_x(roll) * q_preset`.
 */
export interface PresetOrientation {
  /** Name from the item's `orientation_presets`, for example `'on_edge'`. */
  readonly preset: string;
  readonly yaw_deg?: number;
  readonly pitch_deg?: number;
  readonly roll_deg?: number;
}

/** How a player specifies an orientation. */
export type Orientation = QuatOrientation | PresetOrientation;

// ---------------------------------------------------------------------------------------------
// Scene state (dynamic)
// ---------------------------------------------------------------------------------------------

/** One contact of a placed item, as shown to players. */
export interface ContactSummary {
  /** The other party: an item id, or a machine part such as `'lower_rack.tine_row_2'`. */
  readonly with: string;
  /** Number of contact points. */
  readonly points: number;
  /** Total normal force, newtons; present in drop results, omitted from the scene state. */
  readonly normal_force_N?: number;
}

/**
 * Where a placed item lies: in a basket (the cutlery basket counts as the basket it stands in),
 * on the floor of the tub, or `outside`: on the open door or anywhere else that is neither a
 * basket nor the inside of the tub. An item that hangs through the floor of a basket and stands
 * on what is underneath is where it stands (`tub_floor` or `outside`), not in the basket. An item that is `outside` when the cycle starts is left
 * out of the wash. An item that reaches the kitchen floor is never listed: it goes back to the
 * counter at once (`returned` in the result of the action).
 */
export type ItemLocation = 'lower_rack' | 'upper_rack' | 'tub_floor' | 'outside';

/** One item currently in the machine. */
export interface PlacedItemState extends WirePose {
  readonly item_id: string;
  /**
   * Whether the item stayed where it lies under the light nudge that ended the last action
   * that touched it (see `DropAccepted.stable`).
   */
  readonly stable: boolean;
  /** Sorted by `with`. */
  readonly contacts: readonly ContactSummary[];
  /** Where the item lies now, read from its position (see {@link ItemLocation}). */
  readonly location: ItemLocation;
}

/** Budget counters. */
export interface BudgetState extends BudgetLimits {
  readonly actions_used: number;
  readonly queries_used: number;
  readonly washes_used: number;
}

/** Where the episode stands. */
export type EpisodePhase = 'loading' | 'washing' | 'finished';

/** The dynamic scene, returned by `get_state` and after every state-changing action. */
export interface SceneState {
  /** `'sha256:<hex>'` hash of the canonical scene. */
  readonly state_hash: string;
  readonly phase: EpisodePhase;
  /** Position of every rack the machine has. */
  readonly racks: { readonly [rack in RackId]?: RackPosition };
  /** Current value of every adjustable rack option, keyed `'<rack>.<option name>'`. */
  readonly rack_options: { readonly [key: string]: string };
  /** Sorted by `item_id`. */
  readonly placed: readonly PlacedItemState[];
  /** Ids of the items still on the counter, sorted. */
  readonly unplaced: readonly string[];
  readonly budget: BudgetState;
}

// ---------------------------------------------------------------------------------------------
// State-changing actions (count against the action budget; rejected calls are free)
// ---------------------------------------------------------------------------------------------

/** Names of the state-changing actions. */
export type ActionName = 'place' | 'remove' | 'reset' | 'set_rack' | 'start_cycle';

/** Every {@link ActionName}. */
export const ACTION_NAMES: readonly ActionName[] = [
  'place',
  'remove',
  'reset',
  'set_rack',
  'start_cycle',
];

/** Reasons common to every action. */
export type CommonRejectReason =
  /** A parameter is malformed (unknown frame or preset, zero quaternion, non-finite number). */
  | 'invalid_argument'
  /** The action budget is used up. */
  | 'budget_exhausted'
  /** The cycle has been started; the load is frozen. */
  | 'episode_over'
  /**
   * The action would crowd the load beyond what the physics engine can simulate reliably (its
   * capacity for contacts). Nothing changed and nothing was charged.
   */
  | 'physics_limit';

/**
 * How an item is released. `drop` and `insert` are the game; `set` is for reproducing a real,
 * recorded load (a calibration wash) and exists only in levels whose rules say
 * `exact_placement`: the item is put at exactly the stated pose, with the position taken to
 * 0.1 mm, without the test of the path from above and without lowering, and then settles. The
 * pose may overlap what is there by up to 2 mm (a recorded resting pose touches its
 * neighbours); the settle pushes the item clear.
 */
export type PlaceMode = 'drop' | 'insert' | 'set';

/**
 * `place`: put an item into the machine.
 *
 * Semantics: (1) quantise the pose (1 mm, 1 degree, 1e-4 per quaternion component);
 * (2) reject if the requested pose penetrates anything by more than 0.5 mm;
 * (3) reject if the item cannot reach the pose along a collision-free straight line from above
 * the rack: straight down or, where a tine is in the way of that, down along the tines of one
 * of the rack's rows, as a plate is slid into its slot (or along `insert_dir` for `insert`);
 * (4) lower along -z to first contact (gap under 1 mm) and release at rest, or for `insert`
 * push along the direction with a 15 N force limit at 0.1 m/s; (5) let everything come to
 * rest; (6) give what was touched a light nudge and see whether it stays (`stable`);
 * (7) return a {@link DropResult}.
 */
export interface PlaceRequest {
  readonly item_id: string;
  readonly frame: FrameId;
  /** Requested position of the item's reference point, millimetres. */
  readonly position_mm: Vec3Mm;
  readonly orientation: Orientation;
  /** Default `'drop'`. */
  readonly mode?: PlaceMode;
  /** For `insert`: direction of the push in `frame` (need not be unit). Default straight down. */
  readonly insert_dir?: readonly [number, number, number];
}

/** Why a `place` was rejected. */
export type PlaceRejectReason =
  | CommonRejectReason
  /** No item with that id in the level. */
  | 'unknown_item'
  /** The item is already in the machine; remove it first. */
  | 'already_placed'
  /** The requested pose penetrates something by more than the tolerance. */
  | 'collision_at_pose'
  /** No collision-free straight path reaches the pose. */
  | 'not_insertable'
  /** The pose is outside the envelope of the frame's rack or of the tub. */
  | 'out_of_bounds'
  /** `mode: 'set'` in a level whose rules do not allow exact placement. */
  | 'not_available';

/** Another item displaced by an action by more than 1 mm or 1 degree. */
export interface MovedItem {
  readonly item_id: string;
  /** Distance moved, millimetres. */
  readonly displacement_mm: number;
  /** Angle turned, degrees. */
  readonly rotation_deg: number;
  /**
   * In the mechanical check only: what pushed the item as the baskets went in and the door
   * closed, sorted. A part that does not travel with the item's basket and that the item was
   * pressed against on the way, as contacts name it (`tub.wall`: a board that leaned out over
   * the side of the basket was pushed in by the wall of the tub), or `door`. Absent when
   * nothing pushed it: it shifted by the motion of its basket alone.
   */
  readonly pushed_by?: readonly string[];
}

/** Feedback after an accepted `place`. Physical facts only. */
export interface DropAccepted {
  readonly accepted: true;
  readonly item_id: string;
  /** The pose asked for, after quantisation. */
  readonly requested_pose: WirePose;
  /** The pose at which the item was let go (after lowering to first contact, or the insert). */
  readonly release_pose: WirePose;
  /** The pose after settling. */
  readonly settled_pose: WirePose;
  /** Distance from release to settled, millimetres. */
  readonly displacement_mm: number;
  /** Rotation from release to settled, degrees. */
  readonly rotation_deg: number;
  /** Simulated time taken to settle, seconds. */
  readonly settle_time_s: number;
  /**
   * True when the item stays where it lies under a light nudge. Every action ends with one:
   * once everything has come to rest, gravity is tilted by one degree towards four sides in
   * turn (as much as a touch of a centimetre a second), and what the action touched must end
   * within 4 mm and 3 degrees of where it was. What stood on a point (a knife on the end of its
   * handle, a saucer on its rim) falls at that nudge, in the action that put it there:
   * `settled_pose` is where it lies afterwards, `displacement_mm` and `rotation_deg` say how
   * far it went, and it is nudged once more there; `stable` is the verdict of the last nudge.
   * False also for an item that had not come to rest after ten seconds (the items around it
   * that had are then not nudged in that action and count as stable), and for one the nudge
   * left standing that only balances: it touches nothing sideways and stands on a base so
   * narrow that a tilt of 5 degrees would tip it (a chopping board on its long edge on the
   * open floor of a basket: it stays where it is and is reported not stable). It is not a
   * test of the basket being moved: `check_load` is.
   */
  readonly stable: boolean;
  /**
   * How the item rests, read from the settled pose (absent when it left the basket):
   * `lowest_point_mm` is the height of its lowest point above the top of the base grid of the
   * frame it was placed in (the tub floor for the tub frame). `on_base` is true when that is
   * within 10 mm: the item stands on the floor of the basket, as a plate does that has come
   * down between the tines. False means it is held up by tines, a shelf or other items (a bowl
   * perched across tine tips, something lying on its neighbours). `force_over_weight` is the
   * sum of its contact forces over its weight: about 1 for an item that simply rests, several
   * for one that is wedged between things.
   */
  readonly resting?: {
    readonly lowest_point_mm: number;
    readonly on_base: boolean;
    readonly force_over_weight: number;
  };
  /** The item dropped through the rack. */
  readonly fell_through: boolean;
  /** The item left the rack envelope. */
  readonly fell_out: boolean;
  /**
   * Items that ended on the kitchen floor and were put back on the counter, sorted; the placed
   * item itself may be among them. The action is charged all the same.
   */
  readonly returned: readonly string[];
  /** Contacts of the item after settling, sorted by `with`, each with `normal_force_N`. */
  readonly contacts: readonly ContactSummary[];
  /** Other items displaced, sorted by `item_id`. */
  readonly moved_items: readonly MovedItem[];
  /** Hash of the canonical scene after the action. */
  readonly state_hash: string;
  /** The scene after the action. */
  readonly state: SceneState;
}

/** A rejected `place`. For `collision_at_pose`, says how deep and with what. */
export interface DropRejected extends Rejected<PlaceRejectReason> {
  /** Penetration depth of the requested pose, millimetres. */
  readonly penetration_mm?: number;
  /**
   * What the requested pose collides with, sorted: an item by its id, a part of the machine as
   * contacts name it (`'upper_rack.floor.x'`, `'upper_rack_fittings.shelf.cup_rear'`).
   */
  readonly colliding_with?: readonly string[];
  /**
   * For `not_insertable`: what stands in the way of the straight path, if one thing does: an
   * item, a part of the machine named as contacts name it, or `'tub'`.
   */
  readonly blocked_by?: string;
}

/** Result of `place`. */
export type DropResult = DropAccepted | DropRejected;

/** `remove`: take an item back to the counter; whatever it supported re-settles. */
export interface RemoveRequest {
  readonly item_id: string;
}

/** Why a `remove` was rejected. */
export type RemoveRejectReason = CommonRejectReason | 'unknown_item' | 'not_placed';

/** Result of `remove`. */
export type RemoveResult =
  | {
      readonly accepted: true;
      readonly item_id: string;
      /** Items that moved when the support was taken away, sorted by `item_id`. */
      readonly moved_items: readonly MovedItem[];
      /** Items that ended on the kitchen floor and were put back on the counter, sorted. */
      readonly returned: readonly string[];
      readonly state_hash: string;
      readonly state: SceneState;
    }
  | Rejected<RemoveRejectReason>;

/** Result of `reset` (remove everything). */
export type ResetResult =
  | {
      readonly accepted: true;
      /** Ids of the items taken out, sorted. */
      readonly removed: readonly string[];
      readonly state_hash: string;
      readonly state: SceneState;
    }
  | Rejected<CommonRejectReason>;

/** `set_rack`: change an adjustable feature of a rack (see {@link RackOptionCard}). */
export interface SetRackRequest {
  readonly rack: RackId;
  /** Which option to set, and to what. */
  readonly option: { readonly name: string; readonly value: string };
}

/** Why a `set_rack` was rejected. */
export type SetRackRejectReason =
  | CommonRejectReason
  /** The machine has no such rack, or the rack no such option or value. */
  | 'unknown_option'
  /** The change is physically blocked by the load. */
  | 'blocked';

/** Result of `set_rack`. */
export type SetRackResult =
  | {
      readonly accepted: true;
      /** Items that moved as a consequence, sorted by `item_id`. */
      readonly moved_items: readonly MovedItem[];
      /** Items that ended on the kitchen floor and were put back on the counter, sorted. */
      readonly returned: readonly string[];
      readonly state_hash: string;
      readonly state: SceneState;
    }
  | (Rejected<SetRackRejectReason> & {
      /** For `blocked`: what is in the way, sorted. */
      readonly blocked_by?: readonly string[];
    });

/** `start_cycle`: push the racks in, close the door, run the pre-checks, freeze the load. */
export interface StartCycleRequest {
  /**
   * Programme id; default is the programme the level is scored on. One of the level's
   * secondary programmes may be named instead (`LevelCard.secondary_programmes`): the wash is
   * then run and reported on that programme, labelled uncalibrated, and is not a result on the
   * scored one.
   */
  readonly programme?: string;
}

/**
 * Why a `start_cycle` was rejected. `budget_exhausted` is deliberately not among the reasons:
 * a player who has used up the action budget must still be able to wash what is loaded
 * (benchmark.md section 4.4: hitting a cap ends the episode with whatever is loaded).
 */
export type StartCycleRejectReason =
  | Exclude<CommonRejectReason, 'budget_exhausted'>
  | 'unknown_programme'
  | 'no_washes_left'
  /**
   * A basket cannot be pushed in or the door cannot close on the load. Nothing changed;
   * `check_load` says what is in the way.
   */
  | 'door_blocked';

/** Result of `start_cycle`. */
export type StartCycleResult =
  | {
      readonly accepted: true;
      /** Handle for `get_report`. */
      readonly job_id: string;
      readonly programme: string;
      /** Mechanical facts found while pushing the racks in and closing the door. */
      readonly prechecks: LoadCheck;
      /**
       * Items that were neither in a basket nor inside the tub when the door closed (they lay
       * on the door, or fell out as the baskets went in), sorted. They are back on the counter
       * and are not washed: `prechecks.fell_out` names the same items.
       */
      readonly left_out: readonly string[];
      /** The frozen load that will be washed. */
      readonly load: LoadManifest;
      readonly state_hash: string;
      readonly state: SceneState;
    }
  | Rejected<StartCycleRejectReason>;

// ---------------------------------------------------------------------------------------------
// Queries (free of the action budget, counted against the query cap)
//
// Three queries are always answered, whatever the budgets and the phase of the episode:
// `get_level` and `get_state` (the level card is delivered at the start and the scene state
// comes back with every action, so refusing them would hide nothing) and `get_report` (a player
// must always be able to collect the result, and polling a long wash must not eat the budget).
// `get_level` and `get_state` are counted while the cap has room; `get_report` is never counted.
// Every other query is refused with `query_budget_exhausted` once the cap is reached.
// ---------------------------------------------------------------------------------------------

/** Names of the queries. */
export type QueryName =
  | 'get_level'
  | 'get_item'
  | 'get_state'
  | 'render'
  | 'preview'
  | 'list_slots'
  | 'check_load'
  | 'get_report';

/** Every {@link QueryName}. */
export const QUERY_NAMES: readonly QueryName[] = [
  'get_level',
  'get_item',
  'get_state',
  'render',
  'preview',
  'list_slots',
  'check_load',
  'get_report',
];

/** Reasons common to every query. */
export type QueryRejectReason =
  | 'invalid_argument'
  | 'query_budget_exhausted'
  /** The level's rules do not offer this query (`check_load` without mechanical checks). */
  | 'not_available'
  /** The load is too crowded for the physics engine to run the check; nothing changed. */
  | 'physics_limit'
  /**
   * The cycle has been started: the load is frozen and `preview`, `list_slots` and `check_load`
   * have nothing more to say. `get_level`, `get_state`, `get_item` and `get_report` still answer.
   */
  | 'episode_over';

/** `get_item` request. */
export interface GetItemRequest {
  readonly item_id: string;
}

/** `get_item` result: the item record with thumbnails. */
export type GetItemResult =
  | { readonly accepted: true; readonly item: ItemRecord }
  | Rejected<QueryRejectReason | 'unknown_item'>;

/** Named camera views (benchmark.md section 3.2 c). */
export type ViewName =
  | 'iso_lower'
  | 'iso_upper'
  | 'top_lower'
  | 'top_upper'
  | 'front'
  | 'left'
  | 'right'
  | 'height_lower'
  | 'height_upper'
  | 'custom'
  | 'item';

/** Largest image edge that may be requested, pixels. */
export const RENDER_SIZE_MAX_PX = 1024;
/** Default image edge, pixels. */
export const RENDER_SIZE_DEFAULT_PX = 768;

/** Free camera of the `custom` view, the equivalent of the human orbit camera. */
export interface CustomCamera {
  /** Angle about +z from the -y (front) direction, degrees. */
  readonly azimuth_deg: number;
  /** Angle above the horizontal, degrees. */
  readonly elevation_deg: number;
  /** Point looked at, tub frame, millimetres. */
  readonly target_mm: Vec3Mm;
  /** Distance from the target, millimetres. */
  readonly distance_mm: number;
  /** Vertical field of view, degrees. */
  readonly fov_deg: number;
}

/** A candidate pose drawn without placing the item. */
export interface GhostSpec {
  readonly item_id: string;
  readonly frame: FrameId;
  readonly position_mm: Vec3Mm;
  readonly orientation: Orientation;
}

/** Options accepted by every view. */
export interface RenderOptions {
  /** Draw item-id labels. Default false. */
  readonly labels?: boolean;
  /** Draw a millimetre grid (orthographic views). Default false. */
  readonly grid?: boolean;
  /** Draw the racks pushed in or pulled out. Default: as they are. */
  readonly racks?: RackPosition;
  /** Item ids to highlight. */
  readonly highlight?: readonly string[];
  /** A candidate pose to draw as a ghost. */
  readonly ghost?: GhostSpec;
  /** Long edge of the image, pixels; default 768, maximum 1024. */
  readonly size_px?: number;
  /** Required for the `custom` view. */
  readonly camera?: CustomCamera;
  /** Required for the `item` view: which item to show. */
  readonly item_id?: string;
  /** For the `item` view: show the item after the wash (needs a finished report). */
  readonly after_wash?: boolean;
}

/** `render` request. */
export interface RenderRequest {
  readonly view: ViewName;
  readonly options?: RenderOptions;
}

/** `render` result. */
export type RenderResult =
  | { readonly accepted: true; readonly view: ViewName; readonly image: WireImage }
  | Rejected<QueryRejectReason | 'unknown_item' | 'no_report'>;

/** `preview` request: same pose parameters as `place`. */
export interface PreviewRequest {
  readonly item_id: string;
  readonly frame: FrameId;
  readonly position_mm: Vec3Mm;
  readonly orientation: Orientation;
}

/**
 * `preview` result. Without changing the scene: whether the pose is collision-free, how deep
 * and with what it penetrates, whether it is insertable, and the pose after lowering to first
 * contact. The settle is not run. Human equivalent: the ghost that turns red while dragging.
 */
export type PreviewResult =
  | {
      readonly accepted: true;
      /** The pose asked for, after quantisation. */
      readonly requested_pose: WirePose;
      /** True when the pose penetrates nothing by more than the tolerance. */
      readonly collision_free: boolean;
      /** Deepest penetration, millimetres (0 if none). */
      readonly penetration_mm: number;
      /** What the pose penetrates, sorted; parts of the machine named as contacts name them. */
      readonly colliding_with: readonly string[];
      /**
       * True when a collision-free straight line from above the rack reaches the pose:
       * straight down, or down along the tines of one of the rack's rows.
       */
      readonly insertable: boolean;
      /**
       * When the pose is free but not insertable: what the item meets on its way straight
       * down (an item, a part of a basket or of its fittings, `'tub'` for a basket that is
       * pushed in), as a refused `place` names it. Absent when the pose is insertable or itself collides.
       */
      readonly blocked_by?: string;
      /**
       * With `blocked_by`: how far above the requested pose the item is stopped, millimetres.
       */
      readonly blocked_above_mm?: number;
      /** True when the pose is inside the envelope of its frame. */
      readonly in_bounds: boolean;
      /** Pose after lowering along -z to first contact; null if the pose is not placeable. */
      readonly lowered_pose: WirePose | null;
    }
  | Rejected<QueryRejectReason | 'unknown_item' | 'already_placed'>;

/** `list_slots` request. */
export interface ListSlotsRequest {
  readonly rack: RackId;
  /**
   * An item of the level. With it, every slot between tines also carries `suggested_drop`: a
   * complete pose for dropping this item into the slot (the position depends on its size).
   */
  readonly item_id?: string;
}

/** A row of tines, as geometry in the rack frame. */
export interface TineRowCard {
  /** For example `'tine_row_2'`. */
  readonly id: string;
  /** Base of the first and of the last tine, millimetres. */
  readonly start_mm: Vec3Mm;
  readonly end_mm: Vec3Mm;
  /** Number of tines in the row. */
  readonly count: number;
  /** Spacing between neighbouring tines, millimetres. */
  readonly pitch_mm: number;
  /** Height of the tines above the base grid, millimetres. */
  readonly height_mm: number;
  /** Lean of the tines from vertical, degrees. */
  readonly lean_deg: number;
  /** True when the row is currently folded flat. */
  readonly folded: boolean;
  /** The rack-frame axis the row's rail runs along; plates stand across it. */
  readonly runs: 'x' | 'y';
  /**
   * Rack-frame direction the tops of the tines lean towards, for example `'-x'`; `'mixed'`
   * when the slots of the row do not all lean the same way (each slot then says its own).
   */
  readonly lean_toward: string;
  /** Distance to the parallel row that holds a plate together with this one, millimetres. */
  readonly partner?: { readonly id: string; readonly spacing_mm: number };
}

/** A place an item can sit: a snap target, never a constraint. */
export interface SlotCard {
  readonly id: string;
  /**
   * `'plate_slot'` or `'wide_slot'` (between two tines), `'basket_cell'` (cutlery basket), and
   * where a basket has them `'cup_shelf'`, `'knife_shelf'`, `'stemware_notch'` and `'cup_rest'`:
   * a sloped rest along a side wall, on which cups, mugs and glasses stand mouth down leaning
   * towards the wall (`rest_left`, `rest_right`).
   */
  readonly kind: string;
  /** Centre of the slot in the rack frame, millimetres. */
  readonly centre_mm: Vec3Mm;
  /** Free width of the slot, millimetres. */
  readonly width_mm: number;
  /** Tine row the slot belongs to, if any. */
  readonly tine_row?: string;
  /**
   * For a slot between tines: lean of the two tines from the vertical, degrees. For a
   * `cup_rest`: the slope of the rest from the horizontal, degrees.
   */
  readonly lean_deg?: number;
  /**
   * For a slot between tines: rack-frame direction the tops of its two tines lean towards
   * (`'+x'`, `'-x'`, `'+y'`, `'-y'`). Slots of one row can differ: where a row changes its
   * lean, the suggested drops on the two sides are mirrored. For a `cup_rest`: the direction in
   * which the rest falls, towards its wall; a vessel on it leans that way.
   */
  readonly lean_toward?: string;
  /**
   * For a slot between tines: unit normal, in the rack frame, of the plane through the two
   * tines of the slot. Geometry of the tines, not a prediction: a plate let go between them
   * leans one way or the other until it meets a tine or a neighbour, and `settled_pose` of
   * the `place` says which.
   */
  readonly plate_normal?: readonly [number, number, number];
  /**
   * For a slot between tines: the orientation in which a plate, a lid or a platter stands in
   * the slot, as an offset to the item's `on_edge` preset: across the rail, its face away from
   * the side the tines lean to. Without `item_id` the item is upright; with it, it leans as in
   * `suggested_drop`. A suggestion for items that have that preset.
   */
  readonly suggested_orientation?: PresetOrientation;
  /**
   * With `item_id` in the request, for a slot between tines and an item with an `on_edge`
   * preset: the pose at which to let that item go so that it stands in this slot, in the rack
   * frame. It is the pose a hand seats a plate in: the lower edge down between the two tines,
   * a millimetre or two above the rails, the item laid back towards the tine behind it as far
   * as it goes without touching anything (at most to the lean of the tines; a deep plate is
   * held more upright, or tipped forward). `place` with this position and orientation (mode
   * `drop`) accepts it: an item may come down along the tines of a row. The item is still
   * released into real physics and comes to lean on its own. For the cutlery basket: a place
   * in the cell for the lower end of a piece of cutlery held upright. For a `cup_rest` and a
   * cup, a mug or a glass: the pose in which a hand sets it on the rest, mouth down (the
   * `inverted` preset), tilted towards the wall (`roll_deg`) with its handle along the rest to
   * the rear (`yaw_deg: 90`), a millimetre above where it touches, at the rearmost place along
   * the rest that is free now; let go there it settles by a centimetre at most and stands
   * leaning 15 to 35 degrees. Stemware, bottles and jugs are offered none.
   */
  readonly suggested_drop?: {
    readonly position_mm: Vec3Mm;
    readonly orientation: PresetOrientation;
  };
  /**
   * Whether the suggested pose passes the test `place` applies, in the scene as it is now (it
   * collides with nothing, the machine included, and can be reached from above). False for a
   * slot that is taken or shadowed, for an end slot where this item would overlap the wall of
   * the basket, (without a `suggested_drop`) for a slot the cutlery basket stands over, and for
   * a seat on a `cup_rest` that a shelf is folded down over.
   */
  readonly drop_free?: boolean;
  /**
   * With `drop_free: false`: what the pose collides with or what blocks the way down, sorted.
   * A part of the machine is named as contacts name it where the pose itself was tested
   * (`upper_rack_fittings.holder.knife_shelf.floor`: the shelf to fold up).
   */
  readonly drop_blocked_by?: readonly string[];
  /**
   * With `suggested_drop` between tines: true when the item is too deep to come down between
   * the tines of this slot (a bowl over a narrow plate row); dropped there it comes to rest on
   * the tine tips, which is allowed and is not the same as standing in the slot.
   */
  readonly drop_perches?: boolean;
  /**
   * With `suggested_drop` between tines: true when the suggested pose has the lower edge of
   * the item down at the rails between the two tines; false when the item finds no way down
   * there and the pose is above the tine tips instead.
   */
  readonly drop_seats?: boolean;
  /**
   * For a cutlery-basket cell or a shelf: size of the opening along x and y, millimetres. For
   * a `cup_rest`: from the wall to the ridge, and its length along the wall.
   */
  readonly size_mm?: readonly [number, number];
}

/** `list_slots` result: tine rows and slot centres with pitch, as geometry. */
export type ListSlotsResult =
  | {
      readonly accepted: true;
      readonly rack: RackId;
      readonly tine_rows: readonly TineRowCard[];
      readonly slots: readonly SlotCard[];
    }
  | Rejected<QueryRejectReason | 'unknown_rack' | 'unknown_item'>;

/**
 * Mechanical facts about the current load, found by simulating the racks being pushed in and
 * the door closed, spinning each spray arm by hand and opening the dispenser. Says nothing
 * about cleaning. Returned by `check_load` and, as pre-checks, by `start_cycle`.
 */
export interface LoadCheck {
  /** Items that shifted by more than 1 mm or 1 degree during push-in, sorted by `item_id`. */
  readonly shifted: readonly MovedItem[];
  /**
   * Items that are neither in a basket nor inside the tub once the baskets are in (they fell
   * out, or lie on the door or the kitchen floor), sorted. They will not be washed.
   */
  readonly fell_out: readonly string[];
  /**
   * Items lying on the tub floor, and items that hang through the floor of a basket and stand
   * on the tub underneath, sorted.
   */
  readonly on_tub_floor: readonly string[];
  /**
   * Items that reach out of their rack's envelope once the baskets are in and the door is
   * shut, sorted by `item_id`. A fact about the envelope and no fault in itself: a piece that
   * leans out over the side of a basket by less than the gap to the tub travels with the
   * basket as it stands. Whether it matters shows in `racks`, `spray_arms` and `door_closes`.
   */
  readonly protruding: readonly {
    readonly item_id: string;
    readonly rack: RackId;
    /** How far beyond the envelope, millimetres. */
    readonly beyond_mm: number;
    /**
     * Over which side of the envelope it reaches furthest: `left` and `right` as seen from the
     * front of the machine, `front` towards the door, `rear`, or `top` (above the height that
     * is clear over the whole basket).
     */
    readonly over: 'left' | 'right' | 'front' | 'rear' | 'top';
    /**
     * What it touches that is neither an item nor a part of its own basket (the tub, the
     * door, the other basket), as contacts name it, sorted. Empty: it is clear of them.
     */
    readonly touching: readonly string[];
  }[];
  /** Whether each rack slides fully in. */
  readonly racks: readonly {
    readonly rack: RackId;
    readonly slides_in: boolean;
    readonly blocked_by?: string;
  }[];
  /** Whether each spray arm completes a full rotation without touching anything. */
  readonly spray_arms: readonly {
    readonly arm: string;
    readonly full_rotation: boolean;
    /** Arm angle at first contact, degrees. */
    readonly first_contact_angle_deg?: number;
    readonly blocked_by?: string;
  }[];
  /**
   * Whether the door closes on the load. Closing it pushes back what leans out of a basket
   * (reported under `shifted`); it does not close while a basket is not in, or against
   * something that resists.
   */
  readonly door_closes: boolean;
  /** What stops the door, sorted; empty when it closes or when a basket is in its way. */
  readonly door_blocked_by: readonly string[];
  /** Whether the detergent dispenser lid can open fully. */
  readonly dispenser_opens: boolean;
  /** What stops the dispenser lid, sorted. */
  readonly dispenser_blocked_by: readonly string[];
  /** Whether the detergent tablet can fall from the dispenser into its tray unhindered. */
  readonly tablet_path_clear: boolean;
  /** What stands in the tablet's path, sorted. */
  readonly tablet_blocked_by: readonly string[];
}

/** `check_load` result: the facts of {@link LoadCheck} beside `accepted: true`, or a rejection. */
export type CheckLoadResult = Outcome<LoadCheck, QueryRejectReason>;

// ---------------------------------------------------------------------------------------------
// Load manifest, wash job and report
// ---------------------------------------------------------------------------------------------

/**
 * The canonical description of a load: what scoring is a pure function of. Poses are the
 * settled poses after the simulated rack push-in, positions rounded to 0.1 mm and quaternion
 * components to 1e-4 with `w >= 0` [ESTIMATED rounding, benchmark.md section 4.6].
 */
export interface LoadManifest {
  readonly benchmark_version: string;
  readonly level_id: string;
  readonly machine_id: string;
  readonly programme_id: string;
  /** Value of every adjustable rack option, keyed `'<rack>.<option name>'`. */
  readonly rack_options: { readonly [key: string]: string };
  /** Loaded items, sorted by `item_id`. */
  readonly items: readonly (WirePose & { readonly item_id: string })[];
  /** Hash of the scene the manifest was taken from. */
  readonly state_hash: string;
}

/** Life cycle of a wash job. */
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

/**
 * The fidelity tiers of the wash simulation: `official` is the tier scores are published at,
 * `fast` a coarser one (surface resolved to 4 mm instead of 2 mm) for local play and for
 * trying things out. A report says which produced it (`job.fidelity`).
 */
export type WashTier = 'official' | 'fast';

/** What is left of one soil on one region of an item after the wash. */
export interface ResidueSoil {
  /**
   * Catalogue soil id as the level states it. Soils of an item that the wash treats as one
   * (two sauces of the same kind) share an entry, their ids joined by `+`.
   */
  readonly type: string;
  /** Share of the dry mass of that soil on the region before the wash that is still there. */
  readonly residual_fraction: number;
}

/** Where residue remains on an item: one region of it. */
export interface ResidueRegion {
  /** Region id of the item type, for example `well`. */
  readonly region: string;
  /** Share of the surface of the region that is still visibly soiled, 0 to 1. */
  readonly fraction: number;
  /** Area of the region still visibly soiled, mm2. */
  readonly visible_area_mm2?: number;
  /** Area of the region that carried soil before the wash, mm2. */
  readonly soiled_area_mm2?: number;
  /** Separate specks of visible soil on the region. */
  readonly specks?: number;
  /** The soils that lay on the region, each with how much of it is left. */
  readonly soils?: readonly ResidueSoil[];
}

/** Per-item outcome in a wash report. */
export type WashReportItem =
  | { readonly item_id: string; readonly loaded: false }
  | {
      readonly item_id: string;
      readonly loaded: true;
      /** The inspector's verdict; decides the points. */
      readonly clean: boolean;
      readonly points_awarded: number;
      /** Graded score in [0, 1], reported beside the binary headline. */
      readonly graded_score: number;
      /** Fraction of the item's scored surface still carrying visible soil. */
      readonly residual_fraction_area: number;
      /**
       * Where residue remains: every region that carried soil and still shows some, with the
       * share of the region's surface that is still visibly soiled. Sorted by `region`.
       */
      readonly residue_regions: readonly ResidueRegion[];
      /** True when the wash moved the item. */
      readonly moved_during_wash: boolean;
      /**
       * True when the jets pushed up on the item hard enough to have moved it (a light item
       * lying loose over a spray arm). The wash is simulated with every item where it was
       * placed, so `moved_during_wash` stays false: this says that in a real machine it would
       * probably not have stayed there.
       */
      readonly likely_moved?: boolean;
      /** True when the item holds more pooled water at the end than a clean item may. */
      readonly holds_water: boolean;
      /** Water standing in the item's cavities at the end of the cycle, millilitres. */
      readonly retained_water_ml?: number;
      /** Close-up after the wash; withheld on private test levels. */
      readonly image_after?: WireImage;
      /**
       * False when the item was loaded but no wash was simulated for it (the placeholder wash
       * runner): `clean` is then false and the scores are 0 by convention, not by result.
       */
      readonly simulated?: boolean;
      /** IEC-style cleaning score of the item, 0 (heavily soiled) to 5 (spotless). */
      readonly score_iec?: number;
      /**
       * When the item is not clean: why, as a short statement of fact (which soil remains
       * where, or how much water it holds). Absent for a clean item.
       */
      readonly reason?: string;
      /** Area of the item still visibly soiled, mm2, and the separate specks counted on it. */
      readonly visible_area_mm2?: number;
      readonly specks?: number;
      /** Share of the dry soil that was on the item before the wash that is still on it. */
      readonly residual_mass_fraction?: number;
      /**
       * Water left as a film on the item's surface when the last rinse ends, grams. The drying
       * phase is not simulated, so this is what the item starts drying with.
       */
      readonly surface_film_g?: number;
      /**
       * Number of cells of the item's residue map ({@link ResidueMap}), which is fetched on
       * demand: 0 when no soil is left on it.
       */
      readonly residue_cells?: number;
    };

/**
 * The residue left on one washed item, cell by cell, for drawing it where it is: fetched on
 * demand (`GET /api/sessions/:id/residue_map?item_id=`), never carried in the report. Only
 * cells that still carry soil are listed; a spotless item has none.
 *
 * The arrays are packed: little-endian integers, base64. Cell `i` has
 *
 *  - its centre in the item frame at `positions[3i .. 3i+2] * position_quantum_mm` millimetres
 *    (signed 16-bit);
 *  - the outward unit normal of the surface there at `normals[3i .. 3i+2] / 127` (signed 8-bit);
 *  - its area `areas[i] * area_quantum_mm2` mm2 (unsigned 16-bit);
 *  - for soil `k` of `soils`, the share of what lay on the cell before the wash that is still
 *    there, `fractions[i * soils.length + k] / 255` (unsigned 8-bit; a trace is at least 1);
 *  - `visible[i]` 1 where the cell counts as visibly soiled (unsigned 8-bit).
 *
 * The item frame is the frame of the item's shape (`GET .../geometry`), in which draw poses
 * place the item.
 */
export interface ResidueMap {
  readonly item_id: string;
  /** The soils of the columns of `fractions` (see {@link ResidueSoil.type}). */
  readonly soils: readonly string[];
  /** Number of cells. */
  readonly cells: number;
  readonly position_quantum_mm: number;
  readonly area_quantum_mm2: number;
  readonly positions: string;
  readonly normals: string;
  readonly areas: string;
  readonly fractions: string;
  readonly visible: string;
}

/**
 * Answer of the residue-map endpoint: the map of one item of the session's last finished
 * wash, or `no_residue_map` when the session has no finished wash, the item was not washed, or
 * the wash kept no maps (the placeholder runner).
 */
export type GetResidueMapResult =
  { readonly accepted: true; readonly map: ResidueMap } | Rejected<'no_residue_map'>;

/** A stage of the wash job, as progress reports it. */
export interface WashStageProgress {
  /** Stable id: `starting`, `scene`, `hydraulics`, `exposure`, `soil`, `replay`, `result`. */
  readonly stage: string;
  /** What the stage does, in a few words, for display. */
  readonly label: string;
  /** Position of the stage among the stages of a wash, from 1, and their number. */
  readonly index: number;
  readonly count: number;
  /** Share of the stage that is done, 0 to 1. Long stages report it in coarse steps. */
  readonly fraction: number;
  /**
   * Estimate of the wall-clock seconds the wash still needs, made when this was reported, or
   * null when there is nothing to base one on. An estimate from the timings of earlier washes:
   * a stage may sit at one value for minutes and may overrun it.
   */
  readonly eta_s: number | null;
  /** Wall-clock seconds the wash had been running when this was reported. */
  readonly elapsed_s: number;
  /**
   * Seconds since this was reported, as the server knows it when it answers. A long stage
   * reports rarely: this says how old the estimate above is, so that whoever shows it can
   * count it down and can tell when the stage has overrun it.
   */
  readonly reported_ago_s?: number;
}

/** An item of a report named in its {@link WashVerdictSummary}. */
export interface FlaggedItem {
  readonly item_id: string;
  /** The points of the item in the level (what its verdict decides). */
  readonly points: number;
  /** The verdict the report gives it. */
  readonly clean: boolean;
}

/**
 * How firm the verdicts of a report are and how its points were counted. The points of a report
 * are binary on the verdict of the standard inspector (benchmark.md section 9, item 1); this
 * says beside them which verdicts could have gone the other way and what they are worth.
 * Written by the game server when a wash ends, from what the wash runner says of its result
 * and from the load.
 */
export interface WashVerdictSummary {
  /** How the points were counted: by the verdict given, whatever is flagged here. */
  readonly counting: 'binary_on_verdict';
  /** The programme the load was washed on. */
  readonly programme_id: string;
  /**
   * `scored`: the programme the level is scored on. `uncalibrated`: one of the level's
   * secondary programmes: every verdict of the report is provisional, and the report is not a
   * result on the scored programme.
   */
  readonly programme_status: 'scored' | 'uncalibrated';
  /** True for a wash at the fast tier: a preview, whose verdicts differ from the official tier's on some items. */
  readonly preview: boolean;
  /**
   * Loaded items at the edge of clean: what is left on them is seen by the strictest eye the
   * inspection standard allows and not by the most lenient. Sorted by `item_id`.
   */
  readonly edge: readonly FlaggedItem[];
  /**
   * Loaded items whose verdict the parameters of the wash do not vouch for on this programme
   * (a soil no measurement or published result stands behind). Sorted by `item_id`.
   */
  readonly provisional: readonly FlaggedItem[];
  /**
   * True when the whole report is provisional: an uncalibrated programme, or parameters made
   * for another state of the simulator.
   */
  readonly all_provisional: boolean;
  /** The points if every item at the edge of clean is read not clean, and if every one is read clean. */
  readonly points_strict: number;
  readonly points_lenient: number;
}

/** The report returned after a wash (benchmark.md section 3.7). */
export interface WashReport {
  readonly benchmark_version: string;
  readonly level_id: string;
  /** Hash of the scene that was washed. */
  readonly state_hash: string;
  readonly job: {
    readonly status: 'done';
    /** Wall-clock time of the wash, seconds. */
    readonly runtime_s: number;
    /**
     * Which simulation produced the report: a {@link WashTier} (`'official'`, `'fast'`), or
     * `'placeholder_not_simulated'` when nothing was simulated.
     */
    readonly fidelity: string;
    /** Version of the wash simulation that computed the report. */
    readonly sim_version?: string;
    /** Version of the runner that turned the load into the simulation's input and back. */
    readonly runner_version?: string;
    /**
     * Hash of the simulation's result: the same load washed again at the same tier by the same
     * simulation gives the same hash.
     */
    readonly result_hash?: string;
    /**
     * Things about this wash worth knowing, in words: a spray arm the load held still, a
     * dispenser that could not open, a soil the simulation could not place.
     */
    readonly notes?: readonly string[];
  };
  readonly score: {
    /** Sum of `points_awarded`. */
    readonly points: number;
    /** Sum of the points of every item in the level. */
    readonly points_available: number;
    /** Sum over items of points times graded score. */
    readonly graded_points: number;
    /** Sum of the points of the items that were washed. */
    readonly points_loaded?: number;
  };
  /** One entry per item of the level, sorted by `item_id`. */
  readonly items: readonly WashReportItem[];
  /**
   * How firm the verdicts are and how they were counted. Absent in a report that did not pass
   * through the game server, and for a wash that simulated nothing.
   */
  readonly verdicts?: WashVerdictSummary;
}

/**
 * `get_report` result: the state of the wash job and, when done, the report. Never refused on
 * budget grounds and never counted against the query cap, so it can be polled.
 */
export type GetReportResult =
  | { readonly accepted: true; readonly job_id: string; readonly status: 'queued' }
  | {
      readonly accepted: true;
      readonly job_id: string;
      readonly status: 'running';
      /** Fraction complete, 0 to 1. */
      readonly progress: number;
      /** Which stage the wash is in and how long it may still take, when the runner says. */
      readonly stage?: WashStageProgress;
    }
  | {
      readonly accepted: true;
      readonly job_id: string;
      readonly status: 'done';
      readonly report: WashReport;
    }
  | {
      readonly accepted: true;
      readonly job_id: string;
      readonly status: 'failed';
      /** Infrastructure failure, in words. Never scored as zero. */
      readonly error: string;
    }
  | Rejected<'invalid_argument' | 'no_cycle_started'>;

// ---------------------------------------------------------------------------------------------
// Action log
// ---------------------------------------------------------------------------------------------

/**
 * One line of the episode's event stream (benchmark.md section 4.8). Replaying the `action`
 * events of a log against a fresh session must reproduce every `state_hash`. Wall-clock times
 * are added by the server, never by the session.
 */
export interface ActionLogEvent {
  /** Sequence number, starting at 0. */
  readonly seq: number;
  readonly kind: 'action' | 'query';
  readonly name: ActionName | QueryName;
  /** The request as received. */
  readonly args: JsonValue;
  readonly accepted: boolean;
  /** `'sha256:<hex>'` of the canonical JSON of the result (images excluded). */
  readonly result_digest: string;
  /** Scene hash after the event. */
  readonly state_hash: string;
  readonly budget: BudgetState;
}

// ---------------------------------------------------------------------------------------------
// The session object
// ---------------------------------------------------------------------------------------------

/**
 * A session: one player, one level. Method names map one to one onto the wire names
 * (`setRack` is `set_rack`). `render` and `get_report` are served by the server (render
 * service, wash job queue) and pass through this session's budget and log by way of
 * {@link Session.chargeQuery}.
 *
 * Methods are synchronous and deterministic: the scene after a call is a pure function of the
 * level and the sequence of accepted actions. A player-facing failure comes back as a value
 * with `accepted: false`; a method throws only for a programmer error.
 */
export interface Session {
  /** `place`: counts one action when accepted. */
  place(request: PlaceRequest): DropResult;
  /** `remove`: counts one action when accepted. */
  remove(request: RemoveRequest): RemoveResult;
  /** `reset`: counts one action when accepted. */
  reset(): ResetResult;
  /** `set_rack`: counts one action when accepted. */
  setRack(request: SetRackRequest): SetRackResult;
  /** `start_cycle`: counts one wash when accepted; allowed even with no action budget left. */
  startCycle(request?: StartCycleRequest): StartCycleResult;

  /** `get_level`: always answered (see the note above the query types). */
  getLevel(): LevelCard;
  /** `get_item`. */
  getItem(request: GetItemRequest): GetItemResult;
  /** `get_state`: always answered (see the note above the query types). */
  getState(): SceneState;
  /** `preview`. */
  preview(request: PreviewRequest): PreviewResult;
  /** `list_slots`. */
  listSlots(request: ListSlotsRequest): ListSlotsResult;
  /** `check_load`. */
  checkLoad(): CheckLoadResult;
  /**
   * `get_report`: the state of the wash job and, when it is done, the report. Logged, never
   * charged and never refused on budget grounds.
   */
  getReport(): GetReportResult;

  /**
   * Records one query served outside the session (`render` or `get_report`) in the action log
   * and charges it to the query budget. `render` is refused once the cap is reached;
   * `get_report` is logged but never charged and never refused.
   */
  chargeQuery(
    name: QueryName,
    args: JsonValue,
  ): { readonly accepted: true } | Rejected<QueryRejectReason>;
  /** The event stream so far. */
  actionLog(): readonly ActionLogEvent[];
  /** Frees the physics world. The session must not be used afterwards. */
  dispose(): void;
}
