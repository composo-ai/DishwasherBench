/**
 * @spotless/session. One server-side session per player and level: the loading world with the
 * machine and the items placed so far, the actions (`place`, `remove`, `reset`, `set_rack`,
 * `start_cycle`), the queries (`get_level`, `get_item`, `get_state`, `preview`, `list_slots`,
 * `check_load`, `get_report`), budgets, the action log with a state hash after every event, and
 * replay (docs/design/platform.md section 6).
 *
 *  - `types.ts`: the wire contract.
 *  - `createSession({ level, washRunner? })`: a `GameSession`.
 *  - `replayActionLog(level, log)`: replays a log in a fresh session and verifies every hash;
 *    `applyLoggedEvent` applies one logged event to a session.
 *  - `WashManifest`, `WashRunner`, `placeholderWashRunner`: the hand-over to the wash.
 *  - `SESSION_PARAMETERS`: tolerances and speeds of the session's mechanics.
 *  - `BASKET_TRAVEL_PROFILES`: how a basket is pulled out and pushed in (`normal`, and `hard`
 *    for studies), with `basketTravelDistances` and `driveBasket` (`travel.ts`).
 */

export * from './types.ts';
export type { GameSession, SessionOptions } from './session.ts';
export { createSession, SESSION_PARAMETERS } from './session.ts';
export type { BasketDriveOptions, BasketTravelName, BasketTravelProfile } from './travel.ts';
export {
  BASKET_TRAVEL_PROFILES,
  basketTravelDistances,
  basketTravelSpeeds,
  driveBasket,
} from './travel.ts';
export { edgeOrientation, lowerEndOf } from './seat.ts';
export type { LowerEnd } from './seat.ts';
export type { ReplayMismatch, ReplayOptions, ReplayResult } from './replay.ts';
export { applyLoggedEvent, replayActionLog } from './replay.ts';
export type { WashManifest, WashManifestItem, WashRunner } from './wash.ts';
export { PLACEHOLDER_FIDELITY, placeholderWashRunner } from './wash.ts';
export {
  DOOR_CLOSING_ID,
  KITCHEN_FLOOR_ID,
  KITCHEN_FLOOR_Z,
  buildMachineScene,
  machineContactName,
} from './machine-bodies.ts';
export type { ArmProbe, MachineBody, MachineScene, RackAssembly } from './machine-bodies.ts';
