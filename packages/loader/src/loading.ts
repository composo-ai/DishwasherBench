/**
 * Loading a dishwasher the way a person does, basket by basket and family by family, played
 * through the session. One procedure serves two policies:
 *
 *  - careful: the manufacturer's scheme for the machine and the guidance the dossiers support
 *    (docs/research/machine-bosch-smv4hax40g.md, standards.md section 8, items.md section
 *    10.3). Boards, trays and platters on edge at the side walls of the lower basket. Plates
 *    seated where `list_slots` says (the pose a hand seats a plate in, free as the basket
 *    stands now): the large shallow ones in the rear rows, where they lie back with the tines;
 *    the deep ones in the wide gaps of the side rows, where they stand upright, and in the
 *    rear rows (tipped forward, the machine engineer's pattern for them) only when no other
 *    seat is left, which the load then says; the small ones wherever a seat remains. Pots and
 *    large bowls mouth down over the tines: before the small plates when seats are plentiful,
 *    after them when the plates need every seat. Cutlery in the cells of the cutlery basket
 *    where `list_slots` finds room for its lower end, and pushed down into the bunch when a
 *    cell is crowded. In the upper basket small plates and saucers in the short rows (the knife
 *    shelf folded up when they are worth more than the utensils it would carry), small bowls
 *    tipped forward between the tall tines, cups and mugs on the cup shelves, long utensils on
 *    the knife shelf, and glasses, cups, mugs and bowls mouth down wherever the floor lets
 *    them stand, asked with `preview` before anything is let go. What found no room above and
 *    may go below gets a second chance in the lower basket.
 *    Nothing is kept that fell over, hangs through the floor, rests on a part that is not a
 *    basket, or lies on other items. A plate touches nothing but its basket. A glass, a cup,
 *    a bowl or a pot may lean lightly on a neighbour (under {@link LEAN_SHARE} of its weight,
 *    the basket carrying the rest), as in every loaded machine. At the end both baskets are
 *    pulled out and pushed in once more: what that throws, and what stops a basket, an arm,
 *    the tablet or the door, is taken out and given one more go elsewhere.
 *  - careless: the careful load first, in the same session, and then the common mistakes of the
 *    phenomena checklist (standards.md section 9) made on a seeded choice of its items: plates
 *    turned to the wall or pushed into a neighbour's seat, cups stood mouth up or laid on their
 *    side, bowls laid flat or into one another, a spoon laid into another, a small plate laid
 *    over what stands beside it, a cup put in the tablet's way, a knife stood on end in the
 *    upper basket. Every mistake is made with an item of the careful load: nothing is added
 *    from the counter, so that the pair holds the same items and differs only in the mistakes
 *    (an item whose mistake did not hold goes back where it stood). A mistake is recorded for
 *    what the physics left, not for what was intended (`mistakes.ts`).
 *
 * Every placement is judged by what the session reports after it settled. Nothing is known
 * here that a player does not know: the level card, `list_slots`, `preview`, and what each
 * call returns.
 */

import type { Vec3 } from '@spotless/core';
import type {
  DropResult,
  LoadCheck,
  Orientation,
  PlaceRequest,
  PlacedItemState,
  SceneState,
  SlotCard,
  WirePose,
} from '@spotless/session';
import type { ItemView } from './families.ts';
import { viewOf } from './families.ts';
import type { MistakeKind, MistakeMade, SettledLoad } from './mistakes.ts';
import {
  facesAway,
  hollowAttitude,
  hollowMistakeOf,
  mistakeHolds,
  mouthUpDeg,
  neighboursOf,
} from './mistakes.ts';
import type { Lane, SeatMemory, SeatOutcome } from './placing.ts';
import { dropAt, dropHeights, edgeShapeOf, lanesOf, rememberSeat, seatOnEdge } from './placing.ts';
import type { LoadFrame, Outcome, Player, Rng } from './player.ts';
import { angleDeg, axisAt, outcomeOf } from './player.ts';

export { MISTAKE_KINDS } from './mistakes.ts';
export type { MistakeKind, MistakeMade } from './mistakes.ts';

/** How a load is put together. */
export interface LoadingStyle {
  readonly policy: 'careful' | 'careless';
  /** Free distance kept between neighbouring items in plan, millimetres. */
  readonly gap: number;
  /** The mistakes to make after the careful load (empty for the careful policy). */
  readonly mistakes: ReadonlySet<MistakeKind>;
  /** Share of the eligible items that get a mistake of a kind (at least one does). */
  readonly mistakeRate: number;
}

/** Why an offered item is not in the machine at the end. */
export interface LeftOut {
  readonly item_id: string;
  readonly reason: string;
}

/** What {@link Loading.run} leaves behind besides the session's own state. */
export interface LoadingReport {
  readonly placed: readonly string[];
  readonly leftOut: readonly LeftOut[];
  readonly mistakes: readonly MistakeMade[];
  /** The last `check_load` the policy saw, or null if it never asked. */
  readonly check: LoadCheck | null;
  /** Things worth telling whoever reads the load, in words. */
  readonly notes: readonly string[];
}

/** An axis-aligned box in the plan of a basket, millimetres. */
interface PlanBox {
  readonly id: string;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

type Rack = 'lower_rack' | 'upper_rack';

/** Actions kept back for moving the baskets and for taking things out at the end. */
const ACTION_RESERVE = 10;
/**
 * Actions that must be left (beyond the reserve) before an item is taken out for a mistake: the
 * take-out, up to four tries of the mistake with their removals, and the way back if none
 * holds (three tries, and two more for another slot). With fewer left the item stays where the
 * careful load put it.
 */
const MISTAKE_ACTIONS = 20;

const DEG = Math.PI / 180;

/** A plate leaning further than this from the vertical has fallen over, degrees. */
const MAX_PLATE_LEAN = 30;
/** A plate turned further than this about the vertical stands askew in its slot, degrees. */
const MAX_PLATE_YAW = 15;
/** A glass or cup put in mouth down may lean this far, degrees. */
const MAX_VESSEL_LEAN = 25;
/** A tall glass leaning on a row may lean this far, degrees. */
const MAX_STEM_LEAN = 45;
/**
 * A cup, mug or glass set on a sloped side rest may end this far from where `list_slots` said
 * to let it go, in plan, millimetres: it slides a centimetre or two down the rest as it
 * settles; further, and it has left the rest. [ESTIMATED from the seats of the catalogue's
 * vessels: 0.2 to 12 mm, `packages/session/src/rests.test.ts`]
 */
const REST_SLIDE = 35;
/** Clearance kept under a shelf that is to be folded down over what stands on a rest, mm. */
const UNDER_SHELF_CLEAR = 6;
/**
 * How far the turned bounding box of a vessel leaning on a side rest may reach beyond the plan
 * of the basket, millimetres. The box of a leaning cup overstates its reach by its upper
 * corner, where the cup is narrowest: a tea cup leaning 25 degrees against the wall wires
 * stands wholly inside the basket (`check_load` lists nothing protruding) with its box 11 mm
 * outside. What really sticks out is taken out by the checks at the end. [MEASURED 2026-10-11]
 */
const REST_BOX_SLACK = 15;
/**
 * Largest plan dimension of what is stood on a cup shelf, millimetres: the shelves are about
 * 100 mm wide, and a mug with its handle reaches a little over the edge.
 */
const SHELF_ITEM_MAX = 125;
/** A glass, pot or box lying further than this from mouth down is taken out again, degrees. */
const MAX_TIPPED = 50;
/** How far one move of a basket may carry an item before it counts as thrown, millimetres. */
const THROWN_MM = 45;
/** How far one move of a basket may turn an item's axis before it counts as thrown, degrees. */
const THROWN_DEG = 25;
/**
 * How far below the top of the base grid the lowest point of an item on the floor of the upper
 * basket may be, millimetres: the floor is not flat, and a rim sinks between its wires.
 * [ESTIMATED from where glasses and mugs come to stand]
 */
const FLOOR_DIP = 16;
/** Step of the search over the floor of the upper basket, millimetres. */
const FLOOR_STEP = 22;
/** Longest utensil that is stood in the cutlery basket when the knife shelf is full, mm. */
const UTENSIL_IN_BASKET_MAX = 306;
/**
 * Share of its weight that a glass, a bowl or a pot may put on a neighbour it leans against
 * and still count as carefully placed. [ESTIMATED: a lean, not a load]
 */
const LEAN_SHARE = 0.3;

/** The loading procedure of the careful and the careless policy. */
export class Loading {
  private readonly player: Player;
  private readonly style: LoadingStyle;
  private readonly rng: Rng;
  private readonly offered: readonly ItemView[];
  private readonly views = new Map<string, ItemView>();
  private readonly boxes = new Map<LoadFrame, PlanBox[]>();
  private readonly memory: SeatMemory = new Map();
  private readonly leftOut = new Map<string, string>();
  private readonly lastReason = new Map<string, string>();
  /** The request that put each item where it is, and the slot it was put in, if any. */
  private readonly kept = new Map<string, { request: PlaceRequest; slot: SlotCard | null }>();
  private readonly sequence = new Map<string, number>();
  private readonly notes: string[] = [];
  private readonly usedSlots = new Map<Rack, Vec3[]>();
  private readonly badSlots = new Set<string>();
  private readonly badRows = new Set<string>();
  private readonly badSpots = new Map<string, [number, number][]>();
  private readonly goodColumns = new Map<string, number[]>();
  private readonly kindFails = new Map<string, number>();
  /** Pairs of items that were accepted leaning lightly on one another (ids sorted, joined). */
  private readonly lightPairs = new Set<string>();
  /** Where the first piece of each kind of cutlery was let down into each cell. */
  private readonly cellDrops = new Map<string, Map<string, SlotCard['suggested_drop']>>();
  private readonly tentative: MistakeMade[] = [];
  private lastCheck: LoadCheck | null = null;
  private lastRequest: PlaceRequest | null = null;
  private outOfBudget = false;
  private placements = 0;
  private cutleryRounds = 0;
  /** While the mistakes are made: nothing of the careful rules applies. */
  private careless = false;
  /** Where an item stood (its settled pose) when it was last taken out. */
  private readonly stood = new Map<
    string,
    {
      readonly frame: LoadFrame;
      readonly position_mm: readonly [number, number, number];
      readonly quat_wxyz: readonly [number, number, number, number];
    }
  >();

  /** Receives one line per placement that was judged; for watching a policy work. */
  trace: ((line: string) => void) | null = null;

  constructor(player: Player, style: LoadingStyle, rng: Rng, offered: readonly string[]) {
    this.player = player;
    this.style = style;
    this.rng = rng;
    this.offered = offered
      .filter((id) => player.items.has(id))
      .map((id) => viewOf(player.item(id)));
    for (const view of this.offered) this.views.set(view.id, view);
  }

  // -------------------------------------------------------------------------------------------
  // Bookkeeping
  // -------------------------------------------------------------------------------------------

  private pending(filter: (view: ItemView) => boolean): ItemView[] {
    return this.offered.filter(
      (view) => filter(view) && !this.player.isPlaced(view.id) && !this.leftOut.has(view.id),
    );
  }

  /** Offered items that are not in the machine, whatever the reason. */
  private onCounter(filter: (view: ItemView) => boolean): ItemView[] {
    return this.offered.filter((view) => filter(view) && !this.player.isPlaced(view.id));
  }

  /** Most points first; of equal points the larger first, then in the order of the offer. */
  private byValue(list: readonly ItemView[]): ItemView[] {
    return [...list].sort(
      (a, b) =>
        b.record.points - a.record.points ||
        b.size[0] - a.size[0] ||
        this.offered.indexOf(a) - this.offered.indexOf(b),
    );
  }

  private canAct(needed = 2): boolean {
    if (this.player.actionsLeft() >= needed + ACTION_RESERVE) return true;
    if (!this.outOfBudget) {
      this.outOfBudget = true;
      this.notes.push('the action budget ran out before every item had been tried');
    }
    return false;
  }

  private boxesOf(frame: LoadFrame): PlanBox[] {
    let list = this.boxes.get(frame);
    if (list === undefined) {
      list = [];
      this.boxes.set(frame, list);
    }
    return list;
  }

  private forget(itemId: string): void {
    for (const list of this.boxes.values()) {
      const at = list.findIndex((box) => box.id === itemId);
      if (at >= 0) list.splice(at, 1);
    }
    this.kept.delete(itemId);
    this.underKnifeShelf.delete(itemId);
  }

  /** Takes an item out and forgets where it stood; true when the session took it. */
  private takeOut(itemId: string, reason: string | null): boolean {
    // For a mistake (no reason given, careless phase) only with the actions to put it back.
    if (
      this.careless &&
      reason === null &&
      this.player.actionsLeft() < MISTAKE_ACTIONS + ACTION_RESERVE
    ) {
      return false;
    }
    const stands = this.player.placed(itemId);
    if (stands !== undefined) {
      this.stood.set(itemId, {
        frame: stands.frame as LoadFrame,
        position_mm: stands.position_mm,
        quat_wxyz: stands.quat_wxyz,
      });
    }
    if (!this.player.remove(itemId).accepted) return false;
    const entry = this.kept.get(itemId);
    const view = this.views.get(itemId);
    if (entry !== undefined && view !== undefined && reason !== null) {
      const kind = view.record.display_name;
      if (entry.slot !== null) this.badSlots.add(`${kind}|${entry.request.frame}|${entry.slot.id}`);
      else if ('preset' in entry.request.orientation) {
        const [x, y] = entry.request.position_mm;
        this.markBadSpot(`${kind}|${entry.request.orientation.preset}`, x, y);
      }
    }
    this.forget(itemId);
    if (reason !== null) this.leftOut.set(itemId, reason);
    return true;
  }

  /** The plan box of a settled item: the bounding box of its turned bounding box. */
  private settledBox(view: ItemView, pose: WirePose, thin: number | null): PlanBox {
    const half: [number, number] = [this.halfExtent(view, pose, 0), this.halfExtent(view, pose, 1)];
    if (thin !== null) {
      // An item on edge is counted thin along the way it faces, so that plates nest.
      const face = axisAt(pose, [0, 0, 1]);
      if (Math.abs(face[0]) >= Math.abs(face[1])) half[0] = Math.min(half[0], thin);
      else half[1] = Math.min(half[1], thin);
    }
    const [x, y] = pose.position_mm;
    return { id: view.id, x0: x - half[0], x1: x + half[0], y0: y - half[1], y1: y + half[1] };
  }

  private isFree(
    frame: LoadFrame,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    gap = this.style.gap,
    onShelf: string | null = null,
    over: ReadonlySet<string> | null = null,
  ): boolean {
    // On a shelf only what stands on that shelf is in the way; `over` are items that stand
    // under what is being placed (on the rest under the knife shelf) and are not in its way.
    const boxes =
      onShelf === null ? this.boxesOf(frame) : this.shelfBoxes.filter((box) => box.id === onShelf);
    for (const box of boxes) {
      if (over?.has(box.id) === true) continue;
      if (x0 - gap < box.x1 && x1 + gap > box.x0 && y0 - gap < box.y1 && y1 + gap > box.y0) {
        return false;
      }
    }
    return true;
  }

  /** `place`, remembering the request so that a kept item can be put back the same way. */
  private place(request: PlaceRequest): DropResult {
    this.lastRequest = request;
    return this.player.place(request);
  }

  private drop(
    itemId: string,
    frame: LoadFrame,
    x: number,
    y: number,
    orientation: Orientation,
    heights: readonly number[],
  ): DropResult {
    // Ask first (`preview` is what a player does before letting go), place only what is free.
    let last: DropResult = { accepted: false, reason: 'collision_at_pose' };
    for (const z of heights) {
      const request = { item_id: itemId, frame, position_mm: [x, y, z] as Vec3, orientation };
      const asked = this.player.preview(request);
      if (asked.accepted && !asked.collision_free) {
        last = { accepted: false, reason: 'collision_at_pose' };
        continue;
      }
      if (asked.accepted && !asked.insertable) {
        return {
          accepted: false,
          reason: asked.in_bounds ? 'not_insertable' : 'out_of_bounds',
          ...(asked.blocked_by === undefined ? {} : { blocked_by: asked.blocked_by }),
        };
      }
      if (asked.accepted && !asked.in_bounds) return { accepted: false, reason: 'out_of_bounds' };
      last = this.place(request);
      if (last.accepted || last.reason !== 'collision_at_pose') return last;
    }
    return last;
  }

  /**
   * Plays attempts one after another until one gives an outcome the judge accepts. An accepted
   * placement that the judge refuses is taken out again. Returns the outcome kept, or null.
   */
  private settle(
    view: ItemView,
    frame: LoadFrame,
    attempts: Iterable<() => DropResult | Outcome | null>,
    judge: (outcome: Outcome) => string | null,
    options: { readonly maxBad?: number; readonly thin?: number | null } = {},
  ): Outcome | null {
    const maxBad = options.maxBad ?? 2;
    let bad = 0;
    let why = 'no free place was found';
    const rejected = new Map<string, number>();
    for (const attempt of attempts) {
      if (!this.canAct()) {
        why = 'the action budget ran out';
        break;
      }
      this.lastRequest = null;
      const got = attempt();
      if (got === null) continue;
      let outcome: Outcome;
      if ('axisTurnDeg' in got) outcome = got;
      else if (got.accepted) outcome = outcomeOf(got);
      else {
        const what = `${got.reason}${got.blocked_by === undefined ? '' : ` by ${got.blocked_by}`}`;
        rejected.set(what, (rejected.get(what) ?? 0) + 1);
        if (got.reason === 'budget_exhausted') {
          why = 'the action budget ran out';
          break;
        }
        continue;
      }
      const refused = judge(outcome);
      if (this.trace !== null) {
        const r = outcome.result;
        this.trace(
          `${view.id} in ${frame}: ${refused ?? 'kept'}; asked ${r.requested_pose.position_mm.map((v) => Math.round(v)).join(',')} settled ${r.settled_pose.position_mm.map((v) => Math.round(v)).join(',')} turned ${outcome.axisTurnDeg.toFixed(0)} deg, stable ${r.stable}, disturbed ${outcome.disturbedMm.toFixed(1)} mm; touches ${r.contacts.map((c) => c.with).join(' ')}`,
        );
      }
      if (refused === null) {
        this.boxesOf(frame).push(
          this.settledBox(view, outcome.result.settled_pose, options.thin ?? null),
        );
        const request: PlaceRequest = this.lastRequest ?? {
          item_id: view.id,
          frame,
          position_mm: outcome.result.requested_pose.position_mm,
          orientation: { quat_wxyz: outcome.result.requested_pose.quat_wxyz },
        };
        this.kept.set(view.id, { request, slot: null });
        this.sequence.set(view.id, this.placements++);
        this.leftOut.delete(view.id);
        return outcome;
      }
      this.player.remove(view.id);
      this.player.stats.retries += 1;
      why = refused;
      bad += 1;
      if (bad > maxBad) break;
    }
    if (this.trace !== null) {
      this.trace(
        `${view.id} in ${frame}: given up (${why}); rejections: ${[...rejected].map(([k, n]) => `${n} ${k}`).join(', ') || 'none'}`,
      );
    }
    this.lastReason.set(view.id, why);
    return null;
  }

  private giveUp(view: ItemView, fallback: string): void {
    if (this.player.isPlaced(view.id)) return;
    this.leftOut.set(view.id, this.lastReason.get(view.id) ?? fallback);
  }

  /**
   * Moves a basket in or out. What stops it is taken out and the move tried again. Returns
   * true when the basket is where it was asked to be.
   */
  private travel(rack: Rack, position: 'in' | 'out'): boolean {
    if (!this.player.hasRack(rack)) return false;
    for (let round = 0; round < 6; round++) {
      if (this.player.scene().racks[rack] === position) return true;
      if (position === 'out') {
        const other: Rack = rack === 'lower_rack' ? 'upper_rack' : 'lower_rack';
        if (this.player.hasRack(other) && this.player.isOut(other) && !this.travel(other, 'in')) {
          return false;
        }
      }
      const result = this.player.setRack(rack, 'position', position);
      if (result.accepted) return true;
      const blockers = ('blocked_by' in result ? (result.blocked_by ?? []) : []).filter((id) =>
        this.player.isPlaced(id),
      );
      if (blockers.length === 0) return false;
      for (const id of blockers) {
        if (!this.takeOut(id, 'taken out again: it stopped the basket from sliding')) return false;
      }
    }
    return false;
  }

