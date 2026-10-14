/**
 * The results table: episode records, whoever played them, grouped into lines of comparable
 * episodes (one level digest, benchmark version, wash tier, programme, wash code and player)
 * and reduced to the figures of docs/research/benchmark.md section 10.3: raw points, share of
 * the points available, value loaded and yield, clean items of loaded items, actions, queries
 * and time, with what was left out of each mean and what was verified. As JSON and as a
 * markdown table.
 *
 * How verdicts are counted (decision 1 of benchmark.md section 9, taken here as the dossier
 * recommends): binary on the verdict, as the headline. Beside it every line says how
 * many loaded items were at the edge of clean or carried a provisional verdict, what they are
 * worth, and what the line would score with the edge items read either way; a fast wash is
 * marked a preview. The notes under the table say so in words.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { EpisodeRecord } from '@spotless/server';
import { isEpisodeRecord } from '@spotless/server';
import { recordInconsistencies } from './verify.ts';

/** One line of the table: the comparable episodes of one player on one level. */
export interface ResultRow {
  readonly level_id: string;
  /** `canonicalHash` of the level the episodes were played on. */
  readonly level_digest: string;
  readonly benchmark_version: string;
  /** The policy's name, or for a person the participant id. */
  readonly player: string;
  /** `human`, `agent` or `scripted`. */
  readonly kind: string;
  /** The tier the washes ran at (`none` for episodes without a report). */
  readonly fidelity: string;
  /** True for a line washed at the fast tier: a preview, not a result. */
  readonly preview: boolean;
  /** The programme the loads were washed on (`none` for episodes without a load). */
  readonly programme: string;
  /**
   * The code that ran the washes: the runner's version, which ends in a fingerprint of the
   * simulation's source (`none` without a report). Episodes washed by different code are
   * never averaged together.
   */
  readonly simulation: string;
  /**
   * How the episodes were run (`setupOf`): harness version, tool interface, and for a model
   * the prompt version and context policy; `none` for a person's episode.
   */
  readonly setup: string;
  /** Episodes behind the line. */
  readonly episodes: number;
  /** Episodes the means are over: scored, not failing verification, not a duplicate. */
  readonly scored: number;
  /** Episodes left out of the means: verification failed, or the record contradicts itself. */
  readonly unverified: number;
  /** Episodes left out as repeats of a deterministic policy with the same seed. */
  readonly duplicates: number;
  /** Episodes without a score: no report (the wash failed or never ran) or nothing simulated. */
  readonly unscored: number;
  /** Episodes whose last wash failed. */
  readonly wash_failed: number;
  /** Episodes with more than one wash (a failed wash was started again). */
  readonly rewashed: number;
  /** Episodes of a model that a limit of the harness ended (output limit, turn limit, action budget). */
  readonly limit_ended: number;
  /** Mean over the scored episodes; null when none is scored. */
  readonly points: number | null;
  readonly points_available: number;
  /** Mean share of the points available, 0 to 1. */
  readonly share: number | null;
  /**
   * Mean points if every loaded item at the edge of clean is read not clean (`strict`) and if
   * every one is read clean (`lenient`); null when no scored episode says (older records).
   */
  readonly points_strict: number | null;
  readonly points_lenient: number | null;
  /** Mean number of loaded items at the edge of clean, and what they are worth. */
  readonly edge_items: number | null;
  readonly edge_points: number | null;
  /** Mean number of loaded items with a provisional verdict, and what they are worth. */
  readonly provisional_items: number | null;
  readonly provisional_points: number | null;
  /**
   * V of benchmark.md equation 4 with the points available in place of the reference score
   * (no reference scores exist yet): mean points put in the machine over points available.
   */
  readonly value_loaded: number | null;
  /** Y of equation 5: mean share of the points put in the machine that came out clean. */
  readonly yield: number | null;
  readonly items_clean: number | null;
  readonly items_loaded: number | null;
  readonly items_total: number;
  /** Mean accepted actions, charged queries, and refused calls of either kind. */
  readonly actions: number;
  readonly queries: number;
  readonly rejected: number;
  /** Mean seconds from the player's arrival to the start of the cycle. */
  readonly loading_s: number | null;
  /** Mean seconds the wash computation took. */
  readonly wash_s: number | null;
  /** Model tokens, mean per episode (input, cache reads included, and output); null without a model. */
  readonly tokens_in: number | null;
  readonly tokens_out: number | null;
  /** Episodes whose action log was checked, and how many of those reproduced. */
  readonly replayed: number;
  readonly verified: number;
  /** Episodes whose load, report and score were shown to belong to the replayed scene. */
  readonly load_verified: number;
  /** Episodes whose replayed load was washed again and gave the recorded outcome. */
  readonly score_verified: number;
  /** The ids of the episodes. */
  readonly episode_ids: readonly string[];
}

