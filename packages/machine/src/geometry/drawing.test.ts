/**
 * The drawings and the OBJ export: that they show what is in the geometry, one mark or one
 * object per piece, at the right place and scale.
 */

import type { Vec3 } from '@spotless/core';
import { boundingBox, COLLISION_CHORD_ERROR } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import { expectNear, must } from '../test-util.ts';
import { buildMachineGeometry, getMachinePart } from './build.ts';
import { convexHull2, marksBounds, projectPoint, renderSvg, shapeMarks } from './drawing.ts';
import { machineDrawings } from './drawings.ts';
import { machineObj } from './obj.ts';

const geometry = buildMachineGeometry(B);
const drawings = machineDrawings(B);
const drawing = (name: string) => must(drawings.find((d) => d.name === name)).drawing;
const identity = { p: [0, 0, 0] as const, q: [0, 0, 0, 1] as const };

describe('projection', () => {
  it('draws millimetres with the back up the page (top) and z up the page (elevations)', () => {
    const p: Vec3 = [0.1, 0.2, 0.3];
    expect(projectPoint(p, 'top')).toEqual([100, -200]);
    expect(projectPoint(p, 'front')).toEqual([100, -300]);
    expect(projectPoint(p, 'side')).toEqual([200, -300]);
  });

  it('computes the convex hull of points in the plane', () => {
    const hull = convexHull2([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [2, 7],
      [10, 5],
    ]);
    expect(hull).toHaveLength(4);
    const area = hull.reduce((sum, a, i) => {
      const b = must(hull[(i + 1) % hull.length]);
      return sum + (a[0] * b[1] - b[0] * a[1]) / 2;
    }, 0);
    expectNear(Math.abs(area), 100, 1e-12);
  });

  it('draws a capsule as a line of its own width, a ball as a circle, a slab as its outline', () => {
    const marks = shapeMarks(
      {
        parts: [
          {
            id: 'wire',
            prim: { kind: 'capsule', a: [0, 0, 0], b: [0.1, 0, 0], radius: 0.002 },
            pose: identity,
            material: 'm',
          },
          {
            id: 'ball',
            prim: { kind: 'capsule', a: [0, 0.05, 0], b: [0, 0.05, 0], radius: 0.003 },
            pose: identity,
            material: 'm',
          },
          {
            id: 'slab',
            prim: { kind: 'rbox', halfExtents: [0.02, 0.01, 0.004], radius: 0.001 },
            pose: { p: [0.3, 0, 0], q: [0, 0, 0, 1] },
            material: 'm',
          },
        ],
        regions: [],
      },
      identity,
      'top',
    );
    expect(marks[0]).toEqual({ kind: 'line', part: 'wire', a: [0, -0], b: [100, -0], width: 4 });
    expect(marks[1]).toEqual({ kind: 'circle', part: 'ball', c: [0, -50], r: 3 });
    const slab = must(marks[2]);
    expect(slab.kind).toBe('polygon');
    const [u0, v0, u1, v1] = marksBounds([{ id: 'x', marks: [slab], style: { stroke: '#000' } }]);
    // 42 x 22 mm overall, centred on x = 300 mm.
    expectNear(u1 - u0, 42, 1e-9);
    expectNear(v1 - v0, 22, 1e-9);
    expectNear((u0 + u1) / 2, 300, 1e-9);
  });
});

