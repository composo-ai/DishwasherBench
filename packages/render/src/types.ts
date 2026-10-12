/**
 * Types of the render package: what a scene is built from and how a view is described.
 *
 * The inputs are structural: they are satisfied by the geometry payload and the draw poses the
 * game server sends (`GeometryPayload`, `DrawPose` of `@spotless/server`) without this package
 * depending on the server. Shapes are in kernel units (SI, quaternions `[x, y, z, w]`); draw
 * poses and everything a player reads are in wire units (millimetres, `quat_wxyz`).
 */

import type { Pose } from '@spotless/core';
import type { Shape } from '@spotless/geometry';

/** A position or size in millimetres. */
export type Mm3 = readonly [x: number, y: number, z: number];

/**
 * Where a body is drawn: the pose of its own frame in the tub frame, millimetres and a
 * quaternion in (w, x, y, z) order that need not be exactly unit.
 */
export interface DrawPoseInput {
  readonly position_mm: Mm3;
  readonly quat_wxyz: readonly [w: number, x: number, y: number, z: number];
}

/** One machine part to draw. */
export interface MachinePartInput {
  /** For example `'tub'`, `'lower_rack'`, `'upper_arm'`. */
  readonly id: string;
  /** For example `'tub'`, `'wires'`, `'basket'`, `'arm'`. */
  readonly role: string;
  /** Catalogue material of the part as a whole (single parts of the shape may differ). */
  readonly material: string;
  /** Part frame to tub frame with the baskets in and the door closed, SI. */
  readonly reference_pose: Pose;
  readonly shape: Shape;
}

/** One item type to draw. */
export interface ItemTypeInput {
  readonly item_type: string;
  /** Catalogue material of the body. */
  readonly material: string;
  readonly shape: Shape;
}

/** One soil on an item, as the level card states it. */
export interface SoilInput {
  /** Catalogue soil id. */
  readonly type: string;
  /** Regions of the item that carry the soil, with the fraction of each that is covered. */
  readonly regions: readonly { readonly region: string; readonly coverage: number }[];
}

/** Linear RGB is never used here: colours are sRGB triples with components in [0, 1]. */
export type Rgb = readonly [r: number, g: number, b: number];

/** How a material is drawn. */
export interface MaterialAppearance {
  /** Base colour, sRGB. */
  readonly colour: Rgb;
  readonly metalness: number;
  readonly roughness: number;
  /** Below 1 for glass and clear plastics. */
  readonly opacity: number;
  /** Strength of the environment reflections. */
  readonly envIntensity: number;
  /** What the material reads as, for legends: `'glazed ceramic'`, `'glass'`, ... */
  readonly label: string;
}

/** How a soil is drawn on a surface. */
export interface SoilAppearance {
  /** Colour of the soil, sRGB. */
  readonly colour: Rgb;
  /** Features of the pattern per metre: low for smears and films, high for specks. */
  readonly frequency: number;
  /** How strongly the soil covers the surface underneath where it lies, 0 to 1. */
  readonly opacity: number;
  /** Roughness of the soiled surface (dried soil is matt, grease is glossy). */
  readonly roughness: number;
  /** Width of the edge of a patch as a share of the pattern's range: 0 hard, 1 very soft. */
  readonly softness: number;
}

/** One layer of soil (or residue) painted on a region of a mesh. */
export interface SoilLayer extends SoilAppearance {
  /** Fraction of the region the layer covers, 0 to 1. */
  readonly coverage: number;
}

/** Up to two layers per region, keyed by region id. */
export type RegionLayers = ReadonlyMap<string, readonly SoilLayer[]>;

/** The named views of the scene. */
export type SceneViewName =
  | 'iso_lower'
  | 'iso_upper'
  | 'top_lower'
  | 'top_upper'
  | 'top_cutlery'
  | 'front'
  | 'left'
  | 'right';

/** Every {@link SceneViewName}. */
export const SCENE_VIEW_NAMES: readonly SceneViewName[] = [
  'iso_lower',
  'iso_upper',
  'top_lower',
  'top_upper',
  'top_cutlery',
  'front',
  'left',
  'right',
];

/** A rack as a view needs it: where it is now and how big. Tub frame, millimetres. */
export interface ViewRack {
  readonly rack: string;
  /** Origin of the rack frame now. */
  readonly origin_mm: Mm3;
  /** Size of the loading envelope along the rack axes. */
  readonly envelope_mm: Mm3;
}

/** What the camera of a view is computed from. Tub frame, millimetres. */
export interface ViewSubject {
  readonly tub_min_mm: Mm3;
  readonly tub_max_mm: Mm3;
  readonly racks: readonly ViewRack[];
}

/** A camera placement. Tub frame, millimetres; z is up. */
export interface CameraSpec {
  readonly kind: 'perspective' | 'orthographic';
  readonly position_mm: Mm3;
  readonly target_mm: Mm3;
  /** Up vector of the camera (+z; a plan view is tilted a hair so that +y is up in it). */
  readonly up: Mm3;
  /** Perspective: vertical field of view, degrees. */
  readonly fov_deg: number;
  /** Orthographic: half of the visible height at the target, millimetres. */
  readonly half_height_mm: number;
  /**
   * Height in the tub frame above which nothing is drawn, or null: set for a plan view of a
   * basket that has another basket over it.
   */
  readonly clip_above_mm: number | null;
  /**
   * Height in the tub frame below which nothing is drawn, or null or absent: set for a plan
   * view of a basket that hangs over another, so that the load of the basket underneath does
   * not show through its wires.
   */
  readonly clip_below_mm?: number | null;
}
