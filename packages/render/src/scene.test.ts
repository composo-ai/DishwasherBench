// The scene built from the real machine and real catalogue items, without a WebGL context:
// geometry, grouping, soil attributes, cutaway, poses and picking are all plain Three.js data.
import { bodyMaterialOf, instantiate } from '@spotless/catalogue';
import { buildRenderMesh } from '@spotless/geometry';
import { buildMachineGeometry, findMachine } from '@spotless/machine';
import { Mesh, OrthographicCamera, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { clipPlanes, ViewCameras } from './camera.ts';
import { applyCutaway, buildMachineObjects, isTine, TINE_SHADE } from './machine.ts';
import { partitionTriangles, toBufferGeometry } from './mesh.ts';
import { GHOST_TINTS, LANDING_OPACITY, LANDING_TINT, SpotlessScene } from './scene.ts';
import { coverageThreshold, soilLayersByRegion, srgbToLinear } from './soil-layers.ts';
import { thumbnailDirection } from './thumbnail.ts';
import type { ItemTypeInput, MachinePartInput } from './types.ts';
import { fitView, viewSpec } from './views.ts';

let parts: MachinePartInput[];
let plate: ItemTypeInput;
let tumbler: ItemTypeInput;

function itemType(id: string): ItemTypeInput {
  const instance = instantiate(id);
  return { item_type: id, material: bodyMaterialOf(instance.type), shape: instance.shape };
}

beforeAll(() => {
  const spec = findMachine('bosch_smv4hax40g');
  if (spec === undefined) throw new Error('the Bosch is not in the machine package');
  parts = buildMachineGeometry(spec, spec.defaultConfig).parts.map((part) => ({
    id: part.id,
    role: part.role,
    material: part.material,
    reference_pose: part.pose,
    shape: part.shape,
  }));
  plate = itemType('dinner_plate_porcelain_270');
  tumbler = itemType('tumbler_250');
});

describe('toBufferGeometry', () => {
  it('keeps every triangle of the kernel mesh, unindexed, with its normals', () => {
    const mesh = buildRenderMesh(plate.shape, { chordError: 0.0005 });
    const geometry = toBufferGeometry(mesh);
    const triangles = mesh.indices.length / 3;
    expect(geometry.getAttribute('position').count).toBe(3 * triangles);
    expect(geometry.getAttribute('normal').count).toBe(3 * triangles);
    expect(geometry.getAttribute('soilA')).toBeUndefined();
    // The plate is 270 mm across and 30 mm high, in metres.
    const box = geometry.boundingBox;
    expect(box?.max.x).toBeCloseTo(0.135, 3);
    expect(box?.max.z).toBeCloseTo(0.03, 3);
  });

  it('gives the triangles of a soiled region its colour and threshold, and no others', () => {
    const mesh = buildRenderMesh(plate.shape, { chordError: 0.0005 });
    const layers = soilLayersByRegion([
      { type: 'tomato_sauce', regions: [{ region: 'well', coverage: 0.5 }] },
    ]);
    const geometry = toBufferGeometry(mesh, undefined, layers);
    const soilA = geometry.getAttribute('soilA');
    const soilAP = geometry.getAttribute('soilAP');
    const soilB = geometry.getAttribute('soilB');
    const well = mesh.regionIds.indexOf('well');
    expect(well).toBeGreaterThanOrEqual(0);
    const threshold = coverageThreshold(0.5);
    let soiled = 0;
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      const inWell = mesh.triRegion[t] === well;
      for (let corner = 0; corner < 3; corner++) {
        const v = 3 * t + corner;
        if (inWell) {
          // Tomato sauce is (0.78, 0.12, 0.05) in sRGB; the shader works in linear light.
          expect(soilA.getX(v)).toBeCloseTo(srgbToLinear(0.78), 6);
          expect(soilA.getW(v)).toBeCloseTo(threshold, 6);
          expect(soilAP.getY(v)).toBeCloseTo(0.93, 6);
        } else {
          expect(soilA.getW(v)).toBe(-1);
        }
        // No second soil anywhere.
        expect(soilB.getW(v)).toBe(-1);
      }
      if (inWell) soiled += 1;
    }
    expect(soiled).toBeGreaterThan(100);
  });

  it('partitions a mesh by material without losing a triangle', () => {
    const mug = instantiate('mug_ceramic_300');
    const mesh = buildRenderMesh(mug.shape, { chordError: 0.0005 });
    const materialOf = new Map(mug.shape.parts.map((part) => [part.id, part.material]));
    const groups = partitionTriangles(mesh, (partId) => materialOf.get(partId) ?? '?');
    expect([...groups.keys()].sort()).toEqual(['porcelain_glazed', 'porcelain_unglazed']);
    const total = [...groups.values()].reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(mesh.indices.length / 3);
  });
});

