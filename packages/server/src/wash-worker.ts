/**
 * Entry point of the wash worker: a child process of the server that runs one wash and exits.
 * It is started by the wash queue with an IPC channel, receives one `run` message naming the
 * runner module and carrying the manifest and the context of the wash (tier, cache
 * directories), reports progress, hands over the residue maps and the statistics of the run,
 * and answers with the report or with the failure. A separate process keeps the server
 * responsive for the minutes a wash takes, gives the wash the GPU and its gigabytes of memory
 * for itself and returns both when it ends, and a wash that crashes takes only itself down.
 *
 * Ending. The runner destroys its GPU device before it resolves or rejects, so the last
 * message leaves a process with nothing queued on the device. When the server asks the wash
 * to stop (SIGTERM: a time limit, or the server closing) or goes away (the channel
 * disconnects), the worker aborts the runner, which releases the device as soon as the
 * simulation next yields, and exits. A stage that does not yield is ended by the queue's
 * SIGKILL after a grace period.
 */

import type { ResidueMap, WashManifest, WashReport, WashStageProgress } from '@spotless/session';
import type { WashRunContext, WashRunStats } from '@spotless/wash-runner/contract';
import type { WashRunnerModule } from './types.ts';
import { WASH_RUNNER } from './wash-runner.ts';

/** What the queue tells the worker about the wash beside the manifest. Plain data. */
export type WorkerRunContext = Pick<
  WashRunContext,
  'tier' | 'exposureCacheDir' | 'timingsFile' | 'params' | 'acceptStaleParams'
>;

/** Server to worker. */
export interface WorkerRunMessage {
  readonly type: 'run';
  readonly runner: WashRunnerModule;
  readonly manifest: WashManifest;
  readonly context?: WorkerRunContext;
}

/** Worker to server. */
export type WorkerReply =
  | { readonly type: 'ready' }
  | {
      readonly type: 'progress';
      readonly fraction: number;
      /** The stage of the wash, from a runner that reports one. */
      readonly stage?: WashStageProgress;
    }
  | { readonly type: 'residue'; readonly maps: readonly ResidueMap[] }
  | { readonly type: 'stats'; readonly stats: WashRunStats }
  | {
      readonly type: 'done';
      readonly report: WashReport;
      /**
       * For the server's own runner: its version as the worker finds it once the wash is over
       * (it covers the source of the simulation). When it is not the version the wash was
       * keyed by, the source changed under the wash and the result is not kept in the cache.
       */
      readonly runner_version?: string;
    }
  | { readonly type: 'failed'; readonly error: string };

/** Smallest step of progress worth a message. */
const PROGRESS_STEP = 0.002;

/** Time the worker gives an aborted runner to let go of its device before it exits, ms. */
const ABORT_GRACE_MS = 1500;

/** The signature the worker calls a runner with: the session's hook plus the context. */
type CalledRunner = (
  manifest: WashManifest,
  onProgress: (fraction: number) => void,
  context: WashRunContext,
) => Promise<WashReport>;

function describe(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}

async function run(
  message: WorkerRunMessage,
  send: (reply: WorkerReply) => void,
  sendLast: (reply: WorkerReply) => void,
  signal: AbortSignal,
): Promise<void> {
  const loaded = (await import(message.runner.module)) as Record<string, unknown>;
  const runner = loaded[message.runner.exportName];
  if (typeof runner !== 'function') {
    throw new Error(
      `wash worker: '${message.runner.module}' has no function '${message.runner.exportName}'`,
    );
  }
  let sent = -1;
  let sentStage = '';
  const progress = (fraction: number, stage?: WashStageProgress): void => {
    if (!Number.isFinite(fraction)) return;
    const clamped = Math.min(1, Math.max(0, fraction));
    // A change of stage, or of how far the stage is, is always worth a message.
    const stageKey = stage === undefined ? sentStage : `${stage.stage} ${stage.fraction}`;
    if (stageKey === sentStage) {
      if (clamped - sent < PROGRESS_STEP && clamped < 1) return;
      if (clamped === sent) return;
    }
    sent = Math.max(sent, clamped);
    sentStage = stageKey;
    send({ type: 'progress', fraction: sent, ...(stage === undefined ? {} : { stage }) });
  };
  const context: WashRunContext = {
    ...message.context,
    // The wash began when this process did: loading the simulation is part of the wait.
    startedAt: 0,
    signal,
    onDetail: (detail) => {
      progress(detail.fraction, detail.stage);
    },
    onResidue: (maps) => {
      send({ type: 'residue', maps });
    },
    onStats: (stats) => {
      send({ type: 'stats', stats });
    },
    // The simulation's own remarks go to the server's log, which the worker's stderr is.
    onProblems: (problems) => {
      for (const problem of problems) {
        console.error(`wash of ${message.manifest.load.level_id}: ${problem}`);
      }
    },
  };
  const report = await (runner as CalledRunner)(
    message.manifest,
    (fraction) => {
      progress(fraction);
    },
    context,
  );
  const own =
    message.runner.module === WASH_RUNNER.module &&
    message.runner.exportName === WASH_RUNNER.exportName;
  sendLast({ type: 'done', report, ...(own ? { runner_version: WASH_RUNNER.version } : {}) });
}

if (typeof process.send === 'function') {
  const send = (reply: WorkerReply): void => {
    if (process.connected) process.send?.(reply);
  };
  /** Sends the last message and closes the channel once it has left. */
  const sendLast = (reply: WorkerReply): void => {
    if (!process.connected) {
      process.exit(0);
    }
    process.send?.(reply, () => {
      process.disconnect();
      // Nothing is left to do, and the GPU bindings may keep threads that hold the process.
      process.exit(0);
    });
  };
  const abort = new AbortController();
  let settled = false;
  /** Stops the wash: the runner lets go of the device, then the process ends. */
  const stop = (status: number): void => {
    if (abort.signal.aborted) return;
    abort.abort();
    const end = (): void => process.exit(status);
    if (settled) end();
    else setTimeout(end, ABORT_GRACE_MS).unref();
  };
  process.once('SIGTERM', () => {
    stop(143);
  });
  // The server has gone: nobody will collect this wash.
  process.once('disconnect', () => {
    stop(0);
  });
  process.once('message', (message: WorkerRunMessage) => {
    run(message, send, sendLast, abort.signal)
      .catch((error: unknown) => {
        settled = true;
        if (abort.signal.aborted) process.exit(143);
        sendLast({ type: 'failed', error: describe(error) });
      })
      .finally(() => {
        settled = true;
      });
  });
  send({ type: 'ready' });
}
