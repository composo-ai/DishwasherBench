/**
 * Fitting support (scope note, "Calibration is a first-class feature"; brief of M2, item 8):
 * what a fitting tool drives. A calibration group names the parameters adjusted together;
 * `fitAxes` lists them with their ranges, `applyNormalised` turns a vector of normalised values
 * (0 to 1 within each range) into a parameter set, and `normalisedValues` is the reverse.
 *
 * A scalar is one axis and a vector one axis per component. An axis is logarithmic where the
 * range is positive and spans more than a decade (or where the definition says so). Fixed
 * parameters (`min === max`) and enumerations are not axes: a discrete choice is not something
 * a continuous optimiser moves, and the tool sets it by an ordinary override.
 */
import type { ParamProvenance, ParamSet } from './param-set.ts';
import { isNumericDef, type ParamRegistry, paramScale } from './registry.ts';
import type { ParamScale, ParamValue } from './types.ts';

/** One adjustable number. */
export interface FitAxis {
  /** Label: the key, with `[i]` for a component of a vector. */
  readonly id: string;
  /** Registry key. */
  readonly key: string;
  /** Component of a vector parameter; `null` for a scalar. */
  readonly index: number | null;
  /** Unit of the range. */
  readonly unit: string;
  /** Lower end of the range. */
  readonly min: number;
  /** Upper end of the range. */
  readonly max: number;
  /** Registry default of the parameter (or of the component). */
  readonly default: number;
  /** How normalised values map onto the range. */
  readonly scale: ParamScale;
}

/**
 * The fit axes of the given keys, in the order given (vector components in component order).
 * Per-class soil keys (`soil.<class>.<name>`) are accepted whether or not they are declared.
 * Throws `RangeError` for an enumeration or a fixed parameter.
 */
export function fitAxesOf(registry: ParamRegistry, keys: readonly string[]): FitAxis[] {
  const axes: FitAxis[] = [];
  for (const key of keys) {
    const def = registry.def(key);
    if (!isNumericDef(def)) throw new RangeError(`${key} is an enumeration and cannot be fitted`);
    if (def.min === def.max) throw new RangeError(`${key} is fixed and cannot be fitted`);
    const scale = paramScale(def);
    const base = { key, unit: def.unit, min: def.min, max: def.max, scale };
    if (def.kind === 'vector') {
      def.default.forEach((value, i) => {
        axes.push({ ...base, id: `${key}[${def.components?.[i] ?? i}]`, index: i, default: value });
      });
    } else {
      axes.push({ ...base, id: key, index: null, default: def.default });
    }
  }
  return axes;
}

/**
 * The fit axes of one calibration group: its numeric, non-fixed parameters in key order
 * (enumerations and fixed parameters of the group are left out). Empty for an unknown group.
 */
export function fitAxes(registry: ParamRegistry, calibrationGroup: string): FitAxis[] {
  const keys = registry
    .calibrationGroup(calibrationGroup)
    .filter((def) => isNumericDef(def) && def.min !== def.max)
    .map((def) => def.key);
  return fitAxesOf(registry, keys);
}

/**
 * Maps a normalised value u in [0, 1] onto the range of an axis: min + u (max - min), or
 * min (max / min)^u on a logarithmic axis. The ends are returned exactly.
 */
export function denormaliseOnAxis(axis: FitAxis, u: number): number {
  if (u <= 0) return axis.min;
  if (u >= 1) return axis.max;
  const x =
    axis.scale === 'log'
      ? axis.min * Math.pow(axis.max / axis.min, u)
      : axis.min + u * (axis.max - axis.min);
  return Math.min(Math.max(x, axis.min), axis.max);
}

/** The reverse of {@link denormaliseOnAxis}: the normalised position of a value on an axis. */
export function normaliseOnAxis(axis: FitAxis, value: number): number {
  const u =
    axis.scale === 'log'
      ? Math.log(value / axis.min) / Math.log(axis.max / axis.min)
      : (value - axis.min) / (axis.max - axis.min);
  return Math.min(Math.max(u, 0), 1);
}

/** Options of {@link applyNormalised}. */
export interface ApplyNormalisedOptions {
  /**
   * What to do with a normalised value outside [0, 1]: `throw` (default) a `RangeError`, or
   * `clamp` it to the range, for optimisers that step outside their box.
   */
  readonly outOfRange?: 'throw' | 'clamp';
  /** Provenance of the resulting set. Default: that of `base`. */
  readonly provenance?: ParamProvenance;
}

/**
 * The overrides that put each axis at its normalised value, on top of the values `base` holds
 * for the other components of the same vectors.
 */
export function overridesFromNormalised(
  base: ParamSet,
  axes: readonly FitAxis[],
  u: readonly number[],
  options: ApplyNormalisedOptions = {},
): Record<string, ParamValue> {
  if (u.length !== axes.length) {
    throw new RangeError(`expected ${axes.length} normalised values, got ${u.length}`);
  }
  const overrides: Record<string, ParamValue> = {};
  axes.forEach((axis, i) => {
    const ui = u[i] as number;
    if (!Number.isFinite(ui) || ((ui < 0 || ui > 1) && options.outOfRange !== 'clamp')) {
      throw new RangeError(`normalised value ${ui} of ${axis.id} is outside 0 to 1`);
    }
    const value = denormaliseOnAxis(axis, ui);
    if (axis.index === null) {
      overrides[axis.key] = value;
    } else {
      const current = overrides[axis.key] ?? base.getVector(axis.key);
      const next = [...(current as readonly number[])];
      next[axis.index] = value;
      overrides[axis.key] = next;
    }
  });
  return overrides;
}

/**
 * A parameter set with each axis at its normalised value and every other parameter as in
 * `base`: the step a fitting tool repeats (brief of M2, item 8).
 */
export function applyNormalised(
  base: ParamSet,
  axes: readonly FitAxis[],
  u: readonly number[],
  options: ApplyNormalisedOptions = {},
): ParamSet {
  return base.with(overridesFromNormalised(base, axes, u, options), options.provenance);
}

/** The normalised position of a parameter set on each axis: the reverse of {@link applyNormalised}. */
export function normalisedValues(params: ParamSet, axes: readonly FitAxis[]): number[] {
  return axes.map((axis) => {
    const value =
      axis.index === null
        ? params.get(axis.key)
        : (params.getVector(axis.key)[axis.index] as number);
    return normaliseOnAxis(axis, value);
  });
}
