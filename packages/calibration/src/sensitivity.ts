/**
 * Sensitivity, Fisher information, identifiability and experiment ranking
 * (docs/calibration/fitting.md sections 6 and 7).
 *
 * **Sensitivity.** For records (measured or planned) and candidate parameters, the derivative
 * of every predicted observation `eta_o` to every parameter coordinate `z_j`, by central
 * differences (one-sided at a bound). In the tables it is shown scaled:
 * S_oj = sqrt(w_r i_o) (d eta_o / d z_j) s_j, the move of the prediction in standard deviations
 * of its noise when the parameter moves by one prior deviation (`i_o` the Fisher information
 * of the observation model about `eta_o`).
 *
 * **The step.** Where soil is being removed a prediction can cross its whole range within a
 * fraction of a prior deviation, and a step wider than the posterior then averages the slope
 * away. The step is therefore chosen from the answer ({@link adaptiveJacobian}): it starts at
 * a tenth of each prior deviation, the posterior deviations are computed, and the derivatives
 * are taken again with a step of half the posterior deviation of each parameter (never above
 * the first step, never below a two-hundredth of the prior deviation) until no posterior
 * deviation changes by more than 10 %, at most four rounds. The steps used and whether they
 * settled are reported.
 *
 * **Fisher information.** F = sum_o w_r i_o (d eta_o / dz)(d eta_o / dz)^T: what the records
 * are expected to say about the parameters, whatever values they return. With the prior
 * precision P = diag(1 / s_j^2) the linearised posterior covariance is C = (F + P)^-1.
 *
 * **Identifiability**, read off F in units of the prior (F~ = D F D, D = diag(s_j)):
 *
 *   contraction_j    1 - C_jj / s_j^2: the share of the prior variance the records remove.
 *                    At least 0.75 `identified`, at least 0.25 `weak`, below that
 *                    `not identified`: the posterior is the prior
 *   conditional      1 / sqrt(F~_jj + 1): the deviation the parameter would have, in prior
 *                    deviations, if every other parameter were known. A parameter whose
 *                    conditional deviation is small and whose marginal one is not is
 *                    confounded: the records constrain a combination it is part of
 *   combinations     the eigenvectors of F~ with their eigenvalues: an eigenvalue well above 1
 *                    is a combination the records fix, one well below 1 a direction they leave
 *                    to the prior
 *   correlation      of C; pairs beyond 0.8 either way are listed as confounded
 *
 * **Experiment ranking.** The expected gain of information about chosen parameters from a
 * candidate wash is, in the linear-Gaussian approximation at one parameter set, the fall of
 * the entropy of their marginal posterior: gain = 1/2 [ln det C_SS(before) - ln det
 * C_SS(after)] (nats), where "before" holds the prior and the records already run and "after"
 * adds the candidate. That number is a property of the parameter set as much as of the wash:
 * a wash that says nothing where the soil stays on can say most where it comes off. The gain
 * is therefore averaged over parameter sets drawn from what is currently believed (the prior,
 * or a posterior covariance handed in): the centre and a Latin hypercube of further points.
 * Per candidate the mean, the spread and the best and worst place over the draws are reported
 * (washes that gain the same share a place), and a candidate whose place moves by three or
 * more, or that leads on average without leading in half the draws, is flagged as unstable. The candidates are also ordered greedily
 * on the mean gain: the best first, then the best given the first, and so on.
 */

import { randomUniform } from '@spotless/core';
import { createMemoryExposureCache, type ParamSet } from '@spotless/sim-core';
import { EvaluatorPool } from './evaluator.ts';
import { areaLog, fisherInformation, outlierSpan, predictiveMoments } from './observation.ts';
import {
  createObjective,
  fromZ,
  zOf,
  type FitParameter,
  type Objective,
  type ObjectiveOptions,
  type ObjectiveValue,
} from './objective.ts';
import {
  cholesky,
  eigenSymmetric,
  inverseSpd,
  logDetSpd,
  normCdf,
  normQuantile,
  zeros,
  type Matrix,
} from './mathx.ts';
import { observationIdOf, observationSd, type ObservationKind, type WashRecord } from './record.ts';
import { fmt, textTable } from './util.ts';

/** One predicted observation with its derivatives. */
export interface SensitivityRow {
  readonly recordId: string;
  readonly observationId: string;
  readonly kind: ObservationKind;
  /** Weight of the record. */
  readonly weight: number;
  /** The prediction, and mean and deviation of the predicted observation. */
  readonly eta: number;
  readonly mean: number;
  readonly sd: number;
  /** Fisher information of the observation about `eta`. */
  readonly information: number;
  /** d eta / d z_j per parameter. */
  readonly derivative: readonly number[];
}

