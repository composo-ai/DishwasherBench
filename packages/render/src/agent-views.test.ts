// The views of the render query as cameras, and the marks drawn over them.
import { describe, expect, it } from 'vitest';
import {
  ITEM_VIEW_DIRECTIONS,
  customCameraSpec,
  directionOf,
  itemCamera,
  namedCameraSpec,
} from './agent-views.ts';
import type { OverlayContext } from './overlay.ts';
import {
  captionMarks,
  drawOverlay,
  elevationGridMarks,
  gridSteps,
  labelMarks,
  labelWidth,
  planGridMarks,
} from './overlay.ts';
import { RESIDUE_STEPS } from './residue-map.ts';
import type { ViewSubject } from './types.ts';
import { cameraProjector, itemAxisMarks, residueLegendMarks, viewMarks } from './view-marks.ts';

/** The owner's machine with the lower basket pulled out, millimetres. */
const SUBJECT: ViewSubject = {
  tub_min_mm: [-272, -235, 0],
  tub_max_mm: [273, 265, 640],
  racks: [
    { rack: 'lower_rack', origin_mm: [-262.5, -762, 73], envelope_mm: [525, 512, 292] },
    { rack: 'cutlery_basket', origin_mm: [-56, -754, 73], envelope_mm: [128, 230, 127] },
    { rack: 'upper_rack', origin_mm: [-244, -258, 420], envelope_mm: [500, 498, 190] },
  ],
};
const FRAMES = SUBJECT.racks.map((rack) => ({
  frame: rack.rack,
  origin_mm: rack.origin_mm,
  size_mm: rack.envelope_mm,
}));

describe('cameras', () => {
  it('measures azimuth from the front and elevation from the horizontal', () => {
    const close = (a: readonly number[], b: readonly number[]): void => {
      a.forEach((value, i) => expect(value).toBeCloseTo(b[i] as number, 12));
    };
    close(directionOf(0, 0), [0, -1, 0]); // the camera stands in front, at the door
    close(directionOf(90, 0), [1, 0, 0]); // to the right
    close(directionOf(180, 0), [0, 1, 0]); // behind
    close(directionOf(0, 90), directionOf(0, 89.9)); // never straight along the up vector
    expect(directionOf(37, 30)[2]).toBeCloseTo(0.5, 12);
  });

  it('places the custom camera where the request says', () => {
    const spec = customCameraSpec({
      azimuth_deg: 90,
      elevation_deg: 0,
      target_mm: [10, 20, 300],
      distance_mm: 1500,
      fov_deg: 40,
    });
    expect(spec.kind).toBe('perspective');
    expect(spec.position_mm[0]).toBeCloseTo(1510, 9);
    expect(spec.position_mm[1]).toBeCloseTo(20, 9);
    expect(spec.position_mm[2]).toBeCloseTo(300, 9);
    expect(spec).toMatchObject({ target_mm: [10, 20, 300], fov_deg: 40, clip_above_mm: null });
  });

  it('cuts a plan view of the upper basket just under its base grid, and of the lower one above it', () => {
    const both: ViewSubject = {
      ...SUBJECT,
      racks: SUBJECT.racks.map((rack) =>
        rack.rack === 'upper_rack' ? { ...rack, origin_mm: [-244, -698, 420] } : rack,
      ),
    };
    // The upper basket hangs over the lower one: its plan view hides what is underneath.
    const upper = namedCameraSpec('top_upper', both, 1);
    expect(upper.clip_below_mm).toBe(405);
    expect(upper.clip_above_mm).toBeNull();
    // The lower basket under it is looked at with the upper one cut away.
    const lower = namedCameraSpec('top_lower', both, 1);
    expect(lower.clip_above_mm).toBe(365);
    expect(lower.clip_below_mm).toBeNull();
    // With the upper basket pushed in over an empty tub floor nothing lies under it in plan
    // but the lower basket's rear edge (less than 30 mm): nothing is cut.
    expect(namedCameraSpec('top_lower', SUBJECT, 1).clip_above_mm).toBeNull();
  });

  it('shows an item whole from each of its four fixed sides', () => {
    expect(ITEM_VIEW_DIRECTIONS.map((direction) => direction.name)).toEqual([
      'front_above',
      'back_below',
      'top',
      'side',
    ]);
    for (const direction of ITEM_VIEW_DIRECTIONS) {
      const camera = itemCamera(
        [0, 0, 0.05],
        0.15,
        direction.azimuth_deg,
        direction.elevation_deg,
        1,
      );
      const distance = Math.hypot(
        camera.position[0],
        camera.position[1],
        camera.position[2] - 0.05,
      );
      // The bounding sphere fits inside the field of view, with the near plane in front of it.
      expect(Math.asin(0.15 / distance)).toBeLessThan((13 * Math.PI) / 180);
      expect(camera.near).toBeLessThan(distance - 0.15);
      expect(camera.far).toBeGreaterThan(distance + 0.15);
    }
  });
});

