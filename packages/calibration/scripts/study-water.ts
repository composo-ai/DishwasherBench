/**
 * Study: a parameter of the water model in the outer loop (docs/calibration/fitting.md
 * section 9.4).
 *
 *   pnpm --filter @spotless/calibration exec tsx scripts/study-water.ts [key truth]
 *
 * Ten tiles of five soils are weighed at three door openings and at the end. A synthetic
 * record is drawn with one closure of the water model moved (by default the share of a jet
 * that splatters, `jets.kS`, the only one of ten water parameters these tiles see: section
 * 9.4) and with the egg-yolk rate moved, and both are fitted from their defaults: the water
 * parameter in the outer loop (every value a new exposure), the rate at replay time. The
 * script prints how many exposures the outer loop asked for, how long they took, and what came
 * back; and first the check of whether the replay-time scale `cal.jetShearScale` could stand
 * in for `jets.kStag`.
 */

import {
  checkReplayScale,
  createCalibrationParams,
  EvaluatorPool,
  fitWithWaterParameters,
  fmt,
  sensitivity,
  synthesiseRecord,
} from '../src/index.ts';
import { diskExposureCache } from '../src/node/index.ts';
import { STUDY_CACHE, tenTiles } from './study-loads.ts';

const cache = diskExposureCache(STUDY_CACHE);
const waterKey = process.argv[2] ?? 'jets.kS';
const waterTruth = Number(process.argv[3] ?? 0.85);
const plan = tenTiles({
  id: 'water-tiles',
  soils: ['egg_yolk_dried', 'tomato_sauce', 'porridge', 'butter_margarine', 'tea_tannin'],
  disc_mm: 30,
  amount_g: 0.076,
  kinds: ['mass_fraction'],
  at_s: [1500, 2400, 3600],
});

console.log('===== can the replay-time scale stand in for jets.kStag? =====');
// A cache of its own, in memory: both exposures are then computed by the same code.
const check = await checkReplayScale(plan, 'cal.jetShearScale');
console.log(check.summary);

const truthValues: Record<string, number> = {
  [waterKey]: waterTruth,
  'soil.egg_yolk.rateRef': 4.5e-5,
};
const pool = new EvaluatorPool({ cache }, 8);
const record = await synthesiseRecord(plan, createCalibrationParams(truthValues), {
  seed: 5,
  pool,
});

console.log('\n===== what the record says about the two parameters, at the defaults =====');
const local = await sensitivity([record], ['soil.egg_yolk.rateRef', waterKey], { pool });
console.log(local.report.table);

console.log(
  `\n===== outer loop over ${waterKey}, the egg-yolk rate re-fitted at every value =====`,
);
const started = performance.now();
const fit = await fitWithWaterParameters([record], ['soil.egg_yolk.rateRef'], [waterKey], {
  pool,
  rounds: 3,
  starts: 0,
  polish: 0,
  onProgress: (message) => console.error(`  ${message}`),
});
console.log(
  `${fit.exposures} values of ${waterKey}, each a new exposure of the load, in ${((performance.now() - started) / 1000).toFixed(0)} s`,
);
console.log(fit.report.split('\nfit to each observation')[0]);
const water = fit.water[0];
const rate = fit.inner.parameters[0];
console.log(
  `\ntruth: ${waterKey} ${waterTruth}, soil.egg_yolk.rateRef ${fmt(truthValues['soil.egg_yolk.rateRef'] as number)}`,
);
if (water !== undefined && rate !== undefined) {
  const sd = water.sd;
  console.log(
    `found: ${waterKey} ${fmt(water.estimate, 4)}` +
      (sd === null
        ? ' (no curvature found: the record does not constrain it)'
        : ` (deviation ${fmt(sd, 3)} in its fitted coordinate, against ${fmt(local.jacobian.parameters[1]?.priorSd ?? 0, 3)} of the prior)`) +
      `, soil.egg_yolk.rateRef ${fmt(rate.estimate, 4)} (${fmt(rate.interval[0])} .. ${fmt(rate.interval[1])})`,
  );
}
