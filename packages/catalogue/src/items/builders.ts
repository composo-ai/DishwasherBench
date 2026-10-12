/**
 * Helpers for writing item records compactly: provenance shorthands, stated dimensions, named
 * poses, region labels and the family templates that carry what docs/research/items.md section
 * 10.3 states per family (usual placement, typical soils, behaviour).
 *
 * Nothing here computes geometry: an item's shape is exactly what its `geometry` definition
 * says. Units are the authoring units (millimetres, grams, degrees).
 */

import type { Vec3 } from '@spotless/core';
import type {
  GeometryDefMm,
  RegionRename,
  SorProfilePointMm,
  SurfaceRegion,
} from '@spotless/geometry';
import type {
  DimensionMeasure,
  ItemCategory,
  ItemFlags,
  ItemReference,
  ItemSurfaceRegion,
  ItemType,
  PartMaterial,
  Provenance,
  RackZone,
  ShapeTag,
  SoilPattern,
  StablePose,
  StatedDimension,
  StatedMass,
  TypicalSoil,
} from '../types.ts';

/** [VERIFIED] */
export const V: Provenance = 'VERIFIED';
/** [RECALLED] */
export const R: Provenance = 'RECALLED';
/** [ESTIMATED] */
export const E: Provenance = 'ESTIMATED';

/**
 * Points an item is worth when a level does not say otherwise. [ESTIMATED] the value of the
 * schema example of items.md section 9; the same for every type, as the test standards weigh
 * every item equally (docs/research/standards.md section 6.3). Levels draw their own values.
 */
export const DEFAULT_POINTS = 10;

/** Bounding-box extent of the whole item along x: overall length, handles included. */
export const ALONG_X: DimensionMeasure = { kind: 'bbox', axis: 'x' };
/** Bounding-box extent of the whole item along y: the width, or the diameter of a round body. */
export const ALONG_Y: DimensionMeasure = { kind: 'bbox', axis: 'y' };
/** Bounding-box extent of the whole item along z: the height, or the thickness of a slab. */
export const ALONG_Z: DimensionMeasure = { kind: 'bbox', axis: 'z' };
/** Outer diameter at the rim of the body. */
export const AT_RIM: DimensionMeasure = { kind: 'rim_diameter' };
/** Outer diameter at the base corner of the body. */
export const AT_BASE: DimensionMeasure = { kind: 'base_diameter' };
/** Inner depth of the body, rim top to the inner face of the base. */
export const INNER_DEPTH: DimensionMeasure = { kind: 'inner_depth' };

/** Extent of the parts selected by `parts` along an axis. */
export function extentOf(parts: string, axis: 'x' | 'y' | 'z'): DimensionMeasure {
  return { kind: 'bbox', axis, parts };
}

/** Optional facts about a stated dimension. */
export interface DimExtra {
  readonly rangeMm?: readonly [number, number];
  readonly note?: string;
}

/**
 * A stated dimension. `measure` says how validation measures it on the geometry; pass `null`
 * for a dimension the geometry does not model (and say why in `extra.note`).
 */
export function dim(
  name: string,
  valueMm: number,
  tag: Provenance,
  measure: DimensionMeasure | null,
  extra: DimExtra = {},
): StatedDimension {
  return {
    name,
    valueMm,
    tag,
    ...(measure === null ? {} : { measure }),
    ...(extra.rangeMm === undefined ? {} : { rangeMm: extra.rangeMm }),
    ...(extra.note === undefined ? {} : { note: extra.note }),
  };
}

/** Outer diameter of a round body, measured across y (handles and spouts lie along x). */
export function diameter(valueMm: number, tag: Provenance, extra: DimExtra = {}): StatedDimension {
  return dim('diameter', valueMm, tag, ALONG_Y, extra);
}

/** Overall height, measured along z. */
export function height(valueMm: number, tag: Provenance, extra: DimExtra = {}): StatedDimension {
  return dim('height', valueMm, tag, ALONG_Z, extra);
}

