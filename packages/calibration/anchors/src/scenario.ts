/**
 * Scenario STD-EU-13 (docs/research/standards.md sections 4.1, 5.1 and 13.3) on the owner's
 * machine: the settled careful IEC load of `packages/loader/loads/` for the poses, with every
 * soil's amount, covered area and ageing set from the dossier's working quantities by
 * {@link STD_EU_13_SOILS}, not taken from the load file.
 *
 * The poses are read from frozen copies of the wash descriptions the demonstration washes were
 * run from (`anchors/loads/<name>.wash.json`, written from the loader's settled loads), so that
 * the cached exposure of those washes is reused and a regenerated loader file does not move
 * the anchoring.
 *
 * Units: grams and hours as in a wash description; areas in cm2 in the comments.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createWashParams,
  soilData,
  soilTypeInfo,
  type ItemDescription,
  type ParamValue,
  type SoilDescription,
  type WashDescription,
} from '@spotless/sim-core';

/** Directory of the anchors (`packages/calibration/anchors`). */
export const ANCHORS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Name of the current anchored set (`anchors/<name>.json`, with its layers
 * `<name>.owner-capsule.json` and `<name>.owner-capsule.stable.json`). The seventh anchoring:
 * the sixth fitted again on the corrected machine (the upper basket as the owner's floor-level
 * photograph shows it, merged on 11 October 2026) and on the standard loads as the loader
 * settles them on it (`anchors/loads`, regenerated the same day), with what the owner's first
 * test wash fixed held in place (`OWNER_CALIBRATED` of `anchored.ts`), on the water side
 * `spotless-sim 0.5.0 water-7`, where that duty of the soak of Eco 50 is the registered
 * default (docs/calibration/anchoring-v7.md).
 *
 * Superseded sets stay beside it and are not to be washed with: each says so in its own file
 * (`supersededBy`, written by `scripts/supersede.ts`), which makes every wash refuse it
 * unless stale sets are accepted knowingly, whatever code is on disk. {@link
 * SUPERSEDED_ANCHORED} lists them with the reason. Earlier sets are kept under
 * `anchors/reports/v1` to `v3`.
 */
export const CURRENT_ANCHORED = 'anchored-v7';

/** The anchored sets that `CURRENT_ANCHORED` replaced and that are kept, with why each was replaced. */
export const SUPERSEDED_ANCHORED: Readonly<Record<string, string>> = {
  'anchored-v6':
    'fitted on the machine as it was drawn before the upper basket was corrected (11 October 2026) and on the standard loads settled on that basket; fitted again on the corrected machine as anchored-v7 (docs/calibration/anchoring-v7.md)',
  'anchored-v5':
    "the soak of Eco 50 at a duty of 0.5, which the owner's wash 01 contradicts (docs/calibration/owner-wash-01-calibration.md); replaced by anchored-v6 on 11 October 2026, and that by anchored-v7",
  'anchored-v4':
    "made on water-5 with the soak circulated throughout; the prediction of the owner's wash 01 was registered with it (docs/calibration/owner-wash-01-prediction.md); replaced by anchored-v5 on 10 October 2026",
};

/**
 * The exposure cache of the demonstration washes. The anchoring no longer reads it: it is
 * keyed by the version string only and has held exposure of water code that changed under one
 * string. See `water.ts` (`anchorCacheDir`).
 */
export const DEMO_CACHE_DIR = join(
  ANCHORS_DIR,
  '..',
  '..',
  'sim-verify',
  'demos',
  '.spotless',
  'exposure-cache',
);

/** One soil of the standard load as the dossiers' working quantities give it. */
export interface WorkingSoil {
  /** Soil id given to the wash: a catalogue soil. */
  readonly type: string;
  /** Wet amount applied, grams, as the dossier states it (documentation; the wash is given the dry mass). */
  readonly wet_g: number;
  /** Dry mass on the item, grams. */
  readonly dry_g: number;
  /** Region and the share of it the soil covers. */
  readonly region: string;
  readonly coverage: number;
  /** Hours from application to the start of the wash. */
  readonly age_h: number;
  readonly heat_history: NonNullable<SoilDescription['heat_history']>;
  /** Where the numbers come from. */
  readonly source: string;
}

/** Hours from soiling to the start of the programme: 2 h in the cabinet and about 40 min cooling (standards 3.1, 4.1). */
const IEC_AGE_H = 3;

