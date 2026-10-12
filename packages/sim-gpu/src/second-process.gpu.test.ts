// Acceptance test `second-process` at the level of module M1 (docs/design/sim-core.md section
// 6): the same kernels run in a fresh process give the same hashes as in this one. The stencil
// hash is also the one the GPU spike measured, so three independent runs are compared.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { spikeHashHex } from './hash.ts';
import { tryCreateNodeGpuContext } from './node/index.ts';
import { runProbes } from './probes.ts';
import { runStencil, STENCIL_SPIKE_HASH } from './testing/index.ts';
import { OP_CLASSES } from './types.ts';

const ctx = await tryCreateNodeGpuContext();
afterAll(() => ctx?.destroy());

describe.skipIf(ctx === null)('a second process', () => {
  it('reproduces the stencil hash and every probe hash of this process', async () => {
    const gpu = ctx as NonNullable<typeof ctx>;
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(packageRoot, 'scripts', 'child-hashes.ts')],
      { cwd: packageRoot, encoding: 'utf8', timeout: 150_000 },
    );
    expect(child.status, child.stderr).toBe(0);
    const line = child.stdout.trim().split('\n').pop() ?? '';
    const theirs = JSON.parse(line) as { stencil: string; probes: Record<string, string> };

    const stencil = spikeHashHex(await runStencil(gpu, { w: 1024, h: 1024, steps: 200 }));
    const record = await runProbes(gpu);
    expect(theirs.stencil).toBe(STENCIL_SPIKE_HASH);
    expect(theirs.stencil).toBe(stencil);
    for (const op of OP_CLASSES) expect(theirs.probes[op], op).toBe(record.probes[op].hash);
    expect(Object.keys(theirs.probes).sort()).toEqual([...OP_CLASSES].sort());
  }, 180_000);
});
