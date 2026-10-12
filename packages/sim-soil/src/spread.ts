/**
 * The spread of the loading inside one deposit (docs/research/soils.md sections 7.5 "Decay
 * stage", 7.7 and R3; docs/research/standards.md section 10.2, the sub-element coverage).
 *
 * A deposit is one soil cell (1 to 4 mm2) with a mean dry loading m_0. Inside it the loading is
 * not even: the local loading is m_0 X with X log-normal of mean 1 and coefficient of variation
 * `soil.subCellCv` (sigma^2 = ln(1 + cv^2)). What that does to a deposit depends on how its
 * soil leaves:
 *
 *   erode   a zero-order law takes the same depth R (kg/m2) everywhere, so the thin places are
 *           bare first:    left = m_0 G(R / m_0),  covered share = Q(R / m_0)
 *   thin    a first-order law takes the same share everywhere: every place keeps X m
 *   peel    a law that lifts the layer off whole leaves the share m / m_0 at its full loading
 *
 *   Q(k) = P(X > k)       = Phi(d2),                d2 = -ln(k) / sigma - sigma / 2
 *   G(r) = E[(X - r)+]    = Phi(d1) - r Phi(d2),    d1 = d2 + sigma
 *
 * The removed share of a deposit under a constant flux is then linear in time while every place
 * is still covered and falls off as the thin places come clean: with cv = 0.3 the rate has
 * fallen by a seventh when 70 % is gone, which is where the in-machine tiles leave their
 * constant stage (soils 6.1), and the last per cent sits on the thickest few per cent of the
 * area. That is what a lumped element imitates with the factor min(1, m / (0.3 m_0)), and what
 * lets a soil be mostly gone with a little left instead of evenly thinned.
 *
 * Pure functions, f64, deterministic.
 */

/** sigma of the logarithm of a log-normal variable of coefficient of variation `cv`. */
export function sigmaOfCv(cv: number): number {
  return cv > 0 ? Math.sqrt(Math.log(1 + cv * cv)) : 0;
}

/**
 * The standard normal distribution function Phi(z), from the complementary error function in
 * the Chebyshev form of Numerical Recipes (fractional error below 1.2e-7 everywhere, tails
 * included, which the last specks of a deposit need).
 */
export function normalCdf(z: number): number {
  // literal-ok-begin: coefficients of the Chebyshev approximation of erfc (Numerical Recipes 6.2)
  const x = Math.abs(z) * Math.SQRT1_2;
  const t = 1 / (1 + 0.5 * x);
  const erfc =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return z >= 0 ? 1 - 0.5 * erfc : 0.5 * erfc;
  // literal-ok-end
}

/** Q(k) = P(X > k) for X log-normal of mean 1: the share of a deposit loaded above k m_0. */
export function shareAbove(k: number, sigma: number): number {
  if (!(k > 0)) return 1;
  if (!(sigma > 0)) return k < 1 ? 1 : 0;
  return normalCdf(-Math.log(k) / sigma - 0.5 * sigma);
}

/**
 * G(r) = E[(X - r)+]: the share of its dry mass a deposit keeps when the depth r m_0 has been
 * taken everywhere. 1 at r = 0, falling to 0.
 */
export function excessAbove(r: number, sigma: number): number {
  if (!(r > 0)) return 1;
  if (!(sigma > 0)) return r < 1 ? 1 - r : 0;
  const d2 = -Math.log(r) / sigma - 0.5 * sigma;
  const left = normalCdf(d2 + sigma) - r * normalCdf(d2);
  return left > 0 ? left : 0;
}

/** Bisection steps of {@link depthOfExcess}: the bracket shrinks below 1e-12 of its width. */
// literal-ok-begin: named arithmetic control, documented where it is declared
const INVERSE_STEPS = 48;
// literal-ok-end

/**
 * The depth r (in units of m_0) at which a deposit keeps the share `left` of its mass: the
 * inverse of {@link excessAbove}. 0 for a share of 1 or more; the depth at which the share
 * above is `floor` for a share of 0.
 */