/** The derivatives of every predicted observation at a point. */
export interface Jacobian {
  readonly parameters: readonly FitParameter[];
  readonly z: readonly number[];
  /** The steps used, per parameter: the upper and the lower point are z + up and z - down. */
  readonly up: readonly number[];
  readonly down: readonly number[];
  /** The step asked for per parameter, as a share of its prior deviation. */
  readonly steps: readonly number[];
  /** Rounds of step refinement run, and whether the posterior deviations settled. */
  readonly stepRounds: number;
  readonly stepConverged: boolean;
  readonly rows: readonly SensitivityRow[];
  /** The objective at the centre and at the stepped points. */
  readonly centre: ObjectiveValue;
  readonly plus: readonly ObjectiveValue[];
  readonly minus: readonly ObjectiveValue[];
}

/** Options of {@link jacobianAt} and {@link adaptiveJacobian}. */
export interface JacobianOptions {
  /**
   * Step as a share of each prior deviation: one number for all, or one per parameter; default
   * 0.1. For {@link adaptiveJacobian} the first, and largest, step.
   */
  readonly step?: number | readonly number[];
  /** False to keep the step as given ({@link adaptiveJacobian}); default true. */
  readonly adapt?: boolean;
  /** Most rounds of refinement; default 4. */
  readonly maxStepRounds?: number;
}

/** Smallest step of the derivatives, as a share of a prior deviation. */
export const MIN_JACOBIAN_STEP = 0.005;

/** The derivatives of every predicted observation of an objective at `z`, at the steps given. */
export async function jacobianAt(
  objective: Objective,
  zIn: readonly number[],
  options: JacobianOptions = {},
): Promise<Jacobian> {
  const { parameters } = objective;
  const z = objective.clip(zIn);
  const given = options.step ?? 0.1;
  const steps = parameters.map((_, j) =>
    typeof given === 'number' ? given : ((given as readonly number[])[j] ?? 0.1),
  );
  const centre = await objective.evaluate(z);
  const plus: ObjectiveValue[] = [];
  const minus: ObjectiveValue[] = [];
  const up: number[] = [];
  const down: number[] = [];
  for (let j = 0; j < parameters.length; j++) {
    const parameter = parameters[j] as FitParameter;
    const h = (steps[j] as number) * parameter.priorSd;
    const hi = Math.min(parameter.upper, (z[j] as number) + h);
    const lo = Math.max(parameter.lower, (z[j] as number) - h);
    up.push(hi - (z[j] as number));
    down.push((z[j] as number) - lo);
    const at = (value: number): number[] => z.map((v, i) => (i === j ? value : v));
    plus.push(hi > (z[j] as number) ? await objective.evaluate(at(hi)) : centre);
    minus.push(lo < (z[j] as number) ? await objective.evaluate(at(lo)) : centre);
  }
  const rows: SensitivityRow[] = [];
  centre.records.forEach((record, r) => {
    const prepared = record.prediction;
    const source = objective.records[r] as WashRecord;
    prepared.eta.forEach((eta, o) => {
      const observation = source.observations[o];
      if (observation === undefined) return;
      const sd =
        observation.kind === 'clean' || observation.kind === 'specks'
          ? 0
          : (observationSd(source, observation) ?? 0);
      const derivative = parameters.map((_, j) => {
        const span = (up[j] as number) + (down[j] as number);
        if (!(span > 0)) return 0;
        const hi = (plus[j] as ObjectiveValue).records[r]?.prediction.eta[o] as number;
        const lo = (minus[j] as ObjectiveValue).records[r]?.prediction.eta[o] as number;
        return (hi - lo) / span;
      });
      const moments = predictiveMoments(observation.kind, eta, sd, prepared.constants);
      const state = prepared.states[o];
      const admissible =
        state === undefined ? 0 : outlierSpan(observation.kind, state, prepared.constants);
      // With input scenarios the unknown inputs widen what a visible area can say: the spread
      // of ln(area + floor) over the scenarios is added to its stated uncertainty. (The
      // derivative is that of the nominal scenario; the profiles of a fit use the likelihood
      // itself, with the scenarios integrated out.)
      let widened = sd;
      const scenarios = prepared.scenarios;
      if (scenarios !== undefined && observation.kind === 'visible_area') {
        let mean = 0;
        scenarios.eta.forEach((each, k) => {
          mean += (scenarios.weights[k] as number) * areaLog(each[o] as number, prepared.constants);
        });
        let variance = 0;
        scenarios.eta.forEach((each, k) => {
          const d = areaLog(each[o] as number, prepared.constants) - mean;
          variance += (scenarios.weights[k] as number) * d * d;
        });
        widened = Math.hypot(sd, Math.sqrt(variance));
      }
      rows.push({
        recordId: record.recordId,
        observationId: observationIdOf(observation),
        kind: observation.kind,
        weight: record.weight,
        eta,
        mean: moments.mean,
        sd: moments.sd,
        // An observation that is not fitted says nothing to a fit.
        information:
          observation.fitted === false
            ? 0
            : fisherInformation(observation.kind, eta, widened, prepared.constants, admissible),
        derivative,
      });
    });
  });
  return {
    parameters,
    z,
    up,
    down,
    steps,
    stepRounds: 1,
    stepConverged: true,
    rows,
    centre,
    plus,
    minus,
  };
}

