/**
 * A basket as geometry: its wire structure as capsule chains, and the plastic parts fixed to it.
 *
 * Everything is in the basket's rack frame (origin at the front-left corner of its outer plan
 * rectangle, at the top surface of the base grid; +x right, +y back, +z up), in metres.
 *
 * How the wires are laid out, where the specification leaves it open:
 * - the rim is one closed wire at the height of the top wire of each wall, sloping across a
 *   corner where two walls differ in height;
 * - a lower horizontal wall wire follows the plan line of the rim on the sides that have it and
 *   is joined round a corner when both neighbours have it;
 * - a floor wire that meets a wall where the specification lists an upright at its position
 *   turns up there and is that upright, to the rim; the rail of a fixed tine row that reaches a
 *   side wall does the same; any other upright runs from the lowest wall wire to the rim;
 * - cranks of floor wires that the dossier does not locate are not drawn: the wires are straight
 *   in plan;
 * - a floor with a relief (`BasketFloorSpec.relief`) is drawn with it: the wires that run along
 *   the relief's axis follow the profile, bend for bend, and each wire of the other family lies
 *   at the height of the profile at its position;
 * - a floor wire whose line leaves the rim and enters it again (it crosses a recess of the
 *   outline) is drawn only where it is inside the rim.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { poseCompose, poseTransformPoint, QUAT_IDENTITY, v3AddScaled } from '@spotless/core';
import type { Part, Shape } from '@spotless/geometry';
import { isTineRowFolded, shelfState } from '../config.ts';
import { basketRimInset, floorRiseAt } from '../outline.ts';
import type {
  BasketSpec,
  CupShelfSpec,
  FloorWireFamilySpec,
  HolderSpec,
  MachineConfig,
  MachineSpec,
  Side,
  TineRowSpec,
} from '../types.ts';
import {
  HAIRPIN_LEG_RATIO,
  HANDLE_ABOVE_RIM,
  HANDLE_FRONT_OFFSET,
  HOLDER_FLOOR_BELOW_RIM,
  HOLDER_FLOOR_THICKNESS,
  HOLDER_RIM_HEIGHT,
  PLASTIC_WALL,
  RELIEF_BEND_RADIUS_RATIO,
  SHELF_OPEN_FRACTION,
  TABLET_TRAY_FLOOR_OPEN_FRACTION,
  TINE_BALL_RATIO,
  WHEEL_WIDTH,
} from './assumptions.ts';
import type { Box } from './prims.ts';
import { moveParts, puckPart, rotationAbout, shapeOf, slabPart } from './prims.ts';
import type { RimCrossing } from './rim.ts';
import { rimCrossings, rimLoop, rimZ, wallOf, wallWireRuns } from './rim.ts';
import { railDirection, railPoint, tineLine } from './tines.ts';
import { capsulePart, wireParts } from './wire.ts';

/** Two positions along a wall closer than this are the same wire, metres. */
const SAME_WIRE = 0.0006;
/** A rail end this close to the rim line reaches the wall, metres. */
const REACHES_WALL = 0.0016;

/** The shapes of one basket in one configuration. */
export interface BasketShapes {
  /** Rim, walls, base grid, rails and tines: capsules only. */
  readonly wires: Shape;
  /** Wheels, handle, cup shelves and holders; null when the basket has none. */
  readonly fittings: Shape | null;
  /** The tablet collecting tray; null when the basket has none. */
  readonly tabletTray: Shape | null;
}

function hasUpright(basket: BasketSpec, side: Side, position: number): boolean {
  return wallOf(basket, side).uprights.some((u) => Math.abs(u - position) < SAME_WIRE);
}

/**
 * The points of a floor wire between `from` and `to` along its run: its humps, on top of the
 * relief of the floor. `rise(along)` is the relief under the wire at a position of its run
 * (constant for a wire that runs across the relief's axis) and `breaks` the positions at which
 * that relief changes slope.
 */
