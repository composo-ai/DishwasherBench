/**
 * Soil records of a level against what is known about the soil
 * (docs/calibration/soil-quantities.md; `SoilType.working` of the catalogue, which a test of
 * `@spotless/bench` holds equal to the wash simulation's own table).
 *
 * A level states a soil as an amount in grams on named regions of an item with a covered share
 * of each. What the wash removes is dry matter per covered area, so a record is sound when
 * that stated amount, spread over the area it covers, lies in the range the soil's data allow.
 * The first build wrote amounts to 0.01 g with a floor of 0.01 g: nine times a working film of
 * coffee in a mug, 68 times one on a teaspoon.
 *
 * A level's words are checked against its numbers as far as words can be: a description that
 * says "overnight", "about 4 hours" or "baked on" must sit on a record that is.
 */

import type { SoilHeatHistory } from '@spotless/catalogue';
import { getItemType, getSoil, hasItemType, hasSoil, instantiate } from '@spotless/catalogue';
import type { Level, LevelItem, LevelProblem, LevelSoil } from './types.ts';

/** Slack on the ends of a loading range, for amounts written to three significant figures. */
export const LOADING_TOLERANCE = 0.01;

/** One soil record of a level as the wash will read it. */
export interface SoilRecordQuantities {
  /** Area the record covers, m^2. */
  readonly coveredAreaM2: number;
  /** The stated amount over that area on the soil's basis, g/m^2. */
  readonly loadingGPerM2: number;
  /** Dry matter over that area, g/m^2 (1 mg/cm^2 = 10 g/m^2). */
  readonly dryGPerM2: number;
  /** `loadingGPerM2` over the soil's working loading: 1 for a usual layer. */
  readonly relative: number;
}

/** The quantities of a soil record. Throws a RangeError for an unknown item type or soil. */
export function soilRecordQuantities(item: LevelItem, soil: LevelSoil): SoilRecordQuantities {
  const working = getSoil(soil.type).working;
  const areas = instantiate(item.itemType).regionAreas;
  let area = 0;
  for (const region of soil.regions) area += (areas[region.region] ?? 0) * region.coverage;
  const loading = area > 0 ? soil.amountG / area : Infinity;
  return {
    coveredAreaM2: area,
    loadingGPerM2: loading,
    dryGPerM2: loading * working.solidsFraction,
    relative: loading / working.gPerM2,
  };
}

const HEATED: readonly SoilHeatHistory[] = ['cooked', 'baked', 'burnt'];

/** What the words of a description claim about the record they sit on. */
const CLAIMS: readonly {
  readonly pattern: RegExp;
  readonly holds: (soil: LevelSoil, match: RegExpMatchArray) => boolean;
  readonly says: string;
}[] = [
  {
    pattern: /\bovernight\b|\bnext morning\b/i,
    holds: (soil) => soil.ageH >= 8 && soil.ageH <= 16,
    says: 'left overnight (8 to 16 hours)',
  },
  {
    pattern: /\b(?:about )?an hour\b/i,
    holds: (soil) => soil.ageH >= 0.5 && soil.ageH <= 1.5,
    says: 'about an hour old',
  },
  {
    pattern: /\b(\d+) hours?\b/i,
    holds: (soil, match) => Math.abs(soil.ageH - Number(match[1])) <= 0.5,
    says: 'that many hours old',
  },
  {
    pattern: /\b(?:this|since this) morning\b/i,
    holds: (soil) => soil.ageH >= 4 && soil.ageH <= 14,
    says: 'from this morning (4 to 14 hours)',
  },
  {
    pattern: /\byesterday\b|\ba day old\b/i,
    holds: (soil) => soil.ageH >= 16 && soil.ageH <= 36,
    says: 'a day old (16 to 36 hours)',
  },
  {
    pattern: /\bstill wet\b|\bfresh\b/i,
    holds: (soil) => soil.ageH < 1,
    says: 'fresh (under an hour)',
  },
  {
    pattern: /\bbaked[- ]on\b|\bburnt\b|\bcharred\b|\bcaramelised\b|\bscalded\b|\bcaught on\b/i,
    holds: (soil) => HEATED.includes(soil.heatHistory),
    says: 'cooked, baked or burnt on',
  },
];

/**
 * Everything about the soil records of a level that disagrees with the soil's data or with the
 * record's own description; empty when they agree. Unknown item types and soils are
 * `validateLevel`'s to report and are passed over here.
 */
export function levelSoilFindings(level: Level): LevelProblem[] {
  const problems: LevelProblem[] = [];
  level.items.forEach((item, i) => {
    if (!hasItemType(item.itemType)) return;
    const type = getItemType(item.itemType);
    item.soils.forEach((soil, j) => {
      const path = `items.${i}.soils.${j}`;
      if (!hasSoil(soil.type)) return;
      if (soil.regions.some((r) => !type.surfaceRegions.some((s) => s.id === r.region))) return;
      const working = getSoil(soil.type).working;
      const q = soilRecordQuantities(item, soil);
      if (!(q.coveredAreaM2 > 0)) {
        problems.push({ path: `${path}.regions`, message: 'the soil covers no area' });
        return;
      }
      const [lo, hi] = working.rangeGPerM2;
      if (
        q.loadingGPerM2 < lo * (1 - LOADING_TOLERANCE) ||
        q.loadingGPerM2 > hi * (1 + LOADING_TOLERANCE)
      ) {
        problems.push({
          path: `${path}.amountG`,
          message: `${soil.amountG} g of ${soil.type} on ${(q.coveredAreaM2 * 1e4).toFixed(1)} cm2 of ${item.id} is ${q.loadingGPerM2.toPrecision(3)} g/m2 (${working.basis}), outside ${lo} to ${hi} (working ${working.gPerM2}): ${(working.gPerM2 * q.coveredAreaM2).toPrecision(3)} g would be the working amount`,
        });
      }
      const text = soil.description;
      if (text === undefined) return;
      for (const claim of CLAIMS) {
        const match = text.match(claim.pattern);
        if (match !== null && !claim.holds(soil, match)) {
          problems.push({
            path: `${path}.description`,
            message: `"${text}" says the soil is ${claim.says}; the record is ${soil.ageH} h old and '${soil.heatHistory}'`,
          });
        }
      }
    });
  });
  return problems;
}