/**
 * The derivatives at `z` with the step chosen from the answer: see the file comment, "The
 * step". With `adapt: false` it is {@link jacobianAt}.
 */
export async function adaptiveJacobian(
  objective: Objective,
  z: readonly number[],
  options: JacobianOptions = {},
): Promise<Jacobian> {
  let jacobian = await jacobianAt(objective, z, options);
  if (options.adapt === false) return jacobian;
  const first = jacobian.steps;
  const marginals = (j: Jacobian): number[] =>
    identifiability(objective.parameters, fisherOf(j), []).parameters.map((p) => p.marginal);
  let before = marginals(jacobian);
  const rounds = Math.max(1, options.maxStepRounds ?? 4);
  let converged = false;
  let round = 1;
  for (; round < rounds; round++) {
    const next = before.map((m, j) =>
      Math.min(first[j] as number, Math.max(MIN_JACOBIAN_STEP, 0.5 * m)),
    );
    if (next.every((step, j) => Math.abs(step - (jacobian.steps[j] as number)) < 1e-12)) {
      converged = true;
      break;
    }
    jacobian = await jacobianAt(objective, z, { step: next });
    const after = marginals(jacobian);
    const settled = after.every(
      (m, j) => Math.abs(m - (before[j] as number)) <= 0.1 * Math.max(before[j] as number, 1e-12),
    );
    before = after;
    if (settled) {
      converged = true;
      round++;
      break;
    }
  }
  return { ...jacobian, stepRounds: round, stepConverged: converged };
}

