/**
 * @spotless/levels. The level format, its validation, the player-facing level card, the
 * course of hand-written levels on the owner's machine and the level generator.
 *
 *  - `Level` (`types.ts`): a level as data: machine and starting configuration, the programme
 *    it is scored on and those that may be chosen instead, items with their soils and points,
 *    rules and a seed.
 *  - `validateLevel(level)`: every problem of a level as a value; empty when it is sound.
 *    `levelSoilFindings(level)`: every soil record that disagrees with the soil's working
 *    quantities or with its own description (`soil-check.ts`).
 *  - `levelCard(level)`: the level card of the session contract (`card-types.ts`), which the
 *    session re-exports. It carries what a user manual, an open door and the cook would know,
 *    and nothing about the soil model or the outcome.
 *  - `GAME_PROGRAMME_ID`, `GAME_DETERGENTS` (`programmes.ts`): the game is scored on Eco 50
 *    with the owner's capsule, and no level offers another programme.
 *  - `levelDifficulty(level)`, `COURSE_LEVEL_IDS` (`course.ts`, `starter/index.ts`): the
 *    course. The levels are listed in the order they are meant to be played; each carries its
 *    `number`, its `difficulty` on a scale of 1 to 10 worked out from its own pieces, soils
 *    and points, and `newHere`, what it adds to the levels before it.
 *  - `rackOptions`, `applyRackOption`: the adjustable features of the machine's racks, shared
 *    by the card and the session's `set_rack`.
 *  - `allLevels()` (the course), `findLevel(id)`, `listLevels()`: the level set of the game.
 *    `generatedLevels()`: the levels drawn from the families, which are not in the course.
 *  - `generateLevel(family, seed)`, `LEVEL_FAMILIES` (`families/`): a level family is a meal
 *    with its items, soils and points as ranges; a seed draws a level from it.
 *  - `capacityEstimate(level)`: a rough measure of how much of a level can fit. Whether a
 *    level offers more than fits is decided by the careful reference load of the level
 *    (`@spotless/loader`, `scripts/pack-levels.ts`), not by this estimate.
 */

export * from './types.ts';
export * from './card-types.ts';
export * from './options.ts';
export * from './card.ts';
export * from './validate.ts';
export * from './capacity.ts';
export {
  coveredAreaM2,
  INTERFACE_MANUAL,
  STARTER_ACTIONS_MIN,
  STARTER_ACTIONS_PER_ITEM,
  starterRules,
  threeFigures,
  typicalAmountG,
  usualHeatHistory,
} from './starter/builder.ts';
export {
  allLevels,
  COURSE_LEVEL_IDS,
  findLevel,
  listLevels,
  STARTER_LEVEL_IDS,
  starterLevels,
} from './starter/index.ts';
export * from './course.ts';
export * from './programmes.ts';
export * from './soil-check.ts';
export * from './families/index.ts';
