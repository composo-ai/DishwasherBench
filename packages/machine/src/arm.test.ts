import { degToRad } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  advanceArmAngle,
  advanceArmSpeed,
  armAngularAcceleration,
  armHubArea,
  armSenseSign,
  armStalls,
  armSteadyState,
  armTimeConstant,
  armTorqueTerms,
} from './arm.ts';
import { getSprayArm } from './config.ts';
import { branchOperatingPoint, hydraulicOperatingPoint } from './hydraulics.ts';
import { nozzleArea } from './load.ts';
import { BOSCH_SMV4HAX40G, SPOT_60 } from './machines.ts';
import { expectNear, expectWithin, must, toRpm } from './test-util.ts';
import type { MachineSpec, NozzleSpec, SprayArmSpec } from './types.ts';
import { WATER_DENSITY } from './water.ts';

/**
 * The Bosch as the owner update solved it: the default configuration (upper basket at level 1)
 * with the roof branch's static lift still at the dossier's 0.72 m (see hydraulics.test.ts).
 * The roof lift moves the pressure in the upper arm by a few pascals in state UR.
 */
const BOSCH_AS_UPDATE_SOLVED: MachineSpec = {
  ...BOSCH_SMV4HAX40G,
  hydraulics: {
    ...BOSCH_SMV4HAX40G.hydraulics,
    branches: BOSCH_SMV4HAX40G.hydraulics.branches.map((b) =>
      b.id === 'roof' ? { ...b, staticLift: 0.72 } : b,
    ),
  },
};

/** Pressure inside an arm for a diverter state and pump speed, Pa. */
function armPressure(spec: MachineSpec, state: string, rpm: number, arm: string): number {
  const point = hydraulicOperatingPoint(spec, state, rpm);
  return must(branchOperatingPoint(point, arm), `branch ${arm}`).armPressure;
}

/** A copy of an arm with another friction radius and hub bore (both in millimetres). */
function withBearing(arm: SprayArmSpec, frictionRadiusMm: number, hubBoreMm: number): SprayArmSpec {
  return {
    ...arm,
    bearing: {
      ...arm.bearing,
      frictionRadius: frictionRadiusMm / 1000,
      hubBore: hubBoreMm / 1000,
    },
  };
}

/** A copy of an arm with the direction angles of some nozzles replaced (degrees). */
function withAngles(
  arm: SprayArmSpec,
  angles: Readonly<Record<string, readonly [thetaDeg: number, rhoDeg: number]>>,
): SprayArmSpec {
  return {
    ...arm,
    nozzles: arm.nozzles.map((n): NozzleSpec => {
      const a = angles[n.id];
      return a === undefined ? n : { ...n, theta: degToRad(a[0]), rho: degToRad(a[1]) };
    }),
  };
}

