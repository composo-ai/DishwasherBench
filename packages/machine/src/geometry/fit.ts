/**
 * What fits where, computed from the generated geometry: the largest plate that stands in a
 * basket under whatever is above it, and what falls through a base grid.
 *
 * A plate is a thin disc standing in a slot of a tine row, in the plane that row's tines hold
 * it in (`TineSlot.plateNormal`). Everything of the basket that the plane cuts is an obstacle in
 * that plane; the disc is lowered from above at each position across the basket until it
 * touches, and settles in the hollows of that envelope: on two rails, on a rail and against a
 * wall, or on the floor wires between rows. The disc is then tested against the swept volumes
 * of the arms, the fixed sprayers, the roof and the walls of the tub, and against the plan
 * outline of its own basket: a plate that leans out over the rim of its basket does not stand
 * in it, because the strip between a basket and the tub wall belongs to the guide rails,
 * roller carriers and wheel ledges, and the basket has to slide past them.
 *
 * Simplifications: the plate has no thickness and no rim profile (a real plate, 20 to 30 mm
 * deep, leans a little more and stands a few millimetres lower); wires that cross the plane
 * obliquely count with their round section; other parts count as their bounding boxes; whether
 * the plate can be put in from above is not checked. Rack frame of the basket, metres.
 */

import type { Pose, Vec3 } from '@spotless/core';
import {
  poseCompose,
  poseInverse,
  poseTransformPoint,
  v3Add,
  v3AddScaled,
  v3Cross,
  v3Dot,
  v3Sub,
} from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { boundingBox } from '@spotless/geometry';
import type { BasketSpec, MachineSpec, Range } from '../types.ts';
import { floorRiseAt } from '../outline.ts';
import { rimLoop, insideRim } from './rim.ts';
import { sweptDistance, sweptPenetration } from './swept.ts';
import { tubInterior } from './tub.ts';
import type {
  BasketEnvelope,
  MachineGeometry,
  MachinePart,
  TineRowAffordance,
  TineSlot,
} from './types.ts';

// ---------------------------------------------------------------------------------------------
// A disc in a plane among obstacles
// ---------------------------------------------------------------------------------------------

/** A plane a plate stands in: a point, and two unit vectors spanning it. Rack frame. */
export interface PlatePlane {
  /** A point of the plane: the slot's centre on the rail. */
  readonly origin: Vec3;
  /** Horizontal unit vector in the plane (across the rail). */
  readonly across: Vec3;
  /** Unit vector in the plane pointing up the lean. */
  readonly up: Vec3;
  /** Unit normal. */
  readonly normal: Vec3;
}

/** A round obstacle in a plate plane: centre `(q, s)` along `across` and `up`, radius `r`. Metres. */
export interface PlaneObstacle {
  readonly q: number;
  readonly s: number;
  readonly r: number;
}

/** The plane of a slot. */
export function slotPlane(slot: TineSlot): PlatePlane {
  const normal = slot.plateNormal;
  // The horizontal in-plane direction is perpendicular to the normal and to z.
  const acrossRaw = v3Cross([0, 0, 1], normal);
  const length = Math.hypot(acrossRaw[0], acrossRaw[1], acrossRaw[2]);
  const across: Vec3 = [acrossRaw[0] / length, acrossRaw[1] / length, acrossRaw[2] / length];
  const up = v3Cross(normal, across);
  return { origin: slot.centre, across, up: up[2] >= 0 ? up : [-up[0], -up[1], -up[2]], normal };
}

/** Spacing of the points a capsule's centre line is sampled at, metres. */
const WIRE_SAMPLE = 0.001;
/** Spacing of the points the outline of a box is sampled at, metres. */
const BOX_SAMPLE = 0.002;
/** Obstacles are merged on a grid of this size, metres. */
const MERGE = 0.001;
/** Spacing of the points the face of a plate is sampled at when it is tested against an arm, metres. */
const INTERIOR_SAMPLE = 0.004;

/**
 * Everything of the given shapes that a plane cuts, as round obstacles in the plane. `pose` maps
 * a shape's frame to the frame of the plane. A capsule contributes the discs in which the plane
 * cuts the balls along its centre line; any other primitive contributes the outline of the
 * rectangle in which the plane cuts its bounding box.
 */
