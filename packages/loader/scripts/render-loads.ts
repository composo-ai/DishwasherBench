/**
 * Draws the pictures of saved standard loads again from their wash manifests: `<name>.png`
 * beside each `<name>.json` (both baskets from above, the front, the side).
 *
 *   pnpm --filter @spotless/loader render-loads [names...]
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng } from '../src/png.ts';
import { renderLoadSheet, sceneOfManifest } from '../src/scene.ts';
import type { StandardLoad } from '../src/standard-loads.ts';
import { washManifestOf } from '../src/standard-loads.ts';

const loadsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'loads');
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
for (const file of readdirSync(loadsDir).sort()) {
  if (!file.endsWith('.json') || file === 'SUMMARY.json') continue;
  const name = file.replace(/\.json$/, '');
  if (names.length > 0 && !names.includes(name)) continue;
  const load = JSON.parse(readFileSync(join(loadsDir, file), 'utf8')) as StandardLoad;
  writePng(join(loadsDir, `${name}.png`), renderLoadSheet(sceneOfManifest(washManifestOf(load))));
  console.log(`${name}.png`);
}
