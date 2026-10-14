/**
 * The published result the standard load is anchored to, as a literature wash record
 * (docs/calibration/wash-record.md): the European round robin of 2022/2023 on EN 60436:2020
 * (docs/research/standards.md section 7.1), test appliance Bosch SMV6ECX51E on its eco
 * programme, with what had to be assumed to lay it on the owner's machine.
 *
 * A wash record holds observations of single items. The round robin publishes class means, not
 * item scores, so the record carries them in a field of its own, `aggregates`, which the
 * calibration tool ignores (wash-record.md section 1: a field the specification does not name
 * is kept) and the anchoring fit reads (`objective.ts`). `observations` is empty.
 *
 * Units: as a wash record (millimetres, grams, hours, degrees Celsius).
 */

import type { ItemDescription, WashDescription } from '@spotless/sim-core';
import type { RecordItem, RecordSoil, WashRecord } from '../../src/index.ts';
import { stdEu13Description, STD_EU_13_SOILS, type WorkingSoil } from './scenario.ts';
import type { ItemClass } from './summary.ts';

/** A published class mean with the uncertainty it is given in the fit. */
export interface ClassMeanAggregate {
  readonly id: string;
  readonly kind: 'class_mean_score';
  /** Class of the round robin, or `all` for every item but the pots. */
  readonly class: ItemClass | 'all';
  /** Published mean IEC score, and the standard deviation over runs and laboratories. */
  readonly value: number;
  readonly published_sd: number;
  /** Items of the class in the standard load of 13 place settings, and in this record. */
  readonly items_standard: number;
  readonly items_record: number;
  /** Standard uncertainty of the comparison with one simulated wash of this record. */
  readonly sd: number;
  /** What `sd` is made of, in words. */
  readonly sd_basis: string;
  readonly method: string;
  /** False for a value that is reported and not fitted. */
  readonly fitted: boolean;
}

/** The ranking of the classes that every machine and both detergents of the round robin show. */
export interface RankingAggregate {
  readonly id: string;
  readonly kind: 'class_ranking';
  /** Classes from best to worst; classes in one inner list are not ranked against each other. */
  readonly order: readonly (readonly ItemClass[])[];
  /** Score difference by which a violated order counts as one standard deviation. */
  readonly sd: number;
  readonly method: string;
}

/** A literature record with the aggregates the anchoring fit reads. */
export type LiteratureRecord = WashRecord & {
  readonly aggregates: readonly (ClassMeanAggregate | RankingAggregate)[];
  /** Items of each type in the standard load of 13 place settings (standards 5.1), by catalogue type. */
  readonly standard_composition: Readonly<Record<string, number>>;
};

/**
 * Items per catalogue type in the standard load of 13 place settings (standards 5.1: seven
 * settings of type A, six of type B, ten serving pieces).
 */
export const STANDARD_COMPOSITION: Readonly<Record<string, number>> = {
  dinner_plate_porcelain_iec: 7,
  dessert_plate_porcelain_190: 7,
  mug_ceramic_300: 7,
  dessert_bowl_vitrelle_130: 7,
  soup_plate_porcelain_230: 6,
  tea_cup_porcelain_210: 6,
  saucer_porcelain_140: 6,
  melamine_dessert_plate_iec_195: 6,
  test_glass_borosilicate_250: 13,
  dinner_knife_210: 13,
  dinner_fork_185: 13,
  soup_spoon_190: 13,
  dessert_spoon_160: 13,
  teaspoon_130: 13,
  serving_spoon_216: 2,
  serving_fork_210: 1,
  ladle_steel_311: 1,
  oval_platter_porcelain_320: 1,
  glass_bowl_180: 1,
  melamine_bowl_iec_213: 2,
  saucepan_steel_170: 1,
  saucepan_clad_2qt: 1,
};

/** Machine and reconstruction part of every class uncertainty, score points (see `sdOf`). */
const SD_MACHINE = 0.3;
const SD_LOAD = 0.3;

/**
 * Standard uncertainty of a published class mean against one simulated wash of the record: the
 * published spread over runs and laboratories, the difference between that Bosch on its eco
 * programme and the owner's (another model, 270 min at 54 C against 295 min at 50 C nominal;
 * detergents D and E differ by 0.1 to 0.5 per class), and the reconstruction of the load and
 * its quantities (97 of 140 items, working quantities), each taken as 0.3; with few items of a
 * class in the record, the binomial scatter of their scores on top.
 */
/**
 * Uncertainty that the tea items add to the crockery mean: 19 of its 40 items carry tea, the
 * fit sets them to the middle of the scale, and their true mean is anywhere from 0 to 5 (a
 * uniform distribution: 5 / sqrt(12) = 1.44), so 19 / 40 x 1.44 = 0.69 on the class mean.
 */
