import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Level } from '@spotless/levels';
import { createSession } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { auditStandardLoad } from './audit.ts';
import { viewOf } from './families.ts';
import type { MistakeKind, SettledLoad } from './mistakes.ts';
import { mistakeHolds } from './mistakes.ts';
import type { PolicyName, PolicyResult } from './policy.ts';
import { runPolicy } from './policy.ts';
import type { StandardLoad } from './standard-loads.ts';
import { replayStandardLoad } from './standard-loads.ts';
import { fiveItemLevel, tenItemLevel } from './test-level.ts';
import { verifyLoad } from './verify.ts';

async function play(
  policy: PolicyName,
  seed: number,
  mistakes?: readonly MistakeKind[],
): Promise<PolicyResult> {
  const session = await createSession({ level: fiveItemLevel() });
  try {
    return runPolicy(session, { policy, seed, ...(mistakes === undefined ? {} : { mistakes }) });
  } finally {
    session.dispose();
  }
}

describe('policies are deterministic', () => {
  for (const policy of ['careful', 'careless', 'random'] as const) {
    it(`${policy}: the same seed gives the same action log and the same hashes`, async () => {
      const first = await play(policy, 11);
      const second = await play(policy, 11);
      expect(first.actionLog.length).toBeGreaterThan(8);
      expect(first.placed.length).toBeGreaterThan(0);
      expect(JSON.stringify(second.actionLog)).toBe(JSON.stringify(first.actionLog));
      expect(second.finalState.state_hash).toBe(first.finalState.state_hash);
      expect(second.placed).toEqual(first.placed);
    });
  }

  it('random: another seed gives another load', async () => {
    const a = await play('random', 1);
    const b = await play('random', 2);
    expect(b.finalState.state_hash).not.toBe(a.finalState.state_hash);
  });
});

describe('the careful policy on ten items', () => {
  it('places every item stably, inside the baskets, and passes check_load', async () => {
    const level = tenItemLevel();
    const session = await createSession({ level });
    try {
      const result = runPolicy(session, { policy: 'careful', seed: 3 });
      expect(result.placed.length).toBe(10);
      expect(result.leftOut).toEqual([]);
      expect(result.counts.unstable).toEqual([]);
      expect(result.finalState.racks).toEqual({ lower_rack: 'in', upper_rack: 'in' });
      // Within the level's own budgets, as a player would have to stay.
      expect(result.counts.actionsUsed).toBeLessThanOrEqual(level.rules.actionsMax);
      expect(result.counts.queriesUsed).toBeLessThanOrEqual(level.rules.queriesMax);

      const check = result.check;
      expect(check).not.toBeNull();
      expect(check?.spray_arms.every((arm) => arm.full_rotation)).toBe(true);
      expect(check?.tablet_path_clear).toBe(true);
      expect(check?.dispenser_opens).toBe(true);
      expect(check?.door_closes).toBe(true);

      // The load as the wash gets it: nothing overlaps, nothing is outside its basket.
      const cycle = session.startCycle();
      expect(cycle.accepted).toBe(true);
      await session.washSettled();
      const manifest = session.washManifest();
      expect(manifest).not.toBeNull();
      if (manifest === null || !cycle.accepted) return;
      const numbers = await verifyLoad(manifest, result.finalState, cycle.prechecks);
      expect(numbers.overlaps).toEqual([]);
      expect(numbers.out_of_basket).toEqual([]);
      expect(numbers.not_in_a_basket).toEqual([]);
      expect(numbers.unstable).toEqual([]);
      expect(numbers.check_passes).toBe(true);

      // Nothing but cutlery rests against another item.
      for (const item of result.finalState.placed) {
        if (item.frame === 'cutlery_basket') continue;
        const others = item.contacts
          .map((contact) => contact.with)
          .filter((id) => result.placed.includes(id));
        expect(others, `${item.item_id} touches ${others.join(', ')}`).toEqual([]);
      }

      // Plates stand on edge, cups and glasses are mouth down.
      for (const item of manifest.items) {
        const q = item.pose.q;
        // z component of the item's +z axis in the tub frame.
        const up = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
        if (item.item_id.startsWith('plate')) expect(Math.abs(up)).toBeLessThan(0.5);
        if (item.item_id.startsWith('cup') || item.item_id.startsWith('glass')) {
          expect(up).toBeLessThan(-0.7);
        }
      }
    } finally {
      session.dispose();
    }
  });
});

