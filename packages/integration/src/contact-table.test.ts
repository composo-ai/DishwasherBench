// Friction and restitution from the catalogue's pair table, measured on catalogue items in the
// physics world against the closed forms of a sliding block and a bouncing ball. This is the
// path a coefficient takes: material of a part (catalogue) -> material of its collision pieces
// (geometry) -> pair lookup by the two materials in contact (physics).
import { contactPairLookup, frictionPair, instantiate } from '@spotless/catalogue';
import { POSE_IDENTITY, STANDARD_GRAVITY } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import type { JoltPhysicsWorld } from '@spotless/physics';
import {
  JOLT_SETTINGS,
  LOADING_GRAVITY,
  LOADING_TIME_STEP,
  NO_MASS,
  createPhysicsWorld,
  settleOptionsFor,
} from '@spotless/physics';
import { afterEach, describe, expect, it } from 'vitest';
import { collisionPiecesOf, createLoadingScene, lowerToContact, poseOver } from './scene.ts';
import { RACK_MATERIAL } from './stand-in-rack.ts';

const DT = LOADING_TIME_STEP;
const MM = 1e-3;

const live: JoltPhysicsWorld[] = [];
afterEach(() => {
  for (const world of live.splice(0)) world.dispose();
});

/** A flat slab of a catalogue material, 1.2 m square, its top on z = 0. */
function floorOf(material: string): Shape {
  return {
    parts: [
      {
        id: 'floor',
        prim: { kind: 'rbox', halfExtents: [0.6, 0.6, 0.01], radius: 0 },
        pose: { p: [0, 0, -0.01], q: [0, 0, 0, 1] },
        material,
      },
    ],
    regions: [],
  };
}

/**
 * Lets an item of the catalogue come to rest on a flat floor of the given material, pushes it
 * off at `speed` and returns how far it slides and which of its parts carried it.
 */
async function slide(
  typeId: string,
  poseName: string,
  floorMaterial: string,
  wet: boolean,
  speed: number,
): Promise<{ distance: number; parts: string[] }> {
  const world = await createPhysicsWorld({
    timeStep: DT,
    gravity: LOADING_GRAVITY,
    pairLookup: contactPairLookup(wet),
  });
  live.push(world);
  const floor = floorOf(floorMaterial);
  world.addBody(
    'floor',
    collisionPiecesOf(floor),
    NO_MASS,
    { material: floorMaterial },
    POSE_IDENTITY,
    'static',
  );
  const instance = instantiate(typeId);
  const q = instance.stablePoses.find((pose) => pose.name === poseName)?.q;
  if (q === undefined) throw new Error(`no pose ${poseName}`);
  world.addBody(
    'item',
    collisionPiecesOf(instance.shape),
    instance.mass,
    instance.contact,
    poseOver(instance.shape, q, 0, 0, 0.0003),
    'dynamic',
  );
  expect(world.settle(settleOptionsFor(DT)).atRest).toBe(true);
  const parts = [
    ...new Set(
      world.contacts({ bodies: ['item'] }).map((c) => (c.a === 'item' ? c.partA : c.partB)),
    ),
  ].sort();
  const start = world.getPose('item');
  world.applyImpulse('item', [instance.mass.mass * speed, 0, 0]);
  for (let i = 0; i < 2400; i++) {
    world.step(1);
    const v = world.getVelocity('item').linear;
    if (Math.hypot(v[0], v[1]) < 1e-6) break;
  }
  const end = world.getPose('item');
  // It slid straight and stayed flat on the floor.
  expect(Math.abs(end.p[1] - start.p[1])).toBeLessThan(0.2 * MM);
  expect(Math.abs(end.p[2] - start.p[2])).toBeLessThan(0.05 * MM);
  return { distance: end.p[0] - start.p[0], parts };
}

/**
 * How far a body pushed off at `speed` slides against a friction coefficient `mu`, in the
 * engine's time stepping: each step first takes mu g dt off the speed and then moves, so the
 * distance is the continuous v^2 / (2 mu g) less half a step of the initial speed.
 */
