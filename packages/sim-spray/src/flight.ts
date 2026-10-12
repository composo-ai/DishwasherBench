/**
 * Flight of a droplet in still air and what happens where it lands (docs/research/jets.md
 * sections 3.7 and 6.2 to 6.4; docs/design/sim-core.md section M6, "Flight" and "Wall
 * interaction"). Pure f64 functions of the registered constants (`params.ts`).
 *
 *   drag      du/dt = g - (3/4) C_D (rho_g / rho) |u| u / D,
 *             C_D = (24 / Re_p)(1 + 0.15 Re_p^0.687) for Re_p < 1000, 0.44 otherwise
 *   step      the drag rate k = (3/4) C_D (rho_g / rho) |u| / D is taken at the middle of the
 *             step and the velocity updated exponentially (unconditionally stable):
 *             u' = u e^(-k dt) + g (1 - e^(-k dt)) / k
 *   wall      We_n = rho V_n^2 D / gamma_w, La = rho gamma_w D / mu^2, We_c = A La^(-0.183):
 *             wetted wall: stick below 2, rebound below 20, deposit below We_c, splash above;
 *             dry wall: deposit below We_c (A_dry), splash above
 *
 * Units: SI. Frame: tub frame (gravity along -z).
 */

import type { SprayParams } from './params.ts';

/** The liquid and the air a droplet flies in. */
export interface FlightMedium {
  /** Density and dynamic viscosity of the liquid, kg/m3 and Pa s. */
  readonly rho: number;
  readonly mu: number;
  /** Surface tension of clean water at temperature, N/m (droplet surfaces are young). */
  readonly gamma: number;
  /** Gravity, m/s2. */
  readonly gravity: number;
}

/** Drag coefficient of a sphere at particle Reynolds number `re` > 0 (Schiller-Naumann). */
export function dragCoefficient(sp: SprayParams, re: number): number {
  return re < sp.dragReMax
    ? (sp.dragStokes / re) * (1 + sp.dragCoef * Math.pow(re, sp.dragExp))
    : sp.dragNewton;
}

/**
 * Drag rate k of a droplet of diameter `diameter` (m) at speed `speed` (m/s) in still air,
 * 1/s: its deceleration is k times its velocity. Finite at rest (the Stokes limit).
 */
export function dragRate(
  sp: SprayParams,
  medium: FlightMedium,
  speed: number,
  diameter: number,
): number {
  const re = (sp.airDensity * speed * diameter) / sp.airViscosity;
  if (re < sp.dragReMax) {
    // (3/4)(24 / Re)(1 + ...)(rho_g / rho) u / D with Re written out: no division by the speed.
    return (
      (0.75 * sp.dragStokes * sp.airViscosity * (1 + sp.dragCoef * Math.pow(re, sp.dragExp))) /
      (medium.rho * diameter * diameter)
    );
  }
  return (0.75 * sp.dragNewton * sp.airDensity * speed) / (medium.rho * diameter);
}