/** Solids fraction of UHT milk with 1.5 % fat (protein 3.4, lactose 4.8, fat 1.5, ash 0.7 g per 100 g). */
const MILK_SOLIDS = 0.104;
/** Density of milk, g/mL. */
const MILK_DENSITY = 1.03;
/**
 * Share of the milk solids that stays as a film when the cooked deposit is wetted: the protein
 * (3.4 of 10.4 g) and the fat (1.5). The lactose and the minerals (5.5) dissolve as soon as
 * water reaches them (soils R4: sugars and milk films leave wherever a film flows); what has to
 * be digested is the denatured protein with its fat.
 */
const MILK_FILM_SHARE = 0.47;
/** Fat and solids of margarine (about 82 %; the solids fraction of `iec_margarine` in the soil data). */
const MARGARINE_SOLIDS = soilData('iec_margarine')?.solidsFraction ?? Number.NaN;
/** Solids fraction of minced frozen spinach (about 92 % water). */
const SPINACH_SOLIDS = 0.08;
/**
 * Dry tea film per area, g/m2: that of the IEC tea in the soil data (soils 8.1: "< 1 dry";
 * half the nominal 0.5 g/m2 of an IKW-level stain, against which `soil.tea.visibleMass` is set).
 */
const TEA_FILM_G_M2 = soilData('iec_tea')?.loading ?? Number.NaN;

/**
 * The working soils of STD-EU-13 by item type and the soil the level gives the item
 * (standards 13.3, 4.1, 4.4; soils 8.1). Region areas are those of the catalogue shapes as the
 * scene grids them (well of the dinner plate 266 cm2, of the dessert plate 152, of the soup
 * plate 246, of the melamine plate 182, of the saucer 50; interior of the glass 212, of the
 * mug 202, of the cup 120, of the dessert bowl 167; tines 18.2; spoon bowl 24.2; blade 38.9).
 */
