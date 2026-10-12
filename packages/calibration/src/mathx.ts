/**
 * Small numerical tools of the calibration: the normal distribution, the log gamma function,
 * and dense symmetric linear algebra (Cholesky factor, Jacobi eigen-decomposition) for
 * matrices of a few tens of rows. Pure f64, no dependencies.
 */

const SQRT2 = Math.SQRT2;
const LOG_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);

const SQRT_PI = Math.sqrt(Math.PI);

/**
 * Complementary error function to about 1e-14 relative: below 2.5 the series
 * erf(x) = (2 / sqrt(pi)) exp(-x^2) sum_n 2^n x^(2n+1) / (1 3 5 ... (2n+1)), whose terms are all
 * of one sign; above it the continued fraction
 * erfc(x) = exp(-x^2) / sqrt(pi) / (x + (1/2) / (x + 1 / (x + (3/2) / (x + ...)))).
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  let value: number;
  if (z < 2.5) {
    let term = z;
    let sum = z;
    for (let n = 1; n < 200; n++) {
      term *= (2 * z * z) / (2 * n + 1);
      sum += term;
      if (term < 1e-17 * sum) break;
    }
    value = 1 - (2 / SQRT_PI) * Math.exp(-z * z) * sum;
  } else {
    let tail = 0;
    for (let k = 80; k >= 1; k--) tail = (0.5 * k) / (z + tail);
    value = Math.exp(-z * z) / (SQRT_PI * (z + tail));
  }
  return x >= 0 ? value : 2 - value;
}

/** Density of the standard normal distribution. */
export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z - LOG_SQRT_2PI);
}

/** Distribution function of the standard normal distribution. */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / SQRT2);
}

/**
 * Logarithm of the standard normal distribution function, finite for every finite argument
 * (the asymptotic series takes over in the far lower tail, where the function underflows).
 */
export function logNormCdf(z: number): number {
  if (z > -20) {
    const p = normCdf(z);
    if (p > 0) return Math.log(p);
  }
  const z2 = z * z;
  return -0.5 * z2 - Math.log(-z) - LOG_SQRT_2PI + Math.log1p(-1 / z2 + 3 / (z2 * z2));
}

/**
 * Quantile function of the standard normal distribution for 0 < p < 1 (Acklam's rational
 * approximation with one Halley step on the distribution function; error below 1e-9).
 */
export function normQuantile(p: number): number {
  if (!(p > 0)) return -Infinity;
  if (!(p < 1)) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ] as const;
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ] as const;
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ] as const;
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ] as const;
  const low = 0.02425;
  let x: number;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - low) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normCdf(x) - p;
  const u = e / Math.max(normPdf(x), 1e-300);
  return x - u / (1 + 0.5 * x * u);
}

/** Logarithm of the density of a normal distribution with mean `mean` and deviation `sd`. */
export function logNormalDensity(value: number, mean: number, sd: number): number {
  const z = (value - mean) / sd;
  return -0.5 * z * z - Math.log(sd) - LOG_SQRT_2PI;
}

/** Logarithm of the gamma function for x > 0 (Lanczos, g = 7, nine terms; error below 1e-13). */
export function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflection.
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  }
  const y = x - 1;
  let a = c[0] as number;
  const t = y + g + 0.5;
  for (let i = 1; i < 9; i++) a += (c[i] as number) / (y + i);
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
}

/** A dense matrix as rows. */
export type Matrix = number[][];

/** An n by n matrix of zeros. */
export function zeros(n: number, m = n): Matrix {
  return Array.from({ length: n }, () => new Array<number>(m).fill(0));
}

/**
 * The lower Cholesky factor L of a symmetric positive definite matrix (A = L L^T), or null
 * when the matrix is not positive definite.
 */
export function cholesky(a: Matrix): Matrix | null {
  const n = a.length;
  const l = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = (a[i] as number[])[j] as number;
      for (let k = 0; k < j; k++)
        sum -= ((l[i] as number[])[k] as number) * ((l[j] as number[])[k] as number);
      if (i === j) {
        if (!(sum > 0)) return null;
        (l[i] as number[])[j] = Math.sqrt(sum);
      } else {
        (l[i] as number[])[j] = sum / ((l[j] as number[])[j] as number);
      }
    }
  }
  return l;
}

/** The inverse of a symmetric positive definite matrix, or null when it is not. */
export function inverseSpd(a: Matrix): Matrix | null {
  const n = a.length;
  const l = cholesky(a);
  if (l === null) return null;
  // Invert L, then A^-1 = L^-T L^-1.
  const li = zeros(n);
  for (let i = 0; i < n; i++) {
    (li[i] as number[])[i] = 1 / ((l[i] as number[])[i] as number);
    for (let j = 0; j < i; j++) {
      let sum = 0;
      for (let k = j; k < i; k++)
        sum -= ((l[i] as number[])[k] as number) * ((li[k] as number[])[j] as number);
      (li[i] as number[])[j] = sum / ((l[i] as number[])[i] as number);
    }
  }
  const inv = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = i; k < n; k++)
        sum += ((li[k] as number[])[i] as number) * ((li[k] as number[])[j] as number);
      (inv[i] as number[])[j] = sum;
      (inv[j] as number[])[i] = sum;
    }
  }
  return inv;
}

/** Logarithm of the determinant of a symmetric positive definite matrix, or -Infinity. */
export function logDetSpd(a: Matrix): number {
  const l = cholesky(a);
  if (l === null) return -Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.log((l[i] as number[])[i] as number);
  return 2 * sum;
}

/**
 * Eigenvalues (descending) and eigenvectors (as columns: `vectors[i][k]` is component i of
 * vector k) of a symmetric matrix, by cyclic Jacobi rotations.
 */
export function eigenSymmetric(a: Matrix): { values: number[]; vectors: Matrix } {
  const n = a.length;
  const m = a.map((row) => [...row]);
  const v = zeros(n);
  for (let i = 0; i < n; i++) (v[i] as number[])[i] = 1;
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) off += ((m[i] as number[])[j] as number) ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = (m[p] as number[])[q] as number;
        if (Math.abs(apq) < 1e-300) continue;
        const app = (m[p] as number[])[p] as number;
        const aqq = (m[q] as number[])[q] as number;
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const mkp = (m[k] as number[])[p] as number;
          const mkq = (m[k] as number[])[q] as number;
          (m[k] as number[])[p] = c * mkp - s * mkq;
          (m[k] as number[])[q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < n; k++) {
          const mpk = (m[p] as number[])[k] as number;
          const mqk = (m[q] as number[])[k] as number;
          (m[p] as number[])[k] = c * mpk - s * mqk;
          (m[q] as number[])[k] = s * mpk + c * mqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = (v[k] as number[])[p] as number;
          const vkq = (v[k] as number[])[q] as number;
          (v[k] as number[])[p] = c * vkp - s * vkq;
          (v[k] as number[])[q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => ((m[j] as number[])[j] as number) - ((m[i] as number[])[i] as number),
  );
  return {
    values: order.map((i) => (m[i] as number[])[i] as number),
    vectors: v.map((row) => order.map((k) => row[k] as number)),
  };
}
