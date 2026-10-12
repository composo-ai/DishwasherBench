// The virtual inspector against the definition of "clean" in docs/research/standards.md
// sections 6.1 and 10.2, on hand-built items whose soiled area and specks are known.
import { createParamSet, createRegistry } from '@spotless/sim-params';
import { describe, expect, it } from 'vitest';
import {
  inspectBand,
  inspectionRules,
  inspectItem,
  INSPECTOR_PARAM_DEFS,
  scoreByArea,
  scoreBySpecks,
  type InspectionItem,
  type InspectionRules,
} from './index.ts';

const params = createParamSet(createRegistry({ contributions: [INSPECTOR_PARAM_DEFS] }));
// Two soil classes: a translucent film visible above 0.2 mg/cm2 (2e-3 kg/m2), and a stain
// visible while more than 10 % of it remains.
const rules: InspectionRules = inspectionRules(params, {
  mass: [2e-3, 3.5e-4],
  fraction: [0, 0.1],
});

/**
 * A strip of `n` square elements of 1 mm2 in a row, each touching the next, with the given
 * residue of class 0 (mg/cm2); the initial loading is 5 mg/cm2 everywhere.
 */
function strip(residue: readonly number[], pooledWater_mL = 0): InspectionItem {
  const n = residue.length;
  const offsets = new Uint32Array(n + 1);
  const indices: number[] = [];
  for (let e = 0; e < n; e++) {
    if (e > 0) indices.push(e - 1);
    if (e < n - 1) indices.push(e + 1);
    offsets[e + 1] = indices.length;
  }
  const initial = new Float32Array(2 * n);
  const residual = new Float32Array(2 * n);
  for (let e = 0; e < n; e++) {
    initial[2 * e] = 5;
    residual[2 * e] = residue[e] ?? 0;
  }
  return {
    itemId: 'strip',
    regionIds: ['left', 'right'],
    classCount: 2,
    elements: {
      count: n,
      region: Uint16Array.from({ length: n }, (_unused, e) => (e < n / 2 ? 0 : 1)),
      areaMm2: new Float32Array(n).fill(1),
      initial_mg_cm2: initial,
      residual_mg_cm2: residual,
      neighbours: { offsets, indices: Uint32Array.from(indices) },
    },
    pooledWater_mL,
  };
}

describe('the verdict at the two ends of the band of visibility (standards 10.3)', () => {
  // The translucent film of class 0 is seen from 0.1 to 0.3 mg/cm2; it is judged at 0.2.
  const banded: InspectionRules = inspectionRules(params, {
    mass: [2e-3, 3.5e-4],
    fraction: [0, 0.1],
    band: { low: [1e-3, 2e-4], high: [3e-3, 5e-4] },
  });

  it('is decided where the residue is below the band, or above it over more than the allowance', () => {
    const bare = inspectBand(strip(new Array<number>(20).fill(0.05)), banded);
    expect(bare).toEqual({
      strict: { clean: true, score: 5 },
      lenient: { clean: true, score: 5 },
      decided: true,
    });
    const soiled = inspectBand(strip(new Array<number>(20).fill(1)), banded);
    expect(soiled.strict.clean).toBe(false);
    expect(soiled.lenient.clean).toBe(false);
    expect(soiled.decided).toBe(true);
  });

  it('is not decided where the residue lies inside the band: seen by a sharp eye, not by a lenient one', () => {
    // 0.15 mg/cm2 on 20 mm2: above the low end (0.1), below the nominal 0.2 and the high end.
    const item = strip(new Array<number>(20).fill(0.15));
    expect(inspectItem(item, banded).clean).toBe(true);
    const band = inspectBand(item, banded);
    expect(band.strict.clean).toBe(false);
    expect(band.lenient.clean).toBe(true);
    expect(band.decided).toBe(false);
    // 0.25: seen at the nominal threshold, not at the high end.
    const other = strip(new Array<number>(20).fill(0.25));
    expect(inspectItem(other, banded).clean).toBe(false);
    expect(inspectBand(other, banded)).toMatchObject({
      strict: { clean: false },
      lenient: { clean: true },
      decided: false,
    });
  });

  it('is the nominal verdict at both ends without a band, and water decides at every end', () => {
    const item = strip(new Array<number>(20).fill(0.15));
    const nominal = inspectItem(item, rules);
    expect(inspectBand(item, rules)).toEqual({
      strict: { clean: nominal.clean, score: nominal.score },
      lenient: { clean: nominal.clean, score: nominal.score },
      decided: true,
    });
    // A vessel that holds water is not clean however little soil is seen.
    const wet = inspectBand(strip(new Array<number>(20).fill(0.05), 5), banded);
    expect(wet.strict.clean).toBe(false);
    expect(wet.lenient.clean).toBe(false);
    expect(wet.decided).toBe(true);
  });
});