export function planeObstacles(
  shapes: readonly { readonly shape: Shape; readonly pose: Pose }[],
  plane: PlatePlane,
): PlaneObstacle[] {
  const merged = new Map<string, PlaneObstacle>();
  const add = (p: Vec3, radius: number): void => {
    const rel = v3Sub(p, plane.origin);
    const d = v3Dot(rel, plane.normal);
    if (Math.abs(d) >= radius && radius > 0) return;
    const q = v3Dot(rel, plane.across);
    const s = v3Dot(rel, plane.up);
    const r = radius > 0 ? Math.sqrt(radius * radius - d * d) : 0;
    const key = `${Math.round(q / MERGE)},${Math.round(s / MERGE)}`;
    const old = merged.get(key);
    if (old === undefined || old.r < r) merged.set(key, { q, s, r });
  };
  for (const { shape, pose } of shapes) {
    for (const part of shape.parts) {
      const whole = poseCompose(pose, part.pose);
      if (part.prim.kind === 'capsule') {
        const a = poseTransformPoint(whole, part.prim.a);
        const b = poseTransformPoint(whole, part.prim.b);
        const radius = part.prim.radius;
        const da = v3Dot(v3Sub(a, plane.origin), plane.normal);
        const db = v3Dot(v3Sub(b, plane.origin), plane.normal);
        if (Math.min(da, db) > radius || Math.max(da, db) < -radius) continue;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const steps = Math.max(1, Math.ceil(length / WIRE_SAMPLE));
        for (let i = 0; i <= steps; i++) add(v3AddScaled(a, v3Sub(b, a), i / steps), radius);
        continue;
      }
      const box = boundingBox(
        { parts: [{ ...part, pose: { p: [0, 0, 0], q: [0, 0, 0, 1] } }], regions: [] },
        whole,
      );
      // The plane is upright or nearly so: walk the outline of the box in (across, z) and keep
      // the points of the plane there that are inside the box.
      const corners: Vec3[] = [];
      for (const x of [box.min[0], box.max[0]])
        for (const y of [box.min[1], box.max[1]]) corners.push([x, y, 0]);
      const qs = corners.map((c) => v3Dot(v3Sub(c, plane.origin), plane.across));
      const q0 = Math.min(...qs);
      const q1 = Math.max(...qs);
      const z0 = box.min[2];
      const z1 = box.max[2];
      const inside = (p: Vec3): boolean =>
        p[0] >= box.min[0] - 1e-6 &&
        p[0] <= box.max[0] + 1e-6 &&
        p[1] >= box.min[1] - 1e-6 &&
        p[1] <= box.max[1] + 1e-6;
      const at = (q: number, z: number): void => {
        const s = (z - plane.origin[2] - q * plane.across[2]) / plane.up[2];
        const p = v3Add(
          plane.origin,
          v3Add(
            [plane.across[0] * q, plane.across[1] * q, plane.across[2] * q],
            [plane.up[0] * s, plane.up[1] * s, plane.up[2] * s],
          ),
        );
        if (inside(p)) add(p, 0);
      };
      const nq = Math.max(1, Math.ceil((q1 - q0) / BOX_SAMPLE));
      const nz = Math.max(1, Math.ceil((z1 - z0) / BOX_SAMPLE));
      for (let i = 0; i <= nq; i++) {
        at(q0 + ((q1 - q0) * i) / nq, z0);
        at(q0 + ((q1 - q0) * i) / nq, z1);
      }
      for (let j = 0; j <= nz; j++) {
        at(q0, z0 + ((z1 - z0) * j) / nz);
        at(q1, z0 + ((z1 - z0) * j) / nz);
      }
    }
  }
  return [...merged.values()].sort((a, b) => a.q - b.q || a.s - b.s);
}

/** Where a disc comes to rest in a plane. */
export interface DiscRest {
  /** Centre of the disc in the plane, metres. */
  readonly q: number;
  readonly s: number;
  /**
   * What holds it: `cradle` between a support on each side, or `leaning` against something
   * that rises steeply on one side.
   */
  readonly kind: 'cradle' | 'leaning';
}

