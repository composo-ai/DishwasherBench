/**
 * The render service of the server: turns the `render` query of a session into a PNG drawn by
 * the scene code of `@spotless/render` in headless Chrome, and supplies the thumbnails of
 * `get_item`. It decides what a picture shows (which view, which camera, where the grid and
 * the labels go) from the session's scene, and leaves the painting to the page.
 *
 * A picture is a function of the level, the scene (its state hash), the phase of the episode,
 * the wash that was run on it and the request; pictures are kept under a hash of exactly
 * those, in memory and optionally on disk, so the same state and view cost one drawing.
 *
 * Nothing predictive of the wash is drawn: before the wash the items carry the soil the level
 * card describes, after it what the report says is left.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { instantiate } from '@spotless/catalogue';
import type { Pose, Quat, Rejected, Vec3 } from '@spotless/core';
import {
  canonicalHash,
  degToRad,
  poseTransformPoint,
  quantiseAngleDeg,
  quantisePositionMm,
  quantiseQuatGrid,
  quatFromAxisAngle,
  quatFromWire,
  quatMul,
  quatRotate,
  reject,
} from '@spotless/core';
import type { Level } from '@spotless/levels';
import type {
  CameraSpec,
  GridFrame,
  OverlayMarks,
  SceneNote,
  SceneViewName,
  ViewSubject,
} from '@spotless/render';
import {
  ITEM_VIEW_DIRECTIONS,
  SCENE_VIEW_NAMES,
  cameraProjector,
  captionMarks,
  customCameraSpec,
  itemAxisMarks,
  mergeMarks,
  namedCameraSpec,
  residueLegendMarks,
  viewMarks,
} from '@spotless/render';
import type {
  HeadlessRendererOptions,
  HeadlessSceneInput,
  StartTimings,
} from '@spotless/render/headless';
import { HeadlessRenderer, RenderUnavailableError } from '@spotless/render/headless';
import type {
  CustomCamera,
  GameSession,
  GhostSpec,
  QueryRejectReason,
  RenderRequest,
  WashReport,
  WireImage,
} from '@spotless/session';
import { RENDER_SIZE_DEFAULT_PX, RENDER_SIZE_MAX_PX } from '@spotless/session';
import { drawPoses, geometryKey, geometryPayload, toDrawPose } from './draw.ts';
import type { DrawPose, RenderContext, SessionRenderService } from './types.ts';

/** Edge of a thumbnail of `get_item`, pixels. */
export const THUMBNAIL_SIZE_PX = 256;

/** Smallest picture `render` draws, pixels. */
export const RENDER_SIZE_MIN_PX = 64;

/**
 * The views `render` draws. `top_cutlery` (the cutlery basket from above) is offered beside
 * the views the session contract names; the height maps are not built.
 */
export const RENDER_VIEWS: readonly string[] = [...SCENE_VIEW_NAMES, 'custom', 'item', 'items'];

/** Most items one sheet of the `items` view shows (a 10 by 10 grid). */
export const ITEM_SHEET_MAX = 100;

/** Options of {@link createRenderService}. */
export interface RenderServiceOptions extends HeadlessRendererOptions {
  /** Directory pictures are kept in between runs of the server; null or absent for none. */
  readonly cacheDir?: string | null;
  /** Pictures kept in memory; default 128. */
  readonly memoryEntries?: number;
}

/** What the render service has done so far, for measuring it. */
export interface RenderStats {
  /** Pictures drawn (not answered from the cache). */
  readonly drawn: number;
  /** Requests answered from the cache. */
  readonly cache_hits: number;
  /** Wall-clock milliseconds of every drawing, in order. */
  readonly draw_ms: readonly number[];
  /** How long the start of Chrome and the page took; null while it has not started. */
  readonly start: StartTimings | null;
  /** Which GPU draws, as WebGL names it; null while not started. */
  readonly gpu: string | null;
  /** Fingerprint of the drawing code; null while not started. */
  readonly fingerprint: string | null;
}

/** The server's render service: a {@link SessionRenderService} that can be measured. */
export interface RenderService extends SessionRenderService {
  check(
    session: GameSession,
    request: RenderRequest,
    context?: RenderContext,
  ): Rejected<QueryRejectReason | 'unknown_item' | 'no_report'> | null;
  render(session: GameSession, request: RenderRequest, context?: RenderContext): Promise<WireImage>;
  thumbnails(session: GameSession, itemId: string): Promise<readonly WireImage[]>;
  stats(): RenderStats;
  close(): Promise<void>;
}

type RenderReject = Rejected<QueryRejectReason | 'unknown_item' | 'no_report'>;

