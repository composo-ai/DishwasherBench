// The closed forms of the jet stage against the jets dossier: the worked profile of the
// reference jet J2-8 (section 4.4), the film jump (4.5), the oblique flow split (4.7), the
// splatter fractions (5.2, 5.6), and the compiled CPU form against the f64 reference evaluator.
import { hashU32, u32ToUnitFloat } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  compileExprFn,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
} from './index.ts';
import {
  bindJetClosures,
  buildFilmTable,
  compileExprFast,
  FILM_COLUMN,
  filmTableAt,
  JET_CLOSURE_FNS,
  jetFlowShare,
  JETS_PARAM_DEFS,
} from './index.ts';

const registry = createRegistry({
  contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS, HYDRAULICS_PARAM_DEFS, JETS_PARAM_DEFS],
});
const params = createParamSet(registry);
const closures = bindJetClosures(params);
const water = bindSharedClosures(params).water(50);

// The dossier's reference jet J2-8: d = 2 mm, V = 8 m/s, water at 50 C, Re = 28,900.
const d = 2e-3;
const v = 8;
const re = (v * d) / water.nu;
const flow = (Math.PI * d * d * v) / 4;

describe('the compiled closures', () => {
  it('equal the f64 reference evaluator of sim-params bit for bit', () => {
    const fast = compileExprFast(JET_CLOSURE_FNS, params);
    // Inputs in the ranges the stage uses, by the name of the input.
    const range: Record<string, [number, number]> = {
      V: [2, 12],
      d: [0.5e-3, 4e-3],
      rho: [960, 1000],
      nu: [3e-7, 1e-6],
      gamma: [0.05, 0.075],
      s: [0, 0.6],
      Lb: [0.05, 1],
      sinPhi: [0.05, 1],
      cosPhi: [0, 0.99],
      cosPsi: [-1, 1],
      r0: [0.25e-3, 2e-3],
      X: [0, 3],
      x: [0.05, 60],
      re: [200, 2e5],
      Qeq: [1e-7, 1e-3],
      c: [0, 0.99],
      psi: [0, 3.1],
    };
    let checked = 0;
    for (const fn of JET_CLOSURE_FNS) {
      const reference = compileExprFn(fn, params);
      const compiled = fast[fn.name];
      if (compiled === undefined) throw new Error(`${fn.name} was not compiled`);
      for (let k = 0; k < 200; k++) {
        const args = fn.inputs.map((name, j) => {
          const [lo, hi] = range[name] ?? [0, 1];
          return lo + (hi - lo) * u32ToUnitFloat(hashU32(11, checked, k, j));
        });
        expect(compiled(...args), `${fn.name}(${args.join(', ')})`).toBe(reference(...args));
      }
      checked++;
    }
    expect(checked).toBe(JET_CLOSURE_FNS.length);
  });
});