function runWithHumps(
  family: FloorWireFamilySpec,
  from: number,
  to: number,
  point: (along: number, z: number) => Vec3,
  rise: (along: number) => number = () => 0,
  breaks: readonly number[] = [],
): Vec3[] {
  // The humps as a piecewise-linear height: trapezoids with 45 degree ramps, shortened when a
  // hump is too short for two of them.
  const knots: { at: number; h: number }[] = [];
  for (const hump of [...family.humps].sort((a, b) => a.from - b.from)) {
    const start = Math.max(hump.from, from);
    const end = Math.min(hump.to, to);
    const ramp = Math.min(hump.rise, (end - start) / 2);
    if (!(ramp > 0)) continue;
    knots.push({ at: start, h: 0 }, { at: start + ramp, h: ramp });
    if (end - ramp > start + ramp) knots.push({ at: end - ramp, h: ramp });
    knots.push({ at: end, h: 0 });
  }
  const humpAt = (along: number): number => {
    for (let i = 1; i < knots.length; i++) {
      const a = knots[i - 1] as { at: number; h: number };
      const b = knots[i] as { at: number; h: number };
      if (along >= a.at && along <= b.at && b.at > a.at) {
        return a.h + ((b.h - a.h) * (along - a.at)) / (b.at - a.at);
      }
    }
    return 0;
  };
  const stations = [from, to, ...knots.map((k) => k.at), ...breaks]
    .filter((at) => at >= from && at <= to)
    .sort((a, b) => a - b);
  const points: Vec3[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const at of stations) {
    if (at - last < 1e-9) continue;
    points.push(point(at, family.z + rise(at) + humpAt(at)));
    last = at;
  }
  return points;
}

/** Distance in plan from the point (x, y) to the centre line of the rim loop, metres. */
function planDistanceToLoop(loop: readonly Vec3[], x: number, y: number): number {
  let least = Number.POSITIVE_INFINITY;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as Vec3;
    const b = loop[(i + 1) % loop.length] as Vec3;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / len2)) : 0;
    least = Math.min(least, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
  }
  return least;
}

/**
 * One family of floor wires. `constant` is the plan coordinate held constant along a wire of
 * the family (`x` for the wires running front to back). The wires end on the rim line; where the
 * wall at that end lists an upright at the wire's position the wire turns up to the rim.
 */
function floorFamilyParts(
  basket: BasketSpec,
  loop: readonly Vec3[],
  family: FloorWireFamilySpec,
  constant: 'x' | 'y',
  idPrefix: string,
): { parts: Part[]; consumed: Map<Side, number[]> } {
  const radius = basket.wires.floor.coated / 2;
  const [lowSide, highSide]: [Side, Side] =
    constant === 'x' ? ['front', 'rear'] : ['left', 'right'];
  const consumed = new Map<Side, number[]>([
    [lowSide, []],
    [highSide, []],
  ]);
  const parts: Part[] = [];
  // The relief of the floor as this family sees it: along its run, or one height per wire.
  const relief = basket.floor.relief;
  const follows = relief !== null && relief.axis !== constant;
  const breaks = follows ? relief.points.map((p) => p.at) : [];
  family.positions.forEach((position, index) => {
    const hits = rimCrossings(loop, constant, position);
    if (hits.length < 2) return;
    const point = (along: number, z: number): Vec3 =>
      constant === 'x' ? [position, along, z] : [along, position, z];
    const rise = (along: number): number =>
      constant === 'x'
        ? floorRiseAt(basket.floor, position, along)
        : floorRiseAt(basket.floor, along, position);
    // The line is inside the rim between its crossings taken in pairs: one stretch for an
    // ordinary wire, two for a wire whose line crosses a recess of the outline. A gap in which
    // the line stays within a rim wire's thickness of the rim (a wire that runs along a
    // set-back wall) is not a gap.
    const pairs: [RimCrossing, RimCrossing][] = [];
    if (hits.length % 2 === 0) {
      for (let k = 0; k < hits.length; k += 2) {
        const low = hits[k] as RimCrossing;
        const high = hits[k + 1] as RimCrossing;
        const before = pairs[pairs.length - 1];
        if (before !== undefined) {
          const mid = (before[1].along + low.along) / 2;
          const [mx, my] = constant === 'x' ? [position, mid] : [mid, position];
          if (planDistanceToLoop(loop, mx, my) <= basket.wires.rim.coated) {
            before[1] = high;
            continue;
          }
        }
        pairs.push([low, high]);
      }
    } else {
      pairs.push([hits[0] as RimCrossing, hits[hits.length - 1] as RimCrossing]);
    }
    const stretches = pairs.length;
    for (let k = 0; k < stretches; k++) {
      const [low, high] = pairs[k] as [RimCrossing, RimCrossing];
      const lowUp = k === 0 && hasUpright(basket, lowSide, position);
      const highUp = k === stretches - 1 && hasUpright(basket, highSide, position);
      const from = lowUp ? low.along : Math.max(family.span[0], low.along);
      const to = highUp ? high.along : Math.min(family.span[1], high.along);
      if (!(to > from)) continue;
      const points = runWithHumps(family, from, to, point, rise, breaks);
      if (lowUp) {
        points.unshift(low.point);
        (consumed.get(lowSide) as number[]).push(position);
      }
      if (highUp) {
        points.push(high.point);
        (consumed.get(highSide) as number[]).push(position);
      }
      const id = k === 0 ? `${idPrefix}.${index}` : `${idPrefix}.${index}s${k}`;
      parts.push(
        ...wireParts(
          follows
            ? { id, points, radius, bendRadius: RELIEF_BEND_RADIUS_RATIO * 2 * radius }
            : { id, points, radius },
          basket.material,
        ),
      );
    }
  });
  return { parts, consumed };
}

