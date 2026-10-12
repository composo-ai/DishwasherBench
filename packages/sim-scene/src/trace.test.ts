// The f64 reference tracer (docs/design/sim-core.md section 3.5 and M3 "Tests", in the
// first-build form: a triangle hierarchy with every hit corrected to the analytic surface).
// Points are placed on the analytic surface by the forward map of each patch, which shares no
// code with the tracer's inverse map; a ray fired at such a point must come back with the
// analytic distance, the analytic normal and the block of that point.
import {
  hashU32,
  POSE_IDENTITY,
  quatFromAxisAngle,
  u32ToUnitFloat,
  type Pose,
} from '@spotless/core';
import { boundingBox, signedDistance, type Shape } from '@spotless/geometry';
import { layoutProblems } from '@spotless/sim-gpu';
import { describe, expect, it } from 'vitest';
import type { ShapeAtlasBuilt } from './atlas.ts';
import { buildWashScene, cachedShapeAtlas } from './scene.ts';
import { BLOCK_FLAG, SCENE_NONE, type WashScene } from './scene-types.ts';
import {
  catalogueItem,
  catalogueMaterial,
  instantiate,
  usableItemTypeIds,
} from './testing/catalogue.ts';
import { alongAxisRay, chordRay, sphereTrace } from './testing/reference.ts';
import { atlasOptions, cellPoint, PRIMITIVES, singlePart, testMaterial } from './testing/shapes.ts';
import { createTraceHit } from './trace-cpu.ts';
import {
  HIT_WORDS,
  packTraceTables,
  packTraceTriangles,
  RAY_WORDS,
  TRACE_HIT_LAYOUT,
  TRACE_RAY_LAYOUT,
  TRACE_TRIANGLE_LAYOUT,
  TRIANGLE_WORDS,
} from './trace-data.ts';

/** Catalogue item types of every geometry class, for the checks that run over real items. */
const CATALOGUE_SAMPLE = [
  'dinner_plate_porcelain_270',
  'cereal_bowl_porcelain_160',
  'mug_ceramic_300',
  'espresso_cup_porcelain_80',
  'wine_glass_red_540',
  'tumbler_250',
  'glass_jug_1000',
  'lid_steel_165',
  'saucepan_steel_170',
  'oval_platter_porcelain_320',
  'food_container_600ml',
  'container_lid_pp',
  'oven_dish_stoneware_320',
  'chopping_board_pe_340',
  'dinner_fork_185',
  'dinner_knife_210',
  'soup_spoon_190',
  'ladle_steel_311',
  'tongs_steel_350',
  'spatula_silicone_280',
  'chopstick_bamboo',
  'swivel_peeler_180',
];

const POSE: Pose = { p: [0.05, -0.03, 0.2], q: quatFromAxisAngle([0.6, -0.3, 0.74], 1.1) };
const rotate = (pose: Pose, v: readonly number[]): [number, number, number] => {
  const [x, y, z, w] = pose.q;
  const [a, b, c] = v as [number, number, number];
  // v + 2 q x (q x v + w v)
  const tx = y * c - z * b + w * a;
  const ty = z * a - x * c + w * b;
  const tz = x * b - y * a + w * c;
  return [a + 2 * (y * tz - z * ty), b + 2 * (z * tx - x * tz), c + 2 * (x * ty - y * tx)];
};
const place = (pose: Pose, p: readonly number[]): [number, number, number] => {
  const r = rotate(pose, p);
  return [r[0] + pose.p[0], r[1] + pose.p[1], r[2] + pose.p[2]];
};

function sceneOf(
  shape: Shape,
  blockSize: number,
  soiled: boolean,
): { scene: WashScene; atlas: ShapeAtlasBuilt } {
  const scene = buildWashScene({
    items: [
      {
        itemId: 'a',
        typeId: 'test',
        shape,
        pose: POSE,
        soils: soiled
          ? [
              {
                type: 'egg_yolk_dried',
                regions: shape.regions.map((region) => ({ region: region.id, coverage: 1 })),
                amount_g: 1,
                age_h: 1,
                heat_history: 'none',
              },
            ]
          : [],
      },
    ],
    machine: [],
    blockSize,
    materials: testMaterial,
  });
  return { scene, atlas: cachedShapeAtlas(shape, atlasOptions(blockSize)) };
}

