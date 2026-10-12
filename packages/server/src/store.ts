/**
 * The data directory: everything the server keeps on disk.
 *
 *   <data>/sessions/<session id>.jsonl   level id and action log of a session, a line per event
 *   <data>/jobs/<job id>.json            the last recorded state of a wash job
 *   <data>/washes/<cache key>.json       a finished wash report, keyed by runner and manifest
 *   <data>/episodes/<session id>.json    the episode record of a session whose wash has ended
 *   <data>/reports/<job id>.json         the report of a session's wash exactly as it was delivered
 *
 * Session files are appended to as the events happen, so that a session can be restored by
 * replaying its log after the process has gone. Writes are synchronous: a line is on disk
 * before the response that reports its event is sent.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { WashReport, WashTier } from '@spotless/session';
import type { EpisodePlayer, EpisodeRecord } from './episode.ts';
import type {
  SessionEventLine,
  SessionHeaderLine,
  SessionLine,
  SessionWashLine,
  WashJobRecord,
  WashRunnerIdentity,
} from './types.ts';

/** Ids that may be used as file names: no separators, no dots at the start. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

/** True for an id that is safe to use as a file name in the data directory. */
export function isSafeId(id: string): boolean {
  return SAFE_ID.test(id) && !id.includes('..');
}

/** A stored wash result. */
export interface WashResultRecord {
  readonly cache_key: string;
  readonly runner: WashRunnerIdentity;
  readonly level_id: string;
  readonly state_hash: string;
  /** Wall-clock time the result was stored (ISO 8601). */
  readonly stored_at: string;
  readonly report: WashReport;
}

/** A session file as read back. */
export interface StoredSession {
  readonly header: SessionHeaderLine;
  /** The events and wash outcomes after the header, in file order (what a replay applies). */
  readonly lines: readonly (SessionEventLine | SessionWashLine)[];
  /** True when the last line was cut short (the process died while writing) and was left out. */
  readonly truncated: boolean;
  /** Who is playing: the last note that names a player, else the header's; null if neither. */
  readonly player: EpisodePlayer | null;
  /** When the player first reached the session, from its note; null when there is none. */
  readonly opened_at: string | null;
  /**
   * Washes whose delivered report was no longer held when the session was restored and that
   * were therefore washed again (local play only), with the code that ran the second time.
   */
  readonly rewashed: readonly { readonly job_id: string; readonly ran_with: string }[];
  /**
   * The tier the player last chose for the washes of the session; null or absent when none
   * was chosen (absent in records made by hand, as tests of other packages make them).
   */
  readonly wash_tier?: WashTier | null;
}

/** Parses the text of a session file. Throws an Error for a file that is not one. */
export function parseSessionFile(text: string): StoredSession {
  const rows = text.split('\n');
  if (rows[rows.length - 1] === '') rows.pop();
  let header: SessionHeaderLine | null = null;
  const lines: (SessionEventLine | SessionWashLine)[] = [];
  let truncated = false;
  let player: EpisodePlayer | null = null;
  let openedAt: string | null = null;
  const rewashed: { job_id: string; ran_with: string }[] = [];
  let washTier: WashTier | null = null;
  for (let i = 0; i < rows.length; i++) {
    let line: SessionLine;
    try {
      line = JSON.parse(rows[i] as string) as SessionLine;
    } catch {
      if (i === rows.length - 1 && i > 0) {
        truncated = true;
        break;
      }
      throw new Error(`session file: line ${i + 1} is not JSON`);
    }
    if (i === 0) {
      if (line.type !== 'session' || line.version !== 1 || typeof line.level_id !== 'string') {
        throw new Error('session file: the first line is not a session header of version 1');
      }
      header = line;
      player = line.player ?? null;
    } else if (line.type === 'event' || line.type === 'wash') {
      lines.push(line);
    } else if (line.type === 'note') {
      if (line.rewashed !== undefined) rewashed.push(line.rewashed);
      if (line.wash_tier === 'fast' || line.wash_tier === 'official') washTier = line.wash_tier;
      if (line.player !== undefined) player = line.player;
      if (line.opened === true && openedAt === null) openedAt = line.at;
    } else {
      throw new Error(`session file: line ${i + 1} has an unknown type`);
    }
  }
  if (header === null) throw new Error('session file: empty');
  return { header, lines, truncated, player, opened_at: openedAt, rewashed, wash_tier: washTier };
}

/** The data directory. */
export class DataStore {
  readonly dir: string;
  private readonly sessionsDir: string;
  private readonly jobsDir: string;
  private readonly washesDir: string;
  private readonly episodesDir: string;
  private readonly reportsDir: string;

