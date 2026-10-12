/**
 * Helpers for this package's tests only (not exported from the package entry point).
 *
 * Test inputs come from mulberry32, a generator unrelated to the one under test in `rng.ts`, so
 * that the tests of `rng.ts` never use it to generate their own inputs.
 */

import type { Quat, Vec3 } from './math/types.ts';

/** A deterministic source of test inputs. */
export interface TestRandom {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Uniform integer in [0, 2^32). */
  u32(): number;
  /** Vector with each component uniform in [-scale, scale). */
  vec3(scale?: number): Vec3;
  /** Unit vector, uniformly distributed on the sphere. */
  unitVec3(): Vec3;
  /** Unit quaternion, uniformly distributed over rotations. */
  unitQuat(): Quat;
}

/** Creates a mulberry32-based source of test inputs from a 32-bit seed. */
export function testRandom(seed: number): TestRandom {
  let state = seed >>> 0;
  const u32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const next = (): number => u32() / 4294967296;
  const range = (lo: number, hi: number): number => lo + (hi - lo) * next();
  const gaussian = (): number =>
    Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return {
    next,
    range,
    u32,
    vec3: (scale = 1) => [range(-scale, scale), range(-scale, scale), range(-scale, scale)],
    unitVec3: () => {
      for (;;) {
        const v: Vec3 = [gaussian(), gaussian(), gaussian()];
        const len = Math.hypot(v[0], v[1], v[2]);
        if (len > 1e-6) return [v[0] / len, v[1] / len, v[2] / len];
      }
    },
    unitQuat: () => {
      for (;;) {
        const q: Quat = [gaussian(), gaussian(), gaussian(), gaussian()];
        const len = Math.hypot(q[0], q[1], q[2], q[3]);
        if (len > 1e-6) return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
      }
    },
  };
}

/** Largest absolute component-wise difference between two equal-length tuples. */
export function maxAbsDiff(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    worst = Math.max(worst, Math.abs((a[i] as number) - (b[i] as number)));
  }
  return worst;
}

/**
 * Quantile of the chi-squared distribution with `df` degrees of freedom at the standard normal
 * deviate `z`, by the Wilson-Hilferty approximation (accurate to about 1% for df >= 5).
 * `chiSquaredQuantile(df, 3.09)` is the 99.9th percentile, `chiSquaredQuantile(df, -3.09)` the
 * 0.1th.
 */
export function chiSquaredQuantile(df: number, z: number): number {
  const a = 2 / (9 * df);
  return df * (1 - a + z * Math.sqrt(a)) ** 3;
}

/** Pearson chi-squared statistic of observed counts against a uniform expectation. */
export function chiSquaredUniform(counts: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i] as number;
  const expected = total / counts.length;
  let x = 0;
  for (let i = 0; i < counts.length; i++) x += ((counts[i] as number) - expected) ** 2 / expected;
  return x;
}
