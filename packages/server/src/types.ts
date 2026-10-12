/**
 * Types of the server package: what goes over HTTP and the WebSocket beyond the session
 * contract of `@spotless/session`, the records kept in the data directory, and the options of
 * the server.
 *
 * Wire conventions: plain JSON with snake_case keys. Poses are in millimetres with quaternions
 * as `quat_wxyz`, like every pose of the session contract. The one exception is the geometry
 * payload ({@link GeometryPayload}): shapes are the geometry kernel's own description, in SI
 * with the kernel's field names, so that a client can hand them to the same kernel code
 * unchanged.
 */

import type { Pose, QuatWxyz, Rejected, Vec3 } from '@spotless/core';
import type { Aabb, Shape } from '@spotless/geometry';
import type { Level, OrientationPresetCard, Vec3Mm } from '@spotless/levels';
import type { MachineAffordances, MachineConfig, MachinePart } from '@spotless/machine';
import type {
  ActionLogEvent,
  ActionName,
  BudgetState,
  EpisodePhase,
  JobStatus,
  QueryRejectReason,
  RenderRequest,
  ResidueMap,
  SceneState,
  WashReport,
  WashRunner,
  WashStageProgress,
  WashTier,
  WireImage,
} from '@spotless/session';
import type { GameSession } from '@spotless/session';
import type { WashParamChoice, WashRunStats } from '@spotless/wash-runner/contract';
import type { EpisodePlayer } from './episode.ts';

// ---------------------------------------------------------------------------------------------
// Drawing: poses and scenes
// ---------------------------------------------------------------------------------------------

/**
 * Where to draw a body: the pose of its own frame (a machine part's frame, an item's item
 * frame) in the tub frame. Unlike a `WirePose` of the session contract it refers to the origin
 * of the body's frame, not to an item's reference point, so a mesh built from the body's shape
 * is drawn with exactly this transform. Position in millimetres rounded to 0.01 mm, quaternion
 * components rounded to 1e-5 (normalise before use). For display only.
 */
export interface DrawPose {
  readonly position_mm: Vec3Mm;
  readonly quat_wxyz: QuatWxyz;
}

/** Draw poses of machine parts (by part id) and of placed items (by item id). */
export interface DrawPoses {
  readonly parts: { readonly [partId: string]: DrawPose };
  readonly items: { readonly [itemId: string]: DrawPose };
}

/** The scene as a client draws it: the session's scene state and where every body is. */
export interface SceneView {
  readonly state: SceneState;
  readonly poses: DrawPoses;
  /**
   * Changes whenever the machine geometry does (a basket height, a folded tine row, a shelf):
   * a client that holds the geometry of another key fetches it again.
   */
  readonly geometry_key: string;
}

/**
 * One frame of an animation: the bodies whose pose changed since the previous frame (for the
 * first frame, since the scene before the action). A body that is not listed has not moved.
 */
export interface AnimationFrame {
  /** Simulated time since the action began, seconds. */
  readonly t_s: number;
  readonly parts: { readonly [partId: string]: DrawPose };
  readonly items: { readonly [itemId: string]: DrawPose };
}

// ---------------------------------------------------------------------------------------------
// Geometry for clients
// ---------------------------------------------------------------------------------------------

/** One machine part as a client draws it. Kernel units (SI). */
export interface MachinePartPayload {
  readonly id: string;
  readonly role: MachinePart['role'];
  readonly component: MachinePart['component'];
  readonly frame: string;
  readonly material: string;
  readonly carried_by: string | null;
  /** True for a spray arm: it is drawn but is not a body of the loading world. */
  readonly probe: boolean;
  readonly motion: MachinePart['motion'];
  /** Part frame to tub frame in the reference state (baskets in, door closed), SI. */
  readonly reference_pose: Pose;
  /** The parametric shape, for the kernel's mesh builder. */
  readonly shape: Shape;
}

/** One item type of the level as a client draws it. Kernel units (SI). */
export interface ItemTypePayload {
  readonly item_type: string;
  readonly display_name: string;
  readonly class: string;
  /** The parametric shape in the item frame, for the kernel's mesh builder. */
  readonly shape: Shape;
  readonly bbox: Aabb;
  /** The point of the item that `position_mm` of the contract refers to, item frame, metres. */
  readonly reference_point: Vec3;
  /** Catalogue material of the body. */
  readonly material: string;
  /** The orientation presets of the item, as in its item record. */
  readonly orientation_presets: readonly OrientationPresetCard[];
}

