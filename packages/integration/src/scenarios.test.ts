// The loading chain on the stand-in rack with real catalogue items (scenarios a to g of the
// integration brief). Every item is `instantiate(id)` of the catalogue, every body is built from
// the geometry kernel's collision pieces, friction and restitution are the catalogue's pair
// table, and the world is the physics package's loading world.
//
// What a scenario expects is computed, not remembered: from the rack's dimension record and the
// exact shapes (rack-geometry.ts, nest.ts), never from a previous run of the simulation.
// Overlap is measured on the true shapes of the collision pieces with the physics package's
// engine-independent measurer, and on the exact analytic shapes with the kernel's signed
// distance (overlap.ts).
import { instantiate } from '@spotless/catalogue';
import type { Pose, Vec3 } from '@spotless/core';
import { STANDARD_GRAVITY, poseTransformPoint, quatRotate, v3Distance } from '@spotless/core';
import { COLLISION_CHORD_ERROR, boundingBox } from '@spotless/geometry';
import { JOLT_SETTINGS, REST_CRITERION, placedCores, probeStability } from '@spotless/physics';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BOWL,
  DINNER_PLATE,
  MUG,
  RELEASE_GAP,
  invertedPose,
  loadCutlery,
  loadNestedBowls,
  loadPlates,
  plateReleasePose,
  rimRadii,
} from './loads.ts';
import { profileNestContact, profileNestSpacing } from './nest.ts';
import { exactOverlap, measureOverlap, overlapMeter } from './overlap.ts';
import type { FlatDropVerdict } from './rack-geometry.ts';
import { fitOverTines, flatDropVerdict, maxLeanInSlot, slotFit } from './rack-geometry.ts';
import type { LoadingScene, LoadingSceneOptions, SceneItem } from './scene.ts';
import {
  BASKET_ID,
  RACK_ID,
  TUB_FLOOR_ID,
  addItem,
  axisFromUpDeg,
  bodyBounds,
  collisionPiecesOf,
  createLoadingScene,
  fastest,
  itemIds,
  itemPoint,
  lowerToContact,
  orientationOf,
  poseOver,
  settleScene,
} from './scene.ts';
import type { PlateSlot } from './stand-in-rack.ts';
import { STAND_IN_RACK, buildStandInRack } from './stand-in-rack.ts';

const MM = 1e-3;
const DEG = Math.PI / 180;
/** Largest true overlap of collision pieces accepted at any time in a scenario: 0.2 mm. */
const MAX_PENETRATION = 0.2 * MM;
/**
 * Largest overlap accepted between the exact shapes of two bodies at rest: each may reach up to
 * the collision chord error beyond its collision pieces where it is curved, plus what the solver
 * leaves.
 */
const MAX_EXACT_OVERLAP = COLLISION_CHORD_ERROR + MAX_PENETRATION;

const scenes: LoadingScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.world.dispose();
});

async function newScene(options: LoadingSceneOptions = {}): Promise<LoadingScene> {
  const scene = await createLoadingScene(options);
  scenes.push(scene);
  return scene;
}

/** Lean of a plate back from the vertical, degrees: how far its food side looks up. */
function leanDeg(scene: LoadingScene, id: string): number {
  return 90 - axisFromUpDeg(scene.world.getPose(id).q);
}

/** Mass entries for the stability probe. */
function probeBodies(items: readonly SceneItem[]): { id: string; mass: number }[] {
  return items.map((item) => ({ id: item.id, mass: item.instance.mass.mass }));
}

/** The parts of the other body in every contact of an item, as `<body>:<part>`, sorted. */
function touching(scene: LoadingScene, id: string): string[] {
  return scene.world
    .contacts({ bodies: [id] })
    .map((c) => (c.a === id ? `${c.b}:${c.partB}` : `${c.a}:${c.partA}`))
    .sort();
}

/** The point of the open part of the base grid where single items are stood (rack frame). */
function openGrid(scene: LoadingScene): { x: number; y: number } {
  return { x: scene.rack.openPoint[0], y: scene.rack.openPoint[1] };
}

// ---------------------------------------------------------------------------------------------
// a. A dinner plate in a tine slot
// ---------------------------------------------------------------------------------------------

