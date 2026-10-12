// Benchmark: the spike's B1 stencil through the sim-gpu wrapper, as a check that the wrapper
// costs nothing against the spike's direct WebGPU calls (spike report section 11: 4.0 to 4.2 G
// cell updates per second at 2048 x 2048 on the reference machine).
//
//   pnpm --filter @spotless/sim-gpu run bench:stencil [-- quick]
//
// Writes bench/out/stencil.json with the stack string.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchReport, benchResult, measureGpu, type BenchResult } from '../src/bench.ts';
import { spikeHashHex } from '../src/hash.ts';
import { acquireBenchLock, createNodeGpuContext, writeBenchReport } from '../src/node/index.ts';
import { createStencil, runStencil, STENCIL_SPIKE_HASH } from '../src/testing/index.ts';

const quick = process.argv.includes('quick');
const lock = await acquireBenchLock();
const ctx = await createNodeGpuContext();
const results: BenchResult[] = [];

// Correctness first: a benchmark of a wrong kernel is worth nothing.
const hash = spikeHashHex(await runStencil(ctx, { w: 1024, h: 1024, steps: 200 }));
if (hash !== STENCIL_SPIKE_HASH) {
  throw new Error(`stencil hash ${hash} is not the spike's ${STENCIL_SPIKE_HASH}`);
}

for (const [w, h] of quick
  ? [[2048, 2048]]
  : [
      [1024, 1024],
      [2048, 2048],
      [4096, 4096],
    ]) {
  const cells = (w as number) * (h as number);
  // About one second of work per repeat at the planning rate of 4e9 cell updates per second.
  const steps = Math.max(16, Math.round((quick ? 1e9 : 4e9) / cells));
  for (const [wx, wy] of [
    [8, 8],
    [16, 16],
  ] as const) {
    const sim = await createStencil(ctx, {
      w: w as number,
      h: h as number,
      wx,
      wy,
      name: `bench${w}-${wx}`,
    });
    for (const maxPlannedTime of [0.25, 0.05]) {
      const time = await measureGpu(ctx, () => ctx.run(sim.steps(steps), { maxPlannedTime }), {
        repeats: quick ? 3 : 5,
      });
      const result = benchResult(
        `stencil ${w}x${h}, workgroup ${wx}x${wy}, command buffers of ${1000 * maxPlannedTime} ms planned`,
        cells * steps,
        'cell updates',
        time,
      );
      results.push(result);
      console.log(
        `${result.name}: ${(result.rate.best / 1e9).toFixed(2)} G best, ` +
          `${(result.rate.median / 1e9).toFixed(2)} G median cell updates/s`,
      );
    }
    sim.release();
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'out', 'stencil.json');
console.log(writeBenchReport(out, benchReport('stencil', ctx.stack, results, lock.waited)));
ctx.destroy();
lock.release();
process.exit(0);
