/**
 * Writes the scale drawings of a machine as SVG files: a top view of each basket with every
 * wire and tine, a front and a side elevation of the whole interior with baskets and arms (the
 * front elevation at every height position of an adjustable basket), and a top view of each
 * spray arm with its nozzles numbered.
 *
 *   pnpm --filter @spotless/machine draw-machine [output directory] [machine id]
 *
 * By default the files go to `docs/reference/machine-drawings/` at the repository root and the
 * machine is the primary one (the owner's Bosch). One SVG user unit is one millimetre. The
 * drawings are projections of the same shapes `buildMachineGeometry` hands to the simulation.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMachine, machineDrawings, PRIMARY_MACHINE, renderSvg } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(
  process.argv[2] ?? resolve(here, '../../../docs/reference/machine-drawings'),
);
const machineId = process.argv[3];
const spec = machineId === undefined ? PRIMARY_MACHINE : findMachine(machineId);
if (spec === undefined) throw new Error(`no machine "${String(machineId)}"`);

mkdirSync(outDir, { recursive: true });
for (const { name, drawing } of machineDrawings(spec)) {
  const path = resolve(outDir, `${name}.svg`);
  const svg = renderSvg(drawing);
  writeFileSync(path, svg);
  const marks = drawing.layers.reduce((n, layer) => n + layer.marks.length, 0);
  console.log(
    `${path}\n  ${drawing.title}; ${marks} marks, ${(Buffer.byteLength(svg) / 1000).toFixed(0)} kB`,
  );
}
