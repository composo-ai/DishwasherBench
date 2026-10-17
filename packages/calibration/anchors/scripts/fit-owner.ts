/**
 * The joint calibration on a wash of the owner's machine and on the published class means of
 * the anchoring (docs/calibration/owner-wash-01-calibration.md).
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/fit-owner.ts [--record records/owner/<measured>.json]...
 *        [--started-from anchored-v5] [--base anchors/<started from>.owner-capsule.json]
 *        [--fit prog.soakDuty,soil.bakeRate]
 *        [--surface a.jsonl,b.jsonl] [--grid "prog.soakDuty=0.6,0.7,...;soil.bakeRate=..."]
 *        [--no-fit] [--no-literature] [--no-label] [--set key=value] [--out <dir>] [--name <n>]
 *        [--profiles a,b|none] [--draws n] [--starts n] [--polish n] [--scan n] [--restarts n]
 *
 * Two records of different kinds, each through the calibration tool's own likelihood and
 * weighted by what it states:
 *
 *  - the measured record of the owner's wash (weight 1; with `--record` repeated, every one of
 *    the owner's measured washes, each with weight 1): its fitted observations, the inputs that
 *    were not measured integrated out over its scenarios (`sim.scenarios`), replayed by the
 *    tool's evaluator on the capsule's composition (`--base`);
 *  - the literature record (weight 0.25, its own): its three fitted class means as group mean
 *    scores. Its predictions are read from the table of `scripts/literature-surface.ts`
 *    (whole washes at the official tier, reference detergent D): a fitted key that is an axis
 *    of that table moves the class means, any other leaves them as they are. The protease
 *    level of detergent D is that record's own nuisance and is chosen at every point.
 *
 * The prior of every fitted key is the tool's (the registered range), except the soak's duty,
 * whose prior is the label's energy (`LABEL_DUTY`). The six in-machine egg-yolk rates are a
 * constraint: the bench tile is run at every reported point and must stay within tolerance.
 *
 * Output: the joint log posterior on a grid with its profiles (the joint picture), then the
 * tool's own fit from the best grid point (`fitRecords`: Nelder-Mead, the rule that returns
 * what is not identified, profile intervals), and both reports in `--out`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { type ParamSet, type ParamValue } from '@spotless/sim-core';
import {
  createObjective,
  EvaluatorPool,
  fitParameters,
  fitRecords,
  fmt,
  fromZ,
  resolveObsConstants,
  textTable,
  toZ,
  createCalibrationParams,
  type ObjectiveValue,
  type PriorOverride,
  type RecordEvaluator,
  type RecordPrediction,
  type WashRecord,
} from '../../src/index.ts';
import { diskExposureCache, readFittedParams, readWashRecordFile } from '../../src/node/index.ts';
import { eggYolkRates } from '../src/bench.ts';
import type { LiteratureRecord } from '../src/literature.ts';
import {
  createLiteratureSurface,
  literatureAsGroupRecord,
  readSurfaceRows,
  type LiteratureSurface,
} from '../src/literature-surface.ts';
import { IEC_AREA_BANDS, IEC_SPECK_BANDS } from '../src/objective.ts';
import { ANCHORS_DIR } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const options = (name: string): string[] =>
  args.flatMap((a, i) => (a === name && args[i + 1] !== undefined ? [args[i + 1] as string] : []));
const flag = (name: string): boolean => args.includes(name);

/**
 * The label's energy as a prior of the soak's duty (docs/calibration/anchoring-v5.md section
 * 3): with the pump on throughout, the machine model puts Eco 50 at 0.90 kWh against the
 * printed 0.836, which the pump's energy in the soak accounts for at a duty of 0.53; the
 * model's own energy error (0.05 kWh) makes that a normal of deviation 0.36. The tool's prior
 * is normal in the coordinate a key is fitted in, for the duty its logarithm: a deviation of
 * 0.49 there gives continuous circulation the 0.85 log units the label gives it.
 *
 * KNOWN LIMIT since 11 October 2026: the registered range of the duty is now the profile
 * interval of the owner's wash 01 (0.59 to 1), the centre of this prior lies below it, and the
 * tool moves a centre into the range (`fitParameters`): a run of this script applies the
 * label's prior centred at 0.59, a weaker pull towards a short duty than the label's own
 * (0.35 in place of 0.84 log units at continuous circulation). The check of the seventh
 * anchoring applies the prior as written here by hand (docs/calibration/anchoring-v7.md,
 * section 3).
 */
