/**
 * The runner of the phenomena suite: any subset of the 48 scenarios, at one tier, with one
 * parameter set and one shared exposure cache, to a {@link SuiteReport}.
 *
 * Washes are collected over the chosen scenarios, deduplicated (scenarios share washes) and
 * run one after another in the order of their scenes, so that washes of one geometry follow
 * each other and reuse the scene `wash()` keeps. A wash that cannot run (a load that is not
 * built, an input the simulation refuses) makes its scenarios report `error`; it never stops
 * the suite.
 *
 * Node only.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createWashParams,
  SIM_VERSION,
  type ParamSetRecord,
  type ParamValue,
} from '@spotless/sim-core';
import { composeParamFiles, simulationFingerprint } from '@spotless/sim-core/node';
import { PRIMARY_MACHINE } from '@spotless/machine';
import { REPOSITORY_ROOT } from '../node/workspace.ts';
import { verdictOf, worse } from './bands.ts';
import { createHarness, type Harness } from './harness.ts';
import { CAPABILITY_NAMES, hasCapability, meanScore } from './measures.ts';
import { GROUP_A } from './scenarios-a.ts';
import { GROUPS_BCD } from './scenarios-b.ts';
import { GROUPS_EFG } from './scenarios-c.ts';
import type {
  Capability,
  CaseReport,
  CaseRun,
  CaseSpec,
  CheckReport,
  Scenario,
  ScenarioReport,
  SuiteReport,
  Tier,
  Verdict,
} from './types.ts';

/** The 48 phenomena of the checklist, P01 to P48. */
export const PHENOMENA: readonly Scenario[] = [...GROUP_A, ...GROUPS_BCD, ...GROUPS_EFG];

/** Default directory of the exposure cache of the suite (ignored by the repository). */
export const DEFAULT_CACHE_DIR = join(
  REPOSITORY_ROOT,
  'packages',
  'sim-verify',
  'phenomena',
  '.spotless',
  'exposure-cache',
);

/** Directory the reports are written to. */
export const REPORTS_DIR = join(REPOSITORY_ROOT, 'packages', 'sim-verify', 'phenomena', 'reports');

/** An exact pose that cuts deeper than this into something makes its scenario an error, mm. */
export const EXACT_OVERLAP_LIMIT_MM = 1;

/** A parameter set: a name for the report and overrides on the registry defaults. */
export interface ParamSetChoice {
  readonly name: string;
  readonly overrides: Readonly<Record<string, ParamValue>>;
  /**
   * The named sets the overrides were composed from, as the results record them; absent for
   * the registry defaults and for a plain map of key to value.
   */
  readonly records?: readonly ParamSetRecord[];
  /** The detergent dosed in place of the machine's own dose of the reference detergent. */
  readonly detergent?: { readonly name: string; readonly dose_g: number };
}

/** The registry defaults. */
export const REGISTRY_DEFAULTS: ParamSetChoice = { name: 'registry defaults', overrides: {} };

/**
 * Reads a parameter-set file: the JSON of `ParamSet.toJSON` (`overrides` beside the hashes and
 * definitions), or a plain map of key to value. The name of the set is the path as given.
 * Throws when the file is not one of the two.
 *
 * A `spotless.params` file is read as the game's runner reads it (`composeParamFiles`): a
 * stale one (written against another registry, or calibrated on another water side) throws
 * `StaleParamSetError` unless `acceptStale` is set, and is then recorded as stale in every
 * result and in the head of the report.
 */
export function readParamSetFile(path: string, acceptStale = false): ParamSetChoice {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`${path} is not a parameter set`);
  }
  const record = parsed as Record<string, unknown>;
  if (record['format'] === 'spotless.params') {
    const composed = composeParamFiles({
      paramSets: [path],
      ...(acceptStale ? { acceptStale } : {}),
    });
    createWashParams(composed.params);
    return { name: path, overrides: composed.params, records: composed.records };
  }
  const overrides = (
    typeof record['overrides'] === 'object' && record['overrides'] !== null
      ? record['overrides']
      : typeof record['params'] === 'object' && record['params'] !== null
        ? record['params']
        : record
  ) as Record<string, ParamValue>;
  // Validates the keys and values against the registry: throws `ParamSetError` otherwise.
  createWashParams(overrides);
  return { name: path, overrides };
}

/** Options of {@link runPhenomena}. */
export interface RunOptions {
  /** Ids of the scenarios to run (`P02`); default all. */
  readonly ids?: readonly string[];
  readonly tier: Tier;
  /** Default {@link REGISTRY_DEFAULTS}. */
  readonly paramSet?: ParamSetChoice;
  /** Default {@link DEFAULT_CACHE_DIR}. */
  readonly cacheDir?: string;
  /** Programme id of the washes whose case names none; default the scored programme (Eco 50). */
  readonly programme?: string;
  /** Seeds for washes that do not state their own; default 1. */
  readonly seed?: number;
  readonly log?: (line: string) => void;
}

