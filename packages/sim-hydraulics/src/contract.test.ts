// Contract tests of module M4: the constants of the time base against the figures that
// docs/design/sim-core.md quotes from them, and the shapes of the M4 records with the numbers
// of the contract's own test list.
import { rpmToRadPerS } from '@spotless/core';
import type * as machine from '@spotless/machine';
import { describe, expect, it } from 'vitest';
import {
  ARM_PROFILE_KNOTS,
  BASE_STEP_TARGET_S,
  PHASE_BINS_PER_REV,
  PHASE_UNITS_PER_REV,
  STALL_ANGLE_STEPS,
  STEPS_PER_REV_ALL_STALLED,
  type ArmMotion,
  type ControllerFeedback,
  type HydraulicPoint,
  type LiquorProps,
  type MachineConfig,
  type MachineModel,
  type MachineSpec,
  type NozzleJet,
  type ProgrammeSpec,
} from './index.ts';

/** Section M4: stepsPerRev = 64 x ceil(T_master / (64 x 2 ms)). */
function stepsPerRev(period_s: number): number {
  return PHASE_BINS_PER_REV * Math.ceil(period_s / (PHASE_BINS_PER_REV * BASE_STEP_TARGET_S));
}

describe('time base of a combo (section M4)', () => {
  it('reproduces the step counts and base steps the contract quotes', () => {
    // "896 steps and 1.913 ms at 35 rpm; 1,024 and 1.953 ms at 30 rpm"
    const t35 = 60 / 35;
    expect(stepsPerRev(t35)).toBe(896);
    expect((t35 / stepsPerRev(t35)) * 1e3).toBeCloseTo(1.913, 3);
    const t30 = 60 / 30;
    expect(stepsPerRev(t30)).toBe(1024);
    expect((t30 / stepsPerRev(t30)) * 1e3).toBeCloseTo(1.953, 3);
    // "If no fed arm rotates ... the period is the nominal `hyd.nominalPeriod` = 2.0 s ... and
    // stepsPerRev = 1,024".
    expect(stepsPerRev(2.0)).toBe(STEPS_PER_REV_ALL_STALLED);
  });

  it('gives whole base steps per phase bin and the bin lengths the contract quotes', () => {
    // Section 2.3: one command buffer per half phase bin, 7 to 10 base steps.
    // Section M6: a phase bin lasts 27 to 37 ms.
    // Section M7.8: the slowest arm planned for has 1,216 steps per revolution.
    for (const steps of [896, 1024, 1216]) {
      expect(steps % PHASE_BINS_PER_REV).toBe(0);
      const half = steps / PHASE_BINS_PER_REV / 2;
      expect(half).toBeGreaterThanOrEqual(7);
      expect(half).toBeLessThanOrEqual(10);
    }
    expect((60 / 35 / PHASE_BINS_PER_REV) * 1e3).toBeCloseTo(27, 0);
    const slowest = 1216 * BASE_STEP_TARGET_S;
    expect((slowest / PHASE_BINS_PER_REV) * 1e3).toBeGreaterThan(36);
    expect((slowest / PHASE_BINS_PER_REV) * 1e3).toBeLessThan(39);
  });

  it('advances a free master arm by one revolution per revolution within the rounding', () => {
    // "a free arm advances by round(2^32 dt0 / T_arm) per base step": the increment is off by
    // at most half a unit, so a revolution of n steps is off by at most n / 2 units of 2^-32.
    for (const steps of [896, 1024, 1216]) {
      const increment = Math.round(PHASE_UNITS_PER_REV / steps);
      const error = Math.abs(increment * steps - PHASE_UNITS_PER_REV) / PHASE_UNITS_PER_REV;
      expect(error).toBeLessThanOrEqual(steps / 2 ** 33);
      // That is under one hundredth of one of the 16,384 phase steps of the trace.
      expect(error * 16384).toBeLessThan(1e-2);
    }
    // A u32 phase resolves the 16,384 phases of the official trace and the 32,768 of the
    // reference tier with bits to spare.
    expect(PHASE_UNITS_PER_REV / 32768).toBe(2 ** 17);
  });

  it('quantises a stalled arm and tabulates a knocking arm in 256 steps', () => {
    // "{ kind: 'stalled'; angleQ: number /* 1/256 revolution */ }"; "256 knots over its own
    // period".
    expect(STALL_ANGLE_STEPS).toBe(256);
    expect(ARM_PROFILE_KNOTS).toBe(256);
  });
});

