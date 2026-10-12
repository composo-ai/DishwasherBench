import { describe, expect, it } from 'vitest';
import type { ReferenceItem, ReferenceWash } from './reference.ts';
import { robustnessMarkdown, robustnessOfLevel } from './robustness.ts';

function wash(policy: string, verdicts: Record<string, boolean | null>): ReferenceWash {
  const points: Record<string, number> = { plate: 10, bowl: 8, glass: 6, spoon: 2, pan: 20 };
  const items: ReferenceItem[] = Object.keys(points).map((id) => {
    const clean = verdicts[id] ?? null;
    return clean === null
      ? { item_id: id, points: points[id] as number, loaded: false }
      : { item_id: id, points: points[id] as number, loaded: true, clean };
  });
  return {
    load: `meal-${policy}`,
    level: 'meal',
    policy,
    tier: 'official',
    programme: 'eco_50',
    sim_version: 'test',
    result_hash: 'h',
    load_state: 's',
    offered: items.length,
    items,
    mistakes: [],
    notes: [],
    seconds: 1,
  };
}

const careful = wash('careful', { plate: true, bowl: true, glass: true, spoon: true });
const careless = wash('careless', { plate: true, bowl: true, glass: false, spoon: true });

describe('robustnessOfLevel', () => {
  it('counts the verdicts and points of each load that moved against the base case', () => {
    const study = robustnessOfLevel('meal', [
      { name: 'base', what: 'as the game washes it', kind: 'base', careful, careless },
      {
        name: 'seed-2',
        what: 'another seed',
        kind: 'seed',
        // The spoon of the careful load reads dirty with this seed; the careless load is as it was.
        careful: wash('careful', { plate: true, bowl: true, glass: true, spoon: false }),
        careless,
      },
      {
        name: 'soak-0.25',
        what: 'less soak',
        kind: 'params',
        // The bowl is lost in both loads, and the careless load gets its glass clean.
        careful: wash('careful', { plate: true, bowl: false, glass: true, spoon: true }),
        careless: wash('careless', { plate: true, bowl: false, glass: true, spoon: true }),
      },
    ]);
    expect(study.points_available).toBe(46);
    expect(study.lines.map((line) => line.margin)).toEqual([6, 4, 0]);
    expect(study.lines[1]?.careful).toMatchObject({
      points: 24,
      verdicts_moved: 1,
      points_moved: 2,
    });
    expect(study.lines[1]?.careless).toMatchObject({ verdicts_moved: 0, points_moved: 0 });
    expect(study.lines[2]?.careless?.moved).toEqual([
      { item_id: 'bowl', clean: false },
      { item_id: 'glass', clean: true },
    ]);
    expect(study.lines[2]?.careless).toMatchObject({ verdicts_moved: 2, points_moved: 14 });
    expect(study.seed_verdicts_max).toBe(1);
    expect(study.params_verdicts_max).toBe(2);
    expect(study.margin_min).toBe(0);
    expect(study.margin_max).toBe(6);
    // A tie is a flip: the careful load must score strictly more.
    expect(study.flips).toEqual(['soak-0.25']);
  });

  it('says which cases were not washed and never calls a missing case a flip', () => {
    const study = robustnessOfLevel('meal', [
      { name: 'base', what: 'as the game washes it', kind: 'base', careful, careless },
      { name: 'seed-2', what: 'another seed', kind: 'seed', careful, careless: null },
    ]);
    expect(study.missing).toEqual(['seed-2']);
    expect(study.flips).toEqual([]);
    expect(study.lines[1]?.margin).toBeNull();
    const text = robustnessMarkdown([study]);
    expect(text).toContain(
      '| seed-2 | another seed | 26 (4 of 4 clean) | not washed | - | - | 0 (0) | - |',
    );
    expect(text).toContain('holds in every case washed (missing: seed-2)');
  });

  it('prints the base case as the reference and the ranking of each level', () => {
    const text = robustnessMarkdown([
      robustnessOfLevel('meal', [
        { name: 'base', what: 'as the game washes it', kind: 'base', careful, careless },
      ]),
    ]);
    expect(text).toContain(
      '| base | as the game washes it | 26 (4 of 4 clean) | 20 (3 of 4 clean) | 6 | 13.0 % | reference | reference |',
    );
    expect(text).toContain('| meal | 6 to 6 | 0 | 0 | holds in every case |');
  });
});