  /** Opens (and if need be creates) the data directory. */
  constructor(dir: string) {
    this.dir = dir;
    this.sessionsDir = join(dir, 'sessions');
    this.jobsDir = join(dir, 'jobs');
    this.washesDir = join(dir, 'washes');
    this.episodesDir = join(dir, 'episodes');
    this.reportsDir = join(dir, 'reports');
    for (const sub of [
      this.sessionsDir,
      this.jobsDir,
      this.washesDir,
      this.episodesDir,
      this.reportsDir,
    ]) {
      mkdirSync(sub, { recursive: true });
    }
  }

  private sessionPath(sessionId: string): string {
    if (!isSafeId(sessionId)) throw new Error(`store: '${sessionId}' is not a usable session id`);
    return join(this.sessionsDir, `${sessionId}.jsonl`);
  }

  /** Starts the file of a new session. Throws if the session already has one. */
  createSession(header: SessionHeaderLine): void {
    writeFileSync(this.sessionPath(header.session_id), `${JSON.stringify(header)}\n`, {
      flag: 'wx',
    });
  }

  /** Appends lines to a session's file. */
  appendSession(sessionId: string, lines: readonly SessionLine[]): void {
    if (lines.length === 0) return;
    appendFileSync(
      this.sessionPath(sessionId),
      lines.map((line) => `${JSON.stringify(line)}\n`).join(''),
    );
  }

  /** True when a session with that id is stored. */
  hasSession(sessionId: string): boolean {
    return isSafeId(sessionId) && existsSync(this.sessionPath(sessionId));
  }

  /** Reads a session's file. Throws when there is none or it is not readable as one. */
  readSession(sessionId: string): StoredSession {
    return parseSessionFile(readFileSync(this.sessionPath(sessionId), 'utf8'));
  }

  /** Ids of every stored session, sorted. */
  sessionIds(): string[] {
    return readdirSync(this.sessionsDir)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => name.slice(0, -'.jsonl'.length))
      .filter(isSafeId)
      .sort();
  }

  private writeJson(path: string, value: unknown): void {
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value)}\n`);
    renameSync(temporary, path);
  }

  private readJson(path: string): unknown {
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as unknown;
    } catch {
      return null;
    }
  }

  /** Records the state of a wash job. */
  writeJob(record: WashJobRecord): void {
    if (!isSafeId(record.job_id)) throw new Error(`store: '${record.job_id}' is not a job id`);
    this.writeJson(join(this.jobsDir, `${record.job_id}.json`), record);
  }

  /** The last recorded state of a wash job, or null. */
  readJob(jobId: string): WashJobRecord | null {
    if (!isSafeId(jobId)) return null;
    return this.readJson(join(this.jobsDir, `${jobId}.json`)) as WashJobRecord | null;
  }

  /** The directory episode records are written to. */
  get episodes(): string {
    return this.episodesDir;
  }

  /** Writes (or replaces) the episode record of a session. Returns the path of the file. */
  writeEpisode(record: EpisodeRecord): string {
    if (!isSafeId(record.episode_id)) throw new Error('store: not an episode id');
    const path = join(this.episodesDir, `${record.episode_id}.json`);
    this.writeJson(path, record);
    return path;
  }

  /** The stored episode record of a session, or null. */
  readEpisode(episodeId: string): EpisodeRecord | null {
    if (!isSafeId(episodeId)) return null;
    return this.readJson(join(this.episodesDir, `${episodeId}.json`)) as EpisodeRecord | null;
  }

  /**
   * Keeps the report of a session's wash exactly as it was delivered to the player, by job id.
   * Unlike the result cache (which is keyed by the code that ran and may not hold a result
   * whose source changed under it), this is the record of what the session was told.
   */
  writeReport(jobId: string, report: WashReport): void {
    if (!isSafeId(jobId)) throw new Error(`store: '${jobId}' is not a job id`);
    this.writeJson(join(this.reportsDir, `${jobId}.json`), { job_id: jobId, report });
  }

  /** The report delivered for a wash job of a session, or null when none is kept. */
  readReport(jobId: string): WashReport | null {
    if (!isSafeId(jobId)) return null;
    const kept = this.readJson(join(this.reportsDir, `${jobId}.json`)) as {
      job_id?: unknown;
      report?: unknown;
    } | null;
    if (kept === null || kept.job_id !== jobId || typeof kept.report !== 'object') return null;
    return kept.report as WashReport;
  }

  /** Stores a finished wash under its cache key. */
  writeWash(record: WashResultRecord): void {
    if (!isSafeId(record.cache_key)) throw new Error('store: not a cache key');
    this.writeJson(join(this.washesDir, `${record.cache_key}.json`), record);
  }

  /** The stored wash with that cache key, or null (also for a file that cannot be read). */
  readWash(cacheKey: string): WashResultRecord | null {
    if (!isSafeId(cacheKey)) return null;
    const record = this.readJson(
      join(this.washesDir, `${cacheKey}.json`),
    ) as WashResultRecord | null;
    if (record === null || record.cache_key !== cacheKey || typeof record.report !== 'object') {
      return null;
    }
    return record;
  }
}
