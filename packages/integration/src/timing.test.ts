// The step-time statistics against values worked out by hand.
import type { PhysicsWorld } from '@spotless/physics';
import { describe, expect, it } from 'vitest';
import { formatStepTimes, summariseStepTimes, timeSteps } from './timing.ts';

describe('step-time statistics', () => {
  it('summarises 1, 2, ..., 100 ms by nearest rank', () => {
    // Shuffled deterministically: the order of the samples does not matter.
    const times = Array.from({ length: 100 }, (_, i) => ((i * 37) % 100) + 1);
    const stats = summariseStepTimes(times, 1 / 240);
    expect(stats.steps).toBe(100);
    expect(stats.simulatedSeconds).toBeCloseTo(100 / 240, 12);
    // Sum 5050; the smallest value with at least half, 95 % and 99 % of the samples at or below
    // it is the 50th, 95th and 99th.
    expect(stats.totalMs).toBe(5050);
    expect(stats.meanMs).toBe(50.5);
    expect(stats.medianMs).toBe(50);
    expect(stats.p95Ms).toBe(95);
    expect(stats.p99Ms).toBe(99);
    expect(stats.maxMs).toBe(100);
    // A single sample is all of its own statistics; no sample at all is an error.
    expect(summariseStepTimes([7], 0.01)).toEqual({
      steps: 1,
      simulatedSeconds: 0.01,
      meanMs: 7,
      medianMs: 7,
      p95Ms: 7,
      p99Ms: 7,
      maxMs: 7,
      totalMs: 7,
    });
    expect(() => summariseStepTimes([], 0.01)).toThrow(RangeError);
    expect(formatStepTimes('test', stats)).toBe(
      'test: 100 steps (0.42 s simulated) in 5050 ms; per step mean 50.500 ms, median 50.000 ms, ' +
        'p95 95.000 ms, p99 99.000 ms, max 100.000 ms',
    );
  });

  it('times single steps: one call of step(1) per sample, the callback outside the timing', () => {
    const calls: number[] = [];
    const seen: number[] = [];
    // Only `step` is used: a stand-in that counts is enough.
    const world = {
      step: (n: number): void => {
        calls.push(n);
      },
    } as unknown as PhysicsWorld;
    const times = timeSteps(world, 5, (index) => {
      // A slow callback must not show in the times: spin for 5 ms.
      const until = performance.now() + 5;
      while (performance.now() < until);
      seen.push(index);
    });
    expect(calls).toEqual([1, 1, 1, 1, 1]);
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    expect(times).toHaveLength(5);
    for (const t of times) expect(t).toBeGreaterThanOrEqual(0);
    // The stand-in step takes no time to speak of; the 5 ms of the callback are not in it. (The
    // median, so that one pause of the machine in the wrong place cannot fail the test.)
    const median = [...times].sort((a, b) => a - b)[2] as number;
    expect(median).toBeLessThan(1);
  });
});
