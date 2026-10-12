/**
 * Contract of module M4, hydraulics and programme (docs/design/sim-core.md section 4,
 * "M4. Hydraulics and programme"): the lumped machine model of the machine dossier's
 * section 12.2. Operating point per combo, arm speeds and stall, diverter, water inventory and
 * loss of prime, heater and programme controller. CPU, f64.
 *
 * Types only. `ArmState`, `ComboId`, `PhaseEvent` and `MachineTick` belong to this module by
 * the contract; they are declared in `@spotless/sim-params` (`shared.ts`), because the liquor
 * model of M9 uses them and may depend on M2 only, and are re-exported from this package's
 * entry point.
 *
 * Units: SI, with pump speeds in rpm as the contract writes them (`pumpRpm`). Frames: nozzle
 * positions and directions are in the rotating arm frame of their arm (z along the hinge axis);
 * arm phases are u32 with 2^32 units per revolution.
 */

import type { Vec3 } from '@spotless/core';
import type { ArmState, ComboId, LiquorClassId, MachineTick } from '@spotless/sim-params';
import type { ProgrammeSpec } from './machine-boundary.ts';

// ---------------------------------------------------------------------------------------------
// Constants of the time base (section M4, "Time base of a combo")
// ---------------------------------------------------------------------------------------------

/** Units of arm phase per revolution: phases are u32 (section M4). */
export const PHASE_UNITS_PER_REV = 2 ** 32;

/** Phase bins per revolution of each arm, counted in that arm's own phase (section M4). */
export const PHASE_BINS_PER_REV = 64;

/** Knots of the phase-time table of a knocking arm, over its own period (section M4). */
export const ARM_PROFILE_KNOTS = 256;

/** Steps per revolution in which the angle of a stalled arm is quantised (`ArmState.angleQ`). */
export const STALL_ANGLE_STEPS = 256;

/**
 * Target length of a base step, seconds (section M4): stepsPerRev =
 * 64 x ceil(T_master / (64 x 2 ms)) and dt0 = T_master / stepsPerRev, so that a master
 * revolution is a whole number of base steps and of phase bins.
 */
export const BASE_STEP_TARGET_S = 2e-3;

/** Base steps per revolution of a combo in which no fed arm rotates (section M4). */
export const STEPS_PER_REV_ALL_STALLED = 1024;

// ---------------------------------------------------------------------------------------------
// Liquor properties and arm motion
// ---------------------------------------------------------------------------------------------

/**
 * Liquid properties of an exposure (section M4, "Solve temperature per liquor class"): built
 * from the liquor class and its solve temperature alone, so they do not depend on when the
 * timeline first needs the set.
 */
export interface LiquorProps {
  /** Liquor class. */
  readonly cls: LiquorClassId;
  /** Solve temperature of the class, kelvin. */
  readonly T_K: number;
  /** Density, kg/m3. */
  readonly rho: number;
  /** Dynamic viscosity, Pa s. */
  readonly mu: number;
  /** Surface tension of the liquor (`film.sigma` of the class), N/m. */
  readonly sigma: number;
  /**
   * Surface tension of clean water at the temperature times `jets.gammaFactor`, N/m: used for
   * jets, splatter and the fast radial film, whose surfaces are milliseconds old.
   */
  readonly gammaW: number;
}

/** Motion of one fed arm in a combo (section M4, "Time base of a combo"). */
export interface ArmMotion {
  /** Index of the arm in the machine's arm list. */
  readonly arm: number;
  /** State of the arm. */
  readonly state: ArmState;
  /**
   * Mean angular velocity, rad/s, about the +z axis of the tub frame (positive counter-clockwise
   * seen from above); 0 when stalled. The contract gives no sign convention; this one is that
   * of the launch equation of M5 (Omega z x P).
   */
  readonly omega_rad_s: number;
  /** Period of one revolution of the arm, seconds; the nominal period for a stalled arm. */
  readonly period_s: number;
  /** Start phase, u32, drawn from the sim seed. */
  readonly phase0: number;
  /**
   * The arm's u32 phase at the start of a base step: pure integer arithmetic for a free arm
   * (`phase0 + baseStep * round(2^32 dt0 / T_arm)`, modulo 2^32), the inverse of the 256-knot
   * phase-time table for a knocking arm, constant for a stalled arm.
   */
  phaseAt(baseStep: number): number;
  /**
   * Seconds per revolution the arm spends in one of the phase steps of the jet trace (16,384 at
   * the official tier): the dwell that weights the footprint of that phase.
   */
  dwellAt(phaseIndex: number): number;
}

// ---------------------------------------------------------------------------------------------
// Hydraulic point
// ---------------------------------------------------------------------------------------------

/**
 * One sub-jet of a hydraulic point (section M4): a round nozzle is one sub-jet; a slot nozzle
 * is `slot.subJets` round sub-jets spread uniformly over its fan angle, each with the same
 * `slot` description.
 */
