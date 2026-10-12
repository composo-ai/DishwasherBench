/** Writing a rendered picture as a PNG file (Node only). */

import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Raster } from './render.ts';

/** The PNG bytes of a picture. */
export function encodePng(raster: Raster): Uint8Array {
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data.set(raster.rgba);
  return PNG.sync.write(png, { colorType: 2, inputHasAlpha: true });
}

/** Writes a picture to a PNG file. */
export function writePng(path: string, raster: Raster): void {
  writeFileSync(path, encodePng(raster));
}
