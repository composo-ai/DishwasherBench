/**
 * The anchoring fit (fifth anchoring): writes `anchors/<name>.json`.
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/fit.ts [--name <current set>] [--level-seeds 1,2]
 *        [--sim-seeds 1,2] [--protease 0.010,0.011,...] [--bleach 0.8e-3,...] [--no-write]
 *        [--set key=value]... [--from <record id>: <what>]...
 *
 * The values a wash of the owner's machine fixed (`OWNER_CALIBRATED` of `src/anchored.ts`, from
 * `scripts/fit-owner.ts`) are held throughout, are in the set and are named in its note with
 * the record they come from; the three fits below are made with them in place. `--set` holds a
 * further parameter the same way (`--from` says where it comes from). `--doc` names the note
 * the set points to.
 *
 * Three parameters, each fitted to what identifies it (`FITTED_KEYS` of `src/anchored.ts`):
 *
 *  1. `soil.egg_yolk.rateRef` from the six in-machine egg-yolk rates (soils 6.1) alone: a
 *     one-dimensional search on the bench tile, no wash. `soil.milk.rateRef` takes the value.
 *  2. `liq.xProtease` from the crockery, cutlery and glass class means of the literature record
 *     (round robin 2022/2023, test appliance, detergent D): a scan. Cutlery and glass identify
 *     it; the plates of the crockery class follow.
 *  3. `soil.bleachRate` from the same three class means, at the protease level of step 2: a
 *     scan. Only the tea items of the crockery class answer to it.
 *
 * Every class mean goes through the calibration tool's likelihood of a group mean score
 * (`groupMeanLogLikelihood`, the observation kind `mean_score` of a wash record) with the
 * uncertainty the record states, the weight of a literature record, and the tool's prior of the
 * parameter; a parameter is returned to its default when that costs less than 0.5 log units
 * (the tool's rule), unless the default leaves a soil of the record on the floor of the scale
 * under a published class mean that cannot then be met (the floor rule, see `floorOf`). The
 * scans wash the whole settled load at the official tier, the mean over
 * the level and simulation seeds at every point: the record's 97 items are more than the
 * tool's own optimiser replays in the time of a scan, so the scans are driven here and not by
 * `spotless-fit`.
 *
 * The exposure cache is the anchoring's own, named after the hash of the water sources.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createWashParams,
  washInputFromDescription,
  washRegistry,
  type ParamValue,
} from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { readParamSet } from '@spotless/sim-params';
import {
  fitParameters,
  groupMeanLogLikelihood,
  logPrior,
  programmeOfRecord,
  toZ,
  validateWashRecord,
} from '../../src/index.ts';
import {
  FITTED_KEYS,
  mechanismOverrides,
  OWNER_CALIBRATED,
  ownerCalibratedOverrides,
  X_PROTEASE_SEARCH_MAX,
} from '../src/anchored.ts';
import { eggYolkRates, ikwResidues, type EggYolkResult } from '../src/bench.ts';
import type { ClassMeanAggregate, LiteratureRecord } from '../src/literature.ts';
import { classMeans, soilStandings, type ClassMeans } from '../src/objective.ts';
import { ANCHORS_DIR, CURRENT_ANCHORED, stdEu13Description } from '../src/scenario.ts';
import {
  anchorCacheDir,
  referenceDigest,
  waterSide,
  waterSideNow,
  type AnchorReference,
} from '../src/water.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const numbers = (text: string): number[] => text.split(',').map(Number);

const recordFile = join(
  ANCHORS_DIR,
  'records',
  'std-eu-13.round-robin-ta.detergent-d.literature.json',
);
const json = JSON.parse(readFileSync(recordFile, 'utf8')) as unknown;
const checked = validateWashRecord(json);
if (!checked.ok) {
  throw new Error(
    `${recordFile}: ${checked.error.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
  );
}
const record = json as LiteratureRecord;
const weight = record.weight ?? 1;

const levelSeeds = numbers(option('--level-seeds') ?? '1,2');
const simSeeds = numbers(option('--sim-seeds') ?? '1,2');
const proteaseGrid = numbers(option('--protease') ?? '0.01,0.012,0.013,0.014,0.016,0.02');
const bleachGrid = numbers(
  option('--bleach') ?? '0.0008,0.0009,0.001,0.0011,0.0012,0.0014,0.0016,0.002',
);
const name = option('--name') ?? CURRENT_ANCHORED;
const noteDoc = option('--doc') ?? 'docs/calibration/owner-wash-01-calibration.md';
const outDir = join(ANCHORS_DIR, 'reports');
mkdirSync(outDir, { recursive: true });
const water = waterSide();
const cache = createDiskExposureCache(anchorCacheDir());
console.log(`water side: ${water.simVersion}, sources ${water.sourceHash} (${water.files} files)`);

/**
 * Values another record fixed: those of `OWNER_CALIBRATED` (the owner's own washes), and any
 * given here (`--set key=value`, with where it comes from in `--from`).
 */
