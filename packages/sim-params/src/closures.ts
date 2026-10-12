/**
 * The shared closure functions that module M2 itself defines (docs/design/sim-core.md section
 * M2, "Shared closure functions" and "One wetting threshold"), each written once as an
 * expression tree (`expr.ts`) so that the f64 evaluator and the WGSL twin cannot differ:
 *
 *  - the properties of water against temperature (films dossier section 2.1);
 *  - the wetting thresholds delta*_a, delta_wet, b_max and m_on, used by the cascade K, by the
 *    solver S and by the onset gate of the timeline (M10).
 *
 * `SHARED_PARAM_DEFS` is this package's contribution to the registry: the coefficients of the
 * correlations, standard gravity, and the four parameters of the wetting threshold. The film
 * module must not declare `film.kappaW`, `film.nBeta`, `film.Cb` or `film.sinBetaFloor` again
 * (a duplicate key is rejected).
 *
 * Units: SI. Temperatures are in degrees Celsius (platform.md section 2). Angles are in radians.
 * The surface tilt enters as sin(beta), beta being the tilt from horizontal (section 0).
 */
import { KELVIN_OFFSET, STANDARD_GRAVITY } from '@spotless/core';
import { compileExprFn, expr, type ExprFn } from './expr.ts';
import type { ParamSet } from './param-set.ts';
import type { AnyParamDef, ParamDef } from './types.ts';

const WATER_SOURCE = 'films 2.1 [S41]';
const WATER_VALIDITY = '0 to 100 degrees Celsius at atmospheric pressure';

function fixed(key: string, unit: string, value: number, source: string): ParamDef {
  return {
    key,
    unit,
    default: value,
    min: value,
    max: value,
    tag: 'RECALLED',
    source,
    validity: WATER_VALIDITY,
    group: 'hydro',
  };
}

/** Coefficients a0 to a5 of the numerator of Kell's density fit, in powers of degrees Celsius. */
const KELL_NUMERATOR: readonly number[] = [
  999.83952, 16.945176, -7.9870401e-3, -46.170461e-6, 105.56302e-9, -280.54253e-12,
];

/**
 * The registry content of this package: fixed physical constants, the coefficients of the water
 * correlations (fixed: they are property data, not fitted), and the parameters of the wetting
 * threshold of section M2 with the defaults and ranges of the table in M7.9.
 */
export const SHARED_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'phys.gravity',
    unit: 'm/s2',
    default: STANDARD_GRAVITY,
    min: STANDARD_GRAVITY,
    max: STANDARD_GRAVITY,
    tag: 'VERIFIED',
    source: 'platform.md section 2 (standard gravity); sim-core section 0',
    group: 'hydro',
  },
  {
    key: 'phys.kelvinOffset',
    unit: 'K',
    default: KELVIN_OFFSET,
    min: KELVIN_OFFSET,
    max: KELVIN_OFFSET,
    tag: 'VERIFIED',
    source: 'definition of the Celsius scale',
    group: 'hydro',
  },
  ...KELL_NUMERATOR.map((value, i) =>
    fixed(
      `water.rho.a${i}`,
      i === 0 ? 'kg/m3' : `kg/m3/degC^${i}`,
      value,
      `${WATER_SOURCE}, Kell (1975)`,
    ),
  ),
  fixed('water.rho.b1', '1/degC', 16.87985e-3, `${WATER_SOURCE}, Kell (1975)`),
  fixed('water.mu.A', 'Pa s', 2.414e-5, `${WATER_SOURCE}, Vogel-type fit`),
  fixed('water.mu.B', 'K', 247.8, `${WATER_SOURCE}, Vogel-type fit`),
  fixed('water.mu.C', 'K', 140, `${WATER_SOURCE}, Vogel-type fit`),
  fixed('water.sigma.B', 'N/m', 0.2358, `${WATER_SOURCE}, IAPWS 1994`),
  fixed('water.sigma.mu', '1', 1.256, `${WATER_SOURCE}, IAPWS 1994`),
  fixed('water.sigma.b', '1', 0.625, `${WATER_SOURCE}, IAPWS 1994`),
  fixed('water.sigma.Tc', 'K', 647.096, `${WATER_SOURCE}, IAPWS 1994`),
  {
    key: 'film.kappaW',
    unit: '1',
    default: 0.5,
    min: 0.3,
    max: 1,
    tag: 'VERIFIED',
    source: 'sim-core M2, M7.9; films 12.4, 12.10',
    validity: 'practice for spray-wetted cells (half the Hartley-Murgatroyd thickness)',
    group: 'hydro',
    calibration: 'wetting',
  },
  {
    key: 'film.nBeta',
    unit: '1',
    default: 0,
    min: 0,
    max: 1,
    tag: 'SYN',
    source: 'sim-core M2, M7.9, appendix A row 9; films 12.4, 12.10',
    validity: '0 (acrylic data: same transition at 5 and 90 degrees) or 1 (tilt-scaled form)',
    group: 'hydro',
  },
  {
    key: 'film.Cb',
    unit: '1',
    default: 0.03,
    min: 0.01,
    max: 0.06,
    tag: 'ESTIMATED',
    source: 'sim-core M2, M7.9; films 12.4',
    group: 'hydro',
    calibration: 'wetting',
  },
  {
    key: 'film.sinBetaFloor',
    unit: '1',
    default: 0.1,
    min: 0.05,
    max: 0.2,
    tag: 'SYN',
    source: 'sim-core M2: the 0.1 of max(sin(beta), 0.1) in the wetting threshold',
    group: 'hydro',
  },
];

