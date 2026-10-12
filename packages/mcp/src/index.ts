/**
 * @spotless/mcp. The agent's interface to the game: an MCP server with one tool per action
 * and query of the session contract (docs/design/platform.md section 7, docs/benchmark).
 *
 *  - `createSpotlessMcpServer({ game })`: the MCP server of one episode; connect it to a
 *    transport (stdio, streamable HTTP, in memory).
 *  - `GameClient`: the HTTP client it reaches the game server through, bound to one session.
 *  - `serveMcpHttp(options)`: the same server over streamable HTTP on a port.
 *  - `INPUT_SCHEMAS`, `OUTPUT_SCHEMAS`, `TOOL_NAMES`, `TOOL_TEXT`: the tools' arguments,
 *    results, names and descriptions.
 *  - `shape.ts`: the shape of the results (an action says what it changed, not the whole
 *    scene; `shapeState`, `shapeLevel`, `shapeSlots`, ...), and `LoadTracker`, a client's own
 *    copy of the scene kept from the results alone.
 *  - `main(argv)`: the command line (`cli.ts`).
 */

export type { GameAnswer, GameClientOptions, GameSummary } from './game-client.ts';
export { GameClient } from './game-client.ts';
export type { OnceResponse } from './http-once.ts';
export { requestOnce } from './http-once.ts';
export type { ToolName } from './schemas.ts';
export { INPUT_SCHEMAS, OUTPUT_SCHEMAS, TOOL_NAMES, VIEWS } from './schemas.ts';
export { SERVER_INSTRUCTIONS, TOOL_TEXT } from './descriptions.ts';
export type {
  ItemTypeCard,
  PresetCard,
  LoadItem,
  LoadSummary,
  PlacedRow,
  ShapedBudget,
  ShapedChanges,
  ShapedState,
  SlotsPage,
  StateFilter,
} from './shape.ts';
export {
  LoadTracker,
  PLACED_COLUMNS,
  PLACE_COLUMNS,
  SLOT_COLUMNS,
  placeName,
  SLOTS_DEFAULT_LIMIT,
  SLOTS_MAX_LIMIT,
  diffStates,
  itemOfRow,
  loadItem,
  loadSummary,
  roundTo,
  rowOf,
  shapeAction,
  shapeBudget,
  shapeItemRecord,
  shapeItems,
  shapeLevel,
  shapeLoadCheck,
  shapePreview,
  shapeSlots,
  shapeState,
  shortHash,
  tidyNumbers,
} from './shape.ts';
export type { SpotlessMcpOptions } from './server.ts';
export {
  MCP_SERVER_INFO,
  RESOURCE_URIS,
  THUMBNAIL_VIEWS,
  createSpotlessMcpServer,
  manualText,
  splitImages,
} from './server.ts';
export type { McpHttpOptions, McpHttpServer } from './http.ts';
export { serveMcpHttp } from './http.ts';
export { main } from './cli.ts';