  /** Clear height above a basket's base grid for its load, millimetres. */
  private clearHeight(rack: Rack): number {
    // The envelope of the card reaches to the basket above or to the roof. Under the circle
    // the spray arm above sweeps (a wide disc: most of the basket) less is clear, and a careful
    // loader keeps under that everywhere; the small discs (the hub, the roof sprayer) are left
    // to `check_load`.
    const card = this.player.card.machine.racks.find((r) => r.rack === rack);
    const wide = (card?.low_spots ?? [])
      .filter((spot) => spot.radius_mm > 100)
      .map((spot) => spot.clear_height_mm);
    return Math.min(this.player.envelope(rack)[2], ...wide) - 4;
  }

  /** How far a settled item reaches beyond the plan of its basket, millimetres (0 inside). */
  private beyondPlan(view: ItemView, pose: WirePose, rack: Rack): number {
    const [width, depth] = this.player.envelope(rack);
    const box = this.settledBox(view, pose, null);
    return Math.max(0, -box.x0, box.x1 - width, -box.y0, box.y1 - depth);
  }

  /** Height of the top of a settled item above the base grid, millimetres. */
  private topOf(view: ItemView, pose: WirePose): number {
    return pose.position_mm[2] + this.halfExtent(view, pose, 2);
  }

  /**
   * Half the extent of a settled item along a frame axis, millimetres: of its turned bounding
   * box, or of the cylinder round its axis when it is round (a turned box overstates a disc).
   */
  private halfExtent(view: ItemView, pose: WirePose, along: 0 | 1 | 2): number {
    const x = Math.abs(axisAt(pose, [1, 0, 0])[along]);
    const y = Math.abs(axisAt(pose, [0, 1, 0])[along]);
    const z = Math.abs(axisAt(pose, [0, 0, 1])[along]);
    const [sx, sy, sz] = view.size;
    if (Math.abs(sx - sy) <= 2) return (sx / 2) * Math.hypot(x, y) + (sz / 2) * z;
    return (sx / 2) * x + (sy / 2) * y + (sz / 2) * z;
  }

  // -------------------------------------------------------------------------------------------
  // Judges
  // -------------------------------------------------------------------------------------------

  /** What every kept placement must be: in the basket, at rest, and not having shoved others. */
  private common(outcome: Outcome): string | null {
    const r = outcome.result;
    if (r.fell_out) return 'it fell out of the basket';
    if (r.fell_through) return 'it fell through the basket';
    if (r.returned.length > 0) return 'something ended on the kitchen floor';
    if (!r.stable) return 'it did not come to a stable rest';
    const limit = this.careless ? 25 : 4;
    if (outcome.disturbedMm > limit || (!this.careless && outcome.disturbedDeg > 12)) {
      return 'it pushed its neighbours';
    }
    return null;
  }

  /** The other items a freshly placed item touches. */
  private touched(outcome: Outcome): string[] {
    return [...new Set(outcome.result.contacts.map((c) => c.with))].filter((id) =>
      this.player.items.has(id),
    );
  }

  /**
   * What a careful loader does not rest an item on: another item, the cutlery basket, the
   * tablet tray, or a part that does not belong to a basket (the feed tube of the upper arm
   * runs under the floor of the upper basket; what rests on it through the wires stops the
   * basket from sliding).
   */
  private restsBadly(outcome: Outcome, frame: LoadFrame, besideBasket = false): string | null {
    if (this.careless) return null;
    const others = this.touched(outcome);
    if (others.length > 0) {
      // A glass, a cup, a bowl or a pot may lean on its neighbour, as in every loaded machine:
      // while the basket carries it and the neighbour takes only a small share of its weight.
      // Anything that lies on other items, and any plate that touches one, is refused.
      const id = outcome.result.item_id;
      const view = this.views.get(id);
      const leans =
        view !== undefined &&
        (view.family === 'vessel' ||
          view.family === 'stemware' ||
          view.family === 'bowl' ||
          view.family === 'cookware' ||
          view.family === 'small');
      const weight = (view?.record.mass_kg ?? 0) * 9.81;
      let onItems = 0;
      let onBasket = 0;
      for (const contact of outcome.result.contacts) {
        if (this.player.items.has(contact.with)) onItems += contact.normal_force_N ?? 0;
        else onBasket += contact.normal_force_N ?? 0;
      }
      const partnersLean = others.every((other) => {
        const family = this.views.get(other)?.family;
        return family !== 'flat' && family !== 'cutlery' && family !== 'utensil';
      });
      // Bowls in a row lie against one another like tiles, each standing on the basket.
      const tiled =
        view?.family === 'bowl' &&
        others.every((other) => this.views.get(other)?.family === 'bowl');
      const share = tiled ? 2 * LEAN_SHARE : LEAN_SHARE;
      if (!leans || !partnersLean || onItems > share * weight || onBasket < (1 - share) * weight) {
        return `it rests against ${others[0]}`;
      }
      for (const other of others) this.lightPairs.add([id, other].sort().join('|'));
    }
    for (const contact of outcome.result.contacts) {
      // (Contacts with other items were judged above.)
      if (this.player.items.has(contact.with)) continue;
      const part = contact.with.split('.')[0] ?? '';
      if (part === 'cutlery_basket') {
        if (frame !== 'cutlery_basket' && !besideBasket) return 'it rests on the cutlery basket';
        continue;
      }
      if (part.endsWith('tablet_tray')) return 'it rests on the tablet tray';
      if (part.startsWith('lower_rack') || part.startsWith('upper_rack')) continue;
      return `it rests on ${part.replace(/_/g, ' ')}, which is no part of a basket`;
    }
    return null;
  }

  /** How a settled plate stands in the slot it was let down into. */
  private standing(
    slot: SlotCard,
    outcome: Outcome,
  ): { turnedRound: boolean; yaw: number; lean: number; withTines: number | null } {
    const pn = slot.plate_normal ?? [1, 0, 0];
    const h = Math.hypot(pn[0], pn[1]) || 1;
    const u: [number, number] = [pn[0] / h, pn[1] / h];
    const n = outcome.axis;
    const wanted = axisAt(outcome.result.requested_pose, [0, 0, 1]);
    const nAlong = n[0] * u[0] + n[1] * u[1];
    const wAlong = wanted[0] * u[0] + wanted[1] * u[1];
    const across = Math.abs(-n[0] * u[1] + n[1] * u[0]);
    const tilt = (Math.asin(Math.max(-1, Math.min(1, n[2]))) / DEG) * Math.sign(nAlong || 1);
    const tineSign = (slot.lean_deg ?? 0) === 0 ? 0 : Math.sign(pn[2]);
    return {
      turnedRound: nAlong * wAlong <= 0,
      yaw: Math.atan2(across, Math.abs(nAlong)) / DEG,
      lean: Math.abs(tilt),
      withTines: tineSign === 0 ? null : tilt * tineSign,
    };
  }

  /**
   * Kinds of item and kinds of seat (row, way of leaning, width) in which the kind has been
   * seen to come to rest leaning against the tines: a deep plate between narrow tines cannot
   * lean back with them. Such seats are passed over while a seat is looked for in which the
   * item leans with its row, and used when there is none.
   */
  private readonly againstIn = new Set<string>();
  /** While true, a plate that leans against the tines of its row is kept. */
  private allowAgainst = false;

  private leanKey(view: ItemView, rack: Rack, slot: SlotCard): string {
    const sign = Math.sign(slot.plate_normal?.[2] ?? 0);
    return `${view.record.display_name}|${rack}|${slot.tine_row ?? ''}|${sign}|${Math.round(slot.width_mm)}`;
  }

  /** Height at which a disc on edge sits on the two rails of a slot's row, millimetres. */
  private seatHeight(view: ItemView, rack: Rack, slot: SlotCard): number | null {
    const row = this.player.slots(rack).rows.find((r) => r.id === slot.tine_row);
    if (row === undefined || row.partner === undefined || view.outline !== 'disc') return null;
    const half = row.partner.spacing_mm / 2;
    const radius = view.size[0] / 2;
    if (radius <= half) return null;
    const partner = this.player.slots(rack).rows.find((r) => r.id === row.partner?.id);
    const railZ = Math.max(row.start_mm[2], partner?.start_mm[2] ?? row.start_mm[2]);
    return railZ + Math.sqrt(radius * radius - half * half) + 2;
  }

  private judgeSeat(view: ItemView, rack: Rack, slot: SlotCard, outcome: Outcome): string | null {
    const refused = this.common(outcome) ?? this.restsBadly(outcome, rack);
    if (refused !== null) return refused;
    const pose = outcome.result.settled_pose;
    const stands = this.standing(slot, outcome);
    if (stands.turnedRound) return 'it turned round in its slot';
    if (stands.lean > MAX_PLATE_LEAN) return 'it fell over between the tines';
    if (stands.yaw > MAX_PLATE_YAW) return 'it stands askew in its slot';
    // (Upright within a few degrees is how a deep plate stands in the wide gaps of the side
    // rows: that is its seat. Tipped forward onto the tine in front of its face is not.)
    if (!this.careless && stands.withTines !== null && stands.withTines < -6) {
      // A bowl on edge is meant to tip forward, its opening down. A deep plate does so between
      // the narrow tines of the rear rows (the machine engineer's pattern for it): such a seat
      // is taken only when no other is left, and the load says so.
      if (view.family !== 'bowl') {
        this.againstIn.add(this.leanKey(view, rack, slot));
        if (!this.allowAgainst) return 'it leans against the tines';
      }
    }
    if (view.family === 'bowl' && outcome.axis[2] > 0.2) return 'its opening is tilted up';
    const at = slot.suggested_drop?.position_mm ?? slot.centre_mm;
    if (Math.hypot(pose.position_mm[0] - at[0], pose.position_mm[1] - at[1]) > 70) {
      return 'it slid away from its slot';
    }
    const seat = this.seatHeight(view, rack, slot);
    // (A bowl is held higher than a plate: its body wedges between the tines.)
    const high = view.family === 'bowl' ? view.size[2] + 10 : 18;
    if (!this.careless && seat !== null && pose.position_mm[2] > seat + high) {
      return 'it sits on the tips of the tines';
    }
    return this.topOf(view, pose) > this.clearHeight(rack) + 4 ? 'it stands too high' : null;
  }

  // -------------------------------------------------------------------------------------------
  // Standing things on edge in the rows of tines
  // -------------------------------------------------------------------------------------------

  /**
   * The slots of a basket's rows for an item, each with the pose `list_slots` suggests letting
   * it go at, nearest the wall first (a plate leans outwards over the seats outside its own,
   * so a row is filled from the walls in); in the upper basket from the rear forwards.
   */
  private edgeSlots(
    view: ItemView,
    rack: Rack,
    rows: readonly string[] | null,
    fromCentre = false,
  ): SlotCard[] {
    const [width] = this.player.envelope(rack);
    const out: SlotCard[] = [];
    for (const slot of this.player.slotsFor(rack, view.id)) {
      if (rows !== null && !rows.includes(slot.tine_row ?? '')) continue;
      if (this.badRows.has(`${rack}|${slot.tine_row ?? ''}`)) continue;
      const at = slot.suggested_drop?.position_mm;
      if (at === undefined) continue;
      // A careful loader takes the seats that are free and in which the item comes down between
      // the tines; what only perches on their tips is no seat.
      if (!this.careless && (slot.drop_free !== true || slot.drop_seats === false)) continue;
      // Between upright tines much further apart than it is thick a plate only leans on one of
      // them, over the next seat: those rows are for bowls. (A lid of a few grams may lean
      // there.)
      if (
        !this.careless &&
        (slot.lean_deg ?? 0) === 0 &&
        slot.width_mm > view.size[2] + 10 &&
        view.record.mass_kg > 0.06
      ) {
        continue;
      }
      const twin = out.some((other) => {
        const o = other.suggested_drop?.position_mm ?? other.centre_mm;
        return Math.hypot(o[0] - at[0], o[1] - at[1]) < 6;
      });
      if (!twin) out.push(slot);
    }
    const alongX = (slot: SlotCard): boolean =>
      Math.abs(slot.plate_normal?.[0] ?? 1) >= Math.abs(slot.plate_normal?.[1] ?? 0);
    // One half of a row after the other, each from its wall inwards, so that plates of a kind
    // stand together; a plate that leans against its row (towards the centre) goes innermost.
    const key = (slot: SlotCard): number => {
      if (!alongX(slot)) return 1000 - slot.centre_mm[1];
      const x = slot.centre_mm[0];
      if (fromCentre) return Math.abs(x - width / 2);
      return x < width / 2 ? x : 2 * width - x;
    };
    return out.sort((a, b) => key(a) - key(b));
  }

  private isUsed(rack: Rack, slot: SlotCard): boolean {
    // Well spaced: the seats next to a taken one stay empty. So they do for a plate that will
    // lean against its row: its top comes towards its neighbour's.
    const near = (this.style.gap > 10 || this.allowAgainst) && !this.careless ? 30 : 4;
    return (this.usedSlots.get(rack) ?? []).some(
      (c) => Math.hypot(c[0] - slot.centre_mm[0], c[1] - slot.centre_mm[1]) < near,
    );
  }

  /**
   * Stands an item on edge in the first of the given slots where it comes to stand as a plate
   * should. Returns true when it stands.
   */
  private seatEdge(view: ItemView, rack: Rack, slots: readonly SlotCard[], maxBad = 2): boolean {
    if (this.player.isPlaced(view.id)) return true;
    const kind = `${view.record.display_name}|${rack}|edge`;
    if ((this.kindFails.get(kind) ?? 0) >= 2) return false;
    const seated = this.seatEdgeEither(view, rack, slots, maxBad);
    if (seated) this.kindFails.delete(kind);
    else if ((this.lastReason.get(view.id) ?? '').startsWith('it ')) {
      // (Counted only when a placement was made and refused, not when no seat was free.)
      this.kindFails.set(kind, (this.kindFails.get(kind) ?? 0) + 1);
    }
    return seated;
  }

  private seatEdgeEither(
    view: ItemView,
    rack: Rack,
    slots: readonly SlotCard[],
    maxBad: number,
  ): boolean {
    if (this.seatEdgePass(view, rack, slots, maxBad, false)) return true;
    // No seat in which it leans with its row: one in which it leans against it.
    if (
      this.careless ||
      !slots.some((slot) => this.againstIn.has(this.leanKey(view, rack, slot)))
    ) {
      return false;
    }
    this.allowAgainst = true;
    try {
      const [width] = this.player.envelope(rack);
      const inner = [...slots].sort(
        (a, b) => Math.abs(a.centre_mm[0] - width / 2) - Math.abs(b.centre_mm[0] - width / 2),
      );
      return this.seatEdgePass(view, rack, inner, 2, true);
    } finally {
      this.allowAgainst = false;
    }
  }

  private seatEdgePass(
    view: ItemView,
    rack: Rack,
    slots: readonly SlotCard[],
    maxBad: number,
    against: boolean,
  ): boolean {
    const kind = view.record.display_name;
    let current: SlotCard | null = null;
    const attempts: (() => DropResult)[] = [];
    for (const slot of slots) {
      const drop = slot.suggested_drop;
      if (drop === undefined || this.isUsed(rack, slot)) continue;
      const known = this.againstIn.has(this.leanKey(view, rack, slot));
      if (known !== against && !this.careless) continue;
      if (!against && this.badSlots.has(`${kind}|${rack}|${slot.id}`)) continue;
      if (against && this.badSlots.has(`${kind}|${rack}|${slot.id}|against`)) continue;
      attempts.push(() => {
        current = slot;
        return this.place({
          item_id: view.id,
          frame: rack,
          position_mm: drop.position_mm,
          orientation: drop.orientation,
        });
      });
    }
    const shape = edgeShapeOf(view);
    const kept = this.settle(
      view,
      rack,
      attempts,
      (outcome) => {
        const slot = current as SlotCard | null;
        if (slot === null) return 'no slot';
        const refused = this.judgeSeat(view, rack, slot, outcome);
        if (refused !== null) {
          this.badSlots.add(`${kind}|${rack}|${slot.id}${against ? '|against' : ''}`);
          // A row whose seats rest on something that is no basket is no use to any plate.
          if (refused.includes('no part of a basket')) {
            this.badRows.add(`${rack}|${slot.tine_row ?? ''}`);
          }
        }
        return refused;
      },
      { thin: Math.max(6, Math.min(shape.depth / 2, 14)), maxBad },
    );
    const slot = current as SlotCard | null;
    if (kept === null || slot === null) return false;
    const used = this.usedSlots.get(rack) ?? [];
    used.push(slot.centre_mm);
    this.usedSlots.set(rack, used);
    const entry = this.kept.get(view.id);
    if (entry !== undefined) this.kept.set(view.id, { request: entry.request, slot });
    if (against) this.leansAgainst.push(view.id);
    return true;
  }

  /** Plates that stand leaning against their row: the only way its tines hold them. */
  private readonly leansAgainst: string[] = [];

  // -------------------------------------------------------------------------------------------
  // The lower basket
  // -------------------------------------------------------------------------------------------

  /** The lanes of the lower basket: the rear pair, and the side pairs left and right. */
  private lowerLanes(): { rear: Lane[]; left: Lane[]; right: Lane[] } {
    const lanes = lanesOf(this.player, 'lower_rack');
    const [width, depth] = this.player.envelope('lower_rack');
    const rear = lanes.filter((lane) => lane.railAxis === 0 && lane.centreAcross > depth / 2);
    const side = lanes.filter((lane) => !rear.includes(lane));
    const isLeft = (lane: Lane): boolean =>
      (lane.slots[0]?.along ?? 0) + (lane.slots[lane.slots.length - 1]?.along ?? 0) < width;
    return { rear, left: side.filter(isLeft), right: side.filter((lane) => !isLeft(lane)) };
  }

  private rowsOf(lanes: readonly Lane[]): string[] {
    return lanes.flatMap((lane) => lane.id.split('+'));
  }

  /** Whether a flat item is one of the large pieces that go at the sides. */
  private isSidePiece(view: ItemView): boolean {
    if (view.family === 'cookware') return view.record.class === 'frying_pan';
    if (view.family !== 'flat') return false;
    return view.outline === 'rect' ? view.size[0] > 200 : view.size[0] > 285;
  }

  /** Whether an item stands on edge in the rows of the lower basket. */
  private isLowerEdge(view: ItemView): boolean {
    if (view.edgePreset === null || view.upperOnly) return false;
    if (view.family === 'flat') return !this.isSidePiece(view);
    // (A large bowl, or one shallow enough to stand between two tines like a deep plate.)
    return view.family === 'bowl' && (view.size[0] >= 200 || view.size[2] <= 50);
  }

  /** Where the rails of a lane are across the basket. */
  private railsOf(lane: Lane): number[] {
    return lane.spacing === 0
      ? [lane.centreAcross]
      : [lane.centreAcross - lane.spacing / 2, lane.centreAcross + lane.spacing / 2];
  }

