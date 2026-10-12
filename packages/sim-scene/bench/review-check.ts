// Checks behind the review of the scene build (too long for unit tests): each section measures
// one property against the geometry kernel alone and prints a table row per case.
//
//   pnpm --filter @spotless/sim-scene run check:review [-- full]
//
// 1. Soil cells: isotropic chords at cutlery and a board; hits that name a soil cell without
//    area (must be 0) and chi-squared per cell of hits against area (near 1).
// 2. Masking: live block area per half-buried part against the exposed area of the kernel's
//    render mesh (bracketed by counting pieces 0.2 mm clear of, or up to 0.2 mm inside, another
//    part).
// 3. Tracer: reference hits against the kernel's signed distance and against marching it, for
//    rays along wires and standing cutlery and for isotropic rays.
// 4. Blocks that stand for many grid cells: rounded boxes and hulls whose surface is mostly
//    rounded edge (a simplification; the numbers are quoted in the engineer's list).
// 5. Full load (with `full`): hits without a block, per 300,000 rays through the chamber.
//
// Exits with status 1 if a hit names a soil cell without area or no block, a hit lies further
// from the surface than the chord error, a hit has a negative cosine of incidence, or a part's
// live area leaves its bracket by more than 5 %.
import { POSE_IDENTITY } from '@spotless/core';
import { boundingBox, signedDistance, type Shape } from '@spotless/geometry';
import { PATCH_KIND, type AtlasPatch } from '../src/atlas-core.ts';
import { buildShapeAtlas } from '../src/atlas.ts';
import { buildWashScene } from '../src/scene.ts';
import { SCENE_NONE, type WashScene } from '../src/scene-types.ts';
import {
  catalogueItem,
  catalogueMaterial,
  instantiate,
  usableItemTypeIds,
} from '../src/testing/catalogue.ts';
import { fullLoad } from '../src/testing/full-load.ts';
import {
  alongAxisRay,
  chordRay,
  exposedAreaByPart,
  sphereTrace,
  unitRandom,
  type TestRay,
} from '../src/testing/reference.ts';
import { atlasOptions, testMaterial } from '../src/testing/shapes.ts';
import { createTraceHit } from '../src/trace-cpu.ts';

const full = process.argv.includes('full');
const usable = new Set(usableItemTypeIds());
const materials = (id: string) => (id === 'test' ? testMaterial(id) : catalogueMaterial(id));
let failed = false;
const fail = (message: string): void => {
  failed = true;
  console.log(`  FAILED: ${message}`);
};
const cm2 = (a: number): string => (a * 1e4).toFixed(2);
const fire = (scene: WashScene, ray: TestRay, hit: ReturnType<typeof createTraceHit>): boolean =>
  scene.rays.trace(
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
  );

console.log('1. Soil cells: 300,000 isotropic chords per item, every region soiled');
for (const id of [
  'dinner_fork_185',
  'dinner_knife_210',
  'steak_knife_230',
  'chefs_knife_200',
  'turner_nylon_279',
  'chopping_board_pe_340',
]) {
  if (!usable.has(id)) continue;
  const shape = instantiate(id).shape;
  const regions = shape.regions.map((region) => region.id);
  const box = boundingBox(shape);
  for (const blockSize of [0.002, 0.004]) {
    const scene = buildWashScene({
      items: [catalogueItem('a', id, POSE_IDENTITY, regions)],
      machine: [],
      blockSize,
      materials,
    });
    const cells = scene.soilCells;
    const counts = new Float64Array(cells.count);
    const hit = createTraceHit();
    let hits = 0;
    let onEmpty = 0;
    for (let i = 0; i < 300_000; i++) {
      if (!fire(scene, chordRay(7, i, box), hit) || hit.soilCell === SCENE_NONE) continue;
      hits++;
      counts[hit.soilCell] = (counts[hit.soilCell] as number) + 1;
      if (!((cells.area[hit.soilCell] as number) > 0)) onEmpty++;
    }
    let total = 0;
    let empty = 0;
    for (let c = 0; c < cells.count; c++) {
      total += cells.area[c] as number;
      if (!((cells.area[c] as number) > 0)) empty++;
    }
    let chi = 0;
    let used = 0;
    for (let c = 0; c < cells.count; c++) {
      const expected = (hits * (cells.area[c] as number)) / total;
      if (expected < 1) continue;
      chi += ((counts[c] as number) - expected) ** 2 / expected;
      used++;
    }
    console.log(
      `  ${id.padEnd(24)} ${(1000 * blockSize).toFixed(0)} mm  hits ${String(hits).padStart(6)}  ` +
        `on cells without area ${onEmpty}  cells ${cells.count} (${empty} without area)  ` +
        `chi2 per cell ${(chi / Math.max(1, used)).toFixed(2)}`,
    );
    if (onEmpty > 0) fail(`${id}: ${onEmpty} hits on soil cells without area`);
  }
}

