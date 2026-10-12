/**
 * Fitting (docs/calibration/fitting.md section 5): the maximum a posteriori estimate of chosen
 * parameters from wash records, with its uncertainty and its checks.
 *
 *   1. starts      the current values, and points drawn over the ranges (a seeded Latin
 *                  hypercube within 1.5 prior deviations of the centres, which for the priors
 *                  of the registry is the whole range); every start is evaluated and the best
 *                  of them are minimised as well as the current values
 *   2. minimise    Nelder-Mead (`optimise.ts`) in two stages. First on the log posterior
 *                  without the allowance for gross errors, which has a slope however far the
 *                  predictions are from the observations; then, from every distinct point
 *                  reached, on the log posterior itself, in which a value that cannot be
 *                  right no longer pulls. Each parameter is then scanned across its whole
 *                  range (the others held): a second hump that the starts missed is minimised
 *                  from too
 *   3. curvature   the derivatives of every prediction at the optimum give the Fisher
 *                  information F; C = (F + P)^-1 with the prior precision P is the covariance
 *                  of the estimate (the Gauss-Newton form of the local curvature: it is never
 *                  indefinite and does not difference the objective twice across its kinks).
 *                  The step of the derivatives is chosen from the answer (`sensitivity.ts`).
 *                  The same evaluations give the second difference of the log posterior along
 *                  each parameter, reported beside it as a check, and catch an optimum that is
 *                  not one: a stepped point that is better restarts the minimisation
 *   4. background  where the replay is restricted to the observed items, what the other
 *                  soils release is computed again at the estimate and the fit is minimised
 *                  again from there, so that the estimate does not rest on a background
 *                  frozen at the start; the restricted and the full predictions at the
 *                  estimate are compared and the difference reported
 *   5. identify    a parameter whose prior variance the records reduce by less than a quarter
 *                  at the optimum is a candidate to go back to its prior centre. That local
 *                  verdict is not trusted alone: on a plateau (soil that barely comes off)
 *                  nothing is locally sensitive, yet the records may exclude the prior centre
 *                  outright. The candidates are put back, the others minimised again, and the
 *                  log posterior compared with that of the optimum: the reset is kept only if
 *                  it costs less than `resetTolerance` (0.5). Otherwise the candidates are
 *                  tried one by one, and what cannot go back stays at the optimum and is
 *                  reported as "not locally identified, but the records exclude the prior
 *                  centre"
 *   6. bounds      an estimate on an end of its registered range, with the log posterior
 *                  still rising towards it, is reported as such, with a one-sided interval:
 *                  it usually means that the model or a parameter held fixed is wrong
 *   7. profiles    for the fitted parameters (three by default), the log posterior maximised
 *                  over all the others on a grid of the parameter that is carried on until
 *                  the log posterior has fallen by 1.92 or the bound is reached, with the end
 *                  of the interval then bracketed (2 (L_max - L) <= 3.84). The interval of a
 *                  profiled parameter is its profile's: it does not assume the posterior is
 *                  normal and follows a ridge of equally good fits that the derivatives at the
 *                  optimum know nothing of. The normal interval is printed beside it and a
 *                  difference of more than 30 % flagged. A re-fit along a profile that finds a
 *                  better point than the estimate restarts the minimisation from it, once
 *   8. check       per record, a posterior predictive check (parameters drawn from the normal
 *                  approximation, observations drawn at each, the deviance of the real
 *                  observations compared with that of the drawn ones), and per observation
 *                  the posterior probability that it is a gross error
 *
 * Output: the fitted set in the registry's own format (`ParamSet.toJSON()` of the wash
 * registry, with its two hashes), the calibration's own keys beside it, and per record the
 * programme with the fitted `prog.*` applied and the input of `wash()` that reproduces the
 * fit: the parameter file alone does not when a `prog.*` or `cal.*` key was fitted. Also what
 * moved and by how much against its prior; how far the prior pulled the estimate from where
 * the records alone would put it; every other local optimum found; the fit to every
 * observation; and the report as text.
 *
 * Deterministic: the same records, options and seed give the same result (wall-clock times
 * apart).
 */

import { canonicalHash, randomNormal, randomUniform } from '@spotless/core';
import type { ProgrammeSpec } from '@spotless/machine';
import {
  createWashParams,
  type ParamSet,
  type ParamSetJson,
  type ParamValue,
  type WashInput,
} from '@spotless/sim-core';
import {
  calibrationOverridesOf,
  isWashShapingCalibrationKey,
  REPLAY_SCALES,
  washOverridesOf,
} from './cal-params.ts';
import { cholesky, inverseSpd, type Matrix } from './mathx.ts';
import { logLikelihood as likelihoodOf, outlierSpan, sampleObservation } from './observation.ts';
import {
  createObjective,
  fromZ,
  zOf,
  type FitParameter,
  type ObjectiveOptions,
  type ObjectiveValue,
} from './objective.ts';
import { minimise, type MinimiseOptions, type MinimiseTrace } from './optimise.ts';
import { observationIdOf, observationSd, type WashRecord } from './record.ts';
import {
  adaptiveJacobian,
  fisherOf,
  identifiability,
  type IdentifiabilityReport,
  type Jacobian,
} from './sensitivity.ts';
import { fmt, stringKey, textTable } from './util.ts';

/** Options of {@link fitRecords}. */
export interface FitOptions extends ObjectiveOptions {
  /** Seed of the start points and of the predictive draws (u32); default 1. */
  readonly seed?: number;
  /** Start points drawn from the prior besides the current values; default 4. */
  readonly starts?: number;
  /**
   * How many of the best drawn starts are minimised (one run each, without restarts); default
   * 3. Each costs some tens of replays per parameter: with a load whose replay takes many
   * seconds, 1 is the economical choice.
   */
  readonly polish?: number;
  /** Evaluations of one Nelder-Mead run; default 60 n + 40. */
  readonly maxEvaluations?: number;
  /** Restarts of the minimisation from the current values; default 2. */
  readonly restarts?: number;
  /** A simplex whose log posteriors lie within this has converged; default 0.01. */
  readonly fTolerance?: number;
  /** ... and whose points lie within this many prior deviations of each other; default 0.02. */
  readonly xTolerance?: number;
  /** First step of the derivatives as a share of each prior deviation; default 0.1. */
  readonly jacobianStep?: number;
  /** False to keep that step and not choose it from the posterior deviation; default true. */
  readonly adaptStep?: boolean;
  /** Put parameters the records do not identify back at their prior centre; default true. */
  readonly resetUnidentified?: boolean;
  /** Most log posterior a reset to the prior centre may cost and be kept; default 0.5. */
  readonly resetTolerance?: number;
  /**
   * Profile this many of the most informative parameters, or the named ones; default 3 (and
   * every parameter that sits on a bound). 0 for none.
   */
  readonly profiles?: number | readonly string[];
  /** Grid points of a profile on each side of the estimate, 0.7 posterior deviations apart; default 4. */
  readonly profileSteps?: number;
  /**
   * Further grid points on a side whose log posterior has not yet fallen by 1.92 after those,
   * each twice as far as the one before, up to the bound; default 6.
   */
  readonly profileExtend?: number;
  /**
   * Points of the scan of each parameter across its range that looks for a second optimum;
   * default 24, 0 for no scan.
   */
  readonly scanPoints?: number;
  /** Other local optima are listed when within this many log units of the best; default 5. */
  readonly optimaWithin?: number;
  /** Draws of the posterior predictive check; default 20, 0 for no check. */
  readonly predictiveDraws?: number;
  /**
   * Rounds in which the background of a restricted replay is computed again at the estimate
   * and the fit minimised again; default 2, 0 to leave it where the pool first computed it.
   */
  readonly refineBackground?: number;
  /** Compare the restricted with the full predictions at the estimate; default true. */
  readonly checkRestriction?: boolean;
  /** Name and time written into the provenance of the fitted set. */
  readonly name?: string;
  readonly createdAt?: string;
  readonly onProgress?: (message: string) => void;
}