describe('the radial film of the reference jet (jets 4.4)', () => {
  it('has the Reynolds number the dossier quotes', () => {
    expect(re / 28_900).toBeGreaterThan(0.98);
    expect(re / 28_900).toBeLessThan(1.02);
  });

  it('reproduces thickness, speed and shear of the dossier table in all three zones', () => {
    // r/d, h (um), U_av (m/s), tau_w (Pa): boundary-layer zone to 7.4 d, laminar to 9.1 d,
    // turbulent beyond. The table is printed to two or three figures.
    const rows: [number, number, number, number][] = [
      [0.55, 464, 7.8, 237],
      [1, 263, 7.6, 176],
      [2, 143, 7.0, 124],
      [5, 78, 5.1, 79],
      [7, 69, 4.2, 66],
      [8, 66, 3.8, 63],
      [10, 70, 2.9, 52],
      [12, 83, 2.0, 27],
      [15, 103, 1.3, 12],
      [20, 142, 0.7, 3.8],
    ];
    for (const [x, h, u, tau] of rows) {
      const gotH = closures.filmThickness(x, re) * d * 1e6;
      const gotU = closures.filmSpeed(x, re) * v;
      const gotTau = closures.filmShear(x, re) * water.rho * v * v;
      expect(gotH / h, `h at ${x} d`).toBeGreaterThan(0.97);
      expect(gotH / h, `h at ${x} d`).toBeLessThan(1.03);
      expect(gotU / u, `U at ${x} d`).toBeGreaterThan(0.95);
      expect(gotU / u, `U at ${x} d`).toBeLessThan(1.05);
      expect(gotTau / tau, `tau at ${x} d`).toBeGreaterThan(0.95);
      expect(gotTau / tau, `tau at ${x} d`).toBeLessThan(1.05);
    }
  });

  it('conserves volume along a ray: r h U = d^2 V / 8', () => {
    // Exact in the boundary-layer and laminar zones; the turbulent fits hold it within 3 %.
    for (const x of [0.6, 2, 5, 7, 8.5]) {
      expect(8 * x * closures.filmThickness(x, re) * closures.filmSpeed(x, re)).toBeCloseTo(1, 12);
    }
    for (const x of [10, 15, 20]) {
      const product = 8 * x * closures.filmThickness(x, re) * closures.filmSpeed(x, re);
      expect(product).toBeGreaterThan(0.97);
      expect(product).toBeLessThan(1.03);
    }
  });

  it('gives the momentum flux of sim-core M5 at 0.55 d and 10 d', () => {
    // c_M rho U^2 h: 33.8 N/m at 0.55 d and 0.57 N/m at 10 d (sim-core M5, checks.py).
    const scale = water.rho * v * v * d;
    expect((closures.filmMomentum(0.55, re) * scale) / 33.8).toBeGreaterThan(0.98);
    expect((closures.filmMomentum(0.55, re) * scale) / 33.8).toBeLessThan(1.02);
    expect((closures.filmMomentum(10, re) * scale) / 0.57).toBeGreaterThan(0.97);
    expect((closures.filmMomentum(10, re) * scale) / 0.57).toBeLessThan(1.03);
    // Inside the stagnation zone it ramps linearly from zero on the axis.
    expect(closures.filmMomentum(0.275, re) / closures.filmMomentum(0.55, re)).toBeCloseTo(0.5, 12);
  });

  it('reaches the stagnation pressure of 31.6 kPa and the peak shear of 237 Pa', () => {
    // "stagnation pressure up to 31.6 kPa ... peak wall shear 236 Pa" (jets 11.4).
    expect(closures.wallPressure(v, water.rho, 1, 0) / 1000).toBeCloseTo(31.6, 1);
    const ratios = [0.25, 0.5, 0.7, 1.0, 1.25].map(
      (x) => closures.wallPressure(v, water.rho, 1, x) / closures.wallPressure(v, water.rho, 1, 0),
    );
    [0.94, 0.73, 0.44, 0.09, 0.01].forEach((want, i) => expect(ratios[i]).toBeCloseTo(want, 2));
    // The stagnation branch 1.150 rho V^2 Re^(-1/2) x meets the film branch at 0.552 d.
    const cross = Math.pow(0.472 / 1.15, 2 / 3);
    const stag = closures.stagShear(v, d, water.rho, water.nu, 1, cross);
    const film = closures.filmShear(cross, re) * water.rho * v * v;
    expect(stag / film).toBeCloseTo(1, 3);
    expect(stag).toBeGreaterThan(232);
    expect(stag).toBeLessThan(240);
    // A quarter of the way in, the dossier's 107 Pa.
    expect(closures.stagShear(v, d, water.rho, water.nu, 1, 0.25) / 107).toBeCloseTo(1, 1);
  });

  it('carries the momentum of the jet in its pressure footprint', () => {
    // Integral of p over the wall = rho Q V sin(phi) (jets 4.7): with X the scaled radius the
    // integral of sech^2(a X + b X^3) X dX must be 1/4. The constant b was fitted to that.
    let integral = 0;
    const dx = 1e-4;
    for (let x = 0.5 * dx; x < 4; x += dx) {
      integral += (closures.wallPressure(v, water.rho, 1, x) / (0.5 * water.rho * v * v)) * x * dx;
    }
    expect(integral / 0.25).toBeGreaterThan(0.98);
    expect(integral / 0.25).toBeLessThan(1.02);
    // At oblique incidence the footprint is stretched by 1 / sin(phi) and its peak is
    // sin^2(phi): the force is rho Q V sin(phi).
    const sin = 0.5;
    expect(
      closures.wallPressure(v, water.rho, sin, 0) / closures.wallPressure(v, water.rho, 1, 0),
    ).toBeCloseTo(sin * sin, 12);
  });

  it('puts the film jump at 41 mm (jets 4.5)', () => {
    const jump = closures.fanRadius(flow, water.rho, water.nu, closures.gammaWater(50));
    expect(jump * 1000).toBeGreaterThan(40.5);
    expect(jump * 1000).toBeLessThan(42);
    // 35 mm at 20 C.
    const cold = bindSharedClosures(params).water(20);
    expect(closures.fanRadius(flow, cold.rho, cold.nu, closures.gammaWater(20)) * 1000).toBeCloseTo(
      35,
      0,
    );
  });
});

