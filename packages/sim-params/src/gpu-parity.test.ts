// Runs the generated WGSL on the GPU (Dawn, through the `webgpu` package directly) and compares
// it with the f64 TypeScript evaluators on random inputs over the stated ranges: uniform blocks,
// per-class tables, closure tables (buffer and texture access) and the closure functions.
//
// Tolerances are relative and sized for f32: one rounding is 6e-8, and a formula of a few dozen
// operations with a pow or a cosine difference accumulates some 1e-6 to 1e-5. Each test states
// its own. Without a GPU adapter the tests are skipped and say so; with SPOTLESS_REQUIRE_GPU=1
// in the environment a missing adapter fails the run.
import { hashU32, u32ToUnitFloat } from '@spotless/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildSoilClassLayout,
  buildUniformLayout,
  closureTableTexture,
  compileExprFn,
  createParamSet,
  createRegistry,
  emitClosureTableHelpersWgsl,
  emitClosureTableWgsl,
  emitExprWgsl,
  evalClosureTable,
  expr,
  exprParamKeys,
  lintLiterals,
  packClosureTables,
  packSoilClassTable,
  packUniformBlock,
  type AnyParamDef,
  SHARED_CLOSURE_FNS,
  SHARED_PARAM_DEFS,
  tabulateClosure,
} from './index.ts';
import { destroyGpuDevice, gpuDevice, runMapKernel } from './gpu-harness.test-util.ts';

afterAll(destroyGpuDevice);

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

/** Uniform random number in [lo, hi), from the counter-based generator of core. */
function uniform(stream: number, i: number, lo: number, hi: number): number {
  return lo + (hi - lo) * u32ToUnitFloat(hashU32(20261009, stream, i));
}

/** Largest relative difference between GPU results and f64 references. */
function maxRelative(gpu: ArrayLike<number>, reference: ArrayLike<number>): number {
  let worst = 0;
  for (let i = 0; i < reference.length; i++) {
    const r = reference[i] as number;
    const g = gpu[i] as number;
    if (!Number.isFinite(g)) return Number.POSITIVE_INFINITY;
    worst = Math.max(worst, Math.abs(g - r) / Math.max(Math.abs(r), 1e-30));
  }
  return worst;
}

describe('GPU adapter', () => {
  it('is present, or the parity tests are reported as skipped', () => {
    if (!gpuDevice) console.warn('sim-params: no WebGPU adapter; GPU parity tests are SKIPPED');
    expect(gpuDevice === null || typeof gpuDevice.createShaderModule === 'function').toBe(true);
    // A machine that is meant to have a GPU sets SPOTLESS_REQUIRE_GPU=1, and a missing adapter
    // is then a failure, not a silent loss of the parity coverage.
    if (process.env['SPOTLESS_REQUIRE_GPU'] === '1') expect(gpuDevice).not.toBeNull();
  });
});