export interface NozzleJet {
  /** Index of the arm the nozzle is on. */
  readonly arm: number;
  /** Index of the nozzle in the arm's nozzle table. */
  readonly nozzle: number;
  /** Index of the sub-jet within the nozzle: 0 for a round nozzle. */
  readonly subJet: number;
  /** Position of the nozzle exit in the arm frame, metres. */
  readonly posArm: Vec3;
  /** Unit direction of the sub-jet relative to the arm, in the arm frame. */
  readonly dirArm: Vec3;
  /** Volume flow of the sub-jet, m3/s: Q of the nozzle, divided by the sub-jet count of a slot. */
  readonly Q_m3_s: number;
  /** Jet speed relative to the nozzle, m/s: V_rel = C_v sqrt(2 p_arm / rho). */
  readonly Vrel_m_s: number;
  /**
   * Jet diameter, metres: d_n sqrt(C_d / C_v) for a round nozzle, sqrt(4 Q / (pi N_sub V)) for
   * a slot sub-jet.
   */
  readonly d_m: number;
  /** Present on the sub-jets of a slot nozzle: the sheet the slot really issues. */
  readonly slot?: {
    /** Number of sub-jets N_sub of the slot (nozzle table; the same in every tier). */
    readonly subJets: number;
    /** Fan angle of the slot, radians. */
    readonly fanAngle_rad: number;
    /** Length of the slot, metres. */
    readonly length_m: number;
    /** Width of the slot, metres. */
    readonly width_m: number;
  };
}

/**
 * The operating point of one combo at the class-centre pump speed and full prime (section M4).
 * Exposure records are always computed at such a point; loss of prime and off-centre speeds
 * enter per tick through `MachineTick.sV` and `sQ`.
 */
export interface HydraulicPoint {
  /** The combo. */
  readonly combo: ComboId;
  /** Pump speed of the class centre, rpm. */
  readonly pumpRpm: number;
  /** Head derating: always 1 (full prime). */
  readonly fH: 1;
  /** The fed arms, one entry per arm of the diverter state, in the order of `combo.arms`. */
  readonly arms: readonly ArmMotion[];
  /** Every sub-jet of every fed arm. */
  readonly nozzles: readonly NozzleJet[];
  /** Index of the master arm, the slowest rotating arm of the state; `null` if none rotates. */
  readonly masterArm: number | null;
  /** Period of the master arm, seconds; `hyd.nominalPeriod` when no fed arm rotates. */
  readonly masterPeriod_s: number;
  /** Base steps per master revolution: 64 x ceil(T_master / (64 x 2 ms)). */
  readonly stepsPerRev: number;
  /** Length of a base step, seconds: T_master / stepsPerRev. */
  readonly dt0_s: number;
}

// ---------------------------------------------------------------------------------------------
// Programme controller
// ---------------------------------------------------------------------------------------------

/**
 * What the timeline feeds back to the controller after every tick (section M4): the controller
 * is a state machine driven by feedback, not a precomputed list. Volumes are m3.
 */
export interface ControllerFeedback {
  /** Liquor temperature, kelvin (from the liquor model). */
  readonly liquorT_K: number;
  /** Liquor class (from the liquor model). */
  readonly liquorClass: LiquorClassId;
  /** Water in flight as parcels: the measured mean of the active exposure set, m3. */
  readonly V_air: number;
  /** Water in films, beads, gutters and on wires: the measured mean of the active set, m3. */
  readonly V_film: number;
  /** Water trapped in pools at this tick, m3. */
  readonly V_trap: number;
  /** Water held up by the filter, m3. */
  readonly V_filter: number;
  /** Water absorbed by soil, m3. */
  readonly V_absorbed: number;
  /** State of every arm of the machine, from the rigid coupler. */
  readonly arms: readonly ArmState[];
  /** Length of the tick just replayed, seconds. */
  readonly lastTickPeriod_s: number;
}

/** The programme as a state machine (section M4). */
export interface ProgrammeController {
  /** The next tick given the feedback of the last one; `null` at the end of the programme. */
  next(feedback: ControllerFeedback): MachineTick | null;
}

/** The lumped machine model (section M4). */
export interface MachineModel {
  /** The hydraulic point of a combo, at the class-centre speed and full prime. */
  point(combo: ComboId): HydraulicPoint;
  /** A controller that runs a programme from its start. */
  controller(programme: ProgrammeSpec): ProgrammeController;
  /**
   * Registers the phase-time table of a knocking arm (256 knots over its own period, seconds,
   * from the transient torque balance of M11) and returns the profile hash used in `ArmState`;
   * `point()` looks the table up by it.
   */
  registerArmProfile(arm: number, phaseTime: Float32Array): string;
  /**
   * Integrates the programme once with the lumped liquor and tub nodes and the load as one heat
   * capacity (J/K), before stage C. Returns the solve temperature of each liquor class, kelvin
   * (class D: the main-wash hold target; W and R: the time-weighted mean, rounded to 1 K), and
   * the liquor temperature trace of the pre-pass, kelvin (the contract does not fix its
   * sampling).
   */
  thermalPrePass(
    programme: ProgrammeSpec,
    loadHeatCapacity_J_K: number,
  ): { readonly solveT_K: Readonly<Record<LiquorClassId, number>>; readonly trace: Float64Array };
  /**
   * The water inventory: V_sump = V_total - V_pipes - V_air - V_film - V_trap - V_filter -
   * V_absorbed (m3), the air fraction alpha = clamp(1 - V_sump / V_min, 0, 0.6) and the head
   * derating f_H = max(1 - 2.5 alpha, 0).
   */
  inventory(s: {
    /** Water in flight as parcels, m3. */
    readonly V_air: number;
    /** Water in films, beads, gutters and on wires, m3. */
    readonly V_film: number;
    /** Water trapped in pools, m3. */
    readonly V_trap: number;
    /** Water held up by the filter, m3. */
    readonly V_filter: number;
    /** Water absorbed by soil, m3. */
    readonly V_absorbed: number;
  }): {
    /** Water left in the sump, m3. */
    readonly V_sump: number;
    /** Air fraction ingested by the pump, 0 to 0.6. */
    readonly alpha: number;
    /** Head derating f_H, 0 to 1. */
    readonly fH: number;
  };
}
