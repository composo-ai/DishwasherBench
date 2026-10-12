import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { instantiate } from '@spotless/catalogue';
import { poseTransformPoint, type Quat } from '@spotless/core';
import { buildMachineGeometry, findMachine } from '@spotless/machine';
import type { LoadCheck, WashManifest } from '@spotless/session';
import { createSession } from '@spotless/session';
import { createWashParams } from '@spotless/sim-core';
import { anchoredOnNow } from '@spotless/sim-core/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MACHINE_WASH_DEFAULTS,
  washParamFilesFor,
  washParamsFingerprint,
  washParamsIdentity,
} from './defaults.ts';
import {
  manifestItemsOf,
  poseDisagreement,
  simSeedOf,
  stalledArmsOf,
  washInputOf,
  WashManifestError,
  withWashParams,
} from './input.ts';
import { StaleParamSetError } from './sim.ts';
import { tierOf } from './runner.ts';
import { manifestOf, TILTED_LOAD, tutorialLevel } from './test-util.ts';

let manifest: WashManifest;

beforeAll(async () => {
  manifest = await manifestOf(tutorialLevel(), TILTED_LOAD);
});

/** A mechanical check in which nothing is blocked. */
function freeCheck(): LoadCheck {
  return {
    shifted: [],
    fell_out: [],
    on_tub_floor: [],
    protruding: [],
    racks: [],
    spray_arms: [
      { arm: 'lower_arm', full_rotation: true },
      { arm: 'upper_arm', full_rotation: true },
    ],
    door_closes: true,
    door_blocked_by: [],
    dispenser_opens: true,
    dispenser_blocked_by: [],
    tablet_path_clear: true,
    tablet_blocked_by: [],
  };
}

