// The harness end to end: scripted policies and a (scripted) model play whole episodes on a
// real game server through the MCP tools; the records are verified by replay.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Level } from '@spotless/levels';
import { starterLevels } from '@spotless/levels';
import { TOOL_NAMES } from '@spotless/mcp';
import type { EpisodeRecord } from '@spotless/server';
import { EPISODE_FORMAT, LOADING_GUIDANCE } from '@spotless/server';
import { describe, expect, it } from 'vitest';
import { runBatch } from './batch.ts';
import { main } from './cli.ts';
import { runEpisode } from './episode.ts';
import { entryTokens } from './context.ts';
import { STANDARD_MAX_TURNS, llmPolicy, standardMaxTurns } from './llm.ts';
import { CONTINUE_MESSAGE, OPENING_MESSAGE, TRUNCATED_MESSAGE } from './prompt.ts';
import type { ModelProvider } from './provider.ts';
import { ProviderError } from './provider.ts';
import { readEpisodeRecords, resultsMarkdown, resultsTable } from './results.ts';
import { scriptedPolicy } from './scripted.ts';
import type { ScriptedTurn } from './scripted-provider.ts';
import { scriptedProvider } from './scripted-provider.ts';
import { DOT, useHarness } from './test-util.ts';
import { verifyByReplay } from './verify.ts';

const harness = useHarness();

const BOWL = {
  item_id: 'bowl_01',
  frame: 'lower_rack',
  position_mm: [420, 270, 200],
  orientation: { preset: 'inverted' },
};

