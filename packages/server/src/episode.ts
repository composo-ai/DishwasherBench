/**
 * The episode record: one JSON document per episode, the same for a person playing through
 * the web client, a scripted policy and a model, so that all of them appear in one results
 * table (docs/research/benchmark.md sections 4.8 and 6.5).
 *
 * The server writes it for every session when its wash ends (`<data>/episodes/<id>.json`) and
 * builds it on request for the harness, which adds what only it knows: the policy and its
 * settings, the tool calls as the agent made them, the pictures it was sent, the model's
 * tokens, and the outcome of replaying the action log.
 *
 * What is recorded of a player is what they did, with times: the semantic action log. No
 * mouse trace, no video, no free text. The wash seed is never in a record.
 */

import type { JsonValue } from '@spotless/core';
import { canonicalHash } from '@spotless/core';
import type { Level } from '@spotless/levels';
import type {
  ActionLogEvent,
  BudgetState,
  LoadCheck,
  LoadManifest,
  WashManifest,
  WashReport,
} from '@spotless/session';
import { LOADING_GUIDANCE_VERSION } from './guidance.ts';
import type { StoredSession } from './store.ts';
import type { WashJobRecord, WashRunnerIdentity } from './types.ts';

/** Format tag of an episode record. */
export const EPISODE_FORMAT = 'spotless-episode/1';

/** Who played an episode. */
export interface EpisodePlayer {
  /**
   * `human`: a person; `agent`: a model playing through the tools; `scripted`: a reference
   * policy (code that plays through the same interface).
   */
  readonly kind: 'human' | 'agent' | 'scripted';
  /**
   * For a person the participant id the study gave them (a pseudonym: no real names in the
   * data); for a model or a policy its name.
   */
  readonly name: string;
  /** How the player reached the game: `web` (the 3D client), `mcp`, `http`. */
  readonly interface?: string;
}

/** One call of the episode as the session logged it, with the time the server wrote it. */
export interface EpisodeEvent extends ActionLogEvent {
  /** Wall-clock time the event was written (ISO 8601). */
  readonly at: string;
}

/** Calls by name. */
export interface EpisodeCounts {
  /** State-changing actions the session accepted and refused. */
  readonly actions_accepted: number;
  readonly actions_rejected: number;
  /** Queries the session answered and refused (`get_report` polls included). */
  readonly queries_accepted: number;
  readonly queries_rejected: number;
  /** The same by tool name. */
  readonly by_name: {
    readonly [name: string]: { readonly accepted: number; readonly rejected: number };
  };
}

/** What the episode scored. Null in a record while there is no report. */
export interface EpisodeScore {
  /** Points: the sum of the points of the items that came out clean. */
  readonly points: number;
  readonly points_available: number;
  /** Points over points available, 0 to 1. */
  readonly share: number;
  /** Points of the items that were washed. */
  readonly points_loaded: number;
  readonly graded_points: number;
  readonly items_total: number;
  readonly items_loaded: number;
  readonly items_clean: number;
  /** False when the wash was not simulated (the placeholder runner): the zeros are not results. */
  readonly simulated: boolean;
  /**
   * How the points were counted and what could have gone the other way, from the report's
   * verdict summary (`WashVerdictSummary`); absent for a report that has none.
   *  - `counting`: `binary_on_verdict`: every item counts by the verdict given, flagged or not;
   *  - `points_strict`, `points_lenient`: the points if every loaded item at the edge of clean
   *    is read not clean, and if every one is read clean;
   *  - `edge_items`, `edge_points`: loaded items at the edge of clean and what they are worth;
   *  - `provisional_items`, `provisional_points`: loaded items whose verdict the parameters of
   *    the wash do not vouch for, and what they are worth;
   *  - `preview`: the wash ran at the fast tier;
   *  - `programme_id`, `programme_status`: the programme washed on, always the one the level
   *    is scored on (`scored`).
   */
  readonly counting?: 'binary_on_verdict';
  readonly points_strict?: number;
  readonly points_lenient?: number;
  readonly edge_items?: number;
  readonly edge_points?: number;
  readonly provisional_items?: number;
  readonly provisional_points?: number;
  readonly preview?: boolean;
  readonly programme_id?: string;
  readonly programme_status?: 'scored';
}