const carried: Record<string, ParamValue> = { ...ownerCalibratedOverrides() };
const carriedFrom: string[] =
  OWNER_CALIBRATED.length > 0
    ? [`owner-wash-01-egg-yolk-eco50: ${OWNER_CALIBRATED.map((o) => o.key).join(', ')}`]
    : [];
args.forEach((arg, i) => {
  const value = args[i + 1];
  if (value === undefined) return;
  if (arg === '--set') {
    const at = value.indexOf('=');
    if (at < 1) throw new RangeError(`--set needs key=value, not "${value}"`);
    carried[value.slice(0, at)] = JSON.parse(value.slice(at + 1)) as ParamValue;
  } else if (arg === '--from') carriedFrom.push(value);
});
const fixed = { ...mechanismOverrides(), ...carried };
const RATE_KEY = 'soil.egg_yolk.rateRef';
const MILK_RATE_KEY = 'soil.milk.rateRef';
const PROTEASE_KEY = 'liq.xProtease';
const BLEACH_KEY = 'soil.bleachRate';
/** The calibration tool's rule: a parameter is returned to its default when that costs less than this. */
const RESET_TOLERANCE = 0.5;
/**
 * The floor rule. The tool's rule returns a parameter to its default when the record cannot
 * tell the two apart by its likelihood, and a literature record is wide: a class mean with a
 * standard deviation of one score and a quarter of the weight of a wash moves the likelihood
 * by a few hundredths of a log unit over the whole scan. But a default can be wrong in a way
 * the likelihood of a mean does not weigh: when it puts every item of one soil at the bottom
 * of the scale (mean score under FLOOR_SCORE), the class that holds those items has a ceiling
 * (those items as they scored, every other item of the class at 5), and a published mean
 * above that ceiling cannot be met by anything else in the model. That is a contradiction in
 * a known direction, not a matter of fit, and the parameter is then kept at the best point of
 * its scan if that point lifts the soil off the floor (to LIFTED_SCORE or more). What the
 * record then says of the parameter is one-sided: the report gives the lowest value of the
 * scan at which the soil is off the floor and how far up the likelihood stays indifferent.
 */
const FLOOR_SCORE = 0.5;
const LIFTED_SCORE = 1;

