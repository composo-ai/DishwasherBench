/**
 * Verifying an episode (docs/research/benchmark.md section 4.6: nobody has to trust a reported
 * load or score). Three things are checked, each named for what it covers:
 *
 *  - the log: its events, applied to a fresh session of the same level, reproduce the scene
 *    hash after every event;
 *  - the load: what the record says was washed and scored belongs to the scene the replay
 *    arrives at (the frozen load, the hash the report names, which items the report calls
 *    loaded, the score against the report, the report's points against its own verdicts, and
 *    the key of the wash against the replayed manifest);
 *  - the score: the replayed load, washed again, gives the verdicts and points the record
 *    reports. This is the only check that makes a falsified report impossible, and it costs a
 *    wash; it is run when a way to wash is given (`bench verify --rewash`).
 *
 * For a scripted policy the log is checked against the policy's own session instead, which
 * made the calls first.
 */

import { canonicalHash, canonicalJson, sha256Hex } from '@spotless/core';
import type { Level } from '@spotless/levels';
import type { EpisodeRecord, EpisodeReplay } from '@spotless/server';
import { scoreOf } from '@spotless/server';
import type { ActionLogEvent, WashManifest, WashReport, WashTier } from '@spotless/session';
import { replayActionLog } from '@spotless/session';

/** Options of {@link verifyByReplay}. */
export interface VerifyOptions {
  /**
   * Washes a manifest at a tier and returns the report: with it the replayed load is washed
   * again and the outcome compared with the record's. Without it the score is not verified.
   */
  readonly rewash?: (manifest: WashManifest, tier: WashTier) => Promise<WashReport>;
}

function same(a: unknown, b: unknown): boolean {
  return canonicalHash(a) === canonicalHash(b);
}

/**
 * What of a record does not belong to the load a replay arrived at, in words; empty when
 * everything does. `manifest` is the replaying session's (null when it started no cycle).
 */
export function loadMismatches(
  record: EpisodeRecord,
  level: Level,
  manifest: WashManifest | null,
): string[] {
  const out: string[] = [];
  if (manifest === null) {
    if (record.load !== null) out.push('the record has a load, the replay started no cycle');
    if (record.report !== null) out.push('the record has a report, the replay started no cycle');
    if (record.score !== null) out.push('the record has a score, the replay started no cycle');
    return out;
  }
  if (record.load === null) {
    out.push('the replay started a cycle, the record has no load');
  } else {
    if (record.load.state_hash !== manifest.load.state_hash) {
      out.push(
        `load.state_hash: recorded ${record.load.state_hash}, replayed ${manifest.load.state_hash}`,
      );
    }
    if (!same(record.load, manifest.load)) {
      out.push('load: the recorded load (items and poses) is not the load the replay froze');
    }
  }
  // The wash the record names must be a wash of this load: its key covers the whole manifest.
  const wash = record.wash;
  const runner = record.versions.wash_runner;
  // The key holds the tier the wash was asked for, which a level's rules or a runner that
  // simulates nothing can make differ from the tier the report names.
  const tier = wash?.tier;
  if (wash !== null && wash.status === 'done' && runner !== null && tier !== undefined) {
    const keyed = { ...runner, version: record.versions.wash_keyed_by ?? runner.version };
    const key = sha256Hex(canonicalJson({ runner: keyed, tier, manifest }));
    if (key !== wash.cache_key) {
      out.push(
        `wash.cache_key: the recorded wash (${wash.cache_key.slice(0, 12)}) is not a wash of the replayed load by the recorded code and tier (${key.slice(0, 12)})`,
      );
    }
  }
  const report = record.report;
  if (report === null) {
    if (record.score !== null) out.push('the record has a score and no report');
    return out;
  }
  if (report.state_hash !== manifest.load.state_hash) {
    out.push(
      `report.state_hash: recorded ${report.state_hash}, replayed ${manifest.load.state_hash}`,
    );
  }
  if (report.level_id !== level.id) out.push('report.level_id is not the level of the episode');
  const points = new Map(level.items.map((item) => [item.id, item.points]));
  const loaded = new Set(manifest.items.map((item) => item.item_id));
  const seen = new Set<string>();
  let sum = 0;
  let sumLoaded = 0;
  for (const item of report.items) {
    seen.add(item.item_id);
    const worth = points.get(item.item_id);
    if (worth === undefined) {
      out.push(`report: '${item.item_id}' is not an item of the level`);
      continue;
    }
    if (item.loaded !== loaded.has(item.item_id)) {
      out.push(
        `report: ${item.item_id} is reported ${item.loaded ? 'loaded' : 'not loaded'}, the replayed load says otherwise`,
      );
    }
    if (!item.loaded) continue;
    sumLoaded += worth;
    const due = item.clean ? worth : 0;
    if (item.points_awarded !== due) {
      out.push(
        `report: ${item.item_id} is awarded ${item.points_awarded} points, its verdict gives ${due}`,
      );
    }
    sum += due;
  }
  if (seen.size !== points.size) out.push('report: not one entry per item of the level');
  const available = [...points.values()].reduce((a, b) => a + b, 0);
  if (report.score.points !== sum) {
    out.push(`report.score.points is ${report.score.points}, its items give ${sum}`);
  }
  if (report.score.points_available !== available) {
    out.push(
      `report.score.points_available is ${report.score.points_available}, the level has ${available}`,
    );
  }
  if (report.score.points_loaded !== undefined && report.score.points_loaded !== sumLoaded) {
    out.push(
      `report.score.points_loaded is ${report.score.points_loaded}, the load has ${sumLoaded}`,
    );
  }
  if (record.score === null || !same(record.score, scoreOf(report))) {
    out.push('score: the recorded score is not the score of the recorded report');
  }
  return out.slice(0, 10);
}