describe('the grid of a plan view', () => {
  const camera = namedCameraSpec('top_lower', SUBJECT, 1);
  const project = cameraProjector(camera, 768, 768);
  const frame = FRAMES[0] as (typeof FRAMES)[number];

  it('chooses spacings that can be read at the scale of the picture', () => {
    expect(gridSteps(1.37)).toEqual({ line: 25, label: 50 });
    expect(gridSteps(2.74)).toEqual({ line: 10, label: 20 });
    expect(gridSteps(0.65)).toEqual({ line: 50, label: 100 });
  });

  it('writes each value where its line is: a point of the picture reads as the x and y to give to place', () => {
    const marks = planGridMarks(frame, project);
    for (const x of [0, 100, 250, 500]) {
      const label = marks.texts.find((text) => text.text === String(x) && text.align === 'center');
      const at = project([frame.origin_mm[0] + x, frame.origin_mm[1], frame.origin_mm[2]]);
      if (label === undefined || at === null) throw new Error(`no label for x = ${x}`);
      // Straight under the line (within half a pixel), just outside the front edge.
      expect(Math.abs(label.x - at[0])).toBeLessThan(0.5);
      expect(label.y - at[1]).toBeGreaterThan(4);
      expect(label.y - at[1]).toBeLessThan(14);
    }
    for (const y of [100, 300, 500]) {
      const label = marks.texts.find((text) => text.text === String(y) && text.align === 'right');
      const at = project([frame.origin_mm[0], frame.origin_mm[1] + y, frame.origin_mm[2]]);
      if (label === undefined || at === null) throw new Error(`no label for y = ${y}`);
      expect(Math.abs(label.y - at[1])).toBeLessThan(0.5);
      expect(at[0] - label.x).toBeGreaterThan(4);
    }
    // +x is to the right and +y (the back of the machine) is up in the picture.
    const origin = project(frame.origin_mm) as readonly [number, number];
    const right = project([
      frame.origin_mm[0] + 100,
      frame.origin_mm[1],
      frame.origin_mm[2],
    ]) as readonly [number, number];
    const back = project([
      frame.origin_mm[0],
      frame.origin_mm[1] + 100,
      frame.origin_mm[2],
    ]) as readonly [number, number];
    expect(right[0] - origin[0]).toBeGreaterThan(100);
    expect(Math.abs(right[1] - origin[1])).toBeLessThan(0.5);
    expect(origin[1] - back[1]).toBeGreaterThan(100);
    // A line every 25 mm across the basket in both directions, and the outline of the envelope.
    expect(marks.lines).toHaveLength(22 + 21 + 4);
    expect(marks.texts.map((text) => text.text)).toEqual(expect.arrayContaining(['x mm', 'y mm']));
    // Everything is inside the picture.
    for (const line of marks.lines) {
      for (const value of [line.x1, line.y1, line.x2, line.y2]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(768);
      }
    }
  });

  it('is the same every time', () => {
    expect(JSON.stringify(planGridMarks(frame, project))).toBe(
      JSON.stringify(planGridMarks(frame, project)),
    );
  });
});

