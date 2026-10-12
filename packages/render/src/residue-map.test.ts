// Residue painting without a WebGL context: the unpacking of a map, the colour scale against
// every material of the catalogue, the tiles, and the tiles on an item of the scene.
import { bodyMaterialOf, instantiate, listMaterials } from '@spotless/catalogue';
import { signedDistance } from '@spotless/geometry';
import type { InstancedMesh } from 'three';
import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { materialAppearance } from './appearance.ts';
import type { ResidueCellData, ResidueMapInput } from './residue-map.ts';
import {
  cellFraction,
  contrastRatio,
  decodeResidueMap,
  luminance,
  OUTLINE_LIFT,
  OUTLINE_WIDTH,
  RESIDUE_OUTLINE_DARK,
  RESIDUE_OUTLINE_LIGHT,
  RESIDUE_STEPS,
  residueOutline,
  residueStep,
  residueTiles,
  summariseResidue,
  TILE_LIFT,
  TILE_OVERLAP,
  TRACE_DOT,
} from './residue-map.ts';
import { buildResidueObject, RESIDUE_OBJECT_NAME } from './residue-object.ts';
import { SpotlessScene } from './scene.ts';

/** Packs integers as the wire format says: little-endian, base64 (written apart from the decoder). */
function pack(values: readonly number[], bytes: 1 | 2, signed: boolean): string {
  const view = new DataView(new ArrayBuffer(values.length * bytes));
  values.forEach((value, i) => {
    if (bytes === 2 && signed) view.setInt16(2 * i, value, true);
    else if (bytes === 2) view.setUint16(2 * i, value, true);
    else if (signed) view.setInt8(i, value);
    else view.setUint8(i, value);
  });
  return btoa(String.fromCharCode(...new Uint8Array(view.buffer)));
}

/** Cells on the inside of the wall of a mug: radius 38 mm about z, normals towards the axis. */
function mugCells(count: number): ResidueCellData {
  const centre = new Float32Array(3 * count);
  const normal = new Float32Array(3 * count);
  const areaMm2 = new Float32Array(count).fill(4);
  const fraction = new Float32Array(2 * count);
  const visible = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    centre.set([0.038 * Math.cos(angle), 0.038 * Math.sin(angle), 0.02 + 0.002 * (i % 5)], 3 * i);
    normal.set([-Math.cos(angle), -Math.sin(angle), 0], 3 * i);
    fraction[2 * i] = (i + 1) / count;
    fraction[2 * i + 1] = i % 4 === 0 ? 0.9 : 0;
    visible[i] = i % 3 === 2 ? 0 : 1;
  }
  return { count, centre, normal, areaMm2, soils: ['coffee', 'milk_film'], fraction, visible };
}

describe('decodeResidueMap', () => {
  it('unpacks the wire format: quanta, signs, byte order, columns', () => {
    const map: ResidueMapInput = {
      item_id: 'plate_01',
      soils: ['tomato_sauce', 'cheese_melted'],
      cells: 2,
      position_quantum_mm: 0.02,
      area_quantum_mm2: 0.01,
      // (100, -50, 12.34) mm and (-135, 0.02, 0) mm.
      positions: pack([5000, -2500, 617, -6750, 1, 0], 2, true),
      normals: pack([0, 0, 127, -127, 0, 0], 1, true),
      areas: pack([400, 1234], 2, false),
      fractions: pack([255, 0, 1, 128], 1, false),
      visible: pack([1, 0], 1, false),
    };
    const cells = decodeResidueMap(map);
    expect(cells.count).toBe(2);
    expect(cells.soils).toEqual(['tomato_sauce', 'cheese_melted']);
    const close = (got: ArrayLike<number>, want: readonly number[]): void => {
      expect(got.length).toBe(want.length);
      want.forEach((value, i) => expect(got[i]).toBeCloseTo(value, 6));
    };
    close(cells.centre, [0.1, -0.05, 0.01234, -0.135, 0.00002, 0]);
    close(cells.normal, [0, 0, 1, -1, 0, 0]);
    close(cells.areaMm2, [4, 12.34]);
    close(cells.fraction, [1, 0, 1 / 255, 128 / 255]);
    expect([...cells.visible]).toEqual([1, 0]);
    // A 16-bit value above 255 only comes out right in little-endian order.
    expect(cells.centre[0]).not.toBeCloseTo((0x8813 * 0.02) / 1000, 3);
  });

  it('refuses a map whose arrays do not fit its counts', () => {
    const map: ResidueMapInput = {
      item_id: 'x',
      soils: ['a'],
      cells: 1,
      position_quantum_mm: 0.02,
      area_quantum_mm2: 0.01,
      positions: pack([0, 0, 0], 2, true),
      normals: pack([0, 0, 127], 1, true),
      areas: pack([400], 2, false),
      fractions: pack([255], 1, false),
      visible: pack([1], 1, false),
    };
    expect(decodeResidueMap(map).count).toBe(1);
    expect(() => decodeResidueMap({ ...map, cells: 2 })).toThrow(RangeError);
    expect(() => decodeResidueMap({ ...map, soils: ['a', 'b'] })).toThrow(RangeError);
  });
});

