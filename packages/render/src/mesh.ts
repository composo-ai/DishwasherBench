/**
 * From the geometry kernel's render mesh to Three.js geometry: splitting a mesh by what its
 * triangles are made of, and packing the soil layers of each region into vertex attributes for
 * the surface shader.
 */

import type { RenderMesh, Shape } from '@spotless/geometry';
import { BufferAttribute, BufferGeometry } from 'three';
import { coverageThreshold, MAX_LAYERS_PER_REGION, srgbToLinear } from './soil-layers.ts';
import type { RegionLayers, SoilLayer } from './types.ts';

/**
 * Splits the triangles of a mesh into groups by a key computed per triangle (from the id of its
 * part and of its region, `null` when it is in no region). Returns, per key in order of first
 * appearance, the indices of the triangles of the group.
 */
export function partitionTriangles(
  mesh: RenderMesh,
  keyOf: (partId: string, regionId: string | null) => string,
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  const triangles = mesh.indices.length / 3;
  for (let t = 0; t < triangles; t++) {
    const partId = mesh.partIds[mesh.triPart[t] as number] as string;
    const regionIndex = mesh.triRegion[t] as number;
    const regionId = regionIndex < 0 ? null : (mesh.regionIds[regionIndex] as string);
    const key = keyOf(partId, regionId);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [t]);
    else list.push(t);
  }
  return groups;
}

/** Material id of every part of a shape, by part id. */
export function partMaterials(shape: Shape): Map<string, string> {
  return new Map(shape.parts.map((part) => [part.id, part.material]));
}

/** Per-vertex soil data of one layer: colour and threshold, then the pattern's parameters. */
function packLayer(layer: SoilLayer | undefined): readonly [number[], number[]] {
  if (layer === undefined)
    return [
      [0, 0, 0, -1],
      [1, 0, 0.5, 0.5],
    ];
  return [
    [
      srgbToLinear(layer.colour[0]),
      srgbToLinear(layer.colour[1]),
      srgbToLinear(layer.colour[2]),
      coverageThreshold(layer.coverage),
    ],
    [layer.frequency, layer.opacity, layer.roughness, layer.softness],
  ];
}

/** Names of the vertex attributes that carry the soil layers, in layer order. */
export const SOIL_ATTRIBUTES: readonly (readonly [string, string])[] = [
  ['soilA', 'soilAP'],
  ['soilB', 'soilBP'],
];

/**
 * Three.js geometry of some triangles of a render mesh (all of them by default), in the units
 * of the mesh (metres, item frame). The triangles are not indexed, so that each can carry the
 * soil of its own region: with `layers`, every vertex gets the layers of its triangle's region
 * in the attributes of {@link SOIL_ATTRIBUTES} (a threshold of -1 where there is no layer).
 */
export function toBufferGeometry(
  mesh: RenderMesh,
  triangles?: readonly number[],
  layers?: RegionLayers,
): BufferGeometry {
  const count = triangles === undefined ? mesh.indices.length / 3 : triangles.length;
  const positions = new Float32Array(count * 9);
  const normals = new Float32Array(count * 9);
  const soil =
    layers === undefined
      ? null
      : SOIL_ATTRIBUTES.map(() => [new Float32Array(count * 12), new Float32Array(count * 12)]);
  const packed = new Map<number, (readonly [number[], number[]])[]>();
  for (let i = 0; i < count; i++) {
    const t = triangles === undefined ? i : (triangles[i] as number);
    for (let corner = 0; corner < 3; corner++) {
      const v = mesh.indices[3 * t + corner] as number;
      const at = 9 * i + 3 * corner;
      positions[at] = mesh.positions[3 * v] as number;
      positions[at + 1] = mesh.positions[3 * v + 1] as number;
      positions[at + 2] = mesh.positions[3 * v + 2] as number;
      normals[at] = mesh.normals[3 * v] as number;
      normals[at + 1] = mesh.normals[3 * v + 1] as number;
      normals[at + 2] = mesh.normals[3 * v + 2] as number;
    }
    if (soil !== null && layers !== undefined) {
      const regionIndex = mesh.triRegion[t] as number;
      let data = packed.get(regionIndex);
      if (data === undefined) {
        const regionLayers =
          regionIndex < 0 ? [] : (layers.get(mesh.regionIds[regionIndex] as string) ?? []);
        data = [];
        for (let l = 0; l < MAX_LAYERS_PER_REGION; l++) data.push(packLayer(regionLayers[l]));
        packed.set(regionIndex, data);
      }
      for (let l = 0; l < soil.length; l++) {
        const [colour, params] = data[l] as readonly [number[], number[]];
        const [colourArray, paramArray] = soil[l] as [Float32Array, Float32Array];
        for (let corner = 0; corner < 3; corner++) {
          colourArray.set(colour, 12 * i + 4 * corner);
          paramArray.set(params, 12 * i + 4 * corner);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  if (soil !== null) {
    SOIL_ATTRIBUTES.forEach(([colourName, paramName], l) => {
      const [colourArray, paramArray] = soil[l] as [Float32Array, Float32Array];
      geometry.setAttribute(colourName, new BufferAttribute(colourArray, 4));
      geometry.setAttribute(paramName, new BufferAttribute(paramArray, 4));
    });
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