// ---- 1. the protein rate from the six in-machine rates
const rateDef = washRegistry().def(RATE_KEY) as { default: number; min: number; max: number };
const benchMiss = (rate: number): { miss: number; cases: EggYolkResult[] } => {
  const cases = eggYolkRates(createWashParams({ ...fixed, [RATE_KEY]: rate }));
  return { miss: cases.reduce((sum, c) => sum + c.z * c.z, 0), cases };
};
// Golden-section search on the logarithm of the rate over its registered range.
const GOLDEN = (Math.sqrt(5) - 1) / 2;
let lo = Math.log(rateDef.min);
let hi = Math.log(rateDef.max);
let x1 = hi - GOLDEN * (hi - lo);
let x2 = lo + GOLDEN * (hi - lo);
let f1 = benchMiss(Math.exp(x1)).miss;
let f2 = benchMiss(Math.exp(x2)).miss;
for (let i = 0; i < 24; i++) {
  if (f1 < f2) {
    hi = x2;
    x2 = x1;
    f2 = f1;
    x1 = hi - GOLDEN * (hi - lo);
    f1 = benchMiss(Math.exp(x1)).miss;
  } else {
    lo = x1;
    x1 = x2;
    f1 = f2;
    x2 = lo + GOLDEN * (hi - lo);
    f2 = benchMiss(Math.exp(x2)).miss;
  }
}
const rateRef = Number(Math.exp(0.5 * (lo + hi)).toPrecision(3));
const benchAtDefault = benchMiss(rateDef.default);
const benchAtFit = benchMiss(rateRef);
console.log(
  `${RATE_KEY}: ${rateRef} (default ${rateDef.default}); sum of squared misses ${benchAtFit.miss.toFixed(2)} against ${benchAtDefault.miss.toFixed(2)} at the default`,
);
const base: Record<string, ParamValue> = {
  ...fixed,
  [RATE_KEY]: rateRef,
  [MILK_RATE_KEY]: rateRef,
};

// ---- 2 and 3. the scans on the literature record
const aggregate = (cls: string): ClassMeanAggregate => {
  const found = record.aggregates.find(
    (a): a is ClassMeanAggregate => a.kind === 'class_mean_score' && a.class === cls,
  );
  if (found === undefined) throw new Error(`the record has no class mean for ${cls}`);
  return found;
};

interface Point {
  readonly value: number;
  readonly logLikelihood: number;
  readonly logPrior: number;
  readonly objective: number;
  readonly continuous: Readonly<Record<string, number>>;
  readonly score: Readonly<Record<string, number>>;
  readonly milkGlasses: number;
  readonly teaItems: number;
  readonly crockeryWithoutTea: number;
  readonly cleanShare: number;
  readonly soiledCleanShare: number;
  readonly washes: number;
  /** Per soil: the mean score of its items and the ceiling it leaves every class that holds them. */
  readonly soils: Readonly<
    Record<string, { readonly mean: number; readonly ceiling: Readonly<Record<string, number>> }>
  >;
}

/** What the floor rule found for a scan (see FLOOR_SCORE). */
interface Floor {
  readonly soil: string;
  readonly cls: string;
  readonly published: number;
  /** Ceiling of the class mean with the soil as it scores at the default. */
  readonly ceiling: number;
  readonly meanAtDefault: number;
  readonly meanAtBest: number;
  /** Lowest value of the scan at which the soil is off the floor. */
  readonly offFloorFrom: number;
  /** Values of the scan that are off the floor and within the tool's tolerance of the best. */
  readonly indifferent: readonly number[];
}
const CLASSES = ['crockery', 'cutlery', 'glass', 'melamine', 'all'] as const;

type Standings = ReturnType<typeof soilStandings>;

async function meansAt(
  overrides: Record<string, ParamValue>,
): Promise<{ means: ClassMeans[]; standings: Standings[] }> {
  const all: ClassMeans[] = [];
  const standings: Standings[] = [];
  for (const levelSeed of levelSeeds) {
    for (const simSeed of simSeeds) {
      const plain = washInputFromDescription(
        stdEu13Description({
          programme: record.programme.id,
          tier: record.sim?.tier ?? 'official',
          levelSeed,
          simSeed,
          params: overrides,
        }),
      );
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
      all.push(classMeans(result.items, record.standard_composition));
      standings.push(soilStandings(result.items, record.standard_composition));
    }
  }
  return { means: all, standings };
}

