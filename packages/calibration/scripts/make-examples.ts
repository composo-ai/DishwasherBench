/**
 * Writes the example wash records of `examples/` (docs/calibration/wash-record.md section 9).
 *
 *   pnpm --filter @spotless/calibration exec tsx scripts/make-examples.ts
 *
 * The planned and literature records are written from the definitions below. The template of
 * a measured record gets its course from the machine model and its values from the simulator
 * (it is a synthetic record: its numbers are placeholders, not measurements).
 */

import { join } from 'node:path';
import { expandProgramme, PRIMARY_MACHINE, primaryProgramme } from '@spotless/machine';
import {
  courseOfTimeline,
  createCalibrationParams,
  parseWashRecord,
  synthesiseRecord,
  tileRecord,
  WASH_RECORD_FORMAT,
  WASH_RECORD_VERSION,
  type RecordItem,
  type RecordObservation,
  type TileSpec,
  type WashRecord,
} from '../src/index.ts';
import { writeJsonFile } from '../src/node/index.ts';
import { TEN_PLACES } from './study-loads.ts';

const out = join(import.meta.dirname, '..', 'examples');

// ---- 1. the planned tile record
const tiles: TileSpec[] = TEN_PLACES.map(([x, y, facing, rack], i) => ({
  id: `tile_${String(i + 1).padStart(2, '0')}`,
  rack,
  x_mm: x,
  y_mm: y,
  facing,
  soil: 'iec_egg_yolk',
  // The IEC loading of about 107 g/m2 on a 50 mm disc.
  amount_g: 0.21,
  disc_mm: 50,
  drying_h: 2,
  heat: { history: 'warm', temperature_c: 80, time_min: 120 },
}));
const planned: WashRecord = {
  ...tileRecord({
    id: 'egg-tiles-interrupted',
    title: 'Ten egg-yolk tiles, three door openings in the main wash',
    tiles,
    kinds: ['area_fraction', 'mass_fraction'],
    at_s: [1500, 2400, 3600],
    interruptedKinds: ['area_fraction'],
  }),
};
writeJsonFile(
  join(out, 'egg-tiles-interrupted.planned.json'),
  parseWashRecord(JSON.parse(JSON.stringify(planned))),
);

