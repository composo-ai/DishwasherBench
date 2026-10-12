/**
 * The loader API of the catalogue: item types by id, and `instantiate`, which turns an item type
 * into the SI shape, mass properties and contact material the physics, render and simulation
 * packages consume.
 *
 * Item records are authored in millimetres, grams and degrees; conversion to SI happens here,
 * once, on load (docs/design/platform.md section 2).
 */

import type { Vec3 } from '@spotless/core';
import { degToRad, quatCanonical, quatFromEulerXYZ, quatNormalise } from '@spotless/core';
import {
  boundingBox,
  expandGeometryMm,
  materialVolume,
  partSelectorMatches,
  surfaceArea,
} from '@spotless/geometry';
import { ITEM_TYPES } from './items/index.ts';
import { massPropertiesOf, scaleShape } from './shape-util.ts';
import type {
  InstancePose,
  InstantiateOptions,
  ItemInstance,
  ItemType,
  Provenance,
  StablePose,
} from './types.ts';

const BY_ID: ReadonlyMap<string, ItemType> = new Map(ITEM_TYPES.map((t) => [t.id, t]));

const SORTED: readonly ItemType[] = [...ITEM_TYPES].sort((a, b) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
);

/** True when the catalogue has an item type with this id. */
export function hasItemType(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * The item type with the given catalogue id. Throws a RangeError for an unknown id: item type
 * ids come from level data, never from players.
 */
export function getItemType(id: string): ItemType {
  const found = BY_ID.get(id);
  if (found === undefined) throw new RangeError(`catalogue: unknown item type '${id}'`);
  return found;
}

/** Every item type, sorted by id (the canonical order). */
export function listItemTypes(): readonly ItemType[] {
  return SORTED;
}

/**
 * Catalogue material of a part of an item type: the first entry of `materials` that selects the
 * part. Throws a RangeError when none does.
 */
export function partMaterialOf(type: ItemType, partId: string): string {
  for (const entry of type.materials) {
    if (partSelectorMatches(entry.part, partId)) return entry.material;
  }
  throw new RangeError(`catalogue: item type '${type.id}' names no material for part '${partId}'`);
}

/**
 * Material of an item type's main body: the material of the part called `body` if there is one,
 * otherwise the catch-all entry of `materials`, otherwise its first entry.
 */
export function bodyMaterialOf(type: ItemType): string {
  for (const entry of type.materials) {
    if (partSelectorMatches(entry.part, 'body')) return entry.material;
  }
  const first = type.materials[0];
  if (first === undefined)
    throw new RangeError(`catalogue: item type '${type.id}' has no material`);
  return first.material;
}

/**
 * The dossier-style provenance summary of an item type (items.md section 9): the tag of every
 * stated dimension by name, of the mass and of the profile.
 */
export function itemProvenance(type: ItemType): {
  readonly dims: Readonly<Record<string, Provenance>>;
  readonly mass: Provenance;
  readonly profile: Provenance;
} {
  const dims: Record<string, Provenance> = {};
  for (const d of type.dimensions) dims[d.name] = d.tag;
  return { dims, mass: type.mass.tag, profile: type.profile.tag };
}

/**
 * The stated dimensions of an item type by name, millimetres: the `dims` of a level card
 * (`{ diameter: 270, height: 30 }` for a dinner plate).
 */
export function itemDimensionsMm(type: ItemType): Readonly<Record<string, number>> {
  const dims: Record<string, number> = {};
  for (const d of type.dimensions) dims[d.name] = d.valueMm;
  return dims;
}

/** The unit quaternion of a named pose (item frame to placement frame). */
export function poseQuaternion(pose: StablePose): InstancePose['q'] {
  const [rx, ry, rz] = pose.rotXyzDeg;
  return quatCanonical(quatNormalise(quatFromEulerXYZ(degToRad(rx), degToRad(ry), degToRad(rz))));
}

function build(type: ItemType, scale: number): ItemInstance {
  const shape = scaleShape(expandGeometryMm(type.geometry), scale);
  // boundingBox validates the shape, including item-level regions.
  const bbox = boundingBox(shape);
  const referencePoint: Vec3 = [
    0.5 * (bbox.min[0] + bbox.max[0]),
    0.5 * (bbox.min[1] + bbox.max[1]),
    0.5 * (bbox.min[2] + bbox.max[2]),
  ];
  const regionAreas: Record<string, number> = {};
  for (const region of shape.regions) {
    if (regionAreas[region.id] === undefined)
      regionAreas[region.id] = surfaceArea(shape, region.id);
  }
  return {
    type,
    scale,
    shape,
    mass: massPropertiesOf(shape),
    contact: { material: bodyMaterialOf(type) },
    bbox,
    referencePoint,
    volume: materialVolume(shape),
    regionAreas,
    stablePoses: type.placement.stablePoses.map((pose) => ({
      name: pose.name,
      q: poseQuaternion(pose),
      freeStanding: pose.freeStanding,
    })),
  };
}

const instances = new Map<string, ItemInstance>();

/** Smallest and largest scale `instantiate` accepts. */
export const INSTANTIATE_SCALE_RANGE: readonly [number, number] = [0.5, 2];

/**
 * An item type record made ready for use, whether or not the record is in the catalogue: its
 * `Shape`, mass properties, contact material, bounding box, region areas and named poses, all
 * in SI units and in the item frame. Nothing is cached. Used by `instantiate`, by validation
 * and by callers that build item types of their own (variants for a level, test fixtures).
 *
 * Throws a RangeError for a scale outside 0.5 to 2 and for a record the geometry kernel or the
 * material table rejects (a data error).
 */
export function instantiateItemType(
  type: ItemType,
  options: InstantiateOptions = {},
): ItemInstance {
  const scale = options.scale ?? 1;
  if (
    !Number.isFinite(scale) ||
    scale < INSTANTIATE_SCALE_RANGE[0] ||
    scale > INSTANTIATE_SCALE_RANGE[1]
  ) {
    throw new RangeError(`catalogue: scale must be between 0.5 and 2, got ${scale}`);
  }
  return build(type, scale);
}

/**
 * An item type made ready for use: its `Shape` (the single description render meshes, collision
 * pieces and simulation surfaces derive from), its mass properties, its contact material, its
 * bounding box and its named poses as quaternions, all in SI units and in the item frame.
 *
 * `options.scale` scales every length uniformly (parametric jitter within a class). The result
 * must be treated as read-only; at scale 1 it is cached. Throws a RangeError for an unknown id,
 * for a scale outside 0.5 to 2, and for a geometry definition the kernel rejects (a data error).
 */
export function instantiate(itemTypeId: string, options: InstantiateOptions = {}): ItemInstance {
  const type = getItemType(itemTypeId);
  if ((options.scale ?? 1) !== 1) return instantiateItemType(type, options);
  const cached = instances.get(itemTypeId);
  if (cached !== undefined) return cached;
  const instance = instantiateItemType(type);
  instances.set(itemTypeId, instance);
  return instance;
}