/** Answer of the geometry endpoint. */
export interface GeometryPayload {
  /** See {@link SceneView.geometry_key}. */
  readonly geometry_key: string;
  /** Units of `shape`, `reference_pose`, `bbox`, `reference_point` and `affordances`. */
  readonly units: {
    readonly length: 'm';
    readonly angle: 'rad';
    readonly quaternion: 'xyzw';
  };
  readonly machine: {
    readonly machine_id: string;
    readonly config: MachineConfig;
    readonly parts: readonly MachinePartPayload[];
    /**
     * The placement aids of the machine as its geometry states them: tine rows with their
     * slots, cup shelves, holders, cutlery-basket cells, basket envelopes. Geometry only. The
     * `list_slots` query returns the same slots as wire cards.
     */
    readonly affordances: MachineAffordances;
  };
  /** Every item type the level uses, by catalogue id. */
  readonly item_types: { readonly [itemType: string]: ItemTypePayload };
  /** Which type each item of the level is, sorted by `item_id`. */
  readonly items: readonly { readonly item_id: string; readonly item_type: string }[];
}

// ---------------------------------------------------------------------------------------------
// HTTP envelopes
// ---------------------------------------------------------------------------------------------

/** Reasons the server itself refuses a request with, beside those of the session contract. */
export type ServerRejectReason =
  /** The body or a parameter is malformed (HTTP 400). */
  | 'invalid_argument'
  /**
   * The route is the harness's and the request did not carry the admin token, or the request
   * came from a foreign origin or under a foreign host name (HTTP 403).
   */
  | 'forbidden'
  /** No session with that id, in memory or in the data directory (HTTP 404). */
  | 'unknown_session'
  /** No level with that id (HTTP 404). */
  | 'unknown_level'
  /** No wash job with that id (HTTP 404). */
  | 'unknown_job'
  /** The stored log of the session does not replay to its recorded hashes (HTTP 409). */
  | 'restore_failed'
  /**
   * Benchmark mode: the cycle of this episode has been started once, so the load can no longer
   * be changed; after a failed wash only `start_cycle` is taken (HTTP 409).
   */
  | 'load_frozen'
  /** Every session slot is in use by a session that cannot be set aside (HTTP 503). */
  | 'server_full'
  /** A fault of the server (HTTP 500). Never a verdict on the player's load. */
  | 'internal_error';

/** A refusal by the server, in the shape of every other rejection. */
export type ServerRejected = Rejected<ServerRejectReason>;

/** One line of `GET /api/levels`. */
export interface LevelListing {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly items: number;
  readonly points_available: number;
  /** The difficulty of the level when it states one: a number (1 the easiest) or a word. */
  readonly difficulty?: number | string;
}

/** One wash a player may choose (`GET /api/sessions/:id/wash_options`). */
export interface WashOption {
  readonly tier: WashTier;
  /** True for the tier scores are published at (`official`); false for the preview. */
  readonly scored: boolean;
  /**
   * Estimate of the wall-clock seconds a wash of the load as it stands takes at this tier on
   * this machine: from the timings of its earlier washes when there are any (`history`), else
   * from the figures measured on the reference machine (`built-in`).
   */
  readonly seconds: number;
  readonly basis: 'history' | 'built-in';
}

/** The washes a session can be started with. */
export interface WashOptionsPayload {
  /**
   * True when the player may choose (a server in open mode). False in benchmark mode: every
   * wash then runs at `tier` whatever is asked.
   */
  readonly choice: boolean;
  /** The tier a wash runs at when nothing is asked. */
  readonly tier: WashTier;
  /** Items in the machine now, which the estimates are for. */
  readonly items: number;
  readonly options: readonly WashOption[];
}

