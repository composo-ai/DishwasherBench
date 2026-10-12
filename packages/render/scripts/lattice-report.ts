/**
 * What drawing the open parts of the machine as lattices costs and how true it is.
 *
 *   npx tsx packages/render/scripts/lattice-report.ts
 *
 * Prints, per machine part with open sub-parts: how many are drawn as bars and as dotted
 * sheets, the triangles of their slabs (what was drawn before) and of their bars (what is
 * drawn now), and the open fraction drawn against the one the wash uses. Ends with the
 * triangles of the whole machine before and after, and a SHA-256 of the machine's shapes
 * (what collision and the wash are built from), taken before and after the drawing is built.
 */
import { createHash } from 'node:crypto';
import { buildRenderMesh } from '@spotless/geometry';
import { buildMachineGeometry, findMachine } from '@spotless/machine';
import type { Mesh } from 'three';
import { barBoxes, barLayout, dotTile, latticePattern } from '../src/lattice.ts';
import { buildMachineObjects, MACHINE_CHORD_ERROR } from '../src/machine.ts';

const spec = findMachine('bosch_smv4hax40g');
if (spec === undefined) throw new Error('the Bosch is not in the machine package');
const geometry = buildMachineGeometry(spec, spec.defaultConfig);
const parts = geometry.parts.map((part) => ({
  id: part.id,
  role: part.role,
  material: part.material,
  reference_pose: part.pose,
  shape: part.shape,
}));
const sha = (): string => createHash('sha256').update(JSON.stringify(geometry.parts)).digest('hex');
const shapesBefore = sha();

let machineBefore = 0;
for (const part of parts) {
  const mesh = buildRenderMesh(part.shape, { chordError: MACHINE_CHORD_ERROR, minSectors: 12 });
  machineBefore += mesh.indices.length / 3;
  const slabTriangles = new Map<string, number>();
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const id = mesh.partIds[mesh.triPart[t] as number] as string;
    slabTriangles.set(id, (slabTriangles.get(id) ?? 0) + 1);
  }
  let bars = 0;
  let dots = 0;
  let before = 0;
  let after = 0;
  let worst = 0;
  const lines: string[] = [];
  for (const sub of part.shape.parts) {
    const pattern = latticePattern(part.id, sub);
    if (pattern === null) continue;
    const porosity = sub.porosity as number;
    if (pattern.kind === 'dots') {
      dots += 1;
      const tile = dotTile(pattern, porosity, 64);
      lines.push(
        `    ${sub.id}: dots at ${(pattern.pitch * 1000).toFixed(2)} mm, drawn ${tile.openFraction.toFixed(3)} open, wash ${porosity.toFixed(3)}`,
      );
      continue;
    }
    const layout = barLayout(sub, pattern);
    if (layout === null) continue;
    bars += 1;
    before += slabTriangles.get(sub.id) ?? 0;
    after += 12 * barBoxes(layout).length;
    worst = Math.max(worst, Math.abs(layout.openFraction - porosity));
    lines.push(
      `    ${sub.id}: ${String(layout.runs[0].count)} x ${String(layout.runs[1].count)} openings of ${(layout.opening[0] * 1000).toFixed(1)} x ${(layout.opening[1] * 1000).toFixed(1)} mm, bars ${(layout.bar * 1000).toFixed(1)} mm, drawn ${layout.openFraction.toFixed(3)} open, wash ${porosity.toFixed(3)}`,
    );
  }
  if (bars + dots === 0) continue;
  console.log(
    `${part.id}: ${String(bars)} lattices, ${String(dots)} dotted sheets; triangles of the slabs ${String(before)}, of the bars ${String(after)}; largest difference in open fraction ${worst.toFixed(3)}`,
  );
  if (process.argv.includes('--parts')) for (const line of lines) console.log(line);
}

const machine = buildMachineObjects(parts);
let machineAfter = 0;
let objects = 0;
for (const group of machine.parts.values()) {
  for (const child of group.children) {
    machineAfter += (child as Mesh).geometry.getAttribute('position').count / 3;
    objects += 1;
  }
}
console.log(
  `whole machine: ${String(machineBefore)} triangles before, ${String(machineAfter)} now, in ${String(objects)} objects`,
);
const shapesAfter = sha();
console.log(
  `machine shapes sha256 before drawing ${shapesBefore.slice(0, 16)}, after ${shapesAfter.slice(0, 16)}: ${shapesBefore === shapesAfter ? 'same' : 'DIFFERENT'}`,
);
