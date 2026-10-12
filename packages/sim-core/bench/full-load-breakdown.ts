/**
 * Diagnostic: where the soil of the full-load benchmark wash is left, by soil class and by
 * item type.
 *
 *   pnpm --filter @spotless/sim-core exec tsx bench/full-load-breakdown.ts [fast|official] [cacheDir]
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSoil, instantiate } from '@spotless/catalogue';
import { BOSCH_SMV4HAX40G, primaryProgramme } from '@spotless/machine';
import type { ItemSoilRecord } from '@spotless/sim-scene';
import { fullLoad } from '../../sim-scene/src/testing/full-load.ts';
import { createDiskExposureCache } from '../src/node/index.ts';
import { wash, type WashItemInput } from '../src/index.ts';

const tier = process.argv[2] === 'official' ? 'official' : 'fast';
const cacheDir = process.argv[3] ?? join(tmpdir(), `spotless-bench-cache-${tier}`);
const items: WashItemInput[] = fullLoad().input.items.map((item) => {
  const instance = instantiate(item.typeId);
  const bySoil = new Map<string, string[]>();
  for (const typical of instance.type.typicalSoils) {
    const regions = bySoil.get(typical.soil) ?? [];
    if (!regions.includes(typical.region)) regions.push(typical.region);
    bySoil.set(typical.soil, regions);
  }
  const soils: ItemSoilRecord[] = [...bySoil.entries()].map(([soilId, regions]) => ({
    type: soilId,
    regions: regions.map((region) => ({ region, coverage: 0.5 })),
    amount_g:
      getSoil(soilId).loading.typicalGPerM2 *
      regions.reduce((sum, region) => sum + (instance.regionAreas[region] ?? 0), 0) *
      0.5,
    age_h: 2,
    heat_history: 'none',
  }));
  return { itemId: item.itemId, typeId: item.typeId, pose: item.pose, soils };
});
const result = await wash(
  {
    machine: BOSCH_SMV4HAX40G,
    programme: primaryProgramme(BOSCH_SMV4HAX40G),
    items,
    tier,
    levelSeed: 1,
    simSeed: 1,
  },
  { cache: createDiskExposureCache(cacheDir) },
);

const add = (
  map: Map<string, [number, number, number]>,
  key: string,
  initial: number,
  residual: number,
): void => {
  const entry = map.get(key) ?? [0, 0, 0];
  entry[0] += initial;
  entry[1] += residual;
  entry[2] += 1;
  map.set(key, entry);
};
const byClass = new Map<string, [number, number, number]>();
const bySoil = new Map<string, [number, number, number]>();
const byType = new Map<string, [number, number, number]>();
const scores = new Map<string, number[]>();
for (const item of result.items) {
  add(byType, item.typeId, item.initialMass_mg, item.residualMass_mg);
  scores.set(item.typeId, [...(scores.get(item.typeId) ?? []), item.score]);
  for (const soil of item.soils) {
    add(byClass, soil.modelClass, soil.initialMass_mg, soil.residualMass_mg);
    add(bySoil, `${soil.type} (${soil.modelClass})`, soil.initialMass_mg, soil.residualMass_mg);
  }
}
const print = (title: string, map: Map<string, [number, number, number]>): void => {
  console.log(`\n${title}`);
  for (const [key, [initial, residual, count]] of [...map.entries()].sort()) {
    console.log(
      `  ${key.padEnd(34)} ${String(count).padStart(4)} x  ${(initial / 1000).toFixed(2).padStart(8)} g -> ${(residual / 1000).toFixed(2).padStart(8)} g  (${((100 * residual) / Math.max(initial, 1e-12)).toFixed(0)} % left)`,
    );
  }
};
print('by model class', byClass);
print('by soil', bySoil);
print('by item type', byType);
console.log('\nIEC scores by item type');
for (const [type, list] of [...scores.entries()].sort()) {
  console.log(
    `  ${type.padEnd(34)} ${[0, 1, 2, 3, 4, 5].map((s) => `${s}:${list.filter((x) => x === s).length}`).join(' ')}`,
  );
}
console.log(
  `\nstates: ${result.machine.states.map((s) => `${s.id} wet ${s.exposure.wetArea.toFixed(2)} m2 jetCells ${s.exposure.jetCells}`).join('; ')}`,
);
