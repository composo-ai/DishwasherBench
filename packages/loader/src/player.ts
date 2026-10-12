/**
 * The player a policy plays through: a thin wrapper round a session that only ever calls what a
 * player can call (`place`, `remove`, `set_rack`, `preview`, `list_slots`, `check_load`,
 * `get_state`, `get_level`), keeps count of what it did, and offers the small pieces of
 * geometry every policy needs (which way an item points after it has settled, where a basket's
 * rows and slots are).
 *
 * Nothing here looks inside the session, and nothing depends on wall-clock time: the stopwatch
 * (`now`) only feeds the measurements of the policy result.
 */

import type { Quat, Vec3 } from '@spotless/core';
import { hashU32, quatRotate, u32ToUnitFloat } from '@spotless/core';
import type {
  CheckLoadResult,
  DropAccepted,
  DropResult,
  FrameId,
  ItemRecord,
  LevelCard,
  ListSlotsResult,
  PlaceRequest,
  PlacedItemState,
  PreviewRequest,
  PreviewResult,
  RackId,
  RemoveResult,
  SceneState,
  Session,
  SetRackResult,
  SlotCard,
  TineRowCard,
  WirePose,
} from '@spotless/session';

/** What a policy has done so far, by the count. */
export interface PlayerStats {
  /** `place` calls made, accepted or not. */
  placeCalls: number;
  /** `place` calls the session accepted (each costs one action). */
  placeAccepted: number;
  /** Rejections of `place` by reason. */
  placeRejected: { [reason: string]: number };
  /** `remove` calls accepted. */
  removes: number;
  /** `set_rack` calls accepted. */
  rackMoves: number;
  /** `preview` calls answered. */
  previews: number;
  /** `check_load` calls answered. */
  checks: number;
  /** Items taken out again because they ended unstable, fallen or badly placed. */
  retries: number;
  /** Wall-clock milliseconds spent inside accepted `place` calls (a measurement only). */
  placeMs: number[];
  /** Wall-clock milliseconds spent inside `check_load` calls. */
  checkMs: number[];
  /** Wall-clock milliseconds spent inside accepted `set_rack` calls. */
  rackMs: number[];
}

/** A stream of random numbers that depends only on a seed and on how many were drawn. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform whole number in [0, n). */
  int(n: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** One element of a non-empty list. */
  pick<T>(list: readonly T[]): T;
  /** The list in a random order (a new array). */
  shuffle<T>(list: readonly T[]): T[];
}

/** A deterministic random stream from the counter-based generator of `@spotless/core`. */
export function makeRng(seed: number, stream: number): Rng {
  let counter = 0;
  const next = (): number => u32ToUnitFloat(hashU32(seed >>> 0, stream >>> 0, counter++));
  const int = (n: number): number => Math.min(n - 1, Math.floor(next() * n));
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: <T>(list: readonly T[]): T => list[int(list.length)] as T,
    shuffle: <T>(list: readonly T[]): T[] => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const t = out[i] as T;
        out[i] = out[j] as T;
        out[j] = t;
      }
      return out;
    },
  };
}

/** The quaternion of a wire pose in the engine's order `[x, y, z, w]`. */
export function wireQuat(pose: WirePose): Quat {
  const [w, x, y, z] = pose.quat_wxyz;
  return [x, y, z, w];
}

/** Where an item-frame direction points at a wire pose, in the pose's frame. */
export function axisAt(pose: WirePose, axis: Vec3): Vec3 {
  return quatRotate(wireQuat(pose), axis);
}

