import { describe, expect, it } from 'vitest';
import type { ReferenceItem, ReferenceWash } from './reference.ts';
import {
  FAST_TIER_NOISE_OF_CAREFUL,
  marginsMarkdown,
  MEANT_TO_FIT,
  mistakeCosts,
  REFERENCE_GATES,
  referenceFindings,
  referenceMargins,
  referenceMarkdown,
  referenceRow,
} from './reference.ts';

function item(
  id: string,
  points: number,
  clean: boolean | null,
  flags: Partial<ReferenceItem> = {},
): ReferenceItem {
  if (clean === null) return { item_id: id, points, loaded: false };
  return {
    item_id: id,
    points,
    loaded: true,
    clean,
    score: clean ? 5 : 0,
    strict_clean: clean,
    lenient_clean: clean,
    decided: true,
    ...flags,
  };
}

function wash(
  policy: string,
  items: readonly ReferenceItem[],
  more: Partial<ReferenceWash> = {},
): ReferenceWash {
  return {
    load: `meal-${policy}`,
    level: 'meal',
    policy,
    tier: 'fast',
    programme: 'eco_50',
    sim_version: 'test',
    result_hash: 'h',
    load_state: 's',
    offered: items.length,
    items,
    mistakes: [],
    notes: [],
    seconds: 1,
    ...more,
  };
}

const CAREFUL = wash('careful', [
  item('plate_01', 10, true),
  item('plate_02', 10, true),
  item('bowl_01', 8, true),
  item('bowl_02', 8, true),
  item('mug_01', 6, true),
  item('glass_01', 6, true),
  item('spoon_01', 2, true),
  item('spoon_02', 2, true),
  item('pan_01', 20, null),
]);

const CARELESS = wash(
  'careless',
  [
    item('plate_01', 10, true),
    item('plate_02', 10, true),
    item('bowl_01', 8, false),
    item('bowl_02', 8, true),
    item('mug_01', 6, false),
    item('glass_01', 6, true),
    item('spoon_01', 2, false),
    item('spoon_02', 2, false),
    item('pan_01', 20, null),
  ],
  {
    mistakes: [
      { kind: 'bowls_nested', item_id: 'bowl_01', with: 'bowl_02', note: 'lies in bowl_02' },
      { kind: 'cup_on_side', item_id: 'mug_01', note: 'lies on its side' },
      { kind: 'cup_upright', item_id: 'glass_01', note: 'stands mouth up' },
    ],
  },
);

describe('referenceRow', () => {
  it('counts points, clean and loaded items, and what was offered', () => {
    expect(referenceRow(CAREFUL)).toMatchObject({
      level: 'meal',
      policy: 'careful',
      points: 52,
      points_available: 72,
      points_strict: 52,
      points_lenient: 52,
      clean: 8,
      loaded: 8,
      offered: 9,
      points_loaded: 52,
      edge: 0,
      provisional: 0,
    });
    expect(referenceRow(CAREFUL).share).toBeCloseTo(52 / 72, 12);
  });

  it('brackets the points by the items at the edge of clean, and counts the provisional', () => {
    const edgy = wash('careful', [
      item('a', 10, true, { strict_clean: false, lenient_clean: true, decided: false }),
      item('b', 6, false, { strict_clean: false, lenient_clean: true, decided: false }),
      item('c', 4, true, { provisional: true }),
    ]);
    expect(referenceRow(edgy)).toMatchObject({
      points: 14,
      points_strict: 4,
      points_lenient: 20,
      edge: 2,
      edge_points: 16,
      provisional: 1,
      provisional_points: 4,
    });
  });
});

