/**
 * The provider for an OpenAI-compatible endpoint, with native tool calling, spoken directly
 * over HTTP (no SDK), so that it serves OpenAI's own API, an Azure deployment
 * (`https://<resource>.services.ai.azure.com/openai/v1`, where the model is the name of the
 * deployment and the key travels in the header `api-key`) and anything else that speaks the
 * same dialect. It speaks either of the two APIs such an endpoint offers:
 *
 *  - `responses` (the default): `POST {base}/responses`. The one on which the current
 *    reasoning models take function tools at all: the deployment this was first run against
 *    answers a chat completions request that has tools with "Function tools with
 *    reasoning_effort are not supported ... use /v1/responses or set reasoning_effort to
 *    'none'". The request is stateless (`store: false`): the model's own turns go back as the
 *    items they came as, reasoning items with their encrypted content included, and the
 *    result of a tool call carries its pictures itself, as this API allows
 *    (`function_call_output` with `input_image` parts).
 *  - `chat`: `POST {base}/chat/completions`. A tool message of this API carries text only,
 *    so the pictures of a round of tool results are sent in one user message right after
 *    that round's tool messages, each labelled with the tool and the id of the call it
 *    answers; the tool message says that a picture follows.
 *
 * The harness's conversation is turned into either form by a pure function
 * (`openaiResponsesInput`, `openaiMessages`). When the context policy takes an old picture
 * out, the note it leaves stands in the text of the result and the picture is gone.
 *
 * Requests are not streamed: each has a time limit, and a request that fails in a way worth
 * trying again (429, 408, 5xx, a broken connection, the time limit) is retried with
 * exponential back-off, waiting as long as the server asks when it says so (`Retry-After`,
 * `retry-after-ms`).
 *
 * The address, the key and the deployment come from options or from the environment
 * (`SPOTLESS_OPENAI_BASE_URL`, `SPOTLESS_OPENAI_API_KEY`, ...; the command line loads the
 * repository's `.env` first). The key is sent in one request header and goes nowhere else:
 * not into settings, records, errors or logs. The tests point the provider at a local
 * stand-in for the API.
 */

import type { JsonValue } from '@spotless/core';
import { STANDARD_MAX_TOKENS } from './anthropic.ts';
import type {
  HistoryEntry,
  ModelProvider,
  ModelTurn,
  ToolCallRequest,
  TurnRequest,
  TurnStop,
  TurnUsage,
} from './provider.ts';
import { ProviderError } from './provider.ts';

/** The environment variables the provider reads when an option is not given. */
export const OPENAI_ENV = {
  baseURL: 'SPOTLESS_OPENAI_BASE_URL',
  /** `responses` or `chat`. */
  api: 'SPOTLESS_OPENAI_API',
  apiKey: 'SPOTLESS_OPENAI_API_KEY',
  /** `api-key` or `authorization`. */
  authHeader: 'SPOTLESS_OPENAI_AUTH_HEADER',
  reasoningEffort: 'SPOTLESS_OPENAI_REASONING_EFFORT',
  /**
   * US dollars per million tokens, for any model; a deployment's own prices are given in
   * variables with its name in them (see {@link openaiPricesFor}).
   */
  priceInput: 'SPOTLESS_OPENAI_PRICE_INPUT',
  priceCachedInput: 'SPOTLESS_OPENAI_PRICE_CACHED_INPUT',
  priceOutput: 'SPOTLESS_OPENAI_PRICE_OUTPUT',
} as const;

/** Prices, US dollars per million tokens. Reasoning is billed as output. */
export interface OpenAiPrices {
  readonly input: number;
  /** Input read from the provider's cache; the price of fresh input when not given. */
  readonly cachedInput?: number;
  readonly output: number;
}

