// The open parts of the owner's machine as they are drawn: every part the wash lets water
// through is drawn open, by the share the wash uses, and drawing changes nothing of the shapes.
import { buildRenderMesh } from '@spotless/geometry';
import { buildMachineGeometry, findMachine } from '@spotless/machine';
import type { Mesh, MeshStandardMaterial } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  barBoxes,
  barLayout,
  barTriangles,
  barWidth,
  dotTile,
  FALLBACK_PATTERN,
  HOLE_SHADE,
  latticePattern,
} from './lattice.ts';
import { buildMachineObjects, LATTICE_SUFFIX, MACHINE_CHORD_ERROR } from './machine.ts';
import type { MachinePartInput } from './types.ts';

let parts: MachinePartInput[];

beforeAll(() => {
  const spec = findMachine('bosch_smv4hax40g');
  if (spec === undefined) throw new Error('the Bosch is not in the machine package');
  parts = buildMachineGeometry(spec, spec.defaultConfig).parts.map((part) => ({
    id: part.id,
    role: part.role,
    material: part.material,
    reference_pose: part.pose,
    shape: part.shape,
  }));
});

function subPart(partId: string, subPartId: string) {
  const found = parts.find((p) => p.id === partId)?.shape.parts.find((p) => p.id === subPartId);
  if (found === undefined) throw new Error(`no ${partId}/${subPartId}`);
  return found;
}

describe('barWidth', () => {
  it('gives the bars of the cutlery basket from its openings and open fraction', () => {
    // 7 by 16 mm openings between 2.5 mm bars are 63.7 % open, and back.
    const open = (7 * 16) / (9.5 * 18.5);
    expect(barWidth([0.007, 0.016], open)).toBeCloseTo(0.0025, 9);
    expect(barWidth([0.0035, 0.014], (3.5 * 14) / (6 * 16.5))).toBeCloseTo(0.0025, 9);
  });
});