/** The rail and the tines of one row, upright or folded. */
function tineRowParts(
  basket: BasketSpec,
  loop: readonly Vec3[],
  row: TineRowSpec,
  folded: boolean,
): { parts: Part[]; consumed: Map<Side, number[]> } {
  const material = basket.material;
  const parts: Part[] = [];
  const consumed = new Map<Side, number[]>();
  const railRadius = basket.wires.floor.coated / 2;

  // The rail, turning up at a wall where it reaches one that lists an upright there.
  const railPoints: Vec3[] = [railPoint(row, row.railSpan[0]), railPoint(row, row.railSpan[1])];
  if (row.hinge === null) {
    const hits = rimCrossings(loop, row.runs === 'x' ? 'y' : 'x', row.railAt);
    const [lowSide, highSide]: [Side, Side] =
      row.runs === 'x' ? ['left', 'right'] : ['front', 'rear'];
    const ends: [RimCrossing | undefined, Side, 0 | 1][] = [
      [hits[0], lowSide, 0],
      [hits[hits.length - 1], highSide, 1],
    ];
    for (const [hit, side, end] of ends) {
      if (hit === undefined) continue;
      if (Math.abs(hit.along - row.railSpan[end]) > REACHES_WALL) continue;
      if (!hasUpright(basket, side, row.railAt)) continue;
      railPoints[end] = railPoint(row, hit.along);
      if (end === 0) railPoints.unshift(hit.point);
      else railPoints.push(hit.point);
      consumed.set(side, [...(consumed.get(side) ?? []), row.railAt]);
    }
  }
  parts.push(
    ...wireParts({ id: `row.${row.id}.rail`, points: railPoints, radius: railRadius }, material),
  );

  const radius = row.wireDiameter / 2;
  const along = railDirection(row);
  row.tinePositions.forEach((_, i) => {
    const tine = tineLine(row, i, folded);
    const tipRadius = row.tip === 'ball' ? radius * TINE_BALL_RATIO : radius;
    // The tip surface ends at `tine.end`: the last centre is one tip radius short of it.
    const top = v3AddScaled(tine.end, tine.direction, -tipRadius);
    const id = `row.${row.id}.tine.${i}`;
    if (row.form === 'hairpin') {
      const half = (HAIRPIN_LEG_RATIO * row.wireDiameter) / 2;
      const a = v3AddScaled(top, along, -half);
      const b = v3AddScaled(top, along, half);
      parts.push(capsulePart(`${id}.a`, v3AddScaled(tine.base, along, -half), a, radius, material));
      parts.push(capsulePart(`${id}.b`, v3AddScaled(tine.base, along, half), b, radius, material));
      parts.push(capsulePart(`${id}.bow`, a, b, radius, material));
    } else {
      parts.push(capsulePart(id, tine.base, top, radius, material));
    }
    if (row.tip === 'ball') {
      parts.push(capsulePart(`row.${row.id}.tip.${i}`, top, top, tipRadius, material));
    }
  });
  return { parts, consumed };
}