// literal-ok-begin: named arithmetic control, documented where it is declared
export const LABEL_DUTY: PriorOverride = { centre: 0.53, sd: 0.49 };
// literal-ok-end

/**
 * The anchoring the calibration on the owner's first wash starts from: the set the game washed
 * with when his result arrived, and the one the literature surface was washed about. (Not
 * `CURRENT_ANCHORED`: that names the set this calibration delivers.) `--started-from` names
 * another: the joint picture is made again about a later set when the machine or the loads
 * change (docs/calibration/anchoring-v7.md), with a surface washed about that set.
 */
const STARTED_FROM = option('--started-from') ?? 'anchored-v5';

// `--record` may be given more than once: every measured record is fitted with its own weight
// (1 unless the record states another), beside the literature record (the eighth anchoring,
// docs/calibration/anchoring-v8.md, fits both of the owner's washes so). One record, the
// default, is the calibration on wash 01 as it was.
const recordFiles = (
  options('--record').length > 0
    ? options('--record')
    : ['records/owner/owner-wash-01-egg-yolk-eco50.measured.json']
).map(fromOrigin);
const baseFile = fromOrigin(
  option('--base') ?? join(ANCHORS_DIR, `${STARTED_FROM}.owner-capsule.json`),
);
const keys = (option('--fit') ?? 'prog.soakDuty,soil.bakeRate').split(',');
const outDir = fromOrigin(option('--out') ?? join(ANCHORS_DIR, 'reports', 'owner-wash-01'));
mkdirSync(outDir, { recursive: true });
const name = option('--name') ?? 'joint';
const say = (message: string): void => console.error(message);

// ---- the records
const owners = recordFiles.map((file) => readWashRecordFile(file));
const literatureFile = join(
  ANCHORS_DIR,
  'records',
  'std-eu-13.round-robin-ta.detergent-d.literature.json',
);
const literatureRecord = JSON.parse(readFileSync(literatureFile, 'utf8')) as LiteratureRecord;
const literature = literatureAsGroupRecord(literatureRecord);
const withLiterature = !flag('--no-literature');
const records: WashRecord[] = withLiterature ? [...owners, literature] : [...owners];
/**
 * A plate's name in the tables: its item id, with the record's number when there are several,
 * and the `-seed<n>` of a copy of a record laid out under another level seed (`sim.level_seed`).
 */
const plateName = (recordIndex: number, item: string): string =>
  owners.length === 1
    ? item
    : `${(owners[recordIndex] as WashRecord).id.replace(/^owner-wash-(\d+)-.*?(-seed\d+)?$/, 'w$1$2')}:${item}`;

// ---- the base: the capsule's set, with what is set on the command line
let base: ParamSet = readFittedParams(baseFile).params;
const fixed: Record<string, ParamValue> = {};
for (const setting of options('--set')) {
  const at = setting.indexOf('=');
  fixed[setting.slice(0, at)] = JSON.parse(setting.slice(at + 1)) as ParamValue;
}
if (Object.keys(fixed).length > 0) base = base.with(fixed);

// ---- the literature surface
const surfaceFiles = (
  option('--surface') ??
  ['part0', 'part1']
    .map((part) => join(ANCHORS_DIR, 'reports', `surface.owner-wash-01.${part}.jsonl`))
    .join(',')
)
  .split(',')
  .map(fromOrigin);
