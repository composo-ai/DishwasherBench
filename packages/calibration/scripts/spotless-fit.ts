/**
 * spotless-fit: wash records against the simulator.
 *
 *   pnpm --filter @spotless/calibration spotless-fit <command> [files] [options]
 *
 *   validate     <record.json>...              check records; show the machine changes and how
 *                                              the adapted programme compares with the course
 *   predict      <record.json>                 what the simulator says for every observation
 *   fit          <record.json>... --fit keys   maximum a posteriori fit, report, parameter files
 *   wash         <record.json> --params <file> run wash() on a record as a fit left it: the
 *                                              record's machine and load, its programme with
 *                                              the fitted prog.* applied, the fitted set
 *   sensitivity  <record.json>... --fit keys   sensitivities, Fisher information, identifiability
 *   rank         <candidate.json>... --fit keys   order candidate experiments by expected gain
 *   check-scale  <record.json> --scale key     can a cal.* scale be applied at replay time?
 *   manifest     <record.json>                 the record as the game's wash manifest
 *   from-manifest <manifest.json> --id <id>    a planned record of a load placed in the game
 *   params       [--group name]                the parameters that can be fitted, with priors
 *
 * Common options:
 *   --fit a,b,c          parameter keys to fit (a vector component as key[component]);
 *                        --group <calibration group> adds every parameter of a group
 *   --water a,b          parameters of the water model, fitted in the outer loop (fit only)
 *   --params <file>      parameter file to start from (as a fit writes it). The calibration
 *                        keys of that fit (obs.*, cal.*, prog.*) are read from calibration.json
 *                        beside it, or from --calibration <file>; a warning says when there
 *                        is none. Without it the registry's defaults are used, which are not
 *                        the default set of any machine: the first line printed says which
 *                        parameters are in use
 *   --accept-stale-params  read a --params file that is stale (a set another set has replaced,
 *                        or one made for another state of the water side or of the machine)
 *                        all the same; without it such a file is refused, as a wash refuses
 *                        it. Every line of output that names the set then marks it stale
 *   --set key=value      override on top of it (repeatable; a vector as key=[1,2,3])
 *   --restrict all       replay every soil, not only those of observed items
 *   --thin <k>           keep one soil cell in k (mass and area fractions only)
 *   --cache <dir>        exposure cache directory (default .spotless/exposure-cache where the
 *                        command was started); --no-cache keeps it in memory
 *   --out <path>         output file, or directory for fit
 *   --seed <n>  --starts <n>  --polish <n>  --profiles <n>  --draws <n>   (fit). After the
 *                        optimum a fit scans every parameter, takes derivatives, profiles up
 *                        to three parameters and makes a predictive check: many times the
 *                        evaluations of the optimum itself, each stage announced as it
 *                        begins. A quick fit for the estimate alone:
 *                        --starts 1 --scan 0 --profiles 0 --draws 0
 *   --scan <n>           points of the scan of each parameter for a second optimum (fit; 0: none)
 *   --allow-standard     let constants a standard defines (inspect.*) be fitted
 *   --interest a,b  --existing <record.json>,...                          (rank)
 *   --draws <n>          parameter sets drawn from the prior to average the gain over (rank;
 *                        default 8; 0 gives the local ranking at the current values)
 *   --posterior <fit.json>   draw them from the posterior of an earlier fit of the same keys
 *                        instead (rank; use with --params of that fit)
 *   --step <x>  --no-adapt   first step of the derivatives in prior deviations (default 0.1),
 *                        and keep it instead of choosing it from the posterior deviation
 *   --rows <n>           rows of the sensitivity matrix to print, strongest first (default 40)
 *   --scale cal.x        the replay-time scale to check (check-scale)
 *   --id <id>            id of the record to write (from-manifest)
 *   --quiet
 *
 * Relative paths are taken from the directory the command was started in.
 */

