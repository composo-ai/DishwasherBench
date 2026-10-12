// What a read, a reduction and the guard see, and what the wait path costs (module M1,
// docs/design/sim-core.md section M1; section 6: "the same result whether the caches are cold
// or warm"; rule 5: reductions feed branches and ledgers).
//
// A caller may pipeline: ask for a ledger, submit the next step, then await the ledger. The
// answer must be that of the buffer as it was at the call, never of later work, and must not
// depend on whether a pipeline had been compiled before. Every test here submits conflicting
// work right after the call and before the await; expected values are the known contents at the
// call.
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { hashU32 } from '@spotless/core';
import { afterAll, describe, expect, it } from 'vitest';
import { tryCreateNodeGpuContext } from './node/device.ts';
import type { FieldDef, GpuContext, ManagedBuffer, ReduceSpec } from './types.ts';
import { BUFFER_USAGE } from './usage.ts';

const ctx = await tryCreateNodeGpuContext();
afterAll(() => ctx?.destroy());

const ONE_U32: ReduceSpec = { strideBytes: 4, fields: [{ offsetBytes: 0, type: 'u32' }] };
const NAN_BITS = 0x7fc00000;

let serial = 0;
function words(
  gpu: GpuContext,
  n: number,
  fill: number,
  type: 'u32' | 'f32' = 'u32',
  usage: number = BUFFER_USAGE.STORAGE,
): ManagedBuffer {
  const fields: FieldDef[] = [{ name: 'v', type, role: 'state', unit: '1' }];
  const b = gpu.buffer({
    name: `call-time-${serial++}`,
    owner: 'test',
    stage: 'A',
    bytes: 4 * n,
    usage,
    fields,
  });
  gpu.write(b, new Uint32Array(n).fill(fill));
  return b;
}

describe.skipIf(ctx === null)('results are those of the state at the call', () => {
  const gpu = ctx as GpuContext;
  const n = 1000;

  it('read: a clear submitted after the call is not seen', async () => {
    const b = words(gpu, n, 7);
    const pending = gpu.read(b);
    gpu.submit([{ op: 'clear', buffer: b }]);
    expect(new Uint32Array(await pending).every((w) => w === 7)).toBe(true);
    // And the clear did happen: the next read sees zeros.
    expect(new Uint32Array(await gpu.read(b)).every((w) => w === 0)).toBe(true);
    gpu.release(b);
  });

  it('reduceI64 and reduceI64By: a clear or an upload after the call is not included', async () => {
    const b = words(gpu, n, 3);
    const whole = gpu.reduceI64(b, ONE_U32);
    gpu.submit([{ op: 'clear', buffer: b }]);
    expect((await whole)[0]).toBe(3n * BigInt(n));
    expect((await gpu.reduceI64(b, ONE_U32))[0]).toBe(0n);

    gpu.write(b, new Uint32Array(n).fill(5));
    const offsets = Uint32Array.of(0, 100, 100, n);
    const bySegment = gpu.reduceI64By(b, ONE_U32, offsets);
    gpu.write(b, new Uint32Array(n).fill(1000));
    gpu.submit([{ op: 'clear', buffer: b }]);
    expect([...(await bySegment)]).toEqual([500n, 0n, 5n * BigInt(n - 100)]);
    gpu.release(b);
  });

  it('reduceI64: the same when the conflicting work comes a macrotask later', async () => {
    // Before the kernels were compiled with the context, this case gave 0 on a cold pipeline
    // cache and the right sum on a warm one.
    const b = words(gpu, n, 1);
    const pending = gpu.reduceI64(b, ONE_U32);
    await new Promise((resolve) => setTimeout(resolve, 0));
    gpu.submit([{ op: 'clear', buffer: b }]);
    expect((await pending)[0]).toBe(BigInt(n));
    gpu.release(b);
  });

  it('the first reduction and the first guard call of a fresh context behave the same', async () => {
    const fresh = await tryCreateNodeGpuContext();
    if (fresh === null) throw new Error('no adapter for a second context');
    try {
      const compiled = fresh.stats.pipelinesCompiled;
      const b = words(fresh, n, 2);
      const f = words(fresh, n, NAN_BITS, 'f32');
      const sum = fresh.reduceI64(b, ONE_U32);
      const bySegment = fresh.reduceI64By(b, ONE_U32, Uint32Array.of(0, 10, n));
      const bad = fresh.nonFiniteCount([f]);
      fresh.submit([
        { op: 'clear', buffer: b },
        { op: 'clear', buffer: f },
      ]);
      expect((await sum)[0]).toBe(2n * BigInt(n));
      expect([...(await bySegment)]).toEqual([20n, 2n * BigInt(n - 10)]);
      expect(await bad).toBe(n);
      // Nothing was compiled on demand: the kernels came with the context.
      expect(fresh.stats.pipelinesCompiled).toBe(compiled);
    } finally {
      fresh.destroy();
    }
  });

  it('nonFiniteCount: every buffer is examined as it was at the call', async () => {
    const a = words(gpu, n, NAN_BITS, 'f32');
    const b = words(gpu, n, 0, 'f32');
    const c = words(gpu, 3 * n, 0x7f800000, 'f32');
    const pending = gpu.nonFiniteCount([a, b, c]);
    // The first buffer is cleaned, the second and third are spoiled, all after the call.
    gpu.submit([{ op: 'clear', buffer: a }]);
    gpu.write(b, new Uint32Array(n).fill(NAN_BITS));
    gpu.submit([{ op: 'clear', buffer: c }]);
    expect(await pending).toBe(n + 0 + 3 * n);
    expect(await gpu.nonFiniteCount([a, b, c])).toBe(0 + n + 0);
    gpu.releaseStage('A');
  });

  it('leaves no scratch buffers behind, also after an argument error', async () => {
    const b = words(gpu, n, 1);
    const before = gpu.stats.liveBuffers;
    await gpu.reduceI64(b, ONE_U32);
    await gpu.reduceI64By(b, ONE_U32, Uint32Array.of(0, n));
    await gpu.nonFiniteCount();
    await expect(gpu.reduceI64(b, { strideBytes: 6, fields: ONE_U32.fields })).rejects.toThrow(
      RangeError,
    );
    await expect(gpu.reduceI64By(b, ONE_U32, Uint32Array.of(0, n + 1))).rejects.toThrow(/beyond/);
    expect(gpu.stats.liveBuffers).toBe(before);
    gpu.release(b);
  });
});

