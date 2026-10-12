/**
 * Turning the piece in hand the way a person thinks of it: which way up it is (its stance: a
 * plate on its edge, a glass mouth down, a board on its long edge) and which way it faces (a
 * turn about the vertical). Also the rows of tines a piece on edge takes its direction from.
 *
 * The stances are the item's own orientation presets, the ones an agent names in `place`; this
 * module only puts them in the order a person loading a dishwasher reaches for them and
 * leaves out the two a turn or the physics gives anyway. Pure functions.
 */

import type { OrientationPresetCard, Vec3Mm } from '@spotless/session';
import { wrapAngleDeg } from './pose.ts';

/** One way up of a piece. */
export interface Stance {
  /** The orientation preset it stands for. */
  readonly preset: string;
  /** A few words for the picture. */
  readonly label: string;
  readonly quat_wxyz: readonly [number, number, number, number];
}

const LABELS: { readonly [preset: string]: string } = {
  handle_down: 'Handle down',
  handle_up: 'Handle up',
  on_edge: 'On edge',
  on_long_edge: 'On its long edge',
  on_short_edge: 'On its short edge',
  on_edge_handle_up: 'On edge, handle up',
  on_edge_reversed: 'On edge, facing back',
  leaning: 'On edge, leaning back',
  inclined: 'Tilted, opening down',
  inverted: 'Upside down',
  inverted_tilted: 'Upside down, tilted',
  on_side: 'On its side',
  upright: 'Upright',
  flat: 'Lying flat',
  flat_inverted: 'Flat, turned over',
};

/** Cutlery and utensils: what stands in a cell of the cutlery basket. */
const CUTLERY_ORDER = ['handle_down', 'handle_up', 'flat', 'flat_inverted', 'on_edge'];
/** Plates, boards, lids, trays: what stands between tines. */
const FLAT_ORDER = [
  'on_edge',
  'on_long_edge',
  'on_short_edge',
  'on_edge_handle_up',
  'inclined',
  'inverted',
  'inverted_tilted',
  'upright',
  'flat',
  'flat_inverted',
  'on_side',
];
/** Glasses, mugs, bowls, pots: what goes mouth down. */
const HOLLOW_ORDER = [
  'inverted',
  'inverted_tilted',
  'inclined',
  'on_edge',
  'on_long_edge',
  'on_short_edge',
  'on_side',
  'upright',
  'flat',
  'flat_inverted',
];

/**
 * Presets that are another stance turned or leaned: a half turn about the vertical gives
 * `on_edge_reversed` from `on_edge`, and a piece on edge leans back by itself. They stay
 * reachable in the exact pose panel.
 */
const GIVEN_BY_A_TURN: { readonly [preset: string]: string } = {
  on_edge_reversed: 'on_edge',
  leaning: 'on_edge',
};