describe('a ray fired along the inward normal from 10 mm away', () => {
  it.each(Object.keys(PRIMITIVES))(
    '%s: hits the analytic surface and maps back to the block of the point',
    (name) => {
      const shape = singlePart(PRIMITIVES[name] as NonNullable<(typeof PRIMITIVES)[string]>);
      const { scene, atlas } = sceneOf(shape, 0.002, true);
      const hit = createTraceHit();
      let fired = 0;
      let blocked = 0;
      atlas.patches.forEach((patch, p) => {
        for (let row = 0; row < patch.rowCount; row++) {
          const first = atlas.rows[2 * (patch.rowStart + row)] as number;
          const cols = atlas.rows[2 * (patch.rowStart + row) + 1] as number;
          const stride = Math.max(1, Math.floor(cols / 12));
          for (let col = 0; col < cols; col += stride) {
            const key = hashU32(11, p, row, col);
            const fa = 0.02 + 0.96 * u32ToUnitFloat(hashU32(key, 0));
            const fb = 0.02 + 0.96 * u32ToUnitFloat(hashU32(key, 1));
            const point = cellPoint(atlas, p, row, col, fa, fb);
            if (point === null) continue;
            const x = place(POSE, point.p);
            const n = rotate(POSE, point.n);
            const struck = scene.rays.trace(
              x[0] + 0.01 * n[0],
              x[1] + 0.01 * n[1],
              x[2] + 0.01 * n[2],
              -n[0],
              -n[1],
              -n[2],
              0.05,
              0,
              0,
              hit,
            );
            expect(struck).toBe(true);
            // The far wall of a concave shape may stand in the way: then the hit is nearer.
            if (hit.t < 0.01 - 1e-6) {
              blocked++;
              continue;
            }
            fired++;
            // The corrected hit is on the analytic surface: the distance is the 10 mm to a nanometre,
            // the normal the analytic one.
            expect(Math.abs(hit.t - 0.01)).toBeLessThan(1e-9);
            expect(hit.residual).toBeLessThan(1e-12);
            expect(hit.nx * n[0] + hit.ny * n[1] + hit.nz * n[2]).toBeGreaterThan(1 - 1e-9);
            expect(hit.cosInc).toBeGreaterThan(1 - 1e-9);
            const expected = atlas.cellBlock[first + col] as number;
            expect(hit.block).toBe(expected);
            // The soil cell is the quarter of the cell the point lies in (the quarters of a line
            // element are halves along the axis and halves round it).
            // (A ball laid out as one line element has no length to halve.)
            const quarter =
              (patch.line && patch.length === 0 ? 0 : fa >= 0.5 ? 2 : 0) + (fb >= 0.5 ? 1 : 0);
            const own = (atlas.blockCell[expected] as number) === first + col;
            if (own)
              expect(hit.soilCell).toBe((scene.blocks.soilFirst[expected] as number) + quarter);
          }
        }
      });
      expect(fired).toBeGreaterThan(name === 'bead' ? 0 : 30);
      expect(blocked).toBeLessThan(0.2 * (fired + blocked) + 1);
    },
  );

  it('maps the block centres of catalogue items of every class back to their blocks', () => {
    // Over items of every geometry class (shells with foot rings, handles and stems, box shells,
    // slabs, rods with every head, wires, a compound): every ray that reaches its block centre
    // unhindered must name that block, except where two parts of an item have surface in the
    // same place (a flush joint), where the block of either part is a right answer; those are at
    // most 0.3 %. (bench/catalogue-check.ts runs the same check over the whole catalogue.)
    const hit = createTraceHit();
    let fired = 0;
    let wrong = 0;
    const usable = new Set(usableItemTypeIds());
    const ids = CATALOGUE_SAMPLE.filter((id) => usable.has(id));
    expect(ids.length).toBeGreaterThan(15);
    for (const id of ids) {
      const type = { id };
      const scene = buildWashScene({
        items: [catalogueItem('a', type.id, POSE_IDENTITY)],
        machine: [],
        blockSize: 0.004,
        materials: catalogueMaterial,
      });
      expect(scene.counts.unclassifiedTriangles, type.id).toBe(0);
      const b = scene.blocks;
      const stride = Math.max(1, Math.floor(b.count / 400));
      for (let i = 0; i < b.count; i += stride) {
        const flags = b.flags[i] as number;
        if ((flags & (BLOCK_FLAG.line | BLOCK_FLAG.porous)) !== 0) continue;
        const [cx, cy, cz] = [
          b.centre[3 * i] as number,
          b.centre[3 * i + 1] as number,
          b.centre[3 * i + 2] as number,
        ];
        const [nx, ny, nz] = [
          b.normal[3 * i] as number,
          b.normal[3 * i + 1] as number,
          b.normal[3 * i + 2] as number,
        ];
        if (
          !scene.rays.trace(
            cx + 0.01 * nx,
            cy + 0.01 * ny,
            cz + 0.01 * nz,
            -nx,
            -ny,
            -nz,
            0.02,
            0,
            0,
            hit,
          )
        ) {
          wrong++;
          continue;
        }
        if (hit.t < 0.01 - 2e-6) continue;
        fired++;
        expect(Math.abs(hit.t - 0.01), type.id).toBeLessThan(2e-6);
        if (hit.block !== i) wrong++;
      }
    }
    expect(fired).toBeGreaterThan(4000);
    expect(wrong / fired).toBeLessThan(0.003);
  }, 30_000);
});

