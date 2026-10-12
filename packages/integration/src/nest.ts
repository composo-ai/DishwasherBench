/**
 * The geometric nest spacing of identical coaxial items: how far above a bowl an identical bowl
 * comes to rest when it is lowered into it along their common axis. Computed twice, by two
 * routes that share no code:
 *
 * - {@link profileNestSpacing}: from the mid-surface profiles alone, in the meridian plane. A
 *   shell of revolution is the set of points within `t / 2` of its profile, so two coaxial shells
 *   overlap exactly when two of their profile segments are closer than the sum of their half
 *   thicknesses. Plain two-dimensional segment geometry.
 * - {@link kernelNestSpacing}: from the geometry kernel's signed distance of the whole shape,
 *   sampled at the vertices of a fine render mesh.
 *
 * Units: metres.
 */

import type { Shape, SorProfilePoint } from '@spotless/geometry';
import { boundingBox, buildRenderMesh, signedDistance } from '@spotless/geometry';

/** Distance between the planar segments `a0 a1` and `b0 b1`; zero when they cross. */
function segmentDistance2(
  a0: readonly [number, number],
  a1: readonly [number, number],
  b0: readonly [number, number],
  b1: readonly [number, number],
): number {
  const pointSegment = (
    p: readonly [number, number],
    s0: readonly [number, number],
    s1: readonly [number, number],
  ): number => {
    const dx = s1[0] - s0[0];
    const dy = s1[1] - s0[1];
    const l2 = dx * dx + dy * dy;
    const u =
      l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - s0[0]) * dx + (p[1] - s0[1]) * dy) / l2));
    return Math.hypot(p[0] - s0[0] - u * dx, p[1] - s0[1] - u * dy);
  };
  const cross = (
    o: readonly [number, number],
    p: readonly [number, number],
    q: readonly [number, number],
  ): number => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(a0, a1, b0);
  const d2 = cross(a0, a1, b1);
  const d3 = cross(b0, b1, a0);
  const d4 = cross(b0, b1, a1);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    pointSegment(a0, b0, b1),
    pointSegment(a1, b0, b1),
    pointSegment(b0, a0, a1),
    pointSegment(b1, a0, a1),
  );
}

/** The full-turn, unstretched, upright shells of revolution of a shape: their profiles. */
function coaxialProfiles(shape: Shape): (readonly SorProfilePoint[])[] {
  const out: (readonly SorProfilePoint[])[] = [];
  for (const part of shape.parts) {
    const prim = part.prim;
    const upright =
      part.pose.p[0] === 0 &&
      part.pose.p[1] === 0 &&
      part.pose.p[2] === 0 &&
      part.pose.q[0] === 0 &&
      part.pose.q[1] === 0 &&
      part.pose.q[2] === 0;
    if (prim.kind !== 'sor' || prim.arc !== undefined || prim.scaleXY !== undefined || !upright) {
      throw new RangeError(
        `integration: part '${part.id}' is not a full, round shell on the item's axis`,
      );
    }
    for (let i = 0; i + 1 < prim.profile.length; i++) {
      const a = prim.profile[i] as SorProfilePoint;
      const b = prim.profile[i + 1] as SorProfilePoint;
      if (a.t !== b.t) {
        throw new RangeError(
          `integration: part '${part.id}' has a wall of varying thickness; use kernelNestSpacing`,
        );
      }
    }
    out.push(prim.profile);
  }
  return out;
}

/**
 * Gap between two coaxial copies of a set of shells of constant wall thickness, the second
 * raised by `lift`: the smallest distance between their profiles in the meridian plane less the
 * two half thicknesses (negative when they overlap). The closest points of two coaxial solids
 * of revolution lie in a common meridian plane.
 */
function profileGap(profiles: readonly (readonly SorProfilePoint[])[], lift: number): number {
  let gap = Infinity;
  for (const lower of profiles) {
    for (const upper of profiles) {
      for (let i = 0; i + 1 < lower.length; i++) {
        const a0 = lower[i] as SorProfilePoint;
        const a1 = lower[i + 1] as SorProfilePoint;
        for (let j = 0; j + 1 < upper.length; j++) {
          const b0 = upper[j] as SorProfilePoint;
          const b1 = upper[j + 1] as SorProfilePoint;
          const d = segmentDistance2(
            [a0.r, a0.z],
            [a1.r, a1.z],
            [b0.r, b0.z + lift],
            [b1.r, b1.z + lift],
          );
          gap = Math.min(gap, d - a0.t / 2 - b0.t / 2);
        }
      }
    }
  }
  return gap;
}

/**
 * The lift at which an identical copy lowered from above first touches: scans down from `from`
 * in steps of `step` until the gap turns negative, then bisects to 1e-9 m. Returns 0 when the
 * copy never touches on the way down (it can be lowered all the way).
 */
function firstContact(gap: (lift: number) => number, from: number, step: number): number {
  let clear = from;
  for (;;) {
    const next = clear - step;
    if (next <= 0) return 0;
    if (gap(next) < 0) {
      let lo = next;
      let hi = clear;
      while (hi - lo > 1e-9) {
        const mid = (lo + hi) / 2;
        if (gap(mid) < 0) lo = mid;
        else hi = mid;
      }
      return hi;
    }
    clear = next;
  }
}

/**
 * Geometric nest spacing of a shape made of full-turn shells of revolution of constant wall
 * thickness on the item's axis (a bowl with its foot ring), from its profiles: the height above
 * a copy at which an identical copy lowered along the axis first touches it, metres.
 */