const levelDigests = new WeakMap<Level, string>();

function levelDigest(level: Level): string {
  let digest = levelDigests.get(level);
  if (digest === undefined) {
    digest = canonicalHash(level);
    levelDigests.set(level, digest);
  }
  return digest;
}

/** A request with every default written out, as it goes into the cache key. */
interface NormalisedRequest {
  readonly view: string;
  readonly size: number;
  readonly labels: boolean;
  readonly grid: boolean;
  readonly racks: 'in' | 'out' | null;
  readonly highlight: readonly string[];
  readonly ghost: GhostSpec | null;
  readonly camera: CustomCamera | null;
  readonly item_id: string | null;
  readonly after_wash: boolean;
  readonly traces: boolean;
}

function normalised(request: RenderRequest): NormalisedRequest {
  const options = request.options ?? {};
  return {
    view: request.view,
    size: Math.round(options.size_px ?? RENDER_SIZE_DEFAULT_PX),
    labels: options.labels === true,
    grid: options.grid === true,
    racks: options.racks ?? null,
    highlight: [...new Set(options.highlight ?? [])].sort(),
    ghost: options.ghost ?? null,
    camera: options.camera ?? null,
    item_id: options.item_id ?? null,
    after_wash: options.after_wash === true,
    traces: (options as { traces?: unknown }).traces === true,
  };
}

/**
 * The orientation of a request as a unit quaternion, composed as the session composes it:
 * a quaternion (w, x, y, z), or a preset of the item turned by roll about x, pitch about y
 * and yaw about z of the placement frame, each rounded to a whole degree. Null when malformed.
 */
function orientationOf(orientation: unknown, presets: ReadonlyMap<string, Quat>): Quat | null {
  if (typeof orientation !== 'object' || orientation === null) return null;
  const given = orientation as {
    quat_wxyz?: unknown;
    preset?: unknown;
    yaw_deg?: unknown;
    pitch_deg?: unknown;
    roll_deg?: unknown;
  };
  const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  let raw: Quat;
  if (given.quat_wxyz !== undefined) {
    const q = given.quat_wxyz;
    if (given.preset !== undefined) return null;
    if (!Array.isArray(q) || q.length !== 4 || !q.every(finite)) return null;
    raw = quatFromWire(q as unknown as [number, number, number, number]);
  } else {
    if (typeof given.preset !== 'string') return null;
    const preset = presets.get(given.preset);
    if (preset === undefined) return null;
    const angles: number[] = [];
    for (const angle of [given.yaw_deg, given.pitch_deg, given.roll_deg]) {
      if (angle === undefined) angles.push(0);
      else if (finite(angle)) angles.push(quantiseAngleDeg(angle));
      else return null;
    }
    const [yaw, pitch, roll] = angles as [number, number, number];
    raw = preset;
    if (roll !== 0) raw = quatMul(quatFromAxisAngle([1, 0, 0], degToRad(roll)), raw);
    if (pitch !== 0) raw = quatMul(quatFromAxisAngle([0, 1, 0], degToRad(pitch)), raw);
    if (yaw !== 0) raw = quatMul(quatFromAxisAngle([0, 0, 1], degToRad(yaw)), raw);
  }
  const grid = quantiseQuatGrid(raw);
  if (grid === null) return null;
  const length = Math.hypot(grid[0], grid[1], grid[2], grid[3]);
  return [grid[0] / length, grid[1] / length, grid[2] / length, grid[3] / length];
}

/** Where a candidate pose would be drawn, or why it cannot be. */
function ghostPose(
  session: GameSession,
  ghost: GhostSpec,
  frames: ReadonlyMap<string, Pose>,
): { itemType: string; pose: DrawPose } | RenderReject {
  const record = session.card.items.find((item) => item.item_id === ghost.item_id);
  const levelItem = session.level.items.find((item) => item.id === ghost.item_id);
  if (record === undefined || levelItem === undefined) {
    return reject('unknown_item', `ghost: no item '${ghost.item_id}'`);
  }
  const frame =
    ghost.frame === 'tub' ? ({ p: [0, 0, 0], q: [0, 0, 0, 1] } as Pose) : frames.get(ghost.frame);
  if (frame === undefined) return reject('invalid_argument', `ghost: no frame '${ghost.frame}'`);
  const position = ghost.position_mm as unknown;
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every((x) => typeof x === 'number' && Number.isFinite(x))
  ) {
    return reject('invalid_argument', 'ghost: position_mm must be three finite numbers');
  }
  const presets = new Map<string, Quat>(
    record.orientation_presets.map((preset) => [preset.name, quatFromWire(preset.quat_wxyz)]),
  );
  const q = orientationOf(ghost.orientation, presets);
  if (q === null) return reject('invalid_argument', 'ghost: the orientation is malformed');
  const mm = quantisePositionMm([
    position[0] as number,
    position[1] as number,
    position[2] as number,
  ]);
  const reference: Vec3 = [
    record.reference_point_mm[0] / 1000,
    record.reference_point_mm[1] / 1000,
    record.reference_point_mm[2] / 1000,
  ];
  const qTub = quatMul(frame.q, q);
  const at = poseTransformPoint(frame, [mm[0] / 1000, mm[1] / 1000, mm[2] / 1000]);
  const offset = quatRotate(qTub, reference);
  return {
    itemType: levelItem.itemType,
    pose: toDrawPose({ p: [at[0] - offset[0], at[1] - offset[1], at[2] - offset[2]], q: qTub }),
  };
}

