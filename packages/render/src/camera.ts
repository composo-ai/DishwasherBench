/**
 * The cameras of the scene: one perspective and one orthographic camera, of which a view uses
 * one. Scene units are metres in the tub frame with z up.
 */

import type { Camera } from 'three';
import { OrthographicCamera, PerspectiveCamera, Plane, Vector3 } from 'three';
import type { CameraSpec } from './types.ts';

/** Holds both cameras and applies {@link CameraSpec}s to them. */
export class ViewCameras {
  readonly perspective = new PerspectiveCamera(32, 1, 0.02, 20);
  readonly orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.02, 20);
  /** The point the active camera looks at, metres. */
  readonly target = new Vector3();
  private kind: 'perspective' | 'orthographic' = 'perspective';
  private aspect = 1;
  private halfHeight = 0.5;

  constructor() {
    this.perspective.up.set(0, 0, 1);
    this.orthographic.up.set(0, 0, 1);
  }

  /** The camera of the current view. */
  get active(): Camera {
    return this.kind === 'perspective' ? this.perspective : this.orthographic;
  }

  /** Places the camera of the spec's kind and makes it the active one. */
  apply(spec: CameraSpec): void {
    this.kind = spec.kind;
    this.halfHeight = spec.half_height_mm / 1000;
    this.target.set(spec.target_mm[0] / 1000, spec.target_mm[1] / 1000, spec.target_mm[2] / 1000);
    const camera = this.active;
    camera.up.set(spec.up[0], spec.up[1], spec.up[2]);
    camera.position.set(
      spec.position_mm[0] / 1000,
      spec.position_mm[1] / 1000,
      spec.position_mm[2] / 1000,
    );
    camera.lookAt(this.target);
    if (spec.kind === 'perspective') this.perspective.fov = spec.fov_deg;
    this.orthographic.zoom = 1;
    this.resize(this.aspect);
  }

  /** Adapts both cameras to an image of the given aspect ratio (width over height). */
  resize(aspect: number): void {
    this.aspect = aspect;
    this.perspective.aspect = aspect;
    this.perspective.updateProjectionMatrix();
    this.orthographic.left = -this.halfHeight * aspect;
    this.orthographic.right = this.halfHeight * aspect;
    this.orthographic.top = this.halfHeight;
    this.orthographic.bottom = -this.halfHeight;
    this.orthographic.updateProjectionMatrix();
  }

  /**
   * The point the cutaway is decided from: the camera position, or for an orthographic view a
   * point far along the direction it looks from.
   */
  cutawayPoint(out: Vector3): Vector3 {
    const camera = this.active;
    if (this.kind === 'perspective') return out.copy(camera.position);
    return out
      .copy(camera.position)
      .sub(this.target)
      .normalize()
      .multiplyScalar(100)
      .add(this.target);
  }
}

/**
 * The clipping planes of a view: nothing is drawn above `clip_above_mm`, and nothing below
 * `clip_below_mm` when that is given.
 */
export function clipPlanes(clipAboveMm: number | null, clipBelowMm: number | null = null): Plane[] {
  const planes: Plane[] = [];
  if (clipAboveMm !== null) planes.push(new Plane(new Vector3(0, 0, -1), clipAboveMm / 1000));
  if (clipBelowMm !== null) planes.push(new Plane(new Vector3(0, 0, 1), -clipBelowMm / 1000));
  return planes;
}