/** Terminal speed of a droplet of diameter `diameter` (m) falling in still air, m/s. */
export function terminalSpeed(sp: SprayParams, medium: FlightMedium, diameter: number): number {
  // k(u) u = g, solved by bisection (k u is increasing in u).
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (dragRate(sp, medium, mid, diameter) * mid < medium.gravity) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** One step of a droplet: where it starts, how it moves, where it ends. */
export interface FlightStep {
  /** Length of the step, s. */
  dt: number;
  /** End position minus start position, m. */
  ex: number;
  ey: number;
  ez: number;
  /** Velocity at the end, m/s. */
  ux: number;
  uy: number;
  uz: number;
  /** True when the droplet is at its terminal velocity: the step is its last, straight ray. */
  terminal: boolean;
}

/** A fresh {@link FlightStep}. */
export function createFlightStep(): FlightStep {
  return { dt: 0, ex: 0, ey: 0, ez: 0, ux: 0, uy: 0, uz: 0, terminal: false };
}

/**
 * The next step of a droplet with velocity (ux, uy, uz): its length in time is the smallest of
 * `spray.maxStep`, the time to fly `spray.maxSegmentLength` and the time in which the path
 * sags by `spray.sagTolerance` from its chord. A droplet whose acceleration has fallen below
 * `spray.terminalBand` of gravity gets one straight ray of `spray.maxRange` instead.
 */
export function flightStep(
  sp: SprayParams,
  medium: FlightMedium,
  ux: number,
  uy: number,
  uz: number,
  diameter: number,
  out: FlightStep,
): FlightStep {
  const g = medium.gravity;
  const speed = Math.sqrt(ux * ux + uy * uy + uz * uz);
  const k = dragRate(sp, medium, speed, diameter);
  const ax = -k * ux;
  const ay = -k * uy;
  const az = -g - k * uz;
  const a = Math.sqrt(ax * ax + ay * ay + az * az);
  if (a < sp.terminalBand * g && speed > 0) {
    const scale = sp.maxRange / speed;
    out.dt = scale;
    out.ex = ux * scale;
    out.ey = uy * scale;
    out.ez = uz * scale;
    out.ux = ux;
    out.uy = uy;
    out.uz = uz;
    out.terminal = true;
    return out;
  }
  let dt = sp.maxStep;
  if (speed > 0) {
    const along = (ax * ux + ay * uy + az * uz) / speed;
    const across = Math.sqrt(Math.max(0, a * a - along * along));
    if (across > 0) dt = Math.min(dt, Math.sqrt((8 * sp.sagTolerance) / across));
    dt = Math.min(dt, sp.maxSegmentLength / speed);
  }
  // The drag rate at the middle of the step (from a half step at the rate of its start): the
  // rate changes quickly while a small droplet slows down.
  let rate = k;
  if (k * dt > 1e-6) {
    const e = Math.exp(-0.5 * k * dt);
    const w = g / k;
    const hx = ux * e;
    const hy = uy * e;
    const hz = (uz + w) * e - w;
    rate = dragRate(sp, medium, Math.sqrt(hx * hx + hy * hy + hz * hz), diameter);
  }
  const kdt = rate * dt;
  if (kdt < 1e-6) {
    out.ex = ux * dt;
    out.ey = uy * dt;
    out.ez = uz * dt - 0.5 * g * dt * dt;
    out.ux = ux;
    out.uy = uy;
    out.uz = uz - g * dt;
  } else {
    const e = Math.exp(-kdt);
    const f = (1 - e) / rate;
    // Terminal fall speed of the frozen drag rate: g / k.
    const w = g / rate;
    out.ex = ux * f;
    out.ey = uy * f;
    out.ez = (uz + w) * f - w * dt;
    out.ux = ux * e;
    out.uy = uy * e;
    out.uz = (uz + w) * e - w;
  }
  out.dt = dt;
  out.terminal = false;
  return out;
}

/** What a droplet does at a wall. */
export const WALL_OUTCOME = { stick: 0, rebound: 1, deposit: 2, splash: 3 } as const;

/** The outcome of an impact, filled by {@link wallImpact}. */
export interface WallImpact {
  /** {@link WALL_OUTCOME}. */
  outcome: number;
  /** Splashed share of the mass (0 unless the outcome is a splash). */
  splashed: number;
  /** Normal restitution of a rebound. */
  restitution: number;
}

/** A fresh {@link WallImpact}. */
export function createWallImpact(): WallImpact {
  return { outcome: WALL_OUTCOME.deposit, splashed: 0, restitution: 0 };
}

/**
 * The outcome of a droplet of diameter `diameter` (m) striking a wall with normal speed
 * `normalSpeed` and tangential speed `tangentialSpeed` (m/s, both non-negative); `wet` says
 * whether the wall carries a film. Fills and returns `out`.
 */
export function wallImpact(
  sp: SprayParams,
  medium: FlightMedium,
  diameter: number,
  normalSpeed: number,
  tangentialSpeed: number,
  wet: boolean,
  out: WallImpact,
): WallImpact {
  const we = (medium.rho * normalSpeed * normalSpeed * diameter) / medium.gamma;
  const la = (medium.rho * medium.gamma * diameter) / (medium.mu * medium.mu);
  const critical = (wet ? sp.Awet : sp.Adry) * Math.pow(la, -sp.laExp);
  out.splashed = 0;
  out.restitution = 0;
  if (wet && we < sp.WeStick) {
    out.outcome = WALL_OUTCOME.stick;
  } else if (wet && we < sp.WeRebound) {
    const a = Math.atan2(normalSpeed, tangentialSpeed);
    const r = sp.restitution;
    out.outcome = WALL_OUTCOME.rebound;
    out.restitution = Math.max(
      0,
      (r[0] ?? 0) + a * ((r[1] ?? 0) + a * ((r[2] ?? 0) + a * (r[3] ?? 0))),
    );
  } else if (we < critical) {
    out.outcome = WALL_OUTCOME.deposit;
  } else {
    out.outcome = WALL_OUTCOME.splash;
    out.splashed = Math.min(sp.rmMax, Math.max(0, sp.rmSlope * (we / critical - 1)));
  }
  return out;
}
