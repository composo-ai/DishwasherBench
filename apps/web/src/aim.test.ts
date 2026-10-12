import { describe, expect, it } from 'vitest';
import type { AimTarget } from './aim.ts';
import { aimFrame, aimPoint, missFromRay, rayAtHeight, rayThroughBox } from './aim.ts';
import type { DrawPose } from './pose.ts';
import { holdHeightMm, rayOnFramePlane } from './pose.ts';

/** A basket pulled out in front of the tub, its frame parallel to the tub's. */
const LOWER: DrawPose = { position_mm: [40, -520, 120], quat_wxyz: [1, 0, 0, 0] };
const UPPER: DrawPose = { position_mm: [40, -480, 520], quat_wxyz: [1, 0, 0, 0] };
const CUTLERY: DrawPose = { position_mm: [220, -500, 125], quat_wxyz: [1, 0, 0, 0] };

const lower = (rest: number): AimTarget => ({
  frame: 'lower_rack',
  pose: LOWER,
  envelope_mm: [520, 500, 220],
  rest_z_mm: rest,
});
const upper = (rest: number): AimTarget => ({
  frame: 'upper_rack',
  pose: UPPER,
  envelope_mm: [500, 480, 150],
  rest_z_mm: rest,
});
const cutlery = (rest: number): AimTarget => ({
  frame: 'cutlery_basket',
  pose: CUTLERY,
  envelope_mm: [140, 230, 215],
  rest_z_mm: rest,
  inner: true,
});

/** A camera in front, to the right and above, as the three-quarter view stands. */
const EYE: [number, number, number] = [1500, -1900, 1500];

/** The ray from the eye through a point of the tub frame. */
function rayThrough(point: readonly [number, number, number]): {
  origin: [number, number, number];
  direction: [number, number, number];
} {
  const d = [point[0] - EYE[0], point[1] - EYE[1], point[2] - EYE[2]];
  const length = Math.hypot(d[0] as number, d[1] as number, d[2] as number);
  return {
    origin: EYE,
    direction: [(d[0] as number) / length, (d[1] as number) / length, (d[2] as number) / length],
  };
}

describe('the ray to the landing', () => {
  it('puts the middle of the piece, standing where it rests, under the cursor', () => {
    // A glass 90 mm tall resting on the floor of the basket: its middle is 45 mm up.
    const rest = 45;
    const pointedAt: [number, number, number] = [
      LOWER.position_mm[0] + 300,
      LOWER.position_mm[1] + 200,
      LOWER.position_mm[2] + rest,
    ];
    const ray = rayThrough(pointedAt);
    const xy = aimPoint(lower(rest), ray.origin, ray.direction);
    expect(xy).toEqual([300, 200]);
    expect(missFromRay(LOWER, [300, 200, rest], ray.origin, ray.direction)).toBeLessThan(1);
  });

  it('is what the piece carried on a plane above the basket was not', () => {
    // The page used to carry the piece 15 mm above the rim (here 280 mm up) and let it fall
    // straight down from there: seen at an angle, it landed well short of the cursor.
    const rest = 45;
    const carried = holdHeightMm(220, [87, 87, 90], [0, 0, 0, 1]);
    const ray = rayThrough([
      LOWER.position_mm[0] + 300,
      LOWER.position_mm[1] + 200,
      LOWER.position_mm[2] + rest,
    ]);
    const old = rayOnFramePlane(LOWER, ray.origin, ray.direction, carried) as readonly [
      number,
      number,
    ];
    const miss = missFromRay(LOWER, [old[0], old[1], rest], ray.origin, ray.direction);
    expect(carried).toBe(280);
    expect(miss).toBeGreaterThan(150);
    // Nearer the camera: further to the right and to the front.
    expect(old[0]).toBeGreaterThan(300);
    expect(old[1]).toBeLessThan(200);
  });

  it('follows the height the preview reports: a piece that rests higher is aimed higher', () => {
    const ray = rayThrough([
      LOWER.position_mm[0] + 300,
      LOWER.position_mm[1] + 200,
      LOWER.position_mm[2] + 45,
    ]);
    const onFloor = aimPoint(lower(45), ray.origin, ray.direction) as readonly [number, number];
    const onTips = aimPoint(lower(140), ray.origin, ray.direction) as readonly [number, number];
    expect(missFromRay(LOWER, [onTips[0], onTips[1], 140], ray.origin, ray.direction)).toBeLessThan(
      1,
    );
    expect(onTips[0]).toBeGreaterThan(onFloor[0]);
    expect(onTips[1]).toBeLessThan(onFloor[1]);
  });

  it('keeps the piece inside the plan of the basket and on the millimetre grid', () => {
    const ray = rayThrough([
      LOWER.position_mm[0] + 900,
      LOWER.position_mm[1] - 300,
      LOWER.position_mm[2] + 45,
    ]);
    expect(aimPoint(lower(45), ray.origin, ray.direction)).toEqual([520, 0]);
    const inside = rayThrough([
      LOWER.position_mm[0] + 100.4,
      LOWER.position_mm[1] + 50.6,
      LOWER.position_mm[2] + 45,
    ]);
    expect(aimPoint(lower(45), inside.origin, inside.direction)).toEqual([100, 51]);
  });

  it('straight down, the height makes no difference', () => {
    const origin: [number, number, number] = [
      LOWER.position_mm[0] + 210,
      LOWER.position_mm[1] + 330,
      3000,
    ];
    expect(aimPoint(lower(45), origin, [0, 0, -1])).toEqual([210, 330]);
    expect(aimPoint(lower(200), origin, [0, 0, -1])).toEqual([210, 330]);
  });

  it('in an elevation the piece keeps its depth and moves across the picture', () => {
    // Seen from the front: the ray runs along y. The piece is 300 mm deep in the basket.
    const origin: [number, number, number] = [LOWER.position_mm[0] + 120, -3000, 300];
    expect(aimPoint(lower(45), origin, [0, 1, 0], [400, 300])).toEqual([120, 300]);
    // Without a place to keep the depth of, a level ray names none.
    expect(aimPoint(lower(45), origin, [0, 1, 0])).toBeNull();
    expect(rayAtHeight(LOWER, origin, [0, 1, 0], 45)).toBeNull();
  });
});