describe('the machine', () => {
  it('draws every part of the Bosch, with every wire of both baskets', () => {
    const machine = buildMachineObjects(parts);
    expect(machine.parts.size).toBe(parts.length);
    for (const id of ['tub', 'door', 'lower_rack', 'upper_rack', 'cutlery_basket']) {
      expect(machine.parts.has(id), id).toBe(true);
    }
    expect(machine.parts.has('lower_arm') && machine.parts.has('upper_arm')).toBe(true);
    expect(machine.parts.has('upper_rack_tablet_tray')).toBe(true);
    // The upper basket has 771 wire capsules; each is at least 8 sectors round with two caps.
    const upper = machine.parts.get('upper_rack');
    let triangles = 0;
    upper?.traverse((child) => {
      if (child instanceof Mesh) triangles += child.geometry.getAttribute('position').count / 3;
    });
    expect(triangles).toBeGreaterThan(771 * 16);
    // Each part group stands at its reference pose: the lower basket's frame origin.
    const lower = machine.parts.get('lower_rack');
    expect(lower?.position.x).toBeCloseTo(-0.2625, 9);
    expect(lower?.position.z).toBeCloseTo(0.073, 9);
    machine.dispose();
  });

  it('cuts away the walls between the camera and the load, and keeps the others', () => {
    const machine = buildMachineObjects(parts);
    const panel = (name: string) => {
      const found = machine.panels.find((p) => p.object.name === name);
      if (found === undefined) throw new Error(`no panel ${name}`);
      return found.object;
    };
    for (const group of machine.parts.values()) group.updateMatrixWorld(true);
    // From the front right and above: the right wall and the roof are in the way.
    applyCutaway(machine.panels, new Vector3(1.5, -1.5, 1.5));
    expect(panel('tub.wall.right').visible).toBe(false);
    expect(panel('tub.roof').visible).toBe(false);
    expect(panel('tub.wall.left').visible).toBe(true);
    expect(panel('tub.wall.rear').visible).toBe(true);
    // The closed door (the reference pose) faces a camera in front and is cut away.
    expect(panel('door').visible).toBe(false);
    // From the left and below the roof: the left wall goes, the right wall and roof stay.
    applyCutaway(machine.panels, new Vector3(-2, -0.5, 0.3));
    expect(panel('tub.wall.left').visible).toBe(false);
    expect(panel('tub.wall.right').visible).toBe(true);
    expect(panel('tub.roof').visible).toBe(true);
    // The door open (turned a quarter about x, lying flat): its outer side faces down, so a
    // camera above still sees it.
    const door = machine.parts.get('door');
    door?.quaternion.set(Math.SQRT1_2, 0, 0, Math.SQRT1_2);
    door?.updateMatrixWorld(true);
    applyCutaway(machine.panels, new Vector3(1.5, -1.5, 1.5));
    expect(panel('door').visible).toBe(true);
    machine.dispose();
  });
});