describe('mistakeCosts', () => {
  it('charges a mistake the points of the item it was made on and of its partner', () => {
    const costs = mistakeCosts(CAREFUL, CARELESS);
    const by = new Map(costs.map((cost) => [cost.kind, cost]));
    expect(by.get('bowls_nested')).toMatchObject({
      made: 1,
      items: ['bowl_01', 'bowl_02'],
      lost_items: ['bowl_01'],
      points_lost: 8,
    });
    expect(by.get('cup_on_side')).toMatchObject({
      made: 1,
      lost_items: ['mug_01'],
      points_lost: 6,
    });
    // A mistake that cost nothing is listed with nothing lost: that is a finding too.
    expect(by.get('cup_upright')).toMatchObject({ made: 1, lost_items: [], points_lost: 0 });
    // Points lost by items no mistake was made with are not hidden.
    expect(by.get('no_mistake_on_item')).toMatchObject({
      made: 0,
      lost_items: ['spoon_01', 'spoon_02'],
      points_lost: 4,
    });
    expect(costs.reduce((sum, cost) => sum + cost.points_lost - cost.points_gained, 0)).toBe(
      referenceRow(CAREFUL).points - referenceRow(CARELESS).points,
    );
  });

  it('gives what the rest of the load lost to a mistake that acts on the whole machine', () => {
    const blocked: ReferenceWash = {
      ...CARELESS,
      mistakes: [
        ...CARELESS.mistakes,
        { kind: 'tablet_tray_blocked', item_id: 'glass_01', note: 'in the path of the tablet' },
      ],
    };
    const by = new Map(mistakeCosts(CAREFUL, blocked).map((cost) => [cost.kind, cost]));
    expect(by.get('tablet_tray_blocked')).toMatchObject({
      made: 1,
      lost_items: ['spoon_01', 'spoon_02'],
      points_lost: 4,
    });
    expect(by.has('no_mistake_on_item')).toBe(false);
  });

  it('lists an item the careless load lost altogether, and one that came clean only there', () => {
    const other = wash('careless', [
      item('plate_01', 10, true),
      item('plate_02', 10, null),
      item('bowl_01', 8, true),
      item('bowl_02', 8, true),
      item('mug_01', 6, true),
      item('glass_01', 6, true),
      item('spoon_01', 2, true),
      item('spoon_02', 2, true),
      item('pan_01', 20, true),
    ]);
    const by = new Map(mistakeCosts(CAREFUL, other).map((cost) => [cost.kind, cost]));
    expect(by.get('left_out')).toMatchObject({ lost_items: ['plate_02'], points_lost: 10 });
    expect(by.get('no_mistake_on_item')).toMatchObject({ points_lost: 0, points_gained: 20 });
  });
});