export function profileNestSpacing(shape: Shape): number {
  const profiles = coaxialProfiles(shape);
  const box = boundingBox(shape);
  return firstContact((lift) => profileGap(profiles, lift), box.max[2] - box.min[2] + 0.001, 2e-4);
}

/** Where two nested copies of a shape touch. */
export interface NestContact {
  /** The geometric nest spacing ({@link profileNestSpacing}), metres. */
  readonly spacing: number;
  /** Distance from the axis of the mid-surface point of the wall face that is touched, metres. */
  readonly radius: number;
  /** Half the wall thickness there, metres. */
  readonly halfThickness: number;
  /** Lean of that wall face from the axis, radians (0 for a vertical wall). */
  readonly wallFromAxis: number;
}

/** Closest point of the segment `s0 s1` to `p`, as the parameter along the segment in [0, 1]. */
function closestParameter(
  p: readonly [number, number],
  s0: readonly [number, number],
  s1: readonly [number, number],
): number {
  const dx = s1[0] - s0[0];
  const dy = s1[1] - s0[1];
  const l2 = dx * dx + dy * dy;
  return l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - s0[0]) * dx + (p[1] - s0[1]) * dy) / l2));
}

/**
 * Where two copies of a shape of constant wall thickness touch when one nests in the other: the
 * pair of profile segments that are a wall thickness apart at the nest spacing, and of those the
 * wall face (the segment touched somewhere along its length, not at an end) with its radius and
 * its lean. A copy turned about the axis slides up or down that face when the two are not
 * exactly round, which is what faceted collision pieces are.
 */
export function profileNestContact(shape: Shape): NestContact {
  const profiles = coaxialProfiles(shape);
  const spacing = profileNestSpacing(shape);
  let best: NestContact | undefined;
  let least = Infinity;
  for (const lower of profiles) {
    for (const upper of profiles) {
      for (let i = 0; i + 1 < lower.length; i++) {
        const a0 = lower[i] as SorProfilePoint;
        const a1 = lower[i + 1] as SorProfilePoint;
        for (let j = 0; j + 1 < upper.length; j++) {
          const b0 = upper[j] as SorProfilePoint;
          const b1 = upper[j + 1] as SorProfilePoint;
          const pa0: [number, number] = [a0.r, a0.z];
          const pa1: [number, number] = [a1.r, a1.z];
          const pb0: [number, number] = [b0.r, b0.z + spacing];
          const pb1: [number, number] = [b1.r, b1.z + spacing];
          const gap = segmentDistance2(pa0, pa1, pb0, pb1) - a0.t / 2 - b0.t / 2;
          if (gap >= least) continue;
          least = gap;
          // The face is the segment met by an end of the other one somewhere along its length.
          const onLower = [closestParameter(pb0, pa0, pa1), closestParameter(pb1, pa0, pa1)];
          const lowerIsFace = onLower.some((u) => u > 0 && u < 1);
          const [f0, f1, t] = lowerIsFace ? [pa0, pa1, a0.t] : [pb0, pb1, b0.t];
          const other = lowerIsFace ? [pb0, pb1] : [pa0, pa1];
          // The point of the face nearest to the end of the other segment that is nearest to it.
          let u = 0.5;
          let nearest = Infinity;
          for (const end of other) {
            const at = closestParameter(end as [number, number], f0, f1);
            const d = Math.hypot(
              f0[0] + at * (f1[0] - f0[0]) - (end as [number, number])[0],
              f0[1] + at * (f1[1] - f0[1]) - (end as [number, number])[1],
            );
            if (d < nearest) {
              nearest = d;
              u = at;
            }
          }
          best = {
            spacing,
            radius: f0[0] + u * (f1[0] - f0[0]),
            halfThickness: t / 2,
            wallFromAxis: Math.atan2(Math.abs(f1[0] - f0[0]), Math.abs(f1[1] - f0[1])),
          };
        }
      }
    }
  }
  if (best === undefined) throw new RangeError('integration: the shape has no profile segment');
  return best;
}

/**
 * Geometric nest spacing of a shape of revolution from the kernel's signed distance, metres:
 * the same quantity as {@link profileNestSpacing}, for any shape whose parts are round about the
 * item's axis. The surface of each copy is sampled at the vertices of a render mesh of chord
 * error `chordError` (default 0.01 mm) and tested against the signed distance of the other.
 */
export function kernelNestSpacing(shape: Shape, chordError = 1e-5): number {
  const mesh = buildRenderMesh(shape, { chordError });
  // The shape is round about z: keep one point per (r, z).
  const seen = new Set<string>();
  const samples: [number, number][] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const r = Math.hypot(mesh.positions[i] as number, mesh.positions[i + 1] as number);
    const z = mesh.positions[i + 2] as number;
    const key = `${Math.round(r * 1e7)}|${Math.round(z * 1e7)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    samples.push([r, z]);
  }
  const gap = (lift: number): number => {
    let least = Infinity;
    for (const [r, z] of samples) {
      // A surface point of the raised copy against the lower one, and of the lower one against
      // the raised copy.
      least = Math.min(
        least,
        signedDistance(shape, [r, 0, z + lift]),
        signedDistance(shape, [r, 0, z - lift]),
      );
    }
    return least;
  };
  const box = boundingBox(shape);
  return firstContact(gap, box.max[2] - box.min[2] + 0.001, 2e-4);
}
