/**
 * The moves a loading policy is made of, each played through the session exactly as a player
 * would play it:
 *
 *  - {@link seatOnEdge}: stand a plate, a lid, a board or a bowl on edge in a slot between the
 *    tines of a row. In a row of leaning tines nothing can be lowered straight down into a slot
 *    (the tip of each tine hangs over the foot of the next), so the item is slid in along the
 *    tines with `place` in mode `insert`. The pose it is slid to is found by asking: a rejected
 *    `place` is free and says how deep the pose collides, so the search walks from the lean of
 *    the tines towards upright until a pose is clear.
 *  - {@link dropAt}: lower an item straight down at a spot and let it go (mode `drop`), from a
 *    height that is clear of the basket and, under the roof of the tub, of the roof.
 *
 * Every accepted placement is read back as an {@link Outcome}; the policies judge it and take
 * the item out again when it has fallen over, slid away or pushed its neighbours.
 */

import type { Vec3 } from '@spotless/core';
import type {
  DropAccepted,
  DropResult,
  Orientation,
  SlotCard,
  TineRowCard,
} from '@spotless/session';
import type { ItemView } from './families.ts';
import type { LoadFrame, Outcome, Player } from './player.ts';
import { edgeOffsetsFor, outcomeOf } from './player.ts';

// ---------------------------------------------------------------------------------------------
// Lanes: a pair of parallel tine rows that hold a plate together
// ---------------------------------------------------------------------------------------------

/** One slot of a lane. */
export interface LaneSlot {
  readonly id: string;
  /** Position of the slot centre along the rail axis, millimetres. */
  readonly along: number;
  /** Clear width between the two tines, millimetres. */
  readonly width: number;
  /** Lean of the tines from the vertical, degrees (0 for upright tines). */
  readonly leanDeg: number;
  /** Which way the tops of the tines lean along the rail axis: -1, 0 (upright) or +1. */
  readonly leanSign: -1 | 0 | 1;
  /** True for the wide gap where two tines lean apart. */
  readonly wide: boolean;
}

/** Two parallel tine rows of a basket (or one row without a partner) and the slots they share. */
export interface Lane {
  readonly rack: LoadFrame;
  readonly id: string;
  /** Index of the rack-frame axis the rails run along (0 for x, 1 for y). */
  readonly railAxis: 0 | 1;
  /** Index of the horizontal axis across the rails. */
  readonly acrossAxis: 0 | 1;
  /** Midpoint between the two rails across them, millimetres. */
  readonly centreAcross: number;
  /** Distance between the two rails, millimetres (0 for a single row). */
  readonly spacing: number;
  /** Height of the rails above the rack origin, millimetres. */
  readonly railZ: number;
  /** Height of the tine tips above the rack origin, millimetres. */
  readonly tineTopZ: number;
  /** Pitch of the tines, millimetres. */
  readonly pitch: number;
  /** Slots in order along the rail. */
  readonly slots: readonly LaneSlot[];
}

function slotOf(slot: SlotCard, railAxis: 0 | 1): LaneSlot {
  const lean = slot.lean_deg ?? 0;
  const nz = slot.plate_normal?.[2] ?? 0;
  return {
    id: slot.id,
    along: slot.centre_mm[railAxis],
    width: slot.width_mm,
    leanDeg: lean,
    // The listed normal tilts up where the tines lean towards the negative rail direction.
    leanSign: lean === 0 || nz === 0 ? 0 : nz > 0 ? -1 : 1,
    wide: slot.kind === 'wide_slot',
  };
}

/**
 * The lanes of a basket: every pair of partner rows once (the row with fewer slots gives the
 * slots, since an item has to fit both), in the order of `list_slots`. Folded rows are left out.
 */
export function lanesOf(player: Player, rack: LoadFrame): Lane[] {
  if (rack === 'cutlery_basket' || rack === 'third_rack') return [];
  const { rows, slots } = player.slots(rack);
  const byId = new Map<string, TineRowCard>(rows.map((row) => [row.id, row]));
  const lanes: Lane[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.folded || seen.has(row.id)) continue;
    const partner = row.partner === undefined ? undefined : byId.get(row.partner.id);
    if (partner === undefined || partner.folded || partner.partner?.id !== row.id) continue;
    seen.add(row.id);
    seen.add(partner.id);
    const railAxis: 0 | 1 = row.runs === 'x' ? 0 : 1;
    const acrossAxis: 0 | 1 = railAxis === 0 ? 1 : 0;
    const own = slots.filter((s) => s.tine_row === row.id);
    const other = slots.filter((s) => s.tine_row === partner.id);
    const fewer = own.length <= other.length ? own : other;
    lanes.push({
      rack,
      id: `${row.id}+${partner.id}`,
      railAxis,
      acrossAxis,
      centreAcross: (row.start_mm[acrossAxis] + partner.start_mm[acrossAxis]) / 2,
      spacing: Math.abs(row.start_mm[acrossAxis] - partner.start_mm[acrossAxis]),
      railZ: Math.max(row.start_mm[2], partner.start_mm[2]),
      tineTopZ: Math.max(row.height_mm, partner.height_mm),
      pitch: Math.max(row.pitch_mm, partner.pitch_mm),
      slots: fewer.map((s) => slotOf(s, railAxis)).sort((a, b) => a.along - b.along),
    });
  }
  return lanes;
}

