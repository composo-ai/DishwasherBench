// Overlap and sweep queries against closed-form geometry and the engine-independent measurer.
import type { Pose, Vec3 } from '@spotless/core';
import { poseTransformPoint, quatFromAxisAngle } from '@spotless/core';
import type { CollisionBox, CollisionCapsule, CollisionPiece } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { pieceDistance } from './measure.ts';
import { JOLT_SETTINGS } from './settings.ts';
import { makePlate, plateInSlot, testRandom } from './test-shapes.ts';
import { AT_ORIGIN, NO_MASS, useWorlds } from './test-world.ts';

const DEG = Math.PI / 180;
const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });
const SURFACE = { material: 'steel' };

function box(part: string, half: Vec3, centre: Vec3 = [0, 0, 0]): CollisionBox {
  return { kind: 'box', part, halfExtents: half, radius: 0, pose: { p: centre, q: [0, 0, 0, 1] } };
}
function ball(radius: number): CollisionCapsule[] {
  return [{ kind: 'capsule', part: 'probe', a: [0, 0, 0], b: [0, 0, 0], radius }];
}

const newWorld = useWorlds();

describe('penetration', () => {
  it('measures how deep a ball is in a slab and names every body it is in', async () => {
    const world = await newWorld();
    // Two slabs whose top faces are the plane z = 0, meeting along the line x = 0.
    world.addBody(
      'right',
      [box('slab', [0.1, 0.1, 0.01], [0.1, 0, -0.01])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    world.addBody(
      'left',
      [box('slab', [0.1, 0.1, 0.01], [-0.1, 0, -0.01])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const r = 0.004;
    // Clear of everything.
    expect(world.penetration(ball(r), at(0.05, 0, 0.0045))).toEqual({
      depth: 0,
      with: [],
      parts: [],
    });
    // 1 mm into the right slab only (to a micrometre). The part of the body that is met is
    // named with it, as a contact names it.
    const one = world.penetration(ball(r), at(0.05, 0, 0.003));
    expect(one.with).toEqual(['right']);
    expect(one.parts).toEqual(['slab']);
    expect(one.depth).toBeCloseTo(0.001, 6);
    // 1 mm to the right of the seam: 2.5 mm into the top face of the right slab and less deep
    // into the edge of the left one (sharp edges carry a 0.2 mm rounding in the engine, so the
    // face is probed away from them). The ids come back sorted and the depth is the deepest.
    const both = world.penetration(ball(r), at(0.001, 0, 0.0015));
    expect(both.with).toEqual(['left', 'right']);
    expect(both.depth).toBeCloseTo(0.0025, 6);
    // Ignoring a body takes it out of the answer; ignoring a stranger changes nothing.
    expect(world.penetration(ball(r), at(0.001, 0, 0.0015), ['left', 'nobody']).with).toEqual([
      'right',
    ]);
    const leftOnly = world.penetration(ball(r), at(0.001, 0, 0.0015), ['right']);
    expect(leftOnly.with).toEqual(['left']);
    // The left slab's edge is hypot(1, 1.5) = 1.80 mm from the centre: about 2.2 mm deep.
    expect(leftOnly.depth).toBeGreaterThan(0.0021);
    expect(leftOnly.depth).toBeLessThan(0.0025 - 1e-5);
  });

  it('agrees with the measurer on the true rounded shape of a plate', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    const plate = makePlate(36);
    const pose = plateInSlot(plate, 6);
    world.addBody('plate', plate.pieces, plate.mass, SURFACE, pose, 'dynamic');
    const probe: CollisionCapsule = {
      kind: 'capsule',
      part: 'p',
      a: [0, 0, 0],
      b: [0, 0, 0],
      radius: 0.001,
    };
    const random = testRandom(7);
    let worst = 0;
    let samples = 0;
    for (let i = 0; i < 6000; i++) {
      const local: Vec3 = [
        (random() - 0.5) * 0.27,
        (random() - 0.5) * 0.27,
        -0.004 + random() * 0.034,
      ];
      const p = poseTransformPoint(pose, local);
      let trueDistance = Infinity;
      for (const piece of plate.pieces) {
        trueDistance = Math.min(
          trueDistance,
          pieceDistance(piece, pose, probe, { p, q: [0, 0, 0, 1] }),
        );
      }
      // Shallow overlaps only, where the measurer is exact (its depth saturates at the radii).
      if (trueDistance > -0.0001 || trueDistance < -0.0009) continue;
      const result = world.penetration([probe], { p, q: [0, 0, 0, 1] });
      worst = Math.max(worst, Math.abs(result.depth - -trueDistance));
      samples++;
    }
    expect(samples).toBeGreaterThan(150);
    // The engine's proxy is the true shape except along rounded edges left without a capsule.
    // On the edge of a solid it is smaller there by at most `roundedEdgeSag` (0.05 mm). At a
    // fold of the wall, where the two prisms are mitred, it stands proud by
    // r (1 / cos(fold / 2) - 1), which for a fold whose sag r (1 - cos(fold / 2)) is within
    // `roundedFoldSag` is no more than that sag over 1 - sag / r: 0.104 mm for the 5 mm wall of
    // this plate (its 31 degree fold between well and cavetto: 0.094 mm; measured on these
    // samples 0.066 mm).
    const foldBound = JOLT_SETTINGS.roundedFoldSag / (1 - JOLT_SETTINGS.roundedFoldSag / 0.0025);
    expect(foldBound).toBeLessThan(0.000105);
    expect(worst).toBeLessThan(Math.max(JOLT_SETTINGS.roundedEdgeSag, foldBound) + 1e-6);
  });

  it('is exact on the rim of the plate, which is a capsule in the engine', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    const plate = makePlate(36);
    world.addBody('plate', plate.pieces, plate.mass, SURFACE, AT_ORIGIN, 'dynamic');
    const probe: CollisionCapsule = {
      kind: 'capsule',
      part: 'p',
      a: [0, 0, 0],
      b: [0, 0, 0],
      radius: 0.002,
    };
    // The rim's mid-surface ends at r = 128 mm, z = 22 mm; the last wall piece is 5 mm thick at
    // one end and 4 mm at the other, so its rounding radius is 2.25 mm. Probe it from outside,
    // from above and from below at the middle of a sector (azimuth 5 degrees), where the
    // faceted rim line is 128 cos(5 deg) from the axis.
    const rim = 0.00225;
    const mid = 0.128 * Math.cos(5 * DEG);
    for (const [dr, dz] of [
      [1, 0],
      [0.6, 0.8],
      [0.6, -0.8],
    ] as const) {
      const reach = rim + probe.radius - 0.0005; // 0.5 mm deep
      const radial = mid + dr * reach;
      const p: Vec3 = [radial * Math.cos(5 * DEG), radial * Math.sin(5 * DEG), 0.022 + dz * reach];
      expect(world.penetration([probe], at(p[0], p[1], p[2])).depth).toBeCloseTo(0.0005, 6);
    }
  });

  it('accepts a probe made of several pieces at any pose', async () => {
    const world = await newWorld();
    world.addBody(
      'post',
      [{ kind: 'capsule', part: 'post', a: [0, 0, 0], b: [0, 0, 0.1], radius: 0.002 }],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    // An L of two capsules, turned a quarter turn about z and placed so that its second arm
    // (along +y after the turn) passes the post 3 mm away: radii 2 + 2 leave 1 mm of overlap.
    const probe: CollisionPiece[] = [
      { kind: 'capsule', part: 'a', a: [0, 0, 0], b: [0, 0, 0.05], radius: 0.002 },
      { kind: 'capsule', part: 'b', a: [0, 0, 0.05], b: [0.05, 0, 0.05], radius: 0.002 },
    ];
    const pose: Pose = { p: [0.003, -0.02, 0], q: quatFromAxisAngle([0, 0, 1], Math.PI / 2) };
    const result = world.penetration(probe, pose);
    expect(result.with).toEqual(['post']);
    expect(result.depth).toBeCloseTo(0.001, 6);
  });
});

describe('sweep', () => {
  it('finds where a ball first touches a wall', async () => {
    const world = await newWorld();
    // A wall whose near face is the plane x = 0.1.
    world.addBody(
      'wall',
      [box('wall', [0.01, 0.1, 0.1], [0.11, 0, 0])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const r = 0.005;
    const hit = world.sweep(ball(r), at(0, 0, 0), at(0.2, 0, 0));
    // The centre stops r short of the face: 95 mm of 200 mm. The engine reports contact one
    // collision tolerance (1 micrometre) early at most.
    expect(hit.hit).toBe(true);
    expect(hit.with).toBe('wall');
    // (The part of the body that was hit, as a contact names it.)
    expect(hit.part).toBe('wall');
    expect(hit.fraction).toBeCloseTo(0.475, 4);
    expect(hit.fraction).toBeLessThanOrEqual(0.475 + 1e-6);
    // Stopping short of the wall: no hit, fraction 1 and no body named.
    const miss = world.sweep(ball(r), at(0, 0, 0), at(0.09, 0, 0));
    expect(miss).toEqual({ hit: false, fraction: 1 });
    // Passing beside it.
    expect(world.sweep(ball(r), at(0, 0.2, 0), at(0.2, 0.2, 0)).hit).toBe(false);
    // Ignoring the wall.
    expect(world.sweep(ball(r), at(0, 0, 0), at(0.2, 0, 0), ['wall']).hit).toBe(false);
  });

  it('reports a sweep that starts in contact at fraction 0, whichever way it heads', async () => {
    const world = await newWorld();
    world.addBody(
      'wall',
      [box('wall', [0.01, 0.1, 0.1], [0.11, 0, 0])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const towards = world.sweep(ball(0.005), at(0.097, 0, 0), at(0.12, 0, 0));
    const away = world.sweep(ball(0.005), at(0.097, 0, 0), at(0, 0, 0));
    expect(towards).toMatchObject({ hit: true, fraction: 0, with: 'wall' });
    expect(away).toMatchObject({ hit: true, fraction: 0, with: 'wall' });
  });

  it('names the first body in id order when two are met at once', async () => {
    const slab = (y: number): CollisionPiece[] => [box('slab', [0.01, 0.02, 0.1], [0.11, y, 0])];
    // Two walls with their faces in the plane x = 0.1 and a probe of two balls, one in front of
    // each: both meet their wall at exactly the same fraction.
    const pair: CollisionPiece[] = [
      { kind: 'capsule', part: 'p', a: [0, -0.03, 0], b: [0, -0.03, 0], radius: 0.005 },
      { kind: 'capsule', part: 'p', a: [0, 0.03, 0], b: [0, 0.03, 0], radius: 0.005 },
    ];
    const world = await newWorld();
    world.addBody('wall_b', slab(0.03), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('wall_a', slab(-0.03), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    const hit = world.sweep(pair, at(0, 0, 0), at(0.2, 0, 0));
    expect(hit.with).toBe('wall_a');
    expect(hit.fraction).toBeCloseTo(0.475, 4);
    // Each ball alone meets its own wall at that same fraction.
    expect(world.sweep(pair, at(0, 0, 0), at(0.2, 0, 0), ['wall_a'])).toEqual({
      ...hit,
      with: 'wall_b',
    });
    // Whatever order the walls were added in.
    const other = await newWorld();
    other.addBody('wall_a', slab(-0.03), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    other.addBody('wall_b', slab(0.03), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    expect(other.sweep(pair, at(0, 0, 0), at(0.2, 0, 0))).toEqual(hit);
  });

  it('interpolates the orientation along the path', async () => {
    const world = await newWorld();
    // A post at 100 mm from the origin, 60 degrees round from +x.
    const rho = 0.1;
    const phi = 60 * DEG;
    world.addBody(
      'post',
      [
        {
          kind: 'capsule',
          part: 'post',
          a: [rho * Math.cos(phi), rho * Math.sin(phi), -0.05],
          b: [rho * Math.cos(phi), rho * Math.sin(phi), 0.05],
          radius: 0.005,
        },
      ],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    // A rod of radius 5 mm from the origin along +x, turned a quarter turn about z in place.
    const rod: CollisionPiece[] = [
      { kind: 'capsule', part: 'rod', a: [0, 0, 0], b: [0.2, 0, 0], radius: 0.005 },
    ];
    const from: Pose = AT_ORIGIN;
    const to: Pose = { p: [0, 0, 0], q: quatFromAxisAngle([0, 0, 1], Math.PI / 2) };
    const hit = world.sweep(rod, from, to);
    // The rod's axis comes within 10 mm of the post's when rho sin(phi - theta) = 0.01:
    // theta = 60 deg - asin(0.1) = 54.26 deg, 0.6029 of the quarter turn. A turning sweep is
    // resolved to 1 mm of arc: 0.0032 of this path at the rod's tip.
    expect(hit.with).toBe('post');
    expect(Math.abs(hit.fraction - (phi - Math.asin(0.1)) / (Math.PI / 2))).toBeLessThan(0.005);
    // Turning the other way never reaches it.
    const back: Pose = { p: [0, 0, 0], q: quatFromAxisAngle([0, 0, 1], -Math.PI / 2) };
    expect(world.sweep(rod, from, back).hit).toBe(false);
  });

  it('lowers a plate onto a wire to the height geometry dictates', async () => {
    const world = await newWorld();
    world.addBody(
      'wire',
      [{ kind: 'capsule', part: 'wire', a: [-0.2, 0, 0], b: [0.2, 0, 0], radius: 0.002 }],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const plate = makePlate(36);
    // Upright plate coming straight down with the wire passing under the middle of its foot
    // ring, whose underside is the plane z = 0 of the item frame: contact when the plate origin
    // is 2 mm (the wire's radius) above the wire's axis.
    const hit = world.sweep(plate.pieces, at(0, 0, 0.05), at(0, 0, 0));
    expect(hit.with).toBe('wire');
    expect(0.05 * (1 - hit.fraction)).toBeCloseTo(0.002, 5);
  });
});
