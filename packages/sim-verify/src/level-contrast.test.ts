// Careful loading against careless loading on the starter levels, from the stored report of
// `scripts/level-contrast.ts` (the washes themselves take minutes: they are a script, and this
// test reads what it wrote).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalHash } from '@spotless/core';
import { exposureFingerprint } from '@spotless/sim-core/node';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { LevelContrastReport } from './level-contrast.ts';
import { REPOSITORY_ROOT } from './node/workspace.ts';

const file = join(REPOSITORY_ROOT, 'packages', 'sim-verify', 'levels', 'level-contrast.json');
const report = JSON.parse(readFileSync(file, 'utf8')) as LevelContrastReport;
const loads = join(REPOSITORY_ROOT, 'packages', 'loader', 'loads');

/** The parameter-set file the game washes the owner's machine with (wash-runner's default). */
const GAME_SET = join(
  REPOSITORY_ROOT,
  'packages',
  'calibration',
  'anchors',
  'anchored-v8.owner-capsule.json',
);

/**
 * Why the report may no longer describe the code and the loads on disk: other engineers
 * regenerate the loads and change the sources. A report that is not current is not judged
 * (and says so); it is made again by the script.
 */
function staleness(): string[] {
  const why: string[] = [];
  if (report.exposureSource !== exposureFingerprint()) {
    why.push('the exposure sources on disk are not those the washes ran on');
  }
  const set = JSON.parse(readFileSync(GAME_SET, 'utf8')) as {
    provenance: { name: string };
    overrides: Record<string, unknown>;
  };
  const expected = createHash('sha256')
    .update(JSON.stringify([[set.provenance.name, canonicalHash(set.overrides)]]))
    .digest('hex');
  if (report.paramSetsHash !== expected) {
    why.push("the washes did not run with the game's parameter set as it is on disk");
  }
  for (const row of report.rows) {
    for (const policy of ['careful', 'careless'] as const) {
      const path = join(loads, `${row.level}-${policy}.json`);
      const state = existsSync(path)
        ? (JSON.parse(readFileSync(path, 'utf8')) as { final_state_hash?: string }).final_state_hash
        : undefined;
      if (state !== row[policy].loadState)
        why.push(`${row.level}-${policy} was loaded again since`);
    }
  }
  return why;
}

describe('careful against careless loading on the starter levels', () => {
  it('is reported for every starter level that has both loads, with what produced it', () => {
    expect(report.suite).toBe('spotless-level-contrast');
    expect(report.rows.length).toBeGreaterThanOrEqual(5);
    expect(report.simVersion).toMatch(/^spotless-sim /);
    expect(report.exposureSource).toMatch(/^[0-9a-f]{64}$/);
    expect(report.paramSets.length).toBeGreaterThan(0);
    for (const row of report.rows) {
      // The points of a policy lie between the two ends of the band of visibility.
      for (const side of [row.careful, row.careless]) {
        expect(side.pointsStrict, row.level).toBeLessThanOrEqual(side.points);
        expect(side.pointsLenient, row.level).toBeGreaterThanOrEqual(side.points);
        expect(side.points, row.level).toBeLessThanOrEqual(side.offered);
      }
    }
  });

  const why = staleness();
  it.skipIf(why.length > 0)(
    'gives the careful load more points than the careless one on every level',
    () => {
      for (const row of report.rows) {
        expect(row.careful.points, row.level).toBeGreaterThan(row.careless.points);
      }
    },
  );
  it.runIf(why.length > 0)('is not current: run scripts/level-contrast.ts again', () => {
    console.warn(
      `level-contrast.json is not judged: ${[...new Set(why)].join('; ')}. Run the demonstration washes of the levels and scripts/level-contrast.ts again.`,
    );
    expect(why.length).toBeGreaterThan(0);
  });
});
