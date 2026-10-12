import { degToRad, rpmToRadPerS, v3Dot, v3Length } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { getNozzle, getSprayLevel } from './config.ts';
import { nozzleDirection, nozzleExitZ, nozzleState } from './kinematics.ts';
import { BOSCH_SMV4HAX40G, SPOT_60 } from './machines.ts';
import { expectNear, mutableCopy } from './test-util.ts';
import type { MachineConfig } from './types.ts';

const cos = (deg: number) => Math.cos(degToRad(deg));
const sin = (deg: number) => Math.sin(degToRad(deg));

/** The Bosch default configuration with the upper basket at a given Rackmatic level. */
function boschAtLevel(level: string): MachineConfig {
  return { ...BOSCH_SMV4HAX40G.defaultConfig, basketHeights: { upper: level } };
}

describe('nozzleState: hand calculations (machine.md section 12.2 item 3)', () => {
  // The Bosch nozzles are those measured on the owner's arms (machine-bosch-owner-update.md
  // section 7); the positions and directions below are worked by hand from that table.
  it('Bosch L8 (the hooded drive hole on the "-" blade) at arm angle 0', () => {
    // The lower arm turns clockwise (sigma = -1). L8: blade "-", R = 207 mm, theta = 90 deg,
    // rho = 45 deg, in the top face (nozzle plane z = 52 mm).
    //   e_r     = (cos pi, sin pi, 0)            = (-1, 0, 0)
    //   e_lead  = sigma (-sin pi, cos pi, 0)     = (0, 1, 0)
    //   e_trail = (0, -1, 0)
    //   x = (0, 0, 0.052) + 0.207 e_r            = (-0.207, 0, 0.052)
    //   d = cos 45 e_trail + sin 45 e_z          = (0, -0.7071, 0.7071)
    // At 42 rpm (4.3982 rad/s) and a 6.65 m/s jet:
    //   omega R e_lead = (0, 0.9104, 0)
    //   u = 6.65 d + (0, 0.9104, 0)              = (0, -3.7919, 4.7023)
    const omega = rpmToRadPerS(42);
    const s = nozzleState(BOSCH_SMV4HAX40G, 'lower', 'l8', 0, omega, 6.65);
    expectNear(s.position[0], -0.207, 1e-12);
    expectNear(s.position[1], 0, 1e-12);
    expectNear(s.position[2], 0.052, 1e-12);
    expectNear(s.direction[0], 0, 1e-12);
    expectNear(s.direction[1], -0.7071, 5e-5);
    expectNear(s.direction[2], 0.7071, 5e-5);
    expectNear(s.nozzleVelocity[1], 0.9104, 5e-4);
    expectNear(s.velocity[0], 0, 1e-12);
    expectNear(s.velocity[1], -3.7919, 1e-3);
    expectNear(s.velocity[2], 4.7023, 1e-3);
  });

  it('Bosch L10 (tip slot of the three-hole blade, theta 90, rho 75) with the "+" blade pointing along +y', () => {
    // Arm angle 90 deg: the "+" blade points to +y, the "-" blade (which carries L10) to -y.
    //   e_r     = (cos 270, sin 270, 0) = (0, -1, 0)
    //   e_lead  = -1 x (-sin 270, cos 270, 0) = -1 x (1, 0, 0) = (-1, 0, 0)   (clockwise)
    //   e_trail = (1, 0, 0)
    //   x = 0.225 e_r = (0, -0.225, 0.052)
    //   d = cos 75 e_trail + sin 75 e_z = (0.2588, 0, 0.9659): "angled slightly backward".
    const s = nozzleState(BOSCH_SMV4HAX40G, 'lower', 'l10', Math.PI / 2, 0, 1);
    expectNear(s.position[0], 0, 1e-12);
    expectNear(s.position[1], -0.225, 1e-12);
    expectNear(s.direction[0], 0.2588, 5e-5);
    expectNear(s.direction[1], 0, 1e-12);
    expectNear(s.direction[2], 0.9659, 5e-5);
    // A stationary arm adds nothing to the jet.
    expect(s.nozzleVelocity).toEqual([0, 0, 0]);
    expectNear(v3Length(s.velocity), 1, 1e-12);
    // Its twin L9 on the "+" blade is "angled slightly radially outward": at the same arm angle
    // e_r = (0, 1, 0) and d = cos 75 e_r + sin 75 e_z = (0, 0.2588, 0.9659), towards the wall.
    const l9 = nozzleState(BOSCH_SMV4HAX40G, 'lower', 'l9', Math.PI / 2, 0, 1);
    expectNear(l9.position[1], 0.225, 1e-12);
    expectNear(l9.direction[0], 0, 1e-12);
    expectNear(l9.direction[1], 0.2588, 5e-5);
  });

  it('Bosch L11 (underside outlet): leaves downward and slightly inward from the lower nozzle plane', () => {
    // "+" blade, R = 207 mm, theta 180, rho -70, underside: z = 36 mm.
    //   arm angle 0: e_r = (1, 0, 0), e_lead = -1 x (0, 1, 0) = (0, -1, 0), e_trail = (0, 1, 0)
    //   d = cos(-70) (cos 180 e_r + sin 180 e_trail) + sin(-70) e_z = (-0.3420, 0, -0.9397)
    const s = nozzleState(BOSCH_SMV4HAX40G, 'lower', 'l11', 0, 0, 6.65);
    expectNear(s.position[0], 0.207, 1e-12);
    expectNear(s.position[2], 0.036, 1e-12);
    expectNear(s.direction[0], cos(-70) * cos(180), 1e-12);
    expectNear(s.direction[0], -0.342, 5e-5);
    expectNear(s.direction[1], 0, 1e-12);
    expectNear(s.direction[2], -0.9397, 5e-5);
  });

  it('Bosch U5 (a tilted slot of the counter-clockwise upper arm) at each Rackmatic level', () => {
    // Upper arm: axis (0, -30) mm, sigma = +1. U5: "-" blade, R = 193 mm, theta 70, rho 70
    // ("facing backwards and slightly outwards").
    //   arm angle 0: e_r = (cos pi, sin pi, 0) = (-1, 0, 0), e_lead = (-sin pi, cos pi, 0)
    //   = (0, -1, 0), e_trail = (0, 1, 0)
    //   x = (-0.193, -0.030, floor - 0.021)
    //   d = cos 70 (cos 70 e_r + sin 70 e_trail) + sin 70 e_z = (-0.1170, 0.3214, 0.9397)
    // The nozzle exits are 21 mm below the upper-basket floor, which the owner measured at 420
    // mm at level 1: 399 / 374 / 349 mm at level 1 / 2 / 3.
    for (const [level, z] of [
      ['1', 0.399],
      ['2', 0.374],
      ['3', 0.349],
    ] as const) {
      const s = nozzleState(BOSCH_SMV4HAX40G, 'upper', 'u5', 0, 0, 5.77, boschAtLevel(level));
      expectNear(s.position[0], -0.193, 1e-12);
      expectNear(s.position[1], -0.03, 1e-12);
      expectNear(s.position[2], z, 1e-12, `level ${level}`);
      expectNear(s.direction[0], -0.117, 5e-5);
      expectNear(s.direction[1], 0.3214, 5e-5);
      expectNear(s.direction[2], 0.9397, 5e-5);
    }
    // The default configuration is level 1.
    expectNear(nozzleState(BOSCH_SMV4HAX40G, 'upper', 'u5', 0, 0, 5.77).position[2], 0.399, 1e-12);
  });

  it('Bosch U8 (the underside hole of the upper arm) leaves straight down from the blade underside', () => {
    // "+" blade, R = 38 mm, rho -90, underside: 34 mm below the basket floor, 386 mm at level 1.
    const s = nozzleState(BOSCH_SMV4HAX40G, 'upper', 'u8', 0, 0, 5.77);
    expectNear(s.position[0], 0.038, 1e-12);
    expectNear(s.position[1], -0.03, 1e-12);
    expectNear(s.position[2], 0.386, 1e-12);
    expectNear(s.direction[0], 0, 1e-12);
    expectNear(s.direction[1], 0, 1e-12);
    expectNear(s.direction[2], -1, 1e-12);
  });

  it('the trailing direction is opposite to the motion for both rotation senses', () => {
    // A theta = 90 nozzle throws water backwards: its horizontal jet component opposes the
    // nozzle's own velocity, whatever the sense of rotation. L8 on the clockwise lower arm, U6
    // on the counter-clockwise upper arm.
    for (const [level, id] of [
      ['lower', 'l8'],
      ['upper', 'u6'],
    ] as const) {
      for (const angle of [0, 1, 2.5, -4]) {
        const s = nozzleState(BOSCH_SMV4HAX40G, level, id, angle, 3, 7);
        const horizontal = [s.direction[0], s.direction[1], 0] as const;
        expect(v3Dot(horizontal, s.nozzleVelocity)).toBeLessThan(0);
      }
    }
  });

  it('the senses the photographs show: seen from above the lower arm turns clockwise, the upper counter-clockwise', () => {
    // Owner update 2.4: with the tip of a lower-arm blade pointing south (-y) and seen from
    // above, the hooded jet goes east (+x) and pushes the tip west: clockwise. "-" blade to -y
    // is arm angle 90 deg.
    const l8 = nozzleState(BOSCH_SMV4HAX40G, 'lower', 'l8', Math.PI / 2, 1, 6.65);
    expect(l8.position[1]).toBeLessThan(0);
    expect(l8.direction[0]).toBeGreaterThan(0.7);
    expect(l8.nozzleVelocity[0]).toBeLessThan(0);
    // Owner update 3.3: wing A of the upper arm seen from above with its tip at the bottom
    // (-y): the mouth of U6 faces left, the jet goes west (-x) and pushes the tip east:
    // counter-clockwise. "+" blade to -y is arm angle -90 deg.
    const u6 = nozzleState(BOSCH_SMV4HAX40G, 'upper', 'u6', -Math.PI / 2, 1, 5.77);
    expect(u6.position[1]).toBeLessThan(-0.03);
    expect(u6.direction[0]).toBeLessThan(-0.7);
    expect(u6.nozzleVelocity[0]).toBeGreaterThan(0);
  });

  it('the roof outlet sits on its axis and points straight down, whatever the angle', () => {
    // 15 mm under the roof the owner measured at 640 mm.
    for (const angle of [0, 1.3]) {
      const s = nozzleState(BOSCH_SMV4HAX40G, 'roof', 'r1', angle, 0, 6.35);
      expectNear(s.position[0], 0, 1e-12);
      expectNear(s.position[1], 0.02, 1e-12);
      expectNear(s.position[2], 0.625, 1e-12);
      expectNear(s.direction[0], 0, 1e-12);
      expectNear(s.direction[1], 0, 1e-12);
      expectNear(s.direction[2], -1, 1e-12);
      expectNear(s.velocity[2], -6.35, 1e-12);
    }
  });

  it('a vertical jet at the tip is deflected by up to 6 deg at 35 rpm (machine.md 12.2)', () => {
    // "omega R_i e_lead (the nozzle's own motion; up to 0.9 m/s, a deflection of up to 6 deg
    // for a vertical jet)": SPOT-60 L9, R = 223 mm, rho 89, at 35 rpm and 8.36 m/s.
    const omega = rpmToRadPerS(35);
    const s = nozzleState(SPOT_60, 'lower', 'l9', 0.7, omega, 8.36);
    expectNear(v3Length(s.nozzleVelocity), omega * 0.223, 1e-12);
    expectNear(v3Length(s.nozzleVelocity), 0.82, 0.01);
    expect(v3Length(s.nozzleVelocity)).toBeLessThan(0.9);
    const horizontal = Math.hypot(s.velocity[0], s.velocity[1]);
    const deflectionDeg = (Math.atan2(horizontal, s.velocity[2]) * 180) / Math.PI;
    expect(deflectionDeg).toBeGreaterThan(4);
    expect(deflectionDeg).toBeLessThan(6.5);
    // SPOT-60's lower arm turns counter-clockwise: at angle 0.7 the "+" blade's velocity is
    // omega R (-sin 0.7, cos 0.7, 0).
    expectNear(s.nozzleVelocity[0], -omega * 0.223 * Math.sin(0.7), 1e-12);
    expectNear(s.nozzleVelocity[1], omega * 0.223 * Math.cos(0.7), 1e-12);
  });

  it('SPOT-60 mid arm (clockwise, under the upper rack): M9 sprays down from below the rack', () => {
    // M9: "+" blade, R = 190 mm, theta 0, rho -75, underside: nozzle plane 33 mm below the
    // grid top, which is at 375 mm in the default (middle) position: z = 342 mm.
    const s = nozzleState(SPOT_60, 'mid', 'm9', Math.PI, 0, 8.2);
    expectNear(s.position[0], -0.19, 1e-12);
    expectNear(s.position[2], 0.342, 1e-12);
    // d = cos(-75) e_r + sin(-75) e_z with e_r = (-1, 0, 0).
    expectNear(s.direction[0], -cos(75), 1e-12);
    expectNear(s.direction[2], -sin(75), 1e-12);
  });
});

