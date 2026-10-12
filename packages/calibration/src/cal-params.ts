/**
 * The registered parameters of the calibration itself, and the registry a calibration resolves
 * its parameters against: every parameter of the wash simulation plus these.
 *
 *  - `obs.*`   the constants of the observation models (`observation.ts`): how a predicted
 *              residue becomes the expected value and the scatter of each kind of observation;
 *  - `cal.*`   scale factors applied to cached exposure at replay time: a closure scale of the
 *              jets or of the film that enters an exposure table linearly need not be fitted by
 *              recomputing the water (`evaluator.ts` says how each is applied and how a fitted
 *              value is folded back into the registry key it stands for);
 *  - `prog.*`  what the Auto programme decides for itself and a record without a measured
 *              course does not know: the temperature the main wash reaches, the length of its
 *              hold, the temperature of the final rinse. (The wash simulation has `prog.*`
 *              keys of its own, the soak of Eco 50: those are keys of `wash()` like any other
 *              and are not listed here; `isCalibrationKey` tells the two apart.)
 *
 * All are in the `soil` hash group: none of them changes an exposure. They are not keys of the
 * wash simulation: `wash()` does not accept them, and a fitted parameter set is written in two
 * parts, the wash registry's own format and these (`fit.ts`).
 */

import {
  createParamSet,
  createRegistry,
  SOIL_MODEL_CLASSES,
  WASH_PARAM_CONTRIBUTIONS,
  type AnyParamDef,
  type ParamProvenance,
  type ParamRegistry,
  type ParamSet,
  type ParamValue,
} from '@spotless/sim-core';
import { AREA_FLOOR_DEFAULT_MM2 } from './record.ts';

const ST = 'standards';

