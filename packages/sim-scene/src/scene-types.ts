/**
 * The scene of the first build: the simulation's view of a loaded machine (the scene brief;
 * docs/design/sim-core.md section 3 and module M3, simplified as docs/design/scope.md directs).
 *
 * These are the types `buildWashScene` takes and returns. They replace, for the first build,
 * the `Scene` of the contract skeleton in `types.ts` (which describes the two-level analytic
 * tracer and the patch tables of the full design and is kept because other skeletons and the
 * contract checks of `@spotless/sim-verify` refer to it).
 *
 * Index spaces:
 * - **instance**: the wash items sorted by item id, then the machine parts in the order given;
 * - **block**: one index space over the surface elements of every instance; an instance owns a
 *   contiguous range, and within it every patch does;
 * - **soil cell**: `blocks.soilFirst[block] + quarter`, quarter 0 to 3 (2 x the half along the
 *   rows of the patch + the half along its columns);
 * - **part**: one index space over the parts (primitives) of every instance.
 *
 * Units: SI. Frame: the tub frame T of docs/design/platform.md section 2 (origin on the
 * lower-arm axis at tub-floor level, x right, y back, z up), after every pose.
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { Aabb, Shape } from '@spotless/geometry';
import type { ParamSet } from '@spotless/sim-params';
import type { CpuTracer } from './trace-cpu.ts';
import type { TraceData } from './trace-data.ts';
import type { ItemSoilRecord } from './types.ts';

/** The value of an index that means "none". */
export const SCENE_NONE = 0xffffffff;

/** The drip target of a block whose drop falls clear of everything: the tub floor. */
export const DRIP_TO_FLOOR = 0xfffffffe;

/** Wetting behaviour of a material (the classes of the catalogue; films section 12.6). */
export type SceneWettingClass = 'continuous_film' | 'partially_wetting' | 'rivulet_prone';

/**
 * Wetting data of one material as the scene carries it per block. The three entries of each
 * angle are the liquor classes W (clean water), D (main-wash liquor) and R (rinse-aid rinse).
 */
export interface SceneMaterial {
  /** Catalogue material id. */
  readonly id: string;
  readonly wettingClass: SceneWettingClass;
  /** Advancing contact angles, radians, for W, D, R. */
  readonly advancing: readonly [number, number, number];
  /** Receding contact angles, radians, for W, D, R. */
  readonly receding: readonly [number, number, number];
}

/** Returns the wetting data of a catalogue material id. Throws for an unknown id. */
export type SceneMaterialLookup = (materialId: string) => SceneMaterial;

/**
 * One item of the load. Structurally a part of the contract's `WashItem`, so a `WashItem` can
 * be passed as it is.
 */
export interface SceneItem {
  /** Item instance id, unique in the load. */
  readonly itemId: string;
  /** Catalogue item type id. */
  readonly typeId: string;
  /** The item's shape in its item frame. Items of one type should share one `Shape` object. */
  readonly shape: Shape;
  /** Item frame to tub frame. */
  readonly pose: Pose;
  /**
   * The soils on the item. Every region a soil names must be a region of `shape`
   * (`buildWashScene` throws a `RangeError` otherwise); regions may overlap, and a block is
   * soiled when any region that holds it is named with a coverage above 0.
   */
  readonly soils: readonly ItemSoilRecord[];
}

/** What a machine part is to the wash simulation (the roles of `@spotless/machine`). */
export type SceneMachineRole = 'wires' | 'basket' | 'tub' | 'arm';

/**
 * One named shape of the machine. Structurally a part of the `MachinePart` of
 * `@spotless/machine`; `sceneMachineParts` converts a `MachineGeometry`.
 */
export interface SceneMachinePart {
  /** Stable id, unique in the machine. */
  readonly id: string;
  readonly role: SceneMachineRole;
  readonly shape: Shape;
  /** Part frame to tub frame, for a rotating part at angle 0. */
  readonly pose: Pose;
  /**
   * For a part that rotates during the wash (a spray arm): the hinge it turns about, a point and
   * a unit axis in the part frame. Such a part is posed at an angle when rays are traced.
   */
  readonly rotation?: { readonly point: Vec3; readonly axis: Vec3 };
  /**
   * True for the sheet metal that encloses the wash chamber (tub, door liner). With a `chamber`
   * given, the blocks of such a part that lie outside the chamber (the outer faces of the sheet)
   * are left out.
   */
  readonly enclosure?: boolean;
}

/** What `buildWashScene` is given. */
export interface WashSceneInput {
  readonly items: readonly SceneItem[];
  readonly machine: readonly SceneMachinePart[];
  /** Block size, metres: 2 mm for the official tier, 4 mm for the fast tier. */
  readonly blockSize: number;
  /** Wetting data of every material the shapes name. */
  readonly materials: SceneMaterialLookup;
  /** Parameter set to read the `scene.*` keys from; default the registry defaults. */
  readonly params?: ParamSet;
  /** The inside of the wash chamber, tub frame (see `SceneMachinePart.enclosure`). */
  readonly chamber?: Aabb;
  /** Called at the start of every stage of the build with its name (for benchmarks). */
  readonly onStage?: (stage: string) => void;
}

