/**
 * The marks of one picture of the machine: which grid goes with which view, where the item
 * labels go, and the caption that says how to read them. The projection of tub-frame points
 * onto the image comes from the camera (`projectorOf`, `cameraProjector`); the marks are
 * drawn by `drawOverlay`. Shared by the headless render service and the web client.
 */

import type { Camera } from 'three';
import { Vector3 } from 'three';
import {
  ITEM_VIEW_FOV_DEG,
  isElevationView,
  isPlanView,
  itemCamera,
  viewRack,
} from './agent-views.ts';
import { ViewCameras } from './camera.ts';
import type {
  GridFrame,
  LabelAnchor,
  OverlayLine,
  OverlayMarks,
  OverlayText,
  Projector,
} from './overlay.ts';
import {
  captionMarks,
  elevationGridMarks,
  frameColour,
  labelMarks,
  mergeMarks,
  planGridMarks,
} from './overlay.ts';
import { RESIDUE_STEPS } from './residue-map.ts';
import type { CameraSpec, Mm3 } from './types.ts';

/**
 * The projection of a Three.js camera onto an image of the given size: tub-frame millimetres
 * to pixels from the top-left corner. Points behind a perspective camera give null.
 */
export function projectorOf(camera: Camera, width: number, height: number): Projector {
  camera.updateMatrixWorld(true);
  const scratch = new Vector3();
  const perspective = (camera as { isPerspectiveCamera?: boolean }).isPerspectiveCamera === true;
  return (point) => {
    scratch.set(point[0] / 1000, point[1] / 1000, point[2] / 1000);
    if (perspective) {
      const depth = scratch.clone().applyMatrix4(camera.matrixWorldInverse).z;
      if (depth > -1e-4) return null;
    }
    scratch.project(camera);
    return [((scratch.x + 1) / 2) * width, ((1 - scratch.y) / 2) * height];
  };
}

/** The projection of a camera placement onto an image of the given size. */
export function cameraProjector(spec: CameraSpec, width: number, height: number): Projector {
  const cameras = new ViewCameras();
  cameras.resize(width / height);
  cameras.apply(spec);
  return projectorOf(cameras.active, width, height);
}

/** Something written at a point of the scene: the id of a tine row at its first tine. */
export interface SceneNote {
  readonly text: string;
  /** Tub frame, millimetres. */
  readonly at_mm: Mm3;
  /** The frame the note belongs to (decides its colour). */
  readonly frame: string;
}

/** What the marks of a picture are computed from. */
export interface ViewMarksInput {
  /** A named view, `custom`, or `orbit` (the web client's free camera). */
  readonly view: string;
  readonly width: number;
  readonly height: number;
  readonly project: Projector;
  /** Corners of the tub interior, tub frame, millimetres. */
  readonly tub_min_mm: Mm3;
  readonly tub_max_mm: Mm3;
  /** The baskets (and the cutlery basket) as they stand now. */
  readonly frames: readonly GridFrame[];
  readonly grid: boolean;
  readonly labels: boolean;
  /** The items in the machine: id and the centre of the item, tub frame, millimetres. */
  readonly items: readonly { readonly item_id: string; readonly centre_mm: Mm3 }[];
  /** Ids of tine rows and the like, written in the plan views when labels are on. */
  readonly notes?: readonly SceneNote[];
  /**
   * Outlines drawn in the plan view of their frame when labels are on: the cells of the
   * cutlery basket, each a closed loop of tub-frame points, millimetres.
   */
  readonly outlines?: readonly { readonly frame: string; readonly loop_mm: readonly Mm3[] }[];
  /** Height above which the view draws nothing (a plan view under another basket), or null. */
  readonly clip_above_mm: number | null;
  /** Height below which the view draws nothing (a plan view over another basket), or null or absent. */
  readonly clip_below_mm?: number | null;
}

/** The extent along y of the tub and of every basket pulled out of it, millimetres. */
function depthRange(input: ViewMarksInput): readonly [number, number] {
  let min = input.tub_min_mm[1];
  let max = input.tub_max_mm[1];
  for (const frame of input.frames) {
    min = Math.min(min, frame.origin_mm[1]);
    max = Math.max(max, frame.origin_mm[1] + frame.size_mm[1]);
  }
  return [min, max];
}

/** How the caption names the grid of a view (short: a caption is one line of the picture). */
function gridCaption(input: ViewMarksInput, frames: readonly GridFrame[]): string {
  if (isElevationView(input.view)) {
    const axis = input.view === 'front' ? 'x' : 'y';
    return `grid: tub frame ${axis}, z (mm); coloured rulers: basket frames`;
  }
  if (frames.length === 0) return 'grid: no basket';
  return `grid: ${frames.map((f) => f.frame).join(', ')} frame x, y (mm)`;
}