import { isAbsolute, join } from 'node:path';
import type { WashManifest } from '@spotless/session';
import { wash, type ParamSet, type ParamValue } from '@spotless/sim-core';
import { supersededIssues, waterSideIssues } from '@spotless/sim-core/node';
import {
  calibrationRegistry,
  checkReplayScale,
  EvaluatorPool,
  fitParameters,
  fitRecords,
  fitWithWaterParameters,
  fmt,
  fromZ,
  isStandardKey,
  machineOfRecord,
  predictiveMoments,
  prepareRecord,
  programmeOfRecord,
  rankExperiments,
  recordFromManifest,
  recordLikelihood,
  RecordSetupError,
  sensitivity,
  sensitivityTable,
  textTable,
  validateWashRecord,
  washManifestFromRecord,
  WashRecordError,
  type EvaluatorOptions,
  type WashRecord,
} from '../src/index.ts';
import {
  CalibrationFileError,
  diskExposureCache,
  readCalibrationParams,
  readFittedParams,
  readJsonFile,
  readWashRecordFile,
  writeJsonFile,
  writeTextFile,
} from '../src/node/index.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const USAGE =
  'usage: spotless-fit <validate|predict|fit|wash|sensitivity|rank|check-scale|manifest|from-manifest|params> [files] [options]\n' +
  '       (see the head of packages/calibration/scripts/spotless-fit.ts, or docs/calibration/fitting.md section 8)';

interface Args {
  command: string;
  files: string[];
  options: Map<string, string[]>;
}

const FLAGS = new Set([
  'quiet',
  'no-cache',
  'fold-scales',
  'allow-standard',
  'no-adapt',
  'accept-stale-params',
]);

function parseArgs(argv: readonly string[]): Args {
  const args = argv.filter((a) => a !== '--');
  const command = args[0] ?? '';
  const files: string[] = [];
  const options = new Map<string, string[]>();
  for (let i = 1; i < args.length; i++) {
    const arg = args[i] as string;
    if (!arg.startsWith('--')) {
      files.push(fromOrigin(arg));
      continue;
    }
    const name = arg.slice(2);
    const list = options.get(name) ?? [];
    if (FLAGS.has(name)) list.push('true');
    else {
      const value = args[++i];
      if (value === undefined) fail(`option ${arg} needs a value`);
      list.push(value);
    }
    options.set(name, list);
  }
  return { command, files, options };
}

function fail(message: string, code = 2): never {
  console.error(`spotless-fit: ${message}`);
  process.exit(code);
}

const args = parseArgs(process.argv.slice(2));
const one = (name: string): string | undefined => args.options.get(name)?.at(-1);
const list = (name: string): string[] =>
  (args.options.get(name) ?? []).flatMap((v) => v.split(',')).filter((v) => v !== '');
const number = (name: string): number | undefined => {
  const value = one(name);
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) fail(`--${name} needs a number, not "${value}"`);
  return n;
};
const quiet = args.options.has('quiet');
const say = (message: string): void => {
  if (!quiet) console.error(message);
};

/** Whether the parameters of this run were announced (once a run, on the error stream). */
let paramsAnnounced = false;

/**
 * What is stale about a parameter file, as the wash judges it: the set says another set has
 * replaced it, or it was calibrated on another state of the water side or of the machine.
 */
function staleIssuesOf(file: string): string[] {
  const json = readJsonFile(file);
  // A file this tool wrote itself (`fit --out`) records no state it was fitted on: there is
  // nothing to compare, and it is the tool's own next input (`wash --params`). Only a set
  // that records what it was made on can be found to be made on something else.
  const records =
    typeof json === 'object' && json !== null && (json as { anchoredOn?: unknown }).anchoredOn;
  return [
    ...supersededIssues(json),
    ...(typeof records === 'object' && records !== null ? waterSideIssues(json) : []),
  ].map((issue) => issue.message);
}