/** The table. */
export interface ResultsTable {
  readonly benchmark_versions: readonly string[];
  readonly rows: readonly ResultRow[];
  /** What the table does not have, in words. */
  readonly notes: readonly string[];
}

/** How a record is named in the table: its policy, or the player it was created for. */
export function playerLabel(record: EpisodeRecord): { player: string; kind: string } {
  if (record.policy !== undefined) {
    return { player: record.policy.name, kind: record.player?.kind ?? 'agent' };
  }
  return { player: record.player?.name ?? 'unnamed', kind: record.player?.kind ?? 'human' };
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** The code that ran the wash of a record, as the group key and the table name it. */
function simulationOf(record: EpisodeRecord): string {
  if (record.report === null) return 'none';
  return (
    record.versions.wash_runner?.version ??
    record.versions.runner_version ??
    record.versions.sim_version ??
    'unknown'
  );
}

/**
 * How the episode of a record was run, as far as it decides what the player was shown and
 * kept: the harness, the tool interface, and for a model the prompt and the context policy.
 * Episodes that differ in any of it are not means of one thing, so they never share a line.
 */
export function setupOf(record: EpisodeRecord): string {
  if (record.versions.harness === undefined) return 'none';
  const settings = (record.policy?.settings ?? {}) as {
    prompt_version?: unknown;
    context?: { version?: unknown; text?: unknown };
  };
  const context =
    typeof settings.context?.version === 'string'
      ? settings.context.version
      : typeof settings.context?.text === 'string'
        ? `text-${settings.context.text}`
        : null;
  return [
    record.versions.harness.replace(/^spotless-bench\//, 'harness '),
    record.versions.interface === undefined
      ? 'tools not recorded'
      : `tools ${record.versions.interface.mcp_server.replace(/^spotless\//, '')} ${record.versions.interface.tools_digest.replace(/^sha256:/, '').slice(0, 8)}`,
    ...(typeof settings.prompt_version === 'string' ? [`prompt ${settings.prompt_version}`] : []),
    ...(context === null ? [] : [`context ${context}`]),
  ].join(', ');
}

/** The programme a record's load was washed on. */
function programmeOf(record: EpisodeRecord): string {
  return record.score?.programme_id ?? record.load?.programme_id ?? 'none';
}

/** True when a limit of the harness, not the player, ended the loading. */
function limitEnded(record: EpisodeRecord): boolean {
  return /^(max_tokens|turn_limit|action_budget|token_budget)/.test(record.agent?.stopped ?? '');
}

/**
 * Reduces episode records to the table. A line holds only episodes that can be compared: the
 * same level data (digest), benchmark version, wash tier, wash code, kind of player and
 * player. Its means are over the episodes that have a score, did not fail verification, and
 * are not a repeat of a deterministic policy with the same seed; the others are counted.
 */
export function resultsTable(records: readonly EpisodeRecord[]): ResultsTable {
  const groups = new Map<string, EpisodeRecord[]>();
  for (const record of [...records].sort((a, b) => (a.episode_id < b.episode_id ? -1 : 1))) {
    const label = playerLabel(record);
    const key = JSON.stringify([
      record.level.id,
      label.kind,
      label.player,
      record.versions.fidelity ?? 'none',
      programmeOf(record),
      simulationOf(record),
      record.benchmark_version,
      record.level.digest,
      setupOf(record),
    ]);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [record]);
    else group.push(record);
  }
  const rows: ResultRow[] = [];
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key) as EpisodeRecord[];
    const first = group[0] as EpisodeRecord;
    const label = playerLabel(first);
    // A record that failed its verification, or that contradicts itself whatever it says of
    // its verification, is counted and takes no part in a mean.
    const bad = new Set(
      group.filter((r) => r.replay?.verified === false || recordInconsistencies(r).length > 0),
    );
    const unverified = [...bad];
    // A scripted policy is a function of the level and its seed: a second run is the same
    // episode, not a second sample.
    const seen = new Set<string>();
    const duplicates = new Set<EpisodeRecord>();
    if (label.kind === 'scripted') {
      for (const record of group) {
        const seed = JSON.stringify(
          (record.policy?.settings as { seed?: unknown } | undefined)?.seed ?? null,
        );
        const fingerprint = `${seed} ${record.final_state_hash ?? ''}`;
        if (seen.has(fingerprint)) duplicates.add(record);
        else seen.add(fingerprint);
      }
    }
    const hasScore = (r: EpisodeRecord): boolean => r.score !== null && r.score.simulated;
    const scored = group.filter((r) => hasScore(r) && !bad.has(r) && !duplicates.has(r));
    const scores = scored.map((r) => r.score as NonNullable<EpisodeRecord['score']>);
    // The scores that say how their points were counted (records since 2026-10-11).
    const flagged = scores.filter((score) => score.counting !== undefined);
    const counted = group.filter((r) => !bad.has(r) && !duplicates.has(r));
    const withUsage = counted.filter((r) => r.agent?.usage !== undefined && r.agent.usage !== null);
    const loadings = counted.map((r) => r.time.loading_s).filter((x): x is number => x !== null);
    const washes = scored.map((r) => r.time.wash_runtime_s).filter((x): x is number => x !== null);
    const replays = group.filter((r) => r.replay !== undefined);
    rows.push({
      level_id: first.level.id,
      level_digest: first.level.digest,
      benchmark_version: first.benchmark_version,
      player: label.player,
      kind: label.kind,
      fidelity: first.versions.fidelity ?? 'none',
      preview: first.versions.fidelity === 'fast',
      programme: programmeOf(first),
      simulation: simulationOf(first),
      setup: setupOf(first),
      episodes: group.length,
      scored: scored.length,
      unverified: unverified.length,
      duplicates: duplicates.size,
      unscored: group.filter((r) => !hasScore(r)).length,
      wash_failed: group.filter((r) => r.wash?.status === 'failed').length,
      rewashed: group.filter((r) => (r.washes?.length ?? 0) > 1).length,
      limit_ended: group.filter(limitEnded).length,
      points: mean(scores.map((s) => s.points)),
      points_available: first.level.points_available,
      share: mean(scores.map((s) => s.share)),
      points_strict: mean(flagged.map((s) => s.points_strict ?? s.points)),
      points_lenient: mean(flagged.map((s) => s.points_lenient ?? s.points)),
      edge_items: mean(flagged.map((s) => s.edge_items ?? 0)),
      edge_points: mean(flagged.map((s) => s.edge_points ?? 0)),
      provisional_items: mean(flagged.map((s) => s.provisional_items ?? 0)),
      provisional_points: mean(flagged.map((s) => s.provisional_points ?? 0)),
      value_loaded: mean(
        scores.map((s) => (s.points_available > 0 ? s.points_loaded / s.points_available : 0)),
      ),
      yield: mean(scores.filter((s) => s.points_loaded > 0).map((s) => s.points / s.points_loaded)),
      items_clean: mean(scores.map((s) => s.items_clean)),
      items_loaded: mean(scores.map((s) => s.items_loaded)),
      items_total: first.level.items,
      actions: mean(counted.map((r) => r.budget?.actions_used ?? 0)) ?? 0,
      queries: mean(counted.map((r) => r.budget?.queries_used ?? 0)) ?? 0,
      rejected:
        mean(counted.map((r) => r.counts.actions_rejected + r.counts.queries_rejected)) ?? 0,
      loading_s: mean(loadings),
      wash_s: mean(washes),
      tokens_in: mean(
        withUsage.map((r) => {
          const u = r.agent?.usage as NonNullable<NonNullable<EpisodeRecord['agent']>['usage']>;
          return u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
        }),
      ),
      tokens_out: mean(withUsage.map((r) => r.agent?.usage?.output_tokens ?? 0)),
      replayed: replays.length,
      verified: replays.filter((r) => r.replay?.verified === true && !bad.has(r)).length,
      load_verified: replays.filter(
        (r) => r.replay?.verified === true && !bad.has(r) && r.replay.checks?.load === true,
      ).length,
      score_verified: replays.filter(
        (r) => r.replay?.verified === true && !bad.has(r) && r.replay.checks?.score === true,
      ).length,
      episode_ids: group.map((r) => r.episode_id),
    });
  }
  return {
    benchmark_versions: [...new Set(records.map((r) => r.benchmark_version))].sort(),
    rows,
    notes: [
      'Counting. Points are binary on the verdict of the standard inspector: an item that reads clean scores its points, any other loaded item scores nothing, whatever is flagged beside it. "At the edge of clean" are loaded items whose residue is seen by the strictest eye the inspection standard allows and not by the most lenient; they count by the verdict given, and "Strict to lenient" is what the line would score if every one of them were read not clean, and if every one were read clean. "Provisional" are loaded items whose verdict the parameters of the wash do not vouch for on the programme; they count by the verdict given too. Each is given as the number of items and the points they are worth.',
      'A line marked "preview" was washed at the fast tier, whose verdicts differ from those of the official tier on some items of a full load: it is not a benchmark result.',
      'No reference scores exist yet, so the normalised score N of benchmark.md section 5.1 is not computed; "Value loaded" is the points put in the machine over the points available (V with the points available in place of the reference score) and "Yield" the share of those that came out clean (Y).',
      'A line holds episodes of one level digest, benchmark version, tier, programme and wash code only, and of one way of running them ("Run with": the harness version, the MCP server version with the first characters of the digest of its tool list, and for a model the prompt version and the context policy): episodes that differ in any of these are on lines of their own. Its means leave out episodes that failed verification and repeats of a scripted policy with the same seed; both are counted under Left out.',
      'Verified: "log" means the action log reproduced every scene hash; "load" that the recorded load, report and score belong to the replayed scene; "score" that the replayed load was washed again and gave the recorded outcome. Only "score" covers the score itself; a run makes the first two, and the second wash is made afterwards with bench verify --rewash, whose answer kept beside a record (verify-rewash.json) is what the line then shows.',
    ],
  };
}

