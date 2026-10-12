/**
 * The course: the levels of the game in the order they are meant to be played, each harder
 * than the one before it, and the measure that says how hard a level is.
 *
 * After the first play test (11 October 2026) the levels were put in order of difficulty.
 * What makes a level of this game hard, in terms a player would recognise, and each of them
 * worked out from the level's own data (its pieces, their soils and their points; nothing of
 * the wash simulation's outcome):
 *
 *  1. Choice ({@link LevelDifficulty.choice}): how much more is on the counter than the
 *     machine holds, by the room the pieces take loaded the usual way (`capacityEstimate`:
 *     the rated 13 place settings come to 1.1), and how much of the level's points sits on
 *     big pieces (pans, tins, dishes, trays, boards, platters, serving bowls) that each take
 *     the room of several others: whether one of them is worth its place is the decision.
 *  2. Pieces that punish an easy mistake ({@link LevelDifficulty.punishing}): the share of
 *     the level's points on pieces whose shape invites one (a glass, mug, cup, pot or bottle
 *     can stand mouth up or lie on its side; a bowl can lie in another or face down flat; a
 *     spoon can lie in another; a plate can stand face to the wall or two to a slot) and
 *     whose soil then stays: one of tenacity 4 or more on the catalogue's scale. A film of
 *     milk in a glass forgives; a smoothie dried in it does not.
 *  3. Tenacity ({@link LevelDifficulty.tenacity}): how hard the soils cling, as the mean
 *     over the level's points of each piece's most tenacious soil on the catalogue's scale of
 *     1 to 10 (`SoilType.difficulty`, docs/research/soils.md 5.11), taken at the low end of
 *     the soil's range when it is fresh (two hours or less and never heated) and at the high
 *     end when it has stood eight hours or more or was cooked, baked or burnt on. Fresh easy
 *     soils teach nothing; dried egg, old porridge and what was baked on sit near the edge of
 *     clean when well placed and go over it when badly placed.
 *  4. Awkward pieces ({@link LevelDifficulty.awkward}): the share of the pieces (cutlery
 *     apart) that have no row of tines made for them: pans, pots, tins, trays, boards, lids,
 *     tubs, bottles, teats, beakers with spouts, jugs, utensils.
 *
 * Each of the four is brought to a share of a stated full mark and the four are weighed
 * ({@link DIFFICULTY_WEIGHTS}); the sum is put on a scale from 1 to 10
 * ({@link levelDifficulty}). The scale is a designer's measure [ESTIMATED weights and full
 * marks]: what it is held to is that it rises along the course (a test), and that the
 * reference policies' table of `@spotless/bench` can be read beside it.
 *
 * The difficulty is public: it is shown in the list of levels, and it says nothing a player
 * could not count on the level card.
 */

import { getItemType, getSoil } from '@spotless/catalogue';
import { capacityEstimate, loadedFootprint } from './capacity.ts';
import type { Level, LevelItem, LevelSoil } from './types.ts';

/** Shape tags of pieces that can stand mouth up or lie on their side. */
const VESSEL_TAGS: readonly string[] = ['glass', 'mug', 'cup', 'stemware', 'jug', 'bottle', 'pot'];
/** Shape tags of pieces that can stand face to the wall or two to a slot. */
const PLATE_TAGS: readonly string[] = ['plate', 'saucer', 'platter'];
/** Shape tags of the pieces a basket has rows, rests or cells made for. */
const SEATED_TAGS: readonly string[] = [
  'plate',
  'saucer',
  'bowl',
  'glass',
  'mug',
  'stemware',
  'cutlery',
];
/** Item types of the shape tag `cup` or `bowl` that are awkward all the same. */
const AWKWARD_TYPES: readonly string[] = [
  'bottle_teat_silicone',
  'sippy_cup_240',
  'colander_steel_5qt',
  'sieve_mesh_200',
];

/** Tenacity from which a soil stays on a piece that is put in badly. */
export const PUNISHING_TENACITY = 4;
/**
 * Plan area, loaded the usual way, from which a piece counts as big, m^2: more than a dinner
 * plate on edge takes (0.008). A platter, a board, a tray, a serving bowl, a pan.
 */
export const BIG_PIECE_AREA = 0.009;

/** The weights of the four parts of the difficulty; they sum to 1. [ESTIMATED] */
export const DIFFICULTY_WEIGHTS = {
  choice: 0.3,
  punishing: 0.25,
  tenacity: 0.3,
  awkward: 0.15,
} as const;

/** The value of each part that counts as its full mark (a share of 1). [ESTIMATED] */
export const DIFFICULTY_FULL_MARKS = {
  /**
   * Room asked for over room there is, by `capacityEstimate`: nothing below 0.3 (a few pieces
   * in an empty machine), full marks at 1.0 (about the load the machine is rated for, of
   * pieces that were not made for its rows).
   */
  overfill: [0.3, 1.0] as readonly [number, number],
  /** Share of the points on big pieces. */
  bigShare: 0.45,
  /** Share of the points on pieces that punish an easy mistake. */
  punishing: 1,
  /** Mean tenacity over the points, on the catalogue's scale: from 2 (nothing) to 8. */
  tenacity: [2, 8] as readonly [number, number],
  /** Share of the pieces, cutlery apart, that are awkward. */
  awkward: 0.4,
} as const;

