/**
 * Observation models: from what the simulation says about a target (an item, a region, a
 * patch of soil) to the predicted value of each kind of observation, with a noise model for
 * each (docs/calibration/fitting.md section 2; docs/research/standards.md sections 6.1 and 10).
 *
 * Every model has one scalar prediction `eta`, a function of the simulated state of the
 * target, and a distribution of the observed value about it:
 *
 *   score           eta = s*, the IEC score an observer is expected to give (below). The
 *                   observed whole score is s* plus normal noise of deviation `obs.scoreSd`,
 *                   rounded to 0..5: P(k) = Phi((k + 1/2 - s*) / sd) - Phi((k - 1/2 - s*) / sd),
 *                   the end classes taking the tails (ordered probit)
 *   area_fraction   eta = f, the expected visibly soiled area over the area soiled at the
 *                   start. Observed y = f + normal noise, piled up at the ends: y <= d reads
 *                   "nothing left" with probability Phi((d - f) / sd), y >= 1 - d "all left"
 *                   with 1 - Phi((1 - d - f) / sd), a normal density in between
 *                   (two-sided Tobit); sd^2 = sd_obs^2 + obs.areaModelSd^2
 *   visible_area    eta = the expected visibly soiled area, mm2. Compared in the coordinate
 *                   g(A) = ln(A + a0), a0 = obs.areaFloorMm2 (the area below which a reading
 *                   does not tell a residue from none): g(y) is normal about g(eta) with
 *                   sd^2 = sd_obs^2 + obs.areaLogModelSd^2, sd_obs the stated uncertainty of
 *                   ln(area + a0) (or the one a stated range stands for). For a residue far
 *                   below one per cent of the soiled area, where an area fraction is "nothing
 *                   left" whatever the photograph shows
 *   residual_mass   eta = dry residue, mg. Normal, sd^2 = sd_obs^2 + (obs.massModelRel eta)^2
 *                   + obs.massModelAbs^2 (weighing error and what the model does not explain)
 *   mass_fraction   eta = dry residue over dry soil applied. Normal,
 *                   sd^2 = sd_obs^2 + obs.massFractionModelSd^2
 *   specks          eta = count of separate visible specks. Negative binomial with mean
 *                   eta + obs.speckFloor and dispersion obs.speckDispersion
 *   clean           eta = the margin of the inspector's verdict in standard deviations (below):
 *                   positive exactly when the inspector says clean.
 *                   P(clean) = e + (1 - 2e) Phi(eta), e = obs.cleanMisjudge
 *   retained_water  eta = water standing in the item, mL. Normal,
 *                   sd^2 = sd_obs^2 + (obs.waterModelRel eta)^2 + obs.waterModelAbs^2
 *
 * **Visibility.** The inspector calls an element visibly soiled when its visibility index
 * I = sum_k m_k / m_vis,k reaches 1, takes the area A of those elements and compares it with
 * the bands of the IEC table and with the limit of the clean rule. An observer's threshold is
 * not exactly the inspector's: it is taken to be the inspector's times a factor tau, one factor
 * for the whole target and observation, with ln tau normal of mean 0 and deviation
 * `obs.visibilityLogSd`. The visible area such an observer sees is A(tau) = area of the
 * elements with I >= tau, which falls as tau rises, so "A(tau) <= L" holds exactly for
 * tau above a threshold tau*(L): the index of the element at which the elements, taken from
 * the most soiled down, first cover more than L. With c(L) = ln tau*(L):
 *
 *   the inspector finds A <= L        exactly when  c(L) < 0
 *   an observer finds A <= L          with probability Phi(-c(L) / obs.visibilityLogSd)
 *
 * `TargetState` carries c(L) for every area band and for the limit of the clean rule
 * ({@link visibilityThresholdLog}). From them:
 *
 *   s_A = (5 - number of bands) + sum over the bands of Phi(-c(band) / sd): the score by area
 *         an observer is expected to give. It equals the inspector's score wherever every band
 *         is passed or failed with a margin, and is half way between two scores where the
 *         inspector steps from one to the other.
 *   s_n(n): the score by specks made continuous: 5 at 0, 4.5 at one half, and k + 1/2 half a
 *         speck above each band of the table, linear between. n is the inspector's own count.
 *   s* = min(s_A, s_n).
 *   clean margin = min(-c(L_clean) / obs.visibilityLogSd, (s_n(n) - s_n(n_max + 1/2)) / obs.scoreSd),
 *         or a large negative number when the item holds more water than the rule allows.
 *         P(clean) is above one half exactly when the inspector says clean.
 *   expected visible area = sum over elements of a_e Phi(ln I_e / obs.visibilityLogSd): the
 *         mean of A(tau), which a photograph measures. It is smooth where every element
 *         crosses the threshold at another value of the parameters; the verdict and the score
 *         of a uniform film are not, and should not be: the inspector's are a cliff there.
 *
 * **Gross errors.** A weighed, photographed or measured value (`residual_mass`,
 * `mass_fraction`, `area_fraction`, `visible_area`, `retained_water`) is, with probability `obs.outlierShare`,
 * a gross error that says nothing about the prediction: its density is uniform over the
 * admissible range of the observation ({@link outlierSpan}). The likelihood is the mixture
 * (1 - e) x model + e / span, so one wrong value costs at most ln(e / span) and cannot drag
 * the estimate; {@link outlierProbability} is the posterior probability that a given value is
 * such an error. With e = 0 the models are the plain ones above.
 *
 * Each model also gives its Fisher information about `eta` (for sensitivity, identifiability
 * and experiment ranking), a sampler (for synthetic records and predictive checks) and the
 * mean and deviation of the predicted observation (for reports; those of the model without
 * gross errors).
 */

