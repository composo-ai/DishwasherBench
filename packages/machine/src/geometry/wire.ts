/**
 * Wires as capsule chains (docs/design/platform.md section 4.4): one capsule per straight run
 * and three to five short capsules round each bend; welded crossings simply overlap.
 *
 * A wire is given as the polyline of its centre line with sharp corners. `filletPolyline`
 * replaces every corner sharper than `MIN_ROUNDED_BEND` by an arc of chords, and `wireParts`
 * turns the result into capsule parts. All coordinates are in the frame of the shape being
 * built, in metres.
 */

import type { Vec3 } from '@spotless/core';
import {
  POSE_IDENTITY,
  v3Add,
  v3AddScaled,
  v3Distance,
  v3Dot,
  v3Length,
  v3Normalise,
  v3Scale,
  v3Sub,
} from '@spotless/core';
import type { Part } from '@spotless/geometry';
import { BEND_CAPSULE_ANGLE, BEND_RADIUS_RATIO, MIN_ROUNDED_BEND } from './assumptions.ts';

/** Two points closer than this are one point, metres. */
const COINCIDENT = 1e-7;

/** One wire: the sharp-cornered polyline of its centre line and its radius. */
export interface WireRun {
  /** Id prefix of its capsules: capsule k is `<id>.<k>`. */
  readonly id: string;
  readonly points: readonly Vec3[];
  /** Radius of the finished (coated) wire, metres. */
  readonly radius: number;
  /** True to join the last point back to the first. */
  readonly closed?: boolean;
  /** Centre-line radius of its bends, metres; default `BEND_RADIUS_RATIO` wire diameters. */
  readonly bendRadius?: number;
}

/** Number of chords a bend through `angle` radians is drawn with: 3 to 5. */
export function bendCapsuleCount(angle: number): number {
  return Math.min(5, Math.max(3, Math.ceil(angle / BEND_CAPSULE_ANGLE - 1e-9)));
}

/** Removes consecutive coincident points (and a last point equal to the first of a closed line). */
function dedupe(points: readonly Vec3[], closed: boolean): Vec3[] {
  const out: Vec3[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last === undefined || v3Distance(last, p) > COINCIDENT) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (closed && out.length > 1 && first !== undefined && last !== undefined) {
    if (v3Distance(first, last) <= COINCIDENT) out.pop();
  }
  return out;
}

/**
 * The points of one rounded corner at `corner`, arriving from `before` and leaving towards
 * `after`: the chord ends of an arc of radius at most `bendRadius` tangent to both legs, in
 * order. A corner shallower than `MIN_ROUNDED_BEND` is returned as the corner itself. The arc
 * uses at most 45 % of either leg, so that two rounded corners never overlap.
 */
export function roundedCorner(before: Vec3, corner: Vec3, after: Vec3, bendRadius: number): Vec3[] {
  const lengthIn = v3Distance(before, corner);
  const lengthOut = v3Distance(corner, after);
  if (lengthIn <= COINCIDENT || lengthOut <= COINCIDENT) return [corner];
  const u = v3Normalise(v3Sub(corner, before));
  const v = v3Normalise(v3Sub(after, corner));
  const turn = Math.acos(Math.min(1, Math.max(-1, v3Dot(u, v))));
  if (turn < MIN_ROUNDED_BEND || turn > Math.PI - 1e-3) return [corner];
  const tanHalf = Math.tan(turn / 2);
  const tangent = Math.min(bendRadius * tanHalf, 0.45 * lengthIn, 0.45 * lengthOut);
  const radius = tangent / tanHalf;
  const start = v3AddScaled(corner, u, -tangent);
  const end = v3AddScaled(corner, v, tangent);
  // The centre lies on the bisector of the corner, radius / cos(turn / 2) from it.
  const bisector = v3Normalise(v3Sub(v, u));
  const centre = v3AddScaled(corner, bisector, radius / Math.cos(turn / 2));
  const a = v3Sub(start, centre);
  const b = v3Sub(end, centre);
  const n = bendCapsuleCount(turn);
  const points: Vec3[] = [start];
  const sinTurn = Math.sin(turn);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const wa = Math.sin((1 - t) * turn) / sinTurn;
    const wb = Math.sin(t * turn) / sinTurn;
    points.push(v3Add(centre, v3Add(v3Scale(a, wa), v3Scale(b, wb))));
  }
  points.push(end);
  return points;
}

/**
 * The polyline with every sharp corner rounded (see `roundedCorner`). An open line keeps its
 * two ends; a closed line is returned without repeating its first point.
 */
export function filletPolyline(
  points: readonly Vec3[],
  bendRadius: number,
  closed = false,
): Vec3[] {
  const line = dedupe(points, closed);
  const n = line.length;
  if (n < 3) return line;
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const here = line[i] as Vec3;
    if (!closed && (i === 0 || i === n - 1)) {
      out.push(here);
      continue;
    }
    const before = line[(i - 1 + n) % n] as Vec3;
    const after = line[(i + 1) % n] as Vec3;
    out.push(...roundedCorner(before, here, after, bendRadius));
  }
  return dedupe(out, closed);
}

/** A capsule part between two points, with the identity pose. */
export function capsulePart(id: string, a: Vec3, b: Vec3, radius: number, material: string): Part {
  return { id, prim: { kind: 'capsule', a, b, radius }, pose: POSE_IDENTITY, material };
}

/**
 * The capsules of one wire: its centre line with rounded bends, one capsule per chord. Capsule
 * `k` has the id `<run.id>.<k>`.
 */
export function wireParts(run: WireRun, material: string): Part[] {
  const closed = run.closed === true;
  const bendRadius = run.bendRadius ?? BEND_RADIUS_RATIO * 2 * run.radius;
  const line = filletPolyline(run.points, bendRadius, closed);
  const parts: Part[] = [];
  const count = closed ? line.length : line.length - 1;
  for (let i = 0; i < count; i++) {
    const a = line[i] as Vec3;
    const b = line[(i + 1) % line.length] as Vec3;
    if (v3Length(v3Sub(b, a)) <= COINCIDENT) continue;
    parts.push(capsulePart(`${run.id}.${parts.length}`, a, b, run.radius, material));
  }
  if (parts.length === 0 && line[0] !== undefined) {
    parts.push(capsulePart(`${run.id}.0`, line[0], line[0], run.radius, material));
  }
  return parts;
}

/** Total length of the centre lines of the capsules among `parts`, metres. */
export function capsuleLength(parts: readonly Part[]): number {
  let total = 0;
  for (const part of parts) {
    if (part.prim.kind === 'capsule') total += v3Distance(part.prim.a, part.prim.b);
  }
  return total;
}