/** The Fisher information of the rows of a Jacobian about z. */
export function fisherOf(jacobian: Pick<Jacobian, 'rows' | 'parameters'>): Matrix {
  const n = jacobian.parameters.length;
  const f = zeros(n);
  for (const row of jacobian.rows) {
    const w = row.weight * row.information;
    if (!(w > 0)) continue;
    for (let i = 0; i < n; i++) {
      const di = row.derivative[i] as number;
      if (di === 0) continue;
      for (let j = 0; j <= i; j++) {
        (f[i] as number[])[j] =
          ((f[i] as number[])[j] as number) + w * di * (row.derivative[j] as number);
      }
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < i; j++) (f[j] as number[])[i] = (f[i] as number[])[j] as number;
  return f;
}

/** How well one parameter is determined. */
export interface ParameterIdentifiability {
  readonly id: string;
  /** Root mean square of the scaled sensitivities S_oj over the observations. */
  readonly sensitivity: number;
  /** F~_jj: information of the records about the parameter alone, in units of the prior precision. */
  readonly information: number;
  /** Posterior over prior deviation: with the other parameters free, and with them known. */
  readonly marginal: number;
  readonly conditional: number;
  /** 1 - marginal^2. */
  readonly contraction: number;
  readonly verdict: 'identified' | 'weak' | 'not identified';
  /** Parameters whose posterior correlation with this one is beyond 0.8 either way. */
  readonly confoundedWith: readonly { readonly id: string; readonly correlation: number }[];
}

/** A combination of parameters and how well the records fix it. */
export interface Combination {
  /** Eigenvalue of F~: information in units of the prior precision. */
  readonly information: number;
  /** Loadings on the parameters (prior-deviation units), largest first, those of 0.2 or more. */
  readonly loadings: readonly { readonly id: string; readonly loading: number }[];
}

/** What a set of records can and cannot say about a set of parameters. */
export interface IdentifiabilityReport {
  readonly parameters: readonly ParameterIdentifiability[];
  readonly combinations: readonly Combination[];
  /** Posterior covariance in z, and its correlation matrix. */
  readonly covariance: Matrix;
  readonly correlation: Matrix;
  /** The Fisher information in z. */
  readonly fisher: Matrix;
  /** The report as text. */
  readonly table: string;
}

/** Contraction at and above which a parameter counts as identified, and as weakly identified. */
export const IDENTIFIED_AT = 0.75;
export const WEAK_AT = 0.25;

/**
 * The identifiability of the parameters from their Fisher information and priors: a local
 * statement, as good as the derivatives behind `fisher`. `status`, if given, replaces the
 * verdict column of the table (a fit has more to say than the local verdict).
 */
export function identifiability(
  parameters: readonly FitParameter[],
  fisher: Matrix,
  rows: readonly SensitivityRow[] = [],
  status?: readonly string[],
): IdentifiabilityReport {
  const n = parameters.length;
  const scaled = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      (scaled[i] as number[])[j] =
        ((fisher[i] as number[])[j] as number) *
        (parameters[i] as FitParameter).priorSd *
        (parameters[j] as FitParameter).priorSd;
    }
  }
  const precision = scaled.map((row, i) => row.map((v, j) => v + (i === j ? 1 : 0)));
  const cov =
    inverseSpd(precision) ?? zeros(n).map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
  const covariance = cov.map((row, i) =>
    row.map(
      (v, j) =>
        v * (parameters[i] as FitParameter).priorSd * (parameters[j] as FitParameter).priorSd,
    ),
  );
  const correlation = cov.map((row, i) =>
    row.map(
      (v, j) =>
        v / Math.sqrt(((cov[i] as number[])[i] as number) * ((cov[j] as number[])[j] as number)),
    ),
  );
  const eigen = eigenSymmetric(scaled);
  const perParameter: ParameterIdentifiability[] = parameters.map((parameter, j) => {
    let square = 0;
    let count = 0;
    for (const row of rows) {
      const s =
        Math.sqrt(row.weight * row.information) * (row.derivative[j] as number) * parameter.priorSd;
      square += s * s;
      count++;
    }
    const marginal = Math.sqrt(Math.max((cov[j] as number[])[j] as number, 0));
    const contraction = 1 - marginal * marginal;
    const confounded: { id: string; correlation: number }[] = [];
    for (let i = 0; i < n; i++) {
      const rho = (correlation[j] as number[])[i] as number;
      if (i !== j && Math.abs(rho) >= 0.8)
        confounded.push({ id: (parameters[i] as FitParameter).id, correlation: rho });
    }
    return {
      id: parameter.id,
      sensitivity: count > 0 ? Math.sqrt(square / count) : 0,
      information: (scaled[j] as number[])[j] as number,
      marginal,
      conditional: 1 / Math.sqrt(((scaled[j] as number[])[j] as number) + 1),
      contraction,
      verdict:
        contraction >= IDENTIFIED_AT
          ? 'identified'
          : contraction >= WEAK_AT
            ? 'weak'
            : 'not identified',
      confoundedWith: confounded,
    };
  });
  const combinations: Combination[] = eigen.values.map((value, k) => ({
    information: Math.max(value, 0),
    loadings: parameters
      .map((parameter, i) => ({
        id: parameter.id,
        loading: (eigen.vectors[i] as number[])[k] as number,
      }))
      .filter((l) => Math.abs(l.loading) >= 0.2)
      .sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading)),
  }));
  const lines: string[][] = [
    [
      'parameter',
      'sensitivity',
      'information',
      'post/prior sd',
      'if others known',
      'contraction',
      'verdict',
      'confounded with',
    ],
  ];
  for (const p of perParameter) {
    lines.push([
      p.id,
      fmt(p.sensitivity),
      fmt(p.information),
      fmt(p.marginal),
      fmt(p.conditional),
      fmt(p.contraction, 2),
      status?.[lines.length - 1] ?? p.verdict,
      p.confoundedWith.map((c) => `${c.id} (${c.correlation.toFixed(2)})`).join(', ') || '-',
    ]);
  }
  const combos: string[][] = [
    ['information', 'combination (loadings in prior deviations)', 'reading'],
  ];
  for (const c of combinations) {
    combos.push([
      fmt(c.information),
      c.loadings
        .map((l) => `${l.loading >= 0 ? '+' : '-'}${Math.abs(l.loading).toFixed(2)} ${l.id}`)
        .join(' ') || '-',
      c.information >= 10
        ? 'fixed by the records'
        : c.information >= 1
          ? 'constrained'
          : 'left to the prior',
    ]);
  }
  const table =
    `${textTable(lines, [1, 2, 3, 4, 5])}\n\n` +
    'sensitivity: rms over the observations of the move of a prediction, in noise deviations, per prior deviation of the parameter\n' +
    'information: Fisher information of the records about the parameter alone, in units of its prior precision\n\n' +
    textTable(combos, [0]);
  return { parameters: perParameter, combinations, covariance, correlation, fisher, table };
}