describe('IEC cleaning score (standards 6.1)', () => {
  it('scores by specks: 0, up to 4, up to 10, more', () => {
    expect([0, 1, 4, 5, 10, 11, 500].map((n) => scoreBySpecks(n, rules.speckBands))).toEqual([
      5, 4, 4, 3, 3, 2, 2,
    ]);
  });

  it('scores by area: 0, up to 4, 20, 50, 200 mm2, more', () => {
    expect(
      [0, 0.5, 4, 4.1, 20, 21, 50, 51, 200, 201].map((a) => scoreByArea(a, rules.areaBandsMm2)),
    ).toEqual([5, 4, 4, 3, 3, 2, 2, 1, 1, 0]);
  });
});

describe('inspectItem', () => {
  it('finds a clean item clean, with score 5', () => {
    const got = inspectItem(strip(new Array<number>(20).fill(0)), rules);
    expect(got.clean).toBe(true);
    expect(got.score).toBe(5);
    expect(got.visibleAreaMm2).toBe(0);
    expect(got.specks).toBe(0);
    // 20 elements of 1 mm2 at 5 mg/cm2: 1 mg.
    expect(got.initialMass_mg).toBeCloseTo(1, 6);
    expect(got.residualMass_mg).toBe(0);
    expect(got.initialVisibleAreaMm2).toBe(20);
  });

  it('does not see residue below the visibility threshold', () => {
    const got = inspectItem(strip(new Array<number>(20).fill(0.19)), rules);
    expect(got.visibleAreaMm2).toBe(0);
    expect(got.clean).toBe(true);
    expect(got.residualMass_mg).toBeCloseTo((0.19 * 20) / 100, 6);
    expect(inspectItem(strip(new Array<number>(20).fill(0.2)), rules).visibleAreaMm2).toBe(20);
  });

  it('counts separate small patches as specks and sums their area', () => {
    // Elements 2 and 3 form one patch of 2 mm2 (equivalent diameter 1.6 mm: a speck); element
    // 8 is another; elements 14 to 17 form a patch of 4 mm2 (2.26 mm: too large for a speck).
    const residue = new Array<number>(20).fill(0);
    for (const e of [2, 3, 8, 14, 15, 16, 17]) residue[e] = 1;
    const got = inspectItem(strip(residue), rules);
    expect(got.specks).toBe(2);
    expect(got.visibleAreaMm2).toBe(7);
    expect([...got.visible]).toEqual(residue);
    // 7 mm2 is more than 4: score 3 by area, and not clean.
    expect(got.score).toBe(3);
    expect(got.clean).toBe(false);
    // Per region: the left half holds the two specks, the right half the large patch.
    expect(got.regions.map((r) => [r.regionId, r.specks, r.visibleAreaMm2, r.areaMm2])).toEqual([
      ['left', 2, 3, 10],
      ['right', 0, 4, 10],
    ]);
  });

  it('draws the line at 4 specks, 4 mm2 and 1 mL of water (standards 10.2, E8)', () => {
    const specks = (count: number): number[] => {
      const residue = new Array<number>(40).fill(0);
      for (let i = 0; i < count; i++) residue[3 * i] = 1;
      return residue;
    };
    expect(inspectItem(strip(specks(4)), rules).clean).toBe(true);
    expect(inspectItem(strip(specks(4)), rules).score).toBe(4);
    // Five specks of 1 mm2: too many specks and too much area.
    const five = inspectItem(strip(specks(5)), rules);
    expect(five.specks).toBe(5);
    expect(five.clean).toBe(false);
    // Five specks alone fail an item whose area would pass.
    const lenient: InspectionRules = { ...rules, maxAreaMm2: 10 };
    expect(inspectItem(strip(specks(5)), lenient).clean).toBe(false);
    expect(inspectItem(strip(specks(4), 1), rules).clean).toBe(true);
    expect(inspectItem(strip(specks(4), 1.1), rules).clean).toBe(false);
    expect(inspectItem(strip(specks(0), 300), rules).score).toBe(5);
    expect(inspectItem(strip(specks(0), 300), rules).clean).toBe(false);
  });

  it('adds the classes of one element: sum of m / m_vis reaches 1', () => {
    const item = strip(new Array<number>(4).fill(0.12));
    // 0.12 / 0.2 of the film plus 0.02 / 0.035 of a second, strongly coloured soil: 1.17.
    const residual = Float32Array.from(item.elements.residual_mg_cm2);
    const initial = Float32Array.from(item.elements.initial_mg_cm2);
    residual[1] = 0.02;
    initial[1] = 5;
    const both: InspectionItem = {
      ...item,
      elements: { ...item.elements, residual_mg_cm2: residual, initial_mg_cm2: initial },
    };
    expect(inspectItem(item, rules).visibleAreaMm2).toBe(0);
    expect(inspectItem(both, rules).visibleAreaMm2).toBe(1);
  });

  it('judges a stain by the share of it that remains', () => {
    // A stain of 0.03 mg/cm2 is below the mass threshold of 0.035 but visible until less than
    // a tenth of it is left (soils R7).
    const stained = (left: number): InspectionItem => {
      const item = strip([0, 0]);
      const initial = new Float32Array(4);
      const residual = new Float32Array(4);
      initial[1] = 0.03;
      residual[1] = 0.03 * left;
      return {
        ...item,
        elements: { ...item.elements, initial_mg_cm2: initial, residual_mg_cm2: residual },
      };
    };
    expect(inspectItem(stained(1), rules).visibleAreaMm2).toBe(1);
    expect(inspectItem(stained(0.11), rules).visibleAreaMm2).toBe(1);
    expect(inspectItem(stained(0.09), rules).visibleAreaMm2).toBe(0);
  });

  it('refuses an item with a soil class it has no threshold for', () => {
    expect(() => inspectItem({ ...strip([0]), classCount: 3 }, rules)).toThrow(RangeError);
  });
});