// ---------------------------------------------------------------------------------------------
// Dropping
// ---------------------------------------------------------------------------------------------

/** Height from which things are dropped where nothing is overhead, millimetres. */
export const OPEN_DROP_Z = 330;
/**
 * Distance in front of the tub's front edge from which the door frame and the roof are in the
 * way of a tall drop, millimetres. [ESTIMATED from the session's rejections]
 */
const ROOF_MARGIN = 45;

/**
 * Heights (of the item's reference point, rack frame) to try for a drop at a spot: clear of
 * everything where the sky is open, under the roof where the pulled-out basket still stands in
 * the tub. `halfHeight` and `halfWidth` are the item's half extents in the orientation it is
 * dropped in.
 */
export function dropHeights(
  player: Player,
  frame: LoadFrame,
  y: number,
  halfHeight: number,
  halfWidth: number,
): number[] {
  const rack = frame === 'cutlery_basket' ? 'lower_rack' : frame;
  const card = player.card.machine.racks.find((r) => r.rack === frame);
  const envelopeZ = player.envelope(rack)[2];
  if (card === undefined) return [OPEN_DROP_Z];
  const origin = player.isOut(rack) ? card.origin_out_mm : card.origin_in_mm;
  const rearEdgeTub = origin[1] + y + halfWidth;
  const underRoof = rearEdgeTub > player.card.machine.tub_min_mm[1] - ROOF_MARGIN;
  const roofZ = player.card.machine.tub_max_mm[2] - origin[2];
  if (frame === 'cutlery_basket') return [halfHeight + 150, halfHeight + 135];
  // The session takes no reference point above the roof of the tub, in the open or not.
  if (!underRoof) return [Math.min(Math.max(OPEN_DROP_Z, halfHeight + 110), roofZ - 2)];
  const top = Math.min(roofZ - 8, envelopeZ + 20);
  return [top - halfHeight, top - halfHeight - 20, top - halfHeight - 40].filter(
    (z) => z - halfHeight > 0,
  );
}

/**
 * `place` in mode `drop` at a spot, from the first of the given heights at which the pose is
 * free. Returns the accepted result or the last rejection.
 */
export function dropAt(
  player: Player,
  itemId: string,
  frame: LoadFrame,
  x: number,
  y: number,
  orientation: Orientation,
  heights: readonly number[],
): DropResult {
  let last: DropResult = { accepted: false, reason: 'collision_at_pose' };
  for (const z of heights) {
    last = player.place({ item_id: itemId, frame, position_mm: [x, y, z], orientation });
    if (last.accepted || last.reason !== 'collision_at_pose') return last;
  }
  return last;
}

// ---------------------------------------------------------------------------------------------
// Standing an item on edge in a lane
// ---------------------------------------------------------------------------------------------

/** How an item stands when it is on edge: its half extents, millimetres. */
export interface EdgeShape {
  /** Half the extent across the rails (horizontal, in the item's plane). */
  readonly halfAcross: number;
  /** Half the vertical extent. */
  readonly halfUp: number;
  /** Extent along the rail (the thickness of the item: the depth of a plate). */
  readonly depth: number;
  /**
   * Distance from the middle of that thickness to the plane of the edge the item stands on,
   * along the face normal: a plate stands on its rim, which is at the face side.
   */
  readonly edgeOffset: number;
  /** Height of the item's centre above the rails when it stands upright on both of them. */
  centreHeight(spacing: number): number;
}

/** The standing shape of a flat item or bowl in its on-edge preset. */
export function edgeShapeOf(view: ItemView): EdgeShape {
  const [sx, sy, sz] = view.size;
  const halfAcross = sx / 2;
  const halfUp = sy / 2;
  const rimmed = view.outline !== 'rect';
  return {
    halfAcross,
    halfUp,
    depth: sz,
    edgeOffset: rimmed ? Math.max(0, sz / 2 - 3) : 0,
    centreHeight: (spacing) => {
      const half = spacing / 2;
      if (view.outline === 'rect' || spacing === 0) return halfUp;
      if (halfAcross <= half + 4) return Number.NaN;
      return halfUp * Math.sqrt(1 - (half / halfAcross) ** 2);
    },
  };
}