/** What {@link sensitivity} returns. */
export interface SensitivityResult {
  readonly jacobian: Jacobian;
  readonly report: IdentifiabilityReport;
  /** The scaled sensitivities S_oj as a text table: one row per observation. */
  readonly sensitivityTable: string;
}

/** The scaled sensitivity matrix as text. */
export function sensitivityTable(
  jacobian: Pick<Jacobian, 'rows' | 'parameters'>,
  maxRows = Infinity,
): string {
  const header = [
    'record',
    'observation',
    'predicted',
    'noise sd',
    ...jacobian.parameters.map((p) => p.id),
  ];
  const lines: string[][] = [header];
  const rows = [...jacobian.rows];
  const strength = (row: SensitivityRow): number =>
    Math.max(
      ...row.derivative.map((d, j) =>
        Math.abs(
          Math.sqrt(row.weight * row.information) *
            d *
            (jacobian.parameters[j] as FitParameter).priorSd,
        ),
      ),
      0,
    );
  const shown =
    rows.length > maxRows ? rows.sort((a, b) => strength(b) - strength(a)).slice(0, maxRows) : rows;
  for (const row of shown) {
    lines.push([
      row.recordId,
      row.observationId,
      fmt(row.mean),
      fmt(row.sd),
      ...row.derivative.map((d, j) =>
        (
          Math.sqrt(row.weight * row.information) *
          d *
          (jacobian.parameters[j] as FitParameter).priorSd
        ).toFixed(2),
      ),
    ]);
  }
  const more =
    rows.length > shown.length ? `\n(${rows.length - shown.length} weaker rows not shown)` : '';
  return textTable(lines, header.map((_, i) => i).slice(2)) + more;
}

/** Options of {@link sensitivity}. */
export interface SensitivityOptions extends ObjectiveOptions, JacobianOptions {
  /** The parameter set to linearise at; default the base set of the objective. */
  readonly at?: ParamSet;
}

/**
 * Sensitivity of every predicted observation of `records` to every parameter of `keys`, the
 * Fisher information, and what the records can and cannot identify.
 */
export async function sensitivity(
  records: readonly WashRecord[],
  keys: readonly string[],
  options: SensitivityOptions = {},
): Promise<SensitivityResult> {
  const objective = createObjective(records, keys, options);
  const z = objective.clip(zOf(options.at ?? objective.base, objective.parameters));
  const jacobian = await adaptiveJacobian(objective, z, options);
  const fisher = fisherOf(jacobian);
  return {
    jacobian,
    report: identifiability(objective.parameters, fisher, jacobian.rows),
    sensitivityTable: sensitivityTable(jacobian),
  };
}

/** One candidate experiment with what it is expected to teach. */
export interface ExperimentRank {
  readonly recordId: string;
  readonly title: string;
  /**
   * Expected gain of information about the parameters of interest from this wash alone: the
   * mean over the parameter sets of the ranking, nats and bits.
   */
  readonly gain_nats: number;
  readonly gain_bits: number;
  /** Deviation, least and most of the gain over the parameter sets, bits. */
  readonly gainSd_bits: number;
  readonly gainMin_bits: number;
  readonly gainMax_bits: number;
  /** Best and worst place over the parameter sets (1 is first), and the share in which it led. */
  readonly rankBest: number;
  readonly rankWorst: number;
  readonly firstShare: number;
  /**
   * True when its place moves by three or more over the parameter sets, or when it leads on
   * the mean without leading in half of them: the recommendation hangs on parameters not yet
   * known.
   */
  readonly unstable: boolean;
  /** Position in the greedy order (1 is run first) and the mean gain it adds there, nats. */
  readonly order: number;
  readonly marginalGain_nats: number;
  /**
   * Posterior over prior deviation of each parameter of interest after this experiment alone,
   * the mean over the parameter sets.
   */
  readonly after: readonly {
    readonly id: string;
    readonly marginal: number;
    readonly verdict: string;
  }[];
  /** Number of planned observations. */
  readonly observations: number;
}

