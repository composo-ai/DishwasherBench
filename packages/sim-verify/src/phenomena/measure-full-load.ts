/**
 * Measures a full-load wash: the loader's settled IEC load on the owner's programme, washed
 * cold (no exposure cache, the scene built anew) a number of times at a tier.
 *
 *   pnpm --filter @spotless/sim-verify exec tsx src/phenomena/measure-full-load.ts [--tier fast|official] [--runs 3]
 *
 * Prints, per run, the wall-clock time of every stage of `wash()` and the resident memory of
 * the process at the end of each stage, then the best run (the shortest total) and the peak
 * resident memory of the process. The machine is shared: the best of several runs is the
 * number to quote.
 */

import { PRIMARY_MACHINE, type MachineConfig } from '@spotless/machine';
import {
  createMemoryExposureCache,
  releaseWashScene,
  wash,
  type WashInput,
  type WashStage,
} from '@spotless/sim-core';
import { readLoad } from './loads.ts';
import { programmeOf, SCORED_PROGRAMME } from './programmes.ts';
import type { Tier } from './types.ts';

const args = process.argv.slice(2);
const tierAt = args.indexOf('--tier');
const tier: Tier = tierAt >= 0 && args[tierAt + 1] === 'official' ? 'official' : 'fast';
const runsAt = args.indexOf('--runs');
const runs = runsAt >= 0 ? Math.max(1, Number(args[runsAt + 1])) : 3;

const MB = 1024 * 1024;
const load = readLoad('loader:iec-13-careful');
const input: WashInput = {
  machine: PRIMARY_MACHINE,
  config: load.config as MachineConfig,
  programme: programmeOf(SCORED_PROGRAMME),
  items: load.items,
  tier,
  levelSeed: 1,
  simSeed: 1,
};

let best: { total: number; line: string } | undefined;
for (let run = 1; run <= runs; run++) {
  releaseWashScene();
  const rss = new Map<WashStage, number>();
  const started = performance.now();
  const result = await wash(input, {
    cache: createMemoryExposureCache(),
    keepScene: false,
    onProgress: (p) => {
      rss.set(p.stage, Math.max(rss.get(p.stage) ?? 0, process.memoryUsage().rss));
    },
  });
  const total = (performance.now() - started) / 1000;
  const line =
    `${tier} run ${run}: ${result.items.length} items, ${result.run.blocks} blocks, ${result.run.soilCells} soil cells, ` +
    `total ${total.toFixed(1)} s; ` +
    Object.entries(result.run.timings_ms)
      .map(
        ([stage, ms]) =>
          `${stage} ${(ms / 1000).toFixed(1)} s` +
          (rss.has(stage as WashStage)
            ? ` (${((rss.get(stage as WashStage) ?? 0) / MB).toFixed(0)} MB)`
            : ''),
      )
      .join(', ') +
    `; ${result.provenance.exposureBackend} tracer; result ${result.provenance.resultHash.slice(0, 19)}`;
  console.log(line);
  if (best === undefined || total < best.total) best = { total, line };
}
console.log(`best of ${runs}: ${best?.line ?? ''}`);
// `maxRSS` is in kilobytes.
console.log(
  `peak resident memory of the process: ${(process.resourceUsage().maxRSS / 1024).toFixed(0)} MB`,
);
process.exit(0);