/** Options of {@link openaiProvider}. */
export interface OpenAiProviderOptions {
  /** The model, or on Azure the name of the deployment, for example `gpt-6.1-sol`. */
  readonly model: string;
  /** Address of the API up to and without `/responses`; default `SPOTLESS_OPENAI_BASE_URL`. */
  readonly baseURL?: string;
  /**
   * Which API is spoken: `responses` (default, or `SPOTLESS_OPENAI_API`) or `chat` (chat
   * completions, for endpoints that have no Responses API).
   */
  readonly api?: 'responses' | 'chat';
  /** The key itself; default the value of the variable named by `apiKeyEnv`. */
  readonly apiKey?: string;
  /** Name of the environment variable that holds the key; default `SPOTLESS_OPENAI_API_KEY`. */
  readonly apiKeyEnv?: string;
  /**
   * The header the key is sent in: `api-key` (Azure) or `authorization` (`Bearer <key>`:
   * OpenAI and most others). Default `SPOTLESS_OPENAI_AUTH_HEADER`, else `api-key` for a host
   * under `azure.com` and `authorization` otherwise.
   */
  readonly authHeader?: 'api-key' | 'authorization';
  /**
   * Reasoning effort of the request (`reasoning.effort`, or `reasoning_effort` in chat
   * completions): `none`, `minimal`, `low`, `medium`, `high`, ...; what the model accepts. Default `SPOTLESS_OPENAI_REASONING_EFFORT`; when neither is set the field
   * is not sent and the model's own default holds, which the record says.
   */
  readonly reasoningEffort?: string;
  /**
   * Most tokens of one turn, reasoning included (`max_output_tokens`, or
   * `max_completion_tokens` in chat completions); default 64,000.
   */
  readonly maxTokens?: number;
  /** Time limit of one request, milliseconds; default 10 minutes. */
  readonly timeoutMs?: number;
  /** Times a request that failed in a way worth retrying is sent again; default 5. */
  readonly maxRetries?: number;
  /** First wait of the back-off, milliseconds (doubled each time, with jitter); default 2000. */
  readonly retryBaseMs?: number;
  /** Longest wait between two tries, whatever the server asks; default 120 s. */
  readonly maxRetryDelayMs?: number;
  /** Prices for the cost in the record; default from the environment, else no cost is recorded. */
  readonly prices?: OpenAiPrices;
  /** The environment read for defaults; default `process.env`. */
  readonly env?: { readonly [name: string]: string | undefined };
}

/** A message of the chat completions API, as far as the harness builds them. */
export type OpenAiMessage =
  | { readonly role: 'system'; readonly content: string }
  | { readonly role: 'user'; readonly content: string | readonly OpenAiPart[] }
  | {
      readonly role: 'assistant';
      readonly content: string | null;
      readonly tool_calls?: readonly OpenAiToolCall[];
    }
  | { readonly role: 'tool'; readonly tool_call_id: string; readonly content: string };

/** A part of a user message. */
export type OpenAiPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image_url'; readonly image_url: { readonly url: string } };

/** A tool call as the API writes it: the arguments are JSON in a string. */
export interface OpenAiToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}

/** What precedes the pictures of a round of tool results. */
export const PICTURES_PREAMBLE =
  'The pictures returned by the tool calls above (a tool result carries text only, so its pictures are given here, each under the call it belongs to):';

/**
 * The conversation as the chat completions API takes it. A pure function: the same history
 * gives the same messages, byte for byte.
 */