/**
 * The positions at which a disc of radius `radius` lowered from above comes to rest among the
 * obstacles of a plane: the local minima over `q` of the height at which it first touches. `q`
 * is scanned over `range` in steps of `step` metres; where nothing is under the disc it falls
 * through and there is no rest.
 */
export function discRests(
  obstacles: readonly PlaneObstacle[],
  radius: number,
  range: Range,
  step = 0.0005,
): DiscRest[] {
  const n = Math.max(2, Math.round((range[1] - range[0]) / step) + 1);
  const height = new Float64Array(n).fill(Number.NEGATIVE_INFINITY);
  for (const o of obstacles) {
    const reach = radius + o.r;
    const first = Math.max(0, Math.ceil((o.q - reach - range[0]) / step));
    const last = Math.min(n - 1, Math.floor((o.q + reach - range[0]) / step));
    for (let k = first; k <= last; k++) {
      const dq = range[0] + k * step - o.q;
      const h = o.s + Math.sqrt(Math.max(0, reach * reach - dq * dq));
      if (h > (height[k] as number)) height[k] = h;
    }
  }
  const rests: DiscRest[] = [];
  // A jump of more than this between neighbouring positions is a wall, not a slope.
  const wall = 20 * step;
  let k = 1;
  while (k < n - 1) {
    const h = height[k] as number;
    if (!Number.isFinite(h)) {
      k++;
      continue;
    }
    // A run of equal heights counts once, at its middle.
    let end = k;
    while (end + 1 < n - 1 && height[end + 1] === h) end++;
    const before = height[k - 1] as number;
    const after = height[end + 1] as number;
    if (
      Number.isFinite(before) &&
      Number.isFinite(after) &&
      before >= h &&
      after >= h &&
      (before > h || after > h)
    ) {
      const mid = Math.round((k + end) / 2);
      const leaning = before - h > wall || after - h > wall;
      rests.push({ q: range[0] + mid * step, s: h, kind: leaning ? 'leaning' : 'cradle' });
    }
    k = end + 1;
  }
  return rests;
}

// ---------------------------------------------------------------------------------------------
// Plates in a basket
// ---------------------------------------------------------------------------------------------

/** A plate standing in a slot of a basket. */
export interface StandingPlate {
  readonly basketId: string;
  readonly rowId: string;
  readonly slotIndex: number;
  /** Diameter of the plate, metres. */
  readonly diameter: number;
  /** Centre of the plate, tub frame, basket pushed in. */
  readonly centreTub: Vec3;
  /** Tub-frame z of its highest and lowest points. */
  readonly topZ: number;
  readonly bottomZ: number;
  /** Its highest point, tub frame: where a leaning plate reaches furthest up and out. */
  readonly topTub: Vec3;
  /** How it rests. */
  readonly rest: 'cradle' | 'leaning';
  /**
   * Smallest distance from its edge to anything above or round it that it must clear (arm
   * sweeps, fixed sprayers, the roof and the walls of the tub), metres; negative when it
   * reaches into one, or when it leans out over the plan outline of its own basket (by how
   * far).
   */
  readonly clearance: number;
  /** What that nearest thing is. */
  readonly nearest: string;
}

/** The shapes carried by a basket, posed in its rack frame. */
function basketObstacleShapes(
  geometry: MachineGeometry,
  envelope: BasketEnvelope,
): { shape: Shape; pose: Pose }[] {
  const toRack = poseInverse({ p: envelope.originTub, q: [0, 0, 0, 1] });
  const carried = (part: MachinePart): boolean =>
    part.component !== 'spray_arm' &&
    (part.frame === envelope.frame || part.carriedBy === envelope.basketId);
  return geometry.parts
    .filter(carried)
    .map((part) => ({ shape: part.shape, pose: poseCompose(toRack, part.pose) }));
}

