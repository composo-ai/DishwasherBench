import { instantiate } from '@spotless/catalogue';
import { quatRotate } from '@spotless/core';
import { validateLevel, type Level } from '@spotless/levels';
import { PRIMARY_MACHINE } from '@spotless/machine';
import { createSession, placeholderWashRunner, type WashManifest } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import {
  patchOutlineArea,
  recordFromManifest,
  recordLoadFromManifest,
  washLoadOfRecord,
  washManifestFromRecord,
} from './load.ts';
import {
  parseWashRecord,
  validateWashRecord,
  WASH_RECORD_FORMAT,
  type WashRecord,
} from './record.ts';
import { machineOfRecord } from './setup.ts';

const level: Level = {
  id: 'calibration-round-trip',
  title: 'Round trip',
  summary: 'Two items for the round trip between the game and a wash record.',
  machineId: PRIMARY_MACHINE.id,
  config: null,
  racks: {},
  programmeId: PRIMARY_MACHINE.primaryProgramme,
  items: [
    {
      id: 'soup_plate_01',
      itemType: 'soup_plate_porcelain_230',
      points: 5,
      soils: [
        {
          type: 'tomato_sauce',
          regions: [{ region: 'well', coverage: 0.5 }],
          amountG: 1.5,
          ageH: 3,
          heatHistory: 'warm',
          description: 'the last of the pasta sauce',
        },
      ],
    },
    {
      id: 'fork_01',
      itemType: 'dinner_fork_185',
      points: 2,
      soils: [
        {
          type: 'egg_yolk_dried',
          regions: [{ region: 'tines', coverage: 1 }],
          amountG: 0.2,
          ageH: 1,
          heatHistory: 'none',
        },
      ],
    },
    { id: 'spare_plate', itemType: 'dessert_plate_porcelain_190', points: 3, soils: [] },
  ],
  rules: {
    track: 'one_shot',
    actionsMax: 100,
    queriesMax: 500,
    washesMax: 1,
    mechanicalChecks: true,
  },
  seed: 4242,
  manual: null,
};

/** Loads two items in a real session and returns the manifest it hands to the wash. */
async function manifestFromTheGame(): Promise<WashManifest> {
  let handed: WashManifest | undefined;
  const session = await createSession({
    level,
    washRunner: (manifest, onProgress) => {
      handed = manifest;
      return placeholderWashRunner(manifest, onProgress);
    },
  });
  try {
    const slots = session.listSlots({ rack: 'lower_rack' });
    if (!slots.accepted) throw new Error('list_slots was rejected');
    const slot = slots.slots.find((s) => s.id === 'tine_row_r1.slot_07');
    if (slot === undefined) throw new Error('no slot tine_row_r1.slot_07');
    const plate = session.place({
      item_id: 'soup_plate_01',
      frame: 'lower_rack',
      position_mm: [slot.centre_mm[0] - 30, 360, 240],
      orientation: slot.suggested_orientation ?? { preset: 'on_edge' },
    });
    if (!plate.accepted) throw new Error(`plate rejected: ${JSON.stringify(plate)}`);
    const fork = session.place({
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [32, 28, 120],
      orientation: { preset: 'handle_down' },
    });
    if (!fork.accepted) throw new Error(`fork rejected: ${JSON.stringify(fork)}`);
    const started = session.startCycle();
    if (!started.accepted) throw new Error(`start_cycle rejected: ${JSON.stringify(started)}`);
    await session.washSettled();
    if (handed === undefined) throw new Error('the wash runner was not called');
    return handed;
  } finally {
    session.dispose();
  }
}