describe('manifest to simulation input', () => {
  it('hands over machine, configuration, programme, items, soils and seeds', () => {
    const input = washInputOf(manifest, { tier: 'fast' });
    expect(input.machine.id).toBe(manifest.machine_id);
    expect(input.config).toEqual(manifest.machine_config);
    expect(input.programme.id).toBe(manifest.programme_id);
    expect(input.tier).toBe('fast');
    expect(input.items.map((item) => item.itemId)).toEqual(['bowl_01', 'mug_01']);
    expect(input.items.map((item) => item.typeId)).toEqual(
      manifest.items.map((item) => item.item_type),
    );
    // Soils: the level's grams, hours and heat history under the simulation's names.
    const bowl = manifest.items[0]?.soils[0];
    expect(input.items[0]?.soils).toEqual([
      {
        type: 'yoghurt',
        regions: [{ region: 'interior', coverage: 0.4 }],
        amount_g: bowl?.amountG,
        age_h: bowl?.ageH,
        heat_history: bowl?.heatHistory,
      },
    ]);
    expect(bowl?.amountG).toBeGreaterThan(0);
    // One hidden number per level gives both seeds, and they are not the same stream.
    expect(input.levelSeed).toBe(manifest.seed);
    expect(input.simSeed).toBe(simSeedOf(manifest.seed));
    expect(input.simSeed).not.toBe(input.levelSeed);
    expect(washInputOf(manifest, { tier: 'official', simSeed: 99 }).simSeed).toBe(99);
    expect(washInputOf(manifest, { tier: 'official' }).tier).toBe('official');
    // Nothing was blocked in this load.
    expect(input.stalledArms).toBeUndefined();
    expect(input.dispenserBlocked).toBeUndefined();
  });

  it('hands the settled poses over exactly: item frame to tub frame, metres, [x, y, z, w]', () => {
    const input = washInputOf(manifest, { tier: 'fast' });
    manifest.items.forEach((item, i) => {
      const pose = input.items[i]?.pose;
      // Bit for bit: no rounding, no unit conversion, no reordering.
      expect(pose?.p).toEqual(item.pose.p);
      expect(pose?.q).toEqual(item.pose.q);
      // Metres in the tub: inside the machine, not hundreds of anything.
      expect(Math.hypot(...(pose?.p ?? [9, 9, 9]))).toBeLessThan(1);
      // A unit quaternion that is not the identity: both items came to rest tilted.
      const q = pose?.q ?? [0, 0, 0, 1];
      expect(Math.hypot(...q)).toBeCloseTo(1, 6);
      expect(Math.abs(q[3])).toBeLessThan(0.95);
    });
    // The same load as the player was shown it: the reference point of every item, carried
    // through the pose of the input, is where the load manifest says, and the orientation is
    // the load manifest's quat_wxyz read as (w, x, y, z).
    expect(poseDisagreement(manifest, input)).toEqual([]);
    for (const item of input.items) {
      const wire = manifest.load.items.find((entry) => entry.item_id === item.itemId);
      const reference = poseTransformPoint(item.pose, instantiate(item.typeId).referencePoint);
      for (let axis = 0; axis < 3; axis++) {
        expect((reference[axis] as number) * 1000).toBeCloseTo(wire?.position_mm[axis] ?? NaN, 1);
      }
      const [w, x, y, z] = wire?.quat_wxyz ?? [0, 0, 0, 0];
      const sign = Math.sign(item.pose.q[3]) || 1;
      expect(item.pose.q[0] * sign).toBeCloseTo(x, 4);
      expect(item.pose.q[1] * sign).toBeCloseTo(y, 4);
      expect(item.pose.q[2] * sign).toBeCloseTo(z, 4);
      expect(item.pose.q[3] * sign).toBeCloseTo(w, 4);
    }
  });

  it('survives the way back: items, poses and soils come out as they went in', () => {
    const input = washInputOf(manifest, { tier: 'fast' });
    const points = new Map(manifest.items.map((item) => [item.item_id, item.points]));
    const back = manifestItemsOf(input, (id) => points.get(id) ?? 0);
    // The wording of a soil for the level card is the one thing the simulation is not given.
    const stripped = manifest.items.map((item) => ({
      ...item,
      soils: item.soils.map(({ description: _description, ...soil }) => soil),
    }));
    expect(back).toEqual(stripped);
    // And once more round: the mapping is its own inverse on what it carries.
    const again = washInputOf(
      { ...manifest, items: back },
      { tier: 'fast', simSeed: input.simSeed },
    );
    expect(again.items).toEqual(input.items);
  });

  it('notices a quaternion convention that slipped, a wrong unit and a wrong reference', () => {
    const input = washInputOf(manifest, { tier: 'fast' });
    const reordered = {
      items: input.items.map((item) => {
        // (w, x, y, z) read as (x, y, z, w): the mistake of taking the wire order for the core's.
        const [x, y, z, w] = item.pose.q;
        return { ...item, pose: { p: item.pose.p, q: [w, x, y, z] as Quat } };
      }),
    };
    const off = poseDisagreement(manifest, reordered);
    expect(off.map((entry) => entry.item_id)).toEqual(['bowl_01', 'mug_01']);
    for (const entry of off) expect(entry.angle_deg).toBeGreaterThan(5);

    const conjugated = {
      items: input.items.map((item) => {
        // Tub frame to item frame instead of item frame to tub frame.
        const [x, y, z, w] = item.pose.q;
        return { ...item, pose: { p: item.pose.p, q: [-x, -y, -z, w] as Quat } };
      }),
    };
    expect(poseDisagreement(manifest, conjugated)).toHaveLength(2);

    const millimetres = {
      items: input.items.map((item) => ({
        ...item,
        pose: {
          p: [item.pose.p[0] * 1000, item.pose.p[1] * 1000, item.pose.p[2] * 1000] as const,
          q: item.pose.q,
        },
      })),
    };
    expect(poseDisagreement(manifest, millimetres)).toHaveLength(2);

    // The load manifest's position is the item's reference point, not the origin of its frame:
    // taking one for the other moves a tall item by centimetres.
    const fromWire = {
      items: input.items.map((item) => {
        const wire = manifest.load.items.find((entry) => entry.item_id === item.itemId);
        const p = wire?.position_mm ?? [0, 0, 0];
        return {
          ...item,
          pose: { p: [p[0] / 1000, p[1] / 1000, p[2] / 1000] as const, q: item.pose.q },
        };
      }),
    };
    const moved = poseDisagreement(manifest, fromWire);
    expect(moved.length).toBeGreaterThan(0);
    expect(Math.max(...moved.map((entry) => entry.position_mm))).toBeGreaterThan(10);

    // An item of the input that the load manifest does not have is a disagreement too.
    const first = input.items[0];
    if (first === undefined) throw new Error('no items');
    expect(poseDisagreement(manifest, { items: [{ ...first, itemId: 'stranger' }] })).toEqual([
      { item_id: 'stranger', position_mm: Infinity, angle_deg: Infinity },
    ]);
  });

  it('passes on what the session found mechanically: a held arm, a blocked dispenser', () => {
    const machine = findMachine(manifest.machine_id);
    if (machine === undefined) throw new Error('no machine');
    const arms = buildMachineGeometry(machine, manifest.machine_config).parts.flatMap((part) =>
      part.arm === undefined ? [] : [{ part: part.id, ...part.arm }],
    );
    const lower = arms.find((arm) => arm.part === 'lower_arm');
    const upper = arms.find((arm) => arm.part === 'upper_arm');
    if (lower === undefined || upper === undefined) throw new Error('the machine has two arms');

    const held: LoadCheck = {
      ...freeCheck(),
      spray_arms: [
        {
          arm: 'lower_arm',
          full_rotation: false,
          first_contact_angle_deg: 62.3,
          blocked_by: 'ladle_01',
        },
        { arm: 'upper_arm', full_rotation: true },
      ],
    };
    // The simulation names the spray level, and wants the angle of the arm in the tub frame:
    // the angle it turned through, in the sense it turns.
    const stalled = stalledArmsOf(manifest, held);
    expect(Object.keys(stalled)).toEqual([lower.levelId]);
    expect(stalled[lower.levelId]).toBeCloseTo((lower.senseSign * 62.3 * Math.PI) / 180, 12);
    expect(lower.levelId).not.toBe('lower_arm');
    const input = washInputOf({ ...manifest, prechecks: held }, { tier: 'fast' });
    expect(input.stalledArms).toEqual(stalled);
    expect(input.dispenserBlocked).toBeUndefined();

    // Both arms, each with its own sense of rotation.
    const both = stalledArmsOf(manifest, {
      spray_arms: [
        { arm: 'lower_arm', full_rotation: false, first_contact_angle_deg: 10 },
        { arm: 'upper_arm', full_rotation: false, first_contact_angle_deg: 10 },
      ],
    });
    expect(both[upper.levelId]).toBeCloseTo((upper.senseSign * 10 * Math.PI) / 180, 12);
    expect(Object.keys(both).sort()).toEqual([lower.levelId, upper.levelId].sort());

    // A lid that cannot open and a tablet that cannot fall are the same thing to the wash.
    for (const blocked of [
      { ...freeCheck(), dispenser_opens: false, dispenser_blocked_by: ['pan_01'] },
      { ...freeCheck(), tablet_path_clear: false, tablet_blocked_by: ['plate_01'] },
    ]) {
      const blockedInput = washInputOf({ ...manifest, prechecks: blocked }, { tier: 'fast' });
      expect(blockedInput.dispenserBlocked).toBe(true);
      expect(blockedInput.stalledArms).toBeUndefined();
    }
    // A manifest from before the session passed its findings on blocks nothing.
    const { prechecks: _prechecks, ...older } = manifest;
    const olderInput = washInputOf(older, { tier: 'fast' });
    expect(olderInput.stalledArms).toBeUndefined();
    expect(olderInput.dispenserBlocked).toBeUndefined();
    // The session's own manifest carries the findings.
    expect(manifest.prechecks?.spray_arms.map((arm) => arm.arm)).toEqual([
      'lower_arm',
      'upper_arm',
    ]);

    expect(() =>
      stalledArmsOf(manifest, { spray_arms: [{ arm: 'third_arm', full_rotation: false }] }),
    ).toThrow(WashManifestError);
  });

  it('gets from the session exactly what start_cycle found', async () => {
    let handed: WashManifest | null = null;
    const session = await createSession({
      level: tutorialLevel(),
      washRunner: (given) => {
        handed = given;
        return new Promise(() => undefined);
      },
    });
    try {
      for (const request of TILTED_LOAD) session.place(request);
      const started = session.startCycle();
      if (!started.accepted) throw new Error('start_cycle was rejected');
      await new Promise<void>((next) => setImmediate(next));
      const given = handed as WashManifest | null;
      // The findings the player was told are the findings the wash is given.
      expect(given?.prechecks).toEqual(started.prechecks);
      expect(given?.load).toEqual(started.load);
      expect(session.washManifest()?.prechecks).toEqual(started.prechecks);
    } finally {
      session.dispose();
    }
  });

  it('refuses a manifest it cannot wash, with the cause', () => {
    expect(() =>
      washInputOf({ ...manifest, machine_id: 'no_such_machine' }, { tier: 'fast' }),
    ).toThrow(/unknown machine 'no_such_machine'/);
    expect(() => washInputOf({ ...manifest, programme_id: 'no_such' }, { tier: 'fast' })).toThrow(
      /has no programme 'no_such'/,
    );
  });

  it('washes at the tier the level names, else the one asked for, else official', () => {
    expect(tierOf(manifest)).toBe('official');
    expect(tierOf(manifest, 'official')).toBe('official');
    const ruled: WashManifest = {
      ...manifest,
      level: {
        ...manifest.level,
        rules: { ...manifest.level.rules, washTier: 'official' } as never,
      },
    };
    expect(tierOf(ruled, 'fast')).toBe('official');
    const nonsense: WashManifest = {
      ...manifest,
      level: { ...manifest.level, rules: { ...manifest.level.rules, washTier: 'best' } as never },
    };
    expect(tierOf(nonsense, 'fast')).toBe('fast');
  });
});