/**
 * The allowance the second anchoring made for the tea items, which its fit did not read (their
 * score anywhere on the scale). The third anchoring reads tea, so no class carries it.
 */
export const SD_TEA_UNREAD = (19 / 40) * (5 / Math.sqrt(12));

function sdOf(publishedSd: number, itemsRecord: number, extra = 0): number {
  const few = itemsRecord > 0 ? 1.5 / Math.sqrt(itemsRecord) : 0;
  return Math.sqrt(
    publishedSd * publishedSd +
      SD_MACHINE * SD_MACHINE +
      SD_LOAD * SD_LOAD +
      few * few +
      extra * extra,
  );
}

const SD_BASIS =
  'published standard deviation over runs and laboratories; 0.3 for the other Bosch model and its eco programme (270 min at 54 C against 295 min at 50 C nominal) and detergent; 0.3 for the reconstructed load and quantities (97 of 140 items); 1.5 / sqrt(items in the record) for the scatter of few items; in quadrature';

function soilOfRecord(soil: WorkingSoil, amount_g: number): RecordSoil {
  return {
    type: soil.type,
    recipe: soil.source,
    preparation: `standard quantity ${soil.wet_g.toFixed(2)} g wet, ${(soil.dry_g * 1000).toFixed(1)} mg dry. amount_g is the dry mass over the solids fraction the simulation holds for this soil (the catalogue's, or the default of its model class where the catalogue gives none), so that the dry mass on the item is right`,
    amount_g,
    where: { regions: [{ region: soil.region, coverage: soil.coverage }] },
    drying: {
      time_h: soil.age_h,
      conditions:
        soil.heat_history === 'none'
          ? 'applied fresh, loaded last'
          : '2 h in the thermal cabinet at 80 C, about 40 min cooling',
    },
    heat: { history: soil.heat_history },
  };
}

function itemOfRecord(item: ItemDescription): RecordItem {
  const table = STD_EU_13_SOILS[item.type] ?? {};
  return {
    id: item.id,
    type: item.type,
    frame: 'tub',
    position_mm: item.position_mm,
    quat_wxyz: item.quat_wxyz ?? [1, 0, 0, 0],
    soils: (item.soils ?? []).map((soil) => {
      const working = table[soil.type];
      if (working === undefined) throw new RangeError(`no working quantity for ${soil.type}`);
      return soilOfRecord(working, soil.amount_g);
    }),
  };
}

/** Published class means of the test appliance (standards 7.1), by detergent. */
export const ROUND_ROBIN_TA: Readonly<
  Record<'D' | 'E', Readonly<Record<ItemClass | 'all', readonly [mean: number, sd: number]>>>
> = {
  D: {
    crockery: [3.68, 0.98],
    cutlery: [4.67, 0.21],
    glass: [3.43, 0.73],
    melamine: [4.21, 0.66],
    pots: [3.62, 0.88],
    all: [4.14, 0.427],
  },
  E: {
    crockery: [3.22, 0.7],
    cutlery: [4.75, 0.19],
    glass: [3.96, 0.63],
    melamine: [4.32, 0.52],
    pots: [4.03, 0.63],
    all: [4.152, 0.272],
  },
};

/**
 * The literature record of STD-EU-13 for the round robin's test appliance with detergent D
 * (the reference detergent the liquor model is written for), on the settled careful load.
 */
