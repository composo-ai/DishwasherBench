/**
 * One line an episode, for a directory of episode records: what the results table of the
 * harness says of a line of comparable episodes (`bench table`), said of each episode by
 * itself, with what a model's episode cost and how it went.
 *
 *   pnpm --filter @spotless/bench episode-table <dir> [--md <file>] [--json <file>]
 *
 * Read from each `record.json` (and the `transcript.json` beside a model's): the score and
 * what was loaded, the model's turns, tool calls and refused calls, the folds of the
 * conversation, the tokens (input the provider had not seen, input read from its cache,
 * input written to it, output, and the share of the output that was reasoning), the largest
 * request, the time the loading and the wash took, how the episode ended, and how it was
 * verified. A verification kept beside a record (`verify-rewash.json`, the answer of
 * `bench verify --rewash`) counts, as in the results table.
 *
 * Paths are taken from the directory the command is called in when they are relative
 * (`INIT_CWD` under pnpm), not from the package.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { EpisodeRecord } from '@spotless/server';
import { playerLabel, readEpisodeRecords } from '../src/results.ts';

/** One episode. */
export interface EpisodeLine {
  readonly episode_id: string;
  readonly created_at: string;
  readonly level_id: string;
  readonly player: string;
  readonly kind: string;
  readonly tier: string;
  readonly programme: string;
  readonly parameters: string;
  readonly points: number | null;
  readonly points_available: number;
  readonly points_loaded: number | null;
  readonly items_clean: number | null;
  readonly items_loaded: number | null;
  readonly items_total: number;
  readonly edge_items: number | null;
  /** Actions and queries charged to the budgets (a preview is logged and never charged). */
  readonly actions: number;
  readonly queries: number;
  /** Calls the game refused (of either kind). */
  readonly refused: number;
  /** A model's turns and tool calls; null for a scripted policy. */
  readonly turns: number | null;
  readonly tool_calls: number | null;
  readonly folds: number | null;
  readonly folds_forced: number | null;
  readonly largest_request_tokens: number | null;
  readonly tokens: {
    readonly input_fresh: number;
    readonly input_cached: number;
    readonly input_cache_written: number;
    readonly input_total: number;
    readonly output: number;
    readonly output_reasoning: number;
  } | null;
  readonly pictures: number | null;
  readonly loading_s: number | null;
  readonly wash_s: number | null;
  readonly stopped: string | null;
  readonly verified: { readonly log: boolean; readonly load: boolean; readonly score: boolean };
  readonly setup: string | null;
}

interface Transcript {
  readonly turns: readonly {
    readonly usage: {
      readonly input_tokens: number;
      readonly output_tokens: number;
      readonly cache_read_input_tokens: number;
      readonly cache_creation_input_tokens: number;
      readonly reasoning_output_tokens?: number;
    };
  }[];
  readonly context: {
    readonly folds: readonly { readonly forced: boolean }[];
    readonly largest_request_tokens: number;
  };
}

function lineOf(record: EpisodeRecord, transcript: Transcript | null): EpisodeLine {
  const { player, kind } = playerLabel(record);
  const score = record.score;
  const agent = record.agent as
    | {
        turns?: number;
        tool_calls?: readonly { images?: readonly string[] }[];
        stopped?: string;
      }
    | undefined;
  const model = transcript !== null;
  const sum = (pick: (usage: Transcript['turns'][number]['usage']) => number): number =>
    (transcript?.turns ?? []).reduce((total, turn) => total + pick(turn.usage), 0);
  const versions = record.versions as {
    sim_version?: string;
    harness?: string;
    interface?: { tools_digest?: string };
  };
  const parameters = /parameters ([^;]+)/.exec(versions.sim_version ?? '')?.[1] ?? 'unknown';
  const sim = /^([^;]+)/.exec(versions.sim_version ?? '')?.[1] ?? 'unknown';
  const fresh = sum((u) => u.input_tokens);
  const cached = sum((u) => u.cache_read_input_tokens);
  const written = sum((u) => u.cache_creation_input_tokens);
  return {
    episode_id: record.episode_id,
    created_at: record.created_at,
    level_id: record.level.id,
    player,
    kind,
    tier: record.wash?.tier ?? (score?.preview === true ? 'fast' : 'official'),
    programme: score?.programme_id ?? 'none',
    parameters: `${sim}, ${parameters}`,
    points: score?.points ?? null,
    points_available: score?.points_available ?? 0,
    points_loaded: score?.points_loaded ?? null,
    items_clean: score?.items_clean ?? null,
    items_loaded: score?.items_loaded ?? null,
    items_total: score?.items_total ?? 0,
    edge_items: score?.edge_items ?? null,
    actions: record.budget?.actions_used ?? record.counts.actions_accepted,
    queries: record.budget?.queries_used ?? record.counts.queries_accepted,
    refused: record.counts.actions_rejected + record.counts.queries_rejected,
    turns: model ? (agent?.turns ?? transcript.turns.length) : null,
    tool_calls: model ? (agent?.tool_calls?.length ?? null) : null,
    folds: model ? transcript.context.folds.length : null,
    folds_forced: model ? transcript.context.folds.filter((fold) => fold.forced).length : null,
    largest_request_tokens: model ? transcript.context.largest_request_tokens : null,
    tokens: model
      ? {
          input_fresh: fresh,
          input_cached: cached,
          input_cache_written: written,
          input_total: fresh + cached + written,
          output: sum((u) => u.output_tokens),
          output_reasoning: sum((u) => u.reasoning_output_tokens ?? 0),
        }
      : null,
    pictures: model
      ? (agent?.tool_calls ?? []).reduce((n, call) => n + (call.images?.length ?? 0), 0)
      : null,
    loading_s: record.time?.loading_s ?? null,
    wash_s: record.time?.wash_runtime_s ?? null,
    stopped: agent?.stopped ?? null,
    verified: {
      log: record.replay?.verified === true && record.replay.checks?.log !== false,
      load: record.replay?.verified === true && record.replay.checks?.load === true,
      score: record.replay?.verified === true && record.replay.checks?.score === true,
    },
    setup: model
      ? `${versions.harness ?? 'unknown'}, tools ${(versions.interface?.tools_digest ?? '').replace('sha256:', '').slice(0, 8)}`
      : null,
  };
}