import type { ParamSet } from '@spotless/sim-core';
import { logGamma, logNormalDensity, logNormCdf, normCdf, normPdf } from './mathx.ts';
import type { ObservationKind } from './record.ts';

/** The constants of the observation models, from the `obs.*` parameters. */
export interface ObsConstants {
  readonly scoreSd: number;
  readonly visibilityLogSd: number;
  readonly areaModelSd: number;
  readonly areaEndTolerance: number;
  readonly areaFloorMm2: number;
  readonly areaLogModelSd: number;
  readonly massModelRel: number;
  readonly massModelAbs: number;
  readonly massFractionModelSd: number;
  readonly speckDispersion: number;
  readonly speckFloor: number;
  readonly cleanMisjudge: number;
  readonly waterModelRel: number;
  readonly waterModelAbs: number;
  readonly outlierShare: number;
  readonly waterSpan: number;
  readonly literatureWeight: number;
}

/** Reads the `obs.*` parameters from a set built on the calibration registry. */
export function resolveObsConstants(params: ParamSet): ObsConstants {
  const g = (name: string): number => params.get(`obs.${name}`);
  return {
    scoreSd: g('scoreSd'),
    visibilityLogSd: g('visibilityLogSd'),
    areaModelSd: g('areaModelSd'),
    areaEndTolerance: g('areaEndTolerance'),
    areaFloorMm2: g('areaFloorMm2'),
    areaLogModelSd: g('areaLogModelSd'),
    massModelRel: g('massModelRel'),
    massModelAbs: g('massModelAbs'),
    massFractionModelSd: g('massFractionModelSd'),
    speckDispersion: g('speckDispersion'),
    speckFloor: g('speckFloor'),
    cleanMisjudge: g('cleanMisjudge'),
    waterModelRel: g('waterModelRel'),
    waterModelAbs: g('waterModelAbs'),
    outlierShare: g('outlierShare'),
    waterSpan: g('waterSpan'),
    literatureWeight: g('literatureWeight'),
  };
}

/** The rule of the inspector as the observation models need it. */
export interface ScoreRule {
  /** Soiled areas (mm2) up to which the IEC score is 5, 4, 3, 2, 1. */
  readonly areaBandsMm2: readonly number[];
  /** Speck counts up to which the IEC score is 5, 4, 3. */
  readonly speckBands: readonly number[];
  /** Most area (mm2), specks and pooled water (mL) of a clean item. */
  readonly maxAreaMm2: number;
  readonly maxSpecks: number;
  readonly maxWaterMl: number;
}