export function stdEu13LiteratureRecord(): LiteratureRecord {
  const description: WashDescription = stdEu13Description({
    load: 'iec-13-careful',
    programme: 'eco_50',
    tier: 'official',
  });
  const items = description.items.map(itemOfRecord);
  const classOf = (type: string): ItemClass | undefined => {
    if (/^melamine_/.test(type)) return 'melamine';
    if (/^saucepan_/.test(type)) return 'pots';
    if (/^(test_glass|dessert_bowl_vitrelle|glass_bowl)/.test(type)) return 'glass';
    if (/(fork|knife|spoon|ladle)/.test(type)) return 'cutlery';
    if (/(plate|platter|mug|cup|saucer)/.test(type)) return 'crockery';
    return undefined;
  };
  const inRecord = (cls: ItemClass): number =>
    items.filter((item) => classOf(item.type) === cls).length;
  const inStandard = (cls: ItemClass): number =>
    Object.entries(STANDARD_COMPOSITION)
      .filter(([type]) => classOf(type) === cls)
      .reduce((sum, [, n]) => sum + n, 0);
  const published = ROUND_ROBIN_TA.D;
  const classes: ItemClass[] = ['crockery', 'cutlery', 'glass', 'melamine'];
  const aggregates: (ClassMeanAggregate | RankingAggregate)[] = classes.map((cls) => ({
    id: `${cls}.mean_score`,
    kind: 'class_mean_score',
    class: cls,
    value: published[cls][0],
    published_sd: published[cls][1],
    items_standard: inStandard(cls),
    items_record: inRecord(cls),
    sd: Number(sdOf(published[cls][1], inRecord(cls)).toFixed(2)),
    sd_basis:
      cls === 'crockery'
        ? `${SD_BASIS}; and 0.69 for the tea items (19 of 40), which the fit does not read: they are set to the middle of the scale and their true mean is anywhere from 0 to 5`
        : SD_BASIS,
    method: 'round_robin',
    // Melamine is reported and not fitted: the record holds two plates of it, and what real
    // melamine loses its points to (redeposited specks) is out of scope.
    fitted: cls !== 'melamine',
  }));
  // Every item but the pots, which the record does not hold: (4.14 x 146 - 3.62 x 8) / 138.
  const withoutPots = (published.all[0] * 146 - published.pots[0] * 8) / 138;
  aggregates.push({
    id: 'all.mean_score',
    kind: 'class_mean_score',
    class: 'all',
    value: Number(withoutPots.toFixed(3)),
    published_sd: published.all[1],
    items_standard: 138,
    items_record: items.length,
    sd: Number(sdOf(published.all[1], items.length).toFixed(2)),
    sd_basis: `${SD_BASIS}. The published 4.140 over 146 assessments less the pots (3.62 over 8), which the record does not hold`,
    method: 'round_robin',
    fitted: false,
  });
  aggregates.push({
    id: 'ranking',
    kind: 'class_ranking',
    // Published: cutlery above melamine above crockery and glass. Melamine is left out of the
    // fitted order for the reason above.
    order: [['cutlery'], ['crockery', 'glass']],
    sd: 0.3,
    method: 'round_robin',
  });
  return {
    format: 'spotless.wash-record',
    version: 1,
    id: 'std-eu-13.round-robin-ta.detergent-d',
    kind: 'literature',
    title:
      'STD-EU-13: the standard European load on a Bosch eco programme, round robin 2022/2023, class means',
    provenance: {
      date: '2023-01-01',
      source:
        'Round robin test 2022/2023 on EN 60436:2020 in 17 laboratories, final report, Tables 36 to 45 (docs/research/standards.md section 7.1, source S11): test appliance Bosch SMV6ECX51E, eco programme, detergent D, 37 runs',
      methods: {
        round_robin: {
          description:
            'mean IEC cleaning score of the items of a class in one run (0 to 5), averaged over runs and laboratories; the standard deviation is over runs and laboratories',
        },
      },
      notes: `A weak observation: provisional anchoring to another machine. The round robin washed 140 items in a Bosch SMV6ECX51E (eco: 270 min, main wash 53.8 to 54.3 C measured, final rinse 47.4 to 47.9 C, 9.5 L). Here the settled careful IEC load of packages/loader/loads/ (${items.length} of the 140 items: ${description.items.filter((item) => /^test_glass/.test(item.type)).length} of 13 glasses, ${description.items.filter((item) => (item.soils ?? []).some((soil) => soil.type === 'iec_tea')).length} of 19 tea items; whatever the loading policy did not place is missing) stands in the owner's SMV4HAX40G on its Eco 50 with the main wash limited to 54 C and the final rinse to 48 C. Soil quantities, covered areas and ageing are the working quantities of standards 13.3 (anchors/src/scenario.ts), not measured ones. The published values are class means; there are no item scores, so \`observations\` is empty and the class means are in \`aggregates\`, which the anchoring fit reads. Class means are compared after weighting the item types to the standard composition (\`standard_composition\`).`,
    },
    machine: {
      id: description.machine ?? 'bosch_smv4hax40g',
      ...(description.basketHeights === undefined
        ? {}
        : { basket_heights: description.basketHeights }),
    },
    programme: {
      id: 'eco_50',
      course: {
        steps: [
          { step: 'e4_heat', target_c: 54 },
          { step: 'e10_heat', target_c: 48 },
        ],
        notes:
          "targets of the test appliance as measured in the round robin (standards 3.2); step lengths are those of the owner's Eco 50",
      },
    },
    consumables: {
      detergent: {
        product: 'IEC 60436 reference detergent type D',
        form: 'powder',
        dose_g: 20,
        placement: 'dispenser',
      },
    },
    load: { items },
    observations: [],
    weight: 0.25,
    sim: {
      tier: 'official',
      level_seed: description.levelSeed ?? 60436,
      sim_seed: description.simSeed ?? 1,
    },
    aggregates,
    standard_composition: STANDARD_COMPOSITION,
  };
}