const NUISANCE = ['liq.xProtease'];
let surface: LiteratureSurface | undefined;
if (withLiterature) {
  // An axis the fit does not move is read at the value of the reference set, with what was
  // set on the command line.
  // Read under the definitions on disk: the set it starts from may be a superseded one.
  const reference = { ...readOverrides(join(ANCHORS_DIR, `${STARTED_FROM}.json`), true) };
  const fallback: Record<string, number> = {};
  const rows = readSurfaceRows(surfaceFiles);
  for (const key of Object.keys(rows[0]?.point ?? {})) {
    const value = fixed[key] ?? reference[key] ?? createCalibrationParams().get(key);
    if (typeof value === 'number') fallback[key] = value;
  }
  surface = createLiteratureSurface(literatureRecord, rows, { nuisance: NUISANCE, fallback });
  say(
    `literature surface: ${surface.rows} washes, seeds ${surface.seeds.join(' ')}, axes ${Object.entries(
      surface.axes,
    )
      .map(([key, values]) => `${key} [${values.join(', ')}]`)
      .join('; ')}`,
  );
  for (const key of keys) {
    if (surface.axes[key] === undefined) {
      say(
        `NOTE: ${key} is not an axis of the literature surface: the class means are taken not to move with it`,
      );
    }
  }
}

// ---- the evaluator: the tool's own for the measured record, the surface for the literature
const inner = new EvaluatorPool({
  cache: diskExposureCache(fromOrigin(option('--cache') ?? join('.spotless', 'exposure-cache'))),
  onProgress: (what) => say(`  ${what}`),
});
const surfaceValues = (params: ParamSet): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const key of Object.keys(surface?.axes ?? {})) {
    if (!NUISANCE.includes(key)) out[key] = params.get(key);
  }
  return out;
};
const pool: RecordEvaluator = {
  get(record, params) {
    if (record.id !== literature.id) return inner.get(record, params);
    const groups = literature.group_observations ?? [];
    return Promise.resolve({
      observations: [],
      evaluate: (p: ParamSet): Promise<RecordPrediction> => {
        const point = (surface as LiteratureSurface).at(surfaceValues(p));
        return Promise.resolve({
          recordId: record.id,
          eta: new Float64Array(0),
          groupEta: Float64Array.from(
            groups.map((g) => point.continuous[g.id.replace('.mean_score', '')] as number),
          ),
          states: [],
          rule: {
            areaBandsMm2: [...IEC_AREA_BANDS],
            speckBands: [...IEC_SPECK_BANDS],
            maxAreaMm2: p.get('inspect.maxAreaMm2'),
            maxSpecks: p.get('inspect.maxSpecks'),
            maxWaterMl: p.get('inspect.maxWaterMl'),
          },
          constants: resolveObsConstants(p),
          elapsed_ms: 0,
          reused: true,
        });
      },
    });
  },
};

const priors: Record<string, PriorOverride> = flag('--no-label')
  ? {}
  : { 'prog.soakDuty': LABEL_DUTY };
const objective = createObjective(records, keys, { base, pool, priors });
const parameters = objective.parameters;