describe('the grid of an elevation', () => {
  it('labels tub-frame heights at the left and gives each basket a ruler in its own frame', () => {
    const camera = namedCameraSpec('front', SUBJECT, 1);
    const project = cameraProjector(camera, 768, 768);
    const marks = elevationGridMarks(
      {
        axis: 0,
        across_mm: [-272, 273],
        z_mm: [0, 640],
        depth_mm: 15,
        frames: FRAMES.filter((frame) => frame.frame !== 'cutlery_basket'),
      },
      project,
    );
    // The tub-frame z = 300 is written at the height of z = 300, left of the tub.
    const z300 = marks.texts.find(
      (text) => text.text === '300' && text.align === 'right' && text.size === 12,
    );
    const at = project([-272, 15, 300]) as readonly [number, number];
    expect(z300?.y).toBeCloseTo(at[1], 6);
    expect(z300?.x).toBeLessThan(at[0]);
    // The lower basket's own ruler: its 100 is 100 mm above its base grid (tub z = 173).
    const rack100 = marks.texts.find(
      (text) => text.text === '100' && text.align === 'right' && text.size === 11,
    );
    const rackAt = project([-262.5, 15, 173]) as readonly [number, number];
    expect(rack100?.y).toBeCloseTo(rackAt[1], 6);
    expect(marks.texts.some((text) => text.text === 'lower_rack: x, z mm')).toBe(true);
    expect(marks.texts.some((text) => text.text === 'upper_rack: x, z mm')).toBe(true);
    expect(marks.texts.some((text) => text.text === 'z mm (tub)')).toBe(true);
  });
});

