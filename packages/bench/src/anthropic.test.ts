// The Anthropic provider through the real SDK against a local stand-in for the Messages API.
// No request leaves this machine and no real key is used.
import { describe, expect, it } from 'vitest';
import { anthropicMessages, anthropicProvider } from './anthropic.ts';
import { runEpisode } from './episode.ts';
import { llmPolicy } from './llm.ts';
import type { HistoryEntry, ToolSpec } from './provider.ts';
import { ProviderError } from './provider.ts';
import { DOT, useHarness } from './test-util.ts';

const harness = useHarness();

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

describe('anthropicMessages', () => {
  it('returns the model its own turns verbatim and builds tool results the same way every time', () => {
    const native = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 'toolu_1', name: 'render', input: { view: 'top_lower' } },
    ];
    const history: HistoryEntry[] = [
      { role: 'user', text: 'begin' },
      {
        role: 'assistant',
        text: '',
        tool_calls: [{ id: 'toolu_1', name: 'render', arguments: {} }],
        native,
      },
      {
        role: 'tool',
        results: [
          {
            call_id: 'toolu_1',
            name: 'render',
            text: '{"accepted":true}',
            images: [
              { removed: true, note: '[picture removed]' },
              { media_type: 'image/png', data_base64: DOT },
            ],
            is_error: false,
          },
          {
            call_id: 'toolu_2',
            name: 'place',
            text: '{"accepted":false}',
            images: [],
            is_error: true,
          },
        ],
      },
    ];
    const messages = anthropicMessages(history);
    expect(messages[0]).toEqual({ role: 'user', content: 'begin' });
    // The very blocks the API sent, signature and all.
    expect(messages[1]).toEqual({ role: 'assistant', content: native });
    expect(messages[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: [
            { type: 'text', text: '{"accepted":true}' },
            { type: 'text', text: '[picture removed]' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: DOT } },
          ],
        },
        {
          type: 'tool_result',
          tool_use_id: 'toolu_2',
          is_error: true,
          content: [{ type: 'text', text: '{"accepted":false}' }],
        },
      ],
    });
    expect(JSON.stringify(anthropicMessages(history))).toBe(JSON.stringify(messages));
  });
});

describe('a message of the harness with a picture (the note of a fold carries the sheet of items)', () => {
  it('travels as an image block after the text', () => {
    expect(
      anthropicMessages([
        {
          role: 'user',
          text: 'begin\n\n[note]',
          images: [{ media_type: 'image/png', data_base64: 'SHEET' }],
        },
        { role: 'user', text: 'carry on' },
      ]),
    ).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'begin\n\n[note]' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'SHEET' } },
        ],
      },
      { role: 'user', content: 'carry on' },
    ]);
  });
});

