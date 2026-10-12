// The wire contract: its constants, and that its types fit together and with the catalogue.
import { RACK_ZONES, SOIL_HEAT_HISTORIES, getSoil, listSoils } from '@spotless/catalogue';
import { accept, canonicalHash, quatFromWire, quatToWire, reject } from '@spotless/core';
import * as physics from '@spotless/physics';
import { describe, expect, it } from 'vitest';
import {
  ACTION_NAMES,
  FRAME_IDS,
  QUERY_NAMES,
  RACK_IDS,
  RENDER_SIZE_DEFAULT_PX,
  RENDER_SIZE_MAX_PX,
  type CheckLoadResult,
  type DropResult,
  type ItemSoilRecord,
  type LoadCheck,
  type RackId,
  type SceneState,
  type SoilHeatHistory,
} from './index.ts';

describe('@spotless/session contract', () => {
  it('resolves its workspace dependencies from TypeScript source', () => {
    expect(quatFromWire(quatToWire([0.1, 0.2, 0.3, 0.9]))).toEqual([0.1, 0.2, 0.3, 0.9]);
    expect(physics.REST_CRITERION.holdTime).toBe(0.5);
  });

  it('lists the actions and queries of platform.md section 6', () => {
    expect([...ACTION_NAMES].sort()).toEqual(
      ['place', 'remove', 'reset', 'set_rack', 'start_cycle'].sort(),
    );
    expect([...QUERY_NAMES].sort()).toEqual(
      [
        'get_level',
        'get_item',
        'get_state',
        'render',
        'preview',
        'list_slots',
        'check_load',
        'get_report',
      ].sort(),
    );
  });

  it('lists the frames of platform.md section 2 and the image sizes of section 7', () => {
    expect(RACK_IDS).toEqual(['lower_rack', 'upper_rack', 'third_rack', 'cutlery_basket']);
    expect(FRAME_IDS).toEqual(['tub', ...RACK_IDS]);
    expect(RENDER_SIZE_DEFAULT_PX).toBe(768);
    expect(RENDER_SIZE_MAX_PX).toBe(1024);
  });

  it('shares the rack ids and the soil heat histories with the catalogue', () => {
    // One declaration each: the session's wire types are the catalogue's, so a soil record of a
    // level card can be filled straight from a catalogue soil and an item's usual zones are
    // rack ids.
    expect(RACK_IDS).toEqual(RACK_ZONES);
    const zone: RackId = RACK_ZONES[0] as (typeof RACK_ZONES)[number];
    expect(RACK_IDS).toContain(zone);
    const histories: readonly SoilHeatHistory[] = SOIL_HEAT_HISTORIES;
    expect(histories).toEqual(['none', 'warm', 'cooked', 'baked', 'burnt']);
    const soil = getSoil((listSoils()[0] as { id: string }).id);
    const record: ItemSoilRecord = {
      description: soil.name,
      type: soil.id,
      regions: [{ region: soil.typicalRegions[0] as string, coverage: 0.5 }],
      amount_g: 1,
      age_h: 12,
      heat_history: soil.heatHistories[0] as SoilHeatHistory,
    };
    expect(histories).toContain(record.heat_history);
  });

  it('wire types are plain JSON: the scene-state example of the benchmark dossier hashes', () => {
    // The example of docs/research/benchmark.md section 3.2 (b), in platform.md naming.
    const state: SceneState = {
      state_hash: 'sha256:0',
      phase: 'loading',
      racks: { lower_rack: 'out', upper_rack: 'out' },
      rack_options: {},
      placed: [
        {
          item_id: 'plate_03',
          frame: 'lower_rack',
          position_mm: [212, 148, 61],
          quat_wxyz: [0.7071, 0.7071, 0, 0],
          stable: true,
          contacts: [
            { with: 'lower_rack.tine_row_2', points: 2 },
            { with: 'plate_02', points: 1 },
          ],
          location: 'lower_rack',
        },
      ],
      unplaced: ['mug_04', 'pan_01'],
      budget: {
        actions_used: 37,
        actions_max: 400,
        queries_used: 122,
        queries_max: 1500,
        washes_used: 0,
        washes_max: 1,
      },
    };
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(canonicalHash(state)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('a drop result narrows on the accepted flag', () => {
    const reasonOf = (result: DropResult): string =>
      result.accepted ? `settled in ${result.settle_time_s} s` : result.reason;
    expect(reasonOf({ accepted: false, reason: 'collision_at_pose', penetration_mm: 2 })).toBe(
      'collision_at_pose',
    );
  });

  it('check_load answers with the mechanical facts beside the accepted flag, or a rejection', () => {
    const facts: LoadCheck = {
      shifted: [{ item_id: 'mug_04', displacement_mm: 3, rotation_deg: 0 }],
      fell_out: [],
      on_tub_floor: [],
      protruding: [],
      racks: [{ rack: 'lower_rack', slides_in: true }],
      spray_arms: [{ arm: 'lower', full_rotation: false, blocked_by: 'pan_01' }],
      door_closes: true,
      door_blocked_by: [],
      dispenser_opens: true,
      dispenser_blocked_by: [],
      tablet_path_clear: true,
      tablet_blocked_by: [],
    };
    const blockedArms = (result: CheckLoadResult): readonly string[] =>
      result.accepted
        ? result.spray_arms.filter((a) => !a.full_rotation).map((a) => a.arm)
        : [result.reason];
    expect(blockedArms(accept(facts))).toEqual(['lower']);
    expect(blockedArms(reject('query_budget_exhausted'))).toEqual(['query_budget_exhausted']);
    // The facts themselves carry no `accepted` key, so they nest in a start_cycle result.
    expect('accepted' in facts).toBe(false);
  });
});