  /**
   * Stands the large flat pieces (boards, trays, tins, platters, frying pans) on edge along the
   * side walls of the lower basket, face to the centre, before anything else goes in: the
   * plates then start one seat further in.
   */
  private placeSidePieces(lanes: readonly Lane[], thick: boolean): void {
    // A thin piece takes one seat at the wall. A thick one (a frying pan with its handle, a
    // deep dish) takes the seats of half a dozen plates: it waits until the plates are in.
    const pieces = this.byValue(
      this.pending(
        (view) => this.isSidePiece(view) && view.edgePreset !== null && view.size[2] > 60 === thick,
      ),
    );
    if (pieces.length === 0 || lanes.length === 0) return;
    const [width, depth] = this.player.envelope('lower_rack');
    const clear = this.clearHeight('lower_rack');
    const railZ = Math.max(...lanes.map((lane) => lane.railZ));
    const rails = [...new Set(lanes.flatMap((lane) => this.railsOf(lane)))].sort((a, b) => a - b);
    const taken = { left: 0, right: 0 };
    for (const view of pieces) {
      const shape = edgeShapeOf(view);
      if (railZ + 2 * shape.halfUp + 4 > clear) {
        this.lastReason.set(view.id, 'it is too tall to stand on edge under the upper arm');
        continue;
      }
      if (2 * shape.halfAcross + 16 > depth) {
        this.leftOut.set(view.id, 'it is longer than the lower basket is deep');
        continue;
      }
      // A disc or an oval has a seat of its own in a row; a board stands across all of them.
      if (view.outline !== 'rect' && view.edgePreset === 'on_edge') {
        const order = taken.left <= taken.right ? ['left', 'right'] : ['right', 'left'];
        const slots = this.edgeSlots(view, 'lower_rack', null).sort((a, b) => {
          const side = (s: SlotCard): number =>
            order.indexOf(s.centre_mm[0] < width / 2 ? 'left' : 'right');
          return side(a) - side(b);
        });
        if (this.seatEdge(view, 'lower_rack', slots, 2)) {
          const at = this.player.placed(view.id)?.position_mm[0] ?? 0;
          taken[at < width / 2 ? 'left' : 'right'] += shape.depth + 16;
          continue;
        }
      }
      const across = Math.min(
        depth - shape.halfAcross - 10,
        Math.max(
          shape.halfAcross + 10,
          (rails[0] ?? 0) / 2 + (rails[rails.length - 1] ?? depth) / 2,
        ),
      );
      const inner = rails.filter((r) => Math.abs(r - across) < shape.halfAcross - 8);
      const below = inner.filter((r) => r <= across).pop();
      const above = inner.find((r) => r > across);
      const spacing =
        below !== undefined && above !== undefined
          ? 2 * Math.min(across - below, above - across)
          : 0;
      const sides: ('left' | 'right')[] =
        taken.left <= taken.right ? ['left', 'right'] : ['right', 'left'];
      const attempts: (() => Outcome | null)[] = [];
      for (const side of sides) {
        const lane =
          lanes.find(
            (l) =>
              l.railAxis === 0 &&
              l.slots.some((slot) => (side === 'left') === slot.along < width / 2) &&
              Math.abs(l.centreAcross - across) < shape.halfAcross,
          ) ?? lanes.find((l) => l.railAxis === 0);
        if (lane === undefined) continue;
        const outer = lane.slots.filter(
          (slot) => !slot.wide && (side === 'left') === slot.along < width / 2,
        );
        const slots = (side === 'left' ? outer : [...outer].reverse()).slice(0, 3);
        for (const slot of slots) {
          const face: -1 | 1 = slot.along < width / 2 ? 1 : -1;
          attempts.push(() =>
            seatOnEdge(
              this.player,
              view,
              { lane, slot, face, across, spacing, leanTo: -30, reach: 15 },
              this.memory,
            ),
          );
        }
      }
      const kept = this.settle(
        view,
        'lower_rack',
        attempts,
        (outcome) => {
          const refused = this.common(outcome) ?? this.restsBadly(outcome, 'lower_rack');
          if (refused !== null) return refused;
          if (outcome.axisTurnDeg > 30) return 'it fell over between the tines';
          if (outcome.result.displacement_mm > 60) return 'it slid away from the wall';
          return this.topOf(view, outcome.result.settled_pose) > clear + 4
            ? 'it stands too high'
            : null;
        },
        { thin: Math.max(8, shape.depth / 2), maxBad: 1 },
      );
      if (kept === null) {
        this.giveUp(view, 'no place at the side of the lower basket');
        continue;
      }
      if ('lean' in kept) rememberSeat(this.memory, kept as SeatOutcome);
      const x = kept.result.settled_pose.position_mm[0];
      taken[x < width / 2 ? 'left' : 'right'] += shape.depth + 16;
    }
  }

  /** The plan box of the cutlery basket in the lower basket's frame, if the machine has one. */
  private cutleryBasketBox(): PlanBox | null {
    const lower = this.player.card.machine.racks.find((r) => r.rack === 'lower_rack');
    const basket = this.player.card.machine.racks.find((r) => r.rack === 'cutlery_basket');
    if (lower === undefined || basket === undefined) return null;
    const x0 = basket.origin_in_mm[0] - lower.origin_in_mm[0];
    const y0 = basket.origin_in_mm[1] - lower.origin_in_mm[1];
    return {
      id: 'cutlery_basket',
      x0,
      x1: x0 + basket.envelope_mm[0],
      y0,
      y1: y0 + basket.envelope_mm[1],
    };
  }

  /** Pots, pans and tall vessels that go mouth down in the lower basket. */
  private isLowerHollow(view: ItemView): boolean {
    if (view.family === 'cookware') return true;
    if (view.upperOnly) return false;
    if (view.family === 'vessel') return view.size[2] > this.clearHeight('upper_rack') - 6;
    return false;
  }

  /**
   * One pot, pan or big bowl mouth down in the lower basket: on the tips of a side row pair if
   * one is given (its handle along the wall), otherwise wherever the plan is still free, the
   * opening turned to the centre. Returns true when it stands.
   */
  private placeCookware(view: ItemView, lane: Lane | null): boolean {
    const [width, depth] = this.player.envelope('lower_rack');
    const clear = this.clearHeight('lower_rack');
    const bowl = view.family === 'bowl';
    const tilted = bowl
      ? view.presets.has('inclined')
        ? 'inclined'
        : 'inverted_tilted'
      : view.presets.has('inverted_tilted')
        ? 'inverted_tilted'
        : 'inverted';
    if (!view.presets.has(tilted) && !view.presets.has('inverted')) {
      this.leftOut.set(view.id, 'it has no mouth-down orientation');
      return false;
    }
    if (view.size[2] + 12 > clear) {
      this.leftOut.set(view.id, 'it is too tall for the lower basket under the upper arm');
      return false;
    }
    const body = Math.min(view.size[0], view.size[1]);
    const half = body / 2;
    const heightsAt = (y: number): number[] =>
      dropHeights(this.player, 'lower_rack', y, view.size[2] / 2 + 30, view.longest / 2);
    const attempts: (() => DropResult)[] = [];
    if (lane !== null && view.presets.has('inverted') && !bowl) {
      const first = lane.slots[0];
      const last = lane.slots[lane.slots.length - 1];
      if (first !== undefined && last !== undefined) {
        const mid = (first.along + last.along) / 2;
        const y = lane.centreAcross;
        // The body over the rows, the handle (which makes the item longer along its x) to the
        // rear: the reference point is the middle of body and handle together.
        const reach = Math.max(0, (view.size[0] - view.size[1]) / 2);
        for (const dx of [0, 15, -15, 30, -30, 45, -45]) {
          const x = mid + dx;
          if (x - half < 6 || x + half > width - 6) continue;
          if (!this.isFree('lower_rack', x - half, x + half, y - half, y + half, 2)) continue;
          attempts.push(() =>
            this.drop(
              view.id,
              'lower_rack',
              x,
              y + reach,
              { preset: 'inverted', yaw_deg: 90 },
              heightsAt(y + reach),
            ),
          );
        }
      }
    }
    if (lane === null) {
      const spots: [number, number][] = [];
      for (let y = half + 12; y <= depth - half - 12; y += 30) {
        for (let x = half + 12; x <= width - half - 12; x += 30) spots.push([x, y]);
      }
      // Front corners first, then outwards from them.
      const score = ([x, y]: [number, number]): number =>
        y + 0.6 * Math.min(x, width - x) + (x > width / 2 ? 0 : 15);
      spots.sort((p, q) => score(p) - score(q));
      for (const [x, y] of spots) {
        if (!this.isFree('lower_rack', x - half, x + half, y - half, y + half)) continue;
        // Mouth turned to the middle of the basket; the handle then lies across.
        const toCentre = Math.round(Math.atan2(width / 2 - x, -(depth / 2 - y)) / DEG);
        for (const yaw of bowl ? [toCentre] : [toCentre, toCentre + 180]) {
          attempts.push(() =>
            this.drop(view.id, 'lower_rack', x, y, { preset: tilted, yaw_deg: yaw }, heightsAt(y)),
          );
        }
        if (attempts.length > 120) break;
      }
    }
    const tips = Math.max(0, ...lanesOf(this.player, 'lower_rack').map((l) => l.tineTopZ));
    const kept = this.settle(
      view,
      'lower_rack',
      attempts,
      (outcome) => {
        // (A pot that stands on the tines of a side row may lean on the side of the cutlery
        // basket beside them; what sits on top of the basket is too high and is refused below.)
        const onTines = outcome.result.contacts.some((c) => c.with.startsWith('lower_rack.tine'));
        const refused = this.common(outcome) ?? this.restsBadly(outcome, 'lower_rack', onTines);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        const down = 180 - mouthUpDeg(pose);
        if (outcome.axisTurnDeg > 40) return 'it tipped over';
        if (down > (bowl ? 75 : 50)) return 'its mouth does not point down';
        if (this.topOf(view, pose) > clear + 4) return 'it stands too high';
        if (this.beyondPlan(view, pose, 'lower_rack') > 1) return 'it sticks out of the basket';
        // Standing on the tines it is at most half its own height above their tips.
        return pose.position_mm[2] > tips + view.size[2] / 2 + 25
          ? 'it came to rest on the rim of the basket'
          : null;
      },
      { maxBad: lane === null ? 2 : 1 },
    );
    return kept !== null;
  }

  /**
   * Cutlery in the cutlery basket: forks and spoons handle down, knives blade down, the kinds
   * dealt round the cells so that like does not lie with like.
   */
  private placeCutlery(extra: readonly ItemView[] = []): void {
    if (!this.player.hasRack('cutlery_basket')) return;
    const pieces = [...this.pending((view) => view.family === 'cutlery'), ...extra];
    if (pieces.length === 0) return;
    const cells = this.player.slots('cutlery_basket').slots.filter((s) => s.kind === 'basket_cell');
    if (cells.length === 0) return;
    // Deal the kinds in turn.
    const byKind = new Map<string, ItemView[]>();
    for (const view of pieces) {
      const list = byKind.get(view.record.display_name) ?? [];
      list.push(view);
      byKind.set(view.record.display_name, list);
    }
    const dealt: ItemView[] = [];
    for (let i = 0; dealt.length < pieces.length; i++) {
      for (const list of byKind.values()) {
        const view = list[i];
        if (view !== undefined) dealt.push(view);
      }
    }
    // A second go at the basket starts in other cells than the first.
    const round = this.cutleryRounds;
    this.cutleryRounds += 1;
    const count = new Map<string, number>();
    for (const item of this.player.scene().placed) {
      if (item.frame !== 'cutlery_basket') continue;
      const cell = this.cellOf(cells, item.position_mm[0], item.position_mm[1]);
      if (cell !== null) count.set(cell.id, (count.get(cell.id) ?? 0) + 1);
    }
    const strikes = new Map<string, number>();
    let missesInARow = 0;
    for (const view of dealt) {
      const halfHeight = view.longest / 2;
      const openCells = cells.filter((cell) => (strikes.get(cell.id) ?? 0) < 2);
      if (openCells.length === 0 || missesInARow >= 3) {
        this.leftOut.set(view.id, 'the cutlery basket is full');
        continue;
      }
      // Where `list_slots` says the lower end of this piece still finds room in each cell, as
      // the basket stands now; the cell with the fewest pieces first, so that the kinds mix
      // and no cell is crammed.
      const listed = this.player.slotsFor('cutlery_basket', view.id);
      const kindDrops = this.cellDrops.get(view.record.display_name) ?? new Map();
      for (const cell of listed) {
        if (cell.suggested_drop !== undefined && !kindDrops.has(cell.id)) {
          kindDrops.set(cell.id, cell.suggested_drop);
        }
      }
      this.cellDrops.set(view.record.display_name, kindDrops);
      const suggested = listed.filter(
        (cell) => cell.drop_free === true && openCells.some((c) => c.id === cell.id),
      );
      const index = (cell: SlotCard): number => cells.findIndex((c) => c.id === cell.id);
      const order = [...suggested].sort(
        (a, b) =>
          (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0) ||
          ((index(a) + round) % cells.length) - ((index(b) + round) % cells.length),
      );
      let lastCell: SlotCard | null = null;
      let loose = false;
      const attempts: (() => DropResult)[] = [];
      for (const cell of order.slice(0, 3)) {
        const drop = cell.suggested_drop;
        if (drop === undefined) continue;
        attempts.push(() => {
          const result = this.place({
            item_id: view.id,
            frame: 'cutlery_basket',
            position_mm: drop.position_mm,
            orientation: drop.orientation,
          });
          if (result.accepted) lastCell = cell;
          return result;
        });
      }
      // A cell in which no place is free straight down: the piece is pushed down into the
      // bunch where the first of its kind went in, and nudges the others aside, as a hand does
      // (`place` in mode `insert`, straight down, with its 15 N).
      const fullest = [...openCells].sort(
        (a, b) =>
          (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0) ||
          ((index(a) + round) % cells.length) - ((index(b) + round) % cells.length),
      );
      for (const cell of fullest.slice(0, 3)) {
        const drop = kindDrops.get(cell.id) as SlotCard['suggested_drop'];
        if (drop === undefined || order.slice(0, 3).some((c) => c.id === cell.id)) continue;
        attempts.push(() => {
          const result = this.place({
            item_id: view.id,
            frame: 'cutlery_basket',
            position_mm: drop.position_mm,
            orientation: drop.orientation,
            mode: 'insert',
            insert_dir: [0, 0, -1],
          });
          if (result.accepted) lastCell = cell;
          return result;
        });
      }
      const kept = this.settle(
        view,
        'cutlery_basket',
        attempts,
        (outcome) => {
          const r = outcome.result;
          const pose = r.settled_pose;
          let refused: string | null = null;
          if (r.fell_out) refused = 'it fell out of the cutlery basket';
          else if (r.fell_through) refused = 'it fell through the cutlery basket';
          else if (r.returned.length > 0) refused = 'something ended on the kitchen floor';
          else if (pose.position_mm[2] > halfHeight + 30) {
            refused = 'it came to rest on top of the others';
          } else if (longAxisTurn(outcome) > 50) refused = 'it fell over';
          else if (this.lowEnd(view, pose) < -3) {
            refused = 'its end went through the floor of the cutlery basket';
          } else if (!r.stable) refused = 'it did not come to a stable rest';
          else if (outcome.disturbedDeg > 40) refused = 'it knocked the others over';
          const cell = lastCell as SlotCard | null;
          loose = refused === 'it did not come to a stable rest';
          if (cell !== null) {
            if (refused === null) count.set(cell.id, (count.get(cell.id) ?? 0) + 1);
            // A piece that rocks says nothing about room; one that lies on the others does.
            else if (!loose) strikes.set(cell.id, (strikes.get(cell.id) ?? 0) + 1);
          }
          return refused;
        },
        { maxBad: 1 },
      );
      if (kept !== null) missesInARow = 0;
      else if (!loose) missesInARow += 1;
      if (kept === null) this.giveUp(view, 'the cutlery basket is full');
    }
  }

  /**
   * Lets an item down wherever the basket still takes it: a grid of spots over the whole plan
   * in the order of `prefer`, each asked with `preview` first (is the pose free, can it be
   * reached, how far down does the item come before it touches something), and only what is
   * free is placed and judged. A spot at which the item would come to rest far higher than
   * where one of its kind already stands (on top of something) is passed over unplaced.
   * Returns true when it stands.
   */
  private placeFree(
    view: ItemView,
    rack: Rack,
    orientations: readonly Orientation[],
    judge: (outcome: Outcome) => string | null,
    prefer: (x: number, y: number) => number,
    options: { readonly step?: number; readonly maxBad?: number; readonly margin?: number } = {},
  ): boolean {
    if (this.player.isPlaced(view.id) || orientations.length === 0) return false;
    const [width, depth] = this.player.envelope(rack);
    const step = options.step ?? 30;
    const margin = options.margin ?? Math.min(view.size[0], view.size[1]) / 2 + 6;
    const spots: [number, number][] = [];
    for (let y = margin; y <= depth - margin; y += step) {
      for (let x = margin; x <= width - margin; x += step) spots.push([x, y]);
    }
    spots.sort((a, b) => prefer(a[0], a[1]) - prefer(b[0], b[1]) || a[0] - b[0] || a[1] - b[1]);
    const kind = `${view.record.display_name}|${rack}|free`;
    const known = this.landings.get(kind);
    const attempts: (() => DropResult | null)[] = [];
    let asked = 0;
    // Spots where nothing stands in plan come first; then the rest (things overlap in plan
    // that do not touch: a glass under the rim of a bowl).
    const body = Math.min(view.size[0], view.size[1]) / 2;
    const open = (x: number, y: number): boolean =>
      this.isFree(rack, x - body, x + body, y - body, y + body, 0);
    const ordered = [
      ...spots.filter(([x, y]) => open(x, y)),
      ...spots.filter(([x, y]) => !open(x, y)),
    ];
    const tried = new Set<string>();
    for (const [x, y] of ordered) {
      for (const orientation of orientations) {
        attempts.push(() => {
          // (Budget of questions per item: a basket in which forty spots are free and none
          // will do has no place for it. A spot at which one way of putting it down was
          // refused is not tried another way.)
          if (asked >= 40 || tried.has(`${x},${y}`)) return null;
          const z = dropHeights(this.player, rack, y, view.longest / 2 + 2, view.longest / 2)[0];
          if (z === undefined) return null;
          const request: PlaceRequest = {
            item_id: view.id,
            frame: rack,
            position_mm: [Math.round(x), Math.round(y), Math.round(z)],
            orientation,
          };
          const pose = this.player.preview(request);
          if (
            !pose.accepted ||
            !pose.collision_free ||
            !pose.insertable ||
            !pose.in_bounds ||
            pose.lowered_pose === null
          ) {
            return null;
          }
          asked += 1;
          const landing = pose.lowered_pose.position_mm[2];
          if (known !== undefined && landing > known + 25) return null;
          tried.add(`${x},${y}`);
          return this.place(request);
        });
      }
    }
    const kept = this.settle(view, rack, attempts, judge, { maxBad: options.maxBad ?? 3 });
    if (kept === null) return false;
    const z = kept.result.settled_pose.position_mm[2];
    this.landings.set(kind, Math.min(known ?? Infinity, z));
    return true;
  }

  /** Height at which an item of each kind has come to stand, by kind and basket. */
  private readonly landings = new Map<string, number>();

  /** The mouth-down orientations of a hollow item, the upright one first, turned four ways. */
  private mouthDown(view: ItemView): Orientation[] {
    const bowl = view.family === 'bowl';
    const presets = (
      bowl ? ['inclined', 'inverted_tilted', 'inverted'] : ['inverted', 'inverted_tilted']
    ).filter((preset) => view.presets.has(preset));
    const long = Math.abs(view.size[0] - view.size[1]) > 8;
    const out: Orientation[] = [];
    for (const preset of presets) {
      const tilted = preset !== 'inverted';
      for (const yaw of tilted || long ? [0, 90, 180, 270] : [0]) {
        out.push({ preset, yaw_deg: yaw });
      }
    }
    return out;
  }

  /** What a hollow item let down mouth down must be to stay, beyond `common`. */
  private judgeHollow(view: ItemView, rack: Rack, outcome: Outcome): string | null {
    const refused = this.common(outcome) ?? this.restsBadly(outcome, rack);
    if (refused !== null) return refused;
    const pose = outcome.result.settled_pose;
    const down = 180 - mouthUpDeg(pose);
    const bowl = view.family === 'bowl';
    const onTines = outcome.result.resting?.on_base === false;
    // Upright on the floor it may lean a little; on the tines of the lower basket, or a bowl
    // anywhere, it lies tilted with its opening down.
    const limit = bowl ? 80 : view.family === 'cookware' || onTines ? MAX_TIPPED : MAX_STEM_LEAN;
    if (down > limit) return 'its opening does not point down';
    if (this.topOf(view, pose) > this.clearHeight(rack) + 4) return 'it stands too high';
    if (this.beyondPlan(view, pose, rack) > 1) return 'it sticks out of the basket';
    if (pose.position_mm[2] - this.halfExtent(view, pose, 2) < -FLOOR_DIP) {
      return 'it hangs through the floor of the basket';
    }
    const [x, y] = outcome.result.requested_pose.position_mm;
    if (Math.hypot(pose.position_mm[0] - x, pose.position_mm[1] - y) > 70) {
      return 'it slid away from where it was put';
    }
    return null;
  }