// ---- what a point looks like
interface PointSummary {
  /** The point in the coordinates of the fit, and in the units of the parameters. */
  readonly z: readonly number[];
  readonly values: Record<string, number>;
  readonly logPosterior: number;
  readonly ownerLogLikelihood: number;
  /** The weighted log likelihood of each measured record, by record id. */
  readonly ownerByRecord: Record<string, number>;
  readonly literatureLogLikelihood: number;
  readonly logPrior: number;
  /**
   * Per plate: the visible area at the record as written (`nominal`, the first scenario), its
   * median and range over the scenarios, the share of them by weight in which it reads clean,
   * and at the record as written the specks and the inspector's verdict.
   */
  readonly plates: Record<
    string,
    {
      nominal: number;
      median: number;
      low: number;
      high: number;
      cleanShare: number;
      nominalSpecks: number;
      nominalClean: boolean;
    }
  >;
  readonly literature: null | {
    protease: number;
    crockery: number;
    cutlery: number;
    glass: number;
    all: number;
    milkGlasses: number;
    teaItems: number;
    clamped: boolean;
  };
}
const summarise = (value: ObjectiveValue): PointSummary => {
  const params = objective.paramsAt(value.z);
  const plates: PointSummary['plates'] = {};
  const ownerByRecord: Record<string, number> = {};
  owners.forEach((record, r) => {
    const part = value.records[r];
    if (part === undefined) return;
    ownerByRecord[record.id] = part.weight * part.logLikelihood;
    const prediction = part.prediction;
    const seen = new Set<string>();
    record.observations.forEach((observation, i) => {
      if (seen.has(observation.item)) return;
      seen.add(observation.item);
      const states = prediction.scenarios?.states.map((each) => each[i]) ?? [prediction.states[i]];
      const weights = prediction.scenarios?.weights ?? [1];
      const areas = states.map((s) => s?.softVisibleAreaMm2 ?? Number.NaN);
      const sorted = [...areas].sort((a, b) => a - b);
      const nominal = states[0] ?? prediction.states[i];
      plates[plateName(r, observation.item)] = {
        nominal: areas[0] as number,
        median: sorted[Math.floor(sorted.length / 2)] as number,
        low: sorted[0] as number,
        high: sorted[sorted.length - 1] as number,
        cleanShare: states.reduce(
          (sum, s, k) => sum + (s?.clean === true ? (weights[k] as number) : 0),
          0,
        ),
        nominalSpecks: nominal?.specks ?? Number.NaN,
        nominalClean: nominal?.clean === true,
      };
    });
  });
  const lit = surface === undefined ? null : surface.at(surfaceValues(params));
  const literaturePart = withLiterature ? value.records[owners.length] : undefined;
  return {
    z: [...value.z],
    values: Object.fromEntries(parameters.map((p, j) => [p.id, fromZ(p, value.z[j] as number)])),
    logPosterior: value.logPosterior,
    ownerLogLikelihood: Object.values(ownerByRecord).reduce((a, b) => a + b, 0),
    ownerByRecord,
    literatureLogLikelihood:
      literaturePart === undefined ? 0 : literaturePart.weight * literaturePart.logLikelihood,
    logPrior: value.logPrior,
    plates,
    literature:
      lit === null
        ? null
        : {
            protease: lit.nuisance['liq.xProtease'] as number,
            crockery: lit.score['crockery'] as number,
            cutlery: lit.score['cutlery'] as number,
            glass: lit.score['glass'] as number,
            all: lit.score['all'] as number,
            milkGlasses: lit.milkGlasses,
            teaItems: lit.teaItems,
            clamped: lit.clamped,
          },
  };
};

