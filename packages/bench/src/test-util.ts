/**
 * Helpers for this package's tests (not exported from the package entry point): a game
 * server that simulates no wash and draws no pictures, and a local stand-in for Anthropic's
 * Messages API that plays scripted turns, so that the provider is exercised through the real
 * SDK without any call leaving this machine; and a stand-in for an OpenAI-compatible chat
 * completions endpoint, for the provider that speaks to one.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import type { IncomingMessage, Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ServerOptions } from '@spotless/server';
import type { WireImage } from '@spotless/session';
import { placeholderWashRunner } from '@spotless/session';
import { afterEach } from 'vitest';
import type { HarnessGame } from './game.ts';
import { startGame } from './game.ts';

/** A fixed 1 x 1 PNG. */
export const DOT =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A picture of the given nominal size that is really the dot. */
export function dot(size: number): WireImage {
  return { mime_type: 'image/png', width_px: size, height_px: size, data_base64: DOT };
}

/**
 * Registers an `afterEach` hook that closes what the returned factories made and removes
 * their directories. Call once at the top of a test file.
 */
export function useHarness(): {
  /** A game server in benchmark mode whose wash is the placeholder and whose pictures are dots. */
  game: (server?: Partial<ServerOptions>) => Promise<HarnessGame>;
  /** A fresh directory for a run's output. */
  outDir: () => string;
  /** A local stand-in for the Messages API. */
  fakeApi: (turns: readonly FakeTurn[]) => Promise<FakeApi>;
  /** A local stand-in for an OpenAI-compatible chat completions endpoint. */
  fakeOpenAi: (turns: readonly FakeChatTurn[]) => Promise<FakeApi>;
} {
  const cleanup: (() => Promise<void> | void)[] = [];
  afterEach(async () => {
    for (const undo of cleanup.splice(0).reverse()) await undo();
  });
  const directory = (prefix: string): string => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
  };
  return {
    outDir: () => directory('spotless-bench-out-'),
    async game(server = {}) {
      const game = await startGame({
        dataDir: directory('spotless-bench-data-'),
        render: false,
        // The harness replays logs on the levels the server offers.
        ...(server.levels === undefined ? {} : { levels: server.levels }),
        server: {
          washRunner: placeholderWashRunner,
          renderer: {
            render: (_session, request) => Promise.resolve(dot(request.options?.size_px ?? 768)),
            thumbnails: () => Promise.resolve([dot(256), dot(256), dot(256), dot(256)]),
          },
          ...server,
        },
      });
      cleanup.push(() => game.close());
      return game;
    },
    async fakeApi(turns) {
      const api = await startFakeApi(turns);
      cleanup.push(() => api.close());
      return api;
    },
    async fakeOpenAi(turns) {
      const api = await startFakeOpenAi(turns);
      cleanup.push(() => api.close());
      return api;
    },
  };
}

/** One scripted answer of the stand-in API. */
export type FakeTurn =
  | {
      readonly calls: readonly { readonly name: string; readonly input: unknown }[];
      readonly text?: string;
    }
  | { readonly text: string; readonly stop?: string; readonly category?: string }
  | { readonly status: number; readonly error: string };

/** The stand-in API and what it was sent. */
export interface FakeApi {
  /** Give this to the SDK as `baseURL`. */
  readonly url: string;
  /** The JSON body of every request, in order. */
  readonly bodies: { [key: string]: unknown }[];
  /** The headers of every request, in order. */
  readonly headers: IncomingMessage['headers'][];
  close(): Promise<void>;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Starts a stand-in for `POST /v1/messages` with streaming: the n-th request is answered with
 * the n-th scripted turn as a server-sent event stream in the API's format (the last turn is
 * repeated when the script is used up). It checks nothing and bills nothing.
 */