/**
 * The marks of a picture: the grid of the view (the basket's own frame in a plan or
 * three-quarter view, the tub frame with basket rulers in an elevation), item-id labels, and
 * a caption naming the view and the frame of the grid. With neither grid nor labels the
 * result is empty and the picture is the bare scene.
 */
export function viewMarks(input: ViewMarksInput): OverlayMarks {
  const sets: OverlayMarks[] = [];
  const captions: string[] = [];
  if (input.grid) {
    if (isElevationView(input.view)) {
      const axis = input.view === 'front' ? 0 : 1;
      const across: readonly [number, number] =
        axis === 0 ? [input.tub_min_mm[0], input.tub_max_mm[0]] : depthRange(input);
      const frames = input.frames.filter((f) => f.frame !== 'cutlery_basket');
      sets.push(
        elevationGridMarks(
          {
            axis,
            across_mm: across,
            z_mm: [input.tub_min_mm[2], input.tub_max_mm[2]],
            depth_mm:
              axis === 0
                ? (input.tub_min_mm[1] + input.tub_max_mm[1]) / 2
                : (input.tub_min_mm[0] + input.tub_max_mm[0]) / 2,
            frames,
          },
          input.project,
        ),
      );
      captions.push(gridCaption(input, frames));
    } else {
      const named = viewRack(input.view as never);
      const frames =
        named === null
          ? input.frames.filter((f) => f.frame !== 'cutlery_basket')
          : input.frames.filter((f) => f.frame === named);
      for (const frame of frames) sets.push(planGridMarks(frame, input.project));
      captions.push(gridCaption(input, frames));
    }
  }
  if (input.labels) {
    const clip = input.clip_above_mm;
    const floor = input.clip_below_mm ?? null;
    const anchors: LabelAnchor[] = [];
    for (const item of [...input.items].sort((a, b) => (a.item_id < b.item_id ? -1 : 1))) {
      // What the view does not draw gets no label.
      if (clip !== null && item.centre_mm[2] > clip) continue;
      if (floor !== null && item.centre_mm[2] < floor) continue;
      const p = input.project(item.centre_mm);
      if (p === null) continue;
      anchors.push({ text: item.item_id, x: p[0], y: p[1] });
    }
    if (isPlanView(input.view)) {
      const notes: OverlayText[] = [];
      for (const note of input.notes ?? []) {
        if (viewRack(input.view as never) !== note.frame) continue;
        const p = input.project(note.at_mm);
        if (p === null) continue;
        notes.push({
          x: p[0],
          y: p[1] + 4,
          text: note.text,
          size: 10,
          colour: frameColour(note.frame),
          align: 'center',
          baseline: 'top',
          halo: 'rgba(255, 255, 255, 0.92)',
        });
      }
      const outlines: OverlayLine[] = [];
      for (const outline of input.outlines ?? []) {
        if (viewRack(input.view as never) !== outline.frame) continue;
        const points = outline.loop_mm.map((point) => input.project(point));
        for (let i = 0; i < points.length; i++) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          if (a == null || b == null) continue;
          outlines.push({
            x1: a[0],
            y1: a[1],
            x2: b[0],
            y2: b[1],
            colour: frameColour(outline.frame),
            width: 2,
          });
        }
      }
      sets.push({ lines: outlines, dots: [], texts: notes });
    }
    sets.push(labelMarks(anchors, input.width, input.height));
    captions.push('labels: item ids');
  }
  if (captions.length > 0) {
    sets.push(captionMarks(`${input.view} | ${captions.join(' | ')}`, input.width));
  }
  return mergeMarks(...sets);
}

/**
 * The legend of the residue scale, for a picture that shows what a wash left: the four steps
 * of `RESIDUE_STEPS` with what each means, in the bottom-left corner of a rectangle of the
 * picture. `traces` adds the line that explains the small dots.
 */
