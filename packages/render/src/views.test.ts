import { describe, expect, it } from 'vitest';
import type { ViewSubject } from './types.ts';
import { SCENE_VIEW_NAMES } from './types.ts';
import { fitView, PLAN_DIRECTION, VIEW_FOV_DEG, viewLabel, viewSpec } from './views.ts';

// The owner's machine as its level card states it: lower basket pulled out, upper basket in.
const loading: ViewSubject = {
  tub_min_mm: [-272, -235, 0],
  tub_max_mm: [273, 265, 640],
  racks: [
    { rack: 'lower_rack', origin_mm: [-262.5, -762, 73], envelope_mm: [525, 512, 292] },
    { rack: 'cutlery_basket', origin_mm: [-56, -754, 73], envelope_mm: [128, 230, 127] },
    { rack: 'upper_rack', origin_mm: [-244, -258, 420], envelope_mm: [500, 498, 190] },
  ],
};
// Both baskets pushed in.
const closed: ViewSubject = {
  ...loading,
  racks: [
    { rack: 'lower_rack', origin_mm: [-262.5, -262, 73], envelope_mm: [525, 512, 292] },
    { rack: 'cutlery_basket', origin_mm: [-56, -254, 73], envelope_mm: [128, 230, 127] },
    { rack: 'upper_rack', origin_mm: [-244, -258, 420], envelope_mm: [500, 498, 190] },
  ],
};

describe('named views', () => {
  it('every view has a label and a unit viewing direction', () => {
    for (const view of SCENE_VIEW_NAMES) {
      expect(viewLabel(view).length).toBeGreaterThan(0);
      const spec = viewSpec(view, loading);
      expect(Math.hypot(...spec.toward_camera)).toBeCloseTo(1, 9);
      expect(spec.up).toEqual([0, 0, 1]);
    }
  });

  it('the three-quarter view looks at the middle of the basket where it now is', () => {
    const out = viewSpec('iso_lower', loading);
    // Centre of the pulled-out lower basket: origin + envelope / 2.
    expect(out.target_mm).toEqual([0, -506, 219]);
    const pushedIn = viewSpec('iso_lower', closed);
    expect(pushedIn.target_mm).toEqual([0, -6, 219]);
    // From the front (negative y), the right (positive x) and above.
    expect(out.toward_camera[0]).toBeGreaterThan(0);
    expect(out.toward_camera[1]).toBeLessThan(0);
    expect(out.toward_camera[2]).toBeGreaterThan(0);
    expect(out.kind).toBe('perspective');
  });

  it('the plan views look straight down with the back of the machine up', () => {
    const top = viewSpec('top_upper', loading);
    expect(top.kind).toBe('orthographic');
    expect(top.toward_camera).toEqual(PLAN_DIRECTION);
    // Within 0.03 degrees of vertical, leaning to the front so that +y is up in the picture.
    expect(PLAN_DIRECTION[2]).toBeGreaterThan(0.9999998);
    expect(PLAN_DIRECTION[1]).toBeLessThan(0);
    expect(top.target_mm).toEqual([6, -9, 515]);
    // The basket fits with the margin: half extents 250 and 249 times 1.12.
    expect(top.fit_half_width_mm).toBeCloseTo(280, 9);
    expect(top.fit_half_height_mm).toBeCloseTo(278.88, 9);
  });

  it('a plan view is cut above the basket only when another basket hangs over it', () => {
    // Lower basket out, upper in: nothing over the lower basket.
    expect(viewSpec('top_lower', loading).clip_above_mm).toBeNull();
    // Both in: the upper basket covers the lower one; cut at the top of its envelope.
    expect(viewSpec('top_lower', closed).clip_above_mm).toBe(365);
    // The cutlery basket stands in the lower basket: also covered, cut at its own top.
    expect(viewSpec('top_cutlery', closed).clip_above_mm).toBe(200);
    expect(viewSpec('top_cutlery', loading).clip_above_mm).toBeNull();
    // Nothing is ever over the upper basket.
    expect(viewSpec('top_upper', closed).clip_above_mm).toBeNull();
  });

  it('a basket set lower than the envelope of the one beneath it is still cut away', () => {
    // The machine as the level card has it today: the lower envelope ends at 413 mm, the
    // upper basket's floor is at 420, 395 or 370 mm (heights 1, 2, 3).
    const at = (upperFloor: number, lowerOut: boolean, upperOut: boolean): ViewSubject => ({
      ...closed,
      racks: [
        {
          rack: 'lower_rack',
          origin_mm: [-262.5, lowerOut ? -762 : -262, 73],
          envelope_mm: [525, 512, 340],
        },
        {
          rack: 'cutlery_basket',
          origin_mm: [-56, lowerOut ? -754 : -254, 73],
          envelope_mm: [128, 230, 127],
        },
        {
          rack: 'upper_rack',
          origin_mm: [-244, upperOut ? -698 : -258, upperFloor],
          envelope_mm: [500, 498, 220],
        },
      ],
    });
    // Height 1: cut at the top of the lower envelope, as before.
    expect(viewSpec('top_lower', at(420, false, false)).clip_above_mm).toBe(413);
    // Heights 2 and 3, both baskets in or both out: cut under the upper basket, so that
    // neither its wires nor its load are drawn over the lower one.
    for (const floor of [395, 370]) {
      for (const out of [false, true]) {
        const spec = viewSpec('top_lower', at(floor, out, out));
        expect(spec.clip_above_mm, `floor ${floor}, out ${out}`).toBe(floor - 15);
        expect(viewSpec('top_cutlery', at(floor, out, out)).clip_above_mm).toBe(200);
        // And the lower basket does not show through the plan view of the upper one.
        expect(viewSpec('top_upper', at(floor, out, out)).clip_below_mm).toBe(floor - 15);
      }
      // The lower basket pulled out from under the upper one: nothing over it, no cut.
      expect(viewSpec('top_lower', at(floor, true, false)).clip_above_mm).toBeNull();
      expect(viewSpec('top_upper', at(floor, true, false)).clip_below_mm).toBeNull();
    }
    // The cutlery basket never counts as being over or under the basket it stands in.
    expect(viewSpec('top_lower', at(420, true, false)).clip_above_mm).toBeNull();
    expect(viewSpec('top_cutlery', at(420, true, false)).clip_below_mm ?? null).toBeNull();
  });

  it('the elevations are orthographic along the machine axes', () => {
    expect(viewSpec('front', loading).toward_camera).toEqual([0, -1, 0]);
    expect(viewSpec('left', loading).toward_camera).toEqual([-1, 0, 0]);
    expect(viewSpec('right', loading).toward_camera).toEqual([1, 0, 0]);
    // The side elevation spans from the front of the pulled-out basket to the back of the tub.
    const side = viewSpec('right', loading);
    expect(side.target_mm[1]).toBeCloseTo((-762 + 265) / 2, 9);
    expect(side.fit_half_width_mm).toBeCloseTo(((265 + 762) / 2) * 1.12, 9);
    // With everything in, it spans the tub and the lower basket, which reaches 27 mm in
    // front of the tub's front edge: from -262 to 265.
    expect(viewSpec('right', closed).target_mm[1]).toBeCloseTo(1.5, 9);
  });
});