/** Clearance of a disc (tub frame) from the arm sweeps, sprayers, roof and walls. */
function discClearance(
  spec: MachineSpec,
  geometry: MachineGeometry,
  envelope: BasketEnvelope,
  centre: Vec3,
  across: Vec3,
  up: Vec3,
  radius: number,
  ceiling: 'actual' | 'lowest',
): { clearance: number; nearest: string; topZ: number; bottomZ: number; topTub: Vec3 } {
  const inside = tubInterior(spec);
  const outline = spec.baskets.find((b) => b.id === envelope.basketId)?.outline.size ?? [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  let clearance = Number.POSITIVE_INFINITY;
  let nearest = 'nothing';
  let topZ = Number.NEGATIVE_INFINITY;
  let bottomZ = Number.POSITIVE_INFINITY;
  let topTub: Vec3 = centre;
  const note = (d: number, what: string): void => {
    if (d < clearance) {
      clearance = d;
      nearest = what;
    }
  };
  const samples = 180;
  for (let i = 0; i < samples; i++) {
    const a = (2 * Math.PI * i) / samples;
    const p = v3Add(
      centre,
      v3Add(
        [
          across[0] * radius * Math.cos(a),
          across[1] * radius * Math.cos(a),
          across[2] * radius * Math.cos(a),
        ],
        [up[0] * radius * Math.sin(a), up[1] * radius * Math.sin(a), up[2] * radius * Math.sin(a)],
      ),
    );
    if (p[2] > topZ) {
      topZ = p[2];
      topTub = p;
    }
    bottomZ = Math.min(bottomZ, p[2]);
    note(inside.max[2] - p[2], 'roof');
    note(p[0] - inside.min[0], 'left wall');
    note(inside.max[0] - p[0], 'right wall');
    note(p[1] - inside.min[1], 'door');
    note(inside.max[1] - p[1], 'rear wall');
    // Inside the plan outline of its own basket: a limit, not a distance to keep (a plate that
    // leans on a wall wire is within a wire's thickness of the outline by construction).
    const rx = p[0] - envelope.originTub[0];
    const ry = p[1] - envelope.originTub[1];
    const within = Math.min(rx, outline[0] - rx, ry, outline[1] - ry);
    if (within < 0) note(within, 'basket outline');
    if (ceiling === 'lowest') {
      note(
        envelope.originTub[2] + envelope.maxItemHeight - p[2],
        envelope.overhead[0]?.id ?? 'roof',
      );
      continue;
    }
    for (const sweep of geometry.affordances.armSweeps) {
      // The arm that hangs under this very basket is below its load.
      if (sweep.zMax <= envelope.originTub[2]) continue;
      // Negative inside the swept volume: a plate whose edge reaches into it does not clear it.
      const outside = sweptDistance(sweep, p);
      note(outside > 0 ? outside : -sweptPenetration(sweep, p), `${sweep.levelId} arm`);
    }
    for (const over of envelope.overhead) {
      if (over.region.kind === 'everywhere') {
        note(over.zTub - p[2], over.id);
      } else if (over.id.endsWith('_sprayer')) {
        const dr = Math.max(
          0,
          Math.hypot(p[0] - over.region.centre[0], p[1] - over.region.centre[1]) -
            over.region.radius,
        );
        const dz = Math.max(0, over.zTub - p[2]);
        note(Math.hypot(dr, dz), over.id);
      }
    }
  }
  // The edge can pass round an arm that the face of the plate cuts through: look inside too.
  if (clearance >= 0 && ceiling === 'actual') {
    const sweeps = geometry.affordances.armSweeps.filter(
      (sweep) => sweep.zMax > envelope.originTub[2],
    );
    const n = Math.ceil(radius / INTERIOR_SAMPLE);
    search: for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const q = i * INTERIOR_SAMPLE;
        const t = j * INTERIOR_SAMPLE;
        if (q * q + t * t > radius * radius) continue;
        const p: Vec3 = [
          centre[0] + across[0] * q + up[0] * t,
          centre[1] + across[1] * q + up[1] * t,
          centre[2] + across[2] * q + up[2] * t,
        ];
        for (const sweep of sweeps) {
          if (sweptDistance(sweep, p) === 0) {
            clearance = -INTERIOR_SAMPLE;
            nearest = `${sweep.levelId} arm`;
            break search;
          }
        }
      }
    }
  }
  return { clearance, nearest, topZ, bottomZ, topTub };
}

