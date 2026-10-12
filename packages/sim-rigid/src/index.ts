/**
 * @spotless/sim-rigid. Module M11 of the wash simulation (docs/design/sim-core.md section 4):
 * wash-time coupling to the loading physics. Shake-down, live wrenches, geometry epochs, arm
 * states and the tablet. Depends on `@spotless/physics`, M3 (`sim-scene`) and M5 (`sim-jets`).
 *
 * What exists so far is the typed contract:
 *
 *  - `types.ts`: `RigidCoupler`, `RigidResult`, `RigidEvent`;
 *  - `physics-additions.ts`: the four additions M11 needs from `@spotless/physics`
 *    (`PhysicsWorldAdditions`, `WashPhysicsWorld`).
 *
 * The entry point also re-exports the entry points of M3 and M5.
 */

export * from '@spotless/sim-jets';
export * from '@spotless/sim-scene';

export * from './types.ts';
export * from './physics-additions.ts';
