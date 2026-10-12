/**
 * Writes the stand-in rack, and a loaded scene on it, to Wavefront OBJ files, so that a person
 * can look at what the chain produces without a renderer. Every mesh is the geometry kernel's
 * render mesh of a body's `Shape`, posed where the physics world left the body.
 *
 *   pnpm --filter @spotless/integration dump-scene [output directory] [chord error in mm]
 *
 * By default the files go to `.spotless/integration/` at the repository root (a directory git
 * ignores) and the meshes use the platform's render chord error, 0.1 mm:
 *   - stand-in-rack.obj: the rack, its cutlery basket and the tub floor;
 *   - loaded-scene.obj: the mixed load of sixty catalogue items on two racks, at rest.
 * The files keep the platform's frame (z up, metres): choose "Z up" when importing.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSE_IDENTITY } from '@spotless/core';
import { RENDER_CHORD_ERROR } from '@spotless/geometry';
import {
  buildObj,
  buildStandInRack,
  createLoadingScene,
  loadMixedLoad,
  measureOverlap,
  settleScene,
  type ObjBody,
  type ObjDocument,
} from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? resolve(here, '../../../.spotless/integration'));
const chordError =
  process.argv[3] === undefined ? RENDER_CHORD_ERROR : Number(process.argv[3]) / 1000;
if (!(chordError > 0) || !Number.isFinite(chordError)) {
  throw new Error(
    `the chord error must be a positive number of millimetres, got ${process.argv[3]}`,
  );
}
mkdirSync(outDir, { recursive: true });

function write(name: string, document: ObjDocument): void {
  const path = resolve(outDir, name);
  writeFileSync(path, document.text);
  const megabytes = (Buffer.byteLength(document.text) / 1e6).toFixed(1);
  console.log(
    `${path}\n  ${document.objects.length} objects, ${document.vertices} vertices, ` +
      `${document.triangles} triangles, ${megabytes} MB`,
  );
}

// ---- the rack alone
const rack = buildStandInRack();
const rackBodies: ObjBody[] = [
  { name: 'rack', shape: rack.rack, pose: POSE_IDENTITY },
  { name: 'rack_basket', shape: rack.basket, pose: POSE_IDENTITY },
  { name: 'tub_floor', shape: rack.tubFloor, pose: POSE_IDENTITY },
];
write(
  'stand-in-rack.obj',
  buildObj(rackBodies, {
    chordError,
    comments: ['the stand-in rack of @spotless/integration: wires, cutlery basket, tub floor'],
  }),
);

// ---- the loaded scene: sixty items on two racks, simulated to rest
const scene = await createLoadingScene({ rack });
const load = loadMixedLoad(scene);
scene.world.step(960);
const settled = settleScene(scene);
const overlap = measureOverlap(scene);
const bodies: ObjBody[] = [...scene.fixtures, ...scene.items].map((body) => ({
  name: body.id,
  shape: body.shape,
  pose: scene.world.getPose(body.id),
}));
const loaded = buildObj(bodies, {
  chordError,
  comments: [
    `mixed load of ${load.count} catalogue items on two stand-in racks, at rest`,
    `state hash ${scene.world.stateHash()}`,
  ],
});
write('loaded-scene.obj', loaded);
console.log(
  `  ${load.count} items at rest: ${String(settled.atRest)}; deepest overlap of collision pieces ` +
    `${(overlap.deepest * 1000).toFixed(3)} mm`,
);
const heaviest = [...loaded.objects].sort((a, b) => b.triangles - a.triangles).slice(0, 5);
console.log(
  `  largest meshes: ${heaviest.map((o) => `${o.name} ${o.triangles}`).join(', ')} triangles`,
);
scene.world.dispose();