// ---- 2. the literature record
const literature: WashRecord = {
  format: WASH_RECORD_FORMAT,
  version: WASH_RECORD_VERSION,
  id: 'perez-mohedano-egg-yolk-tile-55c',
  kind: 'literature',
  title:
    'Egg-yolk tile watched by a camera in a domestic dishwasher (55 C, pH 10.5, protease 0.06 g/L)',
  provenance: {
    date: '2015-01-01',
    source:
      'R. Perez-Mohedano, PhD thesis, University of Birmingham, chapter 7, Tables 7.1 to 7.3 (docs/research/soils.md section 6.1)',
    methods: {
      sri: {
        description:
          'stain removal index from the CIELAB b* of a CFT DM-22 egg-yolk tile, imaged on line through the main wash; triplicates',
      },
    },
    notes:
      'A weak observation. The original was a Whirlpool DU750 held at 55 C with a model detergent; here it is laid on ' +
      "the owner's Bosch with the main wash limited to 55 C, the tile standing in the lower basket facing the middle. " +
      'Times are counted from the release of the detergent (960 s into Auto 2:25). The removed share is read as ' +
      '(time - 5 min lag) x 1.75 %/min in the constant-rate stage, complete at about 65 min; the residual mass ' +
      'fraction is one minus that. The stated uncertainties cover the scatter of the triplicates (0.29 %/min) and ' +
      'the difference of machine, temperature course and detergent.',
  },
  machine: { id: 'bosch_smv4hax40g' },
  programme: { id: 'auto_145', course: { steps: [{ step: 'a4_heat', target_c: 55 }] } },
  consumables: {
    detergent: {
      product: 'model detergent with 0.06 g/L protease granulate at pH 10.5',
      form: 'powder',
      dose_g: 20,
    },
  },
  load: {
    items: [
      {
        id: 'tile',
        type: 'cft_dm22_melamine_tile',
        custom: { tile: { length_mm: 120, width_mm: 100, thickness_mm: 3, material: 'melamine' } },
        frame: 'lower_rack',
        position_mm: [200, 250, 54],
        // Standing on its long edge, the soiled face towards +x.
        quat_wxyz: [0.7071068, 0, 0.7071068, 0],
        soils: [
          {
            id: 'yolk',
            type: 'egg_yolk_dried',
            recipe: 'CFT DM-22: egg yolk on melamine, 1.75 g on 120 x 100 mm, aged',
            amount_g: 1.75,
            where: { regions: [{ region: 'top', coverage: 1 }] },
            drying: { time_h: 24, conditions: 'as supplied by the tile maker' },
            heat: { history: 'warm' },
          },
        ],
      },
    ],
  },
  observations: [
    {
      id: 'sri_20min',
      item: 'tile',
      target: { soil: 'yolk' },
      at_s: 2160,
      kind: 'mass_fraction',
      value: 0.74,
      sd: 0.15,
      method: 'sri',
    },
    {
      id: 'sri_40min',
      item: 'tile',
      target: { soil: 'yolk' },
      at_s: 3360,
      kind: 'mass_fraction',
      value: 0.39,
      sd: 0.18,
      method: 'sri',
    },
    {
      id: 'sri_62min',
      item: 'tile',
      target: { soil: 'yolk' },
      at_s: 4680,
      kind: 'mass_fraction',
      value: 0.05,
      sd: 0.2,
      method: 'sri',
    },
  ],
  weight: 0.25,
};
writeJsonFile(
  join(out, 'egg-yolk-tile.literature.json'),
  parseWashRecord(JSON.parse(JSON.stringify(literature))),
);

