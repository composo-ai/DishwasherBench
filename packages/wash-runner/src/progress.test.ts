import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as contract from './contract.ts';
import type { StageSeconds, TimingHistory, TimingRecord } from './progress.ts';
import {
  appendTiming,
  defaultStageSeconds,
  estimateStageSeconds,
  estimateWashSeconds,
  HISTORY_RECORDS,
  JOB_STAGES,
  parseTimingHistory,
  ProgressTracker,
} from './progress.ts';

const ESTIMATE: StageSeconds = {
  starting: 2,
  scene: 10,
  hydraulics: 0.1,
  exposure: 40,
  soil: 0.2,
  replay: 8,
  result: 0.2,
};
const TOTAL = Object.values(ESTIMATE).reduce((sum, s) => sum + s, 0);

/** A tracker on a clock the test sets. */
function tracked(estimate: StageSeconds = ESTIMATE): {
  tracker: ProgressTracker;
  at: (seconds: number) => void;
} {
  let now = 0;
  const tracker = new ProgressTracker(estimate, () => now, 0);
  return {
    tracker,
    at: (seconds) => {
      now = seconds;
    },
  };
}

describe('progress of a wash', () => {
  it('names the stage and estimates the time to go from the stage estimates', () => {
    const { tracker, at } = tracked();
    const start = tracker.report('starting', 0);
    expect(start.stage).toMatchObject({ stage: 'starting', index: 1, count: 7, fraction: 0 });
    expect(start.stage.eta_s).toBeCloseTo(TOTAL, 1);
    expect(start.fraction).toBe(0);

    // The wash runs exactly as estimated: the estimate counts down with the clock.
    at(2);
    const scene = tracker.report('scene', 0);
    expect(scene.stage).toMatchObject({
      stage: 'scene',
      label: 'Measuring every surface of the machine and the load',
      index: 2,
      elapsed_s: 2,
    });
    expect(scene.stage.eta_s).toBeCloseTo(TOTAL - 2, 1);
    expect(scene.fraction).toBeCloseTo(2 / TOTAL, 3);
    at(12);
    tracker.report('scene', 1);
    tracker.report('hydraulics', 1);
    const exposure = tracker.report('exposure', 0, 'spray pattern 1');
    expect(exposure.stage.label).toBe(
      'Tracing the jets, the splashing and the run-off (spray pattern 1)',
    );
    expect(exposure.stage.eta_s).toBeCloseTo(40 + 0.2 + 8 + 0.2, 0);
    expect(exposure.fraction).toBeCloseTo(12 / TOTAL, 2);
  });

  it('corrects the estimate by how the wash itself has gone', () => {
    const { tracker, at } = tracked();
    tracker.report('starting', 0);
    at(2);
    tracker.report('scene', 0);
    // The scene took three times its estimate: the machine is busy, and so will the rest be.
    at(32);
    tracker.report('scene', 1);
    const slow = tracker.report('exposure', 0);
    const pace = 32 / 12;
    expect(slow.stage.eta_s).toBeCloseTo((40 + 0.2 + 8 + 0.2) * pace, 0);
    // Half-way through the stage its own rate counts as much as the estimate.
    at(32 + 30);
    const half = tracker.report('exposure', 0.5);
    const byEstimate = 40 * pace * 0.5;
    const byRate = 30;
    const later = (0.2 + 8 + 0.2) * pace;
    expect(half.stage.eta_s).toBeCloseTo(0.5 * byEstimate + 0.5 * byRate + later, 0);
  });

  it('never runs backwards and ends at exactly 1', () => {
    const { tracker, at } = tracked();
    const seen: number[] = [];
    const steps: [number, string, number][] = [
      [0, 'starting', 0],
      [1, 'scene', 0],
      [30, 'scene', 1],
      [30, 'hydraulics', 1],
      [30, 'exposure', 0],
      [31, 'exposure', 0.25],
      [31.5, 'exposure', 0.5],
      [90, 'exposure', 0.75],
      [91, 'exposure', 1],
      // The simulation revisits its hydraulics after the exposure: not a step back.
      [91, 'hydraulics', 1],
      [91, 'soil', 0],
      [91.2, 'soil', 1],
      [91.2, 'replay', 0],
      [93, 'replay', 0.4],
      [99, 'replay', 1],
      [99, 'result', 0],
    ];
    for (const [time, stage, fraction] of steps) {
      at(time);
      const detail = tracker.report(stage, fraction);
      seen.push(detail.fraction);
      expect(detail.fraction).toBeLessThan(1);
      expect(detail.stage.eta_s).toBeGreaterThanOrEqual(0);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    at(99.3);
    const done = tracker.report('result', 1);
    expect(done.fraction).toBe(1);
    expect(done.stage).toMatchObject({ stage: 'result', index: 7, fraction: 1, eta_s: 0 });
    // What each stage took, for the history.
    const took = tracker.stageSeconds();
    expect(took['starting']).toBeCloseTo(1, 6);
    expect(took['scene']).toBeCloseTo(29, 6);
    expect(took['exposure']).toBeCloseTo(61, 6);
    expect(took['replay']).toBeCloseTo(7.8, 6);
    expect(Object.keys(took)).toEqual([...JOB_STAGES]);
  });

  it('survives reports it does not know and numbers that are none', () => {
    const { tracker, at } = tracked();
    tracker.report('starting', 0);
    at(3);
    const odd = tracker.report('a_new_stage', 0.5);
    expect(odd.stage.stage).toBe('starting');
    const nan = tracker.report('scene', Number.NaN);
    expect(nan.stage).toMatchObject({ stage: 'scene', fraction: 0 });
    expect(Number.isFinite(nan.fraction)).toBe(true);
    expect(tracker.report('scene', 7).stage.fraction).toBe(1);
  });
});

describe('estimates from the history of the machine', () => {
  const record = (tier: 'fast' | 'official', items: number, factor: number): TimingRecord => {
    const base = defaultStageSeconds(tier, items);
    return {
      tier,
      items,
      stage_s: Object.fromEntries(JOB_STAGES.map((stage) => [stage, base[stage] * factor])),
      exposure_computed: 4,
    };
  };

  it('uses the built-in figures until the machine has washed', () => {
    const none = estimateStageSeconds('fast', 20, null);
    expect(none.basis).toBe('built-in');
    expect(none.seconds).toEqual(defaultStageSeconds('fast', 20));
    // More items, more time; the official tier takes longer than the fast one.
    expect(defaultStageSeconds('fast', 50).exposure).toBeGreaterThan(
      defaultStageSeconds('fast', 5).exposure,
    );
    expect(defaultStageSeconds('official', 20).scene).toBeGreaterThan(
      defaultStageSeconds('fast', 20).scene,
    );
    // Washes at the other tier say nothing about this one.
    const other: TimingHistory = { version: 1, records: [record('official', 20, 3)] };
    expect(estimateStageSeconds('fast', 20, other).basis).toBe('built-in');
  });

  it('scales the built-in figures by what earlier washes at the tier took', () => {
    const history: TimingHistory = {
      version: 1,
      records: [record('fast', 7, 2), record('fast', 40, 2.2), record('fast', 20, 1.8)],
    };
    const estimate = estimateStageSeconds('fast', 30, history);
    expect(estimate.basis).toBe('history');
    const builtIn = defaultStageSeconds('fast', 30);
    for (const stage of JOB_STAGES) {
      expect(estimate.seconds[stage]).toBeCloseTo(builtIn[stage] * 2, 6);
    }
    // A wash that took its exposure from the cache does not make the exposure look free.
    const cached: TimingRecord = {
      ...record('fast', 30, 2),
      stage_s: { ...record('fast', 30, 2).stage_s, exposure: 0.05 },
      exposure_computed: 0,
    };
    const withCached = estimateStageSeconds('fast', 30, { version: 1, records: [cached] });
    expect(withCached.seconds.exposure).toBe(builtIn.exposure);
    expect(withCached.seconds.scene).toBeCloseTo(builtIn.scene * 2, 6);
  });

  it('gives the whole wash as the sum of its stages, beside the contract and without the simulation', () => {
    const history: TimingHistory = { version: 1, records: [record('official', 30, 2)] };
    for (const [tier, items, given] of [
      ['fast', 20, null],
      ['official', 114, null],
      ['official', 60, history],
    ] as const) {
      const stages = estimateStageSeconds(tier, items, given);
      const whole = estimateWashSeconds(tier, items, given);
      expect(whole.basis).toBe(stages.basis);
      expect(whole.seconds).toBeCloseTo(
        JOB_STAGES.reduce((sum, stage) => sum + stages.seconds[stage], 0),
        9,
      );
    }
    expect(estimateWashSeconds('official', 60, history).seconds).toBeCloseTo(
      2 * estimateWashSeconds('official', 60, null).seconds,
      6,
    );
    // The server takes the estimate from the contract, which must not load the simulation:
    // the module that holds it imports types only.
    expect(contract.estimateStageSeconds).toBe(estimateStageSeconds);
    expect(contract.estimateWashSeconds).toBe(estimateWashSeconds);
    const source = readFileSync(fileURLToPath(new URL('./progress.ts', import.meta.url)), 'utf8');
    const imports = source.split('\n').filter((line) => /^import /.test(line));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line, line).toMatch(/^import type /);
  });

  it('keeps a bounded history and reads back only what is one', () => {
    let history: TimingHistory | null = null;
    for (let i = 0; i < HISTORY_RECORDS + 5; i++) {
      history = appendTiming(history, record('fast', i, 1));
    }
    expect(history?.records).toHaveLength(HISTORY_RECORDS);
    expect(history?.records[0]?.items).toBe(5);
    expect(parseTimingHistory(JSON.stringify(history))).toEqual(history);
    expect(parseTimingHistory('not json')).toBeNull();
    expect(parseTimingHistory('{"version":2,"records":[]}')).toBeNull();
    expect(
      parseTimingHistory('{"version":1,"records":[{"tier":"turbo","items":1},null,7]}'),
    ).toEqual({ version: 1, records: [] });
  });
});