describe('the careful policy on cups, mugs and a whisk', () => {
  it('sets them on the side rests of the upper basket, leaning to the walls, and folds the knife shelf down over them', async () => {
    // Four mugs, three tea cups, a whisk and a serving spoon on the Bosch: the rests along the
    // side walls of its upper basket (IMG_9131) take four mugs or cups each; the knife shelf,
    // which lies over the left one, is folded up while that rest is loaded and comes down
    // again over the mugs for the whisk. (A ladle no longer lies on that shelf: its bowl is
    // 108 mm wide and the shelf, as IMG_9131 has it, 99; until then it was drawn 119 wide.)
    const clean = (prefix: string, count: number, itemType: string): Level['items'] =>
      Array.from({ length: count }, (_, i) => ({
        id: `${prefix}_${String(i + 1).padStart(2, '0')}`,
        itemType,
        points: 5,
        soils: [],
      }));
    const items = [
      ...clean('mug', 4, 'mug_ceramic_300'),
      ...clean('cup', 3, 'tea_cup_porcelain_210'),
      ...clean('whisk', 1, 'balloon_whisk_292'),
      ...clean('spoon', 1, 'serving_spoon_216'),
    ];
    const level: Level = { ...tenItemLevel(), id: 'loader-test-rests', items };
    const session = await createSession({ level });
    try {
      const result = runPolicy(session, { policy: 'careful', seed: 3 });
      expect(result.leftOut).toEqual([]);
      expect(result.placed.length).toBe(9);
      expect(result.counts.unstable).toEqual([]);
      expect(result.check?.door_closes).toBe(true);
      expect(result.check?.spray_arms.every((arm) => arm.full_rotation)).toBe(true);
      expect(result.finalState.rack_options['upper_rack.shelf_knife_shelf']).toBe('down');
      const sides = { left: 0, right: 0 };
      for (const item of result.finalState.placed) {
        if (!item.item_id.startsWith('mug') && !item.item_id.startsWith('cup')) continue;
        expect(item.frame, item.item_id).toBe('upper_rack');
        const [w, x, y, z] = item.quat_wxyz;
        // Item +z points down for a vessel that stands mouth down: its base is at -z.
        const base = [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))];
        const lean = (Math.acos(base[2] as number) * 180) / Math.PI;
        // On a rest (left of the ridge at 92 mm or right of the one at 388), leaning to its
        // wall by 15 to 40 degrees (the rests fall 33 and 35).
        const left = item.position_mm[0] < 100;
        expect(left || item.position_mm[0] > 388, item.item_id).toBe(true);
        expect(lean, item.item_id).toBeGreaterThan(15);
        expect(lean, item.item_id).toBeLessThan(40);
        expect(Math.sign(base[0] as number), item.item_id).toBe(left ? -1 : 1);
        sides[left ? 'left' : 'right'] += 1;
      }
      expect(sides.left + sides.right).toBe(7);
      expect(sides.left).toBeGreaterThanOrEqual(3);
      expect(sides.right).toBeGreaterThanOrEqual(3);
      // The whisk lies on the knife shelf, 150 mm above the floor, over the mugs.
      const whisk = result.finalState.placed.find((item) => item.item_id === 'whisk_01');
      expect(whisk?.frame).toBe('upper_rack');
      expect(whisk?.position_mm[2]).toBeGreaterThan(150);
      expect(whisk?.position_mm[0]).toBeLessThan(101);
    } finally {
      session.dispose();
    }
  }, 120_000);
});

