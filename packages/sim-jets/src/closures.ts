/**
 * Closed forms of a coherent round jet striking a wall (docs/research/jets.md sections 4.2 to
 * 4.4): wall pressure, wall shear and the momentum flux of the radial film at a distance from
 * the stagnation point. Pure functions of the registered constants (`params.ts`), of the
 * liquid and of the jet.
 *
 *   pressure   p(r) = (rho V^2 / 2) sin^n(phi) sech^2(a x + b x^3),                x = r / d
 *   shear      tau = min( k_stag c_s rho V_n^2 Re_n^(-1/2) x,       V_n = V sin(phi), Re_n = V_n d / nu
 *                         k_film c_f rho V^2 Re^(-1/2) x^(-1/2) ),   Re = V d / nu
 *              the stagnation branch inside, the radial-film branch outside; they meet at
 *              x = 0.552 for a jet at normal incidence, where tau = 0.635 rho V^2 Re^(-1/2)
 *   film       h / d = A / x + B Re^(-1/2) x^(1/2),   U = V / (8 x (h / d)),   M = rho U^2 h
 *              evaluated at max(x, x0)
 *
 * phi is the incidence measured from the wall plane, so sin(phi) is the cosine of the angle
 * between the jet and the inward normal. Validity (jets 4.4): incidence 30 to 120 degrees and
 * Re up to 32,000 for the film; r up to 0.24 Re^(1/3) d (about 7 d). Used beyond that, at
 * grazing incidence and for 3 to 4 mm jets, the forms are extrapolations.
 *
 * Units: SI (Pa, N/m, m, m/s, kg/m3, m2/s).
 */

import type { JetParams } from './params.ts';

/** What a jet does to the wall at one distance from its stagnation point. */
export interface JetImpact {
  /** Wall pressure above ambient, Pa. */
  pressure: number;
  /** Wall shear stress, Pa. */
  shear: number;
  /** Momentum flux of the radial film per unit width, N/m. */
  momentum: number;
  /** Thickness of the radial film, metres. */
  thickness: number;
}

/** A fresh {@link JetImpact}. */
export function createJetImpact(): JetImpact {
  return { pressure: 0, shear: 0, momentum: 0, thickness: 0 };
}

/**
 * Pressure, shear and film momentum flux of a jet of speed `speed` (m/s) and diameter
 * `diameter` (m) in a liquid of density `rho` (kg/m3) and kinematic viscosity `nu` (m2/s),
 * striking at incidence `sinIncidence` = sin(phi), at distance `r` (m) from the stagnation
 * point. Fills and returns `out`.
 */
export function jetImpactAt(
  p: JetParams,
  rho: number,
  nu: number,
  speed: number,
  diameter: number,
  sinIncidence: number,
  r: number,
  out: JetImpact,
): JetImpact {
  const s = Math.min(1, Math.max(sinIncidence, 0));
  const x = Math.max(r, 0) / diameter;
  const stagnation = 0.5 * rho * speed * speed * Math.pow(s, p.pressureIncidenceExponent);
  const sech = 1 / Math.cosh(p.pressureA * x + p.pressureB * x * x * x);
  out.pressure = stagnation * sech * sech;

  // Shear: the lower of the two branches, which meet where the stagnation zone ends (at
  // 0.552 d for a jet at normal incidence with the default constants).
  const re = (speed * diameter) / nu;
  const xf = Math.max(x, p.stagRadius);
  const vn = speed * s;
  const reN = (vn * diameter) / nu;
  const stag = reN > 0 ? (p.kStag * p.stagShear * rho * vn * vn * x) / Math.sqrt(reN) : 0;
  const film = x > 0 ? (p.kFilm * p.filmShear * rho * speed * speed) / Math.sqrt(re * x) : Infinity;
  out.shear = Math.min(stag, film);

  const hOverD = p.filmThicknessA / xf + (p.filmThicknessB * Math.sqrt(xf)) / Math.sqrt(re);
  const u = speed / (8 * xf * hOverD);
  out.thickness = hOverD * diameter;
  out.momentum = rho * u * u * out.thickness;
  return out;
}

/**
 * The largest wall shear under a jet at normal incidence, Pa: where the stagnation branch
 * meets the radial-film branch, at x = (k_film c_f / (k_stag c_s))^(2/3).
 */
export function jetPeakShear(
  p: JetParams,
  rho: number,
  nu: number,
  speed: number,
  diameter: number,
): number {
  const re = (speed * diameter) / nu;
  const stag = p.kStag * p.stagShear;
  const film = p.kFilm * p.filmShear;
  const x = Math.pow(film / stag, 2 / 3);
  return (film * rho * speed * speed) / Math.sqrt(re * x);
}
