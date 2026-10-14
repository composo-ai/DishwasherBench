/**
 * Candidate next test washes of the owner as planned records, for the experiment ranking
 * (`spotless-fit rank`; docs/calibration/owner-wash-01-calibration.md, "The next washes").
 *
 *   cd packages/calibration
 *   pnpm exec tsx scripts/make-owner-candidates.ts
 *
 * Every candidate needs only supermarket soils and what the owner has shown he will do: plates,
 * bowls, cups and glasses in chosen places, drying on the counter or in the oven, a photograph
 * of every piece before and after. Each is the test pieces alone in his machine with his
 * capsule (12.9 g), at the fast tier (a ranking compares information, and a candidate costs an
 * exposure). Poses are taken from loads the loading physics has settled: his four yolk plates
 * from the record of wash 01, cups and glasses from the careful standard load, the nested and
 * the separate bowls from the phenomena suite.
 *
 * The observation plan of every piece is what a photograph gives: the visibly soiled area with
 * the uncertainty of the reading of wash 01 (a deviation of 0.4 in the logarithm), and, for a
 * stain or a film, the share of the soiled area still soiled.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateWashRecord,
  type RecordItem,
  type RecordObservation,
  type RecordSoil,
  type WashRecord,
} from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ownerDir = join(here, '..', 'records', 'owner');
const outDir = join(ownerDir, 'candidates');
mkdirSync(outDir, { recursive: true });

const wash01 = JSON.parse(
  readFileSync(join(ownerDir, 'owner-wash-01-egg-yolk-eco50.planned.json'), 'utf8'),
) as WashRecord;
interface DescribedItem {
  id: string;
  type: string;
  position_mm: [number, number, number];
  quat_wxyz: [number, number, number, number];
}
const standard = JSON.parse(
  readFileSync(join(here, '..', 'anchors', 'loads', 'iec-13-careful.wash.json'), 'utf8'),
) as { items: DescribedItem[] };
interface SuiteLoad {
  items: { item_id: string; item_type: string; pose: { p: number[]; q: number[] } }[];
}
const suite = (name: string): SuiteLoad =>
  JSON.parse(
    readFileSync(
      join(here, '..', '..', 'sim-verify', 'phenomena', 'loads', `${name}.json`),
      'utf8',
    ),
  ) as SuiteLoad;

/** Standard uncertainty of ln(area + floor) of a photograph read as wash 01 was. */
const PHOTO_LOG_SD = 0.4;
/** Standard uncertainty of an area fraction read off a photograph. */
const PHOTO_FRACTION_SD = 0.1;
/** Layout seeds of the scenarios of a soil spread by hand: where its thick places lie is not known. */
const LAYOUTS = [20261101, 20261102, 20261103];

const yolk = (
  amount_g: number,
  heat: 'oven' | 'air',
  weighed: boolean,
): RecordSoil & { amount_method: string } => ({
  id: 'soil_1',
  type: 'egg_yolk_dried',
  recipe: 'raw egg yolk, no white',
  preparation: 'spread with a fork over about two thirds of the well, rim clean',
  amount_g,
  amount_method: weighed ? 'scale' : 'asked',
  amount_sd_g: weighed ? 0.05 : amount_g / 3,
  where: { regions: [{ region: 'well', coverage: 0.67 }] },
  drying: heat === 'oven' ? { time_h: 0.25 } : { time_h: 2.25 },
  heat:
    heat === 'oven' ? { history: 'warm', temperature_c: 80, time_min: 120 } : { history: 'none' },
});

/** The four plates of wash 01 where they stood, with yolk weighed on a kitchen scale. */
const yolkPlates = (): RecordItem[] =>
  wash01.load.items
    .filter((item) => item.id.startsWith('plate_91'))
    .map((item) => ({
      ...item,
      soils: [
        yolk(
          item.id === 'plate_9124' ? 1.5 : 3,
          item.soils[0]?.heat.history === 'warm' ? 'oven' : 'air',
          true,
        ),
      ],
      notes: `${item.id}: as in wash 01 (${item.soils[0]?.heat.history === 'warm' ? 'oven-dried 2 h at 80 C' : 'air-dried 2 h'}), the yolk weighed`,
    }));