/** One fitted parameter. */
export interface FittedParameter {
  readonly id: string;
  readonly key: string;
  readonly unit: string;
  readonly transform: FitParameter['transform'];
  /** Registered default and the range of the fit. */
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly tag: string;
  /** Centre of the prior in the unit of the parameter, and its deviation in the transformed coordinate. */
  readonly priorCentre: number;
  readonly priorSd: number;
  /** The value the fit started from, and the estimate. */
  readonly start: number;
  readonly estimate: number;
  /** The estimate in the transformed coordinate, and its posterior deviation there. */
  readonly z: number;
  readonly sd: number;
  /**
   * 95 % interval in the unit of the parameter: the profile's where the parameter was profiled
   * (`intervalFrom` says which), with the bound of the range for an end the profile did not
   * find before it; else that of the normal approximation. For an estimate on a bound it is
   * one-sided by construction.
   */
  readonly interval: readonly [number, number];
  readonly intervalFrom: 'profile' | 'normal';
  /** The interval of the normal approximation, z +- 1.96 sd, inside the range. */
  readonly normalInterval: readonly [number, number];
  /** How far it moved from its prior centre: in prior deviations, and as a share of its range. */
  readonly movedSd: number;
  readonly movedRange: number;
  /** Posterior over prior deviation, and the share of the prior variance removed. */
  readonly shrink: number;
  readonly contraction: number;
  /** The local verdict, from the derivatives at the estimate. */
  readonly verdict: 'identified' | 'weak' | 'not identified';
  /**
   * What the fit says of it, in words: the local verdict, or that it was returned to its
   * prior, or that it is not locally identified although the records exclude the prior
   * centre, or that it sits on a bound of its range.
   */
  readonly status: string;
  /** True when the fit put it back at its prior centre because the records do not identify it. */
  readonly returnedPrior: boolean;
  /** `lower` or `upper` when the estimate sits on that end of its range with the log posterior rising towards it. */
  readonly atBound: 'lower' | 'upper' | null;
  /**
   * The fall of the log posterior when this parameter alone is moved from the estimate to its
   * prior centre (the others held): what the records say against the prior centre, which sees
   * one-sided information that the local derivatives do not. 0 for a returned parameter.
   */
  readonly priorCentreDrop: number;
  /**
   * How far the prior pulled the estimate, in posterior deviations: the linearised distance
   * from the estimate to where the records alone would put the parameter (positive: the
   * records want it higher), and that value. Beyond 2 either way the prior and the records
   * disagree.
   */
  readonly priorPull: number;
  readonly recordsAlone: number;
  /** The step of the derivatives used for it, as a share of its prior deviation. */
  readonly step: number;
  /**
   * Deviation from the second difference of the log posterior along this parameter alone, in
   * the transformed coordinate (the others held); null where the log posterior is not concave
   * there or the parameter sits on a bound.
   */
  readonly curvatureSd: number | null;
  /** The profile interval, if it was profiled, and whether it departs from the normal one by over 30 %. */
  readonly profileInterval: readonly [number | null, number | null] | null;
  readonly profileDisagrees: boolean;
  readonly confoundedWith: readonly { readonly id: string; readonly correlation: number }[];
}

/** The profile of one parameter. */
export interface ParameterProfile {
  readonly id: string;
  /** Grid values in the unit of the parameter, ascending, with the profiled log posterior. */
  readonly values: readonly number[];
  readonly logPosterior: readonly number[];
  /** 95 % interval where 2 (L_max - L) <= 3.84; an end is null where the grid did not reach it. */
  readonly interval: readonly [number | null, number | null];
}

/** The fit to one observation. */
export interface ObservationFit {
  readonly recordId: string;
  readonly observationId: string;
  readonly kind: string;
  readonly observed: number | boolean | undefined;
  /** The scalar prediction, and mean and deviation of the predicted observation. */
  readonly eta: number;
  readonly mean: number;
  readonly sd: number;
  /** (observed - mean) / sd; NaN without a value. */
  readonly residual: number;
  readonly logLikelihood: number;
  /** Posterior probability that the value is a gross error (`obs.outlierShare`); 0 without a value. */
  readonly outlierProbability: number;
}

/** The posterior predictive check of one record. */
export interface PredictiveCheck {
  readonly recordId: string;
  readonly draws: number;
  /** Share of draws whose replicated deviance is at least that of the real observations. */
  readonly pValue: number;
  /** Mean deviance of the real and of the replicated observations over the draws. */
  readonly deviance: number;
  readonly replicatedDeviance: number;
  /** Observations whose residual at the estimate is beyond three deviations. */
  readonly outliers: readonly string[];
  /** Observations more likely a gross error than not. */
  readonly grossErrors: readonly string[];
}

/** Another local optimum of the log posterior. */
export interface LocalOptimum {
  /** The values of the fitted parameters there, in their units. */
  readonly values: readonly number[];
  readonly logPosterior: number;
  /** Its largest distance from the estimate over the parameters, in posterior deviations. */
  readonly distanceSd: number;
}

/** How the restricted replay of a record compares with the full one at the estimate. */
export interface RestrictionCheck {
  readonly recordId: string;
  /** Times the background was computed again at the estimate. */
  readonly refreshed: number;
  /**
   * The change of the log posterior at the estimate the last time the background was moved to
   * it: how far the fit still was from one that agrees with its own background (0 when the
   * background was never moved).
   */
  readonly lastShift: number;
  /** Largest difference of a prediction, restricted against full, in deviations of its observation. */
  readonly worstSd: number;
  readonly worstObservation: string;
  /** Largest absolute difference per observation kind. */
  readonly byKind: Readonly<Record<string, number>>;
}

/** What reproduces the fit to one record in `wash()`. */
export interface FittedWash {
  readonly recordId: string;
  /** The programme of the record with the fitted `prog.*` applied. */
  readonly programme: ProgrammeSpec;
  /** The input of `wash()`: machine, configuration, that programme, the load, the overrides. */
  readonly input: WashInput;
  /** False, with the reasons in `notes`, where `wash()` cannot do what the fit did. */
  readonly exact: boolean;
  readonly notes: readonly string[];
}

/** What a fit returns. */
export interface FitResult {
  readonly parameters: readonly FittedParameter[];
  /** The objective at the start and at the estimate. */
  readonly start: {
    readonly logPosterior: number;
    readonly logLikelihood: number;
    readonly logPrior: number;
  };
  readonly estimate: {
    readonly logPosterior: number;
    readonly logLikelihood: number;
    readonly logPrior: number;
  };
  /** The best log posterior any minimisation reached (the estimate's, unless a reset cost a little). */
  readonly bestLogPosterior: number;
  /**
   * The log posterior of a point a profile found above the estimate's after the fit had
   * already been minimised again from such a point once; null in a settled fit. Not null: the
   * optimum was not found, fit again with more starts.
   */
  readonly unsettled: number | null;
  /** Posterior covariance and correlation in the transformed coordinates. */
  readonly covariance: Matrix;
  readonly correlation: Matrix;
  readonly identifiability: IdentifiabilityReport;
  /** Rounds of step refinement of the derivatives, and whether the posterior deviations settled. */
  readonly stepRounds: number;
  readonly stepConverged: boolean;
  /** The log likelihood the records alone could gain over the estimate, linearised (prior-data conflict). */
  readonly priorConflict: number;
  readonly profiles: readonly ParameterProfile[];
  /** Other local optima within `optimaWithin` of the estimate, best first. */
  readonly optima: readonly LocalOptimum[];
  readonly observations: readonly ObservationFit[];
  readonly predictive: readonly PredictiveCheck[];
  readonly restriction: readonly RestrictionCheck[];
  /** Per record, what reproduces the fit in `wash()` (empty for an evaluator that cannot say). */
  readonly washes: readonly FittedWash[];
  /** The fitted set on the calibration registry. */
  readonly fitted: ParamSet;
  /** The fitted set of the wash simulation as a parameter file, and the hash of that document. */
  readonly paramSet: ParamSetJson;
  readonly paramSetHash: string;
  /** The calibration's own keys that differ from their defaults (`obs.*`, `cal.*`, `prog.*`). */
  readonly calibrationOverrides: Readonly<Record<string, ParamValue>>;
  /**
   * True when `paramSet` alone does not reproduce the fit in `wash()`: a `prog.*` or `cal.*`
   * key differs from its default. Use `washes`.
   */
  readonly needsCalibrationKeys: boolean;
  /** The minimisations run. */
  readonly traces: readonly MinimiseTrace[];
  /** Evaluations of the objective asked for, and replays actually computed. */
  readonly evaluations: number;
  readonly computed: number;
  readonly elapsed_s: number;
  /** The whole report as text. */
  readonly report: string;
}

