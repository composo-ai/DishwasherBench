/**
 * Benchmark: one whole wash of the owner's machine with a full load, cold and then with a
 * changed soil parameter (the replay a calibration step costs).
 *
 *   pnpm --filter @spotless/sim-core exec tsx bench/full-load-wash.ts [fast|official] [cacheDir]
 *
 * The load is the lattice of 114 catalogue items that the scene's own full-load benchmark uses
 * (`packages/sim-scene/src/testing/full-load.ts`, reached by a relative path because it is a
 * test helper, not part of that package's interface): placed without the loading physics, so
 * the figures describe cost, not a valid placement. Every item carries its catalogue's typical
 * soils on half of each typical region at the typical loading.
 *
 * Prints the timings of `wash` per stage, the counts, the size of the exposure cache and the
 * resident memory; writes nothing but the cache.
 */

import { readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSoil, instantiate } from '@spotless/catalogue';
import { BOSCH_SMV4HAX40G, primaryProgramme } from '@spotless/machine';
import type { ItemSoilRecord } from '@spotless/sim-scene';
import { fullLoad } from '../../sim-scene/src/testing/full-load.ts';
import { createDiskExposureCache } from '../src/node/index.ts';
import { wash, type WashInput, type WashItemInput } from '../src/index.ts';

const tier = process.argv[2] === 'official' ? 'official' : 'fast';
const cacheDir = process.argv[3] ?? join(tmpdir(), `spotless-bench-cache-${tier}-${process.pid}`);

const load = fullLoad();
const items: WashItemInput[] = load.input.items.map((item) => {
  const instance = instantiate(item.typeId);
  const bySoil = new Map<string, string[]>();
  for (const typical of instance.type.typicalSoils) {
    const regions = bySoil.get(typical.soil) ?? [];
    if (!regions.includes(typical.region)) regions.push(typical.region);
    bySoil.set(typical.soil, regions);
  }
  const soils: ItemSoilRecord[] = [...bySoil.entries()].map(([soilId, regions]) => {
    const area = regions.reduce((sum, region) => sum + (instance.regionAreas[region] ?? 0), 0);
    return {
      type: soilId,
      regions: regions.map((region) => ({ region, coverage: 0.5 })),
      amount_g: getSoil(soilId).loading.typicalGPerM2 * area * 0.5,
      age_h: 2,
      heat_history: 'none',
    };
  });
  return { itemId: item.itemId, typeId: item.typeId, pose: item.pose, soils };
});
const input: WashInput = {
  machine: BOSCH_SMV4HAX40G,
  programme: primaryProgramme(BOSCH_SMV4HAX40G),
  items,
  tier,
  levelSeed: 1,
  simSeed: 1,
};

function report(label: string, result: Awaited<ReturnType<typeof wash>>, wall: number): void {
  const t = result.run.timings_ms;
  const clean = result.items.filter((item) => item.clean).length;
  console.log(`\n${label}: ${(wall / 1000).toFixed(1)} s wall`);
  console.log(
    `  ${Object.entries(t)
      .map(([stage, ms]) => `${stage} ${(ms / 1000).toFixed(2)} s`)
      .join(', ')}`,
  );
  console.log(
    `  ${result.run.blocks} blocks, ${result.run.soilCells} soil cells, ${result.run.deposits} deposits, ${result.machine.ticks} ticks; ` +
      `exposure ${result.run.exposureCacheHits} cached / ${result.run.exposureComputed} computed; scene ${result.run.sceneReused ? 'reused' : 'built'}`,
  );
  console.log(
    `  ${clean} of ${result.items.length} items clean; soil ${(result.machine.soil.remaining_mg / 1000).toFixed(1)} g left of ${(result.machine.soil.initial_mg / 1000).toFixed(1)} g; ` +
      `held water ${result.machine.heldWater_mL.toFixed(0)} mL; problems ${result.problems.length}; machine ${result.machine.timelineProblems.length}`,
  );
  console.log(
    `  rss ${(process.memoryUsage().rss / 2 ** 30).toFixed(2)} GB; result ${result.provenance.resultHash.slice(0, 23)}`,
  );
}

console.log(`full-load wash, tier ${tier}, ${items.length} items, cache ${cacheDir}`);
const cache = createDiskExposureCache(cacheDir);
let start = performance.now();
const cold = await wash(input, { cache });
report('cold (scene, exposure and replay)', cold, performance.now() - start);

start = performance.now();
const replayed = await wash({ ...input, params: { 'soil.egg_yolk.rateRef': 4e-5 } }, { cache });
report('changed soil parameter (cached exposure, scene kept)', replayed, performance.now() - start);

let bytes = 0;
for (const name of readdirSync(cacheDir)) bytes += statSync(join(cacheDir, name)).size;
console.log(
  `\nexposure cache: ${readdirSync(cacheDir).length} files, ${(bytes / 2 ** 20).toFixed(1)} MB`,
);
for (const problem of cold.problems.slice(0, 8)) console.log(`  problem: ${problem}`);
if (cold.problems.length > 8) console.log(`  ... ${cold.problems.length - 8} more`);
for (const problem of cold.machine.timelineProblems.slice(0, 4))
  console.log(`  machine: ${problem}`);
