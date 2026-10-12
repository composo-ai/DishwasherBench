/**
 * Prints the bench-scale anchors (`src/bench.ts`) for a parameter set: the six in-machine
 * egg-yolk rates and what the IKW programme leaves.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/bench.ts [--params <params.json>] [--set key=value,...]
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { createWashParams, washRegistry, type ParamValue } from '@spotless/sim-core';
import { readParamSet } from '@spotless/sim-params';
import { eggYolkRates, ikwResidues } from '../src/bench.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const overrides: Record<string, ParamValue> = {};
const file = option('--params');
if (file !== undefined) {
  const read = readParamSet(
    washRegistry(),
    JSON.parse(readFileSync(fromOrigin(file), 'utf8')) as unknown,
  );
  if (!read.ok) throw new RangeError(read.error.map((i) => `${i.key} ${i.message}`).join('; '));
  Object.assign(overrides, read.value.overrides);
}
for (const part of (option('--set') ?? '').split(',').filter((s) => s !== '')) {
  const at = part.indexOf('=');
  overrides[part.slice(0, at)] = Number(part.slice(at + 1));
}
const params = createWashParams(overrides);
console.log(`overrides: ${JSON.stringify(overrides)}`);
console.log('');
console.log('| Egg-yolk tile (soils 6.1) | Published (%/min) | Simulated | Tolerance | Within |');
console.log('|---|---|---|---|---|');
let all = true;
for (const c of eggYolkRates(params)) {
  all &&= c.within;
  console.log(
    `| ${c.temperature} C, pH ${c.pH}, ${c.protease} g/L | ${c.rate} | ${c.simulated.toFixed(2)} | ${c.tolerance.toFixed(2)} | ${c.within ? 'yes' : 'NO'} |`,
  );
}
console.log('');
console.log('| IKW programme (soils 6.4) | Loading (g/m2) | Left | Leaves a residue |');
console.log('|---|---|---|---|');
for (const s of ikwResidues(params)) {
  all &&= s.residue;
  console.log(
    `| ${s.soil} (${s.modelClass}, ${s.heat_history}, ${s.age_h} h) | ${(s.loading * 1000).toFixed(1)} | ${(100 * s.left).toFixed(1)} % | ${s.residue ? (s.untouched ? 'yes (hardly touched)' : 'yes') : 'NO'} |`,
  );
}
console.log('');
console.log(all ? 'bench anchors hold' : 'BENCH ANCHORS VIOLATED');
process.exit(all ? 0 : 1);
