/**
 * Small pictures of a piece in each of its stances, for the buttons that choose one: the piece
 * turned as the stance turns it, seen from the front right and a little above, the way the
 * three-quarter view shows the baskets. Drawn with the item factory of `@spotless/render`, so
 * that a picture shows the item the stage shows, soil included.
 */

import type { ItemFactory, RegionLayers } from '@spotless/render';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Width and height of a stance picture, pixels. */
export const STANCE_PICTURE_PX = { width: 96, height: 80 } as const;

/** Draws stance pictures. Made on first use: it holds a WebGL context of its own. */
export class StanceView {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(24, 1, 0.01, 10);

  constructor(private readonly factory: ItemFactory) {
    const canvas = document.createElement('canvas');
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setPixelRatio(2);
    this.renderer.setSize(STANCE_PICTURE_PX.width, STANCE_PICTURE_PX.height, false);
    this.camera.aspect = STANCE_PICTURE_PX.width / STANCE_PICTURE_PX.height;
    this.camera.up.set(0, 0, 1);
    this.scene.background = new Color('#eef0f3');
    const generator = new PMREMGenerator(this.renderer);
    this.scene.environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    generator.dispose();
    this.scene.environmentIntensity = 0.8;
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xffffff, 1.8);
    sun.position.set(0.6, -1, 1.6);
    this.scene.add(sun);
  }

  /**
   * A PNG data URL of an item of the type turned by `quatWxyz` (the stance's quaternion in the
   * frame of a basket: x to the right, y to the back, z up).
   */
  render(
    itemType: string,
    layers: RegionLayers,
    quatWxyz: readonly [number, number, number, number],
  ): string {
    const object = this.factory.build(itemType, layers);
    const turned = new Group();
    turned.add(object);
    turned.quaternion.set(quatWxyz[1], quatWxyz[2], quatWxyz[3], quatWxyz[0]).normalize();
    const { min, max } = this.factory.bounds(itemType);
    const centre = new Vector3(
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ).applyQuaternion(turned.quaternion as Quaternion);
    const radius = Math.max(0.01, new Vector3(...max).sub(new Vector3(...min)).length() / 2);
    // From the front right and above, as the three-quarter views look at the baskets.
    const direction = new Vector3(0.55, -0.72, 0.48).normalize();
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const fit = Math.min(halfFov, Math.atan(Math.tan(halfFov) * this.camera.aspect));
    const distance = (radius / Math.sin(fit)) * 1.02;
    this.camera.position.copy(centre).addScaledVector(direction, distance);
    this.camera.near = Math.max(0.005, distance - radius * 1.5);
    this.camera.far = distance + radius * 1.5;
    this.camera.lookAt(centre);
    this.camera.updateProjectionMatrix();
    this.scene.add(turned);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(turned);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
