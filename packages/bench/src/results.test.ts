// The results table over levels and players, people and policies alike.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EpisodeRecord } from '@spotless/server';
import { EPISODE_FORMAT } from '@spotless/server';
import { describe, expect, it } from 'vitest';
import { readEpisodeRecords, resultsMarkdown, resultsTable } from './results.ts';

function record(over: {
  id: string;
  level?: string;
  player: EpisodeRecord['player'];
  policy?: string;
  points: number | null;
  loaded?: number;
  clean?: number;
  actions?: number;
  queries?: number;
  loading?: number;
  simulated?: boolean;
  verified?: boolean;
  fidelity?: string;
  sim?: string;
  digest?: string;
  version?: string;
  seed?: number;
  stopped?: string;
  checks?: { log: boolean; load: boolean | null; score: boolean | null };
  /** What the game server adds to a score from the verdict summary of the report. */
  verdicts?: Partial<NonNullable<EpisodeRecord['score']>>;
}): EpisodeRecord {
  const available = 44;
  return {
    format: EPISODE_FORMAT,
    episode_id: over.id,
    benchmark_version: over.version ?? 'spotless-0.1.0/levels-starter',
    level: {
      id: over.level ?? 'tutorial',
      title: 'Tutorial',
      digest: over.digest ?? 'sha256:x',
      items: 7,
      points_available: available,
      track: 'one_shot',
    },
    player: over.player,
    ...(over.policy === undefined
      ? {}
      : {
          policy: {
            name: over.policy,
            settings: over.seed === undefined ? {} : { seed: over.seed },
          },
        }),
    ...(over.stopped === undefined
      ? {}
      : {
          agent: {
            interface: 'mcp/memory',
            tool_calls: [],
            images_dir: null,
            turns: 3,
            usage: null,
            stopped: over.stopped,
            cycle_started_by_harness: true,
            transcript: null,
          },
        }),
    versions: {
      benchmark_version: over.version ?? 'spotless-0.1.0/levels-starter',
      wash_runner:
        over.sim === undefined
          ? null
          : { module: '@spotless/wash-runner', export_name: 'simWashRunner', version: over.sim },
      fidelity: over.points === null ? null : (over.fidelity ?? 'fast'),
      sim_version: '0.2.0',
      runner_version: '1',
      guidance_version: '1',
    },
    created_at: '2026-10-10T05:00:00.000Z',
    opened_at: '2026-10-10T05:00:10.000Z',
    cycle_started_at: null,
    wash_ended_at: null,
    time: { loading_s: over.loading ?? null, wash_wall_s: 30, wash_runtime_s: 25 },
    events: [],
    counts: {
      actions_accepted: over.actions ?? 0,
      actions_rejected: 2,
      queries_accepted: over.queries ?? 0,
      queries_rejected: 1,
      by_name: {},
    },
    budget: {
      actions_used: over.actions ?? 0,
      actions_max: 60,
      queries_used: over.queries ?? 0,
      queries_max: 300,
      washes_used: 1,
      washes_max: 1,
    },
    final_state_hash: `sha256:${over.seed ?? over.id}`,
    load: null,
    prechecks: null,
    wash: null,
    // The table reads only whether there is a report.
    report: over.points === null ? null : ({} as EpisodeRecord['report']),
    score:
      over.points === null
        ? null
        : {
            points: over.points,
            points_available: available,
            share: over.points / available,
            points_loaded: 40,
            graded_points: over.points,
            items_total: 7,
            items_loaded: over.loaded ?? 6,
            items_clean: over.clean ?? 3,
            simulated: over.simulated ?? true,
            ...(over.verdicts ?? {}),
          },
    ...(over.verified === undefined
      ? {}
      : {
          replay: {
            verified: over.verified,
            method: 'replay' as const,
            events: 3,
            final_state_hash: 'sha256:y',
            mismatches: [],
            ...(over.checks === undefined ? {} : { checks: over.checks }),
          },
        }),
  };
}

