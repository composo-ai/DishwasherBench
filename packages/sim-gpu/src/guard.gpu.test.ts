// The non-finite guard of module M1 (docs/design/sim-core.md section M1, "Non-finite guard"):
// it must count exactly the planted NaN and infinity words, must also see non-finite values
// that a kernel computed (the case the rule exists for: a float test may be compiled away), and
// must not count integers or the largest finite floats.
import { afterAll, describe, expect, it } from 'vitest';
import { floatWordMask, GUARD_MAX_RECORD_WORDS } from './guard.ts';
import type { RecordLayout } from './layout.ts';
import { tryCreateNodeGpuContext } from './node/device.ts';
import type { GpuContext } from './types.ts';
import { BUFFER_USAGE } from './usage.ts';

const ctx = await tryCreateNodeGpuContext();
afterAll(() => ctx?.destroy());

const MIXED = {
  name: 'GuardCell',
  section: 'test',
  owner: 'M1',
  per: 'cell',
  byteSize: 16,
  fields: [
    { name: 'm', type: 'u32', offset: 0, role: 'state', unit: 'kg', scale: 1e-12, doc: 'x' },
    { name: 'h', type: 'f32', offset: 4, role: 'state', unit: 'm', doc: 'x' },
    { name: 'flags', type: 'u32', offset: 8, role: 'static', unit: '-', doc: 'x' },
    { name: 'u', type: 'f32', offset: 12, role: 'state', unit: 'm/s', doc: 'x' },
  ],
} as const satisfies RecordLayout;