describe.skipIf(!gpuDevice)('generated WGSL against the f64 evaluators', () => {
  const device = gpuDevice as GPUDevice;

  it('delivers a uniform block to a kernel member by member', async () => {
    const params = createParamSet(registry, {
      'soil.erosionLaw': 'thickness',
      'film.sigma': [0.05, 0.035, 0.04],
    });
    const layout = buildUniformLayout(registry, 'TestParams', [
      'film.sigma',
      'jets.cR',
      'soil.erosionLaw',
      'film.Cb',
      'phys.gravity',
      'water.rho.a5',
    ]);
    const block = packUniformBlock(layout, params);
    const members = layout.fields.filter((f) => f.key !== null);
    const body = members.map((f, k) => `outp[o + ${k}u] = params.${f.name};`).join('\n  ');
    const out = await runMapKernel(
      device,
      layout.wgsl,
      body,
      new Float32Array(1),
      1,
      members.length,
      {
        uniform: { structName: layout.structName, data: block.data },
      },
    );
    // Expected values written from the registry by hand, in key order, rounded to f32: exact.
    const expected = [0.03, 0.05, 0.035, 0.04, 0.289, 9.80665, 1, -280.54253e-12].map(Math.fround);
    expect([...out]).toEqual(expected);
  });

  it('delivers a per-class soil table as a storage buffer of rows', async () => {
    const params = createParamSet(registry, { 'soil.rice_starch.Ea': 7e4 });
    const layout = buildSoilClassLayout(registry, 'SoilClassParams', ['lag', 'Ea']);
    const classes = ['rice_starch', 'egg_yolk_dried', 'rice_starch'];
    const table = packSoilClassTable(layout, params, classes);
    const out = await runMapKernel(
      device,
      layout.wgsl,
      'let c = u32(inp[b]);\n  outp[o] = rows[c].lag;\n  outp[o + 1u] = rows[c].Ea;',
      Float32Array.of(0, 1, 2),
      1,
      2,
      { rows: { structName: layout.structName, data: table.data } },
    );
    expect([...out]).toEqual([60, 7e4, 540, 5e4, 60, 7e4]);
  });

  it('evaluates every operation of the expression facility as the f64 evaluator does', async () => {
    const X = expr.input('x');
    const Y = expr.input('y');
    const ops = expr.fn({
      name: 'ops',
      doc: 'Exercises every unary and binary operation, select, enumIs, parameters and a call.',
      inputs: ['x', 'y'],
      locals: [
        [
          'u',
          expr.add(
            expr.sin(X),
            expr.cos(Y),
            expr.tan(expr.mul(0.25, X)),
            expr.atan(Y),
            expr.tanh(X),
          ),
        ],
        [
          'v',
          expr.add(
            expr.sqrt(X),
            expr.exp(expr.neg(Y)),
            expr.log(expr.add(X, 1)),
            expr.abs(expr.sub(X, Y)),
            expr.floor(expr.mul(4, Y)),
          ),
        ],
        [
          'w',
          expr.add(
            expr.pow(X, Y),
            expr.atan2(Y, X),
            expr.min(X, Y),
            expr.max(X, Y),
            expr.clamp(X, 0.5, 1),
          ),
        ],
      ],
      result: expr.add(
        expr.div(expr.local('u'), expr.local('v')),
        expr.mul(expr.local('w'), expr.param('film.sigma', 2)),
        expr.select('ge', X, Y, expr.param('jets.cR'), expr.neg(expr.param('film.Cb'))),
        expr.enumIs('soil.erosionLaw', 'thickness', expr.mul(2, X), Y),
      ),
    });
    const outer = expr.fn({
      name: 'outer',
      doc: 'A call.',
      inputs: ['x', 'y'],
      result: expr.add(expr.call(ops, X, Y), expr.call(ops, Y, X)),
    });
    for (const law of ['mass', 'thickness']) {
      const params = createParamSet(registry, { 'soil.erosionLaw': law });
      const layout = buildUniformLayout(registry, 'OpsParams', exprParamKeys([outer]));
      const wgsl = emitExprWgsl([outer], layout.target('params'));
      expect(lintLiterals(wgsl, 'wgsl')).toEqual([]);
      const n = 4096;
      const input = new Float32Array(2 * n);
      // x and y in 0.1 to 1.4: every function is smooth there and tan stays below its pole.
      for (let i = 0; i < 2 * n; i++) input[i] = uniform(1, i, 0.1, 1.4);
      const out = await runMapKernel(
        device,
        layout.wgsl + wgsl,
        'outp[o] = outer(inp[b], inp[b + 1u]);',
        input,
        2,
        1,
        {
          uniform: { structName: layout.structName, data: packUniformBlock(layout, params).data },
        },
      );
      const f = compileExprFn(outer, params);
      const reference = Float64Array.from({ length: n }, (_, i) =>
        f(input[2 * i] as number, input[2 * i + 1] as number),
      );
      // floor(4 y) jumps at multiples of 1/4: skip inputs within 1e-5 of a jump, where the f32
      // product may round to the other side.
      const keep = [...reference.keys()].filter((i) =>
        [0, 1].every(
          (c) =>
            Math.abs(
              (input[2 * i + c] as number) * 4 - Math.round((input[2 * i + c] as number) * 4),
            ) > 1e-5,
        ),
      );
      expect(keep.length).toBeGreaterThan(4000);
      // Tolerance 2e-5 relative: about 40 f32 operations, results of order 1 to 10.
      expect(
        maxRelative(
          keep.map((i) => out[i] as number),
          keep.map((i) => reference[i] as number),
        ),
      ).toBeLessThan(2e-5);
    }
  });

  it('computes water properties and wetting thresholds as the f64 closures do', async () => {
    // Non-default wetting parameters, so that the block is seen to carry them (n_beta = 1 turns
    // the tilt scaling on).
    const params = createParamSet(registry, {
      'film.kappaW': 0.7,
      'film.Cb': 0.045,
      'film.nBeta': 1,
    });
    const closures = bindSharedClosures(params);
    const layout = buildUniformLayout(registry, 'SharedParams', exprParamKeys(SHARED_CLOSURE_FNS));
    const wgsl = emitExprWgsl(SHARED_CLOSURE_FNS, layout.target('params'));
    const n = 8192;
    // Rows: tC 0..100 C; mu 2.5e-4..2e-3 Pa s; sigma 0.03..0.075 N/m; rho 950..1000 kg/m3;
    // thetaA 3..120 degrees; thetaR a fraction 0.05..0.95 of thetaA; sinBeta 0..1.
    const input = new Float32Array(7 * n);
    for (let i = 0; i < n; i++) {
      const thetaA = uniform(6, i, 3, 120) * (Math.PI / 180);
      input.set(
        [
          uniform(2, i, 0, 100),
          uniform(3, i, 2.5e-4, 2e-3),
          uniform(4, i, 0.03, 0.075),
          uniform(5, i, 950, 1000),
          thetaA,
          thetaA * uniform(7, i, 0.05, 0.95),
          uniform(8, i, 0, 1),
        ],
        7 * i,
      );
    }
    const body = `
  let tC = inp[b]; let mu = inp[b + 1u]; let sigma = inp[b + 2u]; let rho = inp[b + 3u];
  let thetaA = inp[b + 4u]; let thetaR = inp[b + 5u]; let sinBeta = inp[b + 6u];
  outp[o] = water_density(tC);
  outp[o + 1u] = water_viscosity(tC);
  outp[o + 2u] = water_surface_tension(tC);
  outp[o + 3u] = water_kinematic_viscosity(tC);
  outp[o + 4u] = capillary_length(sigma, rho);
  outp[o + 5u] = wetting_delta_star(mu, sigma, rho, thetaA, sinBeta);
  outp[o + 6u] = wetting_delta_wet(mu, sigma, rho, thetaA, sinBeta);
  outp[o + 7u] = wetting_b_max(sigma, rho, thetaA, thetaR, sinBeta);
  outp[o + 8u] = wetting_onset_mass(mu, sigma, rho, thetaA, thetaR, sinBeta);`;
    const out = await runMapKernel(device, layout.wgsl + wgsl, body, input, 7, 9, {
      uniform: { structName: layout.structName, data: packUniformBlock(layout, params).data },
    });
    const names = ['rho', 'mu', 'gammaW', 'nu', 'l_c', 'deltaStar', 'deltaWet', 'bMax', 'mOn'];
    // Relative tolerances for f32. Density is a ratio of polynomials (1e-6). Viscosity is
    // 10^(B / (T - C)) with an exponent near 1.5, which amplifies the rounding of T (5e-6).
    // The thresholds take a fifth root and products of sines of f32 angles (1e-5).
    const tolerance = [1e-6, 5e-6, 5e-6, 5e-6, 2e-6, 1e-5, 1e-5, 1e-5, 1e-5];
    const reference: number[][] = names.map(() => []);
    const got: number[][] = names.map(() => []);
    for (let i = 0; i < n; i++) {
      const [tC, mu, sigma, rho, thetaA, thetaR, sinBeta] = input.subarray(
        7 * i,
        7 * i + 7,
      ) as unknown as [number, number, number, number, number, number, number];
      const w = closures.water(tC);
      const row = [
        w.rho,
        w.mu,
        w.gammaW,
        w.nu,
        closures.capillaryLength(sigma, rho),
        closures.deltaStar(mu, sigma, rho, thetaA, sinBeta),
        closures.deltaWet(mu, sigma, rho, thetaA, sinBeta),
        closures.bMax(sigma, rho, thetaA, thetaR, sinBeta),
        closures.onsetMass(mu, sigma, rho, thetaA, thetaR, sinBeta),
      ];
      row.forEach((v, k) => {
        (reference[k] as number[]).push(v);
        (got[k] as number[]).push(out[9 * i + k] as number);
      });
    }
    const worst = names.map((_, k) => maxRelative(got[k] as number[], reference[k] as number[]));
    console.info(
      `sim-params GPU parity, worst relative difference: ${names.map((nm, k) => `${nm} ${(worst[k] as number).toExponential(1)}`).join(', ')}`,
    );
    names.forEach((name, k) =>
      expect(worst[k], `${name}: ${worst[k]}`).toBeLessThan(tolerance[k] as number),
    );
    // Both routes of m_on must have been exercised by the inputs.
    const filmRoute = (reference[8] as number[]).filter(
      (m, i) =>
        m < 0.999 * (input[7 * i + 3] as number) * ((reference[7] as number[])[i] as number),
    ).length;
    expect(filmRoute).toBeGreaterThan(200);
    expect(n - filmRoute).toBeGreaterThan(500);
  });

  it('agrees with the f64 evaluator at the edges of the domain of tanh, pow and atan2', async () => {
    const X = expr.input('x');
    const Y = expr.input('y');
    const fns = [
      expr.fn({ name: 'edge_tanh', doc: 'tanh(x)', inputs: ['x', 'y'], result: expr.tanh(X) }),
      expr.fn({ name: 'edge_pow', doc: 'pow(x, y)', inputs: ['x', 'y'], result: expr.pow(X, Y) }),
      expr.fn({
        name: 'edge_atan2',
        doc: 'atan2(x, y)',
        inputs: ['x', 'y'],
        result: expr.atan2(X, Y),
      }),
    ];
    const params = createParamSet(registry);
    const wgsl = emitExprWgsl(fns, { paramRef: () => '', enumOptionIndex: () => 0 });
    expect(lintLiterals(wgsl, 'wgsl')).toEqual([]);
    // tanh: large arguments of both signs (Metal's tanh gives 0 at 44 and NaN above).
    // pow: negative and zero bases. atan2: the origin and the four axes.
    const points: (readonly [number, number])[] = [
      ...[0.5, 10, 16, 20, 40, 44, 44.5, 45, 88, 100, 1e30].flatMap(
        (x) =>
          [
            [x, 1],
            [-x, 1],
          ] as const,
      ),
      [-1.5, 2],
      [-2, 3],
      [0, 0],
      [0, -1],
      [0, 2],
      [2, 0],
      [2, 3],
      [1.5, -2],
      [0, 0.5],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    const input = Float32Array.from(points.flat());
    const out = await runMapKernel(
      device,
      wgsl,
      fns.map((f, k) => `outp[o + ${k}u] = ${f.name}(inp[b], inp[b + 1u]);`).join('\n  '),
      input,
      2,
      fns.length,
    );
    const mismatches: string[] = [];
    fns.forEach((fn, k) => {
      const f = compileExprFn(fn, params);
      points.forEach(([x, y], i) => {
        const cpu = f(Math.fround(x), Math.fround(y));
        const gpu = out[i * fns.length + k] as number;
        // Both NaN, the same infinity, or equal within 1e-5 (absolute for results of order 1
        // and below, relative above): Metal's pow is exp(y log(x)) in f32, measured 4e-6 off
        // at 1e30.
        const same =
          (Number.isNaN(cpu) && Number.isNaN(gpu)) ||
          cpu === gpu ||
          Math.abs(cpu - gpu) <= 1e-5 * Math.max(1, Math.abs(cpu));
        if (!same) mismatches.push(`${fn.name}(${x}, ${y}): cpu ${cpu}, gpu ${gpu}`);
      });
    });
    expect(mismatches).toEqual([]);
    // The cases the review measured, stated outright: tanh saturates, the domain errors are NaN.
    const at = (k: number, x: number, y: number): number =>
      out[points.findIndex(([px, py]) => px === x && py === y) * fns.length + k] as number;
    expect([at(0, 44, 1), at(0, 100, 1), at(0, -100, 1), at(0, 1e30, 1)]).toEqual([1, 1, -1, 1]);
    expect(at(1, 2, 3)).toBeCloseTo(8, 5);
    expect([at(1, -2, 3), at(1, 0, 0), at(2, 0, 0)]).toEqual([Number.NaN, Number.NaN, Number.NaN]);
    expect(at(1, 0, -1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('reads close closure-table knots on the same f32 grid as the f64 evaluator', async () => {
    // Knots 1e-4 K apart near 293 K (three f32 steps), then a wide interval.
    const table = tabulateClosure(
      {
        id: 'close.knots',
        axes: [{ name: 'T', unit: 'K', values: Float64Array.of(293.15, 293.1501, 333.15) }],
        unit: '1',
        provenance: 'test',
      },
      (T) => (T < 293.15005 ? 1 : T < 300 ? 2 : 3),
    );
    const packedClose = packClosureTables([table]);
    const wgsl =
      emitClosureTableHelpersWgsl({ kind: 'buffer', name: 'tbl' }, 'ct') +
      emitClosureTableWgsl(packedClose.entries['close.knots'] as never, 'close_knots', 'ct');
    // Every f32 from two steps below the first knot to two above the second, and the far end.
    const xs: number[] = [];
    const step = 2 ** -15; // literal-ok: spacing of f32 between 256 and 512
    for (let k = -2; k <= 6; k++) xs.push(Math.fround(293.15) + k * step);
    xs.push(300, 333.15, 400);
    const input = Float32Array.from(xs);
    expect(new Set(input).size).toBe(xs.length);
    const out = await runMapKernel(device, wgsl, 'outp[o] = close_knots(inp[b]);', input, 1, 1, {
      buffer: packedClose.data,
    });
    const reference = [...input].map((x) => evalClosureTable(table, [x]));
    // The first two knots return 1 and 2 on both back ends (the review found 2 and 1.5 against
    // the CPU's 1 when the CPU used unrounded knots).
    reference
      .slice(2, 6)
      .forEach((r, k) => expect(r, `knot + ${k} steps`).toBeCloseTo(1 + k / 3, 12));
    for (let i = 0; i < reference.length; i++) {
      // Tolerance 1e-6: one f32 division and a blend of values of order 1.
      expect(
        Math.abs((out[i] as number) - (reference[i] as number)),
        `x = ${input[i]}`,
      ).toBeLessThan(1e-6);
    }
  });

  const axes = [
    { name: 'phi', unit: 'rad', values: Float64Array.of(0.1, 0.2, 0.5, 0.9, 1.5) },
    { name: 'We', unit: '1', values: Float64Array.of(10, 30, 100, 300, 1000, 3000) },
    { name: 'k', unit: '1', values: Float64Array.of(0, 1, 2) },
  ];
  const t3 = tabulateClosure(
    { id: 'wire.split', axes, unit: '1', provenance: 'test' },
    (phi, we, k) => Math.sin(3 * phi) * Math.log(we) + k * phi,
  );
  const t1 = tabulateClosure(
    { id: 'rim.split', axes: [axes[1] as (typeof axes)[number]], unit: '1', provenance: 'test' },
    (we) => 1 / (1 + we / 100),
  );
  const t2 = tabulateClosure(
    {
      id: 'sweep.correction',
      axes: [
        axes[0] as (typeof axes)[number],
        { name: 'one', unit: '1', values: Float64Array.of(5) },
      ],
      unit: '1',
      provenance: 'test',
    },
    (phi) => phi * phi,
  );
  const packed = packClosureTables([t3, t1, t2]);

  for (const kind of ['buffer', 'texture'] as const) {
    it(`interpolates closure tables read from a ${kind} as the f64 evaluator does`, async () => {
      const width = 16;
      const access =
        kind === 'buffer'
          ? ({ kind, name: 'tbl' } as const)
          : ({ kind, name: 'tbl', width } as const);
      const wgsl =
        emitClosureTableHelpersWgsl(access, 'ct') +
        emitClosureTableWgsl(packed.entries['wire.split'] as never, 'closure_wire_split', 'ct') +
        emitClosureTableWgsl(packed.entries['rim.split'] as never, 'closure_rim_split', 'ct') +
        emitClosureTableWgsl(packed.entries['sweep.correction'] as never, 'closure_sweep', 'ct');
      expect(lintLiterals(wgsl, 'wgsl')).toEqual([]);
      const n = 4096;
      const input = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) {
        // A fifth of the samples lie outside the axes, to exercise the clamp; the first rows
        // sit exactly on knots and corners.
        input[3 * i] = uniform(11, i, -0.2, 1.9);
        input[3 * i + 1] = uniform(12, i, -500, 3600);
        input[3 * i + 2] = uniform(13, i, -0.5, 2.5);
      }
      input.set([0.1, 10, 0, 1.5, 3000, 2, 0.5, 100, 1, 0.2, 3000, 0], 0);
      const body = `
  outp[o] = closure_wire_split(inp[b], inp[b + 1u], inp[b + 2u]);
  outp[o + 1u] = closure_rim_split(inp[b + 1u]);
  outp[o + 2u] = closure_sweep(inp[b], inp[b + 2u]);`;
      const out = await runMapKernel(
        device,
        wgsl,
        body,
        input,
        3,
        3,
        kind === 'buffer'
          ? { buffer: packed.data }
          : { texture: closureTableTexture(packed.data, width) },
      );
      let worst = 0;
      for (let i = 0; i < n; i++) {
        const [x, y, z] = [
          input[3 * i] as number,
          input[3 * i + 1] as number,
          input[3 * i + 2] as number,
        ];
        const reference = [
          evalClosureTable(t3, [x, y, z]),
          evalClosureTable(t1, [y]),
          evalClosureTable(t2, [x, z]),
        ];
        reference.forEach((r, k) => {
          // Absolute difference scaled by the size of the table values (up to 8 for t3, 1 for
          // the others), because an interpolated value may pass through zero.
          worst = Math.max(worst, Math.abs((out[3 * i + k] as number) - r) / [8, 1, 2.25][k]!);
        });
      }
      // Tolerance 5e-6 of the table's range: the f32 rounding of knots, values and fractions.
      expect(worst).toBeLessThan(5e-6);
      // On a knot the result is the stored f32 value to one unit in the last place (2e-7): the
      // Metal compiler may rewrite a (1 - t) + b t, so exactness at t = 1 is not guaranteed.
      const corner = Math.sin(4.5) * Math.log(3000) + 2 * 1.5;
      // The table is tabulated on its f32-rounded coordinates (0.1 is not an f32).
      expect(out[0]).toBe(Math.fround(Math.sin(3 * Math.fround(0.1)) * Math.log(10)));
      expect(Math.abs((out[3] as number) / corner - 1)).toBeLessThan(2e-7);
    });
  }
});