  /** A hollow item mouth down wherever a basket still has room for it. */
  private placeHollowFree(view: ItemView, rack: Rack): boolean {
    const [width, depth] = this.player.envelope(rack);
    // Where most room is left around the spot: as far as its own half width from the nearest
    // thing that stands in the basket and from the walls, and no further than that needs (so
    // that the big free patches are not cut in two); of equal spots the rear right first.
    const boxes = this.boxesOf(rack);
    const body = Math.min(view.size[0], view.size[1]) / 2;
    const room = (x: number, y: number): number => {
      let nearest = Math.min(x, width - x, y, depth - y);
      for (const box of boxes) {
        const dx = Math.max(box.x0 - x, 0, x - box.x1);
        const dy = Math.max(box.y0 - y, 0, y - box.y1);
        nearest = Math.min(nearest, Math.hypot(dx, dy));
      }
      return Math.min(nearest, body + 12);
    };
    const prefer = (x: number, y: number): number =>
      -10 * Math.round(room(x, y)) + 0.01 * (width - x + 0.5 * (depth - y));
    return this.placeFree(
      view,
      rack,
      this.mouthDown(view),
      (outcome) => this.judgeHollow(view, rack, outcome),
      prefer,
      { step: rack === 'lower_rack' ? 32 : 26 },
    );
  }

  private cellOf(cells: readonly SlotCard[], x: number, y: number): SlotCard | null {
    for (const cell of cells) {
      const [sx, sy] = cell.size_mm ?? [cell.width_mm, cell.width_mm];
      if (Math.abs(x - cell.centre_mm[0]) <= sx / 2 && Math.abs(y - cell.centre_mm[1]) <= sy / 2) {
        return cell;
      }
    }
    return null;
  }

  /** Height of the lower end of a long piece above the origin of its frame, millimetres. */
  private lowEnd(view: ItemView, pose: WirePose): number {
    return pose.position_mm[2] - (view.longest / 2) * Math.abs(axisAt(pose, [1, 0, 0])[2]);
  }

  /** Loads the pulled-out lower basket. */
  private loadLower(): void {
    const box = this.cutleryBasketBox();
    if (box !== null) this.boxesOf('lower_rack').push(box);
    const { rear, left, right } = this.lowerLanes();
    if (rear.length > 0) this.placeSidePieces([...left, ...right, ...rear], false);
    // A frying pan too tall to stand on edge goes in mouth down with the pots.
    const hollow = (): ItemView[] =>
      this.byValue(
        this.pending(
          (view) =>
            this.isLowerHollow(view) &&
            (!this.isSidePiece(view) || (this.lastReason.get(view.id) ?? '').includes('too tall')),
        ),
      );
    const edge = (): ItemView[] => this.byValue(this.pending((view) => this.isLowerEdge(view)));

    // The rear rows are for the large plates that lie back with their tines there (up to an
    // inch deep). A deep plate tips forward between those narrow tines and stands upright in
    // the wide gaps of the side rows: those are its seats.
    const rearRows = this.rowsOf(rear);
    const sideRows = [...this.rowsOf(left), ...this.rowsOf(right)];
    const deep = (view: ItemView): boolean => view.family === 'flat' && view.size[2] >= 28;
    for (const view of edge()) {
      if (view.size[0] < 200 || deep(view)) continue;
      this.seatEdgePass(view, 'lower_rack', this.edgeSlots(view, 'lower_rack', rearRows), 1, false);
    }
    // Pots and large bowls go in mouth down over rows of tines, where each takes the seats of
    // half a dozen plates. When the plates still to come need those seats, the plates go first
    // and the pots get what is left; when seats are plentiful the deep plates keep to the left
    // side pair and the pots take the right one and the free end of the rear rows.
    const bigBowl = (view: ItemView): boolean =>
      view.family === 'bowl' && !view.upperOnly && view.size[0] >= 170;
    const pots = (): ItemView[] => [
      ...hollow(),
      ...this.byValue(this.pending((view) => bigBowl(view))),
    ];
    const smallPlates = (): ItemView[] => edge().filter((view) => !bigBowl(view));
    const freeSeats = (): number => {
      const probe = smallPlates()[0];
      return probe === undefined ? 0 : this.edgeSlots(probe, 'lower_rack', null).length;
    };
    const SEATS_PER_POT = 6;
    const plentiful =
      pots().length > 0 && smallPlates().length + SEATS_PER_POT * pots().length <= freeSeats();
    for (const view of edge()) {
      if (!deep(view)) continue;
      const rows = plentiful ? this.rowsOf(left) : sideRows;
      if (
        !this.seatEdgePass(view, 'lower_rack', this.edgeSlots(view, 'lower_rack', rows), 1, false)
      ) {
        this.lastReason.delete(view.id);
      }
    }
    const potsIn = (): void => {
      // First over a side pair, the handle along the wall; then wherever the basket takes it.
      for (const view of pots()) {
        const lane = [...right, ...left].find((l) => l !== undefined) ?? null;
        const over =
          plentiful && view.family !== 'bowl' && view.presets.has('inverted') && lane !== null
            ? this.placeCookware(view, lane)
            : false;
        if (!over && !this.placeCookware(view, null) && !this.placeHollowFree(view, 'lower_rack')) {
          this.lastReason.delete(view.id);
        }
      }
    };
    const platesIn = (): void => {
      for (const view of smallPlates()) {
        if (!this.seatEdge(view, 'lower_rack', this.edgeSlots(view, 'lower_rack', null), 1)) {
          if (view.family === 'bowl') {
            if (!this.placeCookware(view, null)) this.lastReason.delete(view.id);
          }
        }
      }
    };
    if (plentiful) {
      potsIn();
      platesIn();
    } else {
      platesIn();
      potsIn();
    }
    if (rear.length > 0) this.placeSidePieces([...left, ...right, ...rear], true);
    for (const view of pots()) {
      if (!this.placeCookware(view, null) && !this.placeHollowFree(view, 'lower_rack')) {
        this.giveUp(view, 'no room mouth down in the lower basket');
      }
    }
    // A frying pan that found no place on edge at a wall goes in mouth down like a pot.
    for (const view of this.pending((v) => this.isSidePiece(v) && v.family === 'cookware')) {
      if (!this.placeHollowFree(view, 'lower_rack')) this.lastReason.delete(view.id);
    }
    for (const view of this.pending((v) => this.isSidePiece(v))) {
      this.giveUp(view, 'no place at the side of the lower basket');
    }
    this.placeCutlery();
  }

  // -------------------------------------------------------------------------------------------
  // The upper basket
  // -------------------------------------------------------------------------------------------

  /** Whether a small plate, a saucer, a lid or a shallow bowl stands on edge in the upper rows. */
  private isUpperEdge(view: ItemView): boolean {
    if (view.edgePreset === null || this.isSidePiece(view)) return false;
    if (edgeShapeOf(view).halfUp * 2 > this.clearHeight('upper_rack') + 4) return false;
    // A small bowl stands tipped forward between the tall upright tines of the upper basket,
    // its opening down: where `list_slots` finds it a seat. Plates take the other rows.
    if (view.family === 'bowl') return view.size[0] <= 170;
    return view.family === 'flat';
  }

  /** Long utensils lying lengthwise on the knife shelf, one beside the other. */
  private placeUtensils(): void {
    const utensils = this.pending((view) => view.family === 'utensil').sort(
      (a, b) => b.record.points - a.record.points || b.longest - a.longest,
    );
    if (utensils.length === 0) return;
    const shelf = this.player.slots('upper_rack').slots.find((s) => s.kind === 'knife_shelf');
    const depth = this.player.envelope('upper_rack')[1];
    if (shelf === undefined || shelf.size_mm === undefined) {
      for (const view of utensils) this.leftOut.set(view.id, 'the knife shelf is folded up');
      return;
    }
    const [sx] = shelf.size_mm;
    for (const view of utensils) {
      const preset = ['bowl_down', 'flat_inverted', 'flat', 'on_side'].find((p) =>
        view.presets.has(p),
      );
      if (preset === undefined) {
        this.leftOut.set(view.id, 'it has no lying orientation');
        continue;
      }
      const wide = Math.max(view.size[1], 20);
      const attempts: (() => DropResult)[] = [];
      for (
        let x = shelf.centre_mm[0] - sx / 2 + wide / 2 + 4;
        x <= shelf.centre_mm[0] + sx / 2 - wide / 2 - 2;
        x += 12
      ) {
        for (const dy of [0, -25, 25]) {
          const y = Math.min(
            depth - view.longest / 2 - 12,
            Math.max(view.longest / 2 + 12, shelf.centre_mm[1] + dy),
          );
          // (What stands on the rest under the shelf is under the utensil, not in its way.)
          if (
            !this.isFree(
              'upper_rack',
              x - wide / 2,
              x + wide / 2,
              y - view.longest / 2,
              y + view.longest / 2,
              this.style.gap,
              null,
              this.underKnifeShelf,
            )
          ) {
            continue;
          }
          attempts.push(() =>
            this.drop(view.id, 'upper_rack', x, y, { preset, yaw_deg: 90 }, [
              shelf.centre_mm[2] + view.size[2] / 2 + 14,
              shelf.centre_mm[2] + view.size[2] / 2 + 30,
            ]),
          );
        }
      }
      const kept = this.settle(
        view,
        'upper_rack',
        attempts,
        (outcome) => {
          const refused = this.common(outcome) ?? this.restsBadly(outcome, 'upper_rack');
          if (refused !== null) return refused;
          const pose = outcome.result.settled_pose;
          if (longAxisTurn(outcome) > 25) return 'it slid off the shelf';
          if (pose.position_mm[2] < shelf.centre_mm[2] - 15) return 'it fell off the shelf';
          return this.topOf(view, pose) > this.clearHeight('upper_rack') + 4
            ? 'it stands too high'
            : null;
        },
        { maxBad: 1 },
      );
      if (kept === null) this.giveUp(view, 'no room for it on the knife shelf');
    }
  }

  /** The strip at the front of the upper basket that the tablet falls into. */
  private tabletZone(): PlanBox | null {
    const card = this.player.card.machine;
    const rack = card.racks.find((r) => r.rack === 'upper_rack');
    if (rack === undefined) return null;
    const lid = card.dispenser;
    if (lid === null) return null;
    const centre = (lid.lid_sweep_min_mm[0] + lid.lid_sweep_max_mm[0]) / 2 - rack.origin_in_mm[0];
    // [ESTIMATED from what `check_load` reports as blocking the tablet: the tray takes the
    // middle of the front, and what stands just behind it is in the tablet's way too.]
    return { id: 'tablet_zone', x0: centre - 125, x1: centre + 125, y0: 0, y1: 80 };
  }

  private isBadSpot(key: string, x: number, y: number): boolean {
    return (this.badSpots.get(key) ?? []).some(([bx, by]) => Math.hypot(bx - x, by - y) < 16);
  }

  private markBadSpot(key: string, x: number, y: number): void {
    const list = this.badSpots.get(key) ?? [];
    list.push([x, y]);
    this.badSpots.set(key, list);
  }

  /**
   * One glass, cup, mug, container or bowl mouth down on the floor of the upper basket. The
   * floor is searched over its whole plan: first along the lines where an item of its kind has
   * already come to stand, then everywhere else, from the rear forwards. Returns true when it
   * stands.
   */
  private placeOnFloor(view: ItemView, under: PlanBox | null = null, maxTop = Infinity): boolean {
    const rack: Rack = 'upper_rack';
    const [width, depth] = this.player.envelope(rack);
    const clear = Math.min(this.clearHeight(rack), maxTop);
    const kind = view.record.display_name;
    const bowl = view.family === 'bowl';
    const tall = view.size[2] + 8 > clear;
    let preset: string | undefined;
    if (bowl) preset = ['inclined', 'inverted_tilted', 'inverted'].find((p) => view.presets.has(p));
    else if (tall) preset = view.presets.has('inverted_tilted') ? 'inverted_tilted' : undefined;
    else preset = ['inverted', 'inverted_tilted'].find((p) => view.presets.has(p));
    if (view.family === 'small' && preset === undefined && view.presets.has('upright')) {
      preset = 'upright';
    }
    if (preset === undefined) {
      this.leftOut.set(
        view.id,
        tall ? 'it is too tall to stand under the roof' : 'it has no mouth-down orientation',
      );
      return false;
    }
    const tilted = preset !== 'inverted' && preset !== 'upright';
    const [sx, sy, sz] = view.size;
    const long = sx - sy > 8;
    const yaws = tilted ? [0, 180, 90, 270] : long ? [90, 0] : [0];
    const key = `${kind}|${preset}`;
    const failKey = `${kind}|floor|${preset}`;
    // First the lines on which an item of its kind already stands; then from the right wall
    // leftwards, beside what stands there already, so that the lines close up.
    const columns = [...(this.goodColumns.get(key) ?? [])];
    const narrow = Math.min(sx, sy) / 2;
    const sweep = [width - narrow - 6];
    for (const box of this.boxesOf(rack)) sweep.push(box.x0 - this.style.gap - narrow - 1);
    for (let x = width - narrow - 6; x >= narrow + 4; x -= FLOOR_STEP / 2) sweep.push(x);
    sweep.sort((a, b) => b - a);
    // (Where something of another kind stands is a likelier place than where nothing does.)
    for (const list of this.goodColumns.values()) {
      for (const x of list) if (!columns.some((c) => Math.abs(c - x) < 5)) columns.push(x);
    }
    for (const x of sweep) {
      const at = Math.round(x);
      if (at > narrow && !columns.some((c) => Math.abs(c - at) < 5)) columns.push(at);
    }
    if (under !== null) {
      // Only the lines that run under the shelf.
      columns.length = 0;
      const mid = (under.x0 + under.x1) / 2;
      for (const dx of [0, 8, -8, 16, -16]) columns.push(Math.round(mid + dx));
    }
    let lastSpot: [number, number] = [0, 0];
    const tipped: number[] = [];
    const attempts: (() => DropResult | null)[] = [];
    // The sloped rests along the side walls are no floor to stand on: what goes there is set
    // down leaning (`useSideRests`).
    const rests = this.restZones();
    for (const x of columns) {
      if (under === null && rests.some((zone) => x > zone.x0 && x < zone.x1)) continue;
      for (const yaw of yaws) {
        const turned = yaw === 90 || yaw === 270;
        const lean = tilted ? sz * 0.3 : 0;
        const rx = (turned ? sy : sx) / 2 + (tilted && !turned ? lean / 2 : 0);
        const ry = (turned ? sx : sy) / 2 + (tilted && turned ? lean / 2 : 0);
        if (x - rx < 2 || x + rx > width - 2) continue;
        let next = Infinity;
        for (let y = depth - ry - 6; y >= ry + 6; y -= FLOOR_STEP / 2) {
          if (y > next) continue;
          if (!this.isFree(rack, x - rx, x + rx, y - ry, y + ry)) continue;
          if (this.isBadSpot(key, x, y)) continue;
          if (under !== null && (y - ry < under.y0 - 4 || y + ry > under.y1 + 4)) continue;
          // One try per free stretch of the line and then a body length on.
          next = y - 2 * ry - this.style.gap;
          const halfHeight = tilted ? Math.max(sz, sx) / 2 : sz / 2;
          attempts.push(() => {
            // (Where it has just tipped over, the next line along is no better.)
            if (tipped.some((bad) => Math.abs(bad - x) < 18)) return null;
            const result = this.drop(
              view.id,
              rack,
              x,
              y,
              { preset: preset as string, yaw_deg: yaw },
              dropHeights(this.player, rack, y, halfHeight + 2, Math.max(rx, ry)),
            );
            if (result.accepted) lastSpot = [x, y];
            return result;
          });
        }
      }
      if (attempts.length > 600) break;
    }
    if (this.trace !== null && attempts.length === 0) {
      this.trace(
        `${view.id}: no spot is free on the floor for ${Math.round(sx)}x${Math.round(sy)}; boxes ${this.boxesOf(
          rack,
        )
          .map(
            (b) =>
              `${b.id}[${Math.round(b.x0)}..${Math.round(b.x1)},${Math.round(b.y0)}..${Math.round(b.y1)}]`,
          )
          .join(' ')}`,
      );
    }
    const kept = this.settle(
      view,
      rack,
      attempts,
      (outcome) => {
        let refused = this.common(outcome) ?? this.restsBadly(outcome, rack);
        const pose = outcome.result.settled_pose;
        if (refused === null) {
          const down = 180 - mouthUpDeg(pose);
          if (preset === 'upright') {
            if (outcome.axisTurnDeg > 20) refused = 'it tipped over';
          } else if (!tilted) {
            if (down > MAX_VESSEL_LEAN) refused = 'it tipped over';
          } else if (outcome.axisTurnDeg > 30) refused = 'it tipped over';
          else if (down > (bowl ? 75 : MAX_STEM_LEAN)) refused = 'it lay down on its side';
        }
        if (refused === null) {
          const [x, y, z] = pose.position_mm;
          if (this.topOf(view, pose) > clear + 4) refused = 'it stands too high';
          else if (this.beyondPlan(view, pose, rack) > 1) refused = 'it sticks out of the basket';
          else if (under !== null && (x < under.x0 - 10 || x > under.x1 + 10)) {
            refused = 'it slid out from under the shelf';
          } else if (z - this.halfExtent(view, pose, 2) < -FLOOR_DIP) {
            refused = 'it hangs through the floor of the basket';
          } else if (Math.hypot(x - lastSpot[0], y - lastSpot[1]) > 55) {
            refused = 'it slid away from where it was put';
          }
        }
        if (refused !== null) {
          this.markBadSpot(key, lastSpot[0], lastSpot[1]);
          if (refused.includes('tipped') || refused.includes('lay down')) tipped.push(lastSpot[0]);
        }
        return refused;
      },
      { maxBad: 3 },
    );
    if (kept === null) {
      if (under === null) this.kindFails.set(failKey, (this.kindFails.get(failKey) ?? 0) + 1);
      return false;
    }
    if (under !== null) return true;
    const list = this.goodColumns.get(key) ?? [];
    const x = Math.round(kept.result.requested_pose.position_mm[0]);
    if (!list.includes(x)) list.push(x);
    this.goodColumns.set(key, list);
    this.kindFails.delete(failKey);
    return true;
  }

  /** The sloped side rests of the upper basket as plan boxes (wall to ridge), by slot id. */
  private restZones(): PlanBox[] {
    return this.player
      .slots('upper_rack')
      .slots.filter((slot) => slot.kind === 'cup_rest' && slot.size_mm !== undefined)
      .map((slot) => {
        const [sx, sy] = slot.size_mm as readonly [number, number];
        return {
          id: slot.id,
          x0: slot.centre_mm[0] - sx / 2,
          x1: slot.centre_mm[0] + sx / 2,
          y0: slot.centre_mm[1] - sy / 2,
          y1: slot.centre_mm[1] + sy / 2,
        };
      });
  }

  /** Whether an item is a cup, a mug or a glass that is set mouth down on a side rest. */
  private isRestItem(view: ItemView): boolean {
    return view.family === 'vessel' && view.presets.has('inverted');
  }