describe('the careless policy', () => {
  it('makes at least the mistakes it was asked for, as the settled poses show them', async () => {
    const asked: MistakeKind[] = ['plate_facing_away', 'cup_upright'];
    const level = fiveItemLevel();
    const session = await createSession({ level });
    try {
      const result = runPolicy(session, { policy: 'careless', seed: 5, mistakes: asked });
      const made = new Set(result.mistakes.map((m) => m.kind));
      for (const kind of asked) expect(made.has(kind)).toBe(true);
      // Every reported mistake is on an item that is in the machine.
      for (const mistake of result.mistakes) expect(result.placed).toContain(mistake.item_id);
      // Nothing it was not asked for.
      for (const kind of made) expect(asked).toContain(kind);
      // Each one is what the final scene shows, not what was intended.
      const card = session.getLevel();
      const settled: SettledLoad = {
        placed: new Map(result.finalState.placed.map((item) => [item.item_id, item])),
        views: new Map(card.items.map((item) => [item.item_id, viewOf(item)])),
        envelopes: new Map(card.machine.racks.map((rack) => [rack.rack, rack.envelope_mm])),
        check: result.check,
      };
      for (const mistake of result.mistakes) {
        expect(mistakeHolds(mistake, settled), `${mistake.kind} ${mistake.item_id}`).toBeNull();
        expect(mistake.note.length).toBeGreaterThan(10);
      }
      // The cup that stands mouth up really does: its opening points up in the scene.
      const upright = result.mistakes.find((m) => m.kind === 'cup_upright');
      const cup = result.finalState.placed.find((item) => item.item_id === upright?.item_id);
      expect(cup).toBeDefined();
      if (cup !== undefined) {
        const [, x, y] = cup.quat_wxyz;
        expect(1 - 2 * (x * x + y * y)).toBeGreaterThan(0.85);
      }
    } finally {
      session.dispose();
    }
  });

  it('holds the same items as the careful load and differs from it only in the mistakes', async () => {
    const careful = await play('careful', 5);
    const careless = await play('careless', 5, ['cup_upright']);
    expect(careful.mistakes).toEqual([]);
    expect(careless.mistakes.length).toBeGreaterThan(0);
    // The careless load is the careful one with a seeded choice of its items put in wrongly:
    // nothing is added from the counter and nothing is left behind.
    expect([...careless.placed].sort()).toEqual([...careful.placed].sort());
    // The careless loader begins as the careful one does: the same actions, the same scenes.
    const actions = (result: PolicyResult): PolicyResult['actionLog'] =>
      result.actionLog.filter((event) => event.kind === 'action');
    for (let i = 0; i < 8; i++) {
      expect(actions(careless)[i]?.state_hash, `action ${i}`).toBe(actions(careful)[i]?.state_hash);
    }
  });

  it('with no mistakes asked for makes none', async () => {
    const result = await play('careless', 5, []);
    expect(result.mistakes).toEqual([]);
  });
});

describe('a saved standard load', () => {
  it('replays to its final hash', async () => {
    const file = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'loads',
      'tutorial-careful.json',
    );
    const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
    expect(load.format).toBe('spotless-standard-load/1');
    const replay = await replayStandardLoad(load);
    expect(replay.mismatches).toBe(0);
    expect(replay.final_state_hash).toBe(load.final_state_hash);
    expect(replay.ok).toBe(true);
    // The manifest is the load the log leads to.
    expect(load.wash_manifest.items.map((item) => item.item_id).sort()).toEqual(
      [...load.placed].sort(),
    );
    expect(load.load_manifest.state_hash).toBe(load.final_state_hash);
  });

  it('can be unloaded: both baskets go out and in again, and nothing rests on anything', async () => {
    const file = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'loads',
      'tutorial-careful.json',
    );
    const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
    const audit = await auditStandardLoad(load);
    expect(audit.rebuilt).toBe(true);
    expect(audit.travel.length).toBeGreaterThanOrEqual(4);
    expect(audit.travel.filter((step) => !step.accepted)).toEqual([]);
    expect(audit.baskets_travel).toBe(true);
    expect(audit.laid_over).toEqual([]);
    expect(audit.plates_touching).toEqual([]);
    expect(audit.mistakes).toEqual([]);
  });
});

