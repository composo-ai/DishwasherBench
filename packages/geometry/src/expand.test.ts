import {
  POSE_IDENTITY,
  poseTransformPoint,
  quatFromEulerXYZ,
  v3Length,
  v3Sub,
  type Vec3,
} from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { surfaceArea } from './area.ts';
import {
  expandGeometryMm,
  geometryDefFromMm,
  type GeometryDefMm,
  type SorDefMm,
} from './authoring.ts';
import { boundingBox } from './bounds.ts';
import { buildCollisionPieces } from './collision.ts';
import { expandGeometry } from './expand.ts';
import { computeMassProperties, shapeVolume } from './mass.ts';
import { meshTopology } from './mesh-metrics.ts';
import { buildRenderMesh } from './mesh.ts';
import { partSelectorMatches, regionIdMatches } from './regions.ts';
import { primitiveSignedDistance, signedDistance } from './sdf.ts';
import { buildSection, prepareProfile, sectionMoment } from './sor-section.ts';
import { DOSSIER_PROFILES_MM, testRandom } from './test-util.ts';
import type { GeometryDef, Part, Shape } from './types.ts';

const MUG: SorDefMm = {
  class: 'sor',
  material: 'porcelain_glazed',
  profileMm: DOSSIER_PROFILES_MM.mug,
  addons: [{ type: 'handle_loop', attachZMm: [25, 80], reachMm: 30, sectionMm: [12, 8] }],
};

function partIds(shape: Shape): string[] {
  return shape.parts.map((p) => p.id);
}

function regionIds(shape: Shape): string[] {
  return shape.regions.map((r) => r.id);
}

