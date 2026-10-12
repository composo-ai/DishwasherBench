/**
 * The sessions of the server: creating them, keeping their logs on disk as they grow, restoring
 * them by replaying a log, running their actions with animation frames for the WebSocket, and
 * handing their washes to the wash queue.
 *
 * Every action and query goes through the session layer of `@spotless/session` and nowhere
 * else: the server adds transport, persistence and display, never game logic.
 */

import { randomUUID } from 'node:crypto';
import { canonicalHash } from '@spotless/core';
import type { Level } from '@spotless/levels';
import type {
  ActionLogEvent,
  ActionName,
  GameSession,
  JobStatus,
  SceneState,
  WashManifest,
  WashReport,
  WashRunner,
  WashTier,
} from '@spotless/session';
import { applyLoggedEvent, createSession, placeholderWashRunner } from '@spotless/session';
import { sceneView } from './draw.ts';
import type { EpisodePlayer, EpisodeRecord } from './episode.ts';
import { buildEpisodeRecord } from './episode.ts';
import { FrameRecorder } from './recorder.ts';
import { currentWashJob, uncountedSceneState } from './session-internals.ts';
import type { DataStore, StoredSession } from './store.ts';
import type {
  RestoreSummary,
  ServerMessage,
  ServerRejectReason,
  SessionEventLine,
  SessionSummary,
  SessionWashLine,
  WashJobRecord,
} from './types.ts';
import type { WashQueue } from './wash-queue.ts';

/** A refusal by the server that a route turns into its HTTP status and a rejection value. */
export class ServerError extends Error {
  readonly reason: ServerRejectReason;
  readonly status: number;

