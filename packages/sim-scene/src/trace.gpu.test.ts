// The GPU ray kernel against the f64 reference tracer (docs/design/sim-core.md M3 "Tests";
// scene brief): 10^5 rays, a fifth of them grazing, over a scene with every kind of surface, a
// porous part and a turned spray arm. Skipped, visibly, on a machine without a WebGPU adapter.
import { hashU32, POSE_IDENTITY, quatFromAxisAngle, u32ToUnitFloat } from '@spotless/core';
import { boundingBox, signedDistance, type Shape } from '@spotless/geometry';
import { tryCreateNodeGpuContext } from '@spotless/sim-gpu/node';
import { assertKernelFilesHaveNoPhysicalLiterals } from '@spotless/sim-params/node';
import { afterAll, describe, expect, it } from 'vitest';
import { buildWashScene } from './scene.ts';
import { SCENE_NONE, type SceneMachinePart } from './scene-types.ts';
import { catalogueItem, catalogueMaterial, instantiate } from './testing/catalogue.ts';
import { alongAxisRay } from './testing/reference.ts';
import { PRIMITIVES, singlePart, testMaterial } from './testing/shapes.ts';
import { createTraceHit } from './trace-cpu.ts';
import { HIT_WORDS, RAY_WORDS } from './trace-data.ts';
import { createGpuTracer } from './trace-gpu.ts';

const gpu = await tryCreateNodeGpuContext();
afterAll(() => gpu?.destroy());

const materials = (id: string) => (id === 'test' ? testMaterial(id) : catalogueMaterial(id));
const unit = (seed: number, i: number, k: number): number => u32ToUnitFloat(hashU32(seed, i, k));

/** A rack of crossing wires, a porous sheet and a spray arm, around a handful of items. */
function testScene() {
  const wire = (id: string, a: [number, number, number], b: [number, number, number]) => ({
    id,
    prim: { kind: 'capsule' as const, a, b, radius: 0.002 },
    pose: POSE_IDENTITY,
    material: 'test',
  });
  const rackParts = [];
  for (let k = 0; k < 9; k++) {
    rackParts.push(wire(`x${k}`, [-0.2, -0.16 + 0.04 * k, 0], [0.2, -0.16 + 0.04 * k, 0]));
    rackParts.push(wire(`y${k}`, [-0.16 + 0.04 * k, -0.2, 0.004], [-0.16 + 0.04 * k, 0.2, 0.004]));
    rackParts.push(wire(`t${k}`, [-0.16 + 0.04 * k, 0.02, 0.004], [-0.15 + 0.04 * k, 0.02, 0.07]));
  }
  const rack: Shape = { parts: rackParts, regions: [{ id: 'wires', part: '*' }] };
  const arm: Shape = {
    parts: [
      {
        id: 'blade',
        prim: {
          kind: 'hull',
          points: [
            [-0.2, -0.015, -0.01],
            [-0.2, 0.015, -0.01],
            [0.2, -0.01, -0.01],
            [0.2, 0.01, -0.01],
            [-0.2, -0.015, 0],
            [0.2, 0.01, 0],
            [-0.2, 0.015, 0],
            [0.2, -0.01, 0],
          ],
          radius: 0.002,
        },
        pose: POSE_IDENTITY,
        material: 'test',
      },
      {
        id: 'hub',
        prim: { kind: 'capsule', a: [0, 0, -0.02], b: [0, 0, 0.005], radius: 0.02 },
        pose: POSE_IDENTITY,
        material: 'test',
      },
    ],
    regions: [{ id: 'arm', part: '*' }],
  };
  const machine: SceneMachinePart[] = [
    { id: 'rack', role: 'wires', shape: rack, pose: { p: [0, 0, 0.1], q: [0, 0, 0, 1] } },
    {
      id: 'sheet',
      role: 'basket',
      shape: singlePart(PRIMITIVES['plate'] as NonNullable<(typeof PRIMITIVES)[string]>, 0.5),
      pose: { p: [0.1, -0.12, 0.2], q: [0, 0, 0, 1] },
    },
    {
      id: 'arm',
      role: 'arm',
      shape: arm,
      pose: { p: [0, 0, 0.05], q: [0, 0, 0, 1] },
      rotation: { point: [0, 0, 0], axis: [0, 0, 1] },
    },
  ];
  const tilt = quatFromAxisAngle([1, 0, 0], 1.4);
  const items = [
    catalogueItem('plate_1', 'dinner_plate_porcelain_270', { p: [-0.1, 0.1, 0.26], q: tilt }, [
      'well',
    ]),
    catalogueItem('plate_2', 'dinner_plate_porcelain_270', { p: [-0.1, 0.13, 0.26], q: tilt }, [
      'well',
    ]),
    catalogueItem('mug', 'mug_porcelain_240', { p: [0.1, 0.1, 0.21], q: [1, 0, 0, 0] }, [
      'interior',
    ]),
    catalogueItem(
      'fork',
      'dinner_fork_185',
      { p: [0.0, -0.1, 0.12], q: quatFromAxisAngle([0, 1, 0], -1.2) },
      ['tines'],
    ),
    catalogueItem(
      'spoon',
      'soup_spoon_190',
      { p: [0.05, -0.1, 0.12], q: quatFromAxisAngle([0, 1, 0], -1.3) },
      ['bowl'],
    ),
    catalogueItem('box', 'food_container_600ml', { p: [-0.12, -0.08, 0.2], q: [1, 0, 0, 0] }, [
      'interior',
    ]),
    catalogueItem('glass', 'wine_glass_red_540', { p: [0.14, -0.02, 0.33], q: [1, 0, 0, 0] }, [
      'interior',
    ]),
  ];
  return buildWashScene({ items, machine, blockSize: 0.004, materials });
}