function wire(png: Buffer, size: number): WireImage {
  return {
    mime_type: 'image/png',
    width_px: size,
    height_px: size,
    data_base64: png.toString('base64'),
  };
}

/** A translation of a draw pose, millimetres. */
function shifted(pose: DrawPose, by: readonly [number, number, number]): DrawPose {
  return {
    position_mm: [
      pose.position_mm[0] + by[0],
      pose.position_mm[1] + by[1],
      pose.position_mm[2] + by[2],
    ],
    quat_wxyz: pose.quat_wxyz,
  };
}

/**
 * Version of what this service writes on a picture (the names in the plan views); part of the
 * key a picture is cached under, so that a change of the writing is not answered from the
 * cache. 2: the folding shelves are named.
 */
export const OVERLAY_VERSION = 2;

/**
 * The folding shelves of the baskets, named for the plan views as `set_rack` names them
 * (`shelf_cup_front`, `shelf_knife_shelf`) with the state each is in: a refused pose that
 * collides with `<basket>_fittings` has met one of these, and the picture is where a player
 * sees which. Each name stands at the middle of the shelf as it is now (folded up, a strip
 * along the wall), tub frame, millimetres.
 */
export function shelfNotes(
  affordances: {
    readonly baskets: readonly { readonly basketId: string; readonly frame: string }[];
    readonly cupShelves: readonly {
      readonly basketId: string;
      readonly shelfId: string;
      readonly state: string;
      readonly box: { readonly min: Vec3; readonly max: Vec3 };
    }[];
    readonly holders: readonly {
      readonly basketId: string;
      readonly holderId: string;
      readonly state: string;
      readonly box: { readonly min: Vec3; readonly max: Vec3 };
    }[];
  },
  frames: readonly { readonly frame: string; readonly origin_mm: readonly number[] }[],
): SceneNote[] {
  const notes: SceneNote[] = [];
  const add = (basketId: string, id: string, state: string, box: { min: Vec3; max: Vec3 }) => {
    const frameId = affordances.baskets.find((basket) => basket.basketId === basketId)?.frame;
    const frame = frames.find((f) => f.frame === frameId);
    if (frameId === undefined || frame === undefined) return;
    notes.push({
      text: `shelf_${id} (${state})`,
      frame: frameId,
      at_mm: [
        (frame.origin_mm[0] ?? 0) + ((box.min[0] + box.max[0]) / 2) * 1000,
        (frame.origin_mm[1] ?? 0) + ((box.min[1] + box.max[1]) / 2) * 1000,
        (frame.origin_mm[2] ?? 0) + box.max[2] * 1000,
      ],
    });
  };
  for (const shelf of affordances.cupShelves)
    add(shelf.basketId, shelf.shelfId, shelf.state, shelf.box);
  for (const holder of affordances.holders)
    add(holder.basketId, holder.holderId, holder.state, holder.box);
  return notes;
}

/**
 * Creates the render service. Chrome is started by the first picture that has to be drawn,
 * so a server that is never asked for one pays nothing.
 */
