import type { Vec3 } from '@spotless/core';
import { quatLength, quatRotate } from '@spotless/core';
import {
  buildCollisionPieces,
  buildRenderMesh,
  COLLISION_CHORD_ERROR,
  computeMassProperties,
  expandGeometryMm,
  materialVolume,
  meshTopology,
  meshVolume,
  primitiveVolume,
  RENDER_CHORD_ERROR,
  surfaceArea,
  type Shape,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import {
  bodyMaterialOf,
  getItemType,
  hasItemType,
  instantiate,
  INSTANTIATE_SCALE_RANGE,
  instantiateItemType,
  itemDimensionsMm,
  itemProvenance,
  listItemTypes,
  partMaterialOf,
  poseQuaternion,
} from './catalogue.ts';
import { frictionPair } from './contact.ts';
import { hasMaterial, materialDensity } from './materials.ts';
import type { ItemInstance, ItemType } from './types.ts';

/** Volume of a box with rounded edges, outer size a x b x c and edge radius r (any one unit). */
function roundedBoxVolume(a: number, b: number, c: number, r: number): number {
  const [A, B, C] = [a - 2 * r, b - 2 * r, c - 2 * r];
  // Steiner: core box, six slabs, twelve quarter cylinders, eight ball octants.
  return (
    A * B * C +
    2 * r * (A * B + B * C + C * A) +
    Math.PI * r * r * (A + B + C) +
    (4 / 3) * Math.PI * r ** 3
  );
}

/** Surface area of the same rounded box. */
function roundedBoxArea(a: number, b: number, c: number, r: number): number {
  const [A, B, C] = [a - 2 * r, b - 2 * r, c - 2 * r];
  return 2 * (A * B + B * C + C * A) + 2 * Math.PI * r * (A + B + C) + 4 * Math.PI * r * r;
}

function poseOf(instance: ItemInstance, name: string): ItemInstance['stablePoses'][number] {
  const found = instance.stablePoses.find((p) => p.name === name);
  if (found === undefined) throw new Error(`no pose ${name}`);
  return found;
}

function expectVec(actual: Vec3, expected: Vec3, digits: number): void {
  for (let i = 0; i < 3; i++)
    expect(actual[i] as number).toBeCloseTo(expected[i] as number, digits);
}

describe('getItemType, hasItemType and listItemTypes', () => {
  it('lists every item type once, sorted by id', () => {
    const types = listItemTypes();
    const ids = types.map((t) => t.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);
  });

  it('finds a type by id and returns the record of the list', () => {
    for (const type of listItemTypes()) {
      expect(hasItemType(type.id)).toBe(true);
      expect(getItemType(type.id)).toBe(type);
    }
    expect(getItemType('dinner_plate_porcelain_270').name).toBe(
      'Dinner plate, heavy porcelain, 27 cm',
    );
  });

  it('throws a RangeError for an unknown id', () => {
    expect(hasItemType('unobtainium_plate')).toBe(false);
    expect(() => getItemType('unobtainium_plate')).toThrow(RangeError);
    expect(() => instantiate('unobtainium_plate')).toThrow(RangeError);
  });
});

describe('instantiate', () => {
  // Beech board of items.md row 64: a slab 380 x 270 x 22 mm with 3 mm edges, 700 kg/m^3.
  const board = instantiate('chopping_board_beech_380');
  const volume = roundedBoxVolume(0.38, 0.27, 0.022, 0.003);

  it('converts millimetres to metres: the bounding box of a board', () => {
    expectVec(board.bbox.min, [-0.19, -0.135, 0], 12);
    expectVec(board.bbox.max, [0.19, 0.135, 0.022], 12);
    expectVec(board.referencePoint, [0, 0, 0.011], 12);
    expect(board.scale).toBe(1);
    expect(board.type).toBe(getItemType('chopping_board_beech_380'));
  });

  it('weighs the board with its catalogue density: m = rho V in closed form', () => {
    expect(materialDensity('beech')).toBe(700);
    expect(board.volume / volume).toBeCloseTo(1, 9);
    expect(board.mass.mass / (700 * volume)).toBeCloseTo(1, 9);
    expectVec(board.mass.com, [0, 0, 0.011], 12);
    // About the vertical axis a sharp box has m (L^2 + W^2) / 12; 3 mm edges take off under 1 %.
    const sharp = (board.mass.mass * (0.38 ** 2 + 0.27 ** 2)) / 12;
    const izz = board.mass.inertia[8] as number;
    expect(izz).toBeLessThan(sharp);
    expect(izz / sharp).toBeGreaterThan(0.99);
  });

  it('reports the area of every surface region', () => {
    const [A, B, r] = [0.374, 0.264, 0.003];
    const total = Object.values(board.regionAreas).reduce((a, b) => a + b, 0);
    expect(total / roundedBoxArea(0.38, 0.27, 0.022, 0.003)).toBeCloseTo(1, 9);
    // The top face with the rounds along its four edges and its four corners.
    const top = A * B + (Math.PI * r * (2 * A + 2 * B)) / 2 + 2 * Math.PI * r * r;
    expect((board.regionAreas.top as number) / top).toBeCloseTo(1, 6);
    expect(board.regionAreas.underside).toBeCloseTo(board.regionAreas.top as number, 12);
    expect(Object.keys(board.regionAreas).sort()).toEqual(['edge', 'top', 'underside']);
  });

  it('gives the contact material of the body, which keys the friction table', () => {
    expect(board.contact).toEqual({ material: 'beech' });
    const pan = instantiate('frying_pan_nonstick_280');
    expect(pan.contact.material).toBe('aluminium_nonstick');
    // items.md table 11.1, PTFE-coated pan on coated wire in the wash: 0.08.
    expect(frictionPair(pan.contact.material, 'rack_wire_pa11', true).friction).toBe(0.08);
    // A foot ring is unglazed, but the body of a mug is glazed.
    expect(instantiate('mug_ceramic_300').contact.material).toBe('porcelain_glazed');
  });

  it('weighs every plain shell of revolution as the thin-shell formula of items.md 2.3 does', () => {
    // m = rho * sum over segments of 2 pi L * integral of r t, plus the rounded rim (half a disc
    // of diameter t swept round the rim). The formula errs by the order of t / (2 r); the
    // thick-based glasses are the worst, at 1.6 %.
    let checked = 0;
    for (const type of listItemTypes()) {
      const g = type.geometry;
      if (g.class !== 'sor') continue;
      if (g.footRing !== undefined || (g.addons ?? []).length > 0) continue;
      if (g.scaleXY !== undefined || g.porosity !== undefined) continue;
      let volumeMm3 = 0;
      for (let i = 0; i + 1 < g.profileMm.length; i++) {
        const [r1, z1, t1] = g.profileMm[i] as readonly [number, number, number];
        const [r2, z2, t2] = g.profileMm[i + 1] as readonly [number, number, number];
        const length = Math.hypot(r2 - r1, z2 - z1);
        const [dr, dt] = [r2 - r1, t2 - t1];
        volumeMm3 += 2 * Math.PI * length * (r1 * t1 + (r1 * dt + t1 * dr) / 2 + (dr * dt) / 3);
      }
      for (const end of [g.profileMm[0], g.profileMm[g.profileMm.length - 1]]) {
        const [r, , t] = end as readonly [number, number, number];
        volumeMm3 += 2 * Math.PI * r * ((Math.PI * (t / 2) ** 2) / 2);
      }
      const expected = materialDensity(g.material) * volumeMm3 * 1e-9;
      expect(Math.abs(instantiate(type.id).mass.mass / expected - 1), type.id).toBeLessThan(0.02);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it('returns a shape the kernel meshes into a closed surface of the same volume', () => {
    // Plain shells: one part, so the mesh encloses exactly the solid the mass was computed
    // from, short of the facets (render chord error 0.1 mm: under 0.5 % of the volume).
    for (const id of ['tumbler_250', 'dinner_plate_vitrelle_260', 'drinking_cup_pp_400']) {
      const instance = instantiate(id);
      const mesh = buildRenderMesh(instance.shape, { chordError: RENDER_CHORD_ERROR });
      expect(meshTopology(mesh).closed, id).toBe(true);
      const ratio = meshVolume(mesh) / instance.volume;
      expect(ratio, id).toBeGreaterThan(0.995);
      expect(ratio, id).toBeLessThanOrEqual(1);
    }
  });

  it('returns a shape whose collision pieces carry the material of their own part', () => {
    const knife = instantiate('chefs_knife_200');
    const pieces = buildCollisionPieces(knife.shape, { chordError: COLLISION_CHORD_ERROR });
    expect(pieces.length).toBeGreaterThan(0);
    const partIds = new Set(knife.shape.parts.map((p) => p.id));
    for (const piece of pieces) {
      expect(partIds.has(piece.part), piece.part).toBe(true);
      expect(piece.material).toBe(piece.part.startsWith('grip') ? 'tpe' : 'stainless_steel');
    }
    // The contact material of the item as a whole is that of the blade, most of its mass.
    expect(knife.contact.material).toBe('stainless_steel');
  });

  it('caches the instance at scale 1', () => {
    expect(instantiate('mug_ceramic_300')).toBe(instantiate('mug_ceramic_300'));
    expect(instantiate('mug_ceramic_300', { scale: 1 })).toBe(instantiate('mug_ceramic_300'));
  });

  it('scales lengths by s, areas by s^2 and mass by s^3', () => {
    const s = 1.25;
    const base = instantiate('mug_ceramic_300');
    const scaled = instantiate('mug_ceramic_300', { scale: s });
    expect(scaled).not.toBe(base);
    expect(scaled.scale).toBe(s);
    expect(scaled.mass.mass / base.mass.mass).toBeCloseTo(s ** 3, 9);
    expect(scaled.volume / base.volume).toBeCloseTo(s ** 3, 9);
    for (let i = 0; i < 3; i++) {
      expect(scaled.bbox.max[i] as number).toBeCloseTo(s * (base.bbox.max[i] as number), 12);
      expect(scaled.bbox.min[i] as number).toBeCloseTo(s * (base.bbox.min[i] as number), 12);
      expect(scaled.mass.com[i] as number).toBeCloseTo(s * (base.mass.com[i] as number), 12);
    }
    for (const [region, area] of Object.entries(base.regionAreas)) {
      expect((scaled.regionAreas[region] as number) / area, region).toBeCloseTo(s * s, 9);
    }
    // Orientations do not change with size.
    expect(scaled.stablePoses).toEqual(base.stablePoses);
  });

  it('refuses a scale outside 0.5 to 2', () => {
    expect(INSTANTIATE_SCALE_RANGE).toEqual([0.5, 2]);
    expect(() => instantiate('mug_ceramic_300', { scale: 0.49 })).toThrow(RangeError);
    expect(() => instantiate('mug_ceramic_300', { scale: 2.01 })).toThrow(RangeError);
    expect(() => instantiate('mug_ceramic_300', { scale: Number.NaN })).toThrow(RangeError);
    expect(instantiate('mug_ceramic_300', { scale: 0.5 }).scale).toBe(0.5);
    expect(instantiate('mug_ceramic_300', { scale: 2 }).scale).toBe(2);
  });

  it('is what the kernel makes of the record: same shape, same mass, for every item type', () => {
    // A consumer that expands `type.geometry` itself and weighs it with the kernel must get what
    // `instantiate` returns: nothing is added on the way (no region renaming, no porosity
    // correction of the catalogue's own).
    let perforated = 0;
    for (const type of listItemTypes()) {
      const instance = instantiate(type.id);
      const shape = expandGeometryMm(type.geometry);
      expect(instance.shape, type.id).toEqual(shape);
      const mass = computeMassProperties(shape, materialDensity);
      expect(instance.mass, type.id).toEqual(mass);
      expect(instance.volume, type.id).toBe(materialVolume(shape));
      if (shape.parts.some((part) => (part.porosity ?? 0) > 0)) {
        perforated++;
        // A perforated item weighs less than its solid shape, by what its holes take out.
        const solid: Shape = {
          parts: shape.parts.map(({ porosity: _porosity, ...part }) => part),
          regions: shape.regions,
        };
        const solidMass = computeMassProperties(solid, materialDensity).mass;
        let expected = 0;
        for (const part of shape.parts) {
          expected +=
            materialDensity(part.material) *
            primitiveVolume(part.prim) *
            (1 - (part.porosity ?? 0));
        }
        expect(mass.mass, type.id).toBeLessThan(solidMass);
        expect(mass.mass / expected, type.id).toBeCloseTo(1, 12);
      }
    }
    // The colander, the sieve and the box grater.
    expect(perforated).toBe(3);
  });

  it('agrees with the kernel on region areas for an item with merged regions', () => {
    // The muffin tin is a compound of twelve cups and nine strips whose regions are merged
    // into three by rename rules: the three areas must add up to the whole surface.
    const tin = instantiate('muffin_tin_12');
    expect(Object.keys(tin.regionAreas).sort()).toEqual(['cavities', 'top', 'underside']);
    const total = Object.values(tin.regionAreas).reduce((a, b) => a + b, 0);
    expect(total / surfaceArea(tin.shape)).toBeCloseTo(1, 9);
    // Twelve cavities of 64 mm diameter: more than twelve discs, less than twelve cylinders
    // 32 mm deep with a floor.
    const disc = Math.PI * 0.032 ** 2;
    expect(tin.regionAreas.cavities as number).toBeGreaterThan(12 * disc);
    expect(tin.regionAreas.cavities as number).toBeLessThan(
      12 * (disc + 2 * Math.PI * 0.032 * 0.032),
    );
  });
});

describe('instantiateItemType', () => {
  it('builds a record that is not in the catalogue', () => {
    const base = getItemType('chopping_board_beech_380');
    const thin: ItemType = {
      ...base,
      id: 'test_board_thin',
      geometry: {
        class: 'slab',
        material: 'beech',
        lengthMm: 300,
        widthMm: 200,
        thicknessMm: 10,
        edgeRadiusMm: 2,
      },
    };
    const instance = instantiateItemType(thin);
    expect(instance.type).toBe(thin);
    expect(instance.mass.mass / (700 * roundedBoxVolume(0.3, 0.2, 0.01, 0.002))).toBeCloseTo(1, 9);
    expect(hasItemType('test_board_thin')).toBe(false);
    expect(() => instantiateItemType(thin, { scale: 3 })).toThrow(RangeError);
  });

  it('rejects a record whose geometry names a material the catalogue does not have', () => {
    const base = getItemType('chopping_board_beech_380');
    const bad: ItemType = {
      ...base,
      id: 'test_board_unobtainium',
      geometry: {
        class: 'slab',
        material: 'unobtainium',
        lengthMm: 300,
        widthMm: 200,
        thicknessMm: 10,
        edgeRadiusMm: 2,
      },
    };
    expect(hasMaterial('unobtainium')).toBe(false);
    expect(() => instantiateItemType(bad)).toThrow(RangeError);
  });
});

describe('named poses', () => {
  it('turn the Euler angles of a record into the rotation they describe', () => {
    const plate = instantiate('dinner_plate_porcelain_270');
    // Upright: the identity.
    expect(poseOf(plate, 'upright').q).toEqual([0, 0, 0, 1]);
    // Inverted, [180, 0, 0]: a half turn about x.
    const inverted = poseOf(plate, 'inverted').q;
    expectVec(quatRotate(inverted, [0, 0, 1]), [0, 0, -1], 12);
    expectVec(quatRotate(inverted, [0, 1, 0]), [0, -1, 0], 12);
    expectVec(quatRotate(inverted, [1, 0, 0]), [1, 0, 0], 12);
    // On edge, [90, 0, 0]: the axis of the plate lies along -y, its +y edge is up.
    const onEdge = poseOf(plate, 'on_edge').q;
    expectVec(quatRotate(onEdge, [0, 0, 1]), [0, -1, 0], 12);
    expectVec(quatRotate(onEdge, [0, 1, 0]), [0, 0, 1], 12);
    // Leaning, [70, 0, 0]: the upper face 20 degrees up from horizontal.
    const leaning = quatRotate(poseOf(plate, 'leaning').q, [0, 0, 1]);
    expect(leaning[2]).toBeCloseTo(Math.sin((20 * Math.PI) / 180), 12);
    expect(leaning[1]).toBeCloseTo(-Math.cos((20 * Math.PI) / 180), 12);
  });

  it('stand cutlery on end and boards on their short edge', () => {
    // The long axis of cutlery is +x, handle at the origin: handle down puts +x up.
    const fork = instantiate('dinner_fork_185');
    expectVec(quatRotate(poseOf(fork, 'handle_down').q, [1, 0, 0]), [0, 0, 1], 12);
    expectVec(quatRotate(poseOf(fork, 'handle_up').q, [1, 0, 0]), [0, 0, -1], 12);
    // On its short edge, [90, 0, 90], a board has its long axis vertical and faces the front.
    const board = instantiate('chopping_board_beech_380');
    const q = poseOf(board, 'on_short_edge').q;
    expectVec(quatRotate(q, [1, 0, 0]), [0, 0, 1], 12);
    expectVec(quatRotate(q, [0, 0, 1]), [0, -1, 0], 12);
  });

  it('are unit quaternions in canonical form (w >= 0) for every pose of every item', () => {
    for (const type of listItemTypes()) {
      for (const pose of type.placement.stablePoses) {
        const q = poseQuaternion(pose);
        expect(Math.abs(quatLength(q) - 1), `${type.id}:${pose.name}`).toBeLessThan(1e-12);
        expect(q[3], `${type.id}:${pose.name}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('itemProvenance, itemDimensionsMm, partMaterialOf and bodyMaterialOf', () => {
  it('summarises the tags of a row as the dossier gives them', () => {
    // items.md row 17: "H 70 (V), D 85 (E) | 260 (E; 290 gross V)"; profiles are all estimates.
    expect(itemProvenance(getItemType('mug_porcelain_240'))).toEqual({
      dims: { diameter: 'ESTIMATED', height: 'VERIFIED' },
      mass: 'ESTIMATED',
      profile: 'ESTIMATED',
    });
    // Row 37: "D 110, H 190, handle reach 45 (R) | 790 (E)".
    expect(itemProvenance(getItemType('glass_jug_1000'))).toEqual({
      dims: { diameter: 'RECALLED', height: 'RECALLED', handle_reach: 'RECALLED' },
      mass: 'ESTIMATED',
      profile: 'ESTIMATED',
    });
  });

  it('gives the stated dimensions by name, in millimetres', () => {
    // items.md row 2: "D 270, H 30"; row 70: "top D 254, base D 190, depth 51, overall L 470".
    expect(itemDimensionsMm(getItemType('dinner_plate_porcelain_270'))).toEqual({
      diameter: 270,
      height: 30,
    });
    expect(itemDimensionsMm(getItemType('frying_pan_clad_254'))).toEqual({
      top_diameter: 254,
      base_diameter: 190,
      depth: 51,
      overall_length: 470,
    });
  });

  it('resolves the material of a part by the first matching entry', () => {
    const lid = getItemType('lid_glass_240');
    expect(partMaterialOf(lid, 'knob')).toBe('stainless_steel');
    expect(partMaterialOf(lid, 'body')).toBe('glass_soda_lime');
    expect(bodyMaterialOf(lid)).toBe('glass_soda_lime');
    const knife = getItemType('chefs_knife_200');
    expect(partMaterialOf(knife, 'blade.head.0')).toBe('stainless_steel');
    expect(partMaterialOf(knife, 'grip.handle.0')).toBe('tpe');
    expect(() => partMaterialOf(knife, 'sheath')).toThrow(RangeError);
  });
});
