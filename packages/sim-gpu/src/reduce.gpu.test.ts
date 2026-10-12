// The integer block reduction of module M1 (docs/design/sim-core.md section M1, "Integer block
// reduction"; determinism rule 5) against sums computed on the CPU with BigInt: exact, on
// inputs chosen to break a wrong carry, a wrong sign extension or a wrong segment boundary.
import { hashU32 } from '@spotless/core';
import { afterAll, describe, expect, it } from 'vitest';
import { tryCreateNodeGpuContext } from './node/device.ts';
import { reduceSpecOf } from './reduce.ts';
import {
  MAX_REDUCE_FIELDS,
  REDUCTION_FAN_IN,
  type GpuContext,
  type ManagedBuffer,
  type ReduceSpec,
} from './types.ts';
import type { RecordLayout } from './layout.ts';
import { BUFFER_USAGE } from './usage.ts';

const ctx = await tryCreateNodeGpuContext();
afterAll(() => ctx?.destroy());

let serial = 0;
function upload(gpu: GpuContext, words: Uint32Array | Int32Array): ManagedBuffer {
  const b = gpu.buffer({
    name: `reduce-test-${serial++}`,
    owner: 'test',
    stage: 'A',
    bytes: Math.max(4, words.byteLength),
    usage: BUFFER_USAGE.STORAGE,
    fields: [{ name: 'word', type: 'u32', role: 'statistic', unit: '-' }],
  });
  if (words.byteLength > 0) gpu.write(b, words);
  return b;
}

/** CPU sums: `[segment][field]` with BigInt, sign-extending i32 fields. */
function cpuSums(words: Uint32Array, spec: ReduceSpec, offsets: ArrayLike<number>): bigint[] {
  const stride = spec.strideBytes / 4;
  const out: bigint[] = [];
  for (let s = 0; s + 1 < offsets.length; s++) {
    for (const field of spec.fields) {
      let sum = 0n;
      for (let i = offsets[s] as number; i < (offsets[s + 1] as number); i++) {
        const w = words[i * stride + field.offsetBytes / 4] as number;
        sum += BigInt(field.type === 'i32' ? w | 0 : w);
      }
      out.push(sum);
    }
  }
  return out;
}

const ONE_U32: ReduceSpec = { strideBytes: 4, fields: [{ offsetBytes: 0, type: 'u32' }] };
const ONE_I32: ReduceSpec = { strideBytes: 4, fields: [{ offsetBytes: 0, type: 'i32' }] };

