/**
 * Rotation of a reaction-driven spray arm (docs/research/machine.md sections 3.3 and 12.2
 * item 2).
 *
 * Angular momentum balance about the arm's vertical axis:
 *
 *   I d(omega)/dt = sum_i m_i r_i (v_i t_i - omega r_i) - (k_f |F_ax| + c_v omega) sgn(omega) - T_contact
 *
 *   m_i = rho C_d,i A_i sqrt(2 p / rho)      mass flow of nozzle i, kg/s
 *   v_i = C_v,i sqrt(2 p / rho)              jet speed relative to the arm, m/s
 *   t_i = cos(rho_i) sin(theta_i)            trailing-tangential direction cosine
 *   F_ax = p A_hub + s (F_jz + W),  F_jz = sum_i m_i v_i sin(rho_i)
 *
 * `drive` = sum m_i v_i r_i t_i is the torque of the jets on a stationary arm; the term
 * `brake` omega = sum m_i r_i^2 omega is the torque needed to spin up water that enters on the
 * axis without angular momentum; k_f |F_ax| is the dry friction of the bearing and c_v omega
 * its viscous part. With no contact the steady speed is
 *
 *   omega = (drive - k_f |F_ax|) / (brake + c_v),  clipped at zero (stall),
 *
 * and the arm stalls when a contact torque exceeds `drive - k_f |F_ax|`, the stall margin.
 *
 * Sign convention: speeds and torques are positive in the arm's own rotation sense
 * (`SprayArmSpec.sense`); a contact torque is a magnitude that opposes whatever motion there
 * is. Units: SI (rad/s, N m, kg m^2/s, N, Pa).
 */

import type { SprayArmSpec } from './types.ts';
import { WATER_DENSITY } from './water.ts';

/** What an arm calculation needs besides the arm and the pressure in it. */
export interface ArmOptions {
  /** Blocked fraction of the area of individual nozzles of this arm, by nozzle id, 0 to 1. */
  readonly blockage?: Readonly<Record<string, number>>;
  /** Density of the liquor, kg/m^3; default `WATER_DENSITY`. */
  readonly density?: number;
}

/** The pressure-dependent terms of the torque balance of an arm. SI. */
export interface ArmTorqueTerms {
  /** Torque of the jets on the stationary arm in its rotation sense, N m. */
  readonly drive: number;
  /** Coefficient of the speed-proportional brake, sum m_i r_i^2, kg m^2/s. */
  readonly brake: number;
  /** Total mass flow of the arm, kg/s. */
  readonly massFlow: number;
  /** Net vertical jet reaction F_jz, N: positive when the jets push the arm down. */
  readonly verticalReaction: number;
  /** Axial load on the bearing F_ax, N. */
  readonly axialLoad: number;
  /** Dry friction torque of the bearing k_f |F_ax|, N m. */
  readonly staticFriction: number;
  /** Largest contact torque the arm overcomes from rest, drive - k_f |F_ax|, N m. */
  readonly stallMargin: number;
}

/** The steady rotation of an arm at one pressure. SI. */
export interface ArmSteadyState extends ArmTorqueTerms {
  /** Steady angular speed in the arm's rotation sense, rad/s; 0 when it does not turn. */
  readonly omega: number;
  /** The same in revolutions per minute. */
  readonly rpm: number;
  /** Bearing friction torque at that speed, k_f |F_ax| + c_v omega, N m. */
  readonly frictionTorque: number;
  /** Speed the arm would reach with a frictionless bearing, drive / brake, rad/s. */
  readonly frictionlessOmega: number;
  /** True when the arm does not turn at all. */
  readonly stalled: boolean;
}

/** Area of the hub bore on which the supply pressure acts, m^2. */
export function armHubArea(arm: SprayArmSpec): number {
  return (Math.PI * arm.bearing.hubBore * arm.bearing.hubBore) / 4;
}

/**
 * The pressure-dependent terms of the torque balance of `arm` at gauge pressure `armPressure`
 * (Pa) inside it.
 */
