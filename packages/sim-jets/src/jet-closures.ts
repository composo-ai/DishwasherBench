/**
 * The closed forms of the jet stage (docs/research/jets.md sections 3 to 5 and 11.2;
 * docs/design/sim-core.md section M5, "Launch, flight, break-up", "Impingement closures" and
 * "Splatter"), each written once as an expression tree of `@spotless/sim-params`, so that the
 * f64 reference (`compileExprFn`), the compiled CPU form used by the gather (`expr-fast.ts`)
 * and a WGSL twin (`emitExprWgsl`) cannot differ. Every constant is a registered parameter
 * (`params.ts`).
 *
 *   break-up      L_b = C_b d (sqrt(We) + 3 We / Re);  f_c(s) falls linearly from 1 at w_lo L_b
 *                 to 0 at w_hi L_b
 *   splatter      xi = k_S max(xi_BL, S_W) sin(phi), eq. (5.1) to (5.4)
 *   oblique jet   q(psi) = (V r0^2 / 2) sin^3(phi) / (1 - cos(psi) cos(phi))^2,
 *                 r_e(psi) = r0 sin(phi) / (1 - cos(psi) cos(phi))            eq. (3.21), (3.22)
 *   pressure      p = (rho V^2 / 2) sin^n(phi) sech^2(a X + b X^3)             eq. (3.6), 11.2 5b
 *   stagnation    tau = k_stag c_s rho (V sin(phi))^2 Re_n^(-1/2) X            eq. (3.7a), 11.2 5c
 *   radial film   thickness, mean speed, wall shear and momentum flux in the boundary-layer,
 *                 laminar and turbulent zones of Bhagat and Wilson (2016), eq. (3.8) to (3.16)
 *   fan limit     R_j = c_R Q_eq^(3/4) (rho / (nu gamma))^(1/4)                eq. (3.17)
 *
 * The film functions are written in the similarity variables of one ray: x = r / d_eq and
 * Re_eq = V d_eq / nu, with d_eq = sqrt(8 q / V) (eq. 3.23). They return h / d_eq, U_av / V,
 * tau / (rho V^2) and M / (rho V^2 d_eq); a caller multiplies by its scales. That is what lets
 * the gather tabulate them once per spray state ({@link buildFilmTable}).
 *
 * Simplifications against sim-core M5: no transition cap on the laminar boundary layer at
 * grazing incidence (the laminar forms run on to r_b); no pre-wet (snow-plough) correction of
 * the front speed; no shed droplets along the flight. The film forms are used as written at
 * every Re_eq (their validated range ends at 32,000; they stay positive and continuous beyond
 * it, because the constants of the turbulent zone are the matching constants at r_t).
 *
 * phi is the incidence measured from the wall plane. Units: SI.
 */

import {
  compileExprFn,
  expr,
  WATER_SURFACE_TENSION,
  type ExprFn,
  type ParamSet,
} from '@spotless/sim-params';
import { compileExprFast, type FastFn } from './expr-fast.ts';

const { input: v, local: l, param: p } = expr;

/** Break-up length of a round jet, metres (jets eq. 3.1). */
export const JET_BREAKUP_LENGTH: ExprFn = expr.fn({
  name: 'jet_breakup_length',
  doc:
    'Break-up length of a round jet [m]: C_b d (sqrt(We) + 3 We / Re).\n' +
    'V [m/s], d [m], rho [kg/m3], nu [m2/s], gamma [N/m] (clean water at temperature).',
  inputs: ['V', 'd', 'rho', 'nu', 'gamma'],
  locals: [
    ['we', expr.div(expr.mul(v('rho'), v('V'), v('V'), v('d')), v('gamma'))],
    ['re', expr.div(expr.mul(v('V'), v('d')), v('nu'))],
  ],
  result: expr.mul(
    p('jets.Cb'),
    v('d'),
    expr.add(expr.sqrt(l('we')), expr.div(expr.mul(3, l('we')), l('re'))),
  ),
});

/** Share of a jet that is still a coherent column after a flight of `s` (jets eq. 3.2). */
export const JET_COHERENT_FRACTION: ExprFn = expr.fn({
  name: 'jet_coherent_fraction',
  doc: 'Coherent share of a jet after a flight s [m], for a break-up length Lb [m]; 0 to 1.',
  inputs: ['s', 'Lb'],
  result: expr.clamp(
    expr.sub(
      1,
      expr.div(
        expr.sub(v('s'), expr.mul(p('jets.breakWindowLo'), v('Lb'))),
        expr.mul(expr.sub(p('jets.breakWindowHi'), p('jets.breakWindowLo')), v('Lb')),
      ),
    ),
    0,
    1,
  ),
});