describe('what standing water left where it stood (standards 10.2; chemistry 5.3, R2)', () => {
  // Patches of 10 mm2 under standing water, each with the given residue of class 0 (mg/cm2)
  // and, for the strongly coloured class 1, the second number.
  const withPatches = (
    patches: readonly (readonly [number, number])[],
    region: readonly number[] = patches.map(() => 0),
  ): InspectionItem => ({
    ...strip(new Array<number>(20).fill(0), 300),
    standing: {
      count: patches.length,
      region: Uint16Array.from(region),
      areaMm2: new Float32Array(patches.length).fill(10),
      residue_mg_cm2: Float32Array.from(patches.flat()),
    },
  });

  it('is nothing on an item that holds no soiled water', () => {
    const got = inspectItem(strip(new Array<number>(20).fill(0), 300), rules);
    expect(got.standingVisibleAreaMm2).toBe(0);
    expect(got.standingResidue_mg).toBe(0);
    expect(got.visibleAreaMm2).toBe(0);
  });

  it('counts a patch by its area when what the water left on it is visible, never as a speck', () => {
    // 0.25 mg/cm2 of the film is above its 0.2; 0.1 is not, and 0.1 with 0.02 of the
    // coloured soil is (0.5 + 0.57).
    const got = inspectItem(
      withPatches(
        [
          [0.25, 0],
          [0.1, 0],
          [0.1, 0.02],
        ],
        [0, 1, 0xffff],
      ),
      rules,
    );
    expect(got.standingVisibleAreaMm2).toBe(20);
    expect(got.visibleAreaMm2).toBe(20);
    expect(got.specks).toBe(0);
    // 20 mm2 is within the band of score 3; it is more than the 4 mm2 of a clean item.
    expect(got.score).toBe(3);
    // mg/cm2 x mm2 = mg / 100: (0.25 + 0.1 + 0.12) x 10 / 100.
    expect(got.standingResidue_mg).toBeCloseTo(0.047, 6);
    expect(got.residualMass_mg).toBeCloseTo(0.047, 6);
    // The area is that of the region each patch lies on; a patch of no region is counted too.
    expect(got.regions.map((r) => [r.regionId, r.visibleAreaMm2])).toEqual([
      ['left', 10],
      ['right', 0],
      ['', 10],
    ]);
  });

  it('decides by soil alone: the same water with nothing in it leaves the verdict to the water rule', () => {
    const soil: InspectionRules = { ...rules, maxWaterMl: Infinity };
    expect(inspectItem(withPatches([[0.01, 0]]), soil).clean).toBe(true);
    expect(inspectItem(withPatches([[0.25, 0]]), soil).clean).toBe(false);
  });

  it('is judged at both ends of the band of visibility like any residue', () => {
    const banded: InspectionRules = {
      ...rules,
      maxWaterMl: Infinity,
      visibleBand_mg_cm2: { low: [0.1, 0.02], high: [0.4, 0.07] },
    };
    // 0.25 lies inside the band of the film: seen by a sharp eye, not by a lenient one.
    const inside = inspectBand(withPatches([[0.25, 0]]), banded);
    expect([inside.strict.clean, inside.lenient.clean, inside.decided]).toEqual([
      false,
      true,
      false,
    ]);
    const above = inspectBand(withPatches([[0.5, 0]]), banded);
    expect([above.strict.clean, above.lenient.clean, above.decided]).toEqual([false, false, true]);
  });
});