describe('resultsTable', () => {
  const records = [
    record({
      id: 'a',
      player: { kind: 'scripted', name: 'careful' },
      policy: 'careful',
      points: 30,
      actions: 20,
      queries: 10,
      loading: 12,
      verified: true,
    }),
    record({
      id: 'b',
      player: { kind: 'scripted', name: 'careful' },
      policy: 'careful',
      points: 20,
      actions: 30,
      queries: 20,
      loading: 18,
      verified: true,
    }),
    record({
      id: 'c',
      player: { kind: 'human', name: 'P07', interface: 'web' },
      points: 36,
      loaded: 7,
      clean: 5,
      actions: 15,
      queries: 3,
      loading: 754,
    }),
    record({
      id: 'd',
      player: { kind: 'agent', name: 'anthropic:claude-opus-5-5' },
      policy: 'anthropic:claude-opus-5-5',
      points: null,
      actions: 4,
      queries: 9,
    }),
    record({
      id: 'e',
      level: 'weeknight-dinner',
      player: { kind: 'scripted', name: 'empty' },
      policy: 'empty',
      points: 0,
      loaded: 0,
      clean: 0,
      simulated: false,
    }),
  ];

  it('has one line per level and player, people and policies together, with means over episodes', () => {
    const table = resultsTable(records);
    expect(table.rows.map((row) => [row.level_id, row.kind, row.player, row.episodes])).toEqual([
      ['tutorial', 'agent', 'anthropic:claude-opus-5-5', 1],
      ['tutorial', 'human', 'P07', 1],
      ['tutorial', 'scripted', 'careful', 2],
      ['weeknight-dinner', 'scripted', 'empty', 1],
    ]);
    const careful = table.rows[2];
    expect(careful).toMatchObject({
      points: 25,
      points_available: 44,
      items_clean: 3,
      items_loaded: 6,
      actions: 25,
      queries: 15,
      rejected: 3,
      loading_s: 15,
      scored: 2,
      verified: 2,
      replayed: 2,
      episode_ids: ['a', 'b'],
    });
    // The mean of the two shares (30/44 and 20/44), to rounding.
    expect(careful?.share).toBeCloseTo(25 / 44, 12);
    // Points that came out clean over points that went in.
    expect(careful?.yield).toBeCloseTo((30 / 40 + 20 / 40) / 2, 12);
    // An episode without a report, and one whose wash was not simulated, have no score.
    expect(table.rows[0]).toMatchObject({ scored: 0, points: null, share: null });
    expect(table.rows[3]).toMatchObject({ scored: 0, points: null });
  });

  it('never puts episodes run in different ways on one line: harness, tools, prompt, context', () => {
    const model = (
      id: string,
      versions: Partial<EpisodeRecord['versions']>,
      settings: { [key: string]: unknown },
    ): EpisodeRecord => {
      const base = record({
        id,
        player: { kind: 'agent', name: 'openai:m', interface: 'mcp/memory' },
        policy: 'openai:m',
        points: 30,
        loaded: 40,
      });
      return {
        ...base,
        policy: { name: 'openai:m', settings: settings as never },
        versions: { ...base.versions, ...versions },
      };
    };
    const tools = (digest: string): NonNullable<EpisodeRecord['versions']['interface']> => ({
      mcp_server: 'spotless/0.2.0',
      tools: 13,
      tools_digest: digest,
    });
    const now = { prompt_version: '3', context: { version: 'standard-2' } };
    const table = resultsTable([
      // The whole conversation and the scene in every result, as the first episodes ran.
      model(
        'a1',
        { harness: 'spotless-bench/0.1.0' },
        { prompt_version: '1', context: { text: 'full' } },
      ),
      // Two episodes run alike.
      model('b1', { harness: 'spotless-bench/0.2.0', interface: tools('sha256:1111aaaa') }, now),
      model('b2', { harness: 'spotless-bench/0.2.0', interface: tools('sha256:1111aaaa') }, now),
      // A word of a tool description changed.
      model('c1', { harness: 'spotless-bench/0.2.0', interface: tools('sha256:2222bbbb') }, now),
      // Another prompt.
      model(
        'd1',
        { harness: 'spotless-bench/0.2.0', interface: tools('sha256:1111aaaa') },
        {
          ...now,
          prompt_version: '4',
        },
      ),
    ]);
    expect(table.rows.map((row) => row.episode_ids)).toHaveLength(4);
    expect(table.rows.map((row) => row.episode_ids.join(','))).toEqual(
      expect.arrayContaining(['a1', 'b1,b2', 'c1', 'd1']) as string[],
    );
    const setups = table.rows.map((row) => row.setup);
    expect(new Set(setups).size).toBe(4);
    expect(setups).toContain('harness 0.1.0, tools not recorded, prompt 1, context text-full');
    expect(setups).toContain('harness 0.2.0, tools 0.2.0 1111aaaa, prompt 3, context standard-2');
    expect(resultsMarkdown(table)).toContain('| Run with |');
  });

  it('prints as a markdown table with the columns of the benchmark', () => {
    const markdown = resultsMarkdown(resultsTable(records));
    const lines = markdown.trimEnd().split('\n');
    expect(lines[0]).toContain(
      '| Tier | Programme | Wash code | Points | Share of points | Strict to lenient | At the edge of clean | Provisional | Value loaded | Yield | Clean of loaded items |',
    );
    expect(lines.slice(0, 6).every((line) => line.startsWith('|'))).toBe(true);
    expect(lines[6]).toBe('');
    expect(lines[3]).toBe(
      // A fast wash is marked a preview. These records say nothing of a programme or of
      // flagged verdicts (records of before both were recorded): the cells are left open.
      '| tutorial | P07 | human | - | 1 | fast (preview) | none | 1 | 36 of 44 | 81.8% | - | - | - | 90.9% | 90.0% | 5 of 7 | 7 of 7 | 15 | 3 | 3 | 12 min 34 s | 25 s | - | not replayed |',
    );
    expect(lines[4]).toContain('| 25.0 of 44 | 56.8% | - | - | - | 90.9% | 62.5% | 3.0 of 6.0 |');
    expect(lines[4]).toContain('| 2 / 0 / 0 of 2 |');
    expect(lines[2]).toContain('| 1 (0 scored) |');
    expect(lines[2]).toContain('not scored');
    // The table says under itself how the points were counted and what a preview is.
    expect(markdown).toContain('- Counting. Points are binary on the verdict');
    expect(markdown).toContain('A line marked "preview" was washed at the fast tier');
  });

  it('shows the items at the edge of clean and the provisional ones beside the points, and keeps programmes apart', () => {
    const player = { kind: 'human', name: 'P09', interface: 'web' } as const;
    const flagged = [
      record({
        id: 'eco',
        player,
        points: 30,
        fidelity: 'official',
        verdicts: {
          counting: 'binary_on_verdict',
          programme_id: 'eco_50',
          programme_status: 'scored',
          preview: false,
          points_strict: 24,
          points_lenient: 38,
          edge_items: 2,
          edge_points: 14,
          provisional_items: 0,
          provisional_points: 0,
        },
      }),
      record({
        id: 'auto',
        player,
        points: 20,
        fidelity: 'official',
        verdicts: {
          counting: 'binary_on_verdict',
          programme_id: 'auto_145',
          programme_status: 'uncalibrated',
          preview: false,
          points_strict: 20,
          points_lenient: 20,
          edge_items: 0,
          edge_points: 0,
          provisional_items: 6,
          provisional_points: 40,
        },
      }),
    ];
    const table = resultsTable(flagged);
    // One player, one level, two programmes: two lines, never a mean over both.
    expect(table.rows.map((row) => [row.programme, row.programme_status, row.episodes])).toEqual([
      ['auto_145', 'uncalibrated', 1],
      ['eco_50', 'scored', 1],
    ]);
    const eco = table.rows[1];
    // The points are the verdicts as given; the band is beside them.
    expect(eco).toMatchObject({
      points: 30,
      points_strict: 24,
      points_lenient: 38,
      edge_items: 2,
      edge_points: 14,
      provisional_items: 0,
      preview: false,
    });
    const lines = resultsMarkdown(table).trimEnd().split('\n');
    expect(lines[2]).toContain(
      '| official | auto_145 (uncalibrated) | 1 | 20 of 44 | 45.5% | 20 to 20 | 0 (0 pt) | 6 (40 pt) |',
    );
    expect(lines[3]).toContain(
      '| official | eco_50 | 1 | 30 of 44 | 68.2% | 24 to 38 | 2 (14 pt) | 0 (0 pt) |',
    );
  });

  it('never averages what cannot be compared, and leaves unverified and repeated episodes out of the mean', () => {
    const scripted = { kind: 'scripted', name: 'random' } as const;
    const base = {
      player: scripted,
      policy: 'random',
      seed: 1,
      sim: 'wash-runner 1+src.aaaaaaaaaaaaaaaa',
    };
    const table = resultsTable([
      // The original: fast tier, 6 points.
      record({
        ...base,
        id: 'a',
        points: 6,
        verified: true,
        checks: { log: true, load: true, score: null },
      }),
      // Another tier, other wash code, another benchmark version and level digest.
      record({
        ...base,
        id: 'b',
        points: 30,
        fidelity: 'official',
        sim: 'wash-runner 1+src.bbbbbbbbbbbbbbbb',
        version: 'spotless-0.2.0/levels-starter',
        digest: 'sha256:other',
        verified: true,
      }),
      // A plain repeat of the first (same policy, same seed, same final state).
      record({ ...base, id: 'c', points: 6, verified: true }),
      // One whose replay failed, with a perfect score.
      record({ ...base, id: 'd', seed: 2, points: 44, verified: false }),
      // The same code at the same tier, another seed: a second sample.
      record({
        ...base,
        id: 'e',
        seed: 3,
        points: 10,
        verified: true,
        checks: { log: true, load: true, score: true },
      }),
      // A model whose episode a limit of the harness ended.
      record({
        id: 'f',
        player: { kind: 'agent', name: 'm' },
        policy: 'm',
        points: 4,
        sim: base.sim,
        stopped: 'max_tokens: 3 turns in a row were cut off',
      }),
    ]);
    const random = table.rows.filter((row) => row.player === 'random');
    expect(random.map((row) => [row.fidelity, row.episodes, row.scored, row.points])).toEqual([
      ['fast', 4, 2, 8],
      ['official', 1, 1, 30],
    ]);
    expect(random[0]).toMatchObject({
      unverified: 1,
      duplicates: 1,
      simulation: 'wash-runner 1+src.aaaaaaaaaaaaaaaa',
      replayed: 4,
      verified: 3,
      load_verified: 2,
      score_verified: 1,
      episode_ids: ['a', 'c', 'd', 'e'],
    });
    expect(random[1]).toMatchObject({ level_digest: 'sha256:other', points_available: 44 });
    const markdown = resultsMarkdown(table);
    expect(markdown).toContain('1 unverified or inconsistent, 1 duplicate');
    expect(markdown).toContain('| 3 / 2 / 1 of 4 |');
    expect(markdown).toContain('| aaaaaaaa |');
    expect(table.rows.find((row) => row.player === 'm')).toMatchObject({ limit_ended: 1 });
    expect(markdown).toContain('1 ended by a harness limit (flag)');
  });

  it('reads records from a directory tree, preferring the harness record of an episode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spotless-results-'));
    try {
      mkdirSync(join(dir, 'run', 'tutorial__careful'), { recursive: true });
      mkdirSync(join(dir, 'server-data', 'episodes'), { recursive: true });
      const harness = records[0] as EpisodeRecord;
      const { policy: _policy, replay: _replay, ...server } = harness;
      writeFileSync(join(dir, 'run', 'tutorial__careful', 'record.json'), JSON.stringify(harness));
      writeFileSync(join(dir, 'server-data', 'episodes', 'a.json'), JSON.stringify(server));
      writeFileSync(join(dir, 'server-data', 'episodes', 'c.json'), JSON.stringify(records[2]));
      writeFileSync(join(dir, 'run', 'results.json'), JSON.stringify({ rows: [] }));
      writeFileSync(join(dir, 'run', 'notes.json'), 'not json');
      const read = readEpisodeRecords(dir);
      expect(read.map((r) => r.episode_id).sort()).toEqual(['a', 'c']);
      expect(read.find((r) => r.episode_id === 'a')?.policy?.name).toBe('careful');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('takes a later verification kept beside a record, when it is of the same load', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spotless-results-'));
    try {
      const harness = records[0] as EpisodeRecord;
      const made = {
        verified: true,
        method: 'replay',
        events: 3,
        final_state_hash: harness.final_state_hash,
        mismatches: [],
        checks: { log: true, load: true, score: null },
      };
      const one = join(dir, 'one');
      const other = join(dir, 'other');
      mkdirSync(one);
      mkdirSync(other);
      writeFileSync(join(one, 'record.json'), JSON.stringify({ ...harness, replay: made }));
      writeFileSync(
        join(one, 'verify-rewash.json'),
        JSON.stringify({ ...made, checks: { log: true, load: true, score: true } }),
      );
      // Of another scene: not this episode's verification, so the record keeps its own.
      writeFileSync(
        join(other, 'record.json'),
        JSON.stringify({ ...harness, episode_id: 'other', replay: made }),
      );
      writeFileSync(
        join(other, 'verify-rewash.json'),
        JSON.stringify({
          ...made,
          final_state_hash: 'sha256:another',
          checks: { log: true, load: true, score: true },
        }),
      );
      const read = readEpisodeRecords(dir);
      const score = (id: string): unknown =>
        read.find((r) => r.episode_id === id)?.replay?.checks?.score;
      expect(score(harness.episode_id)).toBe(true);
      expect(score('other')).toBeNull();
      expect(resultsTable(read).rows.reduce((sum, row) => sum + row.score_verified, 0)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
