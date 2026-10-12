/**
 * Contract of module M3, the scene (docs/design/sim-core.md section 3 in full and section 4,
 * "M3. Scene"): atlas, ray primitives and trees, hit-to-element map, cell graph, placement
 * analysis, soil-region masks and seeded surface fields.
 *
 * Types only. The binary tables behind the `GPUBuffer` members are described in `layouts.ts`.
 *
 * STATUS: this is the typed skeleton of the full design. The first build (docs/design/scope.md)
 * does not implement `Scene`, `SceneBuilder` or `RayQuery`: its scene is the `WashScene` of
 * `scene-types.ts`, built by `buildWashScene`, with a triangle hierarchy in place of the
 * analytic two-level tracer. `WashItem` and `ItemSoilRecord` are used by both (a `WashItem` can
 * be passed to `buildWashScene` as it is). The rest is kept because the skeletons of the modules
 * above and the contract checks of `@spotless/sim-verify` refer to it.
 *
 * Units: SI. Frames: the tub frame T of docs/design/platform.md section 2 for everything "world"
 * (origin on the lower-arm axis at tub-floor level, x right, y back, z up); the item frame for
 * patch coordinates; (s, theta) or (u, v) on a patch.
 *
 * Index spaces used by every module (the contract leaves the first one implicit; the reading
 * taken here is reported as a contract issue):
 * - item index: the position of a wash item in the `items` array given to `SceneBuilder.build`
 *   (the orchestrator passes them sorted by item id), followed by the parts of the machine
 *   geometry in their own order. Per-item arrays of other modules (`ItemLoads`,
 *   `StateSummary.perItemEpsWet`, `SoilRelease.byItemAndClass`) have one entry per wash item
 *   and are indexed by it; the machine parts, whose indices come after, have no entry.
 * - block index: one index space over the blocks of every patch; a patch owns the range that
 *   starts at `PatchDesc.blockOffset`, and an item the range of `Scene.itemBlocks`.
 * - soil cell index: `BlockStatic.firstSoilCell + subCell`, sub-cells 0 to 3 as in section 3.6.
 * - reservoir index: the basins of the scene in id order, then its gap reservoirs.
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { MassProperties, Shape } from '@spotless/geometry';
import type { TierParams } from '@spotless/sim-params';
import type { MachineGeometry } from './machine-boundary.ts';

// ---------------------------------------------------------------------------------------------
// Constants of the surface representation (section 3)
// ---------------------------------------------------------------------------------------------

/** The value of a u32 element index that means "none" (unsoiled block, no donor, no tile). */
export const NO_ELEMENT = 0xffffffff;

/** The value of a u16 id that means "none" (no basin, no gutter element, no reservoir). */
export const NO_ID_U16 = 0xffff;

/** The value of a u8 region index that means "outside every region". */
export const NO_REGION_U8 = 0xff;

/** Most donors a block has in the cell graph (section 3.6). */
export const MAX_DONORS = 8;

/** Sub-cells of an ordinary block: 2 x 2 in (s, theta) or (u, v) (section 3.2). */
export const SUB_CELLS_PER_BLOCK = 4;

/** Faces of a pole cell towards row 1, where N_theta is 8 (section 3.2). */
export const POLE_FACES = 8;

/** Sub-cells of a pole block: 1 pole sub-cell and the 8 of its outer half-ring (section 3.2). */
export const POLE_SUB_CELLS = 9;

/** Side of a tile of soil cells (8 x 8) and of a monitor tile of film cells (sections M5, M7.1). */
export const TILE_SIDE = 8;

// ---------------------------------------------------------------------------------------------
// Film class and wash items
// ---------------------------------------------------------------------------------------------

/**
 * Film solver and film cell size of an item (section 3.4), a property of the catalogue item
 * type, the same for every level, load and pose:
 * - `S1`: any item, other than cutlery and utensils, with a part of a rivulet-prone material:
 *   solver S, sub-cells (1 mm) in main-wash-class solves and blocks (2 mm) in classes W and R;
 * - `S2`: every other item with a part of a partially wetting material, and hollow ware of
 *   continuous-film materials: solver S on blocks;
 * - `K2`: flat ware and every other item of continuous-film materials, cutlery and utensils of
 *   any material, any item with a stretched shell of revolution, the tub and the basket:
 *   solver K on blocks;
 * - `LINE`: wires and gutters, 3 mm elements.
 */
export type FilmClass = 'S1' | 'S2' | 'K2' | 'LINE';

/** Every {@link FilmClass}; the position of a class is its code in `BlockAux`. */
export const FILM_CLASSES: readonly FilmClass[] = ['S1', 'S2', 'K2', 'LINE'];