function caseReport(run: CaseRun): CaseReport {
  const input = run.result;
  const soiled = input.items.filter((item) => item.initialMass_mg > 0);
  return {
    label: run.spec.label,
    what: run.spec.what,
    load: run.spec.load,
    programme: input.machine.programmeId,
    params: run.spec.params ?? {},
    dispenserBlocked: input.machine.dispenser === 'blocked',
    stalledArms: Object.fromEntries(
      input.machine.states.flatMap((state) =>
        state.arms.filter((arm) => arm.stalled).map((arm) => [arm.level, 1] as const),
      ),
    ),
    levelSeed: input.provenance.levelSeed,
    simSeed: input.provenance.simSeed,
    resultHash: input.provenance.resultHash,
    exposureBackend: input.provenance.exposureBackend,
    seconds: Math.round(run.seconds * 10) / 10,
    exposureCached: run.cached,
    items: input.items.length,
    cleanItems: input.items.filter((item) => item.clean).length,
    meanScore: soiled.length > 0 ? meanScore(run) : Number.NaN,
    liquor: run.liquor,
    surfaces: run.surfaces,
    exactOverlap_mm: Math.round(run.exactOverlap_mm * 100) / 100,
    exactOverlapWith: run.exactOverlapWith,
    problems: input.problems,
    loadNotes: run.load.notes,
  };
}

function evaluate(
  scenario: Scenario,
  runs: Readonly<Record<string, CaseRun>>,
  errors: readonly string[],
): ScenarioReport {
  const all = Object.values(runs);
  const has = (capability: Capability): boolean =>
    all.some((run) => hasCapability(run.result, capability));
  const missing = (scenario.requires ?? []).filter((capability) => !has(capability));
  const notes: string[] = [...errors];
  const checks: CheckReport[] = scenario.checks.map((c) => {
    const base = {
      id: c.id,
      quantity: c.quantity,
      unit: c.unit,
      decides: c.decides,
      expected: c.expected,
    };
    const lacking = [
      ...(c.requires ?? []).filter((capability) => !has(capability)),
      ...(c.decides ? missing : []),
    ];
    if (lacking.length > 0) {
      return {
        ...base,
        a: null,
        b: null,
        value: null,
        verdict: 'not covered' as const,
        note: `needs ${lacking.map((capability) => CAPABILITY_NAMES[capability]).join('; ')}`,
      };
    }
    if (errors.length > 0) {
      return {
        ...base,
        a: null,
        b: null,
        value: null,
        verdict: 'error' as const,
        note: 'a wash of the scenario did not run',
      };
    }
    try {
      const measured = c.measure(runs);
      const verdict = verdictOf(measured.value, c.expected);
      return {
        ...base,
        a: measured.a ?? null,
        b: measured.b ?? null,
        value: measured.value,
        verdict,
        note: verdict === 'error' ? 'the measured value is not a number' : '',
      };
    } catch (error) {
      return {
        ...base,
        a: null,
        b: null,
        value: null,
        verdict: 'error' as const,
        note: error instanceof Error ? error.message : String(error),
      };
    }
  });
  let verdict: Verdict = 'pass';
  if (errors.length > 0) verdict = 'error';
  else if (missing.length > 0) {
    verdict = 'not covered';
    notes.push(`needs ${missing.map((capability) => CAPABILITY_NAMES[capability]).join('; ')}`);
  } else {
    for (const c of checks) if (c.decides) verdict = worse(verdict, c.verdict);
  }
  for (const run of all) {
    if (run.exactOverlap_mm > EXACT_OVERLAP_LIMIT_MM) {
      verdict = 'error';
      notes.push(
        `wash ${run.spec.label}: the set pose cuts ${run.exactOverlap_mm.toFixed(1)} mm (${run.exactOverlapWith})`,
      );
    }
  }
  return {
    id: scenario.id,
    title: scenario.title,
    group: scenario.group,
    test: scenario.test,
    adapted: scenario.adapted,
    stages: scenario.stages,
    verdict,
    note: notes.join('; '),
    checks,
    cases: scenario.cases
      .map((spec) => runs[spec.label])
      .filter((run): run is CaseRun => run !== undefined)
      .map(caseReport),
  };
}