describe('arm rotation of the Bosch with the measured drive nozzles (machine-bosch-owner-update.md sections 5.1 and 5.5)', () => {
  const lower = getSprayArm(BOSCH_SMV4HAX40G, 'lower');
  const upper = getSprayArm(BOSCH_SMV4HAX40G, 'upper');
  // The bearings the owner update solved its table with: the dossier's hub bores (21 and 18 mm)
  // and the generic friction radii (9.3 and 3.8 mm).
  const lowerAsSolved = withBearing(lower, 9.3, 21);
  const upperAsSolved = withBearing(upper, 3.8, 18);
  const S = BOSCH_AS_UPDATE_SOLVED;

  // The dossier's table of section 3.4 (lower arm 32 rpm, upper arm 26 rpm with a tuned slot
  // tilt) is superseded: the drive is now what was measured on the arms.
  // [state, pump rpm, speed rpm with the dossier's friction, frictionless speed rpm] from the
  // column "Arm speed (rpm), free" of the owner update's table 5.1.
  const lowerTable = [
    ['l', 2400, 34, 61],
    ['l', 2800, 39, 72],
    ['l', 3000, 42, 77],
    ['l', 3400, 47, 87],
    ['lu', 2400, 29, null],
    ['lu', 2800, 33, null],
    ['lu', 3000, 35, null],
    ['lu', 3400, 39, null],
  ] as const;
  const upperTable = [
    ['ur', 2400, 48, 84],
    ['ur', 2800, 60, 101],
    ['ur', 3000, 67, 109],
    ['ur', 3400, 79, 125],
    ['u', 2400, 53, 91],
    ['u', 2800, 66, 109],
    ['u', 3000, 73, 118],
    ['u', 3400, 87, 135],
    ['lu', 2400, 32, null],
    ['lu', 2800, 43, null],
    ['lu', 3000, 48, null],
    ['lu', 3400, 59, null],
  ] as const;

  it.each(lowerTable)(
    'lower arm in state %s at %i rpm, bearing as the update solved it: %i rpm',
    (state, rpm, speed, free) => {
      const result = armSteadyState(lowerAsSolved, armPressure(S, state, rpm, 'lower'));
      // The table prints whole rpm.
      expectNear(result.rpm, speed, 0.6, 'speed');
      if (free !== null) expectNear(toRpm(result.frictionlessOmega), free, 0.6, 'free speed');
      expect(result.stalled).toBe(false);
    },
  );

  it.each(upperTable)(
    'upper arm in state %s at %i rpm, bearing as the update solved it: %i rpm',
    (state, rpm, speed, free) => {
      const result = armSteadyState(upperAsSolved, armPressure(S, state, rpm, 'upper'));
      expectNear(result.rpm, speed, 0.6, 'speed');
      if (free !== null) expectNear(toRpm(result.frictionlessOmega), free, 0.6, 'free speed');
    },
  );

  it('has the measured drive: 0.105 N m (lower, L) and 0.098 N m (upper, UR) at 3000 rpm, whatever the bearing', () => {
    // Section 5.5: "drive 0.105 N m, static friction 0.040 N m, 42 rpm"; "drive 0.098 N m
    // against 0.053 in the dossier". The drive does not depend on the friction or the hub.
    const l = armTorqueTerms(lower, armPressure(S, 'l', 3000, 'lower'));
    const u = armTorqueTerms(upper, armPressure(S, 'ur', 3000, 'upper'));
    expectNear(l.drive, 0.105, 0.0006, 'lower drive');
    expectNear(u.drive, 0.098, 0.0006, 'upper drive');
    expect(l.drive).toBe(armTorqueTerms(lowerAsSolved, armPressure(S, 'l', 3000, 'lower')).drive);
    // By hand for the lower arm at 22.08 kPa (v = 6.652 m/s): each driving nozzle gives
    // rho C_d A v^2 r cos(rho) sin(theta):
    //   L7  998 x 0.85 x 8.553e-6 x 44.25 x 0.183 x cos 45 = 0.04154
    //   L8  the same at 0.207 m                             = 0.04699
    //   L10 998 x 0.78 x 8.305e-6 x 44.25 x 0.225 x cos 75  = 0.01666   sum 0.1052 N m.
    const v2 = (2 * armPressure(S, 'l', 3000, 'lower')) / WATER_DENSITY;
    const round = (0.85 * Math.PI * 0.0033 ** 2) / 4;
    const slot = 0.78 * (0.0018 * 0.0032 + (Math.PI * 0.0018 ** 2) / 4);
    const byHand =
      WATER_DENSITY *
      v2 *
      (round * (0.183 + 0.207) * Math.cos(degToRad(45)) + slot * 0.225 * Math.cos(degToRad(75)));
    expectNear(byHand, 0.1052, 0.0002);
    expectWithin(l.drive, byHand, 1e-9);
    // Only the nozzles flagged as driving contribute: L7, L8, L10; U4 to U7.
    expect(lower.nozzles.filter((n) => n.drives).map((n) => n.id)).toEqual(['l7', 'l8', 'l10']);
    expect(upper.nozzles.filter((n) => n.drives).map((n) => n.id)).toEqual([
      'u4',
      'u5',
      'u6',
      'u7',
    ]);
    for (const arm of [lower, upper]) {
      for (const n of arm.nozzles) {
        const tangential = Math.cos(n.rho) * Math.sin(n.theta);
        if (n.drives) expect(tangential, n.id).toBeGreaterThan(0.2);
        else expectNear(tangential, 0, 1e-12, n.id);
      }
    }
  });

  it('frictionless: 11.6 rpm per m/s of jet speed on the lower arm and 18.9 on the upper (section 5.4)', () => {
    for (const rpm of [2400, 3000, 3400]) {
      const pl = armPressure(S, 'l', rpm, 'lower');
      const pu = armPressure(S, 'ur', rpm, 'upper');
      const vl = Math.sqrt((2 * pl) / WATER_DENSITY);
      const vu = Math.sqrt((2 * pu) / WATER_DENSITY);
      expectNear(toRpm(armSteadyState(lower, pl).frictionlessOmega) / vl, 11.6, 0.05);
      expectNear(toRpm(armSteadyState(upper, pu).frictionlessOmega) / vu, 18.9, 0.05);
    }
  });

  it('turns at the speeds the update recommends: 42 rpm (lower, L) and 31 rpm (upper, UR) at 3000 rpm', () => {
    // Section 5.5: "prescribe 40 +-10 rpm for the lower arm and 30 +-10 rpm for the upper arm";
    // section 7: "L ... 42 rpm; UR ... about 30 rpm with the placeholder friction" (31 rpm with
    // k_f = 10 mm in section 5.5).
    const l = armSteadyState(lower, armPressure(BOSCH_SMV4HAX40G, 'l', 3000, 'lower'));
    const u = armSteadyState(upper, armPressure(BOSCH_SMV4HAX40G, 'ur', 3000, 'upper'));
    expectNear(l.rpm, 42, 0.6, 'lower');
    expectNear(u.rpm, 31, 0.6, 'upper');
    // "static friction 0.040 N m"; stall margins "0.066 and 0.035 N m"; "0.29 N at the tip".
    expectNear(l.staticFriction, 0.04, 0.0015, 'lower static friction');
    expectNear(l.stallMargin, 0.066, 0.0006, 'lower stall margin');
    expectNear(u.stallMargin, 0.035, 0.0006, 'upper stall margin');
    expectNear(l.stallMargin / lower.tipRadius, 0.29, 0.006);
    expectNear(u.stallMargin / upper.tipRadius, 0.15, 0.006);
    expect(l.stalled).toBe(false);
    expect(u.stalled).toBe(false);
    // The design speed recorded with the data is the speed the friction was chosen for.
    expectNear(toRpm(must(lower.designSpeed)), 42, 1e-9);
    expectNear(toRpm(must(upper.designSpeed)), 31, 1e-9);
    expectWithin(l.omega, must(lower.designSpeed), 0.02);
    expectWithin(u.omega, must(upper.designSpeed), 0.02);
  });

  it('stays inside the recommended bands at normal pump speeds, within 2 rpm of the update at the other speeds', () => {
    // Update: lower arm "34 at 2400 rpm, 47 at 3400"; upper arm with k_f = 10 mm "20 rpm at 2400
    // rpm". This package carries the hub bores of the update's section 7 (18 and 15 mm, not the
    // 21 and 18 mm those figures were solved with), so the pressure thrust on the hub, and with
    // it the friction, scales a little differently with the pump speed: 2 rpm is allowed.
    const l = (rpm: number) =>
      armSteadyState(lower, armPressure(BOSCH_SMV4HAX40G, 'l', rpm, 'lower')).rpm;
    const u = (rpm: number) =>
      armSteadyState(upper, armPressure(BOSCH_SMV4HAX40G, 'ur', rpm, 'upper')).rpm;
    expectNear(l(2400), 34, 2);
    expectNear(l(3400), 47, 2);
    expectNear(u(2400), 20, 2);
    // The bands are for normal pump speeds; at 2400 rpm the upper arm is at the update's 20 rpm.
    for (const rpm of [2400, 2800, 3000, 3400]) expectNear(l(rpm), 40, 10, `lower at ${rpm}`);
    for (const rpm of [2800, 3000, 3400]) expectNear(u(rpm), 30, 10, `upper at ${rpm}`);
    // Both arms keep turning in every state the programmes use, down to 2400 rpm.
    for (const [state, arm, spec] of [
      ['lu', 'lower', lower],
      ['lu', 'upper', upper],
      ['u', 'upper', upper],
    ] as const) {
      for (const rpm of [2400, 3000, 3400]) {
        const result = armSteadyState(spec, armPressure(BOSCH_SMV4HAX40G, state, rpm, arm));
        expect(result.stalled, `${arm} in ${state} at ${rpm}`).toBe(false);
      }
    }
  });

  it("carries the scaled hub bores and friction placeholders chosen for them, not the update's 9.3 and 10 mm", () => {
    // The update's section 7 replaces the hub bores (21 -> 18 mm, 18 -> 15 mm) but quotes
    // speeds solved with the old ones. Its figures need its bearings:
    expectNear(lower.bearing.hubBore, 0.018, 1e-12);
    expectNear(upper.bearing.hubBore, 0.015, 1e-12);
    const pl = armPressure(S, 'l', 3000, 'lower');
    const pu = armPressure(S, 'ur', 3000, 'upper');
    // ... as solved: 42 rpm, and 31 rpm with k_f = 10 mm, 20 rpm with 12 mm, 67 rpm with 3.8 mm.
    expectNear(armSteadyState(withBearing(lower, 9.3, 21), pl).rpm, 42, 0.6);
    expectNear(armSteadyState(withBearing(upper, 10, 18), pu).rpm, 31, 0.6);
    expectNear(armSteadyState(withBearing(upper, 12, 18), pu).rpm, 20, 0.6);
    expectNear(armSteadyState(withBearing(upper, 3.8, 18), pu).rpm, 67, 0.6);
    // ... with the new bores and the same friction radii both arms leave the recommended bands
    // (the update's own check of the lower arm: "hub bores 18 / 15 mm" gives 54 rpm).
    expectNear(armSteadyState(withBearing(lower, 9.3, 18), pl).rpm, 54, 0.6);
    expect(armSteadyState(withBearing(upper, 10, 15), pu).rpm).toBeGreaterThan(40);
    // So the friction radii here are placeholders that restore the update's static friction
    // with the bores it adopted: k_f = T_f0 / |F_ax|.
    const l = armTorqueTerms(lower, pl);
    const u = armTorqueTerms(upper, pu);
    const lSolved = armTorqueTerms(withBearing(lower, 9.3, 21), pl);
    const uSolved = armTorqueTerms(withBearing(upper, 10, 18), pu);
    expectNear(l.staticFriction, lSolved.staticFriction, 0.001);
    expectNear(u.staticFriction, uSolved.staticFriction, 0.001);
    expectNear(lower.bearing.frictionRadius * 1000, 17.5, 1e-9);
    expectNear(upper.bearing.frictionRadius * 1000, 12.6, 1e-9);
    // The axial loads: pressure on the hub bore less (lower arm) or plus (upper arm) the
    // downward jet reaction and the weight.
    expectWithin(
      l.axialLoad,
      pl * Math.PI * 0.009 ** 2 - (l.verticalReaction + lower.weight),
      1e-12,
    );
    expectWithin(
      u.axialLoad,
      pu * Math.PI * 0.0075 ** 2 + (u.verticalReaction + upper.weight),
      1e-12,
    );
  });

  it('stalls under a contact torque above the margin and not below it', () => {
    const p = armPressure(BOSCH_SMV4HAX40G, 'l', 3000, 'lower');
    const margin = armTorqueTerms(lower, p).stallMargin;
    expect(armStalls(lower, p, 0)).toBe(false);
    expect(armStalls(lower, p, margin * 0.99)).toBe(false);
    expect(armStalls(lower, p, margin * 1.01)).toBe(true);
    // "A spoon handle ... resting on an arm stops it": 0.3 N at the tip is just more than the
    // 0.29 N the lower arm overcomes; 0.2 N at the tip of the upper arm is more than its 0.15 N.
    expect(armStalls(lower, p, 0.3 * lower.tipRadius)).toBe(true);
    expect(armStalls(lower, p, 0.27 * lower.tipRadius)).toBe(false);
    expect(
      armStalls(upper, armPressure(BOSCH_SMV4HAX40G, 'ur', 3000, 'upper'), 0.2 * upper.tipRadius),
    ).toBe(true);
    expect(armSteadyState(lower, p, margin * 1.01).stalled).toBe(true);
    expect(armSteadyState(lower, p, margin * 1.01).omega).toBe(0);
    // Half the margin taken by a contact halves the speed (the balance is linear).
    const free = armSteadyState(lower, p).omega;
    expectWithin(armSteadyState(lower, p, margin / 2).omega, free / 2, 1e-9);
  });

  it('reproduces the stated sensitivity of the lower arm to the elevation of its two drive holes', () => {
    // Section 5.5: "With the drive holes at 35 or 55 degrees of elevation: 50 or 31 rpm" (45
    // deg: 42 rpm), solved with the update's bearing.
    const p = armPressure(S, 'l', 3000, 'lower');
    const rpm = (rhoDeg: number) =>
      armSteadyState(withAngles(lowerAsSolved, { l7: [90, rhoDeg], l8: [90, rhoDeg] }), p).rpm;
    expectNear(rpm(35), 50, 0.6);
    expectNear(rpm(45), 42, 0.6);
    expectNear(rpm(55), 31, 0.6);
    // With this package's bearing the same range of elevation gives a similar spread.
    const here = (rhoDeg: number) =>
      armSteadyState(withAngles(lower, { l7: [90, rhoDeg], l8: [90, rhoDeg] }), p).rpm;
    expectNear(here(35) - here(55), rpm(35) - rpm(55), 3);
  });

  it('no longer depends on a tuned slot tilt: the upper arm is driven by its tip outlets and outer slots', () => {
    // The dossier tilted U2 to U5 by 16 deg to get any rotation and had the tip outlets point
    // radially. Measured: U2 and U3 are vertical, and the drive comes from U6 and U7 (tips), U5
    // and, weakly, U4. Shares of the 0.098 N m, by hand from the table of section 3.4 at 16.6
    // kPa (rho v^2 = 2 p): C_d A r cos(rho) sin(theta) in mm3:
    //   U4 0.78 x 10.56 x 160 x cos 78 x sin 90 = 274     U5 0.78 x 10.56 x 193 x cos 70 x sin 70 = 511
    //   U6 0.78 x 9.89 x 219 x cos 45 x sin 90  = 1195    U7 0.78 x 9.89 x 223 x cos 50 x sin 60  = 958
    const p = armPressure(S, 'ur', 3000, 'upper');
    const total = armTorqueTerms(upper, p).drive;
    const only = (ids: readonly string[]) =>
      armTorqueTerms({ ...upper, nozzles: upper.nozzles.filter((n) => ids.includes(n.id)) }, p)
        .drive;
    const sum = 274 + 511 + 1195 + 958;
    expectNear(only(['u4']) / total, 274 / sum, 0.002);
    expectNear(only(['u5']) / total, 511 / sum, 0.002);
    expectNear(only(['u6']) / total, 1195 / sum, 0.002);
    expectNear(only(['u7']) / total, 958 / sum, 0.002);
    expectNear(total, 2 * p * sum * 1e-9, 0.0002);
    expectNear(only(['u1', 'u2', 'u3', 'u8']), 0, 1e-15);
  });

  it('spins up in about 0.25 s after a diverter change', () => {
    const p = armPressure(BOSCH_SMV4HAX40G, 'l', 3000, 'lower');
    const tau = armTimeConstant(lower, p);
    // I / (sum m r^2 + c_v) = 3.5e-3 / (0.0131 + 0.002) = 0.23 s.
    expectNear(tau, 3.5e-3 / (0.0131 + 0.002), 0.002);
    const steady = armSteadyState(lower, p).omega;
    // From rest: 1 - exp(-0.3 / tau) of the steady speed after 0.3 s, and all of it after 3 s.
    expectWithin(advanceArmSpeed(lower, p, 0, 0.3), steady * (1 - Math.exp(-0.3 / tau)), 1e-9);
    expect(advanceArmSpeed(lower, p, 0, 0.3) / steady).toBeGreaterThan(0.65);
    expectWithin(advanceArmSpeed(lower, p, 0, 3), steady, 1e-4);
  });

  it("turns the way the owner's photographs show: lower clockwise, upper counter-clockwise", () => {
    // Owner update 2.4 and 3.3: both senses read off the photographs (the dossier had guessed).
    expect(lower.sense).toBe('cw');
    expect(upper.sense).toBe('ccw');
    expect(armSenseSign(lower)).toBe(-1);
    expect(armSenseSign(upper)).toBe(1);
    // The measured drive nozzles push each arm in its declared sense (a positive drive).
    expect(armTorqueTerms(lower, 20000).drive).toBeGreaterThan(0);
    expect(armTorqueTerms(upper, 20000).drive).toBeGreaterThan(0);
    // After one second at 30 rpm (pi rad/s) a clockwise arm's angle has decreased by pi.
    expectNear(advanceArmAngle(lower, 1, Math.PI, 1), 1 - Math.PI, 1e-12);
    expectNear(advanceArmAngle(upper, 1, Math.PI, 1), 1 + Math.PI, 1e-12);
  });
});

