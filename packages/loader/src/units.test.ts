import { instantiate } from '@spotless/catalogue';
import type { Level } from '@spotless/levels';
import { allLevels, capacityEstimate, findLevel, validateLevel } from '@spotless/levels';
import { PRIMARY_MACHINE, buildMachineGeometry } from '@spotless/machine';
import type { LoadCheck, PlacedItemState } from '@spotless/session';
import { createSession } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { viewOf } from './families.ts';
import type { SettledLoad } from './mistakes.ts';
import {
  CARELESS_DEFAULT_MISTAKES,
  MACHINE_MISTAKE_KINDS,
  MISTAKE_KINDS,
  facesAway,
  hollowAttitude,
  mistakeHolds,
  mouthUpDeg,
} from './mistakes.ts';
import { lanesOf } from './placing.ts';
import { leanWithTines, postureFindings, vesselHeld } from './posture.ts';
import { Player, edgeOffsetsFor, makeRng } from './player.ts';
import { contactSheet, renderView } from './render.ts';
import { halfIecLevel, iecLevel } from './standard-levels.ts';
import { referenceItems, referenceSeed, standardLoadSpecs } from './standard-loads.ts';
import { tenItemLevel } from './test-level.ts';
import { verifyLoad } from './verify.ts';

describe('standard levels', () => {
  it('the IEC load has 13 place settings and ten serving pieces: 140 items', () => {
    const level = iecLevel();
    expect(validateLevel(level)).toEqual([]);
    expect(level.items.length).toBe(140);
    const count = (prefix: string): number =>
      level.items.filter((item) => item.id.startsWith(prefix)).length;
    // Class totals of docs/research/standards.md section 5.1 for 13 place settings.
    const crockery =
      count('dinner_plate') +
      count('soup_plate') +
      count('dessert_plate') +
      count('mug_') +
      count('cup_') +
      count('saucer') +
      count('oval_platter');
    expect(crockery).toBe(40);
    expect(count('glass_') + count('dessert_bowl')).toBe(21);
    expect(count('melamine')).toBe(8);
    expect(count('small_pot') + count('oven_pot')).toBe(2);
    const cutlery =
      count('fork') +
      count('knife') +
      count('soup_spoon') +
      count('dessert_spoon') +
      count('teaspoon') +
      count('serving_') +
      count('gravy_ladle');
    expect(cutlery).toBe(69);
    // The first ten items are one whole place setting.
    expect(level.items.slice(0, 10).filter((item) => item.id.endsWith('_01')).length).toBe(10);
    // Every soiled piece carries an IEC soil.
    for (const item of level.items) {
      for (const soil of item.soils) expect(soil.type.startsWith('iec_')).toBe(true);
    }
    // About what the machine is rated for by the levels' own measure.
    expect(capacityEstimate(level).ratio).toBeGreaterThan(0.9);
  });

  it('the half load and the family load are valid levels', () => {
    const half = halfIecLevel();
    expect(validateLevel(half)).toEqual([]);
    expect(half.items.length).toBe(65);
    // The everyday family load is a starter level of the game now.
    const family = findLevel('mixed-family') as Level;
    expect(validateLevel(family)).toEqual([]);
    for (const wanted of [
      'plate',
      'cereal_bowl',
      'mug',
      'glass',
      'frying_pan',
      'chopping_board',
      'food_container',
      'baby_bottle',
      'fork',
    ]) {
      expect(family.items.some((item) => item.id.startsWith(wanted))).toBe(true);
    }
  });

  it('the standard loads cover every level of the game with every policy', () => {
    const specs = standardLoadSpecs();
    const names = specs.map((spec) => spec.name);
    expect(new Set(names).size).toBe(names.length);
    // Three loads of the IEC levels, the owner's own load, and every level of the game (the
    // seven levels of the course) with every policy.
    expect(names.length).toBe(3 + 1 + 7 * 3);
    for (const name of [
      'iec-13-careful',
      'iec-13-careless',
      'half-careful',
      'owner-2026-10-10',
      'tutorial-random',
      'mixed-family-careful',
      'mixed-family-careless',
      'dinner-party-careful',
      'lunch-for-four-careless',
      'baking-day-random',
    ]) {
      expect(names).toContain(name);
    }
    // A reference load is played with the level's own seed and its items in its own order:
    // what the benchmark harness plays with its default seed.
    for (const level of allLevels()) {
      for (const policy of ['careful', 'careless', 'random']) {
        const spec = specs.find((candidate) => candidate.name === `${level.id}-${policy}`);
        expect(spec?.seed, spec?.name).toBe(referenceSeed(level, 1));
        expect(spec?.seed).toBe(level.seed);
      }
      expect(referenceItems(level)).toEqual(level.items.map((item) => item.id));
    }
    expect(referenceSeed({ seed: 0xffffffff }, 2)).toBe(0);
    expect(referenceSeed({ seed: 41 }, 3)).toBe(43);
  });

  it('the careless policy makes the mistakes of the hand unless told otherwise', () => {
    expect(MACHINE_MISTAKE_KINDS).toEqual(['tablet_tray_blocked', 'tall_item_under_arm']);
    expect(CARELESS_DEFAULT_MISTAKES).toEqual(
      MISTAKE_KINDS.filter((kind) => !MACHINE_MISTAKE_KINDS.includes(kind)),
    );
    expect(CARELESS_DEFAULT_MISTAKES).toHaveLength(MISTAKE_KINDS.length - 2);
    for (const kind of [
      'bowls_nested',
      'cup_upright',
      'cup_on_side',
      'item_over_others',
      'spoons_nested',
      // Cutlery of a kind stood together in one cell: a mistake of the hand since 2026-10-11.
      'cutlery_bunched',
    ]) {
      expect(CARELESS_DEFAULT_MISTAKES).toContain(kind);
    }
    // The IEC careless load, which the anchoring washes with the tablet's path blocked, keeps
    // every kind whatever the default is; the reference loads of the game take the default.
    const specs = standardLoadSpecs();
    expect(specs.find((spec) => spec.name === 'iec-13-careless')?.mistakes).toEqual(MISTAKE_KINDS);
    expect(specs.find((spec) => spec.name === 'tutorial-careless')?.mistakes).toBeUndefined();
  });

  it("the owner's load is a valid level whose every stand-in is accounted for", async () => {
    const { ownerLoadLevel, OWNER_LOAD_STAND_INS } = await import('./standard-levels.ts');
    const level = ownerLoadLevel();
    expect(validateLevel(level)).toEqual([]);
    expect(level.items.length).toBe(33);
    // Every item of the level is named in the list of what stands in for the owner's ware.
    const named = Object.keys(OWNER_LOAD_STAND_INS).join(', ');
    for (const item of level.items) {
      const prefix = item.id.replace(/_\d+$/, '');
      expect(named, item.id).toContain(prefix);
    }
  });
});