// ---- 3. the template of a measured record of a small mixed load
const spec = PRIMARY_MACHINE;
const nominal = primaryProgramme(spec);
// The course of a run in which Auto chose 58 C and a shorter hold.
const chosen = {
  ...nominal,
  steps: nominal.steps.map((step) =>
    step.id === 'a4_heat'
      ? { ...step, target: 58 }
      : step.id === 'a5_hold' && step.kind === 'hold'
        ? {
            ...step,
            target: 58,
            duration: 2100,
            prestoreFills: step.prestoreFills.map((f) => ({ ...f, at: 1200 })),
          }
        : step,
  ),
};
const course = courseOfTimeline(expandProgramme(spec, chosen, {}), {
  interval: 60,
  method: 'probe',
});
const regionSoil = (
  id: string,
  type: string,
  region: string,
  coverage: number,
  amount: number,
  history: 'none' | 'warm' | 'cooked' | 'baked' = 'none',
): RecordItem['soils'][number] => ({
  id,
  type,
  amount_g: amount,
  amount_method: 'scale',
  where: { regions: [{ region, coverage }] },
  drying: { time_h: 2, temperature_c: 22, conditions: 'open kitchen' },
  heat: { history },
});
const items: RecordItem[] = [
  {
    id: 'plate_facing',
    type: 'dessert_plate_porcelain_190',
    position_mm: [-120, -130, 172],
    quat_wxyz: [0.5736, 0.8192, 0, 0],
    soils: [
      regionSoil('sauce', 'tomato_sauce', 'well', 0.6, 2, 'cooked'),
      regionSoil('egg', 'egg_yolk_dried', 'rim', 0.3, 0.5),
    ],
  },
  {
    id: 'plate_away',
    type: 'dessert_plate_porcelain_190',
    position_mm: [120, -130, 172],
    quat_wxyz: [0.8192, 0.5736, 0, 0],
    soils: [
      regionSoil('sauce', 'tomato_sauce', 'well', 0.6, 2, 'cooked'),
      regionSoil('egg', 'egg_yolk_dried', 'rim', 0.3, 0.5),
    ],
  },
  {
    id: 'mug_inverted',
    type: 'mug_porcelain_240',
    position_mm: [-100, 60, 425],
    quat_wxyz: [0, 1, 0, 0],
    soils: [regionSoil('tea', 'tea_tannin', 'interior', 1, 0.6)],
  },
  {
    id: 'mug_upright',
    type: 'mug_porcelain_240',
    position_mm: [100, 60, 425],
    quat_wxyz: [1, 0, 0, 0],
    soils: [regionSoil('tea', 'tea_tannin', 'interior', 1, 0.6)],
  },
];
const observations: RecordObservation[] = [
  { item: 'plate_facing', kind: 'score', method: 'eye' },
  {
    item: 'plate_facing',
    target: { soil: 'sauce' },
    kind: 'area_fraction',
    method: 'photo',
    sd: 0.05,
  },
  {
    item: 'plate_facing',
    target: { region: 'rim' },
    kind: 'residual_mass',
    method: 'scale',
    sd: 5,
  },
  { item: 'plate_away', kind: 'score', method: 'eye' },
  {
    item: 'plate_away',
    target: { soil: 'sauce' },
    kind: 'area_fraction',
    method: 'photo',
    sd: 0.05,
  },
  { item: 'plate_away', kind: 'mass_fraction', method: 'scale', sd: 0.03 },
  { item: 'mug_inverted', kind: 'clean', method: 'eye' },
  { item: 'mug_inverted', kind: 'specks', method: 'eye' },
  { item: 'mug_upright', kind: 'clean', method: 'eye' },
  { item: 'mug_upright', kind: 'retained_water', method: 'scale', sd: 2 },
];
const template: WashRecord = {
  format: WASH_RECORD_FORMAT,
  version: WASH_RECORD_VERSION,
  id: 'plates-mugs-template',
  kind: 'planned',
  title: 'Template of a measured record: a small mixed load with a measured course',
  provenance: {
    date: '2026-10-10',
    by: 'the simulator',
    methods: {
      scale: {
        description:
          'kitchen balance, 0.01 g; items weighed dry before soiling, after drying and after the wash',
      },
      photo: {
        description:
          'photograph under diffuse light before and after; soiled pixels over those of the soil as applied',
      },
      eye: { description: 'visual inspection, 10 s per item under 1000 to 1500 lux' },
      probe: {
        description:
          'thermocouple in the sump, 1 reading per minute; smart plug, 1 reading per minute',
      },
    },
    notes:
      'A template. Replace the load, the course and the values with your own and set kind to "measured".',
  },
  machine: {
    id: spec.id,
    basket_heights: { upper: '1' },
    measured: [
      {
        quantity: 'spec',
        path: 'thermal.inletTemperature',
        value: 13.5,
        method: 'probe',
        note: 'cold tap after running for a minute',
      },
    ],
  },
  programme: { id: nominal.id, options: [], course },
  consumables: {
    detergent: {
      product: 'generic all-in-one tablet',
      form: 'tablet',
      dose_g: 18.5,
      method: 'scale',
      placement: 'dispenser',
    },
    rinse_aid: { setting: 'r05', dose_ml: 5 },
    softener: { setting: 'H04', salt_filled: true },
    water: { hardness_dh: 14, ambient_temperature_c: 21, method: 'probe' },
  },
  load: { items },
  observations,
  sim: { tier: 'fast', level_seed: 7, sim_seed: 3 },
};
const filled = await synthesiseRecord(
  parseWashRecord(JSON.parse(JSON.stringify(template))),
  // A template to be overwritten with real values: no gross errors among the drawn ones.
  createCalibrationParams({ 'obs.outlierShare': 0 }),
  {
    seed: 20261010,
    id: 'plates-mugs-template',
  },
);
writeJsonFile(
  join(out, 'plates-mugs-pan.measured-template.json'),
  parseWashRecord(JSON.parse(JSON.stringify(filled))),
);
console.log(`examples written to ${out}`);