describe('arm rotation of SPOT-60 (machine.md section 3.3)', () => {
  const lower = getSprayArm(SPOT_60, 'lower');
  const mid = getSprayArm(SPOT_60, 'mid');
  const top = getSprayArm(SPOT_60, 'top');

  // [pump rpm, drive N m, dry friction k_f |F_ax| N m, speed rpm]. In this table T_f is the dry
  // friction alone: 0.137 - 0.068 = (35 rpm) x (sum(m r^2) + c_v).
  const lowerTable = [
    [3400, 0.177, 0.092, 38],
    [3000, 0.137, 0.068, 35],
    [2600, 0.102, 0.046, 32],
    [2200, 0.072, 0.028, 30],
    [1800, 0.047, 0.012, 28],
    [1400, 0.027, 0.0, 27],
  ] as const;
  const midTable = [
    [3400, 0.102, 0.057, 36],
    [3000, 0.078, 0.045, 30],
    [2600, 0.057, 0.034, 23],
    [2200, 0.038, 0.025, 16],
    [1800, 0.023, 0.017, 8],
    [1400, 0.011, 0.011, 0],
  ] as const;

  it.each(lowerTable)('lower arm at %i rpm', (rpm, drive, dryFriction, speed) => {
    const state = armSteadyState(lower, armPressure(SPOT_60, 'l', rpm, 'lower'));
    expectNear(state.drive, drive, 0.0011, 'drive');
    expectNear(state.staticFriction, dryFriction, 0.0011, 'dry friction');
    expectNear(state.rpm, speed, 0.7, 'speed');
  });

  it.each(midTable)('mid arm at %i rpm', (rpm, drive, dryFriction, speed) => {
    const state = armSteadyState(mid, armPressure(SPOT_60, 'u', rpm, 'mid'));
    expectNear(state.drive, drive, 0.0011, 'drive');
    expectNear(state.staticFriction, dryFriction, 0.0011, 'dry friction');
    expectNear(state.rpm, speed, 0.7, 'speed');
  });

  it('turns at its design speeds at 3000 rpm: 35 and 30 rpm, which k_f was tuned for', () => {
    expectWithin(
      armSteadyState(lower, armPressure(SPOT_60, 'l', 3000, 'lower')).omega,
      must(lower.designSpeed),
      0.02,
    );
    expectWithin(
      armSteadyState(mid, armPressure(SPOT_60, 'u', 3000, 'mid')).omega,
      must(mid.designSpeed),
      0.02,
    );
  });

  it('the mid arm stalls near 1400 rpm pump speed and the lower arm does not', () => {
    expect(armSteadyState(mid, armPressure(SPOT_60, 'u', 1400, 'mid')).stalled).toBe(true);
    expect(armSteadyState(mid, armPressure(SPOT_60, 'u', 1800, 'mid')).stalled).toBe(false);
    expect(armSteadyState(lower, armPressure(SPOT_60, 'l', 1400, 'lower')).stalled).toBe(false);
  });

  it('the lower arm stalls at a contact torque of about 0.07 N m: 0.3 N at the tip', () => {
    const p = armPressure(SPOT_60, 'l', 3000, 'lower');
    const margin = armTorqueTerms(lower, p).stallMargin;
    expectNear(margin, 0.07, 0.003);
    expectNear(margin / lower.tipRadius, 0.3, 0.03);
    expect(armStalls(lower, p, 0.075)).toBe(true);
    expect(armStalls(lower, p, 0.065)).toBe(false);
  });

  it('spins up with a time constant of about 0.3 s (I = 6.3e-3 kg m2)', () => {
    expectNear(armTimeConstant(lower, armPressure(SPOT_60, 'l', 3000, 'lower')), 0.3, 0.05);
  });

  it('reproduces the top-arm check as far as it can be: drive and brake, not the 60 rpm', () => {
    // "drive 0.020 N m, sum(m_dot r^2) = 6.2e-4 kg m2/s ... axial load about 2.5 N ... about
    // 60 rpm at 3000 rpm pump speed."
    const p = armPressure(SPOT_60, 'u', 3000, 'top');
    const terms = armTorqueTerms(top, p);
    expectNear(terms.drive, 0.02, 0.0005);
    expectNear(terms.brake, 6.2e-4, 0.06e-4);
    // With the dossier's stated axial load its own balance does give about 60 rpm ...
    const omegaStated =
      (terms.drive - top.bearing.frictionRadius * 2.5) / (terms.brake + top.bearing.viscous);
    expectNear(toRpm(omegaStated), 60, 3);
    // ... but the friction law of section 3.3 with the values of section 12.1 gives a larger
    // axial load: the pressure on the 12 mm hub alone is 2.8 N, and with thrust_sign -1 the
    // upward jet reaction (0.70 N) more than cancels the 0.6 N weight.
    expectNear(p * armHubArea(top), 2.82, 0.02);
    expectNear(terms.verticalReaction, -0.7, 0.01);
    expectNear(terms.axialLoad, 2.9, 0.05);
    // So this package turns the top arm at 44 rpm, not 60 (a known inconsistency of machine.md).
    expect(armSteadyState(top, p).rpm).toBeLessThan(50);
    expect(armSteadyState(top, p).rpm).toBeGreaterThan(40);
  });

  it('reproduces the DU750 check: ten 2 mm nozzles at 9 m/s give 0.083 N m and 8.97e-3 kg m2/s', () => {
    // Whirlpool DU750 lower arm, S1 Table 5.7: R (mm), theta, rho; C_d 0.9, all 2 mm round.
    const table = [
      [238, 90, 55],
      [226, 359, 89],
      [182, 160, 60],
      [145, 305, 70],
      [114, 90, 89],
      [89, 179, 89],
      [162, 65, 70],
      [194, 43, 62],
      [223, 90, 89],
      [238, 60, 55],
    ] as const;
    const du750: SprayArmSpec = {
      ...lower,
      nozzles: table.map(([r, theta, rho], i): NozzleSpec => ({
        ...must(lower.nozzles[0]),
        id: `n${i}`,
        radius: r / 1000,
        theta: degToRad(theta),
        rho: degToRad(rho),
        shape: 'round',
        size: [0.002],
        area: nozzleArea('round', [0.002]),
        cd: 0.9,
        cv: 1,
      })),
    };
    // 9 m/s jets: p = rho v^2 / 2.
    const terms = armTorqueTerms(du750, (WATER_DENSITY * 81) / 2);
    expectNear(terms.drive, 0.083, 0.001);
    expectNear(terms.brake, 8.97e-3, 0.03e-3);
    expectNear(toRpm(terms.drive / terms.brake), 88, 1);
    // "the measured 35 rpm needs T_f = 0.049 N m" (its own rounded figures give
    // 0.083 - 3.665 x 0.00897 = 0.050).
    expectNear(terms.drive - ((35 * Math.PI) / 30) * terms.brake, 0.049, 0.0015);
  });
});

