/**
 * BOUNDARY TO `@spotless/physics`: the four additions module M11 needs.
 *
 * docs/design/sim-core.md section M11: "It needs four additions to `@spotless/physics`, whose
 * `PhysicsWorld` today has none of them." They are declared here as an interface, with the
 * signatures the contract names and the semantics its prose gives, so that the platform team
 * can add exactly these to `PhysicsWorld` and the coupler of M11 can be written against them
 * now. When `PhysicsWorld` has them, `WashPhysicsWorld` is `PhysicsWorld` and this file reduces
 * to a re-export. Reported as a contract issue.
 *
 * Units: SI. Frames: the tub frame.
 */

import type { Vec3 } from '@spotless/core';
import type { BodyKind, PhysicsWorld } from '@spotless/physics';

/** Mass, centre of mass and inertia of a body, as `PhysicsWorld.addBody` takes them. */
export type BodyMassProperties = Parameters<PhysicsWorld['addBody']>[2];

/** The four methods M11 needs that `PhysicsWorld` does not have (section M11). */
export interface PhysicsWorldAdditions {
  /**
   * Changes the mass properties of a body in place: mass (kg), centre of mass (item frame, m)
   * and inertia about it (kg m2). Used for pooled and held water. The body keeps its id, pose,
   * velocities and creation order, and is woken.
   */
  setMassProperties(id: string, mass: BodyMassProperties): void;
  /**
   * The contact force (N) and torque (N m) that the other bodies exerted on a kinematic body
   * during the latest step, in the tub frame, the torque about the origin of the body's frame.
   * Used for the arm torque balance. The contract names the method and not the reference point;
   * the origin of the body frame is the reading taken here, so an arm whose frame origin lies
   * on its hinge axis reads its contact torque as the component along that axis.
   */
  contactWrench(id: string): { readonly force: Vec3; readonly torque: Vec3 };
  /**
   * Changes how a body takes part in the simulation, keeping its id and creation order: turns
   * a static item into a dynamic one when an event shows it is mobile, and freezes a rattling
   * one. A body made dynamic starts at rest and awake.
   */
  setBodyKind(id: string, kind: BodyKind): void;
  /** Ids of the dynamic bodies that are not asleep, sorted. The live wrench is computed for these only. */
  awakeBodies(): string[];
}

/** The world the wash coupling runs on: `PhysicsWorld` with the four additions. */
export type WashPhysicsWorld = PhysicsWorld & PhysicsWorldAdditions;

/** The names of the four additions, in the order section M11 lists them. */
export const PHYSICS_ADDITIONS = [
  'setMassProperties',
  'contactWrench',
  'setBodyKind',
  'awakeBodies',
] as const satisfies readonly (keyof PhysicsWorldAdditions)[];
