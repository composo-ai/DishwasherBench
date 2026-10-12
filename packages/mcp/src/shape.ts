/**
 * The shape of the tools' results: what the game answers, cut to what a player needs to read.
 *
 * The game's own results are written for a log (`@spotless/session`): every action returns
 * the whole scene, and a slot list every slot of the basket with its geometry. For a player
 * who pays for every character of a conversation that is the wrong shape: a result that
 * carries every item's pose grows with the load. So the results of this server are shaped:
 *
 *  - An action's result says **what the action changed, completely** (`changes`): every item
 *    whose entry in the scene state is new or different, with its whole new entry, the items
 *    that went back to the counter, the baskets and options that changed; then a short
 *    summary of the whole load (`load`) and the budget counters. It does not repeat the scene.
 *    A client that applies every `changes` to its own copy of the state has exactly what
 *    `get_state` returns ({@link LoadTracker} does this, and the tests hold it to it).
 *  - `get_state` gives the whole state, or the part asked for, with the placed items as a
 *    table (one row an item).
 *  - `get_level` names every kind of item once (`item_types`) instead of repeating its record
 *    for every piece.
 *  - `list_slots` gives the suggested places for the item in hand as one ranked list, a
 *    screenful at a time (`slot-advice.ts` of `@spotless/server`, shared with the page).
 *  - No number is finer than a player can use: positions to 0.1 mm and quaternions to 1e-4
 *    (what the page shows), everything else to at most four decimals.
 *
 * Everything here is a pure function of the game's answer (and, for an action, of the state
 * this client was last told). The game, its log and its digests are untouched.
 */

import { compareIds } from '@spotless/core';
import { slotAdvice } from '@spotless/server/slot-advice';
import type {
  BudgetState,
  ItemRecord,
  LevelCard,
  ListSlotsResult,
  PlacedItemState,
  SceneState,
  SlotCard,
} from '@spotless/session';

// ---------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------

/** A number rounded to at most `decimals` decimals. */
export function roundTo(x: number, decimals: number): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** decimals;
  const rounded = Math.round(x * f) / f;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Decimals kept for a field by its name; any other number keeps at most four. */
const DECIMALS: { readonly [key: string]: number } = {
  settle_time_s: 1,
  displacement_mm: 1,
  rotation_deg: 1,
  penetration_mm: 2,
  blocked_above_mm: 1,
  beyond_mm: 1,
  first_contact_angle_deg: 1,
  normal_force_N: 2,
  force_over_weight: 1,
  lowest_point_mm: 1,
  runtime_s: 1,
  eta_s: 0,
  elapsed_s: 0,
  reported_ago_s: 0,
  retained_water_ml: 1,
  surface_film_g: 2,
  visible_area_mm2: 1,
  soiled_area_mm2: 0,
  amount_g: 2,
  mass_kg: 3,
};

