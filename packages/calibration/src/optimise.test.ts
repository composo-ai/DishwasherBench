import { describe, expect, it } from 'vitest';
import { minimise, nelderMead } from './optimise.ts';

const wide = { lower: [-10, -10], upper: [10, 10], step: [0.5, 0.5] };

describe('nelderMead', () => {
  it('finds the minimum of a quadratic bowl to the tolerance asked', async () => {
    const result = await nelderMead(
      async (x) => (x[0]! - 1.5) ** 2 + 3 * (x[1]! + 0.5) ** 2,
      [0, 0],
      {
        ...wide,
        maxEvaluations: 400,
        fTolerance: 1e-10,
        xTolerance: 1e-4,
      },
    );
    expect(result.converged).toBe(true);
    expect(result.x[0]).toBeCloseTo(1.5, 3);
    expect(result.x[1]).toBeCloseTo(-0.5, 3);
    expect(result.f).toBeLessThan(1e-8);
  });

  it('follows the curved valley of the Rosenbrock function', async () => {
    const result = await minimise(
      async (x) => (1 - x[0]!) ** 2 + 100 * (x[1]! - x[0]! ** 2) ** 2,
      [-1.2, 1],
      { ...wide, maxEvaluations: 600, fTolerance: 1e-10, xTolerance: 1e-4, restarts: 3 },
    );
    expect(result.x[0]).toBeCloseTo(1, 2);
    expect(result.x[1]).toBeCloseTo(1, 2);
  });

  it('stays inside its bounds; with restarts it ends on the bound nearest an outside minimum', async () => {
    const seen: number[][] = [];
    const f = async (x: readonly number[]): Promise<number> => {
      seen.push([...x]);
      return (x[0]! - 5) ** 2 + x[1]! ** 2;
    };
    const settings = {
      lower: [-1, -1],
      upper: [2, 1],
      step: [0.5, 0.5],
      maxEvaluations: 300,
      fTolerance: 1e-10,
      xTolerance: 1e-4,
    };
    // Clipping can fold the simplex flat against a bound, where one run then stops; the restarts
    // open it again.
    const result = await minimise(f, [0, 0.3], { ...settings, restarts: 4 });
    for (const x of seen) {
      expect(x[0]).toBeGreaterThanOrEqual(-1);
      expect(x[0]).toBeLessThanOrEqual(2);
      expect(Math.abs(x[1]!)).toBeLessThanOrEqual(1);
    }
    expect(result.x[0]).toBeCloseTo(2, 6);
    expect(result.x[1]).toBeCloseTo(0, 2);
    expect(result.f).toBeCloseTo(9, 4);
  });

  it('stops when the evaluations run out and says so', async () => {
    const result = await nelderMead(async (x) => x[0]! ** 2 + x[1]! ** 2, [3, 3], {
      ...wide,
      maxEvaluations: 6,
      fTolerance: 1e-12,
      xTolerance: 1e-9,
    });
    expect(result.converged).toBe(false);
    expect(result.evaluations).toBeLessThanOrEqual(9);
  });

  it('treats a value that is not finite as worse than any other', async () => {
    const result = await nelderMead(async (x) => (x[0]! < 0 ? Number.NaN : (x[0]! - 1) ** 2), [2], {
      lower: [-5],
      upper: [5],
      step: [1.5],
      maxEvaluations: 200,
      fTolerance: 1e-10,
      xTolerance: 1e-5,
    });
    expect(result.x[0]).toBeCloseTo(1, 3);
  });
});

describe('minimise', () => {
  it('restarts out of a simplex that stopped on a kink', async () => {
    // |x| + |y| has a kink along both axes; one run from an awkward start stops short of 0.
    const f = async (x: readonly number[]): Promise<number> =>
      Math.abs(x[0]!) + 10 * Math.abs(x[1]! - 0.3 * x[0]!);
    const once = await nelderMead(f, [4, -3], {
      ...wide,
      maxEvaluations: 60,
      fTolerance: 1e-3,
      xTolerance: 1e-2,
    });
    const again = await minimise(f, [4, -3], {
      ...wide,
      maxEvaluations: 60,
      fTolerance: 1e-3,
      xTolerance: 1e-2,
      restarts: 6,
    });
    expect(again.f).toBeLessThanOrEqual(once.f);
    expect(again.f).toBeLessThan(0.05);
    expect(again.restarts).toBeGreaterThan(0);
  });

  it('is deterministic', async () => {
    const f = async (x: readonly number[]): Promise<number> =>
      Math.cos(3 * x[0]!) + (x[0]! - 0.4) ** 2 + x[1]! ** 4;
    const settings = {
      ...wide,
      maxEvaluations: 200,
      fTolerance: 1e-9,
      xTolerance: 1e-5,
      restarts: 2,
    };
    const a = await minimise(f, [0.2, 0.7], settings);
    const b = await minimise(f, [0.2, 0.7], settings);
    expect(b).toEqual(a);
  });
});
