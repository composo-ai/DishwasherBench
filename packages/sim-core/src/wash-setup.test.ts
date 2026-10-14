// What a wash is set up from, without running one: the composed registry, the JSON
// description, the canonical pose, the mapping of catalogue soils and materials, and the cache
// key of an exposure set (what it must and must not depend on). Whole washes are run by the
// end-to-end tests of @spotless/sim-verify.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMaterial, instantiate, listSoils } from '@spotless/catalogue';
import { degToRad, quatFromAxisAngle, quatRotate } from '@spotless/core';
import { BOSCH_SMV4HAX40G, buildMachineGeometry, primaryProgramme } from '@spotless/machine';
import { describe, expect, it } from 'vitest';
import {
  buildWashHydraulics,
  buildWashScene,
  canonicalPose,
  createMemoryExposureCache,
  createWashParams,
  exposureKey,
  LIQUOR_FIELDS,
  placementProblems,
  sceneChamber,
  sceneGeometryKey,
  sceneMachineParts,
  sceneMaterialOf,
  SOIL_MODEL_CLASSES,
  soilTypeInfo,
  trappedWaterByStep,
  TIER_FAST,
  TIER_OFFICIAL,
  WASH_PARAM_CONTRIBUTIONS,
  WashDescriptionError,
  washInputFromDescription,
  washRegistry,
  washResultToJson,
  type ExposureKeyParts,
  type SceneKeyItem,
  type WashDescription,
  type WashResult,
} from './index.ts';
import {
  createDiskExposureCache,
  exposureFingerprint,
  EXPOSURE_SOURCE_SCOPE,
  loadedExposureSource,
  simulationFingerprint,
  sourceFingerprint,
} from './node/index.ts';

const spec = BOSCH_SMV4HAX40G;
const here = dirname(fileURLToPath(import.meta.url));

describe('the composed registry', () => {
  const registry = washRegistry();

  it("holds every package's definitions once, each with a source", () => {
    const contributed = Object.values(WASH_PARAM_CONTRIBUTIONS).reduce(
      (sum, defs) => sum + defs.length,
      0,
    );
    expect(registry.defs).toHaveLength(contributed);
    expect(contributed).toBeGreaterThan(150);
    for (const def of registry.defs) expect(def.source.length, def.key).toBeGreaterThan(5);
    expect(registry.soilClasses).toEqual([...SOIL_MODEL_CLASSES]);
    for (const pkg of [
      'sim-scene',
      'sim-hydraulics',
      'sim-jets',
      'sim-spray',
      'sim-film',
      'sim-liquor',
      'sim-soil',
      'sim-timeline',
      'inspector',
    ]) {
      expect(WASH_PARAM_CONTRIBUTIONS[pkg]?.length, pkg).toBeGreaterThan(0);
    }
  });

  it('keeps soil, liquor, replay and inspection parameters out of the hydro hash', () => {
    const base = createWashParams();
    for (const [key, value] of [
      ['soil.egg_yolk.rateRef', 6e-5],
      ['liq.wStuck', 0.01],
      ['tl.poolMixing', 0.9],
      ['inspect.maxAreaMm2', 8],
    ] as const) {
      const changed = createWashParams({ [key]: value });
      expect(changed.hydroHash, key).toBe(base.hydroHash);
      expect(changed.soilHash, key).not.toBe(base.soilHash);
    }
    for (const [key, value] of [
      ['jets.kStag', 1.4],
      ['film.standInHoldTime', 45],
      ['spray.standInShowerRays', 2048],
      ['hyd.slotFanAngle', 0.5],
      ['scene.contactGap', 0.002],
    ] as const) {
      const changed = createWashParams({ [key]: value });
      expect(changed.hydroHash, key).not.toBe(base.hydroHash);
      expect(changed.soilHash, key).toBe(base.soilHash);
    }
  });

  it('rejects an unknown key and a value outside its range', () => {
    expect(() => createWashParams({ 'soil.noSuchThing': 1 })).toThrow();
    expect(() => createWashParams({ 'soil.hillN': 40 })).toThrow();
  });
});

