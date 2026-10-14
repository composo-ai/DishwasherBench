/**
 * Validation of level data. Problems are returned as values; an empty list means the level can
 * be played. Cheap: it looks records up and never runs `validateCatalogue`.
 */

import {
  SOIL_HEAT_HISTORIES,
  getItemType,
  getSoil,
  hasItemType,
  hasSoil,
} from '@spotless/catalogue';
import { isValidId } from '@spotless/core';
import {
  buildMachineGeometry,
  errorsOf,
  findMachine,
  findProgramme,
  validateMachineConfig,
} from '@spotless/machine';
import type { Level, LevelProblem } from './types.ts';

/** Ids an item may not have because the session uses them for bodies that are not items. */
export const RESERVED_ITEM_IDS: readonly string[] = [
  'kitchen_floor',
  'door_closing',
  'tub',
  'door',
];

const TRACKS: readonly string[] = ['one_shot', 'adaptive', 'campaign'];
const RACKS: readonly string[] = ['lower_rack', 'upper_rack', 'third_rack', 'cutlery_basket'];

function wholePositive(x: unknown): boolean {
  return typeof x === 'number' && Number.isInteger(x) && x > 0;
}

/** Everything wrong with a level; empty when it is sound. */
export function validateLevel(level: Level): LevelProblem[] {
  const problems: LevelProblem[] = [];
  const add = (path: string, message: string): void => {
    problems.push({ path, message });
  };

  if (!isValidId(level.id)) add('id', `'${level.id}' is not a valid identifier`);
  if (level.title.trim() === '') add('title', 'the title is empty');
  if (level.summary.trim() === '') add('summary', 'the summary is empty');

  const spec = findMachine(level.machineId);
  const reserved = new Set(RESERVED_ITEM_IDS);
  if (spec === undefined) {
    add('machineId', `unknown machine '${level.machineId}'`);
  } else {
    if (level.config !== null) {
      for (const p of errorsOf(validateMachineConfig(spec, level.config))) {
        add(`config.${p.path}`, p.message);
      }
    }
    if (findProgramme(spec, level.programmeId) === undefined) {
      add('programmeId', `machine '${spec.id}' has no programme '${level.programmeId}'`);
    }
    if (level.config === null || errorsOf(validateMachineConfig(spec, level.config)).length === 0) {
      const geometry = buildMachineGeometry(spec, level.config ?? spec.defaultConfig);
      for (const part of geometry.parts) reserved.add(part.id);
      const frames = new Set<string>(geometry.parts.map((p) => p.frame));
      for (const rack of Object.keys(level.racks).sort()) {
        const position = (level.racks as Record<string, unknown>)[rack];
        if (!RACKS.includes(rack) || rack === 'cutlery_basket' || !frames.has(rack)) {
          add(`racks.${rack}`, `the machine has no basket '${rack}' that slides`);
        } else if (position !== 'in' && position !== 'out') {
          add(`racks.${rack}`, `a rack is 'in' or 'out', not '${String(position)}'`);
        }
      }
    }
  }

  if (!TRACKS.includes(level.rules.track))
    add('rules.track', `unknown track '${level.rules.track}'`);
  if (!wholePositive(level.rules.actionsMax))
    add('rules.actionsMax', 'must be a positive whole number');
  if (!wholePositive(level.rules.queriesMax))
    add('rules.queriesMax', 'must be a positive whole number');
  if (!wholePositive(level.rules.washesMax))
    add('rules.washesMax', 'must be a positive whole number');
  if (typeof level.rules.mechanicalChecks !== 'boolean') {
    add('rules.mechanicalChecks', 'must be true or false');
  }
  if (level.rules.exactPlacement !== undefined && typeof level.rules.exactPlacement !== 'boolean') {
    add('rules.exactPlacement', 'must be true or false when given');
  }
  if (!Number.isInteger(level.seed) || level.seed < 0 || level.seed > 0xffffffff) {
    add('seed', 'must be a whole number from 0 to 2^32 - 1');
  }

  if (level.items.length === 0) add('items', 'a level needs at least one item');
  const seen = new Set<string>();
  level.items.forEach((item, i) => {
    const at = `items.${i}`;
    if (!isValidId(item.id)) add(`${at}.id`, `'${item.id}' is not a valid identifier`);
    if (seen.has(item.id)) add(`${at}.id`, `item id '${item.id}' is used twice`);
    if (reserved.has(item.id)) add(`${at}.id`, `'${item.id}' is the name of a part of the machine`);
    seen.add(item.id);
    if (!wholePositive(item.points)) add(`${at}.points`, 'must be a positive whole number');
    if (!hasItemType(item.itemType)) {
      add(`${at}.itemType`, `unknown item type '${item.itemType}'`);
      return;
    }
    const type = getItemType(item.itemType);
    const regions = new Set(type.surfaceRegions.map((r) => r.id));
    item.soils.forEach((soil, j) => {
      const path = `${at}.soils.${j}`;
      if (!hasSoil(soil.type)) {
        add(`${path}.type`, `unknown soil '${soil.type}'`);
      } else if (!SOIL_HEAT_HISTORIES.includes(soil.heatHistory)) {
        add(`${path}.heatHistory`, `unknown heat history '${String(soil.heatHistory)}'`);
      } else if (!getSoil(soil.type).heatHistories.includes(soil.heatHistory)) {
        add(
          `${path}.heatHistory`,
          `soil '${soil.type}' is never '${soil.heatHistory}' (it can be ${getSoil(soil.type).heatHistories.join(', ')})`,
        );
      }
      if (!(soil.amountG > 0) || !Number.isFinite(soil.amountG)) {
        add(`${path}.amountG`, 'must be a positive number of grams');
      }
      if (!(soil.ageH >= 0) || !Number.isFinite(soil.ageH)) {
        add(`${path}.ageH`, 'must be a number of hours, 0 or more');
      }
      if (soil.description !== undefined && soil.description.trim() === '') {
        add(`${path}.description`, 'the description is empty');
      }
      if (soil.regions.length === 0) add(`${path}.regions`, 'a soil needs at least one region');
      const named = new Set<string>();
      soil.regions.forEach((r, k) => {
        if (!regions.has(r.region)) {
          add(
            `${path}.regions.${k}`,
            `item type '${type.id}' has no region '${r.region}' (it has ${[...regions].join(', ')})`,
          );
        }
        if (named.has(r.region))
          add(`${path}.regions.${k}`, `region '${r.region}' is listed twice`);
        named.add(r.region);
        if (!(r.coverage > 0 && r.coverage <= 1)) {
          add(`${path}.regions.${k}`, 'coverage must be above 0 and at most 1');
        }
      });
    });
  });
  return problems;
}
