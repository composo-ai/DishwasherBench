/**
 * @spotless/server. spotless-simd: the game server (docs/design/platform.md section 7).
 *
 *  - `buildServer(options)`: the Fastify application with the HTTP API that mirrors the
 *    session's actions and queries one to one, the WebSocket per session, the geometry
 *    endpoint, the wash queue and the web client's files (`app.ts` lists the routes).
 *  - `SessionManager`: sessions in memory, their logs on disk, restore by replay.
 *  - `WashQueue`: the single-worker wash queue with its result cache; `WASH_RUNNER` names the
 *    wash that is run (`wash-runner.ts`: the one line to change for the real simulation).
 *  - `DataStore`: the data directory.
 *  - `main(argv, io)`: the command line (`cli.ts`).
 *  - `types.ts`: what goes over the wire beyond the session contract, and the stored records.
 *  - `createRenderService(options)`: the `render` query and the thumbnails of `get_item`,
 *    drawn by `@spotless/render` in headless Chrome (`render-service.ts`).
 *  - `EpisodeRecord`, `buildEpisodeRecord`: the record of an episode, the same for a person
 *    and an agent (`episode.ts`); `LOADING_GUIDANCE`: the text every player is shown.
 *  - `slotAdvice(slots)`: the suggested drops of a `list_slots` answer as one ranked list,
 *    the same for the page's "Suggest spots" and for the MCP tool (`slot-advice.ts`, which
 *    the web client imports on its own as `@spotless/server/slot-advice`).
 */

export * from './types.ts';
export type { AccessOptions, BuildServerOptions, SpotlessServer } from './app.ts';
export {
  DEFAULT_STATIC_DIR,
  answeredHosts,
  buildServer,
  isLoopbackAddress,
  parseAllowedHosts,
  parseAllowedOrigins,
} from './app.ts';
export type {
  SessionEntry,
  SessionManagerOptions,
  StoredMismatch,
  StoredReplay,
} from './sessions.ts';
export { ServerError, SessionManager, WashGate, replayStoredSession } from './sessions.ts';
export type { StoredSession, WashResultRecord } from './store.ts';
export { DataStore, isSafeId, parseSessionFile } from './store.ts';
export type { WashQueueOptions, WashSubmission, WashTicket } from './wash-queue.ts';
export { WashQueue, reportProblem } from './wash-queue.ts';
export { WASH_RUNNER } from './wash-runner.ts';
export { ANIMATION_FRAMES_MAX, FrameRecorder } from './recorder.ts';
export { drawPoses, geometryKey, geometryPayload, sceneView, toDrawPose } from './draw.ts';
export type { CliIo, CliReplayResult } from './cli.ts';
export { createEpisodeLink, main, replayFile } from './cli.ts';
export type {
  EpisodeAgentSection,
  EpisodeCounts,
  EpisodeEvent,
  EpisodePlayer,
  EpisodeRecord,
  EpisodeReplay,
  EpisodeWash,
  EpisodeScore,
  EpisodeSource,
  EpisodeToolCall,
  EpisodeUsage,
} from './episode.ts';
export {
  EPISODE_FORMAT,
  buildEpisodeRecord,
  countsOf,
  isEpisodeRecord,
  scoreOf,
} from './episode.ts';
export type { WashOptionValues, WashOptions } from './wash-options.ts';
export { WASH_OPTION_FLAGS, WASH_OPTIONS_USAGE, washOptionsOf } from './wash-options.ts';
export {
  EDGE_NOTE_PHRASE,
  PREVIEW_REPORT_NOTE,
  PREVIEW_TIER,
  STALE_NOTE_PHRASE,
  UNCALIBRATED_REPORT_NOTE,
  flaggedByNotes,
  verdictSummary,
  withVerdicts,
} from './verdicts.ts';
export type { SlotAdvice, SlotAdvicePlace } from './slot-advice.ts';
export { slotAdvice, slotAdviceLabel } from './slot-advice.ts';
export type { GuidancePayload } from './guidance.ts';
export {
  LOADING_GUIDANCE,
  LOADING_GUIDANCE_TITLE,
  LOADING_GUIDANCE_VERSION,
  guidancePayload,
} from './guidance.ts';
export type { RenderService, RenderServiceOptions, RenderStats } from './render-service.ts';
export {
  RENDER_SIZE_MIN_PX,
  ITEM_SHEET_MAX,
  RENDER_VIEWS,
  THUMBNAIL_SIZE_PX,
  createRenderService,
} from './render-service.ts';
export {
  createSessionSchema,
  emptySchema,
  itemSchema,
  listSlotsSchema,
  namePlayerSchema,
  placeSchema,
  playerSchema,
  previewSchema,
  renderSchema,
  setRackSchema,
  startCycleSchema,
} from './schemas.ts';