async function scan(
  key: string,
  grid: readonly number[],
  others: Record<string, ParamValue>,
  classes: readonly string[],
): Promise<{
  points: Point[];
  best: Point;
  atDefault: Point;
  chosen: number;
  returned: boolean;
  floor: Floor | null;
}> {
  const [parameter] = fitParameters([key]);
  if (parameter === undefined) throw new Error(`${key} is not a fit parameter`);
  const def = washRegistry().def(key) as { default: number };
  const points: Point[] = [];
  for (const value of grid) {
    const washed = await meansAt({ ...base, ...others, [key]: value });
    const all = washed.means;
    const mean = (of: (m: ClassMeans) => number): number =>
      all.reduce((sum, m) => sum + of(m), 0) / all.length;
    // The standing of every soil, averaged over the washes of the point.
    const soils: Record<string, { mean: number; ceiling: Record<string, number> }> = {};
    for (const soil of Object.keys(washed.standings[0] ?? {})) {
      const each = washed.standings.map((s) => s[soil]).filter((s) => s !== undefined);
      const ceiling: Record<string, number> = {};
      for (const cls of Object.keys(each[0]?.ceiling ?? {})) {
        ceiling[cls] =
          each.reduce(
            (sum, s) => sum + ((s.ceiling as Record<string, number>)[cls] ?? Number.NaN),
            0,
          ) / each.length;
      }
      soils[soil] = { mean: each.reduce((sum, s) => sum + s.mean, 0) / each.length, ceiling };
    }
    const byClass = (
      of: (m: ClassMeans) => Readonly<Record<string, number>>,
    ): Record<string, number> =>
      Object.fromEntries(CLASSES.map((c) => [c, mean((m) => of(m)[c] as number)]));
    const continuous = byClass((m) => m.continuous);
    // The group means of the record through the tool's likelihood, relative to a perfect
    // match (the normalising constant does not depend on the parameters).
    let logLikelihood = 0;
    for (const cls of classes) {
      const a = aggregate(cls);
      logLikelihood +=
        groupMeanLogLikelihood(a.value, continuous[cls] as number, a.sd) -
        groupMeanLogLikelihood(a.value, a.value, a.sd);
    }
    logLikelihood *= weight;
    const prior = logPrior([parameter], [toZ(parameter, value)]);
    const p: Point = {
      value,
      logLikelihood,
      logPrior: prior,
      objective: -(logLikelihood + prior),
      continuous,
      score: byClass((m) => m.score),
      milkGlasses: mean((m) => m.milkGlasses),
      teaItems: mean((m) => m.teaItems),
      crockeryWithoutTea: mean((m) => m.crockeryWithoutTea),
      cleanShare: mean((m) => m.cleanShare),
      soiledCleanShare: mean((m) => m.soiledCleanShare.all),
      washes: all.length,
      soils,
    };
    points.push(p);
    console.log(
      `  ${key}=${value}: ${CLASSES.map((c) => `${c} ${(p.score[c] as number).toFixed(2)}`).join(', ')}; plates ${p.crockeryWithoutTea.toFixed(2)}, tea ${p.teaItems.toFixed(2)}, milk glasses ${p.milkGlasses.toFixed(2)}; objective ${p.objective.toFixed(3)}`,
    );
  }
  const best = points.reduce((a, b) => (b.objective < a.objective ? b : a));
  const atDefault = points.find((p) => Math.abs(p.value - def.default) < 1e-12 * def.default);
  if (atDefault === undefined) throw new Error(`the grid of ${key} must hold its default`);
  const cost = atDefault.objective - best.objective;
  const floor = floorOf(points, best, atDefault, classes);
  const returned = cost < RESET_TOLERANCE && floor === null;
  console.log(
    `${key}: best ${best.value} (objective ${best.objective.toFixed(3)}); the default costs ${cost.toFixed(3)}: ${
      returned
        ? 'returned to its default'
        : floor !== null && cost < RESET_TOLERANCE
          ? `kept by the floor rule (${floor.soil} scores ${floor.meanAtDefault.toFixed(2)} at the default: ${floor.cls} could reach ${floor.ceiling.toFixed(2)} at most, published ${floor.published})`
          : 'kept'
    }`,
  );
  return { points, best, atDefault, chosen: returned ? def.default : best.value, returned, floor };
}