/** Options of {@link rankExperiments}. */
export interface RankOptions extends ObjectiveOptions, JacobianOptions {
  /** Records already run: their information counts as known. */
  readonly existing?: readonly WashRecord[];
  /** The parameters whose information is counted; default all of `keys`. The rest are nuisance. */
  readonly interest?: readonly string[];
  /** The centre: the first parameter set the gain is computed at; default the base set. */
  readonly at?: ParamSet;
  /**
   * Further parameter sets to average the gain over, drawn by Latin hypercube from the prior
   * of `keys` (or from `covariance` about the centre); default 8. With 0 the ranking is the
   * local one at the centre alone, and says so.
   */
  readonly draws?: number;
  /** Seed of the draws (u32); default 1. */
  readonly seed?: number;
  /**
   * Posterior covariance of `keys` in the transformed coordinates (`FitResult.covariance` of a
   * fit of the same keys): the draws are then normal about the centre with this covariance.
   */
  readonly covariance?: Matrix;
  readonly onProgress?: (message: string) => void;
}

/** What {@link rankExperiments} returns. */
export interface RankResult {
  /** The candidates, best first by their mean gain. */
  readonly ranking: readonly ExperimentRank[];
  /** The Fisher information of each candidate at the centre, by record id. */
  readonly fisher: Readonly<Record<string, Matrix>>;
  readonly parameters: readonly FitParameter[];
  /** The parameter sets the gain was computed at: the centre first; values of `parameters`. */
  readonly points: readonly (readonly number[])[];
  /** The gain of each candidate at each parameter set, bits, by record id. */
  readonly gains_bits: Readonly<Record<string, readonly number[]>>;
  /** True when the ranking rests on the centre alone. */
  readonly local: boolean;
  readonly table: string;
}

const STREAM_RANK = 0x72616e6b;

/** Entropy term 1/2 ln det of the marginal covariance of a subset, from a precision matrix. */
function halfLogDetMarginal(precision: Matrix, subset: readonly number[]): number {
  const cov = inverseSpd(precision);
  if (cov === null) return Number.NaN;
  const sub = subset.map((i) => subset.map((j) => (cov[i] as number[])[j] as number));
  return 0.5 * logDetSpd(sub);
}

const verdictOf = (marginal: number): string => {
  const contraction = 1 - marginal * marginal;
  return contraction >= IDENTIFIED_AT
    ? 'identified'
    : contraction >= WEAK_AT
      ? 'weak'
      : 'not identified';
};

/**
 * Ranks candidate experiments (planned records: a load with soils and an observation plan) by
 * the information they are expected to add about the parameters `keys`, averaged over
 * parameter sets drawn from what is currently believed: see the file comment.
 */
