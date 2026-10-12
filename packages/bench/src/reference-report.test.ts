// The stored reference tables: what the scripted reference policies score on every level of
// the game, at the official tier (the tier the game is scored on) and at the fast tier (the
// preview), written by `scripts/reference-table.ts --json` (the washes take minutes: they are a
// script, and this test reads what it wrote). It holds each table to the levels and the saved
// loads as they are on disk, in the order of the course, and every level to the same gates.
// `scripts/course-table.ts` prints the same washes level by level beside the difficulty.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allLevels } from '@spotless/levels';
import { describe, expect, it } from 'vitest';
import type {
  MistakeCost,
  ReferenceFinding,
  ReferenceGates,
  ReferenceMargins,
  ReferenceRow,
} from './reference.ts';
import { MEANT_TO_FIT, REFERENCE_GATES, referenceFindings, referenceMargins } from './reference.ts';

interface StoredTable {
  readonly tier: string;
  /** The gates the findings were judged by when the table was written. */
  readonly gates: ReferenceGates;
  readonly rows: readonly ReferenceRow[];
  /** Per level: yield, what is left on the counter, and the two margins on both bases. */
  readonly margins: readonly ReferenceMargins[];
  readonly findings: readonly ReferenceFinding[];
  readonly costs: readonly { readonly level: string; readonly costs: readonly MistakeCost[] }[];
  /** What was washed: per saved load the scene hash of the load and the simulation that washed it. */
  readonly washes: readonly {
    readonly load: string;
    readonly load_state: string;
    readonly sim_version: string;
    readonly result_hash: string;
  }[];
}

const levels = allLevels();
const POLICIES = ['empty', 'careful', 'careless', 'random'];

function storedTable(tier: string): StoredTable {
  const file = fileURLToPath(new URL(`../reference/reference-${tier}.json`, import.meta.url));
  return JSON.parse(readFileSync(file, 'utf8')) as StoredTable;
}

function savedState(load: string): string | null {
  const file = fileURLToPath(new URL(`../../loader/loads/${load}.json`, import.meta.url));
  if (!existsSync(file)) return null;
  return (JSON.parse(readFileSync(file, 'utf8')) as { final_state_hash: string }).final_state_hash;
}