/** Options of the plate searches. */
export interface PlateFitOptions {
  /** Clearance a plate must keep from everything above and round it, metres; default 0. */
  readonly margin?: number;
  /** Only slots of these rows; default every upright row of the basket. */
  readonly rows?: readonly string[];
  /**
   * What is above the basket: `actual` (the default) the swept volumes of the arms, the fixed
   * sprayers, the basket above and the roof, each where it is; `lowest` a flat ceiling at the
   * lowest point of all of them (`BasketEnvelope.maxItemHeight`), which is the limit that holds
   * wherever in the basket the plate stands, as a manufacturer prints it.
   */
  readonly ceiling?: 'actual' | 'lowest';
  /** Only plates that rest this way; default both. */
  readonly rest?: 'cradle' | 'leaning';
}

/** A slot prepared for plate searches: its plane and the obstacles in it. */
interface PreparedSlot {
  readonly row: TineRowAffordance;
  readonly slot: TineSlot;
  readonly plane: PlatePlane;
  readonly obstacles: readonly PlaneObstacle[];
  readonly range: Range;
  /** Distance along `up` from the rail centre to the tips of the row's tines. */
  readonly tipS: number;
}

function prepareSlots(
  geometry: MachineGeometry,
  envelope: BasketEnvelope,
  options: PlateFitOptions,
): PreparedSlot[] {
  const shapes = basketObstacleShapes(geometry, envelope);
  const prepared: PreparedSlot[] = [];
  for (const row of geometry.affordances.tineRows) {
    if (row.basketId !== envelope.basketId || row.state !== 'up') continue;
    if (options.rows !== undefined && !options.rows.includes(row.rowId)) continue;
    const tine = row.tines[0];
    if (tine === undefined) continue;
    for (const slot of row.slots) {
      const plane = slotPlane(slot);
      const obstacles = planeObstacles(shapes, plane);
      if (obstacles.length === 0) continue;
      const qs = obstacles.map((o) => o.q);
      const tipS = v3Dot(v3Sub(tine.tip, tine.base), plane.up);
      prepared.push({
        row,
        slot,
        plane,
        obstacles,
        range: [Math.min(...qs) - 0.02, Math.max(...qs) + 0.02],
        tipS,
      });
    }
  }
  return prepared;
}

/** The ways a plate of one diameter stands in one prepared slot. */
function platesInSlot(
  spec: MachineSpec,
  geometry: MachineGeometry,
  envelope: BasketEnvelope,
  prepared: PreparedSlot,
  diameter: number,
  options: PlateFitOptions,
): StandingPlate[] {
  const radius = diameter / 2;
  const { plane } = prepared;
  const out: StandingPlate[] = [];
  for (const rest of discRests(prepared.obstacles, radius, prepared.range)) {
    // It must stand between the two tines of the slot: over the rail (q = 0) its lower edge
    // has to be below their tips, or they do not hold it.
    if (Math.abs(rest.q) >= radius) continue;
    const lowerEdgeAtRail = rest.s - Math.sqrt(radius * radius - rest.q * rest.q);
    if (lowerEdgeAtRail >= prepared.tipS) continue;
    if (options.rest !== undefined && options.rest !== rest.kind) continue;
    const centreRack = v3Add(
      plane.origin,
      v3Add(
        [plane.across[0] * rest.q, plane.across[1] * rest.q, plane.across[2] * rest.q],
        [plane.up[0] * rest.s, plane.up[1] * rest.s, plane.up[2] * rest.s],
      ),
    );
    const centreTub = v3Add(envelope.originTub, centreRack);
    const c = discClearance(
      spec,
      geometry,
      envelope,
      centreTub,
      plane.across,
      plane.up,
      radius,
      options.ceiling ?? 'actual',
    );
    out.push({
      basketId: envelope.basketId,
      rowId: prepared.row.rowId,
      slotIndex: prepared.slot.index,
      diameter,
      centreTub,
      topZ: c.topZ,
      bottomZ: c.bottomZ,
      topTub: c.topTub,
      rest: rest.kind,
      clearance: c.clearance,
      nearest: c.nearest,
    });
  }
  return out;
}