function part(shape: Shape, id: string): Part {
  const found = shape.parts.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no part '${id}'`);
  return found;
}

describe('expandGeometry: shells of revolution', () => {
  it('a plate gets rim, well, underside and foot regions that cover its surface', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'porcelain_glazed',
      profileMm: DOSSIER_PROFILES_MM.plateIec,
      footRing: { rMm: 80, widthMm: 5, heightMm: 4, material: 'porcelain_unglazed' },
    });
    expect(partIds(shape)).toEqual(['body', 'foot']);
    expect(regionIds(shape)).toEqual(['rim', 'well', 'underside', 'foot']);
    expect(part(shape, 'body').material).toBe('porcelain_glazed');
    expect(part(shape, 'foot').material).toBe('porcelain_unglazed');
    const total = surfaceArea(shape);
    const sum = ['rim', 'well', 'underside', 'foot'].reduce(
      (s, id) => s + surfaceArea(shape, id),
      0,
    );
    expect(sum / total).toBeCloseTo(1, 12);
    // The rim region is the food side of the lip: the last profile segment, from r = 98 mm out.
    // Its area is that of a cone frustum of slant length 35.3 mm, plus half of the rim's rounding.
    const slant = Math.hypot(32, 15) / 1000;
    const cone = Math.PI * 2 * 0.114 * slant;
    expect(Math.abs(surfaceArea(shape, 'rim') / cone - 1)).toBeLessThanOrEqual(0.12);
    // The well reaches the axis: a point on the food side at the centre is on it.
    expect(signedDistance(shape, [0, 0, 0.0051])).toBeCloseTo(0, 12);
  });

  it('a deep body gets a 10 mm rim band, interior and exterior', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'glass',
      profileMm: DOSSIER_PROFILES_MM.tumbler,
    });
    expect(regionIds(shape)).toEqual(['rim', 'interior', 'exterior']);
    const rim = shape.regions[0];
    const prim = part(shape, 'body').prim;
    if (prim.kind !== 'sor') throw new Error('the body is not a sor');
    const length = prepareProfile(prim.profile).totalLength;
    expect((1 - (rim?.sRange?.[0] ?? 0)) * length).toBeCloseTo(0.01, 12);
    expect(rim?.side).toBeUndefined();
    const sum = ['rim', 'interior', 'exterior'].reduce((s, id) => s + surfaceArea(shape, id), 0);
    expect(sum / surfaceArea(shape)).toBeCloseTo(1, 12);
    expect(surfaceArea(shape, 'interior')).toBeLessThan(surfaceArea(shape, 'exterior'));
  });

  it('explicit regions replace the defaults', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'glass',
      profileMm: DOSSIER_PROFILES_MM.tumbler,
      regions: [{ id: 'everything', part: 'body' }],
    });
    expect(regionIds(shape)).toEqual(['everything']);
    expect(surfaceArea(shape, 'everything')).toBeCloseTo(surfaceArea(shape), 15);
  });

  it('a foot ring stands on z = 0 with the given radius, width and height (both proportions)', () => {
    for (const [width, height] of [
      [6, 4],
      [3, 8],
      [4, 4],
    ] as const) {
      const shape = expandGeometryMm({
        class: 'sor',
        material: 'm',
        // A base 4 mm thick whose mid-surface is 1 mm below the top of the ring: the ring ends
        // inside it.
        profileMm: [
          [0, height - 1, 4],
          [60, height - 1, 4],
        ],
        footRing: { rMm: 40, widthMm: width, heightMm: height },
      });
      const foot: Shape = { parts: [part(shape, 'foot')], regions: [] };
      const box = boundingBox(foot);
      expect(box.min[2]).toBeCloseTo(0, 12);
      expect(box.max[2]).toBeCloseTo(height / 1000, 12);
      // A ring as wide as it is tall is a torus, built with a 1 um flat: sizes are within 1 um.
      expect(Math.abs(box.max[0] - (40 + width / 2) / 1000)).toBeLessThanOrEqual(1e-6);
      // Inner radius: a point 0.5 mm towards the axis from the ring's inner edge is 0.5 mm away.
      expect(
        Math.abs(
          signedDistance(foot, [(40 - width / 2) / 1000 - 0.0005, 0, height / 2000]) - 0.0005,
        ),
      ).toBeLessThanOrEqual(1e-6);
    }
  });

  it('a foot ring sunk into the base joins it without a crevice; its buried part counts twice in the mass', () => {
    // IEC-type plate: the underside of the base is 3 - 2.1 = 0.9 mm above z = 0. The ring of
    // the dossier (r 80, 5 x 4 mm) stands on z = 0 and reaches 3.1 mm into the base.
    const def: SorDefMm = { class: 'sor', material: 'm', profileMm: DOSSIER_PROFILES_MM.plateIec };
    const bare = expandGeometryMm(def);
    const shape = expandGeometryMm({ ...def, footRing: { rMm: 80, widthMm: 5, heightMm: 4 } });
    expect(boundingBox(shape).min[2]).toBeCloseTo(0, 12);
    // Solid from the table up into the base under the ring, open beside it.
    for (let z = 0.00005; z < 0.005; z += 0.0001) {
      expect(signedDistance(shape, [0.08, 0, z])).toBeLessThan(0);
    }
    expect(signedDistance(shape, [0.07, 0, 0.0004])).toBeGreaterThan(0.0003);
    // Where the ring enters the base (z = 0.9 mm) it is at 2.17 mm from its centre line and its
    // side leans outward: no crevice. Just outside that point, under the base, is open space.
    const halfWidth = 0.0005 + Math.sqrt(0.002 ** 2 - 0.0011 ** 2);
    expect(Math.abs(signedDistance(shape, [0.08 + halfWidth, 0, 0.0009]))).toBeLessThanOrEqual(
      1e-9,
    );
    expect(signedDistance(shape, [0.08 + halfWidth + 0.0003, 0, 0.0007])).toBeGreaterThan(0.0001);
    // The volume is the plate plus the whole ring (a 5 x 4 mm stadium revolved at r = 80 mm),
    // as the estimator of the items dossier adds it (2.3: "add-ons ... are added").
    const ringVolume = ((1 * 4 + Math.PI * 2 * 2) * 2 * Math.PI * 80) / 1e9;
    expect(shapeVolume(shape)).toBeCloseTo(shapeVolume(bare) + ringVolume, 12);
  });

  it('a loop handle leaves an opening a rack tine passes through', () => {
    const shape = expandGeometryMm(MUG);
    // Lower arm, quarter bend, spine, quarter bend, upper arm.
    expect(partIds(shape)).toEqual([
      'body',
      'handle.0',
      'handle.1',
      'handle.2',
      'handle.3',
      'handle.4',
    ]);
    expect(shape.parts.slice(1).map((p) => p.prim.kind)).toEqual([
      'rbox',
      'sor',
      'rbox',
      'sor',
      'rbox',
    ]);
    expect(regionIds(shape)).toContain('handle');
    // Mug wall: mid-surface r from 38 mm at z = 6 to 40 mm at z = 100, t = 4.2 mm, so it leans
    // 1.2 degrees and its outer face is 2.1 / cos(lean) = 2.1005 mm outside the mid-surface at
    // any height: 41.675 mm at the upper attachment (z = 80), 41.090 mm at mid height. The
    // handle's outer face is 30 mm beyond the former and its spine 8 mm thick, so at mid height
    // the opening runs from 41.09 to 63.67 mm (22.6 mm), and it is 80 - 25 - 8 = 47 mm high.
    const lean = Math.hypot(2, 94) / 94;
    const wallOuter = (z: number): number => (38 + ((z - 6) / 94) * 2 + 2.1 * lean) / 1000;
    const spineInner = wallOuter(80) + 0.03 - 0.008;
    const centre = 0.5 * (wallOuter(52.5) + spineInner);
    const half = 0.5 * (spineInner - wallOuter(52.5));
    expect(half).toBeCloseTo(0.0112926, 6);
    // In the middle of the opening the nearest surfaces are the spine, `half` away, and the
    // leaning wall, nearer by the cosine of its lean.
    expect(signedDistance(shape, [centre, 0, 0.0525])).toBeCloseTo(half / lean, 6);
    // A tine of 5 mm diameter along y through the opening clears everything by more than 7 mm.
    let nearest = Number.POSITIVE_INFINITY;
    for (let y = -0.03; y <= 0.03; y += 0.0005) {
      nearest = Math.min(nearest, signedDistance(shape, [centre, y, 0.0525]));
    }
    expect(nearest - 0.0025).toBeGreaterThan(0.007);
    // The opening is closed on the far side (the spine is solid) and above and below (the arms).
    expect(signedDistance(shape, [spineInner + 0.004, 0, 0.0525])).toBeCloseTo(-0.004, 6);
    expect(signedDistance(shape, [0.043, 0, 0.025])).toBeLessThan(-0.003);
    expect(signedDistance(shape, [0.043, 0, 0.08])).toBeLessThan(-0.003);
    // Just inside the arms the opening is clear: 47 mm of height between them.
    expect(signedDistance(shape, [0.043, 0, 0.025 + 0.004 + 0.001])).toBeCloseTo(0.001, 6);
    expect(signedDistance(shape, [0.043, 0, 0.08 - 0.004 - 0.001])).toBeCloseTo(0.001, 6);
  });

  it('the handle is welded to the wall and does not show inside the mug', () => {
    const shape = expandGeometryMm(MUG);
    const body: Shape = { parts: [part(shape, 'body')], regions: [] };
    // The handle is an 8 mm thick strap all the way: along the centreline of every straight
    // piece (the local x axis of a rounded box) the solid is 4 mm deep, ends included, and so it
    // is in the middle of each bend (the arc of radius c in the bend's own xy plane). Towards
    // the ends of a bend the reported depth is the conservative one of a partial shell and of
    // the overlapping straight piece: never less than 2 mm.
    const pieces = shape.parts.filter((p) => p.id.startsWith('handle'));
    expect(pieces).toHaveLength(5);
    for (const piece of pieces) {
      if (piece.prim.kind === 'rbox') {
        const halfLength = piece.prim.halfExtents[0];
        for (let i = 0; i <= 10; i++) {
          const p = poseTransformPoint(piece.pose, [-halfLength + (2 * halfLength * i) / 10, 0, 0]);
          expect(signedDistance(shape, p)).toBeLessThanOrEqual(-0.004 + 1e-9);
        }
      } else if (piece.prim.kind === 'sor') {
        const c = piece.prim.profile[0]?.r ?? 0;
        const [from, to] = piece.prim.arc ?? [0, 0];
        expect(to - from).toBeCloseTo(Math.PI / 2, 12);
        for (let i = 0; i <= 20; i++) {
          const angle = from + ((to - from) * i) / 20;
          const p = poseTransformPoint(piece.pose, [c * Math.cos(angle), c * Math.sin(angle), 0]);
          expect(signedDistance(shape, p)).toBeLessThanOrEqual(-0.002 + 1e-9);
          if (i === 10) expect(signedDistance(shape, p)).toBeCloseTo(-0.004, 9);
          // The strap is 8 mm thick here too: 4.2 mm off the centreline, towards the bend's
          // axis and away from it, is 0.2 mm outside.
          for (const offset of [-0.0042, 0.0042]) {
            const q = poseTransformPoint(piece.pose, [
              (c + offset) * Math.cos(angle),
              (c + offset) * Math.sin(angle),
              0,
            ]);
            if (i > 2 && i < 18) expect(signedDistance(shape, q)).toBeCloseTo(0.0002, 9);
          }
        }
      }
    }
    // The two ends of the chain are sunk into the wall: on their own they are inside the body.
    const first = pieces[0] as Part;
    const last = pieces[4] as Part;
    if (first.prim.kind !== 'rbox' || last.prim.kind !== 'rbox')
      throw new Error('expected rounded boxes');
    expect(
      signedDistance(body, poseTransformPoint(first.pose, [-first.prim.halfExtents[0], 0, 0])),
    ).toBeLessThan(0);
    expect(
      signedDistance(body, poseTransformPoint(last.pose, [last.prim.halfExtents[0], 0, 0])),
    ).toBeLessThan(0);
    // Anywhere in the cavity the distance is that of the body alone: nothing pokes through.
    const rnd = testRandom(91);
    for (let i = 0; i < 2000; i++) {
      const radius = rnd.range(0, 0.0355);
      const angle = rnd.range(-0.5, 0.5); // towards the handle
      const p: Vec3 = [radius * Math.cos(angle), radius * Math.sin(angle), rnd.range(0.006, 0.1)];
      const whole = signedDistance(shape, p);
      expect(whole).toBeGreaterThan(0);
      // The tips of the handle touch the inner surface from within the wall, so they are never
      // nearer than the wall itself (1e-12 m for the rounding of that tangency).
      expect(Math.abs(whole - signedDistance(body, p))).toBeLessThanOrEqual(1e-12);
    }
  });

  it('rejects a handle that leaves no opening, and attachments outside the body', () => {
    const base = { class: 'sor', material: 'm', profileMm: DOSSIER_PROFILES_MM.mug } as const;
    expect(() =>
      expandGeometryMm({
        ...base,
        addons: [{ type: 'handle_loop', attachZMm: [25, 80], reachMm: 8, sectionMm: [12, 8] }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      expandGeometryMm({
        ...base,
        addons: [{ type: 'handle_loop', attachZMm: [40, 47], reachMm: 30, sectionMm: [12, 8] }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      expandGeometryMm({
        ...base,
        addons: [{ type: 'handle_loop', attachZMm: [25, 180], reachMm: 30, sectionMm: [12, 8] }],
      }),
    ).toThrow(RangeError);
  });

  it('a second handle gets its own id prefix and shares the handle region; azimuth is in degrees', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'steel',
      profileMm: [
        [0, 0.5, 0.8],
        [115, 0.5, 0.8],
        [120, 5, 0.8],
        [120, 190, 0.8],
      ],
      addons: [
        {
          type: 'handle_loop',
          attachZMm: [150, 175],
          reachMm: 30,
          sectionMm: [10, 10],
          azimuthDeg: 90,
        },
        {
          type: 'handle_loop',
          attachZMm: [150, 175],
          reachMm: 30,
          sectionMm: [10, 10],
          azimuthDeg: 270,
        },
      ],
    });
    const ids = partIds(shape);
    expect(ids.filter((id) => id.startsWith('handle.')).length).toBeGreaterThanOrEqual(4);
    expect(ids.filter((id) => id.startsWith('handle2.')).length).toBeGreaterThanOrEqual(4);
    // Round section: capsules.
    expect(part(shape, 'handle.0').prim.kind).toBe('capsule');
    const box = boundingBox(shape);
    // Outer wall 120.4 mm plus the reach, on +y and on -y; nothing extra on x.
    expect(box.max[1]).toBeCloseTo(0.1504, 6);
    expect(box.min[1]).toBeCloseTo(-0.1504, 6);
    expect(box.max[0]).toBeCloseTo(0.1204, 6);
    const handles = shape.parts.filter((p) => p.id.startsWith('handle'));
    const handleArea = surfaceArea({ parts: handles, regions: [] });
    expect(surfaceArea(shape, 'handle')).toBeCloseTo(handleArea, 14);
  });

  it('a bar handle runs its length beyond the wall at the given elevation', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'steel',
      profileMm: [
        [0, 1.3, 2.6],
        [95, 1.3, 2.6],
        [112, 15, 2.6],
        [127, 51, 2.6],
      ],
      addons: [
        { type: 'handle_bar', attachZMm: 40, lengthMm: 200, sectionMm: [25, 10], elevationDeg: 20 },
      ],
    });
    expect(partIds(shape)).toEqual(['body', 'handle.0']);
    const handle: Shape = { parts: [part(shape, 'handle.0')], regions: [] };
    const box = boundingBox(handle);
    // The wall segment from (112, 15) to (127, 51) mm leans: at z = 40 mm its mid-surface is at
    // r = 112 + 15 * 25 / 36 = 122.417 mm and its outer face 1.3 * 39 / 36 = 1.408 mm further
    // out at that height. The centreline of the bar ends 200 mm beyond that face, 20 degrees up,
    // and the bar (25 x 10 mm) is rounded with a 5 mm radius about that end.
    const outer = (112 + (15 * 25) / 36 + (1.3 * 39) / 36) / 1000;
    const tipX = outer + 0.2 * Math.cos((20 * Math.PI) / 180);
    const tipZ = 0.04 + 0.2 * Math.sin((20 * Math.PI) / 180);
    expect(box.max[0]).toBeCloseTo(tipX + 0.005, 9);
    expect(box.max[2]).toBeCloseTo(tipZ + 0.005, 9);
    expect(box.max[1]).toBeCloseTo(0.0125, 12);
    expect(box.min[1]).toBeCloseTo(-0.0125, 12);
  });

  it('stemware stands on its foot and is solid from the foot to the bowl', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'crystal',
      profileMm: DOSSIER_PROFILES_MM.wineBowl,
      addons: [{ type: 'stem_foot', stemRadiusMm: 4, footRadiusMm: 42.5, footThicknessMm: 3.2 }],
    });
    expect(partIds(shape)).toEqual(['body', 'stem', 'foot']);
    expect(regionIds(shape)).toEqual(['rim', 'interior', 'exterior', 'stem', 'foot']);
    const box = boundingBox(shape);
    expect(box.min[2]).toBeCloseTo(0, 12);
    expect(box.max[2]).toBeCloseTo(0.24445, 6);
    // Foot: radius 42.5 mm, 3.2 mm thick.
    expect(signedDistance(shape, [0.0425 + 0.001, 0, 0.0016])).toBeCloseTo(0.001, 9);
    expect(signedDistance(shape, [0.03, 0, 0.0032 + 0.001])).toBeCloseTo(0.001, 9);
    // The dossier's bowl profile starts 4 mm off the axis, at z = 120 mm and 3 mm thick: the
    // bowl is closed there by a floor of its own, and on the axis the glass is solid from the
    // table to the upper face of that floor, 121.5 mm up.
    expect(part(shape, 'body').prim).toMatchObject({ kind: 'sor' });
    const body = part(shape, 'body').prim;
    if (body.kind !== 'sor') throw new Error('not a shell');
    expect(body.profile[0]).toEqual({ r: 0, z: 0.12, t: 0.003 });
    for (let z = 0.0002; z < 0.1215; z += 0.0005)
      expect(signedDistance(shape, [0, 0, z])).toBeLessThan(0);
    // Above the floor, inside the bowl, it is hollow, and the floor is flat: 1 mm above it the
    // distance is 1 mm, on the axis and 2 mm off it. (The stem used to end in a dome that
    // stood 2.5 mm above this.)
    expect(signedDistance(shape, [0, 0, 0.1225])).toBeCloseTo(0.001, 9);
    expect(signedDistance(shape, [0.002, 0, 0.1225])).toBeCloseTo(0.001, 9);
    expect(signedDistance(shape, [0, 0, 0.16])).toBeGreaterThan(0.03);
    // The top of the stem is inside the floor: nothing of the stem is nearer to a point in the
    // bowl than the floor is.
    const stem: Shape = { parts: [part(shape, 'stem')], regions: [] };
    expect(boundingBox(stem).max[2]).toBeCloseTo(0.12, 12);
    expect(signedDistance(stem, [0, 0, 0.1225])).toBeCloseTo(0.0025, 9);
  });

  it('refuses add-ons that would not be attached, or would show through', () => {
    const base = { class: 'sor', material: 'm' } as const;
    const flat = [
      [0, 6, 4],
      [60, 6, 4],
    ] as const;
    // The underside of this base is 4 mm up and its upper face 8 mm: a foot ring must end
    // between the two.
    const ring =
      (heightMm: number): (() => Shape) =>
      () =>
        expandGeometryMm({ ...base, profileMm: flat, footRing: { rMm: 40, widthMm: 3, heightMm } });
    expect(ring(3.9)).toThrow(/does not reach the underside/);
    expect(ring(8.1)).toThrow(/comes through the body/);
    expect(ring(4)).not.toThrow();
    expect(ring(8)).not.toThrow();
    // Under a wall that slopes at 45 degrees the faces are sqrt(2) half-thicknesses from the
    // mid-surface, measured vertically: 10 - 2.83 = 7.17 mm to 12.83 mm at r = 40 mm.
    const sloped =
      (heightMm: number): (() => Shape) =>
      () =>
        expandGeometryMm({
          ...base,
          profileMm: [
            [0, 5, 4],
            [35, 5, 4],
            [60, 30, 4],
          ],
          footRing: { rMm: 40, widthMm: 2, heightMm },
        });
    expect(sloped(7.1)).toThrow(/does not reach the underside/);
    expect(sloped(7.2)).not.toThrow();
    expect(sloped(12.8)).not.toThrow();
    expect(sloped(12.9)).toThrow(/comes through the body/);
    // A stem needs room: the bowl must start at least a stem diameter above the table.
    expect(() =>
      expandGeometryMm({
        ...base,
        profileMm: [
          [4, 7, 2],
          [30, 40, 2],
        ],
        addons: [{ type: 'stem_foot', stemRadiusMm: 4, footRadiusMm: 30, footThicknessMm: 3 }],
      }),
    ).toThrow(/at least a stem diameter above the foot/);
  });

  it('a knob is a puck when low and a capsule when tall; a spout reaches beyond the rim', () => {
    const lid = { class: 'sor', material: 'glass', profileMm: DOSSIER_PROFILES_MM.lid } as const;
    const low = expandGeometryMm({
      ...lid,
      addons: [{ type: 'knob', zMm: 23, radiusMm: 15, heightMm: 12 }],
    });
    expect(part(low, 'knob').prim.kind).toBe('sor');
    const lowBox = boundingBox({ parts: [part(low, 'knob')], regions: [] });
    for (let k = 0; k < 3; k++) {
      expect(lowBox.max[k] as number).toBeCloseTo([0.015, 0.015, 0.035][k] as number, 12);
      expect(lowBox.min[k] as number).toBeCloseTo([-0.015, -0.015, 0.023][k] as number, 12);
    }
    const tall = expandGeometryMm({
      ...lid,
      addons: [{ type: 'knob', zMm: 23, radiusMm: 8, heightMm: 30 }],
    });
    expect(part(tall, 'knob').prim.kind).toBe('capsule');
    expect(boundingBox({ parts: [part(tall, 'knob')], regions: [] }).max[2]).toBeCloseTo(0.053, 12);
    const jug = expandGeometryMm({
      class: 'sor',
      material: 'glass',
      profileMm: [
        [0, 3, 6],
        [48, 3, 6],
        [52, 10, 3.5],
        [55, 150, 3.5],
        [50, 190, 3.5],
      ],
      addons: [{ type: 'spout', azimuthDeg: 180, widthMm: 30, reachMm: 12 }],
    });
    expect(regionIds(jug)).toContain('spout');
    // The tip is 12 mm beyond the rim circle (r = 50 mm) on the -x side, rounded by t / 2.
    expect(boundingBox(jug).min[0]).toBeCloseTo(-(0.05 + 0.012 + 0.00175), 9);
    expect(() =>
      expandGeometryMm({
        ...lid,
        footRing: { rMm: 50, widthMm: 4, heightMm: 3 },
        addons: [{ type: 'stem_foot', stemRadiusMm: 4, footRadiusMm: 30, footThicknessMm: 3 }],
      }),
    ).toThrow(RangeError);
  });

  it('a base disc is a puck under the body, with its own material and region', () => {
    // A stockpot on an encapsulated base: a disc of 110 mm radius and 4.8 mm thickness under a
    // 0.6 mm wall whose base underside sits on top of the disc (mid-surface at 4.8 + 0.3 mm).
    const pot = {
      class: 'sor',
      material: 'steel',
      profileMm: [
        [0, 5.1, 0.6],
        [118, 5.1, 0.6],
        [130, 12, 0.6],
        [130, 190, 0.6],
      ],
    } as const;
    const shape = expandGeometryMm({
      ...pot,
      addons: [{ type: 'base_disc', radiusMm: 110, thicknessMm: 4.8, material: 'base_metal' }],
    });
    expect(partIds(shape)).toEqual(['body', 'base']);
    expect(regionIds(shape)).toEqual(['rim', 'interior', 'exterior', 'base']);
    expect(part(shape, 'base').material).toBe('base_metal');
    const disc: Shape = { parts: [part(shape, 'base')], regions: [] };
    const box = boundingBox(disc);
    for (let k = 0; k < 3; k++) {
      expect(box.max[k] as number).toBeCloseTo([0.11, 0.11, 0.0048][k] as number, 12);
      expect(box.min[k] as number).toBeCloseTo([-0.11, -0.11, 0][k] as number, 12);
    }
    // A flat cylinder of radius R - h / 2 and height h, plus the rounded edge: half a torus of
    // tube radius h / 2 whose centroid lies 4 (h / 2) / (3 pi) outside the ring of radius R - h / 2
    // (Pappus).
    const [radius, h] = [0.11, 0.0048];
    const inner = radius - h / 2;
    const tube = h / 2;
    const edge = Math.PI * tube * tube * 0.5 * 2 * Math.PI * (inner + (4 * tube) / (3 * Math.PI));
    expect(shapeVolume(disc) / (Math.PI * inner * inner * h + edge)).toBeCloseTo(1, 12);
    // The pot stands on the disc, and the disc meets the base without a gap or an overlap.
    expect(boundingBox(shape).min[2]).toBeCloseTo(0, 12);
    expect(signedDistance(disc, [0.05, 0, 0.0048])).toBeCloseTo(0, 12);
    expect(
      signedDistance({ parts: [part(shape, 'body')], regions: [] }, [0.05, 0, 0.0048]),
    ).toBeCloseTo(0, 12);
    // The disc alone is weighed with its own density: mass = sum of the two parts.
    const density = (id: string): number => (id === 'steel' ? 7900 : 3300);
    const body = computeMassProperties(expandGeometryMm(pot), density).mass;
    expect(computeMassProperties(shape, density).mass).toBeCloseTo(
      body + 3300 * shapeVolume(disc),
      12,
    );
    // An oval body stretches its disc, as it stretches a foot ring.
    const oval = expandGeometryMm({
      ...pot,
      scaleXY: [1.2, 1],
      addons: [{ type: 'base_disc', radiusMm: 110, thicknessMm: 4.8 }],
    });
    expect(boundingBox({ parts: [part(oval, 'base')], regions: [] }).max[0]).toBeCloseTo(0.132, 12);
    expect(part(oval, 'base').material).toBe('steel');
    // It cannot be combined with the other things an item stands on, nor be given twice.
    const disc2 = { type: 'base_disc', radiusMm: 110, thicknessMm: 4.8 } as const;
    expect(() =>
      expandGeometryMm({
        ...pot,
        footRing: { rMm: 80, widthMm: 5, heightMm: 4 },
        addons: [disc2],
      }),
    ).toThrow(RangeError);
    expect(() =>
      expandGeometryMm({
        ...pot,
        addons: [
          disc2,
          { type: 'stem_foot', stemRadiusMm: 4, footRadiusMm: 30, footThicknessMm: 3 },
        ],
      }),
    ).toThrow(RangeError);
    expect(() => expandGeometryMm({ ...pot, addons: [disc2, disc2] })).toThrow(RangeError);
    expect(() =>
      expandGeometryMm({ ...pot, addons: [{ type: 'base_disc', radiusMm: 2, thicknessMm: 4.8 }] }),
    ).toThrow(RangeError);
  });

  it('an oval item stretches the body and its foot ring', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'porcelain',
      profileMm: [
        [0, 3, 4],
        [100, 3, 4],
        [115, 14, 4],
      ],
      scaleXY: [1.39, 1],
      footRing: { rMm: 70, widthMm: 5, heightMm: 3 },
    });
    const box = boundingBox(shape);
    // 320 mm x 230 mm oval platter (items.md 10.1 item 24).
    expect(box.max[0] - box.min[0]).toBeGreaterThan(0.315);
    expect(box.max[0] - box.min[0]).toBeLessThan(0.33);
    expect(box.max[1] - box.min[1]).toBeGreaterThan(0.228);
    expect(box.max[1] - box.min[1]).toBeLessThan(0.238);
    const foot = boundingBox({ parts: [part(shape, 'foot')], regions: [] });
    expect(foot.max[0] / foot.max[1]).toBeCloseTo(1.39, 12);
  });
});

describe('expandGeometry: box shells', () => {
  const CONTAINER: GeometryDefMm = {
    class: 'box_shell',
    material: 'pp',
    lengthMm: 170,
    widthMm: 120,
    heightMm: 60,
    wallMm: 1.6,
    cornerRadiusMm: 22,
  };

  it('has a floor, four walls and four corner pieces, and fills its outer dimensions', () => {
    const shape = expandGeometryMm(CONTAINER);
    expect(partIds(shape)).toEqual([
      'floor.0',
      'floor.1',
      'floor.2',
      'wall.0',
      'wall.1',
      'wall.2',
      'wall.3',
      'corner.0',
      'corner.1',
      'corner.2',
      'corner.3',
    ]);
    expect([...new Set(regionIds(shape))]).toEqual(['interior', 'exterior']);
    const box = boundingBox(shape);
    expect(box.min[0]).toBeCloseTo(-0.085, 12);
    expect(box.max[0]).toBeCloseTo(0.085, 12);
    expect(box.min[1]).toBeCloseTo(-0.06, 12);
    expect(box.max[1]).toBeCloseTo(0.06, 12);
    expect(box.min[2]).toBeCloseTo(0, 12);
    expect(box.max[2]).toBeCloseTo(0.06, 12);
  });

  it('is a continuous wall of the given thickness all the way round, with no notch at the joints', () => {
    const shape = expandGeometryMm(CONTAINER);
    // Walk the mid-surface of the wall at mid height, and of the floor edge, around the plan:
    // straight runs of half length a = 63 and b = 38 mm joined by quarter circles of 21.2 mm.
    const [a, b, rm, rho] = [0.063, 0.038, 0.0212, 0.0008];
    const path: Vec3[] = [];
    for (let i = 0; i <= 400; i++) {
      const u = i / 400;
      path.push(
        [-a + 2 * a * u, b + rm, 0],
        [a + rm, -b + 2 * b * u, 0],
        [-a + 2 * a * u, -(b + rm), 0],
        [-(a + rm), -b + 2 * b * u, 0],
      );
      const phi = (Math.PI / 2) * u;
      for (const [cx, cy, quadrant] of [
        [a, b, 0],
        [-a, b, 1],
        [-a, -b, 2],
        [a, -b, 3],
      ] as const) {
        const angle = phi + (quadrant * Math.PI) / 2;
        path.push([cx + rm * Math.cos(angle), cy + rm * Math.sin(angle), 0]);
      }
    }
    // Outward direction in plan at a point of the path: away from the nearest point of the
    // rectangle of half sizes a, b that the corner axes span.
    const outward = (p: Vec3): [number, number] => {
      const dx = p[0] - Math.min(a, Math.max(-a, p[0]));
      const dy = p[1] - Math.min(b, Math.max(-b, p[1]));
      const len = Math.hypot(dx, dy);
      return [dx / len, dy / len];
    };
    for (const p of path) {
      const [nx, ny] = outward(p);
      // Mid-wall is solid; 0.2 mm off the outer face and off the inner face the distance is
      // exactly 0.2 mm, at every point of the perimeter: the faces are continuous across joints.
      expect(signedDistance(shape, [p[0], p[1], 0.03])).toBeLessThan(-0.0003);
      expect(
        signedDistance(shape, [p[0] + (rho + 0.0002) * nx, p[1] + (rho + 0.0002) * ny, 0.03]),
      ).toBeCloseTo(0.0002, 9);
      expect(
        signedDistance(shape, [p[0] - (rho + 0.0002) * nx, p[1] - (rho + 0.0002) * ny, 0.03]),
      ).toBeCloseTo(0.0002, 9);
      // The crest of the rim is at z = 60 mm all the way round.
      expect(Math.abs(signedDistance(shape, [p[0], p[1], 0.06]))).toBeLessThanOrEqual(1e-9);
      expect(signedDistance(shape, [p[0], p[1], 0.0603])).toBeCloseTo(0.0003, 9);
    }
    // Floor: solid across the whole plan, with its top face at z = 1.6 mm and its underside on
    // z = 0 everywhere, joints between its pieces included.
    const rnd = testRandom(92);
    for (let i = 0; i < 1000; i++) {
      const [x, y] = [rnd.range(-0.075, 0.075), rnd.range(-0.05, 0.05)];
      expect(signedDistance(shape, [x, y, rho])).toBeLessThan(-0.0003);
      expect(signedDistance(shape, [x, y, 0.0016 + 0.0002])).toBeCloseTo(0.0002, 9);
      expect(signedDistance(shape, [x, y, -0.0002])).toBeCloseTo(0.0002, 9);
    }
  });

  it('holds what its inner dimensions say: cavity points are outside the solid, wall points inside', () => {
    const shape = expandGeometryMm(CONTAINER);
    const rnd = testRandom(93);
    // Inner plan: 166.8 x 116.8 mm with corner radius 20.4 mm; inner height 58.4 mm: 1.12 L.
    const [hx, hy, rc] = [0.0834, 0.0584, 0.0204];
    const capacity = (2 * hx * 2 * hy - (4 - Math.PI) * rc * rc) * 0.0584 * 1000;
    expect(capacity).toBeGreaterThan(1.05);
    expect(capacity).toBeLessThan(1.15);
    const insidePlan = (x: number, y: number, margin: number): boolean => {
      const dx = Math.max(Math.abs(x) - (hx - rc), 0);
      const dy = Math.max(Math.abs(y) - (hy - rc), 0);
      return (
        Math.abs(x) <= hx - margin &&
        Math.abs(y) <= hy - margin &&
        Math.hypot(dx, dy) <= rc - margin
      );
    };
    let cavity = 0;
    for (let i = 0; i < 6000; i++) {
      const p: Vec3 = [rnd.range(-0.09, 0.09), rnd.range(-0.065, 0.065), rnd.range(0.0016, 0.06)];
      const d = signedDistance(shape, p);
      if (insidePlan(p[0], p[1], 1e-6) && p[2] > 0.0016 + 1e-6 && p[2] < 0.0592) {
        expect(d).toBeGreaterThan(0);
        cavity++;
      } else if (
        insidePlan(p[0], p[1], -1e-6) === false &&
        insidePlan(p[0], p[1], -0.0016 + 1e-6) &&
        p[2] < 0.0592
      ) {
        expect(d).toBeLessThan(0); // in the wall
      }
    }
    expect(cavity).toBeGreaterThan(3000);
  });

  it('counts its joints twice in the mass, by less than 3 % of the exact volume', () => {
    const shape = expandGeometryMm(CONTAINER);
    // Exact volume of the tray: the corner cross-section S swept around the inner plan rectangle
    // (half sizes a, b): 4 a b * wall + perimeter * area(S) + 2 pi * (integral of r over S).
    const corner = part(shape, 'corner.0').prim;
    if (corner.kind !== 'sor') throw new Error('corner is not a sor');
    const loops = buildSection(prepareProfile(corner.profile)).loops;
    const [a, b] = [0.063, 0.038];
    const exact =
      4 * a * b * 0.0016 +
      4 * (a + b) * sectionMoment(loops, 0, 0) +
      2 * Math.PI * sectionMoment(loops, 1, 0);
    const summed = shapeVolume(shape);
    expect(summed).toBeGreaterThan(exact);
    expect(summed / exact - 1).toBeLessThanOrEqual(0.03);
    // 80 cm^3 of polypropylene: about 75 g.
    expect(exact * 1e6).toBeGreaterThan(70);
    expect(exact * 1e6).toBeLessThan(95);
  });

  it('a flange projects outward from the top of the wall and is its own region', () => {
    const shape = expandGeometryMm({ ...CONTAINER, flangeMm: 5 } as GeometryDefMm);
    expect(partIds(shape)).toContain('flange.3');
    expect([...new Set(regionIds(shape))]).toEqual(['flange', 'interior', 'exterior']);
    const box = boundingBox(shape);
    expect(box.max[0]).toBeCloseTo(0.09, 12);
    expect(box.max[1]).toBeCloseTo(0.065, 12);
    expect(box.max[2]).toBeCloseTo(0.06, 12);
    // The flange is level with the rim: solid at its mid-plane (z = 59.2 mm), outside below it.
    expect(signedDistance(shape, [0, 0.0625, 0.0592])).toBeCloseTo(-0.0008, 9);
    // Under the flange, 2.5 mm off the outer wall face (y = 60 mm): the wall is the nearest surface.
    expect(signedDistance(shape, [0, 0.0625, 0.055])).toBeCloseTo(0.0025, 9);
    // Just under the flange itself: its underside is at z = 58.4 mm.
    expect(signedDistance(shape, [0, 0.0625, 0.0584 - 0.0005])).toBeCloseTo(0.0005, 9);
    expect(
      signedDistance(shape, [0.0625 + 0.0212 + 0.003, 0.038 + 0.0212 * 0 + 0.0, 0.0592]),
    ).toBeLessThan(0);
    // Its area is about twice its plan area (top and underside): perimeter 0.55 m by 5 mm.
    const area = surfaceArea(shape, 'flange');
    expect(area).toBeGreaterThan(2 * 0.5 * 0.005);
    expect(area).toBeLessThan(2 * 0.62 * 0.0075);
  });

  it('a flat lid with a lip stands on the lip, set in from the edge', () => {
    const shape = expandGeometryMm({
      class: 'box_shell',
      material: 'pp',
      lengthMm: 180,
      widthMm: 130,
      heightMm: 2,
      wallMm: 2,
      cornerRadiusMm: 24,
      lidLip: { heightMm: 8, insetMm: 6 },
    });
    expect(partIds(shape).filter((id) => id.startsWith('wall'))).toEqual([]);
    expect(partIds(shape).filter((id) => id.startsWith('lip'))).toHaveLength(8);
    expect([...new Set(regionIds(shape))]).toEqual(['interior', 'exterior', 'lip']);
    const box = boundingBox(shape);
    expect(box.min[2]).toBeCloseTo(0, 12);
    expect(box.max[2]).toBeCloseTo(0.01, 12);
    expect(box.max[0]).toBeCloseTo(0.09, 12);
    // The lip's outer face is 6 mm inside the lid's edge: at y = 65 - 6 = 59 mm.
    expect(signedDistance(shape, [0, 0.059 + 0.001, 0.004])).toBeCloseTo(0.001, 9);
    expect(signedDistance(shape, [0, 0.059 - 0.001, 0.004])).toBeCloseTo(-0.001, 9);
    // Under the plate, inside the lip, the lid is hollow.
    expect(signedDistance(shape, [0, 0, 0.004])).toBeCloseTo(0.004, 9);
  });

  it('a draft leans the walls outward: same size at the top, smaller at the floor, same thickness', () => {
    const draftDeg = 6;
    const shape = expandGeometryMm({ ...CONTAINER, draftDeg } as GeometryDefMm);
    const box = boundingBox(shape);
    expect(box.max[0]).toBeCloseTo(0.085, 12);
    expect(box.max[1]).toBeCloseTo(0.06, 12);
    expect(box.max[2]).toBeCloseTo(0.06, 12);
    expect(box.min[2]).toBeCloseTo(0, 12);
    // Mid-surface corner radius: 21.2 mm at the top of the wall (z = 59.2 mm), less by
    // tan(6 deg) per unit height below it. Walk the perimeter at three heights and check both
    // faces of the wall, 0.2 mm off each along the leaning wall normal.
    const d = (draftDeg * Math.PI) / 180;
    const [a, b, rho] = [0.063, 0.038, 0.0008];
    for (const z of [0.01, 0.03, 0.05]) {
      const rm = 0.0212 - (0.0592 - z) * Math.tan(d);
      for (let i = 0; i < 200; i++) {
        const u = i / 200;
        const phi = 2 * Math.PI * u;
        const quadrant = Math.floor(u * 4);
        // A point of the mid-surface on a corner cone, and one on the +y wall.
        const corner = [
          [a, b],
          [-a, b],
          [-a, -b],
          [a, -b],
        ][quadrant] as [number, number];
        const out: [number, number] = [Math.cos(phi), Math.sin(phi)];
        const onCorner: Vec3 = [corner[0] + rm * out[0], corner[1] + rm * out[1], z];
        const onWall: Vec3 = [(2 * u - 1) * a, b + rm, z];
        for (const [p, n] of [
          [onCorner, out],
          [onWall, [0, 1]],
        ] as [Vec3, [number, number]][]) {
          const normal: Vec3 = [n[0] * Math.cos(d), n[1] * Math.cos(d), -Math.sin(d)];
          const off = rho + 0.0002;
          expect(signedDistance(shape, p)).toBeLessThan(-0.0003);
          expect(
            signedDistance(shape, [
              p[0] + off * normal[0],
              p[1] + off * normal[1],
              p[2] + off * normal[2],
            ]),
          ).toBeCloseTo(0.0002, 9);
          expect(
            signedDistance(shape, [
              p[0] - off * normal[0],
              p[1] - off * normal[1],
              p[2] - off * normal[2],
            ]),
          ).toBeCloseTo(0.0002, 9);
        }
      }
    }
    // The floor is 2 * 58.4 mm * tan(6 deg) = 12.3 mm shorter than the top: at floor level
    // the outer face is at x = 85 - 6.14 = 78.86 mm, give or take the rounding of the edge.
    expect(signedDistance(shape, [0.0775, 0, 0.0008])).toBeLessThan(0);
    expect(signedDistance(shape, [0.0805, 0, 0.0008])).toBeGreaterThan(0.001);
  });

  it('containers with a draft nest: a second one sits 17 mm above the first without touching', () => {
    // Wall 1.6 mm at 6 degrees: the horizontal clearance gained per unit of lift is tan(6 deg),
    // and the wall is 1.6 / cos(6 deg) thick horizontally, so they clear once lifted by more
    // than 1.6 / sin(6 deg) = 15.3 mm.
    const nested = (draftDeg: number, liftMm: number): number => {
      const shape = expandGeometryMm({ ...CONTAINER, draftDeg } as GeometryDefMm);
      const mesh = buildRenderMesh(shape, { chordError: 0.0002 });
      let deepest = Number.POSITIVE_INFINITY;
      for (let v = 0; v < mesh.positions.length / 3; v++) {
        const p: Vec3 = [
          mesh.positions[3 * v] as number,
          mesh.positions[3 * v + 1] as number,
          (mesh.positions[3 * v + 2] as number) + liftMm / 1000,
        ];
        deepest = Math.min(deepest, signedDistance(shape, p));
      }
      return deepest;
    };
    // Clear by 0.17 mm: (17 - 15.3) mm * sin(6 deg).
    expect(nested(6, 17)).toBeGreaterThan(0.0001);
    expect(nested(6, 17)).toBeLessThan(0.0003);
    // Too little lift, or no draft at all: the walls run into each other.
    expect(nested(6, 12)).toBeLessThan(-0.0003);
    expect(nested(0, 17)).toBeLessThan(-0.0007);
  });

  it('rejects impossible proportions', () => {
    expect(() => expandGeometryMm({ ...CONTAINER, draftDeg: 40 } as GeometryDefMm)).toThrow(
      RangeError,
    );
    // A draft of 25 degrees over 58 mm of wall would need a corner of more than 27 mm.
    expect(() => expandGeometryMm({ ...CONTAINER, draftDeg: 25 } as GeometryDefMm)).toThrow(
      RangeError,
    );
    expect(() => expandGeometryMm({ ...CONTAINER, cornerRadiusMm: 70 } as GeometryDefMm)).toThrow(
      RangeError,
    );
    expect(() => expandGeometryMm({ ...CONTAINER, cornerRadiusMm: 1 } as GeometryDefMm)).toThrow(
      RangeError,
    );
    expect(() => expandGeometryMm({ ...CONTAINER, heightMm: 1 } as GeometryDefMm)).toThrow(
      RangeError,
    );
    expect(() => expandGeometryMm({ ...CONTAINER, wallMm: 0 } as GeometryDefMm)).toThrow(
      RangeError,
    );
  });
});

describe('expandGeometry: slabs, rods, wires and compounds', () => {
  it('a slab is one rounded box on z = 0 with top, underside and edge regions', () => {
    // IKEA LEGITIM board 340 x 240 x 8 mm, polyethylene (items.md 10.1 item 62 [VERIFIED]).
    const shape = expandGeometryMm({
      class: 'slab',
      material: 'pe',
      lengthMm: 340,
      widthMm: 240,
      thicknessMm: 8,
      edgeRadiusMm: 2,
    });
    expect(partIds(shape)).toEqual(['body']);
    expect(regionIds(shape)).toEqual(['top', 'underside', 'edge']);
    const box = boundingBox(shape);
    expect(box.min).toEqual([-0.17, -0.12, 0]);
    expect(box.max[0]).toBeCloseTo(0.17, 15);
    expect(box.max[2]).toBeCloseTo(0.008, 15);
    // 560 to 570 g at 950 kg/m^3 [VERIFIED]; the dossier's sharp-edged slab models 620 g.
    const mass = computeMassProperties(shape, () => 950).mass;
    expect(mass).toBeGreaterThan(0.56);
    expect(mass).toBeLessThan(0.621);
    expect(surfaceArea(shape, 'top')).toBeCloseTo(surfaceArea(shape, 'underside'), 14);
    expect(() =>
      expandGeometryMm({
        class: 'slab',
        material: 'pe',
        lengthMm: 340,
        widthMm: 240,
        thicknessMm: 8,
        edgeRadiusMm: 5,
      }),
    ).toThrow(RangeError);
  });

  it('a slab with corners cut is the rounded polygon that is left: volume, extent and regions in closed form', () => {
    // A sheet 60 x 40 x 2 mm with fully rounded edges (r = 1 mm), the corners towards (+,+) and
    // (-,-) cut by 12 mm and the one towards (+,-) by 5 mm; the fourth is square.
    const cuts = [12, 0, 12, 5] as const;
    const shape = expandGeometryMm({
      class: 'slab',
      material: 'm',
      lengthMm: 60,
      widthMm: 40,
      thicknessMm: 2,
      edgeRadiusMm: 1,
      cornerCutsMm: cuts,
    });
    expect(partIds(shape)).toEqual(['body']);
    expect(regionIds(shape)).toEqual(['top', 'underside', 'edge']);
    expect(part(shape, 'body').prim.kind).toBe('hull');
    const box = boundingBox(shape);
    for (let k = 0; k < 3; k++) {
      expect(box.min[k] as number).toBeCloseTo([-0.03, -0.02, 0][k] as number, 12);
      expect(box.max[k] as number).toBeCloseTo([0.03, 0.02, 0.002][k] as number, 12);
    }
    // The solid is the core polygon (the outline moved in by r on every side) swept by a ball
    // of radius r: by Steiner, V = 2 r A + (pi r^2 / 2) P + (4/3) pi r^3 for a flat core of
    // area A and perimeter P. Moving in by r turns a cut of c into c - (2 - sqrt(2)) r.
    const r = 0.001;
    const hx = 0.029;
    const hy = 0.019;
    const core = cuts.map((c) => (c === 0 ? 0 : c / 1000 - (2 - Math.SQRT2) * r));
    const area = 4 * hx * hy - core.reduce((sum, c) => sum + (c * c) / 2, 0);
    const perimeter = 4 * (hx + hy) - core.reduce((sum, c) => sum + (2 - Math.SQRT2) * c, 0);
    const volume = 2 * r * area + ((Math.PI * r * r) / 2) * perimeter + (4 / 3) * Math.PI * r ** 3;
    expect(shapeVolume(shape) / volume).toBeCloseTo(1, 12);
    // On the outline: the middle of the 12 mm cut towards (+,+) is on the line
    // x + y = 30 + 20 - 12 mm; the square corner towards (-,+) is rounded with r.
    expect(signedDistance(shape, [0.019, 0.019, 0.001])).toBeCloseTo(0, 12);
    expect(signedDistance(shape, [0.019 + 0.001, 0.019 + 0.001, 0.001])).toBeCloseTo(
      0.001 * Math.SQRT2,
      12,
    );
    expect(signedDistance(shape, [-0.03, 0.019, 0.001])).toBeCloseTo(0, 12);
    // Top and underside have the same area: the core polygon and half of the edge rounding.
    expect(surfaceArea(shape, 'top')).toBeCloseTo(surfaceArea(shape, 'underside'), 14);
    expect(surfaceArea(shape, 'top') + surfaceArea(shape, 'underside')).toBeCloseTo(
      surfaceArea(shape),
      14,
    );
    // Without cuts it is the rounded box it always was.
    const plain = expandGeometryMm({
      class: 'slab',
      material: 'm',
      lengthMm: 60,
      widthMm: 40,
      thicknessMm: 2,
      edgeRadiusMm: 1,
      cornerCutsMm: [0, 0, 0, 0],
    });
    expect(part(plain, 'body').prim.kind).toBe('rbox');
    // Cuts that leave nothing of an edge, or that the rounding swallows, are refused.
    const cut = (cornerCutsMm: readonly [number, number, number, number]) => (): Shape =>
      expandGeometryMm({
        class: 'slab',
        material: 'm',
        lengthMm: 60,
        widthMm: 40,
        thicknessMm: 2,
        edgeRadiusMm: 1,
        cornerCutsMm,
      });
    expect(cut([30, 30, 0, 0])).toThrow(/leave nothing of an edge/);
    expect(cut([0.5, 0, 0, 0])).toThrow(/must exceed/);
    expect(cut([-1, 0, 0, 0])).toThrow(RangeError);
  });

  it('fork tines are separate prongs with a real gap between them', () => {
    const shape = expandGeometryMm({
      class: 'rod',
      material: 'steel',
      nodes: [
        { pMm: [0, 0, 1.5], widthMm: 14, thicknessMm: 3 },
        { pMm: [136, 0, 1.5], widthMm: 24, thicknessMm: 2.2 },
      ],
      head: { type: 'fork_tines', count: 4, lengthMm: 53, widthMm: 24, thicknessMm: 2.2 },
    });
    // The shank ends as wide as the head, so its end joins the prongs: no cross bar is needed.
    expect(partIds(shape)).toEqual(['handle.0', 'head.0', 'head.1', 'head.2', 'head.3']);
    expect(regionIds(shape)).toEqual(['handle', 'tines']);
    // Four prongs and three gaps across 24 mm: prong 24 / 6.25 = 3.84 mm, gap 2.88 mm,
    // pitch 6.72 mm. Centres at -10.08, -3.36, 3.36 and 10.08 mm.
    for (const y of [-0.01008, -0.00336, 0.00336, 0.01008]) {
      for (const x of [0.14, 0.16, 0.185])
        expect(signedDistance(shape, [x, y, 0.0015])).toBeLessThan(-0.0005);
    }
    for (const y of [-0.00672, 0, 0.00672]) {
      // In the middle of a gap, half way along the prongs: clear by half the local gap. The
      // prongs narrow from 3.84 mm to 2.30 mm, so the gap widens from 2.88 to 4.42 mm.
      const d = signedDistance(shape, [0.136 + 0.0265, y, 0.0015]);
      expect(d).toBeGreaterThan(0.0017);
      expect(d).toBeLessThan(0.0019);
      // A 2 mm rod passes between the prongs all the way down, perpendicular to the fork.
      for (let z = -0.01; z <= 0.01; z += 0.0005)
        expect(signedDistance(shape, [0.136 + 0.03, y, z])).toBeGreaterThan(0.001);
    }
    // At the root the prongs are joined.
    for (let y = -0.0105; y <= 0.0105; y += 0.0005)
      expect(signedDistance(shape, [0.136, y, 0.0015])).toBeLessThan(-0.0005);
    // A shank that ends narrower than the head gets a cross bar, which joins them just the same.
    const narrow = expandGeometryMm({
      class: 'rod',
      material: 'steel',
      nodes: [
        { pMm: [0, 0, 1.5], widthMm: 14, thicknessMm: 3 },
        { pMm: [136, 0, 1.5], widthMm: 8, thicknessMm: 2.2 },
      ],
      head: { type: 'fork_tines', count: 4, lengthMm: 53, widthMm: 24, thicknessMm: 2.2 },
    });
    expect(partIds(narrow)).toEqual([
      'handle.0',
      'head.root',
      'head.0',
      'head.1',
      'head.2',
      'head.3',
    ]);
    for (let y = -0.0105; y <= 0.0105; y += 0.0005)
      expect(signedDistance(narrow, [0.136, y, 0.0015])).toBeLessThan(-0.0005);
    // Without the bar the outer prongs would hang free: beside the 8 mm shank end there is air.
    expect(signedDistance(narrow, [0.134, 0.009, 0.0015])).toBeGreaterThan(0);
    expect(() =>
      expandGeometryMm({
        class: 'rod',
        material: 'steel',
        nodes: [
          { pMm: [0, 0, 1.5], widthMm: 14, thicknessMm: 3 },
          { pMm: [136, 0, 1.5], widthMm: 24, thicknessMm: 2.2 },
        ],
        head: { type: 'fork_tines', count: 1, lengthMm: 53, widthMm: 24, thicknessMm: 2.2 },
      }),
    ).toThrow(RangeError);
  });

  it('a spoon bowl is a concave shell: hollow above, and a second spoon nests 3 mm above the first', () => {
    const def: GeometryDefMm = {
      class: 'rod',
      material: 'steel',
      // A level shank at the height of the bowl's rim, so that the bowl is level too.
      nodes: [
        { pMm: [0, 0, 9.75], widthMm: 14, thicknessMm: 3 },
        { pMm: [128, 0, 9.75], widthMm: 8, thicknessMm: 3 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 62, widthMm: 42, depthMm: 9, thicknessMm: 1.5 },
    };
    const shape = expandGeometryMm(def);
    expect(partIds(shape)).toEqual(['handle.0', 'head']);
    expect(regionIds(shape)).toEqual(['handle', 'bowl', 'bowl_back']);
    const bowl: Shape = { parts: [part(shape, 'head')], regions: [] };
    const box = boundingBox(bowl);
    // The mid-surface rim is 62 mm by 42 mm; the rounding of the rim adds 0.75 mm at either end
    // of the long axis and 42 / 62 of that across. The rim's mid-surface starts at the last node
    // (x = 128 mm) and the lowest point of the bowl, 9 mm below it, rests on z = 0.
    expect(box.max[0] - box.min[0]).toBeCloseTo(0.062 + 0.0015, 9);
    expect(box.max[1] - box.min[1]).toBeCloseTo((0.062 + 0.0015) * (42 / 62), 9);
    expect(box.min[0]).toBeCloseTo(0.128 - 0.00075, 9);
    expect(box.min[2]).toBeCloseTo(0, 9);
    // The hollow: its lowest point is 9 mm below the rim, and above it there is nothing.
    const bowlPart = part(shape, 'head');
    const apex = bowlPart.pose.p;
    const up = poseTransformPoint({ p: [0, 0, 0], q: bowlPart.pose.q }, [0, 0, 1]);
    const above = (h: number): Vec3 => [
      apex[0] + h * up[0],
      apex[1] + h * up[1],
      apex[2] + h * up[2],
    ];
    // At the lowest point of the mid-surface the wall is 0.75 mm deep. The bowl is a stretched
    // shell, whose signed distance is the documented bound: the true depth times 42 / 62.
    expect(signedDistance(shape, apex)).toBeCloseTo((-0.00075 * 42) / 62, 9);
    // Half a thickness above it the hollow begins (the profile is a polyline, so the bottom of
    // the hollow is a very flat cone whose tip is 2 um above this point).
    expect(Math.abs(signedDistance(shape, above(0.00075)))).toBeLessThanOrEqual(5e-6);
    expect(signedDistance(shape, above(0.005))).toBeGreaterThan(0.002);
    // Nesting: an identical bowl lifted 3 mm along its axis (a third of the depth) touches
    // nothing. Checked with the exact surface of the lifted copy: the rim and outer face points
    // of its cross-section, revolved and stretched.
    const prim = bowlPart.prim;
    if (prim.kind !== 'sor') throw new Error('the bowl is not a sor');
    const [sx, sy] = prim.scaleXY ?? [1, 1];
    let nearest = Number.POSITIVE_INFINITY;
    for (const loop of buildSection(prepareProfile(prim.profile)).loops) {
      for (const piece of loop.pieces) {
        for (let i = 0; i <= 8; i++) {
          const l = i / 8;
          const [r, z] =
            piece.kind === 'line'
              ? [piece.r0 + l * (piece.r1 - piece.r0), piece.z0 + l * (piece.z1 - piece.z0)]
              : [
                  piece.cr + piece.rho * Math.cos(piece.th0 + l * (piece.th1 - piece.th0)),
                  piece.cz + piece.rho * Math.sin(piece.th0 + l * (piece.th1 - piece.th0)),
                ];
          for (let j = 0; j < 48; j++) {
            const phi = (2 * Math.PI * j) / 48;
            const local: Vec3 = [sx * r * Math.cos(phi), sy * r * Math.sin(phi), z + 0.003];
            nearest = Math.min(nearest, primitiveSignedDistance(prim, local));
          }
        }
      }
    }
    expect(nearest).toBeGreaterThan(0.0005);
    // A filled (convex) bowl could not do that: its own rim centre would be inside it.
    expect(signedDistance(shape, above(0.009))).toBeGreaterThan(0.005);
  });

  it('a knife blade is a wedge: full thickness at the spine, a quarter of it at the edge', () => {
    const shape = expandGeometryMm({
      class: 'rod',
      material: 'steel',
      nodes: [
        { pMm: [0, 0, 3.5], widthMm: 15, thicknessMm: 7 },
        { pMm: [100, 0, 3.5], widthMm: 13, thicknessMm: 7 },
      ],
      head: { type: 'blade', lengthMm: 120, widthMm: 19, thicknessMm: 2 },
    });
    expect(partIds(shape)).toEqual(['handle.0', 'head.0', 'head.1']);
    expect(regionIds(shape)).toEqual(['handle', 'blade']);
    const blade: Shape = { parts: shape.parts.filter((p) => p.id.startsWith('head')), regions: [] };
    const box = boundingBox(blade);
    expect(box.max[0]).toBeCloseTo(0.22, 9);
    expect(box.max[1]).toBeCloseTo(0.0095, 9);
    expect(box.min[1]).toBeCloseTo(-0.0095, 9);
    expect(box.max[2] - box.min[2]).toBeCloseTo(0.002, 9);
    // Half way along: the faces are 1 mm from the mid-plane at the spine (+y) and 0.25 mm at
    // the edge (-y), with a straight taper between.
    const thicknessAt = (y: number): number => {
      let lo = 0;
      let hi = 0.002;
      for (let i = 0; i < 60; i++) {
        const mid = 0.5 * (lo + hi);
        if (signedDistance(blade, [0.145, y, 0.0035 + mid]) < 0) lo = mid;
        else hi = mid;
      }
      return 2 * lo;
    };
    expect(thicknessAt(0.00925)).toBeCloseTo(0.002, 5);
    expect(thicknessAt(-0.00925)).toBeCloseTo(0.0005, 5);
    expect(thicknessAt(0)).toBeCloseTo(0.00125, 4);
    // The tip sweeps up to the spine: at 5 mm from the end the edge side is gone.
    expect(signedDistance(blade, [0.215, -0.006, 0.0035])).toBeGreaterThan(0.002);
    expect(signedDistance(blade, [0.215, 0.008, 0.0035])).toBeLessThan(0);
  });

  it('chopsticks taper from 7 mm square to 3 mm, with rounded edges', () => {
    // items.md 10.1 item 48: L 230 to 240, 7 square tapering to 3 [RECALLED]; 6 g in wood [ESTIMATED].
    const shape = expandGeometryMm({
      class: 'rod',
      material: 'bamboo',
      nodes: [
        { pMm: [0, 0, 3.5], widthMm: 7, thicknessMm: 7 },
        { pMm: [235, 0, 1.5], widthMm: 3, thicknessMm: 3 },
      ],
      head: { type: 'none' },
    });
    expect(partIds(shape)).toEqual(['handle.0']);
    expect(part(shape, 'handle.0').prim.kind).toBe('hull');
    const mass = computeMassProperties(shape, () => 700).mass;
    expect(mass * 1000).toBeGreaterThan(4);
    expect(mass * 1000).toBeLessThan(8);
    const box = boundingBox(shape);
    expect(box.min[2]).toBeCloseTo(0, 5);
    expect(box.max[2]).toBeCloseTo(0.007, 5);
  });

  it('a wire item is one capsule per straight run, closed loops included', () => {
    const shape = expandGeometryMm({
      class: 'wire',
      material: 'steel',
      wires: [
        {
          pointsMm: [
            [0, 0, 2],
            [100, 0, 2],
            [100, 60, 2],
            [0, 60, 2],
          ],
          radiusMm: 2,
          closed: true,
        },
        {
          pointsMm: [
            [50, 0, 2],
            [50, 60, 2],
          ],
          radiusMm: 1.5,
        },
      ],
    });
    expect(partIds(shape)).toEqual(['wire.0.0', 'wire.0.1', 'wire.0.2', 'wire.0.3', 'wire.1.0']);
    expect(regionIds(shape)).toEqual(['wire']);
    // On the closing run and on the cross wire.
    expect(signedDistance(shape, [0, 0.03, 0.002])).toBeCloseTo(-0.002, 12);
    expect(signedDistance(shape, [0.05, 0.03, 0.002])).toBeCloseTo(-0.0015, 12);
    expect(signedDistance(shape, [0.025, 0.03, 0.002])).toBeCloseTo(0.025 - 0.002, 12);
    expect(boundingBox(shape).min[2]).toBeCloseTo(0, 12);
  });

  it('a compound prefixes ids and moves each child by its pose (degrees, intrinsic X-Y-Z)', () => {
    const cup: GeometryDefMm = {
      class: 'sor',
      material: 'aluminium',
      profileMm: [
        [0, 0.5, 1],
        [25, 0.5, 1],
        [32, 30, 1],
      ],
    };
    const def: GeometryDefMm = {
      class: 'compound',
      children: [
        {
          id: 'tray',
          def: {
            class: 'slab',
            material: 'aluminium',
            lengthMm: 200,
            widthMm: 100,
            thicknessMm: 2,
            edgeRadiusMm: 1,
          },
          positionMm: [0, 0, 30],
        },
        { id: 'cup0', def: cup, positionMm: [-50, 0, 0] },
        { id: 'cup1', def: cup, positionMm: [50, 0, 31], rotXyzDeg: [180, 0, 0] },
      ],
    };
    const shape = expandGeometryMm(def);
    expect(partIds(shape)).toEqual(['tray.body', 'cup0.body', 'cup1.body']);
    expect(regionIds(shape)).toEqual([
      'tray.top',
      'tray.underside',
      'tray.edge',
      'cup0.rim',
      'cup0.interior',
      'cup0.exterior',
      'cup1.rim',
      'cup1.interior',
      'cup1.exterior',
    ]);
    expect(shape.regions.find((r) => r.id === 'cup1.rim')?.part).toBe('cup1.body');
    expect(part(shape, 'cup0.body').pose.p).toEqual([-0.05, 0, 0]);
    const q = quatFromEulerXYZ(Math.PI, 0, 0);
    expect(
      v3Length(
        v3Sub(
          part(shape, 'cup1.body').pose.q.slice(0, 3) as unknown as Vec3,
          q.slice(0, 3) as unknown as Vec3,
        ),
      ),
    ).toBeLessThanOrEqual(1e-15);
    // cup1 is upside down: its base (z = 0 in its own frame) is now at z = 31 mm, opening down.
    const flipped: Shape = { parts: [part(shape, 'cup1.body')], regions: [] };
    const box = boundingBox(flipped);
    expect(box.max[2]).toBeCloseTo(0.031, 12);
    expect(box.min[2]).toBeCloseTo(0.031 - 0.0305, 4);
    // Mass is the sum of the children.
    const alone = (d: GeometryDefMm): number =>
      computeMassProperties(expandGeometryMm(d), () => 2700).mass;
    const first = def.children[0];
    if (first === undefined) throw new Error('no child');
    expect(computeMassProperties(shape, () => 2700).mass).toBeCloseTo(
      alone(first.def) + 2 * alone(cup),
      14,
    );
    expect(() =>
      expandGeometryMm({
        class: 'compound',
        children: [
          { id: 'a', def: cup },
          { id: 'a', def: cup },
        ],
      }),
    ).toThrow(RangeError);
  });

  it('region renames merge the regions of the children of a compound into regions of the item', () => {
    // A tray of three cups: without renames every region carries the id of its child, so no
    // region can span the cups.
    const cup: GeometryDefMm = {
      class: 'sor',
      material: 'aluminium',
      profileMm: [
        [0, 0.5, 1],
        [25, 0.5, 1],
        [32, 30, 1],
      ],
    };
    const children = [
      {
        id: 'plate',
        def: {
          class: 'slab',
          material: 'aluminium',
          lengthMm: 260,
          widthMm: 90,
          thicknessMm: 2,
          edgeRadiusMm: 0.5,
        },
        positionMm: [0, 0, 29],
      },
      { id: 'cup_0', def: cup, positionMm: [-80, 0, 0] },
      { id: 'cup_1', def: cup, positionMm: [0, 0, 0] },
      { id: 'cup_2', def: cup, positionMm: [80, 0, 0] },
    ] as const satisfies readonly { id: string; def: GeometryDefMm; positionMm: Vec3 }[];
    const plain = expandGeometryMm({ class: 'compound', children });
    const merged = expandGeometryMm({
      class: 'compound',
      children,
      regionRenames: [
        { from: 'cup_*.interior', to: 'cavities' },
        { from: 'cup_*.rim', to: 'top' },
        { from: 'plate.top', to: 'top' },
        { from: 'plate.underside', to: 'underside' },
        { from: 'cup_*', to: 'underside' },
      ],
    });
    // Same parts; the regions keep their order (their priority) and their selectors, and only
    // their ids change. The first matching rule wins: 'cup_*' only gets what is left of the cups.
    expect(merged.parts).toEqual(plain.parts);
    expect(merged.regions.map((r) => r.part)).toEqual(plain.regions.map((r) => r.part));
    expect(regionIds(merged)).toEqual([
      'top',
      'underside',
      'plate.edge', // no rule matches it: it keeps its prefixed id
      'top',
      'cavities',
      'underside',
      'top',
      'cavities',
      'underside',
      'top',
      'cavities',
      'underside',
    ]);
    // A merged region is the union of its patches: its area is the sum over the children.
    const sum = (ids: readonly string[]): number =>
      ids.reduce((total, id) => total + surfaceArea(plain, id), 0);
    expect(surfaceArea(merged, 'cavities')).toBeCloseTo(
      sum(['cup_0.interior', 'cup_1.interior', 'cup_2.interior']),
      15,
    );
    expect(surfaceArea(merged, 'cavities')).toBeCloseTo(
      3 * surfaceArea(plain, 'cup_1.interior'),
      15,
    );
    expect(surfaceArea(merged, 'top')).toBeCloseTo(
      sum(['plate.top', 'cup_0.rim', 'cup_1.rim', 'cup_2.rim']),
      15,
    );
    const all = ['cavities', 'top', 'underside', 'plate.edge'].reduce(
      (total, id) => total + surfaceArea(merged, id),
      0,
    );
    expect(all / surfaceArea(merged)).toBeCloseTo(1, 12);
    // The render mesh assigns every triangle of a cup interior to a region called 'cavities'.
    const mesh = buildRenderMesh(merged, { chordError: 0.0005 });
    const named = new Set<string>();
    for (let t = 0; t < mesh.triRegion.length; t++) {
      const region = mesh.triRegion[t] as number;
      if (region >= 0) named.add(mesh.regionIds[region] as string);
    }
    expect([...named].sort()).toEqual(['cavities', 'plate.edge', 'top', 'underside']);
  });

  it('a region rename that renames nothing is a data error; nested compounds rename level by level', () => {
    const rod: GeometryDefMm = {
      class: 'wire',
      material: 'steel',
      wires: [
        {
          pointsMm: [
            [0, 0, 1],
            [50, 0, 1],
          ],
          radiusMm: 1,
        },
      ],
    };
    const pair: GeometryDefMm = {
      class: 'compound',
      children: [
        { id: 'a', def: rod },
        { id: 'b', def: rod, positionMm: [0, 10, 0] },
      ],
      regionRenames: [{ from: '*.wire', to: 'rods' }],
    };
    expect(regionIds(expandGeometryMm(pair))).toEqual(['rods', 'rods']);
    // One level up the ids are 'left.rods' and 'right.rods'.
    const nested = expandGeometryMm({
      class: 'compound',
      children: [
        { id: 'left', def: pair },
        { id: 'right', def: pair, positionMm: [0, 40, 0] },
      ],
      regionRenames: [{ from: 'left.*', to: 'near' }],
    });
    expect(regionIds(nested)).toEqual(['near', 'near', 'right.rods', 'right.rods']);
    const withRule = (from: string, to: string): GeometryDefMm => ({
      class: 'compound',
      children: [{ id: 'a', def: rod }],
      regionRenames: [{ from, to }],
    });
    // A pattern that matches nothing (a typing error), a rule shadowed by an earlier one, and
    // empty patterns or names.
    expect(() => expandGeometryMm(withRule('b.wire', 'rods'))).toThrow(RangeError);
    expect(() =>
      expandGeometryMm({
        class: 'compound',
        children: [{ id: 'a', def: rod }],
        regionRenames: [
          { from: 'a.*', to: 'rods' },
          { from: 'a.wire', to: 'never' },
        ],
      }),
    ).toThrow(RangeError);
    expect(() => expandGeometryMm(withRule('', 'rods'))).toThrow(RangeError);
    expect(() => expandGeometryMm(withRule('a.wire', ''))).toThrow(RangeError);
  });

  it('region id patterns and part selectors match as documented', () => {
    // '*' is any run of characters, an empty one included, anywhere in the pattern.
    const cases: [pattern: string, id: string, expected: boolean][] = [
      ['cup_*.interior', 'cup_3.interior', true],
      ['cup_*.interior', 'cup_.interior', true],
      ['cup_*.interior', 'cup_3.exterior', false],
      ['cup_*.interior', 'xcup_3.interior', false],
      ['lug_*', 'lug_a.top', true],
      ['lug_*', 'lug', false],
      ['*.handle', 'blade.handle', true],
      ['*.handle', 'handle', false],
      ['*', '', true],
      ['*', 'anything.at.all', true],
      ['a*b*c', 'a1b2c', true],
      ['a*b*c', 'abc', true],
      ['a*b*c', 'acb', false],
      ['a*b*c', 'a1b2', false],
      ['a*a', 'a', false], // the two ends may not share a character
      ['a*a', 'aa', true],
      ['exact', 'exact', true],
      ['exact', 'exactly', false],
    ];
    for (const [pattern, id, expected] of cases) {
      expect(regionIdMatches(pattern, id), `${pattern} ~ ${id}`).toBe(expected);
    }
    // A part selector is an exact id or a prefix ending in '*'; no other wildcard.
    expect(partSelectorMatches('body', 'body')).toBe(true);
    expect(partSelectorMatches('body', 'body.1')).toBe(false);
    expect(partSelectorMatches('handle*', 'handle.0')).toBe(true);
    expect(partSelectorMatches('handle*', 'handle2.3')).toBe(true);
    expect(partSelectorMatches('handle.*', 'handle2.3')).toBe(false);
    expect(partSelectorMatches('*', 'anything')).toBe(true);
    expect(partSelectorMatches('h*e', 'handle')).toBe(false);
  });
});

describe('authoring units', () => {
  it('converts millimetres and degrees to the SI definition exactly as written by hand', () => {
    const si: GeometryDef = {
      class: 'sor',
      material: 'porcelain_glazed',
      // Each length is the authored number divided by 1000 (one IEEE division), and the angle
      // the authored number times pi / 180.
      profile: [
        { r: 0, z: 2.5 / 1000, t: 5 / 1000 },
        { r: 36 / 1000, z: 2.5 / 1000, t: 5 / 1000 },
        { r: 38 / 1000, z: 6 / 1000, t: 4.2 / 1000 },
        { r: 40 / 1000, z: 100 / 1000, t: 4.2 / 1000 },
      ],
      footRing: { r: 30 / 1000, width: 4 / 1000, height: 2.5 / 1000 },
      addons: [
        {
          type: 'handle_loop',
          attachZ: [25 / 1000, 80 / 1000],
          reach: 30 / 1000,
          section: [12 / 1000, 8 / 1000],
          azimuth: 90 * (Math.PI / 180),
        },
      ],
    };
    expect((si.profile[3]?.r ?? 0) * 1000).toBeCloseTo(40, 12);
    const converted = geometryDefFromMm({
      class: 'sor',
      material: 'porcelain_glazed',
      profileMm: [
        [0, 2.5, 5],
        [36, 2.5, 5],
        [38, 6, 4.2],
        [40, 100, 4.2],
      ],
      footRing: { rMm: 30, widthMm: 4, heightMm: 2.5 },
      addons: [
        {
          type: 'handle_loop',
          attachZMm: [25, 80],
          reachMm: 30,
          sectionMm: [12, 8],
          azimuthDeg: 90,
        },
      ],
    });
    expect(converted).toEqual(si);
    expect(expandGeometry(converted)).toEqual(expandGeometry(si));
  });

  it('converts every class: one length per field, shapes come out in metres', () => {
    const defs: GeometryDefMm[] = [
      {
        class: 'box_shell',
        material: 'pp',
        lengthMm: 170,
        widthMm: 120,
        heightMm: 60,
        wallMm: 1.6,
        cornerRadiusMm: 22,
        flangeMm: 4,
        lidLip: { heightMm: 5, insetMm: 4 },
      },
      {
        class: 'slab',
        material: 'pe',
        lengthMm: 340,
        widthMm: 240,
        thicknessMm: 8,
        edgeRadiusMm: 2,
      },
      {
        class: 'rod',
        material: 'steel',
        nodes: [
          { pMm: [0, 0, 2], widthMm: 4, thicknessMm: 4 },
          { pMm: [100, 0, 2], widthMm: 4, thicknessMm: 4 },
        ],
        head: { type: 'none' },
      },
      {
        class: 'wire',
        material: 'steel',
        wires: [
          {
            pointsMm: [
              [0, 0, 1],
              [300, 0, 1],
            ],
            radiusMm: 1,
          },
        ],
      },
    ];
    const sizes = [
      [0.178, 0.128, 0.065],
      [0.34, 0.24, 0.008],
      [0.104, 0.004, 0.004],
      [0.302, 0.002, 0.002],
    ];
    defs.forEach((def, i) => {
      const box = boundingBox(expandGeometryMm(def));
      for (let k = 0; k < 3; k++) {
        expect((box.max[k] as number) - (box.min[k] as number)).toBeCloseTo(
          (sizes[i] as number[])[k] as number,
          9,
        );
      }
    });
    const si = geometryDefFromMm(defs[0] as GeometryDefMm);
    expect(si).toEqual({
      class: 'box_shell',
      material: 'pp',
      length: 0.17,
      width: 0.12,
      height: 0.06,
      wall: 0.0016,
      cornerRadius: 0.022,
      flange: 0.004,
      lidLip: { height: 0.005, inset: 0.004 },
    });
  });

  it('expanded shapes validate: a region that selects no part is an error', () => {
    expect(() =>
      expandGeometryMm({
        class: 'sor',
        material: 'm',
        profileMm: DOSSIER_PROFILES_MM.mug,
        regions: [{ id: 'handle', part: 'handle*' }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      expandGeometry({ class: 'sor', material: 'm', profile: [{ r: 0, z: 0, t: 0.001 }] }),
    ).toThrow(RangeError);
    expect(expandGeometryMm(MUG).parts[0]?.pose).toEqual(POSE_IDENTITY);
  });
});

describe('expandGeometry: random definitions', () => {
  /** Expands a definition and checks that every derived product is sound. */
  function check(def: GeometryDefMm, label: string): void {
    const shape = expandGeometryMm(def);
    const mesh = buildRenderMesh(shape, { chordError: 0.0003 });
    shape.parts.forEach((p, i) =>
      expect(meshTopology(mesh, i).closed, `${label} ${p.id}`).toBe(true),
    );
    // No vertex of any part is outside the shape: the parts' surfaces are the shape's surface.
    let worst = Number.NEGATIVE_INFINITY;
    for (let v = 0; v < mesh.positions.length / 3; v++) {
      const p: Vec3 = [
        mesh.positions[3 * v] as number,
        mesh.positions[3 * v + 1] as number,
        mesh.positions[3 * v + 2] as number,
      ];
      worst = Math.max(worst, signedDistance(shape, p));
    }
    expect(worst, label).toBeLessThanOrEqual(3e-8);
    const mass = computeMassProperties(shape, () => 1000);
    expect(mass.mass, label).toBeGreaterThan(0);
    for (const x of mass.inertia) expect(Number.isFinite(x), label).toBe(true);
    expect(buildCollisionPieces(shape, { chordError: 0.0005 }).length, label).toBeGreaterThan(0);
    const box = boundingBox(shape);
    // The box of the shape contains the mesh.
    for (let v = 0; v < mesh.positions.length; v++) {
      const k = v % 3;
      expect(mesh.positions[v] as number).toBeGreaterThanOrEqual((box.min[k] as number) - 1e-7);
      expect(mesh.positions[v] as number).toBeLessThanOrEqual((box.max[k] as number) + 1e-7);
    }
    const ids = [...new Set(shape.regions.map((r) => r.id))];
    const covered = ids.reduce((sum, id) => sum + surfaceArea(shape, id), 0);
    expect(covered, label).toBeLessThanOrEqual(surfaceArea(shape) * (1 + 1e-12));
  }

  it('25 box shells with and without flange and lid lip', () => {
    const rnd = testRandom(4242);
    for (let i = 0; i < 25; i++) {
      const wall = rnd.range(1, 6);
      const corner = rnd.range(wall, 40);
      const lip =
        rnd.next() < 0.3 && corner - wall > 1
          ? { heightMm: rnd.range(2, 12), insetMm: rnd.range(0, corner - wall) }
          : undefined;
      const flange = rnd.next() < 0.5 ? rnd.range(1, 15) : undefined;
      check(
        {
          class: 'box_shell',
          material: 'm',
          lengthMm: 2 * corner + rnd.range(0, 200),
          widthMm: 2 * corner + rnd.range(0, 150),
          heightMm: wall + (rnd.next() < 0.2 ? 0 : rnd.range(0.5, 90)),
          wallMm: wall,
          cornerRadiusMm: corner,
          ...(flange === undefined ? {} : { flangeMm: flange }),
          ...(lip === undefined ? {} : { lidLip: lip }),
        },
        `box ${i}`,
      );
    }
  });

  it('32 rods with every kind of head', () => {
    const rnd = testRandom(4243);
    for (let i = 0; i < 32; i++) {
      const count = 2 + Math.floor(rnd.next() * 4);
      const nodes: { pMm: Vec3; widthMm: number; thicknessMm: number }[] = [];
      let p: Vec3 = [0, 0, rnd.range(2, 10)];
      for (let k = 0; k < count; k++) {
        nodes.push({ pMm: p, widthMm: rnd.range(2, 20), thicknessMm: rnd.range(1.5, 8) });
        p = [
          p[0] + rnd.range(15, 80),
          p[1] + rnd.range(-10, 10),
          Math.max(1, p[2] + rnd.range(-5, 8)),
        ];
      }
      const heads = [
        { type: 'none' },
        {
          type: 'spoon_bowl',
          lengthMm: rnd.range(30, 110),
          widthMm: rnd.range(20, 70),
          depthMm: rnd.range(3, 12),
          thicknessMm: rnd.range(0.8, 2.5),
        },
        {
          type: 'fork_tines',
          count: 2 + Math.floor(rnd.next() * 4),
          lengthMm: rnd.range(25, 70),
          widthMm: rnd.range(15, 30),
          thicknessMm: rnd.range(1.2, 3),
        },
        {
          type: 'blade',
          lengthMm: rnd.range(60, 220),
          widthMm: rnd.range(12, 50),
          thicknessMm: rnd.range(1.2, 3.5),
        },
      ] as const;
      check(
        { class: 'rod', material: 'm', nodes, head: heads[i % 4] as (typeof heads)[number] },
        `rod ${i}`,
      );
    }
  });

  it('24 shells of revolution with handles, spouts, knobs, foot rings and stretch', () => {
    const rnd = testRandom(4244);
    for (let i = 0; i < 24; i++) {
      const radius = rnd.range(25, 70);
      const height = rnd.range(40, 150);
      const t = rnd.range(2, 6);
      const thickness = rnd.range(5, 12);
      const addons: SorDefMm['addons'] = [
        ...(i % 3 === 0
          ? [
              {
                type: 'handle_loop',
                attachZMm: [height * 0.25, height * 0.25 + thickness + rnd.range(8, height * 0.5)],
                reachMm: thickness + rnd.range(6, 30),
                sectionMm: [rnd.range(6, 16), thickness],
                azimuthDeg: rnd.range(0, 360),
              } as const,
            ]
          : []),
        ...(i % 3 === 1
          ? [
              {
                type: 'handle_bar',
                attachZMm: height * 0.6,
                lengthMm: rnd.range(60, 200),
                sectionMm: [rnd.range(10, 30), rnd.range(6, 14)],
                azimuthDeg: rnd.range(0, 360),
                elevationDeg: rnd.range(-5, 30),
              } as const,
            ]
          : []),
        ...(i % 4 === 0
          ? [
              {
                type: 'spout',
                azimuthDeg: rnd.range(0, 360),
                widthMm: rnd.range(10, 30),
                reachMm: rnd.range(4, 15),
              } as const,
            ]
          : []),
        ...(i % 5 === 0
          ? [
              {
                type: 'knob',
                zMm: 0,
                radiusMm: rnd.range(5, 15),
                heightMm: rnd.range(5, 30),
              } as const,
            ]
          : []),
      ];
      check(
        {
          class: 'sor',
          material: 'm',
          profileMm: [
            [0, t / 2 + 0.5, t],
            [radius - 4, t / 2 + 0.5, t],
            [radius - 1, t / 2 + 5, t],
            [radius + rnd.range(-3, 6), height, t],
          ],
          addons,
          ...(i % 2 === 0
            ? {
                footRing: {
                  rMm: radius * 0.6,
                  widthMm: rnd.range(2, 6),
                  // Ends inside the base, whose faces are 0.5 mm and t + 0.5 mm up.
                  heightMm: 0.5 + rnd.range(0.1, 0.9) * t,
                },
              }
            : {}),
          ...(i % 7 === 0 ? { scaleXY: [rnd.range(1, 1.4), 1] as const } : {}),
        },
        `sor ${i}`,
      );
    }
  });
});
