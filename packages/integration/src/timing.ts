/**
 * Wall-clock cost of stepping a physics world. The numbers depend on the machine and on what
 * else it is doing; they are recorded for the record, never asserted beyond a generous ceiling.
 */

import type { PhysicsWorld } from '@spotless/physics';

/** Statistics of the wall-clock time of single steps, milliseconds. */
export interface StepTimeStats {
  /** Number of steps timed. */
  readonly steps: number;
  /** Simulated time they cover, seconds. */
  readonly simulatedSeconds: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  /** Sum over all steps, milliseconds. */
  readonly totalMs: number;
}

/**
 * Advances a world by `steps` single steps and returns the wall-clock time each one took,
 * milliseconds. `afterStep` is called after every step, outside the timed interval.
 */
export function timeSteps(
  world: PhysicsWorld,
  steps: number,
  afterStep?: (index: number) => void,
): number[] {
  const times: number[] = [];
  for (let i = 0; i < steps; i++) {
    const start = performance.now();
    world.step(1);
    times.push(performance.now() - start);
    if (afterStep !== undefined) afterStep(i);
  }
  return times;
}

/** Mean, median, 95th and 99th percentile and maximum of a list of step times (milliseconds). */
export function summariseStepTimes(times: readonly number[], timeStep: number): StepTimeStats {
  if (times.length === 0) throw new RangeError('integration: no step times to summarise');
  const sorted = [...times].sort((a, b) => a - b);
  // Nearest-rank percentile: the smallest value with at least the given share at or below it.
  const rank = (share: number): number =>
    sorted[
      Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1))
    ] as number;
  const total = times.reduce((sum, t) => sum + t, 0);
  return {
    steps: times.length,
    simulatedSeconds: times.length * timeStep,
    meanMs: total / times.length,
    medianMs: rank(0.5),
    p95Ms: rank(0.95),
    p99Ms: rank(0.99),
    maxMs: sorted[sorted.length - 1] as number,
    totalMs: total,
  };
}

/** One line describing step-time statistics, for logs and reports. */
export function formatStepTimes(label: string, stats: StepTimeStats): string {
  const ms = (x: number): string => x.toFixed(3);
  return (
    `${label}: ${stats.steps} steps (${stats.simulatedSeconds.toFixed(2)} s simulated) in ` +
    `${stats.totalMs.toFixed(0)} ms; per step mean ${ms(stats.meanMs)} ms, median ` +
    `${ms(stats.medianMs)} ms, p95 ${ms(stats.p95Ms)} ms, p99 ${ms(stats.p99Ms)} ms, max ` +
    `${ms(stats.maxMs)} ms`
  );
}