function slideDistance(speed: number, mu: number): number {
  return (speed * speed) / (2 * mu * STANDARD_GRAVITY) - (speed * DT) / 2;
}

describe('friction comes from the catalogue pair of the two materials in contact', () => {
  const speed = 0.4;
  // Item, pose, the part it rests on and the material of that part.
  const cases = [
    ['chopping_board_pe_340', 'flat', 'body', 'polyethylene'],
    ['chopping_board_beech_380', 'flat', 'body', 'beech'],
    ['tumbler_250', 'upright', 'body', 'glass_soda_lime'],
    ['frying_pan_nonstick_280', 'upright', 'body', 'aluminium_nonstick'],
    ['skillet_cast_iron_260', 'upright', 'body', 'cast_iron_seasoned'],
    ['bottle_teat_silicone', 'upright', 'body', 'silicone'],
  ] as const;

  it.each(cases)(
    '%s (%s) slides v^2 / (2 mu g) on steel and on rack coating, dry and wet (1 %%)',
    async (typeId, poseName, part, material) => {
      for (const floorMaterial of ['stainless_steel', RACK_MATERIAL]) {
        const distances: number[] = [];
        for (const wet of [false, true]) {
          const mu = frictionPair(material, floorMaterial, wet).friction;
          const got = await slide(typeId, poseName, floorMaterial, wet, speed);
          expect(got.parts, `${floorMaterial} ${wet ? 'wet' : 'dry'}`).toEqual([part]);
          const expected = slideDistance(speed, mu);
          expect(
            Math.abs(got.distance / expected - 1),
            `${floorMaterial} ${wet ? 'wet' : 'dry'}: ${(got.distance * 1000).toFixed(2)} mm, mu ${mu}`,
          ).toBeLessThan(0.01);
          distances.push(got.distance);
        }
        // Wet surfaces are never grippier in the table, so nothing slides less far when wet.
        expect(distances[1] as number).toBeGreaterThanOrEqual((distances[0] as number) - 1e-6);
      }
    },
  );

  it('a plate slides on what it stands on: its unglazed foot upright, its glazed rim turned over', async () => {
    // The foot ring is a part of its own with its own material, and the pair table has a
    // separate, much higher row for unglazed ceramic. Upright, the plate rests on the foot ring
    // alone; turned over, on the glazed rim. The body's material would give the same distance
    // both ways.
    const plate = instantiate('dinner_plate_porcelain_iec');
    expect(plate.contact.material).toBe('porcelain_glazed');
    for (const floorMaterial of ['stainless_steel', RACK_MATERIAL]) {
      for (const wet of [false, true]) {
        const unglazed = frictionPair('porcelain_unglazed', floorMaterial, wet).friction;
        const glazed = frictionPair('porcelain_glazed', floorMaterial, wet).friction;
        expect(unglazed).toBeGreaterThan(1.5 * glazed);
        const upright = await slide(
          'dinner_plate_porcelain_iec',
          'upright',
          floorMaterial,
          wet,
          speed,
        );
        const inverted = await slide(
          'dinner_plate_porcelain_iec',
          'inverted',
          floorMaterial,
          wet,
          speed,
        );
        expect(upright.parts).toEqual(['foot']);
        expect(inverted.parts).toEqual(['body']);
        expect(Math.abs(upright.distance / slideDistance(speed, unglazed) - 1)).toBeLessThan(0.01);
        expect(Math.abs(inverted.distance / slideDistance(speed, glazed) - 1)).toBeLessThan(0.01);
        expect(inverted.distance).toBeGreaterThan(1.5 * upright.distance);
      }
    }
  });
});