describe('the cache key of an exposure set', () => {
  const params = createWashParams();
  const hydraulics = buildWashHydraulics({ spec, programme: primaryProgramme(spec), params });
  const plate = instantiate('dessert_plate_porcelain_190').shape;
  const mug = instantiate('mug_ceramic_300').shape;
  const items: SceneKeyItem[] = [
    {
      itemId: 'plate',
      typeId: 'dessert_plate_porcelain_190',
      shape: plate,
      pose: canonicalPose({ p: [0, 0, 0.2], q: [0, 0, 0, 1] }),
    },
    {
      itemId: 'mug',
      typeId: 'mug_ceramic_300',
      shape: mug,
      pose: canonicalPose({ p: [0.1, 0, 0.43], q: [0, 0, 0, 1] }),
    },
  ];
  const scene = sceneGeometryKey(spec, spec.defaultConfig, 4e-3, items);
  const state = hydraulics.states[0];
  if (state === undefined) throw new Error('no state');
  const parts = {
    scene,
    state,
    armLevels: ['lower', 'upper'],
    params,
    tier: TIER_FAST,
    simSeed: 5,
    stage: 'stand-in',
  };
  const key = exposureKey(parts);

  it('does not depend on soil parameters or on the order of the items', () => {
    expect(key).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(
      exposureKey({
        ...parts,
        params: createWashParams({ 'soil.starch.tLag': 100, 'liq.xProtease': 0.02 }),
      }),
    ).toBe(key);
    expect(sceneGeometryKey(spec, spec.defaultConfig, 4e-3, [...items].reverse())).toBe(scene);
  });

  it('changes with everything the exposure is computed from', () => {
    const other = (change: Partial<ExposureKeyParts>): string =>
      exposureKey({ ...parts, ...change });
    expect(other({ params: createWashParams({ 'jets.kFilm': 1.2 }) })).not.toBe(key);
    expect(other({ state: hydraulics.states[1] as typeof state })).not.toBe(key);
    expect(other({ simSeed: 6 })).not.toBe(key);
    expect(other({ tier: TIER_OFFICIAL })).not.toBe(key);
    expect(other({ stage: 'jets-v1' })).not.toBe(key);
    // The tracer: the CPU, a GPU, and another GPU stack each keep their own sets, and so
    // does another version of the simulator.
    const gpu = other({ backend: 'gpu {"adapter":"apple-m3-pro","bindings":"webgpu 0.6.2"}' });
    const cpu = other({ backend: 'cpu' });
    expect(cpu).not.toBe(key);
    expect(gpu).not.toBe(cpu);
    expect(other({ backend: 'gpu {"adapter":"apple-m3-pro","bindings":"webgpu 0.3.0"}' })).not.toBe(
      gpu,
    );
    expect(other({ version: 'spotless-sim 9.9.9' })).not.toBe(key);
    expect(other({ armLevels: ['upper', 'lower'] })).not.toBe(key);
    // The geometry: a pose moved by a millimetre, another block size, another basket height,
    // an item more.
    const moved = [
      {
        ...(items[0] as SceneKeyItem),
        pose: canonicalPose({ p: [0.001, 0, 0.2], q: [0, 0, 0, 1] }),
      },
      items[1] as SceneKeyItem,
    ];
    expect(sceneGeometryKey(spec, spec.defaultConfig, 4e-3, moved)).not.toBe(scene);
    expect(sceneGeometryKey(spec, spec.defaultConfig, 2e-3, items)).not.toBe(scene);
    expect(sceneGeometryKey(spec, spec.defaultConfig, 4e-3, items.slice(0, 1))).not.toBe(scene);
    const upper = spec.baskets.find((basket) => basket.pose.heightPositions.length > 1);
    const position = upper?.pose.heightPositions.find(
      (p) => p.id !== spec.defaultConfig.basketHeights[upper.id],
    );
    if (upper === undefined || position === undefined) throw new Error('no adjustable basket');
    const raised = {
      ...spec.defaultConfig,
      basketHeights: { ...spec.defaultConfig.basketHeights, [upper.id]: position.id },
    };
    expect(sceneGeometryKey(spec, raised, 4e-3, items)).not.toBe(scene);
    // The code that computes it, the wetting data of the materials, the masses of the items.
    expect(other({ source: 'a'.repeat(64) })).not.toBe(key);
    expect(other({ materials: [sceneMaterialOf('porcelain_glazed')] })).not.toBe(key);
    expect(other({ itemMass: new Map([['plate', 0.31]]) })).not.toBe(key);
    expect(
      other({
        itemMass: new Map([
          ['plate', 0.3],
          ['mug', 0.35],
        ]),
      }),
    ).toBe(
      other({
        itemMass: new Map([
          ['mug', 0.35],
          ['plate', 0.3],
        ]),
      }),
    );
  });

  it('does not depend on what the geometry does not: the dose, the programmes, the thermal data', () => {
    // The same machine with the owner's capsule in place of the reference dose, and with
    // another inlet temperature: the scene, and with it every exposure set, is the same.
    const dosed = { ...spec, dosing: { ...spec.dosing, detergentMass: 0.0129 } };
    expect(sceneGeometryKey(dosed, spec.defaultConfig, 4e-3, items)).toBe(scene);
    const fewer = { ...spec, programmes: spec.programmes.slice(0, 1) };
    expect(sceneGeometryKey(fewer, spec.defaultConfig, 4e-3, items)).toBe(scene);
  });

  it('is the same for poses that round to the same 0.1 mm and 1e-4', () => {
    const a = canonicalPose({ p: [0.10001, 0.2, 0.3], q: [0, 0, 0.00001, 1] });
    const b = canonicalPose({ p: [0.10004, 0.2, 0.3], q: [0, 0, 0.00004, 2] });
    expect(a).toEqual(b);
    expect(a.p[0]).toBeCloseTo(0.1, 12);
    expect(Math.hypot(...a.q)).toBeCloseTo(1, 12);
    expect(() => canonicalPose({ p: [0, 0, 0], q: [0, 0, 0, 0] })).toThrow(RangeError);
  });
});