describe('the WGSL source of the kernel', () => {
  it('has no physical literals: every tolerance comes in through the uniform block', () => {
    assertKernelFilesHaveNoPhysicalLiterals([new URL('./trace.wgsl.ts', import.meta.url).pathname]);
  });
});

describe.skipIf(gpu === null)('GPU tracer against the f64 reference, 10^5 rays', () => {
  const ctx = gpu as NonNullable<typeof gpu>;
  const scene = testScene();
  const N = 100_000;
  const ANGLE = 0.9;
  const SEED = 17;

  // Four fifths are rays through random points of the scene (a quarter of those short
  // segments); one fifth graze a block: they strike it at a cosine of incidence between 0.01
  // and 0.2.
  const rays = new ArrayBuffer(4 * RAY_WORDS * N);
  const rf = new Float32Array(rays);
  const ru = new Uint32Array(rays);
  for (let i = 0; i < N; i++) {
    let o: number[];
    let d: number[];
    let tMax = 2;
    if (i % 5 === 4) {
      const b = Math.floor(unit(3, i, 0) * scene.blocks.count);
      const n = [
        scene.blocks.normal[3 * b] as number,
        scene.blocks.normal[3 * b + 1] as number,
        scene.blocks.normal[3 * b + 2] as number,
      ];
      const c = [
        scene.blocks.centre[3 * b] as number,
        scene.blocks.centre[3 * b + 1] as number,
        scene.blocks.centre[3 * b + 2] as number,
      ];
      // A tangent direction, turned at random about the normal.
      const ref = Math.abs(n[0] as number) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      let t1 = [
        (n[1] as number) * (ref[2] as number) - (n[2] as number) * (ref[1] as number),
        (n[2] as number) * (ref[0] as number) - (n[0] as number) * (ref[2] as number),
        (n[0] as number) * (ref[1] as number) - (n[1] as number) * (ref[0] as number),
      ];
      const len = Math.hypot(t1[0] as number, t1[1] as number, t1[2] as number);
      t1 = t1.map((v) => v / len);
      const t2 = [
        (n[1] as number) * (t1[2] as number) - (n[2] as number) * (t1[1] as number),
        (n[2] as number) * (t1[0] as number) - (n[0] as number) * (t1[2] as number),
        (n[0] as number) * (t1[1] as number) - (n[1] as number) * (t1[0] as number),
      ];
      const phi = 2 * Math.PI * unit(3, i, 1);
      const cos = 0.01 + 0.19 * unit(3, i, 2);
      const sin = Math.sqrt(1 - cos * cos);
      d = [0, 1, 2].map(
        (k) =>
          -cos * (n[k] as number) +
          sin * (Math.cos(phi) * (t1[k] as number) + Math.sin(phi) * (t2[k] as number)),
      );
      // Aimed a little off the centre of the block, which is where its four soil cells meet.
      o = [0, 1, 2].map(
        (k) =>
          (c[k] as number) +
          0.0009 * (t1[k] as number) +
          0.0006 * (t2[k] as number) -
          0.03 * (d[k] as number),
      );
      tMax = 0.5;
    } else {
      const target = [
        -0.2 + 0.4 * unit(3, i, 0),
        -0.2 + 0.4 * unit(3, i, 1),
        0.03 + 0.35 * unit(3, i, 2),
      ];
      const cz = 2 * unit(3, i, 3) - 1;
      const s = Math.sqrt(1 - cz * cz);
      const phi = 2 * Math.PI * unit(3, i, 4);
      d = [s * Math.cos(phi), s * Math.sin(phi), cz];
      // A fifth of these are short segments that start near their target.
      const back = i % 5 === 3 ? 0.01 : 0.6;
      o = [0, 1, 2].map((k) => (target[k] as number) - back * (d[k] as number));
      if (i % 5 === 3) tMax = 0.02;
    }
    const base = RAY_WORDS * i;
    rf.set(
      [
        o[0] as number,
        o[1] as number,
        o[2] as number,
        tMax,
        d[0] as number,
        d[1] as number,
        d[2] as number,
      ],
      base,
    );
    ru[base + 7] = i;
  }

  it('agrees on hit or miss, block, soil cell, distance and normal, except next to an edge', async () => {
    const tracer = await createGpuTracer(ctx, scene.trace, 'gputest');
    const out = await tracer.trace(rays, N, { angles: [ANGLE], seed: SEED });
    tracer.release();
    const gf = new Float32Array(out);
    const gu = new Uint32Array(out);
    expect(gu.length).toBe(HIT_WORDS * N);
    scene.rays.setAngles([ANGLE]);
    const cpu = createTraceHit();
    const probe = createTraceHit();
    let hits = 0;
    let grazingHits = 0;
    let nearEdge = 0;
    let compared = 0;
    const failures: string[] = [];
    // "Next to an edge": the reference's own answer changes when the ray is shifted sideways by
    // a micrometre (it passes that close to the outline of a triangle, of a block or of a part),
    // or two surfaces lie within the tolerance of each other along the ray.
    const EDGE = 1e-6;
    const unstable = (o: number[], d: number[], tMax: number, key: number): boolean => {
      const ref = Math.abs(d[0] as number) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      let s1 = [
        (d[1] as number) * (ref[2] as number) - (d[2] as number) * (ref[1] as number),
        (d[2] as number) * (ref[0] as number) - (d[0] as number) * (ref[2] as number),
        (d[0] as number) * (ref[1] as number) - (d[1] as number) * (ref[0] as number),
      ];
      const len = Math.hypot(s1[0] as number, s1[1] as number, s1[2] as number);
      s1 = s1.map((v) => v / len);
      const s2 = [
        (d[1] as number) * (s1[2] as number) - (d[2] as number) * (s1[1] as number),
        (d[2] as number) * (s1[0] as number) - (d[0] as number) * (s1[2] as number),
        (d[0] as number) * (s1[1] as number) - (d[1] as number) * (s1[0] as number),
      ];
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [0.7, 0.7],
        [-0.7, 0.7],
        [0.7, -0.7],
        [-0.7, -0.7],
      ] as const) {
        const struck = scene.rays.trace(
          (o[0] as number) + EDGE * (a * (s1[0] as number) + b * (s2[0] as number)),
          (o[1] as number) + EDGE * (a * (s1[1] as number) + b * (s2[1] as number)),
          (o[2] as number) + EDGE * (a * (s1[2] as number) + b * (s2[2] as number)),
          d[0] as number,
          d[1] as number,
          d[2] as number,
          tMax,
          key,
          SEED,
          probe,
        );
        if (struck !== (cpu.triangle !== SCENE_NONE)) return true;
        if (
          struck &&
          (probe.block !== cpu.block || probe.soilCell !== cpu.soilCell || probe.surf !== cpu.surf)
        )
          return true;
        if (struck && Math.abs(probe.t - cpu.t) * Math.max(cpu.cosInc, 0.02) > 2e-6) return true;
      }
      return false;
    };
    for (let i = 0; i < N; i++) {
      const base = RAY_WORDS * i;
      // Both tracers are given the same f32 ray.
      const o = [rf[base] as number, rf[base + 1] as number, rf[base + 2] as number];
      const d = [rf[base + 4] as number, rf[base + 5] as number, rf[base + 6] as number];
      const tMax = rf[base + 3] as number;
      const struck = scene.rays.trace(
        o[0] as number,
        o[1] as number,
        o[2] as number,
        d[0] as number,
        d[1] as number,
        d[2] as number,
        tMax,
        i,
        SEED,
        cpu,
      );
      const h = HIT_WORDS * i;
      const gpuStruck = gu[h + 3] !== SCENE_NONE;
      if (struck) hits++;
      const same =
        struck === gpuStruck &&
        (!struck ||
          (gu[h + 1] === cpu.block &&
            gu[h + 2] === cpu.soilCell &&
            // Distance within 2 micrometres over the cosine of incidence.
            Math.abs((gf[h] as number) - cpu.t) * cpu.cosInc <= 2e-6 &&
            // The normal within a quarter of a degree: on a 2 mm wire that is the micrometre by
            // which the two hit points may differ; the cosine of incidence follows the normal.
            (gf[h + 4] as number) * cpu.nx +
              (gf[h + 5] as number) * cpu.ny +
              (gf[h + 6] as number) * cpu.nz >
              1 - 1e-5 &&
            Math.abs((gf[h + 7] as number) - cpu.cosInc) < 5e-3));
      if (same) {
        compared++;
        if (struck && cpu.cosInc < 0.2) grazingHits++;
        continue;
      }
      // Rays below a cosine of incidence of 0.02 are exempt from the comparison (in f32 a ray
      // a micrometre inside tangency disagrees with f64), as are rays next to an edge.
      if ((struck && cpu.cosInc < 0.02) || unstable(o, d, tMax, i)) {
        nearEdge++;
        continue;
      }
      if (failures.length < 10) {
        failures.push(
          `ray ${i}: cpu ${struck ? `t=${cpu.t} block=${cpu.block} soil=${cpu.soilCell} cos=${cpu.cosInc}` : 'miss'}; gpu ${gpuStruck ? `t=${gf[h]} block=${gu[h + 1]} soil=${gu[h + 2]} cos=${gf[h + 7]}` : 'miss'}`,
        );
      } else {
        failures.push('');
      }
    }
    scene.rays.setAngles([]);
    expect(failures.filter((f) => f !== '')).toEqual([]);
    expect(failures).toHaveLength(0);
    // The comparison is not vacuous: most rays hit, thousands of them grazing, and the exempt
    // share (rays within a micrometre of an edge) is small.
    expect(hits).toBeGreaterThan(0.5 * N);
    expect(grazingHits).toBeGreaterThan(5000);
    expect(nearEdge / N).toBeLessThan(0.002);
    expect(compared + nearEdge).toBe(N);
  });

  it('gives the same hits whatever the batch they are traced in', async () => {
    const tracer = await createGpuTracer(ctx, scene.trace, 'gputest2');
    const whole = new Uint8Array(await tracer.trace(rays, 4096, { angles: [ANGLE], seed: SEED }));
    // The second half alone, with the keys moved by the offset of the batch.
    const half = rays.slice(4 * RAY_WORDS * 2048, 4 * RAY_WORDS * 4096);
    const keys = new Uint32Array(half);
    for (let i = 0; i < 2048; i++) keys[RAY_WORDS * i + 7] = i;
    const part = new Uint8Array(
      await tracer.trace(half, 2048, { angles: [ANGLE], seed: SEED, keyBase: 2048 }),
    );
    tracer.release();
    expect(Buffer.compare(part, whole.subarray(4 * HIT_WORDS * 2048))).toBe(0);
  });
});