describe('the basket under the cursor', () => {
  it('is the one in whose plan the piece would rest', () => {
    const overLower = rayThrough([
      LOWER.position_mm[0] + 400,
      LOWER.position_mm[1] + 250,
      LOWER.position_mm[2] + 45,
    ]);
    expect(aimFrame([lower(45), cutlery(60)], overLower.origin, overLower.direction)).toBe(
      'lower_rack',
    );
  });

  it('is the cutlery basket when the ray passes through its opening', () => {
    const rim: [number, number, number] = [
      CUTLERY.position_mm[0] + 70,
      CUTLERY.position_mm[1] + 110,
      CUTLERY.position_mm[2] + 215,
    ];
    const ray = rayThrough(rim);
    expect(aimFrame([lower(45), cutlery(60)], ray.origin, ray.direction)).toBe('cutlery_basket');
  });

  it('is the cutlery basket from the side too: wherever the cursor is over its box', () => {
    // Half way up its near side wall, seen from the front right: the ray goes in through the
    // wall, not through the opening at the top.
    const side: [number, number, number] = [
      CUTLERY.position_mm[0] + 140,
      CUTLERY.position_mm[1] + 60,
      CUTLERY.position_mm[2] + 100,
    ];
    const ray = rayThrough(side);
    expect(rayThroughBox(CUTLERY, ray.origin, ray.direction, [140, 230, 215], 215)).toBe(true);
    expect(aimFrame([lower(45), cutlery(60)], ray.origin, ray.direction)).toBe('cutlery_basket');
    // The piece stands where the ray is at the height of its middle, inside the basket.
    expect(aimPoint(cutlery(60), ray.origin, ray.direction)).toEqual([104, 106]);
    // Beside the basket the ray misses its box.
    const beside = rayThrough([
      CUTLERY.position_mm[0] + 300,
      CUTLERY.position_mm[1] + 60,
      CUTLERY.position_mm[2] + 20,
    ]);
    expect(rayThroughBox(CUTLERY, beside.origin, beside.direction, [140, 230, 215], 215)).toBe(
      false,
    );
  });

  it('a cell is the one whose opening the cursor is over', () => {
    const basket: AimTarget = { ...cutlery(95), opening_z_mm: 127 };
    const opening: [number, number, number] = [
      CUTLERY.position_mm[0] + 30,
      CUTLERY.position_mm[1] + 40,
      CUTLERY.position_mm[2] + 127,
    ];
    const ray = rayThrough(opening);
    expect(aimFrame([lower(45), basket], ray.origin, ray.direction)).toBe('cutlery_basket');
    // The piece goes down into the cell under that point of the opening, although its middle,
    // 32 mm lower, is then not on the ray.
    expect(aimPoint(basket, ray.origin, ray.direction)).toEqual([30, 40]);
  });

  it('is the upper of two baskets one above the other', () => {
    const origin: [number, number, number] = [300, -250, 3000];
    expect(aimFrame([lower(45), upper(45)], origin, [0, 0, -1])).toBe('upper_rack');
  });

  it('is none when the cursor is over the floor of the kitchen', () => {
    const ray = rayThrough([1400, -1200, 0]);
    expect(aimFrame([lower(45), cutlery(60)], ray.origin, ray.direction)).toBeNull();
  });
});