describe('catalogue data as the simulation takes it', () => {
  it('maps every catalogue soil to a model class, with its solids fraction', () => {
    for (const soil of listSoils()) {
      const info = soilTypeInfo(soil.id);
      expect(SOIL_MODEL_CLASSES, soil.id).toContain(info.modelClass);
      expect(info.solidsFraction).toBe(soil.loading.solidsFraction);
    }
    expect(soilTypeInfo('egg_yolk_dried')).toEqual({ modelClass: 'egg_yolk', solidsFraction: 0.5 });
    expect(soilTypeInfo('pasta_starch').modelClass).toBe('starch');
    expect(soilTypeInfo('tomato_sauce').modelClass).toBe('adhesive');
    expect(soilTypeInfo('butter_margarine').modelClass).toBe('fat');
    expect(soilTypeInfo('jam').modelClass).toBe('soluble');
    expect(soilTypeInfo('tea_tannin').modelClass).toBe('tea');
    // A model class stands for itself; anything else is refused.
    expect(soilTypeInfo('starch')).toEqual({ modelClass: 'starch', solidsFraction: null });
    expect(() => soilTypeInfo('moon_dust')).toThrow(RangeError);
  });

  it('carries the contact angles of a material in radians, for W, D and R', () => {
    const material = getMaterial('porcelain_glazed');
    const scene = sceneMaterialOf('porcelain_glazed');
    expect(scene.wettingClass).toBe(material.wetting.class);
    expect(scene.advancing[0]).toBeCloseTo(
      degToRad(material.wetting.angles.clean_water.advancingDeg),
      12,
    );
    expect(scene.receding[1]).toBeCloseTo(
      degToRad(material.wetting.angles.main_wash.recedingDeg),
      12,
    );
    expect(scene.receding[2]).toBeCloseTo(
      degToRad(material.wetting.angles.rinse_aid.recedingDeg),
      12,
    );
  });
});