const { input, local, param } = expr;

/** Density of water, kg/m3, against temperature in degrees Celsius (Kell 1975; films 2.1). */
export const WATER_DENSITY: ExprFn = expr.fn({
  name: 'water_density',
  doc: 'Density of water [kg/m3] at tC [degrees Celsius], Kell (1975).',
  inputs: ['tC'],
  // Horner form of the fifth-order numerator.
  result: expr.div(
    [4, 3, 2, 1, 0].reduce(
      (acc, i) => expr.add(expr.mul(acc, input('tC')), param(`water.rho.a${i}`)),
      param('water.rho.a5'),
    ),
    expr.add(1, expr.mul(param('water.rho.b1'), input('tC'))),
  ),
});

/** Dynamic viscosity of water, Pa s, against temperature in degrees Celsius (Vogel-type fit). */
export const WATER_VISCOSITY: ExprFn = expr.fn({
  name: 'water_viscosity',
  doc: 'Dynamic viscosity of water [Pa s] at tC [degrees Celsius], Vogel-type fit.',
  inputs: ['tC'],
  result: expr.mul(
    param('water.mu.A'),
    expr.pow(
      10,
      expr.div(
        param('water.mu.B'),
        expr.sub(expr.add(input('tC'), param('phys.kelvinOffset')), param('water.mu.C')),
      ),
    ),
  ),
});

/**
 * Surface tension of clean water (gamma_w of section 0), N/m, against temperature in degrees
 * Celsius (IAPWS 1994). Not the surface tension of a liquor, which is `film.sigma` per class.
 */
export const WATER_SURFACE_TENSION: ExprFn = expr.fn({
  name: 'water_surface_tension',
  doc: 'Surface tension of clean water [N/m] at tC [degrees Celsius], IAPWS 1994.',
  inputs: ['tC'],
  locals: [
    [
      'tau',
      expr.sub(
        1,
        expr.div(expr.add(input('tC'), param('phys.kelvinOffset')), param('water.sigma.Tc')),
      ),
    ],
  ],
  result: expr.mul(
    param('water.sigma.B'),
    expr.pow(local('tau'), param('water.sigma.mu')),
    expr.sub(1, expr.mul(param('water.sigma.b'), local('tau'))),
  ),
});

/** Kinematic viscosity of water, m2/s, against temperature in degrees Celsius: mu / rho. */
export const WATER_KINEMATIC_VISCOSITY: ExprFn = expr.fn({
  name: 'water_kinematic_viscosity',
  doc: 'Kinematic viscosity of water [m2/s] at tC [degrees Celsius].',
  inputs: ['tC'],
  result: expr.div(expr.call(WATER_VISCOSITY, input('tC')), expr.call(WATER_DENSITY, input('tC'))),
});

/** Capillary length l_c = sqrt(sigma / (rho g)), m, from sigma in N/m and rho in kg/m3. */
export const CAPILLARY_LENGTH: ExprFn = expr.fn({
  name: 'capillary_length',
  doc: 'Capillary length [m] from surface tension sigma [N/m] and density rho [kg/m3].',
  inputs: ['sigma', 'rho'],
  result: expr.sqrt(expr.div(input('sigma'), expr.mul(input('rho'), param('phys.gravity')))),
});

/**
 * Effective gravity of the wetting threshold, m/s2: g_e = g max(sin(beta), floor)^n_beta
 * (section M2). With the default `film.nBeta` = 0 it is g at every tilt.
 */