describe.skipIf(ctx === null)('non-finite guard', () => {
  const gpu = ctx as GpuContext;
  const floats = [{ name: 'x', type: 'f32', role: 'state', unit: '1' }] as const;

  it('counts a planted NaN and a planted infinity, and nothing else', async () => {
    const n = 100_000;
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = (i % 2 === 0 ? 1 : -1) * 1.5 ** ((i % 300) - 150);
    // Values a float comparison might confuse with non-finite ones.
    data[10] = 3.4028234663852886e38; // largest finite f32
    data[11] = -3.4028234663852886e38;
    data[12] = 1e-45; // smallest subnormal
    data[13] = -0;
    const b = gpu.buffer({
      name: 'guard.plain',
      owner: 'test',
      stage: 'A',
      bytes: 4 * n,
      usage: BUFFER_USAGE.STORAGE,
      fields: floats,
    });
    gpu.write(b, data);
    expect(await gpu.nonFiniteCount([b])).toBe(0);

    data[4321] = NaN;
    data[n - 1] = Infinity;
    gpu.write(b, data);
    expect(await gpu.nonFiniteCount([b])).toBe(2);

    // Every kind: both infinities, a quiet and a signalling NaN, a negative NaN with payload.
    const bits = new Uint32Array(data.buffer);
    bits[0] = 0xff800000;
    bits[63] = 0x7fc00000;
    bits[64] = 0x7f800001;
    bits[65] = 0xffffffff;
    gpu.write(b, data);
    expect(await gpu.nonFiniteCount([b])).toBe(6);
    gpu.release(b);
  });

  it('sees non-finite values a kernel computes at run time', async () => {
    // 0/0, 1/0, sqrt(-1), log(0) and an overflowing product, from operands the compiler
    // cannot know: element i of the output is non-finite exactly when kind[i] is not 0.
    const kernel = await gpu.kernel({
      name: 'make-nonfinite',
      wgsl: `
@group(0) @binding(0) var<storage, read> kind: array<u32>;
@group(0) @binding(1) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&out)) { return; }
  let k = kind[i];
  let zero = f32(k) * 0.0;
  var v = f32(i) + 1.0;
  if (k == 1u) { v = zero / zero; }
  if (k == 2u) { v = v / zero; }
  if (k == 3u) { v = sqrt(zero - v); }
  if (k == 4u) { v = log(zero); }
  if (k == 5u) { v = (v + 1e30) * (v + 1e30); }
  out[i] = v;
}`,
      entry: 'main',
      bindings: [
        { group: 0, binding: 0, name: 'kind', kind: 'read-only-storage' },
        { group: 0, binding: 1, name: 'out', kind: 'storage' },
      ],
      uses: ['addmul', 'div', 'sqrt', 'explog'],
      reads: ['kind'],
      writes: ['out'],
      atomics: [],
    });
    const n = 4096;
    const kinds = new Uint32Array(n);
    const planted = [5, 64, 65, 1000, 1001, 1002, 2047, 2048, 4000, 4095];
    planted.forEach((at, j) => (kinds[at] = 1 + (j % 5)));
    const kind = gpu.buffer({
      name: 'guard.kind',
      owner: 'test',
      stage: 'A',
      bytes: 4 * n,
      usage: BUFFER_USAGE.STORAGE,
      fields: [{ name: 'k', type: 'u32', role: 'static', unit: '-' }],
    });
    const out = gpu.buffer({
      name: 'guard.out',
      owner: 'test',
      stage: 'A',
      bytes: 4 * n,
      usage: BUFFER_USAGE.STORAGE,
      fields: floats,
    });
    gpu.write(kind, kinds);
    gpu.submit([
      {
        op: 'dispatch',
        kernel,
        bindings: { kind, out },
        workgroups: [n / 64, 1, 1],
        plannedTime: 0,
      },
    ]);
    // The default set is every live storage buffer with registered floats: only `out` here.
    expect(await gpu.nonFiniteCount()).toBe(planted.length);
    // Independent check on the CPU, on the bytes read back.
    const values = new Float32Array(await gpu.read(out));
    expect(values.filter((v) => !Number.isFinite(v)).length).toBe(planted.length);
    for (const at of planted) expect(Number.isFinite(values[at])).toBe(false);
    gpu.releaseStage('A');
  });

  it('examines only the float words of a record layout', async () => {
    expect(floatWordMask({ layout: MIXED, fields: MIXED.fields } as never)).toEqual({
      strideWords: 4,
      mask: Uint32Array.of(0b1010),
      lowHalf: Uint32Array.of(0),
      highHalf: Uint32Array.of(0),
    });
    const n = 1000;
    const words = new Uint32Array(4 * n);
    // Integer words that have the bit pattern of an infinity or a NaN are legitimate.
    for (let i = 0; i < n; i++) {
      words[4 * i] = 0x7f800000;
      words[4 * i + 2] = 0xffffffff;
    }
    const b = gpu.buffer({
      name: 'guard.mixed',
      owner: 'test',
      stage: 'A',
      bytes: 16 * n,
      usage: BUFFER_USAGE.STORAGE,
      layout: MIXED,
    });
    gpu.write(b, words);
    expect(await gpu.nonFiniteCount([b])).toBe(0);
    words[4 * 17 + 1] = 0x7fc00000; // h of record 17
    words[4 * 999 + 3] = 0x7f800000; // u of the last record
    words[4 * 500 + 1] = 0xff800000; // h and u of record 500
    words[4 * 500 + 3] = 0x7fc00001;
    gpu.write(b, words);
    expect(await gpu.nonFiniteCount([b])).toBe(4);
    gpu.release(b);
  });

  it('counts zero for buffers without floats and refuses records beyond its mask', async () => {
    const ints = gpu.buffer({
      name: 'guard.ints',
      owner: 'test',
      stage: 'A',
      bytes: 64,
      usage: BUFFER_USAGE.STORAGE,
      fields: [{ name: 'k', type: 'u32', role: 'static', unit: '-' }],
    });
    gpu.write(ints, new Uint32Array(16).fill(0x7fc00000));
    expect(await gpu.nonFiniteCount([ints])).toBe(0);
    gpu.release(ints);
    const words = GUARD_MAX_RECORD_WORDS + 1;
    const big: RecordLayout = {
      name: 'TooBig',
      section: 'test',
      owner: 'M1',
      per: 'element',
      byteSize: 4 * words,
      fields: [
        { name: 'x', type: 'f32', offset: 0, count: words, role: 'state', unit: '1', doc: 'x' },
      ],
    };
    const b = gpu.buffer({
      name: 'guard.big',
      owner: 'test',
      stage: 'A',
      bytes: 4 * words,
      usage: BUFFER_USAGE.STORAGE,
      layout: big,
    });
    await expect(gpu.nonFiniteCount([b])).rejects.toThrow(/exceed the guard/);
    gpu.release(b);
  });
});

// f16 halves, partial records and buffers the kernel cannot bind directly. The planted patterns
// are written as raw words, so the expected counts do not come from any code under test.
const PACKED = {
  name: 'GuardPacked',
  section: 'test',
  owner: 'M1',
  per: 'cell',
  byteSize: 20,
  fields: [
    { name: 'id', type: 'u32', offset: 0, role: 'static', unit: '-', doc: 'x' },
    { name: 'b', type: 'f32', offset: 4, role: 'state', unit: '1', doc: 'x' },
    { name: 'lo', type: 'f16', offset: 8, role: 'statistic', unit: 'm', scale: 1e-6, doc: 'x' },
    { name: 'hi', type: 'f16', offset: 10, role: 'statistic', unit: 'm', scale: 1e-6, doc: 'x' },
    { name: 'n', type: 'u16', offset: 12, role: 'static', unit: '-', doc: 'x' },
    { name: 'peak', type: 'f16', offset: 14, role: 'statistic', unit: 'Pa', doc: 'x' },
    { name: 'c', type: 'f32', offset: 16, role: 'state', unit: '1', doc: 'x' },
  ],
} as const satisfies RecordLayout;