describe('every soil cell', () => {
  it.each([
    'bowl',
    'tube',
    'quarterShell',
    'ovalDish',
    'stem',
    'ball',
    'board',
    'plate',
    'wedge',
    'blade',
    'wire',
  ])('%s: lies in its block, and the four of a block carry its area', (name) => {
    const shape = singlePart(PRIMITIVES[name] as NonNullable<(typeof PRIMITIVES)[string]>);
    const { scene } = sceneOf(shape, 0.004, true);
    const { soilCells, blocks } = scene;
    expect(soilCells.count).toBeGreaterThan(0);
    expect(soilCells.count).toBe(4 * blocks.count);
    const hit = createTraceHit();
    let checked = 0;
    for (let b = 0; b < blocks.count; b++) {
      const first = blocks.soilFirst[b] as number;
      expect(first).not.toBe(SCENE_NONE);
      let sum = 0;
      for (let q = 0; q < 4; q++) {
        const cell = first + q;
        expect(soilCells.block[cell]).toBe(b);
        sum += soilCells.area[cell] as number;
        if (!((soilCells.area[cell] as number) > 0)) continue;
        // A ray at the centre of the soil cell, along the block's inward normal (for a wire:
        // towards its axis), must name the block and this very cell.
        const c = [
          soilCells.centre[3 * cell] as number,
          soilCells.centre[3 * cell + 1] as number,
          soilCells.centre[3 * cell + 2] as number,
        ];
        let n = [
          blocks.normal[3 * b] as number,
          blocks.normal[3 * b + 1] as number,
          blocks.normal[3 * b + 2] as number,
        ];
        if (((blocks.flags[b] as number) & BLOCK_FLAG.line) !== 0) {
          const axis = (scene.patches[blocks.patch[b] as number] as { axis: readonly number[] })
            .axis;
          const rel = [0, 1, 2].map((i) => (c[i] as number) - (blocks.centre[3 * b + i] as number));
          const along = rel.reduce((s, v, i) => s + v * (axis[i] as number), 0);
          const across = rel.map((v, i) => v - along * (axis[i] as number));
          const len = Math.hypot(across[0] as number, across[1] as number, across[2] as number);
          n = across.map((v) => v / len);
        }
        const struck = scene.rays.trace(
          (c[0] as number) + 0.005 * (n[0] as number),
          (c[1] as number) + 0.005 * (n[1] as number),
          (c[2] as number) + 0.005 * (n[2] as number),
          -(n[0] as number),
          -(n[1] as number),
          -(n[2] as number),
          0.006,
          0,
          0,
          hit,
        );
        if (!struck || hit.t < 0.005 - 1e-5) continue;
        expect(hit.block).toBe(b);
        expect(hit.soilCell).toBe(cell);
        checked++;
      }
      expect(Math.abs(sum - (blocks.area[b] as number)) / (blocks.area[b] as number)).toBeLessThan(
        1e-5,
      );
    }
    expect(checked).toBeGreaterThan(0.5 * soilCells.count);
  });
});

