/**
 * The jet-mobility screen of docs/research/items.md section 4: which items a single spray jet
 * can lift, tip or slide. It is evaluated when a level is loaded, for the level's machine; item
 * types only carry what it needs (mass, and whether a jet can be turned back by a concave face).
 *
 * Units: SI (newtons, kilograms, metres, m/s).
 */

import { STANDARD_GRAVITY } from '@spotless/core';

/**
 * Screening threshold on the jet mobility number: items at or above it stay dynamic during the
 * wash. Half of the best-lever tipping threshold of 0.5. [ESTIMATED] items.md section 4.6.
 */
export const JET_MOBILE_THRESHOLD = 0.25;

/**
 * Factor on the jet force for an item with a concave face a jet can enter and be turned back by
 * (an inverted cup, a tub, a bowl): the jet is turned through up to 180 degrees.
 * [ESTIMATED] items.md sections 4.3 and 4.6 (calibration range 1.0 to 2.0).
 */
export const CONCAVE_TURNING_FACTOR = 2;

/** Density of water used for jet momentum, kg/m^3, as in items.md section 4.3. */
export const JET_WATER_DENSITY = 1000;

/**
 * Momentum flux of a coherent jet, newtons: `J = rho A v^2` with `A = pi d^2 / 4`
 * (items.md section 4.3). A 2 mm jet at the measured mean ejection speed of 7.69 m/s carries
 * 0.186 N.
 */
export function jetMomentumFlux(
  nozzleDiameter: number,
  speed: number,
  density: number = JET_WATER_DENSITY,
): number {
  return density * ((Math.PI * nozzleDiameter * nozzleDiameter) / 4) * speed * speed;
}

/**
 * Jet mobility number of an item: the largest jet force on it over its weight,
 * `c_turn J_max / (m g)`, with `c_turn` = 2 for an item with a concave face a jet can enter and
 * 1 otherwise (items.md sections 4.4 and 4.6). `mass` in kilograms, `jMax` (the largest
 * single-nozzle momentum flux of the machine) in newtons.
 */
export function jetMobilityNumber(mass: number, jMax: number, concave: boolean): number {
  if (!(mass > 0) || !Number.isFinite(mass)) {
    throw new RangeError(`catalogue: mass must be a finite number above zero, got ${mass}`);
  }
  return ((concave ? CONCAVE_TURNING_FACTOR : 1) * jMax) / (mass * STANDARD_GRAVITY);
}

/** True when an item is a jet-mobile candidate: its mobility number reaches the threshold. */
export function isJetMobile(mass: number, jMax: number, concave: boolean): boolean {
  return jetMobilityNumber(mass, jMax, concave) >= JET_MOBILE_THRESHOLD;
}
