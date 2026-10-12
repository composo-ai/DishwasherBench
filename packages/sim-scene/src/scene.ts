/**
 * `buildWashScene`: the simulation's view of a loaded machine (the scene brief;
 * docs/design/sim-core.md section 3 and module M3 in their first-build form).
 *
 * From the shapes of the machine and of the loaded items, with their poses, it produces
 * 1. the surface elements (blocks) of every shape in the tub frame, with normal, area, part,
 *    region, material, gravity along the surface and tilt, and four soil cells on every block
 *    of a region that carries soil;
 * 2. the cell graph: neighbours with the length of the shared edge, seams and stitches, the
 *    drip target of every block water falls from, and the contacts and near-contacts between
 *    different instances;
 * 3. the ray queries: a triangle hierarchy with every hit corrected to the analytic surface;
 * 4. the basins of upward-facing bodies of revolution.
 *
 * The work that depends on a shape alone (its atlas, its triangles) is cached per `Shape`
 * object, so the items of one type in a load share it.
 *
 * Determinism: the result is a pure function of the input. Items are taken in the order of
 * their ids, machine parts in the order given; no clock is read (a benchmark passes `onStage`),
 * and no iteration order of a Map or Set reaches the output.
 *
 * Units: SI. Frame: tub frame.
 */

import { POSE_IDENTITY } from '@spotless/core';
import { boundingBox, type Aabb, type Part, type Shape } from '@spotless/geometry';
import {
  affineFromPose,
  affineInverseRigid,
  affineMul,
  affinePoint,
  affineVector,
  type Affine,
} from './affine.ts';
import {
  ATLAS_BLOCK_FLAG,
  NO_INDEX,
  PATCH_KIND,
  SURF_KIND,
  type AtlasPatch,
  type AtlasSurf,
} from './atlas-core.ts';
import { atlasTriangles } from './atlas-triangles.ts';
import {
  buildShapeAtlas,
  DEFAULT_BURIED_DEPTH,
  type AtlasOptions,
  type ShapeAtlasBuilt,
} from './atlas.ts';
import { findBasins } from './basins.ts';
import { findFloodBasins } from './basins-flood.ts';
import { buildBvh, BVH_NODE_BYTES } from './bvh.ts';
import { createMeridianPoint, meridianArea, meridianAt, type MeridianRun } from './meridian.ts';
import { NearestPoints } from './nearest.ts';
import { resolveSceneParams } from './params.ts';
import type { InstanceBuild, SceneBuild } from './scene-internal.ts';
import { findContacts, findDrips } from './scene-links.ts';
import {
  BLOCK_FLAG,
  SCENE_NONE,
  type SceneBlocks,
  type SceneGraph,
  type SceneInstance,
  type SceneMachineRole,
  type SceneMaterial,
  type ScenePart,
  type ScenePatch,
  type SceneSoilCells,
  type WashScene,
  type WashSceneInput,
} from './scene-types.ts';
import { CpuTracer } from './trace-cpu.ts';
import { MAX_TRACE_ROOTS, TRACE_NUMERICS, type TraceData, type TraceRoot } from './trace-data.ts';

const atlasCache = new WeakMap<Shape, Map<string, ShapeAtlasBuilt>>();

/** The atlas of a shape for the given options, built once per `Shape` object and options. */
export function cachedShapeAtlas(shape: Shape, options: AtlasOptions): ShapeAtlasBuilt {
  let perShape = atlasCache.get(shape);
  if (perShape === undefined) {
    perShape = new Map();
    atlasCache.set(shape, perShape);
  }
  const key = [
    options.blockSize,
    options.lineLength,
    options.lineMaxRadius,
    options.cutMerge,
    options.deadDepth,
    options.buriedDepth ?? DEFAULT_BURIED_DEPTH,
    options.stitchReach,
    options.wireTouchGap,
  ].join('|');
  let atlas = perShape.get(key);
  if (atlas === undefined) {
    atlas = buildShapeAtlas(shape, options);
    perShape.set(key, atlas);
  }
  return atlas;
}

/** The distinct frames of an atlas and which of them each surf and each patch uses. */
interface AtlasFrames {
  readonly frames: readonly Affine[];
  readonly surfFrame: Uint32Array;
  readonly patchFrame: Uint32Array;
}

const frameCache = new WeakMap<ShapeAtlasBuilt, AtlasFrames>();

