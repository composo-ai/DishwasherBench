// Measuring an episode without a model: the token estimate against what a real endpoint
// counted, the sizes of the requests of a conversation, and the sequence of calls of a saved load.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CalibrationRow, LoadLike, TranscriptLike } from './measure.ts';
import {
  TOKEN_MODEL,
  calibrationRows,
  characterClasses,
  checkTokenModel,
  estimateTokens,
  fitTokenModel,
  measureRequests,
  pictureTokens,
  pngSize,
  sequenceOfLoad,
  toolsText,
} from './measure.ts';
import type { HistoryEntry, ToolSpec, TurnRequest } from './provider.ts';
import { DOT } from './test-util.ts';

const FIRST_RUNS = fileURLToPath(new URL('../../../docs/benchmark/first-runs/', import.meta.url));

describe('the token estimate', () => {
  it('counts letters, digits and everything else apart', () => {
    expect(characterClasses('plate_01: [133.3, 373.5]')).toEqual({
      letters: 5,
      digits: 10,
      other: 9,
    });
    // A number costs far more than a word of the same length.
    expect(estimateTokens('0.4951,0.5035')).toBeGreaterThan(3 * estimateTokens('settled_poses'));
    expect(estimateTokens('')).toBe(0);
    // Prose runs near five characters a token, the JSON of a pose near two and a half.
    const prose = 'Put an item from the counter into the machine and let physics settle it.';
    const pose = '{"position_mm":[358.6,285.2,77.6],"quat_wxyz":[0.0007,0.9676,0.0089,-0.2525]}';
    expect(prose.length / estimateTokens(prose)).toBeGreaterThan(4);
    expect(pose.length / estimateTokens(pose)).toBeLessThan(3);
  });

  it('sizes a picture by its pixels', () => {
    expect(pictureTokens(768, 768)).toBeCloseTo(TOKEN_MODEL.perPicture768, 6);
    expect(pictureTokens(256, 256)).toBeCloseTo(TOKEN_MODEL.perPicture768 / 9, 6);
    expect(pngSize(DOT)).toEqual({ width: 1, height: 1 });
    expect(pngSize('not a picture')).toEqual({ width: 768, height: 768 });
  });

  it('is within a few per cent of what the endpoint of the first real episodes counted', () => {
    // The transcripts of the first model episodes, kept with the documentation.
    for (const name of [
      'sol-tutorial-1',
      'sol-tutorial-2',
      'sol-tutorial-3',
      'sol-tutorial-4',
      'sol-weeknight-1',
    ]) {
      const file = `${FIRST_RUNS}${name}/transcript.json`;
      if (!existsSync(file)) continue;
      const transcript = JSON.parse(readFileSync(file, 'utf8')) as TranscriptLike;
      const rows = calibrationRows(transcript);
      expect(rows.length, name).toBeGreaterThan(15);
      const check = checkTokenModel(rows);
      expect(check.ratio, name).toBeGreaterThan(0.93);
      expect(check.ratio, name).toBeLessThan(1.07);
    }
    expect(existsSync(`${FIRST_RUNS}sol-tutorial-1/transcript.json`)).toBe(true);
  });

  it('can be fitted again from the rows of any episode', () => {
    const truth = { perLetter: 0.2, perDigit: 1.1, perOther: 0.3, perItem: 7, perPicture768: 650 };
    const rows: CalibrationRow[] = [];
    for (let i = 1; i <= 40; i++) {
      const row = {
        letters: 100 + ((i * 37) % 900),
        digits: 20 + ((i * 53) % 400),
        other: 50 + ((i * 29) % 500),
        items: 1 + (i % 3),
        pictures: i % 5 === 0 ? 1 : 0,
      };
      rows.push({
        ...row,
        tokens:
          row.letters * truth.perLetter +
          row.digits * truth.perDigit +
          row.other * truth.perOther +
          row.items * truth.perItem +
          row.pictures * truth.perPicture768,
      });
    }
    const fit = fitTokenModel(rows);
    for (const key of Object.keys(truth) as (keyof typeof truth)[]) {
      expect(fit[key], key).toBeCloseTo(truth[key], 6);
    }
    expect(checkTokenModel(rows, fit)).toMatchObject({
      rows: 40,
      max_abs_error: expect.any(Number) as number,
    });
    expect(checkTokenModel(rows, fit).max_abs_error).toBeLessThan(1e-6);
    expect(checkTokenModel(rows, fit).ratio).toBeCloseTo(1, 9);
  });

  it('reads from a transcript what each turn added, and the first request when it is described', () => {
    const transcript: TranscriptLike = {
      fixed_characters: { letters: 1000, digits: 10, other: 300 },
      history: [
        { role: 'user', text: 'begin' },
        { role: 'assistant', text: '', tool_calls: [{ name: 'get_state', arguments: {} }] },
        { role: 'tool', results: [{ name: 'get_state', text: '{"placed":[1,2]}', images: [] }] },
        {
          role: 'assistant',
          text: 'Looking.',
          tool_calls: [
            { name: 'render', arguments: { view: 'front' } },
            { name: 'preview', arguments: {} },
          ],
        },
        {
          role: 'tool',
          results: [
            {
              name: 'render',
              text: '{"accepted":true}',
              images: ['[png, 100 bytes]', '[png, 384x384, 50 bytes]', '[picture removed]'],
            },
            { name: 'preview', text: '{"accepted":true}', images: [] },
          ],
        },
        { role: 'assistant', text: '', tool_calls: [{ name: 'start_cycle', arguments: {} }] },
      ],
      turns: [300, 340, 1100].map((total) => ({
        usage: {
          input_tokens: 3,
          cache_read_input_tokens: total - 3,
          cache_creation_input_tokens: 0,
        },
      })),
    };
    const rows = calibrationRows(transcript);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      letters: 1005,
      digits: 10,
      other: 300,
      items: 1,
      pictures: 0,
      tokens: 300,
    });
    // The second request gained one call and one result: 40 tokens.
    expect(rows[1]).toMatchObject({ items: 2, pictures: 0, tokens: 40 });
    // The third: a turn with words, two calls, two results and a picture.
    // (A picture of half the edge is a quarter of a picture; a removed one is none.)
    expect(rows[2]).toMatchObject({ items: 5, pictures: 1.25, tokens: 760 });
  });
});