/** What the server says about a session without touching its budget. */
export interface SessionSummary {
  readonly session_id: string;
  readonly level_id: string;
  readonly phase: EpisodePhase;
  readonly state_hash: string;
  readonly budget: BudgetState;
  /** Number of events in the action log. */
  readonly events: number;
  /** The wash job in hand, if a cycle has been started. */
  readonly job: {
    readonly job_id: string;
    readonly status: JobStatus;
    readonly progress: number;
  } | null;
  /** Who is playing, when the server knows; null while nobody has been named. */
  readonly player?: EpisodePlayer | null;
}

/** Outcome of restoring a session from its stored log. */
export interface RestoreSummary {
  readonly session_id: string;
  readonly level_id: string;
  /** Events replayed. */
  readonly replayed: number;
  /** True when every replayed event was accepted or rejected as recorded with the same hash. */
  readonly verified: boolean;
  /** Queries whose result digest differs from the recorded one (not fatal). */
  readonly digest_mismatches: number;
  /** True when a wash that was in hand when the log ends has been queued again. */
  readonly wash_resumed: boolean;
  readonly state_hash: string;
}

// ---------------------------------------------------------------------------------------------
// WebSocket messages (server to client)
// ---------------------------------------------------------------------------------------------

/** Sent once when the socket opens. */
export interface HelloMessage {
  readonly type: 'hello';
  readonly session_id: string;
  readonly level_id: string;
  readonly scene: SceneView;
  /** Frames per simulated second of `animation` messages. */
  readonly animation_rate_hz: number;
}

/**
 * Sent before the `state` message of an accepted action in which something moved: what the
 * physics did, sampled at a fixed rate of simulated time. Play the frames `1 / rate_hz` seconds
 * apart. For display only; the `state` message that follows is the result.
 */
export interface AnimationMessage {
  readonly type: 'animation';
  /** Sequence number of the action in the session's log. */
  readonly seq: number;
  readonly action: ActionName;
  readonly rate_hz: number;
  readonly frames: readonly AnimationFrame[];
}

/** Sent after every action (accepted or rejected) and when a wash ends. */
export interface StateMessage {
  readonly type: 'state';
  /** What caused the message. */
  readonly cause:
    | {
        readonly kind: 'action';
        readonly seq: number;
        readonly name: ActionName;
        readonly accepted: boolean;
        /** The rejection reason of a rejected action. */
        readonly reason?: string;
      }
    | { readonly kind: 'wash'; readonly job_id: string; readonly status: 'done' | 'failed' };
  readonly scene: SceneView;
}

/** Progress of the wash job. */
export interface WashMessage {
  readonly type: 'wash';
  readonly job_id: string;
  readonly status: JobStatus;
  /** Fraction complete, 0 to 1. */
  readonly progress: number;
  /** For `failed`: the infrastructure failure, in words. */
  readonly error?: string;
}

/** Sent when the socket cannot be served, just before it is closed. */
export interface ErrorMessage {
  readonly type: 'error';
  readonly reason: ServerRejectReason;
  readonly detail?: string;
}

/** Everything the server sends over a session's WebSocket. */
export type ServerMessage =
  | HelloMessage
  | AnimationMessage
  | StateMessage
  | WashMessage
  | ErrorMessage
  | { readonly type: 'pong' };

// ---------------------------------------------------------------------------------------------
// The data directory
// ---------------------------------------------------------------------------------------------

/** First line of a session file. */
export interface SessionHeaderLine {
  readonly type: 'session';
  /** Format of the file. */
  readonly version: 1;
  readonly session_id: string;
  readonly level_id: string;
  /** `canonicalHash` of the level, so that a changed level is noticed on restore. */
  readonly level_digest: string;
  readonly benchmark_version: string;
  /** Wall-clock time of creation (ISO 8601), added by the server. */
  readonly created_at: string;
  /** Who the session was created for, when whoever created it said. */
  readonly player?: EpisodePlayer;
}

/** One logged event of a session file. */
export interface SessionEventLine {
  readonly type: 'event';
  readonly event: ActionLogEvent;
  /** Wall-clock time the event was written (ISO 8601), added by the server. */
  readonly at: string;
}

/** How a wash of the session ended; written when it does, in log order. */
export interface SessionWashLine {
  readonly type: 'wash';
  /** The queue's job id. */
  readonly job_id: string;
  readonly status: 'done' | 'failed';
  readonly cache_key: string;
  readonly error?: string;
  readonly at: string;
}

