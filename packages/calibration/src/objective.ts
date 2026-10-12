/**
 * The objective of a fit: the log posterior of a chosen set of parameters given a set of wash
 * records (docs/calibration/fitting.md section 3).
 *
 *   log posterior(z) = sum over records r of  w_r  sum over its observations o of
 *                        log p(y_o | eta_o(theta(z)))          (`observation.ts`)
 *                    + sum over parameters j of  -1/2 ((z_j - m_j) / s_j)^2
 *
 * **Transforms.** The optimiser works in a coordinate z_j per parameter in which a normal
 * prior is reasonable: the logit for a fraction (a range of exactly 0 to 1); the logarithm for
 * a positive scale-like quantity (a declared or implied logarithmic range, a positive range
 * that spans a factor of four or more, or a range that starts at 0 whose default lies a factor
 * of four or more below its upper end: the range is then cut at a floor of the default over
 * ten, or the default squared over the upper end if that is lower, in place of 0); the value
 * itself otherwise.
 *
 * **Priors** come from the registry. The registered range is the statement of where the value
 * may lie, and the prior is made to agree with it: a normal in z, centred on the transformed
 * registered default, cut off at the ends of the range, whose deviation s_j is the distance from
 * the centre to the farther end of the range times a factor that depends on the confidence tag
 * of the default: 1 for VERIFIED and MEASURED (the farther end is one deviation away), 1.25 for
 * RECALLED, 1.5 for ESTIMATED, 2 for SYN. The prior is therefore close to flat over the range:
 * a value at the far end of the range of a VERIFIED default costs half a log unit against the
 * default, one of an ESTIMATED default a quarter. That is deliberate. The defaults are
 * literature values for other machines, and a prior that is narrow against the range makes a
 * truth far from the default nearly impossible however many records say so: with the farther
 * end at four deviations the stated intervals held the truth in half the cases, and even at
 * two a truth near the low end of three ranges at once was held by the interval of the weakest
 * parameter in 14 of 20 fits (docs/calibration/fitting.md section 9.1). The tag only says how
 * hard the default pulls when the records say little. A default on an end of its range gives a
 * half-normal. A prior can be replaced per parameter (`priors`), for example by the result of
 * an earlier fit.
 *
 * The constants a standard defines (`inspect.*`: the IEC bands and the clean rule) are not
 * fitted unless `allowStandardKeys` says so.
 *
 * **Weights.** w_r is the record's `weight`, or `obs.literatureWeight` for a literature record
 * that states none, or 1. Observations without a value (a planned record) do not count.
 *
 * Parameters are routed by what a change of them costs: `observation` (an `obs.*` constant:
 * no replay), `replay` (soil, liquor, timeline, inspector, `cal.*`, `prog.*`: one replay per
 * record on cached exposure) and `hydro` (anything that changes the water: a new exposure,
 * which `EvaluatorPool` computes and caches per value; `outer.ts` keeps those evaluations few).
 */

import {
  fitAxesOf,
  type FitAxis,
  type ParamSet,
  type ParamTag,
  type ParamValue,
} from '@spotless/sim-core';
import { calibrationRegistry, createCalibrationParams } from './cal-params.ts';
import {
  EvaluatorPool,
  type EvaluatorOptions,
  type ObservationSpec,
  type PreparedRecord,
  type RecordPrediction,
} from './evaluator.ts';
import {
  groupMeanLogLikelihood,
  logLikelihood,
  outlierProbability,
  outlierSpan,
} from './observation.ts';
import { observationSd, type WashRecord } from './record.ts';

/** The coordinate a parameter is fitted in. */
export type Transform = 'log' | 'logit' | 'linear';

/** One fitted number: a scalar parameter or one component of a vector. */
export interface FitParameter {
  /** Label: the key, with `[component]` for a component of a vector. */
  readonly id: string;
  readonly key: string;
  /** Component of a vector parameter; null for a scalar. */
  readonly index: number | null;
  readonly unit: string;
  /**
   * Registered default and the range the fit keeps to, in `unit`: the registered range, with
   * a floor in place of a lower end of 0 for a quantity fitted in the logarithm.
   */
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly tag: ParamTag;
  readonly transform: Transform;
  /** Centre and deviation of the prior in the transformed coordinate. */
  readonly priorMean: number;
  readonly priorSd: number;
  /** Bounds of the transformed coordinate. */
  readonly lower: number;
  readonly upper: number;
  /** What a change of it costs: see the file comment. */
  readonly route: 'observation' | 'replay' | 'hydro';
}

