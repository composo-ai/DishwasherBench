/**
 * Nozzle kinematics (docs/research/machine.md section 12.2 item 3; platform.md section 4.4).
 *
 * For nozzle i on blade h (h = 0 for "+", pi for "-") of an arm at angle phi turning with
 * sense sigma (+1 counter-clockwise seen from above, -1 clockwise) at speed omega:
 *
 *   e_r     = (cos(phi + h), sin(phi + h), 0)             radially outward along the blade
 *   e_lead  = sigma (-sin(phi + h), cos(phi + h), 0)      the blade's direction of travel
 *   e_trail = -e_lead
 *   x_i     = (x_axis, y_axis, z_nozzle) + R_i e_r                              position
 *   d_i     = cos(rho_i) (cos(theta_i) e_r + sin(theta_i) e_trail) + sin(rho_i) e_z   direction
 *   u_i     = v_i d_i + omega R_i e_lead                  absolute exit velocity
 *
 * The arm angle phi is the azimuth of the "+" blade in the tub frame, measured from +x towards
 * +y (counter-clockwise seen from above), in radians, whatever the arm's rotation sense; a
 * clockwise arm's angle decreases with time. The arm speed omega is in the arm's own rotation
 * sense (positive when it turns the way `SprayArmSpec.sense` says), rad/s.
 *
 * Frames and units: positions in the tub frame in metres, velocities in m/s, angles in radians.
 */

import type { Vec3 } from '@spotless/core';
import { getNozzle, getSprayLevel, sprayLevelDatumZ } from './config.ts';
import type { MachineConfig, MachineSpec, NozzleSpec, SprayLevelSpec } from './types.ts';

/** Where a nozzle is and how its jet leaves, at one instant. Tub frame. */
export interface NozzleState {
  /** Position of the nozzle exit, metres. */
  readonly position: Vec3;
  /** Unit direction of the jet relative to the arm. */
  readonly direction: Vec3;
  /** Velocity of the nozzle itself, omega R e_lead, m/s. */
  readonly nozzleVelocity: Vec3;
  /** Absolute exit velocity of the jet, v d + omega R e_lead, m/s. */
  readonly velocity: Vec3;
}

/** Azimuth offset of a blade from the "+" blade, radians. */
function bladeOffset(nozzle: NozzleSpec): number {
  return nozzle.blade === '-' ? Math.PI : 0;
}

/** +1 for a level that turns counter-clockwise seen from above, -1 for clockwise, +1 if fixed. */
function senseSignOf(level: SprayLevelSpec): 1 | -1 {
  return level.kind === 'arm' && level.sense === 'cw' ? -1 : 1;
}

/**
 * Unit direction of a nozzle's jet relative to its arm, in tub-frame components, for a "+"
 * blade at azimuth `armAngle` (radians) and rotation sense `senseSign` (+1 counter-clockwise,
 * -1 clockwise).
 */
export function nozzleDirection(nozzle: NozzleSpec, armAngle: number, senseSign: 1 | -1): Vec3 {
  const azimuth = armAngle + bladeOffset(nozzle);
  const c = Math.cos(azimuth);
  const s = Math.sin(azimuth);
  const cosRho = Math.cos(nozzle.rho);
  const radial = cosRho * Math.cos(nozzle.theta);
  const trailing = cosRho * Math.sin(nozzle.theta);
  // e_r = (c, s, 0); e_trail = -sigma (-s, c, 0).
  return [
    radial * c + trailing * senseSign * s,
    radial * s - trailing * senseSign * c,
    Math.sin(nozzle.rho),
  ];
}

/**
 * Tub-frame z of the exit of a nozzle, metres: the upward or downward nozzle plane of an arm
 * (by the face the nozzle is in), or the outlet of a fixed sprayer, at the configured basket
 * heights. Throws a RangeError if the arm has no nozzle plane on that face.
 */
export function nozzleExitZ(
  spec: MachineSpec,
  level: SprayLevelSpec,
  nozzle: NozzleSpec,
  config: MachineConfig = spec.defaultConfig,
): number {
  const datum = sprayLevelDatumZ(spec, level, config.basketHeights);
  if (level.kind === 'fixed') return datum + level.outletZ;
  const plane = nozzle.face === 'top' ? level.nozzleUpZ : level.nozzleDownZ;
  if (plane === null) {
    throw new RangeError(
      `nozzleExitZ: arm "${level.id}" has no nozzle plane on its ${nozzle.face} face (nozzle "${nozzle.id}")`,
    );
  }
  return datum + plane;
}

/**
 * Position, jet direction and absolute exit velocity of one nozzle.
 *
 * @param spec the machine
 * @param levelId id of the spray level (`lower`)
 * @param nozzleId id of the nozzle on it (`l8`)
 * @param armAngle azimuth of the "+" blade from +x towards +y, radians (ignored by a nozzle on the axis)
 * @param armSpeed angular speed in the arm's rotation sense, rad/s (0 for a fixed sprayer)
 * @param jetSpeed speed of the jet relative to the nozzle, m/s
 * @param config the configuration that sets the height of a basket-mounted arm; default: the machine's
 */
export function nozzleState(
  spec: MachineSpec,
  levelId: string,
  nozzleId: string,
  armAngle: number,
  armSpeed: number,
  jetSpeed: number,
  config: MachineConfig = spec.defaultConfig,
): NozzleState {
  const level = getSprayLevel(spec, levelId);
  const nozzle = getNozzle(level, nozzleId);
  const sigma = senseSignOf(level);
  const azimuth = armAngle + bladeOffset(nozzle);
  const c = Math.cos(azimuth);
  const s = Math.sin(azimuth);
  const radius = nozzle.blade === 'axis' ? 0 : nozzle.radius;
  const position: Vec3 = [
    level.axis[0] + radius * c,
    level.axis[1] + radius * s,
    nozzleExitZ(spec, level, nozzle, config),
  ];
  const direction = nozzleDirection(nozzle, armAngle, sigma);
  const tip = armSpeed * radius;
  // Adding 0 turns a negative zero (a stationary arm) into a plain zero.
  const nozzleVelocity: Vec3 = [-sigma * tip * s + 0, sigma * tip * c + 0, 0];
  const velocity: Vec3 = [
    jetSpeed * direction[0] + nozzleVelocity[0],
    jetSpeed * direction[1] + nozzleVelocity[1],
    jetSpeed * direction[2] + nozzleVelocity[2],
  ];
  return { position, direction, nozzleVelocity, velocity };
}
