import type { Pose } from '@spotless/core';
import {
  boundingBox,
  expandGeometryMm,
  materialVolume,
  type Part,
  type Shape,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { listItemTypes, instantiate } from './catalogue.ts';
import {
  brimfulVolume,
  countedTwice,
  looseParts,
  massPropertiesOf,
  measureDimensionMm,
  MIN_JOINT_OVERLAP,
  partOverlap,
  scaleShape,
} from './shape-util.ts';

const IDENTITY: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };

/** A ball of the given radius (m) centred at `centre`. */
function ball(
  id: string,
  radius: number,
  centre: readonly [number, number, number],
  material: string,
  porosity?: number,
): Part {
  return {
    id,
    prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius },
    pose: { p: centre, q: [0, 0, 0, 1] },
    material,
    ...(porosity === undefined ? {} : { porosity }),
  };
}

/** A straight-sided cup: flat base of radius 40 mm, wall to 100 mm, 4 mm thick (metres). */
const CUP: Shape = {
  parts: [
    {
      id: 'body',
      prim: {
        kind: 'sor',
        profile: [
          { r: 0, z: 0.003, t: 0.006 },
          { r: 0.038, z: 0.003, t: 0.006 },
          { r: 0.038, z: 0.098, t: 0.004 },
        ],
      },
      pose: IDENTITY,
      material: 'porcelain_glazed',
    },
    {
      id: 'handle.0',
      prim: { kind: 'capsule', a: [0.04, 0, 0.05], b: [0.07, 0, 0.05], radius: 0.005 },
      pose: IDENTITY,
      material: 'porcelain_glazed',
    },
  ],
  regions: [],
};

describe('massPropertiesOf', () => {
  const r = 0.01;
  const ballVolume = (4 / 3) * Math.PI * r ** 3;

  it('weighs a part with its catalogue density: m = rho V', () => {
    const shape: Shape = { parts: [ball('a', r, [0, 0, 0], 'stainless_steel')], regions: [] };
    const m = massPropertiesOf(shape);
    expect(m.mass).toBeCloseTo(7900 * ballVolume, 12);
    // Solid sphere: I = 2/5 m r^2 about every axis.
    expect(m.inertia[0]).toBeCloseTo(0.4 * m.mass * r * r, 14);
    expect(m.inertia[8]).toBeCloseTo(0.4 * m.mass * r * r, 14);
  });

  it('takes the open-area fraction out of a perforated part, as the kernel does', () => {
    const solid: Shape = { parts: [ball('a', r, [0, 0, 0], 'stainless_steel')], regions: [] };
    const perforated: Shape = {
      parts: [ball('a', r, [0, 0, 0], 'stainless_steel', 0.3)],
      regions: [],
    };
    expect(massPropertiesOf(perforated).mass).toBeCloseTo(0.7 * massPropertiesOf(solid).mass, 14);
    expect(materialVolume(perforated)).toBeCloseTo(0.7 * ballVolume, 14);
  });

  it('places the centre of mass by the moments of the parts', () => {
    // A steel ball at x = 0 and a polypropylene ball of the same size at x = 0.1 m.
    const shape: Shape = {
      parts: [
        ball('steel', r, [0, 0, 0], 'stainless_steel'),
        ball('pp', r, [0.1, 0, 0], 'polypropylene'),
      ],
      regions: [],
    };
    const m = massPropertiesOf(shape);
    expect(m.com[0]).toBeCloseTo((0.1 * 905) / (7900 + 905), 12);
    expect(m.com[1]).toBeCloseTo(0, 15);
  });

  it('refuses a material the catalogue does not have', () => {
    const shape: Shape = { parts: [ball('a', r, [0, 0, 0], 'unobtainium')], regions: [] };
    expect(() => massPropertiesOf(shape)).toThrow(RangeError);
  });
});

