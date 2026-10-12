/**
 * What the geometry of the stand-in rack implies for an item, worked out from the rack's
 * dimensions and the item's exact shape without the physics engine: how far a plate can lean in
 * a tine slot, whether an inverted cup goes over the tines, and whether an item laid flat on the
 * base grid is carried by it. The scenarios compare the simulation with these.
 *
 * Units: metres and radians. Frame: the rack frame of `stand-in-rack.ts`.
 */

import type { Pose, Quat, Vec3 } from '@spotless/core';
import { poseInverseTransformPoint, quatFromAxisAngle } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { boundingBox, signedDistance } from '@spotless/geometry';
import type { PlateSlot, StandInRack } from './stand-in-rack.ts';

/** Spacing of the points sampled along the axis of a wire, metres. */
const WIRE_SAMPLE_STEP = 0.0005;
/** Step in which a plate is brought up to a row of tines, metres (under a wall thickness). */
const APPROACH_STEP = 0.001;

/** A straight wire or tine: a capsule in the rack frame. */
interface Wire {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly radius: number;
}

/**
 * Signed gap between a shape at a pose and a set of wires: the smallest distance from a wire
 * axis to the shape's surface less the wire radius (negative when a wire is inside the shape).
 * Exact up to the sampling of the axes, since the kernel's signed distance is exact outside a
 * round shell.
 */
function gapToWires(shape: Shape, pose: Pose, wires: readonly Wire[]): number {
  let gap = Infinity;
  for (const wire of wires) {
    const length = Math.hypot(wire.b[0] - wire.a[0], wire.b[1] - wire.a[1], wire.b[2] - wire.a[2]);
    const n = Math.max(1, Math.ceil(length / WIRE_SAMPLE_STEP));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const point: Vec3 = [
        wire.a[0] + f * (wire.b[0] - wire.a[0]),
        wire.a[1] + f * (wire.b[1] - wire.a[1]),
        wire.a[2] + f * (wire.b[2] - wire.a[2]),
      ];
      gap = Math.min(
        gap,
        signedDistance(shape, poseInverseTransformPoint(pose, point)) - wire.radius,
      );
    }
  }
  return gap;
}

/** Bisects for the boundary between `free(lo)` true and `free(hi)` false; returns the free side. */
function boundary(free: (x: number) => boolean, lo: number, hi: number, tolerance: number): number {
  let a = lo;
  let b = hi;
  while (Math.abs(b - a) > tolerance) {
    const mid = (a + b) / 2;
    if (free(mid)) a = mid;
    else b = mid;
  }
  return a;
}

/**
 * The orientation of a plate standing on its edge across the tine rails and leaning back by
 * `lean` radians: its axis (item +z, the food side) points to the front (-y) and up by `lean`,
 * its top edge leans to the back. `lean` 0 is the catalogue's `on_edge` pose, 20 degrees its
 * `leaning` pose.
 */
export function leaningOrientation(lean: number): Quat {
  return quatFromAxisAngle([1, 0, 0], Math.PI / 2 - lean);
}

/** Where a plate of a given lean can stand in a slot. */
export interface SlotFit {
  /** Lean of the plate back from the vertical, radians. */
  readonly lean: number;
  /** Height of the item origin at which the plate rests on the base grid, metres. */
  readonly z: number;
  /**
   * Range of y of the item origin over which the plate touches neither the tines in front of
   * the slot nor those behind it, metres; `yMax < yMin` when it does not fit at this lean.
   */
  readonly yMin: number;
  readonly yMax: number;
  /** `yMax - yMin`: the play of the plate in the slot at this lean (negative: it does not fit). */
  readonly play: number;
}

/**
 * Where a round plate, standing on its edge across the two tine rails with its centre midway
 * between them and leaning back by `lean`, fits in a slot: the height at which it rests on the
 * base grid and the range of positions along the rail in which it clears the tines before and
 * behind it. Pure geometry: the exact shape against the wires of the rack.
 */
