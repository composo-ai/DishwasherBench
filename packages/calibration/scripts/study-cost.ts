/**
 * Study: what one evaluation of the objective costs (docs/calibration/fitting.md section 4).
 *
 *   pnpm --filter @spotless/calibration study:cost [fast|official]
 *
 * For a record of ten test tiles and for the full load of 114 items: the preparation (scene and
 * exposure, cold and from the cache), and one replay-time evaluation at a new soil parameter,
 * best of three, with every restriction the evaluator offers. Other work may be running on the
 * machine: the best of three is reported, with all three beside it.
 */

import {
  createCalibrationParams,
  prepareRecord,
  textTable,
  type EvaluatorOptions,
  type WashRecord,
} from '../src/index.ts';
import { diskExposureCache } from '../src/node/index.ts';
import { bestOf, fullLoadRecord, STUDY_CACHE, tenTiles } from './study-loads.ts';

const tier = process.argv.includes('official') ? 'official' : 'fast';
const cache = diskExposureCache(STUDY_CACHE);
const rows: string[][] = [
  [
    'record',
    'restriction',
    'items replayed',
    'deposits',
    'observations',
    'prepare s',
    'of which exposure s',
    'one evaluation ms (best of 3)',
    'all three ms',
    'M deposit-ticks/s',
  ],
];

async function measure(
  label: string,
  record: WashRecord,
  options: EvaluatorOptions,
  how: string,
): Promise<void> {
  const withTier: WashRecord = { ...record, sim: { ...record.sim, tier } };
  const start = performance.now();
  const prepared = await prepareRecord(withTier, createCalibrationParams(), { cache, ...options });
  const prepare = (performance.now() - start) / 1000;
  let k = 0;
  const timing = await bestOf(3, async () => {
    k++;
    return prepared.evaluate(
      createCalibrationParams({
        'soil.egg_yolk.rateRef': 3e-5 * (1 + 0.01 * k + Math.random() * 1e-3),
      }),
    );
  });
  rows.push([
    label,
    how,
    `${prepared.info.itemsReplayed} of ${prepared.info.items}`,
    String(prepared.info.deposits),
    String(prepared.observations.length),
    prepare.toFixed(1),
    ((prepared.info.timings_ms['exposure'] ?? 0) / 1000).toFixed(1),
    timing.ms.toFixed(0),
    timing.all.map((ms) => ms.toFixed(0)).join(' / '),
    ((prepared.info.deposits * prepared.info.ticks) / timing.ms / 1000).toFixed(0),
  ]);
  console.log(
    `${label} (${how}): prepared in ${prepare.toFixed(1)} s (${JSON.stringify(Object.fromEntries(Object.entries(prepared.info.timings_ms).map(([key, ms]) => [key, Math.round(ms)])))}); ` +
      `exposure ${prepared.info.exposureCacheHits} cached / ${prepared.info.exposureComputed} computed${prepared.info.exposureStandIn ? ' (stand-in)' : ''}; ` +
      `${prepared.info.blocks} blocks, ${prepared.info.soilCells} soil cells, ${prepared.info.ticks} ticks; one evaluation ${timing.ms.toFixed(0)} ms`,
  );
  console.log(`  ${prepared.info.restriction}`);
}

console.log(`cost of one evaluation, tier ${tier}; exposure cache ${STUDY_CACHE}`);
const tiles = tenTiles({
  id: `cost-tiles-${tier}`,
  at_s: [1500, 2400, 3600],
  interruptedKinds: ['area_fraction'],
});
await measure('ten tiles, 50 mm discs', tiles, {}, 'all (nothing else is soiled)');
await measure('ten tiles, 50 mm discs', tiles, { thin: 4 }, 'one soil cell in 4');
await measure(
  'ten tiles, 20 mm discs',
  tenTiles({
    id: `cost-tiles-small-${tier}`,
    disc_mm: 20,
    amount_g: 0.035,
    at_s: [1500, 2400, 3600],
    interruptedKinds: ['area_fraction'],
  }),
  {},
  'all',
);

const full = fullLoadRecord({ id: `cost-full-${tier}`, kinds: ['clean', 'area_fraction'], tier });
await measure('full load, every item observed', full, {}, 'all (every item is observed)');
await measure('full load, every item observed', full, { thin: 4 }, 'one soil cell in 4');
const ten = fullLoadRecord({
  id: `cost-full-ten-${tier}`,
  kinds: ['clean', 'area_fraction'],
  observe: (_, i) => i % 12 === 0,
  tier,
});
await measure('full load, 10 items observed', ten, {}, 'observed items, the rest as background');
await measure('full load, 10 items observed', ten, { restrict: 'all' }, 'all (no restriction)');

console.log('');
console.log(textTable(rows, [3, 4, 5, 6, 7, 9]));
