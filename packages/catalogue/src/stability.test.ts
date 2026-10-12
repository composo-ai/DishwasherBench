import type { Pose, Quat } from '@spotless/core';
import { degToRad, quatFromAxisAngle, quatFromEulerXYZ, radToDeg } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { quantiseQuat, quatAngleBetween } from '@spotless/core';
import { instantiate, listItemTypes, poseQuaternion } from './catalogue.ts';
import {
  lowestPoint,
  restingComHeight,
  settlePose,
  STABILITY_PROBE_TILT,
  staticStability,
} from './stability.ts';

const IDENTITY: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };
const UPRIGHT: Quat = [0, 0, 0, 1];

/** A rounded box with core half extents (hx, hy, hz) and edge radius r, lying on z = 0. */
function block(hx: number, hy: number, hz: number, r: number): Shape {
  return {
    parts: [
      {
        id: 'body',
        prim: { kind: 'rbox', halfExtents: [hx, hy, hz], radius: r },
        pose: { p: [0, 0, hz + r], q: [0, 0, 0, 1] },
        material: 'beech',
      },
    ],
    regions: [],
  };
}

/** A ball of radius r resting on z = 0. */
function ball(r: number): Shape {
  return {
    parts: [
      {
        id: 'body',
        prim: { kind: 'capsule', a: [0, 0, r], b: [0, 0, r], radius: r },
        pose: IDENTITY,
        material: 'beech',
      },
    ],
    regions: [],
  };
}

describe('lowestPoint and restingComHeight', () => {
  it('finds the lowest point of a rotated box exactly', () => {
    // A sharp box 0.2 x 0.1 x 0.02 m centred on the origin, turned 30 degrees about y: its
    // lowest corner is at -(hx sin 30 + hz cos 30).
    const shape: Shape = {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [0.1, 0.05, 0.01], radius: 0 },
          pose: IDENTITY,
          material: 'beech',
        },
      ],
      regions: [],
    };
    const q = quatFromAxisAngle([0, 1, 0], degToRad(30));
    const expected = -(0.1 * Math.sin(degToRad(30)) + 0.01 * Math.cos(degToRad(30)));
    expect(lowestPoint(shape, q)).toBeCloseTo(expected, 14);
    // Its centre is the centre of mass: resting height is minus the lowest point.
    expect(restingComHeight(shape, [0, 0, 0], q)).toBeCloseTo(-expected, 14);
  });

  it('accounts for the pose of each part', () => {
    // Two balls of radius 10 mm, one at the origin and one 50 mm along x and 30 mm up, turned
    // 90 degrees about y so that +x points down: the lowest point is 50 + 10 mm below.
    const shape: Shape = {
      parts: [
        {
          id: 'a',
          prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: 0.01 },
          pose: IDENTITY,
          material: 'beech',
        },
        {
          id: 'b',
          prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: 0.01 },
          pose: { p: [0.05, 0, 0.03], q: quatFromAxisAngle([0, 0, 1], 1.2) },
          material: 'beech',
        },
      ],
      regions: [],
    };
    expect(lowestPoint(shape, quatFromAxisAngle([0, 1, 0], Math.PI / 2))).toBeCloseTo(-0.06, 14);
  });
});

