// The OpenAI-compatible provider against a local stand-in for the chat completions API.
// No request leaves this machine and no real key is used.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { policyFactory } from './cli.ts';
import { loadEnvFile, parseEnvFile } from './env.ts';
import { runEpisode } from './episode.ts';
import { llmPolicy } from './llm.ts';
import {
  PICTURES_PREAMBLE,
  envNameOf,
  openaiMessages,
  openaiPricesFor,
  openaiProvider,
  openaiResponsesInput,
  openaiUsage,
  retryAfterMs,
} from './openai.ts';
import type { HistoryEntry, ToolSpec } from './provider.ts';
import { ProviderError } from './provider.ts';
import { resultsTable } from './results.ts';
import { scriptedProvider } from './scripted-provider.ts';
import { DOT, useHarness } from './test-util.ts';

const harness = useHarness();

const KEY = 'not-a-real-key-0123456789';

const TOOLS: ToolSpec[] = [
  {
    name: 'get_state',
    description: 'The scene now.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const BOWL = {
  item_id: 'bowl_01',
  frame: 'lower_rack',
  position_mm: [420, 270, 200],
  orientation: { preset: 'inverted' },
};

const BEGIN = { system: 's', tools: TOOLS, history: [{ role: 'user' as const, text: 'begin' }] };

describe('openaiMessages', () => {
  const native = {
    role: 'assistant',
    content: null,
    tool_calls: [
      { id: 'call_1', type: 'function', function: { name: 'render', arguments: '{}' } },
      { id: 'call_2', type: 'function', function: { name: 'place', arguments: '{}' } },
    ],
  };
  const history: HistoryEntry[] = [
    { role: 'user', text: 'begin' },
    {
      role: 'assistant',
      text: '',
      tool_calls: [
        { id: 'call_1', name: 'render', arguments: {} },
        { id: 'call_2', name: 'place', arguments: {} },
      ],
      native,
    },
    {
      role: 'tool',
      results: [
        {
          call_id: 'call_1',
          name: 'render',
          text: '{"accepted":true}',
          images: [
            { removed: true, note: '[picture removed]' },
            { media_type: 'image/png', data_base64: DOT },
          ],
          is_error: false,
        },
        {
          call_id: 'call_2',
          name: 'place',
          text: '{"accepted":false}',
          images: [],
          is_error: true,
        },
      ],
    },
  ];

  it('puts text in the tool messages and the pictures, labelled with their call, in the next user message', () => {
    const messages = openaiMessages('the rules', history);
    expect(messages.map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
      'tool',
      'user',
    ]);
    expect(messages[0]).toEqual({ role: 'system', content: 'the rules' });
    // The model's own turn, as the API gave it.
    expect(messages[2]).toEqual(native);
    // Both tool messages come before the pictures: the API wants every call answered first.
    expect(messages[3]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content:
        '{"accepted":true}\n[picture removed]\n[the picture of this result is in the next user message, under "render, call call_1"]',
    });
    expect(messages[4]).toEqual({
      role: 'tool',
      tool_call_id: 'call_2',
      content: '{"accepted":false}',
    });
    expect(messages[5]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: PICTURES_PREAMBLE },
        { type: 'text', text: 'render, call call_1:' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${DOT}` } },
      ],
    });
    // Pure: the same history, the same bytes.
    expect(JSON.stringify(openaiMessages('the rules', history))).toBe(JSON.stringify(messages));
  });

  it('numbers the pictures of a result that has several, and sends no picture message for none', () => {
    const several: HistoryEntry[] = [
      {
        role: 'tool',
        results: [
          {
            call_id: 'call_9',
            name: 'get_item',
            text: '{}',
            images: [
              { media_type: 'image/png', data_base64: DOT },
              { media_type: 'image/png', data_base64: DOT },
            ],
            is_error: false,
          },
        ],
      },
    ];
    const messages = openaiMessages('s', several);
    expect((messages[1] as { content: string }).content).toContain(
      'the 2 pictures of this result are in the next user message',
    );
    const parts = (messages[2] as unknown as { content: { type: string; text?: string }[] })
      .content;
    expect(parts.filter((part) => part.type === 'text').map((part) => part.text)).toEqual([
      PICTURES_PREAMBLE,
      'get_item, call call_9, picture 1 of 2:',
      'get_item, call call_9, picture 2 of 2:',
    ]);
    const gone: HistoryEntry[] = [
      {
        role: 'tool',
        results: [
          {
            call_id: 'call_9',
            name: 'render',
            text: '{}',
            images: [{ removed: true, note: '[removed]' }],
            is_error: false,
          },
        ],
      },
    ];
    expect(openaiMessages('s', gone).map((message) => message.role)).toEqual(['system', 'tool']);
  });
});

describe('openaiUsage and retryAfterMs', () => {
  it('keeps cached input apart from fresh input and reasoning beside the output', () => {
    expect(
      openaiUsage({
        prompt_tokens: 1000,
        completion_tokens: 300,
        prompt_tokens_details: { cached_tokens: 640 },
        completion_tokens_details: { reasoning_tokens: 250 },
      }),
    ).toEqual({
      input_tokens: 360,
      output_tokens: 300,
      cache_read_input_tokens: 640,
      cache_creation_input_tokens: 0,
      reasoning_output_tokens: 250,
    });
    // A reply that says nothing about caches or reasoning.
    expect(openaiUsage({ prompt_tokens: 10, completion_tokens: 2 })).toEqual({
      input_tokens: 10,
      output_tokens: 2,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    });
    expect(openaiUsage(undefined).input_tokens).toBe(0);
    // The Responses API's names for the same, with what was written to the cache.
    expect(
      openaiUsage({
        input_tokens: 1000,
        output_tokens: 300,
        input_tokens_details: { cached_tokens: 640, cache_write_tokens: 200 },
        output_tokens_details: { reasoning_tokens: 250 },
      }),
    ).toEqual({
      input_tokens: 160,
      output_tokens: 300,
      cache_read_input_tokens: 640,
      cache_creation_input_tokens: 200,
      reasoning_output_tokens: 250,
    });
  });

  it('reads the wait the server asks for in seconds, milliseconds or as a date', () => {
    expect(retryAfterMs(new Headers({ 'retry-after': '7' }))).toBe(7000);
    expect(retryAfterMs(new Headers({ 'retry-after-ms': '250', 'retry-after': '7' }))).toBe(250);
    const now = Date.parse('2026-10-11T10:00:00Z');
    expect(retryAfterMs(new Headers({ 'retry-after': 'Sun, 11 Oct 2026 10:00:30 GMT' }), now)).toBe(
      30_000,
    );
    expect(retryAfterMs(new Headers({}))).toBeNull();
    expect(retryAfterMs(new Headers({ 'retry-after': 'soon' }))).toBeNull();
  });
});

describe('openaiResponsesInput', () => {
  it('returns the model its own items and carries the pictures inside the result they belong to', () => {
    const native = [
      { type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'enc' },
      { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'render', arguments: '{}' },
      { type: 'function_call', id: 'fc_2', call_id: 'call_2', name: 'place', arguments: '{}' },
    ];
    const history: HistoryEntry[] = [
      { role: 'user', text: 'begin' },
      { role: 'assistant', text: '', tool_calls: [], native },
      {
        role: 'tool',
        results: [
          {
            call_id: 'call_1',
            name: 'render',
            text: '{"accepted":true}',
            images: [
              { removed: true, note: '[picture removed]' },
              { media_type: 'image/png', data_base64: DOT },
            ],
            is_error: false,
          },
          {
            call_id: 'call_2',
            name: 'place',
            text: '{"accepted":false}',
            images: [],
            is_error: true,
          },
        ],
      },
    ];
    const items = openaiResponsesInput(history);
    expect(items).toEqual([
      { role: 'user', content: 'begin' },
      ...native,
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: [
          { type: 'input_text', text: '{"accepted":true}\n[picture removed]' },
          { type: 'input_image', image_url: `data:image/png;base64,${DOT}` },
        ],
      },
      // No picture: plain text.
      { type: 'function_call_output', call_id: 'call_2', output: '{"accepted":false}' },
    ]);
    expect(JSON.stringify(openaiResponsesInput(history))).toBe(JSON.stringify(items));
  });
});

describe('a message of the harness with a picture (the note of a fold carries the sheet of items)', () => {
  const history: HistoryEntry[] = [
    {
      role: 'user',
      text: 'begin\n\n[note]',
      images: [{ media_type: 'image/png', data_base64: 'SHEET' }],
    },
  ];

  it('travels in the user message on both APIs', () => {
    expect(openaiResponsesInput(history)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'begin\n\n[note]' },
          { type: 'input_image', image_url: 'data:image/png;base64,SHEET' },
        ],
      },
    ]);
    expect(openaiMessages('rules', history)[1]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'begin\n\n[note]' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,SHEET' } },
      ],
    });
    // Without a picture a message is plain text, as it always was.
    expect(openaiResponsesInput([{ role: 'user', text: 'begin' }])).toEqual([
      { role: 'user', content: 'begin' },
    ]);
    expect(openaiMessages('rules', [{ role: 'user', text: 'begin' }])[1]).toEqual({
      role: 'user',
      content: 'begin',
    });
  });
});

describe('openaiProvider through the Responses API (the default)', () => {
  it('asks for a turn statelessly, with the tools as functions, and reads items, stop and tokens', async () => {
    const api = await harness.fakeOpenAi([
      { calls: [{ name: 'get_state', input: {} }], text: 'Looking.', reasoning: 12 },
    ]);
    const provider = openaiProvider({
      model: 'gpt-6.1-sol',
      baseURL: api.url,
      apiKey: KEY,
      authHeader: 'api-key',
      reasoningEffort: 'high',
      env: {},
    });
    const turn = await provider.complete({ ...BEGIN, system: 'the rules' });
    expect(api.bodies[0]).toEqual({
      model: 'gpt-6.1-sol',
      instructions: 'the rules',
      input: [{ role: 'user', content: 'begin' }],
      tools: [
        {
          type: 'function',
          name: 'get_state',
          description: 'The scene now.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          strict: false,
        },
      ],
      max_output_tokens: 64000,
      reasoning: { effort: 'high' },
      store: false,
      include: ['reasoning.encrypted_content'],
    });
    expect(api.headers[0]?.['api-key']).toBe(KEY);
    expect(turn).toMatchObject({
      text: 'Looking.',
      stop: 'tool_use',
      model: 'gpt-6.1-sol-2026-09-01',
      tool_calls: [{ id: 'call_fake_0_0', name: 'get_state', arguments: {} }],
      // 1000 tokens of input: 600 read from the cache, 100 written to it, 300 neither.
      usage: {
        input_tokens: 300,
        cache_read_input_tokens: 600,
        cache_creation_input_tokens: 100,
        output_tokens: 40,
        reasoning_output_tokens: 12,
      },
    });
    // The items as they came, the reasoning with its encrypted content first.
    expect((turn.native as { type: string }[]).map((item) => item.type)).toEqual([
      'reasoning',
      'message',
      'function_call',
    ]);
    expect((turn.native as { encrypted_content?: string }[])[0]?.encrypted_content).toBe('enc_0');
    expect(provider.settings()).toMatchObject({
      api: 'responses',
      max_output_tokens: 64000,
      reasoning_effort: 'high',
      reasoning_effort_reported: 'medium',
      store: false,
      pictures: 'in the function output of the call that returned them',
      tokens: {
        input_fresh: 300,
        input_cached: 600,
        input_cache_written: 100,
        output: 40,
        output_reasoning: 12,
      },
      cost_usd: null,
    });
  });

  it('reports a cut-off turn as max_tokens, a refusal and a filtered reply for what they are', async () => {
    const api = await harness.fakeOpenAi([
      {
        text: '',
        finish: 'length',
        partialCall: { name: 'place', arguments: '{"item_id":"bowl_0' },
      },
      { text: '', refusal: 'I cannot help with that.' },
      { text: '', finish: 'content_filter' },
      { text: 'Done.' },
    ]);
    const provider = openaiProvider({ model: 'm', baseURL: api.url, apiKey: KEY, env: {} });
    expect(await provider.complete(BEGIN)).toMatchObject({ stop: 'max_tokens', tool_calls: [] });
    expect(await provider.complete(BEGIN)).toMatchObject({
      stop: 'refusal',
      stop_detail: 'I cannot help with that.',
    });
    expect(await provider.complete(BEGIN)).toMatchObject({
      stop: 'refusal',
      stop_detail: 'content_filter',
    });
    expect(await provider.complete(BEGIN)).toMatchObject({ stop: 'end_turn', text: 'Done.' });
    // No effort was named: none is sent, and the record says what the API reported.
    expect(api.bodies[0]).not.toHaveProperty('reasoning');
    expect(provider.settings()).toMatchObject({
      reasoning_effort: 'model default (not sent)',
      reasoning_effort_reported: 'medium',
    });
  });

  it('retries a 429 after the wait it names', async () => {
    const api = await harness.fakeOpenAi([
      { status: 429, error: 'slow down', headers: { 'retry-after-ms': '120' } },
      { text: 'Here.' },
    ]);
    const provider = openaiProvider({
      model: 'm',
      baseURL: api.url,
      apiKey: KEY,
      retryBaseMs: 5,
      env: {},
    });
    const started = performance.now();
    expect(await provider.complete(BEGIN)).toMatchObject({ text: 'Here.' });
    expect(performance.now() - started).toBeGreaterThanOrEqual(110);
    expect(provider.settings()).toMatchObject({ requests: 2, retries: 1 });
  });

  it('plays an episode: tool calls out, results back with their pictures, a cut-off turn dropped', async () => {
    const game = await harness.game();
    const api = await harness.fakeOpenAi([
      { calls: [{ name: 'render', input: { view: 'iso_lower', options: { size_px: 128 } } }] },
      { calls: [{ name: 'place', input: BOWL }], text: 'The bowl goes in upside down.' },
      {
        text: '',
        finish: 'length',
        partialCall: { name: 'place', arguments: '{"item_id":"mug_01","fra' },
      },
      { calls: [{ name: 'start_cycle', input: {} }] },
    ]);
    const { record, dir } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({
        provider: openaiProvider({ model: 'gpt-6.1-sol', baseURL: api.url, apiKey: KEY, env: {} }),
      }),
      outDir: harness.outDir(),
    });
    expect(record.policy?.name).toBe('openai:gpt-6.1-sol');
    expect(record.agent).toMatchObject({ stopped: 'start_cycle', turns: 4 });
    expect(record.agent?.tool_calls.map((call) => call.name)).toEqual([
      'render',
      'place',
      'start_cycle',
    ]);
    expect(record.agent?.usage).toEqual({
      input_tokens: 300 + 301 + 302 + 303,
      output_tokens: 40 + 41 + 42 + 43,
      cache_read_input_tokens: 2400,
      cache_creation_input_tokens: 400,
      reasoning_output_tokens: 20,
    });
    expect(record.replay).toMatchObject({ verified: true, method: 'replay' });

    const tools = api.bodies[0]?.['tools'] as { type: string; name: string }[];
    expect(tools).toHaveLength(13);
    expect(
      api.bodies.every((body) => JSON.stringify(body['tools']) === JSON.stringify(tools)),
    ).toBe(true);
    expect(
      api.bodies.every((body) => body['instructions'] === api.bodies[0]?.['instructions']),
    ).toBe(true);
    // The second request: the first turn's items as they came, then the result with its picture.
    const second = api.bodies[1]?.['input'] as { type?: string; role?: string; output?: unknown }[];
    expect(second.map((item) => item.type ?? item.role)).toEqual([
      'user',
      'reasoning',
      'function_call',
      'function_call_output',
    ]);
    expect((second[3]?.output as { type: string }[]).map((part) => part.type)).toEqual([
      'input_text',
      'input_image',
    ]);
    // From one request to the next the conversation only grows at its end.
    const third = api.bodies[2]?.['input'] as unknown[];
    expect(JSON.stringify(third.slice(0, second.length))).toBe(JSON.stringify(second));
    // After the cut-off turn: nothing of it, and the fixed sentence about it.
    const fourth = api.bodies[3]?.['input'] as { role?: string; content?: unknown }[];
    expect(String(fourth[fourth.length - 1]?.content)).toMatch(/cut off at the output limit/);
    expect(JSON.stringify(fourth)).not.toContain('mug_01","fra');
    for (const file of ['record.json', 'transcript.json']) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toContain(KEY);
      expect(text, file).not.toContain(api.url);
    }
  });
});

describe('openaiProvider through chat completions', () => {
  it('asks for a turn with the tools as functions and reads the answer and its tokens', async () => {
    const api = await harness.fakeOpenAi([
      { calls: [{ name: 'get_state', input: {} }], text: 'Looking.', reasoning: 12 },
    ]);
    const provider = openaiProvider({
      api: 'chat',
      model: 'gpt-6.1-sol',
      baseURL: `${api.url}/`,
      apiKey: KEY,
      authHeader: 'api-key',
      reasoningEffort: 'medium',
      env: {},
    });
    const turn = await provider.complete({ ...BEGIN, system: 'the rules' });
    const body = api.bodies[0];
    if (body === undefined) throw new Error('nothing was sent');
    expect(body).toEqual({
      model: 'gpt-6.1-sol',
      messages: [
        { role: 'system', content: 'the rules' },
        { role: 'user', content: 'begin' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_state',
            description: 'The scene now.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
          },
        },
      ],
      max_completion_tokens: 64000,
      reasoning_effort: 'medium',
    });
    // The key travels in the header Azure reads, and in no other.
    expect(api.headers[0]?.['api-key']).toBe(KEY);
    expect(api.headers[0]?.['authorization']).toBeUndefined();
    expect(turn).toMatchObject({
      text: 'Looking.',
      stop: 'tool_use',
      model: 'gpt-6.1-sol-2026-09-01',
      tool_calls: [{ id: 'call_fake_0_0', name: 'get_state', arguments: {} }],
      usage: {
        input_tokens: 400,
        cache_read_input_tokens: 600,
        cache_creation_input_tokens: 0,
        output_tokens: 40,
        reasoning_output_tokens: 12,
      },
    });
    expect(turn.native).toEqual({
      role: 'assistant',
      content: 'Looking.',
      tool_calls: [
        { id: 'call_fake_0_0', type: 'function', function: { name: 'get_state', arguments: '{}' } },
      ],
    });
    // The settings say what was asked and what it took; no price was given, so no cost.
    const settings = provider.settings() as { [key: string]: unknown };
    expect(settings).toMatchObject({
      api: 'chat.completions',
      endpoint: 'local',
      auth_header: 'api-key',
      reasoning_effort: 'medium',
      requests: 1,
      retries: 0,
      tokens: {
        input_fresh: 400,
        input_cached: 600,
        input_cache_written: 0,
        output: 40,
        output_reasoning: 12,
      },
      prices_usd_per_million_tokens: null,
      cost_usd: null,
      cost_note: 'no prices were supplied, so no cost is recorded',
    });
    expect(JSON.stringify(settings)).not.toContain(KEY);
    expect(JSON.stringify(settings)).not.toContain(api.url);
  });

  it('takes its address, key, header, effort and prices from the environment', async () => {
    const api = await harness.fakeOpenAi([{ text: 'Done.' }]);
    const provider = openaiProvider({
      api: 'chat',
      model: 'some-model',
      env: {
        SPOTLESS_OPENAI_BASE_URL: api.url,
        SPOTLESS_OPENAI_API: 'chat',
        SPOTLESS_OPENAI_API_KEY: KEY,
        SPOTLESS_OPENAI_REASONING_EFFORT: 'low',
        SPOTLESS_OPENAI_PRICE_INPUT: '2',
        SPOTLESS_OPENAI_PRICE_CACHED_INPUT: '0.5',
        SPOTLESS_OPENAI_PRICE_OUTPUT: '10',
      },
    });
    const turn = await provider.complete(BEGIN);
    expect(turn).toMatchObject({ stop: 'end_turn', text: 'Done.', tool_calls: [] });
    // Not Azure: the key is a bearer token.
    expect(api.headers[0]?.['authorization']).toBe(`Bearer ${KEY}`);
    expect(api.headers[0]?.['api-key']).toBeUndefined();
    expect(api.bodies[0]?.['reasoning_effort']).toBe('low');
    // 400 fresh at 2, 600 cached at 0.5, 40 out at 10, per million.
    expect(provider.settings()).toMatchObject({
      prices_usd_per_million_tokens: { input: 2, cached_input: 0.5, output: 10 },
      cost_usd: (400 * 2 + 600 * 0.5 + 40 * 10) / 1e6,
    });
    expect(provider.settings()).not.toHaveProperty('cost_note');

    // Nothing set: the effort is left to the model and the record says so.
    const plain = openaiProvider({
      api: 'chat',
      model: 'm',
      baseURL: api.url,
      apiKey: KEY,
      env: {},
    });
    await plain.complete(BEGIN);
    expect(api.bodies[1]).not.toHaveProperty('reasoning_effort');
    for (const absent of ['tool_choice', 'temperature', 'top_p', 'stream']) {
      expect(api.bodies[1]).not.toHaveProperty(absent);
    }
    expect(plain.settings()).toMatchObject({ reasoning_effort: 'model default (not sent)' });
  });

  it('prices each deployment as what it is when the environment gives it prices of its own', () => {
    const env = {
      SPOTLESS_OPENAI_PRICE_INPUT: '2',
      SPOTLESS_OPENAI_PRICE_CACHED_INPUT: '0.5',
      SPOTLESS_OPENAI_PRICE_OUTPUT: '10',
      SPOTLESS_OPENAI_PRICE_GPT_6_ASTRA_INPUT: '15',
      SPOTLESS_OPENAI_PRICE_GPT_6_ASTRA_OUTPUT: '60',
    };
    expect(envNameOf('gpt-6.1-sol')).toBe('GPT_6_1_SOL');
    expect(envNameOf('Some Model/v2')).toBe('SOME_MODEL_V2');
    // Its own prices where it has them (cached input then costs what input costs)...
    expect(openaiPricesFor('gpt-6-astra', env)).toEqual({ input: 15, output: 60 });
    // ...and the general ones where it has none.
    expect(openaiPricesFor('gpt-6.1-sol', env)).toEqual({ input: 2, cachedInput: 0.5, output: 10 });
    // Half a price is no price.
    expect(openaiPricesFor('m', { SPOTLESS_OPENAI_PRICE_INPUT: '2' })).toBeNull();
    expect(openaiPricesFor('m', {})).toBeNull();
    const provider = openaiProvider({ model: 'gpt-6-astra', baseURL: 'http://127.0.0.1:1', env });
    expect(provider.settings()).toMatchObject({
      prices_usd_per_million_tokens: { input: 15, cached_input: 15, output: 60 },
    });
  });

  it('says what is missing before it asks anything', async () => {
    const noAddress = await openaiProvider({ api: 'chat', model: 'm', apiKey: KEY, env: {} })
      .complete(BEGIN)
      .catch((error: unknown) => error);
    expect(noAddress).toBeInstanceOf(ProviderError);
    expect((noAddress as ProviderError).message).toContain('SPOTLESS_OPENAI_BASE_URL');
    const noKey = await openaiProvider({
      api: 'chat',
      model: 'm',
      baseURL: 'http://127.0.0.1:1',
      apiKeyEnv: 'MY_KEY',
      env: {},
    })
      .complete(BEGIN)
      .catch((error: unknown) => error);
    expect(noKey).toMatchObject({ kind: 'auth', message: 'no API key (set MY_KEY)' });
  });

  it('reports a cut-off turn as max_tokens and keeps nothing of its half-written call', async () => {
    const api = await harness.fakeOpenAi([
      {
        text: 'Thinking it through',
        finish: 'length',
        partialCall: { name: 'place', arguments: '{"item_id":"bowl_0' },
      },
    ]);
    const turn = await openaiProvider({
      api: 'chat',
      model: 'm',
      baseURL: api.url,
      apiKey: KEY,
      env: {},
    }).complete(BEGIN);
    expect(turn).toMatchObject({ stop: 'max_tokens', tool_calls: [] });
    // The tokens of a cut-off turn were used all the same.
    expect(turn.usage.output_tokens).toBe(40);
  });

  it('reports a refusal, a filtered reply and arguments that are not JSON for what they are', async () => {
    const api = await harness.fakeOpenAi([
      { text: '', refusal: 'I cannot help with that.' },
      { text: '', finish: 'content_filter' },
      { text: '', finish: 'tool_calls', partialCall: { name: 'get_state', arguments: '{oops' } },
    ]);
    const provider = openaiProvider({
      api: 'chat',
      model: 'm',
      baseURL: api.url,
      apiKey: KEY,
      env: {},
    });
    expect(await provider.complete(BEGIN)).toMatchObject({
      stop: 'refusal',
      stop_detail: 'I cannot help with that.',
    });
    expect(await provider.complete(BEGIN)).toMatchObject({
      stop: 'refusal',
      stop_detail: 'content_filter',
    });
    // The call is passed on with its text: the tool answers that it cannot read it.
    expect(await provider.complete(BEGIN)).toMatchObject({
      stop: 'tool_use',
      tool_calls: [{ name: 'get_state', arguments: '{oops' }],
    });
  });

  it('waits as long as a 429 asks and tries again; so with a 5xx', async () => {
    const api = await harness.fakeOpenAi([
      { status: 429, error: 'slow down', headers: { 'retry-after-ms': '150' } },
      { status: 503, error: 'busy' },
      { text: 'Here.' },
    ]);
    const provider = openaiProvider({
      api: 'chat',
      model: 'm',
      baseURL: api.url,
      apiKey: KEY,
      retryBaseMs: 5,
      env: {},
    });
    const started = performance.now();
    const turn = await provider.complete(BEGIN);
    const took = performance.now() - started;
    expect(turn).toMatchObject({ stop: 'end_turn', text: 'Here.' });
    expect(api.bodies).toHaveLength(3);
    // The first wait was the server's 150 ms, not the back-off's 5.
    expect(took).toBeGreaterThanOrEqual(140);
    // The same request each time.
    expect(JSON.stringify(api.bodies[2])).toBe(JSON.stringify(api.bodies[0]));
    expect(provider.settings()).toMatchObject({ requests: 3, retries: 2 });
  });

  it('gives up after its retries and names the failure; a bad request is not retried', async () => {
    for (const [status, kind, sent] of [
      [401, 'auth', 1],
      [400, 'bad_request', 1],
      [429, 'rate_limit', 3],
      [500, 'api', 3],
    ] as const) {
      const api = await harness.fakeOpenAi([{ status, error: `failure ${status} with ${KEY}` }]);
      const error = await openaiProvider({
        api: 'chat',
        model: 'm',
        baseURL: api.url,
        apiKey: KEY,
        maxRetries: 2,
        retryBaseMs: 1,
        env: {},
      })
        .complete(BEGIN)
        .then(
          () => null,
          (thrown: unknown) => thrown,
        );
      expect(error, String(status)).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind, String(status)).toBe(kind);
      expect((error as ProviderError).status, String(status)).toBe(status);
      expect(api.bodies, String(status)).toHaveLength(sent);
      // Even an API that echoes the key does not get it into a message of the harness.
      expect((error as ProviderError).message).not.toContain(KEY);
      expect((error as ProviderError).message).toContain(`failure ${status}`);
    }
  });

  it('gives a request a time limit, and tries again when it passes', async () => {
    const api = await harness.fakeOpenAi([{ hangMs: 2000 }, { text: 'Late.' }]);
    const provider = openaiProvider({
      api: 'chat',
      model: 'm',
      baseURL: api.url,
      apiKey: KEY,
      timeoutMs: 100,
      retryBaseMs: 1,
      env: {},
    });
    expect(await provider.complete(BEGIN)).toMatchObject({ text: 'Late.' });
    expect(api.bodies).toHaveLength(2);

    const never = await harness.fakeOpenAi([{ hangMs: 2000 }]);
    const error = await openaiProvider({
      api: 'chat',
      model: 'm',
      baseURL: never.url,
      apiKey: KEY,
      timeoutMs: 50,
      maxRetries: 1,
      retryBaseMs: 1,
      env: {},
    })
      .complete(BEGIN)
      .catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ kind: 'timeout' });
    expect(never.bodies).toHaveLength(2);
  });

  it('plays an episode: tool calls out, tool results back, the picture in a user message', async () => {
    const game = await harness.game();
    const api = await harness.fakeOpenAi([
      { calls: [{ name: 'render', input: { view: 'iso_lower', options: { size_px: 128 } } }] },
      { calls: [{ name: 'place', input: BOWL }], text: 'The bowl goes in upside down.' },
      // A turn cut off in the middle of a call: dropped, and the model is asked again.
      {
        text: '',
        finish: 'length',
        partialCall: { name: 'place', arguments: '{"item_id":"mug_01","fra' },
      },
      { calls: [{ name: 'start_cycle', input: {} }] },
    ]);
    const outDir = harness.outDir();
    const { record, dir } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({
        provider: openaiProvider({
          api: 'chat',
          model: 'gpt-6.1-sol',
          baseURL: api.url,
          apiKey: KEY,
          env: {},
        }),
      }),
      outDir,
    });
    expect(record.policy?.name).toBe('openai:gpt-6.1-sol');
    expect(record.player).toMatchObject({ kind: 'agent', name: 'openai:gpt-6.1-sol' });
    expect(record.agent).toMatchObject({
      stopped: 'start_cycle',
      turns: 4,
      cycle_started_by_harness: false,
    });
    expect(record.agent?.tool_calls.map((call) => call.name)).toEqual([
      'render',
      'place',
      'start_cycle',
    ]);
    // Tokens as the API reported them, summed over the four turns (the cut-off one included).
    expect(record.agent?.usage).toEqual({
      input_tokens: 400 + 401 + 402 + 403,
      output_tokens: 40 + 41 + 42 + 43,
      cache_read_input_tokens: 2400,
      cache_creation_input_tokens: 0,
      reasoning_output_tokens: 20,
    });
    expect(record.score?.items_loaded).toBe(1);
    expect(record.replay).toMatchObject({ verified: true, method: 'replay' });

    // The tools offered are the MCP server's thirteen with their schemas, the same every time.
    const tools = api.bodies[0]?.['tools'] as {
      type: string;
      function: { name: string; parameters: { type: string } };
    }[];
    expect(tools).toHaveLength(13);
    expect(
      tools.every((tool) => tool.type === 'function' && tool.function.parameters.type === 'object'),
    ).toBe(true);
    expect(
      api.bodies.every((body) => JSON.stringify(body['tools']) === JSON.stringify(tools)),
    ).toBe(true);

    // The second request: the first turn as it came, its result as text, its picture after it.
    const second = api.bodies[1]?.['messages'] as { role: string; content: unknown }[];
    expect(second.map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
      'user',
    ]);
    expect(second[3]).toMatchObject({ role: 'tool', tool_call_id: 'call_fake_0_0' });
    expect(String(second[3]?.content)).toContain('under "render, call call_fake_0_0"');
    expect((second[4]?.content as { type: string }[]).map((part) => part.type)).toEqual([
      'text',
      'text',
      'image_url',
    ]);
    // From one request to the next the conversation only grows at its end.
    const third = api.bodies[2]?.['messages'] as unknown[];
    expect(JSON.stringify(third.slice(0, second.length))).toBe(JSON.stringify(second));
    // After the cut-off turn: nothing of it, and the fixed sentence about it.
    const fourth = api.bodies[3]?.['messages'] as { role: string; content: unknown }[];
    expect(fourth.map((message) => message.role).slice(-3)).toEqual(['assistant', 'tool', 'user']);
    expect(String(fourth[fourth.length - 1]?.content)).toMatch(/cut off at the output limit/);
    expect(JSON.stringify(fourth)).not.toContain('mug_01","fra');

    // Neither the record nor the transcript holds the key or the address of the API.
    for (const file of ['record.json', 'transcript.json']) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toContain(KEY);
      expect(text, file).not.toContain(api.url);
    }
    expect(record.policy?.settings).toMatchObject({
      request: { api: 'chat.completions', requests: 4, cost_usd: null },
    });
  });
});

describe('the limit on input tokens', () => {
  it('ends the episode with its load before the next request would pass it', async () => {
    const game = await harness.game();
    const api = await harness.fakeOpenAi([
      { calls: [{ name: 'place', input: BOWL }] },
      { calls: [{ name: 'get_state', input: {} }] },
    ]);
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({
        provider: openaiProvider({ model: 'm', baseURL: api.url, apiKey: KEY, env: {} }),
        // Requests of 1000, 1001, 1002 tokens: the fourth would pass 3500.
        maxInputTokens: 3500,
      }),
      outDir: harness.outDir(),
    });
    expect(api.bodies).toHaveLength(3);
    expect(record.agent?.stopped).toMatch(/^token_budget: 3003 input tokens used of 3500/);
    expect(record.agent?.cycle_started_by_harness).toBe(true);
    expect(record.score?.items_loaded).toBe(1);
    expect(record.policy?.settings).toMatchObject({ max_input_tokens: 3500 });
    expect(resultsTable([record]).rows[0]).toMatchObject({ limit_ended: 1 });
  });

  it('is no part of the standard harness unless asked for', () => {
    const policy = llmPolicy({ provider: scriptedProvider([{ say: 'x' }]) });
    expect(policy.settings()).not.toHaveProperty('max_input_tokens');
  });
});

describe('the command line and the environment file', () => {
  it('knows openai:<deployment> as a policy', () => {
    const factory = policyFactory('openai:gpt-6.1-sol', { effort: 'low', maxInputTokens: 10 });
    if (typeof factory === 'string') throw new Error(factory);
    const policy = factory();
    expect(policy.name).toBe('openai:gpt-6.1-sol');
    expect(policy.settings()).toMatchObject({
      provider: 'openai',
      model: 'gpt-6.1-sol',
      max_input_tokens: 10,
      request: { reasoning_effort: 'low' },
    });
    expect(policyFactory('openai:')).toMatch(/a model or deployment name is needed/);
    // An effort is checked against the provider it is for.
    expect(policyFactory('anthropic:claude-opus-5-5', { effort: 'minimal' })).toMatch(
      /is not an effort/,
    );
    expect(typeof policyFactory('openai:m', { effort: 'minimal' })).toBe('function');
  });

  it('reads NAME=value lines and sets only what the environment lacks, saying names alone', () => {
    expect(
      parseEnvFile(
        [
          '# a comment',
          'A=1',
          'export B = "two words"',
          "C='x#y'",
          'D=v # trailing',
          'E=',
          '?',
        ].join('\n'),
      ),
    ).toEqual({ A: '1', B: 'two words', C: 'x#y', D: 'v', E: '' });
    const dir = mkdtempSync(join(tmpdir(), 'spotless-env-'));
    try {
      const file = join(dir, '.env');
      writeFileSync(file, 'SPOTLESS_OPENAI_API_KEY=from-file\nSPOTLESS_OPENAI_BASE_URL=http://x\n');
      const env: { [name: string]: string | undefined } = {
        SPOTLESS_OPENAI_API_KEY: 'from-environment',
      };
      expect(loadEnvFile(file, env)).toEqual(['SPOTLESS_OPENAI_BASE_URL']);
      expect(env).toEqual({
        SPOTLESS_OPENAI_API_KEY: 'from-environment',
        SPOTLESS_OPENAI_BASE_URL: 'http://x',
      });
      expect(loadEnvFile(join(dir, 'absent'), env)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