describe('the residue scale', () => {
  it('is four steps of one hue, light for little and dark for much', () => {
    expect(RESIDUE_STEPS).toHaveLength(4);
    const lum = RESIDUE_STEPS.map((step) => luminance(step.colour));
    expect([...lum].sort((a, b) => b - a)).toEqual(lum);
    // Neighbouring steps can be told apart.
    for (let i = 1; i < RESIDUE_STEPS.length; i++) {
      const lighter = RESIDUE_STEPS[i - 1];
      const darker = RESIDUE_STEPS[i];
      if (lighter === undefined || darker === undefined) throw new Error('no step');
      expect(contrastRatio(lighter.colour, darker.colour)).toBeGreaterThan(1.25);
      expect(darker.above).toBe(lighter.upTo);
    }
    // One hue: red and blue strong, green weak, in every step.
    for (const step of RESIDUE_STEPS) {
      const [r, g, b] = step.colour;
      expect(r).toBeGreaterThan(b);
      expect(b).toBeGreaterThan(g + 0.2);
      expect(step.css).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(residueStep(0.01)).toBe(RESIDUE_STEPS[0]);
    expect(residueStep(0.25)).toBe(RESIDUE_STEPS[0]);
    expect(residueStep(0.26)).toBe(RESIDUE_STEPS[1]);
    expect(residueStep(0.75)).toBe(RESIDUE_STEPS[2]);
    expect(residueStep(1)).toBe(RESIDUE_STEPS[3]);
    expect(residueStep(7)).toBe(RESIDUE_STEPS[3]);
    expect(residueStep(Number.NaN)).toBe(RESIDUE_STEPS[0]);
  });

  it('reads on every material of the catalogue: the rim against the material, the steps against the rim', () => {
    const weak: string[] = [];
    for (const material of listMaterials()) {
      const appearance = materialAppearance(material.id);
      const rim = residueOutline(appearance.colour);
      // The rim round a patch stands out from the material it lies on.
      if (contrastRatio(rim, appearance.colour) < 3) weak.push(`${material.id}: rim`);
      // And every step of the scale stands out from the rim.
      for (const step of RESIDUE_STEPS) {
        if (contrastRatio(step.colour, rim) < 2) weak.push(`${material.id}: ${step.css} on rim`);
      }
    }
    expect(weak).toEqual([]);
    // Light materials get the dark rim, dark ones the white.
    expect(residueOutline(materialAppearance('porcelain_glazed').colour)).toBe(
      RESIDUE_OUTLINE_DARK,
    );
    expect(residueOutline(materialAppearance('stainless_steel').colour)).toBe(RESIDUE_OUTLINE_DARK);
    expect(residueOutline(materialAppearance('cast_iron_seasoned').colour)).toBe(
      RESIDUE_OUTLINE_LIGHT,
    );
    expect(residueOutline(materialAppearance('aluminium_nonstick').colour)).toBe(
      RESIDUE_OUTLINE_LIGHT,
    );
    // On white porcelain and on a black pan the steps themselves have a contrast of 2 or more.
    for (const id of ['porcelain_glazed', 'cast_iron_seasoned']) {
      for (const step of RESIDUE_STEPS) {
        expect(contrastRatio(step.colour, materialAppearance(id).colour)).toBeGreaterThan(2);
      }
    }
  });
});

describe('residueTiles', () => {
  it('lays a tile on every visibly soiled cell: at the cell, facing along its normal, sized to it', () => {
    const cells = mugCells(24);
    const tiles = residueTiles(cells);
    const visible = [...cells.visible].filter((v) => v === 1).length;
    expect(tiles.count).toBe(visible);
    for (let t = 0; t < tiles.count; t++) {
      const cell = tiles.cell[t] as number;
      expect(cells.visible[cell]).toBe(1);
      const m = tiles.fill.subarray(16 * t, 16 * t + 16);
      const n = [...cells.normal.subarray(3 * cell, 3 * cell + 3)];
      const c = [...cells.centre.subarray(3 * cell, 3 * cell + 3)];
      // The third column is the normal: the tile faces the way the surface does.
      for (let axis = 0; axis < 3; axis++) {
        expect(m[8 + axis]).toBeCloseTo(n[axis] as number, 6);
        // Its centre is the cell's, a hair off the surface along the normal.
        expect(m[12 + axis]).toBeCloseTo((c[axis] as number) + (n[axis] as number) * TILE_LIFT, 8);
      }
      // The two tangents: as long as the tile is wide, square to each other and to the normal,
      // and right-handed with it, so that nothing is mirrored.
      const tx = new Vector3(m[0], m[1], m[2]);
      const ty = new Vector3(m[4], m[5], m[6]);
      const side = 0.002 * TILE_OVERLAP;
      expect(tx.length()).toBeCloseTo(side, 7);
      expect(ty.length()).toBeCloseTo(side, 7);
      expect(tx.dot(ty)).toBeCloseTo(0, 9);
      const normal = new Vector3(n[0], n[1], n[2]);
      expect(tx.dot(normal)).toBeCloseTo(0, 7);
      expect(tx.clone().cross(ty).normalize().dot(normal)).toBeCloseTo(1, 6);
      // On a body of revolution the first tangent runs round the axis.
      expect(tx.z).toBeCloseTo(0, 9);
      // The outline: the same place, lower, wider by the rim on each side.
      const o = tiles.outline.subarray(16 * t, 16 * t + 16);
      expect(new Vector3(o[0], o[1], o[2]).length()).toBeCloseTo(side + 2 * OUTLINE_WIDTH, 7);
      expect(o[12]).toBeCloseTo((c[0] as number) + (n[0] as number) * OUTLINE_LIFT, 8);
      expect(OUTLINE_LIFT).toBeLessThan(TILE_LIFT);
      // The colour is the step of the soil of which most is left there.
      const share = cellFraction(cells, cell, null);
      expect(tiles.fraction[t]).toBeCloseTo(share, 6);
      expect([...tiles.colour.subarray(3 * t, 3 * t + 3)]).toEqual(
        [...residueStep(share).colour].map((v) => Math.fround(v)),
      );
    }
  });

  it('rims the edge of a patch and not its inside', () => {
    // A patch of 5 by 5 cells of 2 mm on a flat face, and one cell on its own.
    const centre: number[] = [];
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) centre.push(0.02 + 0.002 * i, 0.002 * j, 0);
    centre.push(0.08, 0.05, 0);
    const count = centre.length / 3;
    const cells: ResidueCellData = {
      count,
      centre: Float32Array.from(centre),
      normal: Float32Array.from(Array.from({ length: count }, () => [0, 0, 1]).flat()),
      areaMm2: new Float32Array(count).fill(4),
      soils: ['gravy'],
      fraction: new Float32Array(count).fill(0.6),
      visible: new Uint8Array(count).fill(1),
    };
    const tiles = residueTiles(cells);
    expect(tiles.count).toBe(26);
    const rims = [...tiles.rimmed];
    // The sixteen cells round the patch and the lone cell have a rim; the nine inside none.
    expect(rims.reduce((sum, r) => sum + r, 0)).toBe(17);
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const inside = i > 0 && i < 4 && j > 0 && j < 4;
        expect(rims[5 * i + j]).toBe(inside ? 0 : 1);
        const o = tiles.outline.subarray(16 * (5 * i + j), 16 * (5 * i + j) + 3);
        expect(Math.hypot(o[0] as number, o[1] as number, o[2] as number) > 0).toBe(!inside);
      }
    }
    expect(rims[25]).toBe(1);
    // The far face of a thin wall is no neighbour: two sheets 1.6 mm apart keep their rims.
    const sheets: ResidueCellData = {
      ...cells,
      count: 2,
      centre: Float32Array.from([0, 0.05, 0, 0, 0.05, -0.0016]),
      normal: Float32Array.from([0, 0, 1, 0, 0, -1]),
      areaMm2: new Float32Array(2).fill(4),
      fraction: new Float32Array(2).fill(0.6),
      visible: new Uint8Array(2).fill(1),
    };
    expect([...residueTiles(sheets).rimmed]).toEqual([1, 1]);
  });

  it('reads the grid off the cells: a tile is as wide and as deep as its cell, turned as the grid lies', () => {
    // Cells 1 mm wide and 4 mm deep (4 mm2) in a grid turned 30 degrees on a flat face.
    const cos = Math.cos(Math.PI / 6);
    const sin = Math.sin(Math.PI / 6);
    const centre: number[] = [];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        const u = 0.001 * i;
        const v = 0.004 * j;
        centre.push(0.05 + u * cos - v * sin, 0.02 + u * sin + v * cos, 0.003);
      }
    }
    const count = centre.length / 3;
    const cells: ResidueCellData = {
      count,
      centre: Float32Array.from(centre),
      normal: Float32Array.from(Array.from({ length: count }, () => [0, 0, 1]).flat()),
      areaMm2: new Float32Array(count).fill(4),
      soils: ['gravy'],
      fraction: new Float32Array(count).fill(0.6),
      visible: new Uint8Array(count).fill(1),
    };
    const tiles = residueTiles(cells);
    expect(tiles.count).toBe(18);
    for (let t = 0; t < tiles.count; t++) {
      const m = tiles.fill.subarray(16 * t, 16 * t + 16);
      const across = new Vector3(m[0], m[1], m[2]);
      const along = new Vector3(m[4], m[5], m[6]);
      // 1 mm across and 4 mm along, each with the overlap: the tiles close the grid.
      expect(across.length()).toBeCloseTo(0.001 * TILE_OVERLAP, 6);
      expect(along.length()).toBeCloseTo(0.004 * TILE_OVERLAP, 6);
      // Turned as the grid is: the short side along the grid's first axis, either way.
      expect(
        Math.abs(
          across
            .clone()
            .normalize()
            .dot(new Vector3(cos, sin, 0)),
        ),
      ).toBeCloseTo(1, 5);
      expect(across.clone().cross(along).normalize().z).toBeCloseTo(1, 6);
    }
    // The cells that are not drawn still show how the grid lies: with only every other cell
    // visible the tiles keep their size.
    const sparse = residueTiles({
      ...cells,
      visible: Uint8Array.from(Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 1 : 0))),
    });
    expect(sparse.count).toBe(9);
    expect(new Vector3(sparse.fill[0], sparse.fill[1], sparse.fill[2]).length()).toBeCloseTo(
      0.001 * TILE_OVERLAP,
      6,
    );
  });

  it('draws traces only on request, as dots without a rim in the lightest step', () => {
    const cells = mugCells(24);
    const all = residueTiles(cells, { traces: true });
    expect(all.count).toBe(24);
    let traces = 0;
    for (let t = 0; t < all.count; t++) {
      const cell = all.cell[t] as number;
      if (cells.visible[cell] === 1) continue;
      traces += 1;
      const m = all.fill.subarray(16 * t, 16 * t + 16);
      expect(new Vector3(m[0], m[1], m[2]).length()).toBeCloseTo(0.002 * TRACE_DOT, 7);
      const o = all.outline.subarray(16 * t, 16 * t + 16);
      expect(new Vector3(o[0], o[1], o[2]).length()).toBe(0);
      expect([...all.colour.subarray(3 * t, 3 * t + 3)]).toEqual(
        [...(RESIDUE_STEPS[0]?.colour ?? [])].map((v) => Math.fround(v)),
      );
    }
    expect(traces).toBe(8);
  });

  it('colours by one soil when asked, and leaves out the cells that soil has left', () => {
    const cells = mugCells(24);
    const milk = residueTiles(cells, { soil: 1, traces: true });
    // Milk film is left on every fourth cell only.
    expect(milk.count).toBe(6);
    for (let t = 0; t < milk.count; t++) {
      expect((milk.cell[t] as number) % 4).toBe(0);
      expect(milk.fraction[t]).toBeCloseTo(0.9, 6);
    }
    expect(residueTiles(cells, { soil: 5 }).count).toBe(0);
  });

  it('has a frame for a cell on the axis and for a normal along the axis', () => {
    const cells: ResidueCellData = {
      count: 3,
      centre: Float32Array.from([0, 0, 0.004, 0.05, 0, 0.004, 0, 0.05, 0.02]),
      normal: Float32Array.from([0, 0, 1, 0, 0, -1, 0, 1, 0]),
      areaMm2: Float32Array.from([4, 4, 4]),
      soils: ['gravy'],
      fraction: Float32Array.from([1, 0.5, 0.2]),
      visible: Uint8Array.from([1, 1, 1]),
    };
    const tiles = residueTiles(cells);
    expect(tiles.count).toBe(3);
    for (const value of tiles.fill) expect(Number.isFinite(value)).toBe(true);
    for (let t = 0; t < 3; t++) {
      const m = tiles.fill.subarray(16 * t, 16 * t + 16);
      const tx = new Vector3(m[0], m[1], m[2]);
      const ty = new Vector3(m[4], m[5], m[6]);
      const n = new Vector3(m[8], m[9], m[10]);
      expect(tx.clone().cross(ty).normalize().dot(n)).toBeCloseTo(1, 6);
    }
  });

  it('sums a map for a legend', () => {
    const cells = mugCells(24);
    const summary = summariseResidue(cells);
    expect(summary.visibleCells).toBe(16);
    expect(summary.traceCells).toBe(8);
    expect(summary.visibleAreaMm2).toBeCloseTo(64, 6);
    expect(summary.areaByStepMm2.reduce((sum, a) => sum + a, 0)).toBeCloseTo(64, 6);
    expect(summary.areaByStepMm2).toHaveLength(RESIDUE_STEPS.length);
  });
});