/** What the simulation says about one target at one time. */
export interface TargetState {
  /** Dry soil at the start and now, mg. */
  readonly initialMass_mg: number;
  readonly residualMass_mg: number;
  /** Area that carried soil at the start, mm2. */
  readonly soiledAreaMm2: number;
  /**
   * Area visibly soiled now by the inspector's rule, and the area an observer is expected to
   * see (the file comment, "Visibility"), mm2.
   */
  readonly visibleAreaMm2: number;
  readonly softVisibleAreaMm2: number;
  /**
   * c(L) for each area band of the IEC table and for the limit of the clean rule: the
   * logarithm of the factor on the visibility thresholds at which the visible area would just
   * be L. Negative where the inspector finds the area within L. See
   * {@link visibilityThresholdLog}.
   */
  readonly bandThresholdLog: readonly number[];
  readonly cleanThresholdLog: number;
  /** Separate visibly soiled regions small enough to count as specks. */
  readonly specks: number;
  /** The inspector's IEC score and verdict for the target taken alone. */
  readonly score: number;
  readonly clean: boolean;
  /** Water standing in the item at the end, mL (0 for a state during the run). */
  readonly pooledWater_mL: number;
}

/** |c(L)| is capped here: nothing visible at any threshold, or visible at every one. */
export const THRESHOLD_LOG_CAP = 20;

/**
 * c(L) = ln tau*(L) for each limit L (mm2): tau*(L) is the visibility index of the element at
 * which the elements, taken from the highest index down, first cover more than L. An observer
 * whose visibility threshold is tau times the inspector's sees a soiled area of at most L
 * exactly when tau > tau*(L); the inspector (tau = 1) does exactly when c(L) < 0. The value is
 * -THRESHOLD_LOG_CAP where the soiled elements together do not exceed L.
 *
 * `index` is the visibility index per element and `areaMm2` its area; `scale` multiplies the
 * areas (thinning).
 */
export function visibilityThresholdLog(
  index: ArrayLike<number>,
  areaMm2: ArrayLike<number>,
  limitsMm2: readonly number[],
  scale = 1,
): number[] {
  const order: number[] = [];
  for (let e = 0; e < index.length; e++) if ((index[e] as number) > 0) order.push(e);
  order.sort((x, y) => (index[y] as number) - (index[x] as number) || x - y);
  const out: number[] = [];
  for (const limit of limitsMm2) {
    let covered = 0;
    let value = -THRESHOLD_LOG_CAP;
    for (const e of order) {
      covered += (areaMm2[e] as number) * scale;
      if (covered > limit) {
        value = Math.min(
          THRESHOLD_LOG_CAP,
          Math.max(-THRESHOLD_LOG_CAP, Math.log(index[e] as number)),
        );
        break;
      }
    }
    out.push(value);
  }
  return out;
}

/** The share of an element of visibility index `index` an observer is expected to see. */
export function visibleShare(index: number, logSd: number): number {
  if (!(index > 0)) return 0;
  if (!Number.isFinite(index)) return 1;
  return normCdf(Math.log(index) / logSd);
}

/** The IEC score by area an observer is expected to give: see the file comment. */
export function expectedAreaScore(bandThresholdLog: readonly number[], logSd: number): number {
  let score = Math.max(0, 5 - bandThresholdLog.length);
  for (const c of bandThresholdLog) score += normCdf(-c / logSd);
  return score;
}

/** The IEC score for a number of specks made continuous: see the file comment. */
export function continuousSpeckScore(specks: number, bands: readonly number[]): number {
  if (!(specks > 0)) return 5;
  const lowest = 5 - bands.length;
  const knots: [number, number][] = [
    [0, 5],
    [0.5, 4.5],
  ];
  for (let i = 1; i < bands.length; i++) knots.push([(bands[i] as number) + 0.5, 4.5 - i]);
  const last = knots[knots.length - 1] as [number, number];
  knots.push([2 * last[0], lowest]);
  for (let i = 1; i < knots.length; i++) {
    const [n1, s1] = knots[i] as [number, number];
    if (specks <= n1) {
      const [n0, s0] = knots[i - 1] as [number, number];
      return s0 + ((s1 - s0) * (specks - n0)) / (n1 - n0);
    }
  }
  return lowest;
}