describe('an oblique jet (jets 4.7)', () => {
  it('splits its flow forward as the dossier tabulates', () => {
    const table: [number, number][] = [
      [90, 0.5],
      [75, 0.66],
      [60, 0.8],
      [45, 0.91],
      [30, 0.97],
      [20, 0.991],
      [15, 0.996],
      [10, 0.999],
    ];
    for (const [phi, forward] of table) {
      const got = jetFlowShare(closures, Math.cos((phi * Math.PI) / 180), Math.PI / 2);
      expect(Math.abs(got - forward), `${phi} degrees`).toBeLessThan(0.005);
    }
  });

  it('conserves the flow of the jet over all azimuths', () => {
    // Integral of q over psi = pi r0^2 V, by the midpoint rule.
    for (const phi of [90, 45, 15]) {
      const sin = Math.sin((phi * Math.PI) / 180);
      const cos = Math.cos((phi * Math.PI) / 180);
      let total = 0;
      const steps = 200_000;
      for (let k = 0; k < steps; k++) {
        const psi = -Math.PI + ((k + 0.5) * 2 * Math.PI) / steps;
        total += (closures.flowPerRadian(v, d / 2, sin, cos, Math.cos(psi)) * 2 * Math.PI) / steps;
      }
      expect(total / flow, `${phi} degrees`).toBeCloseTo(1, 3);
    }
  });

  it('has the footprint ellipse of the projected jet, seen from its rear focus', () => {
    const sin = Math.sin(Math.PI / 6);
    const cos = Math.cos(Math.PI / 6);
    const r0 = d / 2;
    // Forward and backward edges: c + a and a - c, a = r0 / sin, c = r0 cot.
    expect(closures.footprintEdge(r0, sin, cos, 1)).toBeCloseTo(r0 / sin + (r0 * cos) / sin, 12);
    expect(closures.footprintEdge(r0, sin, cos, -1)).toBeCloseTo(r0 / sin - (r0 * cos) / sin, 12);
  });
});