/**
 * What a record says against itself, without replaying anything: a score that is not the
 * score of its report, points that do not follow from the verdicts, a report of another load
 * than the one recorded, or items reported loaded that the recorded load does not hold. The
 * results table leaves such a record out of its means whatever the record says of its own
 * verification.
 */
export function recordInconsistencies(record: EpisodeRecord): string[] {
  const report = record.report;
  if (report === null || !Array.isArray(report.items)) return [];
  const out: string[] = [];
  if (record.score === null || !same(record.score, scoreOf(report))) {
    out.push('score: the recorded score is not the score of the recorded report');
  }
  let sum = 0;
  for (const item of report.items) {
    if (!item.loaded) continue;
    if (!item.clean && item.points_awarded !== 0) {
      out.push(`report: ${item.item_id} is not clean and is awarded points`);
    }
    sum += item.points_awarded;
  }
  if (report.score.points !== sum) {
    out.push(`report.score.points is ${report.score.points}, its items give ${sum}`);
  }
  if (report.score.points_available !== record.level.points_available) {
    out.push('report.score.points_available is not that of the level');
  }
  const load = record.load;
  if (load !== null) {
    if (report.state_hash !== load.state_hash) {
      out.push('report.state_hash is not the hash of the recorded load');
    }
    const held = new Set(load.items.map((item) => item.item_id));
    const claimed = report.items.filter((item) => item.loaded).map((item) => item.item_id);
    if (claimed.length !== held.size || claimed.some((id) => !held.has(id))) {
      out.push('report: the items reported loaded are not the items of the recorded load');
    }
  }
  return out;
}

/**
 * How the two cases of an unequal result hash under equal verdicts are worded. Under other
 * wash code the numbers behind the verdicts may differ: that is reported and does not
 * unverify. Under the same wash code they may not: the wash is deterministic, and the hash
 * names the same sources with or without an exposure cache.
 */
const OTHER_CODE_NOTE = 'another result hash under other wash code';
const REPEAT_FAILURE = 'a different result hash';

/** How a second wash of the load differs from the recorded report, in words. */
function rewashMismatches(recorded: WashReport, again: WashReport): string[] {
  const out: string[] = [];
  const second = new Map(again.items.map((item) => [item.item_id, item]));
  for (const item of recorded.items) {
    const other = second.get(item.item_id);
    if (other === undefined || other.loaded !== item.loaded) {
      out.push(`rewash: ${item.item_id} is loaded in one report and not in the other`);
      continue;
    }
    if (!item.loaded || !other.loaded) continue;
    if (item.clean !== other.clean) {
      out.push(
        `rewash: ${item.item_id} is recorded ${item.clean ? 'clean' : 'not clean'}, the wash of the replayed load gives ${other.clean ? 'clean' : 'not clean'}`,
      );
    }
  }
  if (recorded.score.points !== again.score.points) {
    out.push(
      `rewash: recorded ${recorded.score.points} points, the wash of the replayed load gives ${again.score.points}`,
    );
  }
  const a = recorded.job.result_hash;
  const b = again.job.result_hash;
  if (out.length === 0 && a !== undefined && b !== undefined && a !== b) {
    const was = recorded.job.runner_version;
    const now = again.job.runner_version;
    if (was !== undefined && was === now) {
      // The same code on the same load gave other numbers: the wash did not repeat.
      out.push(
        `rewash: the same wash code (${now}) gave the same verdicts and points and ${REPEAT_FAILURE} (recorded ${a.slice(0, 19)}, now ${b.slice(0, 19)}): the wash did not repeat`,
      );
    } else {
      // The verdicts agree and the numbers behind them do not: other code.
      out.push(
        `rewash: same verdicts and points, ${OTHER_CODE_NOTE} (recorded ${a.slice(0, 19)}, now ${b.slice(0, 19)}; recorded code ${was ?? 'unknown'}, now ${now ?? 'unknown'})`,
      );
    }
  }
  return out.slice(0, 10);
}

