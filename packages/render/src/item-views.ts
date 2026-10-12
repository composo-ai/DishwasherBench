/**
 * Pictures of a single item in its own frame, soil (or the residue of a wash) showing, from
 * the fixed directions of `ITEM_VIEW_DIRECTIONS` or from any direction: the thumbnails of
 * `get_item`, the `item` view of the `render` query, and the same four views in the web
 * client. One class draws them all with a renderer it is given, so the headless render
 * service and the page produce the same pictures.
 */

import type { Group, WebGLRenderer } from 'three';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ITEM_VIEW_FOV_DEG, itemCamera } from './agent-views.ts';
import { materialAppearance } from './appearance.ts';
import type { ItemFactory } from './items.ts';
import type { ResidueTiles } from './residue-map.ts';
import { residueOutline } from './residue-map.ts';
import { buildResidueObject } from './residue-object.ts';
import type { RegionLayers } from './types.ts';

/** A rectangle of the renderer's drawing buffer, pixels from the top-left corner. */
export interface ItemViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What to draw of an item. */
export interface ItemViewSubject {
  readonly itemType: string;
  /** What is painted on the item: the level's soil, or nothing for a washed item. */
  readonly layers: RegionLayers;
  /** The residue of a wash, drawn where it is; null or absent for none. */
  readonly residue?: ResidueTiles | null;
}

/** Background of the single-item pictures. */
export const ITEM_VIEW_BACKGROUND = '#eef0f3';

/** Draws single items with a renderer that belongs to the caller. */
export class ItemViewRenderer {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(ITEM_VIEW_FOV_DEG, 1, 0.01, 10);
  private readonly environment: { dispose(): void };

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly factory: ItemFactory,
  ) {
    this.camera.up.set(0, 0, 1);
    this.scene.background = new Color(ITEM_VIEW_BACKGROUND);
    const generator = new PMREMGenerator(renderer);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    generator.dispose();
    this.environment = target;
    this.scene.environment = target.texture;
    this.scene.environmentIntensity = 0.8;
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xffffff, 1.8);
    sun.position.set(0.6, -1, 1.6);
    this.scene.add(sun);
    // A weaker light from below, so that the underside of an item is not black.
    const under = new DirectionalLight(0xffffff, 0.9);
    under.position.set(-0.5, 0.8, -1.4);
    this.scene.add(under);
  }

  private build(subject: ItemViewSubject): { object: Group; dispose: () => void } {
    const object = this.factory.build(subject.itemType, subject.layers);
    if (subject.residue === undefined || subject.residue === null) {
      return { object, dispose: () => undefined };
    }
    const material = materialAppearance(this.factory.materialOf(subject.itemType));
    const residue = buildResidueObject(subject.residue, residueOutline(material.colour));
    object.add(residue.object);
    return { object, dispose: () => residue.dispose() };
  }

  /**
   * Draws the item into a rectangle of the renderer's drawing buffer, seen from the given
   * azimuth (about the item's +z from its -y side) and elevation, degrees. The rest of the
   * buffer is left as it is, so several views can share one picture.
   */
  draw(
    subject: ItemViewSubject,
    azimuthDeg: number,
    elevationDeg: number,
    viewport: ItemViewport,
  ): void {
    const { min, max } = this.factory.bounds(subject.itemType);
    const centre = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const radius = Math.max(0.01, new Vector3(...max).sub(new Vector3(...min)).length() / 2);
    const aspect = viewport.width / viewport.height;
    const placed = itemCamera(
      [centre.x, centre.y, centre.z],
      radius,
      azimuthDeg,
      elevationDeg,
      aspect,
    );
    this.camera.aspect = aspect;
    this.camera.near = placed.near;
    this.camera.far = placed.far;
    this.camera.position.set(placed.position[0], placed.position[1], placed.position[2]);
    this.camera.lookAt(centre);
    this.camera.updateProjectionMatrix();
    const built = this.build(subject);
    this.scene.add(built.object);
    const renderer = this.renderer;
    // WebGL viewports are measured from the bottom-left corner. The renderer's pixel ratio is
    // taken to be 1 (the callers set it so): viewport units are then buffer pixels.
    const size = renderer.getDrawingBufferSize(new Vector2());
    const y = size.y - viewport.y - viewport.height;
    const planes = renderer.clippingPlanes;
    renderer.clippingPlanes = [];
    renderer.setViewport(viewport.x, y, viewport.width, viewport.height);
    renderer.setScissor(viewport.x, y, viewport.width, viewport.height);
    renderer.setScissorTest(true);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.clippingPlanes = planes;
    this.scene.remove(built.object);
    built.dispose();
  }

  /** Frees what the renderer made (not the renderer it was given, nor the factory). */
  dispose(): void {
    this.environment.dispose();
  }
}