export const STD_EU_13_SOILS: Readonly<Record<string, Readonly<Record<string, WorkingSoil>>>> = {
  dinner_plate_porcelain_iec: {
    iec_egg_yolk: {
      type: 'iec_egg_yolk',
      wet_g: 3,
      dry_g: 1.5,
      region: 'well',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 13.3: 3 g wet spread on the well, rim free, 10 to 12 mg/cm2 wet (3 g on the 266 cm2 well is 11.3); solids 0.50 (soils 8.1): 5.6 mg/cm2 dry, the IKW 5.4',
    },
    iec_minced_meat: {
      type: 'iec_minced_meat',
      wet_g: 3,
      dry_g: 0.63,
      region: 'well',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 13.3, 4.4: 3 g wet on the well (11.3 mg/cm2; IKW 11.8), solids 0.21: 2.4 mg/cm2 dry',
    },
  },
  dessert_plate_porcelain_190: {
    iec_egg_yolk: {
      type: 'iec_egg_yolk',
      wet_g: 2,
      dry_g: 1.0,
      region: 'well',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source: 'standards 13.3: 2 g wet on the 152 cm2 well (13 mg/cm2 wet, 6.6 dry)',
    },
    iec_spinach: {
      type: 'iec_spinach',
      wet_g: 2,
      dry_g: 2 * SPINACH_SOLIDS,
      region: 'well',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 13.3: 2 g wet; solids 0.08 (minced frozen spinach, about 92 % water): 1.05 mg/cm2 dry',
    },
  },
  melamine_dessert_plate_iec_195: {
    iec_spinach: {
      type: 'iec_spinach',
      wet_g: 2,
      dry_g: 2 * SPINACH_SOLIDS,
      region: 'well',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source: 'standards 13.3: 2 g wet on the 182 cm2 well; solids 0.08',
    },
    iec_minced_meat: {
      type: 'iec_minced_meat',
      wet_g: 2,
      dry_g: 0.42,
      region: 'well',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source: 'standards 13.3: 2 g wet on the 182 cm2 well; solids 0.21',
    },
  },
  soup_plate_porcelain_230: {
    iec_oat_flakes: {
      type: 'iec_oat_flakes',
      wet_g: 3,
      dry_g: 0.24,
      region: 'well',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 4.1 [VERIFIED]: 3 g of porridge, 10.6 mg/cm2, rim free (3 g on the 246 cm2 well is 12.2); solids 0.08 (standards 4.4): 0.98 mg/cm2 dry',
    },
  },
  dessert_bowl_vitrelle_130: {
    iec_oat_flakes: {
      type: 'iec_oat_flakes',
      wet_g: 2,
      dry_g: 0.16,
      region: 'interior',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source: 'standards 13.3: 2 g wet in the 167 cm2 interior (12 mg/cm2 wet); solids 0.08',
    },
    iec_spinach: {
      type: 'iec_spinach',
      wet_g: 2,
      dry_g: 2 * SPINACH_SOLIDS,
      region: 'interior',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source: 'standards 13.3: 2 g wet in the interior; solids 0.08',
    },
  },
  test_glass_borosilicate_250: {
    iec_milk: {
      type: 'iec_milk',
      wet_g: 10 * MILK_DENSITY,
      dry_g: 10 * MILK_DENSITY * MILK_SOLIDS * MILK_FILM_SHARE,
      region: 'interior',
      coverage: 0.25,
      age_h: IEC_AGE_H,
      heat_history: 'cooked',
      source:
        'standards 4.1, 13.3: 10 mL of UHT milk with 1.5 % fat cooked dry in the microwave oven (about 100 C; the simulation category "cooked"), then 2 h at 80 C; solids 0.104: 1.07 g dry, of which the protein and the fat (47 %, 0.50 g) stay as a film when it is wetted, on the base (28 cm2) and the lower wall the boiling milk reaches, taken as a quarter of the 212 cm2 interior: 9.5 mg/cm2 of film (soils 8.1: 100 to 300 g/m2 for all the solids)',
    },
  },
  tea_cup_porcelain_210: {
    iec_tea: {
      type: 'iec_tea',
      wet_g: 100,
      dry_g: (TEA_FILM_G_M2 * 0.6 * 120) / 1e4,
      region: 'interior',
      coverage: 0.6,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 13.3: cup half-filled with tea, 1 h at 80 C, emptied; what stays is a film of under 1 g/m2 (soils 8.1), taken as half the nominal 0.5 g/m2 of an IKW-level stain on the 60 % of the 120 cm2 interior the tea wetted: 1.8 mg',
    },
  },
  mug_ceramic_300: {
    iec_tea: {
      type: 'iec_tea',
      wet_g: 100,
      dry_g: (TEA_FILM_G_M2 * 0.6 * 202) / 1e4,
      region: 'interior',
      coverage: 0.6,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source: 'as the cup: 0.25 g/m2 on 60 % of the 202 cm2 interior: 3.0 mg',
    },
  },
  saucer_porcelain_140: {
    iec_tea: {
      type: 'iec_tea',
      wet_g: 5,
      dry_g: (TEA_FILM_G_M2 * 0.6 * 50) / 1e4,
      region: 'well',
      coverage: 0.6,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 13.3: 5 mL of tea on the saucer; 0.25 g/m2 on 60 % of the 50 cm2 well: 0.75 mg',
    },
  },
  dinner_fork_185: {
    iec_egg_yolk: {
      type: 'iec_egg_yolk',
      wet_g: 0.3,
      dry_g: 0.15,
      region: 'tines',
      coverage: 1,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 13.3: 0.3 g wet per soiled piece, about 20 cm2 at 15 mg/cm2 (the tines are 18.2 cm2: 16.5 wet, 8.2 dry)',
    },
  },
  soup_spoon_190: {
    iec_oat_flakes: {
      type: 'iec_oat_flakes',
      wet_g: 0.3,
      dry_g: 0.024,
      region: 'bowl',
      coverage: 0.8,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source: 'standards 13.3: 0.3 g wet on about 20 cm2 (80 % of the 24.2 cm2 bowl); solids 0.08',
    },
  },
  oval_platter_porcelain_320: {
    iec_margarine: {
      type: 'iec_margarine',
      wet_g: 5,
      dry_g: 5 * MARGARINE_SOLIDS,
      region: 'well',
      coverage: 0.6,
      age_h: 0,
      heat_history: 'none',
      source:
        'standards 13.3: 5 g of margarine on the platter, fresh; spread over 60 % of its well (the share the level states: at the working loading of 154 g/m2, 5 g cover 325 cm2); fat and solids 0.82',
    },
  },
  saucepan_steel_170: {
    iec_minced_meat: {
      type: 'iec_minced_meat',
      wet_g: 5,
      dry_g: 5 * 0.21,
      region: 'interior_base',
      coverage: 0.6,
      age_h: IEC_AGE_H,
      heat_history: 'warm',
      source:
        'standards 4.4: minced meat goes on the pots in Ed. 4; the grams per item were not readable, so the amount and the covered share are those the level states (5 g on 60 % of the inner base); solids 0.21. The pots are not in the literature record',
    },
  },
  dinner_knife_210: {
    iec_margarine: {
      type: 'iec_margarine',
      wet_g: 0.3,
      dry_g: 0.3 * MARGARINE_SOLIDS,
      region: 'blade',
      coverage: 0.5,
      age_h: 0,
      heat_history: 'none',
      source:
        'standards 13.3: 0.3 g on about 20 cm2 (half of the 38.9 cm2 blade), fresh; that knives carry margarine is [RECALLED]',
    },
  },
};