describe('what a policy sees', () => {
  it('reads families from the level card and lanes from list_slots', async () => {
    const session = await createSession({ level: iecLevel() });
    try {
      const player = new Player(session);
      const family = (id: string): string => viewOf(player.item(id)).family;
      expect(family('dinner_plate_01')).toBe('flat');
      expect(family('saucer_01')).toBe('flat');
      expect(family('dessert_bowl_01')).toBe('bowl');
      expect(family('glass_01')).toBe('vessel');
      expect(family('mug_01')).toBe('vessel');
      expect(family('small_pot_01')).toBe('cookware');
      expect(family('fork_01')).toBe('cutlery');
      expect(family('gravy_ladle_01')).toBe('utensil');
      expect(viewOf(player.item('knife_01')).knife).toBe(true);
      expect(viewOf(player.item('soup_spoon_01')).spoon).toBe(true);

      const lanes = lanesOf(player, 'lower_rack');
      // The rear pair and the two front pairs of the Bosch's lower basket.
      expect(lanes.length).toBe(3);
      const rear = lanes.find((lane) => lane.centreAcross > 300);
      expect(rear?.railAxis).toBe(0);
      expect(rear?.spacing).toBeCloseTo(99, 0);
      // Tines lean outwards on both sides of the middle.
      expect(rear?.slots[0]?.leanSign).toBe(-1);
      expect(rear?.slots[rear.slots.length - 1]?.leanSign).toBe(1);
      expect(rear?.slots.some((slot) => slot.wide)).toBe(true);
    } finally {
      session.dispose();
    }
  });

  it('edge offsets turn the face of an on-edge preset to the wanted normal', () => {
    expect(edgeOffsetsFor([1, 0, 0])).toEqual({ roll_deg: 0, yaw_deg: 90 });
    expect(edgeOffsetsFor([-1, 0, 0])).toEqual({ roll_deg: 0, yaw_deg: -90 });
    expect(edgeOffsetsFor([0, 1, 0])).toEqual({ roll_deg: 0, yaw_deg: 180 });
    const tipped = edgeOffsetsFor([Math.cos(0.2618), 0, Math.sin(0.2618)]);
    expect(tipped).toEqual({ roll_deg: -15, yaw_deg: 90 });
  });

  it('the random stream depends only on seed, stream and count', () => {
    const a = makeRng(5, 1);
    const b = makeRng(5, 1);
    const c = makeRng(6, 1);
    const drawsA = Array.from({ length: 20 }, () => a.next());
    const drawsB = Array.from({ length: 20 }, () => b.next());
    const drawsC = Array.from({ length: 20 }, () => c.next());
    expect(drawsB).toEqual(drawsA);
    expect(drawsC).not.toEqual(drawsA);
    expect(drawsA.every((u) => u >= 0 && u < 1)).toBe(true);
    expect(makeRng(1, 1).shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('verifyLoad', () => {
  const config = PRIMARY_MACHINE.defaultConfig;
  const emptyState = {
    state_hash: '',
    phase: 'loading' as const,
    racks: {},
    rack_options: {},
    placed: [],
    unplaced: [],
    budget: {
      actions_max: 0,
      queries_max: 0,
      washes_max: 0,
      actions_used: 0,
      queries_used: 0,
      washes_used: 0,
    },
  };

  it('finds two items in the same place and an item outside every basket', async () => {
    const numbers = await verifyLoad(
      {
        machine_id: PRIMARY_MACHINE.id,
        machine_config: config,
        items: [
          {
            item_id: 'a',
            item_type: 'tumbler_250',
            pose: { p: [0.136, 0, 0.535], q: [0, 0, 0, 1] },
          },
          {
            item_id: 'b',
            item_type: 'tumbler_250',
            pose: { p: [0.136, 0.01, 0.535], q: [0, 0, 0, 1] },
          },
          { item_id: 'c', item_type: 'tumbler_250', pose: { p: [0, -1.2, 0.3], q: [0, 0, 0, 1] } },
        ],
      },
      emptyState,
      null,
    );
    expect(numbers.overlaps.length).toBe(1);
    expect(numbers.overlaps[0]?.a).toBe('a');
    expect(numbers.overlaps[0]?.b).toBe('b');
    expect(numbers.deepest_overlap_mm).toBeGreaterThan(5);
    expect(numbers.not_in_a_basket).toEqual(['c']);
    expect(numbers.check_passes).toBe(false);
  });

  it('measures the overlap of two glasses on their true shapes, which the collision pieces understate', async () => {
    // Hand calculation: two tumblers standing side by side at the same height, their axes
    // 0.7 mm less than one diameter apart, overlap by 0.7 mm where they are widest. The convex
    // pieces of the loading physics cut the round wall into flat facets inside the true
    // surface and report less (review of 2026-10-10: 0.14 mm where the shapes overlap 0.73).
    const radius = instantiate('tumbler_250').bbox.max[0];
    const numbers = await verifyLoad(
      {
        machine_id: PRIMARY_MACHINE.id,
        machine_config: config,
        items: [
          { item_id: 'a', item_type: 'tumbler_250', pose: { p: [0.1, 0, 0.535], q: [0, 0, 0, 1] } },
          {
            item_id: 'b',
            item_type: 'tumbler_250',
            pose: { p: [0.1 + 2 * radius - 0.0007, 0, 0.535], q: [0, 0, 0, 1] },
          },
        ],
      },
      emptyState,
      null,
    );
    expect(numbers.deepest_true_overlap_mm).toBeGreaterThan(0.6);
    expect(numbers.deepest_true_overlap_mm).toBeLessThanOrEqual(0.71);
    expect(numbers.true_overlaps.map((o) => [o.a, o.b])).toEqual([['a', 'b']]);
    expect(numbers.deepest_overlap_mm).toBeLessThanOrEqual(numbers.deepest_true_overlap_mm);
  });

  it('finds nothing wrong with an empty machine', async () => {
    const numbers = await verifyLoad(
      { machine_id: PRIMARY_MACHINE.id, machine_config: config, items: [] },
      emptyState,
      null,
    );
    expect(numbers.overlaps).toEqual([]);
    expect(numbers.out_of_basket).toEqual([]);
    expect(numbers.deepest_overlap_mm).toBe(0);
    expect(numbers.deepest_true_overlap_mm).toBe(0);
    expect(numbers.true_overlaps).toEqual([]);
  });
});

describe('pictures', () => {
  it('draws a body where it is and leaves the rest as background', () => {
    const shape = instantiate('dinner_plate_porcelain_270').shape;
    const raster = renderView(
      [{ id: 'plate', shape, pose: { p: [0, 0, 0], q: [0, 0, 0, 1] }, colour: [200, 40, 40] }],
      {
        name: 'top',
        right: [1, 0, 0],
        up: [0, 1, 0],
        bounds: { min: [-0.2, -0.2, 0], max: [0.2, 0.2, 0] },
        caption: '',
      },
      { widthPx: 80 },
    );
    expect(raster.width).toBe(80);
    expect(raster.height).toBe(80);
    const at = (x: number, y: number): number[] => [
      ...raster.rgba.subarray((y * 80 + x) * 4, (y * 80 + x) * 4 + 3),
    ];
    // Centre: the plate, reddish. Corner: background, near white.
    const centre = at(40, 40);
    expect(centre[0]).toBeGreaterThan((centre[1] as number) + 40);
    expect(at(2, 2).every((v) => v > 240)).toBe(true);
    // The plate is 270 mm of a 400 mm picture: about 54 pixels across.
    let across = 0;
    for (let x = 0; x < 80; x++) if ((at(x, 40)[1] as number) < 200) across += 1;
    expect(across).toBeGreaterThan(50);
    expect(across).toBeLessThan(58);
    const sheet = contactSheet([raster, raster, raster], 2, 10);
    expect(sheet.width).toBe(2 * 80 + 3 * 10);
    expect(sheet.height).toBe(2 * 80 + 3 * 10);
  });
});

describe('test level', () => {
  it('has ten items', () => {
    expect(tenItemLevel().items.length).toBe(10);
    expect(validateLevel(tenItemLevel())).toEqual([]);
  });
});

describe('a saved load as wash input', () => {
  it('carries every loaded item with its exact pose and its soils', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const { washDescriptionOf } = await import('./wash-export.ts');
    const file = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'loads',
      'tutorial-careful.json',
    );
    const load = JSON.parse(
      readFileSync(file, 'utf8'),
    ) as import('./standard-loads.ts').StandardLoad;
    const { description, notes } = washDescriptionOf(load, { tier: 'fast', simSeed: 3 });
    expect(description.machine).toBe('bosch_smv4hax40g');
    expect(description.programme).toBe(load.level.programmeId);
    expect(description.levelSeed).toBe(load.level.seed);
    expect(description.simSeed).toBe(3);
    expect(description.items.length).toBe(load.placed.length);
    expect(description.dispenserBlocked).toBe(false);
    expect(notes.stalledArms).toEqual({});
    // Shelves that the load was frozen with otherwise than the machine's default are named.
    const moved = load.wash_manifest.machine_config.shelves
      .filter((shelf) => (shelf.shelfId === 'knife_shelf') !== (shelf.state === 'down'))
      .map((shelf) => `${shelf.basketId}.${shelf.shelfId}: ${shelf.state}`);
    expect([...notes.shelvesMoved].sort()).toEqual(moved.sort());
    expect(notes.configDiffersBeyondHeights).toBe(moved.length > 0);
    // The whole configuration goes with the export: shelves, rows and the cutlery basket.
    expect(notes.machineConfig).toEqual(load.wash_manifest.machine_config);
    // The description itself carries the whole configuration, at top level, where the wash reads it.
    expect(description.machineConfig).toEqual(load.wash_manifest.machine_config);
    expect(notes.cutleryBasket).toBe('front_centre');
    for (const item of description.items) {
      const source = load.wash_manifest.items.find((i) => i.item_id === item.id);
      expect(source).toBeDefined();
      if (source === undefined) continue;
      expect(item.type).toBe(source.item_type);
      // Origin of the item frame in the tub frame, millimetres; quaternion (w, x, y, z).
      expect(item.position_mm[2] / 1000).toBeCloseTo(source.pose.p[2], 12);
      expect(item.quat_wxyz[0]).toBe(source.pose.q[3]);
      expect(Math.hypot(...item.quat_wxyz)).toBeCloseTo(1, 6);
      expect(item.soils.length).toBe(source.soils.length);
      for (const soil of item.soils) expect(soil.amount_g).toBeGreaterThan(0);
    }
    // The dinner plates of the tutorial carry tomato sauce on the well.
    const plate = description.items.find((i) => i.id === 'plate_01');
    expect(plate?.soils[0]?.type).toBe('tomato_sauce');
    expect(plate?.soils[0]?.regions[0]?.region).toBe('well');
  });
});

describe('mistakes are read from settled poses', () => {
  const pose = (
    quat: readonly [number, number, number, number],
    position: readonly [number, number, number] = [250, 250, 60],
    contacts: readonly string[] = [],
    frame = 'upper_rack',
  ): PlacedItemState =>
    ({
      item_id: 'x',
      frame,
      position_mm: position,
      quat_wxyz: quat,
      stable: true,
      contacts: contacts.map((id) => ({ with: id, points: 1 })),
      location: 'upper_rack',
    }) as unknown as PlacedItemState;
  const s = Math.SQRT1_2;
  const up = pose([1, 0, 0, 0]);
  const down = pose([0, 1, 0, 0]);
  const side = pose([s, s, 0, 0]);
  const load = (
    placed: { [id: string]: PlacedItemState },
    check: LoadCheck | null = null,
  ): SettledLoad => ({
    placed: new Map(Object.entries(placed)),
    views: new Map(),
    envelopes: new Map([
      ['upper_rack', [500, 498, 190]],
      ['lower_rack', [525, 512, 292]],
    ]),
    check,
  });

  it('tells mouth up, on its side and mouth down apart', () => {
    expect(mouthUpDeg(up)).toBeCloseTo(0, 6);
    expect(mouthUpDeg(down)).toBeCloseTo(180, 6);
    expect(mouthUpDeg(side)).toBeCloseTo(90, 6);
    expect(hollowAttitude(up)).toBe('mouth_up');
    expect(hollowAttitude(side)).toBe('on_side');
    expect(hollowAttitude(down)).toBe('mouth_down');
  });

  it('a cup recorded as standing mouth up holds only if it does', () => {
    const made = { kind: 'cup_upright', item_id: 'x', note: '' } as const;
    expect(mistakeHolds(made, load({ x: up }))).toBeNull();
    expect(mistakeHolds(made, load({ x: side }))).toMatch(/degrees from straight up/);
    expect(mistakeHolds(made, load({ x: down }))).not.toBeNull();
    expect(mistakeHolds({ ...made, kind: 'cup_on_side' }, load({ x: side }))).toBeNull();
    expect(mistakeHolds({ ...made, kind: 'cup_on_side' }, load({ x: up }))).not.toBeNull();
    expect(mistakeHolds({ ...made, kind: 'bowl_face_down_flat' }, load({ x: down }))).toBeNull();
    expect(
      mistakeHolds({ ...made, kind: 'bowl_face_down_flat' }, load({ x: side })),
    ).not.toBeNull();
    expect(mistakeHolds(made, load({}))).toBe('the item is not in the machine');
  });

  it('a nested bowl has to touch the bowl it is said to lie in', () => {
    const made = { kind: 'bowls_nested', item_id: 'x', note: '', with: 'y' } as const;
    expect(
      mistakeHolds(made, load({ x: pose([0, 1, 0, 0], [250, 250, 80], ['y']), y: down })),
    ).toBeNull();
    expect(mistakeHolds(made, load({ x: down, y: down }))).toBe('it does not touch y');
    expect(
      mistakeHolds(made, load({ x: pose([s, s, 0, 0], [250, 250, 80], ['y']), y: down })),
    ).toMatch(/degrees across y/);
    expect(mistakeHolds(made, load({ x: down }))).toBe('y is not in the machine');
  });

  it('a plate faces away when its face looks to the nearer wall', () => {
    // On edge, face along -x (the on_edge preset turned by a yaw of -90 degrees).
    const faceMinusX = pose([0.5, 0.5, -0.5, -0.5], [100, 370, 130], [], 'lower_rack');
    const faceFor = (p: PlacedItemState): boolean => facesAway(p, [525, 512, 292]);
    const left = faceFor(faceMinusX);
    const right = faceFor(pose([0.5, 0.5, -0.5, -0.5], [430, 370, 130], [], 'lower_rack'));
    // The same face is away from the centre on one side of the basket and towards it on the other.
    expect(left).not.toBe(right);
    expect(faceFor(pose([0.5, 0.5, -0.5, -0.5], [262, 370, 130], [], 'lower_rack'))).toBe(false);
    expect(faceFor(pose([1, 0, 0, 0], [100, 370, 130], [], 'lower_rack'))).toBe(false);
  });

  it('a blocked tablet and a stopped arm are read from the mechanical check', () => {
    const check = {
      spray_arms: [{ arm: 'upper_arm', full_rotation: false, blocked_by: 'x' }],
      tablet_blocked_by: ['x'],
      dispenser_blocked_by: [],
    } as unknown as LoadCheck;
    const free = {
      spray_arms: [{ arm: 'upper_arm', full_rotation: true }],
      tablet_blocked_by: [],
      dispenser_blocked_by: [],
    } as unknown as LoadCheck;
    const tablet = { kind: 'tablet_tray_blocked', item_id: 'x', note: '' } as const;
    const arm = { kind: 'tall_item_under_arm', item_id: 'x', note: '' } as const;
    expect(mistakeHolds(tablet, load({ x: up }, check))).toBeNull();
    expect(mistakeHolds(tablet, load({ x: up }, free))).not.toBeNull();
    expect(mistakeHolds(arm, load({ x: up }, check))).toBeNull();
    expect(mistakeHolds(arm, load({ x: up }, free))).not.toBeNull();
    expect(mistakeHolds(arm, load({ x: up }, null))).toBe('there is no mechanical check');
  });
});

describe('leanWithTines', () => {
  // A plate on edge in a slot whose tines lean 15 degrees towards -x. Laid back with them, its
  // top is towards -x: its axis, pointing away from the lean side (+x), points up by the lean.
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  it('is positive for a plate laid back with its tines, whichever way it faces', () => {
    const face: [number, number, number] = [Math.cos(rad(10)), 0, Math.sin(rad(10))];
    expect(leanWithTines(face, '-x')).toBeCloseTo(10, 6);
    expect(leanWithTines([-face[0], 0, -face[2]], '-x')).toBeCloseTo(10, 6);
  });
  it('is negative for a plate leaning against them, and mirrors with the row', () => {
    const face: [number, number, number] = [Math.cos(rad(16)), 0, -Math.sin(rad(16))];
    expect(leanWithTines(face, '-x')).toBeCloseTo(-16, 6);
    expect(leanWithTines([-face[0], 0, face[2]], '+x')).toBeCloseTo(-16, 6);
    expect(leanWithTines([0, face[0], face[2]], '-y')).toBeCloseTo(-16, 6);
  });
});

describe('a vessel that leans is held or not', () => {
  // The Bosch's upper basket (IMG_9131): the left rest falls 33.3 degrees towards the left
  // wall from the ridge at x = 91.7 mm, the right one 35.4 degrees from x = 387.8 mm.
  const geometry = buildMachineGeometry(PRIMARY_MACHINE);
  /** A vessel mouth down (item +z down), leaning `deg` with its base towards (dx, dy). */
  const leaning = (
    deg: number,
    toward: readonly [number, number],
    x: number,
    touches: readonly string[],
  ): PlacedItemState => {
    // Mouth down is a half turn about x; the lean is a further turn about the horizontal axis
    // at right angles to `toward`.
    const half = (deg * Math.PI) / 360;
    const axis: [number, number] = [-toward[1], toward[0]];
    // q = lean * flip, as (w, x, y, z); flip = (0, 1, 0, 0).
    const lean = [Math.cos(half), axis[0] * Math.sin(half), axis[1] * Math.sin(half), 0] as const;
    const quat: [number, number, number, number] = [-lean[1], lean[0], lean[3], -lean[2]];
    return {
      item_id: 'mug_01',
      frame: 'upper_rack',
      position_mm: [x, 300, 70],
      quat_wxyz: quat,
      stable: true,
      contacts: touches.map((name) => ({ with: name, points: 2 })),
    } as unknown as PlacedItemState;
  };
  const mug = new Map([
    [
      'mug_01',
      viewOf({
        item_id: 'mug_01',
        item_type: 'mug_ceramic_300',
        display_name: 'Mug',
        class: 'mug',
        bbox_mm: [110, 80, 100],
        mass_kg: 0.351,
        orientation_presets: [{ name: 'inverted' }, { name: 'upright' }],
        points: 1,
      } as unknown as Parameters<typeof viewOf>[0]),
    ],
  ]);
  const floor = ['upper_rack.floor.x', 'upper_rack.floor.y'];

  it('reads the lean of the constructed pose back', () => {
    expect(180 - mouthUpDeg(leaning(30, [-1, 0], 60, floor))).toBeCloseTo(30, 6);
    expect(180 - mouthUpDeg(leaning(0, [-1, 0], 60, floor))).toBeCloseTo(0, 6);
  });

  it('on a side rest, leaning towards its wall with the slope, it is held up to 45 degrees', () => {
    // On the left rest, leaning to the left wall: 33 degrees is how it is meant to stand.
    expect(vesselHeld(leaning(33, [-1, 0], 60, floor), [], geometry)).toBe(true);
    expect(postureFindings([leaning(33, [-1, 0], 60, floor)], mug, geometry)).toEqual([]);
    expect(postureFindings([leaning(40, [1, 0], 420, floor)], mug, geometry)).toEqual([]);
    // Lying on its side there, it is not.
    expect(postureFindings([leaning(50, [-1, 0], 60, floor)], mug, geometry)).toEqual([
      { item_id: 'mug_01', kind: 'vessel_leaning', deg: 50 },
    ]);
  });

  it('on a rest but leaning along it, or away from the wall, it is not held by the rest', () => {
    expect(vesselHeld(leaning(33, [0, 1], 60, floor), [], geometry)).toBe(false);
    expect(vesselHeld(leaning(33, [1, 0], 60, floor), [], geometry)).toBe(false);
    expect(postureFindings([leaning(33, [1, 0], 60, floor)], mug, geometry)).toEqual([
      { item_id: 'mug_01', kind: 'vessel_leaning', deg: 33 },
    ]);
  });

  it('in the middle of the basket the limit is 25 degrees with nothing to hold it', () => {
    // x = 250 mm is on the ramp between the ridges: no rest.
    expect(vesselHeld(leaning(33, [1, 0], 250, floor), [], geometry)).toBe(false);
    expect(postureFindings([leaning(24, [1, 0], 250, floor)], mug, geometry)).toEqual([]);
    expect(postureFindings([leaning(33, [1, 0], 250, floor)], mug, geometry)).toEqual([
      { item_id: 'mug_01', kind: 'vessel_leaning', deg: 33 },
    ]);
  });

  it('on a tine it is held wherever it stands; a folded cup shelf holds only what stands on the rest in front of it', () => {
    const shelf = [...floor, 'upper_rack_fittings.shelf.cup_rear'];
    expect(vesselHeld(leaning(33, [1, 0], 250, floor), ['c_rear'], geometry)).toBe(true);
    // On the right rest against the shelf, leaning 45 degrees off the way the rest falls:
    // the rest alone does not hold it (30 degrees), the shelf does.
    expect(vesselHeld(leaning(33, [Math.SQRT1_2, Math.SQRT1_2], 430, floor), [], geometry)).toBe(
      false,
    );
    expect(vesselHeld(leaning(33, [Math.SQRT1_2, Math.SQRT1_2], 430, shelf), [], geometry)).toBe(
      true,
    );
    // Not when it leans away from the wall, and not in the middle of the basket.
    expect(vesselHeld(leaning(33, [-1, 0], 430, shelf), [], geometry)).toBe(false);
    expect(vesselHeld(leaning(33, [1, 0], 250, shelf), [], geometry)).toBe(false);
    // No other fitting holds a vessel, nor a shelf of another basket, nor touching nothing.
    const knife = [...floor, 'upper_rack_fittings.holder.knife_shelf.rim.left'];
    expect(vesselHeld(leaning(33, [1, 0], 250, knife), [], geometry)).toBe(false);
    expect(
      vesselHeld(leaning(33, [1, 0], 430, ['lower_rack_fittings.shelf.x']), [], geometry),
    ).toBe(false);
    expect(vesselHeld(leaning(33, [-1, 0], 60, []), [], geometry)).toBe(false);
  });
});