/**
 * One prior deviation as a multiple of the distance, in the transformed coordinate, from the
 * prior centre to the farther end of the registered range, by confidence tag.
 */
export const PRIOR_SD_BY_TAG: Readonly<Record<ParamTag, number>> = {
  VERIFIED: 1,
  MEASURED: 1,
  RECALLED: 1.25,
  ESTIMATED: 1.5,
  SYN: 2,
};

/** First segments of the keys a standard defines: not fitted unless asked. */
export const STANDARD_PREFIXES: readonly string[] = ['inspect'];

/** True for a key whose value a standard defines (`inspect.*`). */
export function isStandardKey(key: string): boolean {
  return STANDARD_PREFIXES.includes(key.split('.')[0] ?? '');
}

/** A fraction is fitted in the logit of its value clipped to this distance from 0 and 1. */
const LOGIT_EDGE = 1e-4;
/** The prior of a fraction is centred no nearer to 0 or 1 than this. */
const LOGIT_CENTRE_EDGE = 0.02;
/** Half-width of the logit range that stands for "0 to 1" when a prior deviation is derived. */
const LOGIT_HALF_RANGE = Math.log((1 - 0.01) / 0.01);

const logit = (p: number): number => Math.log(p / (1 - p));

/** The transform a fit uses for an axis of the registry. */
export function transformOf(axis: FitAxis): Transform {
  if (axis.min === 0 && axis.max === 1) return 'logit';
  if (axis.min > 0 && (axis.scale === 'log' || axis.max / axis.min >= 4)) return 'log';
  if (axis.min === 0 && axis.default > 0 && axis.max / axis.default >= 4) return 'log';
  return 'linear';
}

/**
 * The lower end of the range a fit uses for an axis: the registered one, or, for a positive
 * quantity fitted in the logarithm whose registered range starts at 0, a floor of the default
 * over ten (the default squared over the upper end if that is lower).
 */
export function fitFloorOf(axis: FitAxis): number {
  if (transformOf(axis) !== 'log' || axis.min > 0) return axis.min;
  return Math.min(axis.default / 10, (axis.default * axis.default) / axis.max);
}

/** The transformed coordinate of a value of a parameter. */
export function toZ(parameter: Pick<FitParameter, 'transform'>, value: number): number {
  switch (parameter.transform) {
    case 'log':
      return value > 0 ? Math.log(value) : -Infinity;
    case 'logit':
      return logit(Math.min(1 - LOGIT_EDGE, Math.max(LOGIT_EDGE, value)));
    case 'linear':
      return value;
  }
}

/** The value of a parameter at a transformed coordinate, inside its registered range. */
export function fromZ(parameter: FitParameter, z: number): number {
  const clipped = Math.min(parameter.upper, Math.max(parameter.lower, z));
  let value: number;
  switch (parameter.transform) {
    case 'log':
      value = Math.exp(clipped);
      break;
    case 'logit':
      value = 1 / (1 + Math.exp(-clipped));
      break;
    case 'linear':
      value = clipped;
      break;
  }
  return Math.min(parameter.max, Math.max(parameter.min, value));
}

/** A prior that replaces the registry's, in the unit of the parameter. */
export interface PriorOverride {
  /** Centre, in the unit of the parameter. */
  readonly centre?: number;
  /** Deviation in the transformed coordinate (log units, logit units, or the unit itself). */
  readonly sd?: number;
}

/**
 * The fit parameters of the given keys, in the order given (vector components in component
 * order). A key may name one component of a vector as `key[component]`. Throws a `RangeError`
 * for an enumeration, a fixed parameter or an unknown component.
 */