/** Overall length, measured along x. */
export function length(valueMm: number, tag: Provenance, extra: DimExtra = {}): StatedDimension {
  return dim('length', valueMm, tag, ALONG_X, extra);
}

/** Overall width, measured along y. */
export function width(valueMm: number, tag: Provenance, extra: DimExtra = {}): StatedDimension {
  return dim('width', valueMm, tag, ALONG_Y, extra);
}

/** Optional facts about a stated mass. */
export interface MassExtra {
  readonly rangeG?: readonly [number, number];
  readonly grossG?: number;
  readonly note?: string;
}

/** A stated mass in grams. */
export function mass(valueG: number, tag: Provenance, extra: MassExtra = {}): StatedMass {
  return {
    valueG,
    tag,
    ...(extra.rangeG === undefined ? {} : { rangeG: extra.rangeG }),
    ...(extra.grossG === undefined ? {} : { grossG: extra.grossG }),
    ...(extra.note === undefined ? {} : { note: extra.note }),
  };
}

/** A named orientation (intrinsic X-Y-Z Euler angles, degrees). */
export function pose(
  name: string,
  rotXyzDeg: Vec3,
  freeStanding: boolean,
  description: string,
): StablePose {
  return { name, rotXyzDeg, freeStanding, description };
}

/** The whole item is one material. */
export function allOf(material: string): readonly PartMaterial[] {
  return [{ part: '*', material }];
}

/**
 * Normalised arc length of every vertex of a mid-surface profile, 0 at the axis end and 1 at the
 * rim end: the `sRange` coordinate of surface regions on a shell of revolution.
 */
