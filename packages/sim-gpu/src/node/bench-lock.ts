/**
 * Node-only: the cross-process benchmark lock and the writing of benchmark reports. Two GPU
 * benchmarks that overlap each get about half the throughput (spike report section 14:
 * 4.1 against 2.0 G cell updates per second), so every benchmark script takes this lock before
 * it touches the GPU, and benchmarks take turns.
 *
 * The lock is a directory created with `mkdir`, which is atomic, holding `owner.json`
 * (`{ pid, command, since }`). It is released when the process exits. A lock whose owner is no
 * longer alive is stale and is taken over. It is one lock for the machine (in the system's
 * temporary directory), so checkouts and packages share it; `SPOTLESS_BENCH_LOCK` names another
 * path. It cannot stop a test run or another program from using the GPU at the same time.
 */

import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { BenchReport } from '../bench.ts';

/** Default path of the lock directory. */
export function defaultBenchLockPath(): string {
  return process.env['SPOTLESS_BENCH_LOCK'] ?? join(tmpdir(), 'spotless-gpu-bench.lock');
}

/** A held benchmark lock. */
export interface BenchLock {
  /** Seconds waited before the lock was acquired. */
  readonly waited: number;
  /** Releases the lock; also happens when the process exits. */
  release(): void;
}

/** Options of {@link acquireBenchLock}. */
export interface BenchLockOptions {
  /** Lock directory; default {@link defaultBenchLockPath}. */
  readonly path?: string;
  /** Longest wait, seconds; default 2700 (45 minutes). The promise rejects after it. */
  readonly maxWait?: number;
  /** Interval between attempts, seconds; default 0.5. */
  readonly poll?: number;
  /** Receives a line when waiting starts and every 20 s; default `console.error`. */
  readonly log?: (line: string) => void;
}

interface Owner {
  readonly pid: number;
  readonly command: string;
  readonly since: string;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readOwner(path: string): Owner | null {
  try {
    return JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8')) as Owner;
  } catch {
    return null;
  }
}

const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 1000 * seconds));

/** Locks this process holds, by path, so that a path cannot be acquired twice from one process. */
const held = new Set<string>();

/**
 * Waits for the benchmark lock and takes it. Rejects if it cannot be had within `maxWait`: a
 * benchmark never proceeds unlocked, because its numbers would then be wrong without saying so.
 */
export async function acquireBenchLock(options: BenchLockOptions = {}): Promise<BenchLock> {
  const path = options.path ?? defaultBenchLockPath();
  const maxWait = options.maxWait ?? 2700;
  const poll = options.poll ?? 0.5;
  const log = options.log ?? ((line: string) => console.error(line));
  const started = Date.now();
  let lastLog = -Infinity;
  for (;;) {
    let created = false;
    if (!held.has(path)) {
      try {
        mkdirSync(path);
        created = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    if (created) {
      const owner: Owner = {
        pid: process.pid,
        command: process.argv.slice(1).join(' '),
        since: new Date().toISOString(),
      };
      writeFileSync(join(path, 'owner.json'), JSON.stringify(owner));
      // Settle: if two waiters raced on a stale lock, only the one whose pid survived in
      // owner.json proceeds.
      await sleep(0.15);
      if (readOwner(path)?.pid === process.pid) break;
      continue;
    }
    const owner = readOwner(path);
    let stale = false;
    if (held.has(path)) {
      stale = false;
    } else if (owner !== null) {
      stale = !isAlive(owner.pid);
    } else {
      // A directory without an owner file: being created right now, or left by a crash.
      try {
        stale = Date.now() - statSync(path).mtimeMs > 5000;
      } catch {
        stale = false;
      }
    }
    if (stale) {
      rmSync(path, { recursive: true, force: true });
      continue;
    }
    const waited = (Date.now() - started) / 1000;
    if (waited > maxWait) {
      throw new Error(
        `benchmark lock ${path} is held by pid ${owner?.pid ?? '?'} (${owner?.command ?? '?'}) ` +
          `since ${owner?.since ?? '?'}; gave up after ${waited.toFixed(1)} s`,
      );
    }
    if (waited - lastLog >= 20) {
      lastLog = waited;
      log(
        `[benchlock] waiting for pid ${owner?.pid ?? '?'} (${owner?.command ?? '?'}), which holds ` +
          `${path} since ${owner?.since ?? '?'}`,
      );
    }
    await sleep(poll);
  }
  held.add(path);
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    held.delete(path);
    process.removeListener('exit', release);
    if (readOwner(path)?.pid === process.pid) rmSync(path, { recursive: true, force: true });
  };
  process.on('exit', release);
  return { waited: (Date.now() - started) / 1000, release };
}

/** Writes a benchmark report as indented JSON, creating the directory, and returns the path. */
export function writeBenchReport(path: string, report: BenchReport): string {
  mkdirSync(dirname(path), { recursive: true });
  // Lists of numbers on one line, as the repository's formatter prints them.
  const text = JSON.stringify(report, null, 2).replace(
    /\[\s+(-?[0-9.e+-]+(?:,\s+-?[0-9.e+-]+)*)\s+\]/g,
    (_all, list: string) => `[${list.split(/,\s+/).join(', ')}]`,
  );
  writeFileSync(path, `${text}\n`);
  return path;
}
