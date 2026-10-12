// The device wrapper, registered buffers, kernels and dispatch of module M1
// (docs/design/sim-core.md section M1): the stack string, the binding assertions ("fires at
// 4 GiB and at the ninth storage buffer"), the narrow-field rule at registration, upload and
// read-back, WGSL assembly through the kernel path, accumulator pairs, and failures of the
// device reported as failures. Expected values are computed on the CPU, independently.
import { hashU32 } from '@spotless/core';
import { afterAll, describe, expect, it } from 'vitest';
import { createGpuContext, GpuInfrastructureError } from './context.ts';
import { nodeGpuEntry, tryCreateNodeGpuContext } from './node/device.ts';
import { stackKey } from './stack.ts';
import {
  BINDING_BYTES_LIMIT,
  MAX_STORAGE_BUFFERS_PER_KERNEL,
  type BatchOp,
  type BindingDef,
  type FieldDef,
  type GpuContext,
  type KernelDef,
} from './types.ts';
import { BUFFER_USAGE } from './usage.ts';
import { uniformBlock, WGSL_RNG } from './wgsl.ts';

const ctx = await tryCreateNodeGpuContext({ sim: '1.2.3', physics: 'jolt 5.0' });
afterAll(() => ctx?.destroy());

const WORD: FieldDef[] = [{ name: 'word', type: 'u32', role: 'static', unit: '-' }];
const U32 = BUFFER_USAGE.STORAGE;

/** A kernel definition with `n` storage bindings that the shader really uses. */
function manyBuffers(n: number): KernelDef {
  const bindings: BindingDef[] = Array.from({ length: n }, (_, i) => ({
    group: 0,
    binding: i,
    name: `b${i}`,
    kind: 'storage' as const,
  }));
  const decls = bindings
    .map((b) => `@group(0) @binding(${b.binding}) var<storage, read_write> ${b.name}: array<u32>;`)
    .join('\n');
  const body = bindings.map((b) => `${b.name}[i] = ${b.binding + 1}u * (i + 1u);`).join('\n  ');
  return {
    name: `many-${n}`,
    wgsl: `${decls}
@compute @workgroup_size(16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= 16u) { return; }
  ${body}
}`,
    entry: 'main',
    bindings,
    uses: [],
    reads: [],
    writes: bindings.map((b) => b.name),
    atomics: [],
  };
}