/** What {@link stdEu13Description} is asked for. */
export interface ScenarioOptions {
  /** `anchors/loads/<load>.wash.json`; default `iec-13-careful`. */
  readonly load?: string;
  /** Programme id of the machine; default `eco_50`. */
  readonly programme?: string;
  readonly tier?: 'official' | 'fast';
  readonly levelSeed?: number;
  readonly simSeed?: number;
  readonly params?: Readonly<Record<string, ParamValue>>;
  /** False to keep the soils of the load file as they are (the first build's demonstration). */
  readonly workingSoils?: boolean;
  /**
   * How much of the microwaved milk has to be digested (see {@link MILK_CASES}): `film`, the
   * protein and the fat (0.50 g per glass; the default), or `full`, all of its solids (1.07 g).
   */
  readonly milk?: MilkCase;
}

/** The two readings of the milk soil. */
export type MilkCase = 'film' | 'full';

/**
 * Share of the 1.07 g of milk solids per glass that the wash is given as a film to digest.
 * Standards 13.3 states the solids; that the lactose and the minerals (53 %) dissolve at once
 * and only the protein with its fat (47 %) has to be digested is this anchoring's assumption
 * (soils R4), not a dossier value, and it decides the film loading by a factor of 2.1. Both
 * are reported; nothing published tells them apart.
 */
export const MILK_CASES: Readonly<Record<MilkCase, number>> = { film: 0.47, full: 1 };

/** Reads a frozen wash description of `anchors/loads`. */
export function readLoad(name: string): WashDescription {
  return JSON.parse(
    readFileSync(join(ANCHORS_DIR, 'loads', `${name}.wash.json`), 'utf8'),
  ) as WashDescription;
}

/**
 * The soil description that puts `dry_g` of a working soil on an item: the wash takes the
 * stated amount and multiplies it by the solids fraction it holds for the soil (that of the
 * soil data of `@spotless/sim-soil` by soil id; for an id it does not know the catalogue's, or
 * the default of the model class), so the amount given is the dry mass over that fraction.
 */
export function workingSoilDescription(
  soil: WorkingSoil,
  params: Readonly<Record<string, ParamValue>> = {},
): SoilDescription {
  const info = soilTypeInfo(soil.type);
  const solids =
    soilData(soil.type)?.solidsFraction ??
    info.solidsFraction ??
    createWashParams(params).soilClass(info.modelClass, 'solidsFraction');
  return {
    type: soil.type,
    regions: [{ region: soil.region, coverage: soil.coverage }],
    amount_g: soil.dry_g / solids,
    age_h: soil.age_h,
    heat_history: soil.heat_history,
  };
}

/** The soils of an item of the standard load with the working quantities in place of the file's. */
export function withWorkingSoils(
  item: ItemDescription,
  params: Readonly<Record<string, ParamValue>> = {},
  milk: MilkCase = 'film',
): ItemDescription {
  const table = STD_EU_13_SOILS[item.type];
  const soils = (item.soils ?? []).map((soil) => {
    const working = table?.[soil.type];
    if (working === undefined) {
      throw new RangeError(
        `withWorkingSoils: no working quantity for ${soil.type} on ${item.type} (${item.id})`,
      );
    }
    const description = workingSoilDescription(working, params);
    return soil.type === 'iec_milk'
      ? {
          ...description,
          amount_g: (description.amount_g * MILK_CASES[milk]) / MILK_CASES.film,
        }
      : description;
  });
  return { ...item, soils };
}

/** The wash description of STD-EU-13 (or of another settled load of the same items). */
export function stdEu13Description(options: ScenarioOptions = {}): WashDescription {
  const load = readLoad(options.load ?? 'iec-13-careful');
  const params = options.params ?? {};
  return {
    ...load,
    programme: options.programme ?? 'eco_50',
    tier: options.tier ?? 'official',
    levelSeed: options.levelSeed ?? load.levelSeed ?? 60436,
    simSeed: options.simSeed ?? load.simSeed ?? 1,
    ...(Object.keys(params).length > 0 ? { params } : {}),
    items:
      options.workingSoils === false
        ? load.items
        : load.items.map((item) => withWorkingSoils(item, params, options.milk ?? 'film')),
  };
}