  /**
   * The sloped rests along the side walls of the upper basket: cups, mugs and glasses are set
   * on them mouth down and leaning towards the wall, where `list_slots` says to let them go,
   * from the rear forwards, what is worth most first. `under` is a shelf that will be folded
   * down over a rest afterwards (its plan box and the height of its underside): what would
   * not go under it is not left there.
   */
  private useSideRests(under: { box: PlanBox; z: number } | null): void {
    const rack: Rack = 'upper_rack';
    const zones = this.restZones();
    if (zones.length === 0) return;
    const clear = this.clearHeight(rack);
    // A kind that found no seat on a rest, or does not go under the shelf there, is not
    // tried there again.
    const closed = new Set<string>();
    for (const view of this.byValue(this.pending((v) => this.isRestItem(v)))) {
      if (!this.canAct(4)) return;
      const kind = view.record.display_name;
      const open = zones.filter((zone) => !closed.has(`${kind}|${zone.id}`));
      if (open.length === 0) continue;
      let used: PlanBox | null = null;
      const attempts: (() => DropResult | null)[] = open.map((zone) => () => {
        const slot = this.player
          .slotsFor(rack, view.id)
          .find((s) => s.id === zone.id && s.drop_free === true);
        if (slot?.suggested_drop === undefined) {
          closed.add(`${kind}|${zone.id}`);
          return null;
        }
        used = zone;
        return this.place({
          item_id: view.id,
          frame: rack,
          position_mm: slot.suggested_drop.position_mm,
          orientation: slot.suggested_drop.orientation,
        });
      });
      const kept = this.settle(
        view,
        rack,
        attempts,
        (outcome) => {
          const zone = used as PlanBox | null;
          const refused = this.common(outcome) ?? this.restsBadly(outcome, rack);
          if (refused !== null) return refused;
          const pose = outcome.result.settled_pose;
          const [x, y] = pose.position_mm;
          const [ax, ay] = outcome.result.requested_pose.position_mm;
          if (180 - mouthUpDeg(pose) > MAX_STEM_LEAN) return 'it lay down on its side';
          if (Math.hypot(x - ax, y - ay) > REST_SLIDE) return 'it slid off the rest';
          if (this.topOf(view, pose) > clear + 4) return 'it stands too high';
          if (this.beyondPlan(view, pose, rack) > REST_BOX_SLACK) {
            return 'it sticks out of the basket';
          }
          if (
            under !== null &&
            zone !== null &&
            zone.x0 < under.box.x1 &&
            zone.x1 > under.box.x0 &&
            y + this.halfExtent(view, pose, 1) > under.box.y0 &&
            this.topOf(view, pose) > under.z - UNDER_SHELF_CLEAR
          ) {
            closed.add(`${kind}|${zone.id}`);
            return 'it would not go under the shelf that is folded down over the rest';
          }
          return null;
        },
        { maxBad: 1 },
      );
      if (kept === null) this.lastReason.delete(view.id);
      else if (
        under !== null &&
        used !== null &&
        (used as PlanBox).x0 < under.box.x1 &&
        (used as PlanBox).x1 > under.box.x0
      ) {
        this.underKnifeShelf.add(view.id);
      }
    }
  }

  /** What stands on the rest over which the knife shelf is folded down again. */
  private readonly underKnifeShelf = new Set<string>();

  /**
   * The folding cup shelves, folded down as a second level: cups and mugs stand on them mouth
   * down (a shelf is flat; the floor of the basket is not, and a cup with a handle tips on it
   * sooner than a glass does). A shelf that takes nothing is folded up again.
   */
  private useCupShelves(): void {
    const rack: Rack = 'upper_rack';
    const options =
      this.player.card.machine.racks
        .find((r) => r.rack === rack)
        ?.options.filter((option) => option.name.startsWith('shelf_cup')) ?? [];
    // (What stands on a shelf is not much wider than the shelf: a cup, a mug, a glass.)
    const hollow = (view: ItemView): boolean =>
      view.family === 'vessel' &&
      view.presets.has('inverted') &&
      Math.max(view.size[0], view.size[1]) <= SHELF_ITEM_MAX;
    const handled = (view: ItemView): boolean => hollow(view) && view.size[0] - view.size[1] > 8;
    if (options.length === 0 || this.pending(handled).length < 1) return;
    const clear = this.clearHeight(rack);
    for (const option of options) {
      if (!this.canAct(8)) return;
      const wasDown = this.player.option(rack, option.name) === 'down';
      if (!wasDown && !this.player.setRack(rack, option.name, 'down').accepted) continue;
      const slot = this.player
        .slots(rack)
        .slots.find((s) => s.kind === 'cup_shelf' && s.id === option.name);
      if (slot === undefined || slot.size_mm === undefined) continue;
      const [sx, sy] = slot.size_mm;
      const shelf = {
        name: slot.id,
        z: slot.centre_mm[2],
        box: {
          id: slot.id,
          x0: slot.centre_mm[0] - sx / 2,
          x1: slot.centre_mm[0] + sx / 2,
          y0: slot.centre_mm[1] - sy / 2,
          y1: slot.centre_mm[1] + sy / 2,
        },
      };
      // Nothing can be let down past a shelf onto the floor under it.
      this.boxesOf(rack).push(shelf.box);
      const fits = (view: ItemView): boolean => hollow(view) && view.size[2] + shelf.z + 8 <= clear;
      // Only what has a handle is stood on a shelf. A glass stands on the floor of the
      // basket, where it stands well and the spray of the arm below reaches into it; on a
      // shelf it is a level further from that arm and behind whatever stands under the shelf.
      // (Until 2026-10-11 glasses filled what the cups left of a shelf, and a soil that needs
      // a jet stayed inside every glass that stood there, in a load that was to be the
      // careful one.)
      const order = this.byValue(this.pending((view) => fits(view) && handled(view)));
      let placed = 0;
      let misses = 0;
      for (const view of order) {
        if (misses >= 2) break;
        if (this.standOnShelf(view, shelf)) placed += 1;
        else {
          misses += 1;
          this.lastReason.delete(view.id);
        }
      }
      if (placed > 0) {
        this.notes.push(
          `the cup shelf '${shelf.name.replace('shelf_', '')}' of the upper basket was folded down and carries ${placed} item(s)`,
        );
      } else if (!wasDown && this.player.setRack(rack, option.name, 'up').accepted) {
        const list = this.boxesOf(rack);
        const at = list.indexOf(shelf.box);
        if (at >= 0) list.splice(at, 1);
      }
    }
  }

  /** One cup, mug or glass mouth down on a folded-down cup shelf. */
  private standOnShelf(view: ItemView, shelf: { name: string; z: number; box: PlanBox }): boolean {
    const rack: Rack = 'upper_rack';
    const clear = this.clearHeight(rack);
    const [sx, sy, sz] = view.size;
    const [width, depth] = this.player.envelope(rack);
    // A handle lies across the shelf, to the middle of the basket or along it.
    const yaws = sx - sy > 8 ? [0, 90] : [0];
    const attempts: (() => DropResult)[] = [];
    for (const yaw of yaws) {
      const ry = (yaw === 0 ? sy : sx) / 2;
      const rx = (yaw === 0 ? sx : sy) / 2;
      // (Clear of the wall of the basket and of its rear edge.)
      const x = Math.min((shelf.box.x0 + shelf.box.x1) / 2, width - rx - 5);
      let next = Infinity;
      for (
        let y = Math.min(shelf.box.y1 - ry - 4, depth - ry - 14);
        y >= shelf.box.y0 + ry + 2;
        y -= 8
      ) {
        if (y > next) continue;
        // (Further apart than on the floor: a move of the basket slides what stands on the
        // smooth shelf.)
        if (!this.isFree(rack, x - rx, x + rx, y - ry, y + ry, 12, shelf.name)) continue;
        next = y - 2 * ry - 12;
        attempts.push(() =>
          this.drop(view.id, rack, x, y, { preset: 'inverted', yaw_deg: yaw }, [
            shelf.z + sz / 2 + 22,
            shelf.z + sz / 2 + 10,
          ]),
        );
      }
    }
    const kept = this.settle(
      view,
      rack,
      attempts,
      (outcome) => {
        const refused = this.common(outcome) ?? this.restsBadly(outcome, rack);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        if (180 - mouthUpDeg(pose) > 12) return 'it tipped over on the shelf';
        if (pose.position_mm[2] < shelf.z + sz / 2 - 10) return 'it fell off the shelf';
        if (this.beyondPlan(view, pose, rack) > 1) return 'it sticks out of the basket';
        return this.topOf(view, pose) > clear + 4 ? 'it stands too high' : null;
      },
      { maxBad: 1 },
    );
    if (kept === null) return false;
    // Its plan box belongs to the shelf, not to the floor of the basket.
    const list = this.boxesOf(rack);
    const at = list.findIndex((box) => box.id === view.id);
    if (at >= 0) list.splice(at, 1);
    this.shelfBoxes.push({
      ...this.settledBox(view, kept.result.settled_pose, null),
      id: shelf.name,
    });
    return true;
  }

  /** Plan boxes of what stands on a cup shelf, each under the name of its shelf. */
  private readonly shelfBoxes: PlanBox[] = [];

  /** Whether an item goes mouth down on the floor of the upper basket. */
  private isFloorItem(view: ItemView): boolean {
    if (view.family === 'vessel' || view.family === 'stemware' || view.family === 'small') {
      return true;
    }
    return view.family === 'bowl' && (view.size[0] < 200 || view.upperOnly);
  }

  /** Loads the pulled-out upper basket. */
  private loadUpper(): void {
    const rack: Rack = 'upper_rack';
    const zone = this.tabletZone();
    if (zone !== null) this.boxesOf(rack).push(zone);
    const plates = (): ItemView[] => this.byValue(this.pending((view) => this.isUpperEdge(view)));
    const utensils = this.pending((view) => view.family === 'utensil');
    // The knife shelf lies over the short rows of the basket and over the rest along its wall.
    // Folded up it frees the seats of the rows for small plates: it stays up when those
    // plates are worth more than the utensils. Otherwise it is down for the utensils, and is
    // folded up only while cups and mugs are set on the rest under it.
    const hasShelf = this.player.card.machine.racks
      .find((r) => r.rack === rack)
      ?.options.some((option) => option.name === 'shelf_knife_shelf');
    const shelfDown = (): boolean =>
      hasShelf === true && this.player.option(rack, 'shelf_knife_shelf') === 'down';
    const wasDown = shelfDown();
    const shelfSlot = wasDown
      ? this.player.slots(rack).slots.find((s) => s.kind === 'knife_shelf')
      : undefined;
    const shelf =
      shelfSlot?.size_mm === undefined
        ? null
        : {
            box: {
              id: shelfSlot.id,
              x0: shelfSlot.centre_mm[0] - shelfSlot.size_mm[0] / 2,
              x1: shelfSlot.centre_mm[0] + shelfSlot.size_mm[0] / 2,
              y0: shelfSlot.centre_mm[1] - shelfSlot.size_mm[1] / 2,
              y1: shelfSlot.centre_mm[1] + shelfSlot.size_mm[1] / 2,
            },
            // (The floor of the shelf is 4 mm thick: `centre_mm` is its upper side.)
            z: shelfSlot.centre_mm[2] - 4,
          };
    let keptUp = false;
    if (wasDown) {
      const worth = (list: readonly ItemView[], n: number): number =>
        this.byValue(list)
          .slice(0, n)
          .reduce((sum, view) => sum + view.record.points, 0);
      if (worth(plates(), 4) > worth(utensils, 2) && this.canAct(3)) {
        if (this.player.setRack(rack, 'shelf_knife_shelf', 'up').accepted) {
          keptUp = true;
          this.notes.push(
            'the knife shelf of the upper basket was folded up to free the rows under it for small plates',
          );
        }
      }
    }
    let seated = 0;
    for (const view of plates()) {
      if (view.family === 'bowl') continue;
      if (this.seatEdge(view, rack, this.edgeSlots(view, rack, null), 1)) seated += 1;
      else if (!this.isFloorItem(view)) this.giveUp(view, 'no seat was left for it in the rows');
    }
    for (const view of plates()) {
      if (view.family !== 'bowl') continue;
      if (!this.seatEdge(view, rack, this.edgeSlots(view, rack, null), 1)) {
        this.lastReason.delete(view.id);
      }
    }
    // No plate came to stand under the folded-up shelf: it comes down again for the utensils.
    if (keptUp && seated === 0) {
      keptUp = false;
      this.notes.pop();
    }
    // The rests along the side walls: first what can be reached as the basket stands (the
    // rest no shelf lies over, and the front end of the other). Only when cups, mugs or
    // glasses are left is the knife shelf folded up for the rest under it; it comes down
    // again over what stands there unless it stays up for the plates.
    const down = wasDown && !keptUp;
    // (The shelf may be up already and due to come down: folded up for plates of which none
    // came to stand under it. Then the rest under it is loaded for it to come down over.)
    this.useSideRests(down && !shelfDown() ? shelf : null);
    if (
      shelfDown() &&
      this.pending((view) => this.isRestItem(view)).length > 0 &&
      this.restZones().length > 0 &&
      this.canAct(6) &&
      this.player.setRack(rack, 'shelf_knife_shelf', 'up').accepted
    ) {
      this.useSideRests(down ? shelf : null);
    }
    for (let round = 0; round < 4 && down && hasShelf === true && !shelfDown(); round++) {
      if (!this.canAct(3)) break;
      const result = this.player.setRack(rack, 'shelf_knife_shelf', 'down');
      if (result.accepted) break;
      const blockers = ('blocked_by' in result ? (result.blocked_by ?? []) : []).filter((id) =>
        this.player.isPlaced(id),
      );
      if (blockers.length === 0) break;
      // What stands where the shelf comes down goes back to the counter for another place.
      for (const id of blockers) {
        if (this.takeOut(id, null)) this.lastReason.delete(id);
      }
    }
    this.placeUtensils();
    this.useCupShelves();
    // The floor: what is worth most for the room it takes goes first.
    const floor = this.pending((view) => this.isFloorItem(view)).sort(
      (a, b) =>
        b.record.points / (b.size[0] * b.size[1]) - a.record.points / (a.size[0] * a.size[1]) ||
        this.offered.indexOf(a) - this.offered.indexOf(b),
    );
    for (const view of floor) {
      const kind = view.record.display_name;
      const freeKey = `${kind}|upper|free`;
      if ((this.kindFails.get(freeKey) ?? 0) >= 3) {
        this.leftOut.set(view.id, 'no room was left in the upper basket for its kind');
        continue;
      }
      // First along the lines where its kind stands; then anywhere the basket takes it.
      const lines = ![...this.kindFails].some(
        ([key, n]) => key.startsWith(`${kind}|floor|`) && n >= 2,
      );
      if (lines && this.placeOnFloor(view)) continue;
      if (this.placeHollowFree(view, rack)) {
        // Where it came to stand is a line on which the next of its kind is tried first
        // (a second line of glasses stands beside the one along row C, leaning on it).
        const request = this.kept.get(view.id)?.request;
        const preset =
          request !== undefined && 'preset' in request.orientation
            ? request.orientation.preset
            : undefined;
        if (request !== undefined && preset !== undefined) {
          const key = `${kind}|${preset}`;
          const list = this.goodColumns.get(key) ?? [];
          const x = Math.round(request.position_mm[0]);
          if (!list.includes(x)) list.push(x);
          this.goodColumns.set(key, list);
          this.kindFails.delete(`${kind}|floor|${preset}`);
        }
        continue;
      }
      this.kindFails.set(freeKey, (this.kindFails.get(freeKey) ?? 0) + 1);
      this.giveUp(view, 'no room for it in the upper basket');
    }
    for (const view of this.pending(() => true)) {
      if (view.family !== 'cutlery') this.giveUp(view, 'no place was found for it');
    }
  }

  // -------------------------------------------------------------------------------------------
  // Finishing: move the baskets, take out what does not hold
  // -------------------------------------------------------------------------------------------

  /**
   * Takes out what a move of a basket threw: an item that was carried off or knocked over lies
   * stable where it fell, so the stability probe says nothing against it. `before` is the scene
   * before the move. Returns the ids taken out.
   */
  private removeThrown(before: SceneState, what: string): string[] {
    const removed: string[] = [];
    const was = new Map(before.placed.map((item) => [item.item_id, item]));
    for (const item of [...this.player.scene().placed]) {
      const old = was.get(item.item_id);
      const view = this.views.get(item.item_id);
      if (old === undefined || view === undefined || old.frame !== item.frame) continue;
      // Cutlery and utensils are judged by their length, everything else by its axis.
      const long = view.family === 'cutlery' || view.family === 'utensil';
      const axis: Vec3 = long ? [1, 0, 0] : [0, 0, 1];
      const turned = angleDeg(axisAt(old, axis), axisAt(item, axis));
      const moved = Math.hypot(
        item.position_mm[0] - old.position_mm[0],
        item.position_mm[1] - old.position_mm[1],
        item.position_mm[2] - old.position_mm[2],
      );
      const inBasket = item.frame === 'cutlery_basket';
      if (turned <= (inBasket ? 40 : THROWN_DEG) && moved <= THROWN_MM) continue;
      if (this.player.actionsLeft() < 2) break;
      if (this.takeOut(item.item_id, `taken out again: ${what} threw it`)) {
        this.player.stats.retries += 1;
        removed.push(item.item_id);
      }
    }
    return removed;
  }

  /**
   * Takes out items that the last move left unstable, and then those that taking them out
   * unsettled, for a few rounds; returns their ids.
   */
  private removeUnstable(what: string): string[] {
    const removed: string[] = [];
    for (let round = 0; round < 3; round++) {
      const loose = this.player.scene().placed.filter((item) => !item.stable);
      if (loose.length === 0) break;
      for (const item of loose) {
        if (this.player.actionsLeft() < 2) return removed;
        if (this.takeOut(item.item_id, `taken out again: ${what} left it unstable`)) {
          this.player.stats.retries += 1;
          removed.push(item.item_id);
        }
      }
    }
    return removed;
  }

  /** Moves a basket and takes out what the move threw or left unstable; returns their ids. */
  private moveAndTidy(rack: Rack, position: 'in' | 'out'): string[] {
    const before = this.player.scene();
    const placedBefore = new Set(before.placed.map((item) => item.item_id));
    const what =
      position === 'in'
        ? `pushing the ${rack.replace('_', ' ')} in`
        : `pulling the ${rack.replace('_', ' ')} out`;
    this.travel(rack, position);
    const removed = [...this.removeThrown(before, what), ...this.removeUnstable(what)];
    for (const id of placedBefore) {
      if (!this.player.isPlaced(id) && !removed.includes(id)) removed.push(id);
    }
    return removed;
  }

  /**
   * Pulls each basket out and pushes it in once more, as it will be for unloading. What stops a
   * basket, what the move throws and what it leaves unstable is taken out. Returns the ids of
   * what came out.
   */
  private travelTest(): string[] {
    const out: string[] = [];
    for (const rack of ['lower_rack', 'upper_rack'] as const) {
      if (!this.player.hasRack(rack) || this.player.actionsLeft() < 6) continue;
      this.travel(rack === 'lower_rack' ? 'upper_rack' : 'lower_rack', 'in');
      out.push(...this.moveAndTidy(rack, 'out'));
      out.push(...this.moveAndTidy(rack, 'in'));
    }
    return out;
  }

