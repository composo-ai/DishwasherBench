/**
 * Contract of module M11, rigid-body coupling (docs/design/sim-core.md section 4, "M11.
 * Rigid-body coupling"): everything that can move during the wash. Jet-mobile items, spray
 * arms, the tablet. The module builds its own `PhysicsWorld` for the wash from the settled
 * poses of the load (Jolt at 1/240 s through `@spotless/physics`).
 *
 * Types only. The four additions the module needs from `@spotless/physics` are in
 * `physics-additions.ts`.
 *
 * Units: SI. Frames: poses map the item frame to the tub frame; the centre of mass of added
 * water is in the item frame.
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { Contact, CreatePhysicsWorld } from '@spotless/physics';
import type { ArmState, HydraulicPoint, ItemLoads, JetStage } from '@spotless/sim-jets';
import type { MachineGeometry, Scene, WashItem } from '@spotless/sim-scene';

/**
 * What caused a rigid-body episode (section M11): the shake-down before any exposure, or one of
 * the triggers of the table "Events after the shake-down".
 */
export type RigidTrigger = 'shakeDown' | 'basinFill' | 'armContact' | 'dispenser' | 'washEnd';

/** Every {@link RigidTrigger}, in the order of section M11. */
export const RIGID_TRIGGERS: readonly RigidTrigger[] = [
  'shakeDown',
  'basinFill',
  'armContact',
  'dispenser',
  'washEnd',
];

/**
 * One thing that happened to a body during the wash. The contract uses this type in
 * `RigidResult.events` and in `ItemWashResult.motion.events` and never defines it; this is the
 * smallest reading: what triggered it, which item or arm it concerns and how far the item
 * moved. Reported as a contract issue.
 */
export interface RigidEvent {
  /** What caused the episode in which the event happened. */
  readonly trigger: RigidTrigger;
  /** Id of the item concerned, for an event of an item. */
  readonly item?: string;
  /** Index of the arm concerned, for an event of an arm. */
  readonly arm?: number;
  /** Displacement of the item over the episode, metres; 0 for an arm event. */
  readonly dPos_m: number;
  /** Rotation of the item over the episode, radians; 0 for an arm event. */
  readonly dAng_rad: number;
}

/** Outcome of the shake-down or of an episode (section M11). */
export interface RigidResult {
  /** Pose of every item afterwards, item id to pose (item frame to tub frame). */
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
  /**
   * Every arm: its state, its mean angular velocity (rad/s) and, for a knocking arm, its
   * phase-time table (256 knots over its own period, seconds), to be registered with
   * `MachineModel.registerArmProfile`.
   */
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
  /** The contact manifold of the final poses, for `SceneBuilder.move`. */
  readonly contacts: readonly Contact[];
  /** What happened, in order. */
  readonly events: readonly RigidEvent[];
  /** True when every body met the rest criterion; false when an item was frozen while moving. */
  readonly settled: boolean;
  /** Simulated time spent, seconds; counted against `rigid.shakeBudget` in the shake-down. */
  readonly simulated_s: number;
}

/** The wash-time coupling to the loading physics (section M11). */
export interface RigidCoupler {
  /**
   * Builds a new world with the 'wash' friction table (a world's pair lookup is fixed for its
   * lifetime): the items listed in `mobile` (by item id) dynamic and asleep, all others static.
   */
  begin(
    create: CreatePhysicsWorld,
    items: readonly WashItem[],
    machine: MachineGeometry,
    mobile: readonly string[],
  ): Promise<void>;
  /**
   * Shakes the load down before any exposure is computed: for each hydraulic point of the
   * programme, in programme order, up to 6 rounds of (trace with preview sampling, simulate 3
   * master revolutions with live wrenches on the awake bodies, re-trace), within
   * `rigid.shakeBudget` simulated seconds. The resulting poses are geometry epoch 0.
   */
  shakeDown(
    points: readonly HydraulicPoint[],
    trace: (hp: HydraulicPoint, poses: ReadonlyMap<string, Pose>) => Promise<ItemLoads>,
    live: JetStage['liveWrench'],
    scene: () => Scene,
  ): Promise<RigidResult>;
  /**
   * Simulates `revolutions` master revolutions of a hydraulic point with live wrenches, after
   * waking the bodies listed in `wake` (by item id).
   */
  episode(
    hp: HydraulicPoint,
    live: JetStage['liveWrench'],
    scene: Scene,
    revolutions: number,
    wake: readonly string[],
  ): Promise<RigidResult>;
  /** Adds pooled and held water to an item: its mass (kg) and centre of mass (item frame, m). */
  setAddedMass(item: string, massKg: number, comItem: Vec3): void;
  /**
   * Sets the torque balance of an arm (section M4): driving torque and friction torque (N m) as
   * functions of the angular velocity (rad/s), and the inertia (kg m2). M11 integrates the arm
   * with the contact torque read from the engine each step.
   */
  armTorqueBalance(
    arm: number,
    drive: (omega: number) => number,
    friction: (omega: number) => number,
    inertia: number,
  ): void;
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