describe.skipIf(ctx === null)('reduceI64: whole-buffer sums', () => {
  const gpu = ctx as GpuContext;

  it('sums all-ones words: n * (2^32 - 1), which needs the carry into the high word', async () => {
    // Lengths around the fan-in and its square, where a level boundary falls.
    for (const n of [1, 2, 63, 64, 65, 4095, 4096, 4097, 100000]) {
      const b = upload(gpu, new Uint32Array(n).fill(0xffffffff));
      const [sum] = await gpu.reduceI64(b, ONE_U32);
      expect(sum, `n = ${n}`).toBe(BigInt(n) * 0xffffffffn);
      // The same bits read as i32 are -1 each.
      const [signed] = await gpu.reduceI64(b, ONE_I32);
      expect(signed, `n = ${n} signed`).toBe(BigInt(-n));
      gpu.release(b);
    }
    expect(REDUCTION_FAN_IN).toBe(64);
  });

  it('sums negative and mixed i32 values, including the extremes', async () => {
    const n = 70000;
    const values = new Int32Array(n);
    for (let i = 0; i < n; i++) values[i] = hashU32(3, i) | 0;
    values[0] = -(2 ** 31);
    values[1] = 2 ** 31 - 1;
    values.fill(-(2 ** 31), 100, 300); // a run whose sum is -200 * 2^31
    const b = upload(gpu, values);
    let expected = 0n;
    for (const v of values) expected += BigInt(v);
    expect((await gpu.reduceI64(b, ONE_I32))[0]).toBe(expected);
    // Read as u32 the same words sum to a different, larger number.
    let unsigned = 0n;
    for (const v of new Uint32Array(values.buffer)) unsigned += BigInt(v);
    expect((await gpu.reduceI64(b, ONE_U32))[0]).toBe(unsigned);
    gpu.release(b);
  });

  it('sums several fields of a strided record at once and leaves the other words alone', async () => {
    // 20-byte elements: word 0 u32, word 1 f32 (ignored), word 2 i32, word 3 ignored, word 4 u32.
    const n = 12345;
    const words = new Uint32Array(5 * n);
    for (let i = 0; i < words.length; i++) words[i] = hashU32(11, i);
    const spec: ReduceSpec = {
      strideBytes: 20,
      fields: [
        { offsetBytes: 16, type: 'u32' },
        { offsetBytes: 8, type: 'i32' },
        { offsetBytes: 0, type: 'u32' },
      ],
    };
    const b = upload(gpu, words);
    expect([...(await gpu.reduceI64(b, spec))]).toEqual(cpuSums(words, spec, [0, n]));
    // `count` restricts the sum to the first elements.
    const part = { ...spec, count: 1000 };
    expect([...(await gpu.reduceI64(b, part))]).toEqual(cpuSums(words, spec, [0, 1000]));
    expect([...(await gpu.reduceI64(b, { ...spec, count: 0 }))]).toEqual([0n, 0n, 0n]);
    gpu.release(b);
  });

  it('sums the maximum number of fields, and derives a specification from a layout', async () => {
    const n = 300;
    const words = new Uint32Array(MAX_REDUCE_FIELDS * n);
    for (let i = 0; i < words.length; i++) words[i] = hashU32(5, i);
    const layout: RecordLayout = {
      name: 'Sixteen',
      section: 'test',
      owner: 'M1',
      per: 'element',
      byteSize: 4 * MAX_REDUCE_FIELDS,
      fields: [
        {
          name: 'mass',
          type: 'u32',
          offset: 0,
          count: 12,
          role: 'statistic',
          unit: 'kg',
          doc: 'x',
        },
        { name: 'heat', type: 'i32', offset: 48, count: 3, role: 'statistic', unit: 'J', doc: 'x' },
        { name: 'h', type: 'f32', offset: 60, role: 'state', unit: 'm', doc: 'x' },
      ],
    };
    const spec = reduceSpecOf(layout, ['heat', 'mass']);
    expect(spec.fields).toHaveLength(15);
    expect(spec.fields[0]).toEqual({ offsetBytes: 48, type: 'i32' });
    expect(spec.fields[3]).toEqual({ offsetBytes: 0, type: 'u32' });
    expect(() => reduceSpecOf(layout, ['h'])).toThrow(/only u32 and i32/);
    const full: ReduceSpec = {
      strideBytes: 4 * MAX_REDUCE_FIELDS,
      fields: Array.from({ length: MAX_REDUCE_FIELDS }, (_, f) => ({
        offsetBytes: 4 * f,
        type: f % 2 === 0 ? ('u32' as const) : ('i32' as const),
      })),
    };
    const b = upload(gpu, words);
    expect([...(await gpu.reduceI64(b, full))]).toEqual(cpuSums(words, full, [0, n]));
    expect([...(await gpu.reduceI64(b, spec))]).toEqual(cpuSums(words, spec, [0, n]));
    gpu.release(b);
  });

  it('refuses a stride, an offset or a count that does not fit', async () => {
    const b = upload(gpu, new Uint32Array(64));
    const bad = (spec: ReduceSpec): Promise<unknown> => gpu.reduceI64(b, spec);
    await expect(bad({ strideBytes: 6, fields: ONE_U32.fields })).rejects.toThrow(/stride 6/);
    await expect(
      bad({ strideBytes: 8, fields: [{ offsetBytes: 8, type: 'u32' }] }),
    ).rejects.toThrow(/offset 8/);
    await expect(bad({ ...ONE_U32, count: 65 })).rejects.toThrow(/do not fit/);
    await expect(bad({ strideBytes: 4, fields: [] })).rejects.toThrow(/0 fields/);
    gpu.release(b);
  });
});

