// CPU-side tests of the expression facility, the uniform blocks, the closure tables and the
// shared closure functions, against hand-written formulas and the numbers the dossiers and the
// contract quote. The WGSL twins are compared with these on the GPU in gpu-parity.test.ts.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildSoilClassLayout,
  buildUniformLayout,
  ClosureTableError,
  compileExprFn,
  createClosureTable,
  createParamSet,
  createRegistry,
  emitExprWgsl,
  evalClosureTable,
  expr,
  ExprError,
  exprParamKeys,
  lintLiterals,
  packClosureTables,
  packSoilClassTable,
  packUniformBlock,
  type AnyParamDef,
  SHARED_CLOSURE_FNS,
  SHARED_PARAM_DEFS,
  tabulateClosure,
  TIER_FAST,
  TIER_OFFICIAL,
  UniformBlockError,
  WETTING_ONSET_MASS,
} from './index.ts';

const EXTRA: AnyParamDef[] = [
  {
    key: 'jets.cR',
    unit: '1',
    default: 0.289,
    min: 0.25,
    max: 0.32,
    tag: 'VERIFIED',
    source: 'M5',
    group: 'hydro',
  },
  {
    kind: 'vector',
    key: 'film.sigma',
    unit: 'N/m',
    default: [0.06, 0.04, 0.045],
    min: 0.03,
    max: 0.065,
    components: ['W', 'D', 'R'],
    tag: 'ESTIMATED',
    source: 'M7.9',
    group: 'hydro',
  },
  {
    kind: 'enum',
    key: 'soil.erosionLaw',
    unit: '1',
    default: 'mass',
    options: ['mass', 'thickness'],
    tag: 'SYN',
    source: 'D12',
    group: 'soil',
  },
  {
    key: 'soil.lag',
    unit: 's',
    default: 60,
    min: 0,
    max: 600,
    tag: 'ESTIMATED',
    source: 't',
    group: 'soil',
  },
  {
    key: 'soil.Ea',
    unit: 'J/mol',
    default: 5e4,
    min: 1e4,
    max: 1e5,
    tag: 'ESTIMATED',
    source: 't',
    group: 'soil',
  },
  {
    key: 'soil.egg_yolk_dried.lag',
    unit: 's',
    default: 540,
    min: 0,
    max: 600,
    tag: 'ESTIMATED',
    source: 't',
    group: 'soil',
  },
];
const registry = createRegistry({
  contributions: [SHARED_PARAM_DEFS, EXTRA],
  soilClasses: ['egg_yolk_dried', 'rice_starch'],
});
const params = createParamSet(registry);
const deg = (d: number): number => (d * Math.PI) / 180;