/** The words for a preset. */
export function stanceLabel(preset: string): string {
  return LABELS[preset] ?? preset.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * The stances of a piece, the one a person loading a dishwasher most often wants first: handle
 * down for cutlery, on edge for what is flat (its height at most three tenths of its width),
 * upside down for what is hollow. The first is the stance a piece is picked up in.
 */
export function stancesOf(presets: readonly OrientationPresetCard[], bboxMm: Vec3Mm): Stance[] {
  const names = new Set(presets.map((preset) => preset.name));
  const shown = presets.filter((preset) => {
    const base = GIVEN_BY_A_TURN[preset.name];
    return base === undefined || !names.has(base);
  });
  const flat = bboxMm[2] <= 0.3 * Math.max(bboxMm[0], bboxMm[1]);
  const order = names.has('handle_down') ? CUTLERY_ORDER : flat ? FLAT_ORDER : HOLLOW_ORDER;
  const rank = (name: string): number => {
    const at = order.indexOf(name);
    return at < 0 ? order.length : at;
  };
  return shown
    .map((preset, index) => ({ preset, index }))
    .sort((a, b) => rank(a.preset.name) - rank(b.preset.name) || a.index - b.index)
    .map(({ preset }) => ({
      preset: preset.name,
      // A plate or a board "upright" lies flat with its face up: it is called that.
      label: flat && preset.name === 'upright' ? 'Flat, face up' : stanceLabel(preset.name),
      quat_wxyz: preset.quat_wxyz,
    }));
}

/** The stance after `step` presses of the stance key; the first when the current one is not shown. */
export function nextStance(stances: readonly Stance[], current: string, step = 1): string | null {
  if (stances.length === 0) return null;
  const at = stances.findIndex((stance) => stance.preset === current);
  if (at < 0) return (stances[0] as Stance).preset;
  const next = (((at + step) % stances.length) + stances.length) % stances.length;
  return (stances[next] as Stance).preset;
}

/** A turn of the turn keys and the wheel, degrees: a quarter turn, from one row direction to the next. */
export const TURN_STEP_DEG = 90;
/** The finer turn, with Shift held. */
export const FINE_TURN_STEP_DEG = 15;

/** A yaw turned by a number of steps to the left (positive) or right, whole degrees in (-180, 180]. */
export function turnYaw(yawDeg: number, steps: number, fine = false): number {
  return wrapAngleDeg(yawDeg + steps * (fine ? FINE_TURN_STEP_DEG : TURN_STEP_DEG));
}

/** What the wheel has been turned by and when it last turned the piece. */
export interface WheelState {
  travel: number;
  lastAt: number;
}

/** Wheel travel that makes one turn step, in the units of `deltaY` (one notch of a mouse wheel is about 100). */
export const WHEEL_STEP = 60;
/** The least time between two turn steps of the wheel, milliseconds: a touchpad sends a stream. */
export const WHEEL_STEP_MS = 140;

/**
 * The turn steps a wheel event stands for: one step each time the wheel has travelled far
 * enough one way, and never two within a moment (a touchpad sends dozens of events for one
 * swipe). Wheel up turns to the left.
 */
export function wheelSteps(state: WheelState, deltaY: number, now: number): number {
  if (deltaY === 0) return 0;
  // A change of direction starts again.
  if (Math.sign(deltaY) !== Math.sign(state.travel)) state.travel = 0;
  state.travel += deltaY;
  if (Math.abs(state.travel) < WHEEL_STEP || now - state.lastAt < WHEEL_STEP_MS) return 0;
  const step = state.travel < 0 ? 1 : -1;
  state.travel = 0;
  state.lastAt = now;
  return step;
}

// ---------------------------------------------------------------------------------------------
// Rows of tines
// ---------------------------------------------------------------------------------------------

/** A row of tines as the geometry of the machine gives it (`affordances.tineRows`), metres. */
export interface TineRowInput {
  readonly rowId: string;
  readonly label: string;
  readonly frame: string;
  readonly runs: 'x' | 'y';
  readonly state: 'up' | 'folded';
  readonly tines: readonly {
    readonly base: readonly [number, number, number];
    readonly tip: readonly [number, number, number];
  }[];
  readonly slots: readonly {
    readonly index: number;
    readonly centre: readonly [number, number, number];
    readonly lean: number;
    readonly leanToward: string;
    readonly plateNormal: readonly [number, number, number];
    readonly blockedBy: string | null;
  }[];
  readonly partner: { readonly rowId: string; readonly railSpacing: number } | null;
}

/** A gap between two tines where a piece on edge can stand, millimetres in the frame of its basket. */
export interface RowSlot {
  readonly row: string;
  readonly label: string;
  readonly index: number;
  /** Axis the rail runs along (0 for x, 1 for y); the piece stands across it. */
  readonly along: 0 | 1;
  /** Midpoint between the tips of the two tines. */
  readonly tips_mm: Vec3Mm;
  /** Where the middle of a piece stands across the rail: midway to the partner row. */
  readonly across_mm: number;
  /** The way the face of the piece looks: away from the side the tines lean to. */
  readonly face: readonly [number, number];
}

const DIRECTIONS: { readonly [name: string]: readonly [number, number] } = {
  '+x': [1, 0],
  '-x': [-1, 0],
  '+y': [0, 1],
  '-y': [0, -1],
};

/**
 * The slots of the rows of a basket that stand up and are not covered, with the way a piece
 * faces in each: the rule the game's own suggestions follow (across the rail, midway to the
 * partner row, face away from the side the tines lean to).
 */
export function rowSlots(rows: readonly TineRowInput[], frame: string): RowSlot[] {
  const slots: RowSlot[] = [];
  for (const row of rows) {
    if (row.frame !== frame || row.state !== 'up') continue;
    const along: 0 | 1 = row.runs === 'x' ? 0 : 1;
    const across = 1 - along;
    const partner = rows.find(
      (other) => other.frame === frame && other.rowId === row.partner?.rowId,
    );
    const partnerAt = partner?.tines[0]?.base[across];
    for (const slot of row.slots) {
      const a = row.tines[slot.index];
      const b = row.tines[slot.index + 1];
      if (a === undefined || b === undefined || slot.blockedBy !== null) continue;
      const lean: readonly [number, number] =
        slot.lean > 0
          ? (DIRECTIONS[slot.leanToward] ?? [0, 0])
          : [-slot.plateNormal[0], -slot.plateNormal[1]];
      const size = Math.hypot(lean[0], lean[1]);
      if (size < 1e-9) continue;
      const here = slot.centre[across] as number;
      slots.push({
        row: row.rowId,
        label: row.label,
        index: slot.index,
        along,
        tips_mm: [
          ((a.tip[0] + b.tip[0]) / 2) * 1000,
          ((a.tip[1] + b.tip[1]) / 2) * 1000,
          Math.max(a.tip[2], b.tip[2]) * 1000,
        ],
        across_mm: (partnerAt === undefined ? here : (here + partnerAt) / 2) * 1000,
        face: [-lean[0] / size + 0, -lean[1] / size + 0],
      });
    }
  }
  return slots;
}

/** True for a stance in which a piece stands on its edge between tines. */
export function standsOnEdge(preset: string): boolean {
  return (
    preset === 'on_edge' ||
    preset === 'on_long_edge' ||
    preset === 'on_short_edge' ||
    preset === 'on_edge_handle_up'
  );
}

/**
 * The turn about the vertical that makes a piece on edge face a direction of its basket.
 * `from` is the way its stance turns the face of the item before any turn: the front (-y) for
 * the `on_edge` presets, so that a face to the right (+x) is a quarter turn to the left.
 * Whole degrees, as `place` takes them.
 */
export function yawFacing(
  face: readonly [number, number],
  from: readonly [number, number] = [0, -1],
): number {
  const turn = Math.atan2(face[1], face[0]) - Math.atan2(from[1], from[0]);
  return wrapAngleDeg(Math.round((turn * 180) / Math.PI));
}

/**
 * Where a piece held upright on its edge is let go over a slot: its rim over the middle
 * between the two tine tips, its middle midway to the partner row, kept clear of the walls.
 * `box` is the bounding box of the piece at that orientation about its own origin and
 * `reference` its reference point turned the same way (millimetres); `plan` the clear inside
 * of the basket. The reference point's x and y, unrounded.
 */
export function slotDrop(
  slot: RowSlot,
  box: { readonly min: Vec3Mm; readonly max: Vec3Mm },
  reference: Vec3Mm,
  plan: { readonly min: readonly [number, number]; readonly max: readonly [number, number] } | null,
  wallClearanceMm = 4,
): readonly [number, number] {
  const along = slot.along;
  const across = (1 - along) as 0 | 1;
  const face = slot.face[along];
  const front = face > 0 ? box.max[along] : -box.min[along];
  const depth = box.max[along] - box.min[along];
  const origin: [number, number] = [0, 0];
  origin[along] = slot.tips_mm[along] - face * (front - Math.min(2.5, depth / 2));
  let at = slot.across_mm - (box.min[across] + box.max[across]) / 2;
  if (plan !== null) {
    const low = plan.min[across] + wallClearanceMm - box.min[across];
    const high = plan.max[across] - wallClearanceMm - box.max[across];
    if (low <= high) at = Math.min(Math.max(at, low), high);
  }
  origin[across] = at;
  return [origin[0] + reference[0], origin[1] + reference[1]];
}

/**
 * The slot a piece on edge takes up when it is pointed at a place: the nearest slot whose
 * drop is within reach of that place (`acrossMm` across the rail, a little more than half a
 * gap along it), or null when the place is near no row. `dropOf` gives the drop of a slot.
 */
export function nearestSlot(
  slots: readonly RowSlot[],
  place: readonly [number, number],
  dropOf: (slot: RowSlot) => readonly [number, number],
  reach: { readonly acrossMm: number; readonly alongMm: number } = { acrossMm: 70, alongMm: 30 },
): { readonly slot: RowSlot; readonly drop: readonly [number, number] } | null {
  let best: { slot: RowSlot; drop: readonly [number, number]; distance: number } | null = null;
  for (const slot of slots) {
    const drop = dropOf(slot);
    const other = (1 - slot.along) as 0 | 1;
    const along = Math.abs(drop[slot.along] - place[slot.along]);
    const across = Math.abs(drop[other] - place[other]);
    if (along > reach.alongMm || across > reach.acrossMm) continue;
    // Along the rail the nearest gap; across it the nearer pair of rows.
    const distance = along + 0.25 * across;
    if (best === null || distance < best.distance) best = { slot, drop, distance };
  }
  return best === null ? null : { slot: best.slot, drop: best.drop };
}