describe.each(['official', 'fast'])('the stored reference table (%s tier)', (tier) => {
  const stored = storedTable(tier);

  it('has every level of the game with every reference policy, on the scored programme', () => {
    expect(stored.tier).toBe(tier);
    for (const level of levels) {
      const rows = stored.rows.filter((row) => row.level === level.id);
      expect(
        rows.map((row) => row.policy),
        level.id,
      ).toEqual(POLICIES);
      const available = level.items.reduce((sum, item) => sum + item.points, 0);
      for (const row of rows) {
        expect(row.programme, `${level.id} ${row.policy}`).toBe('eco_50');
        expect(row.tier).toBe(tier);
        // The table is of the level as it is defined now.
        expect(row.points_available, `${level.id} ${row.policy}`).toBe(available);
        expect(row.offered, `${level.id} ${row.policy}`).toBe(level.items.length);
        expect(row.points).toBeLessThanOrEqual(row.points_loaded);
        expect(row.points_strict).toBeLessThanOrEqual(row.points);
        expect(row.points_lenient).toBeGreaterThanOrEqual(row.points);
      }
    }
    expect(stored.rows).toHaveLength(levels.length * POLICIES.length);
  });

  it('lists the levels in the order of the course, each harder than the one before', () => {
    expect([...new Set(stored.rows.map((row) => row.level))]).toEqual(
      levels.map((level) => level.id),
    );
    expect(levels.map((level) => level.number)).toEqual(levels.map((_, i) => i + 1));
    let before = 0;
    for (const level of levels) {
      expect(level.difficulty as number, level.id).toBeGreaterThan(before);
      before = level.difficulty as number;
    }
  });

  it('is of the reference loads as they are saved', () => {
    for (const level of levels) {
      for (const policy of ['careful', 'careless', 'random']) {
        const name = `${level.id}-${policy}`;
        const wash = stored.washes.find((entry) => entry.load === name);
        expect(wash, `${name} is not in the stored table: wash it again`).toBeDefined();
        expect(
          wash?.load_state,
          `${name} was generated again since the table was made: run reference-table --json again`,
        ).toBe(savedState(name));
        expect(wash?.sim_version).toMatch(/^spotless-sim /);
      }
    }
  });

  it('scores nothing for the empty machine on any level', () => {
    for (const row of stored.rows.filter((entry) => entry.policy === 'empty')) {
      expect(row, row.level).toMatchObject({ points: 0, loaded: 0, clean: 0, points_loaded: 0 });
    }
  });

  // What this file asserts and what it only holds to the record. A gate is a judgement of a
  // level by the wash simulation as it stood when the table was made. Whether a careful load
  // gets most items clean, and whether careful beats careless beats random by the margins, are
  // results: they are stored, level by level, pass or fail, and reported
  // (docs/benchmark/levels.md section 6). They are not asserted here to come out one way: a
  // test that demanded a pass would be met by moving a threshold or a soil until it did.
  // What is asserted is that the stored record is the truth of its own rows under the gates
  // as they are, and the gates that are in the level designer's hands whatever the wash says.

  it('records the findings of every level under the same gates, hand-written or generated', () => {
    const found: ReferenceFinding[] = [];
    for (const level of levels) {
      found.push(...referenceFindings(stored.rows.filter((row) => row.level === level.id)));
    }
    // The file cannot claim a pass it does not have, or hide a failure: its findings are
    // exactly those of its rows.
    expect(stored.findings).toEqual(found);
  });

  it('records the margins of every level on both bases', () => {
    for (const level of levels) {
      const margins = referenceMargins(stored.rows.filter((row) => row.level === level.id));
      expect(margins, level.id).not.toBeNull();
      expect(
        stored.margins.find((entry) => entry.level === level.id),
        level.id,
      ).toEqual(margins);
      // Every level has all three loads, so both margins can be stated.
      expect(margins?.careful_over_careless, level.id).not.toBeNull();
      expect(margins?.careless_over_random, level.id).not.toBeNull();
    }
    expect(stored.gates).toEqual(REFERENCE_GATES);
  });

  it('passes the gates that do not turn on the wash: more than fits, nothing provisional, zero for empty', () => {
    const designers = ['more_than_fits', 'provisional', 'empty', 'careful', 'careless', 'random'];
    expect(
      stored.findings
        .filter((finding) => designers.includes(finding.gate))
        .map((finding) => `${finding.level}: ${finding.gate}: ${finding.message}`),
    ).toEqual([]);
    for (const level of levels) {
      const margins = referenceMargins(stored.rows.filter((row) => row.level === level.id));
      if (!MEANT_TO_FIT.includes(level.id)) {
        expect(margins?.left_on_counter, level.id).toBeGreaterThanOrEqual(
          REFERENCE_GATES.leftOnCounterMin,
        );
      }
    }
  });

  it('says what the mistakes of every careless load cost, whatever that is', () => {
    for (const level of levels) {
      const entry = stored.costs.find((candidate) => candidate.level === level.id);
      expect(entry, level.id).toBeDefined();
      // Every careless load holds mistakes (a property of the load, not of the wash) ...
      const made = (entry?.costs ?? []).reduce((sum, cost) => sum + cost.made, 0);
      expect(made, level.id).toBeGreaterThanOrEqual(2);
      // ... and what they cost adds up to the difference between the two loads' scores.
      const by = new Map(
        stored.rows.filter((row) => row.level === level.id).map((row) => [row.policy, row]),
      );
      const net = (entry?.costs ?? []).reduce(
        (sum, cost) => sum + cost.points_lost - cost.points_gained,
        0,
      );
      expect(net, level.id).toBe(
        (by.get('careful') as ReferenceRow).points - (by.get('careless') as ReferenceRow).points,
      );
    }
  });
});