describe('a. a dinner plate placed in a tine slot', () => {
  it.each([[DINNER_PLATE], ['dinner_plate_porcelain_270'], ['dinner_plate_vitrelle_260']])(
    '%s settles leaning on the tines at the lean the slot allows, stable, without sinking in',
    async (typeId) => {
      const scene = await newScene();
      const rack = scene.rack;
      const slot = rack.slots[5] as PlateSlot;
      const instance = instantiate(typeId);
      const pieces = collisionPiecesOf(instance.shape);

      // What the geometry says, from the exact shape and the rack's wires alone: the plate fits
      // the slot upright, and leaning back it is caught between the tines at `geometric`.
      const upright = slotFit(rack, slot, instance.shape, 0);
      expect(upright.play).toBeGreaterThan(1 * MM);
      const geometric = maxLeanInSlot(rack, slot, instance.shape);
      if (geometric === null) throw new Error('the plate does not fit');
      const caught = slotFit(rack, slot, instance.shape, geometric);

      // Placed as the session will place it: upright in the slot, lowered to first contact.
      // The physics world's sweep finds the base grid where the kernel says the plate rests on
      // it, or lower by up to the collision chord error: the rim of the collision plate is a
      // polygon inscribed in the true rim, and a wire may meet it in the middle of a side.
      const release = plateReleasePose(rack, slot, typeId);
      const above: Pose = { p: [release.p[0], release.p[1], release.p[2] + 0.05], q: release.q };
      const lowered = lowerToContact(scene, pieces, above, 0.1, 0);
      expect(lowered.with).toBe(RACK_ID);
      expect(lowered.pose.p[2] - upright.z).toBeLessThan(0.02 * MM);
      expect(lowered.pose.p[2] - upright.z).toBeGreaterThan(-(COLLISION_CHORD_ERROR + 0.02 * MM));
      const plate = addItem(scene, 'plate', typeId, release);

      // The first half second step by step: it never sinks into a wire, never shoots off.
      const meter = overlapMeter(scene);
      let deepest = 0;
      let fastestEver = 0;
      for (let i = 0; i < 120; i++) {
        scene.world.step(1);
        deepest = Math.max(deepest, meter().deepest);
        fastestEver = Math.max(fastestEver, fastest(scene, ['plate']).linear);
      }
      // Released at rest half a millimetre up, an upright plate topples back through the play
      // of the slot: it cannot pick up more speed than a fall through its own depth would give.
      const depth = boundingBox(instance.shape).max[2];
      expect(fastestEver).toBeLessThan(Math.sqrt(2 * STANDARD_GRAVITY * depth));
      const settled = settleScene(scene);
      expect(settled.atRest).toBe(true);
      const reading = meter();
      expect(Math.max(deepest, reading.deepest)).toBeLessThan(MAX_PENETRATION);

      // It leans back (food side to the front and up) at the lean the slot allows, to a degree...
      const lean = leanDeg(scene, 'plate');
      expect(lean).toBeGreaterThan(0.5);
      expect(Math.abs(lean - geometric / DEG)).toBeLessThan(1);
      // ...standing where the geometry puts it: its foot against the front tines, on the grid,
      // midway between the rails.
      const pose = scene.world.getPose('plate');
      expect(Math.abs(pose.p[1] - caught.yMin)).toBeLessThan(2 * MM);
      expect(Math.abs(pose.p[2] - caught.z)).toBeLessThan(1 * MM);
      expect(Math.abs(pose.p[0] - slot.centreX)).toBeLessThan(3 * MM);

      // It rests on the base grid and against tines before and behind it, and on nothing else.
      const parts = touching(scene, 'plate');
      expect(parts.every((part) => part.startsWith(`${RACK_ID}:`))).toBe(true);
      const front = parts.filter((part) =>
        part.endsWith(`.${String(slot.index).padStart(2, '0')}`),
      );
      const back = parts.filter((part) =>
        part.endsWith(`.${String(slot.index + 1).padStart(2, '0')}`),
      );
      expect(parts.some((part) => part.startsWith(`${RACK_ID}:grid_y.`))).toBe(true);
      expect(front.filter((part) => part.includes(':tine.')).length).toBeGreaterThanOrEqual(1);
      expect(back.filter((part) => part.includes(':tine.')).length).toBeGreaterThanOrEqual(1);
      // What carries it adds up to between half and three times its weight (the rest of the
      // balance is friction, which the contacts do not report).
      const weight = instance.mass.mass * STANDARD_GRAVITY;
      const carried = scene.world
        .contacts({ bodies: ['plate'] })
        .reduce((sum, c) => sum + c.normalForceN, 0);
      expect(carried).toBeGreaterThan(0.5 * weight);
      expect(carried).toBeLessThan(3 * weight);

      // Stable under the platform's probe, which leaves the world as it found it.
      const hash = scene.world.stateHash();
      expect(probeStability(scene.world, { bodies: probeBodies([plate]) })).toEqual({
        stable: true,
        unstable: [],
      });
      expect(scene.world.stateHash()).toBe(hash);

      // The exact shapes: the rim of the true plate is rounder than its collision pieces.
      expect(exactOverlap(scene, 'plate')?.depth ?? 0).toBeLessThan(MAX_EXACT_OVERLAP);
    },
  );

  it('a plate too deep for the slot is told so by the geometry and by the sweep alike', async () => {
    // A rack whose tines are 25 mm apart (the pitch of the SPOT-60 baseline): 20.8 mm of clear
    // slot, less than the 22.2 mm the IEC plate needs between upright tines on these rails.
    const narrow = { ...STAND_IN_RACK, tines: { ...STAND_IN_RACK.tines, pitchMm: 25 } };
    const scene = await newScene({ rack: buildStandInRack(narrow) });
    const slot = scene.rack.slots[5] as PlateSlot;
    const instance = instantiate(DINNER_PLATE);
    const fit = slotFit(scene.rack, slot, instance.shape, 0);
    expect(fit.play).toBeLessThan(0);
    expect(maxLeanInSlot(scene.rack, slot, instance.shape)).toBeNull();
    expect(() => plateReleasePose(scene.rack, slot, DINNER_PLATE)).toThrow(
      /needs 22\.\d mm of slot/,
    );
    // Lowered upright over the middle of the slot it stops on the tines, far above the grid.
    const q = orientationOf(instance, 'on_edge');
    const over = poseOver(instance.shape, q, slot.centreX, (slot.frontY + slot.backY) / 2, 0.1);
    const lowered = lowerToContact(scene, collisionPiecesOf(instance.shape), over, 0.15, 0);
    expect(lowered.with).toBe(RACK_ID);
    expect(lowered.pose.p[2] - fit.z).toBeGreaterThan(5 * MM);
  });
});

