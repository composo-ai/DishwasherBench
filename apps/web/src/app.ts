/**
 * The game as a person plays it: the tray, the item in hand, the baskets, the mechanical
 * check, the cycle and the report. Every gesture ends in one of the session's actions or
 * queries on the server (`api.ts`); this file holds what is on the screen and nothing that
 * decides the game.
 */

import type { Quat, Vec3 } from '@spotless/core';
import {
  degToRad,
  poseInverseTransformPoint,
  quatFromAxisAngle,
  quatFromWire,
  quatMul,
  quatNormalise,
  quatRotate,
} from '@spotless/core';
import { boundingBox, signedDistance } from '@spotless/geometry';
import type {
  GhostTint,
  OverlayMarks,
  RegionLayers,
  ResidueCellData,
  ViewSubject,
} from '@spotless/render';
import {
  decodeResidueMap,
  ITEM_VIEW_DIRECTIONS,
  viewMarks,
  materialAppearance,
  residueLayersByRegion,
  residueOutline,
  residueTiles,
  rgbToCss,
  SCENE_VIEW_NAMES,
  soilAppearance,
  soilLayersByRegion,
  summariseResidue,
  viewLabel,
} from '@spotless/render';
import type {
  EpisodePlayer,
  GeometryPayload,
  GuidancePayload,
  LevelListing,
  SceneView,
  ServerMessage,
} from '@spotless/server';
// The ranked list of suggested spots: the same function the MCP tool answers with, so that a
// person and an agent are given the same advice in the same order.
import type { SlotAdvicePlace } from '@spotless/server/slot-advice';
import { slotAdvice, slotAdviceLabel } from '@spotless/server/slot-advice';
import type {
  FrameId,
  ItemRecord,
  LevelCard,
  PlaceMode,
  PreviewResult,
  RackCard,
  RackId,
  SceneState,
  Vec3Mm,
  WashReport,
  WashStageProgress,
  WashTier,
} from '@spotless/session';
import type { AimTarget } from './aim.ts';
import { aimFrame, aimPoint, missFromRay } from './aim.ts';
import type { AimTry, BasketPlan, Landing, LandingVerdict } from './landing.ts';
import {
  AIM_AGREES_MM,
  bestTry,
  judgeCellLanding,
  judgeLanding,
  landingWords,
  refused,
} from './landing.ts';
import { AnimationQueue } from './animation.ts';
import type { LevelEntry, WashChoice } from './api.ts';
import {
  ApiError,
  createSession,
  guidance,
  health,
  levelCard,
  listLevels,
  SessionApi,
} from './api.ts';
import { cleanPlayerName, marksInput, parseEpisodeLink } from './benchmark.ts';
import type { Child } from './dom.ts';
import { h, setChildren } from './dom.ts';
import type { Line } from './format.ts';
import {
  thingsText,
  washTimeText,
  describeBudget,
  describeDrop,
  describeLoadCheck,
  describeMoved,
  describePlaced,
  describeRejection,
  difficultyText,
  optionLabel,
  optionValueLabel,
  listOf,
  locationText,
  tidy,
} from './format.ts';
import { DISCLAIMER, howToPlay } from './how-to.ts';
import { INSPECTOR_SIDES, ItemInspector } from './inspector.ts';
import type { DrawPose, GhostPose } from './pose.ts';
import {
  clampToEnvelope,
  ghostDrawPose,
  ghostQuat,
  heightUnderMm,
  holdHeightMm,
  INSERT_DIRECTIONS,
  insertDirectionFromDrag,
  parseNumber,
  parseQuat,
  placeRequest,
  directionInFrame,
  pointFromFrame,
  previewRequest,
  quantiseGhost,
  quantiseQuatWire,
  reachAlongMm,
  reachBelowMm,
  wirePoseDrawPose,
  wrapAngleDeg,
} from './pose.ts';
import type { ReportRow } from './report.ts';
import { reportStatus, reportView, residueLegend, washProgressView } from './report.ts';
import type { StageView } from './stage.ts';
import { Stage } from './stage.ts';
import type { RowSlot, Stance, WheelState } from './stance.ts';
import {
  FINE_TURN_STEP_DEG,
  nearestSlot,
  nextStance,
  rowSlots,
  slotDrop,
  stancesOf,
  standsOnEdge,
  TURN_STEP_DEG,
  turnYaw,
  wheelSteps,
  yawFacing,
} from './stance.ts';
import { StanceView } from './stance-view.ts';

const IDENTITY: DrawPose = { position_mm: [0, 0, 0], quat_wxyz: [1, 0, 0, 0] };

/**
 * Milliseconds the piece in hand must rest before the server is asked where it would be let
 * go there. Short: the answer is what the piece is drawn by.
 */
const PREVIEW_DELAY_MS = 70;

/** How near the cursor must be to the mark of a suggested spot to take it up, pixels. */
const SPOT_REACH_PX = 16;

/** Marks of suggested spots nearer each other than this in the picture are merged, pixels. */
const SPOT_APART_PX = 18;

/**
 * A piece in a row is let go on the tines, some 60 mm above where it ends standing; let go
 * more than this above its standing height it rests on something else.
 */
/**
 * What the difficulty figure of a level is, for a player: it is worked out from the level's
 * own items and soils (`levelDifficulty` of `@spotless/levels`: how much there is to choose
 * between, how many pieces an easy mistake spoils, how tough the soil is, how many pieces are
 * awkward), and it is not a measured result: the scripted reference loads do not score lower
 * level by level (docs/benchmark/levels.md).
 */
const DIFFICULTY_NOTE =
  'The difficulty figure (1 to 10) is worked out from what is on the counter: how much there is to choose between, how many pieces a mistake spoils, how tough the soil is and how many pieces are awkward. It is not a score anyone has measured.';

const PERCHED_ABOVE_MM = 120;

/**
 * The most a piece is carried lower than the page would hold it because the game says it is in
 * the roof of the tub there, and the room left to the roof each time, millimetres. A piece is
 * carried 15 mm above the wires of its basket (`holdHeightMm`): 12 mm lower it is still above
 * them.
 */
const ROOF_DROP_MAX_MM = 12;
const ROOF_DROP_MARGIN_MM = 2;

/** How often the place is aimed again after a preview before the cursor moves on. */
const REAIMS_MAX = 6;

/** How long a click waits for the game to say where the piece would be let go, milliseconds. */
const CLICK_WAIT_MS = 2500;

/** Pixels the mouse may move between press and release for it to count as a click. */
const CLICK_SLOP_PX = 5;

/** Names of the frames, for the page. */
const FRAME_LABELS: { readonly [frame: string]: string } = {
  lower_rack: 'Lower basket',
  upper_rack: 'Upper basket',
  third_rack: 'Third rack',
  cutlery_basket: 'Cutlery basket',
  tub: 'Tub (machine frame)',
};

interface Held {
  readonly itemId: string;
  ghost: GhostPose;
  /** True until the player sets the height: the height then follows the preset. */
  autoHeight: boolean;
  /** The server's verdict on the pose of `previewKey`, when it has given one. */
  preview: PreviewResult | null;
  previewKey: string | null;
  /** Set by a rejected `place`: the tint stays until the pose changes. */
  rejectedTint: GhostTint | null;
  /** True while a pose typed in the exact panel holds the piece: the cursor does not move it. */
  exact: boolean;
  /** The turn about the vertical the player gave the piece; a row of tines overrides it over the row. */
  freeYaw: number;
  /** True when the player turned a piece that stands in a row to face the other way. */
  flip: boolean;
  /**
   * Height of the reference point where the piece would be let go, in the frame of the
   * ghost, as the last preview said; null before any. The cursor aims at this height.
   */
  restZ: number | null;
  /** How often the place was aimed again after a preview since the cursor last moved. */
  reaims: number;
  /** Heights the cursor aimed at since it last moved at which the piece landed higher, and lower. */
  aimLow: number | null;
  aimHigh: number | null;
  /** The heights aimed at since the cursor last moved, with how near the cursor the piece landed. */
  tries: AimTry[];
  /** True once the search has been started again from the floor of the basket. */
  fromFloor: boolean;
  /** True when the last landing found was one the piece would not stay in the basket at. */
  lastRefused: boolean;
  /** True once the place under the cursor is settled: the game has answered for it. */
  aimSettled: boolean;
  /** True when the player clicked before that: the piece is put down as soon as it is. */
  clickQueued: boolean;
  /** Where the cursor was when the place was last worked out; null before. */
  aimedAt: readonly [number, number] | null;
  /** True when the piece itself changed (a turn, a stance): the search starts again in place. */
  restart: boolean;
  /** How far the piece is held from the place the cursor aims at: where it was grabbed. */
  grab: readonly [number, number];
  /** Where it stood when it was picked up in the machine: Escape puts it back there. */
  origin: PlacedPose | null;
  /** The row and gap it has taken up, in words; null when it is held freely. */
  snapped: string | null;
  /**
   * By how much the piece is carried lower than the page would hold it, millimetres: raised
   * when the game answers that, held there, it is in the roof of the tub (the page's own
   * figure for the room under the roof is a few millimetres generous for a piece that is
   * turned or whose reference point is off its middle). Never more than `ROOF_DROP_MAX_MM`.
   */
  roofDrop: number;
  /** Index of the suggested spot it is held over; null when over none. */
  spot: number | null;
}

/** A pose in the machine as the scene reports it. */
interface PlacedPose {
  readonly frame: FrameId;
  readonly position_mm: Vec3Mm;
  readonly quat_wxyz: readonly [number, number, number, number];
}

interface WashState {
  readonly job_id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  /** `performance.now()` when the wash was first seen; for the display of elapsed time only. */
  readonly since: number;
  error?: string;
  /** The stage the wash is in as the server last reported it. */
  stage?: WashStageProgress;
  /** `performance.now()` at the moment that stage was reported (not when it was fetched). */
  stageAt?: number;
}

/** No soil layers: how a washed item is drawn before its residue is painted on it. */
const BARE: RegionLayers = new Map();

function linesOf(lines: readonly Line[]): HTMLElement {
  return h(
    'ul',
    { class: 'lines' },
    lines.map((l) => h('li', { class: `line ${l.level}` }, l.text)),
  );
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return `The server refused the request (${error.message}).`;
  return `The server could not be reached (${error instanceof Error ? error.message : String(error)}).`;
}

/** The client. */
export class App {
  private readonly stage: Stage;
  private levels: LevelEntry[] = [];
  private api: SessionApi | null = null;
  private socket: WebSocket | null = null;
  private card: LevelCard | null = null;
  private geometry: GeometryPayload | null = null;
  private view: SceneView | null = null;
  private readonly records = new Map<string, ItemRecord>();
  private readonly itemTypes = new Map<string, string>();
  private readonly thumbnails = new Map<string, string>();
  /** Where every body is drawn right now (it trails `view` while an animation plays). */
  private shownParts: { [id: string]: DrawPose } = {};
  private readonly queue = new AnimationQueue<DrawPose, SceneView>();
  private held: Held | null = null;
  /**
   * The suggested spots last asked for (`list_slots` with the item in hand), most useful
   * first: free spots where the item seats, free spots above the tine tips, spots not free.
   */
  private suggestions: {
    readonly itemId: string;
    readonly frame: FrameId;
    readonly places: readonly SlotAdvicePlace[];
  } | null = null;
  private selected: string | null = null;
  private frame: FrameId = 'lower_rack';
  private mode: PlaceMode = 'drop';
  private insertDir = 0;
  /** Whether a piece on edge takes up the rows of tines it is held over. */
  private snapRows = true;
  /** True while the key for placing freely (Alt) is down. */
  private freeKey = false;
  /** Whether the exact pose panel is unfolded. */
  private exactOpen = false;
  /** Where the cursor last was over the stage, page pixels; null when it is elsewhere. */
  private cursor: { x: number; y: number } | null = null;
  /** A press on a piece of the list that may become a drag into the machine. */
  private trayDrag: { itemId: string; x: number; y: number; dragging: boolean } | null = null;
  /** True right after a drag from the list ended: the click that follows it is not a pick-up. */
  private dragEnded = false;
  private readonly wheel: WheelState = { travel: 0, lastAt: 0 };
  /** The pictures of the stances, by item and preset. */
  private readonly stancePictures = new Map<string, string>();
  private stanceView: StanceView | null = null;
  /** Bounding boxes of pieces on edge by item, preset and turn, for the rows of tines. */
  private readonly edgeBoxes = new Map<
    string,
    { box: { min: Vec3Mm; max: Vec3Mm }; reference: Vec3Mm }
  >();
  /** The baskets as the page judges a landing by, by frame; emptied when the machine changes. */
  private readonly basketPlans = new Map<FrameId, BasketPlan>();
  /** The piece put down last, as it was held: Z takes it back into the hand like that. */
  private lastPut: { itemId: string; ghost: GhostPose } | null = null;
  /** The washes on offer and the one chosen in the start dialog. */
  private washChoice: WashChoice | null = null;
  private washTier: WashTier | null = null;
  /** True when the server lets the page choose the tier of a wash. */
  private canChooseWash = false;
  private previewTimer: number | null = null;
  private pending = 0;
  private feedback: { title: string; lines: readonly Line[] } | null = null;
  private check: { lines: readonly Line[]; hash: string } | null = null;
  private wash: WashState | null = null;
  private report: WashReport | null = null;
  private reportPainted = false;
  /** The residue maps fetched so far, by item id; null for an item that has none to fetch. */
  private readonly residue = new Map<string, ResidueCellData | null>();
  /** Whether traces too faint to count are drawn as well. */
  private showTraces = false;
  /** The close-up of one washed item, while its dialog is open. */
  private inspector: ItemInspector | null = null;
  private inspecting: { itemId: string; soil: number | null } | null = null;
  private queriesSpent = 0;
  private lastTick = performance.now();
  private pointerDown: { x: number; y: number; button: number } | null = null;
  private insertDrag: { x: number; y: number; dir: number | null } | null = null;
  private readonly el: { readonly [name: string]: HTMLElement };
  private busyTimer: number | null = null;
  /** Which part of the tray is shown. */
  private trayTab: 'counter' | 'machine' = 'counter';
  /** True when the server only plays episodes the harness created (a link is needed). */
  private benchmarkMode = false;
  /** Who is playing this episode, when the server has a name. */
  private player: EpisodePlayer | null = null;
  /** The generic loading guidance, once fetched. */
  private guidanceText: GuidancePayload | null = null;
  /** Whether item ids and the millimetre grid are drawn over the stage. */
  private showLabels = false;
  private showGrid = false;
  /** The four pictures of each item (the ones `get_item` returns to an agent), by item id. */
  private readonly itemPictures = new Map<string, string[]>();

  constructor(root: HTMLElement) {
    const canvas = h('canvas', { id: 'view', tabindex: '0' });
    const overlay = h('canvas', { id: 'overlay' });
    this.el = {
      top: h('header', { id: 'topbar' }),
      tray: h('aside', { id: 'tray' }),
      side: h('aside', { id: 'side' }),
      hint: h('div', { id: 'hint' }),
      working: h(
        'div',
        { id: 'working', hidden: true },
        'The server is working out the physics of that…',
      ),
      modal: h('div', { id: 'modal-root' }),
      hand: h('section', { id: 'hand', class: 'panel' }),
      selection: h('section', { id: 'selection', class: 'panel' }),
      baskets: h('section', { id: 'baskets', class: 'panel' }),
      feedback: h('section', { id: 'feedback', class: 'panel' }),
      check: h('section', { id: 'check', class: 'panel' }),
      cycle: h('section', { id: 'cycle', class: 'panel' }),
    };
    const el = this.el;
    setChildren(
      el['side'] as HTMLElement,
      el['hand'],
      el['selection'],
      el['feedback'],
      el['baskets'],
      el['check'],
      el['cycle'],
    );
    setChildren(
      root,
      el['top'],
      el['tray'],
      h('main', { id: 'stage' }, canvas, overlay, el['hint'], el['working']),
      el['side'],
      el['modal'],
    );
    this.stage = new Stage(canvas, overlay);
    this.bindCanvas(canvas);
    window.addEventListener('resize', () => this.stage.resize());
    window.addEventListener('keydown', (event) => this.onKey(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));
    window.addEventListener('pointermove', (event) => this.onTrayDragMove(event));
    window.addEventListener('pointerup', (event) => this.onTrayDragEnd(event));
    const tick = (): void => {
      this.tick();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------------------------------------
  // Starting: levels and sessions
  // -------------------------------------------------------------------------------------------

  /** Loads the levels, then resumes the session named in the address or shows the picker. */
  async start(): Promise<void> {
    this.renderAll();
    // The guidance every player is shown, and whether this server plays only the episodes a
    // harness created. Neither is needed to play: a server without them is an older one.
    try {
      const server = await health();
      this.benchmarkMode = server.benchmark_mode;
      this.canChooseWash = server.wash_choice === true;
      this.guidanceText = await guidance();
    } catch {
      this.benchmarkMode = false;
    }
    // A server that plays recorded episodes keeps its list of levels to the harness: a
    // participant sees the level of their own episode and no other.
    if (!this.benchmarkMode) {
      try {
        this.levels = await listLevels();
      } catch (error) {
        this.showModal('Spotless', [h('p', { class: 'line bad' }, messageOf(error))], []);
        return;
      }
    }
    const link = parseEpisodeLink(location.hash);
    if (link.sessionId !== null && (await this.resume(link.sessionId, link.player))) return;
    if (this.benchmarkMode) {
      this.showModal(
        'Spotless',
        [
          h(
            'p',
            null,
            link.sessionId === null
              ? 'This server runs recorded episodes. Open the link you were given: it names your episode.'
              : 'This link does not open an episode on this server. Check it with whoever gave it to you.',
          ),
        ],
        [],
      );
      return;
    }
    this.showLevelPicker();
  }

  /**
   * Finds out who is playing the episode. In benchmark mode an episode belongs to a named
   * player: the name comes with the episode, or with the link, or the player types it once.
   */
  private async identify(api: SessionApi, fromLink: string | null): Promise<void> {
    this.player = null;
    let answer;
    try {
      answer = await api.player();
    } catch {
      return;
    }
    this.player = answer.player;
    if (!answer.name_wanted) return;
    if (fromLink !== null) {
      const named = await api.namePlayer(fromLink).catch(() => null);
      if (named?.accepted === true && named.player !== undefined) {
        this.player = named.player;
        return;
      }
    }
    await this.askName(api);
  }

  /** Asks the player for the name their episode is recorded under. */
  private askName(api: SessionApi): Promise<void> {
    return new Promise<void>((done) => {
      const input = h('input', {
        id: 'player-name',
        type: 'text',
        maxlength: '64',
        autocomplete: 'off',
      });
      const problem = h('p', { class: 'line bad', id: 'player-name-problem' });
      const submit = async (): Promise<void> => {
        const name = cleanPlayerName(input.value);
        if (name === null) {
          problem.textContent = 'Type the name or participant number you were given.';
          return;
        }
        try {
          const named = await api.namePlayer(name);
          if (named.player !== undefined) this.player = named.player;
          else this.player = (await api.player()).player;
        } catch (error) {
          problem.textContent = messageOf(error);
          return;
        }
        this.closeModal();
        this.renderTop();
        done();
      };
      input.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Enter') void submit();
      });
      this.showModal(
        'Who is playing?',
        [
          h(
            'p',
            null,
            'This episode is recorded: what you place, take out and check, with the times, and the result of the wash. Nothing else is recorded. Type the name or participant number you were given; it cannot be changed afterwards.',
          ),
          h('label', { class: 'field wide' }, h('span', null, 'Name'), input),
          problem,
        ],
        [
          h(
            'button',
            { id: 'player-name-ok', class: 'primary', onclick: () => void submit() },
            'Start',
          ),
        ],
      );
      input.focus();
    });
  }

