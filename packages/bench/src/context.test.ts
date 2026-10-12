// The context policy: the oldest turns folded into a note with the load as it stood, the
// most recent few pictures only, both in batches so that between two removals the
// conversation only grows at its end.
import { LoadTracker } from '@spotless/mcp';
import { describe, expect, it } from 'vitest';
import type { ContextPolicy, TurnResult } from './context.ts';
import {
  CONTEXT_POLICY_VERSION,
  Conversation,
  STANDARD_CONTEXT_POLICY,
  STANDARD_IMAGE_POLICY,
  contextSettings,
  countImages,
  entryTokens,
  pruneImages,
} from './context.ts';
import type { HistoryEntry } from './provider.ts';
import { DOT } from './test-util.ts';

const picture = (n: number) => ({ media_type: 'image/png' as const, data_base64: `picture-${n}` });

/** A conversation of `n` render calls, each answered with one picture. */
function conversation(n: number): HistoryEntry[] {
  const history: HistoryEntry[] = [{ role: 'user', text: 'begin' }];
  for (let i = 0; i < n; i++) {
    history.push({
      role: 'assistant',
      text: `looking, ${i}`,
      tool_calls: [{ id: `c${i}`, name: 'render', arguments: { view: 'top_lower' } }],
      native: { turn: i },
    });
    history.push({
      role: 'tool',
      results: [
        {
          call_id: `c${i}`,
          name: 'render',
          text: `{"accepted":true,"n":${i}}`,
          images: [picture(i)],
          is_error: false,
        },
      ],
    });
  }
  return history;
}