describe('scaleShape', () => {
  it('scales lengths by s, volume by s^3 and inertia by s^5', () => {
    const s = 1.2;
    const scaled = scaleShape(CUP, s);
    const a = massPropertiesOf(CUP);
    const b = massPropertiesOf(scaled);
    expect(b.mass / a.mass).toBeCloseTo(s ** 3, 10);
    for (let i = 0; i < 3; i++) {
      expect(b.com[i] as number).toBeCloseTo(s * (a.com[i] as number), 12);
    }
    expect((b.inertia[0] as number) / (a.inertia[0] as number)).toBeCloseTo(s ** 5, 9);
    expect((b.inertia[8] as number) / (a.inertia[8] as number)).toBeCloseTo(s ** 5, 9);
    const boxA = boundingBox(CUP);
    const boxB = boundingBox(scaled);
    for (let i = 0; i < 3; i++) {
      expect(boxB.max[i] as number).toBeCloseTo(s * (boxA.max[i] as number), 12);
      expect(boxB.min[i] as number).toBeCloseTo(s * (boxA.min[i] as number), 12);
    }
  });

  it('returns the same shape at scale 1 and rejects a scale that is not positive', () => {
    expect(scaleShape(CUP, 1)).toBe(CUP);
    expect(() => scaleShape(CUP, 0)).toThrow(RangeError);
    expect(() => scaleShape(CUP, Number.NaN)).toThrow(RangeError);
  });
});

describe('measureDimensionMm', () => {
  it('measures the bounding box of the whole item and of selected parts', () => {
    // Body: outer radius 38 + 3 = 41 mm at the base corner; handle reaches 70 + 5 = 75 mm.
    expect(measureDimensionMm(CUP, { kind: 'bbox', axis: 'x' })).toBeCloseTo(41 + 75, 9);
    expect(measureDimensionMm(CUP, { kind: 'bbox', axis: 'y' })).toBeCloseTo(82, 9);
    expect(measureDimensionMm(CUP, { kind: 'bbox', axis: 'z' })).toBeCloseTo(100, 9);
    expect(measureDimensionMm(CUP, { kind: 'bbox', axis: 'x', parts: 'handle*' })).toBeCloseTo(
      40,
      9,
    );
    expect(measureDimensionMm(CUP, { kind: 'bbox', axis: 'z', parts: 'body' })).toBeCloseTo(100, 9);
  });

  it('measures the rim, the base corner and the inner depth on the profile', () => {
    // Rim: 2 (38 + 2) mm; base corner: 2 (38 + 3) mm; depth: rim top 100 mm less the 6 mm base.
    expect(measureDimensionMm(CUP, { kind: 'rim_diameter' })).toBeCloseTo(80, 9);
    expect(measureDimensionMm(CUP, { kind: 'base_diameter' })).toBeCloseTo(82, 9);
    expect(measureDimensionMm(CUP, { kind: 'inner_depth' })).toBeCloseTo(94, 9);
  });

  it('throws when the part to measure is missing or is not a shell of revolution', () => {
    expect(() => measureDimensionMm(CUP, { kind: 'bbox', axis: 'x', parts: 'lid*' })).toThrow(
      RangeError,
    );
    expect(() => measureDimensionMm(CUP, { kind: 'rim_diameter', part: 'handle.0' })).toThrow(
      RangeError,
    );
    expect(() => measureDimensionMm(CUP, { kind: 'inner_depth', part: 'nothing' })).toThrow(
      RangeError,
    );
  });
});