const STREAM_STARTS = 0x73747274;
const STREAM_DRAWS = 0x64726177;
const STREAM_REPLICA = 0x7265706c;

/**
 * Latin hypercube points over the part of each range that lies within `reach` prior deviations
 * of the prior centre (uniform there: no point is piled onto a bound).
 */
function priorStarts(
  parameters: readonly FitParameter[],
  count: number,
  seed: number,
  reach = 1.5,
): number[][] {
  const points: number[][] = Array.from({ length: count }, () => []);
  parameters.forEach((parameter, j) => {
    const order = Array.from({ length: count }, (_, k) => k).sort(
      (a, b) => randomUniform(seed, STREAM_STARTS, j, a) - randomUniform(seed, STREAM_STARTS, j, b),
    );
    const lo = Math.max(parameter.lower, parameter.priorMean - reach * parameter.priorSd);
    const hi = Math.min(parameter.upper, parameter.priorMean + reach * parameter.priorSd);
    for (let k = 0; k < count; k++) {
      const u = ((order[k] as number) + randomUniform(seed, STREAM_STARTS, j, count + k)) / count;
      (points[k] as number[]).push(lo + (hi - lo) * u);
    }
  });
  return points;
}

/**
 * Fits the parameters `keys` to `records`: see the file comment. `options.base` holds every
 * other parameter and the values the fit starts from.
 */