describe('rays from every direction', () => {
  it.each([
    ['dinner_fork_185', 0.004],
    ['dinner_fork_185', 0.002],
    ['dinner_knife_210', 0.004],
  ] as const)(
    '%s at %f m: no hit names a soil cell without area, and hits per soil cell follow its area',
    (id, blockSize) => {
      // Cutlery is mostly rounded edge. Isotropic chords strike a convex surface in proportion
      // to its area, so over the soil cells of the item the hits must be Poisson about
      // (hits) x (cell area) / (total area): chi-squared per cell near 1. (When a hit on a
      // rounded edge chose its quarter from where it lay beyond the outline of the face, 13.6 %
      // of the hits on the tines of the fork named cells of area 0, and the area of the edges
      // sat in cells those hits never reached: chi-squared per cell in the thousands.)
      const instance = instantiate(id);
      const regions = instance.shape.regions.map((region) => region.id);
      const scene = buildWashScene({
        items: [catalogueItem('a', id, POSE_IDENTITY, regions)],
        machine: [],
        blockSize,
        materials: catalogueMaterial,
      });
      const { soilCells } = scene;
      const box = boundingBox(instance.shape);
      const counts = new Float64Array(soilCells.count);
      const hit = createTraceHit();
      let hits = 0;
      let onEmpty = 0;
      for (let i = 0; i < 150_000; i++) {
        const ray = chordRay(41, i, box);
        if (
          !scene.rays.trace(
            ray.o[0],
            ray.o[1],
            ray.o[2],
            ray.d[0],
            ray.d[1],
            ray.d[2],
            ray.length,
            0,
            0,
            hit,
          )
        ) {
          continue;
        }
        // Every region carries soil, so every hit names a block and a soil cell of that block.
        expect(hit.block).not.toBe(SCENE_NONE);
        expect(hit.soilCell).not.toBe(SCENE_NONE);
        expect(soilCells.block[hit.soilCell]).toBe(hit.block);
        hits++;
        counts[hit.soilCell] = (counts[hit.soilCell] as number) + 1;
        if (!((soilCells.area[hit.soilCell] as number) > 0)) onEmpty++;
      }
      expect(hits).toBeGreaterThan(4000);
      expect(onEmpty).toBe(0);
      let total = 0;
      for (let c = 0; c < soilCells.count; c++) total += soilCells.area[c] as number;
      let chi = 0;
      let cells = 0;
      for (let c = 0; c < soilCells.count; c++) {
        const expected = (hits * (soilCells.area[c] as number)) / total;
        // Cells expecting less than a hit say little; they are a small share of the area.
        if (expected < 1) continue;
        chi += ((counts[c] as number) - expected) ** 2 / expected;
        cells++;
      }
      expect(cells).toBeGreaterThan(0.3 * soilCells.count);
      // Not exactly 1: the tines shade each other a little. Measured 1.0 to 1.2.
      expect(chi / cells).toBeLessThan(1.5);
    },
  );

  it('every triangle that is struck names a block, on items whose parts bury each other', () => {
    // Faces whose every cell centre is dead (the end faces of a handle segment set into the
    // wall of a mug) used to have no block, and a hit on what is left of them named none.
    const hit = createTraceHit();
    for (const id of [
      'mug_porcelain_240',
      'glass_jug_1000',
      'tongs_steel_350',
      'ladle_steel_311',
    ]) {
      const instance = instantiate(id);
      const scene = buildWashScene({
        items: [catalogueItem('a', id, POSE_IDENTITY)],
        machine: [],
        blockSize: 0.004,
        materials: catalogueMaterial,
      });
      const box = boundingBox(instance.shape);
      let hits = 0;
      for (let i = 0; i < 40_000; i++) {
        const ray = chordRay(43, i, box);
        if (
          !scene.rays.trace(
            ray.o[0],
            ray.o[1],
            ray.o[2],
            ray.d[0],
            ray.d[1],
            ray.d[2],
            ray.length,
            0,
            0,
            hit,
          )
        ) {
          continue;
        }
        hits++;
        if (hit.block === SCENE_NONE) throw new Error(`${id}: ray ${i} names no block`);
        if (!(hit.cosInc >= 0)) throw new Error(`${id}: ray ${i} has cosine ${hit.cosInc}`);
      }
      expect(hits, id).toBeGreaterThan(2000);
    }
  });
});