describe('expression trees, f64 evaluator', () => {
  it('evaluates operations, locals, parameters, vector components and calls', () => {
    const inner = expr.fn({
      name: 'inner',
      doc: 'x^2 + cR',
      inputs: ['x'],
      result: expr.add(expr.mul(expr.input('x'), expr.input('x')), expr.param('jets.cR')),
    });
    const outer = expr.fn({
      name: 'outer',
      doc: 'test',
      inputs: ['a', 'b'],
      locals: [
        ['s', expr.sqrt(expr.add(expr.input('a'), expr.input('b')))],
        ['t', expr.call(inner, expr.call(inner, expr.local('s')))],
      ],
      result: expr.select(
        'lt',
        expr.input('a'),
        expr.input('b'),
        expr.div(expr.local('t'), expr.param('film.sigma', 1)),
        expr.neg(expr.pow(expr.local('s'), expr.div(1, 3))),
      ),
    });
    const f = compileExprFn(outer, params);
    const inner64 = (x: number): number => x * x + 0.289;
    expect(f(1, 3)).toBeCloseTo(inner64(inner64(2)) / 0.04, 12);
    expect(f(5, 3)).toBeCloseTo(-Math.cbrt(Math.sqrt(8)), 12);
    expect(() => f(1)).toThrow(RangeError);
    expect(exprParamKeys([outer])).toEqual(['film.sigma', 'jets.cR']);
  });

  it('follows the parameter set it is bound to, including enumerations', () => {
    const f = expr.fn({
      name: 'law',
      doc: 'test',
      inputs: ['x'],
      result: expr.enumIs(
        'soil.erosionLaw',
        'thickness',
        expr.mul(2, expr.input('x')),
        expr.input('x'),
      ),
    });
    expect(compileExprFn(f, params)(7)).toBe(7);
    expect(compileExprFn(f, params.with({ 'soil.erosionLaw': 'thickness' }))(7)).toBe(14);
    const bad = expr.fn({
      name: 'bad',
      doc: 't',
      inputs: [],
      result: expr.enumIs('soil.erosionLaw', 'volume', 1, 0),
    });
    expect(() => compileExprFn(bad, params)).toThrow(ExprError);
  });

  it('refuses physical constants as literals and malformed definitions', () => {
    // Section 0: a constant enters only as a registry parameter.
    expect(() => expr.mul(9.81, expr.input('h'))).toThrow(/register it as a parameter/);
    expect(() => expr.lit(0.289)).toThrow(ExprError);
    expect(() => expr.fn({ name: 'f', doc: '', inputs: ['x'], result: expr.input('y') })).toThrow(
      /unknown input "y"/,
    );
    expect(() =>
      expr.fn({
        name: 'f',
        doc: '',
        inputs: ['x'],
        locals: [
          ['a', expr.local('b')],
          ['b', 1],
        ],
        result: 1,
      }),
    ).toThrow(/before it is defined/);
    expect(() => expr.fn({ name: 'f', doc: '', inputs: ['x', 'x'], result: 1 })).toThrow(
      /defined twice/,
    );
    expect(() => expr.fn({ name: '2f', doc: '', inputs: [], result: 1 })).toThrow(
      /not an identifier/,
    );
    const one = expr.fn({ name: 'one', doc: '', inputs: ['x'], result: expr.input('x') });
    expect(() => expr.fn({ name: 'f', doc: '', inputs: [], result: expr.call(one, 1, 2) })).toThrow(
      /takes 1 arguments/,
    );
    expect(() =>
      compileExprFn(
        expr.fn({ name: 'f', doc: '', inputs: [], result: expr.param('film.sigma') }),
        params,
      ),
    ).toThrow(ExprError);
  });

  it('emits WGSL that passes the literal lint and reads parameters from the uniform block', () => {
    const layout = buildUniformLayout(registry, 'SharedParams', exprParamKeys(SHARED_CLOSURE_FNS));
    const wgsl = emitExprWgsl(SHARED_CLOSURE_FNS, layout.target('params'));
    expect(lintLiterals(wgsl, 'wgsl')).toEqual([]);
    expect(lintLiterals(layout.wgsl, 'wgsl')).toEqual([]);
    expect(wgsl).toContain(
      'fn wetting_onset_mass(mu: f32, sigma: f32, rho: f32, thetaA: f32, thetaR: f32, sinBeta: f32) -> f32',
    );
    expect(wgsl).toContain('params.film_kappaW');
    // Callees are declared before their callers and once each.
    const order = [...wgsl.matchAll(/^fn (\w+)/gm)].map((m) => m[1]);
    expect(new Set(order).size).toBe(order.length);
    expect(order.indexOf('wetting_delta_star')).toBeLessThan(order.indexOf('wetting_delta_wet'));
    expect(order.indexOf('capillary_length')).toBeLessThan(order.indexOf('wetting_b_max'));
    expect(emitExprWgsl([WETTING_ONSET_MASS], layout.target('params'))).toContain(
      'fn capillary_length',
    );
  });
});

