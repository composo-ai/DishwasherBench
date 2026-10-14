/**
 * Washes a settled standard load and prints what the published results are compared with:
 * class means, overall mean, share clean, residue per soil and per item type.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/run.ts
 *        [--load iec-13-careful] [--tier official|fast] [--raw]
 *        [--params <params.json>] [--set key=value[,key=value...]]
 *        [--variants <file.json>] [--level-seed n] [--sim-seed n]
 *        [--milk film|full] [--detergent <params.json>] [--dose-g 12.9]
 *        [--flip-z id,id] [--stall lower=15] [--watch id,id]
 *        [--liquor] [--items] [--out <dir>] [--cache <dir>]
 *
 * `--raw` keeps the soils of the load file (the first build's demonstration); without it the
 * working quantities of `src/scenario.ts` are applied. `--params` reads a parameter set in the
 * registry's format (`spotless.params`); `--set` adds overrides. `--variants` is a JSON object
 * of named override sets, each washed in turn in this process (the scene is built once).
 * `--milk full` gives the glasses all 1.07 g of milk solids to digest (default: the 0.50 g of
 * protein and fat). `--detergent` lays a detergent set over the parameters (its protease level
 * scales the anchored one) and `--dose-g` sets the mass of the tablet.
 * `--flip-z` turns the named items half a turn about the vertical through their origin (a
 * plate then faces the other way in its slot); `--stall` holds an arm at an angle (degrees);
 * `--watch` prints a line for the named items only.
 * `--liquor` prints the course of the liquor; `--items` a line per item. The exposure cache is
 * the anchoring's own, named after the hash of the water sources (`src/water.ts`), unless
 * `--cache` names another.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { washInputFromDescription, type ParamValue, type WashResult } from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { ROUND_ROBIN_TA, STANDARD_COMPOSITION } from '../src/literature.ts';
import { classMeans } from '../src/objective.ts';
import { stdEu13Description } from '../src/scenario.ts';
import { anchorCacheDir, waterSide, waterTag } from '../src/water.ts';
import { readOverrides, scaledProtease, withDose } from '../src/sets.ts';
import { formatSummary, summariseWash } from '../src/summary.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const flag = (name: string): boolean => args.includes(name);

/** Reads `key=value,key=value` (numbers, or `a|b|c` for a vector). */
export function parseOverrides(text: string | undefined): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  if (text === undefined || text === '') return out;
  for (const part of text.split(',')) {
    const at = part.indexOf('=');
    if (at < 0) throw new RangeError(`--set: "${part}" is not key=value`);
    const value = part.slice(at + 1);
    out[part.slice(0, at)] = value.includes('|') ? value.split('|').map(Number) : Number(value);
  }
  return out;
}

const base: Record<string, ParamValue> = {};
const paramFile = option('--params');
if (paramFile !== undefined) Object.assign(base, readOverrides(fromOrigin(paramFile)));
// A detergent set laid over the anchored one; its protease level scales the anchored one.
const detergentFile = option('--detergent');
if (detergentFile !== undefined) {
  const detergent = readOverrides(fromOrigin(detergentFile), true);
  const protease = scaledProtease(base, detergent);
  Object.assign(base, detergent, protease === undefined ? {} : { 'liq.xProtease': protease });
}
Object.assign(base, parseOverrides(option('--set')));

const variantFile = option('--variants');
const variants: Record<string, Record<string, ParamValue>> = variantFile === undefined
  ? { run: {} }
  : (JSON.parse(readFileSync(fromOrigin(variantFile), 'utf8')) as Record<
      string,
      Record<string, ParamValue>
    >);

const load = option('--load') ?? 'iec-13-careful';
/** Eco 50, the only programme the simulation washes on. */
const programme = 'eco_50';
const tier = option('--tier') === 'fast' ? 'fast' : 'official';
const cache = createDiskExposureCache(
  option('--cache') === undefined ? anchorCacheDir() : fromOrigin(option('--cache') as string),
);
console.log(
  `water side: ${waterSide().simVersion}, sources ${waterTag()} (${waterSide().files} files); exposure cache ${anchorCacheDir()}`,
);
const outDir = option('--out') === undefined ? undefined : fromOrigin(option('--out') as string);
if (outDir !== undefined) mkdirSync(outDir, { recursive: true });

