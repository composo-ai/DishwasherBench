/**
 * The plan outline of a basket, resolved from its parametric description (`BasketOutlineSpec`):
 * the rectangle of rim wire centre lines with its shaped corners and set-in stretches.
 *
 * Everything is in the basket's rack frame (origin at the front-left corner of the outer plan
 * rectangle, +x right, +y back), in metres. The corners and recesses of an outline describe the
 * centre line of the rim wire; the outer outline is that line offset by half the rim wire.
 */

import type { BasketFloorSpec, BasketSpec, Range, Side, Vec2 } from './types.ts';

/** Number of straight pieces a rounded corner is drawn with by default. */
export const DEFAULT_CORNER_SEGMENTS = 4;

/**
 * Distance of the rim wire centre lines from the sides of the outer plan rectangle, `[x, y]`,
 * metres: half the difference between the outer size and the rim-centre size.
 */
export function basketRimInset(basket: BasketSpec): Vec2 {
  const [width, depth] = basket.outline.size;
  const [rimWidth, rimDepth] = basket.outline.rimCentres;
  return [(width - rimWidth) / 2, (depth - rimDepth) / 2];
}

/**
 * How far the rim centre line of one side is set towards the inside of the basket at the
 * coordinate `along` (x for the front and rear sides, y for the left and right sides), metres:
 * the depth of a recess over its span, falling linearly to zero over the ramp at each end, and
 * zero elsewhere. Corners are not counted.
 */
export function basketSideRecess(basket: BasketSpec, side: Side, along: number): number {
  let depth = 0;
  for (const recess of basket.outline.recesses) {
    if (recess.side !== side) continue;
    const [from, to] = recess.span;
    let fraction = 0;
    if (along >= from && along <= to) fraction = 1;
    else if (recess.ramp > 0 && along > from - recess.ramp && along < from) {
      fraction = (along - (from - recess.ramp)) / recess.ramp;
    } else if (recess.ramp > 0 && along > to && along < to + recess.ramp) {
      fraction = (to + recess.ramp - along) / recess.ramp;
    }
    depth = Math.max(depth, recess.depth * fraction);
  }
  return depth;
}

/**
 * The largest inward set of one side over a stretch `[from, to]` of it, metres: the smallest
 * value of {@link basketSideRecess} there. A recess clears an obstacle only where the whole
 * stretch facing it is set in.
 */
export function basketSideRecessOver(basket: BasketSpec, side: Side, stretch: Range): number {
  const points = [stretch[0], stretch[1]];
  for (const recess of basket.outline.recesses) {
    if (recess.side !== side) continue;
    for (const p of [
      recess.span[0] - recess.ramp,
      recess.span[0],
      recess.span[1],
      recess.span[1] + recess.ramp,
    ]) {
      if (p > stretch[0] && p < stretch[1]) points.push(p);
    }
  }
  let least = Number.POSITIVE_INFINITY;
  for (const p of points) least = Math.min(least, basketSideRecess(basket, side, p));
  return least;
}

/** Points of one corner, in the order the outline is walked (counter-clockwise seen from above). */
function cornerPoints(
  basket: BasketSpec,
  which: 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight',
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  segments: number,
): Vec2[] {
  const corner = basket.outline.corners[which];
  // Corner vertex, the direction along the side we arrive on (pointing back the way we came,
  // away from the corner) and the direction of the side we leave on.
  const vertex: Vec2 =
    which === 'frontLeft'
      ? [x0, y0]
      : which === 'frontRight'
        ? [x1, y0]
        : which === 'rearRight'
          ? [x1, y1]
          : [x0, y1];
  // Walking counter-clockwise: front edge +x, right side +y, rear edge -x, left side -y.
  const arrive: Vec2 =
    which === 'frontLeft'
      ? [0, 1]
      : which === 'frontRight'
        ? [-1, 0]
        : which === 'rearRight'
          ? [0, -1]
          : [1, 0];
  const leave: Vec2 =
    which === 'frontLeft'
      ? [1, 0]
      : which === 'frontRight'
        ? [0, 1]
        : which === 'rearRight'
          ? [-1, 0]
          : [0, -1];
  if (corner.kind === 'square') return [vertex];
  if (corner.kind === 'chamfer') {
    // dx is measured along x and dy along y, whichever side we arrive on.
    const a = arrive[0] !== 0 ? corner.dx : corner.dy;
    const l = leave[0] !== 0 ? corner.dx : corner.dy;
    return [
      [vertex[0] + arrive[0] * a, vertex[1] + arrive[1] * a],
      [vertex[0] + leave[0] * l, vertex[1] + leave[1] * l],
    ];
  }
  const r = corner.radius;
  const centre: Vec2 = [
    vertex[0] + (arrive[0] + leave[0]) * r,
    vertex[1] + (arrive[1] + leave[1]) * r,
  ];
  const points: Vec2[] = [];
  const n = Math.max(1, Math.floor(segments));
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (Math.PI / 2);
    // From the point on the arriving side (centre - leave r) to the point on the leaving side
    // (centre - arrive r).
    points.push([
      centre[0] - leave[0] * r * Math.cos(t) - arrive[0] * r * Math.sin(t),
      centre[1] - leave[1] * r * Math.cos(t) - arrive[1] * r * Math.sin(t),
    ]);
  }
  return points;
}