/** What a policy asks of {@link seatOnEdge}. */
export interface SeatRequest {
  readonly lane: Lane;
  readonly slot: LaneSlot;
  /** Which way the face (the item's `+z`) looks along the rail axis: -1 or +1. */
  readonly face: -1 | 1;
  /** Where the item's centre goes across the rails; default the middle of the lane. */
  readonly across?: number;
  /** Rails the item rests on are this far apart; default the lane's own spacing. */
  readonly spacing?: number;
  /** Extra millimetres along the rail added to the first guess (to crowd or to nest). */
  readonly shift?: number;
  /**
   * Start the search this many degrees away from the lean of the tines, towards upright and
   * beyond (default 0), and do not use a remembered pose.
   */
  readonly leanFrom?: number;
  /** Lean (with the tines, degrees) at which the search gives up; default -20. */
  readonly leanTo?: number;
  /**
   * How far along the rail the search may move the item from its first guess, millimetres.
   * Default: just under half a pitch, so that the item's edge stays in the slot it was sent
   * to. A long piece that stands across several rows needs more, since their tines do not line
   * up.
   */
  readonly reach?: number;
}

/** A pose that worked for a kind of item in a lane, to be tried first for the next one. */
interface Recipe {
  readonly lean: number;
  readonly offset: number;
}

/** Memory of {@link seatOnEdge} across the items of one policy run. */
export type SeatMemory = Map<string, Recipe>;

/** The outcome of {@link seatOnEdge} with the pose that was found. */
export interface SeatOutcome extends Outcome {
  /** Lean of the pose with the tines, degrees. */
  readonly lean: number;
  /** Offset of the pose along the rail from the first guess, millimetres. */
  readonly offset: number;
  /** Key under which {@link rememberSeat} keeps the pose. */
  readonly key: string;
}

/** Keeps the pose of a placement that held, to be tried first for the next item of its kind. */
export function rememberSeat(memory: SeatMemory, seat: SeatOutcome): void {
  memory.set(seat.key, { lean: seat.lean, offset: seat.offset });
}

const DEG = Math.PI / 180;

/** Height above the estimated seat at which an item is let go, millimetres. */
const SEAT_CLEARANCE = 4;
/** Top of a rail above the base of its tines, millimetres [ESTIMATED: half a coated wire]. */
const RAIL_TOP = 2.2;

/**
 * Stands an item on edge in a slot of a lane. Returns the outcome of the accepted placement
 * with the pose that was found, or null when no clear pose was found (nothing was placed and
 * nothing charged). The caller judges the outcome and calls {@link rememberSeat} if it held.
 *
 * The pose is described by the lean of the item with the tines (positive: its top goes the way
 * the tines' tops go) and by where its centre is along the rail. The search starts at the lean
 * of the tines and walks towards upright and beyond, at each lean trying a few offsets along
 * the rail; the first pose the session accepts is where the item is slid to and let go, a few
 * millimetres above the rails.
 */
