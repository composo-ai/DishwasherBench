/**
 * A rough estimate of how much room a level's items need, for level design: it is how the
 * starter set is held to "offers clearly more than fits". It is never shown to players and
 * says nothing about cleaning.
 *
 * Each item is charged the plan area it takes when it is loaded the way people load it:
 *  - flat ware (plates, saucers, platters, boards, lids, trays, wire racks) stands on edge and
 *    takes its longest dimension times the larger of its thickness and one tine pitch;
 *  - pans, tins and oven dishes stand on edge and take their two smaller dimensions;
 *  - bowls lean in a row and take their diameter times the larger of their height and half
 *    their diameter;
 *  - pots, jugs, cups, mugs, glasses, stemware and bottles go in mouth down and take the square
 *    of their body width (a handle reaches over its neighbours);
 *  - containers go in mouth down and take their two larger dimensions;
 *  - utensils lie down and take their two smaller dimensions.
 * Cutlery goes in the cutlery basket and is counted by the piece. The sum is compared with the
 * plan area of the baskets less the cutlery basket.
 *
 * Calibration: the 13 place settings with serving pieces that the owner's machine is rated for
 * (docs/research/standards.md section 5; items.md section 10) come to a ratio of about 1.1 by
 * this measure ({@link RATED_LOAD_RATIO}), so a level "offers clearly more than fits" from
 * about 1.4. [ESTIMATED: a packing heuristic, not a packing.]
 */

import { getItemType, instantiate } from '@spotless/catalogue';
import { findMachine } from '@spotless/machine';
import type { Level } from './types.ts';

/** Pitch a standing plate takes in a tine row, metres [ESTIMATED from the Bosch's rows]. */
export const STANDING_PITCH = 0.03;
/** Cutlery pieces a cell of a cutlery basket takes loosely [ESTIMATED items.md 10.3]. */
export const CUTLERY_PER_CELL = 12;

/**
 * The ratio of {@link capacityEstimate} for the load the owner's machine is rated for: 13 each
 * of dinner plates, soup plates, dessert plates, cups, saucers and glasses, a platter and two
 * serving bowls come to about 0.54 m^2 against 0.488 m^2 of basket. [ESTIMATED]
 */
export const RATED_LOAD_RATIO = 1.1;
/** Ratio from which a level counts as offering clearly more than fits. [ESTIMATED] */
export const OVERFULL_RATIO = 1.4;

const FLAT_TAGS: readonly string[] = [
  'plate',
  'saucer',
  'platter',
  'flat_dish',
  'board',
  'lid',
  'wire_rack',
];
const MOUTH_DOWN_TAGS: readonly string[] = [
  'pot',
  'jug',
  'cup',
  'mug',
  'glass',
  'stemware',
  'bottle',
];

/** The estimate of {@link capacityEstimate}. */
export interface CapacityEstimate {
  /** Plan area the items other than cutlery need, m^2. */
  readonly neededArea: number;
  /** Plan area of the baskets less the cutlery basket, m^2. */
  readonly availableArea: number;
  /** `neededArea / availableArea`: above 1 the level cannot all fit. */
  readonly ratio: number;
  /** Pieces of cutlery in the level, and how many the cutlery basket takes loosely. */
  readonly cutlery: number;
  readonly cutleryCapacity: number;
}

/** Plan area one item takes when loaded the usual way, m^2 (0 for cutlery). */
export function loadedFootprint(itemType: string): number {
  const type = getItemType(itemType);
  if (type.shapeTag === 'cutlery') return 0;
  const { min, max } = instantiate(itemType).bbox;
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const dims = [...size].sort((a, b) => a - b) as [number, number, number];
  const tag = type.shapeTag;
  if (FLAT_TAGS.includes(tag)) return dims[2] * Math.max(dims[0], STANDING_PITCH);
  if (tag === 'bowl') return dims[2] * Math.max(size[2], dims[2] / 2);
  if (MOUTH_DOWN_TAGS.includes(tag)) return Math.min(size[0], size[1]) ** 2;
  if (tag === 'container') return dims[1] * dims[2];
  return dims[0] * dims[1];
}

/** How much room the items of a level need against what its machine has. */
export function capacityEstimate(level: Level): CapacityEstimate {
  const spec = findMachine(level.machineId);
  if (spec === undefined) throw new RangeError(`levels: unknown machine '${level.machineId}'`);
  let available = 0;
  for (const basket of spec.baskets) available += basket.outline.size[0] * basket.outline.size[1];
  const cutleryBasket = spec.cutleryBasket;
  if (cutleryBasket !== null) available -= cutleryBasket.size[0] * cutleryBasket.size[1];
  let needed = 0;
  let cutlery = 0;
  for (const item of level.items) {
    if (getItemType(item.itemType).shapeTag === 'cutlery') cutlery += 1;
    else needed += loadedFootprint(item.itemType);
  }
  return {
    neededArea: needed,
    availableArea: available,
    ratio: needed / available,
    cutlery,
    cutleryCapacity: (cutleryBasket?.cells ?? 0) * CUTLERY_PER_CELL,
  };
}