  /**
   * Takes out what has come to rest against another item or on a part that is no basket since
   * it was placed (a move of the baskets shifts things): of two items that touch, the one worth
   * fewer points, or the one that went in later. Cutlery in its basket is left alone.
   */
  private separate(): string[] {
    const removed: string[] = [];
    for (let round = 0; round < 2; round++) {
      const culprits = new Set<string>();
      for (const item of this.player.scene().placed) {
        const view = this.views.get(item.item_id);
        if (view === undefined || item.frame === 'cutlery_basket') continue;
        for (const contact of item.contacts) {
          const part = contact.with.split('.')[0] ?? '';
          const other = this.player.placed(contact.with);
          if (other !== undefined) {
            if (other.frame === 'cutlery_basket') continue;
            if (this.lightPairs.has([item.item_id, contact.with].sort().join('|'))) continue;
            // Two hollow pieces that have come to touch while each still stands in its basket
            // lean on one another; that is no reason to take either out.
            const hollowFamily = (v: ItemView | undefined): boolean =>
              v !== undefined &&
              (v.family === 'vessel' ||
                v.family === 'stemware' ||
                v.family === 'bowl' ||
                v.family === 'cookware' ||
                v.family === 'small');
            const inBasket = (state: PlacedItemState): boolean =>
              state.contacts.some((c) => !this.player.items.has(c.with));
            if (
              hollowFamily(view) &&
              hollowFamily(this.views.get(contact.with)) &&
              inBasket(item) &&
              inBasket(other)
            ) {
              continue;
            }
            // Of the two, the one worth less goes; of equal worth, the one that went in later.
            const theirView = this.views.get(contact.with);
            const worth = view.record.points - (theirView?.record.points ?? 0);
            const mine = this.sequence.get(item.item_id) ?? 0;
            const theirs = this.sequence.get(contact.with) ?? 0;
            const iGo = worth !== 0 ? worth < 0 : mine >= theirs;
            culprits.add(iGo ? item.item_id : contact.with);
          } else if (
            !this.player.items.has(contact.with) &&
            !part.startsWith('lower_rack') &&
            !part.startsWith('upper_rack') &&
            part !== 'cutlery_basket'
          ) {
            culprits.add(item.item_id);
          }
        }
      }
      if (culprits.size === 0) return removed;
      for (const id of culprits) {
        if (this.player.actionsLeft() < 2) return removed;
        if (
          this.takeOut(
            id,
            'taken out again: after the baskets were moved it rested against another item',
          )
        ) {
          removed.push(id);
        }
      }
      removed.push(...this.removeUnstable('taking out its neighbour'));
    }
    return removed;
  }

  /**
   * Takes out what the moves of the baskets have left lying over although it passes for stable:
   * a glass, a pot or a box further than {@link MAX_TIPPED} from mouth down, a bowl whose
   * opening has come to face upwards.
   */
  private removeTipped(): void {
    for (const item of [...this.player.scene().placed]) {
      const view = this.views.get(item.item_id);
      if (view === undefined || item.frame === 'cutlery_basket') continue;
      const down = 180 - mouthUpDeg(item);
      const hollow =
        view.family === 'vessel' || view.family === 'stemware' || view.family === 'cookware';
      const tipped =
        (hollow && !this.isSidePiece(view) && down > MAX_TIPPED) ||
        (view.family === 'bowl' && axisAt(item, [0, 0, 1])[2] > 0.2);
      if (!tipped || this.player.actionsLeft() < 2) continue;
      this.takeOut(
        item.item_id,
        'taken out again: the moves of the baskets left it lying over, its opening no longer down',
      );
    }
    this.removeUnstable('taking out its neighbour');
  }

  /** Asks `check_load` and takes out what blocks an arm, the tablet, the door or a basket. */
  private fixChecks(careful: boolean): void {
    for (let round = 0; round < 6; round++) {
      const check = this.player.checkLoad();
      if (!check.accepted) return;
      this.lastCheck = check;
      const culprits = new Set<string>();
      if (careful) {
        for (const arm of check.spray_arms) {
          if (!arm.full_rotation && arm.blocked_by !== undefined) culprits.add(arm.blocked_by);
        }
        for (const id of check.tablet_blocked_by) culprits.add(id);
        for (const id of check.dispenser_blocked_by) culprits.add(id);
      }
      for (const id of check.door_blocked_by) culprits.add(id);
      for (const rack of check.racks) {
        if (rack.blocked_by !== undefined) culprits.add(rack.blocked_by);
      }
      for (const id of check.fell_out) culprits.add(id);
      for (const id of check.on_tub_floor) culprits.add(id);
      // The careful loader lets nothing stick out of a basket; the careless one a little.
      const allowed = careful ? 0 : 3;
      for (const p of check.protruding) if (p.beyond_mm > allowed) culprits.add(p.item_id);
      const items = [...culprits].filter((id) => this.player.isPlaced(id));
      if (items.length === 0) return;
      const whyOf = (id: string): string => {
        const arm = check.spray_arms.find((a) => a.blocked_by === id);
        if (arm !== undefined) return `it stopped the ${arm.arm.replace('_', ' ')}`;
        if (check.tablet_blocked_by.includes(id)) return 'it stood in the path of the tablet';
        if (check.dispenser_blocked_by.includes(id))
          return 'it stood in the way of the dispenser lid';
        if (check.door_blocked_by.includes(id)) return 'it kept the door from closing';
        if (check.racks.some((rack) => rack.blocked_by === id))
          return 'it kept a basket from sliding in';
        if (check.fell_out.includes(id)) return 'it fell out when the baskets went in';
        if (check.on_tub_floor.includes(id)) return 'it ended on the floor of the tub';
        const out = check.protruding.find((p) => p.item_id === id);
        return `it stuck ${out?.beyond_mm ?? 0} mm out of the ${(out?.rack ?? 'basket').replace('_', ' ')}`;
      };
      for (const id of items) {
        if (this.player.actionsLeft() < 1) return;
        this.takeOut(id, `taken out again: check_load found that ${whyOf(id)}`);
      }
      this.removeUnstable('taking out its neighbour');
    }
  }

  // -------------------------------------------------------------------------------------------
  // The careful load
  // -------------------------------------------------------------------------------------------

  /** Tries once more to place items that a move of a basket threw or pushed together. */
  private retry(ids: readonly string[], rack: Rack): void {
    for (const id of ids) {
      const view = this.views.get(id);
      if (view === undefined || this.player.isPlaced(id)) continue;
      const reason = this.leftOut.get(id) ?? 'no place was found for it';
      this.leftOut.delete(id);
      this.lastReason.delete(id);
      let seated = false;
      if (view.family === 'cutlery') continue;
      if (rack === 'lower_rack') {
        seated =
          (this.isLowerEdge(view) &&
            this.seatEdge(view, rack, this.edgeSlots(view, rack, null), 1)) ||
          (this.isLowerHollow(view) && !this.isSidePiece(view) && this.placeCookware(view, null));
      } else {
        seated =
          (this.isUpperEdge(view) &&
            this.seatEdge(view, rack, this.edgeSlots(view, rack, null), 1)) ||
          (this.isFloorItem(view) &&
            (this.placeOnFloor(view) || this.placeHollowFree(view, 'upper_rack')));
      }
      if (!seated) this.leftOut.set(id, reason);
    }
    if (rack === 'lower_rack') this.placeCutlery();
  }

  /** Pushes a loaded basket in, and gives what that threw or pushed together one more go. */
  private pushLoaded(rack: Rack): void {
    const shaken = [...this.moveAndTidy(rack, 'in'), ...this.separate()];
    if (shaken.length === 0 || !this.canAct(3 * shaken.length + 4)) return;
    if (!this.travel(rack, 'out')) return;
    this.retry(shaken, rack);
    this.moveAndTidy(rack, 'in');
    this.separate();
  }

  private loadCarefully(finalTest: boolean): void {
    const player = this.player;
    const hasUpper = player.hasRack('upper_rack');
    const hasLower = player.hasRack('lower_rack');
    if (hasLower && this.travel('lower_rack', 'out')) {
      this.loadLower();
      this.pushLoaded('lower_rack');
    }
    if (hasUpper && this.travel('upper_rack', 'out')) {
      this.loadUpper();
      this.pushLoaded('upper_rack');
    }
    // What the upper basket had no room for and may go below gets a place in the lower one.
    const below = (): ItemView[] =>
      this.byValue(
        this.onCounter(
          (view) =>
            // (Light plastics stay in the upper basket; a rigid melamine bowl of a quarter of
            // a kilogram may go below when there is no room for it above.)
            (!view.upperOnly || view.record.mass_kg >= 0.2) &&
            (view.family === 'bowl' || view.family === 'vessel' || view.family === 'cookware') &&
            view.size[2] + 12 <= this.clearHeight('lower_rack'),
        ),
      );
    if (hasLower && below().length > 0 && this.canAct(8)) {
      if (hasUpper) this.travel('upper_rack', 'in');
      if (this.travel('lower_rack', 'out')) {
        const fails = new Map<string, number>();
        for (const view of below()) {
          const kind = view.record.display_name;
          if ((fails.get(kind) ?? 0) >= 2 || !this.canAct(4)) continue;
          const reason = this.leftOut.get(view.id);
          this.leftOut.delete(view.id);
          if (!this.placeHollowFree(view, 'lower_rack')) {
            fails.set(kind, (fails.get(kind) ?? 0) + 1);
            this.leftOut.set(view.id, reason ?? 'no room was left for it in either basket');
          }
        }
        this.pushLoaded('lower_rack');
      }
    }
    // A long utensil that found no room on the knife shelf stands in the cutlery basket when
    // it is short enough to stay under the upper arm there (a piece leans up to 20 degrees in
    // a cell: 306 mm of length reach 295 mm above the base grid, the arm sweeps at 313).
    const tall = this.onCounter(
      (view) =>
        view.family === 'utensil' &&
        view.longest <= UTENSIL_IN_BASKET_MAX &&
        (view.presets.has('handle_down') || view.presets.has('handle_up')),
    );
    if (hasLower && tall.length > 0 && this.canAct(3 * tall.length + 4)) {
      if (hasUpper) this.travel('upper_rack', 'in');
      if (this.travel('lower_rack', 'out')) {
        const reasons = new Map(tall.map((view) => [view.id, this.leftOut.get(view.id)]));
        for (const view of tall) this.leftOut.delete(view.id);
        this.placeCutlery(tall);
        for (const view of tall) {
          const reason = reasons.get(view.id);
          if (!this.player.isPlaced(view.id) && reason !== undefined) {
            this.leftOut.set(view.id, reason);
          }
        }
        this.pushLoaded('lower_rack');
      }
    }
    if (hasLower) this.travel('lower_rack', 'in');
    if (hasUpper) this.travel('upper_rack', 'in');
    if (!finalTest) return;
    // What the moves threw or pushed together gets one more go, with its old place struck out.
    const apart = [...this.travelTest(), ...this.separate()];
    for (const rack of ['lower_rack', 'upper_rack'] as const) {
      const mine = apart.filter((id) => {
        const view = this.views.get(id);
        if (view === undefined || view.family === 'cutlery') return false;
        const upper = this.isFloorItem(view) || (this.isUpperEdge(view) && !this.isLowerEdge(view));
        return (rack === 'upper_rack') === upper;
      });
      if (mine.length === 0 || !this.canAct(3 * mine.length + 6)) continue;
      if (!this.travel(rack, 'out')) continue;
      this.retry(mine, rack);
      this.moveAndTidy(rack, 'in');
      this.separate();
    }
    this.travel('lower_rack', 'in');
    this.travel('upper_rack', 'in');
    this.removeTipped();
    const before = new Set(this.player.scene().placed.map((item) => item.item_id));
    this.fixChecks(true);
    // What the checks took out of the upper basket (a cup that stuck out of it by a
    // millimetre) gets one more go elsewhere.
    const checkedOut = [...before].filter((id) => {
      const view = this.views.get(id);
      return !this.player.isPlaced(id) && view !== undefined && this.isFloorItem(view);
    });
    if (hasUpper && checkedOut.length > 0 && this.canAct(3 * checkedOut.length + 6)) {
      if (this.travel('upper_rack', 'out')) {
        this.retry(checkedOut, 'upper_rack');
        this.moveAndTidy('upper_rack', 'in');
        this.separate();
        this.fixChecks(true);
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // The careless mistakes
  // -------------------------------------------------------------------------------------------

  private wants(kind: MistakeKind): boolean {
    return this.style.mistakes.has(kind);
  }

  /** How many of the eligible items get a mistake of a kind: at least one, then by the rate. */
  private share(eligible: number): number {
    return eligible === 0 ? 0 : Math.max(1, Math.round(eligible * this.style.mistakeRate));
  }

  private record(kind: MistakeKind, itemId: string, withId?: string): void {
    this.tentative.push({
      kind,
      item_id: itemId,
      note: '',
      ...(withId === undefined ? {} : { with: withId }),
    });
  }

  /**
   * Puts an item back where it stood before a mistake that did not hold: at the pose it had
   * settled in (what was placed after it has settled round that pose, and may by now lean over
   * the pose it was first let go at), a millimetre or two higher if that is not free; failing
   * that, seated again in its slot by what `list_slots` suggests now, or let down into a cell
   * of the cutlery basket (pushed straight down into the bunch where no place is free); and
   * last the way it was first placed.
   */
  private restore(view: ItemView, entry: { request: PlaceRequest; slot: SlotCard | null }): void {
    if (this.player.isPlaced(view.id)) return;
    const stood = this.stood.get(view.id);
    const frame = (stood?.frame ?? entry.request.frame) as LoadFrame;
    const player = this.player;
    const place = (request: PlaceRequest): DropResult => this.place(request);
    const slotId = entry.slot?.id;
    const remembered: ReadonlyMap<string, SlotCard['suggested_drop']> =
      this.cellDrops.get(view.record.display_name) ?? new Map();
    function* attempts(): Generator<() => DropResult> {
      if (stood !== undefined) {
        const [x, y, z] = stood.position_mm;
        const at = (lift: number): PlaceRequest => ({
          item_id: view.id,
          frame: stood.frame,
          position_mm: [Math.round(x), Math.round(y), Math.ceil(z) + lift],
          orientation: { quat_wxyz: stood.quat_wxyz },
        });
        for (const lift of [0, 1, 2]) yield () => place(at(lift));
        // Between neighbours that have closed over its place (plates at 18 mm stand nested:
        // none comes out or goes in without the next giving way) it is pushed in as a hand
        // does it: along its own axis that points down, then straight down, with the 15 N of
        // `insert`, which moves the neighbours aside.
        const axes = ([0, 1, 2] as const)
          .flatMap((i) => {
            const axis = axisAt(stood, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]);
            return [axis, [-axis[0], -axis[1], -axis[2]] as [number, number, number]];
          })
          .filter((axis) => axis[2] < -0.8 && axis[2] > -0.9999)
          .sort((a, b) => a[2] - b[2]);
        for (const dir of [...axes.slice(0, 1), [0, 0, -1] as [number, number, number]]) {
          yield () => place({ ...at(2), mode: 'insert', insert_dir: dir });
        }
      }
      if (frame === 'cutlery_basket') {
        const cells = player
          .slotsFor('cutlery_basket', view.id)
          .filter((cell) => cell.kind === 'basket_cell');
        for (const cell of cells) {
          const drop = cell.suggested_drop;
          if (drop === undefined || cell.drop_free !== true) continue;
          yield () =>
            place({
              item_id: view.id,
              frame,
              position_mm: drop.position_mm,
              orientation: drop.orientation,
            });
        }
        // No place free straight down: pushed into the bunch, as the careful load does it.
        for (const drop of remembered.values()) {
          if (drop === undefined) continue;
          yield () =>
            place({
              item_id: view.id,
              frame,
              position_mm: drop.position_mm,
              orientation: drop.orientation,
              mode: 'insert',
              insert_dir: [0, 0, -1],
            });
        }
      } else if (slotId !== undefined) {
        const slot = player.slotsFor(frame, view.id).find((s) => s.id === slotId);
        const drop = slot?.suggested_drop;
        if (drop !== undefined && slot?.drop_free === true) {
          yield () =>
            place({
              item_id: view.id,
              frame,
              position_mm: drop.position_mm,
              orientation: drop.orientation,
            });
        }
      }
      yield () => place(entry.request);
    }
    // Back in the machine is enough: this is the careless load, and an item that goes back a
    // little askew is one more thing a careless person leaves.
    const back = (outcome: Outcome): string | null => {
      const r = outcome.result;
      if (r.fell_out) return 'it fell out of the basket';
      if (r.fell_through) return 'it fell through the basket';
      if (r.returned.length > 0) return 'something ended on the kitchen floor';
      return null;
    };
    const kept = this.settle(view, frame, attempts(), back, { maxBad: 2 });
    if (kept !== null) {
      this.kept.set(view.id, { request: entry.request, slot: entry.slot });
      return;
    }
    if (frame === 'lower_rack' || frame === 'upper_rack') {
      // Its own place is gone (a neighbour has closed over it): it is given another place in
      // the basket, by the careful rules for its kind.
      this.careless = false;
      try {
        if (frame === 'lower_rack') {
          if (
            !(
              this.isLowerEdge(view) &&
              this.seatEdge(view, frame, this.edgeSlots(view, frame, null), 1)
            ) &&
            this.isLowerHollow(view) &&
            !this.isSidePiece(view)
          ) {
            this.placeCookware(view, null);
          }
        } else if (
          !(
            this.isUpperEdge(view) &&
            this.seatEdge(view, frame, this.edgeSlots(view, frame, null), 1)
          ) &&
          this.isFloorItem(view) &&
          !this.placeOnFloor(view)
        ) {
          this.placeHollowFree(view, 'upper_rack');
        }
      } finally {
        this.careless = true;
      }
    }
    if (!this.player.isPlaced(view.id)) {
      this.leftOut.set(
        view.id,
        'taken out for a mistake that did not hold, and it would not go back',
      );
    }
  }

  /** A placed hollow item taken out and put back mouth up, on its side or flat face down. */
  private flip(
    view: ItemView,
    kind: 'cup_upright' | 'cup_on_side' | 'bowl_face_down_flat',
  ): boolean {
    const at = this.player.placed(view.id);
    const entry = this.kept.get(view.id);
    const preset =
      kind === 'cup_upright' ? 'upright' : kind === 'cup_on_side' ? 'on_side' : 'inverted';
    if (at === undefined || entry === undefined || !view.presets.has(preset)) return false;
    if (!this.canAct(4)) return false;
    const frame = at.frame as LoadFrame;
    const [x, y] = at.position_mm;
    const underShelf = this.underKnifeShelf.has(view.id);
    if (!this.takeOut(view.id, null)) return false;
    const lying = preset === 'on_side';
    const halfHeight = lying ? Math.max(view.size[0], view.size[1]) / 2 : view.size[2] / 2;
    const reach = Math.max(view.size[0], view.size[1], lying ? view.size[2] : 0) / 2;
    const attempts: (() => DropResult)[] = [];
    for (const [dx, dy] of [
      [0, 0],
      [10, 0],
      [-10, 0],
      [0, 10],
      [0, -10],
      [18, 18],
      [-18, -18],
    ] as const) {
      for (const yaw of lying ? [0, 90] : [0]) {
        attempts.push(() =>
          this.drop(
            view.id,
            frame,
            x + dx,
            y + dy,
            { preset, yaw_deg: yaw },
            dropHeights(this.player, frame, y + dy, halfHeight + 2, reach),
          ),
        );
      }
    }
    const judge =
      (strict: boolean) =>
      (outcome: Outcome): string | null => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        if (
          this.topOf(view, pose) >
          this.clearHeight(frame === 'upper_rack' ? frame : 'lower_rack') + 4
        ) {
          return 'it stands too high';
        }
        const attitude = hollowAttitude(pose);
        if (kind === 'bowl_face_down_flat') {
          return mouthUpDeg(pose) >= 160 ? null : 'it does not lie flat face down';
        }
        if (strict && attitude !== 'mouth_up') return 'it did not stay mouth up';
        return attitude === 'mouth_up' || attitude === 'on_side'
          ? null
          : 'it came to rest mouth down after all';
      };
    // A cup that is to stand mouth up is first asked to do so: where it stood on a sloped
    // side rest it lies over when it is put back upright on the same spot, and stands a
    // centimetre further up the slope. Only if it stands nowhere near is it left as it falls.
    if (underShelf && frame === 'upper_rack') {
      // What stood on the rest under the folded-down knife shelf cannot be put back there
      // from above: it is stood, or laid, wherever the basket still takes it, the nearest
      // free spot first. (Until 2026-10-11 such a piece was passed over, and a load of three
      // cups, all of them on that rest, had no cup the wrong way up: the tutorial.)
      // (Where one of its kind came to stand on the rest says nothing about where this one
      // comes to stand on the floor of the basket, upright or on its side.)
      this.landings.delete(`${view.record.display_name}|upper_rack|free`);
      const elsewhere = this.placeFree(
        view,
        'upper_rack',
        lying
          ? [
              { preset, yaw_deg: 0 },
              { preset, yaw_deg: 90 },
            ]
          : [{ preset }],
        judge(false),
        (px, py) => Math.hypot(px - x, py - y),
        { maxBad: 2 },
      );
      const now = this.player.placed(view.id);
      if (!elsewhere || now === undefined) {
        // Back where it stood: the knife shelf is folded up for it and down again, as the
        // careful hand did when it leant the cup on the rest; failing that, mouth down
        // wherever the basket takes it.
        const up = this.player.setRack('upper_rack', 'shelf_knife_shelf', 'up').accepted;
        this.restore(view, entry);
        if (up) this.player.setRack('upper_rack', 'shelf_knife_shelf', 'down');
        if (this.player.isPlaced(view.id)) this.underKnifeShelf.add(view.id);
        else {
          this.landings.delete(`${view.record.display_name}|upper_rack|free`);
          this.placeFree(
            view,
            'upper_rack',
            this.mouthDown(view),
            (outcome) => this.judgeHollow(view, 'upper_rack', outcome),
            (px, py) => Math.hypot(px - x, py - y),
          );
        }
        return false;
      }
      this.record(hollowMistakeOf(now) ?? kind, view.id);
      return true;
    }
    let kept =
      kind === 'cup_upright'
        ? this.settle(view, frame, attempts, judge(true), { maxBad: 4 })
        : null;
    kept ??= this.settle(view, frame, attempts, judge(false), { maxBad: 1 });
    if (kept === null) {
      this.restore(view, entry);
      return false;
    }
    const settled = kept.result.settled_pose;
    this.record(
      kind === 'bowl_face_down_flat' ? kind : (hollowMistakeOf(settled) ?? kind),
      view.id,
    );
    return true;
  }

  /** A placed plate taken out and put back in its slot with its face to the wall. */
  private turnPlate(view: ItemView): boolean {
    const entry = this.kept.get(view.id);
    const at = this.player.placed(view.id);
    if (entry === undefined || entry.slot === null || at === undefined || !this.canAct(4)) {
      return false;
    }
    const slot = entry.slot;
    const drop = slot.suggested_drop;
    if (drop === undefined) return false;
    const rack = at.frame as Rack;
    if (!this.takeOut(view.id, null)) return false;
    const envelope = this.player.envelope(rack);
    // Turned about its own upright axis: half a turn of yaw. With the roll (the lean) of the
    // opposite sign it leans the same way with the other face forward; with the same roll it
    // leans the other way, against the tines. Both are tried, the first also from a little
    // higher: turned round, the hollow side meets the tine first, and the pose that seats the
    // plate the right way round is not free for it.
    const roll = drop.orientation.roll_deg ?? 0;
    const alongX = Math.abs(slot.plate_normal?.[0] ?? 1) >= Math.abs(slot.plate_normal?.[1] ?? 0);
    const attempts: (() => DropResult)[] = [];
    for (const [turnedRoll, lift] of [
      [-roll, 0],
      [roll, 0],
      [-roll, 6],
      [roll, 6],
      // Held upright over the gap and let down from above the tine tips, as a plate is put
      // in without looking.
      [0, 30],
      [0, 100],
    ] as const) {
      const turned: Orientation = {
        preset: drop.orientation.preset,
        roll_deg: turnedRoll,
        yaw_deg: (drop.orientation.yaw_deg ?? 0) + 180,
      };
      for (const shift of [0, 6, -6, 12, -12]) {
        const position: [number, number, number] = [
          drop.position_mm[0] + (alongX ? shift : 0),
          drop.position_mm[1] + (alongX ? 0 : shift),
          drop.position_mm[2] + lift,
        ];
        attempts.push(() =>
          this.place({ item_id: view.id, frame: rack, position_mm: position, orientation: turned }),
        );
      }
    }
    const kept = this.settle(
      view,
      rack,
      attempts,
      (outcome) => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        if (this.topOf(view, pose) > this.clearHeight(rack) + 4) return 'it stands too high';
        if (Math.abs(outcome.axis[2]) > 0.6) return 'it fell over';
        return facesAway(pose, envelope) ? null : 'it does not face the wall';
      },
      { thin: 8, maxBad: 1 },
    );
    if (kept === null) {
      this.restore(view, entry);
      return false;
    }
    this.kept.set(view.id, { request: this.kept.get(view.id)?.request ?? entry.request, slot });
    this.record('plate_facing_away', view.id);
    return true;
  }