/** The wire structure of a basket in a configuration: capsules only. */
export function buildBasketWires(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
): Shape {
  const material = basket.material;
  const loop = rimLoop(basket);
  const parts: Part[] = [];

  parts.push(
    ...wireParts(
      { id: 'rim', points: loop, radius: basket.wires.rim.coated / 2, closed: true },
      material,
    ),
  );

  // Horizontal wall wires below the rim, grouped by height.
  const wallRadius = basket.wires.floor.coated / 2;
  const levels = new Map<number, Set<Side>>();
  for (const wall of basket.walls) {
    wall.horizontalWireZ.slice(0, -1).forEach((z) => {
      const key = Math.round(z * 1e4);
      levels.set(key, (levels.get(key) ?? new Set<Side>()).add(wall.side));
    });
  }
  [...levels.keys()]
    .sort((a, b) => a - b)
    .forEach((key, level) => {
      const sides = levels.get(key) as Set<Side>;
      wallWireRuns(basket, key / 1e4, sides).forEach((run, r) => {
        parts.push(
          ...wireParts(
            {
              id: `wall.${level}.${r}`,
              points: run.points,
              radius: wallRadius,
              closed: run.closed,
            },
            material,
          ),
        );
      });
    });

  // Base grid.
  const consumed = new Map<Side, number[]>();
  const note = (more: Map<Side, number[]>): void => {
    for (const [side, positions] of more) {
      consumed.set(side, [...(consumed.get(side) ?? []), ...positions]);
    }
  };
  const alongY = floorFamilyParts(basket, loop, basket.floor.alongY, 'x', 'floor.y');
  const alongX = floorFamilyParts(basket, loop, basket.floor.alongX, 'y', 'floor.x');
  parts.push(...alongY.parts, ...alongX.parts);
  note(alongY.consumed);
  note(alongX.consumed);

  // Tine rows.
  for (const row of basket.tineRows) {
    const folded = isTineRowFolded(spec, config, basket.id, row.id);
    const built = tineRowParts(basket, loop, row, folded);
    parts.push(...built.parts);
    note(built.consumed);
  }

  // Uprights that are not the end of a floor wire or of a rail.
  for (const wall of basket.walls) {
    const taken = consumed.get(wall.side) ?? [];
    const lowest = wall.horizontalWireZ.length > 1 ? (wall.horizontalWireZ[0] as number) : 0;
    wall.uprights.forEach((position, i) => {
      if (taken.some((t) => Math.abs(t - position) < SAME_WIRE)) return;
      const frontOrRear = wall.side === 'front' || wall.side === 'rear';
      const hits = rimCrossings(loop, frontOrRear ? 'x' : 'y', position);
      const hit = wall.side === 'front' || wall.side === 'left' ? hits[0] : hits[hits.length - 1];
      if (hit === undefined) return;
      const foot: Vec3 = [hit.point[0], hit.point[1], Math.min(lowest, hit.point[2])];
      parts.push(
        ...wireParts(
          { id: `upright.${wall.side}.${i}`, points: [foot, hit.point], radius: wallRadius },
          material,
        ),
      );
    });
  }

  return shapeOf(parts, [
    ['tines', 'row.*'],
    ['rim', 'rim.*'],
    ['wall', 'wall.*'],
    ['wall', 'upright.*'],
    ['floor', 'floor.*'],
  ]);
}

// ---------------------------------------------------------------------------------------------
// Fittings
// ---------------------------------------------------------------------------------------------