describe('a load placed in the game becomes the load of a record, and back', () => {
  it('round trips through the wash manifest of a real session', async () => {
    const manifest = await manifestFromTheGame();
    expect(manifest.items.map((i) => i.item_id)).toEqual(['fork_01', 'soup_plate_01']);

    // Game -> record.
    const record = recordFromManifest(manifest, { id: 'round-trip-1' });
    const checked = validateWashRecord(JSON.parse(JSON.stringify(record)));
    expect(checked.ok ? [] : checked.error).toEqual([]);
    expect(record.kind).toBe('planned');
    expect(record.machine).toEqual({ id: manifest.machine_id, config: manifest.machine_config });
    expect(record.programme.id).toBe('eco_50');
    expect(record.sim?.level_seed).toBe(4242);
    expect(record.load.items.map((i) => [i.id, i.type])).toEqual([
      ['fork_01', 'dinner_fork_185'],
      ['soup_plate_01', 'soup_plate_porcelain_230'],
    ]);
    const plate = record.load.items[1];
    expect(plate?.soils[0]).toMatchObject({
      type: 'tomato_sauce',
      amount_g: 1.5,
      where: { regions: [{ region: 'well', coverage: 0.5 }] },
      drying: { time_h: 3 },
      heat: { history: 'warm' },
      recipe: 'the last of the pasta sauce',
    });

    // Record -> the items of a wash: the poses the loading physics left, to a nanometre, quaternions exactly.
    const parsed = parseWashRecord(JSON.parse(JSON.stringify(record)));
    const machine = machineOfRecord(parsed);
    const load = washLoadOfRecord(parsed, machine.spec, machine.config);
    load.items.forEach((item, i) => {
      const original = manifest.items[i];
      expect(item.itemId).toBe(original?.item_id);
      for (let k = 0; k < 3; k++) expect(item.pose.p[k]).toBeCloseTo(original?.pose.p[k] ?? 99, 9);
      for (let k = 0; k < 4; k++) expect(item.pose.q[k]).toBe(original?.pose.q[k]);
      expect(item.soils).toHaveLength(original?.soils.length ?? -1);
    });
    expect(load.items[1]?.soils[0]).toEqual({
      type: 'tomato_sauce',
      regions: [{ region: 'well', coverage: 0.5 }],
      amount_g: 1.5,
      age_h: 3,
      heat_history: 'warm',
    });

    // Record -> game: the same machine, programme, seed, items, poses, soils and points.
    const back = washManifestFromRecord(parsed, machine.spec, machine.config);
    expect(back.omitted).toEqual([]);
    expect(back.notes).toEqual([]);
    const again = back.manifest;
    expect(again.machine_id).toBe(manifest.machine_id);
    expect(again.machine_config).toEqual(manifest.machine_config);
    expect(again.programme_id).toBe(manifest.programme_id);
    expect(again.seed).toBe(manifest.seed);
    expect(again.items.map((i) => i.item_id)).toEqual(manifest.items.map((i) => i.item_id));
    again.items.forEach((item, i) => {
      const original = manifest.items[i];
      expect(item.item_type).toBe(original?.item_type);
      expect(item.soils).toEqual(original?.soils);
      expect(item.points).toBe(instantiate(item.item_type).type.game.defaultPoints);
      for (let k = 0; k < 3; k++) expect(item.pose.p[k]).toBeCloseTo(original?.pose.p[k] ?? 99, 9);
      for (let k = 0; k < 4; k++) expect(item.pose.q[k]).toBe(original?.pose.q[k]);
    });
    // The player-visible load manifest is the one the session wrote: reference points to 0.1 mm.
    expect(again.load.rack_options).toEqual(manifest.load.rack_options);
    again.load.items.forEach((wire, i) => {
      const original = manifest.load.items[i];
      expect(wire.item_id).toBe(original?.item_id);
      expect(wire.frame).toBe('tub');
      for (let k = 0; k < 3; k++)
        expect(wire.position_mm[k]).toBeCloseTo(original?.position_mm[k] ?? 99, 6);
      for (let k = 0; k < 4; k++)
        expect(wire.quat_wxyz[k]).toBeCloseTo(original?.quat_wxyz[k] ?? 99, 9);
    });
    // The level of the manifest holds the loaded items with their soils.
    expect(again.level.items.map((i) => [i.id, i.itemType])).toEqual([
      ['fork_01', 'dinner_fork_185'],
      ['soup_plate_01', 'soup_plate_porcelain_230'],
    ]);
    expect(again.level.items[1]?.soils).toEqual(level.items[0]?.soils);
    expect(again.level.seed).toBe(4242);
    // It is a level the game accepts, so a client can open it.
    expect(validateLevel(again.level)).toEqual([]);

    // And once more round: record -> game -> record gives the same load.
    const twice = recordLoadFromManifest(again);
    twice.items.forEach((item, i) => {
      const first = record.load.items[i];
      expect(item.id).toBe(first?.id);
      for (let k = 0; k < 3; k++)
        expect(item.position_mm[k]).toBeCloseTo(first?.position_mm[k] ?? 99, 6);
      expect(item.soils).toEqual(first?.soils);
    });
  });
});