  /** A plate from the counter pushed into the seat of a plate that stands in the basket. */
  private crowdPlate(extra: ItemView, partner: ItemView): boolean {
    const entry = this.kept.get(partner.id);
    const at = this.player.placed(partner.id);
    if (entry === undefined || entry.slot === null || at === undefined || !this.canAct(3)) {
      return false;
    }
    const rack = at.frame as Rack;
    const slot = this.player.slotsFor(rack, extra.id).find((s) => s.id === entry.slot?.id);
    const drop = slot?.suggested_drop;
    if (slot === undefined || drop === undefined) return false;
    const alongX = Math.abs(slot.plate_normal?.[0] ?? 1) >= Math.abs(slot.plate_normal?.[1] ?? 0);
    const attempts: (() => DropResult)[] = [];
    for (const shift of [9, -9, 13, -13, 17, -17, 22, -22]) {
      const position: [number, number, number] = [
        drop.position_mm[0] + (alongX ? shift : 0),
        drop.position_mm[1] + (alongX ? 0 : shift),
        drop.position_mm[2],
      ];
      attempts.push(() =>
        this.place({
          item_id: extra.id,
          frame: rack,
          position_mm: position,
          orientation: drop.orientation,
        }),
      );
    }
    const kept = this.settle(
      extra,
      rack,
      attempts,
      (outcome) => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        if (this.topOf(extra, pose) > this.clearHeight(rack) + 4) return 'it stands too high';
        if (Math.abs(outcome.axis[2]) > 0.75) return 'it fell flat';
        return this.touched(outcome).length > 0 ? null : 'it found a seat of its own';
      },
      { thin: 8, maxBad: 1 },
    );
    if (kept === null) return false;
    const others = this.touched(kept);
    this.record(
      'plates_two_to_a_slot',
      extra.id,
      others.includes(partner.id) ? partner.id : others[0],
    );
    return true;
  }