export function fitParameters(
  keys: readonly string[],
  priors: Readonly<Record<string, PriorOverride>> = {},
): FitParameter[] {
  const registry = calibrationRegistry();
  const out: FitParameter[] = [];
  for (const spec of keys) {
    const match = /^(.+)\[([^\]]+)\]$/.exec(spec);
    const key = match === null ? spec : (match[1] as string);
    let axes = fitAxesOf(registry, [key]);
    if (match !== null) {
      axes = axes.filter((axis) => axis.id === spec || String(axis.index) === match[2]);
      if (axes.length === 0) throw new RangeError(`${key} has no component "${match[2]}"`);
    }
    const def = registry.def(key);
    for (const axis of axes) {
      const transform = transformOf(axis);
      const shape = { transform };
      const floor = fitFloorOf(axis);
      let lower: number;
      let upper: number;
      let centre = axis.default;
      const override = priors[axis.id] ?? priors[key];
      if (override?.centre !== undefined) centre = override.centre;
      if (transform === 'logit') {
        lower = logit(LOGIT_EDGE);
        upper = logit(1 - LOGIT_EDGE);
        centre = Math.min(1 - LOGIT_CENTRE_EDGE, Math.max(LOGIT_CENTRE_EDGE, centre));
      } else {
        lower = toZ(shape, floor);
        upper = toZ(shape, axis.max);
        centre = Math.min(axis.max, Math.max(floor, centre));
      }
      const priorMean = toZ(shape, centre);
      // The range that stands for "0 to 1" when a deviation is derived is 0.01 to 0.99.
      const reachLower = transform === 'logit' ? -LOGIT_HALF_RANGE : lower;
      const reachUpper = transform === 'logit' ? LOGIT_HALF_RANGE : upper;
      const far = Math.max(priorMean - reachLower, reachUpper - priorMean);
      const prefix = key.split('.')[0];
      out.push({
        id: axis.id,
        key,
        index: axis.index,
        unit: axis.unit,
        default: axis.default,
        min: floor,
        max: axis.max,
        tag: def.tag,
        transform,
        priorMean,
        priorSd: override?.sd ?? PRIOR_SD_BY_TAG[def.tag] * far,
        lower,
        upper,
        route: prefix === 'obs' ? 'observation' : def.group === 'hydro' ? 'hydro' : 'replay',
      });
    }
  }
  const seen = new Set<string>();
  for (const parameter of out) {
    if (seen.has(parameter.id)) throw new RangeError(`${parameter.id} is listed twice`);
    seen.add(parameter.id);
  }
  return out;
}

/** The overrides that put each parameter at its transformed coordinate, on top of `base`. */
export function overridesAt(
  base: ParamSet,
  parameters: readonly FitParameter[],
  z: readonly number[],
): Record<string, ParamValue> {
  const overrides: Record<string, ParamValue> = {};
  parameters.forEach((parameter, j) => {
    const value = fromZ(parameter, z[j] as number);
    if (parameter.index === null) overrides[parameter.key] = value;
    else {
      const current =
        (overrides[parameter.key] as readonly number[] | undefined) ??
        base.getVector(parameter.key);
      const next = [...current];
      next[parameter.index] = value;
      overrides[parameter.key] = next;
    }
  });
  return overrides;
}

/** The parameter set with each fit parameter at its transformed coordinate. */
export function paramsAt(
  base: ParamSet,
  parameters: readonly FitParameter[],
  z: readonly number[],
): ParamSet {
  return base.with(overridesAt(base, parameters, z));
}

/** The transformed coordinates of the fit parameters in a parameter set. */
export function zOf(params: ParamSet, parameters: readonly FitParameter[]): number[] {
  return parameters.map((parameter) =>
    toZ(
      parameter,
      parameter.index === null
        ? params.get(parameter.key)
        : (params.getVector(parameter.key)[parameter.index] as number),
    ),
  );
}

/** The logarithm of the prior density at z, up to a constant. */
export function logPrior(parameters: readonly FitParameter[], z: readonly number[]): number {
  let sum = 0;
  parameters.forEach((parameter, j) => {
    const d = ((z[j] as number) - parameter.priorMean) / parameter.priorSd;
    sum -= 0.5 * d * d;
  });
  return sum;
}

/** The weight of a record's log likelihood. */
export function recordWeight(record: WashRecord, literatureWeight: number): number {
  if (record.weight !== undefined) return record.weight;
  return record.kind === 'literature' ? literatureWeight : 1;
}

/** The log likelihood of one record at a prediction. */
export interface RecordLikelihood {
  readonly recordId: string;
  readonly weight: number;
  /** Sum of the log likelihoods of its observations, before the weight. */
  readonly logLikelihood: number;
  /** The same without the allowance for gross errors (`obs.outlierShare` taken as 0). */
  readonly coreLogLikelihood: number;
  /**
   * Per observation of the record (NaN where it has no value). With input scenarios, the
   * likelihood of each observation with the scenarios integrated out on its own; the sum
   * above integrates them out per item (its observations share the unknown inputs), so it is
   * not the sum of these where an item has more than one fitted observation. An observation
   * that is not fitted (`fitted: false`) has its value here and is left out of the sums.
   */
  readonly perObservation: Float64Array;
  /** Per observation: the posterior probability that its value is a gross error (0 without a value). */
  readonly outlier: Float64Array;
  /** Per group observation of the record (NaN where it has no value). */
  readonly perGroup: Float64Array;
  readonly prediction: RecordPrediction;
}