const fromStandard = (ids: readonly string[], soil: RecordSoil): RecordItem[] =>
  ids.map((id) => {
    const item = standard.items.find((each) => each.id === id);
    if (item === undefined) throw new Error(`the standard load has no ${id}`);
    return {
      id,
      type: item.type,
      frame: 'tub',
      position_mm: item.position_mm,
      quat_wxyz: item.quat_wxyz,
      soils: [soil],
    };
  });

const fromSuite = (
  load: SuiteLoad,
  rename: Readonly<Record<string, string>>,
  soil: RecordSoil,
): RecordItem[] =>
  load.items
    .filter((item) => rename[item.item_id] !== undefined)
    .map((item) => ({
      id: rename[item.item_id] as string,
      type: item.item_type,
      frame: 'tub',
      position_mm: item.pose.p.map((v) => 1000 * v) as [number, number, number],
      quat_wxyz: item.pose.q as [number, number, number, number],
      soils: [soil],
    }));

const areaOf = (item: string): RecordObservation => ({
  item,
  kind: 'visible_area',
  sd: PHOTO_LOG_SD,
  method: 'photo_area',
});
const fractionOf = (item: string): RecordObservation => ({
  item,
  kind: 'area_fraction',
  sd: PHOTO_FRACTION_SD,
  method: 'photo_area',
});

interface Candidate {
  readonly id: string;
  readonly title: string;
  readonly programme: string;
  readonly items: RecordItem[];
  readonly observations: RecordObservation[];
  readonly stalled?: Readonly<Record<string, number>>;
  readonly layouts?: boolean;
  readonly settles: string;
}

const tea: RecordSoil = {
  id: 'soil_1',
  type: 'tea_tannin',
  recipe: 'black tea, two bags per mug, left to stand for an hour and poured out',
  preparation: 'the mug half filled twice and emptied; left to dry overnight',
  amount_g: 0.003,
  amount_method: 'asked',
  amount_sd_g: 0.0015,
  where: { regions: [{ region: 'interior', coverage: 0.6 }] },
  drying: { time_h: 24 },
  heat: { history: 'none' },
} as RecordSoil;
const milk: RecordSoil = {
  id: 'soil_1',
  type: 'iec_milk',
  recipe: 'semi-skimmed milk, 10 mL per glass',
  preparation: 'heated in the glass in a microwave oven until dry (about 10 min at 450 W)',
  amount_g: 10,
  amount_method: 'scale',
  amount_sd_g: 0.5,
  where: { regions: [{ region: 'interior', coverage: 0.25 }] },
  drying: { time_h: 2 },
  heat: { history: 'baked' },
} as RecordSoil;
const porridge: RecordSoil = {
  id: 'soil_1',
  type: 'porridge',
  recipe: 'porridge oats cooked with water',
  preparation: 'a tablespoon spread over the inside of the bowl with the back of a spoon',
  amount_g: 5,
  amount_method: 'scale',
  amount_sd_g: 0.5,
  where: { regions: [{ region: 'interior', coverage: 0.5 }] },
  drying: { time_h: 12 },
  heat: { history: 'none' },
} as RecordSoil;

const plates = yolkPlates();
const plateAreas = plates.map((item) => areaOf(item.id));
const mugs = fromStandard(['mug_01', 'mug_02', 'mug_03', 'mug_04'], tea);
const glasses = fromStandard(['glass_01', 'glass_02', 'glass_03', 'glass_04'], milk);
const nested = fromSuite(
  suite('bowls-nested'),
  { bowl_over: 'bowl_over', bowl_under: 'bowl_under' },
  porridge,
);
// Of the pair that stands apart in the suite, the bowl that stands clear of the nested two.
const apart = fromSuite(suite('bowls-apart'), { bowl_over: 'bowl_apart' }, porridge);