  /** A bowl from the counter dropped into a bowl that is in the basket. */
  private nestBowl(extra: ItemView, under: ItemView): boolean {
    const at = this.player.placed(under.id);
    if (at === undefined || !this.canAct(3)) return false;
    const frame = at.frame as LoadFrame;
    const axis = axisAt(at, [0, 0, 1]);
    const [x, y, z] = at.position_mm;
    // Along the axis of the bowl below, on the side its foot is on.
    const out: Vec3 = [-axis[0], -axis[1], -axis[2]];
    const lift = Math.max(12, extra.size[2] * 0.35);
    const attempts: (() => DropResult)[] = [10, 18, 28, 40].map(
      (more) => () =>
        this.place({
          item_id: extra.id,
          frame,
          position_mm: [
            x + out[0] * (lift + more),
            y + out[1] * (lift + more),
            z + Math.max(out[2], 0.2) * (lift + more) + more,
          ],
          orientation: { quat_wxyz: at.quat_wxyz },
        }),
    );
    const kept = this.settle(
      extra,
      frame,
      attempts,
      (outcome) => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        const rack: Rack = frame === 'upper_rack' ? frame : 'lower_rack';
        if (this.topOf(extra, pose) > this.clearHeight(rack) + 4) return 'it stands too high';
        return this.touched(outcome).includes(under.id) ? null : 'it slid off the bowl below';
      },
      { maxBad: 1 },
    );
    if (kept === null) return false;
    this.record('bowls_nested', extra.id, under.id);
    return true;
  }

  /** A spoon laid into the bowl of a spoon of its kind that stands in the cutlery basket. */
  private nestSpoon(extra: ItemView, under: ItemView): boolean {
    const at = this.player.placed(under.id);
    if (at === undefined || !this.canAct(3)) return false;
    const face = axisAt(at, [0, 0, 1]);
    const heights = dropHeights(this.player, 'cutlery_basket', 0, extra.longest / 2, 0);
    const attempts: (() => DropResult)[] = [4, 6, 9, -4, -6].map(
      (off) => () =>
        this.place({
          item_id: extra.id,
          frame: 'cutlery_basket',
          position_mm: [
            at.position_mm[0] + face[0] * off,
            at.position_mm[1] + face[1] * off,
            Math.max(at.position_mm[2] + 25, (heights[0] ?? 200) - 60),
          ],
          orientation: { quat_wxyz: at.quat_wxyz },
        }),
    );
    const kept = this.settle(
      extra,
      'cutlery_basket',
      attempts,
      (outcome) => {
        const r = outcome.result;
        if (r.fell_out || r.fell_through || !r.stable) return 'it did not hold';
        if (this.lowEnd(extra, r.settled_pose) < -3) return 'it went through the floor';
        return this.touched(outcome).includes(under.id)
          ? null
          : 'it does not lie in the other spoon';
      },
      { maxBad: 1 },
    );
    if (kept === null) return false;
    this.record('spoons_nested', extra.id, under.id);
    return true;
  }

  /** Height above the lower basket's base grid at which the upper basket's floor passes. */
  private underUpperBasket(): number {
    const racks = this.player.card.machine.racks;
    const lower = racks.find((r) => r.rack === 'lower_rack')?.origin_in_mm[2] ?? 0;
    const upper = racks.find((r) => r.rack === 'upper_rack')?.origin_in_mm[2] ?? Infinity;
    return upper - lower - 12;
  }

  /** Whether `check_load` finds an arm stopped by an item as the machine stands now. */
  private stopsArm(itemId: string): boolean {
    const check = this.player.checkLoad();
    if (!check.accepted) return false;
    return check.spray_arms.some((arm) => !arm.full_rotation && arm.blocked_by === itemId);
  }

  /**
   * A tall flat piece stood on its short edge in the lower basket, so that it reaches into the
   * path of the upper arm yet lets the basket slide in under the upper one. Kept only when
   * `check_load` finds the arm stopped by it.
   */
  private standTall(view: ItemView): boolean {
    const clear = this.clearHeight('lower_rack');
    const preset = view.presets.has('on_short_edge')
      ? 'on_short_edge'
      : view.presets.has('on_edge_handle_up')
        ? 'on_edge_handle_up'
        : view.edgePreset;
    if (preset === null || !this.canAct(4)) return false;
    const tall = preset === view.edgePreset ? view.size[1] : Math.max(view.size[0], view.size[1]);
    if (tall + 10 <= clear + 12 || tall + 12 >= this.underUpperBasket()) return false;
    const entry = this.kept.get(view.id);
    if (this.player.isPlaced(view.id) && !this.takeOut(view.id, null)) return false;
    const [width, depth] = this.player.envelope('lower_rack');
    const attempts: (() => DropResult)[] = [];
    for (const x of [60, width - 60, 90, width - 90]) {
      for (const y of [depth * 0.55, depth * 0.7, depth * 0.4]) {
        attempts.push(() =>
          dropAt(
            this.player,
            view.id,
            'lower_rack',
            x,
            y,
            { preset, yaw_deg: 90, roll_deg: x < width / 2 ? -8 : 8 },
            [tall / 2 + 120],
          ),
        );
      }
    }
    const kept = this.settle(
      view,
      'lower_rack',
      attempts,
      (outcome) => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        if (this.topOf(view, outcome.result.settled_pose) <= clear + 10) {
          return 'it does not reach the arm';
        }
        return this.stopsArm(view.id) ? null : 'it does not stop the arm';
      },
      { maxBad: 1 },
    );
    if (kept === null) {
      if (entry !== undefined) this.restore(view, entry);
      return false;
    }
    this.record('tall_item_under_arm', view.id);
    return true;
  }

  /**
   * A knife or a long utensil stood on end in the upper basket, where it slips between the
   * floor wires and hangs into the path of the upper arm. Kept only when `check_load` finds the
   * arm stopped by it.
   */
  private hangThroughFloor(view: ItemView): boolean {
    const preset = ['handle_down', 'handle_up'].find((p) => view.presets.has(p));
    if (preset === undefined || !this.canAct(6)) return false;
    const [width, depth] = this.player.envelope('upper_rack');
    const attempts: (() => DropResult)[] = [];
    for (const [fx, fy] of [
      [0.62, 0.5],
      [0.5, 0.6],
      [0.72, 0.4],
      [0.4, 0.45],
      [0.8, 0.6],
      [0.56, 0.3],
    ] as const) {
      attempts.push(() =>
        this.drop(
          view.id,
          'upper_rack',
          width * fx,
          depth * fy,
          { preset },
          dropHeights(this.player, 'upper_rack', depth * fy, view.longest / 2 + 2, 20),
        ),
      );
    }
    const kept = this.settle(
      view,
      'upper_rack',
      attempts,
      (outcome) => {
        const r = outcome.result;
        if (r.fell_out || r.fell_through || r.returned.length > 0) return 'it fell through';
        if (!r.stable) return 'it did not come to a stable rest';
        if (this.lowEnd(view, r.settled_pose) > -10) return 'it does not hang through the floor';
        return this.stopsArm(view.id) ? null : 'it does not stop the arm';
      },
      { maxBad: 3 },
    );
    if (kept === null) return false;
    this.record('tall_item_under_arm', view.id);
    return true;
  }

  /** Something from the counter, or a cup from the basket, put down over the tablet tray. */
  private blockTablet(view: ItemView): boolean {
    const zone = this.tabletZone();
    if (zone === null || !this.canAct(4)) return false;
    const preset = ['inverted', 'upright', 'flat'].find((p) => view.presets.has(p));
    if (preset === undefined) return false;
    const entry = this.kept.get(view.id);
    if (this.player.isPlaced(view.id) && !this.takeOut(view.id, null)) return false;
    const centre = (zone.x0 + zone.x1) / 2;
    const halfY = Math.min(view.size[0], view.size[1]) / 2;
    const halfHeight = view.size[2] / 2;
    const attempts: (() => DropResult)[] = [];
    for (const [dx, y] of [
      [0, halfY + 10],
      [20, halfY + 16],
      [-20, halfY + 16],
      [0, halfY + 28],
      [45, halfY + 12],
      [-45, halfY + 12],
    ] as const) {
      attempts.push(() =>
        this.drop(
          view.id,
          'upper_rack',
          centre + dx,
          y,
          { preset, yaw_deg: 90 },
          dropHeights(this.player, 'upper_rack', y, halfHeight + 2, view.longest / 2),
        ),
      );
    }
    const kept = this.settle(
      view,
      'upper_rack',
      attempts,
      (outcome) => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        if (this.topOf(view, outcome.result.settled_pose) > this.clearHeight('upper_rack') + 4) {
          return 'it stands too high';
        }
        const check = this.player.checkLoad();
        if (!check.accepted) return 'no check';
        return check.tablet_blocked_by.includes(view.id) ||
          check.dispenser_blocked_by.includes(view.id)
          ? null
          : 'it does not block the tablet';
      },
      { maxBad: 2 },
    );
    if (kept === null) {
      if (entry !== undefined) this.restore(view, entry);
      return false;
    }
    this.record('tablet_tray_blocked', view.id);
    return true;
  }

  /** A flat piece from the counter laid over what stands in the upper basket. */
  private layOver(view: ItemView): boolean {
    const preset = ['flat', 'upright', 'inverted', 'flat_inverted', 'bowl_down'].find((p) =>
      view.presets.has(p),
    );
    if (preset === undefined || !this.canAct(3)) return false;
    const [width, depth] = this.player.envelope('upper_rack');
    const clear = this.clearHeight('upper_rack');
    const yaw = view.size[0] >= view.size[1] ? 0 : 90;
    const attempts: (() => DropResult)[] = [];
    for (const [fx, fy] of [
      [0.62, 0.55],
      [0.55, 0.42],
      [0.7, 0.65],
      [0.45, 0.6],
      [0.75, 0.35],
    ] as const) {
      attempts.push(() =>
        this.drop(view.id, 'upper_rack', width * fx, depth * fy, { preset, yaw_deg: yaw }, [
          clear - view.size[2] / 2 - 4,
          clear - view.size[2] / 2 - 30,
          clear - view.size[2] / 2 - 60,
        ]),
      );
    }
    const kept = this.settle(
      view,
      'upper_rack',
      attempts,
      (outcome) => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        if (this.topOf(view, pose) > clear + 4) return 'it stands too high';
        if (view.family !== 'utensil' && Math.abs(outcome.axis[2]) < 0.8)
          return 'it slid down on edge';
        return this.touched(outcome).length > 0 ? null : 'it lies on nothing';
      },
      { maxBad: 2 },
    );
    if (kept === null) return false;
    this.record('item_over_others', view.id, this.touched(kept)[0]);
    return true;
  }

  /**
   * An item from the counter pushed in where the careful loader found no room: let down
   * anywhere the session takes it, whatever it comes to rest against.
   */
  private cram(view: ItemView, rack: Rack): boolean {
    if (!this.canAct(3)) return false;
    const [width, depth] = this.player.envelope(rack);
    const clear = this.clearHeight(rack);
    const edge = view.family === 'flat' || (view.family === 'bowl' && rack === 'lower_rack');
    if (edge && view.edgePreset !== null) {
      // A plate goes into any seat between the tines, taken or not.
      this.careless = true;
      const slots = this.edgeSlots(view, rack, null);
      const order = this.rng.shuffle(slots).slice(0, 10);
      let current: SlotCard | null = null;
      const attempts: (() => DropResult)[] = [];
      for (const slot of order) {
        const drop = slot.suggested_drop;
        if (drop === undefined) continue;
        attempts.push(() => {
          current = slot;
          return this.place({
            item_id: view.id,
            frame: rack,
            position_mm: drop.position_mm,
            orientation: drop.orientation,
          });
        });
      }
      const kept = this.settle(
        view,
        rack,
        attempts,
        (outcome) => {
          const refused = this.common(outcome);
          if (refused !== null) return refused;
          return this.topOf(view, outcome.result.settled_pose) > clear + 4
            ? 'it stands too high'
            : null;
        },
        { thin: 8, maxBad: 1 },
      );
      const slot = current as SlotCard | null;
      if (kept === null) return false;
      const entry = this.kept.get(view.id);
      if (entry !== undefined) this.kept.set(view.id, { request: entry.request, slot });
      const others = this.touched(kept);
      if (others.length > 0) this.record('packed_tight', view.id, others[0]);
      return true;
    }
    const preset = ['inverted', 'inverted_tilted', 'inclined', 'upright'].find((p) =>
      view.presets.has(p),
    );
    if (preset === undefined) return false;
    if (view.size[2] + 10 > clear) return false;
    const half = Math.max(view.size[0], view.size[1]) / 2;
    const attempts: (() => DropResult)[] = [];
    for (let i = 0; i < 14; i++) {
      const x = half + 6 + this.rng.next() * Math.max(1, width - 2 * half - 12);
      const y = half + 6 + this.rng.next() * Math.max(1, depth - 2 * half - 12);
      const yaw = this.rng.int(4) * 90;
      attempts.push(() =>
        this.drop(
          view.id,
          rack,
          x,
          y,
          { preset, yaw_deg: yaw },
          dropHeights(this.player, rack, y, view.size[2] / 2 + 2, half),
        ),
      );
    }
    const kept = this.settle(
      view,
      rack,
      attempts,
      (outcome) => {
        const refused = this.common(outcome);
        if (refused !== null) return refused;
        const pose = outcome.result.settled_pose;
        if (this.topOf(view, pose) > clear + 4) return 'it stands too high';
        return pose.position_mm[2] - this.halfExtent(view, pose, 2) < -12
          ? 'it hangs through the floor'
          : null;
      },
      { maxBad: 1 },
    );
    if (kept === null) return false;
    const others = this.touched(kept);
    if (others.length > 0) this.record('packed_tight', view.id, others[0]);
    return true;
  }

  /** The seeded choice of `n` items from a list. */
  private choose(list: readonly ItemView[], n: number): ItemView[] {
    return this.rng.shuffle(list).slice(0, Math.max(0, n));
  }

  private placedIn(frame: LoadFrame, filter: (view: ItemView) => boolean): ItemView[] {
    return this.offered.filter(
      (view) =>
        filter(view) && this.player.placed(view.id)?.frame === frame && !this.hasMistake(view.id),
    );
  }

  /** The tine row an item was seated in, or null. */
  private rowOf(view: ItemView): string | null {
    return this.kept.get(view.id)?.slot?.id.split('.')[0] ?? null;
  }

  /** Items in the reverse of the order in which the careful load placed them. */
  private lastPlacedFirst(views: readonly ItemView[]): ItemView[] {
    return [...views].sort(
      (a, b) => (this.sequence.get(b.id) ?? 0) - (this.sequence.get(a.id) ?? 0),
    );
  }

  private hasMistake(itemId: string): boolean {
    return this.tentative.some((m) => m.item_id === itemId || m.with === itemId);
  }

  /** The mistakes, made on the careful load basket by basket. */
  private makeMistakes(): void {
    this.careless = true;
    const hollow = (view: ItemView): boolean =>
      view.family === 'vessel' || view.family === 'stemware';
    const plate = (view: ItemView): boolean =>
      view.family === 'flat' && view.outline === 'disc' && !this.isSidePiece(view);

    const rowsUsed = new Set<string>();
    if (this.player.hasRack('lower_rack') && this.travel('lower_rack', 'out')) {
      if (this.wants('tall_item_under_arm')) {
        const tall = this.byValue(
          this.offered.filter(
            (view) =>
              this.player.isPlaced(view.id) && (this.isSidePiece(view) || view.family === 'flat'),
          ),
        ).sort((a, b) => b.longest - a.longest);
        for (const view of tall.slice(0, 3)) if (this.standTall(view)) break;
      }
      if (this.wants('plate_facing_away')) {
        // One plate to a row, the last that was placed there: it alone goes back if the
        // mistake does not hold, and a turned plate leans over the slot beside it.
        const plates = this.lastPlacedFirst(this.placedIn('lower_rack', plate));
        let turned = 0;
        for (const view of plates) {
          if (turned >= this.share(plates.length)) break;
          const row = this.rowOf(view);
          if (row === null || rowsUsed.has(row)) continue;
          rowsUsed.add(row);
          if (this.turnPlate(view)) turned += 1;
        }
      }
      if (this.wants('plates_two_to_a_slot')) {
        // A plate taken from its own seat and pushed into its neighbour's. A row takes one
        // mistake, and it is taken only when the mistake holds (until 2026-10-11 a row was
        // closed by the attempt). On the present lower basket the attempt has not held in any
        // load of the game: no reference load has two plates to a slot.
        // (The plates that were placed last: plates at 18 mm stand nested, and only the last
        // of a row comes out and goes back without its neighbours giving way.)
        const seated = this.lastPlacedFirst(this.placedIn('lower_rack', plate));
        let made = 0;
        const wanted = this.share(Math.floor(seated.length / 2));
        for (const extra of seated) {
          if (made >= wanted) break;
          if (this.hasMistake(extra.id)) continue;
          const row = this.rowOf(extra);
          if (row === null || rowsUsed.has(row)) continue;
          const partner = this.choose(
            seated.filter(
              (view) =>
                view.id !== extra.id &&
                !this.hasMistake(view.id) &&
                this.player.isPlaced(view.id) &&
                view.size[0] >= extra.size[0] - 40,
            ),
            1,
          )[0];
          const entry = this.kept.get(extra.id);
          if (partner === undefined || entry === undefined) continue;
          if (!this.takeOut(extra.id, null)) continue;
          if (this.crowdPlate(extra, partner)) {
            made += 1;
            rowsUsed.add(row);
          } else this.restore(extra, entry);
        }
      }
      if (this.wants('spoons_nested') && this.player.hasRack('cutlery_basket')) {
        const spoons = this.placedIn('cutlery_basket', (view) => view.spoon);
        let made = 0;
        // A share of the spoons is laid into another spoon (until 2026-10-11: a share of the
        // pairs, which made one nest in a load of four to eight spoons and showed nothing of
        // what nesting costs); no more than every second spoon can lie in another.
        const wanted = Math.min(Math.floor(spoons.length / 2), this.share(spoons.length));
        for (const under of this.choose(spoons, spoons.length)) {
          if (made >= wanted) break;
          if (this.hasMistake(under.id)) continue;
          const same = (view: ItemView): boolean =>
            view.spoon &&
            view.record.display_name === under.record.display_name &&
            view.id !== under.id;
          // A spoon of the same kind from another cell, laid into this one.
          const extra = this.lastPlacedFirst(spoons).find(
            (view) => same(view) && !this.hasMistake(view.id) && this.player.isPlaced(view.id),
          );
          if (extra === undefined) continue;
          const entry = this.kept.get(extra.id);
          if (entry === undefined || !this.takeOut(extra.id, null)) continue;
          if (this.nestSpoon(extra, under)) made += 1;
          else this.restore(extra, entry);
        }
      }
      if (this.wants('cutlery_bunched') && this.player.hasRack('cutlery_basket')) {
        this.bunchCutlery();
      }
      if (this.wants('bowls_nested')) this.nestBowls('lower_rack');
      this.travel('lower_rack', 'in');
    }

    const goBack: { view: ItemView; entry: { request: PlaceRequest; slot: SlotCard | null } }[] =
      [];
    if (this.player.hasRack('upper_rack') && this.travel('upper_rack', 'out')) {
      // (Not what stands on the rest under the knife shelf: it cannot be put back there, or
      // anywhere near, from above while the shelf is down.)
      // What stands on the rest under the knife shelf comes last: it cannot be put back
      // there from above while the shelf is down, and goes elsewhere in the basket (`flip`).
      const open = this.placedIn(
        'upper_rack',
        (view) => hollow(view) && !this.underKnifeShelf.has(view.id),
      );
      const under = this.placedIn(
        'upper_rack',
        (view) => hollow(view) && this.underKnifeShelf.has(view.id),
      );
      const cups = [...open, ...under];
      const chosen = [...this.choose(open, open.length), ...this.choose(under, under.length)];
      const each = this.share(cups.length);
      if (this.wants('cup_upright')) {
        let made = 0;
        for (const view of chosen) {
          if (made >= each) break;
          if (!this.hasMistake(view.id) && this.flip(view, 'cup_upright')) made += 1;
        }
      }
      if (this.wants('cup_on_side')) {
        let made = 0;
        for (const view of chosen) {
          if (made >= each) break;
          if (!this.hasMistake(view.id) && this.flip(view, 'cup_on_side')) made += 1;
        }
      }
      if (this.wants('bowl_face_down_flat')) {
        const bowls = this.placedIn('upper_rack', (view) => view.family === 'bowl');
        for (const view of this.choose(bowls, this.share(bowls.length))) {
          this.flip(view, 'bowl_face_down_flat');
        }
      }
      if (this.wants('bowls_nested')) this.nestBowls('upper_rack');
      if (this.wants('item_over_others')) {
        // A small plate or a utensil of the upper basket, taken from its place and laid over
        // what stands beside it.
        const covers = this.choose(
          this.placedIn(
            'upper_rack',
            (view) =>
              (view.family === 'flat' && view.longest <= 300 && view.longest >= 120) ||
              view.family === 'utensil',
          ),
          999,
        );
        let made = 0;
        for (const view of covers) {
          if (made >= Math.max(1, this.share(Math.floor(covers.length / 2)))) break;
          const entry = this.kept.get(view.id);
          if (entry === undefined || !this.takeOut(view.id, null)) continue;
          if (this.layOver(view)) made += 1;
          else this.restore(view, entry);
        }
      }
      if (this.wants('tablet_tray_blocked')) {
        const candidates = this.choose(
          this.placedIn('upper_rack', (view) => hollow(view) && !this.underKnifeShelf.has(view.id)),
          3,
        );
        for (const view of candidates) if (this.blockTablet(view)) break;
      }
      if (
        this.wants('tall_item_under_arm') &&
        !this.tentative.some((m) => m.kind === 'tall_item_under_arm')
      ) {
        // A knife taken from the cutlery basket and stood on end in the upper basket.
        const long = this.offered
          .filter(
            (view) =>
              (view.knife || view.family === 'utensil') &&
              this.player.isPlaced(view.id) &&
              !this.hasMistake(view.id),
          )
          .sort((a, b) => a.size[1] - b.size[1] || b.longest - a.longest);
        for (const view of long.slice(0, 2)) {
          const entry = this.kept.get(view.id);
          if (entry === undefined || !this.takeOut(view.id, null)) continue;
          if (this.hangThroughFloor(view)) break;
          // (Its own basket is pushed in by now: it goes back when that is out again.)
          goBack.push({ view, entry });
        }
      }
      this.travel('upper_rack', 'in');
      if (goBack.length > 0 && this.travel('lower_rack', 'out')) {
        for (const { view, entry } of goBack) this.restore(view, entry);
        this.travel('lower_rack', 'in');
      }
    }
    this.travel('lower_rack', 'in');
    this.travel('upper_rack', 'in');
    // What the last moves left unsteady stays in: a careless load is washed as it lies (the
    // saved load lists such items as unstable). Only what stops a basket, the door or an arm
    // by accident comes out.
    this.fixChecks(false);
  }

  /**
   * Pieces of cutlery taken from their cells and stood beside the first of their kind, so that
   * like stands with like in one cell (forks with forks, knives with knives): a seeded share
   * of the pieces of every kind of which two or more are in the basket and free of another
   * mistake.
   */
  private bunchCutlery(): void {
    const cells = this.player.slots('cutlery_basket').slots.filter((s) => s.kind === 'basket_cell');
    const byKind = new Map<string, ItemView[]>();
    for (const view of this.placedIn('cutlery_basket', (v) => v.family === 'cutlery')) {
      if (this.hasMistake(view.id)) continue;
      const list = byKind.get(view.record.display_name) ?? [];
      list.push(view);
      byKind.set(view.record.display_name, list);
    }
    for (const kind of byKind.values()) {
      if (kind.length < 2) continue;
      const ordered = [...kind].sort(
        (a, b) => (this.sequence.get(a.id) ?? 0) - (this.sequence.get(b.id) ?? 0),
      );
      const home = ordered[0] as ItemView;
      const wanted = this.share(ordered.length - 1);
      let made = 0;
      for (const extra of this.choose(ordered.slice(1), ordered.length)) {
        if (made >= wanted) break;
        if (!this.player.isPlaced(home.id)) break;
        const entry = this.kept.get(extra.id);
        if (entry === undefined || !this.takeOut(extra.id, null)) continue;
        if (this.standBeside(extra, home, cells)) made += 1;
        else this.restore(extra, entry);
      }
    }
  }

  /** Lets a piece of cutlery down into the cell another of its kind stands in. */
  private standBeside(extra: ItemView, home: ItemView, cells: readonly SlotCard[]): boolean {
    const at = this.player.placed(home.id);
    if (at === undefined || !this.canAct(3)) return false;
    const cell = this.cellOf(cells, at.position_mm[0], at.position_mm[1]);
    if (cell === null) return false;
    const listed = this.player
      .slotsFor('cutlery_basket', extra.id)
      .find((candidate) => candidate.id === cell.id);
    const drop =
      listed?.suggested_drop ?? this.cellDrops.get(extra.record.display_name)?.get(cell.id);
    if (drop === undefined) return false;
    const attempts: (() => DropResult)[] = [];
    if (listed?.drop_free === true) {
      attempts.push(() =>
        this.place({
          item_id: extra.id,
          frame: 'cutlery_basket',
          position_mm: drop.position_mm,
          orientation: drop.orientation,
        }),
      );
    }
    // Pushed down into the bunch, as a hand does it (`insert`, straight down, with its 15 N).
    attempts.push(() =>
      this.place({
        item_id: extra.id,
        frame: 'cutlery_basket',
        position_mm: drop.position_mm,
        orientation: drop.orientation,
        mode: 'insert',
        insert_dir: [0, 0, -1],
      }),
    );
    const kept = this.settle(
      extra,
      'cutlery_basket',
      attempts,
      (outcome) => {
        const r = outcome.result;
        if (r.fell_out || r.fell_through) return 'it did not hold';
        if (r.returned.length > 0) return 'something ended on the kitchen floor';
        if (this.lowEnd(extra, r.settled_pose) < -3) return 'it went through the floor';
        const now = this.cellOf(
          cells,
          r.settled_pose.position_mm[0],
          r.settled_pose.position_mm[1],
        );
        return now?.id === cell.id ? null : 'it did not come to stand in the cell';
      },
      { maxBad: 1 },
    );
    if (kept === null) return false;
    this.record('cutlery_bunched', extra.id, home.id);
    return true;
  }

  /** Bowls of a basket taken from their place and dropped into another bowl of their size. */
  private nestBowls(rack: Rack): void {
    const isBowl = (view: ItemView): boolean => view.family === 'bowl';
    const inRack = (): ItemView[] =>
      this.offered.filter(
        (view) =>
          isBowl(view) && this.player.placed(view.id)?.frame === rack && !this.hasMistake(view.id),
      );
    let made = 0;
    // A share of the bowls of the basket is dropped into another bowl (until 2026-10-11: a
    // share of the pairs); no more than every second bowl can lie in another.
    const wanted = Math.min(Math.floor(inRack().length / 2), this.share(inRack().length));
    // (No more attempts than nests wanted and one: an attempt that fails disturbs the row.)
    let tried = 0;
    for (const extra of this.choose(inRack(), 999)) {
      if (made >= wanted || tried > wanted) break;
      if (this.hasMistake(extra.id) || !this.player.isPlaced(extra.id)) continue;
      const under = inRack().find(
        (view) => view.id !== extra.id && Math.abs(view.size[0] - extra.size[0]) <= 30,
      );
      const entry = this.kept.get(extra.id);
      if (under === undefined || entry === undefined) continue;
      const stoodAt = this.player.placed(extra.id)?.position_mm ?? [0, 0, 0];
      if (!this.takeOut(extra.id, null)) continue;
      tried += 1;
      if (this.nestBowl(extra, under)) made += 1;
      else {
        this.restore(extra, entry);
        // A bowl that will not go back into its seat (bowls in a row stand over each other's
        // places) is put down where the basket still takes it, the nearest free spot to its
        // own place first, as a careless hand would: it is not left on the counter for a
        // mistake that did not hold.
        if (!this.player.isPlaced(extra.id)) {
          this.landings.delete(`${extra.record.display_name}|${rack}|free`);
          this.placeFree(
            extra,
            rack,
            this.mouthDown(extra),
            (outcome) => this.common(outcome),
            (px, py) => Math.hypot(px - stoodAt[0], py - stoodAt[1]),
            { maxBad: 3 },
          );
        }
      }
    }
  }

  /** The settled load as the mistakes are read against. */
  private settledLoad(): SettledLoad {
    const state = this.player.refresh();
    const envelopes = new Map<string, readonly [number, number, number]>();
    for (const rack of this.player.card.machine.racks) envelopes.set(rack.rack, rack.envelope_mm);
    return {
      placed: new Map<string, PlacedItemState>(state.placed.map((item) => [item.item_id, item])),
      views: this.views,
      envelopes,
      check: this.lastCheck,
    };
  }

  /**
   * Reads every mistake that was made against the settled load: what still holds is described
   * by its measured pose, what settled as another mistake is relabelled, what settled as none
   * is dropped.
   */
  private measuredMistakes(): MistakeMade[] {
    if (this.tentative.length === 0) return [];
    const load = this.settledLoad();
    const out: MistakeMade[] = [];
    const seen = new Set<string>();
    for (const made of this.tentative) {
      const item = load.placed.get(made.item_id);
      if (item === undefined || seen.has(`${made.kind}|${made.item_id}`)) continue;
      let mistake: MistakeMade = made;
      if (mistakeHolds(mistake, load) !== null) {
        const others = neighboursOf(item, load);
        const view = this.views.get(made.item_id);
        const hollow = hollowMistakeOf(item);
        const candidates: MistakeMade[] = [];
        if ((made.kind === 'cup_upright' || made.kind === 'cup_on_side') && hollow !== null) {
          candidates.push({ kind: hollow, item_id: made.item_id, note: '' });
        }
        for (const other of others) {
          candidates.push({ kind: made.kind, item_id: made.item_id, note: '', with: other });
        }
        if (view?.family === 'flat' && others[0] !== undefined) {
          candidates.push({
            kind: 'item_over_others',
            item_id: made.item_id,
            note: '',
            with: others[0],
          });
          candidates.push({
            kind: 'packed_tight',
            item_id: made.item_id,
            note: '',
            with: others[0],
          });
        }
        const found = candidates.find((candidate) => mistakeHolds(candidate, load) === null);
        if (found === undefined) continue;
        mistake = found;
      }
      seen.add(`${mistake.kind}|${mistake.item_id}`);
      out.push({ ...mistake, note: this.describe(mistake, item) });
    }
    return out;
  }

  /** What the settled pose of a mistake shows, in words. */
  private describe(mistake: MistakeMade, item: PlacedItemState): string {
    const up = Math.round(mouthUpDeg(item));
    const where = item.frame.replace('_', ' ');
    switch (mistake.kind) {
      case 'cup_upright':
        return `stands mouth up in the ${where}, ${up} degrees from the vertical`;
      case 'cup_on_side':
        return `lies on its side in the ${where}, its axis ${Math.abs(up - 90)} degrees from the horizontal`;
      case 'bowl_face_down_flat':
        return `lies face down flat in the ${where}, ${180 - up} degrees from straight down`;
      case 'plate_facing_away':
        return `stands in the ${where} with its eating face to the wall`;
      case 'plates_two_to_a_slot':
        return `pushed into the seat of ${mistake.with} in the ${where}, touching it`;
      case 'bowls_nested':
        return `lies in ${mistake.with} in the ${where}`;
      case 'spoons_nested':
        return `lies in the bowl of ${mistake.with} in the cutlery basket`;
      case 'cutlery_bunched':
        return `stands with ${mistake.with}, another of its kind, in one cell of the cutlery basket`;
      case 'item_over_others':
        return `lies over ${mistake.with ?? 'the items below'} in the ${where}`;
      case 'packed_tight':
        return `pushed into the ${where} against ${mistake.with}`;
      case 'tablet_tray_blocked':
        return `stands in the path of the detergent tablet at the front of the ${where}`;
      case 'tall_item_under_arm': {
        const arm = this.lastCheck?.spray_arms.find((a) => a.blocked_by === mistake.item_id);
        return `stops the ${(arm?.arm ?? 'spray arm').replace('_', ' ')} at ${arm?.first_contact_angle_deg ?? 0} degrees`;
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // The whole load
  // -------------------------------------------------------------------------------------------

  /** Loads the machine and leaves both baskets pushed in. */
  run(): LoadingReport {
    const player = this.player;
    const careless = this.style.policy === 'careless' && this.style.mistakes.size > 0;
    // The careless load starts from the whole careful one, final test of the baskets and
    // checks included, so that the two hold the same items before the first mistake.
    this.loadCarefully(true);
    if (careless) this.makeMistakes();
    const against = this.leansAgainst.filter((id) => player.isPlaced(id));
    if (against.length > 0) {
      this.notes.push(
        `${against.length} plate(s) stand leaning against the tines of their row, the eating face to the centre and tilted down: ${against.join(', ')}. Every seat that was left let a plate of this depth come to rest only that way.`,
      );
    }
    const mistakes = this.measuredMistakes();
    const placed = this.offered.filter((view) => player.isPlaced(view.id)).map((view) => view.id);
    const leftOut: LeftOut[] = [];
    for (const view of this.offered) {
      if (player.isPlaced(view.id)) continue;
      leftOut.push({
        item_id: view.id,
        reason:
          this.leftOut.get(view.id) ?? this.lastReason.get(view.id) ?? 'no place was found for it',
      });
    }
    return { placed, leftOut, mistakes, check: this.lastCheck, notes: this.notes };
  }
}

/**
 * Angle by which the long axis of a piece of cutlery or a utensil (its item x axis) turned from
 * where it was asked to point, degrees. Turning about its own length does not count.
 */
export function longAxisTurn(outcome: Outcome): number {
  return angleDeg(
    axisAt(outcome.result.requested_pose, [1, 0, 0]),
    axisAt(outcome.result.settled_pose, [1, 0, 0]),
  );
}