describe('residue on an item of the scene', () => {
  it('draws the tiles as instances in the item frame, coloured as the scale says', () => {
    const tiles = residueTiles(mugCells(24));
    const residue = buildResidueObject(tiles, RESIDUE_OUTLINE_DARK);
    expect(residue.object.name).toBe(RESIDUE_OBJECT_NAME);
    expect(residue.tiles).toBe(16);
    const [rims, fills] = residue.object.children as InstancedMesh[];
    expect(rims?.count).toBe(16);
    expect(fills?.count).toBe(16);
    const matrix = new Matrix4();
    fills?.getMatrixAt(3, matrix);
    expect(matrix.elements[12]).toBeCloseTo(tiles.fill[16 * 3 + 12] as number, 9);
    expect(fills?.instanceColor?.count).toBe(16);
    // Unlit and one-sided: the legend's colour, seen from the side of the wall it lies on.
    const material = fills?.material as { toneMapped: boolean; side: number; type: string };
    expect(material.type).toBe('MeshBasicMaterial');
    expect(material.toneMapped).toBe(false);
    expect(material.side).toBe(0);
    residue.dispose();
    expect(buildResidueObject(residueTiles(mugCells(0)), RESIDUE_OUTLINE_DARK).tiles).toBe(0);
  });

  it('paints them on the item where the item stands, and keeps them when the item is redrawn', () => {
    const instance = instantiate('mug_ceramic_300');
    const scene = new SpotlessScene({ floor: false });
    scene.addItemTypes([
      {
        item_type: 'mug_ceramic_300',
        material: bodyMaterialOf(instance.type),
        shape: instance.shape,
      },
    ]);
    scene.setItem('mug_01', 'mug_ceramic_300', new Map());
    // Upside down in the lower basket: turned half a turn about x.
    const pose = { position_mm: [120, -80, 310] as const, quat_wxyz: [0, 1, 0, 0] as const };
    scene.setItemPoses({ mug_01: pose });
    const cells = mugCells(24);
    scene.setItemResidue('mug_01', residueTiles(cells));
    expect(scene.itemsWithResidue()).toEqual(['mug_01']);
    const drawn = scene.residueTilePositions('mug_01');
    if (drawn === null) throw new Error('nothing drawn');
    expect(drawn.cell).toHaveLength(16);
    for (let t = 0; t < drawn.cell.length; t++) {
      const cell = drawn.cell[t] as number;
      // The item frame turned half a turn about x and moved: (x, -y, -z) + position.
      const lift = TILE_LIFT;
      const x = (cells.centre[3 * cell] as number) + (cells.normal[3 * cell] as number) * lift;
      const y =
        (cells.centre[3 * cell + 1] as number) + (cells.normal[3 * cell + 1] as number) * lift;
      const z = cells.centre[3 * cell + 2] as number;
      expect(drawn.position[3 * t]).toBeCloseTo(0.12 + x, 6);
      expect(drawn.position[3 * t + 1]).toBeCloseTo(-0.08 - y, 6);
      expect(drawn.position[3 * t + 2]).toBeCloseTo(0.31 - z, 6);
    }
    // Declaring the item again (other soil layers) keeps the residue on it.
    scene.setItem('mug_01', 'mug_ceramic_300', new Map());
    expect(scene.residueTilePositions('mug_01')?.position[0]).toBeCloseTo(
      drawn.position[0] as number,
      9,
    );
    // Null takes it off; a new level forgets it.
    scene.setItemResidue('mug_01', null);
    expect(scene.residueTilePositions('mug_01')).toBeNull();
    scene.setItemResidue('mug_01', residueTiles(cells));
    scene.clearItems();
    expect(scene.itemsWithResidue()).toEqual([]);
    scene.dispose();
  });

  it('puts synthetic cells of the mug wall on the mug: the frame of the map is the frame of the mesh', () => {
    // Cells generated on the real shape (points of its inner wall found by the kernel's
    // distance function) stay on it through packing-free tiles: a check of the item frame.
    const shape = instantiate('mug_ceramic_300').shape;
    const centre: number[] = [];
    const normal: number[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (2 * Math.PI * i) / 12 + 0.3;
      // March outwards from the axis at mid height until the wall is met.
      let r = 0.005;
      while (
        r < 0.08 &&
        signedDistance(shape, [r * Math.cos(angle), r * Math.sin(angle), 0.05]) > 0
      ) {
        r += 0.0002;
      }
      if (r >= 0.08) continue;
      centre.push(r * Math.cos(angle), r * Math.sin(angle), 0.05);
      normal.push(-Math.cos(angle), -Math.sin(angle), 0);
    }
    const count = centre.length / 3;
    expect(count).toBeGreaterThan(6);
    const tiles = residueTiles({
      count,
      centre: Float32Array.from(centre),
      normal: Float32Array.from(normal),
      areaMm2: new Float32Array(count).fill(4),
      soils: ['coffee'],
      fraction: new Float32Array(count).fill(0.6),
      visible: new Uint8Array(count).fill(1),
    });
    for (let t = 0; t < tiles.count; t++) {
      const p: [number, number, number] = [
        tiles.fill[16 * t + 12] as number,
        tiles.fill[16 * t + 13] as number,
        tiles.fill[16 * t + 14] as number,
      ];
      // On the wall, and just off it on the side the normal points to (the inside of the mug).
      const d = signedDistance(shape, p);
      expect(Math.abs(d)).toBeLessThan(0.0005);
      expect(d).toBeGreaterThan(-0.0003);
    }
  });
});
