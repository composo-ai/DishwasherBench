/**
 * Building blocks shared by the parametric expansions: validation helpers and the "link", a
 * straight bar with a rounded rectangular cross-section that may change from one end to the
 * other (handles, cutlery shanks, fork tines).
 *
 * Units: metres, item frame.
 */

import type { Pose, Quat, Vec3 } from '@spotless/core';
import {
  mat3FromColumns,
  quatFromMat3,
  v3Cross,
  v3Dot,
  v3Length,
  v3Normalise,
  v3Sub,
} from '@spotless/core';
import type { Part } from './types.ts';

/** Two section sizes closer than this are equal, metres. */
export const SIZE_TOLERANCE = 1e-9;

/** Throws a RangeError unless `value` is a finite number above zero. */
export function requirePositive(value: number, what: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new RangeError(`geometry: ${what} must be a finite number above zero, got ${value}`);
  }
}

/** Throws a RangeError unless `value` is a finite number that is not negative. */
export function requireNonNegative(value: number, what: string): void {
  if (!(value >= 0) || !Number.isFinite(value)) {
    throw new RangeError(
      `geometry: ${what} must be a finite number that is not negative, got ${value}`,
    );
  }
}

/** Throws a RangeError unless every component of `v` is finite. */
export function requireFiniteVec(v: Vec3, what: string): void {
  if (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) {
    throw new RangeError(`geometry: ${what} must be a finite vector`);
  }
}

/** Unit quaternion of the rotation whose columns are the orthonormal right-handed axes x, y, z. */
export function quatFromAxes(x: Vec3, y: Vec3, z: Vec3): Quat {
  return quatFromMat3(mat3FromColumns(x, y, z));
}

/**
 * The horizontal direction across a bar that runs along `dir` (a unit vector): `z x dir`
 * normalised, so that for a bar along +x the width is along +y and the thickness along +z. A
 * vertical bar has no horizontal across-direction; +y is used.
 */
export function widthDirection(dir: Vec3): Vec3 {
  const w: Vec3 = [-dir[1], dir[0], 0];
  const len = Math.hypot(w[0], w[1]);
  return len > 1e-9 ? [w[0] / len, w[1] / len, 0] : [0, 1, 0];
}

/** Cross-section of a link at one of its ends: full sizes across (width) and through (thickness). */
export interface LinkSection {
  readonly width: number;
  readonly thickness: number;
}

/**
 * A straight bar from `from` to `to` whose cross-section is a rounded rectangle, `width` along
 * `widthDir` and `thickness` along `dir x widthDir`, possibly different at the two ends. The
 * corner radius is half the smallest of the four section sizes, so a bar that is as wide as it
 * is thick is round. The ends are rounded with the same radius and so reach that far beyond
 * `from` and `to`; consecutive links of a chain therefore blend into each other like the spheres
 * of a capsule chain.
 *
 * Returns a capsule (round bar), a rounded box (uniform section) or a rounded hull (tapering
 * section). For the box the part frame has x along the bar, y along the width and z along the
 * thickness; the other two are expressed directly in the item frame.
 */
export function linkPart(
  id: string,
  material: string,
  from: Vec3,
  to: Vec3,
  widthDir: Vec3,
  a: LinkSection,
  b: LinkSection,
  porosity?: number,
): Part {
  const axis = v3Sub(to, from);
  const length = v3Length(axis);
  if (!(length > SIZE_TOLERANCE)) throw new RangeError(`geometry: link '${id}' has no length`);
  for (const s of [a, b]) {
    requirePositive(s.width, `width of '${id}'`);
    requirePositive(s.thickness, `thickness of '${id}'`);
  }
  const dir: Vec3 = [axis[0] / length, axis[1] / length, axis[2] / length];
  // Make the width direction exactly perpendicular to the bar.
  const along = v3Dot(widthDir, dir);
  const w = v3Normalise([
    widthDir[0] - along * dir[0],
    widthDir[1] - along * dir[1],
    widthDir[2] - along * dir[2],
  ]);
  if (v3Length(w) === 0)
    throw new RangeError(`geometry: link '${id}' has its width along its axis`);
  const t = v3Cross(dir, w);
  const radius = Math.min(a.width, a.thickness, b.width, b.thickness) / 2;
  const half = (s: LinkSection): [number, number] => [
    Math.max(0, s.width / 2 - radius),
    Math.max(0, s.thickness / 2 - radius),
  ];
  const [wa, ta] = half(a);
  const [wb, tb] = half(b);
  const base = porosity === undefined ? { id, material } : { id, material, porosity };
  const identity: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };
  const round = (x: number): boolean => x <= SIZE_TOLERANCE;
  if (round(wa) && round(ta) && round(wb) && round(tb)) {
    return { ...base, prim: { kind: 'capsule', a: from, b: to, radius }, pose: identity };
  }
  if (Math.abs(wa - wb) <= SIZE_TOLERANCE && Math.abs(ta - tb) <= SIZE_TOLERANCE) {
    return {
      ...base,
      prim: { kind: 'rbox', halfExtents: [length / 2, wa, ta], radius },
      pose: {
        p: [0.5 * (from[0] + to[0]), 0.5 * (from[1] + to[1]), 0.5 * (from[2] + to[2])],
        q: quatFromAxes(dir, w, t),
      },
    };
  }
  const points: Vec3[] = [];
  const corners = (c: Vec3, hw: number, ht: number): void => {
    for (const sw of round(hw) ? [0] : [-1, 1]) {
      for (const st of round(ht) ? [0] : [-1, 1]) {
        points.push([
          c[0] + sw * hw * w[0] + st * ht * t[0],
          c[1] + sw * hw * w[1] + st * ht * t[1],
          c[2] + sw * hw * w[2] + st * ht * t[2],
        ]);
      }
    }
  };
  corners(from, wa, ta);
  corners(to, wb, tb);
  return { ...base, prim: { kind: 'hull', points, radius }, pose: identity };
}