/** Splattered mass fraction of a coherent jet (jets eq. 5.1 to 5.4). */
export const JET_SPLATTER_FRACTION: ExprFn = expr.fn({
  name: 'jet_splatter_fraction',
  doc:
    'Splattered mass fraction of a coherent jet: k_S max(xi_BL, S_W) sin(phi).\n' +
    'V [m/s], d [m], s flight distance [m], rho [kg/m3], gamma [N/m], sinPhi = sin(incidence).',
  inputs: ['V', 'd', 's', 'rho', 'gamma', 'sinPhi'],
  locals: [
    ['we', expr.div(expr.mul(v('rho'), v('V'), v('V'), v('d')), v('gamma'))],
    // The exponent is limited so that the exponential stays an f32; omega is capped anyway.
    [
      'omega',
      expr.mul(
        l('we'),
        expr.exp(
          expr.min(
            expr.div(expr.mul(p('jets.omegaCoef'), expr.div(v('s'), v('d'))), expr.sqrt(l('we'))),
            16,
          ),
        ),
      ),
    ],
    ['w', expr.min(l('omega'), p('jets.xiBL.cap'))],
    [
      'xiBL',
      expr.max(
        0,
        expr.sub(
          expr.sub(expr.mul(p('jets.xiBL.c1'), l('w')), p('jets.xiBL.c0')),
          expr.mul(p('jets.xiBL.c2'), l('w'), l('w')),
        ),
      ),
    ],
    [
      'sw',
      expr.clamp(
        expr.mul(
          p('jets.SW.slope'),
          expr.sub(expr.div(expr.mul(v('V'), v('d')), p('jets.SW.nu')), p('jets.SW.onset')),
        ),
        0,
        p('jets.SW.cap'),
      ),
    ],
  ],
  result: expr.mul(p('jets.kS'), expr.max(l('xiBL'), l('sw')), v('sinPhi')),
});

/** Volume flow per radian of azimuth about the source point of an oblique jet (eq. 3.22). */
export const JET_FLOW_PER_RADIAN: ExprFn = expr.fn({
  name: 'jet_flow_per_radian',
  doc:
    'Volume flow per radian of azimuth [m3/s/rad]: (V r0^2 / 2) sin^3(phi) / (1 - cos(psi) cos(phi))^2.\n' +
    'V [m/s], r0 jet radius [m], sinPhi, cosPhi of the incidence, cosPsi of the azimuth from forward.',
  inputs: ['V', 'r0', 'sinPhi', 'cosPhi', 'cosPsi'],
  locals: [['den', expr.sub(1, expr.mul(v('cosPsi'), v('cosPhi')))]],
  result: expr.div(
    expr.mul(0.5, v('V'), v('r0'), v('r0'), v('sinPhi'), v('sinPhi'), v('sinPhi')),
    expr.mul(l('den'), l('den')),
  ),
});

/** Edge of the footprint ellipse about its rear focus (eq. 3.21). */
export const JET_FOOTPRINT_EDGE: ExprFn = expr.fn({
  name: 'jet_footprint_edge',
  doc: 'Edge of the footprint about the source point [m]: r0 sin(phi) / (1 - cos(psi) cos(phi)).',
  inputs: ['r0', 'sinPhi', 'cosPhi', 'cosPsi'],
  result: expr.div(expr.mul(v('r0'), v('sinPhi')), expr.sub(1, expr.mul(v('cosPsi'), v('cosPhi')))),
});

/**
 * Integral of d psi / (1 - c cos psi)^2 from 0 to psi, for 0 <= psi < pi and 0 <= c < 1
 * (sim-core M5, "Hand-over"): the flow of an oblique jet between two azimuths, up to the
 * factor (V r0^2 / 2) sin^3(phi).
 */
export const JET_FLOW_INTEGRAL: ExprFn = expr.fn({
  name: 'jet_flow_integral',
  doc: 'Integral of d psi / (1 - c cos psi)^2 from 0 to psi [rad], 0 <= psi < pi, c = cos(phi) < 1.',
  inputs: ['c', 'psi'],
  locals: [['k', expr.sub(1, expr.mul(v('c'), v('c')))]],
  result: expr.add(
    expr.div(
      expr.mul(v('c'), expr.sin(v('psi'))),
      expr.mul(l('k'), expr.sub(1, expr.mul(v('c'), expr.cos(v('psi'))))),
    ),
    expr.div(
      expr.mul(
        2,
        expr.atan(
          expr.mul(
            expr.sqrt(expr.div(expr.add(1, v('c')), expr.sub(1, v('c')))),
            expr.tan(expr.mul(0.5, v('psi'))),
          ),
        ),
      ),
      expr.mul(l('k'), expr.sqrt(l('k'))),
    ),
  ),
});