describe.skipIf(ctx === null)('GpuContext', () => {
  const gpu = ctx as GpuContext;

  describe('stack string', () => {
    it('names the simulator, GPU, operating-system build, bindings, runtime and physics', () => {
      const entry = nodeGpuEntry();
      expect(gpu.stack.sim).toBe('1.2.3');
      expect(gpu.stack.physics).toBe('jolt 5.0');
      expect(gpu.stack.runtime).toBe(`node ${process.versions.node}`);
      // The contract fixes the bindings at 0.6.2 (section M1).
      expect(gpu.stack.webgpu).toBe('webgpu 0.6.2');
      expect(gpu.stack.os).toBe(entry.os);
      expect(gpu.stack.gpu.length).toBeGreaterThan(0);
      if (process.platform === 'darwin') {
        // "macOS 27.0.1 (26A434)": product version and build, the part an update changes.
        expect(gpu.stack.os).toMatch(/^macOS \d+(\.\d+)+ \([0-9A-Za-z]+\)$/);
      }
      expect(stackKey(gpu.stack)).toBe(
        `sim=1.2.3; gpu=${gpu.stack.gpu}; os=${gpu.stack.os}; webgpu=webgpu 0.6.2; ` +
          `runtime=node ${process.versions.node}; physics=jolt 5.0`,
      );
    });

    it('has the limits of the adapter, not the WebGPU defaults', () => {
      // Defaults: 128 MiB storage bindings, 256 MiB buffers. A 16 M cell state needs 256 MiB.
      expect(gpu.device.limits.maxStorageBufferBindingSize).toBeGreaterThanOrEqual(2 ** 30);
      expect(gpu.device.limits.maxBufferSize).toBeGreaterThanOrEqual(2 ** 30);
      expect(gpu.device.limits.maxStorageBuffersPerShaderStage).toBeGreaterThanOrEqual(8);
    });
  });

  describe('buffers', () => {
    it('refuses a buffer of 4 GiB and one of exactly 2^32 - 4 bytes, before allocating', () => {
      const live = gpu.stats.liveBuffers;
      for (const bytes of [2 ** 32, BINDING_BYTES_LIMIT]) {
        expect(() =>
          gpu.buffer({
            name: 'huge',
            owner: 'test',
            stage: 'run',
            bytes,
            usage: U32,
            fields: WORD,
          }),
        ).toThrow(/not below the binding limit/);
      }
      expect(gpu.stats.liveBuffers).toBe(live);
    });

    it('refuses a size that is not a whole number of words, and a second buffer of one name', () => {
      const make = (name: string, bytes: number) =>
        gpu.buffer({ name, owner: 'test', stage: 'A', bytes, usage: U32, fields: WORD });
      expect(() => make('odd', 10)).toThrow(/multiple of 4/);
      expect(() => make('none', 0)).toThrow(/multiple of 4/);
      const first = make('twice', 16);
      expect(() => make('twice', 16)).toThrow(/already has this name/);
      gpu.release(first);
      // The name is free again after release.
      gpu.release(make('twice', 16));
    });

    it('applies determinism rule 7 to the registered fields', () => {
      const make = (fields: FieldDef[]) =>
        gpu.buffer({ name: 'rule7', owner: 'test', stage: 'A', bytes: 16, usage: U32, fields });
      // An f16 or u8 that accumulates state is refused.
      expect(() => make([{ name: 'h', type: 'f16', role: 'state', unit: 'm' }])).toThrow(/rule 7/);
      expect(() =>
        make([{ name: 'n', type: 'u8', role: 'accumulator', unit: '1', bound: 9 }]),
      ).toThrow(/rule 7/);
      // An integer accumulator needs the largest value the plan can produce.
      expect(() => make([{ name: 'm', type: 'u32', role: 'accumulator', unit: 'kg' }])).toThrow(
        /without a registered bound/,
      );
      // Allowed: a narrow statistic, a bounded narrow counter, a bounded u32 accumulator.
      gpu.release(make([{ name: 'peak', type: 'f16', role: 'statistic', unit: 'Pa' }]));
      gpu.release(
        make([
          { name: 'n', type: 'u16', role: 'counter', unit: '1', bound: 3430 },
          { name: 'm', type: 'u32', role: 'accumulator', unit: 'kg', bound: 2 ** 31 },
        ]),
      );
      // A counter is an integer with a bound, whichever way the buffer is registered: the
      // `fields` path applies the same rule as a record layout (M1, "Narrow fields").
      for (const type of ['f16', 'log8', 'f32'] as const) {
        expect(() => make([{ name: 'n', type, role: 'counter', unit: '1' }]), type).toThrow(
          /counter stored as .*not as an integer/,
        );
      }
      expect(() => make([{ name: 'n', type: 'u16', role: 'counter', unit: '1' }])).toThrow(
        /without a registered bound/,
      );
      expect(() =>
        make([{ name: 'n', type: 'u8', role: 'counter', unit: '1', bound: 256 }]),
      ).toThrow(/outside 1 to 255/);
      // Floats beside integers without a layout: the guard could not tell them apart.
      expect(() =>
        make([
          { name: 'peak', type: 'f16', role: 'statistic', unit: 'Pa' },
          { name: 'n', type: 'u16', role: 'counter', unit: '1', bound: 3430 },
        ]),
      ).toThrow(/without a layout/);
    });

    it('refuses floats beside integers without a layout (the guard could not find them)', () => {
      expect(() =>
        gpu.buffer({
          name: 'mixed',
          owner: 'test',
          stage: 'A',
          bytes: 16,
          usage: U32,
          fields: [
            { name: 'h', type: 'f32', role: 'state', unit: 'm' },
            { name: 'flags', type: 'u32', role: 'static', unit: '-' },
          ],
        }),
      ).toThrow(/without a layout/);
    });

    it('reads back what was uploaded, whole and in parts, and new buffers are zero', async () => {
      const n = 5000;
      const data = new Uint32Array(n);
      for (let i = 0; i < n; i++) data[i] = hashU32(77, i);
      const b = gpu.buffer({
        name: 'roundtrip',
        owner: 'test',
        stage: 'A',
        bytes: 4 * n,
        usage: U32,
        fields: WORD,
      });
      expect(new Uint32Array(await gpu.read(b)).every((v) => v === 0)).toBe(true);
      gpu.write(b, data);
      expect(new Uint32Array(await gpu.read(b))).toEqual(data);
      // A part that starts and ends inside words: bytes 6 to 6 + 9.
      const part = new Uint8Array(await gpu.read(b, 6, 9));
      expect(part).toEqual(new Uint8Array(data.buffer, 6, 9));
      // A partial upload at an offset changes those words only.
      gpu.write(b, Uint32Array.of(1, 2, 3), 400);
      const after = new Uint32Array(await gpu.read(b));
      expect([...after.subarray(100, 103)]).toEqual([1, 2, 3]);
      expect(after[99]).toBe(data[99]);
      expect(after[103]).toBe(data[103]);
      // Several reads requested at once share the one staging buffer and all arrive.
      const [x, y] = await Promise.all([gpu.read(b, 0, 8), gpu.read(b, 8, 8)]);
      expect(new Uint32Array(x)).toEqual(data.subarray(0, 2));
      expect(new Uint32Array(y)).toEqual(data.subarray(2, 4));
      expect(() => gpu.read(b, 4 * n - 4, 8)).toThrow(RangeError);
      gpu.release(b);
      expect(b.released).toBe(true);
      expect(() => b.gpu).toThrow(/released/);
    });

    it('releases the buffers of a stage and leaves the others', () => {
      const make = (name: string, stage: 'C' | 'G' | 'run') =>
        gpu.buffer({ name, owner: 'test', stage, bytes: 64, usage: U32, fields: WORD });
      const c1 = make('c1', 'C');
      const c2 = make('c2', 'C');
      const g = make('g', 'G');
      const run = make('run', 'run');
      const bytes = gpu.stats.liveBytes;
      gpu.releaseStage('C');
      expect([c1.released, c2.released, g.released, run.released]).toEqual([
        true,
        true,
        false,
        false,
      ]);
      expect(gpu.stats.liveBytes).toBe(bytes - 128);
      gpu.release(g);
      gpu.release(run);
    });
  });

  describe('kernels', () => {
    it('accepts eight storage buffers and refuses the ninth', async () => {
      expect(MAX_STORAGE_BUFFERS_PER_KERNEL).toBe(8);
      const kernel = await gpu.kernel(manyBuffers(8));
      // The eight-buffer kernel really runs: buffer k receives (k + 1) * (i + 1).
      const buffers = Array.from({ length: 8 }, (_, i) =>
        gpu.buffer({
          name: `many${i}`,
          owner: 'test',
          stage: 'A',
          bytes: 64,
          usage: U32,
          fields: WORD,
        }),
      );
      gpu.submit([
        {
          op: 'dispatch',
          kernel,
          bindings: Object.fromEntries(buffers.map((b, i) => [`b${i}`, b])),
          workgroups: [1, 1, 1],
          plannedTime: 0,
        },
      ]);
      for (const [k, b] of buffers.entries()) {
        const got = new Uint32Array(await gpu.read(b));
        expect([...got]).toEqual(Array.from({ length: 16 }, (_, i) => (k + 1) * (i + 1)));
      }
      gpu.releaseStage('A');
      await expect(gpu.kernel(manyBuffers(9))).rejects.toThrow(/9 storage buffers; at most 8/);
    });

    it('refuses a fourth bind group, a duplicate slot and a write to a read-only slot', async () => {
      const base = manyBuffers(1);
      const bad = (bindings: BindingDef[], extra: Partial<KernelDef> = {}): Promise<unknown> =>
        gpu.kernel({ ...base, bindings, writes: [], ...extra });
      await expect(bad([{ group: 3, binding: 0, name: 'x', kind: 'storage' }])).rejects.toThrow(
        /groups 0 to 2/,
      );
      await expect(
        bad([
          { group: 0, binding: 0, name: 'x', kind: 'storage' },
          { group: 0, binding: 1, name: 'x', kind: 'storage' },
        ]),
      ).rejects.toThrow(/declared twice/);
      await expect(
        bad([{ group: 0, binding: 0, name: 'x', kind: 'read-only-storage' }], { writes: ['x'] }),
      ).rejects.toThrow(/not a read-write storage binding/);
      await expect(
        bad([{ group: 0, binding: 0, name: 'x', kind: 'storage' }], { atomics: ['y'] }),
      ).rejects.toThrow(/not a binding/);
    });

    it('checks uses, writes and atomics against the source (rule 9)', async () => {
      const source = (body: string, helpers = ''): string => `
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read_write> o: array<f32>;
${helpers}
@compute @workgroup_size(1) fn main() { ${body} }`;
      const def = (name: string, wgsl: string, change: Partial<KernelDef> = {}): KernelDef => ({
        name,
        wgsl,
        entry: 'main',
        bindings: [
          { group: 0, binding: 0, name: 'a', kind: 'read-only-storage' },
          { group: 0, binding: 1, name: 'o', kind: 'storage' },
        ],
        uses: [],
        reads: ['a'],
        writes: ['o'],
        atomics: [],
        ...change,
      });
      const powSqrt = source('o[0] = pow(a[0], 1.5) + sqrt(a[1]);');
      // Every class the entry point calls must be declared.
      await expect(gpu.kernel(def('uses-none', powSqrt))).rejects.toThrow(
        /uses sqrt, pow but `uses` does not list them/,
      );
      await expect(gpu.kernel(def('uses-one', powSqrt, { uses: ['pow'] }))).rejects.toThrow(
        /uses sqrt but `uses` does not list it/,
      );
      // A helper the entry point never calls, and a comment, do not count.
      const unreached = source(
        'o[0] = a[0] * 2.0; /* sqrt(a[1]) */',
        'fn helper(x: f32) -> f32 { return exp(x); }',
      );
      await gpu.kernel(def('uses-unreached', unreached, { uses: ['addmul'] }));
      // A read-write storage binding is a written slot and must be declared as one.
      await expect(
        gpu.kernel(def('writes-none', powSqrt, { uses: ['pow', 'sqrt'], writes: [] })),
      ).rejects.toThrow(
        /slot o is a read-write storage binding but is in neither writes nor atomics/,
      );
      // Atomic operations and the atomics list go together.
      const atomic = `
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read_write> o: array<atomic<u32>>;
@compute @workgroup_size(1) fn main() { atomicAdd(&o[0], u32(a[0])); }`;
      await expect(gpu.kernel(def('atomics-none', atomic, { uses: ['atomics'] }))).rejects.toThrow(
        /atomic operations but `atomics` names no slot/,
      );
      await expect(
        gpu.kernel(
          def('atomics-extra', powSqrt, { uses: ['pow', 'sqrt'], writes: [], atomics: ['o'] }),
        ),
      ).rejects.toThrow(/atomics are declared but the source has no atomic operation/);

      // A changed probe names the kernels that declared its class, and no others.
      await gpu.kernel(def('names-pow-sqrt', powSqrt, { uses: ['pow', 'sqrt', 'addmul'] }));
      await gpu.kernel(
        def('names-atomics', atomic, { uses: ['atomics', 'ftoi'], writes: [], atomics: ['o'] }),
      );
      expect(gpu.kernelsUsing(['pow'])).toEqual(['names-pow-sqrt']);
      expect(gpu.kernelsUsing(['sqrt', 'atomics'])).toEqual(['names-atomics', 'names-pow-sqrt']);
      expect(gpu.kernelsUsing(['ftoi'])).toEqual(['names-atomics']);
      expect(gpu.kernelsUsing(['atan2'])).toEqual([]);
      expect(gpu.kernelsUsing([])).toEqual([]);
      // The context's own kernels are listed too: the reductions and the guard use bitcast.
      expect(gpu.kernelsUsing(['bitcast'])).toEqual([
        'sim-gpu.nonfinite',
        'sim-gpu.reduce.leaf',
        'sim-gpu.reduce.leaf.table',
        'sim-gpu.reduce.node',
        'sim-gpu.reduce.node.table',
      ]);
      // A kernel that failed registration is not listed.
      expect(gpu.kernelsUsing(['pow', 'sqrt', 'atomics']).some((n) => n.startsWith('uses-'))).toBe(
        false,
      );
    });

    it('reports a WGSL error with its line and does not fail the device', async () => {
      const def = manyBuffers(1);
      const broken = {
        ...def,
        name: 'broken',
        wgsl: def.wgsl.replace('let i = gid.x;', 'let i = gid.q;'),
      };
      await expect(gpu.kernel(broken)).rejects.toThrow(/broken: WGSL does not compile:\s+\d+:\d+/);
      await gpu.drain();
      expect(gpu.failure()).toBeNull();
    });

    it('refuses source that still has an #include, and caches pipelines by source hash', async () => {
      const def = manyBuffers(2);
      await expect(gpu.kernel({ ...def, wgsl: `#include "rng"\n${def.wgsl}` })).rejects.toThrow(
        /#include/,
      );
      const first = await gpu.kernel(def);
      const compiled = gpu.stats.pipelinesCompiled;
      const again = await gpu.kernel({ ...def, name: 'same-source-other-name' });
      expect(gpu.stats.pipelinesCompiled).toBe(compiled);
      expect(again.pipeline).toBe(first.pipeline);
      expect(again.sourceHash).toBe(first.sourceHash);
      expect(first.sourceHash).toMatch(/^[0-9a-f]{64}$/);
      // One changed character is another pipeline.
      const other = await gpu.kernel({ ...def, wgsl: def.wgsl.replace('16u', '15u') });
      expect(other.sourceHash).not.toBe(first.sourceHash);
      expect(gpu.stats.pipelinesCompiled).toBe(compiled + 1);
    });

    it('assembles shared source: the generator of @spotless/core and a parameter block', async () => {
      // One kernel that includes the random generator by name and reads a uniform block built
      // from a field list; the expected words come from the TypeScript generator.
      const block = uniformBlock('HashParams', [
        { name: 'seed', type: 'u32' },
        { name: 'scale', type: 'f32' },
        { name: 'offset', type: 'i32' },
      ]);
      gpu.wgsl.define('test/hash-params', block.wgsl);
      const wgsl = gpu.wgsl.assemble(`
#include "${WGSL_RNG}"
#include "test/hash-params"
@group(0) @binding(0) var<uniform> P: HashParams;
@group(0) @binding(1) var<storage, read_write> out: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&out) / 2u) { return; }
  out[2u * i] = rng_hash2(P.seed, i, 7u);
  out[2u * i + 1u] = bitcast<u32>(f32(i32(i) + P.offset) * P.scale);
}`);
      const kernel = await gpu.kernel({
        name: 'assembled',
        wgsl,
        entry: 'main',
        bindings: [
          { group: 0, binding: 0, name: 'params', kind: 'uniform' },
          { group: 0, binding: 1, name: 'out', kind: 'storage' },
        ],
        uses: ['addmul', 'bitcast', 'ftoi'],
        reads: ['params'],
        writes: ['out'],
        atomics: [],
      });
      const n = 1000;
      const params = gpu.buffer({
        name: 'assembled.params',
        owner: 'test',
        stage: 'A',
        bytes: block.byteSize,
        usage: BUFFER_USAGE.UNIFORM,
        fields: WORD,
      });
      const out = gpu.buffer({
        name: 'assembled.out',
        owner: 'test',
        stage: 'A',
        bytes: 8 * n,
        usage: U32,
        fields: WORD,
      });
      gpu.write(params, block.pack({ seed: 0xdecafbad, scale: 0.25, offset: -500 }));
      await gpu.run([
        {
          op: 'dispatch',
          kernel,
          bindings: { params, out },
          workgroups: [Math.ceil(n / 64), 1, 1],
          plannedTime: 0,
        },
      ]);
      const bytes = await gpu.read(out);
      const words = new Uint32Array(bytes);
      const floats = new Float32Array(bytes);
      let wrong = 0;
      for (let i = 0; i < n; i++) {
        if (words[2 * i] !== hashU32(0xdecafbad, i, 7)) wrong++;
        // (i - 500) * 0.25 is exact in f32.
        if (floats[2 * i + 1] !== (i - 500) * 0.25) wrong++;
      }
      expect(wrong).toBe(0);
      gpu.releaseStage('A');
    });

    it('refuses a dispatch with a missing or unknown slot, a bad window or too many workgroups', async () => {
      const kernel = await gpu.kernel(manyBuffers(1));
      const b = gpu.buffer({
        name: 'slot',
        owner: 'test',
        stage: 'A',
        bytes: 1024,
        usage: U32,
        fields: WORD,
      });
      const dispatch = (bindings: Record<string, unknown>, workgroups = [1, 1, 1]): BatchOp =>
        ({ op: 'dispatch', kernel, bindings, workgroups, plannedTime: 0 }) as unknown as BatchOp;
      expect(() => gpu.submit([dispatch({})])).toThrow(/nothing is bound to slot b0/);
      expect(() => gpu.submit([dispatch({ b0: b, other: b })])).toThrow(/no slot named other/);
      expect(() => gpu.submit([dispatch({ b0: { buffer: b, offset: 2, size: 64 } })])).toThrow(
        /not a word-aligned part/,
      );
      expect(() => gpu.submit([dispatch({ b0: { buffer: b, offset: 512, size: 1024 } })])).toThrow(
        /not a word-aligned part/,
      );
      // WebGPU aligns binding offsets (256 bytes by default); the wrapper says so itself.
      const alignment = gpu.device.limits.minStorageBufferOffsetAlignment;
      if (alignment > 64) {
        expect(() => gpu.submit([dispatch({ b0: { buffer: b, offset: 64, size: 64 } })])).toThrow(
          /binding alignment/,
        );
      }
      expect(() => gpu.submit([dispatch({ b0: b }, [65536, 1, 1])])).toThrow(/workgroup count/);
      // A window of a buffer is a legal binding: only its 16 words are written.
      await gpu.run([dispatch({ b0: { buffer: b, offset: alignment, size: 64 } })]);
      const words = new Uint32Array(await gpu.read(b));
      const first = alignment / 4;
      expect([...words.subarray(0, first)].every((v) => v === 0)).toBe(true);
      expect([...words.subarray(first, first + 16)]).toEqual(
        Array.from({ length: 16 }, (_, i) => i + 1),
      );
      expect([...words.subarray(first + 16)].every((v) => v === 0)).toBe(true);
      await gpu.drain();
      expect(gpu.failure()).toBeNull();
      gpu.releaseStage('A');
    });
  });

  describe('closure-table textures', () => {
    it('binds an r32float texture that a kernel reads with textureLoad', async () => {
      // Closure tables are f32 textures read with textureLoad and interpolated in the kernel
      // (rule 10); here the kernel does the bilinear interpolation of a 4 x 3 table at the
      // centre of each cell of four texels, which the CPU computes as their mean.
      const w = 4;
      const h = 3;
      const table = new Float32Array(w * h);
      for (let i = 0; i < table.length; i++) table[i] = 0.25 * ((i * 7) % 11) - 1;
      const texture = gpu.device.createTexture({
        size: [w, h],
        format: 'r32float',
        usage: 0x04 | 0x02, // TEXTURE_BINDING | COPY_DST
      });
      gpu.device.queue.writeTexture({ texture }, table, { bytesPerRow: 4 * w }, [w, h]);
      const kernel = await gpu.kernel({
        name: 'table-read',
        wgsl: `
@group(0) @binding(0) var table: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x % ${w - 1}u);
  let y = i32(gid.x / ${w - 1}u);
  if (y >= ${h - 1}) { return; }
  let a = textureLoad(table, vec2<i32>(x, y), 0).r;
  let b = textureLoad(table, vec2<i32>(x + 1, y), 0).r;
  let c = textureLoad(table, vec2<i32>(x, y + 1), 0).r;
  let d = textureLoad(table, vec2<i32>(x + 1, y + 1), 0).r;
  out[gid.x] = 0.5 * (0.5 * (a + b) + 0.5 * (c + d));
}`,
        entry: 'main',
        bindings: [
          { group: 0, binding: 0, name: 'table', kind: 'texture' },
          { group: 0, binding: 1, name: 'out', kind: 'storage' },
        ],
        uses: ['addmul'],
        reads: ['table'],
        writes: ['out'],
        atomics: [],
      });
      const cells = (w - 1) * (h - 1);
      const out = gpu.buffer({
        name: 'table.out',
        owner: 'test',
        stage: 'A',
        bytes: 4 * cells,
        usage: U32,
        fields: [{ name: 'x', type: 'f32', role: 'statistic', unit: '1' }],
      });
      await gpu.run([
        {
          op: 'dispatch',
          kernel,
          bindings: { table: { texture: texture.createView() }, out },
          workgroups: [cells, 1, 1],
          plannedTime: 0,
        },
      ]);
      const got = new Float32Array(await gpu.read(out));
      for (let i = 0; i < cells; i++) {
        const x = i % (w - 1);
        const y = Math.floor(i / (w - 1));
        const at = (xx: number, yy: number): number => table[yy * w + xx] as number;
        // The table values are multiples of 0.25, so the mean of four is exact in f32.
        expect(got[i]).toBe((at(x, y) + at(x + 1, y) + at(x, y + 1) + at(x + 1, y + 1)) / 4);
      }
      // A buffer where the texture belongs is refused by the wrapper itself.
      expect(() =>
        gpu.submit([
          {
            op: 'dispatch',
            kernel,
            bindings: { table: out, out },
            workgroups: [1, 1, 1],
            plannedTime: 0,
          },
        ]),
      ).toThrow(/takes a texture/);
      texture.destroy();
      gpu.releaseStage('A');
    });
  });

  describe('double-buffered accumulators', () => {
    it('swaps current and next and clears the new next, in batch order', async () => {
      // A deposit kernel adds (i + 1) to every word of its target with atomicAdd.
      const kernel = await gpu.kernel({
        name: 'deposit',
        wgsl: `
@group(0) @binding(0) var<storage, read_write> acc: array<atomic<u32>>;
@compute @workgroup_size(8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= 8u) { return; }
  atomicAdd(&acc[gid.x], gid.x + 1u);
}`,
        entry: 'main',
        bindings: [{ group: 0, binding: 0, name: 'acc', kind: 'storage' }],
        uses: ['atomics'],
        reads: [],
        writes: [],
        atomics: ['acc'],
      });
      const pair = gpu.accumulators({
        name: 'deposit',
        owner: 'test',
        stage: 'G',
        bytes: 32,
        usage: U32,
        fields: [{ name: 'mass', type: 'u32', role: 'accumulator', unit: 'kg', bound: 1e6 }],
      });
      expect([pair.current.name, pair.next.name]).toEqual(['deposit.a', 'deposit.b']);
      const a = pair.current;
      const b = pair.next;
      const deposit = (into: 'current' | 'next'): BatchOp => ({
        op: 'dispatch',
        kernel,
        bindings: { acc: pair[into] },
        workgroups: [1, 1, 1],
        plannedTime: 0,
      });
      // Step 1: two writers for this step, three for the next. Then the swap, inside the batch.
      const batch: BatchOp[] = [
        deposit('current'),
        deposit('current'),
        deposit('next'),
        deposit('next'),
        deposit('next'),
      ];
      gpu.swapAccumulators(pair, batch);
      expect(pair.current).toBe(b);
      expect(pair.next).toBe(a);
      // Step 2: one more writer of the step that is now current.
      batch.push(deposit('current'));
      await gpu.run(batch);
      const base = Array.from({ length: 8 }, (_, i) => i + 1);
      // b received 3 deposits before the swap and 1 after; a received 2 and was then cleared.
      expect([...new Uint32Array(await gpu.read(b))]).toEqual(base.map((v) => 4 * v));
      expect([...new Uint32Array(await gpu.read(a))]).toEqual(base.map(() => 0));
      // Without a batch the swap clears at once.
      gpu.swapAccumulators(pair);
      expect(pair.current).toBe(a);
      expect([...new Uint32Array(await gpu.read(b))]).toEqual(base.map(() => 0));
      gpu.releaseStage('G');
    });
  });
});