describe('a wash as a JSON description', () => {
  const minimal: WashDescription = {
    items: [{ id: 'mug', type: 'mug_ceramic_300', position_mm: [10, 20, 430] }],
  };

  it('takes the arms the load holds still in degrees', () => {
    const input = washInputFromDescription({ ...minimal, stalledArms_deg: { lower: 62.3 } });
    expect(input.stalledArms).toEqual({ lower: degToRad(62.3) });
    expect(washInputFromDescription(minimal).stalledArms).toBeUndefined();
    expect(() =>
      washInputFromDescription({
        ...minimal,
        stalledArms_deg: { lower: 'a quarter turn' as unknown as number },
      }),
    ).toThrow(WashDescriptionError);
  });

  it('takes the whole machine configuration of a description: shelves and the cutlery basket, not basket heights alone', () => {
    // A load made with a shelf moved and the cutlery basket taken out (the game's wash manifest
    // carries this as `machine_config`). Before, only `basketHeights` reached the wash and such
    // a load was washed with its mugs inside the folded-up shelf.
    const spec = washInputFromDescription(minimal).machine;
    const shelf = spec.defaultConfig.shelves[0];
    if (shelf === undefined) throw new Error('the machine has no shelf');
    const machineConfig = {
      ...spec.defaultConfig,
      shelves: spec.defaultConfig.shelves.map((s, i) =>
        i === 0 ? { ...s, state: s.state === 'up' ? ('down' as const) : ('up' as const) } : s,
      ),
      cutleryBasket: null,
    };
    const input = washInputFromDescription({ ...minimal, machineConfig });
    expect(input.config).toEqual(machineConfig);
    expect(input.config?.shelves[0]?.state).not.toBe(shelf.state);
    expect(input.config?.cutleryBasket).toBeNull();
    // Without it: the default configuration.
    expect(washInputFromDescription(minimal).config).toEqual(spec.defaultConfig);
  });

  it("defaults to the owner's machine, Eco 50 and the fast tier", () => {
    const input = washInputFromDescription(minimal);
    expect(input.machine.id).toBe('bosch_smv4hax40g');
    expect(input.programme.id).toBe('eco_50');
    expect(input.tier).toBe('fast');
    expect(input.items[0]?.pose).toEqual({ p: [0.01, 0.02, 0.43], q: [0, 0, 0, 1] });
    expect(input.items[0]?.soils).toEqual([]);
  });

  it('places an item in a basket frame, in a named orientation, turned about the vertical', () => {
    const input = washInputFromDescription({
      items: [
        {
          id: 'mug',
          type: 'mug_ceramic_300',
          frame: 'upper_rack',
          position_mm: [100, 200, 2],
          orientation: 'inverted',
          yaw_deg: 90,
          soils: [
            {
              type: 'tea_tannin',
              regions: ['interior', { region: 'rim', coverage: 0.5 }],
              amount_g: 0.3,
            },
          ],
        },
      ],
    });
    const pose = input.items[0]?.pose;
    if (pose === undefined) throw new Error('no item');
    // The upper basket's frame has its origin at (-244, -258, 420) mm in the tub frame.
    expect(pose.p[0]).toBeCloseTo(-0.244 + 0.1, 9);
    expect(pose.p[1]).toBeCloseTo(-0.258 + 0.2, 9);
    expect(pose.p[2]).toBeCloseTo(0.42 + 0.002, 9);
    // Inverted: the item's axis points down. Turned by 90 degrees: its x axis (the handle)
    // points along +y.
    const axis = quatRotate(pose.q, [0, 0, 1]);
    const handle = quatRotate(pose.q, [1, 0, 0]);
    expect(axis[2]).toBeCloseTo(-1, 9);
    expect(handle[1]).toBeCloseTo(1, 9);
    expect(input.items[0]?.soils[0]).toEqual({
      type: 'tea_tannin',
      regions: [
        { region: 'interior', coverage: 1 },
        { region: 'rim', coverage: 0.5 },
      ],
      amount_g: 0.3,
      age_h: 2,
      heat_history: 'none',
    });
  });

  it('takes a quaternion in (w, x, y, z) order', () => {
    const q = quatFromAxisAngle([1, 0, 0], degToRad(110));
    const input = washInputFromDescription({
      items: [
        {
          id: 'p',
          type: 'dessert_plate_porcelain_190',
          position_mm: [0, 0, 200],
          quat_wxyz: [q[3], q[0], q[1], q[2]],
        },
      ],
    });
    const got = input.items[0]?.pose.q ?? [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) expect(got[i]).toBeCloseTo(q[i] as number, 12);
  });

  it('says what is wrong with a description that is not a wash', () => {
    const bad = (description: unknown, message: string): void => {
      expect(() => washInputFromDescription(description as WashDescription)).toThrow(
        WashDescriptionError,
      );
      expect(() => washInputFromDescription(description as WashDescription)).toThrow(message);
    };
    bad({ ...minimal, machine: 'no_such_machine' }, 'unknown machine');
    bad({ ...minimal, programme: 'no_such_programme' }, 'no programme');
    bad(
      { items: [{ id: 'x', type: 'no_such_item', position_mm: [0, 0, 0] }] },
      'unknown item type',
    );
    bad({ items: [{ id: 'x', type: 'mug_ceramic_300', position_mm: [0, 0] }] }, 'position_mm');
    bad(
      { items: [{ id: 'x', type: 'mug_ceramic_300', position_mm: [0, 0, 0], frame: 'roof' }] },
      'unknown frame',
    );
    bad(
      {
        items: [
          { id: 'x', type: 'mug_ceramic_300', position_mm: [0, 0, 0], orientation: 'sideways' },
        ],
      },
      'no orientation',
    );
    bad({ items: [minimal.items[0], minimal.items[0]] }, 'used twice');
    bad({ items: 'none' }, 'items must be a list');
    bad(
      {
        items: [
          {
            id: 'x',
            type: 'mug_ceramic_300',
            position_mm: [0, 0, 0],
            soils: [{ type: 'tea_tannin', regions: [], amount_g: 1 }],
          },
        ],
      },
      'regions',
    );
  });

  it('describes a wash in the example that ships with the package', () => {
    const example = JSON.parse(
      readFileSync(join(here, '..', 'examples', 'plates-mugs-pan.json'), 'utf8'),
    ) as WashDescription;
    const input = washInputFromDescription(example);
    expect(input.items.map((item) => item.itemId)).toEqual([
      'plate_facing',
      'plate_away',
      'pan',
      'plate_shadowed',
      'mug_upright',
      'mug_inverted',
    ]);
    // Every soil lies on a region its item has.
    for (const item of input.items) {
      const regions = new Set(instantiate(item.typeId).shape.regions.map((region) => region.id));
      for (const soil of item.soils)
        for (const entry of soil.regions)
          expect(regions.has(entry.region), `${item.itemId} ${entry.region}`).toBe(true);
    }
  });
});

