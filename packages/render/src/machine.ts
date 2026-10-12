/**
 * Builds the Three.js objects of the machine from its parts: one group per part, drawn from
 * the part's shape through the geometry kernel's render mesh, split by material. The shell of
 * the tub and the door are split into panels that can be left out one by one, so that the
 * camera can look into the machine from any side (`applyCutaway`).
 */

import type { Part } from '@spotless/geometry';
import { boundingBox, buildRenderMesh } from '@spotless/geometry';
import type { Material, Object3D, Texture } from 'three';
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from 'three';
import { machinePartAppearance } from './appearance.ts';
import type { BarBox, DotPattern } from './lattice.ts';
import { barBoxes, barLayout, barTriangles, dotTile, latticePattern } from './lattice.ts';
import { partitionTriangles, partMaterials, toBufferGeometry } from './mesh.ts';
import { createSurfaceMaterial } from './surface-material.ts';
import type { MachinePartInput } from './types.ts';

/** Chord error of machine meshes, metres (0.3 mm: wires are 3 to 5 mm thick). */
export const MACHINE_CHORD_ERROR = 0.0003;

/** A panel of the shell that is left out when the camera is on its outer side. */
export interface CutawayPanel {
  readonly object: Object3D;
  /** The part group the panel belongs to (its pose is the part's pose). */
  readonly part: Group;
  /** A point of the panel in the part frame, metres. */
  readonly point: Vector3;
  /** Outward normal of the panel in the part frame. */
  readonly normal: Vector3;
}

/** The drawable machine. */
export interface MachineObjects {
  /** One group per part, by part id; position and quaternion are the part's pose. */
  readonly parts: Map<string, Group>;
  readonly panels: CutawayPanel[];
  /** Frees the geometries and materials. */
  dispose(): void;
}

/**
 * How much darker the tines of a basket are drawn than its other wires. On the machine they are
 * the same grey; drawn so, a row of tines seen from above is a row of dots on the floor wires
 * and the slots a plate goes into cannot be made out.
 */
export const TINE_SHADE = 0.5;

/** True for a sub-part of a basket that is a tine of a row (`row.<id>.tine.<n>`, `.tip.<n>`). */
export function isTine(subPart: string): boolean {
  return /^row\.[^.]+\.(tine|tip)\b/.test(subPart);
}

/** Name of the object that holds the bars of the lattices of a part: `<part id>.lattice`. */
export const LATTICE_SUFFIX = '.lattice';

/**
 * How each open sub-part of a machine part is drawn (`lattice.ts`): as bars, as a sheet with a
 * pattern of dots, or (absent from both) as the solid slab it is.
 */
function openSubParts(part: MachinePartInput): {
  bars: Map<string, BarBox[]>;
  dots: Map<string, { pattern: DotPattern; openFraction: number }>;
} {
  const bars = new Map<string, BarBox[]>();
  const dots = new Map<string, { pattern: DotPattern; openFraction: number }>();
  for (const subPart of part.shape.parts) {
    const pattern = latticePattern(part.id, subPart);
    if (pattern === null) continue;
    if (pattern.kind === 'dots') {
      dots.set(subPart.id, { pattern, openFraction: subPart.porosity ?? 0 });
    } else {
      const layout = barLayout(subPart, pattern);
      if (layout !== null) bars.set(subPart.id, barBoxes(layout));
    }
  }
  return { bars, dots };
}

