import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  customShapeOf,
  observationIdOf,
  observationSd,
  parseWashRecord,
  recordItemRegionIds,
  validateWashRecord,
  WASH_RECORD_FORMAT,
  WashRecordError,
  type WashRecord,
} from './record.ts';

/** A small valid measured record, as plain JSON. */
function baseRecord(): Record<string, unknown> {
  return {
    format: WASH_RECORD_FORMAT,
    version: 1,
    id: '2026-10-18-test',
    kind: 'measured',
    provenance: {
      date: '2026-10-18',
      by: 'the owner',
      methods: {
        scale: { description: 'balance, 0.01 g', sd: 5 },
        photo: { description: 'photograph' },
        eye: { description: 'visual inspection' },
        plug: { description: 'smart plug' },
      },
    },
    machine: {
      id: 'bosch_smv4hax40g',
      basket_heights: { upper: '1' },
      measured: [
        { quantity: 'nozzle_diameter', level: 'lower', nozzle: 'l1', value_mm: 2.2, method: 'eye' },
        { quantity: 'spec', path: 'thermal.inletTemperature', value: 12, method: 'eye' },
      ],
    },
    programme: {
      id: 'auto_145',
      course: {
        duration_s: 8700,
        temperature_log: {
          t_s: [0, 60, 120],
          values: [20, 21, 22],
          method: 'plug',
          where: 'liquor',
        },
        events: [{ kind: 'drain', t_s: 4700 }],
        steps: [{ step: 'a4_heat', target_c: 60 }],
      },
    },
    consumables: {
      detergent: { product: 'tablet X', form: 'tablet', dose_g: 18, method: 'scale' },
      rinse_aid: { setting: 'r05', dose_ml: 5 },
      water: { hardness_dh: 14, inlet_temperature_c: 12 },
    },
    load: {
      items: [
        {
          id: 'plate_01',
          type: 'dinner_plate_porcelain_270',
          frame: 'lower_rack',
          position_mm: [100, 300, 150],
          quat_wxyz: [0.7071, 0, 0.7071, 0],
          soils: [
            {
              id: 'egg',
              type: 'egg_yolk_dried',
              amount_g: 1.2,
              amount_method: 'scale',
              where: { regions: [{ region: 'well', coverage: 0.5 }] },
              drying: { time_h: 2 },
              heat: { history: 'none' },
            },
          ],
        },
        {
          id: 'tile_01',
          type: 'glazed_tile',
          custom: {
            tile: { length_mm: 100, width_mm: 100, thickness_mm: 6, material: 'porcelain_glazed' },
          },
          position_mm: [0, 0, 200],
          quat_wxyz: [1, 0, 0, 0],
          soils: [
            {
              type: 'starch',
              amount_g: 0.3,
              amount_method: 'scale',
              where: {
                patch: { region: 'top', shape: 'disc', centre_mm: [0, 0, 6], diameter_mm: 50 },
              },
              drying: { time_h: 4, temperature_c: 22 },
              heat: { history: 'warm', temperature_c: 80, time_min: 120 },
            },
          ],
        },
      ],
    },
    observations: [
      { item: 'plate_01', kind: 'score', value: 3, method: 'eye' },
      {
        item: 'plate_01',
        target: { soil: 'egg' },
        kind: 'area_fraction',
        value: 0.2,
        sd: 0.05,
        method: 'photo',
      },
      {
        item: 'plate_01',
        target: { region: 'well' },
        kind: 'residual_mass',
        value: 30,
        method: 'scale',
      },
      {
        item: 'tile_01',
        target: { soil: 'soil_1' },
        at_s: 1800,
        kind: 'mass_fraction',
        value: 0.6,
        sd: 0.05,
        method: 'scale',
      },
      { item: 'tile_01', kind: 'clean', value: false, method: 'eye' },
      { item: 'tile_01', kind: 'specks', value: 2, method: 'eye' },
      { item: 'plate_01', kind: 'retained_water', value: 0.5, sd: 0.5, method: 'scale' },
    ],
    interruptions: [{ t_s: 1800, open_s: 40 }],
    sim: { tier: 'fast', level_seed: 3, params: { 'liq.xProtease': 0.012 } },
  };
}