describe.skipIf(ctx === null)('reduceI64By: sums per segment', () => {
  const gpu = ctx as GpuContext;

  it('handles empty and single-element segments and boundaries at multiples of the fan-in', async () => {
    const lengths = [
      0, 1, 0, 0, 63, 64, 65, 1, 128, 0, 4096, 4097, 1, 1, 0, 64, 64, 4095, 127, 129, 262144, 5, 0,
    ];
    const offsets = new Uint32Array(lengths.length + 1);
    lengths.forEach((n, s) => (offsets[s + 1] = (offsets[s] as number) + n));
    const n = offsets[lengths.length] as number;
    const values = new Uint32Array(n);
    for (let i = 0; i < n; i++) values[i] = hashU32(21, i);
    // Segment 10 (4,096 elements) is all ones: its sum needs the high word.
    values.fill(0xffffffff, offsets[10] as number, offsets[11] as number);
    const b = upload(gpu, values);
    for (const spec of [ONE_U32, ONE_I32]) {
      const sums = await gpu.reduceI64By(b, spec, offsets, lengths.length);
      expect(sums).toHaveLength(lengths.length);
      expect([...sums], spec.fields[0]?.type).toEqual(cpuSums(values, spec, offsets));
    }
    const sums = await gpu.reduceI64By(b, ONE_U32, offsets);
    // Empty segments are zero, wherever they lie.
    expect([sums[0], sums[2], sums[3], sums[9], sums[14], sums[22]]).toEqual([
      0n,
      0n,
      0n,
      0n,
      0n,
      0n,
    ]);
    expect(sums[10]).toBe(4096n * 0xffffffffn);
    // The segmented sums add up to the whole-buffer sum.
    const whole = (await gpu.reduceI64(b, ONE_U32))[0];
    expect([...sums].reduce((a, v) => a + v, 0n)).toBe(whole);
    gpu.release(b);
  });

  it('returns [segment][field] for several fields, with segments that skip leading and trailing elements', async () => {
    const stride = 3;
    const n = 9000;
    const words = new Uint32Array(stride * n);
    for (let i = 0; i < words.length; i++) words[i] = hashU32(8, i);
    const spec: ReduceSpec = {
      strideBytes: 12,
      fields: [
        { offsetBytes: 8, type: 'i32' },
        { offsetBytes: 0, type: 'u32' },
      ],
    };
    // Elements before 10 and after 8000 belong to no segment.
    const offsets = Uint32Array.of(10, 10, 74, 5000, 5001, 8000);
    const b = upload(gpu, words);
    const sums = await gpu.reduceI64By(b, spec, offsets);
    expect(sums).toHaveLength(5 * 2);
    expect([...sums]).toEqual(cpuSums(words, spec, offsets));
    gpu.release(b);
  });

  it('agrees with the CPU on 10^7 random u32 in 10^4 random segments', async () => {
    // The test section M1 names: "10^7 random u32 in 10^4 segments, exact".
    const n = 10_000_000;
    const segments = 10_000;
    const values = new Uint32Array(n);
    for (let i = 0; i < n; i++) values[i] = hashU32(99, i);
    // Random cut points, sorted: segment lengths from 0 to a few hundred.
    const cuts = Array.from({ length: segments - 1 }, (_, i) => hashU32(100, i) % (n + 1));
    cuts.sort((a, b) => a - b);
    const offsets = Uint32Array.of(0, ...cuts, n);
    const b = upload(gpu, values);
    const sums = await gpu.reduceI64By(b, ONE_U32, offsets, segments);
    // CPU sums in two halves of 16 bits so that plain numbers stay exact.
    let wrong = 0;
    for (let s = 0; s < segments; s++) {
      let lo = 0;
      let hi = 0;
      for (let i = offsets[s] as number; i < (offsets[s + 1] as number); i++) {
        const v = values[i] as number;
        lo += v & 0xffff;
        hi += v >>> 16;
      }
      if (sums[s] !== BigInt(hi) * 65536n + BigInt(lo)) wrong++;
    }
    expect(wrong).toBe(0);
    gpu.release(b);
  });

  it('refuses an offset table that decreases, overruns the buffer or disagrees with `segments`', async () => {
    const b = upload(gpu, new Uint32Array(100));
    await expect(gpu.reduceI64By(b, ONE_U32, Uint32Array.of(0, 50, 40))).rejects.toThrow(
      /decreases/,
    );
    await expect(gpu.reduceI64By(b, ONE_U32, Uint32Array.of(0, 101))).rejects.toThrow(/beyond 100/);
    expect(() => gpu.reduceI64By(b, ONE_U32, Uint32Array.of(0, 50, 100), 3)).toThrow(/3 segments/);
    expect(await gpu.reduceI64By(b, ONE_U32, Uint32Array.of(7))).toHaveLength(0);
    gpu.release(b);
  });
});

