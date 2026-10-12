/**
 * WGSL source of the counter-based random number generator in `rng.ts`.
 *
 * Prepend this string to a shader module. All names start with `rng_`. The integer functions
 * (`rng_pcg`, `rng_begin`, `rng_key`, `rng_hash0` .. `rng_hash4`, `rng_int_below`) and
 * `rng_unit` give exactly the bits that `pcgHash`, `hashU32`, `randomIntBelow` and
 * `u32ToUnitFloat` give in TypeScript: u32 arithmetic wraps in WGSL, and `rng_unit` multiplies an
 * integer below 2^24 by a power of two, which is exact in f32. `rng_range` and `rng_normal` are
 * evaluated in f32 with WGSL's `log`, `cos` and `sqrt` and are only statistically equivalent to
 * their TypeScript counterparts.
 *
 * For more than four keys, fold them yourself:
 * `rng_key(rng_key(rng_begin(seed), k0), k1) ...` and take `.y` of the final state.
 */
export const RNG_WGSL: string = /* wgsl */ `
// ---- Spotless counter-based RNG (generated from @spotless/core rng.wgsl.ts; do not edit) ----

// PCG 32-bit hash (Jarzynski and Olano, JCGT 9(3), 2020). A bijection on u32.
fn rng_pcg(v: u32) -> u32 {
  let state = v * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

// Hash state after absorbing the seed: x and y are the two 32-bit lanes.
fn rng_begin(seed: u32) -> vec2<u32> {
  let a = rng_pcg(seed);
  return vec2<u32>(a, rng_pcg(a ^ 0x9E3779B9u));
}

// Absorbs one key into the state.
fn rng_key(s: vec2<u32>, key: u32) -> vec2<u32> {
  let a = rng_pcg(s.x + key);
  return vec2<u32>(a, rng_pcg(s.y ^ a));
}

// hashU32(seed, k0, ...) for zero to four keys.
fn rng_hash0(seed: u32) -> u32 {
  return rng_begin(seed).y;
}
fn rng_hash1(seed: u32, k0: u32) -> u32 {
  return rng_key(rng_begin(seed), k0).y;
}
fn rng_hash2(seed: u32, k0: u32, k1: u32) -> u32 {
  return rng_key(rng_key(rng_begin(seed), k0), k1).y;
}
fn rng_hash3(seed: u32, k0: u32, k1: u32, k2: u32) -> u32 {
  return rng_key(rng_key(rng_key(rng_begin(seed), k0), k1), k2).y;
}
fn rng_hash4(seed: u32, k0: u32, k1: u32, k2: u32, k3: u32) -> u32 {
  return rng_key(rng_key(rng_key(rng_key(rng_begin(seed), k0), k1), k2), k3).y;
}

// Uniform float in [0, 1) from the top 24 bits of u; exact in f32 (a multiple of 2^-24).
fn rng_unit(u: u32) -> f32 {
  return f32(u >> 8u) * 0x1p-24f;
}

// Uniform float in [lo, hi]; rounding in f32 can return hi itself.
fn rng_range(u: u32, lo: f32, hi: f32) -> f32 {
  return lo + (hi - lo) * rng_unit(u);
}

// Standard normal deviate by Box-Muller from two independent hashes. |result| <= 5.77.
fn rng_normal(u1: u32, u2: u32) -> f32 {
  let r = sqrt(-2.0 * log(1.0 - rng_unit(u1)));
  return r * cos(6.283185307179586 * rng_unit(u2));
}

// Uniform integer in [0, n) without modulo bias, for n >= 1. The state s must already hold the
// seed and keys; the attempt counter is absorbed as one more key (randomIntBelow in TypeScript).
fn rng_int_below(s: vec2<u32>, n: u32) -> u32 {
  let threshold = (0u - n) % n; // 2^32 mod n
  var u = 0u;
  for (var attempt = 0u; attempt < 32u; attempt++) {
    u = rng_key(s, attempt).y;
    if (u >= threshold) {
      break;
    }
  }
  return u % n;
}
// ---- end of Spotless counter-based RNG ----
`;