describe('rays that run along a surface', () => {
  const wireShape = (radius: number): Shape => ({
    parts: [
      {
        id: 'wire',
        prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0.05], radius },
        pose: POSE_IDENTITY,
        material: 'test',
      },
    ],
    regions: [{ id: 'all', part: '*' }],
  });
  const cases: [string, () => Shape, number][] = [
    // A wire as a line element and a rod as a gridded capsule, struck end on.
    ['a 2 mm wire', () => wireShape(0.001), 0.0002],
    ['an 8 mm rod', () => wireShape(0.004), 0.0008],
    // Cutlery standing in the basket, struck from above: handles and tines of rounded hulls.
    ['a fork', () => instantiate('dinner_fork_185').shape, 0],
    ['a knife', () => instantiate('dinner_knife_210').shape, 0],
    // A mug from above: rays tangent to its wall, inside and outside.
    ['a mug', () => instantiate('mug_ceramic_300').shape, 0],
  ];

  it.each(cases)(
    'within 2 degrees of the axis of %s: every hit is on the surface, facing the ray',
    (_name, make, margin) => {
      // Independent of the tracer: the kernel's signed distance at the reported hit point, and
      // for the single convex wire the first hit by marching that distance. (The correction
      // used to retreat without bound when a ray ran along a cylinder inside its radius, and to
      // stop on the endless cylinder of a rounded edge beyond its end: hits centimetres from
      // any surface, with a cosine of incidence of the wrong sign for rays tangent to a wall.)
      const shape = make();
      const scene = buildWashScene({
        items: [{ itemId: 'a', typeId: 'test', shape, pose: POSE_IDENTITY, soils: [] }],
        machine: [],
        blockSize: 0.004,
        materials: (id) => (id === 'test' ? testMaterial(id) : catalogueMaterial(id)),
      });
      const chord = scene.trace.chordError;
      const box = boundingBox(shape);
      const convex = shape.parts.length === 1;
      const hit = createTraceHit();
      let hits = 0;
      let uncorrected = 0;
      let worst = 0;
      let worstCorrected = 0;
      let checked = 0;
      for (let i = 0; i < 20_000; i++) {
        const ray = alongAxisRay(47, i, box, 0.035, margin);
        if (
          !scene.rays.trace(
            ray.o[0],
            ray.o[1],
            ray.o[2],
            ray.d[0],
            ray.d[1],
            ray.d[2],
            ray.length,
            0,
            0,
            hit,
          )
        ) {
          continue;
        }
        hits++;
        if (hit.block === SCENE_NONE) throw new Error(`ray ${i} names no block`);
        if (!(hit.cosInc >= 0)) throw new Error(`ray ${i} has cosine ${hit.cosInc}`);
        const off = Math.abs(
          signedDistance(shape, [
            ray.o[0] + hit.t * ray.d[0],
            ray.o[1] + hit.t * ray.d[1],
            ray.o[2] + hit.t * ray.d[2],
          ]),
        );
        worst = Math.max(worst, off);
        if (!hit.corrected) {
          uncorrected++;
          continue;
        }
        if (!convex) continue;
        // On a single convex part a corrected hit is the exact first hit.
        worstCorrected = Math.max(worstCorrected, off);
        if (i % 4 === 0) {
          const exact = sphereTrace(shape, ray);
          // (Within the residual the correction accepts, measured across the surface.)
          expect(Math.abs(hit.t - exact) * hit.cosInc).toBeLessThan(3e-6);
          checked++;
        }
      }
      expect(hits).toBeGreaterThan(5000);
      // No hit is further from the surface than the chord error of the triangles.
      expect(worst).toBeLessThan(chord + 1e-6);
      expect(worstCorrected).toBeLessThan(3e-6);
      if (convex) expect(checked).toBeGreaterThan(1000);
      // Hits left on their triangle are few even in this family (measured: up to 1.5 %).
      expect(uncorrected / hits).toBeLessThan(0.04);
    },
  );
});