// ---------------------------------------------------------------------------------------------
// b. Twelve dinner plates in adjacent slots
// ---------------------------------------------------------------------------------------------

describe('b. twelve dinner plates in adjacent slots', () => {
  const load = async (
    options: LoadingSceneOptions = {},
  ): Promise<{
    scene: LoadingScene;
    plates: SceneItem[];
    deepest: number;
    fastestEver: number;
  }> => {
    const scene = await newScene(options);
    const plates = loadPlates(scene);
    const ids = plates.map((plate) => plate.id);
    const meter = overlapMeter(scene);
    let deepest = 0;
    let fastestEver = 0;
    for (let i = 0; i < 480; i++) {
      scene.world.step(1);
      fastestEver = Math.max(fastestEver, fastest(scene, ids).linear);
      if (i % 4 === 0) deepest = Math.max(deepest, meter().deepest);
    }
    deepest = Math.max(deepest, meter().deepest);
    return { scene, plates, deepest, fastestEver };
  };

  it('all come to rest in their own slots, lean alike, touch only the rack and stay put for 10 s', async () => {
    const { scene, plates, deepest, fastestEver } = await load();
    const rack = scene.rack;
    const ids = plates.map((plate) => plate.id);
    expect(ids).toHaveLength(12);
    const shape = (plates[0] as SceneItem).shape;
    expect(fastestEver).toBeLessThan(Math.sqrt(2 * STANDARD_GRAVITY * boundingBox(shape).max[2]));
    expect(deepest).toBeLessThan(MAX_PENETRATION);
    expect(settleScene(scene).atRest).toBe(true);

    const geometric = maxLeanInSlot(rack, rack.slots[0] as PlateSlot, shape);
    if (geometric === null) throw new Error('the plate does not fit');
    plates.forEach((plate, k) => {
      const slot = rack.slots[k] as PlateSlot;
      const caught = slotFit(rack, slot, shape, geometric);
      const pose = scene.world.getPose(plate.id);
      // In its own slot, where the geometry puts a plate of that lean...
      expect(Math.abs(leanDeg(scene, plate.id) - geometric / DEG), plate.id).toBeLessThan(1);
      expect(Math.abs(pose.p[1] - caught.yMin), plate.id).toBeLessThan(2 * MM);
      expect(Math.abs(pose.p[2] - caught.z), plate.id).toBeLessThan(1 * MM);
      // ...touching the rack only: its own two rows of tines and the grid.
      const parts = touching(scene, plate.id);
      expect(parts.length, plate.id).toBeGreaterThanOrEqual(3);
      for (const part of parts) {
        expect(part.startsWith(`${RACK_ID}:`), `${plate.id} touches ${part}`).toBe(true);
        const tine = /:tine\.[ab]\.(\d+)$/.exec(part);
        if (tine !== null)
          expect([k, k + 1], `${plate.id} touches ${part}`).toContain(Number(tine[1]));
      }
    });
    const reading = measureOverlap(scene);
    expect(reading.betweenItems).toBe(0);
    expect(reading.withFixtures).toBeLessThan(MAX_PENETRATION);

    // Ten more seconds: nothing moves at all.
    const before = ids.map((id) => scene.world.getPose(id));
    const hash = scene.world.stateHash();
    scene.world.step(2400);
    ids.forEach((id, i) => expect(scene.world.getPose(id), id).toEqual(before[i]));
    expect(scene.world.stateHash()).toBe(hash);
    expect(fastest(scene, ids)).toEqual({ linear: 0, angular: 0 });

    // Every one of them is stable under the probe, kicked all together.
    expect(probeStability(scene.world, { bodies: probeBodies(plates) })).toEqual({
      stable: true,
      unstable: [],
    });
    // The exact shapes of the first, a middle and the last plate (each takes a second to probe).
    for (const id of ['plate_00', 'plate_05', 'plate_11']) {
      expect(exactOverlap(scene, id)?.depth ?? 0, id).toBeLessThan(MAX_EXACT_OVERLAP);
    }
  });

  it('do not creep for 10 s when the engine is not allowed to put them to sleep', async () => {
    // Sleeping hides creep: here every plate is simulated in every step.
    const { scene, plates, deepest } = await load({ settings: { allowSleeping: false } });
    const ids = plates.map((plate) => plate.id);
    expect(deepest).toBeLessThan(MAX_PENETRATION);
    scene.world.step(240);
    expect(scene.world.stats().activeBodies).toBe(12);
    const before = ids.map((id) => scene.world.getPose(id));
    let linear = 0;
    let angular = 0;
    for (let i = 0; i < 2400; i++) {
      scene.world.step(1);
      if (i % 8 !== 0) continue;
      const now = fastest(scene, ids);
      linear = Math.max(linear, now.linear);
      angular = Math.max(angular, now.angular);
    }
    // Under a tenth of the rest criterion throughout, and under 50 micrometres of drift
    // (measured: none for eleven plates, 19 micrometres for one, which slides at 2 micrometres
    // per second, a two-thousandth of the rest speed; whether one does depends on the number of
    // solver iterations: none with 10 or with 30).
    expect(linear).toBeLessThan(REST_CRITERION.linearSpeed / 10);
    expect(angular).toBeLessThan(REST_CRITERION.angularSpeed / 10);
    ids.forEach((id, i) => {
      expect(v3Distance(scene.world.getPose(id).p, (before[i] as Pose).p), id).toBeLessThan(5e-5);
    });
    expect(measureOverlap(scene).deepest).toBeLessThan(MAX_PENETRATION);
  });
});