/** A deep copy of the base record with one change. */
function changed(change: (record: any) => void): unknown {
  const record = JSON.parse(JSON.stringify(baseRecord()));
  change(record);
  return record;
}

describe('validateWashRecord accepts', () => {
  it('a record with every section', () => {
    const result = validateWashRecord(baseRecord());
    expect(result.ok ? [] : result.error).toEqual([]);
  });

  it('the example records of the package', () => {
    const dir = join(import.meta.dirname, '..', 'examples');
    const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    const kinds = new Set<string>();
    for (const file of files) {
      const result = validateWashRecord(JSON.parse(readFileSync(join(dir, file), 'utf8')));
      expect(result.ok ? [] : result.error, file).toEqual([]);
      if (result.ok) kinds.add(result.value.kind);
    }
    expect([...kinds].sort()).toEqual(['literature', 'planned', 'synthetic']);
  });

  it('a planned record without values, and fields the format does not name', () => {
    const planned = changed((r) => {
      r.kind = 'planned';
      for (const o of r.observations) delete o.value;
      r.my_own_notes = { anything: true };
      r.load.items[0].shelf = 'left';
    });
    expect(validateWashRecord(planned).ok).toBe(true);
  });

  it('a literature record whose observations all state their uncertainty', () => {
    const literature = changed((r) => {
      r.kind = 'literature';
      r.provenance = {
        source: 'Author, Title, Table 3',
        methods: { table: { description: 'published table' } },
      };
      for (const item of r.load.items) for (const soil of item.soils) delete soil.amount_method;
      r.machine.measured = [];
      delete r.programme.course;
      delete r.consumables;
      r.observations = [
        { item: 'plate_01', kind: 'mass_fraction', value: 0.4, sd: 0.2, method: 'table' },
      ];
    });
    const result = validateWashRecord(literature);
    expect(result.ok ? [] : result.error).toEqual([]);
  });
});