/** Wall pressure under an oblique jet (jets eq. 3.6 and 11.2 step 5b). */
export const JET_WALL_PRESSURE: ExprFn = expr.fn({
  name: 'jet_wall_pressure',
  doc:
    'Wall pressure above ambient [Pa]: (rho V^2 / 2) sin^n(phi) sech^2(a X + b X^3).\n' +
    'V [m/s], rho [kg/m3], sinPhi, X = sqrt((x_f sin(phi))^2 + x_l^2) / d from the jet axis.',
  inputs: ['V', 'rho', 'sinPhi', 'X'],
  locals: [
    [
      'y',
      expr.min(
        expr.add(
          expr.mul(p('jets.pressureA'), v('X')),
          expr.mul(p('jets.pressureB'), v('X'), v('X'), v('X')),
        ),
        16,
      ),
    ],
    ['e', expr.exp(expr.neg(l('y')))],
    ['sech', expr.div(expr.mul(2, l('e')), expr.add(1, expr.mul(l('e'), l('e'))))],
  ],
  result: expr.mul(
    0.5,
    v('rho'),
    v('V'),
    v('V'),
    expr.pow(v('sinPhi'), p('jets.pressureIncidenceExponent')),
    l('sech'),
    l('sech'),
  ),
});

/** Wall shear of the stagnation zone of an oblique jet (jets eq. 3.7a and 11.2 step 5c). */
export const JET_STAG_SHEAR: ExprFn = expr.fn({
  name: 'jet_stag_shear',
  doc:
    'Stagnation-zone wall shear [Pa]: k_stag c_s rho (V sin(phi))^2 Re_n^(-1/2) X, Re_n = V sin(phi) d / nu.\n' +
    'V [m/s], d [m], rho [kg/m3], nu [m2/s], sinPhi > 0, X as in jet_wall_pressure.',
  inputs: ['V', 'd', 'rho', 'nu', 'sinPhi', 'X'],
  locals: [
    ['vn', expr.mul(v('V'), v('sinPhi'))],
    ['ren', expr.div(expr.mul(l('vn'), v('d')), v('nu'))],
  ],
  result: expr.div(
    expr.mul(p('jets.kStag'), p('jets.stagShear'), v('rho'), l('vn'), l('vn'), v('X')),
    expr.sqrt(l('ren')),
  ),
});

const X_BL = expr.mul(p('jets.blZone'), expr.pow(v('re'), expr.div(1, 3)));
const X_TURB = expr.mul(p('jets.turbZone'), expr.pow(v('re'), expr.div(1, 3)));
const SQRT_RE = expr.sqrt(v('re'));

/** Thickness of the radial film over d_eq (jets eq. 3.8, 3.11, 3.14). */
export const JET_FILM_THICKNESS: ExprFn = expr.fn({
  name: 'jet_film_thickness',
  doc: 'Radial film thickness over d_eq, at x = r / d_eq > 0 and re = V d_eq / nu.',
  inputs: ['x', 're'],
  locals: [
    [
      'hBl',
      expr.add(
        expr.div(p('jets.filmThicknessA'), v('x')),
        expr.div(expr.mul(p('jets.filmThicknessB'), expr.sqrt(v('x'))), expr.sqrt(v('re'))),
      ),
    ],
    [
      'hLam',
      expr.add(
        expr.div(expr.mul(p('jets.lamThicknessA'), v('x'), v('x')), v('re')),
        expr.div(p('jets.lamThicknessB'), v('x')),
      ),
    ],
    [
      'hTurb',
      expr.add(
        expr.mul(
          p('jets.turbThicknessA'),
          expr.pow(v('re'), expr.neg(0.25)),
          expr.pow(v('x'), expr.div(5, 4)),
        ),
        expr.div(
          expr.sub(p('jets.turbThicknessB'), expr.mul(p('jets.turbThicknessC'), SQRT_RE)),
          v('x'),
        ),
      ),
    ],
  ],
  result: expr.select(
    'lt',
    v('x'),
    X_BL,
    l('hBl'),
    expr.select('lt', v('x'), X_TURB, l('hLam'), l('hTurb')),
  ),
});