/** The IEC score an observer is expected to give a target: the lower of area and specks. */
export function continuousScore(state: TargetState, rule: ScoreRule, c: ObsConstants): number {
  return Math.min(
    expectedAreaScore(state.bandThresholdLog, c.visibilityLogSd),
    continuousSpeckScore(state.specks, rule.speckBands),
  );
}

/** `eta` of a clean observation whose item holds more water than the rule allows. */
const WET_MARGIN = -50;

/**
 * The margin of the clean verdict in standard deviations: positive exactly when the inspector
 * says clean (area within the limit, specks within theirs, water within its limit).
 */
export function cleanMargin(state: TargetState, rule: ScoreRule, c: ObsConstants): number {
  if (state.pooledWater_mL > rule.maxWaterMl) return WET_MARGIN;
  const area = -state.cleanThresholdLog / c.visibilityLogSd;
  const specks =
    (continuousSpeckScore(state.specks, rule.speckBands) -
      continuousSpeckScore(rule.maxSpecks + 0.5, rule.speckBands)) /
    c.scoreSd;
  return Math.max(WET_MARGIN, Math.min(area, specks, -WET_MARGIN));
}

/** The scalar prediction of an observation kind for a target state. */
export function predictEta(
  kind: ObservationKind,
  state: TargetState,
  rule: ScoreRule,
  c: ObsConstants,
): number {
  switch (kind) {
    case 'score':
      return continuousScore(state, rule, c);
    case 'area_fraction':
      return state.soiledAreaMm2 > 0
        ? Math.min(1, Math.max(0, state.softVisibleAreaMm2 / state.soiledAreaMm2))
        : 0;
    case 'visible_area':
      return Math.max(0, state.softVisibleAreaMm2);
    case 'residual_mass':
      return state.residualMass_mg;
    case 'mass_fraction':
      return state.initialMass_mg > 0 ? state.residualMass_mg / state.initialMass_mg : 0;
    case 'specks':
      return state.specks;
    case 'clean':
      return cleanMargin(state, rule, c);
    case 'retained_water':
      return state.pooledWater_mL;
  }
}

/** Width of the admissible range of a mass fraction for the gross-error allowance. */
const MASS_FRACTION_SPAN = 1.5;

/**
 * Width of the admissible range of an observation, in the unit of its value, for the
 * gross-error allowance: 1 for an area fraction, 1.5 for a mass fraction (a tile can come out
 * heavier than it went in), 1.5 times the dry soil applied for a weighed residue,
 * `obs.waterSpan` for retained water; 0 for the kinds that have no such allowance.
 */
export function outlierSpan(kind: ObservationKind, state: TargetState, c: ObsConstants): number {
  switch (kind) {
    case 'area_fraction':
      return 1;
    case 'visible_area':
      // In the coordinate of the model: from nothing to the whole soiled area.
      return state.soiledAreaMm2 > 0
        ? Math.log((state.soiledAreaMm2 + c.areaFloorMm2) / c.areaFloorMm2)
        : 0;
    case 'mass_fraction':
      return MASS_FRACTION_SPAN;
    case 'residual_mass':
      return MASS_FRACTION_SPAN * Math.max(state.initialMass_mg, 0);
    case 'retained_water':
      return c.waterSpan;
    default:
      return 0;
  }
}