describe('SpotlessScene', () => {
  it('shows exactly the items that have a pose, where the pose says', () => {
    const scene = new SpotlessScene({ floor: false });
    scene.setMachine(parts);
    scene.addItemTypes([plate, tumbler]);
    scene.setItem('plate_01', plate.item_type, soilLayersByRegion([]));
    scene.setItem('glass_01', tumbler.item_type, soilLayersByRegion([]));
    const find = (id: string) => scene.scene.getObjectByName(id);
    expect(find('plate_01')?.visible).toBe(false);
    scene.setItemPoses({
      plate_01: { position_mm: [100, -500, 300], quat_wxyz: [0.7071, 0.7071, 0, 0] },
    });
    expect(find('plate_01')?.visible).toBe(true);
    expect(find('glass_01')?.visible).toBe(false);
    expect(find('plate_01')?.position.toArray()).toEqual([0.1, -0.5, 0.3]);
    // (w, x, y, z) on the wire is (x, y, z, w) in Three.js, normalised.
    expect(find('plate_01')?.quaternion.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(find('plate_01')?.quaternion.w).toBeCloseTo(Math.SQRT1_2, 6);
    // A frame of an animation moves and shows an item without touching the others.
    scene.moveItems({ glass_01: { position_mm: [0, 0, 500], quat_wxyz: [1, 0, 0, 0] } });
    expect(find('glass_01')?.visible).toBe(true);
    expect(find('plate_01')?.position.x).toBe(0.1);
    // A part pose moves the part group.
    scene.setPartPoses({
      lower_rack: { position_mm: [-262.5, -762, 73], quat_wxyz: [1, 0, 0, 0] },
    });
    expect(find('lower_rack')?.position.y).toBeCloseTo(-0.762, 9);
    scene.dispose();
  });

  it('picks the item under the mouse and ignores items on the counter', () => {
    const scene = new SpotlessScene({ floor: false });
    scene.addItemTypes([plate]);
    scene.setItem('plate_01', plate.item_type, soilLayersByRegion([]));
    scene.setItem('plate_02', plate.item_type, soilLayersByRegion([]));
    scene.setItemPoses({ plate_01: { position_mm: [0, 0, 0], quat_wxyz: [1, 0, 0, 0] } });
    scene.scene.updateMatrixWorld(true);
    // Straight down onto the origin: a 1 m square seen from 2 m above.
    const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    expect(scene.pickItem({ x: 0, y: 0 }, camera)).toBe('plate_01');
    // 0.4 m from the centre there is nothing (the plate is 0.135 m in radius).
    expect(scene.pickItem({ x: 0.8, y: 0 }, camera)).toBeNull();
    // An item without a pose is on the counter and cannot be picked.
    scene.setItemPoses({});
    expect(scene.pickItem({ x: 0, y: 0 }, camera)).toBeNull();
    scene.dispose();
  });

  it('keeps an item where it is when its paint is replaced by a residue map', () => {
    const scene = new SpotlessScene({ floor: false });
    scene.addItemTypes([plate]);
    scene.setItem('plate_01', plate.item_type, soilLayersByRegion([]));
    scene.setItemPoses({ plate_01: { position_mm: [10, 20, 30], quat_wxyz: [1, 0, 0, 0] } });
    scene.setItem(
      'plate_01',
      plate.item_type,
      soilLayersByRegion([{ type: 'curry', regions: [{ region: 'well', coverage: 0.3 }] }]),
    );
    const object = scene.scene.getObjectByName('plate_01');
    expect(object?.visible).toBe(true);
    expect(object?.position.toArray()).toEqual([0.01, 0.02, 0.03]);
    expect(scene.scene.getObjectsByProperty('name', 'plate_01')).toHaveLength(1);
    scene.dispose();
  });
});

describe('cameras', () => {
  const subject = {
    tub_min_mm: [-272, -235, 0] as const,
    tub_max_mm: [273, 265, 640] as const,
    racks: [
      {
        rack: 'lower_rack',
        origin_mm: [-262.5, -762, 73] as const,
        envelope_mm: [525, 512, 292] as const,
      },
    ],
  };

  it('a plan view shows +x to the right and +y (the back) up', () => {
    const cameras = new ViewCameras();
    cameras.resize(1.5);
    cameras.apply(fitView(viewSpec('top_lower', subject), 1.5));
    const camera = cameras.active;
    camera.updateMatrixWorld(true);
    const centre = new Vector3(0, -0.506, 0.219).project(camera);
    const right = new Vector3(0.1, -0.506, 0.219).project(camera);
    const back = new Vector3(0, -0.406, 0.219).project(camera);
    expect(centre.x).toBeCloseTo(0, 6);
    expect(centre.y).toBeCloseTo(0, 3);
    expect(right.x).toBeGreaterThan(centre.x + 0.05);
    expect(right.y).toBeCloseTo(centre.y, 6);
    expect(back.y).toBeGreaterThan(centre.y + 0.05);
    expect(back.x).toBeCloseTo(centre.x, 6);
  });

  it('the front elevation shows +x to the right and +z up, undistorted', () => {
    const cameras = new ViewCameras();
    cameras.resize(2);
    cameras.apply(fitView(viewSpec('front', subject), 2));
    const camera = cameras.active;
    camera.updateMatrixWorld(true);
    const a = new Vector3(0, 0, 0.3).project(camera);
    const b = new Vector3(0.1, 0, 0.3).project(camera);
    const c = new Vector3(0, 0, 0.4).project(camera);
    expect(b.x).toBeGreaterThan(a.x);
    expect(c.y).toBeGreaterThan(a.y);
    // Aspect 2: 100 mm across covers half as much of the normalised width as of the height.
    expect((b.x - a.x) * 2).toBeCloseTo(c.y - a.y, 9);
  });

  it('clips nothing without a cut height, and everything above it with one', () => {
    expect(clipPlanes(null)).toEqual([]);
    const [plane] = clipPlanes(365);
    // Three.js keeps what has a non-negative distance to the plane.
    expect(plane?.distanceToPoint(new Vector3(0, 0, 0.3))).toBeGreaterThan(0);
    expect(plane?.distanceToPoint(new Vector3(0, 0, 0.4))).toBeLessThan(0);
  });
});

describe('thumbnailDirection', () => {
  it('looks from above at eating faces and from below at undersides', () => {
    expect(thumbnailDirection(['well'])[2]).toBeGreaterThan(0);
    expect(thumbnailDirection(['interior', 'rim'])[2]).toBeGreaterThan(0);
    expect(thumbnailDirection([])[2]).toBeGreaterThan(0);
    expect(thumbnailDirection(['underside'])[2]).toBeLessThan(0);
    expect(thumbnailDirection(['exterior', 'foot'])[2]).toBeLessThan(0);
    // Soil above and below: the upper face wins.
    expect(thumbnailDirection(['well', 'underside'])[2]).toBeGreaterThan(0);
    expect(Math.hypot(...thumbnailDirection(['well']))).toBeCloseTo(1, 9);
  });
});

describe('where the item in hand will be let go', () => {
  it('is drawn in a colour of its own, through everything, with a line down from the ghost', () => {
    const scene = new SpotlessScene({ floor: false });
    scene.setMachine(parts);
    scene.addItemTypes([plate]);
    const identity = [1, 0, 0, 0] as const;
    scene.setGhost({
      itemType: plate.item_type,
      pose: { position_mm: [0, -500, 400], quat_wxyz: identity },
      tint: 'clear',
    });
    expect(scene.dropLineEnds()).toBeNull();
    scene.setLanding({
      itemType: plate.item_type,
      pose: { position_mm: [0, -500, 120], quat_wxyz: identity },
    });
    const ends = scene.dropLineEnds();
    expect(ends?.from).toEqual([0, -0.5, 0.4]);
    expect(ends?.to[2]).toBeCloseTo(0.12, 6);
    // The ghost follows the mouse: the line follows the ghost.
    scene.setGhost({
      itemType: plate.item_type,
      pose: { position_mm: [50, -500, 400], quat_wxyz: identity },
      tint: 'clear',
    });
    expect(scene.dropLineEnds()?.from[0]).toBeCloseTo(0.05, 6);

    // The outline: opaque enough to see, not hidden by depth, and unlike any ghost tint or
    // the grey of the machine.
    const outline: Mesh[] = [];
    scene.scene.traverse((object) => {
      if (object instanceof Mesh && object.renderOrder === 9) outline.push(object);
    });
    expect(outline.length).toBeGreaterThan(0);
    const material = outline[0]?.material as { opacity: number; depthTest: boolean };
    expect(material.opacity).toBeGreaterThanOrEqual(0.5);
    expect(material.depthTest).toBe(false);
    expect(LANDING_OPACITY).toBeGreaterThanOrEqual(0.5);
    for (const tint of Object.values(GHOST_TINTS)) {
      const distance = Math.hypot(
        tint[0] - LANDING_TINT[0],
        tint[1] - LANDING_TINT[1],
        tint[2] - LANDING_TINT[2],
      );
      expect(distance).toBeGreaterThan(0.3);
    }
    // Saturated: far from any grey.
    expect(Math.max(...LANDING_TINT) - Math.min(...LANDING_TINT)).toBeGreaterThan(0.6);

    scene.setLanding(null);
    expect(scene.dropLineEnds()).toBeNull();
    scene.dispose();
  });
});

describe('tines', () => {
  it('are told from the other wires of a basket and drawn darker', () => {
    expect(isTine('row.r1.tine.3')).toBe(true);
    expect(isTine('row.ml.tip.0')).toBe(true);
    expect(isTine('row.r1.rail.0')).toBe(false);
    expect(isTine('floor.x.2.0')).toBe(false);
    expect(isTine('rim.1')).toBe(false);
    expect(TINE_SHADE).toBeLessThan(0.7);
    const machine = buildMachineObjects(parts);
    const lower = machine.parts.get('lower_rack');
    const colours = new Set<string>();
    lower?.traverse((object) => {
      if (object instanceof Mesh) {
        colours.add(
          (object.material as { color: { getHexString(): string } }).color.getHexString(),
        );
      }
    });
    // Two greys: the wires and the tines.
    expect(colours.size).toBe(2);
    machine.dispose();
  });
});