function envelopeOf(geometry: MachineGeometry, basketId: string): BasketEnvelope {
  const envelope = geometry.affordances.baskets.find((b) => b.basketId === basketId);
  if (envelope === undefined) {
    throw new RangeError(`machine geometry: ${geometry.machineId} has no basket "${basketId}"`);
  }
  return envelope;
}

/**
 * Every way a plate of the given diameter stands in the slots of a basket, with its clearance
 * from what is above and round it. A plate with negative clearance stands there but strikes
 * something (an arm, the roof).
 */
export function standingPlates(
  spec: MachineSpec,
  geometry: MachineGeometry,
  basketId: string,
  diameter: number,
  options: PlateFitOptions = {},
): StandingPlate[] {
  const envelope = envelopeOf(geometry, basketId);
  return prepareSlots(geometry, envelope, options).flatMap((p) =>
    platesInSlot(spec, geometry, envelope, p, diameter, options),
  );
}

/**
 * The largest plate that stands in a slot of a basket and clears everything above and round it
 * by `options.margin`, searched to 1 mm between `range[0]` and `range[1]` (default 0.1 to 0.45
 * m): the plate, where it stands, and how it rests. Null when no plate in the range stands.
 */
export function maxStandingPlate(
  spec: MachineSpec,
  geometry: MachineGeometry,
  basketId: string,
  options: PlateFitOptions = {},
  range: Range = [0.1, 0.45],
): StandingPlate | null {
  const envelope = envelopeOf(geometry, basketId);
  const margin = options.margin ?? 0;
  const slots = prepareSlots(geometry, envelope, options);
  const best = (diameter: number): StandingPlate | null => {
    let found: StandingPlate | null = null;
    for (const slot of slots) {
      for (const plate of platesInSlot(spec, geometry, envelope, slot, diameter, options)) {
        if (plate.clearance < margin) continue;
        if (found === null || plate.clearance > found.clearance) found = plate;
      }
    }
    return found;
  };
  // Coarse from the top in 10 mm steps, then up again in 1 mm steps.
  const coarse = 0.01;
  const fine = 0.001;
  let d = range[1];
  let hit: StandingPlate | null = null;
  while (d >= range[0] - 1e-9) {
    hit = best(d);
    if (hit !== null) break;
    d -= coarse;
  }
  if (hit === null) return null;
  for (let up = d + fine; up < Math.min(d + coarse, range[1]) + 1e-9; up += fine) {
    const next = best(up);
    if (next === null) break;
    hit = next;
  }
  return hit;
}

// ---------------------------------------------------------------------------------------------
// Openings of the base grid
// ---------------------------------------------------------------------------------------------

/** The largest openings of a basket's base grid, seen from above. Rack frame, metres. */
export interface BaseGridOpenings {
  /** Diameter of the largest ball that falls between the wires, and where. */
  readonly largestBallDiameter: number;
  readonly largestBallAt: readonly [number, number];
  /** The largest clear axis-aligned rectangle between the wires: its extent and clear size. */
  readonly largestRectangle: {
    readonly x: Range;
    readonly y: Range;
    readonly size: readonly [number, number];
  };
}

/**
 * What falls through a base grid: the largest ball and the largest clear rectangle between the
 * wires that lie at or below `maxZ` above the floor where they are (default 20 mm, which takes
 * in the rails of the tine rows; on a floor with a relief the height is counted from the
 * relief), inside the rim. Computed from the capsules of the wire shape on
 * a grid of `cell` metres (default 1 mm), so the results are good to about that. The plan line
 * of the rim bounds the grid on every side, whatever the height of the lowest wall wire.
 */