describe('anthropicProvider', () => {
  it('asks for a turn with the tools, adaptive thinking and the cache mark, and reads the answer', async () => {
    const api = await harness.fakeApi([
      { calls: [{ name: 'get_state', input: {} }], text: 'Looking.' },
    ]);
    const provider = anthropicProvider({
      model: 'claude-opus-5-5',
      baseURL: api.url,
      apiKey: 'not-a-real-key',
      effort: 'high',
      maxRetries: 0,
    });
    const turn = await provider.complete({
      system: 'the rules',
      tools: TOOLS,
      history: [{ role: 'user', text: 'begin' }],
    });
    // What was sent.
    const body = api.bodies[0];
    if (body === undefined) throw new Error('nothing was sent');
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      stream: true,
      system: 'the rules',
      thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
      output_config: { effort: 'high' },
      cache_control: { type: 'ephemeral' },
      tools: [
        { name: 'get_state', description: 'The scene now.', input_schema: { type: 'object' } },
      ],
      messages: [{ role: 'user', content: 'begin' }],
    });
    // Nothing forces a tool, sets sampling, or names a second model.
    for (const absent of ['tool_choice', 'temperature', 'top_p', 'top_k', 'fallbacks']) {
      expect(body).not.toHaveProperty(absent);
    }
    expect(String(api.headers[0]?.['anthropic-beta'])).toContain(
      'thinking-binding-controls-2026-08-01',
    );
    expect(api.headers[0]?.['x-api-key']).toBe('not-a-real-key');
    // What came back.
    expect(turn).toMatchObject({
      text: 'Looking.',
      stop: 'tool_use',
      model: 'claude-opus-5-5',
      tool_calls: [{ id: 'toolu_fake_0_0', name: 'get_state', arguments: {} }],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_read_input_tokens: 50,
        cache_creation_input_tokens: 7,
      },
    });
    // The turn as the API gave it, reasoning block included, for sending back.
    expect(
      (turn.native as { type: string; signature?: string }[]).map((block) => block.type),
    ).toEqual(['thinking', 'text', 'tool_use']);
    expect((turn.native as { signature?: string }[])[0]?.signature).toBe('sig_0');
    expect(provider.settings()).toMatchObject({
      thinking: 'adaptive',
      effort: 'high',
      fallback_model: 'none',
      prefix_mismatch_behavior: 'drop_block',
    });
  });

  it('states the standard effort when none is given, and sends no binding instruction when told so', async () => {
    const api = await harness.fakeApi([{ text: 'Done.' }]);
    const provider = anthropicProvider({
      model: 'claude-haiku-5-5',
      baseURL: api.url,
      apiKey: 'not-a-real-key',
      prefixMismatch: 'off',
      cache: false,
    });
    const turn = await provider.complete({
      system: 's',
      tools: TOOLS,
      history: [{ role: 'user', text: 'begin' }],
    });
    expect(turn).toMatchObject({ stop: 'end_turn', text: 'Done.', tool_calls: [] });
    const body = api.bodies[0] ?? {};
    expect(body['thinking']).toEqual({ type: 'adaptive' });
    // Models differ in their default effort: the harness never leaves it to the model.
    expect(body['output_config']).toEqual({ effort: 'high' });
    expect(body).not.toHaveProperty('cache_control');
    expect(api.headers[0]?.['anthropic-beta']).toBeUndefined();
    expect(provider.settings()).toMatchObject({ effort: 'high', max_tokens: 64000, betas: [] });
  });

  it('reports a refusal as a refusal and API failures as provider errors', async () => {
    const refusing = await harness.fakeApi([{ text: '', stop: 'refusal', category: 'cyber' }]);
    const refused = await anthropicProvider({
      model: 'claude-fable-5-1',
      baseURL: refusing.url,
      apiKey: 'not-a-real-key',
    }).complete({ system: 's', tools: TOOLS, history: [{ role: 'user', text: 'begin' }] });
    expect(refused).toMatchObject({ stop: 'refusal', stop_detail: 'cyber', tool_calls: [] });

    for (const [status, kind] of [
      [401, 'auth'],
      [429, 'rate_limit'],
      [400, 'bad_request'],
      [500, 'api'],
    ] as const) {
      const failing = await harness.fakeApi([{ status, error: `failure ${status}` }]);
      const provider = anthropicProvider({
        model: 'claude-opus-5-5',
        baseURL: failing.url,
        apiKey: 'not-a-real-key',
        maxRetries: 0,
      });
      const error = await provider
        .complete({ system: 's', tools: TOOLS, history: [{ role: 'user', text: 'begin' }] })
        .then(
          () => null,
          (thrown: unknown) => thrown,
        );
      expect(error, String(status)).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind, String(status)).toBe(kind);
      expect((error as ProviderError).status, String(status)).toBe(status);
    }
  });

  it('plays an episode through the SDK: tool calls out, tool results and pictures back', async () => {
    const game = await harness.game();
    const api = await harness.fakeApi([
      { calls: [{ name: 'render', input: { view: 'iso_lower', options: { size_px: 128 } } }] },
      { calls: [{ name: 'place', input: BOWL }], text: 'The bowl goes in upside down.' },
      { calls: [{ name: 'start_cycle', input: {} }] },
    ]);
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({
        provider: anthropicProvider({
          model: 'claude-sonnet-5-5',
          baseURL: api.url,
          apiKey: 'not-a-real-key',
        }),
      }),
      outDir: harness.outDir(),
    });
    expect(record.policy?.name).toBe('anthropic:claude-sonnet-5-5');
    expect(record.player).toMatchObject({ kind: 'agent', name: 'anthropic:claude-sonnet-5-5' });
    expect(record.agent).toMatchObject({
      stopped: 'start_cycle',
      turns: 3,
      cycle_started_by_harness: false,
    });
    expect(record.agent?.tool_calls.map((call) => call.name)).toEqual([
      'render',
      'place',
      'start_cycle',
    ]);
    // Tokens as the API reported them, summed over the three turns.
    expect(record.agent?.usage).toEqual({
      input_tokens: 100 + 101 + 102,
      output_tokens: 20 + 21 + 22,
      cache_read_input_tokens: 150,
      cache_creation_input_tokens: 21,
    });
    expect(record.score?.items_loaded).toBe(1);
    expect(record.replay).toMatchObject({ verified: true, method: 'replay' });

    // The tools offered are the MCP server's thirteen, and the same on every request.
    const names = (api.bodies[0]?.['tools'] as { name: string }[]).map((tool) => tool.name);
    expect(names).toHaveLength(13);
    expect(
      api.bodies.every(
        (body) => JSON.stringify(body['tools']) === JSON.stringify(api.bodies[0]?.['tools']),
      ),
    ).toBe(true);
    expect(api.bodies.every((body) => body['system'] === api.bodies[0]?.['system'])).toBe(true);
    // The second request carries the first turn verbatim and the picture as an image block.
    const messages = api.bodies[1]?.['messages'] as { role: string; content: unknown }[];
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
    expect((messages[1]?.content as { type: string }[]).map((block) => block.type)).toEqual([
      'thinking',
      'tool_use',
    ]);
    const result = (
      messages[2]?.content as { type: string; tool_use_id: string; content: { type: string }[] }[]
    )[0];
    expect(result).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_fake_0_0' });
    expect(result?.content.map((block) => block.type)).toEqual(['text', 'image']);
    // From one request to the next the conversation only grows at its end.
    const earlier = JSON.stringify(api.bodies[1]?.['messages']);
    const later = JSON.stringify((api.bodies[2]?.['messages'] as unknown[]).slice(0, 3));
    expect(later).toBe(earlier);
  });
});
