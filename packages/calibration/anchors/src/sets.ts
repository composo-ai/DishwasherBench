/**
 * Reading and combining the parameter sets of the anchoring: the anchored soil-side set, a
 * detergent set laid over it (`packages/calibration/detergents/`), and the dose of a tablet,
 * which is a value of the machine and not a parameter.
 */

import { readFileSync } from 'node:fs';
import { washRegistry, type ParamValue, type WashInput } from '@spotless/sim-core';
import { readParamSet } from '@spotless/sim-params';

/**
 * The overrides of a `spotless.params` file, checked against the registry of the wash. With
 * `lenient` a file whose stored hashes differ from the current registry's is still read (its
 * values are validated under the current definitions): for a detergent set written by another
 * engineer against another state of the registry. The anchored set itself is read strictly.
 */
export function readOverrides(file: string, lenient = false): Record<string, ParamValue> {
  const read = readParamSet(
    washRegistry(),
    JSON.parse(readFileSync(file, 'utf8')) as unknown,
    lenient ? { onHashMismatch: 'ignore' } : {},
  );
  if (!read.ok) {
    throw new RangeError(
      `${file}: ${read.error.map((issue) => `${issue.key} ${issue.message}`).join('; ')}`,
    );
  }
  return { ...read.value.overrides };
}

/**
 * A wash input with another detergent dose (kg). The dose is `dosing.detergentMass` of the
 * machine specification; the exposure cache hashes the whole specification, so a wash with
 * another dose computes its exposure again although the geometry is the same (a defect of the
 * cache key, reported to its owner).
 */
export function withDose(input: WashInput, dose: number): WashInput {
  return {
    ...input,
    machine: { ...input.machine, dosing: { ...input.machine.dosing, detergentMass: dose } },
  };
}

/**
 * The protease level of a detergent laid over a set that fitted `liq.xProtease` for the
 * reference detergent: the fitted value times the ratio the detergent set states against the
 * reference default (the detergent dossier's rule: "scale the fitted value, do not replace
 * it"), held inside the registered range.
 */
export function scaledProtease(
  anchored: Readonly<Record<string, ParamValue>>,
  detergent: Readonly<Record<string, ParamValue>>,
): number | undefined {
  const stated = detergent['liq.xProtease'];
  if (typeof stated !== 'number') return undefined;
  const def = washRegistry().def('liq.xProtease') as { default: number; max: number };
  const fitted = anchored['liq.xProtease'];
  const base = typeof fitted === 'number' ? fitted : def.default;
  return Math.min(def.max, (base * stated) / def.default);
}