const n = (value: number | null): string => (value === null ? '-' : value.toLocaleString('en-GB'));
const minutes = (seconds: number | null): string =>
  seconds === null
    ? '-'
    : Math.round(seconds) < 90
      ? `${Math.round(seconds)} s`
      : `${Math.floor(Math.round(seconds) / 60)} min ${String(Math.round(seconds) % 60).padStart(2, '0')} s`;

/** The lines as markdown: the scores of every player, then what the models' episodes took. */
export function episodeMarkdown(lines: readonly EpisodeLine[]): string {
  const out = [
    '| Level | Player | Points | Share | Loaded of offered | Clean of loaded | Points loaded | At the edge | Actions | Queries charged | Refused | Verified (log / load / second wash) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const line of lines) {
    const yes = (flag: boolean): string => (flag ? 'yes' : 'no');
    out.push(
      `| ${line.level_id} | ${line.player} | ${line.points === null ? 'not scored' : `${line.points} of ${line.points_available}`} | ${line.points === null || line.points_available === 0 ? '-' : `${((100 * line.points) / line.points_available).toFixed(1)} %`} | ${n(line.items_loaded)} of ${line.items_total} | ${n(line.items_clean)} of ${n(line.items_loaded)} | ${n(line.points_loaded)} | ${n(line.edge_items)} | ${line.actions} | ${line.queries} | ${line.refused} | ${yes(line.verified.log)} / ${yes(line.verified.load)} / ${yes(line.verified.score)} |`,
    );
  }
  const models = lines.filter((line) => line.tokens !== null);
  if (models.length > 0) {
    out.push(
      '',
      '| Level | Model | Turns | Tool calls | Refused | Folds (forced) | Pictures | Input: fresh | Input: read from cache | Input: written to cache | Input in all | Output | of it reasoning | Largest request | Loading | Wash | Ended by | Run with |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    );
    for (const line of models) {
      const tokens = line.tokens as NonNullable<EpisodeLine['tokens']>;
      out.push(
        `| ${line.level_id} | ${line.player} | ${n(line.turns)} | ${n(line.tool_calls)} | ${line.refused} | ${n(line.folds)} (${n(line.folds_forced)}) | ${n(line.pictures)} | ${n(tokens.input_fresh)} | ${n(tokens.input_cached)} | ${n(tokens.input_cache_written)} | ${n(tokens.input_total)} | ${n(tokens.output)} | ${n(tokens.output_reasoning)} | ${n(line.largest_request_tokens)} | ${minutes(line.loading_s)} | ${minutes(line.wash_s)} | ${line.stopped ?? '-'} | ${line.setup ?? '-'} |`,
      );
    }
  }
  return `${out.join('\n')}\n`;
}

/** Every episode under a directory, levels in the order given, players in a fixed order. */
export function episodeLines(dir: string, levelOrder: readonly string[] = []): EpisodeLine[] {
  const rank = (player: string): number => {
    const at = ['empty', 'random', 'careless', 'careful'].indexOf(player);
    return at < 0 ? 10 : at;
  };
  // The transcript of a model's episode is the file beside its record.
  const transcripts = new Map<string, Transcript>();
  const walk = (path: string): void => {
    const file = join(path, 'transcript.json');
    const record = join(path, 'record.json');
    if (existsSync(file) && existsSync(record)) {
      const id = (JSON.parse(readFileSync(record, 'utf8')) as { episode_id: string }).episode_id;
      transcripts.set(id, JSON.parse(readFileSync(file, 'utf8')) as Transcript);
    }
    for (const name of readdirSync(path)) {
      if (name === 'images' || name === 'node_modules') continue;
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  const records = readEpisodeRecords(dir);
  const level = (id: string): number => {
    const at = levelOrder.indexOf(id);
    return at < 0 ? levelOrder.length : at;
  };
  return records
    .map((record) => lineOf(record, transcripts.get(record.episode_id) ?? null))
    .sort(
      (a, b) =>
        level(a.level_id) - level(b.level_id) ||
        a.level_id.localeCompare(b.level_id) ||
        rank(a.player) - rank(b.player) ||
        a.player.localeCompare(b.player) ||
        a.created_at.localeCompare(b.created_at),
    );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { md: { type: 'string' }, json: { type: 'string' } },
  });
  const from = process.env['INIT_CWD'] ?? process.cwd();
  const dir = positionals[0];
  if (dir === undefined) {
    console.error('usage: episode-table <dir> [--md <file>] [--json <file>]');
    process.exit(2);
  }
  const { allLevels } = await import('@spotless/levels');
  const lines = episodeLines(
    resolve(from, dir),
    allLevels().map((level) => level.id),
  );
  const markdown = episodeMarkdown(lines);
  if (values.md !== undefined) writeFileSync(resolve(from, values.md), markdown);
  if (values.json !== undefined) {
    writeFileSync(resolve(from, values.json), `${JSON.stringify({ episodes: lines }, null, 2)}\n`);
  }
  console.log(markdown);
}