describe.skipIf(ctx === null)(
  'accumulation in registered integer fields (section M1, "Tests")',
  () => {
    const gpu = ctx as GpuContext;

    it('sums 3,430 equal increments and 100,000 increments of one unit exactly', async () => {
      // 3,430 is the tick count of the sizing programme. A kernel adds an increment to a u32 and
      // to an i32 accumulator once per dispatch; the totals are checked through the reduction.
      const kernel = await gpu.kernel({
        name: 'accumulate',
        wgsl: `
struct P { du: u32, di: i32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> acc: array<vec2<u32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= arrayLength(&acc)) { return; }
  let a = acc[gid.x];
  acc[gid.x] = vec2<u32>(a.x + p.du, bitcast<u32>(bitcast<i32>(a.y) + p.di));
}`,
        entry: 'main',
        bindings: [
          { group: 0, binding: 0, name: 'p', kind: 'uniform' },
          { group: 0, binding: 1, name: 'acc', kind: 'storage' },
        ],
        uses: ['bitcast'],
        reads: ['p', 'acc'],
        writes: ['acc'],
        atomics: [],
      });
      const cells = 256;
      const spec: ReduceSpec = {
        strideBytes: 8,
        fields: [
          { offsetBytes: 0, type: 'u32' },
          { offsetBytes: 4, type: 'i32' },
        ],
      };
      for (const [steps, du, di] of [
        [3430, 1_000_003, -500_009],
        [100_000, 1, -1],
      ] as const) {
        const p = gpu.buffer({
          name: 'accumulate.p',
          owner: 'test',
          stage: 'A',
          bytes: 8,
          usage: BUFFER_USAGE.UNIFORM,
          fields: [{ name: 'word', type: 'u32', role: 'static', unit: '-' }],
        });
        const acc = gpu.buffer({
          name: 'accumulate.acc',
          owner: 'test',
          stage: 'A',
          bytes: 8 * cells,
          usage: BUFFER_USAGE.STORAGE,
          fields: [
            { name: 'mass', type: 'u32', role: 'accumulator', unit: 'kg', bound: 2 ** 32 - 1 },
            { name: 'heat', type: 'i32', role: 'accumulator', unit: 'J', bound: 2 ** 31 - 1 },
          ],
        });
        gpu.write(p, new Int32Array([du, di]));
        const op = {
          op: 'dispatch',
          kernel,
          bindings: { p, acc },
          workgroups: [cells / 64, 1, 1],
          plannedTime: 1e-5,
        } as const;
        await gpu.run(Array.from({ length: steps }, () => op));
        const sums = await gpu.reduceI64(acc, spec);
        expect(sums[0]).toBe(BigInt(cells) * BigInt(steps) * BigInt(du));
        expect(sums[1]).toBe(BigInt(cells) * BigInt(steps) * BigInt(di));
        gpu.releaseStage('A');
      }
    });
  },
);

