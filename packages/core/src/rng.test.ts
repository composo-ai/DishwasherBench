import { describe, expect, it } from 'vitest';
import {
  RNG_INT_BELOW_MAX_ATTEMPTS,
  hashU32,
  pcgHash,
  randomIntBelow,
  randomNormal,
  randomRange,
  randomUniform,
  u32ToUnitFloat,
} from './rng.ts';
import { RNG_WGSL } from './rng.wgsl.ts';
import { chiSquaredQuantile, chiSquaredUniform, testRandom } from './test-util.ts';

// Statistical tests below are deterministic (fixed seeds), so they cannot flake. Their bounds
// are stated as z-scores of the sampling distribution: |z| <= 4 unless said otherwise, which a
// correct generator violates with probability below 1e-4 per test.
const Z = 4;

/**
 * Independent reference: the same algorithm written from its prose specification with BigInt
 * arithmetic reduced modulo 2^32 (no Math.imul, no signed 32-bit intermediate values).
 */
const M32 = 0xffffffffn;
function pcgRef(v: bigint): bigint {
  const state = (v * 747796405n + 2891336453n) & M32;
  const word = (((state >> ((state >> 28n) + 4n)) ^ state) * 277803737n) & M32;
  return ((word >> 22n) ^ word) & M32;
}
function hashRef(seed: number, keys: readonly number[]): number {
  let a = pcgRef(BigInt(seed));
  let b = pcgRef(a ^ 0x9e3779b9n);
  for (const k of keys) {
    a = pcgRef((a + BigInt(k)) & M32);
    b = pcgRef(b ^ a);
  }
  return Number(b);
}

describe('known answers (computed with a C uint32_t implementation, clang 16, arm64)', () => {
  it('pcgHash', () => {
    expect(pcgHash(0x00000000)).toBe(0x07bb2fe2);
    expect(pcgHash(0x00000001)).toBe(0xa8beea3c);
    expect(pcgHash(0x00000002)).toBe(0x7a7ecc88);
    expect(pcgHash(0x12345678)).toBe(0x995312e1);
    expect(pcgHash(0x80000000)).toBe(0x21c72646);
    expect(pcgHash(0xffffffff)).toBe(0xe62a4902);
  });

  it('hashU32 with zero to eight keys', () => {
    expect(hashU32(0)).toBe(0x7ef300cc);
    expect(hashU32(1)).toBe(0x49046676);
    expect(hashU32(0xffffffff)).toBe(0x72bde81f);
    expect(hashU32(0, 0)).toBe(0x144910d0);
    expect(hashU32(0, 1)).toBe(0x8a5e82a7);
    expect(hashU32(1, 0)).toBe(0x5168d814);
    expect(hashU32(42, 1, 2, 3)).toBe(0x3e89685e);
    expect(hashU32(42, 3, 2, 1)).toBe(0x97974759);
    expect(hashU32(0xdeadbeef, 0xffffffff, 0, 0x80000000, 7)).toBe(0x9641324d);
    expect(hashU32(2026, 0, 1, 2, 3, 4, 5, 6, 7)).toBe(0x14f762aa);
  });

  it('xor and sum of the first million values of stream (seed 7, key 3)', () => {
    let x = 0;
    let s = 0;
    for (let i = 0; i < 1_000_000; i++) {
      const h = hashU32(7, 3, i);
      x ^= h;
      s = (s + h) >>> 0;
    }
    expect(x >>> 0).toBe(0x9957bcd5);
    expect(s).toBe(0xc8bd0c4d);
  });

  it('u32ToUnitFloat(hash(42; 1, 2, 3)) is 0x1.f44b4p-3 exactly', () => {
    // 0x3E89685E >>> 8 = 0x3E8968; times 2^-24.
    expect(randomUniform(42, 1, 2, 3)).toBe(0x3e8968 / 2 ** 24);
    expect(randomUniform(42, 1, 2, 3)).toBeCloseTo(0.244284153, 9);
  });

  it('randomIntBelow, including a bound that forces rejections', () => {
    expect(randomIntBelow(10, 1, 5)).toBe(5);
    expect(randomIntBelow(3221225472, 1, 5)).toBe(605964053);
    expect(randomIntBelow(3221225472, 1, 6)).toBe(750426112);
    expect(randomIntBelow(1, 0, 9, 9)).toBe(0);
    let digest = 0;
    for (let i = 0; i < 100_000; i++) {
      digest = (Math.imul(digest, 31) + randomIntBelow(3221225473, 99, i)) >>> 0;
    }
    expect(digest).toBe(0x8fc20005);
  });
});

