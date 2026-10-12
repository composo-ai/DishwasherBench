/**
 * What a course of liquor does to every soil of the standard load and of the five starter
 * levels, well placed and badly placed (`soilAtPlace` of `src/bench.ts`): each soil at its
 * working loading and usual ageing (the soil data of `@spotless/sim-soil`) on the bench tile,
 * through the liquor table of a wash written by `study.ts` (`liquorOut`).
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/auto-soils.ts <liquor.json> [--params <set.json> ...] [--title text]
 *
 * The liquor is that of the whole wash it was taken from (its dose, its soil load, its course);
 * the parameter sets must be the ones that wash ran with. Prints a markdown table.
 */

import { readFileSync } from 'node:fs';
import { starterLevels } from '@spotless/levels';
import { createWashParams, type ParamValue } from '@spotless/sim-core';
import { BADLY_PLACED, soilAtPlace, WELL_PLACED, type LiquorCourse } from '../src/bench.ts';
import { STD_EU_13_SOILS } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const liquorFile = args[0];
if (liquorFile === undefined)
  throw new RangeError('usage: auto-soils.ts <liquor.json> [--params f]');
let overrides: Record<string, ParamValue> = {};
let title = liquorFile;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--params')
    overrides = { ...overrides, ...readOverrides(args[++i] as string, true) };
  else if (args[i] === '--title') title = args[++i] as string;
}
const params = createWashParams(overrides);
const course = JSON.parse(readFileSync(liquorFile, 'utf8')) as LiquorCourse;

const standard = new Set<string>();
for (const soils of Object.values(STD_EU_13_SOILS))
  for (const s of Object.values(soils)) standard.add(s.type);
const level = new Set<string>();
for (const l of starterLevels())
  for (const item of l.items) for (const s of item.soils) level.add(s.type);

const pct = (v: number): string =>
  v < 0.0005 ? '0' : v < 0.1 ? (100 * v).toFixed(1) : (100 * v).toFixed(0);
console.log(`### ${title}`);
console.log('');
console.log(
  `Places: well placed = wet ${WELL_PLACED.wet} of the time, water exchanged ${WELL_PLACED.exchange} per second, film shear ${WELL_PLACED.filmShear} Pa, a jet film above ${WELL_PLACED.jetShear} Pa for ${100 * WELL_PLACED.jetDuty} % of the time; badly placed = wet ${BADLY_PLACED.wet}, ${BADLY_PLACED.exchange} per second, ${BADLY_PLACED.filmShear} Pa, no jet.`,
);
console.log('');
console.log(
  '| Soil | Used by | Model class | Dry loading (mg/cm2) | Well placed: dry mass left (%) | visibly soiled area (%) | Badly placed: dry mass left (%) | visibly soiled area (%) |',
);
console.log('|---|---|---|---|---|---|---|---|');
for (const id of [...new Set([...standard, ...level])].sort()) {
  const well = soilAtPlace(params, id, WELL_PLACED, course);
  const badly = soilAtPlace(params, id, BADLY_PLACED, course);
  const by = [standard.has(id) ? 'standard load' : '', level.has(id) ? 'starter levels' : '']
    .filter((x) => x !== '')
    .join(', ');
  console.log(
    `| ${id} | ${by} | ${well.modelClass} | ${well.loading_mg_cm2.toPrecision(3)} | ${pct(well.left)} | ${pct(well.visibleShare)} | ${pct(badly.left)} | ${pct(badly.visibleShare)} |`,
  );
}