/** One tool call as the agent made it (harness records). */
export interface EpisodeToolCall {
  readonly index: number;
  readonly name: string;
  readonly arguments: JsonValue;
  /** True when the tool answered with an error (a malformed call that never reached the game). */
  readonly is_error: boolean;
  /** `accepted` of the result, or null when the result has none. */
  readonly accepted: boolean | null;
  /** The rejection reason of a result that was not accepted. */
  readonly reason?: string;
  /** `'sha256:<hex>'` of the canonical JSON of the structured result, images left out. */
  readonly result_digest: string;
  /** Files of the pictures the call returned, relative to the record's directory. */
  readonly images: readonly string[];
  readonly started_at: string;
  readonly duration_ms: number;
}

/** Tokens a model used over an episode. */
export interface EpisodeUsage {
  /** Input tokens that were neither read from the provider's cache nor written to it. */
  readonly input_tokens: number;
  /** Everything the model wrote, reasoning included. */
  readonly output_tokens: number;
  readonly cache_read_input_tokens: number;
  readonly cache_creation_input_tokens: number;
  /** The share of `output_tokens` that was reasoning, where the provider states it. */
  readonly reasoning_output_tokens?: number;
}

/** What the harness adds about the agent's side of an episode. */
export interface EpisodeAgentSection {
  /** `mcp/memory`, `mcp/stdio`, `mcp/http`. */
  readonly interface: string;
  readonly tool_calls: readonly EpisodeToolCall[];
  /** Directory of the saved pictures, relative to the record's directory; null when none. */
  readonly images_dir: string | null;
  /** Model turns taken (0 for a scripted policy). */
  readonly turns: number;
  /** Tokens, summed over the turns; null for a scripted policy. */
  readonly usage: EpisodeUsage | null;
  /** Why the policy stopped: `start_cycle`, `end_turn`, `turn_limit`, `refusal`, ... */
  readonly stopped: string;
  /** True when the harness started the cycle because the policy stopped without doing so. */
  readonly cycle_started_by_harness: boolean;
  /** File of the full transcript, relative to the record's directory; null when none. */
  readonly transcript: string | null;
}

/** The outcome of verifying an episode by replaying its action log. */
export interface EpisodeReplay {
  readonly verified: boolean;
  /**
   * `replay`: the log was applied to a fresh session and every hash compared.
   * `policy_session`: a scripted policy's own session, which made the same calls in the same
   * order before they were issued to the server, gave the same hash after every event.
   */
  readonly method: 'replay' | 'policy_session';
  /** Events compared. */
  readonly events: number;
  readonly final_state_hash: string;
  /** The first differences found, in words. */
  readonly mismatches: readonly string[];
  /**
   * What the verification covers (absent in records of older harnesses, which checked the
   * hashes of the log only).
   *  - `load`: the record's load, the hash its report names and the items the report calls
   *    loaded are those of the replayed scene, the record's score is the score of its report,
   *    the report's points follow from its own verdicts, and the wash key the record names is
   *    the key of the replayed load. Null when the episode started no cycle.
   *  - `score`: the replayed load was washed again and gave the verdicts and points the
   *    record reports (`true`), or did not (`false`); null when it was not washed again. Only
   *    `true` means that nobody has to trust the reported score.
   */
  readonly checks?: {
    readonly log: boolean;
    readonly load: boolean | null;
    readonly score: boolean | null;
  };
}

/** One wash of an episode: an accepted `start_cycle` and how its wash ended. */
export interface EpisodeWash {
  readonly job_id: string;
  readonly status: 'done' | 'failed';
  readonly cache_key: string;
  /** State hash of the load the cycle was started on (of the accepted `start_cycle`). */
  readonly state_hash: string | null;
  readonly error?: string;
  /** Wall-clock time the wash ended (ISO 8601). */
  readonly at: string;
}