describe('partOverlap and looseParts', () => {
  const two = (gap: number): Shape => ({
    // Two balls of radius 10 mm whose surfaces are `gap` apart (negative: overlapping).
    parts: [ball('a', 0.01, [0, 0, 0], 'beech'), ball('b', 0.01, [0.02 + gap, 0, 0], 'beech')],
    regions: [],
  });

  it('measures how deep two parts reach into each other: half of what two balls share', () => {
    // Two balls whose centres are 20 mm - d apart share a lens d thick; its middle is d / 2
    // inside both. Apart by g, the nearest point to both is g / 2 from each.
    for (const d of [0.004, 0.001, 0.0002]) {
      expect(partOverlap(two(-d), 0, 1)).toBeCloseTo(d / 2, 6);
    }
    for (const g of [0.0001, 0.001]) {
      expect(partOverlap(two(g), 0, 1)).toBeCloseTo(-g / 2, 6);
    }
    // Far apart: no search, just the bound from the bounding boxes (5 mm between them).
    expect(partOverlap(two(0.005), 0, 1)).toBeCloseTo(-0.0025, 9);
  });

  it('finds a capsule that crosses a wall although no corner of either is inside the other', () => {
    // The handle of the cup starts in its wall (the wall is centred on r = 38 mm and the
    // handle's end sphere, radius 5 mm, on r = 40 mm): they share the wall's whole thickness
    // there. The wall tapers from 6 mm at the base to 4 mm at the rim and is 5.0 mm thick at
    // the height of the handle: its middle is 2.5 mm inside it, and 3 mm inside the sphere.
    expect(partOverlap(CUP, 0, 1)).toBeGreaterThan(0.0024);
    expect(partOverlap(CUP, 0, 1)).toBeLessThan(0.0026);
    expect(looseParts(CUP)).toEqual([]);
  });

  it('names the parts that are not joined to the rest, and how nearly they are', () => {
    expect(MIN_JOINT_OVERLAP).toBe(0.00005);
    // Touching along nothing but a point, or overlapping by less than the minimum: loose.
    for (const d of [0, 0.00008]) {
      const loose = looseParts(two(-d));
      expect(loose).toHaveLength(1);
      expect(loose[0]?.part).toBe('b');
      expect(loose[0]?.between).toEqual(['b', 'a']);
      expect(loose[0]?.overlap).toBeCloseTo(d / 2, 6);
    }
    // Sharing 0.2 mm (0.1 mm deep): joined.
    expect(looseParts(two(-0.0002))).toEqual([]);
    // A chain a - b - c is in one piece although a and c are far apart; d, beyond a gap, is
    // loose, and so is e, which only d holds.
    const chain: Shape = {
      parts: [
        ball('a', 0.01, [0, 0, 0], 'beech'),
        ball('c', 0.01, [0.036, 0, 0], 'beech'),
        ball('b', 0.01, [0.018, 0, 0], 'beech'),
        ball('d', 0.01, [0.058, 0, 0], 'beech'),
        ball('e', 0.01, [0.076, 0, 0], 'beech'),
      ],
      regions: [],
    };
    const loose = looseParts(chain);
    expect(loose.map((l) => l.part)).toEqual(['d', 'e']);
    // Both are reported with the gap of their group to the rest: c to d, 2 mm apart.
    for (const l of loose) {
      expect(l.overlap).toBeCloseTo(-0.001, 6);
      expect([...l.between].sort()).toEqual(['c', 'd']);
    }
  });

  it('finds every catalogue item in one piece', () => {
    // The swivel peeler's blade bar used to float 4 mm from every other part, the two arms of
    // the tongs were 0.09 mm apart at the hinge, and the handle of the box grater only touched
    // its body along a line.
    let parts = 0;
    for (const type of listItemTypes()) {
      const shape = instantiate(type.id).shape;
      parts += shape.parts.length;
      expect(looseParts(shape), type.id).toEqual([]);
    }
    expect(parts).toBeGreaterThan(500);
  });
});