describe('break-up and splatter (jets 3.3, 5.2, 5.6)', () => {
  it('keeps the reference jet coherent across the tub', () => {
    const length = closures.breakupLength(v, d, water.rho, water.nu, closures.gammaWater(50));
    // C_b d (sqrt(We) + 3 We / Re) with C_b = 6: about half a metre.
    const we = (water.rho * v * v * d) / closures.gammaWater(50);
    expect(length).toBeCloseTo(6 * d * (Math.sqrt(we) + (3 * we) / re), 12);
    expect(length).toBeGreaterThan(0.45);
    expect(closures.coherentFraction(0.3, length)).toBe(1);
    expect(closures.coherentFraction(0.6 * length, length)).toBe(1);
    expect(closures.coherentFraction(length, length)).toBeCloseTo(0.5, 12);
    expect(closures.coherentFraction(1.4 * length, length)).toBeCloseTo(0, 12);
    expect(closures.coherentFraction(2 * length, length)).toBe(0);
  });

  it('gives S_W = 0.18 and xi = 0.09 for the worked example of the dossier', () => {
    // "S_W = 0.18 for V d / nu_20 = 15,900, so xi = 0.09" (jets 11.4).
    const speed = (15_900 * 1e-6) / d;
    const xi = closures.splatterFraction(speed, d, 0.05, water.rho, closures.gammaWater(50), 1);
    expect(xi).toBeCloseTo(0.09, 2);
    // Reduced as sin(phi) at oblique incidence.
    expect(
      closures.splatterFraction(speed, d, 0.05, water.rho, closures.gammaWater(50), 0.5) / xi,
    ).toBeCloseTo(0.5, 12);
  });

  it('gives the pipe-jet fractions 0.10, 0.28 and 0.30 at 100, 150 and 200 mm at 20 C', () => {
    // jets 5.2, the row "d = 2 mm, 8 m/s": the Bhunia-Lienhard branch alone (k_S = 1 and the
    // Wang branch moved out of the way).
    const alone = bindJetClosures(
      createParamSet(registry, { 'jets.kS': 1, 'jets.SW.onset': 16000 }),
    );
    const cold = bindSharedClosures(params).water(20);
    const gamma = alone.gammaWater(20);
    const at = (s: number): number => alone.splatterFraction(v, d, s, cold.rho, gamma, 1);
    expect(Math.abs(at(0.1) - 0.1)).toBeLessThan(0.02);
    expect(Math.abs(at(0.15) - 0.28)).toBeLessThan(0.03);
    expect(Math.abs(at(0.2) - 0.3)).toBeLessThan(0.01);
    // The cap holds the plateau.
    expect(at(0.5)).toBeCloseTo(at(0.2), 2);
  });
});

describe('the film table', () => {
  it('interpolates the closures within 1 % away from the zone boundaries', () => {
    // The wall shear of the film model jumps where the film turns turbulent (r_t) and has a
    // corner where the boundary layer reaches the surface (r_b); within a grid cell of those
    // the table interpolates across the jump, everywhere else it follows the closures.
    const table = buildFilmTable(closures);
    let worst = 0;
    let checked = 0;
    for (let k = 0; k < 6000; k++) {
      const x = Math.exp(Math.log(0.1) + Math.log(600) * u32ToUnitFloat(hashU32(5, k, 0)));
      const r = Math.exp(Math.log(300) + Math.log(1000) * u32ToUnitFloat(hashU32(5, k, 1)));
      const boundaries = [0.24 * Math.cbrt(r), 0.2964 * Math.cbrt(r), 0.55];
      if (boundaries.some((edge) => Math.abs(Math.log(x / edge)) < 0.05)) continue;
      checked++;
      const lnX = Math.log(x);
      const lnR = Math.log(r);
      const pairs: [number, number][] = [
        [filmTableAt(table, lnX, lnR, FILM_COLUMN.thickness), closures.filmThickness(x, r)],
        [filmTableAt(table, lnX, lnR, FILM_COLUMN.speed), closures.filmSpeed(x, r)],
        [filmTableAt(table, lnX, lnR, FILM_COLUMN.shear), closures.filmShear(x, r)],
        [filmTableAt(table, lnX, lnR, FILM_COLUMN.momentum), closures.filmMomentum(x, r)],
      ];
      for (const [got, want] of pairs) worst = Math.max(worst, Math.abs(got / want - 1));
    }
    expect(checked).toBeGreaterThan(4000);
    expect(worst).toBeLessThan(0.01);
  });
});