export function openaiMessages(system: string, history: readonly HistoryEntry[]): OpenAiMessage[] {
  const messages: OpenAiMessage[] = [{ role: 'system', content: system }];
  for (const entry of history) {
    if (entry.role === 'user') {
      const given = (entry.images ?? []).flatMap((image): OpenAiPart[] =>
        'removed' in image
          ? []
          : [
              {
                type: 'image_url',
                image_url: { url: `data:${image.media_type};base64,${image.data_base64}` },
              },
            ],
      );
      messages.push({
        role: 'user',
        content: given.length === 0 ? entry.text : [{ type: 'text', text: entry.text }, ...given],
      });
      continue;
    }
    if (entry.role === 'assistant') {
      // The turn as the API returned it (text and tool calls with their ids).
      messages.push(entry.native as OpenAiMessage);
      continue;
    }
    const pictures: OpenAiPart[] = [];
    for (const result of entry.results) {
      const present = result.images.filter((image) => !('removed' in image)).length;
      const notes = result.images.flatMap((image) => ('removed' in image ? [image.note] : []));
      if (present > 0) {
        notes.push(
          `[${present === 1 ? 'the picture' : `the ${present} pictures`} of this result ${present === 1 ? 'is' : 'are'} in the next user message, under "${result.name}, call ${result.call_id}"]`,
        );
      }
      messages.push({
        role: 'tool',
        tool_call_id: result.call_id,
        content: [result.text, ...notes].join('\n'),
      });
      let n = 0;
      for (const image of result.images) {
        if ('removed' in image) continue;
        n += 1;
        pictures.push(
          {
            type: 'text',
            text: `${result.name}, call ${result.call_id}${present > 1 ? `, picture ${n} of ${present}` : ''}:`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${image.media_type};base64,${image.data_base64}` },
          },
        );
      }
    }
    if (pictures.length > 0) {
      messages.push({
        role: 'user',
        content: [{ type: 'text', text: PICTURES_PREAMBLE }, ...pictures],
      });
    }
  }
  return messages;
}

/** An item of the input of the Responses API, as far as the harness builds them. */
export type OpenAiInputItem =
  | { readonly role: 'user'; readonly content: string | readonly OpenAiOutputPart[] }
  | {
      readonly type: 'function_call_output';
      readonly call_id: string;
      readonly output: string | readonly OpenAiOutputPart[];
    }
  /** An item of the model's own turn, returned as it came. */
  | { readonly type: string; readonly [key: string]: unknown };

/** A part of the result of a tool call in the Responses API. */
export type OpenAiOutputPart =
  | { readonly type: 'input_text'; readonly text: string }
  | { readonly type: 'input_image'; readonly image_url: string };

/**
 * The conversation as the Responses API takes it (the system prompt travels beside it, as
 * `instructions`). A pure function: the same history gives the same items, byte for byte.
 */
export function openaiResponsesInput(history: readonly HistoryEntry[]): OpenAiInputItem[] {
  const items: OpenAiInputItem[] = [];
  for (const entry of history) {
    if (entry.role === 'user') {
      const given = (entry.images ?? []).flatMap((image): OpenAiOutputPart[] =>
        'removed' in image
          ? []
          : [
              {
                type: 'input_image',
                image_url: `data:${image.media_type};base64,${image.data_base64}`,
              },
            ],
      );
      items.push({
        role: 'user',
        content:
          given.length === 0 ? entry.text : [{ type: 'input_text', text: entry.text }, ...given],
      });
      continue;
    }
    if (entry.role === 'assistant') {
      // The items of the turn as the API returned them: reasoning, text, function calls.
      items.push(...(entry.native as OpenAiInputItem[]));
      continue;
    }
    for (const result of entry.results) {
      const notes = result.images.flatMap((image) => ('removed' in image ? [image.note] : []));
      const text = [result.text, ...notes].join('\n');
      const pictures = result.images.flatMap((image): OpenAiOutputPart[] =>
        'removed' in image
          ? []
          : [
              {
                type: 'input_image',
                image_url: `data:${image.media_type};base64,${image.data_base64}`,
              },
            ],
      );
      items.push({
        type: 'function_call_output',
        call_id: result.call_id,
        // A result without pictures is plain text; one with pictures carries them after its text.
        output: pictures.length === 0 ? text : [{ type: 'input_text', text }, ...pictures],
      });
    }
  }
  return items;
}

/** The `usage` block of a reply of either API, as far as it is read. */
interface OpenAiUsage {
  /** Chat completions. */
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly prompt_tokens_details?: { readonly cached_tokens?: number } | null;
  readonly completion_tokens_details?: { readonly reasoning_tokens?: number } | null;
  /** Responses. */
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly input_tokens_details?: {
    readonly cached_tokens?: number;
    readonly cache_write_tokens?: number;
  } | null;
  readonly output_tokens_details?: { readonly reasoning_tokens?: number } | null;
}

/**
 * Tokens of a reply in the harness's terms, from the usage block of either API. These APIs
 * count cached input inside the input tokens (`prompt_tokens`, `input_tokens`); the harness
 * keeps fresh input, input read from the cache and input written to it apart, so the last
 * two are taken out of the first. Reasoning is part of the output tokens and stays there;
 * its share is given beside when the reply states it.
 */
export function openaiUsage(usage: OpenAiUsage | null | undefined): TurnUsage {
  const prompt = usage?.input_tokens ?? usage?.prompt_tokens ?? 0;
  const details = usage?.input_tokens_details ?? usage?.prompt_tokens_details;
  const cached = Math.min(prompt, details?.cached_tokens ?? 0);
  const written = Math.min(prompt - cached, usage?.input_tokens_details?.cache_write_tokens ?? 0);
  const reasoning = (usage?.output_tokens_details ?? usage?.completion_tokens_details)
    ?.reasoning_tokens;
  return {
    input_tokens: prompt - cached - written,
    output_tokens: usage?.output_tokens ?? usage?.completion_tokens ?? 0,
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: written,
    ...(typeof reasoning === 'number' ? { reasoning_output_tokens: reasoning } : {}),
  };
}

/** How long to wait before the next try, from the headers of a reply; null when they do not say. */
export function retryAfterMs(headers: Headers, now: number = Date.now()): number | null {
  const ms = headers.get('retry-after-ms');
  if (ms !== null && ms.trim() !== '' && Number.isFinite(Number(ms)))
    return Math.max(0, Number(ms));
  const after = headers.get('retry-after');
  if (after === null || after.trim() === '') return null;
  if (Number.isFinite(Number(after))) return Math.max(0, Number(after) * 1000);
  const date = Date.parse(after);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

function priceOf(
  env: { readonly [name: string]: string | undefined },
  name: string,
): number | undefined {
  const text = env[name];
  if (text === undefined || text.trim() === '') return undefined;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** A model or deployment name as it stands in the name of an environment variable: `GPT_6_1_SOL`. */
export function envNameOf(model: string): string {
  return model
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * The prices of a model from the environment, US dollars per million tokens, or null when
 * input and output prices are not both given. A deployment's own variables come first
 * (`SPOTLESS_OPENAI_PRICE_<NAME>_INPUT`, `_CACHED_INPUT`, `_OUTPUT`, with the name as
 * {@link envNameOf} writes it: `SPOTLESS_OPENAI_PRICE_GPT_6_1_SOL_INPUT`), so that two
 * deployments of one endpoint are each priced as what they are; the variables without a
 * name (`SPOTLESS_OPENAI_PRICE_INPUT`, ...) hold for any model that has none of its own.
 */
export function openaiPricesFor(
  model: string,
  env: { readonly [name: string]: string | undefined } = process.env,
): OpenAiPrices | null {
  const own = `SPOTLESS_OPENAI_PRICE_${envNameOf(model)}_`;
  for (const prefix of [own, 'SPOTLESS_OPENAI_PRICE_']) {
    const input = priceOf(env, `${prefix}INPUT`);
    const output = priceOf(env, `${prefix}OUTPUT`);
    if (input === undefined || output === undefined) continue;
    const cached = priceOf(env, `${prefix}CACHED_INPUT`);
    return { input, output, ...(cached === undefined ? {} : { cachedInput: cached }) };
  }
  return null;
}

/** The kind of endpoint, for the record: the address itself is not written down. */
function endpointKind(baseURL: string): string {
  let host = '';
  try {
    host = new URL(baseURL).hostname;
  } catch {
    return 'invalid';
  }
  if (host.endsWith('.azure.com')) return 'azure';
  if (host === 'api.openai.com') return 'openai';
  if (host === '127.0.0.1' || host === 'localhost') return 'local';
  return 'other';
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A model behind an OpenAI-compatible endpoint as a provider. */
export function openaiProvider(options: OpenAiProviderOptions): ModelProvider {
  const env = options.env ?? process.env;
  const baseURL = (options.baseURL ?? env[OPENAI_ENV.baseURL] ?? '').replace(/\/+$/, '');
  const keyEnv = options.apiKeyEnv ?? OPENAI_ENV.apiKey;
  const apiKey = options.apiKey ?? env[keyEnv] ?? '';
  const kind = endpointKind(baseURL);
  const apiNamed = options.api ?? env[OPENAI_ENV.api];
  const api: 'responses' | 'chat' = apiNamed === 'chat' ? 'chat' : 'responses';
  const named = options.authHeader ?? env[OPENAI_ENV.authHeader];
  const authHeader: 'api-key' | 'authorization' =
    named === 'api-key' || named === 'authorization'
      ? named
      : kind === 'azure'
        ? 'api-key'
        : 'authorization';
  const effort = options.reasoningEffort ?? env[OPENAI_ENV.reasoningEffort];
  const reasoningEffort = effort === undefined || effort.trim() === '' ? undefined : effort.trim();
  const maxTokens = options.maxTokens ?? STANDARD_MAX_TOKENS;
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const maxRetries = options.maxRetries ?? 5;
  const retryBaseMs = options.retryBaseMs ?? 2000;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 120_000;
  const prices: OpenAiPrices | null = options.prices ?? openaiPricesFor(options.model, env);

  let requests = 0;
  let retries = 0;
  let fresh = 0;
  let written = 0;
  let effortReported: string | null = null;
  let cached = 0;
  let output = 0;
  let reasoning: number | null = null;

  /** No message that leaves this file carries the key. */
  const clean = (text: string): string =>
    apiKey === '' ? text : text.split(apiKey).join('[key removed]');

  const costUsd = (): number | null =>
    prices === null
      ? null
      : ((fresh + written) * prices.input +
          cached * (prices.cachedInput ?? prices.input) +
          output * prices.output) /
        1e6;

  /** Tool-call arguments as the tools take them: the JSON read, or the text when it is not JSON. */
  const argumentsOf = (text: string): unknown => {
    try {
      return text.trim() === '' ? {} : (JSON.parse(text) as unknown);
    } catch {
      // Not JSON: the tool is handed the text and answers that it cannot read it.
      return text;
    }
  };

  /** Sends one request, again when it fails in a way worth trying again; the reply as JSON. */
  const send = async (path: string, payload: unknown): Promise<unknown> => {
    if (baseURL === '') {
      throw new ProviderError(
        'config',
        `no address of the API (set ${OPENAI_ENV.baseURL}, or give --base-url)`,
      );
    }
    if (apiKey === '') {
      throw new ProviderError('auth', `no API key (set ${keyEnv})`);
    }
    const body = JSON.stringify(payload);
    const headers: { [name: string]: string } = {
      'content-type': 'application/json',
      ...(authHeader === 'api-key' ? { 'api-key': apiKey } : { authorization: `Bearer ${apiKey}` }),
    };
    for (let attempt = 0; ; attempt++) {
      let failure: ProviderError;
      let wait: number | null = null;
      let again = false;
      try {
        requests += 1;
        const response = await fetch(`${baseURL}${path}`, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await response.text();
        if (response.ok) {
          try {
            return JSON.parse(text) as unknown;
          } catch {
            throw new ProviderError('api', 'the reply is not JSON', response.status);
          }
        }
        let message = text.slice(0, 600);
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string; code?: unknown } };
          if (typeof parsed.error?.message === 'string') {
            message = `${typeof parsed.error.code === 'string' ? `${parsed.error.code}: ` : ''}${parsed.error.message}`;
          }
        } catch {
          // The body is not JSON: its first characters are the message.
        }
        const status = response.status;
        message = clean(`HTTP ${status}: ${message}`);
        failure =
          status === 401 || status === 403
            ? new ProviderError(
                'auth',
                `the API key was refused (${keyEnv}, sent as ${authHeader}): ${message}`,
                status,
              )
            : status === 429
              ? new ProviderError('rate_limit', message, status)
              : status >= 500 || status === 408
                ? new ProviderError('api', message, status)
                : new ProviderError('bad_request', message, status);
        again = status === 429 || status === 408 || status >= 500;
        wait = retryAfterMs(response.headers);
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        const name = error instanceof Error ? error.name : '';
        const detail = clean(error instanceof Error ? error.message : String(error));
        failure =
          name === 'TimeoutError' || name === 'AbortError'
            ? new ProviderError('timeout', `no reply within ${timeoutMs} ms`)
            : new ProviderError('connection', detail);
        again = true;
      }
      if (!again || attempt >= maxRetries) throw failure;
      retries += 1;
      const backoff = retryBaseMs * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await pause(Math.min(maxRetryDelayMs, wait ?? backoff));
    }
  };

  const count = (usage: TurnUsage): void => {
    fresh += usage.input_tokens;
    cached += usage.cache_read_input_tokens;
    written += usage.cache_creation_input_tokens;
    output += usage.output_tokens;
    if (usage.reasoning_output_tokens !== undefined) {
      reasoning = (reasoning ?? 0) + usage.reasoning_output_tokens;
    }
  };

  /** A turn through the Responses API. */
  const completeResponses = async (request: TurnRequest): Promise<ModelTurn> => {
    const reply = (await send('/responses', {
      model: options.model,
      instructions: request.system,
      input: openaiResponsesInput(request.history),
      tools: request.tools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
        strict: false,
      })),
      max_output_tokens: maxTokens,
      ...(reasoningEffort === undefined ? {} : { reasoning: { effort: reasoningEffort } }),
      // Stateless: nothing is kept by the API, and the reasoning travels with the conversation.
      store: false,
      include: ['reasoning.encrypted_content'],
    })) as {
      model?: string;
      status?: string;
      incomplete_details?: { reason?: string } | null;
      error?: { message?: string } | null;
      reasoning?: { effort?: string | null } | null;
      output?: {
        type: string;
        call_id?: string;
        name?: string;
        arguments?: string;
        content?: { type: string; text?: string; refusal?: string }[];
      }[];
      usage?: OpenAiUsage | null;
    };
    if (!Array.isArray(reply.output)) {
      throw new ProviderError('api', 'the reply has no output');
    }
    if (reply.status === 'failed') {
      throw new ProviderError('api', clean(`the response failed: ${reply.error?.message ?? ''}`));
    }
    if (typeof reply.reasoning?.effort === 'string') effortReported = reply.reasoning.effort;
    const usage = openaiUsage(reply.usage);
    count(usage);
    const text: string[] = [];
    const refusals: string[] = [];
    const calls: ToolCallRequest[] = [];
    for (const item of reply.output) {
      if (item.type === 'message') {
        for (const part of item.content ?? []) {
          if (part.type === 'output_text' && typeof part.text === 'string') text.push(part.text);
          else if (part.type === 'refusal' && typeof part.refusal === 'string')
            refusals.push(part.refusal);
        }
      } else if (item.type === 'function_call') {
        calls.push({
          id: item.call_id ?? '',
          name: item.name ?? '',
          arguments: argumentsOf(item.arguments ?? ''),
        });
      }
    }
    const why = reply.incomplete_details?.reason;
    let stop: TurnStop;
    let detail: string | undefined;
    if (reply.status === 'incomplete' && why === 'max_output_tokens') stop = 'max_tokens';
    else if (reply.status === 'incomplete' && why === 'content_filter') {
      stop = 'refusal';
      detail = 'content_filter';
    } else if (reply.status === 'incomplete') {
      stop = 'other';
      detail = `incomplete: ${String(why)}`;
    } else if (calls.length > 0) stop = 'tool_use';
    else if (refusals.length > 0) {
      stop = 'refusal';
      detail = refusals.join(' ').slice(0, 200);
    } else stop = 'end_turn';
    return {
      text: text.join('\n'),
      tool_calls: stop === 'max_tokens' ? [] : calls,
      stop,
      ...(detail === undefined ? {} : { stop_detail: detail }),
      usage,
      model: reply.model ?? options.model,
      // The items of the turn, for returning to the API as they came.
      native: reply.output,
    };
  };

  /** A turn through chat completions. */
  const completeChat = async (request: TurnRequest): Promise<ModelTurn> => {
    const reply = (await send('/chat/completions', {
      model: options.model,
      messages: openaiMessages(request.system, request.history),
      tools: request.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      })),
      max_completion_tokens: maxTokens,
      ...(reasoningEffort === undefined ? {} : { reasoning_effort: reasoningEffort }),
    })) as {
      model?: string;
      choices?: {
        finish_reason?: string | null;
        message?: {
          content?: string | null;
          refusal?: string | null;
          tool_calls?: OpenAiToolCall[] | null;
        };
      }[];
      usage?: OpenAiUsage | null;
    };
    const choice = reply.choices?.[0];
    const message = choice?.message;
    if (choice === undefined || message === undefined) {
      throw new ProviderError('api', 'the reply has no choice');
    }
    const usage = openaiUsage(reply.usage);
    count(usage);
    const toolCalls = message.tool_calls ?? [];
    const calls: ToolCallRequest[] = toolCalls.map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: argumentsOf(call.function.arguments),
    }));
    const reason = choice.finish_reason ?? null;
    const refused = typeof message.refusal === 'string' && message.refusal !== '';
    let stop: TurnStop;
    let detail: string | undefined;
    if (reason === 'length') stop = 'max_tokens';
    else if (reason === 'content_filter') {
      stop = 'refusal';
      detail = 'content_filter';
    } else if (calls.length > 0) stop = 'tool_use';
    else if (refused) {
      stop = 'refusal';
      detail = (message.refusal as string).slice(0, 200);
    } else if (reason === 'stop') stop = 'end_turn';
    else {
      stop = 'other';
      detail = String(reason);
    }
    return {
      text: message.content ?? '',
      tool_calls: stop === 'max_tokens' ? [] : calls,
      stop,
      ...(detail === undefined ? {} : { stop_detail: detail }),
      usage,
      model: reply.model ?? options.model,
      // What goes back to the API for this turn: its text and its tool calls, as they came.
      native: {
        role: 'assistant',
        content: message.content ?? (toolCalls.length === 0 ? '' : null),
        ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls }),
      } satisfies OpenAiMessage,
    };
  };

  return {
    name: 'openai',
    model: options.model,

    settings: (): JsonValue => ({
      api: api === 'chat' ? 'chat.completions' : 'responses',
      endpoint: kind,
      auth_header: authHeader,
      [api === 'chat' ? 'max_completion_tokens' : 'max_output_tokens']: maxTokens,
      reasoning_effort: reasoningEffort ?? 'model default (not sent)',
      // What the API says it ran with (the Responses API states it in every reply).
      reasoning_effort_reported: effortReported,
      sampling: 'model default',
      tool_choice: 'auto',
      stream: false,
      ...(api === 'chat'
        ? {}
        : { store: false, reasoning_carried: 'encrypted items returned with the conversation' }),
      pictures:
        api === 'chat'
          ? 'in a user message after the tool messages of their round'
          : 'in the function output of the call that returned them',
      request_timeout_ms: timeoutMs,
      max_retries: maxRetries,
      requests,
      retries,
      tokens: {
        input_fresh: fresh,
        input_cached: cached,
        input_cache_written: written,
        output,
        output_reasoning: reasoning,
      },
      prices_usd_per_million_tokens:
        prices === null
          ? null
          : {
              input: prices.input,
              cached_input: prices.cachedInput ?? prices.input,
              output: prices.output,
            },
      cost_usd: costUsd(),
      ...(prices === null ? { cost_note: 'no prices were supplied, so no cost is recorded' } : {}),
    }),

    complete: (request: TurnRequest): Promise<ModelTurn> =>
      api === 'chat' ? completeChat(request) : completeResponses(request),
  };
}
