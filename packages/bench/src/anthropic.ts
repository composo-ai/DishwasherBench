/**
 * The Anthropic implementation of the provider interface: the Messages API through the
 * official SDK, with native tool calling and adaptive thinking.
 *
 * The harness's conversation is turned into the API's messages by one pure function. The
 * model's own turns go back exactly as they came (their reasoning blocks are signed), and
 * the tool results are built the same way every time, so that from one request to the next
 * the conversation only grows at its end, except when the context policy takes old pictures
 * out. That is an edit of earlier turns, which on current models invalidates the reasoning
 * blocks after it; the request therefore asks the API to drop such blocks instead of
 * refusing (`prefix_mismatch_behavior: 'drop_block'`), and records how many were dropped.
 * The same holds when the policy folds the oldest turns into a note: the turns that remain
 * follow a first message that has changed.
 *
 * No fallback model is configured: an episode is the named model's or nobody's. When the
 * model declines, the turn ends as a refusal and is recorded as one.
 *
 * The API key comes from the environment (the SDK reads `ANTHROPIC_API_KEY`, or the profile
 * of `ant auth login`). Nothing here is called by the tests with a real key: they point the
 * SDK at a local stand-in for the API.
 *
 * This file was written from Anthropic's documentation of October 2026 and has never been run
 * against the live API: the model ids, the effort defaults and the beta named below are as
 * that documentation gave them and are untested here.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { JsonValue } from '@spotless/core';
import type {
  HistoryEntry,
  ModelProvider,
  ModelTurn,
  ToolCallRequest,
  TurnRequest,
  TurnStop,
} from './provider.ts';
import { ProviderError } from './provider.ts';

/**
 * Model ids as of October 2026, from Anthropic's documentation; check the current list. Any
 * other id the API knows may be given.
 */
export const ANTHROPIC_MODELS = [
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
] as const;

/** The beta that lets a request say what happens to reasoning blocks of an edited conversation. */
const BINDING_BETA = 'thinking-binding-controls-2026-08-01';

/** How much effort the model is asked for. */
export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Effort of the standard harness: the same for every model, stated in every request. */
export const STANDARD_EFFORT: AnthropicEffort = 'high';

/** Output limit of one turn in the standard harness, tokens (reasoning included). */
export const STANDARD_MAX_TOKENS = 64_000;

/** Options of {@link anthropicProvider}. */
export interface AnthropicProviderOptions {
  /** Model id, for example `claude-opus-5-5`. */
  readonly model: string;
  /**
   * Most tokens of one turn (reasoning included); default 64,000, half of what the current
   * models can write in a turn. The request is streamed, so a long turn meets no timeout.
   */
  readonly maxTokens?: number;
  /**
   * Effort (`output_config.effort`). Default `high`, sent explicitly: by Anthropic's
   * documentation of October 2026 the models' own defaults differ (`medium` on Claude Opus 5.5
   * and Claude Haiku 5.5, `high` on the others), and rows of one table must be run at one
   * setting. The record says which.
   */
  readonly effort?: AnthropicEffort;
  /**
   * What the API does with a reasoning block whose conversation was edited (the context
   * policy removing old pictures): `drop_block` (default) drops it and goes on; `error`
   * refuses the request; `off` sends no instruction and no beta header.
   */
  readonly prefixMismatch?: 'drop_block' | 'error' | 'off';
  /** Mark the conversation for the prompt cache; default true. */
  readonly cache?: boolean;
  /** Address of the API; default the SDK's (or `ANTHROPIC_BASE_URL`). The tests give a local one. */
  readonly baseURL?: string;
  /** API key; default from the environment. */
  readonly apiKey?: string;
  /** Times the SDK retries a request that failed in a way worth retrying; default 4. */
  readonly maxRetries?: number;
}

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type ToolResultContent = Anthropic.Beta.BetaTextBlockParam | Anthropic.Beta.BetaImageBlockParam;

/**
 * The conversation as the Messages API takes it. A pure function: the same history gives the
 * same messages, byte for byte.
 */
export function anthropicMessages(history: readonly HistoryEntry[]): MessageParam[] {
  return history.map((entry): MessageParam => {
    if (entry.role === 'user') {
      const pictures = (entry.images ?? []).filter((image) => !('removed' in image));
      if (pictures.length === 0) return { role: 'user', content: entry.text };
      return {
        role: 'user',
        content: [
          { type: 'text' as const, text: entry.text },
          ...pictures.map((image): ToolResultContent =>
            'removed' in image
              ? { type: 'text', text: image.note }
              : {
                  type: 'image',
                  source: { type: 'base64', media_type: image.media_type, data: image.data_base64 },
                },
          ),
        ],
      };
    }
    if (entry.role === 'assistant') {
      // The turn as the API returned it, reasoning blocks and all.
      return { role: 'assistant', content: entry.native as ContentBlockParam[] };
    }
    return {
      role: 'user',
      content: entry.results.map((result) => ({
        type: 'tool_result' as const,
        tool_use_id: result.call_id,
        ...(result.is_error ? { is_error: true } : {}),
        content: [
          { type: 'text' as const, text: result.text },
          ...result.images.map((image): ToolResultContent =>
            'removed' in image
              ? { type: 'text', text: image.note }
              : {
                  type: 'image',
                  source: { type: 'base64', media_type: image.media_type, data: image.data_base64 },
                },
          ),
        ],
      })),
    };
  });
}