export async function startFakeApi(turns: readonly FakeTurn[]): Promise<FakeApi> {
  const bodies: { [key: string]: unknown }[] = [];
  const headers: IncomingMessage['headers'][] = [];
  const http: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const index = bodies.length;
      bodies.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as { [key: string]: unknown });
      headers.push(request.headers);
      const turn = turns[Math.min(index, turns.length - 1)] as FakeTurn;
      if ('status' in turn) {
        response.writeHead(turn.status, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({ type: 'error', error: { type: 'api_error', message: turn.error } }),
        );
        return;
      }
      const model = String(bodies[index]?.['model']);
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      response.write(
        sse('message_start', {
          type: 'message_start',
          message: {
            id: `msg_fake_${index}`,
            type: 'message',
            role: 'assistant',
            model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 100 + index,
              output_tokens: 1,
              cache_creation_input_tokens: 7,
              cache_read_input_tokens: 50,
            },
            input_transformations: [],
          },
        }),
      );
      let block = 0;
      // A turn opens with a (signed, empty) reasoning block, as the current models' turns do.
      response.write(
        sse('content_block_start', {
          type: 'content_block_start',
          index: block,
          content_block: { type: 'thinking', thinking: '', signature: '' },
        }),
      );
      response.write(
        sse('content_block_delta', {
          type: 'content_block_delta',
          index: block,
          delta: { type: 'signature_delta', signature: `sig_${index}` },
        }),
      );
      response.write(sse('content_block_stop', { type: 'content_block_stop', index: block }));
      block += 1;
      if (turn.text !== undefined && turn.text !== '') {
        response.write(
          sse('content_block_start', {
            type: 'content_block_start',
            index: block,
            content_block: { type: 'text', text: '' },
          }),
        );
        response.write(
          sse('content_block_delta', {
            type: 'content_block_delta',
            index: block,
            delta: { type: 'text_delta', text: turn.text },
          }),
        );
        response.write(sse('content_block_stop', { type: 'content_block_stop', index: block }));
        block += 1;
      }
      const calls = 'calls' in turn ? turn.calls : [];
      calls.forEach((call, i) => {
        response.write(
          sse('content_block_start', {
            type: 'content_block_start',
            index: block,
            content_block: {
              type: 'tool_use',
              id: `toolu_fake_${index}_${i}`,
              name: call.name,
              input: {},
            },
          }),
        );
        response.write(
          sse('content_block_delta', {
            type: 'content_block_delta',
            index: block,
            delta: { type: 'input_json_delta', partial_json: JSON.stringify(call.input) },
          }),
        );
        response.write(sse('content_block_stop', { type: 'content_block_stop', index: block }));
        block += 1;
      });
      const stop = 'calls' in turn ? 'tool_use' : (turn.stop ?? 'end_turn');
      response.write(
        sse('message_delta', {
          type: 'message_delta',
          delta: {
            stop_reason: stop,
            stop_sequence: null,
            ...(stop === 'refusal' && 'category' in turn
              ? {
                  stop_details: {
                    type: 'refusal',
                    category: turn.category,
                    explanation: 'declined',
                  },
                }
              : {}),
          },
          usage: { output_tokens: 20 + index },
        }),
      );
      response.write(sse('message_stop', { type: 'message_stop' }));
      response.end();
    });
  });
  await new Promise<void>((resolve) => {
    http.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (http.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    bodies,
    headers,
    close: () =>
      new Promise<void>((resolve) => {
        http.close(() => resolve());
        http.closeAllConnections();
      }),
  };
}

/** One scripted answer of the stand-in chat completions endpoint. */
export type FakeChatTurn =
  | {
      readonly calls: readonly { readonly name: string; readonly input: unknown }[];
      readonly text?: string;
      /** Tokens of the reply that were reasoning; default 5. */
      readonly reasoning?: number;
    }
  | {
      readonly text: string;
      /** `finish_reason`; default `stop`. */
      readonly finish?: string;
      /** With `finish: 'length'`: a tool call whose arguments were cut off, as a cut-off turn carries. */
      readonly partialCall?: { readonly name: string; readonly arguments: string };
      readonly refusal?: string;
    }
  | {
      readonly status: number;
      readonly error: string;
      /** Headers of the failure, for example `retry-after`. */
      readonly headers?: { readonly [name: string]: string };
    }
  /** The request is left without an answer for this long, milliseconds. */
  | { readonly hangMs: number };

/**
 * Starts a stand-in for `POST /responses` and `POST /chat/completions` (not streamed): the
 * n-th request is answered with the n-th scripted turn in the format of the API it was sent
 * to (the last turn is repeated when the script is used up). The usage it reports grows with
 * the index of the request: 1000 + n tokens of input of which 600 cached, 40 + n of output of
 * which some reasoning. A reply of the Responses API opens with a reasoning item with
 * encrypted content, as a reasoning model's does; a turn with `partialCall` there is an
 * incomplete response.
 */
export async function startFakeOpenAi(turns: readonly FakeChatTurn[]): Promise<FakeApi> {
  const bodies: { [key: string]: unknown }[] = [];
  const headers: IncomingMessage['headers'][] = [];
  const timers = new Set<NodeJS.Timeout>();
  const http: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const responsesApi = request.url === '/responses';
      if (request.method !== 'POST' || (request.url !== '/chat/completions' && !responsesApi)) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: `no ${request.url ?? ''}` } }));
        return;
      }
      const index = bodies.length;
      bodies.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as { [key: string]: unknown });
      headers.push(request.headers);
      const turn = turns[Math.min(index, turns.length - 1)] as FakeChatTurn;
      if ('hangMs' in turn) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          response.destroy();
        }, turn.hangMs);
        timers.add(timer);
        return;
      }
      if ('status' in turn) {
        response.writeHead(turn.status, {
          'content-type': 'application/json',
          ...(turn.headers ?? {}),
        });
        response.end(JSON.stringify({ error: { code: String(turn.status), message: turn.error } }));
        return;
      }
      const calls = 'calls' in turn ? turn.calls : [];
      const toolCalls = [
        ...calls.map((call, i) => ({
          id: `call_fake_${index}_${i}`,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.input) },
        })),
        ...('partialCall' in turn && turn.partialCall !== undefined
          ? [{ id: `call_fake_${index}_cut`, type: 'function', function: turn.partialCall }]
          : []),
      ];
      const finish = 'calls' in turn ? 'tool_calls' : (turn.finish ?? 'stop');
      response.writeHead(200, { 'content-type': 'application/json' });
      if (responsesApi) {
        const incomplete = finish === 'length' || finish === 'content_filter';
        response.end(
          JSON.stringify({
            id: `resp_fake_${index}`,
            object: 'response',
            model: `${String(bodies[index]?.['model'])}-2026-09-01`,
            status: incomplete ? 'incomplete' : 'completed',
            incomplete_details: incomplete
              ? { reason: finish === 'length' ? 'max_output_tokens' : 'content_filter' }
              : null,
            reasoning: { effort: 'medium', summary: null },
            output: [
              {
                id: `rs_fake_${index}`,
                type: 'reasoning',
                summary: [],
                encrypted_content: `enc_${index}`,
              },
              ...((turn.text !== undefined && turn.text !== '') ||
              ('refusal' in turn && turn.refusal !== undefined)
                ? [
                    {
                      id: `msg_fake_${index}`,
                      type: 'message',
                      role: 'assistant',
                      status: 'completed',
                      content:
                        'refusal' in turn && turn.refusal !== undefined
                          ? [{ type: 'refusal', refusal: turn.refusal }]
                          : [{ type: 'output_text', text: turn.text, annotations: [] }],
                    },
                  ]
                : []),
              ...toolCalls.map((call) => ({
                id: `fc_${call.id}`,
                type: 'function_call',
                status: incomplete ? 'incomplete' : 'completed',
                call_id: call.id,
                name: call.function.name,
                arguments: call.function.arguments,
              })),
            ],
            usage: {
              input_tokens: 1000 + index,
              input_tokens_details: { cached_tokens: 600, cache_write_tokens: 100 },
              output_tokens: 40 + index,
              output_tokens_details: {
                reasoning_tokens: 'calls' in turn ? (turn.reasoning ?? 5) : 5,
              },
              total_tokens: 1040 + 2 * index,
            },
          }),
        );
        return;
      }
      response.end(
        JSON.stringify({
          id: `chatcmpl-fake-${index}`,
          object: 'chat.completion',
          model: `${String(bodies[index]?.['model'])}-2026-09-01`,
          choices: [
            {
              index: 0,
              finish_reason: finish,
              message: {
                role: 'assistant',
                content: turn.text === undefined || turn.text === '' ? null : turn.text,
                refusal: 'refusal' in turn ? (turn.refusal ?? null) : null,
                ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls }),
              },
            },
          ],
          usage: {
            prompt_tokens: 1000 + index,
            completion_tokens: 40 + index,
            total_tokens: 1040 + 2 * index,
            prompt_tokens_details: { cached_tokens: 600 },
            completion_tokens_details: {
              reasoning_tokens: 'calls' in turn ? (turn.reasoning ?? 5) : 5,
            },
          },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => {
    http.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (http.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    bodies,
    headers,
    close: () =>
      new Promise<void>((resolve) => {
        for (const timer of timers) clearTimeout(timer);
        http.close(() => resolve());
        http.closeAllConnections();
      }),
  };
}
