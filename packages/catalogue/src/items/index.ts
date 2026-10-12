/**
 * Every item type of the catalogue, in the order of the starter catalogue of
 * docs/research/items.md section 10.1 within each family file.
 */

import type { ItemType } from '../types.ts';
import { BAKEWARE_ITEMS } from './bakeware.ts';
import { COOKWARE } from './cookware.ts';
import { CUTLERY } from './cutlery.ts';
import { DRINKWARE } from './drinkware.ts';
import { STORAGE } from './storage.ts';
import { TABLEWARE } from './tableware.ts';
import { UTENSILS } from './utensils.ts';

/** All item types. Use `listItemTypes` for the list sorted by id. */
export const ITEM_TYPES: readonly ItemType[] = [
  ...TABLEWARE,
  ...DRINKWARE,
  ...CUTLERY,
  ...UTENSILS,
  ...COOKWARE,
  ...BAKEWARE_ITEMS,
  ...STORAGE,
];
