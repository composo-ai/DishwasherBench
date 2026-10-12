// Contract tests of module M11: the four additions it needs from @spotless/physics, named as
// docs/design/sim-core.md names them, and the shapes of its records with the numbers of the
// contract.
import { POSE_IDENTITY, STANDARD_GRAVITY } from '@spotless/core';
import { LOADING_TIME_STEP } from '@spotless/physics';
import { describe, expect, it } from 'vitest';
import {
  ARM_PROFILE_KNOTS,
  PHYSICS_ADDITIONS,
  RIGID_TRIGGERS,
  type PhysicsWorldAdditions,
  type RigidEvent,
  type RigidResult,
  type Wrench,
} from './index.ts';

describe('the four additions to @spotless/physics (section M11)', () => {
  it('are the four methods the contract names', () => {
    // "`setMassProperties(id, mass)` to change a body's mass properties in place (pooled
    // water); `contactWrench(id)` to read the contact force and torque on a kinematic body
    // after a step (arm torque balance); `setBodyKind(id, kind)` to turn a static item into a
    // dynamic one ...; and `awakeBodies()` to list the dynamic bodies that are not asleep"
    const sentence =
      '`setMassProperties(id, mass)` `contactWrench(id)` `setBodyKind(id, kind)` `awakeBodies()`';
    const named = [...sentence.matchAll(/`(\w+)\(([^)]*)\)`/g)].map((m) => ({
      name: m[1] as string,
      arity: (m[2] as string).split(',').filter((a) => a.trim() !== '').length,
    }));
    expect(named.map((n) => n.name)).toEqual([...PHYSICS_ADDITIONS]);

    // An object with exactly these methods satisfies the interface, with the arities above.
    const calls: string[] = [];
    const additions: PhysicsWorldAdditions = {
      setMassProperties: (id, mass) => {
        calls.push(`mass ${id} ${mass.mass}`);
      },
      contactWrench: (id) => {
        calls.push(`wrench ${id}`);
        return { force: [0, 0, 0], torque: [0, 0, 0.07] };
      },
      setBodyKind: (id, kind) => {
        calls.push(`kind ${id} ${kind}`);
      },
      awakeBodies: () => ['lid_01'],
    };
    expect(Object.keys(additions)).toEqual([...PHYSICS_ADDITIONS]);
    for (const { name, arity } of named) {
      expect(additions[name as keyof PhysicsWorldAdditions].length, name).toBe(arity);
    }
    // The lower arm stalls at a contact torque of 0.07 N m (M4 tests): that is what
    // `contactWrench` of the arm body reads along its hinge axis.
    expect(additions.contactWrench('lower_arm').torque[2]).toBe(0.07);
    additions.setBodyKind('tub_01', 'dynamic');
    expect(calls).toEqual(['wrench lower_arm', 'kind tub_01 dynamic']);
  });
});

describe('records of M11', () => {
  it('runs the wash world at the step of the loading physics', () => {
    // "Jolt at 1/240 s through `@spotless/physics`"
    expect(LOADING_TIME_STEP).toBe(1 / 240);
  });

  it('reproduces the lid example that motivates live wrenches', () => {
    // "With a frozen load table a 20 g lid under a 0.42 N jet would be pushed for the whole
    // 0.19 s dwell and gain 2.1 m/s": the net upward force is the jet force less the weight.
    const jet: Wrench = { item: 'lid_01', forceN: [0, 0, 0.42], torqueNm: [0, 0, 0] };
    const mass = 0.02;
    const gained = ((jet.forceN[2] - mass * STANDARD_GRAVITY) * 0.19) / mass;
    expect(Math.abs(gained - 2.1)).toBeLessThan(0.05);
    // The dwell spans 45 engine steps, so re-casting the jets at every step ends the load
    // within about 2 % of the dwell after the lid has left the jet.
    const steps = 0.19 / LOADING_TIME_STEP;
    expect(steps).toBeGreaterThan(45);
    expect(1 / steps).toBeLessThan(0.025);
  });

  it('accepts the result of a shake-down with a moved item and a knocking arm', () => {
    const tipped: RigidEvent = {
      trigger: 'shakeDown',
      item: 'tub_01',
      dPos_m: 0.04,
      dAng_rad: 1.2,
    };
    const knock: RigidEvent = { trigger: 'armContact', arm: 0, dPos_m: 0, dAng_rad: 0 };
    const result: RigidResult = {
      poses: new Map([['tub_01', POSE_IDENTITY]]),
      moved: [{ item: 'tub_01', dPos_m: 0.04, dAng_rad: 1.2 }],
      arms: [
        {
          arm: 0,
          state: { kind: 'knocking', profile: 'sha256:ab' },
          meanOmega: 2.9,
          phaseTime: new Float32Array(ARM_PROFILE_KNOTS),
        },
        { arm: 1, state: { kind: 'free' }, meanOmega: -3.14 },
      ],
      contacts: [],
      events: [tipped, knock],
      settled: true,
      simulated_s: 5.1,
    };
    // Tolerance of the shake-down: an item counts as moved beyond 2 mm or 2 degrees.
    const moved = result.moved[0];
    expect(moved?.dPos_m).toBeGreaterThan(2e-3);
    expect(moved?.dAng_rad).toBeGreaterThan((2 * Math.PI) / 180);
    // "phaseTime?: Float32Array /* 256 knots, knocking arm */"
    expect(result.arms[0]?.phaseTime).toHaveLength(256);
    // `rigid.shakeBudget` = 40 simulated seconds.
    expect(result.simulated_s).toBeLessThanOrEqual(40);
  });

  it('names the shake-down and the four triggers of the event table', () => {
    // "Events after the shake-down": a basin's water changes an item's mass or a basin first
    // fills; arm contact torque becomes non-zero; dispenser opens; end of the wash.
    expect(RIGID_TRIGGERS).toEqual([
      'shakeDown',
      'basinFill',
      'armContact',
      'dispenser',
      'washEnd',
    ]);
  });
});