describe('the reference tracer', () => {
  const ball = sceneOf(
    singlePart(PRIMITIVES['ball'] as NonNullable<(typeof PRIMITIVES)[string]>),
    0.004,
    false,
  ).scene;
  // The ball (radius 20 mm) is centred on the part origin.
  const centre = place(POSE, [0.01, -0.02, 0.03]);

  it('strikes a surface from outside only: a ray that starts inside a solid leaves it unhindered', () => {
    const hit = createTraceHit();
    expect(ball.rays.trace(centre[0], centre[1], centre[2], 0, 0, 1, 1, 0, 0, hit)).toBe(false);
    expect(hit.triangle).toBe(SCENE_NONE);
    expect(ball.rays.trace(centre[0], centre[1], centre[2] - 0.1, 0, 0, 1, 1, 0, 0, hit)).toBe(
      true,
    );
    expect(Math.abs(hit.t - 0.08)).toBeLessThan(1e-9);
    expect(hit.nz).toBeLessThan(-1 + 1e-9);
  });

  it('treats a segment as a hit only if it reaches the surface', () => {
    const hit = createTraceHit();
    // The chord of the mesh lies up to the chord error (0.05 mm) inside the sphere.
    expect(ball.rays.trace(centre[0], centre[1], centre[2] - 0.1, 0, 0, 1, 0.0799, 0, 0, hit)).toBe(
      false,
    );
    expect(hit.t).toBe(0.0799);
    expect(ball.rays.trace(centre[0], centre[1], centre[2] - 0.1, 0, 0, 1, 0.0801, 0, 0, hit)).toBe(
      true,
    );
  });

  it('corrects a grazing hit to the sphere within 2 um / cos(incidence)', () => {
    const hit = createTraceHit();
    let checked = 0;
    let deep = 0;
    for (let i = 0; i < 2000; i++) {
      // Rays parallel to z at a distance d from the axis of the ball: t = 0.1 - sqrt(R^2 - d^2).
      const cos = 0.02 + 0.3 * u32ToUnitFloat(hashU32(5, i, 0));
      const d = 0.02 * Math.sqrt(1 - cos * cos);
      const phi = 2 * Math.PI * u32ToUnitFloat(hashU32(5, i, 1));
      const exact = 0.1 - 0.02 * cos;
      const struck = ball.rays.trace(
        centre[0] + d * Math.cos(phi),
        centre[1] + d * Math.sin(phi),
        centre[2] - 0.1,
        0,
        0,
        1,
        1,
        0,
        0,
        hit,
      );
      // Whether a ray strikes is decided on the triangles, which lie up to the chord error
      // (0.05 mm) inside the sphere: a ray that passes deeper than that must strike.
      if (0.02 - d > 0.05e-3) {
        deep++;
        expect(struck).toBe(true);
      }
      if (!struck) continue;
      expect(Math.abs(hit.t - exact)).toBeLessThan(2e-6 / cos);
      expect(Math.abs(hit.cosInc - cos)).toBeLessThan(1e-6);
      checked++;
    }
    expect(deep).toBeGreaterThan(1500);
    expect(checked).toBeGreaterThanOrEqual(deep);
  });

  it('lets a ray pass a porous part with the probability of its open fraction, the whole part or none', () => {
    const shape = singlePart(PRIMITIVES['plate'] as NonNullable<(typeof PRIMITIVES)[string]>, 0.4);
    const { scene } = sceneOf(shape, 0.004, false);
    const hit = createTraceHit();
    const mid = place(POSE, [0.01, -0.02, 0.03]);
    const n = rotate(
      POSE,
      rotate({ p: [0, 0, 0], q: quatFromAxisAngle([0.3, 0.5, 0.81], 0.7) }, [0, 0, 1]),
    );
    let passed = 0;
    const total = 20000;
    for (let key = 0; key < total; key++) {
      const struck = scene.rays.trace(
        mid[0] + 0.05 * n[0],
        mid[1] + 0.05 * n[1],
        mid[2] + 0.05 * n[2],
        -n[0],
        -n[1],
        -n[2],
        1,
        key,
        3,
        hit,
      );
      if (!struck) passed++;
      // The same key gives the same answer.
      if (key < 50) {
        expect(
          scene.rays.trace(
            mid[0] + 0.05 * n[0],
            mid[1] + 0.05 * n[1],
            mid[2] + 0.05 * n[2],
            -n[0],
            -n[1],
            -n[2],
            1,
            key,
            3,
            hit,
          ),
        ).toBe(struck);
      }
    }
    // Open fraction 0.4 stored as 102 / 256; three standard deviations of 20,000 draws is 0.0104.
    expect(Math.abs(passed / total - 102 / 256)).toBeLessThan(0.011);
    expect((scene.blocks.flags[0] as number) & BLOCK_FLAG.porous).toBe(BLOCK_FLAG.porous);
  });

  it('poses a rotating part at the angle it is given', () => {
    // An arm along +x from its hinge at the origin of its frame, 0.3 m up.
    const arm: Shape = {
      parts: [
        {
          id: 'blade',
          prim: { kind: 'capsule', a: [0.02, 0, 0], b: [0.2, 0, 0], radius: 0.01 },
          pose: POSE_IDENTITY,
          material: 'test',
        },
      ],
      regions: [{ id: 'all', part: '*' }],
    };
    const scene = buildWashScene({
      items: [],
      machine: [
        {
          id: 'arm',
          role: 'arm',
          shape: arm,
          pose: { p: [0, 0, 0.3], q: [0, 0, 0, 1] },
          rotation: { point: [0, 0, 0], axis: [0, 0, 1] },
        },
      ],
      blockSize: 0.002,
      materials: testMaterial,
    });
    expect(scene.trace.roots).toHaveLength(1);
    expect(scene.trace.roots[0]?.rotating).not.toBeNull();
    const hit = createTraceHit();
    const down = (x: number, y: number): boolean =>
      scene.rays.trace(x, y, 0.5, 0, 0, -1, 1, 0, 0, hit);
    expect(down(0.1, 0)).toBe(true);
    expect(Math.abs(hit.t - 0.19)).toBeLessThan(1e-9);
    expect(down(0, 0.1)).toBe(false);
    scene.rays.setAngles([Math.PI / 2]);
    expect(down(0.1, 0)).toBe(false);
    expect(down(0, 0.1)).toBe(true);
    expect(Math.abs(hit.t - 0.19)).toBeLessThan(1e-9);
    expect(hit.nz).toBeGreaterThan(1 - 1e-9);
    // Off the centre line the normal turns with the arm: at angle pi/2 the arm lies along +y.
    expect(down(0.005, 0.1)).toBe(true);
    expect(Math.abs(hit.nx - 0.5)).toBeLessThan(1e-9);
    expect(Math.abs(hit.ny)).toBeLessThan(1e-9);
    // The blocks of the arm are stored at its reference angle.
    expect(scene.blocks.count).toBeGreaterThan(0);
    scene.rays.setAngles([]);
    expect(down(0.1, 0)).toBe(true);
  });
});

