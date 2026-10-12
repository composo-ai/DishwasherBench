/**
 * Checks of a saved standard load that need the load back in a session: whether both baskets
 * can be pulled out and pushed in again (a load that cannot be unloaded is not a real load),
 * and whether every recorded mistake is what the settled poses show.
 *
 * The load is rebuilt by applying the accepted actions of its log, up to but not including
 * `start_cycle`, to a fresh session of its level with the budgets lifted (the extra basket
 * moves of the check are not part of the load).
 */

import type { PlacedItemState } from '@spotless/session';
import { applyLoggedEvent, createSession } from '@spotless/session';
import type { ItemView } from './families.ts';
import { viewOf } from './families.ts';
import type { MistakeMade, SettledLoad } from './mistakes.ts';
import { mistakeHolds } from './mistakes.ts';
import type { PostureFinding } from './posture.ts';
import { postureFindings } from './posture.ts';
import type { StandardLoad } from './standard-loads.ts';

/** One basket move of the travel check. */
export interface TravelStep {
  readonly rack: string;
  readonly position: 'in' | 'out';
  readonly accepted: boolean;
  /** What stopped the basket, when it was stopped. */
  readonly blocked_by: readonly string[];
  /** Items the move carried further than 45 mm or turned by more than 25 degrees. */
  readonly thrown: readonly string[];
  /**
   * Items the move carried further than 5 mm or turned by more than 10 degrees, the thrown
   * ones included: more than the knock of the stop (2 mm for an item standing free) explains.
   */
  readonly shifted: readonly string[];
}

/** One recorded mistake read against the rebuilt load. */
export interface MistakeAudit {
  readonly mistake: MistakeMade;
  readonly holds: boolean;
  /** Why it does not hold, when it does not. */
  readonly why: string | null;
}

/** The result of {@link auditStandardLoad}. */
export interface LoadAudit {
  readonly name: string;
  /** True when the log's accepted actions rebuilt a scene with the items of the load in it. */
  readonly rebuilt: boolean;
  readonly travel: readonly TravelStep[];
  /** True when both baskets went out and in again. */
  readonly baskets_travel: boolean;
  readonly mistakes: readonly MistakeAudit[];
  /** True when every recorded mistake is what the settled load shows. */
  readonly mistakes_hold: boolean;
  /**
   * Non-cutlery items that touch another item, with what they touch. In a careful load these
   * are glasses, cups, bowls and pots leaning lightly on a neighbour; see `laid_over` and
   * `plates_touching` for what a careful load must not have.
   */
  readonly touching: readonly { readonly item_id: string; readonly with: readonly string[] }[];
  /**
   * Non-cutlery items that touch other items and no part of a basket: they lie on the load,
   * not in the machine. A careful load has none.
   */
  readonly laid_over: readonly string[];
  /** Plates, boards and other flat pieces that touch another item. A careful load has none. */
  readonly plates_touching: readonly string[];
  /**
   * Plates leaning against the tines of their row and vessels leaning far over with no tine
   * to hold them (`postureFindings`). A careful load has none.
   */
  readonly posture: readonly PostureFinding[];
  /**
   * The most items any one basket move shifted (further than 5 mm or 10 degrees), and how far
   * the worst of them went over the whole check, millimetres and degrees.
   */
  readonly shifted_most: number;
  readonly shifted_worst: {
    readonly item_id: string;
    readonly mm: number;
    readonly deg: number;
  } | null;
}

function axisOf(
  q: readonly [number, number, number, number],
  long: boolean,
): [number, number, number] {
  const [w, x, y, z] = q;
  // The item's x axis (its length) or z axis (its opening, its face) in the frame of the pose.
  return long
    ? [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)]
    : [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
}

function thrownBetween(
  before: readonly PlacedItemState[],
  after: readonly PlacedItemState[],
  views: ReadonlyMap<string, ItemView>,
): {
  thrown: string[];
  shifted: string[];
  worst: { item_id: string; mm: number; deg: number } | null;
} {
  const was = new Map(before.map((item) => [item.item_id, item]));
  const out: string[] = [];
  const shifted: string[] = [];
  let worst: { item_id: string; mm: number; deg: number } | null = null;
  for (const item of after) {
    const old = was.get(item.item_id);
    if (old === undefined || old.frame !== item.frame) continue;
    const family = views.get(item.item_id)?.family;
    const long = family === 'cutlery' || family === 'utensil';
    const a = axisOf(old.quat_wxyz, long);
    const b = axisOf(item.quat_wxyz, long);
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const turned = (Math.acos(dot) * 180) / Math.PI;
    const moved = Math.hypot(
      item.position_mm[0] - old.position_mm[0],
      item.position_mm[1] - old.position_mm[1],
      item.position_mm[2] - old.position_mm[2],
    );
    if (moved > 45 || turned > (item.frame === 'cutlery_basket' ? 40 : 25)) out.push(item.item_id);
    if (moved > 5 || turned > 10) {
      shifted.push(item.item_id);
      if (worst === null || moved / 5 + turned / 10 > worst.mm / 5 + worst.deg / 10) {
        worst = {
          item_id: item.item_id,
          mm: Math.round(moved * 10) / 10,
          deg: Math.round(turned * 10) / 10,
        };
      }
    }
  }
  return { thrown: out, shifted, worst };
}