/** The x of the inner face of the rim wire on the left and on the right side. */
function innerSideX(basket: BasketSpec): readonly [number, number] {
  const [insetX] = basketRimInset(basket);
  const r = basket.wires.rim.coated / 2;
  return [insetX + r, basket.outline.size[0] - insetX - r];
}

/**
 * The box a lowered cup shelf fills: it hangs on the inner face of its side wall and its top
 * surface is at `heightAboveGrid`.
 */
export function cupShelfBoxDown(basket: BasketSpec, shelf: CupShelfSpec): Box {
  const [left, right] = innerSideX(basket);
  const [, width, thickness] = shelf.size;
  const x0 = shelf.side === 'left' ? left : right - width;
  return {
    min: [x0, shelf.y[0], shelf.heightAboveGrid - thickness],
    max: [x0 + width, shelf.y[1], shelf.heightAboveGrid],
  };
}

/**
 * The box a cup shelf fills when it is folded up, its free edge upwards.
 *
 * Without `pivotInset` it is the lowered shelf turned a quarter turn about the edge where its
 * top surface meets the wall: it stands flat against the wall, on the shelf plane.
 *
 * With `pivotInset` it turns about pins under its underside, that far from its edge at the
 * wall: folded up, its underside faces the inside of the basket in the plane of the pins, its
 * thickness is between that plane and the wall, and that much of its width hangs below the
 * underside of the lowered shelf.
 */
export function cupShelfBoxUp(basket: BasketSpec, shelf: CupShelfSpec): Box {
  const down = cupShelfBoxDown(basket, shelf);
  const [, width, thickness] = shelf.size;
  if (shelf.pivotInset === undefined) {
    const z0 = shelf.heightAboveGrid;
    return shelf.side === 'left'
      ? {
          min: [down.min[0], shelf.y[0], z0],
          max: [down.min[0] + thickness, shelf.y[1], z0 + width],
        }
      : {
          min: [down.max[0] - thickness, shelf.y[0], z0],
          max: [down.max[0], shelf.y[1], z0 + width],
        };
  }
  const inset = Math.min(width, Math.max(0, shelf.pivotInset));
  const z0 = shelf.heightAboveGrid - thickness - inset;
  if (shelf.side === 'left') {
    const x = down.min[0] + inset;
    return { min: [x - thickness, shelf.y[0], z0], max: [x, shelf.y[1], z0 + width] };
  }
  const x = down.max[0] - inset;
  return { min: [x, shelf.y[0], z0], max: [x + thickness, shelf.y[1], z0 + width] };
}

/** Height of the top of a holder's floor above the rack-frame origin when it is down. */
export function holderFloorZ(basket: BasketSpec, holder: HolderSpec): number {
  if (holder.floorZ !== null) return holder.floorZ;
  const side: Side = holder.side;
  return rimZ(basket, side) + basket.wires.rim.coated / 2 - HOLDER_FLOOR_BELOW_RIM;
}

/** The box a lowered holder fills: its floor and the low rim round it. */
export function holderBoxDown(basket: BasketSpec, holder: HolderSpec): Box {
  const top = holderFloorZ(basket, holder);
  return {
    min: [holder.x[0], holder.y[0], top - HOLDER_FLOOR_THICKNESS],
    max: [holder.x[1], holder.y[1], top + HOLDER_RIM_HEIGHT],
  };
}

/**
 * The edge a folding holder turns about: at its wall, at the top of its floor, or at
 * `foldHingeZ` where the specification gives the height the folded holder stands at.
 */
function holderHinge(
  basket: BasketSpec,
  holder: HolderSpec,
): { point: Vec3; axis: Vec3; angle: number } {
  const z = holder.foldHingeZ ?? holderFloorZ(basket, holder);
  const [left, right] = innerSideX(basket);
  const midX = (holder.x[0] + holder.x[1]) / 2;
  const midY = (holder.y[0] + holder.y[1]) / 2;
  const quarter = Math.PI / 2;
  if (holder.side === 'left') {
    return { point: [Math.max(holder.x[0], left), midY, z], axis: [0, 1, 0], angle: -quarter };
  }
  if (holder.side === 'right') {
    return { point: [Math.min(holder.x[1], right), midY, z], axis: [0, 1, 0], angle: quarter };
  }
  if (holder.side === 'front') {
    return { point: [midX, holder.y[0], z], axis: [1, 0, 0], angle: quarter };
  }
  return { point: [midX, holder.y[1], z], axis: [1, 0, 0], angle: -quarter };
}

