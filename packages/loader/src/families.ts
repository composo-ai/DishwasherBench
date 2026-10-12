/**
 * What kind of thing an item is, as a person loading a dishwasher sees it: a plate that stands
 * on edge in a row of tines, a bowl, a glass or cup that goes in mouth down, a pot, a piece of
 * cutlery, a long utensil. A policy reads this from the level card alone (the item's class, its
 * bounding box and its named orientations), never from the catalogue behind it.
 */

import type { ItemRecord } from '@spotless/session';

/** How an item is loaded. */
export type Family =
  /** Stands on edge between tines: plates, saucers, platters, lids, boards, trays, racks. */
  | 'flat'
  /** A bowl or deep plate: on edge or steeply tilted between tines. */
  | 'bowl'
  /** A hollow thing that goes in mouth down: glasses, cups, mugs, containers, bottles, jugs. */
  | 'vessel'
  /** A glass on a stem: mouth down, leaning. */
  | 'stemware'
  /** Pots, pans and large bowls: mouth down and tilted in the lower basket. */
  | 'cookware'
  /** A piece of cutlery for the cutlery basket. */
  | 'cutlery'
  /** A long utensil that lies flat on the upper basket. */
  | 'utensil'
  /** Something small that stands as it is (a bottle teat). */
  | 'small';

/** Outline of a flat item seen face on. */
export type Outline = 'disc' | 'oval' | 'rect';

/** An item as a policy sees it. */
export interface ItemView {
  readonly id: string;
  readonly record: ItemRecord;
  readonly family: Family;
  /** Bounding-box size in the item frame, millimetres. */
  readonly size: readonly [number, number, number];
  /** Names of the item's orientation presets. */
  readonly presets: ReadonlySet<string>;
  /** For flat items and bowls: the preset that stands the item on edge with its face to `-y`. */
  readonly edgePreset: string | null;
  /** For flat items and bowls: outline seen face on. */
  readonly outline: Outline;
  /** Largest dimension, millimetres. */
  readonly longest: number;
  /** True for things that belong in the upper basket (light plastics, drinkware). */
  readonly upperOnly: boolean;
  /** True for a knife: goes into the cutlery basket blade down. */
  readonly knife: boolean;
  /** True for a spoon (it has a bowl that nests). */
  readonly spoon: boolean;
}

const FLAT_CLASSES: ReadonlySet<string> = new Set([
  'dinner_plate',
  'side_plate',
  'soup_plate',
  'melamine_plate',
  'saucer',
  'platter',
  'pan_lid',
  'chopping_board',
  'baking_tray',
  'cooling_rack',
  'muffin_tin',
  'container_lid',
  'oven_dish',
  'roasting_tin',
  'loaf_pan',
]);
const BOWL_CLASSES: ReadonlySet<string> = new Set([
  'deep_plate',
  'pasta_bowl',
  'cereal_bowl',
  'dessert_bowl',
  'serving_bowl',
  'melamine_bowl',
]);
const COOKWARE_CLASSES: ReadonlySet<string> = new Set([
  'saucepan',
  'stockpot',
  'frying_pan',
  'mixing_bowl',
  'colander',
  'sieve',
  'blender_jug',
]);
const STEM_CLASSES: ReadonlySet<string> = new Set(['wine_glass', 'flute']);
const UTENSIL_CLASSES: ReadonlySet<string> = new Set([
  'ladle',
  'turner',
  'spatula',
  'whisk',
  'tongs',
  'wooden_spoon',
  'peeler',
  'grater',
  'chefs_knife',
]);
const UPPER_ONLY_CLASSES: ReadonlySet<string> = new Set([
  'melamine_plate',
  'melamine_bowl',
  'container_lid',
  'food_container',
  'lunch_box',
  'water_bottle',
  'baby_bottle',
  'bottle_teat',
  'sippy_cup',
  'drinking_cup',
]);

/** Longest piece of cutlery that stands in the cutlery basket, millimetres. */
export const CUTLERY_BASKET_MAX_LENGTH = 235;

/** Reads an item record into the view a policy works with. */
export function viewOf(record: ItemRecord): ItemView {
  const presets = new Set(record.orientation_presets.map((p) => p.name));
  const size = record.bbox_mm;
  const longest = Math.max(size[0], size[1], size[2]);
  const cls = record.class;
  let family: Family;
  if (cls === 'bottle_teat') family = 'small';
  else if (UTENSIL_CLASSES.has(cls)) family = 'utensil';
  else if (presets.has('handle_down') || presets.has('handle_up')) {
    family = longest <= CUTLERY_BASKET_MAX_LENGTH ? 'cutlery' : 'utensil';
  } else if (STEM_CLASSES.has(cls)) family = 'stemware';
  else if (COOKWARE_CLASSES.has(cls)) family = 'cookware';
  else if (BOWL_CLASSES.has(cls)) family = 'bowl';
  else if (FLAT_CLASSES.has(cls)) family = 'flat';
  else if (presets.has('inverted')) {
    family = longest > 250 || record.mass_kg > 0.75 ? 'cookware' : 'vessel';
  } else if (presets.has('on_edge') || presets.has('on_long_edge')) family = 'flat';
  else family = 'utensil';
  const edgePreset = presets.has('on_edge')
    ? 'on_edge'
    : presets.has('on_long_edge')
      ? 'on_long_edge'
      : null;
  const round = Math.abs(size[0] - size[1]) <= 2;
  const outline: Outline = round ? 'disc' : cls === 'platter' ? 'oval' : 'rect';
  return {
    id: record.item_id,
    record,
    family,
    size,
    presets,
    edgePreset,
    outline,
    longest,
    upperOnly: UPPER_ONLY_CLASSES.has(cls),
    knife: cls.includes('knife'),
    spoon: cls.includes('spoon'),
  };
}