describe('hashU32 structure', () => {
  it('matches a BigInt implementation on 5000 random seeds and key lists', () => {
    const rnd = testRandom(101);
    let mismatches = 0;
    for (let i = 0; i < 5000; i++) {
      const seed = rnd.u32();
      const keys: number[] = [];
      const n = rnd.u32() % 7;
      for (let k = 0; k < n; k++) keys.push(rnd.u32() % 3 === 0 ? rnd.u32() % 16 : rnd.u32());
      if (hashU32(seed, ...keys) !== hashRef(seed, keys)) mismatches++;
      if (pcgHash(seed) !== Number(pcgRef(BigInt(seed)))) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('returns integers in [0, 2^32)', () => {
    const rnd = testRandom(102);
    let outside = 0;
    for (let i = 0; i < 100_000; i++) {
      const h = hashU32(rnd.u32(), rnd.u32(), i);
      if (!(Number.isInteger(h) && h >= 0 && h < 2 ** 32)) outside++;
    }
    expect(outside).toBe(0);
  });

  it('reduces seed and keys modulo 2^32', () => {
    expect(hashU32(2 ** 32 + 5, 1)).toBe(hashU32(5, 1));
    expect(hashU32(5, 2 ** 32 + 1)).toBe(hashU32(5, 1));
    expect(hashU32(-1)).toBe(hashU32(0xffffffff));
    expect(hashU32(3, -1)).toBe(hashU32(3, 0xffffffff));
  });

  it('depends on key order and on the number of keys', () => {
    expect(hashU32(42, 1, 2)).not.toBe(hashU32(42, 2, 1));
    expect(hashU32(42)).not.toBe(hashU32(42, 0));
    expect(hashU32(42, 0)).not.toBe(hashU32(42, 0, 0));
    expect(hashU32(1, 2)).not.toBe(hashU32(2, 1));
  });

  it('is a bijection in the last key: 2^20 consecutive keys give 2^20 distinct values', () => {
    // A random function would give about n^2 / 2^33 = 128 repeated values here.
    const n = 1 << 20;
    const values = new Uint32Array(n);
    for (let i = 0; i < n; i++) values[i] = hashU32(9, 4, i);
    values.sort();
    let repeats = 0;
    for (let i = 1; i < n; i++) if (values[i] === values[i - 1]) repeats++;
    expect(repeats).toBe(0);
  });

  it('distinct key tuples collide at the birthday rate of a 32-bit hash, no more', () => {
    // 2^21 tuples (nozzle, phase, ray): expected repeats n^2 / 2^33 = 512, standard deviation
    // sqrt(512) = 22.6. A one-word (32-bit) internal state would not change this count, but a
    // weak mix would raise it; a constant or truncated hash would raise it enormously.
    const n = 1 << 21;
    const values = new Uint32Array(n);
    let idx = 0;
    for (let nozzle = 0; nozzle < 32; nozzle++) {
      for (let phase = 0; phase < 1024; phase++) {
        for (let ray = 0; ray < 64; ray++) values[idx++] = hashU32(123, nozzle, phase, ray);
      }
    }
    values.sort();
    let repeats = 0;
    for (let i = 1; i < n; i++) if (values[i] === values[i - 1]) repeats++;
    expect(Math.abs(repeats - 512)).toBeLessThanOrEqual(Z * Math.sqrt(512));
  });

  it('avalanche: flipping any input bit flips each output bit with probability 1/2', () => {
    // 3 words in (seed and two keys), 96 input bits x 32 output bits, N samples per cell.
    // Each cell's flip rate has standard deviation 0.5 / sqrt(N); the maximum over the 3072
    // cells stays below 5 standard deviations for an ideal hash (the single-round PCG hash
    // alone fails this bound by a wide margin: 0.08 against 0.018).
    const N = 20_000;
    const rnd = testRandom(103);
    const flips = new Int32Array(96 * 32);
    for (let n = 0; n < N; n++) {
      const input = [rnd.u32(), rnd.u32() & 0xff, n];
      const base = hashU32(input[0] as number, input[1] as number, input[2] as number);
      for (let bit = 0; bit < 96; bit++) {
        const m = [...input];
        m[bit >> 5] = ((m[bit >> 5] as number) ^ (1 << (bit & 31))) >>> 0;
        const d = base ^ hashU32(m[0] as number, m[1] as number, m[2] as number);
        for (let o = 0; o < 32; o++) if ((d >>> o) & 1) flips[bit * 32 + o]!++;
      }
    }
    let worst = 0;
    for (const count of flips) worst = Math.max(worst, Math.abs(count / N - 0.5));
    expect(worst).toBeLessThanOrEqual((5 * 0.5) / Math.sqrt(N));
  });
});

describe('uniformity', () => {
  it('each byte of hashU32 is uniform over a counter stream (chi-squared, 255 df)', () => {
    const n = 1 << 20;
    for (const [seed, stream] of [
      [0, 0],
      [1, 7],
      [0xffffffff, 0xffffffff],
    ] as const) {
      const counts = [0, 1, 2, 3].map(() => new Float64Array(256));
      for (let i = 0; i < n; i++) {
        const h = hashU32(seed, stream, i);
        for (let b = 0; b < 4; b++) (counts[b] as Float64Array)[(h >>> (8 * b)) & 255]!++;
      }
      for (const c of counts) {
        const x = chiSquaredUniform(c);
        expect(x).toBeGreaterThan(chiSquaredQuantile(255, -Z));
        expect(x).toBeLessThan(chiSquaredQuantile(255, Z));
      }
    }
  });

  it('randomUniform fills 1024 equal bins evenly (chi-squared, 1023 df) with mean 1/2', () => {
    const n = 1 << 21;
    const counts = new Float64Array(1024);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const u = randomUniform(2026, i & 4095, i >>> 12);
      counts[Math.floor(u * 1024)]!++;
      sum += u;
    }
    const x = chiSquaredUniform(counts);
    expect(x).toBeGreaterThan(chiSquaredQuantile(1023, -Z));
    expect(x).toBeLessThan(chiSquaredQuantile(1023, Z));
    // Mean of U(0,1) is 1/2 with standard error sqrt(1 / (12 n)).
    expect(Math.abs(sum / n - 0.5)).toBeLessThanOrEqual(Z * Math.sqrt(1 / (12 * n)));
  });

  it('consecutive counters are serially uncorrelated (pairs in a 64 x 64 grid, lag-1 r)', () => {
    const n = 1 << 21;
    const counts = new Float64Array(64 * 64);
    let prev = randomUniform(5, 0);
    let sxy = 0;
    for (let i = 1; i <= n; i++) {
      const u = randomUniform(5, i);
      counts[Math.floor(prev * 64) * 64 + Math.floor(u * 64)]!++;
      sxy += (prev - 0.5) * (u - 0.5);
      prev = u;
    }
    const x = chiSquaredUniform(counts);
    expect(x).toBeGreaterThan(chiSquaredQuantile(4095, -Z));
    expect(x).toBeLessThan(chiSquaredQuantile(4095, Z));
    // Correlation coefficient of independent uniforms: mean 0, standard error 1 / sqrt(n).
    expect(Math.abs(sxy / n / (1 / 12))).toBeLessThanOrEqual(Z / Math.sqrt(n));
  });
});

describe('independence of streams', () => {
  /** Joint chi-squared (64 x 64 grid) and correlation of two streams sampled at equal index. */
  function jointStats(a: (i: number) => number, b: (i: number) => number, n: number) {
    const counts = new Float64Array(64 * 64);
    let sxy = 0;
    for (let i = 0; i < n; i++) {
      const u = a(i);
      const v = b(i);
      counts[Math.floor(u * 64) * 64 + Math.floor(v * 64)]!++;
      sxy += (u - 0.5) * (v - 0.5);
    }
    return { chi2: chiSquaredUniform(counts), r: sxy / n / (1 / 12) };
  }

  const n = 1 << 21;
  const cases: [string, (i: number) => number, (i: number) => number][] = [
    ['adjacent stream keys', (i) => randomUniform(1, 5, i), (i) => randomUniform(1, 6, i)],
    ['adjacent seeds', (i) => randomUniform(1, 5, i), (i) => randomUniform(2, 5, i)],
    ['swapped key order', (i) => randomUniform(1, 5, i), (i) => randomUniform(1, i, 5)],
    ['extra trailing key', (i) => randomUniform(1, i), (i) => randomUniform(1, i, 0)],
    ['stream shifted by one', (i) => randomUniform(3, 8, i), (i) => randomUniform(3, 9, i + 1)],
  ];
  for (const [name, a, b] of cases) {
    it(`${name}: joint distribution is uniform (4095 df) and correlation is zero`, () => {
      const { chi2, r } = jointStats(a, b, n);
      expect(chi2).toBeGreaterThan(chiSquaredQuantile(4095, -Z));
      expect(chi2).toBeLessThan(chiSquaredQuantile(4095, Z));
      expect(Math.abs(r)).toBeLessThanOrEqual(Z / Math.sqrt(n));
    });
  }

  it('low bits of neighbouring streams are jointly uniform (64 x 64 grid of 6-bit values)', () => {
    const counts = new Float64Array(64 * 64);
    for (let i = 0; i < n; i++) {
      counts[(hashU32(1, 5, i) & 63) * 64 + (hashU32(1, 6, i) & 63)]!++;
    }
    const x = chiSquaredUniform(counts);
    expect(x).toBeGreaterThan(chiSquaredQuantile(4095, -Z));
    expect(x).toBeLessThan(chiSquaredQuantile(4095, Z));
  });

  it('streams are not shifted copies of one another', () => {
    // With a one-word state, stream B would equal stream A at a fixed index offset. Here the
    // first 4096 values of two streams share no value at all (expected shared values for
    // independent streams: 4096^2 / 2^32 = 0.004).
    const a = new Set<number>();
    for (let i = 0; i < 4096; i++) a.add(hashU32(77, 1, i));
    let shared = 0;
    for (let i = 0; i < 4096; i++) if (a.has(hashU32(77, 2, i))) shared++;
    expect(shared).toBe(0);
  });
});

describe('float outputs are exact in f32', () => {
  it('every randomUniform value is a multiple of 2^-24 in [0, 1) and survives Math.fround', () => {
    const rnd = testRandom(104);
    let violations = 0;
    for (let i = 0; i < 1_000_000; i++) {
      const u = randomUniform(rnd.u32(), i);
      if (Math.fround(u) !== u) violations++;
      if (!Number.isInteger(u * 16777216)) violations++;
      if (!(u >= 0 && u < 1)) violations++;
    }
    expect(violations).toBe(0);
  });

  it('u32ToUnitFloat maps the extremes to 0 and 1 - 2^-24, both exact in f32', () => {
    expect(u32ToUnitFloat(0)).toBe(0);
    expect(u32ToUnitFloat(0xff)).toBe(0);
    expect(u32ToUnitFloat(0x100)).toBe(2 ** -24);
    expect(u32ToUnitFloat(0xffffffff)).toBe(1 - 2 ** -24);
    expect(Math.fround(1 - 2 ** -24)).toBe(1 - 2 ** -24);
    expect(Math.fround(u32ToUnitFloat(0xffffffff))).toBeLessThan(1);
    expect(u32ToUnitFloat(0x80000000)).toBe(0.5);
  });

  it('1 - u, the Box-Muller argument, is also exact in f32 and never zero', () => {
    for (const u32 of [0, 0x100, 0x7fffff00, 0x80000000, 0xffffff00, 0xffffffff]) {
      const v = 1 - u32ToUnitFloat(u32);
      expect(Math.fround(v)).toBe(v);
      expect(v).toBeGreaterThan(0);
    }
  });
});

describe('derived distributions', () => {
  it('randomRange stays in [lo, hi) with the mean and variance of a uniform', () => {
    const [lo, hi, n] = [-2, 5, 1 << 20];
    let sum = 0;
    let sumSq = 0;
    let outside = 0;
    for (let i = 0; i < n; i++) {
      const x = randomRange(lo, hi, 11, i);
      if (!(x >= lo && x < hi)) outside++;
      sum += x;
      sumSq += x * x;
    }
    expect(outside).toBe(0);
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    const sigma2 = (hi - lo) ** 2 / 12;
    expect(Math.abs(mean - 1.5)).toBeLessThanOrEqual(Z * Math.sqrt(sigma2 / n));
    // Variance of the sample variance of a uniform: (4/5) sigma^4 / n.
    expect(Math.abs(variance - sigma2)).toBeLessThanOrEqual(Z * sigma2 * Math.sqrt(0.8 / n));
    expect(randomRange(3, 3, 1, 2)).toBe(3);
  });

  it('randomNormal has mean 0, variance 1, kurtosis 3 and the normal coverage of 1 and 2 sigma', () => {
    const n = 1 << 21;
    let s1 = 0;
    let s2 = 0;
    let s4 = 0;
    let within1 = 0;
    let within2 = 0;
    let largest = 0;
    for (let i = 0; i < n; i++) {
      const z = randomNormal(31, i);
      s1 += z;
      s2 += z * z;
      s4 += z * z * z * z;
      if (Math.abs(z) < 1) within1++;
      if (Math.abs(z) < 2) within2++;
      largest = Math.max(largest, Math.abs(z));
    }
    const mean = s1 / n;
    const variance = s2 / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThanOrEqual(Z / Math.sqrt(n));
    expect(Math.abs(variance - 1)).toBeLessThanOrEqual(Z * Math.sqrt(2 / n));
    // Sample fourth moment of N(0,1): mean 3, variance 96 / n.
    expect(Math.abs(s4 / n - 3)).toBeLessThanOrEqual(Z * Math.sqrt(96 / n));
    // P(|z| < 1) = erf(1 / sqrt 2) = 0.682689492, P(|z| < 2) = 0.954499736.
    const p1 = 0.682689492;
    const p2 = 0.954499736;
    expect(Math.abs(within1 / n - p1)).toBeLessThanOrEqual(Z * Math.sqrt((p1 * (1 - p1)) / n));
    expect(Math.abs(within2 / n - p2)).toBeLessThanOrEqual(Z * Math.sqrt((p2 * (1 - p2)) / n));
    // The tail is truncated at sqrt(48 ln 2) = 5.768 because u1 >= 2^-24.
    expect(largest).toBeLessThanOrEqual(Math.sqrt(48 * Math.LN2));
    expect(Number.isFinite(largest)).toBe(true);
  });

  it('randomNormal draws for different keys are uncorrelated', () => {
    const n = 1 << 20;
    let sxy = 0;
    for (let i = 0; i < n; i++) sxy += randomNormal(31, 1, i) * randomNormal(31, 2, i);
    expect(Math.abs(sxy / n)).toBeLessThanOrEqual(Z / Math.sqrt(n));
  });

  it('randomIntBelow(6) is a fair die (chi-squared, 5 df) and stays in range', () => {
    const n = 600_000;
    const counts = new Float64Array(6);
    let outside = 0;
    for (let i = 0; i < n; i++) {
      const k = randomIntBelow(6, 17, i);
      if (!(Number.isInteger(k) && k >= 0 && k < 6)) outside++;
      else counts[k]!++;
    }
    expect(outside).toBe(0);
    // 99.99th percentile of chi-squared with 5 degrees of freedom is 25.74.
    expect(chiSquaredUniform(counts)).toBeLessThan(25.74);
  });

  it('randomIntBelow has no modulo bias where plain `u % n` is badly biased', () => {
    // n = 3 * 2^30. Plain u % n makes results below 2^30 twice as likely: P = 1/2 instead of 1/3.
    const n = 3 * 2 ** 30;
    const samples = 300_000;
    let low = 0;
    let biasedLow = 0;
    for (let i = 0; i < samples; i++) {
      if (randomIntBelow(n, 23, i) < 2 ** 30) low++;
      if (hashU32(23, i, 0) % n < 2 ** 30) biasedLow++;
    }
    const p = 1 / 3;
    expect(Math.abs(low / samples - p)).toBeLessThanOrEqual(Z * Math.sqrt((p * (1 - p)) / samples));
    // The control shows the test can tell the difference.
    expect(Math.abs(biasedLow / samples - 0.5)).toBeLessThanOrEqual(0.01);
  });

  it('randomIntBelow(1) is always 0 and bad bounds throw', () => {
    for (let i = 0; i < 100; i++) expect(randomIntBelow(1, 3, i)).toBe(0);
    expect(randomIntBelow(0xffffffff, 1, 2)).toBeLessThan(0xffffffff);
    for (const bad of [0, -1, 1.5, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => randomIntBelow(bad, 1)).toThrow(RangeError);
    }
  });
});

describe('WGSL source', () => {
  it('carries the same constants as the TypeScript implementation', () => {
    // The bit-for-bit comparison on a GPU lives in packages/sim-gpu (rng-parity.test.ts); this
    // guards the constants in environments without a GPU.
    expect(RNG_WGSL).toContain('v * 747796405u + 2891336453u');
    expect(RNG_WGSL).toContain('((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u');
    expect(RNG_WGSL).toContain('(word >> 22u) ^ word');
    expect(RNG_WGSL).toContain('rng_pcg(a ^ 0x9E3779B9u)');
    expect(RNG_WGSL).toContain('f32(u >> 8u) * 0x1p-24f');
    expect(RNG_WGSL).toContain(`attempt < ${RNG_INT_BELOW_MAX_ATTEMPTS}u`);
    expect(0x9e3779b9).toBe(2654435769);
  });

  it('declares every function the documentation promises, each exactly once', () => {
    for (const name of [
      'rng_pcg',
      'rng_begin',
      'rng_key',
      'rng_hash0',
      'rng_hash1',
      'rng_hash2',
      'rng_hash3',
      'rng_hash4',
      'rng_unit',
      'rng_range',
      'rng_normal',
      'rng_int_below',
    ]) {
      expect(RNG_WGSL.split(`fn ${name}(`).length - 1).toBe(1);
    }
  });
});