describe('the standard drawings of the Bosch', () => {
  it('are the views the brief asks for', () => {
    expect(drawings.map((d) => d.name)).toEqual([
      'lower-basket-top',
      'upper-basket-top',
      // The lower basket again with the loose cutlery basket at its other named positions.
      'lower-basket-top-cutlery-front-right',
      'lower-basket-top-cutlery-front-left',
      'front-elevation',
      'side-elevation',
      'front-elevation-upper-position-2',
      'front-elevation-upper-position-3',
      'lower-arm-top',
      'upper-arm-top',
    ]);
  });

  it('show every wire and tine of each basket: one mark per capsule, one dot per tine', () => {
    for (const [name, rack, tines] of [
      ['lower-basket-top', 'lower_rack', 72],
      ['upper-basket-top', 'upper_rack', 41],
    ] as const) {
      const d = drawing(name);
      const wireLayers = d.layers.filter((l) =>
        ['walls', 'floor', 'rails-fixed', 'rails-hinged', 'tines-fixed', 'tines-hinged'].includes(
          l.id,
        ),
      );
      const marks = wireLayers.reduce((n, l) => n + l.marks.length, 0);
      expect(marks).toBe(getMachinePart(geometry, rack).shape.parts.length);
      expect(must(d.layers.find((l) => l.id === 'tine-bases')).marks).toHaveLength(tines);
      // The drawing is to scale: the rim spans the basket's outer size.
      const walls = must(d.layers.find((l) => l.id === 'walls'));
      const [u0, v0, u1, v1] = marksBounds([walls]);
      const size = must(B.baskets.find((b) => b.frame === rack)).outline.size;
      expectNear(u1 - u0, size[0] * 1000, 0.5, 'width');
      expectNear(v1 - v0, size[1] * 1000, 0.5, 'depth');
      // And in the rack frame: its front-left corner at the origin.
      expectNear(u0, 0, 0.3);
      expectNear(-v1, 0, 0.3);
    }
    // Labels name every row with its tine count.
    expect(drawing('lower-basket-top').labels?.map((l) => l.text)).toEqual([
      'R1: 23 tines, hinged',
      'R2: 23 tines, hinged',
      'ML: 7 tines',
      'MR: 7 tines',
      'FL: 6 tines',
      'FR: 6 tines',
    ]);
  });

  it('number every nozzle of each arm at its radius', () => {
    for (const [name, levelId, count] of [
      ['lower-arm-top', 'lower', 11],
      ['upper-arm-top', 'upper', 8],
    ] as const) {
      const d = drawing(name);
      const level = must(B.sprayLevels.find((l) => l.id === levelId));
      const openings = must(d.layers.find((l) => l.id === 'openings'));
      expect(openings.marks).toHaveLength(count);
      for (const nozzle of level.nozzles) {
        const label = must(d.labels?.find((l) => l.text.startsWith(`${nozzle.label} `)));
        const expected = (nozzle.blade === '-' ? -1 : 1) * nozzle.radius * 1000;
        expectNear(must(label.leaderTo)[0], expected, 1e-9, nozzle.label);
        expectNear(must(label.leaderTo)[1], 0, 1e-9, nozzle.label);
      }
    }
    // The lower arm turns clockwise seen from above, so the driving jet of L7 on the "+" blade
    // (which is moving towards -y at angle 0) trails towards +y: up the page.
    const jets = must(drawing('lower-arm-top').layers.find((l) => l.id === 'jets')).marks;
    const l7 = must(jets.find((m) => m.kind === 'line' && m.part === 'l7'));
    if (l7.kind === 'line') {
      expectNear(l7.a[0], 183, 1e-9);
      expect(l7.b[1]).toBeLessThan(l7.a[1] - 15);
      expectNear(l7.b[0], l7.a[0], 1e-9);
    }
    // The upper arm turns the other way: U6 on its "+" blade trails towards -y.
    const u6 = must(
      must(drawing('upper-arm-top').layers.find((l) => l.id === 'jets')).marks.find(
        (m) => m.kind === 'line' && m.part === 'u6',
      ),
    );
    if (u6.kind === 'line') expect(u6.b[1]).toBeGreaterThan(u6.a[1] + 15);
  });

  it('caption the heights of the stack on the elevations', () => {
    const levels = must(drawing('front-elevation').levels);
    const at = (text: string): number => must(levels.find((l) => l.text.includes(text))).value;
    // Owner update 4.3, level 1.
    expectNear(must(levels.find((l) => l.text.endsWith(' roof'))).value, 640, 1e-6);
    expectNear(at('lowest point of the hub'), 365, 1e-6);
    expectNear(at('upper arm, blade underside'), 386, 1e-6);
    expectNear(at('upper basket, top of the base grid'), 420, 1e-6);
    expectNear(at('lower basket, top of the base grid'), 73, 1e-6);
    expectNear(at('lower arm, nozzle exits'), 52, 1e-6);
    expectNear(at('roof sprayer, lower face'), 610, 1e-6);
    const low = must(drawing('front-elevation-upper-position-3').levels);
    expectNear(
      must(low.find((l) => l.text.includes('upper basket, top of the base grid'))).value,
      370,
      1e-6,
    );
    // Seen from the door the liner and the dispenser are left out; from the side they are in.
    expect(drawing('front-elevation').layers.some((l) => l.id === 'door')).toBe(false);
    expect(drawing('side-elevation').layers.some((l) => l.id === 'door')).toBe(true);
  });

  it('render as SVG in millimetres with one element per mark', () => {
    const d = drawing('lower-basket-top');
    const svg = renderSvg(d);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    const marks = d.layers.reduce((n, l) => n + l.marks.length, 0);
    expect(svg.match(/data-part="/g)).toHaveLength(marks);
    // 2 pixels per millimetre: the nominal width is twice the width of the view box.
    const box = must(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg));
    const width = must(/ width="([\d.]+)"/.exec(svg));
    expectNear(Number(width[1]), 2 * Number(box[3]), 0.02);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

describe('OBJ export', () => {
  const obj = machineObj(geometry, { chordError: COLLISION_CHORD_ERROR });
  const lines = obj.text.split('\n');

  it('writes one object per part with valid faces', () => {
    expect(obj.objects.map((o) => o.id)).toEqual(geometry.parts.map((p) => p.id));
    expect(lines.filter((l) => l.startsWith('o '))).toHaveLength(geometry.parts.length);
    expect(lines.filter((l) => l.startsWith('v '))).toHaveLength(obj.vertices);
    const faces = lines.filter((l) => l.startsWith('f '));
    expect(faces).toHaveLength(obj.triangles);
    let highest = 0;
    let lowest = Infinity;
    for (const face of faces) {
      for (const index of face.slice(2).split(' ').map(Number)) {
        highest = Math.max(highest, index);
        lowest = Math.min(lowest, index);
      }
    }
    expect(lowest).toBe(1);
    expect(highest).toBe(obj.vertices);
  });

  it('places each object where its part is in the tub frame', () => {
    // Collect the vertices of each object and compare their extent with the kernel's bounding box.
    const extents = new Map<
      string,
      { min: [number, number, number]; max: [number, number, number] }
    >();
    let current = '';
    for (const line of lines) {
      if (line.startsWith('o ')) {
        current = line.slice(2);
        extents.set(current, {
          min: [Infinity, Infinity, Infinity],
          max: [-Infinity, -Infinity, -Infinity],
        });
      } else if (line.startsWith('v ')) {
        const e = must(extents.get(current));
        line
          .slice(2)
          .split(' ')
          .map(Number)
          .forEach((v, k) => {
            e.min[k] = Math.min(must(e.min[k]), v);
            e.max[k] = Math.max(must(e.max[k]), v);
          });
      }
    }
    for (const part of geometry.parts) {
      const box = boundingBox(part.shape, part.pose);
      const e = must(extents.get(part.id));
      for (const k of [0, 1, 2] as const) {
        // A facetted mesh is inside the true surface by at most the chord error.
        expect(must(e.min[k]), `${part.id} min ${k}`).toBeGreaterThanOrEqual(box.min[k] - 2e-6);
        expect(must(e.min[k]), `${part.id} min ${k}`).toBeLessThanOrEqual(
          box.min[k] + COLLISION_CHORD_ERROR + 2e-6,
        );
        expect(must(e.max[k]), `${part.id} max ${k}`).toBeLessThanOrEqual(box.max[k] + 2e-6);
        expect(must(e.max[k]), `${part.id} max ${k}`).toBeGreaterThanOrEqual(
          box.max[k] - COLLISION_CHORD_ERROR - 2e-6,
        );
      }
    }
  });

  it('can show the baskets pulled out and leave parts out', () => {
    const open = machineObj(geometry, {
      chordError: COLLISION_CHORD_ERROR,
      basketTravel: { lower: 0.5, upper: 0.44 },
      include: (part) => part.component !== 'door' && part.component !== 'dispenser',
    });
    expect(open.objects.map((o) => o.id)).not.toContain('door');
    expect(open.objects).toHaveLength(geometry.parts.length - 2);
    // The first vertex of the lower rack has moved 500 mm towards the front.
    const first = (text: string): number[] => {
      const all = text.split('\n');
      const at = all.indexOf('o lower_rack');
      return must(all[at + 1])
        .slice(2)
        .split(' ')
        .map(Number);
    };
    const closed = first(obj.text);
    const pulled = first(open.text);
    expectNear(must(pulled[1]) - must(closed[1]), -0.5, 1e-6);
    expectNear(must(pulled[0]), must(closed[0]), 1e-6);
    expectNear(must(pulled[2]), must(closed[2]), 1e-6);
  });
});