/** The stated uncertainty of an observation as the likelihood takes it. */
function statedSd(record: WashRecord, index: number, fallback: number): number {
  const observation = record.observations[index];
  if (observation === undefined) return fallback;
  if (observation.kind === 'clean' || observation.kind === 'specks') return 0;
  return observationSd(record, observation) ?? 0;
}

/**
 * The log likelihood of the observations of `record` at a prediction. The values and their
 * stated uncertainties are those of `record` itself; `observations` (of the preparation that
 * made the prediction) says which prediction belongs to which observation, and supplies the
 * value only where the record has no observation at that position.
 */
export function recordLikelihood(
  record: WashRecord,
  observations: readonly ObservationSpec[],
  prediction: RecordPrediction,
): RecordLikelihood {
  const per = new Float64Array(observations.length).fill(Number.NaN);
  const outlier = new Float64Array(observations.length);
  let sum = 0;
  let core = 0;
  // The scenarios of the inputs: the prediction itself where the record names none.
  const weights = prediction.scenarios?.weights ?? [1];
  const etas = prediction.scenarios?.eta ?? [prediction.eta];
  const logWeights = weights.map((w) => Math.log(w));
  /** ln sum_k w_k exp(terms_k). */
  const integrated = (terms: readonly number[]): number => {
    let hi = -Infinity;
    for (let k = 0; k < terms.length; k++) {
      hi = Math.max(hi, (logWeights[k] as number) + (terms[k] as number));
    }
    if (!Number.isFinite(hi)) return hi;
    let total = 0;
    for (let k = 0; k < terms.length; k++) {
      total += Math.exp((logWeights[k] as number) + (terms[k] as number) - hi);
    }
    return hi + Math.log(total);
  };
  // Per item: the log likelihood of its fitted observations in every scenario, summed over
  // the observations before the scenarios are integrated out (they share the unknown inputs).
  const byItem = new Map<string, { robust: number[]; plain: number[] }>();
  observations.forEach((observation, i) => {
    const own = record.observations[observation.index];
    const value = own === undefined ? observation.value : own.value;
    if (value === undefined) return;
    const sd = statedSd(record, observation.index, observation.sd);
    const eta = prediction.eta[i] as number;
    const state = prediction.states[i];
    const span =
      state === undefined ? 0 : outlierSpan(observation.kind, state, prediction.constants);
    const plain = etas.map((scenario) =>
      logLikelihood(observation.kind, value, scenario[i] as number, sd, prediction.constants, 0),
    );
    const robust =
      span > 0
        ? etas.map((scenario) =>
            logLikelihood(
              observation.kind,
              value,
              scenario[i] as number,
              sd,
              prediction.constants,
              span,
            ),
          )
        : plain;
    per[i] = integrated(robust);
    outlier[i] = outlierProbability(observation.kind, value, eta, sd, prediction.constants, span);
    const fitted = (own === undefined ? observation.fitted : own.fitted) !== false;
    if (!fitted) return;
    let item = byItem.get(observation.itemId);
    if (item === undefined) {
      item = { robust: weights.map(() => 0), plain: weights.map(() => 0) };
      byItem.set(observation.itemId, item);
    }
    for (let k = 0; k < weights.length; k++) {
      (item.robust as number[])[k] = (item.robust[k] as number) + (robust[k] as number);
      (item.plain as number[])[k] = (item.plain[k] as number) + (plain[k] as number);
    }
  });
  for (const item of byItem.values()) {
    sum += integrated(item.robust);
    core += integrated(item.plain);
  }
  // The mean scores of groups of items: normal about the predicted mean, no gross-error term.
  const groups = record.group_observations ?? [];
  const perGroup = new Float64Array(groups.length).fill(Number.NaN);
  groups.forEach((group, g) => {
    const eta = prediction.groupEta?.[g];
    if (group.value === undefined || eta === undefined || !Number.isFinite(eta)) return;
    const term = groupMeanLogLikelihood(group.value, eta, group.sd);
    perGroup[g] = term;
    sum += term;
    core += term;
  });
  return {
    recordId: record.id,
    weight: recordWeight(record, prediction.constants.literatureWeight),
    logLikelihood: sum,
    coreLogLikelihood: core,
    perObservation: per,
    outlier,
    perGroup,
    prediction,
  };
}

/** The objective at one point. */
export interface ObjectiveValue {
  readonly z: readonly number[];
  readonly logPosterior: number;
  readonly logLikelihood: number;
  readonly logPrior: number;
  /**
   * The log posterior without the allowance for gross errors: every observation counts with
   * its full normal likelihood. A minimisation starts on this one, which has a slope however
   * far the predictions are from the observations, and ends on `logPosterior`.
   */
  readonly coreLogPosterior: number;
  readonly records: readonly RecordLikelihood[];
}

