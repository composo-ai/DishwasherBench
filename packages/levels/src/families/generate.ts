/**
 * The level generator (docs/research/benchmark.md sections 4.1 and 4.3): a level family is a
 * meal, with the items it leaves behind, the soils on them and their points given as ranges; a
 * seed draws one level from it.
 *
 * What a seed decides: how many sat at the table, how long ago, which of the alternative
 * pieces of each kind is on the counter and how many of them, how much of each named region
 * its soil covers and how thick it lies (inside the range the soil's data allow,
 * `SoilType.working`), and what each piece is worth. The seed of the wash itself is derived
 * from the same number and is never shown.
 *
 * What it does not decide: the shapes of the items (the catalogue's pieces are used as they
 * are; jittering their dimensions, section 4.3 item 2, is not built), and anything about the
 * outcome. A generated level is plain level data and passes the same validation and the same
 * gates as a hand-written one (`validateLevel`, `levelSoilFindings`, and the reference
 * policies' margins, `REFERENCE_GATES` of `@spotless/bench`).
 *
 * Determinism: every draw is a counter-based hash of (seed, group, purpose, index), so the
 * same family and seed give the same level, and a group added to a family leaves the draws of
 * the others as they were.
 */

import type { SoilHeatHistory } from '@spotless/catalogue';
import { describeSoil, getItemType, getSoil } from '@spotless/catalogue';
import { hashU32, u32ToUnitFloat } from '@spotless/core';
import { PRIMARY_MACHINE } from '@spotless/machine';
import { GAME_PROGRAMME_ID } from '../programmes.ts';
import { INTERFACE_MANUAL, starterRules, typicalAmountG } from '../starter/builder.ts';
import type { Level, LevelItem, LevelSoil } from '../types.ts';

/** A closed range `[low, high]` a number is drawn from. */
export type Range = readonly [number, number];

/** A soil of a family: what it is and the ranges its record is drawn from. */
export interface FamilySoil {
  /** Catalogue soil id. */
  readonly type: string;
  /** Region id to the range of the covered share of that region. */
  readonly regions: Readonly<Record<string, Range>>;
  /** How it was heated; default the soil's usual history. */
  readonly heatHistory?: SoilHeatHistory;
  /**
   * Thickness against the soil's working loading; default 0.8 to 1.25. The amount never
   * leaves the range of the soil's data.
   */
  readonly relative?: Range;
  /** Hours added to the age of the meal (a lunch box packed the evening before); default 0. */
  readonly olderByH?: number;
}

/** How many pieces of a group there are: a range, or so many for each person at the table. */
export type FamilyCount = Range | { readonly perDiner: number; readonly extra?: Range };

/** A kind of piece a meal leaves behind. */
export interface FamilyGroup {
  /** Prefix of the item ids (`plate` gives `plate_01`, ...). */
  readonly prefix: string;
  /** Catalogue item types that can stand for it; the seed picks one for the whole group. */
  readonly itemTypes: readonly string[];
  readonly count: FamilyCount;
  /** Points of one piece, a whole number drawn once for the group. */
  readonly points: Range;
  readonly soils: readonly FamilySoil[];
  /** Chance that the group is on the counter at all; default 1. */
  readonly chance?: number;
}

/** A level family. */
export interface LevelFamily {
  /** Identifier; a level of the family is called `<id>-<seed>`. */
  readonly id: string;
  readonly title: string;
  /**
   * What the meal was, as the level's summary: `{diners}` and `{age}` are replaced by the
   * drawn number at the table and the hours since.
   */
  readonly summary: string;
  /** People at the table. */
  readonly diners: Range;
  /** Whole hours between the meal and the wash. */
  readonly ageH: Range;
  /**
   * The archetypes of benchmark.md section 5.7 the family is built around, in words. A note
   * for whoever reads the family: nothing in the generator or the wash makes it true, and a
   * family is kept only if the reference policies' washes show it.
   */
  readonly traps: readonly string[];
  readonly groups: readonly FamilyGroup[];
}

/** Purposes of a draw: the second key of its hash. */
const DRAW = { diners: 1, age: 2, present: 3, type: 4, count: 5, points: 6, coverage: 7, thick: 8 };

function unit(seed: number, group: number, purpose: number, index = 0): number {
  return u32ToUnitFloat(hashU32(seed >>> 0, group >>> 0, purpose >>> 0, index >>> 0));
}

