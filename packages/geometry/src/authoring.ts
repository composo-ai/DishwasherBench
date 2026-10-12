/**
 * Authoring-unit geometry definitions: the same item classes as `GeometryDef`, written the way
 * catalogue files are written, in millimetres and degrees.
 *
 * docs/design/platform.md section 2: SI internally, millimetres and degrees in catalogue files,
 * and a value that is not SI carries its unit in its name. Every field here that is a length
 * ends in `Mm` and every angle in `Deg`, so a definition in one unit system cannot be passed for
 * the other without a type error. `geometryDefFromMm` converts to the SI `GeometryDef` (one
 * division by 1000 per length, one multiplication per angle); `expandGeometryMm` goes straight to
 * the `Shape`, which is always SI.
 *
 * The meaning of every parameter is documented on the SI type it converts to (`types.ts`); the
 * comments here only state the unit and anything specific to the authoring form.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { degToRad, mmToM, quatFromEulerXYZ, v3MmToM } from '@spotless/core';
import { expandGeometry } from './expand.ts';
import type {
  FootRingDef,
  GeometryDef,
  RegionRename,
  RodHead,
  Shape,
  SorAddon,
  SorProfilePoint,
  SurfaceRegion,
} from './types.ts';

/**
 * One vertex of a mid-surface profile as `[r, z, t]` in millimetres: distance from the axis,
 * height, wall thickness. The order matches the tables of docs/research/items.md section 10.2.
 */
export type SorProfilePointMm = readonly [rMm: number, zMm: number, tMm: number];

/** Foot ring ({@link FootRingDef}), millimetres. */
export interface FootRingDefMm {
  /** Mean radius of the ring. */
  readonly rMm: number;
  /** Radial width of the ring. */
  readonly widthMm: number;
  /** Height of the ring above z = 0. */
  readonly heightMm: number;
  /** Material of the ring if it differs from the body. */
  readonly material?: string;
}

/** C-shaped loop handle (`HandleLoopAddon`), millimetres and degrees. */
export interface HandleLoopAddonMm {
  readonly type: 'handle_loop';
  /** Heights of the centrelines of the lower and the upper arm where they meet the wall. */
  readonly attachZMm: readonly [number, number];
  /** How far the outer face of the handle stands off the outer wall. */
  readonly reachMm: number;
  /** Cross-section: width across the handle (tangential), thickness in the plane of the loop. */
  readonly sectionMm: readonly [number, number];
  /** Azimuth of the handle from +x towards +y; default 0. */
  readonly azimuthDeg?: number;
  readonly material?: string;
}

/** Straight handle (`HandleBarAddon`), millimetres and degrees. */
export interface HandleBarAddonMm {
  readonly type: 'handle_bar';
  /** Height at which the handle meets the wall. */
  readonly attachZMm: number;
  /** Length of the handle beyond the outer wall. */
  readonly lengthMm: number;
  /** Cross-section: width (horizontal, across the handle) and thickness. */
  readonly sectionMm: readonly [number, number];
  /** Azimuth from +x towards +y; default 0. */
  readonly azimuthDeg?: number;
  /** Rise of the handle above horizontal; default 0. */
  readonly elevationDeg?: number;
  readonly material?: string;
}

/** Stem and foot of stemware (`StemFootAddon`), millimetres. */
export interface StemFootAddonMm {
  readonly type: 'stem_foot';
  readonly stemRadiusMm: number;
  readonly footRadiusMm: number;
  readonly footThicknessMm: number;
  readonly material?: string;
}

/** Knob on the axis (`KnobAddon`), millimetres. */
export interface KnobAddonMm {
  readonly type: 'knob';
  /** Height of the base of the knob. */
  readonly zMm: number;
  readonly radiusMm: number;
  readonly heightMm: number;
  readonly material?: string;
}

/** Disc under the base of a pot or pan (`BaseDiscAddon`), millimetres. */
export interface BaseDiscAddonMm {
  readonly type: 'base_disc';
  readonly radiusMm: number;
  readonly thicknessMm: number;
  /** Material of the disc if it differs from the body. */
  readonly material?: string;
}

/** Pouring lip (`SpoutAddon`), millimetres and degrees. */
export interface SpoutAddonMm {
  readonly type: 'spout';
  readonly azimuthDeg: number;
  /** Width along the rim. */
  readonly widthMm: number;
  /** Projection beyond the rim. */
  readonly reachMm: number;
}