describe('staticStability', () => {
  it('gives a block the tipping angle atan(half width / half height) of its core', () => {
    // Tilting about a rounded edge, the centre of mass is at
    // hx sin(a) + hz cos(a) + r above the plane: it peaks at tan(a) = hx / hz. The narrow
    // direction (y) tips first.
    const hx = 0.06;
    const hy = 0.03;
    const hz = 0.04;
    const r = 0.005;
    const shape = block(hx, hy, hz, r);
    const s = staticStability(shape, [0, 0, hz + r], UPRIGHT);
    expect(s.stable).toBe(true);
    expect(s.comHeight).toBeCloseTo(hz + r, 14);
    expect(radToDeg(s.tipAngle)).toBeCloseTo(radToDeg(Math.atan(hy / hz)), 4);
    // The weakest direction is along +y or -y.
    expect(Math.abs(Math.sin(s.weakestDirection))).toBeCloseTo(1, 9);
    // Under the probe tilt the centre of mass rises by hy sin(e) - hz (1 - cos(e)).
    const e = STABILITY_PROBE_TILT;
    expect(s.probeRise).toBeCloseTo(hy * Math.sin(e) - hz * (1 - Math.cos(e)), 12);
  });

  it('does not depend on the yaw of the pose', () => {
    const shape = block(0.06, 0.03, 0.04, 0.005);
    const turned = staticStability(shape, [0, 0, 0.045], quatFromAxisAngle([0, 0, 1], 0.7));
    expect(turned.stable).toBe(true);
    // The weakest direction (the normal of the long edge) falls between two probe directions
    // and is found by the refinement: the body's +y or -y axis, turned by the yaw.
    expect(radToDeg(turned.tipAngle)).toBeCloseTo(radToDeg(Math.atan(0.03 / 0.04)), 2);
    expect(Math.abs(Math.sin(turned.weakestDirection - 0.7))).toBeCloseTo(1, 4);
  });

  it('reports a block as unstable once its centre of mass is beyond the edge', () => {
    // Standing on its small face (turned 90 degrees about y), with the centre of mass moved
    // 12 mm sideways while the face is only 2 x 4 mm wide in the core.
    const shape = block(0.06, 0.004, 0.002, 0.001);
    const q = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    expect(staticStability(shape, [0, 0, 0.003], q).stable).toBe(true);
    const off = staticStability(shape, [0, 0.012, 0.003], q);
    expect(off.stable).toBe(false);
    expect(off.tipAngle).toBe(0);
    expect(off.probeRise).toBeLessThan(0);
  });

  it('calls a ball with a central centre of mass neutral, not stable', () => {
    const r = 0.03;
    const s = staticStability(ball(r), [0, 0, r], UPRIGHT);
    expect(s.stable).toBe(false);
    expect(Math.abs(s.probeRise)).toBeLessThan(1e-12);
  });

  it('finds a ball stable exactly when its centre of mass is below its centre', () => {
    // Centre of mass a distance d below the centre: the height of the centre of mass is
    // r - d cos(a), a minimum at a = 0; above the centre it is a maximum.
    const r = 0.03;
    const d = 0.01;
    const low = staticStability(ball(r), [0, 0, r - d], UPRIGHT);
    expect(low.stable).toBe(true);
    expect(low.comHeight).toBeCloseTo(r - d, 14);
    expect(low.probeRise).toBeCloseTo(d * (1 - Math.cos(STABILITY_PROBE_TILT)), 13);
    // It rights itself from any tilt up to a right angle.
    expect(low.tipAngle).toBeCloseTo(Math.PI / 2, 9);
    const high = staticStability(ball(r), [0, 0, r + d], UPRIGHT);
    expect(high.stable).toBe(false);
  });

  it('lets a capsule lie along its length only as a neutral pose (it rolls)', () => {
    const shape: Shape = {
      parts: [
        {
          id: 'body',
          prim: { kind: 'capsule', a: [0, 0, 0.01], b: [0.2, 0, 0.01], radius: 0.01 },
          pose: IDENTITY,
          material: 'beech',
        },
      ],
      regions: [],
    };
    const lying = staticStability(shape, [0.1, 0, 0.01], UPRIGHT);
    expect(lying.stable).toBe(false);
    // Standing on its end it falls over.
    const standing = staticStability(shape, [0.1, 0, 0.01], quatFromEulerXYZ(0, -Math.PI / 2, 0));
    expect(standing.stable).toBe(false);
    expect(standing.probeRise).toBeLessThan(0);
  });

  it('gives a flat-based tumbler the tipping angle atan(r / (h - t/2))', () => {
    // Thick shell of revolution with a flat base to mid-surface radius rc and thickness t: the
    // rounded base corner rolls, so the pivot is the corner's centre at height t/2. With the
    // centre of mass at height h on the axis, tan(tip) = rc / (h - t/2).
    const rc = 0.027;
    const t = 0.007;
    const shape: Shape = {
      parts: [
        {
          id: 'body',
          prim: {
            kind: 'sor',
            profile: [
              { r: 0, z: t / 2, t },
              { r: rc, z: t / 2, t },
              { r: rc, z: 0.09, t },
            ],
          },
          pose: IDENTITY,
          material: 'glass_soda_lime',
        },
      ],
      regions: [],
    };
    const h = 0.038;
    const s = staticStability(shape, [0, 0, h], UPRIGHT);
    expect(s.stable).toBe(true);
    expect(radToDeg(s.tipAngle)).toBeCloseTo(radToDeg(Math.atan(rc / (h - t / 2))), 3);
  });
});

