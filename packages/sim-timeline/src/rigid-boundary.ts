/**
 * BOUNDARY TO MODULE M11 (`@spotless/sim-rigid`).
 *
 * The contract gives the timeline the rigid coupler itself: `TimelineContext.rigid:
 * RigidCoupler` (docs/design/sim-core.md section M10). But M10 may not depend on M11 (table of
 * section 4: M10 depends on M4, M7, M8 and M9), and `RigidCoupler` cannot be declared lower,
 * because it is written in terms of `@spotless/physics`. So the timeline sees the coupler
 * through this port: the methods of `RigidCoupler` that sections M10, M11 and 5.5 have the
 * timeline call, with the signatures of section M11. A `RigidCoupler` is assignable to it as it
 * is (asserted in `@spotless/sim-verify`), so the orchestrator passes the coupler unchanged.
 * Reported as a contract issue.
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { JetStage, Scene } from '@spotless/sim-film';
import type { ArmState, HydraulicPoint } from '@spotless/sim-hydraulics';

/**
 * What the timeline reads of the result of an episode: the `RigidResult` of section M11 without
 * its contact manifold (a `@spotless/physics` type) and its event list.
 */
export interface RigidEpisodeResult {
  /** Pose of every item after the episode, item id to pose (item frame to tub frame). */
  readonly poses: ReadonlyMap<string, Pose>;
  /** The items that moved, with their displacement (m) and rotation (rad). */
  readonly moved: readonly {
    /** Item id. */
    readonly item: string;
    /** Displacement of the item's origin, metres. */
    readonly dPos_m: number;
    /** Angle of the item's rotation, radians. */
    readonly dAng_rad: number;
  }[];
  /** State and mean angular velocity (rad/s) of every arm, with the phase-time table of a knocking arm. */
  readonly arms: readonly {
    /** Index of the arm in the machine's arm list. */
    readonly arm: number;
    /** State of the arm at the end. */
    readonly state: ArmState;
    /** Mean angular velocity, rad/s, signed as `ArmMotion.omega_rad_s`. */
    readonly meanOmega: number;
    /** For a knocking arm: time at each of 256 phase knots over its own period, seconds. */
    readonly phaseTime?: Float32Array;
  }[];
  /** True when every body met the rest criterion. */
  readonly settled: boolean;
  /** Simulated time of the episode, seconds. */
  readonly simulated_s: number;
}

/** The part of `RigidCoupler` (section M11) that the timeline calls. */
export interface RigidCouplerPort {
  /**
   * Simulates `revolutions` master revolutions of a hydraulic point with live wrenches on the
   * bodies listed in `wake` (the fill trigger of section M11: an item whose basin water changed
   * its mass by more than 20 %, or whose basin first fills).
   */
  episode(
    hp: HydraulicPoint,
    live: JetStage['liveWrench'],
    scene: Scene,
    revolutions: number,
    wake: readonly string[],
  ): Promise<RigidEpisodeResult>;
  /** Adds pooled and held water to an item: its mass (kg) and centre of mass (item frame, m). */
  setAddedMass(item: string, massKg: number, comItem: Vec3): void;
  /** Spawns the tablet as a body at a pose (tub frame) when the dispenser opens; returns its id. */
  spawnTablet(pose: Pose): string;
  /**
   * Where the tablet lies: its pose, the blocks under it and the basin it rests in, if any;
   * `null` while there is no tablet body.
   */
  tabletRest(): {
    /** Pose of the tablet, tub frame. */
    readonly pose: Pose;
    /** The blocks under the tablet. */
    readonly blocks: Uint32Array;
    /** Id of the basin the tablet rests in, or `null`. */
    readonly basin: number | null;
  } | null;
  /** The complete state of the wash world, for checkpoints. */
  snapshot(): Uint8Array;
  /** Restores a snapshot. */
  restore(s: Uint8Array): void;
}