/**
 * Rebuilds a saved load in a session and checks that its baskets travel and that its recorded
 * mistakes hold. Nothing is written; the session is disposed.
 */
export async function auditStandardLoad(load: StandardLoad): Promise<LoadAudit> {
  const level = {
    ...load.level,
    rules: { ...load.level.rules, actionsMax: 1_000_000, queriesMax: 1_000_000 },
  };
  const session = await createSession({ level });
  try {
    // Every logged call up to the cycle, queries and refused actions included: a mechanical
    // check or a refused action puts the world back to the same poses, but what follows them
    // is only the same to the last bit when they are made again (seen on 2026-10-10: with
    // them left out, a bowl nested in another by the careless policy fell out in the rebuild).
    for (const event of load.action_log) {
      if (event.name === 'start_cycle') continue;
      applyLoggedEvent(session, event);
    }
    const card = session.getLevel();
    const views = new Map<string, ItemView>(card.items.map((item) => [item.item_id, viewOf(item)]));
    const state = session.getState();
    const inMachine = new Set(state.placed.map((item) => item.item_id));
    const rebuilt =
      load.wash_manifest.items.every((item) => inMachine.has(item.item_id)) &&
      inMachine.size >= load.wash_manifest.items.length;

    // The mistakes, read against the load as it stands before the cycle.
    const envelopes = new Map<string, readonly [number, number, number]>();
    for (const rack of card.machine.racks) envelopes.set(rack.rack, rack.envelope_mm);
    const settled: SettledLoad = {
      placed: new Map(state.placed.map((item) => [item.item_id, item])),
      views,
      envelopes,
      check: load.check,
    };
    const mistakes: MistakeAudit[] = load.mistakes.map((mistake) => {
      const why = mistakeHolds(mistake, settled);
      return { mistake, holds: why === null, why };
    });
    const touching: { item_id: string; with: string[] }[] = [];
    const laidOver: string[] = [];
    const platesTouching: string[] = [];
    for (const item of state.placed) {
      if (item.frame === 'cutlery_basket') continue;
      const others = item.contacts
        .map((contact) => contact.with)
        .filter((id) => inMachine.has(id) && settled.placed.get(id)?.frame !== 'cutlery_basket');
      if (others.length === 0) continue;
      touching.push({ item_id: item.item_id, with: others });
      if (item.contacts.every((contact) => inMachine.has(contact.with)))
        laidOver.push(item.item_id);
      const flat = (id: string): boolean => views.get(id)?.family === 'flat';
      if (flat(item.item_id) || others.some(flat)) platesTouching.push(item.item_id);
    }

    const posture = postureFindings(state.placed, views, session.machineGeometry());

    // Each basket out and in again.
    const travel: TravelStep[] = [];
    let shiftedMost = 0;
    let shiftedWorst: { item_id: string; mm: number; deg: number } | null = null;
    const racks = card.machine.racks
      .map((rack) => rack.rack)
      .filter((rack) => rack === 'lower_rack' || rack === 'upper_rack');
    for (const rack of racks) {
      for (const other of racks) {
        if (other !== rack && session.getState().racks[other] === 'out') {
          session.setRack({ rack: other, option: { name: 'position', value: 'in' } });
        }
      }
      const moves: ('in' | 'out')[] =
        session.getState().racks[rack] === 'out' ? ['in', 'out', 'in'] : ['out', 'in'];
      for (const position of moves) {
        const before = session.getState().placed;
        const result = session.setRack({ rack, option: { name: 'position', value: position } });
        const moved = result.accepted
          ? thrownBetween(before, result.state.placed, views)
          : { thrown: [], shifted: [], worst: null };
        shiftedMost = Math.max(shiftedMost, moved.shifted.length);
        if (
          moved.worst !== null &&
          (shiftedWorst === null ||
            moved.worst.mm / 5 + moved.worst.deg / 10 > shiftedWorst.mm / 5 + shiftedWorst.deg / 10)
        ) {
          shiftedWorst = moved.worst;
        }
        travel.push({
          rack,
          position,
          accepted: result.accepted,
          blocked_by: result.accepted ? [] : [...(result.blocked_by ?? [])],
          thrown: moved.thrown,
          shifted: moved.shifted,
        });
      }
    }
    return {
      name: load.name,
      rebuilt,
      travel,
      baskets_travel: travel.every((step) => step.accepted),
      mistakes,
      mistakes_hold: mistakes.every((entry) => entry.holds),
      touching,
      laid_over: laidOver,
      plates_touching: platesTouching,
      posture,
      shifted_most: shiftedMost,
      shifted_worst: shiftedWorst,
    };
  } finally {
    session.dispose();
  }
}
