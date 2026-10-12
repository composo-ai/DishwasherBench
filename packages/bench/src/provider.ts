/**
 * The small interface a model is played through: the harness keeps the conversation in a
 * neutral form (text, tool calls, tool results with their pictures) and asks a provider for
 * the model's next turn. One implementation talks to Anthropic's API (`anthropic.ts`), one to
 * an OpenAI-compatible chat completions endpoint (`openai.ts`); the tests use one that plays
 * a scripted sequence of tool calls (`scripted-provider.ts`).
 *
 * A provider is stateless: everything it needs is in the request. What the model's API must
 * get back exactly as it sent it (signed reasoning blocks, tool-call ids) travels in
 * `native`, which the harness stores and returns untouched.
 */

import type { JsonValue } from '@spotless/core';
import type { EpisodeUsage } from '@spotless/server';

/** A tool as the model is told about it: exactly what the MCP server lists. */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  /** JSON Schema of the arguments. */
  readonly input_schema: { readonly [key: string]: unknown };
}

/** A tool call the model asks for. */
export interface ToolCallRequest {
  /** The provider's id of the call; the result is returned under it. */
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
}

/** A picture in the conversation, or the note left where one was taken out. */
export type HistoryImage =
  | { readonly media_type: 'image/png'; readonly data_base64: string }
  | { readonly removed: true; readonly note: string };

/** The result of one tool call as the model is shown it. */
export interface ToolResultEntry {
  readonly call_id: string;
  readonly name: string;
  /** The structured result as JSON text. */
  readonly text: string;
  readonly images: readonly HistoryImage[];
  readonly is_error: boolean;
}

/** One entry of the conversation. */
export type HistoryEntry =
  | {
      readonly role: 'user';
      readonly text: string;
      /** Pictures given with the message (the context policy re-supplies the sheet of items so). */
      readonly images?: readonly HistoryImage[];
    }
  | {
      readonly role: 'assistant';
      readonly text: string;
      readonly tool_calls: readonly ToolCallRequest[];
      /** The provider's own form of the turn, returned to it verbatim. */
      readonly native: unknown;
    }
  | { readonly role: 'tool'; readonly results: readonly ToolResultEntry[] };

/**
 * Tokens of a turn: the same record an episode keeps of all its turns together
 * (`EpisodeUsage` of `@spotless/server`). `input_tokens` are the tokens of the request that
 * were neither read from the provider's cache nor written to it; `output_tokens` are
 * everything the model wrote, reasoning included. Where the provider says how much of the
 * output was reasoning, that share is given beside (`reasoning_output_tokens`).
 */
export type TurnUsage = EpisodeUsage;

/** Why a turn of the model ended. */
export type TurnStop = 'tool_use' | 'end_turn' | 'max_tokens' | 'refusal' | 'other';

/** One turn of the model. */
export interface ModelTurn {
  /** What the model said in words (may be empty). */
  readonly text: string;
  readonly tool_calls: readonly ToolCallRequest[];
  readonly stop: TurnStop;
  /** More about the stop, when the provider says (a refusal category, an unknown stop reason). */
  readonly stop_detail?: string;
  readonly usage: TurnUsage;
  /** The model that answered, as the provider names it. */
  readonly model: string;
  readonly native: unknown;
  /**
   * Reasoning blocks of earlier turns that the provider said it did not give the model in
   * this request, because the conversation before them had been edited (a fold, a picture
   * pruning). Absent when the provider does not say or carries reasoning another way.
   */
  readonly reasoning_blocks_dropped?: number;
}

/** What a provider is asked. */
export interface TurnRequest {
  readonly system: string;
  readonly tools: readonly ToolSpec[];
  readonly history: readonly HistoryEntry[];
}

/** A model behind an API. */
export interface ModelProvider {
  /** For example `anthropic` or `openai`. */
  readonly name: string;
  /** The model id asked for. */
  readonly model: string;
  /** The settings requests are made with, for the episode record. */
  settings(): JsonValue;
  /** The model's next turn. Rejects with a {@link ProviderError} when the API fails. */
  complete(request: TurnRequest): Promise<ModelTurn>;
}

/** A failure of the model's API: infrastructure, never a move of the player. */
export class ProviderError extends Error {
  constructor(
    /** `auth`, `rate_limit`, `bad_request`, `api`, `connection`, `timeout`, `config`. */
    readonly kind: string,
    message: string,
    /** HTTP status, when there was one. */
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** No tokens. */
export const NO_USAGE: EpisodeUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};

/** The sum of two usages. */
export function addUsage(a: TurnUsage, b: TurnUsage): TurnUsage {
  const reasoning =
    a.reasoning_output_tokens === undefined && b.reasoning_output_tokens === undefined
      ? undefined
      : (a.reasoning_output_tokens ?? 0) + (b.reasoning_output_tokens ?? 0);
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    ...(reasoning === undefined ? {} : { reasoning_output_tokens: reasoning }),
  };
}
