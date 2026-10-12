// The spread of the loading inside one deposit (spread.ts) against the log-normal it is the
// closed form of: the distribution function, the share above a level, the mass left above a
// depth, their inverses and the table the kernel reads.
import { describe, expect, it } from 'vitest';
import {
  createSpreadTable,
  depthOfExcess,
  depthOfShare,
  excessAbove,
  normalCdf,
  shareAbove,
  shareAboveThreshold,
  sigmaOfCv,
} from './index.ts';

/** P(X > k) and E[(X - r)+] of a log-normal of mean 1 by quadrature over ln X from ln k up. */
function byQuadrature(level: number, sigma: number): { share: number; excess: number } {
  const n = 40000;
  const lo = Math.log(level);
  const hi = Math.max(lo, 0) + 12 * sigma;
  const h = (hi - lo) / n;
  let share = 0;
  let excess = 0;
  for (let i = 0; i <= n; i++) {
    const u = lo + i * h;
    const z = (u + 0.5 * sigma * sigma) / sigma;
    const density = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
    const w = i === 0 || i === n ? 0.5 * h : h;
    share += w * density;
    excess += w * density * (Math.exp(u) - level);
  }
  return { share, excess };
}

describe('normalCdf', () => {
  it('gives the tabulated values, tails to a relative 1e-5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normalCdf(-3) / 1.349898e-3).toBeCloseTo(1, 5);
    expect(normalCdf(-5) / 2.8665157e-7).toBeCloseTo(1, 5);
    expect(normalCdf(3) + normalCdf(-3)).toBeCloseTo(1, 12);
  });
});

describe('the loading inside a deposit', () => {
  const sigma = sigmaOfCv(0.3);

  it('has mean 1 and the registered coefficient of variation', () => {
    expect(sigma).toBeCloseTo(Math.sqrt(Math.log(1.09)), 12);
    expect(sigmaOfCv(0)).toBe(0);
    expect(excessAbove(0, sigma)).toBe(1);
    expect(shareAbove(0, sigma)).toBe(1);
    // Half of the area is loaded above the median exp(-sigma^2 / 2).
    expect(shareAbove(Math.exp(-0.5 * sigma * sigma), sigma)).toBeCloseTo(0.5, 6);
  });

  it('agrees with quadrature of the log-normal to 1e-5', () => {
    for (const s of [sigmaOfCv(0.1), sigma, sigmaOfCv(0.6)]) {
      for (const level of [0.3, 0.7, 1, 1.5, 2.5]) {
        const exact = byQuadrature(level, s);
        expect(Math.abs(shareAbove(level, s) - exact.share)).toBeLessThan(1e-5);
        expect(Math.abs(excessAbove(level, s) - exact.excess)).toBeLessThan(1e-5);
      }
    }
  });

  it('loses mass at the rate of the share still covered: dG/dr = -Q', () => {
    for (const r of [0.2, 0.6, 1, 1.4, 2]) {
      const h = 1e-4;
      const slope = (excessAbove(r + h, sigma) - excessAbove(r - h, sigma)) / (2 * h);
      expect(slope).toBeCloseTo(-shareAbove(r, sigma), 5);
    }
  });

  it('leaves the constant stage near 70 % removed and ends on a few per cent of the area', () => {
    // soils 6.1: constant rate until SRI is about 70 %. With cv 0.3 the rate has fallen by
    // 10 to 20 % when 70 % of the mass is gone, and by more than half when 90 % is gone.
    const at70 = depthOfExcess(0.3, sigma);
    expect(shareAbove(at70, sigma)).toBeGreaterThan(0.8);
    expect(shareAbove(at70, sigma)).toBeLessThan(0.9);
    const at90 = depthOfExcess(0.1, sigma);
    expect(shareAbove(at90, sigma)).toBeLessThan(0.5);
    // After twice the mean loading has been taken, under 1 % of the mass is left, on under
    // 1 % of the area: mostly gone with a little left.
    expect(excessAbove(2, sigma)).toBeLessThan(0.01);
    expect(shareAbove(2, sigma)).toBeGreaterThan(0.002);
    expect(shareAbove(2, sigma)).toBeLessThan(0.01);
  });

  it('inverts: the depth of a share left and of a share covered', () => {
    for (const left of [0.999, 0.9, 0.5, 0.1, 1e-3, 1e-6]) {
      const r = depthOfExcess(left, sigma);
      expect(excessAbove(r, sigma) / left).toBeCloseTo(1, 6);
    }
    expect(depthOfExcess(1, sigma)).toBe(0);
    for (const share of [0.9, 0.5, 0.01, 1e-6]) {
      expect(shareAbove(depthOfShare(share, sigma), sigma) / share).toBeCloseTo(1, 5);
    }
  });

  it('is an even layer without spread', () => {
    expect(excessAbove(0.25, 0)).toBe(0.75);
    expect(excessAbove(1.5, 0)).toBe(0);
    expect(shareAbove(0.99, 0)).toBe(1);
    expect(shareAbove(1, 0)).toBe(0);
    expect(depthOfExcess(0.4, 0)).toBeCloseTo(0.6, 12);
  });
});