describe('the torque balance on a one-nozzle arm (hand calculation)', () => {
  // One round nozzle of 10 mm2, C_d = C_v = 1, at r = 0.2 m, pointing straight back along the
  // direction of travel (theta 90 deg, rho 0). Its thrust is 2 p A, so at 20 kPa:
  //   drive = 2 p A r = 2 x 20000 x 1e-5 x 0.2 = 0.08 N m,
  //   m = rho A sqrt(2 p / rho) = sqrt(2 p rho) A = sqrt(2 x 20000 x 998) x 1e-5 = 0.063182 kg/s,
  //   brake = m r^2 = 0.0025273 kg m2/s.
  const base = getSprayArm(SPOT_60, 'lower');
  const arm: SprayArmSpec = {
    ...base,
    weight: 1,
    inertiaWet: 0.004,
    bearing: { frictionRadius: 0.01, viscous: 0.001, thrustSign: -1, hubBore: 0.02 },
    nozzles: [
      {
        ...must(base.nozzles[0]),
        id: 'n',
        radius: 0.2,
        theta: Math.PI / 2,
        rho: 0,
        shape: 'round',
        size: [0.003568],
        area: 1e-5,
        cd: 1,
        cv: 1,
      },
    ],
  };
  const p = 20000;
  const massFlow = Math.sqrt(2 * p * WATER_DENSITY) * 1e-5;

  it('gives drive = 2 p A r, brake = m r^2 and the axial load p A_hub - W', () => {
    const terms = armTorqueTerms(arm, p);
    expectWithin(terms.drive, 0.08, 1e-12);
    expectWithin(terms.massFlow, massFlow, 1e-12);
    expectNear(massFlow, 0.063182, 5e-7);
    expectWithin(terms.brake, massFlow * 0.04, 1e-12);
    expectNear(terms.verticalReaction, 0, 1e-15);
    // A_hub = pi (0.02)^2 / 4 = 3.1416e-4 m2; p A_hub = 6.2832 N; F_ax = 6.2832 - 1 = 5.2832 N.
    expectWithin(armHubArea(arm), Math.PI * 1e-4, 1e-12);
    expectWithin(terms.axialLoad, 20000 * Math.PI * 1e-4 - 1, 1e-12);
    expectWithin(terms.staticFriction, 0.01 * (20000 * Math.PI * 1e-4 - 1), 1e-12);
  });

  it('gives the steady speed (drive - k_f |F_ax|) / (brake + c_v)', () => {
    const friction = 0.01 * (20000 * Math.PI * 1e-4 - 1);
    const omega = (0.08 - friction) / (massFlow * 0.04 + 0.001);
    const state = armSteadyState(arm, p);
    expectWithin(state.omega, omega, 1e-12);
    // (0.08 - 0.052832) / (0.0025273 + 0.001) = 7.7023 rad/s = 73.55 rpm.
    expectNear(state.omega, 7.7023, 0.0005);
    expectNear(state.rpm, 73.55, 0.01);
    expectWithin(state.frictionTorque, friction + 0.001 * omega, 1e-12);
  });

  it('halves the drive when half the nozzle is blocked, at the same pressure', () => {
    const terms = armTorqueTerms(arm, p, { blockage: { n: 0.5 } });
    expectWithin(terms.drive, 0.04, 1e-12);
    expectWithin(terms.brake, (massFlow / 2) * 0.04, 1e-12);
  });

  it('a jet pointing forward turns the arm backwards against the same friction', () => {
    const reversed = withAngles(arm, { n: [-90, 0] });
    const forward = armSteadyState(arm, p);
    const backward = armSteadyState(reversed, p);
    expectWithin(backward.omega, -forward.omega, 1e-12);
    expect(backward.drive).toBeLessThan(0);
  });

  it('integrates the transient equation exactly: against a fine numerical integration', () => {
    // Spin-up from rest, and slow-down from twice the steady speed, over one second.
    for (const start of [0, 2 * armSteadyState(arm, p).omega]) {
      let omega = start;
      const n = 200000;
      const h = 1 / n;
      for (let i = 0; i < n; i++) omega += armAngularAcceleration(arm, p, omega) * h;
      expectWithin(advanceArmSpeed(arm, p, start, 1), omega, 1e-4, `from ${start}`);
    }
  });

  it('comes to rest under a contact torque above the margin and stays at rest', () => {
    const steady = armSteadyState(arm, p).omega;
    const margin = armTorqueTerms(arm, p).stallMargin;
    const contact = margin + 0.02;
    // Deceleration follows omega' = (drive - T_f0 - T_c - (brake + c_v) omega) / I: the speed
    // reaches zero at t = (I / k) ln((omega_0 - w) / -w) with w = -0.02 / k.
    const k = massFlow * 0.04 + 0.001;
    const w = -0.02 / k;
    const tStop = (0.004 / k) * Math.log((steady - w) / -w);
    expect(advanceArmSpeed(arm, p, steady, tStop * 0.9, contact)).toBeGreaterThan(0);
    expect(advanceArmSpeed(arm, p, steady, tStop * 1.1, contact)).toBe(0);
    expect(advanceArmSpeed(arm, p, 0, 5, contact)).toBe(0);
    expect(armAngularAcceleration(arm, p, 0, contact)).toBe(0);
    // Released, it starts again.
    expect(armAngularAcceleration(arm, p, 0, 0)).toBeGreaterThan(0);
    expectWithin(armAngularAcceleration(arm, p, 0, 0), margin / 0.004, 1e-12);
  });

  it('opposes motion in either direction', () => {
    const steady = armSteadyState(arm, p).omega;
    // Thrown backwards at the steady speed, the arm is braked by the drive, the friction and
    // the water it must spin up, all in the same direction.
    const terms = armTorqueTerms(arm, p);
    const expected = (terms.drive + terms.staticFriction + (terms.brake + 0.001) * steady) / 0.004;
    expectWithin(armAngularAcceleration(arm, p, -steady), expected, 1e-12);
    // It comes to rest when w + (-steady - w) exp(-k t / I) = 0 with w = (drive + T_f0) / k,
    // and then runs up forwards from rest for what is left of the step.
    const k = terms.brake + 0.001;
    const w = (terms.drive + terms.staticFriction) / k;
    const tStop = (0.004 / k) * Math.log((steady + w) / w);
    expectNear(tStop, 0.211, 0.001);
    expect(advanceArmSpeed(arm, p, -steady, 0.9 * tStop)).toBeLessThan(0);
    expectWithin(
      advanceArmSpeed(arm, p, -steady, 0.5),
      steady * (1 - Math.exp((-k * (0.5 - tStop)) / 0.004)),
      1e-9,
    );
    expectWithin(advanceArmSpeed(arm, p, -steady, 30), steady, 1e-6);
  });
});