/** A whole number from a closed range. */
function whole(range: Range, u: number): number {
  const lo = Math.ceil(range[0]);
  const hi = Math.floor(range[1]);
  return Math.min(hi, lo + Math.floor(u * (hi - lo + 1)));
}

/** A share from a closed range, to 0.05. */
function share(range: Range, u: number): number {
  const drawn = range[0] + u * (range[1] - range[0]);
  return Math.min(1, Math.max(0.05, Math.round(drawn * 20) / 20));
}

/** The seed of the wash of a generated level: a fixed mix of the family and the level's seed. */
export function generatedWashSeed(familyId: string, seed: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < familyId.length; i++) h = Math.imul(h ^ familyId.charCodeAt(i), 0x01000193);
  return hashU32(seed >>> 0, h >>> 0, 0x5eed);
}

/** The id of the level a seed draws from a family. */
export function generatedLevelId(family: LevelFamily, seed: number): string {
  return `${family.id}-${seed}`;
}

/**
 * Draws the level of a seed from a family. Throws a RangeError for a seed that is not a whole
 * number from 0 to 2^32 - 1, and for a family that names an unknown item type, soil or region
 * (through the catalogue).
 */
export function generateLevel(family: LevelFamily, seed: number): Level {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`levels: a generator seed is a whole number from 0 to 2^32 - 1`);
  }
  const diners = whole(family.diners, unit(seed, 0, DRAW.diners));
  const ageH = whole(family.ageH, unit(seed, 0, DRAW.age));
  const items: LevelItem[] = [];
  family.groups.forEach((group, g) => {
    const key = g + 1;
    if (group.chance !== undefined && unit(seed, key, DRAW.present) >= group.chance) return;
    const itemType = group.itemTypes[
      Math.min(
        group.itemTypes.length - 1,
        Math.floor(unit(seed, key, DRAW.type) * group.itemTypes.length),
      )
    ] as string;
    const type = getItemType(itemType);
    const count = Array.isArray(group.count)
      ? whole(group.count as Range, unit(seed, key, DRAW.count))
      : Math.round((group.count as { perDiner: number }).perDiner * diners) +
        whole((group.count as { extra?: Range }).extra ?? [0, 0], unit(seed, key, DRAW.count));
    const points = whole(group.points, unit(seed, key, DRAW.points));
    for (let i = 1; i <= count; i++) {
      const soils: LevelSoil[] = group.soils.map((soil, k) => {
        const regions: Record<string, number> = {};
        Object.keys(soil.regions).forEach((region, r) => {
          regions[region] = share(
            soil.regions[region] as Range,
            unit(seed, key, DRAW.coverage, i * 64 + k * 8 + r),
          );
        });
        const age = ageH + (soil.olderByH ?? 0);
        const heatHistory = soil.heatHistory ?? getSoil(soil.type).working.heatHistory;
        const relative = soil.relative ?? [0.8, 1.25];
        const thickness =
          relative[0] + unit(seed, key, DRAW.thick, i * 64 + k) * (relative[1] - relative[0]);
        return {
          type: soil.type,
          regions: Object.keys(regions).map((region) => ({
            region,
            coverage: regions[region] as number,
          })),
          amountG: typicalAmountG(itemType, { type: soil.type, regions, ageH: age }, thickness),
          ageH: age,
          heatHistory,
          // The catalogue's own words for the soil, its history, its age and where it sits:
          // what the card says is then what the record holds.
          description: describeSoil(soil.type, {
            ageH: age,
            heatHistory,
            regionLabels: Object.keys(regions).map(
              (region) => type.surfaceRegions.find((s) => s.id === region)?.label ?? region,
            ),
          }),
        };
      });
      items.push({
        id: `${group.prefix}_${String(i).padStart(2, '0')}`,
        itemType,
        points,
        soils,
      });
    }
  });
  const age = ageH === 1 ? 'an hour' : `${ageH} hours`;
  return {
    id: generatedLevelId(family, seed),
    title: `${family.title} (${seed})`,
    summary: family.summary.replaceAll('{diners}', String(diners)).replaceAll('{age}', age),
    machineId: PRIMARY_MACHINE.id,
    config: null,
    racks: {},
    programmeId: GAME_PROGRAMME_ID,
    items,
    rules: starterRules(items.length),
    seed: generatedWashSeed(family.id, seed),
    manual: INTERFACE_MANUAL,
    family: { id: family.id, seed },
  };
}