describe('referenceFindings', () => {
  const empty = referenceRow(
    wash(
      'empty',
      CAREFUL.items.map((entry) => ({
        item_id: entry.item_id,
        points: entry.points,
        loaded: false,
      })),
    ),
  );
  const random = referenceRow(
    wash('random', [
      item('plate_01', 10, true),
      item('bowl_01', 8, false),
      item('mug_01', 6, true),
      ...['plate_02', 'bowl_02', 'glass_01', 'spoon_01', 'spoon_02', 'pan_01'].map((id) =>
        item(id, CAREFUL.items.find((entry) => entry.item_id === id)?.points ?? 0, null),
      ),
    ]),
  );

  it('passes a level whose policies are apart by the margins', () => {
    expect(
      referenceFindings([empty, referenceRow(CAREFUL), referenceRow(CARELESS), random]),
    ).toEqual([]);
  });

  it('names every gate a level fails', () => {
    const gates = (rows: Parameters<typeof referenceFindings>[0]): string[] =>
      referenceFindings(rows).map((finding) => finding.gate);
    // Careless as good as careful: the mistakes cost nothing.
    expect(
      gates([
        empty,
        referenceRow(CAREFUL),
        referenceRow({ ...CAREFUL, policy: 'careless' }),
        random,
      ]),
    ).toEqual(['careful_over_careless']);
    // Random as good as careless.
    expect(
      gates([
        empty,
        referenceRow(CAREFUL),
        referenceRow(CARELESS),
        referenceRow({ ...CARELESS, policy: 'random' }),
      ]),
    ).toEqual(['careless_over_random']);
    // A random pile that scores more than the careless load, but holds much less: the careless
    // load is another kind of load (a full machine loaded badly), and the gate lets it pass.
    const lucky = referenceRow(
      wash(
        'random',
        CAREFUL.items.map((entry) =>
          ['plate_01', 'plate_02', 'bowl_01', 'bowl_02'].includes(entry.item_id)
            ? entry
            : item(entry.item_id, entry.points, null),
        ),
      ),
    );
    expect(lucky.points).toBeGreaterThan(referenceRow(CARELESS).points);
    expect(referenceRow(CARELESS).points_loaded / lucky.points_loaded).toBeGreaterThanOrEqual(
      REFERENCE_GATES.differentInKind,
    );
    expect(gates([empty, referenceRow(CAREFUL), referenceRow(CARELESS), lucky])).toEqual([]);
    // A careful load of which most stays dirty.
    const dirty = wash(
      'careful',
      CAREFUL.items.map((entry) => item(entry.item_id, entry.points, false)),
    );
    expect(gates([referenceRow(dirty)])).toContain('careful_yield');
    // An outcome that rests on items at the edge of clean, or on a provisional verdict.
    const edgy = wash(
      'careful',
      CAREFUL.items.map((entry, i) =>
        entry.loaded && i < 2
          ? { ...entry, strict_clean: false, lenient_clean: true, decided: false }
          : entry.loaded && i === 2
            ? { ...entry, provisional: true }
            : entry,
      ),
    );
    const found = gates([empty, referenceRow(edgy), referenceRow(CARELESS), random]);
    expect(found).toContain('edge');
    expect(found).toContain('provisional');
    // A level of which a careful hand gets nearly everything in does not offer more than fits.
    const fits = wash(
      'careful',
      CAREFUL.items.map((entry) => (entry.loaded ? entry : item(entry.item_id, 2, true))),
    );
    expect(gates([referenceRow(fits)])).toContain('more_than_fits');
    // ... which is not asked of the tutorial.
    expect(MEANT_TO_FIT).toEqual(['tutorial']);
    expect(gates([{ ...referenceRow(fits), level: 'tutorial' }])).not.toContain('more_than_fits');
    // A missing policy is a finding, and so is an empty machine that scores.
    expect(gates([referenceRow(CAREFUL)])).toEqual(['careless', 'random']);
    expect(
      gates([{ ...empty, points: 3 }, referenceRow(CAREFUL), referenceRow(CARELESS), random]),
    ).toEqual(['empty']);
  });

  it('compares two policies the hard way round: strict against lenient', () => {
    // By the verdicts careless is 18 points under careful (34 against 52): a quarter of the
    // level's 72 points, over the margin of a fifth.
    const plain = referenceMargins([referenceRow(CAREFUL), referenceRow(CARELESS)]);
    expect(plain?.careful_over_careless?.points).toBe(18);
    expect(plain?.careful_over_careless?.of_level).toBeGreaterThan(
      REFERENCE_GATES.carefulOverCareless,
    );
    // But if every one of those 18 points was lost by an item at the edge of clean, a lenient
    // eye would pass them all and the two loads would score the same: the margin is not there.
    const lost = new Set(['bowl_01', 'mug_01', 'spoon_01', 'spoon_02']);
    const lenientCareless = wash(
      'careless',
      CARELESS.items.map((entry) =>
        lost.has(entry.item_id) ? { ...entry, lenient_clean: true, decided: false } : entry,
      ),
    );
    const row = referenceRow(lenientCareless);
    expect(row.points).toBe(34);
    expect(row.points_lenient).toBe(52);
    const rows = [empty, referenceRow(CAREFUL), row, random];
    expect(referenceMargins(rows)?.careful_over_careless).toEqual({
      points: 0,
      of_careful: 0,
      of_level: 0,
    });
    expect(referenceFindings(rows).map((finding) => finding.gate)).toContain(
      'careful_over_careless',
    );
  });
});

