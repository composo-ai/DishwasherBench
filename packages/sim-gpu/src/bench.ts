/**
 * Timing of GPU work for benchmarks (docs/design/sim-core.md section 7.1: every kernel rate is
 * a planning rate until a measurement replaces it; docs/design/scope.md: each kernel is
 * benchmarked when it is written). The clock is read only here and in benchmark scripts, never
 * by simulation code (determinism rule 1).
 *
 * The clock stops only after the GPU has finished: `queue.submit` returns at once, so a timing
 * that does not await the device measures the encoding, not the work (spike report section 4).
 * Times are seconds; rates are work units per second.
 */

import { stackKey } from './stack.ts';
import type { GpuContext, StackString } from './types.ts';

/** Wall time of the repeats of one measurement, seconds. */
export interface BenchTimes {
  /** Shortest repeat. */
  readonly best: number;
  /** Median repeat (mean of the two middle ones for an even count). */
  readonly median: number;
  /** Longest repeat. */
  readonly worst: number;
  /** Every repeat, in the order run, rounded to a microsecond. */
  readonly samples: readonly number[];
}

/** Options of {@link measureGpu}. */
export interface MeasureOptions {
  /** Timed repeats; default 5. */
  readonly repeats?: number;
  /** Untimed runs first (pipeline warm-up, first touch of memory); default 1. */
  readonly warmups?: number;
  /** The clock, milliseconds; default `performance.now`. */
  readonly now?: () => number;
}

/** Median of a list of numbers. */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('median of no values');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : 0.5 * ((sorted[mid - 1] as number) + (sorted[mid] as number));
}

/**
 * Times `work`, which submits GPU work through the context (and may await it): each repeat
 * starts from an idle device and ends when `drain` resolves after the work's last submit.
 */
export async function measureGpu(
  ctx: Pick<GpuContext, 'drain'>,
  work: () => void | Promise<void>,
  options: MeasureOptions = {},
): Promise<BenchTimes> {
  const repeats = options.repeats ?? 5;
  const warmups = options.warmups ?? 1;
  const now = options.now ?? (() => performance.now());
  if (!Number.isInteger(repeats) || repeats < 1) throw new RangeError(`${repeats} repeats`);
  const samples: number[] = [];
  for (let i = 0; i < warmups + repeats; i++) {
    await ctx.drain();
    const start = now();
    await work();
    await ctx.drain();
    // Whole microseconds: finer digits of a wall-clock time mean nothing.
    const seconds = Math.round((now() - start) * 1000) / 1e6;
    if (i >= warmups) samples.push(seconds);
  }
  return {
    best: Math.min(...samples),
    median: medianOf(samples),
    worst: Math.max(...samples),
    samples,
  };
}

/** One measured quantity of a benchmark. */
export interface BenchResult {
  /** What was measured, for example `stencil 2048x2048, 8x8 workgroups`. */
  readonly name: string;
  /** Work done per repeat, in `unit`. */
  readonly work: number;
  /** Unit of the work, for example `cell updates`. */
  readonly unit: string;
  /** Times of the repeats, seconds. */
  readonly time: BenchTimes;
  /** `work / time.best` and `work / time.median`, units per second. */
  readonly rate: { readonly best: number; readonly median: number };
}

/** Builds a {@link BenchResult} from the work per repeat and its times. */
export function benchResult(
  name: string,
  work: number,
  unit: string,
  time: BenchTimes,
): BenchResult {
  return { name, work, unit, time, rate: { best: work / time.best, median: work / time.median } };
}

/** A benchmark's results with the stack they were measured on. */
export interface BenchReport {
  /** Name of the benchmark. */
  readonly benchmark: string;
  /** The stack, as a record and as the one-line key that results and caches carry. */
  readonly stack: StackString;
  readonly stackKey: string;
  /** When the benchmark finished, ISO 8601 (wall clock; benchmarks may read it). */
  readonly finishedAt: string;
  /** Seconds this process waited for the cross-process benchmark lock, or null if unlocked. */
  readonly lockWaited: number | null;
  /** The measurements. */
  readonly results: readonly BenchResult[];
}

/** Builds a {@link BenchReport}. */
export function benchReport(
  benchmark: string,
  stack: StackString,
  results: readonly BenchResult[],
  lockWaited: number | null,
  finishedAt: Date = new Date(),
): BenchReport {
  return {
    benchmark,
    stack,
    stackKey: stackKey(stack),
    finishedAt: finishedAt.toISOString(),
    lockWaited,
    results,
  };
}