export async function fitRecords(
  records: readonly WashRecord[],
  keys: readonly string[],
  options: FitOptions = {},
): Promise<FitResult> {
  const started = performance.now();
  const say = (message: string): void => options.onProgress?.(message);
  const objective = createObjective(records, keys, options);
  const { parameters } = objective;
  const n = parameters.length;
  const seed = (options.seed ?? 1) >>> 0;
  const fTolerance = options.fTolerance ?? 0.01;
  const settings: MinimiseOptions = {
    lower: parameters.map((p) => p.lower),
    upper: parameters.map((p) => p.upper),
    step: parameters.map((p) => 0.35 * p.priorSd),
    maxEvaluations: options.maxEvaluations ?? 60 * n + 40,
    fTolerance,
    xTolerance: 2 * (options.xTolerance ?? 0.02),
    restarts: options.restarts ?? 2,
  };
  /** A short run: one simplex of half the size, no restart. */
  const short: MinimiseOptions = {
    ...settings,
    step: settings.step.map((h) => 0.5 * h),
    maxEvaluations: Math.min(settings.maxEvaluations, 30 * n + 20),
    restarts: 0,
  };
  const costCore = async (z: readonly number[]): Promise<number> =>
    -(await objective.evaluate(z)).coreLogPosterior;
  const cost = async (z: readonly number[]): Promise<number> =>
    -(await objective.evaluate(z)).logPosterior;
  const jacobianOptions = {
    step: options.jacobianStep ?? 0.1,
    adapt: options.adaptStep !== false,
  };
  /** Largest distance between two points over the parameters, in prior deviations. */
  const apart = (a: readonly number[], b: readonly number[]): number =>
    Math.max(
      0,
      ...parameters.map((p, j) => Math.abs((a[j] as number) - (b[j] as number)) / p.priorSd),
    );

  // 1. Starts.
  const z0 = objective.clip(zOf(objective.base, parameters));
  const startValue = await objective.evaluate(z0);
  say(`start: log posterior ${startValue.logPosterior.toFixed(3)}`);
  const drawn = priorStarts(parameters, Math.max(0, options.starts ?? 4), seed);
  const scored: { z: number[]; f: number }[] = [];
  for (const z of drawn) scored.push({ z, f: await costCore(z) });
  scored.sort((a, b) => a.f - b.f);

  // 2. Minimise: without the allowance for gross errors first, then with it.
  const traces: MinimiseTrace[] = [];
  /** Every point a minimisation of the log posterior itself ended at. */
  const reached: number[][] = [];
  let z = [...z0];
  let fz = await cost(z0);
  const take = (trace: MinimiseTrace): void => {
    reached.push([...trace.x]);
    if (trace.f < fz) {
      z = [...trace.x];
      fz = trace.f;
    }
  };
  const run = async (
    from: readonly number[],
    label: string,
    how: MinimiseOptions = settings,
  ): Promise<MinimiseTrace> => {
    const trace = await minimise(cost, from, how);
    traces.push(trace);
    take(trace);
    say(`${label}: log posterior ${(-trace.f).toFixed(3)} after ${trace.evaluations} evaluations`);
    return trace;
  };
  const core: number[][] = [];
  if (n > 0) {
    const first = await minimise(costCore, z0, settings);
    traces.push(first);
    core.push([...first.x]);
    say(
      `from the current values: ${(-first.f).toFixed(3)} without the gross-error allowance after ${first.evaluations} evaluations`,
    );
    for (const start of scored.slice(0, Math.max(0, options.polish ?? 3))) {
      const trace = await minimise(costCore, start.z, { ...settings, restarts: 0 });
      traces.push(trace);
      say(
        `from a prior draw: ${(-trace.f).toFixed(3)} without the gross-error allowance after ${trace.evaluations} evaluations`,
      );
      if (core.every((x) => apart(x, trace.x) > 0.05)) core.push([...trace.x]);
    }
    for (const x of core) {
      const value = await objective.evaluate(x);
      if (value.logPosterior === value.coreLogPosterior) {
        // No observation has the allowance: the two objectives are one.
        reached.push([...x]);
        if (-value.logPosterior < fz) {
          z = [...x];
          fz = -value.logPosterior;
        }
      } else await run(x, 'with the gross-error allowance', short);
    }
  }

  // A scan of each parameter across its range, the others held: a hump apart from the one the
  // estimate sits on is minimised from.
  const scanPoints = Math.max(0, Math.round(options.scanPoints ?? 24));
  if (n > 0 && scanPoints >= 3) {
    const humps: number[][] = [];
    for (let j = 0; j < n; j++) {
      const parameter = parameters[j] as FitParameter;
      // Every stage that is many evaluations long says that it has begun: a fit that is at
      // work must not look like one that hangs.
      say(
        `scan of ${parameter.id} across its range: ${scanPoints} points (--scan 0 leaves it out)`,
      );
      const grid: { at: number; value: number }[] = [];
      for (let k = 0; k < scanPoints; k++) {
        const at = parameter.lower + ((parameter.upper - parameter.lower) * k) / (scanPoints - 1);
        grid.push({ at, value: -(await cost(z.map((v, i) => (i === j ? at : v)))) });
      }
      const home = grid.reduce(
        (best, g, k) =>
          Math.abs(g.at - (z[j] as number)) <
          Math.abs((grid[best] as { at: number }).at - (z[j] as number))
            ? k
            : best,
        0,
      );
      for (let k = 0; k < grid.length; k++) {
        const g = grid[k] as { at: number; value: number };
        const left = grid[k - 1]?.value ?? -Infinity;
        const right = grid[k + 1]?.value ?? -Infinity;
        if (g.value < left || g.value < right || g.value < -fz - 8 || Math.abs(k - home) < 2)
          continue;
        // A dip of half a log unit between this hump and the estimate makes it another one.
        let lowest = Infinity;
        for (let i = Math.min(k, home); i <= Math.max(k, home); i++)
          lowest = Math.min(lowest, (grid[i] as { value: number }).value);
        if (g.value - lowest < 0.5) continue;
        humps.push(z.map((v, i) => (i === j ? g.at : v)));
      }
    }
    for (const hump of humps.slice(0, 2 * n))
      await run(hump, 'from a second hump of a scan', short);
  }

  // 3. Curvature, with a check that the optimum is one.
  say('derivatives at the estimate');
  let jacobian: Jacobian = await adaptiveJacobian(objective, z, jacobianOptions);
  for (let round = 0; round < 2 && n > 0; round++) {
    let better: ObjectiveValue | undefined;
    for (const value of [...jacobian.plus, ...jacobian.minus]) {
      if (value.logPosterior > (better ?? jacobian.centre).logPosterior + fTolerance)
        better = value;
    }
    if (better === undefined) break;
    await run(better.z, 'from a better point found by the derivatives');
    jacobian = await adaptiveJacobian(objective, z, jacobianOptions);
  }

  // 4. The background of a restricted replay, computed again at the estimate.
  const refreshed: number[] = records.map(() => 0);
  const rounds = Math.max(0, options.refineBackground ?? 2);
  /** The change of the log posterior at the estimate when the background was last moved to it. */
  let lastShift = 0;
  const refresh = async (): Promise<boolean> => {
    const at = objective.paramsAt(z);
    let any = false;
    for (let r = 0; r < records.length; r++) {
      const prepared = await objective.pool.get(records[r] as WashRecord, at);
      if (prepared.refreshBackground !== undefined && (await prepared.refreshBackground(at))) {
        any = true;
        refreshed[r] = (refreshed[r] as number) + 1;
      }
    }
    if (!any) return false;
    objective.forget();
    const before = fz;
    fz = await cost(z);
    lastShift = Math.abs(fz - before);
    say(
      `background computed again at the estimate: log posterior ${(-before).toFixed(3)} -> ${(-fz).toFixed(3)}`,
    );
    // What was reached before rests on the old background: only the estimate is carried over.
    reached.length = 0;
    reached.push([...z]);
    return true;
  };
  for (let round = 0; round < rounds; round++) {
    if (!(await refresh())) break;
    if (lastShift < 0.05 || n === 0) {
      jacobian = await adaptiveJacobian(objective, z, jacobianOptions);
      break;
    }
    const from = [...z];
    await run(z, 'with the background at the estimate', short);
    if (round === rounds - 1 && apart(from, z) > 0) {
      // The estimate moved once more: leave the background where the estimate is.
      await refresh();
    }
    jacobian = await adaptiveJacobian(objective, z, jacobianOptions);
  }
  // Stages 5 to 7 are run on the estimate, and once more if a profile finds a better point
  // than any minimisation did (a curved valley that the simplex gave up in).
  let report = identifiability(parameters, fisherOf(jacobian), jacobian.rows);
  let bestLogPosterior = -fz;
  let optimum = [...z];
  const returned = new Set<number>();
  const excluded = new Set<number>();
  const resetTolerance = options.resetTolerance ?? 0.5;
  let final = jacobian.centre;
  const sdOf = (j: number): number =>
    Math.sqrt(Math.max((report.covariance[j] as number[])[j] as number, 0));
  let atBound: ('lower' | 'upper' | null)[] = [];
  let priorCentreDrop: number[] = [];
  let pull: number[] = [];
  let priorConflict = 0;
  const profiles: ParameterProfile[] = [];
  const settle = async (): Promise<{ z: number[]; logPosterior: number } | null> => {
    report = identifiability(parameters, fisherOf(jacobian), jacobian.rows);
    bestLogPosterior = -fz;
    optimum = [...z];
    returned.clear();
    excluded.clear();
    profiles.length = 0;
    let better: { z: number[]; logPosterior: number } | null = null;

    // 5. What the records do not identify goes back to the prior, if that costs nothing.
    if (options.resetUnidentified !== false) {
      const candidates = report.parameters
        .map((p, j) => (p.verdict === 'not identified' ? j : -1))
        .filter((j) => j >= 0);
      /** The optimum with `set` at their prior centres and the others minimised again. */
      const reset = async (set: ReadonlySet<number>): Promise<{ z: number[]; f: number }> => {
        const fixed = optimum.map((v, j) =>
          set.has(j) ? (parameters[j] as FitParameter).priorMean : v,
        );
        const free = parameters.map((_, j) => j).filter((j) => !set.has(j));
        if (free.length > 0) {
          const inner = await minimise(
            (x) =>
              cost(fixed.map((v, j) => (free.includes(j) ? (x[free.indexOf(j)] as number) : v))),
            free.map((j) => fixed[j] as number),
            {
              ...settings,
              lower: free.map((j) => settings.lower[j] as number),
              upper: free.map((j) => settings.upper[j] as number),
              step: free.map((j) => 0.5 * (settings.step[j] as number)),
              maxEvaluations: 40 * free.length + 20,
              restarts: 1,
            },
          );
          free.forEach((j, k) => (fixed[j] = inner.x[k] as number));
        }
        const at = objective.clip(fixed);
        return { z: at, f: await cost(at) };
      };
      if (candidates.length > 0) {
        let kept = new Set(candidates);
        let trial = await reset(kept);
        if (trial.f - fz > resetTolerance) {
          // Together they cost too much: try them one by one, the least informed first, each on
          // top of those already accepted and without minimising the others again.
          kept = new Set<number>();
          const order = [...candidates].sort(
            (a, b) =>
              (report.parameters[a]?.contraction ?? 0) - (report.parameters[b]?.contraction ?? 0),
          );
          for (const j of order) {
            const set = new Set([...kept, j]);
            const at = objective.clip(
              optimum.map((v, i) => (set.has(i) ? (parameters[i] as FitParameter).priorMean : v)),
            );
            if ((await cost(at)) - fz <= resetTolerance) kept = set;
          }
          trial = kept.size > 0 ? await reset(kept) : { z: optimum, f: fz };
          if (trial.f - fz > resetTolerance) {
            kept = new Set<number>();
            trial = { z: optimum, f: fz };
          }
        }
        for (const j of candidates) (kept.has(j) ? returned : excluded).add(j);
        if (returned.size > 0) {
          z = [...trial.z];
          jacobian = await adaptiveJacobian(objective, z, jacobianOptions);
          report = identifiability(parameters, fisherOf(jacobian), jacobian.rows);
          say(
            `${returned.size} parameters not identified: returned to their priors (log posterior ${bestLogPosterior.toFixed(3)} -> ${jacobian.centre.logPosterior.toFixed(3)})`,
          );
        }
        if (excluded.size > 0) {
          say(
            `${excluded.size} parameters are not locally identified but the records exclude their prior centres: kept at the optimum`,
          );
        }
      }
    }
    final = jacobian.centre;

    // 6. Bounds: an estimate on an end of its range with the log posterior rising towards it.
    atBound = parameters.map((parameter, j) => {
      if (returned.has(j)) return null;
      const width = parameter.upper - parameter.lower;
      const zj = z[j] as number;
      const inner = (value: ObjectiveValue | undefined): boolean =>
        value !== undefined &&
        value !== final &&
        final.logPosterior - value.logPosterior > fTolerance;
      if (parameter.upper - zj <= 1e-3 * width && inner(jacobian.minus[j])) return 'upper';
      if (zj - parameter.lower <= 1e-3 * width && inner(jacobian.plus[j])) return 'lower';
      return null;
    });

    // The fall of the log posterior with each parameter alone at its prior centre.
    priorCentreDrop = [];
    for (let j = 0; j < n; j++) {
      const parameter = parameters[j] as FitParameter;
      if (returned.has(j) || (z[j] as number) === parameter.priorMean) {
        priorCentreDrop.push(0);
        continue;
      }
      const at = z.map((v, i) => (i === j ? parameter.priorMean : v));
      priorCentreDrop.push(final.logPosterior - (await objective.evaluate(at)).logPosterior);
    }

    // How far the prior pulled: where the records alone would put the estimate, linearised.
    // F delta = P (z - m), with a twentieth of the prior precision left in F to keep it regular.
    pull = parameters.map(() => 0);
    priorConflict = 0;
    if (n > 0) {
      const regular = report.fisher.map((row, i) =>
        row.map((v, k) => v + (i === k ? 0.05 / (parameters[i] as FitParameter).priorSd ** 2 : 0)),
      );
      const inverse = inverseSpd(regular);
      if (inverse !== null) {
        const gradient = parameters.map(
          (p, j) => ((z[j] as number) - p.priorMean) / p.priorSd ** 2,
        );
        for (let i = 0; i < n; i++) {
          let delta = 0;
          for (let k = 0; k < n; k++)
            delta += ((inverse[i] as number[])[k] as number) * (gradient[k] as number);
          pull[i] = delta;
        }
        for (let i = 0; i < n; i++)
          for (let k = 0; k < n; k++)
            priorConflict +=
              0.5 *
              (pull[i] as number) *
              ((report.fisher[i] as number[])[k] as number) *
              (pull[k] as number);
      }
    }

    // 7. Profiles.
    const asked = options.profiles ?? 3;
    const wanted: number[] =
      typeof asked === 'number'
        ? parameters
            .map((_, j) => j)
            .filter((j) => !returned.has(j))
            .sort(
              (a, b) =>
                (report.parameters[b]?.contraction ?? 0) - (report.parameters[a]?.contraction ?? 0),
            )
            .slice(0, asked)
        : asked
            .map((id) => parameters.findIndex((p) => p.id === id || p.key === id))
            .filter((j) => j >= 0);
    if (typeof asked !== 'number' || asked > 0) {
      atBound.forEach((side, j) => {
        if (side !== null && !wanted.includes(j)) wanted.push(j);
      });
    }
    const steps = Math.max(1, options.profileSteps ?? 4);
    const extend = Math.max(0, options.profileExtend ?? 6);
    for (const j of wanted) {
      const parameter = parameters[j] as FitParameter;
      const delta = Math.max(0.7 * sdOf(j), 0.05 * parameter.priorSd);
      say(
        `profile of ${parameter.id} (${wanted.indexOf(j) + 1} of ${wanted.length}): the other parameters fitted again at every point (--profiles 0 leaves the profiles out)`,
      );
      // Every other parameter is re-fitted along the profile, those returned to their priors
      // too: at the optimum the records say nothing about them, but along a curved ridge they
      // are what lets the profiled parameter move.
      const others = parameters.map((_, i) => i).filter((i) => i !== j);
      interface GridPoint {
        /** The value of the profiled parameter, the profiled log posterior, and the point. */
        z: number;
        logPosterior: number;
        point: number[];
      }
      const grid: GridPoint[] = [
        { z: z[j] as number, logPosterior: final.logPosterior, point: [...z] },
      ];
      // How the others follow the profiled parameter according to the local covariance: the
      // re-fit at each grid point starts from there, with a simplex of their posterior
      // deviations (not of their prior's, which can be a hundred times as wide).
      const row = report.covariance[j] as number[];
      const slope = others.map((i) =>
        (row[j] as number) > 0 ? (row[i] as number) / (row[j] as number) : 0,
      );
      /** The profiled log posterior at `at`, the others re-fitted from `start`. */
      const refit = async (
        start: readonly number[],
        at: number,
        wide: number,
      ): Promise<GridPoint> => {
        const held = start.map((v, i) => (i === j ? at : v));
        if (others.length === 0) return { z: at, logPosterior: -(await cost(held)), point: held };
        const inner = await minimise(
          (x) =>
            cost(
              held.map((v, i) =>
                i === j ? at : others.includes(i) ? (x[others.indexOf(i)] as number) : v,
              ),
            ),
          others.map((i) => held[i] as number),
          {
            ...settings,
            lower: others.map((i) => settings.lower[i] as number),
            upper: others.map((i) => settings.upper[i] as number),
            step: others.map((i) =>
              Math.min(
                0.5 * (settings.step[i] as number),
                wide * Math.max(0.5 * sdOf(i), 0.01 * (parameters[i] as FitParameter).priorSd),
              ),
            ),
            maxEvaluations: 20 * others.length + 10,
            fTolerance,
            xTolerance: 0.1,
            restarts: 0,
          },
        );
        return {
          z: at,
          logPosterior: -inner.f,
          point: held.map((v, i) =>
            i === j ? at : others.includes(i) ? (inner.x[others.indexOf(i)] as number) : v,
          ),
        };
      };
      const note = (found: GridPoint): void => {
        grid.push(found);
        if (
          found.logPosterior >
          Math.max(bestLogPosterior, better?.logPosterior ?? -Infinity) + 0.25
        )
          better = { z: [...found.point], logPosterior: found.logPosterior };
      };
      const fallOf = (g: GridPoint): number => 2 * (final.logPosterior - g.logPosterior);
      for (const side of [-1, 1]) {
        const bound = side === 1 ? parameter.upper : parameter.lower;
        // `steps` even steps, then steps that double until the log posterior has fallen by the
        // 1.92 of the interval, the bound is reached or the extension runs out: a ridge that the
        // local deviation knows nothing of is followed to its end.
        let last = grid[0] as GridPoint;
        let inside = last;
        let outside: GridPoint | null = null;
        let stride = delta;
        for (let k = 1; k <= steps + extend; k++) {
          if (last.z === bound) break;
          if (k > steps) stride *= 2;
          const at =
            side === 1 ? Math.min(bound, last.z + stride) : Math.max(bound, last.z - stride);
          const start = last.point.map((v, i) => {
            const o = others.indexOf(i);
            if (o < 0) return v;
            const moved = v + (slope[o] as number) * (at - last.z);
            return Math.min(
              settings.upper[i] as number,
              Math.max(settings.lower[i] as number, moved),
            );
          });
          const found = await refit(start, at, Math.max(1, Math.abs(at - last.z) / delta));
          note(found);
          last = found;
          if (fallOf(found) >= 3.84) {
            outside = found;
            break;
          }
          inside = found;
        }
        // The end of the interval lies between the last point inside and the first outside.
        // A log posterior that is quadratic has a fall whose root is linear in the parameter:
        // the end is looked for there, and the bracket narrowed, three times at most. (Along a
        // kink the log posterior can fall by many units within one step of the grid.)
        for (let r = 0; r < 3 && outside !== null; r++) {
          if (Math.abs(outside.z - inside.z) <= 0.2 * delta) break;
          const ra = Math.sqrt(Math.max(fallOf(inside), 0));
          const rb = Math.sqrt(fallOf(outside));
          const share = Math.min(0.85, Math.max(0.15, (1.96 - ra) / Math.max(rb - ra, 1e-9)));
          const at = inside.z + share * (outside.z - inside.z);
          const a: GridPoint = inside;
          const b: GridPoint = outside;
          const start = a.point.map((v, i) => v + share * ((b.point[i] as number) - v));
          const found = await refit(start, at, 1);
          note(found);
          if (fallOf(found) >= 3.84) outside = found;
          else inside = found;
        }
      }
      grid.sort((a, b) => a.z - b.z);
      const top = Math.max(...grid.map((g) => g.logPosterior));
      const crossing = (side: -1 | 1): number | null => {
        const ordered = side === 1 ? grid : [...grid].reverse();
        const peak = ordered.findIndex((g) => g.logPosterior === top);
        for (let k = peak + 1; k < ordered.length; k++) {
          const a = ordered[k - 1] as GridPoint;
          const b = ordered[k] as GridPoint;
          const ra = Math.sqrt(Math.max(2 * (top - a.logPosterior), 0));
          const rb = Math.sqrt(Math.max(2 * (top - b.logPosterior), 0));
          // Linear in the root of the fall: exact for a quadratic log posterior.
          if (rb >= 1.96)
            return fromZ(parameter, a.z + ((b.z - a.z) * (1.96 - ra)) / Math.max(rb - ra, 1e-12));
        }
        return null;
      };
      profiles.push({
        id: parameter.id,
        values: grid.map((g) => fromZ(parameter, g.z)),
        logPosterior: grid.map((g) => g.logPosterior),
        interval: [crossing(-1), crossing(1)],
      });
      say(`profile of ${parameter.id}: ${grid.length} points`);
    }
    return better;
  };
  let unsettled = await settle();
  if (unsettled !== null && n > 0) {
    say(
      `a profile found log posterior ${unsettled.logPosterior.toFixed(3)}, above the estimate's ${bestLogPosterior.toFixed(3)}: minimising again from there`,
    );
    z = [...optimum];
    await run(unsettled.z, 'from a better point found by a profile');
    jacobian = await adaptiveJacobian(objective, z, jacobianOptions);
    unsettled = await settle();
  }

  // The fit to every observation.
  const observations: ObservationFit[] = [];
  final.records.forEach((record, r) => {
    const source = records[r] as WashRecord;
    const prepared = jacobian.rows.filter((row) => row.recordId === record.recordId);
    source.observations.forEach((observation, o) => {
      const row = prepared[o];
      if (row === undefined) return;
      const value = observation.value;
      const numeric = typeof value === 'boolean' ? (value ? 1 : 0) : value;
      observations.push({
        recordId: record.recordId,
        observationId: observationIdOf(observation),
        kind: observation.kind,
        observed: value,
        eta: row.eta,
        mean: row.mean,
        sd: row.sd,
        residual:
          numeric === undefined ? Number.NaN : row.sd > 0 ? (numeric - row.mean) / row.sd : 0,
        logLikelihood: record.perObservation[o] as number,
        outlierProbability: value === undefined ? 0 : (record.outlier[o] as number),
      });
    });
  });

  // 8. Posterior predictive check.
  const predictive: PredictiveCheck[] = [];
  const draws = Math.max(0, options.predictiveDraws ?? 20);
  const hasValues = records.some((r) => r.observations.some((o) => o.value !== undefined));
  if (draws > 0 && hasValues) {
    say(`predictive check: ${draws} draws to evaluate (--draws 0 leaves it out)`);
    const factor = cholesky(report.covariance);
    const tObs: number[][] = records.map(() => []);
    const tRep: number[][] = records.map(() => []);
    for (let d = 0; d < draws; d++) {
      const xi = parameters.map((_, j) => randomNormal(seed, STREAM_DRAWS, d, j));
      const zd = z.map((v, i) => {
        let shift = 0;
        if (factor !== null)
          for (let k = 0; k <= i; k++)
            shift += ((factor[i] as number[])[k] as number) * (xi[k] as number);
        return v + shift;
      });
      const value = await objective.evaluate(zd);
      value.records.forEach((record, r) => {
        const source = records[r] as WashRecord;
        const prepared = record.prediction;
        let observed = 0;
        let replicated = 0;
        source.observations.forEach((observation, o) => {
          if (observation.value === undefined || observation.fitted === false) return;
          observed += -2 * (record.perObservation[o] as number);
          const sd = stated(source, o);
          const eta = prepared.eta[o] as number;
          const state = prepared.states[o];
          const span =
            state === undefined ? 0 : outlierSpan(observation.kind, state, prepared.constants);
          let counter = 0;
          const key = stringKey(record.recordId);
          const uniform = (): number => randomUniform(seed, STREAM_REPLICA, key, d, o, counter++);
          // With input scenarios a replicate is drawn from one of them, by weight, and scored
          // as the observation is: with the scenarios integrated out.
          const scenarios = prepared.scenarios;
          let drawnFrom = eta;
          if (scenarios !== undefined) {
            const u = uniform();
            let cumulative = 0;
            for (let k = 0; k < scenarios.weights.length; k++) {
              cumulative += scenarios.weights[k] as number;
              drawnFrom = (scenarios.eta[k] as Float64Array)[o] as number;
              if (u <= cumulative) break;
            }
          }
          const drawnValue = sampleObservation(
            observation.kind,
            drawnFrom,
            sd,
            prepared.constants,
            uniform,
            () => randomNormal(seed, STREAM_REPLICA, key, d, o, counter++),
            span,
          );
          if (scenarios === undefined) {
            replicated +=
              -2 * likelihoodOf(observation.kind, drawnValue, eta, sd, prepared.constants, span);
          } else {
            let total = 0;
            scenarios.eta.forEach((each, k) => {
              total +=
                (scenarios.weights[k] as number) *
                Math.exp(
                  likelihoodOf(
                    observation.kind,
                    drawnValue,
                    each[o] as number,
                    sd,
                    prepared.constants,
                    span,
                  ),
                );
            });
            replicated += -2 * Math.log(Math.max(total, 1e-300));
          }
        });
        (tObs[r] as number[]).push(observed);
        (tRep[r] as number[]).push(replicated);
      });
    }
    records.forEach((record, r) => {
      const obs = tObs[r] as number[];
      const rep = tRep[r] as number[];
      if (obs.length === 0 || record.observations.every((o) => o.value === undefined)) return;
      let exceed = 0;
      obs.forEach((t, d) => {
        if ((rep[d] as number) >= t) exceed++;
      });
      const own = observations.filter((o) => o.recordId === record.id);
      predictive.push({
        recordId: record.id,
        draws,
        pValue: exceed / obs.length,
        deviance: obs.reduce((a, b) => a + b, 0) / obs.length,
        replicatedDeviance: rep.reduce((a, b) => a + b, 0) / rep.length,
        outliers: own.filter((o) => Math.abs(o.residual) > 3).map((o) => o.observationId),
        grossErrors: own.filter((o) => o.outlierProbability > 0.5).map((o) => o.observationId),
      });
    });
    say(`predictive check: ${draws} draws`);
  }

  // Other local optima: what the minimisations reached, apart from the estimate.
  const optima: LocalOptimum[] = [];
  const within = options.optimaWithin ?? 5;
  const distanceOf = (a: readonly number[], b: readonly number[]): number =>
    Math.max(
      0,
      ...parameters.map((_, j) =>
        returned.has(j)
          ? 0
          : Math.abs((a[j] as number) - (b[j] as number)) / Math.max(sdOf(j), 1e-12),
      ),
    );
  const distinct: number[][] = [];
  for (const x of reached) {
    if (distanceOf(x, z) <= 3 || distinct.some((y) => distanceOf(x, y) <= 3)) continue;
    distinct.push(x);
    const value = (await objective.evaluate(x)).logPosterior;
    if (final.logPosterior - value > within) continue;
    optima.push({
      values: parameters.map((p, j) => fromZ(p, x[j] as number)),
      logPosterior: value,
      distanceSd: distanceOf(x, z),
    });
  }
  optima.sort((a, b) => b.logPosterior - a.logPosterior);

  // The parameters.
  const fitted = objective.paramsAt(z);
  const status = parameters.map((_, j): string => {
    const identity = report.parameters[j] as IdentifiabilityReport['parameters'][number];
    if (returned.has(j)) return 'not identified: prior returned';
    if (atBound[j] !== null) return `at the ${atBound[j]} bound of its range`;
    if (excluded.has(j) && identity.verdict === 'not identified')
      return 'not locally identified, but the records exclude the prior centre';
    return identity.verdict;
  });
  report = identifiability(parameters, report.fisher, jacobian.rows, status);
  const fittedParameters: FittedParameter[] = parameters.map((parameter, j) => {
    const sd = sdOf(j);
    const identity = report.parameters[j] as IdentifiabilityReport['parameters'][number];
    const up = jacobian.up[j] as number;
    const down = jacobian.down[j] as number;
    let curvatureSd: number | null = null;
    if (up > 0 && down > 0 && Math.abs(up - down) < 1e-9 * (up + down)) {
      const second =
        ((jacobian.plus[j] as ObjectiveValue).logPosterior -
          2 * final.logPosterior +
          (jacobian.minus[j] as ObjectiveValue).logPosterior) /
        (up * up);
      if (second < 0) curvatureSd = 1 / Math.sqrt(-second);
    }
    const zj = z[j] as number;
    const profile = profiles.find((p) => p.id === parameter.id);
    const normalInterval: [number, number] = [
      fromZ(parameter, zj - 1.96 * sd),
      fromZ(parameter, zj + 1.96 * sd),
    ];
    // Where the parameter was profiled the interval is the profile's: it follows a ridge or a
    // one-sided posterior that the normal approximation at the optimum cannot. An end the
    // profile did not find before the bound is the bound.
    const interval: [number, number] =
      profile === undefined
        ? normalInterval
        : [
            profile.interval[0] ?? fromZ(parameter, parameter.lower),
            profile.interval[1] ?? fromZ(parameter, parameter.upper),
          ];
    // The two side by side in the transformed coordinate.
    let profileDisagrees = false;
    if (profile !== undefined && sd > 0) {
      const zAt = (value: number): number =>
        Math.min(
          parameter.upper,
          Math.max(
            parameter.lower,
            parameter.transform === 'log'
              ? Math.log(value)
              : parameter.transform === 'logit'
                ? Math.log(value / (1 - value))
                : value,
          ),
        );
      for (const side of [0, 1] as const) {
        const byProfile = Math.abs(zAt(interval[side]) - zj);
        const byNormal = Math.abs(zAt(normalInterval[side]) - zj);
        if (Math.abs(byProfile - byNormal) > 0.3 * Math.max(byNormal, 0.05 * sd))
          profileDisagrees = true;
      }
    }
    return {
      id: parameter.id,
      key: parameter.key,
      unit: parameter.unit,
      transform: parameter.transform,
      default: parameter.default,
      min: parameter.min,
      max: parameter.max,
      tag: parameter.tag,
      priorCentre: fromZ(parameter, parameter.priorMean),
      priorSd: parameter.priorSd,
      start: fromZ(parameter, z0[j] as number),
      estimate: fromZ(parameter, zj),
      z: zj,
      sd,
      interval,
      normalInterval,
      intervalFrom: profile === undefined ? 'normal' : 'profile',
      movedSd: (zj - parameter.priorMean) / parameter.priorSd,
      movedRange: (zj - parameter.priorMean) / (parameter.upper - parameter.lower),
      shrink: identity.marginal,
      contraction: identity.contraction,
      verdict: identity.verdict,
      status: status[j] as string,
      returnedPrior: returned.has(j),
      atBound: atBound[j] ?? null,
      priorCentreDrop: priorCentreDrop[j] as number,
      priorPull: sd > 0 ? (pull[j] as number) / sd : 0,
      recordsAlone: fromZ(parameter, zj + (pull[j] as number)),
      step: jacobian.steps[j] as number,
      curvatureSd,
      profileInterval: profile?.interval ?? null,
      profileDisagrees,
      confoundedWith: identity.confoundedWith,
    };
  });

  // What reproduces the fit in wash(), and how the restricted replay compares with the full.
  const washes: FittedWash[] = [];
  const restriction: RestrictionCheck[] = [];
  for (let r = 0; r < records.length; r++) {
    const record = records[r] as WashRecord;
    const prepared = await objective.pool.get(record, fitted);
    if (prepared.washInputAt !== undefined) {
      const made = prepared.washInputAt(fitted);
      washes.push({ recordId: record.id, ...made });
    }
    if (
      options.checkRestriction !== false &&
      prepared.evaluateFull !== undefined &&
      prepared.backgroundAt?.() != null
    ) {
      const full = await prepared.evaluateFull(fitted);
      const rows = jacobian.rows.filter((row) => row.recordId === record.id);
      const byKind: Record<string, number> = {};
      let worstSd = 0;
      let worstObservation = '';
      rows.forEach((row, o) => {
        const difference = Math.abs(row.eta - (full.eta[o] as number));
        byKind[row.kind] = Math.max(byKind[row.kind] ?? 0, difference);
        // In deviations of the observation where it has one (a verdict's margin is in them).
        const scale = row.kind === 'clean' || row.kind === 'specks' || !(row.sd > 0) ? 1 : row.sd;
        if (difference / scale > worstSd) {
          worstSd = difference / scale;
          worstObservation = row.observationId;
        }
      });
      restriction.push({
        recordId: record.id,
        refreshed: refreshed[r] as number,
        lastShift,
        worstSd,
        worstObservation,
        byKind,
      });
    }
  }

  const calibrationOverrides = calibrationOverridesOf(fitted);
  const needsCalibrationKeys = Object.keys(calibrationOverrides).some((key) =>
    isWashShapingCalibrationKey(key),
  );
  const provenance = {
    name: options.name ?? `fit-${records.map((r) => r.id).join('+')}`.slice(0, 120),
    origin: 'calibration' as const,
    note:
      `spotless-fit: maximum a posteriori of ${keys.join(', ')} by Nelder-Mead with restarts; log posterior ${final.logPosterior.toFixed(3)}` +
      (needsCalibrationKeys
        ? `. NOT THE WHOLE FIT: ${Object.entries(calibrationOverrides)
            .filter(([key]) => isWashShapingCalibrationKey(key))
            .map(([key, value]) => `${key} = ${String(value)}`)
            .join(
              ', ',
            )} was fitted with it and is not a key of the wash simulation; use the calibration file and the adapted programme written beside this one`
        : ''),
    washRecords: records.map((r) => r.id),
    ...(options.createdAt === undefined ? {} : { createdAt: options.createdAt }),
  };
  const paramSet = createWashParams(washOverridesOf(fitted), provenance).toJSON();
  const result: Omit<FitResult, 'report'> = {
    parameters: fittedParameters,
    start: {
      logPosterior: startValue.logPosterior,
      logLikelihood: startValue.logLikelihood,
      logPrior: startValue.logPrior,
    },
    estimate: {
      logPosterior: final.logPosterior,
      logLikelihood: final.logLikelihood,
      logPrior: final.logPrior,
    },
    bestLogPosterior: Math.max(bestLogPosterior, final.logPosterior),
    unsettled: unsettled === null ? null : unsettled.logPosterior,
    covariance: report.covariance,
    correlation: report.correlation,
    identifiability: report,
    stepRounds: jacobian.stepRounds,
    stepConverged: jacobian.stepConverged,
    priorConflict,
    profiles,
    optima,
    observations,
    predictive,
    restriction,
    washes,
    fitted,
    paramSet,
    paramSetHash: canonicalHash(paramSet),
    calibrationOverrides,
    needsCalibrationKeys,
    traces,
    evaluations: objective.evaluations,
    computed: objective.computed,
    elapsed_s: (performance.now() - started) / 1000,
  };
  return { ...result, report: formatFitReport(result) };
}

