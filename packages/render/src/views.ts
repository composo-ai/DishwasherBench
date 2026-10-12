/**
 * The named views of the machine: three-quarter views with a basket in the middle, straight
 * down onto each basket, and the front and side elevations. Pure arithmetic in the tub frame
 * (z up, +x to the right facing the machine, +y to the back), millimetres; the result is turned
 * into a Three.js camera by `scene.ts`.
 */

import type { CameraSpec, Mm3, SceneViewName, ViewRack, ViewSubject } from './types.ts';

/** A view before it is fitted to an image: what must be visible, and from where. */
export interface ViewSpec {
  readonly kind: 'perspective' | 'orthographic';
  /** Point looked at. */
  readonly target_mm: Mm3;
  /** Unit vector from the target towards the camera. */
  readonly toward_camera: Mm3;
  /** Up vector of the camera: +z for every view. */
  readonly up: Mm3;
  /** Half of the width and of the height that must fit in the image at the target. */
  readonly fit_half_width_mm: number;
  readonly fit_half_height_mm: number;
  /**
   * Height above which nothing is drawn, or null: set for a plan view of a basket that has
   * another basket over it, so that the basket looked at is not covered.
   */
  readonly clip_above_mm: number | null;
  /**
   * Height below which nothing is drawn, or null or absent: set for a plan view of a basket
   * that hangs over another one, so that what is underneath does not show through its wires.
   */
  readonly clip_below_mm?: number | null;
}

/**
 * How far under the base grid of a basket its plan view is cut when another basket lies
 * below, and how far under the base grid of a basket the plan view of the one beneath it is
 * cut when that basket reaches down into its envelope, millimetres.
 */
export const PLAN_CLIP_BELOW_MM = 15;

/** Vertical field of view of the perspective views, degrees. */
export const VIEW_FOV_DEG = 32;

/** Margin around the subject of a view, as a factor on its half extents. */
export const VIEW_MARGIN = 1.12;

/**
 * Direction of the plan views: straight down but for a tilt of 0.03 degrees towards the front,
 * which fixes which way is up in the picture (+y, the back of the machine) for a camera whose
 * up vector is +z like every other view's, so that an orbit control can take over from it.
 */
const PLAN_TILT = 0.0005;
export const PLAN_DIRECTION: Mm3 = [
  0,
  -PLAN_TILT / Math.hypot(PLAN_TILT, 1),
  1 / Math.hypot(PLAN_TILT, 1),
];

function rackOf(subject: ViewSubject, rack: string): ViewRack | undefined {
  return subject.racks.find((r) => r.rack === rack);
}

function centreOf(rack: ViewRack): Mm3 {
  return [
    rack.origin_mm[0] + rack.envelope_mm[0] / 2,
    rack.origin_mm[1] + rack.envelope_mm[1] / 2,
    rack.origin_mm[2] + rack.envelope_mm[2] / 2,
  ];
}

function tubCentre(subject: ViewSubject): Mm3 {
  return [
    (subject.tub_min_mm[0] + subject.tub_max_mm[0]) / 2,
    (subject.tub_min_mm[1] + subject.tub_max_mm[1]) / 2,
    (subject.tub_min_mm[2] + subject.tub_max_mm[2]) / 2,
  ];
}

/**
 * True when two racks overlap in plan by more than 30 mm: a pulled-out basket whose rear edge
 * is still under the front edge of the basket above is not covered by it.
 */
function overlapInPlan(a: ViewRack, b: ViewRack): boolean {
  const margin = 30;
  const overlap = (axis: 0 | 1): boolean =>
    a.origin_mm[axis] + a.envelope_mm[axis] - margin > b.origin_mm[axis] &&
    b.origin_mm[axis] + b.envelope_mm[axis] - margin > a.origin_mm[axis];
  return overlap(0) && overlap(1);
}

function isoView(subject: ViewSubject, rack: ViewRack | undefined): ViewSpec {
  const target = rack === undefined ? tubCentre(subject) : centreOf(rack);
  // From the front right, 38 degrees to the side and 36 degrees above the horizontal: the way
  // a person stands at an open dishwasher.
  const azimuth = (38 * Math.PI) / 180;
  const elevation = (36 * Math.PI) / 180;
  const half =
    rack === undefined
      ? (subject.tub_max_mm[2] - subject.tub_min_mm[2]) / 2
      : Math.max(rack.envelope_mm[0], rack.envelope_mm[1]) * 0.8;
  return {
    kind: 'perspective',
    target_mm: target,
    toward_camera: [
      Math.sin(azimuth) * Math.cos(elevation),
      -Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
    ],
    up: [0, 0, 1],
    fit_half_width_mm: half * VIEW_MARGIN,
    fit_half_height_mm: half * VIEW_MARGIN,
    clip_above_mm: null,
  };
}

