/**
 * The level set of the game: the course, seven hand-written levels in the order they are meant
 * to be played, each numbered and with its difficulty worked out (`course.ts`). Levels are
 * built on first use (they look item types up in the catalogue to work out soil amounts) and
 * then kept.
 *
 * The levels the generator draws from its families (`families/`, `generatedLevels()`) are not
 * in the course since 11 October 2026: a level is listed only when its reference loads have
 * been washed at the official tier on the calibrated wash and pass the gates
 * (`REFERENCE_GATES` of `@spotless/bench`), and the families have not been drawn again for
 * that wash. The generator and its tests stand as they were.
 */

import { inCourse } from '../course.ts';
import type { Level } from '../types.ts';
import {
  bakingDayLevel,
  breakfastLevel,
  dinnerPartyLevel,
  lunchForFourLevel,
  mixedFamilyLevel,
  tutorialLevel,
  weeknightDinnerLevel,
} from './levels.ts';

/**
 * Ids of the levels of the course, in the order a player meets them: the first is level 1.
 * Each adds one thing to those before it (`Level.newHere`), and the difficulty rises from one
 * to the next (`Level.difficulty`; a test holds that).
 */
export const COURSE_LEVEL_IDS: readonly string[] = [
  'tutorial',
  'lunch-for-four',
  'weeknight-dinner',
  'breakfast',
  'mixed-family',
  'baking-day',
  'dinner-party',
];

/** The same list under its earlier name. */
export const STARTER_LEVEL_IDS: readonly string[] = COURSE_LEVEL_IDS;

let built: readonly Level[] | undefined;

/** The levels of the course on the owner's machine, the tutorial first. */
export function starterLevels(): readonly Level[] {
  built ??= [
    tutorialLevel(),
    lunchForFourLevel(),
    weeknightDinnerLevel(),
    breakfastLevel(),
    mixedFamilyLevel(),
    bakingDayLevel(),
    dinnerPartyLevel(),
  ].map((level, i) => inCourse(level, i + 1));
  return built;
}

/** The level of the game with the given id, or undefined. */
export function findLevel(levelId: string): Level | undefined {
  return allLevels().find((level) => level.id === levelId);
}

/**
 * Number, id, title, summary, difficulty, what is new and number of items of every level of
 * the game, in the order of the course, for menus.
 */
export function listLevels(): readonly {
  readonly number: number;
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly difficulty: number;
  readonly newHere: string;
  readonly items: number;
}[] {
  return allLevels().map((level, i) => ({
    number: level.number ?? i + 1,
    id: level.id,
    title: level.title,
    summary: level.summary,
    difficulty: level.difficulty ?? 0,
    newHere: level.newHere ?? '',
    items: level.items.length,
  }));
}

/** Every level of the game: the course, in its order. */
export function allLevels(): readonly Level[] {
  return starterLevels();
}