describe('restitution comes from the same pair', () => {
  // Item, pose, the material that meets the rack wires. Three rows of the table: 0.35 for
  // plastics, 0.30 for glass and 0.25 for ceramic on coated wire.
  const cases = [
    ['food_container_600ml', 'upright', 'polypropylene'],
    ['melamine_bowl_150', 'inverted', 'melamine'],
    ['tumbler_250', 'inverted', 'glass_soda_lime'],
    ['mug_ceramic_300', 'inverted', 'porcelain_glazed'],
  ] as const;

  it.each(cases)(
    '%s (%s) dropped onto the grid leaves at e times the speed it arrived with (4 %%)',
    async (typeId, poseName, material) => {
      const e = frictionPair(material, RACK_MATERIAL, false).restitution;
      const g = STANDARD_GRAVITY;
      for (const drop of [0.05, 0.1]) {
        const scene = await createLoadingScene({ basket: false });
        live.push(scene.world);
        const instance = instantiate(typeId);
        const pieces = collisionPiecesOf(instance.shape);
        const q = instance.stablePoses.find((pose) => pose.name === poseName)?.q;
        if (q === undefined) throw new Error(`no pose ${poseName}`);
        // Over the open part of the grid, centred between two wires so that it lands level.
        const x =
          ((scene.rack.wiresAlongY[11] as number) + (scene.rack.wiresAlongY[12] as number)) / 2;
        const touching = lowerToContact(
          scene,
          pieces,
          poseOver(instance.shape, q, x, 0.37, 0.3),
          0.35,
          0,
        );
        const rest = touching.pose.p[2];
        scene.world.addBody(
          'item',
          pieces,
          instance.mass,
          instance.contact,
          { p: [touching.pose.p[0], touching.pose.p[1], rest + drop], q },
          'dynamic',
        );
        let arriving = 0;
        let leaving = 0;
        let gapAtBounce = 0;
        let apex = 0;
        for (let i = 0; i < 240; i++) {
          const before = scene.world.getVelocity('item').linear[2];
          const heightBefore = scene.world.getPose('item').p[2] - rest;
          scene.world.step(1);
          const after = scene.world.getVelocity('item').linear[2];
          if (leaving === 0 && before < -0.3 && after > 0) {
            arriving = -before;
            leaving = after;
            gapAtBounce = heightBefore;
          }
          if (leaving > 0) apex = Math.max(apex, scene.world.getPose('item').p[2] - rest);
        }
        // In the engine's stepping a body has fallen g dt^2 n (n + 1) / 2 after n steps and
        // moves at g n dt. It turns round in the first step that would carry it past the wires:
        // after the n whole steps that fit into the drop.
        const n = Math.floor((-1 + Math.sqrt(1 + (8 * drop) / (g * DT * DT))) / 2);
        const label = `drop ${drop * 1000} mm: in ${arriving.toFixed(3)}, out ${leaving.toFixed(3)} m/s, e ${e}`;
        expect(Math.abs(arriving - g * n * DT), label).toBeLessThan(1e-3);
        expect(arriving).toBeGreaterThan(JOLT_SETTINGS.minVelocityForRestitution);
        // It leaves at e times the speed it arrived with.
        expect(Math.abs(leaving / arriving / e - 1), label).toBeLessThan(0.04);
        // KNOWN ARTEFACT of the engine, kept visible: it reverses the speed in the step in which
        // it predicts the contact, before the surfaces touch (speculative contacts), so the item
        // turns round above the grid, by what was left of the drop after those n steps (up to
        // one step of travel), and its bounce peaks that much higher than a real one would.
        const fallen = (g * DT * DT * n * (n + 1)) / 2;
        expect(Math.abs(gapAtBounce - (drop - fallen)), label).toBeLessThan(0.1 * MM);
        expect(gapAtBounce).toBeLessThan((arriving + g * DT) * DT);
        // The rise after it, step by step: v dt + (v - g dt) dt + ... = v^2 / (2 g) + v dt / 2.
        const rise = (leaving * leaving) / (2 * g) + (leaving * DT) / 2;
        expect(Math.abs(apex - (gapAtBounce + rise)), label).toBeLessThan(0.3 * MM);
        // A bounce from the surface itself would peak at e^2 h.
        expect(apex).toBeGreaterThan(e * e * drop);
      }
    },
  );
});