/** Runs scenarios against a harness and returns their reports, in the order given. */
export async function runScenarios(
  scenarios: readonly Scenario[],
  harness: Harness,
  log?: (line: string) => void,
): Promise<ScenarioReport[]> {
  // Every wash of every scenario, deduplicated and ordered by scene.
  interface Job {
    readonly spec: CaseSpec;
    readonly sceneKey: string;
    readonly caseKey: string;
  }
  const jobs: Job[] = [];
  const broken = new Map<CaseSpec, string>();
  for (const scenario of scenarios) {
    for (const spec of scenario.cases) {
      try {
        jobs.push({ spec, sceneKey: harness.sceneKey(spec), caseKey: harness.caseKey(spec) });
      } catch (error) {
        broken.set(spec, error instanceof Error ? error.message : String(error));
      }
    }
  }
  jobs.sort((a, b) =>
    a.sceneKey < b.sceneKey
      ? -1
      : a.sceneKey > b.sceneKey
        ? 1
        : a.caseKey < b.caseKey
          ? -1
          : a.caseKey > b.caseKey
            ? 1
            : 0,
  );
  const done = new Map<CaseSpec, CaseRun>();
  for (const job of jobs) {
    try {
      done.set(job.spec, await harness.run(job.spec));
    } catch (error) {
      broken.set(job.spec, error instanceof Error ? error.message : String(error));
      log?.(`  wash ${job.spec.load} failed: ${broken.get(job.spec)}`);
    }
  }
  return scenarios.map((scenario) => {
    const runs: Record<string, CaseRun> = {};
    const errors: string[] = [];
    for (const spec of scenario.cases) {
      const run = done.get(spec);
      if (run !== undefined) runs[spec.label] = run;
      else errors.push(`wash ${spec.label}: ${broken.get(spec) ?? 'did not run'}`);
    }
    const report = evaluate(scenario, runs, errors);
    log?.(`${report.id} ${report.verdict}${report.note === '' ? '' : ` (${report.note})`}`);
    return report;
  });
}

/** Runs a subset of the suite and returns its report. Throws a RangeError for an unknown id. */
export async function runPhenomena(options: RunOptions): Promise<SuiteReport> {
  const started = performance.now();
  const paramSet = options.paramSet ?? REGISTRY_DEFAULTS;
  const wanted = options.ids ?? PHENOMENA.map((scenario) => scenario.id);
  const chosen = wanted.map((id) => {
    const scenario = PHENOMENA.find((s) => s.id === id);
    if (scenario === undefined) throw new RangeError(`no phenomenon '${id}' (P01 to P48)`);
    return scenario;
  });
  const seed = options.seed;
  const seeded =
    seed === undefined
      ? chosen
      : chosen.map((scenario) => ({
          ...scenario,
          cases: scenario.cases.map((spec) => ({
            ...spec,
            levelSeed: spec.levelSeed ?? seed,
            simSeed: spec.simSeed ?? seed,
          })),
        }));
  const harness = createHarness({
    tier: options.tier,
    cacheDir: options.cacheDir ?? DEFAULT_CACHE_DIR,
    params: paramSet.overrides,
    ...(options.programme === undefined ? {} : { programme: options.programme }),
    ...(paramSet.records === undefined ? {} : { paramSets: paramSet.records }),
    ...(paramSet.detergent === undefined ? {} : { detergent: paramSet.detergent }),
    ...(options.log === undefined ? {} : { log: options.log }),
  });
  const scenarios = await runScenarios(seeded, harness, options.log);
  const params = createWashParams(paramSet.overrides);
  const counts: Record<Verdict, number> = {
    pass: 0,
    'wrong sign': 0,
    'too small': 0,
    'too large': 0,
    'not covered': 0,
    error: 0,
  };
  for (const scenario of scenarios) counts[scenario.verdict] += 1;
  return {
    suite: 'spotless-phenomena',
    tier: options.tier,
    simVersion: SIM_VERSION,
    paramSet: paramSet.name,
    paramOverrides: paramSet.overrides,
    paramSetsStale: (paramSet.records ?? []).filter((r) => r.stale).map((r) => r.name),
    ...(paramSet.detergent === undefined ? {} : { detergent: paramSet.detergent }),
    sourceFingerprint: simulationFingerprint(),
    ...(options.programme === undefined ? {} : { programme: options.programme }),
    hydroHash: params.hydroHash,
    soilHash: params.soilHash,
    exposureBackend: [
      ...new Set(scenarios.flatMap((scenario) => scenario.cases.map((c) => c.exposureBackend))),
    ]
      .sort()
      .join(' and '),
    machineId: PRIMARY_MACHINE.id,
    scenarios,
    counts,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    washes: harness.washes,
    washesCached: harness.washesCached,
  };
}

/**
 * The six cheapest scenarios that cover different mechanisms, for the unit test: pools and
 * basins (P01), line of sight of the jets (P02), chemistry delivery (P25), soil ageing (P29),
 * drainage of a recess (P36) and the fixed exposure under a change of liquor (P48). They wash
 * six small scenes between them.
 */
export const QUICK_IDS = ['P01', 'P02', 'P25', 'P29', 'P36', 'P48'] as const;