/** One instance of the scene: a wash item or a machine part. */
export interface SceneInstance {
  readonly index: number;
  /** Item id or machine part id. */
  readonly id: string;
  readonly kind: 'item' | 'machine';
  /** Catalogue item type id; empty for a machine part. */
  readonly typeId: string;
  /** Role of a machine part; `item` for a wash item. */
  readonly role: 'item' | SceneMachineRole;
  readonly shape: Shape;
  readonly pose: Pose;
  /** True for a part posed at trace time. */
  readonly rotating: boolean;
  /** Block size the instance was gridded with, metres. */
  readonly blockSize: number;
  /** Its blocks: `firstBlock .. firstBlock + blockCount - 1`. */
  readonly firstBlock: number;
  readonly blockCount: number;
  /** Its patches and parts in the scene tables. */
  readonly firstPatch: number;
  readonly patchCount: number;
  readonly firstPart: number;
  readonly partCount: number;
  /** Axis-aligned box of the instance in the tub frame (reference pose). */
  readonly box: Aabb;
}

/** One part (primitive) of an instance. */
export interface ScenePart {
  readonly index: number;
  readonly instance: number;
  /** `Part.id` of the shape. */
  readonly id: string;
  /** Index into `WashScene.materials`. */
  readonly material: number;
  /** Open-area fraction (0 solid). */
  readonly porosity: number;
}

/** One patch of an instance. */
export interface ScenePatch {
  readonly index: number;
  readonly instance: number;
  /** Index into `WashScene.parts`. */
  readonly part: number;
  /** `rev` a grid on a body of revolution, `cart` a grid on a planar face, `line` line elements. */
  readonly kind: 'rev' | 'cart' | 'line';
  /** Its blocks: a contiguous range. */
  readonly firstBlock: number;
  readonly blockCount: number;
  /** Capsule radius of a `line` patch (and of a capsule gridded as `rev`), metres; else 0. */
  readonly radius: number;
  /** `line`: unit direction of the axis in the tub frame. */
  readonly axis: Vec3;
}

/** Bits of `SceneBlocks.flags`. */
export const BLOCK_FLAG = {
  /** A line element: its centre is on the axis of a wire and it carries the whole circumference. */
  line: 1,
  /** The block carries soil: `soilFirst` is its first soil cell. */
  soiled: 2,
  /** Water arriving here falls: the block has no lower neighbour and does not face up. */
  dripSite: 4,
  /** Water arriving here stays: the block has no lower neighbour and faces up. */
  pit: 8,
  /** The block lies on an open edge of its patch or next to a buried cell. */
  boundary: 16,
  /** The part is porous (a lattice or a perforated sheet). */
  porous: 32,
  /** The block is under water when its basin is full. */
  basin: 64,
} as const;

/** The surface elements of a scene, one entry per block in every array. */
export interface SceneBlocks {
  readonly count: number;
  /** Centre, three per block, metres. On the surface; on the axis for a line element. */
  readonly centre: Float32Array;
  /**
   * Outward unit normal, three per block. For a line element: the direction across the axis
   * that points most nearly upward.
   */
  readonly normal: Float32Array;
  /**
   * Area, m2. A line element carries its whole circumference; a block on a face of a rounded
   * box or hull carries, besides the face, the exposed surface of the rounded edges and corners
   * whose hits are credited to it.
   */
  readonly area: Float32Array;
  /** Instance index. */
  readonly instance: Uint32Array;
  /** Index into `WashScene.patches`. */
  readonly patch: Uint32Array;
  /** Index into `WashScene.parts`. */
  readonly part: Uint32Array;
  /**
   * Index into the `regions` of the instance's shape of the first region that holds the block,
   * or -1.
   */
  readonly region: Int16Array;
  /** Index into `WashScene.materials`. */
  readonly material: Uint16Array;
  /** Index of the first of its four soil cells, or {@link SCENE_NONE}. */
  readonly soilFirst: Uint32Array;
  /**
   * Unit direction of gravity along the surface (down the slope), three per block; zero where
   * the surface is level. For a line element: along the wire.
   */
  readonly gravityDir: Float32Array;
  /** Magnitude of gravity along the surface, m/s2: g sin(tilt). */
  readonly gravityAlong: Float32Array;
  /**
   * Tilt, radians. Surface: angle of the outward normal from straight up (0 level and facing
   * up, pi/2 vertical, pi facing down). Line element: slope of the wire from the horizontal
   * (0 to pi/2).
   */
  readonly tilt: Float32Array;
  /** Bits of {@link BLOCK_FLAG}. */
  readonly flags: Uint8Array;
}