export function baseGridOpenings(
  basket: BasketSpec,
  wires: Shape,
  maxZ = 0.02,
  cell = 0.001,
): BaseGridOpenings {
  const loop = rimLoop(basket);
  const [width, depth] = basket.outline.size;
  const nx = Math.ceil(width / cell);
  const ny = Math.ceil(depth / cell);
  // Distance of each cell centre to the nearest low wire surface (0 on a wire or outside the rim).
  const clear = new Float32Array(nx * ny).fill(Number.POSITIVE_INFINITY);
  const segments: { ax: number; ay: number; bx: number; by: number; r: number }[] = [];
  for (const part of wires.parts) {
    if (part.prim.kind !== 'capsule') continue;
    const a = poseTransformPoint(part.pose, part.prim.a);
    const b = poseTransformPoint(part.pose, part.prim.b);
    // Heights above the floor where the capsule's ends are.
    const za = a[2] - floorRiseAt(basket.floor, a[0], a[1]);
    const zb = b[2] - floorRiseAt(basket.floor, b[0], b[1]);
    if (Math.min(za, zb) - part.prim.radius > maxZ) continue;
    // Only the stretch of the capsule that is low enough counts.
    let ta = 0;
    let tb = 1;
    if (za - part.prim.radius > maxZ) ta = (za - part.prim.radius - maxZ) / (za - zb);
    if (zb - part.prim.radius > maxZ) tb = 1 - (zb - part.prim.radius - maxZ) / (zb - za);
    segments.push({
      ax: a[0] + (b[0] - a[0]) * ta,
      ay: a[1] + (b[1] - a[1]) * ta,
      bx: a[0] + (b[0] - a[0]) * tb,
      by: a[1] + (b[1] - a[1]) * tb,
      r: part.prim.radius,
    });
  }
  // The rim line bounds the grid in plan whatever its height: what is outside it is not floor.
  const rimRadius = basket.wires.rim.coated / 2;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as Vec3;
    const b = loop[(i + 1) % loop.length] as Vec3;
    segments.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], r: rimRadius });
  }
  for (const seg of segments) {
    // A segment only matters to the cells near it; the largest opening is far smaller than the basket.
    const reach = 0.15;
    const i0 = Math.max(0, Math.floor((Math.min(seg.ax, seg.bx) - reach) / cell));
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(seg.ax, seg.bx) + reach) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(seg.ay, seg.by) - reach) / cell));
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(seg.ay, seg.by) + reach) / cell));
    const dx = seg.bx - seg.ax;
    const dy = seg.by - seg.ay;
    const len2 = dx * dx + dy * dy;
    for (let j = j0; j <= j1; j++) {
      const y = (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * cell;
        const t =
          len2 > 0 ? Math.min(1, Math.max(0, ((x - seg.ax) * dx + (y - seg.ay) * dy) / len2)) : 0;
        const d = Math.hypot(x - seg.ax - t * dx, y - seg.ay - t * dy) - seg.r;
        const k = j * nx + i;
        if (d < (clear[k] as number)) clear[k] = Math.max(0, d);
      }
    }
  }
  let ball = 0;
  let ballAt: [number, number] = [0, 0];
  const free = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y = (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * cell;
      const k = j * nx + i;
      if (!insideRim(loop, x, y)) {
        clear[k] = 0;
        continue;
      }
      const d = clear[k] as number;
      if (d > 0) free[k] = 1;
      if (Number.isFinite(d) && d > ball) {
        ball = d;
        ballAt = [x, y];
      }
    }
  }
  // Largest rectangle of free cells (largest rectangle in a histogram, row by row).
  const heights = new Int32Array(nx);
  let bestArea = 0;
  let rect = { i0: 0, i1: 0, j0: 0, j1: 0 };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++)
      heights[i] = free[j * nx + i] === 1 ? (heights[i] as number) + 1 : 0;
    const stack: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const h = i < nx ? (heights[i] as number) : 0;
      while (stack.length > 0 && (heights[stack[stack.length - 1] as number] as number) >= h) {
        const top = stack.pop() as number;
        const hTop = heights[top] as number;
        const left = stack.length > 0 ? (stack[stack.length - 1] as number) + 1 : 0;
        const area = hTop * (i - left);
        if (area > bestArea) {
          bestArea = area;
          rect = { i0: left, i1: i, j0: j - hTop + 1, j1: j + 1 };
        }
      }
      stack.push(i);
    }
  }
  return {
    largestBallDiameter: 2 * ball,
    largestBallAt: ballAt,
    largestRectangle: {
      x: [rect.i0 * cell, rect.i1 * cell],
      y: [rect.j0 * cell, rect.j1 * cell],
      size: [(rect.i1 - rect.i0) * cell, (rect.j1 - rect.j0) * cell],
    },
  };
}