/** Points of the recesses of one side, in walking order. */
function recessPoints(
  basket: BasketSpec,
  side: Side,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): Vec2[] {
  const points: Vec2[] = [];
  const forward = side === 'front' || side === 'right';
  const recesses = basket.outline.recesses
    .filter((r) => r.side === side)
    .sort((a, b) => (forward ? a.span[0] - b.span[0] : b.span[0] - a.span[0]));
  for (const recess of recesses) {
    const along = forward
      ? [recess.span[0] - recess.ramp, recess.span[0], recess.span[1], recess.span[1] + recess.ramp]
      : [
          recess.span[1] + recess.ramp,
          recess.span[1],
          recess.span[0],
          recess.span[0] - recess.ramp,
        ];
    const set = [0, recess.depth, recess.depth, 0];
    along.forEach((a, i) => {
      const d = set[i] ?? 0;
      if (side === 'front') points.push([a, y0 + d]);
      else if (side === 'rear') points.push([a, y1 - d]);
      else if (side === 'left') points.push([x0 + d, a]);
      else points.push([x1 - d, a]);
    });
  }
  return points;
}

/**
 * The centre line of the rim wire in plan: a closed polygon walked counter-clockwise seen from
 * above, starting at the front-left corner (front edge towards +x, right side towards +y, rear
 * edge towards -x, left side towards -y). Rounded corners are drawn with `cornerSegments`
 * straight pieces. Rack frame, metres. The last point is not repeated.
 */
export function basketRimPath(
  basket: BasketSpec,
  cornerSegments: number = DEFAULT_CORNER_SEGMENTS,
): Vec2[] {
  const [insetX, insetY] = basketRimInset(basket);
  const x0 = insetX;
  const y0 = insetY;
  const x1 = basket.outline.size[0] - insetX;
  const y1 = basket.outline.size[1] - insetY;
  return [
    ...cornerPoints(basket, 'frontLeft', x0, x1, y0, y1, cornerSegments),
    ...recessPoints(basket, 'front', x0, x1, y0, y1),
    ...cornerPoints(basket, 'frontRight', x0, x1, y0, y1, cornerSegments),
    ...recessPoints(basket, 'right', x0, x1, y0, y1),
    ...cornerPoints(basket, 'rearRight', x0, x1, y0, y1, cornerSegments),
    ...recessPoints(basket, 'rear', x0, x1, y0, y1),
    ...cornerPoints(basket, 'rearLeft', x0, x1, y0, y1, cornerSegments),
    ...recessPoints(basket, 'left', x0, x1, y0, y1),
  ];
}

/** Area enclosed by a polygon given as its vertices in order, m^2 (positive if counter-clockwise). */
export function polygonArea(polygon: readonly Vec2[]): number {
  let twice = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (a === undefined || b === undefined) continue;
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return twice / 2;
}

/**
 * Unit vector of a horizontal direction name in the frame it is named in:
 * `'+x'` gives `[1, 0]`, `'-y'` gives `[0, -1]`.
 */
export function directionVector(direction: '+x' | '-x' | '+y' | '-y'): Vec2 {
  if (direction === '+x') return [1, 0];
  if (direction === '-x') return [-1, 0];
  if (direction === '+y') return [0, 1];
  return [0, -1];
}

/**
 * Rise of a basket floor's relief at the plan point (x, y) of the rack frame, metres: 0 for a
 * flat floor, otherwise the profile of `BasketFloorSpec.relief` at the point's coordinate along
 * the relief's axis (linear between the listed points, constant beyond the first and the last).
 */
export function floorRiseAt(floor: BasketFloorSpec, x: number, y: number): number {
  const relief = floor.relief;
  if (relief === null || relief.points.length === 0) return 0;
  const at = relief.axis === 'x' ? x : y;
  const points = relief.points;
  const first = points[0] as { at: number; rise: number };
  if (at <= first.at) return first.rise;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as { at: number; rise: number };
    const b = points[i] as { at: number; rise: number };
    if (at <= b.at) {
      return b.at > a.at ? a.rise + ((b.rise - a.rise) * (at - a.at)) / (b.at - a.at) : b.rise;
    }
  }
  return (points[points.length - 1] as { at: number; rise: number }).rise;
}

/** The largest rise of a basket floor's relief, metres; 0 for a flat floor. */
export function floorReliefMax(floor: BasketFloorSpec): number {
  if (floor.relief === null) return 0;
  return floor.relief.points.reduce((most, p) => Math.max(most, p.rise), 0);
}

/**
 * The lowest rise of a basket floor's relief, metres: 0 for a flat floor and for a relief that
 * nowhere goes below its datum, negative where a part of the floor lies below it.
 */
export function floorReliefMin(floor: BasketFloorSpec): number {
  if (floor.relief === null) return 0;
  return floor.relief.points.reduce((least, p) => Math.min(least, p.rise), 0);
}