describe('where the items are placed (review of the first build)', () => {
  const geometry = buildMachineGeometry(spec, spec.defaultConfig);
  const chamber = sceneChamber(spec);
  const params = createWashParams();
  const FACING: [number, number, number, number] = [0.5736, 0.8192, 0, 0];
  const scene = (description: WashDescription) => {
    const input = washInputFromDescription(description);
    return buildWashScene({
      items: input.items.map((item) => ({
        itemId: item.itemId,
        typeId: item.typeId,
        shape: instantiate(item.typeId).shape,
        pose: canonicalPose(item.pose),
        soils: [],
      })),
      machine: sceneMachineParts(geometry),
      blockSize: 4e-3,
      materials: sceneMaterialOf,
      params,
      chamber,
    });
  };
  const plate = (id: string, x: number, y: number, z: number) => ({
    id,
    type: 'dessert_plate_porcelain_190',
    position_mm: [x, y, z] as [number, number, number],
    quat_wxyz: FACING,
  });
  // A well-placed plate; a plate above the roof; two plates in one place; a plate 1 mm from
  // another; a fork lying 44 mm up, 150 mm from the axis of the lower arm (its blades sweep
  // r < 230 mm from 36 to 52 mm); a mug in front of the dispenser lid.
  const lid = geometry.affordances.dispenserLid.swept;
  const built = scene({
    items: [
      plate('good', -120, 130, 172),
      plate('high', 120, 130, 2000),
      plate('twin_a', 120, -130, 172),
      plate('twin_b', 120, -130, 172),
      plate('close_a', -120, -130, 172),
      plate('close_b', -120, -129, 172),
      { id: 'fork', type: 'dinner_fork_185', position_mm: [150, 0, 44], orientation: 'flat' },
      {
        id: 'mug',
        type: 'mug_ceramic_300',
        position_mm: [
          500 * (lid.min[0] + lid.max[0]),
          1000 * lid.min[1] + 30,
          1000 * lid.min[2] - 40,
        ],
        orientation: 'upright',
      },
    ],
  });

  it('names an item outside the chamber, two in one place, and one cutting into another', () => {
    const problems = placementProblems(built, geometry, chamber, params, {});
    const about = (id: string): string[] => problems.filter((p) => p.includes(id));
    expect(about('good')).toEqual([]);
    expect(about('high')).toHaveLength(1);
    expect(about('high')[0]).toMatch(/wholly outside the wash chamber/);
    expect(about('twin_a').some((p) => /twin_a and twin_b are in the same place/.test(p))).toBe(
      true,
    );
    expect(about('close_a').some((p) => /cuts \d+\.\d mm into/.test(p))).toBe(true);
    for (const p of problems) expect(p.startsWith('placement: ')).toBe(true);
  });

  it('names an item in the path of an arm or of the dispenser lid unless the input says so', () => {
    const free = placementProblems(built, geometry, chamber, params, {});
    expect(
      free.filter((p) => /fork stands in the path of the lower spray arm/.test(p)),
    ).toHaveLength(1);
    expect(free.filter((p) => /mug stands in the way of the dispenser lid/.test(p))).toHaveLength(
      1,
    );
    expect(free.some((p) => /good stands in/.test(p))).toBe(false);
    const told = placementProblems(built, geometry, chamber, params, {
      stalledArms: { lower: 0.3 },
      dispenserBlocked: true,
    });
    expect(told.some((p) => /spray arm|dispenser lid/.test(p))).toBe(false);
    // What the input cannot excuse is still reported.
    expect(told.some((p) => /high lies wholly outside/.test(p))).toBe(true);
  });
});