const TOOLS: ToolSpec[] = [
  { name: 'place', description: 'Put an item in.', input_schema: { type: 'object' } },
];

function turn(n: number, text: string, images: number): HistoryEntry[] {
  return [
    {
      role: 'assistant',
      text: '',
      tool_calls: [{ id: `c${n}`, name: n % 2 === 0 ? 'place' : 'render', arguments: { n } }],
      native: null,
    },
    {
      role: 'tool',
      results: [
        {
          call_id: `c${n}`,
          name: n % 2 === 0 ? 'place' : 'render',
          text,
          images: Array.from({ length: images }, () => ({
            media_type: 'image/png' as const,
            data_base64: DOT,
          })),
          is_error: n === 4,
        },
      ],
    },
  ];
}

describe('measuring the requests of an episode', () => {
  it('sizes every call, every request, and what the cache has seen before', () => {
    const opening: HistoryEntry = { role: 'user', text: 'begin' };
    const turns = [0, 1, 2, 3, 4].map((n) =>
      turn(n, `{"accepted":true,"n":${n},"pad":"${'x'.repeat(100 * (n + 1))}"}`, n % 2),
    );
    const requests: TurnRequest[] = [];
    let history: HistoryEntry[] = [opening];
    requests.push({ system: 'The rules.', tools: TOOLS, history });
    for (const entries of turns.slice(0, 3)) {
      history = [...history, ...entries];
      requests.push({ system: 'The rules.', tools: TOOLS, history });
    }
    // The context policy takes the first two turns out and says so in the first message.
    history = [
      { role: 'user', text: 'begin\n\n[note]' },
      ...(turns[2] as HistoryEntry[]),
      ...(turns[3] as HistoryEntry[]),
    ];
    requests.push({ system: 'The rules.', tools: TOOLS, history });
    history = [...history, ...(turns[4] as HistoryEntry[])];
    requests.push({ system: 'The rules.', tools: TOOLS, history });

    const m = measureRequests(requests);
    expect(m.requests).toBe(6);
    expect(m.calls).toBe(5);
    expect(m.per_call.map((call) => call.tool)).toEqual([
      'place',
      'render',
      'place',
      'render',
      'place',
    ]);
    expect(m.per_call.map((call) => call.turn)).toEqual([1, 2, 3, 4, 5]);
    expect(m.per_call.map((call) => call.pictures)).toEqual([0, 1, 0, 1, 0]);
    expect(m.per_call[4]).toMatchObject({ is_error: true, result_characters: 532 });
    expect(m.pictures).toBe(2);
    expect(m.system_characters).toBe(10);
    expect(m.tools_characters).toBe(toolsText(TOOLS).length);
    // By tool: three placements, one of them refused; two looks.
    const place = m.by_tool.find((tool) => tool.tool === 'place');
    expect(place).toMatchObject({ calls: 3, refused: 1, characters_max: 532, pictures: 0 });
    expect(place?.characters_median).toBe(332);
    // A request that only grew at its end is read from the cache up to what is new...
    const [r1, r2, r3, r4, r5, r6] = m.per_request;
    expect(r1?.cached_tokens).toBe(0);
    expect(r2?.cached_tokens).toBe(r1?.tokens);
    expect(r3?.cached_tokens).toBe(r2?.tokens);
    expect(r4?.cached_tokens).toBe(r3?.tokens);
    // ...and after a fold only the system prompt and the tools are.
    expect(r5?.cached_tokens).toBe(r1?.fixed_tokens);
    expect(r5?.tokens).toBeLessThan((r4?.tokens ?? 0) + 400);
    expect(Math.abs((r6?.cached_tokens ?? 0) - (r5?.tokens ?? 0))).toBeLessThanOrEqual(1);
    // Totals: the sum of the requests, split into read and new.
    const sum = m.per_request.reduce((total, request) => total + request.tokens, 0);
    expect(Math.abs(m.input_tokens - sum)).toBeLessThanOrEqual(3);
    expect(m.cached_tokens + m.written_tokens).toBe(m.input_tokens);
    expect(m.largest_request_tokens).toBe(
      Math.max(...m.per_request.map((request) => request.tokens)),
    );
    expect(m.largest_conversation_tokens).toBeLessThan(m.largest_request_tokens);
    expect(r4?.pictures).toBe(1);
    expect(r6?.pictures).toBe(1);
  });
});