describe('the parameters and the detergent of a wash', () => {
  const dir = mkdtempSync(join(tmpdir(), 'spotless-wash-params-'));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  /** Writes a parameter set against the current registry, optionally with a stale hash. */
  const setFile = (name: string, overrides: Record<string, number>, stale = false): string => {
    const json = JSON.parse(
      JSON.stringify(createWashParams(overrides, { name, origin: 'calibration' }).toJSON()),
    ) as Record<string, unknown>;
    // A calibrated set records the water side it was fitted on.
    json['anchoredOn'] = anchoredOnNow();
    if (stale) json['hydroHash'] = `sha256:${'0'.repeat(64)}`;
    const path = join(dir, `${name}.json`);
    writeFileSync(path, JSON.stringify(json));
    return path;
  };
  let plain: ReturnType<typeof washInputOf>;
  beforeAll(() => {
    plain = washInputOf(manifest, { tier: 'fast' });
  });

  it("names a default for the owner's machine: an anchored set with the owner's capsule and its dose", () => {
    const files = washParamFilesFor('bosch_smv4hax40g');
    expect(files?.paramSets).toHaveLength(1);
    expect(files?.paramSets[0]).toMatch(/packages\/calibration\/anchors\/anchored-.*\.json$/);
    expect(files?.detergent).toMatchObject({ dose_g: 12.9 });
    // The file is there, is a calibrated set of that name, and says which water side it was
    // fitted on (whether that is the one on disk is the wash's to check when it reads it).
    const document = JSON.parse(readFileSync(files?.paramSets[0] as string, 'utf8')) as {
      provenance?: { name?: string; origin?: string };
      anchoredOn?: { simVersion?: string; exposureSource?: string };
    };
    expect(files?.paramSets[0]).toContain(`${String(document.provenance?.name)}.json`);
    expect(document.provenance?.origin).toBe('calibration');
    expect(document.anchoredOn?.simVersion).toMatch(/^spotless-sim /);
    expect(document.anchoredOn?.exposureSource).toMatch(/^[0-9a-f]{64}$/);
    // A machine without a default, and the registry defaults when asked for: no files.
    expect(washParamFilesFor('some_other_machine')).toBeNull();
    expect(washParamFilesFor('bosch_smv4hax40g', 'registry-defaults')).toBeNull();
    expect(MACHINE_WASH_DEFAULTS['bosch_smv4hax40g']).toBeDefined();
  });

  it("washes the owner's machine out of the box: its default set is current for the code on disk", () => {
    // The default wash must not need a flag. When this fails, the water side changed after
    // the set was fitted: if what a wash computes is unchanged, run
    //   cd packages/calibration && pnpm exec tsx anchors/scripts/revalidate.ts
    // (one fast wash; it re-stamps the set when the reference result is the recorded one);
    // otherwise fit the set again (anchors/scripts/fit.ts, then make-owner-set.ts).
    let failure = '';
    let input: ReturnType<typeof withWashParams> | undefined;
    try {
      input = withWashParams(plain, 'machine-default');
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    expect(failure).toBe('');
    expect(input?.paramSets?.map((set) => set.stale)).toEqual([false]);
    expect(input?.detergent).toEqual({ name: 'Finish Powerball Ultimate', dose: 0.0129 });
  });

  it('lays named sets and a detergent over the registry defaults, with the dose', () => {
    const anchored = setFile('anchored-t', { 'soil.egg_yolk.rateRef': 3.4e-5 });
    const input = withWashParams(plain, {
      paramSets: [anchored],
      detergent: { name: 'Capsule', dose_g: 12.9 },
    });
    expect(input.params).toEqual({ 'soil.egg_yolk.rateRef': 3.4e-5 });
    expect(input.paramSets?.map((set) => [set.name, set.role, set.stale])).toEqual([
      ['anchored-t', 'set', false],
    ]);
    expect(input.detergent).toEqual({ name: 'Capsule', dose: 0.0129 });
    // Everything else of the input is untouched.
    expect(input.items).toBe(plain.items);
    expect(input.machine).toBe(plain.machine);
    // The registry defaults: the input as it is.
    expect(withWashParams(plain, 'registry-defaults')).toBe(plain);
  });

  it('fails loudly on a stale set, and takes it when that is accepted', () => {
    const stale = setFile('anchored-old', { 'soil.egg_yolk.rateRef': 3.4e-5 }, true);
    expect(() => withWashParams(plain, { paramSets: [stale] })).toThrow(StaleParamSetError);
    expect(() => withWashParams(plain, { paramSets: [stale] })).toThrow(
      /anchored-old[\s\S]*hydroHash[\s\S]*What to do[\s\S]*--accept-stale-params/,
    );
    const accepted = withWashParams(plain, { paramSets: [stale] }, true);
    expect(accepted.paramSets?.[0]).toMatchObject({ name: 'anchored-old', stale: true });
    // A set that is missing says where the game's default is named.
    expect(() => withWashParams(plain, { paramSets: [join(dir, 'gone.json')] })).toThrow(
      /cannot be read/,
    );
  });

  it('identifies the parameters of a wash by the bytes of the files, for a store of results', () => {
    const file = setFile('anchored-id', { 'soil.egg_yolk.rateRef': 3.4e-5 });
    const choice = { paramSets: [file], detergent: { name: 'Capsule', dose_g: 12.9 } };
    const first = JSON.stringify(washParamsIdentity('bosch_smv4hax40g', choice, false));
    expect(JSON.stringify(washParamsIdentity('bosch_smv4hax40g', choice, false))).toBe(first);
    // Another dose, accepting stale sets, or the same name with other contents: another wash.
    expect(
      JSON.stringify(
        washParamsIdentity(
          'bosch_smv4hax40g',
          { ...choice, detergent: { name: 'Capsule', dose_g: 20 } },
          false,
        ),
      ),
    ).not.toBe(first);
    expect(JSON.stringify(washParamsIdentity('bosch_smv4hax40g', choice, true))).not.toBe(first);
    setFile('anchored-id', { 'soil.egg_yolk.rateRef': 3.5e-5 });
    expect(JSON.stringify(washParamsIdentity('bosch_smv4hax40g', choice, false))).not.toBe(first);
    expect(washParamsIdentity('bosch_smv4hax40g', 'registry-defaults', false)).toEqual({
      sets: [],
      detergent: null,
      acceptStale: false,
    });
  });

  it('gives one fingerprint of a choice of parameters whatever the machine, which follows the bytes of the files', () => {
    const file = setFile('anchored-fp', { 'soil.egg_yolk.rateRef': 3.4e-5 });
    const choice = { paramSets: [file], detergent: { name: 'Capsule', dose_g: 12.9 } };
    const first = washParamsFingerprint(choice, false);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
    expect(washParamsFingerprint(choice, false)).toBe(first);
    expect(washParamsFingerprint(choice, true)).not.toBe(first);
    expect(washParamsFingerprint('registry-defaults', false)).not.toBe(first);
    // Leaving the choice out is the machines' defaults.
    expect(washParamsFingerprint(undefined, false)).toBe(
      washParamsFingerprint('machine-default', false),
    );
    expect(washParamsFingerprint('machine-default', false)).not.toBe(
      washParamsFingerprint('registry-defaults', false),
    );
    setFile('anchored-fp', { 'soil.egg_yolk.rateRef': 3.5e-5 });
    expect(washParamsFingerprint(choice, false)).not.toBe(first);
  });
});
