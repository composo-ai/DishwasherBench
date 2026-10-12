import { describe, expect, it } from 'vitest';
import {
  normQuantile,
  cholesky,
  eigenSymmetric,
  erfc,
  inverseSpd,
  logDetSpd,
  logGamma,
  logNormCdf,
  normCdf,
  normPdf,
} from './mathx.ts';

describe('normal distribution', () => {
  it('matches tabulated values of the distribution function', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 14);
    expect(normCdf(2.5) + normCdf(-2.5)).toBeCloseTo(1, 14);
    expect(normCdf(-6)).toBeCloseTo(9.865876450377e-10, 20);
    expect(normCdf(1)).toBeCloseTo(0.8413447460685429, 12);
    expect(normCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.9750021048517795, 12);
    expect(normCdf(-3)).toBeCloseTo(0.0013499, 6);
    expect(erfc(0.5)).toBeCloseTo(0.4795001, 6);
  });

  it('has a density that integrates to the distribution function', () => {
    // Simpson's rule from -8 to 1.3.
    const n = 4000;
    const a = -8;
    const b = 1.3;
    const h = (b - a) / n;
    let sum = normPdf(a) + normPdf(b);
    for (let i = 1; i < n; i++) sum += (i % 2 === 1 ? 4 : 2) * normPdf(a + i * h);
    expect((sum * h) / 3).toBeCloseTo(normCdf(1.3), 6);
  });

  it('keeps the logarithm finite and accurate in the far tail', () => {
    // Asymptotically ln Phi(z) = -z^2/2 - ln(-z) - ln sqrt(2 pi) + ln(1 - 1/z^2 + 3/z^4).
    expect(logNormCdf(-30)).toBeCloseTo(-454.3212, 3);
    expect(logNormCdf(-10)).toBeCloseTo(Math.log(7.6198530241605e-24), 4);
    expect(logNormCdf(0)).toBeCloseTo(Math.log(0.5), 6);
    expect(Number.isFinite(logNormCdf(-200))).toBe(true);
  });
});

describe('normQuantile', () => {
  it('inverts the distribution function to 1e-9, tails included', () => {
    expect(normQuantile(0.5)).toBeCloseTo(0, 12);
    expect(normQuantile(0.975)).toBeCloseTo(1.959963985, 8);
    expect(normQuantile(0.025)).toBeCloseTo(-1.959963985, 8);
    expect(normQuantile(1e-6)).toBeCloseTo(-4.753424309, 7);
    for (const p of [1e-9, 1e-4, 0.01, 0.2, 0.5, 0.77, 0.99, 1 - 1e-7]) {
      expect(normCdf(normQuantile(p)) / p).toBeCloseTo(1, 8);
    }
    expect(normQuantile(0)).toBe(-Infinity);
    expect(normQuantile(1)).toBe(Infinity);
  });
});

describe('logGamma', () => {
  it('matches factorials and the half-integer value', () => {
    expect(logGamma(1)).toBeCloseTo(0, 10);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(logGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 10);
    expect(logGamma(10.5)).toBeCloseTo(13.940625219403763, 9);
  });
});

describe('symmetric linear algebra', () => {
  const a = [
    [4, 2, 0.6],
    [2, 5, 1],
    [0.6, 1, 3],
  ];

  it('factors and inverts a positive definite matrix', () => {
    const l = cholesky(a) as number[][];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += (l[i]?.[k] as number) * (l[j]?.[k] as number);
        expect(sum).toBeCloseTo(a[i]?.[j] as number, 12);
      }
    }
    const inverse = inverseSpd(a) as number[][];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += (a[i]?.[k] as number) * (inverse[k]?.[j] as number);
        expect(sum).toBeCloseTo(i === j ? 1 : 0, 12);
      }
    }
    // det = 4 (15 - 1) - 2 (6 - 0.6) + 0.6 (2 - 3) = 44.6
    expect(logDetSpd(a)).toBeCloseTo(Math.log(44.6), 12);
  });

  it('reports a matrix that is not positive definite', () => {
    expect(
      cholesky([
        [1, 2],
        [2, 1],
      ]),
    ).toBeNull();
    expect(
      inverseSpd([
        [0, 0],
        [0, 1],
      ]),
    ).toBeNull();
  });

  it('finds eigenvalues and orthonormal eigenvectors', () => {
    const two = eigenSymmetric([
      [2, 1],
      [1, 2],
    ]);
    expect(two.values[0]).toBeCloseTo(3, 12);
    expect(two.values[1]).toBeCloseTo(1, 12);
    const { values, vectors } = eigenSymmetric(a);
    expect(values.reduce((x, y) => x + y, 0)).toBeCloseTo(12, 10);
    expect(values.reduce((x, y) => x * y, 1)).toBeCloseTo(44.6, 9);
    for (let k = 0; k < 3; k++) {
      // A v = lambda v.
      for (let i = 0; i < 3; i++) {
        let sum = 0;
        for (let j = 0; j < 3; j++) sum += (a[i]?.[j] as number) * (vectors[j]?.[k] as number);
        expect(sum).toBeCloseTo((values[k] as number) * (vectors[i]?.[k] as number), 10);
      }
    }
  });
});