describe('washLoadOfRecord and washManifestFromRecord', () => {
  const record: WashRecord = {
    format: WASH_RECORD_FORMAT,
    version: 1,
    id: 'Load-Test A',
    kind: 'planned',
    provenance: { methods: { scale: { description: 'balance' } } },
    machine: { id: 'bosch_smv4hax40g' },
    programme: { id: 'eco_50' },
    load: {
      dispenser_blocked: true,
      stalled_arms_deg: { lower: 90 },
      items: [
        {
          id: 'plate_01',
          type: 'dinner_plate_porcelain_270',
          frame: 'lower_rack',
          position_mm: [100, 200, 150],
          quat_wxyz: [2, 0, 0, 0],
          soils: [
            {
              type: 'egg_yolk',
              amount_g: 1,
              where: {
                patch: { region: 'well', shape: 'disc', centre_mm: [0, 0, 8], diameter_mm: 50 },
              },
              drying: { time_h: 2 },
              heat: { history: 'baked', temperature_c: 180, time_min: 20 },
            },
            {
              type: 'tomato_sauce',
              amount_g: 2,
              where: { regions: [{ region: 'rim', coverage: 0.25 }] },
              drying: { time_h: 6 },
              heat: { history: 'warm', temperature_c: 70 },
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
          soils: [],
        },
      ],
    },
    observations: [],
  };
  const machine = machineOfRecord(record);

  it('places items in the tub frame from a basket frame, with a unit quaternion', () => {
    const load = washLoadOfRecord(record, machine.spec, machine.config);
    const plate = load.items[0];
    // The lower basket's origin is at (-262.5, -262, 73) mm in the tub.
    expect(plate?.pose.p[0]).toBeCloseTo(-0.1625, 9);
    expect(plate?.pose.p[1]).toBeCloseTo(-0.062, 9);
    expect(plate?.pose.p[2]).toBeCloseTo(0.223, 9);
    expect(plate?.pose.q).toEqual([0, 0, 0, 1]);
    expect(load.items[1]?.shape).toBeDefined();
    expect(load.items[1]?.pose.p).toEqual([0, 0, 0.2]);
    expect(load.dispenserBlocked).toBe(true);
    expect(load.stalledArms['lower']).toBeCloseTo(Math.PI / 2, 12);
    expect(() =>
      washLoadOfRecord(
        { ...record, load: { items: [{ ...record.load.items[0]!, frame: 'top_shelf' }] } },
        machine.spec,
        machine.config,
      ),
    ).toThrow(/unknown frame "top_shelf" \(tub, /);
  });

  it('lays a patch on its whole region for the evaluator to cut out', () => {
    const load = washLoadOfRecord(record, machine.spec, machine.config);
    expect(load.items[0]?.soils[0]).toEqual({
      type: 'egg_yolk',
      regions: [{ region: 'well', coverage: 1 }],
      amount_g: 1,
      age_h: 2,
      heat_history: 'baked',
    });
    expect(load.patches).toEqual([
      {
        itemId: 'plate_01',
        soilIndex: 0,
        patch:
          record.load.items[0]?.soils[0]?.where && 'patch' in record.load.items[0].soils[0].where
            ? record.load.items[0].soils[0].where.patch
            : undefined,
      },
    ]);
    expect(
      patchOutlineArea({ region: 'well', shape: 'disc', centre_mm: [0, 0, 0], diameter_mm: 50 }),
    ).toBeCloseTo(Math.PI * 0.025 ** 2, 12);
    expect(
      patchOutlineArea({ region: 'top', shape: 'rect', centre_mm: [0, 0, 0], size_mm: [40, 20] }),
    ).toBeCloseTo(8e-4, 12);
  });

  it('turns stated heat histories into the parameters of their categories', () => {
    const load = washLoadOfRecord(record, machine.spec, machine.config);
    // Categories warm, cooked, baked, burnt; registered [80, 125, 160, 204] C and [7200, 1800, 3600, 1800] s.
    expect(load.params['soil.heatTemperature']).toEqual([70, 125, 180, 204]);
    expect(load.params['soil.heatDuration']).toEqual([7200, 1800, 1200, 1800]);
  });

  it('reports what the game cannot hold: custom shapes, patches, model classes', () => {
    const made = washManifestFromRecord(record, machine.spec, machine.config);
    expect(made.omitted).toEqual(['tile_01']);
    expect(made.manifest.items.map((i) => i.item_id)).toEqual(['plate_01']);
    expect(made.notes.join('\n')).toMatch(
      /model class "egg_yolk" is shown as catalogue soil "aham_egg_yolk"/,
    );
    expect(made.notes.join('\n')).toMatch(/the patch is shown as 6 % of region "well"/);
    const soil = made.manifest.items[0]?.soils[0];
    expect(soil?.type).toBe('aham_egg_yolk');
    expect(soil?.regions[0]?.coverage).toBeCloseTo(
      (Math.PI * 0.025 ** 2) / (instantiate('dinner_plate_porcelain_270').regionAreas['well'] ?? 1),
      9,
    );
    // The level id is a valid identifier made from the record's id.
    expect(made.manifest.level.id).toBe('load-test-a');
    // The wire pose is the item's reference point, rounded to 0.1 mm.
    const reference = quatRotate(
      [0, 0, 0, 1],
      instantiate('dinner_plate_porcelain_270').referencePoint,
    );
    const wire = made.manifest.load.items[0];
    expect(wire?.position_mm[2]).toBeCloseTo(Math.round((0.223 + reference[2]) * 10000) / 10, 9);
    expect(wire?.quat_wxyz).toEqual([1, 0, 0, 0]);
  });
});