/** Mean speed of the radial film over the jet speed (jets eq. 3.8, 3.11, 3.13). */
export const JET_FILM_SPEED: ExprFn = expr.fn({
  name: 'jet_film_speed',
  doc: 'Mean speed of the radial film over V, at x = r / d_eq > 0 and re = V d_eq / nu.',
  inputs: ['x', 're'],
  locals: [
    ['uFilm', expr.div(1, expr.mul(8, v('x'), expr.call(JET_FILM_THICKNESS, v('x'), v('re'))))],
    [
      'uTurb',
      expr.div(
        1,
        expr.add(
          expr.mul(
            p('jets.turbSpeedA'),
            expr.pow(v('re'), expr.neg(0.25)),
            expr.pow(v('x'), expr.div(9, 4)),
          ),
          expr.sub(p('jets.turbSpeedB'), expr.mul(p('jets.turbSpeedC'), SQRT_RE)),
        ),
      ),
    ],
  ],
  result: expr.select('lt', v('x'), X_TURB, l('uFilm'), l('uTurb')),
});

/** Wall shear of the radial film over rho V^2 (jets eq. 3.10, [75], 3.15), with `jets.kFilm`. */
export const JET_FILM_SHEAR: ExprFn = expr.fn({
  name: 'jet_film_shear',
  doc: 'Wall shear of the radial film over rho V^2, at x = r / d_eq > 0 and re = V d_eq / nu.',
  inputs: ['x', 're'],
  locals: [
    ['h', expr.call(JET_FILM_THICKNESS, v('x'), v('re'))],
    ['u', expr.call(JET_FILM_SPEED, v('x'), v('re'))],
    ['tBl', expr.div(p('jets.filmShear'), expr.sqrt(expr.mul(v('re'), v('x'))))],
    ['tLam', expr.div(1, expr.mul(4, v('re'), v('x'), l('h'), l('h')))],
    [
      'tTurb',
      expr.mul(
        p('jets.turbShear'),
        expr.pow(v('re'), expr.neg(0.25)),
        l('u'),
        l('u'),
        expr.pow(v('x'), 0.25),
      ),
    ],
  ],
  result: expr.mul(
    p('jets.kFilm'),
    expr.select(
      'lt',
      v('x'),
      X_BL,
      l('tBl'),
      expr.select('lt', v('x'), X_TURB, l('tLam'), l('tTurb')),
    ),
  ),
});

const FILM_MOMENTUM_RAW: ExprFn = expr.fn({
  name: 'jet_film_momentum_raw',
  doc: 'Momentum flux of the radial film over rho V^2 d_eq, without the ramp of the stagnation zone.',
  inputs: ['x', 're'],
  locals: [
    ['h', expr.call(JET_FILM_THICKNESS, v('x'), v('re'))],
    ['u', expr.call(JET_FILM_SPEED, v('x'), v('re'))],
  ],
  result: expr.mul(
    expr.select('lt', v('x'), X_TURB, p('jets.cMlam'), p('jets.cMturb')),
    l('u'),
    l('u'),
    l('h'),
  ),
});

/**
 * Momentum flux of the radial film per unit width over rho V^2 d_eq (sim-core M5: c_M rho
 * U_av^2 h, with a linear ramp from 0 on the axis to the film value at `jets.stagRadius`).
 */
export const JET_FILM_MOMENTUM: ExprFn = expr.fn({
  name: 'jet_film_momentum',
  doc: 'Momentum flux of the radial film over rho V^2 d_eq, at x = r / d_eq >= 0 and re = V d_eq / nu.',
  inputs: ['x', 're'],
  result: expr.select(
    'lt',
    v('x'),
    p('jets.stagRadius'),
    expr.mul(
      expr.div(v('x'), p('jets.stagRadius')),
      expr.call(FILM_MOMENTUM_RAW, p('jets.stagRadius'), v('re')),
    ),
    expr.call(FILM_MOMENTUM_RAW, expr.max(v('x'), p('jets.stagRadius')), v('re')),
  ),
});