describe('records of M4', () => {
  it('accepts the lower-arm test point of the contract as a HydraulicPoint', () => {
    // M4 tests: "Lower arm alone at 3000 rpm: 41.6 kPa at the pump, 30.7 L/min, 34.9 kPa in
    // the arm, jet speed 8.11 m/s (0.97 x 8.36)"; "arm speeds 35, 30, 60 rpm at 3000 rpm".
    const armPressure = 34.9e3;
    const jetSpeed = 0.97 * Math.sqrt((2 * armPressure) / 1000);
    expect(jetSpeed).toBeCloseTo(8.11, 1);

    const period = 60 / 35;
    const steps = stepsPerRev(period);
    const lower: ArmMotion = {
      arm: 0,
      state: { kind: 'free' },
      omega_rad_s: rpmToRadPerS(35),
      period_s: period,
      phase0: 0x9e3779b9,
      phaseAt: (baseStep) =>
        (0x9e3779b9 + baseStep * Math.round(PHASE_UNITS_PER_REV / steps)) % PHASE_UNITS_PER_REV,
      dwellAt: () => period / 16384,
    };
    const jet: NozzleJet = {
      arm: 0,
      nozzle: 3,
      subJet: 0,
      posArm: [0.12, 0, 0.03],
      dirArm: [0, 0.17, 0.985],
      Q_m3_s: 30.7 / 60000 / 10,
      Vrel_m_s: jetSpeed,
      d_m: 2.25e-3,
    };
    const point: HydraulicPoint = {
      combo: { diverter: 'L', pumpClass: 3000, liquor: 'D', arms: [lower.state] },
      pumpRpm: 3000,
      fH: 1,
      arms: [lower],
      nozzles: [jet],
      masterArm: 0,
      masterPeriod_s: period,
      stepsPerRev: steps,
      dt0_s: period / steps,
    };
    expect(point.arms).toHaveLength(point.combo.arms.length);
    // One revolution of the free arm returns it to its start phase within the rounding of the
    // increment.
    const back = lower.phaseAt(steps);
    const drift = Math.min(
      Math.abs(back - lower.phase0),
      PHASE_UNITS_PER_REV - Math.abs(back - lower.phase0),
    );
    expect(drift / PHASE_UNITS_PER_REV).toBeLessThanOrEqual(steps / 2 ** 33);
    // The dwells of the 16,384 phases add up to the period.
    expect(16384 * lower.dwellAt(0)).toBeCloseTo(period, 12);
  });

  it('accepts liquor properties and controller feedback in SI', () => {
    // Class D at its solve temperature of 55 C: sigma 40 mN/m (M7.9), water otherwise.
    const liquor: LiquorProps = {
      cls: 'D',
      T_K: 328.15,
      rho: 985.7,
      mu: 5.04e-4,
      sigma: 0.04,
      gammaW: 0.0671,
    };
    // Kinematic viscosity at 55 C lies between the 45 C and 65 C gather points of M5
    // (0.602 and 0.442 x 10^-6 m2/s).
    const nu = liquor.mu / liquor.rho;
    expect(nu).toBeLessThan(0.602e-6);
    expect(nu).toBeGreaterThan(0.442e-6);

    const feedback: ControllerFeedback = {
      liquorT_K: 310,
      liquorClass: 'W',
      V_air: 0.2e-3,
      V_film: 0.6e-3,
      V_trap: 0.1e-3,
      V_filter: 0.05e-3,
      V_absorbed: 0.02e-3,
      arms: [{ kind: 'free' }, { kind: 'free' }, { kind: 'stalled', angleQ: 12 }],
      lastTickPeriod_s: 60 / 35,
    };
    // Section 8.1: film plus airborne hold-up of 0.4 to 1.5 L.
    const holdUp = (feedback.V_air + feedback.V_film) * 1e3;
    expect(holdUp).toBeGreaterThanOrEqual(0.4);
    expect(holdUp).toBeLessThanOrEqual(1.5);
  });

  it('takes the machine description and the programmes from @spotless/machine unchanged', () => {
    // Compile-time checks of the boundary: the three types M4 names are the types of the
    // machine package itself, in both directions, so a programme of that package is what
    // `MachineModel.controller` and `thermalPrePass` run.
    const specIn = (spec: machine.MachineSpec): MachineSpec => spec;
    const specOut = (spec: MachineSpec): machine.MachineSpec => spec;
    const configIn = (config: machine.MachineConfig): MachineConfig => config;
    const configOut = (config: MachineConfig): machine.MachineConfig => config;
    const programmeIn = (programme: machine.ProgrammeSpec): ProgrammeSpec => programme;
    const programmeOut = (programme: ProgrammeSpec): machine.ProgrammeSpec => programme;
    const run = (model: MachineModel, programme: machine.ProgrammeSpec): unknown =>
      model.controller(programme);
    for (const witness of [specIn, specOut, configIn, configOut, programmeIn, programmeOut]) {
      expect(witness.length).toBe(1);
    }
    expect(run.length).toBe(2);
  });
});