describe("the owner's load of 2026-10-10", () => {
  const file = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'loads',
    'owner-2026-10-10.json',
  );

  it('replays to its final hash and is in the machine as the photograph has it', async () => {
    const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
    const replay = await replayStandardLoad(load);
    expect(replay.mismatches).toBe(0);
    expect(replay.final_state_hash).toBe(load.final_state_hash);
    expect(load.policy.by_hand).toBe('owner-2026-10-10');
    // Everything of the level is in the machine but the baking tray. OPEN since 2026-10-11:
    // standing on its long edge against the left wall of the lower basket, as the photograph
    // has it, the 328 mm stand-in is 1.35 mm into the outer end of a left-right floor wire of
    // the upper basket when the lower basket is pushed in, and comes out again. Until
    // IMG_9131 the floor of the upper basket was drawn 30 mm higher by its left wall and the
    // tray went in. The owner ran this load: the model is short of room there (the low floor
    // by the wall, the height of the upper basket over the lower, or the stand-in). When that
    // is settled this load is to be generated again with the tray in it.
    expect(load.left_out.map((left) => left.item_id)).toEqual(['baking_tray_01']);
    expect(load.left_out[0]?.reason).toMatch(/stopped the lower basket from sliding in/);
    expect(load.placed.length).toBe(32);
    // In the upper basket: the mug on the rest along the right wall, at its front end, leaning
    // to the wall (as it leans in the photograph), the two glasses leaning on row C.
    // (The floor of the upper basket is 420 mm above that of the tub.)
    const upper = load.wash_manifest.items
      .filter((item) => item.pose.p[2] > 0.4)
      .map((item) => item.item_id)
      .sort();
    expect(upper).toEqual(['container_01', 'container_02', 'glass_01', 'glass_02', 'mug_01']);
    for (const id of upper) expect(load.numbers.unstable, id).not.toContain(id);
    const mug = load.wash_manifest.items.find((item) => item.item_id === 'mug_01');
    if (mug === undefined) throw new Error('mug_01 is not in the load');
    {
      // Item +z of a mug standing mouth down points down; its base leans to +x (the right
      // wall) by 15 to 30 degrees.
      const [x, y, z, w] = mug.pose.q;
      const axis = [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
      const lean = (Math.acos(-(axis[2] as number)) * 180) / Math.PI;
      expect(lean).toBeGreaterThan(15);
      expect(lean).toBeLessThan(30);
      expect(-(axis[0] as number)).toBeGreaterThan(0.25);
      expect(mug.pose.p[0]).toBeGreaterThan(0.15);
      expect(mug.pose.p[1]).toBeLessThan(-0.1);
    }
    // The cutlery basket stands at the front right, and the wash is told so.
    expect(load.load_manifest.rack_options['cutlery_basket.position']).toBe('front_right');
    expect(load.wash_manifest.machine_config.cutleryBasket?.centre[0]).toBeCloseTo(0.3725, 6);

    const at = (
      id: string,
    ): { p: readonly [number, number, number]; q: readonly [number, number, number, number] } => {
      const item = load.wash_manifest.items.find((i) => i.item_id === id);
      if (item === undefined) throw new Error(`${id} is not in the load`);
      return item.pose;
    };
    // Item +z (the eating face of a plate) in the tub frame.
    const face = (id: string): [number, number, number] => {
      const [x, y, z, w] = at(id).q;
      return [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
    };
    // The two plates stand on edge at the two ends of the rear rows, each with its eating face
    // to the middle of the basket and within 10 degrees of upright, the top outwards or
    // upright (the photograph: 3 +-3 and 6 +-4 degrees outwards; a 30 mm deep stand-in comes
    // to rest a few degrees the other side of upright, as the machine engineer found).
    const left = face('plate_01');
    const right = face('plate_02');
    expect(at('plate_01').p[0]).toBeLessThan(-0.15);
    expect(at('plate_02').p[0]).toBeGreaterThan(0.15);
    expect(left[0]).toBeGreaterThan(0.97);
    expect(right[0]).toBeLessThan(-0.97);
    for (const plate of [left, right]) {
      expect(Math.abs((Math.asin(plate[2]) * 180) / Math.PI)).toBeLessThan(10);
    }
    // The white board at the right wall, the brown one at the back. (The tray at the left
    // wall: see above.)
    expect(at('board_white_01').p[0]).toBeGreaterThan(0.22);
    expect(at('board_brown_01').p[1]).toBeGreaterThan(0.2);
    // The pan lies tilted (its opening 20 to 70 degrees from straight up), its handle to the
    // front: the middle of pan and handle together is in front of the plate it leans on.
    const pan = face('frying_pan_01');
    const tilt = (Math.acos(pan[2]) * 180) / Math.PI;
    expect(tilt).toBeGreaterThan(20);
    expect(tilt).toBeLessThan(70);
    expect(at('frying_pan_01').p[1]).toBeLessThan(at('plate_02').p[1]);
  }, 120_000);

  it('has items resting on items, and its baskets still travel', async () => {
    const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
    const audit = await auditStandardLoad(load);
    expect(audit.rebuilt).toBe(true);
    expect(audit.baskets_travel).toBe(true);
    // The deep pieces lean on one another, as in the photograph.
    const touching = new Map(audit.touching.map((entry) => [entry.item_id, entry.with]));
    expect(touching.get('frying_pan_01')).toEqual(expect.arrayContaining(['plate_02']));
    expect(touching.get('pasta_bowl_01')).toEqual(expect.arrayContaining(['frying_pan_01']));
    expect(touching.size).toBeGreaterThanOrEqual(5);
    // Nothing is thrown by a pull and a push.
    expect(audit.travel.flatMap((step) => step.thrown)).toEqual([]);
  }, 120_000);
});