const HALVES = {
  name: 'GuardHalf',
  section: 'test',
  owner: 'M1',
  per: 'block',
  byteSize: 2,
  fields: [{ name: 'h', type: 'f16', offset: 0, role: 'statistic', unit: 'm', doc: 'x' }],
} as const satisfies RecordLayout;

describe.skipIf(ctx === null)('non-finite guard: f16 halves and buffer edges', () => {
  const gpu = ctx as GpuContext;

  it('counts non-finite f16 halves of packed words, and not integers beside them', async () => {
    expect(floatWordMask({ layout: PACKED, fields: PACKED.fields } as never)).toEqual({
      strideWords: 5,
      mask: Uint32Array.of(0b10010),
      lowHalf: Uint32Array.of(0b00100),
      highHalf: Uint32Array.of(0b01100),
    });
    const n = 500;
    const words = new Uint32Array(5 * n);
    for (let i = 0; i < n; i++) {
      words[5 * i] = 0x7f800000; // an id with the pattern of an infinity
      words[5 * i + 2] = 0x7bff7bff; // both halves the largest finite half, 65,504
      words[5 * i + 3] = 0x3c007c00; // high half 1.0; the u16 below it has the pattern of inf
    }
    const b = gpu.buffer({
      name: 'guard.packed',
      owner: 'test',
      stage: 'A',
      bytes: 20 * n,
      usage: BUFFER_USAGE.STORAGE,
      layout: PACKED,
    });
    gpu.write(b, words);
    expect(await gpu.nonFiniteCount([b])).toBe(0);
    words[5 * 7 + 2] = 0x7bff7c00; // lo = +inf
    words[5 * 8 + 2] = 0xfc007bff; // hi = -inf
    words[5 * 9 + 2] = 0x7e00fe01; // lo and hi both NaN: two
    words[5 * 499 + 3] = 0x7c010000; // peak = NaN in the last record
    words[5 * 100 + 1] = 0x7fc00000; // an f32 NaN as well
    gpu.write(b, words);
    expect(await gpu.nonFiniteCount([b])).toBe(6);
    gpu.release(b);
  });

  it('examines both halves of every word of a 2-byte f16 record, and f16-only fields', async () => {
    const words = new Uint32Array(64).fill(0x3c003c00);
    words[5] = 0x3c007c00;
    words[63] = 0xffff3c00;
    const byLayout = gpu.buffer({
      name: 'guard.halves',
      owner: 'test',
      stage: 'A',
      bytes: 256,
      usage: BUFFER_USAGE.STORAGE,
      layout: HALVES,
    });
    const byFields = gpu.buffer({
      name: 'guard.halves.fields',
      owner: 'test',
      stage: 'A',
      bytes: 256,
      usage: BUFFER_USAGE.STORAGE,
      fields: [{ name: 'h', type: 'f16', role: 'statistic', unit: 'm' }],
    });
    gpu.write(byLayout, words);
    gpu.write(byFields, words);
    expect(await gpu.nonFiniteCount([byLayout])).toBe(2);
    expect(await gpu.nonFiniteCount([byFields])).toBe(2);
    gpu.releaseStage('A');
  });

  it('examines a trailing partial record', async () => {
    // 68 bytes of 20-byte records: three whole records and the first two words of a fourth.
    const b = gpu.buffer({
      name: 'guard.partial',
      owner: 'test',
      stage: 'A',
      bytes: 68,
      usage: BUFFER_USAGE.STORAGE,
      layout: PACKED,
    });
    const words = new Uint32Array(17);
    words[15] = 0x7fc00000; // the id of the partial record: an integer, not counted
    gpu.write(b, words);
    expect(await gpu.nonFiniteCount([b])).toBe(0);
    words[16] = 0x7fc00000; // its f32 field `b`
    gpu.write(b, words);
    expect(await gpu.nonFiniteCount([b])).toBe(1);
    gpu.release(b);
  });

  it('examines a uniform buffer, named or by default', async () => {
    const before = await gpu.nonFiniteCount();
    const u = gpu.buffer({
      name: 'guard.uniform',
      owner: 'test',
      stage: 'A',
      bytes: 32,
      usage: BUFFER_USAGE.UNIFORM,
      fields: [{ name: 'p', type: 'f32', role: 'static', unit: '1' }],
    });
    const values = new Float32Array(8).fill(1.5);
    gpu.write(u, values);
    expect(await gpu.nonFiniteCount([u])).toBe(0);
    new Uint32Array(values.buffer)[3] = 0x7f800000;
    gpu.write(u, values);
    expect(await gpu.nonFiniteCount([u])).toBe(1);
    expect(await gpu.nonFiniteCount()).toBe(before + 1);
    gpu.release(u);
  });
});