describe('the registered rule', () => {
  it('is that of the standards dossier and can be changed', () => {
    expect([rules.maxSpecks, rules.maxAreaMm2, rules.maxWaterMl, rules.dotDiameterMm]).toEqual([
      4, 4, 1, 2,
    ]);
    // 2e-3 kg/m2 is 0.2 mg/cm2.
    expect(rules.visibleMass_mg_cm2[0]).toBeCloseTo(0.2, 12);
    const strict = inspectionRules(
      createParamSet(createRegistry({ contributions: [INSPECTOR_PARAM_DEFS] }), {
        'inspect.maxSpecks': 0,
        'inspect.maxWaterMl': 0,
      }),
      { mass: [2e-3, 3.5e-4], fraction: [0, 0.1] },
    );
    const residue = new Array<number>(10).fill(0);
    residue[4] = 1;
    expect(inspectItem(strip(residue), rules).clean).toBe(true);
    expect(inspectItem(strip(residue), strict).clean).toBe(false);
  });
});

describe('sub-element coverage (standards 10.2, phi_e)', () => {
  // A soil model that says an element is visibly soiled over the share residual / initial of
  // its area while its residue is above the threshold at all (a peeled layer).
  const covered: InspectionRules = inspectionRules(params, {
    mass: [2e-3, 3.5e-4],
    fraction: [0, 0.1],
    share: (_k, initial, residual, threshold) =>
      residual >= threshold / 10 && initial > 0 ? Math.min(1, residual / initial) : 0,
  });

  it('carries the rule of the soil model and the size of the smallest speck', () => {
    expect(rules.visibleShare).toBeUndefined();
    expect(covered.visibleShare).toBeDefined();
    expect(covered.filmClass).toBeUndefined();
    // A speck of 0.3 mm: 0.0707 mm2.
    expect(covered.speckMinAreaMm2).toBeCloseTo((Math.PI * 0.09) / 4, 12);
  });

  it('counts the visibly soiled share of an element, not the whole of it', () => {
    // Elements of 1 mm2 loaded with 5 mg/cm2: 2.5 left is half an element, 0.5 a tenth.
    const residue = new Array<number>(20).fill(0);
    residue[2] = 2.5;
    residue[9] = 0.5;
    const got = inspectItem(strip(residue), covered);
    expect(got.visibleAreaMm2).toBeCloseTo(0.6, 6);
    expect(got.specks).toBe(2);
    expect(got.score).toBe(4);
    expect(got.clean).toBe(true);
    expect([...got.coverage].map((c) => Math.round(c * 100) / 100)).toEqual(
      residue.map((r) => r / 5),
    );
    // Without the rule both elements count whole: 2 mm2.
    expect(inspectItem(strip(residue), rules).visibleAreaMm2).toBe(2);
  });

  it('does not see what is smaller than a speck of 0.3 mm in a patch the size of a dot', () => {
    // 0.1 of 5 mg/cm2 left is 2 % of every element. A dot of 2 mm (3.14 mm2) about an element
    // of the strip is the element and its two neighbours, 3 mm2: 0.06 mm2 visibly soiled,
    // under the 0.0707 mm2 of the smallest speck. Twenty such elements are not 0.4 mm2 of
    // soil: nothing is seen.
    const faint = inspectItem(strip(new Array<number>(20).fill(0.1)), covered);
    expect(faint.visibleAreaMm2).toBe(0);
    expect(faint.specks).toBe(0);
    expect(faint.score).toBe(5);
    expect([...faint.visible].every((v) => v === 0)).toBe(true);
    expect(faint.residualMass_mg).toBeCloseTo((0.1 * 20) / 100, 6);
    // 0.2 left is 4 %: 0.12 mm2 in the dot (0.08 at the two ends of the strip), seen. The
    // residue of a soil that leaves bare patches, covering 4 % of 20 mm2, is a fragment per
    // dot: 20 / 3.14 = 6 specks, 0.8 mm2.
    const seen = inspectItem(strip(new Array<number>(20).fill(0.2)), covered);
    expect(seen.visibleAreaMm2).toBeCloseTo(0.8, 5);
    expect(seen.specks).toBe(6);
    expect(seen.score).toBe(3);
    expect(seen.clean).toBe(false);
  });

  it('counts a region that is more than half covered by its area, not as specks', () => {
    // Ten joined elements 60 % covered: 6 mm2 in one region, larger than a dot.
    const residue = new Array<number>(20).fill(0);
    for (let e = 4; e < 14; e++) residue[e] = 3;
    const got = inspectItem(strip(residue), covered);
    expect(got.visibleAreaMm2).toBeCloseTo(6, 5);
    expect(got.specks).toBe(0);
    expect(got.score).toBe(3);
    // Per region the shares add up as the whole does.
    expect(got.regions.map((r) => Math.round(r.visibleAreaMm2 * 10) / 10)).toEqual([3.6, 2.4]);
  });

  it('never breaks a thinned film into specks: it is judged by area', () => {
    const filmRules: InspectionRules = inspectionRules(params, {
      mass: [2e-3, 3.5e-4],
      fraction: [0, 0.1],
      share: (_k, initial, residual, threshold) =>
        residual >= threshold / 10 && initial > 0 ? Math.min(1, residual / initial) : 0,
      film: [true, false],
    });
    expect(filmRules.filmClass).toEqual([true, false]);
    const got = inspectItem(strip(new Array<number>(20).fill(0.2)), filmRules);
    expect(got.visibleAreaMm2).toBeCloseTo(0.8, 5);
    expect(got.specks).toBe(0);
    expect(got.score).toBe(4);
    expect(got.clean).toBe(true);
    // A spot of film no larger than a dot is still one speck.
    const spot = new Array<number>(20).fill(0);
    spot[7] = 2.5;
    expect(inspectItem(strip(spot), filmRules).specks).toBe(1);
  });

  it('sees the same residue the same on elements of 1 mm2 and of 4 mm2 (standards 10.1, requirement 3)', () => {
    // A square of 20 mm by 20 mm as 400 elements of 1 mm2 and as 100 of 4 mm2, each touching
    // the eight around it; `phi(x, y)` is the visibly soiled share at a point (mm), constant
    // on every 2 mm square, so that both grids carry exactly the same field.
    const grid = (side: number, phi: (x: number, y: number) => number): InspectionItem => {
      const m = 20 / side;
      const n = m * m;
      const offsets = new Uint32Array(n + 1);
      const indices: number[] = [];
      const initial = new Float32Array(2 * n);
      const residual = new Float32Array(2 * n);
      for (let j = 0; j < m; j++) {
        for (let i = 0; i < m; i++) {
          const e = j * m + i;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const oi = i + di;
              const oj = j + dj;
              if ((di !== 0 || dj !== 0) && oi >= 0 && oi < m && oj >= 0 && oj < m) {
                indices.push(oj * m + oi);
              }
            }
          }
          offsets[e + 1] = indices.length;
          initial[2 * e] = 5;
          residual[2 * e] = 5 * phi((i + 0.5) * side, (j + 0.5) * side);
        }
      }
      return {
        itemId: 'square',
        regionIds: ['face'],
        classCount: 2,
        elements: {
          count: n,
          region: new Uint16Array(n),
          areaMm2: new Float32Array(n).fill(side * side),
          initial_mg_cm2: initial,
          residual_mg_cm2: residual,
          neighbours: { offsets, indices: Uint32Array.from(indices) },
        },
        pooledWater_mL: 0,
      };
    };
    const fields: [string, (x: number, y: number) => number, number, number][] = [
      // name, field, visibly soiled area (mm2), specks
      ['an even 1 %: under a speck per dot, unseen', () => 0.01, 0, 0],
      ['an even 3 %: a fragment per dot', () => 0.03, 12, 127],
      ['an even 60 %: a patch', () => 0.6, 240, 0],
      [
        'one 2 mm square 20 % covered',
        (x, y) => (x > 8 && x < 10 && y > 8 && y < 10 ? 0.2 : 0),
        0.8,
        1,
      ],
      [
        'one 2 mm square wholly covered',
        (x, y) => (x > 8 && x < 10 && y > 8 && y < 10 ? 1 : 0),
        4,
        0,
      ],
      [
        'three 2 mm squares 10 % covered, apart',
        (x, y) => (y > 8 && y < 10 && [1, 4, 7].includes(Math.floor(x / 2)) ? 0.1 : 0),
        1.2,
        3,
      ],
    ];
    for (const [name, phi, areaMm2, specks] of fields) {
      const fine = inspectItem(grid(1, phi), covered);
      const coarse = inspectItem(grid(2, phi), covered);
      expect(fine.visibleAreaMm2, name).toBeCloseTo(areaMm2, 4);
      expect(coarse.visibleAreaMm2, name).toBeCloseTo(areaMm2, 4);
      expect(fine.specks, name).toBe(specks);
      expect(coarse.specks, name).toBe(specks);
      expect(coarse.score, name).toBe(fine.score);
      expect(coarse.clean, name).toBe(fine.clean);
    }
  });

  it('never counts more than the area of an element, whatever its classes add up to', () => {
    const item = strip([5, 5]);
    const initial = Float32Array.from(item.elements.initial_mg_cm2);
    const residual = Float32Array.from(item.elements.residual_mg_cm2);
    initial[1] = 0.05;
    residual[1] = 0.05;
    const both: InspectionItem = {
      ...item,
      elements: { ...item.elements, initial_mg_cm2: initial, residual_mg_cm2: residual },
    };
    const got = inspectItem(both, covered);
    expect(got.visibleAreaMm2).toBe(2);
    expect(got.initialVisibleAreaMm2).toBe(2);
    expect(got.coverage[0]).toBe(1);
  });

  it('hands the stain threshold, the lower of the mass and the share of the initial loading, to the rule', () => {
    const asked: number[] = [];
    const spy: InspectionRules = {
      ...covered,
      visibleShare: (_k, _initial, _residual, threshold) => {
        asked.push(threshold);
        return 0;
      },
    };
    const item = strip([0]);
    const initial = new Float32Array(2);
    const residual = new Float32Array(2);
    initial[1] = 0.03;
    residual[1] = 0.01;
    inspectItem(
      {
        ...item,
        elements: { ...item.elements, initial_mg_cm2: initial, residual_mg_cm2: residual },
      },
      spy,
    );
    // Asked for the state at the start and for the state now: 10 % of 0.03 mg/cm2 both times.
    expect(asked).toHaveLength(2);
    for (const threshold of asked) expect(threshold).toBeCloseTo(0.003, 9);
  });
});

describe('the share of an element as a function of the threshold (for a caller that asks for many)', () => {
  it('is handed through with the share itself, and absent without it', () => {
    const share = (_k: number, initial: number, residual: number, threshold: number): number =>
      residual > 0 ? Math.max(0, Math.min(1, residual / initial - threshold)) : 0;
    const curved = inspectionRules(params, {
      mass: [0.01, 0.01],
      fraction: [0, 0],
      share,
      shareOf: (k, initial, residual) => (threshold) => share(k, initial, residual, threshold),
      film: [false, true],
    });
    expect(curved.visibleShare).toBe(share);
    // The same numbers through either route, at any threshold (mg/cm2).
    for (const threshold of [0.01, 0.1, 0.5]) {
      expect(curved.visibleShareOf?.(0, 2, 1)(threshold)).toBe(
        curved.visibleShare?.(0, 2, 1, threshold),
      );
    }
    expect(curved.filmClass).toEqual([false, true]);
    expect(rules.visibleShareOf).toBeUndefined();
  });
});