describe.skipIf(ctx === null)('reductions that need more than one row of workgroups', () => {
  const gpu = ctx as GpuContext;

  it('sums 2,200,000 single-element segments exactly (two-row dispatch)', async () => {
    // One invocation per segment and field: 2.2 M invocations, above the 2,097,152 of one row
    // (32,768 workgroups of 64), so the kernel index is gid.y * row + gid.x with gid.y = 1 for
    // the tail. Each segment's sum must be its own word, in particular around the row boundary.
    const n = 2_200_000;
    const words = new Uint32Array(n);
    for (let i = 0; i < n; i++) words[i] = hashU32(41, i);
    const offsets = Uint32Array.from({ length: n + 1 }, (_, i) => i);
    const b = upload(gpu, words);
    const sums = await gpu.reduceI64By(b, ONE_U32, offsets);
    expect(sums.length).toBe(n);
    let mismatches = 0;
    for (let i = 0; i < n; i++) if (sums[i] !== BigInt(words[i] as number)) mismatches++;
    expect(mismatches).toBe(0);
    const row = 32768 * 64;
    for (const at of [0, row - 1, row, row + 1, n - 1]) {
      expect(sums[at], `segment ${at}`).toBe(BigInt(words[at] as number));
    }
    gpu.release(b);
  }, 30_000);

  it('sums 16 fields over 8,388,672 elements exactly (two-row first pass)', async () => {
    // The whole-buffer form: the first pass has 131,073 groups of 16 fields, 2,097,168
    // invocations, 16 more than one row holds.
    const elements = 64 * 131_073;
    const stride = 2;
    const words = new Uint32Array(elements * stride);
    for (let i = 0; i < words.length; i++) words[i] = hashU32(43, i);
    const fields = Array.from({ length: MAX_REDUCE_FIELDS }, (_, f) => ({
      offsetBytes: 4 * (f % stride),
      type: f % 4 < 2 ? ('u32' as const) : ('i32' as const),
    }));
    const spec: ReduceSpec = { strideBytes: 4 * stride, fields };
    const b = upload(gpu, words);
    const sums = await gpu.reduceI64(b, spec);
    expect([...sums]).toEqual(cpuSums(words, spec, [0, elements]));
    gpu.release(b);
  }, 30_000);
});

describe.skipIf(ctx === null)('accumulation in f32 state (section M1, "Tests")', () => {
  const gpu = ctx as GpuContext;

  it('sums 3,430 equal increments and 100,000 unit increments within 0.1 %', async () => {
    // The f32 counterpart of the integer test above: a state word incremented once per
    // dispatch. The reference is the product in double precision; the contract's tolerance is
    // 0.1 %. (10^5 unit increments are exact in f32, which holds integers up to 2^24; 3,430
    // increments of 0.1 accumulate rounding of about 1e-5 relative.)
    const kernel = await gpu.kernel({
      name: 'accumulate-f32',
      wgsl: `
struct P { d: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> acc: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= arrayLength(&acc)) { return; }
  acc[gid.x] = acc[gid.x] + p.d;
}`,
      entry: 'main',
      bindings: [
        { group: 0, binding: 0, name: 'p', kind: 'uniform' },
        { group: 0, binding: 1, name: 'acc', kind: 'storage' },
      ],
      uses: ['addmul'],
      reads: ['p', 'acc'],
      writes: ['acc'],
      atomics: [],
    });
    const cells = 256;
    for (const [steps, d] of [
      [3430, 0.1],
      [3430, 1.2345e-7],
      [100_000, 1],
    ] as const) {
      const p = gpu.buffer({
        name: 'accumulate-f32.p',
        owner: 'test',
        stage: 'A',
        bytes: 4,
        usage: BUFFER_USAGE.UNIFORM,
        fields: [{ name: 'd', type: 'f32', role: 'static', unit: 'kg' }],
      });
      const acc = gpu.buffer({
        name: 'accumulate-f32.acc',
        owner: 'test',
        stage: 'A',
        bytes: 4 * cells,
        usage: BUFFER_USAGE.STORAGE,
        fields: [{ name: 'mass', type: 'f32', role: 'state', unit: 'kg' }],
      });
      gpu.write(p, Float32Array.of(d));
      const op = {
        op: 'dispatch',
        kernel,
        bindings: { p, acc },
        workgroups: [cells / 64, 1, 1],
        plannedTime: 1e-5,
      } as const;
      await gpu.run(Array.from({ length: steps }, () => op));
      const got = new Float32Array(await gpu.read(acc));
      const expected = steps * Math.fround(d);
      let worst = 0;
      for (const value of got) worst = Math.max(worst, Math.abs(value - expected) / expected);
      expect(worst, `${steps} x ${d}`).toBeLessThan(1e-3);
      // Every cell took the same path: one value in the whole buffer (a gather, rule 4).
      expect(new Set(got).size).toBe(1);
      expect(await gpu.nonFiniteCount([acc])).toBe(0);
      gpu.releaseStage('A');
    }
  }, 30_000);
});
