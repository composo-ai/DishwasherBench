// The quick subset of the phenomena suite: six cheap scenarios that cover different
// mechanisms (pools, line of sight of the jets, chemistry delivery, soil ageing, drainage of
// a recess, exposure independent of the liquor), washed at the fast tier. Only the direction
// is asserted here: the sizes are what the full suite (`cli.ts`) reports against the
// checklist's bands.
//
// The exposure cache of the suite is used (`phenomena/.spotless/exposure-cache`): the washes
// are the same with a cold or a warm cache, a warm one only makes them quick.
import { beforeAll, describe, expect, it } from 'vitest';
import { PRIMARY_MACHINE } from '@spotless/machine';
import { QUICK_IDS, runPhenomena } from './runner.ts';
import type { ScenarioReport, SuiteReport } from './types.ts';

let report: SuiteReport;

beforeAll(async () => {
  report = await runPhenomena({ ids: [...QUICK_IDS], tier: 'fast' });
});

const scenario = (id: string): ScenarioReport => {
  const found = report.scenarios.find((s) => s.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
};

const value = (id: string, check: string): number => {
  const found = scenario(id).checks.find((c) => c.id === check);
  if (found === undefined || found.value === null) {
    throw new Error(`${id} ${check}: ${found?.note ?? 'no such check'}`);
  }
  return found.value;
};

describe('quick subset of the phenomena suite (fast tier, registry defaults)', () => {
  it("ran every wash on the owner's machine without an error", () => {
    expect(report.machineId).toBe(PRIMARY_MACHINE.id);
    for (const s of report.scenarios) {
      expect(s.verdict, `${s.id}: ${s.note}`).not.toBe('error');
      expect(s.verdict, s.id).not.toBe('not covered');
    }
  });

  it('P01: an upright mug keeps water that an inverted one does not, and no jet enters it', () => {
    expect(value('P01', 'retained')).toBeGreaterThan(0);
    expect(value('P01', 'bowl')).toBeGreaterThan(0);
    // No jet from below reaches the inside of the upright mug: under 0.2 % of the time.
    expect(value('P01', 'f_jet')).toBeLessThan(0.002);
  });

  it('P02: the face turned away from the arm axis is under a direct jet for less of the time', () => {
    // Sign only: the ratio of the two fractions of time, away over facing, is below one.
    expect(value('P02', 'f_jet')).toBeLessThan(1);
  });

  it('P25: without detergent the egg yolk and the tea stay, and the scores do not rise', () => {
    // Removal without detergent under one fifth (the checklist: near zero).
    expect(value('P25', 'protein')).toBeLessThan(0.2);
    expect(value('P25', 'tea')).toBeLessThan(0.2);
    expect(value('P25', 'score')).toBeLessThanOrEqual(0);
  });

  it('P29: a baked-on soil leaves more residue than a fresh one', () => {
    expect(value('P29', 'order')).toBeGreaterThan(0);
    expect(value('P29', 'baked')).toBeLessThanOrEqual(0);
  });

  it('P36: the base recess of an inverted mug holds water', () => {
    expect(value('P36', 'pool')).toBeGreaterThan(0);
  });

  it('P48: detergent does not change the exposure', () => {
    expect(value('P48', 'jets')).toBe(0);
  });

  it('gives the same result hashes when the same scenarios are run again', async () => {
    const again = await runPhenomena({ ids: ['P02', 'P36'], tier: 'fast' });
    for (const s of again.scenarios) {
      const first = scenario(s.id);
      expect(s.cases.map((c) => c.resultHash)).toEqual(first.cases.map((c) => c.resultHash));
    }
  });
});
