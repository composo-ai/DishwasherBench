/**
 * Small pictures of single items, soil showing, for the tray of the client. One renderer with
 * its own small canvas draws them one after another.
 */

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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ItemFactory } from './items.ts';
import type { Mm3, RegionLayers } from './types.ts';

/** Regions that are seen from below or behind rather than from above. */
const UNDERSIDE_REGION = /under|exterior|outside|foot|base|bottom|back/;

/**
 * The direction (unit vector from the item towards the camera, item frame) from which a
 * thumbnail shows the soiled regions: from above and in front for soil on an eating or inner
 * face, from below when every soiled region is an underside or outer one. With no soil the
 * item is shown from above.
 */
export function thumbnailDirection(soiledRegions: readonly string[]): Mm3 {
  const below =
    soiledRegions.length > 0 && soiledRegions.every((region) => UNDERSIDE_REGION.test(region));
  const elevation = ((below ? -32 : 48) * Math.PI) / 180;
  const azimuth = (28 * Math.PI) / 180;
  return [
    Math.sin(azimuth) * Math.cos(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
  ];
}

/** Draws thumbnails of items. */
export class ThumbnailRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(26, 1, 0.01, 10);
  private readonly environment: { dispose(): void };

  /** `width` and `height` are the size of the pictures in pixels. */
  constructor(
    private readonly factory: ItemFactory,
    width = 144,
    height = 108,
  ) {
    const canvas = document.createElement('canvas');
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.up.set(0, 0, 1);
    this.camera.updateProjectionMatrix();
    this.scene.background = new Color('#eef0f3');
    const generator = new PMREMGenerator(this.renderer);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    generator.dispose();
    this.environment = target;
    this.scene.environment = target.texture;
    this.scene.environmentIntensity = 0.8;
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xffffff, 1.8);
    sun.position.set(0.6, -1, 1.6);
    this.scene.add(sun);
  }

  /** A PNG data URL showing one item of the type with the given layers. */
  render(itemType: string, layers: RegionLayers): string {
    const object = this.factory.build(itemType, layers);
    const { min, max } = this.factory.bounds(itemType);
    const centre = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const radius = Math.max(0.01, new Vector3(...max).sub(new Vector3(...min)).length() / 2);
    const direction = new Vector3(...thumbnailDirection([...layers.keys()]));
    // Long, thin items (cutlery) lie along x: look at them square on so that they fill the frame.
    const size = new Vector3(...max).sub(new Vector3(...min));
    const long = size.x > 4 * Math.max(size.y, size.z);
    if (long) direction.set(0, -0.55, Math.sign(direction.z) * 0.84);
    // A long item is fitted to the width of the picture, anything else to its height.
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const fit = long ? Math.atan(Math.tan(halfFov) * this.camera.aspect) : halfFov;
    const distance = (radius / Math.sin(fit)) * 1.02;
    this.camera.position.copy(centre).addScaledVector(direction.normalize(), distance);
    this.camera.near = Math.max(0.005, distance - radius * 1.5);
    this.camera.far = distance + radius * 1.5;
    this.camera.lookAt(centre);
    this.camera.updateProjectionMatrix();
    this.scene.add(object);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(object);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /** Frees the renderer. */
  dispose(): void {
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
