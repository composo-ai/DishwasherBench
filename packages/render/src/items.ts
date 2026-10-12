/**
 * Builds the Three.js objects of items: one group per item, made of one mesh per material of
 * the item's shape, with the soil of the level (or the residue of a report) painted on its
 * regions. Meshes, geometries and materials are cached, so a level with forty identical plates
 * builds one mesh.
 */

import type { RenderMesh } from '@spotless/geometry';
import { buildRenderMesh } from '@spotless/geometry';
import type { BufferGeometry, Material } from 'three';
import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { materialAppearance } from './appearance.ts';
import { partitionTriangles, partMaterials, toBufferGeometry } from './mesh.ts';
import { createSurfaceMaterial } from './surface-material.ts';
import type { ItemTypeInput, RegionLayers, Rgb } from './types.ts';

/**
 * Chord error of item meshes, metres: 0.15 mm, a little coarser than the kernel's 0.1 mm for
 * stills, which a screen cannot tell apart and which halves the triangles of a large level.
 */
export const ITEM_CHORD_ERROR = 0.00015;

/** Canonical text of the layers of an item, for caching geometry. */
function layersKey(layers: RegionLayers): string {
  const regions = [...layers.keys()].sort();
  return JSON.stringify(regions.map((region) => [region, layers.get(region)]));
}

interface TypeEntry {
  readonly type: ItemTypeInput;
  readonly mesh: RenderMesh;
  /** Triangles of the mesh by material id. */
  readonly byMaterial: Map<string, number[]>;
  /** Geometry without soil attributes (ghosts, highlights), by material id. */
  plain: Map<string, BufferGeometry> | null;
  /** Geometry with soil attributes, by layers key then material id. */
  readonly soiled: Map<string, Map<string, BufferGeometry>>;
}

/** Builds and caches the drawable objects of item types. */
export class ItemFactory {
  private readonly types = new Map<string, TypeEntry>();
  private readonly materials = new Map<string, Material>();

  /** Makes an item type known. A type that is already known is kept. */
  addType(type: ItemTypeInput): void {
    if (this.types.has(type.item_type)) return;
    const mesh = buildRenderMesh(type.shape, { chordError: ITEM_CHORD_ERROR, minSectors: 32 });
    const materialOf = partMaterials(type.shape);
    const byMaterial = partitionTriangles(
      mesh,
      (partId) => materialOf.get(partId) ?? type.material,
    );
    this.types.set(type.item_type, { type, mesh, byMaterial, plain: null, soiled: new Map() });
  }

  /** True when the type has been added. */
  hasType(itemType: string): boolean {
    return this.types.has(itemType);
  }

  private entry(itemType: string): TypeEntry {
    const entry = this.types.get(itemType);
    if (entry === undefined) throw new Error(`item type '${itemType}' has not been added`);
    return entry;
  }

  private surfaceMaterial(materialId: string): Material {
    let material = this.materials.get(materialId);
    if (material === undefined) {
      material = createSurfaceMaterial(materialAppearance(materialId), { soil: true });
      this.materials.set(materialId, material);
    }
    return material;
  }

  /**
   * A group that draws one item of the type in its item frame (metres), with the given layers
   * on its regions. The geometry and materials belong to the factory: do not dispose of them.
   */
  build(itemType: string, layers: RegionLayers): Group {
    const entry = this.entry(itemType);
    const key = layersKey(layers);
    let geometries = entry.soiled.get(key);
    if (geometries === undefined) {
      geometries = new Map();
      for (const [materialId, triangles] of entry.byMaterial) {
        geometries.set(materialId, toBufferGeometry(entry.mesh, triangles, layers));
      }
      entry.soiled.set(key, geometries);
    }
    const group = new Group();
    for (const [materialId, geometry] of geometries) {
      const mesh = new Mesh(geometry, this.surfaceMaterial(materialId));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Glass after opaque surfaces.
      mesh.renderOrder = materialAppearance(materialId).opacity < 1 ? 2 : 0;
      group.add(mesh);
    }
    return group;
  }

  private plainGeometries(entry: TypeEntry): Map<string, BufferGeometry> {
    if (entry.plain === null) {
      entry.plain = new Map();
      for (const [materialId, triangles] of entry.byMaterial) {
        entry.plain.set(materialId, toBufferGeometry(entry.mesh, triangles));
      }
    }
    return entry.plain;
  }

  /**
   * A group that draws the shape of the type in one material: for ghosts and highlights. The
   * material belongs to the caller.
   */
  buildPlain(itemType: string, material: Material): Group {
    const group = new Group();
    for (const geometry of this.plainGeometries(this.entry(itemType)).values()) {
      group.add(new Mesh(geometry, material));
    }
    return group;
  }

  /** Catalogue material of the body of the type. */
  materialOf(itemType: string): string {
    return this.entry(itemType).type.material;
  }

  /** Radius of the sphere about the item-frame origin that holds the type, metres. */
  boundingRadius(itemType: string): number {
    let radius = 0;
    const positions = this.entry(itemType).mesh.positions;
    for (let i = 0; i < positions.length; i += 3) {
      radius = Math.max(
        radius,
        Math.hypot(positions[i] as number, positions[i + 1] as number, positions[i + 2] as number),
      );
    }
    return radius;
  }

  /** Corners of the item-frame bounding box of the type, metres. */
  bounds(itemType: string): { min: [number, number, number]; max: [number, number, number] } {
    const positions = this.entry(itemType).mesh.positions;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[i + axis] as number;
        if (value < (min[axis] as number)) min[axis] = value;
        if (value > (max[axis] as number)) max[axis] = value;
      }
    }
    return { min, max };
  }

  /** Frees every geometry and material the factory made. */
  dispose(): void {
    for (const entry of this.types.values()) {
      for (const geometry of entry.plain?.values() ?? []) geometry.dispose();
      for (const geometries of entry.soiled.values()) {
        for (const geometry of geometries.values()) geometry.dispose();
      }
    }
    for (const material of this.materials.values()) material.dispose();
    this.types.clear();
    this.materials.clear();
  }
}

/** A translucent material for a ghost of the given tint. */
export function createGhostMaterial(tint: Rgb, opacity = 0.5): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color().setRGB(tint[0], tint[1], tint[2]),
    roughness: 0.6,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

/** A flat translucent material laid over an item to mark it. */
export function createHighlightMaterial(tint: Rgb, opacity = 0.35): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color().setRGB(tint[0], tint[1], tint[2]),
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}