function stated(record: WashRecord, index: number): number {
  const observation = record.observations[index];
  if (observation === undefined || observation.kind === 'clean' || observation.kind === 'specks')
    return 0;
  return observationSd(record, observation) ?? 0;
}

/** The report of a fit as text. */
export function formatFitReport(result: Omit<FitResult, 'report'>): string {
  const out: string[] = [];
  out.push(
    `log posterior ${result.start.logPosterior.toFixed(3)} at the start, ${result.estimate.logPosterior.toFixed(3)} at the estimate ` +
      `(log likelihood ${result.start.logLikelihood.toFixed(3)} -> ${result.estimate.logLikelihood.toFixed(3)}, log prior ${result.start.logPrior.toFixed(3)} -> ${result.estimate.logPrior.toFixed(3)})`,
  );
  if (result.bestLogPosterior - result.estimate.logPosterior > 5e-4) {
    out.push(
      `the best point any minimisation reached has log posterior ${result.bestLogPosterior.toFixed(3)}: returning unidentified parameters to their priors cost ${(result.bestLogPosterior - result.estimate.logPosterior).toFixed(3)}`,
    );
  }
  out.push(
    `${result.evaluations} evaluations of the objective, ${result.computed} computed, ${result.elapsed_s.toFixed(1)} s; ${result.traces.length} minimisations`,
  );
  if (result.unsettled !== null) {
    out.push(
      `WARNING: a profile found log posterior ${result.unsettled.toFixed(3)}, above the estimate's, after the fit had already been minimised again from such a point: the optimum is not settled. Fit again with more starts (--starts, --polish).`,
    );
  }
  const bound = result.parameters.filter((p) => p.atBound !== null);
  if (bound.length > 0) {
    out.push(
      `WARNING: ${bound.map((p) => `${p.id} sits on the ${p.atBound} bound of its registered range (${fmt(p.atBound === 'upper' ? p.max : p.min)})`).join('; ')}. ` +
        'The records pull beyond the range: the model, or a parameter that was held fixed, is probably wrong. The interval given is one-sided.',
    );
  }
  if (result.needsCalibrationKeys) {
    out.push(
      `NOTE: ${Object.entries(result.calibrationOverrides)
        .filter(([key]) => isWashShapingCalibrationKey(key))
        .map(
          ([key, value]) => `${key} = ${typeof value === 'number' ? fmt(value, 4) : String(value)}`,
        )
        .join(
          ', ',
        )} is part of this fit and is not a key of the wash simulation: the parameter file alone does not reproduce it. ` +
        'Use the wash input written per record (the programme with these applied), or `spotless-fit wash`.',
    );
  }
  out.push('');
  const rows: string[][] = [
    [
      'parameter',
      'unit',
      'default',
      'range',
      'tag',
      'estimate',
      '95 % interval',
      'moved (prior sd)',
      'of range',
      'post/prior sd',
      'step',
      'verdict',
    ],
  ];
  for (const p of result.parameters) {
    rows.push([
      p.id,
      p.unit,
      fmt(p.default),
      `${fmt(p.min)} .. ${fmt(p.max)}`,
      p.tag,
      fmt(p.estimate, 4),
      `${fmt(p.interval[0])} .. ${fmt(p.interval[1])}${p.intervalFrom === 'profile' ? ' (p)' : ''}`,
      `${p.movedSd >= 0 ? '+' : ''}${p.movedSd.toFixed(2)}`,
      `${(100 * p.movedRange).toFixed(0)} %`,
      p.shrink.toFixed(2),
      fmt(p.step, 2),
      p.status,
    ]);
  }
  out.push(textTable(rows, [2, 5, 7, 8, 9, 10]));
  out.push(
    `interval: (p) from the profile of the parameter (the others re-fitted along it), else the normal approximation at the estimate; step: of the derivatives behind the deviations, as a share of the prior deviation, chosen in ${result.stepRounds} rounds` +
      (result.stepConverged
        ? ''
        : '; THE DEVIATIONS HAD NOT SETTLED (they still changed by over 10 % with the step): read the profiles'),
  );
  // A pull counts as a conflict only where the records could really gain by following it.
  const conflict = result.parameters.filter(
    (p) => !p.returnedPrior && Math.abs(p.priorPull) > 2 && result.priorConflict > 2,
  );
  const against = result.parameters.filter((p) => !p.returnedPrior && p.priorCentreDrop > 2);
  if (conflict.length > 0 || against.length > 0) {
    out.push('');
    out.push('prior against records:');
    for (const p of result.parameters) {
      if (!conflict.includes(p) && !against.includes(p)) continue;
      out.push(
        `  ${p.id}: the log posterior falls by ${p.priorCentreDrop.toFixed(1)} with it at its prior centre ${fmt(p.priorCentre)}` +
          (conflict.includes(p)
            ? `; PRIOR-DATA CONFLICT: the prior holds the estimate ${Math.abs(p.priorPull).toFixed(1)} posterior deviations from where the records alone would put it (about ${fmt(p.recordsAlone)}, linearised)`
            : ''),
      );
    }
    out.push(
      `  the records alone could gain about ${result.priorConflict.toFixed(1)} of log likelihood over the estimate (linearised)`,
    );
  }
  const confounded = result.parameters.filter((p) => p.confoundedWith.length > 0);
  if (confounded.length > 0) {
    out.push('');
    out.push('confounded (posterior correlation beyond 0.8):');
    for (const p of confounded) {
      out.push(
        `  ${p.id} with ${p.confoundedWith.map((c) => `${c.id} (${c.correlation.toFixed(2)})`).join(', ')}`,
      );
    }
  }
  const scales = result.parameters.filter((p) => REPLAY_SCALES.some((s) => s.key === p.key));
  if (scales.length > 0) {
    out.push('');
    for (const p of scales) {
      const scale = REPLAY_SCALES.find((s) => s.key === p.key);
      out.push(
        `${p.id} = ${fmt(p.estimate, 4)} multiplies ${scale?.table}.${scale?.fields.join(', ')} of cached exposure at replay time` +
          (scale?.standsFor === null || scale === undefined
            ? ''
            : `; it stands in for ${scale.standsFor}, which check-scale must find exact before the scale is folded into it`),
      );
    }
  }
  out.push('');
  if (result.optima.length === 0) {
    out.push(
      'no other local optimum was found near the estimate in log posterior (from the starts and the scans of each parameter)',
    );
  } else {
    out.push(
      `WARNING: ${result.optima.length} other local optim${result.optima.length === 1 ? 'um' : 'a'} of the log posterior (estimate ${result.estimate.logPosterior.toFixed(2)}); the intervals describe the estimate's alone:`,
    );
    for (const o of result.optima) {
      out.push(
        `  log posterior ${o.logPosterior.toFixed(2)} at ${result.parameters.map((p, j) => `${p.id}=${fmt(o.values[j] as number)}`).join(' ')} (${o.distanceSd.toFixed(0)} posterior deviations away)`,
      );
    }
  }
  if (result.profiles.length > 0) {
    out.push('');
    out.push('profiles (the other parameters re-fitted at every value):');
    for (const profile of result.profiles) {
      const p = result.parameters.find((x) => x.id === profile.id);
      out.push(
        `  ${profile.id}: 95 % interval ${profile.interval[0] === null ? 'down to the bound' : fmt(profile.interval[0])} .. ${profile.interval[1] === null ? 'up to the bound' : fmt(profile.interval[1])}` +
          (p === undefined
            ? ''
            : ` (normal approximation ${fmt(p.normalInterval[0])} .. ${fmt(p.normalInterval[1])})`) +
          (p?.profileDisagrees === true
            ? '  DISAGREES by over 30 %: the posterior is not normal here, trust the profile'
            : ''),
      );
      out.push(
        `    ${profile.values.map((v, i) => `${fmt(v)}: ${(profile.logPosterior[i] as number).toFixed(2)}`).join('  ')}`,
      );
    }
  }
  if (result.restriction.length > 0) {
    out.push('');
    out.push(
      'restricted replay against the replay of every soil, at the estimate (largest difference of a prediction):',
    );
    for (const c of result.restriction) {
      out.push(
        `  ${c.recordId}: ${c.worstSd.toFixed(3)} deviations of its observation (${c.worstObservation}); ${Object.entries(
          c.byKind,
        )
          .map(([kind, d]) => `${kind} ${fmt(d)}`)
          .join(
            ', ',
          )}; background computed again ${c.refreshed} times, the last moving the log posterior by ${c.lastShift.toFixed(3)}` +
          (c.worstSd > 0.25 || c.lastShift > 0.5 ? '  LARGE: fit with restrict "all"' : ''),
      );
    }
  }
  const inexact = result.washes.filter((w) => !w.exact);
  if (inexact.length > 0) {
    out.push('');
    out.push('wash() cannot reproduce these records exactly:');
    for (const w of inexact) out.push(`  ${w.recordId}: ${w.notes.join('; ')}`);
  }
  out.push('');
  out.push('local identifiability at the estimate (from the derivatives there):');
  out.push(result.identifiability.table);
  if (result.predictive.length > 0) {
    out.push('');
    const rowsP: string[][] = [
      ['record', 'draws', 'deviance', 'replicated', 'p', 'beyond 3 sd', 'gross errors (P > 0.5)'],
    ];
    const some = (ids: readonly string[]): string =>
      ids.length === 0 ? '-' : ids.slice(0, 6).join(', ') + (ids.length > 6 ? ', ...' : '');
    for (const c of result.predictive) {
      rowsP.push([
        c.recordId,
        String(c.draws),
        c.deviance.toFixed(1),
        c.replicatedDeviance.toFixed(1),
        c.pValue.toFixed(2),
        some(c.outliers),
        some(c.grossErrors),
      ]);
    }
    out.push(
      'posterior predictive check (p near 0: the records scatter more than the model allows; near 1: less):',
    );
    out.push(textTable(rowsP, [1, 2, 3, 4]));
  }
  const withValue = result.observations.filter((o) => o.observed !== undefined);
  if (withValue.length > 0) {
    out.push('');
    const rowsO: string[][] = [
      [
        'record',
        'observation',
        'observed',
        'predicted',
        'sd',
        'residual',
        'log lik',
        'P(gross error)',
      ],
    ];
    for (const o of withValue) {
      rowsO.push([
        o.recordId,
        o.observationId,
        typeof o.observed === 'boolean' ? String(o.observed) : fmt(o.observed as number),
        fmt(o.mean),
        fmt(o.sd),
        o.residual.toFixed(2),
        o.logLikelihood.toFixed(2),
        o.outlierProbability.toFixed(2),
      ]);
    }
    out.push(
      'fit to each observation (predicted: the mean of the predicted observation; residual in its deviations):',
    );
    out.push(textTable(rowsO, [2, 3, 4, 5, 6, 7]));
  }
  return out.join('\n');
}