/** An add-on of a shell-of-revolution item, authoring units. */
export type SorAddonMm =
  | HandleLoopAddonMm
  | HandleBarAddonMm
  | StemFootAddonMm
  | KnobAddonMm
  | BaseDiscAddonMm
  | SpoutAddonMm;

/** Fields shared by every non-compound authoring definition (`GeometryDefBase`). */
export interface GeometryDefMmBase {
  /** Catalogue material id of the main body. */
  readonly material: string;
  /** Open-area fraction of the body (colanders, sieves), 0 to 1; default 0. */
  readonly porosity?: number;
  /**
   * Surface regions (dimensionless: sides and normalised arc lengths); the class defaults apply
   * when omitted.
   */
  readonly regions?: readonly SurfaceRegion[];
}

/** Shell of revolution with add-ons (`SorDef`), authoring units. */
export interface SorDefMm extends GeometryDefMmBase {
  readonly class: 'sor';
  /** Mid-surface profile from the axis end to the rim end, `[r, z, t]` in millimetres. */
  readonly profileMm: readonly SorProfilePointMm[];
  /** Stretch along x and y (a ratio, no unit); default `[1, 1]`. */
  readonly scaleXY?: readonly [number, number];
  readonly footRing?: FootRingDefMm;
  readonly addons?: readonly SorAddonMm[];
}

/** Open rounded-rectangle tray (`BoxShellDef`), millimetres. */
export interface BoxShellDefMm extends GeometryDefMmBase {
  readonly class: 'box_shell';
  /** Outer length along x at the top of the wall, excluding any flange. */
  readonly lengthMm: number;
  /** Outer width along y at the top of the wall, excluding any flange. */
  readonly widthMm: number;
  /** Outer height (above the lid lip, if there is one). */
  readonly heightMm: number;
  /** Thickness of the walls and the floor. */
  readonly wallMm: number;
  /** Outer corner radius in plan view. */
  readonly cornerRadiusMm: number;
  /** Width of a flange projecting outward from the top of the wall; default none. */
  readonly flangeMm?: number;
  /** Draft of the walls from the vertical, degrees (0 to 34); default 0. */
  readonly draftDeg?: number;
  /** For lids: a lip under the floor, set in from the outer edge. */
  readonly lidLip?: { readonly heightMm: number; readonly insetMm: number };
}

/** Rounded box lying on z = 0 (`SlabDef`), millimetres. */
export interface SlabDefMm extends GeometryDefMmBase {
  readonly class: 'slab';
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly thicknessMm: number;
  /** Radius of the rounded edges (at most half the thickness). */
  readonly edgeRadiusMm: number;
  /**
   * Corners cut off at 45 degrees: the length taken off both edges at the corners towards
   * (+x, +y), (-x, +y), (-x, -y) and (+x, -y); 0 leaves a corner square.
   */
  readonly cornerCutsMm?: readonly [number, number, number, number];
}

/** One node of a rod centreline (`RodNode`), millimetres. */
export interface RodNodeMm {
  /** Position in the item frame. */
  readonly pMm: Vec3;
  /** Section size across the rod (horizontal). */
  readonly widthMm: number;
  /** Section size in the remaining direction. */
  readonly thicknessMm: number;
}

/** The working end of a rod (`RodHead`), millimetres. */
export type RodHeadMm =
  | { readonly type: 'none' }
  | {
      readonly type: 'spoon_bowl';
      readonly lengthMm: number;
      readonly widthMm: number;
      /** Depth of the bowl below its rim. */
      readonly depthMm: number;
      readonly thicknessMm: number;
    }
  | {
      readonly type: 'fork_tines';
      /** Number of prongs (2 to 8). */
      readonly count: number;
      readonly lengthMm: number;
      /** Overall width across all prongs. */
      readonly widthMm: number;
      readonly thicknessMm: number;
    }
  | {
      readonly type: 'blade';
      readonly lengthMm: number;
      /** Blade height from spine to edge. */
      readonly widthMm: number;
      /** Thickness at the spine. */
      readonly thicknessMm: number;
    };

/** Section swept along a centreline, with a head (`RodDef`), millimetres. */
export interface RodDefMm extends GeometryDefMmBase {
  readonly class: 'rod';
  /** Centreline from the handle end to the head end, at least two nodes. */
  readonly nodes: readonly RodNodeMm[];
  readonly head: RodHeadMm;
}