/** An episode. */
export interface EpisodeRecord {
  readonly format: typeof EPISODE_FORMAT;
  /** The session id. */
  readonly episode_id: string;
  readonly benchmark_version: string;
  readonly level: {
    readonly id: string;
    readonly title: string;
    /** `canonicalHash` of the level data. */
    readonly digest: string;
    readonly items: number;
    readonly points_available: number;
    readonly track: string;
    /** The programme the level is scored on (absent in records made before 2026-10-11). */
    readonly programme_id?: string;
    /** For a generated level: the family it was drawn from. */
    readonly family?: string;
  };
  readonly player: EpisodePlayer | null;
  /** The policy that played and its settings (harness); absent for a person. */
  readonly policy?: { readonly name: string; readonly settings: JsonValue };
  readonly versions: {
    readonly benchmark_version: string;
    /**
     * Which code ran the wash: the runner with the version the worker found once the wash was
     * over (it ends in a fingerprint of the simulation's source), not the one it was keyed by.
     */
    readonly wash_runner: WashRunnerIdentity | null;
    /** The version the wash was keyed by, when the worker ran another (local play only). */
    readonly wash_keyed_by?: string;
    /** The tier of the wash and the versions the report names. */
    readonly fidelity: string | null;
    readonly sim_version: string | null;
    readonly runner_version: string | null;
    /** Version of the generic loading guidance the player was shown. */
    readonly guidance_version: string;
    /** The harness that ran the episode, when one did. */
    readonly harness?: string;
    /**
     * The tool interface the player was given (records of harness 0.2.0 on): name and version
     * of the MCP server, and a digest of the tools as it listed them (names, titles,
     * descriptions, input and output schemas) and of its instructions, so that a change of a
     * single word of a description shows in the record.
     */
    readonly interface?: {
      readonly mcp_server: string;
      readonly tools: number;
      readonly tools_digest: string;
    };
  };
  /** Wall-clock times (ISO 8601). */
  readonly created_at: string;
  /** When the player first reached the session (first socket or first call); null if never. */
  readonly opened_at: string | null;
  /** When the cycle was started; null if it was not. */
  readonly cycle_started_at: string | null;
  readonly wash_ended_at: string | null;
  readonly time: {
    /** Seconds from the player's arrival to the start of the cycle (to the last event if none). */
    readonly loading_s: number | null;
    /** Seconds the wash took from the start of the cycle to its end, waiting included. */
    readonly wash_wall_s: number | null;
    /** Seconds the wash computation itself took, as the report says. */
    readonly wash_runtime_s: number | null;
  };
  readonly events: readonly EpisodeEvent[];
  readonly counts: EpisodeCounts;
  /** The budget counters after the last event. */
  readonly budget: BudgetState | null;
  readonly final_state_hash: string | null;
  /** The frozen load (rounded poses, no seed) and what the pre-checks found; null before the cycle. */
  readonly load: LoadManifest | null;
  readonly prechecks: LoadCheck | null;
  readonly wash: {
    readonly job_id: string;
    readonly status: 'done' | 'failed';
    readonly cache_key: string;
    readonly cached: boolean | null;
    /** The tier the wash was asked for (part of its key), when the server still knows. */
    readonly tier?: string;
    readonly error?: string;
    /**
     * Present when the delivered report was lost and the load was washed again on a restore
     * (local play only): the code that ran the second wash. The report is that second one.
     */
    readonly rewashed_with?: string;
  } | null;
  /**
   * Every wash of the episode in order, failed ones included, each with the hash of the load
   * it was started on. More than one entry means a wash was started again.
   */
  readonly washes?: readonly EpisodeWash[];
  readonly report: WashReport | null;
  readonly score: EpisodeScore | null;
  /** Harness: the agent's side of the episode. */
  readonly agent?: EpisodeAgentSection;
  /** Harness: the verification by replay. */
  readonly replay?: EpisodeReplay;
}