/** The parameters the calibration adds to the registry. */
export const CALIBRATION_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'obs.scoreSd',
    unit: '1',
    default: 0.6,
    min: 0.2,
    max: 1.5,
    tag: 'ESTIMATED',
    source: `${ST} 6.1, 7.1: scatter of a visual IEC cleaning score about the score the residue deserves, in score points (repeatability of item scores in the 2022 round robin is 0.2 to 1.0 by item class)`,
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.visibilityLogSd',
    unit: '1',
    default: 0.3,
    min: 0.02,
    max: 1.5,
    scale: 'log',
    tag: 'SYN',
    source: `${ST} 10.3: standard deviation of the logarithm of an observer's visibility threshold about the inspector's (0.3: an observer sees a residue 30 % thinner or needs one 30 % thicker). One factor for a whole target and observation, so a verdict or score changes exactly where the inspector's does; a photographed area counts each element with the probability that such an observer sees it`,
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.areaModelSd',
    unit: '1',
    default: 0.05,
    min: 0.005,
    max: 0.3,
    tag: 'SYN',
    source:
      'calibration: scatter of a soiled-area fraction about the prediction that the model does not explain (soil thickness, application), added to the stated uncertainty of the photograph',
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.areaEndTolerance',
    unit: '1',
    default: 0.01,
    min: 0,
    max: 0.05,
    tag: 'SYN',
    source:
      'calibration: an observed area fraction within this of 0 or of 1 is read as "nothing left" or "all left" (the ends of the scale, where observations pile up)',
    group: 'soil',
  },
  {
    key: 'obs.areaFloorMm2',
    unit: 'mm2',
    default: AREA_FLOOR_DEFAULT_MM2,
    min: 0.5,
    max: 20,
    tag: 'ESTIMATED',
    source:
      'docs/calibration/owner-wash-01-result.md (yellow pixels on the photographs of two spotless plates: 2 to 25 mm2 by threshold, "the noise floor of the method, about 5 mm2"); standards 6.1 (the clean rule ends at 4 mm2): visibly soiled area below which a photograph or the eye does not tell a residue from none. An observed visible area (visible_area) is compared with the prediction in ln(area + this), so a reading of nothing and a prediction of a square millimetre agree, and above it the comparison is one of factors',
    group: 'soil',
  },
  {
    key: 'obs.areaLogModelSd',
    unit: '1',
    default: 0.5,
    min: 0.05,
    max: 2,
    scale: 'log',
    tag: 'ESTIMATED',
    source:
      'calibration (docs/calibration/owner-wash-01-calibration.md section 3): scatter of ln(visible area + obs.areaFloorMm2) about the prediction that the model does not explain with perfect instruments: where the thick places of a soil lie. Measured on the model itself: the four plates of owner wash 01 laid out with eight level seeds at one parameter set give a standard deviation of 0.15 to 0.60 (the lower values where the area is near the floor). Added in quadrature to the stated uncertainty of the reading',
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.massModelRel',
    unit: '1',
    default: 0.1,
    min: 0,
    max: 0.5,
    tag: 'SYN',
    source:
      'calibration: relative scatter of a weighed residue about the prediction that the model does not explain',
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.massModelAbs',
    unit: 'mg',
    default: 0.5,
    min: 0,
    max: 20,
    tag: 'SYN',
    source:
      'calibration: absolute scatter of a weighed residue that the model does not explain (water left in the soil, lint), mg',
    group: 'soil',
  },
  {
    key: 'obs.massFractionModelSd',
    unit: '1',
    default: 0.05,
    min: 0.005,
    max: 0.3,
    tag: 'SYN',
    source:
      'calibration: scatter of a residual mass fraction about the prediction that the model does not explain',
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.speckDispersion',
    unit: '1',
    default: 2,
    min: 0.2,
    max: 50,
    tag: 'SYN',
    source:
      'calibration: dispersion k of the negative binomial scatter of a speck count (variance mu + mu^2 / k)',
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.speckFloor',
    unit: '1',
    default: 0.2,
    min: 0.01,
    max: 2,
    tag: 'SYN',
    source:
      'calibration: specks an observer finds on an item the model leaves spotless (redeposited particles, which the first build does not simulate)',
    group: 'soil',
  },
  {
    key: 'obs.cleanMisjudge',
    unit: '1',
    default: 0.02,
    min: 0.001,
    max: 0.2,
    tag: 'SYN',
    source: 'calibration: probability that a clean-or-not verdict is wrong whatever the residue',
    group: 'soil',
  },
  {
    key: 'obs.waterModelRel',
    unit: '1',
    default: 0.3,
    min: 0,
    max: 1,
    tag: 'SYN',
    source:
      'calibration: relative scatter of retained water about the prediction that the model does not explain',
    group: 'soil',
  },
  {
    key: 'obs.waterModelAbs',
    unit: 'mL',
    default: 0.5,
    min: 0,
    max: 10,
    tag: 'SYN',
    source: 'calibration: absolute scatter of retained water that the model does not explain, mL',
    group: 'soil',
  },
  {
    key: 'obs.outlierShare',
    unit: '1',
    default: 0.03,
    min: 0,
    max: 0.3,
    tag: 'SYN',
    source:
      'calibration: probability that a weighed, photographed or measured value is a gross error (a mistyped number, a tile that was shadowed, a wrong item) and says nothing about the prediction: the likelihood of such a value is uniform over the admissible range of the observation; 0 switches the allowance off',
    group: 'soil',
    calibration: 'observation',
  },
  {
    key: 'obs.waterSpan',
    unit: 'mL',
    default: 250,
    min: 10,
    max: 2000,
    tag: 'SYN',
    source:
      'calibration: admissible range of a retained-water reading for the gross-error allowance, mL (what a mug holds)',
    group: 'soil',
  },
  {
    key: 'obs.literatureWeight',
    unit: '1',
    default: 0.25,
    min: 0.01,
    max: 1,
    tag: 'SYN',
    source:
      'calibration: weight of the log likelihood of a literature record that states none (a published result for this class of machine is a weak observation: a quarter weight doubles every stated uncertainty)',
    group: 'soil',
  },
  {
    key: 'cal.jetShearScale',
    unit: '1',
    default: 1,
    min: 0.2,
    max: 5,
    scale: 'log',
    tag: 'ESTIMATED',
    source:
      'calibration: factor on the peak and mean wall shear of the jets in cached exposure, applied at replay time. A stand-in for a common scale of jets.kStag and jets.kFilm: exact for what the soil model reads off the peak shear, not for the footprint (where the shear exceeds the first of jets.shearLevels), which those keys also move',
    group: 'soil',
    calibration: 'replayScales',
  },
  {
    key: 'cal.filmShearScale',
    unit: '1',
    default: 1,
    min: 0.2,
    max: 5,
    scale: 'log',
    tag: 'ESTIMATED',
    source:
      'calibration: factor on the wall shear of the running film on every block in cached exposure, applied at replay time (no single registry key stands behind it: the film stage computes that shear from its own friction closures)',
    group: 'soil',
    calibration: 'replayScales',
  },
  {
    key: 'cal.holdTimeScale',
    unit: '1',
    default: 1,
    min: 0.1,
    max: 10,
    scale: 'log',
    tag: 'SYN',
    source:
      'calibration: factor on the time a surface stays wet after the spray stops, in cached exposure, applied at replay time (the film stage computes that time from its drain-down; no single registry key stands behind it)',
    group: 'soil',
    calibration: 'replayScales',
  },
  {
    key: 'prog.mainWashTargetShift',
    unit: 'K',
    default: 0,
    min: -25,
    max: 8,
    tag: 'ESTIMATED',
    source:
      'machine-bosch-smv4hax40g.md 4.4, 4.6: difference between the liquor temperature the main wash of this run reached and the target of the programme as written (Auto 45-65 chooses it from the turbidity readings); 0 with a measured course',
    group: 'soil',
    calibration: 'programme',
  },
  {
    key: 'prog.mainWashHoldScale',
    unit: '1',
    default: 1,
    min: 0.25,
    max: 2,
    tag: 'ESTIMATED',
    source:
      'machine-bosch-smv4hax40g.md 4.4, 4.6: length of the main-wash hold of this run over that of the programme as written; 1 with a measured course',
    group: 'soil',
    calibration: 'programme',
  },
  {
    key: 'prog.finalRinseTargetShift',
    unit: 'K',
    default: 0,
    min: -25,
    max: 5,
    tag: 'ESTIMATED',
    source:
      'machine-bosch-smv4hax40g.md 4.4: difference between the temperature the final rinse of this run reached and the target of the programme as written',
    group: 'soil',
    calibration: 'programme',
  },
];