/**
 * What an objective asks of the simulation: the observations of a record and the predictions
 * for them at a parameter set. `EvaluatorPool` is the one that runs the wash simulation; a
 * test may supply another.
 */
export interface RecordEvaluator {
  get(
    record: WashRecord,
    params: ParamSet,
  ): Promise<
    Pick<PreparedRecord, 'observations' | 'evaluate'> &
      Partial<
        Pick<PreparedRecord, 'evaluateFull' | 'refreshBackground' | 'backgroundAt' | 'washInputAt'>
      >
  >;
}

/** Options of {@link createObjective}. */
export interface ObjectiveOptions {
  /** The set every other parameter is taken from; default the registry defaults. */
  readonly base?: ParamSet;
  readonly priors?: Readonly<Record<string, PriorOverride>>;
  /** What prepares and evaluates the records; default a new `EvaluatorPool`. */
  readonly pool?: RecordEvaluator;
  /** Options of a new pool. */
  readonly evaluator?: EvaluatorOptions;
  /** True to let the constants a standard defines (`inspect.*`) be fitted. Default false. */
  readonly allowStandardKeys?: boolean;
}

/** The log posterior of chosen parameters given wash records, as a function of z. */
export interface Objective {
  readonly parameters: readonly FitParameter[];
  readonly records: readonly WashRecord[];
  readonly base: ParamSet;
  readonly pool: RecordEvaluator;
  /** The parameter set at z. */
  paramsAt(z: readonly number[]): ParamSet;
  /** The objective at z (answers from memory for a point seen before). */
  evaluate(z: readonly number[]): Promise<ObjectiveValue>;
  /** z clipped to the bounds of every parameter. */
  clip(z: readonly number[]): number[];
  /** Forgets every remembered point (after the evaluator behind the objective has changed). */
  forget(): void;
  /** Evaluations asked for, and those that were computed (not answered from memory). */
  readonly evaluations: number;
  readonly computed: number;
}

/**
 * The objective of a fit of the parameters `keys` to `records`. Records are prepared when the
 * objective is first evaluated.
 */
export function createObjective(
  records: readonly WashRecord[],
  keys: readonly string[],
  options: ObjectiveOptions = {},
): Objective {
  const parameters = fitParameters(keys, options.priors);
  if (options.allowStandardKeys !== true) {
    const standard = parameters.filter((p) => isStandardKey(p.key));
    if (standard.length > 0) {
      throw new RangeError(
        `${standard.map((p) => p.id).join(', ')}: a standard defines these constants; they are not fitted unless allowStandardKeys is set`,
      );
    }
  }
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new RangeError(`two wash records have the id "${record.id}"`);
    ids.add(record.id);
  }
  const base = options.base ?? createCalibrationParams();
  const pool = options.pool ?? new EvaluatorPool(options.evaluator);
  const memory = new Map<string, ObjectiveValue>();
  let evaluations = 0;
  let computed = 0;
  const clip = (z: readonly number[]): number[] =>
    parameters.map((parameter, j) =>
      Math.min(parameter.upper, Math.max(parameter.lower, z[j] as number)),
    );
  const at = (z: readonly number[]): ParamSet => paramsAt(base, parameters, z);
  return {
    parameters,
    records,
    base,
    pool,
    paramsAt: at,
    clip,
    forget() {
      memory.clear();
    },
    get evaluations() {
      return evaluations;
    },
    get computed() {
      return computed;
    },
    async evaluate(zIn) {
      evaluations++;
      const z = clip(zIn);
      const key = z.map((v) => v.toPrecision(15)).join(',');
      const known = memory.get(key);
      if (known !== undefined) return known;
      computed++;
      const params = at(z);
      const perRecord: RecordLikelihood[] = [];
      let logLik = 0;
      let core = 0;
      for (const record of records) {
        const prepared = await pool.get(record, params);
        const prediction = await prepared.evaluate(params);
        const likelihood = recordLikelihood(record, prepared.observations, prediction);
        perRecord.push(likelihood);
        logLik += likelihood.weight * likelihood.logLikelihood;
        core += likelihood.weight * likelihood.coreLogLikelihood;
      }
      const prior = logPrior(parameters, z);
      const value: ObjectiveValue = {
        z,
        logPosterior: logLik + prior,
        logLikelihood: logLik,
        logPrior: prior,
        coreLogPosterior: core + prior,
        records: perRecord,
      };
      memory.set(key, value);
      if (memory.size > 4096) memory.delete(memory.keys().next().value as string);
      return value;
    },
  };
}