console.log('2. Masking: live block area against exposed area by the kernel, cm2, parts with');
console.log('   more than 5 % of their area buried; exposed as low / middle / high estimate');
for (const id of [
  'mug_glass_240',
  'mug_ceramic_300',
  'tea_cup_porcelain_200',
  'measuring_jug_glass_500',
  'glass_jug_1000',
  'dinner_fork_185',
  'spatula_silicone_280',
  'wine_glass_red_540',
]) {
  if (!usable.has(id)) continue;
  const shape = instantiate(id).shape;
  // Small parts only: the body of a jug takes minutes at this resolution and buries nothing.
  const small = shape.parts.map((part) => {
    const box = boundingBox({ parts: [part], regions: [] });
    return (
      Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) < 0.2
    );
  });
  const wanted = (part: number): boolean => shape.parts.length > 1 && small[part] === true;
  const [mid, low, high] = exposedAreaByPart(shape, [0, 0.2e-3, -0.2e-3], wanted) as [
    Float64Array,
    Float64Array,
    Float64Array,
  ];
  for (const blockSize of [0.002, 0.004]) {
    const atlas = buildShapeAtlas(shape, atlasOptions(blockSize));
    const live = new Float64Array(shape.parts.length);
    for (let b = 0; b < atlas.blockCount; b++) {
      const part = atlas.blockPart[b] as number;
      live[part] = (live[part] as number) + (atlas.area[b] as number);
    }
    shape.parts.forEach((part, index) => {
      if (!wanted(index) || (mid[index] as number) > 0.95 * (atlas.partArea[index] as number)) {
        return;
      }
      console.log(
        `  ${id.padEnd(24)} ${(1000 * blockSize).toFixed(0)} mm  ${part.id.padEnd(12)} ` +
          `whole ${cm2(atlas.partArea[index] as number).padStart(7)}  live ${cm2(live[index] as number).padStart(7)}  ` +
          `exposed ${cm2(low[index] as number)} / ${cm2(mid[index] as number)} / ${cm2(high[index] as number)}`,
      );
      if (
        (live[index] as number) < 0.95 * (low[index] as number) ||
        (live[index] as number) > 1.05 * (high[index] as number)
      ) {
        fail(`${id} ${part.id}: live area outside the bracket`);
      }
    });
  }
}

