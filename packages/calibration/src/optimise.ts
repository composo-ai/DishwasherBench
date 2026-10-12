/**
 * Derivative-free minimisation for the fit (docs/calibration/fitting.md section 5): the
 * Nelder-Mead simplex with coefficients adapted to the dimension, bounds by clipping, and
 * restarts.
 *
 * Why this method. The objective of a fit is cheap in dimension (2 to 10 parameters) and
 * expensive per evaluation (one replay per record, 0.1 s to tens of seconds), it is only
 * piecewise smooth (soil that is gone is gone; a jet either exceeds a threshold or does not),
 * and its gradient is not available. A simplex search uses function values only, compares
 * them and never differences them, needs n + 1 evaluations to start and one or two per step,
 * and is deterministic. Its known failures are a simplex that collapses onto a subspace and a
 * stop on a plateau or at a kink; both are met by restarting from the point reached with a
 * fresh simplex (`restarts`), which is repeated until a restart no longer improves, and by
 * starting from several points of the prior (`fit.ts`). A population method such as CMA-ES is
 * more robust on rugged objectives but needs some hundreds of evaluations per parameter, which
 * a wash record with a full load cannot afford.
 */

/** A function to minimise. */
export type AsyncFunction = (x: readonly number[]) => Promise<number>;

/** Options of {@link nelderMead}. */
export interface NelderMeadOptions {
  /** First step along each coordinate: the simplex is the start and the start moved by each. */
  readonly step: readonly number[];
  /** Bounds of each coordinate. */
  readonly lower: readonly number[];
  readonly upper: readonly number[];
  /** Stop after this many evaluations. */
  readonly maxEvaluations: number;
  /** Stop when the values of the simplex lie within this, and */
  readonly fTolerance: number;
  /** its points within this share of `step` of the best along every coordinate. */
  readonly xTolerance: number;
}

/** What a minimisation found. */
export interface MinimumResult {
  readonly x: number[];
  readonly f: number;
  readonly evaluations: number;
  /** True when the tolerances were met, false when the evaluations ran out. */
  readonly converged: boolean;
}

/** One Nelder-Mead minimisation from `start`. */
export async function nelderMead(
  f: AsyncFunction,
  start: readonly number[],
  options: NelderMeadOptions,
): Promise<MinimumResult> {
  const n = start.length;
  const clip = (x: readonly number[]): number[] =>
    x.map((v, i) => Math.min(options.upper[i] as number, Math.max(options.lower[i] as number, v)));
  if (n === 0) return { x: [], f: await f([]), evaluations: 1, converged: true };
  // Coefficients adapted to the dimension (Gao and Han 2012); the classic ones for n = 1, 2.
  const alpha = 1;
  const beta = n > 2 ? 1 + 2 / n : 2;
  const gamma = n > 2 ? 0.75 - 1 / (2 * n) : 0.5;
  const delta = n > 2 ? 1 - 1 / n : 0.5;
  let evaluations = 0;
  const value = async (x: readonly number[]): Promise<number> => {
    evaluations++;
    const v = await f(x);
    return Number.isFinite(v) ? v : Infinity;
  };
  const simplex: { x: number[]; f: number }[] = [];
  const x0 = clip(start);
  simplex.push({ x: x0, f: await value(x0) });
  for (let i = 0; i < n; i++) {
    const x = [...x0];
    const h = options.step[i] as number;
    // Step away from a bound that is in the way.
    x[i] =
      (x0[i] as number) + h <= (options.upper[i] as number)
        ? (x0[i] as number) + h
        : (x0[i] as number) - h;
    const clipped = clip(x);
    simplex.push({ x: clipped, f: await value(clipped) });
  }
  const order = (): void => {
    simplex.sort((a, b) => a.f - b.f);
  };
  let converged = false;
  while (evaluations < options.maxEvaluations) {
    order();
    const best = simplex[0] as { x: number[]; f: number };
    const worst = simplex[n] as { x: number[]; f: number };
    let spread = 0;
    for (const vertex of simplex) {
      for (let i = 0; i < n; i++) {
        spread = Math.max(
          spread,
          Math.abs((vertex.x[i] as number) - (best.x[i] as number)) / (options.step[i] as number),
        );
      }
    }
    if (worst.f - best.f <= options.fTolerance && spread <= options.xTolerance) {
      converged = true;
      break;
    }
    const centroid = new Array<number>(n).fill(0);
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++)
        centroid[i] =
          (centroid[i] as number) + ((simplex[k] as { x: number[] }).x[i] as number) / n;
    }
    const along = (t: number): number[] =>
      clip(centroid.map((c, i) => c + t * ((worst.x[i] as number) - c)));
    const second = simplex[n - 1] as { x: number[]; f: number };
    const reflected = along(-alpha);
    const fr = await value(reflected);
    if (fr < best.f) {
      const expanded = along(-alpha * beta);
      const fe = await value(expanded);
      simplex[n] = fe < fr ? { x: expanded, f: fe } : { x: reflected, f: fr };
    } else if (fr < second.f) {
      simplex[n] = { x: reflected, f: fr };
    } else {
      const outside = fr < worst.f;
      const contracted = along(outside ? -alpha * gamma : gamma);
      const fc = await value(contracted);
      if (fc < Math.min(fr, worst.f)) {
        simplex[n] = { x: contracted, f: fc };
      } else {
        // Shrink towards the best vertex.
        for (let k = 1; k <= n; k++) {
          const vertex = simplex[k] as { x: number[]; f: number };
          const x = clip(
            vertex.x.map((v, i) => (best.x[i] as number) + delta * (v - (best.x[i] as number))),
          );
          simplex[k] = { x, f: await value(x) };
        }
      }
    }
  }
  order();
  const best = simplex[0] as { x: number[]; f: number };
  return { x: best.x, f: best.f, evaluations, converged };
}

/** Options of {@link minimise}. */
export interface MinimiseOptions extends NelderMeadOptions {
  /** Restarts from the point reached, each with a simplex of half the size; default 2. */
  readonly restarts?: number;
  /** A restart that improves by less than this ends the restarts; default `fTolerance`. */
  readonly restartTolerance?: number;
}

/** One start with its restarts. */
export interface MinimiseTrace {
  readonly start: readonly number[];
  readonly x: readonly number[];
  readonly f: number;
  readonly evaluations: number;
  readonly restarts: number;
  readonly converged: boolean;
}

/**
 * Nelder-Mead from one start, restarted from the point reached with a fresh simplex until a
 * restart improves by less than the tolerance or the restarts run out.
 */
export async function minimise(
  f: AsyncFunction,
  start: readonly number[],
  options: MinimiseOptions,
): Promise<MinimiseTrace> {
  let result = await nelderMead(f, start, options);
  let evaluations = result.evaluations;
  let restarts = 0;
  let step = [...options.step];
  const most = options.restarts ?? 2;
  const tolerance = options.restartTolerance ?? options.fTolerance;
  while (restarts < most) {
    step = step.map((h) => 0.5 * h);
    const next = await nelderMead(f, result.x, { ...options, step });
    evaluations += next.evaluations;
    restarts++;
    const gain = result.f - next.f;
    if (next.f <= result.f) result = next;
    if (!(gain > tolerance)) break;
  }
  return {
    start,
    x: result.x,
    f: result.f,
    evaluations,
    restarts,
    converged: result.converged,
  };
}
