// Snapshots, state hashes and the canonical body order of the loading world.
import type { Pose, Vec3 } from '@spotless/core';
import { sha256Hex } from '@spotless/core';
import type { CollisionBox, CollisionPiece, MassProperties } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { LOADING_TIME_STEP } from './settings.ts';
import { ByteReader, ByteWriter, emptyContactState, parseContactState } from './state-bytes.ts';
import { AT_ORIGIN, NO_MASS, useWorlds } from './test-world.ts';
import type { JoltPhysicsWorld } from './world.ts';

const DT = LOADING_TIME_STEP;
const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });
const SURFACE = { material: 'steel' };

function box(part: string, half: Vec3, centre: Vec3 = [0, 0, 0]): CollisionBox {
  return { kind: 'box', part, halfExtents: half, radius: 0, pose: { p: centre, q: [0, 0, 0, 1] } };
}
function boxMass(mass: number, h: Vec3): MassProperties {
  return {
    mass,
    com: [0, 0, 0],
    inertia: [
      (mass * (h[1] ** 2 + h[2] ** 2)) / 3,
      0,
      0,
      0,
      (mass * (h[0] ** 2 + h[2] ** 2)) / 3,
      0,
      0,
      0,
      (mass * (h[0] ** 2 + h[1] ** 2)) / 3,
    ],
  };
}
const FLOOR: CollisionPiece[] = [box('floor', [0.3, 0.3, 0.01], [0, 0, -0.01])];
const HALF: Vec3 = [0.03, 0.02, 0.01];

/** A leaning tower of three boxes on a floor: bodies that interact through one island. */
function addTower(world: JoltPhysicsWorld, order: readonly number[]): void {
  const adds = [
    (): void => world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static'),
    (): void =>
      world.addBody(
        'box_a',
        [box('b', HALF)],
        boxMass(0.3, HALF),
        SURFACE,
        at(0, 0, 0.012),
        'dynamic',
      ),
    (): void =>
      world.addBody(
        'box_b',
        [box('b', HALF)],
        boxMass(0.2, HALF),
        SURFACE,
        at(0.012, 0.004, 0.034),
        'dynamic',
      ),
    (): void =>
      world.addBody(
        'box_c',
        [box('b', HALF)],
        boxMass(0.1, HALF),
        SURFACE,
        at(0.024, -0.003, 0.056),
        'dynamic',
      ),
  ];
  for (const i of order) (adds[i] as () => void)();
}

const newWorld = useWorlds();

describe('byte plumbing', () => {
  it('round-trips every field type, little-endian', () => {
    const writer = new ByteWriter();
    writer.u8(0xab);
    writer.u16(0x1234);
    writer.u32(0xdeadbeef);
    writer.f32(1.5);
    writer.f64(Math.PI);
    writer.text('plate_03 é');
    writer.bytes(new Uint8Array([1, 2, 3]));
    const bytes = writer.toBytes();
    // Little-endian: the low byte of 0x1234 comes first.
    expect([bytes[1], bytes[2]]).toEqual([0x34, 0x12]);
    const reader = new ByteReader(bytes);
    expect(reader.u8()).toBe(0xab);
    expect(reader.u16()).toBe(0x1234);
    expect(reader.u32()).toBe(0xdeadbeef);
    expect(reader.f32()).toBe(1.5);
    expect(reader.f64()).toBe(Math.PI);
    expect(reader.text()).toBe('plate_03 é');
    expect([...reader.bytes(3)]).toEqual([1, 2, 3]);
    expect(reader.remaining).toBe(0);
    expect(() => reader.u8()).toThrow(/truncated/);
  });

  it('parses an empty contact state and refuses anything of another layout', () => {
    expect(parseContactState(emptyContactState())).toEqual([]);
    expect(() => parseContactState(new Uint8Array([15, 0, 0, 0, 0]))).toThrow(
      /expected a contact state/,
    );
    expect(() => parseContactState(new Uint8Array([4, 0, 0, 0, 0, 0, 0, 0, 0, 9]))).toThrow(
      /unread bytes/,
    );
  });
});

