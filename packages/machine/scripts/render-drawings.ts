/**
 * Renders the SVG drawings written by `draw-machine` to PNG files of the same name, with a
 * headless Chrome (no dependency of this package: the browser is run as a program).
 *
 *   pnpm --filter @spotless/machine render-drawings [directory]
 *
 * The directory defaults to `docs/reference/machine-drawings/` at the repository root. The
 * browser is the program named by `SPOTLESS_CHROME`, or the first Chrome or Chromium in the
 * usual places of the system. One SVG user unit (one millimetre) is one pixel.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveChrome } from '../../render/src/headless/chrome.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(process.argv[2] ?? resolve(here, '../../../docs/reference/machine-drawings'));
const chrome = resolveChrome();

for (const file of readdirSync(dir)
  .filter((name) => name.endsWith('.svg'))
  .sort()) {
  const svgPath = resolve(dir, file);
  const size = /width="([\d.]+)" height="([\d.]+)"/.exec(readFileSync(svgPath, 'utf8'));
  if (size === null) throw new Error(`${file}: no width and height`);
  const width = Math.ceil(Number(size[1]));
  const height = Math.ceil(Number(size[2]));
  const pngPath = svgPath.replace(/\.svg$/, '.png');
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=FFFFFFFF',
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(svgPath).href,
    ],
    { stdio: 'ignore', timeout: 60_000 },
  );
  console.log(`${pngPath}  ${width} x ${height}`);
}