/**
 * The move that folds a holder up: a quarter turn about its hinge, after lowering (or raising)
 * it so that the top of its floor at the wall is at the hinge when the specification puts the
 * hinge at a height of its own (`HolderSpec.foldHingeZ`).
 */
function holderFoldMove(basket: BasketSpec, holder: HolderSpec): Pose {
  const hinge = holderHinge(basket, holder);
  const turn = rotationAbout(hinge.point, hinge.axis, hinge.angle);
  if (holder.foldHingeZ === undefined) return turn;
  const lift = holder.foldHingeZ - holderFloorZ(basket, holder);
  return poseCompose(turn, { p: [0, 0, lift], q: QUAT_IDENTITY });
}

/** The box a holder fills when it is folded up against its wall. */
export function holderBoxUp(basket: BasketSpec, holder: HolderSpec): Box {
  const down = holderBoxDown(basket, holder);
  const turn = holderFoldMove(basket, holder);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const x of [down.min[0], down.max[0]]) {
    for (const y of [down.min[1], down.max[1]]) {
      for (const z of [down.min[2], down.max[2]]) {
        const p = poseTransformPoint(turn, [x, y, z]);
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k] as number, p[k] as number);
          max[k] = Math.max(max[k] as number, p[k] as number);
        }
      }
    }
  }
  return { min, max };
}

/** The box of a basket's handle: a bar on the front rim. */
export function handleBox(basket: BasketSpec): Box | null {
  const handle = basket.handle;
  if (handle === null) return null;
  const [width, depth, height] = handle.size;
  const top = rimZ(basket, 'front') + basket.wires.rim.coated / 2 + HANDLE_ABOVE_RIM;
  return {
    min: [handle.centreX - width / 2, -HANDLE_FRONT_OFFSET, top - height],
    max: [handle.centreX + width / 2, depth - HANDLE_FRONT_OFFSET, top],
  };
}

/** The centres of the wheels of a basket, rack frame. */
export function wheelCentres(basket: BasketSpec): Vec3[] {
  const wheels = basket.wheels;
  if (wheels === null) return [];
  const centreX = basket.outline.size[0] / 2;
  const centres: Vec3[] = [];
  for (const x of [centreX - wheels.track / 2, centreX + wheels.track / 2]) {
    for (const y of wheels.stationsY) centres.push([x, y, wheels.axleZ]);
  }
  return centres;
}

