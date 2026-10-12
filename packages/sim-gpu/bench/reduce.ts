// Benchmark: the exact integer reductions and the non-finite guard of sim-gpu, the per-tick and
// per-stage bookkeeping passes of the simulation (docs/design/sim-core.md section M1).
//
//   pnpm --filter @spotless/sim-gpu run bench:reduce [-- quick]
//
// Writes bench/out/reduce.json with the stack string. Each timing includes the read-back of the
// result, because that is how the passes are used.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashU32 } from '@spotless/core';
import { benchReport, benchResult, measureGpu, type BenchResult } from '../src/bench.ts';
import { BUFFER_USAGE } from '../src/index.ts';
import { acquireBenchLock, createNodeGpuContext, writeBenchReport } from '../src/node/index.ts';

const quick = process.argv.includes('quick');
const lock = await acquireBenchLock();
const ctx = await createNodeGpuContext();
const results: BenchResult[] = [];
const report = (result: BenchResult): void => {
  results.push(result);
  console.log(
    `${result.name}: ${(1000 * result.time.best).toFixed(2)} ms best, ` +
      `${(1000 * result.time.median).toFixed(2)} ms median, ` +
      `${(result.rate.median / 1e9).toFixed(2)} G ${result.unit}/s`,
  );
};

for (const n of quick ? [10_000_000] : [1_000_000, 10_000_000, 100_000_000]) {
  const values = new Uint32Array(n);
  for (let i = 0; i < n; i++) values[i] = hashU32(1, i);
  const words = ctx.buffer({
    name: `bench.words.${n}`,
    owner: 'sim-gpu',
    stage: 'A',
    bytes: 4 * n,
    usage: BUFFER_USAGE.STORAGE,
    fields: [{ name: 'word', type: 'u32', role: 'statistic', unit: '-' }],
  });
  const floats = ctx.buffer({
    name: `bench.floats.${n}`,
    owner: 'sim-gpu',
    stage: 'A',
    bytes: 4 * n,
    usage: BUFFER_USAGE.STORAGE,
    fields: [{ name: 'x', type: 'f32', role: 'state', unit: '1' }],
  });
  ctx.write(words, values);
  ctx.write(floats, new Float32Array(n).fill(1.5));
  const spec = { strideBytes: 4, fields: [{ offsetBytes: 0, type: 'u32' as const }] };
  const segments = Math.max(1, n / 1000);
  const offsets = new Uint32Array(segments + 1);
  for (let s = 0; s <= segments; s++) offsets[s] = Math.round((s * n) / segments);

  report(
    benchResult(
      `reduceI64, ${n} u32`,
      n,
      'elements',
      await measureGpu(ctx, async () => void (await ctx.reduceI64(words, spec))),
    ),
  );
  report(
    benchResult(
      `reduceI64By, ${n} u32 in ${segments} segments`,
      n,
      'elements',
      await measureGpu(ctx, async () => void (await ctx.reduceI64By(words, spec, offsets))),
    ),
  );
  report(
    benchResult(
      `nonFiniteCount, ${n} f32`,
      n,
      'words',
      await measureGpu(ctx, async () => void (await ctx.nonFiniteCount([floats]))),
    ),
  );
  ctx.releaseStage('A');
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'out', 'reduce.json');
console.log(writeBenchReport(out, benchReport('reduce', ctx.stack, results, lock.waited)));
ctx.destroy();
lock.release();
process.exit(0);