/**
 * One soil on one item, as the level describes it (section M8, "Initial state":
 * `ItemSoilRecord {type, regions, amount_g, age_h, heat_history}`). The contract names the
 * fields and never writes the type; the field types follow docs/research/benchmark.md
 * section 3 (the item record of a level) and the catalogue's `SoilHeatHistory`.
 */
export interface ItemSoilRecord {
  /** Catalogue soil id, for example `egg_yolk_dried`. */
  readonly type: string;
  /** The regions of the item the soil lies on, each with the fraction of its area covered. */
  readonly regions: readonly {
    /** `SurfaceRegion` id of the item's shape. */
    readonly region: string;
    /** Covered fraction of the region's area, 0 to 1. */
    readonly coverage: number;
  }[];
  /** Amount of soil as applied (wet), grams, over all its regions. */
  readonly amount_g: number;
  /** Time since the soil was applied, hours. */
  readonly age_h: number;
  /** How the soil was heated before the wash (the catalogue's `SoilHeatHistory`). */
  readonly heat_history: 'none' | 'warm' | 'cooked' | 'baked' | 'burnt';
}

/** One item of the load as the wash simulation receives it (section M3). */
export interface WashItem {
  /** Item instance id, unique within the level, for example `plate_03`. */
  readonly itemId: string;
  /** Catalogue item type id. */
  readonly typeId: string;
  /** The item's shape in the item frame, metres. */
  readonly shape: Shape;
  /**
   * Item frame to tub frame: the canonical rounded pose of the load manifest (positions to
   * 0.1 mm, quaternion components to 1e-4; section M12).
   */
  readonly pose: Pose;
  /** The soils on the item. */
  readonly soils: readonly ItemSoilRecord[];
  /** Mass (kg), centre of mass (m, item frame) and inertia (kg m2) of the dry item. */
  readonly mass: MassProperties;
  /**
   * Per-item override of the film class, identical for every player of a level ("level lint",
   * section 3.4).
   */
  readonly filmClassOverride?: FilmClass;
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

/**
 * Kind of a patch (sections 3.2 and 3.3): `rev` a closed-meridian (s, theta) patch of a shell of
 * revolution, a capsule or a wide polytope edge; `revStretched` the same grid on a stretched
 * shell, cascade only; `cart` a masked Cartesian patch of a planar face; `line` one-dimensional
 * elements of 3 mm along wires and gutters.
 */
export type PatchKind = 'rev' | 'revStretched' | 'cart' | 'line';

/** Every {@link PatchKind}. */
export const PATCH_KINDS: readonly PatchKind[] = ['rev', 'revStretched', 'cart', 'line'];

/** One patch of the atlas (section M3). */
export interface PatchDesc {
  /** Patch id: its index in `Scene.patches`; fits 16 bits. */
  readonly id: number;
  /** Item index of the instance the patch belongs to (see the file comment). */
  readonly item: number;
  /** Id of the `Part` of the item's shape the patch was generated from. */
  readonly part: string;
  /** Patch kind. */
  readonly kind: PatchKind;
  /** Catalogue material id of the part. */
  readonly material: string;
  /** Film class of the item the patch belongs to. */
  readonly filmClass: FilmClass;
  /** Index of the patch's first row in the patch-row table (`Scene.gpu.patchRows`). */
  readonly rowOffset: number;
  /** Number of rows of the patch. */
  readonly rowCount: number;
  /** Index of the patch's first block. */
  readonly blockOffset: number;
  /** Index of the patch's first film cell on the block grid. */
  readonly filmOffset: number;
  /** Index of the patch's first soil cell, or `NO_ELEMENT` if no block of it is soiled. */
  readonly soilOffset: number;
  /**
   * Per row: index into the `regions` of the item's shape of the region the row belongs to
   * (section 3.2), or `NO_REGION_U8`.
   */
  readonly regionOfRow: Uint8Array;
}

/** A basin of the placement analysis (section 3.7 item 5; section M7.6). */
export interface Basin {
  /** Basin id: its index in `Scene.basins`; fits 16 bits. */
  readonly id: number;
  /** Item index of the item that holds the basin. */
  readonly item: number;
  /** The block over which the basin spills. */
  readonly spillBlock: number;
  /**
   * 64 pairs (level in metres above the basin's lowest point, volume in m3), interleaved, from
   * empty to the spill level.
   */
  readonly levelTable: Float32Array;
  /** The blocks that lie below the spill level. */
  readonly blocks: Uint32Array;
  /**
   * Per entry of `blocks`: height of the block above the basin's lowest point, metres, from
   * which the depth of water over a block follows.
   */
  readonly heightOfBlock: Float32Array;
  /**
   * True when the basin is a lumped reservoir: its depth at the spill level exceeds
   * `film.poolDepth`, or it lies on a cascade patch (section M7.6).
   */
  readonly lumped: boolean;
}

/** A gap reservoir: connected blocks whose gap is below twice the capillary length (M7.6). */
export interface GapReservoir {
  /** Gap reservoir id: its index in `Scene.gaps`; fits 16 bits. */
  readonly id: number;
  /** The blocks of the reservoir, on both surfaces. */
  readonly blocks: Uint32Array;
  /** Volume of liquid the reservoir holds when filled, m3. */
  readonly volume_m3: number;
  /** Item indices of the two bodies the gap lies between. */
  readonly items: readonly [number, number];
}

/** A contact link between two blocks of different bodies (section 3.6). */
export interface ContactLink {
  /** The block on the first body. */
  readonly blockA: number;
  /** The block on the second body. */
  readonly blockB: number;
  /** Gap between the two surfaces at the link, metres (0 where they touch). */
  readonly gap_m: number;
  /**
   * `itemItem` and `itemWire` come from the rigid-body contact manifold; `gapMinimum` from a
   * minimum of the gap field below `scene.contactGap`.
   */
  readonly kind: 'itemItem' | 'itemWire' | 'gapMinimum';
  /** Id of the bridge reservoir of the link (section M7.5, "Contacts"). */
  readonly bridge: number;
}

/** The LINE elements of the scene: wires and the gutters generated on items (section 3.3). */
export interface LineGraph {
  /** Number of LINE elements. */
  readonly elements: number;
  /**
   * `LineElement[]`. The contract names this record and gives it no fields; its layout is to be
   * fixed by the scene and film engineers together and recorded in `layouts.ts`.
   */
  readonly gpu: GPUBuffer;
  /** Element indices of the junctions of the wire graph. */
  readonly junctions: Uint32Array;
  /** Element indices of the drip sites (section M7.5). */
  readonly dripSites: Uint32Array;
  /**
   * Per block: the LINE element the block hands liquid to (its gutter element or the wire
   * element it lies on), or `NO_ELEMENT`.
   */
  readonly ofBlock: Uint32Array;
}

/**
 * Everything the other modules need of the geometry of one epoch (section M3). Nothing stored
 * here changes while an item stays where it is; a moved item gives a new scene with the next
 * epoch number.
 */
export interface Scene {
  /** Geometry epoch: 0 after the shake-down, one more after every event that moves the load. */
  readonly epoch: number;
  /** The patches of the atlas, indexed by patch id. */
  readonly patches: readonly PatchDesc[];
  /** Element counts. */
  readonly counts: {
    /** Blocks, on every surface. */
    readonly blocks: number;
    /** Film cells of the two grids of a solve. */
    readonly filmCells: {
      /** One film cell per block (classes W and R). */
      readonly blockGrid: number;
      /** The grid of main-wash-class solves: sub-cells on class S1 items, blocks elsewhere. */
      readonly classD: number;
    };
    /** Soil cells (the sub-cells of soiled blocks). */
    readonly soilCells: number;
    /** LINE elements. */
    readonly lines: number;
  };
  /** The tables on the GPU; their record layouts are in `layouts.ts`. */
  readonly gpu: {
    /** `Instance[]`: the top level of the ray structure. */
    readonly instances: GPUBuffer;
    /** `BvhNode[]`: top-level and bottom-level trees. */
    readonly nodes: GPUBuffer;
    /** `Primitive[]`: ray primitives. */
    readonly prims: GPUBuffer;
    /** `PatchRow[]`: the row table of every patch. */
    readonly patchRows: GPUBuffer;
    /** `BlockStatic[]`. */
    readonly blockStatic: GPUBuffer;
    /** `BlockAux[]`. */
    readonly blockAux: GPUBuffer;
    /**
     * `BlockFilm` words: one table per grid (the block grid, then the class-D grid), each with
     * one u32 per block.
     */
    readonly blockFilm: GPUBuffer;
    /** `SoilStatic[]`. */
    readonly soilStatic: GPUBuffer;
    /** Stitch and contact links (the contract gives this table no layout). */
    readonly links: GPUBuffer;
  };
  /** The basins, indexed by basin id. */
  readonly basins: readonly Basin[];
  /** The gap reservoirs, indexed by gap reservoir id. */
  readonly gaps: readonly GapReservoir[];
  /** The contact links of the pose. */
  readonly contacts: readonly ContactLink[];
  /** The LINE elements. */
  readonly lines: LineGraph;
  /** Per item id: the first block and the number of blocks of the item. */
  readonly itemBlocks: ReadonlyMap<string, readonly [first: number, count: number]>;
  /** Ray and parcel queries against this scene. */
  readonly rays: RayQuery;
}

/**
 * A contact of the rigid-body manifold as `SceneBuilder.move` reads it. The contract types the
 * argument as the `Contact` of `@spotless/physics`, which M3 may not depend on (table of
 * section 4); this is the part of that type the contact links of section 3.6 need, so a
 * `Contact` can be passed as it is.
 */
export interface SceneContact {
  /** Body id of the first body: a wash item id or a machine part id; `a` sorts before `b`. */
  readonly a: string;
  /** Body id of the second body. */
  readonly b: string;
  /** Part of body `a` in contact (`Part.id` of its shape). */
  readonly partA: string;
  /** Part of body `b` in contact. */
  readonly partB: string;
  /** Mean contact position in the tub frame, metres. */
  readonly position: Vec3;
  /** Unit contact normal in the tub frame, pointing from `a` towards `b`. */
  readonly normal: Vec3;
}

/** Builds and updates scenes (section M3). */
export interface SceneBuilder {
  /**
   * Builds the scene of geometry epoch 0 from the load and the machine. Asynchronous because
   * the gap rays, basin tables and catchment pass run on the GPU and are read back. `levelSeed`
   * is a u32 and keys the seeded surface fields, lanes and coverage ranks.
   */
  build(
    items: readonly WashItem[],
    machine: MachineGeometry,
    tier: TierParams,
    levelSeed: number,
  ): Promise<Scene>;
  /**
   * The scene of the next epoch after items have moved: `poses` holds the new pose (item frame
   * to tub frame) of every moved item by item id, `contacts` the contact manifold of the new
   * poses. Touches only the moved items and their neighbours.
   */
  move(
    scene: Scene,
    poses: ReadonlyMap<string, Pose>,
    contacts: readonly SceneContact[],
  ): Promise<Scene>;
}

// ---------------------------------------------------------------------------------------------
// Ray and parcel queries (section 3.5)
// ---------------------------------------------------------------------------------------------

/**
 * A batch of ray segments on the GPU, one element per segment in each buffer. A segment runs
 * from `origin` along `dir` for at most `tMax`; `time` selects the arm pose (arms are posed at
 * the mid-time of each segment); `radius` is half the droplet diameter for a swept sphere, 0
 * for a ray. The contract fixes the members, not the element formats; the reading taken here is
 * three f32 for the two vectors and one f32 for each scalar, tub frame, metres and seconds.
 */
export interface SegmentBatch {
  /** Segment origins: 3 x f32 per segment, tub frame, metres. */
  readonly origin: GPUBuffer;
  /** Unit directions: 3 x f32 per segment, tub frame. */
  readonly dir: GPUBuffer;
  /** Segment lengths: f32 per segment, metres. */
  readonly tMax: GPUBuffer;
  /** Segment mid-times: f32 per segment, seconds from the start of the solve. */
  readonly time: GPUBuffer;
  /** Swept-sphere radii: f32 per segment, metres. */
  readonly radius: GPUBuffer;
  /** Number of segments. */
  readonly count: number;
}

/**
 * A hit of the f64 reference tracer. The contract uses this type as the result of
 * `RayQuery.traceCpu` and never defines it; it is read here as the fields of the 32-byte
 * `HitRecord` as numbers. Reported as a contract issue.
 */
export interface HitRecordJs {
  /** Distance of the hit along the segment, metres. */
  readonly t: number;
  /** Index of the instance hit. */
  readonly instance: number;
  /** Index of the primitive hit. */
  readonly prim: number;
  /** Patch id of the hit. */
  readonly patch: number;
  /** First patch coordinate of the hit point: s (m) on a REV patch, u (m) on a CART patch. */
  readonly a: number;
  /** Second patch coordinate: theta (rad) on a REV patch, v (m) on a CART patch. */
  readonly b: number;
  /** Cosine of the angle between the ray and the inward surface normal, 0 to 1. */
  readonly cosInc: number;
  /** The flag word of `HitRecord` (feature tag, back face, porous pass). */
  readonly flags: number;
}

/** Ray and parcel queries against one scene: a two-level structure (section 3.5). */
export interface RayQuery {
  /** Refits the top level after poses have changed (item id to new pose, tub frame). */
  refit(poses: ReadonlyMap<string, Pose>): void;
  /**
   * Encodes a trace of a batch into a compute pass; one `HitRecord` per segment is written to
   * `hits` and the results stay on the GPU.
   */
  trace(pass: GPUComputePassEncoder, segments: SegmentBatch, hits: GPUBuffer): void;
  /**
   * The f64 reference tracer, used by the live wrenches of M5 and by tests: one segment from
   * `origin` (tub frame, m) along the unit vector `dir` for at most `tMax` metres, at `time`
   * seconds, with swept-sphere radius `radius` (m). Returns the first hit, or `null`.
   */
  traceCpu(origin: Vec3, dir: Vec3, tMax: number, time: number, radius: number): HitRecordJs | null;
}
