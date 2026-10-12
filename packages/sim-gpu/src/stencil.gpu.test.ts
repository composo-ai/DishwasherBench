// The B1 stencil of the GPU spike through this package's wrapper (docs/design/sim-core.md
// section M1, "Tests"): it must reproduce the hash the spike recorded, and the result must not
// change with the workgroup size or with the batching into command buffers (determinism rules
// 4 and 18). The expected hash is the spike's measurement, not something this code produced.
import { afterAll, describe, expect, it } from 'vitest';
import { firstDifferentByte, spikeHashHex } from './hash.ts';
import { tryCreateNodeGpuContext } from './node/device.ts';
import { differingVariants } from './testing/invariance.ts';
import { createStencil, runStencil, STENCIL_SPIKE_HASH } from './testing/stencil.ts';

const ctx = await tryCreateNodeGpuContext();
afterAll(() => ctx?.destroy());

describe.skipIf(ctx === null)('B1 stencil of the spike, 1024 x 1024, 200 steps', () => {
  const gpu = ctx as NonNullable<typeof ctx>;
  const grid = { w: 1024, h: 1024, steps: 200 } as const;
  const baseline = ctx ? runStencil(ctx, grid) : null;

  it(`reproduces the spike's hash ${STENCIL_SPIKE_HASH}`, async () => {
    expect(spikeHashHex(await (baseline as Promise<Uint8Array>))).toBe(STENCIL_SPIKE_HASH);
  });

  it('is bitwise identical with workgroups of 16 x 16 and of 256 x 1', async () => {
    const reference = await (baseline as Promise<Uint8Array>);
    const differing = await differingVariants({
      '8 x 8': () => Promise.resolve(reference),
      '16 x 16': () => runStencil(gpu, { ...grid, wx: 16, wy: 16, name: 'wg16' }),
      '256 x 1': () => runStencil(gpu, { ...grid, wx: 256, wy: 1, name: 'wg256' }),
    });
    expect(differing).toEqual([]);
    // The helper does report a difference when there is one.
    const altered = reference.slice();
    altered[12345] = (altered[12345] as number) ^ 1;
    expect(
      await differingVariants({
        a: () => Promise.resolve(reference),
        b: () => Promise.resolve(altered),
      }),
    ).toEqual([{ name: 'b', firstByte: 12345 }]);
  });

  it('is bitwise identical with one step per command buffer and with all steps in one', async () => {
    const reference = await (baseline as Promise<Uint8Array>);
    // Each step is planned at 1024^2 / 4e9 = 0.26 ms. A bound below that puts every dispatch in
    // its own command buffer; a bound of one second holds all 200.
    const before = gpu.stats.commandBuffers;
    const single = await runStencil(gpu, { ...grid, maxPlannedTime: 1e-4, name: 'k1' });
    const afterSingle = gpu.stats.commandBuffers;
    const whole = await runStencil(gpu, { ...grid, maxPlannedTime: 1, name: 'k200' });
    const afterWhole = gpu.stats.commandBuffers;
    // (Read-backs are not counted as command buffers of the batch.)
    expect(afterSingle - before).toBe(200);
    expect(afterWhole - afterSingle).toBe(1);
    expect(firstDifferentByte(reference, single)).toBe(-1);
    expect(firstDifferentByte(reference, whole)).toBe(-1);
  });

  it('splits a batch by planned time only: 200 steps of 0.26 ms fit one 250 ms buffer', async () => {
    const sim = await createStencil(gpu, { w: 64, h: 64, name: 'plan', planningRate: 64 * 64 });
    try {
      // Planned at one second per step against the default bound of 0.25 s: one per buffer.
      const before = gpu.stats.commandBuffers;
      gpu.submit(sim.steps(5));
      expect(gpu.stats.commandBuffers - before).toBe(5);
      // With a bound of 2.5 s: two steps per buffer, the fifth alone.
      gpu.submit(sim.steps(5), { maxPlannedTime: 2.5 });
      expect(gpu.stats.commandBuffers - before).toBe(5 + 3);
      await gpu.drain();
    } finally {
      sim.release();
    }
  });
});