/**
 * The soils whose verdict the wash simulation does not yet settle on Eco 50: the bleachable
 * stains. Their removal turns on one rate (`soil.bleachRate`) that the anchoring
 * could not identify: at the default every tea item of the standard load reads dirty on Eco
 * 50, a quarter more reproduces the published mean (docs/calibration/anchoring-v4.md). A
 * level of the game carries none of them until a test wash has fixed that rate.
 */
export function isUnsettledSoil(soilId: string): boolean {
  return hasSoil(soilId) && getSoil(soilId).working.appearance === 'stain';
}

/** The items of a level that carry an unsettled soil ({@link isUnsettledSoil}), by id. */
export function unsettledItems(level: Level): string[] {
  return level.items
    .filter((item) => item.soils.some((soil) => isUnsettledSoil(soil.type)))
    .map((item) => item.id);
}

/**
 * Catalogue soils whose verdict on Eco 50 turns on a parameter the anchoring has not settled:
 * the share of the programme's soak in which the pump runs (`prog.soakDuty`, 0.5 by the
 * label's energy, 0.75 by the published table; docs/calibration/anchoring-v5.md section 3).
 * They are the soils of the simulation's egg-yolk and starch classes. Washed on carefully
 * loaded pieces at the fast tier (the soil lab, docs/benchmark/levels.md section 4): at a duty
 * of 0.5 mince on a plate comes clean on 44 of 44 pieces and at 0.25 on none; dried egg yolk on
 * a plate on none of 39 at 0.5 and on all at 0.75; porridge in a spoon on 22 of 30 and on none.
 * Gravy, tomato sauce, avocado, mustard, fats, jam and sugar read the same from 0.25 to 1.
 *
 * The soils of the simulation's milk class (yoghurt, a skin of milk, egg white) are not in the
 * list: they read the same over the whole range of the soak, and at the protease level the
 * anchoring fits (0.02) as at the one it gives the owner's capsule (0.03). They do turn at
 * the registry's default of 0.010, which the anchoring's fit puts 0.73 log units behind:
 * `scripts/robustness.ts` of `@spotless/bench` washes that case too.
 *
 * A test of `@spotless/bench` holds this list to the simulation's own table of classes.
 */
export const SOAK_SENSITIVE_SOILS: readonly string[] = [
  'egg_yolk_dried',
  'egg_cooked',
  'cheese_melted',
  'cheese_baked',
  'minced_meat',
  'fat_polymerised',
  'burnt_carbonised',
  'burnt_sugar',
  'iec_minced_meat',
  'iec_egg_yolk',
  'ikw_egg_yolk',
  'ikw_minced_meat',
  'ikw_creme_brulee',
  'aham_egg_yolk',
  'aham_ground_beef',
  'rice_starch',
  'pasta_starch',
  'porridge',
  'mashed_potato',
  'dough_batter',
  'iec_oat_flakes',
  'ikw_starch_mix',
  'ikw_pasta',
  'aham_oatmeal',
  'aham_mashed_potato',
];

/** True for a soil whose verdict on Eco 50 turns on the soak ({@link SOAK_SENSITIVE_SOILS}). */
export function isSoakSensitiveSoil(soilId: string): boolean {
  return SOAK_SENSITIVE_SOILS.includes(soilId);
}

/** The items of a level that carry a soak-sensitive soil, by id. */
export function soakSensitiveItems(level: Level): string[] {
  return level.items
    .filter((item) => item.soils.some((soil) => isSoakSensitiveSoil(soil.type)))
    .map((item) => item.id);
}

/**
 * The share of a level's points that sits on items with a soak-sensitive soil: what the
 * owner's test washes may still move. The levels of the game keep it under
 * {@link SOAK_SENSITIVE_SHARE_MAX}, on the pans and dishes a meal was cooked in.
 */
export function soakSensitiveShare(level: Level): number {
  const total = level.items.reduce((sum, item) => sum + item.points, 0);
  const ids = new Set(soakSensitiveItems(level));
  const sensitive = level.items
    .filter((item) => ids.has(item.id))
    .reduce((sum, item) => sum + item.points, 0);
  return total > 0 ? sensitive / total : 0;
}

/**
 * Most of a drawn level's points that may sit on items with a soak-sensitive soil (there they
 * sit on the pans and dishes only).
 */
export const SOAK_SENSITIVE_SHARE_MAX = 0.3;

/**
 * Most of a course level's points that may sit on what people eat and drink from and carries
 * a soak-sensitive soil. Since the soak was calibrated on the owner's first test wash (dried
 * egg yolk on plates, docs/calibration/owner-wash-01-calibration.md) the course puts dried
 * egg, thin porridge and starch on the table from its third level on: they are the soils that
 * come clean from a well-placed piece and not from a badly placed one. What calibration left
 * open (the soak sprays 0.59 to 1 of the time) is washed at both ends for such a level by
 * `scripts/robustness.ts` of `@spotless/bench`.
 */
export const SOAK_SENSITIVE_TABLE_SHARE_MAX = 0.4;
