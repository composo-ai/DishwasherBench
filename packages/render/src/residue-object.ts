/**
 * The Three.js object that draws a residue map on an item: the tiles of `residue-map.ts` as
 * two instanced meshes of unit squares, the coloured tiles over their outlines. It is made in
 * the item frame and is meant to be a child of the item's group, so that it goes where the
 * item goes.
 *
 * The tiles are not lit: a colour of the scale is the same in the shade inside a mug as on
 * the face of a plate, and the same as in the legend. They are drawn on one side only, so
 * residue on the inside of a wall does not show through from the outside.
 */

import {
  Color,
  FrontSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import type { ResidueTiles } from './residue-map.ts';
import type { Rgb } from './types.ts';

/** Name of the group a residue object is, for finding it among an item's children. */
export const RESIDUE_OBJECT_NAME = 'residue';

/** The shared unit square of every tile. */
let square: PlaneGeometry | null = null;

function unitSquare(): PlaneGeometry {
  square ??= new PlaneGeometry(1, 1);
  return square;
}

function flatMaterial(offset: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: 0xffffff,
    side: FrontSide,
    // The colours of the scale as they are, not as the tone mapping of the scene bends them.
    toneMapped: false,
    // Coplanar with the surface but for a few hundredths of a millimetre: the offset keeps the
    // order surface, outline, tile from far away, where the depth buffer cannot.
    polygonOffset: true,
    polygonOffsetFactor: -offset,
    polygonOffsetUnits: -offset,
  });
}

/** A residue object with what it must free. */
export interface ResidueObject {
  readonly object: Group;
  /** Number of tiles drawn. */
  readonly tiles: number;
  /** Frees the materials and instance buffers (the unit square is shared and stays). */
  dispose(): void;
}

/**
 * Builds the object that draws some tiles, with the outline in the given colour. With no tiles
 * the object is an empty group.
 */
export function buildResidueObject(tiles: ResidueTiles, outline: Rgb): ResidueObject {
  const group = new Group();
  group.name = RESIDUE_OBJECT_NAME;
  if (tiles.count === 0) return { object: group, tiles: 0, dispose: () => undefined };
  const outlineMaterial = flatMaterial(2);
  outlineMaterial.color.setRGB(outline[0], outline[1], outline[2], SRGBColorSpace);
  const fillMaterial = flatMaterial(4);
  const rims = new InstancedMesh(unitSquare(), outlineMaterial, tiles.count);
  const fills = new InstancedMesh(unitSquare(), fillMaterial, tiles.count);
  const matrix = new Matrix4();
  const colour = new Color();
  const colours = new Float32Array(3 * tiles.count);
  for (let t = 0; t < tiles.count; t++) {
    matrix.fromArray(tiles.outline, 16 * t);
    rims.setMatrixAt(t, matrix);
    matrix.fromArray(tiles.fill, 16 * t);
    fills.setMatrixAt(t, matrix);
    colour.setRGB(
      tiles.colour[3 * t] as number,
      tiles.colour[3 * t + 1] as number,
      tiles.colour[3 * t + 2] as number,
      SRGBColorSpace,
    );
    colours.set([colour.r, colour.g, colour.b], 3 * t);
  }
  fills.instanceColor = new InstancedBufferAttribute(colours, 3);
  for (const mesh of [rims, fills]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }
  rims.name = 'residue_outline';
  rims.renderOrder = 1;
  fills.name = 'residue_tiles';
  // After the outlines, before glass.
  fills.renderOrder = 1.5;
  group.add(rims, fills);
  return {
    object: group,
    tiles: tiles.count,
    dispose: () => {
      rims.dispose();
      fills.dispose();
      outlineMaterial.dispose();
      fillMaterial.dispose();
    },
  };
}
