/**
 * Counter-based random numbers.
 *
 * There is no generator state. A random value is a pure function of a 32-bit seed and a list of
 * 32-bit keys, `(seed, stream, index, ...)`, so results do not depend on evaluation order, thread
 * count or GPU dispatch order. The hash uses only 32-bit integer multiply, add, xor and shifts, so
 * the WGSL source in `RNG_WGSL` (see `rng.wgsl.ts`) produces the same bits as this file.
 *
 * What is bit-identical between TypeScript and WGSL: `hashU32`, `u32ToUnitFloat`,
 * `randomUniform` and `randomIntBelow`. What is only statistically equivalent: `randomRange` and
 * `randomNormal`, because WGSL evaluates them in f32 and its `log`, `cos` and `sqrt` are not
 * correctly rounded. Keep those two out of any path that must match across CPU and GPU.
 *
 * Construction. `pcgHash` is the 32-bit PCG output permutation used as a hash (Jarzynski and
 * Olano, "Hash Functions for GPU Rendering", JCGT 9(3), 2020). The state is two 32-bit words:
 *
 *     a = pcg(seed);  b = pcg(a ^ 0x9E3779B9)
 *     for each key k:  a = pcg(a + k);  b = pcg(b ^ a)
 *     result = b
 *
 * Two words rather than one matter for the wash simulation: with a single 32-bit state, of the
 * ~1.6e7 streams keyed by (nozzle, phase, ray) about 3e4 pairs would be identical end to end
 * (birthday bound), whereas a 64-bit state makes that vanishingly unlikely. For a fixed seed and
 * key prefix the map from the last key to the result is a bijection on u32.
 */

const PCG_MULTIPLIER = 747796405;
const PCG_INCREMENT = 2891336453;
const PCG_OUTPUT_MULTIPLIER = 277803737;
const LANE_CONSTANT = 0x9e3779b9;

/** 2^-24: the spacing of the floats produced by {@link u32ToUnitFloat}. */
const TWO_POW_MINUS_24 = 1 / 16777216;

/**
 * Number of rejection attempts made by {@link randomIntBelow} (the WGSL loop has the same bound).
 */
export const RNG_INT_BELOW_MAX_ATTEMPTS = 32;

/**
 * The PCG 32-bit hash: a bijection on u32. The argument is reduced modulo 2^32 (`v >>> 0`); the
 * result is an integer in [0, 2^32).
 */
export function pcgHash(v: number): number {
  const state = (Math.imul(v, PCG_MULTIPLIER) + PCG_INCREMENT) >>> 0;
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, PCG_OUTPUT_MULTIPLIER);
  return ((word >>> 22) ^ word) >>> 0;
}

/**
 * Hashes a seed and any number of keys to a u32 (an integer in [0, 2^32)). Seed and keys are
 * reduced modulo 2^32 with `>>> 0`, so pass non-negative integers below 2^32. The order of the
 * keys matters. This is the function mirrored in WGSL as `rng_hash0` .. `rng_hash4` (and
 * `rng_begin` / `rng_key` for longer key lists).
 */
export function hashU32(seed: number, ...keys: readonly number[]): number {
  let a = pcgHash(seed);
  let b = pcgHash(a ^ LANE_CONSTANT);
  for (let i = 0; i < keys.length; i++) {
    a = pcgHash(a + ((keys[i] as number) >>> 0));
    b = pcgHash(b ^ a);
  }
  return b;
}

/**
 * Maps a u32 to a float in [0, 1) using its top 24 bits: `(u >>> 8) * 2^-24`. Every result is a
 * multiple of 2^-24 and is therefore exactly representable in f32 as well as f64; the largest is
 * `1 - 2^-24`.
 */
export function u32ToUnitFloat(u: number): number {
  return (u >>> 8) * TWO_POW_MINUS_24;
}

/**
 * Uniform random float in [0, 1) for the given seed and keys, exactly representable in f32
 * (see {@link u32ToUnitFloat}). Bit-identical to WGSL `rng_unit(rng_hashN(...))`.
 */
export function randomUniform(seed: number, ...keys: readonly number[]): number {
  return u32ToUnitFloat(hashU32(seed, ...keys));
}

/**
 * Uniform random float in [lo, hi): `lo + (hi - lo) * u` with `u` from {@link randomUniform}.
 * Units are those of `lo` and `hi`. In double precision the result stays below `hi` unless the
 * range is narrower than about 2^-28 of its magnitude; the WGSL f32 counterpart can round up to
 * `hi` itself and its result is not bit-identical to this one.
 */
export function randomRange(
  lo: number,
  hi: number,
  seed: number,
  ...keys: readonly number[]
): number {
  return lo + (hi - lo) * u32ToUnitFloat(hashU32(seed, ...keys));
}

/**
 * Standard normal deviate (mean 0, variance 1) by the Box-Muller transform:
 * `sqrt(-2 ln u1) * cos(2 pi u2)` with `u1 = 1 - unit(hash(seed, ...keys, 0))` in (0, 1] and
 * `u2 = unit(hash(seed, ...keys, 1))` in [0, 1). Because `u1 >= 2^-24` the magnitude never exceeds
 * `sqrt(48 ln 2)` = 5.77. Not bit-identical to the WGSL `rng_normal` (transcendentals differ).
 */
export function randomNormal(seed: number, ...keys: readonly number[]): number {
  const u1 = 1 - u32ToUnitFloat(hashU32(seed, ...keys, 0));
  const u2 = u32ToUnitFloat(hashU32(seed, ...keys, 1));
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Uniform random integer in [0, n) without modulo bias, for an integer `n` in [1, 2^32 - 1].
 * Rejection sampling: draw `u = hash(seed, ...keys, attempt)` for attempt = 0, 1, ... and accept
 * the first `u >= 2^32 mod n`, returning `u % n`. Each attempt is accepted with probability above
 * one half; after {@link RNG_INT_BELOW_MAX_ATTEMPTS} rejections (probability below 2^-32) the last
 * draw is used. Integer-only, so bit-identical to WGSL `rng_int_below`. Throws a RangeError when
 * `n` is not an integer in range (a programmer error).
 */
export function randomIntBelow(n: number, seed: number, ...keys: readonly number[]): number {
  if (!Number.isInteger(n) || n < 1 || n > 0xffffffff) {
    throw new RangeError(`randomIntBelow: n must be an integer in [1, 2^32 - 1], got ${n}`);
  }
  // (2^32 - n) % n == 2^32 % n, computed in u32 exactly as WGSL does with (0u - n) % n.
  const threshold = (-n >>> 0) % n;
  let u = 0;
  for (let attempt = 0; attempt < RNG_INT_BELOW_MAX_ATTEMPTS; attempt++) {
    u = hashU32(seed, ...keys, attempt);
    if (u >= threshold) break;
  }
  return u % n;
}