function atlasFrames(atlas: ShapeAtlasBuilt): AtlasFrames {
  let cached = frameCache.get(atlas);
  if (cached === undefined) {
    const index = new Map<Affine, number>();
    const frames: Affine[] = [];
    const indexOf = (frame: Affine): number => {
      let i = index.get(frame);
      if (i === undefined) {
        i = frames.length;
        frames.push(frame);
        index.set(frame, i);
      }
      return i;
    };
    cached = {
      surfFrame: Uint32Array.from(atlas.surfs, (s) => indexOf(s.frame)),
      patchFrame: Uint32Array.from(atlas.patches, (p) => indexOf(p.frame)),
      frames,
    };
    frameCache.set(atlas, cached);
  }
  return cached;
}

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The four quarters of a block: centres in the item frame (three numbers each, into `centres`)
 * and the share of the block's area each carries (into `shares`, summing to 1). Quarter
 * `2 * ha + hb` is the half `ha` along the rows of the patch and the half `hb` along its columns,
 * which is how a ray hit picks its soil cell.
 */
function blockQuarters(
  atlas: ShapeAtlasBuilt,
  block: number,
  centres: Float64Array,
  shares: Float64Array,
): void {
  const patch = atlas.patches[atlas.blockPatch[block] as number] as AtlasPatch;
  const row = atlas.blockRow[block] as number;
  const col = atlas.blockCol[block] as number;
  const i = row - patch.rowStart;
  const cols = atlas.rows[2 * row + 1] as number;
  const put = (q: number, p: readonly number[], share: number): void => {
    centres[3 * q] = p[0] as number;
    centres[3 * q + 1] = p[1] as number;
    centres[3 * q + 2] = p[2] as number;
    shares[q] = share;
  };
  if (patch.line) {
    const ds = patch.length / patch.rowCount;
    for (let q = 0; q < 4; q++) {
      const th = Math.PI * (0.5 + (q & 1));
      const z = (i + 0.25 + 0.5 * (q >> 1)) * ds;
      put(
        q,
        affinePoint(patch.toItem, patch.radius * Math.cos(th), patch.radius * Math.sin(th), z),
        0.25,
      );
    }
    return;
  }
  if (patch.kind === PATCH_KIND.rev) {
    const run = patch.run as MeridianRun;
    const ds = patch.da;
    const dTheta = patch.db / cols;
    const lo = meridianArea(run, i * ds);
    const mid = meridianArea(run, (i + 0.5) * ds);
    const hi = meridianArea(run, (i + 1) * ds);
    const first = hi > lo ? (mid - lo) / (hi - lo) : 0.5;
    const pt = createMeridianPoint();
    for (let q = 0; q < 4; q++) {
      meridianAt(run, (i + 0.25 + 0.5 * (q >> 1)) * ds, pt);
      const th = patch.b0 + (col + 0.25 + 0.5 * (q & 1)) * dTheta;
      put(
        q,
        affinePoint(patch.toItem, pt.r * Math.cos(th), pt.r * Math.sin(th), pt.z),
        0.5 * (q >> 1 === 0 ? first : 1 - first),
      );
    }
    return;
  }
  // A planar face: the atlas has counted the quarters exactly as a ray hit is mapped to them
  // (the flat face, the cells merged into the block, and the exposed rounded edges and corners
  // of a polytope).
  const total = atlas.area[block] as number;
  for (let q = 0; q < 4; q++) {
    const a = atlas.quarterArea[4 * block + q] as number;
    if (a > 0) {
      put(
        q,
        affinePoint(
          patch.toItem,
          atlas.quarterCentre[8 * block + 2 * q] as number,
          atlas.quarterCentre[8 * block + 2 * q + 1] as number,
          0,
        ),
        total > 0 ? a / total : 0.25,
      );
    } else {
      put(
        q,
        [
          atlas.centre[3 * block] as number,
          atlas.centre[3 * block + 1] as number,
          atlas.centre[3 * block + 2] as number,
        ],
        0,
      );
    }
  }
}