describe('water the load traps in upright vessels', () => {
  const programme = primaryProgramme(spec);
  const params = createWashParams();

  it('is held back from the sump in the first bath only', () => {
    // Eco 50: pre-drain, fill, cold pre-rinse, and the main wash in the same water, which is
    // drained only at its end. The vessels fill in the pre-rinse and stay full.
    const held = trappedWaterByStep(programme, 0.003);
    const firstBath = programme.steps.filter((step) => held({ stepId: step.id }).trapped === 0.003);
    expect(firstBath.map((step) => step.id)).toEqual([
      'e0_pre_drain',
      'e1_fill',
      'e2_pre_rinse',
      'e4_dose',
      'e4_heat',
      'e5_hold',
    ]);
    for (const step of programme.steps) {
      if (step.phase === 'intermediate_rinse' || step.phase === 'final_rinse') {
        expect(held({ stepId: step.id }).trapped).toBeUndefined();
      }
    }
  });

  it('starves the pump in that bath, where the machine tops up, and nowhere after it', () => {
    // 2.9 L in upright vessels: of the 4.0 L of the first fill and the 0.5 L the level check
    // adds in the pre-rinse, 1.6 L is left for pipes, air, films and sump, too little; the
    // second 0.5 L the level check adds when the main wash starts is enough for the wash.
    const dry = buildWashHydraulics({ spec, programme, params });
    const loaded = buildWashHydraulics({
      spec,
      programme,
      params,
      heldWater: trappedWaterByStep(programme, 0.0029),
    });
    const timeline = loaded.schedule.timeline;
    const starved = timeline.problems.filter((p) => p.code === 'pump_starved');
    expect(starved.length).toBeGreaterThan(0);
    for (const problem of starved) expect(problem.stepId).toBe('e2_pre_rinse');
    expect(timeline.events.filter((e) => e.kind === 'top_up').map((e) => e.stepId)).toEqual([
      'e2_pre_rinse',
      'e4_heat',
    ]);
    // The pre-rinse runs on spray states of its own, at a fraction of the flow ...
    const short = loaded.states.filter((state) => state.headFactor < 1);
    expect(short.length).toBeGreaterThan(0);
    for (const state of short) {
      expect(state.pumpRpm).toBe(2800);
      const full = dry.states.find((s) => s.id === `${state.position}@${state.pumpRpm}`);
      expect(state.flow).toBeLessThan(0.9 * (full?.flow ?? 0));
    }
    for (const span of loaded.schedule.spans) {
      if (span.state < 0) continue;
      const state = loaded.states[span.state];
      // Short in the pre-rinse only.
      if (span.phase !== 'pre_rinse')
        expect(state?.headFactor, `${span.stepId} ${state?.id}`).toBe(1);
    }
    // ... and the main wash reaches its temperature as in the unloaded machine: the programme
    // is not a quarter of an hour longer and does not run cold.
    const hottest = (h: typeof loaded): number =>
      Math.max(
        ...h.schedule.timeline.segments
          .filter((segment) => segment.phase === 'main_wash')
          .flatMap((segment) => [...segment.temperature.liquor]),
      );
    expect(hottest(loaded)).toBeCloseTo(hottest(dry), 0);
    expect(hottest(loaded)).toBeGreaterThan(49);
    expect(Math.abs(loaded.schedule.duration - dry.schedule.duration)).toBeLessThan(120);
    // The states of the unloaded machine are all still there, under the same keys.
    for (const state of dry.states) {
      expect(loaded.states.find((s) => s.id === state.id)?.key).toBe(state.key);
    }
  });
});