function baseParams(): ParamSet {
  const file = one('params');
  const calibration = one('calibration');
  let params: ParamSet;
  if (file === undefined) {
    params = readCalibrationParams(
      undefined,
      calibration === undefined ? undefined : fromOrigin(calibration),
    );
    if (!paramsAnnounced) {
      console.error(
        'spotless-fit: parameters: the defaults of the registry (no --params). They are not ' +
          'the default set of a machine: for what the game washes with, give --params the ' +
          'file MACHINE_WASH_DEFAULTS names in packages/wash-runner/src/defaults.ts.',
      );
    }
  } else {
    // A stale set is refused as a wash refuses it: the calibration tool must not be the one
    // place where a set that another has replaced is used unknowingly.
    const stale = staleIssuesOf(fromOrigin(file));
    if (stale.length > 0 && !args.options.has('accept-stale-params')) {
      fail(
        `${fromOrigin(file)} is stale: ${stale.join('; ')}. Use the set that replaced it, or ` +
          'give --accept-stale-params to use its values knowingly (the output then marks the set stale).',
      );
    }
    if (!paramsAnnounced) {
      console.error(
        `spotless-fit: parameters: ${fromOrigin(file)}` +
          (stale.length > 0 ? ` (STALE, accepted: ${stale.join('; ')})` : ''),
      );
    }
    const read = readFittedParams(
      fromOrigin(file),
      calibration === undefined ? undefined : fromOrigin(calibration),
    );
    if (read.warning !== null) console.error(`spotless-fit: WARNING: ${read.warning}`);
    params = read.params;
  }
  const overrides: Record<string, ParamValue> = {};
  for (const setting of args.options.get('set') ?? []) {
    const at = setting.indexOf('=');
    if (at < 1) fail(`--set needs key=value, not "${setting}"`);
    const raw = setting.slice(at + 1);
    let value: ParamValue;
    try {
      value = JSON.parse(raw) as ParamValue;
    } catch {
      value = raw;
    }
    overrides[setting.slice(0, at)] = value;
  }
  if (Object.keys(overrides).length > 0) params = params.with(overrides);
  paramsAnnounced = true;
  return params;
}

function fitKeys(): string[] {
  const keys = list('fit');
  for (const group of list('group')) {
    const defs = calibrationRegistry().calibrationGroup(group);
    if (defs.length === 0) {
      fail(
        `no calibration group "${group}" (${calibrationRegistry().calibrationGroups().join(', ')})`,
      );
    }
    for (const def of defs) {
      if (def.kind !== 'enum' && def.min !== def.max && !keys.includes(def.key)) keys.push(def.key);
    }
  }
  if (keys.length === 0)
    fail('name the parameters with --fit key,key or --group <calibration group>');
  return keys;
}

function evaluatorOptions(): EvaluatorOptions {
  const cacheDir = args.options.has('no-cache')
    ? undefined
    : fromOrigin(one('cache') ?? join('.spotless', 'exposure-cache'));
  const restrict = one('restrict');
  const thin = number('thin');
  return {
    ...(cacheDir === undefined ? {} : { cache: diskExposureCache(cacheDir) }),
    ...(restrict === 'all' ? { restrict: 'all' as const } : {}),
    ...(thin === undefined ? {} : { thin }),
    onProgress: (what) => say(`  ${what}`),
  };
}

function derivativeOptions(): { step?: number; adapt?: boolean } {
  const step = number('step');
  return {
    ...(step === undefined ? {} : { step }),
    ...(args.options.has('no-adapt') ? { adapt: false } : {}),
  };
}

function records(): WashRecord[] {
  if (args.files.length === 0) fail('name at least one wash record');
  return args.files.map((file) => readWashRecordFile(file));
}

function describePreparation(info: Awaited<ReturnType<typeof prepareRecord>>['info']): string {
  return (
    `${info.items} items, ${info.blocks} blocks, ${info.soilCells} soil cells, ${info.deposits} deposits replayed ` +
    `(${info.depositsOfLoad} in the load), ${info.ticks} ticks, tier ${info.tier}; ` +
    `exposure ${info.exposureCacheHits} cached / ${info.exposureComputed} computed${info.exposureStandIn ? ' (stand-in stages)' : ''}; ` +
    `prepared in ${(Object.values(info.timings_ms).reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s\n` +
    `  ${info.restriction}` +
    info.notes.map((note) => `\n  note: ${note}`).join('')
  );
}