function topView(subject: ViewSubject, rackId: string): ViewSpec {
  const rack = rackOf(subject, rackId);
  if (rack === undefined) {
    return {
      kind: 'orthographic',
      target_mm: tubCentre(subject),
      toward_camera: PLAN_DIRECTION,
      up: [0, 0, 1],
      fit_half_width_mm: ((subject.tub_max_mm[0] - subject.tub_min_mm[0]) / 2) * VIEW_MARGIN,
      fit_half_height_mm: ((subject.tub_max_mm[1] - subject.tub_min_mm[1]) / 2) * VIEW_MARGIN,
      clip_above_mm: null,
    };
  }
  const top = rack.origin_mm[2] + rack.envelope_mm[2];
  // Another basket that hangs over this one would cover it, load and all: cut the picture
  // just above the envelope of the basket looked at, or, when the basket above has been set
  // lower than that (the upper basket at its second or third height reaches down into the
  // envelope of the lower one), just under the basket above. The cutlery basket stands in the
  // lower basket and is under whatever is over that. [MEASURED 2026-10-11: with the upper
  // basket at height 2 its floor is at 395 mm and the lower envelope ends at 413 mm; the test
  // then was "its floor is at or above the envelope", the cut was not made, and a model was
  // twice shown the lower basket with the whole load of the upper one drawn over it.]
  const above = subject.racks.filter(
    (other) =>
      other.rack !== rack.rack &&
      other.origin_mm[2] > rack.origin_mm[2] + 1 &&
      overlapInPlan(rack, other),
  );
  const covered = above.length > 0;
  const lowestAbove = Math.min(...above.map((other) => other.origin_mm[2]));
  const cut = lowestAbove >= top - 1 ? top : lowestAbove - PLAN_CLIP_BELOW_MM;
  // A basket that lies under this one would show through its wires, load and all.
  const over = subject.racks.some(
    (other) =>
      other.rack !== rack.rack &&
      other.origin_mm[2] < rack.origin_mm[2] - 1 &&
      overlapInPlan(rack, other),
  );
  return {
    kind: 'orthographic',
    target_mm: centreOf(rack),
    toward_camera: PLAN_DIRECTION,
    up: [0, 0, 1],
    fit_half_width_mm: (rack.envelope_mm[0] / 2) * VIEW_MARGIN,
    fit_half_height_mm: (rack.envelope_mm[1] / 2) * VIEW_MARGIN,
    clip_above_mm: covered ? cut : null,
    clip_below_mm: over ? rack.origin_mm[2] - PLAN_CLIP_BELOW_MM : null,
  };
}

/** The extent along y of the tub and of everything pulled out of it. */
function depthRange(subject: ViewSubject): readonly [number, number] {
  let min = subject.tub_min_mm[1];
  let max = subject.tub_max_mm[1];
  for (const rack of subject.racks) {
    min = Math.min(min, rack.origin_mm[1]);
    max = Math.max(max, rack.origin_mm[1] + rack.envelope_mm[1]);
  }
  return [min, max];
}

function elevation(subject: ViewSubject, view: 'front' | 'left' | 'right'): ViewSpec {
  const centre = tubCentre(subject);
  const halfHeight = ((subject.tub_max_mm[2] - subject.tub_min_mm[2]) / 2) * VIEW_MARGIN;
  if (view === 'front') {
    return {
      kind: 'orthographic',
      target_mm: centre,
      toward_camera: [0, -1, 0],
      up: [0, 0, 1],
      fit_half_width_mm: ((subject.tub_max_mm[0] - subject.tub_min_mm[0]) / 2) * VIEW_MARGIN,
      fit_half_height_mm: halfHeight,
      clip_above_mm: null,
    };
  }
  const [yMin, yMax] = depthRange(subject);
  return {
    kind: 'orthographic',
    target_mm: [centre[0], (yMin + yMax) / 2, centre[2]],
    toward_camera: [view === 'left' ? -1 : 1, 0, 0],
    up: [0, 0, 1],
    fit_half_width_mm: ((yMax - yMin) / 2) * VIEW_MARGIN,
    fit_half_height_mm: halfHeight,
    clip_above_mm: null,
  };
}

/**
 * What a named view shows. The baskets are taken where they are now, so the three-quarter and
 * plan views follow a basket that has been pulled out.
 */
export function viewSpec(view: SceneViewName, subject: ViewSubject): ViewSpec {
  switch (view) {
    case 'iso_lower':
      return isoView(subject, rackOf(subject, 'lower_rack'));
    case 'iso_upper':
      return isoView(subject, rackOf(subject, 'upper_rack'));
    case 'top_lower':
      return topView(subject, 'lower_rack');
    case 'top_upper':
      return topView(subject, 'upper_rack');
    case 'top_cutlery':
      return topView(subject, 'cutlery_basket');
    case 'front':
    case 'left':
    case 'right':
      return elevation(subject, view);
  }
}

/**
 * Fits a view to an image of the given aspect ratio (width over height): the whole of the
 * fitted extent is visible, and nothing is stretched.
 */
export function fitView(spec: ViewSpec, aspect: number): CameraSpec {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  // The half height that shows both the wanted height and the wanted width.
  const halfHeight = Math.max(spec.fit_half_height_mm, spec.fit_half_width_mm / a);
  const distance =
    spec.kind === 'perspective'
      ? halfHeight / Math.tan((VIEW_FOV_DEG * Math.PI) / 360) + halfHeight
      : 3000;
  return {
    kind: spec.kind,
    target_mm: spec.target_mm,
    position_mm: [
      spec.target_mm[0] + spec.toward_camera[0] * distance,
      spec.target_mm[1] + spec.toward_camera[1] * distance,
      spec.target_mm[2] + spec.toward_camera[2] * distance,
    ],
    up: spec.up,
    fov_deg: VIEW_FOV_DEG,
    half_height_mm: halfHeight,
    clip_above_mm: spec.clip_above_mm,
    clip_below_mm: spec.clip_below_mm ?? null,
  };
}

/** Human-readable name of a view, for buttons. */
export function viewLabel(view: SceneViewName): string {
  switch (view) {
    case 'iso_lower':
      return 'Lower basket';
    case 'iso_upper':
      return 'Upper basket';
    case 'top_lower':
      return 'Top: lower';
    case 'top_upper':
      return 'Top: upper';
    case 'top_cutlery':
      return 'Top: cutlery';
    case 'front':
      return 'Front';
    case 'left':
      return 'Left side';
    case 'right':
      return 'Right side';
  }
}