const candidates: Candidate[] = [
  {
    id: 'egg-plates-weighed-eco50',
    title: 'The four yolk plates of wash 01 again on Eco 50, the yolk weighed on a kitchen scale',
    programme: 'eco_50',
    items: plates,
    observations: plateAreas,
    layouts: true,
    settles:
      'how much cleaning Eco 50 delivers (the soak) without the amount in the way; with it what two hours at 80 C cost and what turning a plate costs',
  },
  {
    id: 'egg-plates-arm-blocked-eco50',
    title:
      'The four weighed yolk plates on Eco 50 with the lower spray arm held still by a tall piece',
    programme: 'eco_50',
    items: plates,
    observations: plateAreas,
    stalled: { lower: 148 },
    layouts: true,
    settles: 'what a held lower arm costs plates in the rear rows',
  },
  {
    id: 'tea-mugs-eco50',
    title: 'Four mugs with a dried tea film in the upper basket, Eco 50',
    programme: 'eco_50',
    items: mugs,
    observations: mugs.map((item) => fractionOf(item.id)),
    settles:
      'the bleaching of a tea stain by the capsule, which the published class means bound from below only',
  },
  {
    id: 'milk-glasses-eco50',
    title: 'Four glasses with milk heated dry in the microwave oven, upper basket, Eco 50',
    programme: 'eco_50',
    items: glasses,
    observations: glasses.flatMap((item) => [areaOf(item.id), fractionOf(item.id)]),
    settles:
      'whether heated milk in glasses comes off on Eco 50 with the capsule, which turns on the soak and on a rate no measurement stands behind',
  },
  {
    id: 'porridge-bowls-nested-eco50',
    title: 'Two porridge bowls nested and one standing free in the upper basket, Eco 50',
    programme: 'eco_50',
    items: [...nested, ...apart],
    observations: [...nested, ...apart].map((item) => fractionOf(item.id)),
    settles:
      'whether a bowl covered by another stays dirty (the water in a narrow gap), which no parameter of the soil side decides',
  },
];

for (const candidate of candidates) {
  const record: WashRecord = {
    format: wash01.format,
    version: wash01.version,
    id: `candidate-${candidate.id}`,
    kind: 'planned',
    title: candidate.title,
    provenance: {
      date: '2026-10-11',
      by: 'the simulation side: a candidate test wash, not run',
      methods: {
        photo_area: {
          description:
            'photograph of the piece after the wash, read as those of wash 01 were (soiled pixels against their surroundings, scaled by a known diameter)',
        },
        scale: {
          description:
            'kitchen scale, 0.1 g, the piece weighed before and after the soil is put on',
        },
        asked: { description: 'not weighed: an amount asked for' },
      },
      notes: `Candidate for the experiment ranking. What it would settle: ${candidate.settles}.`,
    },
    machine: wash01.machine,
    programme: { id: candidate.programme, options: [] },
    ...(wash01.consumables === undefined ? {} : { consumables: wash01.consumables }),
    load: {
      dispenser_blocked: false,
      ...(candidate.stalled === undefined ? {} : { stalled_arms_deg: candidate.stalled }),
      items: candidate.items,
    },
    observations: candidate.observations,
    sim: {
      tier: 'fast',
      level_seed: 20261101,
      sim_seed: 1,
      ...(candidate.layouts === true
        ? { scenarios: LAYOUTS.map((level_seed) => ({ level_seed })) }
        : {}),
    },
  };
  const checked = validateWashRecord(JSON.parse(JSON.stringify(record)) as unknown);
  if (!checked.ok) {
    throw new Error(
      `${candidate.id}: ${checked.error.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
    );
  }
  const file = join(outDir, `${candidate.id}.planned.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 1)}\n`);
  console.log(
    `wrote ${file}: ${candidate.items.length} items, ${candidate.observations.length} observations`,
  );
}