  constructor(reason: ServerRejectReason, status: number, detail: string) {
    super(detail);
    this.name = 'ServerError';
    this.reason = reason;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------------------------
// Replaying a stored session
// ---------------------------------------------------------------------------------------------

/** A wash the session has started and that waits for its outcome. */
interface HeldWash {
  readonly manifest: WashManifest;
  readonly onProgress: (fraction: number) => void;
  readonly resolve: (report: WashReport) => void;
  readonly reject: (error: Error) => void;
}

/**
 * The wash runner of a session that can be replayed: while a log is replayed it holds each
 * wash until the log says how it ended, so that the events around it meet the session in the
 * phase they were issued in; afterwards it passes washes on to `live`.
 */
export class WashGate {
  /** True while a stored log is being replayed. */
  replaying = false;
  /** The wash held during a replay. */
  held: HeldWash | null = null;
  /** Where washes go outside a replay. */
  live: WashRunner = placeholderWashRunner;

  /** The runner to give to `createSession`. */
  readonly runner: WashRunner = (manifest, onProgress) => {
    if (!this.replaying) return this.live(manifest, onProgress);
    return new Promise<WashReport>((resolve, reject) => {
      this.held = { manifest, onProgress, resolve, reject };
    });
  };
}

/** One difference between a stored log and its replay. */
export interface StoredMismatch {
  readonly seq: number;
  readonly name: string;
  readonly field: 'accepted' | 'state_hash' | 'log';
  readonly expected: string;
  readonly actual: string;
}

/** Outcome of {@link replayStoredSession}. */
export interface StoredReplay {
  /** Events replayed. */
  readonly replayed: number;
  /** Differences that mean the log does not describe this session. */
  readonly mismatches: readonly StoredMismatch[];
  /** Queries whose result digest differs (`get_report` excepted, which depends on timing). */
  readonly digestMismatches: number;
  /** Wash outcomes read from the log. */
  readonly washes: number;
}

/** Lets the microtasks and immediates that are due run. */
function nextTick(): Promise<void> {
  return new Promise<void>((next) => {
    setImmediate(next);
  });
}

/**
 * Replays the lines of a stored session into a fresh session made with `gate.runner`, in file
 * order: every event (queries too, so that budgets and the log come out as they were) and every
 * wash outcome at the point where it happened. `reportOf` supplies the report of a wash that
 * ended well. On return a wash that the log started and did not end is still held by the gate.
 * The gate is left in replaying mode; the caller decides what happens to a held wash.
 */
export async function replayStoredSession(
  session: GameSession,
  gate: WashGate,
  stored: StoredSession,
  reportOf: (line: SessionWashLine, manifest: WashManifest) => Promise<WashReport>,
): Promise<StoredReplay> {
  const mismatches: StoredMismatch[] = [];
  let digestMismatches = 0;
  let replayed = 0;
  let washes = 0;
  gate.replaying = true;
  for (const line of stored.lines) {
    if (line.type === 'event') {
      const { event } = line;
      const again = applyLoggedEvent(session, event);
      if (again === null || again.seq !== event.seq) {
        mismatches.push({
          seq: event.seq,
          name: event.name,
          field: 'log',
          expected: `event ${event.seq}`,
          actual: again === null ? 'not replayable' : `event ${again.seq}`,
        });
        break;
      }
      replayed += 1;
      if (again.accepted !== event.accepted) {
        mismatches.push({
          seq: event.seq,
          name: event.name,
          field: 'accepted',
          expected: String(event.accepted),
          actual: String(again.accepted),
        });
      }
      if (again.state_hash !== event.state_hash) {
        mismatches.push({
          seq: event.seq,
          name: event.name,
          field: 'state_hash',
          expected: event.state_hash,
          actual: again.state_hash,
        });
      }
      if (event.name !== 'get_report' && again.result_digest !== event.result_digest) {
        digestMismatches += 1;
      }
      // The session hands the wash to its runner on a later tick.
      if (event.name === 'start_cycle' && again.accepted) await nextTick();
    } else {
      washes += 1;
      const held = gate.held;
      if (held === null) {
        mismatches.push({
          seq: -1,
          name: 'wash',
          field: 'log',
          expected: 'a started cycle before the outcome of a wash',
          actual: 'none',
        });
        break;
      }
      gate.held = null;
      if (line.status === 'done') held.resolve(await reportOf(line, held.manifest));
      else held.reject(new Error(line.error ?? 'failed'));
      await session.washSettled();
      await nextTick();
    }
  }
  return { replayed, mismatches, digestMismatches, washes };
}

// ---------------------------------------------------------------------------------------------
// The manager
// ---------------------------------------------------------------------------------------------

/** A session held in memory. */
export interface SessionEntry {
  readonly id: string;
  readonly level: Level;
  readonly session: GameSession;
}

interface Entry extends SessionEntry {
  readonly gate: WashGate;
  readonly recorder: FrameRecorder;
  readonly subscribers: Set<(message: ServerMessage) => void>;
  /** Events of the session's log already written to its file. */
  persisted: number;
  /** Washes handed to the queue or read from the log so far. */
  washes: number;
  /** The queue's record of the wash in hand. */
  queueRecord: WashJobRecord | null;
  /** Rises with every use; the lowest is set aside first. */
  usedAt: number;
  closed: boolean;
  /** Who is playing, when the server has been told. */
  player: EpisodePlayer | null;
  /** True once the session's file notes that the player has arrived. */
  opened: boolean;
  /** The report of the session's last wash that ended well, as it was delivered. */
  lastReport: WashReport | null;
  /** True when the session's last wash failed (the wash was given back). */
  washFailed: boolean;
  /** The tier the player chose for the washes of this session; null for the queue's own. */
  washTier: WashTier | null;
}

/** Options of {@link SessionManager}. */
export interface SessionManagerOptions {
  readonly store: DataStore;
  readonly queue: WashQueue;
  readonly levels: readonly Level[];
  readonly maxSessions: number;
  readonly animationRateHz: number;
  readonly now: () => string;
  /**
   * Benchmark mode. A session whose delivered report is no longer held is not restored by
   * washing its load again, and once a cycle has been started the load is frozen: after a
   * failed wash only `start_cycle` is taken, so that a retry washes the load that was committed.
   */
  readonly benchmarkMode?: boolean;
}

/** The sessions of one server. */
export class SessionManager {
  private readonly store: DataStore;
  private readonly queue: WashQueue;
  private readonly levels: ReadonlyMap<string, Level>;
  private readonly maxSessions: number;
  private readonly animationRateHz: number;
  private readonly now: () => string;
  private readonly benchmarkMode: boolean;
  private readonly entries = new Map<string, Entry>();
  private readonly restoring = new Map<
    string,
    Promise<{ entry: Entry; summary: RestoreSummary }>
  >();
  private clock = 0;

  constructor(options: SessionManagerOptions) {
    this.store = options.store;
    this.queue = options.queue;
    this.levels = new Map(options.levels.map((level) => [level.id, level]));
    this.maxSessions = options.maxSessions;
    this.animationRateHz = options.animationRateHz;
    this.now = options.now;
    this.benchmarkMode = options.benchmarkMode ?? false;
  }

  /** The level with that id, or undefined. */
  level(levelId: string): Level | undefined {
    return this.levels.get(levelId);
  }

  /** Every level on offer, in the order given. */
  allLevels(): Level[] {
    return [...this.levels.values()];
  }

  /** Ids of the sessions in memory, and of those only in the data directory. */
  sessionIds(): { live: string[]; stored: string[] } {
    const live = [...this.entries.keys()].sort();
    return { live, stored: this.store.sessionIds().filter((id) => !this.entries.has(id)) };
  }

  // -------------------------------------------------------------------------------------------
  // Creating, finding, restoring, closing
  // -------------------------------------------------------------------------------------------

  /**
   * Creates a session for a level and starts its file. `player` says who it is for (the
   * harness names the player of an episode); without it the player may give a name later.
   */
  async create(levelId: string, player?: EpisodePlayer): Promise<SessionEntry> {
    const level = this.levels.get(levelId);
    if (level === undefined) {
      throw new ServerError('unknown_level', 404, `no level '${levelId}'`);
    }
    this.makeRoom();
    const entry = await this.open(randomUUID(), level);
    entry.player = player ?? null;
    this.store.createSession({
      type: 'session',
      version: 1,
      session_id: entry.id,
      level_id: level.id,
      level_digest: canonicalHash(level),
      benchmark_version: entry.session.card.benchmark_version,
      created_at: this.now(),
      ...(player === undefined ? {} : { player }),
    });
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Who is playing a session, or null while nobody has been named. */
  playerOf(held: SessionEntry): EpisodePlayer | null {
    return this.live(held).player;
  }

  /**
   * Names the player of a session that has none yet (a person who was given a link without a
   * name types one in the client). A session that already has a player keeps it: returns
   * false and changes nothing.
   */
  namePlayer(held: SessionEntry, player: EpisodePlayer): boolean {
    const entry = this.live(held);
    if (entry.player !== null) return false;
    entry.player = player;
    this.store.appendSession(entry.id, [{ type: 'note', at: this.now(), player }]);
    return true;
  }

  /**
   * The tier the washes of a session run at: the one its player chose, else the queue's. In
   * benchmark mode always the queue's.
   */
  washTierOf(held: SessionEntry): WashTier {
    return this.live(held).washTier ?? this.queue.tier;
  }

  /**
   * Takes the player's choice of tier for the washes of a session from here on, and notes it
   * in the session's file. In benchmark mode nothing is taken: scores come from the server's
   * tier whatever a page asks. Returns the tier the next wash will run at.
   */
  chooseWashTier(held: SessionEntry, tier: WashTier): WashTier {
    const entry = this.live(held);
    if (this.benchmarkMode) return this.queue.tier;
    if (entry.washTier !== tier) {
      entry.washTier = tier;
      this.store.appendSession(entry.id, [{ type: 'note', at: this.now(), wash_tier: tier }]);
    }
    return tier;
  }

  /**
   * A new session of the same level that holds the load of `held` as it stood when its cycle
   * was started, with its cycle started at `tier`: the log of `held` is replayed into it up
   * to the start of the cycle, every event checked against the hash the log recorded for it,
   * and the cycle is then started with the request the log holds. This is how the full wash
   * is run on the load of a preview without the session layer knowing of tiers: the first
   * session keeps its preview, the second is a game of its own with the same moves.
   *
   * Refused in benchmark mode (an episode is one session, made by the harness), for a
   * session that has started no cycle or more than one, and when the log does not replay.
   */
  async rewash(held: SessionEntry, tier: WashTier): Promise<SessionEntry> {
    const source = this.live(held);
    if (this.benchmarkMode) {
      throw new ServerError(
        'forbidden',
        403,
        'washing a load again in a new session is for local play: in benchmark mode an episode is one session',
      );
    }
    const log = [...source.session.actionLog()];
    const starts = log.filter((event) => event.name === 'start_cycle' && event.accepted);
    const start = starts[0];
    if (start === undefined || starts.length > 1) {
      throw new ServerError(
        'invalid_argument',
        400,
        start === undefined
          ? 'this session has not started a cycle: there is no washed load to wash again'
          : 'this session started more than one cycle: its load cannot be washed again by replay',
      );
    }
    const entry = (await this.create(source.level.id)) as Entry;
    const fail = (detail: string): never => {
      this.setAside(entry);
      throw new ServerError('restore_failed', 409, detail);
    };
    for (const event of log.slice(0, start.seq)) {
      const again = applyLoggedEvent(entry.session, event);
      if (
        again === null ||
        again.accepted !== event.accepted ||
        again.state_hash !== event.state_hash
      ) {
        fail(`the load does not replay: ${event.name} (event ${event.seq}) came out differently`);
      }
    }
    this.persist(entry);
    entry.washTier = tier;
    this.store.appendSession(entry.id, [
      { type: 'note', at: this.now(), wash_tier: tier, rewash_of: source.id },
    ]);
    const started = this.act(
      entry,
      'start_cycle',
      (session) => applyLoggedEvent(session, start) ?? { accepted: false },
    );
    if (!started.accepted || entry.session.stateHash() !== start.state_hash) {
      fail('the load replayed, but its cycle did not start on the same scene');
    }
    return entry;
  }

  /** Notes in the session's file, once, that the player has arrived. */
  private markOpened(entry: Entry): void {
    if (entry.opened) return;
    entry.opened = true;
    this.store.appendSession(entry.id, [{ type: 'note', at: this.now(), opened: true }]);
  }

  /**
   * The episode record of a session as it stands: every call with its time, the budgets, and
   * once the wash has ended the report and the score (`episode.ts`).
   */
  episodeRecord(held: SessionEntry): EpisodeRecord {
    const entry = this.live(held);
    const stored = this.store.readSession(entry.id);
    let lastDone: string | null = null;
    let lastJob: string | null = null;
    for (const line of stored.lines) {
      if (line.type !== 'wash') continue;
      lastJob = line.job_id;
      lastDone = line.status === 'done' ? line.cache_key : null;
    }
    return buildEpisodeRecord({
      sessionId: entry.id,
      level: entry.level,
      stored,
      manifest: entry.session.washManifest(),
      // The report as it was delivered; the result cache may not hold it (a wash whose
      // source changed under it is delivered and not kept).
      report: lastDone === null ? null : this.reportOf(entry),
      job: lastJob === null ? null : this.queue.job(lastJob),
      runner: this.queue.identity,
    });
  }

  /**
   * The report of the session's last wash that ended well, exactly as `get_report` gave it to
   * the player, or null when there is none: from memory, else as kept with the session, else
   * from the result cache.
   */
  reportOf(held: SessionEntry): WashReport | null {
    const entry = this.live(held);
    if (entry.lastReport !== null) return entry.lastReport;
    let lastDone: SessionWashLine | null = null;
    try {
      for (const line of this.store.readSession(entry.id).lines) {
        if (line.type === 'wash') lastDone = line.status === 'done' ? line : null;
      }
    } catch {
      return null;
    }
    if (lastDone === null) return null;
    const kept =
      this.store.readReport(lastDone.job_id) ?? this.queue.cachedReport(lastDone.cache_key);
    entry.lastReport = kept;
    return kept;
  }

  /**
   * Benchmark mode: refuses a change of the load once a cycle of the episode has been started
   * (a wash that failed gave the wash back; what was committed is washed, not something else).
   */
  private assertLoadOpen(entry: Entry, name: ActionName): void {
    if (!this.benchmarkMode || name === 'start_cycle' || !entry.washFailed) return;
    if (entry.session.phase() !== 'loading') return;
    throw new ServerError(
      'load_frozen',
      409,
      `the cycle of this episode has been started, so the load can no longer be changed; ` +
        `the wash did not end, and start_cycle starts it again on the same load`,
    );
  }

  /**
   * The session with that id: from memory, or restored from its stored log. Throws a
   * {@link ServerError} (`unknown_session`, `restore_failed`, `server_full`).
   */
  async get(sessionId: string): Promise<SessionEntry> {
    const live = this.entries.get(sessionId);
    if (live !== undefined) {
      live.usedAt = ++this.clock;
      return live;
    }
    return (await this.restore(sessionId)).entry;
  }

  /**
   * Restores a session by replaying its stored log, verifying the hash after every event. A
   * session that is in memory is set aside first, so that this always replays.
   */
  async restore(sessionId: string): Promise<{ entry: SessionEntry; summary: RestoreSummary }> {
    const underway = this.restoring.get(sessionId);
    if (underway !== undefined) return underway;
    if (!this.store.hasSession(sessionId)) {
      throw new ServerError('unknown_session', 404, `no session '${sessionId}'`);
    }
    const live = this.entries.get(sessionId);
    if (live !== undefined) {
      if (live.session.phase() === 'washing') {
        throw new ServerError(
          'restore_failed',
          409,
          'the session is washing; it can be restored when the wash has ended',
        );
      }
      this.setAside(live);
    }
    const work = this.restoreFromStore(sessionId).finally(() => {
      this.restoring.delete(sessionId);
    });
    this.restoring.set(sessionId, work);
    return work;
  }

  private async restoreFromStore(
    sessionId: string,
  ): Promise<{ entry: Entry; summary: RestoreSummary }> {
    let stored: StoredSession;
    try {
      stored = this.store.readSession(sessionId);
    } catch (error) {
      throw new ServerError(
        'restore_failed',
        409,
        error instanceof Error ? error.message : String(error),
      );
    }
    const level = this.levels.get(stored.header.level_id);
    if (level === undefined) {
      throw new ServerError(
        'restore_failed',
        409,
        `the session's level '${stored.header.level_id}' is not on offer`,
      );
    }
    if (canonicalHash(level) !== stored.header.level_digest) {
      throw new ServerError(
        'restore_failed',
        409,
        `level '${level.id}' has changed since the session was played`,
      );
    }
    this.makeRoom();
    const entry = await this.open(sessionId, level);
    // The tier the player chose, before the replay: a wash whose report is no longer held is
    // washed again during it. In benchmark mode the tier is the server's, whatever a file says.
    entry.washTier = this.benchmarkMode ? null : (stored.wash_tier ?? null);
    let replay;
    try {
      replay = await replayStoredSession(entry.session, entry.gate, stored, (line, manifest) =>
        this.reportForRestore(entry, line, manifest),
      );
    } catch (error) {
      entry.closed = true;
      entry.session.dispose();
      throw new ServerError(
        'restore_failed',
        409,
        error instanceof Error ? error.message : String(error),
      );
    }
    const first = replay.mismatches[0];
    if (first !== undefined) {
      entry.closed = true;
      entry.session.dispose();
      throw new ServerError(
        'restore_failed',
        409,
        `the stored log does not replay: ${first.name} (event ${first.seq}) ${first.field}: ` +
          `expected ${first.expected}, got ${first.actual}` +
          (replay.mismatches.length > 1 ? ` (and ${replay.mismatches.length - 1} more)` : ''),
      );
    }
    entry.persisted = entry.session.actionLog().length;
    entry.washes = replay.washes;
    for (const line of stored.lines) {
      if (line.type === 'wash') entry.washFailed = line.status === 'failed';
    }
    entry.player = stored.player;
    entry.opened = stored.opened_at !== null;
    entry.gate.replaying = false;
    this.entries.set(entry.id, entry);
    // A wash that was in hand when the log ends goes back to the queue.
    const held = entry.gate.held;
    entry.gate.held = null;
    if (held !== null) {
      this.liveWash(entry, held.manifest, held.onProgress).then(held.resolve, held.reject);
    }
    // Hand the session over on a fresh tick, after anything the resumed wash set off.
    await nextTick();
    return {
      entry,
      summary: {
        session_id: entry.id,
        level_id: level.id,
        replayed: replay.replayed,
        verified: true,
        digest_mismatches: replay.digestMismatches,
        wash_resumed: held !== null,
        state_hash: entry.session.stateHash(),
      },
    };
  }

  /** The report of a wash that the stored log says ended well. */
  private async reportForRestore(
    entry: Entry,
    line: SessionWashLine,
    manifest: WashManifest,
  ): Promise<WashReport> {
    // The report as it was delivered, kept with the session; else the result cache (sessions
    // stored before delivered reports were kept).
    const kept = this.store.readReport(line.job_id) ?? this.queue.cachedReport(line.cache_key);
    if (kept !== null) {
      entry.lastReport = kept;
      return kept;
    }
    // Never a silent second wash where scores are published: the code may have changed, and
    // the record would then carry a report that is not the one the player was given.
    if (this.benchmarkMode) {
      throw new Error(
        `the report delivered for wash '${line.job_id}' is no longer stored; ` +
          `the session is not restored by washing its load again`,
      );
    }
    const jobId = `${line.job_id}.again-${++this.clock}`;
    const ticket = this.queue.submit({
      jobId,
      sessionId: entry.id,
      manifest,
      ...(entry.washTier === null ? {} : { tier: entry.washTier }),
    });
    const report = await ticket.done;
    entry.lastReport = report;
    // The session's file says so: its record names the second wash and the code that ran it.
    this.store.writeReport(line.job_id, report);
    this.store.appendSession(entry.id, [
      {
        type: 'note',
        at: this.now(),
        rewashed: {
          job_id: line.job_id,
          ran_with: this.queue.job(jobId)?.ran_with ?? this.queue.identity.version,
        },
      },
    ]);
    return report;
  }

  private async open(sessionId: string, level: Level): Promise<Entry> {
    const gate = new WashGate();
    const session = await createSession({ level, washRunner: gate.runner });
    const entry: Entry = {
      id: sessionId,
      level,
      session,
      gate,
      recorder: new FrameRecorder(session, this.animationRateHz),
      subscribers: new Set(),
      persisted: 0,
      washes: 0,
      queueRecord: null,
      usedAt: ++this.clock,
      closed: false,
      player: null,
      opened: false,
      lastReport: null,
      washFailed: false,
      washTier: null,
    };
    gate.live = (manifest, onProgress) => this.liveWash(entry, manifest, onProgress);
    return entry;
  }

  /** Sets the least recently used idle session aside when every slot is taken. */
  private makeRoom(): void {
    if (this.entries.size + this.restoring.size < this.maxSessions) return;
    let candidate: Entry | null = null;
    for (const entry of this.entries.values()) {
      if (entry.subscribers.size > 0 || entry.session.phase() === 'washing') continue;
      if (candidate === null || entry.usedAt < candidate.usedAt) candidate = entry;
    }
    if (candidate === null) {
      throw new ServerError(
        'server_full',
        503,
        `all ${this.maxSessions} session slots are in use; try again later`,
      );
    }
    this.setAside(candidate);
  }

  /** Frees a session's world. Its log stays in the data directory. */
  private setAside(entry: Entry): void {
    entry.closed = true;
    this.entries.delete(entry.id);
    for (const send of entry.subscribers) {
      send({
        type: 'error',
        reason: 'unknown_session',
        detail: 'the session was taken out of memory; it can be restored from its log',
      });
    }
    entry.subscribers.clear();
    entry.session.dispose();
  }

  /**
   * Takes a session out of memory. Its log stays in the data directory, so it can be restored.
   * Returns false when no session with that id is in memory.
   */
  close(sessionId: string): boolean {
    const entry = this.entries.get(sessionId);
    if (entry === undefined) return false;
    this.setAside(entry);
    return true;
  }

  /** Takes every session out of memory. */
  closeAll(): void {
    for (const entry of [...this.entries.values()]) this.setAside(entry);
  }

  // -------------------------------------------------------------------------------------------
  // Actions, queries, pushes
  // -------------------------------------------------------------------------------------------

  /**
   * Runs a state-changing action of the session: records the motion for animation when someone
   * is watching, writes the new log events to disk, and pushes the animation and the scene.
   */
  act<R extends { readonly accepted: boolean }>(
    held: SessionEntry,
    name: ActionName,
    run: (session: GameSession) => R,
  ): R {
    const entry = this.live(held);
    this.assertLoadOpen(entry, name);
    const watched = entry.subscribers.size > 0;
    if (watched) entry.recorder.begin();
    let result: R;
    try {
      result = run(entry.session);
    } catch (error) {
      entry.recorder.discard();
      this.persist(entry);
      throw error;
    }
    const frames = result.accepted ? entry.recorder.end() : [];
    if (!result.accepted) entry.recorder.discard();
    this.persist(entry);
    if (watched) {
      const seq = entry.session.actionLog().length - 1;
      if (frames.length > 0) {
        this.broadcast(entry, {
          type: 'animation',
          seq,
          action: name,
          rate_hz: entry.recorder.rateHz,
          frames,
        });
      }
      const state = (result as { state?: SceneState }).state;
      const reason = (result as { reason?: unknown }).reason;
      this.broadcast(entry, {
        type: 'state',
        cause: {
          kind: 'action',
          seq,
          name,
          accepted: result.accepted,
          ...(typeof reason === 'string' ? { reason } : {}),
        },
        scene: sceneView(entry.session, result.accepted ? state : undefined),
      });
    }
    return result;
  }

  /** Runs a query of the session and writes the new log events to disk. */
  query<R>(held: SessionEntry, run: (session: GameSession) => R): R {
    const entry = this.live(held);
    try {
      return run(entry.session);
    } finally {
      this.persist(entry);
    }
  }

  /** The stored log of a session: its events in order. */
  log(held: SessionEntry): readonly ActionLogEvent[] {
    return this.live(held).session.actionLog();
  }

  /** What the server says about a session without touching its budget. */
  summary(held: SessionEntry): SessionSummary {
    const entry = this.live(held);
    const state = uncountedSceneState(entry.session);
    return {
      session_id: entry.id,
      level_id: entry.level.id,
      phase: state.phase,
      state_hash: state.state_hash,
      budget: state.budget,
      events: entry.session.actionLog().length,
      job: this.jobOf(entry),
      player: entry.player,
    };
  }

  /**
   * True when the session's wash is still waiting in the queue: `get_report` then says
   * `queued`, which the session itself, knowing nothing of the queue, reports as `running`.
   */
  washQueued(held: SessionEntry): boolean {
    const entry = this.live(held);
    return entry.session.phase() === 'washing' && entry.queueRecord?.status === 'queued';
  }

  /**
   * Adds a listener for the session's pushes and returns the function that removes it. The
   * caller sends the opening `hello` itself.
   */
  subscribe(held: SessionEntry, send: (message: ServerMessage) => void): () => void {
    const entry = this.live(held);
    this.markOpened(entry);
    entry.subscribers.add(send);
    return () => {
      entry.subscribers.delete(send);
    };
  }

  /** Frames per simulated second of the session's `animation` messages. */
  animationRate(held: SessionEntry): number {
    return this.live(held).recorder.rateHz;
  }

  private live(held: SessionEntry): Entry {
    const entry = this.entries.get(held.id);
    if (entry === undefined || entry !== held || entry.closed) {
      throw new ServerError('unknown_session', 404, `session '${held.id}' is no longer in memory`);
    }
    entry.usedAt = ++this.clock;
    return entry;
  }

  private jobOf(entry: Entry): SessionSummary['job'] {
    const job = currentWashJob(entry.session);
    if (job === null) return null;
    const status: JobStatus =
      job.status === 'running' && entry.queueRecord?.status === 'queued' ? 'queued' : job.status;
    return { job_id: job.id, status, progress: job.progress };
  }

  /** Writes the log events not yet on disk. */
  private persist(entry: Entry): void {
    const log = entry.session.actionLog();
    if (log.length <= entry.persisted) return;
    this.markOpened(entry);
    const at = this.now();
    const lines: SessionEventLine[] = log
      .slice(entry.persisted)
      .map((event) => ({ type: 'event', event, at }));
    this.store.appendSession(entry.id, lines);
    entry.persisted = log.length;
  }

  private broadcast(entry: Entry, message: ServerMessage): void {
    for (const send of [...entry.subscribers]) send(message);
  }

  // -------------------------------------------------------------------------------------------
  // Washes
  // -------------------------------------------------------------------------------------------

  /**
   * The wash runner of a live session: queues the wash, passes progress to the session and to
   * the watchers, and writes how it ended to the session's file before the session learns of
   * it, so that the file has the outcome at the point of the log where it took effect.
   */
  private liveWash(
    entry: Entry,
    manifest: WashManifest,
    onProgress: (fraction: number) => void,
  ): Promise<WashReport> {
    entry.washes += 1;
    const jobId = `${entry.id}.${entry.washes}`;
    const sessionJobId = currentWashJob(entry.session)?.id ?? jobId;
    const ticket = this.queue.submit({
      jobId,
      sessionId: entry.id,
      manifest,
      ...(entry.washTier === null ? {} : { tier: entry.washTier }),
      onUpdate: (record) => {
        entry.queueRecord = record;
        if (entry.closed) return;
        onProgress(record.progress);
        if (record.status === 'queued' || record.status === 'running') {
          this.broadcast(entry, {
            type: 'wash',
            job_id: sessionJobId,
            status: record.status,
            progress: record.progress,
          });
        }
      },
    });
    const cacheKey = ticket.record.cache_key;
    const ended = (status: 'done' | 'failed', error?: string): void => {
      if (entry.closed) return;
      entry.washFailed = status === 'failed';
      this.store.appendSession(entry.id, [
        {
          type: 'wash',
          job_id: jobId,
          status,
          cache_key: cacheKey,
          ...(error === undefined ? {} : { error }),
          at: this.now(),
        },
      ]);
      // Tell the watchers once the session has taken the outcome in.
      void entry.session.washSettled().then(() => {
        if (entry.closed) return;
        // The episode has an outcome: write its record (again after every wash of the session).
        try {
          this.store.writeEpisode(this.episodeRecord(entry));
        } catch {
          // A record that cannot be written takes nothing from the game: the session file,
          // from which it is built, is on disk, and the record can be asked for again.
        }
        this.broadcast(entry, {
          type: 'wash',
          job_id: sessionJobId,
          status,
          progress: status === 'done' ? 1 : (entry.queueRecord?.progress ?? 0),
          ...(error === undefined ? {} : { error }),
        });
        this.broadcast(entry, {
          type: 'state',
          cause: { kind: 'wash', job_id: sessionJobId, status },
          scene: sceneView(entry.session),
        });
      });
    };
    return ticket.done.then(
      (report) => {
        entry.lastReport = report;
        // What the player is told is kept with the session, whatever the result cache holds.
        if (!entry.closed) this.store.writeReport(jobId, report);
        ended('done');
        return report;
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        ended('failed', message);
        throw new Error(message);
      },
    );
  }
}