describe('the table of the kernel', () => {
  it('follows the closed form to 2e-6, falls monotonically, and ends at exactly nothing', () => {
    for (const cv of [0.1, 0.3, 0.6]) {
      const sigma = sigmaOfCv(cv);
      const table = createSpreadTable(sigma);
      expect(table.left(0)).toBe(1);
      expect(table.left(table.end)).toBe(0);
      expect(table.left(10 * table.end)).toBe(0);
      expect(shareAbove(table.end, sigma)).toBeLessThan(2e-9);
      let before = 1;
      for (let i = 1; i <= 5000; i++) {
        const r = (i / 5000) * table.end;
        const left = table.left(r);
        expect(left).toBeLessThanOrEqual(before);
        expect(Math.abs(left - excessAbove(r, sigma))).toBeLessThan(cv > 0.5 ? 2e-5 : 2e-6);
        before = left;
      }
    }
  });

  it('is the linear fall of an even layer without spread', () => {
    const table = createSpreadTable(0);
    expect(table.left(0.3)).toBeCloseTo(0.7, 12);
    expect(table.left(1)).toBe(0);
  });
});

describe('the share of a deposit above a threshold', () => {
  const sigma = sigmaOfCv(0.3);

  it('is all or nothing without spread', () => {
    for (const form of ['erode', 'thin', 'peel'] as const) {
      expect(shareAboveThreshold(form, 5, 0.3, 0.2, 0)).toBe(1);
      expect(shareAboveThreshold(form, 5, 0.1, 0.2, 0)).toBe(0);
      expect(shareAboveThreshold(form, 5, 0, 0.2, sigma)).toBe(0);
    }
  });

  it('is the share still covered for an eroded deposit, less what is thinner than the threshold', () => {
    // 5 mg/cm2 at the start, threshold 0.035: untouched, all of it is visible.
    expect(shareAboveThreshold('erode', 5, 5, 0.035, sigma)).toBeGreaterThan(0.999);
    // After 1.5 times the mean loading has been taken: the share loaded above 1.5 + 0.007.
    const left = 5 * excessAbove(1.5, sigma);
    const share = shareAboveThreshold('erode', 5, left, 0.035, sigma);
    expect(share).toBeCloseTo(shareAbove(1.5 + 0.035 / 5, sigma), 6);
    // 1.3 % of the mass is left on 8 % of the area: a lumped element would show all of it.
    expect(left / 5).toBeLessThan(0.02);
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.1);
    expect(left).toBeGreaterThan(0.035);
  });

  it('thins everywhere under a first-order law: half the cell is above a threshold at the median', () => {
    const median = Math.exp(-0.5 * sigma * sigma);
    expect(shareAboveThreshold('thin', 0.05, 0.005 / median, 0.005, sigma)).toBeCloseTo(0.5, 6);
    // A film bleached to a third of the threshold shows only where it was three times thicker.
    expect(shareAboveThreshold('thin', 0.05, 0.005 / 3, 0.005, sigma)).toBeLessThan(1e-3);
  });

  it('keeps its loading where a peeled deposit is still on', () => {
    expect(shareAboveThreshold('peel', 5, 1, 0.035, sigma)).toBeCloseTo(0.2, 6);
  });

  it('never grows as the residue falls', () => {
    for (const form of ['erode', 'thin', 'peel'] as const) {
      let before = 1;
      for (let i = 100; i >= 1; i--) {
        const share = shareAboveThreshold(form, 5, (5 * i) / 100, 0.2, sigma);
        expect(share).toBeLessThanOrEqual(before + 1e-12);
        before = share;
      }
    }
  });
});