/**
 * The floor rule (see FLOOR_SCORE): the soil the default leaves on the floor under a published
 * class mean it cannot then reach, where the best point of the scan lifts that soil off the
 * floor; null when there is none.
 */
function floorOf(
  points: readonly Point[],
  best: Point,
  atDefault: Point,
  classes: readonly string[],
): Floor | null {
  for (const [soil, standing] of Object.entries(atDefault.soils)) {
    if (!(standing.mean < FLOOR_SCORE)) continue;
    const lifted = best.soils[soil]?.mean ?? Number.NaN;
    if (!(lifted >= LIFTED_SCORE)) continue;
    for (const cls of classes) {
      const ceiling = standing.ceiling[cls];
      if (ceiling === undefined) continue;
      const published = aggregate(cls).value;
      if (!(published > ceiling)) continue;
      const off = points.filter((p) => (p.soils[soil]?.mean ?? 0) >= FLOOR_SCORE);
      return {
        soil,
        cls,
        published,
        ceiling,
        meanAtDefault: standing.mean,
        meanAtBest: lifted,
        offFloorFrom: Math.min(...off.map((p) => p.value)),
        indifferent: off
          .filter((p) => p.objective - best.objective < RESET_TOLERANCE)
          .map((p) => p.value),
      };
    }
  }
  return null;
}

for (const value of proteaseGrid) {
  if (value > X_PROTEASE_SEARCH_MAX + 1e-12) {
    throw new RangeError(`${PROTEASE_KEY} = ${value} is above the search bound`);
  }
}
// Both scans read all three fitted class means: the protease acts on the plates and bowls of
// the crockery class as on cutlery and glasses, and the objective is the record's whole
// likelihood, as the tool's own fit would form it.
const FITTED_CLASSES = ['crockery', 'cutlery', 'glass'] as const;
const protease = await scan(PROTEASE_KEY, proteaseGrid, {}, FITTED_CLASSES);
const bleach = await scan(
  BLEACH_KEY,
  bleachGrid,
  { [PROTEASE_KEY]: protease.chosen },
  FITTED_CLASSES,
);

