/**
 * The generated levels of the game: two seeds of each family of `families.ts`, the shape of
 * the `dev` set of docs/research/benchmark.md section 4.1 (families x 2 seeds) in small. The
 * seeds are public, like everything about a `dev` level; a held-out set would draw other
 * seeds from other families on the scoring host.
 */

import type { Level } from '../types.ts';
import { LEVEL_FAMILIES } from './families.ts';
import type { LevelFamily } from './generate.ts';
import { generateLevel } from './generate.ts';

export type { FamilyCount, FamilyGroup, FamilySoil, LevelFamily, Range } from './generate.ts';
export { generatedLevelId, generatedWashSeed, generateLevel } from './generate.ts';
export { COOKED_BREAKFAST, LEVEL_FAMILIES, PASTA_SUPPER, ROAST_LUNCH } from './families.ts';

/** The seeds each family is drawn with for the generated set. */
export const GENERATED_SEEDS: readonly number[] = [1, 2];

let built: readonly Level[] | undefined;

/** The generated levels: every family of {@link LEVEL_FAMILIES} with every seed of {@link GENERATED_SEEDS}. */
export function generatedLevels(): readonly Level[] {
  built ??= LEVEL_FAMILIES.flatMap((family) =>
    GENERATED_SEEDS.map((seed) => generateLevel(family, seed)),
  );
  return built;
}

/** The family a level was drawn from, or undefined for a hand-written level. */
export function familyOf(level: Level): LevelFamily | undefined {
  return level.family === undefined
    ? undefined
    : LEVEL_FAMILIES.find((family) => family.id === level.family?.id);
}
