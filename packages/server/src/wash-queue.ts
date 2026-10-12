/**
 * The wash job queue: one wash at a time, in the order the cycles were started, each run by
 * the wash runner in a worker process so that the server stays responsive. One at a time
 * because a wash has the GPU and up to a few gigabytes of memory to itself. Finished reports
 * are stored in the data directory under a key made of the runner's identity (its version
 * covers the source of the simulation, `wash-runner.ts`), the tier and the canonical load
 * manifest, and a wash whose key is already stored is answered from there.
 *
 * Beside the report a runner may hand over the residue maps of the washed items (kept in
 * `<data>/residue/<cache key>.json` and served one item at a time, `residueOf`), the stage
 * the wash is in with an estimate of the time remaining (kept in the job record while it
 * runs, `stageOf`), and the statistics of the run (kept in the job record when it is done).
 * The simulation keeps its exposure cache in `<data>/exposure-cache/<runner version>/` and the
 * runner its stage timings in `<data>/wash-timings.json`.
 *
 * A wash that cannot be run to a report (the worker died, the runner threw, the report is not
 * a report, the time limit passed) is a failed job with the reason in words. It is never a
 * report with a score of zero.
 */

import type { ChildProcess } from 'node:child_process';
import { fork } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256Hex } from '@spotless/core';
import type {
  ResidueMap,
  WashManifest,
  WashReport,
  WashRunner,
  WashStageProgress,
  WashTier,
} from '@spotless/session';
import { washParamsFingerprint } from '@spotless/wash-runner/contract';
import { withVerdicts } from './verdicts.ts';
import type { WashParamChoice, WashRunContext, WashRunStats } from '@spotless/wash-runner/contract';
import type { DataStore } from './store.ts';
import { isSafeId } from './store.ts';
import type { WashJobRecord, WashRunnerIdentity, WashRunnerModule } from './types.ts';
import type { WorkerReply, WorkerRunContext, WorkerRunMessage } from './wash-worker.ts';

/** Options of {@link WashQueue}. */
export interface WashQueueOptions {
  readonly store: DataStore;
  /** A module run in the worker process, or a function run in this process (tests). */
  readonly runner: WashRunnerModule | WashRunner;
  /** Version of a runner given as a function; default `'inline'`. */
  readonly runnerVersion?: string;
  /** Kill a wash after this long, milliseconds; 0 or absent for no limit. */
  readonly timeoutMs?: number;
  /** The tier washes are asked for; default `fast`. The rules of a level may say otherwise. */
  readonly tier?: WashTier;
  /**
   * Which parameters washes are run with (`@spotless/wash-runner/contract`); default the
   * machine's own: for the owner's machine the current anchored set with the owner's
   * detergent.
   */
  readonly params?: WashParamChoice;
  /**
   * True to wash with a parameter-set file whose stored hashes are stale (the report then
   * says so); default false: such a wash fails and says what to do.
   */
  readonly acceptStaleParams?: boolean;
  /**
   * How long a worker that was told to stop (SIGTERM) is given to let go of the GPU before it
   * is killed, milliseconds; default 4000.
   */
  readonly killGraceMs?: number;
  /**
   * Benchmark mode: a wash whose worker ran other source than the wash was keyed by (a file of
   * the simulation changed between the submission and the worker's start) is failed as an
   * infrastructure failure, to be started again, instead of being delivered. Default false:
   * the result is delivered, named by the code that ran, and not kept in the result cache.
   */
  readonly strictSource?: boolean;
  /** Wall-clock source for the timestamps of job records. */
  readonly now: () => string;
}

/** A wash handed to the queue. */
export interface WashSubmission {
  /** Id of the job, unique among jobs and safe as a file name. */
  readonly jobId: string;
  readonly sessionId: string;
  readonly manifest: WashManifest;
  /** The tier of this wash; default the queue's. */
  readonly tier?: WashTier;
  /** Called whenever the job's record changes (status or progress). */
  readonly onUpdate?: (record: WashJobRecord) => void;
}

/** A submitted wash. */
export interface WashTicket {
  /** The job as it stands right after submission (`done` already when the cache answered). */
  readonly record: WashJobRecord;
  /**
   * Resolves with the report; rejects with the infrastructure failure. Stays pending when the
   * queue is closed before the wash ended.
   */
  readonly done: Promise<WashReport>;
}