describe('pruneImages', () => {
  it('leaves a conversation alone until it holds more than keep + slack pictures', () => {
    const policy = { keep: 2, slack: 3 };
    for (const n of [0, 1, 4, 5]) {
      const history = conversation(n);
      const result = pruneImages(history, policy);
      // The very same array: nothing was rebuilt, so nothing a provider caches was touched.
      expect(result.history).toBe(history);
      expect(result.removed).toBe(0);
    }
  });

  it('then removes the oldest down to keep, leaving a note where each picture was', () => {
    const policy = { keep: 2, slack: 3 };
    const history = conversation(6);
    const result = pruneImages(history, policy);
    expect(result.removed).toBe(4);
    expect(countImages(result.history)).toBe(2);
    const images = result.history.flatMap((entry) =>
      entry.role === 'tool' ? entry.results.flatMap((r) => r.images) : [],
    );
    expect(images.slice(0, 4).every((image) => 'removed' in image)).toBe(true);
    expect(images.slice(4)).toEqual([picture(4), picture(5)]);
    expect(images[0]).toMatchObject({
      removed: true,
      note: expect.stringContaining('render') as string,
    });
    // Every word of the conversation is still there, and the model's own turns are untouched.
    result.history.forEach((entry, i) => {
      const before = history[i] as HistoryEntry;
      if (entry.role === 'tool' && before.role === 'tool') {
        expect(entry.results.map((r) => r.text)).toEqual(before.results.map((r) => r.text));
      } else {
        expect(entry).toBe(before);
      }
    });
    // The input was not changed.
    expect(countImages(history)).toBe(6);
  });

  it('prunes in batches: between two prunings the conversation only grows at its end', () => {
    const policy = STANDARD_IMAGE_POLICY;
    let history: readonly HistoryEntry[] = [{ role: 'user', text: 'begin' }];
    let prunings = 0;
    let previous: readonly HistoryEntry[] = history;
    for (let i = 0; i < 40; i++) {
      const next = conversation(1)
        .slice(1)
        .map((entry) =>
          entry.role === 'tool'
            ? { ...entry, results: entry.results.map((r) => ({ ...r, images: [picture(i)] })) }
            : entry,
        );
      const result = pruneImages([...history, ...next], policy);
      if (result.removed > 0) prunings += 1;
      else {
        // No pruning: everything that was there before is there still, the same objects.
        previous.forEach((entry, at) => expect(result.history[at]).toBe(entry));
      }
      history = result.history;
      previous = history;
      expect(countImages(history)).toBeLessThanOrEqual(policy.keep + policy.slack);
    }
    // 40 pictures with 4 kept and 4 of slack: a pruning every 5th picture after the first 8.
    expect(prunings).toBe(Math.floor((40 - policy.keep) / (policy.slack + 1)));
    expect(countImages(history)).toBeGreaterThanOrEqual(policy.keep);
  });

  it('is a pure function of the history', () => {
    const a = pruneImages(conversation(12), STANDARD_IMAGE_POLICY);
    const b = pruneImages(conversation(12), STANDARD_IMAGE_POLICY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ---------------------------------------------------------------------------------------------
// The conversation of a long episode
// ---------------------------------------------------------------------------------------------

/** A scripted episode: results as the tools give them, made here without a game. */
class Script {
  private n = 0;
  private placed: string[] = [];
  private actions = 0;
  private queries = 0;
  /** A copy of the load fed with every result, to hold the conversation's notes against. */
  readonly truth = new LoadTracker();
  /** The same copy as it stood after each call (index: calls made). */
  readonly after: LoadTracker[] = [new LoadTracker()];

  private budget(): { actions: string; queries: string; washes: string } {
    return { actions: `${this.actions}/1120`, queries: `${this.queries}/2100`, washes: '0/1' };
  }

  private item(id: string, k: number): { [key: string]: unknown } {
    return {
      item_id: id,
      frame: 'lower_rack',
      position_mm: [100.5 + k, 200.25, 80.1],
      quat_wxyz: [0.4951, 0.5035, 0.5264, 0.4735],
      stable: true,
      touches: ['lower_rack.tine_row_r1', 'lower_rack.tine_row_r2'],
      location: 'lower_rack',
    };
  }

  private turn(
    name: string,
    args: unknown,
    structured: { [key: string]: unknown },
    images: string[] = [],
  ): { assistant: HistoryEntry & { role: 'assistant' }; results: TurnResult[] } {
    this.n += 1;
    const id = `call_${this.n}`;
    this.truth.apply(name, structured);
    this.after.push(this.truth.clone());
    const call = { id, name, arguments: args };
    return {
      assistant: { role: 'assistant', text: '', tool_calls: [call], native: { n: this.n } },
      results: [
        {
          call,
          structured,
          result: {
            call_id: id,
            name,
            text: JSON.stringify(structured),
            images: images.map((data) => ({ media_type: 'image/png' as const, data_base64: data })),
            is_error: structured['accepted'] === false,
          },
        },
      ],
    };
  }

  /** An accepted placement: the first of an episode carries the whole scene, the rest their changes. */
  place(): ReturnType<Script['turn']> {
    const id = `item_${String(this.placed.length).padStart(3, '0')}`;
    this.placed.push(id);
    this.actions += 1;
    const entry = this.item(id, this.placed.length);
    const tail = {
      load: { placed: this.placed.length, unplaced: 0, by_location: {}, racks: {} },
      budget: this.budget(),
      state_hash: `hash${this.n}`,
    };
    const whole = this.actions === 1;
    return this.turn(
      'place',
      { item_id: id, frame: 'lower_rack', position_mm: [100, 200, 150] },
      {
        accepted: true,
        item_id: id,
        displacement_mm: 6.1,
        rotation_deg: 2.9,
        stable: true,
        resting: { lowest_point_mm: 3.9, on_base: true, force_over_weight: 1.1 },
        contact_forces_N: { 'lower_rack.tine_row_r1': 4.54, 'lower_rack.tine_row_r2': 3.92 },
        ...(whole
          ? {
              state: {
                state_hash: `hash${this.n}`,
                phase: 'loading',
                racks: { lower_rack: 'out', upper_rack: 'in' },
                rack_options: { 'upper_rack.height': '1' },
                placed: {
                  columns: [
                    'item_id',
                    'frame',
                    'position_mm',
                    'quat_wxyz',
                    'stable',
                    'touches',
                    'location',
                  ],
                  rows: [Object.values(entry)],
                },
                placed_total: 1,
                unplaced: [],
                budget: this.budget(),
              },
            }
          : { changes: { items: [entry] } }),
        ...tail,
      },
    );
  }

  /** A refused placement. */
  refused(): ReturnType<Script['turn']> {
    return this.turn(
      'place',
      { item_id: 'x', frame: 'lower_rack', position_mm: [1, 2, 3] },
      { accepted: false, reason: 'collision_at_pose', colliding_with: ['lower_rack'] },
    );
  }

  /** Slot advice of about the size the tool gives. */
  slots(item: string): ReturnType<Script['turn']> {
    this.queries += 1;
    return this.turn(
      'list_slots',
      { rack: 'lower_rack', item_id: item },
      {
        accepted: true,
        rack: 'lower_rack',
        item_id: item,
        places_total: 34,
        places: {
          columns: ['slot', 'position_mm', 'orientation', 'drop_free', 'note'],
          rows: Array.from({ length: 12 }, (_, i) => [
            `tine_row_r1+tine_row_r2.slot_${String(i).padStart(2, '0')}`,
            [63 + 18 * i, 368, 143],
            { preset: 'on_edge', roll_deg: 5, yaw_deg: 90 },
            true,
            '',
          ]),
        },
        budget: { queries: `${this.queries}/2100` },
      },
    );
  }

  /** A picture: a plan view, or the sheet of every item. */
  render(view: string): ReturnType<Script['turn']> {
    this.queries += 1;
    return this.turn(
      'render',
      { view },
      { accepted: true, view, budget: { queries: `${this.queries}/2100` } },
      [DOT],
    );
  }
}

const SMALL: ContextPolicy = {
  images: { keep: 2, slack: 2 },
  foldAbove: 4000,
  foldAboveNote: 0,
  keepRecent: 1500,
  hardLimit: 12_000,
  requestLimit: 100_000,
};

/** Every entry as text, for comparing conversations by what a provider would be sent. */
const sent = (history: readonly HistoryEntry[]): string[] =>
  history.map((entry) => JSON.stringify(entry));

/** The scene a note of the harness gives, and the call it says it is the scene after. */
function noteOf(first: HistoryEntry | undefined): { call: number; scene: unknown } | null {
  if (first === undefined || first.role !== 'user') return null;
  const match = /The scene after call (\d+):\n(\{.*\})/.exec(first.text);
  if (match === null) return null;
  return { call: Number(match[1]), scene: JSON.parse(match[2] as string) as unknown };
}

describe('the conversation of a long episode', () => {
  it('does not grow without bound, and loses nothing of the load', () => {
    const script = new Script();
    const conversation = new Conversation('begin', SMALL);
    let largest = 0;
    let folds = 0;
    let previous = sent(conversation.history);
    let stableSteps = 0;
    for (let i = 0; i < 600; i++) {
      const turn =
        i % 9 === 4 ? script.slots(`item_${i}`) : i % 23 === 7 ? script.refused() : script.place();
      conversation.addTurn(turn.assistant, turn.results);
      const now = sent(conversation.history);
      largest = Math.max(largest, conversation.tokens);
      if (conversation.folds.length === folds) {
        // Between two folds the conversation only grows at its end: what was sent before is
        // sent again, word for word, so a provider's prompt cache holds.
        expect(now.slice(0, previous.length)).toEqual(previous);
        expect(now.length).toBeGreaterThan(previous.length);
        stableSteps += 1;
      } else {
        folds = conversation.folds.length;
        // A fold: the first message has the note, and the turns kept are the last turns of
        // what was there, untouched.
        const kept = now.slice(1);
        expect(kept.length).toBeGreaterThan(0);
        expect(
          [
            ...previous,
            ...sent([turn.assistant, { role: 'tool', results: turn.results.map((r) => r.result) }]),
          ].slice(-kept.length),
        ).toEqual(kept);
      }
      previous = now;
      // Whatever was folded, the note gives the scene as it stood after the last folded
      // call: exactly what a copy fed with every result held then.
      const note = noteOf(conversation.history[0]);
      if (conversation.folds.length > 0) {
        if (note === null) throw new Error('a fold left no note');
        expect(note.call).toBe(
          conversation.folds[conversation.folds.length - 1]?.calls_folded_total,
        );
        expect(note.scene).toEqual(script.after[note.call]?.state());
      } else {
        expect(note).toBeNull();
      }
      // And the harness's own copy is the scene as it is now.
      expect(conversation.load.state()).toEqual(script.truth.state());
    }
    // 600 calls on a load that grows to 500 items: the conversation stayed within the room
    // for recent turns plus the note (which holds the load, and grows with it), and most
    // requests could be read from the cache up to their last turn.
    expect(conversation.folds.length).toBeGreaterThan(20);
    expect(conversation.folds.every((fold) => !fold.forced)).toBe(true);
    const note = entryTokens(conversation.history[0] as HistoryEntry);
    expect(largest).toBeLessThan(SMALL.foldAbove + note + 1500);
    expect(stableSteps).toBeGreaterThan(500);
    expect(conversation.folds.reduce((sum, fold) => sum + fold.calls_folded, 0)).toBe(
      conversation.folds[conversation.folds.length - 1]?.calls_folded_total,
    );
    // The transcript still has every turn.
    expect(conversation.everything).toHaveLength(1 + 2 * 600);
    expect(conversation.everything[0]).toEqual({ role: 'user', text: 'begin' });
  });

  it('keeps every call with its result: a turn is taken out whole or not at all', () => {
    const script = new Script();
    const conversation = new Conversation('begin', SMALL);
    for (let i = 0; i < 200; i++) {
      const turn = script.place();
      conversation.addTurn(turn.assistant, turn.results);
      const history = conversation.history;
      expect(history[0]?.role).toBe('user');
      expect((history[0] as { text: string }).text.startsWith('begin')).toBe(true);
      for (let k = 1; k < history.length; k += 2) {
        const call = history[k];
        const result = history[k + 1];
        if (call?.role !== 'assistant' || result?.role !== 'tool') throw new Error('not a pair');
        expect(result.results.map((r) => r.call_id)).toEqual(call.tool_calls.map((c) => c.id));
        // The model's own turn goes back as it came.
        expect(call.native).toEqual({ n: Number(call.tool_calls[0]?.id.split('_')[1]) });
      }
    }
    expect(conversation.folds.length).toBeGreaterThan(3);
  });

  it('spares what describes the scene as it stands: everything since the last accepted action', () => {
    const script = new Script();
    const conversation = new Conversation('begin', SMALL);
    const add = (turn: ReturnType<Script['place']>): void =>
      conversation.addTurn(turn.assistant, turn.results);
    // Looks before anything is placed: the scene is as it started, nothing is out of date.
    for (let i = 0; i < 12; i++) add(script.slots(`kind_${i}`));
    expect(conversation.tokens).toBeGreaterThan(SMALL.foldAbove);
    expect(conversation.folds).toHaveLength(0);
    // The first accepted action makes them the advice of a scene that is no more.
    add(script.place());
    expect(conversation.folds).toHaveLength(1);
    expect(conversation.folds[0]).toMatchObject({ forced: false, reason: 'size' });
    // The placement itself stays, with the most recent of the looks before it.
    const kept = conversation.history.flatMap((entry) =>
      entry.role === 'tool' ? entry.results.map((r) => r.name) : [],
    );
    expect(kept[kept.length - 1]).toBe('place');
    expect(kept.length).toBeLessThan(6);
    // What is asked after it is of the scene as it stands, and stays however much it is.
    for (let i = 0; i < 10; i++) add(script.slots(`more_${i}`));
    expect(conversation.folds.every((fold) => !fold.forced)).toBe(true);
    const names = conversation.history.flatMap((entry) =>
      entry.role === 'tool' ? entry.results.map((r) => r.name) : [],
    );
    // (The looks from before the placement have gone meanwhile: they were out of date.)
    expect(names).toEqual(['place', ...Array.from({ length: 10 }, () => 'list_slots')]);
    expect(conversation.tokens).toBeGreaterThan(SMALL.foldAbove);
    // Only past the hard limit do they go, and the record says that it was forced.
    const unforced = conversation.folds.length;
    while (conversation.folds.length === unforced) add(script.slots('yet_more'));
    expect(conversation.folds[unforced]).toMatchObject({ forced: true, reason: 'hard_limit' });
    expect(conversation.tokens).toBeLessThan(SMALL.hardLimit);
  });

  it('re-supplies the slot advice asked last and the sheet of every item', () => {
    const script = new Script();
    const conversation = new Conversation('begin', SMALL);
    const add = (turn: ReturnType<Script['place']>): void =>
      conversation.addTurn(turn.assistant, turn.results);
    add(script.render('items'));
    add(script.slots('plate_01'));
    add(script.slots('plate_02'));
    for (let i = 0; i < 40; i++) add(script.place());
    expect(conversation.folds.length).toBeGreaterThan(0);
    const first = conversation.history[0];
    if (first?.role !== 'user') throw new Error('no first message');
    // The advice asked last, as it was, with the call it answered; the earlier one is gone.
    expect(first.text).toContain(
      'The slot advice asked last (call 3, list_slots {"rack":"lower_rack","item_id":"plate_02"})',
    );
    expect(first.text).toContain('tine_row_r1+tine_row_r2.slot_11');
    expect(first.text).not.toContain('"item_id":"plate_01"');
    // The sheet travels with the note as a picture, and the picture policy leaves it alone.
    expect(first.images).toEqual([{ media_type: 'image/png', data_base64: DOT }]);
    expect(first.text).toContain('view items');
    expect(countImages(conversation.history)).toBe(0);
    for (let i = 0; i < 12; i++) add(script.render('top_lower'));
    expect((conversation.history[0] as { images?: unknown[] }).images).toHaveLength(1);
    expect(countImages(conversation.history)).toBeLessThanOrEqual(4);
    expect(conversation.prunings).toBeGreaterThan(0);
    // Advice that is still among the recent turns is not said twice.
    add(script.slots('bowl_01'));
    for (let i = 0; i < 3; i++) add(script.place());
    while (
      !conversation.history.some(
        (entry) => entry.role === 'tool' && entry.results.some((r) => r.name === 'list_slots'),
      )
    )
      add(script.slots('bowl_02'));
    const before = conversation.folds.length;
    while (conversation.folds.length === before) add(script.place());
    const recent = conversation.history.some(
      (entry) => entry.role === 'tool' && entry.results.some((r) => r.name === 'list_slots'),
    );
    const noted = (conversation.history[0] as { text: string }).text.includes(
      'The slot advice asked last',
    );
    expect(noted).toBe(!recent);
  });

  it('folds when the provider counted more than a request may hold, whatever the estimate says', () => {
    const script = new Script();
    const conversation = new Conversation('begin', { ...SMALL, foldAbove: 1_000_000 });
    for (let i = 0; i < 30; i++) {
      const turn = script.place();
      conversation.addTurn(turn.assistant, turn.results, 50_000);
    }
    expect(conversation.folds).toHaveLength(0);
    const size = conversation.tokens;
    const turn = script.place();
    conversation.addTurn(turn.assistant, turn.results, SMALL.requestLimit + 1);
    expect(conversation.folds).toHaveLength(1);
    expect(conversation.folds[0]).toMatchObject({ reason: 'request_limit' });
    expect(conversation.history.length).toBeLessThan(2 * 31);
    expect(noteOf(conversation.history[0])?.scene).toEqual(
      script.after[conversation.folds[0]?.calls_folded_total ?? 0]?.state(),
    );
    expect(size).toBeGreaterThan(SMALL.keepRecent);
  });

  it('folds less often when the note is large: the room for recent turns grows with it', () => {
    const run = (factor: number): { folds: number; largest: number; note: number } => {
      const script = new Script();
      const conversation = new Conversation('begin', { ...SMALL, foldAboveNote: factor });
      let largest = 0;
      for (let i = 0; i < 400; i++) {
        const turn = script.place();
        conversation.addTurn(turn.assistant, turn.results);
        largest = Math.max(largest, conversation.tokens);
      }
      return {
        folds: conversation.folds.length,
        largest,
        note: entryTokens(conversation.history[0] as HistoryEntry),
      };
    };
    const fixed = run(0);
    const scaled = run(2);
    // 400 items in the note: far more than the fixed room for recent turns.
    expect(scaled.note).toBeGreaterThan(3 * SMALL.foldAbove);
    expect(scaled.folds).toBeLessThan(fixed.folds / 2);
    // The conversation stays within the note and twice the note of recent turns.
    expect(scaled.largest).toBeLessThan(3 * scaled.note + 1500);
  });

  it('never says that nothing was placed when something was: a copy that was never given the whole scene', () => {
    // Results as a server would give them that answers the first action with changes only
    // (the fault found in review: a part of the scene asked first counted as the scene).
    const changesOnly = (turn: ReturnType<Script['place']>): ReturnType<Script['place']> => {
      const result = turn.results[0];
      if (result === undefined) throw new Error('no result');
      const { state, ...rest } = result.structured as { state?: { placed: { rows: unknown[][] } } };
      if (state === undefined) return turn;
      const row = state.placed.rows[0] as unknown[];
      const structured = {
        ...rest,
        changes: {
          items: [
            {
              item_id: row[0],
              frame: row[1],
              position_mm: row[2],
              quat_wxyz: row[3],
              stable: row[4],
              touches: row[5],
              location: row[6],
            },
          ],
        },
      };
      return {
        assistant: turn.assistant,
        results: [
          { ...result, structured, result: { ...result.result, text: JSON.stringify(structured) } },
        ],
      };
    };
    const run = (policy: ContextPolicy): Conversation => {
      const script = new Script();
      const conversation = new Conversation('begin', policy);
      for (let i = 0; i < 60; i++) {
        const turn = i % 3 === 0 ? changesOnly(script.place()) : script.slots(`item_${i}`);
        conversation.addTurn(turn.assistant, turn.results);
      }
      return conversation;
    };
    const placements = (conversation: Conversation): number =>
      conversation.history.filter(
        (entry) =>
          entry.role === 'tool' &&
          entry.results.some((result) => result.name === 'place' && !result.is_error),
      ).length;

    // For size alone no turn with an accepted action is taken out while the copy is not
    // whole: every placement is still in the conversation, word for word.
    const spared = run({ ...SMALL, hardLimit: 1_000_000 });
    expect(spared.load.complete).toBe(false);
    expect(spared.folds).toHaveLength(0);
    expect(placements(spared)).toBe(20);

    // Past the hard limit they go all the same, and the note says what is true: actions
    // were taken out, and the harness has no scene to give.
    const forced = run(SMALL);
    expect(forced.folds.length).toBeGreaterThan(0);
    expect(forced.folds[0]?.reason).toBe('hard_limit');
    expect(placements(forced)).toBeLessThan(20);
    const text = (forced.history[0] as { text: string }).text;
    expect(text).not.toContain('no action had been accepted');
    expect(text).toMatch(/\d+ accepted actions? w(as|ere) among the calls taken out/);
    expect(text).toContain('Call get_state');
    expect(noteOf(forced.history[0])).toBeNull();
  });

  it('says so when nothing had been placed and the whole scene had not been asked', () => {
    const script = new Script();
    // A fold forced by the provider's count before any action: only looks are taken out.
    const conversation = new Conversation('begin', SMALL);
    for (let i = 0; i < 6; i++) {
      const turn = script.slots(`item_${i}`);
      conversation.addTurn(turn.assistant, turn.results, i === 5 ? 200_000 : 10);
    }
    expect(conversation.folds).toHaveLength(1);
    const text = (conversation.history[0] as { text: string }).text;
    expect(text).toContain('no action had been accepted');
    expect(text).toContain('no result gave the whole scene');
  });

  it('keeps reminders with the turn they follow, and says what it is in the record', () => {
    const conversation = new Conversation('begin', SMALL);
    conversation.addUser('your turn was cut off');
    conversation.addTurn(
      { role: 'assistant', text: 'Done, I think.', tool_calls: [], native: 1 },
      [],
    );
    conversation.addUser('carry on');
    expect(conversation.history.map((entry) => entry.role)).toEqual([
      'user',
      'user',
      'assistant',
      'user',
    ]);
    expect(conversation.everything).toHaveLength(4);
    expect(conversation.load.complete).toBe(false);
    expect(contextSettings(STANDARD_CONTEXT_POLICY)).toMatchObject({
      version: CONTEXT_POLICY_VERSION,
      images_kept: 4,
      images_slack: 4,
      fold_above_tokens: STANDARD_CONTEXT_POLICY.foldAbove,
      fold_above_note_factor: 2,
      keep_recent_tokens: STANDARD_CONTEXT_POLICY.keepRecent,
    });
    expect(CONTEXT_POLICY_VERSION).toBe('standard-2');
  });

  it('is a function of what was added: the same episode gives the same conversation', () => {
    const run = (): string => {
      const script = new Script();
      const conversation = new Conversation('begin', SMALL);
      for (let i = 0; i < 150; i++) {
        const turn =
          i % 7 === 3
            ? script.slots('x')
            : i % 11 === 5
              ? script.render('top_lower')
              : script.place();
        conversation.addTurn(turn.assistant, turn.results);
      }
      return JSON.stringify([conversation.history, conversation.folds]);
    };
    expect(run()).toBe(run());
  });
});
