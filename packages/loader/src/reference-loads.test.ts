// The saved reference loads of every level of the game: there, made for the level as it is
// defined now, by the policy as the benchmark harness plays it, and with mistakes in every
// careless one. (That each replays to its hashes and that its baskets travel is checked by
// `scripts/check-loads.ts`, which takes minutes.)
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allLevels } from '@spotless/levels';
import { describe, expect, it } from 'vitest';
import { CARELESS_DEFAULT_MISTAKES, MACHINE_MISTAKE_KINDS } from './mistakes.ts';
import type { StandardLoad } from './standard-loads.ts';
import { STANDARD_LOAD_FORMAT, referenceItems, referenceSeed } from './standard-loads.ts';

const POLICIES = ['careful', 'careless', 'random'] as const;

function saved(name: string): StandardLoad | null {
  const file = fileURLToPath(new URL(`../loads/${name}.json`, import.meta.url));
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
}

describe('the saved reference loads', () => {
  const levels = allLevels();

  it('exist for every level of the game and every policy, made for the level as it is now', () => {
    for (const level of levels) {
      for (const policy of POLICIES) {
        const name = `${level.id}-${policy}`;
        const load = saved(name);
        expect(
          load,
          `${name}: generate it (pnpm --filter @spotless/loader generate-loads ${name})`,
        ).not.toBeNull();
        if (load === null) continue;
        expect(load.format, name).toBe(STANDARD_LOAD_FORMAT);
        // The level inside the file is the level of the game: its items, soils, points,
        // programme and seed. A load made for another definition must be generated again.
        expect(load.level, `${name} was made for another definition of its level`).toEqual(
          JSON.parse(JSON.stringify(level)),
        );
        expect(load.policy.name, name).toBe(policy);
        // The policy as the harness plays it with its default seed.
        expect(load.policy.seed, name).toBe(referenceSeed(level, 1));
        expect(load.offered, name).toEqual(referenceItems(level));
        expect(load.wash_manifest.programme_id, name).toBe('eco_50');
        // What is in the machine is what the manifest washes, and it is some of what was offered.
        expect(load.wash_manifest.items.map((item) => item.item_id).sort(), name).toEqual(
          [...load.placed].sort(),
        );
        expect(load.placed.length, name).toBeGreaterThan(0);
        expect(load.placed.length, name).toBeLessThanOrEqual(level.items.length);
        // The cycle could be started: the door closes on the load.
        expect(load.check.door_closes, name).toBe(true);
      }
    }
  });

  it('are careful loads without a mistake, whose arms turn and whose tablet can fall', () => {
    for (const level of levels) {
      const load = saved(`${level.id}-careful`);
      if (load === null) continue;
      expect(load.mistakes, level.id).toEqual([]);
      expect(
        load.numbers.check_passes,
        `${level.id}: ${load.numbers.check_findings.join('; ')}`,
      ).toBe(true);
      expect(load.numbers.unstable, level.id).toEqual([]);
    }
  });

  it('are careless loads that go on from the careful load and make mistakes on it, on every level', () => {
    for (const level of levels) {
      const careful = saved(`${level.id}-careful`);
      const careless = saved(`${level.id}-careless`);
      if (careful === null || careless === null) continue;
      // At least two mistakes in every careless load, the tutorial's included, and none of
      // the two kinds that stop the machine: those are made only when asked for.
      expect(careless.mistakes.length, level.id).toBeGreaterThanOrEqual(2);
      for (const mistake of careless.mistakes) {
        expect(CARELESS_DEFAULT_MISTAKES, `${level.id} ${mistake.item_id}`).toContain(mistake.kind);
        expect(MACHINE_MISTAKE_KINDS).not.toContain(mistake.kind);
        expect(careless.placed, `${level.id} ${mistake.kind}`).toContain(mistake.item_id);
      }
      // The pair holds nearly the same items. A mistake or the travel of the baskets throws a
      // few out of the careless load; and the careless load can hold a few the careful one
      // lacks, because it goes on from the careful load as it stood before that load's last
      // tidying took out what leaned against its row (found on four levels of twelve on
      // 2026-10-11: one pasta bowl, two ramekins). Both are bounded here, not denied.
      const before = new Set(careful.placed);
      const kept = careless.placed.filter((id) => before.has(id)).length;
      expect(kept / careful.placed.length, level.id).toBeGreaterThanOrEqual(0.85);
      expect(careless.placed.filter((id) => !before.has(id)).length, level.id).toBeLessThanOrEqual(
        3,
      );
      // No arm is stopped: the default mistakes are those of the hand, and what the travel of
      // the baskets pushes into the path of an arm comes out before the load is called finished.
      for (const arm of careless.check.spray_arms) {
        expect(
          arm.full_rotation,
          `${level.id}: ${arm.arm} stopped by ${arm.blocked_by ?? '?'}`,
        ).toBe(true);
      }
    }
  });

  it('are random loads that hold fewer of the points than the careful ones', () => {
    for (const level of levels) {
      const careful = saved(`${level.id}-careful`);
      const random = saved(`${level.id}-random`);
      if (careful === null || random === null) continue;
      const points = new Map(level.items.map((item) => [item.id, item.points]));
      const worth = (ids: readonly string[]): number =>
        ids.reduce((sum, id) => sum + (points.get(id) ?? 0), 0);
      expect(random.mistakes, level.id).toEqual([]);
      // The random policy takes out what stops an arm, the door or a basket, and it does so
      // after the baskets have travelled: the load that is washed has both arms turning. (The
      // tablet's path it leaves as it fell.) This is what the random load of the dinner party
      // failed on 2026-10-11, when the travel came after the policy's last check.
      for (const arm of random.check.spray_arms) {
        expect(
          arm.full_rotation,
          `${level.id}: ${arm.arm} stopped by ${arm.blocked_by ?? '?'}`,
        ).toBe(true);
      }
      expect(random.placed.length, level.id).toBeLessThanOrEqual(careful.placed.length);
      expect(worth(random.placed), level.id).toBeLessThan(worth(level.items.map((i) => i.id)));
    }
  });
});