describe.skipIf(gpu === null)('GPU tracer on rays that run along a surface', () => {
  const ctx = gpu as NonNullable<typeof gpu>;

  it('agrees with the reference, and every hit is on the surface, within 2 degrees of an axis', async () => {
    // Rays along a wire, a rod and standing cutlery: where a ray runs inside the radius of a
    // cylinder the correction has no slope to follow. (The kernel used to retreat without bound
    // there and report points up to 48 mm from any surface, at 0.4 % of the hits along a 2 mm
    // wire, while the reference with four times the steps did so twenty times less often.)
    const capsule = (radius: number): Shape => ({
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
    const placed: { id: string; shape: Shape; at: [number, number, number]; margin: number }[] = [
      { id: 'a_wire', shape: capsule(0.001), at: [0, 0, 0], margin: 0.0002 },
      { id: 'b_rod', shape: capsule(0.004), at: [0.1, 0, 0], margin: 0.0008 },
      { id: 'c_fork', shape: instantiate('dinner_fork_185').shape, at: [0, 0.2, 0], margin: 0 },
      { id: 'd_knife', shape: instantiate('dinner_knife_210').shape, at: [0, 0.4, 0], margin: 0 },
    ];
    const scene = buildWashScene({
      items: placed.map(({ id, shape, at }) => ({
        itemId: id,
        typeId: 'test',
        shape,
        pose: { p: at, q: [0, 0, 0, 1] },
        soils: [],
      })),
      machine: [],
      blockSize: 0.004,
      materials,
    });
    const PER = 10_000;
    const N = PER * placed.length;
    const rays = new ArrayBuffer(4 * RAY_WORDS * N);
    const rf = new Float32Array(rays);
    const ru = new Uint32Array(rays);
    placed.forEach(({ shape, at, margin }, k) => {
      const box = boundingBox(shape);
      for (let j = 0; j < PER; j++) {
        const i = k * PER + j;
        const ray = alongAxisRay(53 + k, j, box, 0.035, margin);
        rf.set(
          [
            ray.o[0] + at[0],
            ray.o[1] + at[1],
            ray.o[2] + at[2],
            ray.length,
            ray.d[0],
            ray.d[1],
            ray.d[2],
          ],
          RAY_WORDS * i,
        );
        ru[RAY_WORDS * i + 7] = i;
      }
    });
    const tracer = await createGpuTracer(ctx, scene.trace, 'gputest3');
    const out = await tracer.trace(rays, N, {});
    tracer.release();
    const gf = new Float32Array(out);
    const gu = new Uint32Array(out);
    const cpu = createTraceHit();
    let hits = 0;
    let differ = 0;
    let worst = 0;
    for (let i = 0; i < N; i++) {
      const base = RAY_WORDS * i;
      const o = [rf[base] as number, rf[base + 1] as number, rf[base + 2] as number];
      const d = [rf[base + 4] as number, rf[base + 5] as number, rf[base + 6] as number];
      const struck = scene.rays.trace(
        o[0] as number,
        o[1] as number,
        o[2] as number,
        d[0] as number,
        d[1] as number,
        d[2] as number,
        rf[base + 3] as number,
        i,
        0,
        cpu,
      );
      const h = HIT_WORDS * i;
      const gpuStruck = gu[h + 3] !== SCENE_NONE;
      if (!gpuStruck) {
        if (struck) differ++;
        continue;
      }
      hits++;
      // The kernel's hit point against the geometry kernel's signed distance of the item.
      const { shape, at } = placed[Math.floor(i / PER)] as (typeof placed)[number];
      const t = gf[h] as number;
      worst = Math.max(
        worst,
        Math.abs(
          signedDistance(shape, [
            (o[0] as number) + t * (d[0] as number) - at[0],
            (o[1] as number) + t * (d[1] as number) - at[1],
            (o[2] as number) + t * (d[2] as number) - at[2],
          ]),
        ),
      );
      expect(gu[h + 1]).not.toBe(SCENE_NONE);
      expect(gf[h + 7]).toBeGreaterThanOrEqual(0);
      if (
        !struck ||
        gu[h + 1] !== cpu.block ||
        Math.abs(t - cpu.t) * Math.max(cpu.cosInc, 0.02) > 2e-6
      ) {
        differ++;
      }
    }
    expect(hits).toBeGreaterThan(0.5 * N);
    // On the surface within the chord error of the triangles (f32: and a micrometre).
    expect(worst).toBeLessThan(scene.trace.chordError + 2e-6);
    // Measured: 1 ray in 30,000 differs (next to the outline of a block).
    expect(differ / hits).toBeLessThan(0.001);
  });
});
