/**
 * The rim of a basket in three dimensions, and where its walls stand in plan.
 *
 * `basketRimPath` (`outline.ts`) gives the plan centre line of the rim wire. Here that line is
 * cut into its four sides and four corners and given heights: each side runs at the height of
 * the top wire of its wall, and a corner between two sides of different height slopes from one
 * to the other. Rack frame, metres.
 */

import type { Vec3 } from '@spotless/core';
import { basketRimPath, DEFAULT_CORNER_SEGMENTS } from '../outline.ts';
import type { BasketSpec, BasketWallSpec, CornerSpec, Side, Vec2 } from '../types.ts';

/** One stretch of the rim line: a side, or the corner between two sides. */
export interface RimPiece {
  readonly kind: 'side' | 'corner';
  /** For a side: which. For a corner: the side the line arrives on. */
  readonly side: Side;
  /** For a corner: the side the line leaves on. */
  readonly to: Side | null;
  /** Plan points in walking order (counter-clockwise seen from above). */
  readonly points: readonly Vec2[];
}

/** The wall of a basket on one side. Throws a RangeError if the basket has none there. */
export function wallOf(basket: BasketSpec, side: Side): BasketWallSpec {
  const wall = basket.walls.find((w) => w.side === side);
  if (wall === undefined || wall.horizontalWireZ.length === 0) {
    throw new RangeError(`machine geometry: basket "${basket.id}" has no ${side} wall wires`);
  }
  return wall;
}

/** Height of the rim wire centre on one side: the top horizontal wire of that wall, metres. */
export function rimZ(basket: BasketSpec, side: Side): number {
  const wall = wallOf(basket, side);
  return wall.horizontalWireZ[wall.horizontalWireZ.length - 1] as number;
}

function cornerPointCount(corner: CornerSpec, segments: number): number {
  if (corner.kind === 'square') return 1;
  if (corner.kind === 'chamfer') return 2;
  return Math.max(1, Math.floor(segments)) + 1;
}

/**
 * The rim line cut into corner, side, corner, side, ... starting with the front-left corner and
 * the front side. A side piece starts with the last point of the corner before it and ends with
 * the first point of the corner after it, with the points of its recesses in between.
 */
export function rimPieces(
  basket: BasketSpec,
  cornerSegments: number = DEFAULT_CORNER_SEGMENTS,
): RimPiece[] {
  const path = basketRimPath(basket, cornerSegments);
  const corners: readonly [keyof BasketSpec['outline']['corners'], Side, Side][] = [
    ['frontLeft', 'left', 'front'],
    ['frontRight', 'front', 'right'],
    ['rearRight', 'right', 'rear'],
    ['rearLeft', 'rear', 'left'],
  ];
  // Slice the path: each corner's points, then the recess points of the side it leaves on.
  const cornerPoints: Vec2[][] = [];
  const recessPoints: Vec2[][] = [];
  let at = 0;
  for (const [name, , leave] of corners) {
    const count = cornerPointCount(basket.outline.corners[name], cornerSegments);
    cornerPoints.push(path.slice(at, at + count));
    at += count;
    const recesses = basket.outline.recesses.filter((r) => r.side === leave).length * 4;
    recessPoints.push(path.slice(at, at + recesses));
    at += recesses;
  }
  if (at !== path.length) {
    throw new RangeError(
      `machine geometry: the rim path of basket "${basket.id}" has ${path.length} points, expected ${at}`,
    );
  }
  const pieces: RimPiece[] = [];
  corners.forEach(([, arrive, leave], k) => {
    const corner = cornerPoints[k] as Vec2[];
    const next = cornerPoints[(k + 1) % 4] as Vec2[];
    pieces.push({ kind: 'corner', side: arrive, to: leave, points: corner });
    pieces.push({
      kind: 'side',
      side: leave,
      to: null,
      points: [corner[corner.length - 1] as Vec2, ...(recessPoints[k] as Vec2[]), next[0] as Vec2],
    });
  });
  return pieces;
}

