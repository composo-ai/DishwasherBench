import { describe, expect, it } from 'vitest';
import { soilAppearance } from './appearance.ts';
import {
  coverageThreshold,
  RESIDUE_CLEAN_COLOUR,
  residueColour,
  residueLayersByRegion,
  soilField,
  soilHash,
  soilLayersByRegion,
  srgbToLinear,
} from './soil-layers.ts';

describe('soilLayersByRegion', () => {
  it('puts each soil on the regions the level names, with the stated coverage', () => {
    const layers = soilLayersByRegion([
      { type: 'tomato_sauce', regions: [{ region: 'well', coverage: 0.5 }] },
      {
        type: 'lipstick',
        regions: [
          { region: 'rim', coverage: 0.1 },
          { region: 'well', coverage: 0.05 },
        ],
      },
    ]);
    expect([...layers.keys()].sort()).toEqual(['rim', 'well']);
    const well = layers.get('well') ?? [];
    expect(well.map((l) => l.coverage)).toEqual([0.5, 0.05]);
    expect(well[0]?.colour).toEqual(soilAppearance('tomato_sauce').colour);
    expect(well[1]?.colour).toEqual(soilAppearance('lipstick').colour);
    expect(layers.get('rim')?.[0]?.coverage).toBe(0.1);
  });

  it('leaves a clean item and zero coverage without layers, and clamps coverage', () => {
    expect(soilLayersByRegion([]).size).toBe(0);
    expect(
      soilLayersByRegion([{ type: 'coffee', regions: [{ region: 'interior', coverage: 0 }] }]).size,
    ).toBe(0);
    const over = soilLayersByRegion([
      { type: 'coffee', regions: [{ region: 'interior', coverage: 1.7 }] },
    ]);
    expect(over.get('interior')?.[0]?.coverage).toBe(1);
  });

  it('keeps the two soils that cover most when three share a region, in level order', () => {
    const layers = soilLayersByRegion([
      { type: 'coffee', regions: [{ region: 'interior', coverage: 0.2 }] },
      { type: 'milk_film', regions: [{ region: 'interior', coverage: 0.1 }] },
      { type: 'lipstick', regions: [{ region: 'interior', coverage: 0.6 }] },
    ]);
    const interior = layers.get('interior') ?? [];
    expect(interior.map((l) => l.coverage)).toEqual([0.2, 0.6]);
  });
});

describe('coverageThreshold', () => {
  it('paints nothing at coverage 0 and everything at coverage 1', () => {
    // The field lies in [0, 1].
    expect(coverageThreshold(0)).toBeLessThan(0);
    expect(coverageThreshold(1)).toBeGreaterThan(1);
    expect(coverageThreshold(Number.NaN)).toBeLessThan(0);
  });

  it('rises with coverage', () => {
    let previous = -Infinity;
    for (let c = 0.02; c < 1; c += 0.02) {
      const threshold = coverageThreshold(c);
      expect(threshold).toBeGreaterThanOrEqual(previous);
      previous = threshold;
    }
  });

  it('covers the stated fraction of a surface: within 0.03 on points it was not built from', () => {
    // 20,000 points on a plane cutting the lattice obliquely, unrelated to the sample lattice
    // of the quantile table. The pattern is a random field, so the covered share of a finite
    // patch scatters; 0.03 is about four standard errors for patches of this many cells.
    const values: number[] = [];
    for (let i = 0; i < 20000; i++) {
      const u = (i % 200) * 0.173 + 41.3;
      const v = Math.floor(i / 200) * 0.191 + 17.9;
      values.push(soilField(u, v, 0.37 * u - 0.21 * v + 3.3));
    }
    for (const coverage of [0.05, 0.2, 0.4, 0.5, 0.7, 0.9]) {
      const threshold = coverageThreshold(coverage);
      const covered = values.filter((x) => x < threshold).length / values.length;
      expect(Math.abs(covered - coverage), `coverage ${coverage}`).toBeLessThan(0.03);
    }
  });

  it('the hash and the field stay in [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const h = soilHash(i * 1.37 - 200, i * 0.91 + 3, 77 - i * 2.11);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      const f = soilField(i * 0.31, -i * 0.47, i * 0.13);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('residue colours (the mapping from a report to colours)', () => {
  it('is green for no residue and runs from yellow through orange to red', () => {
    expect(residueColour(0)).toEqual(RESIDUE_CLEAN_COLOUR);
    const trace = residueColour(0.01);
    const half = residueColour(0.5);
    const full = residueColour(1);
    // Yellow: red and green high, blue low. Red: green low.
    expect(trace[0]).toBeGreaterThan(0.9);
    expect(trace[1]).toBeGreaterThan(0.75);
    expect(full).toEqual([0.84, 0.1, 0.12]);
    // Green falls steadily as the residue grows.
    expect(trace[1]).toBeGreaterThan(half[1]);
    expect(half[1]).toBeGreaterThan(full[1]);
  });

  it('is continuous at the knee of the ramp and clamps what is out of range', () => {
    const below = residueColour(0.35 - 1e-9);
    const above = residueColour(0.35 + 1e-9);
    for (let i = 0; i < 3; i++) expect(below[i]).toBeCloseTo(above[i] as number, 6);
    expect(residueColour(7)).toEqual(residueColour(1));
    expect(residueColour(-1)).toEqual(RESIDUE_CLEAN_COLOUR);
    expect(residueColour(Number.NaN)).toEqual(RESIDUE_CLEAN_COLOUR);
  });

  it('paints a soiled region with the marker colour all over and the remnant on its share', () => {
    const soils = [{ type: 'tomato_sauce', regions: [{ region: 'well', coverage: 0.5 }] }];
    const layers = residueLayersByRegion(soils, [
      { region: 'well', fraction: 0.25 },
      { region: 'rim', fraction: 0 },
      { region: 'underside', fraction: 0.1 },
    ]);
    // A region without residue gets no layer: it is drawn clean.
    expect(layers.has('rim')).toBe(false);
    const well = layers.get('well') ?? [];
    expect(well).toHaveLength(2);
    expect(well[0]?.colour).toEqual(residueColour(0.25));
    expect(well[0]?.coverage).toBe(1);
    expect(well[1]?.colour).toEqual(soilAppearance('tomato_sauce').colour);
    expect(well[1]?.coverage).toBe(0.25);
    // Residue on a region the item was not soiled on (carried over) is drawn in the fallback.
    const underside = layers.get('underside') ?? [];
    expect(underside[1]?.coverage).toBe(0.1);
    expect(underside[1]?.colour).not.toEqual(soilAppearance('tomato_sauce').colour);
    // The marker is stronger where more is left.
    expect((well[0]?.opacity ?? 0) > (underside[0]?.opacity ?? 1)).toBe(true);
  });
});

describe('srgbToLinear', () => {
  it('matches the sRGB transfer function at its fixed points and at mid grey', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 12);
    // sRGB 0.5 is linear 0.2140 (IEC 61966-2-1).
    expect(srgbToLinear(0.5)).toBeCloseTo(0.21404, 4);
  });
});