interface QueuedJob {
  record: WashJobRecord;
  /** When the stage of the record was reported, on the clock of the process, milliseconds. */
  stageAt?: number;
  readonly submission: WashSubmission;
  readonly resolve: (report: WashReport) => void;
  readonly reject: (error: Error) => void;
}

/** What a run of a wash produced beside the report. */
interface RunExtras {
  residue: readonly ResidueMap[] | null;
  stats: WashRunStats | null;
  /** False when the worker ran other code than the wash was keyed by: the result is not kept. */
  keep: boolean;
  /** The runner's version as the worker found it after the wash, when it says. */
  ranWith: string | null;
}

/** The residue maps of one wash as stored: `<data>/residue/<cache key>.json`. */
interface ResidueFile {
  readonly cache_key: string;
  readonly maps: { readonly [itemId: string]: ResidueMap };
}

/** Jobs remembered in memory; older ones are read back from the data directory. */
const JOBS_REMEMBERED = 500;

/** Directories of the exposure cache kept beside the current one (older versions of the code). */
const EXPOSURE_VERSIONS_KEPT = 2;

const WORKER_PATH = fileURLToPath(new URL('./wash-worker.ts', import.meta.url));
/** The package directory: where `tsx` and the runner's module are resolved from. */
const PACKAGE_DIR = resolve(dirname(WORKER_PATH), '..');

/**
 * What is wrong with a report as the result of washing a manifest, or null. Catches a runner
 * that returns something else than a report of this load; it does not judge the wash.
 */
export function reportProblem(report: unknown, manifest: WashManifest): string | null {
  if (typeof report !== 'object' || report === null) return 'the runner returned no report';
  const r = report as Partial<WashReport>;
  if (r.level_id !== manifest.load.level_id) return 'the report is for another level';
  if (r.state_hash !== manifest.load.state_hash) return 'the report is for another load';
  if (typeof r.job !== 'object' || r.job === null || r.job.status !== 'done') {
    return 'the report does not say the wash is done';
  }
  if (typeof r.score !== 'object' || r.score === null) return 'the report has no score';
  for (const value of [r.score.points, r.score.points_available, r.score.graded_points]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'the score of the report is not made of finite numbers';
    }
  }
  if (!Array.isArray(r.items) || r.items.length !== manifest.level.items.length) {
    return 'the report does not have one entry per item of the level';
  }
  return null;
}

/**
 * The report naming the code that produced it: the runner's version as the worker found it
 * once the wash was over (it ends in the fingerprint of the simulation's source), in place of
 * the runner's bare version. So a report, wherever it is copied to, says what computed it.
 */
function stamped(report: WashReport, ranWith: string | null): WashReport {
  if (ranWith === null || report.job.runner_version === ranWith) return report;
  return { ...report, job: { ...report.job, runner_version: ranWith } };
}

/** The single-worker wash queue with its result cache. */
export class WashQueue {
  /** The tier washes are asked for when a submission names none. */
  readonly tier: WashTier;
  private readonly store: DataStore;
  private readonly runner: WashRunnerModule | WashRunner;
  private readonly inlineVersion: string;
  private readonly timeoutMs: number;
  private readonly killGraceMs: number;
  private readonly strictSource: boolean;
  private readonly params: WashParamChoice | undefined;
  private readonly acceptStaleParams: boolean;
  private readonly now: () => string;
  private readonly residueDir: string;
  private readonly waiting: QueuedJob[] = [];
  private running: QueuedJob | null = null;
  private child: ChildProcess | null = null;
  private readonly records = new Map<string, WashJobRecord>();
  /** Cache key of the last wash of each session that ended well. */
  private readonly lastDone = new Map<string, string>();
  /** The residue file read last. */
  private residueRead: ResidueFile | null = null;
  private closed = false;

  constructor(options: WashQueueOptions) {
    this.store = options.store;
    this.runner = options.runner;
    this.inlineVersion = options.runnerVersion ?? 'inline';
    this.timeoutMs = options.timeoutMs ?? 0;
    this.killGraceMs = options.killGraceMs ?? 4000;
    this.strictSource = options.strictSource ?? false;
    this.params = options.params;
    this.acceptStaleParams = options.acceptStaleParams ?? false;
    this.tier = options.tier ?? 'fast';
    this.now = options.now;
    this.residueDir = join(options.store.dir, 'residue');
  }