describe.skipIf(ctx === null)('reads in flight together, and large transfers', () => {
  const gpu = ctx as GpuContext;

  it('serves concurrent reads of different buffers, each with its own contents', async () => {
    const sizes = [1000, 70_000, 3, 20_000, 1];
    const buffers = sizes.map((n, i) => words(gpu, n, 100 + i));
    const pending = buffers.map((b) => gpu.read(b));
    // Work submitted while all five reads are in flight must not reach any of them.
    gpu.submit(buffers.map((buffer) => ({ op: 'clear', buffer }) as const));
    const results = await Promise.all(pending);
    results.forEach((bytes, i) => {
      const got = new Uint32Array(bytes);
      expect(got.length).toBe(sizes[i]);
      expect(
        got.every((w) => w === 100 + i),
        `buffer ${i}`,
      ).toBe(true);
    });
    // A partial read and a whole read of one buffer together.
    gpu.write(
      buffers[1] as ManagedBuffer,
      Uint32Array.from({ length: 70_000 }, (_, i) => i),
    );
    const [part, whole] = await Promise.all([
      gpu.read(buffers[1] as ManagedBuffer, 4 * 69_000, 8),
      gpu.read(buffers[1] as ManagedBuffer),
    ]);
    expect([...new Uint32Array(part)]).toEqual([69_000, 69_001]);
    expect(new Uint32Array(whole)[69_999]).toBe(69_999);
    gpu.releaseStage('A');
  });

  it('uploads and reads back more than one 64 MiB chunk unchanged', async () => {
    // 68 MiB: above the upload chunk and above the size of staging buffer that is kept.
    const n = (68 * 2 ** 20) / 4;
    const data = new Uint32Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.imul(i, 0x9e3779b1) >>> 0;
    // Hashed spot values instead of the multiplicative pattern at a few places, including the
    // chunk boundary, so that a chunk written at the wrong offset cannot go unnoticed.
    const boundary = (64 * 2 ** 20) / 4;
    for (const at of [0, boundary - 1, boundary, boundary + 1, n - 1]) data[at] = hashU32(9, at);
    const b = gpu.buffer({
      name: 'call-time-large',
      owner: 'test',
      stage: 'A',
      bytes: 4 * n,
      usage: BUFFER_USAGE.STORAGE,
      fields: [{ name: 'v', type: 'u32', role: 'static', unit: '-' }],
    });
    gpu.write(b, data);
    const back = new Uint32Array(await gpu.read(b));
    expect(back.length).toBe(n);
    let mismatches = 0;
    for (let i = 0; i < n; i++) if (back[i] !== data[i]) mismatches++;
    expect(mismatches).toBe(0);
    // A small read afterwards still works (the large staging buffer was dropped).
    expect(new Uint32Array(await gpu.read(b, 4 * boundary, 4))[0]).toBe(hashU32(9, boundary));
    gpu.release(b);
  }, 30_000);
});

describe.skipIf(ctx === null)('the wait path keeps nothing per call', () => {
  const gpu = ctx as GpuContext;

  it('does not grow the JS heap over 20,000 drains and 2,000 reads', async () => {
    // Each drain or read used to leave about 1 kB reachable from the context for its whole
    // life (a reaction on one long-lived promise): 22 MB here. The bound is 4 MB; what a
    // correct wait path leaves is zero, and the rest is noise of the test runner's own heap.
    setFlagsFromString('--expose-gc');
    const collect = runInNewContext('gc') as () => void;
    const used = (): number => {
      collect();
      collect();
      return process.memoryUsage().heapUsed;
    };
    const b = words(gpu, 16, 1);
    for (let i = 0; i < 200; i++) await gpu.drain();
    const before = used();
    for (let i = 0; i < 20_000; i++) await gpu.drain();
    for (let i = 0; i < 2_000; i++) await gpu.read(b, 0, 4);
    const grown = used() - before;
    expect(grown).toBeLessThan(4 * 2 ** 20);
    gpu.release(b);
  }, 60_000);
});