export function createRenderService(options: RenderServiceOptions = {}): RenderService {
  const memoryEntries = options.memoryEntries ?? 128;
  const cacheDir = options.cacheDir ?? null;
  if (cacheDir !== null) mkdirSync(cacheDir, { recursive: true });
  const memory = new Map<string, Buffer>();
  const thumbnails = new Map<string, readonly WireImage[]>();
  const drawMs: number[] = [];
  let drawn = 0;
  let hits = 0;
  let starting: Promise<HeadlessRenderer> | null = null;
  let renderer: HeadlessRenderer | null = null;
  let failedAt = 0;
  let failure: RenderUnavailableError | null = null;
  let closed = false;

  const start = (): Promise<HeadlessRenderer> => {
    if (closed) return Promise.reject(new RenderUnavailableError('the render service is closed'));
    // A start that failed is not tried again at once: the answer is the same for a while.
    if (failure !== null && performance.now() - failedAt < 30_000) return Promise.reject(failure);
    starting ??= HeadlessRenderer.launch(options).then(
      (launched) => {
        renderer = launched;
        return launched;
      },
      (error: unknown) => {
        starting = null;
        failedAt = performance.now();
        failure =
          error instanceof RenderUnavailableError
            ? error
            : new RenderUnavailableError(error instanceof Error ? error.message : String(error));
        throw failure;
      },
    );
    return starting;
  };

  /** Runs one piece of work on the page at a time, in the order asked. */
  let busy: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const next = busy.then(work, work);
    busy = next.catch(() => undefined);
    return next;
  };

  const remember = (key: string, png: Buffer): void => {
    memory.delete(key);
    memory.set(key, png);
    while (memory.size > memoryEntries) {
      const oldest = memory.keys().next().value;
      if (oldest === undefined) break;
      memory.delete(oldest);
    }
  };

  const cached = (key: string): Buffer | null => {
    const held = memory.get(key);
    if (held !== undefined) {
      remember(key, held);
      return held;
    }
    if (cacheDir !== null) {
      const path = join(cacheDir, `${key}.png`);
      if (existsSync(path)) {
        const png = readFileSync(path);
        remember(key, png);
        return png;
      }
    }
    return null;
  };

  const keep = (key: string, png: Buffer): void => {
    remember(key, png);
    if (cacheDir !== null) {
      const path = join(cacheDir, `${key}.png`);
      writeFileSync(`${path}.tmp`, png);
      renameSync(`${path}.tmp`, path);
    }
  };

  /** The scene of a session on the page, loaded if the page does not hold it. */
  const ensureScene = async (page: HeadlessRenderer, session: GameSession): Promise<string> => {
    const key = canonicalHash({
      level: levelDigest(session.level),
      geometry: geometryKey(session),
    });
    if (page.hasScene(key)) return key;
    const payload = geometryPayload(session);
    const soils = new Map(session.card.items.map((item) => [item.item_id, item.soils]));
    const input: HeadlessSceneInput = {
      parts: payload.machine.parts.map((part) => ({
        id: part.id,
        role: part.role,
        material: part.material,
        reference_pose: part.reference_pose,
        shape: part.shape,
      })),
      item_types: Object.values(payload.item_types).map((type) => ({
        item_type: type.item_type,
        material: type.material,
        shape: type.shape,
      })),
      items: payload.items.map((item) => ({
        item_id: item.item_id,
        item_type: item.item_type,
        soils: (soils.get(item.item_id) ?? []).map((soil) => ({
          type: soil.type,
          regions: soil.regions,
        })),
      })),
    };
    await page.loadScene(key, input);
    return key;
  };

  /** Puts the scene on the page into the wash state wanted (or back out of it). */
  const ensureWash = async (
    page: HeadlessRenderer,
    scene: string,
    washKey: string | null,
    context: RenderContext | undefined,
    traces: boolean,
  ): Promise<void> => {
    if (page.washOf(scene) === washKey) return;
    if (washKey === null || context === undefined) {
      await page.setWash(scene, null, null);
      return;
    }
    const report = context.report();
    const items =
      report === null
        ? []
        : report.items
            .filter((item) => item.loaded && item.simulated !== false)
            .map((item) => ({
              item_id: item.item_id,
              map:
                item.loaded && (item.residue_cells ?? 0) > 0
                  ? context.residueOf(item.item_id)
                  : null,
            }));
    await page.setWash(scene, washKey, { items, traces });
  };

  /** The wash whose outcome the scene shows: the last finished one, while the load is as it was washed. */
  const shownWash = (
    session: GameSession,
    context: RenderContext | undefined,
    traces: boolean,
  ): string | null => {
    if (context === undefined || session.washJob()?.status !== 'done') return null;
    const key = context.washKey();
    if (key === null) return null;
    const report = context.report();
    return report !== null && report.state_hash === session.stateHash()
      ? washId(key, report, traces)
      : null;
  };

  /**
   * A wash as the page and the picture cache know it: its key, the result it gave, and
   * whether the faint traces are drawn.
   */
  const washId = (key: string, report: WashReport | null, traces: boolean): string =>
    `${key}:${report?.job.result_hash ?? 'no-hash'}:${traces ? 'traces' : 'counted'}`;

  const check = (
    session: GameSession,
    request: RenderRequest,
    context?: RenderContext,
  ): RenderReject | null => {
    const view = request.view as string;
    if (view === 'height_lower' || view === 'height_upper') {
      return reject('not_available', `the view '${view}' (a height map) is not built`);
    }
    if (!RENDER_VIEWS.includes(view)) {
      return reject(
        'invalid_argument',
        `no view '${view}'; the views are ${RENDER_VIEWS.join(', ')}`,
      );
    }
    const options = request.options ?? {};
    const size = options.size_px ?? RENDER_SIZE_DEFAULT_PX;
    if (!Number.isFinite(size) || size < RENDER_SIZE_MIN_PX || size > RENDER_SIZE_MAX_PX) {
      return reject(
        'invalid_argument',
        `size_px must be from ${RENDER_SIZE_MIN_PX} to ${RENDER_SIZE_MAX_PX}`,
      );
    }
    const known = new Set(session.card.items.map((item) => item.item_id));
    for (const id of options.highlight ?? []) {
      if (!known.has(id)) return reject('unknown_item', `highlight: no item '${id}'`);
    }
    if (view === 'custom') {
      const camera = options.camera;
      if (camera === undefined)
        return reject('invalid_argument', "the view 'custom' needs options.camera");
      if (
        ![
          camera.azimuth_deg,
          camera.elevation_deg,
          camera.distance_mm,
          camera.fov_deg,
          ...camera.target_mm,
        ].every((x) => Number.isFinite(x)) ||
        camera.distance_mm <= 0 ||
        camera.fov_deg <= 0 ||
        camera.fov_deg > 170
      ) {
        return reject(
          'invalid_argument',
          'options.camera: distance_mm and fov_deg must be positive (fov at most 170)',
        );
      }
    }
    if (view === 'items' && session.card.items.length > ITEM_SHEET_MAX) {
      return reject(
        'not_available',
        `the sheet of all items holds at most ${ITEM_SHEET_MAX}; use get_item or the view 'item'`,
      );
    }
    if (view === 'item') {
      if (options.item_id === undefined)
        return reject('invalid_argument', "the view 'item' needs options.item_id");
      if (!known.has(options.item_id))
        return reject('unknown_item', `no item '${options.item_id}'`);
      if (options.after_wash === true) {
        const done =
          session.washJob()?.status === 'done' &&
          context !== undefined &&
          context.washKey() !== null;
        if (!done)
          return reject(
            'no_report',
            'after_wash needs a finished wash; start the cycle and wait for the report',
          );
        // Without the report there is nothing to paint: say so, never draw the item as it
        // went in under a caption that says it was washed.
        if (context.report() === null)
          return reject(
            'not_available',
            'the report of the wash is not held by this server, so the washed item cannot be drawn',
          );
      }
    }
    if (options.ghost !== undefined) {
      const frames = new Map<string, Pose>(Object.entries(session.bodyPoses().parts));
      const ghost = ghostPose(session, options.ghost, frames);
      if ('accepted' in ghost) return ghost;
    }
    return null;
  };

  const render = async (
    session: GameSession,
    request: RenderRequest,
    context?: RenderContext,
  ): Promise<WireImage> => {
    const refusal = check(session, request, context);
    if (refusal !== null)
      throw new RangeError(`render: ${refusal.reason}: ${refusal.detail ?? ''}`);
    const wanted = normalised(request);
    const size = wanted.size;

    // Everything the picture depends on is read now, before anything is awaited.
    const stateHash = session.stateHash();
    const phase = session.phase();
    const washKey =
      wanted.view === 'item'
        ? wanted.after_wash && context !== undefined && context.washKey() !== null
          ? washId(context.washKey() as string, context.report(), wanted.traces)
          : null
        : wanted.view === 'items'
          ? null
          : shownWash(session, context, wanted.traces);
    const sceneView = drawPoses(session);
    const bodies = session.bodyPoses();
    const state = session.peekState();
    const card = session.card;
    const geometry = session.machineGeometry();

    // The baskets as they stand, or as the request wants them drawn.
    const partShift = new Map<string, readonly [number, number, number]>();
    const basketShift = new Map<string, readonly [number, number, number]>();
    if (wanted.racks !== null && wanted.view !== 'item') {
      for (const rack of card.machine.racks) {
        const now = state.racks[rack.rack];
        if (now === undefined || now === wanted.racks) continue;
        const travel: [number, number, number] = [
          rack.origin_out_mm[0] - rack.origin_in_mm[0],
          rack.origin_out_mm[1] - rack.origin_in_mm[1],
          rack.origin_out_mm[2] - rack.origin_in_mm[2],
        ];
        const sign = wanted.racks === 'out' ? 1 : -1;
        const by: [number, number, number] = [travel[0] * sign, travel[1] * sign, travel[2] * sign];
        const basket = geometry.affordances.baskets.find((b) => b.frame === rack.rack);
        if (basket !== undefined) basketShift.set(basket.basketId, by);
      }
      for (const part of geometry.parts) {
        const basketId =
          part.carriedBy ??
          (part.component === 'basket_wires'
            ? (geometry.affordances.baskets.find((b) => b.frame === part.frame)?.basketId ?? null)
            : null);
        const by = basketId === null ? undefined : basketShift.get(basketId);
        if (by !== undefined) partShift.set(part.id, by);
      }
    }
    const parts: { [id: string]: DrawPose } = {};
    for (const [id, pose] of Object.entries(sceneView.parts)) {
      const by = partShift.get(id);
      parts[id] = by === undefined ? pose : shifted(pose, by);
    }
    const items: { [id: string]: DrawPose } = {};
    const centres: { item_id: string; centre_mm: [number, number, number] }[] = [];
    const types = new Map(session.level.items.map((item) => [item.id, item.itemType]));
    for (const placed of state.placed) {
      const pose = sceneView.items[placed.item_id];
      const body = bodies.items[placed.item_id];
      if (pose === undefined || body === undefined) continue;
      const basket = geometry.affordances.baskets.find((b) => b.frame === placed.location);
      const by = basket === undefined ? undefined : basketShift.get(basket.basketId);
      items[placed.item_id] = by === undefined ? pose : shifted(pose, by);
      const box = instantiate(types.get(placed.item_id) as string).bbox;
      const centre = poseTransformPoint(body, [
        (box.min[0] + box.max[0]) / 2,
        (box.min[1] + box.max[1]) / 2,
        (box.min[2] + box.max[2]) / 2,
      ]);
      centres.push({
        item_id: placed.item_id,
        centre_mm: [
          centre[0] * 1000 + (by?.[0] ?? 0),
          centre[1] * 1000 + (by?.[1] ?? 0),
          centre[2] * 1000 + (by?.[2] ?? 0),
        ],
      });
    }
    const frames: GridFrame[] = card.machine.racks.map((rack) => ({
      frame: rack.rack,
      origin_mm: (parts[rack.rack] ?? { position_mm: rack.origin_in_mm }).position_mm,
      size_mm: rack.envelope_mm,
    }));
    const subject: ViewSubject = {
      tub_min_mm: card.machine.tub_min_mm,
      tub_max_mm: card.machine.tub_max_mm,
      racks: frames.map((frame) => ({
        rack: frame.frame,
        origin_mm: frame.origin_mm,
        envelope_mm: frame.size_mm,
      })),
    };

    const key = canonicalHash({
      level: levelDigest(session.level),
      geometry: geometryKey(session),
      state: stateHash,
      phase,
      wash: washKey,
      request: wanted,
      // What this service writes on a picture beyond what the page draws; changed with it.
      overlay: OVERLAY_VERSION,
    });
    const page = await start();
    const full = `${page.bundle.fingerprint.slice(0, 16)}-${key.replace(/^sha256:/, '')}`;
    const held = cached(full);
    if (held !== null) {
      hits += 1;
      return wire(held, size);
    }

    // From here to the picture nothing else may use the page: the wash state of a scene is
    // shared by every session of its level.
    return exclusive(async () => {
      const started = performance.now();
      const scene = await ensureScene(page, session);
      await ensureWash(page, scene, washKey, context, wanted.traces);
      let png: Buffer;
      if (wanted.view === 'items') {
        // Every item of the level on one sheet, as it goes in: what a person sees in the tray.
        const all = card.items.slice(0, ITEM_SHEET_MAX);
        const columns = Math.max(1, Math.ceil(Math.sqrt(all.length)));
        const cell = Math.floor(size / columns);
        const direction = ITEM_VIEW_DIRECTIONS[0] as (typeof ITEM_VIEW_DIRECTIONS)[number];
        const panels = all.map((item, i) => ({
          item_id: item.item_id,
          azimuth_deg: direction.azimuth_deg,
          elevation_deg: direction.elevation_deg,
          x: (i % columns) * cell,
          y: Math.floor(i / columns) * cell,
          width: cell,
          height: cell,
        }));
        const names = panels.map((panel) =>
          captionMarks(panel.item_id, cell, { x: panel.x + 3, y: panel.y + cell - 20 }),
        );
        png = await page.renderItem({
          scene,
          item_id: all[0]?.item_id ?? '',
          wash: null,
          width: size,
          height: size,
          panels,
          marks: mergeMarks(...names),
        });
      } else if (wanted.view === 'item') {
        const itemId = wanted.item_id as string;
        const single = wanted.camera !== null;
        const half = Math.floor(size / 2);
        const panels = single
          ? [
              {
                azimuth_deg: wanted.camera?.azimuth_deg ?? 0,
                elevation_deg: wanted.camera?.elevation_deg ?? 0,
                x: 0,
                y: 0,
                width: size,
                height: size,
              },
            ]
          : ITEM_VIEW_DIRECTIONS.map((direction, i) => ({
              azimuth_deg: direction.azimuth_deg,
              elevation_deg: direction.elevation_deg,
              x: (i % 2) * half,
              y: Math.floor(i / 2) * half,
              width: half,
              height: half,
            }));
        const title = captionMarks(
          wanted.after_wash
            ? `${itemId} after the wash: what is left on it is painted magenta`
            : `${itemId} as it goes in, with its soil; arrows: the item's own axes from its reference point`,
          size,
        );
        // The item's own axes on every panel: which end is +x decides where a yaw puts it.
        const record = card.items.find((item) => item.item_id === itemId);
        const box = instantiate(types.get(itemId) as string).bbox;
        const axes: OverlayMarks[] =
          record === undefined
            ? []
            : panels.map((panel) =>
                itemAxisMarks({
                  min_mm: [box.min[0] * 1000, box.min[1] * 1000, box.min[2] * 1000],
                  max_mm: [box.max[0] * 1000, box.max[1] * 1000, box.max[2] * 1000],
                  reference_mm: record.reference_point_mm,
                  azimuth_deg: panel.azimuth_deg,
                  elevation_deg: panel.elevation_deg,
                  panel,
                }),
              );
        const legend = wanted.after_wash
          ? [residueLegendMarks({ x: 0, y: 0, width: size, height: size }, wanted.traces)]
          : [];
        const captions: OverlayMarks[] = single
          ? []
          : panels.map((panel, i) =>
              captionMarks(
                (ITEM_VIEW_DIRECTIONS[i] as (typeof ITEM_VIEW_DIRECTIONS)[number]).label,
                half,
                {
                  x: panel.x + 8,
                  y: panel.y + panel.height - 26,
                },
              ),
            );
        png = await page.renderItem({
          scene,
          item_id: itemId,
          wash: washKey,
          width: size,
          height: size,
          panels,
          marks: mergeMarks(...axes, ...captions, ...legend, title),
        });
      } else {
        const camera: CameraSpec =
          wanted.view === 'custom'
            ? customCameraSpec(wanted.camera as NonNullable<typeof wanted.camera>)
            : namedCameraSpec(wanted.view as SceneViewName, subject, 1);
        const notes: SceneNote[] = [];
        notes.push(...shelfNotes(geometry.affordances, frames));
        for (const row of geometry.affordances.tineRows) {
          const frame = frames.find((f) => f.frame === row.frame);
          const first = row.tines[0];
          if (frame === undefined || first === undefined) continue;
          notes.push({
            text: `tine_row_${row.rowId}${row.state === 'folded' ? ' (folded)' : ''}`,
            frame: row.frame,
            at_mm: [
              frame.origin_mm[0] + first.base[0] * 1000,
              frame.origin_mm[1] + first.base[1] * 1000,
              frame.origin_mm[2] + first.base[2] * 1000,
            ],
          });
        }
        // The cells of the cutlery basket, outlined and named in its plan view.
        const outlines: { frame: string; loop_mm: [number, number, number][] }[] = [];
        const basketPose = bodies.parts['cutlery_basket'];
        if (basketPose !== undefined && wanted.view === 'top_cutlery') {
          for (const cell of geometry.affordances.cutleryCells) {
            const { min, max } = cell.box;
            const top = max[2];
            const corner = (x: number, y: number): [number, number, number] => {
              const p = poseTransformPoint(basketPose, [x, y, top]);
              return [p[0] * 1000, p[1] * 1000, p[2] * 1000];
            };
            outlines.push({
              frame: 'cutlery_basket',
              loop_mm: [
                corner(min[0], min[1]),
                corner(max[0], min[1]),
                corner(max[0], max[1]),
                corner(min[0], max[1]),
              ],
            });
            notes.push({
              text: `cell_${cell.id}`,
              frame: 'cutlery_basket',
              at_mm: corner((min[0] + max[0]) / 2, (min[1] + max[1]) / 2),
            });
          }
        }
        const washed = washKey !== null;
        const viewOnly = viewMarks({
          view: wanted.view,
          width: size,
          height: size,
          project: cameraProjector(camera, size, size),
          tub_min_mm: card.machine.tub_min_mm,
          tub_max_mm: card.machine.tub_max_mm,
          frames,
          grid: wanted.grid,
          labels: wanted.labels,
          items: centres,
          notes,
          outlines,
          clip_above_mm: camera.clip_above_mm,
          clip_below_mm: camera.clip_below_mm ?? null,
        });
        // A picture of the washed load says so, and says what the magenta means.
        const marks = washed
          ? mergeMarks(
              viewOnly,
              residueLegendMarks({ x: 0, y: 0, width: size, height: size }, wanted.traces),
              captionMarks(
                'after the wash: washed items are drawn bare, what is left is magenta',
                size,
                {
                  x: 6,
                  y: 22,
                },
              ),
            )
          : viewOnly;
        let ghost: { item_type: string; pose: DrawPose } | null = null;
        if (wanted.ghost !== null) {
          const framePoses = new Map<string, Pose>(Object.entries(bodies.parts));
          const resolved = ghostPose(session, wanted.ghost, framePoses);
          if (!('accepted' in resolved))
            ghost = { item_type: resolved.itemType, pose: resolved.pose };
        }
        png = await page.render({
          scene,
          wash: washKey,
          width: size,
          height: size,
          camera,
          poses: { parts, items },
          highlight: wanted.highlight,
          ghost,
          marks,
        });
      }
      drawn += 1;
      drawMs.push(performance.now() - started);
      keep(full, png);
      return wire(png, size);
    });
  };

  return {
    check,
    render,

    async thumbnails(session: GameSession, itemId: string): Promise<readonly WireImage[]> {
      const item = session.level.items.find((candidate) => candidate.id === itemId);
      const record = session.card.items.find((candidate) => candidate.item_id === itemId);
      if (item === undefined || record === undefined) return [];
      const page = await start();
      const key = canonicalHash({
        code: page.bundle.fingerprint,
        type: item.itemType,
        soils: record.soils.map((soil) => ({ type: soil.type, regions: soil.regions })),
        reference: record.reference_point_mm,
        size: THUMBNAIL_SIZE_PX,
      });
      const held = thumbnails.get(key);
      if (held !== undefined) {
        hits += 1;
        return held;
      }
      return exclusive(async () => {
        const scene = await ensureScene(page, session);
        const images: WireImage[] = [];
        const started = performance.now();
        const box = instantiate(item.itemType).bbox;
        for (const direction of ITEM_VIEW_DIRECTIONS) {
          const panel = { x: 0, y: 0, width: THUMBNAIL_SIZE_PX, height: THUMBNAIL_SIZE_PX };
          // The item's own axes from its reference point: which end is +x.
          const axes = itemAxisMarks({
            min_mm: [box.min[0] * 1000, box.min[1] * 1000, box.min[2] * 1000],
            max_mm: [box.max[0] * 1000, box.max[1] * 1000, box.max[2] * 1000],
            reference_mm: record.reference_point_mm,
            azimuth_deg: direction.azimuth_deg,
            elevation_deg: direction.elevation_deg,
            panel,
          });
          const png = await page.renderItem({
            scene,
            item_id: itemId,
            wash: null,
            width: THUMBNAIL_SIZE_PX,
            height: THUMBNAIL_SIZE_PX,
            panels: [
              {
                azimuth_deg: direction.azimuth_deg,
                elevation_deg: direction.elevation_deg,
                x: 0,
                y: 0,
                width: THUMBNAIL_SIZE_PX,
                height: THUMBNAIL_SIZE_PX,
              },
            ],
            marks: mergeMarks(axes, captionMarks(direction.label, THUMBNAIL_SIZE_PX)),
          });
          images.push(wire(png, THUMBNAIL_SIZE_PX));
        }
        drawn += 1;
        drawMs.push(performance.now() - started);
        thumbnails.set(key, images);
        return images;
      });
    },

    stats(): RenderStats {
      return {
        drawn,
        cache_hits: hits,
        draw_ms: [...drawMs],
        start: renderer?.startTimings ?? null,
        gpu: renderer?.gpu ?? null,
        fingerprint: renderer?.bundle.fingerprint ?? null,
      };
    },

    async close(): Promise<void> {
      closed = true;
      const pending = starting;
      starting = null;
      if (pending !== null) {
        await pending.then(
          (launched) => launched.close(),
          () => undefined,
        );
      }
    },
  };
}