/**
 * Something the server notes about a session that is not a call of the game: who is playing
 * it (a player who gave their name in the client) and when the player first arrived. Notes
 * take no part in replaying a session.
 */
export interface SessionNoteLine {
  readonly type: 'note';
  readonly at: string;
  /** The player, named after the session was created. */
  readonly player?: EpisodePlayer;
  /** True on the note written when the player first reached the session. */
  readonly opened?: boolean;
  /**
   * Written when a session was restored without the delivered report of one of its washes
   * (local play only; in benchmark mode such a restore fails): the load was washed again,
   * by the code named here, and the report the session now holds is that second one.
   */
  readonly rewashed?: { readonly job_id: string; readonly ran_with: string };
  /**
   * The tier the player chose for the washes of this session from here on (a server in open
   * mode lets the page choose per wash). Kept so that a wash which goes back to the queue
   * when the session is restored runs at the tier it was started at.
   */
  readonly wash_tier?: WashTier;
  /**
   * On a session that was made to wash the load of another one again (the full wash after a
   * preview): the session whose log was replayed into it up to the start of its cycle.
   */
  readonly rewash_of?: string;
}

/** A line of a session file (`<data>/sessions/<session id>.jsonl`). */
export type SessionLine = SessionHeaderLine | SessionEventLine | SessionWashLine | SessionNoteLine;

/** Which code ran a wash. Part of the cache key. */
export interface WashRunnerIdentity {
  /** Module specifier of a runner run in the worker process, or `'inline'`. */
  readonly module: string;
  /** Name of the export that is the `WashRunner`. */
  readonly export_name: string;
  /** Version of the runner; bump it whenever its results change. */
  readonly version: string;
  /**
   * Fingerprint of the parameters the washes are run with (the named parameter-set files and
   * the detergent, by the bytes of the files: `washParamsFingerprint` of the wash runner). Of
   * a runner module always; of an inline runner only when the queue was given parameters.
   * Part of the identity, so that the key of a stored wash, which is taken over the identity,
   * the tier and the manifest, covers the parameters.
   */
  readonly params?: string;
}

/**
 * A wash runner the worker process loads: `(await import(module))[exportName]` must be a
 * `WashRunner`. A bare specifier is resolved from `@spotless/server`.
 */
export interface WashRunnerModule {
  readonly module: string;
  readonly exportName: string;
  /** Version of the runner; bump it whenever its results change (it is part of the cache key). */
  readonly version: string;
}

/** A wash job as the queue records it (`<data>/jobs/<job id>.json`, `GET /api/jobs/:id`). */
export interface WashJobRecord {
  readonly job_id: string;
  readonly session_id: string;
  readonly level_id: string;
  /** Hash of the scene that is washed. */
  readonly state_hash: string;
  /** Key of the result in the cache: hash of the runner identity and the canonical manifest. */
  readonly cache_key: string;
  readonly status: JobStatus;
  /** Fraction complete, 0 to 1. */
  readonly progress: number;
  /** True when the result came from the cache. */
  readonly cached: boolean;
  readonly runner: WashRunnerIdentity;
  /** For `failed`: the infrastructure failure, in words. */
  readonly error?: string;
  /** Wall-clock times (ISO 8601), added by the server. */
  readonly queued_at: string;
  readonly started_at?: string;
  readonly finished_at?: string;
  /** The tier the queue asked the runner for (the rules of the level may say otherwise). */
  readonly tier?: WashTier;
  /** While running: the stage the wash is in, from a runner that reports one. */
  readonly stage?: WashStageProgress;
  /** When done: how the run went (time per stage, memory), from a runner that reports it. */
  readonly stats?: WashRunStats;
  /**
   * For the server's own runner, when done: its version as the worker found it once the wash
   * was over. It is `runner.version` unless the source of the simulation changed under the
   * wash, in which case the report was delivered but not kept in the result cache.
   */
  readonly ran_with?: string;
}

// ---------------------------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------------------------

/**
 * What the server tells a renderer beside the session: the wash whose outcome the scene may
 * show. Everything is read on demand, so a picture that needs none of it costs nothing.
 */