  /**
   * Which code runs the washes of this queue. The version of a runner module is read each time
   * (that of the server's own runner follows the source of the simulation, `wash-runner.ts`).
   */
  get identity(): WashRunnerIdentity {
    const runner = this.runner;
    // The named parameter sets and the detergent, by the bytes of their files (read each
    // time: a set that was made again under the same name is another wash).
    const params = washParamsFingerprint(this.params, this.acceptStaleParams);
    return typeof runner === 'function'
      ? {
          module: 'inline',
          export_name: runner.name === '' ? 'anonymous' : runner.name,
          version: this.inlineVersion,
          ...(this.params !== undefined || this.acceptStaleParams ? { params } : {}),
        }
      : {
          module: runner.module,
          export_name: runner.exportName,
          version: runner.version,
          params,
        };
  }

  /**
   * Key of a wash in the result cache: SHA-256 of the canonical JSON of the runner's identity
   * (module, export, version, which for the simulation covers its source, and the fingerprint
   * of the parameters the washes are run with), the tier asked for, and the whole manifest
   * (level with its rules, machine configuration, programme, every
   * loaded item with its exact pose and soils, the mechanical findings, the seed, and the hash
   * of the scene).
   */
  cacheKey(manifest: WashManifest, tier: WashTier = this.tier): string {
    return sha256Hex(canonicalJson({ runner: this.identity, tier, manifest }));
  }

  /** The context a wash is run with: the tier and where the runner keeps what it keeps. */
  private context(tier: WashTier): WorkerRunContext {
    const version = this.identity.version.replace(/[^0-9A-Za-z._+-]/g, '_');
    return {
      tier,
      exposureCacheDir: join(this.store.dir, 'exposure-cache', version),
      timingsFile: join(this.store.dir, 'wash-timings.json'),
      ...(this.params === undefined ? {} : { params: this.params }),
      ...(this.acceptStaleParams ? { acceptStaleParams: true } : {}),
    };
  }

  /**
   * Removes the exposure caches of older versions of the code, all but the newest few: an
   * exposure set of a full load is tens of megabytes and is never read again once the code
   * that computed it has changed.
   */
  private pruneExposureCaches(current: string): void {
    const root = dirname(current);
    try {
      const others = readdirSync(root)
        .map((name) => join(root, name))
        .filter((path) => path !== current && statSync(path).isDirectory())
        .map((path) => ({ path, at: statSync(path).mtimeMs }))
        .sort((a, b) => b.at - a.at);
      for (const stale of others.slice(EXPOSURE_VERSIONS_KEPT)) {
        rmSync(stale.path, { recursive: true, force: true });
      }
    } catch {
      // Nothing to prune, or it cannot be pruned now: the next wash tries again.
    }
  }

  // -------------------------------------------------------------------------------------------
  // Residue maps
  // -------------------------------------------------------------------------------------------

  private residuePath(cacheKey: string): string | null {
    return isSafeId(cacheKey) ? join(this.residueDir, `${cacheKey}.json`) : null;
  }