/** The points of a corner piece with heights sloping from `zFrom` to `zTo` along its length. */
function cornerWithHeights(points: readonly Vec2[], zFrom: number, zTo: number): Vec3[] {
  if (points.length === 1) {
    const p = points[0] as Vec2;
    return zFrom === zTo
      ? [[p[0], p[1], zFrom]]
      : [
          [p[0], p[1], zFrom],
          [p[0], p[1], zTo],
        ];
  }
  // By length along the corner, so that an uneven arc slopes evenly.
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vec2;
    const b = points[i] as Vec2;
    lengths.push((lengths[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[lengths.length - 1] as number;
  return points.map((p, i) => {
    const t = total > 0 ? (lengths[i] as number) / total : i / (points.length - 1);
    return [p[0], p[1], zFrom + (zTo - zFrom) * t];
  });
}

/**
 * The centre line of the rim wire as a closed loop in three dimensions, walked counter-clockwise
 * seen from above from the front-left corner. The last point is not repeated.
 */
export function rimLoop(basket: BasketSpec, cornerSegments?: number): Vec3[] {
  const loop: Vec3[] = [];
  for (const piece of rimPieces(basket, cornerSegments)) {
    if (piece.kind === 'corner') {
      loop.push(
        ...cornerWithHeights(
          piece.points,
          rimZ(basket, piece.side),
          rimZ(basket, piece.to as Side),
        ),
      );
    } else {
      const z = rimZ(basket, piece.side);
      // The end points of a side piece are the corner points already pushed and to come.
      for (const p of piece.points.slice(1, -1)) loop.push([p[0], p[1], z]);
    }
  }
  return loop;
}

/**
 * The centre lines of the horizontal wall wires at height `z` on the sides in `sides`: each
 * follows the plan line of the rim. Neighbouring sides that both have the wire are joined round
 * the corner between them; when all four have it the result is one closed loop.
 */
export function wallWireRuns(
  basket: BasketSpec,
  z: number,
  sides: ReadonlySet<Side>,
  cornerSegments?: number,
): { readonly points: Vec3[]; readonly closed: boolean; readonly sides: Side[] }[] {
  const pieces = rimPieces(basket, cornerSegments);
  const lift = (points: readonly Vec2[]): Vec3[] => points.map((p) => [p[0], p[1], z]);
  if (sides.size === 4) {
    const points: Vec3[] = [];
    for (const piece of pieces) {
      points.push(...lift(piece.kind === 'corner' ? piece.points : piece.points.slice(1, -1)));
    }
    return [{ points, closed: true, sides: ['front', 'right', 'rear', 'left'] }];
  }
  const runs: { points: Vec3[]; closed: boolean; sides: Side[] }[] = [];
  // Start the walk at a side that is absent, so that no run wraps round the end of the list.
  const start = pieces.findIndex((p) => p.kind === 'side' && !sides.has(p.side));
  let current: { points: Vec3[]; closed: boolean; sides: Side[] } | null = null;
  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[(start + k) % pieces.length] as RimPiece;
    if (piece.kind === 'side') {
      if (sides.has(piece.side)) {
        if (current === null) {
          current = { points: [], closed: false, sides: [] };
          runs.push(current);
          current.points.push(...lift(piece.points));
        } else {
          current.points.push(...lift(piece.points.slice(1)));
        }
        current.sides.push(piece.side);
      } else {
        current = null;
      }
    } else if (current !== null && piece.to !== null && sides.has(piece.to)) {
      // A corner between two sides that both carry the wire: its inner points join them.
      current.points.push(...lift(piece.points.slice(1, -1)));
    } else {
      current = null;
    }
  }
  return runs;
}

/** One crossing of a straight line in plan with the rim loop. */
export interface RimCrossing {
  /** The crossing point on the rim centre line, rack frame. */
  readonly point: Vec3;
  /** The coordinate along the line (y for a line of constant x, x for a line of constant y). */
  readonly along: number;
}

/**
 * Where the plan line `axis = value` crosses the rim loop, sorted along the line, with the rim
 * height interpolated at each crossing. `axis` is the coordinate held constant.
 */
export function rimCrossings(loop: readonly Vec3[], axis: 'x' | 'y', value: number): RimCrossing[] {
  const c = axis === 'x' ? 0 : 1;
  const o = axis === 'x' ? 1 : 0;
  const hits: RimCrossing[] = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as Vec3;
    const b = loop[(i + 1) % loop.length] as Vec3;
    const da = a[c] - value;
    const db = b[c] - value;
    if (da === db) continue;
    // Half-open, so that a crossing exactly at a vertex is counted once.
    if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
      const t = da / (da - db);
      const point: Vec3 = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
      hits.push({ point, along: point[o] });
    }
  }
  return hits.sort((p, q) => p.along - q.along);
}

/** True when the plan point lies inside the rim loop (even-odd rule). */
export function insideRim(loop: readonly Vec3[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as Vec3;
    const b = loop[(i + 1) % loop.length] as Vec3;
    if (a[1] > y !== b[1] > y) {
      const xAt = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
      if (xAt > x) inside = !inside;
    }
  }
  return inside;
}