describe('countedTwice', () => {
  /** Volume of the lens two balls of radius r share when their centres are d apart. */
  const lens = (r: number, d: number): number => (Math.PI * (2 * r - d) ** 2 * (d + 4 * r)) / 12;

  it('finds the lens two balls share, and weighs it at the lighter of two materials', () => {
    // Beech (700 kg/m3) and stainless steel (7900): the lens is steel in the item, and the
    // beech summed on top of it is what is counted twice.
    const r = 0.01;
    for (const d of [0.012, 0.016, 0.019]) {
      const shape: Shape = {
        parts: [ball('a', r, [0, 0, 0], 'beech'), ball('b', r, [d, 0, 0], 'stainless_steel')],
        regions: [],
      };
      const twice = countedTwice(shape);
      expect(Math.abs(twice.volume / lens(r, d) - 1), `d = ${d}`).toBeLessThan(0.02);
      expect(twice.mass / twice.volume).toBeCloseTo(700, 6);
    }
  });

  it('counts a point in three parts twice, not three times', () => {
    // Three balls in the same place: the sum is three balls, the solid is one.
    const r = 0.01;
    const shape: Shape = {
      parts: ['a', 'b', 'c'].map((id) => ball(id, r, [0, 0, 0], 'beech')),
      regions: [],
    };
    const one = (4 / 3) * Math.PI * r ** 3;
    expect(Math.abs(countedTwice(shape).volume / (2 * one) - 1)).toBeLessThan(0.02);
    expect(Math.abs(countedTwice(shape).mass / (2 * one * 700) - 1)).toBeLessThan(0.02);
  });

  it('finds nothing where parts do not overlap, and takes the holes out of a perforated part', () => {
    const apart: Shape = {
      parts: [ball('a', 0.01, [0, 0, 0], 'beech'), ball('b', 0.01, [0.03, 0, 0], 'beech')],
      regions: [],
    };
    expect(countedTwice(apart)).toEqual({ volume: 0, mass: 0 });
    // A solid beech ball in a perforated one (30 % open) of the same size: the perforated one
    // is the lighter and is what is counted on top, at 70 % of the density.
    const shape: Shape = {
      parts: [ball('a', 0.01, [0, 0, 0], 'beech'), ball('b', 0.01, [0, 0, 0], 'beech', 0.3)],
      regions: [],
    };
    const twice = countedTwice(shape);
    expect(twice.mass / twice.volume).toBeCloseTo(0.7 * 700, 6);
  });
});

describe('brimfulVolume', () => {
  /** A straight-sided cup: mid-surface radius and height in mm, 2 mm wall, floor at `baseMm`. */
  const cup = (radiusMm: number, heightMm: number, baseMm = 1): Shape =>
    expandGeometryMm({
      class: 'sor',
      material: 'glass_soda_lime',
      profileMm: [
        [0, baseMm, 2],
        [radiusMm, baseMm, 2],
        [radiusMm, baseMm + heightMm, 2],
      ],
    });

  it('is the cylinder inside a straight-sided cup, within 3 %', () => {
    // Inner radius 39 mm; from the inner floor (2 mm) to the top of the rounded rim (102 mm).
    const exact = Math.PI * 0.039 ** 2 * 0.1;
    const got = brimfulVolume(cup(40, 100));
    expect(Math.abs(got / exact - 1)).toBeLessThan(0.03);
  });

  it('does not leak through a wall thinner than a grid cell', () => {
    // 4000 cells over a 82 x 82 x 102 mm box are 5.6 mm across, nearly three times the wall.
    const exact = Math.PI * 0.039 ** 2 * 0.1;
    const got = brimfulVolume(cup(40, 100), 4000);
    expect(Math.abs(got / exact - 1)).toBeLessThan(0.25);
  });

  it('holds nothing in a solid ball and nothing under an upturned cup', () => {
    const solid: Shape = { parts: [ball('b', 0.03, [0, 0, 0.03], 'glass_soda_lime')], regions: [] };
    expect(brimfulVolume(solid)).toBe(0);
    const upturned = cup(40, 100);
    const flipped: Shape = {
      ...upturned,
      parts: upturned.parts.map((part) => ({
        ...part,
        pose: { p: [0, 0, 0.102], q: [1, 0, 0, 0] },
      })),
    };
    // Upside down the base is a flat lid; at most the rounding of its edge holds a film.
    expect(brimfulVolume(flipped)).toBeLessThan(0.02 * Math.PI * 0.039 ** 2 * 0.1);
  });

  it('fills a cup on a stem only as far as its own rim', () => {
    // The same cup raised 80 mm on a stem and foot holds the same water.
    const stemmed = expandGeometryMm({
      class: 'sor',
      material: 'glass_soda_lime',
      profileMm: [
        [4, 81, 2],
        [40, 81, 2],
        [40, 181, 2],
      ],
      addons: [{ type: 'stem_foot', stemRadiusMm: 4, footRadiusMm: 35, footThicknessMm: 4 }],
    });
    const exact = Math.PI * 0.039 ** 2 * 0.1;
    expect(Math.abs(brimfulVolume(stemmed) / exact - 1)).toBeLessThan(0.04);
  });

  it('refuses a grid too coarse to mean anything', () => {
    expect(() => brimfulVolume(cup(40, 100), 10)).toThrow(RangeError);
  });
});