export function profileArcFractions(profileMm: readonly SorProfilePointMm[]): number[] {
  const s: number[] = [0];
  for (let i = 1; i < profileMm.length; i++) {
    const a = profileMm[i - 1] as SorProfilePointMm;
    const b = profileMm[i] as SorProfilePointMm;
    s.push((s[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = s[s.length - 1] as number;
  return s.map((x) => x / total);
}

/**
 * Regions of a pot or pan body as a test standard scores it (docs/research/standards.md section
 * 5.1: inner bottom, inner wall, outer surface): `interior_base` up to the profile vertex
 * `cornerIndex`, `interior_wall` beyond it, and `exterior`.
 */
export function potBodyRegions(
  profileMm: readonly SorProfilePointMm[],
  cornerIndex: number,
): SurfaceRegion[] {
  const corner = profileArcFractions(profileMm)[cornerIndex];
  if (corner === undefined || !(corner > 0 && corner < 1)) {
    throw new RangeError('catalogue: the base corner must be an inner vertex of the profile');
  }
  return [
    { id: 'interior_base', part: 'body', side: 'in', sRange: [0, corner] },
    { id: 'interior_wall', part: 'body', side: 'in', sRange: [corner, 1] },
    { id: 'exterior', part: 'body', side: 'out' },
  ];
}

/** Label and food-contact flag of the region ids the geometry kernel and this catalogue use. */
const REGION_LABELS: Readonly<Record<string, readonly [label: string, foodContact: boolean]>> = {
  rim: ['rim', true],
  well: ['eating face', true],
  underside: ['underside', false],
  interior: ['inside', true],
  interior_base: ['inside base', true],
  interior_wall: ['inside wall', true],
  exterior: ['outside', false],
  foot: ['foot', false],
  base: ['base', false],
  handle: ['handle', false],
  stem: ['stem', false],
  knob: ['knob', false],
  spout: ['pouring lip', true],
  flange: ['rim flange', true],
  lip: ['sealing lip', true],
  top: ['top face', true],
  edge: ['edge', false],
  bowl: ['bowl', true],
  bowl_back: ['back of the bowl', true],
  tines: ['tines', true],
  blade: ['blade', true],
  head: ['head', true],
  wire: ['wires', true],
  wires: ['wires', true],
  cavities: ['cavities', true],
  mesh: ['mesh', true],
  frame: ['frame', false],
  grating: ['grating faces', true],
  inside: ['inside', true],
};

/**
 * Surface-region records for the given region ids, with the standard labels. `overrides` gives
 * a different label or food-contact flag for some ids.
 */
export function regionsOf(
  ids: readonly string[],
  overrides: Readonly<Record<string, readonly [label: string, foodContact: boolean]>> = {},
): ItemSurfaceRegion[] {
  return ids.map((id) => {
    const entry = overrides[id] ?? REGION_LABELS[id];
    if (entry === undefined) throw new RangeError(`catalogue: no label for region '${id}'`);
    return { id, label: entry[0], foodContact: entry[1] };
  });
}

/**
 * A region rename rule for the `regionRenames` of a compound geometry definition (the kernel's
 * `RegionRename`): regions whose child-prefixed id matches `from` (`*` is any run of characters)
 * are called `to`.
 */
export function rename(from: string, to: string): RegionRename {
  return { from, to };
}

/** A typical soil of a family: region, soil id, pattern. */
export function soil(region: string, soilId: string, pattern: SoilPattern): TypicalSoil {
  return { region, soil: soilId, pattern };
}

/** What items.md section 10.3 states for a family of items, plus its classification. */
export interface Family {
  readonly category: ItemCategory;
  readonly itemClass: string;
  readonly shapeTag: ShapeTag;
  readonly zones: readonly RackZone[];
  readonly poses: readonly StablePose[];
  readonly recommendedPose: string;
  /** "Usual placement" of items.md table 10.3. */
  readonly usual: string;
  /** "Behaviour to capture" of items.md table 10.3. */
  readonly behaviour: string;
  readonly soils: readonly TypicalSoil[];
  readonly flags: ItemFlags;
}

/** The record of one item type, given its family and what is specific to it. */
export interface ItemSpec {
  readonly id: string;
  readonly row: number | null;
  readonly name: string;
  readonly product: string;
  readonly standardItem?: string;
  readonly sources: readonly string[];
  readonly dimensions: readonly StatedDimension[];
  readonly mass: StatedMass;
  readonly profileTag?: Provenance;
  /** How the geometry was arrived at. */
  readonly profileNote: string;
  readonly materials: readonly PartMaterial[];
  readonly geometry: GeometryDefMm;
  /** Region ids of the expanded shape (standard labels), or full region records. */
  readonly surfaceRegions: readonly (string | ItemSurfaceRegion)[];
  // Overrides of the family.
  readonly itemClass?: string;
  readonly shapeTag?: ShapeTag;
  readonly zones?: readonly RackZone[];
  readonly poses?: readonly StablePose[];
  readonly recommendedPose?: string;
  readonly soils?: readonly TypicalSoil[];
  readonly flags?: Partial<ItemFlags>;
  readonly usual?: string;
  readonly behaviour?: string;
  readonly notes?: string;
}

/** Builds the full record of an item type from its family template and its own data. */
export function defineItem(family: Family, spec: ItemSpec): ItemType {
  const reference: ItemReference = {
    product: spec.product,
    standardItem: spec.standardItem ?? null,
    sources: spec.sources,
  };
  const surfaceRegions = spec.surfaceRegions.map((r) =>
    typeof r === 'string' ? (regionsOf([r])[0] as ItemSurfaceRegion) : r,
  );
  const ids = new Set(surfaceRegions.map((r) => r.id));
  // A family lists soils for every region its members can have; keep those this item has.
  const typicalSoils = (spec.soils ?? family.soils).filter((s) => ids.has(s.region));
  return {
    id: spec.id,
    row: spec.row,
    name: spec.name,
    category: family.category,
    itemClass: spec.itemClass ?? family.itemClass,
    shapeTag: spec.shapeTag ?? family.shapeTag,
    reference,
    dimensions: spec.dimensions,
    mass: spec.mass,
    profile: { tag: spec.profileTag ?? E, note: spec.profileNote },
    materials: spec.materials,
    geometry: spec.geometry,
    surfaceRegions,
    typicalSoils,
    placement: {
      zones: spec.zones ?? family.zones,
      stablePoses: spec.poses ?? family.poses,
      recommendedPose: spec.recommendedPose ?? family.recommendedPose,
      usual: spec.usual ?? family.usual,
      behaviour: spec.behaviour ?? family.behaviour,
    },
    flags: { ...family.flags, ...spec.flags },
    game: { defaultPoints: DEFAULT_POINTS },
    ...(spec.notes === undefined ? {} : { notes: spec.notes }),
  };
}

// ---------------------------------------------------------------------------------------------
// Named poses shared by families. Rotations map the item frame to the rack frame: +x right,
// +y towards the back of the machine, +z up. A rotation of +90 degrees about x turns the item's
// upper side (+z) towards the front (-y).
// ---------------------------------------------------------------------------------------------

/** As the item stands on a table. */
export const UPRIGHT = pose('upright', [0, 0, 0], true, 'standing as it would on a table');
/** Upside down on a rim that lies in one plane. */
export const INVERTED = pose('inverted', [180, 0, 0], true, 'upside down, resting on its rim');
/** Upside down where a handle, knob or foot keeps the rim off the surface. */
export const INVERTED_SUPPORTED = pose(
  'inverted',
  [180, 0, 0],
  false,
  'upside down, held level by the rack',
);
/** Upside down and tilted 20 degrees so that the base drains. */
export const INVERTED_TILTED = pose(
  'inverted_tilted',
  [160, 0, 0],
  false,
  'upside down and tilted 20 degrees so that water runs off the base',
);
/** Opening facing down and to the front at 45 degrees. */
export const INCLINED = pose(
  'inclined',
  [135, 0, 0],
  false,
  'leaning against the tines, opening facing down and to the front at 45 degrees',
);
/** On its side, opening or upper face to the front. */
export const ON_SIDE = pose(
  'on_side',
  [90, 0, 0],
  false,
  'lying on its side, opening to the front',
);
/** On edge between tines, upper face to the front. */
export const ON_EDGE = pose(
  'on_edge',
  [90, 0, 0],
  false,
  'standing on its edge between tines, upper face towards the front',
);
/** On edge between tines, upper face to the back. */
export const ON_EDGE_REVERSED = pose(
  'on_edge_reversed',
  [-90, 0, 0],
  false,
  'standing on its edge between tines, upper face towards the back',
);
/** On edge, leaning back 20 degrees. */
export const LEANING = pose(
  'leaning',
  [70, 0, 0],
  false,
  'on its edge and leaning back 20 degrees, upper face towards the front and slightly up',
);
/** Lying flat, as on a table. */
export const FLAT = pose('flat', [0, 0, 0], true, 'lying flat as on a table');
/** Lying flat, turned over, for items that rock or roll that way up (spoons, forks). */
export const FLAT_INVERTED = pose('flat_inverted', [180, 0, 0], false, 'lying flat, turned over');
/** Lying flat, turned over, for items that lie as steadily on either face (boards, knives). */
export const FLAT_INVERTED_STEADY = pose(
  'flat_inverted',
  [180, 0, 0],
  true,
  'lying flat, turned over',
);
/** Standing in a basket cell, handle down. */
export const HANDLE_DOWN = pose(
  'handle_down',
  [0, -90, 0],
  false,
  'standing in a basket cell with the handle down',
);
/** Standing in a basket cell, handle up. */
export const HANDLE_UP = pose(
  'handle_up',
  [0, 90, 0],
  false,
  'standing in a basket cell with the handle up',
);
/** Lying on its long edge. */
export const ON_LONG_EDGE = pose(
  'on_long_edge',
  [90, 0, 0],
  false,
  'standing on a long edge, upper face towards the front',
);
/** Standing on a short edge. */
export const ON_SHORT_EDGE = pose(
  'on_short_edge',
  [90, 0, 90],
  false,
  'standing on a short edge, upper face towards the front',
);