/** Standard deviation of the observed value about `eta`, for the kinds with normal noise. */
export function noiseSd(kind: ObservationKind, eta: number, sd: number, c: ObsConstants): number {
  switch (kind) {
    case 'score':
      return Math.hypot(c.scoreSd, sd);
    case 'area_fraction':
      return Math.hypot(sd, c.areaModelSd);
    case 'visible_area':
      // Of ln(area + floor), not of the area.
      return Math.hypot(sd, c.areaLogModelSd);
    case 'residual_mass':
      return Math.hypot(sd, c.massModelRel * eta, c.massModelAbs);
    case 'mass_fraction':
      return Math.hypot(sd, c.massFractionModelSd);
    case 'retained_water':
      return Math.hypot(sd, c.waterModelRel * eta, c.waterModelAbs);
    case 'clean':
      return 1;
    case 'specks':
      return 0;
  }
}

/** The coordinate a visible area is compared in: ln(area + floor). */
export function areaLog(areaMm2: number, c: Pick<ObsConstants, 'areaFloorMm2'>): number {
  return Math.log(Math.max(areaMm2, 0) + c.areaFloorMm2);
}

const TINY = 1e-300;

/** Probabilities of the scores 0 to 5 for a continuous score `eta` and deviation `s`. */
export function scoreProbabilities(eta: number, s: number): number[] {
  const p: number[] = [];
  for (let k = 0; k <= 5; k++) {
    const hi = k === 5 ? 1 : normCdf((k + 0.5 - eta) / s);
    const lo = k === 0 ? 0 : normCdf((k - 0.5 - eta) / s);
    p.push(Math.max(hi - lo, 0));
  }
  return p;
}

function nbLogPmf(n: number, mu: number, k: number): number {
  return (
    logGamma(n + k) -
    logGamma(k) -
    logGamma(n + 1) +
    k * Math.log(k / (k + mu)) +
    n * Math.log(mu / (k + mu))
  );
}

/** Probability of a clean verdict for a margin `eta` (in standard deviations). */
export function cleanProbability(eta: number, c: ObsConstants): number {
  return c.cleanMisjudge + (1 - 2 * c.cleanMisjudge) * normCdf(eta);
}

/** The share of gross errors that applies: 0 without an admissible range. */
function shareOf(c: ObsConstants, span: number): number {
  return span > 0 && c.outlierShare > 0 ? Math.min(c.outlierShare, 0.999) : 0;
}

/** ln((1 - e) exp(core) + e / span). */
function mixed(core: number, e: number, span: number): number {
  if (e === 0) return core;
  const a = Math.log1p(-e) + core;
  const b = Math.log(e / span);
  const hi = Math.max(a, b);
  return hi + Math.log(Math.exp(a - hi) + Math.exp(b - hi));
}

/**
 * Logarithm of the probability (density) of an observed value given the prediction. `sd` is
 * the stated uncertainty of the observation in the unit of its value (0 where it has none);
 * `span` the admissible range of the value ({@link outlierSpan}), 0 or absent for the model
 * without gross errors.
 */
export function logLikelihood(
  kind: ObservationKind,
  value: number | boolean,
  eta: number,
  sd: number,
  c: ObsConstants,
  span = 0,
): number {
  const y = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  const e = shareOf(c, span);
  switch (kind) {
    case 'score': {
      const s = noiseSd(kind, eta, sd, c);
      const k = Math.min(5, Math.max(0, Math.round(y)));
      // In the tails the difference of two distribution functions loses everything: use the
      // logarithm of the nearer one there.
      const p = scoreProbabilities(eta, s)[k] as number;
      if (p > 1e-12) return Math.log(p);
      const zHi = (k + 0.5 - eta) / s;
      const zLo = (k - 0.5 - eta) / s;
      return eta > k ? logNormCdf(zHi) : logNormCdf(-zLo);
    }
    case 'area_fraction': {
      const s = noiseSd(kind, eta, sd, c);
      const d = c.areaEndTolerance;
      // The uniform part puts d of its mass on each end.
      if (y <= d) return mixed(logNormCdf((d - eta) / s), e, d > 0 ? span / d : Infinity);
      if (y >= 1 - d) return mixed(logNormCdf(-(1 - d - eta) / s), e, d > 0 ? span / d : Infinity);
      return mixed(logNormalDensity(y, eta, s), e, span);
    }
    case 'visible_area':
      // The density of ln(y + floor): the factor that turns it into a density of y does not
      // depend on the prediction.
      return mixed(
        logNormalDensity(areaLog(y, c), areaLog(eta, c), noiseSd(kind, eta, sd, c)),
        e,
        span,
      );
    case 'residual_mass':
    case 'mass_fraction':
    case 'retained_water':
      return mixed(logNormalDensity(y, eta, noiseSd(kind, eta, sd, c)), e, span);
    case 'specks':
      return nbLogPmf(Math.max(0, Math.round(y)), eta + c.speckFloor, c.speckDispersion);
    case 'clean': {
      const p = cleanProbability(eta, c);
      return Math.log(Math.max(y >= 0.5 ? p : 1 - p, TINY));
    }
  }
}