describe('settlePose', () => {
  it('leaves a block on its base where it is, and brings one tilted within its base back', () => {
    // A block 40 x 40 x 100 mm (core half extents 19, 19, 49 mm, 1 mm edges).
    const shape = block(0.019, 0.019, 0.049, 0.001);
    const com: [number, number, number] = [0, 0, 0.05];
    const still = settlePose(shape, com, UPRIGHT);
    expect(still.settled).toBe(true);
    expect(still.rotation).toBe(0);
    expect(still.drop).toBe(0);
    // Tilted by 0.3 degrees about x it rests on an edge of its base; it comes back flat, the
    // centre of mass coming down by 19 sin(0.3 deg) - 49 (1 - cos(0.3 deg)) mm = 0.0988 mm.
    const tilt = degToRad(0.3);
    const back = settlePose(shape, com, quatFromAxisAngle([1, 0, 0], tilt));
    expect(back.settled).toBe(true);
    expect(radToDeg(back.rotation)).toBeCloseTo(0.3, 3);
    expect(back.drop).toBeCloseTo(0.019 * Math.sin(tilt) - 0.049 * (1 - Math.cos(tilt)), 7);
    expect(staticStability(shape, com, back.q).stable).toBe(true);
  });

  it('gives up on an item that is falling over', () => {
    // The same block tilted beyond its tipping angle, atan(19 / 49) = 21.2 degrees.
    const shape = block(0.019, 0.019, 0.049, 0.001);
    const falling = settlePose(shape, [0, 0, 0.05], quatFromAxisAngle([1, 0, 0], degToRad(22)));
    expect(falling.settled).toBe(false);
    expect(radToDeg(falling.rotation)).toBeGreaterThan(1);
    expect(falling.drop).toBeGreaterThan(0);
  });

  it('settles every free-standing pose of the catalogue within 0.02 degrees of its quantised form', () => {
    // The platform quantises a raw quaternion to 1e-4 per component (platform.md section 2).
    // An item released in a free-standing pose so rounded must come to rest next to it. The
    // strict test cannot say so: the chef's knife in its resting pose, rounded, is 0.008
    // degrees up one side of its resting place, and a tilt of 0.25 degrees towards the other,
    // much shallower side lowers its centre of mass by 1.2 micrometres.
    let poses = 0;
    let rounded = 0;
    for (const type of listItemTypes()) {
      const instance = instantiate(type.id);
      for (const pose of type.placement.stablePoses) {
        if (!pose.freeStanding) continue;
        poses++;
        const q = poseQuaternion(pose);
        const quantised = quantiseQuat(q);
        if (quantised === null) throw new Error('a pose without direction');
        const error = quatAngleBetween(q, quantised);
        expect(radToDeg(error)).toBeLessThan(0.012);
        if (error > 0) rounded++;
        const settled = settlePose(instance.shape, instance.mass.com, quantised);
        const label = `${type.id} / ${pose.name}`;
        expect(settled.settled, label).toBe(true);
        expect(radToDeg(settled.rotation), label).toBeLessThan(0.02);
        expect(staticStability(instance.shape, instance.mass.com, settled.q).stable, label).toBe(
          true,
        );
      }
    }
    expect(poses).toBeGreaterThan(170);
    // Most poses are on the grid already (quarter turns); some dozens are not.
    expect(rounded).toBeGreaterThan(10);
    const knife = instantiate('chefs_knife_200');
    const resting = knife.stablePoses.find((p) => p.name === 'resting');
    if (resting === undefined) throw new Error('no resting pose');
    const rough = quantiseQuat(resting.q) as Quat;
    expect(staticStability(knife.shape, knife.mass.com, resting.q).stable).toBe(true);
    expect(staticStability(knife.shape, knife.mass.com, rough).stable).toBe(false);
    expect(radToDeg(settlePose(knife.shape, knife.mass.com, rough).rotation)).toBeLessThan(0.012);
  });
});
