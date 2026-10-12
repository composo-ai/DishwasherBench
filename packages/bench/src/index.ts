/**
 * @spotless/bench. The benchmark harness (docs/benchmark/README.md): it runs episodes on a
 * game server in benchmark mode, through the MCP tools, and writes episode records.
 *
 *  - `startGame(options)`, `connectGame(url, token)`: the game server of a run.
 *  - `runEpisode(options)`, `runBatch(options)`: one episode, or every level with every
 *    policy; `HARNESS_ID`.
 *  - Policies: `scriptedPolicy(name)` (`empty`, and the `careful`, `careless` and `random`
 *    loaders of `@spotless/loader`), `llmPolicy({ provider })` (the standard harness for a
 *    model), `Policy` for writing another.
 *  - Providers: `ModelProvider` (the interface), `anthropicProvider(options)`,
 *    `openaiProvider(options)` (an OpenAI-compatible chat completions endpoint),
 *    `scriptedProvider(script)` (plays a scripted sequence of tool calls; no model).
 *  - `Conversation`, `STANDARD_CONTEXT_POLICY`, `CONTEXT_POLICY_VERSION`: the context policy
 *    (the oldest turns folded into a note with the load, the most recent pictures only);
 *    `buildSystemPrompt`.
 *  - `measureRequests`, `sequenceOfLoad`, `estimateTokens`: what an episode costs in tokens,
 *    measured without a model (`scripts/measure-episode.ts`).
 *  - `verifyByReplay`, `verifyAgainstPolicySession`: verification of an episode.
 *  - `resultsTable`, `resultsMarkdown`, `readEpisodeRecords`, `writeResults`: the results table.
 *  - `main(argv, io)`: the command line (`cli.ts`).
 */

export type { HarnessGame, StartGameOptions } from './game.ts';
export { connectGame, startGame } from './game.ts';
export type { EpisodeResult, McpTransportKind, RunEpisodeOptions, VerifyMode } from './episode.ts';
export { HARNESS_ID, runEpisode } from './episode.ts';
export type { BatchResult, RunBatchOptions } from './batch.ts';
export { runBatch, writeResults } from './batch.ts';
export type { Policy, PolicyContext, PolicyOutcome } from './policy.ts';
export type { LoaderPolicyOptions, ScriptedPolicyName } from './scripted.ts';
export {
  SCRIPTED_POLICY_NAMES,
  emptyPolicy,
  loaderFingerprint,
  loaderPolicy,
  scriptedPolicy,
} from './scripted.ts';
export type { LlmPolicyOptions } from './llm.ts';
export { STANDARD_MAX_TURNS, llmPolicy, standardMaxTurns } from './llm.ts';
export type {
  HistoryEntry,
  HistoryImage,
  ModelProvider,
  ModelTurn,
  ToolCallRequest,
  ToolResultEntry,
  ToolSpec,
  TurnRequest,
  TurnStop,
  TurnUsage,
} from './provider.ts';
export { NO_USAGE, ProviderError, addUsage } from './provider.ts';
export type { AnthropicEffort, AnthropicProviderOptions } from './anthropic.ts';
export {
  ANTHROPIC_MODELS,
  STANDARD_EFFORT,
  STANDARD_MAX_TOKENS,
  anthropicMessages,
  anthropicProvider,
} from './anthropic.ts';
export type {
  OpenAiInputItem,
  OpenAiMessage,
  OpenAiOutputPart,
  OpenAiPart,
  OpenAiPrices,
  OpenAiProviderOptions,
  OpenAiToolCall,
} from './openai.ts';
export {
  OPENAI_ENV,
  PICTURES_PREAMBLE,
  envNameOf,
  openaiMessages,
  openaiPricesFor,
  openaiProvider,
  openaiResponsesInput,
  openaiUsage,
  retryAfterMs,
} from './openai.ts';
export { REPOSITORY_ENV_FILE, loadEnvFile, parseEnvFile } from './env.ts';
export type { Script, ScriptedProvider, ScriptedTurn } from './scripted-provider.ts';
export { scriptedProvider } from './scripted-provider.ts';
export type { ContextPolicy, FoldRecord, ImagePolicy, TurnResult } from './context.ts';
export {
  CONTEXT_POLICY_VERSION,
  Conversation,
  STANDARD_CONTEXT_POLICY,
  STANDARD_IMAGE_POLICY,
  contextSettings,
  countImages,
  entryTokens,
  pruneImages,
} from './context.ts';
export type {
  CalibrationRow,
  LoadLike,
  MeasuredCall,
  MeasuredRequest,
  Measurement,
  Sequence,
  SequenceOptions,
  TokenModel,
  ToolSizes,
  TranscriptLike,
} from './measure.ts';
export {
  TOKEN_MODEL,
  calibrationRows,
  checkTokenModel,
  estimateTokens,
  fitTokenModel,
  measureRequests,
  pictureTokens,
  sequenceOfLoad,
} from './measure.ts';
export type { PromptParts } from './prompt.ts';
export {
  CONTINUE_MESSAGE,
  OPENING_MESSAGE,
  PROMPT_VERSION,
  buildSystemPrompt,
  cardForPrompt,
  promptDigest,
} from './prompt.ts';
export type { EpisodeToolsOptions, ToolOutcome } from './tools.ts';
export { EpisodeTools, TOOL_TIMEOUT_MS } from './tools.ts';
export type { VerifyOptions } from './verify.ts';
export {
  loadMismatches,
  recordInconsistencies,
  verifyAgainstPolicySession,
  verifyByReplay,
} from './verify.ts';
export type { ResultRow, ResultsTable } from './results.ts';
export { playerLabel, readEpisodeRecords, resultsMarkdown, resultsTable } from './results.ts';
export type { BenchIo, MainOptions } from './cli.ts';
export { main, policyFactory } from './cli.ts';