// ---------------------------------------------------------------------------------------------
// c. Four nested bowls
// ---------------------------------------------------------------------------------------------

describe('c. four catalogue bowls nested', () => {
  const stack = async (
    typeId: string,
    yawStep: number,
    drop: number,
  ): Promise<{ scene: LoadingScene; bowls: SceneItem[]; spacing: number[]; deepest: number }> => {
    const scene = await newScene();
    const at = openGrid(scene);
    const { items } = loadNestedBowls(scene, at.x, at.y, { typeId, yaw0: 0.1, yawStep, drop });
    const meter = overlapMeter(scene);
    let deepest = 0;
    for (let i = 0; i < 480; i++) {
      scene.world.step(1);
      if (i % 6 === 0) deepest = Math.max(deepest, meter().deepest);
    }
    expect(settleScene(scene).atRest).toBe(true);
    deepest = Math.max(deepest, meter().deepest);
    const z = items.map((item) => scene.world.getPose(item.id).p[2]);
    const spacing = [1, 2, 3].map((i) => (z[i] as number) - (z[i - 1] as number));
    return { scene, bowls: items, spacing, deepest };
  };

  it.each([
    [BOWL],
    ['cereal_bowl_vitrelle_159'],
    ['cereal_bowl_stoneware_130'],
    ['melamine_bowl_150'],
  ])('%s: placed one in another, they sit at the nest spacing of their profile', async (typeId) => {
    // The geometric ideal, from the mid-surface profile of the catalogue record alone: the
    // height at which a copy lowered along the axis first touches (nest.ts; 26.1 mm for the
    // porcelain bowl, 7.1 mm for the thin Vitrelle one).
    const ideal = profileNestSpacing(instantiate(typeId).shape);
    const { scene, bowls, spacing, deepest } = await stack(typeId, 0, 0);
    // All turned alike, so that the facets of their walls lie against each other: within 0.1 mm
    // below (the penetration the solver tolerates) and 0.3 mm above the ideal.
    for (const s of spacing) {
      expect(s - ideal, `spacing ${(s * 1000).toFixed(3)} mm`).toBeGreaterThan(-0.1 * MM);
      expect(s - ideal, `spacing ${(s * 1000).toFixed(3)} mm`).toBeLessThan(0.3 * MM);
    }
    // The bottom one stands on the grid, all are level and on one axis.
    expect(Math.abs(scene.world.getPose('bowl_0').p[2])).toBeLessThan(0.1 * MM);
    const base = scene.world.getPose('bowl_0').p;
    for (const bowl of bowls) {
      const pose = scene.world.getPose(bowl.id);
      expect(axisFromUpDeg(pose.q), bowl.id).toBeLessThan(0.5);
      expect(Math.hypot(pose.p[0] - base[0], pose.p[1] - base[1]), bowl.id).toBeLessThan(1 * MM);
    }
    expect(deepest).toBeLessThan(MAX_PENETRATION);
    expect(probeStability(scene.world, { bodies: probeBodies(bowls) }).stable).toBe(true);
    // Each bowl touches the one below it and nothing else; the bottom one touches the rack.
    expect(touching(scene, 'bowl_0').some((part) => part.startsWith(`${RACK_ID}:grid_y.`))).toBe(
      true,
    );
    for (let i = 1; i < 4; i++) {
      const others = new Set(touching(scene, `bowl_${i}`).map((part) => part.split(':')[0]));
      expect(others.has(`bowl_${i - 1}`), `bowl_${i}`).toBe(true);
      expect(others.has(RACK_ID), `bowl_${i}`).toBe(false);
    }
  });

  it('turned against each other and dropped, they sit higher by what their facets take, and no more', async () => {
    // Collision pieces are flat: a wall is a polygon of some 28 sides, inscribed to the chord
    // error (0.5 mm). Two such walls turned against each other can interfere radially by up to
    // that, and a wall leaning alpha from the axis turns interference into chordError / tan(alpha)
    // of height. This is the price of faceting, not of the solver; the test states its bound.
    const shape = instantiate(BOWL).shape;
    const contact = profileNestContact(shape);
    const bound = COLLISION_CHORD_ERROR / Math.tan(contact.wallFromAxis);
    expect(bound).toBeGreaterThan(0.5 * MM);
    expect(bound).toBeLessThan(1.5 * MM);
    const aligned = await stack(BOWL, 0, 0.003);
    const turned = await stack(BOWL, 0.37, 0.003);
    for (const s of aligned.spacing) {
      expect(s - contact.spacing).toBeGreaterThan(-0.1 * MM);
      expect(s - contact.spacing).toBeLessThan(0.4 * MM);
    }
    for (const s of turned.spacing) {
      expect(s - contact.spacing, `spacing ${(s * 1000).toFixed(3)} mm`).toBeGreaterThan(0.3 * MM);
      expect(s - contact.spacing, `spacing ${(s * 1000).toFixed(3)} mm`).toBeLessThan(
        bound + 0.2 * MM,
      );
    }
    // The engine's edges between two wall sectors are mitred: on the outside of a wall up to
    // the sag tolerance (0.05 mm) proud of the rounded edge of the pieces that the overlap is
    // measured on. Aligned, those edges of one bowl lie in the creases of the next (measured:
    // 0.225 mm at the worst moment of the drop, 0.1 mm of it the solver's slop).
    expect(turned.deepest).toBeLessThan(MAX_PENETRATION + JOLT_SETTINGS.roundedEdgeSag);
    expect(aligned.deepest).toBeLessThan(MAX_PENETRATION + JOLT_SETTINGS.roundedEdgeSag);
    // The exact shapes of the turned bowls do not touch at all: they are held apart by facets.
    expect(exactOverlap(turned.scene, 'bowl_1')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// d. A mug upright on the grid and inverted over tines
// ---------------------------------------------------------------------------------------------

describe('d. a mug on the grid and over the tines', () => {
  it('dropped upright onto the grid it stands, stable', async () => {
    const scene = await newScene();
    const instance = instantiate(MUG);
    const at = openGrid(scene);
    const drop = 0.02;
    const q = orientationOf(instance, 'upright', 0.4);
    // The axis of the mug over the point, its foot 20 mm above the grid.
    const mug = addItem(scene, 'mug', MUG, { p: [at.x, at.y, drop], q });
    const meter = overlapMeter(scene);
    let deepest = 0;
    let fastestEver = 0;
    for (let i = 0; i < 240; i++) {
      scene.world.step(1);
      deepest = Math.max(deepest, meter().deepest);
      fastestEver = Math.max(fastestEver, fastest(scene, ['mug']).linear);
    }
    expect(fastestEver).toBeLessThanOrEqual(Math.sqrt(2 * STANDARD_GRAVITY * drop) + 1e-6);
    expect(settleScene(scene).atRest).toBe(true);
    expect(deepest).toBeLessThan(MAX_PENETRATION);
    const pose = scene.world.getPose('mug');
    // Standing on its foot ring on the wires: base at grid level, upright, where it landed.
    expect(Math.abs(pose.p[2])).toBeLessThan(0.1 * MM);
    expect(axisFromUpDeg(pose.q)).toBeLessThan(0.5);
    expect(Math.hypot(pose.p[0] - at.x, pose.p[1] - at.y)).toBeLessThan(3 * MM);
    const parts = touching(scene, 'mug');
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.every((part) => part.startsWith(`${RACK_ID}:grid_y.`))).toBe(true);
    // It stands on its unglazed foot ring, not on its glazed base.
    const own = scene.world
      .contacts({ bodies: ['mug'] })
      .map((c) => (c.a === 'mug' ? c.partA : c.partB));
    expect(new Set(own)).toEqual(new Set(['foot']));
    expect(probeStability(scene.world, { bodies: probeBodies([mug]) })).toEqual({
      stable: true,
      unstable: [],
    });
    expect(exactOverlap(scene, 'mug')?.depth ?? 0).toBeLessThan(MAX_EXACT_OVERLAP);
  });

  it('inverted over two tines it goes down to the grid and stands, stable', async () => {
    const scene = await newScene();
    const rack = scene.rack;
    const instance = instantiate(MUG);
    const slot = rack.slots[5] as PlateSlot;
    const rim = rimRadii(MUG);
    const x = slot.railX[1];
    const y = (slot.frontY + slot.backY) / 2;
    // The geometry says the mouth takes the two tines of the slot and clears the next ones, and
    // that the mug is deep enough inside for the tines not to reach its base.
    const fit = fitOverTines(rack, x, y, rim.inner, rim.outer);
    expect(fit).toEqual({ fits: true, inside: 2, blocking: [] });
    const body = instance.shape.parts[0];
    if (body === undefined || body.prim.kind !== 'sor') throw new Error('not a shell');
    const base = body.prim.profile[0] as { z: number; t: number };
    const height = boundingBox(instance.shape).max[2];
    expect(height - (base.z + base.t / 2)).toBeGreaterThan(slot.tineHeight + 5 * MM);

    // Lowered from above the tines, handle to the right: nothing stops it before the grid.
    const start = invertedPose(MUG, x, y, slot.tineHeight + 0.02);
    const lowered = lowerToContact(
      scene,
      collisionPiecesOf(instance.shape),
      start,
      0.12,
      RELEASE_GAP,
    );
    expect(lowered.with).toBe(RACK_ID);
    const rimHeight = lowered.pose.p[2] - start.p[2] + slot.tineHeight + 0.02;
    expect(Math.abs(rimHeight - RELEASE_GAP)).toBeLessThan(0.1 * MM);
    const mug = addItem(scene, 'mug', MUG, lowered.pose);
    expect(settleScene(scene).atRest).toBe(true);
    const pose = scene.world.getPose('mug');
    // Mouth down on the grid, level, still over its two tines.
    expect(Math.abs(bodyBounds(scene, mug).min[2])).toBeLessThan(0.1 * MM);
    expect(180 - axisFromUpDeg(pose.q)).toBeLessThan(0.5);
    expect(Math.hypot(pose.p[0] - x, pose.p[1] - y)).toBeLessThan(1 * MM);
    expect(touching(scene, 'mug').every((part) => part.startsWith(`${RACK_ID}:grid_`))).toBe(true);
    expect(measureOverlap(scene).deepest).toBeLessThan(MAX_PENETRATION);
    expect(probeStability(scene.world, { bodies: probeBodies([mug]) })).toEqual({
      stable: true,
      unstable: [],
    });
    expect(exactOverlap(scene, 'mug')?.depth ?? 0).toBeLessThan(MAX_EXACT_OVERLAP);
  });

  it('centred on a tine instead it is stopped on the tips of the two next to it, where a torus meets two spheres', async () => {
    const scene = await newScene();
    const rack = scene.rack;
    const instance = instantiate(MUG);
    const slot = rack.slots[5] as PlateSlot;
    const rim = rimRadii(MUG);
    const x = slot.railX[1];
    const y = slot.frontY;
    const fit = fitOverTines(rack, x, y, rim.inner, rim.outer);
    expect(fit.fits).toBe(false);
    expect(fit.inside).toBe(1);
    expect(fit.blocking).toHaveLength(2);
    // The rim is a torus (radius of its centre circle rm, tube radius t / 2) with its axis on
    // the tine; the tip of a neighbouring tine is a sphere of the tine radius at distance d from
    // that axis, its centre one radius below the tine height. They touch when their centres are
    // the two radii apart: the tube centre is then sqrt((t/2 + r)^2 - (rm - d)^2) above the
    // sphere centre, and the lowest point of the rim t / 2 below the tube centre.
    const rm = (rim.inner + rim.outer) / 2;
    const tube = (rim.outer - rim.inner) / 2;
    const rTine = rack.dims.tineWireMm / 2000;
    const d = (fit.blocking[0] as { distance: number }).distance;
    const expected =
      slot.tineHeight - rTine + Math.sqrt((tube + rTine) ** 2 - (rm - d) ** 2) - tube;
    expect(expected).toBeGreaterThan(slot.tineHeight - 2 * MM);
    expect(expected).toBeLessThan(slot.tineHeight + 1 * MM);
    const start = invertedPose(MUG, x, y, slot.tineHeight + 0.02);
    const lowered = lowerToContact(scene, collisionPiecesOf(instance.shape), start, 0.12, 0);
    expect(lowered.with).toBe(RACK_ID);
    const rimHeight = lowered.pose.p[2] - start.p[2] + slot.tineHeight + 0.02;
    // The collision rim is a polygon inscribed in the true one, so it may come a little lower.
    expect(Math.abs(rimHeight - expected)).toBeLessThan(0.3 * MM);
  });
});

// ---------------------------------------------------------------------------------------------
// e. A teaspoon laid on the base grid
// ---------------------------------------------------------------------------------------------

describe('e. a teaspoon dropped flat onto the base grid', () => {
  const SPOON = 'teaspoon_130';

  it('rests or falls through as the grid openings and its centre of mass say', async () => {
    const spoon = instantiate(SPOON);
    const box = spoon.bbox;
    const footprint = {
      length: box.max[0] - box.min[0],
      width: box.max[1] - box.min[1],
      comAlong: spoon.mass.com[0] - box.min[0],
    };
    const rack0 = (await newScene()).rack;
    // The teaspoon cannot drop straight through level: it is longer than the diagonal of an
    // opening. Whether it stays depends on which wires are under it.
    expect(footprint.length).toBeGreaterThan(
      Math.hypot(rack0.opening.alongX, rack0.opening.alongY),
    );
    const pitchX = rack0.dims.gridAlongY.pitchMm / 1000;
    const gapLeft = rack0.wiresAlongY[rack0.wiresAlongY.length - 4] as number;
    const lastCell = rack0.cells[rack0.cells.length - 1];
    if (lastCell === undefined) throw new Error('no basket cell');
    const inside = rack0.dims.frameWireMm / 1000 + 0.012;
    const yFrom = lastCell.inner.max[1] + 0.012;
    const yTo = rack0.dims.depthMm / 1000 - inside;
    const xTo = rack0.dims.widthMm / 1000 - inside;

    // Candidate placements in the open part of the grid (clear of the basket, the tines and the
    // frame): across the front-to-back wires every 10 mm, and along them in the middle of a gap
    // every 5 mm. The verdict of the statics decides which are tried: only those at least 8 mm
    // from a different verdict.
    const candidates: { along: 'x' | 'y'; start: [number, number] }[] = [];
    for (let k = 0; k < 6; k++) {
      candidates.push({
        along: 'x',
        start: [xTo - footprint.length - k * 0.01, (yFrom + yTo) / 2],
      });
    }
    for (let y = yFrom; y + footprint.length <= yTo; y += 0.005) {
      candidates.push({ along: 'y', start: [gapLeft + pitchX / 2, y] });
    }
    const tried: { verdict: FlatDropVerdict; simulated: string }[] = [];
    const seen = { upper: 0, lower: 0, falls: 0 };
    for (const placement of candidates) {
      const verdict = flatDropVerdict(rack0, footprint, placement);
      if (verdict.outcome === 'undetermined' || verdict.margin < 0.008) continue;
      const kind =
        verdict.outcome === 'falls_through' ? 'falls' : verdict.on === 'upper' ? 'upper' : 'lower';
      // Three of each kind are plenty.
      if (seen[kind] >= 3) continue;
      seen[kind]++;

      const scene = await newScene();
      // Lying flat and level, its handle end at the start point, 20 mm above the grid.
      const yaw = placement.along === 'x' ? 0 : Math.PI / 2;
      const q = orientationOf(spoon, 'flat', yaw);
      const turned = boundingBox(spoon.shape, { p: [0, 0, 0], q });
      const p: Vec3 =
        placement.along === 'x'
          ? [placement.start[0] - turned.min[0], placement.start[1], 0.02 - turned.min[2]]
          : [placement.start[0], placement.start[1] - turned.min[1], 0.02 - turned.min[2]];
      const item = addItem(scene, 'spoon', SPOON, { p, q });
      const meter = overlapMeter(scene);
      let deepest = 0;
      for (let i = 0; i < 480; i++) {
        scene.world.step(1);
        if (i % 2 === 0) deepest = Math.max(deepest, meter().deepest);
      }
      expect(settleScene(scene).atRest).toBe(true);
      expect(Math.max(deepest, meter().deepest)).toBeLessThan(MAX_PENETRATION);
      const parts = touching(scene, 'spoon');
      const lowest = bodyBounds(scene, item).min[2];
      const label = `${placement.along} from (${(placement.start[0] * 1000).toFixed(0)}, ${(
        placement.start[1] * 1000
      ).toFixed(0)}) mm: ${JSON.stringify(verdict)}; rests on ${parts.join(', ')}`;
      const onFloor = parts.some((part) => part.startsWith(`${TUB_FLOOR_ID}:`));
      const simulated = onFloor
        ? 'falls'
        : parts.every((part) => part.startsWith(`${RACK_ID}:grid_y.`))
          ? 'upper'
          : parts.every((part) => part.startsWith(`${RACK_ID}:grid_x.`))
            ? 'lower'
            : 'other';
      tried.push({ verdict, simulated });
      expect(simulated, label).toBe(kind);
      if (kind === 'falls') {
        // It has gone down between the wires until it met the tub floor.
        expect(Math.abs(lowest - scene.rack.tubFloorZ), label).toBeLessThan(0.2 * MM);
      } else {
        // Carried by the grid, level to within its own curvature, nowhere near the floor.
        expect(parts.length, label).toBeGreaterThanOrEqual(2);
        expect(lowest, label).toBeGreaterThan(-2.5 * scene.rack.opening.lowerLayerDrop);
        expect(axisFromUpDeg(scene.world.getPose('spoon').q), label).toBeLessThan(6);
        expect(probeStability(scene.world, { bodies: probeBodies([item]) }).stable, label).toBe(
          true,
        );
      }
    }
    // On the stand-in rack all three happen: across the wires the spoon rests on the upper
    // layer; along them in a gap it rests on two wires of the lower layer when they straddle
    // its centre of mass and tips through over a single one otherwise. A rack with other
    // openings may leave some of these out, and this line is then the one to change.
    expect(seen).toEqual({ upper: 3, lower: 3, falls: 3 });
    expect(tried).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------------------------
// f. Cutlery dropped into the basket
// ---------------------------------------------------------------------------------------------

describe('f. cutlery dropped into the basket', () => {
  it('every piece stays in its cell, on the floor of the basket, and comes to rest', async () => {
    const scene = await newScene();
    const pieces = loadCutlery(scene);
    expect(pieces).toHaveLength(2 * scene.rack.cells.length);
    const ids = itemIds(scene);
    const rim = (scene.rack.cells[0] as { inner: { max: Vec3 } }).inner.max[2];
    /**
     * How far any point of any piece is outside the clear space of its own cell, metres: below
     * the cell floor, or beyond a wall while lower than 2 mm under the rim. Measured on the
     * corner points of the collision pieces with their rounding radius.
     */
    const excursion = (): number => {
      let worst = 0;
      for (const { item, cell } of pieces) {
        for (const core of placedCores({
          pieces: item.pieces,
          pose: scene.world.getPose(item.id),
        })) {
          for (const loop of core.loops) {
            for (const point of loop) {
              worst = Math.max(worst, cell.inner.min[2] - (point[2] - core.radius));
              if (point[2] >= rim - 0.002) continue;
              worst = Math.max(
                worst,
                cell.inner.min[0] - (point[0] - core.radius),
                point[0] + core.radius - cell.inner.max[0],
                cell.inner.min[1] - (point[1] - core.radius),
                point[1] + core.radius - cell.inner.max[1],
              );
            }
          }
        }
      }
      return worst;
    };
    expect(excursion()).toBeLessThanOrEqual(0);
    const meter = overlapMeter(scene);
    let worst = 0;
    let deepest = 0;
    let fastestEver = 0;
    for (let i = 0; i < 720; i++) {
      scene.world.step(1);
      fastestEver = Math.max(fastestEver, fastest(scene, ids).linear);
      if (i % 2 === 0) worst = Math.max(worst, excursion());
      if (i % 6 === 0) deepest = Math.max(deepest, meter().deepest);
    }
    // The second piece of a cell falls 110 mm at most: 1.47 m/s. Nothing is ever faster.
    expect(fastestEver).toBeLessThan(Math.sqrt(2 * STANDARD_GRAVITY * 0.11) + 0.05);
    // No point of any piece is ever more than 0.2 mm inside a wall or the floor (walls: 2 mm).
    expect(worst).toBeLessThan(MAX_PENETRATION);
    expect(deepest).toBeLessThan(MAX_PENETRATION);
    expect(settleScene(scene).atRest).toBe(true);
    expect(excursion()).toBeLessThan(MAX_PENETRATION);
    const reading = meter();
    expect(reading.deepest).toBeLessThan(MAX_PENETRATION);
    for (const { item, cell } of pieces) {
      const pose = scene.world.getPose(item.id);
      // Handle down on the floor of its own cell...
      const bounds = bodyBounds(scene, item);
      expect(Math.abs(bounds.min[2] - cell.inner.min[2]), item.id).toBeLessThan(0.2 * MM);
      const handleEnd = poseTransformPoint(pose, [item.instance.bbox.min[0], 0, 0]);
      expect(handleEnd[0], item.id).toBeGreaterThan(cell.inner.min[0]);
      expect(handleEnd[0], item.id).toBeLessThan(cell.inner.max[0]);
      expect(handleEnd[1], item.id).toBeGreaterThan(cell.inner.min[1]);
      expect(handleEnd[1], item.id).toBeLessThan(cell.inner.max[1]);
      // ...leaning against a wall or its neighbour, head up: a 130 mm teaspoon across a 60 mm
      // cell can lean by no more than asin(diagonal of the cell / its length) or so.
      const long = quatRotate(pose.q, [1, 0, 0]);
      const leanFromUp = Math.acos(Math.max(-1, Math.min(1, long[2]))) / DEG;
      expect(leanFromUp, item.id).toBeLessThan(45);
      // It touches the basket (and perhaps its neighbour in the cell), never the rack wires.
      const others = new Set(touching(scene, item.id).map((part) => part.split(':')[0]));
      expect(others.has(BASKET_ID), item.id).toBe(true);
      expect(others.has(RACK_ID), item.id).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// g. A wine glass and a light polypropylene container
// ---------------------------------------------------------------------------------------------

describe('g. a wine glass and light polypropylene ware on the grid', () => {
  it.each([
    ['wine_glass_red_540', 'upright'],
    ['wine_glass_red_540', 'inverted'],
    ['food_container_600ml', 'upright'],
    ['food_container_600ml', 'inverted'],
    ['drinking_cup_pp_400', 'inverted'],
  ] as const)(
    '%s, %s, dropped 20 mm: lands, stays where it landed, and rests on the wires',
    async (typeId, poseName) => {
      const scene = await newScene();
      const instance = instantiate(typeId);
      const at = openGrid(scene);
      const drop = 0.02;
      const q = orientationOf(instance, poseName, 0.3);
      const pieces = collisionPiecesOf(instance.shape);
      // Where it would stand: lowered until it touches. Then released 20 mm higher.
      const standing = lowerToContact(
        scene,
        pieces,
        poseOver(instance.shape, q, at.x, at.y, 0.3),
        0.35,
        0,
      );
      expect(standing.with).toBe(RACK_ID);
      const restLowest = boundingBox(instance.shape, standing.pose).min[2];
      // A flat base or rim stands on top of the wires; a round one may sit a little between them.
      expect(restLowest).toBeLessThan(0.05 * MM);
      expect(restLowest).toBeGreaterThan(-1 * MM);
      const item = addItem(scene, 'item', typeId, {
        p: [standing.pose.p[0], standing.pose.p[1], standing.pose.p[2] + drop],
        q,
      });
      const meter = overlapMeter(scene);
      // Standing at rest is where its centre of mass is lowest: anything lower has sunk in.
      const restCom = poseTransformPoint(standing.pose, instance.mass.com)[2];
      let deepest = 0;
      let fastestEver = { linear: 0, angular: 0 };
      let lowestCom = Infinity;
      let highestLate = -Infinity;
      for (let i = 0; i < 480; i++) {
        scene.world.step(1);
        const now = fastest(scene, ['item']);
        fastestEver = {
          linear: Math.max(fastestEver.linear, now.linear),
          angular: Math.max(fastestEver.angular, now.angular),
        };
        deepest = Math.max(deepest, meter().deepest);
        const com = itemPoint(scene, 'item', instance.mass.com)[2];
        lowestCom = Math.min(lowestCom, com);
        if (i > 24) highestLate = Math.max(highestLate, com);
      }
      // No explosion: never faster than its free fall, never spinning; after landing it never
      // rises to half the height it was dropped from (it bounces a few millimetres).
      expect(fastestEver.linear).toBeLessThanOrEqual(Math.sqrt(2 * STANDARD_GRAVITY * drop) + 1e-6);
      expect(fastestEver.angular).toBeLessThan(3);
      expect(highestLate - restCom).toBeLessThan(drop / 2);
      // No sinking: its centre of mass never comes 0.2 mm lower than where it rests, and it never
      // overlaps a wire by 0.2 mm.
      expect(lowestCom - restCom).toBeGreaterThan(-MAX_PENETRATION);
      expect(deepest).toBeLessThan(MAX_PENETRATION);

      expect(settleScene(scene).atRest).toBe(true);
      const pose = scene.world.getPose('item');
      // At rest where it landed, the way up it was dropped, on the grid.
      expect(Math.abs(bodyBounds(scene, item).min[2] - restLowest)).toBeLessThan(0.1 * MM);
      const tilt = poseName === 'inverted' ? 180 - axisFromUpDeg(pose.q) : axisFromUpDeg(pose.q);
      expect(tilt).toBeLessThan(0.5);
      expect(
        Math.hypot(pose.p[0] - standing.pose.p[0], pose.p[1] - standing.pose.p[1]),
      ).toBeLessThan(3 * MM);
      expect(touching(scene, 'item').every((part) => part.startsWith(`${RACK_ID}:grid_y.`))).toBe(
        true,
      );
      expect(measureOverlap(scene).deepest).toBeLessThan(MAX_PENETRATION);
      // The floor carries its weight, 41 to 184 g, to 2 %.
      const carried = scene.world
        .contacts({ bodies: ['item'] })
        .reduce((sum, c) => sum + c.normalForceN * Math.abs(c.normal[2]), 0);
      expect(Math.abs(carried / (instance.mass.mass * STANDARD_GRAVITY) - 1)).toBeLessThan(0.02);
      expect(probeStability(scene.world, { bodies: probeBodies([item]) })).toEqual({
        stable: true,
        unstable: [],
      });
      expect(exactOverlap(scene, 'item')?.depth ?? 0).toBeLessThan(MAX_EXACT_OVERLAP);
    },
  );
});
