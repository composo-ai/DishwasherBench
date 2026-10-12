// Check over the whole catalogue (too long for a unit test): every item type is built into a
// scene of its own at both block sizes, and a ray fired at every sampled block centre along the
// inward normal from 10 mm away must come back with that block.
//
//   pnpm --filter @spotless/sim-scene run check:catalogue
//
// Prints one line per item type and exits with status 1 if a triangle of the ray mesh could not
// be tied to its analytic piece, a part could not be represented, or more than 0.3 % of the rays
// of the catalogue name another block (the allowance is for flush joints between two parts of
// one item, where the block of either part is a right answer).
import { POSE_IDENTITY } from '@spotless/core';
import { buildWashScene } from '../src/scene.ts';
import { BLOCK_FLAG } from '../src/scene-types.ts';
import { catalogueItem, catalogueMaterial, usableItemTypeIds } from '../src/testing/catalogue.ts';
import { createTraceHit } from '../src/trace-cpu.ts';

let failed = false;
for (const blockSize of [0.002, 0.004]) {
  const hit = createTraceHit();
  let fired = 0;
  let wrong = 0;
  let blocks = 0;
  for (const id of usableItemTypeIds()) {
    const scene = buildWashScene({
      items: [catalogueItem('a', id, POSE_IDENTITY)],
      machine: [],
      blockSize,
      materials: catalogueMaterial,
    });
    const b = scene.blocks;
    blocks += b.count;
    let itemFired = 0;
    let itemWrong = 0;
    const stride = Math.max(1, Math.floor(b.count / 3000));
    for (let i = 0; i < b.count; i += stride) {
      if (((b.flags[i] as number) & (BLOCK_FLAG.line | BLOCK_FLAG.porous)) !== 0) continue;
      const c = [
        b.centre[3 * i] as number,
        b.centre[3 * i + 1] as number,
        b.centre[3 * i + 2] as number,
      ];
      const n = [
        b.normal[3 * i] as number,
        b.normal[3 * i + 1] as number,
        b.normal[3 * i + 2] as number,
      ];
      const struck = scene.rays.trace(
        (c[0] as number) + 0.01 * (n[0] as number),
        (c[1] as number) + 0.01 * (n[1] as number),
        (c[2] as number) + 0.01 * (n[2] as number),
        -(n[0] as number),
        -(n[1] as number),
        -(n[2] as number),
        0.02,
        0,
        0,
        hit,
      );
      // Another part of the item in the way: the ray never reached the block.
      if (struck && hit.t < 0.01 - 2e-6) continue;
      itemFired++;
      if (!struck || hit.block !== i || Math.abs(hit.t - 0.01) > 2e-6) itemWrong++;
    }
    fired += itemFired;
    wrong += itemWrong;
    const bad = scene.counts.unclassifiedTriangles > 0 || scene.unsupported.length > 0;
    if (bad) failed = true;
    console.log(
      `${(1000 * blockSize).toFixed(0)} mm ${id.padEnd(34)} blocks ${String(b.count).padStart(7)} ` +
        `triangles ${String(scene.counts.triangles).padStart(6)} rays ${String(itemFired).padStart(5)} ` +
        `other block ${String(itemWrong).padStart(3)}${bad ? '  UNCLASSIFIED OR UNSUPPORTED' : ''}`,
    );
  }
  console.log(
    `${(1000 * blockSize).toFixed(0)} mm: ${blocks} blocks over the catalogue; ${wrong} of ${fired} rays name another block ` +
      `(${((100 * wrong) / fired).toFixed(3)} %)`,
  );
  if (wrong / fired > 0.003) failed = true;
}
process.exit(failed ? 1 : 0);
