// The atlas of a shape (docs/design/sim-core.md sections 3.1 to 3.3 and M3 "Tests", in the
// first-build form of the scene brief): block areas against the analytic areas of the geometry
// kernel, normals against its signed-distance gradient, the cell table and the links.
import {
  primitiveSurfaceArea,
  signedDistance,
  signedDistanceGradient,
  surfaceArea,
  surfaceRegionAt,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import {
  ATLAS_BLOCK_FLAG,
  LINK_KIND,
  NO_INDEX,
  PATCH_KIND,
  type AtlasPatch,
} from './atlas-core.ts';
import { buildShapeAtlas, DEFAULT_BURIED_DEPTH } from './atlas.ts';
import { atlasTriangles } from './atlas-triangles.ts';
import { locateOnPart } from './locate.ts';
import { instantiate, usableItemTypeIds } from './testing/catalogue.ts';
import { exposedAreaByPart } from './testing/reference.ts';
import { atlasOptions, cellPoint, PRIMITIVES, singlePart } from './testing/shapes.ts';

const names = Object.keys(PRIMITIVES);

describe.each([0.002, 0.004])('atlas of every kind of primitive at %f m blocks', (blockSize) => {
  const atlases = names.map((name) => {
    const shape = singlePart(PRIMITIVES[name] as NonNullable<(typeof PRIMITIVES)[string]>);
    return { name, shape, atlas: buildShapeAtlas(shape, atlasOptions(blockSize)) };
  });

  it.each(atlases)(
    '$name: the block areas sum to the analytic area within 1 %',
    ({ shape, atlas }) => {
      const prim = (shape.parts[0] as { prim: Parameters<typeof primitiveSurfaceArea>[0] }).prim;
      const exact = primitiveSurfaceArea(prim);
      let sum = 0;
      for (let b = 0; b < atlas.blockCount; b++) sum += atlas.area[b] as number;
      // Exact to rounding for round shells, capsules and polytopes; the 1 % of the brief is needed
      // only by the stretched shell, whose cells are integrated numerically.
      expect(Math.abs(sum - exact) / exact).toBeLessThan(
        prim.kind === 'sor' && prim.scaleXY ? 0.01 : 1e-9,
      );
      expect(Math.abs(sum - surfaceArea(shape)) / exact).toBeLessThan(0.01);
      expect(atlas.unsupported).toEqual([]);
    },
  );

  it.each(atlases)('$name: no more blocks than 1.5 x area / block size squared', ({ atlas }) => {
    let sum = 0;
    for (let b = 0; b < atlas.blockCount; b++) sum += atlas.area[b] as number;
    const size = atlas.blockSize;
    // A line element is 1.5 blocks long and carries its circumference, so it is counted by length.
    const lines = atlas.patches.every((p) => p.line);
    if (!lines)
      expect(atlas.blockCount).toBeLessThanOrEqual(Math.max(8, (1.5 * sum) / (size * size)));
    expect(atlas.blockCount).toBeGreaterThan(0);
  });

  it.each(atlases)(
    '$name: normals are unit and agree with the signed-distance gradient',
    ({ shape, atlas }) => {
      for (let b = 0; b < atlas.blockCount; b++) {
        const c: [number, number, number] = [
          atlas.centre[3 * b] as number,
          atlas.centre[3 * b + 1] as number,
          atlas.centre[3 * b + 2] as number,
        ];
        const n: [number, number, number] = [
          atlas.normal[3 * b] as number,
          atlas.normal[3 * b + 1] as number,
          atlas.normal[3 * b + 2] as number,
        ];
        expect(Math.abs(Math.hypot(n[0], n[1], n[2]) - 1)).toBeLessThan(1e-12);
        const patch = atlas.patches[atlas.blockPatch[b] as number] as AtlasPatch;
        if (((atlas.blockFlags[b] as number) & ATLAS_BLOCK_FLAG.line) !== 0) {
          // A line element: the centre is on the axis, the normal across it.
          expect(Math.abs(signedDistance(shape, c) + patch.radius)).toBeLessThan(1e-9);
          const out: [number, number, number] = [
            c[0] + (patch.radius + 1e-5) * n[0],
            c[1] + (patch.radius + 1e-5) * n[1],
            c[2] + (patch.radius + 1e-5) * n[2],
          ];
          // On the cylinder of the wire (not on an end cap) the gradient is the direction across.
          if (
            patch.length > 0 &&
            patch.rowCount > 2 &&
            atlas.blockRow[b] !== patch.rowStart &&
            atlas.blockRow[b] !== patch.rowStart + patch.rowCount - 1
          ) {
            const g = signedDistanceGradient(shape, out);
            expect(g[0] * n[0] + g[1] * n[1] + g[2] * n[2]).toBeGreaterThan(1 - 1e-9);
          }
          continue;
        }
        // The centre is on the surface, and the gradient just off it is the stored normal.
        expect(Math.abs(signedDistance(shape, c))).toBeLessThan(1e-9);
        const g = signedDistanceGradient(shape, [
          c[0] + 1e-6 * n[0],
          c[1] + 1e-6 * n[1],
          c[2] + 1e-6 * n[2],
        ]);
        expect(g[0] * n[0] + g[1] * n[1] + g[2] * n[2]).toBeGreaterThan(1 - 1e-6);
      }
    },
  );

  it.each(atlases)(
    '$name: every row carries the region the geometry kernel assigns there',
    ({ shape, atlas }) => {
      let checked = 0;
      for (let b = 0; b < atlas.blockCount; b += 7) {
        const c: [number, number, number] = [
          atlas.centre[3 * b] as number,
          atlas.centre[3 * b + 1] as number,
          atlas.centre[3 * b + 2] as number,
        ];
        const n = [
          atlas.normal[3 * b] as number,
          atlas.normal[3 * b + 1] as number,
          atlas.normal[3 * b + 2] as number,
        ];
        const patch = atlas.patches[atlas.blockPatch[b] as number] as AtlasPatch;
        // Just off the surface: a line element has its centre on the axis, a radius below it.
        const off = patch.line ? patch.radius + 1e-7 : 1e-7;
        const expected = surfaceRegionAt(shape, [
          c[0] + off * (n[0] as number),
          c[1] + off * (n[1] as number),
          c[2] + off * (n[2] as number),
        ]);
        // The apex of a rim, where 'in' meets 'out', and the rounded edge of a polytope are decided
        // per row and per face; everywhere else the two must agree.
        const stored = atlas.rowRegion[atlas.blockRow[b] as number] as number;
        if (stored !== expected) {
          expect(patch.kind === PATCH_KIND.rev || patch.kind === PATCH_KIND.cart).toBe(true);
          continue;
        }
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    },
  );

  it.each(atlases)(
    '$name: every cell maps to a block, and a point of a cell to the block of that cell',
    ({ atlas }) => {
      for (let c = 0; c < atlas.cellCount; c++) expect(atlas.cellBlock[c]).not.toBe(NO_INDEX);
      let checked = 0;
      atlas.patches.forEach((patch, p) => {
        for (let row = 0; row < patch.rowCount; row += 3) {
          const first = atlas.rows[2 * (patch.rowStart + row)] as number;
          const cols = atlas.rows[2 * (patch.rowStart + row) + 1] as number;
          for (let col = 0; col < cols; col += 2) {
            for (const [fa, fb] of [
              [0.5, 0.5],
              [0.13, 0.81],
              [0.92, 0.07],
            ] as const) {
              const point = cellPoint(atlas, p, row, col, fa, fb);
              if (point === null) continue;
              const where = locateOnPart(atlas, patch.part, point.p, point.n);
              expect(where).not.toBeNull();
              expect(where?.cell).toBe(first + col);
              expect(where?.block).toBe(atlas.cellBlock[first + col]);
              checked++;
            }
          }
        }
      });
      expect(checked).toBeGreaterThan(2);
    },
  );

  it.each(atlases)(
    '$name: links join distinct blocks once, with a positive shared edge',
    ({ atlas }) => {
      const seen = new Set<number>();
      for (let k = 0; k < atlas.linkA.length; k++) {
        const a = atlas.linkA[k] as number;
        const b = atlas.linkB[k] as number;
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(atlas.blockCount);
        expect(atlas.linkLength[k]).toBeGreaterThan(0);
        const key = a * atlas.blockCount + b;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      // One part: every block can be reached from block 0 (faces of a polytope through its seams).
      const next: number[][] = Array.from({ length: atlas.blockCount }, () => []);
      for (let k = 0; k < atlas.linkA.length; k++) {
        (next[atlas.linkA[k] as number] as number[]).push(atlas.linkB[k] as number);
        (next[atlas.linkB[k] as number] as number[]).push(atlas.linkA[k] as number);
      }
      const reached = new Uint8Array(atlas.blockCount);
      const queue = [0];
      reached[0] = 1;
      for (let head = 0; head < queue.length; head++) {
        for (const other of next[queue[head] as number] as number[]) {
          if (reached[other] === 0) {
            reached[other] = 1;
            queue.push(other);
          }
        }
      }
      expect(queue.length).toBe(atlas.blockCount);
    },
  );

  it.each(atlases)(
    '$name: every triangle of the ray mesh lies on its analytic piece',
    ({ atlas }) => {
      const triangles = atlasTriangles(atlas, 0.05e-3);
      expect(triangles.count).toBeGreaterThan(0);
      expect(triangles.unclassified).toBe(0);
    },
  );
});

describe('the two faces of a shell', () => {
  const shape = singlePart(PRIMITIVES['bowl'] as NonNullable<(typeof PRIMITIVES)[string]>);
  const atlas = buildShapeAtlas(shape, atlasOptions(0.002));

  it('are one grid: the outer face reaches the inner face through the rim, inside one patch', () => {
    expect(atlas.patches).toHaveLength(1);
    const inside = shape.regions.findIndex((r) => r.id === 'inside');
    const outside = shape.regions.findIndex((r) => r.id === 'outside');
    const regionOf = (b: number): number => atlas.rowRegion[atlas.blockRow[b] as number] as number;
    let start = -1;
    let goal = -1;
    for (let b = 0; b < atlas.blockCount; b++) {
      if (start < 0 && regionOf(b) === outside) start = b;
      if (regionOf(b) === inside) goal = b;
    }
    expect(start).toBeGreaterThanOrEqual(0);
    expect(goal).toBeGreaterThanOrEqual(0);
    // Breadth first over links inside the patch only, counting how often the side changes.
    const next: number[][] = Array.from({ length: atlas.blockCount }, () => []);
    let rimLinks = 0;
    for (let k = 0; k < atlas.linkA.length; k++) {
      expect(atlas.linkKind[k]).toBe(LINK_KIND.patch);
      const a = atlas.linkA[k] as number;
      const b = atlas.linkB[k] as number;
      (next[a] as number[]).push(b);
      (next[b] as number[]).push(a);
      if (regionOf(a) !== regionOf(b)) rimLinks++;
    }
    const reached = new Uint8Array(atlas.blockCount);
    const queue = [start];
    reached[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      for (const other of next[queue[head] as number] as number[]) {
        if (reached[other] === 0) {
          reached[other] = 1;
          queue.push(other);
        }
      }
    }
    expect(reached[goal]).toBe(1);
    // The sides meet along one ring of the rim: about a rim circumference of links, 2 mm apart.
    const rimCircumference = 2 * Math.PI * 0.06;
    expect(rimLinks).toBeGreaterThan(rimCircumference / 0.002 / 2);
    expect(rimLinks).toBeLessThan((3 * rimCircumference) / 0.002);
  });

  it('have cells about as wide as they are long in every row', () => {
    const patch = atlas.patches[0] as AtlasPatch;
    for (let row = 1; row < patch.rowCount - 1; row++) {
      const first = atlas.rows[2 * row] as number;
      const cols = atlas.rows[2 * row + 1] as number;
      const block = atlas.cellBlock[first] as number;
      const width = (atlas.area[block] as number) / patch.da;
      expect(cols).toBeGreaterThanOrEqual(3);
      // Width over length between 0.5 and 2 away from the two poles.
      if (cols > 6) {
        expect(width / patch.da).toBeGreaterThan(0.5);
        expect(width / patch.da).toBeLessThan(2);
      }
    }
  });
});

describe('parts of one item', () => {
  it('a handle root buried in a mug wall is masked out, and the handle is stitched to the body', () => {
    const shape = instantiate('mug_ceramic_300').shape;
    const atlas = buildShapeAtlas(shape, atlasOptions(0.002));
    // Cells without area of their own or buried: fewer blocks than cells, less area than the parts.
    expect(atlas.blockCount).toBeLessThan(atlas.cellCount);
    let live = 0;
    for (let b = 0; b < atlas.blockCount; b++) {
      live += atlas.area[b] as number;
      // No live block has its centre inside another part (beyond the buried depth of 5 um).
      const c: [number, number, number] = [
        atlas.centre[3 * b] as number,
        atlas.centre[3 * b + 1] as number,
        atlas.centre[3 * b + 2] as number,
      ];
      expect(signedDistance(shape, c)).toBeGreaterThan(-DEFAULT_BURIED_DEPTH - 1e-9);
    }
    const gross = atlas.partArea.reduce((sum, a) => sum + a, 0);
    expect(live).toBeLessThan(gross);
    expect(live).toBeGreaterThan(0.9 * gross);
    // Stitches join blocks of different parts, and with them the whole mug is one graph.
    let stitches = 0;
    const next: number[][] = Array.from({ length: atlas.blockCount }, () => []);
    for (let k = 0; k < atlas.linkA.length; k++) {
      const a = atlas.linkA[k] as number;
      const b = atlas.linkB[k] as number;
      (next[a] as number[]).push(b);
      (next[b] as number[]).push(a);
      if (atlas.linkKind[k] === LINK_KIND.stitch) {
        stitches++;
        expect(atlas.blockPart[a]).not.toBe(atlas.blockPart[b]);
      }
    }
    expect(stitches).toBeGreaterThan(10);
    const reached = new Uint8Array(atlas.blockCount);
    const queue = [0];
    reached[0] = 1;
    for (let head = 0; head < queue.length; head++) {
      for (const other of next[queue[head] as number] as number[]) {
        if (reached[other] === 0) {
          reached[other] = 1;
          queue.push(other);
        }
      }
    }
    expect(queue.length).toBe(atlas.blockCount);
  });

  it.each([
    // Handle segments (rounded boxes of no thickness, shells of revolution) whose ends lie in
    // the wall of the mug and in each other.
    ['mug_glass_240', 'handle'],
    // Handle and tine segments (rounded hulls) that overlap end to end.
    // (bench/review-check.ts runs the same comparison over more items.)
    ['dinner_fork_185', 'handle.'],
  ])(
    '%s: the live area of every half-buried part is its exposed area, by the kernel alone',
    (id, prefix) => {
      // Independent of the atlas: the kernel's render mesh cut into 0.5 mm pieces, a piece
      // counted when no other part's signed distance puts it inside. Counting pieces that are
      // clear of the other parts by 0.2 mm, and pieces up to 0.2 mm inside one, brackets the
      // answer. (Before the rounded ends were tested for being buried, every polytope part kept
      // its whole area: the mug's handle.0 6.7 cm2 against 3.7 cm2 exposed.)
      const shape = instantiate(id).shape;
      const wanted = (part: number): boolean =>
        (shape.parts[part] as { id: string }).id.startsWith(prefix);
      const [mid, low, high] = exposedAreaByPart(shape, [0, 0.2e-3, -0.2e-3], wanted, 0.5e-3) as [
        Float64Array,
        Float64Array,
        Float64Array,
      ];
      for (const blockSize of [0.002, 0.004]) {
        const atlas = buildShapeAtlas(shape, atlasOptions(blockSize));
        const live = new Float64Array(shape.parts.length);
        for (let b = 0; b < atlas.blockCount; b++) {
          const part = atlas.blockPart[b] as number;
          live[part] = (live[part] as number) + (atlas.area[b] as number);
        }
        let sumLive = 0;
        let sumMid = 0;
        let buried = 0;
        shape.parts.forEach((part, index) => {
          if (!wanted(index)) return;
          const label = `${id} ${part.id} at ${blockSize}`;
          // Within the bracket widened by 3 %, and within 8 % of the middle estimate (masking
          // is decided per cell centre and per piece of rounded edge, so a part of a few cm2
          // is a few cells out).
          expect(live[index] as number, label).toBeGreaterThan(0.97 * (low[index] as number));
          expect(live[index] as number, label).toBeLessThan(1.03 * (high[index] as number));
          expect(
            Math.abs((live[index] as number) - (mid[index] as number)) / (mid[index] as number),
            label,
          ).toBeLessThan(0.08);
          sumLive += live[index] as number;
          sumMid += mid[index] as number;
          if ((mid[index] as number) < 0.9 * (atlas.partArea[index] as number)) buried++;
        });
        expect(Math.abs(sumLive - sumMid) / sumMid, `${id} at ${blockSize}`).toBeLessThan(0.04);
        // The check is not vacuous: parts with more than a tenth of their area buried exist.
        expect(buried, id).toBeGreaterThan(1);
      }
    },
  );

  it('a stem that dips into a foot keeps no block inside the foot', () => {
    // The end cap of a wine glass stem lies about 0.1 mm inside the foot: buried, though less
    // deep than the 0.2 mm that used to be allowed.
    const shape = instantiate('wine_glass_red_540').shape;
    const atlas = buildShapeAtlas(shape, atlasOptions(0.002));
    let deepest = 0;
    for (let b = 0; b < atlas.blockCount; b++) {
      if (((atlas.blockFlags[b] as number) & ATLAS_BLOCK_FLAG.line) !== 0) continue;
      deepest = Math.min(
        deepest,
        signedDistance(shape, [
          atlas.centre[3 * b] as number,
          atlas.centre[3 * b + 1] as number,
          atlas.centre[3 * b + 2] as number,
        ]),
      );
    }
    expect(deepest).toBeGreaterThan(-DEFAULT_BURIED_DEPTH - 1e-9);
  });

  it('wires that cross or continue each other are stitched; wires apart are not', () => {
    const wire = (id: string, a: [number, number, number], b: [number, number, number]) => ({
      id,
      prim: { kind: 'capsule' as const, a, b, radius: 0.002 },
      pose: {
        p: [0, 0, 0] as [number, number, number],
        q: [0, 0, 0, 1] as [number, number, number, number],
      },
      material: 'test',
    });
    const shape = {
      parts: [
        wire('rail', [0, 0, 0], [0.1, 0, 0]),
        wire('tine', [0.05, 0, 0], [0.05, 0, 0.06]),
        wire('next', [0.1, 0, 0], [0.1, 0.05, 0]),
        wire('apart', [0, 0.008, 0], [0.09, 0.008, 0]),
      ],
      regions: [{ id: 'wire', part: '*' }],
    };
    const atlas = buildShapeAtlas(shape, atlasOptions(0.002));
    const joined = new Set<string>();
    for (let k = 0; k < atlas.linkA.length; k++) {
      if (atlas.linkKind[k] !== LINK_KIND.stitch) continue;
      const pa = shape.parts[atlas.blockPart[atlas.linkA[k] as number] as number]?.id ?? '';
      const pb = shape.parts[atlas.blockPart[atlas.linkB[k] as number] as number]?.id ?? '';
      joined.add([pa, pb].sort().join('+'));
    }
    expect([...joined].sort()).toEqual(['next+rail', 'rail+tine']);
  });
});

describe('every catalogue item', () => {
  it('has, per part, cells whose areas sum to the analytic area of the primitive within 1 %', () => {
    let parts = 0;
    const ids = usableItemTypeIds();
    expect(ids.length).toBeGreaterThan(90);
    for (const id of ids) {
      const type = { id };
      const shape = instantiate(type.id).shape;
      const atlas = buildShapeAtlas(shape, atlasOptions(0.004));
      expect(atlas.unsupported, type.id).toEqual([]);
      shape.parts.forEach((part, index) => {
        const exact = primitiveSurfaceArea(part.prim);
        expect(
          Math.abs((atlas.partArea[index] as number) - exact) / exact,
          `${type.id} ${part.id}`,
        ).toBeLessThan(0.01);
        parts++;
      });
      // Every region of the shape receives at least one block (regions may overlap: a block
      // lies in every region of its set, and its first region is the first of the set).
      const regions = new Set<number>();
      let live = 0;
      let firstRegionWrong = 0;
      let worstQuarters = 0;
      for (let b = 0; b < atlas.blockCount; b++) {
        const row = atlas.blockRow[b] as number;
        const set = atlas.regionSets[atlas.rowRegionSet[row] as number] as readonly number[];
        if (atlas.rowRegion[row] !== (set[0] ?? -1)) firstRegionWrong++;
        for (const r of set) regions.add(r);
        live += atlas.area[b] as number;
        // The quarters of a block of a planar face carry its area.
        const patch = atlas.patches[atlas.blockPatch[b] as number] as AtlasPatch;
        if (patch.kind === PATCH_KIND.cart) {
          let quarters = 0;
          for (let q = 0; q < 4; q++) quarters += atlas.quarterArea[4 * b + q] as number;
          worstQuarters = Math.max(
            worstQuarters,
            Math.abs(quarters - (atlas.area[b] as number)) / (atlas.area[b] as number),
          );
        }
      }
      expect(firstRegionWrong, type.id).toBe(0);
      expect(worstQuarters, type.id).toBeLessThan(1e-9);
      const ids = new Set([...regions].map((r) => shape.regions[r]?.id));
      for (const region of shape.regions)
        expect(ids.has(region.id), `${type.id} region ${region.id}`).toBe(true);
      // What is live is never more than what there is.
      const gross = atlas.partArea.reduce((sum, a) => sum + a, 0);
      expect(live, type.id).toBeLessThan(gross * (1 + 1e-9));
      // Every cell is stood for by a block, so a ray that strikes any triangle names one: also
      // on a face whose every cell centre is dead.
      for (let c = 0; c < atlas.cellCount; c++) {
        if (atlas.cellBlock[c] === NO_INDEX) throw new Error(`${type.id}: cell ${c} has no block`);
      }
    }
    expect(parts).toBeGreaterThan(300);
  }, 60_000);
});