function number(value: number | null, digits = 0): string {
  if (value === null) return '-';
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
}

function duration(seconds: number | null): string {
  if (seconds === null) return '-';
  const total = Math.round(seconds);
  return total < 60
    ? `${total} s`
    : `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
}

/** The wash code of a line in a few characters: the fingerprint its version ends in. */
function shortSimulation(simulation: string): string {
  const at = simulation.indexOf('+src.');
  return at < 0 ? simulation : simulation.slice(at + 5, at + 13);
}

/** The table as markdown. */
export function resultsMarkdown(table: ResultsTable): string {
  const lines = [
    '| Level | Player | Kind | Run with | Episodes | Tier | Programme | Wash code | Points | Share of points | Strict to lenient | At the edge of clean | Provisional | Value loaded | Yield | Clean of loaded items | Items loaded of offered | Actions | Queries | Refused calls | Loading time | Wash time | Left out | Verified (log / load / score) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of table.rows) {
    const scored = row.scored > 0;
    const several = row.scored > 1;
    const left = [
      row.unverified > 0 ? `${row.unverified} unverified or inconsistent` : '',
      row.duplicates > 0 ? `${row.duplicates} duplicate` : '',
      row.wash_failed > 0 ? `${row.wash_failed} wash failed` : '',
      row.rewashed > 0 ? `${row.rewashed} washed twice (flag)` : '',
      row.limit_ended > 0 ? `${row.limit_ended} ended by a harness limit (flag)` : '',
    ].filter((part) => part !== '');
    lines.push(
      [
        '',
        row.level_id,
        row.player,
        row.kind,
        row.setup === 'none' ? '-' : row.setup,
        row.scored === row.episodes
          ? String(row.episodes)
          : `${row.episodes} (${row.scored} scored)`,
        row.preview ? `${row.fidelity} (preview)` : row.fidelity,
        row.programme,
        shortSimulation(row.simulation),
        scored ? `${number(row.points, several ? 1 : 0)} of ${row.points_available}` : 'not scored',
        scored ? `${number((row.share ?? 0) * 100, 1)}%` : '-',
        scored && row.points_strict !== null
          ? `${number(row.points_strict, several ? 1 : 0)} to ${number(row.points_lenient, several ? 1 : 0)}`
          : '-',
        scored && row.edge_items !== null
          ? `${number(row.edge_items, several ? 1 : 0)} (${number(row.edge_points, several ? 1 : 0)} pt)`
          : '-',
        scored && row.provisional_items !== null
          ? `${number(row.provisional_items, several ? 1 : 0)} (${number(row.provisional_points, several ? 1 : 0)} pt)`
          : '-',
        scored ? `${number((row.value_loaded ?? 0) * 100, 1)}%` : '-',
        scored && row.yield !== null ? `${number(row.yield * 100, 1)}%` : '-',
        scored
          ? `${number(row.items_clean, several ? 1 : 0)} of ${number(row.items_loaded, several ? 1 : 0)}`
          : '-',
        scored ? `${number(row.items_loaded, several ? 1 : 0)} of ${row.items_total}` : '-',
        number(row.actions, several ? 1 : 0),
        number(row.queries, several ? 1 : 0),
        number(row.rejected, several ? 1 : 0),
        duration(row.loading_s),
        duration(row.wash_s),
        left.length === 0 ? '-' : left.join(', '),
        row.replayed === 0
          ? 'not replayed'
          : `${row.verified} / ${row.load_verified} / ${row.score_verified} of ${row.replayed}`,
        '',
      ]
        .join(' | ')
        .trim(),
    );
  }
  return `${lines.join('\n')}\n\n${table.notes.map((note) => `- ${note}`).join('\n')}\n`;
}

/** The file a later verification of an episode is kept in, beside its `record.json`. */
export const LATER_VERIFICATION_FILE = 'verify-rewash.json';

/**
 * The record with the verification kept beside it in place of the one made in the run, when
 * there is one and it is of the same load: the line `bench verify <record> --rewash` prints
 * (replay of the log, and a second wash of the replayed load), saved as
 * `verify-rewash.json` in the directory of the record. A run verifies the log and the load;
 * only that second wash covers the score, and it is made afterwards. A file that is not a
 * verification, or is of another final scene than the record's, is ignored.
 */
function withLaterVerification(record: EpisodeRecord, directory: string): EpisodeRecord {
  const file = join(directory, LATER_VERIFICATION_FILE);
  if (!existsSync(file)) return record;
  let later: unknown;
  try {
    later = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch {
    return record;
  }
  if (later === null || typeof later !== 'object') return record;
  const replay = later as NonNullable<EpisodeRecord['replay']>;
  if (typeof replay.verified !== 'boolean' || replay.checks === undefined) return record;
  if (replay.final_state_hash !== record.final_state_hash) return record;
  return { ...record, replay };
}

/**
 * Every episode record under a directory, however deep: the harness's `record.json` files and
 * the records the server writes for people (`<data>/episodes/<id>.json`). When both exist for
 * an episode, the harness's (which has the policy and the replay) is kept.
 */
export function readEpisodeRecords(dir: string): EpisodeRecord[] {
  const found = new Map<string, EpisodeRecord>();
  const visit = (path: string): void => {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (name !== 'node_modules' && name !== 'images') visit(full);
        continue;
      }
      if (!name.endsWith('.json')) continue;
      let value: unknown;
      try {
        value = JSON.parse(readFileSync(full, 'utf8')) as unknown;
      } catch {
        continue;
      }
      if (!isEpisodeRecord(value)) continue;
      const held = found.get(value.episode_id);
      if (held === undefined || (held.policy === undefined && value.policy !== undefined)) {
        found.set(value.episode_id, withLaterVerification(value, path));
      }
    }
  };
  if (existsSync(dir)) visit(dir);
  return [...found.values()];
}