export function slotFit(rack: StandInRack, slot: PlateSlot, plate: Shape, lean: number): SlotFit {
  const q = leaningOrientation(lean);
  const rGrid = rack.opening.lowerLayerDrop / 2;
  const rTine = rack.dims.tineWireMm / 2000;
  const box = boundingBox(plate, { p: [0, 0, 0], q });
  const midY = (slot.frontY + slot.backY) / 2;
  // The grid wires under the plate, long enough for wherever it stands in the slot.
  const reach = box.max[1] - box.min[1] + (slot.backY - slot.frontY);
  const grid: Wire[] = rack.wiresAlongY
    .filter((x) => x > slot.centreX + box.min[0] && x < slot.centreX + box.max[0])
    .map((x) => ({ a: [x, midY - reach, -rGrid], b: [x, midY + reach, -rGrid], radius: rGrid }));
  const zFree = (z: number): boolean =>
    gapToWires(plate, { p: [slot.centreX, midY, z], q }, grid) >= 0;
  const zHigh = -box.min[2] + 0.01;
  const z = boundary(zFree, zHigh, -box.min[2] - 0.02, 1e-7);
  const tine = (x: number, y: number): Wire => ({
    a: [x, y, -rGrid],
    b: [x, y, slot.tineHeight - rTine],
    radius: rTine,
  });
  const front = slot.railX.map((x) => tine(x, slot.frontY));
  const back = slot.railX.map((x) => tine(x, slot.backY));
  const clear = (y: number, tines: readonly Wire[]): boolean =>
    gapToWires(plate, { p: [slot.centreX, y, z], q }, tines) >= 0;
  // Bring the plate up to a row of tines from the side of the slot, starting where its bounding
  // box is clear of them, in steps too short to jump over a wall or a tine, until it first
  // touches; then close in on that position.
  const approach = (tines: readonly Wire[], from: number, direction: 1 | -1): number => {
    const depth = box.max[1] - box.min[1] + 4 * rTine;
    let free = from;
    for (let travelled = 0; travelled <= depth; travelled += APPROACH_STEP) {
      const next = free + direction * APPROACH_STEP;
      if (!clear(next, tines)) return boundary((y) => clear(y, tines), free, next, 1e-7);
      free = next;
    }
    // Nothing in the way at any position: the plate passes the tines altogether.
    return direction * Infinity;
  };
  const yMin = approach(front, slot.frontY + rTine - box.min[1] + 1e-6, -1);
  const yMax = approach(back, slot.backY - rTine - box.max[1] - 1e-6, 1);
  return { lean, z, yMin, yMax, play: yMax - yMin };
}

/**
 * The largest lean (radians, back from the vertical) at which a round plate still fits in a
 * slot: leaning further, it would have to pass through the tines in front of its foot or behind
 * its back. A plate that slides forward on the base grid until the front tines stop it comes to
 * rest at this lean. Returns `null` when the plate does not fit in the slot even upright.
 * Resolved to 0.01 degrees.
 */
export function maxLeanInSlot(rack: StandInRack, slot: PlateSlot, plate: Shape): number | null {
  if (slotFit(rack, slot, plate, 0).play < 0) return null;
  const limit = Math.PI / 3;
  if (slotFit(rack, slot, plate, limit).play >= 0) return limit;
  return boundary(
    (lean) => slotFit(rack, slot, plate, lean).play >= 0,
    0,
    limit,
    (0.01 * Math.PI) / 180,
  );
}

/** Whether an inverted round vessel goes down over the tines of a rail at a given place. */
export interface OverTinesFit {
  /** True when no tine is under the rim: the vessel can be lowered until its rim is on the grid. */
  readonly fits: boolean;
  /** Number of tines that end up inside the vessel. */
  readonly inside: number;
  /** Index (from the front) and distance from the vessel's axis of the tines under the rim. */
  readonly blocking: readonly { readonly tine: number; readonly distance: number }[];
}

/**
 * Whether a round rim of inner radius `innerRadius` and outer radius `outerRadius` (metres),
 * centred at (`x`, `y`) in the rack frame, goes down over the plate tines: every tine must be
 * either wholly inside the rim or wholly outside it. A tine under the rim blocks the vessel,
 * which then rests on the tine tips.
 */
export function fitOverTines(
  rack: StandInRack,
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
): OverTinesFit {
  const rTine = rack.dims.tineWireMm / 2000;
  let inside = 0;
  const blocking: { tine: number; distance: number }[] = [];
  const tineY: number[] = [];
  for (const slot of rack.slots) tineY.push(slot.frontY);
  const last = rack.slots[rack.slots.length - 1];
  if (last !== undefined) tineY.push(last.backY);
  const rails = rack.slots[0]?.railX ?? [];
  for (const railX of rails) {
    tineY.forEach((ty, k) => {
      const distance = Math.hypot(railX - x, ty - y);
      if (distance + rTine <= innerRadius) inside++;
      else if (distance - rTine < outerRadius) blocking.push({ tine: k, distance });
    });
  }
  return { fits: blocking.length === 0, inside, blocking };
}

/** The plan-view footprint of an item lying flat, as far as the base grid is concerned. */
export interface FlatFootprint {
  /** Length along the item's long axis (item +x), from x = 0, metres. */
  readonly length: number;
  /** Width across it (item y), metres. */
  readonly width: number;
  /** Distance of the centre of mass from the x = 0 end, along the long axis, metres. */
  readonly comAlong: number;
}

/** How an item is laid flat on the base grid. */
export interface FlatPlacement {
  /**
   * Direction of the item's long axis in the rack frame: `'x'` lays it across the front-to-back
   * wires, `'y'` lays it along them.
   */
  readonly along: 'x' | 'y';
  /** Position of the item's x = 0 end on its centreline, (x, y) in the rack frame, metres. */
  readonly start: readonly [number, number];
}