export function seatOnEdge(
  player: Player,
  view: ItemView,
  request: SeatRequest,
  memory: SeatMemory,
): SeatOutcome | null {
  if (view.edgePreset === null) return null;
  const { lane, slot, face } = request;
  const shape = edgeShapeOf(view);
  const spacing = request.spacing ?? lane.spacing;
  const centreHeight = shape.centreHeight(spacing);
  if (!Number.isFinite(centreHeight)) return null;
  const across = request.across ?? lane.centreAcross;
  // Upright tines: the item leans away from the way it faces, so that its face looks up.
  const leanDir = slot.leanSign === 0 ? (-face as -1 | 1) : slot.leanSign;
  const tineLean = slot.leanDeg;
  const rail: Vec3 = lane.railAxis === 0 ? [1, 0, 0] : [0, 1, 0];
  const key = `${view.record.display_name}|${lane.id}|${slot.leanSign}|${face}`;

  const poseFor = (lean: number, offset: number): { position: Vec3; orientation: Orientation } => {
    const a = lean * DEG;
    // Face normal: along the rail, tipped up by the lean when the item leans away from it.
    const normal: Vec3 = [
      face * Math.cos(a) * rail[0],
      face * Math.cos(a) * rail[1],
      -face * leanDir * Math.sin(a),
    ];
    const guess =
      leanDir * shape.halfUp * Math.sin(a) - face * shape.edgeOffset * Math.cos(a) + offset;
    const along = slot.along + (request.shift ?? 0) + guess;
    const z =
      lane.railZ + RAIL_TOP + centreHeight * Math.cos(a) + Math.abs(shape.edgeOffset * Math.sin(a));
    const position: Vec3 = lane.railAxis === 0 ? [along, across, z] : [across, along, z];
    return {
      position,
      orientation: { preset: view.edgePreset as string, ...edgeOffsetsFor(normal) },
    };
  };

  // Slide in along the tines; where the sky above the start of the approach is not open (the
  // upper basket hangs over the rear of the pulled-out lower one), come in at a slant from the
  // front. Upright tines take a plain drop.
  const s = Math.sin(tineLean * DEG);
  const c = Math.cos(tineLean * DEG);
  const approaches: Vec3[] = [0, 0.1, 0.22, 0.4].map((drift) => [
    -slot.leanSign * s * rail[0],
    -slot.leanSign * s * rail[1] + (lane.railAxis === 0 ? drift : 0),
    -c,
  ]);
  let approach = 0;
  let clearance = SEAT_CLEARANCE;

  const attempt = (lean: number, offset: number): DropResult => {
    const pose = poseFor(lean, offset);
    if (slot.leanSign === 0) {
      const heights = dropHeights(
        player,
        lane.rack,
        pose.position[1],
        shape.halfUp + 2,
        lane.railAxis === 0 ? shape.halfAcross : shape.depth / 2,
      );
      return dropAt(
        player,
        view.id,
        lane.rack,
        pose.position[0],
        pose.position[1],
        pose.orientation,
        heights,
      );
    }
    // Ask first: a pose that overlaps the basket itself is not tried (an `insert` only pushes
    // other items aside), and the answer says how deep, which steers the search.
    const asked = player.preview({
      item_id: view.id,
      frame: lane.rack,
      position_mm: [pose.position[0], pose.position[1], pose.position[2] + clearance],
      orientation: pose.orientation,
    });
    if (
      asked.accepted &&
      !asked.collision_free &&
      asked.colliding_with.some((id) => !player.items.has(id))
    ) {
      return {
        accepted: false,
        reason: 'collision_at_pose',
        penetration_mm: asked.penetration_mm,
        colliding_with: asked.colliding_with,
      };
    }
    for (;;) {
      const result = player.place({
        item_id: view.id,
        frame: lane.rack,
        position_mm: [pose.position[0], pose.position[1], pose.position[2] + clearance],
        orientation: pose.orientation,
        mode: 'insert',
        insert_dir: approaches[approach] as Vec3,
      });
      if (result.accepted || result.reason !== 'not_insertable') return result;
      // Only a start that is not in free space is cured by a slant; a tine in the way is not.
      const startBlocked = (result.detail ?? '').includes('free space');
      if (!startBlocked || approach + 1 >= approaches.length) return result;
      approach += 1;
    }
  };

  const finish = (result: DropAccepted, lean: number, offset: number): SeatOutcome => ({
    ...outcomeOf(result),
    lean,
    offset,
    key,
  });

  const remembered = request.leanFrom === undefined ? memory.get(key) : undefined;
  if (remembered !== undefined) {
    for (const delta of [0, 1, -1, 2, -2]) {
      const result = attempt(remembered.lean, remembered.offset + delta);
      if (result.accepted) return finish(result, remembered.lean, remembered.offset + delta);
      if (result.reason !== 'collision_at_pose') break;
    }
  }

  // The item's edge stays in the slot it was sent to: offsets up to half a pitch.
  const reach = request.reach ?? Math.max(3, lane.pitch / 2 - 1.5);
  const coarse = [0, 3, -3, 6, -6, 9, -9, 12, -12, 15, -15].filter(
    (offset) => Math.abs(offset) <= reach,
  );
  const lowest = request.leanTo ?? -20;
  // A second pass lets go from higher, for an item whose seat height was guessed too low.
  // (Only for outlines whose seat height is an estimate: a disc's is exact.)
  const passes = view.outline === 'disc' ? [SEAT_CLEARANCE] : [SEAT_CLEARANCE, SEAT_CLEARANCE + 7];
  for (const pass of passes) {
    clearance = pass;
    let lean = tineLean - (request.leanFrom ?? 0);
    while (lean >= lowest) {
      let best = Infinity;
      let bestOffset = 0;
      for (const offset of coarse) {
        const result = attempt(lean, offset);
        if (result.accepted) return finish(result, lean, offset);
        if (result.reason === 'collision_at_pose') {
          const depth = result.penetration_mm ?? Infinity;
          if (depth < best) {
            best = depth;
            bestOffset = offset;
          }
        } else if (result.reason !== 'not_insertable') {
          // Out of bounds, out of budget, already placed: no lean will change that.
          return null;
        }
      }
      if (best <= 2) {
        for (const delta of [1, -1, 2, -2]) {
          if (Math.abs(bestOffset + delta) > reach + 1) continue;
          const result = attempt(lean, bestOffset + delta);
          if (result.accepted) return finish(result, lean, bestOffset + delta);
        }
      }
      lean -= best > 4 ? 3 : best > 2.5 ? 2 : 1;
    }
    if (slot.leanSign === 0) break;
  }
  return null;
}
