/**
 * Problems reported by the validators of this package. A problem is a value, never an
 * exception: `validateMachineSpec` and `validateMachineConfig` return the list of everything
 * that is wrong, empty when nothing is.
 */

/**
 * How bad a problem is: an `error` makes the description unusable (geometry that cannot exist,
 * a programme that does not add up); a `warning` is something a reader should know about but
 * that the model can run with.
 */
export type ProblemSeverity = 'error' | 'warning';

/** One thing wrong with a machine description or a configuration. */
export interface MachineProblem {
  readonly severity: ProblemSeverity;
  /** Stable machine-readable code, for example `basket_outside_tub`. */
  readonly code: string;
  /** Where in the description, as a dotted path (`baskets.lower.tineRows.r1`). */
  readonly path: string;
  /** What is wrong, with the numbers, in millimetres and other everyday units. */
  readonly message: string;
}

/** Builds an error-severity {@link MachineProblem}. */
export function problem(code: string, path: string, message: string): MachineProblem {
  return { severity: 'error', code, path, message };
}

/** Builds a warning-severity {@link MachineProblem}. */
export function warning(code: string, path: string, message: string): MachineProblem {
  return { severity: 'warning', code, path, message };
}

/** The problems of error severity in a list. */
export function errorsOf(problems: readonly MachineProblem[]): MachineProblem[] {
  return problems.filter((p) => p.severity === 'error');
}