describe('exposure caches', () => {
  it('keeps bytes in memory by key', async () => {
    const cache = createMemoryExposureCache();
    expect(await cache.get('sha256:aa')).toBeUndefined();
    await cache.put('sha256:aa', Uint8Array.of(1, 2, 3));
    expect(await cache.get('sha256:aa')).toEqual(Uint8Array.of(1, 2, 3));
    expect(cache.size).toBe(1);
  });

  it('keeps bytes on disk by key, and treats a damaged file as absent', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'spotless-cache-'));
    try {
      const cache = createDiskExposureCache(join(directory, 'sets'));
      const bytes = new Uint8Array(100_000);
      for (let i = 0; i < bytes.length; i += 97) bytes[i] = i & 255;
      expect(await cache.get('sha256:bb')).toBeUndefined();
      await cache.put('sha256:bb', bytes);
      expect(await cache.get('sha256:bb')).toEqual(bytes);
      // Another cache object on the same directory sees it: it outlives the process.
      expect(await createDiskExposureCache(join(directory, 'sets')).get('sha256:bb')).toEqual(
        bytes,
      );
      // The sets lie in a sub-directory named after the fingerprint of the exposure sources.
      const home = `src-${loadedExposureSource().slice(0, 16)}`;
      expect(readdirSync(join(directory, 'sets'))).toEqual([home]);
      writeFileSync(join(directory, 'sets', home, 'sha256_bb.spxe'), 'not deflate');
      expect(await cache.get('sha256:bb')).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('never reads a set that other water code computed, whatever the version string says', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'spotless-cache-'));
    try {
      const cache = createDiskExposureCache(directory);
      // The cache names the code its sets belong to: wash() makes it part of every key and
      // records it in the provenance of the result.
      expect(cache.source).toBe(loadedExposureSource());
      expect(cache.source).toMatch(/^[0-9a-f]{64}$/);
      expect(cache.source).toBe(exposureFingerprint());
      // A set left under the same key by a build with other exposure sources lies elsewhere.
      const other = join(directory, 'src-0123456789abcdef');
      mkdirSync(other, { recursive: true });
      await cache.put('sha256:cc', Uint8Array.of(7));
      const [file] = readdirSync(join(directory, `src-${loadedExposureSource().slice(0, 16)}`));
      writeFileSync(
        join(other, 'sha256_dd.spxe'),
        readFileSync(join(directory, `src-${loadedExposureSource().slice(0, 16)}`, file as string)),
      );
      expect(await cache.get('sha256:cc')).toEqual(Uint8Array.of(7));
      expect(await cache.get('sha256:dd')).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('the fingerprints of the source', () => {
  it('follow the files of their scope, and nothing else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spotless-fingerprint-'));
    const write = (path: string, text: string): void => {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    };
    try {
      write('sim-jets/src/jets.ts', 'export const a = 1;\n');
      write('sim-jets/src/jets.test.ts', 'a test\n');
      write('sim-jets/src/testing/fixtures.ts', 'a fixture\n');
      write('sim-soil/src/soil.ts', 'export const rate = 1;\n');
      write('sim-core/src/wash.ts', 'the replay and the result\n');
      write('sim-core/src/scene-setup.ts', 'the scene set-up\n');
      write('machine/src/data/bosch.ts', 'export const dose = 20;\n');
      const exposure = exposureFingerprint(dir);
      const whole = simulationFingerprint(dir);
      expect(exposure).toMatch(/^[0-9a-f]{64}$/);
      expect(sourceFingerprint(EXPOSURE_SOURCE_SCOPE, dir).files).toBe(2);
      // The soil side, the replay, the machine data, tests and fixtures: none of them is a
      // source of the exposure. All but the tests are sources of a wash result.
      write('sim-soil/src/soil.ts', 'export const rate = 2;\n');
      write('sim-core/src/wash.ts', 'another result\n');
      write('machine/src/data/bosch.ts', 'export const dose = 12.9;\n');
      write('sim-jets/src/jets.test.ts', 'another test\n');
      write('sim-jets/src/testing/fixtures.ts', 'another fixture\n');
      expect(exposureFingerprint(dir)).toBe(exposure);
      const afterSoil = simulationFingerprint(dir);
      expect(afterSoil).not.toBe(whole);
      // The water code and the scene set-up are.
      write('sim-jets/src/jets.ts', 'export const a = 2;\n');
      const afterJets = exposureFingerprint(dir);
      expect(afterJets).not.toBe(exposure);
      write('sim-core/src/scene-setup.ts', 'another scene set-up\n');
      expect(exposureFingerprint(dir)).not.toBe(afterJets);
      expect(simulationFingerprint(dir)).not.toBe(afterSoil);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('are those of this workspace when no directory is named', () => {
    expect(exposureFingerprint()).toMatch(/^[0-9a-f]{64}$/);
    expect(simulationFingerprint()).not.toBe(exposureFingerprint());
    expect(sourceFingerprint(EXPOSURE_SOURCE_SCOPE).files).toBeGreaterThan(100);
  });
});

describe('a result as JSON', () => {
  it('turns typed arrays into lists and thins the liquor trace', () => {
    const fields = [...LIQUOR_FIELDS];
    const ticks = 600;
    const values = new Float64Array(ticks * fields.length);
    const tickTime = new Float64Array(ticks);
    for (let i = 0; i < ticks; i++) {
      tickTime[i] = 1.5 * i;
      values[i * fields.length] = 1.5 * i;
    }
    const result = {
      items: [],
      machine: { liquor: { fields, tickTime_s: tickTime, values } },
    } as unknown as WashResult;
    const json = washResultToJson(result) as {
      machine: { liquor: { tickTime_s: number[]; values: number[][] } };
    };
    // 900 s of ticks at one row a minute: 15 rows, plus the last tick.
    expect(json.machine.liquor.tickTime_s).toHaveLength(16);
    expect(json.machine.liquor.tickTime_s[1]).toBe(60);
    expect(json.machine.liquor.values[1]?.[0]).toBe(60);
    expect(json.machine.liquor.values[0]).toHaveLength(fields.length);
    const all = washResultToJson(result, { traceInterval: 0 }) as typeof json;
    expect(all.machine.liquor.tickTime_s).toHaveLength(ticks);
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});
