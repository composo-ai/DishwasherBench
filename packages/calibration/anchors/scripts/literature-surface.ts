/**
 * The published class means of the literature record as a function of parameters it shares
 * with a wash of the owner's machine: the table a joint fit reads the literature term from
 * (`src/literature-surface.ts`, `scripts/fit-owner.ts`).
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/literature-surface.ts <grid.json> <out.jsonl> [--slice i/n]
 *        [--level-seeds 1,2] [--sim-seeds 1] [--set anchored-v5]
 *
 * grid.json: { "axes": { "<key>": [values...], ... }, "first": { "<key>": value, ... } }
 *   Every combination of the values is washed: the settled careful standard load on Eco 50
 *   with the course of the record (main wash 54 C, final rinse 48 C), reference detergent D at
 *   20 g, official tier, once per level seed and simulation seed. The base is the overrides of
 *   the named anchored set (default the current one) with the point's values on top;
 *   `soil.milk.rateRef` follows `soil.egg_yolk.rateRef` as in the anchoring. Points that hold
 *   every value of `first` are washed before the others. A point already in the output file is
 *   not washed again, so a stopped run goes on where it stopped; `--slice i/n` takes every
 *   n-th point from the i-th, for runs side by side (each with its own output file).
 *
 * One line per wash: the point, the seeds, the class means (whole-number, continuous and as
 * the fit reads them), the milk glasses, the tea items, the plates, and every soil's share
 * left, mean score and clean items.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { washInputFromDescription, type ParamValue } from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { programmeOfRecord, validateWashRecord } from '../../src/index.ts';
import type { LiteratureRecord } from '../src/literature.ts';
import { classMeans } from '../src/objective.ts';
import { ANCHORS_DIR, CURRENT_ANCHORED, stdEu13Description } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';
import { summariseWash } from '../src/summary.ts';
import { anchorCacheDir, waterSide } from '../src/water.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const [gridFile, outFile] = positional;
if (gridFile === undefined || outFile === undefined) {
  throw new RangeError('usage: literature-surface.ts <grid.json> <out.jsonl> [--slice i/n]');
}
const numbers = (text: string): number[] => text.split(',').map(Number);
const levelSeeds = numbers(option('--level-seeds') ?? '1,2');
const simSeeds = numbers(option('--sim-seeds') ?? '1');
const [sliceIndex, sliceCount] = (option('--slice') ?? '0/1').split('/').map(Number) as [
  number,
  number,
];
const setName = option('--set') ?? CURRENT_ANCHORED;

const grid = JSON.parse(readFileSync(gridFile, 'utf8')) as {
  axes: Record<string, number[]>;
  first?: Record<string, number>;
};
const keys = Object.keys(grid.axes);
let points: Record<string, number>[] = [{}];
for (const key of keys) {
  points = points.flatMap((p) => (grid.axes[key] as number[]).map((v) => ({ ...p, [key]: v })));
}
const isFirst = (p: Record<string, number>): boolean =>
  Object.entries(grid.first ?? {}).every(([key, value]) => p[key] === value);
points = [...points.filter(isFirst), ...points.filter((p) => !isFirst(p))];

const recordFile = join(
  ANCHORS_DIR,
  'records',
  'std-eu-13.round-robin-ta.detergent-d.literature.json',
);
const json = JSON.parse(readFileSync(recordFile, 'utf8')) as unknown;
const checked = validateWashRecord(json);
if (!checked.ok) throw new Error(`${recordFile} is not a valid wash record`);
const record = json as LiteratureRecord;
const base = readOverrides(join(ANCHORS_DIR, `${setName}.json`));
const cache = createDiskExposureCache(anchorCacheDir());
const water = waterSide();

const idOf = (p: Record<string, number>, levelSeed: number, simSeed: number): string =>
  `${keys.map((key) => `${key}=${p[key]}`).join(',')}|L${levelSeed}S${simSeed}`;
const done = new Set<string>();
if (existsSync(outFile)) {
  for (const line of readFileSync(outFile, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    done.add((JSON.parse(line) as { id: string }).id);
  }
}

let index = -1;
for (const point of points) {
  for (const levelSeed of levelSeeds) {
    for (const simSeed of simSeeds) {
      index++;
      if (index % sliceCount !== sliceIndex) continue;
      const id = idOf(point, levelSeed, simSeed);
      if (done.has(id)) continue;
      const overrides: Record<string, ParamValue> = { ...base, ...point };
      if (point['soil.egg_yolk.rateRef'] !== undefined) {
        overrides['soil.milk.rateRef'] = point['soil.egg_yolk.rateRef'];
      }
      const plain = washInputFromDescription(
        stdEu13Description({
          programme: record.programme.id,
          tier: record.sim?.tier ?? 'official',
          levelSeed,
          simSeed,
          params: overrides,
        }),
      );
      const t0 = performance.now();
      const result = await washWithSource(
        {
          ...plain,
          programme: programmeOfRecord(
            record,
            plain.machine,
            plain.config ?? plain.machine.defaultConfig,
          ).programme,
        },
        { cache },
      );
      const means = classMeans(result.items, record.standard_composition);
      const summary = summariseWash(result);
      const row = {
        id,
        point,
        levelSeed,
        simSeed,
        set: setName,
        source: water.exposureSource,
        score: means.score,
        continuous: means.continuous,
        fitted: means.fitted,
        milkGlasses: means.milkGlasses,
        teaItems: means.teaItems,
        crockeryWithoutTea: means.crockeryWithoutTea,
        cleanShare: means.cleanShare,
        clean: summary.all.clean,
        items: summary.items,
        soiledClean: summary.soiledOnly.clean,
        soiledItems: summary.soiledOnly.items,
        energy_kWh: result.machine.energy_kWh,
        bySoil: Object.fromEntries(
          summary.bySoil.map((b) => [
            b.type,
            {
              records: b.records,
              left: b.initial_mg > 0 ? b.residual_mg / b.initial_mg : 0,
              meanScore: b.meanScore,
              clean: b.clean,
            },
          ]),
        ),
        seconds: (performance.now() - t0) / 1000,
      };
      appendFileSync(outFile, `${JSON.stringify(row)}\n`);
      console.log(
        `${id} | all ${means.score.all.toFixed(2)} cro ${means.score.crockery.toFixed(2)} cut ${means.score.cutlery.toFixed(2)} gla ${means.score.glass.toFixed(2)} (milk ${means.milkGlasses.toFixed(2)} tea ${means.teaItems.toFixed(2)}) | soiled clean ${summary.soiledOnly.clean}/${summary.soiledOnly.items} | ${row.seconds.toFixed(0)} s`,
      );
    }
  }
}
process.exit(0);