/**
 * Folds the replay-time scales of a fitted set into the registry keys they stand for
 * (`jets.kStag = default x cal.jetShearScale`, ...), for use once the exposure stage has been
 * checked to be linear in those keys (`checkReplayScale` in `outer.ts`). Returns the overrides
 * of the wash registry and what could not be folded because it leaves the registered range.
 */
export function foldReplayScales(fitted: ParamSet): {
  readonly overrides: Record<string, ParamValue>;
  readonly notes: readonly string[];
} {
  const overrides = washOverridesOf(fitted);
  const notes: string[] = [];
  for (const scale of REPLAY_SCALES) {
    const factor = fitted.get(scale.key);
    if (factor === 1) continue;
    if (scale.standsFor === null) {
      notes.push(
        `${scale.key} = ${fmt(factor)} stands for no registry key and is kept as a calibration key`,
      );
      continue;
    }
    const def = fitted.registry.def(scale.standsFor);
    if (def.kind === 'vector' || def.kind === 'enum') continue;
    const value = fitted.get(scale.standsFor) * factor;
    if (value < def.min || value > def.max) {
      notes.push(
        `${scale.key} = ${fmt(factor)} would put ${scale.standsFor} at ${fmt(value)}, outside ${def.min} to ${def.max}; it is not folded`,
      );
      continue;
    }
    overrides[scale.standsFor] = value;
    notes.push(
      `${scale.standsFor} = ${fmt(value, 4)} (${scale.key} = ${fmt(factor, 4)} folded in)`,
    );
  }
  return { overrides, notes };
}