describe('uniform blocks', () => {
  it('lays keys out as f32 members in key order, padded to 16 bytes', () => {
    const layout = buildUniformLayout(registry, 'KParams', [
      'soil.erosionLaw',
      'jets.cR',
      'film.sigma',
      'jets.cR',
    ]);
    expect(layout.wgsl).toBe(
      'struct KParams {\n  film_sigma_W: f32,\n  film_sigma_D: f32,\n  film_sigma_R: f32,\n  jets_cR: f32,\n' +
        '  soil_erosionLaw: f32,\n  pad_0_: f32,\n  pad_1_: f32,\n  pad_2_: f32,\n}\n',
    );
    expect(layout.byteLength).toBe(32);
    expect(layout.fields.map((f) => f.offset)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(layout.fieldName('film.sigma', 2)).toBe('film_sigma_R');
    expect(() => layout.fieldName('film.kappaW')).toThrow(UniformBlockError);
    expect(() => buildUniformLayout(registry, 'K', ['film.nope'])).toThrow(UniformBlockError);

    const set = params.with({ 'soil.erosionLaw': 'thickness', 'jets.cR': 0.3 });
    const block = packUniformBlock(layout, set);
    expect([...block.data]).toEqual([0.06, 0.04, 0.045, 0.3, 1, 0, 0, 0].map(Math.fround));
  });

  it('hashes the layout and the contents, independent of key order', () => {
    const a = buildUniformLayout(registry, 'KParams', ['jets.cR', 'film.kappaW']);
    const b = buildUniformLayout(registry, 'KParams', ['film.kappaW', 'jets.cR']);
    expect(a.hash).toBe(b.hash);
    expect(buildUniformLayout(registry, 'KParams', ['jets.cR']).hash).not.toBe(a.hash);
    const base = packUniformBlock(a, params);
    expect(packUniformBlock(b, params).hash).toBe(base.hash);
    expect(packUniformBlock(a, params.with({ 'jets.cR': 0.3 })).hash).not.toBe(base.hash);
    // A soil parameter outside the block does not change the block.
    expect(packUniformBlock(a, params.with({ 'soil.lag': 61 })).hash).toBe(base.hash);
  });

  it('packs per-class soil tables row by row with the override rule', () => {
    const layout = buildSoilClassLayout(registry, 'SoilClassParams', ['lag', 'Ea']);
    expect(layout.wgsl).toBe('struct SoilClassParams {\n  Ea: f32,\n  lag: f32,\n}\n');
    const set = params.with({ 'soil.rice_starch.Ea': 7e4 });
    const table = packSoilClassTable(layout, set, ['rice_starch', 'egg_yolk_dried']);
    expect([...table.data]).toEqual([7e4, 60, 5e4, 540]);
    // The class order is the class code, so it is part of the hash.
    expect(packSoilClassTable(layout, set, ['egg_yolk_dried', 'rice_starch']).hash).not.toBe(
      table.hash,
    );
    expect(() => buildSoilClassLayout(registry, 'S', ['erosionLaw'])).toThrow(UniformBlockError);
  });
});

describe('closure tables, f64', () => {
  const axes = [
    { name: 'phi', unit: 'rad', values: Float64Array.of(0, 0.2, 0.5, 1.5) },
    { name: 'We', unit: '1', values: Float64Array.of(10, 100, 1000) },
  ];
  const bilinear = (x: number, y: number): number => 3 - 2 * x + 0.01 * y + 0.5 * x * y;
  const table = tabulateClosure(
    { id: 'wire.split', axes, unit: '1', provenance: 'test' },
    bilinear,
  );

  it('reproduces a multilinear function exactly inside the grid', () => {
    // Multilinear interpolation is exact for a function that is linear in each coordinate.
    for (const [x, y] of [
      [0, 10],
      [0.1, 55],
      [0.37, 640],
      [1.5, 1000],
      [1.2, 99.5],
      [0.2, 100],
    ] as const) {
      expect(evalClosureTable(table, [x, y])).toBeCloseTo(bilinear(x, y), 10);
    }
  });

  it('clamps coordinates outside the axes', () => {
    expect(evalClosureTable(table, [-1, 55])).toBeCloseTo(bilinear(0, 55), 10);
    expect(evalClosureTable(table, [9, 1e6])).toBeCloseTo(bilinear(1.5, 1000), 10);
    expect(evalClosureTable(table, [0.3, Number.POSITIVE_INFINITY])).toBeCloseTo(
      bilinear(0.3, 1000),
      10,
    );
  });

  it('interpolates linearly between the knots of a curved function', () => {
    const sq = tabulateClosure(
      {
        id: 't',
        axes: [{ name: 'x', unit: '1', values: Float64Array.of(0, 1, 3) }],
        unit: '1',
        provenance: 'test',
      },
      (x) => x * x,
    );
    // Between 1 and 3 the chord of x^2 through (1, 1) and (3, 9): 1 + 4 (x - 1).
    expect(evalClosureTable(sq, [2])).toBe(5);
    expect(evalClosureTable(sq, [0.5])).toBe(0.5);
    // On a knot the f64 evaluator returns the stored value exactly, also at the upper end.
    expect(evalClosureTable(sq, [3])).toBe(9);
    expect(evalClosureTable(sq, [1])).toBe(1);
  });

  it('handles three axes, one of them with a single coordinate', () => {
    const t3 = tabulateClosure(
      {
        id: 't3',
        axes: [
          { name: 'a', unit: '1', values: Float64Array.of(0, 2) },
          { name: 'b', unit: '1', values: Float64Array.of(7) },
          { name: 'c', unit: '1', values: Float64Array.of(-1, 0, 4) },
        ],
        unit: '1',
        provenance: 'test',
      },
      (a, b, c) => a * c + b,
    );
    expect(evalClosureTable(t3, [1.5, 123, 2])).toBeCloseTo(1.5 * 2 + 7, 12);
  });

  it('rejects malformed tables and lookups', () => {
    const bad =
      (over: object): (() => unknown) =>
      () =>
        createClosureTable({ ...table, ...over });
    expect(bad({ data: new Float64Array(5) })).toThrow(ClosureTableError);
    expect(
      bad({ axes: [axes[0], { name: 'We', unit: '1', values: Float64Array.of(10, 10, 1000) }] }),
    ).toThrow(/strictly increasing/);
    expect(bad({ axes: [] })).toThrow(ClosureTableError);
    expect(() => evalClosureTable(table, [1])).toThrow(ClosureTableError);
    expect(() => evalClosureTable(table, [Number.NaN, 1])).toThrow(ClosureTableError);
  });

  it('packs tables in id order with axis coordinates before the grid', () => {
    const second = tabulateClosure(
      { id: 'rim.split', axes: [axes[1] as (typeof axes)[number]], unit: '1', provenance: 'test' },
      (y) => y,
    );
    const packed = packClosureTables([table, second]);
    expect(packed.entries['rim.split']).toMatchObject({ axisOffsets: [0], dataOffset: 3 });
    expect(packed.entries['wire.split']).toMatchObject({ axisOffsets: [6, 10], dataOffset: 13 });
    expect(packed.data.length).toBe(6 + 7 + 12);
    expect([...packed.data.slice(0, 6)]).toEqual([10, 100, 1000, 10, 100, 1000]);
    expect(packClosureTables([second, table]).hash).toBe(packed.hash);
    expect(() => packClosureTables([table, table])).toThrow(ClosureTableError);
  });
});

describe('properties of water (films 2.1)', () => {
  const c = bindSharedClosures(params);
  // The table of films 2.1: T, rho kg/m3, mu mPa s, nu 1e-6 m2/s, sigma mN/m, l_c mm.
  const TABLE = [
    [20, 998.2, 1.002, 1.004, 72.7, 2.73],
    [30, 995.7, 0.797, 0.801, 71.2, 2.7],
    [40, 992.2, 0.651, 0.657, 69.6, 2.67],
    [50, 988.0, 0.544, 0.551, 67.9, 2.65],
    [55, 985.7, 0.501, 0.508, 67.1, 2.64],
    [60, 983.2, 0.463, 0.471, 66.2, 2.62],
    [65, 980.6, 0.43, 0.438, 65.4, 2.61],
    [70, 977.8, 0.4, 0.41, 64.5, 2.59],
  ] as const;

  it('reproduces the dossier table to its printed precision', () => {
    for (const [t, rho, muMPa, nu6, sigmaMN, lcMm] of TABLE) {
      const w = c.water(t);
      // Tolerances: half a unit of the last printed digit, plus one further unit for the
      // viscosities, where the dossier rounded intermediate values.
      expect(Math.abs(w.rho - rho), `rho at ${t}`).toBeLessThan(0.06);
      expect(Math.abs(w.mu * 1e3 - muMPa), `mu at ${t}`).toBeLessThan(0.0015);
      expect(Math.abs(w.nu * 1e6 - nu6), `nu at ${t}`).toBeLessThan(0.0015);
      expect(Math.abs(w.gammaW * 1e3 - sigmaMN), `sigma at ${t}`).toBeLessThan(0.06);
      expect(Math.abs(c.capillaryLength(w.gammaW, w.rho) * 1e3 - lcMm), `l_c at ${t}`).toBeLessThan(
        0.006,
      );
    }
  });

  it('equals the correlations written out directly', () => {
    for (const t of [0, 4, 17.5, 55, 99]) {
      const rho =
        (999.83952 +
          16.945176 * t -
          7.9870401e-3 * t ** 2 -
          46.170461e-6 * t ** 3 +
          105.56302e-9 * t ** 4 -
          280.54253e-12 * t ** 5) /
        (1 + 16.87985e-3 * t);
      const T = t + 273.15;
      const tau = 1 - T / 647.096;
      expect(c.waterDensity(t) / rho - 1).toBeCloseTo(0, 13);
      expect(c.waterViscosity(t) / (2.414e-5 * 10 ** (247.8 / (T - 140))) - 1).toBeCloseTo(0, 13);
      expect(
        c.waterSurfaceTension(t) / (0.2358 * tau ** 1.256 * (1 - 0.625 * tau)) - 1,
      ).toBeCloseTo(0, 13);
    }
    // Handbook spot checks quoted by the dossier: densest near 4 degrees; mu at 60 C is about
    // 0.7 % below the handbook 0.4665 mPa s.
    expect(c.waterDensity(4)).toBeGreaterThan(c.waterDensity(0));
    expect(c.waterDensity(4)).toBeGreaterThan(c.waterDensity(8));
    expect(c.waterViscosity(60) / 0.4665e-3).toBeCloseTo(0.993, 2);
  });
});

describe('wetting thresholds (section M2)', () => {
  const c = bindSharedClosures(params);

  it('reproduces the Hartley-Murgatroyd table of films 5.4', () => {
    // delta* in micrometres for water at 55 C and for sigma = 35 mN/m at 55 C, vertical wall.
    const w = c.water(55);
    const rows = [
      [5, 101, 89],
      [10, 133, 117],
      [20, 175, 154],
      [36, 221, 194],
      [50, 250, 220],
      [70, 283, 248],
      [90, 307, 270],
      [102, 319, 280],
      [110, 326, 286],
    ] as const;
    for (const [theta, water, liquor] of rows) {
      // Tolerance 1 um: the printed precision (0.5) plus the rounding of the dossier's inputs.
      expect(
        Math.abs(c.deltaStar(w.mu, w.gammaW, w.rho, deg(theta), 1) * 1e6 - water),
        `water ${theta}`,
      ).toBeLessThan(1);
      expect(
        Math.abs(c.deltaStar(w.mu, 0.035, w.rho, deg(theta), 1) * 1e6 - liquor),
        `liquor ${theta}`,
      ).toBeLessThan(1);
    }
  });

  it('reproduces the onset masses the contract quotes in M6', () => {
    // "2 g/m2 on glass and 3 g/m2 on glaze in wash liquor (the running-drop route), 16 g/m2 on
    // steel and polypropylene in wash liquor, 12 and 43 g/m2 on glass and polypropylene in clean
    // water (budget3b.py)", with that script's inputs: rho 990, sigma 40 / 60 mN/m,
    // mu 0.504 / 1.0 mPa s, and (theta_a, theta_r) per material; vertical faces.
    const cases = [
      ['glass, wash liquor', 0.04, 5.04e-4, 15, 3, 2],
      ['glaze, wash liquor', 0.04, 5.04e-4, 20, 5, 3],
      ['steel, wash liquor', 0.04, 5.04e-4, 45, 10, 16],
      ['polypropylene, wash liquor', 0.04, 5.04e-4, 50, 25, 16],
      ['glass, water', 0.06, 1.0e-3, 35, 10, 12],
      ['polypropylene, water', 0.06, 1.0e-3, 95, 60, 43],
    ] as const;
    for (const [name, sigma, mu, a, r, gPerM2] of cases) {
      const mOn = c.onsetMass(mu, sigma, 990, deg(a), deg(r), 1);
      // Tolerance 1 g/m2: the contract prints whole grams (and gives steel, 16.7, as 16).
      expect(Math.abs(mOn * 1e3 - gPerM2), name).toBeLessThan(1);
      // In all six the bead route is the smaller one.
      expect(mOn).toBeCloseTo(990 * c.bMax(sigma, 990, deg(a), deg(r), 1), 12);
    }
  });

  it('takes the film route when it is the smaller, and scales with kappa_w and C_b', () => {
    // A strongly hysteretic surface at a shallow tilt (sin(beta) = 0.1): beads hold more than
    // the film thickness there, because b_max grows as 1 / sin(beta) and delta_wet does not.
    const args = [5.04e-4, 0.04, 990, deg(110), deg(20), 0.1] as const;
    const dWet = c.deltaWet(5.04e-4, 0.04, 990, deg(110), 0.1);
    expect(dWet).toBeLessThan(c.bMax(0.04, 990, deg(110), deg(20), 0.1));
    expect(c.onsetMass(...args)).toBeCloseTo(990 * dWet, 12);
    expect(dWet).toBeCloseTo(0.5 * c.deltaStar(5.04e-4, 0.04, 990, deg(110), 0.1), 15);
    const tuned = bindSharedClosures(params.with({ 'film.kappaW': 0.8, 'film.Cb': 0.06 }));
    expect(tuned.deltaWet(5.04e-4, 0.04, 990, deg(110), 1) / dWet).toBeCloseTo(1.6, 12);
    expect(
      tuned.bMax(0.04, 990, deg(50), deg(25), 1) / c.bMax(0.04, 990, deg(50), deg(25), 1),
    ).toBeCloseTo(2, 12);
  });

  it('follows the tilt rules: none by default, the factors of M2 with n_beta = 1', () => {
    const at = (cl: typeof c, sinBeta: number): number =>
      cl.deltaStar(5.04e-4, 0.04, 990, deg(45), sinBeta);
    // film.nBeta = 0: the same threshold at every tilt.
    expect(at(c, Math.sin(deg(5)))).toBeCloseTo(at(c, 1), 15);
    // "With n_beta = 1 the threshold is 1.3 times larger at 30 degrees and 2.5 times larger
    // below 6 degrees": sin^(-2/5), with the floor sin(beta) >= 0.1 (5.7 degrees).
    const tilted = bindSharedClosures(params.with({ 'film.nBeta': 1 }));
    expect(at(tilted, 0.5) / at(tilted, 1)).toBeCloseTo(2 ** 0.4, 12);
    expect(at(tilted, 0.5) / at(tilted, 1)).toBeCloseTo(1.3, 1);
    expect(at(tilted, Math.sin(deg(3))) / at(tilted, 1)).toBeCloseTo(10 ** 0.4, 12);
    expect(at(tilted, 0) / at(tilted, 1)).toBeCloseTo(2.5, 1);
    // b_max grows as 1 / sin(beta) down to the floor.
    expect(
      c.bMax(0.04, 990, deg(45), deg(10), 0.25) / c.bMax(0.04, 990, deg(45), deg(10), 1),
    ).toBeCloseTo(4, 12);
    expect(
      c.bMax(0.04, 990, deg(45), deg(10), 0.01) / c.bMax(0.04, 990, deg(45), deg(10), 1),
    ).toBeCloseTo(10, 12);
  });

  it('registers its parameters with the defaults and ranges of M7.9', () => {
    expect(registry.def('film.kappaW')).toMatchObject({
      default: 0.5,
      min: 0.3,
      max: 1,
      group: 'hydro',
    });
    expect(registry.def('film.nBeta')).toMatchObject({ default: 0, min: 0, max: 1 });
    expect(registry.def('film.Cb')).toMatchObject({
      default: 0.03,
      min: 0.01,
      max: 0.06,
      tag: 'ESTIMATED',
    });
    expect(params.get('phys.gravity')).toBe(9.80665);
    // Water property coefficients are data: fixed, and outside every calibration group.
    const water = registry.defs.filter((d) => d.key.startsWith('water.'));
    expect(water.length).toBe(14);
    expect(
      water.every(
        (d) =>
          d.kind !== 'enum' &&
          d.kind !== 'vector' &&
          d.min === d.max &&
          d.calibration === undefined,
      ),
    ).toBe(true);
    expect(registry.calibrationGroup('wetting').map((d) => d.key)).toEqual([
      'film.Cb',
      'film.kappaW',
    ]);
  });
});

describe('tiers of the first build (section 7.5, scope note)', () => {
  it('holds the official and fast columns with the K-only variant', () => {
    expect(TIER_OFFICIAL.variant).toBe('K-only');
    expect(TIER_FAST.variant).toBe('K-only');
    // Section 7.5: 2 / 1 / 1 mm against 4 / 2 / 2 mm; rows and columns halve, so tiers nest.
    expect(TIER_FAST.block_m / TIER_OFFICIAL.block_m).toBe(2);
    expect(TIER_FAST.soilCell_m / TIER_OFFICIAL.soilCell_m).toBe(2);
    expect([
      TIER_OFFICIAL.armPhases,
      TIER_OFFICIAL.subRays,
      TIER_FAST.armPhases,
      TIER_FAST.subRays,
    ]).toEqual([2 ** 14, 19, 2 ** 12, 7]);
    // "F Monte Carlo (9 x 10^7 parcels)" in the fast budget: two diverter states in the
    // main-wash class and two in another class.
    expect(2 * TIER_FAST.parcelsMainWash + 2 * TIER_FAST.parcelsOther).toBe(9e7);
    // Fast: "1 settle + 2 steady per state (18), no transient": 2 states x 3 classes x 3.
    expect(2 * 3 * (TIER_FAST.settleRevolutions + TIER_FAST.steadyRevolutions)).toBe(18);
    expect(TIER_FAST.transientRecord).toBe('none');
    expect([TIER_OFFICIAL.soilLayers, TIER_FAST.soilLayers]).toEqual([12, 8]);
    expect([TIER_OFFICIAL.drainDown, TIER_FAST.drainDown]).toEqual([
      { kind: 'cascade', doublingSteps: 512 },
      { kind: 'cascade', doublingSteps: 192 },
    ]);
  });
});

describe('expression facility outside the comfortable domain (review findings)', () => {
  const eval2 = (e: ReturnType<typeof expr.lit>): ((x: number, y: number) => number) =>
    compileExprFn(expr.fn({ name: 'probe', doc: 'p', inputs: ['x', 'y'], result: e }), params);
  const X = expr.input('x');
  const Y = expr.input('y');

  it('saturates tanh at large arguments instead of following the device', () => {
    const tanh = eval2(expr.tanh(X));
    for (const x of [20, 44, 44.5, 100, 1e30]) {
      // tanh(16) = 1 - 2.5e-14 in f64, which is exactly 1 in f32.
      expect(Math.abs(tanh(x, 0) - 1)).toBeLessThan(1e-13);
      expect(Math.fround(tanh(x, 0))).toBe(1);
      expect(Math.fround(tanh(-x, 0))).toBe(-1);
    }
    // Inside the clamp it is the ordinary function.
    expect(tanh(0.5, 0)).toBeCloseTo(Math.tanh(0.5), 15);
    expect(tanh(Number.NaN, 0)).toBeNaN();
  });

  it('returns NaN from pow and atan2 outside their stated domain, as the GPU does', () => {
    const pow = eval2(expr.pow(X, Y));
    for (const [x, y] of [
      [-1.5, 2],
      [-2, 3],
      [0, 0],
    ] as const) {
      expect(pow(x, y), `pow(${x}, ${y})`).toBeNaN();
    }
    expect(pow(0, -1)).toBe(Number.POSITIVE_INFINITY);
    expect(pow(0, 2)).toBe(0);
    expect(pow(2, 0)).toBe(1);
    expect(pow(2, -3)).toBe(0.125);
    expect(pow(1.5, 2)).toBe(2.25);
    const atan2 = eval2(expr.atan2(X, Y));
    expect(atan2(0, 0)).toBeNaN();
    expect(atan2(0, -1)).toBeCloseTo(Math.PI, 15);
    expect(atan2(1, 0)).toBeCloseTo(Math.PI / 2, 15);
  });

  it('rejects names that WGSL reserves or that the emitted code calls', () => {
    const define =
      (name: string, inputs: string[], locals: [string, number][] = []) =>
      (): unknown =>
        expr.fn({
          name,
          doc: 'd',
          inputs,
          locals,
          result: expr.sin(expr.input(inputs[0] as string)),
        });
    for (const reserved of ['target', 'filter', 'mod', 'sin', 'clamp', 'select', 'f32', 'let']) {
      expect(define('ok_fn', [reserved]), reserved).toThrow(ExprError);
      expect(define('ok_fn', ['x'], [[reserved, 1]]), reserved).toThrow(ExprError);
      expect(define(reserved, ['x']), reserved).toThrow(ExprError);
    }
    expect(define('ok_fn', ['x', 'theta_a'], [['tau', 1]])).not.toThrow();
    // An input may not carry the name of a function the body calls.
    const callee = expr.fn({ name: 'callee', doc: 'c', inputs: ['a'], result: expr.input('a') });
    expect(() =>
      expr.fn({
        name: 'caller',
        doc: 'c',
        inputs: ['callee'],
        result: expr.call(callee, expr.input('callee')),
      }),
    ).toThrow(/callee/);
  });

  it('rejects constant subexpressions that are not finite f32 values', () => {
    const define = (e: ReturnType<typeof expr.lit>) => (): unknown =>
      expr.fn({ name: 'h', doc: 'd', inputs: ['x'], result: expr.add(expr.input('x'), e) });
    for (const [name, e] of [
      ['1 / 0', expr.div(1, 0)],
      ['sqrt(-1)', expr.sqrt(-1)],
      ['log(0)', expr.log(0)],
      ['pow(0, -1)', expr.pow(0, -1)],
      ['exp(4096)', expr.exp(expr.mul(16, 16, 16))],
      // exp(128) is finite in f64 and exceeds the largest f32 (3.4e38).
      ['exp(128)', expr.exp(expr.mul(16, 8))],
      ['select of constants', expr.select('lt', 0, 1, expr.div(1, 0), 2)],
    ] as const) {
      expect(define(e), name).toThrow(/constant/);
    }
    expect(define(expr.div(1, 3))).not.toThrow();
    expect(define(expr.exp(expr.neg(expr.mul(16, 16))))).not.toThrow();
  });
});

describe('closure-table axes on the f32 grid of the kernel (review finding)', () => {
  it('rejects coordinates that are distinct in f64 and equal in f32', () => {
    const make = (values: number[]) => (): unknown =>
      createClosureTable({
        id: 't',
        axes: [{ name: 'T', unit: 'K', values: Float64Array.from(values) }],
        data: Float64Array.of(1, 2, 3),
        unit: '1',
        provenance: 'test',
      });
    // 293.15 and 293.150001 both round to 293.149993896484375 (f32 spacing there is 3e-5).
    expect(Math.fround(293.15)).toBe(Math.fround(293.150001));
    expect(make([293.15, 293.150001, 333.15])).toThrow(/strictly increasing in f32/);
    expect(make([293.15, 333.15, 333.150001])).toThrow(/strictly increasing in f32/);
    expect(make([293.15, 293.1501, 333.15])).not.toThrow();
  });

  it('holds and interpolates on the f32-rounded coordinates', () => {
    const t = tabulateClosure(
      {
        id: 't',
        axes: [{ name: 'T', unit: 'K', values: Float64Array.of(293.15, 293.1501, 333.15) }],
        unit: '1',
        provenance: 'test',
      },
      (T) => T,
    );
    const knots = [...(t.axes[0] as { values: Float64Array }).values];
    expect(knots).toEqual([293.15, 293.1501, 333.15].map(Math.fround));
    // The function is the identity, so the table holds its own (rounded) coordinates and
    // interpolation returns the query: a wrong interval or an unrounded knot would not.
    expect([...t.data]).toEqual(knots);
    for (const x of [knots[0], knots[1], knots[2], 293.15003, 300, 333.1]) {
      expect(evalClosureTable(t, [x as number])).toBeCloseTo(x as number, 10);
    }
  });
});

describe('wetting thresholds with the angles out of order (review finding)', () => {
  it('gives a zero bead load and onset mass when theta_r exceeds theta_a, never a negative one', () => {
    const c = bindSharedClosures(params);
    const w = c.water(55);
    // The reviewer's case: theta_a = 10, theta_r = 20 degrees gave b_max = -2.75 um.
    expect(c.bMax(0.035, w.rho, deg(10), deg(20), 1)).toBe(0);
    expect(c.onsetMass(w.mu, 0.035, w.rho, deg(10), deg(20), 1)).toBe(0);
    expect(c.bMax(0.035, w.rho, deg(20), deg(20), 1)).toBe(0);
    // In order, the value is the contract's formula, unchanged by the clamp.
    const lc = Math.sqrt(0.035 / (w.rho * 9.80665));
    expect(c.bMax(0.035, w.rho, deg(20), deg(10), 1)).toBeCloseTo(
      0.03 * lc * (Math.cos(deg(10)) - Math.cos(deg(20))),
      14,
    );
  });
});