/** Builds the scene of a loaded machine. See the file comment. */
export function buildWashScene(input: WashSceneInput): WashScene {
  const stage = input.onStage ?? ((): void => {});
  const params = resolveSceneParams(input.params);
  const D = input.blockSize;
  if (!(D > 0) || !Number.isFinite(D)) throw new RangeError(`sim-scene: block size ${D}`);
  const NONE = SCENE_NONE;

  // ---- instances and their atlases
  stage('atlas');
  const itemOptions: AtlasOptions = {
    blockSize: D,
    lineLength: params.lineElementRatio * D,
    lineMaxRadius: params.lineMaxRadius,
    cutMerge: params.cutMerge,
    deadDepth: params.deadDepth,
    buriedDepth: params.buriedDepth,
    stitchReach: params.stitchReach,
    wireTouchGap: params.wireTouchGap,
  };
  const machineOptions: AtlasOptions = { ...itemOptions, blockSize: params.machineBlockRatio * D };
  // A slender item (cutlery) carries finer blocks: its verdict hangs on areas of a few square
  // millimetres, which whole cells of the other items' size cannot measure.
  const slenderOptions: AtlasOptions = {
    ...itemOptions,
    blockSize: params.slenderBlockRatio * D,
    lineLength: params.lineElementRatio * params.slenderBlockRatio * D,
  };
  const optionsOfItem = (shape: Shape): AtlasOptions => {
    if (!(params.slenderBlockRatio < 1) || !(params.slenderWidth > 0)) return itemOptions;
    const own = boundingBox(shape, POSE_IDENTITY);
    const extents = [
      own.max[0] - own.min[0],
      own.max[1] - own.min[1],
      own.max[2] - own.min[2],
    ].sort((a, b) => a - b);
    return (extents[1] as number) <= params.slenderWidth ? slenderOptions : itemOptions;
  };
  interface Spec {
    id: string;
    kind: 'item' | 'machine';
    typeId: string;
    role: 'item' | SceneMachineRole;
    shape: Shape;
    pose: SceneInstance['pose'];
    rotation: {
      point: readonly [number, number, number];
      axis: readonly [number, number, number];
    } | null;
    enclosure: boolean;
    soiled: ReadonlySet<string>;
    options: AtlasOptions;
  }
  const specs: Spec[] = [];
  for (const item of [...input.items].sort((a, b) => compareIds(a.itemId, b.itemId))) {
    const soiled = new Set<string>();
    const known = new Set(item.shape.regions.map((region) => region.id));
    for (const soil of item.soils) {
      for (const region of soil.regions) {
        // A soil record on a region the shape does not have would otherwise vanish, and the
        // item be scored clean for the wrong reason.
        if (!known.has(region.region)) {
          throw new RangeError(
            `sim-scene: item '${item.itemId}' (${item.typeId}) has soil on region '${region.region}', which its shape does not have (regions: ${[...known].join(', ') || 'none'})`,
          );
        }
        if (region.coverage > 0) soiled.add(region.region);
      }
    }
    specs.push({
      id: item.itemId,
      kind: 'item',
      typeId: item.typeId,
      role: 'item',
      shape: item.shape,
      pose: item.pose,
      rotation: null,
      enclosure: false,
      soiled,
      options: optionsOfItem(item.shape),
    });
  }
  for (const part of input.machine) {
    specs.push({
      id: part.id,
      kind: 'machine',
      typeId: '',
      role: part.role,
      shape: part.shape,
      pose: part.pose,
      rotation:
        part.rotation === undefined
          ? null
          : { point: part.rotation.point, axis: part.rotation.axis },
      enclosure: part.enclosure === true,
      soiled: new Set(),
      options: machineOptions,
    });
  }
  const seen = new Set<string>();
  for (const spec of specs) {
    if (seen.has(spec.id)) throw new RangeError(`sim-scene: duplicate instance id '${spec.id}'`);
    seen.add(spec.id);
  }
  const atlases = specs.map((spec) => cachedShapeAtlas(spec.shape, spec.options));

  // ---- materials
  const materialIds = new Set<string>();
  for (const spec of specs) for (const part of spec.shape.parts) materialIds.add(part.material);
  const materials: SceneMaterial[] = [...materialIds]
    .sort(compareIds)
    .map((id) => input.materials(id));
  const materialIndex = new Map(materials.map((m, i) => [m.id, i]));

  // ---- which blocks of each atlas are kept, and the index spaces
  stage('blocks');
  const builds: InstanceBuild[] = [];
  const parts: ScenePart[] = [];
  const patches: ScenePatch[] = [];
  const unsupported: string[] = [];
  let blockCount = 0;
  const margin = params.deadDepth;
  const chamber = input.chamber;
  let sceneMin: [number, number, number] = [Infinity, Infinity, Infinity];
  let sceneMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  specs.forEach((spec, index) => {
    const atlas = atlases[index] as ShapeAtlasBuilt;
    for (const reason of atlas.unsupported) unsupported.push(`${spec.id}: ${reason}`);
    const toTub = affineFromPose(spec.pose);
    const toItem = affineInverseRigid(toTub);
    const blockOf = new Uint32Array(atlas.blockCount).fill(NONE);
    const local: number[] = [];
    const cull = spec.enclosure && chamber !== undefined;
    for (let b = 0; b < atlas.blockCount; b++) {
      if (cull) {
        const c = affinePoint(
          toTub,
          atlas.centre[3 * b] as number,
          atlas.centre[3 * b + 1] as number,
          atlas.centre[3 * b + 2] as number,
        );
        const box = chamber as Aabb;
        if (
          c[0] < box.min[0] - margin ||
          c[0] > box.max[0] + margin ||
          c[1] < box.min[1] - margin ||
          c[1] > box.max[1] + margin ||
          c[2] < box.min[2] - margin ||
          c[2] > box.max[2] + margin
        ) {
          continue;
        }
      }
      blockOf[b] = blockCount + local.length;
      local.push(b);
    }
    const firstPart = parts.length;
    spec.shape.parts.forEach((part: Part) => {
      parts.push({
        index: parts.length,
        instance: index,
        id: part.id,
        material: materialIndex.get(part.material) as number,
        porosity: part.porosity ?? 0,
      });
    });
    const firstPatch = patches.length;
    // Blocks are numbered patch by patch, so each patch owns a contiguous range.
    const patchFirst = new Array<number>(atlas.patches.length).fill(-1);
    const patchBlocks = new Array<number>(atlas.patches.length).fill(0);
    local.forEach((b, k) => {
      const p = atlas.blockPatch[b] as number;
      if (patchFirst[p] === -1) patchFirst[p] = blockCount + k;
      patchBlocks[p] = (patchBlocks[p] as number) + 1;
    });
    atlas.patches.forEach((patch, p) => {
      const axis = affineVector(toTub, ...affineVector(patch.toItem, 0, 0, 1));
      const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
      patches.push({
        index: patches.length,
        instance: index,
        part: firstPart + patch.part,
        kind: patch.line ? 'line' : patch.kind === PATCH_KIND.rev ? 'rev' : 'cart',
        firstBlock: patchFirst[p] === -1 ? blockCount : (patchFirst[p] as number),
        blockCount: patchBlocks[p] as number,
        radius: patch.radius,
        axis: [axis[0] / len, axis[1] / len, axis[2] / len],
      });
    });
    const box = boundingBox(spec.shape, spec.pose);
    sceneMin = [
      Math.min(sceneMin[0], box.min[0]),
      Math.min(sceneMin[1], box.min[1]),
      Math.min(sceneMin[2], box.min[2]),
    ];
    sceneMax = [
      Math.max(sceneMax[0], box.max[0]),
      Math.max(sceneMax[1], box.max[1]),
      Math.max(sceneMax[2], box.max[2]),
    ];
    builds.push({
      instance: {
        index,
        id: spec.id,
        kind: spec.kind,
        typeId: spec.typeId,
        role: spec.role,
        shape: spec.shape,
        pose: spec.pose,
        rotating: spec.rotation !== null,
        blockSize: spec.options.blockSize,
        firstBlock: blockCount,
        blockCount: local.length,
        firstPatch,
        patchCount: atlas.patches.length,
        firstPart,
        partCount: spec.shape.parts.length,
        box,
      },
      atlas,
      toTub,
      toItem,
      blockOf,
      localOf: Uint32Array.from(local),
    });
    blockCount += local.length;
  });

  // ---- block arrays
  const centre64 = new Float64Array(3 * blockCount);
  const normal64 = new Float64Array(3 * blockCount);
  const blocks = {
    count: blockCount,
    centre: new Float32Array(3 * blockCount),
    normal: new Float32Array(3 * blockCount),
    area: new Float32Array(blockCount),
    instance: new Uint32Array(blockCount),
    patch: new Uint32Array(blockCount),
    part: new Uint32Array(blockCount),
    region: new Int16Array(blockCount),
    material: new Uint16Array(blockCount),
    soilFirst: new Uint32Array(blockCount).fill(NONE),
    gravityDir: new Float32Array(3 * blockCount),
    gravityAlong: new Float32Array(blockCount),
    tilt: new Float32Array(blockCount),
    flags: new Uint8Array(blockCount),
  } satisfies SceneBlocks;
  const g = params.gravity;
  let soilCount = 0;
  let lineBlocks = 0;
  builds.forEach((build, index) => {
    const { atlas, toTub, instance } = build;
    const spec = specs[index] as Spec;
    // Regions may overlap: a block is soiled when any region that holds it carries soil.
    const soiledSet = atlas.regionSets.map((set) =>
      set.some((r) => spec.soiled.has((spec.shape.regions[r] as { id: string }).id)),
    );
    const soiledBlocks = spec.shape.regions.map(() => 0);
    const across = atlas.patches.map((patch) => {
      const v = affineVector(toTub, ...affineVector(patch.toItem, 1, 0, 0));
      const len = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / len, v[1] / len, v[2] / len] as const;
    });
    for (let k = 0; k < build.localOf.length; k++) {
      const b = build.localOf[k] as number;
      const gi = instance.firstBlock + k;
      const p = atlas.blockPatch[b] as number;
      const patch = patches[instance.firstPatch + p] as ScenePatch;
      const c = affinePoint(
        toTub,
        atlas.centre[3 * b] as number,
        atlas.centre[3 * b + 1] as number,
        atlas.centre[3 * b + 2] as number,
      );
      let n: [number, number, number];
      let along = 0;
      let dir: [number, number, number] = [0, 0, 0];
      let tilt: number;
      const flagsIn = atlas.blockFlags[b] as number;
      let flags = (flagsIn & ATLAS_BLOCK_FLAG.boundary) !== 0 ? BLOCK_FLAG.boundary : 0;
      if ((flagsIn & ATLAS_BLOCK_FLAG.line) !== 0) {
        flags |= BLOCK_FLAG.line;
        lineBlocks++;
        const a = patch.axis;
        // Across the axis, as nearly upward as it goes; for an upright wire the frame's x axis.
        n = [-a[2] * a[0], -a[2] * a[1], 1 - a[2] * a[2]];
        const len = Math.hypot(n[0], n[1], n[2]);
        if (len > 1e-6) n = [n[0] / len, n[1] / len, n[2] / len];
        else n = [...(across[p] as readonly [number, number, number])];
        along = g * Math.abs(a[2]);
        if (Math.abs(a[2]) > 1e-9) {
          const s = a[2] > 0 ? -1 : 1;
          dir = [s * a[0], s * a[1], s * a[2]];
        }
        tilt = Math.asin(Math.min(1, Math.abs(a[2])));
      } else {
        n = affineVector(
          toTub,
          atlas.normal[3 * b] as number,
          atlas.normal[3 * b + 1] as number,
          atlas.normal[3 * b + 2] as number,
        );
        const sin = Math.sqrt(Math.max(0, 1 - n[2] * n[2]));
        along = g * sin;
        if (sin > 1e-9) dir = [(n[2] * n[0]) / sin, (n[2] * n[1]) / sin, (n[2] * n[2] - 1) / sin];
        tilt = Math.acos(Math.min(1, Math.max(-1, n[2])));
      }
      const part = parts[patch.part] as ScenePart;
      if (part.porosity > 0) flags |= BLOCK_FLAG.porous;
      const region = atlas.rowRegion[atlas.blockRow[b] as number] as number;
      const regionSet = atlas.rowRegionSet[atlas.blockRow[b] as number] as number;
      if (soiledSet[regionSet] === true) {
        flags |= BLOCK_FLAG.soiled;
        blocks.soilFirst[gi] = 4 * soilCount++;
        for (const r of atlas.regionSets[regionSet] as readonly number[]) {
          soiledBlocks[r] = (soiledBlocks[r] as number) + 1;
        }
      }
      for (let i = 0; i < 3; i++) {
        centre64[3 * gi + i] = c[i] as number;
        normal64[3 * gi + i] = n[i] as number;
        blocks.centre[3 * gi + i] = c[i] as number;
        blocks.normal[3 * gi + i] = n[i] as number;
        blocks.gravityDir[3 * gi + i] = dir[i] as number;
      }
      blocks.area[gi] = atlas.area[b] as number;
      blocks.instance[gi] = index;
      blocks.patch[gi] = patch.index;
      blocks.part[gi] = patch.part;
      blocks.region[gi] = region;
      blocks.material[gi] = part.material;
      blocks.gravityAlong[gi] = along;
      blocks.tilt[gi] = tilt;
      blocks.flags[gi] = flags;
    }
    spec.shape.regions.forEach((region, r) => {
      if (spec.soiled.has(region.id) && soiledBlocks[r] === 0) {
        unsupported.push(
          `${spec.id}: soil on region '${region.id}' lies on no block at this block size (the region is buried or smaller than a block)`,
        );
      }
    });
  });

  // ---- soil cells
  stage('soil');
  const soilCells = {
    count: 4 * soilCount,
    block: new Uint32Array(4 * soilCount),
    centre: new Float32Array(12 * soilCount),
    area: new Float32Array(4 * soilCount),
  } satisfies SceneSoilCells;
  {
    const quarterCentres = new Float64Array(12);
    const quarterShares = new Float64Array(4);
    for (const build of builds) {
      for (let k = 0; k < build.localOf.length; k++) {
        const gi = build.instance.firstBlock + k;
        const first = blocks.soilFirst[gi] as number;
        if (first === NONE) continue;
        blockQuarters(build.atlas, build.localOf[k] as number, quarterCentres, quarterShares);
        for (let q = 0; q < 4; q++) {
          const c = affinePoint(
            build.toTub,
            quarterCentres[3 * q] as number,
            quarterCentres[3 * q + 1] as number,
            quarterCentres[3 * q + 2] as number,
          );
          soilCells.block[first + q] = gi;
          soilCells.centre[3 * (first + q)] = c[0];
          soilCells.centre[3 * (first + q) + 1] = c[1];
          soilCells.centre[3 * (first + q) + 2] = c[2];
          soilCells.area[first + q] = (blocks.area[gi] as number) * (quarterShares[q] as number);
        }
      }
    }
  }

  // ---- the cell graph in compressed rows
  stage('graph');
  const offsets = new Uint32Array(blockCount + 1);
  for (const build of builds) {
    const { atlas, blockOf } = build;
    for (let k = 0; k < atlas.linkA.length; k++) {
      const a = blockOf[atlas.linkA[k] as number] as number;
      const b = blockOf[atlas.linkB[k] as number] as number;
      if (a === NONE || b === NONE) continue;
      offsets[a + 1] = (offsets[a + 1] as number) + 1;
      offsets[b + 1] = (offsets[b + 1] as number) + 1;
    }
  }
  for (let b = 0; b < blockCount; b++)
    offsets[b + 1] = (offsets[b + 1] as number) + (offsets[b] as number);
  const linkTotal = offsets[blockCount] as number;
  const graph = {
    offsets,
    neighbour: new Uint32Array(linkTotal),
    length: new Float32Array(linkTotal),
    kind: new Uint8Array(linkTotal),
  } satisfies SceneGraph;
  {
    const cursor = Uint32Array.from(offsets.subarray(0, blockCount));
    for (const build of builds) {
      const { atlas, blockOf } = build;
      // Links are sorted by (a, b) with a < b, and kept blocks keep their order, so every
      // block's neighbours come out ascending.
      for (let k = 0; k < atlas.linkA.length; k++) {
        const a = blockOf[atlas.linkA[k] as number] as number;
        const b = blockOf[atlas.linkB[k] as number] as number;
        if (a === NONE || b === NONE) continue;
        for (const [from, to] of [
          [a, b],
          [b, a],
        ] as const) {
          const at = cursor[from] as number;
          cursor[from] = at + 1;
          graph.neighbour[at] = to;
          graph.length[at] = atlas.linkLength[k] as number;
          graph.kind[at] = atlas.linkKind[k] as number;
        }
      }
    }
  }

  // ---- ray data
  stage('triangles');
  const chord = params.rayChordError;
  const triangleSets = builds.map((build) => atlasTriangles(build.atlas, chord));
  let surfCount = 0;
  let frameCount = 0;
  let rowCount = 0;
  let cellCount = 0;
  let unclassified = 0;
  const bases = builds.map((build, index) => {
    const base = { surf: surfCount, frame: frameCount, row: rowCount, cell: cellCount };
    surfCount += build.atlas.surfs.length;
    frameCount += atlasFrames(build.atlas).frames.length;
    rowCount += build.atlas.rows.length / 2;
    cellCount += build.atlas.cellCount;
    unclassified += (triangleSets[index] as { unclassified: number }).unclassified;
    return base;
  });
  const patchCount = patches.length;
  const surfKind = new Uint32Array(surfCount);
  const surfFrame = new Uint32Array(surfCount);
  const surfPrev = new Uint32Array(surfCount);
  const surfNext = new Uint32Array(surfCount);
  const surfParams = new Float64Array(6 * surfCount);
  const surfMap = new Float64Array(4 * surfCount);
  const frames = new Float64Array(12 * frameCount);
  const patchKind = new Uint32Array(patchCount);
  const patchFrame = new Uint32Array(patchCount);
  const patchRowStart = new Uint32Array(patchCount);
  const patchRowCount = new Uint32Array(patchCount);
  const patchCoord = new Float64Array(4 * patchCount);
  const rows = new Uint32Array(2 * rowCount);
  const cellBlock = new Uint32Array(cellCount);
  const cellQuarter = new Uint8Array(cellCount);
  builds.forEach((build, index) => {
    const { atlas, instance } = build;
    const base = bases[index] as (typeof bases)[number];
    const af = atlasFrames(atlas);
    af.frames.forEach((frame, f) => {
      // A rotating part is traced in its own frame; everything else in the tub frame.
      const world = instance.rotating ? frame : affineMul(frame, build.toItem);
      const o = 12 * (base.frame + f);
      for (let r = 0; r < 3; r++) {
        frames[o + 4 * r] = world.m[3 * r] as number;
        frames[o + 4 * r + 1] = world.m[3 * r + 1] as number;
        frames[o + 4 * r + 2] = world.m[3 * r + 2] as number;
        frames[o + 4 * r + 3] = world.c[r] as number;
      }
    });
    atlas.surfs.forEach((surf: AtlasSurf, s) => {
      const gs = base.surf + s;
      surfKind[gs] = surf.kind;
      surfFrame[gs] = base.frame + (af.surfFrame[s] as number);
      surfPrev[gs] = surf.prev === NO_INDEX ? NONE : base.surf + surf.prev;
      surfNext[gs] = surf.next === NO_INDEX ? NONE : base.surf + surf.next;
      surf.params.forEach((value, k) => {
        surfParams[6 * gs + k] = value;
      });
      surfParams[6 * gs + 5] =
        surf.kind === SURF_KIND.revLine
          ? TRACE_NUMERICS.rangeSlack
          : surf.kind === SURF_KIND.revArc
            ? TRACE_NUMERICS.rangeSlack / (surf.params[2] as number)
            : 0;
      surfMap[4 * gs] = surf.sBase;
      surfMap[4 * gs + 1] = surf.sScale;
      surfMap[4 * gs + 2] = surf.pMin;
      surfMap[4 * gs + 3] = surf.pMax;
    });
    atlas.patches.forEach((patch, p) => {
      const gp = instance.firstPatch + p;
      patchKind[gp] = patch.kind;
      patchFrame[gp] = base.frame + (af.patchFrame[p] as number);
      patchRowStart[gp] = base.row + patch.rowStart;
      patchRowCount[gp] = patch.rowCount;
      patchCoord[4 * gp] = patch.a0;
      patchCoord[4 * gp + 1] = patch.da;
      patchCoord[4 * gp + 2] = patch.b0;
      patchCoord[4 * gp + 3] = patch.db;
    });
    for (let r = 0; r < atlas.rows.length / 2; r++) {
      rows[2 * (base.row + r)] = base.cell + (atlas.rows[2 * r] as number);
      rows[2 * (base.row + r) + 1] = atlas.rows[2 * r + 1] as number;
    }
    // A block that was left out of the scene (an enclosure block whose centre is outside the
    // chamber) hands the hits on its surface to the nearest block that was kept.
    let stand: Uint32Array | null = null;
    if (build.localOf.length > 0 && build.localOf.length < atlas.blockCount) {
      const finder = new NearestPoints(
        atlas.centre,
        build.localOf,
        4 * Math.max(atlas.blockSize, atlas.lineLength),
      );
      stand = new Uint32Array(atlas.blockCount);
      for (let b = 0; b < atlas.blockCount; b++) {
        if (build.blockOf[b] !== NONE) continue;
        // Only nearby: a dropped block far from every kept one (the outer skin of the door)
        // cannot be struck from inside the chamber.
        const found = finder.nearest(
          atlas.centre[3 * b] as number,
          atlas.centre[3 * b + 1] as number,
          atlas.centre[3 * b + 2] as number,
          undefined,
          false,
        );
        stand[b] = found < 0 ? NONE : (build.blockOf[found] as number);
      }
    }
    for (let c = 0; c < atlas.cellCount; c++) {
      const local = atlas.cellBlock[c] as number;
      if (local === NO_INDEX) {
        cellBlock[base.cell + c] = NONE;
        continue;
      }
      const kept = build.blockOf[local] as number;
      if (kept !== NONE) {
        cellBlock[base.cell + c] = kept;
        cellQuarter[base.cell + c] = atlas.cellQuarter[c] as number;
      } else {
        cellBlock[base.cell + c] = stand === null ? NONE : (stand[local] as number);
      }
    }
  });

  // Triangles per root: root 0 holds everything static, each rotating part has its own.
  stage('hierarchy');
  const rootMembers: number[][] = [[]];
  builds.forEach((build, index) => {
    if (build.instance.rotating) rootMembers.push([index]);
    else (rootMembers[0] as number[]).push(index);
  });
  if (rootMembers.length > MAX_TRACE_ROOTS) {
    throw new RangeError(
      `sim-scene: ${rootMembers.length - 1} rotating parts exceed the tracer's ${MAX_TRACE_ROOTS - 1}`,
    );
  }
  let triangleCount = 0;
  for (const set of triangleSets) triangleCount += set.count;
  const triVerts = new Float32Array(9 * triangleCount);
  const triSurf = new Uint32Array(triangleCount);
  const triPatch = new Uint32Array(triangleCount);
  const triPorous = new Uint32Array(triangleCount);
  const roots: TraceRoot[] = [];
  const nodeBuffers: ArrayBuffer[] = [];
  let nodeCount = 0;
  let triBase = 0;
  for (const members of rootMembers) {
    let count = 0;
    for (const index of members) count += (triangleSets[index] as { count: number }).count;
    // A root without triangles is left out: the tracers visit only what can be struck.
    if (count === 0) continue;
    const verts = new Float32Array(9 * count);
    const surfOf = new Uint32Array(count);
    const patchOf = new Uint32Array(count);
    const porousOf = new Uint32Array(count);
    let at = 0;
    for (const index of members) {
      const build = builds[index] as InstanceBuild;
      const set = triangleSets[index] as (typeof triangleSets)[number];
      const base = bases[index] as (typeof bases)[number];
      const rotating = build.instance.rotating;
      const m = build.toTub.m as number[];
      const t = build.toTub.c as number[];
      const pos = set.positions;
      for (let k = 0; k < set.count; k++) {
        for (let v = 0; v < 3; v++) {
          const x = pos[9 * k + 3 * v] as number;
          const y = pos[9 * k + 3 * v + 1] as number;
          const z = pos[9 * k + 3 * v + 2] as number;
          const o = 9 * (at + k) + 3 * v;
          if (rotating) {
            verts[o] = x;
            verts[o + 1] = y;
            verts[o + 2] = z;
          } else {
            verts[o] =
              (m[0] as number) * x + (m[1] as number) * y + (m[2] as number) * z + (t[0] as number);
            verts[o + 1] =
              (m[3] as number) * x + (m[4] as number) * y + (m[5] as number) * z + (t[1] as number);
            verts[o + 2] =
              (m[6] as number) * x + (m[7] as number) * y + (m[8] as number) * z + (t[2] as number);
          }
        }
        surfOf[at + k] = base.surf + (set.surf[k] as number);
        patchOf[at + k] = build.instance.firstPatch + (set.patch[k] as number);
        const part = parts[build.instance.firstPart + (set.part[k] as number)] as ScenePart;
        if (part.porosity > 0) {
          const open = Math.min(255, Math.max(1, Math.round(part.porosity * 256)));
          porousOf[at + k] = ((open << 24) | (part.index & 0xffffff)) >>> 0;
        }
      }
      at += set.count;
    }
    const bvh = buildBvh(verts, count);
    for (let k = 0; k < count; k++) {
      const src = bvh.order[k] as number;
      triVerts.set(verts.subarray(9 * src, 9 * src + 9), 9 * (triBase + k));
      triSurf[triBase + k] = surfOf[src] as number;
      triPatch[triBase + k] = patchOf[src] as number;
      triPorous[triBase + k] = porousOf[src] as number;
    }
    // Node indices and triangle ranges of this root move by where it lands in the buffers.
    const nu = new Uint32Array(bvh.nodes);
    for (let n = 0; n < bvh.nodeCount; n++) {
      if (n === 1) continue;
      nu[8 * n + 3] =
        (nu[8 * n + 3] as number) + ((nu[8 * n + 7] as number) > 0 ? triBase : nodeCount);
    }
    const member = builds[members[0] as number] as InstanceBuild;
    const rotation = (specs[members[0] as number] as Spec).rotation;
    roots.push({
      node: nodeCount,
      instance: rotation === null ? -1 : member.instance.index,
      rotating:
        rotation === null
          ? null
          : { pose: member.toTub, point: rotation.point, axis: rotation.axis },
    });
    nodeBuffers.push(bvh.nodes);
    nodeCount += bvh.nodeCount;
    triBase += count;
  }
  const nodes = new ArrayBuffer(nodeCount * BVH_NODE_BYTES);
  {
    const all = new Uint8Array(nodes);
    let at = 0;
    for (const buffer of nodeBuffers) {
      all.set(new Uint8Array(buffer), at);
      at += buffer.byteLength;
    }
  }
  const trace: TraceData = {
    chordError: chord,
    roots,
    nodes,
    nodeCount,
    triangleCount,
    triVerts,
    triSurf,
    triPatch,
    triPorous,
    surfCount,
    surfKind,
    surfFrame,
    surfPrev,
    surfNext,
    surfParams,
    surfMap,
    frameCount,
    frames,
    patchCount,
    patchKind,
    patchFrame,
    patchRowStart,
    patchRowCount,
    patchCoord,
    rows,
    cellBlock,
    cellQuarter,
    blockSoil: blocks.soilFirst,
  };
  const rays = new CpuTracer(trace);

  const context: SceneBuild = {
    params,
    blockSize: D,
    instances: builds,
    patches,
    centre: centre64,
    normal: normal64,
    blocks,
    graph,
    rays,
    box: { min: sceneMin, max: sceneMax },
  };
  stage('drips');
  const drips = findDrips(context);
  stage('contacts');
  const contacts = findContacts(context);
  stage('basins');
  const analytic = findBasins(context);
  const basins = [...analytic, ...findFloodBasins(context, analytic)];
  stage('done');

  return {
    blockSize: D,
    gravity: g,
    instances: builds.map((build) => build.instance),
    parts,
    patches,
    materials,
    blocks,
    soilCells,
    graph,
    drips,
    contacts,
    basins,
    itemInstance: new Map(
      builds
        .filter((b) => b.instance.kind === 'item')
        .map((b) => [b.instance.id, b.instance.index]),
    ),
    trace,
    rays,
    counts: {
      instances: builds.length,
      parts: parts.length,
      patches: patches.length,
      blocks: blockCount,
      lineBlocks,
      soilCells: soilCells.count,
      links: linkTotal / 2,
      drips: drips.count,
      contacts: contacts.count,
      basins: basins.length,
      triangles: triangleCount,
      hierarchyNodes: nodeCount,
      unclassifiedTriangles: unclassified,
    },
    unsupported,
  };
}
