/**
 * @spotless/loader. Scripts that load the dishwasher the way people do, played through the
 * session layer exactly as a player would play, and the settled standard loads they produce.
 *
 *  - `runPolicy(session, { policy, seed, items? })`: plays one of the three policies on a
 *    session at the start of its level and returns the action log, the final scene and what
 *    was placed, left out and why (`policy.ts`).
 *      - `careful`: the manufacturer's scheme and the guidance the dossiers support;
 *      - `careless`: the careful load, and then the common mistakes of the phenomena checklist
 *        made on a seeded choice of its items (`MISTAKE_KINDS`): the pair holds the same items
 *        and differs only in the mistakes; each mistake is recorded as measured on the settled
 *        load (`mistakeHolds`);
 *      - `random`: uniformly random feasible placements.
 *  - `standardLoadSpecs()`, `generateStandardLoad(spec)`, `replayStandardLoad(load)`: the
 *    standard loads on the owner's machine and how they are generated and reproduced
 *    (`standard-loads.ts`); the saved files are in `loads/`.
 *  - `iecLevel()`, `halfIecLevel()`, `ownerLoadLevel()`: the levels
 *    behind the standard loads that are not starter levels (`standard-levels.ts`).
 *  - `playOwnerLoad(session)`: the owner's own load of 2026-10-10, placed by a fixed list of
 *    moves after his photograph (`owner-load.ts`; saved as `loads/owner-2026-10-10.json`, with
 *    `loads/owner-2026-10-10-beside-photo.png` beside the photograph).
 *  - `verifyLoad(manifest, state, check)`: the numbers a settled load is checked by
 *    (`verify.ts`); `auditStandardLoad(load)`: whether its baskets can be pulled out and pushed
 *    in again and whether its recorded mistakes hold (`audit.ts`).
 *  - `sceneOfManifest`, `sceneOfSession`, `renderStandardView`, `renderLoadSheet`, `writePng`:
 *    orthographic pictures of a load drawn from the geometry kernel's own meshes.
 *  - `washDescriptionOf(load)`: a saved load as the wash simulation's JSON input.
 *  - `Player`, `seatOnEdge`, `dropAt`, `lanesOf`: the moves the policies are made of, for
 *    whoever writes another policy.
 */

export type { Family, ItemView, Outline } from './families.ts';
export { CUTLERY_BASKET_MAX_LENGTH, viewOf } from './families.ts';
export type { LoadFrame, Outcome, PlayerStats, RackSlots, Rng } from './player.ts';
export {
  Player,
  angleDeg,
  axisAt,
  edgeOffsetsFor,
  makeRng,
  outcomeOf,
  wireQuat,
} from './player.ts';
export type { EdgeShape, Lane, LaneSlot, SeatMemory, SeatOutcome, SeatRequest } from './placing.ts';
export {
  OPEN_DROP_Z,
  dropAt,
  dropHeights,
  edgeShapeOf,
  lanesOf,
  rememberSeat,
  seatOnEdge,
} from './placing.ts';
export type { LeftOut, LoadingReport, LoadingStyle } from './loading.ts';
export { Loading, longAxisTurn } from './loading.ts';
export type { HollowAttitude, MistakeKind, MistakeMade, SettledLoad } from './mistakes.ts';
export {
  CARELESS_DEFAULT_MISTAKES,
  FACE_DOWN_LIMIT,
  MACHINE_MISTAKE_KINDS,
  MISTAKE_KINDS,
  MOUTH_UP_LIMIT,
  NESTED_AXIS_LIMIT,
  ON_SIDE_LIMIT,
  facesAway,
  hollowAttitude,
  mistakeHolds,
  mouthUpDeg,
  neighboursOf,
} from './mistakes.ts';
export { RANDOM_BAD_PER_ITEM, RANDOM_DRAWS_PER_ITEM, runRandom } from './random.ts';
export type {
  PolicyCounts,
  PolicyMeasured,
  PolicyName,
  PolicyOptions,
  PolicyResult,
} from './policy.ts';
export { POLICY_NAMES, carefulStyle, carelessStyle, resultOf, runPolicy } from './policy.ts';
export { clearMechanical, tidyPosture, travelBaskets } from './tidy.ts';
export {
  IEC_SUBSTITUTIONS,
  OWNER_LOAD_STAND_INS,
  halfIecLevel,
  iecLevel,
  iecLoadItems,
  ownerLoadLevel,
  standardLevels,
  standardRules,
} from './standard-levels.ts';
export type { OwnerLoadOptions } from './owner-load.ts';
export { playOwnerLoad } from './owner-load.ts';
export type {
  GeneratedLoad,
  LoadReplay,
  SavedWashManifest,
  StandardLoad,
  StandardLoadSpec,
} from './standard-loads.ts';
export {
  STANDARD_LOAD_FORMAT,
  generateStandardLoad,
  referenceItems,
  referenceSeed,
  replayStandardLoad,
  standardLoadSpecs,
  washManifestOf,
} from './standard-loads.ts';
export type { LoadAudit, MistakeAudit, TravelStep } from './audit.ts';
export { auditStandardLoad } from './audit.ts';
export type { LoadNumbers, OutOfBasket, Overlap, VerifyItem } from './verify.ts';
export {
  ENVELOPE_TOLERANCE,
  PENETRATION_LIMIT,
  TRUE_SHAPE_CHORD_ERROR,
  checkFindings,
  trueShapeOverlaps,
  verifyLoad,
} from './verify.ts';
export type { PostureFinding } from './posture.ts';
export {
  DEEP_PLATE_AGAINST_ROW_LIMIT,
  PLATE_AGAINST_ROW_LIMIT,
  VESSEL_LEAN_LIMIT,
  VESSEL_ON_SIDE_LIMIT,
  leanWithTines,
  postureFindings,
} from './posture.ts';
export type { OrthoView, Raster, RenderBody, RenderViewOptions, Rgb } from './render.ts';
export { RENDER_CHORD_ERROR, contactSheet, renderView } from './render.ts';
export type { LoadScene, SceneItem, StandardViewName } from './scene.ts';
export {
  STANDARD_VIEWS,
  itemColour,
  renderLoadSheet,
  renderStandardView,
  sceneOfManifest,
  sceneOfSession,
} from './scene.ts';
export { encodePng, writePng } from './png.ts';
export type {
  ExportNotes,
  ExportedItem,
  ExportedSoil,
  ExportedWash,
  WashExportOptions,
} from './wash-export.ts';
export { washDescriptionOf } from './wash-export.ts';