export function armTorqueTerms(
  arm: SprayArmSpec,
  armPressure: number,
  options: ArmOptions = {},
): ArmTorqueTerms {
  const density = options.density ?? WATER_DENSITY;
  const pressure = Math.max(armPressure, 0);
  const ideal = Math.sqrt((2 * pressure) / density);
  let drive = 0;
  let brake = 0;
  let massFlow = 0;
  let verticalReaction = 0;
  for (const nozzle of arm.nozzles) {
    const blocked = options.blockage?.[nozzle.id] ?? 0;
    const area = nozzle.area * Math.min(1, Math.max(1 - blocked, 0));
    const m = density * nozzle.cd * area * ideal;
    const v = nozzle.cv * ideal;
    drive += m * v * nozzle.radius * Math.cos(nozzle.rho) * Math.sin(nozzle.theta);
    brake += m * nozzle.radius * nozzle.radius;
    verticalReaction += m * v * Math.sin(nozzle.rho);
    massFlow += m;
  }
  const axialLoad =
    pressure * armHubArea(arm) + arm.bearing.thrustSign * (verticalReaction + arm.weight);
  const staticFriction = arm.bearing.frictionRadius * Math.abs(axialLoad);
  return {
    drive,
    brake,
    massFlow,
    verticalReaction,
    axialLoad,
    staticFriction,
    stallMargin: drive - staticFriction,
  };
}

/**
 * Steady rotation of `arm` at gauge pressure `armPressure` (Pa) against a contact torque
 * `contactTorque` (N m, a magnitude; default none):
 * omega = (drive - k_f |F_ax| - T_contact) / (brake + c_v), clipped at zero.
 *
 * A nozzle table whose jets push the arm against its declared sense gives a negative `drive`;
 * the arm then turns backwards and `omega` is negative, with friction and contact opposing it.
 */
export function armSteadyState(
  arm: SprayArmSpec,
  armPressure: number,
  contactTorque = 0,
  options: ArmOptions = {},
): ArmSteadyState {
  const terms = armTorqueTerms(arm, armPressure, options);
  const resisting = terms.staticFriction + Math.max(contactTorque, 0);
  const denominator = terms.brake + arm.bearing.viscous;
  let omega = 0;
  if (denominator > 0) {
    if (terms.drive > resisting) omega = (terms.drive - resisting) / denominator;
    else if (terms.drive < -resisting) omega = (terms.drive + resisting) / denominator;
  }
  return {
    ...terms,
    omega,
    rpm: (omega * 30) / Math.PI,
    frictionTorque: terms.staticFriction + arm.bearing.viscous * Math.abs(omega),
    frictionlessOmega: terms.brake > 0 ? terms.drive / terms.brake : 0,
    stalled: omega === 0,
  };
}

/**
 * Whether an arm at gauge pressure `armPressure` (Pa) is held still by a contact torque
 * `contactTorque` (N m): true when the torque is at least the stall margin
 * drive - k_f |F_ax| (machine.md section 3.3).
 */
export function armStalls(
  arm: SprayArmSpec,
  armPressure: number,
  contactTorque: number,
  options: ArmOptions = {},
): boolean {
  const terms = armTorqueTerms(arm, armPressure, options);
  return Math.abs(terms.drive) <= terms.staticFriction + Math.max(contactTorque, 0);
}

/**
 * Angular acceleration d(omega)/dt of an arm, rad/s^2, from the transient equation at the top
 * of this file. `omega` is the present speed in the arm's rotation sense (rad/s), `armPressure`
 * the gauge pressure inside it (Pa), `contactTorque` a magnitude (N m) that opposes the motion.
 * At rest the arm stays at rest unless the drive exceeds the dry friction plus the contact
 * torque.
 */