export function residueLegendMarks(
  area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  traces = false,
): OverlayMarks {
  const rows = [
    ...RESIDUE_STEPS.map((step) => ({ colour: step.css, r: 5, text: step.label })),
    ...(traces
      ? [
          {
            colour: RESIDUE_STEPS[0]?.css ?? '#f077c0',
            r: 2,
            text: 'small dot: a trace too faint to count',
          },
        ]
      : []),
  ];
  const line = 15;
  const left = area.x + 8;
  const top = area.y + area.height - 8 - line * (rows.length + 1);
  const box = { fill: 'rgba(255, 255, 255, 0.86)', stroke: 'rgba(0, 0, 0, 0.35)' };
  const texts: OverlayText[] = [
    {
      x: left,
      y: top,
      text: 'magenta: share of the soil still on that spot',
      size: 11,
      colour: '#111111',
      align: 'left',
      baseline: 'top',
      box,
    },
  ];
  const dots: OverlayMarks['dots'][number][] = [];
  rows.forEach((row, i) => {
    const y = top + line * (i + 1) + 2;
    dots.push({ x: left + 6, y: y + 6, r: row.r, colour: row.colour });
    texts.push({
      x: left + 16,
      y,
      text: row.text,
      size: 11,
      colour: '#111111',
      align: 'left',
      baseline: 'top',
      box,
    });
  });
  return { lines: [], dots, texts };
}

/** Colours of the item-frame axes in a single-item picture: x, y, z. */
export const ITEM_AXIS_COLOURS: readonly [string, string, string] = [
  '#c62828',
  '#2e7d32',
  '#1565c0',
];

/**
 * The axes of an item's own frame drawn over one panel of a single-item picture, so that it
 * can be told which end of the item is +x (the frame orientations and yaw refer to): three
 * arrows from the item's reference point (the point `position_mm` of a pose refers to, marked
 * with a dot and "ref") along +x, +y and +z, each labelled. The projection is that of
 * `ItemViewRenderer.draw` for the same box and direction.
 */
export function itemAxisMarks(input: {
  /** Corners of the item's bounding box in its own frame, millimetres. */
  readonly min_mm: Mm3;
  readonly max_mm: Mm3;
  /** The item's reference point in its own frame, millimetres. */
  readonly reference_mm: Mm3;
  readonly azimuth_deg: number;
  readonly elevation_deg: number;
  /** The rectangle of the picture the panel is drawn into, pixels. */
  readonly panel: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}): OverlayMarks {
  const { min_mm: min, max_mm: max, panel } = input;
  const centre: Mm3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.max(10, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
  const aspect = panel.width / panel.height;
  const placed = itemCamera(centre, radius, input.azimuth_deg, input.elevation_deg, aspect);
  const project = cameraProjector(
    {
      kind: 'perspective',
      position_mm: placed.position,
      target_mm: centre,
      up: [0, 0, 1],
      fov_deg: ITEM_VIEW_FOV_DEG,
      half_height_mm: radius,
      clip_above_mm: null,
    },
    panel.width,
    panel.height,
  );
  const origin = project(input.reference_mm);
  if (origin === null) return { lines: [], dots: [], texts: [] };
  const length = radius * 0.5;
  const lines: OverlayLine[] = [];
  const texts: OverlayText[] = [];
  (['+x', '+y', '+z'] as const).forEach((name, axis) => {
    const tip: [number, number, number] = [
      input.reference_mm[0],
      input.reference_mm[1],
      input.reference_mm[2],
    ];
    tip[axis] = (tip[axis] as number) + length;
    const end = project(tip);
    if (end === null) return;
    const colour = ITEM_AXIS_COLOURS[axis] as string;
    lines.push({
      x1: panel.x + origin[0],
      y1: panel.y + origin[1],
      x2: panel.x + end[0],
      y2: panel.y + end[1],
      colour,
      width: 2,
    });
    const dx = end[0] - origin[0];
    const dy = end[1] - origin[1];
    const reach = Math.hypot(dx, dy);
    // An axis that points at the camera has no direction on the picture: its name sits beside.
    const ux = reach > 4 ? dx / reach : 0.7;
    const uy = reach > 4 ? dy / reach : -0.7;
    texts.push({
      x: panel.x + end[0] + ux * 9,
      y: panel.y + end[1] + uy * 9,
      text: name,
      size: 11,
      colour,
      align: 'center',
      baseline: 'middle',
      bold: true,
      halo: 'rgba(255, 255, 255, 0.92)',
    });
  });
  return {
    lines,
    dots: [{ x: panel.x + origin[0], y: panel.y + origin[1], r: 3, colour: '#111111' }],
    texts: [
      ...texts,
      {
        x: panel.x + origin[0],
        y: panel.y + origin[1] + 5,
        text: 'ref',
        size: 10,
        colour: '#111111',
        align: 'center',
        baseline: 'top',
        halo: 'rgba(255, 255, 255, 0.92)',
      },
    ],
  };
}