export const WETTING_EFFECTIVE_GRAVITY: ExprFn = expr.fn({
  name: 'wetting_effective_gravity',
  doc: 'Effective gravity of the wetting threshold [m/s2] from sinBeta = sin(tilt from horizontal).',
  inputs: ['sinBeta'],
  result: expr.mul(
    param('phys.gravity'),
    expr.pow(expr.max(input('sinBeta'), param('film.sinBetaFloor')), param('film.nBeta')),
  ),
});

const WETTING_INPUTS = ['mu', 'sigma', 'rho', 'thetaA', 'sinBeta'] as const;

/**
 * Hartley-Murgatroyd thickness at the advancing angle, m (section M2):
 * delta*_a = [15 mu^2 sigma (1 - cos(theta_a)) / (rho^3 g_e^2)]^(1/5).
 * Inputs: mu Pa s, sigma N/m, rho kg/m3, thetaA radians (0 to pi), sinBeta dimensionless.
 * 1 - cos(theta) is evaluated as 2 sin^2(theta / 2), which keeps its precision in f32 at the
 * small angles of glass and glaze.
 */
export const WETTING_DELTA_STAR: ExprFn = expr.fn({
  name: 'wetting_delta_star',
  doc:
    'Hartley-Murgatroyd thickness at the advancing angle [m].\n' +
    'mu [Pa s], sigma [N/m], rho [kg/m3], thetaA [rad], sinBeta = sin(tilt from horizontal).',
  inputs: WETTING_INPUTS,
  locals: [
    ['ge', expr.call(WETTING_EFFECTIVE_GRAVITY, input('sinBeta'))],
    ['sinHalf', expr.sin(expr.mul(0.5, input('thetaA')))],
    ['oneMinusCos', expr.mul(2, local('sinHalf'), local('sinHalf'))],
  ],
  result: expr.pow(
    expr.div(
      expr.mul(15, input('mu'), input('mu'), input('sigma'), local('oneMinusCos')),
      expr.mul(input('rho'), input('rho'), input('rho'), local('ge'), local('ge')),
    ),
    expr.div(1, 5),
  ),
});

/**
 * Thickness at which spray-collected liquid forms a film, m: delta_wet = kappa_w delta*_a
 * (section M2). Inputs as {@link WETTING_DELTA_STAR}.
 */
export const WETTING_DELTA_WET: ExprFn = expr.fn({
  name: 'wetting_delta_wet',
  doc: 'Thickness at which spray-collected liquid forms a film [m]; inputs as wetting_delta_star.',
  inputs: WETTING_INPUTS,
  result: expr.mul(
    param('film.kappaW'),
    expr.call(WETTING_DELTA_STAR, ...WETTING_INPUTS.map((n) => input(n))),
  ),
});

/**
 * Largest immobile bead load as an equivalent thickness, m (section M2):
 * b_max = C_b l_c (cos(theta_r) - cos(theta_a)) / max(sin(beta), floor).
 * Inputs: sigma N/m, rho kg/m3, thetaA and thetaR radians (0 to pi), sinBeta.
 *
 * The hysteresis theta_a - theta_r is limited below at zero, which the contract's formula does
 * not do: with thetaR above thetaA (possible when per-block contact-angle offsets are applied
 * to the two angles independently) the result is 0, not a negative load, and the onset mass is
 * then 0, meaning a surface without hysteresis holds no immobile bead. For thetaR <= thetaA the
 * value is the contract's.
 */
export const WETTING_B_MAX: ExprFn = expr.fn({
  name: 'wetting_b_max',
  doc:
    'Largest immobile bead load as an equivalent thickness [m].\n' +
    'sigma [N/m], rho [kg/m3], thetaA and thetaR [rad], sinBeta = sin(tilt from horizontal).',
  inputs: ['sigma', 'rho', 'thetaA', 'thetaR', 'sinBeta'],
  result: expr.div(
    expr.mul(
      param('film.Cb'),
      expr.call(CAPILLARY_LENGTH, input('sigma'), input('rho')),
      // cos(theta_r) - cos(theta_a) as a product of sines, which keeps its precision in f32
      // when the two angles are close or small.
      expr.mul(
        2,
        expr.sin(expr.mul(0.5, expr.add(input('thetaA'), input('thetaR')))),
        expr.sin(expr.mul(0.5, expr.max(expr.sub(input('thetaA'), input('thetaR')), 0))),
      ),
    ),
    expr.max(input('sinBeta'), param('film.sinBetaFloor')),
  ),
});

/**
 * Onset mass per area, kg/m2 (section M2): m_on = rho min(delta_wet, b_max), the smaller of the
 * two routes to a film. Inputs: mu Pa s, sigma N/m, rho kg/m3, thetaA and thetaR radians,
 * sinBeta. Never negative: see {@link WETTING_B_MAX} for thetaR above thetaA.
 */