// ---- 1. the grid: the joint picture
const gridSpec = option('--grid');
const gridAxes: Record<string, number[]> = {};
if (gridSpec !== undefined) {
  for (const part of gridSpec.split(';')) {
    const at = part.indexOf('=');
    gridAxes[part.slice(0, at)] = part
      .slice(at + 1)
      .split(',')
      .map(Number);
  }
}
const gridPoints: PointSummary[] = [];
const lines: string[] = [];
const plateIds = [
  ...new Set(owners.flatMap((record, r) => record.observations.map((o) => plateName(r, o.item)))),
];
if (gridSpec !== undefined) {
  let points: number[][] = [[]];
  for (const parameter of parameters) {
    const values = gridAxes[parameter.id];
    if (values === undefined) throw new RangeError(`--grid names no values for ${parameter.id}`);
    points = points.flatMap((p) => values.map((v) => [...p, toZ(parameter, v)]));
  }
  const t0 = performance.now();
  for (const z of points) {
    const value = await objective.evaluate(z);
    const summary = summarise(value);
    gridPoints.push(summary);
    say(
      `${parameters.map((p) => `${p.id}=${fmt(summary.values[p.id] as number, 4)}`).join(' ')}: log posterior ${summary.logPosterior.toFixed(3)} (owner ${summary.ownerLogLikelihood.toFixed(3)}${owners.length > 1 ? ` = ${Object.values(summary.ownerByRecord).map((v) => v.toFixed(3)).join(' + ')}` : ''}, literature ${summary.literatureLogLikelihood.toFixed(3)}, prior ${summary.logPrior.toFixed(3)}) | ${plateIds.map((id) => `${id.replace('plate_', '')} ${fmt(summary.plates[id]?.median ?? Number.NaN, 3)}${owners.length > 1 ? ` [as written ${fmt(summary.plates[id]?.nominal ?? Number.NaN, 3)} mm2, ${summary.plates[id]?.nominalSpecks ?? '-'} specks, ${summary.plates[id]?.nominalClean === true ? 'clean' : 'NOT clean'}]` : ''}`).join(' ')} | ${((performance.now() - t0) / 1000).toFixed(0)} s`,
    );
  }
  const best = gridPoints.reduce((a, b) => (b.logPosterior > a.logPosterior ? b : a));
  lines.push(`# Joint log posterior on a grid: ${name}`);
  lines.push('');
  lines.push(
    `Records: ${records.map((r) => `${r.id} (weight ${r.weight ?? (r.kind === 'literature' ? 0.25 : 1)})`).join(', ')}. Base set ${baseFile.replace(/^.*\/packages\//, 'packages/')}${Object.keys(fixed).length > 0 ? ` with ${JSON.stringify(fixed)}` : ''}. Prior of the duty: ${flag('--no-label') ? 'the registry' : `the label's energy (centre ${LABEL_DUTY.centre}, deviation ${LABEL_DUTY.sd} in the logarithm)`}.`,
  );
  lines.push('');
  lines.push(
    `| ${parameters.map((p) => p.id).join(' | ')} | log posterior | owner | literature | prior | ${plateIds.map((id) => `${id.replace('plate_', '')}: nominal, median (range) mm2, clean`).join(' | ')} | D protease | crockery | cutlery | glass (milk) | tea |`,
  );
  lines.push(`|${'---|'.repeat(parameters.length + 4 + plateIds.length + 5)}`);
  for (const point of gridPoints) {
    const lit = point.literature;
    lines.push(
      `| ${parameters.map((p) => fmt(point.values[p.id] as number, 4)).join(' | ')} | ${(point.logPosterior - best.logPosterior).toFixed(2)} | ${point.ownerLogLikelihood.toFixed(2)} | ${point.literatureLogLikelihood.toFixed(3)} | ${point.logPrior.toFixed(2)} | ${plateIds
        .map((id) => {
          const plate = point.plates[id];
          return plate === undefined
            ? '-'
            : `${fmt(plate.nominal, 3)}, ${fmt(plate.median, 3)} (${fmt(plate.low, 3)} to ${fmt(plate.high, 3)}), ${(100 * plate.cleanShare).toFixed(0)} %${owners.length > 1 ? `; as written ${plate.nominalSpecks} specks, ${plate.nominalClean ? 'clean' : 'NOT clean'}` : ''}`;
        })
        .join(
          ' | ',
        )} | ${lit === null ? '-' : lit.protease} | ${lit === null ? '-' : lit.crockery.toFixed(2)} | ${lit === null ? '-' : lit.cutlery.toFixed(2)} | ${lit === null ? '-' : `${lit.glass.toFixed(2)} (${lit.milkGlasses.toFixed(2)})`} | ${lit === null ? '-' : lit.teaItems.toFixed(2)} |`,
    );
  }
  lines.push('');
  lines.push(
    `Log posterior relative to the best grid point (${best.logPosterior.toFixed(3)} at ${parameters.map((p) => `${p.id} = ${fmt(best.values[p.id] as number, 4)}`).join(', ')}).`,
  );
  // Profiles on the grid: the best over the other parameters at every value of one.
  for (const parameter of parameters) {
    const values = gridAxes[parameter.id] as number[];
    const profile = values.map((v) =>
      Math.max(
        ...gridPoints
          .filter(
            (point) => Math.abs((point.values[parameter.id] as number) - v) <= 1e-9 * Math.abs(v),
          )
          .map((point) => point.logPosterior),
      ),
    );
    const inside = values.filter(
      (_, k) => 2 * (best.logPosterior - (profile[k] as number)) <= 3.84,
    );
    lines.push('');
    lines.push(
      `Profile of \`${parameter.id}\` on the grid (best over the others): ${values.map((v, k) => `${fmt(v, 4)}: ${((profile[k] as number) - best.logPosterior).toFixed(2)}`).join(', ')}. Grid values inside the 95 % profile interval (a fall of 1.92): ${inside.length > 0 ? `${fmt(Math.min(...inside), 4)} to ${fmt(Math.max(...inside), 4)}` : 'none'}.`,
    );
  }
  writeFileSync(join(outDir, `grid.${name}.md`), `${lines.join('\n')}\n`);
  writeFileSync(
    join(outDir, `grid.${name}.json`),
    `${JSON.stringify({ name, records: records.map((r) => r.id), keys, fixed, axes: gridAxes, points: gridPoints }, null, 1)}\n`,
  );
  console.log(lines.join('\n'));
}