/** One wire (`WirePolyline`), millimetres. */
export interface WirePolylineMm {
  readonly pointsMm: readonly Vec3[];
  readonly radiusMm: number;
  /** True to join the last point back to the first. Default false. */
  readonly closed?: boolean;
}

/** Capsule chains (`WireDef`), millimetres. */
export interface WireDefMm extends GeometryDefMmBase {
  readonly class: 'wire';
  readonly wires: readonly WirePolylineMm[];
}

/** Several sub-definitions rigidly joined (`CompoundDef`), millimetres and degrees. */
export interface CompoundDefMm {
  readonly class: 'compound';
  readonly children: readonly {
    readonly id: string;
    readonly def: GeometryDefMm;
    /** Position of the child's item frame in the compound's; default the origin. */
    readonly positionMm?: Vec3;
    /**
     * Orientation of the child as intrinsic X-Y-Z Euler angles in degrees (the catalogue's
     * `rot_xyz_deg` convention, `quatFromEulerXYZ`); default no rotation.
     */
    readonly rotXyzDeg?: Vec3;
  }[];
  /**
   * Names for the regions of the whole item (`CompoundDef.regionRenames`): rules tried in order
   * on the region ids prefixed with their child's id; `*` stands for any run of characters.
   */
  readonly regionRenames?: readonly RegionRename[];
}

/** Parametric geometry definition in authoring units (millimetres and degrees). */
export type GeometryDefMm =
  SorDefMm | BoxShellDefMm | SlabDefMm | RodDefMm | WireDefMm | CompoundDefMm;

function baseFromMm(def: GeometryDefMmBase): {
  material: string;
  porosity?: number;
  regions?: readonly SurfaceRegion[];
} {
  return {
    material: def.material,
    ...(def.porosity === undefined ? {} : { porosity: def.porosity }),
    ...(def.regions === undefined ? {} : { regions: def.regions }),
  };
}

function materialOf(material: string | undefined): { material?: string } {
  return material === undefined ? {} : { material };
}

function addonFromMm(addon: SorAddonMm): SorAddon {
  switch (addon.type) {
    case 'handle_loop':
      return {
        type: 'handle_loop',
        attachZ: [mmToM(addon.attachZMm[0]), mmToM(addon.attachZMm[1])],
        reach: mmToM(addon.reachMm),
        section: [mmToM(addon.sectionMm[0]), mmToM(addon.sectionMm[1])],
        ...(addon.azimuthDeg === undefined ? {} : { azimuth: degToRad(addon.azimuthDeg) }),
        ...materialOf(addon.material),
      };
    case 'handle_bar':
      return {
        type: 'handle_bar',
        attachZ: mmToM(addon.attachZMm),
        length: mmToM(addon.lengthMm),
        section: [mmToM(addon.sectionMm[0]), mmToM(addon.sectionMm[1])],
        ...(addon.azimuthDeg === undefined ? {} : { azimuth: degToRad(addon.azimuthDeg) }),
        ...(addon.elevationDeg === undefined ? {} : { elevation: degToRad(addon.elevationDeg) }),
        ...materialOf(addon.material),
      };
    case 'stem_foot':
      return {
        type: 'stem_foot',
        stemRadius: mmToM(addon.stemRadiusMm),
        footRadius: mmToM(addon.footRadiusMm),
        footThickness: mmToM(addon.footThicknessMm),
        ...materialOf(addon.material),
      };
    case 'knob':
      return {
        type: 'knob',
        z: mmToM(addon.zMm),
        radius: mmToM(addon.radiusMm),
        height: mmToM(addon.heightMm),
        ...materialOf(addon.material),
      };
    case 'base_disc':
      return {
        type: 'base_disc',
        radius: mmToM(addon.radiusMm),
        thickness: mmToM(addon.thicknessMm),
        ...materialOf(addon.material),
      };
    case 'spout':
      return {
        type: 'spout',
        azimuth: degToRad(addon.azimuthDeg),
        width: mmToM(addon.widthMm),
        reach: mmToM(addon.reachMm),
      };
  }
}

function headFromMm(head: RodHeadMm): RodHead {
  switch (head.type) {
    case 'none':
      return { type: 'none' };
    case 'spoon_bowl':
      return {
        type: 'spoon_bowl',
        length: mmToM(head.lengthMm),
        width: mmToM(head.widthMm),
        depth: mmToM(head.depthMm),
        thickness: mmToM(head.thicknessMm),
      };
    case 'fork_tines':
      return {
        type: 'fork_tines',
        count: head.count,
        length: mmToM(head.lengthMm),
        width: mmToM(head.widthMm),
        thickness: mmToM(head.thicknessMm),
      };
    case 'blade':
      return {
        type: 'blade',
        length: mmToM(head.lengthMm),
        width: mmToM(head.widthMm),
        thickness: mmToM(head.thicknessMm),
      };
  }
}