function stopOf(reason: string | null): TurnStop {
  switch (reason) {
    case 'tool_use':
    case 'end_turn':
    case 'max_tokens':
    case 'refusal':
      return reason;
    default:
      return 'other';
  }
}

/** A model of Anthropic's as a provider. */
export function anthropicProvider(options: AnthropicProviderOptions): ModelProvider {
  const maxTokens = options.maxTokens ?? STANDARD_MAX_TOKENS;
  const effort = options.effort ?? STANDARD_EFFORT;
  const prefixMismatch = options.prefixMismatch ?? 'drop_block';
  const cache = options.cache !== false;
  const client = new Anthropic({
    ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
    ...(options.baseURL === undefined ? {} : { baseURL: options.baseURL }),
    maxRetries: options.maxRetries ?? 4,
  });
  let dropped = 0;

  return {
    name: 'anthropic',
    model: options.model,

    settings: (): JsonValue => ({
      api: 'messages',
      max_tokens: maxTokens,
      thinking: 'adaptive',
      effort,
      sampling: 'model default',
      tool_choice: 'auto',
      prompt_cache: cache,
      fallback_model: 'none',
      prefix_mismatch_behavior: prefixMismatch,
      betas: prefixMismatch === 'off' ? [] : [BINDING_BETA],
      reasoning_blocks_dropped: dropped,
    }),

    async complete(request: TurnRequest): Promise<ModelTurn> {
      const tools: Anthropic.Beta.BetaTool[] = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema as Anthropic.Beta.BetaTool['input_schema'],
      }));
      let message: Anthropic.Beta.BetaMessage;
      try {
        // Streamed, so that a long turn of reasoning does not run into a request timeout.
        const stream = client.beta.messages.stream({
          model: options.model,
          max_tokens: maxTokens,
          system: request.system,
          tools,
          messages: anthropicMessages(request.history),
          thinking:
            prefixMismatch === 'off'
              ? { type: 'adaptive' }
              : { type: 'adaptive', block_binding: { prefix_mismatch_behavior: prefixMismatch } },
          ...(prefixMismatch === 'off' ? {} : { betas: [BINDING_BETA] }),
          output_config: { effort },
          // The cache breakpoint follows the end of the conversation from turn to turn.
          ...(cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
        });
        message = await stream.finalMessage();
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) {
          throw new ProviderError(
            'auth',
            'the API key was refused (set ANTHROPIC_API_KEY)',
            error.status,
          );
        }
        if (error instanceof Anthropic.PermissionDeniedError) {
          throw new ProviderError('auth', error.message, error.status);
        }
        if (error instanceof Anthropic.RateLimitError) {
          throw new ProviderError('rate_limit', error.message, error.status);
        }
        if (error instanceof Anthropic.BadRequestError) {
          throw new ProviderError('bad_request', error.message, error.status);
        }
        if (error instanceof Anthropic.APIConnectionError) {
          throw new ProviderError('connection', error.message);
        }
        if (error instanceof Anthropic.APIError) {
          throw new ProviderError('api', error.message, error.status);
        }
        throw error;
      }
      let droppedNow = 0;
      for (const change of message.input_transformations ?? []) {
        if (change.type === 'thinking_dropped') droppedNow += 1;
      }
      dropped += droppedNow;
      const text: string[] = [];
      const calls: ToolCallRequest[] = [];
      for (const block of message.content) {
        if (block.type === 'text') text.push(block.text);
        else if (block.type === 'tool_use') {
          calls.push({ id: block.id, name: block.name, arguments: block.input });
        }
      }
      const stop = stopOf(message.stop_reason);
      const detail =
        stop === 'refusal'
          ? (message.stop_details?.category ?? 'refusal')
          : stop === 'other'
            ? String(message.stop_reason)
            : undefined;
      return {
        text: text.join('\n'),
        tool_calls: calls,
        stop,
        ...(detail === undefined ? {} : { stop_detail: detail }),
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
        },
        model: message.model,
        native: message.content,
        ...(prefixMismatch === 'off' ? {} : { reasoning_blocks_dropped: droppedNow }),
      };
    },
  };
}