/** The soil cells of a scene: four per soiled block. */
export interface SceneSoilCells {
  readonly count: number;
  /** Parent block. */
  readonly block: Uint32Array;
  /** Centre on the surface, three per cell, metres. */
  readonly centre: Float32Array;
  /**
   * Area, m2; the four cells of a block sum to its area. A cell has the area of the surface
   * whose ray hits name it; a cell with area 0 (a quarter of a grid cell that lies off the
   * face) is named by no hit.
   */
  readonly area: Float32Array;
}

/** The cell graph in compressed rows: the links of block `b` are `offsets[b] .. offsets[b+1]-1`. */
export interface SceneGraph {
  readonly offsets: Uint32Array;
  /** Neighbour block of each link, ascending within a block. */
  readonly neighbour: Uint32Array;
  /** Length of the shared edge, metres. */
  readonly length: Float32Array;
  /** `LINK_KIND`: 0 inside a patch, 1 a seam across a rounded edge, 2 a stitch between parts. */
  readonly kind: Uint8Array;
}

/** Where water falls to from the drip sites. */
export interface SceneDrips {
  readonly count: number;
  /** The drip site. */
  readonly block: Uint32Array;
  /** The block the drop lands on, or {@link DRIP_TO_FLOOR}. */
  readonly target: Uint32Array;
  /** Height of the fall, metres. */
  readonly fall: Float32Array;
  /** Per block of the scene: its entry in these arrays, or {@link SCENE_NONE}. */
  readonly ofBlock: Uint32Array;
}

/** Contacts and near-contacts between different instances. */
export interface SceneContacts {
  readonly count: number;
  /** A block of a wash item. */
  readonly blockA: Uint32Array;
  /** The nearest block of the other instance (an item or a machine part). */
  readonly blockB: Uint32Array;
  /** Width of the gap between the two surfaces at the link, metres (0 where they touch). */
  readonly gap: Float32Array;
}

/** A basin: an upward-facing cavity of a body of revolution that holds water. */
export interface SceneBasin {
  readonly id: number;
  /** Instance that holds it. */
  readonly instance: number;
  /** Ids of the parts whose surfaces bound it. */
  readonly parts: readonly string[];
  /** +1 when the cavity opens along the axis of its parts, -1 against it. */
  readonly opening: 1 | -1;
  /** Volume it holds before it spills, m3. */
  readonly volume: number;
  /** Tub-frame height of the water surface when full, and of its lowest point, metres. */
  readonly spillLevel: number;
  readonly floorLevel: number;
  /** The point of the crest the water spills over, tub frame. */
  readonly spillPoint: Vec3;
  /** The block at that point, or {@link SCENE_NONE}. */
  readonly spillBlock: number;
  /**
   * 64 pairs (depth of water above the lowest point in metres, volume in m3), from empty to the
   * spill level.
   */
  readonly levelTable: Float32Array;
  /** The blocks under water when the basin is full. */
  readonly blocks: Uint32Array;
  /** Per entry of `blocks`: depth of water over the block centre when full, metres. */
  readonly depth: Float32Array;
}

/** Element counts of a scene. */
export interface SceneCounts {
  readonly instances: number;
  readonly parts: number;
  readonly patches: number;
  readonly blocks: number;
  /** Blocks that are line elements. */
  readonly lineBlocks: number;
  readonly soilCells: number;
  readonly links: number;
  readonly drips: number;
  readonly contacts: number;
  readonly basins: number;
  readonly triangles: number;
  readonly hierarchyNodes: number;
  /** Triangles the classification could not tie to an analytic piece (they keep the best fit). */
  readonly unclassifiedTriangles: number;
}

/** The scene. */
export interface WashScene {
  /** Block size of the items, metres. */
  readonly blockSize: number;
  /** Gravity, m/s2, along -z. */
  readonly gravity: number;
  readonly instances: readonly SceneInstance[];
  readonly parts: readonly ScenePart[];
  readonly patches: readonly ScenePatch[];
  /** The materials in use, sorted by id. */
  readonly materials: readonly SceneMaterial[];
  readonly blocks: SceneBlocks;
  readonly soilCells: SceneSoilCells;
  readonly graph: SceneGraph;
  readonly drips: SceneDrips;
  readonly contacts: SceneContacts;
  readonly basins: readonly SceneBasin[];
  /** Per item id: its instance index. */
  readonly itemInstance: ReadonlyMap<string, number>;
  /** The data of the ray queries and the f64 reference tracer over it. */
  readonly trace: TraceData;
  readonly rays: CpuTracer;
  readonly counts: SceneCounts;
  /**
   * What the scene could not represent, with the reason: parts whose geometry the atlas cannot
   * lay out, and soil on a region that received no block at this block size.
   */
  readonly unsupported: readonly string[];
}