/** Every number of a JSON value rounded to what a player can use (see {@link DECIMALS}). */
export function tidyNumbers(value: unknown, key = ''): unknown {
  if (typeof value === 'number') return roundTo(value, DECIMALS[key] ?? 4);
  if (Array.isArray(value)) return value.map((entry) => tidyNumbers(entry, key));
  if (typeof value === 'object' && value !== null) {
    const out: { [k: string]: unknown } = {};
    for (const [k, v] of Object.entries(value)) out[k] = tidyNumbers(v, k);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------------------------
// The scene state
// ---------------------------------------------------------------------------------------------

/** One item in the machine, as the shaped results state it. */
export interface LoadItem {
  readonly item_id: string;
  /** The frame the pose is in: the frame the item was placed in. */
  readonly frame: string;
  /** The item's reference point in that frame, millimetres (0.1 mm steps). */
  readonly position_mm: readonly number[];
  /** Orientation (w, x, y, z), item frame to that frame. */
  readonly quat_wxyz: readonly number[];
  /** Whether it stayed put under the light nudge that ended the last action that touched it. */
  readonly stable: boolean;
  /** What it touches: item ids and machine parts, sorted. */
  readonly touches: readonly string[];
  /** Where it lies: `lower_rack`, `upper_rack`, `tub_floor` or `outside`. */
  readonly location: string;
}

/** The budget counters as the shaped results write them: `used/max`. */
export interface ShapedBudget {
  readonly actions?: string;
  readonly queries?: string;
  readonly washes?: string;
}

/** The columns of the table of placed items, in order. */
export const PLACED_COLUMNS = [
  'item_id',
  'frame',
  'position_mm',
  'quat_wxyz',
  'stable',
  'touches',
  'location',
] as const;

/** A row of the table of placed items: the fields of a {@link LoadItem} in column order. */
export type PlacedRow = readonly [
  string,
  string,
  readonly number[],
  readonly number[],
  boolean,
  readonly string[],
  string,
];

/** The scene state as `get_state` returns it (whole, or the part asked for). */
export interface ShapedState {
  /** The first 12 hex digits of the scene's hash (the episode record has it in full). */
  readonly state_hash: string;
  readonly phase: string;
  readonly racks: { readonly [rack: string]: string };
  readonly rack_options: { readonly [option: string]: string };
  readonly placed: { readonly columns: readonly string[]; readonly rows: readonly PlacedRow[] };
  /** Number of items in the machine (all of them, also when only a part is listed). */
  readonly placed_total: number;
  /** Ids of the items on the counter (the whole state), or of the asked items that are there. */
  readonly unplaced?: readonly string[];
  /** Present when the answer is a part of the state: what was asked for. */
  readonly part?: { readonly rack?: string; readonly items?: readonly string[] };
  readonly budget: ShapedBudget;
}

/** What an action changed in the scene state. Keys that changed nothing are absent. */
export interface ShapedChanges {
  /**
   * Every item whose entry is new or different, with its whole new entry; for an item that
   * was displaced by more than 1 mm or 1 degree, how far (`moved_mm`, `turned_deg`).
   */
  readonly items?: readonly (LoadItem & {
    readonly moved_mm?: number;
    readonly turned_deg?: number;
  })[];
  /** Items that were in the machine and are back on the counter. */
  readonly to_counter?: readonly string[];
  readonly racks?: { readonly [rack: string]: string };
  readonly rack_options?: { readonly [option: string]: string };
  readonly phase?: string;
}

/** The whole load in a few numbers, given with every action's result. */
export interface LoadSummary {
  /** Items in the machine, and on the counter. */
  readonly placed: number;
  readonly unplaced: number;
  /** Items by where they lie (`lower_rack`, `upper_rack`, `tub_floor`, `outside`). */
  readonly by_location: { readonly [location: string]: number };
  /** Ids of the items in the machine that are not stable; absent when there is none. */
  readonly unstable?: readonly string[];
  /** Position of every basket. */
  readonly racks: { readonly [rack: string]: string };
}

/** `sha256:9489196a...` as its first 12 hex digits. */
export function shortHash(hash: string): string {
  return hash.replace(/^sha256:/, '').slice(0, 12);
}

/** The budget counters as `used/max`. */
export function shapeBudget(budget: BudgetState): Required<ShapedBudget> {
  return {
    actions: `${budget.actions_used}/${budget.actions_max}`,
    queries: `${budget.queries_used}/${budget.queries_max}`,
    washes: `${budget.washes_used}/${budget.washes_max}`,
  };
}

/** An item of the game's scene state as the shaped results state it. */
export function loadItem(placed: PlacedItemState): LoadItem {
  return {
    item_id: placed.item_id,
    frame: placed.frame,
    position_mm: placed.position_mm.map((x) => roundTo(x, 1)),
    quat_wxyz: placed.quat_wxyz.map((x) => roundTo(x, 4)),
    stable: placed.stable,
    touches: placed.contacts.map((contact) => contact.with),
    location: placed.location,
  };
}

/** A {@link LoadItem} as a row of the table of placed items. */
export function rowOf(item: LoadItem): PlacedRow {
  return [
    item.item_id,
    item.frame,
    item.position_mm,
    item.quat_wxyz,
    item.stable,
    item.touches,
    item.location,
  ];
}

/** A row of the table of placed items as a {@link LoadItem}. */
export function itemOfRow(row: PlacedRow): LoadItem {
  return {
    item_id: row[0],
    frame: row[1],
    position_mm: row[2],
    quat_wxyz: row[3],
    stable: row[4],
    touches: row[5],
    location: row[6],
  };
}

function sameItem(a: LoadItem, b: LoadItem): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Which part of the state `get_state` is asked for. */
export interface StateFilter {
  /** Only the items lying in this basket, or placed in its frame. */
  readonly rack?: string;
  /** Only these items. */
  readonly items?: readonly string[];
}

/** The scene state as `get_state` returns it: whole, or the part the filter asks for. */
export function shapeState(state: SceneState, filter: StateFilter = {}): ShapedState {
  const all = state.placed.map(loadItem);
  const partial = filter.rack !== undefined || filter.items !== undefined;
  const wanted = filter.items === undefined ? null : new Set(filter.items);
  const listed = all.filter(
    (item) =>
      (filter.rack === undefined || item.location === filter.rack || item.frame === filter.rack) &&
      (wanted === null || wanted.has(item.item_id)),
  );
  const onCounter =
    wanted === null ? state.unplaced : state.unplaced.filter((id) => wanted.has(id));
  return {
    state_hash: shortHash(state.state_hash),
    phase: state.phase,
    racks: { ...state.racks },
    rack_options: { ...state.rack_options },
    placed: { columns: PLACED_COLUMNS, rows: listed.map(rowOf) },
    placed_total: all.length,
    // The counter is listed with the whole state, and for the items asked for by name.
    ...(partial && wanted === null ? {} : { unplaced: [...onCounter] }),
    ...(partial
      ? {
          part: {
            ...(filter.rack === undefined ? {} : { rack: filter.rack }),
            ...(filter.items === undefined ? {} : { items: [...filter.items] }),
          },
        }
      : {}),
    budget: shapeBudget(state.budget),
  };
}

/** The whole load in a few numbers. */
export function loadSummary(state: SceneState): LoadSummary {
  const byLocation: { [location: string]: number } = {};
  const unstable: string[] = [];
  for (const item of state.placed) {
    byLocation[item.location] = (byLocation[item.location] ?? 0) + 1;
    if (!item.stable) unstable.push(item.item_id);
  }
  return {
    placed: state.placed.length,
    unplaced: state.unplaced.length,
    by_location: byLocation,
    ...(unstable.length === 0 ? {} : { unstable }),
    racks: { ...state.racks },
  };
}

/**
 * What differs between two scene states, as the shaped results state it: every item whose
 * entry is new or different with its whole new entry, the items no longer in the machine,
 * and the baskets, options and phase that changed. `moved` says how far the game reported an
 * item displaced (more than 1 mm or 1 degree).
 */
export function diffStates(
  before: SceneState,
  after: SceneState,
  moved: readonly {
    readonly item_id: string;
    readonly displacement_mm: number;
    readonly rotation_deg: number;
  }[] = [],
): ShapedChanges {
  const was = new Map(before.placed.map((item) => [item.item_id, loadItem(item)]));
  const movedBy = new Map(moved.map((entry) => [entry.item_id, entry]));
  const items: (LoadItem & { moved_mm?: number; turned_deg?: number })[] = [];
  const now = new Set<string>();
  for (const placed of after.placed) {
    const item = loadItem(placed);
    now.add(item.item_id);
    const old = was.get(item.item_id);
    if (old !== undefined && sameItem(old, item)) continue;
    const by = movedBy.get(item.item_id);
    items.push({
      ...item,
      ...(by === undefined
        ? {}
        : {
            moved_mm: roundTo(by.displacement_mm, 1),
            turned_deg: roundTo(by.rotation_deg, 1),
          }),
    });
  }
  const toCounter = [...was.keys()].filter((id) => !now.has(id)).sort(compareIds);
  const changed = (
    a: { readonly [key: string]: string | undefined },
    b: { readonly [key: string]: string | undefined },
  ): { [key: string]: string } => {
    const out: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(b)) {
      if (value !== undefined && a[key] !== value) out[key] = value;
    }
    return out;
  };
  const racks = changed(before.racks, after.racks);
  const options = changed(before.rack_options, after.rack_options);
  return {
    ...(items.length === 0 ? {} : { items }),
    ...(toCounter.length === 0 ? {} : { to_counter: toCounter }),
    ...(Object.keys(racks).length === 0 ? {} : { racks }),
    ...(Object.keys(options).length === 0 ? {} : { rack_options: options }),
    ...(before.phase === after.phase ? {} : { phase: after.phase }),
  };
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

interface RawAction {
  readonly accepted?: boolean;
  readonly state?: SceneState;
  readonly state_hash?: string;
  readonly [key: string]: unknown;
}

/**
 * The result of an action as this server returns it. `told` is the scene state this client
 * was last given (by an earlier action or by `get_state`), or null when it has been given
 * none: the first result then carries the whole state (`state`) instead of `changes`.
 *
 * A refused action is returned as the game gave it (rounded): it changed nothing.
 */
export function shapeAction(
  name: 'place' | 'remove' | 'reset' | 'set_rack' | 'start_cycle',
  body: unknown,
  told: SceneState | null,
): unknown {
  const raw = body as RawAction | null;
  if (raw === null || typeof raw !== 'object' || raw.accepted !== true || raw.state === undefined) {
    return tidyNumbers(body);
  }
  const state = raw.state;
  // How far the game says items were displaced: by the action, or for the start of the
  // cycle by the baskets going in.
  const prechecks = raw['prechecks'] as { shifted?: unknown } | undefined;
  const moved = (raw['moved_items'] ?? prechecks?.shifted ?? []) as {
    item_id: string;
    displacement_mm: number;
    rotation_deg: number;
  }[];
  const tail = {
    ...(told === null
      ? { state: shapeState(state) }
      : { changes: diffStates(told, state, Array.isArray(moved) ? moved : []) }),
    load: loadSummary(state),
    budget: shapeBudget(state.budget),
    state_hash: shortHash(state.state_hash),
  };
  const returned = (raw['returned'] ?? []) as string[];
  const fell = {
    ...(raw['fell_through'] === true ? { fell_through: true } : {}),
    ...(raw['fell_out'] === true ? { fell_out: true } : {}),
    ...(Array.isArray(returned) && returned.length > 0 ? { returned } : {}),
  };
  if (name === 'place') {
    const release = raw['release_pose'] as
      { position_mm: number[]; quat_wxyz: number[] } | undefined;
    const contacts = (raw['contacts'] ?? []) as { with: string; normal_force_N?: number }[];
    const forces: { [part: string]: number } = {};
    for (const contact of contacts) forces[contact.with] = roundTo(contact.normal_force_N ?? 0, 2);
    return {
      accepted: true,
      item_id: raw['item_id'],
      ...(release === undefined
        ? {}
        : {
            released_at: {
              position_mm: release.position_mm.map((x) => roundTo(x, 1)),
              quat_wxyz: release.quat_wxyz.map((x) => roundTo(x, 4)),
            },
          }),
      displacement_mm: roundTo(Number(raw['displacement_mm'] ?? 0), 1),
      rotation_deg: roundTo(Number(raw['rotation_deg'] ?? 0), 1),
      settle_time_s: roundTo(Number(raw['settle_time_s'] ?? 0), 1),
      stable: raw['stable'],
      ...(raw['resting'] === undefined ? {} : { resting: tidyNumbers(raw['resting']) }),
      contact_forces_N: forces,
      ...fell,
      ...tail,
    };
  }
  if (name === 'remove') {
    return { accepted: true, item_id: raw['item_id'], ...fell, ...tail };
  }
  if (name === 'reset') {
    return { accepted: true, removed: raw['removed'], ...tail };
  }
  if (name === 'set_rack') {
    return { accepted: true, ...fell, ...tail };
  }
  // start_cycle: the frozen load is the scene state (get_state still answers), so the
  // manifest is not repeated here.
  const leftOut = (raw['left_out'] ?? []) as string[];
  return {
    accepted: true,
    job_id: raw['job_id'],
    programme: raw['programme'],
    phase: state.phase,
    prechecks: shapeLoadCheck(raw['prechecks']),
    ...(Array.isArray(leftOut) && leftOut.length > 0 ? { left_out: leftOut } : {}),
    ...tail,
  };
}

/** The mechanical check, with its list of shifted items as a table. */
export function shapeLoadCheck(body: unknown): unknown {
  const raw = tidyNumbers(body) as { [key: string]: unknown } | null;
  if (raw === null || typeof raw !== 'object') return raw;
  const shifted = raw['shifted'];
  if (!Array.isArray(shifted)) return raw;
  return {
    ...(raw['accepted'] === undefined ? {} : { accepted: raw['accepted'] }),
    ...raw,
    shifted: {
      columns: ['item_id', 'displacement_mm', 'rotation_deg', 'pushed_by'],
      rows: (
        shifted as {
          item_id: string;
          displacement_mm: number;
          rotation_deg: number;
          pushed_by?: readonly string[];
        }[]
      ).map((entry) => [
        entry.item_id,
        entry.displacement_mm,
        entry.rotation_deg,
        (entry.pushed_by ?? []).join(', '),
      ]),
    },
  };
}

/** `preview`: the verdict on the pose, without the request repeated. */
export function shapePreview(body: unknown): unknown {
  const raw = tidyNumbers(body) as { [key: string]: unknown } | null;
  if (raw === null || typeof raw !== 'object' || raw['accepted'] !== true) return raw;
  const lowered = raw['lowered_pose'] as { position_mm: number[] } | null | undefined;
  const colliding = (raw['colliding_with'] ?? []) as string[];
  return {
    accepted: true,
    collision_free: raw['collision_free'],
    ...(Number(raw['penetration_mm'] ?? 0) > 0 ? { penetration_mm: raw['penetration_mm'] } : {}),
    ...(colliding.length > 0 ? { colliding_with: colliding } : {}),
    insertable: raw['insertable'],
    ...(raw['blocked_by'] === undefined ? {} : { blocked_by: raw['blocked_by'] }),
    ...(raw['blocked_above_mm'] === undefined ? {} : { blocked_above_mm: raw['blocked_above_mm'] }),
    in_bounds: raw['in_bounds'],
    lowered_position_mm:
      lowered === null || lowered === undefined
        ? null
        : lowered.position_mm.map((x) => roundTo(x, 1)),
  };
}

// ---------------------------------------------------------------------------------------------
// The level card
// ---------------------------------------------------------------------------------------------

/** A named orientation of an item: its quaternion and what it means in words. */
export interface PresetCard {
  readonly quat_wxyz: readonly number[];
  readonly description?: string;
}

/** What every piece of one kind has in common. */
export interface ItemTypeCard {
  readonly class: string;
  readonly display_name: string;
  readonly material: string;
  readonly mass_kg: number;
  readonly bbox_mm: readonly number[];
  readonly reference_point_mm: readonly number[];
  readonly dims: { readonly [name: string]: number };
  /**
   * The orientation presets of the kind: the name of a preset of the card's
   * `orientation_presets`, or the preset in full where this kind means something else by
   * the name.
   */
  readonly orientation_presets: readonly (string | ({ readonly name: string } & PresetCard))[];
}

/** One soil of an item, with its regions as a map from region to the share covered. */
function shapeSoil(soil: ItemRecord['soils'][number]): unknown {
  const regions: { [region: string]: number } = {};
  for (const entry of soil.regions) regions[entry.region] = roundTo(entry.coverage, 3);
  return {
    description: soil.description,
    type: soil.type,
    regions,
    amount_g: roundTo(soil.amount_g, 2),
    age_h: roundTo(soil.age_h, 1),
    heat_history: soil.heat_history,
  };
}

function presetOf(preset: ItemRecord['orientation_presets'][number]): PresetCard {
  return {
    quat_wxyz: preset.quat_wxyz.map((x) => roundTo(x, 4)),
    ...(preset.description === undefined ? {} : { description: preset.description }),
  };
}

/**
 * The items of a level card with everything said once. `orientation_presets` maps the name
 * of a preset to its quaternion and meaning (the meaning most kinds give the name);
 * `item_types` maps a type name to what its pieces share (class, size, reference point, the
 * names of its presets); and `items` says of every item its type, its soils and its points,
 * pieces that agree in all three sharing one entry (`item_ids`). The type name is the
 * item's class, with a number added where a level has two kinds of one class.
 */
export function shapeItems(records: readonly ItemRecord[]): {
  orientation_presets: { [name: string]: PresetCard };
  item_types: { [type: string]: ItemTypeCard };
  items: unknown[];
} {
  // The kinds of the level: records that differ in nothing but id, soils and points.
  const kinds = new Map<string, { name: string; record: ItemRecord }>();
  const perClass = new Map<string, number>();
  const kindOf = (record: ItemRecord): string => {
    const key = JSON.stringify(
      tidyNumbers([
        record.class,
        record.display_name,
        record.material,
        record.mass_kg,
        record.bbox_mm,
        record.reference_point_mm,
        record.dims,
        record.orientation_presets,
      ]),
    );
    let kind = kinds.get(key);
    if (kind === undefined) {
      const n = (perClass.get(record.class) ?? 0) + 1;
      perClass.set(record.class, n);
      kind = { name: n === 1 ? record.class : `${record.class}_${n}`, record };
      kinds.set(key, kind);
    }
    return kind.name;
  };
  // Pieces of one kind with the same soil and the same points are one entry naming them all.
  const items: { item_ids: string[]; type: string; points: number; soils: unknown[] }[] = [];
  const entryOf = new Map<string, number>();
  for (const record of records) {
    const type = kindOf(record);
    const soils = record.soils.map(shapeSoil);
    const key = JSON.stringify([type, record.points, soils]);
    const known = entryOf.get(key);
    if (known === undefined) {
      entryOf.set(key, items.length);
      items.push({ item_ids: [record.item_id], type, points: record.points, soils });
    } else {
      items[known]?.item_ids.push(record.item_id);
    }
  }
  // A preset name means, in the card, what most kinds mean by it.
  const votes = new Map<string, Map<string, number>>();
  for (const { record } of kinds.values()) {
    for (const preset of record.orientation_presets) {
      const byMeaning = votes.get(preset.name) ?? new Map<string, number>();
      const meaning = JSON.stringify(presetOf(preset));
      byMeaning.set(meaning, (byMeaning.get(meaning) ?? 0) + 1);
      votes.set(preset.name, byMeaning);
    }
  }
  const shared: { [name: string]: PresetCard } = {};
  const sharedText = new Map<string, string>();
  for (const [name, byMeaning] of votes) {
    let best = '';
    let most = 0;
    for (const [meaning, count] of byMeaning) {
      if (count > most) {
        best = meaning;
        most = count;
      }
    }
    shared[name] = JSON.parse(best) as PresetCard;
    sharedText.set(name, best);
  }
  const types: { [type: string]: ItemTypeCard } = {};
  for (const { name, record } of kinds.values()) {
    types[name] = {
      class: record.class,
      display_name: record.display_name,
      material: record.material,
      mass_kg: roundTo(record.mass_kg, 3),
      bbox_mm: record.bbox_mm.map((x) => roundTo(x, 1)),
      reference_point_mm: record.reference_point_mm.map((x) => roundTo(x, 1)),
      dims: tidyNumbers(record.dims) as { [name: string]: number },
      orientation_presets: record.orientation_presets.map((preset) => {
        const mine = presetOf(preset);
        return JSON.stringify(mine) === sharedText.get(preset.name)
          ? preset.name
          : { name: preset.name, ...mine };
      }),
    };
  }
  return { orientation_presets: shared, item_types: types, items };
}

/** The level card as `get_level` returns it. */
export function shapeLevel(card: LevelCard, options: { rules?: boolean } = {}): unknown {
  const { items, rules, manual, ...rest } = card;
  const shaped = shapeItems(items);
  return {
    ...(tidyNumbers(rest) as object),
    items_total: items.length,
    points_total: items.reduce((sum, item) => sum + item.points, 0),
    orientation_presets: shaped.orientation_presets,
    item_types: shaped.item_types,
    items: shaped.items,
    ...(options.rules === false ? {} : { rules, manual }),
  };
}

/** One item's record as `get_item` returns it: whole, with its soils in the card's form. */
export function shapeItemRecord(record: ItemRecord & { thumbnails?: unknown }): unknown {
  const { soils, ...rest } = record;
  return { ...(tidyNumbers(rest) as object), soils: soils.map(shapeSoil) };
}

// ---------------------------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------------------------

/** Places a `list_slots` answer shows unless `limit` says otherwise. */
export const SLOTS_DEFAULT_LIMIT = 12;
/** Most places one `list_slots` answer shows. */
export const SLOTS_MAX_LIMIT = 30;

/** Which part of a slot list is asked for. */
export interface SlotsPage {
  readonly offset?: number;
  readonly limit?: number;
  /** Only the places or slots of this tine row. */
  readonly row?: string;
}

/** The columns of the table of slots (a `list_slots` answer without an item), in order. */
export const SLOT_COLUMNS = ['id', 'kind', 'centre_mm', 'width_mm', 'size_mm'] as const;

/** The columns of the table of suggested places (a `list_slots` answer for an item), in order. */
export const PLACE_COLUMNS = ['slot', 'position_mm', 'orientation', 'drop_free', 'note'] as const;

function slotRow(slot: SlotCard): unknown[] {
  return [
    slot.id,
    slot.kind,
    slot.centre_mm.map((x) => roundTo(x, 1)),
    roundTo(slot.width_mm, 1),
    slot.size_mm === undefined ? null : slot.size_mm.map((x) => roundTo(x, 1)),
  ];
}

/**
 * The name of a place: its slot, or for the two slots of a pair of rows that are one place
 * both rows before the slot they share (`tine_row_r1+tine_row_r2.slot_05`).
 */
export function placeName(slots: readonly string[]): string {
  const parts = slots.map((slot) => {
    const dot = slot.lastIndexOf('.');
    return dot < 0 ? { row: slot, slot: '' } : { row: slot.slice(0, dot), slot: slot.slice(dot) };
  });
  const first = parts[0];
  if (first !== undefined && parts.length > 1 && parts.every((part) => part.slot === first.slot)) {
    return `${parts.map((part) => part.row).join('+')}${first.slot}`;
  }
  return slots.join('+');
}

/**
 * A `list_slots` answer as this server returns it.
 *
 * With an item: the suggested places for it, most useful first (free and seating, then free
 * above the tine tips, then not free), `limit` of them from `offset`, each ready to pass to
 * `place`; the counts say how many there are in all.
 *
 * Without an item: the tine rows of the basket (a short table) and its slots as geometry,
 * `limit` of them from `offset`, with how many there are of each kind.
 */
export function shapeSlots(
  body: unknown,
  args: { readonly item_id?: string },
  page: SlotsPage = {},
): unknown {
  const raw = body as ListSlotsResult | null;
  if (raw === null || typeof raw !== 'object' || raw.accepted !== true) return tidyNumbers(body);
  const offset = Math.max(0, Math.floor(page.offset ?? 0));
  const limit = Math.min(
    SLOTS_MAX_LIMIT,
    Math.max(1, Math.floor(page.limit ?? SLOTS_DEFAULT_LIMIT)),
  );
  if (args.item_id !== undefined) {
    const advice = slotAdvice(raw.slots);
    const places =
      page.row === undefined
        ? advice.places
        : advice.places.filter((place) => place.rows.includes(page.row as string));
    const shown = places.slice(offset, offset + limit);
    return {
      accepted: true,
      rack: raw.rack,
      item_id: args.item_id,
      ...(page.row === undefined ? {} : { row: page.row }),
      places_total: places.length,
      free_seated: places.filter((place) => place.free && place.seats).length,
      free_above_tines: places.filter((place) => place.free && !place.seats).length,
      not_free: places.filter((place) => !place.free).length,
      offset,
      places: {
        columns: PLACE_COLUMNS,
        rows: shown.map((place) => [
          placeName(place.slots),
          place.position_mm,
          place.orientation,
          place.free,
          // What is to be known of the place beyond free or not, in the words of the contract.
          !place.free
            ? `drop_blocked_by ${place.blocked_by.join(', ')}`
            : place.perches
              ? 'drop_perches: too deep for the gap, would sit on the tine tips'
              : !place.seats
                ? 'drop_seats false: above the tine tips'
                : '',
        ]),
      },
      ...(offset + shown.length < places.length ? { next_offset: offset + shown.length } : {}),
      ...(places.length === 0
        ? {
            note: 'No suggested place for this item in this basket: it goes wherever a pose is free (render with grid shows where; preview tests a pose).',
          }
        : {}),
    };
  }
  const slots =
    page.row === undefined ? raw.slots : raw.slots.filter((slot) => slot.tine_row === page.row);
  const kinds: { [kind: string]: number } = {};
  for (const slot of slots) kinds[slot.kind] = (kinds[slot.kind] ?? 0) + 1;
  const shown = slots.slice(offset, offset + limit);
  return {
    accepted: true,
    rack: raw.rack,
    ...(page.row === undefined ? {} : { row: page.row }),
    tine_rows: {
      columns: [
        'id',
        'start_mm',
        'end_mm',
        'tines',
        'pitch_mm',
        'height_mm',
        'lean_deg',
        'lean_toward',
        'folded',
        'partner',
      ],
      rows: raw.tine_rows.map((row) => [
        row.id,
        row.start_mm.map((x) => roundTo(x, 1)),
        row.end_mm.map((x) => roundTo(x, 1)),
        row.count,
        roundTo(row.pitch_mm, 1),
        roundTo(row.height_mm, 1),
        roundTo(row.lean_deg, 1),
        row.lean_toward,
        row.folded,
        row.partner?.id ?? null,
      ]),
    },
    slots_total: slots.length,
    slots_by_kind: kinds,
    offset,
    slots: { columns: SLOT_COLUMNS, rows: shown.map(slotRow) },
    ...(offset + shown.length < slots.length ? { next_offset: offset + shown.length } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// A client's own copy of the load
// ---------------------------------------------------------------------------------------------

function parseBudget(text: unknown): [number, number] | null {
  if (typeof text !== 'string') return null;
  const match = /^(\d+)\/(\d+)$/.exec(text);
  return match === null ? null : [Number(match[1]), Number(match[2])];
}

/**
 * A client's own copy of the scene state, kept from the results of the tools alone: the
 * whole state when a result carries it (`get_state` of the whole, an action of a client not
 * yet given the whole scene) and the `changes` of every action after that. What it holds is what `get_state` would return
 * ({@link LoadTracker.state}); the tests of this package hold the two to be equal after long
 * sequences of calls.
 *
 * The standard harness keeps one, so that when it shortens a conversation it can say what
 * the load is without asking the game.
 */
export class LoadTracker {
  private hash = '';
  private phase = '';
  private racks: { [rack: string]: string } = {};
  private options: { [option: string]: string } = {};
  private placed = new Map<string, LoadItem>();
  private unplaced = new Set<string>();
  private budget: { actions: string; queries: string; washes: string } = {
    actions: '',
    queries: '',
    washes: '',
  };
  private whole = false;

  /** True once a whole state has been seen: before that the copy is not a state. */
  get complete(): boolean {
    return this.whole;
  }

  /** A copy of this copy. */
  clone(): LoadTracker {
    const copy = new LoadTracker();
    copy.hash = this.hash;
    copy.phase = this.phase;
    copy.racks = { ...this.racks };
    copy.options = { ...this.options };
    copy.placed = new Map(this.placed);
    copy.unplaced = new Set(this.unplaced);
    copy.budget = { ...this.budget };
    copy.whole = this.whole;
    return copy;
  }

  private takeBudget(budget: unknown): void {
    if (typeof budget !== 'object' || budget === null) return;
    const given = budget as ShapedBudget;
    if (parseBudget(given.actions) !== null) this.budget.actions = given.actions as string;
    if (parseBudget(given.queries) !== null) this.budget.queries = given.queries as string;
    if (parseBudget(given.washes) !== null) this.budget.washes = given.washes as string;
  }

  private takeState(state: ShapedState): void {
    const rows = state.placed.rows.map(itemOfRow);
    if (state.part === undefined) {
      this.placed = new Map(rows.map((item) => [item.item_id, item]));
      this.unplaced = new Set(state.unplaced ?? []);
      this.whole = true;
    } else {
      // A part of the state: what it lists is as it says, and what it should have listed
      // and does not is no longer there.
      const listed = new Set(rows.map((item) => item.item_id));
      const rack = state.part.rack;
      const asked = state.part.items === undefined ? null : new Set(state.part.items);
      for (const [id, item] of this.placed) {
        const inPart =
          (rack === undefined || item.location === rack || item.frame === rack) &&
          (asked === null || asked.has(id));
        if (inPart && !listed.has(id)) this.placed.delete(id);
      }
      for (const item of rows) {
        this.placed.set(item.item_id, item);
        this.unplaced.delete(item.item_id);
      }
      for (const id of state.unplaced ?? []) {
        this.placed.delete(id);
        this.unplaced.add(id);
      }
    }
    this.hash = state.state_hash;
    this.phase = state.phase;
    this.racks = { ...state.racks };
    this.options = { ...state.rack_options };
    this.takeBudget(state.budget);
  }

  /**
   * Takes in the structured result of a tool call. A refused call and a result that says
   * nothing about the scene change nothing.
   */
  apply(tool: string, result: unknown): void {
    if (typeof result !== 'object' || result === null) return;
    const given = result as { [key: string]: unknown };
    if (given['accepted'] === false) return;
    if (tool === 'get_state') {
      if (typeof given['placed'] === 'object' && given['placed'] !== null) {
        this.takeState(given as unknown as ShapedState);
      }
      return;
    }
    if (typeof given['state'] === 'object' && given['state'] !== null) {
      this.takeState(given['state'] as ShapedState);
    }
    const changes = given['changes'] as ShapedChanges | undefined;
    if (typeof changes === 'object' && changes !== null) {
      for (const entry of changes.items ?? []) {
        const { moved_mm: _moved, turned_deg: _turned, ...item } = entry;
        this.placed.set(item.item_id, item);
        this.unplaced.delete(item.item_id);
      }
      for (const id of changes.to_counter ?? []) {
        this.placed.delete(id);
        this.unplaced.add(id);
      }
      Object.assign(this.racks, changes.racks ?? {});
      Object.assign(this.options, changes.rack_options ?? {});
      if (changes.phase !== undefined) this.phase = changes.phase;
    }
    if (typeof given['state_hash'] === 'string') this.hash = given['state_hash'];
    this.takeBudget(given['budget']);
  }

  /** The copy as `get_state` returns the whole state. */
  state(): ShapedState {
    const items = [...this.placed.values()].sort((a, b) => compareIds(a.item_id, b.item_id));
    return {
      state_hash: this.hash,
      phase: this.phase,
      racks: { ...this.racks },
      rack_options: { ...this.options },
      placed: { columns: PLACED_COLUMNS, rows: items.map(rowOf) },
      placed_total: items.length,
      unplaced: [...this.unplaced].sort(compareIds),
      budget: { ...this.budget },
    };
  }
}