describe('validateWashRecord rejects, with the path and a sentence', () => {
  const cases: [string, (record: any) => void, string, RegExp][] = [
    ['another format', (r) => (r.format = 'something'), 'format', /spotless\.wash-record/],
    ['another version', (r) => (r.version = 2), 'version', /reads version 1/],
    ['a malformed id', (r) => (r.id = 'has spaces'), 'id', /identifier/],
    [
      'an unknown kind',
      (r) => (r.kind = 'guess'),
      'kind',
      /measured, literature, synthetic, planned/,
    ],
    ['no provenance', (r) => delete r.provenance, 'provenance', /when, by whom and how/],
    [
      'a measured record without a date',
      (r) => delete r.provenance.date,
      'provenance.date',
      /date of the wash/,
    ],
    [
      'a date that is not one',
      (r) => (r.provenance.date = '18/10/2026'),
      'provenance.date',
      /ISO 8601/,
    ],
    [
      'a measured record without an author',
      (r) => delete r.provenance.by,
      'provenance.by',
      /who ran the wash/,
    ],
    [
      'a method without a description',
      (r) => (r.provenance.methods.scale = { sd: 1 }),
      'provenance.methods.scale',
      /description/,
    ],
    [
      'a method with a negative sd',
      (r) => (r.provenance.methods.scale.sd = -1),
      'provenance.methods.scale.sd',
      /positive/,
    ],
    [
      'an unknown machine',
      (r) => (r.machine.id = 'miele_g7000'),
      'machine.id',
      /unknown machine "miele_g7000"/,
    ],
    [
      'an unknown measured quantity',
      (r) => (r.machine.measured[0].quantity = 'colour'),
      'machine.measured[0].quantity',
      /spec, nozzle_diameter, arm_speed/,
    ],
    [
      'a measured value without a method',
      (r) => delete r.machine.measured[0].method,
      'machine.measured[0].method',
      /how the number was obtained/,
    ],
    [
      'a nozzle bore that is not positive',
      (r) => (r.machine.measured[0].value_mm = 0),
      'machine.measured[0].value_mm',
      /positive/,
    ],
    [
      'a specification override without a path',
      (r) => delete r.machine.measured[1].path,
      'machine.measured[1].path',
      /path of the field/,
    ],
    [
      'an unknown programme',
      (r) => (r.programme.id = 'eco_999'),
      'programme.id',
      /no programme "eco_999"/,
    ],
    [
      'a log with unequal lengths',
      (r) => r.programme.course.temperature_log.values.pop(),
      'programme.course.temperature_log.values',
      /2 readings for 3 times/,
    ],
    [
      'a log that goes back in time',
      (r) => (r.programme.course.temperature_log.t_s = [0, 120, 60]),
      'programme.course.temperature_log.t_s',
      /ascending/,
    ],
    [
      'an unknown course event',
      (r) => (r.programme.course.events[0].kind = 'beep'),
      'programme.course.events[0].kind',
      /fill, drain/,
    ],
    [
      'a course step the programme does not have',
      (r) => (r.programme.course.steps[0].step = 'z9_spin'),
      'programme.course.steps[0].step',
      /no step "z9_spin"/,
    ],
    [
      'an unknown detergent form',
      (r) => (r.consumables.detergent.form = 'foam'),
      'consumables.detergent.form',
      /tablet, powder, gel, pouch, none/,
    ],
    [
      'a negative dose',
      (r) => (r.consumables.detergent.dose_g = -1),
      'consumables.detergent.dose_g',
      /grams/,
    ],
    ['no items', (r) => delete r.load.items, 'load.items', /list of items/],
    [
      'an item id that is not an identifier',
      (r) => (r.load.items[0].id = 'Plate 1'),
      'load.items[0].id',
      /identifier/,
    ],
    [
      'an item id used twice',
      (r) => (r.load.items[1].id = 'plate_01'),
      'load.items[1].id',
      /used twice/,
    ],
    [
      'an unknown item type',
      (r) => (r.load.items[0].type = 'flying_saucer'),
      'load.items[0].type',
      /unknown item type "flying_saucer"/,
    ],
    [
      'a custom shape that cannot be built',
      (r) => (r.load.items[1].custom.tile.thickness_mm = -3),
      'load.items[1].custom',
      /cannot be built/,
    ],
    [
      'a custom item labelled as a catalogue type',
      (r) => (r.load.items[1].type = 'dinner_plate_porcelain_270'),
      'load.items[1].type',
      /label of its own/,
    ],
    [
      'a position that is not three numbers',
      (r) => (r.load.items[0].position_mm = [1, 2]),
      'load.items[0].position_mm',
      /three numbers/,
    ],
    [
      'a zero quaternion',
      (r) => (r.load.items[0].quat_wxyz = [0, 0, 0, 0]),
      'load.items[0].quat_wxyz',
      /zero/,
    ],
    [
      'an unknown soil',
      (r) => (r.load.items[0].soils[0].type = 'unobtainium'),
      'load.items[0].soils[0].type',
      /unknown soil "unobtainium"/,
    ],
    [
      'a soil without an amount',
      (r) => delete r.load.items[0].soils[0].amount_g,
      'load.items[0].soils[0].amount_g',
      /positive mass in grams/,
    ],
    [
      'a weighed amount without a method',
      (r) => delete r.load.items[0].soils[0].amount_method,
      'load.items[0].soils[0].amount_method',
      /how the number was obtained/,
    ],
    [
      'a soil on a region the item lacks',
      (r) => (r.load.items[0].soils[0].where.regions[0].region = 'handle'),
      'load.items[0].soils[0].where.regions[0].region',
      /no region "handle" \(rim, well, underside, foot\)/,
    ],
    [
      'a coverage above 1',
      (r) => (r.load.items[0].soils[0].where.regions[0].coverage = 1.5),
      'load.items[0].soils[0].where.regions[0].coverage',
      /above 0 and at most 1/,
    ],
    [
      'a soil with no place',
      (r) => (r.load.items[0].soils[0].where = {}),
      'load.items[0].soils[0].where',
      /"regions" list or a "patch"/,
    ],
    [
      'a disc without a diameter',
      (r) => delete r.load.items[1].soils[0].where.patch.diameter_mm,
      'load.items[1].soils[0].where.patch.diameter_mm',
      /positive diameter/,
    ],
    [
      'a patch of unknown shape',
      (r) => (r.load.items[1].soils[0].where.patch.shape = 'star'),
      'load.items[1].soils[0].where.patch.shape',
      /"disc" or "rect"/,
    ],
    [
      'a patch on a region the item lacks',
      (r) => (r.load.items[1].soils[0].where.patch.region = 'well'),
      'load.items[1].soils[0].where.patch.region',
      /no region "well" \(top, underside, edge\)/,
    ],
    [
      'a soil without a drying time',
      (r) => delete r.load.items[0].soils[0].drying,
      'load.items[0].soils[0].drying.time_h',
      /hours from application/,
    ],
    [
      'an unknown heat history',
      (r) => (r.load.items[0].soils[0].heat.history = 'scorched'),
      'load.items[0].soils[0].heat.history',
      /none, warm, cooked, baked, burnt/,
    ],
    [
      'a temperature with heat history none',
      (r) => (r.load.items[0].soils[0].heat.temperature_c = 80),
      'load.items[0].soils[0].heat.history',
      /name the category/,
    ],
    ['no observations list', (r) => delete r.observations, 'observations', /list of observations/],
    [
      'an observation of an item that is not in the load',
      (r) => (r.observations[0].item = 'plate_99'),
      'observations[0].item',
      /not an item of the load/,
    ],
    [
      'an unknown kind of observation',
      (r) => (r.observations[0].kind = 'smell'),
      'observations[0].kind',
      /score, area_fraction/,
    ],
    [
      'a score that is not a whole number from 0 to 5',
      (r) => (r.observations[0].value = 3.5),
      'observations[0].value',
      /whole number from 0 to 5/,
    ],
    [
      'an area fraction above 1',
      (r) => (r.observations[1].value = 1.2),
      'observations[1].value',
      /between 0 and 1/,
    ],
    [
      'a clean flag that is not true or false',
      (r) => (r.observations[4].value = 1),
      'observations[4].value',
      /true or false/,
    ],
    [
      'a speck count that is not a whole number',
      (r) => (r.observations[5].value = 2.5),
      'observations[5].value',
      /whole number/,
    ],
    [
      'a missing value in a record that is not planned',
      (r) => delete r.observations[0].value,
      'observations[0].value',
      /only a planned record/,
    ],
    [
      'an observation without a method',
      (r) => delete r.observations[1].method,
      'observations[1].method',
      /how the number was obtained/,
    ],
    [
      'a method that is not defined',
      (r) => (r.observations[1].method = 'ruler'),
      'observations[1].method',
      /"ruler" is not a key of provenance\.methods/,
    ],
    [
      'an observation without any uncertainty',
      (r) => delete r.observations[1].sd,
      'observations[1].sd',
      /every observation needs an uncertainty/,
    ],
    [
      'a target region the item lacks',
      (r) => (r.observations[2].target.region = 'lid'),
      'observations[2].target.region',
      /no region "lid"/,
    ],
    [
      'a target soil the item lacks',
      (r) => (r.observations[1].target.soil = 'gravy'),
      'observations[1].target.soil',
      /no soil "gravy" \(egg\)/,
    ],
    [
      'retained water during the run',
      (r) => (r.observations[6].at_s = 600),
      'observations[6].at_s',
      /only be observed at the end/,
    ],
    [
      'two observations with one id',
      (r) => r.observations.push({ ...r.observations[0] }),
      'observations[7].id',
      /two observations have the id "plate_01.score"/,
    ],
    ['a weight above 1', (r) => (r.weight = 2), 'weight', /above 0 and at most 1/],
    ['an unknown tier', (r) => (r.sim.tier = 'preview'), 'sim.tier', /"official" or "fast"/],
    [
      'a seed that is not a 32-bit whole number',
      (r) => (r.sim.level_seed = -1),
      'sim.level_seed',
      /whole number/,
    ],
  ];

  for (const [name, change, path, message] of cases) {
    it(name, () => {
      const result = validateWashRecord(changed(change));
      expect(result.ok, 'should be rejected').toBe(false);
      if (result.ok) return;
      const issue = result.error.find((i) => i.path === path);
      expect(issue, `an issue at ${path}; got ${JSON.stringify(result.error)}`).toBeDefined();
      expect(issue?.message).toMatch(message);
    });
  }

  it('something that is not an object at all', () => {
    for (const json of [null, 3, 'record', [baseRecord()]]) {
      const result = validateWashRecord(json);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error[0]?.message).toMatch(/JSON object/);
    }
  });

  it('a literature record without a source or with an observation that has no sd of its own', () => {
    const result = validateWashRecord(
      changed((r) => {
        r.kind = 'literature';
        delete r.observations[2].sd;
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.find((i) => i.path === 'provenance.source')?.message).toMatch(
      /cites its source/,
    );
    // The method has a default sd, which is enough for a measured record but not here.
    expect(result.error.find((i) => i.path === 'observations[2].sd')?.message).toMatch(
      /states its own uncertainty/,
    );
  });

  it('every problem at once, and parseWashRecord throws them all', () => {
    const broken = changed((r) => {
      r.machine.id = 'nope';
      r.observations[0].value = 9;
      r.load.items[0].soils[0].amount_g = 0;
    });
    const result = validateWashRecord(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThanOrEqual(3);
    expect(() => parseWashRecord(broken)).toThrow(WashRecordError);
    try {
      parseWashRecord(broken);
    } catch (error) {
      expect((error as WashRecordError).issues.length).toBeGreaterThanOrEqual(3);
      expect((error as Error).message).toMatch(/machine\.id: unknown machine "nope"/);
    }
  });
});

describe('group observations (the mean score of a group of items)', () => {
  const firstItem = (): string =>
    ((baseRecord()['load'] as { items: { id: string }[] }).items[0] as { id: string }).id;
  const withGroup = (group: Record<string, unknown>): unknown =>
    changed((record) => {
      record.group_observations = [
        {
          id: 'crockery.mean_score',
          kind: 'mean_score',
          items: [{ item: firstItem(), weight: 2 }],
          value: 3.68,
          sd: 1.11,
          method: 'eye',
          ...group,
        },
      ];
    });

  it('accepts a mean score over items of the load, with or without a value', () => {
    expect(validateWashRecord(withGroup({})).ok).toBe(true);
    const planned = withGroup({});
    delete (planned as { group_observations: Record<string, unknown>[] }).group_observations[0]?.[
      'value'
    ];
    expect(validateWashRecord(planned).ok).toBe(true);
  });

  it('rejects an unknown item, a missing uncertainty, a value off the scale and another kind', () => {
    const paths = (json: unknown): string[] => {
      const result = validateWashRecord(json);
      return result.ok ? [] : result.error.map((issue) => issue.path);
    };
    expect(paths(withGroup({ items: [{ item: 'no_such_item' }] }))).toEqual([
      'group_observations[0].items[0].item',
    ]);
    expect(paths(withGroup({ sd: 0 }))).toEqual(['group_observations[0].sd']);
    expect(paths(withGroup({ value: 5.5 }))).toEqual(['group_observations[0].value']);
    expect(paths(withGroup({ kind: 'score' }))).toEqual(['group_observations[0].kind']);
    expect(paths(withGroup({ items: [] }))).toEqual(['group_observations[0].items']);
    expect(paths(withGroup({ items: [{ item: firstItem(), weight: 0 }] }))).toEqual([
      'group_observations[0].items[0].weight',
    ]);
  });
});

describe('helpers of the record', () => {
  const record = parseWashRecord(baseRecord()) as WashRecord;

  it('names observations by item, kind, target and time', () => {
    expect(record.observations.map(observationIdOf)).toEqual([
      'plate_01.score',
      'plate_01.area_fraction.egg',
      'plate_01.residual_mass.well',
      'tile_01.mass_fraction.soil_1@1800',
      'tile_01.clean',
      'tile_01.specks',
      'plate_01.retained_water',
    ]);
  });

  it('takes the uncertainty of an observation from itself, else from its method', () => {
    expect(observationSd(record, record.observations[1]!)).toBe(0.05);
    expect(observationSd(record, record.observations[2]!)).toBe(5);
    expect(observationSd(record, record.observations[0]!)).toBeUndefined();
  });

  it('builds a tile with the regions top, underside and edge, in metres', () => {
    const shape = customShapeOf({
      tile: { length_mm: 100, width_mm: 80, thickness_mm: 6, material: 'porcelain_glazed' },
    });
    expect(shape.regions.map((r) => r.id)).toEqual(['top', 'underside', 'edge']);
    expect(recordItemRegionIds(record.load.items[1]!)).toEqual(['top', 'underside', 'edge']);
    expect(recordItemRegionIds(record.load.items[0]!)).toEqual([
      'rim',
      'well',
      'underside',
      'foot',
    ]);
  });
});