describe('the sequence of calls of a saved load', () => {
  const event = (name: string, accepted = true, args: Record<string, unknown> = {}): unknown => ({
    name,
    accepted,
    args,
  });
  const places = (n: number, frame: string): unknown[] =>
    Array.from({ length: n }, (_, i) => [
      event('preview', true, { item_id: `i${i}` }),
      event('place', true, { item_id: `i${i}`, frame }),
    ]).flat();
  const load = {
    level: { id: 'test', items: [] },
    action_log: [
      event('get_level'),
      event('list_slots', true, { rack: 'lower_rack' }),
      ...places(10, 'lower_rack'),
      event('place', false, { item_id: 'x', frame: 'lower_rack' }),
      event('set_rack', true, { rack: 'upper_rack' }),
      ...places(12, 'upper_rack'),
      event('check_load'),
      event('start_cycle', false),
      event('start_cycle'),
      event('get_level'),
    ],
  } as unknown as LoadLike;

  it('plays every call of the policy but its previews, with a look after every tenth placement', () => {
    const sequence = sequenceOfLoad(load);
    const names = sequence.turns.map((turn) => ('calls' in turn ? turn.calls[0]?.name : 'say'));
    expect(sequence.left_out).toBe(22);
    expect(sequence.looks).toBe(2);
    // One call a turn; refused calls are played too; nothing after the accepted start_cycle.
    expect(names.filter((name) => name === 'place')).toHaveLength(23);
    expect(names.filter((name) => name === 'preview')).toHaveLength(0);
    expect(names.slice(-3)).toEqual(['check_load', 'start_cycle', 'start_cycle']);
    expect(sequence.from_log).toBe(2 + 10 + 1 + 1 + 12 + 1 + 2);
    // The first look is a plan view of the basket just loaded, the second the scene state.
    expect(names[12]).toBe('render');
    expect(
      (sequence.turns[12] as unknown as { calls: { arguments: unknown }[] }).calls[0]?.arguments,
    ).toEqual({
      view: 'top_lower',
      options: { labels: true, grid: true },
    });
    expect(names.indexOf('get_state')).toBe(12 + 1 + 1 + 1 + 10);
    expect(sequence.counts).toMatchObject({ place: 23, render: 1, get_state: 1, start_cycle: 2 });
  });

  it('plays the previews too when asked, and no looks when asked for none', () => {
    const all = sequenceOfLoad(load, { previews: 'all', lookEvery: 0 });
    expect(all.left_out).toBe(0);
    expect(all.looks).toBe(0);
    expect(all.counts['preview']).toBe(22);
    expect(all.turns).toHaveLength(all.from_log);
  });
});