// ---- 2. the tool's fit, from the best grid point
if (!flag('--no-fit')) {
  let start = base;
  if (gridPoints.length > 0) {
    const best = gridPoints.reduce((a, b) => (b.logPosterior > a.logPosterior ? b : a));
    start = objective.paramsAt(best.z);
  }
  const number = (key: string): number | undefined =>
    option(key) === undefined ? undefined : Number(option(key));
  const fit = await fitRecords(records, keys, {
    base: start,
    pool,
    priors,
    starts: number('--starts') ?? 0,
    polish: number('--polish') ?? 0,
    scanPoints: number('--scan') ?? 0,
    // Every fitted key is profiled unless told otherwise (`--profiles a,b`, or `none`).
    profiles:
      option('--profiles') === undefined
        ? keys
        : option('--profiles') === 'none'
          ? 0
          : (option('--profiles') as string).split(','),
    predictiveDraws: number('--draws') ?? 0,
    refineBackground: number('--refine') ?? 1,
    restarts: number('--restarts') ?? 1,
    name: owners.length === 1 ? `owner-wash-01.${name}` : `owner-washes.${name}`,
    createdAt: new Date().toISOString(),
    onProgress: (message) => say(`  ${message}`),
  });
  // The constraint: the six in-machine egg-yolk rates at the fitted set.
  const bench = eggYolkRates(
    createCalibrationParams(fit.paramSet.overrides as Record<string, ParamValue>),
  );
  const benchLines = bench.map(
    (c) =>
      `${c.temperature} C, pH ${c.pH}, ${c.protease * 1000} g/m3: ${c.simulated.toFixed(2)} against ${c.rate.toFixed(2)} +- ${c.tolerance.toFixed(2)} % per minute${c.within ? '' : ' (OUT)'}`,
  );
  const at = summarise(await objective.evaluate(fit.parameters.map((p) => p.z)));
  const report = [
    fit.report,
    '',
    `the six in-machine egg-yolk rates at the fitted set: ${bench.every((c) => c.within) ? 'all within tolerance' : 'NOT ALL WITHIN TOLERANCE'}`,
    ...benchLines.map((line) => `  ${line}`),
    '',
    `at the estimate: ${JSON.stringify(at, null, 1)}`,
  ].join('\n');
  console.log(report);
  writeFileSync(join(outDir, `fit.${name}.txt`), `${report}\n`);
  writeFileSync(
    join(outDir, `fit.${name}.json`),
    `${JSON.stringify(
      {
        name,
        records: records.map((r) => r.id),
        keys,
        fixed,
        priors,
        parameters: fit.parameters,
        estimate: fit.estimate,
        covariance: fit.covariance,
        correlation: fit.correlation,
        profiles: fit.profiles,
        observations: fit.observations,
        identifiability: {
          parameters: fit.identifiability.parameters,
          combinations: fit.identifiability.combinations,
        },
        bench,
        at,
        overrides: fit.paramSet.overrides,
        evaluations: fit.evaluations,
        computed: fit.computed,
        elapsed_s: fit.elapsed_s,
      },
      null,
      1,
    )}\n`,
  );
  writeFileSync(join(outDir, `params.${name}.json`), `${JSON.stringify(fit.paramSet, null, 1)}\n`);
}
process.exit(0);