/** What the base grid does with an item laid flat on it. */
export type FlatDropVerdict =
  | {
      /** The grid carries the item: wires pass under it on both sides of its centre of mass. */
      readonly outcome: 'rests';
      /** The layer it rests on: the front-to-back wires (`'upper'`) or those under them. */
      readonly on: 'upper' | 'lower';
      /**
       * How far the item could be moved along its long axis before the verdict changed, metres:
       * the distance of an end from the outermost wire under it, or of the centre of mass from
       * the nearest wire that carries it.
       */
      readonly margin: number;
      /**
       * For an item lying along the front-to-back wires: the clearance on each side between it
       * and the two wires it lies between, metres.
       */
      readonly sideSlack?: number;
    }
  | {
      /** No two wires carry it: it tips over the one wire under it, or drops straight through. */
      readonly outcome: 'falls_through';
      readonly margin: number;
      readonly sideSlack?: number;
    }
  | {
      /** The statics of parallel supports do not decide it (it lies along a wire, for one). */
      readonly outcome: 'undetermined';
      readonly reason: string;
    };

/**
 * Supports among parallel wires at positions `wires` for a bar from `start` to `start + length`
 * with its centre of mass at `com`: the nearest wire under the bar on each side of the centre of
 * mass, and how far the nearest wires that are not under it are from its ends.
 */
function straddle(
  wires: readonly number[],
  start: number,
  length: number,
  com: number,
): { readonly rests: boolean; readonly margin: number } {
  const end = start + length;
  const under = wires.filter((w) => w > start && w < end);
  const before = under.filter((w) => w < com);
  const after = under.filter((w) => w > com);
  if (before.length > 0 && after.length > 0) {
    // It rests while the outermost wire on each side stays under it, away from the very end.
    const first = under[0] as number;
    const last = under[under.length - 1] as number;
    return { rests: true, margin: Math.min(first - start, end - last, com - first, last - com) };
  }
  // It tips over what is under it. The verdict changes when another wire comes under an end, or
  // when the centre of mass crosses the outermost wire under it.
  const outside = wires.filter((w) => w <= start || w >= end);
  let margin = Infinity;
  for (const w of outside) margin = Math.min(margin, w <= start ? start - w : w - end);
  for (const w of under) margin = Math.min(margin, Math.abs(com - w));
  return { rests: false, margin };
}

/**
 * What the base grid does with a slender item released lying flat and level just above it,
 * from the statics of a rigid bar on parallel supports and the clear openings of the grid:
 *
 * - Across the front-to-back wires (`along: 'x'`) it rests on them when wires pass under it on
 *   both sides of its centre of mass; with wires on one side only it tips and slides through.
 * - Along them (`along: 'y'`), centred in the gap between two wires and narrower than the gap,
 *   it passes the upper layer and meets the left-to-right wires one wire diameter lower: it
 *   rests on those when two of them straddle its centre of mass, and otherwise tips over the one
 *   under it (or meets none) and goes through to the tub floor.
 * - Lying along a wire, or wider than the gap it lies in, the verdict is `'undetermined'`.
 *
 * `margin` says how far along its axis the placement is from a different verdict; near zero the
 * real outcome depends on bounce and friction. `sideSlack` is the room the item has between the
 * two wires it lies between.
 */
export function flatDropVerdict(
  rack: StandInRack,
  item: FlatFootprint,
  placement: FlatPlacement,
): FlatDropVerdict {
  const [x, y] = placement.start;
  if (placement.along === 'x') {
    const result = straddle(rack.wiresAlongY, x, item.length, x + item.comAlong);
    return result.rests
      ? { outcome: 'rests', on: 'upper', margin: result.margin }
      : { outcome: 'falls_through', margin: result.margin };
  }
  // Along the wires: which gap of the upper layer is the centreline in, and does the item fit?
  const wires = rack.wiresAlongY;
  const right = wires.findIndex((w) => w > x);
  if (right <= 0) {
    return { outcome: 'undetermined', reason: 'the item is outside the front-to-back wires' };
  }
  const gapCentre = ((wires[right - 1] as number) + (wires[right] as number)) / 2;
  const slack = (rack.opening.alongX - item.width) / 2 - Math.abs(x - gapCentre);
  if (slack <= 0) {
    return {
      outcome: 'undetermined',
      reason: 'the item lies on a front-to-back wire or is wider than the gap between two',
    };
  }
  const result = straddle(rack.wiresAlongX, y, item.length, y + item.comAlong);
  return result.rests
    ? { outcome: 'rests', on: 'lower', margin: result.margin, sideSlack: slack }
    : { outcome: 'falls_through', margin: result.margin, sideSlack: slack };
}