/**
 * Converts an authoring-unit definition (millimetres, degrees) to the SI `GeometryDef`
 * (metres, radians). Pure unit conversion: nothing is validated here; `expandGeometry` does that.
 */
export function geometryDefFromMm(def: GeometryDefMm): GeometryDef {
  switch (def.class) {
    case 'sor': {
      const profile: SorProfilePoint[] = def.profileMm.map(([r, z, t]) => ({
        r: mmToM(r),
        z: mmToM(z),
        t: mmToM(t),
      }));
      let footRing: FootRingDef | undefined;
      if (def.footRing !== undefined) {
        footRing = {
          r: mmToM(def.footRing.rMm),
          width: mmToM(def.footRing.widthMm),
          height: mmToM(def.footRing.heightMm),
          ...materialOf(def.footRing.material),
        };
      }
      return {
        ...baseFromMm(def),
        class: 'sor',
        profile,
        ...(def.scaleXY === undefined ? {} : { scaleXY: def.scaleXY }),
        ...(footRing === undefined ? {} : { footRing }),
        ...(def.addons === undefined ? {} : { addons: def.addons.map(addonFromMm) }),
      };
    }
    case 'box_shell':
      return {
        ...baseFromMm(def),
        class: 'box_shell',
        length: mmToM(def.lengthMm),
        width: mmToM(def.widthMm),
        height: mmToM(def.heightMm),
        wall: mmToM(def.wallMm),
        cornerRadius: mmToM(def.cornerRadiusMm),
        ...(def.flangeMm === undefined ? {} : { flange: mmToM(def.flangeMm) }),
        ...(def.draftDeg === undefined ? {} : { draft: degToRad(def.draftDeg) }),
        ...(def.lidLip === undefined
          ? {}
          : { lidLip: { height: mmToM(def.lidLip.heightMm), inset: mmToM(def.lidLip.insetMm) } }),
      };
    case 'slab':
      return {
        ...baseFromMm(def),
        class: 'slab',
        length: mmToM(def.lengthMm),
        width: mmToM(def.widthMm),
        thickness: mmToM(def.thicknessMm),
        edgeRadius: mmToM(def.edgeRadiusMm),
        ...(def.cornerCutsMm === undefined
          ? {}
          : {
              cornerCuts: [
                mmToM(def.cornerCutsMm[0]),
                mmToM(def.cornerCutsMm[1]),
                mmToM(def.cornerCutsMm[2]),
                mmToM(def.cornerCutsMm[3]),
              ] as const,
            }),
      };
    case 'rod':
      return {
        ...baseFromMm(def),
        class: 'rod',
        nodes: def.nodes.map((node) => ({
          p: v3MmToM(node.pMm),
          width: mmToM(node.widthMm),
          thickness: mmToM(node.thicknessMm),
        })),
        head: headFromMm(def.head),
      };
    case 'wire':
      return {
        ...baseFromMm(def),
        class: 'wire',
        wires: def.wires.map((wire) => ({
          points: wire.pointsMm.map(v3MmToM),
          radius: mmToM(wire.radiusMm),
          ...(wire.closed === undefined ? {} : { closed: wire.closed }),
        })),
      };
    case 'compound':
      return {
        class: 'compound',
        children: def.children.map((child) => {
          const rot = child.rotXyzDeg ?? [0, 0, 0];
          const pose: Pose = {
            p: v3MmToM(child.positionMm ?? [0, 0, 0]),
            q: quatFromEulerXYZ(degToRad(rot[0]), degToRad(rot[1]), degToRad(rot[2])),
          };
          return { id: child.id, def: geometryDefFromMm(child.def), pose };
        }),
        ...(def.regionRenames === undefined ? {} : { regionRenames: def.regionRenames }),
      };
  }
}

/**
 * `expandGeometry` for a definition in authoring units: converts with `geometryDefFromMm` and
 * expands. The resulting `Shape` is in SI units.
 */
export function expandGeometryMm(def: GeometryDefMm): Shape {
  return expandGeometry(geometryDefFromMm(def));
}
