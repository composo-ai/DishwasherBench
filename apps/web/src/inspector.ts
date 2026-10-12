/**
 * One washed item, close up, from all sides: a small stage of its own with the item as it
 * came out (bare, with the residue of its report painted where it is) and an orbit camera
 * that goes all the way round, over and under. The item stands in its own frame, as it would
 * on a table; where it lay in the machine is the main stage's to show.
 *
 * It draws with the item factory of the main scene (meshes and materials are built once) and
 * decides nothing about the game.
 */

import type { ItemFactory, RegionLayers, ResidueObject, ResidueTiles, Rgb } from '@spotless/render';
import { buildResidueObject } from '@spotless/render';
import type { Group } from 'three';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** The sides an item can be looked at from, with the direction from the item to the camera. */
export const INSPECTOR_SIDES: readonly {
  readonly id: string;
  readonly label: string;
  readonly direction: readonly [number, number, number];
}[] = [
  { id: 'three_quarter', label: 'Three-quarter', direction: [0.45, -0.75, 0.55] },
  // Straight up and down are turned a hair, so that the orbit camera keeps its bearings.
  { id: 'above', label: 'From above', direction: [0, -0.04, 1] },
  { id: 'below', label: 'From below', direction: [0, -0.04, -1] },
  { id: 'front', label: 'Front', direction: [0, -1, 0.02] },
  { id: 'back', label: 'Back', direction: [0, 1, 0.02] },
  { id: 'left', label: 'Left', direction: [-1, 0, 0.02] },
  { id: 'right', label: 'Right', direction: [1, 0, 0.02] },
];

/** What the inspector shows. */
export interface InspectedItem {
  readonly itemType: string;
  /** What is painted on the item's regions by the surface shader (none after a wash). */
  readonly layers: RegionLayers;
  /** The tiles of the item's residue map, or null for none. */
  readonly tiles: ResidueTiles | null;
  /** Outline colour of the residue on this item's material. */
  readonly outline: Rgb;
}

/** The close-up stage. */
export class ItemInspector {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.005, 10);
  private readonly controls: OrbitControls;
  private readonly environment: { dispose(): void };
  private item: Group | null = null;
  private residue: ResidueObject | null = null;
  private radius = 0.1;
  private readonly centre = new Vector3();
  private side = 'three_quarter';
  private disposed = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly factory: ItemFactory,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.up.set(0, 0, 1);
    this.scene.background = new Color('#e9ecf0');
    const generator = new PMREMGenerator(this.renderer);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    generator.dispose();
    this.environment = target;
    this.scene.environment = target.texture;
    this.scene.environmentIntensity = 0.7;
    // Light from every side: the underside of a plate is looked at as often as its face.
    this.scene.add(new AmbientLight(0xffffff, 0.75));
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(0.6, -1, 1.6);
    const under = new DirectionalLight(0xffffff, 0.9);
    under.position.set(-0.5, 0.8, -1.4);
    this.scene.add(key, under);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.enablePan = false;
    this.controls.addEventListener('change', () => this.render());
    this.resize();
  }

  /** The side last chosen with {@link lookFrom} (the camera may have been turned since). */
  get view(): string {
    return this.side;
  }

  /** Shows an item (replacing the one shown), keeping the direction of the camera. */
  show(inspected: InspectedItem): void {
    if (this.item !== null) this.scene.remove(this.item);
    this.residue?.dispose();
    this.residue = null;
    const item = this.factory.build(inspected.itemType, inspected.layers);
    if (inspected.tiles !== null) {
      this.residue = buildResidueObject(inspected.tiles, inspected.outline);
      item.add(this.residue.object);
    }
    this.scene.add(item);
    const first = this.item === null;
    this.item = item;
    const { min, max } = this.factory.bounds(inspected.itemType);
    this.centre.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    this.radius = Math.max(0.01, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    this.controls.target.copy(this.centre);
    this.controls.minDistance = this.radius * 0.35;
    this.controls.maxDistance = this.radius * 12;
    if (first) this.lookFrom(this.side);
    else this.render();
  }

  /** Points the camera at the item from one of {@link INSPECTOR_SIDES}. */
  lookFrom(side: string): void {
    const chosen = INSPECTOR_SIDES.find((candidate) => candidate.id === side);
    if (chosen === undefined) return;
    this.side = chosen.id;
    const direction = new Vector3(...chosen.direction).normalize();
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const fit = Math.min(halfFov, Math.atan(Math.tan(halfFov) * this.camera.aspect));
    const distance = (this.radius / Math.sin(fit)) * 1.08;
    this.camera.position.copy(this.centre).addScaledVector(direction, distance);
    this.camera.near = Math.max(0.002, this.radius * 0.02);
    this.camera.far = distance + this.radius * 14;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(this.centre);
    this.controls.update();
    this.render();
  }

  /** Adapts the renderer and the camera to the size of the canvas on the page. */
  resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** Draws one frame. */
  render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** Frees the renderer and what was built for the item. The factory's meshes stay. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controls.dispose();
    this.residue?.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
