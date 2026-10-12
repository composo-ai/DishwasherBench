/**
 * Writes a whole machine to a Wavefront OBJ file from the geometry kernel's render meshes, for
 * inspection in a 3D viewer.
 *
 *   pnpm --filter @spotless/machine export-obj [output file] [machine id] [chord error in mm]
 *
 * By default the file is `.spotless/machine/<machine id>.obj` at the repository root (a
 * directory git ignores), the machine is the primary one in its default configuration, and the
 * meshes use the platform's render chord error, 0.1 mm. A second file, `<name>-open.obj`, shows
 * the baskets pulled out to the end of their travel. The files keep the tub frame (z up,
 * metres): choose "Z up" when importing.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RENDER_CHORD_ERROR } from '@spotless/geometry';
import { buildMachineGeometry, findMachine, machineObj, PRIMARY_MACHINE } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const machineId = process.argv[3];
const spec = machineId === undefined ? PRIMARY_MACHINE : findMachine(machineId);
if (spec === undefined) throw new Error(`no machine "${String(machineId)}"`);
const outFile = resolve(
  process.argv[2] ?? resolve(here, `../../../.spotless/machine/${spec.id}.obj`),
);
const chordError =
  process.argv[4] === undefined ? RENDER_CHORD_ERROR : Number(process.argv[4]) / 1000;
if (!(chordError > 0) || !Number.isFinite(chordError)) {
  throw new Error(
    `the chord error must be a positive number of millimetres, got ${process.argv[4]}`,
  );
}

mkdirSync(dirname(outFile), { recursive: true });
const geometry = buildMachineGeometry(spec);
const report = (path: string, document: ReturnType<typeof machineObj>): void => {
  writeFileSync(path, document.text);
  console.log(
    `${path}\n  ${document.objects.length} objects, ${document.vertices} vertices, ${document.triangles} triangles, ${(Buffer.byteLength(document.text) / 1e6).toFixed(1)} MB`,
  );
};
report(outFile, machineObj(geometry, { chordError }));
const travel: Record<string, number> = {};
for (const envelope of geometry.affordances.baskets)
  travel[envelope.basketId] = envelope.travel.distance;
report(
  outFile.replace(/\.obj$/, '-open.obj'),
  machineObj(geometry, {
    chordError,
    basketTravel: travel,
    // The closed door would stand in the way of the pulled-out baskets.
    include: (part) => part.component !== 'door' && part.component !== 'dispenser',
  }),
);