describe('the packed records of the kernel', () => {
  it('have layouts that obey the layout rules and match the packers word for word', () => {
    for (const layout of [TRACE_RAY_LAYOUT, TRACE_HIT_LAYOUT, TRACE_TRIANGLE_LAYOUT]) {
      expect(layoutProblems(layout)).toEqual([]);
    }
    expect(TRACE_RAY_LAYOUT.byteSize).toBe(4 * RAY_WORDS);
    expect(TRACE_HIT_LAYOUT.byteSize).toBe(4 * HIT_WORDS);
    expect(TRACE_TRIANGLE_LAYOUT.byteSize).toBe(4 * TRIANGLE_WORDS);
    const { scene } = sceneOf(
      singlePart(PRIMITIVES['bowl'] as NonNullable<(typeof PRIMITIVES)[string]>),
      0.004,
      true,
    );
    const data = scene.trace;
    const triangles = packTraceTriangles(data);
    const floats = new Float32Array(triangles.buffer);
    const offsetOf = (name: string): number =>
      (TRACE_TRIANGLE_LAYOUT.fields.find((f) => f.name === name) as { offset: number }).offset / 4;
    for (const t of [0, 7, data.triangleCount - 1]) {
      const o = TRIANGLE_WORDS * t;
      expect(floats[o + offsetOf('v0')]).toBe(data.triVerts[9 * t]);
      expect(triangles[o + offsetOf('surf')]).toBe(data.triSurf[t]);
      expect(triangles[o + offsetOf('patch')]).toBe(data.triPatch[t]);
      expect(floats[o + offsetOf('v1') + 1]).toBe(data.triVerts[9 * t + 4]);
      expect(floats[o + offsetOf('v2') + 2]).toBe(data.triVerts[9 * t + 8]);
      expect(triangles[o + offsetOf('porous')]).toBe(0);
    }
    const tables = packTraceTables(data);
    expect(tables.quarterBase).toBe(tables.soilBase + scene.blocks.count);
    expect(tables.words.length).toBe(tables.quarterBase + Math.ceil(data.cellQuarter.length / 8));
    expect(tables.words[tables.cellBase]).toBe(data.cellBlock[0]);
    expect(tables.words[tables.soilBase + 1]).toBe(scene.blocks.soilFirst[1]);
    // A hit record of the batch interface carries what the single-ray interface returns.
    const rays = new ArrayBuffer(4 * RAY_WORDS);
    const c = [
      scene.blocks.centre[0] as number,
      scene.blocks.centre[1] as number,
      scene.blocks.centre[2] as number,
    ];
    const n = [
      scene.blocks.normal[0] as number,
      scene.blocks.normal[1] as number,
      scene.blocks.normal[2] as number,
    ];
    new Float32Array(rays).set([
      (c[0] as number) + 0.01 * (n[0] as number),
      (c[1] as number) + 0.01 * (n[1] as number),
      (c[2] as number) + 0.01 * (n[2] as number),
      0.05,
      -(n[0] as number),
      -(n[1] as number),
      -(n[2] as number),
    ]);
    const out = scene.rays.traceBatch(rays, 1);
    const hits = new Uint32Array(out);
    expect(Math.abs((new Float32Array(out)[0] as number) - 0.01)).toBeLessThan(1e-6);
    expect(hits[1]).toBe(0);
    expect(hits[2]).toBeGreaterThanOrEqual(scene.blocks.soilFirst[0] as number);
    expect(hits[2]).toBeLessThan((scene.blocks.soilFirst[0] as number) + 4);
  });
});