  private writeResidue(cacheKey: string, maps: readonly ResidueMap[]): void {
    const path = this.residuePath(cacheKey);
    if (path === null) return;
    mkdirSync(this.residueDir, { recursive: true });
    const file: ResidueFile = {
      cache_key: cacheKey,
      maps: Object.fromEntries(maps.map((map) => [map.item_id, map])),
    };
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(file)}\n`);
    renameSync(temporary, path);
    this.residueRead = file;
  }

  /** The residue map of one item of the wash with that cache key, or null when none is stored. */
  residueMap(cacheKey: string, itemId: string): ResidueMap | null {
    if (this.residueRead?.cache_key !== cacheKey) {
      const path = this.residuePath(cacheKey);
      if (path === null || !existsSync(path)) return null;
      try {
        const file = JSON.parse(readFileSync(path, 'utf8')) as ResidueFile;
        if (file.cache_key !== cacheKey || typeof file.maps !== 'object') return null;
        this.residueRead = file;
      } catch {
        return null;
      }
    }
    const maps = this.residueRead.maps;
    return Object.hasOwn(maps, itemId) ? (maps[itemId] ?? null) : null;
  }

  /**
   * Cache key of the last wash of a session that ended well, or null: from the washes this
   * queue has seen, else from the outcomes recorded in the session's file.
   */
  lastWashKey(sessionId: string): string | null {
    const known = this.lastDone.get(sessionId);
    if (known !== undefined) return known;
    if (!this.store.hasSession(sessionId)) return null;
    try {
      const lines = this.store.readSession(sessionId).lines;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line?.type === 'wash' && line.status === 'done') {
          this.lastDone.set(sessionId, line.cache_key);
          return line.cache_key;
        }
      }
    } catch {
      // A session file that cannot be read has no outcome to offer.
    }
    return null;
  }

  /**
   * The residue map of one item of the last finished wash of a session, or null when the
   * session has no finished wash, the item was not washed, or no residue map was stored for
   * the wash (a result from a runner that makes none).
   */
  residueOf(sessionId: string, itemId: string): ResidueMap | null {
    const key = this.lastWashKey(sessionId);
    return key === null ? null : this.residueMap(key, itemId);
  }

  /** The stage the wash of a session is in, or null when it has none running that reports one. */
  stageOf(sessionId: string): WashStageProgress | null {
    const job = this.running;
    if (job === null || job.submission.sessionId !== sessionId) return null;
    const stage = job.record.stage;
    if (stage === undefined) return null;
    const ago = Math.max(0, (performance.now() - (job.stageAt ?? performance.now())) / 1000);
    return { ...stage, reported_ago_s: Math.round(ago * 10) / 10 };
  }

  /** The stored report of a cache key, or null. */
  cachedReport(cacheKey: string): WashReport | null {
    return this.store.readWash(cacheKey)?.report ?? null;
  }

  /** A job by id: from memory, else as last recorded in the data directory. */
  job(jobId: string): WashJobRecord | null {
    return this.records.get(jobId) ?? this.store.readJob(jobId);
  }

  /** The jobs of this run of the server, oldest first. */
  jobs(): WashJobRecord[] {
    return [...this.records.values()];
  }

  /** Number of jobs waiting or running. */
  get pending(): number {
    return this.waiting.length + (this.running === null ? 0 : 1);
  }

  /** Queues a wash, or answers it from the cache. */
  submit(submission: WashSubmission): WashTicket {
    if (this.closed) throw new Error('wash queue: closed');
    const tier = submission.tier ?? this.tier;
    const cacheKey = this.cacheKey(submission.manifest, tier);
    const base: WashJobRecord = {
      job_id: submission.jobId,
      session_id: submission.sessionId,
      level_id: submission.manifest.load.level_id,
      state_hash: submission.manifest.load.state_hash,
      cache_key: cacheKey,
      status: 'queued',
      progress: 0,
      cached: false,
      runner: this.identity,
      queued_at: this.now(),
      tier,
    };
    const cached = this.cachedReport(cacheKey);
    if (cached !== null && reportProblem(cached, submission.manifest) === null) {
      const record: WashJobRecord = {
        ...base,
        status: 'done',
        progress: 1,
        cached: true,
        finished_at: base.queued_at,
      };
      this.lastDone.set(submission.sessionId, cacheKey);
      this.remember(record, submission);
      return { record, done: Promise.resolve(cached) };
    }
    let resolveDone: (report: WashReport) => void = () => undefined;
    let rejectDone: (error: Error) => void = () => undefined;
    const done = new Promise<WashReport>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });
    const job: QueuedJob = {
      record: base,
      submission,
      resolve: resolveDone,
      reject: rejectDone,
    };
    this.waiting.push(job);
    this.remember(base, submission);
    // Start on a later tick, so that the caller holds the ticket before anything happens.
    queueMicrotask(() => {
      this.pump();
    });
    return { record: base, done };
  }

  /**
   * Stops the queue: the running wash is killed and nothing further starts. Jobs that had not
   * ended are left without an outcome, so that a session restored later queues them again.
   */
  close(): void {
    this.closed = true;
    this.waiting.length = 0;
    const child = this.child;
    this.child = null;
    if (child !== null) this.stop(child);
  }

  /**
   * Stops a worker: asks it to end (SIGTERM, on which it lets go of the GPU device) and kills
   * it if it has not ended after the grace period (a stage of the simulation that does not
   * yield never sees the request).
   */
  private stop(child: ChildProcess): void {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, this.killGraceMs);
    timer.unref();
    child.once('exit', () => {
      clearTimeout(timer);
    });
  }

  private remember(record: WashJobRecord, submission: WashSubmission): void {
    this.records.delete(record.job_id);
    this.records.set(record.job_id, record);
    if (this.records.size > JOBS_REMEMBERED) {
      const oldest = this.records.keys().next();
      if (oldest.done !== true) this.records.delete(oldest.value);
    }
    if (record.status !== 'running' || record.progress === 0) this.store.writeJob(record);
    submission.onUpdate?.(record);
  }

  private update(job: QueuedJob, change: Partial<WashJobRecord>): void {
    job.record = { ...job.record, ...change };
    this.remember(job.record, job.submission);
  }

  private pump(): void {
    if (this.closed || this.running !== null) return;
    const job = this.waiting.shift();
    if (job === undefined) return;
    this.running = job;
    const { manifest } = job.submission;
    // An identical wash may have finished while this one waited.
    const cached = this.cachedReport(job.record.cache_key);
    if (cached !== null && reportProblem(cached, manifest) === null) {
      this.finish(job, withVerdicts(cached, manifest), true);
      return;
    }
    this.update(job, { status: 'running', started_at: this.now() });
    const onProgress = (fraction: number, stage?: WashStageProgress): void => {
      if (this.running !== job || !Number.isFinite(fraction)) return;
      const progress = Math.min(1, Math.max(job.record.progress, fraction));
      if (progress !== job.record.progress || stage !== undefined) {
        if (stage !== undefined) job.stageAt = performance.now();
        this.update(job, { progress, ...(stage === undefined ? {} : { stage }) });
      }
    };
    const extras: RunExtras = { residue: null, stats: null, keep: true, ranWith: null };
    const context = this.context(job.record.tier ?? this.tier);
    if (context.exposureCacheDir !== undefined) this.pruneExposureCaches(context.exposureCacheDir);
    const run =
      typeof this.runner === 'function'
        ? this.runInline(this.runner, manifest, onProgress, context, extras)
        : this.runInChild(this.runner, manifest, onProgress, context, extras);
    run.then(
      (report) => {
        if (this.closed) return;
        const problem = reportProblem(report, manifest);
        if (problem !== null) {
          this.fail(job, `wash runner: ${problem}`);
        } else if (this.strictSource && !extras.keep) {
          this.fail(
            job,
            `the source of the simulation changed while the wash was being started ` +
              `(keyed by '${job.record.runner.version}', ran with '${extras.ranWith ?? 'unknown'}'); ` +
              `no result is given: start the cycle again`,
            extras,
          );
        } else {
          // The report is delivered with its verdict summary (`verdicts.ts`): what is at the
          // edge of clean, what is provisional, and how the points were counted.
          this.finish(job, withVerdicts(stamped(report, extras.ranWith), manifest), false, extras);
        }
      },
      (error: unknown) => {
        if (this.closed) return;
        this.fail(job, error instanceof Error ? error.message : String(error));
      },
    );
  }

  private finish(job: QueuedJob, report: WashReport, cached: boolean, extras?: RunExtras): void {
    const key = job.record.cache_key;
    if (!cached) {
      // The maps first: a stored report always has its maps beside it.
      if (extras?.residue != null) this.writeResidue(key, extras.residue);
      if (extras?.keep !== false) {
        this.store.writeWash({
          cache_key: key,
          runner: job.record.runner,
          level_id: job.record.level_id,
          state_hash: job.record.state_hash,
          stored_at: this.now(),
          report,
        });
      }
    }
    this.lastDone.set(job.submission.sessionId, key);
    const { stage: _stage, ...rest } = job.record;
    job.record = rest;
    this.update(job, {
      status: 'done',
      progress: 1,
      cached,
      finished_at: this.now(),
      ...(extras?.stats == null ? {} : { stats: extras.stats }),
      ...(extras?.ranWith == null ? {} : { ran_with: extras.ranWith }),
    });
    this.running = null;
    job.resolve(report);
    this.pump();
  }

  private fail(job: QueuedJob, error: string, extras?: RunExtras): void {
    this.update(job, {
      status: 'failed',
      error,
      finished_at: this.now(),
      ...(extras?.ranWith == null ? {} : { ran_with: extras.ranWith }),
    });
    this.running = null;
    job.reject(new Error(error));
    this.pump();
  }

  private async runInline(
    runner: WashRunner,
    manifest: WashManifest,
    onProgress: (fraction: number, stage?: WashStageProgress) => void,
    workerContext: WorkerRunContext,
    extras: RunExtras,
  ): Promise<WashReport> {
    // Never on the caller's stack: a runner that works synchronously must not hold up submit.
    await new Promise<void>((next) => setImmediate(next));
    const abort = new AbortController();
    // A runner that takes a context (the simulation's) gets it; any other ignores the argument.
    const context: WashRunContext = {
      ...workerContext,
      signal: abort.signal,
      onDetail: (detail) => {
        onProgress(detail.fraction, detail.stage);
      },
      onResidue: (maps) => {
        extras.residue = maps;
      },
      onStats: (stats) => {
        extras.stats = stats;
      },
    };
    const call = runner as (
      manifest: WashManifest,
      onProgress: (fraction: number) => void,
      context: WashRunContext,
    ) => Promise<WashReport>;
    const limit = this.timeoutMs;
    if (limit <= 0) return call(manifest, onProgress, context);
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_, rej) => {
      timer = setTimeout(() => {
        abort.abort();
        rej(new Error(`wash timed out after ${limit} ms`));
      }, limit);
      // The limit ends a wash; it does not keep a process alive that has nothing else to do.
      timer.unref();
    });
    try {
      return await Promise.race([call(manifest, onProgress, context), expired]);
    } finally {
      clearTimeout(timer);
    }
  }

  private runInChild(
    runner: WashRunnerModule,
    manifest: WashManifest,
    onProgress: (fraction: number, stage?: WashStageProgress) => void,
    context: WorkerRunContext,
    extras: RunExtras,
  ): Promise<WashReport> {
    // The version the wash was keyed by, fixed here: the worker says which it ran with.
    const keyed: WashRunnerModule = {
      module: runner.module,
      exportName: runner.exportName,
      version: this.running?.record.runner.version ?? runner.version,
    };
    return new Promise<WashReport>((resolveRun, rejectRun) => {
      const child = fork(WORKER_PATH, [], {
        cwd: PACKAGE_DIR,
        execArgv: ['--import', 'tsx'],
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      this.child = child;
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const settle = (act: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.child === child) this.child = null;
        act();
      };
      if (this.timeoutMs > 0) {
        const limit = this.timeoutMs;
        timer = setTimeout(() => {
          settle(() => {
            this.stop(child);
            rejectRun(new Error(`wash timed out after ${limit} ms`));
          });
        }, limit);
        timer.unref();
      }
      child.on('message', (reply: WorkerReply) => {
        if (reply.type === 'ready') {
          const message: WorkerRunMessage = { type: 'run', runner: keyed, manifest, context };
          child.send(message);
        } else if (reply.type === 'progress') {
          onProgress(reply.fraction, reply.stage);
        } else if (reply.type === 'residue') {
          extras.residue = reply.maps;
        } else if (reply.type === 'stats') {
          extras.stats = reply.stats;
        } else if (reply.type === 'done') {
          if (reply.runner_version !== undefined) {
            extras.ranWith = reply.runner_version;
            if (reply.runner_version !== keyed.version) extras.keep = false;
          }
          settle(() => {
            resolveRun(reply.report);
          });
        } else {
          settle(() => {
            rejectRun(new Error(`wash runner failed: ${reply.error}`));
          });
        }
      });
      child.on('error', (error) => {
        settle(() => {
          rejectRun(new Error(`wash worker could not be run: ${error.message}`));
        });
      });
      child.on('exit', (code, signal) => {
        settle(() => {
          rejectRun(
            new Error(
              `wash worker ended without a report (${signal === null ? `exit code ${code}` : `signal ${signal}`})`,
            ),
          );
        });
      });
    });
  }
}