describe('scripted policies', () => {
  it('plays the careful loader through the tools, washes, verifies and records the episode', async () => {
    const game = await harness.game();
    const outDir = harness.outDir();
    const lines: string[] = [];
    const { record, file, dir } = await runEpisode({
      game,
      levelId: 'tutorial',
      // Three of the seven items: enough to exercise everything, and quick.
      policy: scriptedPolicy('careful', { items: ['plate_01', 'bowl_01', 'mug_01'] }),
      seed: 7,
      outDir,
      log: (line) => lines.push(line),
    });

    // Level, versions, policy and settings.
    expect(record.format).toBe(EPISODE_FORMAT);
    expect(record.level).toMatchObject({ id: 'tutorial', items: 12, points_available: 64 });
    expect(record.player).toEqual({ kind: 'scripted', name: 'careful', interface: 'mcp/memory' });
    expect(record.policy).toMatchObject({ name: 'careful', settings: { seed: 7 } });
    expect(record.versions.harness).toMatch(/^spotless-bench\//);
    expect(record.versions.benchmark_version).toBe(record.benchmark_version);

    // Every tool call with its arguments and a digest of its result; the game logged the same calls.
    const calls = record.agent?.tool_calls ?? [];
    expect(calls.length).toBeGreaterThan(5);
    expect(calls.every((call) => /^sha256:/.test(call.result_digest))).toBe(true);
    expect(record.events.slice(0, calls.length).map((event) => event.name)).toEqual(
      calls.map((call) => call.name),
    );
    // (A result without `accepted`, such as the level card, is an answer: accepted is null.)
    expect(calls.map((call) => call.accepted ?? !call.is_error)).toEqual(
      record.events.slice(0, calls.length).map((event) => event.accepted),
    );
    // The policy left the cycle to the harness.
    expect(record.agent?.cycle_started_by_harness).toBe(true);
    expect(record.events[record.events.length - 1]).toMatchObject({
      name: 'start_cycle',
      accepted: true,
    });

    // Budgets used, refused calls, time, the report, the score.
    // (The start of the cycle is an action of the log that is charged as a wash, not as an action.)
    expect(record.budget?.washes_used).toBe(1);
    expect(record.budget?.actions_used).toBe(record.counts.actions_accepted - 1);
    expect(record.counts.by_name['place']?.accepted).toBeGreaterThanOrEqual(1);
    expect(record.time.loading_s).toBeGreaterThanOrEqual(0);
    expect(record.wash).toMatchObject({ status: 'done' });
    expect(record.report?.items).toHaveLength(12);
    expect(record.load?.items.length).toBe(record.score?.items_loaded);
    expect(record.score).toMatchObject({ points_available: 64, items_total: 12, simulated: false });
    expect(record.score?.items_loaded).toBeGreaterThanOrEqual(1);
    // Nothing of the wash's seed is in the record.
    expect(JSON.stringify(record)).not.toContain('"seed":20');
    expect(JSON.stringify(record.events)).not.toContain('seed');

    // Verified against the policy's own session, event by event.
    expect(record.replay).toMatchObject({
      verified: true,
      method: 'policy_session',
      mismatches: [],
    });
    expect(record.replay?.events).toBe(calls.length);

    // The record on disk is the record returned, and it replays to its final hash.
    const stored = JSON.parse(readFileSync(file, 'utf8')) as EpisodeRecord;
    expect(stored).toEqual(JSON.parse(JSON.stringify(record)));
    const level = game.levels.get('tutorial');
    if (level === undefined) throw new Error('no tutorial');
    const replay = await verifyByReplay(stored, level);
    expect(replay).toMatchObject({ verified: true, method: 'replay', mismatches: [] });
    expect(replay.final_state_hash).toBe(stored.final_state_hash);

    // A record whose log was altered does not verify.
    const at = stored.events.findIndex((event) => event.name === 'place' && event.accepted);
    const altered: EpisodeRecord = {
      ...stored,
      events: stored.events.map((event, i) => {
        if (i !== at) return event;
        const args = event.args as { position_mm: number[] };
        return {
          ...event,
          args: {
            ...args,
            position_mm: [
              (args.position_mm[0] as number) + 25,
              args.position_mm[1] as number,
              args.position_mm[2] as number,
            ],
          },
        };
      }),
    };
    const forged = await verifyByReplay(altered, level);
    expect(forged.verified).toBe(false);
    expect(replay.checks).toEqual({ log: true, load: true, score: null });

    // A record whose log is true and whose score is not does not verify either: every item
    // marked clean, full points, and the load emptied (what a results table would average).
    const report = stored.report as NonNullable<EpisodeRecord['report']>;
    const points = new Map(level.items.map((item) => [item.id, item.points]));
    const boasted: EpisodeRecord = {
      ...stored,
      load: stored.load === null ? null : { ...stored.load, items: [] },
      report: {
        ...report,
        score: { ...report.score, points: 64 },
        items: report.items.map(
          (item) =>
            ({
              ...item,
              loaded: true,
              clean: true,
              points_awarded: points.get(item.item_id) ?? 0,
            }) as unknown as (typeof report.items)[number],
        ),
      },
      score: stored.score === null ? null : { ...stored.score, points: 64, share: 1 },
    };
    const caught = await verifyByReplay(boasted, level);
    expect(caught.verified).toBe(false);
    expect(caught.checks).toMatchObject({ log: true, load: false });
    expect(caught.mismatches.join('\n')).toMatch(/load: the recorded load/);
    expect(caught.mismatches.join('\n')).toMatch(
      /reported loaded, the replayed load says otherwise/,
    );
    expect(resultsTable([{ ...boasted, replay: caught }]).rows[0]).toMatchObject({
      scored: 0,
      unverified: 1,
      points: null,
    });
    // The table does not need the replay to leave it out: the record contradicts itself,
    // whatever verification it carries from before it was altered.
    expect(resultsTable([boasted]).rows[0]).toMatchObject({
      scored: 0,
      unverified: 1,
      verified: 0,
    });
    // A score that agrees with a report that is not of this load.
    const swapped = await verifyByReplay(
      { ...stored, report: { ...report, state_hash: 'sha256:another-load' } },
      level,
    );
    expect(swapped.verified).toBe(false);
    // A wash key that is not the key of the replayed load.
    const rekeyed = await verifyByReplay(
      {
        ...stored,
        wash: stored.wash === null ? null : { ...stored.wash, cache_key: 'f'.repeat(64) },
      },
      level,
    );
    expect(rekeyed.mismatches.join('\n')).toMatch(/wash\.cache_key/);
    // An event the game does not have.
    const invented = await verifyByReplay(
      {
        ...stored,
        events: [
          ...stored.events,
          {
            ...(stored.events[0] as EpisodeRecord['events'][number]),
            seq: stored.events.length,
            name: 'conjure' as never,
          },
        ],
      },
      level,
    );
    expect(invented.verified).toBe(false);

    // Washing the replayed load again is the check of the score itself.
    const honest = await verifyByReplay(stored, level, {
      rewash: (manifest) => {
        expect(manifest.load.state_hash).toBe(stored.load?.state_hash);
        return Promise.resolve({ ...report, job: { ...report.job, fidelity: 'fast' } });
      },
    });
    // (The placeholder's report names no tier that can be washed again: nothing is run.)
    expect(honest.checks?.score).toBeNull();
    const fast: EpisodeRecord = {
      ...stored,
      report: { ...report, job: { ...report.job, fidelity: 'fast' } },
    };
    const same = await verifyByReplay(fast, level, {
      rewash: () => Promise.resolve(fast.report as NonNullable<EpisodeRecord['report']>),
    });
    expect(same).toMatchObject({ verified: true, checks: { log: true, load: true, score: true } });
    const other = await verifyByReplay(fast, level, {
      rewash: () =>
        Promise.resolve({
          ...report,
          score: { ...report.score, points: report.score.points + 5 },
        }),
    });
    expect(other).toMatchObject({ verified: false, checks: { score: false } });
    expect(other.mismatches.join('\n')).toMatch(/rewash: recorded/);
    // Another result hash under the same verdicts: a note when the wash code is another, a
    // failure when it is the same (the wash is deterministic, and its hash no longer depends
    // on whether an exposure cache was used).
    const hashed = (version: string, hash: string): NonNullable<EpisodeRecord['report']> => ({
      ...report,
      job: { ...report.job, fidelity: 'fast', runner_version: version, result_hash: hash },
    });
    const recorded: EpisodeRecord = {
      ...stored,
      report: hashed('wash-runner 2+src.aaaa', 'sha256:1'),
    };
    const otherCode = await verifyByReplay(recorded, level, {
      rewash: () => Promise.resolve(hashed('wash-runner 2+src.bbbb', 'sha256:2')),
    });
    expect(otherCode).toMatchObject({ verified: true, checks: { score: true } });
    expect(otherCode.mismatches.join('\n')).toMatch(/another result hash under other wash code/);
    const sameCode = await verifyByReplay(recorded, level, {
      rewash: () => Promise.resolve(hashed('wash-runner 2+src.aaaa', 'sha256:2')),
    });
    expect(sameCode).toMatchObject({ verified: false, checks: { score: false } });
    expect(sameCode.mismatches.join('\n')).toMatch(/the wash did not repeat/);
    const repeated = await verifyByReplay(recorded, level, {
      rewash: () => Promise.resolve(hashed('wash-runner 2+src.aaaa', 'sha256:1')),
    });
    expect(repeated).toMatchObject({ verified: true, mismatches: [] });
    expect(forged.mismatches.length).toBeGreaterThan(0);

    // The game server wrote its own record of the same episode (what it writes for a person).
    expect(existsSync(dir)).toBe(true);
    expect(lines.join('\n')).toMatch(/planned \d+ calls/);
  });

  it('runs a batch and writes one table over levels and policies', async () => {
    const game = await harness.game();
    const outDir = harness.outDir();
    const batch = await runBatch({
      game,
      levels: ['tutorial'],
      policies: [
        () => scriptedPolicy('empty'),
        () => scriptedPolicy('random', { items: ['bowl_01', 'mug_01'] }),
      ],
      seeds: [3],
      outDir,
    });
    expect(batch.failures).toEqual([]);
    expect(batch.records.map((record) => record.policy?.name)).toEqual(['empty', 'random']);
    const empty = batch.records[0] as EpisodeRecord;
    expect(empty.events.map((event) => event.name)).toEqual(['start_cycle']);
    expect(empty.score).toMatchObject({ points: 0, items_loaded: 0 });
    expect(batch.records.every((record) => record.replay?.verified === true)).toBe(true);

    // The table is made from the directory of records, by the command as well.
    const fromDisk = readEpisodeRecords(outDir);
    expect(fromDisk.map((record) => record.episode_id).sort()).toEqual(
      batch.records.map((record) => record.episode_id).sort(),
    );
    const printed: string[] = [];
    expect(
      await main(['table', outDir], { out: (line) => printed.push(line), err: () => undefined }),
    ).toBe(0);
    const table = printed.join('\n');
    expect(table).toContain('| tutorial | empty | scripted |');
    expect(table).toContain('| tutorial | random | scripted |');
    expect(table).toContain(resultsMarkdown(batch.table).trimEnd());
    expect(JSON.parse(readFileSync(join(outDir, 'results.json'), 'utf8'))).toMatchObject({
      rows: [{ player: 'empty' }, { player: 'random' }],
    });
  });
});

describe('the model policy', () => {
  it('lets a scripted model play: one prompt, exactly the MCP tools, pictures pruned, record verified by replay', async () => {
    const game = await harness.game();
    const outDir = harness.outDir();
    const look = (n: number): ScriptedTurn => ({
      calls: [{ name: 'render', arguments: { view: 'top_lower', options: { size_px: 64 + n } } }],
    });
    const provider = scriptedProvider([
      { calls: [{ name: 'get_level', arguments: {} }], text: 'First the level.' },
      { calls: [{ name: 'get_item', arguments: { item_id: 'bowl_01' } }] },
      ...Array.from({ length: 6 }, (_, i) => look(i)),
      // Two calls in one turn, the first of them refused by the game.
      {
        calls: [
          { name: 'place', arguments: { ...BOWL, position_mm: [420, 270, -400] } },
          { name: 'place', arguments: BOWL },
        ],
      },
      { calls: [{ name: 'place', arguments: { ...BOWL, colour: 'red' } }] },
      { calls: [{ name: 'start_cycle', arguments: {} }], text: 'That will do.' },
    ]);
    const { record, dir } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider, images: { keep: 2, slack: 3 } }),
      outDir,
    });

    // The model was offered exactly the tools of the MCP server, described as the server describes them.
    const first = provider.requests[0];
    if (first === undefined) throw new Error('the provider was never asked');
    expect(first.tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(
      first.tools.every(
        (tool) => tool.description.length > 100 && tool.input_schema['type'] === 'object',
      ),
    ).toBe(true);
    // One system prompt with the rules, the manual and the guidance, the same on every turn.
    expect(first.system).toContain(LOADING_GUIDANCE);
    expect(first.system).toContain('Each item that comes out of the wash clean scores its points');
    expect(first.system).toContain('Frames. All frames are right-handed');
    // The level card stands in the prompt too (it is a free resource, and the one part of a
    // long conversation that is never taken out), without the rules it states in words.
    expect(first.system).toContain('"level_id":"tutorial"');
    expect(first.system).toContain('"item_types"');
    expect(first.system).not.toContain('"clean_definition"');
    expect(new Set(provider.requests.map((request) => request.system)).size).toBe(1);
    expect(first.history).toEqual([{ role: 'user', text: OPENING_MESSAGE }]);

    // The conversation keeps every text and only the most recent pictures (4 + 6 were returned).
    const last = provider.requests[provider.requests.length - 1];
    if (last === undefined) throw new Error('no last request');
    const results = last.history.flatMap((entry) => (entry.role === 'tool' ? entry.results : []));
    const pictures = results.flatMap((result) => result.images);
    expect(pictures).toHaveLength(10);
    const kept = pictures.filter((image) => !('removed' in image));
    expect(kept.length).toBeGreaterThanOrEqual(2);
    expect(kept.length).toBeLessThanOrEqual(5);
    expect(pictures.slice(0, 4).every((image) => 'removed' in image)).toBe(true);
    expect(kept.every((image) => 'data_base64' in image && image.data_base64 === DOT)).toBe(true);
    expect(results.every((result) => result.text.length > 0)).toBe(true);
    expect(results[0]?.text).toContain('"level_id":"tutorial"');
    // The model's own turns come back to it untouched.
    const turns = last.history.filter((entry) => entry.role === 'assistant');
    expect(turns[0]).toMatchObject({
      text: 'First the level.',
      native: { text: 'First the level.' },
    });

    // The record: every tool call, refused calls marked, pictures on disk, tokens summed.
    const calls = record.agent?.tool_calls ?? [];
    expect(calls.map((call) => call.name)).toEqual([
      'get_level',
      'get_item',
      ...Array.from({ length: 6 }, () => 'render'),
      'place',
      'place',
      'place',
      'start_cycle',
    ]);
    expect(calls.map((call) => call.is_error)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(calls[8]).toMatchObject({ accepted: false, reason: expect.any(String) as string });
    const files = calls.flatMap((call) => call.images);
    expect(files).toHaveLength(10);
    expect(readdirSync(join(dir, 'images')).sort()).toEqual(
      files.map((f) => f.replace('images/', '')).sort(),
    );
    expect(readFileSync(join(dir, files[0] as string)).toString('base64')).toBe(DOT);
    expect(record.agent).toMatchObject({
      interface: 'mcp/memory',
      turns: provider.requests.length,
      stopped: 'start_cycle',
      cycle_started_by_harness: false,
      transcript: 'transcript.json',
    });
    const usage = record.agent?.usage;
    expect(usage?.input_tokens).toBeGreaterThan(1000);
    expect(usage?.output_tokens).toBeGreaterThan(50);
    const transcript = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')) as {
      system: string;
      history: unknown[];
      turns: unknown[];
    };
    expect(transcript.system).toBe(first.system);
    expect(transcript.turns).toHaveLength(provider.requests.length);
    expect(JSON.stringify(transcript)).not.toContain(DOT);

    // The malformed call never reached the game; the refused one did and was logged as refused.
    expect(record.events.map((event) => `${event.name}${event.accepted ? '' : '!'}`)).toEqual([
      'get_level',
      'get_item',
      ...Array.from({ length: 6 }, () => 'render'),
      'place!',
      'place',
      'start_cycle',
    ]);
    expect(record.budget).toMatchObject({ actions_used: 1, queries_used: 8, washes_used: 1 });
    expect(record.counts).toMatchObject({ actions_accepted: 2, actions_rejected: 1 });
    expect(record.policy?.settings).toMatchObject({
      provider: 'scripted',
      context: { version: 'standard-2', images_kept: 2, images_slack: 3 },
      prompt_version: '3',
      // The tutorial allows 400 actions: as many turns.
      max_turns: 400,
    });

    // Verified by replaying the log in a fresh session.
    expect(record.replay).toMatchObject({ verified: true, method: 'replay' });
    expect(record.replay?.final_state_hash).toBe(record.final_state_hash);
    expect(record.score).toMatchObject({ items_loaded: 1, points_available: 64 });
  });

  it('keeps a long episode short: old turns folded into a note with the load, the record says how', async () => {
    const game = await harness.game();
    const outDir = harness.outDir();
    // 150 turns on one scene: the bowl goes in and comes out again and again, with a look at
    // the slots now and then. Far more conversation than the policy lets stand.
    const turns: ScriptedTurn[] = [];
    for (let i = 0; i < 50; i++) {
      turns.push({ calls: [{ name: 'place', arguments: BOWL }] });
      turns.push(
        i % 5 === 0
          ? {
              calls: [
                { name: 'list_slots', arguments: { rack: 'lower_rack', item_id: 'plate_01' } },
                { name: 'preview', arguments: { ...BOWL, item_id: 'mug_01' } },
              ],
            }
          : { calls: [{ name: 'preview', arguments: { ...BOWL, item_id: 'mug_01' } }] },
      );
      turns.push({ calls: [{ name: 'remove', arguments: { item_id: 'bowl_01' } }] });
    }
    turns.push({ calls: [{ name: 'place', arguments: BOWL }] });
    turns.push({ calls: [{ name: 'start_cycle', arguments: {} }] });
    const provider = scriptedProvider(turns);
    const context = {
      images: { keep: 4, slack: 4 },
      foldAbove: 3000,
      foldAboveNote: 2,
      keepRecent: 1200,
      hardLimit: 20_000,
      requestLimit: 1_000_000,
    };
    const { record, dir } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider, context }),
      outDir,
    });
    expect(record.agent).toMatchObject({ stopped: 'start_cycle', turns: 152 });
    expect(record.replay).toMatchObject({ verified: true });

    // No request carried more than the room for recent turns, the note and one turn.
    const sizes = provider.requests.map((request) =>
      request.history.reduce((sum, entry) => sum + entryTokens(entry), 0),
    );
    expect(Math.max(...sizes)).toBeLessThan(context.foldAbove + 1500);
    expect(sizes.length).toBe(152);
    // Between two folds a request is the one before it with more at its end.
    let folds = 0;
    for (let i = 1; i < provider.requests.length; i++) {
      const before = (provider.requests[i - 1] as { history: readonly unknown[] }).history;
      const now = (provider.requests[i] as { history: readonly unknown[] }).history;
      if (JSON.stringify(now[0]) === JSON.stringify(before[0])) {
        expect(now.length).toBeGreaterThan(before.length);
        expect(JSON.stringify(now.slice(0, before.length))).toBe(JSON.stringify(before));
      } else {
        folds += 1;
        expect((now[0] as { text: string }).text).toContain('Note of the harness');
        expect((now[0] as { text: string }).text.startsWith(OPENING_MESSAGE)).toBe(true);
      }
    }
    expect(folds).toBeGreaterThan(5);
    expect(folds).toBeLessThan(40);

    // The record names the policy and its version; the transcript has every turn, the
    // conversation as the last request carried it, and every fold.
    expect(record.policy?.settings).toMatchObject({
      context: {
        version: 'standard-2',
        fold_above_tokens: 3000,
        keep_recent_tokens: 1200,
      },
    });
    const transcript = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')) as {
      history: unknown[];
      conversation_at_end: { role: string; text?: string }[];
      context: { version: string; folds: { calls_folded: number; forced: boolean }[] };
      load_at_end: { placed: { rows: unknown[][] }; unplaced: string[]; phase: string };
      fixed_characters: { letters: number };
    };
    expect(transcript.context.version).toBe('standard-2');
    expect(transcript.context.folds).toHaveLength(folds);
    expect(transcript.context.folds.every((fold) => !fold.forced)).toBe(true);
    expect(transcript.history).toHaveLength(1 + 2 * 152);
    expect(transcript.conversation_at_end.length).toBeLessThan(40);
    expect(transcript.conversation_at_end[0]?.text).toContain('The scene after call');
    expect(transcript.fixed_characters.letters).toBeGreaterThan(10_000);
    // The harness's own copy of the load, kept from the results alone, is the load that was washed.
    expect(transcript.load_at_end.placed.rows.map((row) => row[0])).toEqual(['bowl_01']);
    expect(transcript.load_at_end.unplaced).toHaveLength(11);
    expect(record.load?.items.map((item) => item.item_id)).toEqual(['bowl_01']);
    const row = transcript.load_at_end.placed.rows[0] as [string, string, number[], number[]];
    const washed = record.load?.items[0];
    // (The record's load is in the tub frame; the copy in the frame the item was placed in.)
    expect(row[1]).toBe('lower_rack');
    expect(washed?.quat_wxyz.map((x) => Math.abs(x))).toEqual(row[3].map((x) => Math.abs(x)));
  });

  it('gives the scene in the note also when the first look of the model was a part of it', async () => {
    const game = await harness.game();
    // The model looks at one basket only, places, and then goes on until turns are folded:
    // the harness has the whole scene all the same (the first action carries it), and the
    // note says where the bowl is.
    const turns: ScriptedTurn[] = [
      { calls: [{ name: 'get_state', arguments: { rack: 'lower_rack' } }] },
      { calls: [{ name: 'place', arguments: BOWL }] },
    ];
    for (let i = 0; i < 12; i++) {
      turns.push({
        calls: [{ name: 'list_slots', arguments: { rack: 'lower_rack', item_id: 'plate_01' } }],
      });
      turns.push({
        calls: [
          {
            name: 'set_rack',
            arguments: {
              rack: 'upper_rack',
              option: { name: 'position', value: i % 2 === 0 ? 'out' : 'in' },
            },
          },
        ],
      });
    }
    turns.push({ calls: [{ name: 'start_cycle', arguments: {} }] });
    const provider = scriptedProvider(turns);
    const { record, dir } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({
        provider,
        context: {
          images: { keep: 4, slack: 4 },
          foldAbove: 2500,
          foldAboveNote: 2,
          keepRecent: 1000,
          hardLimit: 20_000,
          requestLimit: 1_000_000,
        },
      }),
      outDir: harness.outDir(),
    });
    expect(record.agent).toMatchObject({ stopped: 'start_cycle' });
    // The first action answered with the whole scene: a part of it is not the scene.
    const third = provider.requests[2];
    if (third === undefined) throw new Error('no third request');
    const placed = third.history.flatMap((entry) =>
      entry.role === 'tool' ? entry.results.filter((result) => result.name === 'place') : [],
    );
    expect(placed).toHaveLength(1);
    const first = JSON.parse(placed[0]?.text ?? '{}') as { state?: unknown; changes?: unknown };
    expect(first.state).toBeDefined();
    expect(first.changes).toBeUndefined();
    const transcript = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')) as {
      conversation_at_end: { role: string; text?: string; results?: { name: string }[] }[];
      context: { folds: { calls_folded_total: number }[] };
      load_at_end: { placed: { rows: unknown[][] }; unplaced: string[] } | null;
    };
    expect(transcript.context.folds.length).toBeGreaterThan(0);
    // The placement is among the calls taken out, and the note has the bowl.
    expect(
      transcript.conversation_at_end.some((entry) =>
        (entry.results ?? []).some((result) => result.name === 'place'),
      ),
    ).toBe(false);
    const note = transcript.conversation_at_end[0]?.text ?? '';
    expect(note).not.toContain('No result up to call');
    expect(note).not.toContain('no action had been accepted');
    const scene = /The scene after call \d+:\n(\{.*\})/.exec(note);
    expect(scene).not.toBeNull();
    const given = JSON.parse(scene?.[1] ?? '{}') as { placed: { rows: unknown[][] } };
    expect(given.placed.rows.map((row) => row[0])).toEqual(['bowl_01']);
    expect(transcript.load_at_end?.placed.rows.map((row) => row[0])).toEqual(['bowl_01']);
    expect(transcript.load_at_end?.unplaced).toHaveLength(11);
  });

  it('bounds a single turn: calls beyond what a turn has room for are put off, not made', async () => {
    const game = await harness.game();
    const provider = scriptedProvider([
      { calls: Array.from({ length: 8 }, () => ({ name: 'get_state', arguments: {} })) },
      { calls: [{ name: 'place', arguments: BOWL }] },
      { calls: [{ name: 'start_cycle', arguments: {} }] },
    ]);
    const { record, dir } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({
        provider,
        // A turn has room for some 600 estimated tokens here: two states of the empty scene.
        context: {
          images: { keep: 4, slack: 4 },
          foldAbove: 100_000,
          foldAboveNote: 0,
          keepRecent: 50_000,
          hardLimit: 600,
          requestLimit: 1_000_000,
        },
      }),
      outDir: harness.outDir(),
    });
    const second = provider.requests[1];
    if (second === undefined) throw new Error('no second request');
    const answers = second.history.flatMap((entry) =>
      entry.role === 'tool' ? entry.results.map((result) => result) : [],
    );
    // Every call of the turn has an answer; the first few were made, the rest were not.
    expect(answers).toHaveLength(8);
    const made = answers.filter((answer) => !answer.is_error);
    const putOff = answers.filter((answer) => answer.is_error);
    expect(made.length).toBeGreaterThanOrEqual(2);
    expect(made.length).toBeLessThan(8);
    expect(putOff.every((answer) => answer.text.includes('turn_too_large'))).toBe(true);
    expect(answers.map((answer) => answer.is_error)).toEqual(
      answers.map((_, i) => i >= made.length),
    );
    // What was not made is not in the game's log, and cost nothing.
    expect(record.events.filter((event) => event.name === 'get_state')).toHaveLength(made.length);
    expect(record.budget?.queries_used).toBe(made.length);
    const transcript = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')) as {
      context: { calls_not_run: number };
    };
    expect(transcript.context.calls_not_run).toBe(8 - made.length);
    expect(record.agent).toMatchObject({ stopped: 'start_cycle' });
  });

  it('gives a level as many turns as it allows actions, and never fewer than 400', () => {
    expect(standardMaxTurns(JSON.stringify({ rules: { budgets: { actions_max: 400 } } }))).toBe(
      400,
    );
    expect(standardMaxTurns(JSON.stringify({ rules: { budgets: { actions_max: 960 } } }))).toBe(
      960,
    );
    expect(standardMaxTurns(JSON.stringify({ rules: { budgets: { actions_max: 60 } } }))).toBe(400);
    expect(standardMaxTurns('not a card')).toBe(400);
    expect(STANDARD_MAX_TURNS).toBe(400);
  });

  it('reminds a model that stops early, and washes what is loaded when it stops for good', async () => {
    const game = await harness.game();
    const provider = scriptedProvider([
      { calls: [{ name: 'place', arguments: BOWL }] },
      { say: 'I think that is everything.' },
    ]);
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider, reminders: 2 }),
      outDir: harness.outDir(),
      verify: 'replay',
    });
    // Turn 1 places, turn 2 stops, two reminders, each answered with the same words.
    expect(provider.requests).toHaveLength(4);
    const last = provider.requests[3]?.history ?? [];
    expect(
      last.filter((entry) => entry.role === 'user' && entry.text === CONTINUE_MESSAGE),
    ).toHaveLength(2);
    expect(record.agent).toMatchObject({
      stopped: 'end_turn',
      cycle_started_by_harness: true,
      turns: 4,
    });
    expect(record.wash?.status).toBe('done');
    expect(record.score?.items_loaded).toBe(1);
    expect(record.replay?.verified).toBe(true);
  });

  it('stops at the turn limit and still washes the load', async () => {
    const game = await harness.game();
    const provider = scriptedProvider([{ calls: [{ name: 'get_state', arguments: {} }] }]);
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider, maxTurns: 3 }),
      outDir: harness.outDir(),
    });
    expect(record.agent).toMatchObject({
      stopped: 'turn_limit: 3 turns',
      turns: 3,
      cycle_started_by_harness: true,
    });
    expect(record.budget?.queries_used).toBe(3);
    expect(record.score).toMatchObject({ points: 0, items_loaded: 0 });
  });

  it('drops a turn cut off at the output limit and asks again; the episode goes on', async () => {
    const game = await harness.game();
    const provider = scriptedProvider([
      { say: 'Let me think about every item at great len', stop: 'max_tokens' },
      { calls: [{ name: 'place', arguments: BOWL }] },
      { say: 'and now the plates, which', stop: 'max_tokens' },
      { calls: [{ name: 'start_cycle', arguments: {} }] },
    ]);
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider }),
      outDir: harness.outDir(),
      verify: 'replay',
    });
    expect(provider.requests).toHaveLength(4);
    // The cut-off turn is not in the conversation; the model is told what happened.
    const second = provider.requests[1]?.history ?? [];
    expect(second.filter((entry) => entry.role === 'assistant')).toHaveLength(0);
    expect(second[second.length - 1]).toEqual({ role: 'user', text: TRUNCATED_MESSAGE });
    // The model itself started the cycle: its own result, not one of the harness's limit.
    expect(record.agent).toMatchObject({
      stopped: 'start_cycle',
      cycle_started_by_harness: false,
      turns: 4,
    });
    expect(record.score?.items_loaded).toBe(1);
    expect(record.replay?.verified).toBe(true);
  });

  it('ends as max_tokens only when turn after turn is cut off, and says so in the record', async () => {
    const game = await harness.game();
    const provider = scriptedProvider([{ say: 'thinking, thinking', stop: 'max_tokens' }]);
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider, truncationRetries: 2 }),
      outDir: harness.outDir(),
    });
    expect(provider.requests).toHaveLength(3);
    expect(record.agent?.stopped).toMatch(/^max_tokens/);
    expect(record.agent?.cycle_started_by_harness).toBe(true);
    // The table counts it as an episode a limit of the harness ended.
    expect(resultsTable([record]).rows[0]).toMatchObject({ limit_ended: 1 });
  });

  it('ends the episode when the action budget is used up, instead of running to the turn limit', async () => {
    const tutorial = starterLevels().find((level) => level.id === 'tutorial') as Level;
    const tight: Level = { ...tutorial, rules: { ...tutorial.rules, actionsMax: 1 } };
    const game = await harness.game({ levels: [tight] });
    const provider = scriptedProvider([
      { calls: [{ name: 'place', arguments: BOWL }] },
      { calls: [{ name: 'place', arguments: { ...BOWL, item_id: 'mug_01' } }] },
    ]);
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider, maxTurns: 12 }),
      outDir: harness.outDir(),
    });
    expect(provider.requests).toHaveLength(2);
    expect(record.agent?.stopped).toMatch(/^action_budget/);
    expect(record.agent?.cycle_started_by_harness).toBe(true);
    expect(record.wash?.status).toBe('done');
    expect(record.score?.items_loaded).toBe(1);
  });

  it('gives an episode no result when the provider fails', async () => {
    const game = await harness.game();
    let asked = 0;
    const failing: ModelProvider = {
      name: 'failing',
      model: 'none',
      settings: () => ({}),
      complete: () => {
        asked += 1;
        return Promise.reject(new ProviderError('rate_limit', 'too many requests', 429));
      },
    };
    const { record } = await runEpisode({
      game,
      levelId: 'tutorial',
      policy: llmPolicy({ provider: failing }),
      outDir: harness.outDir(),
    });
    expect(asked).toBe(1);
    expect(record.agent?.stopped).toBe('provider_error: rate_limit: too many requests');
    // Not washed and not scored: a failure of the API is not a load.
    expect(record.wash).toBeNull();
    expect(record.score).toBeNull();
    expect(record.events).toEqual([]);
  });
});