/** The score of a report. */
export function scoreOf(report: WashReport): EpisodeScore {
  let loaded = 0;
  let clean = 0;
  let simulated = true;
  for (const item of report.items) {
    if (!item.loaded) continue;
    loaded += 1;
    if (item.clean) clean += 1;
    if (item.simulated === false) simulated = false;
  }
  const available = report.score.points_available;
  return {
    points: report.score.points,
    points_available: available,
    share: available > 0 ? report.score.points / available : 0,
    points_loaded:
      report.score.points_loaded ??
      report.items.reduce((sum, item) => sum + (item.loaded ? item.points_awarded : 0), 0),
    graded_points: report.score.graded_points,
    items_total: report.items.length,
    items_loaded: loaded,
    items_clean: clean,
    simulated: simulated && report.job.fidelity !== 'placeholder_not_simulated',
    ...(report.verdicts === undefined
      ? {}
      : {
          counting: report.verdicts.counting,
          points_strict: report.verdicts.points_strict,
          points_lenient: report.verdicts.points_lenient,
          edge_items: report.verdicts.edge.length,
          edge_points: report.verdicts.edge.reduce((sum, item) => sum + item.points, 0),
          provisional_items: report.verdicts.all_provisional
            ? loaded
            : report.verdicts.provisional.length,
          provisional_points: report.verdicts.all_provisional
            ? (report.score.points_loaded ?? 0)
            : report.verdicts.provisional.reduce((sum, item) => sum + item.points, 0),
          preview: report.verdicts.preview,
          programme_id: report.verdicts.programme_id,
          programme_status: report.verdicts.programme_status,
        }),
  };
}

/** Counts of the calls of a log. */
export function countsOf(events: readonly ActionLogEvent[]): EpisodeCounts {
  const byName: { [name: string]: { accepted: number; rejected: number } } = {};
  let actionsAccepted = 0;
  let actionsRejected = 0;
  let queriesAccepted = 0;
  let queriesRejected = 0;
  for (const event of events) {
    const entry = (byName[event.name] ??= { accepted: 0, rejected: 0 });
    if (event.accepted) entry.accepted += 1;
    else entry.rejected += 1;
    if (event.kind === 'action') {
      if (event.accepted) actionsAccepted += 1;
      else actionsRejected += 1;
    } else if (event.accepted) queriesAccepted += 1;
    else queriesRejected += 1;
  }
  const sorted: { [name: string]: { accepted: number; rejected: number } } = {};
  for (const name of Object.keys(byName).sort()) {
    sorted[name] = byName[name] as { accepted: number; rejected: number };
  }
  return {
    actions_accepted: actionsAccepted,
    actions_rejected: actionsRejected,
    queries_accepted: queriesAccepted,
    queries_rejected: queriesRejected,
    by_name: sorted,
  };
}

function seconds(from: string | null, to: string | null): number | null {
  if (from === null || to === null) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 100) / 10);
}

/** What {@link buildEpisodeRecord} is given. */
export interface EpisodeSource {
  readonly sessionId: string;
  readonly level: Level;
  /** The session's file: header, events with their times, wash outcomes, notes. */
  readonly stored: StoredSession;
  /** The manifest of the load that was washed (or is being washed); null before the cycle. */
  readonly manifest: WashManifest | null;
  /** The report of the last wash that ended well; null when there is none. */
  readonly report: WashReport | null;
  /** The queue's record of that wash, when the server still has it. */
  readonly job: WashJobRecord | null;
  readonly runner: WashRunnerIdentity | null;
}

/**
 * The record of an episode from what the server holds of it. A pure function of its input:
 * the times come from the session file, where the server wrote them as the events happened.
 */