describe('the open parts of the Bosch', () => {
  it('draws every part with an open fraction as a lattice or a perforated sheet', () => {
    const open: string[] = [];
    const solid: string[] = [];
    const unknown: string[] = [];
    for (const part of parts) {
      for (const sub of part.shape.parts) {
        if (!((sub.porosity ?? 0) > 0)) {
          expect(latticePattern(part.id, sub)).toBeNull();
          continue;
        }
        const pattern = latticePattern(part.id, sub);
        const name = `${part.id}/${sub.id}`;
        if (pattern === null) solid.push(name);
        else if (pattern === FALLBACK_PATTERN) unknown.push(name);
        else if (pattern.kind === 'bars' && barLayout(sub, pattern) === null) solid.push(name);
        else open.push(name);
      }
    }
    expect(solid).toEqual([]);
    // Every open part of this machine has openings of its own in the table.
    expect(unknown).toEqual([]);
    expect(open).toContain('cutlery_basket/foot.0.floor');
    expect(open).toContain('cutlery_basket/divider.0');
    expect(open).toContain('upper_rack_fittings/holder.knife_shelf.floor');
    expect(open).toContain('upper_rack_fittings/shelf.cup_front');
    expect(open).toContain('upper_rack_tablet_tray/floor');
    expect(open).toContain('filter/flat_plate');
    expect(open.length).toBeGreaterThanOrEqual(35);
  });

  it('draws a lattice as open as the wash takes it to be', () => {
    for (const part of parts) {
      for (const sub of part.shape.parts) {
        const pattern = latticePattern(part.id, sub);
        if (pattern === null || pattern.kind !== 'bars') continue;
        const layout = barLayout(sub, pattern);
        if (layout === null) continue;
        const porosity = sub.porosity as number;
        expect(layout.openFraction).toBeCloseTo(porosity, 9);
        expect(layout.bar).toBeGreaterThan(0.0015);
        // And an opening is near its real size along each side.
        expect(layout.opening[0] / pattern.opening[0]).toBeGreaterThan(0.6);
        expect(layout.opening[0] / pattern.opening[0]).toBeLessThan(1.5);
      }
    }
  });

  it('stands the openings of the cutlery basket walls upright, about 7 mm wide between bars of 2 to 2.5 mm', () => {
    const wall = subPart('cutlery_basket', 'foot.1.left');
    const pattern = latticePattern('cutlery_basket', wall);
    if (pattern === null || pattern.kind !== 'bars') throw new Error('not bars');
    const layout = barLayout(wall, pattern);
    if (layout === null) throw new Error('no layout');
    // The wall is thin along x, its openings are narrow along y and tall along z.
    expect(layout.through).toBe(0);
    expect(layout.runs[0].axis).toBe(1);
    expect(layout.runs[1].axis).toBe(2);
    expect(layout.bar * 1000).toBeGreaterThan(2);
    expect(layout.bar * 1000).toBeLessThanOrEqual(2.5);
    expect(layout.opening[0] * 1000).toBeGreaterThan(6);
    expect(layout.opening[0] * 1000).toBeLessThan(8);
    expect(layout.opening[1] * 1000).toBeGreaterThan(14);
    expect(layout.opening[1] * 1000).toBeLessThan(18);
  });

  it('keeps every bar inside the slab it stands for', () => {
    for (const part of parts) {
      for (const sub of part.shape.parts) {
        const pattern = latticePattern(part.id, sub);
        if (pattern === null || pattern.kind !== 'bars') continue;
        const layout = barLayout(sub, pattern);
        if (layout === null) continue;
        for (const box of barBoxes(layout)) {
          for (const axis of [0, 1, 2] as const) {
            expect(Math.abs(box.centre[axis]) + box.half[axis]).toBeLessThanOrEqual(
              layout.size[axis] / 2 + 1e-9,
            );
          }
        }
      }
    }
  });

  it('makes twelve outward-facing triangles of a bar, in the frame of the shape', () => {
    const wall = subPart('cutlery_basket', 'foot.0.front');
    const soup = barTriangles([
      { part: wall, boxes: [{ centre: [0, 0, 0], half: [0.01, 0.001, 0.02] }] },
    ]);
    expect(soup.positions.length).toBe(108);
    const centre = wall.pose.p;
    let volume = 0;
    for (let t = 0; t < 12; t++) {
      const v = [0, 1, 2].map((corner) =>
        [0, 1, 2].map(
          (axis) =>
            (soup.positions[9 * t + 3 * corner + axis] as number) - (centre[axis] as number),
        ),
      ) as [number[], number[], number[]];
      const [a, b, c] = v as [
        [number, number, number],
        [number, number, number],
        [number, number, number],
      ];
      const cross = [
        (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
        (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
      ] as const;
      // The normal stored is the one the winding gives, and it points away from the centre.
      const n = [0, 1, 2].map((axis) => soup.normals[9 * t + axis] as number);
      expect(
        cross[0] * (n[0] as number) + cross[1] * (n[1] as number) + cross[2] * (n[2] as number),
      ).toBeGreaterThan(0);
      expect(
        a[0] * (n[0] as number) + a[1] * (n[1] as number) + a[2] * (n[2] as number),
      ).toBeGreaterThan(0);
      volume += (a[0] * cross[0] + a[1] * cross[1] + a[2] * cross[2]) / 6;
    }
    expect(volume).toBeCloseTo(0.02 * 0.002 * 0.04, 12);
  });
});

describe('dotTile', () => {
  it('has the holes of the filter plate at their real size and share', () => {
    const tile = dotTile({ kind: 'dots', pitch: 0.00147 }, 0.3, 64);
    expect(tile.size[0]).toBeCloseTo(0.00147, 9);
    expect(tile.size[1]).toBeCloseTo(0.00147 * Math.sqrt(3), 9);
    expect(tile.openFraction).toBeCloseTo(0.3, 2);
    // A hole in the corner, sheet between the holes.
    expect(tile.data[0]).toBeLessThan(255 * (HOLE_SHADE + 0.05));
    expect(tile.data[4 * (64 * 16 + 32)]).toBe(255);
  });
});

describe('buildMachineObjects with lattices', () => {
  it('draws the bars in place of the slabs and leaves the shapes as they were', () => {
    const before = JSON.stringify(parts);
    const machine = buildMachineObjects(parts);
    expect(JSON.stringify(parts)).toBe(before);

    const cutlery = parts.find((p) => p.id === 'cutlery_basket') as MachinePartInput;
    const group = machine.parts.get('cutlery_basket');
    const lattice = group?.children.find((c) => c.name === `cutlery_basket${LATTICE_SUFFIX}`) as
      Mesh | undefined;
    expect(lattice).toBeDefined();
    // What is left of the solid mesh is the sub-parts that are closed: handle, tunnel roofs,
    // the hinge strips of the lids.
    const mesh = buildRenderMesh(cutlery.shape, {
      chordError: MACHINE_CHORD_ERROR,
      minSectors: 12,
    });
    const closed = new Set(
      cutlery.shape.parts.filter((p) => !((p.porosity ?? 0) > 0)).map((p) => p.id),
    );
    let closedTriangles = 0;
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      if (closed.has(mesh.partIds[mesh.triPart[t] as number] as string)) closedTriangles++;
    }
    const solid = (group?.children ?? []).filter((c) => c !== lattice) as Mesh[];
    const drawn = solid.reduce((sum, m) => sum + m.geometry.getAttribute('position').count / 3, 0);
    expect(drawn).toBe(closedTriangles);
    // The bars are of the basket's own material and stay inside its box.
    expect(lattice?.material).toBe(solid[0]?.material);
    const box = lattice?.geometry.boundingBox;
    expect(box?.min.z).toBeGreaterThanOrEqual(-1e-6);
    expect(box?.max.z).toBeLessThanOrEqual(0.127 + 1e-6);

    // The filter plate keeps its mesh and gets the pattern of its holes.
    const filter = machine.parts.get('filter');
    const dotted = (filter?.children ?? []).filter(
      (c) => ((c as Mesh).material as MeshStandardMaterial).map !== null,
    ) as Mesh[];
    expect(dotted.length).toBe(2);
    for (const sheet of dotted) expect(sheet.geometry.getAttribute('uv')).toBeDefined();
    machine.dispose();
  });
});