describe('nozzleState: invariants', () => {
  it('directions are unit vectors and the nozzle stays at its radius and height', () => {
    for (const spec of [BOSCH_SMV4HAX40G, SPOT_60]) {
      for (const level of spec.sprayLevels) {
        for (const nozzle of level.nozzles) {
          for (const angle of [0, 0.4, 2, 3.5, 5.9]) {
            const s = nozzleState(spec, level.id, nozzle.id, angle, 3.2, 7.5);
            expectNear(v3Length(s.direction), 1, 1e-12, `${level.id}.${nozzle.id}`);
            expectNear(
              Math.hypot(s.position[0] - level.axis[0], s.position[1] - level.axis[1]),
              nozzle.radius,
              1e-12,
            );
            expectNear(s.position[2], nozzleExitZ(spec, level, nozzle), 1e-12);
            // The jet's elevation is rho, the same at every arm angle.
            expectNear(s.direction[2], Math.sin(nozzle.rho), 1e-12);
            // u = v d + nozzle velocity.
            for (const i of [0, 1, 2] as const) {
              expectNear(s.velocity[i], 7.5 * s.direction[i] + s.nozzleVelocity[i], 1e-12);
            }
            // The nozzle moves tangentially at omega R.
            expectNear(v3Length(s.nozzleVelocity), 3.2 * nozzle.radius, 1e-12);
            expectNear(
              s.nozzleVelocity[0] * (s.position[0] - level.axis[0]) +
                s.nozzleVelocity[1] * (s.position[1] - level.axis[1]),
              0,
              1e-12,
            );
          }
        }
      }
    }
  });

  it('turning the arm by half a turn swaps the two blades', () => {
    const lower = getSprayLevel(BOSCH_SMV4HAX40G, 'lower');
    const l9 = getNozzle(lower, 'l9');
    const a = nozzleDirection(l9, 0.3, -1);
    const b = nozzleDirection({ ...l9, blade: '-' }, 0.3 + Math.PI, -1);
    for (const i of [0, 1, 2] as const) expectNear(a[i], b[i], 1e-12);
  });

  it('matches the finite-difference velocity of the nozzle position', () => {
    // The nozzle velocity is the time derivative of its position as the arm angle advances by
    // sigma omega: check by central difference for a clockwise and a counter-clockwise arm.
    const omega = 3.4;
    const h = 1e-6;
    for (const [level, id, sigma] of [
      ['lower', 'l7', -1],
      ['upper', 'u5', 1],
    ] as const) {
      const angle = 1.1;
      const before = nozzleState(BOSCH_SMV4HAX40G, level, id, angle - sigma * omega * h, omega, 0);
      const after = nozzleState(BOSCH_SMV4HAX40G, level, id, angle + sigma * omega * h, omega, 0);
      const s = nozzleState(BOSCH_SMV4HAX40G, level, id, angle, omega, 0);
      for (const i of [0, 1, 2] as const) {
        expectNear(s.nozzleVelocity[i], (after.position[i] - before.position[i]) / (2 * h), 1e-7);
      }
    }
  });

  it('throws for ids the machine does not have', () => {
    expect(() => nozzleState(BOSCH_SMV4HAX40G, 'mid', 'm1', 0, 0, 1)).toThrow(RangeError);
    expect(() => nozzleState(BOSCH_SMV4HAX40G, 'lower', 'l99', 0, 0, 1)).toThrow(RangeError);
    // An upward nozzle on an arm without an upward nozzle plane is a data error.
    const broken = mutableCopy(SPOT_60);
    const top = broken.sprayLevels.find((l) => l.id === 'top');
    if (top === undefined || top.kind !== 'arm') throw new Error('no top arm');
    const first = top.nozzles[0];
    if (first === undefined) throw new Error('no nozzle');
    first.face = 'top';
    expect(() => nozzleState(broken, 'top', first.id, 0, 0, 1)).toThrow(RangeError);
  });
});