async function main(): Promise<void> {
  switch (args.command) {
    case 'validate': {
      if (args.files.length === 0) fail('name at least one wash record');
      let bad = 0;
      for (const file of args.files) {
        const result = validateWashRecord(readJsonFile(file));
        if (!result.ok) {
          bad++;
          console.log(`${file}: ${result.error.length} problems`);
          for (const issue of result.error)
            console.log(`  ${issue.path === '' ? '' : `${issue.path}: `}${issue.message}`);
          continue;
        }
        const record = result.value;
        const soils = record.load.items.reduce((n, item) => n + item.soils.length, 0);
        console.log(
          `${file}: valid ${record.kind} record ${record.id}: ${record.load.items.length} items, ${soils} soils, ${record.observations.length} observations`,
        );
        try {
          const machine = machineOfRecord(record);
          for (const change of machine.changes) console.log(`  machine: ${change}`);
          const course = programmeOfRecord(record, machine.spec, machine.config);
          for (const change of course.changes) {
            console.log(
              `  programme: ${change.step} ${change.field} ${change.from === null ? 'unset' : fmt(change.from, 5)} -> ${fmt(change.to, 5)} (${change.source})`,
            );
          }
          for (const anchor of course.check.anchors) {
            console.log(
              `  course: ${anchor.kind} measured at ${anchor.measured_s.toFixed(0)} s, timeline ${anchor.model_s.toFixed(0)} s`,
            );
          }
          if (course.check.duration !== undefined) {
            console.log(
              `  course: duration measured ${course.check.duration.measured_s.toFixed(0)} s, timeline ${course.check.duration.model_s.toFixed(0)} s`,
            );
          }
          if (course.check.temperature !== undefined) {
            console.log(
              `  course: liquor temperature against the log: rms ${course.check.temperature.rms_K.toFixed(1)} K, worst ${course.check.temperature.max_K.toFixed(1)} K over ${course.check.temperature.readings} readings`,
            );
          }
          if (course.check.energy !== undefined) {
            console.log(
              `  course: energy measured ${course.check.energy.measured_kWh.toFixed(3)} kWh, timeline ${course.check.energy.model_kWh.toFixed(3)} kWh`,
            );
          }
          for (const note of course.notes) console.log(`  note: ${note}`);
        } catch (error) {
          if (!(error instanceof RecordSetupError)) throw error;
          bad++;
          console.log(`  cannot be set up: ${error.message}`);
        }
      }
      if (bad > 0) process.exit(1);
      return;
    }

    case 'predict': {
      const [record] = records();
      if (record === undefined) fail('name a wash record');
      const params = baseParams();
      const prepared = await prepareRecord(record, params, evaluatorOptions());
      say(describePreparation(prepared.info));
      const prediction = await prepared.evaluate(params);
      const likelihood = recordLikelihood(record, prepared.observations, prediction);
      const rows: string[][] = [
        [
          'observation',
          'observed',
          'predicted',
          'sd',
          'residual',
          'log lik',
          'residue mg',
          'visible mm2',
          'specks',
          'score',
          'clean',
        ],
      ];
      prepared.observations.forEach((observation, i) => {
        const state = prediction.states[i];
        if (state === undefined) return;
        const m = predictiveMoments(
          observation.kind,
          prediction.eta[i] as number,
          observation.sd,
          prediction.constants,
        );
        const value = observation.value;
        const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value;
        rows.push([
          observation.id,
          value === undefined ? '-' : typeof value === 'boolean' ? String(value) : fmt(value),
          fmt(m.mean),
          fmt(m.sd),
          numeric === undefined || !(m.sd > 0) ? '-' : ((numeric - m.mean) / m.sd).toFixed(2),
          numeric === undefined ? '-' : (likelihood.perObservation[i] as number).toFixed(2),
          `${fmt(state.residualMass_mg)} / ${fmt(state.initialMass_mg)}`,
          `${fmt(state.visibleAreaMm2)} / ${fmt(state.soiledAreaMm2)}`,
          String(state.specks),
          String(state.score),
          String(state.clean),
        ]);
      });
      console.log(textTable(rows, [1, 2, 3, 4, 5, 8, 9]));
      const unfitted = prepared.observations.filter((o) => o.fitted === false);
      if (unfitted.length > 0) {
        console.log(
          `reported and not fitted (their log likelihood is not in the sum): ${unfitted.map((o) => o.id).join(', ')}`,
        );
      }
      const scenarios = prediction.scenarios;
      if (scenarios !== undefined) {
        // The inputs that were not measured: what each scenario of them predicts per item.
        console.log(
          `\n${scenarios.weights.length} input scenarios (sim.scenarios; the first is the record as written, shown above). ` +
            'Visible area mm2 / specks / clean per scenario; "log lik" above integrates them out:',
        );
        const seen = new Set<string>();
        const perItem: string[][] = [
          [
            'item',
            ...scenarios.weights.map((w, k) => `s${k} (${w.toFixed(2)})`),
            'median',
            'range',
          ],
        ];
        prepared.observations.forEach((observation, i) => {
          if (seen.has(observation.itemId) || observation.target !== 'item') return;
          seen.add(observation.itemId);
          const states = scenarios.states.map((each) => each[i]);
          const areas = states
            .map((state) => state?.visibleAreaMm2 ?? Number.NaN)
            .sort((a, b) => a - b);
          perItem.push([
            observation.itemId,
            ...states.map((state) =>
              state === undefined
                ? '-'
                : `${fmt(state.visibleAreaMm2)} / ${state.specks} / ${state.clean ? 'yes' : 'no'}`,
            ),
            fmt(areas[Math.floor(areas.length / 2)] as number),
            `${fmt(areas[0] as number)} .. ${fmt(areas[areas.length - 1] as number)}`,
          ]);
        });
        console.log(textTable(perItem, []));
      }
      if (record.observations.some((o) => o.value !== undefined)) {
        console.log(
          `log likelihood ${likelihood.logLikelihood.toFixed(3)} (weight ${likelihood.weight})`,
        );
      }
      const out = one('out');
      if (out !== undefined) {
        writeJsonFile(fromOrigin(out), {
          record: record.id,
          params: params.overrides,
          info: prepared.info,
          logLikelihood: likelihood.logLikelihood,
          scenarioWeights: prediction.scenarios?.weights ?? null,
          observations: prepared.observations.map((observation, i) => ({
            ...observation,
            logLikelihood: likelihood.perObservation[i],
            scenarios:
              prediction.scenarios?.states.map((states, k) => ({
                eta: (prediction.scenarios?.eta[k] as Float64Array)[i],
                state: states[i],
              })) ?? null,
            eta: prediction.eta[i],
            ...predictiveMoments(
              observation.kind,
              prediction.eta[i] as number,
              observation.sd,
              prediction.constants,
            ),
            state: prediction.states[i],
          })),
        });
        console.log(fromOrigin(out));
      }
      return;
    }

    case 'fit': {
      const data = records();
      const keys = list('fit').length > 0 || list('group').length > 0 ? fitKeys() : [];
      const water = list('water');
      if (keys.length === 0 && water.length === 0)
        fail('name the parameters with --fit and/or --water');
      const registry = calibrationRegistry();
      const hydro = keys.filter(
        (key) => registry.def(key.replace(/\[.*\]$/, '')).group === 'hydro',
      );
      if (hydro.length > 0) {
        fail(`${hydro.join(', ')} change the water: name them with --water, not --fit`);
      }
      const seed = number('seed');
      const starts = number('starts');
      const polish = number('polish');
      const scan = number('scan');
      const profiles = number('profiles');
      const draws = number('draws');
      const derivatives = derivativeOptions();
      const options = {
        base: baseParams(),
        evaluator: evaluatorOptions(),
        ...(seed === undefined ? {} : { seed }),
        ...(starts === undefined ? {} : { starts }),
        ...(polish === undefined ? {} : { polish }),
        ...(scan === undefined ? {} : { scanPoints: scan }),
        ...(profiles === undefined ? {} : { profiles }),
        ...(draws === undefined ? {} : { predictiveDraws: draws }),
        ...(derivatives.step === undefined ? {} : { jacobianStep: derivatives.step }),
        ...(derivatives.adapt === undefined ? {} : { adaptStep: derivatives.adapt }),
        ...(args.options.has('allow-standard') ? { allowStandardKeys: true } : {}),
        createdAt: new Date().toISOString(),
        ...(one('name') === undefined ? {} : { name: one('name') as string }),
        onProgress: (message: string) => say(`  ${message}`),
      };
      const outer =
        water.length > 0 ? await fitWithWaterParameters(data, keys, water, options) : undefined;
      const fit = outer?.inner ?? (await fitRecords(data, keys, options));
      console.log(outer?.report ?? fit.report);
      console.log(
        `\nfitted parameter set: hydro ${fit.paramSet.hydroHash}\n                      soil  ${fit.paramSet.soilHash}\n                      file  ${fit.paramSetHash}`,
      );
      const out = one('out');
      if (out !== undefined) {
        const dir = fromOrigin(out);
        writeJsonFile(join(dir, 'params.json'), fit.paramSet);
        writeJsonFile(join(dir, 'calibration.json'), fit.calibrationOverrides);
        writeJsonFile(join(dir, 'fit.json'), {
          records: data.map((r) => r.id),
          parameters: fit.parameters,
          water: outer?.water ?? [],
          start: fit.start,
          estimate: fit.estimate,
          covariance: fit.covariance,
          correlation: fit.correlation,
          bestLogPosterior: fit.bestLogPosterior,
          stepRounds: fit.stepRounds,
          stepConverged: fit.stepConverged,
          priorConflict: fit.priorConflict,
          profiles: fit.profiles,
          optima: fit.optima,
          restriction: fit.restriction,
          needsCalibrationKeys: fit.needsCalibrationKeys,
          washes: fit.washes.map((w) => ({
            recordId: w.recordId,
            exact: w.exact,
            notes: w.notes,
            programme: `programme-${w.recordId}.json`,
            washInput: `wash-input-${w.recordId}.json`,
          })),
          observations: fit.observations,
          predictive: fit.predictive,
          identifiability: {
            parameters: fit.identifiability.parameters,
            combinations: fit.identifiability.combinations,
          },
          paramSetHash: fit.paramSetHash,
          evaluations: fit.evaluations,
          computed: fit.computed,
          elapsed_s: fit.elapsed_s,
        });
        writeTextFile(join(dir, 'report.txt'), outer?.report ?? fit.report);
        // Per record: the programme with the fitted prog.* applied, and the whole input of
        // wash() that reproduces the fit (machine, configuration, programme, load, overrides).
        for (const made of fit.washes) {
          writeJsonFile(join(dir, `programme-${made.recordId}.json`), made.programme);
          writeJsonFile(join(dir, `wash-input-${made.recordId}.json`), made.input);
        }
        console.log(
          `written to ${dir}: params.json (the wash registry's format), calibration.json, fit.json, report.txt` +
            (fit.washes.length > 0
              ? `, and per record programme-<id>.json and wash-input-<id>.json (the input of wash() that reproduces the fit)`
              : ''),
        );
        if (fit.needsCalibrationKeys) {
          console.log(
            'NOTE: params.json alone is not this fit: a prog.* or cal.* key was fitted. Run `spotless-fit wash <record.json> --params ' +
              `${join(dir, 'params.json')}\` (it reads calibration.json beside it), or give wash() the wash-input file.`,
          );
        }
      }
      return;
    }

    case 'wash': {
      const [record] = records();
      if (record === undefined) fail('name a wash record');
      const params = baseParams();
      const prepared = await prepareRecord(record, params, evaluatorOptions());
      const made = prepared.washInputAt(params);
      for (const note of made.notes) say(`  not exact: ${note}`);
      const options = evaluatorOptions();
      const result = await wash(made.input, {
        ...(options.cache === undefined ? {} : { cache: options.cache }),
      });
      const rows: string[][] = [
        ['item', 'clean', 'score', 'residue mg', 'of mg', 'visible mm2', 'specks'],
      ];
      for (const item of result.items) {
        rows.push([
          item.itemId,
          String(item.clean),
          String(item.score),
          fmt(item.residualMass_mg),
          fmt(item.initialMass_mg),
          fmt(item.visibleAreaMm2),
          String(item.specks),
        ]);
      }
      console.log(textTable(rows, [2, 3, 4, 5, 6]));
      console.log(
        `wash() of ${record.id} at the fitted set: ${result.items.filter((i) => i.clean).length} of ${result.items.length} items clean` +
          (made.exact ? '' : ` (NOT what the fit predicted: ${made.notes.join('; ')})`),
      );
      const out = one('out');
      if (out !== undefined) {
        writeJsonFile(fromOrigin(out), {
          record: record.id,
          exact: made.exact,
          notes: made.notes,
          provenance: result.provenance,
          items: result.items.map((item) => ({
            itemId: item.itemId,
            clean: item.clean,
            score: item.score,
            initialMass_mg: item.initialMass_mg,
            residualMass_mg: item.residualMass_mg,
            visibleAreaMm2: item.visibleAreaMm2,
            specks: item.specks,
          })),
        });
        console.log(fromOrigin(out));
      }
      return;
    }

    case 'sensitivity': {
      const data = records();
      const keys = fitKeys();
      const result = await sensitivity(data, keys, {
        base: baseParams(),
        evaluator: evaluatorOptions(),
        ...derivativeOptions(),
        ...(args.options.has('allow-standard') ? { allowStandardKeys: true } : {}),
      });
      console.log(result.report.table);
      console.log(
        `\nstep of the derivatives (share of each prior deviation): ${result.jacobian.parameters.map((p, j) => `${p.id} ${fmt(result.jacobian.steps[j] as number, 2)}`).join(', ')}; ${result.jacobian.stepRounds} rounds` +
          (result.jacobian.stepConverged ? '' : '; THE DEVIATIONS HAD NOT SETTLED'),
      );
      console.log(
        'local: these are properties of the parameter values the derivatives were taken at',
      );
      console.log('');
      console.log(
        'scaled sensitivities (move of each prediction in noise deviations per prior deviation of each parameter):',
      );
      console.log(sensitivityTable(result.jacobian, number('rows') ?? 40));
      const out = one('out');
      if (out !== undefined) {
        writeJsonFile(fromOrigin(out), {
          records: data.map((r) => r.id),
          parameters: result.jacobian.parameters,
          rows: result.jacobian.rows,
          fisher: result.report.fisher,
          identifiability: {
            parameters: result.report.parameters,
            combinations: result.report.combinations,
          },
          covariance: result.report.covariance,
          correlation: result.report.correlation,
        });
        console.log(fromOrigin(out));
      }
      return;
    }

    case 'rank': {
      const candidates = records();
      const keys = fitKeys();
      const existing = list('existing').map((file) => readWashRecordFile(fromOrigin(file)));
      const interest = list('interest');
      const draws = number('draws');
      const seed = number('seed');
      const posterior = one('posterior');
      let covariance: number[][] | undefined;
      if (posterior !== undefined) {
        const earlier = readJsonFile(fromOrigin(posterior)) as {
          parameters?: { id: string }[];
          covariance?: number[][];
        };
        const ids = (earlier.parameters ?? []).map((p) => p.id);
        const wanted = fitParameters(keys).map((p) => p.id);
        if (earlier.covariance === undefined || wanted.some((id, i) => ids[i] !== id)) {
          fail(
            `${posterior} is not a fit of ${wanted.join(', ')} in this order (it has ${ids.join(', ')})`,
          );
        }
        covariance = earlier.covariance;
      }
      const result = await rankExperiments(candidates, keys, {
        base: baseParams(),
        evaluator: evaluatorOptions(),
        ...derivativeOptions(),
        ...(existing.length === 0 ? {} : { existing }),
        ...(interest.length === 0 ? {} : { interest }),
        ...(draws === undefined ? {} : { draws }),
        ...(seed === undefined ? {} : { seed }),
        ...(covariance === undefined ? {} : { covariance }),
        onProgress: (message) => say(`  ${message}`),
      });
      console.log(result.table);
      const out = one('out');
      if (out !== undefined) {
        writeJsonFile(fromOrigin(out), {
          ranking: result.ranking,
          points: result.points,
          gains_bits: result.gains_bits,
          local: result.local,
          fisher: result.fisher,
        });
        console.log(fromOrigin(out));
      }
      return;
    }

    case 'check-scale': {
      const [record] = records();
      const scale = one('scale');
      if (record === undefined || scale === undefined)
        fail('usage: check-scale <record.json> --scale cal.jetShearScale');
      const options = evaluatorOptions();
      const check = await checkReplayScale(record, scale, {
        base: baseParams(),
        ...(options.cache === undefined ? {} : { cache: options.cache }),
      });
      console.log(check.summary);
      if (!check.exact) process.exitCode = 1;
      return;
    }

    case 'manifest': {
      const [record] = records();
      if (record === undefined) fail('name a wash record');
      const machine = machineOfRecord(record);
      const made = washManifestFromRecord(record, machine.spec, machine.config);
      for (const id of made.omitted)
        say(`  left out (custom shape, not a catalogue item type): ${id}`);
      for (const note of made.notes) say(`  ${note}`);
      const out = one('out');
      if (out === undefined) console.log(JSON.stringify(made.manifest, null, 2));
      else {
        writeJsonFile(fromOrigin(out), made.manifest);
        console.log(fromOrigin(out));
      }
      return;
    }

    case 'from-manifest': {
      const [file] = args.files;
      const id = one('id');
      if (file === undefined || id === undefined)
        fail('usage: from-manifest <manifest.json> --id <record id>');
      const record = recordFromManifest(readJsonFile(file) as WashManifest, { id });
      const checked = validateWashRecord(JSON.parse(JSON.stringify(record)));
      if (!checked.ok) {
        for (const issue of checked.error) console.error(`  ${issue.path}: ${issue.message}`);
        fail('the manifest does not give a valid record', 1);
      }
      const out = one('out');
      if (out === undefined) console.log(JSON.stringify(record, null, 2));
      else {
        writeJsonFile(fromOrigin(out), record);
        console.log(fromOrigin(out));
      }
      return;
    }

    case 'params': {
      const registry = calibrationRegistry();
      const groups = list('group');
      const rows: string[][] = [
        [
          'key',
          'unit',
          'default',
          'range',
          'tag',
          'group',
          'route',
          'fitted in',
          'prior centre',
          'prior sd',
        ],
      ];
      for (const def of registry.defs) {
        if (def.kind === 'enum' || def.min === def.max) continue;
        if (groups.length > 0 && !groups.includes(def.calibration ?? '')) continue;
        if (groups.length === 0 && def.calibration === undefined) continue;
        for (const parameter of fitParameters([def.key])) {
          rows.push([
            parameter.id,
            parameter.unit,
            fmt(parameter.default),
            `${fmt(parameter.min)} .. ${fmt(parameter.max)}`,
            parameter.tag,
            def.calibration ?? '-',
            isStandardKey(parameter.key) ? 'standard: not fitted' : parameter.route,
            parameter.transform,
            fmt(fromZ(parameter, parameter.priorMean)),
            fmt(parameter.priorSd),
          ]);
        }
      }
      console.log(textTable(rows, [2, 8, 9]));
      console.log(`\ncalibration groups: ${registry.calibrationGroups().join(', ')}`);
      console.log(
        'route: observation = no replay; replay = one replay per record on cached exposure; hydro = a new exposure per value (use --water); standard = a constant a standard defines, fitted only with --allow-standard\n' +
          'range: the range a fit keeps to (a floor replaces a registered lower end of 0 for a quantity fitted in its logarithm); prior sd: in the coordinate named under "fitted in"; no end of a range is more than one prior deviation from the centre',
      );
      return;
    }

    default:
      fail(args.command === '' ? USAGE : `unknown command "${args.command}"\n${USAGE}`);
  }
}

try {
  await main();
} catch (error) {
  if (
    error instanceof WashRecordError ||
    error instanceof RecordSetupError ||
    error instanceof CalibrationFileError ||
    error instanceof RangeError
  ) {
    console.error(`spotless-fit: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
