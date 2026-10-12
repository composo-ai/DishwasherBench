/**
 * The views of the `render` query (docs/research/benchmark.md section 3.2 c) as camera
 * placements: the named views of `views.ts`, the free camera (`custom`), and the fixed
 * directions from which a single item is shown (`item`, and the thumbnails of `get_item`).
 * Pure arithmetic in the tub frame, millimetres; the web client and the headless render
 * service both use it, so a person and a model are offered the same pictures.
 */

import type { CameraSpec, Mm3, SceneViewName, ViewSubject } from './types.ts';
import { fitView, viewSpec } from './views.ts';

/** The free camera of the `custom` view, as the session contract states it. */
export interface CustomCameraInput {
  /** Angle about +z from the -y (front) direction, degrees: 0 looks from the front, 90 from the right. */
  readonly azimuth_deg: number;
  /** Angle above the horizontal, degrees. */
  readonly elevation_deg: number;
  /** Point looked at, tub frame, millimetres. */
  readonly target_mm: Mm3;
  /** Distance from the target, millimetres. */
  readonly distance_mm: number;
  /** Vertical field of view, degrees. */
  readonly fov_deg: number;
}

/** Steepest elevation of a camera whose up vector is +z, degrees. */
export const ELEVATION_LIMIT_DEG = 89.9;

/**
 * Unit vector from the point looked at towards a camera at the given azimuth (about +z from
 * the front, -y) and elevation (above the horizontal), degrees.
 */
export function directionOf(azimuthDeg: number, elevationDeg: number): Mm3 {
  const elevation =
    (Math.max(-ELEVATION_LIMIT_DEG, Math.min(ELEVATION_LIMIT_DEG, elevationDeg)) * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  return [
    Math.sin(azimuth) * Math.cos(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
  ];
}

/** The camera of the `custom` view: perspective, up +z, nothing clipped. */
export function customCameraSpec(camera: CustomCameraInput): CameraSpec {
  const toward = directionOf(camera.azimuth_deg, camera.elevation_deg);
  return {
    kind: 'perspective',
    target_mm: camera.target_mm,
    position_mm: [
      camera.target_mm[0] + toward[0] * camera.distance_mm,
      camera.target_mm[1] + toward[1] * camera.distance_mm,
      camera.target_mm[2] + toward[2] * camera.distance_mm,
    ],
    up: [0, 0, 1],
    fov_deg: Math.max(1, Math.min(170, camera.fov_deg)),
    half_height_mm: camera.distance_mm * Math.tan((camera.fov_deg * Math.PI) / 360),
    clip_above_mm: null,
  };
}

/** The camera of a named view fitted to an image of the given aspect ratio. */
export function namedCameraSpec(
  view: SceneViewName,
  subject: ViewSubject,
  aspect: number,
): CameraSpec {
  return fitView(viewSpec(view, subject), aspect);
}

/** What a named view is of, for captions and for choosing the frame of its grid. */
export function viewRack(view: SceneViewName): string | null {
  switch (view) {
    case 'iso_lower':
    case 'top_lower':
      return 'lower_rack';
    case 'iso_upper':
    case 'top_upper':
      return 'upper_rack';
    case 'top_cutlery':
      return 'cutlery_basket';
    default:
      return null;
  }
}

/** True for the orthographic plan views. */
export function isPlanView(view: string): boolean {
  return view === 'top_lower' || view === 'top_upper' || view === 'top_cutlery';
}

/** True for the orthographic elevations. */
export function isElevationView(view: string): boolean {
  return view === 'front' || view === 'left' || view === 'right';
}

/** One of the fixed directions a single item is shown from. */
export interface ItemViewDirection {
  /** Stable name, shown in the corner of the picture. */
  readonly name: 'front_above' | 'back_below' | 'top' | 'side';
  /** What the direction shows, in a few words. */
  readonly label: string;
  /** Azimuth about the item's +z from its -y side, and elevation above its z = 0 plane, degrees. */
  readonly azimuth_deg: number;
  readonly elevation_deg: number;
}

/**
 * The four fixed views of a single item, in the item's own frame (z up when the item stands
 * upright): from the front and above, from the back and below (between them every face of
 * the item is seen), straight down, and from the side. They are the thumbnails of `get_item`
 * and the four panels of the `item` view, and the web client shows the same four.
 */
export const ITEM_VIEW_DIRECTIONS: readonly ItemViewDirection[] = [
  { name: 'front_above', label: 'from the front, above', azimuth_deg: 28, elevation_deg: 48 },
  { name: 'back_below', label: 'from the back, below', azimuth_deg: 208, elevation_deg: -38 },
  { name: 'top', label: 'straight down', azimuth_deg: 0, elevation_deg: ELEVATION_LIMIT_DEG },
  { name: 'side', label: 'from the right side', azimuth_deg: 90, elevation_deg: 6 },
];

/** Field of view of the single-item views, degrees. */
export const ITEM_VIEW_FOV_DEG = 26;

/**
 * Where the camera of a single-item view stands: the item's bounding sphere (centre and
 * radius, any one unit) fills the picture from the given direction. Returns the position, and
 * near and far planes that just hold the item.
 */
export function itemCamera(
  centre: Mm3,
  radius: number,
  azimuthDeg: number,
  elevationDeg: number,
  aspect: number,
): { position: Mm3; near: number; far: number } {
  const toward = directionOf(azimuthDeg, elevationDeg);
  const halfFov = (ITEM_VIEW_FOV_DEG * Math.PI) / 360;
  // The narrower of the two half angles of the picture decides the distance.
  const fit = aspect >= 1 ? halfFov : Math.atan(Math.tan(halfFov) * aspect);
  const r = Math.max(radius, 1e-6);
  const distance = (r / Math.sin(fit)) * 1.04;
  return {
    position: [
      centre[0] + toward[0] * distance,
      centre[1] + toward[1] * distance,
      centre[2] + toward[2] * distance,
    ],
    near: Math.max(distance - r * 1.5, distance * 0.01),
    far: distance + r * 1.5,
  };
}