  private async resume(sessionId: string, playerFromLink: string | null = null): Promise<boolean> {
    try {
      const api = new SessionApi(sessionId);
      const summary = await api.summary();
      // Through the session; an older server has only the open route.
      const card = await api.card().catch(() => levelCard(summary.level_id));
      await this.enter(api, card, await api.scene());
      await this.identify(api, playerFromLink);
      this.renderTop();
      if (summary.job !== null && summary.phase !== 'loading') {
        this.wash = {
          job_id: summary.job.job_id,
          status: summary.job.status,
          progress: summary.job.progress,
          since: performance.now(),
        };
        void this.pollReport();
      }
      return true;
    } catch {
      return false;
    }
  }

  private async newSession(levelId: string): Promise<void> {
    this.closeModal();
    try {
      const created = await createSession(levelId);
      await this.enter(new SessionApi(created.session_id), created.level, created.scene);
      history.replaceState(null, '', `#${created.session_id}`);
    } catch (error) {
      this.showModal(
        'Could not start the level',
        [h('p', null, messageOf(error))],
        [h('button', { onclick: () => this.showLevelPicker() }, 'Back')],
      );
    }
  }

  private async enter(api: SessionApi, card: LevelCard, scene: SceneView): Promise<void> {
    this.socket?.close();
    this.queue.flush();
    this.api = api;
    this.card = card;
    this.view = null;
    this.held = null;
    this.selected = null;
    this.feedback = null;
    this.check = null;
    this.wash = null;
    this.report = null;
    this.reportPainted = false;
    this.residue.clear();
    this.closeInspector();
    this.queriesSpent = 0;
    this.records.clear();
    for (const record of card.items) this.records.set(record.item_id, record);
    // The scene is emptied below: every item is declared again from the geometry.
    this.itemTypes.clear();
    this.thumbnails.clear();
    this.itemPictures.clear();
    this.stancePictures.clear();
    this.edgeBoxes.clear();
    this.basketPlans.clear();
    this.lastPut = null;
    this.suggestions = null;
    this.player = null;
    this.frame = card.machine.racks.some((r) => r.rack === 'lower_rack')
      ? 'lower_rack'
      : (card.machine.racks[0]?.rack ?? 'tub');
    this.stage.scene.clearItems();
    await this.loadGeometry();
    this.applyScene(scene);
    this.stage.setView('iso_lower', this.subject());
    this.updateMarks();
    this.connect();
    this.renderAll();
    // Thumbnails are drawn after the first picture of the machine is up.
    window.setTimeout(() => this.drawThumbnails(), 30);
  }

  private connect(): void {
    const api = this.api;
    if (api === null) return;
    const socket = api.connect(
      (message) => this.onMessage(message),
      () => {
        if (this.socket !== socket) return;
        this.socket = null;
        // The server may have restarted or set the session aside: try again shortly.
        window.setTimeout(() => {
          if (this.api === api && this.socket === null) this.connect();
        }, 1500);
      },
    );
    this.socket = socket;
  }