console.log('3. Tracer against the signed distance (hits, share left on the triangle, furthest');
console.log('   hit from the surface, share whose distance differs from the marched first hit');
console.log('   by more than 0.1 mm, on a sample of one ray in five)');
const wire = (radius: number): Shape => ({
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
const traced: [string, Shape, number][] = [
  ['wire 2 mm', wire(0.001), 0.0002],
  ['wire 4.25 mm', wire(0.002125), 0.0004],
  ['rod 8 mm', wire(0.004), 0.0008],
];
for (const id of [
  'dinner_fork_185',
  'dinner_knife_210',
  'mug_ceramic_300',
  'cereal_bowl_porcelain_160',
]) {
  if (usable.has(id)) traced.push([id, instantiate(id).shape, 0]);
}
for (const [name, shape, margin] of traced) {
  const scene = buildWashScene({
    items: [{ itemId: 'a', typeId: 'test', shape, pose: POSE_IDENTITY, soils: [] }],
    machine: [],
    blockSize: 0.004,
    materials,
  });
  const box = boundingBox(shape);
  const families: [string, (i: number) => TestRay][] = [
    ['along the axis, up to 2 degrees', (i) => alongAxisRay(11, i, box, 0.035, margin)],
    ['along the axis, up to 5 degrees', (i) => alongAxisRay(12, i, box, 0.087, margin)],
    ['isotropic', (i) => chordRay(13, i, box)],
  ];
  for (const [family, make] of families) {
    const hit = createTraceHit();
    let hits = 0;
    let uncorrected = 0;
    let worst = 0;
    let sampled = 0;
    let late = 0;
    for (let i = 0; i < 50_000; i++) {
      const ray = make(i);
      if (!fire(scene, ray, hit)) continue;
      hits++;
      if (!hit.corrected) uncorrected++;
      if (hit.block === SCENE_NONE) fail(`${name}: a hit without a block`);
      if (!(hit.cosInc >= 0)) fail(`${name}: cosine of incidence ${hit.cosInc}`);
      worst = Math.max(
        worst,
        Math.abs(
          signedDistance(shape, [
            ray.o[0] + hit.t * ray.d[0],
            ray.o[1] + hit.t * ray.d[1],
            ray.o[2] + hit.t * ray.d[2],
          ]),
        ),
      );
      if (i % 5 === 0) {
        sampled++;
        if (Math.abs(sphereTrace(shape, ray) - hit.t) > 1e-4) late++;
      }
    }
    console.log(
      `  ${name.padEnd(26)} ${family.padEnd(32)} hits ${String(hits).padStart(6)}  ` +
        `on triangle ${((100 * uncorrected) / Math.max(1, hits)).toFixed(2)} %  ` +
        `furthest ${(1e6 * worst).toFixed(1)} um  distance differs ${((100 * late) / Math.max(1, sampled)).toFixed(2)} %`,
    );
    if (worst > scene.trace.chordError + 1e-6) fail(`${name}: a hit ${worst} m off the surface`);
  }
}

console.log('4. Blocks of rounded boxes and hulls at 2 mm: parts whose mean block area exceeds');
console.log('   three grid cells (12 mm2)');
{
  let parts = 0;
  const rows: [number, string][] = [];
  for (const id of usable) {
    const shape = instantiate(id).shape;
    const atlas = buildShapeAtlas(shape, atlasOptions(0.002));
    const sum = new Float64Array(shape.parts.length);
    const count = new Float64Array(shape.parts.length);
    const largest = new Float64Array(shape.parts.length);
    for (let b = 0; b < atlas.blockCount; b++) {
      const patch = atlas.patches[atlas.blockPatch[b] as number] as AtlasPatch;
      if (patch.kind !== PATCH_KIND.cart || patch.polygon === null) continue;
      const part = atlas.blockPart[b] as number;
      sum[part] = (sum[part] as number) + (atlas.area[b] as number);
      count[part] = (count[part] as number) + 1;
      largest[part] = Math.max(largest[part] as number, atlas.area[b] as number);
    }
    shape.parts.forEach((part, index) => {
      const mean = (sum[index] as number) / Math.max(1, count[index] as number);
      if (mean <= 12e-6) return;
      parts++;
      rows.push([
        mean,
        `  ${id.padEnd(26)} ${part.id.padEnd(14)} blocks ${String(count[index]).padStart(5)}  ` +
          `mean ${(1e6 * mean).toFixed(0)} mm2  largest ${(1e6 * (largest[index] as number)).toFixed(0)} mm2`,
      ]);
    });
  }
  rows.sort((a, b) => b[0] - a[0]);
  for (const [, line] of rows.slice(0, 12)) console.log(line);
  console.log(`  ${parts} such parts over ${usable.size} item types`);
}

if (full) {
  console.log('5. Full load: 300,000 rays from random points of the chamber');
  const { input } = fullLoad();
  for (const blockSize of [0.004, 0.002]) {
    const scene = buildWashScene({ ...input, blockSize });
    const chamber = input.chamber;
    if (chamber === undefined) throw new Error('the full load has no chamber');
    const hit = createTraceHit();
    let hits = 0;
    let none = 0;
    let uncorrected = 0;
    for (let i = 0; i < 300_000; i++) {
      const o = [0, 1, 2].map(
        (k) =>
          (chamber.min[k] as number) +
          0.01 +
          unitRandom(17, i, k) * ((chamber.max[k] as number) - (chamber.min[k] as number) - 0.02),
      ) as [number, number, number];
      const z = 2 * unitRandom(17, i, 3) - 1;
      const phi = 2 * Math.PI * unitRandom(17, i, 4);
      const s = Math.sqrt(1 - z * z);
      const ray: TestRay = { o, d: [s * Math.cos(phi), s * Math.sin(phi), z], length: 1 };
      if (!scene.rays.trace(o[0], o[1], o[2], ray.d[0], ray.d[1], ray.d[2], 1, i, 1, hit)) continue;
      // A ray that starts inside a solid and leaves it at once is not a hit to judge.
      if (hit.t < 1e-4) continue;
      hits++;
      if (hit.block === SCENE_NONE) none++;
      if (!hit.corrected) uncorrected++;
    }
    console.log(
      `  ${(1000 * blockSize).toFixed(0)} mm  blocks ${scene.counts.blocks}  soil cells ${scene.counts.soilCells}  ` +
        `hits ${hits}  without a block ${none}  on triangle ${uncorrected}  unsupported ${scene.unsupported.length}`,
    );
    if (none > 0) fail(`full load: ${none} hits without a block`);
  }
}
process.exit(failed ? 1 : 0);
