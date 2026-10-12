/**
 * The bands the checklist expects, and the verdict of a measured value against one.
 *
 * The pass criterion of docs/research/standards.md section 9.1, until real tests exist:
 * "correct sign, and magnitude within a factor of two (or within +/- 1 score point)". A band
 * is built from the checklist's own range with that tolerance:
 *
 *  - {@link scoreChange}: a change of an IEC score with a sign. Accepted: the stated range
 *    widened by a factor of two each way, or by one score point each way, whichever reaches
 *    further, but never across zero (the sign must be right and the effect must be there);
 *  - {@link quantity}: any other signed quantity (millilitres, a ratio minus one, a fraction):
 *    the stated range widened by a factor of two each way;
 *  - {@link control}: a negative control, "little or no effect": the magnitude may be at most
 *    twice the stated limit;
 *  - {@link within}: a value that must lie in a stated range (a class mean of 2.3 to 3.7): the
 *    range widened by one score point each way when it is a score, by a factor of two when
 *    not. Expressed as a band on the distance from the middle of the range.
 *
 * A measured value that is exactly zero where a sign is expected is `too small`, not `wrong
 * sign`: nothing happened. Values within {@link ZERO} of zero count as zero.
 */

import type { Expected, Verdict } from './types.ts';

/** Magnitudes below this are zero for the sign test (a rule of the comparison, not physics). */
export const ZERO = 1e-9;

/** The factor of the checklist's tolerance. */
export const FACTOR = 2;

/** The score-point tolerance of the checklist. */
export const SCORE_POINT = 1;

/**
 * A change of an IEC score expected between `lo` and `hi` (both of one sign, or `lo` zero),
 * for example -1 to -2. `stated` is the checklist's wording.
 */
export function scoreChange(lo: number, hi: number, stated: string): Expected {
  const near = Math.min(Math.abs(lo), Math.abs(hi));
  const far = Math.max(Math.abs(lo), Math.abs(hi));
  const sign = lo + hi < 0 ? -1 : 1;
  // The smallest accepted effect: half the stated one, or one point less, but above zero.
  const min = Math.max(0, Math.min(near / FACTOR, near - SCORE_POINT));
  const max = Math.max(far * FACTOR, far + SCORE_POINT);
  return {
    stated,
    sign,
    min,
    max,
    tolerance:
      'stated range, a factor of two or one score point either way; the sign must be right',
  };
}

/** A signed quantity expected between `lo` and `hi` (of one sign), within a factor of two. */
export function quantity(lo: number, hi: number, stated: string): Expected {
  const near = Math.min(Math.abs(lo), Math.abs(hi));
  const far = Math.max(Math.abs(lo), Math.abs(hi));
  return {
    stated,
    sign: lo + hi < 0 ? -1 : 1,
    min: near / FACTOR,
    max: far * FACTOR,
    tolerance: 'stated range, a factor of two either way; the sign must be right',
  };
}

/**
 * A quantity of which the checklist gives only the direction: the sign must be right and the
 * size at least `atLeast`, the smallest change that counts as an effect at all (default: any).
 */
export function direction(sign: -1 | 1, stated: string, atLeast = 0): Expected {
  return {
    stated,
    sign,
    min: atLeast,
    max: Infinity,
    tolerance:
      atLeast > 0
        ? `direction only: the checklist gives no size; under ${atLeast} counts as no effect`
        : 'direction only: the checklist gives no size',
  };
}

/** A negative control: the magnitude is expected to stay within `limit`. */
export function control(limit: number, stated: string): Expected {
  return {
    stated,
    sign: 0,
    min: 0,
    max: limit * FACTOR,
    tolerance: 'negative control: at most twice the stated limit, either sign',
  };
}

/**
 * A value expected inside `lo` to `hi`. The check measures the signed distance of the value
 * from the nearer end of the range (0 inside it), which must then be within `slack`.
 */
export function within(slack: number, stated: string): Expected {
  return {
    stated,
    sign: 0,
    min: 0,
    max: slack,
    tolerance: `distance from the stated range at most ${slack}`,
    distance: true,
  };
}

/** Signed distance of `value` from the range `lo` to `hi`: 0 inside, negative below, positive above. */
export function outside(value: number, lo: number, hi: number): number {
  return value < lo ? value - lo : value > hi ? value - hi : 0;
}

/** The verdict of a measured value against a band. */
export function verdictOf(value: number, expected: Expected): Verdict {
  if (!Number.isFinite(value)) return 'error';
  const magnitude = Math.abs(value);
  if (expected.distance === true) {
    if (magnitude <= expected.max + ZERO) return 'pass';
    return value < 0 ? 'too small' : 'too large';
  }
  if (expected.sign !== 0) {
    if (magnitude <= ZERO) return 'too small';
    if (Math.sign(value) !== expected.sign) return 'wrong sign';
  }
  if (magnitude < expected.min - ZERO) return 'too small';
  if (magnitude > expected.max + ZERO) return 'too large';
  return 'pass';
}

/** True when the measured value has the expected sign (or, for a control, is within its bound). */
export function signIsRight(value: number, expected: Expected): boolean {
  if (!Number.isFinite(value)) return false;
  if (expected.sign === 0) return Math.abs(value) <= expected.max + ZERO;
  return Math.abs(value) > ZERO && Math.sign(value) === expected.sign;
}

/** The band in words, for a report: `-0.5 to -4` or `|x| <= 0.6`. */
export function bandText(expected: Expected): string {
  const f = (v: number): string =>
    v === Infinity ? 'any' : Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(3)));
  if (expected.distance === true) return `within ${f(expected.max)} of the range`;
  if (expected.sign === 0) return `|x| <= ${f(expected.max)}`;
  const s = expected.sign < 0 ? '-' : '+';
  if (expected.max === Infinity)
    return expected.min > 0 ? `${s}${f(expected.min)} or more` : `${s} (any size)`;
  return `${s}${f(expected.min)} to ${s}${f(expected.max)}`;
}

const ORDER: readonly Verdict[] = [
  'pass',
  'not covered',
  'too small',
  'too large',
  'wrong sign',
  'error',
];

/** The worse of two verdicts: error, wrong sign, too large, too small, not covered, pass. */
export function worse(a: Verdict, b: Verdict): Verdict {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}