/** How hard a soil clings to a piece of a level, on the catalogue's scale of 1 to 10. */
export function soilTenacity(soil: LevelSoil): number {
  const { rank, range } = getSoil(soil.type).difficulty;
  const heated = soil.heatHistory !== 'none' && soil.heatHistory !== 'warm';
  if (heated || soil.ageH >= 8) return range[1];
  if (soil.ageH <= 2 && soil.heatHistory === 'none') return range[0];
  return rank;
}

/** The most tenacious soil of an item; 0 for a clean item. */
export function itemTenacity(item: LevelItem): number {
  return item.soils.reduce((most, soil) => Math.max(most, soilTenacity(soil)), 0);
}

/** The easy mistake the shape of an item invites, or null. */
export function easyMistake(
  itemType: string,
): 'mouth_up_or_on_side' | 'nested' | 'turned_or_doubled' | null {
  const type = getItemType(itemType);
  const tag = type.shapeTag;
  if (VESSEL_TAGS.includes(tag)) return 'mouth_up_or_on_side';
  if (tag === 'cup') return 'mouth_up_or_on_side';
  if (tag === 'bowl') return itemType.startsWith('ramekin') ? 'mouth_up_or_on_side' : 'nested';
  if (tag === 'cutlery') return /spoon/.test(itemType) ? 'nested' : null;
  if (PLATE_TAGS.includes(tag)) return 'turned_or_doubled';
  return null;
}

/** Whether an item is one the baskets have no row, rest or cell made for. */
export function isAwkward(itemType: string): boolean {
  if (AWKWARD_TYPES.includes(itemType)) return true;
  const tag = getItemType(itemType).shapeTag;
  if (tag === 'cup') return false;
  if (tag === 'bowl') return loadedFootprint(itemType) >= 2 * BIG_PIECE_AREA;
  return !SEATED_TAGS.includes(tag);
}

/** The difficulty of a level and the four parts it is made of. */
export interface LevelDifficulty {
  /** Room the pieces ask for over the room of the baskets (`capacityEstimate`). */
  readonly overfill: number;
  /** Share of the points on big pieces. */
  readonly bigShare: number;
  /** Share of the points on pieces that punish an easy mistake. */
  readonly punishingShare: number;
  /** Mean over the points of each piece's most tenacious soil, 1 to 10. */
  readonly meanTenacity: number;
  /** Share of the pieces, cutlery apart, that are awkward. */
  readonly awkwardShare: number;
  /** The four parts, each from 0 to 1. */
  readonly choice: number;
  readonly punishing: number;
  readonly tenacity: number;
  readonly awkward: number;
  /** The difficulty: 1 (nothing of any part) to 10 (full marks on all), to one decimal. */
  readonly difficulty: number;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** The difficulty of a level, from its pieces, soils and points alone. */
export function levelDifficulty(level: Level): LevelDifficulty {
  const total = level.items.reduce((sum, item) => sum + item.points, 0);
  let big = 0;
  let punishingPoints = 0;
  let tenacityPoints = 0;
  let awkwardPieces = 0;
  let pieces = 0;
  for (const item of level.items) {
    const tag = getItemType(item.itemType).shapeTag;
    const tenacity = itemTenacity(item);
    tenacityPoints += tenacity * item.points;
    if (easyMistake(item.itemType) !== null && tenacity >= PUNISHING_TENACITY) {
      punishingPoints += item.points;
    }
    if (tag === 'cutlery') continue;
    pieces += 1;
    if (loadedFootprint(item.itemType) >= BIG_PIECE_AREA) big += item.points;
    if (isAwkward(item.itemType)) awkwardPieces += 1;
  }
  const overfill = capacityEstimate(level).ratio;
  const bigShare = total > 0 ? big / total : 0;
  const punishingShare = total > 0 ? punishingPoints / total : 0;
  const meanTenacity = total > 0 ? tenacityPoints / total : 0;
  const awkwardShare = pieces > 0 ? awkwardPieces / pieces : 0;
  const full = DIFFICULTY_FULL_MARKS;
  // Choice: nothing to choose while everything fits (the big pieces of a level that fits are
  // only pieces); from there the surplus and the weight of the big pieces in equal parts.
  const surplus = clamp01((overfill - full.overfill[0]) / (full.overfill[1] - full.overfill[0]));
  const choice = surplus === 0 ? 0 : (surplus + clamp01(bigShare / full.bigShare)) / 2;
  const punishing = clamp01(punishingShare / full.punishing);
  const tenacity = clamp01(
    (meanTenacity - full.tenacity[0]) / (full.tenacity[1] - full.tenacity[0]),
  );
  const awkward = clamp01(awkwardShare / full.awkward);
  const w = DIFFICULTY_WEIGHTS;
  const sum =
    w.choice * choice + w.punishing * punishing + w.tenacity * tenacity + w.awkward * awkward;
  return {
    overfill,
    bigShare,
    punishingShare,
    meanTenacity,
    awkwardShare,
    choice,
    punishing,
    tenacity,
    awkward,
    difficulty: Math.round((1 + 9 * sum) * 10) / 10,
  };
}

/**
 * A level as the course lists it: numbered from 1 and with its difficulty worked out.
 * `number`, `difficulty` and `newHere` are plain fields of the level (`Level`), so the list
 * of levels and a saved load carry them.
 */
export function inCourse(level: Level, number: number): Level {
  return { ...level, number, difficulty: levelDifficulty(level).difficulty };
}