  private socketOpen(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private async loadGeometry(): Promise<void> {
    if (this.api === null || this.card === null) return;
    const geometry = await this.api.geometry();
    this.geometry = geometry;
    this.basketPlans.clear();
    const scene = this.stage.scene;
    scene.setMachine(geometry.machine.parts);
    scene.addItemTypes(Object.values(geometry.item_types));
    if (this.itemTypes.size === 0 || !this.itemTypesMatch(geometry)) {
      this.itemTypes.clear();
      this.thumbnails.clear();
      for (const { item_id, item_type } of geometry.items) {
        this.itemTypes.set(item_id, item_type);
        scene.setItem(item_id, item_type, this.soilLayers(item_id));
      }
    }
  }

  private itemTypesMatch(geometry: GeometryPayload): boolean {
    return (
      geometry.items.length === this.itemTypes.size &&
      geometry.items.every((item) => this.itemTypes.get(item.item_id) === item.item_type)
    );
  }

  private soilLayers(itemId: string): RegionLayers {
    return soilLayersByRegion(this.records.get(itemId)?.soils ?? []);
  }

  private drawThumbnails(): void {
    for (const [itemId, itemType] of this.itemTypes) {
      if (this.thumbnails.has(itemId)) continue;
      try {
        this.thumbnails.set(
          itemId,
          this.stage.thumbnails.render(itemType, this.soilLayers(itemId)),
        );
      } catch {
        // A picture that cannot be drawn is left out; the tray still lists the item.
      }
    }
    this.renderTray();
  }

  // -------------------------------------------------------------------------------------------
  // What the server says
  // -------------------------------------------------------------------------------------------

  private onMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'hello':
        break;
      case 'animation':
        this.queue.enqueueFrames(message.frames);
        break;
      case 'state':
        this.queue.enqueueFinal(message.scene);
        break;
      case 'wash':
        if (this.wash !== null && this.wash.job_id === message.job_id) {
          this.wash.status = message.status;
          this.wash.progress = message.progress;
          if (message.error !== undefined) this.wash.error = message.error;
          if (message.status === 'done' || message.status === 'failed') void this.pollReport();
          this.renderWash();
        }
        break;
      case 'error':
        this.setFeedback('Connection', [
          { level: 'bad', text: `The server closed the connection (${message.reason}).` },
        ]);
        break;
      case 'pong':
        break;
    }
  }

  /** Makes a scene the current one: poses, state, and the geometry if the machine changed. */
  private applyScene(view: SceneView): void {
    const previousHash = this.view?.state.state_hash;
    this.view = view;
    this.queriesSpent = 0;
    this.shownParts = { ...view.poses.parts };
    this.stage.scene.setPartPoses(view.poses.parts);
    this.stage.scene.setItemPoses(view.poses.items);
    if (this.geometry !== null && this.geometry.geometry_key !== view.geometry_key) {
      void this.loadGeometry().then(() => {
        if (this.view !== null) this.stage.scene.setPartPoses(this.view.poses.parts);
        this.updateGhost();
      });
    }
    if (previousHash !== view.state.state_hash) {
      // A verdict on a pose holds only for the scene it was given for.
      if (this.held !== null) {
        this.held.preview = null;
        this.held.previewKey = null;
        this.held.rejectedTint = null;
      }
      this.schedulePreview();
    }
    if (this.held !== null && view.state.placed.some((p) => p.item_id === this.held?.itemId)) {
      this.held = null;
    }
    if (this.selected !== null && !view.state.placed.some((p) => p.item_id === this.selected)) {
      this.selected = null;
    }
    if (view.state.phase === 'loading' && this.wash !== null && this.wash.status !== 'failed') {
      this.wash = null;
    }
    this.updateGhost();
    this.renderAll();
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    for (const played of this.queue.advance(dt)) {
      if (played.kind === 'final') {
        this.applyScene(played.value);
      } else {
        this.stage.scene.setPartPoses(played.frame.parts);
        this.stage.scene.moveItems(played.frame.items);
        Object.assign(this.shownParts, played.frame.parts);
        if (this.held !== null) this.updateGhost();
      }
    }
    this.stage.render();
  }

  private get state(): SceneState | null {
    return this.view?.state ?? null;
  }

  private loading(): boolean {
    return this.state?.phase === 'loading';
  }

  // -------------------------------------------------------------------------------------------
  // Frames and views
  // -------------------------------------------------------------------------------------------

  private framePose(frame: FrameId): DrawPose {
    return frame === 'tub' ? IDENTITY : (this.shownParts[frame] ?? IDENTITY);
  }

  private rackCard(frame: FrameId): RackCard | undefined {
    return this.card?.machine.racks.find((r) => r.rack === frame);
  }

  private envelope(frame: FrameId): readonly [number, number, number] {
    const rack = this.rackCard(frame);
    if (rack !== undefined) return rack.envelope_mm;
    const machine = this.card?.machine;
    if (machine === undefined) return [500, 500, 300];
    return [
      machine.tub_max_mm[0] - machine.tub_min_mm[0],
      machine.tub_max_mm[1] - machine.tub_min_mm[1],
      machine.tub_max_mm[2] - machine.tub_min_mm[2],
    ];
  }

  /** Height of the top of a basket's wires above its frame origin, millimetres. */
  private rackTop(frame: FrameId): number {
    const part = this.geometry?.machine.parts.find((p) => p.id === frame);
    if (part === undefined) return 300;
    return boundingBox(part.shape).max[2] * 1000;
  }

  private frames(): FrameId[] {
    return [...(this.card?.machine.racks.map((r) => r.rack) ?? []), 'tub'];
  }

  private subject(): ViewSubject {
    const machine = (this.card as LevelCard).machine;
    return {
      tub_min_mm: machine.tub_min_mm,
      tub_max_mm: machine.tub_max_mm,
      racks: machine.racks.map((rack) => ({
        rack: rack.rack,
        origin_mm: this.framePose(rack.rack).position_mm,
        envelope_mm: rack.envelope_mm,
      })),
    };
  }

  private setView(view: StageView): void {
    if (this.card === null) return;
    this.stage.setView(view, this.subject());
    this.renderTop();
  }

  /**
   * Tells the stage what to draw over the picture: item ids and the millimetre grid, as the
   * `render` query draws them for an agent, when their switches are on.
   */
  private updateMarks(): void {
    if (!this.showLabels && !this.showGrid && this.suggestions === null) {
      this.stage.setMarks(null);
      return;
    }
    this.stage.setMarks((project, width, height, clip) => {
      const card = this.card;
      const geometry = this.geometry;
      const view = this.view;
      if (card === null || geometry === null || view === null)
        return { lines: [], dots: [], texts: [] };
      const marks: OverlayMarks =
        this.showLabels || this.showGrid
          ? viewMarks({
              ...marksInput(card, geometry, view, this.shownParts),
              view: this.stage.view,
              width,
              height,
              project,
              grid: this.showGrid,
              labels: this.showLabels,
              clip_above_mm: clip.above,
              clip_below_mm: clip.below,
            })
          : { lines: [], dots: [], texts: [] };
      const spots = this.spotMarks(project);
      return {
        lines: marks.lines,
        dots: [...marks.dots, ...spots.dots],
        texts: [...marks.texts, ...spots.texts],
      };
    });
  }

  /**
   * The suggested spots for the piece in hand as marks in the machine: a numbered dot where
   * each is, green where the piece would stand in the gap, amber where it would only stand on
   * the tine tips, grey where the spot is not free now. A click on a mark puts the piece there.
   */
  private spotMarks(
    project: (point: readonly [number, number, number]) => readonly [number, number] | null,
  ): Pick<OverlayMarks, 'dots' | 'texts'> {
    const shown = this.shownSpots();
    const dots: OverlayMarks['dots'][number][] = [];
    const texts: OverlayMarks['texts'][number][] = [];
    if (shown === null) return { dots, texts };
    const frame = this.framePose(shown.frame);
    const marked = this.markedSpots();
    shown.places.forEach((place, index) => {
      if (!marked.has(index)) return;
      const at = project(pointFromFrame(frame, place.position_mm));
      if (at === null) return;
      const over = this.held?.spot === index;
      const colour = !place.free ? '#8a8f98' : place.seats ? '#1f9d55' : '#c77700';
      dots.push({ x: at[0], y: at[1], r: over ? 11 : 8, colour });
      texts.push({
        x: at[0],
        y: at[1],
        text: String(index + 1),
        size: 10,
        colour: '#ffffff',
        align: 'center',
        baseline: 'middle',
        bold: true,
      });
    });
    return { dots, texts };
  }

  /** The four pictures of an item, drawn once. */
  private picturesOf(itemId: string): string[] {
    const known = this.itemPictures.get(itemId);
    if (known !== undefined) return known;
    const itemType = this.itemTypes.get(itemId);
    let pictures: string[] = [];
    if (itemType !== undefined) {
      try {
        pictures = this.stage.itemPictures(
          itemType,
          this.soilLayers(itemId),
          this.records.get(itemId)?.reference_point_mm,
        );
      } catch {
        // Pictures that cannot be drawn are left out; the item can still be placed.
        pictures = [];
      }
    }
    this.itemPictures.set(itemId, pictures);
    return pictures;
  }

  // -------------------------------------------------------------------------------------------
  // The item in hand
  // -------------------------------------------------------------------------------------------

  /** The stances of an item, the one it is picked up in first. */
  private stances(itemId: string): Stance[] {
    const record = this.records.get(itemId);
    return record === undefined ? [] : stancesOf(record.orientation_presets, record.bbox_mm);
  }

  /**
   * Takes a piece in hand. From the counter it comes in its first stance and follows the
   * cursor. With `at` it is held at that pose: as it stood in the machine (`origin`, which is
   * where Escape puts it back), still following the cursor from where it was grabbed, or, with
   * `exact`, fixed at exactly that pose for a level that allows exact placement.
   */
  private pickUp(
    itemId: string,
    options: { at?: GhostPose; origin?: PlacedPose; exact?: boolean } = {},
  ): void {
    const record = this.records.get(itemId);
    if (record === undefined || !this.loading()) return;
    this.selected = null;
    const { at, origin = null, exact = false } = options;
    const preset =
      this.stances(itemId)[0]?.preset ?? record.orientation_presets[0]?.name ?? 'upright';
    if (at === undefined) this.frame = this.defaultFrame();
    const envelope = this.envelope(this.frame);
    const ghost: GhostPose = at ?? {
      frame: this.frame,
      position_mm: [Math.round(envelope[0] / 2), Math.round(envelope[1] / 2), 0],
      preset,
      yaw_deg: 0,
      pitch_deg: 0,
      roll_deg: 0,
    };
    this.frame = ghost.frame;
    const held: Held = {
      itemId,
      ghost,
      autoHeight: !exact,
      preview: null,
      previewKey: null,
      rejectedTint: null,
      exact,
      freeYaw: 0,
      flip: false,
      restZ: origin === null ? null : origin.position_mm[2],
      reaims: 0,
      aimLow: null,
      aimHigh: null,
      tries: [],
      fromFloor: false,
      lastRefused: false,
      aimSettled: false,
      clickQueued: false,
      aimedAt: null,
      restart: false,
      grab: [0, 0],
      origin,
      snapped: null,
      roofDrop: 0,
      spot: null,
    };
    this.held = held;
    if (!exact) this.applyAutoHeight();
    const cursor = this.cursor;
    if (!exact && cursor !== null) {
      if (origin !== null) {
        // Held where it was grabbed: the piece does not jump to put its middle under the cursor.
        const ray = this.stage.ray(cursor.x, cursor.y);
        const aimed = aimPoint(this.aimTarget(held, ghost.frame), ray.origin_mm, ray.direction);
        const grab: [number, number] =
          aimed === null
            ? [0, 0]
            : [ghost.position_mm[0] - aimed[0], ghost.position_mm[1] - aimed[1]];
        if (Math.hypot(grab[0], grab[1]) < 250) held.grab = grab;
      } else {
        this.ghostToMouse(cursor.x, cursor.y);
      }
    }
    this.ghostChanged();
    this.renderAll();
  }

  /**
   * The frame a newly picked-up item starts in: the basket the current view shows if it is
   * pulled out, else the frame used last if that can be loaded, else a basket that is out.
   */
  private defaultFrame(): FrameId {
    const frames = this.frames();
    const loadable = (frame: FrameId): boolean =>
      frames.includes(frame) && (frame === 'tub' || this.rackIsOut(frame));
    const view = this.stage.view;
    const shown: FrameId | null = view.includes('cutlery')
      ? 'cutlery_basket'
      : view.includes('upper')
        ? 'upper_rack'
        : view.includes('lower')
          ? 'lower_rack'
          : null;
    if (shown !== null && loadable(shown)) return shown;
    if (loadable(this.frame) && this.frame !== 'tub') return this.frame;
    for (const frame of ['lower_rack', 'upper_rack'] as const) if (loadable(frame)) return frame;
    return this.frame;
  }

  /**
   * The highest the top of an item may be at a place of a basket frame, in that frame: under
   * the upper basket or the roof of the tub where the item would reach in under them (the rear
   * of a pulled-out basket stays inside the machine), unlimited elsewhere.
   */
  private ceilingMm(frame: FrameId, yMm: number, reachYMm: number): number {
    const machine = this.card?.machine;
    if (machine === undefined || frame === 'tub') return Infinity;
    const origin = this.framePose(frame).position_mm;
    // The frames of the baskets are parallel to the tub frame.
    const rearInTub = origin[1] + yMm + reachYMm;
    if (rearInTub < machine.tub_min_mm[1]) return Infinity;
    let ceiling = machine.tub_max_mm[2];
    const upper = this.shownParts['upper_rack'];
    const carrier = frame === 'cutlery_basket' ? 'lower_rack' : frame;
    if (carrier === 'lower_rack' && upper !== undefined) {
      ceiling = Math.min(ceiling, upper.position_mm[2] - 30);
    }
    return ceiling - origin[2];
  }

  /** Returns the piece in hand to the counter (it is not in the machine while it is held). */
  private putBack(): void {
    this.held = null;
    this.updateGhost();
    this.renderAll();
  }

  /**
   * Puts a piece that was picked up in the machine back where it stood: as it stood, lifted
   * by as little as leaves the pose free, and let go. A refused `place` costs nothing, so the
   * lifts are simply tried in turn.
   */
  private async putBackWhereItWas(): Promise<void> {
    const held = this.held;
    const api = this.api;
    if (held === null || held.origin === null || api === null || this.pending > 0) return;
    const origin = held.origin;
    const [x, y, z] = origin.position_mm;
    for (const lift of [1, 3, 8, 20, 60]) {
      const ghost: GhostPose = {
        frame: origin.frame,
        position_mm: [Math.round(x), Math.round(y), Math.ceil(z) + lift],
        preset: held.ghost.preset,
        yaw_deg: 0,
        pitch_deg: 0,
        roll_deg: 0,
        quat_wxyz: origin.quat_wxyz,
      };
      const result = await this.act(() => api.place(placeRequest(held.itemId, ghost)));
      if (result === null) return;
      if (!result.accepted) continue;
      this.setFeedback(`Put ${held.itemId} back where it was`, describeDrop(result));
      if (this.held === held) this.held = null;
      this.selected = result.returned.includes(held.itemId) ? null : held.itemId;
      this.check = null;
      this.updateGhost();
      this.renderAll();
      return;
    }
    this.setFeedback(`Could not put ${held.itemId} back`, [
      {
        level: 'warn',
        text: 'Something has moved into the place it stood in. It is still in your hand: put it down somewhere, or press Backspace for the counter.',
      },
    ]);
  }

  /**
   * The height in a frame above which nothing of the basket itself reaches: the top of its
   * wires, and the carrying handle of the cutlery basket where that stands in it (the handle
   * stands above the wires of the lower basket). A piece is carried above this and comes
   * straight down from there, so that it is never held inside the basket it is carried over.
   * What is already loaded is not counted: the game says so when a piece is held inside it.
   */
  private clearTop(frame: FrameId): number {
    const top = this.rackTop(frame);
    const cutlery = this.geometry?.machine.affordances.cutleryBasket ?? null;
    if (cutlery === null || cutlery.frame !== frame) return top;
    return Math.max(top, cutlery.box.max[2] * 1000);
  }

  private applyAutoHeight(): void {
    const held = this.held;
    if (held === null || !held.autoHeight) return;
    const record = this.records.get(held.itemId) as ItemRecord;
    const q = ghostQuat(held.ghost, record.orientation_presets);
    if (q === null) return;
    const [x, y] = held.ghost.position_mm;
    const frame = held.ghost.frame;
    const wanted = holdHeightMm(this.clearTop(frame), record.bbox_mm, q);
    const ceiling = this.ceilingMm(frame, y, reachAlongMm(record.bbox_mm, q, 1));
    // Lower by what the game has said of the roof, whether or not the page itself counted the
    // place as under it (at the mouth of the tub the page's reckoning and the game's differ).
    const z =
      (Number.isFinite(ceiling)
        ? heightUnderMm(wanted, ceiling, record.bbox_mm, q, undefined, this.reachAbove(held, q))
        : wanted) - held.roofDrop;
    held.ghost = { ...held.ghost, position_mm: [x, y, z] };
  }

  /**
   * How far the piece in hand reaches above its reference point at an orientation, millimetres,
   * from its shape; undefined when the page was not given the shape (half the bounding box is
   * then taken).
   */
  private reachAbove(held: Held, q: Quat): number | undefined {
    const itemType = this.itemTypes.get(held.itemId);
    const shape = itemType === undefined ? undefined : this.geometry?.item_types[itemType]?.shape;
    const record = this.records.get(held.itemId);
    if (shape === undefined || record === undefined) return undefined;
    const top = boundingBox(shape, { p: [0, 0, 0], q }).max[2] * 1000;
    return top - quatRotate(q, record.reference_point_mm as unknown as Vec3)[2];
  }

  /** Changes the pose of the ghost. `patch` holds the fields that change. */
  private setGhost(patch: Partial<GhostPose>, options: { keepHeight?: boolean } = {}): void {
    const held = this.held;
    if (held === null) return;
    if (patch.frame !== undefined && patch.frame !== held.ghost.frame) {
      this.frame = patch.frame;
      // What is known of the landing height holds for the basket it was asked in.
      held.restZ = null;
      if (patch.position_mm === undefined) {
        const envelope = this.envelope(patch.frame);
        held.autoHeight = true;
        patch = {
          ...patch,
          position_mm: [Math.round(envelope[0] / 2), Math.round(envelope[1] / 2), 0],
        };
      }
    }
    // Turning the item by preset or by angle leaves a typed quaternion behind.
    const turned =
      patch.preset !== undefined ||
      patch.yaw_deg !== undefined ||
      patch.pitch_deg !== undefined ||
      patch.roll_deg !== undefined;
    const { quat_wxyz: quat, ...rest } = { ...held.ghost, ...patch };
    held.ghost = quantiseGhost(
      quat === undefined || (turned && patch.quat_wxyz === undefined)
        ? rest
        : { ...rest, quat_wxyz: quat },
    );
    if (options.keepHeight !== true) this.applyAutoHeight();
    this.ghostChanged();
  }

  private ghostChanged(): void {
    const held = this.held;
    if (held === null) return;
    held.rejectedTint = null;
    this.updateGhost();
    this.syncPoseFields();
    this.schedulePreview();
  }

  private ghostKey(held: Held): string {
    return JSON.stringify([held.itemId, held.ghost, this.state?.state_hash]);
  }

  private ghostTint(held: Held): GhostTint {
    if (held.rejectedTint !== null) return held.rejectedTint;
    const preview = held.previewKey === this.ghostKey(held) ? held.preview : null;
    if (preview === null || !preview.accepted) return 'unknown';
    if (!preview.in_bounds) return 'unreachable';
    if (!preview.collision_free) return 'collision';
    if (this.mode === 'set') return 'clear';
    if (this.mode === 'drop' && !preview.insertable) return 'unreachable';
    const landing = this.landing(held, preview);
    if (landing !== null && refused(landing.verdict)) return 'unreachable';
    if (landing !== null && landing.verdict !== 'seated') return 'perched';
    if (this.perched(held, preview)) return 'perched';
    return 'clear';
  }

  /**
   * The cells of the cutlery basket in its own frame, millimetres: the height of their floor
   * (the lowest point of the basket as it is drawn) and of their rim (as far above that floor
   * as the machine's data put the rim above the foot of the basket). Null when the machine has
   * no cutlery basket or the page was not given it.
   */
  private cutleryCells(): { readonly floorZ: number; readonly rimZ: number } | null {
    const cutlery = this.geometry?.machine.affordances.cutleryBasket ?? null;
    const part = this.geometry?.machine.parts.find((p) => p.id === 'cutlery_basket');
    if (cutlery === null || part === undefined) return null;
    const floorZ = boundingBox(part.shape).min[2] * 1000;
    return { floorZ, rimZ: floorZ + (cutlery.rimZ - cutlery.box.min[2]) * 1000 };
  }

  /** The basket of a frame as the page knows it for judging where a piece is let go. */
  private basketPlan(frame: FrameId): BasketPlan | null {
    const known = this.basketPlans.get(frame);
    if (known !== undefined) return known;
    const affordances = this.geometry?.machine.affordances;
    const basket = affordances?.baskets.find((b) => b.frame === frame);
    if (affordances === undefined || basket === undefined) return null;
    const mm = (v: readonly number[]): [number, number, number] => [
      (v[0] as number) * 1000,
      (v[1] as number) * 1000,
      (v[2] as number) * 1000,
    ];
    const cutlery = affordances.cutleryBasket;
    const plan: BasketPlan = {
      interior: { min: mm(basket.interior.min), max: mm(basket.interior.max) },
      rimTop: {
        front: basket.rimTopZ.front * 1000,
        rear: basket.rimTopZ.rear * 1000,
        left: basket.rimTopZ.left * 1000,
        right: basket.rimTopZ.right * 1000,
      },
      cutlery:
        cutlery !== null && cutlery.frame === frame
          ? {
              box: { min: mm(cutlery.box.min), max: mm(cutlery.box.max) },
              rimZ: cutlery.rimZ * 1000,
            }
          : null,
      shelves: affordances.cupShelves
        .filter((shelf) => shelf.basketId === basket.basketId && shelf.surface !== null)
        .map((shelf) => {
          const surface = shelf.surface as NonNullable<typeof shelf.surface>;
          return {
            x: [surface.x[0] * 1000, surface.x[1] * 1000] as const,
            y: [surface.y[0] * 1000, surface.y[1] * 1000] as const,
            z: surface.z * 1000,
          };
        }),
    };
    this.basketPlans.set(frame, plan);
    return plan;
  }

  /**
   * Where the piece in hand would be let go, judged from the free preview's lowered pose and
   * the geometry of the basket: on its floor, perched above it, on the cutlery basket, on the
   * rim; for a piece sent to the cutlery basket, down in a cell or above the cells on what lies
   * over them. Null where the page does not judge (a typed pose, a suggested spot, an insert,
   * the tub).
   */
  private landing(held: Held, preview: PreviewResult): Landing | null {
    if (held.exact || held.spot !== null || this.mode !== 'drop') return null;
    if (!preview.accepted || preview.lowered_pose === null) return null;
    const frame = held.ghost.frame;
    if (frame === 'tub') return null;
    const record = this.records.get(held.itemId);
    const q = record === undefined ? null : ghostQuat(held.ghost, record.orientation_presets);
    if (record === undefined || q === null) return null;
    if (frame === 'cutlery_basket') {
      const cells = this.cutleryCells();
      if (cells === null) return null;
      return judgeCellLanding(
        cells.rimZ,
        cells.floorZ,
        preview.lowered_pose.position_mm[2] - reachBelowMm(record.bbox_mm, q),
      );
    }
    const plan = this.basketPlan(frame);
    if (plan === null) return null;
    const [x, y, z] = preview.lowered_pose.position_mm;
    const judged = judgeLanding(plan, {
      x,
      y,
      bottomZ: z - reachBelowMm(record.bbox_mm, q),
      reachX: reachAlongMm(record.bbox_mm, q, 0),
      reachY: reachAlongMm(record.bbox_mm, q, 1),
    });
    // A piece on edge that has taken up a row is let go on the tines and comes down between
    // them: that is the row working, not a perch.
    // Unless it reaches over the cutlery basket there: then it may end standing on that.
    if (held.snapped !== null && judged.verdict === 'perched') {
      return { ...judged, verdict: judged.over_cutlery ? 'on_cutlery_basket' : 'seated' };
    }
    return judged;
  }

  /** Redraws the ghost, the outline of where it would be let go, and the insert arrow. */
  private updateGhost(): void {
    const scene = this.stage.scene;
    const held = this.held;
    if (held === null) {
      scene.setGhost(null);
      scene.setLanding(null);
      scene.setArrow(null);
      scene.setHighlights(this.selected === null ? [] : [this.selected]);
      return;
    }
    const record = this.records.get(held.itemId) as ItemRecord;
    const itemType = this.itemTypes.get(held.itemId) as string;
    const frame = this.framePose(held.ghost.frame);
    const pose = ghostDrawPose(
      frame,
      held.ghost,
      record.orientation_presets,
      record.reference_point_mm,
    );
    if (pose === null) {
      scene.setGhost(null);
      return;
    }
    scene.setHighlights([]);
    const preview = held.previewKey === this.ghostKey(held) ? held.preview : null;
    const lowered = preview !== null && preview.accepted ? preview.lowered_pose : null;
    if (held.exact || this.mode !== 'drop' || held.spot !== null) {
      // A typed pose, an insert and a suggested spot are drawn as they are asked for, with
      // the outline of where a drop from there would be let go.
      scene.setGhost({ itemType, pose, tint: this.ghostTint(held) });
      scene.setLanding(
        lowered === null || this.mode !== 'drop' || held.spot !== null
          ? null
          : { itemType, pose: wirePoseDrawPose(frame, lowered, record.reference_point_mm) },
      );
    } else {
      // In the hand the piece is drawn where it would be let go: where the server's preview
      // says it touches down, and until that has answered at the height last known.
      const [x, y] = held.ghost.position_mm;
      const resting =
        lowered !== null
          ? wirePoseDrawPose(frame, lowered, record.reference_point_mm)
          : (ghostDrawPose(
              frame,
              { ...held.ghost, position_mm: [x, y, this.restHeight(held, held.ghost.frame)] },
              record.orientation_presets,
              record.reference_point_mm,
            ) ?? pose);
      scene.setGhost({ itemType, pose: resting, tint: this.ghostTint(held) });
      scene.setLanding(null);
    }
    const dragDir = this.insertDrag?.dir ?? null;
    if (this.mode === 'insert' || dragDir !== null) {
      const dir = (
        INSERT_DIRECTIONS[dragDir ?? this.insertDir] as (typeof INSERT_DIRECTIONS)[number]
      ).dir;
      const [x, y, z] = held.ghost.position_mm;
      const back = 180;
      scene.setArrow({
        from_mm: pointFromFrame(frame, [x - dir[0] * back, y - dir[1] * back, z - dir[2] * back]),
        to_mm: pointFromFrame(frame, [x, y, z]),
      });
    } else {
      scene.setArrow(null);
    }
  }

  private schedulePreview(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    this.previewTimer = null;
    if (this.held === null || !this.loading()) return;
    this.previewTimer = window.setTimeout(() => void this.previewNow(), PREVIEW_DELAY_MS);
  }

  /** Asks the server about the pose of the ghost (a preview is logged but costs no query). */
  private async previewNow(): Promise<void> {
    const held = this.held;
    const api = this.api;
    if (held === null || api === null || !this.loading()) return;
    const key = this.ghostKey(held);
    if (held.previewKey === key && held.preview !== null) return;
    try {
      const result = await api.preview(previewRequest(held.itemId, held.ghost));
      if (this.held !== held) return;
      if (this.ghostKey(held) !== key) return;
      if (
        result.accepted &&
        !result.collision_free &&
        held.autoHeight &&
        !held.exact &&
        held.roofDrop < ROOF_DROP_MAX_MM &&
        result.colliding_with.length > 0 &&
        result.colliding_with.every((name) => name === 'tub.roof')
      ) {
        // Carried into the roof of the tub by a few millimetres: carried that much lower, and
        // the game is asked again. (A piece picked up in the upper basket was shown red
        // wherever it was moved to, and could not be put down.)
        held.roofDrop = Math.min(
          ROOF_DROP_MAX_MM,
          held.roofDrop + Math.ceil(result.penetration_mm) + ROOF_DROP_MARGIN_MM,
        );
        this.applyAutoHeight();
        this.ghostChanged();
        return;
      }
      held.preview = result;
      held.previewKey = key;
      this.learnLanding(held, result);
      this.updateGhost();
      this.renderHandStatus();
      if (held.clickQueued && this.handSettled(held)) {
        held.clickQueued = false;
        void this.place();
      }
    } catch {
      // A preview that did not arrive leaves the ghost untinted.
    }
  }

  /**
   * Takes in where a preview says the piece would be let go, and looks for the place under the
   * cursor. The place aimed at lies on the cursor's ray at the height aimed for; the piece
   * lands higher or lower there. The height at which the two agree is looked for along the
   * ray: above the height aimed for when the piece landed higher, below it when lower, halfway
   * once it is known from both sides (the floor of a basket is not level: over a tine the
   * piece lands on its tip, beside it on the grid).
   *
   * How near the cursor a landing is, is measured from the line of sight, so that a place the
   * basket's edge cut short does not pass for one under the cursor. A landing on the rim or on
   * the handle of the cutlery basket is not taken while another can be found: the search is
   * started once more from the floor, and of everything tried a place the piece stays in is
   * preferred. `held.aimSettled` is true when the search is over for this cursor position.
   */
  private learnLanding(held: Held, result: PreviewResult): void {
    if (held.aimSettled) return;
    if (held.exact || !result.accepted || result.lowered_pose === null) {
      held.aimSettled = true;
      return;
    }
    const frame = held.ghost.frame;
    const landed = result.lowered_pose.position_mm[2];
    const aimed = this.restHeight(held, frame);
    const cursor = this.cursor;
    if (held.spot !== null || held.snapped !== null || cursor === null) {
      held.restZ = landed;
      held.aimSettled = true;
      return;
    }
    const ray = this.stage.ray(cursor.x, cursor.y);
    const pose = this.framePose(frame);
    if (Math.abs(directionInFrame(pose, ray.direction)[2]) < 0.08) {
      // An elevation: the piece moves across the picture at its depth; there is no search.
      held.restZ = landed;
      held.aimSettled = true;
      return;
    }
    const g = held.ghost;
    const miss = missFromRay(
      pose,
      [g.position_mm[0] - held.grab[0], g.position_mm[1] - held.grab[1], landed],
      ray.origin_mm,
      ray.direction,
    );
    const verdict = this.landing(held, result);
    const bad = verdict !== null && refused(verdict.verdict);
    held.lastRefused = bad;
    held.tries.push({ aim: aimed, miss, refused: bad });
    const settle = (): void => {
      const best = bestTry(held.tries);
      held.aimSettled = true;
      if (best !== null && best.aim !== aimed) {
        held.restZ = best.aim;
        held.lastRefused = best.refused;
        this.ghostToMouse(cursor.x, cursor.y, false);
      }
    };
    const again = (): void => {
      held.reaims += 1;
      const before = this.ghostKey(held);
      this.ghostToMouse(cursor.x, cursor.y, false);
      // The same place again: nothing new will be answered.
      if (this.ghostKey(held) === before) settle();
    };
    if (miss < AIM_AGREES_MM && !bad) {
      held.aimSettled = true;
      return;
    }
    if (bad && !held.fromFloor) {
      // On the rim or the handle: look once more from the floor up, for the place behind it.
      held.fromFloor = true;
      held.aimLow = null;
      held.aimHigh = null;
      held.restZ = null;
      if (this.restHeight(held, frame) !== aimed) {
        again();
        return;
      }
    }
    if (held.reaims >= REAIMS_MAX || (bad && miss < AIM_AGREES_MM)) {
      settle();
      return;
    }
    if (landed > aimed) held.aimLow = Math.max(held.aimLow ?? -Infinity, aimed);
    else held.aimHigh = Math.min(held.aimHigh ?? Infinity, aimed);
    const next =
      held.aimLow !== null && held.aimHigh !== null && held.aimLow < held.aimHigh
        ? (held.aimLow + held.aimHigh) / 2
        : landed;
    if (Math.abs(next - aimed) < 0.5) {
      settle();
      return;
    }
    held.restZ = next;
    again();
  }

  /**
   * True when the game has answered for the place the piece in hand is shown at, and the page
   * is not still looking for the place under the cursor.
   */
  private handSettled(held: Held): boolean {
    return held.previewKey === this.ghostKey(held) && held.preview !== null && held.aimSettled;
  }

  /**
   * Puts the piece in hand down where it is shown, once that is settled: a click that comes
   * while the page is still asking where the piece would be let go waits for the answer, so
   * that the piece is never let go somewhere it was not yet shown.
   */
  private putDown(): void {
    const held = this.held;
    if (held === null) return;
    if (this.handSettled(held) || !this.loading()) {
      held.clickQueued = false;
      void this.place();
      return;
    }
    held.clickQueued = true;
    this.schedulePreview();
    this.renderHandStatus();
    // A game that does not answer must not swallow the click.
    window.setTimeout(() => {
      if (this.held === held && held.clickQueued) {
        held.clickQueued = false;
        void this.place();
      }
    }, CLICK_WAIT_MS);
  }

  /** Lets the item in hand go: `place` with the pose of the ghost. */
  private async place(mode: PlaceMode = this.mode, insertDir = this.insertDir): Promise<void> {
    const held = this.held;
    const api = this.api;
    if (held === null || api === null || this.pending > 0) return;
    const dir = (INSERT_DIRECTIONS[insertDir] as (typeof INSERT_DIRECTIONS)[number]).dir;
    if (mode === 'drop' && this.handSettled(held) && held.preview !== null) {
      // Shown on the rim, on the handle of the cutlery basket or outside: it would fall out of
      // the machine and the action would be charged. It stays in the hand.
      const landing = this.landing(held, held.preview);
      if (landing !== null && refused(landing.verdict)) {
        this.setFeedback(`${held.itemId} is still in your hand`, [
          {
            level: 'warn',
            text: landingWords(landing.verdict, landing.above_floor_mm) ?? '',
          },
          {
            level: 'info',
            text: 'Nothing was sent to the game and nothing was charged. A typed pose (Exact pose) is put down wherever you say.',
          },
        ]);
        this.renderHandStatus();
        return;
      }
    }
    let ghost = held.ghost;
    if (!held.exact && mode === 'insert' && held.spot === null) {
      // Pushed to where the piece is shown, which is where it would be let go, not to the
      // height it is carried at.
      const [x, y, z] = ghost.position_mm;
      ghost = {
        ...ghost,
        position_mm: [x, y, Math.min(z, this.restHeight(held, ghost.frame) + 2)],
      };
    }
    const request = placeRequest(held.itemId, ghost, mode, dir);
    const result = await this.act(() => api.place(request));
    if (result === null) return;
    this.setFeedback(
      result.accepted
        ? `Placed ${held.itemId}${mode === 'insert' ? ' (inserted)' : mode === 'set' ? ' (set at the exact pose)' : ''}`
        : `Could not place ${held.itemId}`,
      describeDrop(result),
    );
    if (result.accepted) {
      if (this.held === held) this.held = null;
      this.selected = result.returned.includes(held.itemId) ? null : held.itemId;
      this.lastPut = result.returned.includes(held.itemId)
        ? null
        : { itemId: held.itemId, ghost: held.ghost };
      this.check = null;
    } else if (this.held === held) {
      held.rejectedTint = result.reason === 'collision_at_pose' ? 'collision' : 'unreachable';
    }
    this.updateGhost();
    this.renderAll();
  }

  // -------------------------------------------------------------------------------------------
  // Actions on what is in the machine
  // -------------------------------------------------------------------------------------------

  /** Runs one call of the server, keeping count of calls in flight and reporting failures. */
  private async act<T>(call: () => Promise<T>): Promise<T | null> {
    this.pending += 1;
    this.renderBusy();
    try {
      const result = await call();
      // Without the socket nobody tells us what the scene looks like now: ask.
      if (!this.socketOpen() && this.api !== null) this.applyScene(await this.api.scene());
      return result;
    } catch (error) {
      this.setFeedback('Server', [{ level: 'bad', text: messageOf(error) }]);
      return null;
    } finally {
      this.pending -= 1;
      this.renderBusy();
    }
  }

  private async takeOut(itemId: string, hold: boolean): Promise<void> {
    const api = this.api;
    const placed = this.state?.placed.find((p) => p.item_id === itemId);
    if (api === null || placed === undefined || this.pending > 0) return;
    const result = await this.act(() => api.remove(itemId));
    if (result === null) return;
    if (!result.accepted) {
      this.setFeedback(`Could not take out ${itemId}`, describeRejection(result));
      return;
    }
    this.check = null;
    this.selected = null;
    this.setFeedback(
      hold ? `${itemId} is in your hand` : `Took out ${itemId}`,
      describeMoved(
        hold
          ? 'Picked up as it stood (one action). Click to put it down; Esc puts it back where it was (one more action; it settles afresh there); Backspace sends it to the counter.'
          : 'It is back on the counter.',
        result.moved_items,
        result.returned,
      ),
    );
    if (hold) {
      // Held as it stood: the same orientation (as a quaternion), following the cursor from
      // where it was. In a level that allows exact placement it is held at exactly the pose
      // it had, ready to be set there.
      const record = this.records.get(itemId) as ItemRecord;
      const exact = this.card?.rules.exact_placement === true;
      const [x, y, z] = placed.position_mm;
      if (exact) this.mode = 'set';
      this.pickUp(itemId, {
        at: {
          frame: placed.frame,
          position_mm: exact ? [x, y, z] : [Math.round(x), Math.round(y), Math.round(z) + 60],
          preset: record.orientation_presets[0]?.name ?? 'upright',
          yaw_deg: 0,
          pitch_deg: 0,
          roll_deg: 0,
          quat_wxyz: placed.quat_wxyz,
          ...(exact ? { fine: true } : {}),
        },
        exact,
        ...(exact
          ? {}
          : {
              origin: {
                frame: placed.frame,
                position_mm: placed.position_mm,
                quat_wxyz: placed.quat_wxyz,
              },
            }),
      });
    }
    this.renderAll();
  }

  /**
   * Takes the piece put down last back into the hand, held the way it was before it was let
   * go (the same stance and turn), following the cursor. It is a `remove`: one action, as a
   * click on the piece is.
   */
  private async takeBackLast(): Promise<void> {
    const last = this.lastPut;
    const api = this.api;
    if (last === null || api === null || this.pending > 0 || !this.loading()) return;
    if (this.state?.placed.some((p) => p.item_id === last.itemId) !== true) return;
    const result = await this.act(() => api.remove(last.itemId));
    if (result === null) return;
    if (!result.accepted) {
      this.setFeedback(`Could not take out ${last.itemId}`, describeRejection(result));
      return;
    }
    this.lastPut = null;
    this.check = null;
    this.selected = null;
    this.setFeedback(
      `${last.itemId} is back in your hand`,
      describeMoved(
        'Held as it was before you put it down. Click to put it down, Backspace for the counter.',
        result.moved_items,
        result.returned,
      ),
    );
    this.pickUp(last.itemId, { at: last.ghost });
    const held = this.held;
    if (held !== null) {
      held.freeYaw = last.ghost.yaw_deg;
      if (this.cursor !== null) this.ghostToMouse(this.cursor.x, this.cursor.y);
    }
    this.renderAll();
  }

  private async resetAll(): Promise<void> {
    const api = this.api;
    if (api === null || this.pending > 0) return;
    this.closeModal();
    const result = await this.act(() => api.reset());
    if (result === null) return;
    this.check = null;
    this.setFeedback(
      'Take everything out',
      result.accepted
        ? [{ level: 'ok', text: `${result.removed.length} items are back on the counter.` }]
        : describeRejection(result),
    );
  }

  private async setRack(rack: RackId, name: string, value: string): Promise<void> {
    const api = this.api;
    if (api === null || this.pending > 0) return;
    const result = await this.act(() => api.setRack({ rack, option: { name, value } }));
    if (result === null) return;
    const what = `${FRAME_LABELS[rack] ?? rack}: ${name.replaceAll('_', ' ')} set to ${value}.`;
    if (result.accepted) {
      this.check = null;
      this.setFeedback('Basket', describeMoved(what, result.moved_items, result.returned));
    } else {
      this.setFeedback('Basket', describeRejection(result));
    }
  }

  private async runCheck(): Promise<void> {
    const api = this.api;
    if (api === null || this.pending > 0 || !this.loading()) return;
    const hash = this.state?.state_hash ?? '';
    const result = await this.act(() => api.checkLoad());
    if (result === null) return;
    if (result.accepted) {
      this.queriesSpent += 1;
      this.check = { lines: describeLoadCheck(result), hash };
    } else {
      this.check = { lines: describeRejection(result), hash };
    }
    this.renderAll();
  }

  // -------------------------------------------------------------------------------------------
  // The cycle and the report
  // -------------------------------------------------------------------------------------------

  /** Asks the server which washes are on offer for the load, then asks the player. */
  private async confirmStart(): Promise<void> {
    const api = this.api;
    if (api === null || this.state === null || this.card === null) return;
    let choice: WashChoice | null = null;
    try {
      choice = await api.washOptions();
    } catch {
      // An older server offers no choice: the wash is whatever it runs.
      choice = null;
    }
    if (this.api !== api) return;
    this.washChoice = choice;
    this.showStartDialog();
  }

  /**
   * The dialog before the wash: what is loaded, and which wash. A server in open mode lets the
   * player choose between a quick preview and the full wash; in benchmark mode the wash is the
   * server's and the dialog says which.
   */
  private showStartDialog(): void {
    const state = this.state;
    const card = this.card;
    if (state === null || card === null) return;
    const loaded = state.placed.filter((p) => p.location !== 'outside');
    const outside = state.placed.filter((p) => p.location === 'outside');
    const loadedPoints = loaded.reduce(
      (sum, p) => sum + (this.records.get(p.item_id)?.points ?? 0),
      0,
    );
    const totalPoints = card.items.reduce((sum, item) => sum + item.points, 0);
    const unstableIds = loaded.filter((p) => !p.stable).map((p) => p.item_id);
    const unstable = unstableIds.length;
    const choice = this.washChoice;
    const canChoose = choice !== null && choice.choice;
    if (choice !== null) this.washTier = canChoose ? (this.washTier ?? choice.tier) : choice.tier;
    const timeOf = (tier: WashTier): string => {
      const option = choice?.options.find((o) => o.tier === tier);
      return option === undefined ? '' : washTimeText(option);
    };
    const WASHES: { readonly [tier in WashTier]: { name: string; what: string } } = {
      fast: {
        name: 'Quick preview',
        what: 'Coarser: a few verdicts may come out differently from the full wash. It is not the scored result; afterwards you can run the full wash on the same load.',
      },
      official: {
        name: 'Full wash',
        what: 'The scored result.',
      },
    };
    const startLabel = (): string =>
      this.washTier === 'fast' ? 'Start the preview' : 'Start the wash';
    const start = h(
      'button',
      { id: 'confirm-start', class: 'primary', onclick: () => void this.startCycle() },
      startLabel(),
    );
    const chooser =
      choice === null
        ? null
        : canChoose
          ? h(
              'fieldset',
              { id: 'wash-choice', class: 'wash-choice' },
              h('legend', null, 'Which wash?'),
              (['fast', 'official'] as const).map((tier) =>
                h(
                  'label',
                  { class: 'wash-option', 'data-tier': tier },
                  h('input', {
                    type: 'radio',
                    name: 'wash-tier',
                    value: tier,
                    checked: tier === this.washTier,
                    onchange: () => {
                      this.washTier = tier;
                      start.textContent = startLabel();
                    },
                  }),
                  h('strong', null, ` ${WASHES[tier].name}`),
                  timeOf(tier) === '' ? '' : `, ${timeOf(tier)}`,
                  h('div', { class: 'muted' }, WASHES[tier].what),
                ),
              ),
            )
          : h(
              'p',
              { id: 'wash-fixed' },
              h('strong', null, WASHES[choice.tier].name),
              timeOf(choice.tier) === '' ? '. ' : `, ${timeOf(choice.tier)}. `,
              choice.tier === 'official'
                ? 'The scored result.'
                : 'This server runs previews: coarser than the full wash, and not a scored result.',
            );
    this.showModal(
      `Start ${card.programme.display_name}?`,
      [
        h(
          'p',
          { id: 'start-summary' },
          `${loaded.length} of ${card.items.length} items are in the machine, worth ${loadedPoints} of ${totalPoints} points if they all come out clean.`,
        ),
        outside.length > 0
          ? h(
              'p',
              { id: 'start-outside', class: 'line bad' },
              `${listOf(outside.map((p) => p.item_id))} ${outside.length === 1 ? 'lies' : 'lie'} on the door, not in a basket: ` +
                `${outside.length === 1 ? 'it' : 'they'} will be left out of the wash.`,
            )
          : null,
        unstable > 0
          ? h(
              'p',
              { id: 'start-unstable', class: 'line warn' },
              (unstable === 1 ? '1 of them is not stable' : `${unstable} of them are not stable`) +
                ` (${listOf(unstableIds.slice(0, 6))}${unstable > 6 ? ' and others' : ''}).`,
            )
          : null,
        chooser,
        h(
          'p',
          null,
          'The baskets are pushed in, the door is closed and the load is washed as it then stands. The load cannot be changed afterwards.',
        ),
      ],
      [h('button', { id: 'cancel-start', onclick: () => this.closeModal() }, 'Not yet'), start],
    );
  }

  /** What a wash at a tier is called on the page. */
  private washName(tier: WashTier | null): string {
    return tier === 'fast' ? 'a quick preview' : tier === 'official' ? 'the full wash' : 'the wash';
  }

  private async startCycle(): Promise<void> {
    const api = this.api;
    if (api === null || this.pending > 0) return;
    this.closeModal();
    this.held = null;
    this.updateGhost();
    const choice = this.washChoice;
    const tier = choice !== null && choice.choice ? this.washTier : null;
    const result = await this.act(() => api.startCycle(tier ?? undefined));
    if (result === null) return;
    if (!result.accepted) {
      this.setFeedback('The cycle did not start', describeRejection(result));
      return;
    }
    this.check = { lines: describeLoadCheck(result.prechecks), hash: result.state_hash };
    this.setFeedback('Cycle started', [
      {
        level: 'info',
        text: `${result.load.items.length} items are being washed on ${this.card?.programme.display_name ?? 'the programme'}: ${this.washName(tier ?? choice?.tier ?? null)}.`,
      },
      ...(result.left_out.length === 0
        ? []
        : [
            {
              level: 'bad' as const,
              text: `Left out, because not in a basket or the tub when the door closed: ${listOf(result.left_out)}.`,
            },
          ]),
    ]);
    this.wash = { job_id: result.job_id, status: 'queued', progress: 0, since: performance.now() };
    this.renderAll();
    void this.pollReport();
  }

  /** True while the full wash of a previewed load is being set up. */
  private rewashing = false;

  /**
   * Runs the full wash on the load of a preview: the server sets the same load up again in a
   * new game of the level (the same moves, replayed) and starts its cycle as the full wash;
   * the page then moves to that game. The preview stays as it was under its own address.
   */
  private async runFullWash(): Promise<void> {
    const api = this.api;
    if (api === null || this.rewashing) return;
    this.rewashing = true;
    this.renderWash();
    try {
      const created = await api.rewash('official');
      if (this.api !== api) return;
      const next = new SessionApi(created.session_id);
      await this.enter(next, created.level, created.scene);
      history.replaceState(null, '', `#${created.session_id}`);
      this.setFeedback('Full wash started', [
        {
          level: 'info',
          text: 'The same load, set up again by the same moves, is being washed in full. This is the scored result.',
        },
      ]);
      const summary = await next.summary();
      if (summary.job !== null) {
        this.wash = {
          job_id: summary.job.job_id,
          status: summary.job.status,
          progress: summary.job.progress,
          since: performance.now(),
        };
        this.renderAll();
        void this.pollReport();
      }
    } catch (error) {
      this.setFeedback('The full wash did not start', [{ level: 'bad', text: messageOf(error) }]);
    } finally {
      this.rewashing = false;
      this.renderWash();
    }
  }

  private polling = false;

  /** Asks for the report until the wash has ended. */
  private async pollReport(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      for (;;) {
        const api = this.api;
        if (api === null || this.wash === null) return;
        const result = await api.getReport();
        if (this.api !== api || this.wash === null) return;
        if (!result.accepted) return;
        this.wash.status = result.status;
        if (result.status === 'running') {
          this.wash.progress = result.progress;
          if (result.stage !== undefined) {
            this.wash.stage = result.stage;
            // The estimate is as old as the server says: it is counted down from then.
            this.wash.stageAt = performance.now() - (result.stage.reported_ago_s ?? 0) * 1000;
          }
        }
        if (result.status === 'done') {
          this.wash.progress = 1;
          this.report = result.report;
          if (!this.socketOpen()) this.applyScene(await api.scene());
          // The wash just run has been timed: the offer of the full wash says how long by it.
          void api
            .washOptions()
            .then((choice) => {
              if (this.api !== api) return;
              this.washChoice = choice;
              this.renderWash();
            })
            .catch(() => undefined);
          void this.paintReport();
          this.renderAll();
          return;
        }
        if (result.status === 'failed') {
          this.wash.error = result.error;
          this.applyScene(await api.scene());
          return;
        }
        this.renderWash();
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
    } catch (error) {
      this.setFeedback('Server', [{ level: 'bad', text: messageOf(error) }]);
    } finally {
      this.polling = false;
    }
  }

  /**
   * Draws every washed item as it came out: bare, with the residue of its report painted where
   * it is, cell by cell, from the item's residue map. The maps are fetched one item at a time,
   * the items that are not clean first, and each is painted as it arrives. An item of a report
   * that comes without residue maps is painted by whole regions instead.
   */
  private async paintReport(): Promise<void> {
    const report = this.report;
    if (report === null || this.reportPainted) return;
    this.reportPainted = true;
    const washed = report.items.filter(
      (item): item is Extract<WashReport['items'][number], { loaded: true }> =>
        // An item that was not washed (left out, or not simulated) keeps the soil it had.
        item.loaded && item.simulated !== false,
    );
    for (const item of washed) {
      const itemType = this.itemTypes.get(item.item_id);
      const record = this.records.get(item.item_id);
      if (itemType === undefined || record === undefined) continue;
      this.stage.scene.setItem(
        item.item_id,
        itemType,
        item.residue_cells === undefined
          ? residueLayersByRegion(record.soils, item.residue_regions)
          : BARE,
      );
    }
    const order = [...washed].sort((a, b) => Number(a.clean) - Number(b.clean));
    for (const item of order) {
      if ((item.residue_cells ?? 0) === 0) continue;
      const cells = await this.residueCells(item.item_id);
      // The player may have left the level while the map was on its way.
      if (this.report !== report) return;
      if (cells === null) {
        const itemType = this.itemTypes.get(item.item_id);
        const record = this.records.get(item.item_id);
        if (itemType !== undefined && record !== undefined) {
          this.stage.scene.setItem(
            item.item_id,
            itemType,
            residueLayersByRegion(record.soils, item.residue_regions),
          );
        }
        continue;
      }
      this.stage.scene.setItemResidue(
        item.item_id,
        residueTiles(cells, { traces: this.showTraces }),
      );
      this.renderResidueState();
    }
  }

  /** The cells of an item's residue map, fetched once; null when the server has none. */
  private async residueCells(itemId: string): Promise<ResidueCellData | null> {
    const known = this.residue.get(itemId);
    if (known !== undefined) return known;
    const api = this.api;
    if (api === null) return null;
    let cells: ResidueCellData | null = null;
    try {
      const result = await api.residueMap(itemId);
      if (result.accepted) cells = decodeResidueMap(result.map);
    } catch {
      // A map that cannot be fetched or read is no map: the item is painted by regions.
      cells = null;
    }
    if (this.api === api) this.residue.set(itemId, cells);
    return cells;
  }

  /** Paints the residue again after a change of what is to be drawn (traces on or off). */
  private repaintResidue(): void {
    for (const [itemId, cells] of this.residue) {
      if (cells === null) continue;
      this.stage.scene.setItemResidue(itemId, residueTiles(cells, { traces: this.showTraces }));
    }
    this.renderResidueState();
  }

  /**
   * Brings the page up to date with the residue that is painted: the caption of the legend, and
   * for a script watching the page the number of items that have theirs.
   */
  private renderResidueState(): void {
    document.body.dataset['residuePainted'] = String(this.stage.scene.itemsWithResidue().length);
    // The close-up has its own legend; the report under it is redrawn when it closes.
    if (this.inspecting === null) this.renderWash();
  }

  // -------------------------------------------------------------------------------------------
  // One item, close up
  // -------------------------------------------------------------------------------------------

  /** The outline colour of residue on an item, by its material. */
  private residueOutlineOf(itemType: string): readonly [number, number, number] {
    const material = this.geometry?.item_types[itemType]?.material ?? '';
    return residueOutline(materialAppearance(material).colour);
  }

  /** Opens the close-up of a washed item: the item from all sides with its residue painted. */
  private async inspect(itemId: string): Promise<void> {
    const report = this.report;
    const card = this.card;
    const itemType = this.itemTypes.get(itemId);
    if (report === null || card === null || itemType === undefined) return;
    const row = reportView(card, report).rows.find((candidate) => candidate.item_id === itemId);
    if (row === undefined || !row.inspectable) return;
    this.selected = itemId;
    this.updateGhost();
    const cells = row.residue_cells > 0 ? await this.residueCells(itemId) : null;
    if (this.report !== report) return;
    this.inspecting = { itemId, soil: null };
    this.renderInspector(row, itemType, cells);
  }

  private renderInspector(row: ReportRow, itemType: string, cells: ResidueCellData | null): void {
    const inspecting = this.inspecting;
    if (inspecting === null) return;
    const canvas = h('canvas', { id: 'inspector-view', tabindex: '0' });
    const summary = cells === null ? null : summariseResidue(cells, inspecting.soil);
    const redraw = (): void => {
      if (this.inspecting === null) return;
      this.inspector?.show({
        itemType,
        layers: BARE,
        tiles:
          cells === null
            ? null
            : residueTiles(cells, { soil: this.inspecting.soil, traces: this.showTraces }),
        outline: this.residueOutlineOf(itemType),
      });
    };
    const sides = h(
      'div',
      { class: 'inspector-sides segmented' },
      INSPECTOR_SIDES.map((side) =>
        h(
          'button',
          {
            'data-side': side.id,
            onclick: () => {
              this.inspector?.lookFrom(side.id);
              for (const button of sides.querySelectorAll('button')) {
                button.classList.toggle('active', button.dataset['side'] === side.id);
              }
            },
            class: side.id === (this.inspector?.view ?? 'three_quarter') ? 'active' : '',
          },
          side.label,
        ),
      ),
    );
    const soils = cells?.soils ?? [];
    this.showModal(
      `${row.display_name} (${row.item_id})`,
      [
        h(
          'p',
          { id: 'inspector-verdict', class: `line ${row.status === 'clean' ? 'ok' : 'bad'}` },
          h('strong', null, row.verdict),
          ` · ${row.points_awarded} of ${row.points} points` +
            (row.score_iec === null ? '' : ` · cleaning score ${row.score_iec} of 5`),
        ),
        row.reason === null ? null : h('p', { id: 'inspector-reason' }, row.reason),
        h('div', { class: 'inspector-stage' }, canvas),
        sides,
        h(
          'p',
          { class: 'muted' },
          'The item stands as it would on a table, whichever way up it lay in the machine. Drag to turn it, wheel to zoom.',
        ),
        this.residueLegendBox(
          summary === null
            ? 'No soil is left on this item.'
            : `${tidy(summary.visibleAreaMm2)} mm² visibly soiled in ${summary.visibleCells} cells` +
                (summary.traceCells > 0
                  ? `; ${summary.traceCells} more cells carry a trace too faint to count.`
                  : '.'),
          () => {
            this.repaintResidue();
            redraw();
          },
        ),
        soils.length > 1
          ? h(
              'label',
              { class: 'field wide' },
              h('span', null, 'Soil shown'),
              h(
                'select',
                {
                  id: 'inspector-soil',
                  onchange: (event: Event) => {
                    const value = (event.target as HTMLSelectElement).value;
                    if (this.inspecting === null) return;
                    this.inspecting.soil = value === '' ? null : Number(value);
                    redraw();
                  },
                },
                h('option', { value: '' }, 'Whichever is left most'),
                soils.map((soil, index) =>
                  h('option', { value: String(index) }, soil.replaceAll('_', ' ')),
                ),
              ),
            )
          : null,
        row.residue.length === 0
          ? null
          : h(
              'ul',
              { class: 'inspector-regions' },
              row.residue.map((region) =>
                h(
                  'li',
                  null,
                  h('span', { class: 'legend-tile', style: `background:${region.step.css}` }),
                  h('strong', null, region.label),
                  `: ${region.text}`,
                ),
              ),
            ),
        row.water === null ? null : h('p', { id: 'inspector-water' }, `Water: ${row.water}.`),
      ],
      [
        h(
          'button',
          { id: 'close-inspector', class: 'primary', onclick: () => this.closeModal() },
          'Close',
        ),
      ],
    );
    this.inspector = new ItemInspector(canvas, this.stage.scene.factory);
    redraw();
  }

  private closeInspector(): void {
    const open = this.inspecting !== null;
    this.inspector?.dispose();
    this.inspector = null;
    this.inspecting = null;
    // The traces may have been switched while it was open: the report says what is shown now.
    if (open) this.renderWash();
  }

  /** The legend of the residue scale, with the switch for traces and a line of numbers. */
  private residueLegendBox(caption: string, onTraces: () => void): HTMLElement {
    return h(
      'div',
      { class: 'residue-legend' },
      h('div', { class: 'legend-title' }, 'Soil still on the spot, as painted on the items'),
      h(
        'div',
        { class: 'legend-steps' },
        residueLegend().map((entry) =>
          h(
            'span',
            { class: 'legend-step' },
            h('span', { class: 'legend-tile', style: `background:${entry.css}` }),
            entry.label,
          ),
        ),
      ),
      h(
        'label',
        { class: 'legend-traces' },
        h('input', {
          type: 'checkbox',
          class: 'show-traces',
          checked: this.showTraces,
          onchange: (event: Event) => {
            this.showTraces = (event.target as HTMLInputElement).checked;
            onTraces();
          },
        }),
        ' also show traces too faint to count (small dots)',
      ),
      h('div', { class: 'muted' }, caption),
    );
  }

  // -------------------------------------------------------------------------------------------
  // Mouse and keyboard
  // -------------------------------------------------------------------------------------------

  private bindCanvas(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        canvas.focus();
        this.pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
        if (event.button === 2 && this.held !== null) {
          // The right button with an item in hand draws the insert arrow instead of panning.
          event.stopImmediatePropagation();
          canvas.setPointerCapture(event.pointerId);
          this.insertDrag = { x: event.clientX, y: event.clientY, dir: null };
        }
      },
      { capture: true },
    );
    canvas.addEventListener('pointermove', (event) => {
      this.cursor = { x: event.clientX, y: event.clientY };
      this.freeKey = event.altKey;
      if (this.insertDrag !== null) {
        this.insertDrag.dir = this.dragDirection(event.clientX, event.clientY);
        this.updateGhost();
        return;
      }
      if (this.held === null || this.held.exact || event.buttons !== 0) return;
      this.ghostToMouse(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointerleave', () => {
      this.cursor = null;
    });
    canvas.addEventListener('pointerup', (event) => {
      const down = this.pointerDown;
      this.pointerDown = null;
      if (this.insertDrag !== null) {
        const dir = this.insertDrag.dir;
        this.insertDrag = null;
        this.updateGhost();
        if (dir !== null) {
          this.insertDir = dir;
          void this.place('insert', dir);
        }
        return;
      }
      if (down === null || down.button !== 0 || event.button !== 0) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP_PX) return;
      this.onClick(event.clientX, event.clientY, event.shiftKey);
    });
    canvas.addEventListener(
      'wheel',
      (event) => {
        // With a piece in hand the wheel turns it; with Ctrl (and a pinch) it still zooms.
        if (this.held === null || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const steps = wheelSteps(this.wheel, event.deltaY, performance.now());
        if (steps !== 0) this.turn(steps, event.shiftKey);
      },
      { capture: true, passive: false },
    );
  }

  // -------------------------------------------------------------------------------------------
  // Pointing: the piece in hand goes where the cursor points
  // -------------------------------------------------------------------------------------------

  /**
   * The height of the reference point of the piece in hand where it would be let go in a
   * frame: what the last preview said for the frame it is in, else standing on the floor of
   * the basket.
   */
  private restHeight(held: Held, frame: FrameId): number {
    if (frame === held.ghost.frame && held.restZ !== null) return held.restZ;
    const record = this.records.get(held.itemId) as ItemRecord;
    const q = ghostQuat(held.ghost, record.orientation_presets);
    return q === null ? 0 : Math.ceil(reachBelowMm(record.bbox_mm, q));
  }

  /** A basket as something the cursor can point at with the piece in hand. */
  private aimTarget(held: Held, frame: FrameId): AimTarget {
    const base = {
      frame,
      pose: this.framePose(frame),
      envelope_mm: this.envelope(frame),
      rest_z_mm: this.restHeight(held, frame),
    };
    if (frame !== 'cutlery_basket') return base;
    // The opening of the cutlery basket is the rim of its cells, below its carrying handle.
    const cells = this.geometry?.machine.affordances.cutleryCells ?? [];
    const rim = Math.max(0, ...cells.map((cell) => cell.box.max[2] * 1000));
    return { ...base, inner: true, ...(rim > 0 ? { opening_z_mm: rim } : {}) };
  }

  /**
   * The baskets the piece in hand can be pointed into: those that are pulled out. The cutlery
   * basket is one for what stands in its cells (a piece with a handle-down stance); anything
   * else held over it is over the basket it stands in, and comes to rest on top of it.
   */
  private aimTargets(held: Held): AimTarget[] {
    const cutlery = this.stances(held.itemId).some((stance) => stance.preset === 'handle_down');
    return this.frames()
      .filter(
        (frame) =>
          frame !== 'tub' && this.rackIsOut(frame) && (frame !== 'cutlery_basket' || cutlery),
      )
      .map((frame) => this.aimTarget(held, frame));
  }

  /**
   * Moves the piece in hand to where the cursor points: into the basket under the cursor, to
   * the place where its middle, standing where it would be let go, is under the cursor. A
   * suggested spot under the cursor takes the piece up at its pose; a piece on edge near a row
   * of tines takes up the row. `moved` is false when the cursor has not moved and the place
   * is only worked out again.
   */
  private ghostToMouse(clientX: number, clientY: number, moved = true): void {
    const held = this.held;
    if (held === null || held.exact) return;
    const before = this.ghostKey(held);
    const settled = this.handSettled(held);
    this.aimAt(held, clientX, clientY, moved);
    // The cursor moved and the piece did not (the same gap of a row, the same millimetre): the
    // game's answer for the place stands, and nothing new will be asked.
    if (this.held === held && settled && this.ghostKey(held) === before) held.aimSettled = true;
  }

  private aimAt(held: Held, clientX: number, clientY: number, moved: boolean): void {
    // A move event that brings the cursor nowhere new (a press sends one) starts no new search.
    const last = held.aimedAt;
    if (moved && last !== null && last[0] === clientX && last[1] === clientY && !held.restart) {
      moved = false;
    }
    held.aimedAt = [clientX, clientY];
    held.restart = false;
    if (moved) {
      held.reaims = 0;
      held.aimLow = null;
      held.aimHigh = null;
      held.tries = [];
      held.fromFloor = false;
      held.aimSettled = false;
      held.clickQueued = false;
      // Off a rim or a handle the search starts from the floor again, not from up there.
      if (held.lastRefused) held.restZ = null;
      held.lastRefused = false;
    }
    const record = this.records.get(held.itemId) as ItemRecord;
    const wasSpot = held.spot !== null;
    const spot = this.spotUnder(held, clientX, clientY);
    if (spot !== null) {
      const place = spot.place;
      const changed = held.spot !== spot.index;
      held.spot = spot.index;
      held.snapped = null;
      this.setGhost(
        {
          frame: spot.frame,
          position_mm: place.position_mm,
          preset: place.orientation.preset,
          yaw_deg: place.orientation.yaw_deg ?? 0,
          pitch_deg: place.orientation.pitch_deg ?? 0,
          roll_deg: place.orientation.roll_deg ?? 0,
        },
        { keepHeight: true },
      );
      if (changed) this.refreshHand(held);
      return;
    }
    held.spot = null;
    const ray = this.stage.ray(clientX, clientY);
    const targets = this.aimTargets(held);
    // Over no basket the piece stays with the one it was over, if it can still be loaded.
    const frame =
      aimFrame(targets, ray.origin_mm, ray.direction) ??
      (targets.some((t) => t.frame === held.ghost.frame)
        ? held.ghost.frame
        : (targets[0]?.frame ?? held.ghost.frame));
    const target = targets.find((t) => t.frame === frame) ?? this.aimTarget(held, frame);
    const g = held.ghost;
    const aimed = aimPoint(
      target,
      ray.origin_mm,
      ray.direction,
      frame === g.frame ? [g.position_mm[0] - held.grab[0], g.position_mm[1] - held.grab[1]] : null,
    );
    if (aimed === null) return;
    let xy: readonly [number, number] = [aimed[0] + held.grab[0], aimed[1] + held.grab[1]];
    let yaw = held.freeYaw;
    let snapped: string | null = null;
    if (
      this.snapRows &&
      !this.freeKey &&
      g.quat_wxyz === undefined &&
      standsOnEdge(g.preset) &&
      frame !== 'tub'
    ) {
      // A piece in a row ends standing on the floor of the basket between the tines, lower
      // than where it is let go (on the tines): the row is the one under the cursor at that
      // height, whatever the preview said of the place it was over before.
      const standing = Math.ceil(
        reachBelowMm(record.bbox_mm, ghostQuat(g, record.orientation_presets) ?? [0, 0, 0, 1]),
      );
      const onFloor =
        aimPoint({ ...target, rest_z_mm: standing }, ray.origin_mm, ray.direction, [
          g.position_mm[0],
          g.position_mm[1],
        ]) ?? aimed;
      const row = this.rowUnder(held, record, frame, onFloor);
      if (row !== null) {
        xy = row.xy;
        yaw = row.yaw;
        snapped = row.label;
      }
    }
    const position = clampToEnvelope(
      [Math.round(xy[0]), Math.round(xy[1]), g.position_mm[2]],
      this.envelope(frame),
    );
    const newFrame = frame !== g.frame;
    const newRow = snapped !== held.snapped;
    held.snapped = snapped;
    const turned =
      g.quat_wxyz === undefined && (g.yaw_deg !== yaw || g.pitch_deg !== 0 || g.roll_deg !== 0);
    if (
      newFrame ||
      wasSpot ||
      turned ||
      position[0] !== g.position_mm[0] ||
      position[1] !== g.position_mm[1]
    ) {
      this.setGhost(
        g.quat_wxyz !== undefined
          ? { frame, position_mm: position }
          : { frame, position_mm: position, yaw_deg: yaw, pitch_deg: 0, roll_deg: 0 },
      );
    }
    if (newFrame || newRow || wasSpot) this.refreshHand(held);
  }

  /**
   * Brings the panel of the piece in hand up to date with where the piece now is (another
   * basket, a row, a suggested spot) without drawing it again: the buttons and fields under
   * the player's hands stay where they are.
   */
  private refreshHand(held: Held): void {
    const frame = document.getElementById('pose-frame') as HTMLSelectElement | null;
    if (frame !== null && frame.value !== held.ghost.frame) frame.value = held.ghost.frame;
    document.getElementById('suggestions')?.replaceWith(this.renderSuggestions(held));
    this.renderHandStatus();
    this.renderHint();
  }

  /** Works the place of the piece in hand out again where the cursor is (after a turn, a key). */
  private reaim(): void {
    // The piece has changed (a turn, another stance): the place under the cursor is looked
    // for afresh.
    if (this.held !== null) this.held.restart = true;
    if (this.cursor !== null) this.ghostToMouse(this.cursor.x, this.cursor.y, true);
  }

  /**
   * The gap of a row of tines a piece on edge takes up at a place of a basket: where it is
   * let go there (held upright across the rail, as the game's own suggestions hold it, to
   * come down between the tines and lean by itself) and the turn that makes it face away from
   * the side the tines lean to. Null when the place is near no row. The rows are the ones the
   * page is given to draw the baskets; nothing is asked of the server.
   */
  private rowUnder(
    held: Held,
    record: ItemRecord,
    frame: FrameId,
    xy: readonly [number, number],
  ): { xy: readonly [number, number]; yaw: number; label: string } | null {
    const geometry = this.geometry;
    const itemType = this.itemTypes.get(held.itemId);
    const shape = itemType === undefined ? undefined : geometry?.item_types[itemType]?.shape;
    const preset = record.orientation_presets.find((p) => p.name === held.ghost.preset);
    if (geometry === null || shape === undefined || preset === undefined) return null;
    // The way the stance turns the face of the item before any turn about the vertical.
    const face0 = quatRotate(quatNormalise(quatFromWire(preset.quat_wxyz)), [0, 0, 1]);
    if (Math.hypot(face0[0], face0[1]) < 0.5) return null;
    const affordances = geometry.machine.affordances;
    const slots = rowSlots(affordances.tineRows, frame);
    if (slots.length === 0) return null;
    const interior = affordances.baskets.find((basket) => basket.frame === frame)?.interior;
    const plan =
      interior === undefined
        ? null
        : {
            min: [interior.min[0] * 1000, interior.min[1] * 1000] as const,
            max: [interior.max[0] * 1000, interior.max[1] * 1000] as const,
          };
    const faced = (slot: RowSlot): RowSlot =>
      held.flip ? { ...slot, face: [-slot.face[0] + 0, -slot.face[1] + 0] } : slot;
    const yawOf = (slot: RowSlot): number => yawFacing(faced(slot).face, [face0[0], face0[1]]);
    const dropOf = (slot: RowSlot): readonly [number, number] => {
      const yaw = yawOf(slot);
      const key = `${held.itemId}|${preset.name}|${yaw}`;
      let known = this.edgeBoxes.get(key);
      if (known === undefined) {
        const q = ghostQuat(
          { ...held.ghost, yaw_deg: yaw, pitch_deg: 0, roll_deg: 0 },
          record.orientation_presets,
        ) as Quat;
        const box = boundingBox(shape, { p: [0, 0, 0], q });
        const reference = quatRotate(q, record.reference_point_mm as unknown as Vec3);
        known = {
          box: {
            min: [box.min[0] * 1000, box.min[1] * 1000, box.min[2] * 1000],
            max: [box.max[0] * 1000, box.max[1] * 1000, box.max[2] * 1000],
          },
          reference: [reference[0], reference[1], reference[2]],
        };
        this.edgeBoxes.set(key, known);
      }
      return slotDrop(faced(slot), known.box, known.reference, plan);
    };
    const hit = nearestSlot(slots, xy, dropOf);
    if (hit === null) return null;
    return {
      xy: hit.drop,
      yaw: yawOf(hit.slot),
      label: `row ${hit.slot.label}, gap ${hit.slot.index + 1}`,
    };
  }

  /** The suggested spots shown in the machine for the piece in hand, or null. */
  private shownSpots(): {
    readonly frame: FrameId;
    readonly places: readonly SlotAdvicePlace[];
  } | null {
    const held = this.held;
    const known = this.suggestions;
    if (held === null || known === null || known.itemId !== held.itemId) return null;
    if (!this.rackIsOut(known.frame as RackId)) return null;
    return known;
  }

  /** Where the mark of a suggested spot is on the page. */
  private spotPixel(frame: FrameId, place: SlotAdvicePlace): [number, number] {
    return this.stage.project(pointFromFrame(this.framePose(frame), place.position_mm));
  }

  /**
   * The suggested spots that get a mark in this view. The game lists them best first; where
   * the marks of two would lie on top of each other in the picture (the gaps of a plate row
   * seen from the three-quarter view are a few pixels apart) the better one is marked and the
   * other left out, so that every mark can be read and clicked. A free spot is kept before one
   * that is not. Turning the view or choosing the plan shows the ones left out.
   */
  private markedSpots(): Set<number> {
    const shown = this.shownSpots();
    const marked = new Set<number>();
    if (shown === null) return marked;
    const taken: [number, number][] = [];
    const order = shown.places
      .map((place, index) => ({ place, index }))
      .sort((a, b) => Number(b.place.free) - Number(a.place.free) || a.index - b.index);
    for (const { place, index } of order) {
      const at = this.spotPixel(shown.frame, place);
      if (taken.some((t) => Math.hypot(t[0] - at[0], t[1] - at[1]) < SPOT_APART_PX)) continue;
      taken.push(at);
      marked.add(index);
    }
    return marked;
  }

  /** The free suggested spot whose mark is under the cursor, or null. */
  private spotUnder(
    held: Held,
    clientX: number,
    clientY: number,
  ): { index: number; frame: FrameId; place: SlotAdvicePlace } | null {
    const shown = this.shownSpots();
    if (shown === null || held.exact) return null;
    let best: { index: number; place: SlotAdvicePlace; distance: number } | null = null;
    const marked = this.markedSpots();
    shown.places.forEach((place, index) => {
      if (!place.free || !marked.has(index)) return;
      const [px, py] = this.spotPixel(shown.frame, place);
      const distance = Math.hypot(px - clientX, py - clientY);
      if (distance <= SPOT_REACH_PX && (best === null || distance < best.distance)) {
        best = { index, place, distance };
      }
    });
    const found = best as { index: number; place: SlotAdvicePlace } | null;
    return found === null ? null : { index: found.index, frame: shown.frame, place: found.place };
  }

  /** The insert direction a drag from where the right button went down stands for. */
  private dragDirection(clientX: number, clientY: number): number | null {
    const held = this.held;
    const drag = this.insertDrag;
    if (held === null || drag === null) return null;
    const frame = this.framePose(held.ghost.frame);
    const [x, y, z] = held.ghost.position_mm;
    const origin = this.stage.project(pointFromFrame(frame, [x, y, z]));
    const candidates = INSERT_DIRECTIONS.map(({ dir }) => {
      const tip = this.stage.project(
        pointFromFrame(frame, [x + dir[0] * 100, y + dir[1] * 100, z + dir[2] * 100]),
      );
      return [tip[0] - origin[0], tip[1] - origin[1]] as const;
    });
    return insertDirectionFromDrag([clientX - drag.x, clientY - drag.y], candidates);
  }

  /**
   * A click on the stage. With a piece in hand it puts the piece down where it is shown.
   * Without one, a click on a piece in the machine picks it up as it stands (with Shift it
   * only selects it); after the wash a click selects.
   */
  private onClick(clientX: number, clientY: number, shift = false): void {
    if (!this.loading() && this.report === null) return;
    this.cursor = { x: clientX, y: clientY };
    if (this.held !== null) {
      if (!this.held.exact) this.ghostToMouse(clientX, clientY, false);
      this.putDown();
      return;
    }
    const picked = this.stage.pick(clientX, clientY);
    if (picked !== null && this.loading() && !shift) {
      void this.takeOut(picked, true);
      return;
    }
    this.selected = picked;
    this.updateGhost();
    this.renderAll();
  }

  // -------------------------------------------------------------------------------------------
  // Dragging a piece from the list into the machine
  // -------------------------------------------------------------------------------------------

  private overStage(clientX: number, clientY: number): boolean {
    const rect = this.stage.canvas.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }

  private onTrayDragMove(event: PointerEvent): void {
    // The cursor is over the stage or it is nowhere the piece could follow it.
    if (!this.overStage(event.clientX, event.clientY)) this.cursor = null;
    const drag = this.trayDrag;
    if (drag === null) return;
    if (!drag.dragging) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= CLICK_SLOP_PX) return;
      drag.dragging = true;
      document.body.classList.add('dragging-item');
      if (this.held?.itemId !== drag.itemId) this.pickUp(drag.itemId);
    }
    if (this.held === null || !this.overStage(event.clientX, event.clientY)) return;
    this.cursor = { x: event.clientX, y: event.clientY };
    this.freeKey = event.altKey;
    this.ghostToMouse(event.clientX, event.clientY);
  }

  private onTrayDragEnd(event: PointerEvent): void {
    const drag = this.trayDrag;
    this.trayDrag = null;
    if (drag === null || !drag.dragging) return;
    document.body.classList.remove('dragging-item');
    // The click that the release may make on the list is the end of the drag, not a pick-up.
    this.dragEnded = true;
    window.setTimeout(() => {
      this.dragEnded = false;
    }, 0);
    if (this.held?.itemId !== drag.itemId) return;
    if (this.overStage(event.clientX, event.clientY)) {
      this.onClick(event.clientX, event.clientY);
    } else {
      // Let go over the list or a panel: it stays on the counter.
      this.putBack();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Turning: which way up, and which way it faces
  // -------------------------------------------------------------------------------------------

  /** Turns the piece in hand about the vertical: a quarter turn a step, with `fine` 15 degrees. */
  private turn(steps: number, fine: boolean): void {
    const held = this.held;
    if (held === null || steps === 0) return;
    const quat = held.ghost.quat_wxyz;
    if (quat !== undefined) {
      // Held as it stood: turned about the vertical where it is, lean and all.
      const turned = quatMul(
        quatFromAxisAngle([0, 0, 1], degToRad(steps * (fine ? FINE_TURN_STEP_DEG : TURN_STEP_DEG))),
        quatFromWire(quat),
      );
      const wire = quantiseQuatWire([turned[3], turned[0], turned[1], turned[2]]);
      if (wire !== null) this.setGhost({ quat_wxyz: wire }, { keepHeight: true });
    } else if (held.snapped !== null && !held.exact && !fine) {
      // In a row the piece faces one way or the other: a turn turns it round.
      held.flip = !held.flip;
      this.reaim();
    } else {
      held.freeYaw = turnYaw(held.exact ? held.ghost.yaw_deg : held.freeYaw, steps, fine);
      this.setGhost({ yaw_deg: held.freeYaw });
      this.reaim();
    }
    this.renderHand();
  }

  /** Stands the piece in hand another way up. */
  private setStance(preset: string): void {
    const held = this.held;
    if (held === null) return;
    held.restZ = null;
    held.flip = false;
    this.setGhost({ preset, yaw_deg: held.freeYaw, pitch_deg: 0, roll_deg: 0 });
    this.reaim();
    this.renderHand();
    this.renderHint();
  }

  private stepStance(step: number): void {
    const held = this.held;
    if (held === null) return;
    const next = nextStance(this.stances(held.itemId), held.ghost.preset, step);
    if (next !== null) this.setStance(next);
  }

  /** The picture of an item in a stance, drawn once. */
  private stancePicture(itemId: string, stance: Stance): string | null {
    const key = `${itemId}|${stance.preset}`;
    const known = this.stancePictures.get(key);
    if (known !== undefined) return known;
    const itemType = this.itemTypes.get(itemId);
    if (itemType === undefined) return null;
    try {
      this.stanceView ??= new StanceView(this.stage.scene.factory);
      const picture = this.stanceView.render(itemType, this.soilLayers(itemId), stance.quat_wxyz);
      this.stancePictures.set(key, picture);
      return picture;
    } catch {
      // A picture that cannot be drawn leaves the button with its words.
      return null;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.key !== 'Alt' || !this.freeKey) return;
    this.freeKey = false;
    this.reaim();
  }

  private onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      target !== null &&
      (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
    if (event.key === 'Escape') {
      if ((this.el['modal'] as HTMLElement).childElementCount > 0 && this.api !== null) {
        this.closeModal();
      } else if (this.held !== null) {
        // Back where it was: in the machine for a piece picked up there, else the counter.
        if (this.held.origin !== null) void this.putBackWhereItWas();
        else this.putBack();
      } else if (this.selected !== null) {
        this.selected = null;
        this.updateGhost();
        this.renderAll();
      }
      if (typing) target.blur();
      return;
    }
    if (typing || event.metaKey || event.ctrlKey) return;
    if ((this.el['modal'] as HTMLElement).childElementCount > 0) return;
    const key = event.key.toLowerCase();
    const held = this.held;
    if (key === 'alt' && held !== null && !this.freeKey) {
      // Alt places freely: the rows of tines let go of the piece.
      event.preventDefault();
      this.freeKey = true;
      this.reaim();
      return;
    }
    if (key === ' ') {
      event.preventDefault();
      void this.runCheck();
      return;
    }
    if (key === 'backspace' || key === 'delete') {
      event.preventDefault();
      if (held !== null) this.putBack();
      else if (this.selected !== null) void this.takeOut(this.selected, false);
      return;
    }
    if (key === 'z' && held === null) {
      event.preventDefault();
      void this.takeBackLast();
      return;
    }
    if (held === null) return;
    switch (key) {
      case 'q':
        this.turn(1, event.shiftKey);
        break;
      case 'e':
        this.turn(-1, event.shiftKey);
        break;
      case 'r':
        this.stepStance(event.shiftKey ? -1 : 1);
        break;
      case 'enter':
        void this.place();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private chooseFrame(frame: FrameId): void {
    this.frame = frame;
    if (this.held !== null) {
      this.setGhost({ frame });
      this.renderHand();
    }
    // The view changes only when the player picks one.
    this.renderAll();
  }

  // -------------------------------------------------------------------------------------------
  // The page
  // -------------------------------------------------------------------------------------------

  private setFeedback(title: string, lines: readonly Line[]): void {
    this.feedback = { title, lines };
    this.renderFeedback();
  }

  private renderAll(): void {
    this.renderTop();
    this.renderTray();
    this.renderHand();
    this.renderSelection();
    this.renderFeedback();
    this.renderBaskets();
    this.renderCheck();
    this.renderCycle();
    this.renderHint();
    this.renderBusy();
  }

  private renderBusy(): void {
    document.body.classList.toggle('busy', this.pending > 0);
    // Once the cycle has started the wash and its report come first on the right.
    (this.el['side'] as HTMLElement).classList.toggle(
      'after-start',
      this.card !== null && !this.loading(),
    );
    document.body.dataset['pending'] = String(this.pending);
    // A hard drop can take the server seconds: say so once it has taken a moment.
    if (this.busyTimer !== null) window.clearTimeout(this.busyTimer);
    this.busyTimer = null;
    const working = this.el['working'] as HTMLElement;
    if (this.pending === 0) working.hidden = true;
    else if (working.hidden) {
      this.busyTimer = window.setTimeout(() => {
        working.hidden = this.pending === 0;
      }, 400);
    }
  }

  private renderTop(): void {
    const card = this.card;
    const state = this.state;
    const budget =
      state === null
        ? []
        : describeBudget({
            ...state.budget,
            queries_used: state.budget.queries_used + this.queriesSpent,
          }).map((b) =>
            h(
              'div',
              { class: `budget${b.fraction >= 1 ? ' spent' : b.fraction >= 0.8 ? ' low' : ''}` },
              h('span', { class: 'budget-label' }, b.label),
              h('span', { class: 'budget-value', 'data-budget': b.label.toLowerCase() }, b.text),
              h('span', { class: 'bar' }, h('span', { style: `width:${b.fraction * 100}%` })),
            ),
          );
    const views: StageView[] = [...SCENE_VIEW_NAMES, 'orbit'];
    setChildren(
      this.el['top'] as HTMLElement,
      h('div', { class: 'brand' }, 'Spotless'),
      h(
        'div',
        { class: 'level-name' },
        card === null ? '' : h('strong', null, card.title),
        card === null ? '' : ` · ${card.machine.display_name} · ${card.programme.display_name}`,
      ),
      h('div', { class: 'budgets' }, budget),
      h(
        'div',
        { class: 'views' },
        card === null
          ? null
          : views.map((view) =>
              h(
                'button',
                {
                  class: this.stage.view === view ? 'active' : '',
                  'data-view': view,
                  onclick: () => this.setView(view),
                },
                view === 'orbit' ? 'Free orbit' : viewLabel(view),
              ),
            ),
      ),
      // The marks of the views an agent is sent: item ids, and a millimetre grid in the frame
      // positions are given in.
      card === null
        ? null
        : h(
            'div',
            { class: 'marks' },
            h(
              'label',
              { title: 'Write the id of every item in the machine on it' },
              h('input', {
                id: 'show-labels',
                type: 'checkbox',
                checked: this.showLabels,
                onchange: (event: Event) => {
                  this.showLabels = (event.target as HTMLInputElement).checked;
                  this.updateMarks();
                },
              }),
              'Labels',
            ),
            h(
              'label',
              {
                title:
                  'Draw a millimetre grid in the frame of the basket (plan and three-quarter views) or of the tub (front and side views)',
              },
              h('input', {
                id: 'show-grid',
                type: 'checkbox',
                checked: this.showGrid,
                onchange: (event: Event) => {
                  this.showGrid = (event.target as HTMLInputElement).checked;
                  this.updateMarks();
                },
              }),
              'Grid',
            ),
          ),
      this.player === null
        ? null
        : h(
            'div',
            { class: 'player', id: 'player', title: 'This episode is recorded under this name' },
            `Playing as ${this.player.name}`,
          ),
      h(
        'div',
        { class: 'menu' },
        h('button', { id: 'how-to', onclick: () => this.showHowTo() }, 'How to play'),
        // In benchmark mode an episode is opened by its link, not chosen from a list.
        this.benchmarkMode
          ? null
          : h('button', { id: 'levels', onclick: () => this.showLevelPicker() }, 'Levels'),
      ),
    );
  }

  private renderTray(): void {
    const card = this.card;
    const state = this.state;
    if (card === null || state === null) {
      setChildren(this.el['tray'] as HTMLElement);
      return;
    }
    const placed = new Map(state.placed.map((p) => [p.item_id, p]));
    const reportItems = new Map((this.report?.items ?? []).map((item) => [item.item_id, item]));
    const onCounter = card.items.filter((item) => !placed.has(item.item_id));
    const inMachine = card.items.filter((item) => placed.has(item.item_id));
    // What lies on the door is not loaded: it is left out when the cycle starts.
    const loaded = state.placed.filter((p) => p.location !== 'outside');
    const outside = state.placed.length - loaded.length;
    const loadedPoints = loaded.reduce(
      (sum, p) => sum + (this.records.get(p.item_id)?.points ?? 0),
      0,
    );
    // After the start, and when the counter is empty, the load is what there is to look at.
    const tab: 'counter' | 'machine' =
      !this.loading() || onCounter.length === 0
        ? 'machine'
        : inMachine.length === 0
          ? 'counter'
          : this.trayTab;
    const entry = (item: ItemRecord): HTMLElement => {
      const where = placed.get(item.item_id);
      const thumbnail = this.thumbnails.get(item.item_id);
      const reported = reportItems.get(item.item_id);
      const status = reported === undefined ? null : reportStatus(reported);
      return h(
        'button',
        {
          class:
            'tray-item' +
            (where !== undefined ? ' placed' : '') +
            (this.held?.itemId === item.item_id ? ' held' : '') +
            (this.selected === item.item_id ? ' selected' : ''),
          'data-item-id': item.item_id,
          title:
            where === undefined
              ? 'Click to pick it up, or drag it into the machine'
              : 'In the machine. Click to select it there.',
          onpointerdown: (event: PointerEvent) => {
            if (where !== undefined || event.button !== 0 || !this.loading()) return;
            this.trayDrag = {
              itemId: item.item_id,
              x: event.clientX,
              y: event.clientY,
              dragging: false,
            };
          },
          ondragstart: (event: Event) => event.preventDefault(),
          onclick: () => {
            if (this.dragEnded) return;
            if (where !== undefined) {
              this.held = null;
              this.selected = item.item_id;
              this.updateGhost();
              this.renderAll();
            } else if (this.held?.itemId === item.item_id) {
              this.putBack();
            } else {
              this.pickUp(item.item_id);
            }
          },
        },
        thumbnail === undefined
          ? h('span', { class: 'thumb empty' })
          : h('img', { class: 'thumb', src: thumbnail, alt: '' }),
        h(
          'span',
          { class: 'tray-text' },
          h(
            'span',
            { class: 'tray-name' },
            item.display_name,
            h('span', { class: 'points' }, `${item.points} pt`),
          ),
          h('span', { class: 'tray-id' }, item.item_id),
          item.soils.length === 0
            ? h('span', { class: 'soil clean' }, 'Clean')
            : item.soils.map((soil) =>
                h(
                  'span',
                  { class: 'soil' },
                  h('span', {
                    class: 'swatch',
                    style: `background:${rgbToCss(soilAppearance(soil.type).colour)}`,
                  }),
                  soil.description,
                ),
              ),
          where === undefined
            ? null
            : h(
                'span',
                {
                  class: `where ${where.location === 'outside' ? 'bad' : where.stable ? 'ok' : 'warn'}`,
                  'data-location': where.location,
                },
                `${locationText(where.location)}${where.stable || where.location === 'outside' ? '' : ' · not stable'}`,
              ),
          status === null
            ? null
            : h('span', { class: `verdict ${status}` }, status.replaceAll('_', ' ')),
        ),
      );
    };
    setChildren(
      this.el['tray'] as HTMLElement,
      h(
        'div',
        { class: 'tray-head' },
        h('h2', null, 'Dirty items'),
        h(
          'p',
          { class: 'tray-summary' },
          `${onCounter.length} on the counter, ${loaded.length} in the machine (${loadedPoints} of ${card.items.reduce((s, i) => s + i.points, 0)} points)` +
            (outside === 0 ? '.' : `, ${outside} on the door (not loaded).`),
        ),
        h(
          'div',
          { class: 'tray-tabs segmented' },
          (
            [
              ['counter', `On the counter (${onCounter.length})`],
              ['machine', `In the machine (${inMachine.length})`],
            ] as const
          ).map(([name, label]) =>
            h(
              'button',
              {
                class: tab === name ? 'active' : '',
                'data-tray-tab': name,
                onclick: () => {
                  this.trayTab = name;
                  this.renderTray();
                },
              },
              label,
            ),
          ),
        ),
      ),
      // With a piece in hand the counter takes it back: a click here, or on the list. The
      // button keeps its room when there is nothing in hand, so that the list does not jump.
      !this.loading()
        ? null
        : h(
            'button',
            {
              id: 'to-counter',
              class: 'counter-return',
              style: this.held === null ? 'visibility:hidden' : '',
              disabled: this.held === null,
              onclick: () => this.putBack(),
            },
            'Put it back on the counter (click here, or Backspace)',
          ),
      h(
        'div',
        {
          class: 'tray-list',
          'data-tray': tab,
          onclick: (event: Event) => {
            // A click on the counter itself, between the pieces.
            if (event.target === event.currentTarget && this.held !== null) this.putBack();
          },
        },
        (tab === 'counter' ? onCounter : inMachine).map(entry),
      ),
    );
  }

  /**
   * The panel of the piece in hand: its stances as pictures, the turn, the suggested spots,
   * what the server says of the place, and, folded away, the exact pose an agent types.
   */
  private renderHand(): void {
    const panel = this.el['hand'] as HTMLElement;
    const held = this.held;
    panel.hidden = this.card === null || !this.loading();
    if (held === null || !this.loading()) {
      setChildren(
        panel,
        h('h2', null, 'In hand'),
        h(
          'p',
          { class: 'muted' },
          this.loading()
            ? 'Nothing. Click a piece in the list on the left, or drag it into the machine. Click a piece in the machine to pick it up as it stands.'
            : 'The load is frozen.',
        ),
      );
      return;
    }
    const record = this.records.get(held.itemId) as ItemRecord;
    const g = held.ghost;
    // The panel is drawn again with the exact pose folded or unfolded as it is now (the
    // event that reports a change of it comes a moment after the change).
    const exactPanel = document.getElementById('exact-pose') as HTMLDetailsElement | null;
    if (exactPanel !== null) this.exactOpen = exactPanel.open;
    const number = (
      id: string,
      label: string,
      value: number,
      apply: (value: number) => void,
      unit: string,
    ): HTMLElement =>
      h(
        'label',
        { class: 'field' },
        h('span', null, label),
        h('input', {
          id,
          type: 'number',
          step: unit === 'mm' && g.fine === true ? '0.1' : '1',
          value: String(value),
          'data-pose': id,
          onchange: (event: Event) => {
            const parsed = parseNumber((event.target as HTMLInputElement).value);
            if (parsed === null) {
              this.syncPoseFields(true);
              return;
            }
            // A typed value is exact: the cursor no longer moves the piece.
            this.holdExact(held);
            apply(parsed);
            this.syncPoseFields(true);
            this.renderHandStatus();
          },
        }),
        h('span', { class: 'unit' }, unit),
      );
    const setPosition = (axis: 0 | 1 | 2, value: number): void => {
      const position: [number, number, number] = [...this.heldPosition()];
      position[axis] = value;
      if (axis === 2) held.autoHeight = false;
      this.setGhost({ position_mm: position }, { keepHeight: true });
    };
    const shownQuat = ghostQuat(g, record.orientation_presets);
    const quatText =
      shownQuat === null
        ? ''
        : [shownQuat[3], shownQuat[0], shownQuat[1], shownQuat[2]]
            .map((c) => (Math.round(c * 1e4) / 1e4 + 0).toFixed(4))
            .join(', ');
    const stances = this.stances(held.itemId);
    const asItStood = g.quat_wxyz !== undefined && held.origin !== null;
    setChildren(
      panel,
      h('h2', null, 'In hand'),
      h(
        'p',
        { class: 'held-name' },
        h('strong', null, record.display_name),
        ` (${held.itemId}) · ${tidy(record.mass_kg * 1000)} g · ` +
          `${record.bbox_mm.map((x) => tidy(x)).join(' × ')} mm`,
      ),
      // Which way up: the stances that make sense for this piece, as pictures.
      h(
        'div',
        { class: 'stances', id: 'stances' },
        stances.map((stance) => {
          const picture = this.stancePicture(held.itemId, stance);
          return h(
            'button',
            {
              class: `stance${g.quat_wxyz === undefined && stance.preset === g.preset ? ' active' : ''}`,
              'data-stance': stance.preset,
              title:
                record.orientation_presets.find((p) => p.name === stance.preset)?.description ??
                stance.label,
              onclick: () => this.setStance(stance.preset),
            },
            picture === null ? null : h('img', { src: picture, alt: '' }),
            h('span', null, stance.label),
          );
        }),
      ),
      h(
        'p',
        { class: 'muted hand-keys', id: 'stance-note' },
        asItStood
          ? 'Held as it stood in the machine. Choose a picture to stand it another way.'
          : 'R steps through these. It settles by itself when you let it go: a plate leans on the tines.',
      ),
      // Which way it faces.
      h(
        'div',
        { class: 'turns' },
        h(
          'button',
          {
            id: 'turn-left',
            title: 'Turn a quarter to the left (Q, or wheel up)',
            onclick: () => this.turn(1, false),
          },
          '↺ Turn left (Q)',
        ),
        h(
          'button',
          {
            id: 'turn-right',
            title: 'Turn a quarter to the right (E, or wheel down)',
            onclick: () => this.turn(-1, false),
          },
          'Turn right (E) ↻',
        ),
      ),
      h(
        'p',
        { class: 'muted hand-keys' },
        'The wheel turns it too. Shift turns by 15° instead of a quarter.',
      ),
      h(
        'div',
        { class: 'checks' },
        h(
          'label',
          {
            title:
              'A piece on edge near a row of tines stands across the row, over a gap. Hold Alt to place it freely for a moment.',
          },
          h('input', {
            id: 'snap-rows',
            type: 'checkbox',
            checked: this.snapRows,
            onchange: (event: Event) => {
              this.snapRows = (event.target as HTMLInputElement).checked;
              this.reaim();
            },
          }),
          ' takes up the rows of tines (Alt: freely)',
        ),
      ),
      this.renderSuggestions(held),
      h('div', { id: 'hand-status' }),
      h(
        'div',
        { class: 'buttons' },
        h(
          'button',
          { id: 'place', class: 'primary action', onclick: () => void this.place() },
          this.mode === 'insert'
            ? 'Insert'
            : this.mode === 'set'
              ? 'Set here'
              : 'Put it down (click)',
        ),
        held.origin === null
          ? null
          : h(
              'button',
              {
                id: 'put-where-it-was',
                class: 'action',
                onclick: () => void this.putBackWhereItWas(),
              },
              'Back where it was (Esc)',
            ),
        h(
          'button',
          { id: 'put-back', onclick: () => this.putBack() },
          held.origin === null ? 'Back to the counter (Esc)' : 'To the counter (Backspace)',
        ),
      ),
      // The item from its four fixed sides, with its soil: what `get_item` shows an agent.
      h(
        'div',
        { class: 'item-pictures', id: 'item-pictures' },
        this.picturesOf(held.itemId).map((src, i) =>
          h('img', {
            src,
            alt: ITEM_VIEW_DIRECTIONS[i]?.label ?? '',
            title: ITEM_VIEW_DIRECTIONS[i]?.label ?? '',
          }),
        ),
      ),
      // The pose as numbers, for those who want what an agent has.
      h(
        'details',
        {
          id: 'exact-pose',
          class: 'exact-pose',
          open: this.exactOpen,
          ontoggle: (event: Event) => {
            this.exactOpen = (event.target as HTMLDetailsElement).open;
          },
        },
        h('summary', null, 'Exact pose (what a program types)'),
        h(
          'p',
          { class: 'muted' },
          'The pose of the request: position of the reference point in the frame of the basket (x right, y back, z up, millimetres) and the orientation. Typing a value holds the piece at exactly that pose.',
        ),
        h(
          'label',
          { class: 'field wide' },
          h('span', null, 'Frame'),
          h(
            'select',
            {
              id: 'pose-frame',
              onchange: (event: Event) => {
                this.holdExact(held);
                this.chooseFrame((event.target as HTMLSelectElement).value as FrameId);
              },
            },
            this.frames().map((frame) =>
              h(
                'option',
                { value: frame, selected: frame === g.frame },
                FRAME_LABELS[frame] ?? frame,
              ),
            ),
          ),
        ),
        h(
          'div',
          { class: 'fields' },
          number('pose-x', 'x', g.position_mm[0], (v) => setPosition(0, v), 'mm'),
          number('pose-y', 'y', g.position_mm[1], (v) => setPosition(1, v), 'mm'),
          number('pose-z', 'z', g.position_mm[2], (v) => setPosition(2, v), 'mm'),
        ),
        h(
          'label',
          { class: 'field wide' },
          h('span', null, 'Preset'),
          h(
            'select',
            {
              id: 'pose-preset',
              onchange: (event: Event) => {
                this.setGhost({ preset: (event.target as HTMLSelectElement).value });
                this.renderHand();
              },
            },
            record.orientation_presets.map((preset) =>
              h('option', { value: preset.name, selected: preset.name === g.preset }, preset.name),
            ),
          ),
        ),
        h(
          'p',
          { class: 'muted preset-text' },
          record.orientation_presets.find((p) => p.name === g.preset)?.description ?? '',
        ),
        h(
          'div',
          { class: 'fields' },
          number(
            'pose-yaw',
            'yaw',
            g.yaw_deg,
            (v) => this.setGhost({ yaw_deg: wrapAngleDeg(v) }),
            '°',
          ),
          number(
            'pose-pitch',
            'pitch',
            g.pitch_deg,
            (v) => this.setGhost({ pitch_deg: wrapAngleDeg(v) }),
            '°',
          ),
          number(
            'pose-roll',
            'roll',
            g.roll_deg,
            (v) => this.setGhost({ roll_deg: wrapAngleDeg(v) }),
            '°',
          ),
        ),
        h(
          'label',
          {
            class: 'field wide',
            title:
              'The orientation as a quaternion (w, x, y, z) in the frame. Type or paste one to hold the item at exactly that orientation, for example the pose of an item read from the Selected panel.',
          },
          h('span', null, 'Quaternion'),
          h('input', {
            id: 'pose-quat',
            type: 'text',
            class: g.quat_wxyz === undefined ? 'derived' : 'exact',
            value: quatText,
            spellcheck: 'false',
            onchange: (event: Event) => {
              const parsed = parseQuat((event.target as HTMLInputElement).value);
              if (parsed !== null) {
                this.holdExact(held);
                this.setGhost({ quat_wxyz: parsed }, { keepHeight: true });
              }
              this.renderHand();
            },
          }),
        ),
        g.quat_wxyz === undefined
          ? null
          : h(
              'p',
              { class: 'muted preset-text', id: 'quat-note' },
              'Held at this quaternion; the preset and angles above are not used until you change one of them.',
            ),
        h(
          'label',
          { class: 'field wide' },
          h('span', null, 'Release'),
          h(
            'select',
            {
              id: 'pose-mode',
              onchange: (event: Event) => {
                this.mode = (event.target as HTMLSelectElement).value as PlaceMode;
                // Exact placement takes the position to 0.1 mm; the game's modes to 1 mm.
                const { fine: _fine, ...coarse } = held.ghost;
                held.ghost = quantiseGhost(
                  this.mode === 'set' ? { ...coarse, fine: true } : coarse,
                );
                if (this.mode === 'set') this.holdExact(held);
                this.ghostChanged();
                this.renderHand();
              },
            },
            h('option', { value: 'drop', selected: this.mode === 'drop' }, 'drop from above'),
            h(
              'option',
              { value: 'insert', selected: this.mode === 'insert' },
              'insert: push along a direction',
            ),
            this.card?.rules.exact_placement === true
              ? h(
                  'option',
                  { value: 'set', selected: this.mode === 'set' },
                  'set: exactly here, then let it settle',
                )
              : null,
          ),
        ),
        this.mode === 'insert'
          ? h(
              'label',
              { class: 'field wide' },
              h('span', null, 'Push'),
              h(
                'select',
                {
                  id: 'pose-insert-dir',
                  onchange: (event: Event) => {
                    this.insertDir = Number((event.target as HTMLSelectElement).value);
                    this.updateGhost();
                  },
                },
                INSERT_DIRECTIONS.map((d, i) =>
                  h('option', { value: String(i), selected: i === this.insertDir }, d.name),
                ),
              ),
            )
          : null,
        h(
          'div',
          { class: 'checks' },
          h(
            'label',
            null,
            h('input', {
              id: 'follow-mouse',
              type: 'checkbox',
              checked: !held.exact,
              onchange: (event: Event) => {
                if ((event.target as HTMLInputElement).checked) {
                  held.exact = false;
                  held.autoHeight = true;
                  held.restZ = null;
                  if (this.mode === 'set') this.mode = 'drop';
                  this.ghostChanged();
                } else {
                  this.holdExact(held);
                }
                this.renderHand();
              },
            }),
            ' follows the cursor',
          ),
        ),
      ),
    );
    this.renderHandStatus();
  }

  /** Holds the piece in hand at the pose of the exact panel: the cursor no longer moves it. */
  private holdExact(held: Held): void {
    if (held.exact) return;
    held.exact = true;
    held.autoHeight = false;
    held.snapped = null;
    held.spot = null;
    held.grab = [0, 0];
    const follow = document.getElementById('follow-mouse') as HTMLInputElement | null;
    if (follow !== null) follow.checked = false;
    this.updateGhost();
    this.renderHint();
  }

  /**
   * The suggested spots for the item in hand: what `list_slots` gives an agent for the same
   * query (one query of the budget). Asked for with a button; choosing a spot holds the item
   * at the suggested drop, where the free preview then tests it like any other pose.
   */
  private renderSuggestions(held: Held): HTMLElement {
    const frame = held.ghost.frame;
    const known = this.suggestions;
    const mine =
      known !== null && known.itemId === held.itemId && known.frame === frame ? known : null;
    if (frame === 'tub') return h('div', { id: 'suggestions' });
    const ask = h(
      'button',
      {
        id: 'suggest-spots',
        title:
          'Ask the game where this piece can be put in this basket: between tines for plates, lids and boards, into a cell for cutlery. The places are marked in the machine; click one to put the piece there. Counts one query.',
        onclick: () => void this.askSuggestions(held.itemId, frame),
      },
      mine === null ? 'Suggest spots (1 query)' : 'Ask again (1 query)',
    );
    if (mine === null) return h('div', { id: 'suggestions', class: 'buttons' }, ask);
    const free = mine.places.filter((place) => place.free).length;
    return h(
      'div',
      { id: 'suggestions', 'data-spots': String(mine.places.length), 'data-free': String(free) },
      h(
        'p',
        { class: free === 0 ? 'muted' : 'line info', id: 'suggestions-note' },
        mine.places.length === 0
          ? 'The game suggests no spot for this piece in this basket: put it wherever it is free.'
          : `${free} free spot${free === 1 ? '' : 's'} in the ${(FRAME_LABELS[frame] ?? frame).toLowerCase()}, marked in the machine and numbered best first` +
              (mine.places.length > free
                ? ` (${mine.places.length - free} more, grey, not free now)`
                : '') +
              '. Click a mark to put the piece there. Where marks would lie on top of each other in this view only the best is shown: the plan view spreads them out.' +
              (held.spot === null
                ? ''
                : ` Over spot ${held.spot + 1}: ${slotAdviceLabel(mine.places[held.spot] as SlotAdvicePlace)}.`),
      ),
      h('div', { class: 'buttons' }, ask),
    );
  }

  private async askSuggestions(itemId: string, frame: FrameId): Promise<void> {
    const api = this.api;
    if (api === null || frame === 'tub') return;
    try {
      const result = await api.listSlots(frame, itemId);
      if (!result.accepted) {
        this.setFeedback('Suggested spots', [
          { level: 'bad', text: `The game gave none: ${result.reason}.` },
        ]);
        return;
      }
      this.suggestions = { itemId, frame, places: slotAdvice(result.slots).places };
      // The query was charged: the counter of the top bar follows.
      this.queriesSpent += 1;
      this.updateMarks();
      this.renderTop();
      if (this.held?.itemId === itemId) this.renderHand();
    } catch (error) {
      this.setFeedback('Server', [{ level: 'bad', text: messageOf(error) }]);
    }
  }

  private heldPosition(): readonly [number, number, number] {
    return (this.held as Held).ghost.position_mm;
  }

  /** Writes the pose of the ghost into the fields of the panel, except the one being typed in. */
  private syncPoseFields(force = false): void {
    const held = this.held;
    if (held === null) return;
    const g = held.ghost;
    const values: { readonly [id: string]: number } = {
      'pose-x': g.position_mm[0],
      'pose-y': g.position_mm[1],
      'pose-z': g.position_mm[2],
      'pose-yaw': g.yaw_deg,
      'pose-pitch': g.pitch_deg,
      'pose-roll': g.roll_deg,
    };
    for (const [id, value] of Object.entries(values)) {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (input === null || (!force && document.activeElement === input)) continue;
      if (input.value !== String(value)) input.value = String(value);
    }
    const preset = document.getElementById('pose-preset') as HTMLSelectElement | null;
    if (preset !== null && preset.value !== g.preset) preset.value = g.preset;
    const quat = document.getElementById('pose-quat') as HTMLInputElement | null;
    const record = this.records.get(held.itemId);
    const q = record === undefined ? null : ghostQuat(g, record.orientation_presets);
    if (quat !== null && q !== null && (force || document.activeElement !== quat)) {
      const text = [q[3], q[0], q[1], q[2]]
        .map((c) => (Math.round(c * 1e4) / 1e4 + 0).toFixed(4))
        .join(', ');
      if (quat.value !== text) quat.value = text;
    }
  }

  /**
   * True when a piece that has taken up a row would be let go far above where it stands in
   * the row: on top of something that leans into the gap, not between the tines.
   */
  private perched(held: Held, preview: PreviewResult): boolean {
    if (held.exact || held.snapped === null || !preview.accepted) return false;
    if (preview.lowered_pose === null) return false;
    const record = this.records.get(held.itemId);
    const q = record === undefined ? null : ghostQuat(held.ghost, record.orientation_presets);
    if (record === undefined || q === null) return false;
    const standing = reachBelowMm(record.bbox_mm, q);
    return preview.lowered_pose.position_mm[2] - standing > PERCHED_ABOVE_MM;
  }

  /** What the server said about the pose of the ghost. */
  private renderHandStatus(): void {
    const box = document.getElementById('hand-status');
    const held = this.held;
    if (box === null || held === null) return;
    const preview = held.previewKey === this.ghostKey(held) ? held.preview : null;
    const lines: Line[] = [];
    if (preview === null || !preview.accepted) {
      lines.push({
        level: 'info',
        text: held.exact
          ? 'Asking the game about this pose…'
          : 'Point at the place: the piece is shown where it would be let go.',
      });
    } else {
      if (!preview.in_bounds) {
        lines.push({ level: 'bad', text: 'Outside the basket.' });
      } else if (!preview.collision_free) {
        lines.push({
          level: 'bad',
          text: `Overlaps ${thingsText(preview.colliding_with)} by ${tidy(preview.penetration_mm)} mm.`,
        });
      } else if (this.mode === 'set') {
        lines.push({ level: 'ok', text: 'Free: it can be set at exactly this pose.' });
      } else if (!preview.insertable) {
        const rack = held.ghost.frame;
        lines.push({
          level: 'warn',
          text:
            rack !== 'tub' && !this.rackIsOut(rack)
              ? `${FRAME_LABELS[rack] ?? rack} is pushed in: pull it out to load it.`
              : 'Free, but nothing can come straight down to it. Try an insert.',
        });
      } else if (
        this.landing(held, preview) !== null &&
        this.landing(held, preview)?.verdict !== 'seated'
      ) {
        const landing = this.landing(held, preview) as Landing;
        lines.push({
          level: 'warn',
          text:
            held.snapped !== null && landing.verdict === 'on_cutlery_basket'
              ? `Over ${held.snapped}, but it reaches over the cutlery basket there: it may end standing on that, not between the tines. Try a gap further from the cutlery basket.`
              : (landingWords(landing.verdict, landing.above_floor_mm) ?? ''),
        });
        if (!refused(landing.verdict)) {
          lines.push({
            level: 'info',
            text: 'A click still puts it down. Z takes the last piece put down back into your hand.',
          });
        }
      } else if (this.perched(held, preview)) {
        // Free, but not down in the gap: a neighbour leans into it and the piece would be let
        // go resting on that. How it fits beside the neighbour is what the game's own
        // suggestion works out.
        lines.push({
          level: 'warn',
          text: `Over ${held.snapped}, but something leans into the gap: it would be let go on top of that and may fall. "Suggest spots" shows how it fits there (one query).`,
        });
      } else {
        lines.push({
          level: 'ok',
          text: held.exact
            ? 'Free and reachable from above.'
            : held.snapped !== null
              ? `Free. It stands over ${held.snapped} and will lean on the tines by itself.`
              : 'Free: click to put it down where it is shown.',
        });
      }
      if (preview.lowered_pose !== null && held.exact) {
        const p = preview.lowered_pose.position_mm;
        lines.push({
          level: 'info',
          text: `Dropped from here it is let go at z = ${tidy(p[2])} mm (the blue outline at the end of the line).`,
        });
      }
    }
    if (!held.exact && ['front', 'left', 'right'].includes(this.stage.view)) {
      lines.push({
        level: 'info',
        text: 'This view is for looking: the piece keeps its depth here and only moves across the picture. Place from "Lower basket", "Upper basket" or a "Top" view.',
      });
    }
    if (held.clickQueued) {
      lines.unshift({ level: 'info', text: 'Putting it down as soon as the game has answered…' });
    }
    box.dataset['tint'] = this.ghostTint(held);
    setChildren(box, linesOf(lines));
    // The button says what a click would do: nothing, where the piece would fall out.
    const button = document.getElementById('place') as HTMLButtonElement | null;
    const landing = preview === null ? null : this.landing(held, preview);
    if (button !== null) {
      const wouldFall = this.mode === 'drop' && landing !== null && refused(landing.verdict);
      button.disabled = wouldFall;
      button.title = wouldFall ? 'It would fall out of the machine from here.' : '';
    }
  }

  private renderSelection(): void {
    const panel = this.el['selection'] as HTMLElement;
    const placed = this.state?.placed.find((p) => p.item_id === this.selected);
    if (placed === undefined) {
      panel.hidden = true;
      setChildren(panel);
      return;
    }
    panel.hidden = false;
    const record = this.records.get(placed.item_id);
    const [w, x, y, z] = placed.quat_wxyz;
    setChildren(
      panel,
      h('h2', null, 'Selected'),
      h(
        'p',
        null,
        h('strong', null, record?.display_name ?? placed.item_id),
        ` (${placed.item_id})`,
      ),
      h(
        'p',
        { class: 'pose-readout', id: 'selected-pose' },
        `${FRAME_LABELS[placed.frame] ?? placed.frame}: ` +
          `x ${tidy(placed.position_mm[0])}, y ${tidy(placed.position_mm[1])}, z ${tidy(placed.position_mm[2])} mm`,
        h('br'),
        `quat (w, x, y, z) ${[w, x, y, z].map((c) => c.toFixed(4)).join(', ')}`,
      ),
      linesOf(describePlaced(placed)),
      this.loading()
        ? h(
            'div',
            { class: 'buttons' },
            h(
              'button',
              {
                id: 'take-out',
                class: 'action',
                onclick: () => void this.takeOut(placed.item_id, false),
              },
              'To the counter (Backspace)',
            ),
            h(
              'button',
              {
                id: 'take-out-hold',
                class: 'action',
                onclick: () => void this.takeOut(placed.item_id, true),
              },
              this.card?.rules.exact_placement === true
                ? 'Pick up at this pose'
                : 'Pick up as it stands',
            ),
          )
        : null,
    );
  }

  private renderFeedback(): void {
    const panel = this.el['feedback'] as HTMLElement;
    if (this.feedback === null) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    setChildren(
      panel,
      h('h2', null, 'Last action'),
      h('p', { class: 'feedback-title' }, this.feedback.title),
      linesOf(this.feedback.lines),
    );
  }

  private renderBaskets(): void {
    const panel = this.el['baskets'] as HTMLElement;
    const card = this.card;
    const state = this.state;
    if (card === null || state === null) {
      setChildren(panel);
      return;
    }
    const disabled = !this.loading();
    panel.hidden = disabled;
    const racks = card.machine.racks.filter((rack) => rack.options.length > 0);
    setChildren(
      panel,
      h('h2', null, 'Baskets'),
      racks.map((rack) =>
        h(
          'div',
          { class: 'rack' },
          h('h3', null, FRAME_LABELS[rack.rack] ?? rack.rack),
          rack.options.map((option) => {
            const current =
              option.name === 'position'
                ? state.racks[rack.rack]
                : state.rack_options[`${rack.rack}.${option.name}`];
            return h(
              'div',
              { class: 'option', title: option.description },
              h('span', { class: 'option-name' }, optionLabel(option.name)),
              h(
                'span',
                { class: 'segmented' },
                option.values.map((value) =>
                  h(
                    'button',
                    {
                      class: `action${value === current ? ' active' : ''}`,
                      disabled: disabled || value === current,
                      'data-rack': rack.rack,
                      'data-option': option.name,
                      'data-value': value,
                      onclick: () => void this.setRack(rack.rack, option.name, value),
                    },
                    optionValueLabel(value),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
      h(
        'div',
        { class: 'buttons' },
        h(
          'button',
          {
            id: 'reset',
            class: 'action',
            disabled: disabled || state.placed.length === 0,
            onclick: () =>
              this.showModal(
                'Take everything out?',
                [h('p', null, 'Every item goes back to the counter. This costs one action.')],
                [
                  h('button', { onclick: () => this.closeModal() }, 'No'),
                  h(
                    'button',
                    { id: 'confirm-reset', class: 'primary', onclick: () => void this.resetAll() },
                    'Take everything out',
                  ),
                ],
              ),
          },
          'Take everything out',
        ),
      ),
    );
  }

  private renderCheck(): void {
    const panel = this.el['check'] as HTMLElement;
    const card = this.card;
    const state = this.state;
    if (card === null || state === null) {
      setChildren(panel);
      return;
    }
    const stale = this.check !== null && this.check.hash !== state.state_hash;
    setChildren(
      panel,
      h('h2', null, 'Mechanical check'),
      h(
        'p',
        { class: 'muted' },
        card.rules.mechanical_checks
          ? 'Pushes the baskets in, turns the spray arms by hand, closes the door and opens the dispenser. It says nothing about how well anything will wash. One query' +
              ` (${Math.max(0, state.budget.queries_max - state.budget.queries_used - this.queriesSpent)} left).`
          : 'Not available in this level.',
      ),
      h(
        'div',
        { class: 'buttons' },
        h(
          'button',
          {
            id: 'run-check',
            class: 'action',
            disabled: !this.loading() || !card.rules.mechanical_checks,
            onclick: () => void this.runCheck(),
          },
          'Run the check (Space)',
        ),
      ),
      this.check === null
        ? null
        : h(
            'div',
            { id: 'check-result', class: stale ? 'stale' : '' },
            stale ? h('p', { class: 'line warn' }, 'The load has changed since this check.') : null,
            linesOf(this.check.lines),
          ),
    );
  }

  private renderCycle(): void {
    const panel = this.el['cycle'] as HTMLElement;
    const card = this.card;
    const state = this.state;
    if (card === null || state === null) {
      setChildren(panel);
      return;
    }
    if (state.phase === 'loading') {
      setChildren(
        panel,
        h('h2', null, 'Wash'),
        this.wash?.status === 'failed'
          ? h(
              'p',
              { class: 'line bad' },
              `The wash failed on the server and was given back (${this.wash.error ?? 'no details'}). It was not scored.`,
            )
          : null,
        h(
          'div',
          { class: 'buttons' },
          h(
            'button',
            {
              id: 'start-cycle',
              class: 'primary action',
              disabled: state.budget.washes_used >= state.budget.washes_max,
              onclick: () => void this.confirmStart(),
            },
            `Start ${card.programme.display_name}…`,
          ),
        ),
      );
      return;
    }
    setChildren(panel, h('h2', null, 'Wash'), h('div', { id: 'wash' }));
    this.renderWash();
  }

  /** How long the full wash of the load is expected to take, in brackets, when the server said. */
  private fullWashTime(): string {
    const option = this.washChoice?.options.find((o) => o.tier === 'official');
    return option === undefined ? '' : ` (${washTimeText(option)})`;
  }

  /** The progress of the wash, or the report when it is done. */
  private renderWash(): void {
    const box = document.getElementById('wash');
    const card = this.card;
    if (box === null || card === null) return;
    const report = this.report;
    if (report !== null) {
      const view = reportView(card, report);
      const painted = this.stage.scene.itemsWithResidue().length;
      setChildren(
        box,
        view.notice === null ? null : h('p', { id: 'not-simulated', class: 'notice' }, view.notice),
        view.label === null
          ? null
          : h(
              'p',
              { id: 'report-label', class: 'notice preview' },
              h('strong', null, `${view.label}. `),
              [
                view.preview
                  ? 'This wash was a quick preview: coarser than the full wash, and a few verdicts may differ. It is not the scored result.'
                  : '',
                // Only a wash started through the programming interface on another programme
                // than the level's gets here; the page starts none.
                view.uncalibrated
                  ? `It ran on ${view.programme}, not on the programme this level is scored on: every verdict is provisional.`
                  : '',
              ]
                .filter((part) => part !== '')
                .join(' '),
              view.preview && this.canChooseWash
                ? h(
                    'div',
                    { class: 'buttons' },
                    h(
                      'button',
                      {
                        id: 'run-full-wash',
                        class: 'primary action',
                        disabled: this.rewashing,
                        title:
                          'Sets the same load up again in a new game of this level, by the same moves, and washes it in full',
                        onclick: () => void this.runFullWash(),
                      },
                      this.rewashing
                        ? 'Setting the same load up again…'
                        : `Run the full wash on this load${this.fullWashTime()}`,
                    ),
                  )
                : null,
            ),
        h(
          'p',
          { id: 'report-total', class: 'total' },
          h('strong', null, `${view.points} of ${view.points_available} points`),
          ` · ${view.clean} of ${view.loaded} loaded items clean · ${view.items - view.loaded} left out`,
          ` · ${view.programme}`,
        ),
        view.counting === null
          ? null
          : h('p', { id: 'report-counting', class: 'muted' }, view.counting),
        h(
          'p',
          { id: 'report-loaded', class: 'muted' },
          `${view.points_loaded} points were in the machine. Graded score ${tidy(view.graded_points)} (reported, does not count).`,
        ),
        h('p', { id: 'report-tier', class: 'tier' }, view.produced_by),
        view.notes.length === 0
          ? null
          : h(
              'ul',
              { id: 'report-notes', class: 'lines' },
              view.notes.map((note) => h('li', { class: 'line warn' }, note)),
            ),
        view.not_simulated
          ? null
          : this.residueLegendBox(
              painted === 0
                ? 'No residue is painted: nothing is left on the items, or the maps are still on their way.'
                : `Residue is painted on ${painted} item${painted === 1 ? '' : 's'} in the machine. Turn the view to find it, or look at an item closely.`,
              () => this.repaintResidue(),
            ),
        h(
          'table',
          { id: 'report', class: 'report' },
          h(
            'thead',
            null,
            h('tr', null, h('th', null, 'Item'), h('th', null, 'Result'), h('th', null, 'Points')),
          ),
          h(
            'tbody',
            null,
            view.rows.map((row) =>
              h(
                'tr',
                {
                  class: `${row.status}${this.selected === row.item_id ? ' selected' : ''}`,
                  'data-item-id': row.item_id,
                  onclick: () => {
                    this.selected = row.item_id;
                    this.updateGhost();
                    this.renderAll();
                  },
                },
                h(
                  'td',
                  null,
                  row.display_name,
                  h('span', { class: 'tray-id' }, ` ${row.item_id}`),
                  row.reason === null ? null : h('div', { class: 'reason' }, row.reason),
                  row.residue.length === 0
                    ? null
                    : h(
                        'div',
                        { class: 'residue' },
                        row.residue.map((r) =>
                          h(
                            'span',
                            { class: 'residue-region', title: r.text },
                            h('span', { class: 'legend-tile', style: `background:${r.step.css}` }),
                            `${r.label} ${tidy(r.fraction * 100)}%`,
                          ),
                        ),
                      ),
                  row.water === null ? null : h('div', { class: 'water' }, row.water),
                  row.notes.length === 0
                    ? null
                    : h('div', { class: 'muted' }, row.notes.join(', ')),
                  row.inspectable
                    ? h(
                        'button',
                        {
                          class: 'inspect',
                          'data-inspect': row.item_id,
                          onclick: (event: Event) => {
                            event.stopPropagation();
                            void this.inspect(row.item_id);
                          },
                        },
                        'Look closely',
                      )
                    : null,
                ),
                h(
                  'td',
                  { class: 'verdict-cell' },
                  row.verdict,
                  row.flags.map((flag) =>
                    h(
                      'div',
                      {
                        class: `badge ${flag === 'provisional' ? 'provisional' : 'edge'}`,
                        title:
                          flag === 'provisional'
                            ? 'No measurement stands behind this verdict on this programme; it counts as given.'
                            : 'What is left is seen by a sharp eye and not by a lenient one; the verdict of the standard inspector counts.',
                      },
                      flag,
                    ),
                  ),
                  row.score_iec === null
                    ? null
                    : h(
                        'div',
                        { class: 'score', title: 'Cleaning score, 0 to 5' },
                        `${row.score_iec} / 5`,
                      ),
                ),
                h('td', { class: 'points-cell' }, `${row.points_awarded} / ${row.points}`),
              ),
            ),
          ),
        ),
      );
      return;
    }
    const wash = this.wash;
    if (wash === null) {
      setChildren(box, h('p', { class: 'muted' }, 'Waiting for the server…'));
      return;
    }
    if (wash.status === 'failed') {
      setChildren(
        box,
        h(
          'p',
          { class: 'line bad' },
          `The wash failed on the server: ${wash.error ?? 'no details'}.`,
        ),
      );
      return;
    }
    const now = performance.now();
    const progress = washProgressView(
      wash,
      (now - (wash.stageAt ?? now)) / 1000,
      (now - wash.since) / 1000,
    );
    setChildren(
      box,
      h(
        'p',
        { id: 'wash-phase', class: 'total', 'data-stage': wash.stage?.stage ?? wash.status },
        h('strong', null, progress.title),
      ),
      progress.step === '' ? null : h('p', { id: 'wash-step', class: 'muted' }, progress.step),
      h(
        'div',
        { class: `bar big${progress.overdue ? ' overdue' : ''}` },
        h('span', { style: `width:${progress.fraction * 100}%` }),
      ),
      h('p', { id: 'wash-times', class: progress.overdue ? 'line warn' : '' }, progress.times),
      h(
        'p',
        { class: 'muted' },
        `${card.programme.display_name} is simulated, not run in real time: the wait is the computation.`,
      ),
    );
  }

  private renderHint(): void {
    const hint = this.el['hint'] as HTMLElement;
    let text: string;
    if (this.card === null) {
      text = '';
    } else if (this.report !== null) {
      text = 'The report is on the right. Click a row or an item to find it. Drag to look around.';
    } else if (!this.loading()) {
      text = 'Washing. Drag to look around.';
    } else if (this.held !== null) {
      const rack = this.held.ghost.frame;
      const out = rack === 'tub' || this.rackIsOut(rack);
      text =
        (out
          ? ''
          : `${FRAME_LABELS[rack] ?? rack} is pushed in: pull it out (Baskets, on the right) to load it. `) +
        (this.held.exact
          ? 'Held at the typed pose · Enter or "Put it down" lets it go · tick "follows the cursor" to carry it again · Esc puts it back'
          : (this.held.snapped === null ? '' : `Over ${this.held.snapped} (Alt: place freely) · `) +
            'Click to put it down · R which way up · Q/E or wheel to turn · ' +
            (this.held.origin === null
              ? 'Esc back to the counter'
              : 'Esc back where it was · Backspace to the counter'));
    } else {
      text = `Click a piece in the list, or drag it in · click a piece in the machine to pick it up as it stands (Shift+click: only select)${
        this.lastPut === null ? '' : ` · Z takes ${this.lastPut.itemId} back into your hand`
      } · drag to orbit, wheel to zoom, right-drag to pan`;
    }
    hint.textContent = text;
  }

  private rackIsOut(rack: RackId): boolean {
    const state = this.state;
    if (state === null) return true;
    // The cutlery basket stands in the lower basket and travels with it.
    const carrier = rack === 'cutlery_basket' ? 'lower_rack' : rack;
    return state.racks[carrier] !== 'in';
  }

  // -------------------------------------------------------------------------------------------
  // Modals
  // -------------------------------------------------------------------------------------------

  private showModal(title: string, body: Child[], buttons: Child[]): void {
    setChildren(
      this.el['modal'] as HTMLElement,
      h(
        'div',
        { class: 'backdrop' },
        h(
          'div',
          { class: 'modal', role: 'dialog' },
          h('h1', null, title),
          h('div', { class: 'modal-body' }, body),
          h('div', { class: 'buttons' }, buttons),
        ),
      ),
    );
  }

  private closeModal(): void {
    this.closeInspector();
    setChildren(this.el['modal'] as HTMLElement);
  }

  private showLevelPicker(): void {
    this.showModal(
      'Choose a load',
      [
        h(
          'p',
          { class: 'muted' },
          `Stack the dishwasher, start the wash, and score points for every item that comes out clean. It is never possible to fit everything.${
            this.levels.length > 0 &&
            this.levels.every((level) => difficultyText(level.difficulty) !== null)
              ? ` The loads get harder as their numbers rise. ${DIFFICULTY_NOTE}`
              : ''
          }`,
        ),
        h(
          'ol',
          { class: 'levels' },
          this.levels.map((level, index) =>
            h(
              'li',
              null,
              h(
                'button',
                {
                  class: 'level',
                  'data-level-id': level.id,
                  'data-level-number': String(index + 1),
                  onclick: () => void this.newSession(level.id),
                },
                h('span', { class: 'level-number' }, String(index + 1)),
                h(
                  'span',
                  { class: 'level-text' },
                  h('strong', null, level.title),
                  h(
                    'span',
                    { class: 'level-meta' },
                    `${level.items} items · ${level.points_available} points`,
                    difficultyText(level.difficulty) === null
                      ? null
                      : h(
                          'span',
                          {
                            class: 'level-difficulty',
                            'data-difficulty': String(level.difficulty),
                            title: DIFFICULTY_NOTE,
                          },
                          ` · ${difficultyText(level.difficulty)}`,
                        ),
                  ),
                  h('span', { class: 'level-summary' }, level.summary),
                ),
              ),
            ),
          ),
        ),
      ],
      [
        h('p', { class: 'disclaimer' }, DISCLAIMER),
        h('button', { onclick: () => this.showHowTo() }, 'How to play'),
        this.api === null
          ? null
          : h('button', { onclick: () => this.closeModal() }, 'Back to the game'),
      ],
    );
  }

  private showHowTo(): void {
    const back = this.api === null ? () => this.showLevelPicker() : () => this.closeModal();
    this.showModal(
      'How to play',
      [howToPlay(this.card, this.guidanceText)],
      [
        h('p', { class: 'disclaimer' }, DISCLAIMER),
        h('button', { id: 'close-how-to', class: 'primary', onclick: back }, 'Close'),
      ],
    );
  }

  /**
   * Where the reference point of the piece in hand is drawn, in the frame of its basket: where
   * the preview says it would be let go, or the pose asked for while it is held exactly.
   */
  private shownPosition(held: Held): readonly number[] {
    const preview = held.previewKey === this.ghostKey(held) ? held.preview : null;
    const lowered = preview !== null && preview.accepted ? preview.lowered_pose : null;
    if (held.exact || held.spot !== null || this.mode !== 'drop') return held.ghost.position_mm;
    if (lowered !== null) return lowered.position_mm;
    const [x, y] = held.ghost.position_mm;
    return [x, y, this.restHeight(held, held.ghost.frame)];
  }

  /**
   * For a test script: where the mark of each suggested spot is on the page, with whether it
   * is free. Not used by the game.
   */
  debugSpots(): { index: number; x: number; y: number; free: boolean; label: string }[] {
    const shown = this.shownSpots();
    if (shown === null) return [];
    const marked = this.markedSpots();
    return shown.places
      .map((place, index) => {
        const [x, y] = this.spotPixel(shown.frame, place);
        return { index, x, y, free: place.free, label: slotAdviceLabel(place) };
      })
      .filter((spot) => marked.has(spot.index));
  }

  /** What a test script may read to know when the page has caught up. Not used by the game. */
  debugState(): {
    pending: number;
    animating: boolean;
    held: GhostPose | null;
    /** How the piece in hand is held: the row it has taken up, the spot it is over, typed or not. */
    hand: {
      exact: boolean;
      snapped: string | null;
      spot: number | null;
      fromMachine: boolean;
      shown_mm: readonly number[] | null;
      /** True once the game has answered for the place under the cursor. */
      settled: boolean;
      /** Where it would be let go, when that is not simply the floor of the basket. */
      landing: LandingVerdict | null;
    } | null;
    spots: number;
    tint: GhostTint | null;
    phase: string | null;
    placed: number;
    thumbnails: number;
    hasReport: boolean;
    view: string;
    queries: number;
    items: { id: string; stable: boolean; location: string; z: number; touching: string[] }[];
    doorShut: boolean;
    wash: { status: string; progress: number; stage: string | null } | null;
    residuePainted: string[];
    inspecting: string | null;
  } {
    return {
      // A click that waits for the game's answer is something still to come.
      pending: this.pending + (this.held?.clickQueued === true ? 1 : 0),
      animating: this.queue.busy || this.geometry?.geometry_key !== this.view?.geometry_key,
      held: this.held?.ghost ?? null,
      hand:
        this.held === null
          ? null
          : {
              exact: this.held.exact,
              snapped: this.held.snapped,
              spot: this.held.spot,
              fromMachine: this.held.origin !== null,
              shown_mm: this.shownPosition(this.held),
              settled: this.handSettled(this.held),
              landing:
                this.held.preview !== null && this.held.previewKey === this.ghostKey(this.held)
                  ? (this.landing(this.held, this.held.preview)?.verdict ?? null)
                  : null,
            },
      spots: this.shownSpots()?.places.length ?? 0,
      tint: this.held === null ? null : this.ghostTint(this.held),
      phase: this.state?.phase ?? null,
      placed: this.state?.placed.length ?? 0,
      thumbnails: this.thumbnails.size,
      hasReport: this.report !== null,
      view: this.stage.view,
      queries: (this.state?.budget.queries_used ?? 0) + this.queriesSpent,
      items: (this.state?.placed ?? []).map((p) => ({
        id: p.item_id,
        stable: p.stable,
        location: p.location,
        z: p.position_mm[2],
        touching: p.contacts.map((c) => c.with),
      })),
      // Closed, the door stands upright: its frame is not turned from the tub's.
      doorShut: Math.abs(this.shownParts['door']?.quat_wxyz[0] ?? 0) > 0.999,
      wash:
        this.wash === null
          ? null
          : {
              status: this.wash.status,
              progress: this.wash.progress,
              stage: this.wash.stage?.stage ?? null,
            },
      residuePainted: this.stage.scene.itemsWithResidue(),
      inspecting: this.inspecting?.itemId ?? null,
    };
  }

  /**
   * For a test script: where the residue of an item is painted, checked against the item as
   * this page draws it. Every tile's centre is taken in the tub frame as drawn, carried back
   * into the item frame by the item's draw pose, and measured against the surface of the
   * item's shape. Returns the positions (millimetres, tub frame) with the cell of each, and
   * the largest distance from the surface. Not used by the game.
   */
  debugResidue(itemId: string): {
    tiles: number;
    cells: number[];
    positions_mm: number[];
    max_surface_distance_mm: number;
    draw_pose: DrawPose;
  } | null {
    const drawn = this.stage.scene.residueTilePositions(itemId);
    const pose = this.view?.poses.items[itemId];
    const itemType = this.itemTypes.get(itemId);
    const shape = itemType === undefined ? undefined : this.geometry?.item_types[itemType]?.shape;
    if (drawn === null || pose === undefined || shape === undefined) return null;
    const [w, x, y, z] = pose.quat_wxyz;
    const frame = {
      p: [pose.position_mm[0] / 1000, pose.position_mm[1] / 1000, pose.position_mm[2] / 1000] as [
        number,
        number,
        number,
      ],
      q: quatNormalise([x, y, z, w]),
    };
    let worst = 0;
    const positions: number[] = [];
    for (let t = 0; t < drawn.cell.length; t++) {
      const world: [number, number, number] = [
        drawn.position[3 * t] as number,
        drawn.position[3 * t + 1] as number,
        drawn.position[3 * t + 2] as number,
      ];
      const distance = Math.abs(signedDistance(shape, poseInverseTransformPoint(frame, world)));
      if (distance > worst) worst = distance;
      positions.push(
        Math.round(world[0] * 1e6) / 1000,
        Math.round(world[1] * 1e6) / 1000,
        Math.round(world[2] * 1e6) / 1000,
      );
    }
    return {
      tiles: drawn.cell.length,
      cells: [...drawn.cell],
      positions_mm: positions,
      max_surface_distance_mm: worst * 1000,
      draw_pose: pose,
    };
  }
}