describe('labels', () => {
  it('puts every label inside the picture, on its item, and apart from the others', () => {
    const anchors = Array.from({ length: 30 }, (_, i) => ({
      text: `plate_${String(i).padStart(2, '0')}`,
      x: 300 + (i % 6) * 22,
      y: 300 + Math.floor(i / 6) * 14,
    }));
    const marks = labelMarks(anchors, 768, 768);
    expect(marks.texts.map((text) => text.text)).toEqual(anchors.map((anchor) => anchor.text));
    expect(marks.dots.map((dot) => [dot.x, dot.y])).toEqual(
      anchors.map((anchor) => [anchor.x, anchor.y]),
    );
    const boxes = marks.texts.map((text) => {
      const w = labelWidth(text.text, text.size);
      return { x: text.x - w / 2, y: text.y - (text.size + 6) / 2, w, h: text.size + 6 };
    });
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(768);
      expect(box.y + box.h).toBeLessThanOrEqual(768);
    }
    // Thirty labels crowded into 130 by 70 pixels cannot all be clear of each other, but
    // most are: fewer than a fifth of the pairs that could overlap do.
    let overlapping = 0;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i] as (typeof boxes)[number];
        const b = boxes[j] as (typeof boxes)[number];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
          overlapping += 1;
      }
    }
    expect(overlapping).toBeLessThan((30 * 29) / 2 / 5);
    // A point outside the picture gets no label.
    expect(labelMarks([{ text: 'gone', x: -5, y: 10 }], 768, 768).texts).toEqual([]);
  });

  it('labels what the view draws and nothing else', () => {
    const upperOut: ViewSubject = {
      ...SUBJECT,
      racks: SUBJECT.racks.map((rack) =>
        rack.rack === 'upper_rack' ? { ...rack, origin_mm: [-244, -698, 420] } : rack,
      ),
    };
    const camera = namedCameraSpec('top_upper', upperOut, 1);
    const marks = viewMarks({
      view: 'top_upper',
      width: 768,
      height: 768,
      project: cameraProjector(camera, 768, 768),
      tub_min_mm: upperOut.tub_min_mm,
      tub_max_mm: upperOut.tub_max_mm,
      frames: upperOut.racks.map((rack) => ({
        frame: rack.rack,
        origin_mm: rack.origin_mm,
        size_mm: rack.envelope_mm,
      })),
      grid: true,
      labels: true,
      items: [
        { item_id: 'mug_01', centre_mm: [150, -550, 470] },
        { item_id: 'plate_01', centre_mm: [-100, -400, 210] },
      ],
      notes: [
        { text: 'tine_row_a', frame: 'upper_rack', at_mm: [-112, -440, 420] },
        { text: 'tine_row_r1', frame: 'lower_rack', at_mm: [-200, -340, 84] },
      ],
      clip_above_mm: camera.clip_above_mm,
      clip_below_mm: camera.clip_below_mm ?? null,
    });
    const texts = marks.texts.map((text) => text.text);
    // The mug is in the upper basket; the plate is in the basket underneath, which the view cuts away.
    expect(texts).toContain('mug_01');
    expect(texts).not.toContain('plate_01');
    expect(texts).toContain('tine_row_a');
    expect(texts).not.toContain('tine_row_r1');
    expect(texts[texts.length - 1]).toBe(
      'top_upper | grid: upper_rack frame x, y (mm) | labels: item ids',
    );
    // Without grid or labels the picture is the bare scene.
    const bare = viewMarks({
      view: 'iso_lower',
      width: 768,
      height: 768,
      project: cameraProjector(namedCameraSpec('iso_lower', SUBJECT, 1), 768, 768),
      tub_min_mm: SUBJECT.tub_min_mm,
      tub_max_mm: SUBJECT.tub_max_mm,
      frames: FRAMES,
      grid: false,
      labels: false,
      items: [{ item_id: 'mug_01', centre_mm: [0, 0, 100] }],
      clip_above_mm: null,
    });
    expect(bare).toEqual({ lines: [], dots: [], texts: [] });
  });

  it('draws marks with plain canvas calls, in order', () => {
    const calls: string[] = [];
    const record =
      (name: string) =>
      (...args: unknown[]): void => {
        calls.push(
          `${name}(${args.map((arg) => (typeof arg === 'number' ? Math.round(arg) : String(arg))).join(',')})`,
        );
      };
    const context = {
      font: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      stroke: record('stroke'),
      arc: record('arc'),
      fill: record('fill'),
      fillRect: record('fillRect'),
      strokeRect: record('strokeRect'),
      fillText: record('fillText'),
      strokeText: record('strokeText'),
    } satisfies OverlayContext;
    drawOverlay(context, {
      lines: [{ x1: 1, y1: 2, x2: 3, y2: 4, colour: 'red', width: 1 }],
      dots: [{ x: 5, y: 6, r: 3, colour: 'black' }],
      texts: [
        ...captionMarks('top_lower', 768).texts,
        {
          x: 9,
          y: 9,
          text: '100',
          size: 12,
          colour: 'blue',
          align: 'center',
          baseline: 'middle',
          halo: 'white',
        },
      ],
    });
    expect(calls).toEqual([
      'beginPath()',
      'moveTo(1,2)',
      'lineTo(3,4)',
      'stroke()',
      'beginPath()',
      'arc(5,6,3,0,6)',
      'fill()',
      'fillRect(6,4,70,17)',
      'strokeRect(7,5,69,16)',
      'fillText(top_lower,10,7)',
      'strokeText(100,9,9)',
      'fillText(100,9,9)',
    ]);
  });
});