describe.skipIf(ctx === null)('contexts of one process', () => {
  it('share one Dawn instance, and destroying one context leaves the other working', async () => {
    // Each context made used to create and pin a Dawn instance of its own.
    expect(nodeGpuEntry().gpu).toBe(nodeGpuEntry().gpu);
    expect(nodeGpuEntry(['enable-dawn-features=allow_unsafe_apis']).gpu).not.toBe(
      nodeGpuEntry().gpu,
    );
    const first = await createGpuContext({ entry: nodeGpuEntry(), sim: '0.0.0', physics: 'none' });
    const second = await createGpuContext({ entry: nodeGpuEntry(), sim: '0.0.0', physics: 'none' });
    const make = (gpu: GpuContext): ReturnType<GpuContext['buffer']> => {
      const b = gpu.buffer({
        name: 'w',
        owner: 'test',
        stage: 'A',
        bytes: 4000,
        usage: U32,
        fields: WORD,
      });
      gpu.write(b, new Uint32Array(1000).fill(3));
      return b;
    };
    const a = make(first);
    const b = make(second);
    const spec = { strideBytes: 4, fields: [{ offsetBytes: 0, type: 'u32' as const }] };
    expect((await first.reduceI64(a, spec))[0]).toBe(3000n);
    first.destroy();
    expect((await second.reduceI64(b, spec))[0]).toBe(3000n);
    expect(second.failure()).toBeNull();
    // A third context after a destroy still gets a device from the shared instance.
    const third = await createGpuContext({ entry: nodeGpuEntry(), sim: '0.0.0', physics: 'none' });
    expect((await third.reduceI64(make(third), spec))[0]).toBe(3000n);
    third.destroy();
    second.destroy();
  });
});

