/**
 * Test support: answers computed from the geometry kernel alone, sharing no code with the atlas
 * or the tracers, to hold them against.
 *
 * - {@link sphereTrace}: the first point of a ray on a shape by marching its signed distance;
 * - {@link exposedAreaByPart}: the area of each part that is surface of the whole shape, from
 *   the kernel's render mesh and the signed distances of the other parts;
 * - {@link chordRay}, {@link alongAxisRay}: ray families for statistical checks.
 *
 * Units: metres, m2. Frame: the item frame of the shape.
 */

import { hashU32, u32ToUnitFloat } from '@spotless/core';
import {
  buildRenderMesh,
  primitiveSignedDistance,
  signedDistance,
  type Aabb,
  type Shape,
} from '@spotless/geometry';
import { affineFromPose, affineInverseRigid, affinePoint } from '../affine.ts';

/** A ray of a test family: origin, unit direction, length. */
export interface TestRay {
  readonly o: [number, number, number];
  readonly d: [number, number, number];
  readonly length: number;
}

/** A number in [0, 1) from the counter-based generator: stream `seed`, counters `i` and `k`. */
export function unitRandom(seed: number, i: number, k: number): number {
  return u32ToUnitFloat(hashU32(seed, i, k));
}

/**
 * Distance along a ray to the first point where it enters the shape from outside, by marching
 * the kernel's signed distance; infinity when it does not within `tMax`.
 */
export function sphereTrace(shape: Shape, ray: TestRay, tMax = ray.length): number {
  let t = 0;
  let outside = false;
  for (let i = 0; i < 20000 && t < tMax; i++) {
    const sd = signedDistance(shape, [
      ray.o[0] + t * ray.d[0],
      ray.o[1] + t * ray.d[1],
      ray.o[2] + t * ray.d[2],
    ]);
    if (sd > 1e-8) {
      outside = true;
      t += sd;
    } else if (outside) {
      return t;
    } else {
      t += Math.max(-sd, 1e-5);
    }
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Ray `i` of an isotropic family of chords of the sphere about a box (two uniform points of the
 * sphere joined): such lines strike a convex surface in proportion to its area.
 */
export function chordRay(seed: number, i: number, box: Aabb, margin = 0.005): TestRay {
  const c = [0, 1, 2].map((k) => 0.5 * ((box.min[k] as number) + (box.max[k] as number)));
  const radius =
    0.5 * Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) +
    margin;
  const point = (k: number): [number, number, number] => {
    const z = 2 * unitRandom(seed, i, k) - 1;
    const phi = 2 * Math.PI * unitRandom(seed, i, k + 1);
    const s = Math.sqrt(1 - z * z);
    return [
      (c[0] as number) + radius * s * Math.cos(phi),
      (c[1] as number) + radius * s * Math.sin(phi),
      (c[2] as number) + radius * z,
    ];
  };
  const a = point(0);
  const b = point(2);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
  return {
    o: a,
    d: [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length],
    length,
  };
}

/**
 * Ray `i` of a family that runs along the longest axis of a box, from 10 mm beyond its far end,
 * through a random point of its cross-section (widened by `margin`), tilted by at most
 * `maxTilt` radians: the rays that run along a wire, or down a piece of cutlery standing in the
 * basket.
 */
export function alongAxisRay(
  seed: number,
  i: number,
  box: Aabb,
  maxTilt: number,
  margin = 0,
): TestRay {
  const extent = [0, 1, 2].map((k) => (box.max[k] as number) - (box.min[k] as number));
  const axis = extent.indexOf(Math.max(...extent));
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const o: [number, number, number] = [0, 0, 0];
  const d: [number, number, number] = [0, 0, 0];
  o[u] =
    (box.min[u] as number) - margin + unitRandom(seed, i, 0) * ((extent[u] as number) + 2 * margin);
  o[v] =
    (box.min[v] as number) - margin + unitRandom(seed, i, 1) * ((extent[v] as number) + 2 * margin);
  o[axis] = (box.max[axis] as number) + 0.01;
  const tilt = maxTilt * unitRandom(seed, i, 2);
  const turn = 2 * Math.PI * unitRandom(seed, i, 3);
  d[axis] = -Math.cos(tilt);
  d[u] = Math.sin(tilt) * Math.cos(turn);
  d[v] = Math.sin(tilt) * Math.sin(turn);
  return { o, d, length: (extent[axis] as number) + 0.02 };
}

/**
 * Per tolerance and part: the area of the part's surface that is not inside another part, m2.
 * The kernel's render mesh (chord error 0.05 mm) is cut into pieces no longer than `step`, and a
 * piece counts for a tolerance when the signed distance of every other part at its centre
 * exceeds it (positive: clear of the other parts by that much; negative: up to that deep inside
 * one). Only the parts `wanted` selects are measured; the others are 0.
 */
export function exposedAreaByPart(
  shape: Shape,
  tolerances: readonly number[],
  wanted: (partIndex: number) => boolean = () => true,
  step = 0.4e-3,
): Float64Array[] {
  const mesh = buildRenderMesh(shape, { chordError: 0.05e-3 });
  const frames = shape.parts.map((part) => affineInverseRigid(affineFromPose(part.pose)));
  const out = tolerances.map(() => new Float64Array(shape.parts.length));
  const P = mesh.positions;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const part = mesh.triPart[t] as number;
    if (!wanted(part)) continue;
    const v = [0, 1, 2].map((i) => {
      const k = mesh.indices[3 * t + i] as number;
      return [P[3 * k] as number, P[3 * k + 1] as number, P[3 * k + 2] as number];
    }) as [number[], number[], number[]];
    const e1 = [0, 1, 2].map((i) => (v[1][i] as number) - (v[0][i] as number));
    const e2 = [0, 1, 2].map((i) => (v[2][i] as number) - (v[0][i] as number));
    const area =
      0.5 *
      Math.hypot(
        (e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number),
        (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number),
        (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number),
      );
    const longest = Math.max(
      Math.hypot(e1[0] as number, e1[1] as number, e1[2] as number),
      Math.hypot(e2[0] as number, e2[1] as number, e2[2] as number),
      Math.hypot(
        (e1[0] as number) - (e2[0] as number),
        (e1[1] as number) - (e2[1] as number),
        (e1[2] as number) - (e2[2] as number),
      ),
    );
    const n = Math.max(1, Math.ceil(longest / step));
    const piece = area / (n * n);
    // The n^2 congruent sub-triangles: n - i pointing one way and n - i - 1 the other in row i.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2 * (n - i) - 1; j++) {
        const flipped = j % 2 === 1;
        const a = (i + (flipped ? 2 / 3 : 1 / 3)) / n;
        const b = (Math.floor(j / 2) + (flipped ? 2 / 3 : 1 / 3)) / n;
        const x = (v[0][0] as number) + a * (e1[0] as number) + b * (e2[0] as number);
        const y = (v[0][1] as number) + a * (e1[1] as number) + b * (e2[1] as number);
        const z = (v[0][2] as number) + a * (e1[2] as number) + b * (e2[2] as number);
        let nearest = Number.POSITIVE_INFINITY;
        for (let other = 0; other < shape.parts.length; other++) {
          if (other === part) continue;
          const local = affinePoint(frames[other] as (typeof frames)[number], x, y, z);
          nearest = Math.min(
            nearest,
            primitiveSignedDistance((shape.parts[other] as Shape['parts'][number]).prim, local),
          );
        }
        tolerances.forEach((tolerance, k) => {
          const sum = out[k] as Float64Array;
          if (nearest > tolerance) sum[part] = (sum[part] as number) + piece;
        });
      }
    }
  }
  return out;
}