/**
 * The posterior probability that an observed value is a gross error, given the prediction: the
 * uniform part of the mixture over the whole. 0 for the kinds without the allowance.
 */
export function outlierProbability(
  kind: ObservationKind,
  value: number | boolean,
  eta: number,
  sd: number,
  c: ObsConstants,
  span: number,
): number {
  const e = shareOf(c, span);
  if (e === 0 || typeof value === 'boolean') return 0;
  if (
    kind !== 'area_fraction' &&
    kind !== 'visible_area' &&
    kind !== 'residual_mass' &&
    kind !== 'mass_fraction' &&
    kind !== 'retained_water'
  )
    return 0;
  const whole = logLikelihood(kind, value, eta, sd, c, span);
  const core = Math.log1p(-e) + logLikelihood(kind, value, eta, sd, c, 0);
  return Math.min(1, Math.max(0, 1 - Math.exp(core - whole)));
}

/** Simpson's rule over [lo, hi] with `n` (even) intervals. */
function simpson(f: (x: number) => number, lo: number, hi: number, n: number): number {
  const h = (hi - lo) / n;
  let sum = f(lo) + f(hi);
  for (let i = 1; i < n; i++) sum += (i % 2 === 1 ? 4 : 2) * f(lo + i * h);
  return (sum * h) / 3;
}

/**
 * Fisher information of a model with gross errors, by quadrature: the expected square of the
 * derivative of the log likelihood to `eta` (a central difference).
 */
function mixedInformation(
  kind: 'area_fraction' | 'visible_area' | 'residual_mass' | 'mass_fraction' | 'retained_water',
  eta: number,
  sd: number,
  c: ObsConstants,
  span: number,
): number {
  const s = noiseSd(kind, eta, sd, c);
  if (kind === 'visible_area') {
    // In g = ln(area + floor) the model is a normal of deviation s with a uniform part over
    // `span`: the information about g by quadrature over the observed g, then the chain rule.
    const g = areaLog(eta, c);
    const e = shareOf(c, span);
    const logDensity = (x: number, centre: number): number =>
      mixed(logNormalDensity(x, centre, s), e, span);
    const hg = 1e-4 * s;
    const infoG = simpson(
      (x) => {
        const slope = (logDensity(x, g + hg) - logDensity(x, g - hg)) / (2 * hg);
        return slope * slope * Math.exp(logDensity(x, g));
      },
      g - 9 * s,
      g + 9 * s,
      360,
    );
    const dg = 1 / (eta + c.areaFloorMm2);
    return infoG * dg * dg;
  }
  const h = 1e-4 * s;
  const term = (y: number): number => {
    const up = logLikelihood(kind, y, eta + h, sd, c, span);
    const down = logLikelihood(kind, y, eta - h, sd, c, span);
    const score = (up - down) / (2 * h);
    return score * score * Math.exp(logLikelihood(kind, y, eta, sd, c, span));
  };
  if (kind !== 'area_fraction') return simpson(term, eta - 9 * s, eta + 9 * s, 360);
  const d = c.areaEndTolerance;
  const lo = Math.max(d, eta - 9 * s);
  const hi = Math.min(1 - d, eta + 9 * s);
  // The two piles (the value 0 stands for "nothing left", 1 for "all left") and the interior.
  let info = term(0) + term(1);
  if (hi > lo) info += simpson(term, lo + 1e-12, hi - 1e-12, 360);
  return info;
}