function liquorTable(result: WashResult): string {
  const { fields, tickTime_s, values } = result.machine.liquor;
  const n = fields.length;
  const col = (name: string): number => fields.indexOf(name);
  const lines = [
    '| min | T (C) | pH | detergent (g/L) | tablet left (g) | protease (mg/L) | amylase (mg/L) | peracid (mmol/L) | volume (L) | soil (g/L) |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  let next = 0;
  for (let t = 0; t < tickTime_s.length; t++) {
    const time = tickTime_s[t] as number;
    if (time < next) continue;
    next = time + 300;
    const v = (name: string): number => values[n * t + col(name)] as number;
    lines.push(
      `| ${(time / 60).toFixed(0)} | ${v('temperature').toFixed(1)} | ${v('pH').toFixed(2)} | ${v('detergent').toFixed(2)} | ${(v('tabletLeft') * 1000).toFixed(1)} | ${(v('protease') * 1000).toFixed(1)} | ${(v('amylase') * 1000).toFixed(1)} | ${v('peracid').toFixed(3)} | ${(v('volume') * 1000).toFixed(2)} | ${v('suspendedSoil').toFixed(2)} |`,
    );
  }
  return lines.join('\n');
}

for (const [name, overrides] of Object.entries(variants)) {
  const params = { ...base, ...overrides };
  const description = stdEu13Description({
    load,
    programme,
    tier,
    params,
    workingSoils: !flag('--raw'),
    ...(option('--milk') === 'full' ? { milk: 'full' as const } : {}),
    ...(option('--level-seed') === undefined ? {} : { levelSeed: Number(option('--level-seed')) }),
    ...(option('--sim-seed') === undefined ? {} : { simSeed: Number(option('--sim-seed')) }),
  });
  const started = performance.now();
  const flipped = new Set((option('--flip-z') ?? '').split(',').filter((id) => id !== ''));
  const stall = option('--stall')?.split('=');
  const edited: typeof description = {
    ...description,
    ...(stall === undefined ? {} : { stalledArms_deg: { [stall[0] as string]: Number(stall[1]) } }),
    items: description.items.map((item) => {
      if (!flipped.has(item.id)) return item;
      // Half a turn about the vertical: (w, x, y, z) -> (-z, -y, x, w).
      const q = item.quat_wxyz ?? [1, 0, 0, 0];
      return { ...item, quat_wxyz: [-q[3], -q[2], q[1], q[0]] as [number, number, number, number] };
    }),
  };
  const plain = washInputFromDescription(edited);
  const input =
    option('--dose-g') === undefined ? plain : withDose(plain, Number(option('--dose-g')) / 1000);
  const result = await washWithSource(input, { cache });
  const seconds = (performance.now() - started) / 1000;
  const summary = summariseWash(result);
  const title = `${load} / ${programme} / ${name}${flag('--raw') ? ' (soils of the load file)' : ''}`;
  console.log(formatSummary(summary, title));
  console.log('');
  const means = classMeans(result.items, STANDARD_COMPOSITION);
  console.log('| | crockery | cutlery | glass | melamine | all but pots | share clean |');
  console.log('|---|---|---|---|---|---|---|');
  const row = (label: string, m: Readonly<Record<string, number>>, clean: string): string =>
    `| ${label} | ${(['crockery', 'cutlery', 'glass', 'melamine', 'all'] as const).map((c) => (m[c] as number).toFixed(2)).join(' | ')} | ${clean} |`;
  console.log(
    row(
      'simulated, item types weighted as in the standard load',
      means.score,
      `${(100 * means.cleanShare).toFixed(0)} %`,
    ),
  );
  console.log(
    row('simulated, items of this load', means.raw, `${(100 * means.cleanShareRaw).toFixed(0)} %`),
  );
  for (const detergent of ['D', 'E'] as const) {
    const p = ROUND_ROBIN_TA[detergent];
    console.log(
      `| published, Bosch eco, detergent ${detergent} | ${(['crockery', 'cutlery', 'glass', 'melamine'] as const).map((c) => p[c][0].toFixed(2)).join(' | ')} | ${((p.all[0] * 146 - p.pots[0] * 8) / 138).toFixed(2)} | about 70 % (estimated) |`,
    );
  }
  console.log('');
  const pct = (v: number): string => `${(100 * v).toFixed(0)} %`;
  console.log(
    `soiled items only, standard weights: crockery ${means.soiled.crockery.toFixed(2)} (${pct(means.soiledCleanShare.crockery)} clean), cutlery ${means.soiled.cutlery.toFixed(2)} (${pct(means.soiledCleanShare.cutlery)}), glass ${means.soiled.glass.toFixed(2)} (${pct(means.soiledCleanShare.glass)}), all ${means.soiled.all.toFixed(2)} (${pct(means.soiledCleanShare.all)}); milk glasses alone ${means.milkGlasses.toFixed(2)}; tea items ${means.teaItems.toFixed(2)}; crockery without tea ${means.crockeryWithoutTea.toFixed(2)}`,
  );
  console.log(
    `run: ${seconds.toFixed(0)} s (${Object.entries(result.run.timings_ms)
      .map(([stage, ms]) => `${stage} ${(ms / 1000).toFixed(0)}`)
      .join(
        ', ',
      )}); exposure ${result.run.exposureCacheHits} cached, ${result.run.exposureComputed} computed; ${result.run.deposits} deposits; overrides ${JSON.stringify(overrides)}`,
  );
  for (const problem of result.problems.slice(0, 12)) console.log(`problem: ${problem}`);
  if (result.machine.timelineProblems.length > 0) {
    console.log(`timeline problems: ${result.machine.timelineProblems.slice(0, 4).join(' | ')}`);
  }
  if (flag('--liquor')) {
    console.log('');
    console.log(liquorTable(result));
  }
  if (flag('--items') || option('--watch') !== undefined) {
    console.log('');
    const watch = option('--watch')?.split(',');
    for (const item of result.items) {
      if (item.initialMass_mg <= 0) continue;
      if (watch !== undefined && !watch.includes(item.itemId)) continue;
      console.log(
        `${item.itemId.padEnd(22)} score ${item.score} ${item.clean ? 'clean' : '     '} left ${item.residualMass_mg.toFixed(2).padStart(9)} of ${item.initialMass_mg.toFixed(1).padStart(7)} mg  visible ${item.visibleAreaMm2.toFixed(0).padStart(6)} of ${item.initialVisibleAreaMm2.toFixed(0).padStart(6)} mm2  specks ${String(item.specks).padStart(3)}  water ${item.water.pooled_mL.toFixed(1)} mL`,
      );
    }
  }
  console.log('');
  if (outDir !== undefined) {
    writeFileSync(
      join(outDir, `${load}.${programme}.${name}.summary.json`),
      `${JSON.stringify({ name, load, programme, tier, overrides: params, summary, means, items: result.items.map(({ cells: _cells, regions: _regions, ...rest }) => rest), problems: result.problems, provenance: result.provenance }, null, 1)}\n`,
    );
  }
}
