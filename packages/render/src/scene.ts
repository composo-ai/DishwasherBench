/**
 * The scene: the machine, the items placed in it, a ghost of the item in hand, marks and an
 * insert arrow, with lights. It is fed with shapes (kernel units) and draw poses (wire units)
 * and knows nothing of the server or of the page; the web client and a headless render service
 * can both drive it.
 *
 * Scene units are metres in the tub frame: z up, +x to the right facing the machine, +y back.
 */

import type { Camera, Material, Object3D, WebGLRenderer } from 'three';
import {
  ArrowHelper,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { materialAppearance } from './appearance.ts';
import { createGhostMaterial, createHighlightMaterial, ItemFactory } from './items.ts';
import type { MachineObjects } from './machine.ts';
import { applyCutaway, buildMachineObjects } from './machine.ts';
import type { ResidueTiles } from './residue-map.ts';
import { residueOutline } from './residue-map.ts';
import type { ResidueObject } from './residue-object.ts';
import { buildResidueObject } from './residue-object.ts';
import type { DrawPoseInput, ItemTypeInput, MachinePartInput, RegionLayers, Rgb } from './types.ts';

/** Sets an object's pose from a draw pose (millimetres, `quat_wxyz`). */
export function applyDrawPose(object: Object3D, pose: DrawPoseInput): void {
  object.position.set(
    pose.position_mm[0] / 1000,
    pose.position_mm[1] / 1000,
    pose.position_mm[2] / 1000,
  );
  const [w, x, y, z] = pose.quat_wxyz;
  object.quaternion.set(x, y, z, w).normalize();
}

/** Tints of the ghost by what is known about its pose. */
export const GHOST_TINTS: { readonly [state: string]: Rgb } = {
  /** Nothing known yet. */
  unknown: [0.45, 0.62, 0.95],
  /** The pose is free and can be reached. */
  clear: [0.3, 0.8, 0.45],
  /** The pose overlaps something. */
  collision: [0.92, 0.22, 0.2],
  /** The pose is free but cannot be reached, or is outside the basket. */
  unreachable: [0.95, 0.62, 0.15],
  /** The pose is free and can be reached, but the piece would be let go on something: it may not stay. */
  perched: [0.88, 0.84, 0.22],
};

/**
 * Colour of the outline of where the item in hand would be let go, and of the line down to it
 * from the ghost: a saturated blue that no part of the machine and no ghost tint has.
 */
export const LANDING_TINT: Rgb = [0.05, 0.35, 1];
/** Opacity of the landing outline. */
export const LANDING_OPACITY = 0.6;

/**
 * The material of the landing outline: flat, bright and drawn through whatever is in front of
 * it, because where the item will be let go is usually down among the wires and the load.
 */
function createLandingMaterial(): Material {
  const material = createHighlightMaterial(LANDING_TINT, LANDING_OPACITY);
  material.depthTest = false;
  return material;
}

/** State of the ghost: a key of {@link GHOST_TINTS}. */
export type GhostTint = 'unknown' | 'clear' | 'collision' | 'unreachable' | 'perched';

interface ItemEntry {
  readonly itemType: string;
  object: Group;
}

/** Options of {@link SpotlessScene}. */
export interface SceneOptions {
  /** Background colour, CSS. Default a light kitchen grey. */
  readonly background?: string;
  /** Draw a kitchen floor under the machine. Default true. */
  readonly floor?: boolean;
}

/** The machine and its load as Three.js objects. */
export class SpotlessScene {
  readonly scene = new Scene();
  readonly factory = new ItemFactory();
  private machine: MachineObjects | null = null;
  private readonly machineRoot = new Group();
  private readonly itemRoot = new Group();
  private readonly overlayRoot = new Group();
  private readonly items = new Map<string, ItemEntry>();
  /** The residue painted on items after a wash, by item id. */
  private readonly residues = new Map<string, { residue: ResidueObject; tiles: ResidueTiles }>();
  private readonly ghostMaterials = new Map<GhostTint, Material>();
  private readonly xrayMaterials = new Map<GhostTint, Material>();
  private readonly landingMaterial = createLandingMaterial();
  private readonly dropLineMaterial = new LineBasicMaterial({
    color: new Color().setRGB(LANDING_TINT[0], LANDING_TINT[1], LANDING_TINT[2]),
    depthTest: false,
    transparent: true,
  });
  private dropLine: Line | null = null;
  private readonly highlightMaterial = createHighlightMaterial([1, 0.8, 0.05], 0.22);
  private ghost: { itemType: string; object: Group; tint: GhostTint } | null = null;
  private landing: { itemType: string; object: Group } | null = null;
  private readonly highlights = new Map<string, Group>();
  private arrow: ArrowHelper | null = null;
  private readonly sun: DirectionalLight;
  private readonly raycaster = new Raycaster();
  private environment: { dispose(): void } | null = null;

  constructor(options: SceneOptions = {}) {
    this.scene.background = new Color(options.background ?? '#e9ecf0');
    this.scene.add(this.machineRoot, this.itemRoot, this.overlayRoot);
    // The light from below is a neutral grey: a warm one turned white plates that face downwards
    // (as plates leaning in the tines do) cream.
    this.scene.add(new HemisphereLight(0xffffff, 0xa9aaac, 0.6));
    this.sun = new DirectionalLight(0xfff6e8, 2.4);
    // From the front right and above, where the person loading stands.
    this.sun.position.set(0.9, -1.6, 2.4);
    this.sun.target.position.set(0, -0.25, 0.25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadow = this.sun.shadow.camera;
    shadow.left = -0.75;
    shadow.right = 0.75;
    shadow.top = 0.9;
    shadow.bottom = -0.9;
    shadow.near = 0.5;
    shadow.far = 5;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.002;
    this.scene.add(this.sun, this.sun.target);
    // A weaker light from the front left, without shadows, so that the far side of the load
    // is not left in the dark when the camera goes round.
    const fill = new DirectionalLight(0xeaf1ff, 0.8);
    fill.position.set(-1.6, -1.2, 1.4);
    this.scene.add(fill);
    if (options.floor !== false) {
      const floor = new Mesh(
        new PlaneGeometry(6, 6),
        new MeshStandardMaterial({ color: 0xb49f86, roughness: 0.85, metalness: 0 }),
      );
      // The kitchen floor is below the tub: the appliance stands on a plinth.
      floor.position.set(0, 0, -0.12);
      floor.receiveShadow = true;
      floor.name = 'kitchen_floor';
      this.scene.add(floor);
    }
  }

  /**
   * Lights the scene with a neutral room, so that steel and glass have something to reflect.
   * Call once per renderer.
   */
  attachEnvironment(renderer: WebGLRenderer): void {
    const generator = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    this.scene.environment = target.texture;
    this.scene.environmentIntensity = 0.6;
    this.environment?.dispose();
    this.environment = target;
    generator.dispose();
  }

  // -------------------------------------------------------------------------------------------
  // Machine
  // -------------------------------------------------------------------------------------------

  /** Builds (or rebuilds, after a change of configuration) the machine. */
  setMachine(parts: readonly MachinePartInput[]): void {
    const poses = new Map<string, { p: Vector3; q: Object3D['quaternion'] }>();
    if (this.machine !== null) {
      for (const [id, group] of this.machine.parts) {
        poses.set(id, { p: group.position.clone(), q: group.quaternion.clone() });
      }
      this.machineRoot.clear();
      this.machine.dispose();
    }
    this.machine = buildMachineObjects(parts);
    for (const [id, group] of this.machine.parts) {
      // A rebuilt part stays where it was until the next poses arrive.
      const pose = poses.get(id);
      if (pose !== undefined) {
        group.position.copy(pose.p);
        group.quaternion.copy(pose.q);
      }
      this.machineRoot.add(group);
    }
  }

  /** Moves machine parts. Parts that are not named stay where they are. */
  setPartPoses(poses: { readonly [partId: string]: DrawPoseInput }): void {
    if (this.machine === null) return;
    for (const [id, pose] of Object.entries(poses)) {
      const group = this.machine.parts.get(id);
      if (group !== undefined) applyDrawPose(group, pose);
    }
  }

  /** Shows the panels of the shell that are behind the load as seen from `camera`. */
  updateCutaway(camera: Vector3): void {
    if (this.machine === null) return;
    this.scene.updateMatrixWorld();
    applyCutaway(this.machine.panels, camera);
  }

  // -------------------------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------------------------

  /** Makes item types known. */
  addItemTypes(types: Iterable<ItemTypeInput>): void {
    for (const type of types) this.factory.addType(type);
  }

  /**
   * Declares an item: its type and what is painted on it. The item is not shown until it gets
   * a pose. Declaring an item again replaces what is painted on it (the report's residue map).
   */
  setItem(itemId: string, itemType: string, layers: RegionLayers): void {
    const object = this.factory.build(itemType, layers);
    object.name = itemId;
    object.userData['itemId'] = itemId;
    const previous = this.items.get(itemId);
    if (previous !== undefined) {
      object.position.copy(previous.object.position);
      object.quaternion.copy(previous.object.quaternion);
      object.visible = previous.object.visible;
      this.itemRoot.remove(previous.object);
    } else {
      object.visible = false;
    }
    // Residue painted on the item stays on it.
    const painted = this.residues.get(itemId);
    if (painted !== undefined) object.add(painted.residue.object);
    this.itemRoot.add(object);
    this.items.set(itemId, { itemType, object });
  }

  /**
   * Paints the residue of a washed item on it: the tiles of its residue map (`residueTiles`),
   * with their outline chosen against the item's material. It replaces what was painted on
   * the item before; null removes it. The tiles are in the item frame and move with the item.
   */
  setItemResidue(itemId: string, tiles: ResidueTiles | null): void {
    const previous = this.residues.get(itemId);
    if (previous !== undefined) {
      previous.residue.object.removeFromParent();
      previous.residue.dispose();
      this.residues.delete(itemId);
    }
    const entry = this.items.get(itemId);
    if (tiles === null || entry === undefined) return;
    const material = materialAppearance(this.factory.materialOf(entry.itemType));
    const residue = buildResidueObject(tiles, residueOutline(material.colour));
    entry.object.add(residue.object);
    this.residues.set(itemId, { residue, tiles });
  }

  /** Ids of the items that have residue painted on them, sorted. */
  itemsWithResidue(): string[] {
    return [...this.residues.keys()].sort();
  }

  /**
   * Where the residue tiles of an item are drawn: the centre of every tile in the tub frame,
   * metres (three numbers a tile), with the index of its cell in the residue map. Null for an
   * item without residue. For checking the painting against the map; nothing draws from it.
   */
  residueTilePositions(itemId: string): { cell: Uint32Array; position: Float32Array } | null {
    const painted = this.residues.get(itemId);
    const entry = this.items.get(itemId);
    if (painted === undefined || entry === undefined) return null;
    entry.object.updateMatrixWorld(true);
    const { tiles } = painted;
    const position = new Float32Array(3 * tiles.count);
    const point = new Vector3();
    for (let t = 0; t < tiles.count; t++) {
      point
        .set(
          tiles.fill[16 * t + 12] as number,
          tiles.fill[16 * t + 13] as number,
          tiles.fill[16 * t + 14] as number,
        )
        .applyMatrix4(entry.object.matrixWorld);
      position.set([point.x, point.y, point.z], 3 * t);
    }
    return { cell: tiles.cell, position };
  }

  private clearResidues(): void {
    for (const painted of this.residues.values()) {
      painted.residue.object.removeFromParent();
      painted.residue.dispose();
    }
    this.residues.clear();
  }

  /** Forgets every item (a new level). */
  clearItems(): void {
    this.clearResidues();
    this.itemRoot.clear();
    this.items.clear();
    this.setHighlights([]);
    this.setGhost(null);
    this.setLanding(null);
  }

  /**
   * Shows exactly the items that have a pose, where the pose says; every other item is hidden
   * (it is on the counter).
   */
  setItemPoses(poses: { readonly [itemId: string]: DrawPoseInput }): void {
    for (const [id, entry] of this.items) {
      const pose = poses[id];
      entry.object.visible = pose !== undefined;
      if (pose !== undefined) applyDrawPose(entry.object, pose);
    }
    this.syncHighlights();
  }

  /** Moves some items (a frame of an animation); an item that gets a pose is shown. */
  moveItems(poses: { readonly [itemId: string]: DrawPoseInput }): void {
    for (const [id, pose] of Object.entries(poses)) {
      const entry = this.items.get(id);
      if (entry === undefined) continue;
      entry.object.visible = true;
      applyDrawPose(entry.object, pose);
    }
    this.syncHighlights();
  }

  /** The item under a point of the image, or null. `ndc` is in normalised device coordinates. */
  pickItem(ndc: { x: number; y: number }, camera: Camera): string | null {
    this.raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
    const visible = [...this.items.values()].filter((e) => e.object.visible).map((e) => e.object);
    const hit = this.raycaster.intersectObjects(visible, true)[0];
    let object: Object3D | null = hit?.object ?? null;
    while (object !== null) {
      const id = object.userData['itemId'];
      if (typeof id === 'string') return id;
      object = object.parent;
    }
    return null;
  }

  // -------------------------------------------------------------------------------------------
  // Ghost, landing outline, highlights, arrow
  // -------------------------------------------------------------------------------------------

  private ghostMaterial(tint: GhostTint): Material {
    let material = this.ghostMaterials.get(tint);
    if (material === undefined) {
      material = createGhostMaterial(GHOST_TINTS[tint] as Rgb, 0.55);
      this.ghostMaterials.set(tint, material);
    }
    return material;
  }

  /** The faint second pass of the ghost that shows through whatever is in front of it. */
  private xrayMaterial(tint: GhostTint): Material {
    let material = this.xrayMaterials.get(tint);
    if (material === undefined) {
      const xray = createGhostMaterial(GHOST_TINTS[tint] as Rgb, 0.2);
      xray.depthTest = false;
      material = xray;
      this.xrayMaterials.set(tint, material);
    }
    return material;
  }

  /** The two passes of a ghost of a tint: the solid one, and the one seen through things. */
  private buildGhost(itemType: string, tint: GhostTint): Group {
    const object = new Group();
    const solid = this.factory.buildPlain(itemType, this.ghostMaterial(tint));
    solid.renderOrder = 5;
    const xray = this.factory.buildPlain(itemType, this.xrayMaterial(tint));
    xray.traverse((child) => {
      child.renderOrder = 8;
    });
    object.add(solid, xray);
    return object;
  }

  /**
   * Shows the item in hand at a pose, tinted by what is known about the pose; null hides it.
   * The ghost is drawn a second time, faintly, through whatever hides it, so that an item held
   * inside or behind another can still be seen.
   */
  setGhost(ghost: { itemType: string; pose: DrawPoseInput; tint: GhostTint } | null): void {
    if (ghost === null) {
      if (this.ghost !== null) this.overlayRoot.remove(this.ghost.object);
      this.ghost = null;
      this.updateDropLine();
      return;
    }
    if (
      this.ghost === null ||
      this.ghost.itemType !== ghost.itemType ||
      this.ghost.tint !== ghost.tint
    ) {
      if (this.ghost !== null) this.overlayRoot.remove(this.ghost.object);
      const object = this.buildGhost(ghost.itemType, ghost.tint);
      this.overlayRoot.add(object);
      this.ghost = { itemType: ghost.itemType, object, tint: ghost.tint };
    }
    applyDrawPose(this.ghost.object, ghost.pose);
    this.updateDropLine();
  }

  /** The line from the ghost down to where it would be let go, while both are shown. */
  private updateDropLine(): void {
    if (this.dropLine !== null) {
      this.overlayRoot.remove(this.dropLine);
      this.dropLine.geometry.dispose();
      this.dropLine = null;
    }
    if (this.ghost === null || this.landing === null) return;
    const from = this.ghost.object.position;
    const to = this.landing.object.position;
    if (from.distanceTo(to) < 0.002) return;
    const line = new Line(
      new BufferGeometry().setFromPoints([from.clone(), to.clone()]),
      this.dropLineMaterial,
    );
    line.renderOrder = 9;
    this.overlayRoot.add(line);
    this.dropLine = line;
  }

  /** The two ends of the drop line (tub frame, metres), or null while none is drawn. */
  dropLineEnds(): { from: readonly number[]; to: readonly number[] } | null {
    if (this.dropLine === null || this.ghost === null || this.landing === null) return null;
    return {
      from: this.ghost.object.position.toArray(),
      to: this.landing.object.position.toArray(),
    };
  }

  /** Shows where the item in hand would be let go (the lowered pose); null hides it. */
  setLanding(landing: { itemType: string; pose: DrawPoseInput } | null): void {
    if (landing === null) {
      if (this.landing !== null) this.overlayRoot.remove(this.landing.object);
      this.landing = null;
      this.updateDropLine();
      return;
    }
    if (this.landing === null || this.landing.itemType !== landing.itemType) {
      if (this.landing !== null) this.overlayRoot.remove(this.landing.object);
      const object = this.factory.buildPlain(landing.itemType, this.landingMaterial);
      object.traverse((child) => {
        child.renderOrder = 9;
      });
      this.overlayRoot.add(object);
      this.landing = { itemType: landing.itemType, object };
    }
    applyDrawPose(this.landing.object, landing.pose);
    this.updateDropLine();
  }

  /** Marks the given items (a selection); every other mark is removed. */
  setHighlights(itemIds: readonly string[]): void {
    for (const [id, object] of this.highlights) {
      if (!itemIds.includes(id)) {
        this.overlayRoot.remove(object);
        this.highlights.delete(id);
      }
    }
    for (const id of itemIds) {
      const entry = this.items.get(id);
      if (entry === undefined || this.highlights.has(id)) continue;
      const object = this.factory.buildPlain(entry.itemType, this.highlightMaterial);
      object.renderOrder = 6;
      this.overlayRoot.add(object);
      this.highlights.set(id, object);
    }
    this.syncHighlights();
  }

  private syncHighlights(): void {
    for (const [id, object] of this.highlights) {
      const entry = this.items.get(id);
      if (entry === undefined) continue;
      object.visible = entry.object.visible;
      object.position.copy(entry.object.position);
      object.quaternion.copy(entry.object.quaternion);
    }
  }

  /** Draws an arrow from one point to another (tub frame, millimetres); null removes it. */
  setArrow(arrow: { from_mm: readonly number[]; to_mm: readonly number[] } | null): void {
    if (this.arrow !== null) {
      this.overlayRoot.remove(this.arrow);
      this.arrow.dispose();
      this.arrow = null;
    }
    if (arrow === null) return;
    const from = new Vector3(arrow.from_mm[0], arrow.from_mm[1], arrow.from_mm[2]).divideScalar(
      1000,
    );
    const to = new Vector3(arrow.to_mm[0], arrow.to_mm[1], arrow.to_mm[2]).divideScalar(1000);
    const length = from.distanceTo(to);
    if (length < 1e-6) return;
    this.arrow = new ArrowHelper(
      to.clone().sub(from).normalize(),
      from,
      length,
      0x1560d4,
      Math.min(0.05, length * 0.3),
      0.025,
    );
    this.arrow.renderOrder = 7;
    this.overlayRoot.add(this.arrow);
  }

  /** Frees everything the scene made. */
  dispose(): void {
    this.clearResidues();
    this.machine?.dispose();
    this.factory.dispose();
    for (const material of this.ghostMaterials.values()) material.dispose();
    for (const material of this.xrayMaterials.values()) material.dispose();
    this.landingMaterial.dispose();
    this.dropLineMaterial.dispose();
    this.dropLine?.geometry.dispose();
    this.highlightMaterial.dispose();
    this.environment?.dispose();
    this.arrow?.dispose();
  }
}