/** Radius of the fast radial film (the film jump), metres (jets eq. 3.17). */
export const JET_FAN_RADIUS: ExprFn = expr.fn({
  name: 'jet_fan_radius',
  doc:
    'Radius of the fast radial film [m]: c_R Q_eq^(3/4) (rho / (nu gamma))^(1/4).\n' +
    'Qeq [m3/s] (2 pi q (1 - xi) on a ray), rho [kg/m3], nu [m2/s], gamma [N/m] of clean water.',
  inputs: ['Qeq', 'rho', 'nu', 'gamma'],
  result: expr.mul(
    p('jets.cR'),
    expr.pow(v('Qeq'), expr.div(3, 4)),
    expr.pow(expr.div(v('rho'), expr.mul(v('nu'), v('gamma'), p('jets.gammaFactor'))), 0.25),
  ),
});

/** Every closure function of the jet stage, for emitting them together. */
export const JET_CLOSURE_FNS: readonly ExprFn[] = [
  JET_BREAKUP_LENGTH,
  JET_COHERENT_FRACTION,
  JET_SPLATTER_FRACTION,
  JET_FLOW_PER_RADIAN,
  JET_FOOTPRINT_EDGE,
  JET_FLOW_INTEGRAL,
  JET_WALL_PRESSURE,
  JET_STAG_SHEAR,
  JET_FILM_THICKNESS,
  JET_FILM_SPEED,
  JET_FILM_SHEAR,
  JET_FILM_MOMENTUM,
  JET_FAN_RADIUS,
];

/** The closures of the jet stage bound to one parameter set, in their compiled CPU form. */
export interface JetClosures {
  /** L_b [m] of (V, d, rho, nu, gamma). */
  readonly breakupLength: FastFn;
  /** f_c of (s, Lb). */
  readonly coherentFraction: FastFn;
  /** xi of (V, d, s, rho, gamma, sinPhi). */
  readonly splatterFraction: FastFn;
  /** q [m3/s/rad] of (V, r0, sinPhi, cosPhi, cosPsi). */
  readonly flowPerRadian: FastFn;
  /** r_e [m] of (r0, sinPhi, cosPhi, cosPsi). */
  readonly footprintEdge: FastFn;
  /** Integral of d psi / (1 - c cos psi)^2 from 0 to psi, of (c, psi), for 0 <= psi <= pi. */
  readonly flowIntegral: (c: number, psi: number) => number;
  /** p [Pa] of (V, rho, sinPhi, X). */
  readonly wallPressure: FastFn;
  /** tau [Pa] of (V, d, rho, nu, sinPhi, X). */
  readonly stagShear: FastFn;
  /** h / d_eq, U / V, tau / (rho V^2), M / (rho V^2 d_eq) of (x, re). */
  readonly filmThickness: FastFn;
  readonly filmSpeed: FastFn;
  readonly filmShear: FastFn;
  readonly filmMomentum: FastFn;
  /** R_j [m] of (Qeq, rho, nu, gamma). */
  readonly fanRadius: FastFn;
  /** Surface tension of clean water [N/m] at a temperature in degrees Celsius. */
  readonly gammaWater: (tC: number) => number;
}

function must(fns: Readonly<Record<string, FastFn>>, fn: ExprFn): FastFn {
  const found = fns[fn.name];
  if (found === undefined) throw new Error(`jet closures: ${fn.name} was not compiled`);
  return found;
}

/**
 * Compiles the closures of the jet stage against a parameter set built on a registry that
 * holds `JETS_PARAM_DEFS` and `SHARED_PARAM_DEFS`.
 */
export function bindJetClosures(params: ParamSet): JetClosures {
  const fns = compileExprFast(JET_CLOSURE_FNS, params);
  const integral = must(fns, JET_FLOW_INTEGRAL);
  return {
    breakupLength: must(fns, JET_BREAKUP_LENGTH),
    coherentFraction: must(fns, JET_COHERENT_FRACTION),
    splatterFraction: must(fns, JET_SPLATTER_FRACTION),
    flowPerRadian: must(fns, JET_FLOW_PER_RADIAN),
    footprintEdge: must(fns, JET_FOOTPRINT_EDGE),
    flowIntegral: (c, psi) => {
      // At psi = pi the tangent is infinite and the arctangent a quarter turn.
      const k = 1 - c * c;
      return psi >= Math.PI ? Math.PI / (k * Math.sqrt(k)) : integral(c, psi);
    },
    wallPressure: must(fns, JET_WALL_PRESSURE),
    stagShear: must(fns, JET_STAG_SHEAR),
    filmThickness: must(fns, JET_FILM_THICKNESS),
    filmSpeed: must(fns, JET_FILM_SPEED),
    filmShear: must(fns, JET_FILM_SHEAR),
    filmMomentum: must(fns, JET_FILM_MOMENTUM),
    fanRadius: must(fns, JET_FAN_RADIUS),
    gammaWater: compileExprFn(WATER_SURFACE_TENSION, params),
  };
}