/** Angle between two unit vectors, degrees. */
export function angleDeg(a: Vec3, b: Vec3): number {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

/**
 * The preset offsets that turn the `+z` axis of an item, as its `on_edge`-like preset has it
 * (a preset made by turning the item 90 degrees about x, so that `+z` points to `-y`), to a
 * wanted direction: `roll` tips it up or down, `yaw` turns it about the vertical.
 */
export function edgeOffsetsFor(normal: Vec3): { roll_deg: number; yaw_deg: number } {
  const nz = Math.max(-1, Math.min(1, normal[2]));
  return {
    roll_deg: Math.round((-Math.asin(nz) * 180) / Math.PI) + 0,
    yaw_deg: Math.round((Math.atan2(normal[0], -normal[1]) * 180) / Math.PI) + 0,
  };
}

/** A basket's rows and slots as `list_slots` gave them. */
export interface RackSlots {
  readonly rows: readonly TineRowCard[];
  readonly slots: readonly SlotCard[];
}

/** The player: a session seen through the calls a player has, with counters. */
export class Player {
  readonly session: Session;
  readonly card: LevelCard;
  readonly items: ReadonlyMap<string, ItemRecord>;
  readonly stats: PlayerStats = {
    placeCalls: 0,
    placeAccepted: 0,
    placeRejected: {},
    removes: 0,
    rackMoves: 0,
    previews: 0,
    checks: 0,
    retries: 0,
    placeMs: [],
    checkMs: [],
    rackMs: [],
  };
  private state: SceneState;
  private readonly slotCache = new Map<RackId, RackSlots>();
  private readonly dropCache = new Map<string, readonly SlotCard[]>();
  private dropCacheState = '';
  private readonly now: () => number;

  /**
   * @param session the session to play
   * @param now a stopwatch in milliseconds, used only for the measurements in `stats`
   */
  constructor(session: Session, now: () => number = () => 0) {
    this.session = session;
    this.now = now;
    this.card = session.getLevel();
    this.items = new Map(this.card.items.map((item) => [item.item_id, item]));
    this.state = session.getState();
  }

  /** The scene as the last action or query returned it. */
  scene(): SceneState {
    return this.state;
  }

  /** Asks for the scene again (one query). */
  refresh(): SceneState {
    this.state = this.session.getState();
    return this.state;
  }

  /** Actions still allowed by the level's budget. */
  actionsLeft(): number {
    return this.state.budget.actions_max - this.state.budget.actions_used;
  }

  /** Queries still allowed by the level's budget. */
  queriesLeft(): number {
    return this.state.budget.queries_max - this.state.budget.queries_used;
  }

  /** True when the item is in the machine. */
  isPlaced(itemId: string): boolean {
    return this.state.placed.some((p) => p.item_id === itemId);
  }

  /** The state of a placed item, or undefined. */
  placed(itemId: string): PlacedItemState | undefined {
    return this.state.placed.find((p) => p.item_id === itemId);
  }

  /** The record of an item of the level. Throws for an unknown id (a programmer error). */
  item(itemId: string): ItemRecord {
    const record = this.items.get(itemId);
    if (record === undefined) throw new RangeError(`loader: no item '${itemId}' in the level`);
    return record;
  }

  /** `place`. */
  place(request: PlaceRequest): DropResult {
    const started = this.now();
    const result = this.session.place(request);
    this.stats.placeCalls += 1;
    if (result.accepted) {
      this.stats.placeAccepted += 1;
      this.stats.placeMs.push(this.now() - started);
      this.state = result.state;
    } else {
      this.stats.placeRejected[result.reason] = (this.stats.placeRejected[result.reason] ?? 0) + 1;
    }
    return result;
  }

  /** `remove`. */
  remove(itemId: string): RemoveResult {
    const result = this.session.remove({ item_id: itemId });
    if (result.accepted) {
      this.stats.removes += 1;
      this.state = result.state;
    }
    return result;
  }

  /** `set_rack`. A change of a row or shelf invalidates the cached slots of that basket. */
  setRack(rack: RackId, name: string, value: string): SetRackResult {
    const started = this.now();
    const result = this.session.setRack({ rack, option: { name, value } });
    if (result.accepted) {
      this.stats.rackMoves += 1;
      this.stats.rackMs.push(this.now() - started);
      this.state = result.state;
      if (name !== 'position') {
        this.slotCache.delete(rack);
        for (const key of [...this.dropCache.keys()]) {
          if (key.startsWith(`${rack}|`)) this.dropCache.delete(key);
        }
      }
    }
    return result;
  }

  /** Whether a basket is pulled out. */
  isOut(rack: RackId): boolean {
    return this.state.racks[rack] === 'out';
  }

  /** Pushes a basket in or pulls it out if it is not there already; true when it is there. */
  moveRack(rack: RackId, position: 'in' | 'out'): boolean {
    if (this.state.racks[rack] === undefined) return false;
    if (this.state.racks[rack] === position) return true;
    return this.setRack(rack, 'position', position).accepted;
  }

  /** `preview` (one query when answered). */
  preview(request: PreviewRequest): PreviewResult {
    const result = this.session.preview(request);
    if (result.accepted) this.stats.previews += 1;
    return result;
  }

  /** `check_load` (one query when answered). */
  checkLoad(): CheckLoadResult {
    const started = this.now();
    const result = this.session.checkLoad();
    if (result.accepted) {
      this.stats.checks += 1;
      this.stats.checkMs.push(this.now() - started);
    }
    return result;
  }

  /** The rows and slots of a basket (one query the first time, cached afterwards). */
  slots(rack: RackId): RackSlots {
    const cached = this.slotCache.get(rack);
    if (cached !== undefined) return cached;
    const result: ListSlotsResult = this.session.listSlots({ rack });
    const slots: RackSlots = result.accepted
      ? { rows: result.tine_rows, slots: result.slots }
      : { rows: [], slots: [] };
    this.slotCache.set(rack, slots);
    return slots;
  }

  /**
   * The slots of a basket with `suggested_drop` filled in for an item: where `list_slots` says
   * to let that item go so that it stands in each slot between tines (or in each cell of the
   * cutlery basket), and whether that pose is free as the scene is now. One query per kind of
   * item, basket and state of the scene: the suggestions follow what stands in the basket.
   */
  slotsFor(rack: RackId, itemId: string): readonly SlotCard[] {
    const record = this.item(itemId);
    const key = `${rack}|${record.display_name}|${record.bbox_mm.join('x')}`;
    if (this.dropCacheState !== this.state.state_hash) {
      this.dropCache.clear();
      this.dropCacheState = this.state.state_hash;
    }
    const cached = this.dropCache.get(key);
    if (cached !== undefined) return cached;
    const result: ListSlotsResult = this.session.listSlots({ rack, item_id: itemId });
    const slots = result.accepted ? result.slots.filter((s) => s.suggested_drop !== undefined) : [];
    this.dropCache.set(key, slots);
    return slots;
  }

  /** Current value of an adjustable option of a basket (`'up'`, `'folded'`, `'1'`, ...). */
  option(rack: RackId, name: string): string | undefined {
    return this.state.rack_options[`${rack}.${name}`];
  }

  /** Size of a rack's loading envelope, millimetres, from the level card. */
  envelope(rack: RackId): readonly [number, number, number] {
    return this.card.machine.racks.find((r) => r.rack === rack)?.envelope_mm ?? [0, 0, 0];
  }

  /** True when the machine has this rack. */
  hasRack(rack: RackId): boolean {
    return this.card.machine.racks.some((r) => r.rack === rack);
  }
}

/** What became of an accepted placement, in the terms a policy judges it by. */
export interface Outcome {
  readonly result: DropAccepted;
  /** Angle between where the item's `+z` axis points now and where it was asked to, degrees. */
  readonly axisTurnDeg: number;
  /** Where the item's `+z` axis points now, in the frame it was placed in. */
  readonly axis: Vec3;
  /** Largest displacement of another item, millimetres (0 when none moved). */
  readonly disturbedMm: number;
  /** Largest rotation of another item, degrees. */
  readonly disturbedDeg: number;
}

/** Reads an accepted placement into an {@link Outcome}. */
export function outcomeOf(result: DropAccepted): Outcome {
  const wanted = axisAt(result.requested_pose, [0, 0, 1]);
  const axis = axisAt(result.settled_pose, [0, 0, 1]);
  let disturbedMm = 0;
  let disturbedDeg = 0;
  for (const moved of result.moved_items) {
    disturbedMm = Math.max(disturbedMm, moved.displacement_mm);
    disturbedDeg = Math.max(disturbedDeg, moved.rotation_deg);
  }
  return { result, axisTurnDeg: angleDeg(wanted, axis), axis, disturbedMm, disturbedDeg };
}

/** A frame a policy places in. */
export type LoadFrame = Exclude<FrameId, 'tub'>;