export const WETTING_ONSET_MASS: ExprFn = expr.fn({
  name: 'wetting_onset_mass',
  doc:
    'Onset mass per area [kg/m2]: rho min(delta_wet, b_max).\n' +
    'mu [Pa s], sigma [N/m], rho [kg/m3], thetaA and thetaR [rad], sinBeta = sin(tilt from horizontal).',
  inputs: ['mu', 'sigma', 'rho', 'thetaA', 'thetaR', 'sinBeta'],
  result: expr.mul(
    input('rho'),
    expr.min(
      expr.call(WETTING_DELTA_WET, ...WETTING_INPUTS.map((n) => input(n))),
      expr.call(
        WETTING_B_MAX,
        input('sigma'),
        input('rho'),
        input('thetaA'),
        input('thetaR'),
        input('sinBeta'),
      ),
    ),
  ),
});

/** Every closure function this package defines, for emitting them together. */
export const SHARED_CLOSURE_FNS: readonly ExprFn[] = [
  WATER_DENSITY,
  WATER_VISCOSITY,
  WATER_SURFACE_TENSION,
  WATER_KINEMATIC_VISCOSITY,
  CAPILLARY_LENGTH,
  WETTING_EFFECTIVE_GRAVITY,
  WETTING_DELTA_STAR,
  WETTING_DELTA_WET,
  WETTING_B_MAX,
  WETTING_ONSET_MASS,
];

/** Water properties at one temperature, SI. */
export interface WaterProperties {
  /** Density, kg/m3. */
  readonly rho: number;
  /** Dynamic viscosity, Pa s. */
  readonly mu: number;
  /** Kinematic viscosity, m2/s. */
  readonly nu: number;
  /** Surface tension of clean water, N/m. */
  readonly gammaW: number;
}

/** The f64 evaluators of the shared closure functions, bound to one parameter set. */
export interface SharedClosures {
  /** Density of water, kg/m3, at a temperature in degrees Celsius. */
  waterDensity(tC: number): number;
  /** Dynamic viscosity of water, Pa s, at a temperature in degrees Celsius. */
  waterViscosity(tC: number): number;
  /** Surface tension of clean water, N/m, at a temperature in degrees Celsius. */
  waterSurfaceTension(tC: number): number;
  /** Density, viscosities and surface tension of water at a temperature in degrees Celsius. */
  water(tC: number): WaterProperties;
  /** Capillary length, m, from sigma in N/m and rho in kg/m3. */
  capillaryLength(sigma: number, rho: number): number;
  /** delta*_a, m. Arguments: mu Pa s, sigma N/m, rho kg/m3, thetaA rad, sin(beta). */
  deltaStar(mu: number, sigma: number, rho: number, thetaA: number, sinBeta: number): number;
  /** delta_wet, m. Arguments as {@link SharedClosures.deltaStar}. */
  deltaWet(mu: number, sigma: number, rho: number, thetaA: number, sinBeta: number): number;
  /** b_max, m. Arguments: sigma N/m, rho kg/m3, thetaA rad, thetaR rad, sin(beta). */
  bMax(sigma: number, rho: number, thetaA: number, thetaR: number, sinBeta: number): number;
  /** m_on, kg/m2. Arguments: mu Pa s, sigma N/m, rho kg/m3, thetaA rad, thetaR rad, sin(beta). */
  onsetMass(
    mu: number,
    sigma: number,
    rho: number,
    thetaA: number,
    thetaR: number,
    sinBeta: number,
  ): number;
}

/**
 * Binds the shared closure functions to a parameter set: the CPU reference of the WGSL twins
 * and the functions CPU callers (hydraulics, timeline, verification) use.
 */
export function bindSharedClosures(params: ParamSet): SharedClosures {
  const waterDensity = compileExprFn(WATER_DENSITY, params);
  const waterViscosity = compileExprFn(WATER_VISCOSITY, params);
  const waterSurfaceTension = compileExprFn(WATER_SURFACE_TENSION, params);
  return {
    waterDensity,
    waterViscosity,
    waterSurfaceTension,
    water: (tC) => {
      const rho = waterDensity(tC);
      const mu = waterViscosity(tC);
      return { rho, mu, nu: mu / rho, gammaW: waterSurfaceTension(tC) };
    },
    capillaryLength: compileExprFn(CAPILLARY_LENGTH, params),
    deltaStar: compileExprFn(WETTING_DELTA_STAR, params),
    deltaWet: compileExprFn(WETTING_DELTA_WET, params),
    bMax: compileExprFn(WETTING_B_MAX, params),
    onsetMass: compileExprFn(WETTING_ONSET_MASS, params),
  };
}