/** First segments of the keys that belong to the calibration and not to the wash simulation. */
export const CALIBRATION_PREFIXES: readonly string[] = ['obs', 'cal', 'prog'];

/** The keys the calibration adds to the registry. */
const CALIBRATION_KEYS: ReadonlySet<string> = new Set(CALIBRATION_PARAM_DEFS.map((def) => def.key));

/**
 * True for a key the calibration adds ({@link CALIBRATION_PARAM_DEFS}: `obs.*`, `cal.*` and the
 * three `prog.*` keys of a programme that decides for itself). The key decides, not its first
 * segment: the wash simulation has `prog.*` keys of its own (`prog.soakDuty`, `prog.soakCycle`,
 * `prog.soakFrom`, the soak of Eco 50), which `wash()` reads and a parameter file must hold.
 */
export function isCalibrationKey(key: string): boolean {
  return CALIBRATION_KEYS.has(key);
}

/**
 * True for a calibration key that changes what a wash does and that `wash()` cannot be given
 * by a parameter file: a `cal.*` scale on cached exposure or one of the calibration's own
 * `prog.*` keys. The `obs.*` constants change no wash.
 */
export function isWashShapingCalibrationKey(key: string): boolean {
  return isCalibrationKey(key) && !key.startsWith('obs.');
}

let registry: ParamRegistry | undefined;

/**
 * The registry of a calibration: every definition of the wash simulation and
 * {@link CALIBRATION_PARAM_DEFS}. Built once per process. Its `hydro` group is that of the
 * wash registry, so a set built on it has the hydro hash the exposure cache is keyed by.
 */
export function calibrationRegistry(): ParamRegistry {
  registry ??= createRegistry({
    contributions: [...Object.values(WASH_PARAM_CONTRIBUTIONS), CALIBRATION_PARAM_DEFS],
    soilClasses: [...SOIL_MODEL_CLASSES],
  });
  return registry;
}

/** A parameter set of a calibration: the defaults with `overrides` on top. */
export function createCalibrationParams(
  overrides: Readonly<Record<string, unknown>> = {},
  provenance?: ParamProvenance,
): ParamSet {
  return createParamSet(calibrationRegistry(), overrides, provenance);
}

/** The overrides of a calibration set that are keys of the wash simulation. */
export function washOverridesOf(params: ParamSet): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(params.overrides)) {
    if (!isCalibrationKey(key)) out[key] = value;
  }
  return out;
}

/** The overrides of a calibration set that are the calibration's own keys. */
export function calibrationOverridesOf(params: ParamSet): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(params.overrides)) {
    if (isCalibrationKey(key)) out[key] = value;
  }
  return out;
}

/**
 * The scale factors on cached exposure, with the columns of the exposure tables each
 * multiplies and the registry key it stands in for, if any. `outer.ts` checks whether the
 * exposure really is that simple a function of the key (`checkReplayScale`); for the exposure
 * stages as they stood when this was written it is not (docs/calibration/fitting.md section 9.4),
 * so a fitted scale says how much more or less stress the soil needs, and the key itself is
 * fitted in the outer loop.
 */
export const REPLAY_SCALES: readonly {
  readonly key: string;
  readonly standsFor: string | null;
  readonly table: 'jets' | 'water';
  readonly fields: readonly string[];
}[] = [
  {
    key: 'cal.jetShearScale',
    standsFor: 'jets.kStag',
    table: 'jets',
    fields: ['shearPeak', 'shearMean'],
  },
  { key: 'cal.filmShearScale', standsFor: null, table: 'water', fields: ['shear'] },
  { key: 'cal.holdTimeScale', standsFor: null, table: 'water', fields: ['holdTime'] },
];