describe.skipIf(ctx === null)('failures of the device', () => {
  it('turns a WebGPU validation error into a failure that drain reports', async () => {
    const failures: string[] = [];
    const seen = await createGpuContext({
      entry: nodeGpuEntry(),
      sim: 'x',
      physics: 'none',
      onFailure: (f) => failures.push(f.kind),
    });
    // A uniform block bound to a buffer that has no uniform usage: WebGPU refuses the bind
    // group, which the wrapper cannot know in advance.
    const kernel = await seen.kernel({
      name: 'needs-uniform',
      wgsl: `struct P { a: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> out: array<u32>;
@compute @workgroup_size(1) fn main() { out[0] = p.a; }`,
      entry: 'main',
      bindings: [
        { group: 0, binding: 0, name: 'p', kind: 'uniform' },
        { group: 0, binding: 1, name: 'out', kind: 'storage' },
      ],
      uses: [],
      reads: ['p'],
      writes: ['out'],
      atomics: [],
    });
    const notUniform = seen.buffer({
      name: 'p',
      owner: 'test',
      stage: 'A',
      bytes: 16,
      usage: U32,
      fields: WORD,
    });
    const out = seen.buffer({
      name: 'out',
      owner: 'test',
      stage: 'A',
      bytes: 16,
      usage: U32,
      fields: WORD,
    });
    expect(seen.failure()).toBeNull();
    seen.submit([
      {
        op: 'dispatch',
        kernel,
        bindings: { p: notUniform, out },
        workgroups: [1, 1, 1],
        plannedTime: 0,
      },
    ]);
    await expect(seen.drain()).rejects.toBeInstanceOf(GpuInfrastructureError);
    expect(seen.failure()?.kind).toBe('validation');
    expect(failures).toEqual(['validation']);
    // A read after the failed commands is refused too, not answered with whatever is there.
    await expect(seen.read(out)).rejects.toBeInstanceOf(GpuInfrastructureError);
    // A failed context stays failed: later calls reject or throw, nothing continues silently.
    await expect(seen.drain()).rejects.toBeInstanceOf(GpuInfrastructureError);
    expect(() => seen.submit([])).toThrow(GpuInfrastructureError);
    await expect(seen.kernel(manyBuffers(1))).rejects.toBeInstanceOf(GpuInfrastructureError);
    seen.destroy();
  });

  it('fails a read-back that follows an invalid command, without any drain', async () => {
    const own = await tryCreateNodeGpuContext();
    if (own === null) return;
    const a = own.buffer({
      name: 'a',
      owner: 'test',
      stage: 'A',
      bytes: 16,
      usage: U32,
      fields: WORD,
    });
    const b = own.buffer({
      name: 'b',
      owner: 'test',
      stage: 'A',
      bytes: 16,
      usage: U32,
      fields: WORD,
    });
    own.write(a, Uint32Array.of(1, 2, 3, 4));
    // The raw buffer is destroyed behind the wrapper's back, so the copy cannot be encoded
    // validly; the wrapper learns of it only through the error scope.
    a.gpu.destroy();
    own.submit([{ op: 'copy', from: a, to: b }]);
    await expect(own.read(b)).rejects.toThrow(/validation/);
    expect(own.failure()?.kind).toBe('validation');
    own.destroy();
  });

  it('reports an error outside every scope (an uncaptured error) as a failure', async () => {
    const own = await tryCreateNodeGpuContext();
    if (own === null) return;
    // Something the wrapper does not guard: a texture of size zero made on the raw device.
    own.device.createTexture({ size: [0, 0], format: 'r32float', usage: 4 });
    await expect(own.drain()).rejects.toThrow(/uncaptured-error/);
    expect(own.failure()?.kind).toBe('uncaptured-error');
    own.destroy();
  });

  it('reports the loss of the device as a failure', async () => {
    const own = await tryCreateNodeGpuContext();
    if (own === null) return;
    // Destroying the device behind the wrapper's back is how a loss looks from inside.
    own.device.destroy();
    await expect(own.drain()).rejects.toThrow(/device-lost/);
    expect(own.failure()?.kind).toBe('device-lost');
    const b = () =>
      own.buffer({ name: 'late', owner: 'test', stage: 'A', bytes: 16, usage: U32, fields: WORD });
    expect(b).toThrow(GpuInfrastructureError);
  });

  it('refuses a registration beyond the memory ceiling', async () => {
    const own = await tryCreateNodeGpuContext({ maxLiveBytes: 1024 });
    if (own === null) return;
    const make = (name: string, bytes: number) =>
      own.buffer({ name, owner: 'test', stage: 'A', bytes, usage: U32, fields: WORD });
    const first = make('first', 1000);
    expect(() => make('second', 28)).toThrow(/past the ceiling of 1024/);
    own.release(first);
    make('second', 1024);
    expect(own.stats.peakBytes).toBe(1024);
    own.destroy();
  });
});