/**
 * Fisher information of one observation about its prediction `eta`: the expected square of
 * d(log likelihood)/d(eta).
 */
export function fisherInformation(
  kind: ObservationKind,
  eta: number,
  sd: number,
  c: ObsConstants,
  span = 0,
): number {
  if (
    shareOf(c, span) > 0 &&
    (kind === 'area_fraction' ||
      kind === 'visible_area' ||
      kind === 'residual_mass' ||
      kind === 'mass_fraction' ||
      kind === 'retained_water')
  )
    return mixedInformation(kind, eta, sd, c, span);
  switch (kind) {
    case 'score': {
      const s = noiseSd(kind, eta, sd, c);
      let info = 0;
      for (let k = 0; k <= 5; k++) {
        const hi = k === 5 ? 1 : normCdf((k + 0.5 - eta) / s);
        const lo = k === 0 ? 0 : normCdf((k - 0.5 - eta) / s);
        const p = hi - lo;
        if (!(p > 1e-14)) continue;
        const dHi = k === 5 ? 0 : -normPdf((k + 0.5 - eta) / s) / s;
        const dLo = k === 0 ? 0 : -normPdf((k - 0.5 - eta) / s) / s;
        info += ((dHi - dLo) * (dHi - dLo)) / p;
      }
      return info;
    }
    case 'area_fraction': {
      const s = noiseSd(kind, eta, sd, c);
      const d = c.areaEndTolerance;
      const a = (d - eta) / s;
      const b = (1 - d - eta) / s;
      const pa = normCdf(a);
      const pb = normCdf(-b);
      let info = normCdf(b) - pa + a * normPdf(a) - b * normPdf(b);
      if (pa > 1e-14) info += (normPdf(a) * normPdf(a)) / pa;
      if (pb > 1e-14) info += (normPdf(b) * normPdf(b)) / pb;
      return Math.max(info, 0) / (s * s);
    }
    case 'visible_area': {
      const s = noiseSd(kind, eta, sd, c);
      const dg = 1 / (eta + c.areaFloorMm2);
      return (dg * dg) / (s * s);
    }
    case 'residual_mass':
    case 'retained_water': {
      const s = noiseSd(kind, eta, sd, c);
      const rel = kind === 'residual_mass' ? c.massModelRel : c.waterModelRel;
      return 1 / (s * s) + (2 * rel ** 4 * eta * eta) / s ** 4;
    }
    case 'mass_fraction': {
      const s = noiseSd(kind, eta, sd, c);
      return 1 / (s * s);
    }
    case 'specks': {
      const mu = eta + c.speckFloor;
      return 1 / (mu + (mu * mu) / c.speckDispersion);
    }
    case 'clean': {
      const p = cleanProbability(eta, c);
      const dp = (1 - 2 * c.cleanMisjudge) * normPdf(eta);
      return (dp * dp) / Math.max(p * (1 - p), TINY);
    }
  }
}

/** Mean and standard deviation of the predicted observation. */
export function predictiveMoments(
  kind: ObservationKind,
  eta: number,
  sd: number,
  c: ObsConstants,
): { mean: number; sd: number } {
  switch (kind) {
    case 'score': {
      const p = scoreProbabilities(eta, noiseSd(kind, eta, sd, c));
      let mean = 0;
      let second = 0;
      p.forEach((pk, k) => {
        mean += k * pk;
        second += k * k * pk;
      });
      return { mean, sd: Math.sqrt(Math.max(second - mean * mean, 0)) };
    }
    case 'area_fraction': {
      const s = noiseSd(kind, eta, sd, c);
      const d = c.areaEndTolerance;
      const a = (d - eta) / s;
      const b = (1 - d - eta) / s;
      const inside = normCdf(b) - normCdf(a);
      const p1 = normCdf(-b);
      const mean = p1 + eta * inside + s * (normPdf(a) - normPdf(b));
      const second =
        p1 +
        (eta * eta + s * s) * inside +
        2 * eta * s * (normPdf(a) - normPdf(b)) +
        s * s * (a * normPdf(a) - b * normPdf(b));
      return { mean, sd: Math.sqrt(Math.max(second - mean * mean, 0)) };
    }
    case 'visible_area': {
      // Log-normal in (area + floor): its mean and deviation, the floor taken off the mean.
      const s = noiseSd(kind, eta, sd, c);
      const scale = eta + c.areaFloorMm2;
      return {
        mean: scale * Math.exp(0.5 * s * s) - c.areaFloorMm2,
        sd: scale * Math.sqrt((Math.exp(s * s) - 1) * Math.exp(s * s)),
      };
    }
    case 'residual_mass':
    case 'mass_fraction':
    case 'retained_water':
      return { mean: eta, sd: noiseSd(kind, eta, sd, c) };
    case 'specks': {
      const mu = eta + c.speckFloor;
      return { mean: mu, sd: Math.sqrt(mu + (mu * mu) / c.speckDispersion) };
    }
    case 'clean': {
      const p = cleanProbability(eta, c);
      return { mean: p, sd: Math.sqrt(p * (1 - p)) };
    }
  }
}

