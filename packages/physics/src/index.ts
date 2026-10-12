/**
 * @spotless/physics. Loading physics: a thin deterministic wrapper over Jolt and the mechanics
 * built on it (docs/design/platform.md section 5).
 *
 * - `createPhysicsWorld` creates a world implementing the `PhysicsWorld` contract of `types.ts`.
 * - `JOLT_SETTINGS`, `LOADING_TIME_STEP`, `LOADING_GRAVITY` and `settleOptionsFor` are the
 *   configuration every loading world should run with.
 * - `probeStability`, `travelRack`, `sweepArm` and `sweepLid` are the mechanics of platform.md
 *   section 5.
 * - `measurePenetration` is the engine-independent float64 penetration check for tests and
 *   scoring.
 */

export * from './types.ts';
export * from './settings.ts';
export type { ContactPoint, JoltPhysicsWorld, WorldStats } from './world.ts';
export { conditionInertia, createPhysicsWorld } from './world.ts';
export * from './mechanics.ts';
export type { ConvexCore, PenetrationMeasurement, PlacedPieces } from './measure.ts';
export {
  coresPenetration,
  measurePenetration,
  pieceCore,
  pieceDistance,
  placedCores,
} from './measure.ts';
export { JOLT_ENGINE_VERSION, JOLT_PACKAGE_VERSION } from './jolt-module.ts';
