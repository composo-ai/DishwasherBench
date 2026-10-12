/**
 * What a frame of the page costs with the perforated parts drawn as lattices, without the
 * 60-frames-a-second cap of the browser: the page's own stage is asked to draw the tutorial's
 * machine three hundred times in a row, each frame forced through the GPU by reading one pixel
 * back, with the lattices shown and with them hidden, in turn, five times each.
 *
 *   vite build && tsx scripts/measure-frame.ts [--view iso_lower]
 *
 * Hidden, the lattices leave holes where the closed slabs used to be drawn, so the difference
 * is the whole cost of the bars, a little more than what they cost over the slabs they replaced
 * (the machine has slightly fewer triangles with the lattices than it had with the slabs).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer } from '@spotless/server';
import { placeholderWashRunner } from '@spotless/session';
import type { DebugState } from './driver.ts';
import { caughtUp, launchChrome, view } from './driver.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const at = process.argv.indexOf('--view');
const viewName = at >= 0 ? (process.argv[at + 1] ?? 'iso_lower') : 'iso_lower';
const dataDir = mkdtempSync(join(tmpdir(), 'spotless-frame-'));
const server = await buildServer({
  dataDir,
  staticDir: join(here, '..', 'dist'),
  washRunner: placeholderWashRunner,
  washRunnerVersion: 'placeholder',
});
await server.app.listen({ port: 0, host: '127.0.0.1' });
const browser = await launchChrome();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}/`, {
    waitUntil: 'networkidle0',
  });
  await page.click('.level[data-level-id="tutorial"]');
  await page.waitForFunction(
    () =>
      (window as unknown as { spotless?: { debugState(): DebugState } }).spotless?.debugState()
        .phase === 'loading',
    { timeout: 60_000 },
  );
  await caughtUp(page);
  await view(page, viewName);
  // Given as text: the page's own objects are reached by name.
  const result = (await page.evaluate(`(() => {
    const stage = window.spotless.stage;
    const gl = stage.canvas.getContext('webgl2');
    const pixel = new Uint8Array(4);
    const lattices = [];
    let triangles = 0;
    stage.scene.scene.traverse((object) => {
      if (typeof object.name === 'string' && object.name.endsWith('.lattice')) {
        lattices.push(object);
        const geometry = object.geometry;
        if (geometry && geometry.index) triangles += geometry.index.count / 3;
        else if (geometry && geometry.attributes.position) {
          triangles += geometry.attributes.position.count / 3;
        }
      }
    });
    const run = (shown) => {
      for (const object of lattices) object.visible = shown;
      const t0 = performance.now();
      for (let i = 0; i < 300; i++) {
        stage.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      }
      return (performance.now() - t0) / 300;
    };
    run(true);
    const on = [];
    const off = [];
    for (let round = 0; round < 5; round++) {
      on.push(run(true));
      off.push(run(false));
    }
    for (const object of lattices) object.visible = true;
    return { lattices: lattices.length, triangles, on, off, width: stage.canvas.width, height: stage.canvas.height };
  })()`)) as {
    lattices: number;
    triangles: number;
    on: number[];
    off: number[];
    width: number;
    height: number;
  };
  const median = (list: number[]): number =>
    [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] as number;
  const text = (list: number[]): string => list.map((v) => v.toFixed(2)).join(' ');
  console.log(
    `view ${viewName}, canvas ${result.width} x ${result.height}, ${result.lattices} lattice meshes, ${result.triangles} triangles in them`,
  );
  console.log(
    `  with the lattices:    median ${median(result.on).toFixed(2)} ms a frame (${text(result.on)})`,
  );
  console.log(
    `  with them hidden:     median ${median(result.off).toFixed(2)} ms a frame (${text(result.off)})`,
  );
  console.log(
    `  the lattices cost ${(median(result.on) - median(result.off)).toFixed(2)} ms a frame; a frame at 60 a second has 16.7 ms`,
  );
} finally {
  await browser.close();
  await server.app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