export function buildEpisodeRecord(source: EpisodeSource): EpisodeRecord {
  const { stored, level, report } = source;
  const events: EpisodeEvent[] = [];
  let lastWash: Extract<StoredSession['lines'][number], { type: 'wash' }> | null = null;
  let cycleStartedAt: string | null = null;
  let cycleHash: string | null = null;
  const washes: EpisodeWash[] = [];
  for (const line of stored.lines) {
    if (line.type === 'event') {
      events.push({ ...line.event, at: line.at });
      if (line.event.name === 'start_cycle' && line.event.accepted) {
        cycleStartedAt = line.at;
        cycleHash = line.event.state_hash;
      }
    } else {
      lastWash = line;
      washes.push({
        job_id: line.job_id,
        status: line.status,
        cache_key: line.cache_key,
        state_hash: cycleHash,
        ...(line.error === undefined ? {} : { error: line.error }),
        at: line.at,
      });
      cycleHash = null;
    }
  }
  const rewashed =
    lastWash === null
      ? undefined
      : [...stored.rewashed].reverse().find((entry) => entry.job_id === lastWash?.job_id);
  const keyed = source.job?.runner ?? source.runner;
  const ranWith = rewashed?.ran_with ?? source.job?.ran_with;
  const washRunner =
    keyed === null || ranWith === undefined || ranWith === keyed.version
      ? keyed
      : { ...keyed, version: ranWith };
  const last = events[events.length - 1];
  const firstAt = events[0]?.at ?? null;
  const opened = stored.opened_at ?? firstAt;
  const openedAt =
    opened !== null && firstAt !== null && Date.parse(firstAt) < Date.parse(opened)
      ? firstAt
      : opened;
  const washEndedAt = lastWash?.at ?? null;
  return {
    format: EPISODE_FORMAT,
    episode_id: source.sessionId,
    benchmark_version: stored.header.benchmark_version,
    level: {
      id: level.id,
      title: level.title,
      digest: canonicalHash(level),
      items: level.items.length,
      points_available: level.items.reduce((sum, item) => sum + item.points, 0),
      track: level.rules.track,
      programme_id: level.programmeId,
      ...(level.family === undefined ? {} : { family: level.family.id }),
    },
    player: stored.player,
    versions: {
      benchmark_version: stored.header.benchmark_version,
      wash_runner: washRunner,
      ...(keyed !== null && washRunner !== keyed ? { wash_keyed_by: keyed.version } : {}),
      fidelity: report?.job.fidelity ?? null,
      sim_version: report?.job.sim_version ?? null,
      runner_version: report?.job.runner_version ?? null,
      guidance_version: LOADING_GUIDANCE_VERSION,
    },
    created_at: stored.header.created_at,
    opened_at: openedAt,
    cycle_started_at: cycleStartedAt,
    wash_ended_at: washEndedAt,
    time: {
      loading_s: seconds(openedAt, cycleStartedAt ?? last?.at ?? null),
      wash_wall_s: seconds(cycleStartedAt, washEndedAt),
      wash_runtime_s: report?.job.runtime_s ?? null,
    },
    events,
    counts: countsOf(events),
    budget: last?.budget ?? null,
    final_state_hash: last?.state_hash ?? null,
    load: source.manifest?.load ?? null,
    prechecks: source.manifest?.prechecks ?? null,
    wash:
      lastWash === null
        ? null
        : {
            job_id: lastWash.job_id,
            status: lastWash.status,
            cache_key: lastWash.cache_key,
            cached: source.job?.cached ?? null,
            ...(source.job?.tier === undefined ? {} : { tier: source.job.tier }),
            ...(lastWash.error === undefined ? {} : { error: lastWash.error }),
            ...(rewashed === undefined ? {} : { rewashed_with: rewashed.ran_with }),
          },
    washes,
    report,
    score: report === null ? null : scoreOf(report),
  };
}

/** True for a value that reads as an episode record of this format. */
export function isEpisodeRecord(value: unknown): value is EpisodeRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<EpisodeRecord>;
  return (
    record.format === EPISODE_FORMAT &&
    typeof record.episode_id === 'string' &&
    typeof record.level === 'object' &&
    record.level !== null &&
    Array.isArray(record.events)
  );
}