/**
 * Draws an observed value given the prediction. `uniform` returns independent numbers in
 * (0, 1) and `normal` independent standard normal deviates; the counter-based generator of
 * `@spotless/core` supplies both. With an admissible range `span` and `obs.outlierShare`
 * above 0, a weighed, photographed or measured value is a gross error with that probability:
 * uniform between 0 and `span`.
 */
export function sampleObservation(
  kind: ObservationKind,
  eta: number,
  sd: number,
  c: ObsConstants,
  uniform: () => number,
  normal: () => number,
  span = 0,
): number | boolean {
  const e = shareOf(c, span);
  const gross =
    e > 0 &&
    (kind === 'area_fraction' ||
      kind === 'visible_area' ||
      kind === 'residual_mass' ||
      kind === 'mass_fraction' ||
      kind === 'retained_water') &&
    uniform() < e;
  switch (kind) {
    case 'score':
      return Math.min(5, Math.max(0, Math.round(eta + noiseSd(kind, eta, sd, c) * normal())));
    case 'area_fraction': {
      const y = gross ? span * uniform() : eta + noiseSd(kind, eta, sd, c) * normal();
      const d = c.areaEndTolerance;
      return y <= d ? 0 : y >= 1 - d ? 1 : y;
    }
    case 'visible_area': {
      // Drawn in ln(area + floor); a gross error anywhere between nothing and the whole area.
      const g = gross
        ? Math.log(c.areaFloorMm2) + span * uniform()
        : areaLog(eta, c) + noiseSd(kind, eta, sd, c) * normal();
      return Math.max(0, Math.exp(g) - c.areaFloorMm2);
    }
    case 'residual_mass':
    case 'mass_fraction':
    case 'retained_water':
      return gross ? span * uniform() : eta + noiseSd(kind, eta, sd, c) * normal();
    case 'specks': {
      // Inverse of the distribution function.
      const mu = eta + c.speckFloor;
      const u = uniform();
      let cumulative = 0;
      const cap = Math.ceil(mu + 20 * Math.sqrt(mu + (mu * mu) / c.speckDispersion) + 20);
      for (let n = 0; n < cap; n++) {
        cumulative += Math.exp(nbLogPmf(n, mu, c.speckDispersion));
        if (u <= cumulative) return n;
      }
      return cap;
    }
    case 'clean':
      return uniform() < cleanProbability(eta, c);
  }
}

/**
 * Log likelihood of an observed mean score of a group of items (`RecordGroupObservation`) at
 * the predicted mean `eta` of their continuous scores: normal about the prediction with the
 * stated uncertainty of the mean. A published class mean is an average over many items and
 * runs, so no allowance for a gross error is made and no item-level noise is added: its
 * uncertainty is what the record states.
 */
export function groupMeanLogLikelihood(value: number, eta: number, sd: number): number {
  const z = (value - eta) / sd;
  return -0.5 * z * z - Math.log(sd * Math.sqrt(2 * Math.PI));
}