/**
 * Replays the action log of a record in a fresh session and compares every hash, then checks
 * that the recorded load, report and score belong to the replayed scene, and with
 * `options.rewash` washes the replayed load again. The level must be the one the episode was
 * played on (its digest is checked first).
 */
export async function verifyByReplay(
  record: EpisodeRecord,
  level: Level,
  options: VerifyOptions = {},
): Promise<EpisodeReplay> {
  if (canonicalHash(level) !== record.level.digest) {
    return {
      verified: false,
      method: 'replay',
      events: 0,
      final_state_hash: '',
      mismatches: [
        `level '${level.id}' is not the level the episode was played on (its digest differs)`,
      ],
      checks: { log: false, load: null, score: null },
    };
  }
  const outcomes = record.washes?.map((wash) => wash.status);
  const result = await replayActionLog(
    level,
    record.events,
    outcomes === undefined ? {} : { washOutcomes: outcomes },
  );
  const mismatches = result.mismatches
    .slice(0, 10)
    .map((m) => `event ${m.seq} (${m.name}) ${m.field}: expected ${m.expected}, got ${m.actual}`);
  const finalMatches =
    record.final_state_hash === null || record.final_state_hash === result.final_state_hash;
  if (!finalMatches) {
    mismatches.push(
      `final state: recorded ${String(record.final_state_hash)}, replayed ${result.final_state_hash}`,
    );
  }
  const logOk = result.ok && finalMatches;
  const load = loadMismatches(record, level, result.manifest);
  mismatches.push(...load);
  const loadOk = result.manifest === null && load.length === 0 ? null : load.length === 0;
  let scoreOk: boolean | null = null;
  // Washing again is worth it only for a record that is otherwise in order.
  if (
    options.rewash !== undefined &&
    logOk &&
    loadOk === true &&
    result.manifest !== null &&
    record.report !== null
  ) {
    const fidelity = record.report.job.fidelity;
    if (fidelity === 'official' || fidelity === 'fast') {
      const again = await options.rewash(result.manifest, fidelity);
      const differences = rewashMismatches(record.report, again);
      // Another result hash under the same verdicts and other wash code is reported and does
      // not unverify; under the same code it does.
      const hard = differences.filter((line) => !line.includes(OTHER_CODE_NOTE));
      mismatches.push(...differences);
      scoreOk = hard.length === 0;
    }
  }
  return {
    verified: logOk && loadOk !== false && scoreOk !== false,
    method: 'replay',
    events: result.replayed,
    final_state_hash: result.final_state_hash,
    mismatches,
    checks: { log: logOk, load: loadOk, score: scoreOk },
  };
}

/**
 * Compares the server's log of an episode with the log of the scripted policy's own session:
 * the same calls in the same order must have been accepted or refused alike, with the same
 * result digest and the same scene hash after each. Events the server has beyond the
 * policy's (the start of the cycle, by the harness) are not compared. This checks the log
 * only: the load and the score are not covered (`bench verify` covers them).
 */
export function verifyAgainstPolicySession(
  record: EpisodeRecord,
  planned: readonly ActionLogEvent[],
): EpisodeReplay {
  const mismatches: string[] = [];
  const differ = (
    seq: number,
    name: string,
    field: string,
    expected: unknown,
    actual: unknown,
  ): void => {
    if (expected !== actual && mismatches.length < 10) {
      mismatches.push(
        `event ${seq} (${name}) ${field}: policy session ${String(expected)}, game ${String(actual)}`,
      );
    }
  };
  if (record.events.length < planned.length) {
    mismatches.push(
      `the game logged ${record.events.length} events, the policy made ${planned.length} calls`,
    );
  }
  let last = '';
  planned.forEach((event, i) => {
    const actual = record.events[i];
    if (actual === undefined) return;
    differ(event.seq, event.name, 'name', event.name, actual.name);
    differ(event.seq, event.name, 'accepted', event.accepted, actual.accepted);
    differ(event.seq, event.name, 'state_hash', event.state_hash, actual.state_hash);
    differ(event.seq, event.name, 'result_digest', event.result_digest, actual.result_digest);
    last = actual.state_hash;
  });
  // What can be said of the load without a replay: the record against itself.
  mismatches.push(...recordInconsistencies(record));
  return {
    verified: mismatches.length === 0,
    method: 'policy_session',
    events: planned.length,
    final_state_hash: last,
    mismatches,
    checks: { log: mismatches.length === 0, load: null, score: null },
  };
}