// ---- the anchored set
const anchoredOverrides: Record<string, ParamValue> = { ...base };
if (!protease.returned) anchoredOverrides[PROTEASE_KEY] = protease.chosen;
if (!bleach.returned) anchoredOverrides[BLEACH_KEY] = bleach.chosen;
const waterAfter = waterSideNow();
const set = createWashParams(anchoredOverrides, {
  name,
  origin: 'calibration',
  note: `${Object.keys(carried).length > 0 ? "Anchoring to the published results of another machine with what the first washes on the owner's machine fixed held in place" : 'Provisional anchoring to the published results of another machine'} (round robin 2022/2023, Bosch SMV6ECX51E, eco programme, detergent D; docs/research/standards.md section 7.1), to be replaced by ${Object.keys(carried).length > 0 ? 'more' : ''} washes on the owner's machine. Made on the water side "${water.simVersion}", sources ${water.sourceHash}; valid for that water side only (anchors/scripts/check.ts). Reference detergent D at 20 g. soil.egg_yolk.rateRef (and soil.milk.rateRef with it) fitted to the six in-machine egg-yolk rates; the lags read off the same bench data; liq.xProtease fitted to the cutlery and glass class means and soil.bleachRate to the crockery class mean of the record, each through the calibration tool's likelihood of a group mean score. ${
    Object.keys(carried).length > 0
      ? `Held at values a wash of the owner's machine fixed (${carriedFrom.join('; ')}): ${Object.entries(
          carried,
        )
          .map(([key, value]) => `${key} = ${String(value)}`)
          .join(
            ', ',
          )}; the three fits were made with them in place. Everything else is the registry's default.`
      : "Everything else is the registry's default (the soak of Eco 50 sprayed for prog.soakDuty of the time)."
  }${bleach.floor !== null && !bleach.returned ? ` soil.bleachRate is kept by the floor rule: at its default every ${bleach.floor.soil} item reads dirty, which caps the ${bleach.floor.cls} mean at ${bleach.floor.ceiling.toFixed(2)} against the published ${bleach.floor.published}; the record bounds it from below only (off the floor from ${bleach.floor.offFloorFrom}).` : ''} See ${noteDoc}.`,
  washRecords: [record.id, ...carriedFrom.map((from) => from.split(':')[0]?.trim() ?? from)],
  createdAt: new Date().toISOString(),
});
// The reference of the set: one fast wash of the settled careful load with it, whose digest
// `revalidate.ts` compares when the sources change (see `src/water.ts`).
const REFERENCE = {
  load: 'iec-13-careful',
  programme: 'eco_50',
  tier: 'fast',
  levelSeed: 1,
  simSeed: 1,
} as const;
const referenceResult = await washWithSource(
  washInputFromDescription(stdEu13Description({ ...REFERENCE, params: anchoredOverrides })),
  { cache },
);
const reference: AnchorReference = { ...REFERENCE, digest: referenceDigest(referenceResult) };
const document = {
  ...set.toJSON(),
  anchoredOn: {
    simVersion: water.simVersion,
    exposureSource: water.exposureSource,
    machineSource: water.machineSource,
    files: water.files,
    reference,
  },
};
if (
  waterAfter.exposureSource !== water.exposureSource ||
  waterAfter.machineSource !== water.machineSource
) {
  throw new Error(
    `the water sources changed while the fit ran (${water.exposureSource.slice(0, 12)} to ${waterAfter.exposureSource.slice(0, 12)}): nothing written; run the fit again`,
  );
}
const back = readParamSet(washRegistry(), JSON.parse(JSON.stringify(document)) as unknown);
if (!back.ok) throw new Error(`the written set does not read back: ${JSON.stringify(back.error)}`);
if (!args.includes('--no-write')) {
  writeFileSync(join(ANCHORS_DIR, `${name}.json`), `${JSON.stringify(document, null, 1)}\n`);
}

// ---- the report
const f = (v: number, digits = 2): string => (Number.isFinite(v) ? v.toFixed(digits) : 'n/a');
const lines: string[] = [];
lines.push(`# Anchoring fit: ${name}`);
lines.push('');
lines.push(
  `Water side: ${water.simVersion}, sources ${water.sourceHash} (${water.files} files)${waterAfter.sourceHash === water.sourceHash ? '' : `. **The water sources changed while the fit ran** (now ${waterAfter.sourceHash})`}.`,
);
lines.push(
  `Record ${record.id} (weight ${weight}); level seeds ${levelSeeds.join(', ')}; simulation seeds ${simSeeds.join(', ')}: ${levelSeeds.length * simSeeds.length} washes per point. Fitted keys: ${FITTED_KEYS.map((k) => k.key).join(', ')}.`,
);
lines.push('');
lines.push(`## 1. ${RATE_KEY} from the six in-machine rates`);
lines.push('');
lines.push(
  `Fitted ${rateRef} kg/(m2 s) (default ${rateDef.default}, range ${rateDef.min} to ${rateDef.max}); with ${JSON.stringify(fixed)}.`,
);
lines.push('');
lines.push('| Case | Published (%/min) | Tolerance | At the default | At the fit |');
lines.push('|---|---|---|---|---|');
benchAtFit.cases.forEach((c, i) => {
  const d = benchAtDefault.cases[i] as EggYolkResult;
  lines.push(
    `| ${c.temperature} C, pH ${c.pH}, ${c.protease * 1000} g/m3 | ${f(c.rate)} | ${f(c.tolerance)} | ${f(d.simulated)}${d.within ? '' : ' (out)'} | ${f(c.simulated)}${c.within ? '' : ' (out)'} |`,
  );
});
lines.push('');
lines.push(
  `IKW programme under the set: ${ikwResidues(createWashParams(anchoredOverrides))
    .map((r) => `${r.soil} ${f(100 * r.left, 0)} % left`)
    .join(', ')}.`,
);
const table = (title: string, key: string, s: Awaited<ReturnType<typeof scan>>): void => {
  lines.push('');
  lines.push(`## ${title}`);
  lines.push('');
  lines.push(
    `| \`${key}\` | Crockery | Plates and bowls | Tea items | Cutlery | Glass | Milk glasses | All | Items clean | Soiled items clean | -(log likelihood) | -(log prior) | Objective |`,
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of s.points) {
    lines.push(
      `| ${p.value}${p === s.best ? ' (best)' : ''} | ${f(p.score['crockery'] as number)} | ${f(p.crockeryWithoutTea)} | ${f(p.teaItems)} | ${f(p.score['cutlery'] as number)} | ${f(p.score['glass'] as number)} | ${f(p.milkGlasses)} | ${f(p.score['all'] as number)} | ${f(100 * p.cleanShare, 0)} % | ${f(100 * p.soiledCleanShare, 0)} % | ${f(-p.logLikelihood, 3)} | ${f(-p.logPrior, 3)} | ${f(p.objective, 3)} |`,
    );
  }
  lines.push('');
  lines.push(
    `Best ${s.best.value}; the default costs ${f(s.atDefault.objective - s.best.objective, 3)} log units: ${s.returned ? 'returned to its default' : `kept at ${s.chosen}`}.`,
  );
  if (s.floor !== null) {
    const fl = s.floor;
    lines.push('');
    lines.push(
      `**Floor rule.** At the default every item with \`${fl.soil}\` reads dirty (mean score ${f(fl.meanAtDefault)}). With those items there and every other item of the class at 5, the ${fl.cls} mean could reach ${f(fl.ceiling)} at most; the record publishes ${f(fl.published)}. The default is contradicted in a known direction whatever the likelihood of a wide class mean says, so the best point of the scan is kept (there the soil scores ${f(fl.meanAtBest)}). The record bounds the parameter from below only: the soil is off the floor from ${fl.offFloorFrom} upwards, and the likelihood is indifferent (within ${RESET_TOLERANCE} log units of the best) over ${fl.indifferent.length > 0 ? `${Math.min(...fl.indifferent)} to ${Math.max(...fl.indifferent)}` : 'no other value'} of the values scanned.`,
    );
  }
};
table('2. liq.xProtease from the crockery, cutlery and glass class means', PROTEASE_KEY, protease);
table('3. soil.bleachRate from the same class means', BLEACH_KEY, bleach);
lines.push('');
lines.push(
  `Published (test appliance, detergent D): ${CLASSES.map((c) => `${c} ${aggregate(c).value} (sd used ${aggregate(c).sd})`).join(', ')}.`,
);
lines.push('');
lines.push(`Set: \`${JSON.stringify(anchoredOverrides)}\``);
writeFileSync(join(outDir, `fit.${name}.md`), `${lines.join('\n')}\n`);
writeFileSync(
  join(outDir, `fit.${name}.json`),
  `${JSON.stringify({ name, water, waterAfter, levelSeeds, simSeeds, rateRef, bench: { atDefault: benchAtDefault, atFit: benchAtFit }, protease, bleach, overrides: anchoredOverrides }, null, 1)}\n`,
);
console.log(`wrote ${name}.json and reports/fit.${name}.md`);
process.exit(0);
