/**
 * Puts the saved load `owner-2026-10-10` beside the photograph it reproduces: the owner's
 * photograph of his loaded lower basket on the left, the lower basket of the saved load drawn
 * from about the same side (from the front, looking down at 50 degrees) on the right, and
 * under it the basket from straight above. Written to `loads/owner-2026-10-10-beside-photo.png`.
 *
 *   pnpm --filter @spotless/loader exec tsx scripts/owner-picture.ts
 *
 * The photograph is a JPEG; it is turned into a PNG with macOS's `sips` (the only step here
 * that needs anything beyond this package). The drawing is orthographic, the photograph is
 * not: compare where things stand and how they lean, not sizes at the edges.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { writePng } from '../src/png.ts';
import type { Raster } from '../src/render.ts';
import { contactSheet, renderView } from '../src/render.ts';
import { renderStandardView, sceneOfManifest } from '../src/scene.ts';
import type { StandardLoad } from '../src/standard-loads.ts';
import { washManifestOf } from '../src/standard-loads.ts';

const here = dirname(fileURLToPath(import.meta.url));
const loadsDir = join(here, '..', 'loads');
const photo = join(
  here,
  '..',
  '..',
  '..',
  'docs',
  'reference',
  'owner-photos',
  '2026-10-10-lower-basket-loaded-by-owner.jpg',
);

const load = JSON.parse(
  readFileSync(join(loadsDir, 'owner-2026-10-10.json'), 'utf8'),
) as StandardLoad;
const scene = sceneOfManifest(washManifestOf(load));

// The lower basket and what is in it, as in the view from above: the upper basket left out.
const lower = scene.bodies.filter(
  (b) =>
    scene.lowerLevel.has(b.id) ||
    (!scene.upperLevel.has(b.id) &&
      b.pose.p[2] < scene.upperFloorZ - 0.1 &&
      b.id !== 'upper_arm' &&
      b.id !== 'upper_arm_feed'),
);
const { min, max } = scene.bounds;
const fromFront = renderView(
  lower,
  {
    name: 'from the front above',
    right: [1, 0, 0],
    // Looking down at 50 degrees from the front: up in the picture is back and up.
    up: [0, Math.sin((50 * Math.PI) / 180), Math.cos((50 * Math.PI) / 180)],
    bounds: { min: [min[0], min[1], 0], max: [max[0], max[1], scene.upperFloorZ - 0.1] },
    caption: 'the saved load from the front, looking down at 50 degrees',
  },
  { widthPx: 900 },
);
const fromAbove = renderStandardView(scene, 'top-lower', 900);

const work = mkdtempSync(join(tmpdir(), 'spotless-owner-'));
let photograph: Raster;
try {
  const png = join(work, 'photo.png');
  execFileSync('sips', ['-s', 'format', 'png', '-Z', '1200', photo, '--out', png], {
    stdio: 'ignore',
  });
  const decoded = PNG.sync.read(readFileSync(png));
  photograph = { width: decoded.width, height: decoded.height, rgba: new Uint8Array(decoded.data) };
} finally {
  rmSync(work, { recursive: true, force: true });
}

const out = join(loadsDir, 'owner-2026-10-10-beside-photo.png');
writePng(out, contactSheet([photograph, contactSheet([fromFront, fromAbove], 1)], 2));
console.log(out);