/**
 * Share of the flow of an oblique jet that leaves within `halfAngle` (radians, 0 to pi) of the
 * forward direction: the forward fraction of jets section 4.7 for `halfAngle` = pi / 2.
 */
export function jetFlowShare(closures: JetClosures, cosPhi: number, halfAngle: number): number {
  return closures.flowIntegral(cosPhi, halfAngle) / closures.flowIntegral(cosPhi, Math.PI);
}

/** The arithmetic of the film table (not physical quantities). */
export const FILM_TABLE_NUMERICS = {
  /** Range of x = r / d_eq and of Re_eq the table spans; values outside are clamped. */
  xMin: 0.05,
  xMax: 200,
  reMin: 30,
  reMax: 3e6,
  /** Nodes along ln(x) and ln(Re_eq). */
  xNodes: 768,
  reNodes: 192,
} as const;

/**
 * The radial-film closures on a grid of (ln x, ln Re_eq), for interpolation in the gather: four
 * values per node (h / d_eq, U / V, tau / (rho V^2), M / (rho V^2 d_eq)). The grid is fine
 * enough that bilinear interpolation differs from the closures by less than 0.1 % inside a
 * zone and by less than 1 % at the zone boundaries, where the closures have corners.
 */
export interface FilmTable {
  readonly lnXMin: number;
  readonly lnReMin: number;
  readonly invDx: number;
  readonly invDre: number;
  readonly xNodes: number;
  readonly reNodes: number;
  /** The four values, 4 per node, row-major in (re, x). */
  readonly values: Float64Array;
}

/** Tabulates the radial-film closures of a parameter set. */
export function buildFilmTable(closures: JetClosures): FilmTable {
  const n = FILM_TABLE_NUMERICS;
  const lnXMin = Math.log(n.xMin);
  const lnReMin = Math.log(n.reMin);
  const dx = (Math.log(n.xMax) - lnXMin) / (n.xNodes - 1);
  const dre = (Math.log(n.reMax) - lnReMin) / (n.reNodes - 1);
  const values = new Float64Array(4 * n.xNodes * n.reNodes);
  for (let j = 0; j < n.reNodes; j++) {
    const re = Math.exp(lnReMin + j * dre);
    for (let i = 0; i < n.xNodes; i++) {
      const x = Math.exp(lnXMin + i * dx);
      const o = 4 * (j * n.xNodes + i);
      values[o] = closures.filmThickness(x, re);
      values[o + 1] = closures.filmSpeed(x, re);
      values[o + 2] = closures.filmShear(x, re);
      values[o + 3] = closures.filmMomentum(x, re);
    }
  }
  return {
    lnXMin,
    lnReMin,
    invDx: 1 / dx,
    invDre: 1 / dre,
    xNodes: n.xNodes,
    reNodes: n.reNodes,
    values,
  };
}

/** Column of a {@link FilmTable}: h / d_eq, U_av / V, tau / (rho V^2), M / (rho V^2 d_eq). */
export const FILM_COLUMN = { thickness: 0, speed: 1, shear: 2, momentum: 3 } as const;

/**
 * Interpolates one column of the film table (`FILM_COLUMN`) at (ln x, ln Re_eq); arguments
 * outside the table are clamped to its edge.
 */
export function filmTableAt(table: FilmTable, lnX: number, lnRe: number, column: number): number {
  let fx = (lnX - table.lnXMin) * table.invDx;
  let fr = (lnRe - table.lnReMin) * table.invDre;
  if (!(fx > 0)) fx = 0;
  else if (fx > table.xNodes - 1) fx = table.xNodes - 1;
  if (!(fr > 0)) fr = 0;
  else if (fr > table.reNodes - 1) fr = table.reNodes - 1;
  let i = Math.floor(fx);
  let j = Math.floor(fr);
  if (i > table.xNodes - 2) i = table.xNodes - 2;
  if (j > table.reNodes - 2) j = table.reNodes - 2;
  const a = fx - i;
  const b = fr - j;
  const o = 4 * (j * table.xNodes + i) + column;
  const row = 4 * table.xNodes;
  const t = table.values;
  return (
    (1 - b) * ((1 - a) * (t[o] as number) + a * (t[o + 4] as number)) +
    b * ((1 - a) * (t[o + row] as number) + a * (t[o + row + 4] as number))
  );
}