describe('stateHash', () => {
  it('is sha256 over ids, kinds and the exact engine state in id order', async () => {
    const world = await newWorld();
    world.addBody('b', [box('b', HALF)], boxMass(0.3, HALF), SURFACE, at(0.5, 0.25, 1), 'dynamic');
    world.addBody('a', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    expect(world.stateHash()).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Rebuild the hashed bytes independently: body count, then per body the id (length-prefixed
    // UTF-8), the kind (0 static, 1 kinematic, 2 dynamic) and 13 single-precision numbers:
    // position of the centre of mass, orientation, linear and angular velocity, in the engine's
    // length unit (centimetres). Both centres of mass are at simple values here: the floor slab's
    // at (0, 0, -1 cm), the box's at its pose.
    const writer = new ByteWriter();
    writer.u32(2);
    writer.text('a');
    writer.u8(0);
    for (const x of [0, 0, -1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]) writer.f32(x);
    writer.text('b');
    writer.u8(2);
    for (const x of [50, 25, 100, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]) writer.f32(x);
    expect(world.stateHash()).toBe(`sha256:${sha256Hex(writer.toBytes())}`);
  });

  it('changes with any pose or velocity and not with a query', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    world.addBody('a', [box('b', HALF)], boxMass(0.3, HALF), SURFACE, at(0, 0, 1), 'dynamic');
    const start = world.stateHash();
    world.penetration([box('probe', HALF)], at(0, 0, 1));
    world.contacts();
    world.snapshot();
    expect(world.stateHash()).toBe(start);
    world.setVelocity('a', [0, 0, 1e-3], [0, 0, 0]);
    const moving = world.stateHash();
    expect(moving).not.toBe(start);
    world.step(1);
    expect(world.stateHash()).not.toBe(moving);
  });
});

describe('snapshot and restore', () => {
  it('brings back the exact state, including sleeping bodies and their contacts', async () => {
    const world = await newWorld();
    addTower(world, [0, 1, 2, 3]);
    world.step(600);
    expect(world.stats().activeBodies).toBe(0);
    const hash = world.stateHash();
    const contacts = world.contacts();
    expect(contacts.length).toBeGreaterThanOrEqual(3);
    const snapshot = world.snapshot();
    // Knock the tower over.
    world.applyImpulse('box_c', [0.05, 0, 0]);
    world.step(240);
    expect(world.stateHash()).not.toBe(hash);
    world.restore(snapshot);
    expect(world.stateHash()).toBe(hash);
    expect(world.contacts()).toEqual(contacts);
    expect(world.stats().activeBodies).toBe(0);
    // And it stays asleep.
    world.step(120);
    expect(world.stateHash()).toBe(hash);
  });

  it('replays identically from a snapshot taken in mid-flight', async () => {
    const world = await newWorld();
    addTower(world, [0, 1, 2, 3]);
    world.step(20);
    const snapshot = world.snapshot();
    const first: string[] = [];
    for (let i = 0; i < 12; i++) {
      world.step(10);
      first.push(world.stateHash());
    }
    world.restore(snapshot);
    const second: string[] = [];
    for (let i = 0; i < 12; i++) {
      world.step(10);
      second.push(world.stateHash());
    }
    expect(second).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(6);
  });

  it('carries a kinematic move that has not been stepped yet', async () => {
    const world = await newWorld();
    world.addBody('tray', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'kinematic');
    world.setPose('tray', at(0.001, 0, 0));
    const snapshot = world.snapshot();
    world.step(1);
    const moved = world.getPose('tray').p[0];
    expect(moved).toBeCloseTo(0.001, 7);
    world.restore(snapshot);
    expect(world.getPose('tray').p[0]).toBe(0);
    world.step(1);
    expect(world.getPose('tray').p[0]).toBe(moved);
  });

  it('replays a kinematic drive from a snapshot taken half way, in this world and in a fresh one', async () => {
    // A tray that carries a leaning tower, pulled along at 3 m/s^2 for 40 steps and then left.
    // Whether the engine sweeps fast bodies depends on whether a kinematic body is driven in
    // the step; that must follow from the state alone, not from what a world did before.
    const build = async (): Promise<JoltPhysicsWorld> => {
      const world = await newWorld();
      world.addBody('tray', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'kinematic');
      world.addBody(
        'box_a',
        [box('b', HALF)],
        boxMass(0.3, HALF),
        SURFACE,
        at(0, 0, 0.012),
        'dynamic',
      );
      world.addBody(
        'box_b',
        [box('b', HALF)],
        boxMass(0.2, HALF),
        SURFACE,
        at(0.012, 0.004, 0.034),
        'dynamic',
      );
      world.addBody(
        'box_c',
        [box('b', HALF)],
        boxMass(0.1, HALF),
        SURFACE,
        at(0.024, -0.003, 0.056),
        'dynamic',
      );
      world.step(30);
      return world;
    };
    const drive = (world: JoltPhysicsWorld, from: number, to: number): string[] => {
      const hashes: string[] = [];
      for (let k = from; k < to; k++) {
        if (k < 40) {
          const t = (k + 1) * DT;
          world.setPose('tray', at(0.5 * 3 * t * t, 0, 0));
        }
        world.step(1);
        hashes.push(world.stateHash());
      }
      return hashes;
    };
    const world = await build();
    drive(world, 0, 20);
    const snapshot = world.snapshot();
    const first = drive(world, 20, 80);
    // Something happened in the replayed part: the tray stopped dead from 0.5 m/s at step 40
    // and the tower slid on, about v^2 / (2 mu g) = 32 mm (the top box started 24 mm off centre).
    const slid = world.getPose('box_c').p[0] - world.getPose('tray').p[0] - 0.024;
    expect(slid).toBeGreaterThan(0.02);
    expect(slid).toBeLessThan(0.045);
    world.restore(snapshot);
    expect(drive(world, 20, 80)).toEqual(first);
    // A world that has never driven its tray takes over in mid-drive.
    const fresh = await build();
    fresh.restore(snapshot);
    expect(drive(fresh, 20, 80)).toEqual(first);
    // And one that is restored in the free phase after having been in the driven phase.
    const late = world.snapshot();
    const tail = drive(world, 80, 120);
    drive(fresh, 0, 10);
    fresh.restore(late);
    expect(drive(fresh, 80, 120)).toEqual(tail);
  });

  it('refuses a snapshot of other bodies, of another time step, or damaged bytes', async () => {
    const world = await newWorld();
    addTower(world, [0, 1, 2, 3]);
    const snapshot = world.snapshot();
    const fewer = await newWorld();
    addTower(fewer, [0, 1, 2]);
    expect(() => fewer.restore(snapshot)).toThrow(/different bodies/);
    const renamed = await newWorld();
    addTower(renamed, [0, 1, 2]);
    renamed.addBody(
      'box_d',
      [box('b', HALF)],
      boxMass(0.1, HALF),
      SURFACE,
      at(0.024, -0.003, 0.056),
      'dynamic',
    );
    expect(() => renamed.restore(snapshot)).toThrow(/different bodies/);
    const slower = await newWorld({ timeStep: DT / 2 });
    addTower(slower, [0, 1, 2, 3]);
    expect(() => slower.restore(snapshot)).toThrow(/different time step/);
    expect(() => world.restore(new Uint8Array(16))).toThrow(/not a snapshot/);
    expect(() => world.restore(snapshot.subarray(0, snapshot.length - 3))).toThrow();
    // The world that refused is untouched.
    const hash = world.stateHash();
    expect(() => world.restore(snapshot.subarray(0, 40))).toThrow();
    expect(world.stateHash()).toBe(hash);
  });
});

describe('canonical body order', () => {
  it('gives the same motion whatever order the bodies were added in', async () => {
    const histories: string[][] = [];
    for (const order of [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [2, 0, 3, 1],
    ]) {
      const world = await newWorld();
      addTower(world, order);
      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        world.step(24);
        hashes.push(world.stateHash());
      }
      histories.push(hashes);
    }
    expect(histories[1]).toEqual(histories[0]);
    expect(histories[2]).toEqual(histories[0]);
    // The tower really moved and interacted (the hashes differ from step to step at first).
    expect(new Set(histories[0]).size).toBeGreaterThan(3);
  });

  it('is preserved when a body is removed and put back', async () => {
    const plain = await newWorld();
    addTower(plain, [0, 1, 2, 3]);
    const again = await newWorld();
    addTower(again, [0, 1, 2, 3]);
    // Simulate, then take the middle box out and put it back where it was, at rest.
    for (const world of [plain, again]) world.step(600);
    const pose = again.getPose('box_b');
    again.removeBody('box_b');
    again.addBody('box_b', [box('b', HALF)], boxMass(0.2, HALF), SURFACE, pose, 'dynamic');
    // Same bodies, same ids, same poses: the same state hash, and a snapshot of one world
    // (which is keyed by the engine's own body ids) fits the other.
    expect(again.stateHash()).toBe(plain.stateHash());
    again.restore(plain.snapshot());
    plain.applyImpulse('box_c', [0.02, 0.01, 0]);
    again.applyImpulse('box_c', [0.02, 0.01, 0]);
    plain.step(120);
    again.step(120);
    expect(again.stateHash()).toBe(plain.stateHash());
  });

  it('does not disturb resting bodies when a body with an earlier id arrives', async () => {
    const world = await newWorld();
    addTower(world, [0, 1, 2, 3]);
    world.step(600);
    const before = ['box_a', 'box_b', 'box_c'].map((id) => world.getPose(id));
    // 'anvil' sorts before every other body, so each of them gets a new engine id.
    world.addBody(
      'anvil',
      [box('b', HALF)],
      boxMass(1, HALF),
      SURFACE,
      at(0.2, 0.2, 0.0101),
      'dynamic',
    );
    world.step(240);
    ['box_a', 'box_b', 'box_c'].forEach((id, i) => {
      expect(world.getPose(id)).toEqual(before[i]);
    });
    expect(world.contacts({ bodies: ['box_b'] }).length).toBeGreaterThanOrEqual(2);
    expect(world.bodyIds()).toEqual(['anvil', 'box_a', 'box_b', 'box_c', 'floor']);
  });

  it('keeps awake bodies moving through a renumbering', async () => {
    // Two balls in free flight; a third body with an earlier id is added in between.
    const ballPiece: CollisionPiece[] = [
      { kind: 'capsule', part: 'ball', a: [0, 0, 0], b: [0, 0, 0], radius: 0.01 },
    ];
    const mass: MassProperties = {
      mass: 0.1,
      com: [0, 0, 0],
      inertia: [4e-6, 0, 0, 0, 4e-6, 0, 0, 0, 4e-6],
    };
    const world = await newWorld({ gravity: [0, 0, 0] });
    world.addBody('m', ballPiece, mass, SURFACE, at(0, 0, 0), 'dynamic');
    world.addBody('z', ballPiece, mass, SURFACE, at(1, 0, 0), 'dynamic');
    world.setVelocity('m', [0.1, 0, 0], [0, 0, 2]);
    world.setVelocity('z', [0, 0.2, 0], [1, 0, 0]);
    world.step(10);
    world.addBody('a', ballPiece, mass, SURFACE, at(5, 5, 5), 'dynamic');
    world.step(10);
    // Uniform motion for 20 steps, unaffected by the renumbering.
    expect(world.getPose('m').p[0]).toBeCloseTo(0.1 * 20 * DT, 6);
    expect(world.getPose('z').p[1]).toBeCloseTo(0.2 * 20 * DT, 6);
    expect(world.getVelocity('m').angular[2]).toBeCloseTo(2, 5);
    expect(world.getVelocity('z').angular[0]).toBeCloseTo(1, 5);
  });
});
