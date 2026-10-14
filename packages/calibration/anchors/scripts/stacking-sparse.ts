/**
 * Two pairs of the phenomena checklist on single plates in an otherwise empty machine, at the
 * fast tier: the eating face towards the spray against turned away (P02), and a plate in the
 * shadow of a frying pan against the same plate in the open (P05). The poses are those of the
 * end-to-end tests of the first build (`packages/sim-verify/src/wash-end-to-end.test.ts`):
 * dessert plates on edge in the lower basket, leaning 20 degrees.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/stacking-sparse.ts
 *        [--params anchors/anchored-v1.json] [--cache <dir>]
 *
 * Wash A: both plates facing the spray, the third plate under the pan.
 * Wash B: both plates turned away, the third plate without the pan.
 * Every plate carries oven-dried IEC egg yolk on its well (the working quantity of a dessert
 * plate) and baked-on tomato sauce on a third of its rim (a soil that leaves only under shear).
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  washInputFromDescription,
  washRegistry,
  type ItemDescription,
  type ItemWashResult,
  type ParamValue,
  type WashDescription,
  type WashResult,
} from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { readParamSet } from '@spotless/sim-params';
import { STD_EU_13_SOILS, workingSoilDescription } from '../src/scenario.ts';
import { anchorCacheDir } from '../src/water.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const params: Record<string, ParamValue> = {};
const paramFile = option('--params');
if (paramFile !== undefined) {
  const read = readParamSet(
    washRegistry(),
    JSON.parse(readFileSync(fromOrigin(paramFile), 'utf8')) as unknown,
  );
  if (!read.ok) throw new RangeError(read.error.map((i) => `${i.key} ${i.message}`).join('; '));
  Object.assign(params, read.value.overrides);
}
/** Eco 50, the only programme the simulation washes on. */
const programme = 'eco_50';
const cache = createDiskExposureCache(
  option('--cache') === undefined ? anchorCacheDir() : fromOrigin(option('--cache') as string),
);

const FACING: [number, number, number, number] = [0.5736, 0.8192, 0, 0];
const AWAY: [number, number, number, number] = [0.8192, 0.5736, 0, 0];
const egg = STD_EU_13_SOILS['dessert_plate_porcelain_190']?.['iec_egg_yolk'];
if (egg === undefined) throw new Error('no working quantity for egg yolk on a dessert plate');
const soils = [
  workingSoilDescription(egg, params),
  {
    type: 'tomato_sauce',
    regions: [{ region: 'rim', coverage: 0.3 }],
    amount_g: 0.5,
    age_h: 3,
    heat_history: 'baked' as const,
  },
];
const plate = (
  id: string,
  position_mm: [number, number, number],
  quat_wxyz: [number, number, number, number],
): ItemDescription => ({
  id,
  type: 'dessert_plate_porcelain_190',
  position_mm,
  quat_wxyz,
  soils,
});
const description = (facing: boolean, pan: boolean): WashDescription => ({
  machine: 'bosch_smv4hax40g',
  programme,
  tier: 'fast',
  levelSeed: 7,
  simSeed: 3,
  params,
  items: [
    plate('plate_left', [-120, -130, 172], facing ? FACING : AWAY),
    plate('plate_right', [120, -130, 172], facing ? FACING : AWAY),
    ...(pan
      ? [
          {
            id: 'pan',
            type: 'frying_pan_clad_254',
            position_mm: [-100, 120, 200] as [number, number, number],
            orientation: 'inverted',
          },
        ]
      : []),
    plate('plate_back', [-100, 120, 300], FACING),
  ],
});

const a: WashResult = await washWithSource(washInputFromDescription(description(true, true)), {
  cache,
  keepScene: false,
});
const b: WashResult = await washWithSource(washInputFromDescription(description(false, false)), {
  cache,
  keepScene: false,
});
const item = (r: WashResult, id: string): ItemWashResult =>
  r.items.find((i) => i.itemId === id) as ItemWashResult;
const cell = (i: ItemWashResult): string =>
  `${i.score}${i.clean ? ' clean' : ''}; ${i.soils.map((s) => `${s.type.replace('iec_', '')} ${s.residualMass_mg.toFixed(1)} of ${s.initialMass_mg.toFixed(0)} mg`).join(', ')}; visible ${i.visibleAreaMm2.toFixed(0)} mm2`;
console.log(`# Single plates in an empty machine (${programme}, fast tier)`);
console.log('');
console.log(`Parameters: ${JSON.stringify(params)}`);
console.log('');
console.log('| Checklist | Plate | A | B | Δs |');
console.log('|---|---|---|---|---|');
for (const id of ['plate_left', 'plate_right']) {
  console.log(
    `| P02: facing the spray (A), turned away (B) | ${id} | ${cell(item(a, id))} | ${cell(item(b, id))} | ${item(b, id).score - item(a, id).score} |`,
  );
}
console.log(
  `| P05: in the open (B), under a frying pan (A) | plate_back | ${cell(item(a, 'plate_back'))} | ${cell(item(b, 'plate_back'))} | ${item(a, 'plate_back').score - item(b, 'plate_back').score} (shadowed minus open) |`,
);
console.log('');
for (const r of [a, b]) {
  console.log(
    `wash: ${r.run.exposureComputed} exposure sets computed, ${r.run.exposureCacheHits} cached; problems: ${r.problems.join(' | ') || 'none'}`,
  );
}
process.exit(0);