/** Wheels, handle, cup shelves and holders of a basket; null when it has none of them. */
export function buildBasketFittings(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
  plastic: string,
): Shape | null {
  const parts: Part[] = [];
  const wheels = basket.wheels;
  if (wheels !== null) {
    wheelCentres(basket).forEach((centre, i) => {
      parts.push(
        puckPart(`wheel.${i}`, centre, [1, 0, 0], wheels.diameter / 2, WHEEL_WIDTH, plastic),
      );
    });
  }
  const handle = handleBox(basket);
  if (handle !== null) parts.push(slabPart('handle', handle.min, handle.max, plastic, 0.003));

  for (const shelf of basket.cupShelves) {
    const state = shelfState(spec, config, basket.id, shelf.id);
    const box = state === 'down' ? cupShelfBoxDown(basket, shelf) : cupShelfBoxUp(basket, shelf);
    parts.push(
      slabPart(`shelf.${shelf.id}`, box.min, box.max, plastic, 0.002, SHELF_OPEN_FRACTION),
    );
  }

  for (const holder of basket.holders) {
    const box = holderBoxDown(basket, holder);
    const floorTop = holderFloorZ(basket, holder);
    const id = `holder.${holder.id}`;
    const t = PLASTIC_WALL;
    const down: Part[] = [
      slabPart(
        `${id}.floor`,
        box.min,
        [box.max[0], box.max[1], floorTop],
        plastic,
        0.001,
        SHELF_OPEN_FRACTION,
      ),
      slabPart(
        `${id}.rim.front`,
        [box.min[0], box.min[1], floorTop],
        [box.max[0], box.min[1] + t, box.max[2]],
        plastic,
        0.0005,
      ),
      slabPart(
        `${id}.rim.rear`,
        [box.min[0], box.max[1] - t, floorTop],
        [box.max[0], box.max[1], box.max[2]],
        plastic,
        0.0005,
      ),
      slabPart(
        `${id}.rim.left`,
        [box.min[0], box.min[1], floorTop],
        [box.min[0] + t, box.max[1], box.max[2]],
        plastic,
        0.0005,
      ),
      slabPart(
        `${id}.rim.right`,
        [box.max[0] - t, box.min[1], floorTop],
        [box.max[0], box.max[1], box.max[2]],
        plastic,
        0.0005,
      ),
    ];
    const state = holder.folds ? shelfState(spec, config, basket.id, holder.id) : 'down';
    if (state === 'down') {
      parts.push(...down);
    } else {
      parts.push(...moveParts(down, holderFoldMove(basket, holder)));
    }
  }

  if (parts.length === 0) return null;
  return shapeOf(parts, [
    ['wheel', 'wheel.*'],
    ['handle', 'handle'],
    ['shelf', 'shelf.*'],
    ['holder', 'holder.*'],
  ]);
}

/** The box of the tablet collecting tray of a basket, or null. */
export function tabletTrayBox(basket: BasketSpec): Box | null {
  const tray = basket.tabletTray;
  if (tray === null) return null;
  const [width, depth, height] = tray.size;
  return {
    min: [tray.centre[0] - width / 2, tray.centre[1] - depth / 2, tray.rimZ - height],
    max: [tray.centre[0] + width / 2, tray.centre[1] + depth / 2, tray.rimZ],
  };
}

/**
 * The tablet collecting tray: an open-topped trough with four walls and a floor that is slotted
 * (porous) when the specification says so; its front wall stops at `frontRimZ` where the
 * specification gives one. Null when the basket has none.
 */
export function buildTabletTray(basket: BasketSpec, plastic: string): Shape | null {
  const box = tabletTrayBox(basket);
  const tray = basket.tabletTray;
  if (box === null || tray === null) return null;
  const t = PLASTIC_WALL;
  const { min, max } = box;
  const parts: Part[] = [
    slabPart(
      'floor',
      min,
      [max[0], max[1], min[2] + t],
      plastic,
      0.0005,
      tray.slotted ? TABLET_TRAY_FLOOR_OPEN_FRACTION : 0,
    ),
    slabPart(
      'wall.front',
      min,
      [max[0], min[1] + t, Math.min(max[2], tray.frontRimZ ?? max[2])],
      plastic,
      0.0005,
    ),
    slabPart('wall.rear', [min[0], max[1] - t, min[2]], max, plastic, 0.0005),
    slabPart('wall.left', min, [min[0] + t, max[1], max[2]], plastic, 0.0005),
    slabPart('wall.right', [max[0] - t, min[1], min[2]], max, plastic, 0.0005),
  ];
  return {
    parts,
    regions: [
      { id: 'interior', part: 'floor', side: 'in' },
      { id: 'underside', part: 'floor', side: 'out' },
      { id: 'walls', part: 'wall.*' },
      { id: 'walls', part: 'floor' },
    ],
  };
}

/** All shapes of one basket in a configuration. `plastic` is the material of its mouldings. */
export function buildBasketShapes(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
  plastic: string,
): BasketShapes {
  return {
    wires: buildBasketWires(spec, basket, config),
    fittings: buildBasketFittings(spec, basket, config, plastic),
    tabletTray: buildTabletTray(basket, plastic),
  };
}