export interface RenderContext {
  readonly session_id: string;
  /** Cache key of the session's last finished wash, or null. */
  washKey(): string | null;
  /** The report of that wash as it was delivered to the player, or null. */
  report(): WashReport | null;
  /** The residue map of one item of that wash, or null. */
  residueOf(itemId: string): ResidueMap | null;
}

/** Reasons `render` can be refused with by the server. */
export type RenderRejectReason = QueryRejectReason | 'unknown_item' | 'no_report';

/** Renders a view of a session. */
export type SessionRenderFunction = (
  session: GameSession,
  request: RenderRequest,
  context?: RenderContext,
) => Promise<WireImage>;

/**
 * A render service: `render` draws; `check`, when given, says before anything is charged
 * why a request cannot be drawn (so that a refused `render` costs no query); `thumbnails`
 * supplies the pictures of `get_item`; `close` frees what the service holds.
 */
export interface SessionRenderService {
  render: SessionRenderFunction;
  check?(
    session: GameSession,
    request: RenderRequest,
    context?: RenderContext,
  ): Rejected<RenderRejectReason> | null;
  thumbnails?(session: GameSession, itemId: string): Promise<readonly WireImage[]>;
  close?(): Promise<void>;
}

/**
 * What draws the `render` query: a function, or a service that also checks requests and
 * supplies thumbnails (`createRenderService` of `render-service.ts`).
 */
export type SessionRenderer = SessionRenderFunction | SessionRenderService;

/** Options of `buildServer`. */
export interface ServerOptions {
  /** Directory for session logs, wash jobs and the result cache; created if missing. */
  readonly dataDir: string;
  /** The levels on offer; default the starter levels of `@spotless/levels`. */
  readonly levels?: readonly Level[];
  /**
   * What runs a wash. A {@link WashRunnerModule} is loaded in the worker process (the default
   * is `WASH_RUNNER` of `wash-runner.ts`); a function runs in the server's own process, which
   * is meant for tests.
   */
  readonly washRunner?: WashRunnerModule | WashRunner;
  /** Version of a `washRunner` given as a function (part of the cache key); default `'inline'`. */
  readonly washRunnerVersion?: string;
  /** Stop a wash that runs longer than this, milliseconds; default an hour; 0 for no limit. */
  readonly washTimeoutMs?: number;
  /**
   * The tier washes are asked for: default `official`, in every mode. `fast` is a preview: it
   * takes a quarter of the time and its verdicts differ from the official ones on a few items
   * of a full load; a report says which tier made it. A level whose rules name a tier is
   * washed at that one.
   */
  readonly washTier?: WashTier;
  /**
   * Which parameters washes are run with (`WashParamChoice` of
   * `@spotless/wash-runner/contract`): `machine-default` (the default: for the owner's machine
   * the current anchored set with the owner's detergent), `registry-defaults`, or named
   * parameter-set files with a detergent and its dose.
   */
  readonly washParams?: WashParamChoice;
  /**
   * True to wash with a parameter-set file whose stored hashes are stale; default false: such
   * a wash fails and says what to do.
   */
  readonly acceptStaleParams?: boolean;
  /**
   * Directory of the built web client, served at `/`. Default: `apps/web/dist` of this
   * repository when it holds an `index.html`; null to serve none.
   */
  readonly staticDir?: string | null;
  /** Sessions kept in memory at once (the rest are restored from their logs); default 32. */
  readonly maxSessions?: number;
  /** Frames per simulated second of `animation` messages; default 30. */
  readonly animationRateHz?: number;
  /** The render service; without one `render` is refused as `not_available`. */
  readonly renderer?: SessionRenderer;
  /**
   * The harness's token (at least 8 characters). With it the server is in benchmark mode: only a
   * request carrying it in the `x-spotless-admin` header may create a session, and it opens the
   * listings of sessions and wash jobs. Without it anybody may create a session (local play)
   * and the listings are closed to everybody.
   */
  readonly adminToken?: string;
  /** Fastify's request logging; default false. */
  readonly logger?: boolean;
  /** Wall-clock source for the timestamps of stored records; default the system clock. */
  readonly now?: () => string;
}