describe('marks for single items and washed loads', () => {
  const box = {
    min_mm: [-90, -12, -5] as [number, number, number],
    max_mm: [95, 12, 14] as [number, number, number],
  };
  const panel = { x: 256, y: 0, width: 256, height: 256 };

  it('draws the axes of an item from its reference point, inside the panel, +x where +x is', () => {
    // Straight down: the item's +x is to the right of the picture and +y up.
    const top = itemAxisMarks({
      ...box,
      reference_mm: [0, 0, 0],
      azimuth_deg: 0,
      elevation_deg: 89.9,
      panel,
    });
    expect(top.lines).toHaveLength(3);
    const [x, y] = top.lines as [(typeof top.lines)[number], (typeof top.lines)[number]];
    expect(x.x2).toBeGreaterThan(x.x1 + 20);
    expect(Math.abs(x.y2 - x.y1)).toBeLessThan(2);
    expect(y.y2).toBeLessThan(y.y1 - 20);
    expect(top.texts.map((text) => text.text)).toEqual(['+x', '+y', '+z', 'ref']);
    for (const line of top.lines) {
      for (const value of [line.x1, line.x2]) {
        expect(value).toBeGreaterThanOrEqual(panel.x);
        expect(value).toBeLessThanOrEqual(panel.x + panel.width);
      }
    }
    // The reference point is where the arrows start: moving it moves them.
    const moved = itemAxisMarks({
      ...box,
      reference_mm: [60, 0, 0],
      azimuth_deg: 0,
      elevation_deg: 89.9,
      panel,
    });
    expect(moved.dots[0]?.x).toBeGreaterThan((top.dots[0]?.x ?? 0) + 10);
    // From the right side +y points to the right and +z up.
    const side = itemAxisMarks({
      ...box,
      reference_mm: [0, 0, 0],
      azimuth_deg: 90,
      elevation_deg: 0,
      panel,
    });
    const sideY = side.lines[1] as (typeof side.lines)[number];
    const sideZ = side.lines[2] as (typeof side.lines)[number];
    expect(sideY.x2).toBeGreaterThan(sideY.x1 + 20);
    expect(sideZ.y2).toBeLessThan(sideZ.y1 - 20);
  });

  it('has a legend of the four steps of the residue scale, with the traces when they are drawn', () => {
    const area = { x: 0, y: 0, width: 512, height: 512 };
    const legend = residueLegendMarks(area);
    expect(legend.dots.map((dot) => dot.colour)).toEqual(RESIDUE_STEPS.map((step) => step.css));
    expect(legend.texts.slice(1).map((text) => text.text)).toEqual(
      RESIDUE_STEPS.map((step) => step.label),
    );
    for (const text of legend.texts) {
      expect(text.y).toBeGreaterThan(area.height / 2);
      expect(text.y).toBeLessThan(area.height);
    }
    const withTraces = residueLegendMarks(area, true);
    expect(withTraces.dots).toHaveLength(RESIDUE_STEPS.length + 1);
    expect(withTraces.texts[withTraces.texts.length - 1]?.text).toMatch(/trace/);
  });

  it('outlines the cells of the cutlery basket in its plan view only', () => {
    const input = {
      width: 400,
      height: 400,
      project: (point: readonly [number, number, number]) => [point[0], point[1]] as const,
      tub_min_mm: [-300, -300, 0] as [number, number, number],
      tub_max_mm: [300, 300, 800] as [number, number, number],
      frames: [],
      grid: false,
      labels: true,
      items: [],
      notes: [
        {
          text: 'cell_c00',
          frame: 'cutlery_basket',
          at_mm: [30, 30, 100] as [number, number, number],
        },
      ],
      outlines: [
        {
          frame: 'cutlery_basket',
          loop_mm: [
            [10, 10, 100],
            [60, 10, 100],
            [60, 50, 100],
            [10, 50, 100],
          ] as [number, number, number][],
        },
      ],
      clip_above_mm: null,
    };
    const cutlery = viewMarks({ ...input, view: 'top_cutlery' });
    expect(cutlery.lines).toHaveLength(4);
    expect(cutlery.texts.some((text) => text.text === 'cell_c00')).toBe(true);
    const lower = viewMarks({ ...input, view: 'top_lower' });
    expect(lower.lines).toHaveLength(0);
    expect(lower.texts.some((text) => text.text === 'cell_c00')).toBe(false);
  });
});