export async function rankExperiments(
  candidates: readonly WashRecord[],
  keys: readonly string[],
  options: RankOptions = {},
): Promise<RankResult> {
  const say = (message: string): void => options.onProgress?.(message);
  // Each candidate is prepared in a pool of its own (a preparation holds a scene), all on one
  // exposure cache; the pool and the objective of a candidate serve every parameter set.
  const cache = options.evaluator?.cache ?? createMemoryExposureCache();
  const objectiveOf = (records: readonly WashRecord[]): Objective =>
    createObjective(records, keys, {
      ...options,
      pool: options.pool ?? new EvaluatorPool({ ...options.evaluator, cache }),
    });
  const objectives = candidates.map((candidate) => objectiveOf([candidate]));
  const existing =
    options.existing !== undefined && options.existing.length > 0
      ? objectiveOf(options.existing)
      : undefined;
  const reference = objectives[0] ?? existing ?? objectiveOf([]);
  const parameters = reference.parameters;
  const n = parameters.length;

  // The parameter sets: the centre, then a Latin hypercube of normal scores.
  const centre = reference.clip(zOf(options.at ?? reference.base, parameters));
  const draws = Math.max(0, Math.round(options.draws ?? 8));
  const seed = (options.seed ?? 1) >>> 0;
  const factor = options.covariance === undefined ? null : cholesky(options.covariance);
  if (options.covariance !== undefined && factor === null) {
    throw new RangeError('rankExperiments: the covariance given is not positive definite');
  }
  const points: number[][] = [centre];
  const strata: number[][] = Array.from({ length: draws }, () => []);
  for (let j = 0; j < n; j++) {
    const order = Array.from({ length: draws }, (_, k) => k).sort(
      (a, b) => randomUniform(seed, STREAM_RANK, j, a) - randomUniform(seed, STREAM_RANK, j, b),
    );
    for (let k = 0; k < draws; k++) {
      const u = ((order[k] as number) + randomUniform(seed, STREAM_RANK, j, draws + k)) / draws;
      (strata[k] as number[]).push(Math.min(1 - 1e-9, Math.max(1e-9, u)));
    }
  }
  for (const u of strata) {
    const z = parameters.map((parameter, i) => {
      if (factor === null) {
        // The prior as it is: the normal cut off at the ends of the range (no pile on a bound).
        const lo = normCdf((parameter.lower - parameter.priorMean) / parameter.priorSd);
        const hi = normCdf((parameter.upper - parameter.priorMean) / parameter.priorSd);
        return (
          parameter.priorMean + parameter.priorSd * normQuantile(lo + (hi - lo) * (u[i] as number))
        );
      }
      let shift = 0;
      for (let k = 0; k <= i; k++)
        shift += ((factor[i] as number[])[k] as number) * normQuantile(u[k] as number);
      return (centre[i] as number) + shift;
    });
    points.push(reference.clip(z));
  }

  const interest = options.interest ?? parameters.map((p) => p.id);
  const subset = parameters
    .map((p, i) => (interest.includes(p.id) || interest.includes(p.key) ? i : -1))
    .filter((i) => i >= 0);
  const prior = zeros(n).map((row, i) =>
    row.map((_, j) => (i === j ? 1 / (parameters[i] as FitParameter).priorSd ** 2 : 0)),
  );
  const add = (a: Matrix, b: Matrix): Matrix =>
    a.map((row, i) => row.map((v, j) => v + ((b[i] as number[])[j] as number)));

  // Fisher information of every candidate, and of the records already run, at every point.
  const fisherAt: Matrix[][] = candidates.map(() => []);
  const haveAt: Matrix[] = [];
  for (let k = 0; k < points.length; k++) {
    const z = points[k] as number[];
    for (let c = 0; c < candidates.length; c++) {
      const jacobian = await adaptiveJacobian(objectives[c] as Objective, z, options);
      (fisherAt[c] as Matrix[]).push(fisherOf(jacobian));
    }
    haveAt.push(
      existing === undefined ? zeros(n) : fisherOf(await adaptiveJacobian(existing, z, options)),
    );
    say(`parameter set ${k + 1} of ${points.length}`);
  }

  // Gains and places at every point.
  const gains: number[][] = candidates.map(() => []);
  const places: number[][] = candidates.map(() => []);
  const marginals: number[][][] = candidates.map(() => []);
  const baseAt: Matrix[] = [];
  const beforeAt: number[] = [];
  for (let k = 0; k < points.length; k++) {
    const base = add(prior, haveAt[k] as Matrix);
    const before = halfLogDetMarginal(base, subset);
    baseAt.push(base);
    beforeAt.push(before);
    candidates.forEach((_, c) => {
      const information = (fisherAt[c] as Matrix[])[k] as Matrix;
      (gains[c] as number[]).push(before - halfLogDetMarginal(add(base, information), subset));
      const report = identifiability(parameters, add(haveAt[k] as Matrix, information));
      (marginals[c] as number[][]).push(
        subset.map((i) => (report.parameters[i] as ParameterIdentifiability).marginal),
      );
    });
    // Places with ties shared: a wash is as high as the number of washes that gain more
    // than it (by more than a thousandth of a bit) plus one.
    candidates.forEach((_, c) => {
      const own = (gains[c] as number[])[k] as number;
      const ahead = candidates.filter(
        (__, other) => ((gains[other] as number[])[k] as number) > own + 1e-3 * Math.LN2,
      ).length;
      (places[c] as number[])[k] = ahead + 1;
    });
  }
  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

  // Greedy order on the mean gain.
  const order = new Map<number, { order: number; gain: number }>();
  let current = baseAt.map((m) => m);
  let entropy = [...beforeAt];
  const left = new Set(candidates.map((_, c) => c));
  while (left.size > 0) {
    let best = -1;
    let bestGain = -Infinity;
    let bestEntropy: number[] = [];
    for (const c of [...left].sort((a, b) =>
      (candidates[a] as WashRecord).id < (candidates[b] as WashRecord).id ? -1 : 1,
    )) {
      const after = points.map((_, k) =>
        halfLogDetMarginal(
          add(current[k] as Matrix, (fisherAt[c] as Matrix[])[k] as Matrix),
          subset,
        ),
      );
      const gain = mean(after.map((h, k) => (entropy[k] as number) - h));
      if (gain > bestGain) {
        bestGain = gain;
        best = c;
        bestEntropy = after;
      }
    }
    if (best < 0) break;
    order.set(best, { order: order.size + 1, gain: bestGain });
    current = current.map((m, k) => add(m, (fisherAt[best] as Matrix[])[k] as Matrix));
    entropy = bestEntropy;
    left.delete(best);
  }

  const leader = candidates
    .map((_, c) => ({ c, gain: mean(gains[c] as number[]) }))
    .sort((a, b) => b.gain - a.gain)[0]?.c;
  const ranking: ExperimentRank[] = candidates
    .map((candidate, c) => {
      const own = gains[c] as number[];
      const gain = mean(own);
      const spread = Math.sqrt(mean(own.map((g) => (g - gain) * (g - gain))));
      const place = places[c] as number[];
      const rankBest = Math.min(...place);
      const rankWorst = Math.max(...place);
      const firstShare = place.filter((p) => p === 1).length / place.length;
      return {
        recordId: candidate.id,
        title: candidate.title ?? candidate.id,
        gain_nats: gain,
        gain_bits: gain / Math.LN2,
        gainSd_bits: spread / Math.LN2,
        gainMin_bits: Math.min(...own) / Math.LN2,
        gainMax_bits: Math.max(...own) / Math.LN2,
        rankBest,
        rankWorst,
        firstShare,
        unstable: rankWorst - rankBest >= 3 || (c === leader && firstShare < 0.5),
        order: order.get(c)?.order ?? 0,
        marginalGain_nats: order.get(c)?.gain ?? 0,
        after: subset.map((i, s) => {
          const marginal = mean((marginals[c] as number[][]).map((m) => m[s] as number));
          return {
            id: (parameters[i] as FitParameter).id,
            marginal,
            verdict: verdictOf(marginal),
          };
        }),
        observations: candidate.observations.length,
      };
    })
    .sort((a, b) => b.gain_nats - a.gain_nats);
  const local = points.length === 1;
  const lines: string[][] = [
    [
      'rank',
      'experiment',
      'obs',
      'gain (bits)',
      '+-',
      'least .. most',
      'place',
      'led in',
      'run as',
      'adds (bits)',
      ...subset.map((i) => `sd ${(parameters[i] as FitParameter).id}`),
      '',
    ],
  ];
  ranking.forEach((r, i) => {
    lines.push([
      String(i + 1),
      r.recordId,
      String(r.observations),
      r.gain_bits.toFixed(2),
      r.gainSd_bits.toFixed(2),
      `${r.gainMin_bits.toFixed(2)} .. ${r.gainMax_bits.toFixed(2)}`,
      r.rankBest === r.rankWorst ? String(r.rankBest) : `${r.rankBest}-${r.rankWorst}`,
      `${(100 * r.firstShare).toFixed(0)} %`,
      `#${r.order}`,
      (r.marginalGain_nats / Math.LN2).toFixed(2),
      ...r.after.map((a) => a.marginal.toFixed(2)),
      r.unstable ? 'UNSTABLE' : '',
    ]);
  });
  const valuesOf = (z: readonly number[]): string =>
    parameters.map((p, j) => `${p.id}=${fmt(fromZ(p, z[j] as number))}`).join(' ');
  const table =
    `${textTable(lines, [0, 2, 3, 4, 9, ...subset.map((_, k) => 10 + k)])}\n\n` +
    (local
      ? `LOCAL RANKING: linearised at one parameter set (${valuesOf(centre)}). The order of the candidates can reverse at other values of these parameters: rank with draws before choosing a wash by it.\n`
      : `gain: mean over ${points.length} parameter sets: the centre (${valuesOf(centre)}) and ${draws} drawn from ${factor === null ? 'the prior' : 'the covariance given'} (seed ${seed}); +-, least .. most: its spread over them\n` +
        'place, led in: best and worst place over the parameter sets, and the share of them in which the wash came first; UNSTABLE: the place moves by three or more, or the leader leads in under half\n') +
    'gain: expected fall of the entropy of the chosen parameters from this wash alone, on top of what is known (linear-Gaussian at each parameter set)\n' +
    'run as / adds: place in the order that gains most at every step, and what the wash adds at that place\n' +
    'sd: posterior over prior deviation of each parameter after this wash alone (1 = nothing learnt)';
  return {
    ranking,
    fisher: Object.fromEntries(
      candidates.map((candidate, c) => [candidate.id, (fisherAt[c] as Matrix[])[0] as Matrix]),
    ),
    parameters,
    points: points.map((z) => parameters.map((p, j) => fromZ(p, z[j] as number))),
    gains_bits: Object.fromEntries(
      candidates.map((candidate, c) => [
        candidate.id,
        (gains[c] as number[]).map((g) => g / Math.LN2),
      ]),
    ),
    local,
    table,
  };
}