/** The picture of a perforated sheet as a texture that repeats; mipmapped, so that from far off it is an even tone. */
function dotTexture(pattern: DotPattern, openFraction: number): DataTexture {
  const tile = dotTile(pattern, openFraction);
  const texture = new DataTexture(
    tile.data,
    tile.pixels,
    tile.pixels,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Gives a geometry the texture coordinates of a pattern laid flat on the sheet: the position
 * along the two longer sides of the geometry's box over the size of a tile.
 */
function layFlat(geometry: BufferGeometry, tile: readonly [number, number]): void {
  const box = geometry.boundingBox;
  if (box === null) return;
  const size = box.getSize(new Vector3()).toArray();
  const through = size.indexOf(Math.min(...size));
  const [u, v] = [0, 1, 2].filter((axis) => axis !== through) as [number, number];
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[2 * i] = position.getComponent(i, u) / tile[0];
    uv[2 * i + 1] = position.getComponent(i, v) / tile[1];
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

/** Panels of the tub shell: the walls, the roof and the rounded rear corners. */
function isShellPanel(partId: string): boolean {
  return partId.startsWith('wall.') || partId === 'roof' || partId.startsWith('corner.');
}

/**
 * Builds the machine. Every part group is placed at the part's reference pose; the caller
 * moves it with the poses the server sends.
 */
export function buildMachineObjects(parts: readonly MachinePartInput[]): MachineObjects {
  const groups = new Map<string, Group>();
  const panels: CutawayPanel[] = [];
  const materials = new Map<string, Material>();
  const disposables: { dispose(): void }[] = [];

  const tub = parts.find((part) => part.id === 'tub');
  const tubBox = tub === undefined ? null : boundingBox(tub.shape);

  for (const part of parts) {
    const group = new Group();
    group.name = part.id;
    group.position.set(...part.reference_pose.p);
    group.quaternion.set(...part.reference_pose.q);
    const mesh = buildRenderMesh(part.shape, { chordError: MACHINE_CHORD_ERROR, minSectors: 12 });
    const materialOf = partMaterials(part.shape);
    const cutaway = part.id === 'tub' || part.id === 'door' || part.id === 'dispenser';
    const open = openSubParts(part);
    // Key: material, then the panel (a sub-part of the shell) when the part can be cut away,
    // then what sets the sub-part apart: a tine, a perforated sheet. The slabs that are drawn
    // as bars are left out of the mesh.
    const BARS = 'bars';
    const partition = partitionTriangles(mesh, (subPart) => {
      if (open.bars.has(subPart)) return BARS;
      const material = materialOf.get(subPart) ?? part.material;
      const panel = part.id === 'tub' ? (isShellPanel(subPart) ? subPart : '') : '';
      const variant = open.dots.has(subPart) ? `dots:${subPart}` : isTine(subPart) ? 'tine' : '';
      return `${material}|${panel}|${variant}`;
    });
    const materialFor = (materialId: string, variant: string): Material => {
      const materialKey = `${part.id.includes('arm') ? 'arm' : part.id}|${materialId}|${variant}`;
      let material = materials.get(materialKey);
      if (material === undefined) {
        const appearance = machinePartAppearance(part.id, part.role, materialId);
        const [r, g, b] = appearance.colour;
        const surface = createSurfaceMaterial(
          variant !== 'tine'
            ? appearance
            : { ...appearance, colour: [r * TINE_SHADE, g * TINE_SHADE, b * TINE_SHADE] },
          {
            // The shell is sheet metal seen from both sides.
            doubleSided: cutaway,
          },
        );
        const dots = variant.startsWith('dots:') ? open.dots.get(variant.slice(5)) : undefined;
        if (dots !== undefined) {
          const texture: Texture = dotTexture(dots.pattern, dots.openFraction);
          surface.map = texture;
          disposables.push(texture);
        }
        material = surface;
        materials.set(materialKey, material);
        disposables.push(material);
      }
      return material;
    };
    for (const [key, triangles] of partition) {
      if (key === BARS) continue;
      const [materialId, panel, variant] = key.split('|') as [string, string, string];
      const material = materialFor(materialId, variant);
      const geometry = toBufferGeometry(mesh, triangles);
      const dots = variant.startsWith('dots:') ? open.dots.get(variant.slice(5)) : undefined;
      if (dots !== undefined) layFlat(geometry, dotTile(dots.pattern, dots.openFraction, 1).size);
      disposables.push(geometry);
      const object = new Mesh(geometry, material);
      object.name = panel === '' ? part.id : `${part.id}.${panel}`;
      object.receiveShadow = true;
      object.castShadow = part.role !== 'tub';
      group.add(object);

      if (part.id === 'tub' && panel !== '' && tubBox !== null && geometry.boundingBox !== null) {
        const centre = geometry.boundingBox.getCenter(new Vector3());
        const normal = new Vector3();
        const axes = ['x', 'y', 'z'] as const;
        axes.forEach((axis, i) => {
          const middle = ((tubBox.min[i] as number) + (tubBox.max[i] as number)) / 2;
          const half = ((tubBox.max[i] as number) - (tubBox.min[i] as number)) / 2;
          const d = (centre[axis] - middle) / half;
          if (Math.abs(d) > 0.7) normal[axis] = Math.sign(d);
        });
        if (normal.lengthSq() > 0) {
          panels.push({ object, part: group, point: centre, normal: normal.normalize() });
        }
      } else if (part.id === 'door' || part.id === 'dispenser') {
        // In its reference pose the door is closed: its outer side faces the front (-y).
        const centre =
          geometry.boundingBox === null
            ? new Vector3()
            : geometry.boundingBox.getCenter(new Vector3());
        panels.push({ object, part: group, point: centre, normal: new Vector3(0, -1, 0) });
      }
    }
    // The lattices: the bars of every open slab of a material as one mesh.
    const barsByMaterial = new Map<string, { part: Part; boxes: BarBox[] }[]>();
    for (const subPart of part.shape.parts) {
      const boxes = open.bars.get(subPart.id);
      if (boxes === undefined) continue;
      const list = barsByMaterial.get(subPart.material);
      if (list === undefined) barsByMaterial.set(subPart.material, [{ part: subPart, boxes }]);
      else list.push({ part: subPart, boxes });
    }
    for (const [materialId, bars] of barsByMaterial) {
      const soup = barTriangles(bars);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(soup.positions, 3));
      geometry.setAttribute('normal', new BufferAttribute(soup.normals, 3));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      disposables.push(geometry);
      const object = new Mesh(geometry, materialFor(materialId, ''));
      object.name = `${part.id}${LATTICE_SUFFIX}`;
      object.receiveShadow = true;
      object.castShadow = true;
      group.add(object);
    }
    groups.set(part.id, group);
  }
  return {
    parts: groups,
    panels,
    dispose(): void {
      for (const item of disposables) item.dispose();
    },
  };
}

const scratchPoint = new Vector3();
const scratchNormal = new Vector3();
const scratchQuaternion = new Quaternion();

/**
 * Leaves out every panel of the shell whose outer side the camera looks at, and draws the
 * others: a wall between the camera and the load disappears, a wall behind the load stays.
 * `camera` is the camera position for a perspective view, or a far point along the viewing
 * direction for an orthographic one, in scene units (metres, tub frame).
 */
export function applyCutaway(panels: readonly CutawayPanel[], camera: Vector3): void {
  for (const panel of panels) {
    panel.part.getWorldQuaternion(scratchQuaternion);
    scratchNormal.copy(panel.normal).applyQuaternion(scratchQuaternion);
    scratchPoint.copy(panel.point);
    panel.part.localToWorld(scratchPoint);
    panel.object.visible = scratchPoint.sub(camera).dot(scratchNormal) > 0;
  }
}