export function depthOfExcess(left: number, sigma: number, floor = 1e-9): number {
  if (!(left < 1)) return 0;
  if (!(sigma > 0)) return left > 0 ? 1 - left : 1;
  let lo = 0;
  let hi = depthOfShare(floor, sigma);
  if (!(left > excessAbove(hi, sigma))) return hi;
  for (let i = 0; i < INVERSE_STEPS; i++) {
    const mid = 0.5 * (lo + hi);
    if (excessAbove(mid, sigma) > left) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * The depth r (in units of m_0) beyond which less than the share `share` of a deposit is still
 * covered: Q(r) = share, by bisection on ln r.
 */
export function depthOfShare(share: number, sigma: number): number {
  if (!(sigma > 0)) return 1;
  // literal-ok-begin: bracket of the bisection in standard deviations of ln X (arithmetic only)
  let lo = -12 * sigma;
  let hi = 12 * sigma;
  // literal-ok-end
  for (let i = 0; i < INVERSE_STEPS; i++) {
    const mid = 0.5 * (lo + hi);
    if (shareAbove(Math.exp(mid), sigma) > share) lo = mid;
    else hi = mid;
  }
  return Math.exp(0.5 * (lo + hi));
}

/** How the residue of a deposit lies inside it: see the file comment. */
export type ResidueForm = 'erode' | 'thin' | 'peel';

/**
 * The share of a deposit whose residue is above `threshold`, from its dry loading at the start
 * `initial` and now `residual` (any one unit of mass per area for the three). With `sigma` 0
 * the deposit is even: all of it is above the threshold or none is.
 */
export function shareAboveThreshold(
  form: ResidueForm,
  initial: number,
  residual: number,
  threshold: number,
  sigma: number,
): number {
  if (!(residual > 0)) return 0;
  if (!(sigma > 0) || !(initial > 0)) return residual >= threshold ? 1 : 0;
  if (form === 'thin') return shareAbove(threshold / residual, sigma);
  if (form === 'peel') {
    return Math.min(1, residual / initial) * shareAbove(threshold / initial, sigma);
  }
  const depth = depthOfExcess(residual / initial, sigma);
  return shareAbove(depth + threshold / initial, sigma);
}

/**
 * {@link shareAboveThreshold} as a function of the threshold alone, for a caller that asks for
 * many thresholds of one deposit (the depth already taken from an eroded deposit is found once).
 */
export function shareCurve(
  form: ResidueForm,
  initial: number,
  residual: number,
  sigma: number,
): (threshold: number) => number {
  if (!(residual > 0)) return () => 0;
  if (!(sigma > 0) || !(initial > 0)) return (threshold) => (residual >= threshold ? 1 : 0);
  if (form === 'thin') return (threshold) => shareAbove(threshold / residual, sigma);
  if (form === 'peel') {
    const left = Math.min(1, residual / initial);
    return (threshold) => left * shareAbove(threshold / initial, sigma);
  }
  const depth = depthOfExcess(residual / initial, sigma);
  return (threshold) => shareAbove(depth + threshold / initial, sigma);
}

/** Points per unit of ln r in a {@link SpreadTable}. */
// literal-ok-begin: named arithmetic control, documented where it is declared
const TABLE_POINTS = 2048;
/** The table ends where the covered share has fallen to this. */
const TABLE_FLOOR = 1e-9;
// literal-ok-end

/**
 * G(r) on a grid, for the soil kernel, which evaluates it for every deposit at every step:
 * linear in r between the points (G is convex, so the interpolant lies above it by less than
 * 1e-6), exactly 1 at r = 0 and exactly 0 from `end` on.
 */
export interface SpreadTable {
  readonly sigma: number;
  /** Depth (units of m_0) from which a deposit is taken as bare. */
  readonly end: number;
  /** The share of its mass a deposit keeps at depth `r` (units of m_0). */
  left(r: number): number;
}

/** The table of G for one sigma. With sigma 0: left = 1 - r down to 0. */
export function createSpreadTable(sigma: number): SpreadTable {
  if (!(sigma > 0)) {
    return {
      sigma: 0,
      end: 1,
      left: (r) => (r > 0 ? (r < 1 ? 1 - r : 0) : 1),
    };
  }
  const end = depthOfShare(TABLE_FLOOR, sigma);
  const step = end / TABLE_POINTS;
  const values = new Float64Array(TABLE_POINTS + 1);
  for (let i = 0; i <= TABLE_POINTS; i++) values[i] = excessAbove(i * step, sigma);
  values[0] = 1;
  values[TABLE_POINTS] = 0;
  return {
    sigma,
    end,
    left(r) {
      if (!(r > 0)) return 1;
      if (!(r < end)) return 0;
      const x = r / step;
      const i = Math.floor(x);
      const a = values[i] as number;
      return a + ((values[i + 1] as number) - a) * (x - i);
    },
  };
}