export function armAngularAcceleration(
  arm: SprayArmSpec,
  armPressure: number,
  omega: number,
  contactTorque = 0,
  options: ArmOptions = {},
): number {
  const terms = armTorqueTerms(arm, armPressure, options);
  const resisting = terms.staticFriction + Math.max(contactTorque, 0);
  const linear = (terms.brake + arm.bearing.viscous) * omega;
  if (omega > 0) return (terms.drive - resisting - linear) / arm.inertiaWet;
  if (omega < 0) return (terms.drive + resisting - linear) / arm.inertiaWet;
  if (terms.drive > resisting) return (terms.drive - resisting) / arm.inertiaWet;
  if (terms.drive < -resisting) return (terms.drive + resisting) / arm.inertiaWet;
  return 0;
}

/**
 * Time constant of the arm's approach to its steady speed, seconds: I / (brake + c_v). After a
 * diverter change the arm is within 5 % of its new speed after three time constants.
 */
export function armTimeConstant(
  arm: SprayArmSpec,
  armPressure: number,
  options: ArmOptions = {},
): number {
  const terms = armTorqueTerms(arm, armPressure, options);
  const denominator = terms.brake + arm.bearing.viscous;
  return denominator > 0 ? arm.inertiaWet / denominator : Number.POSITIVE_INFINITY;
}

/**
 * Speed of an arm after `dt` seconds at constant pressure and contact torque, starting from
 * `omega` (rad/s, in the arm's rotation sense). The transient equation is linear while the arm
 * keeps turning one way, so it is integrated exactly; an arm that comes to rest within the step
 * stays at rest unless the drive can start it again, in which case it runs on in the new
 * direction for the remainder of the step.
 */
export function advanceArmSpeed(
  arm: SprayArmSpec,
  armPressure: number,
  omega: number,
  dt: number,
  contactTorque = 0,
  options: ArmOptions = {},
): number {
  const terms = armTorqueTerms(arm, armPressure, options);
  const resisting = terms.staticFriction + Math.max(contactTorque, 0);
  const k = terms.brake + arm.bearing.viscous;
  const inertia = arm.inertiaWet;
  let speed = omega;
  let remaining = Math.max(dt, 0);
  // At most two legs: slowing to rest, then (perhaps) starting in the other direction.
  for (let leg = 0; leg < 2 && remaining > 0; leg++) {
    let direction = Math.sign(speed);
    if (direction === 0) {
      if (terms.drive > resisting) direction = 1;
      else if (terms.drive < -resisting) direction = -1;
      else return 0;
    }
    const net = terms.drive - direction * resisting;
    if (!(k > 0)) {
      // No speed-dependent torque: constant acceleration.
      const next = speed + (net / inertia) * remaining;
      if (speed !== 0 && Math.sign(next) === -direction) {
        remaining -= (-speed * inertia) / net;
        speed = 0;
        continue;
      }
      return next;
    }
    const target = net / k;
    const next = target + (speed - target) * Math.exp((-k * remaining) / inertia);
    if (speed !== 0 && Math.sign(next) === -direction) {
      // The speed passes through zero inside the step: omega(t) = target + (speed - target) e^(-k t / I).
      const tStop = (inertia / k) * Math.log((speed - target) / -target);
      remaining -= tStop;
      speed = 0;
      continue;
    }
    return next;
  }
  return speed;
}

/**
 * Arm angle after `dt` seconds at constant speed: the azimuth of the "+" blade advances by
 * sigma omega dt, where sigma is +1 for a counter-clockwise arm and -1 for a clockwise one.
 * `armAngle` in radians (see `kinematics.ts`), `omega` in rad/s in the arm's rotation sense.
 */
export function advanceArmAngle(
  arm: SprayArmSpec,
  armAngle: number,
  omega: number,
  dt: number,
): number {
  return armAngle + armSenseSign(arm) * omega * dt;
}

/** +1 for an arm that turns counter-clockwise seen from above, -1 for a clockwise one. */
export function armSenseSign(arm: SprayArmSpec): 1 | -1 {
  return arm.sense === 'ccw' ? 1 : -1;
}