describe('fitView', () => {
  it('shows the whole fitted extent in a wide and in a tall image', () => {
    const spec = viewSpec('right', loading);
    const wide = fitView(spec, 2);
    // Wide image: the height decides, unless the width needs more.
    expect(wide.half_height_mm).toBeGreaterThanOrEqual(spec.fit_half_height_mm);
    expect(wide.half_height_mm * 2).toBeGreaterThanOrEqual(spec.fit_half_width_mm);
    const tall = fitView(spec, 0.5);
    expect(tall.half_height_mm).toBeCloseTo(spec.fit_half_width_mm / 0.5, 9);
  });

  it('puts a perspective camera far enough away for the subject to fit its field of view', () => {
    const spec = viewSpec('iso_lower', loading);
    const camera = fitView(spec, 1);
    const distance = Math.hypot(
      camera.position_mm[0] - camera.target_mm[0],
      camera.position_mm[1] - camera.target_mm[1],
      camera.position_mm[2] - camera.target_mm[2],
    );
    // At the target, the visible half height is distance * tan(fov / 2).
    const visible = distance * Math.tan((VIEW_FOV_DEG * Math.PI) / 360);
    expect(visible).toBeGreaterThanOrEqual(spec.fit_half_height_mm);
    expect(camera.fov_deg).toBe(VIEW_FOV_DEG);
    // The camera is on the side the view looks from.
    expect(camera.position_mm[1]).toBeLessThan(camera.target_mm[1]);
    expect(camera.position_mm[2]).toBeGreaterThan(camera.target_mm[2]);
  });

  it('treats a degenerate aspect ratio as square', () => {
    const spec = viewSpec('front', loading);
    expect(fitView(spec, 0).half_height_mm).toBe(fitView(spec, 1).half_height_mm);
    expect(fitView(spec, Number.NaN).half_height_mm).toBe(fitView(spec, 1).half_height_mm);
  });
});