describe('referenceMargins', () => {
  it('gives each margin as a share of the careful score and as a share of the level', () => {
    const margins = referenceMargins([referenceRow(CAREFUL), referenceRow(CARELESS)]);
    // The careful fixture holds 52 of the level's 72 points and scores all of them.
    expect(margins?.level).toBe('meal');
    expect(margins?.careful_yield).toBe(1);
    expect(margins?.left_on_counter).toBeCloseTo(20 / 72, 12);
    expect(margins?.careful_over_careless?.of_careful).toBeCloseTo(18 / 52, 12);
    expect(margins?.careful_over_careless?.of_level).toBeCloseTo(18 / 72, 12);
    // The gates judge the second of the two, which is the smaller: the careful policy loads
    // only part of a level, so a share of the level's points asks more than a share of its own.
    expect(margins?.careful_over_careless?.of_careful).toBeGreaterThan(
      margins?.careful_over_careless?.of_level ?? 1,
    );
    // Without a random wash there is nothing to read "different in kind" from.
    expect(margins?.careless_to_random_loaded).toBeNull();
  });

  it('prints as a line per level with both bases and what each gate says', () => {
    const empty = referenceRow(
      wash(
        'empty',
        CAREFUL.items.map((entry) => ({
          item_id: entry.item_id,
          points: entry.points,
          loaded: false,
        })),
      ),
    );
    // A random load: the careless one without its glass, 6 points under it.
    const close = referenceRow(
      wash(
        'random',
        CARELESS.items.map((entry) =>
          entry.item_id === 'glass_01' ? item('glass_01', 6, null) : entry,
        ),
      ),
    );
    expect(close.points).toBe(28);
    const margins = referenceMargins([empty, referenceRow(CAREFUL), referenceRow(CARELESS), close]);
    const text = marginsMarkdown(margins === null ? [] : [margins]);
    const [head, , line] = text.split('\n');
    expect(head).toContain('Careful yield (gate 66.7 %)');
    expect(head).toContain('of the level (gate 20.0 %)');
    // Careful over careless: 18 points, 25.0 % of the level's 72, 34.6 % of the careful 52.
    expect(line).toContain('| meal | 100.0 % | 27.8 % | 18 | 25.0 % | 34.6 % | passes |');
    // Careless over random: 34 less 28, 6 points, 8.3 % of the level; the careless load holds
    // 52 points against the random one's 46.
    expect(line).toContain('| 6 | 8.3 % | 1.13 times | passes |');
    // A margin under its gate says so, and one under the noise of the fast tier is marked.
    expect(FAST_TIER_NOISE_OF_CAREFUL).toBeGreaterThan(REFERENCE_GATES.carelessOverRandom);
    const narrow = marginsMarkdown([
      {
        level: 'meal',
        careful_yield: 0.5,
        left_on_counter: 0.3,
        careful_over_careless: { points: 4, of_careful: 0.08, of_level: 0.04 },
        careless_over_random: { points: 3, of_careful: 0.055, of_level: 0.03 },
        careless_to_random_loaded: 1.5,
      },
    ]).split('\n')[2];
    expect(narrow).toContain('50.0 % (does not pass)');
    expect(narrow).toContain('| 4 | 4.0 % | 8.0 % | does not pass |');
    expect(narrow).toContain('| 3 | 3.0 % | 1.50 times | passes, within noise |');
    // A careless load behind the random pile passes only as another kind of load.
    const behind = (ratio: number): string =>
      marginsMarkdown([
        {
          level: 'meal',
          careful_yield: 0.9,
          left_on_counter: 0.3,
          careful_over_careless: { points: 30, of_careful: 0.4, of_level: 0.3 },
          careless_over_random: { points: -5, of_careful: -0.1, of_level: -0.05 },
          careless_to_random_loaded: ratio,
        },
      ]).split('\n')[2] as string;
    expect(behind(1.5)).toContain('| -5 | -5.0 % | 1.50 times | passes as different in kind |');
    expect(behind(1.0)).toContain('| -5 | -5.0 % | 1.00 times | does not pass |');
    expect(
      marginsMarkdown([
        { ...(margins as NonNullable<typeof margins>), careless_over_random: null },
      ]),
    ).toContain('not measured');
  });

  it('has no margin without the policies to compare, and none to speak of when careful scores nothing', () => {
    expect(referenceMargins([])).toBeNull();
    expect(referenceMargins([referenceRow(CARELESS)])).toBeNull();
    const alone = referenceMargins([referenceRow(CAREFUL)]);
    expect(alone?.careful_over_careless).toBeNull();
    expect(alone?.careless_over_random).toBeNull();
    // Careless without random: the first margin is there, the second is not.
    const pair = referenceMargins([referenceRow(CAREFUL), referenceRow(CARELESS)]);
    expect(pair?.careless_over_random).toBeNull();
    const dirty = wash(
      'careful',
      CAREFUL.items.map((entry) => item(entry.item_id, entry.points, entry.loaded ? false : null)),
    );
    const nothing = referenceMargins([referenceRow(dirty), referenceRow(CARELESS)]);
    expect(nothing?.careful_yield).toBe(0);
    expect(nothing?.careful_over_careless?.of_careful).toBe(0);
    // And a careful load that scores nothing does not pass the margin by default.
    expect(
      referenceFindings([referenceRow(dirty), referenceRow(CARELESS)]).map((f) => f.gate),
    ).toContain('careful_over_careless');
  });
});

describe('referenceMarkdown', () => {
  it('has a line per level and policy with the figures the brief asks for', () => {
    const text = referenceMarkdown([referenceRow(CAREFUL), referenceRow(CARELESS)]);
    expect(text.split('\n')[0]).toContain(
      '| Points | Share | Strict to lenient | Clean of loaded | Loaded of offered |',
    );
    expect(text).toContain(
      '| meal | careful | fast | eco_50 | 52 of 72 | 72.2 % | 52 to 52 | 8 of 8 | 8 of 9 | 0 (0 pt) | 0 (0 pt) |',
    );
    expect(text).toContain('| meal | careless | fast | eco_50 | 34 of 72 |');
  });
});
